// Кластер «Химмаш»: кусок заводской промзоны, который Улей перенёс вместе с цехами и складами (180×180 м).
// Север — территория завода за бетонным забором: цех №3 (раздевалка, конторка мастера с сейфом), склад №2
// со стеллажами, котельная с трубой, водонапорная башня, ж/д тупик с цистернами, ёмкости аммиака и кислоты,
// эстакада труб. Через центр — дорога: на запад к Дачам, на восток к военной части; на юг — к Заречному,
// мимо заводоуправления и стоянки. Кластер глубже в Улье: много топтунов и руберы.
// Ближняя окраина: склад у ж/д ветки на севере, нефтебаза на востоке, автобаза со сторожкой и складом, щит у дороги.
// Дальние районы (кольцо до мути): на западе за забором с проходной (турникеты, будка вахтёра) — площадка №2
// с цехом №4 (кран-балка, станки, пресс, кладовая); у проходной — стоянка с машинами, за ней административный корпус
// (бухгалтерия, кабинеты директора и главного инженера, отдел кадров, архив) и заводская столовая. На севере —
// ж/д сортировка: три пути с вагонами, цистернами и полувагонами, горочный пост. На северо-востоке — градирня
// с насосной, на востоке — центральная заводская лаборатория (вытяжной шкаф, реактивы, сейф с ядами) и грузовая
// стоянка у автобазы; на юго-востоке — склад ГСМ: бочки на стеллажах, горизонтальные ёмкости, колонка, бензовоз.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair, buildWorkshop, buildWarehouse, buildGuardhouse } from '../buildings.js';
import { addCar, bus, streetLamp, powerLine, markingMaterial } from '../props.js';
import {
	concreteFence, railTrack, tankWagon, flatWagon, waterTower, chimney, pipeRack, storageTank, pipePile, hazardBarrels, armyTruck, billboard,
} from '../props-industrial.js';

const Z = Math.PI / 2;
const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);
/** Цилиндр вдоль оси X (бочка на боку, ёмкость, цистерна). */
const cylX = (r, len, seg = 16) => cyl(r, r, len, seg).rotateZ(Z);
/** Развёртка в метрах у тела вращения: текстура повторяется каждые su×sv м (иначе одна плитка на всю градирню). */
const meters = (g, su, sv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };

// ---------- Тайники (лицо мебели — в +Z её осей) ----------

/** Металлический шкафчик раздевалки. */
const locker = (b, name, x, z, rot, loot, w = 0.85) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);
/** Шкаф с дверцами. */
const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);
/** Сейф. */
const safe = (b, name, x, z, rot, loot, h = 1.1) => b.container(name, x, z, rot, [
	[0.7, h, 0.6, 0, h / 2, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, h * 0.64, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, h * 0.64, 0.31, b.IM.black],
], [0.7, 0.6], loot, h);
/** Письменный стол с телефоном и бумагами. */
const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.3, 0.75, 0.7, 0, 0.375, 0, b.IM.furniture], [0.3, 0.12, 0.22, 0.38, 0.81, -0.1, b.IM.black], [0.4, 0.01, 0.3, -0.25, 0.755, 0, b.IM.paper],
], [1.3, 0.7], loot, 0.95);
/** Стеллаж 4×1 м с ящиками (или с канистрами — goods). */
const rack = (b, name, x, z, rot, loot, goods = [b.IM.crate, b.IM.crateGreen]) => b.container(name, x, z, rot, [
	...[-1.9, 1.9].flatMap((dx) => [-0.4, 0.4].map((dz) => [0.08, 2.6, 0.08, dx, 1.3, dz, b.IM.rack])),
	...[0.15, 1.0, 1.85, 2.55].map((y) => [3.9, 0.05, 0.9, 0, y, 0, b.IM.rack]),
	[0.9, 0.6, 0.7, -1.2, 0.48, 0, goods[0]], [0.8, 0.5, 0.7, 0.6, 0.43, 0.05, goods[1]],
	[1.0, 0.65, 0.7, -0.4, 1.35, 0, goods[1]], [0.9, 0.6, 0.7, 1.3, 1.33, 0, goods[0]], [0.8, 0.5, 0.7, -1.3, 2.13, 0, goods[0]],
], [4.0, 1.0], loot, 2.6);
/** Верстак с тисками. */
const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal],
	[0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine], [0.3, 0.2, 0.2, -0.6, 1.0, -0.1, b.IM.black],
], [2.0, 0.8], loot, 1.0);

/** Станок: станина, шпиндельная бабка, патрон (декор с коллайдером; в игре — модель токарного станка). */
function lathe(b, x, z, rot) {
	const { machine, metal, black } = b.IM;
	b.furniture(x, z, rot, [
		[1.9, 0.8, 0.7, 0, 0.4, 0, machine], [0.5, 0.5, 0.6, -0.65, 1.05, 0, machine], [1.3, 0.12, 0.2, 0.25, 0.92, 0.12, metal],
		[0.3, 0.22, 0.3, 0.55, 0.95, 0, black], [0.12, 0.12, 0.25, -0.35, 1.05, 0, metal],
	], { solid: [1.9, 0.75], prop: 'lathe' });
}

/** Бочка стоя (в игре — модель бочки). */
function barrelUp(b, x, z, mat) {
	b.furniture(x, z, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, mat, { geo: place(cyl(0.3, 0.3, 0.9, 12), 0, 0.45, 0) }]], { solid: [0.6, 0.6], prop: 'barrel' });
}

// ---------- Цех №4 (можно зайти) ----------

/**
 * Цех №4 30×16 м: высокие кирпичные стены, ворота под машину в передней стене (−Z локально), дверь сбоку и в торце.
 * Под крышей — кран-балка на подкрановых путях: мост, тележка, на тросах — пакет двутавров. Станки рядом, пресс,
 * листы стали на поддонах, верстаки; в правом заднем углу — кладовая-раздевалка (шкафчики, стеллаж).
 */
function buildShop4(ctx, { cx, cz, ry }) {
	const W = 30, D = 16, H = 6.5, hx = W / 2, hz = D / 2, t = 0.3, GX = -4, G = 2.5; // ворота: место и полуширина
	const b = new Building(ctx, { name: 'Shop4', cx, cz, ry, W, D, H, top: H + 1.0 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	// передняя стена — по сторонам ворот, над воротами перемычка (ворота выше обычной двери)
	b.wall('x', -hz, -hx - t / 2, GX - G, { ...wo, side: 1 });
	b.wall('x', -hz, GX + G, hx + t / 2, { ...wo, side: 1, doors: [11] });
	b.top_(place(box(2 * G, H - 4.6, t, 1.5), GX, (4.6 + H) / 2, -hz), M.brick);
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1, doors: [3.5] });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	// кладовая-раздевалка в правом заднем углу
	b.wall('z', 9, 0.5, hz - t / 2, { mat: IM.factoryWall, t: 0.15, doors: [3] });
	b.wall('x', 0.5, 9, hx - t / 2, { mat: IM.factoryWall, t: 0.15 });
	// высокие окна, створки ворот распахнуты к стене, козырёк, вывеска
	const sill = M.brick;
	for (const x of [-13, 6, 13.5]) b.window('front', x, { y: 4.4, t, sill });
	for (const x of [-12, -6, 0, 6, 12]) b.window('back', x, { y: 4.4, t, sill });
	for (const z of [-4, 0]) b.window('left', z, { y: 4.4, t, sill });
	for (const z of [-4, 4]) b.window('right', z, { y: 4.4, t, sill });
	for (const s of [-1, 1]) b.wallBox('front', GX + s * (G + 1.25), 2.4, 0.02, 4.4, 0.08, M.metalRust, { t });
	b.canopy('front', GX, { w: 5.8, d: 1.6, y: 4.75, mat: M.metalRust, t });
	b.wallBox('front', 12.2, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t }); // боковая дверь открыта
	b.wallBox('left', 4.7, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(4.2, 0.8).translate(0, H - 0.75, 0.03), 'front', GX, t), T.signMaterial('ЦЕХ № 4', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 72 }));
	// плоская кровля со световым фонарём, парапет, дефлекторы
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.35);
	b.top_(place(box(W - 8, 0.55, 2.2, 2), 0, H + 0.58, 0), M.glass);
	for (const [x, z] of [[-12, -5], [-6, 5], [6, -5], [12, 5]]) b.vent(x, z, H + 0.3, M.silver);
	// кран-балка: подкрановые пути вдоль длинных стен, мост поперёк цеха, тележка, тросы и пакет двутавров на крюке
	for (const s of [-1, 1]) b.top_(place(box(W - 0.8, 0.32, 0.32), 0, H - 1.0, s * (hz - 0.55)), M.metalDark);
	const KX = 1.5;
	b.top_(place(box(0.9, 0.7, D - 1.0), KX, H - 0.75, 0), M.yellow);
	for (const s of [-1, 1]) b.top_(place(box(1.8, 0.5, 0.7), KX, H - 0.8, s * (hz - 0.85)), M.yellow);
	b.top_(place(box(1.3, 0.7, 1.3), KX, H - 1.45, 1.0), M.metalDark);
	for (const dx of [-0.25, 0.25]) b.top_(place(box(0.04, 1.9, 0.04), KX + dx, 3.85, 1.0), M.metalDark);
	b.top_(place(box(0.5, 0.4, 0.3), KX, 2.95, 1.0), M.yellow); // крюковая обойма
	b.top_(place(box(0.12, 0.12, 2.6), KX, 2.7, 1.0), M.metalDark); // траверса
	for (const dz of [-0.2, 0.2]) b.top_(place(box(4.6, 0.3, 0.16), KX, 2.45, 1.0 + dz), M.metalRust);
	// станки в ряд, пресс, листы стали на поддонах
	for (const x of [-11.5, -7.5, -3.5]) lathe(b, x, 2.4, Math.PI);
	b.furniture(4.8, 5.4, 0, [
		[2.2, 2.4, 1.5, 0, 1.2, 0, IM.machine], [1.7, 0.7, 1.2, 0, 2.75, 0, IM.machine], [0.9, 0.5, 0.9, 0, 0.95, 0.75, IM.black], [0.3, 1.2, 0.3, 1.1, 0.6, 0.85, M.yellow],
	], { solid: [2.2, 1.6] }); // пресс
	b.furniture(-10.5, -4.6, 0.1, [[2.4, 0.15, 1.2, 0, 0.075, 0, IM.crate], [2.2, 0.35, 1.1, 0, 0.32, 0, M.metalDark], [2.1, 0.12, 1.05, 0.05, 0.55, 0, M.metalRust]], { solid: [2.4, 1.2] });
	b.furniture(6.5, -5.2, -0.15, [[2.4, 0.15, 1.2, 0, 0.075, 0, IM.crate], [2.3, 0.5, 1.1, 0, 0.4, 0, M.metalRust]], { solid: [2.4, 1.2] });
	// второй ряд — фрезерные станки (выше токарных), погрузчик у ворот, ящики на поддонах
	for (const x of [-11.5, -7.5]) b.furniture(x, -1.6, 0, [[1.4, 0.9, 1.0, 0, 0.45, 0, IM.machine], [0.7, 1.1, 0.7, -0.2, 1.45, -0.1, IM.machine], [0.9, 0.12, 0.5, 0.1, 1.0, 0.25, IM.metal], [0.12, 0.4, 0.12, -0.2, 1.0, 0.2, IM.black]], { solid: [1.4, 1.0] });
	b.furniture(1.2, -5.4, 0.4, [
		[1.1, 0.9, 1.7, 0, 0.75, 0, M.yellow], [0.9, 1.0, 0.05, 0, 1.7, -0.3, IM.black],
		[0.08, 1.9, 0.08, -0.4, 1.15, 0.9, IM.black], [0.08, 1.9, 0.08, 0.4, 1.15, 0.9, IM.black],
		[0.1, 0.05, 1.0, -0.3, 0.15, 1.4, IM.metal], [0.1, 0.05, 1.0, 0.3, 0.15, 1.4, IM.metal],
	], { solid: [1.2, 2.4] }); // погрузчик
	for (const [x, z, r] of [[-13.6, 1.2, 0.1], [-13.5, -0.1, -0.2]]) b.furniture(x, z, r, [[1.0, 0.7, 0.8, 0, 0.35, 0, IM.crateGreen], [0.9, 0.5, 0.7, 0.05, 0.95, 0, IM.crate]], { solid: [1.0, 0.8], prop: 'crate' });
	// верстаки у торца и у задней стены
	workbench(b, 'Верстак', -hx + 0.5, -4.5, Z, { ammo12: [3, 6, 0.4], ammo762: [5, 10, 0.3], fireaxe: 0.05 });
	workbench(b, 'Верстак', -4, hz - 0.5, Math.PI, { ammo545: [5, 10, 0.35], zhivchik: 0.2, spore: [1, 2, 0.25] });
	b.furniture(hx - 0.25, -3, -Z, [[0.9, 1.6, 0.06, 0, 1.4, 0, IM.redBoard], [0.3, 0.4, 0.3, 0, 0.2, 0.1, IM.redBoard]], { solid: [0.9, 0.3] }); // пожарный щит
	// кладовая-раздевалка: шкафчик, стеллаж с инструментом, скамья
	locker(b, 'Шкафчик', hx - 0.45, 4.6, -Z, { ammo919: [4, 8, 0.4], zhivchik: 0.25, spore: 0.15 });
	rack(b, 'Инструментальная кладовая', 12, hz - 0.65, Math.PI, { ammo545: [8, 16, 0.4], ammo12: [4, 8, 0.35], grenade: 0.06, fireaxe: 0.05 });
	b.furniture(11.5, 1.2, 0, [[2.0, 0.45, 0.4, 0, 0.22, 0, IM.furnitureLight]], { solid: [2.0, 0.4] });
	return b.finish();
}

// ---------- Проходная (можно зайти) ----------

/**
 * Проходная 10×6 м на линии заводского забора: двери в обеих длинных стенах (с улицы и на завод), посередине — ряд
 * турникетов, слева за стенкой — будка вахтёра (стол с журналом, шкаф). Передняя стена (−Z) — к заводу.
 */
function buildGatehouse(ctx, { cx, cz }) {
	const W = 10, D = 6, H = 3.2, hx = W / 2, hz = D / 2, t = 0.25, DX = 2.4;
	const b = new Building(ctx, { name: 'Gatehouse', cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [DX], w: 1.6 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1, doors: [DX], w: 1.6 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', -0.6, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.12, doors: [1.6] }); // будка вахтёра
	const sill = M.whiteBrick;
	b.window('front', -2.6, { t, sill }); b.window('back', -2.6, { t, sill }); b.window('left', 0, { t, sill });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.canopy('front', DX, { w: 2.4, d: 1.0, y: 2.5, mat: M.roofTar, t });
	b.canopy('back', DX, { w: 2.4, d: 1.0, y: 2.5, mat: M.roofTar, t });
	b.vent(-3.2, 1.2, H + 0.25, M.silver, { h: 0.5, r: 0.12 });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.0, 0.55).translate(0, H - 0.45, 0.03), 'back', -2.4, t), T.signMaterial('ПРОХОДНАЯ', { bg: '#2a2c26', fg: '#e8dcae', w: 448, h: 82 }));
	// окошко вахтёра в стенке будки и полка под ним
	b.top_(place(box(0.02, 0.8, 1.2), -0.52, 1.6, -1.2), b.IM.glass);
	b.furniture(-0.35, -1.2, 0, [[0.35, 0.05, 1.2, 0, 1.05, 0, IM.furnitureLight]], { solid: [0, 0] });
	// турникеты: тумбы с тремя планками, между ними — проходы
	for (const x of [0.6, 2.2, 3.8]) {
		b.furniture(x, 0, 0, [
			[0.3, 0.95, 0.5, 0, 0.475, 0, IM.metal], [0.32, 0.06, 0.52, 0, 0.98, 0, IM.black],
			[0.55, 0.04, 0.04, 0.42, 0.9, 0, IM.metal], [0.04, 0.04, 0.5, 0.15, 0.7, 0.25, IM.metal],
		], { solid: [0.3, 0.5] });
	}
	// будка вахтёра: стол с журналом, шкаф, стул
	desk(b, 'Стол вахтёра', -2.6, -2.4, 0, { ammo919: [4, 8, 0.5], zhivchik: 0.3, ammo12: [2, 5, 0.25] });
	chair(b, -1.5, -1.9, -2.2);
	cabinet(b, 'Шкаф', -4.5, 1.5, Z, 0.9, 1.9, 0.5, { ammo545: [5, 10, 0.4], dbarrel: 0.04, spore: 0.2 });
	return b.finish();
}

// ---------- Административный корпус (можно зайти) ----------

/**
 * Административный корпус 22×12 м в два этажа (внутри — первый): вход посередине фасада (−Z), за ним вестибюль
 * и коридор. Спереди — бухгалтерия (сейф) и кабинет директора (стол), сзади — отдел кадров (шкаф с документами),
 * архив со стеллажами, техотдел с кульманом и кабинет главного инженера (сейф).
 */
function buildOffice(ctx, { cx, cz, ry }) {
	const W = 22, D = 12, H = 3.4, hx = W / 2, hz = D / 2, t = 0.3, F2 = 3.2;
	const b = new Building(ctx, { name: 'Office', cx, cz, ry, W, D, H, top: H + F2 + 0.8 });
	b.messKind = 'home';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.plaster, t, lining: IM.wallpaper[1] };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [0], w: 1.6 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	const pw = { mat: IM.whitewash, t: 0.12 };
	b.wall('x', -1.2, -hx + t / 2, -1.5, { ...pw, doors: [-6.5] });
	b.wall('x', -1.2, 1.5, hx - t / 2, { ...pw, doors: [6.5] });
	b.wall('z', -1.5, -hz + t / 2, -1.2, pw);
	b.wall('z', 1.5, -hz + t / 2, -1.2, pw);
	b.wall('x', 1.2, -hx + t / 2, hx - t / 2, { ...pw, doors: [-8.1, -2.5, 3, 8.2] });
	for (const x of [-5.2, 0.3, 5.5]) b.wall('z', x, 1.2, hz - t / 2, pw);
	const sill = M.concrete;
	for (const x of [-9, -3.5, 3.5, 9]) b.window('front', x, { t, sill });
	for (const x of [-8.1, -2.5, 3, 8.2]) b.window('back', x, { t, sill });
	for (const z of [-3.5, 3.5]) { b.window('left', z, { t, sill }); b.window('right', z, { t, sill }); }
	// второй этаж (глухой объём с окнами), кровля, парапет
	const Y2 = H + 0.3;
	b.top_(place(box(W + 0.2, 0.3, D + 0.2, 2), 0, H + 0.15, 0), M.concrete);
	b.top_(place(box(W, F2, D, 2, 1.6), 0, Y2 + F2 / 2, 0), M.plaster);
	for (const side of ['front', 'back']) for (const x of [-9, -6, -3, 0, 3, 6, 9]) {
		b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.1, 1.4), [0, 1, 0, 3, 0, 2, 0][(x + 9 + side.length) % 7]).translate(0, Y2 + 1.6, -0.138), side, x, t), M.window);
	}
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, Y2 + F2 + 0.15, 0), M.roofTar);
	b.parapet(Y2 + F2 + 0.3, M.plaster, 0.3);
	b.vent(-6, 2, Y2 + F2 + 0.3, M.silver);
	b.vent(7, -2, Y2 + F2 + 0.3, M.silver, { h: 0.5, r: 0.12 });
	// вход: козырёк на столбах, крыльцо, вывеска
	b.canopy('front', 0, { w: 3.4, d: 1.8, y: 2.9, mat: M.concrete, posts: M.concrete, t, thick: 0.15 });
	b.lower(place(box(3.6, 0.15, 1.3), 0, 0.075, -hz - 0.8), M.concrete);
	for (const s of [-1, 1]) b.wallBox('front', s * 1.25, 0.8, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(7, 0.7).translate(0, Y2 + F2 - 0.45, -0.13), 'front', 0, t), T.signMaterial('АДМИНИСТРАТИВНЫЙ КОРПУС', { bg: '#e6e2d4', fg: '#7a1c14', w: 640, h: 64 }));
	// бухгалтерия: сейф, два стола
	safe(b, 'Сейф бухгалтерии', -hx + 0.5, -3.6, Z, { spore: [2, 5, 0.6], ammo919: [6, 12, 0.5], ammo50: [3, 6, 0.15] }, 1.2);
	for (const x of [-7.6, -4.2]) { table(b, x, -4.5, 0, { w: 1.2, d: 0.7 }); chair(b, x, -3.75, Math.PI); }
	// кабинет директора: стол, стол для совещаний, книжный шкаф
	desk(b, 'Стол директора', 7.6, -4.85, 0, { ammo919: [4, 8, 0.5], deagle: 0.04, zhivchik: 0.3, spore: [1, 3, 0.35] });
	chair(b, 7.6, -5.45, 0);
	table(b, 4.3, -3.1, Z, { w: 2.0, d: 0.9 });
	b.furniture(hx - 0.35, -3.4, -Z, [[1.6, 2.0, 0.4, 0, 1.0, 0, IM.furniture], [1.5, 0.3, 0.3, 0, 1.3, 0.02, IM.books[0]], [1.5, 0.3, 0.3, 0, 0.8, 0.02, IM.books[1]]], { solid: [1.6, 0.4] });
	// отдел кадров: шкаф с личными делами, стол
	cabinet(b, 'Шкаф с документами', -9.6, hz - 0.42, Math.PI, 1.2, 2.0, 0.5, { ammo919: [3, 6, 0.35], zhivchik: 0.25, spore: 0.2 });
	table(b, -7.2, 4.4, 0, { w: 1.1, d: 0.7 });
	chair(b, -7.2, 3.7, Math.PI);
	// архив: стеллажи с папками
	b.furniture(-2.5, hz - 0.5, Math.PI, [
		...[-1.9, 1.9].map((dx) => [0.06, 2.2, 0.6, dx, 1.1, 0, IM.metal]),
		...[0.1, 0.8, 1.5, 2.15].map((y) => [3.9, 0.04, 0.6, 0, y, 0, IM.metal]),
		[3.6, 0.45, 0.4, 0, 0.36, 0, IM.paper], [3.4, 0.45, 0.4, 0.1, 1.06, 0, IM.books[2]], [3.6, 0.4, 0.4, 0, 1.75, 0, IM.paper],
	], { solid: [4.0, 0.6] });
	// техотдел: кульман и стол
	b.furniture(2.9, 4.4, 0.25, [[1.4, 0.05, 1.0, 0, 1.05, 0, IM.white, { geo: place(box(1.4, 0.05, 1.0).rotateX(-0.6), 0, 1.15, 0) }], [0.1, 1.0, 0.1, 0, 0.5, 0, IM.metal], [0.8, 0.05, 0.6, 0, 0.03, 0, IM.metal]], { solid: [1.4, 0.9] });
	// кабинет главного инженера: сейф и стол
	safe(b, 'Сейф главного инженера', hx - 0.5, 4.2, -Z, { ammo545: [10, 20, 0.5], grenade: 0.08, spore: [2, 4, 0.45], glock17: 0.05 }, 1.2);
	table(b, 8, 4.8, 0, { w: 1.2, d: 0.7 });
	chair(b, 8, 4.1, Math.PI);
	// коридор: доска почёта
	b.furniture(-3.5, 1.08, Math.PI, [[2.2, 1.1, 0.04, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0] });
	return b.finish();
}

// ---------- Заводская столовая (можно зайти) ----------

/**
 * Столовая 18×12 м: обеденный зал со столами и раздачей, за стенкой — кухня (плиты, котёл, холодильник, служебный
 * выход) и кладовая со стеллажом. Вход — в передней стене (−Z).
 */
function buildCanteen(ctx, { cx, cz, ry }) {
	const W = 18, D = 12, H = 3.6, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name: 'Canteen', cx, cz, ry, W, D, H, top: H + 0.8 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.shopWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [-5], w: 1.6 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1, doors: [-3] });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('x', 1.5, -hx + t / 2, hx - t / 2, { mat: IM.whitewash, t: 0.15, doors: [-6, 4] });
	b.wall('z', 2, 1.5, hz - t / 2, { mat: IM.whitewash, t: 0.15 });
	const sill = M.brick;
	for (const x of [-1, 2.5, 6]) b.window('front', x, { t, sill });
	for (const x of [-7, 5.5]) b.window('back', x, { t, sill });
	for (const z of [-3.5, -0.5]) { b.window('left', z, { t, sill }); b.window('right', z, { t, sill }); }
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.3);
	b.chimney(-5, 4.6, H + 0.2, H + 1.6, 0.5); // вытяжка кухни
	b.vent(4, -2, H + 0.3, M.silver);
	b.canopy('front', -5, { w: 2.4, d: 1.2, y: 2.6, mat: M.metalRust, t });
	b.wallBox('front', -5 + 1.15, 0.8, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(4, 0.7).translate(0, H - 0.5, 0.03), 'front', 2.5, t), T.signMaterial('СТОЛОВАЯ', { bg: '#e6e2d4', fg: '#1d4f9c', w: 448, h: 80 }));
	// обеденный зал: раздача вдоль стенки кухни, столы в два ряда
	b.furniture(-1, 0.9, 0, [[4.0, 0.9, 0.6, 0, 0.45, 0, IM.metal], [4.1, 0.04, 0.35, 0, 0.98, -0.45, IM.metal], [1.2, 0.35, 0.5, 1.2, 1.1, 0, IM.glass]], { solid: [4.0, 0.9] });
	for (const x of [-7, -2.5, 1.5, 5.5]) for (const z of [-3.6, -1.4]) table(b, x, z, 0, { w: 1.3, d: 0.8 });
	chair(b, -7, -2.75, Math.PI); chair(b, 1.5, -4.45, 0); chair(b, 5.5, -2.55, Math.PI * 0.9); chair(b, -2.5, -0.55, Math.PI);
	// кухня: холодильник, плиты, котёл, разделочный стол
	b.container('Холодильник', -hx + 0.45, 3.0, Z, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], [0.62, 0.6], { zhivchik: [1, 2, 0.6], ammo919: [2, 5, 0.2] }, 1.5);
	b.furniture(-5.2, hz - 0.6, Math.PI, [[2.4, 0.9, 0.9, 0, 0.45, 0, IM.metal], [2.4, 0.04, 0.9, 0, 0.92, 0, IM.black], [0.5, 0.25, 0.5, -0.6, 1.05, 0, IM.metal]], { solid: [2.4, 0.9], prop: 'stove' });
	b.furniture(-0.4, 4.6, 0, [[1.0, 1.0, 1.0, 0, 0.5, 0, IM.metal, { geo: place(cyl(0.5, 0.45, 1.0, 14), 0, 0.5, 0) }]], { solid: [1.0, 1.0] });
	b.furniture(-3.0, 2.6, 0, [[2.0, 0.85, 0.8, 0, 0.42, 0, IM.metal], [2.0, 0.05, 0.8, 0, 0.88, 0, IM.furnitureLight]], { solid: [2.0, 0.8] });
	// кладовая: стеллаж с банками и мешками
	rack(b, 'Кладовая', 5.5, hz - 0.65, Math.PI, { zhivchik: [1, 2, 0.45], ammo12: [2, 6, 0.3], spore: [1, 2, 0.25] }, [IM.rag, IM.cans]);
	b.furniture(8.2, 2.4, 0.2, [[1.0, 0.5, 0.7, 0, 0.25, 0, IM.rag], [0.9, 0.45, 0.65, 0.05, 0.72, 0, IM.rag]], { solid: [1.0, 0.7] });
	return b.finish();
}

// ---------- Склад ГСМ (можно зайти) ----------

/**
 * Склад ГСМ 16×10 м: кирпичный, широкие двустворчатые двери (−Z) и калитка. Внутри — стеллажи с бочками на боку,
 * бочки стоя вдоль стены, стеллаж с канистрами, шкаф и стол кладовщика.
 */
function buildFuelStore(ctx, { cx, cz, ry }) {
	const W = 16, D = 10, H = 4.4, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name: 'FuelStore', cx, cz, ry, W, D, H, top: H + 0.7 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [-3, 5], w: 2.4 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [1, 7]) b.window('front', x, { y: 3.3, t, sill: M.whiteBrick });
	for (const x of [-5, 0, 5]) b.window('back', x, { y: 3.3, t, sill: M.whiteBrick });
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.whiteBrick, 0.3);
	for (const x of [-5, 4]) b.vent(x, 1.5, H + 0.3, M.silver, { h: 0.6, r: 0.16 });
	for (const s of [-1, 1]) b.wallBox('front', -3 + s * 1.85, 1.2, 0.02, 2.05, 0.06, M.metalOlive, { t, off: 0.06 });
	b.canopy('front', -3, { w: 3.4, d: 1.3, y: 2.7, mat: M.metalRust, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.4, 0.6).translate(0, H - 0.5, 0.03), 'front', -3, t), T.signMaterial('СКЛАД ГСМ', { bg: '#2a2c26', fg: '#e8dcae', w: 448, h: 80 }));
	b.top_(b.onWall(new THREE.PlaneGeometry(1.8, 0.5).translate(0, 2.6, 0.03), 'front', 3.2, t), T.signMaterial('ОГНЕОПАСНО', { bg: '#e8dcc0', fg: '#a01a10', w: 320, h: 88 }));
	// стеллажи с бочками на боку (два яруса) вдоль задней стены
	const barrelRack = (x, z) => {
		const parts = [];
		for (const dx of [-1.9, 1.9]) for (const dz of [-0.5, 0.5]) parts.push([0.08, 2.0, 0.08, dx, 1.0, dz, IM.rack]);
		for (const y of [0.25, 1.25]) for (const dz of [-0.5, 0.5]) parts.push([3.9, 0.08, 0.08, 0, y, dz, IM.rack]);
		for (const y of [0.62, 1.62]) for (const dx of [-1.2, 0, 1.2]) parts.push([0, 0, 0, 0, 0, 0, (dx + y) % 2 ? M.metalRust : M.hazard, { geo: place(cyl(0.3, 0.3, 0.9, 12).rotateX(Z), dx, y, 0) }]);
		b.furniture(x, z, Math.PI, parts, { solid: [4.0, 1.1] });
	};
	barrelRack(-5, hz - 0.75);
	barrelRack(-0.5, hz - 0.75);
	for (const z of [-3.6, -2.9, -2.2, -1.5, 0.2, 0.9]) barrelUp(b, -hx + 0.55, z, z > 0 ? M.hazard : M.metalRust);
	// стеллаж с канистрами, шкаф и стол кладовщика, ручной насос
	rack(b, 'Стеллаж с канистрами', 4.5, hz - 0.65, Math.PI, { ammo12: [4, 8, 0.4], ammo762: [6, 12, 0.35], zhivchik: 0.2, grenade: 0.05 }, [M.red, M.khaki]);
	cabinet(b, 'Шкаф кладовщика', hx - 0.4, -2.0, -Z, 1.0, 1.9, 0.5, { ammo919: [4, 8, 0.45], spore: [1, 3, 0.35], zhivchik: 0.25, dbarrel: 0.04 }, IM.locker);
	table(b, 5.6, 1.0, 0, { w: 1.2, d: 0.7 });
	chair(b, 5.6, 1.7, Math.PI);
	b.furniture(1.6, -1.0, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, M.hazard, { geo: place(cyl(0.3, 0.3, 0.9, 12), 0, 0.45, 0) }], [0.08, 0.9, 0.08, 0, 1.3, 0, IM.metal], [0.4, 0.06, 0.06, 0.18, 1.7, 0, IM.metal]], { solid: [0.6, 0.6] });
	return b.finish();
}

// ---------- Центральная заводская лаборатория (можно зайти) ----------

/**
 * Лаборатория 18×10 м: вход в передней стене (−Z). В зале — два лабораторных стола-острова с колбами и реактивами
 * (зелёное светится), вытяжной шкаф, шкаф с реактивами, мойка; за перегородкой — кабинет заведующего (сейф с ядами,
 * стол, баллоны с газом). chem — материал светящегося реактива.
 */
function buildLab(ctx, { cx, cz, ry, chem }) {
	const W = 18, D = 10, H = 3.6, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name: 'Lab', cx, cz, ry, W, D, H, top: H + 0.9 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [-5], w: 1.4 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 2, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [-3] });
	const sill = M.whiteBrick;
	for (const x of [-1.5, 5.5]) b.window('front', x, { t, sill });
	for (const x of [-6.5, -1.5, 5.5]) b.window('back', x, { t, sill });
	b.window('left', 0, { t, sill }); b.window('right', 0, { t, sill });
	for (const x of [-1.5, 5.5]) for (let k = -0.45; k <= 0.46; k += 0.18) b.top_(place(box(0.04, 1.4, 0.04), x + k, 1.65, -hz - t / 2 - 0.04), M.metalDark); // решётки
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.whiteBrick, 0.3);
	for (const [x, z] of [[-8.4, 2.8], [-8.4, 0.6]]) b.vent(x, z, H + 0.3, M.silver, { h: 1.3, r: 0.18 }); // трубы вытяжки
	b.vent(5, -2, H + 0.3, M.silver, { h: 0.5, r: 0.12 });
	b.canopy('front', -5, { w: 2.0, d: 1.1, y: 2.5, mat: M.roofTar, t });
	b.wallBox('front', -5 + 1.0, 0.7, 0.02, 2.05, 0.05, M.metalDark, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(4.6, 0.6).translate(0, H - 0.45, 0.03), 'front', 2.0, t), T.signMaterial('ЦЗЛ · ХИМЛАБОРАТОРИЯ', { bg: '#e6e2d4', fg: '#2a5a2a', w: 512, h: 68 }));
	// лабораторные столы-острова: столешница, тумбы, полка с реактивами, колбы — в них светится зелёное
	const labBench = (x, z) => {
		const parts = [[3.0, 0.85, 1.2, 0, 0.42, 0, IM.white], [3.1, 0.05, 1.3, 0, 0.87, 0, IM.black], [2.8, 0.04, 0.3, 0, 1.35, 0, IM.metal], [0.05, 0.5, 0.05, -1.35, 1.12, 0, IM.metal], [0.05, 0.5, 0.05, 1.35, 1.12, 0, IM.metal]];
		for (const [dx, dz, r, h, onShelf] of [[-1.1, 0.35, 0.07, 0.24, 0], [-0.7, -0.3, 0.05, 0.3, 0], [0.2, 0.4, 0.09, 0.2, 0], [0.9, -0.25, 0.06, 0.26, 0], [-0.9, 0, 0.04, 0.18, 1], [-0.2, 0, 0.05, 0.2, 1], [0.6, 0, 0.04, 0.18, 1], [1.2, 0, 0.05, 0.22, 1]]) {
			const y = onShelf ? 1.37 : 0.895;
			parts.push([0, 0, 0, 0, 0, 0, IM.glass, { geo: place(cyl(r * 0.45, r, h, 8), dx, y + h / 2, dz) }]);
			parts.push([0, 0, 0, 0, 0, 0, chem, { geo: place(cyl(r * 0.7, r * 0.9, h * 0.45, 8), dx, y + h * 0.23, dz) }]);
		}
		b.furniture(x, z, 0, parts, { solid: [3.0, 1.2] });
	};
	labBench(-5.5, 0.6);
	labBench(-1.5, 0.6);
	b.lower(place(planeXZ(0.9, 0.6), -3.4, 0.03, -0.9, 0.4), chem, { cast: false }); // лужа пролитого реактива
	// вытяжной шкаф: стекло спереди, внутри — колбы; шкаф с реактивами; мойка
	b.container('Вытяжной шкаф', -hx + 0.55, 2.8, Z, [
		[1.6, 0.9, 0.8, 0, 0.45, 0, IM.white], [1.6, 1.3, 0.1, 0, 1.55, -0.35, IM.white], [0.08, 1.3, 0.8, -0.76, 1.55, 0, IM.white], [0.08, 1.3, 0.8, 0.76, 1.55, 0, IM.white],
		[1.6, 0.25, 0.8, 0, 2.32, 0, IM.white], [1.5, 1.0, 0.02, 0, 1.6, 0.39, IM.glass], [0.3, 0.12, 0.3, -0.3, 0.97, 0, chem], [0.2, 0.2, 0.2, 0.35, 1.0, -0.1, IM.glass],
	], [1.6, 0.8], { grenade: 0.08, spore: [1, 3, 0.4], zhivchik: 0.25, ammo545: [4, 8, 0.25] }, 2.45);
	b.container('Шкаф с реактивами', -4, hz - 0.42, Math.PI, [
		[1.6, 2.0, 0.5, 0, 1.0, 0, IM.white], [1.5, 1.2, 0.02, 0, 1.3, 0.255, IM.glass],
		...[0.75, 1.15, 1.55].map((y, i) => [1.4, 0.18, 0.3, 0, y + 0.1, 0, IM.bottles[i % 2]]),
		[0.4, 0.15, 0.25, -0.4, 1.66, 0, chem],
	], [1.6, 0.5], { zhivchik: [1, 2, 0.5], spore: [1, 3, 0.35], grenade: 0.05 }, 2.0);
	b.furniture(0.4, hz - 0.45, Math.PI, [[1.6, 0.85, 0.6, 0, 0.42, 0, IM.white], [0.5, 0.15, 0.4, 0, 0.82, 0, IM.metal], [0.05, 0.35, 0.05, 0, 1.05, -0.2, IM.metal]], { solid: [1.6, 0.6] });
	// кабинет заведующего: сейф с ядами, стол, баллоны с газом в стойке
	safe(b, 'Сейф заведующего', hx - 0.45, 3.2, -Z, { spore: [2, 5, 0.55], grenade: 0.1, ammo919: [6, 12, 0.4], ammo556: [6, 12, 0.2] });
	table(b, 5.5, 2.6, 0, { w: 1.2, d: 0.7 });
	chair(b, 5.5, 3.3, Math.PI);
	b.furniture(hx - 0.4, -1.6, -Z, [
		...[-0.9, 0.9].map((dx) => [0.05, 1.8, 0.4, dx, 0.9, 0, IM.metal]), ...[0.4, 0.95, 1.5].map((y) => [1.85, 0.03, 0.4, 0, y, 0, IM.metal]),
		[1.6, 0.2, 0.25, 0, 0.52, 0, IM.bottles[0]], [1.4, 0.2, 0.25, 0, 1.07, 0, IM.bottles[1]], [0.5, 0.15, 0.25, -0.4, 1.6, 0, chem],
	], { solid: [1.9, 0.4] }); // стеллаж с пробами
	b.furniture(5.2, -hz + 0.45, 0, [
		[1.6, 0.08, 0.4, 0, 1.1, 0, IM.metal],
		...[-0.55, -0.18, 0.18, 0.55].map((dx, i) => [0, 0, 0, 0, 0, 0, i % 2 ? M.red : M.woodBlue, { geo: place(cyl(0.12, 0.12, 1.45, 10), dx, 0.72, 0) }]),
	], { solid: [1.6, 0.4] });
	return b.finish();
}

// ---------- Подвижной состав сортировки (в общую статику, с коллайдером) ----------

/** Тележки вагона вдоль X (две двухосные). */
function bogies(batch, M, x, z, half) {
	for (const bx of [-half + 1.4, half - 1.4]) {
		batch.add(place(box(2.2, 0.5, 2.0), x + bx, 0.55, z), M.metalDark);
		for (const wx of [-0.7, 0.7]) for (const wz of [-0.76, 0.76]) batch.add(place(cyl(0.45, 0.45, 0.14, 12).rotateX(Z), x + bx + wx, 0.45, z + wz), M.rail);
	}
}

/** Крытый вагон 12 м вдоль X: рама, кузов, крыша, сдвинутая дверь. */
function boxcar(batch, M, collide, x, z, paint) {
	const L = 12;
	bogies(batch, M, x, z, L / 2);
	batch.add(place(box(L, 0.3, 2.7), x, 1.1, z), M.metalDark);
	batch.add(place(box(L, 2.6, 2.9, 1.5), x, 2.55, z), paint);
	batch.add(place(box(L + 0.1, 0.18, 3.1), x, 3.94, z), M.metalDark);
	batch.add(place(box(2.4, 2.2, 3.0), x + 1.0, 2.4, z), M.metalDark);
	for (const ex of [-1, 1]) batch.add(place(box(0.12, 2.6, 2.96), x + ex * (L / 2 - 0.4), 2.55, z), M.metalDark);
	collide(x, z, L, 3.0);
}

/** Полувагон 12 м вдоль X: открытый кузов с ржавыми бортами, в нём — куча угля или металлолома. */
function gondola(batch, M, collide, x, z, coal) {
	const L = 12;
	bogies(batch, M, x, z, L / 2);
	batch.add(place(box(L, 0.3, 2.7), x, 1.1, z), M.metalDark);
	for (const s of [-1, 1]) batch.add(place(box(L, 1.8, 0.12, 1.5), x, 2.15, z + s * 1.4), M.metalRust);
	for (const s of [-1, 1]) batch.add(place(box(0.12, 1.8, 2.8, 1.5), x + s * (L / 2 - 0.06), 2.15, z), M.metalRust);
	for (let i = 0; i < 6; i++) batch.add(place(box(0.1, 1.8, 0.16), x - L / 2 + 1 + i * 2, 2.15, z + 1.47), M.metalDark);
	batch.add(place(box(L - 0.3, 0.2, 2.6), x, 1.35, z), M.metalDark);
	if (coal) for (const dx of [-3.5, 0, 3.5]) batch.add(place(new THREE.SphereGeometry(1.7, 10, 6).scale(1.05, 0.42, 0.75), x + dx, 2.7, z), M.tire);
	else for (const [dx, r] of [[-3.8, 0.3], [-1, -0.2], [2.4, 0.5], [4.2, 0.1]]) batch.add(place(box(2.6, 0.5, 1.6), x + dx, 2.4, z, r, 0.1, -0.12), M.metalRust);
	collide(x, z, L, 3.0);
}

// ---------- Крупные сооружения ----------

/**
 * Градирня: бетонная оболочка-гиперболоид (низ 9 м радиусом, горловина 6,4 м, высота 24 м) на наклонных стойках,
 * внизу — бассейн с водой, обвязка. Загораживает героя от камеры — полупрозрачная (occluder); снаружи — кольцо
 * коллайдеров (внутрь не зайти).
 */
function coolingTower(occluder, collide, M, cx, cz) {
	const prof = (y) => 6.4 * Math.sqrt(1 + ((y - 17) / 14.5) ** 2);
	const pts = [];
	for (let i = 0; i <= 12; i++) { const y = 2.4 + i * (24 - 2.4) / 12; pts.push(new THREE.Vector2(prof(y), y)); }
	const R0 = prof(2.4);
	occluder('CoolingTower', (kb) => {
		const circ = 2 * Math.PI * R0;
		kb.add(place(meters(new THREE.LatheGeometry(pts, 30), circ / 3, 24 / 3), cx, 0, cz), M.concrete);
		kb.add(place(meters(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x - 0.3, p.y)).reverse(), 30), circ / 3, 24 / 3), cx, 0, cz), M.concreteDark);
		const ring = (r, h) => meters(new THREE.CylinderGeometry(r, r, h, 30, 1, true), 2 * Math.PI * r / 3, 0.2);
		kb.add(place(ring(prof(24) + 0.15, 0.5), cx, 24, cz), M.concreteDark); // венец
		kb.add(place(ring(R0 + 0.05, 0.6), cx, 2.4, cz), M.concreteDark); // опорное кольцо
		for (let i = 0; i < 30; i++) { // наклонные стойки — попарно крест-накрест (наклон вдоль окружности)
			const a = (i / 30) * Math.PI * 2;
			kb.add(box(0.35, 2.9, 0.35).rotateX(i % 2 ? 0.38 : -0.38).rotateY(-a).translate(cx + Math.cos(a) * (R0 - 0.1), 1.2, cz + Math.sin(a) * (R0 - 0.1)), M.concreteDark);
		}
		kb.add(place(new THREE.CircleGeometry(R0 - 0.3, 30).rotateX(-Z), cx, 0.35, cz), M.water); // бассейн
		kb.add(place(ring(R0 + 0.8, 0.7), cx, 0.35, cz), M.concreteDark); // борт бассейна
	}, { cx, cz, ry: 0, hx: R0 + 0.8, hz: R0 + 0.8, top: 24.3 }, 0.22);
	// кольцо коллайдеров по борту бассейна
	const n = 14, rr = R0 + 0.6, seg = 2 * rr * Math.tan(Math.PI / n) + 0.4;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2;
		collide(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, seg, 1.0, -a + Z);
	}
	collide(cx, cz, R0 * 1.2, R0 * 1.2);
}

/** Горизонтальная ёмкость вдоль X на бетонных опорах (ГСМ). */
function fuelTank(batch, M, root, collide, x, z, len, r, paint, label) {
	for (const dx of [-len / 3, 0, len / 3]) batch.add(place(box(0.6, 0.9, 2 * r + 0.2), x + dx, 0.45, z), M.concrete);
	batch.add(place(cylX(r, len, 18), x, r + 0.7, z), paint);
	for (const ex of [-1, 1]) batch.add(place(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Z).scale(1, 0.25, 1).rotateZ(-ex * Z), x + ex * len / 2, r + 0.7, z), paint);
	batch.add(place(cyl(0.35, 0.35, 0.4, 10), x + len / 4, 2 * r + 0.85, z), M.metalDark); // горловина
	if (label) {
		const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), T.signMaterial(label, { bg: '#d8d0b0', fg: '#8a1a10', w: 384, h: 80 }));
		s.position.set(x, r + 0.9, z + r + 0.03);
		root.add(s);
	}
	collide(x, z, len + 0.6, 2 * r + 0.3);
}

/** Бензовоз: кабина ЗИЛа, цистерна на раме, колёса. ry — куда смотрит кабина (как у армейского грузовика). */
function tanker(batch, M, collide, x, z, ry, cab) {
	const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const put = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(m), mat);
	put(box(2.2, 0.35, 7.0), M.metalDark, 0, 0.95, 0);
	put(box(2.3, 1.3, 1.7, 1.5), cab, 0, 1.85, 2.5); // кабина
	put(box(2.1, 0.55, 0.05), M.glass, 0, 2.15, 3.36);
	put(box(2.2, 1.0, 1.0, 1.5), cab, 0, 1.4, 3.75); // капот
	put(cyl(1.05, 1.05, 4.6, 16).rotateX(Z), M.silver, 0, 2.15, -1.1); // цистерна
	put(cyl(0.3, 0.3, 0.3, 10), M.metalDark, 0, 3.3, -1.1);
	put(box(0.6, 0.5, 0.6), M.metalDark, 0.9, 1.05, 0.9); // ящик со шлангами
	for (const wz of [2.8, -1.0, -2.3]) for (const wx of [-1.1, 1.1]) put(cyl(0.52, 0.52, 0.38, 14).rotateZ(Z), M.tire, wx, 0.52, wz);
	put(new THREE.PlaneGeometry(1.2, 0.45).rotateY(Z), T.signMaterial('ОГНЕОПАСНО', { bg: '#e8dcc0', fg: '#a01a10', w: 320, h: 88 }), 1.07, 2.2, -1.1);
	collide(x + Math.sin(ry) * 0.3, z + Math.cos(ry) * 0.3, 2.5, 7.6, ry);
}

/** Клетка с газовыми баллонами у лаборатории (вдоль X). */
function gasCage(batch, M, collide, x, z) {
	for (const dx of [-1.5, 1.5]) for (const dz of [-0.6, 0.6]) batch.add(place(box(0.06, 2.0, 0.06), x + dx, 1.0, z + dz), M.metalDark);
	for (const y of [0.1, 1.95]) for (const dz of [-0.6, 0.6]) batch.add(place(box(3.0, 0.05, 0.05), x, y, z + dz), M.metalDark);
	batch.add(place(box(3.2, 0.06, 1.4), x, 2.05, z), M.roofMetal);
	for (let i = 0; i < 6; i++) batch.add(place(cyl(0.13, 0.13, 1.5, 10), x - 1.2 + i * 0.48, 0.75, z + (i % 2 ? 0.25 : -0.2)), i % 3 ? M.woodBlue : M.red);
	collide(x, z, 3.2, 1.4);
}

export default {
	id: 'himmash',
	seed: 1957,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// материалы новых районов — по одному экземпляру (для слияния)
		const crateBlue = T.metalRoofMaterial([1, 1], [62, 88, 112]), crateRed = T.metalRoofMaterial([1, 1], [150, 70, 44]);
		const crateGreen = T.metalRoofMaterial([1, 1], [70, 96, 70]), crateYellow = T.metalRoofMaterial([1, 1], [150, 128, 70]);
		const chem = new THREE.MeshStandardMaterial({ color: 0x8cf060, emissive: 0x3a9a1c, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.85 });

		// ---------- Дороги и площадки ----------
		ground(180, 8, 0, 8, M.asphalt, 5, 0.02);
		ground(180, 0.15, 0, 8, markingMaterial(), 6, 0.026);
		ground(6, 78, 8, 51, M.asphalt, 5, 0.022); // на юг, к Заречному
		ground(88, 46, 0, -23, M.dirt, 5, 0.012); // заводской двор
		ground(8, 34, 0, -14, M.concrete, 4, 0.018); // проезд от ворот
		ground(84, 6, 0, -3.5, M.concrete, 4, 0.017); // вдоль цехов
		ground(30, 7, -24, 16, M.asphalt, 5, 0.019); // стоянка у заводоуправления
		// новые районы: площадка №2 за проходной, стоянка, проезд вдоль юга, сортировка, двор ГСМ, грузовая стоянка
		ground(42, 59, -65, -30.5, M.dirt, 5, 0.0125); // двор площадки №2
		ground(16, 26, -58, -27, M.concrete, 4, 0.018); // перед цехом №4
		ground(7, 14, -52.5, -8, M.concrete, 4, 0.0185); // от ворот площадки
		ground(26, 20, -73, 22, M.asphalt, 5, 0.019); // стоянка у проходной
		ground(4, 12, -70, 38, M.concrete, 3, 0.017); // дорожка к административному корпусу
		ground(91, 6, -40.5, 62, M.asphalt, 5, 0.0195); // проезд вдоль юга (запад)
		ground(75, 6, 48.5, 62, M.asphalt, 5, 0.0195); // проезд вдоль юга (восток)
		ground(134, 19, -19, -72, M.dirt, 6, 0.0115); // ж/д сортировка
		ground(48, 19, 60, 75.5, M.concrete, 4, 0.017); // двор склада ГСМ
		ground(24, 28, 74, 30, M.asphalt, 5, 0.019); // грузовая стоянка у автобазы
		ground(8, 16, 65, -26, M.concrete, 4, 0.0175); // перед лабораторией
		const pads = [
			[-86, -60, 12, 32], [-66, -50, -40, -14], [-56, -49, -15, -1], [-72, -68, 32, 44], [-86, 86, 59, 65],
			[-86, 48, -81.5, -62.5], [36, 84, 66, 85], [62, 86, 16, 44], [61, 69, -34, -18],
		];
		const onRoad = (x, z, m = 0) => Math.abs(z - 8) < 4.5 + m || (Math.abs(x - 8) < 3.5 + m && z > 8)
			|| (Math.abs(x) < 4.5 + m && z < 2 && z > -31) || (Math.abs(z + 3.5) < 3.5 + m && Math.abs(x) < 42)
			|| pads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

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

		// ================= Дальние районы (кольцо до мути) =================

		// ---------- Запад: забор площадки №2 с проходной и воротами ----------
		buildings.push(buildGatehouse(bctx, { cx: -66, cz: -1 }));
		concreteFence(batch, M, collide, root, -86.5, -1, -71, -1);
		concreteFence(batch, M, collide, root, -61, -1, -56, -1);
		concreteFence(batch, M, collide, root, -49, -1, -44.2, -1);
		for (const s of [-1, 1]) batch.add(place(box(3.4, 2.2, 0.08), -52.5 + s * 5.2, 1.15, -2.6, -s * 0.3), M.metalOlive); // створки ворот распахнуты внутрь
		for (const x of [-56.2, -48.8]) batch.add(place(box(0.5, 3.0, 0.5), x, 1.5, -1), M.concreteDark);
		// площадка №2: цех №4 фасадом во двор, у ворот — блоки и катушки, штабель труб
		buildings.push(buildShop4(bctx, { cx: -74, cz: -27, ry: -Z }));
		for (const [x, z, r] of [[-62, -44.5, 0.2], [-62.4, -46, 0.1], [-50.5, -20, 1.4]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }
		pipePile(batch, M, collide, -53, -33, Z + 0.05);
		hazardBarrels(batch, M, collide, -62, -10, rnd, 4);
		for (const [x, z, r, tint] of [[-83, -53, Z, crateBlue], [-83, -53, Z + 0.05, crateRed]]) {
			const h = tint === crateRed ? 2.6 : 0;
			batch.add(place(box(6, 2.6, 2.4, 1.5), x, h + 1.3, z, r), tint);
			if (!h) collide(x, z, 6, 2.4, r);
		}
		batch.add(place(box(6, 2.6, 2.4, 1.5), -60, 1.3, -53, 0.1), crateGreen);
		collide(-60, -53, 6, 2.4, 0.1);

		// ---------- Запад: стоянка у проходной ----------
		for (const [x, z, ry, color, burned] of [
			[-83, 17.5, Z, 0x7a2a22], [-79.5, 17.6, Z + 0.06, 0x3a5a6a], [-72.5, 17.4, -Z, 0xb8b0a0], [-65.5, 17.5, Z, 0x5a5a3a],
			[-81, 27.4, -Z, 0x3a5a6a], [-74, 27.5, -Z + 0.1, 0xb8b0a0, true], [-70.5, 27.6, Z, 0x7a2a22], [-63.5, 27.4, -Z, 0x5a5a3a],
		]) {
			addCar(batch, M, root, x, z, ry, color, burned ? { burned: true } : {});
			collide(x, z, 4.3, 1.8, ry);
		}
		for (let x = -85; x <= -61; x += 3.5) for (const z of [15, 30]) batch.add(place(box(0.1, 0.012, 4.6), x, 0.03, z), M.white, { cast: false }); // разметка мест
		billboard(batch, M, root, collide, -73, 12.6, 0, 'СТОЯНКА', { w: 2.6, h: 0.6, y: 2.2, bg: '#1d4f9c', fg: '#f4f4f0' });
		streetLamp(batch, M, collide, -58, 12.8);

		// ---------- Юго-запад: административный корпус, столовая ----------
		buildings.push(buildOffice(bctx, { cx: -70, cz: 50, ry: 0 }));
		buildings.push(buildCanteen(bctx, { cx: -46, cz: 74, ry: 0 }));
		for (const [x, z] of [[-60.5, 66.5], [-58.8, 66.5]]) { beginProp('dumpster', x, z, 0); batch.add(place(box(1.6, 1.2, 1.1), x, 0.6, z), M.green); endProp(); collide(x, z, 1.6, 1.1); }
		for (const [x, z, r] of [[-35, 80.5, 0.2], [-33.6, 79.6, 1.1]]) { beginProp('crate', x, z, r); batch.add(place(box(1.0, 0.7, 0.8), x, 0.35, z, r), M.wood); endProp(); collide(x, z, 1.0, 0.8, r); }

		// ---------- Север: ж/д сортировка — три пути с составами, горочный пост, мачта освещения ----------
		for (const z of [-66, -72, -78]) {
			railTrack(batch, M, -86.5, 47.5, z);
			batch.add(place(box(0.6, 1.2, 3.0), 47.2, 0.6, z), M.red); // упор
			collide(47.2, z, 0.6, 3.0);
		}
		boxcar(batch, M, collide, -77, -66, M.metalRust);
		gondola(batch, M, collide, -60, -66, true);
		tankWagon(batch, M, collide, -36, -66, 0, M.tankBlack);
		tankWagon(batch, M, collide, -24.5, -66, 0, M.tankBlack);
		flatWagon(batch, M, collide, -2, -66, 0, crateYellow);
		boxcar(batch, M, collide, 22, -66, M.roofMetal);
		tankWagon(batch, M, collide, -70, -72, 0, M.tankWhite);
		flatWagon(batch, M, collide, -52, -72, 0, crateBlue);
		gondola(batch, M, collide, -30, -72, false);
		boxcar(batch, M, collide, -4, -72, M.metalOlive);
		tankWagon(batch, M, collide, 14, -72, 0, M.tankBlack);
		tankWagon(batch, M, collide, 25.5, -72, 0, M.tankWhite);
		gondola(batch, M, collide, -78, -78, false);
		flatWagon(batch, M, collide, -48, -78, 0, crateGreen);
		boxcar(batch, M, collide, -16, -78, M.metalRust);
		gondola(batch, M, collide, 8, -78, true);
		flatWagon(batch, M, collide, 36, -78, 0, crateRed);
		occluder('SignalBox', (kb) => {
			kb.add(place(box(4, 3.2, 4, 1.5), -10, 1.6, -60), M.whiteBrick);
			kb.add(place(box(4.4, 0.2, 4.4), -10, 3.3, -60), M.concrete);
			kb.add(place(box(4.2, 2.2, 4.2), -10, 4.5, -60), M.glass);
			for (const [dx, dz] of [[-2.05, -2.05], [2.05, -2.05], [-2.05, 2.05], [2.05, 2.05]]) kb.add(place(box(0.14, 2.2, 0.14), -10 + dx, 4.5, -60 + dz), M.metalDark);
			kb.add(place(box(4.8, 0.25, 4.8, 2), -10, 5.72, -60), M.roofMetal);
			kb.add(place(box(1.0, 2.0, 0.08), -10, 1.0, -57.96), M.metalDark);
		}, { cx: -10, cz: -60, ry: 0, hx: 2.4, hz: 2.4, top: 5.9 }, 0.25);
		collide(-10, -60, 4.2, 4.2);
		batch.add(place(new THREE.CylinderGeometry(0.16, 0.32, 18, 8), 20, 9, -61), M.metalRust); // мачта освещения
		batch.add(place(box(3.0, 0.25, 0.25), 20, 17.6, -61), M.metalDark);
		for (const dx of [-1.1, 0, 1.1]) batch.add(place(box(0.5, 0.35, 0.3), 20 + dx, 17.3, -61), M.white);
		collide(20, -61, 0.7, 0.7);
		hazardBarrels(batch, M, collide, -66, -61, rnd, 3);

		// ---------- Северо-восток: градирня с насосной ----------
		coolingTower(occluder, collide, M, 68, -68);
		occluder('PumpHouse', (kb) => {
			kb.add(place(box(7, 3.6, 5, 2, 1.6), 50, 1.8, -54), M.brick);
			kb.add(place(box(7.4, 0.25, 5.4, 3), 50, 3.72, -54), M.roofTar);
			kb.add(place(box(1.2, 2.1, 0.08), 51.5, 1.05, -51.46), M.metalDark);
			for (const x of [48.4, 50]) kb.add(place(T.windowUV(new THREE.PlaneGeometry(1.0, 1.0), 1).translate(0, 0, 0), x, 2.4, -51.48), M.window);
		}, { cx: 50, cz: -54, ry: 0, hx: 3.7, hz: 2.7, top: 3.9 }, 0.25);
		collide(50, -54, 7, 5);
		for (const dz of [-0.4, 0.4]) batch.add(place(cylX(0.3, 6.2, 12), 56.6, 0.6, -55 + dz, -0.15), M.metalRust); // трубы к градирне
		for (const x of [54.6, 58.6]) batch.add(place(box(0.3, 0.5, 1.4), x, 0.25, -55), M.concreteDark);
		collide(56.6, -55, 6.2, 1.4, -0.15);

		// ---------- Восток: центральная заводская лаборатория ----------
		buildings.push(buildLab(bctx, { cx: 74, cz: -26, ry: Z, chem }));
		gasCage(batch, M, collide, 64.5, -39);
		hazardBarrels(batch, M, collide, 63.5, -12, rnd, 3);
		batch.add(place(planeXZ(2.2, 1.4), 64.2, 0.031, -9.9, 0.3), chem, { cast: false }); // пролитая химия у бочек

		// ---------- Восток: грузовая стоянка у автобазы ----------
		armyTruck(batch, M, root, collide, 81, 20, -Z);
		armyTruck(batch, M, root, collide, 81, 26, -Z + 0.08);
		tanker(batch, M, collide, 81, 33, -Z, M.woodBlue);
		bus(batch, M, root, 71, 40, Z + 0.05);
		collide(71, 40, 2.6, 7.8, Z + 0.05);
		addCar(batch, M, root, 67.5, 22, Z, 0x3a5a6a);
		collide(67.5, 22, 4.3, 1.8, Z);
		addCar(batch, M, root, 71, 30.5, 0.4, 0xb8b0a0, { burned: true });
		collide(71, 30.5, 4.3, 1.8, 0.4);
		streetLamp(batch, M, collide, 60, 12.8);

		// ---------- Юго-восток: склад ГСМ, ёмкости, колонка, бензовоз ----------
		buildings.push(buildFuelStore(bctx, { cx: 48, cz: 77, ry: 0 }));
		fuelTank(batch, M, root, collide, 67, 74.5, 9, 1.4, M.tankWhite, 'БЕНЗИН');
		fuelTank(batch, M, root, collide, 67, 80.5, 9, 1.4, M.tankBlack, 'ДИЗ. ТОПЛИВО');
		occluder('FuelCanopy', (kb) => {
			kb.add(place(box(6.4, 0.3, 8, 2), 79, 4.4, 70), M.roofMetal);
			kb.add(place(box(6.5, 0.5, 8.1), 79, 4.05, 70), M.red);
			for (const dz of [-3, 3]) kb.add(place(box(0.3, 4.0, 0.3), 79, 2.0, 70 + dz), M.metalDark);
		}, { cx: 79, cz: 70, ry: 0, hx: 3.3, hz: 4.1, top: 4.6 }, 0.2);
		for (const dz of [-3, 3]) collide(79, 70 + dz, 0.4, 0.4);
		batch.add(place(box(1.2, 0.2, 5.0, 1), 79, 0.1, 70), M.concrete); // островок
		for (const dz of [-1.2, 1.2]) { batch.add(place(box(0.7, 1.7, 0.5), 79, 1.05, 70 + dz), M.white); batch.add(place(box(0.72, 0.3, 0.52), 79, 1.75, 70 + dz), M.red); }
		collide(79, 70, 1.2, 3.4);
		tanker(batch, M, collide, 74.5, 68.5, Math.PI, M.red);
		hazardBarrels(batch, M, collide, 58.5, 69, rnd, 5);
		hazardBarrels(batch, M, collide, 37.5, 69.5, rnd, 4);
		for (const [x, z] of [[59, 82.5], [59.7, 82.5], [60.4, 82.5], [59.35, 83.2]]) { beginProp('barrel', x, z, x); batch.add(place(cyl(0.3, 0.3, 0.9, 12), x, 0.45, z), M.metalRust); endProp(); }
		collide(59.7, 82.8, 2.2, 1.4);
		billboard(batch, M, root, collide, 30, 66.5, 0, 'ОГНЕОПАСНО! НЕ КУРИТЬ', { w: 4.2, h: 0.9, y: 2.0, bg: '#e8dcc0', fg: '#a01a10' });

		const exits = [
			{ to: 'dachi', x0: -90, x1: -85.2, z0: 4, z1: 12, spawn: [-82.5, 8, Math.PI / 2], sign: [-84, 13.2, '← Дачи'] },
			{ to: 'lesopilka', x0: 5, x1: 11, z0: 85.2, z1: 90, spawn: [8, 82.5, Math.PI], sign: [12, 84, '↓ Лесопилка'] },
			{ to: 'voench', x0: 85.2, x1: 90, z0: 4, z1: 12, spawn: [82.5, 8, -Math.PI / 2], sign: [84, 13.2, 'Военная часть →'] },
		];
		return {
			start: [-82.5, 8, Math.PI / 2],
			exits,
			// развитые заражённые: топтуны по двору, руберы — у цистерн, у ёмкостей, у лаборатории и у градирни
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
				// дальние районы
				{ at: [-74, -27], r: 6, runners: 2, stompers: 1 }, // цех №4
				{ at: [-58, -31], r: 5, stompers: 1, runners: 1 },
				{ at: [-66, -8], r: 4, runners: 2 }, // за проходной
				{ at: [-67, 25], r: 6, runners: 2 }, // стоянка
				{ at: [-70, 50], r: 6, stompers: 1, runners: 1 }, // административный корпус
				{ at: [-46, 74], r: 6, runners: 2, stompers: 1 }, // столовая
				{ at: [54, 70], r: 6, stompers: 1, runners: 2 }, // склад ГСМ
				{ at: [74, -26], r: 5, rubers: 1, runners: 1 }, // лаборатория
				{ at: [56, -62], r: 6, rubers: 1, runners: 2 }, // градирня
				{ at: [-44, -70], r: 7, stompers: 2, runners: 2 }, // сортировка — стая топтунов
				{ at: [10, -69], r: 7, stompers: 1, runners: 2 },
				{ at: [74, 30], r: 6, runners: 2, stompers: 1 }, // грузовая стоянка
				{ at: [28, 76], r: 6, stompers: 1, runners: 1 },
			],
			onRoad,
			fires: [[-28, 16.2, 'car'], [15, -7.5], [-8, -30, 'ground'], [-74, 27.5, 'car'], [-64, -60], [71, 30.5, 'car']],
			barrels: 12, // промзона: бочки с горючим повсюду
			trees(tryTree) {
				// берёзы и тополя вдоль дороги и у заводоуправления; на заводе — редкие деревца у забора
				for (let i = 0; i < 40; i++) tryTree(R(-58, 86), R(13.5, 14.5), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 20; i++) tryTree(R(-46, -38), R(16, 46), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(14, 46), R(36, 46), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(-42, 42), R(-1, 0.5), 'birch');
				// у мути: угол за столовой, южная опушка, лесополоса на востоке, ельник за сортировкой
				for (let i = 0; i < 18; i++) tryTree(R(-86, -58), R(66, 86), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 14; i++) tryTree(R(-30, 34), R(68, 86), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 12; i++) tryTree(R(82, 86), R(-48, 58), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 10; i++) tryTree(R(-86, 50), R(-86, -82.5), 'pine');
			},
			clutter: 22,
			blood: 22,
			puddles: 16,
			puddle: () => { const k = rnd(); return [R(-84, 84), k < 0.4 ? R(5, 11) : k < 0.75 ? R(-80, -1) : R(58, 66)]; },
			grass: 0.6,
			beltDensity: 0.7,
			hint: (b) => ({
				Workshop: 'Цех №3 — шкафчики в раздевалке, верстак, сейф мастера в конторке',
				Booth: 'Сторожка автобазы — шкафчик охранника, стол',
				Depot: 'Склад автобазы — стеллажи с ящиками',
				Warehouse3: 'Склад у ж/д ветки — стеллажи с ящиками, бывают гранаты',
				Shop4: 'Цех №4 — верстаки, шкафчик и инструментальная кладовая в углу',
				Gatehouse: 'Проходная — стол вахтёра и шкаф в будке',
				Office: 'Административный корпус — сейфы бухгалтерии и главного инженера, стол директора, шкаф отдела кадров',
				Canteen: 'Столовая — холодильник на кухне, стеллаж в кладовой',
				FuelStore: 'Склад ГСМ — стеллаж с канистрами, шкаф кладовщика',
				Lab: 'Химлаборатория — вытяжной шкаф, шкаф с реактивами, сейф заведующего',
			}[b.name] ?? 'Склад №2 — на стеллажах ящики с патронами, бывают гранаты'),
		};
	},
};
