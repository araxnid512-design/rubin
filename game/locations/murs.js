// Стаб муров «Карьер»: бандиты обжили старый карьер — бетонный забор с колючкой, вышки по углам, ворота
// со шлагбаумом на юге. Во дворе — казарма (оттуда выходят на смену убитым часовым), склад и будка главаря:
// в их шкафах — всё, что муры вынесли из кластеров (game/murs.js). Заражённых здесь нет — их перебили муры.
// Учёт, вылазки и гарнизон — game/murs.js и game/main.js (Garrison, populateMurs).

import { box, place } from '../geom.js';
import { buildArmyBarracks, buildWarehouse, buildGuardhouse } from '../buildings.js';
import { blob, streetLamp } from '../props.js';
import { concreteFence, watchTower, btr, armyTruck, sandbags, hazardBarrels, barrier, billboard } from '../props-industrial.js';

const FX = 36, FN = -38, FS = 26; // забор: x от −FX до FX, z от FN (север) до FS (юг, ворота посередине)

export default {
	id: 'murs',
	seed: 1993,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, buildings, bctx } = ctx;

		// ---------- Карьер: щебень, двор, дорога к воротам с юга ----------
		ground(120, 108, 0, -6, M.dirt, 6, 0.012);
		ground(2 * FX, FS - FN, 0, (FS + FN) / 2, M.ballast, 5, 0.014); // двор засыпан щебнем
		ground(8, 42, 0, 47, M.dirt, 4, 0.018); // от ворот на юг, к краю
		for (let i = 0; i < 9; i++) ground(R(4, 9), R(3, 6), R(-28, 28), R(-32, 20), M.concreteDark, 3, 0.02 + i * 0.001);
		const onRoad = (x, z, m = 0) => (Math.abs(x) < 4 + m && z > FS - 2 - m) || (Math.abs(x) < FX + m && z > FN - m && z < FS + m);

		// ---------- Забор с колючкой, ворота со шлагбаумом ----------
		concreteFence(batch, M, collide, root, -FX, FN, FX, FN);
		concreteFence(batch, M, collide, root, -FX, FN, -FX, FS);
		concreteFence(batch, M, collide, root, FX, FN, FX, FS);
		concreteFence(batch, M, collide, root, -FX, FS, -4.5, FS);
		concreteFence(batch, M, collide, root, 4.5, FS, FX, FS);
		barrier(batch, M, collide, 0, FS, 0, 8, true);
		billboard(batch, M, root, collide, 9, FS + 2.6, 0, 'НЕ ВХОДИТЬ — СТРЕЛЯЕМ', { w: 5.2, h: 1.1, y: 1.9, bg: '#2a2620', fg: '#d8442c' });
		sandbags(batch, M, collide, -8, FS - 3.5, 6, 0);
		sandbags(batch, M, collide, 8, FS - 3.5, 6, 0);
		for (const [x, z] of [[-FX + 3, FN + 3], [FX - 3, FN + 3], [-FX + 3, FS - 3], [FX - 3, FS - 3]]) watchTower(batch, M, collide, x, z);

		// ---------- Двор: казарма, склад, будка главаря ----------
		buildings.push(
			buildArmyBarracks(bctx, { name: 'Barracks', cx: -18, cz: -24, ry: Math.PI }),
			buildWarehouse(bctx, { name: 'Storage', cx: 18, cz: -24, ry: Math.PI }),
			buildGuardhouse(bctx, { name: 'Boss', cx: 28, cz: 4, ry: Math.PI / 2 }),
		);
		btr(batch, M, root, collide, -24, 6, 0.3);
		armyTruck(batch, M, root, collide, -8, -6, 1.4);
		armyTruck(batch, M, root, collide, 10, 10, -0.3);
		hazardBarrels(batch, M, collide, -30, -10, rnd, 5);
		hazardBarrels(batch, M, collide, 30, -8, rnd, 4);
		for (const [x, z] of [[-14, 16], [14, 16], [0, -14]]) streetLamp(batch, M, collide, x, z);
		// ящики с добром у склада
		for (const [x, z, r] of [[10.5, -16.5, 0.1], [12, -16, 0.5], [25, -16.2, 0], [-26, -16.4, 0.3]]) {
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			collide(x, z, 1.1, 0.9, r);
		}

		// ---------- За забором: валуны карьера ----------
		for (let i = 0; i < 26; i++) {
			const x = R(-60, 60), z = R(-60, 60);
			if (Math.abs(x) < FX + 4 && z > FN - 4 && z < FS + 4) continue;
			if (Math.abs(x) < 6 && z > FS) continue;
			const r = R(0.8, 2.2);
			batch.add(place(blob(r, 1, 100 + i), x, r * 0.35, z, R(0, 6)), rnd() < 0.5 ? M.concreteDark : M.ballast);
			collide(x, z, r * 1.6, r * 1.6);
		}

		return {
			start: [0, 58, Math.PI],
			exits: [{ to: null, x0: -4, x1: 4, z0: 61.2, z1: 66, spawn: [0, 58, Math.PI], sign: [5.5, 60, 'Выход ↓'] }],
			groups: [],
			onRoad,
			// посты часовых: [x, z, куда смотрит]; казарма — откуда выходит смена
			posts: [
				[-3, FS - 1.6, 0], [3, FS - 1.6, 0], [-FX + 5, FN + 5, 0.8], [FX - 5, FN + 5, -0.8], [-FX + 5, FS - 5, 2.4], [FX - 5, FS - 5, -2.4],
				[-2.5, 2, 2], [2.5, -1, -1], [0, 3.5, 3], [-18, -16, 0], [-12, -14, 0.4], [18, -16, 0], [14, -14, -0.4], [24, 4, 1.6],
				[-28, -30, 0.6], [28, -30, -0.6], [-30, 12, 1.5], [30, 16, -1.5], [0, -30, 3.1], [-10, 14, 0], [12, 18, 0.2],
			],
			barracksDoor: { x: -18, z: -18.6 },
			fires: [[0, 0, 'ground'], [-6, FS - 5], [6, FS - 5]],
			barrels: 6,
			clutter: 14,
			blood: 30,
			puddles: 8,
			grass: 0.5,
			beltTrees: ['pine', 'birch', 'birch'],
			hint: (b) => ({
				Barracks: 'Казарма муров — тумбочки у коек и шкафы',
				Storage: 'Склад муров — в шкафах и на стеллажах их добыча',
				Boss: 'Будка главаря — его сейф и шкаф',
			}[b.name]),
		};
	},
};
