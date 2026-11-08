// Кластер «НИИ»: закрытый научный городок (почтовый ящик 17), который Улей забрал целиком — с охраной и подопытными.
// Локация 180×180 м. Ядро — институт за бетонным забором с колючкой и вышками, как прежде: с запада трасса упирается
// в КПП со шлагбаумом (за ним «Урал» охраны и караулка с оружием), на восток уходит через сорванные задние ворота.
// Север института — лабораторный двор: лабораторный корпус, виварий с вольерами, опытный корпус, ёмкости азота и
// кислорода; у ворот мешки с песком и горящий БТР. Во дворе — логово ЭЛИТЫ: гнездо из споровой массы и костей.
// Юг института — заводоуправление со стоянкой, склад, водонапорная башня; в южном заборе — второй КПП в жилой городок.
// Кольцо за забором (запустение, следы прорыва):
// северо-запад — лабораторный корпус «Б» (химлаборатория с вытяжными шкафами, хранилище реактивов, холодильник проб,
// кабинет завлаба; отсюда начался прорыв — угол второго этажа обрушен, у входа споровая масса и брошенное оцепление);
// север — могильник бочек с химией в лесу, антенное поле с радиомачтой на растяжках, тарелками и аппаратной;
// северо-восток — полигон испытаний за забором: воронки, обломки, сгоревший БТР, стенд, бетонная стенка, наблюдательный
// бункер; восток — гаражи и склад НИИ с ГСМ; юг — жилой городок за улицей: общежитие учёных, клуб-столовая, сквер
// с памятником и доской почёта, сгоревший автобус эвакуации; юго-запад — опытное хозяйство: теплицы и оранжерея.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { hash01, boxTop } from '../facade.js';
import { Building, table, chair, bed, buildCheckpoint, buildArmory, buildWarehouse, buildWorkshop, buildGuardhouse } from '../buildings.js';
import { addCar, bus, bench, streetLamp, transformer, blob, greenhouse, garden, markingMaterial } from '../props.js';
import { concreteFence, storageTank, hazardBarrels, btr, armyTruck, barrier, watchTower, sandbags, billboard, waterTower } from '../props-industrial.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Тонкий стержень от точки a до точки b (раскосы мачты, рамы стенда). */
function rod(batch, mat, a, b, r = 0.05, seg = 4) {
	const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
	g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
	batch.add(g, mat);
}

/** Цилиндр для мебели — уже на месте в её осях; axis — вдоль какой оси лежит. */
const cyl = (r, len, px, py, pz, axis = 'y', seg = 12) => {
	const g = new THREE.CylinderGeometry(r, r, len, seg);
	if (axis === 'x') g.rotateZ(Math.PI / 2);
	if (axis === 'z') g.rotateX(Math.PI / 2);
	return g.translate(px, py, pz);
};

// ---------- Мебель-тайники новых построек (лицо мебели — в +Z её осей) ----------

const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);
const safe = (b, name, x, z, rot, loot, h = 1.1) => b.container(name, x, z, rot, [
	[0.7, h, 0.6, 0, h / 2, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, h * 0.64, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, h * 0.64, 0.31, b.IM.black],
], [0.7, 0.6], loot, h);
const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.3, 0.75, 0.7, 0, 0.375, 0, b.IM.furniture], [0.4, 0.3, 0.3, 0.3, 0.9, 0, b.IM.black], [0.3, 0.06, 0.22, -0.35, 0.78, 0.05, b.IM.books[1]],
], [1.3, 0.7], loot, 0.95);
const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal],
	[0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine], [0.3, 0.2, 0.2, -0.6, 1.0, -0.1, b.IM.black],
], [2.0, 0.8], loot, 1.0);
const partsRack = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	...[-1.4, 1.4].flatMap((dx) => [-0.3, 0.3].map((dz) => [0.07, 2.2, 0.07, dx, 1.1, dz, b.IM.rack])),
	...[0.2, 0.9, 1.6, 2.15].map((y) => [2.9, 0.05, 0.7, 0, y, 0, b.IM.rack]),
	[0.8, 0.45, 0.5, -0.8, 0.45, 0, b.IM.crateGreen], [0.6, 0.35, 0.5, 0.6, 0.4, 0, b.IM.machine],
	[1.0, 0.3, 0.5, 0.1, 1.08, 0, b.IM.metal], [0.7, 0.4, 0.5, -0.7, 1.82, 0, b.IM.crate], [0.5, 0.3, 0.45, 0.8, 1.78, 0, b.IM.black],
], [3.0, 0.75], loot, 2.2);
/** Вытяжной шкаф: тумба, рабочая поверхность, стеклянная створка, короб вытяжки к потолку, склянки. */
const hoodParts = (IM) => [
	[1.6, 0.9, 0.75, 0, 0.45, 0, IM.white], [1.6, 0.04, 0.78, 0, 0.92, 0, IM.black],
	[1.6, 1.1, 0.1, 0, 1.5, -0.33, IM.white], [0.08, 1.1, 0.7, -0.76, 1.5, 0, IM.white], [0.08, 1.1, 0.7, 0.76, 1.5, 0, IM.white],
	[1.44, 0.6, 0.03, 0, 1.35, 0.33, IM.glass], [1.6, 0.3, 0.75, 0, 2.2, 0, IM.white], [0.4, 0.8, 0.4, 0, 2.75, -0.1, IM.metal],
	[0.12, 0.2, 0.12, -0.4, 1.05, 0, IM.jars], [0.1, 0.25, 0.1, 0.3, 1.07, -0.1, IM.bottles[0]],
];

// ---------- Постройки кольца, куда заходят ----------

/**
 * Лабораторный корпус «Б» 30×13 м, два этажа (заходят на первый): вход с юга (+Z) под козырьком на столбах, коридор
 * вдоль южной стены, за перегородкой четыре помещения — химлаборатория с вытяжными шкафами, хранилище реактивов,
 * холодильная проб, кабинет завлаба с сейфом (там же запасной выход на север). Второй этаж — фасад (occluder), его
 * северо-восточный угол обрушен: отсюда начался прорыв.
 */
function buildLabB(bctx, occluder, { cx, cz }) {
	const W = 30, D = 13, H = 3.6, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'LabB', cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [0, -11], w: 1.8, lining: IM.whitewash, side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [11], lining: IM.whitewash, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.wall('x', 2.5, -hx + t / 2, hx - t / 2, { mat: IM.whitewash, t: 0.15, doors: [-10, -2.5, 4.5, 11.5] }); // коридор
	for (const k of [-6, 1.5, 8]) b.wall('z', k, -hz + t / 2, 2.5 - 0.075, { mat: IM.whitewash, t: 0.15 });
	const sill = M.whiteBrick;
	for (const x of [-13.5, -8, -5, 3, 7, 10, 13.5]) b.window('back', x, { t, sill });
	for (const x of [-12, -8.5, -3, 0, 4.5, 6.5, 14]) b.window('front', x, { t, sill });
	// вход: козырёк на столбах, крыльцо, сорванная створка двери на ступенях
	b.canopy('back', 0, { w: 3.6, d: 2.0, y: 3.0, mat: M.concrete, posts: M.concrete, t, thick: 0.2 });
	b.lower(place(box(4.2, 0.2, 1.6, 1), 0, 0.1, hz + 0.95), M.concrete);
	b.lower(place(box(0.9, 0.05, 2.0), 1.3, 0.22, hz + 1.3, 0.5), M.metalDark);
	b.wallBox('back', -11 + 1.45, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t });
	// химлаборатория: вытяжные шкафы у северной стены, островной стол, мойка у западной стены
	b.container('Вытяжной шкаф', -12.5, -hz + 0.55, 0, hoodParts(IM), [1.6, 0.78], { chem: [1, 3, 0.65], zhivchik: 0.3, spore: [1, 2, 0.2] }, 2.3);
	b.furniture(-8.6, -hz + 0.55, 0, hoodParts(IM), { solid: [1.6, 0.78] });
	b.furniture(-10.5, -1.8, 0, [
		[3.0, 0.9, 1.2, 0, 0.45, 0, IM.white], [3.1, 0.05, 1.3, 0, 0.92, 0, IM.black], [2.8, 0.04, 0.3, 0, 1.45, 0, IM.metal],
		[0.05, 0.55, 0.05, -1.35, 1.2, 0, IM.metal], [0.05, 0.55, 0.05, 1.35, 1.2, 0, IM.metal],
		[0.12, 0.22, 0.12, -0.8, 1.06, 0.3, IM.jars], [0.1, 0.26, 0.1, 0.4, 1.08, -0.2, IM.bottles[1]], [0.3, 0.2, 0.25, 1.0, 1.04, 0.2, IM.machine],
	], { solid: [3.1, 1.3] });
	b.furniture(-hx + 0.45, -1.5, Math.PI / 2, [[2.2, 0.9, 0.6, 0, 0.45, 0, IM.white], [0.6, 0.15, 0.4, -0.5, 0.86, 0, IM.metal], [0.6, 0.15, 0.4, 0.5, 0.86, 0, IM.metal]], { solid: [2.2, 0.6] });
	// хранилище реактивов: шкаф (тайник) и стеллаж с бутылями
	cabinet(b, 'Шкаф с реактивами', -4.4, -hz + 0.42, 0, 1.2, 2.0, 0.5, { chem: [2, 4, 0.7], zhivchik: [1, 2, 0.35], grenade: 0.04 }, IM.white);
	b.furniture(-1.1, -hz + 0.45, 0, [
		...[-1.1, 1.1].map((dx) => [0.06, 2.0, 0.6, dx, 1.0, 0, IM.rack]), ...[0.2, 0.9, 1.6].map((y) => [2.3, 0.04, 0.6, 0, y, 0, IM.rack]),
		[1.6, 0.35, 0.3, -0.2, 0.42, 0, IM.jars], [1.2, 0.4, 0.3, 0.3, 1.12, 0, IM.bottles[0]], [1.8, 0.3, 0.3, 0, 1.78, 0, IM.white],
	], { solid: [2.3, 0.6] });
	b.furniture(-2.6, -1.2, 0.7, [[0, 0, 0, 0, 0, 0, M.hazard, { geo: cyl(0.3, 0.9, 0, 0.3, 0, 'x') }]], { solid: [0.9, 0.6] }); // опрокинутая бочка
	// холодильная проб: двустворчатый холодильник (тайник), центрифуга на столе
	b.container('Холодильник для проб', 4.75, -hz + 0.5, 0, [
		[1.4, 2.0, 0.7, 0, 1.0, 0, IM.white], [0.02, 1.9, 0.02, 0, 1.0, 0.36, IM.black],
		[0.04, 0.4, 0.04, -0.12, 1.2, 0.38, IM.metal], [0.04, 0.4, 0.04, 0.12, 1.2, 0.38, IM.metal],
	], [1.4, 0.7], { chem: [1, 2, 0.5], zhivchik: [1, 2, 0.5], spore: [1, 3, 0.3] }, 2.0);
	b.furniture(7.3, -2.0, -Math.PI / 2, [[1.6, 0.8, 0.7, 0, 0.4, 0, IM.white], [0, 0, 0, 0, 0, 0, IM.metal, { geo: cyl(0.3, 0.35, 0, 0.98, 0) }]], { solid: [1.6, 0.7] });
	// кабинет завлаба: стол, книжный шкаф, сейф
	table(b, 11.4, -1.6, 0, { w: 1.4, d: 0.8 });
	chair(b, 11.4, -0.9, Math.PI);
	b.furniture(8.45, -3.6, Math.PI / 2, [[2.0, 2.0, 0.45, 0, 1.0, 0, IM.furniture], ...[0.5, 1.0, 1.5].map((y, i) => [1.8, 0.3, 0.3, 0, y, 0.05, IM.books[i]])], { solid: [2.0, 0.45] });
	safe(b, 'Сейф завлаба', hx - 0.5, 0.8, -Math.PI / 2, { spore: [3, 6, 0.6], ammo76251: [5, 10, 0.3], ammo50: [3, 6, 0.25], chem: [1, 2, 0.3], peas: 0.2 });
	// коридор: кабина дезактивации у бокового входа, каталка, скамья
	b.furniture(-13.8, 4.6, 0, [[1.2, 2.2, 0.05, 0, 1.1, -0.6, IM.glass], [0.05, 2.2, 1.2, -0.6, 1.1, 0, IM.glass], [1.2, 0.1, 1.2, 0, 2.25, 0, IM.metal], [0.1, 0.1, 0.4, 0, 2.0, 0, IM.metal]], { solid: [1.2, 1.2] });
	b.furniture(6.2, 5.0, 0.25, [[0.7, 0.08, 1.9, 0, 0.75, 0, IM.metal], [0.65, 0.1, 1.8, 0, 0.82, 0, IM.linen], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.04, 0.72, 0.04, sx * 0.3, 0.36, sz * 0.85, IM.metal])], { solid: [0.75, 1.95] });
	b.furniture(-5, hz - 0.45, Math.PI, [[2.2, 0.45, 0.4, 0, 0.22, 0, IM.furnitureLight]], { solid: [2.2, 0.4] });
	// второй этаж: целая часть над западом и серединой, на северо-востоке обрушен — обломки стен, плита косо
	const y0 = H + 0.4, H2 = 3.4, top = y0 + H2, ix = 8.5; // ix — до какого x этаж уцелел
	occluder('LabBTop', (kb, group) => {
		kb.add(place(box(W + 0.3, 0.4, D + 0.3, 2), cx, H + 0.2, cz), M.concrete);
		kb.add(place(box(ix + hx, H2, D, 2, 1.6), cx + (ix - hx) / 2, y0 + H2 / 2, cz), M.whiteBrick);
		kb.add(planeXZ(ix + hx, D, 4).translate(cx + (ix - hx) / 2, top + 0.02, cz), M.roofTar);
		for (const s of [-1, 1]) kb.add(boxTop(ix + hx + 0.3, 0.4, 0.25, 2).translate(cx + (ix - hx) / 2, top + 0.2, cz + s * (D / 2 + 0.05)), M.concrete);
		kb.add(boxTop(0.25, 0.4, D, 2).translate(cx - hx - 0.05, top + 0.2, cz), M.concrete);
		// обломки: огрызки стен разной высоты, косая плита перекрытия, торчащая арматура
		for (const [x, z, w, d, h] of [[11, hz - 0.15, 5, 0.3, 1.6], [13.5, hz - 0.15, 3, 0.3, 0.7], [hx - 0.15, 3, 0.3, 6.5, 1.1], [hx - 0.15, -2.5, 0.3, 4, 0.5], [10.5, -hz + 0.15, 4, 0.3, 0.9]]) {
			kb.add(place(box(w, h, d, 2, 1.6), cx + x, y0 + h / 2, cz + z), M.whiteBrick);
		}
		kb.add(place(box(6, 0.3, 8, 2), cx + 11.6, y0 + 0.9, cz + 0.5, 0.1, 0, -0.32), M.concrete);
		for (let i = 0; i < 6; i++) kb.add(place(box(0.04, 1.4, 0.04), cx + 9 + i * 0.9, y0 + 0.6, cz - 3 + (i % 3) * 2, 0, 0.4 * (i % 2 ? 1 : -1), 0.3), M.metalRust);
		for (let i = 0; i < 8; i++) for (const s of [1, -1]) {
			const x = -hx + 1.8 + i * 3.1, k = Math.floor(hash01('labB', i, s) * 4);
			if (x > ix - 1) continue;
			const g = T.windowUV(new THREE.PlaneGeometry(1.6, 1.4), [0, 1, 2, 3][k]);
			if (s < 0) g.rotateY(Math.PI);
			kb.add(g.translate(cx + x, y0 + 1.7, cz + s * (D / 2 + 0.02)), M.window);
		}
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.6), T.signMaterial('ЛАБОРАТОРНЫЙ КОРПУС «Б»', { bg: '#e8e4d6', fg: '#2a3a5a', w: 640, h: 60 }));
		sign.position.set(cx, y0 + 0.45, cz + D / 2 + 0.04);
		group.add(sign);
	}, { cx, cz, ry: 0, hx: W / 2 + 0.4, hz: D / 2 + 2.2, top: top + 0.6 }, 0.18);
	return b.finish();
}

/**
 * Общежитие учёных 26×11 м, три этажа (заходят на первый): вход с улицы (север, −Z), коридор вдоль северной стены,
 * на юг — вахта коменданта, две жилые комнаты и умывальная. Вещи брошены в спешке. Этажи 2–3 — фасад (occluder).
 */
function buildSciDorm(bctx, occluder, { cx, cz }) {
	const W = 26, D = 11, H = 3.2, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'SciDorm', cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'home';
	const { M } = bctx, IM = b.IM, paper = IM.wallpaper[1];
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.plaster, t, doors: [0], w: 1.6, lining: paper, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.plaster, t, lining: paper, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, lining: paper, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, lining: IM.whitewash, side: -1 });
	b.wall('x', -2.5, -hx + t / 2, hx - t / 2, { mat: paper, t: 0.15, doors: [-9.75, -3.25, 3.25, 9.75] });
	for (const k of [-6.5, 0, 6.5]) b.wall('z', k, -2.5 + 0.075, hz - t / 2, { mat: paper, t: 0.15 });
	const sill = M.concrete;
	for (const x of [-11.5, -8, -5, -1.5, 1.5, 5, 8, 11.5]) b.window('back', x, { t, sill });
	for (const x of [-11, -7, -3.5, 3.5, 7, 11]) b.window('front', x, { t, sill });
	b.canopy('front', 0, { w: 2.6, d: 1.4, y: 2.7, mat: M.concrete, posts: M.concrete, t, thick: 0.15 });
	b.lower(place(box(2.6, 0.18, 1.2, 1), 0, 0.09, -hz - 0.7), M.concrete);
	b.wallBox('front', 1.4, 1.1, 0.02, 2.05, 0.05, M.woodGrey, { t });
	// вахта коменданта: стол (тайник), ключница, топчан
	desk(b, 'Стол коменданта', -9.75, 3.2, Math.PI, { ammo919: [4, 8, 0.5], zhivchik: 0.3, spore: [1, 3, 0.35], ammo545: [5, 10, 0.2] });
	chair(b, -9.75, 4.1, Math.PI);
	b.furniture(-12.6, 0.6, Math.PI / 2, [[1.0, 0.7, 0.06, 0, 1.6, 0, IM.furniture], ...[-0.3, 0, 0.3].map((x) => [0.04, 0.12, 0.05, x, 1.65, 0.05, IM.metal])], { solid: [0, 0] });
	bed(b, -12.2, 4.3, Math.PI);
	// жилые комнаты: по две кровати, стол между ними, шкаф (тайник) у двери
	bed(b, -5.6, 4.3, Math.PI); bed(b, -0.95, 4.3, Math.PI);
	table(b, -3.3, 4.6, 0, { w: 0.9, d: 0.7 });
	cabinet(b, 'Шкаф', -5.6, -2.1, 0, 1.0, 1.9, 0.55, { ammo919: [3, 6, 0.35], zhivchik: 0.3, chem: [1, 1, 0.25], food: [1, 2, 0.3] });
	bed(b, 0.95, 4.3, Math.PI); bed(b, 5.6, 4.3, Math.PI);
	table(b, 3.25, 4.6, 0, { w: 0.9, d: 0.7 });
	b.furniture(5.4, -2.0, 0, [[1.0, 1.9, 0.55, 0, 0.95, 0, IM.furnitureLight]], { solid: [1.0, 0.55], prop: 'wardrobe' });
	chair(b, 2.6, 1.0, 0.8);
	// умывальная: ряд раковин, зеркала
	b.furniture(9.75, hz - 0.45, Math.PI, [
		[4.4, 0.85, 0.5, 0, 0.42, 0, IM.white], ...[-1.5, 0, 1.5].map((x) => [0.5, 0.12, 0.4, x, 0.9, 0, IM.metal]),
		...[-1.5, 0, 1.5].map((x) => [0.45, 0.6, 0.02, x, 1.6, -0.24, IM.glass]),
	], { solid: [4.4, 0.5] });
	// этажи 2–3: штукатурка, окна из атласа (по месту: целые, выбитые, заклеенные), плоская крыша с парапетом, вывеска
	const y0 = H + 0.35, H2 = 6.0, top = y0 + H2;
	occluder('SciDormTop', (kb, group) => {
		kb.add(place(box(W + 0.3, 0.35, D + 0.3, 2), cx, y0 - 0.17, cz), M.concrete);
		kb.add(place(box(W, H2, D, 2, 1.6), cx, y0 + H2 / 2, cz), M.plaster);
		for (let f = 0; f < 2; f++) for (let i = 0; i < 8; i++) for (const s of [1, -1]) {
			const x = -hx + 1.6 + i * 3.25, h = hash01('scidorm', f, i, s), k = h < 0.25 ? 1 : h < 0.45 ? 2 : h < 0.6 ? 3 : 0;
			const g = T.windowUV(new THREE.PlaneGeometry(1.4, 1.4), k);
			if (s < 0) g.rotateY(Math.PI);
			kb.add(g.translate(cx + x, y0 + 1.5 + f * 3.0, cz + s * (D / 2 + 0.02)), M.window);
		}
		kb.add(planeXZ(W, D, 4).translate(cx, top + 0.03, cz), M.roofTar);
		for (const s of [-1, 1]) {
			kb.add(boxTop(W + 0.4, 0.5, 0.25, 2).translate(cx, top + 0.25, cz + s * (D / 2 + 0.075)), M.concrete);
			kb.add(boxTop(0.25, 0.5, D - 0.1, 2).translate(cx + s * (W / 2 + 0.075), top + 0.25, cz), M.concrete);
		}
		for (const [x, z] of [[-9, 2], [-2, -2.5], [6, 2.2], [10, -2]]) kb.add(boxTop(1.0, 0.8, 0.6, 1).translate(cx + x, top + 0.4, cz + z), M.concrete);
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.7), T.signMaterial('ОБЩЕЖИТИЕ', { bg: '#e8e4d6', fg: '#2a3a5a', w: 512, h: 70 }));
		sign.position.set(cx, y0 + 0.45, cz + D / 2 + 0.04);
		group.add(sign);
	}, { cx, cz, ry: 0, hx: W / 2 + 0.4, hz: D / 2 + 1.0, top: top + 0.6 }, 0.18);
	return b.finish();
}

/**
 * Клуб и столовая учёных 20×12 м: вход с улицы (север, −Z), зал со столами, в западном торце — сцена с занавесом и
 * пианино; за перегородкой на востоке — кухня: плита, мойка, холодильник; раздача — прилавок вдоль перегородки.
 * Крыша двускатная, шифер.
 */
function buildClub(bctx, { cx, cz }) {
	const W = 20, D = 12, H = 4.2, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Club', cx, cz, ry: 0, W, D, H, top: H + 2.0 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [-4], w: 2.0, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [8.6], lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.whitewash, side: -1 });
	b.wall('z', 5, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [-3.8] }); // кухня
	const sill = M.brick;
	for (const x of [-8, 0, 3, 7]) b.window('front', x, { y: 1.9, t, sill });
	for (const x of [-6, -2, 2, 6]) b.window('back', x, { y: 1.9, t, sill });
	for (const z of [-3, 3]) b.window('left', z, { y: 1.9, t, sill });
	b.canopy('front', -4, { w: 3.2, d: 1.6, y: 3.0, mat: M.roofTar, posts: M.brick, t });
	b.lower(place(box(3.2, 0.2, 1.4, 1), -4, 0.1, -hz - 0.8), M.concrete);
	for (const s of [-1, 1]) b.wallBox('front', -4 + s * 1.55, 1.0, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(6.4, 0.8).translate(0, H - 0.6, 0.03), 'back', 0, t), T.signMaterial('СТОЛОВАЯ «ИСТОК»', { bg: '#1e2a44', fg: '#e8e4d0', w: 640, h: 80 }));
	// двускатная шиферная крыша вдоль X, кирпичные фронтоны, труба кухни
	const rise = 1.8, slope = Math.hypot(hz + 0.5, rise);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.8, 0.08, slope, 2), 0, H + rise / 2, s * (hz + 0.5) / 2, 0, s * Math.atan2(rise, hz + 0.5)), M.slate);
	for (const sx of [-1, 1]) {
		const x = sx * (hx + t / 2 + 0.01), a = [x, H, -hz - t / 2], c = [x, H, hz + t / 2], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...a, ...tp, ...c] : [...a, ...c, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 3, rise / 1.5, D / 1.5, 0] : [0, 0, D / 1.5, 0, D / 3, rise / 1.5]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.brick);
	}
	b.top_(place(boxTop(W + 0.84, 0.1, 0.26, 1), 0, H + rise + 0.04, 0), M.metalRust);
	b.chimney(8, 2.5, H + 0.6, H + rise + 1.0, 0.5, M.brick);
	// сцена с занавесом и пианино
	b.furniture(-8.6, 0.5, 0, [[2.8, 0.6, 8.0, 0, 0.3, 0, IM.furniture], [0.06, 3.0, 2.6, 1.3, 2.1, -2.6, IM.blanket], [0.06, 3.0, 2.6, 1.3, 2.1, 3.6, IM.blanket]], { solid: [2.8, 8.0] });
	b.furniture(-6.0, 5.2, Math.PI, [[1.5, 1.2, 0.6, 0, 0.6, 0, IM.black], [1.4, 0.05, 0.3, 0, 0.8, 0.35, IM.white]], { solid: [1.5, 0.7] });
	// зал: столы в два ряда, стулья, часть опрокинута
	for (const x of [-4.6, -1.3, 1.8]) for (const z of [-2.4, 2.0]) table(b, x, z, 0, { w: 1.6, d: 0.8 });
	for (const [x, z, r] of [[-4.6, -1.7, Math.PI], [-1.3, 2.7, 0], [1.8, -3.1, 0], [-1.3, -1.7, Math.PI]]) chair(b, x, z, r);
	// раздача вдоль перегородки (тайник), кухня: плита, мойка, разделочный стол, холодильник (тайник)
	b.container('Раздача', 4.25, 1.2, -Math.PI / 2, [
		[3.0, 1.0, 0.7, 0, 0.5, 0, IM.white], [3.1, 0.05, 0.8, 0, 1.02, 0, IM.metal], [2.6, 0.3, 0.5, 0, 1.2, -0.05, IM.glass], [0.4, 0.25, 0.3, 1.1, 1.17, 0, IM.black],
	], [3.0, 0.7], { food: [1, 2, 0.5], zhivchik: 0.3, ammo919: [3, 6, 0.3], spore: 0.2 }, 1.35);
	b.furniture(8, -hz + 0.6, 0, [[2.0, 0.9, 0.9, 0, 0.45, 0, IM.black], [0, 0, 0, 0, 0, 0, IM.metal, { geo: cyl(0.3, 0.4, -0.5, 1.1, 0) }], [0, 0, 0, 0, 0, 0, IM.metal, { geo: cyl(0.25, 0.3, 0.45, 1.05, 0.1) }]], { solid: [2.0, 0.9], prop: 'stove' });
	b.furniture(6.2, hz - 0.45, Math.PI, [[1.2, 0.9, 0.6, 0, 0.45, 0, IM.white], [0.6, 0.15, 0.4, 0, 0.86, 0, IM.metal]], { solid: [1.2, 0.6] });
	b.furniture(7.5, 0.6, 0, [[1.6, 0.85, 0.8, 0, 0.42, 0, IM.metal]], { solid: [1.6, 0.8] });
	b.container('Холодильник', hx - 0.45, 2.5, -Math.PI / 2, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], [0.62, 0.6], { food: [1, 3, 0.6], zhivchik: [1, 2, 0.4] }, 1.5);
	return b.finish();
}

/**
 * Оранжерея опытного хозяйства 16×9 м: стальной каркас, стены и крыша из стекла (по оси — выбито насквозь), внутри
 * грядки-короба с засохшими и переросшими растениями, стол агронома и шкаф с удобрениями. Вход — с севера (−Z).
 */
function buildOrangery(bctx, { cx, cz }) {
	const W = 16, D = 9, H = 2.8, t = 0.1, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Orangery', cx, cz, ry: 0, W, D, H, top: H + 1.6 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.02, 0), M.dirt, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: IM.glass, t, doors: [0], w: 1.6 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: IM.glass, t, doors: [0], w: 1.6 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: IM.glass, t });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: IM.glass, t });
	// каркас: стойки по периметру, обвязка, стропила и конёк; крыша — два ската стекла
	for (let x = -hx; x <= hx + 0.01; x += 2) for (const s of [-1, 1]) b.top_(place(box(0.08, H, 0.08), x, H / 2, s * hz), M.metalDark);
	for (let z = -hz + 1.5; z < hz; z += 1.5) for (const s of [-1, 1]) b.top_(place(box(0.08, H, 0.08), s * hx, H / 2, z), M.metalDark);
	for (const s of [-1, 1]) b.top_(place(box(W, 0.1, 0.1), 0, H, s * hz), M.metalDark);
	const rise = 1.5, slope = Math.hypot(hz, rise), ang = Math.atan2(rise, hz);
	for (const s of [-1, 1]) {
		b.top_(place(box(W, 0.03, slope), 0, H + rise / 2, s * hz / 2, 0, s * ang), IM.glass, { cast: false });
		for (let x = -hx; x <= hx + 0.01; x += 2) b.top_(place(box(0.07, 0.07, slope), x, H + rise / 2 + 0.04, s * hz / 2, 0, s * ang), M.metalDark);
	}
	b.top_(place(box(W + 0.1, 0.1, 0.12), 0, H + rise, 0), M.metalDark);
	// грядки-короба: земля, засохшая ботва и переросшие кусты
	for (const [i, x] of [-5.6, -2.8, 2.8, 5.6].entries()) {
		const parts = [[1.2, 0.5, 4.6, 0, 0.25, 0, M.woodGrey], [1.1, 0.04, 4.5, 0, 0.5, 0, M.dirt]];
		for (let k = 0; k < 6; k++) {
			const dry = (i + k) % 3 === 0, s = dry ? 0.18 : 0.3 + ((i * 7 + k * 3) % 5) * 0.08;
			parts.push([0, 0, 0, 0, 0, 0, dry ? M.leavesDry : M.leaves, { geo: new THREE.IcosahedronGeometry(s, 0).scale(1, 1.5, 1).translate(((k % 2) - 0.5) * 0.4, 0.55 + s, -1.9 + k * 0.76) }]);
		}
		b.furniture(x, 0.2, 0, parts, { solid: [1.2, 4.6] });
	}
	desk(b, 'Стол агронома', -5.6, 3.7, Math.PI, { chem: [1, 2, 0.45], food: [1, 2, 0.35], zhivchik: 0.25, ammo919: [2, 5, 0.25] });
	cabinet(b, 'Шкаф с удобрениями', 5.6, 4.1, Math.PI, 1.2, 1.9, 0.5, { chem: [1, 3, 0.6], fuel: [1, 1, 0.2], scrap: [1, 2, 0.3] }, IM.locker);
	return b.finish();
}

/**
 * Аппаратная антенного поля 7×5 м: стойки радиоаппаратуры у северной стены, стол дежурного с рацией, шкаф радиста.
 * Вход — с юга (+Z).
 */
function buildRadioHut(bctx, { cx, cz }) {
	const W = 7, D = 5, H = 2.8, t = 0.25, hx = W / 2, hz = D / 2, door = -1.8;
	const b = new Building(bctx, { name: 'RadioHut', cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [door], lining: IM.whitewash, side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.window('back', 1.4, { t, sill: M.whiteBrick }); b.window('left', 0, { t, sill: M.whiteBrick });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.wallBox('back', door - 1.2, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.canopy('back', door, { w: 1.6, d: 0.9, y: 2.35, mat: M.roofTar, t });
	for (const [x, z, h] of [[2.2, -1.2, 2.6], [-2.6, -1.4, 1.8]]) b.top_(place(box(0.06, h, 0.06), x, H + 0.25 + h / 2, z), M.metalDark); // штыри
	b.furniture(0.5, -hz + 0.42, 0, [[3.0, 2.0, 0.6, 0, 1.0, 0, IM.locker], ...[-1, 0, 1].map((x) => [0.8, 0.5, 0.02, x, 1.4, 0.31, IM.screen]), ...[-1, 0, 1].map((x) => [0.1, 0.1, 0.03, x + 0.2, 0.8, 0.31, IM.redBoard])], { solid: [3.0, 0.6] });
	b.furniture(-2.5, 0.4, Math.PI / 2, [[1.4, 0.75, 0.7, 0, 0.375, 0, IM.furniture], [0.5, 0.3, 0.35, 0, 0.9, 0, IM.machine], [0.05, 0.5, 0.05, 0.15, 1.3, 0, IM.black]], { solid: [1.4, 0.7] });
	chair(b, -1.6, 0.4, -Math.PI / 2);
	cabinet(b, 'Шкаф радиста', hx - 0.4, 0.8, -Math.PI / 2, 1.0, 1.9, 0.5, { parts: [1, 2, 0.5], ammo545: [5, 10, 0.3], zhivchik: 0.25, spore: [1, 2, 0.2] }, IM.locker);
	return b.finish();
}

/**
 * Наблюдательный бункер полигона 7×5 м: толстые бетонные стены, смотровые щели на юг и восток, плита с мешками
 * на крыше. Внутри — перископ на тумбе, лавка, ящик с ЗИП. Вход — с востока (+X).
 */
function buildBunker(bctx, { cx, cz }) {
	const W = 7, D = 5, H = 2.4, t = 0.5, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Bunker', cx, cz, ry: 0, W, D, H, top: H + 0.8 });
	b.messKind = 'army';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.concreteDark, t });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.concreteDark, t });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.concreteDark, t });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.concreteDark, t, doors: [0.6] });
	b.top_(place(box(W + 0.8, 0.5, D + 0.8, 3), 0, H + 0.25, 0), M.concreteDark);
	for (const [x, z, ry] of [[-1.6, hz + t / 2 + 0.01, 0], [1.6, hz + t / 2 + 0.01, 0]]) b.top_(place(new THREE.PlaneGeometry(1.8, 0.18), x, 1.6, z, ry), IM.black);
	b.top_(place(new THREE.PlaneGeometry(1.6, 0.18).rotateY(Math.PI / 2), hx + t / 2 + 0.01, 1.6, -1.2), IM.black);
	for (let i = 0; i < 12; i++) b.top_(place(new THREE.SphereGeometry(0.3, 8, 6).scale(1.0, 0.45, 0.7), -2.8 + (i % 6) * 1.1, H + 0.62 + Math.floor(i / 6) * 0.22, (i < 6 ? 1.6 : -1.4)), M.sandbag);
	b.furniture(-1.0, 1.6, 0, [[0.4, 1.1, 0.4, 0, 0.55, 0, IM.machine], [0.12, 0.6, 0.12, 0, 1.4, 0, IM.black], [0.3, 0.15, 0.2, 0, 1.75, 0.1, IM.black]], { solid: [0.45, 0.45] });
	b.furniture(-1.2, -hz + 0.5, 0, [[2.4, 0.45, 0.4, 0, 0.22, 0, IM.furnitureLight]], { solid: [2.4, 0.4] });
	b.container('Ящик с ЗИП', -2.6, 0.2, Math.PI / 2, [[1.0, 0.6, 0.6, 0, 0.3, 0, IM.crateGreen], [1.02, 0.05, 0.62, 0, 0.62, 0, IM.machine], [0.8, 0.45, 0.5, 0.05, 0.86, 0, IM.crateGreen]], [1.0, 0.6], { parts: [1, 3, 0.5], grenade: 0.12, ammo127: [3, 6, 0.15], vog25: [2, 4, 0.12], ammo76254: [5, 10, 0.25] }, 1.1);
	return b.finish();
}

/**
 * Ряд кирпичных гаражей (заходят в открытые): боксы 4×6 м через перегородки, ворота — в южной стене (+Z).
 * loot — что в боксе: { kind: 'bench' | 'shelf', loot } или null (ворота заперты).
 */
function buildGarageRow(bctx, { name, cx, cz, n, loot }) {
	const bay = 4, D = 6, t = 0.25, H = 2.6, W = n * bay, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.3 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	const centers = [...Array(n)].map((_, i) => -hx + bay / 2 + i * bay);
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: centers.filter((_, i) => loot[i]), w: 2.8 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t });
	for (let i = 1; i < n; i++) b.wall('z', -hx + i * bay, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t: 0.15 });
	b.top_(place(box(W + 0.5, 0.14, D + 0.5, 3), 0, H + 0.07, 0), M.roofTar);
	for (const [i, at] of centers.entries()) {
		const L = loot[i];
		if (!L) { b.wallBox('back', at, 2.9, 0.02, 2.15, 0.06, M.metalOlive, { t }); continue; }
		for (const s of [-1, 1]) b.furniture(at + s * 1.4, hz - 0.1, s * -1.65, [[1.35, 2.1, 0.06, s * 0.67, 1.05, 0, M.metalRust]], { up: true });
		if (L.kind === 'bench') workbench(b, 'Верстак', at, -hz + 0.6, 0, L.loot);
		else partsRack(b, 'Стеллаж', at, -hz + 0.55, 0, L.loot);
		if (i % 2) b.furniture(at + 1.25, -hz + 2.3, 0, [[0.6, 0.5, 0.6, 0, 0.25, 0, IM.black]], { solid: [0.6, 0.6], prop: 'tire' });
		else b.furniture(at + 1.25, -hz + 2.3, 0.3, [[0.5, 0.75, 0.5, 0, 0.37, 0, IM.metal]], { solid: [0.5, 0.5], prop: 'barrel' });
	}
	return b.finish();
}

// ---------- Антенное поле и полигон ----------

/** Радиомачта: трёхгранная решётка из красно-белых секций, площадка, штырь, растяжки к бетонным якорям (в wires). */
function radioMast(batch, M, collide, wires, x, z, h = 22) {
	const r = 0.55, legs = [0, 1, 2].map((i) => [Math.cos(i * 2.094 + 0.3) * r, Math.sin(i * 2.094 + 0.3) * r]);
	for (let y = 0, k = 0; y < h - 0.01; y += 3.5, k++) {
		const y1 = Math.min(h, y + 3.5), mat = k % 2 ? M.white : M.red;
		for (const [lx, lz] of legs) batch.add(place(box(0.08, y1 - y, 0.08), x + lx, (y + y1) / 2, z + lz), mat);
		for (let i = 0; i < 3; i++) { const a = legs[i], c = legs[(i + 1) % 3]; rod(batch, mat, [x + a[0], y, z + a[1]], [x + c[0], y1, z + c[1]], 0.03, 3); }
	}
	batch.add(place(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 6), x, 12, z), M.metalDark); // площадка
	batch.add(place(box(0.06, 3, 0.06), x, h + 1.5, z), M.metalDark); // штырь
	for (const a of [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 - 2.094]) {
		const ax = x + Math.cos(a) * 13, az = z + Math.sin(a) * 13;
		batch.add(place(box(1.2, 0.6, 1.2, 1), ax, 0.3, az), M.concreteDark);
		collide(ax, az, 1.3, 1.3);
		for (const y of [7, 14, h - 1]) wires.push(new THREE.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r), new THREE.Vector3(ax, 0.6, az));
	}
	collide(x, z, 1.6, 1.6);
}

/** Тарелка на тумбе: чаша наклонена к югу и повёрнута на ry, облучатель на трёх штангах. */
function dish(batch, M, collide, x, z, ry, r = 2) {
	batch.add(place(new THREE.CylinderGeometry(0.35, 0.5, 1.8, 8), x, 0.9, z), M.concreteDark);
	const m = new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(0.65)).setPosition(x, 2.2 + r * 0.45, z);
	batch.add(box(0.5, 0.7, 0.5).translate(0, -0.35, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, 2.2 + r * 0.45, z)), M.metalDark);
	batch.add(new THREE.CylinderGeometry(r, r * 0.3, r * 0.3, 20).applyMatrix4(m), M.white);
	const focus = new THREE.Vector3(0, r * 0.9, 0).applyMatrix4(m);
	for (let i = 0; i < 3; i++) {
		const p = new THREE.Vector3(Math.cos(i * 2.094) * r * 0.9, r * 0.15, Math.sin(i * 2.094) * r * 0.9).applyMatrix4(m);
		rod(batch, M.metalDark, p.toArray(), focus.toArray(), 0.03, 3);
	}
	batch.add(box(0.25, 0.25, 0.25).translate(focus.x, focus.y, focus.z), M.metalDark);
	collide(x, z, 1.4, 1.4);
}

/** Воронка: валик выброшенной земли и тёмное дно (по ней можно ходить). */
function crater(batch, M, x, z, r) {
	batch.add(place(new THREE.TorusGeometry(r, r * 0.22, 5, 16).rotateX(Math.PI / 2).scale(1, 0.45, 1), x, 0.02, z), M.dirt, { cast: false });
	batch.add(place(new THREE.CircleGeometry(r * 0.95, 16).rotateX(-Math.PI / 2), x, 0.028, z), M.tankBlack, { cast: false });
}

const FX0 = -40, FX1 = 46, FZ0 = -46, FZ1 = 40; // периметр городка
const LAIR = [2, -17]; // гнездо элиты посреди лабораторного двора

export default {
	id: 'nii',
	seed: 1971,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const wires = []; // растяжки мачты и провода антенн — одним набором отрезков
		// споровая масса и кровь — общие материалы для гнезда элиты и следов прорыва у корпуса «Б»
		const flesh = new THREE.MeshStandardMaterial({ color: 0x4a1e1c, roughness: 0.38, metalness: 0.05 });
		const blood = new THREE.MeshStandardMaterial({ map: T.bloodDecalTexture(3), transparent: true, depthWrite: false, roughness: 0.3 });

		// ---------- Дороги, дворы, стоянка ----------
		ground(180, 7, 0, 6, M.asphalt, 5, 0.02); // трасса через городок
		ground(180, 0.15, 0, 6, markingMaterial(), 6, 0.026);
		ground(44, 26.5, 2, -17.25, M.concrete, 4, 0.016); // лабораторный двор — бетонные плиты
		ground(8, 7, 1, -0.5, M.asphalt, 5, 0.019); // от трассы к воротам двора
		ground(12, 20, -35, -18, M.dirt, 4, 0.014); // вытоптанная земля у вольеров
		ground(30, 10, -2, 15.5, M.asphalt, 5, 0.019); // стоянка у заводоуправления
		ground(18, 8, 26, 17.5, M.asphalt, 5, 0.0192); // площадка у склада
		ground(6, 12, 28, -40, M.dirt, 4, 0.014); // проезд к боковой двери опытного корпуса
		ground(10, 6, -28, 12.5, M.concrete, 4, 0.017); // у караулки
		// кольцо: к корпусу «Б», проезд на север вдоль могильника, к полигону, у гаражей и склада, ко второму КПП, улица городка
		ground(6, 57, -58, -26, M.asphalt, 5, 0.0215); // к корпусу «Б»
		ground(32, 8, -58, -58.5, M.concrete, 4, 0.0165); // двор корпуса «Б»
		ground(70, 4, -7, -60.5, M.dirt, 4, 0.0145); // грунтовка к антенному полю и полигону
		ground(6, 58.5, 53, -26.75, M.concrete, 4, 0.0175); // к полигону
		ground(54, 28, 55, -70, M.dirt, 5, 0.0133); // полигон
		ground(22, 9.5, 70, -2.25, M.asphalt, 5, 0.0193); // перед гаражами
		ground(18, 9.5, 70, 14.25, M.asphalt, 5, 0.0194); // перед складом НИИ
		ground(5, 42, 15, 41, M.asphalt, 5, 0.0188); // через второй КПП в городок
		ground(150, 6, 0, 62, M.asphalt, 5, 0.0195); // улица жилого городка
		ground(10, 4.5, -22, 67.25, M.concrete, 4, 0.0168); // у общежития
		ground(8, 4, 40, 67, M.concrete, 4, 0.0168); // у клуба
		ground(30, 18, 13, 75, M.concrete, 3, 0.0142); // сквер
		ground(38, 12, -65, 51, M.dirt, 4, 0.0134); // у теплиц
		ground(38, 19, -63, 75.5, M.dirt, 4, 0.0134); // у оранжереи
		const onRoad = (x, z, m = 0) => Math.abs(z - 6) < 4 + m || (Math.abs(x - 2) < 22 + m && z < -4 + m && z > -30.5 - m)
			|| (Math.abs(x - 1) < 4 + m && z < 3 && z > -4) || (Math.abs(x + 2) < 15 + m && Math.abs(z - 15.5) < 5 + m)
			|| (Math.abs(x - 26) < 9 + m && Math.abs(z - 17.5) < 4 + m)
			|| (Math.abs(x + 58) < 3 + m && z < 3 && z > -55) || (Math.abs(x + 58) < 16 + m && z > -62.5 - m && z < -54.5 + m)
			|| (Math.abs(z + 60.5) < 2 + m && x > -42 && x < 28) || (Math.abs(x - 53) < 3 + m && z < 3 && z > -56)
			|| (x > 28 && x < 82 && z < -56 && z > -84) || (x > -34 && x < 26 && z < -64 && z > -83) // полигон и антенное поле — без деревьев
			|| (Math.abs(x - 70) < 11 + m && z > -7 && z < 19) || (Math.abs(x - 15) < 2.5 + m && z > 20 && z < 62)
			|| (Math.abs(z - 62) < 3 + m && Math.abs(x) < 75);

		// ---------- Периметр: забор с колючкой, КПП со шлагбаумом, задние ворота ----------
		concreteFence(batch, M, collide, root, FX0, FZ0, FX0, -4.6);
		concreteFence(batch, M, collide, root, FX0, 10.4, FX0, FZ1);
		concreteFence(batch, M, collide, root, FX0, FZ0, FX1, FZ0);
		concreteFence(batch, M, collide, root, FX0, FZ1, 6.5, FZ1); // до второго КПП
		concreteFence(batch, M, collide, root, 17.5, FZ1, FX1, FZ1);
		concreteFence(batch, M, collide, root, FX1, FZ0, FX1, 2);
		concreteFence(batch, M, collide, root, FX1, 10, FX1, FZ1);
		buildings.push(buildCheckpoint(bctx, { name: 'Checkpoint', cx: FX0, cz: -1.5, ry: -Math.PI / 2 }));
		barrier(batch, M, collide, FX0, 2.4, Math.PI / 2, 7.2, true);
		for (const [x, z] of [[FX0, 2.2], [FX0, 10.2], [FX1, 1.8], [FX1, 10.2]]) { batch.add(place(box(0.6, 3.2, 0.6), x, 1.6, z), M.concreteDark); collide(x, z, 0.7, 0.7); }
		// задние ворота сорваны и лежат на дороге
		batch.add(place(box(3.8, 0.08, 2.2), 49.5, 0.05, 4.2, 0.35), M.metalOlive);
		batch.add(place(box(3.8, 0.08, 2.2), 48.2, 0.13, 8.4, -0.6, 0.06), M.metalOlive);
		for (const [x, z] of [[FX0 + 2.5, FZ0 + 2.5], [FX1 - 2.5, FZ0 + 2.5], [FX1 - 2.5, FZ1 - 2.5], [FX0 + 2.5, FZ1 - 2.5]]) watchTower(batch, M, collide, x, z);
		billboard(batch, M, root, collide, -52, 12.6, 0, 'СТОЙ! ЗАПРЕТНАЯ ЗОНА · П/Я-17', { w: 5.2, h: 1.1, y: 1.8, bg: '#e8dcc0', fg: '#a01a10' });

		// ---------- Охрана у КПП: «Урал», караулка за мешками ----------
		// караулка и «Урал» — в одном участке отсечения (x −33…0): меньше вызовов отрисовки
		armyTruck(batch, M, root, collide, -27.5, -2.6, Math.PI / 2 + 0.1);
		buildings.push(buildArmory(bctx, { name: 'Guardroom', cx: -28, cz: 18, ry: 0 }));
		sandbags(batch, M, collide, -26, 12.4, 3, 0);
		for (const [x, z, r] of [[-22.6, 18, 0.1], [-22.3, 19.6, 0.5]]) {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		}

		// ---------- Лабораторный корпус (три этажа, без входа: двери заварены) ----------
		{
			const cx = 2, cz = -36, W = 34, D = 11, H = 10.4, fz = cz + D / 2;
			occluder('Lab', (kb, group) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.whiteBrick);
				kb.add(place(box(W + 0.3, 0.7, D + 0.3, 2), cx, 0.35, cz), M.concreteDark); // цоколь
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (const s of [-1, 1]) {
					kb.add(place(box(W + 0.5, 0.45, 0.2), cx, H + 0.5, cz + s * (D / 2 + 0.1)), M.concrete); // парапет
					kb.add(place(box(0.2, 0.45, D + 0.4), cx + s * (W / 2 + 0.1), H + 0.5, cz), M.concrete);
				}
				for (const y of [3.5, 7.0]) kb.add(place(box(W + 0.1, 0.22, 0.12), cx, y, fz + 0.06), M.concrete); // междуэтажные пояса
				// окна: ленты по этажам — выбитые, заклеенные, целые; по месту, без генератора случайных чисел
				for (let i = 0; i < 11; i++) for (let f = 0; f < 3; f++) {
					if (f === 0 && i === 5) continue; // над тамбуром
					const x = cx - W / 2 + 1.9 + i * 3.02, k = [0, 1, 0, 3, 1, 0, 2][(i * 3 + f * 5) % 7];
					const win = T.windowUV(new THREE.PlaneGeometry(1.8, 1.5), k);
					win.translate(x, 1.9 + f * 3.45, fz + 0.01);
					kb.add(win, M.window);
					if (f < 2 && i % 2 === 0) { const back = T.windowUV(new THREE.PlaneGeometry(1.8, 1.5), (k + 1) % 4); back.rotateY(Math.PI); back.translate(x, 1.9 + f * 3.45, cz - D / 2 - 0.01); kb.add(back, M.window); }
				}
				// тамбур входа со стеклянными дверями, козырёк
				kb.add(place(box(6, 3.3, 3, 2, 1.6), cx, 1.65, fz + 1.5), M.whiteBrick);
				kb.add(place(box(6.6, 0.25, 3.6), cx, 3.42, fz + 1.6), M.roofTar);
				kb.add(place(box(2.8, 2.4, 0.06), cx, 1.2, fz + 3.03), M.glass);
				kb.add(place(box(0.12, 2.4, 0.1), cx, 1.2, fz + 3.07), M.metalDark);
				for (const s of [-1, 1]) kb.add(place(box(1.6, 0.1, 0.1), cx + s * 0.75, 1.2, fz + 3.08, 0, 0, s * 0.5), M.metalRust); // двери заварены крест-накрест
				// на крыше: вентиляционные камеры, воздуховод, вытяжная труба
				for (const x of [-12, -4.5, 7, 13]) kb.add(place(box(1.8, 1.3, 1.8, 1), cx + x, H + 0.95, cz - 1.5), M.silver);
				kb.add(place(box(18, 0.7, 0.7, 1), cx - 1, H + 0.65, cz + 2.2), M.silver);
				kb.add(place(new THREE.CylinderGeometry(0.5, 0.65, 7, 12), cx + 15, H + 3.5, cz - 3), M.metalRust);
				const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.62), T.signMaterial('ЛАБОРАТОРНЫЙ КОРПУС № 2', { bg: '#e8e4d6', fg: '#2a3a5a', w: 640, h: 74 }));
				sign.position.set(cx, 4.05, fz + 1.5);
				group.add(sign);
				kb.add(place(box(5.6, 0.75, 0.08), cx, 4.05, fz + 1.46), M.metalDark);
			}, { cx, cz: cz + 1.5, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 1.6, top: H + 1.3 }, 0.18);
			collide(cx, cz, W, D);
			collide(cx, fz + 1.5, 6, 3);
		}

		// ---------- Виварий с вольерами и опытный корпус ----------
		buildings.push(
			buildWarehouse(bctx, { name: 'Vivarium', cx: -25, cz: -18, ry: -Math.PI / 2 }),
			buildWorkshop(bctx, { name: 'LabHall', cx: 31, cz: -22, ry: Math.PI / 2 }),
		);
		// вольеры для подопытных: прутья выгнуты изнутри, дверцы сорваны
		for (const [i, cz] of [-22.5, -17.5, -12.5].entries()) {
			const cx = -35, hw = 2, hd = 2;
			for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) batch.add(place(box(0.12, 2.3, 0.12), cx + dx * hw, 1.15, cz + dz * hd), M.metalDark);
			for (const s of [-1, 1]) {
				batch.add(place(box(2 * hw, 0.08, 0.08), cx, 2.28, cz + s * hd), M.metalDark);
				batch.add(place(box(0.08, 0.08, 2 * hd), cx + s * hw, 2.28, cz), M.metalDark);
			}
			for (let k = -hd + 0.35; k < hd - 0.2; k += 0.38) {
				const bend = i === 1 && Math.abs(k) < 0.8 ? 0.45 : 0; // вырвано изнутри
				batch.add(place(box(0.04, 2.2, 0.04), cx - hw, 1.1, cz + k, 0, 0, bend), M.metalDark);
				batch.add(place(box(0.04, 2.2, 0.04), cx + k, 1.1, cz - hd), M.metalDark);
				batch.add(place(box(0.04, 2.2, 0.04), cx + k, 1.1, cz + hd), M.metalDark);
				if (Math.abs(k) > 0.7 || i === 2) batch.add(place(box(0.04, 2.2, 0.04), cx + hw, 1.1, cz + k, 0, -bend * 0.6), M.metalDark);
			}
			if (i !== 2) batch.add(place(box(1.3, 0.05, 1.0), cx + hw + 0.9, 0.04, cz + 0.3, 0.4), M.metalDark); // сорванная дверца
			collide(cx, cz, 2 * hw + 0.2, 2 * hd + 0.2);
		}
		hazardBarrels(batch, M, collide, -35, -29, rnd, 5);

		// ---------- Ограда двора, ворота с мешками и брошенный БТР ----------
		concreteFence(batch, M, collide, root, -20, -10, -20, -4, { wire: false });
		concreteFence(batch, M, collide, root, -20, -4, -3, -4);
		concreteFence(batch, M, collide, root, 5, -4, 24, -4);
		concreteFence(batch, M, collide, root, 24, -4, 24, -10, { wire: false });
		concreteFence(batch, M, collide, root, -20, -26, -20, -32, { wire: false });
		concreteFence(batch, M, collide, root, -20, -32, -15, -32, { wire: false });
		concreteFence(batch, M, collide, root, 19, -32, 24, -32, { wire: false });
		billboard(batch, M, root, collide, 1, -4, 0, 'ОПАСНО! БИОЛОГИЧЕСКАЯ УГРОЗА', { w: 7.6, h: 1.0, y: 3.4, bg: '#e8c020', fg: '#1a1a1a' });
		sandbags(batch, M, collide, -6.8, -1.4, 3.4, 0);
		sandbags(batch, M, collide, 8.4, -1.6, 2.6, -0.25);
		btr(batch, M, root, collide, 14, -0.6, Math.PI / 2 - 0.22);
		for (const [x, z, r] of [[-3.8, -2.4, 0.2], [6, -2.6, -0.1]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }

		// ---------- Лабораторный двор: ёмкость азота, баллоны, бочки, разбитая машина ----------
		storageTank(batch, M, root, collide, -13.5, -9, 1.5, 4.4, M.tankWhite, null); // сосуд для азота (без надписи — экономия вызова отрисовки)
		{
			// стойка с газовыми баллонами у ворот опытного корпуса
			const x = 19.6, z = -12.5;
			batch.add(place(box(0.1, 1.5, 3.2), x - 0.45, 0.75, z), M.metalDark);
			batch.add(place(box(0.9, 0.08, 3.2), x, 1.2, z), M.metalDark);
			for (let i = 0; i < 7; i++) {
				const tipped = i === 5;
				const g = new THREE.CylinderGeometry(0.13, 0.13, 1.5, 10);
				if (tipped) batch.add(place(g.rotateZ(Math.PI / 2), x + 1.2, 0.13, z + 1.4, 0.7), M.red);
				else batch.add(place(g, x, 0.75, z - 1.35 + i * 0.42), i % 3 ? M.metalDark : M.red); // чёрные — азот, красные — пропан
			}
			collide(x, z, 1.0, 3.3);
		}
		hazardBarrels(batch, M, collide, -12, -27.4, rnd, 5);
		hazardBarrels(batch, M, collide, 18.4, -27, rnd, 4);
		addCar(batch, M, root, 12.5, -24, 0.5, 0xb8b0a0, { crashed: true });
		collide(12.5, -24, 4.3, 1.8, 0.5);
		// брошенные ящики
		for (const [x, z, r] of [[-9, -20.5, 0.3], [-8.2, -21.6, 1.1], [16, -7.5, 0.2]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood);
			endProp();
			collide(x, z, 1.2, 0.9, r);
		}

		// ---------- Гнездо элиты: споровая масса, кости, кровь (не мешает ходить) ----------
		{
			const [lx, lz] = LAIR;
			// бугры споровой массы кольцом вокруг гнезда (середина свободна — там бой)
			for (let i = 0; i < 14; i++) {
				const a = i * 0.449 * Math.PI, d = 3.2 + (i % 4) * 0.7, s = 0.4 + (i % 3) * 0.22;
				batch.add(place(blob(s, 1, 17 + i).scale(1.3, 0.5, 1), lx + Math.cos(a) * d, s * 0.12, lz + Math.sin(a) * d, a), flesh, { cast: false });
			}
			// тяжи споровой массы извиваются по плитам от гнезда
			for (let i = 0; i < 7; i++) {
				let a = i * 0.9 + 0.4, x = lx + Math.cos(a) * 2.8, z = lz + Math.sin(a) * 2.8;
				for (let k = 0; k < 6; k++) {
					a += Math.sin(i * 3.1 + k * 1.7) * 0.45;
					const len = 1.1, nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len, r = 0.13 - k * 0.015;
					batch.add(place(new THREE.CylinderGeometry(r * 0.8, r, len + 0.12, 6).rotateZ(Math.PI / 2).scale(1, 0.6, 1), (x + nx) / 2, 0.05, (z + nz) / 2, -a), flesh, { cast: false });
					x = nx; z = nz;
				}
			}
			for (let i = 0; i < 12; i++) {
				const a = i * 2.1, d = 1 + (i % 5) * 0.9;
				batch.add(place(new THREE.CylinderGeometry(0.04, 0.05, 0.5 + (i % 3) * 0.2, 6).rotateZ(Math.PI / 2), lx + Math.cos(a) * d, 0.05, lz + Math.sin(a) * d, a * 1.7), M.concrete, { cast: false }); // кости
			}
			for (let i = 0; i < 7; i++) {
				const s = 1.6 + (i % 3) * 0.8, a = i * 0.9;
				batch.add(place(new THREE.PlaneGeometry(s, s).rotateX(-Math.PI / 2), lx + Math.cos(a) * (i % 4) * 1.4, 0.031 + i * 0.0004, lz + Math.sin(a) * (i % 4) * 1.4, a), blood, { cast: false });
			}
		}

		// ---------- Ёмкости у опытного корпуса ----------
		storageTank(batch, M, root, collide, 30, -4.2, 2.2, 6, M.tankWhite, 'АЗОТ');
		storageTank(batch, M, root, collide, 36.6, -4.2, 2.2, 6, M.tankWhite, 'КИСЛОРОД');
		hazardBarrels(batch, M, collide, 41.5, -7, rnd, 4);

		// ---------- Юг: заводоуправление НИИ со стоянкой ----------
		{
			const cx = -2, cz = 27, W = 28, D = 10, H = 7.2, nz = cz - D / 2;
			occluder('Admin', (kb, group) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.brick);
				kb.add(place(box(W + 0.3, 0.6, D + 0.3, 2), cx, 0.3, cz), M.concreteDark);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (let i = 0; i < 9; i++) for (let f = 0; f < 2; f++) {
					for (const face of [1, -1]) {
						if (face < 0 && f === 0 && i === 4) continue; // вход
						const win = T.windowUV(new THREE.PlaneGeometry(1.4, 1.5), [0, 3, 0, 1, 0, 2, 0, 1, 3][(i * 4 + f * 3 + (face > 0 ? 0 : 5)) % 9]);
						if (face < 0) win.rotateY(Math.PI);
						win.translate(cx - W / 2 + 2 + i * 3, 1.9 + f * 3.2, cz + face * (D / 2 + 0.01));
						kb.add(win, M.window);
					}
				}
				// вход с трассы: козырёк на столбах, крыльцо, двери
				kb.add(place(box(2.4, 2.4, 0.1), cx, 1.2, nz - 0.05), M.metalDark);
				kb.add(place(box(4.4, 0.2, 2), cx, 3.0, nz - 1), M.concrete);
				for (const s of [-1, 1]) kb.add(place(box(0.25, 3, 0.25), cx + s * 2, 1.5, nz - 1.8), M.concrete);
				kb.add(place(box(4, 0.3, 1.6, 1), cx, 0.15, nz - 0.8), M.concrete);
				const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), T.signMaterial('НИИ П/Я-17', { bg: '#1e2a44', fg: '#e8e4d0', w: 640, h: 100 }));
				sign.position.set(cx, H + 1.05, cz + D / 2 - 0.4);
				group.add(sign);
				kb.add(place(box(9.2, 0.15, 0.15), cx, H + 0.3, cz + D / 2 - 0.45), M.metalDark);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 1.9, top: H + 1.8 }, 0.22);
			collide(cx, cz, W, D);
			for (const s of [-1, 1]) collide(cx + s * 2, nz - 1.8, 0.4, 0.4);
		}
		addCar(batch, M, root, -12, 17.5, Math.PI / 2, 0x3a5a6a);
		collide(-12, 17.5, 4.3, 1.8, Math.PI / 2);
		addCar(batch, M, root, -8.6, 17.8, Math.PI / 2 + 0.12, 0x7a2a22);
		collide(-8.6, 17.8, 4.3, 1.8, Math.PI / 2 + 0.12);
		addCar(batch, M, root, 7.5, 17.2, -Math.PI / 2 + 0.2, 0x5a5a3a, { burned: true });
		collide(7.5, 17.2, 4.3, 1.8, -Math.PI / 2 + 0.2);
		for (const x of [15, 32]) streetLamp(batch, M, collide, x, 11.2);
		transformer(batch, root, M, collide, 16, 15);

		// ---------- Склад, задний пост, водонапорная башня ----------
		buildings.push(
			buildWarehouse(bctx, { name: 'Store', cx: 26, cz: 27, ry: 0 }),
			buildGuardhouse(bctx, { name: 'Post', cx: 40, cz: 15, ry: 0 }),
		);
		occluder('WaterTower', (kb) => waterTower(kb, M, collide, 40.5, 31), { cx: 40.5, cz: 31, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);
		hazardBarrels(batch, M, collide, 20, 35.6, rnd, 4);

		// ---------- Окраина, за забором ----------
		// запад: брошенный «Урал» и бетонные блоки на трассе перед КПП
		armyTruck(batch, M, root, collide, -51, -0.4, Math.PI / 2 - 0.08);
		for (const [x, z, r] of [[-46, 3.6, 0.1], [-44.6, 8.6, -0.15], [-56, 10.8, 0.4]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }
		// север: могильник — бочки с химией в лесу
		hazardBarrels(batch, M, collide, -8, -55, rnd, 6);
		hazardBarrels(batch, M, collide, 4, -57, rnd, 5);
		hazardBarrels(batch, M, collide, 14, -54, rnd, 6);
		// восток: разбитая машина у дороги
		addCar(batch, M, root, 55, 3.6, 0.25, 0x6a6a5a, { crashed: true });
		collide(55, 3.6, 4.3, 1.8, 0.25);

		// ---------- Второй КПП в южном заборе: проход в жилой городок ----------
		buildings.push(buildCheckpoint(bctx, { name: 'Checkpoint2', cx: 9.5, cz: FZ1, ry: 0 }));
		barrier(batch, M, collide, 17.3, FZ1, Math.PI, 4.6, true);
		sandbags(batch, M, collide, 21, 44.6, 3.2, 0.2);
		addCar(batch, M, root, 22.5, 50.5, Math.PI / 2 + 0.3, 0x4f5a36, { model: 'e_uaz' });
		collide(22.5, 50.5, 4.3, 1.8, Math.PI / 2 + 0.3);

		// ---------- Лабораторный корпус «Б» (северо-запад): отсюда начался прорыв ----------
		buildings.push(buildLabB(bctx, occluder, { cx: -58, cz: -69 }));
		{
			// брошенное оцепление: мешки, «Урал», сгоревшая машина на подъезде
			sandbags(batch, M, collide, -67, -56.5, 4, 0.3);
			sandbags(batch, M, collide, -48.5, -55.8, 3, -0.2);
			armyTruck(batch, M, root, collide, -47.5, -59.2, Math.PI / 2 + 0.25);
			addCar(batch, M, root, -56.5, -46, 0.3, 0x5a5a62, { burned: true });
			collide(-56.5, -46, 4.3, 1.8, 0.3);
			for (const [x, z, r] of [[-64.5, -54.6, 0.2], [-62.8, -54.2, -0.1]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }
			// обрушенный угол: груда кирпича и плит у восточной стены
			for (let i = 0; i < 8; i++) batch.add(place(blob(0.6 + (i % 3) * 0.3, 0, 70 + i).scale(1.3, 0.55, 1), -41.3 + (i % 3) * 0.8 - 0.8, 0.25 + (i % 2) * 0.25, -74 + Math.floor(i / 3) * 1.4, i), M.concrete);
			batch.add(place(box(3.4, 0.25, 2.2), -41.6, 0.5, -71.6, 0.4, 0.25, 0.1), M.concrete);
			collide(-41.4, -72.6, 3.2, 4.6);
			// споровая масса ползёт из дверей и по стене, кровь на плитах
			for (let i = 0; i < 9; i++) {
				const a = i * 0.7, d = 1.2 + (i % 3) * 0.9, sz = 0.2 + (i % 3) * 0.1;
				batch.add(place(blob(sz, 1, 90 + i).scale(1.4, 0.3, 1), -58 + Math.cos(a) * d * 1.6, sz * 0.1, -61 + Math.sin(a) * d * 0.6, a), flesh, { cast: false });
			}
			for (const [x, z, sz] of [[-66, -62.3, 0.4], [-49, -62.3, 0.35], [-43.2, -66, 0.45]]) batch.add(place(blob(sz, 1, 11).scale(1.6, 1.4, 0.4), x, 1.2, z), flesh, { cast: false });
			for (let i = 0; i < 4; i++) batch.add(place(new THREE.PlaneGeometry(2 + i * 0.5, 2 + i * 0.5).rotateX(-Math.PI / 2), -60 + i * 3.1, 0.031 + i * 0.0004, -58.5 + (i % 2) * 1.5, i), blood, { cast: false });
		}

		// ---------- Антенное поле: радиомачта на растяжках, тарелки, ряд диполей, аппаратная ----------
		buildings.push(buildRadioHut(bctx, { cx: -28, cz: -70 }));
		radioMast(batch, M, collide, wires, -12, -76);
		dish(batch, M, collide, -24, -78.5, 0.5, 2.0);
		dish(batch, M, collide, 2, -71, -0.4, 1.6);
		dish(batch, M, collide, 13, -79, 0.2, 2.4);
		{
			const xs = [-4, 3, 10, 17, 24], z = -64.6;
			xs.forEach((x, i) => {
				batch.add(place(box(0.12, 8, 0.12), x, 4, z), M.metalDark);
				batch.add(place(box(2.6, 0.08, 0.08), x, 7.6, z), M.metalDark);
				collide(x, z, 0.35, 0.35);
				if (i) for (const off of [-1.2, 1.2]) wires.push(new THREE.Vector3(xs[i - 1] + off, 7.6, z), new THREE.Vector3(x + off, 7.6, z));
			});
		}

		// ---------- Полигон испытаний (северо-восток): забор, воронки, обломки, сгоревший БТР, стенд, бункер ----------
		{
			const X0 = 28, X1 = 82, Z0 = -56, Z1 = -84;
			concreteFence(batch, M, collide, root, X0, Z0, 50, Z0);
			concreteFence(batch, M, collide, root, 56, Z0, X1, Z0);
			concreteFence(batch, M, collide, root, X1, Z0, X1, Z1);
			concreteFence(batch, M, collide, root, X0, Z1, X1, Z1);
			concreteFence(batch, M, collide, root, X0, Z0, X0, -58.5); // калитка с грунтовки: z −62,5…−58,5
			concreteFence(batch, M, collide, root, X0, -62.5, X0, Z1);
			billboard(batch, M, root, collide, 53, -55.3, 0, 'ПОЛИГОН · ПРОХОД ЗАПРЕЩЁН', { w: 5.6, h: 0.8, y: 3.2, bg: '#e8c020', fg: '#1a1a1a' });
			for (const [x, z, r] of [[36, -62, 2.2], [45, -73, 3.0], [58, -64, 2.5], [67, -77, 2.0], [74, -61, 1.8], [41, -81, 1.6], [61, -72, 1.4], [77, -70, 2.2], [50, -82, 1.5]]) crater(batch, M, x, z, r);
			btr(batch, M, root, collide, 66, -66, 0.6);
			// бетонная стенка-мишень, часть блоков сбита
			for (let i = 0; i < 8; i++) {
				const x = 44 + i * 1.9, fallen = i === 3 || i === 6, r = fallen ? 0.6 : 0.02 * (i % 3);
				beginProp('block', x, fallen ? -74.6 : -76, r);
				batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, fallen ? -74.6 : -76, r), M.concreteDark);
				if (!fallen && i % 2 === 0) batch.add(place(box(1.8, 0.9, 0.9, 1), x, 1.35, -76, 0.05), M.concreteDark);
				endProp();
				collide(x, fallen ? -74.6 : -76, 1.8, 0.9, r);
			}
			// испытательный стенд: рама из труб, на ней — обгоревший корпус изделия
			{
				const x = 39, z = -66, h = 4;
				for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) rod(batch, M.metalRust, [x + dx, 0, z + dz], [x + dx * 0.6, h, z + dz * 0.6], 0.09, 5);
				batch.add(place(box(2.4, 0.15, 2.4), x, h, z), M.metalRust);
				batch.add(place(new THREE.CylinderGeometry(0.6, 0.7, 2.6, 10).rotateZ(Math.PI / 2), x, h + 0.7, z, 0.4), M.tankBlack);
				collide(x, z, 3.6, 3.6);
			}
			// мишени-щиты и скрученное железо
			for (let i = 0; i < 6; i++) { const x = 64 + i * 2.6; batch.add(place(box(0.7, 1.7, 0.05), x, 0.85, -82.5, 0, 0, (i % 3 - 1) * 0.15), M.woodGrey); collide(x, -82.5, 0.8, 0.2); }
			for (const [x, z, w, ry, rz] of [[50, -60, 3.0, 0.4, 0.3], [56.5, -69.5, 2.2, 1.6, -0.4], [71, -80, 2.6, 2.4, 0.2], [34, -73, 1.8, 0.9, 0.5], [47.5, -66.5, 2.4, 2.9, -0.2]]) {
				batch.add(place(box(w, 0.12, 0.6), x, 0.25, z, ry, 0, rz), M.metalRust);
				batch.add(place(box(w * 0.6, 0.08, 0.4), x + 0.3, 0.12, z + 0.4, ry + 0.7, 0.3, 0), M.metalDark);
			}
			buildings.push(buildBunker(bctx, { cx: 33.5, cz: -79 }));
		}

		// ---------- Гаражи и склад НИИ (восток) ----------
		buildings.push(
			buildGarageRow(bctx, { name: 'NiiGarages', cx: 70, cz: -10, n: 5, loot: [
				{ kind: 'bench', loot: { parts: [1, 2, 0.45], scrap: [1, 3, 0.45], fuel: [1, 1, 0.3], ammo545: [5, 10, 0.3] } },
				null,
				{ kind: 'shelf', loot: { fuel: [1, 2, 0.4], scrap: [2, 3, 0.4], parts: [1, 1, 0.3], ammo762: [5, 10, 0.25] } },
				null, null,
			] }),
			buildWarehouse(bctx, { name: 'Store2', cx: 70, cz: 24, ry: 0 }),
		);
		storageTank(batch, M, root, collide, 76, -24, 1.8, 4.5, M.khaki, 'ГСМ');
		hazardBarrels(batch, M, collide, 66, -22.5, rnd, 5);
		armyTruck(batch, M, root, collide, 66, -30, Math.PI / 2 - 0.1);
		armyTruck(batch, M, root, collide, 57.5, 24.5, 0.05);
		hazardBarrels(batch, M, collide, 80.5, 30.5, rnd, 5);
		for (const [x, z, r] of [[60.2, 15.2, 0.3], [61.4, 16.6, 1.0], [79.6, 15, 0.2]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood);
			endProp();
			collide(x, z, 1.2, 0.9, r);
		}

		// ---------- Жилой городок (юг): общежитие учёных, клуб-столовая, сквер, сгоревший автобус эвакуации ----------
		buildings.push(
			buildSciDorm(bctx, occluder, { cx: -22, cz: 75 }),
			buildClub(bctx, { cx: 44, cz: 75 }),
		);
		bus(batch, M, root, 28, 62, -Math.PI / 2 + 0.12);
		collide(28, 62, 2.6, 7.8, -Math.PI / 2 + 0.12);
		addCar(batch, M, root, -44, 63.8, 0.2, 0x7a2a22, { crashed: true });
		collide(-44, 63.8, 4.3, 1.8, 0.2);
		addCar(batch, M, root, 60, 60.6, Math.PI - 0.15, 0xb8b0a0);
		collide(60, 60.6, 4.3, 1.8, Math.PI - 0.15);
		{
			// сквер: памятник основателю НИИ, клумбы с сухостоем, лавочки, доска почёта, фонари
			batch.add(place(box(2.2, 0.4, 2.2, 1), 13, 0.2, 76), M.concrete);
			batch.add(place(box(1.4, 1.8, 1.4, 1), 13, 1.3, 76), M.concreteDark);
			batch.add(place(box(1.0, 0.6, 0.6), 13, 2.5, 76), M.metalDark);
			batch.add(place(new THREE.SphereGeometry(0.34, 12, 8), 13, 3.05, 76), M.metalDark);
			collide(13, 76, 2.3, 2.3);
			for (const x of [5, 21]) {
				batch.add(place(box(4.0, 0.4, 2.0, 1), x, 0.2, 76), M.concrete);
				batch.add(place(box(3.7, 0.04, 1.7), x, 0.41, 76), M.dirt);
				for (let k = 0; k < 6; k++) batch.add(place(new THREE.IcosahedronGeometry(0.2 + (k % 3) * 0.06, 0).scale(1, 1.3, 1), x - 1.4 + k * 0.56, 0.6, 76 + ((k % 2) - 0.5) * 0.7), M.leavesDry);
				collide(x, 76, 4.0, 2.0);
			}
			bench(batch, M, 5, 72.4, Math.PI);
			bench(batch, M, 21, 72.4, Math.PI);
			bench(batch, M, 2, 80, 0.1);
			billboard(batch, M, root, collide, 13, 83, 0, 'ДОСКА ПОЧЁТА НИИ П/Я-17', { w: 5.6, h: 1.0, y: 1.6, bg: '#8a2a20', fg: '#f0e6c8' });
			for (const x of [0, 26]) streetLamp(batch, M, collide, x, 67.6);
		}

		// ---------- Опытное хозяйство (юго-запад): теплицы-арки, оранжерея, грядки ----------
		for (const x of [-80, -74, -68, -62, -56, -50]) greenhouse(batch, M, collide, x, 51, 9, 3.6, 0);
		buildings.push(buildOrangery(bctx, { cx: -62, cz: 74 }));
		garden(batch, M, rnd, -78, 79, 5, 8);
		hazardBarrels(batch, M, collide, -48.5, 70, rnd, 4);

		// растяжки и провода антенн — одним мешем
		root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wires), new THREE.LineBasicMaterial({ color: 0x2a2a2a })));

		return {
			start: [-82.5, 6, Math.PI / 2],
			exits: [
				{ to: 'forpost', x0: -90, x1: -85.2, z0: 2, z1: 10, spawn: [-82.5, 6, Math.PI / 2], sign: [-84, 11.2, '← Форпост'] },
				{ to: 'aerodrom', x0: 85.2, x1: 90, z0: 2, z1: 10, spawn: [82.5, 6, -Math.PI / 2], sign: [84, 11.2, 'Аэродром →'] },
			],
			// логово элиты: во дворе лаборатории — только элита со своей стаей (рубер и бегуны), остальные — вокруг двора:
			// руберы в опытном корпусе, на стоянке и у ёмкостей; топтуны в виварии, за корпусами и у ворот
			groups: [
				{ at: LAIR, r: 6, elites: 1, rubers: 1, runners: 4 },
				{ at: [31, -22], r: 4, rubers: 1, runners: 1 },
				{ at: [-25, -18], r: 3, stompers: 1, runners: 1 },
				{ at: [-8, -43], r: 4, stompers: 1, runners: 2 },
				{ at: [42, -24], r: 4, runners: 2, stompers: 1 },
				{ at: [-32, 4], r: 5, runners: 2, stompers: 1 },
				{ at: [-2, 14], r: 6, runners: 2, rubers: 1 },
				{ at: [26, 18], r: 5, stompers: 1, runners: 1 },
				{ at: [34, -9], r: 4, rubers: 1 },
				{ at: [40, 6], r: 5, runners: 2 },
				{ at: [12, 6], r: 8, runners: 2 },
				{ at: [-28, 30], r: 5, runners: 1, stompers: 1 },
				{ at: [10, -42], r: 5, runners: 2 },
				// окраина
				{ at: [-54, 20], r: 6, runners: 2 },
				{ at: [54, -20], r: 6, runners: 1, stompers: 1 },
				{ at: [3, -52], r: 6, stompers: 1, runners: 1 },
				{ at: [-20, 54], r: 7, runners: 2, stompers: 1 },
				{ at: [54, 32], r: 6, runners: 2 },
				// кольцо: корпус «Б», антенное поле, полигон, гаражи и склад, второй КПП, городок, опытное хозяйство
				{ at: [-58, -69], r: 6, rubers: 1, runners: 2 },
				{ at: [-52, -57], r: 6, stompers: 1, runners: 2 },
				{ at: [-58, -30], r: 6, runners: 2 },
				{ at: [-12, -70], r: 7, stompers: 1, runners: 2 },
				{ at: [56, -70], r: 7, rubers: 1, runners: 2 },
				{ at: [40, -78], r: 5, stompers: 1, runners: 1 },
				{ at: [70, -3], r: 6, runners: 2, stompers: 1 },
				{ at: [70, 14], r: 5, rubers: 1, runners: 1 },
				{ at: [15, 50], r: 5, runners: 2 },
				{ at: [-22, 66], r: 6, runners: 2, stompers: 1 },
				{ at: [44, 66], r: 6, rubers: 1, runners: 1 },
				{ at: [13, 70], r: 7, runners: 1 },
				{ at: [-64, 60], r: 7, stompers: 1, runners: 2 },
			],
			onRoad,
			// горит брошенный БТР у ворот двора, бочка у КПП, тлеет у вольеров; горят машина у корпуса «Б» и автобус на улице
			fires: [[14, -0.6, 'car', 2.1], [-34.5, 9.8], [-30, -26, 'ground'], [-56.5, -46, 'car'], [28, 62, 'car', 3.2]],
			barrels: 6,
			trees(tryTree) {
				// за забором — лес: полоса между забором и грунтовкой на севере (там могильник), на западе — до мути, на юге —
				// до улицы, на востоке — у склада и гаражей; по краю мути; в городке — берёзы вдоль трассы, у заводоуправления, в сквере
				for (let i = 0; i < 26; i++) tryTree(R(-40, 46), R(-57, FZ0 - 1.5), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 36; i++) tryTree(R(-86, FX0 - 1.5), R(-50, 44), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 16; i++) tryTree(R(-38, 46), R(FZ1 + 1.5, 57), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 20; i++) tryTree(R(FX1 + 1.5, 86), R(-54, 52), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 14; i++) tryTree(R(-86, -74), R(-86, -50), rnd() < 0.8 ? 'pine' : 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-40, 26), R(-86, -83.5), 'pine');
				for (let i = 0; i < 12; i++) tryTree(R(-86, 86), R(82, 86), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 12; i++) tryTree(R(-24, 34), R(10.5, 12.5), 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-36, 44), R(33, 38), 'birch');
				for (let i = 0; i < 6; i++) tryTree(R(-2, 28), R(79.5, 84), 'birch');
			},
			clutter: 14,
			blood: 30,
			puddles: 12,
			puddle: () => { const k = rnd(); return k < 0.4 ? [R(-86, 86), R(3, 9)] : k < 0.7 ? [R(-20, 24), R(-28, -6)] : [R(-72, 72), R(59, 65)]; },
			grass: 0.7,
			beltTrees: ['pine', 'pine', 'birch'],
			hint: (b) => ({
				Checkpoint: 'КПП НИИ — стол дежурного и шкаф',
				Guardroom: 'Караулка охраны — пирамиды с оружием, ящик гранат, сейф',
				Vivarium: 'Виварий — стеллажи с ящиками; клетки пусты',
				LabHall: 'Опытный корпус — шкафчики в раздевалке, верстак, сейф заведующего',
				Store: 'Склад НИИ — стеллажи с ящиками, бывают гранаты',
				Post: 'Пост у задних ворот — шкаф охранника и сейф',
				Checkpoint2: 'Второй КПП — стол дежурного и шкаф',
				LabB: 'Корпус «Б» — вытяжной шкаф, реактивы, холодильник проб, сейф завлаба: химия',
				RadioHut: 'Аппаратная антенного поля — шкаф радиста: детали',
				Bunker: 'Бункер полигона — ящик с ЗИП: детали, бывают гранаты и выстрелы',
				NiiGarages: 'Гаражи НИИ — верстак и стеллаж: детали, лом, бензин',
				Store2: 'Склад НИИ у задних ворот — стеллажи с ящиками',
				SciDorm: 'Общежитие учёных — стол коменданта, шкаф',
				Club: 'Столовая «Исток» — раздача и холодильник: консервы',
				Orangery: 'Оранжерея — стол агронома, шкаф с удобрениями: химия',
			}[b.name]),
		};
	},
};
