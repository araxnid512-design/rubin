// Анимации героя на стандартном скелете Mixamo (65 костей, см. scripts/makehuman/rigs.mjs и src/anatomy.js).
// Поза покоя — T-поза, оси всех костей мировые (как у Mixamo X Bot в three.js).
// Позы задаются не углами суставов, а положением тела в пространстве:
//   • таз, корпус (распределяется по трём позвонкам), взгляд (шея + голова);
//   • ступни — точкой и поворотом (IK ног; колено смотрит туда же, куда носок);
//   • кисти — положением оружия (центр кулака, направление топорища/рукояти и лезвия/ствола)
//     или точкой и поворотом кисти; левая кисть может «прилипать» к правой;
//   • пальцы — позой кисти: сгиб, большой палец, указательный (палец на спуске).
// Суставы решаются по анатомии, а не «как получится»:
//   • локоть и колено — шарниры: сгибаются только в свою сторону вокруг своей оси, без скручивания;
//     поворот плеча/бедра вокруг своей оси однозначно задаётся плоскостью сгиба;
//   • вращение кисти вокруг предплечья (пронация/супинация) — в предплечье, сгиб — в запястье,
//     оба ограничены пределами LIMITS; ключица поднимается сама при подъёме руки.
// Всё запекается в ключевые кадры 30 к/с.

import * as THREE from 'three';
import { at, curves, eulerQ, gaitFoot } from './animations.js';
import { AXE_GRIP_TILT } from '../game/weapons.js';

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
	'IdlePistol', 'WalkPistol', 'RunPistol', 'AimPistol', 'Shoot', 'Reload', 'HitPistol', 'EquipAxe',
	'Death',
];

// Оси шарниров в T-позе. Локоть: сгиб уводит предплечье вперёд (+Z) — у левой руки (вдоль +X) это
// поворот вокруг −Y, у правой (вдоль −X) — вокруг +Y. Колено: сгиб уводит голень назад — вокруг +X.
export const ELBOW_AXIS = { L: V(0, -1, 0), R: V(0, 1, 0) };
export const KNEE_AXIS = V(1, 0, 0);
// Пределы, дальше которых решатель сустав не крутит (градусы)
export const LIMITS = { forearmTwist: 100, wrist: 80 };

// ---------- Риг ----------

class HeroRig {
	constructor(root, { bindQ = {} } = {}) {
		const prefix = root.name.startsWith('mixamorig') ? 'mixamorig' : '';
		const short = (n) => n.slice(prefix.length);
		this.bones = {};
		root.traverse((b) => {
			if (b.isBone) this.bones[short(b.name)] = { parent: b.parent?.isBone ? short(b.parent.name) : null, offset: b.position.clone(), full: b.name };
		});
		this.names = Object.keys(this.bones);
		// концевые кости (кончики пальцев, макушка, концы стоп) не анимируются
		this.animated = this.names.filter((n) => !/(_End|\D4)$/.test(n));
		// позиции суставов в покое: оси всех костей в покое мировые, поэтому смещения складываются
		this.world = {};
		for (const n of this.names) {
			const p = this.bones[n].parent;
			this.world[n] = this.bones[n].offset.clone().add(p ? this.world[p] : V());
		}
		// повороты костей в позе привязки (руки опущены) относительно T-позы
		this.bindQ = Object.fromEntries(this.names.map((n) => [n, bindQ[this.bones[n].full]?.clone() ?? new THREE.Quaternion()]));
		const W = (n) => this.world[n];
		this.hipsY = W('Hips').y;
		this.ankle = { L: W('LeftFoot').clone(), R: W('RightFoot').clone() };
		this.shoulder = { L: W('LeftArm').clone(), R: W('RightArm').clone() };
		// крепления оружия на теле (позиция кулака и направление топорища/рукояти в стойке)
		this.mounts = {};
		for (const [key, name] of [['axe', 'AxeMount'], ['pistol', 'HolsterMount']]) {
			const m = root.getObjectByName(name);
			if (!m) continue;
			const parent = short(m.parent.name);
			const tilt = key === 'axe' ? AXE_GRIP_TILT : 0;
			const q = this.bindQ[parent].clone().multiply(m.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), D2R(tilt)));
			const pos = m.position.clone().applyQuaternion(this.bindQ[parent]).add(this.world[parent]);
			this.mounts[key] = { pos: pos.toArray(), handle: V(0, 0, 1).applyQuaternion(q).toArray(), blade: V(0, -1, 0).applyQuaternion(q).toArray(), tilt };
		}
		this.grip = {};
		this.hand = {};
		this.fingerAxes = {};
		for (const s of ['L', 'R']) {
			const S = SIDE[s];
			const g = root.getObjectByName(`Grip${s}`);
			this.grip[s] = { pos: g.position.clone(), q: g.quaternion.clone() };
			// оси кисти в покое (T-поза, ладонь вниз): F — к пальцам, T — к большому пальцу,
			// P — ладонь (у левой кисти F × T, у правой T × F)
			const wrist = W(`${S}Hand`), mid = W(`${S}HandMiddle1`), idx = W(`${S}HandIndex1`), pinky = W(`${S}HandPinky1`);
			const F = mid.clone().sub(wrist).normalize();
			const T = idx.clone().sub(pinky);
			T.addScaledVector(F, -T.dot(F)).normalize();
			const P = s === 'L' ? new THREE.Vector3().crossVectors(F, T) : new THREE.Vector3().crossVectors(T, F);
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
const _m4 = new THREE.Matrix4();

function chainWorld(rig, local, hipsPos, name) {
	const chain = [];
	for (let n = name; n; n = rig.bones[n].parent) chain.unshift(n);
	const pos = hipsPos.clone(), q = local[chain[0]].clone();
	for (const n of chain.slice(1)) {
		pos.add(rig.bones[n].offset.clone().applyQuaternion(q));
		q.multiply(local[n]);
	}
	return { pos, q };
}

function basis(d, n) {
	const x = d.clone().normalize();
	const y = n.clone().addScaledVector(x, -n.dot(x)).normalize();
	return new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(x, y, new THREE.Vector3().crossVectors(x, y)));
}

/** Мировой поворот кости шарнирной конечности: (ось кости, ось шарнира) покоя → позы. */
const limbQ = (dRest, axisRest, d, axis) => basis(d, axis).multiply(basis(dRest, axisRest).invert());

/** Разложение q = twist · swing, где twist — поворот вокруг оси axis. */
export function swingTwist(q, axis) {
	const d = axis.x * q.x + axis.y * q.y + axis.z * q.z;
	const twist = new THREE.Quaternion(axis.x * d, axis.y * d, axis.z * d, q.w);
	if (twist.lengthSq() < 1e-12) twist.identity(); else twist.normalize();
	return { twist, swing: twist.clone().invert().multiply(q) };
}
export const angleDeg = (q) => (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
const clampRot = (q, maxDeg) => {
	const a = angleDeg(q);
	return a <= maxDeg ? q : slerpI(q, maxDeg / a);
};

/**
 * Двухзвенный IK: сустав-середина (локоть/колено) уводится в сторону pole.
 * axis — ось шарнира: сгиб вокруг неё на положительный угол переводит первое звено во второе.
 */
function twoBone(root, target, L1, L2, pole) {
	const toT = target.clone().sub(root);
	const d = THREE.MathUtils.clamp(toT.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
	const dir = toT.normalize();
	const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
	if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1).addScaledVector(dir, -dir.z);
	perp.normalize();
	const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
	const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
	const mid = root.clone().addScaledVector(dir, L1 * cosA).addScaledVector(perp, L1 * sinA);
	const end = root.clone().addScaledVector(dir, d);
	return { mid, end, axis: new THREE.Vector3().crossVectors(perp, dir).normalize() };
}

/**
 * Оси кулака по оружию: handle — куда уходит топорище/рукоять от кулака (к голове топора),
 * blade — куда смотрит лезвие/ствол. tilt — наклон топорища в кулаке (см. AXE_GRIP_TILT).
 */
function gripQuat({ handle, blade, tilt = 0 }) {
	const Z = V(...handle).normalize();
	const B = V(...blade);
	const Y = B.addScaledVector(Z, -B.dot(Z)).normalize().negate();
	const X = new THREE.Vector3().crossVectors(Y, Z);
	const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
	return tilt ? q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -D2R(tilt))) : q;
}

/** Мировая цель кисти: { pos, q } для кости Hand по описанию руки. */
function handTarget(rig, s, spec, other) {
	const hand = `${SIDE[s]}Hand`;
	let pos, q;
	if (spec.q) {
		q = spec.q.clone();
		pos = V(...spec.pos);
	} else if (spec.grip) {
		const gq = gripQuat(spec.grip);
		q = gq.clone().multiply(rig.grip[s].q.clone().invert());
		pos = V(...spec.grip.pos).sub(rig.grip[s].pos.clone().applyQuaternion(q));
	} else {
		// поворот кисти задан относительно позы привязки (рука опущена, ладонь к бедру)
		q = eulerQ(spec.rot ?? [0, 0, 0], 'YXZ').multiply(rig.bindQ[hand]);
		pos = V(...spec.pos);
	}
	// прилипание к правой кисти (поддерживающая рука на пистолете): смещение и поворот — в осях
	// правой кисти в позе привязки
	if (spec.attach && other) {
		const w = spec.attach.weight ?? 1;
		const rel = other.q.clone().multiply(rig.bindQ.RightHand.clone().invert());
		const tq = rel.clone().multiply(eulerQ(spec.attach.rot ?? [0, 0, 0])).multiply(rig.bindQ[hand]);
		const tp = V(...(spec.attach.offset ?? [0, 0, 0])).applyQuaternion(rel).add(other.pos);
		pos.lerp(tp, w);
		q.slerp(tq, w);
	}
	return { pos, q };
}

// опущенная рука (T-поза, повёрнутая вниз) — нейтраль для вращения плеча вокруг своей оси
const HANG = { L: new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -Math.PI / 2), R: new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2) };
const signedTwist = (q, axis) => {
	let a = 2 * Math.atan2(axis.x * q.x + axis.y * q.y + axis.z * q.z, q.w) * 180 / Math.PI;
	while (a > 180) a -= 360;
	while (a < -180) a += 360;
	return a;
};

/**
 * Рука: ключица, затем плечо–локоть–кисть. Положений локтя при заданной кисти — целая окружность
 * вокруг линии плечо→запястье; решатель перебирает её и берёт самое удобное для тела положение:
 * меньше вращения плеча и предплечья вокруг своих осей, меньше сгиб запястья, локоть не в корпусе,
 * ближе к подсказке позы и к положению в прошлом кадре (без рывков).
 */
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
	const L1 = B('ForeArm').offset.length(), L2 = B('Hand').offset.length();
	const upAxis = B('ForeArm').offset.clone().normalize(), foreAxis = B('Hand').offset.clone().normalize();
	const shInv = sh.q.clone().invert(), chestInv = chest.q.clone().invert();
	// подсказка (в осях груди): куда смотрит локоть, по умолчанию вниз-наружу-назад
	const hint = V(...(hintChest ?? [sx * 0.6, -1, -0.35])).applyQuaternion(chest.q);
	const line = target.pos.clone().sub(Sp).normalize();
	const solve = (deg) => {
		const pole = hint.clone().applyAxisAngle(line, D2R(deg));
		const ik = twoBone(Sp, target.pos, L1, L2, pole);
		const qU = limbQ(B('ForeArm').offset, ELBOW_AXIS[s], ik.mid.clone().sub(Sp), ik.axis);
		const qF0 = limbQ(B('Hand').offset, ELBOW_AXIS[s], ik.end.clone().sub(ik.mid), ik.axis);
		// вращение кисти вокруг предплечья — в предплечье, остальное (сгиб запястья) — в кисти
		const { twist } = swingTwist(qF0.clone().invert().multiply(target.q), foreAxis);
		const qF = qF0.clone().multiply(clampRot(twist, LIMITS.forearmTwist));
		const arm = shInv.clone().multiply(qU);
		const hand = qF.clone().invert().multiply(target.q);
		const shoulderTwist = signedTwist(HANG[s].clone().invert().multiply(arm), upAxis);
		const foreTwist = signedTwist(twist, foreAxis);
		const wrist = angleDeg(hand);
		// локоть внутри корпуса (в осях груди)
		const e = ik.mid.clone().sub(chest.pos).applyQuaternion(chestInv);
		const inside = Math.abs(e.x) < 0.15 && e.z > -0.14 && e.z < 0.12 && e.y > -0.5 && e.y < 0.25;
		const cost = (shoulderTwist / 60) ** 2 + (foreTwist / 70) ** 2 + (wrist / 45) ** 2 + (deg / 70) ** 2
			+ (prev === undefined ? 0 : ((deg - prev) / 25) ** 2) + (inside ? 25 : 0);
		return { deg, cost, arm, fore: qU.clone().invert().multiply(qF), hand };
	};
	// первый кадр — поиск по всей окружности, дальше — только рядом с прошлым кадром (локоть не перескакивает)
	const prev = rig.swivel?.[s];
	let best = solve(prev ?? 0);
	if (prev === undefined) {
		for (let d = -170; d <= 180; d += 10) { const c = solve(d); if (c.cost < best.cost) best = c; }
		for (let d = best.deg - 8; d <= best.deg + 8; d += 2) { const c = solve(d); if (c.cost < best.cost) best = c; }
	} else {
		for (let d = prev - 15; d <= prev + 15; d += 1.5) { const c = solve(d); if (c.cost < best.cost) best = c; }
	}
	if (rig.swivel) rig.swivel[s] = best.deg;
	local[`${S}Arm`] = best.arm;
	local[`${S}ForeArm`] = best.fore;
	local[`${S}Hand`] = clampRot(best.hand, LIMITS.wrist);
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
 * pose = { hips, pelvis, torso, look,
 *          feet: { L: { pos, rot }, R }, hands: { R: {...}, L: {...} }, fingers: { R: {...}, L: {...} } }
 */
function solveHero(rig, pose) {
	const local = {};
	for (const n of rig.animated) local[n] = new THREE.Quaternion();
	local.Hips = eulerQ(pose.pelvis ?? [0, 0, 0], 'YXZ');
	const torso = eulerQ(pose.torso ?? [0, 0, 0], 'YXZ');
	local.Spine = slerpI(torso, 0.34);
	local.Spine1 = slerpI(torso, 0.33);
	local.Spine2 = slerpI(torso, 0.33);
	const look = eulerQ(pose.look ?? [0, 0, 0], 'YXZ');
	local.Neck = slerpI(look, 0.4);
	local.Head = slerpI(look, 0.6);
	const hipsPos = V(...pose.hips);

	// ноги: колено смотрит туда же, куда носок (немного — по тазу), поэтому лодыжка не скручивается
	for (const s of ['L', 'R']) {
		const S = SIDE[s];
		const foot = pose.feet[s];
		const footQ = eulerQ(foot.rot ?? [0, 0, 0], 'YXZ');
		const H = chainWorld(rig, local, hipsPos, `${S}UpLeg`).pos;
		const pole = V(0, 0, 1).applyQuaternion(footQ).multiplyScalar(0.75).add(V(0, 0, 0.25).applyQuaternion(local.Hips));
		const thigh = rig.bones[`${S}Leg`].offset, shin = rig.bones[`${S}Foot`].offset;
		const ik = twoBone(H, V(...foot.pos), thigh.length(), shin.length(), pole);
		const qT = limbQ(thigh, KNEE_AXIS, ik.mid.clone().sub(H), ik.axis);
		const qS = limbQ(shin, KNEE_AXIS, ik.end.clone().sub(ik.mid), ik.axis);
		local[`${S}UpLeg`] = local.Hips.clone().invert().multiply(qT);
		local[`${S}Leg`] = qT.clone().invert().multiply(qS);
		local[`${S}Foot`] = qS.clone().invert().multiply(footQ);
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
	// локоть помнит своё положение с прошлого кадра; цикл сначала прогоняется вхолостую, чтобы
	// первый кадр продолжал последний
	rig.swivel = {};
	if (loop) for (let f = 0; f < frames; f++) solveHero(rig, poseAt((f / frames) * duration));
	const times = [];
	const quats = Object.fromEntries(rig.animated.map((n) => [n, []]));
	const hips = [];
	const prev = {};
	for (let f = 0; f <= frames; f++) {
		const t = (f / frames) * duration;
		const { local, hips: hp } = solveHero(rig, poseAt(loop && f === frames ? 0 : t));
		times.push(t);
		for (const n of rig.animated) {
			const q = local[n];
			if (prev[n] && prev[n].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
			prev[n] = q;
			quats[n].push(q.x, q.y, q.z, q.w);
		}
		hips.push(hp.x, hp.y, hp.z);
	}
	const tracks = Object.entries(quats).map(([n, v]) => new THREE.QuaternionKeyframeTrack(`${rig.bones[n].full}.quaternion`, times, v));
	tracks.push(new THREE.VectorKeyframeTrack(`${rig.bones.Hips.full}.position`, times, hips));
	return new THREE.AnimationClip(name, duration, tracks);
}

// ---------- Общие куски поз ----------

const add = (p, d) => [p.x + d[0], p.y + d[1], p.z + d[2]];
const HAND_GRIP = { curl: 0.95, thumb: 0.85, index: 0.95 };
const HAND_PISTOL = { curl: 0.95, thumb: 0.8, index: 0.42 };
const HAND_SUPPORT = { curl: 0.85, thumb: 0.6, index: 0.75 };
const HAND_RELAXED = { curl: 0.32, thumb: 0.25, index: 0.25, spread: 0.3 };
const mixHand = (a, b, w) => Object.fromEntries(['curl', 'thumb', 'index', 'spread'].map((k) => [k, (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * w]));

// Поворот ступни [наклон, рыскание, 0]: положительное рыскание разворачивает носок к +X (влево),
// поэтому у левой ноги носок наружу — плюс, у правой — минус.
const TOE_OUT = { L: 5, R: -13 };

function stance(rig, wide = 1) {
	const a = rig.ankle;
	return {
		L: { pos: [a.L.x + 0.04 * wide, a.L.y, a.L.z + 0.08 * wide], rot: [0, TOE_OUT.L, 0] },
		R: { pos: [a.R.x - 0.05 * wide, a.R.y, a.R.z - 0.06 * wide], rot: [0, TOE_OUT.R, 0] },
	};
}

// стойка стрелка (изосцелес): ступни на ширине плеч, левая чуть впереди, носки слегка врозь
function pistolStance(rig) {
	const a = rig.ankle;
	return {
		L: { pos: [a.L.x + 0.05, a.L.y, a.L.z + 0.08], rot: [0, 6, 0] },
		R: { pos: [a.R.x - 0.05, a.R.y, a.R.z - 0.05], rot: [0, -11, 0] },
	};
}

const T_AXE = AXE_GRIP_TILT;
// топор в опущенной, почти прямой руке: кисть прямая, топорище из-за наклона в кулаке смотрит вперёд-вниз
const axeCarry = (rig, d = [0, 0, 0]) => ({ pos: add(rig.shoulder.R, [-0.035 + d[0], -0.675 + d[1], 0.04 + d[2]]), handle: [0, -0.7, 1], blade: [0, -1, -0.7], tilt: T_AXE });
// низкая готовность: две руки почти вытянуты вперёд-вниз, ствол смотрит в землю в паре метров впереди
const pistolReady = (d = [0, 0, 0], tilt = 0) => ({ pos: [-0.035 + d[0], 1.22 + d[1], 0.48 + d[2]], handle: [0, 0.82, 0.57 - tilt], blade: [0, -0.57 + tilt, 0.82] });
// прицел: руки вытянуты, пистолет на линии глаз, ствол горизонтально вперёд
const pistolAim = (d = [0, 0, 0]) => ({ pos: [-0.03 + d[0], 1.7 + d[1], 0.8 + d[2]], handle: [0, 1, 0], blade: [0, 0, 1] });
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
		L: gaitFoot(ph, { ...opts, x: a.L.x, y0: a.L.y, z0: run ? 0.05 : 0.02, yaw: 3 }),
		R: gaitFoot(ph - 0.5, { ...opts, x: a.R.x, y0: a.R.y, z0: run ? 0.05 : 0.02, yaw: -3 }),
	};
	const bob = (run ? 0.03 : 0.015) * c(2, run ? 0.19 : 0.05);
	const yaw = (pistol ? 0.4 : 1) * (run ? -10 : -6) * c(1, 0.75);
	const sw = -c(1, 0); // мах левой руки: вперёд, когда правая нога впереди
	const base = {
		hips: [0.02 * c(1, 0.25), H - (run ? 0.07 : 0.025) - bob, 0],
		pelvis: [run ? 9 : 3, yaw + (pistol && !run ? -4 : 0), 3 * c(1, 0.25)],
		torso: [run ? 9 : pistol ? 6 : 3, -0.75 * yaw + (pistol && !run ? 4 : 0), 0],
		look: [run ? -8 : pistol ? -3 : 0, -0.3 * yaw, 0],
		feet,
	};
	if (pistol && !run) {
		// шагом — пистолет двумя руками в низкой готовности, корпус гасит раскачку
		return {
			...base,
			hands: { R: { grip: pistolReady([0, -bob * 0.5, 0]), hint: [-0.6, -1, -0.3] }, L: { pos: [0, 0, 0], attach: SUPPORT, hint: [0.6, -1, -0.3] } },
			fingers: { R: HAND_PISTOL, L: HAND_SUPPORT },
		};
	}
	// левая рука свободно машет; правая несёт топор, а на бегу с пистолетом держит его одной рукой у груди
	const L = run
		? { pos: add(rig.shoulder.L, [0.02, -0.33 + 0.06 * Math.max(0, sw), 0.05 + 0.24 * sw]), rot: [-65 - 25 * sw, 0, 10], hint: [0.4, -1, -0.6] }
		: { pos: add(rig.shoulder.L, [0.06, -0.55 + 0.035 * Math.max(0, sw), 0.04 + 0.2 * sw]), rot: [8 - 22 * sw, 0, 6], hint: [0.5, -1, -0.4] };
	const R = pistol
		? { grip: { pos: add(rig.shoulder.R, [0.07, -0.42 + 0.03 * Math.max(0, -sw), 0.3 - 0.07 * sw]), handle: [0, 0.94, 0.34], blade: [0, -0.34, 0.94] }, hint: [-0.5, -1, -0.4] }
		: run
			? { grip: { pos: add(rig.shoulder.R, [-0.03, -0.44 + 0.04 * Math.max(0, -sw), 0.2 - 0.12 * sw]), handle: [0, 0.75, 0.66], blade: [0, -0.66, 0.75], tilt: T_AXE }, hint: [-0.4, -1, -0.5] }
			: { grip: axeCarry(rig, [0, 0.02 * Math.max(0, -sw), -0.08 * sw]), hint: [-0.3, -1, -0.5] };
	return { ...base, hands: { R, L }, fingers: { R: pistol ? HAND_PISTOL : HAND_GRIP, L: run ? { curl: 0.6, thumb: 0.5 } : HAND_RELAXED } };
}

// Удар топором наискось: замах за правое плечо (корпус скручен вправо) → дуга справа-сверху
// налево-вниз перед собой с шагом левой ногой (попадание 0.33 с) → доводка у левого бедра → возврат.
// Топор описывает дугу в наклонной плоскости: топорище h(φ) = cos φ·u1 + sin φ·u2, лезвие ведёт — dh/dφ.
const SWING_U1 = V(-0.55, 0.75, -0.1).normalize();
const SWING_U2 = V(0, 0, 1).addScaledVector(SWING_U1, 0.1 / Math.hypot(0.55, 0.75, 0.1)).normalize();
function swingAxe(deg) {
	const f = D2R(deg), c = Math.cos(f), sn = Math.sin(f);
	return {
		handle: SWING_U1.clone().multiplyScalar(c).addScaledVector(SWING_U2, sn).toArray(),
		blade: SWING_U1.clone().multiplyScalar(-sn).addScaledVector(SWING_U2, c).toArray(),
	};
}

function meleeAxe(rig) {
	const H = rig.hipsY, a = rig.ankle;
	const st = stance(rig);
	const carry = axeCarry(rig);
	const T = [0, 0.1, 0.2, 0.27, 0.33, 0.45, 0.58, 0.75];
	const k = at(T);
	// 0.1 — топор поднят вперёд-вверх у правого плеча, лезвием вперёд
	const raise = { handle: [-0.2, 0.6, 0.77], blade: [0, -0.77, 0.6] };
	const pos = [carry.pos, [-0.4, 1.38, 0.24], [-0.46, 1.82, -0.06], [-0.45, 1.6, 0.42], [-0.05, 1.27, 0.5], [0.16, 1.0, 0.4], [0.05, 1.04, 0.3], carry.pos];
	const keys = [carry, raise, swingAxe(-40), swingAxe(10), swingAxe(80), swingAxe(150), swingAxe(125), carry];
	const hand = handPath(rig, 'R', T, keys.map((g, i) => ({ grip: { ...g, pos: pos[i], tilt: T_AXE } })));
	const P = curves({
		hips: k([0, H - 0.025, 0], [0, H - 0.03, -0.02], [0, H - 0.04, -0.04], [0, H - 0.06, 0.04], [0.01, H - 0.08, 0.12], [0.02, H - 0.085, 0.14], [0.01, H - 0.06, 0.09], [0, H - 0.025, 0]),
		pelvis: k([3, -6, 0], [0, -14, 0], [-2, -22, 1], [2, -10, 0], [8, 8, -2], [10, 18, -3], [7, 10, -2], [3, -6, 0]),
		torso: k([4, 7, 0], [-2, -16, 1], [-6, -34, 3], [2, -14, 0], [12, 12, -2], [18, 26, -3], [12, 14, 0], [4, 7, 0]),
		look: k([2, -2, 0], [5, 22, -1], [8, 42, -3], [4, 20, 0], [6, -16, 0], [10, -36, 0], [6, -20, 0], [2, -2, 0]),
		gripHint: k([-0.3, -1, -0.5], [-0.8, -0.6, -0.3], [-1, 0.3, -0.2], [-1, -0.4, 0], [-0.5, -1, 0], [-0.3, -1, 0.1], [-0.3, -1, -0.2], [-0.3, -1, -0.5]),
		// левая рука: на замахе выставлена вперёд, в ударе уходит назад-в сторону (противовес)
		lPos: k(freeHandL(rig).pos, [0.2, 1.2, 0.3], [0.24, 1.38, 0.42], [0.28, 1.28, 0.3], [0.32, 1.12, -0.02], [0.3, 1.12, -0.16], [0.28, 1.1, -0.06], freeHandL(rig).pos),
		lRot: k([8, 0, 6], [-30, 5, 6], [-62, 10, 6], [-40, 0, 10], [10, 0, 22], [24, 0, 26], [14, 0, 14], [8, 0, 6]),
		footRp: k([0], [0], [0], [4], [18], [24], [12], [0]),
		footRyaw: k([TOE_OUT.R], [-18], [-20], [-16], [-6], [0], [-8], [TOE_OUT.R]),
		footLyaw: k([TOE_OUT.L], [TOE_OUT.L], [TOE_OUT.L], [9], [12], [12], [10], [TOE_OUT.L]),
	});
	// шаг левой ногой: вперёд к удару, после доводки — назад в стойку
	const LT = [0, 0.2, 0.27, 0.32, 0.56, 0.66, 0.75];
	const L0 = st.L.pos;
	const footL = curves({ p: at(LT)(L0, L0, [L0[0] + 0.01, L0[1] + 0.05, L0[2] + 0.14], [L0[0] + 0.02, L0[1], L0[2] + 0.24], [L0[0] + 0.02, L0[1], L0[2] + 0.24], [L0[0] + 0.01, L0[1] + 0.04, L0[2] + 0.12], L0) });
	return (t) => {
		const p = P(t), h = hand(t);
		return {
			hips: p.hips, pelvis: p.pelvis, torso: p.torso, look: p.look,
			feet: {
				L: { pos: footL(t).p, rot: [0, p.footLyaw[0], 0] },
				R: { pos: [st.R.pos[0], st.R.pos[1] + Math.max(0, p.footRp[0]) / 24 * 0.035, st.R.pos[2]], rot: [p.footRp[0], p.footRyaw[0], 0] },
			},
			hands: {
				R: { pos: h.pos, q: h.q, hint: p.gripHint },
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
			pelvis: [3, -4 + 1.5 * w(1, 0.4), -1 * w(1)],
			torso: [6 + w(2, 0.5), 4, 0],
			look: [-2 + w(1, 2), 6 * w(1, 2.2), 0],
			feet: pistolStance(rig),
			hands: {
				R: { grip: pistolReady([0, 0.004 * w(2, 0.8), 0]), hint: [-0.6, -1, -0.3] },
				L: { pos: [0, 0, 0], attach: SUPPORT, hint: [0.6, -1, -0.3] },
			},
			fingers: { R: HAND_PISTOL, L: HAND_SUPPORT },
		};
	};
}

// Прицеливание: пистолет двумя руками на вытянутых руках на линии глаз, корпус чуть вперёд
function aimPose(rig, { pos, handle, blade, trigger = 0.45, torso = [6, 3, 0], hips = 0 }) {
	const H = rig.hipsY;
	return {
		hips: [0, H - 0.045, 0.01 + hips], pelvis: [4, -3, 0], torso, look: [-4, 0, 0],
		feet: pistolStance(rig),
		hands: {
			R: { grip: { pos, handle, blade }, hint: [-0.7, -1, -0.1] },
			L: { pos: [0, 0, 0], attach: SUPPORT, hint: [0.7, -1, -0.1] },
		},
		fingers: { R: { ...HAND_PISTOL, index: trigger }, L: HAND_SUPPORT },
	};
}

function aimPistol(rig) {
	const d = 2;
	return (t) => {
		const w = (f, ph = 0) => Math.sin((t / d) * Math.PI * 2 * f + ph);
		const a = pistolAim([0.003 * w(1, 0.3), 0.004 * w(2), 0]);
		return aimPose(rig, { ...a, torso: [6 + 0.5 * w(2, 0.5), 3, 0] });
	};
}

// Выстрел из прицела: палец жмёт спуск, отдача подбрасывает ствол и толкает руки к себе, возврат в прицел.
// Клип короткий, чтобы частые выстрелы при зажатой кнопке шли без рывков.
function shootPistol(rig) {
	const aim = pistolAim();
	const k = at([0, 0.03, 0.07, 0.16, 0.26]);
	const P = curves({
		pos: k(aim.pos, aim.pos, add(V(...aim.pos), [0, 0.035, -0.06]), add(V(...aim.pos), [0, 0.008, -0.012]), aim.pos),
		handle: k([0, 1, 0], [0, 1, 0], [0, 0.94, -0.34], [0, 1, -0.05], [0, 1, 0]),
		blade: k([0, 0, 1], [0, 0, 1], [0, 0.34, 0.94], [0, 0.05, 1], [0, 0, 1]),
		trigger: k([0.45], [0.8], [0.62], [0.45], [0.45]),
		torso: k([6, 3, 0], [6, 3, 0], [3, 3, 0], [5.5, 3, 0], [6, 3, 0]),
		hips: k([0], [0], [-0.012], [-0.003], [0]),
	});
	return (t) => {
		const p = P(t);
		return aimPose(rig, { pos: p.pos, handle: p.handle, blade: p.blade, trigger: p.trigger[0], torso: p.torso, hips: p.hips[0] });
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
		// подсумки — на груди слева (верх ~1.45 м); магазин вставляется снизу в рукоять, затвор — сверху
		lPos: k([0.06, 1.18, 0.42], [0.08, 1.3, 0.3], [0.085, 1.47, 0.24], [0.085, 1.5, 0.26], [0.03, 1.13, 0.33], [0.0, 1.36, 0.34], [0.05, 1.22, 0.4], [0.06, 1.18, 0.42]),
		lRot: k([-60, 0, 0], [-90, -20, 0], [-150, -20, 0], [-150, -20, 0], [-60, -20, 0], [-80, -30, 0], [-60, 0, 0], [-60, 0, 0]),
		attach: k([1], [0], [0], [0], [0], [0], [0.6], [1]),
		lCurl: k([0.85], [0.6], [0.35], [0.8], [0.8], [0.7], [0.8], [0.85]),
		look: k([4, 4, 0], [16, 10, 0], [18, 14, 0], [16, 14, 0], [18, 8, 0], [14, 6, 0], [6, 4, 0], [4, 4, 0]),
	});
	return (t) => {
		const p = P(t);
		return {
			hips: [0, H - 0.035, 0], pelvis: [3, -4, 0], torso: [7, 4, 0], look: p.look,
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
			hips: p.hips, pelvis: [3 - 6 * f, pistol ? -4 : -6, 3 * f], torso: p.torso, look: p.look, feet: st, hands,
			fingers: pistol ? { R: HAND_PISTOL, L: HAND_SUPPORT } : { R: HAND_GRIP, L: { curl: 0.3 + 0.4 * f } },
		};
	};
}

// Смена оружия. Топор вешается в чехол на левом бедре (рука тянется поперёк тела),
// пистолет — в кобуру на правом бедре. Тайминги перевешивания — EQUIP_TIMES (их же использует игра).
export const EQUIP_TIMES = { EquipPistol: { stow: 0.36, draw: 0.74 }, EquipAxe: { stow: 0.26, draw: 0.6 } };

/**
 * Путь кисти по ключам: положение и поворот — гладкими кривыми через все ключи без остановок.
 * Поворот интерполируется как кватернион (сплайн по компонентам с нормализацией, знаки согласованы),
 * поэтому кисть не разворачивается «через ноль», как бывает при интерполяции векторов.
 * Ключ: { grip } — оружие в руке, или { pos, rot } — пустая кисть (поворот относительно позы привязки).
 */
function handPath(rig, s, T, keys) {
	const targets = keys.map((k) => handTarget(rig, s, k.grip ? { grip: k.grip } : { pos: k.pos, rot: k.rot ?? [0, 0, 0] }));
	for (let i = 1; i < targets.length; i++) if (targets[i].q.dot(targets[i - 1].q) < 0) targets[i].q.set(-targets[i].q.x, -targets[i].q.y, -targets[i].q.z, -targets[i].q.w);
	const k = at(T);
	const P = curves({ pos: k(...targets.map((x) => x.pos.toArray())), q: k(...targets.map((x) => x.q.toArray())) });
	return (t) => {
		const p = P(t);
		return { pos: p.pos, q: new THREE.Quaternion(...p.q).normalize() };
	};
}

function equip(rig, toPistol) {
	const H = rig.hipsY;
	const carry = axeCarry(rig), ready = pistolReady();
	const axeM = rig.mounts.axe, holM = rig.mounts.pistol;
	// подход к креплению: кулак чуть отведён от него, чтобы рука подходила, а не проходила сквозь
	const near = (m, d) => ({ ...m, pos: m.pos.map((v, i) => v + d[i]) });
	const CROSS = { torso: [14, 22, 0], look: [20, 16, 0] }; // рука тянется к левому бедру
	const HOLST = { torso: [8, -8, 0], look: [14, -10, 0] };
	const K = (t, hand, o = {}) => ({ t, hand, torso: o.torso ?? [4, 7, 0], look: o.look ?? [3, 2, 0], curl: o.curl ?? 0.95, support: o.support ?? 0 });
	// топор: из руки вперёд-вверх, поперёк живота топорищем влево, в чехол на бедре головой назад
	const axeOut = [
		{ pos: [-0.02, 1.2, 0.32], handle: [0, 0.5, 0.87], blade: [1, 0, 0], tilt: T_AXE },
		{ pos: [0.04, 1.14, 0.28], handle: [1, 0.15, 0.1], blade: [0.1, -1, 0], tilt: T_AXE },
	];
	// пустая кисть между креплениями: большой палец вверх, пальцы вниз-влево — промежуточное положение,
	// через которое предплечье проворачивается без перекрута
	const transit = (pos) => ({ grip: { pos, handle: [0, 0.7, 0.7], blade: [0.8, -0.6, 0] } });
	const keys = toPistol
		? [
			K(0, { grip: carry }),
			K(0.12, { grip: axeOut[0] }),
			K(0.22, { grip: axeOut[1] }),
			K(0.36, { grip: axeM }, CROSS), // топор в чехле
			K(0.54, transit([-0.08, 1.08, 0.22]), { curl: 0.35 }),
			K(0.67, { grip: near(holM, [0, 0.04, 0.03]) }, { ...HOLST, curl: 0.35 }),
			K(0.74, { grip: holM }, HOLST), // пистолет в руке
			K(0.87, { grip: { pos: [-0.12, 1.2, 0.32], handle: [0, 0.6, 0.8], blade: [0, -0.8, 0.6] } }, { torso: [6, 4, 0], support: 0.3 }),
			K(1.0, { grip: ready }, { torso: [6, 4, 0], support: 1 }),
		]
		: [
			K(0, { grip: ready }, { torso: [6, 4, 0], support: 1 }),
			K(0.13, { grip: { pos: [-0.16, 1.12, 0.22], handle: [0, 0.5, 0.87], blade: [0, -0.87, 0.5] } }, { support: 0.2 }),
			K(0.2, { grip: near(holM, [0, 0.04, 0.03]) }, HOLST),
			K(0.26, { grip: holM }, HOLST), // пистолет в кобуре
			K(0.4, transit([-0.06, 1.08, 0.22]), { curl: 0.35 }),
			K(0.53, { grip: near(axeM, [-0.03, 0.03, 0.05]) }, { ...CROSS, curl: 0.35 }),
			K(0.6, { grip: axeM }, CROSS), // топор в руке
			K(0.77, { grip: axeOut[1] }),
			K(0.89, { grip: axeOut[0] }),
			K(1.0, { grip: carry }),
		];
	const T = keys.map((k) => k.t);
	const hand = handPath(rig, 'R', T, keys.map((k) => k.hand));
	const k = at(T);
	const P = curves({
		torso: k(...keys.map((x) => x.torso)),
		look: k(...keys.map((x) => x.look)),
		support: k(...keys.map((x) => [x.support])),
		curl: k(...keys.map((x) => [x.curl])),
	});
	// ступни плавно переходят между стойкой с топором и стойкой стрелка
	const st = stance(rig), ps = pistolStance(rig);
	const blend = (t) => toPistol ? THREE.MathUtils.smoothstep(t, 0.65, 1.0) : 1 - THREE.MathUtils.smoothstep(t, 0, 0.35);
	const foot = (s, w) => ({ pos: st[s].pos.map((v, i) => v + (ps[s].pos[i] - v) * w), rot: st[s].rot.map((v, i) => v + (ps[s].rot[i] - v) * w) });
	return (t) => {
		const p = P(t), h = hand(t), w = blend(t);
		const support = THREE.MathUtils.clamp(p.support[0], 0, 1);
		return {
			hips: [0, H - 0.03 - 0.03 * Math.max(0, p.torso[0] - 8) / 8, 0],
			pelvis: [3, -6 + p.torso[1] * 0.3, 0], torso: p.torso, look: p.look,
			feet: { L: foot('L', w), R: foot('R', w) },
			hands: {
				R: { pos: h.pos, q: h.q },
				L: { ...freeHandL(rig), attach: { ...SUPPORT, weight: support } },
			},
			fingers: { R: { curl: p.curl[0], thumb: p.curl[0] * 0.85, index: Math.min(p.curl[0], 0.9) }, L: mixHand(HAND_RELAXED, HAND_SUPPORT, support) },
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
			feet: { L: { pos: p.footL, rot: [p.footPitch[0], 14, 0] }, R: { pos: p.footR, rot: [p.footPitch[0], -22, 0] } },
			hands: {
				R: { pos: p.rPos, rot: [p.hRot[0], 0, -p.hRot[2]], hint: [-1, 0.3, -0.5] },
				L: { pos: p.lPos, rot: [p.hRot[0], 0, p.hRot[2]], hint: [1, 0.3, -0.5] },
			},
			fingers: { R: { curl: p.curl[0], thumb: p.curl[0] * 0.8 }, L: { curl: Math.min(0.4, p.curl[0]), thumb: 0.2 } },
		};
	};
}

/** Все анимации героя для скелета с корнем root. */
export function createHeroAnimations(root, options) {
	const rig = new HeroRig(root, options);
	return [
		bake(rig, 'Idle', 3.0, idleAxe(rig), { loop: true }),
		bake(rig, 'Walk', 1.1, (t) => gait(rig, t, { run: false }), { loop: true }),
		bake(rig, 'Run', 0.7, (t) => gait(rig, t, { run: true }), { loop: true }),
		bake(rig, 'Melee', 0.75, meleeAxe(rig)),
		bake(rig, 'Hit', 0.4, hit(rig, false)),
		bake(rig, 'EquipPistol', 1.0, equip(rig, true)),
		bake(rig, 'IdlePistol', 3.0, idlePistol(rig), { loop: true }),
		bake(rig, 'WalkPistol', 1.1, (t) => gait(rig, t, { run: false, pistol: true }), { loop: true }),
		bake(rig, 'RunPistol', 0.72, (t) => gait(rig, t, { run: true, pistol: true }), { loop: true }),
		bake(rig, 'AimPistol', 2.0, aimPistol(rig), { loop: true }),
		bake(rig, 'Shoot', 0.26, shootPistol(rig)),
		bake(rig, 'Reload', 1.4, reloadPistol(rig)),
		bake(rig, 'HitPistol', 0.4, hit(rig, true)),
		bake(rig, 'EquipAxe', 1.0, equip(rig, false)),
		bake(rig, 'Death', 2.2, death(rig)),
	];
}
