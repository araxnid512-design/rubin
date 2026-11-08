// Кластер «Заречный»: кусок посёлка у трассы — хрущёвка, гаражи, частные дома, магазин «Продукты».
// Выходы: на восток по трассе (к стабу), на запад за баррикаду (к дачам) и на север (к Химмашу).
// Окраина (пояс за 47 м от центра): хутор, охотничья избушка, автосервис у трассы, дом на юго-западе.
// Локация 180×180 м (half 90): ядро посёлка — прежнее, на тех же местах; в кольце до мути — новые районы:
// за гаражами вторая улица частных домов (Садовая) и ряд гаражей кооператива, на севере клуб со сквером
// и памятником, водокачка у улицы на Химмаш, у трассы заправка, крытый рынок с ларьком и остановка, на юго-востоке
// пожарище; по краям — лес и лесополосы.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, CUT, buildHouse, buildShop, buildDacha, buildWorkshop, table, chair } from '../buildings.js';
import { hash01, balcony, khrushchyovkaDetails, boxTop } from '../facade.js';
import {
	bench, swings, slide, streetLamp, OPTIONS, barricade, garden, woodpile, outhouse, clothesline, bicycle,
	settlementSign, fencePlot, shed, well, addCar, bus, markingMaterial, powerLine, waterBarrel,
} from '../props.js';
import { waterTower, billboard } from '../props-industrial.js';

const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);

// ---------- Мебель-тайники (лицо мебели — в +Z её осей) ----------

const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);

const safe = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.7, 1.1, 0.6, 0, 0.55, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, 0.7, 0.31, b.IM.black],
], [0.7, 0.6], loot, 1.1);

const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.4, 0.05, 0.75, 0, 0.75, 0, b.IM.furniture], [0.45, 0.72, 0.7, 0.45, 0.36, 0, b.IM.furniture],
	[0.06, 0.72, 0.06, -0.62, 0.36, 0.3, b.IM.furniture], [0.06, 0.72, 0.06, -0.62, 0.36, -0.3, b.IM.furniture],
	[0.3, 0.04, 0.22, -0.2, 0.79, 0, b.IM.books[0]], [0.24, 0.03, 0.3, 0.3, 0.79, 0.05, b.IM.books[1]],
], [1.4, 0.75], loot, 0.95);

const locker = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.85, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, 0.2, 1.7, 0.26, b.IM.black],
], [0.85, 0.5], loot, 1.9);

const toolbox = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.1, 0.55, 0.6, 0, 0.275, 0, b.IM.crateGreen], [1.12, 0.06, 0.62, 0, 0.58, 0, b.IM.metal], [0.5, 0.05, 0.05, 0, 0.66, 0, b.IM.black],
], [1.1, 0.6], loot, 0.7);

/** Стеллаж: goods — food (банки), tools (железо и ящики). */
const shelf = (b, name, x, z, rot, loot, goods = 'food') => b.container(name, x, z, rot, [
	[2.4, 1.9, 0.5, 0, 0.95, 0, b.IM.furnitureLight],
	...[0.45, 0.95, 1.45].map((y) => [2.3, 0.04, 0.48, 0, y, 0.02, b.IM.furniture]),
	...(goods === 'food' ? [[2.0, 0.22, 0.3, 0, 0.58, 0.05, b.IM.cans], [1.6, 0.25, 0.3, -0.2, 1.08, 0.05, b.IM.jars], [1.8, 0.22, 0.3, 0.15, 1.58, 0.05, b.IM.cans]]
		: [[1.9, 0.26, 0.32, 0, 0.6, 0.05, b.IM.metal], [1.4, 0.3, 0.3, 0.3, 1.12, 0.05, b.IM.crate], [2.0, 0.2, 0.3, -0.1, 1.57, 0.05, b.IM.black]]),
], [2.4, 0.5], loot, 1.9);

const counter = (b, name, x, z, rot, w, loot, goods = []) => b.container(name, x, z, rot, [
	[w, 1.0, 0.7, 0, 0.5, 0, b.IM.furniture], [w + 0.1, 0.05, 0.8, 0, 1.02, 0, b.IM.furnitureLight], ...goods,
], [w, 0.7], loot, 1.25);

const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine],
], [2.0, 0.8], loot, 1.0);

/** Открытый книжный шкаф: боковины, задняя стенка, полки с корешками (книги видно). */
const bookParts = (b) => [
	[1.6, 2.0, 0.04, 0, 1.0, -0.18, b.IM.furniture], [0.05, 2.0, 0.4, -0.78, 1.0, 0, b.IM.furniture], [0.05, 2.0, 0.4, 0.78, 1.0, 0, b.IM.furniture],
	...[0.06, 0.5, 0.95, 1.4, 1.98].map((y) => [1.52, 0.04, 0.38, 0, y, 0, b.IM.furnitureLight]),
	...[0.3, 0.75, 1.2, 1.65].map((y, i) => [1.3 - (i % 2) * 0.3, 0.32, 0.26, (i % 2) * 0.12, y, 0.02, b.IM.books[i % 3]]),
];

/** Колонна (крыльцо, навес): низ — со стенами, верх — с крышей (исчезает, когда герой внутри). */
function column(b, x, z, h, r, mat) {
	b.lower(place(cyl(r, r, CUT, 10), x, CUT / 2, z), mat);
	b.top_(place(cyl(r, r, h - CUT, 10), x, CUT + (h - CUT) / 2, z), mat);
	b.collide(x, z, r * 2 + 0.05, r * 2 + 0.05);
}

/** Двускатная крыша вдоль X (конёк посередине) и фронтоны из материала gable. */
function gableRoof(b, roof, gable, rise, over = 0.45) {
	const { W, D, H } = b, hz = D / 2, half = hz + over, slope = Math.hypot(half, rise), a = Math.atan2(rise, half);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.8, 0.08, slope, 2), 0, H + rise / 2, (s * half) / 2, 0, s * a), roof);
	b.top_(place(boxTop(W + 0.84, 0.1, 0.26, 1), 0, H + rise + 0.04, 0), b.ctx.M.woodGrey);
	for (const sx of [-1, 1]) {
		const x = sx * (W / 2 + 0.01);
		const p = [x, H, -hz], q = [x, H, hz], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...p, ...tp, ...q] : [...p, ...q, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 4, 1, D / 2, 0] : [0, 0, D / 2, 0, D / 4, 1]), 2));
		tri.computeVertexNormals();
		b.top_(tri, gable);
	}
}

// ---------- Клуб (можно зайти) ----------

/**
 * Сельский клуб 22×12 м под шиферной крышей: вход с юга (+Z) под портиком на колоннах — в фойе; за ним во всю
 * ширину зрительный зал (сцена с занавесом на западе, ряды скамей, запасной выход на восток); по бокам фойе —
 * библиотека, кабинет заведующего и кладовая. Тайники: сундук с реквизитом, книжный шкаф, стол библиотекаря,
 * стол заведующего, сейф, шкаф в кладовой.
 */
function buildClub(ctx, { name = 'Club', cx, cz }) {
	const W = 22, D = 12, H = 3.6, rise = 2.2, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + rise });
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.plaster, t, doors: [0], w: 1.8, lining: IM.shopWall, side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.plaster, t, lining: IM.shopWall, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, doors: [-3.2], lining: IM.shopWall, side: -1 });
	// перегородки: зал (север) | библиотека, фойе, кабинет, кладовая (юг)
	b.wall('x', 0, -hx + t / 2, hx - t / 2, { mat: IM.whitewash, t: 0.14, doors: [0], w: 1.6 });
	for (const x of [-3, 3, 7]) b.wall('z', x, 0.07, hz - t / 2, { mat: IM.whitewash, t: 0.14, doors: [3.4], w: 1.1 });
	for (const x of [-9, -5.5, 5, 9]) b.window('back', x, { t, sill: M.concrete });
	for (const x of [-8, -4, 0, 4, 8]) b.window('front', x, { t, sill: M.concrete });
	for (const z of [-3.2, 3]) b.window('left', z, { t, sill: M.concrete });
	b.window('right', 3, { t, sill: M.concrete });
	// двери распахнуты, крыльцо со ступенями, портик на четырёх колоннах с фронтоном и вывеской
	for (const s of [-1, 1]) b.furniture(s * 0.9, hz - 0.1, s * 1.75, [[0.88, 2.05, 0.05, s * -0.44, 1.03, 0, M.woodGrey]], { up: true });
	b.wallBox('right', -3.2 + 1.2, 1.1, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.lower(place(box(5.2, 0.3, 3.0, 1), 0, 0.15, hz + 1.5), M.concrete);
	b.lower(place(boxTop(5.8, 0.14, 0.8, 1), 0, 0.07, hz + 3.4), M.concrete);
	for (const x of [-2.3, -1.25, 1.25, 2.3]) column(b, x, hz + 2.6, 3.3, 0.16, M.white);
	b.top_(place(boxTop(5.6, 0.25, 3.0, 1), 0, 3.42, hz + 1.5), M.concrete);
	{
		const zf = hz + 3.0, y0 = 3.55, y1 = 4.6;
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-2.8, y0, zf, 2.8, y0, zf, 0, y1, zf]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2.8, 0, 1.4, 0.5]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.white);
		b.top_(new THREE.PlaneGeometry(2.4, 0.42).translate(0, 3.86, zf + 0.02), T.signMaterial('КЛУБ', { bg: '#e8e2cc', fg: '#8a2a20', w: 384, h: 72 }));
	}
	gableRoof(b, M.slate, M.plaster, rise, 0.5);
	for (const x of [-6, 6]) b.vent(x, -1.2, H + rise * (1 - 1.2 / (hz + 0.5)) - 0.1, M.metalDark, { h: 0.7, r: 0.16 });
	// зал: сцена с занавесом, пианино и трибуной; скамьи рядами к сцене, проход вдоль перегородки
	b.furniture(-9.3, -3.7, 0, [
		[3.4, 0.5, 4.6, 0, 0.25, 0, IM.furniture], [0.06, 0.06, 4.6, 1.7, 0.5, 0, IM.furnitureLight],
		[0.12, 2.9, 1.1, 1.55, 1.95, -1.75, IM.blanket], [0.12, 2.9, 1.1, 1.55, 1.95, 1.75, IM.blanket], [0.14, 0.4, 4.6, 1.55, 3.3, 0, IM.blanket],
		[1.5, 1.2, 0.6, -0.4, 1.1, -1.85, IM.black], [0.6, 1.0, 0.5, 1.0, 1.0, 0.4, IM.redBoard],
	], { solid: [3.4, 4.6] });
	for (let i = 0; i < 8; i++) {
		b.furniture(-5.6 + i * 1.6, -3.7, 0, [
			[0.4, 0.05, 3.4, 0, 0.45, 0, IM.furnitureLight], [0.05, 0.42, 3.4, 0.18, 0.72, 0, IM.furnitureLight],
			[0.05, 0.45, 0.35, 0, 0.22, -1.5, IM.metal], [0.05, 0.45, 0.35, 0, 0.22, 1.5, IM.metal],
		], { solid: [0.45, 3.4] });
	}
	b.container('Сундук с реквизитом', 9.4, -5.35, 0, [
		[1.0, 0.5, 0.55, 0, 0.25, 0, IM.furnitureLight], [1.02, 0.08, 0.57, 0, 0.53, 0, IM.furniture],
		[0.06, 0.58, 0.58, -0.32, 0.29, 0, IM.metal], [0.06, 0.58, 0.58, 0.32, 0.29, 0, IM.metal],
	], [1.0, 0.55], { ammo12: [3, 6, 0.4], spore: 0.25, peas: 0.08, fireaxe: 0.05 }, 0.57);
	// библиотека
	b.container('Книжный шкаф', -10.55, 2.0, Math.PI / 2, bookParts(b), [1.6, 0.4], { ammo919: [3, 6, 0.35], spore: 0.2 }, 2.0);
	b.furniture(-10.55, 4.3, Math.PI / 2, bookParts(b), { solid: [1.6, 0.4] });
	desk(b, 'Стол библиотекаря', -6.5, 4.9, Math.PI, { zhivchik: 0.3, ammo919: [2, 5, 0.3] });
	table(b, -6.4, 1.5, 0, { w: 1.2, d: 0.7 });
	chair(b, -6.4, 2.2, Math.PI);
	// кабинет заведующего и кладовая
	desk(b, 'Стол заведующего', 5.0, 4.9, Math.PI, { ammo919: [4, 8, 0.5], spore: 0.3 });
	safe(b, 'Сейф', 6.45, 1.0, -Math.PI / 2, { ammo919: [6, 12, 0.7], ammo545: [8, 16, 0.3], spore: [1, 2, 0.35] });
	b.furniture(3.5, 5.4, 0, [[0.05, 2.2, 0.05, 0, 1.1, 0, IM.metal], [0.7, 0.5, 0.02, 0.36, 1.9, 0, IM.redBoard]], { solid: [0.3, 0.3] }); // знамя
	cabinet(b, 'Шкаф', 10.55, 3.0, -Math.PI / 2, 1.2, 2.0, 0.55, { ammo12: [2, 5, 0.35], zhivchik: 0.25, grenade: 0.03 });
	b.furniture(8.0, 5.3, 0.2, [[0.8, 0.6, 0.6, 0, 0.3, 0, IM.crate], [0.7, 0.5, 0.5, 0.05, 0.85, 0, IM.crate]], { solid: [0.8, 0.6], prop: 'crate' });
	// фойе: скамья у стены, доска объявлений
	b.furniture(-2.35, 1.6, Math.PI / 2, [[1.8, 0.05, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.45, 0.4, -0.8, 0.22, 0, IM.metal], [0.06, 0.45, 0.4, 0.8, 0.22, 0, IM.metal]], { solid: [1.8, 0.4] });
	b.furniture(2.85, 1.6, -Math.PI / 2, [[1.2, 0.9, 0.04, 0, 1.6, 0, IM.furnitureLight]], { solid: [0, 0] });
	return b.finish();
}

// ---------- Водокачка (можно зайти) ----------

/**
 * Кирпичная насосная 8×6 м у водонапорной башни: насос на фундаменте, щит управления, трубы; труба из задней стены
 * (+Z своих осей) уходит к башне. Тайники: шкафчик слесаря, ящик с инструментом.
 */
function buildPumpHouse(ctx, { name = 'PumpHouse', cx, cz, ry = 0 }) {
	const W = 8, D = 6, H = 3.2, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concreteDark, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [-2.2], lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.whitewash, side: -1 });
	b.window('front', 1.6, { t, sill: M.concrete }); b.window('left', 0, { t, sill: M.concrete }); b.window('right', -0.8, { t, sill: M.concrete });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.wallBox('front', -2.2 + 1.2, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.canopy('front', -2.2, { w: 1.6, d: 0.9, y: 2.35, mat: M.roofTar, t });
	b.lower(place(box(1.4, 0.2, 1.0), -2.2, 0.1, -hz - 0.6), M.concrete);
	b.vent(2.4, 1.2, H + 0.25, M.metalDark, { h: 0.6, r: 0.14 });
	// насос на бетонном фундаменте, напорная труба вдоль задней стены и наружу
	b.furniture(1.2, 0.5, 0, [
		[2.4, 0.3, 1.1, 0, 0.15, 0, M.concreteDark], [1.2, 0.75, 0.75, -0.4, 0.68, 0, IM.machine], [0.7, 0.55, 0.6, 0.6, 0.58, 0, IM.machine],
		[0.3, 0.3, 0.3, 0.6, 1.0, 0, IM.metal], [0.24, 1.5, 0.24, 0.6, 1.55, 0.6, IM.metal],
	], { solid: [2.4, 1.1] });
	b.furniture(1.0, hz - 0.45, 0, [[W - 2.2, 0.36, 0.36, 0, 2.3, 0, IM.metal], [0.36, 0.36, 0.9, 0.0, 2.3, 0.35, IM.metal]], { solid: [0, 0] });
	b.furniture(-3.65, -1.2, Math.PI / 2, [[1.0, 1.6, 0.4, 0, 1.0, 0, IM.locker], [0.6, 0.4, 0.02, 0, 1.3, 0.21, IM.black]], { solid: [1.0, 0.4] }); // щит управления
	locker(b, 'Шкафчик слесаря', -3.45, 1.6, Math.PI / 2, { ammo919: [3, 6, 0.4], ammo12: [2, 4, 0.3], zhivchik: 0.2 });
	toolbox(b, 'Ящик с инструментом', 2.6, -2.3, 0, { ammo12: [3, 6, 0.35], fireaxe: 0.07, spore: 0.2 });
	return b.finish();
}

// ---------- Заправка (можно зайти) ----------

/**
 * Будка АЗС 12×6,4 м: фасад (−Z своих осей) к колонкам — дверь и витрины; торговый зал (прилавок, стеллаж,
 * холодильник), за перегородкой операторская (стол, сейф). Плоская крыша с парапетом, вывеска «АЗС».
 */
function buildGasStation(ctx, { name = 'GasStation', cx, cz, ry = 0 }) {
	const W = 12, D = 6.4, H = 3.2, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.6 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [-1.6], w: 1.4, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', 2.0, -hz + t / 2, hz - t / 2, { mat: IM.shopWall, t: 0.14, doors: [1.6], w: 1.1 });
	// витрины с решёткой, окно операторской, козырёк, вывеска; плоская крыша с парапетом
	for (const [x, w] of [[-4.3, 2.6], [0.5, 1.6]]) {
		b.top_(new THREE.PlaneGeometry(w, 1.5).rotateY(Math.PI).translate(x, 1.6, -hz - t / 2 - 0.02), M.glass);
		for (let k = -w / 2 + 0.2; k < w / 2; k += 0.4) b.top_(place(box(0.04, 1.5, 0.04), x + k, 1.6, -hz - t / 2 - 0.06), M.metalDark);
	}
	b.window('front', 4.0, { t, sill: M.whiteBrick });
	b.window('back', -3.0, { t, sill: M.whiteBrick });
	b.canopy('front', -1.6, { w: 2.0, d: 1.1, y: 2.5, mat: M.metalDark, t });
	b.lower(place(box(2.2, 0.16, 1.2), -1.6, 0.08, -hz - 0.7), M.concrete);
	b.top_(new THREE.PlaneGeometry(3.4, 0.62).rotateY(Math.PI).translate(1.6, H - 0.2, -hz - t / 2 - 0.03), T.signMaterial('АЗС', { bg: '#1d4f9c', fg: '#f4f4f0', w: 384, h: 72 }));
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.whiteBrick, 0.3);
	// торговый зал
	counter(b, 'Прилавок', -3.4, 1.9, Math.PI, 2.6, { ammo919: [3, 6, 0.4], zhivchik: 0.3 }, [[0.45, 0.25, 0.35, 0.8, 1.17, 0, IM.black]]);
	shelf(b, 'Стеллаж', -5.55, -0.6, Math.PI / 2, { zhivchik: 0.3, spore: 0.2 });
	b.container('Холодильник', 1.3, 2.7, Math.PI, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], [0.62, 0.6], { zhivchik: 0.45 }, 1.5);
	b.furniture(-1.2, 2.75, 0, [[0.9, 0.9, 0.5, 0, 0.45, 0, IM.white], [0.8, 0.2, 0.4, 0, 0.95, 0, IM.bottles[0]]], { solid: [0.9, 0.5] }); // ларь с напитками
	// операторская
	desk(b, 'Стол оператора', 4.0, -2.45, 0, { ammo12: [2, 5, 0.35], spore: 0.25 });
	safe(b, 'Сейф', 5.45, 2.4, -Math.PI / 2, { ammo919: [6, 10, 0.6], ammo545: [8, 16, 0.3], spore: [1, 2, 0.3] });
	chair(b, 2.75, -2.4, Math.PI / 2);
	return b.finish();
}

// ---------- Крытый рынок с ларьком (можно зайти) ----------

/**
 * Рынок 16×7 м под навесом из профлиста: сзади (+Z своих осей) — сплошная кирпичная стена, спереди (к трассе) —
 * прилавки между стойками, на восточном краю — ларёк с окошком и дверью из-под навеса. Тайники: три прилавка
 * (лицом к трассе) и стеллаж в ларьке.
 */
function buildMarket(ctx, { name = 'Market', cx, cz }) {
	const W = 16, D = 7, H = 2.9, t = 0.2, hx = W / 2, hz = D / 2, kx = 4.4;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.6 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W, D, 2), 0, 0.03, 0), M.concrete, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t });
	b.wall('x', -hz, kx, hx + t / 2, { mat: M.whiteBrick, t });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t });
	b.wall('z', kx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: [1.9], w: 1.1 });
	b.window('front', (kx + hx) / 2, { t });
	// стойки навеса и сам навес (профлист с уклоном к трассе), балка по фронту, вывеска на крыше — к камере
	for (const x of [-hx + 0.1, -4.25, -0.55]) {
		b.lower(place(box(0.14, CUT, 0.14), x, CUT / 2, -hz + 0.1), M.metalDark);
		b.top_(place(box(0.14, H - CUT, 0.14), x, CUT + (H - CUT) / 2, -hz + 0.1), M.metalDark);
		b.collide(x, -hz + 0.1, 0.2, 0.2);
	}
	b.top_(place(box(W + 0.2, 0.18, 0.14), 0, H - 0.05, -hz + 0.1), M.metalDark);
	b.top_(place(box(W + 0.8, 0.07, D + 1.4, 2), 0, H + 0.2, -0.2, 0, -0.07), M.roofMetal);
	b.top_(new THREE.PlaneGeometry(4.4, 0.8).translate(-3.2, H + 0.95, hz - 0.2), T.signMaterial('РЫНОК', { bg: '#e8e2cc', fg: '#2a4a7a', w: 384, h: 72 }));
	for (const x of [-4.9, -1.5]) b.top_(place(box(0.08, 0.9, 0.08), x, H + 0.55, hz - 0.25), M.metalDark);
	// прилавки лицом к трассе: овощи, банки, барахло
	const R3 = IM.crate, veg = M.leaves;
	counter(b, 'Прилавок', -6.1, -hz + 0.75, Math.PI, 2.6, { zhivchik: 0.3, spore: 0.15 }, [
		[0.6, 0.22, 0.4, -0.75, 1.15, 0, R3], [0.6, 0.22, 0.4, 0.05, 1.15, 0, R3], [0.5, 0.18, 0.36, -0.75, 1.32, 0, veg], [0.5, 0.18, 0.36, 0.05, 1.32, 0, M.yellow],
	]);
	counter(b, 'Прилавок', -2.4, -hz + 0.75, Math.PI, 2.6, { zhivchik: 0.35, ammo919: [2, 4, 0.25] }, [[1.8, 0.22, 0.3, 0, 1.16, 0, IM.jars], [0.9, 0.2, 0.3, 0.3, 1.38, 0, IM.cans]]);
	counter(b, 'Прилавок', 1.95, -hz + 0.75, Math.PI, 2.6, { ammo12: [2, 4, 0.3], spore: 0.2 }, [[1.0, 0.12, 0.6, -0.5, 1.11, 0, IM.rag], [0.8, 0.1, 0.5, 0.6, 1.1, 0, IM.blanket]]);
	// за прилавками — ящики и мешки
	b.furniture(-6.0, 2.6, 0.1, [[0.8, 0.6, 0.6, -0.5, 0.3, 0, R3], [0.8, 0.6, 0.6, 0.45, 0.3, 0, R3], [0.7, 0.5, 0.5, 0, 0.85, 0, R3]], { solid: [1.8, 0.7], prop: 'crate' });
	b.furniture(0.2, 2.75, 0, [[0.55, 0.7, 0.4, -0.35, 0.35, 0, M.sandbag], [0.55, 0.7, 0.4, 0.3, 0.35, 0.05, M.sandbag]], { solid: [1.3, 0.5] });
	// ларёк: прилавок под окошком, стеллаж с товаром
	b.furniture((kx + hx) / 2, -hz + 0.4, 0, [[2.4, 1.0, 0.5, 0, 0.5, 0, IM.furniture], [2.5, 0.05, 0.6, 0, 1.02, 0, IM.furnitureLight]], { solid: [2.4, 0.5] });
	shelf(b, 'Стеллаж', hx - 0.35, 0.3, -Math.PI / 2, { ammo919: [3, 6, 0.4], zhivchik: 0.3, grenade: 0.03 });
	return b.finish();
}

// ---------- Гаражи кооператива (туда заходят) ----------

/**
 * Ряд кирпичных гаражей: одно здание, боксы через перегородки, ворота — в южной стене (+Z). loot — тайник
 * каждого бокса ({ kind: bench | shelf | cache | safe, loot }; null — ворота заперты).
 */
function buildGarageRow(ctx, { name, cx, cz, n, loot }) {
	const bay = 4, depth = 6, t = 0.25, H = 2.6, W = n * bay, D = depth, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.3 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	const centers = [...Array(n)].map((_, i) => -W / 2 + bay / 2 + i * bay);
	const open = centers.filter((_, i) => loot[i]);
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: open, w: 2.8 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t });
	for (let i = 1; i < n; i++) b.wall('z', -W / 2 + i * bay, -hz + t / 2, hz - t / 2, { mat: M.brick, t: 0.15 });
	b.top_(place(box(W + 0.5, 0.14, D + 0.5, 3), 0, H + 0.07, 0), M.roofTar);
	for (const [i, at] of centers.entries()) {
		const L = loot[i];
		if (!L) { b.wallBox('back', at, 2.9, 0.02, 2.15, 0.06, M.metalOlive, { t }); continue; }
		for (const s of [-1, 1]) b.furniture(at + s * 1.4, hz - 0.1, s * -1.65, [[1.35, 2.1, 0.06, s * 0.67, 1.05, 0, M.metalRust]], { up: true });
		const lx = at, lz = -hz + 0.6;
		if (L.kind === 'bench') workbench(b, 'Верстак', lx, lz, 0, L.loot);
		else if (L.kind === 'shelf') shelf(b, 'Стеллаж', lx, lz - 0.15, 0, L.loot, 'tools');
		else if (L.kind === 'safe') safe(b, 'Сейф', lx + 1.0, lz, 0, L.loot);
		else b.container('Тайник под верстаком', lx, lz, 0, [[2.1, 0.06, 0.85, 0, 0.88, 0, IM.metal], ...[[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]].map(([px, pz]) => [0.08, 0.85, 0.08, px, 0.42, pz, IM.furniture]), [1.0, 0.5, 0.6, -0.3, 0.26, 0.05, IM.crateGreen], [0.5, 0.4, 0.4, 0.6, 0.2, 0.1, IM.crateGreen]], [2.0, 0.8], L.loot, 1.0);
		if (i % 2) b.furniture(at + 1.4, -hz + 2.2, 0, [[0.6, 0.5, 0.6, 0, 0.25, 0, IM.black]], { solid: [0.6, 0.6], prop: 'tire' });
		else b.furniture(at - 1.3, -hz + 2.2, 0.3, [[0.5, 0.75, 0.5, 0, 0.37, 0, IM.metal]], { solid: [0.5, 0.5], prop: 'barrel' });
	}
	return b.finish();
}

// ---------- Уличное ----------

/** Памятник воину: ступенчатый постамент с табличкой, фигура в плащ-палатке (серебрянка), венок. Лицом к югу. */
function monument(batch, M, collide, x, z) {
	batch.add(place(box(4.2, 0.3, 4.2, 1), x, 0.15, z), M.concrete);
	batch.add(place(box(3.2, 0.3, 3.2, 1), x, 0.45, z), M.concrete);
	batch.add(place(box(1.6, 2.0, 1.6, 1), x, 1.6, z), M.concreteDark);
	batch.add(place(box(0.9, 0.5, 0.04), x, 1.7, z + 0.82), M.metalDark);
	const S = M.silver;
	batch.add(place(cyl(0.4, 0.62, 1.5, 10), x, 3.35, z), S); // шинель
	batch.add(place(cyl(0.34, 0.4, 0.9, 10), x, 4.5, z), S); // торс
	batch.add(place(new THREE.SphereGeometry(0.21, 10, 8), x, 5.12, z), S); // голова
	batch.add(place(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), x, 5.18, z), S); // каска
	batch.add(place(box(0.14, 0.8, 0.14), x + 0.42, 4.3, z + 0.05, 0, 0, 0.25), S); // опущенная рука
	batch.add(place(box(0.14, 0.7, 0.14), x - 0.36, 4.55, z + 0.25, 0, 0.9, -0.3), S); // рука к груди
	batch.add(place(box(0.09, 0.12, 0.95), x - 0.05, 4.55, z + 0.38, -0.5, 0.15), M.metalDark); // автомат на груди
	batch.add(place(new THREE.TorusGeometry(0.34, 0.09, 6, 14).rotateX(-Math.PI / 2 + 0.35), x, 0.72, z + 1.15), M.leaves); // венок
	collide(x, z, 3.4, 3.4);
}

/** Сельская остановка из белого кирпича: открыта в сторону локальной +Z, лавка внутри, табличка «А» на столбике. */
function busStop(batch, M, root, collide, x, z, ry) {
	const tf = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(4.6, 2.4, 0.15, 1.5), M.whiteBrick, 0, 1.2, -0.75);
	for (const dx of [-2.25, 2.25]) add(box(0.15, 2.4, 1.6, 1.5), M.whiteBrick, dx, 1.2, 0);
	add(box(5.0, 0.12, 2.0, 2), M.roofMetal, 0, 2.5, 0.05);
	add(box(3.8, 0.08, 0.42), M.wood, 0, 0.5, -0.4);
	for (const dx of [-1.6, 1.6]) add(box(0.08, 0.5, 0.4), M.wood, dx, 0.25, -0.4);
	add(box(0.07, 2.4, 0.07), M.metalDark, 3.0, 1.2, 0.6);
	const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), T.signMaterial('А', { bg: '#e8c838', fg: '#1a1a1a', w: 96, h: 96 }));
	plate.position.set(3.0, 2.2, 0.65).applyMatrix4(tf);
	root.add(plate);
	collide(x, z, 4.7, 1.7, ry);
}

/** Пожарище: фундамент, обугленные огрызки стен (проход — сзади), уцелевшая печная труба, рухнувший профлист. */
function burnedHouse(batch, M, collide, x, z) {
	batch.add(place(box(10, 0.3, 7.6, 2), x, 0.15, z), M.concreteDark, { cast: false });
	for (const [w, h, d, px, pz] of [[10, 1.4, 0.25, 0, -3.7], [4, 2.1, 0.25, -3, 3.7], [3, 0.9, 0.25, 3.5, 3.7], [0.25, 1.8, 7.6, -4.9, 0], [0.25, 0.7, 3.5, 4.9, -1.9]]) {
		batch.add(place(box(w, h, d, 1.2), x + px, h / 2, z + pz), M.tankBlack);
		collide(x + px, z + pz, w + 0.04, d + 0.04, 0, true);
	}
	batch.add(place(box(0.9, 5.2, 0.9, 1), x + 2.0, 2.6, z + 0.6), M.brick);
	batch.add(place(box(1.05, 0.12, 1.05, 1), x + 2.0, 5.2, z + 0.6), M.brick);
	collide(x + 2.0, z + 0.6, 1.0, 1.0);
	for (const [px, pz, ry, rz] of [[-2.2, -1.2, 0.3, 0.25], [-0.5, 1.4, -0.2, -0.2], [3.4, -1.6, 1.2, 0.15]]) batch.add(place(box(3.2, 0.05, 1.4, 2), x + px, 0.5, z + pz, ry, 0, rz), M.roofMetal);
	for (const [px, pz, ry] of [[-1.5, 0.2, 0.7], [0.8, -1.8, 2.1], [1.2, 2.0, -0.4], [-3.4, 2.2, 1.4]]) batch.add(place(box(3.0, 0.2, 0.2), x + px, 0.38, z + pz, ry, 0, 0.12), M.tankBlack);
}

export default {
	id: 'zarechny',
	seed: 1337,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// трасса (запад—восток) и улица на север — до самой мути
		ground(184, 8, 0, 6, M.asphalt, 5, 0.02);
		ground(184, 1.6, 0, 1.2, M.dirt, 3, 0.014);
		ground(184, 1.6, 0, 10.8, M.dirt, 3, 0.014);
		ground(6, 94, 12, -45, M.asphalt, 5, 0.022);
		ground(184, 0.15, 0, 6, markingMaterial(), 6, 0.026);
		// грунтовка к частным домам, двор хрущёвки, площадка у гаражей
		ground(72, 4, -26, -22, M.dirt, 4, 0.016);
		ground(42, 12, -18, 18, M.dirt, 5, 0.014);
		ground(40, 8, 20, 34, M.dirt, 5, 0.014);
		ground(14, 10, 26, -10, M.dirt, 4, 0.015);

		// ---------- Хрущёвка (5 этажей) ----------
		{
			const cx = -18, cz = 30, W = 38.4, D = 12, H = 14;
			occluder('Khrushchyovka', (kb) => {
				kb.add(place(box(W, H, D, 3.2, 2.8), cx, H / 2 + 0.6, cz), M.panel);
				kb.add(place(box(W + 0.3, 0.8, D + 0.3, 2), cx, 0.4, cz), M.brick); // цоколь — кирпичный, темнее панелей
				khrushchyovkaDetails(kb, M, { cx, cz, W, D, H });
				for (const ex of [-12.8, 0, 12.8]) {
					const x = cx + ex, z = cz - D / 2;
					kb.add(place(box(2.6, 0.15, 1.6), x, 2.9, z - 0.8), M.concrete); // козырёк
					kb.add(place(box(2.7, 0.08, 0.04), x, 2.9, z - 1.62), M.metalRust); // ржавый отлив по краю козырька
					kb.add(place(box(1.3, 2.2, 0.1), x, 1.7, z - 0.05), M.metalRust); // железная дверь
				}
				// балконы на северном фасаде (генератор вызывается, как раньше: какие балконы есть и из чего ограждение)
				for (let floor = 1; floor < 5; floor++) for (let c = 0; c < 12; c++) {
					if (c % 4 === 0 || rnd() < 0.45) continue;
					const x = cx - W / 2 + 1.6 + c * 3.2, y = 0.6 + floor * 2.8;
					balcony(kb, M, x, y, cz - D / 2, -1, rnd() < 0.5 ? M.metalRust : M.woodGrey, hash01('khr-n', c, floor), { full: false });
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
				beginProp('dumpster', -1 + i * 1.4, 22, 0);
				batch.add(place(box(1.2, 1.1, 0.9, 1), -1 + i * 1.4, 0.55, 22, R(-0.1, 0.1)), M.green);
				endProp();
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

		// ---------- Окраина ----------
		// хутор на северо-западе: дом за забором у грунтовки, сарай, поленница, туалет
		buildings.push(
			buildHouse(bctx, { name: 'House4', cx: -54, cz: -36, ry: Math.PI, rnd, variant: 3 }),
			buildHouse(bctx, { name: 'House5', cx: -55, cz: 44, ry: 0, rnd, variant: 4 }),
			buildDacha(bctx, { name: 'Cabin', cx: 54, cz: -50, ry: Math.PI, rnd, variant: 5, paint: M.woodGrey }),
			buildWorkshop(bctx, { name: 'Workshop', cx: 54, cz: 44, ry: Math.PI / 2 }),
		);
		fencePlot(batch, M, collide, -54, -36, 16, 14, 's', rnd);
		shed(batch, M, collide, -59.6, -41.4, 0.05);
		woodpile(batch, M, collide, -48.4, -41.6, 0);
		outhouse(batch, M, collide, -48.6, -30.6, Math.PI);
		// дом на юго-западе, за хрущёвкой: забор, бельё во дворе
		fencePlot(batch, M, collide, -55, 44, 16, 14, 'n', rnd);
		clothesline(batch, M, root, collide, -61, -51, 49.6, rnd);
		woodpile(batch, M, collide, -48.6, 49.2, 0);
		// охотничья избушка в роще на северо-востоке
		woodpile(batch, M, collide, 49.6, -46.6, Math.PI / 2);
		outhouse(batch, M, collide, 59.6, -55.6, 0);
		// автосервис у гаражей: бетонная площадка перед воротами
		ground(8, 20, 43, 44, M.concrete, 4, 0.017);

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
			// становится прозрачной, когда загораживает героя (как хрущёвка)
			occluder('WaterTower', (kb) => {
				const pipe = new THREE.CylinderGeometry(0.9, 1.1, 12, 12);
				kb.add(place(pipe, x, 6, z), M.metalRust);
				const tank = new THREE.CylinderGeometry(2.6, 2.6, 3.5, 16);
				kb.add(place(tank, x, 13.6, z), M.metalRust);
				const cone = new THREE.ConeGeometry(2.8, 1.4, 16);
				kb.add(place(cone, x, 16.1, z), M.metalRust);
			}, { cx: x, cz: z, ry: 0, hx: 2.9, hz: 2.9, top: 16.8 }, 0.2);
			collide(x, z, 2.4, 2.4);
		}

		// ---------- Столбы ЛЭП с проводами ----------
		if (OPTIONS.poles) {
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
		// на окраине: у автосервиса, на трассе за посёлком, автобус у западного въезда
		car(42.6, 39, Math.PI / 2 + 0.12, 0x9a8a5a);
		car(43.4, 50.5, Math.PI / 2 - 0.2, 0x2a2a2a, { burned: true });
		car(51, 4.4, 0.3, 0x5a7a8a, { crashed: true });
		bus(batch, M, root, -53, 8.1, Math.PI / 2 + 0.05);
		collide(-53, 8.1, 2.6, 8.4, Math.PI / 2 + 0.05);

		// ---------- Обжитость: фонари, бордюры, баррикада, огороды, дворы, брошенные вещи ----------
		// бордюры вдоль трассы (на перекрёстке с улицей — разрыв)
		// (с разрывами у заезда на заправку и у проездов на Садовую)
		for (const [x0, x1, z] of [[-88, 8.6, 1.95], [15.4, 57.5, 1.95], [82.5, 88, 1.95], [-88, -45.2, 10.05], [-40.8, 42.8, 10.05], [47.2, 88, 10.05]]) {
			batch.add(place(box(x1 - x0, 0.14, 0.24, 2), (x0 + x1) / 2, 0.07, z), M.concrete, { cast: false });
		}
		for (const x of [-40, -16, 8, 32]) streetLamp(batch, M, collide, x, 11.4);
		barricade(batch, M, collide, -41.2, rnd);
		powerLine(batch, root, M, collide, -40, 40, 57);
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

		// ==================== Новые районы (кольцо между прежним краем и мутью) ====================
		// машины — car() из раздела «Машины», цвета — из уже бывших (краска не пересчитывается заново)
		// дороги: Садовая за гаражами, проезды к ней с трассы, проезд к клубу, площадки заправки и рынка
		ground(168, 5, -1, 64, M.dirt, 4, 0.017);
		ground(4, 52, -43, 36, M.dirt, 4, 0.016);
		ground(4, 24, 45, 22, M.dirt, 4, 0.016);
		ground(4, 8, 45, 58, M.dirt, 4, 0.016);
		ground(22, 4, -2, -50, M.dirt, 4, 0.016);
		ground(22, 11, -24, -50, M.concrete, 3, 0.015);
		ground(24, 25, 70, -11.5, M.concrete, 4, 0.016);
		ground(18, 8, -70, 14.2, M.asphalt, 5, 0.018);
		ground(8, 7, 17, -66, M.dirt, 4, 0.016);

		// ---------- Клуб со сквером и памятником (северо-запад) ----------
		buildings.push(buildClub(bctx, { cx: -24, cz: -63 }));
		monument(batch, M, collide, -24, -49.5);
		for (const x of [-30.5, -17.5]) bench(batch, M, x, -46.2, 0);
		bench(batch, M, -33.2, -51, -Math.PI / 2);
		bench(batch, M, -14.8, -51, Math.PI / 2);
		garden(batch, M, rnd, -29.6, -51.2, 2, 3.6);
		garden(batch, M, rnd, -18.4, -51.2, 2, 3.6);
		streetLamp(batch, M, collide, -34.4, -45.4);
		streetLamp(batch, M, collide, -13.6, -45.4);
		billboard(batch, M, root, collide, -5, -55.6, 0, 'СЛАВА ТРУДУ!', { w: 3.6, h: 0.9, y: 2.0, bg: '#9a2a20', fg: '#f0e6c8' });

		// ---------- Водокачка у улицы на Химмаш: насосная и вторая башня, труба между ними ----------
		buildings.push(buildPumpHouse(bctx, { cx: 24, cz: -66, ry: Math.PI / 2 }));
		occluder('WaterTower2', (kb) => waterTower(kb, M, collide, 35, -66), { cx: 35, cz: -66, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);
		batch.add(place(cyl(0.18, 0.18, 6.2, 10).rotateZ(Math.PI / 2), 30.2, 2.3, -67), M.metalRust); // напорная труба поверху — под ней можно пройти
		for (const x of [29.2, 31.8]) { batch.add(place(box(0.16, 2.2, 0.16), x, 1.1, -67), M.metalDark); collide(x, -67, 0.3, 0.3); }

		// ---------- Заправка у трассы (север, к стабу): будка, навес над колонками, стела ----------
		buildings.push(buildGasStation(bctx, { cx: 70, cz: -18, ry: Math.PI }));
		occluder('GasCanopy', (kb) => {
			kb.add(place(box(14.4, 0.45, 9.0, 2), 70, 4.75, -5.5), M.white);
			for (const s of [-1, 1]) { kb.add(place(box(14.6, 0.32, 0.12), 70, 4.75, -5.5 + s * 4.56), M.red); kb.add(place(box(0.12, 0.32, 9.2), 70 + s * 7.26, 4.75, -5.5), M.red); } // красный пояс по краю навеса
			for (const [x, z] of [[66.8, -7.6], [73.2, -7.6], [66.8, -3.4], [73.2, -3.4]]) kb.add(place(box(0.32, 4.3, 0.32), x, 2.15, z), M.white);
		}, { cx: 70, cz: -5.5, ry: 0, hx: 7.3, hz: 4.6, top: 5.0 }, 0.15);
		for (const z of [-7.6, -3.4]) {
			batch.add(place(box(7.2, 0.22, 1.0, 1), 70, 0.11, z), M.concrete);
			collide(70, z, 7.2, 1.0);
			for (const x of [68.4, 71.6]) {
				batch.add(place(box(0.7, 1.6, 0.5, 1), x, 1.02, z), M.white);
				batch.add(place(box(0.74, 0.3, 0.54), x, 1.9, z), M.red);
				batch.add(place(box(0.4, 0.25, 0.02), x, 1.5, z + 0.26), M.glass);
			}
		}
		car(70.4, -5.5, 0.04, 0x7b8a5a);
		for (const [x, z] of [[60.8, -13], [60.8, -17], [62.6, -15]]) batch.add(place(cyl(0.4, 0.4, 0.06, 12), x, 0.05, z), M.metalDark, { cast: false }); // люки ёмкостей
		batch.add(place(box(0.6, 1.2, 0.5), 79.5, 0.6, -12), M.red); // колонка подкачки шин
		collide(79.5, -12, 0.7, 0.6);
		billboard(batch, M, root, collide, 59.6, -1.2, 0, 'АЗС  92 · 95 · ДТ', { w: 3.2, h: 1.0, y: 4.0, bg: '#1d4f9c', fg: '#f4f4f0' });

		// ---------- Рынок и остановка у трассы (запад, к дачам) ----------
		buildings.push(buildMarket(bctx, { cx: -70, cz: 22 }));
		busStop(batch, M, root, collide, -56, 12.9, Math.PI);
		streetLamp(batch, M, collide, -64, 11.4);
		streetLamp(batch, M, collide, 56, 11.4);
		for (const [x, z, r] of [[-61.2, 16.6, 0.3], [-79.2, 15.4, -0.2]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(0.8, 0.6, 0.6), x, 0.3, z, r), M.wood);
			endProp();
			collide(x, z, 0.9, 0.7, r);
		}

		// ---------- Гаражи кооператива между хрущёвкой и Садовой (ворота на юг) ----------
		buildings.push(buildGarageRow(bctx, {
			name: 'Coop', cx: -20, cz: 51, n: 8,
			loot: [{ kind: 'bench', loot: { ammo12: [3, 6, 0.4], fireaxe: 0.06, spore: 0.2 } }, null, { kind: 'shelf', loot: { ammo919: [4, 8, 0.45], zhivchik: 0.25 } }, null,
				null, { kind: 'cache', loot: { ammo545: [10, 20, 0.45], ammo12: [4, 8, 0.4], grenade: 0.05 } }, null, { kind: 'safe', loot: { ammo919: [6, 12, 0.6], spore: [1, 2, 0.35] } }],
		}));
		car(-26.5, 57.6, Math.PI + 0.1, 0xa8a49a);
		// спортплощадка за старыми гаражами: ворота из труб
		ground(22, 9, 22, 51.5, M.dirt, 4, 0.015);
		for (const x of [11.6, 32.4]) {
			for (const dz of [-1.5, 1.5]) { batch.add(place(box(0.1, 2.0, 0.1), x, 1.0, 51.5 + dz), M.white); collide(x, 51.5 + dz, 0.25, 0.25); }
			batch.add(place(box(0.1, 0.1, 3.1), x, 2.0, 51.5), M.white);
		}

		// ---------- Садовая: вторая улица частных домов (южная сторона), пожарище на краю ----------
		buildings.push(
			buildHouse(bctx, { name: 'House6', cx: -64, cz: 76, ry: 0, rnd, variant: 5 }),
			buildDacha(bctx, { name: 'Dacha1', cx: -44.5, cz: 76, ry: 0, rnd, variant: 6 }),
			buildHouse(bctx, { name: 'House7', cx: -22, cz: 76, ry: 0, rnd, variant: 6 }),
			buildDacha(bctx, { name: 'Dacha2', cx: 12.5, cz: 76, ry: 0, rnd, variant: 7, paint: M.woodBlue }),
			buildHouse(bctx, { name: 'House8', cx: 36, cz: 76, ry: 0, rnd, variant: 7 }),
		);
		fencePlot(batch, M, collide, -64, 76, 18, 14, 'n', rnd);
		fencePlot(batch, M, collide, -43, 75, 13, 12, 'n', rnd);
		fencePlot(batch, M, collide, -22, 76, 18, 14, 'n', rnd);
		fencePlot(batch, M, collide, 14, 75, 13, 12, 'n', rnd);
		fencePlot(batch, M, collide, 36, 76, 18, 14, 'n', rnd);
		fencePlot(batch, M, collide, 60, 76, 16, 14, 'n', rnd);
		garden(batch, M, rnd, -57.2, 76.2, 2, 8);
		garden(batch, M, rnd, -39.4, 76, 3, 6);
		garden(batch, M, rnd, -29.0, 76.2, 2, 8);
		garden(batch, M, rnd, 17.6, 76, 3, 6);
		garden(batch, M, rnd, 43.0, 76.2, 2, 8);
		woodpile(batch, M, collide, -70.8, 70.6, 0);
		woodpile(batch, M, collide, -28.8, 70.6, 0);
		woodpile(batch, M, collide, 29.2, 70.6, 0);
		outhouse(batch, M, collide, -71.6, 81.4, Math.PI);
		outhouse(batch, M, collide, -48.2, 79.9, Math.PI);
		outhouse(batch, M, collide, -14.4, 81.4, Math.PI);
		outhouse(batch, M, collide, 9.0, 79.9, Math.PI);
		outhouse(batch, M, collide, 28.4, 81.4, Math.PI);
		shed(batch, M, collide, -58.0, 81.5, 0.05);
		shed(batch, M, collide, 42.6, 81.5, -0.05);
		waterBarrel(batch, M, collide, -37.6, 79.8);
		waterBarrel(batch, M, collide, 19.6, 79.8);
		well(batch, M, collide, -26.0, 81.0);
		burnedHouse(batch, M, collide, 60, 76.5);
		// водоразборная колонка у дороги
		batch.add(place(cyl(0.12, 0.14, 1.2, 8), -3, 0.6, 67.6), M.woodBlue);
		batch.add(place(box(0.06, 0.06, 0.7), -3, 1.15, 67.85, 0, 0.4), M.metalDark);
		collide(-3, 67.6, 0.4, 0.4);
		car(-50, 64.6, 0.05, 0x3a5a7a, { crashed: true });
		car(24, 63.4, Math.PI - 0.15, 0x222222, { burned: true });


		const onRoad = (x, z, m = 0) => Math.abs(z - 6) < 5.5 + m || (Math.abs(x - 12) < 3.5 + m && z < 3 + m)
			|| (Math.abs(z - 64) < 2.5 + m && x > -85 && x < 83) // Садовая
			|| ((Math.abs(x + 43) < 2 + m || Math.abs(x - 45) < 2 + m) && z > 9 && z < 63) // проезды к Садовой
			|| (x > -35 - m && x < 9 + m && z > -56 - m && z < -44 + m) // сквер у клуба и проезд к улице
			|| (x > 58 - m && x < 82 + m && z > -24 - m && z < 1) // заправка
			|| (x > -79 - m && x < -61 + m && z > 10 && z < 18.4 + m); // площадка у рынка
		return {
			start: [82.5, 6, -Math.PI / 2], // на восточном конце трассы, у края кластера
			exits: [
				{ to: 'stab', x0: 85.2, x1: 90, z0: 2, z1: 10, spawn: [82.5, 6, -Math.PI / 2], sign: [84, 12.2, 'Стаб «Полис» →'] },
				{ to: 'dachi', x0: -90, x1: -85.2, z0: 2, z1: 10, spawn: [-82.5, 6, Math.PI / 2], sign: [-84, 12.2, '← Дачи'] },
				{ to: 'bolnica', x0: 9, x1: 15, z0: -90, z1: -85.2, spawn: [12, -82.5, 0], sign: [16, -84, '↑ Больница'] },
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
				// окраина
				{ at: [-54, -26], r: 6, runners: 2 },
				{ at: [54, -44], r: 5, runners: 1, stompers: 1 },
				{ at: [40, 44], r: 6, runners: 2, stompers: 1 },
				{ at: [-55, 33], r: 6, runners: 2 },
				{ at: [0, 56], r: 10, runners: 2 },
				{ at: [-54, 56], r: 5, runners: 1 },
				// новые районы: клуб, водокачка, улица на Химмаш, леса, рынок, заправка, кооператив, Садовая, пожарище
				{ at: [-24, -51], r: 7, runners: 2 },
				{ at: [-20, -64], r: 6, runners: 2 },
				{ at: [22, -60], r: 6, runners: 1, stompers: 1 },
				{ at: [6, -72], r: 6, runners: 2 },
				{ at: [60, -72], r: 7, runners: 2 },
				{ at: [-66, -66], r: 7, runners: 1 },
				{ at: [-70, 15], r: 6, runners: 2 },
				{ at: [-62, 3], r: 7, runners: 1 },
				{ at: [68, -12], r: 7, runners: 2 },
				{ at: [72, 40], r: 7, runners: 2 },
				{ at: [-20, 57.5], r: 7, runners: 2, stompers: 1 },
				{ at: [22, 51], r: 7, runners: 1 },
				{ at: [-62, 66], r: 7, runners: 2 },
				{ at: [-22, 70], r: 6, runners: 1, stompers: 1 },
				{ at: [30, 66], r: 7, runners: 2 },
				{ at: [60, 70], r: 6, runners: 2 },
			],
			onRoad,
			// горит брошенная машина у гаражей, костры в бочках на обочине и у гаражей, у рынка; тлеет пожарище
			fires: [[-4, -8, 'car'], [7.5, 12.8], [-23, -19], [-74.5, 16.2], [61.2, 78, 'ground']],
			trees(tryTree) {
				for (let i = 0; i < 30; i++) tryTree(R(26, 46), R(-46, -22), rnd() < 0.8 ? 'birch' : 'pine'); // роща
				for (let i = 0; i < 16; i++) tryTree(R(-38, 0), R(12, 24) - (rnd() < 0.5 ? 0 : -2), 'birch'); // двор
				for (let i = 0; i < 40; i++) tryTree(R(-47, 47), R(-47, 47), rnd() < 0.7 ? 'birch' : (rnd() < 0.5 ? 'pine' : 'apple'));
				// лес у мути — по всем краям (сосны, что росли полосой у прежнего края, — теперь здесь)
				for (let i = 0; i < 46; i++) tryTree(R(-86, 86), R(-86, -79), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 40; i++) tryTree(R(-86, 86), R(83.5, 86.5), 'pine');
				for (let i = 0; i < 34; i++) tryTree(R(-86, -79), R(-79, 83), rnd() < 0.5 ? 'pine' : 'birch');
				for (let i = 0; i < 34; i++) tryTree(R(79, 86), R(-79, 83), rnd() < 0.5 ? 'pine' : 'birch');
				// рощи: северо-запад за клубом, северо-восток у избушки, восток за автосервисом
				for (let i = 0; i < 28; i++) tryTree(R(-80, -40), R(-80, -46), rnd() < 0.5 ? 'pine' : 'birch');
				for (let i = 0; i < 22; i++) tryTree(R(42, 80), R(-80, -56), rnd() < 0.4 ? 'pine' : 'birch');
				for (let i = 0; i < 24; i++) tryTree(R(63, 80), R(16, 60), rnd() < 0.6 ? 'birch' : 'pine');
				// лесополосы: берёзы вдоль улицы на Химмаш и вдоль трассы за посёлком, яблони в садах Садовой
				for (let z = -84; z < -54; z += 3.2) { if (z < -73) tryTree(17.8 + R(-0.3, 0.3), z, 'birch'); tryTree(6.2 + R(-0.3, 0.3), z + 1.6, 'birch'); }
				for (let x = -86; x < -58; x += 3.4) tryTree(x + R(-0.4, 0.4), -1.6, 'birch');
				for (let x = 52; x < 86; x += 3.4) tryTree(x + R(-0.4, 0.4), 14.2, 'birch');
				for (const cx of [-64, -43, -22, 14, 36]) for (let k = 0; k < 2; k++) tryTree(cx + R(-6, 6), R(80.5, 82), 'apple');
			},
			beltDensity: 1.3,
			barrels: 7,
			puddle: () => [R(-84, 84), rnd() < 0.5 ? R(3, 9) : R(-84, 84)],
			hint: (b) => ({
				Shop: 'Магазин «Продукты» — обыщи прилавок и подсобку', Workshop: 'Автосервис — обыщи верстаки, стеллажи и шкафчики', Cabin: 'Охотничья избушка — обыщи шкаф и сундук',
				Club: 'Клуб — обыщи сундук за сценой, библиотеку, кабинет заведующего с сейфом и кладовую',
				PumpHouse: 'Водокачка — шкафчик слесаря и ящик с инструментом',
				GasStation: 'Заправка — прилавок, стеллаж, холодильник, в операторской — стол и сейф',
				Market: 'Рынок — обыщи прилавки и стеллаж в ларьке',
				Coop: 'Гаражи кооператива — верстак, стеллаж, тайник под верстаком, сейф',
				Dacha1: 'Дачный домик — обыщи шкаф, сундук и буфет', Dacha2: 'Дачный домик — обыщи шкаф, сундук и буфет',
			}[b.name] ?? 'Дом — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
