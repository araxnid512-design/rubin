// Кластер «Подстанция»: электроподстанция 110/10 кВ и посёлок энергетиков, которые Улей перенёс вместе с куском трассы.
// Локация 180×180 м. Ядро (середина) — как прежде:
// север — подстанция за бетонным забором с колючкой: три силовых трансформатора за бетонными перегородками,
// выключатели и порталы открытого распредустройства, ЗРУ-10 кВ, щитовая (дежурка электромонтёра с сейфом);
// от порталов на север уходит ЛЭП 110 кВ на решётчатых опорах. Северо-запад — склад РЭС: катушки кабеля, штабели труб,
// аварийный «Урал». Через центр — трасса: на восток к Заречному, на запад к Химмашу; на север дорога к военной части.
// Юг — посёлок энергетиков: общежитие, три дома за заборами, гаражи, трансформаторная будка, столбы 10 кВ вдоль улицы.
// Новое кольцо вокруг ядра:
// северо-восток — второе распредустройство ОРУ-35 кВ за своим забором (два трансформатора, выключатели, портал,
// релейная с ЗИП), от него на север — линия 35 кВ на решётчатых опорах в муть;
// северо-запад — ремонтно-производственная база РЭС: мастерская (трансформатор на ремонте, станок, верстак, стеллаж
// запчастей), гаражи, двор с «Уралом», запасным трансформатором, трактором и ломом;
// юг — новая улица посёлка: магазин «Продукты», ещё два дома и дача, детская площадка, водонапорная башня с насосной,
// жестяные гаражи-«ракушки»; восток — котельная посёлка с трубой и теплотрассой на эстакаде.
// Промзона средней глубины: бегуны, топтуны и два рубера — у трансформаторов обоих распредустройств.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair, buildGuardhouse, buildWarehouse, buildArmyBarracks, buildHouse, buildDacha } from '../buildings.js';
import { addCar, bus, powerLine, transformer, fencePlot, shed, woodpile, bench, swings, slide, markingMaterial, blob, OPTIONS } from '../props.js';
import { concreteFence, pipePile, hazardBarrels, armyTruck, billboard, waterTower, chimney, pipeRack } from '../props-industrial.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Тонкий стержень от точки a до точки b (раскосы опоры ЛЭП, гирлянды изоляторов). */
function rod(batch, mat, a, b, r = 0.07, seg = 4) {
	const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
	g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
	batch.add(g, mat);
}

/**
 * Решётчатая опора ЛЭП (линия идёт вдоль Z): четыре пояса, раскосы крестом, две траверсы, гирлянды изоляторов.
 * k — масштаб (опоры 35 кВ ниже). Возвращает точки подвеса проводов [x, y] — концы гирлянд на линии z = pz.
 */
function pylon(batch, M, collide, px, pz, k = 1) {
	const lv = [[0, 2.1], [4, 1.5], [8, 0.95], [11, 0.65], [15.5, 0.4]].map(([y, h]) => [y * k, h * k]); // высота, половина ширины
	const c = (y, h, sx, sz) => [px + sx * h, y, pz + sz * h];
	for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let i = 0; i < lv.length - 1; i++) rod(batch, M.silver, c(lv[i][0], lv[i][1], sx, sz), c(lv[i + 1][0], lv[i + 1][1], sx, sz), 0.09);
	// раскосы крестом по граням
	const faces = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
	for (const [[ax, az], [bx, bz]] of faces) for (let i = 0; i < lv.length - 1; i++) {
		rod(batch, M.silver, c(lv[i][0], lv[i][1], ax, az), c(lv[i + 1][0], lv[i + 1][1], bx, bz), 0.05);
		rod(batch, M.silver, c(lv[i][0], lv[i][1], bx, bz), c(lv[i + 1][0], lv[i + 1][1], ax, az), 0.05);
	}
	// траверсы: нижняя широкая, верхняя короче; с концов — гирлянды
	for (const [y, w] of [[11 * k, 4.4 * k], [13.6 * k, 3 * k]]) {
		rod(batch, M.silver, [px - w, y, pz], [px + w, y, pz], 0.08);
		for (const s of [-1, 1]) rod(batch, M.silver, [px + s * w, y, pz], [px + s * 0.4 * k, y + 1.2 * k, pz], 0.05);
	}
	const phases = [[px - 4.4 * k, 11 * k], [px + 4.4 * k, 11 * k], [px + 3 * k, 13.6 * k]];
	for (const [x, y] of phases) rod(batch, M.green, [x, y, pz], [x, y - 1.3 * k, pz], 0.09, 6);
	collide(px, pz, 4.4 * k, 4.4 * k);
	return phases.map(([x, y]) => [x, y - 1.3 * k]);
}

// ---------- Мебель-тайники и обстановка новых построек (лицо мебели — в +Z её осей) ----------

const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);

/** Верстак с тисками и ящиком инструмента. */
const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal],
	[0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine], [0.3, 0.2, 0.2, -0.6, 1.0, -0.1, b.IM.black],
], [2.0, 0.8], loot, 1.0);

/** Стеллаж запчастей: стойки, полки, ящики, подшипники, моток кабеля. */
const partsRack = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	...[-1.4, 1.4].flatMap((dx) => [-0.3, 0.3].map((dz) => [0.07, 2.2, 0.07, dx, 1.1, dz, b.IM.rack])),
	...[0.2, 0.9, 1.6, 2.15].map((y) => [2.9, 0.05, 0.7, 0, y, 0, b.IM.rack]),
	[0.8, 0.45, 0.5, -0.8, 0.45, 0, b.IM.crateGreen], [0.6, 0.35, 0.5, 0.6, 0.4, 0, b.IM.machine],
	[1.0, 0.3, 0.5, 0.1, 1.08, 0, b.IM.metal], [0.7, 0.4, 0.5, -0.7, 1.82, 0, b.IM.crate], [0.5, 0.3, 0.45, 0.8, 1.78, 0, b.IM.black],
], [3.0, 0.75], loot, 2.2);

/** Токарный станок (обстановка с коллайдером). */
const machine = (b, x, z, rot) => b.furniture(x, z, rot, [
	[1.9, 0.8, 0.7, 0, 0.4, 0, b.IM.machine], [0.5, 0.5, 0.6, -0.65, 1.05, 0, b.IM.machine],
	[1.3, 0.12, 0.2, 0.25, 0.92, 0.12, b.IM.metal], [0.3, 0.22, 0.3, 0.55, 0.95, 0, b.IM.black],
], { solid: [1.9, 0.75], prop: 'lathe' });

/** Цилиндр (баллон, котёл, бочка) для мебели: уже на месте в осях мебели; axis — вдоль какой оси лежит. */
const cyl = (r, len, px, py, pz, axis = 'y', seg = 12) => {
	const g = new THREE.CylinderGeometry(r, r, len, seg);
	if (axis === 'x') g.rotateZ(Math.PI / 2);
	if (axis === 'z') g.rotateX(Math.PI / 2);
	return g.translate(px, py, pz);
};

// ---------- Новые постройки, куда заходят ----------

/**
 * Релейная ОРУ-35 кВ 8×4,6 м: шкафы релейной защиты с приборами вдоль западной стены, стол дежурного, шкаф с ЗИП.
 * Вход — с севера (−Z), со двора распредустройства.
 */
function buildRelay(bctx, { name, cx, cz }) {
	const W = 8, D = 4.6, H = 3.0, t = 0.25, hx = W / 2, hz = D / 2, door = 2.2;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.35 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [door], lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	const sill = M.whiteBrick;
	b.window('back', -2.2, { t, sill }); b.window('back', 0.8, { t, sill }); b.window('front', -1.6, { t, sill });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.wallBox('front', door + 1.2, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t }); // железная дверь распахнута к стене
	b.canopy('front', door, { w: 1.6, d: 0.9, y: 2.4, mat: M.roofTar, t });
	b.vent(-2.6, 0.9, H + 0.25, M.silver, { h: 0.5, r: 0.12 });
	b.lower(place(box(1.4, 0.18, 0.9), door, 0.09, -hz - 0.55), M.concrete);
	// шкафы релейной защиты: серые, с окошками приборов и лампами
	for (const z of [-1.3, -0.4, 0.5, 1.4]) b.furniture(-hx + 0.4, z, Math.PI / 2, [
		[0.85, 2.0, 0.5, 0, 1.0, 0, IM.locker], [0.55, 0.4, 0.02, 0, 1.5, 0.26, IM.screen],
		[0.1, 0.1, 0.03, -0.2, 1.05, 0.26, IM.black], [0.1, 0.1, 0.03, 0.2, 1.05, 0.26, IM.redBoard],
	], { solid: [0.85, 0.5] });
	table(b, 0.6, 1.5, 0, { w: 1.3, d: 0.7 });
	chair(b, 0.6, 0.8, Math.PI * 0.9);
	cabinet(b, 'Шкаф с ЗИП', hx - 0.4, -0.6, -Math.PI / 2, 1.0, 1.9, 0.5, { parts: [1, 3, 0.6], scrap: [1, 2, 0.35], ammo919: [3, 8, 0.35], zhivchik: 0.2 }, IM.locker);
	return b.finish();
}

/**
 * Мастерская ремонтной базы 20×12 м из кирпича: ворота с юга (+Z), дверь с запада. Внутри — трансформатор на ремонте
 * под кран-балкой, снятые радиаторы, два токарных станка, двигатель на стенде, сварочный пост; у северной стены —
 * верстак, у восточной — стеллаж запчастей, в юго-западном углу — стол и шкаф мастера. Тайники с деталями.
 */
function buildRepairShop(bctx, { name, cx, cz }) {
	const W = 20, D = 12, H = 5.2, t = 0.3, hx = W / 2, hz = D / 2, G = 4;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.6 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [G], w: 3.6, lining: IM.factoryWall, side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, doors: [2], lining: IM.factoryWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: -1 });
	const sill = M.brick;
	for (const x of [-7, -2.5, 8.5]) b.window('back', x, { y: 3.4, t, sill });
	for (const x of [-6, 0, 6]) b.window('front', x, { y: 3.4, t, sill });
	b.window('right', 2.5, { y: 3.4, t, sill });
	// створки ворот распахнуты к стене, козырёк над воротами; дверь сбоку открыта
	for (const s of [-1, 1]) b.wallBox('back', G + s * 2.72, 1.78, 0.02, 2.06, 0.06, M.metalRust, { t });
	b.canopy('back', G, { w: 4.6, d: 1.4, y: 2.62, mat: M.metalRust, t });
	b.wallBox('left', 0.8, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(5.2, 0.7).translate(0, 3.25, 0.03), 'back', G, t), T.signMaterial('МАСТЕРСКАЯ РПБ', { bg: '#2a2c26', fg: '#e8dcae', w: 512, h: 70 }));
	// плоская кровля со световым фонарём и парапетом, дефлекторы; под кровлей — кран-балка
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.35);
	b.top_(place(box(W - 6, 0.5, 2.0, 2), 0, H + 0.55, 0), M.glass);
	for (const [x, z] of [[-8, -4], [8, 4], [6, -4.2]]) b.vent(x, z, H + 0.3, M.silver);
	for (const z of [-hz + 0.6, hz - 0.6]) b.top_(place(box(W - 0.8, 0.25, 0.25), 0, H - 0.6, z), M.metalDark);
	b.top_(place(box(0.5, 0.45, D - 1.2), -2, H - 0.85, 0), M.yellow);
	b.top_(place(box(0.6, 0.5, 0.6), -2, H - 1.3, -1.5), M.metalDark);
	// трансформатор на ремонте: бак без радиаторов на салазках, вводы сняты наполовину
	b.furniture(-2, -1.5, 0, [
		[3.6, 0.2, 2.6, 0, 0.1, 0, M.metalDark], [3.2, 2.2, 2.2, 0, 1.3, 0, M.tankWhite], [3.4, 0.1, 2.4, 0, 2.45, 0, M.metalDark],
		[0.2, 0.9, 0.2, -1.0, 2.9, 0.4, M.white], [0.2, 0.5, 0.2, 0, 2.7, 0.4, M.white], [0.6, 0.5, 0.5, 1.1, 0.25, 1.5, IM.crateGreen],
	], { solid: [3.6, 2.6] });
	// снятые радиаторы — стопкой у стены
	b.furniture(-6.4, -1.4, 0, [0, 1, 2, 3].map((i) => [1.6, 0.9, 0.08, 0, 0.45, -0.6 + i * 0.4, M.metalDark]), { solid: [1.7, 1.4] });
	machine(b, -7.4, -5.0, 0);
	machine(b, 6.8, -5.0, 0);
	// двигатель на стенде и сварочный пост с баллонами
	b.furniture(5.5, 0.8, 0.3, [
		[0.9, 0.7, 0.6, 0, 0.95, 0, IM.machine], [0.1, 0.6, 0.1, -0.3, 0.3, 0, IM.metal], [0.1, 0.6, 0.1, 0.3, 0.3, 0, IM.metal], [0.7, 0.06, 0.5, 0, 0.03, 0, IM.metal],
	], { solid: [0.9, 0.6] });
	b.furniture(8.6, 4.6, -Math.PI / 2, [
		[0.6, 0.6, 0.5, 0, 0.3, 0, M.yellow], [0, 0, 0, 0, 0, 0, M.red, { geo: cyl(0.13, 1.5, 0.6, 0.75, -0.1) }], [0, 0, 0, 0, 0, 0, IM.black, { geo: cyl(0.13, 1.5, 0.9, 0.75, -0.1) }],
	], { solid: [1.4, 0.6] });
	workbench(b, 'Верстак', 2.5, -hz + 0.55, 0, { parts: [1, 3, 0.55], scrap: [1, 3, 0.45], ammo919: [3, 6, 0.3], grenade: 0.03 });
	partsRack(b, 'Стеллаж с запчастями', hx - 0.5, -2.2, -Math.PI / 2, { parts: [1, 2, 0.6], scrap: [2, 4, 0.45], fuel: [1, 1, 0.2], ammo12: [3, 6, 0.2] });
	cabinet(b, 'Шкаф мастера', -hx + 0.4, 4.4, Math.PI / 2, 1.0, 1.9, 0.5, { ammo545: [6, 12, 0.4], parts: [1, 2, 0.35], zhivchik: 0.25, spore: [1, 2, 0.25] }, IM.locker);
	table(b, -7.6, 5.0, 0, { w: 1.2, d: 0.7 });
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
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: centers.filter((_, i) => loot[i]), w: 2.8 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t });
	for (let i = 1; i < n; i++) b.wall('z', -hx + i * bay, -hz + t / 2, hz - t / 2, { mat: M.brick, t: 0.15 });
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

/**
 * Магазин «Продукты» 10×8 м из силикатного кирпича: вход и витрины с юга (+Z, к улице), торговый зал с прилавком и
 * стеллажом, за перегородкой — подсобка с ящиками и холодильным ларём, чёрный ход на север.
 */
function buildStore(bctx, { name, cx, cz }) {
	const W = 10, D = 8, H = 3.3, t = 0.25, hx = W / 2, hz = D / 2, door = -2;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [door], w: 1.5, lining: IM.shopWall, side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [3.4], lining: IM.shopWall, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('x', -1.2, -hx + t / 2, hx - t / 2, { mat: IM.shopWall, t: 0.15, doors: [-3.5] }); // подсобка
	// витрины с решётками по сторонам от входа, вывеска над ними, козырёк, крыльцо
	for (const x of [-4.1, 1.8]) {
		b.top_(new THREE.PlaneGeometry(1.6, 1.4).translate(x, 1.6, hz + t / 2 + 0.02), M.glass);
		for (let k = -0.6; k <= 0.61; k += 0.4) b.top_(place(box(0.04, 1.4, 0.04), x + k, 1.6, hz + t / 2 + 0.07), M.metalDark);
	}
	b.top_(new THREE.PlaneGeometry(5.6, 1.0).translate(0.8, H - 0.35, hz + t / 2 + 0.03), M.shopSign);
	b.canopy('back', door, { w: 2.2, d: 1.2, y: 2.3, mat: M.metalRust, t });
	b.lower(place(box(2.0, 0.18, 1.0, 1), door, 0.09, hz + 0.6), M.concrete);
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.vent(2.5, -2.6, H + 0.3, M.metalDark, { h: 0.6 });
	b.top_(place(box(1.2, 0.6, 0.8), -2.8, H + 0.6, -2.4), M.metalDark); // короб вентиляции
	// зал: прилавок с кассой лицом к покупателю, стеллаж с банками у западной стены, ларь
	b.container('Прилавок', 2.4, -0.1, 0, [
		[3.0, 1.0, 0.7, 0, 0.5, 0, IM.furniture], [3.1, 0.05, 0.8, 0, 1.02, 0, IM.furnitureLight], [0.45, 0.25, 0.35, 1.0, 1.17, 0, IM.black], [1.2, 0.3, 0.5, -0.6, 1.2, 0, IM.glass],
	], [3.0, 0.7], { zhivchik: 0.35, food: [1, 3, 0.55], ammo919: [3, 6, 0.3], spore: [1, 2, 0.2] }, 1.25);
	b.container('Стеллаж', -hx + 0.4, 2.2, Math.PI / 2, [
		[2.4, 1.9, 0.5, 0, 0.95, 0, IM.furnitureLight], ...[0.45, 0.95, 1.45].map((y) => [2.3, 0.04, 0.48, 0, y, 0.02, IM.furniture]),
		[2.0, 0.22, 0.3, 0, 0.58, 0.05, IM.cans], [1.6, 0.25, 0.3, -0.2, 1.08, 0.05, IM.jars], [1.8, 0.22, 0.3, 0.15, 1.58, 0.05, IM.cans],
	], [2.4, 0.5], { food: [1, 3, 0.6], zhivchik: 0.3, ammo12: [2, 4, 0.2] }, 1.9);
	b.furniture(hx - 0.5, 2.6, -Math.PI / 2, [[1.6, 0.85, 0.8, 0, 0.42, 0, IM.white], [1.5, 0.05, 0.7, 0, 0.87, 0, IM.glass]], { solid: [1.6, 0.8] }); // ларь
	// подсобка: ящики штабелем и холодильник
	for (const [x, r] of [[-3.8, 0], [-2.8, 0.15], [0.5, -0.1]]) b.furniture(x, -3.3, r, [[0.8, 0.6, 0.6, 0, 0.3, 0, IM.crate], [0.8, 0.6, 0.6, 0.05, 0.9, 0, IM.crate]], { solid: [0.8, 0.6] });
	b.furniture(hx - 0.5, -2.0, -Math.PI / 2, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], { solid: [0.62, 0.6], prop: 'fridge' });
	return b.finish();
}

/**
 * Котельная посёлка 14×10 м из кирпича: два котла на постаментах, насосы, щит управления, верстак слесаря, у двери
 * лопаты и тачка с углём. Вход — с севера (−Z), от площадки у гаражей. Труба и теплотрасса — снаружи.
 */
function buildBoiler(bctx, { name, cx, cz }) {
	const W = 14, D = 10, H = 6, t = 0.3, hx = W / 2, hz = D / 2, door = -3;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.6 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [door], w: 2.0, lining: IM.factoryWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: -1 });
	const sill = M.brick;
	for (const x of [-4.5, 0, 4.5]) b.window('back', x, { y: 3.8, t, sill });
	for (const x of [1.5, 5]) b.window('front', x, { y: 3.8, t, sill });
	b.window('left', -1.5, { y: 3.8, t, sill });
	for (const s of [-1, 1]) b.wallBox('front', door + s * 1.6, 1.05, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.canopy('front', door, { w: 2.8, d: 1.2, y: 2.5, mat: M.metalRust, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.6, 0.65).translate(0, H - 0.9, 0.03), 'back', 0, t), T.signMaterial('КОТЕЛЬНАЯ', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 70 }));
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.35);
	b.vent(-4.5, 2.5, H + 0.3, M.silver);
	// котлы: обмуровка, барабан, горелка; над ними — газоходы к трубе (с крышей исчезают)
	for (const x of [0.6, 4.6]) {
		b.furniture(x, 0.8, 0, [
			[2.6, 0.4, 6.2, 0, 0.2, 0, M.concreteDark], [2.4, 2.2, 5.6, 0, 1.5, 0, M.brick],
			[0, 0, 0, 0, 0, 0, IM.metal, { geo: cyl(0.6, 5.4, 0, 3.1, 0, 'z', 14) }], [1.0, 0.8, 0.3, 0, 1.2, -2.95, IM.black], [0.3, 0.3, 0.3, 0.6, 1.9, -2.95, M.red],
		], { solid: [2.6, 6.2] });
		b.furniture(x, 0.8, 0, [[0.6, H - 3.4, 0.6, 0, 3.4 + (H - 3.4) / 2, 2.4, M.metalRust]], { up: true });
	}
	b.top_(place(box(W - 1, 0.6, 0.6), 0.5, H - 0.7, 3.2), M.metalRust);
	// насосы с моторами, щит управления у западной стены
	for (const z of [1.5, 3.4]) b.furniture(-3.6, z, Math.PI / 2, [[1.2, 0.5, 0.6, 0, 0.25, 0, IM.machine], [0, 0, 0, 0, 0, 0, IM.metal, { geo: cyl(0.25, 0.6, 0.35, 0.65, 0, 'x') }], [0.4, 0.45, 0.4, -0.3, 0.72, 0, M.green]], { solid: [1.2, 0.6] });
	b.furniture(-hx + 0.35, -1.6, Math.PI / 2, [[2.4, 2.0, 0.45, 0, 1.0, 0, IM.locker], [2.0, 0.5, 0.02, 0, 1.5, 0.23, IM.screen], [0.1, 0.1, 0.03, -0.6, 1.05, 0.23, IM.redBoard]], { solid: [2.4, 0.45] });
	cabinet(b, 'Шкаф слесаря', -hx + 0.4, 3.6, Math.PI / 2, 1.0, 1.9, 0.5, { parts: [1, 2, 0.45], scrap: [1, 3, 0.5], ammo12: [3, 6, 0.3], fuel: [1, 1, 0.2] }, IM.locker);
	b.furniture(-1.6, -4.0, 0.4, [[0.6, 0.35, 1.0, 0, 0.35, 0, M.metalRust], [0.5, 0.25, 0.8, 0, 0.6, 0, M.tankBlack]], { solid: [0.7, 1.1] }); // тачка с углём
	return b.finish();
}

/** Гараж-«ракушка»: жестяной полуцилиндр на бетонном цоколе, ворота в торце — к улице (−Z). */
function shellGarage(batch, M, collide, x, z, mat) {
	const r = 1.5, len = 5.4;
	batch.add(place(box(3.1, 0.3, len + 0.1, 1), x, 0.15, z), M.concreteDark);
	batch.add(place(new THREE.CylinderGeometry(r, r, len, 10, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), x, 0.3, z), mat);
	batch.add(place(new THREE.CircleGeometry(r, 10, 0, Math.PI), x, 0.3, z + len / 2), mat);
	batch.add(place(new THREE.CircleGeometry(r, 10, 0, Math.PI).rotateY(Math.PI), x, 0.3, z - len / 2), mat);
	batch.add(place(box(1.9, 1.6, 0.06), x, 1.1, z - len / 2 - 0.04), M.metalDark); // ворота
	collide(x, z, 3.1, len + 0.1);
}

export default {
	id: 'podstanciya',
	seed: 1963,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// все провода — одним набором отрезков: один вызов отрисовки на всю подстанцию
		const wire = [];
		const span = (a, b, sag = 0.6, n = 8) => {
			for (let k = 0; k < n; k++) {
				const p = [k / n, (k + 1) / n].map((t) => new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t));
				wire.push(p[0], p[1]);
			}
		};

		// ---------- Трасса, дорога на север, проезды ----------
		ground(180, 8, 0, 4, M.asphalt, 5, 0.02);
		ground(180, 0.15, 0, 4, markingMaterial(), 6, 0.026);
		ground(180, 1.4, 0, 9.2, M.dirt, 3, 0.014); // обочина со стороны посёлка
		ground(6, 94, -8, -43, M.asphalt, 5, 0.022); // на север, к военной части
		ground(7, 10, 27.5, -5, M.concrete, 4, 0.018); // въезд на подстанцию
		ground(42, 38, 29, -29, M.dirt, 5, 0.013); // двор подстанции — щебёнка
		ground(6, 30, 27.5, -25, M.concrete, 4, 0.017); // проезд к трансформаторам
		ground(40, 5, 29, -19.5, M.concrete, 4, 0.0172); // вдоль трансформаторов
		ground(22, 13, -22, -6.5, M.concrete, 4, 0.016); // площадка склада РЭС
		ground(5, 36, 5, 27, M.dirt, 4, 0.015); // улица посёлка
		ground(46, 5, 6, 31, M.dirt, 4, 0.0152); // переулок между дворами
		ground(28, 10, 38, 17, M.asphalt, 5, 0.019); // площадка перед гаражами
		// новое кольцо: въезд на ОРУ-35, ремонтная база, новая улица посёлка, проезд к котельной
		ground(6, 18, 72, -5.5, M.concrete, 4, 0.0175); // с трассы к ОРУ-35
		ground(24, 36, 72, -32, M.dirt, 5, 0.0131); // двор ОРУ-35 — щебёнка
		ground(5, 30, 72, -29, M.concrete, 4, 0.0171); // проезд между трансформаторами
		ground(48, 30, -40, -69, M.concrete, 4, 0.0135); // двор ремонтной базы — плиты
		ground(9, 6, -12.5, -65, M.concrete, 4, 0.0165); // въезд на базу с дороги на север
		ground(5, 16, 5, 52.5, M.dirt, 4, 0.0151); // улица посёлка — дальше на юг
		ground(140, 5, -4, 60, M.dirt, 4, 0.0153); // новая улица
		ground(12, 3.6, -6, 55.7, M.concrete, 3, 0.0156); // крыльцо магазина
		ground(19, 6, 61.5, 17, M.asphalt, 5, 0.0191); // от гаражей к котельной
		ground(6, 15, 65, 27.5, M.asphalt, 5, 0.0189);
		const onRoad = (x, z, m = 0) => Math.abs(z - 4) < 4.5 + m || (Math.abs(x + 8) < 3.5 + m && z < 2)
			|| (Math.abs(x - 27.5) < 3.5 + m && z < 0 && z > -40) || (Math.abs(z + 19.5) < 2.5 + m && x > 9 && x < 49)
			|| (Math.abs(x - 5) < 2.5 + m && z > 8 && z < 62) || (Math.abs(z - 31) < 2.5 + m && x > -17 && x < 29)
			|| (Math.abs(x - 38) < 14 + m && Math.abs(z - 17) < 5 + m)
			|| (Math.abs(x - 72) < 3 + m && z < 2 && z > -46) || (Math.abs(z + 65) < 3 + m && x > -17 && x < -8)
			|| (Math.abs(z - 60) < 2.5 + m && x > -74 && x < 66) || (Math.abs(z - 17) < 3 + m && x > 50 && x < 71)
			|| (Math.abs(x - 65) < 3 + m && z > 14 && z < 35);

		// ---------- Забор подстанции с воротами, колючка поверху ----------
		concreteFence(batch, M, collide, root, 8, -10, 24, -10);
		concreteFence(batch, M, collide, root, 31, -10, 50, -10);
		concreteFence(batch, M, collide, root, 50, -10, 50, -48);
		concreteFence(batch, M, collide, root, 8, -48, 50, -48);
		concreteFence(batch, M, collide, root, 8, -10, 8, -48);
		billboard(batch, M, root, collide, 27.5, -10, 0, 'ПС 110/10 кВ «ЗАРЕЧНАЯ»', { w: 7.4, h: 1.0, y: 4.0, bg: '#2a2c26', fg: '#e8dcae' });
		// распахнутые сетчатые створки ворот
		for (const s of [-1, 1]) batch.add(place(box(3.4, 2.1, 0.06), 27.5 + s * 4.6, 1.1, -8.7, s * 0.35), M.metalOlive);
		// таблички «Не влезай — убьёт» на заборе (к дороге)
		const danger = T.signMaterial('НЕ ВЛЕЗАЙ! УБЬЁТ', { bg: '#f0e040', fg: '#1a1a1a', w: 384, h: 128 });
		for (const x of [14, 40, 46]) batch.add(place(new THREE.PlaneGeometry(1.0, 0.34), x, 1.7, -9.89), danger, { cast: false });

		// ---------- Силовые трансформаторы за бетонными перегородками ----------
		const TZ = -25; // линия трансформаторов
		const power = (x, z) => {
			batch.add(place(box(6.2, 0.3, 4.8, 2), x, 0.15, z), M.concrete); // фундамент с маслоприёмником
			batch.add(place(box(4.2, 3.0, 2.4, 1.5), x, 1.8, z), M.tankWhite); // бак
			batch.add(place(box(4.4, 0.12, 2.6), x, 3.36, z), M.metalDark); // крышка
			for (const s of [-1, 1]) for (let i = 0; i < 9; i++) batch.add(place(box(0.06, 2.3, 0.8), x - 1.6 + i * 0.4, 1.75, z + s * 1.65), M.metalDark); // радиаторы
			// расширительный бак на стойках
			batch.add(place(new THREE.CylinderGeometry(0.42, 0.42, 2.8, 14).rotateZ(Math.PI / 2), x - 0.3, 4.15, z + 0.75), M.tankWhite);
			for (const dx of [-1.3, 0.7]) batch.add(place(box(0.1, 0.8, 0.1), x + dx, 3.75, z + 0.75), M.metalDark);
			// высоковольтные вводы — фарфоровые изоляторы с юбками (к порталам, на север)
			for (const dx of [-1.3, 0, 1.3]) {
				batch.add(place(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 8), x + dx, 4.35, z - 0.55), M.white);
				for (let k = 0; k < 4; k++) batch.add(place(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), x + dx, 3.8 + k * 0.38, z - 0.55), M.white);
			}
			batch.add(place(new THREE.PlaneGeometry(0.7, 0.24), x + 1.2, 2.2, z + 1.21), danger, { cast: false });
			collide(x, z, 5.4, 4.4);
		};
		for (const x of [18, 30, 42]) power(x, TZ);
		// бетонные перегородки между трансформаторами (от пожара)
		for (const x of [24, 36]) { batch.add(place(box(0.3, 5, 6.4, 2), x, 2.5, TZ), M.concrete); collide(x, TZ, 0.4, 6.4); }

		// ---------- Выключатели и порталы ОРУ-110 ----------
		const BZ = -33, PZ = -40;
		// ячейка: выключатель с приводом, провода от вводов трансформатора через выключатель к порталу
		const bay = (x, tz, bz, pz) => {
			for (const dx of [-1.4, 1.4]) batch.add(place(box(0.16, 2.2, 0.16), x + dx, 1.1, bz), M.metalDark);
			batch.add(place(box(3.2, 0.2, 0.6), x, 2.25, bz), M.metalDark);
			batch.add(place(box(0.8, 1.2, 0.5), x + 0.4, 0.6, bz + 0.5), M.metalOlive); // привод
			for (const dx of [-1.2, 0, 1.2]) {
				batch.add(place(new THREE.CylinderGeometry(0.13, 0.17, 1.5, 8), x + dx, 3.1, bz), M.white);
				batch.add(place(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), x + dx, 3.95, bz), M.metalDark);
				// провода: ввод трансформатора → выключатель → гирлянда портала
				span([x + dx, 5.25, tz - 0.55], [x + dx, 4.1, bz], 0.45);
				span([x + dx, 4.1, bz], [x + dx * 1.4, 7.9, pz], 0.35);
			}
			collide(x, bz + 0.15, 3.4, 1.2);
		};
		for (const x of [18, 30, 42]) bay(x, TZ, BZ, PZ);
		// порталы: бетонные стойки и стальные траверсы, гирлянды изоляторов
		for (const x of [12, 24, 36, 48]) {
			batch.add(place(new THREE.CylinderGeometry(0.2, 0.26, 9.2, 8), x, 4.6, PZ), M.concrete);
			collide(x, PZ, 0.6, 0.6);
		}
		batch.add(place(box(36.4, 0.5, 0.5, 2), 30, 9.1, PZ), M.metalRust);
		batch.add(place(box(36.4, 0.12, 0.9), 30, 8.82, PZ), M.metalRust);
		for (const x of [16.3, 18, 19.7, 28.3, 30, 31.7, 40.3, 42, 43.7, 27, 30.5, 34]) rod(batch, M.green, [x, 8.85, PZ], [x, 7.9, PZ], 0.09, 6);

		// ---------- ЛЭП 110 кВ на север: решётчатые опоры за забором, линия уходит в муть ----------
		{
			const p1 = pylon(batch, M, collide, 30.5, -57), p2 = pylon(batch, M, collide, 30.5, -80);
			[27, 30.5, 34].forEach((x, i) => {
				span([x, 7.9, PZ], [p1[i][0], p1[i][1], -57], 1.2);
				span([p1[i][0], p1[i][1], -57], [p2[i][0], p2[i][1], -80], 1.6);
				span([p2[i][0], p2[i][1], -80], [p2[i][0], p2[i][1] - 1.5, -100], 1.6);
			});
			// трос молниезащиты над порталами
			span([12, 9.4, PZ], [48, 9.4, PZ], 0.4, 12);
		}

		// ---------- ЗРУ-10 кВ и щитовая ----------
		{
			const cx = 16.5, cz = -15.5, W = 12, D = 5, H = 5;
			occluder('ZRU', (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.whiteBrick);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				// ленточные окна под крышей и ворота ячеек на южном фасаде
				for (const [i, x] of [-4.2, -1.4, 1.4, 4.2].entries()) {
					const win = T.windowUV(new THREE.PlaneGeometry(1.6, 0.9), [1, 0, 3, 0][i]);
					win.translate(cx + x, 3.9, cz + D / 2 + 0.01);
					kb.add(win, M.window);
				}
				for (const x of [-3, 3]) kb.add(place(box(1.8, 2.3, 0.1), cx + x, 1.15, cz + D / 2 + 0.05), M.metalOlive);
				kb.add(place(box(W + 0.4, 0.4, 0.5), cx, 2.6, cz + D / 2 + 0.25), M.concrete); // козырёк
				kb.add(place(new THREE.PlaneGeometry(0.7, 0.24), cx - 3, 1.9, cz + D / 2 + 0.11), danger);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.6, top: H + 0.4 }, 0.25);
			collide(cx, cz, W, D);
		}
		buildings.push(buildGuardhouse(bctx, { name: 'Control', cx: 44, cz: -15, ry: Math.PI }));
		addCar(batch, M, root, 37.5, -14.2, Math.PI / 2, 0x5a6a4a, { model: 'e_niva' });
		collide(37.5, -14.2, 4.3, 1.8, Math.PI / 2);
		// катушки кабеля и ящики у ЗРУ, бочки масла у трансформаторов
		const drum = (x, z, r = 0.9, ry = 0) => {
			const c = Math.cos(ry), s = Math.sin(ry);
			for (const d of [-0.5, 0.5]) batch.add(place(new THREE.CylinderGeometry(r, r, 0.14, 16).rotateX(Math.PI / 2), x + d * s, r, z + d * c, ry), M.wood);
			batch.add(place(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.9, 14).rotateX(Math.PI / 2), x, r, z, ry), M.tire);
			collide(x, z, 2 * r + 0.1, 1.2, ry);
		};
		drum(12, -21.5); drum(14.6, -21.8, 0.75, 0.3);
		hazardBarrels(batch, M, collide, 46.5, -31, rnd, 5);
		for (const [x, z, r] of [[22, -44, 0.1], [24, -44.6, 0], [38, -44, 0.3]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }

		// ---------- Склад РЭС: катушки, трубы, аварийка ----------
		// склад и площадка — в одном участке отсечения (x −33…0, z −33…0): меньше вызовов отрисовки
		buildings.push(buildWarehouse(bctx, { name: 'Depot', cx: -22, cz: -18, ry: Math.PI }));
		drum(-16, -8.4, 1.0); drum(-13.6, -9.2, 1.0, 0.2); drum(-15.4, -11.3, 0.8, 1.4); drum(-31, -9.5, 0.9, 0.1);
		pipePile(batch, M, collide, -36, -15, Math.PI / 2);
		pipePile(batch, M, collide, -36, -32, 0.05);
		armyTruck(batch, M, root, collide, -25, -4.6, Math.PI / 2 + 0.08);
		hazardBarrels(batch, M, collide, -47, -27, rnd, 4);
		for (const [x, z, r] of [[-32.4, -20, 0.2], [-32.6, -21.6, 0.6], [-46, -4, 0]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood);
			endProp();
			collide(x, z, 1.2, 0.9, r);
		}
		// старая будка ТП у дороги на север
		transformer(batch, root, M, collide, -14, -40);

		// ---------- Посёлок энергетиков ----------
		buildings.push(
			buildArmyBarracks(bctx, { name: 'Dorm', cx: -26, cz: 20, ry: 0 }),
			buildHouse(bctx, { name: 'House1', cx: -4, cz: 21, ry: 0, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: 14, cz: 21, ry: 0, rnd, variant: 2 }),
			buildHouse(bctx, { name: 'House3', cx: 14, cz: 41, ry: 0, rnd, variant: 1 }),
		);
		fencePlot(batch, M, collide, -4, 21, 15, 13, 'n', rnd);
		fencePlot(batch, M, collide, 14, 21, 15, 13, 'n', rnd);
		fencePlot(batch, M, collide, 14, 41, 15, 13, 'n', rnd);
		shed(batch, M, collide, -9.4, 26.2, 0.05);
		shed(batch, M, collide, 19.6, 46, 3.1);
		woodpile(batch, M, collide, 10.4, 26.6, 0);
		// у общежития: скамейки и качели
		bench(batch, M, -31, 13.6, 0);
		bench(batch, M, -21, 13.6, 0);
		swings(batch, M, -26, 30);
		transformer(batch, root, M, collide, -7, 40); // поселковая ТП
		// гаражи на площадке, ворота к улице
		{
			const z0 = 26, n = 6, w = 4, x0 = 28;
			occluder('Garages', (gb, group) => {
				for (let i = 0; i < n; i++) {
					const x = x0 + i * w;
					gb.add(place(box(w, 2.6, 6, 1.2), x, 1.3, z0), i % 3 === 1 ? M.whiteBrick : M.brick);
					gb.add(place(box(w + 0.1, 0.12, 6.4, 2), x, 2.66, z0 - 0.1, 0, -0.04), M.roofTar);
					const door = new THREE.Mesh(box(3, 2.2, 0.08), T.garageDoorMaterial(i % 3));
					door.position.set(x, 1.1, z0 - 3.02);
					group.add(door);
				}
			}, { cx: x0 + (n - 1) * w / 2, cz: z0, ry: 0, hx: n * w / 2 + 0.2, hz: 3.3, top: 2.9 }, 0.3);
			collide(x0 + (n - 1) * w / 2, z0, n * w, 6);
		}
		addCar(batch, M, root, 33, 17.5, 0.1, 0x7a2a22);
		collide(33, 17.5, 4.3, 1.8, 0.1);
		addCar(batch, M, root, 44, 16.5, Math.PI + 0.3, 0xb8b0a0, { crashed: true });
		collide(44, 16.5, 4.3, 1.8, Math.PI + 0.3);
		addCar(batch, M, root, -8, 12.6, Math.PI, 0x3a5a6a, { burned: true }); // сгорела у обочины
		collide(-8, 12.6, 4.3, 1.8, Math.PI);
		// столбы 10 кВ вдоль улицы посёлка
		powerLine(batch, root, M, collide, -44, 44, 11.6, 22);

		// ---------- Окраина ----------
		// остановка «Подстанция» у трассы на западе
		{
			const x = -50, z = -0.6;
			batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z - 0.9), M.concrete);
			batch.add(place(box(5.4, 0.15, 2.2, 1), x, 2.45, z), M.metalRust);
			for (const dx of [-2.4, 2.4]) batch.add(place(box(0.12, 2.4, 0.12), x + dx, 1.2, z + 0.9), M.metalDark);
			collide(x, z - 0.9, 5, 0.4);
			bench(batch, M, x, z - 0.3, Math.PI);
		}
		bus(batch, M, root, -52, 3, -Math.PI / 2 + 0.08);
		collide(-52, 3, 2.6, 7.8, -Math.PI / 2 + 0.08);
		addCar(batch, M, root, 50, 5.5, Math.PI + 0.15, 0x5a5a3a, { burned: true });
		collide(50, 5.5, 4.3, 1.8, Math.PI + 0.15);
		pipePile(batch, M, collide, 56, -36, 1.4);
		hazardBarrels(batch, M, collide, -54, 30, rnd, 4);
		transformer(batch, root, M, collide, 56, 28);

		// ---------- ОРУ-35 кВ: второе распредустройство за своим забором (северо-восток) ----------
		{
			const X0 = 60, X1 = 84, Z0 = -14, Z1 = -50, GX = 72, P2 = -42;
			concreteFence(batch, M, collide, root, X0, Z0, GX - 3, Z0);
			concreteFence(batch, M, collide, root, GX + 3, Z0, X1, Z0);
			concreteFence(batch, M, collide, root, X1, Z0, X1, Z1);
			concreteFence(batch, M, collide, root, X0, Z1, X1, Z1);
			concreteFence(batch, M, collide, root, X0, Z0, X0, Z1);
			// створки ворот: одна сорвана и лежит на въезде, другая распахнута
			batch.add(place(box(3.4, 0.06, 2.1), GX - 1.6, 0.05, Z0 + 2.2, 0.3), M.metalOlive);
			batch.add(place(box(3.4, 2.1, 0.06), GX + 4.6, 1.1, Z0 + 1.3, -0.35), M.metalOlive);
			for (const x of [64, 80]) batch.add(place(new THREE.PlaneGeometry(1.0, 0.34), x, 1.7, Z0 + 0.11), danger, { cast: false });
			// два трансформатора 35/10 кВ, между ними — проезд; выключатели и портал на севере
			for (const x of [65, 79]) power(x, -27);
			for (const x of [65, 79]) bay(x, -27, -35, P2);
			for (const x of [61.5, 72, 82.5]) {
				batch.add(place(new THREE.CylinderGeometry(0.2, 0.26, 9.2, 8), x, 4.6, P2), M.concrete);
				collide(x, P2, 0.6, 0.6);
			}
			batch.add(place(box(21.4, 0.5, 0.5, 2), 72, 9.1, P2), M.metalRust);
			batch.add(place(box(21.4, 0.12, 0.9), 72, 8.82, P2), M.metalRust);
			for (const x of [63.32, 65, 66.68, 77.32, 79, 80.68, 68.5, 72, 75.5]) rod(batch, M.green, [x, 8.85, P2], [x, 7.9, P2], 0.09, 6);
			span([63.32, 7.9, P2], [80.68, 7.9, P2], 0.25, 10); // сборные шины вдоль портала
			// линия 35 кВ на север: две опоры пониже, дальше — в муть
			const pa = pylon(batch, M, collide, 72, -64, 0.8), pb = pylon(batch, M, collide, 72, -84, 0.8);
			[68.5, 72, 75.5].forEach((x, i) => {
				span([x, 7.9, P2], [pa[i][0], pa[i][1], -64], 1.0);
				span([pa[i][0], pa[i][1], -64], [pb[i][0], pb[i][1], -84], 1.3);
				span([pb[i][0], pb[i][1], -84], [pb[i][0], pb[i][1] - 1.2, -100], 1.3);
			});
			buildings.push(buildRelay(bctx, { name: 'Relay', cx: 65.5, cz: -18.4 }));
			drum(81.4, -18.5, 0.8, 0.2);
			drum(79.6, -20.2, 0.7, 1.1);
			hazardBarrels(batch, M, collide, 80.5, -47.5, rnd, 4);
			for (const [x, z, r] of [[63, -46.5, 0.4], [64.6, -47.6, 0.1]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }
		}

		// ---------- Ремонтно-производственная база РЭС (северо-запад) ----------
		{
			const X0 = -64, X1 = -16, Z0 = -54, Z1 = -84;
			concreteFence(batch, M, collide, root, X0, Z0, X1, Z0);
			concreteFence(batch, M, collide, root, X0, Z0, X0, Z1);
			concreteFence(batch, M, collide, root, X0, Z1, X1, Z1);
			concreteFence(batch, M, collide, root, X1, Z0, X1, -61); // ворота с дороги на север: z −69…−61
			concreteFence(batch, M, collide, root, X1, -69, X1, Z1);
			billboard(batch, M, root, collide, -40, -53.3, 0, 'РПБ «ЭНЕРГОРЕМОНТ»', { w: 6.4, h: 0.9, y: 3.4, bg: '#2a2c26', fg: '#e8dcae' });
			buildings.push(
				buildRepairShop(bctx, { name: 'RepairShop', cx: -44, cz: -76 }),
				buildGarageRow(bctx, { name: 'RpbGarages', cx: -25, cz: -79, n: 3, loot: [
					{ kind: 'bench', loot: { parts: [1, 2, 0.5], scrap: [1, 3, 0.45], fuel: [1, 1, 0.3], ammo545: [5, 10, 0.25] } },
					null,
					{ kind: 'shelf', loot: { parts: [1, 2, 0.45], scrap: [2, 3, 0.4], fuel: [1, 2, 0.3], ammo762: [5, 10, 0.2] } },
				] }),
			);
			// двор: «Урал» с будкой, запасной трансформатор на салазках, трактор, катушки, трубы, лом
			armyTruck(batch, M, root, collide, -28, -61.5, Math.PI / 2 + 0.1);
			{
				const x = -56, z = -62;
				batch.add(place(box(4.0, 0.25, 3.0, 2), x, 0.12, z), M.metalDark);
				batch.add(place(box(3.4, 2.4, 2.4, 1.5), x, 1.45, z), M.tankWhite);
				for (const s of [-1, 1]) for (let i = 0; i < 7; i++) batch.add(place(box(0.06, 2.0, 0.7), x - 1.2 + i * 0.4, 1.4, z + s * 1.55), M.metalDark);
				collide(x, z, 4.0, 3.6);
			}
			{
				// гусеничный трактор с отвалом
				const x = -59.5, z = -72, c = Math.cos(0.1), s = Math.sin(0.1);
				batch.add(place(box(2.2, 1.1, 3.6, 1.5), x, 0.9, z, 0.1), M.yellow);
				batch.add(place(box(1.6, 1.3, 1.5, 1.5), x - 0.2 * c, 2.1, z + 0.8, 0.1), M.yellow);
				batch.add(place(box(1.5, 0.9, 0.05), x - 0.2 * c, 2.3, z + 0.05, 0.1), M.glass);
				for (const sx of [-1, 1]) batch.add(place(box(0.5, 0.7, 4.0), x + sx * 1.25 * c, 0.35, z - sx * 1.25 * s, 0.1), M.tire);
				batch.add(place(box(3.0, 1.0, 0.25), x - 2.4 * s, 0.5, z - 2.4 * c, 0.1, 0.2), M.metalRust); // отвал
				batch.add(place(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6), x + 0.6, 2.4, z - 0.5), M.metalDark); // выхлопная труба
				collide(x, z - 0.3, 3.2, 5.0, 0.1);
			}
			drum(-48, -58.4); drum(-45.6, -58.8, 0.75, 0.3);
			pipePile(batch, M, collide, -34, -57.6, 0);
			hazardBarrels(batch, M, collide, -20.5, -72.5, rnd, 5);
			// куча лома: скрученное железо и ржавые бочки
			for (let i = 0; i < 7; i++) {
				const a = i * 2.4, d = (i % 3) * 0.6;
				batch.add(place(blob(0.5 + (i % 3) * 0.25, 0, 40 + i).scale(1.4, 0.6, 1), -21.5 + Math.cos(a) * d, 0.2 + (i % 2) * 0.2, -58.5 + Math.sin(a) * d, a), M.metalRust);
			}
			batch.add(place(box(2.6, 0.08, 0.3), -22.4, 0.6, -57.8, 0.6, 0.3), M.metalDark);
			collide(-21.5, -58.5, 3.2, 2.6);
			for (const [x, z, r] of [[-61.6, -58, 0.1], [-61.4, -56.5, 0.7]]) {
				beginProp('crate', x, z, r);
				batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood);
				endProp();
				collide(x, z, 1.2, 0.9, r);
			}
		}

		// ---------- Посёлок: новая улица на юге — магазин, дома, дача, детская площадка, башня, «ракушки» ----------
		buildings.push(
			buildStore(bctx, { name: 'Store', cx: -6, cz: 50 }),
			buildHouse(bctx, { name: 'House4', cx: -44, cz: 71, ry: 0, rnd, variant: 3 }),
			buildHouse(bctx, { name: 'House5', cx: -26, cz: 71, ry: 0, rnd, variant: 0 }),
			buildDacha(bctx, { name: 'Dacha1', cx: 26, cz: 70, ry: 0, rnd, variant: 1 }),
		);
		fencePlot(batch, M, collide, -44, 71, 15, 13, 'n', rnd);
		fencePlot(batch, M, collide, -26, 71, 15, 13, 'n', rnd);
		fencePlot(batch, M, collide, 26, 70, 11, 10, 'n', rnd);
		shed(batch, M, collide, -49.4, 76.2, 0.05);
		woodpile(batch, M, collide, -21.2, 76.4, 0);
		shed(batch, M, collide, 34.2, 72.5, 0.1);
		addCar(batch, M, root, -34.5, 60.6, 0.25, 0x4a4a52, { burned: true }); // сгорела посреди улицы
		collide(-34.5, 60.6, 4.3, 1.8, 0.25);
		addCar(batch, M, root, 12, 64.2, Math.PI - 0.12, 0x6a7a5a);
		collide(12, 64.2, 4.3, 1.8, Math.PI - 0.12);
		// детская площадка: качели, горка, песочница, карусель, «грибок», лавочки
		{
			ground(16, 13, -8, 72, M.dirt, 4, 0.0132);
			swings(batch, M, -12, 68.6);
			slide(batch, M, -3, 75.5);
			collide(-3, 75.5, 1.1, 1.1);
			batch.add(place(planeXZ(3, 3, 2), -12, 0.06, 75.5), M.sand, { cast: false });
			for (const [w, d, x, z] of [[3.2, 0.2, -12, 74], [3.2, 0.2, -12, 77], [0.2, 3.2, -13.5, 75.5], [0.2, 3.2, -10.5, 75.5]]) batch.add(place(box(w, 0.25, d), x, 0.12, z), M.woodYellow);
			batch.add(place(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 14), -5, 0.45, 69.5), M.red); // карусель
			batch.add(place(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), -5, 0.9, 69.5), M.metalDark);
			collide(-5, 69.5, 2.4, 2.4);
			batch.add(place(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6), -9.5, 1.1, 78.4), M.wood); // «грибок»
			batch.add(place(new THREE.ConeGeometry(1.4, 0.7, 12), -9.5, 2.4, 78.4), M.red);
			collide(-9.5, 78.4, 0.4, 0.4);
			bench(batch, M, -15.2, 72, Math.PI / 2);
			bench(batch, M, -1.4, 78.6, Math.PI);
		}
		// водонапорная башня и насосная у западного конца улицы
		occluder('WaterTower', (kb) => waterTower(kb, M, collide, -60, 51), { cx: -60, cz: 51, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);
		batch.add(place(box(3.4, 2.6, 3.0, 1.5), -53.5, 1.3, 51), M.whiteBrick);
		batch.add(place(box(3.8, 0.15, 3.4, 2), -53.5, 2.68, 51), M.roofTar);
		batch.add(place(box(0.9, 1.9, 0.06), -53.5, 0.95, 52.53), M.metalRust);
		collide(-53.5, 51, 3.4, 3.0);
		// жестяные гаражи-«ракушки» и брошенные машины на востоке улицы
		[M.metalOlive, M.roofGreen, M.metalRust, M.roofGreen].forEach((m, i) => shellGarage(batch, M, collide, 46 + i * 4, 70, m));
		addCar(batch, M, root, 63, 71.5, 1.3, 0x5a6a4a, { crashed: true });
		collide(63, 71.5, 4.3, 1.8, 1.3);
		// столбы 10 кВ вдоль новой улицы — провода в общий набор отрезков
		if (OPTIONS.poles) {
			const xs = [-66, -44, -22, 0, 22, 44, 62], pz = 56.6;
			xs.forEach((x, i) => {
				batch.add(place(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 7), x, 3.75, pz), M.bark);
				batch.add(place(box(0.12, 0.12, 1.6), x, 7.0, pz), M.wood);
				collide(x, pz, 0.4, 0.4);
				if (i) for (const off of [-0.65, 0.65]) span([xs[i - 1], 7.05, pz + off], [x, 7.05, pz + off], 0.9, 10);
			});
		}

		// ---------- Котельная посёлка с трубой и теплотрассой (восток) ----------
		buildings.push(buildBoiler(bctx, { name: 'Boiler', cx: 68, cz: 40 }));
		chimney(batch, M, collide, 80, 43, 24);
		batch.add(place(box(3.4, 0.9, 0.9), 76.6, 4.4, 43), M.metalRust); // газоход к трубе
		batch.add(place(box(0.2, 4.0, 0.2), 76.6, 2.0, 43), M.metalDark);
		pipeRack(batch, M, collide, 24, 59, 48);
		batch.add(place(box(0.7, 0.7, 3.4), 61.6, 5.0, 46.4), M.silver); // ввод теплотрассы в котельную
		{
			// куча угля у западной стены
			for (let i = 0; i < 6; i++) batch.add(place(blob(0.9 + (i % 3) * 0.3, 0, 60 + i).scale(1.3, 0.5, 1), 56.6 + (i % 3) * 0.9 - 0.9, 0.25, 40 + Math.floor(i / 3) * 1.2 - 0.6, i), M.tankBlack);
			collide(56.6, 40, 4.4, 3.2);
		}

		// провода — в сцену одним мешем
		root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x1c1c1c })));

		const exits = [
			{ to: 'zarechny', x0: 85.2, x1: 90, z0: 0, z1: 8, spawn: [82.5, 4, -Math.PI / 2], sign: [84, 9.4, 'Заречный →'] },
			{ to: 'himmash', x0: -90, x1: -85.2, z0: 0, z1: 8, spawn: [-82.5, 4, Math.PI / 2], sign: [-84, 9.4, '← Химмаш'] },
			{ to: 'tc', x0: -11, x1: -5, z0: -90, z1: -85.2, spawn: [-8, -82.5, 0], sign: [-3.6, -84, '↑ ТЦ'] },
		];
		return {
			start: [82.5, 4, -Math.PI / 2],
			exits,
			// бегуны и топтуны по посёлку и складу; руберы — у трансформаторов обоих распредустройств
			groups: [
				{ at: [30, -30], r: 4, rubers: 1, runners: 1 },
				{ at: [20, -44], r: 4, runners: 1, stompers: 1 },
				{ at: [36, -17], r: 5, runners: 2 },
				{ at: [-22, -7], r: 6, runners: 2, stompers: 1 },
				{ at: [-22, -19], r: 3, runners: 1 },
				{ at: [-26, 27], r: 5, runners: 2, stompers: 1 },
				{ at: [-26, 20], r: 3, runners: 1 },
				{ at: [5, 31], r: 6, runners: 2 },
				{ at: [38, 16], r: 6, runners: 1, stompers: 1 },
				{ at: [2, 4], r: 8, runners: 2 },
				{ at: [-8, -28], r: 6, runners: 2 },
				// прежняя окраина
				{ at: [-50, -40], r: 6, runners: 2 },
				{ at: [50, 40], r: 6, runners: 1, stompers: 1 },
				{ at: [-50, 36], r: 6, runners: 2 },
				{ at: [30, -60], r: 4, stompers: 1 },
				{ at: [-16, 54], r: 7, runners: 2 },
				{ at: [56, -24], r: 5, runners: 2 },
				// новое кольцо: ОРУ-35 и линия, ремонтная база, новая улица посёлка, котельная, лес на западе
				{ at: [72, -32], r: 5, rubers: 1, runners: 1 },
				{ at: [68, -18], r: 4, runners: 2 },
				{ at: [72, -66], r: 6, runners: 1, stompers: 1 },
				{ at: [-40, -63], r: 6, runners: 2, stompers: 1 },
				{ at: [-44, -76], r: 4, runners: 1 },
				{ at: [-6, 50], r: 4, runners: 2 },
				{ at: [-35, 66], r: 6, runners: 1, stompers: 1 },
				{ at: [-8, 72], r: 5, runners: 2 },
				{ at: [26, 64], r: 5, runners: 1, stompers: 1 },
				{ at: [66, 30], r: 5, runners: 2 },
				{ at: [52, 66], r: 6, runners: 2 },
				{ at: [-72, -20], r: 6, runners: 2 },
			],
			onRoad,
			// горят сгоревшие машины на обочине и посреди новой улицы, бочка у склада и во дворе базы; тлеет кабель у ЗРУ
			fires: [[-8, 12.6, 'car'], [-31, -2.6], [12, -19, 'ground'], [-34.5, 60.6, 'car'], [-37, -64.5]],
			barrels: 8, // бочки с маслом и соляркой
			trees(tryTree) {
				// лес на северо-западе, берёзы вдоль трассы и в посёлке, яблони во дворах
				for (let i = 0; i < 26; i++) tryTree(R(-60, -12), R(-46, -26), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 12; i++) tryTree(R(-3, 6), R(-46, -12), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 30; i++) tryTree(R(-86, 86), R(13.5, 14.8), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 10; i++) tryTree(R(-11, 21), R(25, 27.5), 'apple');
				for (let i = 0; i < 6; i++) tryTree(R(8, 21), R(45, 47), 'apple');
				for (let i = 0; i < 14; i++) tryTree(R(-46, -14), R(28, 46), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(26, 48), R(32, 46), 'birch');
				// новое кольцо: лес между базой и ЛЭП, за базой на западе, по краю мути на севере, юге и востоке
				for (let i = 0; i < 22; i++) tryTree(R(-3, 25), R(-86, -50), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 18; i++) tryTree(R(-86, -66), R(-86, -8), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 14; i++) tryTree(R(-86, -64), R(12, 86), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 16; i++) tryTree(R(-86, 86), R(80, 86), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 10; i++) tryTree(R(38, 86), R(-86, -52), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(76, 86), R(10, 80), 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(-51, -19), R(75, 77.4), 'apple');
				for (let i = 0; i < 6; i++) tryTree(R(-74, 64), R(52, 55.6), 'birch');
			},
			beltDensity: 1.3,
			clutter: 16,
			blood: 18,
			puddles: 14,
			puddle: () => { const k = rnd(); return k < 0.4 ? [R(-86, 86), R(1, 7)] : k < 0.7 ? [R(-46, 46), R(-44, -14)] : [R(-70, 62), R(58, 62)]; },
			grass: 0.8,
			hint: (b) => ({
				Control: 'Щитовая — шкаф дежурного электромонтёра и сейф',
				Depot: 'Склад РЭС — стеллажи с ящиками, бывают гранаты',
				Dorm: 'Общежитие энергетиков — тумбочки у коек, шкафы в каптёрке коменданта',
				Relay: 'Релейная ОРУ-35 — шкаф с ЗИП: детали и патроны',
				RepairShop: 'Мастерская ремонтной базы — верстак, стеллаж запчастей, шкаф мастера: детали',
				RpbGarages: 'Гаражи базы — верстак и стеллаж: детали, лом, бензин',
				Store: 'Магазин «Продукты» — прилавок и стеллаж: консервы, аптечки',
				Boiler: 'Котельная — шкаф слесаря: детали и лом',
				Dacha1: 'Дача энергетика — шкаф, сундук, буфет',
			}[b.name] ?? 'Дом энергетика — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
