// Форпост внешников: пришлые солдаты из внешнего мира поставили посреди Улья укреплённый лагерь — в отличие от
// бандитского «Карьера» здесь порядок и техника. Периметр — бетонные Т-стены с колючей спиралью, по углам — стальные
// вышки с прожекторами, на юге — ворота со шлагбаумом и КПП, перед воротами — змейка из габионов. Во дворе — модули
// светлых панелей с плоскими крышами и кондиционерами: казарма (оттуда выходит смена), штаб командира (сейф и шкафы),
// изолятор для пойманных иммунных; склад — арочный ангар из тента (стеллажи, оружейные ящики, кейсы). Вертолётная
// площадка с вертолётом, автопарк (БТР, «Уралы», УАЗ), генераторы и топливо за габионами, морские контейнеры, мачта
// связи и радар, передвижные прожекторные мачты. Габионы и бетонные блоки во дворе — укрытия для часовых.
// Заражённых нет. Часовые, командир, гарнизон и запасы склада — game/main.js (логика по образцу «Карьера»).

import * as THREE from 'three';
import * as T from '../textures.js';
import { tileFbm, tileNoise } from '../../src/noise.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair } from '../buildings.js';
import { addCar } from '../props.js';
import { btr, armyTruck, sandbags, barrier, billboard } from '../props-industrial.js';

/** Периметр: x от −FX до FX, z от FN (север) до FS (юг); ворота посередине южной стены, проём ±GATE. */
const FX = 38, FN = -40, FS = 28, GATE = 4.5;
/** Высота Т-стен и толщина стен модулей. */
const TW_H = 3.3, T_WALL = 0.2;
const ONE = new THREE.Vector3(1, 1, 1);

/** Матрица: сдвиг и поворот (Эйлер XYZ: сначала rz, потом ry, потом rx). */
const frame = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), ONE);
/** Цилиндр вдоль оси X; radiusTop — на стороне −X. */
const cylX = (r0, r1, len, seg = 12) => new THREE.CylinderGeometry(r0, r1, len, seg).rotateZ(Math.PI / 2);

/** Материал по картинке из функции (u, v, x, y) → [r, g, b]: своя текстура форпоста (повторяется по UV в метрах). */
function canvasMaterial(name, size, fn, { roughness = 0.85, metalness = 0 } = {}) {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const [r, g, b] = fn(x / size, y / size, x, y), i = (y * size + x) * 4;
		img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	return new THREE.MeshStandardMaterial({ name, map: t, roughness, metalness });
}

/** Свои материалы форпоста (по одному на локацию — для слияния). */
function forpostMaterials() {
	const clamp = (v) => Math.max(0, Math.min(255, v));
	return {
		// панели модулей: светлые серо-бежевые, шов между панелями каждые 1,2 м (UV стен — в метрах, sx = 1,2)
		panel: canvasMaterial('extPanel', 128, (u, v, x) => {
			const n = tileFbm(u, v, 4, 3, 301), g = tileNoise(u, v, 64, 303);
			const streak = tileNoise(u, 0.5, 16, 305) * tileFbm(u, v, 2, 2, 307); // потёки от дождя
			let c = [200, 194, 176].map((k) => k * (0.92 + n * 0.1 + g * 0.03) * (1 - streak * 0.12));
			if (x < 2) c = c.map((k) => k * 0.55); // шов
			else if (x < 4) c = c.map((k) => k * 1.07); // кромка соседней панели
			return c.map(clamp);
		}, { roughness: 0.7 }),
		// габионы HESCO: песок в стальной сетке, каркас по краю короба (короб — одна клетка UV)
		hesco: canvasMaterial('extHesco', 128, (u, v, x, y) => {
			const n = tileFbm(u, v, 6, 4, 311), lump = tileFbm(u, v, 3, 2, 313);
			let c = [178, 158, 116].map((k) => k * (0.8 + n * 0.32 + lump * 0.1));
			if (x % 16 === 0 || y % 16 === 0) c = c.map((k) => k * 0.72); // сетка
			if (x < 3 || x > 124 || y < 3 || y > 124) c = [92, 90, 82].map((k) => k * (0.9 + n * 0.2)); // каркас
			return c.map(clamp);
		}, { roughness: 1 }),
		// синий пластик кабинок-туалетов
		blue: new THREE.MeshStandardMaterial({ name: 'extBlue', color: 0x2f5c8a, roughness: 0.55 }),
		// прожекторы светятся (без освещения, ярче белого)
		lamp: new THREE.MeshBasicMaterial({ name: 'extLamp', color: new THREE.Color(1.8, 1.6, 1.25), toneMapped: false }),
	};
}

// ---------- Модули ----------

/** Коробка модуля: пол, четыре стены (doors: { side: [середины проёмов] }, ширина w), ступени у передних дверей. */
function shell(b, { wall, lining, floor, doors = { front: [0] }, w = 1.3, t = T_WALL, sx = 1.2 }) {
	const { W, D } = b, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.5), 0, 0.025, 0), floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: wall, t, doors: doors.front ?? [], w, lining, side: 1, sx });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: wall, t, doors: doors.back ?? [], w, lining, side: -1, sx });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: wall, t, doors: doors.left ?? [], w, lining, side: 1, sx });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: wall, t, doors: doors.right ?? [], w, lining, side: -1, sx });
	for (const at of doors.front ?? []) b.lower(place(box(w + 0.5, 0.18, 0.9), at, 0.09, -hz - t / 2 - 0.45), b.ctx.M.concrete);
}

/** Окно модуля: светлая рама и тёмное стекло; bars — решётка (изолятор). */
function modWindow(b, side, at, { y = 1.7, w = 1.0, h = 0.8, t = T_WALL, bars = false } = {}) {
	b.top_(b.onWall(box(w + 0.12, h + 0.12, 0.05).translate(0, y, 0.025), side, at, t), b.IM.white);
	b.top_(b.onWall(new THREE.PlaneGeometry(w, h).translate(0, y, 0.052), side, at, t), b.ctx.M.glass);
	if (bars) for (let k = -2; k <= 2; k++) b.top_(b.onWall(box(0.035, h, 0.035).translate(k * w / 5, y, 0.08), side, at, t), b.ctx.M.metalDark);
}

/** Табличка с номером модуля на стене. */
function plate(b, text, at, { side = 'front', w = 2.4, y = b.H - 0.42, t = T_WALL } = {}) {
	b.top_(b.onWall(new THREE.PlaneGeometry(w, 0.46).translate(0, y, 0.02), side, at, t), T.signMaterial(text, { bg: '#3c403c', fg: '#ece6d2', w: 480, h: 92 }));
}

/** Кондиционер на крыше: короб и решётка вентилятора. */
function roofAC(b, x, z) {
	const y = b.H + 0.2;
	b.top_(place(box(1.0, 0.5, 0.75), x, y + 0.25, z), b.IM.white);
	b.top_(place(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12), x, y + 0.515, z), b.IM.black);
}

/** Сплит-кондиционер на стене (снаружи, выше пояса — исчезает вместе с крышей). */
function wallAC(b, side, at, t = T_WALL) {
	b.top_(b.onWall(box(0.85, 0.55, 0.28).translate(0, 2.15, 0.14), side, at, t), b.IM.white);
}

/**
 * Модуль из панелей с плоской крышей: стены, окна [[side, at, opts]], кондиционеры на крыше ac [[x, z]],
 * распахнутые наружу двери (leaf — с какой стороны проёма полотно: 1 — справа, −1 — слева), табличка.
 */
function modBuilding(ctx, P, { name, cx, cz, ry, W, D, H = 2.9, doors = { front: [0] }, dw = 1.3, leaf = 1, windows = [], ac = [], label = null, signAt = 0, lining = null, floor = null }) {
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.8 });
	b.messKind = 'tidy'; // у внешников порядок: окна целые, на полу почти чисто
	const IM = b.IM;
	shell(b, { wall: P.panel, lining: lining ?? IM.whitewash, floor: floor ?? ctx.M.concreteDark, doors, w: dw });
	for (const [side, at, o] of windows) modWindow(b, side, at, o);
	b.top_(place(box(W + 0.3, 0.2, D + 0.3, 3), 0, H + 0.1, 0), ctx.M.concrete);
	b.parapet(H + 0.2, P.panel, 0.18);
	for (const [x, z] of ac) roofAC(b, x, z);
	for (const side of Object.keys(doors)) for (const at of doors[side]) b.wallBox(side, at + leaf * (dw / 2 + 0.55), 1.0, 0.02, 2.05, 0.05, IM.metal, { t: T_WALL });
	if (label) plate(b, label, signAt);
	return b;
}

/** Двухъярусная койка (модель Tripo — 'bunk'). */
function bunk(b, x, z, rot) {
	const { metal, blanketArmy, linen } = b.IM, parts = [];
	for (const y of [0.42, 1.35]) parts.push([0.85, 0.06, 1.95, 0, y, 0, metal], [0.82, 0.1, 1.8, 0, y + 0.08, 0.05, blanketArmy], [0.6, 0.1, 0.32, 0, y + 0.16, -0.75, linen]);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([0.05, 1.75, 0.05, sx * 0.4, 0.875, sz * 0.95, metal]);
	b.furniture(x, z, rot, parts, { solid: [0.9, 2.0], prop: 'bunk' });
}

/** Металлический шкафчик (тайник); лицо — в +Z своих осей. */
const locker = (b, name, x, z, rot, loot, w = 0.6) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker],
	[0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black],
	[0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);

/** Достроить: разрухи нет (у внешников порядок). */
function done(b) { b.messKind = null; return b.finish(); }

// ---------- Казарма: модуль 18×7, двухъярусные койки вдоль стен, шкафчики между ними, стол посередине ----------
function extBarracks(ctx, P, { cx, cz, ry }) {
	const W = 18, D = 7, hz = D / 2;
	const b = modBuilding(ctx, P, {
		name: 'ExtBarracks', cx, cz, ry, W, D, H: 2.9, doors: { front: [0] },
		windows: [['front', -6.5], ['front', -3.6], ['front', 3.6], ['front', 6.5], ['back', -6], ['back', -2], ['back', 2], ['back', 6], ['left', 0], ['right', 0]],
		ac: [[-5.5, 0.6], [0, -0.8], [5.5, 0.6]], label: '01 · КАЗАРМА', signAt: -2.4,
	});
	const IM = b.IM;
	for (const x of [-7.5, -5.0, -2.5, 2.5, 5.0, 7.5]) bunk(b, x, hz - 1.15, Math.PI);
	for (const x of [-7.5, -5.0, 5.0, 7.5]) bunk(b, x, -hz + 1.15, 0);
	// шкафчики бойцов между койками
	locker(b, 'Шкафчик', -6.25, hz - 0.37, Math.PI, { ammo556: [8, 16, 0.45], zhivchik: 0.2, spore: 0.1 });
	locker(b, 'Шкафчик', 6.25, hz - 0.37, Math.PI, { ammo919: [8, 14, 0.45], zhivchik: 0.25 });
	locker(b, 'Шкафчик', -6.25, -hz + 0.37, 0, { ammo556: [6, 12, 0.4], grenade: 0.05 });
	locker(b, 'Шкафчик', 6.25, -hz + 0.37, 0, { ammo76251: [4, 8, 0.3], spore: 0.12 });
	// стол с табуретами посередине прохода, стойка с касками и бронежилетами у двери
	table(b, 0, 0.6, 0, { w: 1.8, d: 0.8 });
	chair(b, -0.55, 1.3, Math.PI);
	chair(b, 0.55, -0.1, 0);
	b.furniture(-2.2, -hz + 0.35, 0, [[1.4, 0.06, 0.35, 0, 1.5, 0, IM.metal], [0.06, 1.5, 0.3, -0.65, 0.75, 0, IM.metal], [0.06, 1.5, 0.3, 0.65, 0.75, 0, IM.metal],
		[0.5, 0.65, 0.22, -0.35, 1.05, 0.05, IM.blanketArmy], [0.5, 0.65, 0.22, 0.35, 1.05, 0.05, IM.blanketArmy], [0.3, 0.18, 0.3, -0.35, 1.62, 0, IM.machine], [0.3, 0.18, 0.3, 0.35, 1.62, 0, IM.machine]], { solid: [1.4, 0.4] });
	wallAC(b, 'back', -4);
	wallAC(b, 'back', 4);
	return done(b);
}

// ---------- Склад: арочный ангар из тента 16×10 — стеллажи, оружейные ящики, кейсы (это и есть запасы внешников) ----------
function extStorage(ctx, P, { cx, cz, ry }) {
	const W = 16, D = 10, H = 2.6, rise = 2.8, hx = W / 2, hz = D / 2, t = 0.14;
	const b = new Building(ctx, { name: 'ExtStorage', cx, cz, ry, W, D, H, top: H + rise });
	b.messKind = 'tidy';
	const { M } = ctx, IM = b.IM;
	shell(b, { wall: M.canvas, lining: null, floor: M.concrete, doors: { front: [0] }, w: 4.0, t, sx: 2 });
	// арка из тента на низких стенах, полукружья торцов, рёбра каркаса, скатанный полог над воротами
	const R = hz + 0.2, k = rise / R;
	b.top_(new THREE.CylinderGeometry(R, R, W + 0.4, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, k, 1).translate(0, H, 0), M.canvas);
	for (const s of [-1, 1]) b.top_(new THREE.CircleGeometry(R, 18, 0, Math.PI).scale(1, k, 1).rotateY(s * Math.PI / 2).translate(s * (hx + 0.2), H, 0), M.canvas);
	for (const x of [-hx + 0.3, -hx / 2, 0, hx / 2, hx - 0.3]) b.top_(new THREE.TorusGeometry(R + 0.03, 0.05, 4, 18, Math.PI).rotateY(Math.PI / 2).scale(1, k, 1).translate(x, H, 0), M.metalDark);
	b.top_(cylX(0.17, 0.17, 4.3, 10).translate(0, 2.3, -hz - t / 2 - 0.16), M.canvas);
	plate(b, '03 · СКЛАД', 4.8, { t, y: 1.95 });
	// стеллажи вдоль задней стены
	const rack = (x, loot) => b.container('Стеллаж', x, hz - t / 2 - 0.5, Math.PI, [
		...[-1.75, 1.75].flatMap((dx) => [-0.4, 0.4].map((dz) => [0.08, 2.4, 0.08, dx, 1.2, dz, IM.rack])),
		...[0.15, 0.95, 1.75, 2.35].map((y) => [3.6, 0.05, 0.9, 0, y, 0, IM.rack]),
		[0.9, 0.55, 0.7, -1.1, 0.45, 0, IM.crateGreen], [0.8, 0.5, 0.7, 0.4, 0.43, 0.05, IM.black], [0.7, 0.45, 0.6, 1.3, 0.4, 0, IM.crateGreen],
		[1.0, 0.6, 0.7, -0.5, 1.28, 0, IM.crateGreen], [0.9, 0.5, 0.7, 1.1, 1.23, 0, IM.machine], [0.8, 0.45, 0.6, -1.2, 2.0, 0, IM.black], [1.0, 0.4, 0.7, 0.6, 1.98, 0, IM.crateGreen],
	], [3.6, 0.9], loot, 2.4);
	rack(-5, { ammo556: [20, 40, 0.6], ammo919: [10, 20, 0.4], grenade: 0.1 });
	rack(0, { ammo76251: [10, 20, 0.5], ammo556: [15, 30, 0.45], zhivchik: [1, 2, 0.4] });
	rack(5, { ammo556: [20, 40, 0.55], ammo12: [8, 16, 0.35], grenade: 0.12 });
	// длинные оружейные ящики вдоль левой стены (крышка с замками)
	const gunCrate = (z, loot) => b.container('Оружейный ящик', -hx + t / 2 + 0.33, z, Math.PI / 2, [
		[1.7, 0.45, 0.6, 0, 0.23, 0, IM.crateGreen], [1.72, 0.05, 0.62, 0, 0.47, 0, IM.machine],
		[0.1, 0.12, 0.03, -0.5, 0.36, 0.31, IM.black], [0.1, 0.12, 0.03, 0.5, 0.36, 0.31, IM.black],
		[1.5, 0.4, 0.55, 0.05, 0.7, 0, IM.crateGreen],
	], [1.7, 0.6], loot, 0.9);
	gunCrate(-2.2, { g36: 0.2, aug: 0.12, ammo556: [20, 30, 0.6] });
	gunCrate(0.6, { fnfal: 0.15, awm: 0.05, ammo76251: [10, 20, 0.5] });
	// кейсы на стеллаже-поддоне у правой стены
	b.container('Кейсы', hx - t / 2 - 0.47, 0.6, -Math.PI / 2, [
		[1.8, 0.5, 0.9, 0, 0.25, 0, IM.machine],
		[0.9, 0.2, 0.55, -0.45, 0.6, 0.1, IM.black], [0.8, 0.18, 0.5, 0.45, 0.59, -0.1, IM.black], [0.85, 0.18, 0.5, -0.4, 0.79, 0.05, IM.black],
		[0.05, 0.05, 0.12, -0.45, 0.6, 0.38, IM.metal],
	], [1.8, 0.9], { deagle: 0.12, mp5: 0.15, ammo50: [5, 10, 0.4], ammo919: [10, 20, 0.5] }, 0.9);
	// поддоны с ящиками патронов у ворот (не тайники), канистры
	for (const x of [-4.5, 4.4]) b.furniture(x, -hz + 1.9, 0, [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], [1.0, 0.5, 0.45, 0, 0.39, -0.24, IM.crateGreen], [1.0, 0.5, 0.45, 0, 0.39, 0.24, IM.crateGreen], [1.0, 0.45, 0.45, 0, 0.87, 0, IM.crateGreen]], { solid: [1.25, 1.05], prop: 'ammo' });
	const cans = [];
	for (let i = 0; i < 5; i++) cans.push([0.18, 0.46, 0.34, -0.5 + i * 0.25, 0.23, 0, ctx.M.khaki]);
	b.furniture(hx - 1.2, -hz + 0.45, 0, cans, { solid: [1.3, 0.4] });
	return done(b);
}

// ---------- Штаб: модуль 10×6,5 — стол с картой, радиостанции, стол командира; сейф и шкафы ----------
function extCommand(ctx, P, { cx, cz, ry }) {
	const W = 10, D = 6.5, H = 3.0, hx = W / 2, hz = D / 2;
	const b = modBuilding(ctx, P, {
		name: 'ExtCommand', cx, cz, ry, W, D, H, doors: { front: [-2] },
		windows: [['front', 1.4], ['front', 3.6], ['back', -2.5], ['back', 2.5], ['left', 0], ['right', 0]],
		ac: [[-2.5, 1.2], [2.8, -1.0]], label: '02 · ШТАБ', signAt: 2.5,
	});
	const IM = b.IM;
	// стол с картой посередине: карта, флажки и фишки
	b.furniture(1.0, -0.4, 0, [
		[2.4, 0.06, 1.3, 0, 0.85, 0, IM.furniture], [2.2, 0.82, 1.1, 0, 0.41, 0, IM.machine],
		[2.2, 0.01, 1.1, 0, 0.885, 0, IM.paper],
		[0.06, 0.12, 0.06, -0.6, 0.95, 0.2, IM.redBoard], [0.06, 0.12, 0.06, 0.3, 0.95, -0.3, IM.redBoard], [0.06, 0.12, 0.06, 0.7, 0.95, 0.35, IM.black], [0.12, 0.04, 0.08, -0.2, 0.91, -0.1, IM.black],
	], { solid: [2.4, 1.3] });
	// радиостанции на столе у задней стены, два стула
	b.furniture(1.4, hz - 0.5, Math.PI, [
		[3.0, 0.06, 0.8, 0, 0.76, 0, IM.furniture], [0.06, 0.73, 0.7, -1.4, 0.37, 0, IM.furniture], [0.06, 0.73, 0.7, 1.4, 0.37, 0, IM.furniture],
		[0.7, 0.42, 0.4, -0.9, 1.0, 0.1, IM.machine], [0.55, 0.14, 0.02, -0.9, 1.05, -0.11, IM.screen], [0.5, 0.36, 0.4, 0.0, 0.97, 0.1, IM.black],
		[0.6, 0.4, 0.4, 0.9, 0.99, 0.1, IM.machine], [0.45, 0.12, 0.02, 0.9, 1.03, -0.11, IM.screen], [0.04, 0.6, 0.04, 1.2, 1.4, 0.15, IM.black],
	], { solid: [3.0, 0.8] });
	chair(b, 0.6, hz - 1.25, 0);
	chair(b, 2.2, hz - 1.25, 0);
	// стол командира с ноутбуком у правого торца, карта района на стене
	table(b, 3.8, -2.0, 0, { w: 1.4, d: 0.75 });
	b.furniture(3.8, -2.0, 0, [[0.38, 0.02, 0.28, 0, 0.785, 0.05, IM.black], [0.38, 0.26, 0.02, 0, 0.92, -0.1, IM.screen]]);
	chair(b, 3.8, -1.35, Math.PI);
	b.furniture(hx - 0.14, 0.6, -Math.PI / 2, [[2.0, 1.1, 0.03, 0, 1.6, 0, IM.paper]]);
	// сейф в углу, шкаф с документами и оружейный шкаф у левого торца
	b.container('Сейф', hx - 0.5, hz - 0.45, Math.PI, [[0.7, 1.1, 0.6, 0, 0.55, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, IM.black], [0.03, 0.2, 0.03, -0.2, 0.7, 0.31, IM.black]], [0.7, 0.6], { ammo50: [6, 12, 0.5], spore: [3, 6, 0.6], deagle: 0.1 }, 1.1);
	locker(b, 'Шкаф с документами', -hx + 0.37, 1.7, Math.PI / 2, { zhivchik: [1, 2, 0.5], spore: [1, 3, 0.4] }, 1.0);
	b.container('Оружейный шкаф', -hx + 0.37, -0.4, Math.PI / 2, [
		[1.0, 1.9, 0.5, 0, 0.95, 0, IM.metal], [0.02, 1.8, 0.02, 0, 0.95, 0.26, IM.black], [0.05, 0.05, 0.04, 0.1, 1.0, 0.27, IM.black],
	], [1.0, 0.5], { aug: 0.15, g36: 0.15, ammo556: [15, 30, 0.6], grenade: 0.15 }, 1.9);
	// на крыше — спутниковая тарелка на треноге и штыревые антенны
	const y = H + 0.2;
	for (const a of [0, 2.1, 4.2]) b.top_(place(box(0.05, 0.9, 0.05), -3.4 + Math.sin(a) * 0.3, y + 0.42, -1.2 + Math.cos(a) * 0.3, 0, Math.cos(a) * 0.3, -Math.sin(a) * 0.3), IM.metal);
	b.top_(new THREE.CylinderGeometry(0.75, 0.1, 0.3, 14).rotateX(-0.9).translate(-3.4, y + 1.05, -1.25), IM.white);
	for (const [x, z] of [[4.4, 2.8], [4.4, -2.8]]) b.top_(place(box(0.04, 2.4, 0.04), x, y + 1.2, z), IM.black);
	wallAC(b, 'back', 0);
	return done(b);
}

// ---------- КПП у ворот: модуль 4,5×3,5, окно на дорогу, стол дежурного ----------
function extGate(ctx, P, { cx, cz, ry }) {
	const W = 4.5, D = 3.5, H = 2.8, hz = D / 2;
	const b = modBuilding(ctx, P, {
		name: 'ExtGate', cx, cz, ry, W, D, H, doors: { front: [-1.2] }, dw: 1.0,
		windows: [['front', 1.15, { y: 1.6 }], ['left', 0, { y: 1.6 }], ['right', 0, { y: 1.6 }], ['back', 0.6, { y: 1.6 }]],
		ac: [[0.8, 0]], label: '05 · КПП', signAt: 0.9, // табличка над окном
	});
	b.container('Стол дежурного', 0.4, hz - 0.45, Math.PI, [
		[1.4, 0.75, 0.7, 0, 0.375, 0, b.IM.furniture], [0.45, 0.32, 0.05, -0.3, 0.92, 0.15, b.IM.black], [0.4, 0.26, 0.02, -0.3, 0.94, 0.12, b.IM.screen], [0.3, 0.1, 0.25, 0.35, 0.8, 0, b.IM.machine],
	], [1.4, 0.7], { ammo919: [6, 12, 0.6], zhivchik: 0.3, ammo556: [5, 10, 0.3] }, 0.95);
	chair(b, 1.0, 0.45, -0.3);
	return done(b);
}

// ---------- Изолятор: модуль 9×5,5 — две клетки для пойманных иммунных, стол охраны ----------
function extCells(ctx, P, { cx, cz, ry }) {
	const W = 9, D = 5.5, H = 2.8, hx = W / 2, hz = D / 2;
	const b = modBuilding(ctx, P, {
		name: 'ExtCells', cx, cz, ry, W, D, H, doors: { front: [-3.0] }, dw: 1.2,
		windows: [['front', 1.0, { y: 1.65, bars: true }], ['front', 3.2, { y: 1.65, bars: true }], ['back', -2.5, { bars: true }], ['back', 2.5, { bars: true }], ['left', 0, { bars: true }]],
		ac: [[-2.5, 0.5]], label: '04 · ИЗОЛЯТОР', signAt: 2.1,
	});
	const IM = b.IM;
	// клетки: решётка спереди и сбоку, перегородка между камерами; внутри — нары
	const x0 = 0.4, x1 = hx - 0.15, z0 = -0.4, z1 = hz - 0.15, bars = [];
	for (let x = x0; x <= x1 + 0.01; x += 0.2) bars.push([0.04, 2.3, 0.04, x, 1.15, z0, IM.metal]);
	for (let z = z0 + 0.2; z <= z1 + 0.01; z += 0.2) for (const x of [x0, (x0 + x1) / 2]) bars.push([0.04, 2.3, 0.04, x, 1.15, z, IM.metal]);
	for (const y of [0.06, 1.1, 2.28]) bars.push([x1 - x0, 0.05, 0.05, (x0 + x1) / 2, y, z0, IM.metal]);
	for (const y of [0.06, 2.28]) for (const x of [x0, (x0 + x1) / 2]) bars.push([0.05, 0.05, z1 - z0, x, y, (z0 + z1) / 2, IM.metal]);
	b.furniture(0, 0, 0, bars);
	b.collide((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 0.1, z1 - z0 + 0.1);
	for (const x of [x0 + 0.9, (x0 + x1) / 2 + 0.9]) b.furniture(x, z1 - 1.0, 0, [[0.75, 0.35, 1.8, 0, 0.18, 0, IM.metal], [0.72, 0.08, 1.7, 0, 0.39, 0, IM.blanketArmy]]);
	// стол охраны, стул, шкафчик
	table(b, -2.3, 1.5, 0, { w: 1.2, d: 0.7 });
	chair(b, -2.3, 0.85, 0);
	locker(b, 'Шкафчик охраны', -hx + 0.37, -0.6, Math.PI / 2, { ammo919: [6, 12, 0.5], zhivchik: 0.3 });
	return done(b);
}

// ---------- Двор: вышки, прожекторы, техника, укрытия ----------

/** Вертолёт на площадке (нос — к +X своих осей): фюзеляж, остекление, балка, киль, винты, полозья. */
function helicopter(kb, M, x, z, ry) {
	const F = frame(x, 0, z, ry);
	const put = (g, mat, m) => { g.applyMatrix4(m).applyMatrix4(F); kb.add(g, mat); };
	put(cylX(1.12, 1.12, 5.0, 10).scale(1, 0.92, 1), M.khaki, frame(0.3, 1.55, 0));
	put(new THREE.SphereGeometry(1.12, 12, 8).scale(1.5, 0.86, 1), M.khaki, frame(2.8, 1.5, 0));
	put(new THREE.SphereGeometry(1.15, 12, 6, Math.PI - 0.95, 1.9, 0.25, 1.15).scale(1.5, 0.86, 1), M.glass, frame(2.8, 1.5, 0));
	put(new THREE.SphereGeometry(1.12, 10, 6).scale(1.2, 0.9, 1), M.khaki, frame(-2.2, 1.6, 0));
	put(cylX(0.26, 0.52, 6.2, 8), M.khaki, frame(-5.3, 1.95, 0));
	put(box(1.3, 1.9, 0.14), M.khaki, frame(-8.2, 2.75, 0, 0, 0, 0.35)); // киль
	put(box(0.7, 0.06, 2.2), M.khaki, frame(-7.4, 1.95, 0)); // стабилизатор
	for (const a of [0.6, 0.6 + Math.PI / 2]) put(box(0.12, 1.8, 0.03), M.metalDark, frame(-8.5, 3.0, 0.2, 0, 0, a)); // рулевой винт
	put(box(2.6, 0.7, 1.4), M.khaki, frame(0.1, 2.7, 0)); // двигатели
	for (const s of [-1, 1]) put(cylX(0.2, 0.2, 0.6, 8), M.metalDark, frame(-1.3, 2.75, s * 0.55));
	put(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8), M.metalDark, frame(0.4, 3.3, 0));
	put(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), M.metalDark, frame(0.4, 3.62, 0));
	for (let k = 0; k < 4; k++) put(box(5.6, 0.05, 0.4).translate(2.95, 0, 0), M.metalDark, frame(0.4, 3.66, 0, 0.35 + k * Math.PI / 2));
	for (const s of [-1, 1]) {
		put(box(1.5, 1.2, 0.04), M.metalDark, frame(0.2, 1.45, s * 1.1)); // сдвижная дверь
		for (const wx of [-1.2, 1.6]) put(box(0.5, 0.4, 0.04), M.glass, frame(wx, 1.9, s * 1.08));
		put(cylX(0.07, 0.07, 4.8, 6), M.metalDark, frame(0.4, 0.1, s * 1.25)); // полоз
		for (const lx of [-0.9, 1.7]) put(box(0.08, 0.95, 0.08), M.metalDark, frame(lx, 0.55, s * 1.12, 0, -s * 0.25, 0));
	}
}

export default {
	id: 'forpost',
	seed: 2077,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const P = forpostMaterials();
		const add = (g, mat, ...mats) => { for (const m of mats) g.applyMatrix4(m); batch.add(g, mat); };

		// ---------- Покрытие: вокруг — расчищенная полоса, двор засыпан щебнем, дороги — бетонные плиты ----------
		ground(2 * FX + 22, FS - FN + 22, 0, (FS + FN) / 2, M.dirt, 6, 0.012);
		ground(2 * FX, FS - FN, 0, (FS + FN) / 2, M.ballast, 5, 0.014);
		ground(8, 66 - FS + 1, 0, (FS - 1 + 66) / 2, M.asphalt, 4, 0.016); // от ворот на юг, к выходу
		for (let i = 0; i < 6; i++) ground(R(3, 6), R(2, 4), R(-30, 30), R(-34, 22), M.concreteDark, 3, 0.0145 + i * 0.0004); // заплатки, пятна на щебне
		let lay = 0.0175;
		for (const [w, d, x, z] of [
			[7, FS + 16, 0, (FS - 16) / 2], // от ворот на север
			[66, 6, 0, -19], // поперёк двора: от казармы к складу
			[20, 2.6, -19, -26.3], [18, 3, 19, -23.5], // перед казармой и складом
			[14, 4, 10, -1], [5, 12, 19.5, -3], // к штабу
			[22, 10, -21, 17.5], // автопарк
			[10, 3, 19, 12.8], // перед изолятором
			[6, 5, -31, -20.8], // генераторы
		]) { ground(w, d, x, z, M.concrete, 4, lay); lay += 0.0006; }
		const onRoad = (x, z, m = 0) => (Math.abs(x) < 4 + m && z > FS - 2 - m) || (Math.abs(x) < FX + m && z > FN - m && z < FS + m);

		// ---------- Периметр: Т-стены с колючей спиралью, ворота ----------
		const twall = (kb, x0, z0, x1, z1) => {
			const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(len / 1.5)), sl = len / n;
			for (let i = 0; i < n; i++) {
				const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, mat = rnd() < 0.2 ? M.concreteDark : M.concrete;
				kb.add(place(box(sl - 0.05, TW_H - 0.45, 0.32, 1.5), x, 0.45 + (TW_H - 0.45) / 2, z, -ang), mat);
				kb.add(place(box(sl - 0.05, 0.45, 1.3, 1.5), x, 0.225, z, -ang), mat);
			}
			collide((x0 + x1) / 2, (z0 + z1) / 2, len, 1.3, -ang);
		};
		const wires = [];
		for (const s of [[-FX, FN, FX, FN], [-FX, FN, -FX, FS], [FX, FN, FX, FS]]) { twall(batch, ...s); wires.push(s); }
		// южная стена — с камеры она перед героем: становится прозрачной, когда загораживает его
		for (const [x0, x1] of [[-FX, -GATE], [GATE, FX]]) {
			occluder('ExtWallS', (kb) => twall(kb, x0, FS, x1, FS), { cx: (x0 + x1) / 2, cz: FS, ry: 0, hx: Math.abs(x1 - x0) / 2, hz: 0.8, top: TW_H }, 0.25);
			wires.push([x0, FS, x1, FS]);
		}
		// колючая спираль поверх стен — одним набором линий (один вызов отрисовки)
		{
			const pts = [], r = 0.3;
			for (const [x0, z0, x1, z1] of wires) {
				const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len, n = Math.ceil(len / 0.3) * 8;
				let prev = null;
				for (let k = 0; k <= n; k++) {
					const s = (k / n) * len, a = (k / 8) * Math.PI * 2;
					const p = new THREE.Vector3(x0 + dx * s - dz * Math.cos(a) * r, TW_H + 0.05 + r + Math.sin(a) * r, z0 + dz * s + dx * Math.cos(a) * r);
					if (prev) pts.push(prev, p);
					prev = p;
				}
			}
			root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a4844 })));
		}
		// столбы ворот, шлагбаум (поднят), предупреждение на дороге
		for (const s of [-1, 1]) {
			batch.add(place(box(0.9, TW_H + 0.5, 1.5, 1.5), s * (GATE + 0.45), (TW_H + 0.5) / 2, FS), M.concreteDark);
			collide(s * (GATE + 0.45), FS, 0.9, 1.5);
		}
		barrier(batch, M, collide, GATE + 0.5, FS + 1.3, Math.PI, 2 * GATE, true);
		billboard(batch, M, root, collide, 11, FS + 3.2, 0, 'СТОЙ! ЗАПРЕТНАЯ ЗОНА — ОГОНЬ БЕЗ ПРЕДУПРЕЖДЕНИЯ', { w: 5.6, h: 1.1, y: 1.9, bg: '#e8e4d4', fg: '#b01e14' });

		// ---------- Габионы, блоки, мешки — укрытия ----------
		const hesco = (x, z, n, ry = 0, h = 1.15) => {
			const len = n * 1.05;
			batch.add(place(box(len, h, 1.05, 1.05, h), x, h / 2, z, ry), P.hesco);
			collide(x, z, len, 1.05, ry);
		};
		const block = (x, z, r) => {
			beginProp('block', x, z, r);
			batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark);
			endProp();
			collide(x, z, 1.8, 0.9, r);
		};
		const Z = Math.PI / 2; // габионы вдоль оси z
		for (const [x, z, n, r] of [
			[-6, 33.5, 6, 0], [6, 38, 6, 0], // змейка перед воротами
			[17.2, -1, 5, Z], // перед штабом
			[-6.5, -3, 3, Z], [4, -9, 3, 0], [10, 4, 4, 0], [-11, 11, 3, 0], [29, -14, 3, Z], // двор
			[19, -21, 4, 0], [-19, -22, 4, 0], // перед складом и казармой
			[-31.5, -14.6, 5, 0], [-31.5, -8.4, 5, 0], [-34.6, -11.5, 5, Z], // обвалование топлива
		]) hesco(x, z, n, r);
		for (const [x, z, r] of [[-2.6, 21.5, 0], [2.6, 21.5, 0], [-12, -12, 0.2], [14, 8.5, -0.3], [0, -26, 0], [-4.3, 2, 1.4], [6, 12, 0.1], [26, 10, 0.3], [-27, 4, 1.5], [24, -18, 0.2]]) block(x, z, r);
		sandbags(batch, M, collide, -8, 24.8, 5, 0);
		sandbags(batch, M, collide, 6.2, 21.2, 3, Z);

		// ---------- Угловые вышки: стальные опоры, кабина из панелей со стёклами, прожектор к двору ----------
		const lamp = (x, y, z, ry, tilt = -0.45) => {
			const L = frame(x, y, z, ry, 0, tilt);
			batch.add(box(0.3, 0.36, 0.46).applyMatrix4(L), M.metalDark);
			batch.add(box(0.02, 0.28, 0.38).translate(0.16, 0, 0).applyMatrix4(L), P.lamp, { cast: false });
		};
		const tower = (x, z, face) => {
			const sf = Math.sin(face), cf = Math.cos(face);
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.2, 4.5, 0.2), x + dx, 2.25, z + dz), M.metalDark);
			for (const [ox, oz, r] of [[0, -1, 0], [0, 1, 0], [-1, 0, Z], [1, 0, Z]]) for (const y of [1.1, 3.3]) for (const s of [-1, 1]) {
				batch.add(place(box(2.95, 0.07, 0.07), x + ox, y, z + oz, r, 0, s * 0.83), M.metalDark);
			}
			batch.add(place(box(2.8, 0.16, 2.8), x, 4.5, z), M.metalDark);
			for (const [ox, oz, r] of [[0, -1.36, 0], [0, 1.36, 0], [-1.36, 0, Z], [1.36, 0, Z]]) {
				batch.add(place(box(2.8, 1.0, 0.08, 1.2), x + ox, 5.08, z + oz, r), P.panel);
				batch.add(place(box(2.6, 0.9, 0.03), x + ox * 1.01, 6.08, z + oz * 1.01, r), M.glass);
			}
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.1, 1.2, 0.1), x + dx * 1.35, 6.18, z + dz * 1.35), M.metalDark);
			batch.add(place(box(3.2, 0.16, 3.2, 2), x, 6.86, z), M.concrete);
			lamp(x + sf * 1.45, 7.12, z + cf * 1.45, face - Math.PI / 2);
			// лестница со стороны двора
			for (const s of [-1, 1]) batch.add(place(box(0.06, 4.5, 0.06), x + sf * 1.22 + cf * s * 0.25, 2.25, z + cf * 1.22 - sf * s * 0.25), M.metalDark);
			for (let y = 0.4; y < 4.4; y += 0.4) batch.add(place(box(0.5, 0.04, 0.04), x + sf * 1.22, y, z + cf * 1.22, face), M.metalDark);
			collide(x, z, 2.4, 2.4);
		};
		const TX = FX - 3.5, TN = FN + 3.5, TS = FS - 3.5;
		tower(-TX, TN, 0.8); tower(TX, TN, -0.8); tower(-TX, TS, 2.35); tower(TX, TS, -2.35);

		// передвижные прожекторные мачты: прицеп с генератором, мачта, четыре прожектора
		const lightTower = (x, z, ry) => {
			const F = frame(x, 0, z, ry), c = Math.cos(ry), s = Math.sin(ry);
			add(box(2.8, 0.6, 1.4, 1.4), M.yellow, frame(0, 0.75, 0), F);
			add(box(1.4, 0.8, 1.3, 1.4), M.yellow, frame(-0.6, 1.45, 0), F);
			for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12).rotateX(Z), M.tire, frame(0.3, 0.34, sz * 0.8), F);
			for (const [lx, lz] of [[-1.4, -0.9], [-1.4, 0.9], [1.4, -0.9], [1.4, 0.9]]) add(box(0.12, 0.6, 0.12), M.metalDark, frame(lx, 0.3, lz), F);
			// мачта опущена до 6 м: выше она с игровой камеры заслоняет полэкрана
			add(box(0.16, 4.9, 0.16), M.metalDark, frame(0.9, 3.5, 0), F);
			add(box(0.1, 0.1, 1.5), M.metalDark, frame(0.9, 5.95, 0), F);
			for (const y of [5.75, 6.2]) for (const lz of [-0.42, 0.42]) lamp(x + 0.95 * c + lz * s, y, z - 0.95 * s + lz * c, ry, -0.5);
			collide(x, z, 3.0, 1.8, ry);
		};
		lightTower(9.5, -9, -2.38); // прожекторы — к середине двора
		lightTower(-6, 13.6, 1.16);

		// ---------- Постройки ----------
		buildings.push(
			extBarracks(bctx, P, { cx: -19, cz: -31, ry: Math.PI }),
			extStorage(bctx, P, { cx: 19, cz: -30, ry: Math.PI }),
			extCommand(bctx, P, { cx: 25, cz: -3, ry: Z }),
			extGate(bctx, P, { cx: 9.5, cz: 23.5, ry: Z }),
			extCells(bctx, P, { cx: 19, cz: 17, ry: 0 }),
		);

		// ---------- Вертолётная площадка: бетонный круг, кольцо и «H», огни по краю; на ней вертолёт ----------
		const pad = { x: -17, z: 0, r: 7.5 };
		batch.add(place(new THREE.CylinderGeometry(pad.r, pad.r + 0.15, 0.08, 40), pad.x, 0.04, pad.z), M.concrete, { cast: false });
		batch.add(place(new THREE.RingGeometry(6.3, 6.75, 48).rotateX(-Z), pad.x, 0.083, pad.z), M.white, { cast: false });
		for (const [w, d, dx] of [[0.75, 4.4, -1.45], [0.75, 4.4, 1.45], [2.15, 0.75, 0]]) batch.add(place(box(w, 0.01, d), pad.x + dx, 0.083, pad.z), M.white, { cast: false });
		for (let i = 0; i < 12; i++) {
			const a = (i / 12) * Math.PI * 2;
			batch.add(place(box(0.2, 0.12, 0.2), pad.x + Math.cos(a) * 7.25, 0.1, pad.z + Math.sin(a) * 7.25), M.yellow);
		}
		{
			const hx = pad.x + 0.6, hz = pad.z - 0.4, hry = 0.5, c = Math.cos(hry), s = Math.sin(hry);
			const at = (lx) => [hx + lx * c, hz - lx * s];
			occluder('Helicopter', (kb) => helicopter(kb, M, hx, hz, hry), { cx: at(-1.8)[0], cz: at(-1.8)[1], ry: hry, hx: 6.8, hz: 2.2, top: 3.9 }, 0.25); // рамка — по фюзеляжу (на плане локации — силуэт)
			collide(...at(0.5), 8.0, 2.7, hry);
			collide(...at(-6.05), 5.1, 0.9, hry);
		}
		// конус-ветроуказатель у площадки
		{
			const wx = -26, wz = -7.5;
			batch.add(place(box(0.08, 4.2, 0.08), wx, 2.1, wz), M.metalDark);
			const F = frame(wx, 3.95, wz, 0.8, 0, -0.25);
			for (let i = 0; i < 4; i++) add(cylX(0.3 - i * 0.05, 0.25 - i * 0.05, 0.5, 10).translate(0.3 + i * 0.5, 0, 0), i % 2 ? M.white : M.red, F);
			collide(wx, wz, 0.3, 0.3);
		}

		// ---------- Автопарк: БТР, два «Урала», УАЗ — носами к двору ----------
		btr(batch, M, root, collide, -28.5, 17, 0);
		armyTruck(batch, M, root, collide, -23, 17.5, 0);
		armyTruck(batch, M, root, collide, -18, 17.5, 0);
		addCar(batch, M, root, -13, 18, -Z, 0x4a5a3a, { model: 'e_uaz' });
		collide(-13, 18, 4.3, 1.9, -Z);

		// ---------- Хозяйство: генераторы, топливо за габионами, кабели, контейнеры, мачта связи, радар ----------
		const genset = (x, z, ry) => {
			const F = frame(x, 0, z, ry);
			add(box(3.5, 0.15, 1.6), M.metalDark, frame(0, 0.075, 0), F);
			add(box(3.4, 1.6, 1.5, 1.5), M.metalOlive, frame(0, 0.95, 0), F);
			add(box(0.05, 1.1, 1.1), M.metalDark, frame(1.73, 1.0, 0), F);
			add(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8), M.metalDark, frame(-1.1, 2.2, 0.4), F);
			add(box(0.5, 0.6, 0.05), M.metalDark, frame(-0.6, 1.1, 0.78), F);
			collide(x, z, 3.6, 1.7, ry);
		};
		genset(-32, -22.5, 0);
		genset(-32, -19, 0);
		// кабели по земле от генераторов к казарме
		for (const [x0, z0, x1, z1] of [[-30.2, -22.3, -27.4, -24.2], [-27.4, -24.2, -27.4, -27.4], [-30.2, -19.2, -26.5, -19.6], [-26.5, -19.6, -13, -26.6]]) {
			const len = Math.hypot(x1 - x0, z1 - z0);
			batch.add(place(box(len, 0.04, 0.05), (x0 + x1) / 2, 0.03, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0)), M.metalDark, { cast: false });
		}
		// мягкий резервуар с топливом в обваловании, две цистерны на ложементах
		add(new THREE.SphereGeometry(1, 14, 8).scale(2.3, 0.42, 1.5), M.tankBlack, frame(-31.3, 0.4, -11.5));
		collide(-31.3, -11.5, 4.6, 3.0);
		const fuelTank = (x, z, ry) => {
			const F = frame(x, 0, z, ry);
			add(cylX(0.85, 0.85, 4.4, 16), M.khaki, frame(0, 1.15, 0), F);
			for (const lx of [-1.4, 1.4]) add(box(0.3, 0.6, 1.5), M.metalDark, frame(lx, 0.3, 0), F);
			add(box(0.5, 0.25, 0.5), M.metalDark, frame(0.6, 2.05, 0), F);
			collide(x, z, 4.5, 1.8, ry);
		};
		fuelTank(-34.5, -2.5, Z);
		fuelTank(-34.5, 2.5, Z);
		// морские контейнеры: у восточной стены (третий — сверху) и на площадке за складом
		const container = (x, z, ry, paint, y = 0) => {
			const F = frame(x, y, z, ry);
			add(box(6.06, 2.59, 2.44, 3, 1.5), paint, frame(0, 1.3, 0), F);
			add(box(0.05, 2.35, 2.2), M.metalDark, frame(3.04, 1.3, 0), F);
			if (y === 0) collide(x, z, 6.1, 2.5, ry);
		};
		container(34, -18.5, Z, M.metalOlive);
		container(34, -12, Z, M.tankWhite);
		container(34, -15.25, Z, M.roofGreen, 2.6);
		container(4.5, -33.8, 0, M.tankWhite);
		container(4.5, -30.9, 0, M.metalOlive);
		container(4.5, -32.35, 0.04, M.metalOlive, 2.6);
		// мачта связи: решётчатая, с площадками, штырём и красным огнём
		{
			const mx = 31.5, mz = 5, h = 10;
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.07, h, 0.07), mx + dx * 0.3, h / 2, mz + dz * 0.3), M.metalDark);
			for (let y = 1.2; y < h; y += 1.5) batch.add(place(box(0.66, 0.04, 0.66), mx, y, mz), M.metalDark);
			batch.add(place(box(0.05, 2.4, 0.05), mx, h + 1.2, mz), M.metalDark);
			for (const y of [h - 0.6, h - 1.8]) batch.add(place(box(1.6, 0.05, 0.05), mx, y, mz, 0.6), M.metalDark);
			batch.add(place(box(0.18, 0.18, 0.18), mx, h + 2.45, mz), M.red);
			collide(mx, mz, 1.0, 1.0);
		}
		// радар на прицепе: антенна вращается (update)
		const radarHead = new THREE.Group();
		{
			const rx = 30.5, rz = 13.5, rry = Z, F = frame(rx, 0, rz, rry);
			add(box(3.2, 0.9, 1.9, 1.5), M.khaki, frame(0, 0.95, 0), F);
			add(box(1.2, 1.0, 1.6, 1.5), M.khaki, frame(-0.8, 1.9, 0), F);
			for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 12).rotateX(Z), M.tire, frame(0.4, 0.42, sz * 1.0), F);
			add(new THREE.CylinderGeometry(0.22, 0.3, 1.1, 10), M.metalDark, frame(0.7, 1.95, 0), F);
			collide(rx, rz, 3.3, 2.1, rry);
			const face = new THREE.Mesh(box(2.8, 1.1, 0.14), M.white);
			face.position.set(0, 0.6, 0.12);
			face.rotation.x = -0.35;
			const arm = new THREE.Mesh(box(0.16, 0.5, 0.16), M.metalDark);
			arm.position.set(0, 0.2, 0);
			radarHead.add(face, arm);
			radarHead.position.set(rx + 0.7 * Math.cos(rry), 2.5, rz - 0.7 * Math.sin(rry));
			root.add(radarHead);
		}

		// ---------- Быт: синие кабинки-туалеты у казармы, палатка у южной стены, ящики у склада ----------
		for (let i = 0; i < 3; i++) {
			const x = -8.3 + i * 1.25, z = -29.6;
			batch.add(place(box(1.15, 2.25, 1.15, 1), x, 1.125, z), P.blue);
			batch.add(place(box(1.25, 0.08, 1.25), x, 2.29, z), M.white);
			batch.add(place(box(0.7, 1.9, 0.02), x, 1.05, z + 0.585), M.white); // дверь
		}
		collide(-7.05, -29.6, 3.75, 1.2);
		{
			// палатка из тента: низкие стенки, двускатная крыша, конёк вдоль x
			const tx = 26.5, tz = 22.2, w = 5.2, d = 4.0, wh = 1.5, rise = 1.3;
			for (const s of [-1, 1]) {
				batch.add(place(box(w, wh, 0.06, 2), tx, wh / 2, tz + s * d / 2), M.canvas);
				const slope = Math.hypot(d / 2 + 0.15, rise);
				batch.add(place(box(w + 0.3, 0.05, slope, 2), tx, wh + rise / 2, tz + s * (d / 2 + 0.15) / 2, 0, s * Math.atan2(rise, d / 2 + 0.15)), M.canvas);
			}
			const gable = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(d / 2, wh), new THREE.Vector2(0, wh + rise), new THREE.Vector2(-d / 2, wh)]);
			for (const s of [-1, 1]) batch.add(new THREE.ShapeGeometry(gable).rotateY(s * Z).translate(tx + s * w / 2, 0, tz), M.canvas);
			batch.add(place(box(1.2, 1.9, 0.02), tx + w / 2 + 0.02, 0.95, tz, Z), M.metalDark); // вход
			collide(tx, tz, w + 0.2, d + 0.2);
		}
		for (const [x, z, r] of [[12.2, -22.4, 0.1], [11.4, -21.2, -0.25]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(0.9, 0.6, 0.6), x, 0.3, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 0.9, z, r + 0.08), M.metalOlive);
			endProp();
			collide(x, z, 1.0, 0.8, r);
		}

		// ---------- За периметром: сожжённые машины тех, кто подъехал слишком близко ----------
		for (const [x, z, r] of [[-21, 46, 0.4], [25, 52, -1.2]]) {
			addCar(batch, M, root, x, z, r, 0x5a5a52, { burned: true });
			collide(x, z, 4.3, 1.9, r);
		}

		return {
			start: [0, 58, Math.PI],
			exits: [{ to: null, x0: -4, x1: 4, z0: 61.2, z1: 66, spawn: [0, 58, Math.PI], sign: [5.5, 60, 'Выход ↓'] }],
			groups: [],
			onRoad,
			// посты часовых: [x, z, куда смотрит]; первые восемь заняты всегда (ворота, вышки, охрана командира),
			// остальные — как выпадет: за габионами и блоками, у казармы, склада, техники; казарма — откуда выходит смена
			posts: [
				[-3, 26.0, 0], [3, 26.0, 0], [-31, -33, 0.8], [31, -33, -0.8], [-31.5, 22, 2.4], [31.5, 22, -2.4],
				[19.0, -4.8, -2.0], [19.0, 2.8, -1.1],
				[-15, -24.5, 0.3], [-24, -25, -0.3], [14.5, -23, 0.3], [23.5, -23, -0.3], [-5.2, -3, -Math.PI / 2], [4, -10.6, 0], [10, 2.4, 0],
				[-11, 9.4, 0], [-27.5, -6, 1.2], [-27.5, -17, 1.0], [30.5, -25, -0.5], [27.5, 8, -1.0], [13, 12.5, 0.4], [-6, 22.5, 0.2],
			],
			fixedPosts: 8,
			// командир — у двери штаба (дверь на запад, к двору), за габионами, лицом к двору
			bossPost: [20.2, -1, -Math.PI / 2],
			// патрули по двое: западная половина (казарма — площадка — автопарк) и восточная (склад — контейнеры — радар)
			patrols: [
				[[-24, -21], [-27, 9.5], [-8, 10], [-8, -17]],
				[[8, -17], [28, -22], [30, 8], [11, 9.5]],
			],
			barracksDoor: { x: -19, z: -25.9 },
			barrels: 3,
			clutter: 3,
			blood: 0,
			litter: 4,
			grime: 16,
			rubble: 8,
			puddles: 6,
			puddle: () => [R(-32, 32), R(-36, 24)],
			grass: 0.5,
			beltTrees: ['pine', 'pine', 'birch'],
			trees(tryTree) {
				// деревья — только за расчищенной полосой вокруг стен и не на дороге
				for (let i = 0; i < 70; i++) {
					const x = R(-62, 62), z = R(-62, 62);
					if (Math.abs(x) < FX + 10 && z > FN - 10 && z < FS + 10) continue;
					if (Math.abs(x) < 7 && z > FS) continue;
					tryTree(x, z, rnd() < 0.6 ? 'pine' : 'birch');
				}
			},
			hint: (b) => ({
				ExtBarracks: 'Казарма внешников — шкафчики у коек',
				ExtStorage: 'Склад внешников — стеллажи, оружейные ящики и кейсы',
				ExtCommand: 'Штаб внешников — сейф и шкафы командира',
				ExtGate: 'КПП внешников — стол дежурного',
				ExtCells: 'Изолятор — клетки для пойманных иммунных',
			}[b.name] ?? null),
			update(dt, t) {
				radarHead.rotation.y = t * 1.2;
			},
		};
	},
};
