// Кластер «Дачи»: садовое товарищество «Рассвет» — дачные домики за заборами, теплицы, огороды,
// сторожка с оружейным шкафом, пруд. Выходы: на восток по дороге (к Заречному) и на юг (к стабу).

import { box, place } from '../geom.js';
import { buildDacha, buildGuardhouse } from '../buildings.js';
import {
	garden, woodpile, outhouse, clothesline, settlementSign, fencePlot, shed, well, addCar,
	greenhouse, pond, transformer, powerLine, waterBarrel,
} from '../props.js';

// Участки: x — середина, z — середина, что стоит (dacha | green | shed), куда калитка
const ROWS = {
	north: { z: -34.5, D: 19, gate: 's', ry: Math.PI, back: -4 },
	middle: { z: -9.5, D: 19, gate: 's', ry: Math.PI, back: -4 },
	south: { z: 17, D: 18, gate: 'n', ry: 0, back: 3.5 },
};
const PLOTS = [
	['north', -23.5, 'green'], ['north', -9, 'dacha'], ['north', 9, 'shed'], ['north', 23.5, 'dacha'],
	['middle', -38, 'dacha'], ['middle', -23.5, 'green'], ['middle', -9, 'dacha'], ['middle', 9, 'dacha'], ['middle', 23.5, 'green'], ['middle', 38, 'dacha'],
	['south', -38, 'shed'], ['south', -23.5, 'dacha'], ['south', 23.5, 'dacha'], ['south', 38, 'green'],
];
const PW = 13; // ширина участка

export default {
	id: 'dachi',
	seed: 2024,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, buildings, bctx } = ctx;

		// ---------- Дороги: грунтовка с востока, проезды между участками, дорога на юг ----------
		ground(150, 6, 0, 4, M.dirt, 4, 0.02);
		ground(4, 47, 0, -21, M.dirt, 4, 0.018);
		ground(94, 4, 0, -22, M.dirt, 4, 0.016);
		ground(5, 44, 0, 29, M.dirt, 4, 0.018);
		const onRoad = (x, z, m = 0) => Math.abs(z - 4) < 3 + m || (Math.abs(x) < 2.5 + m && z > 7 - m)
			|| (Math.abs(x) < 2 + m && z < 1 + m) || (Math.abs(z + 22) < 2 + m && Math.abs(x) < 47);

		// ---------- Участки ----------
		let variant = 0;
		const appleSpots = [];
		PLOTS.forEach(([rowName, cx, kind], i) => {
			const row = ROWS[rowName];
			const cz = row.z;
			fencePlot(batch, M, collide, cx, cz, PW, row.D, row.gate, rnd);
			const side = row.gate === 's' ? 1 : -1; // калитка к дороге: юг (+1) или север (−1)
			const backZ = cz + row.back; // дальняя от калитки часть участка
			if (kind === 'dacha') {
				buildings.push(buildDacha(bctx, { name: `Dacha${i}`, cx: cx - 1.5, cz: backZ, ry: row.ry, rnd, variant: variant++ }));
				garden(batch, M, rnd, cx + 3.6, cz + side * 3.6, 3, 5.5);
				outhouse(batch, M, collide, cx + 4.6, backZ - side * 3.6, row.ry);
				waterBarrel(batch, M, collide, cx + 4.9, backZ);
				if (rnd() < 0.5) woodpile(batch, M, collide, cx + 3.2, backZ - side * 1.6, 0);
			} else if (kind === 'green') {
				greenhouse(batch, M, collide, cx - 2.6, cz - side * 1.5, 6, 3.2);
				greenhouse(batch, M, collide, cx + 2.6, cz - side * 1.5, 6, 3.2);
				garden(batch, M, rnd, cx, cz + side * 5.5, 5, 3);
				waterBarrel(batch, M, collide, cx + 5.3, cz - side * 6.5);
			} else {
				shed(batch, M, collide, cx - 3, backZ, rnd() * 0.2);
				garden(batch, M, rnd, cx + 2.5, cz, 4, 7);
				well(batch, M, collide, cx - 3.2, cz + side * 3.5);
			}
			appleSpots.push([cx, cz, row.D]);
		});
		clothesline(batch, M, root, collide, -43.2, -38.5, -4, rnd);

		// ---------- Сторожка у въезда с юга ----------
		buildings.push(buildGuardhouse(bctx, { cx: 9, cz: 12.5, ry: 0 }));
		{
			// шлагбаум и будка у дороги на юг
			batch.add(place(box(0.2, 1.0, 0.2), 3.2, 0.5, 9.2), M.metalDark);
			batch.add(place(box(0.08, 0.08, 4.6), 3.2, 0.95, 11.4), M.red); // поднятая стрела вдоль обочины
			collide(3.2, 9.2, 0.4, 0.4);
		}

		// ---------- Пруд, трансформаторная, колодец, ЛЭП, брошенные машины ----------
		pond(batch, root, M, collide, -27, 36, 9, 5.5, rnd);
		transformer(batch, root, M, collide, 24, 36);
		powerLine(batch, root, M, collide, -44, 44, 0.4);
		addCar(batch, M, root, 20, 4.6, 0.12, 0x6a7a4a);
		collide(20, 4.6, 4.3, 1.8, 0.12);
		addCar(batch, M, root, -14, 3.0, Math.PI + 0.2, 0xb8b0a0, { crashed: true });
		collide(-14, 3.0, 4.3, 1.8, Math.PI + 0.2);
		addCar(batch, M, root, 0.3, -32, Math.PI / 2 + 0.1, 0x1c1a18, { burned: true });
		collide(0.3, -32, 4.3, 1.8, Math.PI / 2 + 0.1);
		settlementSign(batch, M, root, collide, 36.5, 7.6, 'СНТ «РАССВЕТ»');
		// доска объявлений у въезда
		batch.add(place(box(1.6, 1.0, 0.08), 30.7, 1.5, 7.6), M.woodGrey);
		for (const dx of [-0.7, 0.7]) batch.add(place(box(0.08, 2.0, 0.08), 30.7 + dx, 1.0, 7.6), M.wood);
		collide(30.7, 7.6, 1.7, 0.3);

		return {
			start: [42.5, 4, -Math.PI / 2],
			exits: [
				{ to: 'zarechny', x0: 45.2, x1: 50, z0: 1, z1: 7, spawn: [42.5, 4, -Math.PI / 2], sign: [43.6, 7.6, 'Заречный →'] },
				{ to: 'stab', x0: -2.5, x1: 2.5, z0: 45.2, z1: 50, spawn: [0, 42.5, Math.PI], sign: [4, 44.2, '↓ Стаб «Полис»'] },
				{ to: 'himmash', x0: -2.5, x1: 2.5, z0: -50, z1: -45.2, spawn: [0, -42.5, 0], sign: [4, -44.2, '↑ Химмаш'] },
			],
			groups: [
				{ at: [-9, -12], r: 5, runners: 2 },
				{ at: [9, -12], r: 5, runners: 2 },
				{ at: [-38, -11], r: 5, runners: 1 },
				{ at: [38, -11], r: 5, runners: 2 },
				{ at: [-23.5, -9], r: 6, runners: 1 },
				{ at: [-9, -36], r: 5, runners: 2 },
				{ at: [23.5, -36], r: 5, runners: 1, stompers: 1 },
				{ at: [0, -22], r: 10, runners: 2 },
				{ at: [-23.5, 18], r: 5, runners: 2 },
				{ at: [23.5, 18], r: 5, runners: 1 },
				{ at: [9, 13], r: 4, runners: 1, stompers: 1 },
				{ at: [-27, 28], r: 6, runners: 1 },
				{ at: [-30, 4], r: 8, runners: 2 },
				{ at: [30, -22], r: 6, stompers: 1 },
			],
			onRoad,
			fires: [[0.3, -32, 'car'], [11, 7.6], [-26, -19.5, 'ground']],
			water: [[-27, 36, 9, 5.5]],
			trees(tryTree) {
				// яблони на участках, сосновый лес по краям, берёзы у пруда
				for (const [cx, cz, D] of appleSpots) for (let k = 0; k < 3; k++) tryTree(cx + R(-5.5, 5.5), cz + R(-D / 2 + 1.5, D / 2 - 1.5), 'apple');
				for (let i = 0; i < 26; i++) tryTree(R(-47, 47), R(-47, -45), 'pine');
				for (let i = 0; i < 12; i++) tryTree(R(-47, -45.5), R(-44, 44), 'pine');
				for (let i = 0; i < 12; i++) tryTree(R(45.5, 47), R(-44, 44), 'pine');
				for (let i = 0; i < 18; i++) tryTree(R(-46, -10), R(28, 46), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 18; i++) tryTree(R(10, 46), R(28, 46), rnd() < 0.5 ? 'birch' : 'pine');
			},
			clutter: 10,
			blood: 18,
			puddles: 10,
			puddle: () => [R(-45, 45), rnd() < 0.6 ? R(2, 6) : R(-44, 44)],
			grass: 1.2,
			hint: (b) => (b.name === 'Guardhouse' ? 'Сторожка — в оружейном шкафу бывают обрезы и патроны 12 калибра' : 'Дачный домик — обыщи шкаф, сундук и буфет'),
		};
	},
};
