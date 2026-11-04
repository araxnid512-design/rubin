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

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

/**
 * Пальцы обеих кистей: { L|R: { Thumb: [{ bone, axis }, ×3], Index … } } — ось сгиба каждой фаланги в её осях, как в
 * src/hero-animations.js (HeroRig): (направление фаланги × нормаль ладони) — кончик идёт к ладони. В покое (T-поза)
 * оси всех костей мировые, поэтому позиции суставов покоя — сумма смещений. null — не человек.
 */
export function fingerRig(model) {
	const n = (s) => model.getObjectByName(`mixamorig${s}`) ?? model.getObjectByName(s);
	const out = {};
	for (const [s, S] of [['L', 'Left'], ['R', 'Right']]) {
		const hand = n(`${S}Hand`);
		if (!hand) return null;
		// позиция сустава покоя относительно кисти: сумма смещений от кисти по цепочке
		const rel = (b) => { const p = new THREE.Vector3(); for (let o = b; o && o !== hand; o = o.parent) p.add(o.position); return p; };
		const mid = rel(n(`${S}HandMiddle1`)), idx = rel(n(`${S}HandIndex1`)), pinky = rel(n(`${S}HandPinky1`));
		const F = mid.clone().normalize();
		const T = idx.clone().sub(pinky);
		T.addScaledVector(F, -T.dot(F)).normalize();
		const P = s === 'L' ? new THREE.Vector3().crossVectors(F, T) : new THREE.Vector3().crossVectors(T, F);
		out[s] = { P, F, T };
		for (const f of FINGERS) {
			out[s][f] = [1, 2, 3].map((k) => {
				const bone = n(`${S}Hand${f}${k}`), child = n(`${S}Hand${f}${k + 1}`);
				const dir = (child ? child.position : bone.position).clone().normalize();
				return { bone, axis: new THREE.Vector3().crossVectors(dir, P).normalize() };
			});
		}
	}
	return out;
}

/** Кости и узлы левой руки модели (один раз): null — не человек (у заражённых своего хвата нет). */
function rig(model) {
	const n = (s) => model.getObjectByName(`mixamorig${s}`) ?? model.getObjectByName(s);
	const r = { arm: n('LeftArm'), fore: n('LeftForeArm'), hand: n('LeftHand'), gripL: model.getObjectByName('GripL'), gripR: model.getObjectByName('GripR') };
	return r.arm && r.fore && r.hand && r.gripL && r.gripR ? r : null;
}

// ---------- Пальцы на оружии ----------
// Клипы запечены с одним сгибом пальцев на все стволы (кулак на рукояти, кисть на цевье), а рукояти и цевья у моделей
// разные: пальцы проваливались в оружие или висели в воздухе. Сгиб каждой фаланги под каждую модель найден заранее
// (game/grasp.js: фаланга сгибается, пока не ляжет на поверхность оружия, без провала внутрь) и ставится поверх клипа:
// правая кисть — всегда, пока оружие в ней; левая — с весом IK цевья (ушла к магазину — пальцы по клипу).
// Указательный правой: вдоль ствольной коробки или на спуске — по клипу (в прицеле и при выстреле палец на спуске).
const D2R = Math.PI / 180;
const graspQ = new WeakMap(); // данные ствола → кватернионы фаланг (на модель героя оси одни, считаются один раз)
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function graspQuats(G, F) {
	let out = graspQ.get(G);
	if (out) return out;
	out = {};
	for (const s of ['R', 'L']) {
		if (!G[s]) continue;
		out[s] = {};
		for (const [f, g] of Object.entries(G[s])) {
			const finger = f.startsWith('Index') ? 'Index' : f;
			if (!F[s][finger] || !Array.isArray(g.a)) continue;
			out[s][f] = g.a.map((deg, k) => {
				const q = new THREE.Quaternion().setFromAxisAngle(F[s][finger][k].axis, deg * D2R);
				return k === 0 && g.opp ? new THREE.Quaternion().setFromAxisAngle(F[s].P, g.opp * D2R).multiply(q) : q;
			});
		}
	}
	graspQ.set(G, out);
	return out;
}

function setFinger(joints, qs, w) {
	for (let k = 0; k < 3; k++) {
		const b = joints[k].bone;
		if (w >= 1) b.quaternion.copy(qs[k]); else b.quaternion.slerp(qs[k], w);
	}
}

/** Пальцы на рукояти и цевье именно этой модели оружия. Вызывать после leftHandIK (вес левой — оттуда). */
export function handGrasp(model, cache) {
	const r = cache.rig;
	if (!r) return;
	let gun = null;
	for (const o of r.gripR.children) if (o.visible && o.userData.grasp) { gun = o; break; }
	if (!gun) return;
	const F = (cache.fingers ??= fingerRig(model));
	if (!F) return;
	const Q = graspQuats(gun.userData.grasp, F);
	if (Q.R) {
		for (const f of ['Middle', 'Ring', 'Pinky', 'Thumb']) if (Q.R[f]) setFinger(F.R[f], Q.R[f], 1);
		if (Q.R.Index) {
			// палец на спуске — если клип согнул указательный (в прицеле ~36°, при выстреле ~64°), иначе вдоль коробки
			const clip = 2 * Math.acos(Math.min(1, Math.abs(F.R.Index[0].bone.quaternion.w))) / D2R;
			const t = Q.R.IndexTrigger ? Math.max(0, Math.min(1, (clip - 15) / 15)) : 0;
			for (let k = 0; k < 3; k++) {
				_q.copy(Q.R.Index[k]);
				if (t > 0) _q.slerp(Q.R.IndexTrigger[k], t);
				if (k === 0 && t > 0 && clip > 45) _q.multiply(_q2.setFromAxisAngle(F.R.Index[0].axis, (clip - 45) * 0.5 * D2R)); // жмёт спуск
				F.R.Index[k].bone.quaternion.copy(_q);
			}
		}
	}
	const w = cache.ikW ?? 0;
	if (Q.L && w > 0) for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) if (Q.L[f]) setFinger(F.L[f], Q.L[f], w);
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
	cache.ikW = 0;
	if (dist >= OFF) return;
	const w = dist <= ON ? 1 : 1 - (dist - ON) / (OFF - ON);
	cache.ikW = w;
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
