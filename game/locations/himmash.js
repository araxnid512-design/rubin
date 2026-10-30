// Кластер «Химмаш»: кусок заводской промзоны, который Улей перенёс вместе с цехами и складами.
// Север — территория завода за бетонным забором: цех №3 (раздевалка, конторка мастера с сейфом), склад №2
// со стеллажами, котельная с трубой, водонапорная башня, ж/д тупик с цистернами, ёмкости аммиака и кислоты,
// эстакада труб. Через центр — дорога: на запад к Дачам, на восток к военной части; на юг — к Заречному,
// мимо заводоуправления и стоянки. Кластер глубже в Улье: много топтунов и два рубера.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place } from '../geom.js';
import { buildWorkshop, buildWarehouse } from '../buildings.js';
import { addCar, bus, streetLamp, powerLine, markingMaterial } from '../props.js';
import {
	concreteFence, railTrack, tankWagon, flatWagon, waterTower, chimney, pipeRack, storageTank, pipePile, hazardBarrels, armyTruck, billboard,
} from '../props-industrial.js';

export default {
	id: 'himmash',
	seed: 1957,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;

		// ---------- Дороги и площадки ----------
		ground(150, 8, 0, 8, M.asphalt, 5, 0.02);
		ground(150, 0.15, 0, 8, markingMaterial(), 6, 0.026);
		ground(6, 40, 8, 32, M.asphalt, 5, 0.022); // на юг, к Заречному
		ground(88, 46, 0, -23, M.dirt, 5, 0.012); // заводской двор
		ground(8, 34, 0, -14, M.concrete, 4, 0.018); // проезд от ворот
		ground(84, 6, 0, -3.5, M.concrete, 4, 0.017); // вдоль цехов
		ground(30, 7, -24, 16, M.asphalt, 5, 0.019); // стоянка у заводоуправления
		const onRoad = (x, z, m = 0) => Math.abs(z - 8) < 4.5 + m || (Math.abs(x - 8) < 3.5 + m && z > 8)
			|| (Math.abs(x) < 4.5 + m && z < 2 && z > -31) || (Math.abs(z + 3.5) < 3.5 + m && Math.abs(x) < 42);

		// ---------- Заводской забор с воротами, колючка поверху ----------
		concreteFence(batch, M, collide, root, -44, 2, -4.2, 2);
		concreteFence(batch, M, collide, root, 4.2, 2, 44, 2);
		concreteFence(batch, M, collide, root, -44, 2, -44, -33);
		concreteFence(batch, M, collide, root, 44, 2, 44, -33);
		billboard(batch, M, root, collide, 0, 2, 0, 'ЗАВОД «ХИММАШ»', { w: 8.6, h: 1.1, y: 4.3, bg: '#2a2c26', fg: '#e8dcae' });
		// распахнутые створки ворот
		for (const s of [-1, 1]) batch.add(place(box(3.6, 2.2, 0.08), s * 5.9, 1.15, 3.4, s * 0.25), M.metalOlive);

		// ---------- Цех №3 и склад №2 (входы с юга, к дороге) ----------
		buildings.push(buildWorkshop(bctx, { name: 'Workshop', cx: -18, cz: -14, ry: Math.PI }));
		buildings.push(buildWarehouse(bctx, { name: 'Warehouse', cx: 18, cz: -12, ry: Math.PI }));

		// ---------- Котельная с трубой, водонапорная башня ----------
		{
			const cx = 32, cz = -29, W = 10, D = 7, H = 6;
			occluder('Boiler', (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.brick);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (const x of [-3, 0, 3]) { const win = new THREE.PlaneGeometry(1.4, 2.0); win.translate(cx + x, 3.6, cz + D / 2 + 0.01); kb.add(win, M.window); }
				kb.add(place(box(1.6, 2.4, 0.1), cx - 3.6, 1.2, cz + D / 2 + 0.05), M.metalDark);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.6, top: H + 0.4 }, 0.25);
			collide(cx, cz, W, D);
		}
		chimney(batch, M, collide, 39.5, -34, 26);
		waterTower(batch, M, collide, -37, -27);

		// ---------- Эстакада труб, ёмкости, штабели, бочки ----------
		pipeRack(batch, M, collide, -30, 26, -25);
		storageTank(batch, M, root, collide, 36.5, -9, 3.2, 7, M.tankWhite, 'АММИАК');
		storageTank(batch, M, root, collide, 36.5, -18, 2.6, 6, M.tankWhite, 'КИСЛОТА');
		pipePile(batch, M, collide, 4, -30, 0);
		pipePile(batch, M, collide, -32, -4.5, 0.05);
		hazardBarrels(batch, M, collide, -4.5, -19, rnd, 6);
		hazardBarrels(batch, M, collide, 28.5, -18.5, rnd, 4);
		// бетонные блоки и катушки кабеля
		for (const [x, z, r] of [[-41, -12, 0.1], [-41, -15, 0], [10, -24, 0.4], [-10, -29, 0.2]]) { batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); collide(x, z, 1.8, 0.9, r); }
		for (const [x, z] of [[24, -3.5], [-36, -38]]) {
			batch.add(place(new THREE.CylinderGeometry(0.9, 0.9, 0.14, 16).rotateX(Math.PI / 2), x, 0.9, z - 0.5), M.wood);
			batch.add(place(new THREE.CylinderGeometry(0.9, 0.9, 0.14, 16).rotateX(Math.PI / 2), x, 0.9, z + 0.5), M.wood);
			batch.add(place(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 14).rotateX(Math.PI / 2), x, 0.9, z), M.tire);
			collide(x, z, 1.9, 1.2);
		}

		// ---------- Ж/д тупик: цистерны и платформа с контейнером ----------
		railTrack(batch, M, -47, 47, -39.5);
		tankWagon(batch, M, collide, -24, -39.5, 0, M.tankBlack);
		tankWagon(batch, M, collide, -12.8, -39.5, 0, M.tankBlack);
		flatWagon(batch, M, collide, 2, -39.5, 0, T.metalRoofMaterial([1, 1], [150, 70, 44]));
		tankWagon(batch, M, collide, 22, -39.5, 0, M.tankWhite);
		// упор в конце тупика
		batch.add(place(box(0.6, 1.2, 3.0), 44.5, 0.6, -39.5), M.red);
		collide(44.5, -39.5, 0.6, 3.0);

		// ---------- Юг: заводоуправление, стоянка, остановка ----------
		{
			const cx = -26, cz = 27, W = 22, D = 10, H = 9.4;
			occluder('Admin', (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.brick);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (let i = 0; i < 7; i++) for (const y of [1.7, 4.8, 7.9]) {
					for (const face of [1, -1]) {
						const win = new THREE.PlaneGeometry(1.2, 1.4);
						if (face < 0) win.rotateY(Math.PI);
						win.translate(cx - W / 2 + 2 + i * 3, y, cz + face * (D / 2 + 0.01));
						kb.add(win, M.window);
					}
				}
				kb.add(place(box(2.4, 2.4, 0.1), cx, 1.2, cz - D / 2 - 0.05), M.metalDark); // вход с дороги
				kb.add(place(box(4, 0.2, 1.6), cx, 2.7, cz - D / 2 - 0.8), M.concrete);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 1, top: H + 2 }, 0.25);
			collide(cx, cz, W, D);
			// буквы на крыше — к камере
			const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), T.signMaterial('ХИММАШ', { bg: '#7a1c14', fg: '#f0e0c0', w: 640, h: 108 }));
			sign.position.set(cx, H + 1.1, cz + D / 2 - 0.4);
			root.add(sign);
			batch.add(place(box(9.2, 0.15, 0.15), cx, H + 0.3, cz + D / 2 - 0.45), M.metalDark);
		}
		addCar(batch, M, root, -33, 15.5, Math.PI / 2, 0x7a2a22);
		collide(-33, 15.5, 4.3, 1.8, Math.PI / 2);
		addCar(batch, M, root, -28, 16.2, Math.PI / 2 + 0.1, 0xb8b0a0, { burned: true });
		collide(-28, 16.2, 4.3, 1.8, Math.PI / 2 + 0.1);
		addCar(batch, M, root, -17, 15.6, -Math.PI / 2, 0x3a5a6a);
		collide(-17, 15.6, 4.3, 1.8, -Math.PI / 2);
		bus(batch, M, root, -5, 17, Math.PI / 2 + 0.06);
		collide(-5, 17, 7.8, 2.6, Math.PI / 2 + 0.06);
		// контейнерная площадка и грузовик
		for (const [x, z, h, r, tint] of [[26, 22, 0, 0, [62, 88, 112]], [26, 22, 2.6, 0.04, [150, 70, 44]], [33, 22.5, 0, 0.1, [70, 96, 70]], [27, 29, 0, Math.PI / 2, [150, 128, 70]]]) {
			batch.add(place(box(6, 2.6, 2.4, 1.5), x, h + 1.3, z, r), T.metalRoofMaterial([1, 1], tint));
			if (!h) collide(x, z, 6, 2.4, r);
		}
		armyTruck(batch, M, root, collide, 18, 33, 0.2);
		for (const x of [-40, -12, 22, 40]) streetLamp(batch, M, collide, x, 12.8);
		powerLine(batch, root, M, collide, -44, 44, 44);

		const exits = [
			{ to: 'dachi', x0: -50, x1: -45.2, z0: 4, z1: 12, spawn: [-43, 8, Math.PI / 2], sign: [-44, 13.2, '← Дачи'] },
			{ to: 'zarechny', x0: 5, x1: 11, z0: 45.2, z1: 50, spawn: [8, 43, Math.PI], sign: [12, 44.2, '↓ Заречный'] },
			{ to: 'voench', x0: 45.2, x1: 50, z0: 4, z1: 12, spawn: [43, 8, -Math.PI / 2], sign: [44, 13.2, 'Военная часть →'] },
		];
		return {
			start: [-43, 8, Math.PI / 2],
			exits,
			// развитые заражённые: топтуны по двору, два рубера — у цистерн и у ёмкостей
			groups: [
				{ at: [-15, -3], r: 5, runners: 2 },
				{ at: [-20, -16], r: 4, runners: 1, stompers: 1 },
				{ at: [16, -2.5], r: 5, runners: 1, stompers: 1 },
				{ at: [0, -33], r: 6, rubers: 1 },
				{ at: [28, -30], r: 5, runners: 1, stompers: 1 },
				{ at: [-34, -20], r: 5, stompers: 1 },
				{ at: [-24, 19], r: 6, runners: 2 },
				{ at: [29, 25.5], r: 5, runners: 1, stompers: 1 },
				{ at: [30, -13], r: 4, rubers: 1 },
				{ at: [6, 8], r: 8, runners: 1 },
				{ at: [8, 30], r: 6, stompers: 1 },
			],
			onRoad,
			trees(tryTree) {
				// берёзы и тополя вдоль дороги и у заводоуправления; на заводе — редкие деревца у забора
				for (let i = 0; i < 22; i++) tryTree(R(-46, 46), R(13.5, 14.5), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 20; i++) tryTree(R(-46, -38), R(16, 46), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(14, 46), R(36, 46), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(-42, 42), R(-1, 0.5), 'birch');
			},
			clutter: 22,
			blood: 22,
			puddles: 16,
			puddle: () => [R(-44, 44), rnd() < 0.5 ? R(5, 11) : R(-36, 0)],
			grass: 0.6,
			hint: (b) => (b.name === 'Workshop' ? 'Цех №3 — шкафчики в раздевалке, верстак, сейф мастера в конторке' : 'Склад №2 — на стеллажах ящики с патронами, бывают гранаты'),
		};
	},
};
