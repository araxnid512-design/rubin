// Кластер «Заречный»: кусок посёлка у трассы — хрущёвка, гаражи, частные дома, магазин «Продукты».
// Выходы: на восток по трассе (к стабу) и на запад за баррикаду (к дачам).

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ } from '../geom.js';
import { buildHouse, buildShop } from '../buildings.js';
import {
	bench, swings, slide, streetLamp, barricade, garden, woodpile, outhouse, clothesline, bicycle,
	settlementSign, fencePlot, shed, well, addCar, bus, markingMaterial,
} from '../props.js';

export default {
	id: 'zarechny',
	seed: 1337,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// трасса (запад—восток) и улица на север
		ground(150, 8, 0, 6, M.asphalt, 5, 0.02);
		ground(150, 1.6, 0, 1.2, M.dirt, 3, 0.014);
		ground(150, 1.6, 0, 10.8, M.dirt, 3, 0.014);
		ground(6, 58, 12, -27, M.asphalt, 5, 0.022);
		ground(150, 0.15, 0, 6, markingMaterial(), 6, 0.026);
		// грунтовка к частным домам, двор хрущёвки, площадка у гаражей
		ground(56, 4, -18, -22, M.dirt, 4, 0.016);
		ground(42, 12, -18, 18, M.dirt, 5, 0.014);
		ground(40, 8, 20, 34, M.dirt, 5, 0.014);
		ground(14, 10, 26, -10, M.dirt, 4, 0.015);

		// ---------- Хрущёвка (5 этажей) ----------
		{
			const cx = -18, cz = 30, W = 38.4, D = 12, H = 14;
			occluder('Khrushchyovka', (kb) => {
				kb.add(place(box(W, H, D, 3.2, 2.8), cx, H / 2 + 0.6, cz), M.panel);
				kb.add(place(box(W + 0.3, 0.8, D + 0.3, 2), cx, 0.4, cz), M.concreteDark); // цоколь
				kb.add(place(box(W + 0.4, 0.5, D + 0.4, 4), cx, H + 0.85, cz), M.concrete); // парапет
				kb.add(place(box(W, 0.1, D, 4), cx, H + 1.1, cz), M.roofTar);
				for (const ex of [-12.8, 0, 12.8]) {
					const x = cx + ex, z = cz - D / 2;
					kb.add(place(box(2.6, 0.15, 1.6), x, 2.9, z - 0.8), M.concrete); // козырёк
					kb.add(place(box(1.3, 2.2, 0.1), x, 1.7, z - 0.05), M.metalDark); // дверь
				}
				// балконы на северном фасаде
				for (let floor = 1; floor < 5; floor++) for (let c = 0; c < 12; c++) {
					if (c % 4 === 0 || rnd() < 0.45) continue;
					const x = cx - W / 2 + 1.6 + c * 3.2, y = 0.6 + floor * 2.8, z = cz - D / 2 - 0.55;
					kb.add(place(box(2.8, 0.12, 1.1), x, y, z), M.concrete);
					kb.add(place(box(2.8, 1.0, 0.06, 1), x, y + 0.56, z - 0.52), rnd() < 0.5 ? M.metalRust : M.woodGrey);
				}
			}, { cx, cz, ry: 0, hx: W / 2 + 0.6, hz: D / 2 + 1.2, top: H + 1.5 }, 0.16);
			collide(cx, cz, W + 0.4, D + 0.4);
			for (const ex of [-12.8, 0, 12.8]) {
				const x = cx + ex, z = cz - D / 2;
				batch.add(place(box(2.4, 0.3, 1.2, 1), x, 0.15, z - 0.6), M.concrete); // крыльцо
				// лавочки у подъезда
				bench(batch, M, x + 2.2, z - 2.2, 0);
				bench(batch, M, x - 2.2, z - 2.2, 0);
			}
			// детская площадка
			swings(batch, M, -26, 16);
			batch.add(place(box(3, 0.3, 3, 1), -16, 0.15, 17), M.wood); // песочница
			batch.add(place(planeXZ(2.7, 2.7, 1), -16, 0.31, 17), M.sand, { cast: false });
			collide(-16, 17, 3, 3);
			slide(batch, M, -21, 21);
			// мусорные контейнеры
			for (let i = 0; i < 3; i++) {
				batch.add(place(box(1.2, 1.1, 0.9, 1), -1 + i * 1.4, 0.55, 22, R(-0.1, 0.1)), M.green);
			}
			collide(0.4, 22, 4.4, 1);
		}

		// ---------- Гаражи ----------
		{
			const z0 = 41, n = 9, w = 4;
			occluder('Garages', (gb, group) => {
				for (let i = 0; i < n; i++) {
					const x = 4 + i * w;
					gb.add(place(box(w, 2.6, 6, 1.2), x, 1.3, z0), i % 3 === 0 ? M.whiteBrick : M.brick);
					gb.add(place(box(w + 0.1, 0.12, 6.4, 2), x, 2.66, z0 - 0.1, 0, -0.04), M.roofTar);
					const door = new THREE.Mesh(box(3, 2.2, 0.08), T.garageDoorMaterial(i));
					door.position.set(x, 1.1, z0 - 3.02);
					door.castShadow = true; door.receiveShadow = true;
					group.add(door);
				}
			}, { cx: 4 + (n - 1) * w / 2, cz: z0, ry: 0, hx: n * w / 2 + 0.2, hz: 3.3, top: 2.9 }, 0.3);
			collide(4 + (n - 1) * w / 2, z0, n * w, 6);
		}

		// ---------- Частные дома (можно зайти) ----------
		buildings.push(
			buildHouse(bctx, { name: 'House1', cx: -30, cz: -10, ry: 0, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: -30, cz: -34, ry: Math.PI, rnd, variant: 1 }),
			buildHouse(bctx, { name: 'House3', cx: -6, cz: -34, ry: Math.PI, rnd, variant: 2 }),
		);
		fencePlot(batch, M, collide, -30, -10, 18, 14, 'n', rnd);
		fencePlot(batch, M, collide, -30, -34, 18, 14, 's', rnd);
		fencePlot(batch, M, collide, -6, -34, 16, 14, 's', rnd);
		shed(batch, M, collide, -37.2, -4.4, 0.1);
		shed(batch, M, collide, -23.4, -39.8, 2.9);
		well(batch, M, collide, -8, -12);

		// ---------- Магазин «Продукты» (можно зайти) ----------
		{
			const cx = 30, cz = -10, W = 9;
			buildings.push(buildShop(bctx, { cx, cz }));
			// ящики и поддоны у чёрного хода
			for (let i = 0; i < 4; i++) batch.add(place(box(1.2, 0.15, 0.8), cx + W / 2 + 1, 0.08 + i * 0.16, cz + 4, R(-0.2, 0.2)), M.wood);
			collide(cx + W / 2 + 1, cz + 4, 1.3, 1);
		}

		// ---------- Остановка ----------
		{
			const x = 30, z = 0.2;
			batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z - 0.9), M.concrete);
			batch.add(place(box(5.4, 0.15, 2.2, 1), x, 2.45, z), M.metalRust);
			for (const dx of [-2.4, 2.4]) batch.add(place(box(0.15, 2.4, 2, 1), x + dx, 1.2, z), M.concrete);
			batch.add(place(box(4, 0.08, 0.5), x, 0.5, z - 0.55), M.wood);
			collide(x, z - 0.4, 5.2, 1.2);
		}

		// ---------- Водонапорная башня ----------
		{
			const x = 38, z = -38;
			const pipe = new THREE.CylinderGeometry(0.9, 1.1, 12, 12);
			batch.add(place(pipe, x, 6, z), M.metalRust);
			const tank = new THREE.CylinderGeometry(2.6, 2.6, 3.5, 16);
			batch.add(place(tank, x, 13.6, z), M.metalRust);
			const cone = new THREE.ConeGeometry(2.8, 1.4, 16);
			batch.add(place(cone, x, 16.1, z), M.metalRust);
			collide(x, z, 2.4, 2.4);
		}

		// ---------- Столбы ЛЭП с проводами ----------
		{
			const poles = [-44, -22, 0, 22, 44].map((x) => [x, 0.4]);
			const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
			poles.forEach(([x, z], i) => {
				batch.add(place(box(0.28, 9, 0.28, 1, 3), x, 4.5, z, 0, 0, i === 3 ? 0.12 : 0), M.concrete);
				batch.add(place(box(2.2, 0.14, 0.14), x, 8.4, z, 0, 0, i === 3 ? 0.12 : 0), M.wood);
				collide(x, z, 0.5, 0.5);
				if (i === 0) return;
				const [px] = poles[i - 1];
				for (const off of [-0.9, 0, 0.9]) {
					const pts = [];
					for (let k = 0; k <= 16; k++) {
						const t = k / 16;
						pts.push(new THREE.Vector3(px + (x - px) * t + off * 0, 8.45 - Math.sin(Math.PI * t) * 1.1, z + off));
					}
					root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
				}
			});
		}

		// ---------- Машины ----------
		const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
		car(-30, 4.4, 0.18, 0x7b8a5a);
		car(4.5, 7.6, -2.95, 0xa8a49a);
		car(20, 4.2, 0.9, 0x8a2e24, { crashed: true });
		car(-34, 14.5, Math.PI / 2 + 0.05, 0x3a5a7a);
		car(-9, 15, Math.PI / 2 - 0.08, 0xc8c0a8);
		car(-4, -8, 0.6, 0x222222, { burned: true });
		car(22, -18, 0.35, 0x5a6a3a);
		bus(batch, M, root, 12, -27, 0.08);
		collide(12, -27, 2.6, 8.4, 0.08);

		// ---------- Обжитость: фонари, бордюры, баррикада, огороды, дворы, брошенные вещи ----------
		// бордюры вдоль трассы (на перекрёстке с улицей — разрыв)
		for (const [x0, x1, z] of [[-48, 8.6, 1.95], [15.4, 48, 1.95], [-48, 48, 10.05]]) {
			batch.add(place(box(x1 - x0, 0.14, 0.24, 2), (x0 + x1) / 2, 0.07, z), M.concrete, { cast: false });
		}
		for (const x of [-40, -16, 8, 32]) streetLamp(batch, M, collide, x, 11.4);
		barricade(batch, M, collide, -41.2, rnd);
		// огороды с грядками, поленницы, туалеты и бельё во дворах частных домов
		garden(batch, M, rnd, -24.0, -10, 3, 9);
		garden(batch, M, rnd, -24.0, -33, 3, 8.5);
		garden(batch, M, rnd, -12.9, -34, 2, 9);
		woodpile(batch, M, collide, -36.8, -7.8, Math.PI / 2);
		woodpile(batch, M, collide, -36.8, -31.2, Math.PI / 2);
		woodpile(batch, M, collide, 0.6, -33.2, Math.PI / 2);
		outhouse(batch, M, collide, -37.4, -15.6, 0);
		outhouse(batch, M, collide, -37.4, -39.6, Math.PI);
		outhouse(batch, M, collide, 1.0, -39.6, Math.PI);
		clothesline(batch, M, root, collide, -33.5, -27.5, -4.4, rnd);
		// мешки с мусором у баков, брошенные чемоданы и велосипед на трассе, знак посёлка
		for (const [x, z] of [[-2.3, 22.7], [3.0, 21.5], [2.7, 23.1], [-1.7, 23.4], [3.6, 22.4]]) {
			batch.add(place(new THREE.IcosahedronGeometry(0.32, 1).scale(1, 0.75, 1), x, 0.22, z, R(0, 3)), M.tire);
		}
		for (const [x, z, r] of [[22.6, 6.2, 0.4], [17.6, 7.4, 2.1], [-12.5, 3.6, 1.2]]) {
			batch.add(place(box(0.62, 0.42, 0.24), x, 0.13, z, r, Math.PI / 2), M.red);
			batch.add(place(box(0.2, 0.03, 0.04), x, 0.26, z, r), M.metalDark);
		}
		bicycle(batch, M, -20, 8.2, 0.6);
		settlementSign(batch, M, root, collide, 40.5, 11.8, 'ЗАРЕЧНЫЙ');


		const onRoad = (x, z, m = 0) => Math.abs(z - 6) < 5.5 + m || (Math.abs(x - 12) < 3.5 + m && z < 3 + m);
		return {
			start: [42, 6, -Math.PI / 2], // на восточном конце трассы, у края кластера
			exits: [
				{ to: 'stab', x0: 45.2, x1: 50, z0: 2, z1: 10, spawn: [42, 6, -Math.PI / 2], sign: [44, 12.2, 'Стаб «Полис» →'] },
				{ to: 'dachi', x0: -50, x1: -45.2, z0: 2, z1: 10, spawn: [-43.2, 6, Math.PI / 2], sign: [-44, 12.2, '← Дачи'] },
				{ to: 'himmash', x0: 9, x1: 15, z0: -50, z1: -45.2, spawn: [12, -43, 0], sign: [16, -44.2, '↑ Химмаш'] },
			],
			// заражённые уже в кластере: группы у дома, гаражей, огородов, магазина, на дорогах
			groups: [
				{ at: [-24, 17], r: 6, runners: 2 },
				{ at: [-18, 22], r: 9, runners: 1 },
				{ at: [20, 33], r: 12, runners: 2, stompers: 1 },
				{ at: [-30, -10], r: 6, runners: 2 },
				{ at: [-30, -34], r: 6, runners: 1 },
				{ at: [-6, -34], r: 6, runners: 2 },
				{ at: [-6, -10], r: 5, runners: 1 },
				{ at: [24, -10], r: 5, runners: 2, stompers: 1 },
				{ at: [12, -26], r: 6, runners: 2 },
				{ at: [36, -30], r: 8, runners: 2, stompers: 1 },
				{ at: [-36, 6], r: 8, runners: 2 },
				{ at: [4, 6], r: 6, runners: 1 },
				{ at: [-40, 40], r: 5, stompers: 1 },
			],
			onRoad,
			trees(tryTree) {
				for (let i = 0; i < 30; i++) tryTree(R(26, 46), R(-46, -22), rnd() < 0.8 ? 'birch' : 'pine'); // роща
				for (let i = 0; i < 16; i++) tryTree(R(-38, 0), R(12, 24) - (rnd() < 0.5 ? 0 : -2), 'birch'); // двор
				for (let i = 0; i < 40; i++) tryTree(R(-47, 47), R(-47, 47), rnd() < 0.7 ? 'birch' : (rnd() < 0.5 ? 'pine' : 'apple'));
				for (let i = 0; i < 14; i++) tryTree(R(-46, 46), R(44, 47), 'pine');
			},
			puddle: () => [R(-45, 45), rnd() < 0.6 ? R(3, 9) : R(-44, 44)],
			hint: (b) => (b.name === 'Shop' ? 'Магазин «Продукты» — обыщи прилавок и подсобку' : 'Дом — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
