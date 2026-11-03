// База «Опорный» — постоянный кластер героя (game/base.js: постройки, цены, что даёт каждая). Площадка 54×54 м
// посреди поля, ворота на юге, посередине — терминал под навесом: в нём покупаются постройки. Купленная стоит на
// своём месте; на месте некупленной — бетонный фундамент с табличкой «название — цена» (у стены — колышки
// по периметру, у вышек — площадки в углах). Состояние базы (что построено) — ctx.base (world.base).
// Мебель в зданиях базы — не тайники: здесь ничего не обыскивают. Заражённых нет — кроме нападений (game/main.js).
// Выходы: на восток — к «Полису», на север — к Дачам; муть по краям — выход на карту Улья в любом месте.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ } from '../geom.js';
import { buildArmyBarracks, buildWarehouse, buildArmory, buildGuardhouse, buildQuarters, buildHouse, buildCheckpoint } from '../buildings.js';
import { streetLamp, bench, greenhouse, transformer, addCar, woodpile } from '../props.js';
import { concreteFence, watchTower, sandbags, barrier, hazardBarrels } from '../props-industrial.js';
import { BUILDINGS, has } from '../base.js';

/** Половина стороны площадки за стеной, м; ворота — на юге, проём ±GATE. */
export const YARD = 27, GATE = 4.5;

/**
 * Места построек: x, z, поворот, габарит (w × d — для фундамента и таблички). Здания смотрят дверью к площадке:
 * у северных — на юг (ry = π), у восточных — на запад (π/2), у западных — на восток (−π/2).
 */
export const SLOTS = {
	barracks: { x: -12.5, z: -19, ry: Math.PI, w: 18, d: 8 },
	warehouse: { x: 12.5, z: -19, ry: Math.PI, w: 16, d: 10 },
	range: { x: 0.5, z: -17, ry: 0, w: 7, d: 10 },
	armory: { x: 20, z: -4, ry: Math.PI / 2, w: 6, d: 8 },
	medbay: { x: 20, z: 8, ry: Math.PI / 2, w: 5, d: 7 },
	workshop: { x: -20, z: -4, ry: -Math.PI / 2, w: 6.2, d: 10.6 },
	kitchen: { x: -19.6, z: 8.5, ry: -Math.PI / 2, w: 7.2, d: 9.6 },
	sporefarm: { x: 9, z: -7.5, ry: 0, w: 5, d: 4 },
	generator: { x: 8, z: 13, ry: 0, w: 4.4, d: 3 },
	greenhouse: { x: -22, z: 19.5, ry: Math.PI / 2, w: 3.2, d: 6 },
	garage: { x: -13.5, z: 20.5, ry: 0, w: 7, d: 5.5 },
	bunker: { x: -4.8, z: 18.5, ry: 0, w: 5, d: 4 },
	radio: { x: 15.5, z: 17.5, ry: 0, w: 3, d: 3 },
	gate: { x: 9.6, z: 23, ry: 0, w: 6, d: 4.5 },
	mgnest: { x: -8.5, z: 22.8, ry: 0, w: 3.4, d: 3.4 },
	towerNW: { x: -24.4, z: -24.4, ry: 0, w: 2.4, d: 2.4 },
	towerNE: { x: 24.4, z: -24.4, ry: 0, w: 2.4, d: 2.4 },
	towerSW: { x: -24.4, z: 24.4, ry: 0, w: 2.4, d: 2.4 },
	towerSE: { x: 24.4, z: 24.4, ry: 0, w: 2.4, d: 2.4 },
	wall: { x: 0, z: -YARD, ry: 0, w: 2 * YARD, d: 0.4 },
};

export default {
	id: 'base',
	seed: 4242,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, buildings, bctx } = ctx;
		const st = ctx.base ?? { built: [] };
		const built = (id) => has(st, id);

		// ---------- Площадка: утоптанный грунт, бетонные плиты двора, дорога к воротам и на восток ----------
		ground(132, 132, 0, 0, M.dirt, 6, 0.012);
		ground(2 * YARD - 1, 2 * YARD - 1, 0, 0, M.concrete, 5, 0.014);
		ground(8, 40, 0, YARD + 20, M.dirt, 4, 0.018);
		ground(40, 6, YARD + 20, 30, M.dirt, 4, 0.018);
		ground(6, 34, 0, -YARD - 17, M.dirt, 4, 0.018);
		ground(10, 10, 0, 0, M.asphalt, 4, 0.02); // пятачок у терминала

		// ---------- Терминал под навесом ----------
		batch.add(place(box(1.1, 1.25, 0.6, 1), 0, 0.62, 0), M.metalDark);
		const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), T.signMaterial('ТЕРМИНАЛ', { bg: '#0f2a1c', fg: '#7dfc9a', w: 256, h: 128 }));
		screen.material.emissive = new THREE.Color(0x2a6a3a);
		screen.position.set(0, 1.0, 0.31);
		screen.rotation.x = -0.25;
		root.add(screen);
		for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) batch.add(place(box(0.12, 2.8, 0.12), dx, 1.4, dz), M.metalDark);
		batch.add(place(box(3.8, 0.12, 3.8, 2), 0, 2.85, 0), M.roofMetal);
		collide(0, 0, 1.2, 0.7);
		for (const [x, z] of [[-6, -6], [6, 6]]) streetLamp(batch, M, collide, x, z);

		// ---------- Постройки: купленные — на месте, некупленные — фундамент с табличкой ----------
		const signs = [];
		const foundation = (id) => {
			const s = SLOTS[id], B = BUILDINGS[id];
			batch.add(place(box(s.w, 0.12, s.d, 2), s.x, 0.06, s.z, s.ry), M.concreteDark);
			// колышки по углам — разметка
			const c = Math.cos(s.ry), n = Math.sin(s.ry);
			for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
				const lx = (a * s.w) / 2, lz = (b * s.d) / 2;
				batch.add(place(box(0.08, 0.6, 0.08), s.x + lx * c + lz * n, 0.3, s.z - lx * n + lz * c), M.wood);
			}
			signs.push([id, s, B]);
		};
		const sign = (x, z, ry, text) => {
			batch.add(place(box(0.08, 1.2, 0.08), x, 0.6, z), M.wood);
			const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), T.signMaterial(text, { bg: '#e8e2cf', fg: '#2a2c26', w: 320, h: 80 }));
			m.position.set(x, 1.3, z);
			m.rotation.set(-0.45, 0, 0); // к камере (она с юга, сверху) — читается сверху, как вывеска
			root.add(m);
		};
		const clean = (b) => { for (const c of b.containers) c.spark?.removeFromParent(); b.containers.length = 0; return b; };
		const house = (fn, id, extra = {}) => { const s = SLOTS[id]; buildings.push(clean(fn(bctx, { name: id, cx: s.x, cz: s.z, ry: s.ry, rnd, ...extra }))); };

		// стена: бетонный забор с проёмом ворот на юге; не куплена — колышки по периметру
		if (built('wall')) {
			concreteFence(batch, M, collide, root, -YARD, -YARD, YARD, -YARD);
			concreteFence(batch, M, collide, root, -YARD, -YARD, -YARD, YARD);
			concreteFence(batch, M, collide, root, YARD, -YARD, YARD, YARD);
			concreteFence(batch, M, collide, root, -YARD, YARD, -GATE, YARD);
			concreteFence(batch, M, collide, root, GATE, YARD, YARD, YARD);
		} else {
			for (let t = -YARD; t <= YARD; t += 4.5) for (const [x, z] of [[t, -YARD], [-YARD, t], [YARD, t], [t, YARD]]) if (!(z === YARD && Math.abs(x) < GATE)) batch.add(place(box(0.1, 0.7, 0.1), x, 0.35, z), M.wood);
			signs.push(['wall', { x: -GATE - 2, z: YARD, ry: Math.PI }, BUILDINGS.wall]);
		}
		// ворота и КПП
		if (built('gate')) {
			const s = SLOTS.gate;
			buildings.push(clean(buildCheckpoint(bctx, { name: 'gate', cx: s.x, cz: s.z, ry: s.ry })));
			barrier(batch, M, collide, GATE + 0.5, YARD + 0.8, Math.PI, 2 * GATE, true);
		} else foundation('gate');
		// вышки по углам
		for (const id of ['towerNW', 'towerNE', 'towerSW', 'towerSE']) {
			const s = SLOTS[id];
			if (built(id)) watchTower(batch, M, collide, s.x, s.z); else foundation(id);
		}
		// здания
		if (built('barracks')) house(buildArmyBarracks, 'barracks'); else foundation('barracks');
		if (built('warehouse')) house(buildWarehouse, 'warehouse'); else foundation('warehouse');
		if (built('armory')) house(buildArmory, 'armory'); else foundation('armory');
		if (built('medbay')) house(buildGuardhouse, 'medbay'); else foundation('medbay');
		if (built('workshop')) house(buildQuarters, 'workshop'); else foundation('workshop');
		if (built('kitchen')) house(buildHouse, 'kitchen', { variant: 1 }); else foundation('kitchen');
		// тир: огневой рубеж (скамья, стойка) и мишени у северных зданий
		if (built('range')) {
			const s = SLOTS.range;
			for (const dx of [-2.4, 0, 2.4]) {
				batch.add(place(box(0.1, 1.6, 0.1), s.x + dx, 0.8, s.z - 4), M.wood);
				batch.add(place(box(0.7, 0.9, 0.05), s.x + dx, 1.35, s.z - 4), M.woodGrey);
				batch.add(place(box(0.4, 0.4, 0.06), s.x + dx, 1.4, s.z - 3.97), M.metalRust);
			}
			batch.add(place(box(5.5, 0.9, 0.5), s.x, 0.45, s.z + 3.6), M.woodGrey);
			collide(s.x, s.z + 3.6, 5.5, 0.5);
			collide(s.x, s.z - 4, 6, 0.4);
		} else foundation('range');
		// споровая ферма: домик-лаборатория и три чана с грибницей
		if (built('sporefarm')) {
			const s = SLOTS.sporefarm;
			batch.add(place(box(3.2, 2.4, 3.6, 1.5), s.x - 0.8, 1.2, s.z), M.panel);
			batch.add(place(box(3.4, 0.12, 3.8, 2), s.x - 0.8, 2.46, s.z), M.roofMetal);
			for (const dz of [-1.2, 0, 1.2]) {
				batch.add(place(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12), s.x + 1.6, 0.6, s.z + dz), M.metalOlive);
				batch.add(place(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), s.x + 1.6, 1.22, s.z + dz), M.grass);
			}
			collide(s.x, s.z, 5, 4);
		} else foundation('sporefarm');
		// генератор: дизель в кожухе и трансформатор
		if (built('generator')) {
			const s = SLOTS.generator;
			batch.add(place(box(2.6, 1.4, 1.3, 1), s.x - 0.7, 0.7, s.z), M.metalOlive);
			batch.add(place(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), s.x - 1.6, 1.9, s.z - 0.3), M.metalDark);
			transformer(batch, root, M, collide, s.x + 1.4, s.z);
			collide(s.x - 0.7, s.z, 2.8, 1.5);
		} else foundation('generator');
		// теплица
		if (built('greenhouse')) { const s = SLOTS.greenhouse; greenhouse(batch, M, collide, s.x, s.z, s.d, s.w, s.ry); } else foundation('greenhouse');
		// гараж: стены из профлиста, внутри УАЗ на ходу
		if (built('garage')) {
			const s = SLOTS.garage;
			batch.add(place(box(s.w, 2.6, 0.15, 2), s.x, 1.3, s.z + s.d / 2), M.roofMetal);
			for (const sx of [-1, 1]) batch.add(place(box(0.15, 2.6, s.d, 2), s.x + (sx * s.w) / 2, 1.3, s.z), M.roofMetal);
			batch.add(place(box(s.w + 0.4, 0.12, s.d + 0.4, 2), s.x, 2.66, s.z), M.roofMetal);
			collide(s.x, s.z + s.d / 2, s.w, 0.3);
			for (const sx of [-1, 1]) collide(s.x + (sx * s.w) / 2, s.z, 0.3, s.d);
			addCar(batch, M, root, s.x, s.z + 0.3, Math.PI / 2, 0x4a5a3a, { model: 'e_uaz' });
			collide(s.x, s.z + 0.3, 1.9, 4.2);
		} else foundation('garage');
		// бункер: бетонный куб, присыпанный землёй, вход со ступенями
		if (built('bunker')) {
			const s = SLOTS.bunker;
			batch.add(place(box(s.w, 1.8, s.d, 2), s.x, 0.9, s.z), M.concreteDark);
			batch.add(place(box(s.w + 0.6, 0.5, s.d + 0.6, 2), s.x, 1.95, s.z), M.dirt);
			batch.add(place(box(1.2, 1.6, 0.1), s.x, 0.8, s.z - s.d / 2 - 0.02), M.metalDark);
			collide(s.x, s.z, s.w, s.d);
		} else foundation('bunker');
		// радиовышка: решётчатая мачта на растяжках и будка радиста
		if (built('radio')) {
			const s = SLOTS.radio;
			for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) batch.add(place(box(0.07, 12, 0.07), s.x + dx * 0.6, 6, s.z + dz * 0.6), M.metalDark);
			for (let y = 1; y < 12; y += 1.5) batch.add(place(box(0.7, 0.05, 0.7), s.x, y, s.z), M.metalDark);
			batch.add(place(box(1.6, 0.06, 0.06), s.x, 11.6, s.z), M.metalDark);
			batch.add(place(box(1.8, 2.1, 1.6, 1), s.x + 2.2, 1.05, s.z + 0.6), M.woodGrey);
			collide(s.x, s.z, 1.2, 1.2);
			collide(s.x + 2.2, s.z + 0.6, 1.9, 1.7);
		} else foundation('radio');
		// пулемётное гнездо из мешков у ворот
		if (built('mgnest')) {
			const s = SLOTS.mgnest;
			sandbags(batch, M, collide, s.x, s.z - 1.5, 3.2, 0);
			sandbags(batch, M, collide, s.x - 1.5, s.z, 2.6, Math.PI / 2);
			sandbags(batch, M, collide, s.x + 1.5, s.z, 2.6, Math.PI / 2);
		} else foundation('mgnest');

		// таблички у фундаментов: что здесь встанет и почём (в терминале — подробно)
		for (const [, s, B] of signs) {
			const c = Math.cos(s.ry), n = Math.sin(s.ry);
			const front = (s.d ?? 0) / 2 + 0.6; // перед фундаментом, со стороны площадки (локальная −Z)
			sign(s.x - n * front, s.z - c * front, s.ry + Math.PI, `${B.name} — ${B.price} сп.`);
		}

		// ---------- Вокруг: поле, перелесок, кучи хлама ----------
		hazardBarrels(batch, M, collide, 34, -10, rnd, 3);
		woodpile(batch, M, collide, -34, 12, 0.4);
		bench(batch, M, -3.5, 4.5, 0);
		bench(batch, M, 3.5, 4.5, 0);
		collide(-3.5, 4.5, 1.7, 0.6);
		collide(3.5, 4.5, 1.7, 0.6);

		// ---------- Станции и жители: терминал всегда, остальное — по постройкам ----------
		const stations = [{ id: 'terminal', name: 'Терминал базы', label: 'Постройки', x: 0, z: 1.6, r: 2.0 }];
		const npcs = [];
		const S = SLOTS;
		if (built('armory')) {
			stations.push({ id: 'armory', name: 'Оружейник', label: 'Купить патроны', x: S.armory.x - 4.4, z: S.armory.z, r: 2.0 });
			npcs.push({ x: S.armory.x - 3.4, z: S.armory.z - 0.6, ry: -Math.PI / 2, clip: 'Idle', tint: [0.5, 0.42, 0.34] });
		}
		if (built('medbay')) {
			stations.push({ id: 'medbay', name: 'Медпункт', label: 'Лечиться', x: S.medbay.x - 3.6, z: S.medbay.z, r: 1.9 });
			npcs.push({ x: S.medbay.x - 3.0, z: S.medbay.z + 0.8, ry: -Math.PI / 2, clip: 'Idle', tint: [0.95, 0.95, 0.92] });
		}
		if (built('warehouse')) stations.push({ id: 'stash', name: 'Склад', label: 'Хранилище', x: S.warehouse.x, z: S.warehouse.z + 6.2, r: 2.0 });
		if (built('workshop')) stations.push({ id: 'repair', name: 'Мастерская', label: 'Починить топор', x: S.workshop.x + 4.0, z: S.workshop.z, r: 2.0 });
		// часовые на вышках (СВД), пулемётчик в гнезде, охранник у ворот — стреляют по заражённым (sentry)
		for (const id of ['towerNW', 'towerNE', 'towerSW', 'towerSE']) if (built(id)) npcs.push({ x: S[id].x, y: 4.27, z: S[id].z, ry: Math.atan2(-S[id].x, -S[id].z) + Math.PI, clip: 'IdleRifle', gun: 'svd', tint: [0.55, 0.6, 0.5], sentry: { range: 22, cooldown: 1.6 } });
		if (built('mgnest')) npcs.push({ x: S.mgnest.x, z: S.mgnest.z, ry: 0, clip: 'IdleRifle', gun: 'rpk', tint: [0.55, 0.6, 0.5], sentry: { range: 12, cooldown: 0.16, burst: 5 } });
		if (built('gate')) npcs.push({ x: GATE + 1.2, z: YARD - 2.2, ry: 0, clip: 'IdleRifle', gun: 'ak74', tint: [0.55, 0.6, 0.5], sentry: { range: 9, cooldown: 0.5, burst: 3 } });
		if (built('barracks')) npcs.push({ x: S.barracks.x + 3, z: S.barracks.z + 5.5, ry: 0.4, clip: 'IdleRifle', gun: 'aks', tint: [0.55, 0.6, 0.5], sentry: { range: 8, cooldown: 0.5, burst: 3 } });

		return {
			start: [0, YARD + 14, Math.PI],
			exits: [
				{ to: 'stab', x0: 61.2, x1: 66, z0: 27, z1: 33, spawn: [58.5, 30, -Math.PI / 2], sign: [59.6, 33.6, 'Стаб «Полис» →'] },
				{ to: 'dachi', x0: -3, x1: 3, z0: -66, z1: -61.2, spawn: [0, -58.5, 0], sign: [4, -60.2, '↑ Дачи'] },
			],
			groups: [],
			stations,
			npcs,
			onRoad: (x, z, m = 0) => (Math.abs(x) < YARD + m && Math.abs(z) < YARD + m) || (Math.abs(x) < 4 + m && Math.abs(z) > YARD - m),
			trees(tryTree) {
				for (let i = 0; i < 60; i++) {
					const x = R(-62, 62), z = R(-62, 62);
					if (Math.abs(x) < YARD + 8 && Math.abs(z) < YARD + 8) continue;
					if (Math.abs(x) < 6 || (z > 24 && z < 36 && x > 0)) continue; // дороги
					tryTree(x, z, rnd() < 0.55 ? 'birch' : 'pine');
				}
			},
			hint: (b) => ({ barracks: 'Казарма базы', warehouse: 'Склад базы — хранилище у входа', armory: 'Оружейная — оружейник за прилавком', medbay: 'Медпункт базы', workshop: 'Мастерская — починить топор', kitchen: 'Столовая', gate: 'КПП базы' }[b.name] ?? null),
			clutter: 0,
			barrels: 0,
			blood: 0,
			puddles: 6,
			puddle: () => [R(-40, 40), R(-40, 40)],
			grass: 0.9,
			fog: true,
		};
	},
};
