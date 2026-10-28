// Сборка реалистичного зомби из базовой модели MakeHuman (CC0):
//   1. морфы: худой мужчина, впалые щёки и глаза, впалый живот;
//   2. скелет из 19 костей по суставам MakeHuman, веса 163 костей сводятся к нашим 19;
//   3. руки из A-позы опускаются вниз (меш перепозируется скиннингом), скелет перепривязывается;
//   4. рваная одежда — «надутые» копии участков тела с дырами и лохмотьями;
//   5. текстуры кожи и ткани запекаются по 3D-координатам в UV-развёртку MakeHuman;
//   6. добавляются 5 анимаций (те же, что у процедурной модели) → THREE.Group для экспорта в GLB.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadObj, applyTarget, loadSkeleton, loadWeights, jointPosition, fitProxy } from './mh-data.mjs';
import { bakeAtlas, colorTexture, normalTexture, makeTexture } from './bake.mjs';
import { decodePNG } from '../node-shims.mjs';
import { createZombieAnimations } from '../../src/zombie.js';
import { fbm3, noise3, smoothstep } from '../../src/noise.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MH = join(ROOT, 'third_party/makehuman');
const DM_TO_M = 0.1; // MakeHuman хранит модель в дециметрах

// Морфы: [файл, вес]. Макро-морфы смешиваются как в MakeHuman:
// мышцы 0.35 (min 0.3 / avg 0.7) × вес тела 0.15 (min 0.7 / avg 0.3).
const TARGETS = [
	['macrodetails/universal-male-young-minmuscle-minweight', 0.21],
	['macrodetails/universal-male-young-minmuscle-averageweight', 0.09],
	['macrodetails/universal-male-young-averagemuscle-minweight', 0.49],
	['macrodetails/universal-male-young-averagemuscle-averageweight', 0.21],
	['macrodetails/caucasian-male-young', 1],
	['cheek/l-cheek-volume-decr', 0.9], ['cheek/r-cheek-volume-decr', 0.9],
	['cheek/l-cheek-bones-incr', 0.6], ['cheek/r-cheek-bones-incr', 0.6],
	['eyes/l-eye-bag-incr', 0.7], ['eyes/r-eye-bag-incr', 0.7],
	['eyes/l-eye-push1-in', 0.5], ['eyes/r-eye-push1-in', 0.5],
	['stomach/stomach-pregnant-decr', 0.7],
	['torso/torso-muscle-pectoral-decr', 0.6],
];

export const BONE_PARENTS = {
	Root: null, Hips: 'Root', Spine: 'Hips', Chest: 'Spine', Neck: 'Chest', Head: 'Neck', Jaw: 'Head',
	'UpperArm.L': 'Chest', 'Forearm.L': 'UpperArm.L', 'Hand.L': 'Forearm.L',
	'UpperArm.R': 'Chest', 'Forearm.R': 'UpperArm.R', 'Hand.R': 'Forearm.R',
	'UpperLeg.L': 'Hips', 'LowerLeg.L': 'UpperLeg.L', 'Foot.L': 'LowerLeg.L',
	'UpperLeg.R': 'Hips', 'LowerLeg.R': 'UpperLeg.R', 'Foot.R': 'LowerLeg.R',
};
const BONE_NAMES = Object.keys(BONE_PARENTS);
const CENTER_BONES = new Set(['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Jaw']);

// Кость MakeHuman → наша кость (по ближайшему предку из таблицы).
const MH_MAP = {
	root: 'Hips', pelvis: 'Hips', spine05: 'Hips', spine04: 'Spine', spine03: 'Spine',
	spine02: 'Chest', spine01: 'Chest', clavicle: 'Chest', shoulder01: 'Chest', breast: 'Chest',
	upperarm01: 'UpperArm', upperarm02: 'UpperArm', lowerarm01: 'Forearm', lowerarm02: 'Forearm', wrist: 'Hand',
	upperleg01: 'UpperLeg', upperleg02: 'UpperLeg', lowerleg01: 'LowerLeg', lowerleg02: 'LowerLeg', foot: 'Foot',
	neck01: 'Neck', neck02: 'Neck', neck03: 'Neck', head: 'Head', jaw: 'Jaw',
};
// Где стоит наша кость: голова соответствующей кости MakeHuman.
const BONE_FROM_MH = {
	Hips: 'spine05', Spine: 'spine04', Chest: 'spine02', Neck: 'neck01', Head: 'head', Jaw: 'jaw',
	UpperArm: 'upperarm01', Forearm: 'lowerarm01', Hand: 'wrist', UpperLeg: 'upperleg01', LowerLeg: 'lowerleg01', Foot: 'foot',
};

const toLinear = (c) => c.map((v) => Math.min(1, Math.max(0, v)) ** 2.2);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const V = (a) => new THREE.Vector3(...a);

export function buildZombie({ textureSize = 1024 } = {}) {
	// ---------- 1. Базовая модель + морфы ----------
	const base = loadObj(join(MH, 'base.obj'));
	const pos = base.positions;
	for (const [file, w] of TARGETS) applyTarget(pos, join(MH, 'targets', `${file}.target`), w);
	const skel = loadSkeleton(join(MH, 'rigs/default.mhskel'));
	const eyes = fitProxy(join(MH, 'eyes/high-poly.mhclo'), join(MH, 'eyes/high-poly.obj'), pos);
	const nv = pos.length / 3;

	// дециметры → метры, ступни на земле, таз над началом координат
	const bodyFaces = base.groups.get('body');
	let minY = Infinity;
	for (const f of bodyFaces) for (const [v] of f) minY = Math.min(minY, pos[v * 3 + 1] * DM_TO_M);
	const hipsMH = jointPosition(skel, pos, skel.bones.spine05.head);
	const shift = [0, -minY, -hipsMH[2] * DM_TO_M];
	const toMeters = (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = arr[i] * DM_TO_M + shift[i % 3]; };
	toMeters(pos);
	toMeters(eyes.positions);

	// ---------- 2. Скелет и веса ----------
	const J = (mhBone) => jointPosition(skel, pos, skel.bones[mhBone].head);
	const restWorld = {};
	for (const name of BONE_NAMES) {
		if (name === 'Root') { restWorld[name] = [0, 0, 0]; continue; }
		const [stem, side] = name.split('.');
		const p = J(side ? `${BONE_FROM_MH[stem]}.${side}` : BONE_FROM_MH[stem]);
		if (CENTER_BONES.has(name)) p[0] = 0;
		restWorld[name] = p;
	}

	const mapBone = (mhName) => {
		let n = mhName;
		while (n) {
			const [stem, side] = n.split('.');
			if (MH_MAP[stem]) return CENTER_BONES.has(MH_MAP[stem]) ? MH_MAP[stem] : `${MH_MAP[stem]}.${side}`;
			n = skel.bones[n].parent;
		}
		return 'Hips';
	};
	const vertWeights = Array.from({ length: nv }, () => ({}));
	for (const [mhBone, list] of Object.entries(loadWeights(join(MH, 'rigs/default_weights.mhw')))) {
		const ours = mapBone(mhBone);
		for (const [v, w] of list) vertWeights[v][ours] = (vertWeights[v][ours] ?? 0) + w;
	}
	const dominant = vertWeights.map((w) => Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Head');

	// ---------- 3. Опускаем руки из A-позы, выпрямляем ноги ----------
	const bones = {};
	for (const name of BONE_NAMES) {
		const b = new THREE.Bone();
		b.name = name;
		const parent = BONE_PARENTS[name];
		const pw = parent ? restWorld[parent] : [0, 0, 0];
		b.position.set(...restWorld[name].map((v, i) => v - pw[i]));
		bones[name] = b;
		if (parent) bones[parent].add(b);
	}
	bones.Root.updateMatrixWorld(true);
	const restInverse = Object.fromEntries(BONE_NAMES.map((n) => [n, bones[n].matrixWorld.clone().invert()]));

	const worldQ = (name) => bones[name].getWorldQuaternion(new THREE.Quaternion());
	const aim = (name, childPoint, target) => {
		// поворачиваем кость в мире так, чтобы направление на childPoint совпало с target
		const parentQ = worldQ(BONE_PARENTS[name]);
		const restDir = V(childPoint).sub(V(restWorld[name])).normalize();
		const curQ = worldQ(name);
		const cur = restDir.clone().applyQuaternion(curQ);
		const wantQ = new THREE.Quaternion().setFromUnitVectors(cur, V(target).normalize()).multiply(curQ);
		bones[name].quaternion.copy(parentQ.invert().multiply(wantQ));
		bones.Root.updateMatrixWorld(true);
	};
	for (const [sx, s] of [[1, 'L'], [-1, 'R']]) {
		aim(`UpperArm.${s}`, restWorld[`Forearm.${s}`], [sx * 0.13, -1, 0.0]);
		aim(`Forearm.${s}`, restWorld[`Hand.${s}`], [sx * 0.05, -1, 0.16]);
		aim(`Hand.${s}`, J(`finger3-1.${s}`), [sx * 0.02, -1, 0.1]);
		aim(`UpperLeg.${s}`, restWorld[`LowerLeg.${s}`], [sx * 0.035, -1, 0.0]);
		aim(`LowerLeg.${s}`, restWorld[`Foot.${s}`], [sx * 0.01, -1, -0.03]);
		// ступня остаётся параллельной земле
		const parentQ = worldQ(`LowerLeg.${s}`);
		bones[`Foot.${s}`].quaternion.copy(parentQ.invert());
		bones.Root.updateMatrixWorld(true);
	}
	const skinMats = Object.fromEntries(BONE_NAMES.map((n) => [n, bones[n].matrixWorld.clone().multiply(restInverse[n])]));
	const tmp = new THREE.Vector3(), acc = new THREE.Vector3();
	const posed = new Float32Array(pos.length);
	for (let v = 0; v < nv; v++) {
		const w = vertWeights[v];
		const entries = Object.entries(w);
		tmp.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
		if (!entries.length) { posed.set(tmp.toArray(), v * 3); continue; }
		acc.set(0, 0, 0);
		let total = 0;
		for (const [b, wt] of entries) { acc.addScaledVector(tmp.clone().applyMatrix4(skinMats[b]), wt); total += wt; }
		acc.divideScalar(total);
		posed.set(acc.toArray(), v * 3);
	}
	const bindWorld = Object.fromEntries(BONE_NAMES.map((n) => [n, bones[n].getWorldPosition(new THREE.Vector3())]));
	// ступни могли чуть сместиться — снова ставим на землю
	let minPosed = Infinity;
	for (const f of bodyFaces) for (const [v] of f) minPosed = Math.min(minPosed, posed[v * 3 + 1]);
	for (let v = 0; v < nv; v++) posed[v * 3 + 1] -= minPosed;
	for (let i = 0; i < eyes.positions.length; i += 3) eyes.positions[i + 1] -= minPosed;
	for (const n of BONE_NAMES) if (n !== 'Root') bindWorld[n].y -= minPosed;

	// ---------- Нормали по вершинам базы (без швов развёртки) ----------
	const vnormals = vertexNormals(posed, bodyFaces, nv);
	const P = (v) => new THREE.Vector3(posed[v * 3], posed[v * 3 + 1], posed[v * 3 + 2]);
	const N = (v) => new THREE.Vector3(vnormals[v * 3], vnormals[v * 3 + 1], vnormals[v * 3 + 2]);

	// ---------- Ориентиры для текстур и одежды ----------
	const L = {
		hipsY: bindWorld.Hips.y,
		chest: bindWorld.Chest, neck: bindWorld.Neck, head: bindWorld.Head,
		mouth: groupCenter(base.groups.get('joint-mouth'), posed),
		eyeL: V(jointPosition(skel, posed, skel.bones['eye.L'].head)),
		eyeR: V(jointPosition(skel, posed, skel.bones['eye.R'].head)),
		shoulderL: bindWorld['UpperArm.L'], elbowR: bindWorld['Forearm.R'],
		kneeL: bindWorld['LowerLeg.L'], kneeR: bindWorld['LowerLeg.R'], ankleL: bindWorld['Foot.L'],
	};
	// Самая передняя точка поверхности тела около (x, y)
	const frontMost = (x, y, tol = 0.012) => {
		let best = null;
		for (const f of bodyFaces) for (const [v] of f) {
			const p = P(v);
			if (Math.abs(p.x - x) < tol && Math.abs(p.y - y) < tol && (!best || p.z > best.z)) best = p;
		}
		return best;
	};
	L.lips = frontMost(0, L.mouth.y, 0.008);
	const wound = frontMost(-0.075, L.chest.y + 0.12); // рана на груди справа (у персонажа)
	L.wound = wound;
	L.bite = frontMost(L.shoulderL.x - 0.01, L.shoulderL.y + 0.02, 0.015); // укус на левом плече

	const weightSum = (v, prefix) => Object.entries(vertWeights[v]).reduce((s, [b, w]) => s + (b.startsWith(prefix) ? w : 0), 0);

	// ---------- 4. Геометрия тела ----------
	const builder = new GeometryBuilder(base.uvs, vertWeights);
	// вмятина раны
	const bodyPos = posed.slice();
	for (let v = 0; v < nv; v++) {
		const d = P(v).distanceTo(wound);
		if (d < 0.05) {
			const k = (1 - smoothstep(0.012, 0.05, d)) * 0.016;
			for (let a = 0; a < 3; a++) bodyPos[v * 3 + a] -= vnormals[v * 3 + a] * k;
		}
	}
	const skinGeo = builder.build(bodyFaces, bodyPos, vnormals);
	const teethGeo = [];
	for (const g of ['helper-upper-teeth', 'helper-lower-teeth']) {
		const faces = base.groups.get(g);
		teethGeo.push(builder.build(faces, posed, vertexNormals(posed, faces, nv), () => [0.78, 0.7, 0.5]));
	}
	const tongueFaces = base.groups.get('helper-tongue');
	teethGeo.push(builder.build(tongueFaces, posed, vertexNormals(posed, tongueFaces, nv), () => [0.35, 0.12, 0.12]));
	teethGeo.push(ribsGeometry(wound, builder.boneIndex));

	// Глаза (прокси-меш): кость Head
	const eyeFaces = eyes.groups.get('default');
	const eyeGeo = new GeometryBuilder(eyes.uvs, null).build(eyeFaces, eyes.positions, vertexNormals(eyes.positions, eyeFaces, eyes.positions.length / 3), null, { Head: 1 }, builder.boneIndex);

	// ---------- 5. Одежда ----------
	const ragged = (p, amount, seed) => amount * (0.2 + 0.8 * fbm3(p.x * 28, p.y * 28, p.z * 28, 2, seed));
	const holeAt = (p, list) => list.some(({ c, r }) => c && p.distanceTo(c) < r * (0.6 + 0.8 * noise3(p.x * 50, p.y * 50, p.z * 50, 19)));
	const SHIRT_HOLES = [
		{ c: wound, r: 0.07 }, { c: L.bite, r: 0.05 },
		{ c: V([0.1, L.hipsY + 0.12, 0.1]), r: 0.04 }, { c: V([-0.06, L.chest.y + 0.05, -0.12]), r: 0.05 },
		{ c: V([0.08, L.chest.y + 0.22, -0.1]), r: 0.035 }, { c: V([-0.14, L.hipsY + 0.2, 0]), r: 0.03 },
	];
	const PANTS_HOLES = [
		{ c: V([L.kneeL.x, L.kneeL.y, L.kneeL.z + 0.05]), r: 0.045 },
		{ c: V([-0.14, L.hipsY - 0.25, 0.03]), r: 0.03 },
		{ c: V([0.05, L.hipsY - 0.12, -0.11]), r: 0.03 },
	];
	const neckCut = L.neck.y + 0.025;
	const inShirt = (v) => {
		const p = P(v), b = dominant[v];
		if (b === 'Neck' || b === 'Head' || b === 'Jaw') return p.y < neckCut - ragged(p, 0.01, 3);
		if (b === 'Chest' || b === 'Spine' || b === 'Hips') return p.y > L.hipsY + 0.03 + ragged(p, 0.07, 5) && p.y < neckCut;
		if (b === 'UpperArm.L') return p.y > L.shoulderL.y - 0.09 - ragged(p, 0.06, 7);
		if (b === 'UpperArm.R') return true;
		if (b === 'Forearm.R') return p.y > L.elbowR.y - 0.12 + ragged(p, 0.07, 9);
		return false;
	};
	const waist = L.hipsY + 0.075;
	const inPants = (v) => {
		const p = P(v), b = dominant[v];
		if (b === 'Hips' || b === 'Spine') return p.y < waist;
		if (b.startsWith('UpperLeg')) return true;
		if (b === 'LowerLeg.L') return p.y > L.ankleL.y + 0.06 + ragged(p, 0.04, 11);
		if (b === 'LowerLeg.R') return p.y > L.kneeR.y - 0.16 + ragged(p, 0.1, 13);
		return false;
	};
	const garment = (test, holes, inflateAt, tint) => {
		const keep = bodyFaces.filter((f) => f.every(([v]) => test(v)) && !holeAt(centroid(f, P), holes));
		const gp = posed.slice();
		for (let v = 0; v < nv; v++) {
			const p = P(v);
			const wr = (fbm3(p.x * 9, p.y * 9, p.z * 9, 3, 29) - 0.5) * 0.012;
			const off = inflateAt(p) + Math.max(0, wr);
			for (let a = 0; a < 3; a++) gp[v * 3 + a] += vnormals[v * 3 + a] * off;
		}
		return builder.build(keep, gp, vertexNormals(gp, keep, nv), (v) => tint(P(v)));
	};
	// рубашка свободнее на животе, джинсы расширяются книзу
	const shirtInflate = (p) => 0.009 + 0.016 * smoothstep(L.chest.y + 0.05, L.hipsY + 0.05, p.y) * (p.y < L.chest.y + 0.25 ? 1 : 0);
	const pantsInflate = (p) => 0.006 + 0.016 * smoothstep(L.kneeL.y + 0.15, L.ankleL.y, p.y);
	const shirtGeo = garment(inShirt, SHIRT_HOLES, shirtInflate, () => [0.5, 0.48, 0.42]);
	const pantsGeo = garment(inPants, PANTS_HOLES, pantsInflate, (p) => (p.y > waist - 0.03 ? [0.16, 0.11, 0.08] : [0.3, 0.37, 0.52]));

	// ---------- 6. Текстуры ----------
	const triAttrs = (v) => [weightSum(v, 'Hand'), weightSum(v, 'Foot'), weightSum(v, 'Forearm') + weightSum(v, 'Hand'), weightSum(v, 'Head') + weightSum(v, 'Jaw')];
	const skinTris = trianglesForBake(bodyFaces, base.uvs, (v) => P(v).toArray(), (v) => N(v).toArray(), triAttrs);
	const skinBake = bakeAtlas(textureSize, skinTris, (p, n, a) => skinShade(p, n, a, L));
	const clothBake = bakeAtlas(textureSize, skinTris, (p, n, a) => clothShade(p, n, a, L));
	const eyeImg = decodePNG(readFileSync(join(ROOT, 'assets/zombie_eye.png')));

	const materials = [
		new THREE.MeshStandardMaterial({ name: 'Skin', vertexColors: true, map: colorTexture(skinBake), normalMap: normalTexture(skinBake, 2.5), roughness: 0.58, metalness: 0 }),
		new THREE.MeshStandardMaterial({ name: 'Cloth', vertexColors: true, map: colorTexture(clothBake), normalMap: normalTexture(clothBake, 2.0), roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
		new THREE.MeshStandardMaterial({ name: 'Eye', vertexColors: true, map: makeTexture(eyeImg.data, eyeImg.width, true, eyeImg.height), roughness: 0.06, metalness: 0, alphaTest: 0.5 }),
		new THREE.MeshStandardMaterial({ name: 'Teeth', vertexColors: true, roughness: 0.35, metalness: 0 }),
	];

	const geometry = mergeGeometries([
		skinGeo,
		mergeGeometries([shirtGeo, pantsGeo]),
		eyeGeo,
		mergeGeometries(teethGeo),
	], true);
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	// ---------- Скелет в позе привязки (без поворотов) ----------
	const finalBones = {};
	for (const name of BONE_NAMES) {
		const b = new THREE.Bone();
		b.name = name;
		const parent = BONE_PARENTS[name];
		b.position.copy(bindWorld[name]);
		if (parent) b.position.sub(bindWorld[parent]);
		finalBones[name] = b;
		if (parent) finalBones[parent].add(b);
	}
	const boneList = BONE_NAMES.map((n) => finalBones[n]);
	const mesh = new THREE.SkinnedMesh(geometry, materials);
	mesh.name = 'ZombieMesh';
	mesh.add(finalBones.Root);
	mesh.bind(new THREE.Skeleton(boneList));
	const model = new THREE.Group();
	model.name = 'Zombie';
	model.add(mesh);
	const animations = createZombieAnimations(finalBones.Root);
	model.animations = animations;
	return { model, mesh, animations, landmarks: L };
}

// ---------- Вспомогательное ----------

function groupCenter(faces, positions) {
	const ids = new Set(faces.flatMap((f) => f.map(([v]) => v)));
	const c = new THREE.Vector3();
	for (const v of ids) c.add(new THREE.Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]));
	return c.divideScalar(ids.size);
}

function centroid(face, P) {
	const c = new THREE.Vector3();
	for (const [v] of face) c.add(P(v));
	return c.divideScalar(face.length);
}

function vertexNormals(positions, faces, nv) {
	const n = new Float32Array(nv * 3);
	const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
	const get = (v, out) => out.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
	for (const f of faces) {
		for (let k = 1; k < f.length - 1; k++) {
			get(f[0][0], a); get(f[k][0], b); get(f[k + 1][0], c);
			const fn = b.clone().sub(a).cross(c.clone().sub(a)); // площадь как вес
			for (const v of [f[0][0], f[k][0], f[k + 1][0]]) {
				n[v * 3] += fn.x; n[v * 3 + 1] += fn.y; n[v * 3 + 2] += fn.z;
			}
		}
	}
	for (let v = 0; v < nv; v++) {
		const l = Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]) || 1;
		n[v * 3] /= l; n[v * 3 + 1] /= l; n[v * 3 + 2] /= l;
	}
	return n;
}

function trianglesForBake(faces, uvs, P, N, A) {
	const tris = [];
	for (const f of faces) {
		for (let k = 1; k < f.length - 1; k++) {
			const c = [f[0], f[k], f[k + 1]];
			tris.push({
				p: c.map(([v]) => P(v)), n: c.map(([v]) => N(v)), a: c.map(([v]) => A(v)),
				uv: c.map(([, t]) => [uvs[t * 2], uvs[t * 2 + 1]]),
			});
		}
	}
	return tris;
}

class GeometryBuilder {
	constructor(uvs, vertWeights) {
		this.uvs = uvs;
		this.vertWeights = vertWeights;
		this.boneIndex = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));
	}

	skin(weights, boneIndex = this.boneIndex) {
		const e = Object.entries(weights).filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
		const total = e.reduce((s, [, w]) => s + w, 0) || 1;
		const idx = [0, 0, 0, 0], wts = [0, 0, 0, 0];
		e.forEach(([b, w], i) => { idx[i] = boneIndex[b]; wts[i] = w / total; });
		if (!e.length) { idx[0] = boneIndex.Head; wts[0] = 1; }
		return [idx, wts];
	}

	/** Грани OBJ → индексированная геометрия; вершины делятся по парам (вершина, UV). */
	build(faces, positions, normals, color, fixedWeights, boneIndex = this.boneIndex) {
		const map = new Map();
		const P = [], Nn = [], U = [], C = [], SI = [], SW = [], index = [];
		const vertex = (v, t) => {
			const key = v * 100000 + t;
			let i = map.get(key);
			if (i !== undefined) return i;
			i = P.length / 3;
			map.set(key, i);
			P.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
			Nn.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
			// OBJ: v вверх; glTF: v вниз (0 — верх картинки)
			U.push(t >= 0 ? this.uvs[t * 2] : 0, t >= 0 ? 1 - this.uvs[t * 2 + 1] : 0);
			C.push(...toLinear(color ? color(v) : [1, 1, 1]));
			const [idx, wts] = this.skin(fixedWeights ?? this.vertWeights[v], boneIndex);
			SI.push(...idx); SW.push(...wts);
			return i;
		};
		for (const f of faces) {
			const ids = f.map(([v, t]) => vertex(v, t));
			for (let k = 1; k < ids.length - 1; k++) index.push(ids[0], ids[k], ids[k + 1]);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
		g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
		g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
		g.setIndex(index);
		return g;
	}
}

// Три ребра, торчащие из раны на груди.
function ribsGeometry(wound, boneIndex) {
	const parts = [];
	for (const dy of [-0.022, 0, 0.022]) {
		const pts = [-0.032, -0.012, 0.01, 0.03].map((dx, i) => new THREE.Vector3(wound.x + dx, wound.y + dy + (i === 1 || i === 2 ? 0.003 : 0), wound.z - 0.011 + (i === 1 || i === 2 ? 0.004 : 0)));
		const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0035, 6, false);
		const n = g.attributes.position.count;
		g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => toLinear([0.62, 0.48, 0.4])).flat(), 3));
		g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: n }, () => [boneIndex.Chest, 0, 0, 0]).flat(), 4));
		g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [1, 0, 0, 0]).flat(), 4));
		parts.push(g);
	}
	return mergeGeometries(parts);
}

// ---------- Шейдинг для запекания (цвета в sRGB) ----------

const BLOOD = [0.38, 0.03, 0.025], DRIED = [0.2, 0.04, 0.03];

function bloodAmount(p, n, a, L) {
	let b = 0;
	const spot = (c, r) => (c ? 1 - smoothstep(r * 0.3, r, p.distanceTo(c)) : 0);
	b = Math.max(b, L.lips ? spot(L.lips.clone().setY(L.lips.y - 0.012), 0.03) : 0);
	b = Math.max(b, spot(L.wound, 0.075));
	b = Math.max(b, spot(L.bite, 0.05) * 1.1);
	// потёки изо рта по подбородку, шее и груди
	if (n.z > 0.1 && p.y < L.mouth.y && p.y > L.chest.y) {
		const wob = (noise3(p.x * 20, p.y * 18, 4.2, 6) - 0.5) * 0.025;
		const streak = smoothstep(0.62, 0.74, noise3((p.x + wob) * 70, p.y * 4, 1.7, 5)) * (1 - smoothstep(0.02, 0.07, Math.abs(p.x - 0.01))) * 0.8;
		b = Math.max(b, streak * smoothstep(L.chest.y, L.neck.y, p.y));
	}
	// под раной кровь стекает вниз
	if (L.wound && n.z > 0 && p.y < L.wound.y && Math.abs(p.x - L.wound.x) < 0.05) {
		const streak = smoothstep(0.5, 0.68, noise3(p.x * 80, p.y * 4, 9.1, 7)) * smoothstep(L.wound.y - 0.35, L.wound.y - 0.02, p.y);
		b = Math.max(b, streak);
	}
	// руки в крови до локтя
	b = Math.max(b, (a[0] * 0.9 + a[2] * 0.25) * smoothstep(0.5, 0.66, fbm3(p.x * 22, p.y * 22, p.z * 22, 3, 9)));
	return b * smoothstep(0.25, 0.5, fbm3(p.x * 45, p.y * 45, p.z * 45, 2, 3) + b * 0.3);
}

function skinShade(p, n, a, L) {
	const f = (s, oct, seed) => fbm3(p.x * s, p.y * s, p.z * s, oct, seed);
	const base = f(5, 3, 1);
	let c = mix([0.58, 0.61, 0.5], [0.43, 0.48, 0.39], base);
	c = c.map((v, i) => v * (0.9 + 0.18 * f(30, 2, 7 + i)));
	const bruise = smoothstep(0.58, 0.72, f(7, 3, 13));
	c = mix(c, [0.48, 0.38, 0.46], bruise * 0.45);
	const rot = smoothstep(0.64, 0.76, f(11, 4, 21));
	c = mix(c, [0.36, 0.33, 0.22], rot * 0.65);
	const vr = 1 - Math.abs(f(14, 4, 33) * 2 - 1);
	const vein = smoothstep(0.955, 0.99, vr) * smoothstep(0.45, 0.65, f(4, 2, 41));
	c = mix(c, [0.32, 0.3, 0.42], vein * 0.6);
	const pore = smoothstep(0.75, 0.95, noise3(p.x * 1400, p.y * 1400, p.z * 1400, 51));
	c = c.map((v) => v * (1 - pore * 0.06));

	// лицо: тёмные впалые круги вокруг глаз, тёмные губы, остатки волос
	for (const e of [L.eyeL, L.eyeR]) {
		const d = Math.hypot((p.x - e.x) / 1.2, p.y - e.y + 0.004, (p.z - e.z) * 0.6);
		c = mix(c, [0.36, 0.22, 0.26], (1 - smoothstep(0.012, 0.035, d)) * 0.8);
	}
	if (L.lips) {
		const d = Math.hypot((p.x - L.lips.x) / 2.2, p.y - L.lips.y, (p.z - L.lips.z) * 0.5);
		c = mix(c, [0.36, 0.17, 0.17], (1 - smoothstep(0.004, 0.012, d)) * 0.85);
	}
	const scalp = smoothstep(L.eyeL.y + 0.05, L.eyeL.y + 0.08, p.y) * (n.z < 0.6 ? 1 : 0.4);
	// редкие остатки волос: щетина по маске больших залысин
	const hairMask = smoothstep(0.42, 0.55, fbm3(p.x * 14, p.y * 14, p.z * 14, 3, 47)) * scalp;
	const stubble = smoothstep(0.45, 0.8, noise3(p.x * 900, p.y * 900, p.z * 900, 49));
	c = mix(c, [0.2, 0.19, 0.17], hairMask * (0.25 + stubble * 0.5));

	// ногти и пальцы грязные, ступни в грязи
	const tips = a[0] * smoothstep(0.92, 0.98, a[0]);
	c = mix(c, [0.3, 0.25, 0.2], tips * 0.5);
	c = mix(c, [0.32, 0.27, 0.2], a[1] * 0.55 + smoothstep(0.03, 0.0, p.y) * 0.35);

	// рана
	let height = base * 0.4 + vein * 0.5 - rot * 0.8 - pore * 0.08 + f(40, 2, 61) * 0.3;
	if (L.wound) {
		const d = p.distanceTo(L.wound);
		const w = 1 - smoothstep(0.015, 0.045, d);
		c = mix(c, [0.24, 0.03, 0.03], w);
		c = mix(c, [0.08, 0.01, 0.01], 1 - smoothstep(0.006, 0.02, d));
		height -= w * 1.5;
	}
	if (L.bite) {
		const d = p.distanceTo(L.bite);
		const marks = (1 - smoothstep(0.02, 0.028, d)) * smoothstep(0.012, 0.018, d) * smoothstep(0.4, 0.6, noise3(p.x * 300, p.y * 300, p.z * 300, 77));
		c = mix(c, [0.2, 0.03, 0.03], marks);
		height -= marks;
	}
	const bl = bloodAmount(p, n, a, L);
	c = mix(c, mix(BLOOD, DRIED, 0.35 + 0.65 * f(25, 2, 11)), bl);
	height += bl * 0.2;
	return { color: c, height };
}

function clothShade(p, n, a, L) {
	const f = (s, oct, seed) => fbm3(p.x * s, p.y * s, p.z * s, oct, seed);
	let l = 0.88 + (noise3(p.x * 900, p.y * 900, p.z * 900, 97) - 0.5) * 0.08;
	l *= 1 - 0.28 * smoothstep(0.4, 0.8, f(6, 4, 71));
	let c = [l, l, l];
	const stain = smoothstep(0.6, 0.75, f(9, 4, 83));
	c = mix(c, [l * 0.6, l * 0.48, l * 0.36], stain * 0.8);
	c = mix(c, [0.45, 0.38, 0.28], smoothstep(0.45, 0.05, p.y) * 0.6); // грязь снизу
	const bl = bloodAmount(p, n, [0, 0, 0, 0], L) * 0.95;
	c = mix(c, [0.55, 0.07, 0.06], bl); // ткань тонируется цветом вершин, поэтому кровь светлее
	const grain = noise3(p.x * 1200, p.y * 1200, p.z * 1200, 93) * 0.12;
	return { color: c, height: grain + f(12, 3, 91) * 2.2 - stain * 0.2 };
}
