// База «Опорный» — постоянный кластер героя (game/base.js: постройки, цены, что даёт каждая). Площадка 60×60 м
// посреди поля, ворота на юге. Посередине — площадь: терминал под навесом (в нём покупаются постройки), флагшток,
// костёр с лавками, доска объявлений; к зданиям ведут дорожки. Купленная постройка стоит на своём месте — здания в
// рост героя (стены ~3 м, двери 2,1 м), в них заходят: внутри мебель и житель (оружейник за прилавком, медик, повар,
// механик, радист, лаборант) — game/base-buildings.js. На месте некупленной — бетонный фундамент с табличкой
// «название — цена». Состояние базы (что построено) — ctx.base (world.base).
// Мебель в зданиях базы — не тайники: здесь ничего не обыскивают. Заражённых нет — кроме нападений (game/main.js).
// Выходы: на восток — к «Полису», на север — к Дачам; муть по краям — выход на карту Улья в любом месте.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, beginProp, endProp } from '../geom.js';
import { buildArmyBarracks, buildWarehouse, buildCheckpoint } from '../buildings.js';
import { baseArmory, baseMedbay, baseCanteen, baseWorkshop, baseGarage, baseRadio, baseGreenhouse, baseSporeLab, baseBunker } from '../base-buildings.js';
import { streetLamp, bench, transformer, woodpile } from '../props.js';
import { concreteFence, watchTower, sandbags, barrier, hazardBarrels } from '../props-industrial.js';
import { BUILDINGS, has, level } from '../base.js';
import { WEAPONS } from '../weapons.js';

/** Половина стороны площадки за стеной, м; ворота — на юге, проём ±GATE. */
export const YARD = 30, GATE = 4.5;

/**
 * Места построек: x, z, поворот, габарит здания в своих осях (w — вдоль своей X, d — вдоль Z; для фундамента и
 * таблички). Здания смотрят дверью к площади: у северных — на юг (ry = π), у восточных — на запад (π/2),
 * у западных — на восток (−π/2), у южных — на север (0).
 */
export const SLOTS = {
	barracks: { x: -15, z: -22.5, ry: Math.PI, w: 18, d: 8 },
	warehouse: { x: 15, z: -22, ry: Math.PI, w: 16, d: 10 },
	range: { x: 0.5, z: -18.5, ry: 0, w: 9, d: 16 },
	armory: { x: 23.5, z: -7, ry: Math.PI / 2, w: 9, d: 6.5 },
	medbay: { x: 23.5, z: 4.5, ry: Math.PI / 2, w: 8.5, d: 6.5 },
	sporefarm: { x: 23.75, z: 14.5, ry: Math.PI / 2, w: 7.5, d: 5.5 },
	workshop: { x: -23.5, z: -7, ry: -Math.PI / 2, w: 9.5, d: 7 },
	kitchen: { x: -23.25, z: 5.5, ry: -Math.PI / 2, w: 11, d: 7.5 },
	greenhouse: { x: -22.5, z: 15.5, ry: -Math.PI / 2, w: 4.6, d: 8.5 },
	bunker: { x: -21.5, z: 23.5, ry: 0, w: 6.5, d: 5.5 },
	garage: { x: -12.5, z: 23, ry: 0, w: 7.2, d: 7 },
	mgnest: { x: -6.8, z: 26.4, ry: 0, w: 3.4, d: 3.4 },
	gate: { x: 7.5, z: 26, ry: Math.PI / 2, w: 6, d: 4.5 },
	radio: { x: 15.5, z: 24.5, ry: 0, w: 5, d: 4.2 },
	generator: { x: 13.5, z: 14, ry: 0, w: 5, d: 3.6 },
	towerNW: { x: -27.4, z: -27.4, ry: 0, w: 2.4, d: 2.4 },
	towerNE: { x: 27.4, z: -27.4, ry: 0, w: 2.4, d: 2.4 },
	towerSW: { x: -27.4, z: 27.4, ry: 0, w: 2.4, d: 2.4 },
	towerSE: { x: 27.4, z: 27.4, ry: 0, w: 2.4, d: 2.4 },
	wall: { x: 0, z: -YARD, ry: 0, w: 2 * YARD, d: 0.4 },
};

let glow = null;
/** Склянки знахаря (стекло с зельем). */
const IM_JARS = new THREE.MeshStandardMaterial({ color: 0x7a9a5a, roughness: 0.1, transparent: true, opacity: 0.85 });
IM_JARS.userData.shared = true;
/** Светящееся стекло прожектора (один материал на все — сливается). */
const lampGlow = () => (glow ??= new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe8a0, emissiveIntensity: 1.4, roughness: 0.3 }));

/** Здания базы с интерьером: id постройки → строитель (game/base-buildings.js). */
const HOUSES = { armory: baseArmory, medbay: baseMedbay, kitchen: baseCanteen, workshop: baseWorkshop, garage: baseGarage, radio: baseRadio, greenhouse: baseGreenhouse, sporefarm: baseSporeLab, bunker: baseBunker };

/** Жители зданий: id → станция (что делает) и вид. Стоят там, где поставил строитель (b.station, b.npc). */
const RESIDENTS = {
	armory: { station: { id: 'armory', name: 'Оружейник', label: 'Купить патроны', r: 2.0 }, tint: [0.5, 0.42, 0.34] },
	medbay: { station: { id: 'medbay', name: 'Медик', label: 'Лечиться', r: 2.0 }, tint: [0.95, 0.95, 0.92] },
	kitchen: { station: { id: 'eat', name: 'Повар', label: 'Поесть', r: 2.0 }, tint: [0.92, 0.9, 0.84] },
	workshop: { station: { id: 'repair', name: 'Механик', label: 'Мастерская', r: 2.0 }, tint: [0.36, 0.42, 0.52] },
	radio: { station: { id: 'radio', name: 'Радист', label: 'Слушать эфир', r: 1.8 }, tint: [0.5, 0.55, 0.45] },
	sporefarm: { tint: [0.8, 0.9, 0.82] },
};

export default {
	id: 'base',
	seed: 4242,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const st = ctx.base ?? { built: [] };
		const built = (id) => has(st, id);
		const lv = (id) => level(st, id); // уровень постройки: 2–3 — улучшена (game/base.js, up)

		// ---------- Покрытие: поле и двор — утоптанный грунт, площадь и главная дорога — асфальт, дорожки — бетон ----------
		ground(132, 132, 0, 0, M.dirt, 6, 0.012);
		ground(16, 14, 0, 0, M.asphalt, 4, 0.02); // площадь
		ground(6, YARD - 7, 0, (YARD + 7) / 2, M.asphalt, 4, 0.019); // от площади к воротам
		ground(7, 16, 0, YARD + 8, M.dirt, 4, 0.018); // за воротами
		ground(66, 6, 33, YARD + 10, M.dirt, 4, 0.017); // дорога на восток, к «Полису»
		ground(6, 36, 0, -YARD - 18, M.dirt, 4, 0.017); // на север, к Дачам
		for (const [w, d, x, z] of [
			[12.5, 3, 14.25, -1.5], [12, 3, -14, -1.5], // к восточным и западным зданиям
			[2.6, 23, 18.6, 5], [2.6, 25, -18.4, 3.5], // вдоль восточного и западного рядов
			[36, 3, 0, -9.5], [3, 9, -14, -14], [3, 7.5, 11.5, -13], // к казарме и складу
			[37, 2.6, -2.5, 18.2], // вдоль южного ряда
		]) ground(w, d, x, z, M.concrete, 4, 0.016);

		// ---------- Площадь: терминал под навесом, табло, флагшток, костёр с лавками, доска объявлений ----------
		// терминал — пульт в рост человека: корпус, наклонный экран, клавиатура; на столбах табло с названием базы
		batch.add(place(box(1.2, 1.05, 0.7, 1), 0, 0.53, 0), M.metalDark);
		batch.add(place(box(1.26, 0.06, 0.4), 0, 1.07, 0.32, 0, -0.35), M.metalDark);
		batch.add(place(box(1.0, 0.65, 0.12), 0, 1.45, -0.18, 0, -0.35), M.metalDark);
		const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.52), T.signMaterial('ТЕРМИНАЛ', { bg: '#0f2a1c', fg: '#7dfc9a', w: 256, h: 128 }));
		screen.material.emissive = new THREE.Color(0x2a6a3a);
		screen.position.set(0, 1.46, -0.11);
		screen.rotation.x = -0.35;
		root.add(screen);
		collide(0, 0, 1.3, 0.8);
		occluder('TerminalRoof', (kb) => {
			for (const [dx, dz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) kb.add(place(box(0.14, 3.0, 0.14), dx, 1.5, dz), M.metalDark);
			kb.add(place(box(4.4, 0.14, 4.4, 2), 0, 3.05, 0, 0, 0.05), M.roofMetal);
			kb.add(place(box(3.4, 0.7, 0.08), 0, 2.6, -1.95), M.metalDark);
		}, { cx: 0, cz: 0, ry: 0, hx: 2.3, hz: 2.3, top: 3.2 }, 0.2);
		{
			const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), T.signMaterial('БАЗА «ОПОРНЫЙ»', { bg: '#232a22', fg: '#e8dcae', w: 512, h: 96 }));
			board.position.set(0, 2.6, -1.9);
			root.add(board);
		}
		for (const [dx, dz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) collide(dx, dz, 0.25, 0.25);
		// флагшток с флагом базы (полощется — update)
		const flagX = -6, flagZ = -4.5;
		batch.add(place(new THREE.CylinderGeometry(0.06, 0.08, 8, 8), flagX, 4, flagZ), M.silver);
		batch.add(place(box(0.8, 0.3, 0.8, 1), flagX, 0.15, flagZ), M.concrete);
		collide(flagX, flagZ, 0.8, 0.8);
		const flagGeo = new THREE.PlaneGeometry(1.8, 1.1, 8, 1).translate(0.9, 0, 0);
		const flagBase = Float32Array.from(flagGeo.attributes.position.array);
		const flag = new THREE.Mesh(flagGeo, T.signMaterial('ОПОРНЫЙ', { bg: '#3e5a32', fg: '#e8dcae', w: 256, h: 160 }));
		flag.material.side = THREE.DoubleSide;
		flag.position.set(flagX + 0.06, 7.3, flagZ);
		root.add(flag);
		// костёр в кольце камней, лавки вокруг (огонь — spec.fires)
		const fire = { x: 6, z: 4.2 };
		for (let i = 0; i < 9; i++) {
			const a = (i / 9) * Math.PI * 2;
			batch.add(place(new THREE.DodecahedronGeometry(0.17, 0), fire.x + Math.cos(a) * 0.65, 0.08, fire.z + Math.sin(a) * 0.65, a), M.concreteDark);
		}
		for (const [bx, bz, r] of [[-2.3, 0, Math.PI / 2], [2.3, 0, -Math.PI / 2], [0, -2.3, 0]]) {
			bench(batch, M, fire.x + bx, fire.z + bz, r);
			collide(fire.x + bx, fire.z + bz, Math.abs(bx) > 0 ? 0.5 : 1.7, Math.abs(bx) > 0 ? 1.7 : 0.5);
		}
		// доска объявлений: листовки, схема базы
		{
			const bx = -5.4, bz = 2.6;
			for (const sx of [-0.9, 0.9]) batch.add(place(box(0.1, 2.1, 0.1), bx + sx, 1.05, bz), M.wood);
			batch.add(place(box(2.0, 1.1, 0.06), bx, 1.55, bz), M.woodGrey);
			batch.add(place(box(2.2, 0.08, 0.3), bx, 2.15, bz), M.roofMetal);
			const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), T.signMaterial('ДЕЖУРСТВО · ПАЙКИ · ПАРОЛЬ', { bg: '#e2dccb', fg: '#3a3a32', w: 384, h: 192 }));
			sheet.position.set(bx, 1.55, bz + 0.035);
			root.add(sheet);
			collide(bx, bz, 2.1, 0.3);
		}
		for (const [x, z] of [[-9, 8.5], [9, -8.5], [-3.9, 17], [3.9, 24], [-9.5, -12.5], [9.5, 8.5]]) streetLamp(batch, M, collide, x, z);

		// ---------- Постройки: купленные — на месте, некупленные — фундамент с табличкой ----------
		const signs = [];
		const foundation = (id) => {
			const s = SLOTS[id];
			batch.add(place(box(s.w, 0.12, s.d, 2), s.x, 0.06, s.z, s.ry), M.concreteDark);
			// колышки по углам — разметка
			const c = Math.cos(s.ry), n = Math.sin(s.ry);
			for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
				const lx = (a * s.w) / 2, lz = (b * s.d) / 2;
				batch.add(place(box(0.08, 0.6, 0.08), s.x + lx * c + lz * n, 0.3, s.z - lx * n + lz * c), M.wood);
			}
			signs.push([s, BUILDINGS[id]]);
		};
		const signPost = (x, z, text) => {
			batch.add(place(box(0.08, 1.2, 0.08), x, 0.6, z), M.wood);
			const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), T.signMaterial(text, { bg: '#e8e2cf', fg: '#2a2c26', w: 320, h: 80 }));
			m.position.set(x, 1.3, z);
			m.rotation.set(-0.45, 0, 0); // к камере (она с юга, сверху) — читается сверху, как вывеска
			root.add(m);
		};
		// старые строители (казарма, склад, КПП) кладут тайники — на базе их нет
		const clean = (b) => { for (const c of b.containers) c.spark?.removeFromParent(); b.containers.length = 0; return b; };
		const stations = [
			{ id: 'terminal', name: 'Терминал базы', label: 'Постройки', x: 0, z: 1.6, r: 2.0 },
			{ id: 'quests', name: 'Доска заданий', label: 'Поручения', x: -5.4, z: 3.6, r: 1.6 }, // доска объявлений на площади
		];
		const npcs = [];
		let spawn = null; // бункер: после гибели (и при входе в игру) — в нём, иначе — у ворот
		const resident = (id, b) => {
			const r = RESIDENTS[id];
			if (!r) return;
			if (r.station && b.station) stations.push({ ...r.station, x: b.station.x, z: b.station.z });
			if (b.npc) npcs.push({ x: b.npc.x, z: b.npc.z, ry: b.npc.ry, clip: 'Idle', tint: r.tint });
		};

		// стена: бетонный забор с проёмом ворот на юге; не куплена — колышки по периметру
		if (built('wall')) {
			// 1-й уровень — голый бетон, 2-й — колючая спираль поверху, 3-й — ещё бетонные блоки и прожекторы вдоль стены
			const wire = lv('wall') >= 2;
			concreteFence(batch, M, collide, root, -YARD, -YARD, YARD, -YARD, { wire });
			concreteFence(batch, M, collide, root, -YARD, -YARD, -YARD, YARD, { wire });
			concreteFence(batch, M, collide, root, YARD, -YARD, YARD, YARD, { wire });
			concreteFence(batch, M, collide, root, -YARD, YARD, -GATE, YARD, { wire });
			concreteFence(batch, M, collide, root, GATE, YARD, YARD, YARD, { wire });
			if (lv('wall') >= 3) {
				for (const [x, z, r] of [[-YARD + 1.2, -12, Math.PI / 2], [YARD - 1.2, 2, Math.PI / 2], [-YARD + 1.2, 20, Math.PI / 2], [YARD - 1.2, 20, Math.PI / 2], [-GATE - 1.4, YARD - 1.4, 0], [GATE + 5.5, YARD - 1.4, 0]]) {
					beginProp('block', x, z, r);
					batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concrete);
					endProp();
					collide(x, z, 1.9, 1.0, r);
				}
				for (const [x, z] of [[-YARD + 1.5, -2], [YARD - 1.5, -18], [-14, -YARD + 1.5], [14, YARD - 1.5]]) streetLamp(batch, M, collide, x, z);
			}
		} else {
			for (let t = -YARD; t <= YARD; t += 5) for (const [x, z] of [[t, -YARD], [-YARD, t], [YARD, t], [t, YARD]]) if (!(z === YARD && Math.abs(x) < GATE)) batch.add(place(box(0.1, 0.7, 0.1), x, 0.35, z), M.wood);
			signs.push([{ x: -GATE - 2, z: YARD, ry: Math.PI }, BUILDINGS.wall]);
		}
		// ворота и КПП: будка у дороги, шлагбаум, охранник
		if (built('gate')) {
			const s = SLOTS.gate;
			buildings.push(clean(buildCheckpoint(bctx, { name: 'gate', cx: s.x, cz: s.z, ry: s.ry, tidy: true })));
			barrier(batch, M, collide, GATE + 0.3, YARD + 0.8, Math.PI, 2 * GATE, true);
			npcs.push({ x: 4.2, z: YARD - 2.6, ry: 0, clip: 'IdleRifle', gun: 'ak74', tint: [0.55, 0.6, 0.5], sentry: { range: 9, cooldown: 0.5, burst: 3 } });
			// 2-й уровень — второй охранник, 3-й — пулемётчик за мешками у ворот
			if (lv('gate') >= 2) npcs.push({ x: -4.2, z: YARD - 2.6, ry: 0, clip: 'IdleRifle', gun: 'ak74', tint: [0.55, 0.6, 0.5], sentry: { range: 9, cooldown: 0.5, burst: 3 } });
			if (lv('gate') >= 3) {
				sandbags(batch, M, collide, 2.6, YARD - 5.2, 2.4, 0);
				npcs.push({ x: 2.6, z: YARD - 4.2, ry: 0, clip: 'IdleRifle', gun: 'rpk', tint: [0.55, 0.6, 0.5], sentry: { range: 12, cooldown: 0.16, burst: 5 } });
			}
		} else foundation('gate');
		// вышки по углам
		for (const id of ['towerNW', 'towerNE', 'towerSW', 'towerSE']) {
			const s = SLOTS[id];
			if (built(id)) {
				watchTower(batch, M, collide, s.x, s.z);
				// часовой со СВД; 2-й уровень — прожектор и дальше (27 м), 3-й — второй часовой с РПК
				const ry = Math.atan2(-s.x, -s.z) + Math.PI, far = lv(id) >= 2 ? 27 : 22, two = lv(id) >= 3;
				const ox = two ? Math.cos(ry) * 0.5 : 0, oz = two ? -Math.sin(ry) * 0.5 : 0;
				npcs.push({ x: s.x + ox, y: 4.27, z: s.z + oz, ry, clip: 'IdleRifle', gun: 'svd', tint: [0.55, 0.6, 0.5], sentry: { range: far, cooldown: 1.6 } });
				if (two) npcs.push({ x: s.x - ox, y: 4.27, z: s.z - oz, ry, clip: 'IdleRifle', gun: 'rpk', tint: [0.55, 0.6, 0.5], sentry: { range: 14, cooldown: 0.16, burst: 5 } });
				if (lv(id) >= 2) {
					const dx = -Math.sign(s.x) * 0.95, dz = -Math.sign(s.z) * 0.95; // прожектор на углу площадки, к центру базы
					batch.add(place(box(0.08, 0.9, 0.08), s.x + dx, 5.1, s.z + dz), M.metalDark);
					batch.add(place(box(0.42, 0.32, 0.42, 1), s.x + dx, 5.6, s.z + dz, Math.atan2(-dx, -dz)), M.metalDark);
					batch.add(place(new THREE.CircleGeometry(0.15, 10), s.x + dx * 0.8, 5.6, s.z + dz * 0.8, Math.atan2(-dx, -dz)), lampGlow());
				}
			} else foundation(id);
		}
		// казарма и склад — большие, прибранные (без тайников)
		if (built('barracks')) {
			const s = SLOTS.barracks;
			buildings.push(clean(buildArmyBarracks(bctx, { name: 'barracks', cx: s.x, cz: s.z, ry: s.ry, tidy: true })));
			// дневальный у входа
			npcs.push({ x: s.x + 2.2, z: s.z + 5.6, ry: 0.4, clip: 'IdleRifle', gun: lv('barracks') >= 2 ? 'rpk' : 'aks', tint: [0.55, 0.6, 0.5], sentry: { range: 8, cooldown: 0.5, burst: 3 } });
			// бойцы греются у костра
			npcs.push({ x: fire.x - 1.2, z: fire.z + 1.6, ry: Math.PI - 0.6, clip: 'Idle', tint: [0.6, 0.62, 0.55] });
			npcs.push({ x: fire.x + 1.4, z: fire.z + 1.5, ry: Math.PI + 0.7, clip: 'IdleRifle', gun: 'ak74', tint: [0.6, 0.62, 0.55] });
			// дежурный в казарме: наёмники на посты базы и на вылазки без героя (game/mercs.js)
			const [dx, dz] = [s.x + 1, s.z + 2.2];
			stations.push({ id: 'basemercs', name: 'Казарма', label: 'Наёмники: посты и вылазки', x: dx, z: dz, r: 2.0 });
		} else foundation('barracks');
		if (built('warehouse')) {
			const s = SLOTS.warehouse;
			const b = clean(buildWarehouse(bctx, { name: 'warehouse', cx: s.x, cz: s.z, ry: s.ry, tidy: true }));
			buildings.push(b);
			const [x, z] = b.world(5.6, -3.4); // у ворот, внутри
			stations.push({ id: 'stash', name: 'Склад', label: 'Хранилище', x, z, r: 2.0 });
			// ящики у ворот склада
			for (const [cx, cz, r] of [[8.0, -15.4, 0.2], [8.6, -14.3, -0.3]]) {
				beginProp('crate', cx, cz, r);
				batch.add(place(box(0.9, 0.6, 0.6), cx, 0.3, cz, r), M.metalOlive);
				batch.add(place(box(0.9, 0.6, 0.6), cx, 0.9, cz, r + 0.1), M.wood);
				endProp();
				collide(cx, cz, 1.0, 0.8, r);
			}
		} else foundation('warehouse');
		// здания с интерьером и жителями
		for (const id of Object.keys(HOUSES)) {
			if (!built(id)) { foundation(id); continue; }
			const s = SLOTS[id];
			const b = HOUSES[id](bctx, { name: id, cx: s.x, cz: s.z, ry: s.ry });
			buildings.push(b);
			resident(id, b);
			if (b.spawn) spawn = b.spawn;
		}
		// тир: огневой рубеж под навесом на юге, мишени-силуэты на севере, по бокам — мешки, позади — земляной вал
		if (built('range')) {
			const s = SLOTS.range, x0 = s.x, zf = s.z + s.d / 2 - 1.6, zt = s.z - s.d / 2 + 2.2;
			occluder('RangeShelter', (kb) => {
				for (const dx of [-4, 4]) for (const dz of [-1.3, 1.3]) kb.add(place(box(0.14, 2.7, 0.14), x0 + dx, 1.35, zf + dz), M.wood);
				kb.add(place(box(8.8, 0.1, 3.2, 2), x0, 2.75, zf, 0, -0.06), M.roofMetal);
			}, { cx: x0, cz: zf, ry: 0, hx: 4.4, hz: 1.6, top: 2.9 }, 0.2);
			for (const dx of [-4, 4]) for (const dz of [-1.3, 1.3]) collide(x0 + dx, zf + dz, 0.25, 0.25);
			// стойка-столик с гильзами на рубеже
			batch.add(place(box(7.2, 0.08, 0.6), x0, 1.0, zf - 1.0), M.woodGrey);
			for (const dx of [-3.2, -1, 1, 3.2]) batch.add(place(box(0.08, 1.0, 0.5), x0 + dx, 0.5, zf - 1.0), M.wood);
			collide(x0, zf - 1.0, 7.2, 0.6);
			// мишени — фанерные силуэты на стойках
			for (const dx of [-3, -1, 1, 3]) {
				const tx = x0 + dx, tz = zt + (dx % 2 ? 0 : 1.2);
				for (const sx of [-0.25, 0.25]) batch.add(place(box(0.07, 0.85, 0.07), tx + sx, 0.42, tz), M.wood);
				batch.add(place(box(0.62, 0.95, 0.04), tx, 1.3, tz), M.white);
				batch.add(place(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 12).rotateX(Math.PI / 2), tx, 1.98, tz), M.white);
				batch.add(place(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12).rotateX(Math.PI / 2), tx, 1.4, tz + 0.01), M.red);
				collide(tx, tz, 0.7, 0.2);
			}
			// вал позади мишеней и мешки по бокам полосы
			batch.add(place(box(9, 1.6, 1.6, 2).translate(0, 0, 0), x0, 0.8, s.z - s.d / 2 + 0.6), M.dirt);
			collide(x0, s.z - s.d / 2 + 0.6, 9, 1.6);
			sandbags(batch, M, collide, x0 - 4.6, s.z - 1.5, 10, Math.PI / 2);
			sandbags(batch, M, collide, x0 + 4.6, s.z - 1.5, 10, Math.PI / 2);
		} else foundation('range');
		// генератор: дизель на бетонной площадке под навесом, бак, трансформатор, бочки с соляркой
		if (built('generator')) {
			const s = SLOTS.generator;
			batch.add(place(box(s.w, 0.15, s.d, 2), s.x, 0.075, s.z), M.concrete);
			batch.add(place(box(2.6, 1.4, 1.2, 1), s.x - 0.8, 0.85, s.z), M.metalOlive);
			batch.add(place(box(0.7, 0.9, 1.0, 1), s.x + 0.85, 0.6, s.z), M.metalDark);
			batch.add(place(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), s.x - 1.8, 2.2, s.z - 0.3), M.metalDark);
			batch.add(place(new THREE.CylinderGeometry(0.45, 0.45, 1.6, 12).rotateZ(Math.PI / 2), s.x - 0.6, 0.6, s.z + 1.25), M.metalRust);
			occluder('GeneratorShed', (kb) => {
				for (const dx of [-2.3, 2.3]) for (const dz of [-1.6, 1.6]) kb.add(place(box(0.12, 2.6, 0.12), s.x + dx, 1.3, s.z + dz), M.metalDark);
				kb.add(place(box(5.2, 0.08, 3.8, 2), s.x, 2.65, s.z, 0, 0, 0.06), M.roofMetal);
			}, { cx: s.x, cz: s.z, ry: 0, hx: 2.6, hz: 1.9, top: 2.8 }, 0.25);
			collide(s.x - 0.3, s.z + 0.3, 3.8, 2.6);
			transformer(batch, root, M, collide, s.x + 3.6, s.z - 0.4);
			if (lv('generator') >= 2) for (const [x, z] of [[-14, 9], [14, -13], [-3.9, -9.5], [18.5, 18]]) streetLamp(batch, M, collide, x, z); // прожекторы по базе
			if (lv('generator') >= 3) { batch.add(place(box(2.0, 1.2, 1.1, 1), s.x - 0.6, 0.75, s.z - 1.0), M.metalOlive); } // второй генератор
			hazardBarrels(batch, M, collide, s.x + 0.6, s.z + 2.6, rnd, 3);
		} else foundation('generator');
		// пулемётное гнездо из мешков у ворот
		if (built('mgnest')) {
			const s = SLOTS.mgnest;
			sandbags(batch, M, collide, s.x, s.z - 1.5, 3.2, 0);
			sandbags(batch, M, collide, s.x - 1.5, s.z, 2.6, Math.PI / 2);
			sandbags(batch, M, collide, s.x + 1.5, s.z, 2.6, Math.PI / 2);
			// 2-й уровень — второй пулемётчик, 3-й — оба бьют дальше
			const far = lv('mgnest') >= 3 ? 15 : 12, two = lv('mgnest') >= 2;
			npcs.push({ x: s.x - (two ? 0.55 : 0), z: s.z, ry: 0, clip: 'IdleRifle', gun: 'rpk', tint: [0.55, 0.6, 0.5], sentry: { range: far, cooldown: 0.16, burst: 5 } });
			if (two) npcs.push({ x: s.x + 0.55, z: s.z, ry: 0, clip: 'IdleRifle', gun: 'rpk', tint: [0.55, 0.6, 0.5], sentry: { range: far, cooldown: 0.16, burst: 5 } });
		} else foundation('mgnest');

		// освобождённые из плена форпоста (world.base.residents): знахарь у стола со склянками, барыга у прилавка
		const RES = {
			znahar: { x: -3.4, z: -5.6, ry: 0, tint: [0.62, 0.56, 0.42], station: { id: 'znahar', name: 'Знахарь', label: 'Подлечиться' }, stall: [M.woodGrey, IM_JARS] },
			barter: { x: 3.6, z: -5.6, ry: 0, tint: [0.46, 0.4, 0.52], station: { id: 'barter', name: 'Барыга', label: 'Торговать' }, stall: [M.wood, M.metalRust] },
		};
		for (const id of st.residents ?? []) {
			const r = RES[id];
			if (!r) continue;
			// прилавок перед жителем (между ним и площадью)
			batch.add(place(box(1.6, 0.85, 0.6, 1), r.x, 0.43, r.z + 0.9), r.stall[0]);
			batch.add(place(box(0.5, 0.25, 0.3), r.x + 0.4, 0.98, r.z + 0.9), r.stall[1]);
			collide(r.x, r.z + 0.9, 1.7, 0.7);
			npcs.push({ x: r.x, z: r.z, ry: r.ry, clip: 'Idle', tint: r.tint });
			stations.push({ ...r.station, x: r.x, z: r.z + 1.9, r: 1.6 });
		}

		// наёмники на постах базы (world.base.guards): часовые у ворот и у казармы со своим стволом
		const GUARD_SPOTS = [[-2.4, YARD - 6.5, 0], [2.4, YARD - 6.5, 0], [-11, -10.6, Math.PI], [11.6, -10.6, Math.PI]];
		(st.guards ?? []).slice(0, GUARD_SPOTS.length).forEach((gd, i) => {
			const [x, z, ry] = GUARD_SPOTS[i], W = WEAPONS[gd.gun], auto = W?.auto < 0.2;
			if (!W) return;
			npcs.push({ x, z, ry, clip: 'IdleRifle', gun: gd.gun, tint: gd.tint, merc: gd.id, sentry: { range: Math.min(18, W.range * 1.3), cooldown: auto ? W.auto : 1.2, burst: auto ? 4 : 1 } });
		});

		// таблички уровня у улучшенных построек: «УР. 2» / «УР. 3» у переднего правого угла (одним материалом — сливаются)
		const plaqueMat = { 2: T.signMaterial('УР. 2', { bg: '#2f3a2a', fg: '#c8e08a', w: 160, h: 72 }), 3: T.signMaterial('УР. 3', { bg: '#3a2f22', fg: '#f0c860', w: 160, h: 72 }) };
		for (const id of ['barracks', 'warehouse', 'armory', 'medbay', 'kitchen', 'workshop', 'garage', 'radio', 'greenhouse', 'sporefarm', 'bunker', 'gate', 'generator', 'range']) {
			if (lv(id) < 2) continue;
			const s = SLOTS[id], c = Math.cos(s.ry), n = Math.sin(s.ry);
			const lx = s.w / 2 - 0.5, lz = -(s.d / 2 + 0.55);
			const x = s.x + lx * c + lz * n, z = s.z - lx * n + lz * c;
			batch.add(place(box(0.07, 1.1, 0.07), x, 0.55, z), M.metalDark);
			batch.add(place(new THREE.PlaneGeometry(0.7, 0.32).rotateX(-0.45), x, 1.2, z + 0.04), plaqueMat[lv(id)]);
		}

		// таблички у фундаментов: что здесь встанет и почём (в терминале — подробно)
		for (const [s, B] of signs) {
			const c = Math.cos(s.ry), n = Math.sin(s.ry);
			const front = (s.d ?? 0) / 2 + 0.6; // перед фундаментом, со стороны площади (своя −Z)
			signPost(s.x - n * front, s.z - c * front, `${B.name} — ${B.price} сп.`);
		}

		// ---------- Хозяйство двора: контейнеры, бак с водой, поленница, бочки; за стеной — хлам ----------
		for (const [x, z, paint] of [[23.2, -14.4, M.metalOlive], [-23.4, -15, M.roofGreen]]) {
			batch.add(place(box(6.0, 2.6, 2.44, 3, 1.5), x, 1.3, z), paint);
			batch.add(place(box(0.06, 2.3, 2.2), x + 3.02, 1.3, z), M.metalDark); // двери торца
			collide(x, z, 6.1, 2.5);
		}
		{
			const wx = -16.6, wz = 12.2;
			for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) batch.add(place(box(0.1, 1.4, 0.1), wx + dx, 0.7, wz + dz), M.metalDark);
			batch.add(place(new THREE.CylinderGeometry(0.85, 0.85, 1.5, 14), wx, 2.15, wz), M.tankWhite);
			collide(wx, wz, 1.6, 1.6);
		}
		woodpile(batch, M, collide, -17.4, 8.6, Math.PI / 2);
		hazardBarrels(batch, M, collide, 37, -10, rnd, 3);
		woodpile(batch, M, collide, -37, 12, 0.4);

		// наёмники, что живут на базе: с казармой — в ряд у её входа (мест — по уровню, BASE_BEDS в game/mercs.js),
		// без казармы — у костра (два места)
		const mercSpots = [];
		if (built('barracks')) {
			const s = SLOTS.barracks;
			for (let i = 0; i < 10; i++) mercSpots.push({ x: s.x - 6.3 + (i % 5) * 1.5 - (i % 5 >= 3 ? 0 : 0.6), z: s.z + 7.4 + Math.floor(i / 5) * 1.3, ry: 0 });
		} else for (const [dx, dz, ry] of [[-1.3, 3, Math.PI - 0.3], [1.3, 3, Math.PI + 0.3]]) mercSpots.push({ x: fire.x + dx, z: fire.z + dz, ry });

		return {
			mercSpots,
			start: spawn ? [spawn.x, spawn.z, spawn.ry] : [0, YARD + 12, Math.PI],
			exits: [
				{ to: 'stab', x0: 61.2, x1: 66, z0: YARD + 7, z1: YARD + 13, spawn: [58.5, YARD + 10, -Math.PI / 2], sign: [59.6, YARD + 13.6, 'Стаб «Полис» →'] },
				{ to: 'dachi', x0: -3, x1: 3, z0: -66, z1: -61.2, spawn: [0, -58.5, 0], sign: [4, -60.2, '↑ Дачи'] },
			],
			groups: [],
			stations,
			npcs,
			fires: [[fire.x, fire.z, 'ground']],
			onRoad: (x, z, m = 0) => (Math.abs(x) < YARD + m && Math.abs(z) < YARD + m) || (Math.abs(x) < 4 + m && Math.abs(z) > YARD - m) || (x > 0 && Math.abs(z - YARD - 10) < 3 + m),
			trees(tryTree) {
				for (let i = 0; i < 60; i++) {
					const x = R(-62, 62), z = R(-62, 62);
					if (Math.abs(x) < YARD + 7 && Math.abs(z) < YARD + 7) continue;
					if (Math.abs(x) < 6 || (x > 0 && Math.abs(z - YARD - 10) < 6)) continue; // дороги
					tryTree(x, z, rnd() < 0.55 ? 'birch' : 'pine');
				}
			},
			hint: (b) => ({
				barracks: 'Казарма базы', warehouse: 'Склад базы — хранилище у ворот', armory: 'Оружейная — оружейник за прилавком',
				medbay: 'Медпункт — медик перевяжет', workshop: 'Мастерская — механик починит топор', kitchen: 'Столовая — повар накормит',
				gate: 'КПП базы', garage: 'Гараж — УАЗ на ходу', radio: 'Радиорубка — радист слушает эфир муров', greenhouse: 'Теплица — споровый горох',
				sporefarm: 'Споровая лаборатория — чаны с грибницей', bunker: 'Бункер — здесь возрождаешься после гибели',
			}[b.name] ?? null),
			clutter: 0,
			barrels: 0,
			blood: 0,
			litter: 6,
			grime: 18,
			rubble: 6,
			puddles: 6,
			puddle: () => [R(-40, 40), R(-40, 40)],
			grass: 0.9,
			fog: true,
			update(dt, t) {
				// флаг полощется: волна вдоль полотнища, у древка — неподвижно
				const p = flagGeo.attributes.position;
				for (let i = 0; i < p.count; i++) {
					const x = flagBase[i * 3];
					p.setZ(i, Math.sin(t * 3.2 - x * 2.6) * 0.12 * (x / 1.8));
				}
				p.needsUpdate = true;
			},
		};
	},
};
