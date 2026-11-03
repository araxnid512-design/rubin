// Левая кисть на цевье именно этой модели оружия (IK) — поверх клипа, у всех, кто держит двуручный ствол (герой,
// наёмники, муры, жители стаба). Клипы с автоматом запечены с левой кистью в одной точке для всех стволов
// (FOREGRIP в src/hero-animations.js: 29 см впереди правого кулака); у новых моделей (game/tripo-weapons.js) цевьё у
// каждой своё — кисть переносится туда двухзвенным IK (плечо → локоть → кисть), поворот кисти — как в клипе.
// Вес — по клипу: пока его левая кисть у запечённой точки (держит цевьё) — 1, ушла к магазину, к подсумку, при смене
// оружия — плавно 0 (рука идёт по клипу). Локоть остаётся в той же плоскости, что в клипе.

import * as THREE from 'three';

const BAKED = new THREE.Vector3(0.03, -0.29, 0.02);   // где левая кисть по клипу — в осях хвата правого кулака
const ON = 0.06, OFF = 0.16;                           // кисть ближе ON к этой точке — IK полностью, дальше OFF — нет
const REACH = 0.985;

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();
const gl = new THREE.Vector3(), want = new THREE.Vector3(), tmp = new THREE.Vector3(), pole = new THREE.Vector3();
const q = new THREE.Quaternion(), qh = new THREE.Quaternion(), qp = new THREE.Quaternion(), qa = new THREE.Quaternion(), qf = new THREE.Quaternion();
const inv = new THREE.Matrix4();

/** Кости и узлы левой руки модели (один раз): null — не человек (у заражённых своего хвата нет). */
function rig(model) {
	const n = (s) => model.getObjectByName(`mixamorig${s}`) ?? model.getObjectByName(s);
	const r = { arm: n('LeftArm'), fore: n('LeftForeArm'), hand: n('LeftHand'), gripL: model.getObjectByName('GripL'), gripR: model.getObjectByName('GripR') };
	return r.arm && r.fore && r.hand && r.gripL && r.gripR ? r : null;
}

/** Ствол в правом кулаке с точкой цевья (userData.gripL) или null. */
function gunIn(gripR) {
	for (const o of gripR.children) if (o.visible && o.userData.gripL) return o;
	return null;
}

/** Повернуть кость так, чтобы её мировой поворот стал qWorld (родитель уже посчитан). */
function setWorldQ(bone, qWorld) {
	bone.parent.getWorldQuaternion(qp);
	bone.quaternion.copy(qp.invert().multiply(qWorld));
	bone.updateMatrixWorld(true);
}

/** Левая кисть на цевье (cache — объект актёра для костей). Вызывать после анимации и толчка отдачи. */
export function leftHandIK(model, cache) {
	if (cache.rig === undefined) cache.rig = rig(model);
	const r = cache.rig;
	if (!r) return;
	const gun = gunIn(r.gripR);
	if (!gun) return;
	r.gripR.updateWorldMatrix(true, false);
	r.arm.parent.updateWorldMatrix(true, false);
	r.arm.updateMatrixWorld(true);
	// где левая кисть по клипу — в осях правого кулака; далеко от запечённой точки — рука занята другим
	r.gripL.getWorldPosition(gl);
	tmp.copy(gl).applyMatrix4(inv.copy(r.gripR.matrixWorld).invert());
	const dist = tmp.distanceTo(BAKED);
	if (dist >= OFF) return;
	const w = dist <= ON ? 1 : 1 - (dist - ON) / (OFF - ON);
	// цель: узел GripL кисти — на цевьё модели; кисть сдвигается на ту же разницу (поворот — как в клипе)
	want.copy(gun.userData.gripL.pos).applyMatrix4(gun.matrixWorld);
	r.hand.getWorldPosition(c);
	t.copy(c).addScaledVector(want.sub(gl), w);
	r.hand.getWorldQuaternion(qh);
	r.arm.getWorldPosition(a);
	r.fore.getWorldPosition(b);
	const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
	const to = tmp.subVectors(t, a), d = Math.min(Math.max(to.length(), Math.abs(l1 - l2) + 0.01), (l1 + l2) * REACH);
	const dir = to.normalize();
	pole.subVectors(b, a);
	pole.addScaledVector(dir, -pole.dot(dir));
	if (pole.lengthSq() < 1e-8) return;
	pole.normalize();
	const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
	const elbow = a.clone().addScaledVector(dir, l1 * cosA).addScaledVector(pole, l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
	const wrist = a.clone().addScaledVector(dir, d);
	// плечо: локоть — на новое место
	r.arm.getWorldQuaternion(qa);
	q.setFromUnitVectors(b.clone().sub(a).normalize(), elbow.clone().sub(a).normalize());
	setWorldQ(r.arm, q.multiply(qa));
	// предплечье: запястье — к цели
	r.fore.getWorldPosition(b);
	r.hand.getWorldPosition(c);
	r.fore.getWorldQuaternion(qf);
	q.setFromUnitVectors(c.sub(b).normalize(), wrist.sub(b).normalize());
	setWorldQ(r.fore, q.multiply(qf));
	// кисть: поворот как был в клипе
	setWorldQ(r.hand, qh);
}
