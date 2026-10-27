// Загрузчики форматов MakeHuman: базовая модель (.obj), морфы (.target),
// скелет (.mhskel), веса (.mhw) и привязка прокси-мешей (.mhclo).

import { readFileSync } from 'node:fs';

/** base.obj → вершины, UV и грани по группам. Грань — массив [индексВершины, индексUV]. */
export function loadObj(path) {
	const positions = [];
	const uvs = [];
	const groups = new Map([['default', []]]);
	let current = groups.get('default');
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		if (line.startsWith('v ')) {
			const [, x, y, z] = line.trim().split(/\s+/);
			positions.push(+x, +y, +z);
		} else if (line.startsWith('vt ')) {
			const [, u, v] = line.trim().split(/\s+/);
			uvs.push(+u, +v);
		} else if (line.startsWith('g ')) {
			const name = line.slice(2).trim();
			if (!groups.has(name)) groups.set(name, []);
			current = groups.get(name);
		} else if (line.startsWith('f ') && current) {
			current.push(line.trim().split(/\s+/).slice(1).map((t) => {
				const [v, vt] = t.split('/');
				return [+v - 1, vt ? +vt - 1 : -1];
			}));
		}
	}
	return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), groups };
}

/** Применяет морф с весом к массиву вершин (на месте). */
export function applyTarget(positions, path, weight) {
	if (!weight) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		if (!line || line[0] === '#') continue;
		const [i, dx, dy, dz] = line.trim().split(/\s+/);
		const k = +i * 3;
		positions[k] += +dx * weight;
		positions[k + 1] += +dy * weight;
		positions[k + 2] += +dz * weight;
	}
}

export function loadSkeleton(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadWeights(path) {
	return JSON.parse(readFileSync(path, 'utf8')).weights;
}

/** Позиция сустава = среднее его вершин. */
export function jointPosition(skeleton, positions, name) {
	const idx = skeleton.joints[name];
	const p = [0, 0, 0];
	for (const i of idx) for (let k = 0; k < 3; k++) p[k] += positions[i * 3 + k];
	return p.map((v) => v / idx.length);
}

/**
 * Прокси-меш по .mhclo: каждая вершина = взвешенная сумма трёх вершин базовой модели
 * + смещение, масштабированное по размерам базовой модели.
 */
export function fitProxy(mhcloPath, objPath, basePositions) {
	const text = readFileSync(mhcloPath, 'utf8').split('\n');
	const scale = [1, 1, 1];
	const refs = [];
	let inVerts = false;
	const P = (i, k) => basePositions[i * 3 + k];
	for (const line of text) {
		const t = line.trim().split(/\s+/);
		if (t[0] === 'x_scale' || t[0] === 'y_scale' || t[0] === 'z_scale') {
			const axis = { x_scale: 0, y_scale: 1, z_scale: 2 }[t[0]];
			scale[axis] = Math.abs(P(+t[1], axis) - P(+t[2], axis)) / +t[3];
		} else if (t[0] === 'verts') {
			inVerts = true;
		} else if (inVerts && t.length === 9) {
			refs.push(t.map(Number));
		} else if (inVerts && t.length === 1 && t[0] !== '' && !isNaN(+t[0])) {
			refs.push([+t[0], 0, 0, 1, 0, 0, 0, 0, 0]); // вершина совпадает с вершиной базы
		}
	}
	const obj = loadObj(objPath);
	const out = new Float32Array(refs.length * 3);
	refs.forEach(([a, b, c, wa, wb, wc, ox, oy, oz], i) => {
		const o = [ox, oy, oz];
		for (let k = 0; k < 3; k++) out[i * 3 + k] = wa * P(a, k) + wb * P(b, k) + wc * P(c, k) + o[k] * scale[k];
	});
	return { positions: out, uvs: obj.uvs, groups: obj.groups };
}
