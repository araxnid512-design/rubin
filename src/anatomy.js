// Анатомическая проверка анимаций на стандартном скелете Mixamo (T-поза покоя, оси костей мировые).
// Для каждого кадра меряются суставы и сравниваются с пределами человеческого тела:
//   • плечо — вращение плечевой кости вокруг своей оси относительно опущенной руки (внутр./наруж.);
//   • локоть и колено — только сгиб в свою сторону (без переразгибания), предплечье — пронация/супинация;
//   • запястье — сгиб кисти; бедро — вращение вокруг оси; лодыжка — скручивание стопы вокруг голени;
//   • скачок — поворот любой кости между соседними кадрами (переворот кости даёт резкий скачок).
// Используется в тестах (tests/model.test.mjs) и в отчёте scripts/anatomy-report.mjs.

import * as THREE from 'three';

export const ANATOMY_LIMITS = {
	shoulderTwist: 90, // внутреннее/наружное вращение плеча
	forearmTwist: 100, // пронация/супинация
	wrist: 75, // сгиб запястья
	elbow: [-3, 150], // сгиб локтя (отрицательный — переразгибание)
	hipTwist: 40,
	knee: [-3, 150],
	ankleTwist: 15,
	jump: 40, // градусов на кадр при 30 к/с
};

const DEG = 180 / Math.PI;
const SIDES = { L: 'Left', R: 'Right' };
// опущенная рука — нейтраль для вращения плеча: T-поза, повёрнутая вниз вокруг Z
const HANG = {
	L: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
	R: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
};
const ELBOW_AXIS = { L: new THREE.Vector3(0, -1, 0), R: new THREE.Vector3(0, 1, 0) };
const KNEE_AXIS = new THREE.Vector3(1, 0, 0);

/** Угол скручивания q вокруг оси axis, градусы в [−180, 180]. */
export function twistDeg(q, axis) {
	let a = 2 * Math.atan2(axis.x * q.x + axis.y * q.y + axis.z * q.z, q.w) * DEG;
	while (a > 180) a -= 360;
	while (a < -180) a += 360;
	return a;
}

/**
 * Сгиб вокруг шарнира со знаком относительно оси шарнира. Поворот кости = сгиб · скручивание
 * (скручивание вокруг своей оси применяется первым), поэтому сгиб = q · скручивание⁻¹.
 */
function hingeDeg(q, boneAxis, hingeAxis) {
	const d = boneAxis.x * q.x + boneAxis.y * q.y + boneAxis.z * q.z;
	const twist = new THREE.Quaternion(boneAxis.x * d, boneAxis.y * d, boneAxis.z * d, q.w);
	if (twist.lengthSq() < 1e-12) twist.identity(); else twist.normalize();
	const s = q.clone().multiply(twist.invert());
	if (s.w < 0) s.set(-s.x, -s.y, -s.z, -s.w);
	const v = new THREE.Vector3(s.x, s.y, s.z);
	const angle = 2 * Math.acos(Math.min(1, s.w)) * DEG;
	return v.lengthSq() < 1e-12 ? 0 : angle * Math.sign(v.dot(hingeAxis) || 1);
}

function swingDeg(q, boneAxis) {
	const d = boneAxis.x * q.x + boneAxis.y * q.y + boneAxis.z * q.z;
	const twist = new THREE.Quaternion(boneAxis.x * d, boneAxis.y * d, boneAxis.z * d, q.w);
	if (twist.lengthSq() < 1e-12) twist.identity(); else twist.normalize();
	const s = twist.invert().multiply(q);
	return 2 * Math.acos(Math.min(1, Math.abs(s.w))) * DEG;
}

/** Замеры одной позы. bone(name) — кость по короткому имени (Hips, LeftArm, ...). */
export function measurePose(bone) {
	const out = {};
	const axis = (child) => bone(child).position.clone().normalize();
	for (const [s, S] of Object.entries(SIDES)) {
		const arm = bone(`${S}Arm`).quaternion, fore = bone(`${S}ForeArm`).quaternion, hand = bone(`${S}Hand`).quaternion;
		const upAxis = axis(`${S}ForeArm`), foreAxis = axis(`${S}Hand`);
		out[`shoulderTwist${s}`] = Math.abs(twistDeg(HANG[s].clone().invert().multiply(arm), upAxis));
		out[`forearmTwist${s}`] = Math.abs(twistDeg(fore, foreAxis));
		out[`elbow${s}`] = hingeDeg(fore, foreAxis, ELBOW_AXIS[s]);
		out[`wrist${s}`] = swingDeg(hand, axis(`${S}HandMiddle1`));
		const thigh = bone(`${S}UpLeg`).quaternion, shin = bone(`${S}Leg`).quaternion, foot = bone(`${S}Foot`).quaternion;
		out[`hipTwist${s}`] = Math.abs(twistDeg(thigh, axis(`${S}Leg`)));
		out[`knee${s}`] = hingeDeg(shin, axis(`${S}Foot`), KNEE_AXIS);
		out[`ankleTwist${s}`] = Math.abs(twistDeg(foot, axis(`${S}Foot`)));
	}
	return out;
}

/**
 * Проверка клипа на модели: { max — худшие значения, violations — что вышло за пределы }.
 * prefix — приставка имён костей (mixamorig).
 */
export function analyzeClip(model, clip, { prefix = 'mixamorig', fps = 30, limits = ANATOMY_LIMITS } = {}) {
	const bones = {};
	model.traverse((o) => { if (o.isBone) bones[o.name.slice(prefix.length)] = o; });
	const bone = (n) => bones[n];
	const mixer = new THREE.AnimationMixer(model);
	mixer.clipAction(clip).play();
	const max = {}, at = {};
	const prev = {};
	let jump = 0, jumpAt = null;
	const frames = Math.round(clip.duration * fps);
	for (let f = 0; f <= frames; f++) {
		const t = Math.min(clip.duration - 1e-4, f / fps);
		mixer.setTime(t);
		const m = measurePose(bone);
		for (const [k, v] of Object.entries(m)) {
			const key = k.replace(/[LR]$/, '');
			const range = limits[key];
			// для шарниров храним и минимум (переразгибание), и максимум
			if (Array.isArray(range)) {
				if (!(key + 'Min' in max) || v < max[key + 'Min']) { max[key + 'Min'] = v; at[key + 'Min'] = `${k} t=${t.toFixed(2)}`; }
				if (!(key in max) || v > max[key]) { max[key] = v; at[key] = `${k} t=${t.toFixed(2)}`; }
			} else if (!(key in max) || v > max[key]) { max[key] = v; at[key] = `${k} t=${t.toFixed(2)}`; }
		}
		for (const [n, b] of Object.entries(bones)) {
			if (prev[n]) {
				const d = prev[n].angleTo(b.quaternion) * DEG;
				if (d > jump) { jump = d; jumpAt = `${n} t=${t.toFixed(2)}`; }
			}
			prev[n] = b.quaternion.clone();
		}
	}
	mixer.stopAllAction();
	mixer.uncacheRoot(model);
	max.jump = jump; at.jump = jumpAt;
	const violations = [];
	for (const [key, lim] of Object.entries(limits)) {
		if (Array.isArray(lim)) {
			if (max[key + 'Min'] < lim[0]) violations.push(`${key} ${max[key + 'Min'].toFixed(0)}° < ${lim[0]}° (${at[key + 'Min']})`);
			if (max[key] > lim[1]) violations.push(`${key} ${max[key].toFixed(0)}° > ${lim[1]}° (${at[key]})`);
		} else if (max[key] > lim) violations.push(`${key} ${max[key].toFixed(0)}° > ${lim}° (${at[key]})`);
	}
	return { max, at, violations };
}
