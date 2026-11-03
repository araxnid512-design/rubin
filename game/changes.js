// Перемены после перезагрузки кластера: Улей подменяет кластер свежей копией — но не всегда точной. На каждый цикл
// (world.clusters[id].reloads) поверх обычной локации встают свои завалы: сгоревшие и разбитые машины, баррикады из
// бетонных блоков поперёк улиц, упавшие деревья, груды обломков, стенки из мешков. Где что — от номера цикла
// (свой генератор: основная локация, тайники и деревья не сдвигаются). Каждый завал проверяется по сетке
// проходимости: если из-за него до какого-то тайника или выхода не дойти — его нет. Проход перекрыт целиком, только
// когда есть обход. Первая копия кластера (цикл 0) — без перемен.

import * as THREE from 'three';
import * as T from './textures.js';
import { box, place, beginProp, endProp } from './geom.js';
import { addCar } from './props.js';
import { sandbags } from './props-industrial.js';

/** Сколько завалов ставить за цикл (сколько получится — столько и будет). */
const COUNT = [5, 9];

/**
 * Поставить перемены цикла variant. ctx: { seed, variant, batch, root, M, colliders, collide, onRoad, indoors,
 * nearExit, start: [x, z], need: [[x, z], …] — куда должно быть можно дойти (тайники, выходы), fires — куда добавить
 * горящую машину, HALF, PLAY, CELL }. Возвращает список поставленного (для тестов).
 */
export function applyChanges(ctx) {
	const { seed, variant, batch, root, M, colliders, collide, onRoad, indoors, nearExit, start, need, fires, HALF, PLAY, CELL } = ctx;
	if (!(variant > 0)) return [];
	const rnd = T.mulberry((seed * 7919 + variant * 104729) >>> 0);
	const R = (a, b) => a + (b - a) * rnd();
	// сетка проходимости — как makeNav в level.js (с запасом 0,35 под тело)
	const N = Math.round((HALF * 2) / CELL), pad = 0.35;
	const cellOf = (v) => Math.floor((v + HALF) / CELL), center = (g) => g * CELL - HALF + CELL / 2;
	const blocked = new Uint8Array(N * N);
	const stamp = (arr, c) => {
		const r = Math.hypot(c.hx, c.hz) + pad + CELL;
		for (let gz = Math.max(0, cellOf(c.z - r)); gz < Math.min(N, cellOf(c.z + r) + 1); gz++) {
			for (let gx = Math.max(0, cellOf(c.x - r)); gx < Math.min(N, cellOf(c.x + r) + 1); gx++) {
				const dx = center(gx) - c.x, dz = center(gz) - c.z;
				if (Math.abs(dx * c.c - dz * c.s) <= c.hx + pad && Math.abs(dx * c.s + dz * c.c) <= c.hz + pad) arr[gz * N + gx] = 1;
			}
		}
	};
	for (const c of colliders) stamp(blocked, c);
	for (let i = 0; i < N; i++) for (const [gx, gz] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) blocked[gz * N + gx] = 1;
	// клетка цели: сама или свободная рядом (к мебели подходят на ~1,2 м)
	const targetCells = (arr) => need.map(([x, z]) => {
		const [cx, cz] = [cellOf(x), cellOf(z)], k = Math.ceil(1.2 / CELL), out = [];
		for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) {
			const gx = cx + dx, gz = cz + dz;
			if (gx >= 0 && gz >= 0 && gx < N && gz < N && !arr[gz * N + gx] && Math.hypot(dx, dz) * CELL <= 1.2) out.push(gz * N + gx);
		}
		return out;
	});
	// из старта по 8 соседям: до всех целей дойти можно?
	const seen = new Uint8Array(N * N), queue = new Int32Array(N * N);
	const reachAll = (arr, targets) => {
		seen.fill(0);
		const s = cellOf(start[1]) * N + cellOf(start[0]);
		if (arr[s]) return true; // старт в коллайдере — проверить нельзя, не мешаем
		let h = 0, t = 0;
		queue[t++] = s; seen[s] = 1;
		while (h < t) {
			const i = queue[h++], gx = i % N, gz = (i / N) | 0;
			for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
				if (!dx && !dz) continue;
				const x = gx + dx, z = gz + dz;
				if (x < 0 || z < 0 || x >= N || z >= N) continue;
				const j = z * N + x;
				if (seen[j] || arr[j]) continue;
				if (dx && dz && (arr[gz * N + x] || arr[z * N + gx])) continue; // наискосок мимо угла — нельзя
				seen[j] = 1;
				queue[t++] = j;
			}
		}
		return targets.every((cells) => !cells.length || cells.some((j) => seen[j]));
	};
	const targets = targetCells(blocked);
	if (!reachAll(blocked, targets)) return []; // локация и так с изъяном — не трогаем
	// насколько свободно в стороны от точки (вдоль x и вдоль z) — улица идёт вдоль длинной стороны
	const free = (x, z) => !blocked[cellOf(z) * N + cellOf(x)];
	const run = (x, z, dx, dz) => { let d = 0; while (d < 12 && free(x + dx * (d + 0.5), z + dz * (d + 0.5))) d += 0.5; return d; };

	const placed = [];
	const want = Math.round(R(...COUNT));
	for (let tries = 0; tries < 70 && placed.length < want; tries++) {
		const x = R(-PLAY + 8, PLAY - 8), z = R(-PLAY + 8, PLAY - 8);
		if (!free(x, z) || indoors(x, z, 2) || nearExit(x, z, 7) || Math.hypot(x - start[0], z - start[1]) < 10) continue;
		const road = onRoad(x, z);
		if (!road && rnd() < 0.6) continue; // больше на улицах и дворах, где ходят
		// поперёк улицы: короткая сторона свободного места; длина — во всю ширину (перекрыть), но не больше 9 м
		const ex = run(x, z, 1, 0) + run(x, z, -1, 0), ez = run(x, z, 0, 1) + run(x, z, 0, -1);
		const across = ex < ez ? 0 : Math.PI / 2; // поворот: 0 — вдоль x (поперёк улицы, идущей вдоль z)
		const width = Math.min(ex, ez);
		const kind = rnd();
		let spec;
		if (kind < 0.3) spec = { t: 'wreck', len: 4.3, w: 1.9, ry: across + R(-0.5, 0.5) };
		else if (kind < 0.55 && width < 10) spec = { t: 'blocks', len: Math.min(9, width + 0.8), w: 1.0, ry: across };
		else if (kind < 0.72) spec = { t: 'tree', len: R(6, 8.5), w: 0.9, ry: across + R(-0.3, 0.3) };
		else if (kind < 0.88) spec = { t: 'rubble', len: R(2.2, 3.4), w: R(1.8, 2.6), ry: R(0, 3.1) };
		else spec = { t: 'bags', len: Math.min(6, Math.max(3, width * 0.7)), w: 0.8, ry: across };
		const c = { x, z, hx: spec.len / 2, hz: spec.w / 2, rot: spec.ry, c: Math.cos(spec.ry), s: Math.sin(spec.ry), wall: false };
		// обломки не встают на другое препятствие
		const test = blocked.slice();
		stamp(test, c);
		if (!reachAll(test, targets)) continue;
		blocked.set(test);
		placed.push({ ...spec, x, z });
		build(spec, x, z);
	}
	return placed;

	/** Геометрия и коллайдер завала. */
	function build(sp, x, z) {
		const { ry } = sp, cs = Math.cos(ry), sn = Math.sin(ry);
		const along = (t) => [x + cs * t, z - sn * t];
		if (sp.t === 'wreck') {
			// сгоревшая или разбитая машина; изредка ещё горит
			const burned = rnd() < 0.6;
			addCar(batch, M, root, x, z, ry, [0x6a2a22, 0x2a3a5a, 0x5a5a52, 0x3a4a2a][Math.floor(rnd() * 4)], burned ? { burned: true } : { crashed: true });
			collide(x, z, 4.3, 1.9, ry);
			if (burned && rnd() < 0.35) fires?.push([x, z, 'car']);
		} else if (sp.t === 'blocks') {
			// бетонные блоки в ряд, с просветами не шире ладони
			const n = Math.max(2, Math.round(sp.len / 1.9));
			for (let i = 0; i < n; i++) {
				const t = (i + 0.5) / n * sp.len - sp.len / 2, [bx, bz] = along(t), r = ry + R(-0.12, 0.12);
				beginProp('block', bx, bz, r);
				batch.add(place(box(1.8, 0.9, 0.9, 1), bx, 0.45, bz, r), M.concrete);
				endProp();
			}
			collide(x, z, sp.len, 1.0, ry);
		} else if (sp.t === 'tree') {
			// упавшее дерево: ствол, корневище, сучья
			const log = new THREE.CylinderGeometry(0.22, 0.34, sp.len, 8).rotateZ(Math.PI / 2);
			batch.add(place(log, x, 0.32, z, ry), M.bark);
			const [rx, rz] = along(-sp.len / 2);
			batch.add(place(new THREE.DodecahedronGeometry(0.75, 0).scale(0.5, 1, 1), rx, 0.5, rz, ry), M.dirt);
			for (let i = 0; i < 4; i++) {
				const t = R(-sp.len * 0.1, sp.len * 0.45), [bx, bz] = along(t), side = i % 2 ? 1 : -1;
				batch.add(place(new THREE.CylinderGeometry(0.05, 0.08, R(1.2, 2), 5).rotateX(Math.PI / 2 - 0.4 * side), bx - sn * side * 0.6, 0.5, bz - cs * side * 0.6, ry + side * 0.7), M.bark);
			}
			collide(x, z, sp.len, 0.9, ry);
		} else if (sp.t === 'rubble') {
			// груда обломков: плиты, кирпич, арматура
			for (let i = 0; i < 9; i++) {
				const s = R(0.35, 0.9), [bx, bz] = along(R(-sp.len / 2.4, sp.len / 2.4));
				batch.add(place(box(s * 1.6, s * 0.5, s, 1), bx + R(-0.6, 0.6) * sn, s * 0.25 + R(0, 0.3), bz + R(-0.6, 0.6) * cs, R(0, 3.1), R(-0.3, 0.3), R(-0.3, 0.3)), rnd() < 0.6 ? M.concreteDark : M.brick);
			}
			collide(x, z, sp.len, sp.w, ry);
		} else {
			sandbags(batch, M, collide, x, z, sp.len, ry);
		}
	}
}
