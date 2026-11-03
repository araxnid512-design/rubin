// Новые модели оружия (Tripo: models/game/w_<id>.glb — ужатые копии godot/assets/tripo, scripts/shrink-weapons.mjs)
// и их посадка в руку — так же, как в Godot-версии (godot/scripts/gear.gd, Gear.weapon):
//   1) новая модель ложится на место старой процедурной (заготовки в game/weapons.js): ствол — туда же, куда дуло
//      старой (−Y осей хвата), верх — вверх (+Z), дульный срез — на месте старого, по остальным осям — по центру;
//   2) масштаб — до настоящей длины оружия (LENGTH) и ещё на треть меньше (SCALE, просьба пользователя), вокруг хвата;
//   3) рукоять и цевьё — свои у каждой модели (HOLD, доли габарита, размечены по сетке на самих моделях): правый кулак
//      (начало осей) — на рукоять, точка левой кисти (userData.gripL, для IK — game/hand-ik.js) — на цевьё, дуло —
//      середина среза ствола (userData.muzzle: вспышка, пули, гильзы — как у старых моделей);
//   4) холодное оружие (без дула) — по главной оси вершин и лезвию (fitMelee).
// Оси хвата — как у старых моделей (см. game/weapons.js): начало — центр кулака, +Z — к большому пальцу, −Y — ствол.

import * as THREE from 'three';

/** Настоящая длина, м (кого нет — как старая модель); и всё оружие на треть меньше настоящего. */
export const LENGTH = {
	spas12: 1.04, aks: 0.73, ak74: 0.943, ak47: 0.88, aug: 0.79, fnfal: 1.09, svd: 1.225,
	glock17: 0.186, deagle: 0.27, dbarrel: 1.1, ak107: 0.943, rpk: 1.04, awm: 1.2, g36: 1.0, mp5: 0.68,
};
export const SCALE = 0.67;
/** Рукоять и цевьё: [[u, v] рукояти, [u, v] цевья], u — доля длины от дула (0) к прикладу (1), v — от верха (0) вниз. */
export const HOLD = {
	glock17: [[0.79, 0.58], []], deagle: [[0.83, 0.58], []],
	spas12: [[0.72, 0.60], [0.38, 0.46]], dbarrel: [[0.70, 0.42], [0.46, 0.23]],
	aks: [[0.58, 0.53], [0.22, 0.35]], ak47: [[0.70, 0.44], [0.36, 0.27]],
	ak74: [[0.70, 0.44], [0.36, 0.28]], ak107: [[0.69, 0.45], [0.35, 0.28]],
	fnfal: [[0.70, 0.46], [0.33, 0.26]], rpk: [[0.78, 0.48], [0.52, 0.27]],
	svd: [[0.74, 0.55], [0.38, 0.46]], awm: [[0.64, 0.56], [0.40, 0.49]],
	aug: [[0.54, 0.50], [0.33, 0.55]], g36: [[0.64, 0.60], [0.28, 0.45]], mp5: [[0.66, 0.56], [0.25, 0.36]],
};
/** Отдача модели при выстреле (вся модель назад по стволу, м) — подвижной части у цельной модели нет. */
const KICKBACK = { glock17: 0.02, deagle: 0.026, dbarrel: 0.018, spas12: 0.02, awm: 0.02, svd: 0.018 };

// как цевьё лежит в левой ладони (оси узла GripL кисти): наискось, большой палец вперёд-влево вдоль ствола —
// как FOREGRIP в src/hero-animations.js
const FORE_Q = (() => {
	const Z = new THREE.Vector3(0.6, -0.6, 0.3).normalize();
	const B = new THREE.Vector3(-0.6, -0.6, 0.2);
	const Y = B.clone().addScaledVector(Z, -B.dot(Z)).normalize().negate();
	const X = new THREE.Vector3().crossVectors(Y, Z);
	return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
})();

const templates = {};
const fits = {};

/** Загрузить модели (load(name) → gltf, как loadModel в main.js). Не загрузилась — у этого ствола старая модель. */
export async function loadTripoWeapons(load, ids) {
	await Promise.all(ids.map(async (id) => {
		try {
			templates[id] = (await load(`w_${id}`)).scene;
		} catch (e) {
			console.warn(`модель w_${id} не загрузилась — старая`, e);
		}
	}));
}
export const hasTripo = (id) => !!templates[id];

// ---------- геометрия ----------
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
function points(root) {
	root.updateMatrixWorld(true);
	const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), out = [];
	root.traverse((o) => {
		const a = o.isMesh && o.geometry?.attributes.position;
		if (!a) return;
		_m.multiplyMatrices(inv, o.matrixWorld);
		for (let i = 0; i < a.count; i++) out.push(_v.fromBufferAttribute(a, i).applyMatrix4(_m).clone());
	});
	return out;
}
const boxOf = (pts) => new THREE.Box3().setFromPoints(pts);
const axis = (i, s) => new THREE.Vector3(i === 0 ? s : 0, i === 1 ? s : 0, i === 2 ? s : 0);
const comp = (v, i) => (i === 0 ? v.x : i === 1 ? v.y : v.z);
function setComp(v, i, x) { if (i === 0) v.x = x; else if (i === 1) v.y = x; else v.z = x; }
const basis = (a, b) => new THREE.Matrix4().makeBasis(a, b, new THREE.Vector3().crossVectors(a, b));

/** Толщина модели (размах по across) у конца оси along: доля frac длины от края (sign +1 — у max). */
function endSize(pts, box, along, sign, across, frac) {
	const lo = comp(box.min, along), hi = comp(box.max, along), cut = sign > 0 ? hi - (hi - lo) * frac : lo + (hi - lo) * frac;
	let a = Infinity, b = -Infinity;
	for (const p of pts) {
		const x = comp(p, along);
		if ((sign > 0 && x >= cut) || (sign < 0 && x <= cut)) { a = Math.min(a, comp(p, across)); b = Math.max(b, comp(p, across)); }
	}
	return b > a ? b - a : 0;
}

/** Огнестрел: новая (Tripo: верх +Y, длинная ось X или Z, дуло — к −Z) — на место старой (дуло userData.muzzle). */
function fitGun(old, fresh, muzzleSign = -1) {
	const op = points(old), np = points(fresh), ob = boxOf(op), nb = boxOf(np);
	const osz = ob.getSize(new THREE.Vector3()), nsz = nb.getSize(new THREE.Vector3()), oc = ob.getCenter(new THREE.Vector3());
	const d = old.userData.muzzle.clone().sub(oc);
	const oLong = Math.abs(d.x) >= Math.abs(d.y) && Math.abs(d.x) >= Math.abs(d.z) ? 0 : Math.abs(d.y) >= Math.abs(d.z) ? 1 : 2;
	const oSign = Math.sign(comp(d, oLong)) || -1;
	const oUp = oLong !== 2 ? 2 : 1;
	const nLong = nsz.x >= nsz.z ? 0 : 2;
	let nSign = muzzleSign;
	if (!nSign) nSign = endSize(np, nb, nLong, 1, 1, 0.12) <= endSize(np, nb, nLong, -1, 1, 0.12) ? 1 : -1;
	const E = basis(axis(nLong, nSign), new THREE.Vector3(0, 1, 0)), F = basis(axis(oLong, oSign), axis(oUp, 1));
	const s = comp(osz, oLong) / Math.max(comp(nsz, nLong), 1e-4);
	const M = F.clone().multiply(E.clone().invert()).multiply(new THREE.Matrix4().makeScale(s, s, s));
	const nb2 = boxOf(np.map((p) => p.clone().applyMatrix4(M)));
	const shift = oc.clone().sub(nb2.getCenter(new THREE.Vector3()));
	setComp(shift, oLong, (oSign > 0 ? comp(ob.max, oLong) : comp(ob.min, oLong)) - (oSign > 0 ? comp(nb2.max, oLong) : comp(nb2.min, oLong)));
	return { M: new THREE.Matrix4().makeTranslation(shift.x, shift.y, shift.z).multiply(M), oldLen: Math.max(osz.x, osz.y, osz.z) };
}

/** Холодное: главная ось вершин, голова — у конца с бо́льшим размахом, лезвие — к дальней от рукояти точке головы. */
function meleeFrame(pts) {
	const m = new THREE.Vector3();
	for (const p of pts) m.add(p);
	m.divideScalar(Math.max(1, pts.length));
	let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0;
	for (const p of pts) {
		const x = p.x - m.x, y = p.y - m.y, z = p.z - m.z;
		cxx += x * x; cxy += x * y; cxz += x * z; cyy += y * y; cyz += y * z; czz += z * z;
	}
	let v = new THREE.Vector3(1, 0.3, 0.2).normalize();
	for (let it = 0; it < 40; it++) v = new THREE.Vector3(cxx * v.x + cxy * v.y + cxz * v.z, cxy * v.x + cyy * v.y + cyz * v.z, cxz * v.x + cyz * v.y + czz * v.z).normalize();
	let lo = Infinity, hi = -Infinity;
	for (const p of pts) { const t = _v.subVectors(p, m).dot(v); lo = Math.min(lo, t); hi = Math.max(hi, t); }
	let sHi = 0, sLo = 0;
	for (const p of pts) {
		const d = _v.subVectors(p, m), t = d.dot(v), r = d.addScaledVector(v, -t).length();
		if (t >= hi - (hi - lo) * 0.2) sHi = Math.max(sHi, r); else if (t <= lo + (hi - lo) * 0.2) sLo = Math.max(sLo, r);
	}
	const ax = sHi >= sLo ? v : v.clone().negate(), lo2 = sHi >= sLo ? lo : -hi, hi2 = sHi >= sLo ? hi : -lo;
	const hc = new THREE.Vector3();
	let hn = 0;
	for (const p of pts) if (_v.subVectors(p, m).dot(ax) <= lo2 + (hi2 - lo2) * 0.5) { hc.add(p); hn++; }
	hc.divideScalar(Math.max(1, hn));
	let blade = new THREE.Vector3(), bd = -1;
	for (const p of pts) {
		if (_v.subVectors(p, m).dot(ax) < hi2 - (hi2 - lo2) * 0.25) continue;
		const off = p.clone().sub(hc);
		off.addScaledVector(ax, -off.dot(ax));
		if (off.length() > bd) { bd = off.length(); blade = off; }
	}
	if (blade.lengthSq() < 1e-10) blade = new THREE.Vector3(0, 1, 0).cross(ax);
	return { axis: ax, blade: blade.normalize(), len: hi2 - lo2, head: m.clone().addScaledVector(ax, hi2) };
}
function fitMelee(old, fresh) {
	const op = points(old), o = meleeFrame(op), n = meleeFrame(points(fresh));
	const E = basis(n.axis, n.blade), F = basis(o.axis, o.blade), s = o.len / Math.max(n.len, 1e-4);
	const M = F.clone().multiply(E.clone().invert()).multiply(new THREE.Matrix4().makeScale(s, s, s));
	const shift = o.head.clone().sub(n.head.clone().applyMatrix4(M));
	const osz = boxOf(op).getSize(new THREE.Vector3());
	return { M: new THREE.Matrix4().makeTranslation(shift.x, shift.y, shift.z).multiply(M), oldLen: Math.max(osz.x, osz.y, osz.z) };
}

/** Посадка модели id по старой модели old (вычисляется один раз). */
function fitOf(id, makeOld) {
	if (fits[id]) return fits[id];
	const old = makeOld(), fresh = templates[id], melee = !old.userData.muzzle;
	const f = melee ? fitMelee(old, fresh) : fitGun(old, fresh, -1);
	const k = (LENGTH[id] ?? f.oldLen) * SCALE / Math.max(f.oldLen, 1e-3);
	let T = new THREE.Matrix4().makeScale(k, k, k).multiply(f.M);
	const out = { T, muzzle: null, gripL: null };
	if (!melee) {
		const pts = points(fresh).map((p) => p.applyMatrix4(T)), b = boxOf(pts);
		const y0 = b.min.y, ly = b.max.y - b.min.y, z1 = b.max.z, hz = b.max.z - b.min.z, xc = (b.min.x + b.max.x) / 2;
		const at = ([u, v]) => new THREE.Vector3(xc, y0 + u * ly, z1 - v * hz);
		const hold = HOLD[id], hand = hold ? at(hold[0]) : new THREE.Vector3();
		let zs = 0, zn = 0;
		for (const p of pts) if (p.y <= y0 + ly * 0.03) { zs += p.z; zn++; }
		const muzzle = new THREE.Vector3(xc, y0, zn ? zs / zn : (b.min.z + b.max.z) / 2);
		T = new THREE.Matrix4().makeTranslation(-hand.x, -hand.y, -hand.z).multiply(T);
		out.T = T;
		out.muzzle = muzzle.sub(hand);
		if (hold?.[1]?.length) out.gripL = { pos: at(hold[1]).sub(hand), quat: FORE_Q.clone() };
	}
	old.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
	return (fits[id] = out);
}

/** Новая модель оружия id (каждый вызов — новый экземпляр, сетки и материалы общие) или null, если её нет. */
export function makeTripo(id, makeOld) {
	if (!templates[id]) return null;
	const f = fitOf(id, makeOld);
	const g = new THREE.Group();
	g.name = `Tripo_${id}`;
	const inner = new THREE.Group();
	f.T.decompose(inner.position, inner.quaternion, inner.scale);
	inner.add(templates[id].clone(true));
	inner.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	g.add(inner);
	if (f.muzzle) {
		g.userData.muzzle = f.muzzle.clone();
		g.userData.action = { part: inner, travel: KICKBACK[id] ?? 0.012, dur: 0.07 };
	}
	if (f.gripL) g.userData.gripL = { pos: f.gripL.pos.clone(), quat: f.gripL.quat.clone() };
	return g;
}
