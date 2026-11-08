// Кластер «Военная часть»: брошенная войсковая часть, которую Улей забрал целиком — с техникой и оружейкой (180×180 м).
// С запада дорога упирается в КПП и ворота со шлагбаумом; за забором с колючкой — плац с флагштоком и трибуной,
// казарма, штаб, столовая, оружейка за мешками с песком, навес с БТР и «Уралами», ангар, склад ГСМ, вышки по углам.
// Логово руберов: самый опасный кластер и самая богатая добыча — оружие, патроны, гранаты, чёрный жемчуг.
// Ближняя окраина, за забором: полигон с бункером и подбитой техникой на севере, пост наблюдения на юге, полевой лагерь
// на востоке, сосновый лес на западе. В заборе части — проезды на север, юг и восток (к новым районам).
// Дальние районы (кольцо до мути): на севере — стрельбище (огневой рубеж с брустверами, мишени, земляной вал, вышка
// руководителя стрельб); на северо-востоке за своим забором с колючкой — склад боеприпасов: два обвалованных
// хранилища (стеллажи с патронами, ящики с РПГ-7, РГ-6, КСВК — самая ценная добыча); на востоке — автопарк: боксы
// с БТР и «Уралом» (верстак, шкаф с инструментом), стоянка техники, ангар №2 с БТР; на юго-востоке — вертолётная
// площадка с брошенным Ми-8 и ветроуказателем; на юге — медсанчасть (аптечки, шкаф с медикаментами, сейф) и офицерское
// общежитие с клубом; на юго-западе — полоса препятствий.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair, bed, buildArmyBarracks, buildArmory, buildCheckpoint } from '../buildings.js';
import { streetLamp, markingMaterial } from '../props.js';
import { concreteFence, storageTank, hazardBarrels, btr, armyTruck, barrier, watchTower, sandbags, billboard } from '../props-industrial.js';

const FX = -30; // линия забора с КПП (запад)
const Z = Math.PI / 2;
const ONE = new THREE.Vector3(1, 1, 1);
const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);
/** Цилиндр вдоль оси X. */
const cylX = (r0, r1, len, seg = 12) => cyl(r0, r1, len, seg).rotateZ(Z);
/** Матрица: сдвиг и поворот (Эйлер XYZ). */
const frame = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), ONE);

// ---------- Тайники (лицо мебели — в +Z её осей) ----------

/** Шкаф с дверцами. */
const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);
/** Металлический шкаф. */
const locker = (b, name, x, z, rot, loot, w = 1.0) => b.container(name, x, z, rot, [
	[w, 2.0, 0.5, 0, 1.0, 0, b.IM.locker], [0.02, 1.85, 0.02, 0, 1.0, 0.26, b.IM.black],
	[0.25, 0.04, 0.02, w * 0.25, 1.75, 0.26, b.IM.black], [0.25, 0.04, 0.02, -w * 0.25, 1.75, 0.26, b.IM.black],
], [w, 0.5], loot, 2.0);
/** Сейф. */
const safe = (b, name, x, z, rot, loot, h = 1.1) => b.container(name, x, z, rot, [
	[0.7, h, 0.6, 0, h / 2, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, h * 0.64, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, h * 0.64, 0.31, b.IM.black],
], [0.7, 0.6], loot, h);
/** Письменный стол с телефоном. */
const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.3, 0.75, 0.7, 0, 0.375, 0, b.IM.furniture], [0.3, 0.12, 0.22, 0.38, 0.81, -0.1, b.IM.black], [0.4, 0.01, 0.3, -0.25, 0.755, 0, b.IM.paper],
], [1.3, 0.7], loot, 0.95);
/** Тумбочка у койки (в игре — модель тумбочки). */
const nightstand = (b, x, z, rot, loot) => b.container('Тумбочка', x, z, rot, [
	[0.5, 0.65, 0.45, 0, 0.33, 0, b.IM.furnitureLight], [0.44, 0.02, 0.02, 0, 0.5, 0.23, b.IM.black],
], [0.5, 0.45], loot, 0.65);
/** Верстак с тисками. */
const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal],
	[0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine], [0.3, 0.2, 0.2, -0.6, 1.0, -0.1, b.IM.black],
], [2.0, 0.8], loot, 1.0);
/** Длинный оружейный ящик с замками. */
const gunCrate = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.8, 0.5, 0.65, 0, 0.25, 0, b.IM.crateGreen], [1.82, 0.05, 0.67, 0, 0.52, 0, b.IM.machine],
	[0.1, 0.12, 0.03, -0.55, 0.4, 0.34, b.IM.black], [0.1, 0.12, 0.03, 0.55, 0.4, 0.34, b.IM.black], [1.6, 0.42, 0.6, 0.04, 0.76, 0, b.IM.crateGreen],
], [1.8, 0.65], loot, 1.0);
/** Стеллаж с ящиками патронов. */
const ammoRack = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	...[-1.9, 1.9].flatMap((dx) => [-0.4, 0.4].map((dz) => [0.08, 2.4, 0.08, dx, 1.2, dz, b.IM.rack])),
	...[0.15, 0.95, 1.75, 2.35].map((y) => [3.9, 0.05, 0.9, 0, y, 0, b.IM.rack]),
	[0.9, 0.55, 0.7, -1.2, 0.45, 0, b.IM.crateGreen], [0.8, 0.5, 0.7, 0.5, 0.43, 0.05, b.IM.black], [0.7, 0.45, 0.6, 1.4, 0.4, 0, b.IM.crateGreen],
	[1.0, 0.6, 0.7, -0.5, 1.28, 0, b.IM.crateGreen], [0.9, 0.5, 0.7, 1.1, 1.23, 0, b.IM.machine], [0.8, 0.45, 0.6, -1.2, 2.0, 0, b.IM.black], [1.0, 0.4, 0.7, 0.6, 1.98, 0, b.IM.crateGreen],
], [4.0, 1.0], loot, 2.4);
/** Штабель зелёных ящиков (декор; в игре — модель ящика с патронами). */
function ammoStack(b, x, z, rot) {
	b.furniture(x, z, rot, [[1.0, 0.7, 0.7, 0, 0.35, 0, b.IM.crateGreen], [0.9, 0.6, 0.6, 0.05, 1.0, 0, b.IM.crateGreen]], { solid: [1.1, 0.8], prop: 'ammo' });
}

// ---------- Склад боеприпасов: обвалованное хранилище (можно зайти) ----------

/**
 * Хранилище 12×8 м: толстые бетонные стены, двустворчатая стальная дверь в передней стене (−Z), сверху — плита и земля
 * с дёрном. fill(b) расставляет внутри стеллажи и ящики (тайники).
 */
function buildAmmoStore(ctx, { name, cx, cz, ry, title, fill }) {
	const W = 12, D = 8, H = 3.4, hx = W / 2, hz = D / 2, t = 0.4;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.3 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [0], w: 2.4 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.top_(place(box(W + 0.8, 0.35, D + 0.8, 3), 0, H + 0.17, 0), M.concrete);
	b.top_(place(box(W + 0.3, 0.8, D + 0.1, 3), 0, H + 0.75, 0.15), M.grass); // земля с дёрном
	for (const x of [-3.5, 3.5]) b.vent(x, 1.5, H + 1.15, M.silver, { h: 0.6, r: 0.15 });
	b.canopy('front', 0, { w: 3.6, d: 1.4, y: 2.9, mat: M.concrete, t, thick: 0.2 });
	for (const s of [-1, 1]) b.wallBox('front', s * 1.9, 1.3, 0.02, 2.05, 0.08, M.metalOlive, { t, off: 0.1 });
	b.top_(b.onWall(new THREE.PlaneGeometry(2.8, 0.45).translate(0, H - 0.3, 0.03), 'front', 0, t), T.signMaterial(title, { bg: '#3c403c', fg: '#ece6d2', w: 448, h: 72 }));
	fill(b, { hx, hz });
	return b.finish();
}

// ---------- Автопарк: боксы (можно зайти) ----------

/**
 * Боксы автопарка 24×10 м: четыре ворота в передней стене (−Z), шторы подняты; между боксами — простенки
 * в глубине. В первом — БТР, во втором — смотровая яма и верстак, в третьем — «Урал», в четвёртом — двигатель
 * на стенде, колёса, шкаф с инструментом.
 */
function buildBoxes(ctx, { cx, cz, ry }) {
	const W = 24, D = 10, H = 4.6, hx = W / 2, hz = D / 2, t = 0.3, GW = 4.2, GH = 3.8, gates = [-9, -3, 3, 9];
	const b = new Building(ctx, { name: 'Boxes', cx, cz, ry, W, D, H, top: H + 0.6 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	let x0 = -hx - t / 2;
	for (const g of gates) { b.wall('x', -hz, x0, g - GW / 2, { ...wo, side: 1 }); x0 = g + GW / 2; }
	b.wall('x', -hz, x0, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [-6, 0, 6]) b.wall('z', x, 1.5, hz - t / 2, { mat: M.brick, t: 0.25 });
	for (const g of gates) {
		b.top_(place(box(GW, H - GH, t, 1.5), g, (GH + H) / 2, -hz), M.brick); // перемычка
		b.top_(place(box(GW, 0.55, 0.14), g, GH - 0.3, -hz + 0.3), M.metalOlive); // поднятая штора
	}
	for (const x of [-9, -3, 3, 9]) b.window('back', x, { y: 3.3, t, sill: M.brick });
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.3);
	for (const x of [-9, 3]) b.vent(x, 1.5, H + 0.3, M.silver);
	b.top_(b.onWall(new THREE.PlaneGeometry(2.8, 0.5).translate(0, H - 0.4, 0.03), 'front', 0, t), T.signMaterial('АВТОПАРК', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 68 }));
	// техника в боксах (в мировых осях; коллайдеры — свои)
	const vehicle = (make, lx, lz, len, wid) => {
		const [wx, wz] = b.world(lx, lz);
		make(ctx.batch, M, ctx.root, ctx.collide, wx, wz, ry + Math.PI);
		b.solids.push([lx, lz, wid, len, Math.PI]);
	};
	vehicle(btr, -9, 0.5, 6.9, 3.2);
	vehicle(armyTruck, 3, 0.4, 8.0, 2.7);
	// второй бокс: смотровая яма, верстак; четвёртый: двигатель на стенде, колёса, бочка, шкаф с инструментом
	b.lower(place(planeXZ(1.1, 5.0), -3, 0.03, -0.6), IM.black, { cast: false });
	workbench(b, 'Верстак', -3, hz - 0.6, Math.PI, { ammo545: [6, 12, 0.4], ammo762: [5, 10, 0.3], zhivchik: 0.2, grenade: 0.05 });
	locker(b, 'Шкаф с инструментом', hx - 0.4, 2.5, -Z, { ammo545: [8, 16, 0.45], ammo12: [4, 8, 0.3], spore: [1, 2, 0.3], fireaxe: 0.05 });
	b.furniture(8.5, -1.5, 0.2, [[1.2, 0.8, 0.8, 0, 0.9, 0, IM.machine], [0.6, 0.5, 0.6, 0.6, 0.95, 0, IM.metal], ...[[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]].map(([px, pz]) => [0.08, 0.5, 0.08, px, 0.25, pz, IM.metal])], { solid: [1.4, 0.9] });
	b.furniture(10.6, 4.3, 0, [0.1, 0.36, 0.62].map((y) => [0.9, 0.24, 0.9, 0, y, 0, M.tire, { geo: place(new THREE.TorusGeometry(0.36, 0.12, 8, 14).rotateX(Z), 0, y, 0) }]), { solid: [0.9, 0.9] });
	b.furniture(7.2, 4.3, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, M.metalRust, { geo: place(cyl(0.3, 0.3, 0.9, 12), 0, 0.45, 0) }]], { solid: [0.6, 0.6], prop: 'barrel' });
	return b.finish();
}

// ---------- Ангар №2 (можно зайти) ----------

/**
 * Арочный ангар 20×14 м: низкие стены из профлиста, арка, широкие ворота в переднем фронтоне (−Z) раздвинуты.
 * Внутри — БТР, верстак, ящики, двигатель на стенде, бочки.
 */
function buildHangar2(ctx, { cx, cz, ry }) {
	const W = 20, D = 14, H = 4.2, rise = 4.6, hx = W / 2, hz = D / 2, t = 0.2, DW = 9;
	const b = new Building(ctx, { name: 'Hangar2', cx, cz, ry, W, D, H, top: H + rise });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.roofGreen, t, lining: M.metalDark, sx: 1.2 };
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1, doors: [3.5] });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('x', -hz, -hx - t / 2, -DW / 2, { ...wo, side: 1 });
	b.wall('x', -hz, DW / 2, hx + t / 2, { ...wo, side: 1 });
	// арка над стенами, фронтоны-полуэллипсы, рёбра каркаса, створки ворот откатаны вбок
	const R = hx + 0.2, k = rise / R;
	b.top_(new THREE.CylinderGeometry(R, R, D + 0.4, 22, 1, true, -Z, Math.PI).rotateX(-Z).scale(1, k, 1).translate(0, H, 0), M.roofGreen);
	const gable = new THREE.Shape().absellipse(0, 0, R, rise, 0, Math.PI, false);
	for (const s of [-1, 1]) {
		const g = new THREE.ShapeGeometry(gable, 12);
		if (s < 0) g.rotateY(Math.PI);
		b.top_(g.translate(0, H, s * (hz + t / 2)), M.roofGreen);
	}
	for (const z of [-hz + 0.3, 0, hz - 0.3]) b.top_(new THREE.TorusGeometry(R + 0.04, 0.06, 4, 20, Math.PI).scale(1, k, 1).translate(0, H, z), M.metalDark);
	for (const s of [-1, 1]) b.wallBox('front', s * (DW / 2 + 2.35), 4.6, 0.02, H - 0.25, 0.12, M.metalOlive, { t, off: 0.14 });
	b.wallBox('right', 3.5 - 1.2, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.4, 0.6).translate(0, H + 1.2, 0.02), 'front', 0, t), T.signMaterial('АНГАР № 2', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 64 }));
	// БТР носом к воротам
	{
		const [wx, wz] = b.world(-1.5, 0.8);
		btr(ctx.batch, M, ctx.root, ctx.collide, wx, wz, ry + Math.PI);
		b.solids.push([-1.5, 0.8, 3.2, 6.9, Math.PI]);
	}
	workbench(b, 'Верстак', -hx + 0.5, 2.5, Z, { ammo545: [6, 12, 0.4], ammo76254: [5, 10, 0.3], zhivchik: 0.2 });
	b.container('Ящики', hx - 0.75, 5.0, -Z, [[1.2, 0.8, 1.2, 0, 0.4, 0, IM.crateGreen], [1.0, 0.6, 1.0, 0, 1.1, 0, IM.crateGreen]], [1.2, 1.2], { ammo545: [15, 30, 0.5], ammo762: [10, 20, 0.35], grenade: [1, 2, 0.15] }, 1.4);
	ammoStack(b, 5.5, 5.9, 0.1);
	ammoStack(b, 7.0, 5.9, -0.1);
	b.furniture(5.0, -2.5, 0.3, [[1.8, 0.8, 0.8, 0, 1.0, 0, IM.machine], [0.6, 0.6, 0.6, 1.1, 1.0, 0, IM.metal], ...[[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].map(([px, pz]) => [0.08, 0.6, 0.08, px, 0.3, pz, IM.metal])], { solid: [2.6, 0.9] });
	for (const [x, z] of [[8.9, -5.6], [8.9, -4.9], [8.2, -5.6]]) b.furniture(x, z, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, M.metalRust, { geo: place(cyl(0.3, 0.3, 0.9, 12), 0, 0.45, 0) }]], { solid: [0.6, 0.6], prop: 'barrel' });
	b.furniture(-hx + 0.4, -2.5, Z, [[1.4, 0.9, 0.04, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0] });
	return b.finish();
}

// ---------- Медсанчасть (можно зайти) ----------

/**
 * Медсанчасть 20×10 м: вход в передней стене (−Z) — в приёмный покой (аптечка, кушетка), рядом кабинет врача
 * (стол, шкаф с медикаментами), сзади — палата на четыре койки и аптечный склад (холодильник, сейф).
 */
function buildMedUnit(ctx, { cx, cz, ry }) {
	const W = 20, D = 10, H = 3.2, hx = W / 2, hz = D / 2, t = 0.25;
	const b = new Building(ctx, { name: 'MedUnit', cx, cz, ry, W, D, H, top: H + 0.6 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [-6], w: 1.6 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	const pw = { mat: IM.whitewash, t: 0.12 };
	b.wall('x', -0.5, -hx + t / 2, hx - t / 2, { ...pw, doors: [-6, 7] });
	b.wall('z', -2, -hz + t / 2, -0.5, { ...pw, doors: [-2.8] });
	b.wall('z', 3, -0.5, hz - t / 2, pw);
	const sill = M.whiteBrick;
	for (const x of [-9, -3, 2, 6, 9]) b.window('front', x, { t, sill });
	for (const x of [-8.5, -6, -3.5, -1, 6.5]) b.window('back', x, { t, sill });
	for (const z of [-2.8, 2.5]) { b.window('left', z, { t, sill }); b.window('right', z, { t, sill }); }
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.parapet(H + 0.25, M.whiteBrick, 0.3);
	b.vent(-5, 2.5, H + 0.25, M.silver);
	b.vent(6, 2.0, H + 0.25, M.silver, { h: 0.5, r: 0.12 });
	b.canopy('front', -6, { w: 2.6, d: 1.4, y: 2.6, mat: M.roofTar, posts: M.metalDark, t });
	b.wallBox('front', -6 + 1.15, 0.8, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.lower(place(box(2.4, 0.14, 1.2), -6, 0.07, -hz - 0.75), M.concrete);
	// табличка и красный крест на фасаде
	b.top_(b.onWall(new THREE.PlaneGeometry(3.4, 0.55).translate(0, H - 0.45, 0.03), 'front', -0.5, t), T.signMaterial('МЕДСАНЧАСТЬ', { bg: '#e8e6dc', fg: '#a01a10', w: 448, h: 72 }));
	b.top_(b.onWall(box(1.1, 1.1, 0.03).translate(0, H - 1.4, 0.02), 'front', 4, t), IM.white);
	b.top_(b.onWall(box(0.8, 0.24, 0.03).translate(0, H - 1.4, 0.04), 'front', 4, t), IM.redBoard);
	b.top_(b.onWall(box(0.24, 0.8, 0.03).translate(0, H - 1.4, 0.045), 'front', 4, t), IM.redBoard);
	const kit = (name, x, z, rot, loot) => b.container(name, x, z, rot, [
		[0.5, 0.45, 0.2, 0, 1.4, 0, IM.white], [0.2, 0.06, 0.01, 0, 1.4, 0.105, IM.redBoard], [0.06, 0.2, 0.01, 0, 1.4, 0.106, IM.redBoard],
	], [0.4, 0.2], loot, 1.65);
	// приёмный покой: аптечка на стене, кушетка, стол медсестры
	kit('Аптечка', -hx + 0.25, -3.0, Z, { zhivchik: [1, 2, 0.7], spore: 0.15 });
	b.furniture(-4, -4.4, 0, [[1.9, 0.5, 0.7, 0, 0.25, 0, IM.metal], [1.9, 0.12, 0.7, 0, 0.56, 0, IM.sofa]], { solid: [1.9, 0.7] });
	table(b, -8.4, -1.5, 0, { w: 1.1, d: 0.6 });
	// кабинет врача: стол, шкаф с медикаментами, кушетка, столик с инструментами
	desk(b, 'Стол врача', 2, -4.3, 0, { zhivchik: [1, 2, 0.45], ammo919: [4, 8, 0.4], spore: [1, 2, 0.3] });
	chair(b, 3.3, -3.4, -2.4);
	cabinet(b, 'Шкаф с медикаментами', hx - 0.4, -2.8, -Z, 1.2, 2.0, 0.5, { zhivchik: [1, 3, 0.65], grenade: 0.04, spore: [1, 3, 0.35] }, IM.white);
	b.furniture(6.2, -4.4, 0, [[1.9, 0.5, 0.7, 0, 0.25, 0, IM.metal], [1.9, 0.12, 0.7, 0, 0.56, 0, IM.white]], { solid: [1.9, 0.7] });
	b.furniture(-0.5, -1.4, 0, [[0.7, 0.05, 0.45, 0, 0.85, 0, IM.metal], [0.06, 0.82, 0.06, -0.3, 0.41, -0.18, IM.metal], [0.06, 0.82, 0.06, 0.3, 0.41, 0.18, IM.metal], [0.3, 0.05, 0.2, 0, 0.9, 0, IM.glass]], { solid: [0.7, 0.45] });
	// палата: четыре койки и тумбочка
	for (const x of [-8.5, -6, -3.5, -1]) bed(b, x, hz - 1.15, Math.PI);
	nightstand(b, -7.25, hz - 0.4, Math.PI, { zhivchik: [1, 1, 0.35], ammo545: [4, 8, 0.3], spore: 0.15 });
	// аптечный склад: холодильник, сейф, стеллаж с коробками
	b.container('Холодильник', hx - 0.45, 2.0, -Z, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], [0.62, 0.6], { zhivchik: [1, 2, 0.6], spore: [1, 2, 0.3] }, 1.5);
	safe(b, 'Сейф', 6.5, hz - 0.45, Math.PI, { spore: [2, 5, 0.6], zhivchik: [1, 2, 0.4], ammo919: [6, 12, 0.4], glock17: 0.06 });
	b.furniture(4.6, hz - 0.4, Math.PI, [
		...[-0.95, 0.95].map((dx) => [0.05, 1.8, 0.45, dx, 0.9, 0, IM.metal]), ...[0.3, 0.9, 1.5].map((y) => [1.95, 0.03, 0.45, 0, y, 0, IM.metal]),
		[1.6, 0.3, 0.35, 0, 0.47, 0, IM.white], [1.4, 0.28, 0.35, 0, 1.06, 0, IM.paper], [1.5, 0.25, 0.35, 0, 1.64, 0, IM.white],
	], { solid: [2.0, 0.45] });
	return b.finish();
}

// ---------- Офицерское общежитие с клубом (можно зайти) ----------

/**
 * Общежитие 20×10 м: вход посередине фасада (−Z), за ним тамбур и коридор. Спереди — клуб (сцена с трибуной,
 * стулья, пианино) и комната дежурного (стол), сзади — три комнаты офицеров (койка, тумбочка или шкаф).
 */
function buildHostel(ctx, { cx, cz, ry }) {
	const W = 20, D = 10, H = 3.2, hx = W / 2, hz = D / 2, t = 0.25;
	const b = new Building(ctx, { name: 'Hostel', cx, cz, ry, W, D, H, top: H + 1.7 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.wallpaper[1] };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1, doors: [0], w: 1.6 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	const pw = { mat: IM.whitewash, t: 0.12 };
	b.wall('x', -1, -hx + t / 2, -1, { ...pw, doors: [-5] });
	b.wall('x', -1, 1, hx - t / 2, { ...pw, doors: [5] });
	b.wall('z', -1, -hz + t / 2, -1, pw);
	b.wall('z', 1, -hz + t / 2, -1, pw);
	b.wall('x', 1, -hx + t / 2, hx - t / 2, { ...pw, doors: [-7, 0, 6.5] });
	b.wall('z', -3.5, 1, hz - t / 2, pw);
	b.wall('z', 3, 1, hz - t / 2, pw);
	const sill = M.brick;
	for (const x of [-8, -4, 3.5, 8]) b.window('front', x, { t, sill });
	for (const x of [-8.5, -1.5, 5]) b.window('back', x, { t, sill });
	for (const z of [-3, 3]) { b.window('left', z, { t, sill }); b.window('right', z, { t, sill }); }
	// двускатная шиферная крыша с кирпичными фронтонами
	const rise = 1.5, slope = Math.hypot(hz + 0.5, rise);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.8, 0.08, slope, 2), 0, H + rise / 2, s * (hz + 0.5) / 2, 0, s * Math.atan2(rise, hz + 0.5)), M.slate);
	for (const sx of [-1, 1]) {
		const x = sx * (hx + t / 2 + 0.01);
		const a = [x, H, -hz - t / 2], c = [x, H, hz + t / 2], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...a, ...tp, ...c] : [...a, ...c, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 3, rise / 1.5, D / 1.5, 0] : [0, 0, D / 1.5, 0, D / 3, rise / 1.5]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.brick);
	}
	b.chimney(-6, 1.2, H + 0.6, H + rise + 0.8, 0.5);
	b.canopy('front', 0, { w: 2.6, d: 1.4, y: 2.6, mat: M.metalRust, posts: M.brick, t });
	for (const s of [-1, 1]) b.wallBox('front', s * 1.25, 0.8, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.lower(place(box(2.6, 0.14, 1.2), 0, 0.07, -hz - 0.75), M.concrete);
	b.top_(b.onWall(new THREE.PlaneGeometry(5.6, 0.5).translate(0, H - 0.4, 0.03), 'front', -5.5, t), T.signMaterial('ОФИЦЕРСКОЕ ОБЩЕЖИТИЕ · КЛУБ', { bg: '#2a2c26', fg: '#e8dcae', w: 640, h: 58 }));
	// клуб: сцена с трибуной, стулья, пианино, стенд
	b.furniture(-8.6, -3.0, 0, [[2.2, 0.35, 3.4, 0, 0.175, 0, IM.furniture], [0.6, 1.1, 0.4, 0.3, 0.9, 0, IM.redBoard], [0.8, 0.05, 0.5, 0.3, 1.47, 0, IM.furniture]], { solid: [2.2, 3.4] });
	for (const x of [-6.4, -5.2]) for (const z of [-3.9, -2.9]) chair(b, x, z, -Z);
	b.furniture(-2.2, -4.45, 0, [[1.4, 1.2, 0.6, 0, 0.6, 0, IM.black], [1.3, 0.04, 0.25, 0, 0.8, 0.35, IM.white]], { solid: [1.4, 0.6] });
	b.furniture(-5, -1.1, Math.PI, [[2.0, 1.0, 0.04, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0] });
	// комната дежурного
	desk(b, 'Стол дежурного', 5, -4.3, 0, { ammo545: [6, 12, 0.5], ammo919: [4, 8, 0.4], zhivchik: 0.3 });
	chair(b, 6.3, -3.5, -2.3);
	b.furniture(hx - 0.35, -3, -Z, [[1.0, 1.9, 0.45, 0, 0.95, 0, IM.metal]], { solid: [1.0, 0.45] });
	// комнаты офицеров
	bed(b, -8.3, hz - 1.15, Math.PI);
	nightstand(b, -7.0, hz - 0.4, Math.PI, { ammo545: [5, 12, 0.45], zhivchik: 0.25, spore: 0.15 });
	table(b, -5, 2.0, 0, { w: 0.9, d: 0.6 });
	bed(b, -2.2, hz - 1.15, Math.PI);
	cabinet(b, 'Шкаф', 2.4, 3.6, -Z, 1.0, 1.9, 0.5, { ammo76254: [5, 10, 0.35], ammo545: [6, 12, 0.35], deagle: 0.04, spore: [1, 2, 0.25] });
	bed(b, 8.5, hz - 1.15, Math.PI);
	nightstand(b, 7.2, hz - 0.4, Math.PI, { ammo919: [4, 8, 0.4], grenade: 0.05, zhivchik: 0.2 });
	table(b, 4.5, 4.2, 0, { w: 0.9, d: 0.6 });
	return b.finish();
}

// ---------- Техника и предметы новых районов (в общую статику) ----------

/**
 * Брошенный вертолёт вроде Ми-8: кабина с остеклением, двигатели, хвостовая балка с килем, поникшие лопасти.
 * Нос — в +X своих осей, ry — куда смотрит нос.
 */
function helicopter(batch, M, collide, x, z, ry) {
	const F = frame(x, 0, z, ry);
	const put = (g, mat, m) => batch.add(g.applyMatrix4(m).applyMatrix4(F), mat);
	const paint = M.khaki;
	put(cylX(1.15, 1.15, 5.4, 10).scale(1, 0.92, 1), paint, frame(0.3, 1.6, 0));
	put(new THREE.SphereGeometry(1.15, 12, 8).scale(1.6, 0.86, 1), paint, frame(3.0, 1.55, 0));
	put(new THREE.SphereGeometry(1.18, 12, 6, Math.PI - 0.95, 1.9, 0.25, 1.15).scale(1.6, 0.86, 1), M.glass, frame(3.0, 1.55, 0));
	put(new THREE.SphereGeometry(1.15, 10, 6).scale(1.25, 0.9, 1), paint, frame(-2.4, 1.65, 0));
	put(cylX(0.28, 0.55, 6.6, 8), paint, frame(-5.7, 2.0, 0));
	put(box(1.4, 2.0, 0.16), paint, frame(-8.8, 2.9, 0, 0, 0, 0.35));
	put(box(0.8, 0.06, 2.4), paint, frame(-7.8, 2.0, 0));
	for (const a of [0.6, 0.6 + Z]) put(box(0.12, 2.0, 0.04), M.metalDark, frame(-9.1, 3.2, 0.22, 0, 0, a));
	put(box(2.8, 0.75, 1.5), paint, frame(0.2, 2.85, 0));
	for (const s of [-1, 1]) put(cylX(0.22, 0.22, 0.7, 8), M.metalDark, frame(-1.4, 2.9, s * 0.58));
	put(cyl(0.13, 0.15, 0.6, 8), M.metalDark, frame(0.5, 3.5, 0));
	put(cyl(0.36, 0.36, 0.2, 10), M.metalDark, frame(0.5, 3.85, 0));
	for (let k = 0; k < 5; k++) put(box(6.2, 0.05, 0.42).translate(3.3, 0, 0), M.metalDark, frame(0.5, 3.9, 0, 0.3 + k * Math.PI * 0.4, 0, -0.2 - (k % 2) * 0.12));
	for (const s of [-1, 1]) {
		put(box(1.6, 1.25, 0.05), M.metalDark, frame(0.3, 1.5, s * 1.13));
		for (const wx of [-1.3, 1.7]) put(box(0.5, 0.42, 0.05), M.glass, frame(wx, 1.95, s * 1.1));
		put(box(0.9, 0.9, 0.04), M.red, frame(-2.6, 1.7, s * 1.14)); // звезда на борту
	}
	put(box(0.12, 1.0, 0.12), M.metalDark, frame(2.6, 0.55, 0));
	put(cyl(0.28, 0.28, 0.24, 10).rotateX(Z), M.tire, frame(2.6, 0.28, 0));
	for (const s of [-1, 1]) {
		put(box(0.12, 1.2, 0.12), M.metalDark, frame(-0.6, 0.55, s * 1.45, 0, s * 0.5, 0));
		put(cyl(0.4, 0.4, 0.3, 12).rotateX(Z), M.tire, frame(-0.6, 0.4, s * 1.8));
	}
	const c = Math.cos(ry), s = Math.sin(ry), at = (lx) => [x + lx * c, z - lx * s];
	collide(...at(0.6), 8.6, 3.0, ry);
	collide(...at(-6.3), 6.4, 0.9, ry);
}

/** Ветроуказатель: мачта и полосатый конус. */
function windsock(batch, M, collide, x, z) {
	batch.add(place(cyl(0.07, 0.1, 6, 8), x, 3, z), M.metalDark);
	for (let i = 0; i < 4; i++) batch.add(place(cylX(0.36 - i * 0.05, 0.31 - i * 0.05, 0.62, 10), x + 0.45 + i * 0.62, 5.6 - i * 0.12, z, 0.5, 0, -0.18), i % 2 ? M.white : M.red);
	collide(x, z, 0.35, 0.35);
}

/** «Буханка» медсанчасти: белый фургон с красной полосой и крестом. Перед — локальная +X. */
function ambulance(batch, M, collide, x, z, ry) {
	const F = frame(x, 0, z, ry);
	const put = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(F), mat);
	put(box(3.8, 0.28, 1.6), M.metalDark, 0, 0.42, 0);
	put(box(4.4, 1.6, 1.94, 1.5), M.white, 0, 1.26, 0);
	put(box(4.0, 0.08, 1.8, 1.5), M.white, -0.1, 2.1, 0);
	put(box(4.42, 0.2, 1.96), M.red, 0, 1.12, 0);
	put(box(0.04, 0.55, 1.62), M.metalDark, 2.21, 1.68, 0);
	put(box(0.85, 0.5, 1.96), M.metalDark, 1.55, 1.68, 0);
	for (const s of [-1, 1]) {
		put(box(0.5, 0.14, 0.02), M.red, -0.9, 1.5, s * 0.985);
		put(box(0.14, 0.5, 0.02), M.red, -0.9, 1.5, s * 0.985);
		for (const wx of [-1.35, 1.35]) put(cyl(0.4, 0.4, 0.26, 14).rotateX(Z), M.tire, wx, 0.4, s * 0.86);
	}
	collide(x, z, 4.6, 2.1, ry);
}

export default {
	id: 'voench',
	seed: 1968,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;

		// ---------- Дороги, плац ----------
		ground(96, 7, -18, 6, M.asphalt, 5, 0.02); // от западного края через ворота
		ground(24, 7, -78, 6, M.asphalt, 5, 0.02); // до нового края
		ground(60, 6, 14, 6, M.asphalt, 5, 0.021);
		ground(6, 60, 14, 10, M.asphalt, 5, 0.022); // на север и на юг по части
		ground(26, 18, -2, -9, M.asphalt, 5, 0.023); // плац
		ground(26, 0.15, -2, -0.3, markingMaterial(), 6, 0.028);
		ground(26, 0.15, -2, -17.7, markingMaterial(), 6, 0.028);
		ground(70, 76, 7, 0, M.dirt, 5, 0.012); // территория части
		// новые районы: рокады вокруг части, стрельбище, склад боеприпасов, автопарк, ангар, вертолётная площадка,
		// полоса препятствий
		ground(6, 18, 14, 51, M.asphalt, 5, 0.022); // через южные ворота
		ground(6, 6, 47, 6, M.asphalt, 5, 0.0215); // через восточные ворота
		ground(4, 62, -34, -25, M.dirt, 4, 0.0135); // лесная дорога на север
		ground(4, 52, -34, 32, M.dirt, 4, 0.0135); // и на юг
		ground(122, 4, 25, -56, M.dirt, 4, 0.0136); // северная рокада
		ground(7, 12, 8.5, -48, M.dirt, 4, 0.0137); // от северных ворот
		ground(4, 114, 47, 3, M.dirt, 4, 0.0136); // восточная рокада
		ground(166, 4, 3, 60, M.dirt, 4, 0.0136); // южная рокада
		ground(72, 20, -12, -76, M.dirt, 5, 0.0125); // поле стрельбища
		ground(68, 4, -12, -66, M.concrete, 4, 0.018); // огневой рубеж
		ground(37, 27, 66.5, -71.5, M.dirt, 5, 0.0125); // двор склада боеприпасов
		ground(18, 40, 65, -28, M.asphalt, 5, 0.019); // стоянка техники автопарка
		ground(8, 6, 52, -28, M.dirt, 4, 0.014);
		ground(14, 16, 63, 30, M.concrete, 4, 0.018); // перед ангаром №2
		ground(8, 6, 52, 30, M.dirt, 4, 0.014);
		ground(22, 22, 62, 71, M.concrete, 4, 0.019); // вертолётная площадка
		ground(44, 30, -60, 68, M.dirt, 5, 0.0125); // полоса препятствий
		const pads = [
			[-36, -32, -56, 58], [-36, 86, -58, -54], [5, 12, -54, -42], [45, 49, -54, 62], [-82, 86, 58, 62], [11, 17, 42, 60], [44, 50, 3, 9],
			[-48, 24, -86, -64], [48, 85, -85, -58], [56, 74, -48, -8], [48, 56, -31, -25], [56, 70, 22, 38], [48, 56, 27, 33], [51, 73, 60, 82],
			[-82, -38, 53, 83],
		];
		const onRoad = (x, z, m = 0) => Math.abs(z - 6) < 4 + m || (Math.abs(x - 14) < 3.5 + m && z > -20 && z < 40)
			|| (Math.abs(x + 2) < 13 + m && Math.abs(z + 9) < 9 + m)
			|| pads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

		// ---------- Забор с колючкой, КПП и ворота со шлагбаумом; проезды на север, юг и восток ----------
		concreteFence(batch, M, collide, root, FX, -42, FX, -4.6);
		concreteFence(batch, M, collide, root, FX, 10.4, FX, 42);
		concreteFence(batch, M, collide, root, FX, -42, 5, -42);
		concreteFence(batch, M, collide, root, 12, -42, 44, -42);
		concreteFence(batch, M, collide, root, FX, 42, 11, 42);
		concreteFence(batch, M, collide, root, 17, 42, 44, 42);
		concreteFence(batch, M, collide, root, 44, -42, 44, 2.5);
		concreteFence(batch, M, collide, root, 44, 9.5, 44, 42);
		for (const [x, z] of [[5, -42], [12, -42], [11, 42], [17, 42], [44, 2.5], [44, 9.5]]) { batch.add(place(box(0.6, 3.0, 0.6), x, 1.5, z), M.concreteDark); collide(x, z, 0.6, 0.6); }
		barrier(batch, M, collide, 10.3, 43.2, 0, 6, true);
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
					const win = T.windowUV(new THREE.PlaneGeometry(1.1, 1.3), [0, 1, 0, 3, 0, 2, 0][(i * 3 + f * 2 + name.length) % 7]); // клетка атласа окон
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

		// ---------- Окраина, за забором ----------
		buildings.push(
			buildArmory(bctx, { name: 'Bunker', cx: -40, cz: -54, ry: Math.PI }),
			buildCheckpoint(bctx, { name: 'Post', cx: 20, cz: 54, ry: 0 }),
			buildArmyBarracks(bctx, { name: 'FieldCamp', cx: 54, cz: 0, ry: Math.PI / 2 }),
		);
		// север: полигон — подбитый БТР, «Урал», окопы из мешков, вышка
		btr(batch, M, root, collide, -6, -53, 0.4);
		armyTruck(batch, M, root, collide, 16, -54, 2.8);
		sandbags(batch, M, collide, -20, -49, 6, 0);
		sandbags(batch, M, collide, 30, -49, 5, 0.2);
		watchTower(batch, M, collide, 42, -57);
		// юг: пост наблюдения, окоп, сгоревший грузовик
		sandbags(batch, M, collide, 12, 49.5, 5, 0);
		sandbags(batch, M, collide, 28, 49.5, 5, 0);
		armyTruck(batch, M, root, collide, -10, 54, 0.15);
		watchTower(batch, M, collide, -24, 56);
		// восток: полевой лагерь у забора
		hazardBarrels(batch, M, collide, 50, -14, rnd, 4);
		for (const [x, z, r] of [[50, 13, 0.1], [51.4, 14.2, 0.5], [58, -14, 0]]) {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		}
		// ящики и бочки по части
		for (const [x, z, r] of [[-24, 20, 0.1], [-25.2, 21.2, 0.4], [36, 6, 0], [37.2, 6.8, 0.3], [4, 36, 0.2]]) {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		}

		// ================= Дальние районы (кольцо до мути) =================

		// ---------- Север: стрельбище — огневой рубеж, мишени, вал, вышка руководителя стрельб ----------
		for (let i = 0; i < 8; i++) {
			const x = -40 + i * 8;
			sandbags(batch, M, collide, x, -67.6, 2.6, 0); // бруствер на рубеже
			batch.add(place(box(0.08, 1.0, 0.08), x, 0.5, -75), M.wood); // грудная мишень
			batch.add(place(box(0.7, 0.7, 0.04), x, 1.25, -75), M.woodGrey);
			batch.add(place(box(0.36, 0.36, 0.05), x, 1.25, -75), M.white);
			batch.add(place(box(0.14, 0.14, 0.06), x, 1.25, -75), M.red);
			collide(x, -75, 0.3, 0.3);
			batch.add(place(box(0.08, 0.6, 0.08), x + 1.5, 0.3, -80.5), M.wood); // ростовая мишень — силуэт
			batch.add(place(box(0.55, 1.2, 0.04), x + 1.5, 1.2, -80.5), M.green);
			batch.add(place(box(0.3, 0.3, 0.04), x + 1.5, 1.95, -80.5), M.green);
			collide(x + 1.5, -80.5, 0.4, 0.3);
		}
		for (let i = 0; i <= 8; i++) batch.add(place(box(0.12, 0.012, 15), -44 + i * 8, 0.03, -75.5), M.white, { cast: false }); // разметка полос
		batch.add(place(box(74, 1.6, 3.4, 3), -12, 0.8, -84.5), M.dirt); // земляной вал
		batch.add(place(box(74, 1.2, 2.0, 3), -12, 2.2, -84.8), M.dirt);
		collide(-12, -84.5, 74, 3.4);
		{
			const TX = -52, TZ = -64;
			occluder('RangeTower', (kb) => {
				kb.add(place(box(4, 3.2, 4, 1.5), TX, 1.6, TZ), M.whiteBrick);
				kb.add(place(box(4.8, 0.2, 4.8), TX, 3.3, TZ), M.concrete);
				kb.add(place(box(4.2, 2.0, 4.2), TX, 4.4, TZ), M.glass);
				for (const [dx, dz] of [[-2.05, -2.05], [2.05, -2.05], [-2.05, 2.05], [2.05, 2.05]]) kb.add(place(box(0.14, 2.0, 0.14), TX + dx, 4.4, TZ + dz), M.metalDark);
				kb.add(place(box(5.0, 0.25, 5.0, 2), TX, 5.52, TZ), M.roofMetal);
				for (const [w, d, dx, dz] of [[4.8, 0.05, 0, -2.4], [4.8, 0.05, 0, 2.4], [0.05, 4.8, -2.4, 0], [0.05, 4.8, 2.4, 0]]) kb.add(place(box(w, 0.06, d), TX + dx, 4.05, TZ + dz), M.metalDark);
				kb.add(place(box(1.0, 2.0, 0.08), TX, 1.0, TZ + 2.04), M.metalDark);
				kb.add(place(box(0.9, 0.12, 4.2), TX + 2.5, 1.7, TZ, 0, 0.75), M.metalDark); // лестница на балкон
			}, { cx: TX, cz: TZ, ry: 0, hx: 3.0, hz: 2.5, top: 5.7 }, 0.25);
			collide(TX, TZ, 4.2, 4.2);
			collide(TX + 2.5, TZ, 1.0, 4.0);
			batch.add(place(box(0.08, 7, 0.08), TX - 2.8, 3.5, TZ + 3), M.metalDark); // мачта с красным флагом «стрельба»
			batch.add(place(box(1.2, 0.7, 0.03), TX - 2.2, 6.6, TZ + 3), M.red);
			collide(TX - 2.8, TZ + 3, 0.3, 0.3);
		}
		for (const [x, z, r] of [[-46.5, -60.8, 0.1], [-45.3, -60.2, 0.5]]) {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		}
		billboard(batch, M, root, collide, -20, -62.6, 0, 'СТРЕЛЬБИЩЕ', { w: 3.6, h: 0.8, y: 2.2, bg: '#2a2c26', fg: '#e8dcae' });
		watchTower(batch, M, collide, 30, -79);

		// ---------- Северо-восток: склад боеприпасов за отдельным забором ----------
		concreteFence(batch, M, collide, root, 48, -85, 48, -58);
		concreteFence(batch, M, collide, root, 48, -58, 60, -58);
		concreteFence(batch, M, collide, root, 67, -58, 85, -58);
		concreteFence(batch, M, collide, root, 85, -85, 85, -58);
		concreteFence(batch, M, collide, root, 48, -85, 85, -85);
		barrier(batch, M, collide, 60, -58, 0, 7, true);
		{
			const warn = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.7), T.signMaterial('ВЗРЫВООПАСНО! ПОСТОРОННИМ ВХОД ВОСПРЕЩЁН', { bg: '#e8dcc0', fg: '#a01a10', w: 640, h: 140 }));
			warn.position.set(54, 1.5, -57.88);
			root.add(warn);
		}
		buildings.push(buildAmmoStore(bctx, {
			name: 'AmmoStore1', cx: 58, cz: -72, ry: Math.PI, title: 'ХРАНИЛИЩЕ № 1',
			fill: (b, { hx, hz }) => {
				ammoRack(b, 'Стеллаж с боеприпасами', -3.5, hz - 0.7, Math.PI, { ammo545: [20, 40, 0.6], ammo76254: [10, 20, 0.45], ammo127: [5, 10, 0.25], grenade: [1, 2, 0.3] });
				gunCrate(b, 'Ящик РПГ-7', 3.2, hz - 0.6, Math.PI, { rpg7: 0.1, rocket: [1, 3, 0.5], ammo762: [10, 20, 0.4] });
				b.container('Ящик с гранатами', -hx + 0.6, -1.0, Z, [[1.0, 0.45, 0.6, 0, 0.23, 0, b.IM.crateGreen], [1.02, 0.05, 0.62, 0, 0.47, 0, b.IM.machine]], [1.0, 0.6], { grenade: [1, 3, 0.5], vog25: [2, 4, 0.25] }, 0.5);
				ammoStack(b, 4.6, -2.6, 0.1);
				ammoStack(b, 4.8, 0.3, -0.15);
			},
		}));
		buildings.push(buildAmmoStore(bctx, {
			name: 'AmmoStore2', cx: 75, cz: -72, ry: Math.PI, title: 'ХРАНИЛИЩЕ № 2',
			fill: (b, { hx, hz }) => {
				ammoRack(b, 'Стеллаж с боеприпасами', -3.5, hz - 0.7, Math.PI, { ammo76251: [10, 20, 0.45], ammo556: [15, 30, 0.45], vog25: [3, 6, 0.35], ammo127: [5, 10, 0.25] });
				gunCrate(b, 'Ящик РГ-6', 3.2, hz - 0.6, Math.PI, { rg6: 0.08, vog25: [3, 6, 0.45], grenade: [1, 2, 0.3] });
				gunCrate(b, 'Ящик КСВК', -hx + 0.6, -1.0, Z, { ksvk: 0.06, ammo127: [5, 10, 0.35], svd: 0.08, ammo76254: [10, 20, 0.4] });
				ammoStack(b, 4.6, -2.6, -0.1);
			},
		}));
		watchTower(batch, M, collide, 81.5, -81.5);
		sandbags(batch, M, collide, 57, -61, 3, 0);
		for (const [x, z, r] of [[71, -62.5, 0.1], [72.2, -61.7, 0.6], [79, -63, 0]]) {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		}
		// «грибок» часового у ворот
		batch.add(place(box(0.12, 2.6, 0.12), 69.5, 1.3, -52.5), M.wood);
		batch.add(place(new THREE.ConeGeometry(1.3, 0.6, 10), 69.5, 2.8, -52.5), M.red);
		collide(69.5, -52.5, 0.3, 0.3);

		// ---------- Восток: автопарк — боксы, стоянка техники ----------
		buildings.push(buildBoxes(bctx, { cx: 79, cz: -26, ry: Z }));
		btr(batch, M, root, collide, 60, -43, Math.PI);
		armyTruck(batch, M, root, collide, 65.5, -43, Math.PI);
		armyTruck(batch, M, root, collide, 71, -43, Math.PI + 0.05);
		btr(batch, M, root, collide, 63, -24, -Z + 0.2);
		armyTruck(batch, M, root, collide, 65, -12, 0.4); // разбитый, горит
		billboard(batch, M, root, collide, 65, -49.6, 0, 'АВТОПАРК', { w: 3.0, h: 0.7, y: 2.0, bg: '#2a2c26', fg: '#e8dcae' });
		hazardBarrels(batch, M, collide, 57.5, -34, rnd, 3);

		// ---------- Восток: ангар №2 ----------
		buildings.push(buildHangar2(bctx, { cx: 77, cz: 30, ry: Z }));
		for (const [x, z, r] of [[58, 24.5, 0.2], [58.6, 35.4, -0.3]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }

		// ---------- Юго-восток: вертолётная площадка ----------
		batch.add(place(new THREE.RingGeometry(7.4, 7.9, 40).rotateX(-Z), 62, 0.03, 71), M.yellow, { cast: false });
		for (const dx of [-1.8, 1.8]) batch.add(place(box(0.9, 0.012, 5.6), 62 + dx, 0.032, 71), M.white, { cast: false });
		batch.add(place(box(2.7, 0.012, 0.9), 62, 0.032, 71), M.white, { cast: false });
		for (const [x, z] of [[51.4, 60.4], [72.6, 60.4], [51.4, 81.6], [72.6, 81.6]]) batch.add(place(box(0.3, 0.3, 0.3), x, 0.15, z), M.yellow);
		helicopter(batch, M, collide, 63, 72.5, 0.4);
		windsock(batch, M, collide, 74.5, 61.5);
		hazardBarrels(batch, M, collide, 53, 79.5, rnd, 3);

		// ---------- Юг: медсанчасть, офицерское общежитие ----------
		buildings.push(buildMedUnit(bctx, { cx: -8, cz: 72, ry: 0 }));
		buildings.push(buildHostel(bctx, { cx: 26, cz: 74, ry: 0 }));
		ambulance(batch, M, collide, -1, 64.5, 0.15);
		for (const [x, z] of [[8, 63.5], [40, 64]]) streetLamp(batch, M, collide, x, z);

		// ---------- Юго-запад: полоса препятствий ----------
		batch.add(place(planeXZ(2.2, 4.2), -76, 0.031, 64), M.water, { cast: false }); // ров с водой
		batch.add(place(box(0.25, 2.0, 4.0, 1), -70, 1.0, 64), M.woodGrey); // забор 2 м
		for (const dz of [-2, 2]) batch.add(place(box(0.15, 2.2, 0.15), -70, 1.1, 64 + dz), M.wood);
		collide(-70, 64, 0.35, 4.0);
		batch.add(place(cylX(0.18, 0.18, 6, 10), -61, 1.0, 64), M.bark); // бревно
		for (const dx of [-2.8, 0, 2.8]) batch.add(place(box(0.2, 1.0, 0.2), -61 + dx, 0.5, 64), M.wood);
		collide(-61, 64, 6.0, 0.4);
		for (const dx of [-2.5, 2.5]) for (const dz of [-1.3, 1.3]) { batch.add(place(box(0.16, 2.6, 0.16), -51 + dx, 1.3, 64 + dz), M.metalDark); collide(-51 + dx, 64 + dz, 0.3, 0.3); } // рукоход
		for (const dz of [-0.45, 0.45]) batch.add(place(box(5.2, 0.08, 0.08), -51, 2.55, 64 + dz), M.metalDark);
		for (let k = 0; k < 10; k++) batch.add(place(box(0.05, 0.05, 0.9), -53.25 + k * 0.5, 2.55, 64), M.metalDark);
		for (const [y, h, d, dz] of [[1.1, 2.2, 1.5, -1.25], [1.1, 2.2, 1.5, 1.25], [0.45, 0.9, 1.0, 0], [1.95, 0.5, 1.0, 0]]) batch.add(place(box(0.35, h, d, 1), -44, y, 64 + dz), M.brick); // стенка с проломом
		collide(-44, 64, 0.45, 4.0);
		for (let i = 0; i < 12; i++) { // шины
			const x = -78 + (i % 6) * 1.2, z = 73 + Math.floor(i / 6) * 1.6;
			beginProp('tire', x, z, i);
			batch.add(place(new THREE.TorusGeometry(0.34, 0.12, 8, 14).rotateX(Z), x, 0.12, z), M.tire);
			endProp();
		}
		batch.add(place(box(0.2, 1.0, 4.0), -66, 0.5, 74), M.woodGrey); // заборчик
		collide(-66, 74, 0.3, 4.0);
		sandbags(batch, M, collide, -59, 72.5, 4, 0.5); // окоп
		sandbags(batch, M, collide, -55, 75.5, 4, -0.5);
		for (const [x, z, r] of [[-49, 73, 0.3], [-46.5, 75.5, -0.2], [-44, 72.6, 0.1]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }
		batch.add(place(box(9, 0.45, 0.5), -60, 0.45, 81.0), M.woodGrey); // трибуна
		batch.add(place(box(9, 0.85, 0.5), -60, 0.42, 81.8), M.woodGrey);
		batch.add(place(box(9, 0.6, 0.08), -60, 1.15, 82.1), M.woodGrey);
		collide(-60, 81.4, 9, 1.4);
		billboard(batch, M, root, collide, -60, 55.6, 0, 'ПОЛОСА ПРЕПЯТСТВИЙ', { w: 5, h: 0.9, y: 2.2, bg: '#2a2c26', fg: '#e8dcae' });

		return {
			start: [-82.5, 6, Math.PI / 2],
			exits: [
				{ to: 'himmash', x0: -90, x1: -85.2, z0: 2, z1: 10, spawn: [-82.5, 6, Math.PI / 2], sign: [-84, 11.2, '← Химмаш'] },
			],
			// логово руберов: на плацу, у оружейки, в ангаре, у штаба; топтуны по части; в дальних районах — у склада
			// боеприпасов, в автопарке, в ангаре №2, у общежития, на стрельбище
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
				// окраина
				{ at: [-40, -47], r: 6, runners: 2, stompers: 1 },
				{ at: [2, -55], r: 7, stompers: 1, rubers: 1 },
				{ at: [20, 47], r: 6, runners: 2, stompers: 1 },
				{ at: [48, 0], r: 5, runners: 2, rubers: 1 },
				{ at: [-50, 30], r: 7, runners: 2 },
				{ at: [-50, -25], r: 6, runners: 1, stompers: 1 },
				// дальние районы
				{ at: [-24, -76], r: 8, runners: 2, stompers: 1 }, // стрельбище
				{ at: [8, -74], r: 6, rubers: 1, runners: 1 },
				{ at: [66, -64], r: 6, rubers: 1, stompers: 1 }, // склад боеприпасов
				{ at: [40, -62], r: 5, runners: 2 },
				{ at: [64, -32], r: 6, stompers: 1, runners: 2 }, // автопарк
				{ at: [78, -24], r: 5, rubers: 1 },
				{ at: [63, 30], r: 6, rubers: 1, runners: 2 }, // ангар №2
				{ at: [58, 68], r: 7, stompers: 1, runners: 2 }, // вертолётная площадка
				{ at: [-8, 64], r: 5, stompers: 1, runners: 1 }, // медсанчасть
				{ at: [26, 66], r: 5, rubers: 1, runners: 2 }, // общежитие
				{ at: [-60, 68], r: 7, runners: 2, stompers: 1 }, // полоса препятствий
			],
			onRoad,
			// дымит подбитый БТР у дороги, у КПП и у казармы — бочки с огнём; горит разбитый «Урал» в автопарке
			fires: [[30, 14, 'car', 2.1], [-25.5, 9.5], [6, -24], [65, -12, 'car', 2.0], [-47, -62], [56, 80]],
			barrels: 10, // склад ГСМ рядом
			trees(tryTree) {
				// за забором — сосновый лес; в части — редкие берёзы вдоль дорожек
				for (let i = 0; i < 85; i++) tryTree(R(-86, FX - 1.5), R(-56, 52), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(FX + 3, 42), R(-40, 40), 'birch');
				// у мути: ельник за стрельбищем, южная и восточная опушки
				for (let i = 0; i < 14; i++) tryTree(R(-86, -56), R(-86, -58), 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(-36, 50), R(81, 86), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(85, 86.5), R(-52, 58), 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(-86, -82), R(53, 86), 'pine');
			},
			clutter: 14,
			blood: 26,
			puddles: 12,
			puddle: () => { const k = rnd(); return [R(-84, 84), k < 0.35 ? R(3, 9) : k < 0.6 ? R(-18, -1) : k < 0.8 ? R(-58, -54) : R(58, 62)]; },
			grass: 0.7,
			beltTrees: ['pine', 'pine', 'birch'],
			beltDensity: 0.6,
			hint: (b) => ({
				Checkpoint: 'КПП — стол дежурного и шкаф',
				ArmyBarracks: 'Казарма — тумбочки у коек и шкафы в каптёрке',
				Armory: 'Оружейка — пирамиды с оружием, ящик гранат, сейф',
				Bunker: 'Бункер на полигоне — пирамида, ящики, сейф',
				Post: 'Пост наблюдения — стол и шкаф',
				FieldCamp: 'Полевой лагерь — тумбочки у коек и шкафы',
				AmmoStore1: 'Хранилище №1 — стеллаж с боеприпасами, ящик РПГ-7, ящик гранат',
				AmmoStore2: 'Хранилище №2 — стеллаж с боеприпасами, ящики РГ-6 и КСВК',
				Boxes: 'Боксы автопарка — верстак и шкаф с инструментом',
				Hangar2: 'Ангар №2 — верстак, ящики',
				MedUnit: 'Медсанчасть — аптечка, шкаф с медикаментами, стол врача, холодильник, сейф, тумбочка в палате',
				Hostel: 'Офицерское общежитие — стол дежурного, тумбочки, шкаф',
			}[b.name]),
		};
	},
};
