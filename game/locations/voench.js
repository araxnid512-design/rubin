// Кластер «Военная часть»: брошенная войсковая часть, которую Улей забрал целиком — с техникой и оружейкой.
// С запада дорога упирается в КПП и ворота со шлагбаумом; за забором с колючкой — плац с флагштоком и трибуной,
// казарма, штаб, столовая, оружейка за мешками с песком, навес с БТР и «Уралами», ангар, склад ГСМ, вышки по углам.
// Логово руберов: самый опасный кластер и самая богатая добыча — оружие, патроны, гранаты, чёрный жемчуг.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place } from '../geom.js';
import { buildArmyBarracks, buildArmory, buildCheckpoint } from '../buildings.js';
import { streetLamp, markingMaterial } from '../props.js';
import { concreteFence, storageTank, hazardBarrels, btr, armyTruck, barrier, watchTower, sandbags, billboard } from '../props-industrial.js';

const FX = -30; // линия забора с КПП (запад)

export default {
	id: 'voench',
	seed: 1968,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;

		// ---------- Дороги, плац ----------
		ground(80, 7, -10, 6, M.asphalt, 5, 0.02); // от западного края через ворота
		ground(60, 6, 14, 6, M.asphalt, 5, 0.021);
		ground(6, 60, 14, 10, M.asphalt, 5, 0.022); // на север и на юг по части
		ground(26, 18, -2, -9, M.asphalt, 5, 0.023); // плац
		ground(26, 0.15, -2, -0.3, markingMaterial(), 6, 0.028);
		ground(26, 0.15, -2, -17.7, markingMaterial(), 6, 0.028);
		ground(70, 76, 7, 0, M.dirt, 5, 0.012); // территория части
		const onRoad = (x, z, m = 0) => Math.abs(z - 6) < 4 + m || (Math.abs(x - 14) < 3.5 + m && z > -20 && z < 40)
			|| (Math.abs(x + 2) < 13 + m && Math.abs(z + 9) < 9 + m);

		// ---------- Забор с колючкой, КПП и ворота со шлагбаумом ----------
		concreteFence(batch, M, collide, root, FX, -42, FX, -4.6);
		concreteFence(batch, M, collide, root, FX, 10.4, FX, 42);
		concreteFence(batch, M, collide, root, FX, -42, 44, -42);
		concreteFence(batch, M, collide, root, FX, 42, 44, 42);
		concreteFence(batch, M, collide, root, 44, -42, 44, 42);
		buildings.push(buildCheckpoint(bctx, { name: 'Checkpoint', cx: FX, cz: -1.5, ry: -Math.PI / 2 }));
		barrier(batch, M, collide, FX, 2.4, Math.PI / 2, 7.2, true);
		// звезда на воротах-столбах и предупреждение снаружи
		for (const z of [2.2, 10.2]) batch.add(place(box(0.6, 3.2, 0.6), FX, 1.6, z), M.concreteDark);
		for (const z of [2.2, 10.2]) {
			const star = new THREE.Mesh(new THREE.CircleGeometry(0.42, 5), M.red);
			star.position.set(FX - 0.31, 2.6, z); star.rotation.y = -Math.PI / 2;
			root.add(star);
		}
		billboard(batch, M, root, collide, -38, 13, 0, 'СТОЙ! ЗАПРЕТНАЯ ЗОНА', { w: 4.6, h: 1.1, y: 1.8, bg: '#e8dcc0', fg: '#a01a10' });
		sandbags(batch, M, collide, FX + 3.2, 13, 3.2, 0);

		// ---------- Вышки по углам ----------
		for (const [x, z] of [[FX + 2, -40], [42, -40], [42, 40], [FX + 2, 40]]) watchTower(batch, M, collide, x, z);

		// ---------- Плац: флагшток, трибуна, лозунг ----------
		batch.add(place(new THREE.CylinderGeometry(0.06, 0.08, 9, 8), -12, 4.5, -16.5), M.metalDark);
		const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.9, side: THREE.DoubleSide }));
		flag.position.set(-11.05, 8.3, -16.5);
		root.add(flag);
		collide(-12, -16.5, 0.4, 0.4);
		batch.add(place(box(5, 1.2, 2.2, 1.5), 6, 0.6, -19.2), M.concrete); // трибуна
		batch.add(place(box(5.2, 0.12, 0.3), 6, 1.8, -18.2), M.red);
		collide(6, -19.2, 5, 2.2);
		billboard(batch, M, root, collide, -2, -21.5, 0, 'НАША ЦЕЛЬ — БОЕГОТОВНОСТЬ', { w: 7, h: 1.3, y: 2.6, bg: '#7a1c14', fg: '#f0e0c0' });

		// ---------- Казарма, оружейка (входы к плацу и дороге) ----------
		buildings.push(buildArmyBarracks(bctx, { name: 'ArmyBarracks', cx: -6, cz: -30, ry: Math.PI }));
		buildings.push(buildArmory(bctx, { name: 'Armory', cx: 30, cz: -6, ry: Math.PI }));
		sandbags(batch, M, collide, 27, -1.2, 3, 0.15);
		sandbags(batch, M, collide, 34.6, -1.6, 2.4, -0.2);

		// ---------- Штаб и столовая (без входа) ----------
		const block = (name, cx, cz, W, D, H, mat, floors) => {
			occluder(name, (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), mat);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (let i = 0; i < Math.floor(W / 3); i++) for (let f = 0; f < floors; f++) {
					const win = new THREE.PlaneGeometry(1.1, 1.3);
					win.translate(cx - W / 2 + 1.8 + i * 3, 1.7 + f * 3, cz + D / 2 + 0.01);
					kb.add(win, M.window);
				}
				kb.add(place(box(1.6, 2.3, 0.1), cx, 1.15, cz + D / 2 + 0.05), M.metalDark);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.6, top: H + 0.4 }, 0.25);
			collide(cx, cz, W, D);
		};
		block('HQ', 24, -30, 15, 9, 6.4, M.whiteBrick, 2);
		block('Mess', -20, -6, 10, 14, 4, M.brick, 1);
		const hq = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.6), T.signMaterial('ШТАБ', { bg: '#2a2c26', fg: '#e8dcae', w: 320, h: 64 }));
		hq.position.set(24, 4.9, -25.48);
		root.add(hq);

		// ---------- Навес с техникой и ангар ----------
		occluder('Shed', (kb) => {
			for (let i = 0; i <= 4; i++) for (const z of [18.2, 25.8]) kb.add(place(box(0.3, 4.6, 0.3), 3 + i * 5, 2.3, z), M.metalDark);
			kb.add(place(box(21, 0.2, 8.6, 2), 13, 4.7, 22), M.roofGreen);
		}, { cx: 13, cz: 22, ry: 0, hx: 10.6, hz: 4.4, top: 4.9 }, 0.15);
		for (let i = 0; i <= 4; i++) for (const z of [18.2, 25.8]) collide(3 + i * 5, z, 0.4, 0.4);
		btr(batch, M, root, collide, 6.5, 22, Math.PI);
		armyTruck(batch, M, root, collide, 13, 22, Math.PI);
		armyTruck(batch, M, root, collide, 19.5, 22.4, Math.PI + 0.05);
		btr(batch, M, root, collide, 30, 14, -Math.PI / 2 + 0.3); // брошенный у дороги
		{
			const cx = -12, cz = 27, W = 15, D = 12, H = 4.2;
			occluder('Hangar', (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.concreteDark);
				const arch = new THREE.CylinderGeometry(W / 2, W / 2, D + 0.2, 20, 1, false, -Math.PI / 2, Math.PI);
				arch.rotateX(Math.PI / 2); arch.rotateZ(0);
				arch.scale(1, 0.45, 1);
				kb.add(place(arch, cx, H, cz), M.roofGreen);
				kb.add(place(box(7, 3.8, 0.12), cx, 1.9, cz + D / 2 + 0.06), M.metalOlive); // ворота
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.4, top: H + W * 0.23 }, 0.25);
			collide(cx, cz, W, D);
		}

		// ---------- Склад ГСМ ----------
		storageTank(batch, M, root, collide, 34, 30, 2.4, 5, M.khaki, 'ГСМ');
		storageTank(batch, M, root, collide, 39.5, 30, 2.4, 5, M.khaki, 'ГСМ');
		hazardBarrels(batch, M, collide, 34, 24.5, rnd, 6);
		sandbags(batch, M, collide, 0, -1.4, 3.6, 0);
		for (const [x, z] of [[-24, 13], [8, 13], [24, 13], [20, -18]]) streetLamp(batch, M, collide, x, z);
		// ящики и бочки по части
		for (const [x, z, r] of [[-24, 20, 0.1], [-25.2, 21.2, 0.4], [36, 6, 0], [37.2, 6.8, 0.3], [4, 36, 0.2]]) {
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			collide(x, z, 1.1, 0.9, r);
		}

		return {
			start: [-43, 6, Math.PI / 2],
			exits: [
				{ to: 'himmash', x0: -50, x1: -45.2, z0: 2, z1: 10, spawn: [-43, 6, Math.PI / 2], sign: [-44, 11.2, '← Химмаш'] },
			],
			// логово руберов: на плацу, у оружейки, в ангаре, у штаба; топтуны по части
			groups: [
				{ at: [-38, -20], r: 6, runners: 2 },
				{ at: [-20, 6], r: 5, runners: 1, stompers: 1 },
				{ at: [-2, -9], r: 8, runners: 2, rubers: 1 },
				{ at: [-6, -30], r: 4, stompers: 1 },
				{ at: [30, -11], r: 4, rubers: 1 },
				{ at: [13, 28], r: 4, runners: 1, stompers: 1 },
				{ at: [-12, 36], r: 4, stompers: 1, rubers: 1 },
				{ at: [36, 36], r: 4, runners: 1, stompers: 1 },
				{ at: [28, -37], r: 4, stompers: 1, rubers: 1 },
			],
			onRoad,
			trees(tryTree) {
				// за забором — сосновый лес; в части — редкие берёзы вдоль дорожек
				for (let i = 0; i < 34; i++) tryTree(R(-47, FX - 1.5), R(-46, 46), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(FX + 3, 42), R(-40, 40), 'birch');
			},
			clutter: 14,
			blood: 26,
			puddles: 12,
			puddle: () => [R(-44, 42), rnd() < 0.5 ? R(3, 9) : R(-18, -1)],
			grass: 0.7,
			hint: (b) => ({
				Checkpoint: 'КПП — стол дежурного и шкаф',
				ArmyBarracks: 'Казарма — тумбочки у коек и шкафы в каптёрке',
				Armory: 'Оружейка — пирамиды с оружием, ящик гранат, сейф',
			}[b.name]),
		};
	},
};
