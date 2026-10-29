// Профили персонажей для игры: герой (игрок) и топтун.
// Бегун — исходный зомби (RUNNER_PROFILE в build-zombie.mjs).

import { fbm3, noise3, smoothstep } from '../../src/noise.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createZombieAnimations, createStompAnimation } from '../../src/animations.js';
import { createHeroAnimations } from '../../src/hero-animations.js';
import { AXE_GRIP_TILT } from '../../game/weapons.js';
import { RUNNER_PROFILE, bloodAmount, BLOOD, DRIED, skinShade } from './build-zombie.mjs';

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const f3 = (p, s, oct, seed) => fbm3(p.x * s, p.y * s, p.z * s, oct, seed);

// ---------- Кожа человека и камуфляж «горки» (для героя) ----------

function humanSkin(p, n, a, L) {
	const base = f3(p, 5, 3, 1);
	let c = mix([0.86, 0.68, 0.58], [0.74, 0.56, 0.46], base);
	c = c.map((v, i) => v * (0.95 + 0.08 * f3(p, 30, 2, 7 + i)));
	const pore = smoothstep(0.75, 0.95, noise3(p.x * 1400, p.y * 1400, p.z * 1400, 51));
	c = c.map((v) => v * (1 - pore * 0.05));
	const head = a[3];
	// румянец на щеках и носу, загар/обветренность лица
	if (head > 0.5 && n.z > 0.2) {
		const cheek = Math.max(...[-1, 1].map((sx) => 1 - smoothstep(0.01, 0.03, Math.hypot(p.x - sx * 0.04, p.y - L.eyeL.y + 0.03))));
		c = mix(c, [0.82, 0.5, 0.45], cheek * 0.25);
	}
	// короткая стрижка: тёмная «щётка» на всём скальпе
	const scalp = smoothstep(L.eyeL.y + 0.045, L.eyeL.y + 0.065, p.y) * (n.z < 0.75 ? 1 : 0) * smoothstep(0.4, 0.6, head);
	const back = (n.z < -0.2 ? 1 : 0) * smoothstep(L.mouth.y - 0.02, L.mouth.y + 0.03, p.y) * smoothstep(0.4, 0.6, head);
	const hairDots = smoothstep(0.3, 0.7, noise3(p.x * 1100, p.y * 1100, p.z * 1100, 49));
	const hair = Math.max(scalp, back);
	c = mix(c, [0.16, 0.12, 0.09], hair * (0.7 + hairDots * 0.25));
	// щетина на подбородке и щеках
	if (L.lips && head > 0.5 && n.z > -0.1 && p.y < L.eyeL.y - 0.045 && p.y > L.lips.y - 0.06) {
		const beard = smoothstep(L.eyeL.y - 0.045, L.eyeL.y - 0.065, p.y) * (1 - smoothstep(0.0, 0.006, Math.hypot((p.x - L.lips.x) / 2.4, p.y - L.lips.y)));
		c = mix(c, [0.32, 0.24, 0.2], Math.max(0, beard) * (0.35 + 0.35 * hairDots));
	}
	// брови
	for (const e of [L.eyeL, L.eyeR]) {
		const brow = (1 - smoothstep(0.002, 0.006, Math.abs(p.y - e.y - 0.021 + (p.x - e.x) * (p.x - e.x) * 4))) * (1 - smoothstep(0.016, 0.026, Math.abs(p.x - e.x))) * (n.z > 0.3 ? 1 : 0);
		c = mix(c, [0.18, 0.13, 0.1], brow * 0.85);
	}
	if (L.lips) {
		const d = Math.hypot((p.x - L.lips.x) / 2.2, p.y - L.lips.y, (p.z - L.lips.z) * 0.5);
		c = mix(c, [0.72, 0.44, 0.42], (1 - smoothstep(0.004, 0.011, d)) * 0.7);
	}
	// пыль и грязь на руках
	c = mix(c, [0.55, 0.47, 0.4], a[0] * smoothstep(0.5, 0.7, f3(p, 25, 2, 9)) * 0.4);
	return { color: c, height: base * 0.3 - pore * 0.06 + f3(p, 40, 2, 61) * 0.2 + hair * hairDots * 0.3 };
}

// Камуфляж «горки»: светлая ткань с пятнами (цвет задают вершины)
function camoCloth(p, n, a, L) {
	const grain = noise3(p.x * 1200, p.y * 1200, p.z * 1200, 93) * 0.1;
	const blobA = smoothstep(0.52, 0.56, f3(p, 7, 3, 101));
	const blobB = smoothstep(0.55, 0.59, f3(p, 9, 3, 107));
	let l = 0.92 - blobA * 0.22 - blobB * 0.16 + grain - 0.05;
	let c = [l, l * 1.01, l * 0.96];
	c = mix(c, [0.62, 0.55, 0.45], smoothstep(0.35, 0.05, p.y) * 0.5); // пыль на штанинах
	c = mix(c, c.map((v) => v * 0.8), smoothstep(0.55, 0.8, f3(p, 6, 4, 71)) * 0.6);
	const seam = smoothstep(0.985, 1, 1 - Math.abs(Math.sin(p.y * 70))) * 0.08;
	return { color: c.map((v) => v - seam), height: grain * 2 + f3(p, 11, 3, 91) * 2.6 - blobA * 0.1 };
}

// ---------- Топтун: массивный заражённый с роговыми наростами ----------

const STOMPER_TARGETS = [
	['macrodetails/universal-male-young-maxmuscle-maxweight', 0.55],
	['macrodetails/universal-male-young-maxmuscle-averageweight', 0.45],
	['macrodetails/caucasian-male-young', 1],
	['macrodetails/height/male-young-maxmuscle-maxweight-maxheight', 0.8],
	['armslegs/l-hand-scale-incr', 1], ['armslegs/r-hand-scale-incr', 1],
	['armslegs/l-hand-fingers-length-incr', 0.8], ['armslegs/r-hand-fingers-length-incr', 0.8],
	['armslegs/l-lowerarm-muscle-incr', 1], ['armslegs/r-lowerarm-muscle-incr', 1],
	['armslegs/l-upperarm-muscle-incr', 1], ['armslegs/r-upperarm-muscle-incr', 1],
	['armslegs/l-lowerarm-scale-vert-incr', 0.5], ['armslegs/r-lowerarm-scale-vert-incr', 0.5],
	['cheek/l-cheek-volume-decr', 0.6], ['cheek/r-cheek-volume-decr', 0.6],
	['eyes/l-eye-push1-in', 0.8], ['eyes/r-eye-push1-in', 0.8],
];

// Роговые пластины: на спине, плечах, предплечьях и затылке
function plateMask(p, n, arm, head) {
	const region = Math.max(smoothstep(0.1, -0.4, n.z) * smoothstep(0.7, 1.0, p.y), arm * 0.9, head * smoothstep(0.2, -0.5, n.z));
	return smoothstep(0.5, 0.6, f3(p, 8, 3, 211)) * region;
}

function stomperGrowths(p, n, arm, head) {
	const plates = plateMask(p, n, arm, head);
	const lump = smoothstep(0.58, 0.72, f3(p, 4, 3, 223)) * smoothstep(0.1, -0.4, n.z) * smoothstep(1.0, 1.4, p.y);
	return plates * 0.009 + lump * 0.035;
}

function stomperSkin(p, n, a, L) {
	const r = skinShade(p, n, a, L);
	let c = r.color.map((v, i) => v * [0.55, 0.53, 0.52][i]);
	c = mix(c, [0.3, 0.28, 0.25], 0.45);
	const plates = plateMask(p, n, a[2], a[3]);
	const crack = smoothstep(0.93, 0.99, 1 - Math.abs(f3(p, 22, 3, 229) * 2 - 1));
	c = mix(c, [0.14, 0.12, 0.1], plates * 0.9);
	c = mix(c, [0.08, 0.06, 0.05], plates * crack);
	// вздутые тёмные вены
	const vr = 1 - Math.abs(f3(p, 10, 4, 233) * 2 - 1);
	const vein = smoothstep(0.972, 0.992, vr) * (1 - plates) * smoothstep(0.4, 0.6, f3(p, 3, 2, 239));
	c = mix(c, [0.22, 0.1, 0.12], vein * 0.6);
	// много крови у пасти и на руках
	const bl = Math.min(1, bloodAmount(p, n, [a[0], a[1], Math.min(1, a[2] * 1.6), a[3]], L) * 1.3);
	c = mix(c, mix(BLOOD, DRIED, 0.5), bl * 0.6);
	return { color: c, height: r.height + plates * 1.4 - plates * crack * 1.6 + vein * 0.6 };
}

function stomperGarments({ P, dominant, L, ragged, V }) {
	const waist = L.hipsY + 0.06;
	return [{
		// остатки штанов — рваные шорты
		test: (v) => {
			const p = P(v), b = dominant[v];
			if (b === 'Hips' || b === 'Spine') return p.y < waist - ragged(p, 0.03, 31);
			if (b.startsWith('UpperLeg')) return p.y > L.kneeL.y + 0.1 + ragged(p, 0.16, 37);
			return false;
		},
		holes: [
			{ c: V([0.12, L.hipsY - 0.18, 0.09]), r: 0.05 },
			{ c: V([-0.1, L.hipsY - 0.05, -0.12]), r: 0.06 },
			{ c: V([-0.16, L.hipsY - 0.24, 0.0]), r: 0.04 },
		],
		inflate: () => 0.01,
		tint: () => [0.28, 0.27, 0.28],
	}];
}

export const STOMPER_PROFILE = {
	name: 'Stomper',
	targets: STOMPER_TARGETS,
	wounds: false,
	growths: stomperGrowths,
	garments: stomperGarments,
	skin: stomperSkin,
	cloth: RUNNER_PROFILE.cloth,
	eye: 'assets/zombie_eye.png',
	// топтун тяжёлый: в погоне идёт своим тяжёлым шагом, а не шаркает
	animations: (root, o) => [...createZombieAnimations(root, o), createStompAnimation(root)],
};

// ---------- Герой (новый игрок): полный скелет 56 костей, снаряжение, крепления оружия ----------

const HERO_TARGETS = [
	['macrodetails/universal-male-young-averagemuscle-averageweight', 0.4],
	['macrodetails/universal-male-young-maxmuscle-averageweight', 0.6],
	['macrodetails/caucasian-male-young', 1],
	['macrodetails/height/male-young-averagemuscle-averageweight-maxheight', 0.35],
	['cheek/l-cheek-bones-incr', 0.35], ['cheek/r-cheek-bones-incr', 0.35],
];

// Поворот «системы хвата» (как в game/weapons.js): +Z — топорище/рукоять, −Y — лезвие/ствол
function gripQuat(handle, blade) {
	const Z = new THREE.Vector3(...handle).normalize();
	const B = new THREE.Vector3(...blade);
	const Y = B.addScaledVector(Z, -B.dot(Z)).normalize().negate();
	const X = new THREE.Vector3().crossVectors(Y, Z);
	return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

/** Точки крепления оружия на теле — те же, к которым тянется рука в анимациях смены оружия. */
export function heroMountSpots(L, hipsY, shoulderR) {
	return {
		// топор в петле на левом бедре, как меч: кулак спереди у бедра, топорище назад-вверх, голова за бедром,
		// лезвие наружу. Правая рука берёт его поперёк тела большим пальцем к голове — без перекрута предплечья.
		axe: { bone: 'LeftUpLeg', pos: new THREE.Vector3(0.17, hipsY - 0.02, 0.12), handle: [0, 0.35, -0.94], blade: [1, 0, 0] },
		// пистолет в набедренной кобуре справа: ствол вниз, рукоять вперёд
		pistol: { bone: 'RightUpLeg', pos: new THREE.Vector3(shoulderR.x - 0.06, hipsY - 0.1, 0.04), handle: [0, 0.2, 1], blade: [0, -1, 0.2] },
		// автомат на ремне за правым плечом стволом вниз: рукоять сзади у правого бедра, верх наружу
		back: { bone: 'Hips', pos: new THREE.Vector3(shoulderR.x - 0.02, hipsY + 0.03, -0.21), handle: [-1, 0, -0.1], blade: [0, -0.97, -0.25] },
	};
}

function heroGarments({ P, N, dominant, L, smoothstep }) {
	const neckCut = L.neck.y + 0.03;
	const waist = L.hipsY + 0.08;
	const ankle = L.ankleL.y;
	const isArm = (b) => b.startsWith('UpperArm') || b.startsWith('Forearm');
	return [
		{ // куртка «горка»
			test: (v) => {
				const p = P(v), b = dominant[v];
				if (b === 'Neck' || b === 'Head' || b === 'Jaw' || b === 'Chest' || b === 'Spine') return p.y < neckCut;
				if (b === 'Hips') return p.y > L.hipsY - 0.06;
				return isArm(b);
			},
			inflate: (p, v) => 0.012 + (isArm(dominant[v]) ? 0.007 : 0.004),
			tint: () => [0.44, 0.46, 0.34],
		},
		{ // штаны
			test: (v) => {
				const p = P(v), b = dominant[v];
				if (b === 'Hips' || b === 'Spine') return p.y < waist;
				if (b.startsWith('UpperLeg')) return true;
				if (b.startsWith('LowerLeg')) return p.y > ankle + 0.12;
				return false;
			},
			inflate: (p) => 0.01 + 0.008 * smoothstep(L.kneeL.y, ankle + 0.1, p.y),
			tint: () => [0.41, 0.43, 0.32],
		},
		{ // берцы с толстой подошвой
			test: (v) => { const p = P(v), b = dominant[v]; return b.startsWith('Foot') || (b.startsWith('LowerLeg') && p.y < ankle + 0.17); },
			inflate: (p) => 0.007 + (p.y < 0.03 ? 0.006 : 0),
			tint: (p) => (p.y < 0.03 ? [0.06, 0.055, 0.05] : [0.16, 0.13, 0.1]),
		},
		{ // плитник
			test: (v) => { const p = P(v), b = dominant[v]; return (b === 'Chest' || b === 'Spine') && p.y > L.hipsY + 0.1 && p.y < L.chest.y + 0.27; },
			inflate: () => 0.032,
			tint: (p) => (Math.abs(p.y - L.chest.y - 0.05) < 0.008 ? [0.12, 0.12, 0.1] : [0.32, 0.33, 0.25]),
		},
		{ // ремень
			test: (v) => { const p = P(v), b = dominant[v]; return (b === 'Hips' || b === 'Spine') && Math.abs(p.y - (L.hipsY + 0.07)) < 0.022; },
			inflate: () => 0.016,
			tint: () => [0.1, 0.09, 0.08],
		},
		{ // перчатки
			test: (v) => dominant[v].startsWith('Hand'),
			inflate: () => 0.0026,
			tint: () => [0.12, 0.115, 0.1],
		},
		{ // вязаная шапка
			test: (v) => {
				const p = P(v), n = N(v), b = dominant[v];
				return (b === 'Head') && p.y > L.eyeL.y + 0.035 && !(n.z > 0.45 && p.y < L.eyeL.y + 0.068);
			},
			inflate: (p) => 0.007 + 0.002 * Math.sin(p.y * 900) ** 2,
			tint: () => [0.2, 0.22, 0.17],
		},
		{ // шарф-шемаг на шее
			test: (v) => { const p = P(v), b = dominant[v]; return b === 'Neck' || ((b === 'Chest' || b === 'Head') && p.y > L.neck.y - 0.03 && p.y < L.neck.y + 0.07 && p.z < L.neck.z + 0.09); },
			inflate: (p) => 0.02 + 0.006 * Math.sin(p.y * 160 + p.x * 40),
			tint: () => [0.55, 0.5, 0.39],
		},
	];
}

function heroGear({ L, frontMost, backMost, bindWorld }) {
	const parts = [];
	const add = (geo, x, y, z, bone, color, rot) => {
		if (rot) geo.applyQuaternion(rot);
		geo.translate(x, y, z);
		parts.push({ geo, bone, color });
	};
	const box = (w, h, d, r = 0.008) => new RoundedBoxGeometry(w, h, d, 2, r);
	const vest = 0.032 + 0.004;
	// подсумки под магазины на груди
	const py = L.chest.y + 0.04;
	for (const x of [-0.075, 0, 0.075]) {
		const f = frontMost(x, py, 0.02);
		add(box(0.064, 0.12, 0.036), x, py, f.z + vest + 0.02, 'Spine1', [0.3, 0.32, 0.24]);
	}
	// рация слева сверху с антенной
	const ry = L.chest.y + 0.18, rf = frontMost(0.1, ry, 0.02);
	add(box(0.05, 0.09, 0.04), 0.1, ry, rf.z + vest + 0.02, 'Spine2', [0.12, 0.12, 0.11]);
	add(new THREE.CylinderGeometry(0.004, 0.005, 0.2, 6), 0.115, ry + 0.14, rf.z + vest + 0.02, 'Spine2', [0.08, 0.08, 0.08]);
	// рюкзак со скаткой
	const by = bindWorld.Spine2.y, bz = backMost(0, by, 0.03).z - 0.03 - 0.058;
	add(box(0.3, 0.4, 0.15, 0.03), 0, by, bz, 'Spine2', [0.3, 0.31, 0.24]);
	add(box(0.22, 0.13, 0.05, 0.015), 0, by - 0.1, bz - 0.09, 'Spine2', [0.27, 0.28, 0.21]);
	add(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 12), 0, by + 0.25, bz + 0.01, 'Spine2', [0.24, 0.26, 0.2], new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)));
	// наколенники
	for (const [side, bone] of [[1, 'LeftLeg'], [-1, 'RightLeg']]) {
		const k = bindWorld[bone];
		const f = frontMost(k.x, k.y - 0.03, 0.02);
		add(box(0.1, 0.13, 0.034, 0.012), k.x, k.y - 0.03, f.z + 0.026, bone, [0.14, 0.14, 0.13]);
	}
	// кобура на правом бедре (вокруг точки крепления пистолета) и ремешок
	const spot = heroMountSpots(L, L.hipsY, L.shoulderR).pistol;
	const q = gripQuat(spot.handle, spot.blade);
	const holster = box(0.044, 0.17, 0.07, 0.01);
	holster.translate(0, -0.05, 0.065);
	add(holster, spot.pos.x, spot.pos.y, spot.pos.z, 'RightUpLeg', [0.14, 0.13, 0.11], q);
	const thigh = bindWorld.RightUpLeg;
	add(new THREE.TorusGeometry(0.088, 0.008, 6, 20), thigh.x - 0.005, L.hipsY - 0.22, thigh.z + 0.01, 'RightUpLeg', [0.1, 0.1, 0.09], new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
	// петля для топора на ремне слева, сбоку бедра — через неё проходит топорище за кулаком
	const ax = heroMountSpots(L, L.hipsY, L.shoulderR).axe;
	const hd = new THREE.Vector3(...ax.handle).normalize();
	const loop = ax.pos.clone().addScaledVector(hd, 0.12);
	add(box(0.02, 0.07, 0.045, 0.008), loop.x + 0.02, loop.y, loop.z, 'LeftUpLeg', [0.2, 0.15, 0.1]);
	return parts;
}

function heroMounts({ L }) {
	const spots = heroMountSpots(L, L.hipsY, L.shoulderR);
	return [
		// у топора топорище в кулаке наклонено: узел — оси кулака, топор в нём повёрнут на AXE_GRIP_TILT
		{ name: 'AxeMount', bone: spots.axe.bone, pos: spots.axe.pos, quat: gripQuat(spots.axe.handle, spots.axe.blade).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(AXE_GRIP_TILT))) },
		{ name: 'HolsterMount', bone: spots.pistol.bone, pos: spots.pistol.pos, quat: gripQuat(spots.pistol.handle, spots.pistol.blade) },
		{ name: 'BackMount', bone: spots.back.bone, pos: spots.back.pos, quat: gripQuat(spots.back.handle, spots.back.blade) },
	];
}

export const HERO_PROFILE = {
	name: 'Hero',
	rig: 'mixamo',
	targets: HERO_TARGETS,
	wounds: false,
	garments: heroGarments,
	gear: heroGear,
	mounts: heroMounts,
	skin: humanSkin,
	cloth: camoCloth,
	eye: 'assets/human_eye.png',
	animations: createHeroAnimations,
};

export { RUNNER_PROFILE };
