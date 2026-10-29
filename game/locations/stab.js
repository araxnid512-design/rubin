// Стаб «Полис»: стабильный кусок Улья, который не перезагружается. Бетонный забор с колючкой,
// вышки с охраной, ворота на юг, лавка торговца в контейнере, палатка лекаря, казарма, костёр.
// Заражённых здесь нет: можно торговать, лечиться и отдыхать.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place } from '../geom.js';
import { bench, addCar, streetLamp } from '../props.js';

const WX = 19, WZ = 15; // половины размеров территории за забором

export default {
	id: 'stab',
	seed: 77,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder } = ctx;
		ground(2 * WX, 2 * WZ, 0, 0, M.dirt, 5, 0.014);
		ground(5, 40, 0, 34, M.dirt, 4, 0.016); // дорога от ворот на юг
		// бетонные плиты на плацу
		for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
			if (rnd() < 0.15) continue;
			ground(2.9, 1.9, i * 3, 2 + j * 2, M.concrete, 3, 0.02 + rnd() * 0.004);
		}

		// ---------- Забор с колючкой и ворота (на юг) ----------
		const fenceMat = M.concrete;
		const wire = new THREE.LineBasicMaterial({ color: 0x3a3a38 });
		const fenceRun = (x0, z0, x1, z1) => {
			const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
			const n = Math.max(1, Math.round(len / 3));
			for (let i = 0; i < n; i++) {
				const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
				batch.add(place(box(len / n - 0.04, 2.6, 0.18, 1.5, 1.3), x, 1.3, z, -ang), fenceMat);
			}
			collide((x0 + x1) / 2, (z0 + z1) / 2, len, 0.4, -ang);
			// колючая проволока поверху
			for (const dy of [2.75, 2.95]) {
				const pts = [];
				for (let k = 0; k <= Math.ceil(len * 4); k++) {
					const t = k / Math.ceil(len * 4);
					pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, dy + Math.sin(k * 2.1) * 0.06, z0 + (z1 - z0) * t));
				}
				root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
			}
		};
		const gate = 2.4; // половина ширины проёма ворот
		fenceRun(-WX, -WZ, WX, -WZ);
		fenceRun(-WX, -WZ, -WX, WZ);
		fenceRun(WX, -WZ, WX, WZ);
		fenceRun(-WX, WZ, -gate, WZ);
		fenceRun(gate, WZ, WX, WZ);
		// распахнутые створки ворот и надпись над воротами
		for (const s of [-1, 1]) {
			batch.add(place(box(0.35, 3.2, 0.35), s * gate, 1.6, WZ), M.metalDark);
			batch.add(place(box(2.3, 2.4, 0.08), s * (gate + 0.15), 1.25, WZ + 1.2, s * Math.PI / 2 * 0.92), M.metalOlive);
		}
		batch.add(place(box(2 * gate + 0.4, 0.3, 0.3), 0, 3.3, WZ), M.metalDark);
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.7), T.signMaterial('СТАБ «ПОЛИС»', { bg: '#2a2c26', fg: '#e8dcae', w: 640, h: 108 }));
		sign.position.set(0, 3.85, WZ + 0.2);
		root.add(sign);
		// коридор от ворот на дорогу (дальше — выход на карту)
		for (const s of [-1, 1]) {
			collide(s * (gate + 0.6), WZ + 4.5, 0.5, 9);
			for (let k = 0; k < 4; k++) batch.add(place(box(0.5, 0.8, 2.1, 1), s * (gate + 0.6), 0.4, WZ + 1.2 + k * 2.2, rnd() * 0.06 - 0.03), M.concreteDark);
		}
		collide(0, WZ + 9.2, 2 * gate + 2, 0.6);
		// мешки с песком у ворот
		for (const s of [-1, 1]) {
			for (let k = 0; k < 6; k++) {
				batch.add(place(new THREE.SphereGeometry(0.3, 8, 6).scale(1.6, 0.5, 1), s * (gate + 1.4), 0.15 + (k % 2) * 0.28, WZ - 1.6 + Math.floor(k / 2) * 0.5, rnd() * 0.3), M.sandbag);
			}
			collide(s * (gate + 1.4), WZ - 1.1, 1.0, 1.6);
		}

		// ---------- Вышки по углам ----------
		const tower = (x, z) => {
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.16, 4.2, 0.16), x + dx * 0.9, 2.1, z + dz * 0.9), M.wood);
			batch.add(place(box(2.3, 0.14, 2.3), x, 4.2, z), M.wood);
			for (const [w, d, ox, oz] of [[2.3, 0.06, 0, -1.12], [2.3, 0.06, 0, 1.12], [0.06, 2.3, -1.12, 0], [0.06, 2.3, 1.12, 0]]) {
				batch.add(place(box(w, 0.9, d), x + ox, 4.7, z + oz), M.woodGrey);
			}
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.1, 1.6, 0.1), x + dx * 1.1, 5.0, z + dz * 1.1), M.wood);
			batch.add(place(box(2.7, 0.1, 2.7, 2), x, 5.85, z), M.roofMetal);
			collide(x, z, 2.1, 2.1);
		};
		tower(-WX + 1.6, -WZ + 1.6);
		tower(WX - 1.6, -WZ + 1.6);
		tower(-WX + 1.6, WZ - 1.6);
		tower(WX - 1.6, WZ - 1.6);

		// ---------- Казарма (двухэтажная, кирпич) ----------
		{
			const cx = 0, cz = -11, W = 16, D = 6, H = 6.2;
			occluder('Barracks', (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.brick);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (let i = 0; i < 6; i++) for (const y of [1.6, 4.4]) {
					const win = new THREE.PlaneGeometry(1.0, 1.2);
					win.translate(cx - W / 2 + 1.6 + i * 2.55, y, cz + D / 2 + 0.01);
					kb.add(win, M.window);
				}
				kb.add(place(box(1.4, 2.2, 0.1), cx, 1.1, cz + D / 2 + 0.05), M.metalDark);
				kb.add(place(box(2.4, 0.15, 1.4), cx, 2.5, cz + D / 2 + 0.7), M.concrete);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.8, top: H + 0.4 }, 0.25);
			collide(cx, cz, W, D);
		}

		// ---------- Лавка торговца: морской контейнер, перед ним торговец за прилавком ----------
		const shop = { x: -11, z: -2.5 };
		{
			const { x, z } = shop;
			const paint = T.metalRoofMaterial([1, 1], [62, 88, 112]);
			batch.add(place(box(6, 2.6, 2.5, 1.5), x, 1.3, z - 0.8), paint);
			batch.add(place(box(1.3, 2.2, 0.06), x - 1.9, 1.1, z + 0.48), M.metalDark); // открытая дверь контейнера
			batch.add(place(box(4.4, 1.0, 0.5), x, 0.5, z + 1.7), M.wood); // прилавок
			batch.add(place(box(4.6, 0.06, 0.65), x, 1.03, z + 1.7), M.woodGrey);
			// товар на прилавке: ящик патронов, бутыли живчика, пачки
			batch.add(place(box(0.5, 0.25, 0.3), x - 1.2, 1.18, z + 1.7), M.metalOlive);
			batch.add(place(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 10), x + 0.5, 1.18, z + 1.7), M.red);
			batch.add(place(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 10), x + 0.7, 1.18, z + 1.6), M.red);
			batch.add(place(box(0.3, 0.12, 0.2), x + 1.4, 1.12, z + 1.7), M.yellow);
			// ящики с товаром у стенки контейнера
			for (const [dx, dy] of [[1.6, 0.3], [2.3, 0.3], [1.95, 0.9]]) batch.add(place(box(0.6, 0.6, 0.6), x + dx, dy, z + 0.85), M.metalOlive);
			const s = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), T.signMaterial('ТОРГОВЛЯ', { bg: '#e6dcc0', fg: '#7a1c14', w: 512, h: 96 }));
			s.position.set(x, 2.25, z + 0.47);
			root.add(s);
			collide(x, z - 0.8, 6, 2.5);
			collide(x, z + 1.7, 4.4, 0.5);
			collide(x + 1.95, z + 0.85, 1.4, 0.6);
		}

		// ---------- Палатка лекаря ----------
		const med = { x: 11, z: -2.5 };
		{
			const { x, z } = med;
			const L = 6, Wd = 4, h = 2.6;
			const slope = Math.hypot(Wd / 2, h - 1.2);
			for (const s of [-1, 1]) {
				batch.add(place(box(L, 0.05, slope, 2), x, (h + 1.2) / 2, z - 0.6 + s * Wd / 4, 0, -s * Math.atan2(h - 1.2, Wd / 2)), M.canvas);
				batch.add(place(box(L, 1.2, 0.05, 2), x, 0.6, z - 0.6 + s * Wd / 2), M.canvas);
			}
			batch.add(place(box(0.05, h, Wd, 2), x - L / 2, h / 2 - 0.1, z - 0.6), M.canvas);
			// красный крест на скате к камере
			const cross = new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.7 });
			batch.add(place(box(1.0, 0.3, 0.02), x, 1.95, z - 0.6 + Wd / 4 + 0.05, 0, -Math.atan2(h - 1.2, Wd / 2)), cross);
			batch.add(place(box(0.3, 1.0, 0.02), x, 1.95, z - 0.6 + Wd / 4 + 0.05, 0, -Math.atan2(h - 1.2, Wd / 2)), cross);
			// раскладушки и ящик с лекарствами у входа
			batch.add(place(box(0.8, 0.4, 1.9), x + 1.8, 0.2, z + 1.4), M.metalOlive);
			batch.add(place(box(0.7, 0.08, 1.8), x + 1.8, 0.44, z + 1.4), M.canvas);
			batch.add(place(box(0.6, 0.4, 0.4), x - 1.6, 0.2, z + 1.6), M.whiteBrick);
			collide(x, z - 0.6, L, Wd);
			collide(x + 1.8, z + 1.4, 0.8, 1.9);
			collide(x - 1.6, z + 1.6, 0.6, 0.4);
		}

		// ---------- Костёр в бочке, лавки вокруг ----------
		const fire = { x: 0, z: 4 };
		batch.add(place(new THREE.CylinderGeometry(0.35, 0.32, 0.9, 12, 1, true), fire.x, 0.45, fire.z), M.metalRust);
		collide(fire.x, fire.z, 0.8, 0.8);
		bench(batch, M, fire.x - 2.2, fire.z, Math.PI / 2);
		bench(batch, M, fire.x + 2.2, fire.z, -Math.PI / 2);
		bench(batch, M, fire.x, fire.z - 2.2, 0);
		for (const [bx, bz, w, d] of [[-2.2, 0, 0.5, 1.7], [2.2, 0, 0.5, 1.7], [0, -2.2, 1.7, 0.5]]) collide(fire.x + bx, fire.z + bz, w, d);
		const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 }));
		flame.position.set(fire.x, 1.15, fire.z);
		const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('255,170,80'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
		glow.scale.setScalar(2.6);
		glow.position.set(fire.x, 1.1, fire.z);
		const light = new THREE.PointLight(0xff9a50, 6, 9);
		light.position.set(fire.x, 1.6, fire.z);
		root.add(flame, glow, light);

		// ---------- Техника, ящики, фонари ----------
		{
			// грузовик-кунг у казармы
			const tx = 13, tz = -10.5;
			batch.add(place(box(2.4, 1.2, 7, 2), tx, 1.2, tz), M.metalOlive);
			batch.add(place(box(2.4, 1.7, 2, 1.5), tx, 2.25, tz + 2.5), M.metalOlive);
			batch.add(place(box(2.5, 2.4, 4.6, 1.5), tx, 3.0, tz - 1.1), M.metalOlive);
			batch.add(place(box(2.2, 0.8, 0.05), tx, 2.6, tz + 3.52), M.glass);
			for (const [wx, wz] of [[-1.2, 2.4], [1.2, 2.4], [-1.2, -1.6], [1.2, -1.6], [-1.2, -2.9], [1.2, -2.9]]) {
				const wh = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14);
				wh.rotateZ(Math.PI / 2);
				batch.add(place(wh, tx + wx, 0.5, tz + wz), M.tire);
			}
			collide(tx, tz, 2.6, 7.2);
		}
		addCar(batch, M, root, -13, -10.5, 0.05, 0x4a5a3a);
		collide(-13, -10.5, 4.3, 1.8, 0.05);
		for (const [x, z, r] of [[-16.5, 6, 0.1], [-15.6, 7.1, 0.5], [-16.4, 8.2, 0], [16.2, 6.5, 0.3], [16.4, 7.7, 0]]) {
			batch.add(place(box(0.9, 0.6, 0.6), x, 0.3, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 0.9, z, r + 0.1), M.wood);
			collide(x, z, 1.0, 0.8, r);
		}
		streetLamp(batch, M, collide, -7, 12.5);
		streetLamp(batch, M, collide, 7, 12.5);
		// флагшток
		batch.add(place(new THREE.CylinderGeometry(0.05, 0.06, 7, 8), -4.5, 3.5, -7), M.metalDark);
		const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 0.9, side: THREE.DoubleSide }));
		flag.position.set(-3.8, 6.5, -7);
		root.add(flag);
		collide(-4.5, -7, 0.3, 0.3);

		// за забором — поле: всё, кроме территории, дороги и ворот, недоступно
		const out = 3;
		collide(0, -WZ - out / 2 - 0.2, 2 * WX + 2 * out, out);
		collide(-WX - out / 2 - 0.2, 0, out, 2 * WZ + 2 * out);
		collide(WX + out / 2 + 0.2, 0, out, 2 * WZ + 2 * out);

		let tFire = 0;
		return {
			start: [0, 10.5, Math.PI],
			fog: false,
			exits: [{ to: null, x0: -gate, x1: gate, z0: WZ + 1.6, z1: WZ + 8, spawn: [0, WZ - 3.2, Math.PI], sign: [gate + 1.4, WZ + 2.4, 'Выход в Улей ↓'] }],
			stations: [
				{ id: 'trade', name: 'Торговец', label: 'Торговать', x: shop.x, z: shop.z + 2.6, r: 1.7 },
				{ id: 'mercs', name: 'Наёмники', label: 'Нанять', x: fire.x - 2.6, z: fire.z + 3.0, r: 1.5 },
				{ id: 'rest', name: 'Лекарь', label: 'Отдохнуть', x: med.x - 0.5, z: med.z + 2.2, r: 1.6 },
			],
			// жители стаба: торговец за прилавком, лекарь, часовые у ворот и на вышках
			npcs: [
				{ x: shop.x + 0.4, z: shop.z + 0.95, ry: 0, clip: 'Idle', tint: [0.75, 0.7, 0.62] },
				{ x: med.x - 0.6, z: med.z + 1.5, ry: -0.3, clip: 'Idle', tint: [0.95, 0.95, 0.92] },
				{ x: -gate - 1.0, z: WZ - 2.6, ry: 0.2, clip: 'IdleRifle', gun: 'aks', tint: [0.6, 0.62, 0.55] },
				{ x: gate + 1.0, z: WZ - 2.6, ry: -0.2, clip: 'IdleRifle', gun: 'aks', tint: [0.6, 0.62, 0.55] },
				{ x: -WX + 1.6, y: 4.27, z: -WZ + 1.6, ry: Math.PI * 0.75, clip: 'IdleRifle', gun: 'aks', tint: [0.6, 0.62, 0.55] },
				{ x: WX - 1.6, y: 4.27, z: WZ - 1.6, ry: Math.PI * 0.25, clip: 'IdleRifle', gun: 'aks', tint: [0.6, 0.62, 0.55] },
				// вербовщик наёмников у костра и двое свободных бойцов
				{ x: fire.x - 2.6, z: fire.z + 1.7, ry: 0.2, clip: 'Idle', tint: [0.8, 0.75, 0.7] },
				{ x: fire.x + 2.9, z: fire.z + 1.2, ry: -0.6, clip: 'IdleRifle', gun: 'ak74', tint: [0.55, 0.58, 0.48] },
				{ x: fire.x + 1.6, z: fire.z - 3.3, ry: 0.4, clip: 'IdleRifle', gun: 'svd', tint: [0.64, 0.66, 0.52] },
			],
			onRoad: (x, z, m = 0) => (Math.abs(x) < WX + m && Math.abs(z) < WZ + m) || (Math.abs(x) < 2.5 + m && z > 0),
			trees(tryTree) {
				for (let i = 0; i < 70; i++) {
					const x = R(-46, 46), z = R(-46, 46);
					if (Math.abs(x) < WX + 4 && Math.abs(z) < WZ + 4) continue;
					tryTree(x, z, rnd() < 0.6 ? 'birch' : 'pine');
				}
			},
			clutter: 0,
			blood: 0,
			puddles: 6,
			puddle: () => [R(-WX + 2, WX - 2), R(-WZ + 4, WZ - 2)],
			grass: 0.8,
			update(dt, t) {
				tFire += dt;
				const f = 0.8 + Math.sin(tFire * 13) * 0.1 + Math.sin(tFire * 7.3) * 0.1;
				flame.scale.set(1, f, 1);
				light.intensity = 5 + f * 2;
				glow.material.opacity = 0.6 + f * 0.2;
			},
		};
	},
};
