// Присед героя — поверх любого клипа (стоит, идёт, целится, стреляет, перезаряжается, бьёт топором): таз ниже,
// стопы остаются там, где их поставил клип (двухзвенный IK ноги: бедро → колено → стопа, колено — вперёд по ходу
// героя), корпус чуть наклонён вперёд. Верх (руки, оружие) едет вниз вместе с тазом — клипы рук не меняются,
// левая кисть потом встаёт на цевьё (game/hand-ik.js) уже в новой позе.

import * as THREE from 'three';

/** Насколько ниже таз в полном приседе — доля длины ноги (бедро + голень): колено согнуто примерно на 100°. */
const DROP = 0.36;
/** Наклон корпуса вперёд в полном приседе, рад. */
const LEAN = 0.3;

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3();
const tmp = new THREE.Vector3(), pole = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3();
const q = new THREE.Quaternion(), qp = new THREE.Quaternion(), qa = new THREE.Quaternion(), qr = new THREE.Quaternion();
const feet = [new THREE.Vector3(), new THREE.Vector3()], footQ = [new THREE.Quaternion(), new THREE.Quaternion()];

function rig(model) {
	const n = (s) => model.getObjectByName(`mixamorig${s}`) ?? model.getObjectByName(s);
	const leg = (s) => ({ up: n(`${s}UpLeg`), knee: n(`${s}Leg`), foot: n(`${s}Foot`) });
	const r = { hips: n('Hips'), spine: n('Spine'), legs: [leg('Left'), leg('Right')] };
	if (!r.hips || !r.spine || r.legs.some((l) => !l.up || !l.knee || !l.foot)) return null;
	// длина ноги по позе покоя (в метрах мира — с масштабом модели)
	model.updateMatrixWorld(true);
	const l = r.legs[0];
	l.up.getWorldPosition(a); l.knee.getWorldPosition(b); l.foot.getWorldPosition(c);
	r.leg = a.distanceTo(b) + b.distanceTo(c);
	return r;
}

function setWorldQ(bone, qWorld) {
	bone.parent.getWorldQuaternion(qp);
	bone.quaternion.copy(qp.invert().multiply(qWorld));
	bone.updateMatrixWorld(true);
}

/** Нога: бедро up → колено → стопа в точку target, колено — в сторону forward. */
function solveLeg(l, target, forward) {
	l.up.getWorldPosition(a); l.knee.getWorldPosition(b); l.foot.getWorldPosition(c);
	const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
	const to = tmp.subVectors(target, a), d = Math.min(Math.max(to.length(), Math.abs(l1 - l2) + 0.01), (l1 + l2) * 0.999);
	const dir = to.normalize();
	// колено — вперёд: направление героя без составляющей вдоль ноги (и чуть от того, куда колено смотрит в клипе)
	pole.subVectors(b, a).addScaledVector(dir, -b.clone().sub(a).dot(dir)).multiplyScalar(0.5).add(forward);
	pole.addScaledVector(dir, -pole.dot(dir));
	if (pole.lengthSq() < 1e-8) return;
	pole.normalize();
	const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
	const knee = a.clone().addScaledVector(dir, l1 * cosA).addScaledVector(pole, l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
	const ankle = a.clone().addScaledVector(dir, d);
	l.up.getWorldQuaternion(qa);
	q.setFromUnitVectors(b.clone().sub(a).normalize(), knee.clone().sub(a).normalize());
	setWorldQ(l.up, q.multiply(qa));
	l.knee.getWorldPosition(b); l.foot.getWorldPosition(c);
	l.knee.getWorldQuaternion(qa);
	q.setFromUnitVectors(c.clone().sub(b).normalize(), ankle.sub(b).normalize());
	setWorldQ(l.knee, q.multiply(qa));
}

/**
 * Присед силой k (0 — стоит, 1 — полный) поверх позы клипа. root — узел героя (его поворот — «вперёд»),
 * cache — объект актёра. Вызывать после анимации и отдачи, до IK левой кисти.
 */
export function crouchPose(model, root, k, cache) {
	if (cache.rig === undefined) cache.rig = rig(model);
	const r = cache.rig;
	if (!r) return;
	// клип без дорожки этой кости её не трогает — в ней ещё прошлый присед: вернуть позу клипа (иначе копилось бы)
	if (cache.hips && r.hips.position.equals(cache.hips.done)) r.hips.position.copy(cache.hips.base);
	if (cache.spine && r.spine.quaternion.equals(cache.spine.done)) r.spine.quaternion.copy(cache.spine.base);
	cache.hips = cache.spine = null;
	if (k <= 0.001) return;
	const hipsBase = r.hips.position.clone(), spineBase = r.spine.quaternion.clone();
	r.hips.parent.updateWorldMatrix(true, false);
	r.hips.updateMatrixWorld(true);
	// где стопы по клипу — туда же их вернёт IK
	r.legs.forEach((l, i) => { l.foot.getWorldPosition(feet[i]); l.foot.getWorldQuaternion(footQ[i]); });
	// таз ниже (в осях родителя — у скелета свой масштаб)
	r.hips.getWorldPosition(t);
	t.y -= DROP * r.leg * k;
	r.hips.position.copy(r.hips.parent.worldToLocal(t));
	r.hips.updateMatrixWorld(true);
	// корпус — вперёд, вокруг правой оси героя
	fwd.set(0, 0, 1).applyQuaternion(root.getWorldQuaternion(qr)).setY(0).normalize();
	side.set(0, 1, 0).cross(fwd).normalize();
	r.spine.getWorldQuaternion(qa);
	q.setFromAxisAngle(side, LEAN * k);
	setWorldQ(r.spine, q.multiply(qa));
	cache.hips = { base: hipsBase, done: r.hips.position.clone() };
	cache.spine = { base: spineBase, done: r.spine.quaternion.clone() };
	// ноги: стопы на прежних местах, поворот стоп — как в клипе
	r.legs.forEach((l, i) => {
		solveLeg(l, feet[i], fwd);
		setWorldQ(l.foot, footQ[i]);
	});
}
