// Кластер «Дачи»: садовое товарищество «Рассвет» — дачные домики за заборами, теплицы, огороды,
// сторожка с оружейным шкафом, пруд. Выходы: на восток по дороге (к Заречному), на юг (к стабу) и на север
// (к Химмашу). Окраина: ещё участки по краям рядов, дачи у дороги на север, участок с водонапорной башней.
// Локация 180×180 м (half 90): прежнее товарищество — на тех же местах; в кольце до мути — дальний ряд участков за
// северным проездом, участки по краям рядов на западе, у въезда с востока — магазинчик и правление СНТ, на юго-востоке
// пасека, на юго-западе озерко с мостками, лодкой и лодочным сараем, дачи у дороги на юг, на северо-востоке свалка;
// по краям — сосновый лес, вдоль дороги на юг — лесополоса.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, buildDacha, buildGuardhouse, table, chair } from '../buildings.js';
import { boxTop } from '../facade.js';
import { waterTower, billboard } from '../props-industrial.js';
import {
	garden, woodpile, outhouse, clothesline, settlementSign, fencePlot, shed, well, addCar,
	greenhouse, pond, transformer, powerLine, waterBarrel,
} from '../props.js';

const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);

// ---------- Мебель-тайники (лицо мебели — в +Z её осей) ----------

const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);
const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.4, 0.05, 0.75, 0, 0.75, 0, b.IM.furniture], [0.45, 0.72, 0.7, 0.45, 0.36, 0, b.IM.furniture],
	[0.06, 0.72, 0.06, -0.62, 0.36, 0.3, b.IM.furniture], [0.06, 0.72, 0.06, -0.62, 0.36, -0.3, b.IM.furniture],
	[0.3, 0.04, 0.22, -0.2, 0.79, 0, b.IM.books[0]], [0.24, 0.03, 0.3, 0.3, 0.79, 0.05, b.IM.books[1]],
], [1.4, 0.75], loot, 0.95);
const safe = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.7, 1.1, 0.6, 0, 0.55, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, 0.7, 0.31, b.IM.black],
], [0.7, 0.6], loot, 1.1);
const locker = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.85, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, 0.2, 1.7, 0.26, b.IM.black],
], [0.85, 0.5], loot, 1.9);
const toolbox = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.1, 0.55, 0.6, 0, 0.275, 0, b.IM.crateGreen], [1.12, 0.06, 0.62, 0, 0.58, 0, b.IM.metal], [0.5, 0.05, 0.05, 0, 0.66, 0, b.IM.black],
], [1.1, 0.6], loot, 0.7);
const shelf = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.4, 1.9, 0.5, 0, 0.95, 0, b.IM.furnitureLight],
	...[0.45, 0.95, 1.45].map((y) => [2.3, 0.04, 0.48, 0, y, 0.02, b.IM.furniture]),
	[2.0, 0.22, 0.3, 0, 0.58, 0.05, b.IM.cans], [1.6, 0.25, 0.3, -0.2, 1.08, 0.05, b.IM.jars], [1.8, 0.22, 0.3, 0.15, 1.58, 0.05, b.IM.cans],
], [2.4, 0.5], loot, 1.9);

/** Двускатная крыша вдоль X своих осей (конёк посередине) и фронтоны из материала gable. */
function gableRoof(b, roof, gable, rise, over = 0.45) {
	const { W, D, H } = b, hz = D / 2, half = hz + over, slope = Math.hypot(half, rise), a = Math.atan2(rise, half);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.7, 0.08, slope, 2), 0, H + rise / 2, (s * half) / 2, 0, s * a), roof);
	b.top_(place(boxTop(W + 0.74, 0.1, 0.24, 1), 0, H + rise + 0.04, 0), b.ctx.M.woodGrey);
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

/** Четыре наружные стены (lining — обои внутри или null); doors — середины проёмов на передней стене (−Z своих осей). */
function shell(b, mat, lining, t, doors, w = 1.2) {
	const hx = b.W / 2, hz = b.D / 2;
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat, t, doors, w, lining, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat, t, lining, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat, t, lining, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat, t, lining, side: -1 });
}

// ---------- Правление СНТ (можно зайти) ----------

/**
 * Контора правления 12×7 м из крашеных досок: вход с передней стены (−Z своих осей, к дороге); слева общая комната
 * (стол бухгалтера, шкаф с документами, шкафчик), справа кабинет председателя (стол, сейф с членскими взносами,
 * стол для собраний). Тайников пять.
 */
function buildPravlenie(ctx, { name = 'Pravlenie', cx, cz, ry = 0 }) {
	const W = 12, D = 7, H = 3.0, t = 0.2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.8 });
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	shell(b, M.woodYellow, IM.wallpaper[1], t, [-3.5]);
	b.wall('z', 0, -hz + t / 2, hz - t / 2, { mat: IM.wallpaper[1], t: 0.14, doors: [-1.8], w: 1.1 });
	const trim = IM.whitewash;
	for (const x of [-5, 1.5, 4.5]) b.window('front', x, { t, trim });
	for (const x of [-4.5, -1.5, 2, 4.5]) b.window('back', x, { t, trim });
	b.window('left', 0, { t, trim }); b.window('right', 0.4, { t, trim });
	b.furniture(-3.5 - 0.6, -hz + 0.1, -1.7, [[1.15, 2.05, 0.05, 0.58, 1.03, 0, M.woodGreen]], { up: true });
	b.lower(place(box(2.2, 0.2, 1.2), -3.5, 0.1, -hz - 0.7), M.wood);
	b.canopy('front', -3.5, { w: 2.2, d: 1.2, y: 2.45, mat: M.slate, posts: M.wood, t });
	b.top_(new THREE.PlaneGeometry(3.2, 0.5).rotateY(Math.PI).translate(1.5, H - 0.32, -hz - t / 2 - 0.03), T.signMaterial('ПРАВЛЕНИЕ СНТ', { bg: '#e8e2cc', fg: '#2a4a7a', w: 512, h: 80 }));
	gableRoof(b, M.slate, M.woodYellow, 1.8);
	b.chimney(-1.0, 1.0, H + 0.8, H + 2.1, 0.45, M.brick);
	// общая комната
	desk(b, 'Стол бухгалтера', -3.0, 2.6, Math.PI, { ammo919: [3, 6, 0.4], spore: 0.25 });
	cabinet(b, 'Шкаф с документами', -5.62, 0.6, Math.PI / 2, 1.2, 1.9, 0.45, { ammo12: [2, 5, 0.35], zhivchik: 0.25 });
	locker(b, 'Шкафчик', -0.9, 3.12, Math.PI, { ammo12: [3, 6, 0.4], fireaxe: 0.06 });
	b.furniture(-1.5, -hz + 0.35, 0, [[1.6, 0.05, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.45, 0.4, -0.7, 0.22, 0, IM.metal], [0.06, 0.45, 0.4, 0.7, 0.22, 0, IM.metal]], { solid: [1.6, 0.4] });
	b.furniture(-5.85, 2.6, Math.PI / 2, [[1.4, 0.9, 0.03, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0] }); // доска почёта
	// кабинет председателя
	desk(b, 'Стол председателя', 3.2, 2.6, Math.PI, { ammo919: [4, 8, 0.5], spore: 0.3, zhivchik: 0.2 });
	safe(b, 'Сейф', 5.45, -1.6, -Math.PI / 2, { ammo919: [6, 12, 0.65], ammo545: [6, 14, 0.3], spore: [1, 2, 0.4] });
	table(b, 2.4, -0.6, 0, { w: 1.6, d: 0.8 });
	chair(b, 1.25, -0.6, Math.PI / 2);
	chair(b, 2.4, 0.2, Math.PI);
	return b.finish();
}

// ---------- Магазинчик у въезда (можно зайти) ----------

/** Сельмаг 8×6 м из белого кирпича: дверь и витрина на передней стене (−Z своих осей); прилавок, стеллаж, холодильник. */
function buildStore(ctx, { name = 'Store', cx, cz, ry = 0 }) {
	const W = 8, D = 6, H = 3.0, t = 0.25, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.6 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	shell(b, M.whiteBrick, IM.shopWall, t, [1.8]);
	b.top_(new THREE.PlaneGeometry(2.6, 1.4).rotateY(Math.PI).translate(-1.8, 1.6, -hz - t / 2 - 0.02), M.glass);
	for (let k = -1.1; k < 1.2; k += 0.37) b.top_(place(box(0.04, 1.4, 0.04), -1.8 + k, 1.6, -hz - t / 2 - 0.06), M.metalDark);
	b.window('right', 0, { t, sill: M.whiteBrick });
	b.wallBox('front', 1.8 + 1.2, 1.1, 0.02, 2.05, 0.05, M.woodBlue, { t });
	b.lower(place(box(1.6, 0.2, 1.0), 1.8, 0.1, -hz - 0.6), M.concrete);
	b.top_(new THREE.PlaneGeometry(4.6, 0.62).rotateY(Math.PI).translate(-0.4, H - 0.32, -hz - t / 2 - 0.03), T.signMaterial('МАГАЗИН', { bg: '#e8e2cc', fg: '#8a2a20', w: 384, h: 64 }));
	gableRoof(b, M.roofTin, M.whiteBrick, 1.4);
	shelf(b, 'Стеллаж', -3.62, 0.5, Math.PI / 2, { zhivchik: 0.35, ammo919: [2, 5, 0.3] });
	b.container('Прилавок', 0.4, 1.9, Math.PI, [
		[2.2, 1.0, 0.7, 0, 0.5, 0, IM.furniture], [2.3, 0.05, 0.8, 0, 1.02, 0, IM.furnitureLight], [0.45, 0.25, 0.35, 0.6, 1.17, 0, IM.black],
	], [2.2, 0.7], { ammo12: [3, 6, 0.4], spore: 0.25 }, 1.25);
	b.container('Холодильник', 3.4, 2.4, Math.PI, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], [0.62, 0.6], { zhivchik: 0.5 }, 1.5);
	b.furniture(-2.6, -2.5, 0.2, [[0.8, 0.6, 0.6, 0, 0.3, 0, IM.crate], [0.7, 0.5, 0.5, 0.05, 0.85, 0, IM.crate]], { solid: [0.8, 0.6], prop: 'crate' });
	return b.finish();
}

// ---------- Пасека: домик пасечника (можно зайти) и ульи ----------

/** Бревенчатый домик пасечника 7×5 м: медогонка, стол с рамками; тайники — шкаф пасечника, ящик с рамками, буфет с мёдом. */
function buildBeeHut(ctx, { name = 'BeeHut', cx, cz, ry = 0 }) {
	const W = 7, D = 5, H = 2.6, t = 0.16;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.5 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.03, 0), IM.floor, { cast: false });
	shell(b, M.wood, IM.wallpaper[2], t, [-1.8]);
	const trim = IM.whitewash;
	b.window('front', 1.6, { t, trim }); b.window('back', -1.0, { t, trim }); b.window('left', 0, { t, trim });
	b.furniture(-1.8 - 0.6, -D / 2 + 0.08, -1.6, [[1.15, 1.95, 0.05, 0.58, 0.98, 0, M.woodGrey]], { up: true });
	b.lower(place(box(1.6, 0.2, 0.9), -1.8, 0.1, -D / 2 - 0.55), M.wood);
	gableRoof(b, M.roofTin, M.wood, 1.4);
	cabinet(b, 'Шкаф пасечника', 3.13, 0.2, -Math.PI / 2, 1.0, 1.9, 0.55, { ammo12: [3, 6, 0.45], dbarrel: 0.05, zhivchik: 0.25 });
	toolbox(b, 'Ящик с рамками', -2.6, 1.9, Math.PI, { ammo919: [3, 6, 0.35], spore: 0.3 });
	cabinet(b, 'Буфет', 0.6, 2.15, Math.PI, 1.1, 1.6, 0.45, { zhivchik: 0.45, spore: 0.2 }, IM.furnitureLight);
	b.furniture(-2.4, -0.6, 0, [[0, 0, 0, 0, 0, 0, IM.metal, { geo: cyl(0.42, 0.42, 0.9, 12).translate(0, 0.45, 0) }]], { solid: [0.9, 0.9] }); // медогонка
	b.furniture(1.5, -1.2, 0, [[1.2, 0.05, 0.7, 0, 0.75, 0, IM.furnitureLight], ...[[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]].map(([px, pz]) => [0.05, 0.72, 0.05, px, 0.36, pz, IM.furnitureLight]), [0.9, 0.12, 0.5, 0, 0.84, 0, M.woodYellow]], { solid: [1.2, 0.7] });
	return b.finish();
}

/** Улей на ножках: корпус, крышка из жести, леток. */
function hive(batch, M, collide, x, z, mat) {
	for (const [dx, dz] of [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.16], [0.2, 0.16]]) batch.add(place(box(0.05, 0.36, 0.05), x + dx, 0.18, z + dz), M.woodGrey);
	batch.add(place(box(0.55, 0.55, 0.45, 1), x, 0.63, z), mat);
	batch.add(place(box(0.66, 0.06, 0.56, 1), x, 0.94, z, 0, 0.08), M.roofTin);
	batch.add(place(box(0.22, 0.03, 0.02), x, 0.42, z + 0.235), M.metalDark);
	collide(x, z, 0.62, 0.52);
}

/** Жердяная изгородь от (x0,z0) до (x1,z1): столбы через ~3 м, две жерди; gap — [t0, t1] доли длины без изгороди. */
function railFence(batch, M, collide, x0, z0, x1, z1, gap = null) {
	const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(len / 3)), sl = len / n;
	const at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
	const inGap = (t) => gap && t > gap[0] + 0.01 && t < gap[1] - 0.01;
	for (let i = 0; i <= n; i++) {
		if (inGap(i / n)) continue;
		const [x, z] = at(i / n);
		batch.add(place(box(0.14, 1.3, 0.14), x, 0.65, z), M.woodGrey);
	}
	for (let i = 0; i < n; i++) {
		const tm = (i + 0.5) / n;
		if (inGap(tm)) continue;
		const [x, z] = at(tm);
		for (const y of [0.5, 1.0]) batch.add(place(box(sl, 0.1, 0.07), x, y, z, -ang), M.woodGrey);
		collide(x, z, sl, 0.2, -ang);
	}
}

// ---------- Озерко с мостками, лодкой и лодочным сараем ----------

/**
 * Озерко-эллипс: вода, берег, камыш (кроме места у мостков); мостки с восточного берега (x = shore) в воду до x = pierEnd
 * на линии z = pz. В воду не зайти — коллайдер полосами; у мостков полосы разрезаны: по мосткам можно выйти на воду.
 */
function lake(batch, root, M, collide, rnd, { x, z, rx, rz, pz, pierEnd, shore }) {
	const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), M.water);
	water.rotation.x = -Math.PI / 2;
	water.scale.set(rx, rz, 1);
	water.position.set(x, 0.035, z);
	water.receiveShadow = true;
	root.add(water);
	batch.add(place(new THREE.RingGeometry(0.93, 1.1, 40).scale(rx, rz, 1).rotateX(-Math.PI / 2), x, 0.03, z), M.dirt, { cast: false });
	const pw = 0.95; // полуширина мостков
	for (let i = 0; i < 70; i++) {
		const a = rnd() * Math.PI * 2, k = 0.88 + rnd() * 0.2;
		const px = x + Math.cos(a) * rx * k, qz = z + Math.sin(a) * rz * k;
		if (Math.abs(qz - pz) < pw + 0.8 && px > pierEnd - 1) continue;
		batch.add(place(new THREE.ConeGeometry(0.05, 0.9 + rnd() * 0.6, 4), px, 0.5, qz, 0, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3), M.leavesDry);
	}
	const n = 10, th = (rz * 0.88 * 2) / n;
	for (let i = 0; i < n; i++) {
		const z0 = z - rz * 0.88 + i * th, z1 = z0 + th, t = (z0 + th / 2 - z) / rz, hw = Math.sqrt(Math.max(0, 1 - t * t)) * rx * 0.88;
		const xl = x - hw, xr = x + hw;
		if (z1 <= pz - pw || z0 >= pz + pw || xr <= pierEnd) { collide(x, (z0 + z1) / 2, hw * 2, th); continue; }
		collide((xl + pierEnd) / 2, (z0 + z1) / 2, pierEnd - xl, th);
		for (const [a, c] of [[z0, pz - pw], [pz + pw, z1]]) if (c - a > 0.05) collide((pierEnd + xr) / 2, (a + c) / 2, xr - pierEnd, c - a);
	}
	// мостки: настил на сваях от берега до pierEnd
	const len = shore - pierEnd, cx = (shore + pierEnd) / 2;
	batch.add(place(box(len, 0.08, pw * 2, 1.2), cx, 0.32, pz), M.wood);
	for (let k = 0; k <= len; k += 2.2) for (const s of [-1, 1]) batch.add(place(cyl(0.08, 0.08, 0.7, 6), pierEnd + k + 0.1, 0.05, pz + s * (pw - 0.08)), M.woodGrey);
	// лодка у мостков: корпус с острым носом, банки, весло
	const bx = pierEnd + 2.6, bz = pz + pw + 1.0;
	batch.add(place(box(2.6, 0.32, 1.05, 1), bx, 0.12, bz, 0.08), M.woodGreen);
	batch.add(place(cyl(0.01, 0.53, 0.8, 4).rotateZ(Math.PI / 2).scale(1, 0.6, 1), bx - 1.68, 0.14, bz + 0.13, 0.08), M.woodGreen);
	for (const dx of [-0.5, 0.5]) batch.add(place(box(0.25, 0.04, 0.95), bx + dx, 0.3, bz, 0.08), M.wood);
	batch.add(place(box(2.2, 0.04, 0.06), bx + 0.2, 0.33, bz + 0.3, 0.25), M.woodGrey);
}

/** Лодочный сарай 6×4,5 м из досок: широкие ворота к воде (−Z своих осей), внутри лодка на козлах, сети, весло. */
function buildBoathouse(ctx, { name = 'Boathouse', cx, cz, ry = 0 }) {
	const W = 6, D = 4.5, H = 2.6, t = 0.16;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.3 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.03, 0), M.woodGrey, { cast: false });
	shell(b, M.woodGrey, null, t, [0], 2.2);
	for (const s of [-1, 1]) b.furniture(s * 1.1, -D / 2 - 0.05, s * 1.7, [[1.05, 2.0, 0.05, s * -0.52, 1.0, 0, M.wood]], { up: true });
	b.window('back', 1.6, { t }); b.window('left', 0, { t });
	gableRoof(b, M.roofTin, M.woodGrey, 1.2);
	toolbox(b, 'Ящик рыбака', -2.0, 1.55, Math.PI, { ammo12: [3, 6, 0.4], spore: 0.25 });
	cabinet(b, 'Шкаф', 2.4, 1.6, Math.PI, 1.0, 1.8, 0.5, { ammo919: [3, 6, 0.35], zhivchik: 0.3, fireaxe: 0.05 });
	b.furniture(0, 0.4, 0, [
		[0.12, 0.6, 0.9, -1.0, 0.3, 0, M.woodGrey], [0.12, 0.6, 0.9, 1.0, 0.3, 0, M.woodGrey],
		[2.8, 0.35, 0.95, 0, 0.78, 0, M.woodGreen], [0.25, 0.04, 0.85, 0.3, 0.97, 0, M.wood],
	], { solid: [2.8, 1.0] });
	b.furniture(0, 2.0, 0, [[1.6, 0.9, 0.04, 0, 1.4, 0, IM.rag], [0.06, 0.06, 2.2, -1.0, 1.6, -0.1, M.wood]], { solid: [0, 0] }); // сети и весло на стене
	return b.finish();
}

/** Свалка: кучи мусора (земля, железо, покрышки, холодильники, матрасы). */
function dump(batch, M, collide, rnd, R) {
	for (const [x, z, rx, rz] of [[60, -66.5, 4, 2.6], [70.5, -71, 5, 3.5], [79, -60, 3.5, 3], [62, -78.5, 4.5, 3], [77, -79, 3.2, 2.6], [69, -56, 2.6, 2]]) {
		batch.add(place(new THREE.SphereGeometry(1, 10, 7).scale(rx, 1.15, rz), x, -0.25, z, R(0, 3)), M.dirt);
		for (let k = 0; k < 9; k++) {
			const a = rnd() * Math.PI * 2, d = rnd() * 0.7, px = x + Math.cos(a) * rx * d, pz = z + Math.sin(a) * rz * d, y = 0.75 * (1 - d * d) + 0.1;
			const pick = rnd();
			if (pick < 0.3) batch.add(place(box(R(0.8, 1.6), 0.04, R(0.6, 1.1), 1), px, y, pz, R(0, 3), R(-0.4, 0.4), R(-0.4, 0.4)), M.metalRust);
			else if (pick < 0.5) batch.add(place(new THREE.TorusGeometry(0.3, 0.12, 6, 12), px, y, pz, R(0, 3), R(0.8, 1.6)), M.tire);
			else if (pick < 0.65) batch.add(place(box(0.6, 1.3, 0.6), px, y + 0.2, pz, R(0, 3), 0, R(1.0, 1.5)), M.white);
			else if (pick < 0.8) batch.add(place(box(1.6, 0.18, 0.9), px, y, pz, R(0, 3), R(-0.3, 0.3)), M.canvas);
			else batch.add(place(new THREE.IcosahedronGeometry(R(0.3, 0.5), 0), px, y, pz, R(0, 3)), M.tire);
		}
		collide(x, z, rx * 1.55, rz * 1.55);
	}
	for (const [x, z, r] of [[66, -63, 0.4], [74, -74, 1.2], [58, -71, 2.4], [80, -68, 0.2], [66, -82, 1.9]]) {
		beginProp('tire', x, z, r);
		batch.add(place(new THREE.TorusGeometry(0.3, 0.12, 8, 14), x, 0.12, z, 0, Math.PI / 2), M.tire);
		endProp();
	}
}

// Участки: x — середина, z — середина, что стоит (dacha | green | shed), куда калитка
const ROWS = {
	north: { z: -34.5, D: 19, gate: 's', ry: Math.PI, back: -4 },
	middle: { z: -9.5, D: 19, gate: 's', ry: Math.PI, back: -4 },
	south: { z: 17, D: 18, gate: 'n', ry: 0, back: 3.5 },
};
const PLOTS = [
	['north', -23.5, 'green'], ['north', -9, 'dacha'], ['north', 9, 'shed'], ['north', 23.5, 'dacha'],
	['middle', -38, 'dacha'], ['middle', -23.5, 'green'], ['middle', -9, 'dacha'], ['middle', 9, 'dacha'], ['middle', 23.5, 'green'], ['middle', 38, 'dacha'],
	['south', -38, 'shed'], ['south', -23.5, 'dacha'], ['south', 23.5, 'dacha'], ['south', 38, 'green'],
	// окраина: участки по краям рядов
	['north', -52.5, 'shed'], ['north', 52.5, 'dacha'],
	['middle', -52.5, 'dacha'], ['middle', 52.5, 'green'],
	['south', -52.5, 'green'], ['south', 52.5, 'dacha'],
];
const PW = 13; // ширина участка

export default {
	id: 'dachi',
	seed: 2024,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;

		// ---------- Дороги: грунтовка с востока, проезды между участками, дорога на юг ----------
		ground(184, 6, 0, 4, M.dirt, 4, 0.02);
		ground(4, 94, 0, -45, M.dirt, 4, 0.018);
		ground(150, 4, 0, -22, M.dirt, 4, 0.016);
		ground(5, 85, 0, 49.5, M.dirt, 4, 0.018);
		const onRoad = (x, z, m = 0) => Math.abs(z - 4) < 3 + m || (Math.abs(x) < 2.5 + m && z > 7 - m)
			|| (Math.abs(x) < 2 + m && z < 1 + m) || (Math.abs(z + 22) < 2 + m && Math.abs(x) < 75)
			|| (Math.abs(z + 64.5) < 2 + m && x > -80 && x < 56) // дальний проезд за северными участками
			|| (x > 60 - m && x < 76 + m && ((z > -3.9 - m && z < 1) || (z > 7 && z < 11.4 + m))) // площадки у магазина и правления
			|| (Math.abs(z - 69) < 1 + m && x > -55.5 && x < -44); // мостки на озерке

		// ---------- Участки ----------
		let variant = 0;
		const appleSpots = [];
		const plot = (row, cx, kind, i) => {
			const cz = row.z;
			fencePlot(batch, M, collide, cx, cz, PW, row.D, row.gate, rnd);
			const side = row.gate === 's' ? 1 : -1; // калитка к дороге: юг (+1) или север (−1)
			const backZ = cz + row.back; // дальняя от калитки часть участка
			if (kind === 'dacha') {
				buildings.push(buildDacha(bctx, { name: `Dacha${i}`, cx: cx - 1.5, cz: backZ, ry: row.ry, rnd, variant: variant++ }));
				garden(batch, M, rnd, cx + 3.6, cz + side * 3.6, 3, 5.5);
				outhouse(batch, M, collide, cx + 4.6, backZ - side * 3.6, row.ry);
				waterBarrel(batch, M, collide, cx + 4.9, backZ);
				if (rnd() < 0.5) woodpile(batch, M, collide, cx + 3.2, backZ - side * 1.6, 0);
			} else if (kind === 'green') {
				greenhouse(batch, M, collide, cx - 2.6, cz - side * 1.5, 6, 3.2);
				greenhouse(batch, M, collide, cx + 2.6, cz - side * 1.5, 6, 3.2);
				garden(batch, M, rnd, cx, cz + side * 5.5, 5, 3);
				waterBarrel(batch, M, collide, cx + 5.3, cz - side * 6.5);
			} else {
				shed(batch, M, collide, cx - 3, backZ, rnd() * 0.2);
				garden(batch, M, rnd, cx + 2.5, cz, 4, 7);
				well(batch, M, collide, cx - 3.2, cz + side * 3.5);
			}
			appleSpots.push([cx, cz, row.D]);
		};
		PLOTS.forEach(([rowName, cx, kind], i) => plot(ROWS[rowName], cx, kind, i));
		clothesline(batch, M, root, collide, -43.2, -38.5, -4, rnd);

		// ---------- Окраина: дачи у дороги на север, участок с водонапорной башней на юге ----------
		// дача у дороги: калитка к дороге (gate 'e' | 'w'), домик в глубине участка дверью к ней
		const roadDacha = (cx, cz, gate, ry, i) => {
			fencePlot(batch, M, collide, cx, cz, PW, 13, gate, rnd);
			const back = cx + Math.sign(cx) * 2.6; // домик — в глубине участка, дверью к дороге
			buildings.push(buildDacha(bctx, { name: `Dacha${i}`, cx: back, cz: cz - 1.5, ry, rnd, variant: variant++ }));
			garden(batch, M, rnd, cx - Math.sign(cx) * 1.2, cz + 4.2, 3, 4);
			outhouse(batch, M, collide, back, cz + 4.6, ry);
			appleSpots.push([cx, cz, 13]);
		};
		for (const [cx, gate, ry, i] of [[-9, 'e', -Math.PI / 2, 20], [9, 'w', Math.PI / 2, 21]]) roadDacha(cx, -53, gate, ry, i);
		fencePlot(batch, M, collide, 32, 54, 16, 13, 'w', rnd);
		buildings.push(buildDacha(bctx, { name: 'Dacha22', cx: 35, cz: 54, ry: Math.PI / 2, rnd, variant: variant++, paint: M.woodBlue }));
		occluder('WaterTower', (kb) => waterTower(kb, M, collide, -40, 55), { cx: -40, cz: 55, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);
		woodpile(batch, M, collide, 27.5, 59.2, 0);

		// ---------- Сторожка у въезда с юга ----------
		buildings.push(buildGuardhouse(bctx, { cx: 9, cz: 12.5, ry: 0 }));
		{
			// шлагбаум и будка у дороги на юг
			batch.add(place(box(0.2, 1.0, 0.2), 3.2, 0.5, 9.2), M.metalDark);
			batch.add(place(box(0.08, 0.08, 4.6), 3.2, 0.95, 11.4), M.red); // поднятая стрела вдоль обочины
			collide(3.2, 9.2, 0.4, 0.4);
		}

		// ---------- Пруд, трансформаторная, колодец, ЛЭП, брошенные машины ----------
		pond(batch, root, M, collide, -27, 36, 9, 5.5, rnd);
		transformer(batch, root, M, collide, 24, 36);
		powerLine(batch, root, M, collide, -60, 60, 0.4);
		addCar(batch, M, root, 20, 4.6, 0.12, 0x6a7a4a);
		collide(20, 4.6, 4.3, 1.8, 0.12);
		addCar(batch, M, root, -14, 3.0, Math.PI + 0.2, 0xb8b0a0, { crashed: true });
		collide(-14, 3.0, 4.3, 1.8, Math.PI + 0.2);
		addCar(batch, M, root, 0.3, -32, Math.PI / 2 + 0.1, 0x1c1a18, { burned: true });
		collide(0.3, -32, 4.3, 1.8, Math.PI / 2 + 0.1);
		settlementSign(batch, M, root, collide, 36.5, 7.6, 'СНТ «РАССВЕТ»');
		// доска объявлений у въезда
		batch.add(place(box(1.6, 1.0, 0.08), 30.7, 1.5, 7.6), M.woodGrey);
		for (const dx of [-0.7, 0.7]) batch.add(place(box(0.08, 2.0, 0.08), 30.7 + dx, 1.0, 7.6), M.wood);
		collide(30.7, 7.6, 1.7, 0.3);

		// ==================== Новые районы (кольцо между прежним краем и мутью) ====================
		ground(136, 4, -12, -64.5, M.dirt, 4, 0.017); // дальний проезд
		ground(16, 3, 68, -2.4, M.dirt, 4, 0.016); // площадка у магазина
		ground(16, 4, 67, 9.4, M.dirt, 4, 0.016); // площадка у правления
		// участки: по краям рядов на западе, северный ряд — и на востоке, дальний ряд за проездом (калитки к проезду),
		// дачи у дороги на юг
		const FAR = { z: -74.5, D: 15, gate: 's', ry: Math.PI, back: -3 };
		let n = 23;
		for (const [row, cx, kind] of [[ROWS.north, -67, 'dacha'], [ROWS.middle, -67, 'green'], [ROWS.south, -67, 'dacha'], [ROWS.north, 67, 'dacha'],
			[FAR, -66, 'dacha'], [FAR, -52.5, 'green'], [FAR, -38, 'dacha'], [FAR, -23.5, 'shed'], [FAR, -9, 'dacha'], [FAR, 9, 'green'], [FAR, 23.5, 'dacha'], [FAR, 38, 'shed']]) plot(row, cx, kind, n++);
		for (const [cx, gate, ry] of [[-9, 'e', -Math.PI / 2], [9, 'w', Math.PI / 2]]) roadDacha(cx, 72, gate, ry, n++);

		// ---------- Въезд с востока: магазинчик, правление СНТ с флагом, ворота товарищества ----------
		buildings.push(buildStore(bctx, { cx: 67, cz: -7, ry: Math.PI }));
		buildings.push(buildPravlenie(bctx, { cx: 67, cz: 15, ry: 0 }));
		addCar(batch, M, root, 74, -2.2, 0.05, 0x6a7a4a);
		collide(74, -2.2, 4.3, 1.8, 0.05);
		batch.add(place(cyl(0.06, 0.08, 6.2, 8), 74.2, 3.1, 10.0), M.metalDark);
		batch.add(new THREE.PlaneGeometry(1.3, 0.8).translate(74.87, 5.6, 10.0), M.red);
		collide(74.2, 10.0, 0.3, 0.3);
		for (const z of [0.4, 7.6]) { batch.add(place(box(0.3, 2.3, 0.3), 79, 1.15, z), M.woodGrey); collide(79, z, 0.4, 0.4); }
		batch.add(place(box(0.08, 1.5, 2.7), 79.9, 0.8, -1.0, 0.35), M.woodGrey); // створки ворот распахнуты наружу
		batch.add(place(box(0.08, 1.5, 2.7), 79.9, 0.8, 9.0, -0.35), M.woodGrey);
		railFence(batch, M, collide, 79, -6, 79, 0.2);
		railFence(batch, M, collide, 79, 7.8, 79, 13.5);

		// ---------- Пасека на юго-востоке: изгородь, ульи рядами, домик пасечника, сарай ----------
		railFence(batch, M, collide, 50, 42, 80, 42, [0.27, 0.4]);
		railFence(batch, M, collide, 80, 42, 80, 77);
		railFence(batch, M, collide, 80, 77, 50, 77);
		railFence(batch, M, collide, 50, 77, 50, 42, [0.45, 0.6]);
		const hiveMats = [M.woodYellow, M.woodBlue, M.woodGreen, M.white];
		[47, 51.5, 56, 60.5].forEach((z, r) => [54, 57.5, 61, 64.5, 68, 71.5].forEach((x, c) => hive(batch, M, collide, x, z, hiveMats[(r + c) % 4])));
		buildings.push(buildBeeHut(bctx, { cx: 72, cz: 70.5, ry: 0 }));
		shed(batch, M, collide, 56, 72, 0.1);
		woodpile(batch, M, collide, 77, 74.5, Math.PI / 2);

		// ---------- Озерко на юго-западе: мостки, лодка, лодочный сарай ----------
		lake(batch, root, M, collide, rnd, { x: -60, z: 70, rx: 14, rz: 8, pz: 69, pierEnd: -55, shore: -44.6 });
		buildings.push(buildBoathouse(bctx, { cx: -39.5, cz: 76.5, ry: Math.PI / 2 }));

		// ---------- Свалка на северо-востоке ----------
		dump(batch, M, collide, rnd, R);
		addCar(batch, M, root, 66.5, -51.5, 0.5, 0x1c1a18, { burned: true });
		collide(66.5, -51.5, 4.3, 1.8, 0.5);
		billboard(batch, M, root, collide, 54, -50, 0, 'МУСОР НЕ ВАЛИТЬ!', { w: 3.2, h: 0.8, y: 1.7, bg: '#e8e2cc', fg: '#8a2a20' });

		return {
			start: [82.5, 4, -Math.PI / 2],
			exits: [
				{ to: 'zarechny', x0: 85.2, x1: 90, z0: 1, z1: 7, spawn: [82.5, 4, -Math.PI / 2], sign: [84, 7.6, 'Заречный →'] },
				{ to: 'stab', x0: -2.5, x1: 2.5, z0: 85.2, z1: 90, spawn: [0, 82.5, Math.PI], sign: [4, 84, '↓ Стаб «Полис»'] },
				{ to: 'himmash', x0: -2.5, x1: 2.5, z0: -90, z1: -85.2, spawn: [0, -82.5, 0], sign: [4, -84, '↑ Химмаш'] },
			],
			groups: [
				{ at: [-9, -12], r: 5, runners: 2 },
				{ at: [9, -12], r: 5, runners: 2 },
				{ at: [-38, -11], r: 5, runners: 1 },
				{ at: [38, -11], r: 5, runners: 2 },
				{ at: [-23.5, -9], r: 6, runners: 1 },
				{ at: [-9, -36], r: 5, runners: 2 },
				{ at: [23.5, -36], r: 5, runners: 1, stompers: 1 },
				{ at: [0, -22], r: 10, runners: 2 },
				{ at: [-23.5, 18], r: 5, runners: 2 },
				{ at: [23.5, 18], r: 5, runners: 1 },
				{ at: [9, 13], r: 4, runners: 1, stompers: 1 },
				{ at: [-27, 28], r: 6, runners: 1 },
				{ at: [-30, 4], r: 8, runners: 2 },
				{ at: [30, -22], r: 6, stompers: 1 },
				// окраина
				{ at: [-52.5, -9.5], r: 5, runners: 2 },
				{ at: [52.5, -34.5], r: 5, runners: 1, stompers: 1 },
				{ at: [52.5, 17], r: 5, runners: 2 },
				{ at: [0, -53], r: 8, runners: 2 },
				{ at: [32, 54], r: 6, runners: 1, stompers: 1 },
				{ at: [-40, 50], r: 6, runners: 2 },
				// новые районы: дальний ряд, свалка, края рядов, въезд, пасека, озерко, дачи у дороги на юг, лес
				{ at: [-60, -71], r: 7, runners: 2 },
				{ at: [-23.5, -72], r: 6, runners: 1, stompers: 1 },
				{ at: [23.5, -72], r: 6, runners: 2 },
				{ at: [-8, -64.5], r: 7, runners: 2 },
				{ at: [68, -70], r: 8, runners: 2, stompers: 1 },
				{ at: [-67, -34.5], r: 5, runners: 2 },
				{ at: [-67, 17], r: 5, runners: 1 },
				{ at: [67, -34.5], r: 5, runners: 2 },
				{ at: [64, -10], r: 5, runners: 1 },
				{ at: [66, 24], r: 6, runners: 2 },
				{ at: [62, 54], r: 8, runners: 2, stompers: 1 },
				{ at: [-58, 58], r: 7, runners: 2 },
				{ at: [-12, 62], r: 6, runners: 2 },
				{ at: [-40, 70], r: 6, runners: 1 },
				{ at: [-80, -55], r: 6, runners: 1 },
			],
			onRoad,
			fires: [[0.3, -32, 'car'], [11, 7.6], [-26, -19.5, 'ground'], [64, -59, 'ground']],
			water: [[-27, 36, 9, 5.5], [-60, 70, 14, 8]],
			trees(tryTree) {
				// яблони на участках, сосновый лес по краям, берёзы у пруда
				for (const [cx, cz, D] of appleSpots) for (let k = 0; k < 3; k++) tryTree(cx + R(-5.5, 5.5), cz + R(-D / 2 + 1.5, D / 2 - 1.5), 'apple');
				// сосновый лес у мути (раньше — полосами у прежнего края, ±60…62)
				for (let i = 0; i < 40; i++) tryTree(R(-86, 86), R(-86.5, -83.5), 'pine');
				for (let i = 0; i < 34; i++) tryTree(R(-86.5, -76), R(-82, 86), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 34; i++) tryTree(R(80.5, 86.5), R(-82, 86), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 40; i++) tryTree(R(-76, 80), R(80.5, 86.5), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 18; i++) tryTree(R(-46, -10), R(28, 46), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 18; i++) tryTree(R(10, 46), R(28, 46), rnd() < 0.5 ? 'birch' : 'pine');
				// берёзы вокруг озерка, лесополоса вдоль дороги на юг, сосняк у свалки
				for (let i = 0; i < 22; i++) tryTree(R(-80, -42), R(56, 84), rnd() < 0.8 ? 'birch' : 'pine');
				for (let z = 30; z < 64; z += 3.4) { tryTree(-4.4 + R(-0.3, 0.3), z, 'birch'); tryTree(4.4 + R(-0.3, 0.3), z + 1.7, 'birch'); }
				for (let i = 0; i < 16; i++) tryTree(R(48, 84), R(-84, -48), 'pine');
			},
			beltDensity: 1.2,
			clutter: 10,
			blood: 18,
			puddles: 10,
			puddle: () => [R(-84, 84), rnd() < 0.6 ? R(2, 6) : R(-84, 84)],
			grass: 1.2,
			hint: (b) => ({
				Guardhouse: 'Сторожка — в оружейном шкафу бывают обрезы и патроны 12 калибра',
				Pravlenie: 'Правление СНТ — столы председателя и бухгалтера, шкаф с документами, шкафчик и сейф',
				Store: 'Магазин у въезда — прилавок, стеллаж и холодильник',
				BeeHut: 'Домик пасечника — шкаф, ящик с рамками и буфет',
				Boathouse: 'Лодочный сарай — ящик рыбака и шкаф',
			}[b.name] ?? 'Дачный домик — обыщи шкаф, сундук и буфет'),
		};
	},
};
