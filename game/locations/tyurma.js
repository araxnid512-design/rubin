// Кластер «Тюрьма»: исправительная колония ИК-17, которую Улей забрал целиком — с бараками, промзоной и оружейной
// охраны. Периметр — бетонная стена 4,6 м с колючей спиралью, по углам и посередине стен — вышки с прожекторами;
// изнутри вдоль стены — запретная полоса (песок) и сетка-рабица с колючкой, местами повалена. На юге — ворота-шлюз
// (две пары ворот, над проездом — мостик досмотра) и КПП в линии стены; за воротами — стоянка и посёлок сотрудников.
// Внутри три зоны:
//  - административная (юг, у стены): административный корпус (дежурная часть, оперчасть, кабинет начальника с сейфом,
//    спецчасть), оружейная охраны — самые ценные тайники, гараж с автозаком, вольеры кинологов;
//  - жилая (середина): плац с трибуной и флагштоком, три барака-общежития в своих локальных участках («локалках»)
//    с решётчатыми заборами и калитками, столовая, клуб, баня, медчасть, ШИЗО с прогулочными двориками за своим забором;
//  - промзона (север, за бетонной стеной): швейный цех, склад, котельная с трубой, пилорама; хозяйственные ворота на
//    север пробиты грузовиком.
// Снаружи: дорога вокруг колонии к трём выходам (север — Шахта, запад — Микрорайон, юг — Порт), пролом в западной
// стене, лес на востоке и старое кладбище. Опасность 3 — логово руберов: толпы в бараках и на плацу, рубер в промзоне
// и у ШИЗО, топтуны стаями. Узкие проходы — между локалками, вдоль запретки, за ШИЗО.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, buildCheckpoint, buildWarehouse, buildHouse, table, chair } from '../buildings.js';
import { boxTop, hash01 } from '../facade.js';
import { addCar, bus, bench, garden, woodpile, outhouse, fencePlot, blob, markingMaterial } from '../props.js';
import { chimney, pipeRack, pipePile, hazardBarrels, armyTruck, sandbags, billboard } from '../props-industrial.js';

const Z = Math.PI / 2;
const ONE = new THREE.Vector3(1, 1, 1);
/** Основная стена колонии: x от WX0 до WX1, z от WZ0 (север) до WZ1 (юг); высота и толщина. */
const WX0 = -58, WX1 = 64, WZ0 = -66, WZ1 = 40, WALL_H = 4.6, WALL_T = 0.45;
/** Сетка запретной полосы — в 5,3 м от стены (с юга её нет: там административная зона у самой стены). */
const IX0 = WX0 + 5.3, IX1 = WX1 - 5.3, IZ0 = WZ0 + 5.3;
/** Стена промзоны (z = PZ) и забор административной зоны (z = AZ). */
const PZ = -36, AZ = 18;
/** Хозяйственные ворота промзоны в северной стене: середина и полуширина. */
const PG = 22, PGW = 4;
/** Полуширина проезда ворот-шлюза (юг, x = 0); шлюз — от внутренних ворот (z = SZ) до внешних (стена). */
const SG = 4.75, SZ = 31;

/** Матрица: сдвиг и поворот (Эйлер XYZ: сначала rz, потом ry, потом rx). */
const frame = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), ONE);
/** Цилиндр вдоль оси X. */
const cylX = (r0, r1, len, seg = 12) => new THREE.CylinderGeometry(r0, r1, len, seg).rotateZ(Z);

/** Плоскость w×h (лицом к +Z) с UV в метрах: текстура повторяется каждые s м. */
function panel(w, h, s = 1) {
	const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * h / s);
	return g;
}

/** Сплошные куски линии длиной len без проёмов gaps ([от, до] в метрах от начала). */
function solidParts(len, gaps) {
	const out = [];
	let cur = 0;
	for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
		if (a > cur + 0.05) out.push([cur, Math.min(a, len)]);
		cur = Math.max(cur, b);
	}
	if (len > cur + 0.05) out.push([cur, len]);
	return out;
}

/** Треугольник фронтона в плоскости x = const лицом в sx (±1): основание от za до zb на высоте y0, вершина выше на rise. */
function gableTri(x, za, zb, y0, rise, sx) {
	const a = [x, y0, za], c = [x, y0, zb], tp = [x, y0 + rise, (za + zb) / 2], d = Math.abs(zb - za);
	const tri = new THREE.BufferGeometry();
	tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...a, ...tp, ...c] : [...a, ...c, ...tp]), 3));
	tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, d / 3, rise / 1.5, d / 1.5, 0] : [0, 0, d / 1.5, 0, d / 3, rise / 1.5]), 2));
	tri.computeVertexNormals();
	return tri;
}

/** Свои материалы колонии (по одному на локацию — для слияния): решётка локалок, сетка-рабица, свет прожекторов. */
function prisonMaterials() {
	const tex = (draw) => {
		const c = document.createElement('canvas');
		c.width = c.height = 128;
		draw(c.getContext('2d'));
		const t = new THREE.CanvasTexture(c);
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 4;
		return t;
	};
	// прорези — по альфе: забор из нескольких плоскостей вместо сотен прутьев
	const cut = (name, map) => new THREE.MeshStandardMaterial({ name, map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.45 });
	return {
		// решётка: четыре прута на повтор и поперечина, тёмно-зелёная краска
		bars: cut('prisonBars', tex((g) => {
			g.fillStyle = '#46524a';
			for (let x = 0; x < 128; x += 32) g.fillRect(x + 12, 0, 8, 128);
			g.fillRect(0, 58, 128, 9);
		})),
		// оцинкованная сетка-рабица: ромбы
		mesh: cut('prisonMesh', tex((g) => {
			g.strokeStyle = '#9a9c96';
			g.lineWidth = 6;
			for (let k = -128; k <= 128; k += 32) {
				g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 128, 128); g.stroke();
				g.beginPath(); g.moveTo(k, 128); g.lineTo(k + 128, 0); g.stroke();
			}
		})),
		// прожекторы на вышках светятся (без освещения, ярче белого)
		lamp: new THREE.MeshBasicMaterial({ name: 'prisonLamp', color: new THREE.Color(1.8, 1.6, 1.25), toneMapped: false }),
	};
}

// ---------- Мебель и тайники ----------

/** Двухъярусная шконка. */
function bunk(b, x, z, rot) {
	const { metal, blanketArmy, linen } = b.IM, parts = [];
	for (const y of [0.42, 1.35]) parts.push([0.85, 0.06, 1.95, 0, y, 0, metal], [0.82, 0.1, 1.8, 0, y + 0.08, 0.05, blanketArmy], [0.6, 0.1, 0.32, 0, y + 0.16, -0.75, linen]);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([0.05, 1.75, 0.05, sx * 0.4, 0.875, sz * 0.95, metal]);
	b.furniture(x, z, rot, parts, { solid: [0.9, 2.0], prop: 'bunk' });
}

/** Тумбочка у шконки (тайник); лицо — в +Z своих осей. */
const tumba = (b, x, z, rot, loot) => b.container('Тумбочка', x, z, rot, [
	[0.5, 0.65, 0.45, 0, 0.33, 0, b.IM.furnitureLight], [0.44, 0.02, 0.02, 0, 0.5, 0.23, b.IM.black],
], [0.5, 0.45], loot, 0.65);

/** Шкаф с двумя дверцами (тайник). */
const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat],
	[0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
	[0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);

/** Металлический шкаф (тайник). */
const locker = (b, name, x, z, rot, loot, w = 0.9) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);

/** Сейф (тайник). */
const safe = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.7, 1.15, 0.6, 0, 0.575, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, 0.72, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, 0.72, 0.31, b.IM.black],
], [0.7, 0.6], loot, 1.15);

/** Пирамида с автоматами (тайник). */
const pyramid = (b, x, z, rot, loot) => b.container('Пирамида', x, z, rot, [
	[1.8, 0.1, 0.5, 0, 0.1, 0, b.IM.machine], [1.8, 0.08, 0.3, 0, 1.15, -0.05, b.IM.machine],
	[0.06, 1.3, 0.06, -0.86, 0.65, -0.18, b.IM.machine], [0.06, 1.3, 0.06, 0.86, 0.65, -0.18, b.IM.machine],
	...[-0.6, -0.2, 0.2, 0.6].map((dx) => [0.06, 1.0, 0.12, dx, 0.7, 0.02, b.IM.black]),
], [1.8, 0.5], loot, 1.3);

/** Длинный оружейный ящик с замками (тайник). */
const gunCrate = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.8, 0.5, 0.65, 0, 0.25, 0, b.IM.crateGreen], [1.82, 0.05, 0.67, 0, 0.52, 0, b.IM.machine],
	[0.1, 0.12, 0.03, -0.55, 0.4, 0.34, b.IM.black], [0.1, 0.12, 0.03, 0.55, 0.4, 0.34, b.IM.black],
	[1.6, 0.42, 0.6, 0.04, 0.76, 0, b.IM.crateGreen],
], [1.8, 0.65], loot, 1.0);

/** Табличка на стене здания. */
function plate(b, side, at, text, { t = 0.3, w = 2.2, y = b.H - 0.35, bg = '#2a2c26', fg = '#e8dcae' } = {}) {
	b.top_(b.onWall(new THREE.PlaneGeometry(w, 0.42).translate(0, y, 0.02), side, at, t), T.signMaterial(text, { bg, fg, w: 480, h: 92 }));
}

/** Двускатная крыша (конёк вдоль X) с фронтонами из end. */
function gableRoof(b, { rise, roof, end, ridge, t }) {
	const { W, D, H } = b, hx = W / 2, hz = D / 2, slope = Math.hypot(hz + 0.5, rise);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.8, 0.08, slope, 2), 0, H + rise / 2, s * (hz + 0.5) / 2, 0, s * Math.atan2(rise, hz + 0.5)), roof);
	for (const sx of [-1, 1]) b.top_(gableTri(sx * (hx + t / 2 + 0.01), -hz - t / 2, hz + t / 2, H, rise, sx), end);
	b.top_(place(boxTop(W + 0.84, 0.1, 0.26, 1), 0, H + rise + 0.04, 0), ridge);
}

/** Плоская крыша с парапетом. */
function flatRoof(b, wall) {
	const { W, D, H } = b;
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), b.ctx.M.roofTar);
	b.parapet(H + 0.25, wall, 0.3);
}

/** Крыльцо: ступень, козырёк на столбах, распахнутая дверь (side — стена, at — середина проёма). */
function porch(b, side, at, { t, w = 2.2, y = 2.5, mat, leaf, d = 1.2, posts = null }) {
	const M = b.ctx.M;
	b.canopy(side, at, { w, d, y, mat, posts, t });
	b.lower(b.onWall(boxTop(w - 0.3, 0.14, 0.7).translate(0, 0.07, 0.35), side, at, t), M.concrete);
	if (leaf) b.wallBox(side, at + 1.2, 1.1, 0.02, 2.05, 0.05, leaf, { t });
}

// ---------- Барак-общежитие отряда ----------

/**
 * Барак 26×9 м: спальное помещение со шконками в три ряда и тумбочками (тайники), комната ПВР (стол, телевизор,
 * стенд) и каптёрка со шкафом каптёрщика (тайник). Вход — посередине спальни в передней стене (−Z локально),
 * второй выход — напротив, в задней. loot — три тумбочки и шкаф каптёрщика.
 */
function barrack(ctx, { name, cx, cz, ry, num, wall, roof, loot }) {
	const W = 26, D = 9, H = 3.2, t = 0.3, hx = W / 2, hz = D / 2, door = -2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 2.0 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	const wo = { mat: wall, t, lining: IM.armyWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [door], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [door], side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	// перегородки: спальня | ПВР (спереди) и каптёрка (сзади)
	b.wall('z', 5, -hz + t / 2, hz - t / 2, { mat: IM.armyWall, t: 0.14, doors: [-2.2] });
	b.wall('x', 0.4, 5.07, hx - t / 2, { mat: IM.armyWall, t: 0.14, doors: [7.8] });
	for (const x of [-11, -7.6, 2.4, 9.4]) b.window('front', x, { t, sill: wall });
	for (const x of [-11, -7.6, 2.4, 7.0]) b.window('back', x, { t, sill: wall });
	b.window('left', 0, { t, sill: wall });
	b.window('right', -3.4, { t, sill: wall });
	gableRoof(b, { rise: 1.9, roof, end: wall, ridge: M.metalRust, t });
	b.chimney(-8, 1.6, H + 0.9, H + 2.7, 0.5, wall);
	b.chimney(8.6, -1.4, H + 1.0, H + 2.7, 0.5, wall);
	porch(b, 'front', door, { t, w: 2.4, y: 2.55, mat: M.metalRust, posts: M.metalDark, leaf: M.metalRust, d: 1.3 });
	porch(b, 'back', door, { t, w: 1.8, y: 2.4, mat: M.metalRust, leaf: M.metalRust, d: 0.9 });
	plate(b, 'front', door, `ОТРЯД № ${num}`, { t, w: 2.0, y: 2.95 });
	// спальня: шконки вдоль стен и рядом посередине, тумбочки между ними
	for (const x of [-11.6, -9.2, -6.8, -4.4, 0.4, 2.8]) { bunk(b, x, hz - t / 2 - 1.0, Math.PI); bunk(b, x, -hz + t / 2 + 1.0, 0); }
	for (const x of [-9.6, -5.6, 2.0]) bunk(b, x, 0, Z);
	tumba(b, -10.4, hz - t / 2 - 0.25, Math.PI, loot[0]);
	tumba(b, -5.6, -hz + t / 2 + 0.25, 0, loot[1]);
	tumba(b, 1.6, hz - t / 2 - 0.25, Math.PI, loot[2]);
	// ПВР: стол, табуреты, телевизор на тумбе, стенд «Наш отряд»
	table(b, 8.8, -2.3, 0, { w: 1.6, d: 0.8 });
	chair(b, 8.3, -1.5, Math.PI);
	chair(b, 9.3, -3.1, 0);
	b.furniture(12.4, -1.2, -Z, [[0.8, 0.75, 0.45, 0, 0.375, 0, IM.furniture], [0.62, 0.5, 0.5, 0, 1.0, -0.02, IM.black], [0.48, 0.38, 0.02, 0, 1.0, 0.235, IM.screen]], { solid: [0.8, 0.5], prop: 'tv' });
	b.furniture(9, 0.28, Math.PI, [[1.8, 1.0, 0.04, 0, 1.6, 0, IM.redBoard]]);
	// каптёрка: стеллаж с баулами и шкаф каптёрщика
	b.furniture(12.45, 2.4, -Z, [
		[2.4, 0.05, 0.6, 0, 0.4, 0, IM.rack], [2.4, 0.05, 0.6, 0, 1.2, 0, IM.rack], [2.4, 0.05, 0.6, 0, 1.9, 0, IM.rack],
		[0.05, 2.0, 0.6, -1.18, 1.0, 0, IM.rack], [0.05, 2.0, 0.6, 1.18, 1.0, 0, IM.rack],
		[0.7, 0.4, 0.45, -0.6, 0.62, 0, IM.rag], [0.6, 0.45, 0.45, 0.5, 0.64, 0, IM.blanketArmy], [0.8, 0.4, 0.45, 0, 1.42, 0, IM.rag], [0.6, 0.35, 0.4, -0.7, 2.1, 0, IM.blanketArmy],
	], { solid: [2.4, 0.6] });
	cabinet(b, 'Шкаф каптёрщика', 10.4, hz - t / 2 - 0.28, Math.PI, 1.1, 2.0, 0.55, loot[3], IM.furnitureLight);
	return b.finish();
}

// ---------- Столовая ----------

/**
 * Столовая 22×12 м: обеденный зал с длинными столами и лавками, раздача вдоль перегородки, кухня с плитами,
 * котлом, холодильником и шкафом повара (тайники). Вход — в передней стене, служебный — в задней (кухня).
 */
function canteen(ctx, { name, cx, cz, ry, loot }) {
	const W = 22, D = 12, H = 3.6, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.6 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-5], w: 1.8, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [7.5], side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 3, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [-3.6, 3.6] });
	for (const x of [-9, -1.5, 9.4]) b.window('front', x, { t, sill: M.whiteBrick });
	for (const x of [-9, -5, -1, 4.6, 9.6]) b.window('back', x, { t, sill: M.whiteBrick });
	for (const z of [-2.5, 2.5]) b.window('left', z, { t, sill: M.whiteBrick });
	b.window('right', 2.5, { t, sill: M.whiteBrick });
	flatRoof(b, M.whiteBrick);
	for (const [x, z] of [[-6, 2], [0, -2.5], [7, 2.5]]) b.vent(x, z, H + 0.25, M.silver, { h: 0.6, r: 0.16 });
	b.canopy('front', -5, { w: 3.0, d: 1.3, y: 2.7, mat: M.metalRust, posts: M.metalDark, t });
	b.lower(place(boxTop(2.6, 0.14, 0.7), -5, 0.07, -hz - t / 2 - 0.35), M.concrete);
	for (const s of [-1, 1]) b.wallBox('front', -5 + s * 1.45, 1.0, 0.02, 2.05, 0.05, M.metalRust, { t });
	porch(b, 'back', 7.5, { t, w: 1.8, y: 2.4, mat: M.metalRust, leaf: M.metalRust, d: 0.9 });
	plate(b, 'front', 3.5, 'СТОЛОВАЯ', { t, w: 3.2, y: 2.9 });
	// обеденный зал: столы с лавками в два столбца, миски
	const dining = (x, z) => b.furniture(x, z, 0, [
		[3.0, 0.06, 0.8, 0, 0.76, 0, IM.furnitureLight], [0.08, 0.73, 0.6, -1.3, 0.37, 0, IM.metal], [0.08, 0.73, 0.6, 1.3, 0.37, 0, IM.metal],
		[3.0, 0.05, 0.28, 0, 0.45, -0.66, IM.furnitureLight], [3.0, 0.05, 0.28, 0, 0.45, 0.66, IM.furnitureLight],
		[0.06, 0.43, 0.2, -1.3, 0.22, -0.66, IM.metal], [0.06, 0.43, 0.2, 1.3, 0.22, -0.66, IM.metal],
		[0.06, 0.43, 0.2, -1.3, 0.22, 0.66, IM.metal], [0.06, 0.43, 0.2, 1.3, 0.22, 0.66, IM.metal],
	], { solid: [3.0, 1.6] });
	for (const z of [-2.6, 0.6, 3.6]) for (const x of [-8.2, -1.3]) dining(x, z);
	b.furniture(0, 0, 0, [[0.2, 0.06, 0.2, -8.6, 0.82, -2.6, IM.metal], [0.2, 0.06, 0.2, -1.0, 0.82, 0.6, IM.metal], [0.2, 0.06, 0.2, -7.6, 0.82, 3.6, IM.metal], [0.2, 0.06, 0.2, -1.9, 0.82, 3.4, IM.metal]]);
	// раздача вдоль перегородки
	b.furniture(2.35, 0, Z, [[3.0, 0.95, 0.6, 0, 0.475, 0, IM.metal], [3.1, 0.04, 0.7, 0, 0.97, 0, M.silver]], { solid: [3.0, 0.6] });
	// кухня: плита с кастрюлями, котёл, холодильник и шкаф повара (тайники), разделочный стол
	b.furniture(5.2, hz - t / 2 - 0.5, Math.PI, [
		[2.4, 0.9, 0.95, 0, 0.45, 0, IM.metal], [2.3, 0.03, 0.9, 0, 0.915, 0, IM.black],
		[0, 0, 0, 0, 0, 0, IM.metal, { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.55, 14).translate(-0.6, 1.2, 0) }],
		[0, 0, 0, 0, 0, 0, IM.metal, { geo: new THREE.CylinderGeometry(0.36, 0.36, 0.45, 14).translate(0.6, 1.15, 0) }],
	], { solid: [2.4, 1.0] });
	b.furniture(9.6, hz - t / 2 - 0.6, Math.PI, [[1.6, 1.1, 1.1, 0, 0.55, 0, IM.metal], [0, 0, 0, 0, 0, 0, IM.metal, { geo: new THREE.CylinderGeometry(0.55, 0.5, 0.7, 16).translate(0, 1.45, 0) }]], { solid: [1.6, 1.2] });
	b.container('Холодильник', hx - t / 2 - 0.4, -2.4, -Z, [[1.0, 2.0, 0.75, 0, 1.0, 0, IM.white], [0.04, 0.5, 0.04, -0.4, 1.2, 0.39, IM.metal]], [1.0, 0.75], loot.fridge, 2.0);
	cabinet(b, 'Шкаф повара', 6.0, -hz + t / 2 + 0.28, 0, 1.2, 1.9, 0.55, loot.cook, IM.furnitureLight);
	table(b, 7.0, 0.6, 0, { w: 2.0, d: 0.9 });
	return b.finish();
}

// ---------- Клуб ----------

/** Клуб 12×9 м: сцена с занавесом и транспарантом, ряды скамеек, пианино, книжный шкаф библиотеки (тайник). */
function club(ctx, { name, cx, cz, ry, loot }) {
	const W = 12, D = 9, H = 3.8, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.6 });
	b.messKind = 'home';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	const wo = { mat: M.plaster, t, lining: IM.wallpaper[2] };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-3.6], w: 1.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [-2.6], side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [0, 2.4]) b.window('front', x, { t, sill: M.plaster });
	b.window('right', -1.5, { t, sill: M.plaster });
	flatRoof(b, M.plaster);
	b.canopy('front', -3.6, { w: 2.4, d: 1.2, y: 2.75, mat: M.metalRust, posts: M.metalDark, t });
	b.lower(place(boxTop(2.2, 0.14, 0.7), -3.6, 0.07, -hz - t / 2 - 0.35), M.concrete);
	for (const s of [-1, 1]) b.wallBox('front', -3.6 + s * 1.3, 0.9, 0.02, 2.05, 0.05, M.woodGreen, { t });
	b.wallBox('left', -2.6 + 1.2, 1.1, 0.02, 2.05, 0.05, M.woodGreen, { t });
	plate(b, 'front', 1.2, 'КЛУБ', { t, w: 2.4, y: 3.2, bg: '#7a1c14', fg: '#f0e0c0' });
	// сцена с занавесом и транспарантом
	b.furniture(0, hz - t / 2 - 1.3, 0, [[W - 1.0, 0.55, 2.6, 0, 0.275, 0, IM.furniture], [W - 1.0, 0.04, 0.1, 0, 0.56, -1.25, IM.black]], { solid: [W - 1.0, 2.6] });
	for (const s of [-1, 1]) b.furniture(s * 4.0, hz - t / 2 - 0.1, Math.PI, [[2.4, 2.9, 0.08, 0, 2.0, 0, IM.redBoard]]);
	b.furniture(0, hz - t / 2 - 0.05, Math.PI, [[3.2, 1.0, 0.03, 0, 2.6, 0, IM.paper]]);
	// ряды скамеек лицом к сцене, пианино у стены
	for (const z of [-2.6, -1.3, 0.0]) b.furniture(0.9, z, 0, [
		[6.6, 0.06, 0.4, 0, 0.45, 0, IM.furnitureLight], [6.6, 0.4, 0.05, 0, 0.72, -0.18, IM.furnitureLight],
		[0.06, 0.45, 0.35, -3.1, 0.22, 0, IM.metal], [0.06, 0.45, 0.35, 3.1, 0.22, 0, IM.metal], [0.06, 0.45, 0.35, 0, 0.22, 0, IM.metal],
	], { solid: [6.6, 0.45] });
	b.furniture(-5.3, 0.9, Z, [[1.4, 1.25, 0.6, 0, 0.62, 0, IM.black], [1.3, 0.05, 0.3, 0, 0.75, 0.4, IM.white]], { solid: [1.4, 0.65] });
	b.container('Шкаф библиотеки', 4.6, -hz + t / 2 + 0.2, 0, [
		[1.6, 2.0, 0.36, 0, 1.0, 0, IM.furniture],
		[1.5, 0.3, 0.3, 0, 0.5, 0.04, IM.books[0]], [1.5, 0.3, 0.3, 0, 1.0, 0.04, IM.books[1]], [1.5, 0.3, 0.3, 0, 1.5, 0.04, IM.books[2]],
	], [1.6, 0.36], loot, 2.0);
	return b.finish();
}

// ---------- Баня ----------

/** Баня 10×8 м: раздевалка с лавкой и шкафчиками (тайник), моечная с каменной лавкой, баком и душем. */
function bath(ctx, { name, cx, cz, ry, loot }) {
	const W = 10, D = 8, H = 3.0, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.lower(place(planeXZ(3.9, D - 0.7, 1), 2.9, 0.03, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-2.5], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 0.8, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [2.0] });
	b.window('front', 2.8, { t, sill: M.brick, y: 1.9 });
	b.window('right', 0, { t, sill: M.brick, y: 1.9 });
	flatRoof(b, M.brick);
	b.chimney(3.2, 2.4, H + 0.2, H + 2.0, 0.45, M.brick);
	porch(b, 'front', -2.5, { t, w: 1.8, y: 2.35, mat: M.metalRust, leaf: M.woodGreen, d: 1.0 });
	plate(b, 'front', -2.5, 'БАНЯ', { t, w: 1.6, y: 2.72 });
	// раздевалка: лавка с вешалкой, шкафчики
	b.furniture(-hx + t / 2 + 0.25, 0.4, Z, [[3.6, 0.06, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.45, 0.35, -1.6, 0.22, 0, IM.metal], [0.06, 0.45, 0.35, 1.6, 0.22, 0, IM.metal], [3.6, 0.06, 0.06, 0, 1.6, -0.15, IM.metal]], { solid: [3.6, 0.45] });
	b.container('Шкафчики', -2.2, hz - t / 2 - 0.26, Math.PI, [
		[2.4, 1.9, 0.5, 0, 0.95, 0, IM.locker], [0.02, 1.8, 0.02, -0.4, 0.95, 0.26, IM.black], [0.02, 1.8, 0.02, 0.4, 0.95, 0.26, IM.black],
		[0.2, 0.04, 0.02, -0.95, 1.7, 0.26, IM.black], [0.2, 0.04, 0.02, 0, 1.7, 0.26, IM.black], [0.2, 0.04, 0.02, 0.95, 1.7, 0.26, IM.black],
	], [2.4, 0.5], loot, 1.9);
	// моечная: каменная лавка с тазами, бак с водой, трубы душа
	b.furniture(2.9, -1.2, 0, [[2.6, 0.5, 0.7, 0, 0.25, 0, M.concreteDark], [0.4, 0.15, 0.4, -0.6, 0.57, 0, IM.metal], [0.4, 0.15, 0.4, 0.5, 0.57, 0.05, IM.metal]], { solid: [2.6, 0.7] });
	b.furniture(hx - t / 2 - 0.7, hz - t / 2 - 0.7, 0, [[0, 0, 0, 0, 0, 0, IM.metal, { geo: new THREE.CylinderGeometry(0.6, 0.6, 1.6, 14).translate(0, 0.8, 0) }]], { solid: [1.3, 1.3] });
	b.furniture(hx - t / 2 - 0.05, -2.6, -Z, [[2.2, 0.05, 0.05, 0, 2.1, 0, IM.metal], [0.05, 0.4, 0.05, -0.8, 1.9, 0.1, IM.metal], [0.05, 0.4, 0.05, 0.6, 1.9, 0.1, IM.metal]]);
	return b.finish();
}

// ---------- ШИЗО ----------

/**
 * ШИЗО 18×9 м из серого бетона: дежурка контролёра (стол — тайник, шкаф с изъятым — тайник), коридор вдоль фасада,
 * три камеры с откидными шконками; решётчатые двери камер распахнуты в коридор. Окна — узкие, под потолком, в решётках.
 */
function shizo(ctx, { name, cx, cz, ry, loot }) {
	const W = 18, D = 9, H = 3.0, t = 0.35, hx = W / 2, hz = D / 2, cor = -1.6;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-6.6], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	const cells = [-2.25, 2.25, 6.75];
	b.wall('z', -4.5, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.2, doors: [-3.0], w: 1.1 });
	b.wall('x', cor, -4.4, hx - t / 2, { mat: IM.whitewash, t: 0.2, doors: cells, w: 1.0 });
	for (const x of [0, 4.5]) b.wall('z', x, cor + 0.1, hz - t / 2, { mat: IM.whitewash, t: 0.2 });
	// узкие окна под потолком, в решётках
	const slot = (side, at) => {
		b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(0.9, 0.5), 1).translate(0, 2.25, 0.012), side, at, t), M.window);
		for (const k of [-0.3, 0, 0.3]) b.top_(b.onWall(box(0.04, 0.6, 0.04).translate(k, 2.25, 0.05), side, at, t), M.metalDark);
	};
	for (const x of cells) slot('back', x);
	slot('left', 0);
	slot('front', 4.5);
	flatRoof(b, M.concreteDark);
	b.vent(-6.5, 2, H + 0.25, M.silver, { h: 0.5, r: 0.12 });
	porch(b, 'front', -6.6, { t, w: 1.8, y: 2.4, mat: M.metalRust, leaf: M.metalRust, d: 1.0 });
	plate(b, 'front', -2.6, 'ШИЗО · ПКТ', { t, w: 2.6, y: 2.5 });
	// камеры: откидная шконка, бетонный стол с табуретом, чаша; дверь-решётка распахнута в коридор
	const leaf = [
		[0.95, 0.05, 0.05, -0.475, 0.08, 0, IM.metal], [0.95, 0.05, 0.05, -0.475, 2.0, 0, IM.metal], [0.95, 0.05, 0.05, -0.475, 1.0, 0, IM.metal],
		[0.05, 2.0, 0.05, -0.025, 1.04, 0, IM.metal], [0.05, 2.0, 0.05, -0.925, 1.04, 0, IM.metal],
		[0.03, 1.9, 0.03, -0.25, 1.04, 0, IM.metal], [0.03, 1.9, 0.03, -0.475, 1.04, 0, IM.metal], [0.03, 1.9, 0.03, -0.7, 1.04, 0, IM.metal],
	];
	for (const c of cells) {
		b.furniture(c, hz - t / 2 - 0.42, Math.PI, [
			[2.0, 0.07, 0.75, 0, 0.5, 0, IM.metal], [1.9, 0.08, 0.7, 0, 0.57, 0, IM.blanketArmy],
			[0.06, 0.5, 0.06, -0.9, 0.25, -0.3, IM.metal], [0.06, 0.5, 0.06, 0.9, 0.25, -0.3, IM.metal],
		], { solid: [2.0, 0.8] });
		b.furniture(c + 1.4, 1.0, 0, [[0.6, 0.75, 0.5, 0, 0.375, 0, M.concrete], [0.35, 0.45, 0.35, 0, 0.225, -0.55, M.concrete]], { solid: [0.6, 0.5] });
		b.furniture(c - 1.6, -0.9, 0, [[0.45, 0.4, 0.5, 0, 0.2, 0, IM.white]], { solid: [0.45, 0.5] });
		b.furniture(c + 0.5, cor - 0.12, -Z, leaf);
	}
	// дежурка контролёра
	b.container('Стол контролёра', -6.8, 2.7, Math.PI, [
		[1.3, 0.75, 0.65, 0, 0.375, 0, IM.furniture], [0.45, 0.32, 0.05, -0.3, 0.92, 0.15, IM.black], [0.4, 0.26, 0.02, -0.3, 0.94, 0.12, IM.screen],
		[0.3, 0.1, 0.25, 0.35, 0.8, 0, IM.machine],
	], [1.3, 0.65], loot.desk, 0.95);
	chair(b, -5.6, 2.6, -Z);
	locker(b, 'Шкаф изъятого', -hx + t / 2 + 0.27, -0.6, Z, loot.box, 1.0);
	b.furniture(-5.0, 4.25, Math.PI, [[0.9, 1.2, 0.04, 0, 1.6, 0, IM.redBoard]]);
	return b.finish();
}

// ---------- Медчасть ----------

/** Медчасть 10×7 м: больничные койки, стол врача, аптечный шкаф (тайник); красный крест над входом. */
function medchast(ctx, { name, cx, cz, ry, loot }) {
	const W = 10, D = 7, H = 3.0, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'home';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-3], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [-0.6, 2.8]) b.window('front', x, { t, sill: M.whiteBrick });
	for (const x of [-3, 0.2, 3.4]) b.window('back', x, { t, sill: M.whiteBrick });
	b.window('left', 0, { t, sill: M.whiteBrick });
	flatRoof(b, M.whiteBrick);
	porch(b, 'front', -3, { t, w: 1.8, y: 2.35, mat: M.metalRust, leaf: M.white, d: 1.0 });
	for (const [w, h] of [[0.7, 0.2], [0.2, 0.7]]) b.top_(b.onWall(box(w, h, 0.04).translate(0, 2.68, 0.02), 'front', -1.6, t), M.red);
	plate(b, 'front', 1.2, 'МЕДЧАСТЬ', { t, w: 2.4, y: 2.65, bg: '#e8e4d8', fg: '#a01a10' });
	for (const x of [-3.8, -2.2, -0.6]) b.furniture(x, hz - t / 2 - 1.05, Math.PI, [
		[0.9, 0.08, 2.0, 0, 0.55, 0, IM.metal], [0.86, 0.14, 1.9, 0, 0.66, 0, IM.linen], [0.6, 0.1, 0.35, 0, 0.78, -0.72, IM.white],
		...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.05, 0.55, 0.05, sx * 0.4, 0.27, sz * 0.92, IM.metal]),
		[0.9, 0.6, 0.05, 0, 0.85, -0.98, IM.metal],
	], { solid: [0.9, 2.0] });
	table(b, 2.6, -1.6, 0, { w: 1.2, d: 0.7 });
	chair(b, 2.6, -0.9, Math.PI);
	b.container('Аптечный шкаф', hx - t / 2 - 0.24, 1.6, -Z, [
		[1.0, 1.8, 0.45, 0, 0.9, 0, IM.white], [0.02, 1.7, 0.02, 0, 0.9, 0.23, IM.black],
		[0.3, 0.08, 0.01, 0, 1.55, 0.235, IM.redBoard], [0.08, 0.3, 0.01, 0, 1.55, 0.236, IM.redBoard],
	], [1.0, 0.45], loot, 1.8);
	return b.finish();
}

// ---------- Административный корпус ----------

/**
 * Административный корпус 20×11 м, два этажа (второй — глухой): коридор вдоль здания, дежурная часть у входа (пульт,
 * стол дежурного — тайник), оперчасть (стол оперативника — тайник), кабинет начальника (сейф — тайник), спецчасть
 * со стеллажами личных дел (шкаф — тайник). Вход — в передней стене, второй — в торце коридора справа.
 */
function admin(ctx, { name, cx, cz, ry, loot }) {
	const W = 20, D = 11, H = 3.3, F2 = 3.1, t = 0.3, hx = W / 2, hz = D / 2, c0 = -1.2, c1 = 1.0;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + F2 + 0.6 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM, paper = IM.wallpaper[1];
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: paper };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [6], w: 1.5, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [(c0 + c1) / 2], side: -1 });
	const pw = { mat: paper, t: 0.14 };
	b.wall('x', c0, -hx + t / 2, hx - t / 2, { ...pw, doors: [-4, 5] });
	b.wall('x', c1, -hx + t / 2, hx - t / 2, { ...pw, doors: [-5, 4] });
	b.wall('z', 2, -hz + t / 2, c0 - 0.07, pw);
	b.wall('z', -1, c1 + 0.07, hz - t / 2, pw);
	const sill = M.whiteBrick;
	for (const x of [-8, -5, -1.5, 3.2, 8.6]) b.window('front', x, { t, sill });
	for (const x of [-8, -5, -2.6, 1.6, 5, 8]) b.window('back', x, { t, sill });
	for (const z of [-3, 3]) b.window('left', z, { t, sill });
	for (const z of [-3.5, 2.0]) b.window('right', z, { t, sill });
	// второй этаж — глухой: пояс, кирпичная коробка, окна, плоская крыша с парапетом, флаг
	const y2 = H + 0.22;
	b.top_(place(box(W + t + 0.3, 0.22, D + t + 0.3, 2), 0, H + 0.11, 0), M.concreteDark);
	b.top_(place(box(W + t, F2, D + t, 1.5), 0, y2 + F2 / 2, 0), M.whiteBrick);
	for (const side of ['front', 'back']) for (const x of [-8, -5, -2, 1, 4, 7.5]) {
		b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.1, 1.3), Math.floor(hash01(name, side, x) * 4)).translate(0, y2 + 1.5, 0.012), side, x, t), M.window);
	}
	for (const side of ['left', 'right']) for (const z of [-2.5, 2.5]) b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.1, 1.3), Math.floor(hash01(name, side, z) * 4)).translate(0, y2 + 1.5, 0.012), side, z, t), M.window);
	b.top_(place(box(W + t + 0.5, 0.25, D + t + 0.5, 3), 0, y2 + F2 + 0.12, 0), M.roofTar);
	for (const s of [-1, 1]) {
		b.top_(place(boxTop(W + t + 0.5, 0.35, 0.2, 2), 0, y2 + F2 + 0.42, s * (D / 2 + t / 2 + 0.15)), M.whiteBrick);
		b.top_(place(boxTop(0.2, 0.35, D + t + 0.3, 2), s * (W / 2 + t / 2 + 0.15), y2 + F2 + 0.42, 0), M.whiteBrick);
	}
	b.top_(place(box(0.08, 3.0, 0.08), -hx + 1, y2 + F2 + 1.6, -hz + 1), M.metalDark);
	b.top_(place(box(1.4, 0.85, 0.03), -hx + 1.74, y2 + F2 + 2.6, -hz + 1), M.red);
	plate(b, 'front', -1.2, 'ФКУ ИК-17 · АДМИНИСТРАЦИЯ', { t, w: 6.0, y: y2 + F2 - 0.45 });
	b.canopy('front', 6, { w: 2.6, d: 1.5, y: 2.75, mat: M.concrete, posts: M.whiteBrick, t, thick: 0.18 });
	b.lower(place(boxTop(2.6, 0.18, 1.0), 6, 0.09, -hz - t / 2 - 0.5), M.concrete);
	b.wallBox('front', 6 + 1.35, 1.2, 0.02, 2.05, 0.06, M.woodBlue, { t });
	porch(b, 'right', (c0 + c1) / 2, { t, w: 1.8, y: 2.45, mat: M.metalRust, leaf: M.woodBlue, d: 0.9 });
	// дежурная часть: пульт с мониторами, стол дежурного
	b.furniture(3.6, -hz + t / 2 + 0.4, 0, [[2.4, 0.8, 0.7, 0, 0.4, 0, IM.machine], [0.5, 0.35, 0.05, -0.7, 1.0, -0.1, IM.screen], [0.5, 0.35, 0.05, 0, 1.0, -0.1, IM.screen], [0.5, 0.35, 0.05, 0.7, 1.0, -0.1, IM.screen]], { solid: [2.4, 0.7] });
	b.container('Стол дежурного', 8.6, -3.2, -Z, [[1.4, 0.75, 0.7, 0, 0.375, 0, IM.furniture], [0.4, 0.3, 0.3, 0.3, 0.9, 0, IM.black], [0.3, 0.02, 0.22, -0.3, 0.76, 0.1, IM.paper]], [1.4, 0.7], loot.duty, 0.95);
	chair(b, 9.4, -3.2, -Z);
	// оперчасть: стол оперативника, металлический шкаф, сейф-ящик
	b.container('Стол оперативника', -6, -3.4, 0, [[1.5, 0.75, 0.75, 0, 0.375, 0, IM.furniture], [0.38, 0.02, 0.28, 0.3, 0.765, 0, IM.black], [0.38, 0.26, 0.02, 0.3, 0.9, -0.12, IM.screen], [0.5, 0.02, 0.35, -0.35, 0.765, 0.05, IM.paper]], [1.5, 0.75], loot.oper, 0.95);
	chair(b, -6, -4.6, 0);
	b.furniture(-hx + t / 2 + 0.27, -3.4, Z, [[1.0, 1.9, 0.5, 0, 0.95, 0, IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, IM.black]], { solid: [1.0, 0.5] });
	b.furniture(-1.2, -hz + t / 2 + 0.05, 0, [[1.6, 1.0, 0.03, 0, 1.6, 0, IM.paper]]);
	// кабинет начальника: стол, кресло, флаг, портрет на стене, сейф
	b.furniture(-6.6, 3.6, Math.PI, [[1.8, 0.06, 0.9, 0, 0.76, 0, IM.furniture], [1.7, 0.72, 0.8, 0, 0.36, 0, IM.furniture], [0.6, 0.04, 0.4, 0.2, 0.8, 0, IM.paper]], { solid: [1.8, 0.9] });
	chair(b, -6.6, 4.6, Math.PI);
	b.furniture(-6.6, hz - t / 2 - 0.03, Math.PI, [[0.7, 0.9, 0.03, 0, 1.9, 0, IM.furnitureLight]]);
	b.furniture(-3.0, 4.8, 0, [[0.06, 2.2, 0.06, 0, 1.1, 0, IM.metal], [0.8, 0.5, 0.02, 0.4, 1.9, 0, M.red]], { solid: [0.3, 0.3] });
	safe(b, 'Сейф начальника', -hx + t / 2 + 0.32, 2.2, Z, loot.safe);
	// спецчасть: стеллажи с личными делами, шкаф с делами
	const files = (x) => b.furniture(x, 3.2, 0, [
		...[0.05, 0.75, 1.45, 2.0].map((y) => [2.2, 0.04, 0.5, 0, y, 0, IM.rack]),
		[0.04, 2.05, 0.5, -1.08, 1.0, 0, IM.rack], [0.04, 2.05, 0.5, 1.08, 1.0, 0, IM.rack],
		[2.0, 0.32, 0.4, 0, 0.25, 0, IM.books[0]], [2.0, 0.32, 0.4, 0, 0.95, 0, IM.books[1]], [1.6, 0.32, 0.4, -0.2, 1.65, 0, IM.books[2]],
	], { solid: [2.2, 0.5] });
	files(1.4);
	files(4.2);
	cabinet(b, 'Шкаф с делами', hx - t / 2 - 0.28, 3.8, -Z, 1.2, 2.0, 0.55, loot.files, IM.furnitureLight);
	return b.finish();
}

// ---------- Оружейная охраны ----------

/**
 * Оружейная комната охраны 12×8 м, кирпич с решётками на окнах: у входа — стойка выдачи, бронежилеты и каски, стол;
 * за решётчатой перегородкой (дверь в ней открыта) — пирамиды с автоматами, ящик гранат, оружейный ящик, сейф.
 */
function guardArmory(ctx, P, { name, cx, cz, ry, loot }) {
	const W = 12, D = 8, H = 3.0, t = 0.4, hx = W / 2, hz = D / 2, cage = 0.3;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.6 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.armyWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-3.6], w: 1.2, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const [side, at] of [['front', 2.6], ['back', -3], ['back', 3]]) {
		b.window(side, at, { t, sill: M.brick });
		for (let k = -0.45; k <= 0.46; k += 0.18) b.top_(b.onWall(box(0.04, 1.4, 0.04).translate(k, 1.65, 0.06), side, at, t), M.metalDark);
	}
	flatRoof(b, M.brick);
	b.vent(-2.6, 1.6, H + 0.25, M.silver);
	b.vent(3.0, -1.8, H + 0.25, M.silver, { h: 0.5, r: 0.12 });
	porch(b, 'front', -3.6, { t, w: 1.8, y: 2.45, mat: M.metalRust, leaf: M.metalDark, d: 1.0 });
	plate(b, 'front', 1.2, 'ОРУЖЕЙНАЯ КОМНАТА', { t, w: 3.0, y: 2.67, bg: '#3c403c', fg: '#ece6d2' });
	// решётчатая перегородка; дверь в ней (x 3,2…4,4) распахнута внутрь хранилища
	const cageRun = (x0, x1) => {
		const l = x1 - x0, xm = (x0 + x1) / 2;
		b.lower(place(panel(l, 2.5, 0.75), xm, 1.3, cage), P.bars, { cast: false });
		b.lower(place(box(l, 0.08, 0.08), xm, 2.58, cage), M.metalDark);
		b.collide(xm, cage, l, 0.15);
	};
	cageRun(-hx + t / 2, 3.2);
	cageRun(4.4, hx - t / 2);
	for (const x of [3.2, 4.4]) b.lower(place(box(0.1, 2.62, 0.1), x, 1.31, cage), M.metalDark);
	b.lower(panel(1.15, 2.4, 0.75).translate(0.575, 0, 0).rotateY(-Z).translate(4.4, 1.25, cage), P.bars, { cast: false });
	// хранилище
	pyramid(b, -3.4, hz - t / 2 - 0.3, Math.PI, loot.p1);
	pyramid(b, -0.6, hz - t / 2 - 0.3, Math.PI, loot.p2);
	b.container('Ящик с гранатами', 2.2, hz - t / 2 - 0.35, Math.PI, [[1.0, 0.45, 0.6, 0, 0.23, 0, IM.crateGreen], [1.02, 0.05, 0.62, 0, 0.47, 0, IM.machine]], [1.0, 0.6], loot.gren, 0.5);
	gunCrate(b, 'Оружейный ящик', hx - t / 2 - 0.36, 2.0, -Z, loot.crate);
	safe(b, 'Сейф', -hx + t / 2 + 0.32, 2.0, Z, loot.safe);
	// у входа: стойка выдачи, бронежилеты и каски, стол
	b.furniture(0.4, -0.35, 0, [[2.4, 1.0, 0.55, 0, 0.5, 0, IM.furniture], [2.5, 0.05, 0.65, 0, 1.02, 0, IM.machine]], { solid: [2.4, 0.6] });
	b.furniture(-hx + t / 2 + 0.25, -2.0, Z, [
		[1.6, 0.06, 0.35, 0, 1.6, 0, IM.metal], [0.06, 1.6, 0.3, -0.75, 0.8, 0, IM.metal], [0.06, 1.6, 0.3, 0.75, 0.8, 0, IM.metal],
		[0.45, 0.6, 0.22, -0.4, 1.2, 0.05, IM.blanketArmy], [0.45, 0.6, 0.22, 0.4, 1.2, 0.05, IM.blanketArmy],
		[0.28, 0.18, 0.28, -0.4, 1.72, 0, IM.machine], [0.28, 0.18, 0.28, 0.4, 1.72, 0, IM.machine],
	], { solid: [1.6, 0.4] });
	table(b, 3.6, -2.6, 0, { w: 1.2, d: 0.7 });
	chair(b, 3.6, -1.9, Math.PI);
	return b.finish();
}

// ---------- Швейный цех промзоны ----------

/**
 * Швейный цех 26×12 м: ряды швейных машин, раскройный стол, поддоны с рулонами ткани; шкаф мастера и инструментальный
 * ящик (тайники). Ворота — в передней стене, дверь — в правом торце.
 */
function ceh(ctx, { name, cx, cz, ry, loot }) {
	const W = 26, D = 12, H = 5.0, t = 0.3, hx = W / 2, hz = D / 2, gate = -4;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.8 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [gate], w: 3.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [-3.5], side: -1 });
	for (const x of [-10, 2, 7, 11]) b.window('front', x, { t, y: 3.4, sill: M.brick });
	for (const x of [-9, -3, 3, 9]) b.window('back', x, { t, y: 3.4, sill: M.brick });
	for (const z of [-2, 2.5]) b.window('left', z, { t, y: 3.4, sill: M.brick });
	for (const s of [-1, 1]) b.wallBox('front', gate + s * 2.72, 1.78, 0.02, 2.4, 0.06, M.metalRust, { t });
	b.canopy('front', gate, { w: 4.6, d: 1.4, y: 2.9, mat: M.metalRust, t });
	porch(b, 'right', -3.5, { t, w: 1.8, y: 2.45, mat: M.metalRust, leaf: M.metalRust, d: 0.9 });
	plate(b, 'front', 5, 'ЦЕХ № 1 · ШВЕЙНЫЙ', { t, w: 4.0, y: 4.5 });
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.top_(place(box(W - 6, 0.5, 2.0, 2), 0, H + 0.55, 0), M.glass);
	b.parapet(H + 0.3, M.brick, 0.35);
	for (const [x, z] of [[-9.5, -3.5], [9, 3.8]]) b.vent(x, z, H + 0.3, M.silver);
	// швейные машины рядами, проход от ворот посередине
	const machine = (x, z) => b.furniture(x, z, 0, [
		[1.2, 0.05, 0.7, 0, 0.75, 0, IM.furnitureLight], [1.15, 0.72, 0.05, 0, 0.37, 0.3, IM.metal],
		[0.42, 0.26, 0.2, 0.15, 0.91, -0.05, IM.white], [0.1, 0.18, 0.12, -0.12, 0.87, -0.05, IM.black],
	], { solid: [1.25, 0.75] });
	for (const z of [-2.8, -0.2, 2.4]) for (const x of [-11.4, -9.8, -8.2, 0.4, 2.0, 3.6, 5.2]) machine(x, z);
	// раскройный стол, поддоны с рулонами ткани
	b.furniture(9.6, -1.6, 0, [[3.2, 0.88, 1.5, 0, 0.44, 0, IM.furniture], [3.0, 0.02, 1.3, 0, 0.89, 0, IM.linen]], { solid: [3.2, 1.5] });
	for (const [x, mat] of [[9.6, IM.blanketArmy], [11.4, IM.rag]]) {
		const parts = [[1.2, 0.15, 1.0, 0, 0.075, 0, IM.crate]];
		for (let i = 0; i < 5; i++) parts.push([0, 0, 0, 0, 0, 0, mat, { geo: new THREE.CylinderGeometry(0.17, 0.17, 1.0, 10).rotateX(Z).translate(-0.36 + (i % 3) * 0.36 + (i > 2 ? 0.18 : 0), 0.32 + (i > 2 ? 0.31 : 0), 0) }]);
		b.furniture(x, 3.9, 0, parts, { solid: [1.25, 1.05] });
	}
	cabinet(b, 'Шкаф мастера', 6.6, hz - t / 2 - 0.28, Math.PI, 1.2, 2.0, 0.55, loot.master, IM.furnitureLight);
	b.container('Инструментальный ящик', -hx + t / 2 + 0.32, 4.2, Z, [[1.2, 1.1, 0.6, 0, 0.55, 0, IM.machine], [1.1, 0.02, 0.02, 0, 0.8, 0.31, IM.black]], [1.2, 0.6], loot.tools, 1.1);
	return b.finish();
}

export default {
	id: 'tyurma',
	seed: 7303,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const P = prisonMaterials();
		const wirePts = []; // колючка — отрезками в один набор линий (один вызов отрисовки)

		// ---------- Помощники: колючка, стены, заборы ----------

		/** Колючая спираль вдоль линии на высоте y. */
		const spiral = (x0, z0, x1, z1, y, r = 0.3) => {
			const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len, n = Math.ceil(len / 0.4) * 6;
			let prev = null;
			for (let k = 0; k <= n; k++) {
				const s = (k / n) * len, a = (k / 6) * Math.PI * 2;
				const p = new THREE.Vector3(x0 + dx * s - dz * Math.cos(a) * r, y + r + Math.sin(a) * r, z0 + dz * s + dx * Math.cos(a) * r);
				if (prev) wirePts.push(prev, p);
				prev = p;
			}
		};
		/** Нитка колючки (зигзагом) вдоль линии на высоте y. */
		const strand = (x0, z0, x1, z1, y) => {
			const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 0.5));
			let prev = null;
			for (let k = 0; k <= n; k++) {
				const p = new THREE.Vector3(x0 + (x1 - x0) * k / n, y + (k % 2 ? 0.04 : -0.04), z0 + (z1 - z0) * k / n);
				if (prev) wirePts.push(prev, p);
				prev = p;
			}
		};
		const line = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); return { len, ang: Math.atan2(z1 - z0, x1 - x0), dx: (x1 - x0) / len, dz: (z1 - z0) / len }; };
		/** Проёмы в мировых координатах вдоль оси линии ([от, до]) → метры от её начала. */
		const axisGaps = (x0, z0, x1, z1, gaps) => {
			const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), s0 = alongX ? x0 : z0, dir = Math.sign(alongX ? x1 - x0 : z1 - z0);
			return gaps.map(([p, q]) => { const a = (p - s0) * dir, b = (q - s0) * dir; return [Math.min(a, b), Math.max(a, b)]; });
		};
		/** Коллайдеры линии кусками не длиннее 12 м (сетка навигации строится быстрее). */
		const lineCollide = (x0, z0, dx, dz, a, b, thick, ang, wall = false) => {
			const l = b - a, k = Math.max(1, Math.round(l / 12));
			for (let i = 0; i < k; i++) { const s = a + (i + 0.5) * l / k; collide(x0 + dx * s, z0 + dz * s, l / k, thick, -ang, wall); }
		};

		/** Основная стена: бетонные плиты между пилястрами, поясок поверху, кронштейны и колючая спираль. kb — куда класть. */
		const mainWall = (kb, x0, z0, x1, z1) => {
			const { len, ang, dx, dz } = line(x0, z0, x1, z1);
			const n = Math.max(1, Math.round(len / 6)), sl = len / n;
			for (let i = 0; i < n; i++) {
				const s = (i + 0.5) * sl;
				kb.add(place(box(sl, WALL_H, WALL_T, 1.5), x0 + dx * s, WALL_H / 2, z0 + dz * s, -ang), rnd() < 0.25 ? M.concreteDark : M.concrete);
			}
			for (let i = 0; i <= n; i++) {
				const s = i * sl, x = x0 + dx * s, z = z0 + dz * s;
				kb.add(place(box(0.5, WALL_H + 0.2, WALL_T + 0.3), x, (WALL_H + 0.2) / 2, z, -ang), M.concreteDark);
				kb.add(place(box(0.06, 0.95, 0.06), x, WALL_H + 0.62, z, -ang), M.metalDark);
			}
			kb.add(place(box(len, 0.14, WALL_T + 0.14), (x0 + x1) / 2, WALL_H + 0.07, (z0 + z1) / 2, -ang), M.concreteDark);
			lineCollide(x0, z0, dx, dz, 0, len, WALL_T + 0.1, ang, true);
			spiral(x0, z0, x1, z1, WALL_H + 0.2);
		};
		/** Стена из плит, загораживающая героя от камеры (вдоль x): полупрозрачная, когда он за ней. */
		const wallOcc = (name, x0, x1, z, build = mainWall, h = WALL_H) => occluder(name, (kb) => build(kb, x0, z, x1, z),
			{ cx: (x0 + x1) / 2, cz: z, ry: 0, hx: Math.abs(x1 - x0) / 2, hz: 0.8, top: h + 0.8 }, 0.25);

		/** Сетка-рабица запретки на бетонных столбах с двумя нитками колючки поверху. gaps — проёмы в мировых координатах. */
		const meshFence = (x0, z0, x1, z1, gaps = []) => {
			const { len, ang, dx, dz } = line(x0, z0, x1, z1);
			for (const [a, b] of solidParts(len, axisGaps(x0, z0, x1, z1, gaps))) {
				const l = b - a, n = Math.max(1, Math.round(l / 3)), sl = l / n;
				for (let i = 0; i < n; i++) {
					const s = a + (i + 0.5) * sl;
					batch.add(place(panel(sl, 2.4, 0.5), x0 + dx * s, 1.25, z0 + dz * s, -ang), P.mesh, { cast: false });
				}
				for (let i = 0; i <= n; i++) { const s = a + i * sl; batch.add(place(box(0.14, 2.9, 0.14), x0 + dx * s, 1.45, z0 + dz * s, -ang), M.concreteDark); }
				lineCollide(x0, z0, dx, dz, a, b, 0.2, ang);
				for (const y of [2.6, 2.82]) strand(x0 + dx * a, z0 + dz * a, x0 + dx * b, z0 + dz * b, y);
			}
		};
		/** Решётчатый забор локалки: стойки, верхняя труба, полотно-решётка. */
		const barFence = (x0, z0, x1, z1, gaps = [], h = 2.6) => {
			const { len, ang, dx, dz } = line(x0, z0, x1, z1);
			for (const [a, b] of solidParts(len, axisGaps(x0, z0, x1, z1, gaps))) {
				const l = b - a, n = Math.max(1, Math.round(l / 3)), sl = l / n;
				for (let i = 0; i < n; i++) {
					const s = a + (i + 0.5) * sl, x = x0 + dx * s, z = z0 + dz * s;
					batch.add(place(panel(sl, h - 0.12, 0.75), x, (h - 0.12) / 2 + 0.06, z, -ang), P.bars, { cast: false });
					batch.add(place(box(sl, 0.08, 0.08), x, h, z, -ang), M.metalDark);
				}
				for (let i = 0; i <= n; i++) { const s = a + i * sl; batch.add(place(box(0.12, h + 0.1, 0.12), x0 + dx * s, (h + 0.1) / 2, z0 + dz * s, -ang), M.metalDark); }
				lineCollide(x0, z0, dx, dz, a, b, 0.2, ang);
			}
		};
		/** Открытая калитка в решётке: рама и распахнутая створка (без коллайдера). alongX — забор вдоль x. */
		const gateLeaf = (x, z, alongX, w, h = 2.6) => {
			const ry = alongX ? 0 : -Z, c = Math.cos(ry), s = Math.sin(ry);
			batch.add(place(box(w + 0.2, 0.12, 0.12), x, h + 0.15, z, ry), M.metalDark);
			for (const k of [-1, 1]) batch.add(place(box(0.14, h + 0.2, 0.14), x + c * k * w / 2, (h + 0.2) / 2, z - s * k * w / 2, ry), M.metalDark);
			const hx = x - c * w / 2, hz = z + s * w / 2; // петли — у одного края проёма
			batch.add(panel(w * 0.95, h - 0.3, 0.75).translate(w * 0.475, 0, 0).rotateY(ry + 1.9).translate(hx, (h - 0.3) / 2 + 0.08, hz), P.bars, { cast: false });
		};
		/** Выломанная секция: лежит на земле рядом с проёмом. */
		const fallen = (x, z, alongX, w) => {
			const ry = alongX ? 0.15 : -Z + 0.15, off = 1.1;
			batch.add(place(panel(w * 0.9, 2.3, 0.75).rotateX(-Z), x + (alongX ? 0 : off), 0.05, z + (alongX ? off : 0), ry), P.bars, { cast: false });
		};
		/**
		 * Локальный участок: решётчатый забор по прямоугольнику; open — { n|s|w|e: [[середина, ширина, 'gate'|'breach']] }
		 * (gate — открытая калитка, breach — выломанная секция).
		 */
		const lokalka = (x0, z0, x1, z1, open) => {
			const sides = { n: [x0, z0, x1, z0], s: [x0, z1, x1, z1], w: [x0, z0, x0, z1], e: [x1, z0, x1, z1] };
			for (const [k, [ax, az, bx, bz]] of Object.entries(sides)) {
				const list = open[k] ?? [], alongX = az === bz;
				barFence(ax, az, bx, bz, list.map(([c, w]) => [c - w / 2, c + w / 2]));
				for (const [c, w, kind] of list) {
					const gx = alongX ? c : ax, gz = alongX ? az : c;
					if (kind === 'gate') gateLeaf(gx, gz, alongX, w); else fallen(gx, gz, alongX, w);
				}
			}
		};

		/** Вышка охраны: стальные опоры с раскосами, кабина со стёклами, шатровая крыша, прожектор к середине колонии, лестница. */
		const tower = (x, z, face) => {
			const H = 5.2, L = 1.05, sf = Math.sin(face), cf = Math.cos(face);
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.2, H, 0.2), x + dx * L, H / 2, z + dz * L), M.metalDark);
			for (const [ox, oz, r] of [[0, -1, 0], [0, 1, 0], [-1, 0, Z], [1, 0, Z]]) for (const y of [1.4, 3.8]) for (const s of [-1, 1]) {
				batch.add(place(box(3.0, 0.07, 0.07), x + ox * L, y, z + oz * L, r, 0, s * 0.81), M.metalDark);
			}
			batch.add(place(box(3.0, 0.18, 3.0), x, H, z), M.metalDark);
			for (const [ox, oz, r] of [[0, -1, 0], [0, 1, 0], [-1, 0, Z], [1, 0, Z]]) {
				batch.add(place(box(3.0, 1.05, 0.08, 1.2), x + ox * 1.46, H + 0.6, z + oz * 1.46, r), M.woodGrey);
				batch.add(place(box(2.8, 0.9, 0.03), x + ox * 1.47, H + 1.6, z + oz * 1.47, r), M.glass);
			}
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.1, 1.4, 0.1), x + dx * 1.45, H + 1.75, z + dz * 1.45), M.metalDark);
			batch.add(place(box(3.5, 0.14, 3.5, 2), x, H + 2.5, z), M.roofMetal);
			batch.add(place(new THREE.ConeGeometry(2.3, 0.8, 4).rotateY(Math.PI / 4), x, H + 2.97, z), M.roofMetal);
			const F = frame(x + sf * 1.15, H + 2.85, z + cf * 1.15, face - Z, 0, -0.35);
			batch.add(box(0.34, 0.4, 0.5).applyMatrix4(F), M.metalDark);
			batch.add(box(0.02, 0.32, 0.42).translate(0.18, 0, 0).applyMatrix4(F), P.lamp, { cast: false });
			// лестница — на грани, обращённой во двор
			const onX = Math.abs(sf) > Math.abs(cf), lx = onX ? Math.sign(sf) * 1.2 : 0, lz = onX ? 0 : Math.sign(cf) * 1.2;
			for (const s of [-1, 1]) batch.add(place(box(0.06, H, 0.06), x + lx + (onX ? 0 : s * 0.25), H / 2, z + lz + (onX ? s * 0.25 : 0)), M.metalDark);
			for (let y = 0.4; y < H; y += 0.4) batch.add(place(box(0.5, 0.04, 0.04), x + lx, y, z + lz, onX ? Z : 0), M.metalDark);
			collide(x, z, 2.5, 2.5);
		};

		// ---------- Покрытия: дороги снаружи, территория колонии, запретка, асфальт внутри ----------
		const roads = [
			[-4, 4, -90, -73, M.asphalt], // к северному выходу (Шахта)
			[-74, 26, -79, -73, M.asphalt], // северная объездная
			[18, 26, -73, -60, M.asphalt], // к хозяйственным воротам промзоны
			[-74, -68, -79, 66, M.asphalt], // западная объездная
			[-90, -68, -4, 4, M.asphalt], // к западному выходу (Микрорайон)
			[-74, 64, 61, 66, M.asphalt], // улица посёлка
			[-4, 4, 40, 90, M.asphalt], // главная дорога к южному выходу (Порт)
			[-32, -8, 44, 58, M.asphalt], // стоянка
			[-4.5, 4.5, SZ, WZ1, M.asphalt], // шлюз
			[-10, 10, AZ, SZ, M.asphalt], // площадь у административного корпуса
			[-4, 4, -42, AZ, M.asphalt], // центральная аллея
			[-16, 16, -10, 6, M.asphalt], // плац
			[-50, 56, -42, -38, M.concrete], // дорога промзоны
			[18, 26, -60, -42, M.concrete], // от ворот промзоны
		];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);
		ground(WX1 - WX0, WZ1 - WZ0, (WX0 + WX1) / 2, (WZ0 + WZ1) / 2, M.dirt, 6, 0.012);
		// запретная полоса изнутри (песок) и контрольно-следовая полоса снаружи стены
		ground(WX1 - WX0 - 0.5, IZ0 - WZ0 - 0.2, (WX0 + WX1) / 2, (WZ0 + IZ0) / 2, M.sand, 4, 0.0135);
		for (const x of [(WX0 + IX0) / 2, (WX1 + IX1) / 2]) ground(IX0 - WX0 - 0.2, AZ - WZ0, x, (WZ0 + AZ) / 2, M.sand, 4, 0.0136);
		ground(WX1 - WX0 + 6, 3, (WX0 + WX1) / 2, WZ0 - 1.75, M.sand, 4, 0.0137);
		for (const x of [WX0 - 1.75, WX1 + 1.75]) ground(3, WZ1 - WZ0 + 3, x, (WZ0 + WZ1) / 2 - 1.5, M.sand, 4, 0.0138);
		let lay = 0.018;
		for (const [x0, x1, z0, z1, mat] of roads) { ground(x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2, mat, 4, lay); lay += 0.0004; }
		// бетонные дорожки: от ворот к баракам, перед корпусом и оружейной, площадки промзоны
		for (const [w, d, x, z] of [
			[45, 3, -12, 21.5], [14, 3, 24, 21.5], // вдоль административной зоны
			[30, 2.4, -34.5, -10.5], // переулок между локалками
			[16, 2.4, 12, -9], [4, 9, 34, -13], // к столовой и ШИЗО
			[14, 10, -26, -40], [18, 9, 47, -42], [12, 6, -2, -44], // перед цехом, складом, котельной
		]) { ground(w, d, x, z, M.concrete, 4, lay); lay += 0.0004; }
		for (let i = 0; i < 8; i++) ground(R(3, 6), R(2, 4), R(-50, 56), R(-58, 36), M.concreteDark, 3, 0.0128 + i * 0.0001); // пятна, заплатки
		// разметка плаца
		const mark = markingMaterial();
		for (const z of [-9.7, 5.7]) ground(32, 0.15, 0, z, mark, 6, 0.03);
		for (const x of [-15.7, 15.7]) ground(0.15, 16, x, -2, mark, 6, 0.03);
		for (const x of [-10, -5, 5, 10]) ground(0.12, 3, x, 2.5, mark, 6, 0.03);

		// ---------- Основная стена, вышки, пролом ----------
		wallOcc('WallN1', WX0, PG - PGW, WZ0);
		wallOcc('WallN2', PG + PGW, WX1, WZ0);
		wallOcc('WallS1', WX0, -SG - 0.5, WZ1);
		wallOcc('WallS2', 12.6, WX1, WZ1);
		mainWall(batch, WX0, WZ0, WX0, -12.5);
		mainWall(batch, WX0, -8.5, WX0, WZ1);
		mainWall(batch, WX1, WZ0, WX1, WZ1);
		// пролом в западной стене: обломки плиты, куски бетона, торчит арматура
		batch.add(place(box(3.6, 0.35, 2.2, 1.5), WX0 + 1.7, 0.3, -10.4, 0.3, 0.08, 0.12), M.concrete);
		for (let i = 0; i < 9; i++) batch.add(place(new THREE.DodecahedronGeometry(R(0.25, 0.55), 0), WX0 + R(-2.5, 3), R(0.1, 0.3), -10.5 + R(-2.5, 2.5), R(0, 3), R(0, 3)), rnd() < 0.5 ? M.concrete : M.concreteDark);
		for (const z of [-12.3, -8.7]) for (const k of [0, 1]) batch.add(place(box(0.03, 1.2, 0.03), WX0, 2.2 + k * 0.8, z, 0, 0.5 - k, 0.3), M.metalRust);
		billboard(batch, M, root, collide, WX0 - 6, -17, -Z, 'ЗАПРЕТНАЯ ЗОНА · ОГОНЬ БЕЗ ПРЕДУПРЕЖДЕНИЯ', { w: 5.2, h: 1.0, y: 1.9, bg: '#e8e4d4', fg: '#b01e14' });
		// вышки по углам, посередине длинных стен и у хозяйственных ворот; прожекторы — к середине колонии
		for (const [x, z] of [[WX0 + 1.7, WZ0 + 1.7], [WX1 - 1.7, WZ0 + 1.7], [WX0 + 1.7, WZ1 - 1.7], [WX1 - 1.7, WZ1 - 1.7], [WX0 + 1.7, -26], [WX1 - 1.7, -26], [PG + 7, WZ0 + 1.7]]) {
			tower(x, z, Math.atan2(3 - x, -13 - z));
		}

		// ---------- Запретка: сетка-рабица вдоль стены, повалена местами ----------
		meshFence(IX0, IZ0, IX1, IZ0, [[PG - PGW, PG + PGW], [-31.3, -28.7], [43.7, 46.3]]);
		meshFence(IX0, IZ0, IX0, AZ, [[-12, -9], [-49.3, -46.7], [9.7, 12.3]]);
		meshFence(IX1, IZ0, IX1, AZ, [[-46.3, -43.7], [-26.3, -23.7], [3.7, 6.3]]);
		for (const [x, z, alongX] of [[-30, IZ0, true], [45, IZ0, true], [IX0, -48, false], [IX0, 11, false], [IX1, -45, false], [IX1, -25, false], [IX1, 5, false]]) {
			batch.add(place(panel(2.4, 2.3, 0.5).rotateX(-Z), x + (alongX ? 0 : (x < 0 ? 1.2 : -1.2)), 0.05, z + (alongX ? 1.2 : 0), alongX ? 0.2 : -Z + 0.2), P.mesh, { cast: false });
		}

		// ---------- Ворота-шлюз и КПП (юг) ----------
		for (const s of [-1, 1]) {
			const x = s * (SG + 0.25);
			batch.add(place(box(0.5, WALL_H, WZ1 - SZ, 1.5), x, WALL_H / 2, (SZ + WZ1) / 2), M.concrete);
			collide(x, (SZ + WZ1) / 2, 0.6, WZ1 - SZ, 0, true);
			spiral(x, SZ, x, WZ1, WALL_H);
			for (const z of [SZ, WZ1]) { batch.add(place(box(1.0, WALL_H + 0.6, 1.1), x + s * 0.25, (WALL_H + 0.6) / 2, z), M.concreteDark); collide(x + s * 0.25, z, 1.0, 1.1); }
		}
		occluder('Shluz', (kb) => {
			for (const z of [SZ, WZ1]) kb.add(place(box(2 * SG + 2.5, 0.6, 0.8), 0, WALL_H + 0.3, z), M.concreteDark);
			kb.add(place(box(2 * SG + 0.5, 0.12, 1.2), 0, 4.1, (SZ + WZ1) / 2), M.metalDark); // мостик досмотра
			for (const s of [-1, 1]) kb.add(place(box(2 * SG + 0.5, 0.05, 0.05), 0, 5.0, (SZ + WZ1) / 2 + s * 0.58), M.metalDark);
			for (let x = -SG; x <= SG + 0.01; x += SG / 2) for (const s of [-1, 1]) kb.add(place(box(0.05, 0.9, 0.05), x, 4.6, (SZ + WZ1) / 2 + s * 0.58), M.metalDark);
			kb.add(new THREE.PlaneGeometry(4.2, 0.5).translate(0, WALL_H + 0.3, WZ1 + 0.41), T.signMaterial('ФКУ ИК-17', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 64 }));
		}, { cx: 0, cz: (SZ + WZ1) / 2, ry: 0, hx: SG + 1.2, hz: (WZ1 - SZ) / 2 + 0.5, top: WALL_H + 0.7 }, 0.2);
		// внешние ворота: левая створка распахнута наружу, правая сорвана и лежит в шлюзе
		batch.add(place(box(0.12, 3.6, 4.5, 1.5), -SG + 0.1, 1.85, WZ1 + 2.6), M.metalOlive);
		collide(-SG + 0.1, WZ1 + 2.6, 0.25, 4.5);
		batch.add(place(box(4.5, 0.12, 3.6, 1.5), 2.2, 0.07, WZ1 - 3.2, 0.25), M.metalOlive);
		// внутренние ворота: левая створка закрыта, правая распахнута во двор
		batch.add(place(box(SG, 3.6, 0.12, 1.5), -SG / 2, 1.85, SZ), M.metalOlive);
		collide(-SG / 2, SZ, SG, 0.3);
		batch.add(place(box(0.12, 3.6, 4.5, 1.5), SG - 0.1, 1.85, SZ - 2.4), M.metalOlive);
		collide(SG - 0.1, SZ - 2.4, 0.25, 4.5);
		// КПП в линии стены: проходная с дверями наружу и во двор; простенок до шлюза
		buildings.push(buildCheckpoint(bctx, { name: 'Kpp', cx: 9.5, cz: WZ1, ry: Math.PI }));
		batch.add(place(box(1.4, WALL_H, WALL_T, 1.5), 5.85, WALL_H / 2, WZ1), M.concrete);
		collide(5.85, WZ1, 1.4, WALL_T + 0.1, 0, true);
		spiral(5.2, WZ1, 6.5, WZ1, WALL_H);

		// ---------- Административная зона (между стеной и забором z = AZ) ----------
		barFence(IX0, AZ, IX1, AZ, [[-3, 3], [-45.1, -42.9], [39.3, 40.7]]);
		for (const s of [-1, 1]) batch.add(panel(2.9, 2.3, 0.75).translate(s * 1.45, 0, 0).rotateY(s * 1.3).translate(s * 3, 1.25, AZ), P.bars, { cast: false });
		for (const s of [-1, 1]) batch.add(place(box(0.2, 3.0, 0.2), s * 3.1, 1.5, AZ), M.metalDark);
		fallen(-44, AZ, true, 2.2);
		gateLeaf(40, AZ, true, 1.4);
		buildings.push(
			admin(bctx, {
				name: 'Admin', cx: -21, cz: 29.5, ry: 0, loot: {
					duty: { ammo919: [6, 12, 0.6], ammo545: [5, 15, 0.35], zhivchik: 0.25, glock17: 0.05 },
					oper: { ammo919: [4, 10, 0.5], glock17: 0.1, spore: [1, 3, 0.4] },
					safe: { deagle: 0.1, ammo50: [4, 8, 0.4], spore: [4, 8, 0.7], grenade: 0.12 },
					files: { spore: [2, 4, 0.4], zhivchik: [1, 2, 0.3], ammo12: [4, 8, 0.25] },
				},
			}),
			guardArmory(bctx, P, {
				name: 'GuardArmory', cx: 24, cz: 29.5, ry: 0, loot: {
					p1: { aks: 0.3, ak74: 0.25, ammo545: [20, 40, 0.7] },
					p2: { ak47: 0.2, svd: 0.15, rpk: 0.08, ammo762: [20, 40, 0.5], ammo76254: [10, 20, 0.4] },
					crate: { spas12: 0.15, ak107: 0.07, ammo12: [10, 20, 0.5], ammo545: [20, 30, 0.45] },
					safe: { glock17: 0.25, deagle: 0.1, ammo919: [15, 30, 0.6], ammo50: [5, 10, 0.3], spore: [3, 6, 0.6] },
					gren: { grenade: [1, 3, 0.55], vog25: [2, 4, 0.08] },
				},
			}),
		);
		sandbags(batch, M, collide, 24.5, 22.8, 4.5, 0);
		sandbags(batch, M, collide, 31.6, 24.6, 2.6, Z);
		addCar(batch, M, root, 35, 21.2, 0.05, 0x4a5a3a, { model: 'e_uaz' });
		collide(35, 21.2, 4.3, 1.9, 0.05);
		for (const [x, z, r] of [[-17, 21.2, 0], [-25, 21.2, 0], [12, 23.5, -Z]]) bench(batch, M, x, z, r);
		// гараж: навес на столбах с автозаком
		occluder('AutoShed', (kb) => {
			for (const x of [-50, -44, -38]) for (const z of [23, 34]) kb.add(place(box(0.3, 3.6, 0.3), x, 1.8, z), M.concreteDark);
			kb.add(place(box(13, 0.15, 12, 2), -44, 3.65, 28.5, 0, 0.05), M.roofGreen);
			kb.add(place(box(12.4, 2.6, 0.25, 1.5), -44, 1.3, 34.1), M.brick);
		}, { cx: -44, cz: 28.5, ry: 0, hx: 6.5, hz: 6, top: 4 }, 0.2);
		for (const x of [-50, -44, -38]) collide(x, 23, 0.4, 0.4);
		collide(-44, 34.1, 12.4, 0.35, 0, true);
		{
			// автозак: кабина, кузов-фургон с зарешёченными окошками
			const x = -44, z = 28.2, ry = Math.PI + 0.06, F = frame(x, 0, z, ry);
			const put = (g, mat) => batch.add(g.applyMatrix4(F), mat);
			put(box(2.3, 0.4, 7.0).translate(0, 0.95, 0), M.metalDark);
			put(box(2.4, 1.4, 1.9, 1.5).translate(0, 1.85, 2.6), M.khaki);
			put(box(2.2, 0.6, 0.05).translate(0, 2.2, 3.56), M.glass);
			put(box(2.4, 1.1, 1.0, 1.5).translate(0, 1.4, 3.9), M.khaki);
			put(box(2.5, 2.5, 4.7, 1.5).translate(0, 2.4, -1.1), M.metalOlive);
			for (const s of [-1, 1]) for (const lz of [-2.6, -0.4]) put(box(0.04, 0.35, 0.6).translate(s * 1.26, 2.9, lz), M.metalDark);
			put(box(1.0, 1.9, 0.04).translate(0.5, 2.2, -3.47), M.metalDark);
			for (const wz of [2.9, -1.0, -2.5]) for (const wx of [-1.15, 1.15]) put(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14).rotateZ(Z).translate(wx, 0.55, wz), M.tire);
			collide(x + Math.sin(ry) * 0.3, z + Math.cos(ry) * 0.3, 2.7, 7.6, ry);
		}
		// вольеры кинологов: бетонный пол, задняя стена, решётки с дверцами, будки, навес над будками
		{
			const x0 = 38, z0 = 28, n = 4, w = 4.5, d = 4.5, h = 2.2;
			ground(n * w, d, x0 + n * w / 2, z0 + d / 2, M.concrete, 4, lay);
			batch.add(place(box(n * w, h, 0.25, 1.5), x0 + n * w / 2, h / 2, z0 + d), M.concreteDark);
			collide(x0 + n * w / 2, z0 + d, n * w, 0.3, 0, true);
			for (let i = 0; i <= n; i++) {
				const x = x0 + i * w;
				batch.add(place(panel(d, h, 0.75), x, h / 2, z0 + d / 2, -Z), P.bars, { cast: false });
				batch.add(place(box(0.1, h, 0.1), x, h / 2, z0), M.metalDark);
				collide(x, z0 + d / 2, 0.2, d);
			}
			for (let i = 0; i < n; i++) {
				const cx = x0 + (i + 0.5) * w;
				for (const [a, b] of [[x0 + i * w, cx + 0.4], [cx + 1.6, x0 + (i + 1) * w]]) {
					batch.add(place(panel(b - a, h, 0.75), (a + b) / 2, h / 2, z0, 0), P.bars, { cast: false });
					collide((a + b) / 2, z0, b - a, 0.2);
				}
				batch.add(place(box(1.0, 0.9, 1.2, 1), cx - 1.2, 0.45, z0 + d - 0.9), M.woodGrey);
				batch.add(place(box(1.2, 0.08, 1.4), cx - 1.2, 0.95, z0 + d - 0.9, 0, 0, 0.2), M.roofMetal);
				collide(cx - 1.2, z0 + d - 0.9, 1.0, 1.2);
			}
			batch.add(place(box(n * w + 0.4, 0.1, 2.2, 2), x0 + n * w / 2, h + 0.15, z0 + d - 1.0, 0, -0.08), M.roofMetal);
		}

		// ---------- Жилая зона: плац, локалки с бараками, столовая, клуб, баня, медчасть, ШИЗО ----------
		// плац: трибуна, лозунг, флагшток
		batch.add(place(box(6, 1.1, 2.2, 1.5), -9, 0.55, -12.6), M.concrete);
		batch.add(place(box(1.6, 0.55, 0.7), -9, 0.275, -11.15), M.concrete);
		batch.add(place(box(6.2, 0.1, 0.25), -9, 1.85, -11.6), M.red);
		for (const x of [-11.9, -6.1]) batch.add(place(box(0.08, 0.75, 0.08), x, 1.45, -11.6), M.metalDark);
		collide(-9, -12.6, 6, 2.2);
		billboard(batch, M, root, collide, -9, -14.6, 0, 'НА СВОБОДУ — С ЧИСТОЙ СОВЕСТЬЮ', { w: 7.5, h: 1.3, y: 2.7, bg: '#2a4a7a', fg: '#f0ead8' });
		batch.add(place(new THREE.CylinderGeometry(0.06, 0.08, 9, 8), 9, 4.5, -12), M.metalDark);
		batch.add(place(box(1.8, 1.1, 0.03), 9.95, 8.2, -12), M.red);
		collide(9, -12, 0.4, 0.4);
		// локалки: решётка, калитки и выломанные секции — узкие проходы между участками и вдоль запретки
		lokalka(-50, -33, -19, -13, { e: [[-16.5, 1.4, 'gate']], s: [[-40, 1.4, 'gate']], w: [[-23, 2.2, 'breach']], n: [[-28, 2.2, 'breach']] });
		lokalka(-50, -8, -19, 15, { n: [[-28, 1.4, 'gate']], e: [[2, 1.4, 'gate']], s: [[-44, 2.2, 'breach']], w: [[11, 2.2, 'breach']] });
		lokalka(20, -7, 56, 15, { w: [[-4, 1.4, 'gate']], n: [[46, 1.4, 'gate']], e: [[11, 2.2, 'breach']], s: [[30, 1.4, 'gate']] });
		// ШИЗО за своим забором: с севера — стена промзоны, с востока — запретка
		barFence(34, PZ, 34, -11, [[-31.1, -28.9]]);
		barFence(34, -11, IX1, -11, [[51.8, 53.4]]);
		fallen(34, -30, false, 2.2);
		gateLeaf(52.6, -11, true, 1.6);
		const tumbaLoot = [
			{ ammo919: [2, 6, 0.3], spore: [1, 2, 0.3], zhivchik: 0.15, peas: 0.05 },
			{ ammo12: [2, 5, 0.25], spore: [1, 2, 0.3], zhivchik: 0.15 },
			{ ammo919: [3, 6, 0.3], spore: 0.25, grenade: 0.02 },
			{ spore: [2, 4, 0.45], zhivchik: [1, 2, 0.3], ammo919: [5, 10, 0.35], ammo12: [3, 6, 0.3], fireaxe: 0.05, dbarrel: 0.03 },
		];
		buildings.push(
			barrack(bctx, { name: 'Barrack1', cx: -34.5, cz: -24.5, ry: Math.PI, num: 1, wall: M.whiteBrick, roof: M.slate, loot: tumbaLoot }),
			barrack(bctx, { name: 'Barrack2', cx: -34.5, cz: 4, ry: 0, num: 2, wall: M.plaster, roof: M.roofTin, loot: tumbaLoot }),
			barrack(bctx, { name: 'Barrack3', cx: 38, cz: 4, ry: 0, num: 3, wall: M.brick, roof: M.slate, loot: tumbaLoot }),
			canteen(bctx, { name: 'Canteen', cx: 18, cz: -26, ry: Math.PI, loot: { fridge: { zhivchik: [1, 2, 0.3], peas: 0.1, spore: 0.2 }, cook: { ammo919: [3, 8, 0.3], spore: [1, 3, 0.35], fireaxe: 0.06 } } }),
			club(bctx, { name: 'Club', cx: -10.5, cz: 11.5, ry: 0, loot: { spore: [1, 3, 0.4], ammo919: [3, 6, 0.25], zhivchik: 0.15 } }),
			bath(bctx, { name: 'Bath', cx: -12, cz: -27, ry: -Z, loot: { spore: [1, 2, 0.3], zhivchik: 0.2, ammo919: [2, 5, 0.3], peas: 0.05 } }),
			medchast(bctx, { name: 'Medchast', cx: 11, cz: 12, ry: 0, loot: { zhivchik: [1, 3, 0.65], medkit: [1, 1, 0.25], spore: 0.15 } }),
			shizo(bctx, {
				name: 'Shizo', cx: 46, cz: -19, ry: Math.PI, loot: {
					desk: { ammo919: [4, 10, 0.5], glock17: 0.06, spore: [1, 2, 0.3], zhivchik: 0.2 },
					box: { spore: [2, 5, 0.5], peas: 0.15, ammo12: [3, 6, 0.3], fireaxe: 0.08, deagle: 0.03, ammo50: [2, 5, 0.15] },
				},
			}),
		);
		// прогулочные дворики за ШИЗО: бетонные стенки, сверху решётка, дверцы с юга
		{
			const xs = [38, 42.5, 47, 51.5], z0 = -31, z1 = -27, h = 2.6;
			batch.add(place(box(xs[3] - xs[0], h, 0.25, 1.5), (xs[0] + xs[3]) / 2, h / 2, z0), M.concrete);
			collide((xs[0] + xs[3]) / 2, z0, xs[3] - xs[0], 0.3, 0, true);
			for (const x of xs) { batch.add(place(box(0.25, h, z1 - z0, 1.5), x, h / 2, (z0 + z1) / 2), M.concrete); collide(x, (z0 + z1) / 2, 0.3, z1 - z0, 0, true); }
			for (let i = 0; i < 3; i++) {
				const cx = (xs[i] + xs[i + 1]) / 2;
				for (const [a, b] of [[xs[i], cx - 0.5], [cx + 0.5, xs[i + 1]]]) {
					batch.add(place(box(b - a, h, 0.25, 1.5), (a + b) / 2, h / 2, z1), M.concrete);
					collide((a + b) / 2, z1, b - a, 0.3, 0, true);
				}
				batch.add(place(panel(4.5, 4, 0.75).rotateX(-Z), cx, h + 0.02, (z0 + z1) / 2), P.bars, { cast: false });
			}
		}
		// дворы локалок: бельё — чёрные робы на верёвках, лавки, турники, урны
		const robes = (x0, x1, z) => {
			for (const x of [x0, x1]) { batch.add(place(box(0.08, 2.0, 0.08), x, 1.0, z), M.metalDark); collide(x, z, 0.25, 0.25); }
			batch.add(place(box(x1 - x0, 0.02, 0.02), (x0 + x1) / 2, 1.9, z), M.metalDark);
			for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.7 + rnd() * 0.4) batch.add(place(box(0.55, 0.85, 0.04), x, 1.45, z, rnd() * 0.3 - 0.15), M.tankBlack);
		};
		const turnik = (x, z) => {
			for (const dx of [-0.8, 0.8]) batch.add(place(box(0.08, 2.4, 0.08), x + dx, 1.2, z), M.metalDark);
			batch.add(place(box(1.7, 0.05, 0.05), x, 2.35, z), M.metalDark);
			for (const dx of [-0.8, 0.8]) collide(x + dx, z, 0.25, 0.25);
		};
		robes(-47, -41, -16);
		robes(-46, -40, 12);
		robes(47, 53, -3.5);
		turnik(-25, -17);
		turnik(-44, -4);
		turnik(26, 12);
		for (const [x, z, r] of [[-28, -14.2, Math.PI], [-24, -6.8, 0], [30, -6, 0], [52, 13.6, Math.PI], [-6, 9, Z], [-21, -18, -Z]]) bench(batch, M, x, z, r);
		// между бараком и столовой — бочки с мусором; у бани — поленница
		hazardBarrels(batch, M, collide, 31.5, -33.5, rnd, 3);
		woodpile(batch, M, collide, -17.4, -24, Z);

		// ---------- Промзона (север): стена с воротами, цех, склад, котельная, пилорама ----------
		const promWall = (kb, x0, z0, x1) => {
			const len = x1 - x0, n = Math.max(1, Math.round(len / 4)), sl = len / n, h = 3.4;
			for (let i = 0; i < n; i++) {
				const x = x0 + (i + 0.5) * sl;
				kb.add(place(box(sl - 0.04, h, 0.22, 1.2, 1.2), x, h / 2, z0), M.concrete);
				for (const y of [h * 0.3, h * 0.65]) kb.add(place(box(sl - 0.3, 0.12, 0.28), x, y, z0), M.concreteDark);
			}
			for (let i = 0; i <= n; i++) kb.add(place(box(0.3, h + 0.2, 0.34), x0 + i * sl, (h + 0.2) / 2, z0), M.concreteDark);
			lineCollide(x0, z0, 1, 0, 0, len, 0.4, 0);
			spiral(x0, z0, x1, z0, h + 0.05, 0.25);
		};
		occluder('PromWallW', (kb) => { promWall(kb, IX0, PZ, -36); promWall(kb, -33, PZ, -4); }, { cx: (IX0 - 4) / 2, cz: PZ, ry: 0, hx: (-4 - IX0) / 2, hz: 0.8, top: 4.2 }, 0.25);
		occluder('PromWallE', (kb) => promWall(kb, 4, PZ, IX1), { cx: (4 + IX1) / 2, cz: PZ, ry: 0, hx: (IX1 - 4) / 2, hz: 0.8, top: 4.2 }, 0.25);
		for (const s of [-1, 1]) { batch.add(place(box(0.12, 3.0, 3.9, 1.5), s * 4.1, 1.55, PZ - 2.1), M.metalRust); collide(s * 4.1, PZ - 2.1, 0.25, 3.9); }
		for (let i = 0; i < 6; i++) batch.add(place(new THREE.DodecahedronGeometry(R(0.2, 0.45), 0), -34.5 + R(-1.5, 1.5), R(0.05, 0.2), PZ + R(-1.5, 1.5), R(0, 3), R(0, 3)), M.concreteDark);
		buildings.push(
			ceh(bctx, { name: 'Ceh', cx: -30, cz: -50, ry: Math.PI, loot: { master: { spore: [2, 4, 0.5], ammo919: [4, 8, 0.35], zhivchik: 0.2, ammo545: [5, 10, 0.2] }, tools: { fireaxe: 0.12, ammo12: [3, 6, 0.35], grenade: 0.04 } } }),
			buildWarehouse(bctx, { name: 'PromSklad', cx: 47, cz: -50, ry: Math.PI }),
		);
		// котельная с трубой, угольная куча, эстакада труб к цеху
		occluder('Boiler', (kb) => {
			const x = -2, z = -51, W = 12, D = 9, H = 6.5;
			kb.add(place(box(W, H, D, 1.5), x, H / 2, z), M.brick);
			kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), x, H + 0.15, z), M.roofTar);
			for (const wx of [-4, 0, 4]) kb.add(T.windowUV(new THREE.PlaneGeometry(1.4, 1.6), 1).translate(x + wx, 4.4, z + D / 2 + 0.02), M.window);
			kb.add(place(box(3.2, 3.0, 0.1), x - 3.4, 1.5, z + D / 2 + 0.05), M.metalRust);
			kb.add(place(box(1.0, 2.1, 0.08), x + 3.6, 1.05, z + D / 2 + 0.04), M.metalDark);
			kb.add(place(box(1.2, 1.4, 1.2), x + 3, H + 0.85, z - 2), M.metalRust);
			kb.add(new THREE.PlaneGeometry(3.0, 0.5).translate(x + 0.4, 2.9, z + D / 2 + 0.03), T.signMaterial('КОТЕЛЬНАЯ', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 64 }));
		}, { cx: -2, cz: -51, ry: 0, hx: 6.3, hz: 4.8, top: 7 }, 0.25);
		collide(-2, -51, 12, 9, 0, true);
		chimney(batch, M, collide, 8, -55, 20);
		batch.add(place(blob(2.2, 1, 7).scale(1.4, 0.55, 1.0), -12, 0.35, -57), M.tankBlack);
		collide(-12, -57, 5.4, 3.4);
		pipeRack(batch, M, collide, -16.5, -8.5, -47.5, { y: 4.4, step: 8 });
		// пилорама: навес на столбах, станок с диском, брёвна
		occluder('Sawmill', (kb) => {
			for (const px of [-5, 0, 5]) for (const pz of [-4, 4]) kb.add(place(box(0.25, 3.6, 0.25), 31.5 + px, 1.8, -54 + pz), M.woodGrey);
			kb.add(place(box(11, 0.12, 9, 2), 31.5, 3.7, -54, 0, 0, 0.06), M.roofMetal);
		}, { cx: 31.5, cz: -54, ry: 0, hx: 5.5, hz: 4.5, top: 4 }, 0.2);
		for (const px of [-5, 0, 5]) for (const pz of [-4, 4]) collide(31.5 + px, -54 + pz, 0.4, 0.4);
		batch.add(place(box(6, 0.8, 1.2), 31.5, 0.4, -54), M.metalDark);
		batch.add(place(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 20).rotateX(Z), 31.5, 1.0, -54), M.silver);
		batch.add(place(cylX(0.3, 0.3, 4.5, 10), 30.2, 1.1, -54), M.bark);
		collide(31.5, -54, 6.2, 1.4);
		const logs = (x, z, ry, len = 5) => {
			const c = Math.cos(ry), s = Math.sin(ry);
			for (let r = 0; r < 3; r++) for (let i = 0; i < 5 - r; i++) {
				const lz = (i - (4 - r) / 2) * 0.52;
				batch.add(place(cylX(0.26, 0.26, len, 9), x + lz * s, 0.27 + r * 0.45, z + lz * c, ry), M.bark);
			}
			collide(x, z, len + 0.2, 2.8, ry);
		};
		logs(14, -57.6, 0);
		logs(33, -46.6, 0, 4.5);
		// машины и склады во дворе промзоны
		armyTruck(batch, M, root, collide, 11, -44.5, Z);
		pipePile(batch, M, collide, 50, -42, 0);
		hazardBarrels(batch, M, collide, -12, -44.5, rnd, 5);
		for (const [x, z, r] of [[-20, -42.6, 0.1], [-18.8, -43.4, -0.2], [41, -43.2, 0.2]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(0.9, 0.6, 0.6), x, 0.3, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 0.9, z, r + 0.08), M.metalOlive);
			endProp();
			collide(x, z, 1.0, 0.8, r);
		}
		// хозяйственные ворота: створка распахнута, вторую снёс «Урал» — он так и стоит в проёме
		batch.add(place(box(0.12, 3.6, 3.9, 1.5), PG - PGW + 0.1, 1.85, WZ0 + 2.1), M.metalRust);
		collide(PG - PGW + 0.1, WZ0 + 2.1, 0.25, 3.9);
		for (const x of [PG - PGW - 0.3, PG + PGW + 0.3]) { batch.add(place(box(0.9, WALL_H + 0.6, 1.1), x, (WALL_H + 0.6) / 2, WZ0), M.concreteDark); collide(x, WZ0, 0.9, 1.1); }
		batch.add(place(box(3.9, 0.12, 3.6, 1.5), PG + 1.0, 0.07, WZ0 + 4.0, -0.3), M.metalRust);
		armyTruck(batch, M, root, collide, PG + 1.8, WZ0 + 0.6, 0.12);

		// ---------- Снаружи: стоянка, посёлок сотрудников, кладбище ----------
		for (const [x, z, ry, color, o] of [
			[-27, 47, 0, 0x6a2a22, {}], [-20, 47.3, 0.1, 0x5a5a52, { burned: true }], [-13, 47, -0.05, 0x2a3a5a, {}],
			[-24, 54.5, Math.PI, 0xa8a8a0, { crashed: true }], [-15, 54.8, Math.PI + 0.1, 0x3a4a2a, {}],
		]) { addCar(batch, M, root, x, z, ry, color, o); collide(x, z, 4.3, 1.9, ry); }
		bus(batch, M, root, -36.5, 51, 0.12);
		collide(-36.5, 51, 2.6, 7.8, 0.12);
		billboard(batch, M, root, collide, 9, 46.5, 0, 'СВИДАНИЯ — ПО ПРЕДВАРИТЕЛЬНОЙ ЗАПИСИ', { w: 5, h: 0.9, y: 1.8, bg: '#e8e4d8', fg: '#2a3a5a' });
		/** Двухэтажный дом сотрудников (без входа): кирпич, окна в два ряда, подъезд к улице, двускатная крыша. */
		const house2 = (name, cx, cz, W, D, wall, roof, front = -1) => {
			const H = 6.0, rise = 2.2, hx = W / 2, hz = D / 2, cols = Math.max(2, Math.floor(W / 2.6));
			occluder(name, (kb) => {
				kb.add(place(box(W, H, D, 1.5), cx, H / 2, cz), wall);
				kb.add(place(boxTop(W + 0.3, 0.2, D + 0.3, 2), cx, 3.0, cz), M.concreteDark);
				kb.add(place(boxTop(W + 0.2, 0.45, D + 0.2, 2), cx, 0.22, cz), M.concreteDark);
				for (let f = 0; f < 2; f++) for (let c = 0; c < cols; c++) for (const s of [-1, 1]) {
					const x = cx - hx + (c + 0.5) * W / cols;
					if (s === front && f === 0 && Math.abs(x - cx) < 1.4) continue; // подъезд
					const g = T.windowUV(new THREE.PlaneGeometry(1.1, 1.3), Math.floor(hash01(name, f, c, s) * 4));
					if (s < 0) g.rotateY(Math.PI);
					kb.add(g.translate(x, 1.6 + f * 3, cz + s * (hz + 0.02)), M.window);
				}
				kb.add(place(box(1.3, 2.1, 0.06), cx, 1.05, cz + front * (hz + 0.03)), M.metalDark);
				kb.add(place(box(2.2, 0.1, 1.2), cx, 2.4, cz + front * (hz + 0.6)), M.concrete);
				const slope = Math.hypot(hz + 0.5, rise);
				for (const s of [-1, 1]) kb.add(place(box(W + 0.8, 0.08, slope, 2), cx, H + rise / 2, cz + s * (hz + 0.5) / 2, 0, s * Math.atan2(rise, hz + 0.5)), roof);
				for (const s of [-1, 1]) kb.add(gableTri(cx + s * (hx + 0.01), cz - hz, cz + hz, H, rise, s), wall);
				kb.add(place(boxTop(W + 0.84, 0.1, 0.26, 1), cx, H + rise + 0.04, cz), M.metalRust);
			}, { cx, cz, ry: 0, hx: hx + 0.4, hz: hz + 0.7, top: H + rise }, 0.25);
			collide(cx, cz, W, D, 0, true);
		};
		house2('House1', -52, 74, 14, 9, M.brick, M.slate);
		house2('House2', 20, 74, 16, 9, M.whiteBrick, M.roofTin);
		house2('House3', 44, 74, 12, 8, M.plaster, M.roofMetal);
		house2('Hostel', 32, 51, 18, 9, M.whiteBrick, M.slate, 1);
		buildings.push(buildHouse(bctx, { name: 'StaffHouse', cx: -26, cz: 73, ry: 0, rnd, variant: 0 }));
		fencePlot(batch, M, collide, -26, 73.5, 15, 12, 'n', rnd);
		garden(batch, M, rnd, -30, 78.2, 3, 2.4);
		outhouse(batch, M, collide, -19.8, 78.6, 0);
		woodpile(batch, M, collide, -32, 76, Z);
		// гаражи у общежития
		for (let i = 0; i < 4; i++) {
			const x = 48 + i * 4;
			batch.add(place(box(3.9, 2.6, 6, 1.5), x, 1.3, 50.5), M.brick);
			batch.add(place(box(4.1, 0.15, 6.4, 2), x, 2.7, 50.5, 0, 0.05), M.roofTar);
			batch.add(place(box(2.8, 2.1, 0.05), x, 1.05, 53.53), i === 2 ? M.metalDark : M.metalRust);
		}
		collide(54, 50.5, 16, 6, 0, true);
		for (const [x, z] of [[-40, 67.6], [6, 67.6], [32, 67.6]]) bench(batch, M, x, z, Math.PI);
		// старое кладбище за лесом: холмики, ржавые кресты, покосившаяся ограда
		for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
			const x = 71 + i * 2.2 + R(-0.3, 0.3), z = -29 + r * 4.6 + R(-0.4, 0.4);
			batch.add(place(box(0.9, 0.25, 1.9, 1), x, 0.12, z, R(-0.1, 0.1)), M.dirt, { cast: false });
			batch.add(place(box(0.08, 1.2, 0.08), x, 0.6, z - 0.95, 0, R(-0.1, 0.1), R(-0.12, 0.12)), M.metalRust);
			batch.add(place(box(0.55, 0.07, 0.07), x, 0.95, z - 0.95), M.metalRust);
		}
		fencePlot(batch, M, collide, 77, -20.5, 16, 21, 'w', rnd);

		// колючка — одним набором линий
		root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x3e3c38 })));

		return {
			start: [0, 82.5, Math.PI],
			exits: [
				{ to: 'shahta', x0: -3, x1: 3, z0: -90, z1: -85.2, spawn: [0, -82.5, 0], sign: [4.6, -84, '↑ Шахта'] },
				{ to: 'mikro', x0: -90, x1: -85.2, z0: -3, z1: 3, spawn: [-82.5, 0, Z], sign: [-84, 4.6, '← Микрорайон'] },
				{ to: 'port', x0: -3, x1: 3, z0: 85.2, z1: 90, spawn: [0, 82.5, Math.PI], sign: [4.6, 84, '↓ Порт'] },
			],
			// логово руберов: толпы в бараках и на плацу, рубер в промзоне и у ШИЗО, топтуны стаями по всей колонии
			groups: [
				{ at: [-36, -24.5], r: 5, runners: 4 },
				{ at: [-28, -16.5], r: 4, runners: 3, stompers: 1 },
				{ at: [-34, 4], r: 5, runners: 4 },
				{ at: [-40, -4.5], r: 4, runners: 2, stompers: 1 },
				{ at: [40, 4], r: 5, runners: 4 },
				{ at: [32, -4], r: 4, runners: 3, stompers: 1 },
				{ at: [2, -2], r: 8, runners: 5 },
				{ at: [-10, 2], r: 5, runners: 3, stompers: 1 },
				{ at: [14, -26], r: 5, runners: 4 },
				{ at: [18, -15], r: 4, runners: 2, stompers: 1 },
				{ at: [46, -17], r: 4, rubers: 1, runners: 2 },
				{ at: [45, -25.5], r: 3, stompers: 1, runners: 2 },
				{ at: [-32, -50], r: 6, runners: 4, stompers: 1 },
				{ at: [10, -41], r: 6, rubers: 1, runners: 2 },
				{ at: [47, -50], r: 4, stompers: 1, runners: 2 },
				{ at: [31.5, -51], r: 4, runners: 2 },
				{ at: [-12, -27], r: 3, runners: 2 },
				{ at: [-10.5, 11.5], r: 3, runners: 3 },
				{ at: [11, 12], r: 3, runners: 2 },
				{ at: [-21, 29.5], r: 4, runners: 2, stompers: 1 },
				{ at: [24, 22], r: 4, stompers: 1, runners: 2 },
				{ at: [0, 35], r: 3, runners: 2 },
				{ at: [-55, -36], r: 3, runners: 2 },
				{ at: [-10, -63], r: 3, runners: 1, stompers: 1 },
				{ at: [61, 0], r: 3, runners: 2 },
				{ at: [18, 64], r: 6, runners: 3, stompers: 1 },
				{ at: [-20, 51], r: 5, runners: 2 },
				{ at: [-71, 30], r: 6, runners: 2 },
				{ at: [-30, -76], r: 6, runners: 2, stompers: 1 },
				{ at: [76, -20], r: 6, runners: 2, stompers: 1 },
			],
			onRoad,
			// горит машина на стоянке; бочка с огнём на плацу, костры в промзоне и во дворе третьего отряда
			fires: [[-20, 47.3, 'car'], [-6, 2], [16, -41, 'ground'], [46, -4, 'ground']],
			barrels: 6,
			clutter: 10,
			blood: 22,
			puddles: 10,
			puddle: () => [R(-55, 60), R(-62, 70)],
			grime: 40,
			rubble: 80,
			grass: 0.6,
			beltDensity: 0, // деревья — свои: лес снаружи стены, в колонии почти пусто
			trees(tryTree) {
				const cemetery = (x, z) => x > 67 && x < 87 && z > -33 && z < -8;
				for (let i = 0; i < 80; i++) { const x = R(68, 86), z = R(-86, 86); if (!cemetery(x, z)) tryTree(x, z, rnd() < 0.55 ? 'pine' : 'birch'); }
				for (let i = 0; i < 45; i++) tryTree(R(-86, -76), R(-86, 86), rnd() < 0.5 ? 'pine' : 'birch');
				for (let i = 0; i < 35; i++) tryTree(R(-86, 86), R(-86, -80.5), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 40; i++) tryTree(R(-86, 86), R(79, 86), 'birch');
				for (let i = 0; i < 26; i++) tryTree(R(-66, 62), R(67.5, 79), rnd() < 0.45 ? 'apple' : 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-66, -40), R(42, 58), 'birch');
				// в колонии — редкие берёзы у клуба, медчасти и административного корпуса
				for (const [x, z] of [[-18, 6.5], [-3.5, 15.8], [17.5, 9], [-33, 21], [-8, 21], [14, 20.5]]) tryTree(x, z, 'birch');
			},
			hint: (b) => ({
				Barrack1: 'Барак 1-го отряда — тумбочки у шконок и шкаф в каптёрке',
				Barrack2: 'Барак 2-го отряда — тумбочки у шконок и шкаф в каптёрке',
				Barrack3: 'Барак 3-го отряда — тумбочки у шконок и шкаф в каптёрке',
				Canteen: 'Столовая — холодильник и шкаф повара на кухне',
				Club: 'Клуб — книжный шкаф библиотеки',
				Bath: 'Баня — шкафчики в раздевалке',
				Medchast: 'Медчасть — аптечный шкаф',
				Shizo: 'ШИЗО — стол контролёра и шкаф с изъятым',
				Admin: 'Административный корпус — столы дежурного и оперативника, сейф начальника, шкаф с делами',
				GuardArmory: 'Оружейная охраны — пирамиды, оружейный ящик, сейф, гранаты',
				Kpp: 'КПП — стол дежурного и шкаф',
				Ceh: 'Швейный цех — шкаф мастера и инструментальный ящик',
				PromSklad: 'Склад промзоны — стеллажи и ящики',
				StaffHouse: 'Дом сотрудника колонии',
			}[b.name] ?? null),
		};
	},
};
