// Процедурная модель зомби: SkinnedMesh со скелетом, PBR-материалами и 5 анимациями.
// Работает и в браузере, и в Node (без DOM), поэтому её можно экспортировать в GLB.

import * as THREE from 'three';
import { createSkeleton, createBodyGeometry } from './body.js';
import { createSkinTextures, createClothTextures } from './textures.js';

export const ANIMATION_NAMES = ['Idle', 'Walk', 'Run', 'Attack', 'Death'];

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

// Текстуры генерируются один раз и переиспользуются всеми экземплярами.
let textures = null;
function getTextures() {
	textures ??= { skin: createSkinTextures(512), cloth: createClothTextures(512) };
	return textures;
}

export function createZombieMaterials() {
	const { skin, cloth } = getTextures();
	return [
		new THREE.MeshStandardMaterial({
			name: 'Skin', vertexColors: true, map: skin.map, normalMap: skin.normalMap,
			normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.6, metalness: 0,
		}),
		new THREE.MeshStandardMaterial({
			name: 'Cloth', vertexColors: true, map: cloth.map, normalMap: cloth.normalMap,
			normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
		}),
		new THREE.MeshStandardMaterial({ name: 'Eye', vertexColors: true, roughness: 0.08, metalness: 0 }),
		new THREE.MeshStandardMaterial({ name: 'Teeth', vertexColors: true, roughness: 0.4, metalness: 0 }),
	];
}

/**
 * Создаёт модель зомби.
 * @returns {{ model: THREE.Group, mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, animations: THREE.AnimationClip[] }}
 */
export function createZombie() {
	const bones = createSkeleton();
	const boneList = Object.values(bones);
	const geometry = createBodyGeometry(boneList);

	const mesh = new THREE.SkinnedMesh(geometry, createZombieMaterials());
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
