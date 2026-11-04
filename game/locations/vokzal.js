// Кластер «Ж/д станция»: узловая станция «Узловая», которую Улей перенёс вместе с путями, составами и привокзальной
// площадью. Через всю локацию с запада на восток идут четыре пути (к Лесопилке и к Подстанции), пятый — подъездной,
// в локомотивное депо на северо-западе. У путей — платформа у вокзала и островная платформа под навесами, над путями —
// пешеходный мост. Вокзал — кирпичный, с часами: зал ожидания, кассы, буфет, комната транспортной милиции
// с оружейным шкафом. На путях брошены пригородный поезд, грузовые составы с цистернами, платформами и крытыми
// вагонами, маневровый тепловоз; в депо — тепловоз на канаве. К северу от путей — грузовой двор с рампой
// и двумя пакгаузами, водокачка, дом отдыха локомотивных бригад. К югу — привокзальная площадь с паровозом-памятником,
// остановкой, стоянкой такси, ларьками и магазином; на восток — переезд со шлагбаумами и будкой дежурного, через
// него — дорога на север к Химмашу; на юг — дорога к Дачам. Переходить пути можно по переезду, в разрывах между
// вагонами и по краям составов. Опасность 2: бегуны на путях и платформах, топтуны в депо и пакгаузах, рубер в депо.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair, buildWarehouse, buildGuardhouse, buildArmyBarracks, buildShop } from '../buildings.js';
import { addCar, bus, streetLamp, bench, markingMaterial, transformer } from '../props.js';
import { railTrack, tankWagon, flatWagon, waterTower, hazardBarrels, armyTruck, barrier, billboard } from '../props-industrial.js';

const cyl = (r, h, seg = 12) => new THREE.CylinderGeometry(r, r, h, seg);

// ---------- Подвижной состав (всё — в общую статику, с коллайдером) ----------

/** Тележка вагона с axles осями в точке lx по оси вагона. */
function bogie(batch, M, x, z, ry, lx, axles = 2) {
	const put = (g, px, y, pz, mat) => batch.add(place(g.translate(px, 0, pz), x, y, z, ry), mat);
	put(box(axles * 1.2 + 1.0, 0.5, 2.0), lx, 0.55, 0, M.metalDark);
	for (let i = 0; i < axles; i++) for (const wz of [-0.76, 0.76]) put(cyl(0.45, 0.14).rotateX(Math.PI / 2), lx + (i - (axles - 1) / 2) * 1.2, 0.45, wz, M.rail);
}

/** Полукруглая крыша вагона: арка шириной 2r, высотой r*k, с торцами. */
function archRoof(batch, M, x, y, z, ry, r, len, k, mat) {
	const put = (g) => batch.add(place(g, x, y, z, ry), mat);
	put(new THREE.CylinderGeometry(r, r, len, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, k, 1));
	for (const ex of [-1, 1]) put(new THREE.CircleGeometry(r, 12, 0, Math.PI).scale(1, k, 1).rotateY(ex > 0 ? Math.PI / 2 : -Math.PI / 2).translate(ex * len / 2, 0, 0));
}

/** Пассажирский вагон 16 м: зелёный, лента окон, двери в торцах, жёлтая полоса. */
function coach(batch, M, collide, x, z, ry, paint) {
	const L = 16;
	const put = (g, px, y, pz, mat) => batch.add(place(g.translate(px, 0, pz), x, y, z, ry), mat);
	for (const bx of [-5.6, 5.6]) bogie(batch, M, x, z, ry, bx);
	put(box(L, 0.3, 2.7), 0, 1.1, 0, M.metalDark);
	put(box(L, 2.5, 3.0, 1.5), 0, 2.45, 0, paint);
	archRoof(batch, M, x, 3.7, z, ry, 1.5, L - 0.2, 0.3, M.metalDark);
	put(box(L - 3, 0.9, 3.04), 0, 2.85, 0, M.glass); // лента окон
	for (let i = 0; i <= 8; i++) put(box(0.3, 0.9, 3.06), -(L - 3) / 2 + i * (L - 3) / 8, 2.85, 0, paint); // простенки
	for (const ex of [-1, 1]) {
		put(box(0.9, 2.1, 3.06), ex * (L / 2 - 0.85), 2.25, 0, M.metalDark); // тамбурные двери
		put(box(0.9, 0.25, 3.2), ex * (L / 2 - 0.85), 1.0, 0, M.metalDark); // подножки
	}
	put(box(L + 0.02, 0.16, 3.02), 0, 1.6, 0, M.yellow);
	collide(x, z, L, 3.0, ry);
}

/** Крытый грузовой вагон 12 м: ржавый, сдвинутая дверь. */
function boxcar(batch, M, collide, x, z, ry, paint) {
	const L = 12;
	const put = (g, px, y, pz, mat) => batch.add(place(g.translate(px, 0, pz), x, y, z, ry), mat);
	for (const bx of [-4.0, 4.0]) bogie(batch, M, x, z, ry, bx);
	put(box(L, 0.3, 2.7), 0, 1.1, 0, M.metalDark);
	put(box(L, 2.6, 2.9, 1.5), 0, 2.55, 0, paint);
	archRoof(batch, M, x, 3.85, z, ry, 1.45, L - 0.2, 0.25, M.metalDark);
	put(box(2.4, 2.2, 3.0), 1.0, 2.4, 0, M.metalDark); // сдвижная дверь
	put(box(L - 1.5, 0.08, 3.06), 0, 3.7, 0, M.metalDark); // рельс двери
	for (const ex of [-1, 1]) put(box(0.12, 2.6, 2.96), ex * (L / 2 - 0.4), 2.55, 0, M.metalDark); // угловые стойки
	collide(x, z, L, 3.0, ry);
}

/** Маневровый тепловоз 14 м: кабина в конце, длинный капот, две трёхосные тележки. Кабина — к +X своих осей. */
function diesel(batch, M, collide, x, z, ry, paint) {
	const L = 14;
	const put = (g, px, y, pz, mat) => batch.add(place(g.translate(px, 0, pz), x, y, z, ry), mat);
	for (const bx of [-4.3, 4.3]) bogie(batch, M, x, z, ry, bx, 3);
	put(box(L, 0.4, 2.9), 0, 1.2, 0, M.metalDark); // рама
	put(box(L - 3.4, 2.3, 2.6, 1.5), -1.7, 2.55, 0, paint); // капот
	put(box(L - 3.4, 0.2, 2.64), -1.7, 2.0, 0, M.yellow);
	put(box(2.0, 1.2, 2.66), -5.6, 2.9, 0, M.metalDark); // жалюзи холодильника
	put(box(0.6, 0.6, 0.6), -3.5, 4.0, 0, M.metalDark); // выхлоп
	put(box(3.2, 3.0, 3.0, 1.5), 5.4, 2.9, 0, paint); // кабина
	put(box(3.24, 0.9, 3.04), 5.4, 3.55, 0, M.glass);
	put(box(3.4, 0.2, 3.2), 5.4, 4.5, 0, M.metalDark);
	put(cyl(0.2, 0.3, 10).rotateZ(Math.PI / 2), 7.1, 4.1, 0, M.white); // прожектор
	for (const ex of [-1, 1]) for (const bz of [-0.9, 0.9]) put(cyl(0.22, 0.4, 10).rotateZ(Math.PI / 2), ex * (L / 2 + 0.2), 1.2, bz, M.metalDark); // буфера
	collide(x, z, L + 0.4, 3.0, ry);
}

/** Паровоз-памятник на постаменте посреди площади (нос — к +X). */
function steamMonument(batch, M, collide, x, z) {
	const put = (g, px, y, pz, mat) => batch.add(place(g, x + px, y, z + pz), mat);
	put(box(10, 0.7, 3.6, 2), 0, 0.35, 0, M.concrete); // постамент
	put(box(10.4, 0.12, 4.0, 2), 0, 0.76, 0, M.concreteDark);
	for (const dz of [-0.76, 0.76]) put(box(9, 0.12, 0.08), 0, 0.88, dz, M.rail);
	for (const dz of [-1.0, 1.0]) {
		for (const dx of [-2.6, -1.0, 0.6]) put(cyl(0.8, 0.16, 16).rotateX(Math.PI / 2), dx, 1.74, dz, M.red); // ведущие колёса
		put(cyl(0.42, 0.14).rotateX(Math.PI / 2), 2.6, 1.36, dz, M.red); // бегунок
		put(box(3.6, 0.12, 0.08), -1.0, 1.55, dz * 1.1, M.metalDark); // дышло
	}
	put(box(8.6, 0.5, 2.4), 0.3, 2.1, 0, M.tankBlack); // рама
	put(cyl(1.0, 5.6, 18).rotateZ(Math.PI / 2), 1.4, 3.35, 0, M.tankBlack); // котёл
	put(cyl(1.06, 0.9, 18).rotateZ(Math.PI / 2), 4.0, 3.35, 0, M.tankBlack); // дымовая коробка
	put(cyl(0.3, 1.1), 3.7, 4.85, 0, M.tankBlack); // труба
	put(cyl(0.5, 0.6), 1.0, 4.55, 0, M.tankBlack); // сухопарник
	put(box(2.4, 2.5, 2.9, 1.5), -2.4, 3.5, 0, M.tankBlack); // будка
	put(box(2.44, 0.6, 2.94), -2.4, 3.95, 0, M.glass);
	put(box(2.7, 0.15, 3.2), -2.4, 4.8, 0, M.metalDark);
	put(box(0.4, 0.5, 2.6), 4.5, 2.2, 0, M.red); // буферный брус
	put(box(0.5, 0.9, 0.5), 3.4, 2.55, 0, M.red); // фонарь
	collide(x, z, 10.6, 4.2);
	// низкая оградка из цепей на столбиках
	for (let i = 0; i < 14; i++) {
		const t = i / 13, px = -6.5 + 13 * t;
		put(box(0.12, 0.6, 0.12), px, 0.3, -3.0, M.metalDark);
		put(box(0.12, 0.6, 0.12), px, 0.3, 3.0, M.metalDark);
	}
	for (const dz of [-3.0, 3.0]) put(box(13, 0.03, 0.03), 0, 0.5, dz, M.metalDark);
}

// ---------- Вокзал (можно зайти) ----------

/** Сейф (лицо — +Z своих осей). */
const safe = (b, name, x, z, rot, loot, h = 1.1) => b.container(name, x, z, rot, [
	[0.7, h, 0.6, 0, h / 2, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, h * 0.64, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, h * 0.64, 0.31, b.IM.black],
], [0.7, 0.6], loot, h);
/** Стол дежурного с телефоном. */
const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.3, 0.75, 0.7, 0, 0.375, 0, b.IM.furniture], [0.4, 0.3, 0.3, 0.3, 0.9, 0, b.IM.black], [0.25, 0.08, 0.2, -0.35, 0.79, 0.1, b.IM.white],
], [1.3, 0.7], loot, 0.95);
/** Шкаф с дверцами. */
const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);
/** Металлический шкафчик (раздевалка депо). */
const locker = (b, name, x, z, rot, loot, w = 0.85) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);

/**
 * Вокзал 28×11 м из кирпича, с часами на фронтоне: вход с площади (юг) — две двери, на перрон (север) — две двери
 * и дверь милиции. В середине зал ожидания (кресла, киоск, камера хранения), слева кассы (стол кассира, сейф),
 * справа буфет (прилавок, холодильник) и за перегородкой комната транспортной милиции (оружейный шкаф, сейф, стол).
 */
function buildStation(ctx, { cx, cz }) {
	const W = 28, D = 11, H = 4.6;
	const b = new Building(ctx, { name: 'Station', cx, cz, ry: 0, W, D, H, top: H + 1.2 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	const t = 0.3, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [-2.4, 2.4], w: 1.6, lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [-2.4, 2.4, 10.5], w: 1.6, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.whitewash, side: -1 });
	// перегородки: кассы слева, буфет и милиция справа (между ними — глухая стенка)
	b.wall('z', -6, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [3.2] });
	b.wall('z', 6, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [-2.6, 3.2] });
	b.wall('x', 0.8, 6, hx - t / 2, { mat: IM.whitewash, t: 0.15 });
	const sill = M.brick;
	for (const x of [-11.5, -8.5, 8.5, 11.5]) { b.window('front', x, { y: 2.0, t, sill }); b.window('back', x, { y: 2.0, t, sill }); }
	for (const x of [-5, 5]) { b.window('front', x, { y: 2.6, t, sill }); b.window('back', x, { y: 2.6, t, sill }); }
	for (const z of [-2.5, 2.5]) { b.window('left', z, { y: 2.0, t, sill }); b.window('right', z, { y: 2.0, t, sill }); }
	// плоская крыша с парапетом, фронтон с часами над входом, вытяжки
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.4);
	b.top_(place(box(7, 1.6, 0.4, 1.5), 0, H + 0.9, -hz - 0.05), M.brick);
	b.top_(place(cyl(0.55, 0.06, 20).rotateX(Math.PI / 2), 0, H + 0.9, -hz - 0.3), IM.white);
	b.top_(place(box(0.06, 0.4, 0.02).translate(0, 0.17, 0), 0, H + 0.9, -hz - 0.34), IM.black);
	b.top_(place(box(0.3, 0.05, 0.02).translate(0.13, 0, 0), 0, H + 0.9, -hz - 0.34), IM.black);
	b.vent(-9, 2.5, H + 0.3, M.silver);
	b.vent(10, -2.5, H + 0.3, M.silver, { h: 0.5, r: 0.12 });
	// козырьки на столбах с обеих сторон, крыльцо с площади, распахнутые двери
	b.canopy('front', 0, { w: 7.4, d: 2.0, y: 3.3, mat: M.roofTar, posts: M.concrete, t });
	b.canopy('back', 0, { w: 7.4, d: 1.6, y: 3.3, mat: M.roofTar, t });
	b.lower(place(box(8.6, 0.18, 1.6, 1), 0, 0.09, -hz - 0.95), M.concrete);
	b.lower(place(box(9.2, 0.09, 0.9, 1), 0, 0.045, -hz - 2.1), M.concrete);
	for (const s of [-1, 1]) { b.wallBox('front', s * 3.7, 0.8, 0.02, 2.05, 0.05, M.woodGrey, { t }); b.wallBox('back', s * 3.7, 0.8, 0.02, 2.05, 0.05, M.woodGrey, { t }); }
	// вывески: «ВОКЗАЛ» с площади, имя станции — с перрона
	b.top_(b.onWall(new THREE.PlaneGeometry(5, 0.9).translate(0, H - 0.55, 0.03), 'front', 0, t), T.signMaterial('ВОКЗАЛ', { bg: '#1d3f7a', fg: '#f0f0e8', w: 512, h: 92 }));
	b.top_(b.onWall(new THREE.PlaneGeometry(6, 0.8).translate(0, H - 0.55, 0.03), 'back', 0, t), T.signMaterial('УЗЛОВАЯ', { bg: '#1d3f7a', fg: '#f0f0e8', w: 512, h: 72 }));
	// зал ожидания: сдвоенный ряд кресел спинками друг к другу, киоск у входа, камера хранения у выхода на перрон
	b.furniture(0, 0, 0, [
		[4.4, 0.08, 0.5, 0, 0.45, -0.3, IM.furnitureLight], [4.4, 0.08, 0.5, 0, 0.45, 0.3, IM.furnitureLight], [4.4, 0.55, 0.1, 0, 0.75, 0, IM.furnitureLight],
		...[-1.9, -0.6, 0.6, 1.9].map((x) => [0.06, 0.45, 1.1, x, 0.22, 0, IM.metal]),
	], { solid: [4.4, 1.1] });
	b.container('Киоск', -4.4, -4.85, 0, [
		[1.7, 1.9, 0.9, 0, 0.95, 0, IM.furnitureLight], [1.5, 0.5, 0.05, 0, 1.3, 0.46, IM.glass], [1.5, 0.3, 0.2, 0, 1.0, 0.4, IM.paper],
	], [1.7, 0.9], { zhivchik: 0.4, ammo919: [3, 6, 0.3], spore: 0.1 }, 1.9);
	b.container('Камера хранения', 4.3, 4.85, Math.PI, [
		[2.0, 1.9, 0.6, 0, 0.95, 0, IM.locker], ...[-0.5, 0, 0.5].map((x) => [0.02, 1.8, 0.02, x, 0.95, 0.31, IM.black]), [2.0, 0.02, 0.02, 0, 0.95, 0.31, IM.black],
	], [2.0, 0.6], { ammo919: [5, 10, 0.5], ammo12: [4, 8, 0.3], zhivchik: 0.3, spore: 0.2, glock17: 0.06 }, 1.9);
	b.furniture(-5.6, -1.5, 0, [[0.5, 1.05, 3.6, 0, 0.525, 0, IM.furniture], [0.6, 0.05, 3.7, 0, 1.07, 0, IM.furnitureLight]], { solid: [0.5, 3.6] }); // стойка касс со стороны зала
	// кассы
	desk(b, 'Стол кассира', -7.4, -1.5, -Math.PI / 2, { ammo919: [4, 8, 0.5], zhivchik: 0.3, spore: [1, 2, 0.25] });
	chair(b, -8.3, -1.5, Math.PI / 2);
	safe(b, 'Сейф кассы', -13.4, -4.6, Math.PI / 2, { spore: [2, 5, 0.6], ammo919: [8, 16, 0.6], ammo50: [3, 6, 0.2] });
	b.furniture(-13.4, 2.6, Math.PI / 2, [[1.0, 1.9, 0.5, 0, 0.95, 0, IM.furniture]], { solid: [1.0, 0.5] });
	// буфет: прилавок с витриной и кассой, холодильник, два столика
	b.container('Прилавок буфета', 10, -0.7, Math.PI, [
		[4.0, 1.0, 0.7, 0, 0.5, 0, IM.furniture], [4.1, 0.05, 0.8, 0, 1.02, 0, IM.furnitureLight], [1.6, 0.3, 0.5, -0.6, 1.2, 0, IM.glass], [0.4, 0.25, 0.3, 1.4, 1.17, 0, IM.black],
	], [4.0, 0.7], { zhivchik: [1, 2, 0.6], ammo12: [2, 5, 0.25], ammo919: [3, 6, 0.3] }, 1.3);
	b.container('Холодильник', 13.4, -4.6, -Math.PI / 2, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], [0.62, 0.6], { zhivchik: [1, 2, 0.7] }, 1.5);
	table(b, 8.2, -4.0, 0, { w: 0.9, d: 0.7 });
	chair(b, 8.2, -3.3, Math.PI);
	table(b, 11.6, -4.0, 0, { w: 0.9, d: 0.7 });
	chair(b, 11.6, -4.7, 0);
	// комната транспортной милиции: оружейный шкаф, сейф, стол дежурного, шкаф, топчан
	b.container('Оружейный шкаф', 13.4, 1.6, -Math.PI / 2, [
		[1.0, 1.8, 0.45, 0, 0.9, 0, IM.metal], [0.02, 1.7, 0.02, 0, 0.9, 0.23, IM.black], [0.05, 0.05, 0.04, 0.1, 1.0, 0.24, IM.black],
	], [1.0, 0.45], { glock17: 0.35, aks: 0.12, ammo919: [10, 20, 0.8], ammo545: [10, 20, 0.4] }, 1.8);
	safe(b, 'Сейф дежурного', 13.4, 3.4, -Math.PI / 2, { ammo919: [8, 16, 0.7], grenade: 0.08, spore: [1, 3, 0.4] });
	desk(b, 'Стол дежурного', 8.6, 1.5, 0, { ammo919: [4, 8, 0.5], zhivchik: 0.3 });
	chair(b, 8.6, 2.4, 0);
	cabinet(b, 'Шкаф', 7.0, 4.85, Math.PI, 1.0, 1.9, 0.5, { ammo919: [3, 6, 0.4], zhivchik: 0.2 });
	b.furniture(12.4, 4.85, Math.PI, [[1.9, 0.35, 0.8, 0, 0.35, 0, IM.furniture], [1.8, 0.1, 0.75, 0, 0.56, 0, IM.blanketArmy]], { solid: [1.9, 0.8] });
	return b.finish();
}

// ---------- Локомотивное депо (можно зайти) ----------

/**
 * Депо 16×28 м из кирпича с двускатной крышей и световым фонарём: ворота под тепловоз с востока (по ним в цех
 * заходит подъездной путь), дверь с юга. Внутри — путь на смотровой канаве с тепловозом, кран-балка, верстаки,
 * стеллаж, шкафчики слесарей, бочки. Оси здания: своя X — вдоль мировой Z, своя Z — вдоль мировой X.
 */
function buildDepot(ctx, { cx, cz, loco }) {
	const W = 16, D = 28, H = 7.2, rise = 2.2;
	const b = new Building(ctx, { name: 'Depot', cx, cz, ry: -Math.PI / 2, W, D, H, top: H + rise + 0.3 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	const t = 0.3, hx = W / 2, hz = D / 2, G = 2.4; // полуширина ворот
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	// передняя стена (восток) — две части по сторонам ворот и перемычка над ними (ворота выше обычной двери)
	b.wall('x', -hz, -hx - t / 2, -G, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('x', -hz, G, hx + t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.top_(place(box(2 * G, H - 5.4, t, 1.5), 0, (5.4 + H) / 2, -hz), M.brick);
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, doors: [-8], lining: IM.factoryWall, side: -1 });
	const sill = M.brick;
	for (const z of [-10.5, -4.5, 1.5, 7.5]) b.window('right', z, { y: 4.6, t, sill });
	for (const z of [-10, -5, 0, 5, 10]) b.window('left', z, { y: 4.6, t, sill });
	for (const x of [-4, 4]) b.window('back', x, { y: 4.6, t, sill });
	// створки ворот распахнуты к стене, дверь сбоку открыта, козырёк и вывеска над воротами
	for (const s of [-1, 1]) b.wallBox('front', s * (G + 1.3), 2.4, 0.02, 5.2, 0.08, M.metalRust, { t });
	b.wallBox('right', -8 + 1.2, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.canopy('front', 0, { w: 6.2, d: 1.5, y: 5.6, mat: M.metalRust, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(7, 0.8).translate(0, 6.4, 0.03), 'front', 0, t), T.signMaterial('ЛОКОМОТИВНОЕ ДЕПО', { bg: '#2a2c26', fg: '#e8dcae', w: 640, h: 72 }));
	// двускатная крыша: конёк вдоль своей Z, фронтоны из кирпича, световой фонарь на коньке
	const half = hx + 0.35, len = Math.hypot(half, rise) + 0.05, a = Math.atan2(rise, half);
	for (const s of [-1, 1]) b.top_(place(box(len, 0.1, D + 0.6, 2), -s * half / 2, H + rise / 2 + 0.05, 0, 0, 0, s * a), M.roofMetal);
	for (const s of [-1, 1]) {
		const z = s * (hz + t / 2 + 0.01);
		const p = [-hx - t / 2, H, z, hx + t / 2, H, z, 0, H + rise, z];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s > 0 ? [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]] : [p[0], p[1], p[2], p[6], p[7], p[8], p[3], p[4], p[5]]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(s > 0 ? [0, 0, W / 1.5, 0, W / 3, rise / 1.5] : [0, 0, W / 3, rise / 1.5, W / 1.5, 0]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.brick);
	}
	b.top_(place(box(0.3, 0.12, D + 0.7), 0, H + rise + 0.05, 0), M.metalRust);
	b.top_(place(box(3.0, 0.7, D - 8, 2), 0, H + rise + 0.3, 0), M.glass);
	// путь на смотровой канаве: рельсы, шпалы, тёмная канава между ними
	for (const dx of [-0.76, 0.76]) b.lower(place(box(0.08, 0.14, D - 0.5), dx, 0.1, 0), M.rail, { cast: false });
	for (let z = -hz + 0.6; z < hz - 0.4; z += 0.7) b.lower(place(box(2.4, 0.08, 0.22), 0, 0.04, z), M.sleeper, { cast: false });
	b.lower(place(planeXZ(1.3, 10), 0, 0.035, 2), IM.black, { cast: false });
	// кран-балка под крышей: рельсы вдоль цеха, мост с тележкой
	for (const s of [-1, 1]) b.top_(place(box(0.25, 0.25, D - 0.8), s * (hx - 0.6), H - 1.0, 0), M.metalDark);
	b.top_(place(box(W - 1.0, 0.5, 0.5), 0, H - 0.75, -5), M.yellow);
	b.top_(place(box(0.6, 0.5, 0.6), 2, H - 1.25, -5), M.metalDark);
	// верстаки у северной стены, инструментальный ящик у южной, стеллаж и шкафчики у задней
	const bench_ = (x, z, rot, loot) => b.container('Верстак', x, z, rot, [
		[2.0, 0.85, 0.8, 0, 0.42, 0, IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, IM.machine], [0.3, 0.2, 0.2, -0.6, 1.0, -0.1, IM.black],
	], [2.0, 0.8], loot, 1.0);
	bench_(-hx + 0.5, -9, Math.PI / 2, { ammo762: [5, 10, 0.4], fireaxe: 0.06, ammo919: [4, 8, 0.3] });
	bench_(-hx + 0.5, 9.5, Math.PI / 2, { ammo545: [6, 12, 0.4], grenade: 0.04, zhivchik: 0.2 });
	b.container('Инструментальный ящик', hx - 0.4, -11, -Math.PI / 2, [[1.2, 1.1, 0.6, 0, 0.55, 0, IM.machine], [1.1, 0.02, 0.02, 0, 0.8, 0.31, IM.black]], [1.2, 0.6], { ammo545: [6, 12, 0.35], spore: 0.2, ammo762: [5, 10, 0.3] }, 1.1);
	b.container('Стеллаж', 4.5, hz - 0.6, Math.PI, [
		...[-1.9, 1.9].flatMap((dx) => [-0.4, 0.4].map((dz) => [0.08, 2.6, 0.08, dx, 1.3, dz, IM.rack])),
		...[0.15, 1.0, 1.85, 2.55].map((y) => [3.9, 0.05, 0.9, 0, y, 0, IM.rack]),
		[0.9, 0.6, 0.7, -1.2, 0.48, 0, IM.crate], [0.8, 0.5, 0.7, 0.6, 0.43, 0.05, IM.crateGreen], [1.0, 0.65, 0.7, -0.4, 1.35, 0, IM.machine], [0.9, 0.6, 0.7, 1.3, 1.33, 0, IM.crate],
	], [4.0, 1.0], { ammo762: [10, 20, 0.45], ammo76254: [5, 10, 0.25], zhivchik: 0.15, grenade: 0.05 }, 2.6);
	locker(b, 'Шкафчик', -4.6, hz - 0.45, Math.PI, { ammo919: [4, 8, 0.4], zhivchik: 0.25 });
	locker(b, 'Шкафчик', -3.7, hz - 0.45, Math.PI, { ammo545: [5, 12, 0.3], spore: 0.15 });
	b.furniture(-6.6, hz - 0.5, Math.PI, [[1.8, 0.45, 0.4, 0, 0.22, 0, IM.furnitureLight]], { solid: [1.8, 0.4] }); // скамья раздевалки
	b.furniture(hx - 0.25, -2, -Math.PI / 2, [[0.9, 1.6, 0.06, 0, 1.4, 0, IM.redBoard], [0.3, 0.4, 0.3, 0, 0.2, 0.1, IM.redBoard]], { solid: [0.9, 0.3] }); // пожарный щит
	b.furniture(hx - 0.9, 5, 0, [[1.4, 1.0, 0.8, 0, 0.5, 0, IM.machine], [0.5, 0.5, 0.5, 0.3, 1.2, 0, IM.metal], [0.6, 0.6, 0.7, -0.4, 1.3, 0, IM.black]], { solid: [1.4, 0.8] }); // компрессор
	// тепловоз в цехе (мировые координаты)
	if (loco) diesel(b.ctx.batch, M, b.ctx.collide, loco[0], loco[1], 0, M.green);
	return b.finish();
}

export default {
	id: 'vokzal',
	seed: 4422,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		M.shopSign = T.signMaterial('МАГАЗИН «ПУТЕЕЦ»', { bg: '#e6e4d8', fg: '#1d4f9c' });
		M.guardSign = T.signMaterial('ПЕРЕЕЗД', { bg: '#2a2c26', fg: '#e8dcae' });
		const mark = markingMaterial();
		// линии путей (z) и границы
		const T1 = -1.5, T2 = -6.5, T3 = -14, T4 = -19, T5 = -27, BX = -20; // BX — пешеходный мост

		// ---------- Покрытия: междупутье, платформы, площадь, дороги, дворы ----------
		ground(150, 31, 0, -13, M.dirt, 6, 0.011); // междупутье — щебень с грязью
		ground(50, 3.8, -8, 2.2, M.concrete, 4, 0.02); // платформа у вокзала (x −33…17)
		ground(60, 3.6, -8, -10.3, M.concrete, 4, 0.02); // островная платформа (x −38…22)
		ground(50, 23, 0, 27.5, M.asphalt, 5, 0.013); // привокзальная площадь (z 16…39)
		ground(34, 2.4, 0, 16.9, M.concrete, 3, 0.016); // тротуар у вокзала
		ground(26, 11.4, -27, 10.3, M.asphalt, 5, 0.0125); // проезды по сторонам вокзала
		ground(26, 11.4, 27, 10.3, M.asphalt, 5, 0.0125);
		ground(6, 30, 0, 52, M.asphalt, 5, 0.014); // на юг, к Дачам
		ground(28, 0.15, 0, 53, mark, 6, 0.026, Math.PI / 2);
		ground(26, 6, 38, 20, M.asphalt, 5, 0.014); // на восток, к переезду
		ground(6, 90, 48, -22, M.asphalt, 5, 0.014); // через переезд на север, к Химмашу
		ground(6, 20, 48, -11, M.asphalt, 5, 0.19); // настил переезда поверх путей (рельсы торчат)
		ground(36, 0.15, 48, -44, mark, 6, 0.026, Math.PI / 2);
		ground(36, 4.4, 27, -22.8, M.concrete, 4, 0.02); // грузовая рампа
		ground(18, 14, -19, -27, M.dirt, 5, 0.015); // двор перед депо
		ground(40, 16, 27, -42, M.dirt, 5, 0.0135); // грузовой двор за пакгаузами
		ground(24, 10, -40, -41, M.dirt, 5, 0.0135); // двор у дома локомотивных бригад
		ground(10, 28, -14, -48, M.dirt, 4, 0.0132); // дорожка от депо к водокачке и дальше
		const roads = [
			[-25, 25, 16, 39], [-3, 3, 39, 70], [25, 51, 17, 23], [45, 51, -70, 23], [-33, 17, 0.3, 4.1], [-38, 22, -12.1, -8.5],
			[-70, 70, -21, 0.3], [-29, 36, -29, -21], [9, 45, -25, -20.5], [-28, -10, -34, -20], [-40, -14, 4.6, 16], [14, 40, 4.6, 16],
			[7, 47, -50, -34], [-52, -28, -46, -36], [-19, -9, -62, -34],
		];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);
		// края платформ и жёлтые линии безопасности
		const edge = (x0, x1, z, side) => {
			batch.add(place(box(x1 - x0, 0.12, 0.3, 2), (x0 + x1) / 2, 0.06, z), M.concreteDark, { cast: false });
			batch.add(place(box(x1 - x0, 0.02, 0.12), (x0 + x1) / 2, 0.03, z + side * 0.55), M.yellow, { cast: false });
		};
		edge(-33, 17, 0.45, 1);
		edge(-38, 22, -8.65, -1);
		edge(-38, 22, -11.95, 1);

		// ---------- Пути: четыре сквозных, подъездной в депо, стрелочные съезды ----------
		for (const z of [T1, T2, T3, T4]) railTrack(batch, M, z === T4 ? -23 : -75, 75, z);
		railTrack(batch, M, -27.8, 24, T5);
		batch.add(place(box(0.6, 1.2, 3.0), -23.6, 0.6, T4), M.red); // упор в конце 4-го пути
		collide(-23.6, T4, 0.6, 3.0);
		/** Косой съезд между путями: щебень, шпалы, рельсы от (x0,z0) к (x1,z1). */
		const link = (x0, z0, x1, z1) => {
			const len = Math.hypot(x1 - x0, z1 - z0), ang = -Math.atan2(z1 - z0, x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
			batch.add(place(box(len, 0.1, 3.0, 2), cx, 0.05, cz, ang), M.ballast, { cast: false });
			for (let d = 0.35; d < len; d += 0.7) {
				const tt = d / len;
				batch.add(place(box(0.22, 0.1, 2.5), x0 + (x1 - x0) * tt, 0.12, z0 + (z1 - z0) * tt, ang), M.sleeper, { cast: false });
			}
			for (const dz of [-0.76, 0.76]) batch.add(place(box(len, 0.14, 0.08).translate(0, 0, dz), cx, 0.24, cz, ang), M.rail, { cast: false });
		};
		link(24, T5, 34, T4);
		link(-50, T2, -40, T1);
		// светофоры у горловин, прожекторные мачты
		const signal = (x, z, ry) => {
			batch.add(place(cyl(0.08, 3.4, 7), x, 1.7, z), M.metalDark);
			batch.add(place(box(0.42, 1.0, 0.26), x, 3.4, z, ry), M.metalDark);
			batch.add(place(box(0.2, 0.2, 0.06).translate(0, 0.28, 0.15), x, 3.4, z, ry), M.red);
			batch.add(place(box(0.5, 0.06, 0.3).translate(0, 0.5, 0.1), x, 3.4, z, ry), M.metalDark);
			collide(x, z, 0.3, 0.3);
		};
		signal(-56, -4, Math.PI / 2); signal(-56, -16.5, Math.PI / 2); signal(56, -4, -Math.PI / 2); signal(56, -16.5, -Math.PI / 2); signal(-30, -4, -Math.PI / 2);
		const mast = (x, z) => {
			batch.add(place(new THREE.CylinderGeometry(0.16, 0.32, 20, 8), x, 10, z), M.metalRust);
			batch.add(place(box(3.0, 0.25, 0.25), x, 19.6, z), M.metalDark);
			for (const dx of [-1.1, 0, 1.1]) batch.add(place(box(0.5, 0.35, 0.3), x + dx, 19.3, z), M.white);
			collide(x, z, 0.7, 0.7);
		};
		mast(-9, -23); mast(56, -24);

		// ---------- Составы ----------
		// 1-й путь: пригородный поезд у платформы (между вагонами — проходы)
		for (const x of [-27, -8.6, 9.8]) coach(batch, M, collide, x, T1, 0, M.green);
		// 2-й путь: маневровый тепловоз
		diesel(batch, M, collide, 36, T2, 0, M.khaki);
		// 3-й путь: грузовой состав — цистерны, крытые вагоны, платформа с контейнером
		tankWagon(batch, M, collide, -50, T3, 0, M.tankBlack);
		tankWagon(batch, M, collide, -38.6, T3, 0, M.tankBlack);
		boxcar(batch, M, collide, -24, T3, 0, M.metalRust);
		flatWagon(batch, M, collide, -9.6, T3, 0, M.roofGreen);
		tankWagon(batch, M, collide, 4, T3, 0, M.tankWhite);
		tankWagon(batch, M, collide, 15.4, T3, 0, M.tankBlack);
		boxcar(batch, M, collide, 30, T3, 0, M.roofMetal);
		// 4-й путь: платформы с контейнерами у рампы, цистерна
		flatWagon(batch, M, collide, -13, T4, 0, M.metalOlive);
		flatWagon(batch, M, collide, 3, T4, 0, M.roofMetal);
		tankWagon(batch, M, collide, 20, T4, 0, M.tankWhite);
		// подъездной путь: крытый вагон у депо
		boxcar(batch, M, collide, -10, T5, 0, M.metalRust);

		// ---------- Навесы платформ (полупрозрачные, когда загораживают героя) ----------
		const canopy = (name, x0, x1, z, posts) => {
			occluder(name, (kb) => {
				for (const x of posts) kb.add(place(box(0.28, 3.5, 0.28), x, 1.75, z), M.metalDark);
				kb.add(place(box(x1 - x0, 0.12, 3.6, 2), (x0 + x1) / 2, 3.55, z, 0, -0.03), M.roofMetal);
				kb.add(place(box(x1 - x0, 0.3, 0.06), (x0 + x1) / 2, 3.42, z - 1.8), M.metalDark);
				kb.add(place(box(x1 - x0, 0.3, 0.06), (x0 + x1) / 2, 3.42, z + 1.8), M.metalDark);
			}, { cx: (x0 + x1) / 2, cz: z, ry: 0, hx: (x1 - x0) / 2, hz: 1.9, top: 3.8 }, 0.15);
			for (const x of posts) collide(x, z, 0.35, 0.35);
		};
		canopy('Canopy1', -33, 17, 2.2, [-31, -25, -13, -7, 7, 13]);
		canopy('Canopy2W', -38, -24, -10.3, [-36, -30, -26]);
		canopy('Canopy2E', -14, 22, -10.3, [-12, -6, 0, 6, 12, 18]);
		billboard(batch, M, root, collide, -2, -10.3, 0, 'УЗЛОВАЯ', { w: 3.2, h: 0.7, y: 2.4, bg: '#1d3f7a', fg: '#f0f0e8' });

		// ---------- Пешеходный мост над путями: настил на опорах, лестницы с обоих концов ----------
		occluder('FootBridge', (kb) => {
			kb.add(place(box(2.6, 0.22, 27.5, 2), BX, 5.0, -9.25), M.concrete);
			for (const s of [-1, 1]) {
				kb.add(place(box(0.3, 0.6, 27.5), BX + s * 1.1, 4.6, -9.25), M.metalRust);
				kb.add(place(box(0.05, 1.0, 27.5), BX + s * 1.25, 5.6, -9.25), M.metalDark);
				kb.add(place(box(0.08, 0.08, 27.5), BX + s * 1.25, 6.12, -9.25), M.metalDark);
				for (let z = -22.5; z <= 4; z += 3) kb.add(place(box(0.07, 1.0, 0.07), BX + s * 1.25, 5.6, z), M.metalDark);
			}
		}, { cx: BX, cz: -9.25, ry: 0, hx: 1.5, hz: 13.9, top: 6.3 }, 0.15);
		for (const z of [-4, -10.3, -16.5]) {
			for (const s of [-1, 1]) { batch.add(place(box(0.45, 4.6, 0.45), BX + s * 0.9, 2.3, z), M.concrete); collide(BX + s * 0.9, z, 0.5, 0.5); }
			batch.add(place(box(2.6, 0.4, 0.5), BX, 4.7, z), M.concrete);
		}
		/** Лестница из ступеней от верха (x,z) вниз по направлению (dx,dz); с перилами. */
		const stairs = (x, z, dx, dz) => {
			const n = 14, rise = 5.0 / n, run = 0.5;
			// каждая ступень — сплошной блок от земли до своей высоты (сбоку — лестница на косоуре)
			for (let i = 0; i < n; i++) {
				const top = 5.0 - rise * i, px = x + dx * run * (i + 0.5), pz = z + dz * run * (i + 0.5);
				batch.add(place(box(dx ? run : 2.4, top, dz ? run : 2.4, 2), px, top / 2, pz), M.concrete);
			}
			const len = n * run, cx = x + dx * len / 2, cz = z + dz * len / 2, ang = Math.atan2(5.0, len);
			for (const s of [-1, 1]) {
				const ox = dz ? s * 1.15 : 0, oz = dx ? s * 1.15 : 0;
				batch.add(place(box(dx ? Math.hypot(len, 5) : 0.06, 0.06, dz ? Math.hypot(len, 5) : 0.06), cx + ox, 3.5, cz + oz, 0, dz ? -dz * ang : 0, dx ? dx * ang : 0), M.metalDark);
			}
			collide(cx, cz, dx ? len : 2.4, dz ? len : 2.4);
		};
		stairs(BX, 4.5, 0, 1); // с южного конца — вниз на площадку у вокзала
		stairs(BX - 1.3, -23, 1, 0); // с северного конца — вниз вдоль путей, к депо

		// ---------- Вокзал, ограда перрона, площадь ----------
		buildings.push(buildStation(bctx, { cx: 0, cz: 10 }));
		const railing = (x0, x1, z) => {
			const len = x1 - x0, n = Math.max(1, Math.round(len / 2.5));
			for (let i = 0; i <= n; i++) batch.add(place(box(0.08, 1.5, 0.08), x0 + i * len / n, 0.75, z), M.metalDark);
			for (const y of [0.45, 1.4]) batch.add(place(box(len, 0.05, 0.05), (x0 + x1) / 2, y, z), M.metalDark);
			for (let x = x0 + 0.4; x < x1; x += 0.4) batch.add(place(box(0.025, 1.0, 0.025), x, 0.92, z), M.metalDark);
			collide((x0 + x1) / 2, z, len, 0.2);
		};
		railing(-40, BX - 4, 4.6); railing(BX + 4, -14.6, 4.6); railing(14.6, 30, 4.6); railing(34, 40, 4.6);
		steamMonument(batch, M, collide, 0, 28);
		for (const [x, z] of [[-20, 19.5], [20, 19.5], [-20, 37], [20, 37], [-36, 12], [36, 12]]) streetLamp(batch, M, collide, x, z);
		for (const [x, z, ry] of [[-8, 33.5, Math.PI], [8, 33.5, Math.PI], [-8, 22.5, 0], [8, 22.5, 0], [-30, 9, 0], [30, 9, 0], [-16, 9, 0], [16, 9, 0]]) bench(batch, M, x, z, ry);
		// клумбы по сторонам памятника
		for (const x of [-12, 12]) {
			batch.add(place(cyl(2.0, 0.35, 18), x, 0.175, 28), M.concrete);
			batch.add(place(new THREE.CircleGeometry(1.8, 18).rotateX(-Math.PI / 2), x, 0.36, 28), M.dirt, { cast: false });
			for (let i = 0; i < 6; i++) batch.add(place(new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.7, 1), x + Math.cos(i * 1.05) * 1.1, 0.5, 28 + Math.sin(i * 1.05) * 1.1, i), M.leaves);
			collide(x, 28, 3.6, 3.6);
		}
		// остановка автобуса на южном краю площади, автобус у неё
		{
			const x = 14, z = 40.2;
			batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z + 0.9), M.concrete);
			batch.add(place(box(5.4, 0.15, 2.2, 1), x, 2.45, z), M.metalRust);
			for (const dx of [-2.4, 2.4]) batch.add(place(box(0.12, 2.4, 0.12), x + dx, 1.2, z - 0.9), M.metalDark);
			collide(x, z + 0.9, 5, 0.4);
			bench(batch, M, x, z + 0.3, 0);
		}
		bus(batch, M, root, 8, 36.5, Math.PI / 2 + 0.04);
		collide(8, 36.5, 2.6, 7.8, Math.PI / 2 + 0.04);
		// стоянка такси слева, брошенные машины, ларьки у западного края площади
		const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
		car(-19, 34, Math.PI / 2, 0xc8b84a);
		car(-19, 29, Math.PI / 2 + 0.06, 0xc8b84a);
		car(-19, 24, Math.PI / 2 - 0.04, 0x8a8a7a);
		car(-30, 30, 0.3, 0x5a5a3a, { burned: true });
		car(22, 25, -Math.PI / 2 + 0.2, 0x3a5a6a, { crashed: true });
		car(-32, 12, 0.05, 0x7a2a22);
		car(40, 12, Math.PI + 0.1, 0x2a3a5a);
		const kiosk = (x, z, ry, mat) => {
			batch.add(place(box(2.6, 2.5, 2.2, 1.2), x, 1.25, z, ry), mat);
			batch.add(place(box(2.9, 0.1, 2.5, 2), x, 2.55, z, ry), M.metalRust);
			batch.add(place(box(1.6, 0.8, 0.06).translate(0, 0, 1.12), x, 1.55, z, ry), M.glass);
			batch.add(place(box(2.0, 0.3, 0.1).translate(0, 0, 1.12), x, 1.05, z, ry), M.woodGrey);
			collide(x, z, 2.7, 2.3, ry);
		};
		kiosk(-23.5, 20, Math.PI / 2, M.metalOlive);
		kiosk(-23.5, 23.2, Math.PI / 2, M.woodBlue);
		kiosk(23.5, 36, -Math.PI / 2, M.metalOlive);
		buildings.push(buildShop(bctx, { cx: 33, cz: 30 }));
		for (let i = 0; i < 3; i++) batch.add(place(box(1.2, 0.15, 0.8), 40, 0.08 + i * 0.16, 36, R(-0.2, 0.2)), M.wood); // поддоны у чёрного хода
		collide(40, 36, 1.3, 1);
		// аллея вдоль дороги на юг: бордюры
		for (const s of [-1, 1]) batch.add(place(box(0.24, 0.14, 26, 2), s * 3.1, 0.07, 52), M.concrete, { cast: false });

		// ---------- Переезд: настил, шлагбаумы, кресты, будка дежурного ----------
		barrier(batch, M, collide, 44.6, 2.2, 0, 5, true);
		barrier(batch, M, collide, 51.4, -23.2, Math.PI, 5, true);
		const crossbuck = (x, z) => {
			batch.add(place(box(0.1, 3.0, 0.1), x, 1.5, z), M.metalDark);
			for (const a of [0.6, -0.6]) batch.add(place(box(1.1, 0.16, 0.04), x, 2.75, z, 0, 0, a), M.white);
			collide(x, z, 0.3, 0.3);
		};
		crossbuck(51.6, 2.2); crossbuck(44.4, -23.2);
		buildings.push(buildGuardhouse(bctx, { name: 'Booth', cx: 54.5, cz: 8, ry: Math.PI / 2 }));

		// ---------- Грузовой двор: рампа, пакгаузы, ящики, контейнеры, техника ----------
		buildings.push(
			buildWarehouse(bctx, { name: 'Pakgauz1', cx: 18, cz: -30, ry: Math.PI }),
			buildWarehouse(bctx, { name: 'Pakgauz2', cx: 35, cz: -30, ry: Math.PI }),
		);
		for (const [x, z, r] of [[12.5, -23.2, 0.1], [14, -23.5, 0.5], [29, -23, 0], [38.5, -23.3, 0.2], [40, -23.7, 0.9]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood);
			endProp();
			collide(x, z, 1.2, 0.9, r);
		}
		for (const [x, z, h, r, mat] of [[16, -42, 0, 0, M.metalOlive], [16, -42, 2.6, 0.04, M.roofMetal], [24, -43, 0, 0.1, M.roofGreen]]) {
			batch.add(place(box(6, 2.6, 2.4, 1.5), x, h + 1.3, z, r), mat);
			if (!h) collide(x, z, 6, 2.4, r);
		}
		armyTruck(batch, M, root, collide, 56, -32, Math.PI / 2 + 0.1);
		transformer(batch, root, M, collide, 40, -44);
		hazardBarrels(batch, M, collide, 44, -38, rnd, 4);
		for (const [x, z, r] of [[8, -38, 0.1], [10, -38.4, 0]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }

		// ---------- Депо, штабели шпал и рельсов, водокачка, дом локомотивных бригад ----------
		buildings.push(buildDepot(bctx, { cx: -42, cz: T5, loco: [-44, T5] }));
		hazardBarrels(batch, M, collide, -24, -32, rnd, 5);
		const sleeperPile = (x, z, ry) => {
			for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++) batch.add(place(box(2.5, 0.16, 0.24).translate(0, 0, -0.56 + i * 0.28), x, 0.08 + k * 0.17, z, ry), M.sleeper);
			collide(x, z, 2.6, 1.5, ry);
		};
		sleeperPile(4, -23, 0); sleeperPile(-8, -31.5, 0.1); sleeperPile(-4.5, -31.8, -0.05);
		for (let i = 0; i < 6; i++) batch.add(place(box(10, 0.14, 0.08), -18, 0.07 + Math.floor(i / 3) * 0.15, -31 + (i % 3) * 0.3 - 0.3), M.rail); // штабель рельсов
		collide(-18, -31, 10.2, 1.0);
		occluder('WaterTower', (kb) => waterTower(kb, M, collide, -18, -46), { cx: -18, cz: -46, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);
		buildings.push(buildArmyBarracks(bctx, { name: 'Dorm', cx: -40, cz: -50, ry: Math.PI }));
		bench(batch, M, -34, -44, 0);
		bench(batch, M, -46, -44, 0);
		car(-30, -40, 0.2, 0x5a6a4a, { model: 'e_niva' });
		// будка стрелочника у западной горловины
		batch.add(place(box(2.4, 2.4, 2.4, 1.2), -44, 1.2, -10.3), M.whiteBrick);
		batch.add(place(box(2.8, 0.1, 2.8, 2), -44, 2.45, -10.3, 0, 0.1), M.roofTar);
		batch.add(place(box(0.8, 1.9, 0.06), -43.4, 0.95, -9.08), M.metalOlive);
		collide(-44, -10.3, 2.5, 2.5);

		const exits = [
			{ to: 'lesopilka', x0: -66, x1: -61.2, z0: -16, z1: -4, spawn: [-59, -10, Math.PI / 2], sign: [-60, 1.4, '← Лесопилка'] },
			{ to: 'podstanciya', x0: 61.2, x1: 66, z0: -21, z1: -4, spawn: [59, -10, -Math.PI / 2], sign: [60, 1.4, 'Подстанция →'] },
			{ to: 'himmash', x0: 45, x1: 51, z0: -66, z1: -61.2, spawn: [48, -59, 0], sign: [52.2, -60.2, '↑ Химмаш'] },
			{ to: 'dachi', x0: -3, x1: 3, z0: 61.2, z1: 66, spawn: [0, 59, Math.PI], sign: [4.2, 60.2, '↓ Дачи'] },
		];
		return {
			start: [0, 59, Math.PI],
			exits,
			// бегуны на платформах, путях и площади; топтуны водят стаи в депо, у пакгаузов и на грузовом дворе; рубер в депо
			groups: [
				{ at: [-10, 2.3], r: 5, runners: 3 },
				{ at: [10, 2.3], r: 5, runners: 2 },
				{ at: [-33, -10.3], r: 5, runners: 2, stompers: 1 },
				{ at: [-3, -10.3], r: 5, runners: 2 },
				{ at: [15, -10.3], r: 5, runners: 2 },
				{ at: [-50, -4], r: 5, runners: 2 },
				{ at: [40, -16.5], r: 5, runners: 2, stompers: 1 },
				{ at: [-42, -22], r: 5, rubers: 1, runners: 1 },
				{ at: [-20, -29], r: 5, stompers: 1, runners: 1 },
				{ at: [20, -22.8], r: 5, stompers: 1, runners: 1 },
				{ at: [34, -22.8], r: 5, runners: 2, stompers: 1 },
				{ at: [0, 33.5], r: 8, runners: 3 },
				{ at: [-12, 23], r: 6, runners: 2 },
				{ at: [22, 32], r: 5, runners: 2, stompers: 1 },
				{ at: [-3.5, 8], r: 4, runners: 2 },
				{ at: [-40, -42], r: 5, runners: 2, stompers: 1 },
				{ at: [-13, -52], r: 6, runners: 2 },
				{ at: [48, -45], r: 6, runners: 2 },
				{ at: [0, 50], r: 6, runners: 2 },
				{ at: [-46, 28], r: 6, runners: 2 },
			],
			onRoad,
			// горят такси у стоянки, бочка у рампы, костёр на путях у западной горловины
			fires: [[-30, 30, 'car'], [32, -24.5], [-48, -10.5, 'ground']],
			barrels: 6,
			trees(tryTree) {
				// тополя и берёзы вдоль дороги на юг и по краю площади, рощи по сторонам, лес по углам
				for (let z = 42; z < 60; z += 4) for (const s of [-1, 1]) tryTree(s * 6 + R(-0.6, 0.6), z + R(-1, 1), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 10; i++) tryTree(R(-25, -8) * (rnd() < 0.5 ? 1 : -1), R(41, 46), 'birch');
				for (let i = 0; i < 20; i++) tryTree(R(-46, -27), R(10, 46), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(40, 60), R(25, 46), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 14; i++) tryTree(R(-30, 4), R(-60, -38), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 10; i++) tryTree(R(52, 60), R(-60, -26), 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(-60, -48), R(-60, -40), 'pine');
				for (let i = 0; i < 6; i++) tryTree(R(-58, -42), R(16, 40), 'apple');
			},
			clutter: 18,
			blood: 18,
			puddles: 14,
			puddle: () => [R(-46, 46), rnd() < 0.5 ? R(17, 38) : R(-24, -2)],
			grass: 0.6,
			hint: (b) => ({
				Station: 'Вокзал — касса с сейфом, буфет, камера хранения; у транспортной милиции оружейный шкаф с пистолетами',
				Depot: 'Локомотивное депо — верстаки, инструментальный ящик, шкафчики слесарей, стеллаж',
				Pakgauz1: 'Пакгауз №1 — стеллажи с ящиками, бывают гранаты',
				Pakgauz2: 'Пакгауз №2 — стеллажи с ящиками, бывают гранаты',
				Shop: 'Магазин у вокзала — живчики на витрине, в сейфе патроны',
				Booth: 'Будка дежурного по переезду — оружейный шкаф и сейф',
				Dorm: 'Дом отдыха локомотивных бригад — тумбочки у коек, шкафы в каптёрке',
			}[b.name] ?? 'Обыщи шкафы и ящики'),
		};
	},
};
