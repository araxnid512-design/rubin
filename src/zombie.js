// Процедурная low-poly модель зомби: один SkinnedMesh + скелет + 5 анимаций.
// Работает и в браузере, и в Node (без DOM), поэтому её можно экспортировать в GLB.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ANIMATION_NAMES = ['Idle', 'Walk', 'Run', 'Attack', 'Death'];

const COLORS = {
	skin: 0x7c9a63,
	skinDark: 0x5d7a4a,
	shirt: 0x5b4f6e,
	shirtTorn: 0x463c57,
	pants: 0x3a4658,
	shoe: 0x2a2420,
	blood: 0x6e1212,
	bone: 0xe8e0c8,
	eye: 0xfff066,
	mouth: 0x2a0808,
	hair: 0x2b2b22,
};

// Скелет: [имя, родитель, позиция относительно родителя]. Персонаж смотрит в +Z, рост ~1.85 м.
const BONES = [
	['Root', null, [0, 0, 0]],
	['Hips', 'Root', [0, 1.0, 0]],
	['Spine', 'Hips', [0, 0.1, 0]],
	['Chest', 'Spine', [0, 0.2, 0]],
	['Neck', 'Chest', [0, 0.27, 0]],
	['Head', 'Neck', [0, 0.08, 0]],
	['Jaw', 'Head', [0, 0.05, 0.04]],
	['UpperArm.L', 'Chest', [0.27, 0.24, 0]],
	['Forearm.L', 'UpperArm.L', [0, -0.3, 0]],
	['Hand.L', 'Forearm.L', [0, -0.27, 0]],
	['UpperArm.R', 'Chest', [-0.27, 0.24, 0]],
	['Forearm.R', 'UpperArm.R', [0, -0.3, 0]],
	['Hand.R', 'Forearm.R', [0, -0.27, 0]],
	['UpperLeg.L', 'Hips', [0.11, -0.05, 0]],
	['LowerLeg.L', 'UpperLeg.L', [0, -0.45, 0]],
	['Foot.L', 'LowerLeg.L', [0, -0.43, 0]],
	['UpperLeg.R', 'Hips', [-0.11, -0.05, 0]],
	['LowerLeg.R', 'UpperLeg.R', [0, -0.45, 0]],
	['Foot.R', 'LowerLeg.R', [0, -0.43, 0]],
];

// Части тела: [кость, тип, размеры, смещение в пространстве кости, цвет, (поворот в градусах)].
// Каждая часть жёстко привязана к одной кости (вес 1.0) — классический low-poly риг.
const PARTS = [
	// Таз и торс
	['Hips', 'box', [0.36, 0.2, 0.22], [0, 0, 0], COLORS.pants],
	['Spine', 'box', [0.34, 0.24, 0.2], [0, 0.1, 0], COLORS.shirt],
	['Spine', 'box', [0.2, 0.1, 0.21], [0.06, 0.06, 0.005], COLORS.skinDark], // дыра в рубашке
	['Chest', 'box', [0.46, 0.32, 0.24], [0, 0.15, 0], COLORS.shirt],
	['Chest', 'box', [0.14, 0.12, 0.25], [-0.1, 0.18, 0.003], COLORS.blood],
	['Chest', 'box', [0.08, 0.2, 0.245], [0.12, 0.06, 0.002], COLORS.shirtTorn],
	['Chest', 'box', [0.12, 0.012, 0.03], [0.02, 0.1, 0.125], COLORS.bone], // торчащие рёбра
	['Chest', 'box', [0.1, 0.012, 0.03], [0.02, 0.06, 0.125], COLORS.bone],
	['Chest', 'box', [0.16, 0.08, 0.16], [0.24, 0.27, 0], COLORS.shirt], // плечи
	['Chest', 'box', [0.16, 0.08, 0.16], [-0.24, 0.27, 0], COLORS.shirtTorn],
	// Шея и голова
	['Neck', 'cyl', [0.055, 0.12], [0, 0.03, 0], COLORS.skinDark],
	['Head', 'box', [0.25, 0.2, 0.26], [0, 0.16, 0], COLORS.skin],
	['Head', 'box', [0.26, 0.06, 0.27], [0, 0.28, -0.005], COLORS.hair],
	['Head', 'box', [0.06, 0.05, 0.1], [0.08, 0.32, -0.04], COLORS.hair],
	['Head', 'box', [0.22, 0.05, 0.18], [0, 0.065, -0.03], COLORS.skin], // верхняя челюсть
	['Head', 'box', [0.065, 0.035, 0.02], [0.06, 0.18, 0.131], COLORS.eye],
	['Head', 'box', [0.05, 0.05, 0.02], [-0.06, 0.18, 0.131], COLORS.eye],
	['Head', 'box', [0.03, 0.06, 0.04], [0, 0.14, 0.14], COLORS.skinDark], // нос
	['Head', 'box', [0.08, 0.05, 0.01], [-0.07, 0.24, 0.13], COLORS.blood],
	['Jaw', 'box', [0.2, 0.06, 0.2], [0, -0.03, 0.01], COLORS.skin],
	['Jaw', 'box', [0.16, 0.025, 0.02], [0, 0.005, 0.105], COLORS.bone], // зубы
	['Jaw', 'box', [0.14, 0.03, 0.1], [0, 0.01, 0.05], COLORS.mouth],
	// Левая рука — рукав порван, видна кость
	['UpperArm.L', 'box', [0.12, 0.2, 0.12], [0, -0.08, 0], COLORS.shirt],
	['UpperArm.L', 'box', [0.1, 0.14, 0.1], [0, -0.22, 0], COLORS.skin],
	['Forearm.L', 'box', [0.095, 0.22, 0.095], [0, -0.1, 0], COLORS.skin],
	['Forearm.L', 'cyl', [0.022, 0.1], [0.02, -0.23, 0.02], COLORS.bone],
	['Forearm.L', 'box', [0.1, 0.05, 0.1], [0, -0.2, 0], COLORS.blood],
	['Hand.L', 'box', [0.09, 0.1, 0.05], [0, -0.05, 0], COLORS.skinDark],
	['Hand.L', 'box', [0.08, 0.08, 0.035], [0, -0.13, 0.008], COLORS.skin, [20, 0, 0]],
	// Правая рука
	['UpperArm.R', 'box', [0.12, 0.3, 0.12], [0, -0.15, 0], COLORS.shirtTorn],
	['Forearm.R', 'box', [0.1, 0.12, 0.1], [0, -0.05, 0], COLORS.shirtTorn],
	['Forearm.R', 'box', [0.09, 0.16, 0.09], [0, -0.18, 0], COLORS.skin],
	['Hand.R', 'box', [0.09, 0.1, 0.05], [0, -0.05, 0], COLORS.skinDark],
	['Hand.R', 'box', [0.08, 0.08, 0.035], [0, -0.13, 0.008], COLORS.skin, [25, 0, 0]],
	// Ноги
	['UpperLeg.L', 'box', [0.16, 0.46, 0.16], [0, -0.22, 0], COLORS.pants],
	['LowerLeg.L', 'box', [0.13, 0.3, 0.13], [0, -0.14, 0], COLORS.pants],
	['LowerLeg.L', 'box', [0.11, 0.14, 0.11], [0, -0.35, 0], COLORS.skinDark], // порванная штанина
	['Foot.L', 'box', [0.13, 0.08, 0.27], [0, -0.03, 0.05], COLORS.shoe],
	['UpperLeg.R', 'box', [0.16, 0.46, 0.16], [0, -0.22, 0], COLORS.pants],
	['UpperLeg.R', 'box', [0.1, 0.1, 0.165], [0, -0.3, 0.003], COLORS.blood],
	['LowerLeg.R', 'box', [0.13, 0.44, 0.13], [0, -0.21, 0], COLORS.pants],
	['Foot.R', 'box', [0.13, 0.08, 0.27], [0, -0.03, 0.05], COLORS.shoe],
];

function createSkeleton() {
	const bones = {};
	for (const [name, parent, pos] of BONES) {
		const bone = new THREE.Bone();
		bone.name = name;
		bone.position.fromArray(pos);
		bones[name] = bone;
		if (parent) bones[parent].add(bone);
	}
	bones.Root.updateMatrixWorld(true);
	return bones;
}

function createBodyGeometry(bones, boneList) {
	const color = new THREE.Color();
	const geometries = PARTS.map(([boneName, type, size, offset, hex, rot]) => {
		const geo = type === 'box'
			? new THREE.BoxGeometry(...size)
			: new THREE.CylinderGeometry(size[0], size[0], size[1], 8);
		if (rot) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot.map(THREE.MathUtils.degToRad))));
		geo.translate(...offset);
		// Переносим часть в мировые координаты позы привязки (bind pose).
		geo.applyMatrix4(bones[boneName].matrixWorld);

		const count = geo.attributes.position.count;
		const boneIndex = boneList.indexOf(bones[boneName]);
		const colors = new Float32Array(count * 3);
		const skinIndex = new Uint16Array(count * 4);
		const skinWeight = new Float32Array(count * 4);
		color.setHex(hex);
		for (let i = 0; i < count; i++) {
			color.toArray(colors, i * 3);
			skinIndex[i * 4] = boneIndex;
			skinWeight[i * 4] = 1;
		}
		geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
		geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
		return geo;
	});
	const merged = mergeGeometries(geometries);
	geometries.forEach((g) => g.dispose());
	merged.computeBoundingBox();
	merged.computeBoundingSphere();
	return merged;
}

// ---------- Анимации ----------
// Ключи задаются эйлеровыми углами в градусах (поза привязки = нулевые углы),
// а позиции — абсолютными локальными координатами кости.

const HIPS_Y = 1.0;
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

function makeClip(name, duration, rotations, positions = {}) {
	const tracks = [];
	for (const [bone, keys] of Object.entries(rotations)) {
		const times = [];
		const values = [];
		let prev = null;
		for (const [t, deg] of keys) {
			_euler.set(...deg.map(THREE.MathUtils.degToRad), 'XYZ');
			_quat.setFromEuler(_euler);
			// Держим кватернионы в одном полушарии, чтобы интерполяция шла коротким путём.
			if (prev && prev.dot(_quat) < 0) _quat.set(-_quat.x, -_quat.y, -_quat.z, -_quat.w);
			prev = _quat.clone();
			times.push(t);
			values.push(_quat.x, _quat.y, _quat.z, _quat.w);
		}
		tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
	}
	for (const [bone, keys] of Object.entries(positions)) {
		tracks.push(new THREE.VectorKeyframeTrack(
			`${bone}.position`,
			keys.map((k) => k[0]),
			keys.flatMap((k) => k[1]),
		));
	}
	return new THREE.AnimationClip(name, duration, tracks);
}

// Циклическая дорожка: значения повторяются, последний ключ = первому.
function loop(duration, values) {
	const step = duration / values.length;
	return [...values.map((v, i) => [i * step, v]), [duration, values[0]]];
}

function createIdle() {
	const d = 3.2;
	return makeClip('Idle', d, {
		Spine: loop(d, [[12, 0, 2], [15, 3, -1], [12, 0, -3], [10, -3, 1]]),
		Chest: loop(d, [[6, 0, 3], [8, 0, 0], [6, 0, -3], [5, 0, 0]]),
		Neck: loop(d, [[10, 0, 0], [12, 5, 0], [10, 0, 0], [8, -5, 0]]),
		Head: loop(d, [[18, 0, -20], [22, 10, -8], [15, 0, 6], [25, -12, -12]]),
		Jaw: loop(d, [[8, 0, 0], [18, 0, 0], [6, 0, 0], [14, 0, 0]]),
		'UpperArm.L': loop(d, [[-18, 0, 8], [-24, 0, 10], [-15, 0, 6], [-20, 0, 9]]),
		'Forearm.L': loop(d, [[-25, 0, 0], [-30, 0, 0], [-20, 0, 0], [-28, 0, 0]]),
		'UpperArm.R': loop(d, [[-10, 0, -12], [-14, 0, -9], [-8, 0, -14], [-12, 0, -10]]),
		'Forearm.R': loop(d, [[-15, 0, 0], [-12, 0, 0], [-20, 0, 0], [-18, 0, 0]]),
		'Hand.L': loop(d, [[10, 0, 0], [20, 0, 0], [5, 0, 0], [15, 0, 0]]),
		'Hand.R': loop(d, [[15, 0, 0], [8, 0, 0], [20, 0, 0], [10, 0, 0]]),
		'UpperLeg.L': loop(d, [[-8, 0, 3], [-10, 0, 3], [-8, 0, 3], [-6, 0, 3]]),
		'LowerLeg.L': loop(d, [[12, 0, 0], [16, 0, 0], [12, 0, 0], [10, 0, 0]]),
		'Foot.L': loop(d, [[-4, 0, 0], [-6, 0, 0], [-4, 0, 0], [-4, 0, 0]]),
		'UpperLeg.R': loop(d, [[-4, 15, -4], [-5, 15, -4], [-4, 15, -4], [-3, 15, -4]]),
		'LowerLeg.R': loop(d, [[6, 0, 0], [8, 0, 0], [6, 0, 0], [5, 0, 0]]),
		'Foot.R': loop(d, [[-2, 0, 0], [-3, 0, 0], [-2, 0, 0], [-2, 0, 0]]),
	}, {
		Hips: loop(d, [[0, HIPS_Y - 0.03, 0], [0.01, HIPS_Y - 0.045, 0], [0, HIPS_Y - 0.03, 0], [-0.01, HIPS_Y - 0.04, 0]]),
	});
}

// Шаркающая походка: руки вытянуты вперёд, правая нога волочится.
function createWalk() {
	const d = 1.8;
	return makeClip('Walk', d, {
		Spine: loop(d, [[18, 6, 4], [20, 0, 0], [18, -6, -4], [20, 0, 0]]),
		Chest: loop(d, [[5, 5, 0], [6, 0, 0], [5, -5, 0], [6, 0, 0]]),
		Head: loop(d, [[15, -8, -15], [22, 0, -18], [15, 8, -10], [20, 0, -14]]),
		Jaw: loop(d, [[10, 0, 0], [20, 0, 0], [8, 0, 0], [16, 0, 0]]),
		'UpperArm.L': loop(d, [[-80, 0, 8], [-86, 0, 6], [-75, 0, 8], [-82, 0, 10]]),
		'Forearm.L': loop(d, [[-10, 0, 0], [-15, 0, 0], [-6, 0, 0], [-12, 0, 0]]),
		'Hand.L': loop(d, [[25, 0, 0], [30, 0, 0], [20, 0, 0], [28, 0, 0]]),
		'UpperArm.R': loop(d, [[-70, 0, -10], [-62, 0, -8], [-74, 0, -12], [-68, 0, -10]]),
		'Forearm.R': loop(d, [[-20, 0, 0], [-25, 0, 0], [-15, 0, 0], [-22, 0, 0]]),
		'Hand.R': loop(d, [[30, 0, 0], [25, 0, 0], [35, 0, 0], [28, 0, 0]]),
		// Левая нога: нормальный шаг
		'UpperLeg.L': loop(d, [[-28, 0, 2], [-5, 0, 2], [18, 0, 2], [-10, 0, 2]]),
		'LowerLeg.L': loop(d, [[8, 0, 0], [5, 0, 0], [20, 0, 0], [55, 0, 0]]),
		'Foot.L': loop(d, [[8, 0, 0], [0, 0, 0], [-10, 0, 0], [-15, 0, 0]]),
		// Правая нога: волочится, развёрнута наружу
		'UpperLeg.R': loop(d, [[15, 18, -3], [-5, 18, -3], [-20, 18, -3], [0, 18, -3]]),
		'LowerLeg.R': loop(d, [[12, 0, 0], [22, 0, 0], [6, 0, 0], [4, 0, 0]]),
		'Foot.R': loop(d, [[-8, 0, 0], [-12, 0, 0], [5, 0, 0], [0, 0, 0]]),
	}, {
		Hips: loop(d, [[0.02, HIPS_Y - 0.03, 0], [0.03, HIPS_Y - 0.07, 0], [-0.02, HIPS_Y - 0.05, 0], [-0.01, HIPS_Y - 0.02, 0]]),
	});
}

// Бег: сильный наклон, руки тянутся вперёд и болтаются.
function createRun() {
	const d = 0.8;
	return makeClip('Run', d, {
		Spine: loop(d, [[30, 10, 5], [34, 0, 0], [30, -10, -5], [34, 0, 0]]),
		Chest: loop(d, [[8, 8, 0], [10, 0, 0], [8, -8, 0], [10, 0, 0]]),
		Head: loop(d, [[-5, -10, -10], [0, 0, -15], [-5, 10, -5], [0, 0, -10]]),
		Jaw: loop(d, [[30, 0, 0], [20, 0, 0], [32, 0, 0], [22, 0, 0]]),
		'UpperArm.L': loop(d, [[-110, 0, 15], [-90, 0, 10], [-70, 0, 15], [-95, 0, 20]]),
		'Forearm.L': loop(d, [[-20, 0, 0], [-35, 0, 0], [-10, 0, 0], [-30, 0, 0]]),
		'Hand.L': loop(d, [[30, 0, 0], [10, 0, 0], [40, 0, 0], [20, 0, 0]]),
		'UpperArm.R': loop(d, [[-70, 0, -15], [-95, 0, -20], [-110, 0, -15], [-90, 0, -10]]),
		'Forearm.R': loop(d, [[-10, 0, 0], [-30, 0, 0], [-20, 0, 0], [-35, 0, 0]]),
		'Hand.R': loop(d, [[40, 0, 0], [20, 0, 0], [30, 0, 0], [10, 0, 0]]),
		'UpperLeg.L': loop(d, [[-55, 0, 3], [-15, 0, 3], [25, 0, 3], [-20, 0, 3]]),
		'LowerLeg.L': loop(d, [[20, 0, 0], [10, 0, 0], [40, 0, 0], [95, 0, 0]]),
		'Foot.L': loop(d, [[15, 0, 0], [-5, 0, 0], [-20, 0, 0], [-10, 0, 0]]),
		'UpperLeg.R': loop(d, [[25, 8, -3], [-20, 8, -3], [-55, 8, -3], [-15, 8, -3]]),
		'LowerLeg.R': loop(d, [[40, 0, 0], [95, 0, 0], [20, 0, 0], [10, 0, 0]]),
		'Foot.R': loop(d, [[-20, 0, 0], [-10, 0, 0], [15, 0, 0], [-5, 0, 0]]),
	}, {
		Hips: loop(d, [[0, HIPS_Y - 0.1, 0], [0.03, HIPS_Y - 0.04, 0], [0, HIPS_Y - 0.1, 0], [-0.03, HIPS_Y - 0.04, 0]]),
	});
}

// Атака: замах обеими руками, выпад с укусом, возврат в стойку.
function createAttack() {
	const d = 1.4;
	const k = (pose) => pose.map((v, i) => [[0, 0.3, 0.5, 0.65, 0.95, d][i], v]);
	return makeClip('Attack', d, {
		Spine: k([[12, 0, 0], [-10, -15, 0], [40, 10, 0], [42, 5, 0], [25, 0, 0], [12, 0, 0]]),
		Chest: k([[6, 0, 0], [-10, -10, 0], [15, 10, 0], [15, 5, 0], [8, 0, 0], [6, 0, 0]]),
		Neck: k([[10, 0, 0], [-15, 0, 0], [5, 0, 0], [5, 0, 0], [8, 0, 0], [10, 0, 0]]),
		Head: k([[18, 0, -10], [-25, 0, 5], [-10, 0, -5], [-5, 0, -5], [10, 0, -8], [18, 0, -10]]),
		Jaw: k([[8, 0, 0], [40, 0, 0], [45, 0, 0], [0, 0, 0], [10, 0, 0], [8, 0, 0]]),
		'UpperArm.L': k([[-18, 0, 8], [-160, 0, 35], [-55, 0, -10], [-45, 0, -15], [-35, 0, 5], [-18, 0, 8]]),
		'Forearm.L': k([[-25, 0, 0], [-40, 0, 0], [-10, 0, 0], [-15, 0, 0], [-25, 0, 0], [-25, 0, 0]]),
		'Hand.L': k([[10, 0, 0], [-30, 0, 0], [40, 0, 0], [50, 0, 0], [20, 0, 0], [10, 0, 0]]),
		'UpperArm.R': k([[-10, 0, -12], [-155, 0, -35], [-50, 0, 10], [-42, 0, 15], [-30, 0, -8], [-10, 0, -12]]),
		'Forearm.R': k([[-15, 0, 0], [-45, 0, 0], [-10, 0, 0], [-15, 0, 0], [-20, 0, 0], [-15, 0, 0]]),
		'Hand.R': k([[15, 0, 0], [-30, 0, 0], [40, 0, 0], [50, 0, 0], [20, 0, 0], [15, 0, 0]]),
		'UpperLeg.L': k([[-8, 0, 3], [5, 0, 3], [-45, 0, 3], [-45, 0, 3], [-20, 0, 3], [-8, 0, 3]]),
		'LowerLeg.L': k([[12, 0, 0], [10, 0, 0], [40, 0, 0], [42, 0, 0], [20, 0, 0], [12, 0, 0]]),
		'Foot.L': k([[-4, 0, 0], [-10, 0, 0], [5, 0, 0], [3, 0, 0], [0, 0, 0], [-4, 0, 0]]),
		'UpperLeg.R': k([[-4, 15, -4], [-10, 15, -4], [20, 15, -4], [20, 15, -4], [5, 15, -4], [-4, 15, -4]]),
		'LowerLeg.R': k([[6, 0, 0], [10, 0, 0], [15, 0, 0], [15, 0, 0], [8, 0, 0], [6, 0, 0]]),
		'Foot.R': k([[-2, 0, 0], [0, 0, 0], [-20, 0, 0], [-20, 0, 0], [-8, 0, 0], [-2, 0, 0]]),
	}, {
		Hips: k([[0, HIPS_Y - 0.03, 0], [0, HIPS_Y - 0.01, -0.08], [0, HIPS_Y - 0.12, 0.18], [0, HIPS_Y - 0.13, 0.2], [0, HIPS_Y - 0.06, 0.08], [0, HIPS_Y - 0.03, 0]]),
	});
}

// Смерть: отдача от удара, подкашиваются колени, падение на спину. Последний кадр — лежит.
function createDeath() {
	const d = 2.0;
	const T = [0, 0.25, 0.7, 1.15, 1.35, 1.6, d];
	const k = (pose) => pose.map((v, i) => [T[i], v]);
	return makeClip('Death', d, {
		Spine: k([[12, 0, 0], [-20, 10, 0], [10, 5, 5], [-5, 0, 5], [-10, 0, 5], [-8, 0, 5], [-8, 0, 5]]),
		Chest: k([[6, 0, 0], [-15, 0, 0], [5, 0, 0], [-5, 0, 0], [-8, 0, 0], [-5, 0, 0], [-5, 0, 0]]),
		Neck: k([[10, 0, 0], [-20, 0, 0], [15, 0, 0], [-10, 0, 0], [-15, 0, 0], [-5, 0, 0], [-5, 0, 0]]),
		Head: k([[18, 0, 0], [-35, 10, 0], [20, 0, 10], [-15, 30, 10], [-20, 40, 15], [-10, 55, 10], [-10, 60, 10]]),
		Jaw: k([[8, 0, 0], [35, 0, 0], [20, 0, 0], [30, 0, 0], [35, 0, 0], [30, 0, 0], [30, 0, 0]]),
		'UpperArm.L': k([[-18, 0, 8], [-60, 0, 50], [-40, 0, 30], [-50, 0, 80], [-20, 0, 95], [-10, 0, 90], [-10, 0, 90]]),
		'Forearm.L': k([[-25, 0, 0], [-15, 0, 0], [-30, 0, 0], [-20, 0, 0], [-10, 0, 0], [-15, 0, 0], [-15, 0, 0]]),
		'UpperArm.R': k([[-10, 0, -12], [-70, 0, -45], [-35, 0, -25], [-45, 0, -70], [-15, 0, -80], [-8, 0, -75], [-8, 0, -75]]),
		'Forearm.R': k([[-15, 0, 0], [-20, 0, 0], [-40, 0, 0], [-30, 0, 0], [-20, 0, 0], [-45, 0, 0], [-45, 0, 0]]),
		'UpperLeg.L': k([[-8, 0, 3], [5, 0, 5], [-55, 0, 8], [-15, 0, 10], [-10, 0, 12], [-8, 0, 12], [-8, 0, 12]]),
		'LowerLeg.L': k([[12, 0, 0], [5, 0, 0], [100, 0, 0], [40, 0, 0], [15, 0, 0], [25, 0, 0], [25, 0, 0]]),
		'Foot.L': k([[-4, 0, 0], [0, 0, 0], [-30, 0, 0], [-10, 0, 0], [10, 0, 0], [20, 0, 0], [20, 0, 0]]),
		'UpperLeg.R': k([[-4, 15, -4], [-10, 15, -4], [-50, 10, -6], [-20, 10, -8], [-5, 10, -12], [-3, 10, -12], [-3, 10, -12]]),
		'LowerLeg.R': k([[6, 0, 0], [8, 0, 0], [95, 0, 0], [30, 0, 0], [5, 0, 0], [8, 0, 0], [8, 0, 0]]),
		'Foot.R': k([[-2, 0, 0], [0, 0, 0], [-25, 0, 0], [0, 0, 0], [15, 0, 0], [25, 0, 0], [25, 0, 0]]),
		Hips: k([[0, 0, 0], [-8, 0, 0], [-15, 0, 0], [-70, 0, 0], [-88, 0, 0], [-86, 0, 0], [-88, 0, 0]]),
	}, {
		Hips: k([[0, HIPS_Y - 0.03, 0], [0, HIPS_Y - 0.02, -0.08], [0, 0.62, -0.12], [0, 0.3, -0.3], [0, 0.14, -0.38], [0, 0.18, -0.38], [0, 0.13, -0.38]]),
	});
}

export function createZombieAnimations() {
	return [createIdle(), createWalk(), createRun(), createAttack(), createDeath()];
}

/**
 * Создаёт модель зомби.
 * @returns {{ model: THREE.Group, mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, animations: THREE.AnimationClip[] }}
 */
export function createZombie() {
	const bones = createSkeleton();
	const boneList = Object.values(bones);
	const geometry = createBodyGeometry(bones, boneList);
	const material = new THREE.MeshStandardMaterial({
		name: 'ZombieMaterial',
		vertexColors: true,
		roughness: 0.85,
		metalness: 0,
		flatShading: true,
	});

	const mesh = new THREE.SkinnedMesh(geometry, material);
	mesh.name = 'ZombieMesh';
	mesh.castShadow = true;
	mesh.receiveShadow = true;

	const skeleton = new THREE.Skeleton(boneList);
	mesh.add(bones.Root);
	mesh.bind(skeleton);

	const model = new THREE.Group();
	model.name = 'Zombie';
	model.add(mesh);

	const animations = createZombieAnimations();
	model.animations = animations;
	return { model, mesh, skeleton, animations };
}
