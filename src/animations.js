// Анимации зомби: позы задаются плавными кривыми (сплайн Эрмита по ключам),
// ноги считаются через IK — ступни стоят на земле, колени сгибаются сами.
// Результат запекается в ключевые кадры (30 к/с) для любого движка (glTF).
//
// Соглашения: персонаж смотрит в +Z; у всех костей в позе привязки нет поворотов,
// углы — эйлеровы в градусах (XYZ): x>0 — наклон вперёд, у руки x<0 — поднять вперёд.

import * as THREE from 'three';

export const ANIMATION_NAMES = ['Idle', 'Walk', 'Run', 'Attack', 'Death'];

const FPS = 30;
const D2R = THREE.MathUtils.degToRad;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Кривые ----------

/** Кривая по ключам [[t, [..значения]], ...] — кубический Эрмит (Катмулл-Ром). */
export function curve(keys, { loop = false, duration = 0 } = {}) {
	const n = keys.length;
	const dim = keys[0][1].length;
	const m = n - 1; // в цикле последний ключ совпадает с первым
	const get = (j) => {
		if (!loop) { const c = keys[Math.min(n - 1, Math.max(0, j))]; return [c[0], c[1]]; }
		const w = ((j % m) + m) % m;
		return [keys[w][0] + Math.floor(j / m) * duration, keys[w][1]];
	};
	const tangent = (i) => {
		const [ta, a] = get(i - 1), [tb, b] = get(i + 1);
		const dt = tb - ta || 1;
		return a.map((v, k) => (b[k] - v) / dt);
	};
	const tangents = keys.map((_, i) => tangent(i));
	return (t) => {
		if (loop) t = ((t % duration) + duration) % duration;
		if (t <= keys[0][0]) return keys[0][1].slice();
		if (t >= keys[n - 1][0]) return keys[n - 1][1].slice();
		let i = 0;
		while (keys[i + 1][0] < t) i++;
		const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
		const h = t1 - t0, s = (t - t0) / h;
		const s2 = s * s, s3 = s2 * s;
		const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
		const out = new Array(dim);
		for (let k = 0; k < dim; k++) out[k] = h00 * p0[k] + h10 * h * tangents[i][k] + h01 * p1[k] + h11 * h * tangents[i + 1][k];
		return out;
	};
}

/** Набор кривых по костям: { кость: [[t,[x,y,z]], ...] } → (t) => { кость: [x,y,z] } */
export function curves(map, opts) {
	const fns = Object.entries(map).map(([k, keys]) => [k, curve(keys, opts)]);
	return (t) => Object.fromEntries(fns.map(([k, f]) => [k, f(t)]));
}

// Значения для ключей «по времени»: times = [...], k(...значения) → [[t, v], ...]
export const at = (times) => (...vals) => vals.map((v, i) => [times[i], typeof v === 'number' ? [v] : v]);

// ---------- Риг и IK ----------

class Rig {
	constructor(root) {
		this.bones = {};
		root.traverse((b) => {
			if (b.isBone) this.bones[b.name] = { parent: b.parent?.isBone ? b.parent.name : null, offset: b.position.clone() };
		});
		this.names = Object.keys(this.bones);
		this.world = {};
		for (const n of this.names) {
			const p = this.bones[n].parent;
			this.world[n] = this.bones[n].offset.clone().add(p ? this.world[p] : V());
		}
		this.hipsY = this.world.Hips.y;
		// точка хвата (узел GripR внутри кисти) — для поз, заданных положением оружия
		const grip = root.getObjectByName('GripR');
		this.grip = grip ? { pos: grip.position.clone(), q: grip.quaternion.clone() } : { pos: V(0, -0.08, 0), q: new THREE.Quaternion() };
		this.ankle = { L: this.world['Foot.L'].clone(), R: this.world['Foot.R'].clone() };
		this.legLen = this.bones['LowerLeg.L'].offset.length() + this.bones['Foot.L'].offset.length();
	}
}

const _m = new THREE.Matrix4();
export function frame(up, fwdHint) {
	const u = up.clone().normalize();
	const f = fwdHint.clone().addScaledVector(u, -fwdHint.dot(u));
	if (f.lengthSq() < 1e-8) f.set(0, 0, 1).addScaledVector(u, -u.z);
	f.normalize();
	const s = new THREE.Vector3().crossVectors(u, f);
	return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(s, u, f));
}

export const eulerQ = (deg, order = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(D2R(deg[0] ?? 0), D2R(deg[1] ?? 0), D2R(deg[2] ?? 0), order));

/**
 * Поза кадра → локальные кватернионы костей.
 * pose = { hips: [x,y,z], rot: { кость: [x,y,z] } (Hips — мировой поворот таза),
 *          feet: { L: { pos:[x,y,z], rot:[x,y,z] (мировой поворот ступни) }, R: {...} } }
 */
function solvePose(rig, pose) {
	const local = {};
	for (const n of rig.names) if (n !== 'Root') local[n] = eulerQ(pose.rot[n] ?? [0, 0, 0]);
	const hipsQ = local.Hips;
	const hipsPos = V(...pose.hips);
	for (const s of ['L', 'R']) {
		const up = rig.bones[`UpperLeg.${s}`], lo = rig.bones[`LowerLeg.${s}`], ft = rig.bones[`Foot.${s}`];
		const L1 = lo.offset.length(), L2 = ft.offset.length();
		const H = up.offset.clone().applyQuaternion(hipsQ).add(hipsPos);
		const target = V(...pose.feet[s].pos);
		const footQ = eulerQ(pose.feet[s].rot, 'YXZ');
		const toA = target.clone().sub(H);
		const d = THREE.MathUtils.clamp(toA.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
		const dir = toA.normalize();
		// колено смотрит вперёд по тазу и немного по ступне
		const hint = V(0, 0, 1).applyQuaternion(hipsQ).addScaledVector(V(0, 0, 1).applyQuaternion(footQ), 0.4);
		const perp = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
		const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
		const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
		const K = H.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA);
		const A = H.clone().addScaledVector(dir, d);
		const restU = frame(lo.offset, V(0, 0, 1)), restL = frame(ft.offset, V(0, 0, 1));
		const qU = frame(K.clone().sub(H), perp).multiply(restU.clone().invert());
		const qL = frame(A.clone().sub(K), perp).multiply(restL.clone().invert());
		local[`UpperLeg.${s}`] = hipsQ.clone().invert().multiply(qU);
		local[`LowerLeg.${s}`] = qU.clone().invert().multiply(qL);
		local[`Foot.${s}`] = qL.clone().invert().multiply(footQ);
	}
	if (pose.rightGrip) solveGrip(rig, local, hipsPos, pose.rightGrip);
	if (pose.supportHand) solveSupportHand(rig, local, hipsPos, pose.supportHand);
	return { local, hips: hipsPos };
}

/** Мировая позиция и поворот кости по цепочке от таза (прямая кинематика). */
function chainWorld(rig, local, hipsPos, name) {
	const chain = [];
	for (let n = name; n && n !== 'Root'; n = rig.bones[n].parent) chain.unshift(n);
	const pos = hipsPos.clone(), q = local.Hips.clone();
	for (const n of chain.slice(1)) {
		pos.add(rig.bones[n].offset.clone().applyQuaternion(q));
		q.multiply(local[n]);
	}
	return { pos, q };
}

/** Двухзвенный IK руки: кисть (кость Hand) — в точку target с мировым поворотом handQ. */
function solveArm(rig, local, hipsPos, s, target, handQ, hintChest) {
	const sx = s === 'L' ? 1 : -1;
	const chest = chainWorld(rig, local, hipsPos, 'Chest');
	const up = rig.bones[`UpperArm.${s}`], lo = rig.bones[`Forearm.${s}`], hd = rig.bones[`Hand.${s}`];
	const L1 = lo.offset.length(), L2 = hd.offset.length();
	const S = up.offset.clone().applyQuaternion(chest.q).add(chest.pos);
	const toT = target.clone().sub(S);
	const d = THREE.MathUtils.clamp(toT.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
	const dir = toT.normalize();
	// локоть — вниз, наружу и чуть назад
	const hint = (hintChest ? V(...hintChest) : V(sx * 0.6, -1, -0.35)).applyQuaternion(chest.q);
	const perp = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
	const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
	const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
	const E = S.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA);
	const W = S.clone().addScaledVector(dir, d);
	const restU = frame(lo.offset, V(0, 0, 1)), restL = frame(hd.offset, V(0, 0, 1));
	const qU = frame(E.clone().sub(S), perp).multiply(restU.clone().invert());
	const qL = frame(W.clone().sub(E), perp).multiply(restL.clone().invert());
	local[`UpperArm.${s}`] = chest.q.clone().invert().multiply(qU);
	local[`Forearm.${s}`] = qU.clone().invert().multiply(qL);
	local[`Hand.${s}`] = qL.clone().invert().multiply(handQ);
}

/**
 * Правая рука по положению оружия: pos — центр кулака (мир), handle — куда смотрит топорище/рукоять,
 * blade — куда смотрит лезвие/ствол, hint — куда смотрит локоть (в системе груди).
 */
function solveGrip(rig, local, hipsPos, { pos, handle, blade, hint }) {
	const Z = V(...handle).normalize();
	const B = V(...blade);
	const Y = B.addScaledVector(Z, -B.dot(Z)).normalize().negate();
	const X = new THREE.Vector3().crossVectors(Y, Z);
	const gripQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
	const handQ = gripQ.clone().multiply(rig.grip.q.clone().invert());
	const target = V(...pos).sub(rig.grip.pos.clone().applyQuaternion(handQ));
	solveArm(rig, local, hipsPos, 'R', target, handQ, hint);
}

// Левая кисть обхватывает правую снизу (стрельба с двух рук)
function solveSupportHand(rig, local, hipsPos, { offset = [0.04, 0.02, -0.07], weight = 1 } = {}) {
	const r = chainWorld(rig, local, hipsPos, 'Hand.R');
	const target = new THREE.Vector3(...offset).applyQuaternion(r.q).add(r.pos);
	if (weight < 1) {
		const free = chainWorld(rig, local, hipsPos, 'Hand.L');
		target.lerp(free.pos, 1 - weight);
	}
	solveArm(rig, local, hipsPos, 'L', target, r.q.clone());
}

function bake(rig, name, duration, poseAt, { loop = false } = {}) {
	const frames = Math.round(duration * FPS);
	const times = [];
	const quats = Object.fromEntries(rig.names.filter((n) => n !== 'Root').map((n) => [n, []]));
	const hips = [];
	const prev = {};
	for (let f = 0; f <= frames; f++) {
		const t = (f / frames) * duration;
		const { local, hips: hp } = solvePose(rig, poseAt(loop && f === frames ? 0 : t));
		times.push(t);
		for (const [n, q] of Object.entries(local)) {
			if (prev[n] && prev[n].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
			prev[n] = q;
			quats[n].push(q.x, q.y, q.z, q.w);
		}
		hips.push(hp.x, hp.y, hp.z);
	}
	const tracks = Object.entries(quats).map(([n, v]) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, v));
	tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hips));
	return new THREE.AnimationClip(name, duration, tracks);
}

// ---------- Шаг: траектория ступни ----------

/**
 * Ступня в цикле ходьбы/бега (на месте: опорная нога едет назад).
 * phase 0 — касание пяткой; stance — доля опоры.
 */
export function gaitFoot(phase, { stride, stance, lift, x, y0, z0 = 0, heel = 12, toeOff = 30, drag = 0, yaw = 0, kick = 0 }) {
	const p = ((phase % 1) + 1) % 1;
	let z, y, pitch;
	if (p < stance) {
		const s = p / stance;
		z = z0 + stride / 2 - stride * s;
		const heelUp = Math.max(0, (s - 0.7) / 0.3);
		y = y0 + 0.045 * heelUp * heelUp;
		pitch = s < 0.15 ? -heel * (1 - s / 0.15) : heelUp * toeOff;
	} else {
		const s = (p - stance) / (1 - stance);
		const e = smooth(s);
		z = z0 - stride / 2 + stride * e - kick * Math.sin(Math.PI * Math.min(1, s * 1.6)) * (1 - s);
		y = y0 + 0.045 * (1 - s) * (1 - s) + lift * Math.sin(Math.PI * s) + kick * 0.6 * Math.sin(Math.PI * Math.min(1, s * 1.8)) * (1 - s);
		pitch = lerp(toeOff, drag ? drag : -heel, smooth(Math.min(1, s * 1.25)));
		if (drag) pitch = drag * Math.sin(Math.PI * s) + lerp(toeOff, 0, s) * (1 - s);
	}
	return { pos: [x, y, z], rot: [pitch, yaw, 0] };
}

// ---------- Клипы ----------

/**
 * Походки: d — длительность цикла (два шага), stride — сколько стопа проходит назад под телом за опору,
 * stance — доля цикла, пока стопа на земле. Скорость, при которой ноги не скользят: stride / (stance·d).
 */
const WALK = { d: 2.0, L: { stride: 0.46, stance: 0.62 }, R: { stride: 0.4, stance: 0.66 } };
const RUN = { d: 0.72, stride: 0.95, stance: 0.36 };
const STOMP = { d: 1.05, stride: 0.9, stance: 0.6 };
const CHARGE = { d: 0.66, stride: 1.25, stance: 0.34 };
const speedOf = ({ stride, stance }, d) => stride / (stance * d);
/** Скорость клипа (м/с) при timeScale 1 — игра подгоняет timeScale под настоящую скорость. */
export const ZOMBIE_GAIT = {
	Walk: (speedOf(WALK.L, WALK.d) + speedOf(WALK.R, WALK.d)) / 2,
	Run: speedOf(RUN, RUN.d),
	Stomp: speedOf(STOMP, STOMP.d),
	Charge: speedOf(CHARGE, CHARGE.d),
};

function idlePose(rig, t) {
	const H = rig.hipsY, a = rig.ankle;
	const d = 4;
	const w = (f, ph = 0) => Math.sin((t / d) * Math.PI * 2 * f + ph);
	const k = at([0, 1.15, 1.22, 1.3, 2.1, 2.85, 2.9, 3.0, 3.3, 3.36, d]);
	const head = curve(k(
		[22, 0, -14], [22, 2, -12], [14, 26, 2], [16, 24, 0], [24, 6, -10], [22, -4, -16], [8, -6, -18], [16, -4, -16], [20, 0, -14], [24, 0, -15], [22, 0, -14],
	), { loop: true, duration: d });
	const jaw = curve(k([6], [10], [4], [18], [14], [8], [10], [12], [26], [2], [6]), { loop: true, duration: d });
	return {
		hips: [0.025 * w(1), H - 0.045 + 0.004 * w(2, 1), 0.005 * w(1, 2)],
		rot: {
			Hips: [6 + 1.5 * w(1, 1), 4 * w(1, 0.5), -3 * w(1)],
			Spine: [11 + 1.5 * w(2, 0.4), -2 * w(1, 0.5), 2 * w(1, 0.3)],
			Chest: [7 + 1.5 * w(2, 0.8), -2 * w(1, 0.7), 1.5 * w(1, 0.6)],
			Neck: [9, 3 * w(1, 1.2), 0],
			Head: head(t),
			Jaw: jaw(t),
			'UpperArm.L': [-14 + 4 * w(1, 0.9), 0, 9 + 2 * w(1, 1.4)],
			'Forearm.L': [-22 + 4 * w(2, 1.2), 0, 0],
			'Hand.L': [14 + 5 * w(2, 1.6), 0, 4],
			'UpperArm.R': [-8 + 4 * w(1, 2.2), 0, -10 + 2 * w(1, 2.6)],
			'Forearm.R': [-16 + 4 * w(2, 2.5), 0, 0],
			'Hand.R': [18 + 5 * w(2, 2.9), 0, -4],
		},
		feet: {
			L: { pos: [a.L.x + 0.035, a.L.y, a.L.z + 0.06], rot: [0, 6, 0] },
			R: { pos: [a.R.x - 0.03, a.R.y, a.R.z - 0.07], rot: [0, -14, 0] },
		},
	};
}

// Шаркающая походка: руки тянутся вперёд, правая нога волочится, хромота.
function walkPose(rig, t) {
	const H = rig.hipsY, a = rig.ankle;
	const d = WALK.d, ph = t / d;
	const c = (f, o = 0) => Math.cos(Math.PI * 2 * (ph * f - o));
	const left = gaitFoot(ph, { ...WALK.L, lift: 0.055, x: a.L.x + 0.01, y0: a.L.y, z0: 0.02, yaw: 4 });
	const right = gaitFoot(ph - 0.5, { ...WALK.R, lift: 0.012, x: a.R.x - 0.02, y0: a.R.y, z0: -0.02, heel: 0, toeOff: 18, drag: 26, yaw: -16 });
	const limp = Math.max(0, Math.sin(Math.PI * 2 * (ph - 0.55))) * 0.018; // проседает на больную ногу
	const yaw = -7 * c(1, 0.81);
	return {
		hips: [0.03 * c(1, 0.31), H - 0.06 - 0.018 * c(2, 0.06) - limp, 0],
		rot: {
			Hips: [9, yaw, 4 * c(1, 0.31) + limp * 150],
			Spine: [13 + 2.5 * c(2, 0.15), -0.6 * yaw, -2 * c(1, 0.35)],
			Chest: [9 + 1.5 * c(2, 0.2), -0.5 * yaw, -1.5 * c(1, 0.4)],
			Neck: [8, 0.3 * yaw, 0],
			Head: [18 + 6 * c(2, 0.3), 4 * c(1, 0.1), -14 + 6 * c(1, 0.45)],
			Jaw: [12 + 9 * Math.max(0, Math.sin(Math.PI * 2 * ph * 1.5))],
			'UpperArm.L': [-78 + 5 * c(2, 0.35), 0, 7 + 3 * c(1, 0.5)],
			'Forearm.L': [-12 + 7 * c(2, 0.45), 0, 0],
			'Hand.L': [26 + 9 * c(2, 0.55), 0, 6],
			'UpperArm.R': [-66 + 6 * c(2, 0.6), 0, -9 - 3 * c(1, 0.7)],
			'Forearm.R': [-22 + 8 * c(2, 0.7), 0, 0],
			'Hand.R': [32 + 9 * c(2, 0.8), 0, -6],
		},
		feet: { L: left, R: right },
	};
}

// Бег (быстрый зомби): сильный наклон, руки тянутся к жертве, ступни захлёстывают назад.
function runPose(rig, t) {
	const H = rig.hipsY, a = rig.ankle;
	const d = RUN.d, ph = t / d;
	const c = (f, o = 0) => Math.cos(Math.PI * 2 * (ph * f - o));
	const s = (f, o = 0) => Math.sin(Math.PI * 2 * (ph * f - o));
	const opts = { stride: RUN.stride, stance: RUN.stance, lift: 0.14, heel: 8, toeOff: 45, kick: 0.22 };
	const left = gaitFoot(ph, { ...opts, x: a.L.x - 0.01, y0: a.L.y, z0: 0.06, yaw: 3 });
	const right = gaitFoot(ph - 0.5, { ...opts, x: a.R.x + 0.01, y0: a.R.y, z0: 0.06, yaw: -6 });
	const yaw = -10 * c(1, 0.75);
	return {
		hips: [0.02 * c(1, 0.18), H - 0.085 - 0.035 * c(2, 0.18), 0.02],
		rot: {
			Hips: [16, yaw, 4 * c(1, 0.18)],
			Spine: [18 + 3 * c(2, 0.25), -0.7 * yaw, 0],
			Chest: [12 + 2 * c(2, 0.3), -0.6 * yaw, 0],
			Neck: [-6, 0.3 * yaw, 0],
			Head: [-18 + 5 * c(2, 0.4), 5 * s(1, 0.2), -6 * c(1, 0.3)],
			Jaw: [32 + 10 * s(2, 0.1)],
			'UpperArm.L': [-100 + 28 * s(1, 0.1), 0, 18 + 8 * c(1, 0.2)],
			'Forearm.L': [-28 + 16 * s(1, 0.25), 0, 0],
			'Hand.L': [25 + 15 * s(2, 0.35), 0, 8],
			'UpperArm.R': [-100 - 28 * s(1, 0.12), 0, -18 - 8 * c(1, 0.22)],
			'Forearm.R': [-28 - 16 * s(1, 0.27), 0, 0],
			'Hand.R': [25 - 15 * s(2, 0.37), 0, -8],
		},
		feet: { L: left, R: right },
	};
}

// Атака: замах с рыком → выпад шагом вперёд и захват → рывок к себе и укус с трёпкой → возврат.
function attackPose(rig) {
	const H = rig.hipsY, a = rig.ankle;
	const T = [0, 0.3, 0.55, 0.7, 0.78, 0.86, 0.94, 1.05, 1.4, 1.7];
	const k = at(T);
	const body = curves({
		Hips: k([6, 0, 0], [-4, 4, 1], [14, -6, -3], [16, -5, -3], [17, -2, -2], [17, -5, -3], [17, -2, -2], [14, 0, -2], [8, 0, 0], [6, 0, 0]),
		Spine: k([11, 0, 0], [-4, 2, 0], [16, -6, 0], [18, -4, 0], [19, 2, 0], [19, -3, 0], [19, 2, 0], [15, 0, 0], [12, 0, 0], [11, 0, 0]),
		Chest: k([7, 0, 0], [-6, 2, 0], [10, -4, 0], [12, -3, 0], [13, 2, 0], [13, -2, 0], [13, 2, 0], [10, 0, 0], [8, 0, 0], [7, 0, 0]),
		Neck: k([9, 0, 0], [-12, 0, 0], [4, 0, 0], [16, 0, 0], [20, 6, 0], [20, -6, 0], [20, 6, 0], [14, 0, 0], [10, 0, 0], [9, 0, 0]),
		Head: k([22, 0, -14], [-30, 0, 6], [-14, 0, 0], [20, 0, 0], [24, 16, 5], [22, -16, -5], [26, 14, 5], [18, 0, -4], [18, 0, -12], [22, 0, -14]),
		Jaw: k([6, 0, 0], [46, 0, 0], [50, 0, 0], [0, 0, 0], [4, 0, 0], [2, 0, 0], [4, 0, 0], [8, 0, 0], [24, 0, 0], [6, 0, 0]),
		'UpperArm.L': k([-14, 0, 9], [-68, 0, 14], [-94, 0, -12], [-72, 0, -26], [-70, 0, -24], [-68, 0, -26], [-70, 0, -24], [-64, 0, -20], [-30, 0, 4], [-14, 0, 9]),
		'Forearm.L': k([-22, 0, 0], [-14, 0, 0], [-10, 0, 0], [-76, 0, 0], [-80, 0, 0], [-78, 0, 0], [-80, 0, 0], [-70, 0, 0], [-34, 0, 0], [-22, 0, 0]),
		'Hand.L': k([14, 0, 4], [-12, 0, 0], [28, 0, 0], [46, 0, 0], [48, 0, 0], [46, 0, 0], [48, 0, 0], [40, 0, 0], [20, 0, 4], [14, 0, 4]),
		'UpperArm.R': k([-8, 0, -10], [-64, 0, -14], [-96, 0, 14], [-74, 0, 28], [-72, 0, 26], [-70, 0, 28], [-72, 0, 26], [-66, 0, 22], [-24, 0, -6], [-8, 0, -10]),
		'Forearm.R': k([-16, 0, 0], [-18, 0, 0], [-10, 0, 0], [-74, 0, 0], [-78, 0, 0], [-76, 0, 0], [-78, 0, 0], [-68, 0, 0], [-28, 0, 0], [-16, 0, 0]),
		'Hand.R': k([18, 0, -4], [-12, 0, 0], [30, 0, 0], [46, 0, 0], [48, 0, 0], [46, 0, 0], [48, 0, 0], [40, 0, 0], [22, 0, -4], [18, 0, -4]),
		hips: k([0, H - 0.045, 0], [0.01, H - 0.035, -0.07], [0.02, H - 0.09, 0.2], [0.02, H - 0.1, 0.24], [0.02, H - 0.1, 0.25], [0.02, H - 0.1, 0.24], [0.02, H - 0.1, 0.25], [0.01, H - 0.085, 0.19], [0, H - 0.055, 0.03], [0, H - 0.045, 0]),
		// шаг левой вперёд и назад
		footL: k([a.L.x + 0.035, a.L.y, a.L.z + 0.06], [a.L.x + 0.035, a.L.y + 0.01, a.L.z + 0.04], [a.L.x + 0.04, a.L.y, a.L.z + 0.44], [a.L.x + 0.04, a.L.y, a.L.z + 0.44], [a.L.x + 0.04, a.L.y, a.L.z + 0.44], [a.L.x + 0.04, a.L.y, a.L.z + 0.44], [a.L.x + 0.04, a.L.y, a.L.z + 0.44], [a.L.x + 0.04, a.L.y, a.L.z + 0.44], [a.L.x + 0.035, a.L.y + 0.02, a.L.z + 0.12], [a.L.x + 0.035, a.L.y, a.L.z + 0.06]),
		footLrot: k([0, 6, 0], [8, 6, 0], [-4, 8, 0], [0, 8, 0], [0, 8, 0], [0, 8, 0], [0, 8, 0], [0, 8, 0], [6, 6, 0], [0, 6, 0]),
		// правая стоит, пятка отрывается при выпаде
		footRrot: k([0, -14, 0], [-4, -14, 0], [24, -14, 0], [30, -14, 0], [30, -14, 0], [30, -14, 0], [30, -14, 0], [24, -14, 0], [4, -14, 0], [0, -14, 0]),
	});
	// подъём левой ступни во время шага (поверх сплайна)
	const stepLift = (t) => (t > 0.3 && t < 0.55 ? 0.08 * Math.sin(Math.PI * (t - 0.3) / 0.25) : t > 1.05 && t < 1.4 ? 0.05 * Math.sin(Math.PI * (t - 1.05) / 0.35) : 0);
	return (t) => {
		const b = body(t);
		const fl = b.footL; fl[1] += stepLift(t);
		const rRise = Math.max(0, b.footRrot[0]) / 30 * 0.035;
		return {
			hips: b.hips,
			rot: b,
			feet: {
				L: { pos: fl, rot: b.footLrot },
				R: { pos: [a.R.x - 0.03, a.R.y + rRise, a.R.z - 0.07], rot: b.footRrot },
			},
		};
	};
}

// Смерть: попадание в голову → отшатывается, шаг назад → колени подкашиваются, падает на колени →
// заваливается вперёд лицом в землю, отскок, голова набок; через секунду — последняя судорога руки.
function deathPose(rig) {
	const H = rig.hipsY, a = rig.ankle;
	const T = [0, 0.1, 0.35, 0.55, 0.85, 1.05, 1.18, 1.32, 1.5, 1.6, 1.78, 2.15, 2.25, 2.4, 2.8];
	const k = at(T);
	const xL = a.L.x + 0.05, xR = a.R.x - 0.04;
	const zL = a.L.z + 0.06, zR = a.R.z - 0.3;
	const P = curves({
		hips: k([0, H - 0.045, 0], [0, H - 0.03, -0.06], [0, H - 0.05, -0.15], [0, H - 0.1, -0.09], [0.02, 0.64, 0.12], [0.02, 0.47, 0.24], [0.02, 0.48, 0.26], [0.03, 0.38, 0.45], [0.04, 0.16, 0.66], [0.04, 0.2, 0.67], [0.04, 0.135, 0.68], [0.04, 0.135, 0.68], [0.04, 0.135, 0.68], [0.04, 0.135, 0.68], [0.04, 0.135, 0.68]),
		Hips: k([6, 0, 0], [-10, 2, 3], [-6, 6, 4], [10, 6, 2], [16, 8, -4], [18, 6, -5], [24, 6, -5], [48, 8, -8], [86, 10, -8], [82, 10, -8], [87, 10, -8], [87, 10, -8], [87, 10, -8], [87, 10, -8], [87, 10, -8]),
		Spine: k([11, 0, 0], [-16, 0, 0], [0, -4, 2], [15, 0, 0], [20, 0, 0], [25, 4, 0], [30, 4, 0], [10, 2, 0], [-5, 0, 0], [0, 0, 0], [-6, 0, 0], [-6, 0, 0], [-6, 0, 0], [-6, 0, 0], [-6, 0, 0]),
		Chest: k([7, 0, 0], [-16, 0, 0], [-2, 0, 0], [10, 0, 0], [15, 0, 0], [20, 0, 0], [22, 0, 0], [5, 0, 0], [-5, 0, 0], [0, 0, 0], [-4, 0, 0], [-4, 0, 0], [-4, 0, 0], [-4, 0, 0], [-4, 0, 0]),
		Neck: k([9, 0, 0], [-22, 0, 0], [10, 0, 0], [15, 0, 0], [20, 0, 0], [25, 0, 0], [30, 0, 0], [0, 10, 0], [-10, 20, 0], [0, 20, 0], [-12, 20, 0], [-12, 20, 0], [-12, 20, 0], [-12, 20, 0], [-12, 20, 0]),
		Head: k([22, 0, -14], [-42, 10, 6], [26, -6, 10], [30, 10, -10], [35, 0, 20], [40, 0, 15], [46, 10, 10], [10, 30, 0], [-10, 55, 0], [-22, 58, 0], [-12, 60, 4], [-12, 60, 4], [-12, 60, 4], [-12, 60, 4], [-12, 60, 4]),
		Jaw: k([6], [42], [30], [34], [30], [24], [24], [18], [10], [26], [30], [30], [30], [30], [30]),
		'UpperArm.L': k([-14, 0, 9], [-52, 0, 36], [-24, 0, 20], [-10, 0, 10], [-14, 0, 12], [-4, 0, 10], [-4, 0, 8], [-48, 0, 26], [-10, 0, 40], [-22, 0, 46], [6, 0, 40], [6, 0, 40], [6, 0, 40], [6, 0, 40], [6, 0, 40]),
		'Forearm.L': k([-22, 0, 0], [-30, 0, 0], [-15, 0, 0], [-10, 0, 0], [-10, 0, 0], [-5, 0, 0], [-5, 0, 0], [-20, 0, 0], [-10, 0, 0], [-25, 0, 0], [-12, 0, 0], [-12, 0, 0], [-12, 0, 0], [-12, 0, 0], [-12, 0, 0]),
		'Hand.L': k([14, 0, 4], [-10, 0, 0], [10, 0, 0], [20, 0, 0], [20, 0, 0], [24, 0, 0], [24, 0, 0], [10, 0, 0], [0, 0, 0], [10, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
		'UpperArm.R': k([-8, 0, -10], [-60, 0, -40], [-28, 0, -22], [-12, 0, -10], [-16, 0, -12], [-6, 0, -10], [-6, 0, -8], [-70, 0, -40], [-20, 0, -96], [-26, 0, -108], [-8, 0, -104], [-8, 0, -104], [-8, 0, -104], [-8, 0, -104], [-8, 0, -104]),
		'Forearm.R': k([-16, 0, 0], [-34, 0, 0], [-18, 0, 0], [-10, 0, 0], [-10, 0, 0], [-6, 0, 0], [-6, 0, 0], [-30, 0, 0], [-10, 0, 30], [-14, 0, 40], [-6, 0, 36], [-6, 0, 36], [-6, 0, 36], [-6, 0, 36], [-6, 0, 36]),
		// последняя судорога пальцев/кисти
		'Hand.R': k([18, 0, -4], [-10, 0, 0], [10, 0, 0], [20, 0, 0], [20, 0, 0], [24, 0, 0], [24, 0, 0], [10, 0, 0], [0, 0, 0], [10, 0, 0], [0, 0, 0], [0, 0, 0], [34, 0, 0], [-4, 0, 0], [0, 0, 0]),
		// ступни: стоят → правая шаг назад → на носки → на подъём стопы (колени на земле) → лёжа
		footL: k([xL - 0.015, a.L.y, zL], [xL - 0.015, a.L.y, zL], [xL - 0.01, a.L.y, zL], [xL, a.L.y, zL], [xL, a.L.y + 0.03, zL], [xL, a.L.y - 0.01, zL - 0.02], [xL, a.L.y - 0.01, zL - 0.02], [xL, a.L.y - 0.015, zL - 0.03], [xL, a.L.y - 0.02, zL - 0.05], [xL, a.L.y - 0.02, zL - 0.05], [xL, a.L.y - 0.02, zL - 0.05], [xL, a.L.y - 0.02, zL - 0.05], [xL, a.L.y - 0.02, zL - 0.05], [xL, a.L.y - 0.02, zL - 0.05], [xL, a.L.y - 0.02, zL - 0.05]),
		footLrot: k([0, 6, 0], [0, 6, 0], [0, 6, 0], [6, 6, 0], [55, 6, 0], [168, 8, 0], [170, 8, 0], [165, 8, 0], [152, 8, 0], [150, 8, 0], [150, 8, 0], [150, 8, 0], [150, 8, 0], [150, 8, 0], [150, 8, 0]),
		footR: k([xR + 0.01, a.R.y, a.R.z - 0.07], [xR + 0.01, a.R.y + 0.03, a.R.z - 0.12], [xR, a.R.y, zR], [xR, a.R.y, zR], [xR, a.R.y + 0.03, zR], [xR, a.R.y - 0.01, zR - 0.02], [xR, a.R.y - 0.01, zR - 0.02], [xR, a.R.y - 0.015, zR - 0.03], [xR, a.R.y - 0.02, zR - 0.05], [xR, a.R.y - 0.02, zR - 0.05], [xR, a.R.y - 0.02, zR - 0.05], [xR, a.R.y - 0.02, zR - 0.05], [xR, a.R.y - 0.02, zR - 0.05], [xR, a.R.y - 0.02, zR - 0.05], [xR, a.R.y - 0.02, zR - 0.05]),
		footRrot: k([0, -14, 0], [10, -14, 0], [-6, -14, 0], [10, -14, 0], [60, -14, 0], [168, -16, 0], [170, -16, 0], [165, -16, 0], [152, -16, 0], [150, -16, 0], [150, -16, 0], [150, -16, 0], [150, -16, 0], [150, -16, 0], [150, -16, 0]),
	});
	return (t) => {
		const p = P(t);
		return { hips: p.hips, rot: p, feet: { L: { pos: p.footL, rot: p.footLrot }, R: { pos: p.footR, rot: p.footRrot } } };
	};
}

// Тяжёлый шаг топтуна: ноги широко, корпус подан вперёд, вес переваливается с ноги на ногу,
// длинные руки болтаются в такт шагам, голова кивает на каждом шаге.
function stompPose(rig, t) {
	const H = rig.hipsY, a = rig.ankle;
	const d = STOMP.d, ph = t / d;
	const c = (f, o = 0) => Math.cos(Math.PI * 2 * (ph * f - o));
	const opts = { stride: STOMP.stride, stance: STOMP.stance, lift: 0.1, heel: 10, toeOff: 26 };
	const left = gaitFoot(ph, { ...opts, x: a.L.x + 0.04, y0: a.L.y, z0: 0.04, yaw: 9 });
	const right = gaitFoot(ph - 0.5, { ...opts, x: a.R.x - 0.04, y0: a.R.y, z0: 0.04, yaw: -9 });
	const sway = c(1, 0.25); // перенос веса
	const yaw = -10 * c(1, 0.75);
	const arm = 20 * c(1, 0); // мах рук против ног
	return {
		hips: [0.05 * sway, H - 0.09 - 0.035 * c(2, 0.12), 0.03],
		rot: {
			Hips: [15, yaw, 7 * sway],
			Spine: [13 + 2 * c(2, 0.2), -0.6 * yaw, -4 * sway],
			Chest: [9 + 2 * c(2, 0.25), -0.5 * yaw, -3 * sway],
			Neck: [6, 0.3 * yaw, 0],
			Head: [8 + 5 * c(2, 0.35), 0.2 * yaw, 2 * sway],
			Jaw: [10 + 6 * Math.max(0, c(2, 0.4))],
			'UpperArm.L': [-14 - arm, 0, 12 + 3 * sway],
			'Forearm.L': [-28 - 0.5 * arm, 0, 0],
			'Hand.L': [12, 0, 5],
			'UpperArm.R': [-14 + arm, 0, -12 + 3 * sway],
			'Forearm.R': [-28 + 0.5 * arm, 0, 0],
			'Hand.R': [12, 0, -5],
		},
		feet: { L: left, R: right },
	};
}

// ---------- Рубер ----------

// Рывок: низко, корпус почти лёг вперёд, голова задрана на добычу, длинные прыжковые шаги,
// руки загребают против ног, как у гориллы; всё тело ходит волной.
function chargePose(rig, t) {
	const H = rig.hipsY, a = rig.ankle;
	const d = CHARGE.d, ph = t / d;
	const c = (f, o = 0) => Math.cos(Math.PI * 2 * (ph * f - o));
	const s = (f, o = 0) => Math.sin(Math.PI * 2 * (ph * f - o));
	const opts = { stride: CHARGE.stride, stance: CHARGE.stance, lift: 0.17, heel: 6, toeOff: 50, kick: 0.25 };
	const left = gaitFoot(ph, { ...opts, x: a.L.x + 0.03, y0: a.L.y, z0: 0.1, yaw: 6 });
	const right = gaitFoot(ph - 0.5, { ...opts, x: a.R.x - 0.03, y0: a.R.y, z0: 0.1, yaw: -6 });
	const yaw = -12 * c(1, 0.75);
	const arm = 55 * s(1, 0.1);
	return {
		hips: [0.03 * c(1, 0.2), H - 0.14 - 0.05 * c(2, 0.18), 0.05],
		rot: {
			Hips: [26, yaw, 5 * c(1, 0.2)],
			Spine: [24 + 4 * c(2, 0.25), -0.7 * yaw, 0],
			Chest: [14 + 3 * c(2, 0.3), -0.6 * yaw, 0],
			Neck: [-22, 0.3 * yaw, 0],
			Head: [-26 + 6 * c(2, 0.4), 0, -4 * c(1, 0.3)],
			Jaw: [28 + 12 * s(2, 0.1)],
			'UpperArm.L': [-45 + arm, 0, 24],
			'Forearm.L': [-40 + 0.4 * arm, 0, 0],
			'Hand.L': [30, 0, 10],
			'UpperArm.R': [-45 - arm, 0, -24],
			'Forearm.R': [-40 - 0.4 * arm, 0, 0],
			'Hand.R': [30, 0, -10],
		},
		feet: { L: left, R: right },
	};
}

// Рёв: замечает добычу — приседает, выпрямляется во весь рост, грудь вперёд, руки разведены, голова
// запрокинута, пасть настежь; потом подаётся вперёд в стойку.
function roarPose(rig) {
	const H = rig.hipsY, a = rig.ankle;
	const k = at([0, 0.25, 0.55, 1.1, 1.4, 1.7]);
	const arm = (sx) => k([-18, 0, 14 * sx], [-30, 0, 20 * sx], [-20, 0, 78 * sx], [-26, 0, 84 * sx], [-30, 0, 18 * sx], [-18, 0, 14 * sx]);
	const P = curves({
		hips: k([0, H - 0.06, 0], [0, H - 0.11, 0.03], [0, H - 0.02, -0.04], [0, H - 0.02, -0.05], [0, H - 0.08, 0.04], [0, H - 0.06, 0]),
		Hips: k([10, 0, 0], [20, 0, 0], [-6, 0, 0], [-8, 0, 0], [16, 0, 0], [10, 0, 0]),
		Spine: k([12, 0, 0], [22, 0, 0], [-14, 0, 0], [-16, 0, 0], [18, 0, 0], [12, 0, 0]),
		Chest: k([8, 0, 0], [14, 0, 0], [-12, 0, 0], [-14, 0, 0], [10, 0, 0], [8, 0, 0]),
		Neck: k([6, 0, 0], [12, 0, 0], [-16, 0, 0], [-18, 0, 0], [4, 0, 0], [6, 0, 0]),
		Head: k([14, 0, 0], [24, 0, 0], [-34, 0, 0], [-38, 6, 0], [10, 0, 0], [14, 0, 0]),
		Jaw: k([8], [14], [52], [56], [16], [8]),
		'UpperArm.L': arm(1), 'UpperArm.R': arm(-1),
		'Forearm.L': k([-30, 0, 0], [-40, 0, 0], [-50, 0, 0], [-56, 0, 0], [-34, 0, 0], [-30, 0, 0]),
		'Forearm.R': k([-30, 0, 0], [-40, 0, 0], [-50, 0, 0], [-56, 0, 0], [-34, 0, 0], [-30, 0, 0]),
		'Hand.L': k([10, 0, 0], [16, 0, 0], [-20, 0, 0], [-24, 0, 0], [10, 0, 0], [10, 0, 0]),
		'Hand.R': k([10, 0, 0], [16, 0, 0], [-20, 0, 0], [-24, 0, 0], [10, 0, 0], [10, 0, 0]),
	});
	return (t) => {
		const p = P(t);
		return { hips: p.hips, rot: p, feet: {
			L: { pos: [a.L.x + 0.06, a.L.y, a.L.z + 0.05], rot: [0, 10, 0] },
			R: { pos: [a.R.x - 0.06, a.R.y, a.R.z - 0.05], rot: [0, -10, 0] },
		} };
	};
}

// Удар: обе лапы вскидывает над головой, отклоняясь назад, → шаг левой и обрушивает их вниз всем
// корпусом (удар на 0.72 с) → выпрямляется.
function smashPose(rig) {
	const H = rig.hipsY, a = rig.ankle;
	const k = at([0, 0.35, 0.6, 0.72, 0.82, 1.05, 1.5]);
	const arm = (sx) => k([-30, 0, 16 * sx], [-160, 0, 18 * sx], [-150, 0, 12 * sx], [-62, 0, 8 * sx], [-50, 0, 10 * sx], [-56, 0, 12 * sx], [-30, 0, 16 * sx]);
	const fore = k([-30, 0, 0], [-40, 0, 0], [-30, 0, 0], [-8, 0, 0], [-6, 0, 0], [-16, 0, 0], [-30, 0, 0]);
	const B = curves({
		hips: k([0, H - 0.07, 0], [0, H - 0.03, -0.08], [0, H - 0.05, 0.05], [0, H - 0.2, 0.24], [0, H - 0.21, 0.26], [0, H - 0.16, 0.18], [0, H - 0.07, 0]),
		Hips: k([12, 0, 0], [-8, 0, 0], [0, 0, 0], [26, 0, 0], [28, 0, 0], [22, 0, 0], [12, 0, 0]),
		Spine: k([14, 0, 0], [-14, 0, 0], [-6, 0, 0], [36, 0, 0], [38, 0, 0], [26, 0, 0], [14, 0, 0]),
		Chest: k([8, 0, 0], [-10, 0, 0], [-4, 0, 0], [18, 0, 0], [20, 0, 0], [14, 0, 0], [8, 0, 0]),
		Neck: k([6, 0, 0], [-8, 0, 0], [-4, 0, 0], [-10, 0, 0], [-10, 0, 0], [0, 0, 0], [6, 0, 0]),
		Head: k([14, 0, 0], [-16, 0, 0], [-10, 0, 0], [-20, 0, 0], [-18, 0, 0], [0, 0, 0], [14, 0, 0]),
		Jaw: k([10], [40], [44], [20], [24], [16], [10]),
		'UpperArm.L': arm(1), 'UpperArm.R': arm(-1), 'Forearm.L': fore, 'Forearm.R': fore,
		'Hand.L': k([10, 0, 0], [0, 0, 0], [-10, 0, 0], [30, 0, 0], [34, 0, 0], [20, 0, 0], [10, 0, 0]),
		'Hand.R': k([10, 0, 0], [0, 0, 0], [-10, 0, 0], [30, 0, 0], [34, 0, 0], [20, 0, 0], [10, 0, 0]),
		footL: k([a.L.x + 0.06, a.L.y, a.L.z + 0.05], [a.L.x + 0.06, a.L.y + 0.04, a.L.z + 0.02], [a.L.x + 0.07, a.L.y + 0.06, a.L.z + 0.3], [a.L.x + 0.07, a.L.y, a.L.z + 0.5], [a.L.x + 0.07, a.L.y, a.L.z + 0.5], [a.L.x + 0.07, a.L.y, a.L.z + 0.45], [a.L.x + 0.06, a.L.y, a.L.z + 0.05]),
		footRrot: k([0, -10, 0], [0, -10, 0], [10, -10, 0], [28, -10, 0], [30, -10, 0], [18, -10, 0], [0, -10, 0]),
	});
	return (t) => {
		const b = B(t);
		const rise = Math.max(0, b.footRrot[0]) / 30 * 0.04;
		return { hips: b.hips, rot: b, feet: {
			L: { pos: b.footL, rot: [0, 10, 0] },
			R: { pos: [a.R.x - 0.06, a.R.y + rise, a.R.z - 0.05], rot: b.footRrot },
		} };
	};
}

/** Клипы рубера поверх обычных: рывок (Charge), рёв (Roar), удар двумя лапами (Smash). */
export function createRuberAnimations(root) {
	const rig = new Rig(root);
	return [
		bake(rig, 'Charge', CHARGE.d, (t) => chargePose(rig, t), { loop: true }),
		bake(rig, 'Roar', 1.7, roarPose(rig)),
		bake(rig, 'Smash', 1.5, smashPose(rig)),
	];
}

/** Тяжёлая походка топтуна (только для его модели в игре; у просмотрщика зомби — 5 клипов). */
export function createStompAnimation(root) {
	const rig = new Rig(root);
	return bake(rig, 'Stomp', STOMP.d, (t) => stompPose(rig, t), { loop: true });
}

/** Все 5 анимаций для скелета с корнем root (кости без поворотов в позе привязки). */
export function createZombieAnimations(root) {
	const rig = new Rig(root);
	return [
		bake(rig, 'Idle', 4.0, (t) => idlePose(rig, t), { loop: true }),
		bake(rig, 'Walk', WALK.d, (t) => walkPose(rig, t), { loop: true }),
		bake(rig, 'Run', RUN.d, (t) => runPose(rig, t), { loop: true }),
		bake(rig, 'Attack', 1.7, attackPose(rig)),
		bake(rig, 'Death', 2.8, deathPose(rig)),
	];
}
