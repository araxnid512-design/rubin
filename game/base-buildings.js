// Постройки базы «Опорный» (game/base.js, locations/base.js) — в рост героя и с интерьером: стены ~3 м, двери 2,1 м,
// внутрь заходят (у здания, где герой, крыша и верх стен убираются — класс Building из game/buildings.js).
// Оружейная — прилавок и стойки с оружием (оружейник за прилавком), медпункт — койки и аптечный шкаф (медик),
// столовая — длинные столы и кухня (повар), мастерская — верстак и станок (механик), гараж — УАЗ под крышей,
// радиорубка — стол с рацией и мачта рядом (радист), теплица — стеклянная, с грядками, споровая лаборатория —
// светящиеся чаны с грибницей, бункер — бетон под насыпью, нары и ящики. Мебель — не тайники (на базе не обыскивают);
// где есть модель Tripo (стол, стул, койка, станок, ящики, бочки), её ставит game/env-props.js.
// Каждый строитель возвращает здание; station — где подойти к жителю (мир), npc — где он стоит ({ x, z, ry }).

import * as THREE from 'three';
import * as T from './textures.js';
import { box, place, planeXZ } from './geom.js';
import { Building, table, chair, bed } from './buildings.js';
import { addCar } from './props.js';

const T_WALL = 0.25;

/** Коробка здания: пол, четыре стены с дверями (doors: { side: [середины проёмов], w }), окна [[side, at]]. */
function shell(b, { wall, lining, floor, doors = { front: [0] }, w = 1.3, windows = [], t = T_WALL, sill = true }) {
	const { W, D } = b, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.5), 0, 0.025, 0), floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: wall, t, doors: doors.front ?? [], w, lining, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: wall, t, doors: doors.back ?? [], w, lining, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: wall, t, doors: doors.left ?? [], w, lining, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: wall, t, doors: doors.right ?? [], w, lining, side: -1 });
	for (const [side, at] of windows) b.window(side, at, { t, sill: sill ? wall : null });
	// ступенька у каждой двери в передней стене
	for (const at of doors.front ?? []) b.lower(place(box(w + 0.4, 0.16, 0.9), at, 0.08, -hz - 0.55), b.ctx.M.concrete);
}

/** Плоская крыша с бортиком. */
function flatRoof(b, mat) {
	b.top_(place(box(b.W + 0.5, 0.25, b.D + 0.5, 3), 0, b.H + 0.12, 0), mat);
}

/** Двускатная крыша, конёк вдоль X; фронтоны — треугольники стен (endMat). */
function gableRoof(b, rise, mat, endMat) {
	const { W, D, H } = b, half = D / 2 + 0.35, len = Math.hypot(half, rise) + 0.05, a = Math.atan2(rise, half);
	for (const s of [-1, 1]) {
		const g = box(W + 0.6, 0.1, len, 2);
		g.rotateX(s * a);
		b.top_(place(g, 0, H + rise / 2 + 0.05, (s * half) / 2), mat);
	}
	const sh = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rise)]);
	for (const sx of [-1, 1]) {
		const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false });
		g.translate(0, 0, -0.06);
		g.rotateY(Math.PI / 2);
		b.top_(place(g, (sx * W) / 2, H, 0), endMat);
	}
}

/** Вывеска над дверью передней стены. */
function sign(b, text, at = 0, { bg = '#2a2c26', fg = '#e8dcae', w = 2.4 } = {}) {
	const g = new THREE.PlaneGeometry(w, 0.5);
	g.rotateY(Math.PI);
	g.translate(at, b.H - 0.38, -b.D / 2 - T_WALL / 2 - 0.02);
	b.top_(g, T.signMaterial(text, { bg, fg, w: 480, h: 100 }));
}

/** Достроить: без разрухи на полу (здесь прибрано). */
function done(b) { b.messKind = null; return b.finish(); }

/** Точка в осях здания → мир; поворот жителя — в мире. */
const spot = (b, x, z, rot = 0) => { const [wx, wz] = b.world(x, z); return { x: wx, z: wz, ry: b.ry + rot }; };

// ---------- Оружейная: прилавок поперёк, за ним оружейник и стойки со стволами, ящики патронов ----------
export function baseArmory(ctx, { name = 'armory', cx, cz, ry = 0 }) {
	const W = 9, D = 6.5, H = 3.0;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hz = D / 2;
	shell(b, { wall: M.brick, lining: IM.armyWall, floor: IM.linoleum, doors: { front: [-2.2] }, windows: [['front', 1.8], ['left', 0], ['right', 0]] });
	flatRoof(b, M.roofTar);
	b.canopy('front', -2.2, { w: 1.8, d: 1.0, y: 2.5, mat: M.roofTar, t: T_WALL });
	sign(b, 'ОРУЖЕЙНАЯ', 1.6);
	// прилавок с проходом справа, решётка над ним
	b.furniture(-0.9, 0.2, 0, [[6.6, 1.05, 0.7, 0, 0.52, 0, IM.furniture], [6.7, 0.05, 0.8, 0, 1.07, 0, IM.furnitureLight]], { solid: [6.6, 0.7] });
	for (let x = -4.0; x <= 2.3; x += 0.55) b.furniture(x, 0.2, 0, [[0.03, 1.0, 0.03, 0, 2.05, 0, IM.metal]], { up: true });
	// стойки с автоматами вдоль задней стены
	for (const x of [-3.2, -0.8, 1.6]) {
		// задник, полка снизу и планка сверху; стволы стоят прикладом на полке, дулом вверх (видны и сверху)
		const parts = [[2.0, 1.9, 0.12, 0, 0.95, -0.12, IM.furniture], [2.0, 0.1, 0.4, 0, 0.55, 0.05, IM.furniture], [2.0, 0.06, 0.2, 0, 1.55, 0, IM.furniture]];
		for (let k = -3; k <= 3; k++) parts.push([0.07, 1.0, 0.09, k * 0.27, 1.12, 0.08, IM.black], [0.1, 0.22, 0.16, k * 0.27, 0.7, 0.1, IM.furnitureLight]);
		b.furniture(x, hz - 0.35, Math.PI, parts, { solid: [2.0, 0.4] });
	}
	// ящики с патронами и гранатами, стол с журналом
	b.furniture(3.4, hz - 0.6, 0, [[1.0, 0.6, 0.6, 0, 0.3, 0, IM.crateGreen], [0.9, 0.5, 0.55, 0, 0.85, 0, IM.crateGreen]], { solid: [1.0, 0.6], prop: 'ammo' });
	b.furniture(3.6, 1.0, 0.3, [[1.0, 0.6, 0.6, 0, 0.3, 0, IM.crateGreen]], { solid: [1.0, 0.6], prop: 'ammo' });
	table(b, 2.9, -2.0, 0, { w: 1.2, d: 0.7 });
	chair(b, 2.9, -1.4, Math.PI);
	b.station = spot(b, -1.0, -0.7);
	b.npc = spot(b, -1.0, 1.0, Math.PI);
	return done(b);
}

// ---------- Медпункт: две койки, аптечный шкаф, кушетка, стол; красный крест ----------
export function baseMedbay(ctx, { name = 'medbay', cx, cz, ry = 0 }) {
	const W = 8.5, D = 6.5, H = 3.0;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hx = W / 2, hz = D / 2;
	shell(b, { wall: M.whiteBrick, lining: IM.whitewash, floor: IM.linoleum, doors: { front: [0] }, windows: [['front', -2.6], ['front', 2.6], ['left', 0], ['right', 0]] });
	flatRoof(b, M.roofTar);
	b.canopy('front', 0, { w: 1.8, d: 1.0, y: 2.5, mat: M.roofTar, t: T_WALL });
	sign(b, '✚ МЕДПУНКТ', 0, { bg: '#ecebe4', fg: '#c01e1e', w: 2.6 });
	bed(b, -hx + 1.0, hz - 1.2, Math.PI);
	bed(b, -hx + 2.7, hz - 1.2, Math.PI);
	// капельница у коек
	b.furniture(-hx + 1.9, hz - 0.5, 0, [[0.04, 1.8, 0.04, 0, 0.9, 0, IM.metal], [0.3, 0.04, 0.04, 0, 1.75, 0, IM.metal], [0.12, 0.2, 0.06, 0.12, 1.6, 0, IM.jars]], { solid: [0.2, 0.2] });
	// аптечный шкаф со стеклом, тумба, кушетка, стол врача
	b.furniture(hx - 0.35, 1.2, -Math.PI / 2, [[1.4, 1.9, 0.45, 0, 0.95, 0, IM.white], [1.3, 1.1, 0.02, 0, 1.3, 0.23, IM.glass], [0.4, 0.4, 0.03, 0, 0.5, 0.24, IM.redBoard]], { solid: [1.4, 0.45] });
	b.furniture(hx - 0.9, hz - 0.5, 0, [[1.8, 0.55, 0.7, 0, 0.45, 0, IM.white], [1.8, 0.12, 0.7, 0, 0.78, 0, IM.linen]], { solid: [1.8, 0.7] });
	table(b, 2.2, -1.9, 0, { w: 1.2, d: 0.7 });
	chair(b, 2.2, -1.3, Math.PI);
	b.station = spot(b, 0, 0.2);
	b.npc = spot(b, 1.2, 1.2, Math.PI);
	return done(b);
}

// ---------- Столовая: деревянный зал, два длинных стола с лавками, кухня у задней стены ----------
export function baseCanteen(ctx, { name = 'kitchen', cx, cz, ry = 0 }) {
	const W = 11, D = 7.5, H = 2.9;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.9 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hx = W / 2, hz = D / 2;
	shell(b, { wall: M.wood, lining: IM.wallpaper[0], floor: IM.floor, doors: { front: [-1.5] }, windows: [['front', -4], ['front', 2], ['front', 4.2], ['back', -3], ['back', 3]], sill: false });
	gableRoof(b, 1.6, M.roofMetal, M.wood);
	b.canopy('front', -1.5, { w: 2.0, d: 1.1, y: 2.45, mat: M.roofMetal, t: T_WALL });
	sign(b, 'СТОЛОВАЯ', 2.6, { bg: '#3a2a1c', fg: '#f0d8a8' });
	// два стола с лавками
	for (const x of [-2.6, 1.6]) {
		b.furniture(x, -0.6, 0, [[3.2, 0.06, 0.9, 0, 0.76, 0, IM.furnitureLight], [0.08, 0.73, 0.8, -1.4, 0.37, 0, IM.furniture], [0.08, 0.73, 0.8, 1.4, 0.37, 0, IM.furniture]], { solid: [3.2, 0.9] });
		for (const s of [-1, 1]) b.furniture(x, -0.6 + s * 0.75, 0, [[3.0, 0.05, 0.3, 0, 0.45, 0, IM.furniture], [0.06, 0.43, 0.25, -1.3, 0.22, 0, IM.furniture], [0.06, 0.43, 0.25, 1.3, 0.22, 0, IM.furniture]], { solid: [3.0, 0.3] });
		b.furniture(x - 0.6, -0.6, 0, [[0.28, 0.12, 0.28, 0, 0.84, 0, IM.metal]]);
	}
	// кухня: стол-разделочная, плита с кастрюлями, полка с банками
	b.furniture(-1.0, hz - 0.4, Math.PI, [[4.2, 0.9, 0.65, 0, 0.45, 0, IM.white], [4.3, 0.05, 0.7, 0, 0.92, 0, IM.metal]], { solid: [4.2, 0.65] });
	b.furniture(2.6, hz - 0.45, Math.PI, [[1.6, 0.85, 0.8, 0, 0.42, 0, IM.black], [1.6, 0.04, 0.8, 0, 0.87, 0, IM.metal], [0.5, 0.35, 0.5, -0.4, 1.06, 0, IM.metal], [0.4, 0.25, 0.4, 0.4, 1.0, 0, IM.metal]], { solid: [1.6, 0.8] });
	b.furniture(hx - 0.3, 1.0, -Math.PI / 2, [[2.0, 1.6, 0.35, 0, 0.8, 0, IM.furniture], [1.9, 0.3, 0.25, 0, 1.15, 0.02, IM.jars], [1.9, 0.3, 0.25, 0, 0.6, 0.02, IM.cans]], { solid: [2.0, 0.35] });
	b.station = spot(b, 2.6, 1.9);
	b.npc = spot(b, 2.6, 2.6, Math.PI);
	return done(b);
}

// ---------- Мастерская: широкие ворота, верстак с тисками, токарный станок, щит с инструментом, бочки ----------
export function baseWorkshop(ctx, { name = 'workshop', cx, cz, ry = 0 }) {
	const W = 9.5, D = 7, H = 3.4;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hx = W / 2, hz = D / 2;
	shell(b, { wall: M.roofMetal, lining: IM.factoryWall, floor: M.concreteDark, doors: { front: [0] }, w: 2.8, windows: [['left', 0], ['right', 0]], sill: false });
	flatRoof(b, M.roofMetal);
	sign(b, 'МАСТЕРСКАЯ', -3.0);
	// верстак с тисками вдоль задней стены, щит с инструментом над ним
	b.furniture(-1.5, hz - 0.45, Math.PI, [[3.4, 0.08, 0.8, 0, 0.9, 0, IM.furniture], [3.3, 0.85, 0.7, 0, 0.43, 0, IM.machine], [0.2, 0.18, 0.3, 1.2, 1.03, 0, IM.metal]], { solid: [3.4, 0.8] });
	const board = [[3.2, 1.2, 0.05, 0, 1.8, 0, IM.furnitureLight]];
	for (let k = 0; k < 9; k++) board.push([0.05, 0.3 + (k % 3) * 0.1, 0.04, -1.4 + k * 0.35, 1.8, 0.04, IM.black]);
	b.furniture(-1.5, hz - 0.1, Math.PI, board);
	// станок (модель Tripo), бочки с маслом, шины
	b.furniture(hx - 1.3, 0.6, -Math.PI / 2, [[1.9, 1.1, 0.75, 0, 0.55, 0, IM.machine], [0.4, 0.4, 0.4, 0.6, 1.25, 0, IM.metal]], { solid: [1.9, 0.75], prop: 'lathe' });
	b.furniture(-hx + 0.6, 1.8, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, M.metalRust]], { solid: [0.6, 0.6], prop: 'barrel' });
	b.furniture(-hx + 0.6, 1.0, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, M.metalRust]], { solid: [0.6, 0.6], prop: 'barrel' });
	b.furniture(hx - 0.8, -hz + 1.0, 0, [[0.9, 0.5, 0.9, 0, 0.25, 0, M.tire]], { solid: [0.9, 0.9], prop: 'tire' });
	b.station = spot(b, -1.5, hz - 1.4);
	b.npc = spot(b, 0.6, hz - 1.3, Math.PI);
	return done(b);
}

// ---------- Гараж: ворота во всю ширину, УАЗ внутри, стеллаж с запчастями ----------
export function baseGarage(ctx, { name = 'garage', cx, cz, ry = 0 }) {
	const W = 7.2, D = 7, H = 3.2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hz = D / 2;
	shell(b, { wall: M.roofMetal, lining: null, floor: M.concreteDark, doors: { front: [0] }, w: 3.6, windows: [['left', 1.2]], sill: false });
	flatRoof(b, M.roofMetal);
	// УАЗ носом к воротам (машина addCar смотрит по своей +X — в осях здания к −Z)
	const [carX, carZ] = b.world(0.3, 0.4);
	addCar(ctx.batch, M, ctx.root, carX, carZ, b.ry - Math.PI / 2, 0x4a5a3a, { model: 'e_uaz' });
	b.collide(0.3, 0.4, 1.9, 4.3);
	b.furniture(-3.0, hz - 0.4, Math.PI, [[1.0, 2.0, 0.5, 0, 1.0, 0, IM.rack], [0.9, 0.3, 0.4, 0, 0.6, 0.02, IM.crate], [0.9, 0.3, 0.4, 0, 1.4, 0.02, IM.cans]], { solid: [1.0, 0.5] });
	b.furniture(2.9, hz - 0.6, 0, [[0.8, 0.9, 0.8, 0, 0.45, 0, M.tire]], { solid: [0.8, 0.8], prop: 'tire' });
	return done(b);
}

// ---------- Радиорубка: стол с рацией, карта на стене; мачта с антеннами на растяжках рядом ----------
export function baseRadio(ctx, { name = 'radio', cx, cz, ry = 0 }) {
	const W = 5, D = 4.2, H = 2.8;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hx = W / 2, hz = D / 2;
	shell(b, { wall: M.woodGrey, lining: IM.wallpaper[1], floor: IM.floor, doors: { front: [-1.2] }, windows: [['front', 1.2], ['right', 0]], sill: false });
	flatRoof(b, M.roofTar);
	sign(b, 'РАДИО', 1.0, { w: 1.6 });
	// стол с рацией (корпус, шкала, лампочки), стул, карта на стене
	b.furniture(0.6, hz - 0.45, Math.PI, [[2.2, 0.06, 0.8, 0, 0.76, 0, IM.furniture], [0.06, 0.73, 0.7, -1.0, 0.37, 0, IM.furniture], [0.06, 0.73, 0.7, 1.0, 0.37, 0, IM.furniture],
		[0.9, 0.45, 0.4, -0.3, 1.02, 0.1, IM.machine], [0.6, 0.15, 0.02, -0.3, 1.05, -0.11, IM.screen], [0.3, 0.3, 0.3, 0.6, 0.94, 0.1, IM.black]], { solid: [2.2, 0.8] });
	chair(b, 0.6, hz - 1.2, 0);
	b.furniture(-hx + 0.1, 0.4, Math.PI / 2, [[1.6, 1.0, 0.02, 0, 1.6, 0, IM.paper]]);
	// мачта снаружи у правой стены: решётчатая, с антеннами; растяжки
	const [mx, mz] = b.world(hx + 1.4, -0.4);
	for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.batch.add(place(box(0.06, 14, 0.06), mx + dx * 0.28, 7, mz + dz * 0.28), M.metalDark);
	for (let y = 1; y < 14; y += 1.4) ctx.batch.add(place(box(0.6, 0.04, 0.6), mx, y, mz), M.metalDark);
	for (const y of [12.6, 13.6]) ctx.batch.add(place(box(1.8, 0.05, 0.05), mx, y, mz, b.ry), M.metalDark);
	ctx.collide(mx, mz, 1.0, 1.0);
	b.station = spot(b, 0.6, hz - 1.7);
	b.npc = spot(b, 0.6, hz - 1.2, Math.PI);
	return done(b);
}

// ---------- Теплица: стекло в деревянной раме, две грядки и проход между ними ----------
export function baseGreenhouse(ctx, { name = 'greenhouse', cx, cz, ry = 0 }) {
	const W = 4.6, D = 8.5, H = 2.4;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.2 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hx = W / 2, hz = D / 2;
	shell(b, { wall: IM.glass, lining: null, floor: M.dirt, doors: { front: [0] }, w: 1.1, t: 0.06, sill: false });
	// рама: стойки по углам и вдоль стен
	for (let z = -hz; z <= hz + 0.01; z += D / 4) for (const sx of [-1, 1]) b.lower(place(box(0.08, H, 0.08), sx * hx, H / 2, z), M.wood);
	gableRoof(b, 1.0, IM.glass, IM.glass);
	// грядки с ростками споровой травы
	for (const sx of [-1, 1]) b.furniture(sx * (hx - 0.75), 0.4, 0, [[1.1, 0.35, D - 1.8, 0, 0.17, 0, M.woodGrey], [1.0, 0.1, D - 1.9, 0, 0.38, 0, M.grass]], { solid: [1.1, D - 1.8] });
	return done(b);
}

// ---------- Споровая лаборатория: четыре чана с грибницей светятся зелёным, стол с колбами, стеллаж ----------
let glowMat = null;
export function baseSporeLab(ctx, { name = 'sporefarm', cx, cz, ry = 0 }) {
	const W = 7.5, D = 5.5, H = 3.0;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.4 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hz = D / 2;
	glowMat ??= new THREE.MeshStandardMaterial({ color: 0x2a7a3a, emissive: 0x3cff6e, emissiveIntensity: 1.5, roughness: 0.4 });
	shell(b, { wall: M.concrete, lining: IM.factoryWall, floor: IM.linoleum, doors: { front: [-2.4] }, windows: [['front', 1.5], ['back', 0]] });
	flatRoof(b, M.roofTar);
	sign(b, 'ЛАБОРАТОРИЯ', 1.2, { bg: '#1c2a20', fg: '#8affa0', w: 2.6 });
	for (const [x, z] of [[-1.0, 0.8], [0.6, 0.8], [2.2, 0.8], [2.2, -0.9]]) {
		b.furniture(x, z, 0, [[1.0, 1.1, 1.0, 0, 0.55, 0, IM.machine], [0.86, 0.06, 0.86, 0, 1.12, 0, glowMat]], { solid: [1.0, 1.0] });
	}
	b.furniture(-2.8, hz - 0.4, Math.PI, [[1.6, 0.06, 0.7, 0, 0.8, 0, IM.white], [1.5, 0.78, 0.6, 0, 0.39, 0, IM.machine], [0.1, 0.25, 0.1, -0.5, 0.95, 0, IM.jars], [0.1, 0.2, 0.1, -0.2, 0.92, 0.1, IM.jars], [0.12, 0.3, 0.12, 0.3, 0.97, 0, IM.jars]], { solid: [1.6, 0.7] });
	b.furniture(-3.4, -0.6, Math.PI / 2, [[1.6, 1.8, 0.4, 0, 0.9, 0, IM.locker]], { solid: [1.6, 0.4] });
	return done(b);
}

// ---------- Бункер: бетон под земляной насыпью, вход меж мешков, нары и ящики со снаряжением ----------
export function baseBunker(ctx, { name = 'bunker', cx, cz, ry = 0 }) {
	const W = 6.5, D = 5.5, H = 2.6;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.8 });
	b.messKind = 'tidy'; // на базе живут: окна целые
	const { M } = ctx, IM = b.IM, hx = W / 2, hz = D / 2;
	shell(b, { wall: M.concreteDark, lining: IM.armyWall, floor: M.concreteDark, doors: { front: [0] }, w: 1.2, t: 0.4, sill: false });
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 2), 0, H + 0.15, 0), M.concreteDark);
	b.top_(place(box(W + 1.6, 0.5, D + 1.6, 2), 0, H + 0.5, 0), M.dirt);
	// мешки по бокам входа
	for (const sx of [-1, 1]) b.lower(place(box(1.3, 0.9, 0.7, 1), sx * 1.4, 0.45, -hz - 0.6), M.sandbag ?? M.dirt), b.collide(sx * 1.4, -hz - 0.6, 1.3, 0.7);
	// нары (модель Tripo), ящики со снаряжением, стол с лампой
	b.furniture(-hx + 0.6, 0.6, Math.PI / 2, [[2.0, 1.6, 0.9, 0, 0.8, 0, IM.metal], [1.9, 0.12, 0.85, 0, 0.45, 0, IM.blanketArmy], [1.9, 0.12, 0.85, 0, 1.35, 0, IM.blanketArmy]], { solid: [2.0, 0.9], prop: 'bunk' });
	b.furniture(hx - 0.6, 0.6, -Math.PI / 2, [[2.0, 1.6, 0.9, 0, 0.8, 0, IM.metal], [1.9, 0.12, 0.85, 0, 0.45, 0, IM.blanketArmy], [1.9, 0.12, 0.85, 0, 1.35, 0, IM.blanketArmy]], { solid: [2.0, 0.9], prop: 'bunk' });
	b.furniture(0, hz - 0.5, 0, [[1.0, 0.6, 0.6, 0, 0.3, 0, IM.crateGreen], [0.9, 0.5, 0.55, 0.05, 0.85, 0, IM.crateGreen]], { solid: [1.0, 0.6], prop: 'ammo' });
	table(b, 0, 0.5, 0, { w: 1.0, d: 0.6 });
	b.spawn = spot(b, 0, -1.4, Math.PI); // здесь очнёшься после гибели
	return done(b);
}
