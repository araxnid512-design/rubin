// Кластер «Химмаш»: кусок заводской промзоны, который Улей перенёс вместе с цехами и складами.
// Север — территория завода за бетонным забором: цех №3 (раздевалка, конторка мастера с сейфом), склад №2
// со стеллажами, котельная с трубой, водонапорная башня, ж/д тупик с цистернами, ёмкости аммиака и кислоты,
// эстакада труб. Через центр — дорога: на запад к Дачам, на восток к военной части; на юг — к Заречному,
// мимо заводоуправления и стоянки. Кластер глубже в Улье: много топтунов и руберы.
// Окраина: склад у ж/д ветки на севере, нефтебаза на востоке, автобаза со сторожкой и складом, щит у дороги.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, beginProp, endProp } from '../geom.js';
import { buildWorkshop, buildWarehouse, buildGuardhouse } from '../buildings.js';
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
		ground(6, 56, 8, 40, M.asphalt, 5, 0.022); // на юг, к Заречному
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
				for (const x of [-3, 0, 3]) { const win = T.windowUV(new THREE.PlaneGeometry(1.4, 2.0), x === 0 ? 1 : 0); win.translate(cx + x, 3.6, cz + D / 2 + 0.01); kb.add(win, M.window); }
				kb.add(place(box(1.6, 2.4, 0.1), cx - 3.6, 1.2, cz + D / 2 + 0.05), M.metalDark);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.6, top: H + 0.4 }, 0.25);
			collide(cx, cz, W, D);
		}
		occluder('Chimney', (kb) => chimney(kb, M, collide, 39.5, -34, 26), { cx: 39.5, cz: -34, ry: 0, hx: 2.1, hz: 2.1, top: 28.5 }, 0.2);
		occluder('WaterTower', (kb) => waterTower(kb, M, collide, -37, -27), { cx: -37, cz: -27, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);

		// ---------- Эстакада труб, ёмкости, штабели, бочки ----------
		pipeRack(batch, M, collide, -30, 26, -25);
		storageTank(batch, M, root, collide, 36.5, -9, 3.2, 7, M.tankWhite, 'АММИАК');
		storageTank(batch, M, root, collide, 36.5, -18, 2.6, 6, M.tankWhite, 'КИСЛОТА');
		pipePile(batch, M, collide, 4, -30, 0);
		pipePile(batch, M, collide, -32, -4.5, 0.05);
		hazardBarrels(batch, M, collide, -4.5, -19, rnd, 6);
		hazardBarrels(batch, M, collide, 28.5, -18.5, rnd, 4);
		// бетонные блоки и катушки кабеля
		for (const [x, z, r] of [[-41, -12, 0.1], [-41, -15, 0], [10, -24, 0.4], [-10, -29, 0.2]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }
		for (const [x, z] of [[24, -3.5], [-36, -38]]) {
			batch.add(place(new THREE.CylinderGeometry(0.9, 0.9, 0.14, 16).rotateX(Math.PI / 2), x, 0.9, z - 0.5), M.wood);
			batch.add(place(new THREE.CylinderGeometry(0.9, 0.9, 0.14, 16).rotateX(Math.PI / 2), x, 0.9, z + 0.5), M.wood);
			batch.add(place(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 14).rotateX(Math.PI / 2), x, 0.9, z), M.tire);
			collide(x, z, 1.9, 1.2);
		}

		// ---------- Ж/д тупик: цистерны и платформа с контейнером ----------
		railTrack(batch, M, -64, 47, -39.5);
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
						// окна разные (выбитые, заколоченные, с газетой) — по месту, без генератора случайных чисел
						const win = T.windowUV(new THREE.PlaneGeometry(1.2, 1.4), [0, 0, 1, 0, 2, 0, 3, 1, 0][(i * 5 + Math.round(y) * 3 + (face > 0 ? 0 : 4)) % 9]);
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
		collide(-5, 17, 2.6, 7.8, Math.PI / 2 + 0.06); // автобус длинный по своей оси Z (коллайдер стоял поперёк)
		// контейнерная площадка и грузовик
		for (const [x, z, h, r, tint] of [[26, 22, 0, 0, [62, 88, 112]], [26, 22, 2.6, 0.04, [150, 70, 44]], [33, 22.5, 0, 0.1, [70, 96, 70]], [27, 29, 0, Math.PI / 2, [150, 128, 70]]]) {
			batch.add(place(box(6, 2.6, 2.4, 1.5), x, h + 1.3, z, r), T.metalRoofMaterial([1, 1], tint));
			if (!h) collide(x, z, 6, 2.4, r);
		}
		armyTruck(batch, M, root, collide, 18, 33, 0.2);
		for (const x of [-40, -12, 22, 40]) streetLamp(batch, M, collide, x, 12.8);
		powerLine(batch, root, M, collide, -44, 44, 44);

		// ---------- Окраина ----------
		// север: склад у ж/д ветки, штабели труб и бочки
		buildings.push(
			buildWarehouse(bctx, { name: 'Warehouse3', cx: -40, cz: -54, ry: Math.PI }),
			buildWarehouse(bctx, { name: 'Depot', cx: 54, cz: 42, ry: Math.PI / 2 }),
			buildGuardhouse(bctx, { name: 'Booth', cx: -54, cz: 30, ry: -Math.PI / 2 }),
		);
		pipePile(batch, M, collide, -22, -52, 0.1);
		pipePile(batch, M, collide, -56, -44, Math.PI / 2);
		hazardBarrels(batch, M, collide, -28, -57, rnd, 5);
		flatWagon(batch, M, collide, -52, -39.5, 0, T.metalRoofMaterial([1, 1], [62, 88, 112]));
		// восток: нефтебаза — две ёмкости за дорогой на север
		storageTank(batch, M, root, collide, 55, -24, 4.4, 8, M.tankWhite, 'МАЗУТ');
		storageTank(batch, M, root, collide, 55, -9, 3.4, 7, M.tankBlack, 'ДИЗЕЛЬ');
		hazardBarrels(batch, M, collide, 49, -36, rnd, 5);
		// юг: автобаза — сторожка, склад, машины; рекламный щит у дороги
		armyTruck(batch, M, root, collide, 46, 30, Math.PI / 2 + 0.1);
		addCar(batch, M, root, -48, 38, 0.3, 0x5a5a3a, { burned: true });
		collide(-48, 38, 4.3, 1.8, 0.3);
		billboard(batch, M, root, collide, 16, 56, 0, 'ХИММАШ — 70 ЛЕТ ТРУДА', { w: 6, h: 1.2, y: 3.4 });

		const exits = [
			{ to: 'dachi', x0: -66, x1: -61.2, z0: 4, z1: 12, spawn: [-59, 8, Math.PI / 2], sign: [-60, 13.2, '← Дачи'] },
			{ to: 'zarechny', x0: 5, x1: 11, z0: 61.2, z1: 66, spawn: [8, 59, Math.PI], sign: [12, 60.2, '↓ Заречный'] },
			{ to: 'voench', x0: 61.2, x1: 66, z0: 4, z1: 12, spawn: [59, 8, -Math.PI / 2], sign: [60, 13.2, 'Военная часть →'] },
		];
		return {
			start: [-59, 8, Math.PI / 2],
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
				// окраина
				{ at: [-40, -46], r: 6, runners: 2, stompers: 1 },
				{ at: [50, -16], r: 6, runners: 1, stompers: 1 },
				{ at: [44, 42], r: 6, runners: 2 },
				{ at: [-48, 30], r: 5, runners: 2 },
				{ at: [0, 56], r: 8, stompers: 1 },
				{ at: [-56, -20], r: 6, runners: 2 },
			],
			onRoad,
			fires: [[-28, 16.2, 'car'], [15, -7.5], [-8, -30, 'ground']],
			barrels: 8, // промзона: бочки с горючим повсюду
			trees(tryTree) {
				// берёзы и тополя вдоль дороги и у заводоуправления; на заводе — редкие деревца у забора
				for (let i = 0; i < 30; i++) tryTree(R(-62, 62), R(13.5, 14.5), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 20; i++) tryTree(R(-46, -38), R(16, 46), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(14, 46), R(36, 46), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(-42, 42), R(-1, 0.5), 'birch');
			},
			clutter: 22,
			blood: 22,
			puddles: 16,
			puddle: () => [R(-44, 44), rnd() < 0.5 ? R(5, 11) : R(-36, 0)],
			grass: 0.6,
			hint: (b) => ({
				Workshop: 'Цех №3 — шкафчики в раздевалке, верстак, сейф мастера в конторке',
				Booth: 'Сторожка автобазы — шкафчик охранника, стол',
				Depot: 'Склад автобазы — стеллажи с ящиками',
				Warehouse3: 'Склад у ж/д ветки — стеллажи с ящиками, бывают гранаты',
			}[b.name] ?? 'Склад №2 — на стеллажах ящики с патронами, бывают гранаты'),
		};
	},
};
