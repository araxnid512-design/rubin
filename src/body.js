// Геометрия зомби: скелет и органический меш с плавным скиннингом.
// Тело собирается из «трубок» (туловище, руки, ноги, пальцы) с переменным сечением,
// голова — деформированная сфера с глазницами, скулами, носом и отдельной челюстью.
// Одежда — те же трубки, чуть «надутые», с вырезанными дырами и рваными краями.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm3, noise3, rng, smoothstep } from './noise.js';

// Скелет: [имя, родитель, позиция относительно родителя]. Персонаж смотрит в +Z, рост ~1.85 м.
export const BONES = [
	['Root', null, [0, 0, 0]],
	['Hips', 'Root', [0, 1.0, 0]],
	['Spine', 'Hips', [0, 0.1, 0]],
	['Chest', 'Spine', [0, 0.2, 0]],
	['Neck', 'Chest', [0, 0.27, 0]],
	['Head', 'Neck', [0, 0.08, 0]],
	['Jaw', 'Head', [0, 0.06, 0]],
	['UpperArm.L', 'Chest', [0.2, 0.22, 0]],
	['Forearm.L', 'UpperArm.L', [0, -0.3, 0]],
	['Hand.L', 'Forearm.L', [0, -0.27, 0]],
	['UpperArm.R', 'Chest', [-0.2, 0.22, 0]],
	['Forearm.R', 'UpperArm.R', [0, -0.3, 0]],
	['Hand.R', 'Forearm.R', [0, -0.27, 0]],
	['UpperLeg.L', 'Hips', [0.11, -0.05, 0]],
	['LowerLeg.L', 'UpperLeg.L', [0, -0.45, 0]],
	['Foot.L', 'LowerLeg.L', [0, -0.43, 0]],
	['UpperLeg.R', 'Hips', [-0.11, -0.05, 0]],
	['LowerLeg.R', 'UpperLeg.R', [0, -0.45, 0]],
	['Foot.R', 'LowerLeg.R', [0, -0.43, 0]],
];

export const MATERIAL_SLOTS = ['skin', 'cloth', 'eye', 'teeth'];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mixColor = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
// Цвета в коде заданы «как на экране» (sRGB), а вершинные цвета в three.js/glTF — линейные.
const toLinear = (col) => col.map((c) => THREE.MathUtils.clamp(c, 0, 1) ** 2.2);

const BLOOD = [0.36, 0.035, 0.03];
const DRIED = [0.22, 0.05, 0.035];

// Кровь: 0..1 в точке мира (общая для кожи и ткани).
const BLOOD_SPOTS = [
	{ c: V(0, 1.64, 0.085), r: 0.05 }, // рот и подбородок
	{ c: V(-0.08, 1.36, 0.1), r: 0.08 }, // рана на груди
	{ c: V(0.19, 1.49, 0.05), r: 0.05 }, // укус на плече
	{ c: V(-0.12, 0.72, 0.07), r: 0.07 }, // бедро
	{ c: V(0.03, 1.75, 0.08), r: 0.03 }, // рассечение на лбу
];
function bloodAt(p, arms = false) {
	let a = 0;
	for (const { c, r } of BLOOD_SPOTS) {
		const d = p.distanceTo(c);
		if (d < r) a = Math.max(a, 1 - smoothstep(r * 0.3, r, d));
	}
	// Подтёки изо рта по шее и груди
	if (p.z > 0.02 && p.y > 1.38 && p.y < 1.66) {
		const streak = smoothstep(0.58, 0.72, noise3(p.x * 70, p.y * 4, 3.1, 5));
		a = Math.max(a, streak * smoothstep(1.38, 1.55, p.y) * (1 - smoothstep(0.04, 0.09, Math.abs(p.x - 0.01))));
	}
	// Руки и предплечья по локоть в крови
	if (arms && p.y < 1.12) {
		a = Math.max(a, smoothstep(1.12, 0.95, p.y) * smoothstep(0.42, 0.62, fbm3(p.x * 25, p.y * 25, p.z * 25, 2, 9)));
	}
	return a * smoothstep(0.25, 0.55, fbm3(p.x * 40, p.y * 40, p.z * 40, 2, 3) + a * 0.35);
}

function applyBlood(col, p, strength = 1, arms = false) {
	const b = bloodAt(p, arms) * strength;
	if (b <= 0) return col;
	const dry = noise3(p.x * 30, p.y * 30, p.z * 30, 11);
	return mixColor(col, mixColor(BLOOD, DRIED, dry), b);
}

function catmull(p0, p1, p2, p3, t) {
	const t2 = t * t, t3 = t2 * t;
	return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

class BodyBuilder {
	constructor(boneList) {
		this.boneIndex = Object.fromEntries(boneList.map((b, i) => [b.name, i]));
		this.parts = Object.fromEntries(MATERIAL_SLOTS.map((s) => [s, []]));
	}

	skinData(weights) {
		const entries = Object.entries(weights).filter(([, w]) => w > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
		const total = entries.reduce((s, [, w]) => s + w, 0);
		const idx = [0, 0, 0, 0], wts = [0, 0, 0, 0];
		entries.forEach(([name, w], i) => {
			if (!(name in this.boneIndex)) throw new Error(`Неизвестная кость ${name}`);
			idx[i] = this.boneIndex[name];
			wts[i] = w / total;
		});
		return [idx, wts];
	}

	sample(controls, s) {
		const n = controls.length;
		const i = Math.min(n - 2, Math.floor(s));
		const f = s - i;
		const c = (k) => controls[Math.max(0, Math.min(n - 1, k))];
		const [a, b, d, e] = [c(i - 1), c(i), c(i + 1), c(i + 2)];
		const pos = V(...[0, 1, 2].map((k) => catmull(a.p[k], b.p[k], d.p[k], e.p[k], f)));
		const rx = Math.max(0.0008, catmull(a.r[0], b.r[0], d.r[0], e.r[0], f));
		const rz = Math.max(0.0008, catmull(a.r[1], b.r[1], d.r[1], e.r[1], f));
		const w = {};
		for (const [k, v] of Object.entries(b.w)) w[k] = (w[k] ?? 0) + v * (1 - f);
		for (const [k, v] of Object.entries(d.w)) w[k] = (w[k] ?? 0) + v * f;
		return { pos, rx, rz, w };
	}

	/**
	 * Трубка вдоль контрольных колец { p:[x,y,z], r:[rx,rz], w:{кость:вес} }.
	 * rx — радиус вдоль opts.side, rz — вдоль opts.front.
	 */
	tube(slot, controls, opts = {}) {
		const {
			side = [1, 0, 0], front = [0, 0, 1], seg = 24, steps = 5,
			capStart = false, capEnd = false, inflate = 0,
			shape, noise = { amp: 0.003, freq: 22 }, color, cull, post,
			uvScale = 0.35,
		} = opts;
		const sideRef = V(...side), frontRef = V(...front);

		// 1. Кольца вдоль сплайна
		const n = controls.length;
		const rings = [];
		const total = (n - 1) * steps;
		for (let k = 0; k <= total; k++) {
			const s = k / steps;
			const r = this.sample(controls, s);
			const p0 = this.sample(controls, Math.max(0, s - 0.02)).pos;
			const p1 = this.sample(controls, Math.min(n - 1, s + 0.02)).pos;
			r.T = p1.sub(p0).normalize();
			r.k = 1;
			rings.push(r);
		}
		const capRings = 4;
		const addCap = (end, dir) => {
			const out = [];
			for (let c = 1; c <= capRings; c++) {
				const sc = c / capRings;
				const len = Math.min(end.rx, end.rz) * 0.9;
				out.push({ ...end, pos: end.pos.clone().addScaledVector(end.T, dir * len * sc), k: Math.sqrt(Math.max(0, 1 - sc * sc)) });
			}
			return out;
		};
		if (capStart) rings.unshift(...addCap(rings[0], -1).reverse());
		if (capEnd) rings.push(...addCap(rings[rings.length - 1], 1));

		let len = 0;
		rings.forEach((r, i) => {
			if (i > 0) len += r.pos.distanceTo(rings[i - 1].pos);
			r.len = len;
		});
		const totalLen = len;
		const uRepeat = Math.max(1, Math.round((Math.PI * (controls.reduce((s, c) => s + c.r[0] + c.r[1], 0) / n)) / uvScale));

		// 2. Вершины
		const positions = [], normalsDummy = [], uvs = [], colors = [], skinIdx = [], skinW = [];
		const sideV = V(), frontV = V(), p = V(), base = V(), radial = V();
		for (const r of rings) {
			sideV.copy(sideRef).addScaledVector(r.T, -sideRef.dot(r.T));
			if (sideV.lengthSq() < 1e-6) sideV.copy(frontRef).cross(r.T);
			sideV.normalize();
			frontV.crossVectors(r.T, sideV).normalize();
			if (frontV.dot(frontRef) < 0) frontV.negate();
			const [idx, wts] = this.skinData(r.w);
			const t = totalLen > 0 ? r.len / totalLen : 0;
			for (let j = 0; j <= seg; j++) {
				const th = (j / seg) * Math.PI * 2;
				const ct = Math.cos(th), st = Math.sin(th);
				const m = shape ? shape(th, r.pos, t) : 1;
				base.copy(r.pos)
					.addScaledVector(sideV, r.rx * ct * m * r.k)
					.addScaledVector(frontV, r.rz * st * m * r.k);
				radial.copy(sideV).multiplyScalar(ct / r.rx).addScaledVector(frontV, st / r.rz).normalize();
				const nz = noise.amp ? (fbm3(base.x * noise.freq, base.y * noise.freq, base.z * noise.freq, 2, 77) - 0.5) * noise.amp * r.k : 0;
				p.copy(base).addScaledVector(radial, nz + inflate * r.k);
				if (post) post(p, base, t);
				positions.push(p.x, p.y, p.z);
				normalsDummy.push(0, 0, 0);
				uvs.push((j / seg) * uRepeat, r.len / uvScale);
				colors.push(...toLinear(color ? color(p, t, th) : [1, 1, 1]));
				skinIdx.push(...idx);
				skinW.push(...wts);
			}
		}

		// 3. Грани (с вырезанием дыр)
		const index = [];
		const stride = seg + 1;
		const center = V();
		for (let i = 0; i < rings.length - 1; i++) {
			for (let j = 0; j < seg; j++) {
				const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
				if (cull) {
					center.set(0, 0, 0);
					for (const q of [a, b, c, d]) center.x += positions[q * 3], center.y += positions[q * 3 + 1], center.z += positions[q * 3 + 2];
					center.multiplyScalar(0.25);
					const tt = ((rings[i].len + rings[i + 1].len) / 2) / totalLen;
					if (cull(center, tt, ((j + 0.5) / seg) * Math.PI * 2, totalLen)) continue;
				}
				index.push(a, c, b, b, c, d);
			}
		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geo.setAttribute('normal', new THREE.Float32BufferAttribute(normalsDummy, 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
		geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIdx, 4));
		geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4));
		geo.setIndex(index);
		geo.computeVertexNormals();
		// Сглаживаем шов (первый и последний столбец кольца совпадают)
		const nrm = geo.attributes.normal;
		for (let i = 0; i < rings.length; i++) {
			const a = i * stride, b = a + seg;
			const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
			const l = Math.hypot(x, y, z) || 1;
			nrm.setXYZ(a, x / l, y / l, z / l);
			nrm.setXYZ(b, x / l, y / l, z / l);
		}
		this.parts[slot].push(geo);
		return geo;
	}

	/** Готовая three-геометрия (уже в мировых координатах) с весами и цветом. */
	rigid(slot, geo, weights, color) {
		if (!geo.index) {
			const idx = [];
			for (let i = 0; i < geo.attributes.position.count; i++) idx.push(i);
			geo.setIndex(idx);
		}
		const pos = geo.attributes.position;
		const count = pos.count;
		const colors = new Float32Array(count * 3), si = new Uint16Array(count * 4), sw = new Float32Array(count * 4);
		const p = V();
		for (let i = 0; i < count; i++) {
			p.fromBufferAttribute(pos, i);
			const [idx, wts] = this.skinData(typeof weights === 'function' ? weights(p) : weights);
			si.set(idx, i * 4);
			sw.set(wts, i * 4);
			colors.set(toLinear(color ? color(p, i) : [1, 1, 1]), i * 3);
		}
		geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
		geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
		this.parts[slot].push(geo);
		return geo;
	}

	build() {
		const groups = MATERIAL_SLOTS.map((s) => mergeGeometries(this.parts[s]));
		const merged = mergeGeometries(groups, true);
		this.parts = null;
		merged.computeBoundingBox();
		merged.computeBoundingSphere();
		return merged;
	}
}

// ---------- Части тела ----------

const TORSO = [
	{ p: [0, 0.86, 0], r: [0.12, 0.095], w: { Hips: 1 } },
	{ p: [0, 0.93, 0], r: [0.158, 0.108], w: { Hips: 1 } },
	{ p: [0, 1.0, 0], r: [0.16, 0.105], w: { Hips: 1 } },
	{ p: [0, 1.07, 0], r: [0.148, 0.1], w: { Hips: 0.5, Spine: 0.5 } },
	{ p: [0, 1.15, 0], r: [0.135, 0.094], w: { Spine: 1 } },
	{ p: [0, 1.23, 0], r: [0.142, 0.098], w: { Spine: 0.5, Chest: 0.5 } },
	{ p: [0, 1.32, 0], r: [0.158, 0.106], w: { Chest: 1 } },
	{ p: [0, 1.41, -0.005], r: [0.168, 0.108], w: { Chest: 1 } },
	{ p: [0, 1.48, -0.01], r: [0.17, 0.095], w: { Chest: 1 } },
	{ p: [0, 1.535, -0.012], r: [0.125, 0.07], w: { Chest: 0.7, Neck: 0.3 } },
	{ p: [0, 1.575, -0.005], r: [0.056, 0.053], w: { Neck: 1 } },
	{ p: [0, 1.63, 0], r: [0.049, 0.05], w: { Neck: 0.6, Head: 0.4 } },
	{ p: [0, 1.69, -0.005], r: [0.045, 0.048], w: { Head: 1 } },
];

const WOUND = V(-0.08, 1.36, 0.105); // рваная рана на груди с торчащими рёбрами

function torsoShape(th, c) {
	const y = c.y, s = Math.sin(th), co = Math.cos(th);
	let m = 1;
	m += 0.05 * Math.max(0, s) * bump(y, 1.39, 0.06); // грудные мышцы
	m -= 0.07 * Math.max(0, s) ** 2 * bump(y, 1.15, 0.05); // впалый живот
	m -= 0.035 * Math.max(0, -s) * smoothstep(1.05, 1.2, y); // плоская спина
	m -= 0.03 * Math.exp(-((th - Math.PI * 1.5) ** 2) / 0.02) * smoothstep(1.0, 1.1, y) * (1 - smoothstep(1.45, 1.52, y)); // позвоночник
	m += 0.09 * Math.max(0, -s) * bump(y, 0.94, 0.04); // ягодицы
	// Выпирающие рёбра у истощённого тела
	if (y > 1.18 && y < 1.44) m += 0.014 * Math.sqrt(Math.abs(co)) * Math.max(0, Math.sin((y - 1.18) * Math.PI / 0.034)) ** 3 * smoothstep(1.18, 1.24, y);
	return m;
}

const limbW = (map, sfx) => Object.fromEntries(Object.entries(map).map(([k, v]) => [['Chest', 'Hips', 'Head', 'Neck'].includes(k) ? k : `${k}.${sfx}`, v]));

function armControls(sx, sfx) {
	return [
		{ p: [sx * 0.15, 1.525, -0.005], r: [0.05, 0.055], w: { Chest: 0.6, UpperArm: 0.4 } },
		{ p: [sx * 0.195, 1.515, 0], r: [0.058, 0.06], w: { Chest: 0.2, UpperArm: 0.8 } },
		{ p: [sx * 0.205, 1.45, 0], r: [0.049, 0.053], w: { UpperArm: 1 } },
		{ p: [sx * 0.205, 1.36, -0.005], r: [0.039, 0.043], w: { UpperArm: 1 } },
		{ p: [sx * 0.2, 1.27, -0.01], r: [0.035, 0.037], w: { UpperArm: 0.9, Forearm: 0.1 } },
		{ p: [sx * 0.2, 1.22, -0.012], r: [0.033, 0.035], w: { UpperArm: 0.5, Forearm: 0.5 } },
		{ p: [sx * 0.2, 1.16, -0.005], r: [0.036, 0.038], w: { Forearm: 1 } },
		{ p: [sx * 0.2, 1.06, 0], r: [0.026, 0.03], w: { Forearm: 1 } },
		{ p: [sx * 0.2, 0.975, 0], r: [0.019, 0.026], w: { Forearm: 0.6, Hand: 0.4 } },
		{ p: [sx * 0.2, 0.95, 0], r: [0.017, 0.028], w: { Hand: 1 } },
	].map((c) => ({ ...c, w: limbW(c.w, sfx) }));
}

function legControls(sx, sfx) {
	return [
		{ p: [sx * 0.085, 0.99, 0], r: [0.08, 0.085], w: { Hips: 0.6, UpperLeg: 0.4 } },
		{ p: [sx * 0.105, 0.9, 0.005], r: [0.083, 0.088], w: { Hips: 0.15, UpperLeg: 0.85 } },
		{ p: [sx * 0.11, 0.76, 0.012], r: [0.067, 0.071], w: { UpperLeg: 1 } },
		{ p: [sx * 0.11, 0.6, 0.008], r: [0.052, 0.055], w: { UpperLeg: 1 } },
		{ p: [sx * 0.11, 0.5, 0.005], r: [0.047, 0.05], w: { UpperLeg: 0.5, LowerLeg: 0.5 } },
		{ p: [sx * 0.11, 0.41, -0.008], r: [0.046, 0.05], w: { LowerLeg: 1 } },
		{ p: [sx * 0.11, 0.27, -0.002], r: [0.035, 0.037], w: { LowerLeg: 1 } },
		{ p: [sx * 0.11, 0.13, 0], r: [0.027, 0.03], w: { LowerLeg: 1 } },
		{ p: [sx * 0.11, 0.075, -0.005], r: [0.029, 0.033], w: { LowerLeg: 0.5, Foot: 0.5 } },
		{ p: [sx * 0.11, 0.05, -0.008], r: [0.029, 0.031], w: { Foot: 1 } },
	].map((c) => ({ ...c, w: limbW(c.w, sfx) }));
}

function legShape(th, c) {
	const s = Math.sin(th);
	return 1 + 0.13 * Math.max(0, -s) * bump(c.y, 0.38, 0.06) + 0.07 * Math.max(0, s) * bump(c.y, 0.5, 0.025);
}

const inflated = (controls, d) => controls.map((c) => ({ ...c, r: [c.r[0] + d, c.r[1] + d] }));

// Рваные дыры в ткани: грань удаляется, если попала в «дыру» с шумным краем.
function holes(list, p) {
	for (const { c, r } of list) {
		const edge = r * (0.65 + 0.7 * noise3(p.x * 45, p.y * 45, p.z * 45, 19));
		if (p.distanceTo(c) < edge) return true;
	}
	return false;
}
const ragged = (amount, p) => amount * (0.25 + 0.75 * fbm3(p.x * 30, p.y * 30, p.z * 30, 2, 23));

const armColor = (p) => applyBlood(skinTone(p), p, 1, true);
function skinColor(p) {
	return applyBlood(skinTone(p), p);
}
function skinTone(p) {
	let col = [1, 1, 1];
	// Ступни/кисти темнее, грязь снизу
	if (p.y < 0.3) col = mixColor(col, [0.7, 0.66, 0.6], smoothstep(0.3, 0.08, p.y));
	const w = p.distanceTo(WOUND);
	if (w < 0.05) col = mixColor(col, [0.28, 0.04, 0.04], 1 - smoothstep(0.02, 0.05, w));
	return col;
}

function buildBody(b) {
	// --- Туловище и шея ---
	b.tube('skin', TORSO, {
		seg: 40, steps: 6, capStart: true, shape: torsoShape, color: skinColor,
		post: (p) => {
			const d = p.distanceTo(WOUND);
			if (d < 0.05) {
				const k = 1 - smoothstep(0.015, 0.05, d);
				p.z -= 0.018 * k;
			}
		},
	});
	// Рёбра в ране
	for (const dy of [-0.024, 0, 0.024]) {
		const y = WOUND.y + dy;
		const pts = [-0.118, -0.08, -0.045].map((x) => {
			const rx = 0.165, rz = 0.11;
			const z = rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * 1.03 - 0.012;
			return { p: [x, y, z], r: [0.0042, 0.0042], w: { Chest: 1 } };
		});
		b.tube('teeth', pts, { seg: 6, steps: 3, capStart: true, capEnd: true, noise: { amp: 0.001, freq: 80 }, side: [0, 1, 0], front: [0, 0, 1], color: (p) => applyBlood([0.85, 0.8, 0.68], p, 0.6) });
	}

	for (const [sx, sfx] of [[1, 'L'], [-1, 'R']]) {
		// --- Рука ---
		b.tube('skin', armControls(sx, sfx), { seg: 24, steps: 5, capStart: true, capEnd: true, color: armColor });
		buildHand(b, sx, sfx);
		// --- Нога ---
		b.tube('skin', legControls(sx, sfx), { seg: 24, steps: 5, shape: legShape, color: skinColor });
		// --- Ботинок ---
		const footW = { [`Foot.${sfx}`]: 1 };
		b.tube('cloth', [
			{ p: [sx * 0.11, 0.05, -0.065], r: [0.038, 0.04], w: footW },
			{ p: [sx * 0.11, 0.055, -0.03], r: [0.045, 0.05], w: footW },
			{ p: [sx * 0.112, 0.046, 0.04], r: [0.048, 0.041], w: footW },
			{ p: [sx * 0.114, 0.036, 0.11], r: [0.045, 0.032], w: footW },
			{ p: [sx * 0.115, 0.03, 0.16], r: [0.036, 0.026], w: footW },
		], {
			side: [1, 0, 0], front: [0, 1, 0], seg: 24, steps: 4, capStart: true, capEnd: true, uvScale: 0.12,
			noise: { amp: 0.002, freq: 30 },
			post: (p) => { p.y = Math.max(p.y, 0.001); },
			color: (p) => {
				if (p.y < 0.012) return [0.1, 0.085, 0.075];
				const scuff = fbm3(p.x * 40, p.y * 40, p.z * 40, 2, 31);
				return mixColor([0.2, 0.14, 0.1], [0.36, 0.3, 0.24], smoothstep(0.55, 0.75, scuff));
			},
		});
	}
	buildClothes(b);
	buildHead(b);
}

function buildHand(b, sx, sfx) {
	const hw = { [`Hand.${sfx}`]: 1 };
	const handColor = (p, t) => {
		const col = mixColor([1, 1, 1], [0.78, 0.72, 0.7], smoothstep(0.92, 0.88, p.y));
		return applyBlood(col, p, 1, true);
	};
	b.tube('skin', [
		{ p: [sx * 0.2, 0.965, 0], r: [0.015, 0.029], w: hw },
		{ p: [sx * 0.198, 0.93, 0.003], r: [0.016, 0.035], w: hw },
		{ p: [sx * 0.196, 0.897, 0.004], r: [0.014, 0.036], w: hw },
		{ p: [sx * 0.195, 0.878, 0.004], r: [0.012, 0.033], w: hw },
	], { seg: 16, steps: 3, capStart: true, capEnd: true, noise: { amp: 0.0015, freq: 40 }, color: handColor });

	const fingers = [
		{ z: 0.027, len: 0.07, r: 0.0082 },
		{ z: 0.01, len: 0.08, r: 0.0088 },
		{ z: -0.007, len: 0.076, r: 0.0084 },
		{ z: -0.023, len: 0.061, r: 0.0074 },
	];
	const curl = [22, 38, 28].map(THREE.MathUtils.degToRad);
	const fingerColor = (p, t) => {
		const nail = smoothstep(0.82, 0.9, t);
		return applyBlood(mixColor([0.85, 0.82, 0.8], [0.22, 0.18, 0.14], nail), p, 1.2, true);
	};
	const zAxis = V(0, 0, 1);
	fingers.forEach((f, fi) => {
		const p = V(sx * 0.195, 0.886, f.z);
		const dir = V(0, -1, 0).applyAxisAngle(V(1, 0, 0), -f.z * 3); // лёгкое разведение пальцев
		const pts = [{ p: p.toArray(), r: [f.r, f.r], w: hw }];
		const lens = [0.45, 0.3, 0.25].map((k) => k * f.len);
		lens.forEach((l, k) => {
			dir.applyAxisAngle(zAxis, -sx * (curl[k] + fi * 0.04));
			p.addScaledVector(dir, l);
			const rr = f.r * (0.92 - k * 0.12);
			pts.push({ p: p.toArray(), r: [rr, rr], w: hw });
		});
		b.tube('skin', pts, { seg: 8, steps: 3, capStart: true, capEnd: true, noise: { amp: 0.001, freq: 60 }, uvScale: 0.1, color: fingerColor });
	});
	// Большой палец
	const p = V(sx * 0.188, 0.935, 0.03);
	const dir = V(-sx * 0.35, -0.75, 0.55).normalize();
	const pts = [{ p: p.toArray(), r: [0.0105, 0.0105], w: hw }];
	[0.03, 0.025, 0.02].forEach((l, k) => {
		dir.applyAxisAngle(zAxis, -sx * 0.3);
		p.addScaledVector(dir, l);
		pts.push({ p: p.toArray(), r: [0.0095 - k * 0.0012, 0.0095 - k * 0.0012], w: hw });
	});
	b.tube('skin', pts, { seg: 8, steps: 3, capStart: true, capEnd: true, noise: { amp: 0.001, freq: 60 }, uvScale: 0.1, color: fingerColor });
}

function buildClothes(b) {
	// --- Рубашка ---
	const SHIRT_HOLES = [
		{ c: WOUND, r: 0.07 },
		{ c: V(0.12, 1.1, 0.08), r: 0.045 },
		{ c: V(-0.05, 1.25, -0.11), r: 0.05 },
		{ c: V(0.1, 1.44, -0.1), r: 0.035 },
		{ c: V(-0.15, 1.18, 0.0), r: 0.03 },
	];
	const shirtColor = (p) => {
		let col = [0.52, 0.5, 0.45];
		col = mixColor(col, [0.42, 0.38, 0.3], smoothstep(1.15, 0.95, p.y) * 0.6); // грязь внизу
		return applyBlood(col, p, 0.9);
	};
	const shirtControls = inflated(TORSO.slice(1, 11), 0.011);
	shirtControls[0] = { ...shirtControls[0], r: [0.17, 0.122] };
	shirtControls[9] = { ...shirtControls[9], r: [0.07, 0.066] }; // воротник
	b.tube('cloth', shirtControls, {
		seg: 72, steps: 10, shape: torsoShape, color: shirtColor, uvScale: 0.25,
		noise: { amp: 0.006, freq: 14 },
		cull: (p, t, th, L) => holes(SHIRT_HOLES, p) || t * L < ragged(0.07, p),
	});
	// Рукава: левый оторван выше локтя, правый до предплечья
	const sleeve = (sx, sfx, upTo, extraHoles) => {
		const arm = armControls(sx, sfx).slice(0, upTo);
		b.tube('cloth', inflated(arm, 0.009), {
			seg: 36, steps: 8, color: shirtColor, uvScale: 0.25, noise: { amp: 0.004, freq: 16 },
			cull: (p, t, th, L) => holes(extraHoles, p) || (1 - t) * L < ragged(0.06, p),
		});
	};
	sleeve(1, 'L', 4, [{ c: V(0.2, 1.49, 0.05), r: 0.04 }]);
	sleeve(-1, 'R', 8, [{ c: V(-0.2, 1.22, -0.035), r: 0.03 }]);

	// --- Брюки ---
	const pantsColor = (p) => {
		let col = [0.24, 0.29, 0.4];
		col = mixColor(col, [0.33, 0.29, 0.22], smoothstep(0.45, 0.1, p.y) * 0.7); // грязь снизу
		return applyBlood(col, p, 0.7);
	};
	b.tube('cloth', inflated(TORSO.slice(0, 4), 0.008), {
		seg: 40, steps: 5, capStart: true, shape: torsoShape, color: pantsColor, uvScale: 0.25, noise: { amp: 0.003, freq: 18 },
	});
	b.tube('cloth', [
		{ p: [0, 1.035, 0], r: [0.163, 0.107], w: { Hips: 0.5, Spine: 0.5 } },
		{ p: [0, 1.06, 0], r: [0.159, 0.105], w: { Hips: 0.5, Spine: 0.5 } },
	], { seg: 40, steps: 3, shape: torsoShape, uvScale: 0.25, noise: { amp: 0 }, inflate: 0.012, color: () => [0.14, 0.1, 0.08] }); // ремень
	for (const [sx, sfx, upTo, holeList] of [
		[1, 'L', 8, [{ c: V(0.11, 0.5, 0.055), r: 0.035 }]],
		[-1, 'R', 6, [{ c: V(-0.14, 0.62, 0.02), r: 0.025 }]],
	]) {
		const leg = inflated(legControls(sx, sfx).slice(0, upTo), 0.01).map((c, i) => ({ ...c, r: [c.r[0] + i * 0.0015, c.r[1] + i * 0.0015] }));
		b.tube('cloth', leg, {
			seg: 36, steps: 8, shape: legShape, color: pantsColor, uvScale: 0.25, noise: { amp: 0.005, freq: 14 },
			cull: (p, t, th, L) => holes(holeList, p) || (1 - t) * L < ragged(sx > 0 ? 0.03 : 0.08, p),
		});
	}
}

function buildHead(b) {
	const SC = V(0, 1.75, 0.005); // центр черепа
	const headW = { Head: 1 };
	const random = rng(7);

	// --- Череп с лицом ---
	const g = new THREE.SphereGeometry(1, 56, 44);
	const pos = g.attributes.position;
	const d = V(), p = V();
	const lips = [], sockets = [];
	for (let i = 0; i < pos.count; i++) {
		d.fromBufferAttribute(pos, i);
		p.set(d.x * 0.074, d.y * 0.112, d.z * 0.098);
		if (d.y < 0) {
			p.x *= 1 - 0.24 * Math.pow(-d.y, 1.2);
			if (d.z > 0) p.z *= 1 + 0.06 * -d.y;
		}
		if (d.z < 0) p.z *= 1 + 0.08 * Math.max(0, d.y + 0.3);
		const front = smoothstep(0.2, 0.6, d.z);
		p.x *= 1 - 0.06 * bump(d.y, 0.25, 0.22) * (d.z > 0 ? 1 : 0.3); // виски
		let socket = 0;
		for (const ex of [-0.03, 0.03]) {
			const sg = Math.exp(-(((p.x - ex) / 0.018) ** 2 + ((p.y - 0.008) / 0.014) ** 2));
			socket = Math.max(socket, sg);
			p.z -= 0.018 * sg * front;
		}
		p.z += 0.009 * bump(p.y, 0.03, 0.009) * Math.exp(-((p.x / 0.05) ** 2)) * front; // надбровные дуги
		// нос
		const along = Math.min(1, Math.max(0, (0.012 - p.y) / 0.045));
		const nsx = 0.006 + 0.011 * along;
		const nose = Math.exp(-((p.x / nsx) ** 2)) * smoothstep(0.014, 0.004, p.y) * smoothstep(-0.046, -0.03, p.y);
		p.z += 0.026 * nose * (0.35 + 0.65 * along) * front;
		for (const sx of [-1, 1]) {
			const cb = Math.exp(-(((p.x - sx * 0.046) ** 2 + (p.y + 0.012) ** 2) / 0.014 ** 2));
			p.z += 0.006 * cb * front; p.x += sx * 0.005 * cb;
			const sunk = Math.exp(-(((p.x - sx * 0.043) ** 2 + (p.y + 0.047) ** 2) / 0.018 ** 2));
			p.z -= 0.012 * sunk * front; p.x -= sx * 0.007 * sunk;
		}
		const lip = bump(p.y, -0.05, 0.005) * Math.exp(-((p.x / 0.024) ** 2)) * front;
		p.z += 0.004 * lip;
		// под верхней губой лицо уходит внутрь — там челюсть и рот
		const recess = smoothstep(-0.053, -0.063, p.y) * smoothstep(0.1, 0.5, d.z);
		p.z -= 0.032 * recess; p.x *= 1 - 0.2 * recess;
		// шрам-вмятина на темени
		p.multiplyScalar(1 - 0.06 * Math.exp(-(((d.x - 0.35) ** 2 + (d.y - 0.75) ** 2 + (d.z - 0.45) ** 2) / 0.02)));
		const n = (fbm3(p.x * 30, p.y * 30, p.z * 30, 2, 5) - 0.5) * 0.004;
		p.multiplyScalar(1 + n / 0.1);
		pos.setXYZ(i, p.x + SC.x, p.y + SC.y, p.z + SC.z);
		lips.push(lip);
		sockets.push(socket * front);
	}
	g.computeVertexNormals();
	const huv = g.attributes.uv;
	for (let i = 0; i < huv.count; i++) huv.setXY(i, huv.getX(i) * 3, huv.getY(i) * 1.5);
	const hairPatch = (q) => fbm3(q.x * 45, q.y * 45, q.z * 45, 3, 47);
	b.rigid('skin', g, (q) => (q.y < 1.66 && q.z < 0.03 ? { Head: 0.7, Neck: 0.3 } : headW), (q, i) => {
		let col = [1.03, 1.03, 1.03];
		const local = q.clone().sub(SC);
		col = mixColor(col, [0.5, 0.3, 0.33], Math.min(1, sockets[i] * 1.2)); // тёмные круги вокруг глаз
		col = mixColor(col, [0.42, 0.18, 0.18], lips[i]);
		if (local.y > 0.04) col = mixColor(col, [0.3, 0.29, 0.25], 0.55 * smoothstep(0.04, 0.08, local.y) * smoothstep(0.5, 0.6, hairPatch(q))); // остатки волос
		return applyBlood(col.map((c) => Math.min(1, c)), q);
	});

	// --- Нижняя челюсть ---
	const jaw = new THREE.SphereGeometry(1, 32, 20);
	const jp = jaw.attributes.position;
	for (let i = 0; i < jp.count; i++) {
		d.fromBufferAttribute(jp, i);
		p.set(d.x * 0.052, d.y * 0.026, d.z * 0.058);
		p.x *= 1 + 0.25 * Math.max(0, -d.z); // U-образная форма
		if (d.y > 0) p.y *= 0.5;
		p.z += 0.01 * Math.max(0, d.z) * Math.max(0, -d.y) * 2; // подбородок
		jp.setXYZ(i, p.x + SC.x, p.y + SC.y - 0.082, p.z + SC.z + 0.026);
	}
	jaw.computeVertexNormals();
	b.rigid('skin', jaw, { Jaw: 1 }, (q) => {
		const local = q.clone().sub(SC);
		const lip = bump(local.y, -0.072, 0.006) * smoothstep(0.05, 0.075, local.z);
		return applyBlood(mixColor([1, 1, 1], [0.4, 0.17, 0.17], lip), q, 1.3);
	});

	// --- Полость рта ---
	const mouth = new THREE.SphereGeometry(0.03, 16, 12);
	mouth.scale(1.1, 0.8, 1).translate(SC.x, SC.y - 0.066, SC.z + 0.045);
	b.rigid('skin', mouth, (q) => (q.y < SC.y - 0.066 ? { Jaw: 1 } : headW), () => [0.12, 0.03, 0.03]);

	// --- Зубы ---
	const teeth = (y, weights, flip) => {
		for (let k = -5; k <= 5; k++) {
			if (random() < 0.15) continue; // выбитые зубы
			const a = (k / 5) * 1.1;
			const h = 0.007 + random() * 0.004;
			const t = new THREE.BoxGeometry(0.0055, h, 0.0045, 1, 1, 1);
			t.translate(0, flip ? h / 2 : -h / 2, 0);
			t.rotateZ((random() - 0.5) * 0.25);
			t.rotateY(a);
			t.translate(Math.sin(a) * 0.033, y, Math.cos(a) * 0.033 - 0.006);
			t.translate(SC.x, SC.y, SC.z + 0.046);
			const shade = 0.55 + random() * 0.35;
			b.rigid('teeth', t.toNonIndexed(), weights, () => [0.9 * shade + 0.08, 0.82 * shade + 0.05, 0.6 * shade]);
		}
	};
	teeth(-0.055, headW, false);
	teeth(-0.067, { Jaw: 1 }, true);

	// --- Глаза: мутные, смотрят немного в разные стороны ---
	for (const sx of [-1, 1]) {
		const eye = new THREE.SphereGeometry(0.0115, 20, 14);
		const ep = eye.attributes.position;
		const cols = [];
		for (let i = 0; i < ep.count; i++) {
			const z = ep.getZ(i) / 0.0115;
			cols.push(z > 0.96 ? [0.28, 0.27, 0.25] : z > 0.84 ? [0.6, 0.64, 0.6] : [0.86, 0.82, 0.62]);
		}
		eye.rotateY(sx * 0.15).rotateX(sx > 0 ? 0.08 : -0.05);
		eye.translate(SC.x + sx * 0.03, SC.y + 0.008, SC.z + 0.066);
		b.rigid('eye', eye, headW, (q, i) => cols[i]);
	}

	// --- Уши (левое надорвано) ---
	for (const sx of [-1, 1]) {
		const ear = new THREE.SphereGeometry(1, 14, 10);
		ear.scale(0.009, sx > 0 ? 0.02 : 0.028, 0.017).rotateY(sx * 0.4).translate(SC.x + sx * 0.073, SC.y - 0.002, SC.z - 0.01);
		b.rigid('skin', ear, headW, (q) => applyBlood([0.92, 0.85, 0.85], q, sx > 0 ? 2 : 0));
	}
}

export function createSkeleton() {
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

export function createBodyGeometry(boneList) {
	const b = new BodyBuilder(boneList);
	buildBody(b);
	return b.build();
}
