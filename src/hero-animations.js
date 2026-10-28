// Анимации героя на полном скелете (56 костей, см. scripts/makehuman/rigs.mjs).
// Позы задаются не углами суставов, а положением тела в пространстве:
//   • таз, корпус (распределяется по трём позвонкам), взгляд (шея + голова);
//   • ступни — точкой и поворотом (IK ног, носок остаётся на земле при отрыве пятки);
//   • кисти — положением оружия (центр кулака, направление топорища/рукояти и лезвия/ствола)
//     или точкой и поворотом кисти; левая кисть может «прилипать» к правой;
//   • ключица поднимается сама при подъёме руки, скручивание кисти делится с предплечьем;
//   • пальцы — позой кисти: сгиб, большой палец, указательный (палец на спуске).
// Всё запекается в ключевые кадры 30 к/с.

import * as THREE from 'three';
import { at, curves, frame, eulerQ, gaitFoot } from './animations.js';

const FPS = 30;
const D2R = THREE.MathUtils.degToRad;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const I = new THREE.Quaternion();
const SIDE = { L: 'Left', R: 'Right' };
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
const FINGER_MAX = [80, 95, 70]; // градусы сгиба фаланг при сжатом кулаке
const THUMB_MAX = [28, 34, 38];

export const HERO_ANIMATION_NAMES = [
	'Idle', 'Walk', 'Run', 'Melee', 'Hit', 'EquipPistol',
	'IdlePistol', 'WalkPistol', 'RunPistol', 'Shoot', 'Reload', 'HitPistol', 'EquipAxe',
	'Death',
];

// ---------- Риг ----------

class HeroRig {
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
		const W = (n) => this.world[n];
		this.hipsY = W('Hips').y;
		this.ankle = { L: W('LeftFoot').clone(), R: W('RightFoot').clone() };
		this.shoulder = { L: W('LeftArm').clone(), R: W('RightArm').clone() };
		// крепления оружия на теле (позиция кулака и направление топорища/рукояти в позе привязки)
		this.mounts = {};
		for (const [key, name] of [['axe', 'AxeMount'], ['pistol', 'HolsterMount']]) {
			const m = root.getObjectByName(name);
			if (!m) continue;
			const pos = m.position.clone().add(this.world[m.parent.name]);
			const handle = V(0, 0, 1).applyQuaternion(m.quaternion), blade = V(0, -1, 0).applyQuaternion(m.quaternion);
			this.mounts[key] = { pos: pos.toArray(), handle: handle.toArray(), blade: blade.toArray() };
		}
		this.grip = {};
		this.hand = {};
		this.fingerAxes = {};
		for (const s of ['L', 'R']) {
			const S = SIDE[s];
			const g = root.getObjectByName(`Grip${s}`);
			this.grip[s] = { pos: g.position.clone(), q: g.quaternion.clone() };
			// оси кисти в позе привязки: F — к пальцам, T — к большому пальцу, P — ладонь
			const wrist = W(`${S}Hand`), mid = W(`${S}HandMiddle1`), idx = W(`${S}HandIndex1`), pinky = W(`${S}HandPinky1`), thumb = W(`${S}HandThumb1`);
			const F = mid.clone().sub(wrist).normalize();
			const T = idx.clone().sub(pinky);
			T.addScaledVector(F, -T.dot(F)).normalize();
			const P = new THREE.Vector3().crossVectors(F, T);
			if (thumb.clone().sub(idx.clone().add(pinky).multiplyScalar(0.5)).dot(P) < 0) P.negate();
			this.hand[s] = { F, T, P };
			// ось сгиба каждой фаланги: (направление фаланги × ладонь) — кончик идёт к ладони
			this.fingerAxes[s] = {};
			for (const f of FINGERS) {
				this.fingerAxes[s][f] = [1, 2, 3].map((k) => {
					const child = this.bones[`${S}Hand${f}${k + 1}`];
					const dir = (child ? child.offset : this.bones[`${S}Hand${f}${k}`].offset).clone().normalize();
					return new THREE.Vector3().crossVectors(dir, P).normalize();
				});
			}
		}
	}
}

// ---------- Решатель позы ----------

const slerpI = (q, t) => I.clone().slerp(q, t);

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

function gripQuat({ handle, blade }) {
	const Z = V(...handle).normalize();
	const B = V(...blade);
	const Y = B.addScaledVector(Z, -B.dot(Z)).normalize().negate();
	const X = new THREE.Vector3().crossVectors(Y, Z);
	return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

/** Мировая цель кисти: { pos, q } для кости Hand по описанию руки. */
function handTarget(rig, s, spec, other) {
	let pos, q;
	if (spec.grip) {
		const gq = gripQuat(spec.grip);
		q = gq.clone().multiply(rig.grip[s].q.clone().invert());
		pos = V(...spec.grip.pos).sub(rig.grip[s].pos.clone().applyQuaternion(q));
	} else {
		q = eulerQ(spec.rot ?? [0, 0, 0], 'YXZ');
		pos = V(...spec.pos);
	}
	// прилипание к другой кисти (поддерживающая рука на пистолете)
	if (spec.attach && other) {
		const w = spec.attach.weight ?? 1;
		const tq = other.q.clone().multiply(eulerQ(spec.attach.rot ?? [0, 0, 0]));
		const tp = V(...(spec.attach.offset ?? [0, 0, 0])).applyQuaternion(other.q).add(other.pos);
		pos.lerp(tp, w);
		q.slerp(tq, w);
	}
	return { pos, q };
}

function solveArm(rig, local, hipsPos, s, target, hintChest) {
	const S = SIDE[s], sx = s === 'L' ? 1 : -1;
	const chest = chainWorld(rig, local, hipsPos, 'Spine2');
	const B = (n) => rig.bones[`${S}${n}`];
	// ключица: поднимается, когда рука выше плеча, и чуть выдвигается вперёд при выпаде руки
	const restShoulder = B('Shoulder').offset.clone().add(B('Arm').offset).applyQuaternion(chest.q).add(chest.pos);
	const dirC = target.pos.clone().sub(restShoulder).normalize().applyQuaternion(chest.q.clone().invert());
	const elev = Math.acos(THREE.MathUtils.clamp(-dirC.y, -1, 1)) * 180 / Math.PI;
	const up = THREE.MathUtils.smoothstep(elev, 75, 165) * 24;
	const fwd = THREE.MathUtils.clamp(dirC.z, 0, 1) * 10;
	local[`${S}Shoulder`] = eulerQ([0, -sx * fwd, sx * up]);
	const sh = chainWorld(rig, local, hipsPos, `${S}Shoulder`);
	const Sp = B('Arm').offset.clone().applyQuaternion(sh.q).add(sh.pos);
	// двухзвенный IK: плечо → локоть → запястье
	const lowerRest = B('ForeArmTwist').offset.clone().add(B('Hand').offset);
	const L1 = B('ForeArm').offset.length(), L2 = lowerRest.length();
	const toT = target.pos.clone().sub(Sp);
	const d = THREE.MathUtils.clamp(toT.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
	const dir = toT.normalize();
	const hint = V(...(hintChest ?? [sx * 0.6, -1, -0.35])).applyQuaternion(chest.q);
	const perp = hint.clone().addScaledVector(dir, -hint.dot(dir));
	if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0).addScaledVector(dir, dir.y);
	perp.normalize();
	const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
	const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
	const E = Sp.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA);
	const Wp = Sp.clone().addScaledVector(dir, d);
	const qU = frame(E.clone().sub(Sp), perp).multiply(frame(B('ForeArm').offset, V(0, 0, 1)).invert());
	const qL = frame(Wp.clone().sub(E), perp).multiply(frame(lowerRest, V(0, 0, 1)).invert());
	local[`${S}Arm`] = sh.q.clone().invert().multiply(qU);
	local[`${S}ForeArm`] = qU.clone().invert().multiply(qL);
	// кисть: скручивание вокруг оси предплечья наполовину отдаём кости скручивания
	const rel = qL.clone().invert().multiply(target.q);
	const axis = lowerRest.clone().normalize();
	const proj = axis.clone().multiplyScalar(axis.dot(V(rel.x, rel.y, rel.z)));
	const twist = new THREE.Quaternion(proj.x, proj.y, proj.z, rel.w);
	if (twist.lengthSq() < 1e-9) twist.identity(); else twist.normalize();
	const tw = slerpI(twist, 0.55);
	local[`${S}ForeArmTwist`] = tw;
	local[`${S}Hand`] = tw.clone().invert().multiply(rel);
}

function solveFingers(rig, local, s, { curl = 0.3, thumb = curl, index = curl, spread = 0 } = {}) {
	const S = SIDE[s];
	for (const f of FINGERS) {
		const amount = f === 'Thumb' ? thumb : f === 'Index' ? index : curl;
		const max = f === 'Thumb' ? THUMB_MAX : FINGER_MAX;
		for (let k = 0; k < 3; k++) {
			local[`${S}Hand${f}${k + 1}`] = new THREE.Quaternion().setFromAxisAngle(rig.fingerAxes[s][f][k], D2R(max[k] * amount));
		}
	}
	if (spread) {
		// небольшое разведение пальцев вокруг оси ладони
		const P = rig.hand[s].P;
		[-1.5, -0.5, 0.5, 1.5].forEach((k, i) => {
			const n = `${S}Hand${FINGERS[i + 1]}1`;
			local[n] = new THREE.Quaternion().setFromAxisAngle(P, D2R(spread * k * 6)).multiply(local[n]);
		});
	}
}

/**
 * pose = { hips, pelvis, torso, look, jaw,
 *          feet: { L: { pos, rot }, R }, hands: { R: {...}, L: {...} }, fingers: { R: {...}, L: {...} } }
 */
function solveHero(rig, pose) {
	const local = {};
	for (const n of rig.names) if (n !== 'Root') local[n] = new THREE.Quaternion();
	local.Hips = eulerQ(pose.pelvis ?? [0, 0, 0], 'YXZ');
	const torso = eulerQ(pose.torso ?? [0, 0, 0], 'YXZ');
	local.Spine = slerpI(torso, 0.34);
	local.Spine1 = slerpI(torso, 0.33);
	local.Spine2 = slerpI(torso, 0.33);
	const look = eulerQ(pose.look ?? [0, 0, 0], 'YXZ');
	local.Neck = slerpI(look, 0.4);
	local.Head = slerpI(look, 0.6);
	local.Jaw = eulerQ([pose.jaw ?? 2, 0, 0]);
	const hipsPos = V(...pose.hips);

	// ноги
	for (const s of ['L', 'R']) {
		const S = SIDE[s];
		const up = rig.bones[`${S}UpLeg`], lo = rig.bones[`${S}Leg`], ft = rig.bones[`${S}Foot`];
		const L1 = lo.offset.length(), L2 = ft.offset.length();
		const H = up.offset.clone().applyQuaternion(local.Hips).add(hipsPos);
		const foot = pose.feet[s];
		const footQ = eulerQ(foot.rot ?? [0, 0, 0], 'YXZ');
		const toA = V(...foot.pos).sub(H);
		const d = THREE.MathUtils.clamp(toA.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
		const dir = toA.normalize();
		const hint = V(0, 0, 1).applyQuaternion(local.Hips).addScaledVector(V(0, 0, 1).applyQuaternion(footQ), 0.4);
		const perp = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
		const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
		const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
		const K = H.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA);
		const A = H.clone().addScaledVector(dir, d);
		const qU = frame(K.clone().sub(H), perp).multiply(frame(lo.offset, V(0, 0, 1)).invert());
		const qL = frame(A.clone().sub(K), perp).multiply(frame(ft.offset, V(0, 0, 1)).invert());
		local[`${S}UpLeg`] = local.Hips.clone().invert().multiply(qU);
		local[`${S}Leg`] = qU.clone().invert().multiply(qL);
		local[`${S}Foot`] = qL.clone().invert().multiply(footQ);
		// носок остаётся на земле, когда пятка отрывается
		const pitch = foot.rot?.[0] ?? 0;
		local[`${S}ToeBase`] = eulerQ([-Math.max(0, Math.min(pitch, 60)) + (foot.toe ?? 0), 0, 0]);
	}

	// руки: сначала правая, левая может держаться за неё
	let rightHand = null;
	for (const s of ['R', 'L']) {
		const spec = pose.hands?.[s];
		if (!spec) continue;
		const target = handTarget(rig, s, spec, rightHand);
		solveArm(rig, local, hipsPos, s, target, spec.hint);
		if (s === 'R') rightHand = target;
		solveFingers(rig, local, s, pose.fingers?.[s]);
	}
	for (const s of ['L', 'R']) if (!pose.hands?.[s]) solveFingers(rig, local, s, pose.fingers?.[s]);
	return { local, hips: hipsPos };
}

function bake(rig, name, duration, poseAt, { loop = false } = {}) {
	const frames = Math.max(2, Math.round(duration * FPS));
	const times = [];
	const quats = Object.fromEntries(rig.names.filter((n) => n !== 'Root').map((n) => [n, []]));
	const hips = [];
	const prev = {};
	for (let f = 0; f <= frames; f++) {
		const t = (f / frames) * duration;
		const { local, hips: hp } = solveHero(rig, poseAt(loop && f === frames ? 0 : t));
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

// ---------- Общие куски поз ----------

const add = (p, d) => [p.x + d[0], p.y + d[1], p.z + d[2]];
const HAND_GRIP = { curl: 0.95, thumb: 0.85, index: 0.95 };
const HAND_PISTOL = { curl: 0.95, thumb: 0.8, index: 0.42 };
const HAND_SUPPORT = { curl: 0.85, thumb: 0.6, index: 0.75 };
const HAND_RELAXED = { curl: 0.32, thumb: 0.25, index: 0.25, spread: 0.3 };

function stance(rig, wide = 1) {
	const a = rig.ankle;
	return {
		L: { pos: [a.L.x + 0.04 * wide, a.L.y, a.L.z + 0.08 * wide], rot: [0, -8, 0] },
		R: { pos: [a.R.x - 0.05 * wide, a.R.y, a.R.z - 0.06 * wide], rot: [0, 18, 0] },
	};
}

function pistolStance(rig) {
	const a = rig.ankle;
	return {
		L: { pos: [a.L.x + 0.05, a.L.y, a.L.z + 0.13], rot: [0, -12, 0] },
		R: { pos: [a.R.x - 0.06, a.R.y, a.R.z - 0.11], rot: [0, 26, 0] },
	};
}

// топор в опущенной руке: голова топора вперёд-вниз, лезвие вниз
const axeCarry = (rig, d = [0, 0, 0]) => ({ pos: add(rig.shoulder.R, [-0.04 + d[0], -0.54 + d[1], 0.13 + d[2]]), handle: [0, -0.45, 1], blade: [0, -1, -0.45] });
// пистолет у груди стволом вперёд-вниз (низкая готовность)
const pistolReady = (d = [0, 0, 0], tilt = 0) => ({ pos: [-0.07 + d[0], 1.12 + d[1], 0.36 + d[2]], handle: [0, 0.84, 0.55 - tilt], blade: [0, -0.55 + tilt, 0.84] });
// поддерживающая рука обхватывает правую снизу-слева
const SUPPORT = { offset: [0.035, 0.015, -0.065], rot: [0, 0, 0] };
const freeHandL = (rig, d = [0, 0, 0], rot = [8, 0, 6]) => ({ pos: add(rig.shoulder.L, [0.06 + d[0], -0.55 + d[1], 0.04 + d[2]]), rot, hint: [0.5, -1, -0.4] });

// ---------- Клипы ----------

function idleAxe(rig) {
	const H = rig.hipsY, d = 3;
	return (t) => {
		const w = (f, ph = 0) => Math.sin((t / d) * Math.PI * 2 * f + ph);
		return {
			hips: [0.012 * w(1), H - 0.025 + 0.004 * w(2, 1), 0],
			pelvis: [3, -6 + 2 * w(1, 0.4), -1.5 * w(1)],
			torso: [4 + 1.2 * w(2, 0.5), 7, 0],
			look: [2 + 2 * w(1, 2), -2 + 7 * w(1, 2.2), 0],
			feet: stance(rig),
			hands: {
				R: { grip: axeCarry(rig, [0, 0.004 * w(2, 0.8), 0]), hint: [-0.3, -1, -0.5] },
				L: freeHandL(rig, [0, 0.004 * w(2, 1.2), 0.01 * w(1, 0.5)]),
			},
			fingers: { R: HAND_GRIP, L: HAND_RELAXED },
		};
	};
}

function gait(rig, t, { run, pistol }) {
	const H = rig.hipsY, a = rig.ankle;
	const d = run ? (pistol ? 0.72 : 0.7) : 1.1, ph = t / d;
	const c = (f, o = 0) => Math.cos(Math.PI * 2 * (ph * f - o));
	const opts = run
		? { stride: pistol ? 1.0 : 1.1, stance: 0.38, lift: 0.15, heel: 10, toeOff: 40, kick: 0.16 }
		: { stride: pistol ? 0.55 : 0.62, stance: 0.6, lift: 0.07, heel: 14, toeOff: 28 };
	const feet = {
		L: gaitFoot(ph, { ...opts, x: a.L.x, y0: a.L.y, z0: run ? 0.05 : 0.02, yaw: -3 }),
		R: gaitFoot(ph - 0.5, { ...opts, x: a.R.x, y0: a.R.y, z0: run ? 0.05 : 0.02, yaw: 3 }),
	};
	const bob = (run ? 0.03 : 0.015) * c(2, run ? 0.19 : 0.05);
	const yaw = (pistol ? 0.4 : 1) * (run ? -10 : -6) * c(1, 0.75);
	const sw = -c(1, 0); // мах левой руки: вперёд, когда правая нога впереди
	const base = {
		hips: [0.02 * c(1, 0.25), H - (run ? 0.07 : 0.025) - bob, 0],
		pelvis: [run ? 9 : 3, yaw + (pistol ? -10 : 0), 3 * c(1, 0.25)],
		torso: [run ? 9 : 3, -0.75 * yaw + (pistol ? 8 : 0), 0],
		look: [run ? -8 : 0, -0.3 * yaw + (pistol ? 2 : 0), 0],
		feet,
	};
	if (pistol) {
		const p = run ? { pos: [-0.06, 1.18, 0.27], handle: [0, 0.95, 0.3], blade: [0, -0.3, 0.95] } : pistolReady();
		p.pos = [p.pos[0], p.pos[1] - bob * 0.6, p.pos[2]];
		return {
			...base,
			hands: { R: { grip: p, hint: [-0.6, -1, -0.3] }, L: { pos: [0, 0, 0], attach: SUPPORT, hint: [0.6, -1, -0.3] } },
			fingers: { R: HAND_PISTOL, L: HAND_SUPPORT },
		};
	}
	// с топором: левая рука свободно машет, правая несёт топор
	const L = run
		? { pos: add(rig.shoulder.L, [0.02, -0.33 + 0.06 * Math.max(0, sw), 0.05 + 0.24 * sw]), rot: [-65 - 25 * sw, 0, 10], hint: [0.4, -1, -0.6] }
		: { pos: add(rig.shoulder.L, [0.06, -0.55 + 0.035 * Math.max(0, sw), 0.04 + 0.2 * sw]), rot: [8 - 22 * sw, 0, 6], hint: [0.5, -1, -0.4] };
	const R = run
		? { grip: { pos: add(rig.shoulder.R, [-0.02, -0.36 + 0.05 * Math.max(0, -sw), 0.14 - 0.14 * sw]), handle: [0, 0.75, 0.66], blade: [0, -0.66, 0.75] }, hint: [-0.4, -1, -0.5] }
		: { grip: axeCarry(rig, [0, 0.02 * Math.max(0, -sw), -0.08 * sw]), hint: [-0.3, -1, -0.5] };
	return { ...base, hands: { R, L }, fingers: { R: HAND_GRIP, L: run ? { curl: 0.6, thumb: 0.5 } : HAND_RELAXED } };
}

// Удар топором сверху: замах над правым плечом → лезвие вперёд-вниз (попадание 0.34 с) → доводка → возврат
function meleeAxe(rig) {
	const H = rig.hipsY, a = rig.ankle;
	const k = at([0, 0.2, 0.28, 0.34, 0.46, 0.75]);
	const carry = axeCarry(rig);
	const P = curves({
		hips: k([0, H - 0.025, 0], [0, H - 0.035, -0.05], [0, H - 0.05, 0.0], [0, H - 0.08, 0.12], [0, H - 0.085, 0.13], [0, H - 0.025, 0]),
		pelvis: k([3, -6, 0], [-3, -20, 2], [2, -8, 0], [11, 14, -2], [13, 17, -3], [3, -6, 0]),
		torso: k([4, 7, 0], [-10, -28, 0], [4, -8, 0], [26, 22, 0], [30, 26, 0], [4, 7, 0]),
		look: k([2, -2, 0], [6, 30, 0], [2, 12, 0], [10, -22, 0], [14, -24, 0], [2, -2, 0]),
		gripPos: k(carry.pos, add(rig.shoulder.R, [-0.1, 0.27, -0.14]), add(rig.shoulder.R, [-0.03, 0.42, 0.2]), [-0.08, 1.24, 0.8], [0.04, 0.8, 0.62], carry.pos),
		gripHandle: k(carry.handle, [0.1, -0.25, -1], [0.05, 0.8, -0.6], [0.1, -0.12, 1], [0.35, -0.8, 0.5], carry.handle),
		gripBlade: k(carry.blade, [0, 1, -0.25], [0, 0.65, 0.75], [0, -1, 0.1], [0, -0.55, -0.8], carry.blade),
		gripHint: k([-0.3, -1, -0.5], [-1, 0.25, -0.3], [-0.9, 0.5, 0], [-0.6, -1, 0], [-0.4, -1, 0.2], [-0.3, -1, -0.5]),
		// левая рука: на замахе вытянута к цели, в ударе прижимается к груди
		lPos: k(freeHandL(rig).pos, [0.16, 1.4, 0.42], [0.15, 1.36, 0.4], [0.1, 1.22, 0.24], [0.12, 1.12, 0.24], freeHandL(rig).pos),
		lRot: k([8, 0, 6], [-85, 0, 10], [-80, 0, 10], [-70, -40, 0], [-60, -30, 0], [8, 0, 6]),
		footL: k(stance(rig).L.pos, add(rig.ankle.L, [0.04, 0, 0.06]), add(rig.ankle.L, [0.05, 0.04, 0.16]), add(rig.ankle.L, [0.05, 0, 0.3]), add(rig.ankle.L, [0.05, 0, 0.3]), stance(rig).L.pos),
		footRp: k([0], [0], [6], [22], [20], [0]),
	});
	return (t) => {
		const p = P(t);
		const st = stance(rig);
		return {
			hips: p.hips, pelvis: p.pelvis, torso: p.torso, look: p.look,
			feet: {
				L: { pos: p.footL, rot: [0, -8, 0] },
				R: { pos: [st.R.pos[0], st.R.pos[1] + Math.max(0, p.footRp[0]) / 22 * 0.03, st.R.pos[2]], rot: [p.footRp[0], 18, 0] },
			},
			hands: {
				R: { grip: { pos: p.gripPos, handle: p.gripHandle, blade: p.gripBlade }, hint: p.gripHint },
				L: { pos: p.lPos, rot: p.lRot, hint: [0.6, -1, -0.2] },
			},
			fingers: { R: HAND_GRIP, L: { curl: 0.45, thumb: 0.35 } },
		};
	};
}

function idlePistol(rig) {
	const H = rig.hipsY, d = 3;
	return (t) => {
		const w = (f, ph = 0) => Math.sin((t / d) * Math.PI * 2 * f + ph);
		return {
			hips: [0.008 * w(1), H - 0.035 + 0.004 * w(2, 1), 0],
			pelvis: [2, -12 + 1.5 * w(1, 0.4), -1 * w(1)],
			torso: [5 + w(2, 0.5), 8, 0],
			look: [4 + w(1, 2), 4 + 5 * w(1, 2.2), 0],
			feet: pistolStance(rig),
			hands: {
				R: { grip: pistolReady([0, 0.004 * w(2, 0.8), 0]), hint: [-0.6, -1, -0.3] },
				L: { pos: [0, 0, 0], attach: SUPPORT, hint: [0.6, -1, -0.3] },
			},
			fingers: { R: HAND_PISTOL, L: HAND_SUPPORT },
		};
	};
}

// Выстрел: пистолет на уровне глаз двумя руками, отдача подбрасывает ствол; палец жмёт спуск
function shootPistol(rig) {
	const H = rig.hipsY;
	const k = at([0, 0.03, 0.06, 0.15, 0.4]);
	const P = curves({
		pos: k([-0.05, 1.5, 0.55], [-0.05, 1.5, 0.55], [-0.05, 1.54, 0.5], [-0.05, 1.51, 0.54], [-0.05, 1.5, 0.55]),
		handle: k([0, 1, 0.06], [0, 1, 0.06], [0, 0.95, -0.3], [0, 1, 0.02], [0, 1, 0.06]),
		blade: k([0, 0, 1], [0, 0, 1], [0, 0.3, 0.95], [0, 0.03, 1], [0, 0, 1]),
		trigger: k([0.45], [0.75], [0.6], [0.45], [0.45]),
		torso: k([2, 8, 0], [2, 8, 0], [-3, 8, 0], [1, 8, 0], [2, 8, 0]),
	});
	return (t) => {
		const p = P(t);
		return {
			hips: [0, H - 0.035, -0.01 * Math.max(0, p.torso[0] < 0 ? 1 : 0)],
			pelvis: [1, -12, 0], torso: p.torso, look: [4, 4, 0],
			feet: pistolStance(rig),
			hands: {
				R: { grip: { pos: p.pos, handle: p.handle, blade: p.blade }, hint: [-0.7, -1, -0.2] },
				L: { pos: [0, 0, 0], attach: SUPPORT, hint: [0.6, -1, -0.3] },
			},
			fingers: { R: { ...HAND_PISTOL, index: p.trigger[0] }, L: HAND_SUPPORT },
		};
	};
}

// Перезарядка: пистолет к себе, левая рука — за магазином в подсумок на груди, вставляет, досылает
function reloadPistol(rig) {
	const H = rig.hipsY;
	const k = at([0, 0.18, 0.4, 0.62, 0.82, 1.0, 1.15, 1.4]);
	const ready = pistolReady();
	const close = pistolReady([0.03, 0.06, -0.08], 0.35);
	const P = curves({
		pos: k(ready.pos, close.pos, close.pos, close.pos, close.pos, close.pos, ready.pos, ready.pos),
		handle: k(ready.handle, close.handle, close.handle, close.handle, close.handle, close.handle, ready.handle, ready.handle),
		blade: k(ready.blade, close.blade, close.blade, close.blade, close.blade, close.blade, ready.blade, ready.blade),
		lPos: k([0.1, 1.1, 0.3], [0.04, 1.08, 0.24], [0.09, 1.16, 0.2], [0.09, 1.16, 0.2], [0.03, 1.06, 0.24], [0.0, 1.22, 0.26], [0.06, 1.12, 0.3], [0.1, 1.1, 0.3]),
		lRot: k([-60, 0, 0], [-40, -20, 0], [-20, -10, 0], [-20, -10, 0], [-40, -20, 0], [-80, -30, 0], [-60, 0, 0], [-60, 0, 0]),
		attach: k([1], [0], [0], [0], [0], [0], [0.6], [1]),
		lCurl: k([0.85], [0.6], [0.35], [0.8], [0.8], [0.7], [0.8], [0.85]),
		look: k([4, 4, 0], [16, 10, 0], [18, 14, 0], [16, 14, 0], [18, 8, 0], [14, 6, 0], [6, 4, 0], [4, 4, 0]),
	});
	return (t) => {
		const p = P(t);
		return {
			hips: [0, H - 0.035, 0], pelvis: [2, -12, 0], torso: [7, 8, 0], look: p.look,
			feet: pistolStance(rig),
			hands: {
				R: { grip: { pos: p.pos, handle: p.handle, blade: p.blade }, hint: [-0.6, -1, -0.3] },
				L: { pos: p.lPos, rot: p.lRot, attach: { ...SUPPORT, weight: p.attach[0] }, hint: [0.6, -1, -0.2] },
			},
			fingers: { R: { ...HAND_PISTOL, index: 0.25 }, L: { curl: p.lCurl[0], thumb: p.lCurl[0] * 0.7 } },
		};
	};
}

// Получение урона: вздрагивает, корпус и голова откидываются, оружие поджимается к себе
function hit(rig, pistol) {
	const H = rig.hipsY;
	const k = at([0, 0.08, 0.2, 0.4]);
	const P = curves({
		hips: k([0, H - 0.03, 0], [0, H - 0.05, -0.05], [0, H - 0.045, -0.04], [0, H - 0.03, 0]),
		torso: k([4, 7, 0], [-9, 14, 4], [1, 10, 0], [4, 7, 0]),
		look: k([2, -2, 0], [-14, 14, 6], [-3, 2, 0], [2, -2, 0]),
		f: k([0], [1], [0.4], [0]),
	});
	return (t) => {
		const p = P(t), f = p.f[0];
		const st = pistol ? pistolStance(rig) : stance(rig);
		st.R = { ...st.R, pos: [st.R.pos[0], st.R.pos[1], st.R.pos[2] - 0.06 * f] };
		const hands = pistol
			? { R: { grip: pistolReady([0.02 * f, 0.05 * f, -0.08 * f], 0.3 * f), hint: [-0.6, -1, -0.3] }, L: { pos: [0, 0, 0], attach: SUPPORT, hint: [0.6, -1, -0.3] } }
			: { R: { grip: axeCarry(rig, [0.02 * f, 0.1 * f, -0.04 * f]), hint: [-0.3, -1, -0.5] }, L: freeHandL(rig, [-0.04 * f, 0.22 * f, 0.12 * f], [8 - 50 * f, 0, 6]) };
		return {
			hips: p.hips, pelvis: [3 - 6 * f, pistol ? -12 : -6, 3 * f], torso: p.torso, look: p.look, feet: st, hands,
			fingers: pistol ? { R: HAND_PISTOL, L: HAND_SUPPORT } : { R: HAND_GRIP, L: { curl: 0.3 + 0.4 * f } },
		};
	};
}

// Смена оружия. Топор вешается в чехол на левом бедре (рука тянется поперёк тела),
// пистолет — в кобуру на правом бедре. Тайминги перевешивания — EQUIP_TIMES (их же использует игра).
export const EQUIP_TIMES = { EquipPistol: { stow: 0.36, draw: 0.58 }, EquipAxe: { stow: 0.26, draw: 0.5 } };

function equip(rig, toPistol) {
	const H = rig.hipsY;
	const carry = axeCarry(rig), ready = pistolReady();
	const axeM = rig.mounts.axe, holM = rig.mounts.pistol;
	// чуть отводим кулак от крепления, чтобы рука подходила к нему, а не проходила сквозь
	const near = (m, d) => ({ ...m, pos: m.pos.map((v, i) => v + d[i]) });
	const seq = toPistol
		? { T: [0, 0.3, 0.38, 0.52, 0.6, 0.85], g: [carry, near(axeM, [0, 0.04, 0.04]), axeM, near(holM, [0, 0.04, 0.03]), holM, ready] }
		: { T: [0, 0.2, 0.28, 0.44, 0.52, 0.85], g: [ready, near(holM, [0, 0.04, 0.03]), holM, near(axeM, [0, 0.04, 0.04]), axeM, carry] };
	const k = at(seq.T);
	const crossIdx = toPistol ? [1, 2] : [3, 4]; // кадры, где рука у левого бедра
	const holsIdx = toPistol ? [3, 4] : [1, 2];
	const pick = (fn) => seq.g.map((g, i) => fn(g, i));
	const P = curves({
		pos: k(...pick((g) => g.pos)),
		handle: k(...pick((g) => g.handle)),
		blade: k(...pick((g) => g.blade)),
		hint: k(...pick((g, i) => (crossIdx.includes(i) ? [-1, -0.2, 0.3] : holsIdx.includes(i) ? [-0.8, -0.3, -0.6] : g === ready ? [-0.6, -1, -0.3] : [-0.3, -1, -0.5]))),
		torso: k(...pick((g, i) => (crossIdx.includes(i) ? [16, 24, 0] : holsIdx.includes(i) ? [8, -8, 0] : g === ready ? [5, 8, 0] : [4, 7, 0]))),
		look: k(...pick((g, i) => (crossIdx.includes(i) ? [22, 18, 0] : holsIdx.includes(i) ? [16, -10, 0] : [3, 2, 0]))),
		support: k(...pick((g) => [g === ready ? 1 : 0])),
		curl: k(...pick((g, i) => [i === 1 || i === 3 ? 0.35 : 0.95])),
	});
	return (t) => {
		const p = P(t);
		return {
			hips: [0, H - 0.03 - 0.03 * Math.max(0, p.torso[0] - 8) / 8, 0],
			pelvis: [3, -6 + p.torso[1] * 0.3, 0], torso: p.torso, look: p.look,
			feet: toPistol && t > 0.6 ? pistolStance(rig) : stance(rig),
			hands: {
				R: { grip: { pos: p.pos, handle: p.handle, blade: p.blade }, hint: p.hint },
				L: { ...freeHandL(rig), attach: { ...SUPPORT, weight: p.support[0] } },
			},
			fingers: { R: { curl: p.curl[0], thumb: p.curl[0] * 0.85, index: Math.min(p.curl[0], 0.9) }, L: p.support[0] > 0.5 ? HAND_SUPPORT : HAND_RELAXED },
		};
	};
}

// Смерть: колени подгибаются, садится и падает на спину, руки раскинуты (оружие игра роняет на 0.55 с)
function death(rig) {
	const H = rig.hipsY, a = rig.ankle;
	const k = at([0, 0.15, 0.45, 0.75, 1.05, 1.2, 1.35, 2.2]);
	const P = curves({
		hips: k([0, H - 0.03, 0], [0, H - 0.06, -0.03], [0.01, H - 0.32, -0.12], [0.02, 0.22, -0.28], [0.02, 0.14, -0.42], [0.02, 0.17, -0.43], [0.02, 0.125, -0.44], [0.02, 0.125, -0.44]),
		pelvis: k([3, -6, 0], [-4, -6, 3], [6, -6, 4], [-25, -4, 4], [-80, -2, 4], [-76, -2, 4], [-84, -2, 4], [-84, -2, 4]),
		torso: k([4, 7, 0], [-16, 10, 0], [26, 6, 0], [28, 6, 0], [2, 2, 0], [10, 2, 0], [-2, 0, 0], [-2, 0, 0]),
		look: k([2, -2, 0], [-30, 6, 4], [40, 4, 6], [40, 14, 6], [10, 30, 4], [22, 34, 4], [-6, 50, 4], [-6, 50, 4]),
		rPos: k(axeCarry(rig).pos, [-0.32, 1.25, 0.1], [-0.3, 0.75, 0.3], [-0.42, 0.45, 0.0], [-0.62, 0.12, -0.6], [-0.64, 0.16, -0.62], [-0.66, 0.06, -0.6], [-0.66, 0.06, -0.6]),
		lPos: k(freeHandL(rig).pos, [0.34, 1.2, 0.08], [0.3, 0.72, 0.3], [0.42, 0.45, 0.0], [0.6, 0.12, -0.62], [0.62, 0.16, -0.64], [0.64, 0.06, -0.62], [0.64, 0.06, -0.62]),
		hRot: k([8, 0, 6], [-40, 0, 20], [-20, 0, 0], [-40, 0, 0], [-100, 0, 0], [-95, 0, 0], [-100, 0, 0], [-100, 0, 0]),
		footL: k(stance(rig).L.pos, stance(rig).L.pos, add(a.L, [0.05, 0, 0.1]), add(a.L, [0.06, 0, 0.18]), add(a.L, [0.08, 0.02, 0.38]), add(a.L, [0.08, 0.03, 0.4]), add(a.L, [0.08, 0.02, 0.41]), add(a.L, [0.08, 0.02, 0.41])),
		footR: k(stance(rig).R.pos, stance(rig).R.pos, add(a.R, [-0.06, 0, -0.02]), add(a.R, [-0.08, 0, 0.1]), add(a.R, [-0.1, 0.02, 0.34]), add(a.R, [-0.1, 0.03, 0.36]), add(a.R, [-0.1, 0.02, 0.37]), add(a.R, [-0.1, 0.02, 0.37])),
		footPitch: k([0], [0], [-10], [-30], [-75], [-70], [-80], [-80]),
		curl: k([0.95], [0.6], [0.3], [0.2], [0.15], [0.2], [0.15], [0.15]),
	});
	return (t) => {
		const p = P(t);
		return {
			hips: p.hips, pelvis: p.pelvis, torso: p.torso, look: p.look, jaw: 14,
			feet: { L: { pos: p.footL, rot: [p.footPitch[0], -14, 0] }, R: { pos: p.footR, rot: [p.footPitch[0], 22, 0] } },
			hands: {
				R: { pos: p.rPos, rot: [p.hRot[0], 0, -p.hRot[2]], hint: [-1, 0.3, -0.5] },
				L: { pos: p.lPos, rot: [p.hRot[0], 0, p.hRot[2]], hint: [1, 0.3, -0.5] },
			},
			fingers: { R: { curl: p.curl[0], thumb: p.curl[0] * 0.8 }, L: { curl: Math.min(0.4, p.curl[0]), thumb: 0.2 } },
		};
	};
}

/** Все анимации героя для скелета с корнем root. */
export function createHeroAnimations(root) {
	const rig = new HeroRig(root);
	return [
		bake(rig, 'Idle', 3.0, idleAxe(rig), { loop: true }),
		bake(rig, 'Walk', 1.1, (t) => gait(rig, t, { run: false }), { loop: true }),
		bake(rig, 'Run', 0.7, (t) => gait(rig, t, { run: true }), { loop: true }),
		bake(rig, 'Melee', 0.75, meleeAxe(rig)),
		bake(rig, 'Hit', 0.4, hit(rig, false)),
		bake(rig, 'EquipPistol', 0.85, equip(rig, true)),
		bake(rig, 'IdlePistol', 3.0, idlePistol(rig), { loop: true }),
		bake(rig, 'WalkPistol', 1.1, (t) => gait(rig, t, { run: false, pistol: true }), { loop: true }),
		bake(rig, 'RunPistol', 0.72, (t) => gait(rig, t, { run: true, pistol: true }), { loop: true }),
		bake(rig, 'Shoot', 0.4, shootPistol(rig)),
		bake(rig, 'Reload', 1.4, reloadPistol(rig)),
		bake(rig, 'HitPistol', 0.4, hit(rig, true)),
		bake(rig, 'EquipAxe', 0.85, equip(rig, false)),
		bake(rig, 'Death', 2.2, death(rig)),
	];
}
