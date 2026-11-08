// Кластер «Аэродром»: военный аэродром, который Улей забрал целиком — с полосой, техникой и складом вооружения.
// Локация большая — 180×180 м (half 90). Ядро (прежние 132×132 м) — за старым бетонным забором: через всю локацию
// с запада на восток — взлётно-посадочная полоса с разметкой (продлена до мути); южнее — рулёжка и стоянка:
// брошенный транспортный самолёт с опущенной рампой, вертолёт; по краям полосы — бетонные капониры с обваловкой
// (в одном — БТР, в другом — ящики и бочки), на полосе — разбитый горящий вертолёт. За стоянкой — два арочных ангара
// (в первый можно зайти: вертолёт со снятыми лопастями, верстаки, шкафы с инструментом, ящики), командно-диспетчерский
// пункт с остеклённой кабиной наверху (пульты, сейф), автопарк с БТР и «Уралами», радар на прицепе, мачта связи,
// топливный склад с цистернами, казарма лётного состава. В юго-восточном углу за своим забором с КПП — склад
// вооружения: ящики с гранатомётами и выстрелами, пирамиды, сейф — главная добыча кластера, и логово элиты.
// Окраина — между старым забором и новым внешним периметром (бетон с колючкой, вышки по углам, КПП на юге):
// на севере — вторая рулёжка со съездами на полосу, стоянки истребителей, обвалованный ангар-укрытие (истребитель
// на ремонте), радиолокатор на вышке и пост РЛС; на западе — пожарное депо с каланчой, разбитый Ан-2 в роще;
// на юге — две казармы лётного состава с плацем, стоянка спецтехники, склад ГСМ (резервуары в обваловании,
// насосная, ж/д цистерны); на востоке — хранилища боеприпасов под земляной обсыпкой за своей оградой (ценные
// тайники, второе логово элиты), штабеля авиабомб, МиГ-памятник у восточных ворот.
// Выходы: на северо-запад (НИИ), северо-восток (Военная часть), восток (Микрорайон) и юг (Подстанция).
// Опасность 4 — чёрная зона: элита у склада вооружения и у хранилищ, руберы, топтуны.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, buildArmyBarracks, buildArmory, buildCheckpoint, chair } from '../buildings.js';
import { addCar, blob, bench } from '../props.js';
import { concreteFence, storageTank, hazardBarrels, btr, armyTruck, barrier, watchTower, sandbags, billboard, pipeRack, railTrack, tankWagon } from '../props-industrial.js';

// периметр аэродрома (старый забор ядра) и внешний забор окраины (±OUT)
const FX0 = -56, FX1 = 56, FZ0 = -52, FZ1 = 42, OUT = 80;
// полоса: z от RW0 до RW1 (ширина 22 м), стоянка: z от AP0 до AP1, x ±APX
const RW0 = -48, RW1 = -26, AP0 = -22, AP1 = 0, APX = 40;
// ограда склада вооружения (юго-восточный угол, примыкает к периметру)
const AX = 22, AZ = 22;
const Z = Math.PI / 2;
const ONE = new THREE.Vector3(1, 1, 1);

/** Матрица: сдвиг и поворот (Эйлер XYZ: сначала rz, потом ry, потом rx). */
const frame = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), ONE);
/** Цилиндр вдоль оси X; r0 — на стороне −X. */
const cylX = (r0, r1, len, seg = 12) => new THREE.CylinderGeometry(r0, r1, len, seg).rotateZ(Z);
/** Колесо (ось вдоль Z своих осей). */
const wheel = (r, w, seg = 12) => new THREE.CylinderGeometry(r, r, w, seg).rotateX(Z);

/**
 * Транспортный самолёт (вроде Ан-26, в 0,9 натуральной величины): фюзеляж, остеклённая кабина, высокое крыло с двумя
 * турбовинтовыми двигателями (правый винт погнут), поднятый хвост с килем, рампа опущена до земли, шасси.
 * Нос — в +X своих осей, ry — куда смотрит нос. kb — куда класть геометрию (пачка).
 */
function transportPlane(kb, M, x, z, ry) {
	const F = frame(x, 0, z, ry);
	const put = (g, mat, m) => { g.applyMatrix4(m).applyMatrix4(F); kb.add(g, mat); };
	const Y = 2.7, skin = M.tankWhite; // ось фюзеляжа
	put(cylX(1.5, 1.5, 15, 14), skin, frame(-1.5, Y, 0)); // фюзеляж x −9…6
	put(new THREE.SphereGeometry(1.5, 14, 8).scale(2.0, 1, 1), skin, frame(6, Y, 0)); // нос
	put(new THREE.SphereGeometry(1.53, 12, 6, Math.PI - 0.95, 1.9, 0.25, 1.15).scale(2.0, 1, 1), M.glass, frame(6, Y, 0)); // остекление кабины
	put(cylX(0.5, 1.5, 7.6, 14), skin, frame(-12.7, Y + 0.55, 0, 0, 0, -0.16)); // хвостовая часть, поднята
	put(box(4.0, 0.8, 3.0, 1.5), skin, frame(0.5, Y + 1.25, 0)); // зализ крыла
	put(box(3.4, 0.3, 26, 2), skin, frame(0.5, Y + 1.55, 0)); // крыло
	for (const s of [-1, 1]) put(box(1.6, 0.14, 1.0), skin, frame(0.3, Y + 1.55, s * 13.3)); // законцовки
	for (const s of [-1, 1]) {
		put(cylX(0.6, 0.72, 3.8, 10), skin, frame(1.6, Y + 0.95, s * 4.6)); // гондола двигателя
		put(cylX(0.22, 0.22, 0.6, 8), M.metalDark, frame(3.75, Y + 0.95, s * 4.6)); // кок винта
		const bent = s > 0; // лопасти правого винта погнуты назад
		for (let k = 0; k < 4; k++) put(box(0.1, 3.6, 0.32).translate(0, 1.8, 0), M.metalDark, frame(3.95, Y + 0.95, s * 4.6, 0, k * Z + (bent ? 0.4 : 0.2), bent ? 0.45 : 0));
	}
	for (const s of [-1, 1]) for (let i = 0; i < 7; i++) put(box(0.02, 0.38, 0.38), M.glass, frame(-7 + i * 1.9, Y + 0.45, s * 1.5)); // иллюминаторы
	put(box(0.6, 1.4, 0.03), M.metalDark, frame(3.2, Y - 0.1, -1.51)); // дверь экипажа
	// хвостовое оперение: стреловидный киль со звездой, стабилизатор
	put(box(3.2, 4.6, 0.26, 1.5), skin, frame(-14.7, Y + 2.7, 0, 0, 0, 0.5));
	put(box(2.4, 0.2, 9.5, 1.5), skin, frame(-14.9, Y + 1.6, 0));
	for (const s of [-1, 1]) put(box(0.9, 0.9, 0.04), M.red, frame(-14.3, Y + 3.3, s * 0.16));
	put(box(4.2, 0.14, 2.6, 1.5), M.metalDark, frame(-10.8, 0.62, 0, 0, 0, 0.25)); // рампа опущена до земли
	// шасси: носовая стойка и основные в обтекателях по бортам
	put(box(0.16, 1.3, 0.16), M.metalDark, frame(5.5, 0.85, 0));
	put(wheel(0.4, 0.3), M.tire, frame(5.5, 0.4, 0));
	for (const s of [-1, 1]) {
		put(box(3.6, 1.2, 1.1, 1.5), skin, frame(-1, Y - 1.0, s * 1.9));
		put(box(0.16, 1.4, 0.16), M.metalDark, frame(-1, 0.8, s * 1.9));
		for (const dx of [-0.7, 0.7]) put(wheel(0.5, 0.36, 14), M.tire, frame(-1 + dx, 0.5, s * 1.9));
	}
}

/**
 * Вертолёт (вроде Ми-8): кабина с остеклением, сдвижные двери, двигатели, несущий винт, хвостовая балка с килем.
 * Нос — в +X своих осей. paint — окраска; rotor: true — лопасти на месте, 'bent' — повисли, false — сняты;
 * roll — крен (разбитый лежит на боку); tail — хвостовая балка (у разбитого оторвана: tailBoom отдельно).
 */
function helicopter(kb, M, x, z, ry, { paint = M.khaki, rotor = true, roll = 0, tail = true } = {}) {
	const F = frame(x, 0, z, ry, roll);
	const put = (g, mat, m) => { g.applyMatrix4(m).applyMatrix4(F); kb.add(g, mat); };
	put(cylX(1.15, 1.15, 5.4, 10).scale(1, 0.92, 1), paint, frame(0.3, 1.6, 0));
	put(new THREE.SphereGeometry(1.15, 12, 8).scale(1.6, 0.86, 1), paint, frame(3.0, 1.55, 0));
	put(new THREE.SphereGeometry(1.18, 12, 6, Math.PI - 0.95, 1.9, 0.25, 1.15).scale(1.6, 0.86, 1), M.glass, frame(3.0, 1.55, 0));
	put(new THREE.SphereGeometry(1.15, 10, 6).scale(1.25, 0.9, 1), paint, frame(-2.4, 1.65, 0));
	if (tail) tailBoom(kb, M, x, z, ry, paint, F);
	put(box(2.8, 0.75, 1.5), paint, frame(0.2, 2.85, 0)); // двигатели
	for (const s of [-1, 1]) put(cylX(0.22, 0.22, 0.7, 8), M.metalDark, frame(-1.4, 2.9, s * 0.58)); // выхлоп
	put(new THREE.CylinderGeometry(0.13, 0.15, 0.6, 8), M.metalDark, frame(0.5, 3.5, 0));
	put(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 10), M.metalDark, frame(0.5, 3.85, 0)); // втулка
	if (rotor) for (let k = 0; k < 5; k++) put(box(6.2, 0.05, 0.42).translate(3.3, 0, 0), M.metalDark, frame(0.5, 3.9, 0, 0.3 + k * Math.PI * 0.4, 0, rotor === 'bent' ? -0.2 - (k % 2) * 0.12 : -0.03));
	for (const s of [-1, 1]) {
		put(box(1.6, 1.25, 0.05), M.metalDark, frame(0.3, 1.5, s * 1.13)); // сдвижная дверь
		for (const wx of [-1.3, 1.7]) put(box(0.5, 0.42, 0.05), M.glass, frame(wx, 1.95, s * 1.1));
	}
	// шасси: носовая стойка и две основные
	put(box(0.12, 1.0, 0.12), M.metalDark, frame(2.6, 0.55, 0));
	put(wheel(0.28, 0.24, 10), M.tire, frame(2.6, 0.28, 0));
	for (const s of [-1, 1]) {
		put(box(0.12, 1.2, 0.12), M.metalDark, frame(-0.6, 0.55, s * 1.45, 0, s * 0.5, 0));
		put(wheel(0.4, 0.3), M.tire, frame(-0.6, 0.4, s * 1.8));
	}
}

/** Хвостовая балка вертолёта с килем, стабилизатором и рулевым винтом (в осях вертолёта: F — его матрица). */
function tailBoom(kb, M, x, z, ry, paint, F = frame(x, 0, z, ry)) {
	const put = (g, mat, m) => { g.applyMatrix4(m).applyMatrix4(F); kb.add(g, mat); };
	put(cylX(0.28, 0.55, 6.6, 8), paint, frame(-5.7, 2.0, 0));
	put(box(1.4, 2.0, 0.16), paint, frame(-8.8, 2.9, 0, 0, 0, 0.35)); // киль
	put(box(0.8, 0.06, 2.4), paint, frame(-7.8, 2.0, 0)); // стабилизатор
	for (const a of [0.6, 0.6 + Z]) put(box(0.12, 2.0, 0.04), M.metalDark, frame(-9.1, 3.2, 0.22, 0, 0, a)); // рулевой винт
}

/**
 * Капонир: П-образное бетонное укрытие для техники (внутри 13×11 м), открытое на север, к рулёжке; снаружи стен —
 * земляная обваловка. Стены загораживают героя от камеры — полупрозрачные (occluder).
 */
function caponier(occluder, collide, M, cx, cz) {
	const hw = 6.6, back = 5.4, H = 3.4, TW = 1.2;
	occluder('Caponier', (kb) => {
		kb.add(place(box(2 * hw + TW, H, TW, 1.5), cx, H / 2, cz + back), M.concreteDark);
		for (const s of [-1, 1]) kb.add(place(box(TW, H, 2 * back + TW, 1.5), cx + s * hw, H / 2, cz), M.concreteDark);
		kb.add(place(box(2 * hw + TW + 3.4, 1.4, 3.4, 3), cx, 0.45, cz + back + 1.9, 0, -0.42), M.dirt, { cast: false });
		for (const s of [-1, 1]) kb.add(place(box(3.4, 1.4, 2 * back + TW, 3), cx + s * (hw + 1.9), 0.45, cz, 0, 0, s * 0.42), M.dirt, { cast: false });
	}, { cx, cz, ry: 0, hx: hw + 2.6, hz: back + 2.6, top: H }, 0.3);
	collide(cx, cz + back + 0.7, 2 * hw + TW + 2, TW + 3.6);
	for (const s of [-1, 1]) collide(cx + s * (hw + 0.7), cz, TW + 3.6, 2 * back + TW);
}

// ---------- Постройки, в которые можно зайти ----------

/** Металлический шкаф (тайник); лицо — в +Z своих осей. */
function locker(b, name, x, z, rot, loot, w = 1.0) {
	const IM = b.IM;
	b.container(name, x, z, rot, [
		[w, 2.0, 0.5, 0, 1.0, 0, IM.locker], [0.02, 1.85, 0.02, 0, 1.0, 0.26, IM.black],
		[0.25, 0.04, 0.02, w * 0.25, 1.75, 0.26, IM.black], [0.25, 0.04, 0.02, -w * 0.25, 1.75, 0.26, IM.black],
	], [w, 0.5], loot, 2.0);
}

/** Длинный оружейный ящик с замками (тайник). */
function gunCrate(b, name, x, z, rot, loot) {
	const IM = b.IM;
	b.container(name, x, z, rot, [
		[1.8, 0.5, 0.65, 0, 0.25, 0, IM.crateGreen], [1.82, 0.05, 0.67, 0, 0.52, 0, IM.machine],
		[0.1, 0.12, 0.03, -0.55, 0.4, 0.34, IM.black], [0.1, 0.12, 0.03, 0.55, 0.4, 0.34, IM.black],
		[1.6, 0.42, 0.6, 0.04, 0.76, 0, IM.crateGreen],
	], [1.8, 0.65], loot, 1.0);
}

/** Пирамида с оружием (тайник), как в оружейке части. */
function pyramid(b, x, z, rot, loot) {
	const IM = b.IM;
	b.container('Пирамида', x, z, rot, [
		[1.8, 0.1, 0.5, 0, 0.1, 0, IM.machine], [1.8, 0.08, 0.3, 0, 1.15, -0.05, IM.machine],
		[0.06, 1.3, 0.06, -0.86, 0.65, -0.18, IM.machine], [0.06, 1.3, 0.06, 0.86, 0.65, -0.18, IM.machine],
		...[-0.6, -0.2, 0.2, 0.6].map((dx) => [0.06, 1.0, 0.12, dx, 0.7, 0.02, IM.black]),
	], [1.8, 0.5], loot, 1.3);
}

/** Стеллаж с ящиками (тайник). */
function rack(b, x, z, rot, loot) {
	const IM = b.IM;
	b.container('Стеллаж', x, z, rot, [
		...[-1.9, 1.9].flatMap((dx) => [-0.4, 0.4].map((dz) => [0.08, 2.4, 0.08, dx, 1.2, dz, IM.rack])),
		...[0.15, 0.95, 1.75, 2.35].map((y) => [3.9, 0.05, 0.9, 0, y, 0, IM.rack]),
		[0.9, 0.55, 0.7, -1.2, 0.45, 0, IM.crateGreen], [0.8, 0.5, 0.7, 0.5, 0.43, 0.05, IM.black], [0.7, 0.45, 0.6, 1.4, 0.4, 0, IM.crateGreen],
		[1.0, 0.6, 0.7, -0.5, 1.28, 0, IM.crateGreen], [0.9, 0.5, 0.7, 1.1, 1.23, 0, IM.machine], [0.8, 0.45, 0.6, -1.2, 2.0, 0, IM.black], [1.0, 0.4, 0.7, 0.6, 1.98, 0, IM.crateGreen],
	], [4.0, 1.0], loot, 2.4);
}

/** Сейф (тайник). */
function safe(b, x, z, rot, loot) {
	const IM = b.IM;
	b.container('Сейф', x, z, rot, [[0.7, 1.2, 0.6, 0, 0.6, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.75, 0.31, IM.black], [0.03, 0.2, 0.03, -0.2, 0.75, 0.31, IM.black]], [0.7, 0.6], loot, 1.2);
}

/**
 * Арочный ангар 22×16 м: низкие стены из профлиста, арка над ними, ворота в северном фронтоне раздвинуты в стороны.
 * Внутри — вертолёт со снятыми лопастями (лежат на козлах), двигатель на стенде, верстаки и шкафы с инструментом
 * у левой стены, стеллаж у задней, ящики и шкафчик справа.
 */
function buildHangar(ctx, { name, cx, cz, ry }) {
	const W = 22, D = 16, H = 4.6, rise = 5.2, hx = W / 2, hz = D / 2, t = 0.2, DW = 10;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + rise });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.roofGreen, t, lining: M.metalDark, sx: 1.2 };
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('x', -hz, -hx - t / 2, -DW / 2, { ...wo, side: 1 });
	b.wall('x', -hz, DW / 2, hx + t / 2, { ...wo, side: 1 });
	// арка над стенами (ось вдоль Z), фронтоны-полуэллипсы, рёбра каркаса, рельс ворот
	const R = hx + 0.2, k = rise / R;
	b.top_(new THREE.CylinderGeometry(R, R, D + 0.4, 22, 1, true, -Z, Math.PI).rotateX(-Z).scale(1, k, 1).translate(0, H, 0), M.roofGreen);
	const gable = new THREE.Shape().absellipse(0, 0, R, rise, 0, Math.PI, false);
	for (const s of [-1, 1]) {
		const g = new THREE.ShapeGeometry(gable, 12);
		if (s < 0) g.rotateY(Math.PI);
		b.top_(g.translate(0, H, s * (hz + t / 2)), M.roofGreen);
	}
	for (const z of [-hz + 0.3, -hz / 2, 0, hz / 2, hz - 0.3]) b.top_(new THREE.TorusGeometry(R + 0.04, 0.06, 4, 20, Math.PI).scale(1, k, 1).translate(0, H, z), M.metalDark);
	for (const s of [-1, 1]) b.wallBox('front', s * (DW / 2 + 2.55), 5.0, 0.02, H - 0.25, 0.12, M.metalOlive, { t, off: 0.14 });
	b.top_(place(box(W + 0.6, 0.22, 0.3), 0, H - 0.05, -hz - t / 2 - 0.35), M.metalDark);
	b.top_(b.onWall(new THREE.PlaneGeometry(3.6, 0.6).translate(0, H + 1.2, 0.02), 'front', 0, t), T.signMaterial('АНГАР № 1', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 64 }));
	// вертолёт на ремонте — лопасти сняты и лежат на козлах у ворот, двигатель на стенде
	const hr = Z + 0.12, hxp = -2.5, hzp = 1.0, at = (lx) => [hxp + lx * Math.cos(hr), hzp - lx * Math.sin(hr)];
	helicopter({ add: (g, m) => b.lower(g, m) }, M, hxp, hzp, hr, { rotor: false });
	for (const [lx, w, d] of [[0.65, 8.5, 2.8], [-6.0, 6.8, 1.0]]) { const [px, pz] = at(lx); b.collide(px, pz, w, d, hr); b.solids.push([px, pz, w, d, hr]); }
	b.furniture(5.6, -4.6, 0.15, [
		[6.2, 0.05, 0.42, 0, 0.55, 0, IM.metal], [6.2, 0.05, 0.42, 0, 0.61, 0.32, IM.metal], [6.2, 0.05, 0.42, 0, 0.67, -0.25, IM.metal],
		[0.1, 0.5, 1.0, -2.4, 0.25, 0, IM.metal], [0.1, 0.5, 1.0, 2.4, 0.25, 0, IM.metal],
	], { solid: [6.3, 1.1] });
	b.furniture(7.2, 0.8, 0.2, [[1.8, 0.8, 0.8, 0, 1.0, 0, IM.machine], [0.6, 0.6, 0.6, 1.1, 1.0, 0, IM.metal], ...[[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].map(([px, pz]) => [0.08, 0.6, 0.08, px, 0.3, pz, IM.metal])], { solid: [2.6, 0.9] });
	// верстаки, шкафы с инструментом у левой стены; стеллаж у задней; ящики и шкафчик справа
	for (const [z, loot] of [[-4.2, { ammo545: [10, 20, 0.45], zhivchik: 0.2, spore: [1, 2, 0.3] }], [-1.2, { ammo762: [8, 16, 0.4], ammo919: [6, 12, 0.35], zhivchik: 0.2 }]]) {
		b.container('Верстак', -hx + 0.55, z, Z, [
			[2.0, 0.08, 0.8, 0, 0.9, 0, IM.furniture], [1.9, 0.5, 0.7, 0, 0.3, 0, IM.machine], [0.3, 0.25, 0.3, -0.6, 1.06, -0.15, IM.metal],
			[0.5, 0.2, 0.3, 0.5, 1.04, 0.1, IM.redBoard], [0.02, 0.8, 1.6, -0.02, 1.7, -0.4, IM.rack],
		], [2.0, 0.8], loot, 1.0);
	}
	locker(b, 'Шкаф с инструментом', -hx + 0.5, 2.4, Z, { ammo762: [10, 20, 0.4], grenade: 0.06, ammo12: [4, 8, 0.3] });
	locker(b, 'Шкаф с инструментом', -hx + 0.5, 4.6, Z, { ammo556: [10, 20, 0.35], aks: 0.08, zhivchik: 0.25 });
	rack(b, -5, hz - 0.65, Math.PI, { ammo762: [10, 20, 0.45], ammo545: [10, 20, 0.4], grenade: 0.08 });
	b.container('Ящики', hx - 0.75, 5.6, -Z, [[1.2, 0.8, 1.2, 0, 0.4, 0, IM.crateGreen], [1.0, 0.6, 1.0, 0, 1.1, 0, IM.crateGreen]], [1.2, 1.2], { ammo545: [15, 30, 0.5], ammo556: [10, 20, 0.3], grenade: 0.1 }, 1.4);
	b.container('Ящики', hx - 0.75, -2.6, -Z, [[1.2, 0.7, 1.1, 0, 0.35, 0, IM.crate], [1.0, 0.6, 0.9, 0.05, 1.0, 0, IM.crateGreen]], [1.2, 1.1], { ammo76254: [10, 20, 0.4], svd: 0.06, zhivchik: 0.2 }, 1.3);
	locker(b, 'Шкафчик', 3.5, hz - 0.37, Math.PI, { ammo919: [8, 16, 0.4], spore: 0.15, zhivchik: 0.2 }, 0.6);
	// бочки с маслом у задней стены, пожарный щит
	for (const [x, z] of [[2, hz - 0.5], [2.7, hz - 0.5], [1.4, hz - 1.1]]) b.furniture(x, z, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, M.metalRust, { geo: place(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), 0, 0.45, 0) }]], { solid: [0.6, 0.6], prop: 'barrel' });
	b.furniture(-3, hz - 0.1, Math.PI, [[1.4, 0.9, 0.04, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0] });
	return b.finish();
}

/**
 * Командно-диспетчерский пункт 10×8 м: внизу — дежурная смена (пульты диспетчеров, радиостанция, сейф, шкаф,
 * лестница наверх); второй этаж глухой с лентой окон, над ним — восьмигранная остеклённая кабина с антеннами.
 */
function buildTower(ctx, { name, cx, cz, ry }) {
	const W = 10, D = 8, H = 3.3, hx = W / 2, hz = D / 2, t = 0.25;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: 13.8 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.armyWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-3], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [-0.5, 2.5]) b.window('front', x, { t, sill: M.whiteBrick });
	for (const x of [-2.5, 0.5, 3.5]) b.window('back', x, { t, sill: M.whiteBrick });
	b.window('left', 0, { t, sill: M.whiteBrick });
	b.canopy('front', -3, { w: 1.9, d: 1.1, y: 2.5, mat: M.roofTar, t });
	b.wallBox('front', -3 + 1.15, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t }); // дверь распахнута
	// второй этаж и кабина
	const H2 = H + 0.3, F2 = 3.2, Y3 = H2 + F2;
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.concrete);
	b.top_(place(box(W, F2, D, 2, 1.6), 0, H2 + F2 / 2, 0), M.whiteBrick);
	for (let i = 0; i < 3; i++) for (const side of ['front', 'back', 'left', 'right']) {
		if ((side === 'left' || side === 'right') && i !== 1) continue;
		b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.1, 1.4), [0, 3, 1, 0][(i + side.length) % 4]).translate(0, H2 + 1.6, 0.012), side, side === 'left' || side === 'right' ? 0 : -3 + i * 3, t), M.window);
	}
	b.top_(place(new THREE.CylinderGeometry(5.7, 5.7, 0.45, 8), 0, Y3 + 0.22, 0), M.concrete); // площадка кабины
	b.top_(place(new THREE.CylinderGeometry(5.25, 4.7, 2.9, 8, 1, true), 0, Y3 + 1.9, 0), M.glass); // остекление с наклоном наружу
	for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.top_(place(box(0.14, 2.95, 0.14), Math.sin(a) * 4.95, Y3 + 1.9, Math.cos(a) * 4.95, -a), M.metalDark); }
	b.top_(place(new THREE.CylinderGeometry(5.6, 5.6, 0.3, 8), 0, Y3 + 3.5, 0), M.concreteDark); // крыша кабины
	b.top_(place(box(0.1, 3.5, 0.1), 2.5, Y3 + 5.4, 1.5), M.metalDark); // антенны
	b.top_(place(box(0.08, 2.6, 0.08), -2.8, Y3 + 4.9, -1.5), M.metalDark);
	b.top_(place(box(1.6, 0.05, 0.05), -2.8, Y3 + 5.8, -1.5), M.metalDark);
	b.top_(place(box(0.22, 0.22, 0.22), 2.5, Y3 + 7.2, 1.5), M.red);
	// внутри: пульты у задней стены (окна на стоянку), радиостанция, сейф и лестница у правой стены, шкаф слева
	const console = (x, loot) => b.container('Пульт диспетчера', x, hz - 0.65, Math.PI, [
		[1.9, 0.08, 0.85, 0, 0.78, 0, IM.furniture], [0.08, 0.75, 0.75, -0.9, 0.38, 0, IM.furniture], [0.08, 0.75, 0.75, 0.9, 0.38, 0, IM.furniture],
		[1.8, 0.42, 0.36, 0, 1.0, -0.22, IM.machine], [0.6, 0.3, 0.03, -0.45, 1.05, -0.03, IM.screen], [0.5, 0.26, 0.03, 0.4, 1.03, -0.03, IM.screen],
		[0.5, 0.06, 0.25, 0.2, 0.85, 0.2, IM.black],
	], [1.9, 0.85], loot, 1.15);
	console(-2.2, { ammo919: [6, 12, 0.5], zhivchik: 0.25, spore: [1, 2, 0.3] });
	console(0.6, { ammo545: [6, 12, 0.4], zhivchik: 0.3 });
	chair(b, -2.2, hz - 1.9, Math.PI);
	chair(b, 0.6, hz - 1.9, Math.PI);
	b.container('Радиостанция', -1.2, -hz + 0.6, 0, [[1.1, 0.75, 0.6, 0, 0.375, 0, IM.furniture], [0.6, 0.35, 0.4, -0.1, 0.93, 0, IM.machine], [0.03, 0.9, 0.03, 0.4, 1.4, -0.1, IM.black], [0.2, 0.05, 0.1, 0.3, 0.8, 0.15, IM.black]], [1.1, 0.6], { ammo919: [4, 8, 0.35], zhivchik: 0.3, spore: [1, 2, 0.25] }, 1.1);
	locker(b, 'Шкаф', -hx + 0.45, 1.2, Z, { ammo545: [8, 16, 0.45], grenade: 0.06, zhivchik: 0.2 });
	safe(b, hx - 0.5, 3.0, -Z, { ammo127: [5, 10, 0.25], spore: [2, 5, 0.5], grenade: 0.12, ammo76251: [5, 10, 0.3] });
	const steps = [];
	for (let i = 0; i < 8; i++) steps.push([1.0, 0.16, 0.5, 0, 0.08 + i * 0.36, -1.75 + i * 0.5, IM.metal]);
	steps.push([0.05, 2.6, 0.05, -0.5, 1.6, -1.9, IM.metal], [0.05, 2.6, 0.05, -0.5, 2.1, 1.0, IM.metal], [0.05, 0.05, 4.0, -0.5, 3.0, -0.5, IM.metal]);
	b.furniture(hx - 0.75, -1.0, 0, steps, { solid: [1.1, 4.2] });
	b.furniture(1.0, 0.2, 0.3, [[1.3, 0.05, 0.9, 0, 0.75, 0, IM.furniture], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.06, 0.72, 0.06, sx * 0.57, 0.36, sz * 0.37, IM.furniture]), [1.1, 0.01, 0.7, 0, 0.78, 0, IM.paper]], { solid: [1.3, 0.9], prop: 'table' });
	return b.finish();
}

/**
 * Склад вооружения 18×11 м: бетонные стены, плоская крыша, двустворчатые стальные двери. Внутри — ящики с
 * гранатомётами и выстрелами вдоль задней стены, пирамиды слева, стеллажи посередине, сейф и ящик гранат справа,
 * поддоны с укупоркой у входа. Логово элиты — во дворе перед складом.
 */
function buildDepot(ctx, { name, cx, cz, ry }) {
	const W = 18, D = 11, H = 4.2, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.6 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-5], w: 2.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.top_(place(box(W + 0.6, 0.35, D + 0.6, 3), 0, H + 0.17, 0), M.roofTar);
	b.parapet(H + 0.35, M.concreteDark, 0.35);
	for (const [x, z] of [[-6, 2], [0, -2.5], [6, 2.5]]) b.vent(x, z, H + 0.35, M.silver, { h: 0.6, r: 0.16 });
	b.canopy('front', -5, { w: 3.4, d: 1.3, y: 3.0, mat: M.concrete, t, thick: 0.2 });
	for (const s of [-1, 1]) b.wallBox('front', -5 + s * 1.95, 1.3, 0.02, 2.05, 0.06, M.metalOlive, { t, off: 0.1 }); // створки распахнуты
	for (const x of [1, 5]) { // узкие окна под потолком с решёткой
		b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.2, 0.6), 1).translate(0, H - 0.75, 0.012), 'front', x, t), M.window);
		for (let k = -0.4; k <= 0.41; k += 0.2) b.top_(b.onWall(box(0.04, 0.7, 0.04).translate(k, H - 0.75, 0.05), 'front', x, t), M.metalDark);
	}
	b.top_(b.onWall(new THREE.PlaneGeometry(3.2, 0.5).translate(0, H - 0.3, 0.02), 'front', -5, t), T.signMaterial('СКЛАД № 3 · ВХОД ПО ПРОПУСКАМ', { bg: '#3c403c', fg: '#ece6d2', w: 512, h: 80 }));
	// ящики с гранатомётами и выстрелами — вдоль задней стены
	gunCrate(b, 'Ящик РПГ-7', -6, hz - 0.7, Math.PI, { rpg7: 0.12, rocket: [1, 3, 0.5], ammo762: [10, 20, 0.4] });
	gunCrate(b, 'Ящик РГ-6', -2, hz - 0.7, Math.PI, { rg6: 0.1, vog25: [3, 6, 0.45], grenade: [1, 2, 0.3] });
	gunCrate(b, 'Ящик КСВК', 2, hz - 0.7, Math.PI, { ksvk: 0.08, ammo127: [5, 10, 0.35], ammo76254: [10, 20, 0.4] });
	gunCrate(b, 'Ящик выстрелов', 6, hz - 0.7, Math.PI, { rocket: [1, 3, 0.45], rpg7: 0.06, ammo545: [20, 40, 0.5] });
	// пирамиды у левой стены, стеллажи посередине, сейф и гранаты справа
	pyramid(b, -hx + 0.55, -2.2, Z, { ak107: 0.15, ak74: 0.25, ammo545: [20, 40, 0.6] });
	pyramid(b, -hx + 0.55, 0.6, Z, { svd: 0.15, rpk: 0.1, ammo76254: [10, 30, 0.5], ammo762: [20, 40, 0.4] });
	rack(b, 1, -1.6, 0, { vog25: [3, 6, 0.4], ammo556: [15, 30, 0.4], grenade: [1, 2, 0.25] });
	rack(b, 1, 1.6, Math.PI, { ammo127: [5, 10, 0.3], ammo76251: [10, 20, 0.45], zhivchik: [1, 2, 0.3] });
	safe(b, hx - 0.5, -2.6, -Z, { awm: 0.05, ksvk: 0.05, ammo127: [5, 10, 0.35], spore: [4, 8, 0.6] });
	b.container('Ящик с гранатами', hx - 0.6, 1.6, -Z, [[1.0, 0.45, 0.6, 0, 0.23, 0, IM.crateGreen], [1.02, 0.05, 0.62, 0, 0.47, 0, IM.machine]], [1.0, 0.6], { grenade: [1, 3, 0.45], vog25: [3, 6, 0.3] }, 0.5);
	// поддоны с укупоркой у входа, стол выдачи
	for (const [x, z] of [[-7.4, -3.6], [7.2, -3.8]]) b.furniture(x, z, 0.1, [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], [1.0, 0.5, 0.45, 0, 0.39, -0.24, IM.crateGreen], [1.0, 0.5, 0.45, 0, 0.39, 0.24, IM.crateGreen], [1.0, 0.45, 0.45, 0, 0.87, 0, IM.crateGreen]], { solid: [1.25, 1.05], prop: 'ammo' });
	b.furniture(-2.2, -3.8, 0, [[1.4, 0.05, 0.6, 0, 0.75, 0, IM.furniture], [1.3, 0.72, 0.5, 0, 0.36, 0, IM.machine]], { solid: [1.4, 0.6] });
	return b.finish();
}

// ---------- Окраина аэродрома (кольцо между прежним краем 66 м и новым 86 м) ----------

/**
 * Истребитель (силуэт вроде МиГ-29, в 0,85 натуральной величины): фюзеляж с острым носом, фонарь, стреловидные
 * крылья, два киля, сопла, шасси. Нос — в +X своих осей, ry — куда смотрит нос; sc — масштаб, y и pitch — подъём и
 * наклон носа (памятник на пилоне). kb — куда класть геометрию.
 */
function fighter(kb, M, x, z, ry, { paint = M.khaki, sc = 1, y = 0, pitch = 0 } = {}) {
	const F = frame(x, y, z, ry, 0, pitch).multiply(new THREE.Matrix4().makeScale(sc, sc, sc));
	const put = (g, mat, m) => { g.applyMatrix4(m).applyMatrix4(F); kb.add(g, mat); };
	const Y = 1.9;
	put(cylX(0.8, 0.75, 8.6, 12), paint, frame(0.3, Y, 0)); // фюзеляж
	put(cylX(0.75, 0.06, 3.4, 12), paint, frame(6.3, Y, 0)); // нос
	put(new THREE.SphereGeometry(0.5, 10, 6).scale(2.6, 0.9, 1), M.glass, frame(3.4, Y + 0.65, 0)); // фонарь
	put(box(5.6, 0.9, 3.0, 1.5), paint, frame(-2.6, Y - 0.15, 0)); // мотогондолы
	for (const s of [-1, 1]) {
		put(cylX(0.5, 0.55, 1.2, 10), M.metalDark, frame(-5.9, Y - 0.15, s * 0.75)); // сопла
		put(box(4.2, 0.12, 4.6).translate(0, 0, s * 2.3), paint, frame(-1.0, Y + 0.15, s * 1.2, -s * 0.42)); // крыло
		put(box(2.4, 0.08, 2.2).translate(0, 0, s * 1.1), paint, frame(-5.6, Y, s * 0.9, -s * 0.35)); // стабилизатор
		put(box(2.4, 2.4, 0.1), paint, frame(-5.0, Y + 1.5, s * 1.0, 0, s * 0.15, 0.45)); // киль
		put(box(0.55, 0.55, 0.03), M.red, frame(-5.1, Y + 1.6, s * 1.08, 0, s * 0.15, 0)); // звезда
	}
	put(box(0.12, 1.3, 0.12), M.metalDark, frame(5.2, 0.65, 0)); // шасси
	put(wheel(0.3, 0.2), M.tire, frame(5.2, 0.3, 0));
	for (const s of [-1, 1]) {
		put(box(0.14, 1.4, 0.14), M.metalDark, frame(-1.6, 0.7, s * 1.5));
		put(wheel(0.42, 0.25), M.tire, frame(-1.6, 0.42, s * 1.5));
	}
}

/**
 * Обвалованный ангар-укрытие 20×16 м: бетонные стены, свод под земляной обсыпкой, по бокам и сзади — земляные валы;
 * ворота в переднем торце (−Z своих осей) раздвинуты. Внутри — истребитель на ремонте, верстаки и шкаф у стен,
 * стеллаж у задней стены.
 */
function buildShelter(ctx, { name, cx, cz, ry }) {
	const W = 20, D = 16, H = 3.6, rise = 4.0, hx = W / 2, hz = D / 2, t = 0.4, DW = 12;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + rise + 0.9 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('x', -hz, -hx - t / 2, -DW / 2, { ...wo, side: 1 });
	b.wall('x', -hz, DW / 2, hx + t / 2, { ...wo, side: 1 });
	// свод, земляная обсыпка поверх, торцы свода; ворота раздвинуты по сторонам
	const R = hx + 0.25, k = rise / R;
	b.top_(new THREE.CylinderGeometry(R, R, D + 0.6, 20, 1, true, -Z, Math.PI).rotateX(-Z).scale(1, k, 1).translate(0, H, 0), M.concreteDark);
	b.top_(new THREE.CylinderGeometry(R + 0.9, R + 0.9, D - 1.0, 16, 1, true, -Z, Math.PI).rotateX(-Z).scale(1, (rise + 0.9) / (R + 0.9), 1).translate(0, H - 0.2, 0.6), M.dirt);
	const gable = new THREE.Shape().absellipse(0, 0, R, rise, 0, Math.PI, false);
	for (const s of [-1, 1]) { const g = new THREE.ShapeGeometry(gable, 12); if (s < 0) g.rotateY(Math.PI); b.top_(g.translate(0, H, s * (hz + t / 2)), M.concreteDark); }
	for (const s of [-1, 1]) b.wallBox('front', s * (DW / 2 + 2.0), 4.0, 0.02, H - 0.2, 0.14, M.metalOlive, { t, off: 0.16 });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.4, 0.6).translate(0, H + 1.0, 0.03), 'front', 0, t), T.signMaterial('УКРЫТИЕ № 4', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 64 }));
	// земляные валы снаружи стен — по ним не пройти
	for (const s of [-1, 1]) {
		b.lower(place(box(3.4, 1.8, D + 1.0, 3), s * (hx + 1.6), 0.5, 0.5, 0, 0, s * 0.42), M.dirt, { cast: false });
		b.collide(s * (hx + 1.5), 0.5, 2.8, D + 1.0);
	}
	b.lower(place(box(W + 6.0, 1.8, 3.2, 3), 0, 0.5, hz + 1.5, 0, -0.42, 0), M.dirt, { cast: false });
	b.collide(0, hz + 1.4, W + 5.8, 2.6);
	// истребитель на ремонте — носом к воротам
	fighter({ add: (g, m) => b.lower(g, m) }, M, 0, 0.4, Z, { sc: 0.85 });
	for (const [px, pz, w, d] of [[0, 0.2, 2.6, 13.2], [0, 1.8, 9.2, 4.4]]) { b.collide(px, pz, w, d); b.solids.push([px, pz, w, d, 0]); }
	for (const [z, loot] of [[-4.2, { ammo545: [10, 20, 0.45], zhivchik: 0.2, spore: [1, 2, 0.3] }], [-1.0, { ammo762: [8, 16, 0.4], ammo556: [8, 16, 0.3], grenade: 0.06 }]]) {
		b.container('Верстак', -hx + 0.6, z, Z, [
			[2.0, 0.08, 0.8, 0, 0.9, 0, IM.furniture], [1.9, 0.5, 0.7, 0, 0.3, 0, IM.machine], [0.3, 0.25, 0.3, -0.6, 1.06, -0.15, IM.metal],
			[0.5, 0.2, 0.3, 0.5, 1.04, 0.1, IM.redBoard],
		], [2.0, 0.8], loot, 1.0);
	}
	locker(b, 'Шкаф с инструментом', hx - 0.45, -3.0, -Z, { ammo76251: [6, 12, 0.35], grenade: 0.06, zhivchik: 0.25 });
	rack(b, -5.6, hz - 0.7, Math.PI, { ammo545: [10, 20, 0.45], ammo76254: [6, 12, 0.35], rocket: [1, 2, 0.15] });
	// тележка с подвесными баками, двигатель на стенде
	b.furniture(6.4, 4.4, 0.2, [[1.2, 0.3, 2.4, 0, 0.35, 0, IM.machine], [0.6, 0.6, 2.2, 0, 0.8, 0, M.silver]], { solid: [1.3, 2.5] });
	b.furniture(-6.4, 3.0, 0, [[1.6, 0.8, 0.9, 0, 1.0, 0, IM.machine], ...[[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].map(([px, pz]) => [0.08, 0.6, 0.08, px, 0.3, pz, IM.metal])], { solid: [1.7, 1.0] });
	return b.finish();
}

/**
 * Пожарное депо аэродрома 18×12 м: два бокса (в одном — пожарная машина, в другом — верстак), дежурка со шкафом
 * боёвки и столом дежурного. Ворота — в переднем фасаде (−Z, к полосе), вывеска — над воротами и на задней стене.
 */
function buildFireDepot(ctx, { name, cx, cz }) {
	const W = 18, D = 12, H = 4.4, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.45 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, 2.2, { ...wo, doors: [-6.2, -0.6], w: 3.8, side: 1 });
	b.wall('x', -hz, 2.2, hx + t / 2, { ...wo, doors: [5.6], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 2.2, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [3.4] });
	b.window('front', 7.8, { t, sill: M.concrete });
	for (const x of [-6.2, -0.6, 5.6]) b.window('back', x, { t, sill: M.concrete, y: 2.6 });
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.whiteBrick, 0.3);
	const sign = T.signMaterial('ПОЖАРНАЯ ЧАСТЬ', { bg: '#a01a10', fg: '#f4ece0' });
	b.top_(b.onWall(new THREE.PlaneGeometry(5.0, 0.8).translate(0, H - 0.9, 0.03), 'front', -3.4, t), sign);
	b.top_(b.onWall(new THREE.PlaneGeometry(5.0, 0.8).translate(0, H - 0.6, 0.03), 'back', 2.0, t), sign);
	for (const x of [-6.2, -0.6]) b.wallBox('front', x, 3.9, 2.1, 2.6, 0.3, M.metalOlive, { t }); // поднятые ворота
	// бокс 1: пожарная машина носом к воротам
	b.furniture(-6.2, 0.8, 0, [
		[2.5, 0.9, 7.4, 0, 0.95, 0, M.red], [2.4, 1.2, 2.0, 0, 1.95, -2.6, M.red], [2.2, 0.6, 0.05, 0, 2.1, -3.62, M.glass],
		[2.5, 1.1, 5.0, 0, 1.95, 1.1, M.red], [2.2, 0.08, 4.6, 0, 2.55, 1.1, M.metalDark],
		[0.12, 0.1, 5.2, -0.5, 2.68, 0.9, M.silver], [0.12, 0.1, 5.2, 0.5, 2.68, 0.9, M.silver],
		[2.6, 0.14, 0.3, 0, 0.6, -3.75, M.white], [0.5, 0.15, 0.3, 0, 2.62, -2.6, M.woodBlue],
		...[-2.6, 0.8, 2.4].flatMap((z) => [-1.2, 1.2].map((x) => [0.3, 0.9, 0.9, x, 0.45, z, M.tire])),
	], { solid: [2.6, 7.6] });
	// бокс 2: верстак у задней стены, рукава на стойке
	b.container('Верстак', -0.6, hz - 0.55, Math.PI, [[2.0, 0.85, 0.8, 0, 0.42, 0, IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, IM.machine]], [2.0, 0.8], { ammo12: [4, 8, 0.4], fireaxe: 0.2, zhivchik: 0.2 }, 1.0);
	b.furniture(1.4, 1.0, 0, [[0.5, 1.6, 2.0, 0, 0.8, 0, IM.rack], ...[0.5, 1.0, 1.4].map((y) => [0.45, 0.3, 1.8, 0, y, 0, IM.redBoard])], { solid: [0.5, 2.0] });
	// дежурка: шкаф с боёвкой, стол дежурного, топчан
	locker(b, 'Шкаф с боёвкой', hx - 0.45, -2.6, -Z, { ammo545: [6, 12, 0.35], zhivchik: [1, 2, 0.35], fireaxe: 0.12 }, 1.2);
	b.container('Стол дежурного', 5.2, 1.6, 0, [[1.3, 0.75, 0.7, 0, 0.375, 0, IM.furniture], [0.4, 0.3, 0.3, 0.3, 0.9, 0, IM.black]], [1.3, 0.7], { ammo919: [6, 12, 0.5], zhivchik: 0.3, ammo12: [3, 6, 0.3] }, 0.95);
	b.furniture(hx - 0.55, 3.9, 0, [[0.8, 0.4, 1.9, 0, 0.3, 0, IM.furniture], [0.8, 0.1, 1.85, 0, 0.55, 0, IM.blanketArmy]], { solid: [0.8, 1.9] });
	return b.finish();
}

/** Пост РЛС 6×4 м (кунг): пульт оператора с экранами, шкаф с ЗИП; дверь — с юга (+Z). */
function buildRadarPost(ctx, { name, cx, cz }) {
	const W = 6, D = 4, H = 2.7, hx = W / 2, hz = D / 2, t = 0.2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.3 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.metalOlive, t, lining: IM.armyWall, sx: 1.2 };
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [1.6], side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.window('back', -1.2, { t });
	b.top_(place(box(W + 0.3, 0.14, D + 0.3, 2), 0, H + 0.07, 0), M.khaki);
	b.container('Пульт оператора', -0.8, -hz + 0.55, 0, [
		[2.4, 0.08, 0.7, 0, 0.78, 0, IM.machine], [2.4, 0.75, 0.6, 0, 0.38, -0.05, IM.machine],
		[2.3, 0.6, 0.3, 0, 1.12, -0.2, IM.machine], [0.6, 0.4, 0.03, -0.6, 1.15, -0.04, IM.screen], [0.6, 0.4, 0.03, 0.4, 1.15, -0.04, IM.screen],
	], [2.4, 0.7], { ammo919: [4, 8, 0.4], ammo545: [6, 12, 0.35], zhivchik: 0.25 }, 1.4);
	chair(b, -0.8, -0.4, Math.PI);
	locker(b, 'Шкаф с ЗИП', hx - 0.45, 0.4, -Z, { ammo76251: [4, 8, 0.3], grenade: 0.06, spore: [1, 2, 0.3] }, 0.9);
	return b.finish();
}

/** Радиолокатор на решётчатой вышке: четыре опоры с распорками, площадка с ограждением; антенна вращается (вернёт её). */
function radarTower(batch, root, M, collide, x, z, h = 12) {
	for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.16, h, 0.16), x + dx * 1.2, h / 2, z + dz * 1.2), M.metalDark);
	for (let y = 1.5; y < h; y += 2.1) for (const s of [-1, 1]) {
		batch.add(place(box(2.5, 0.07, 0.07), x, y, z + s * 1.2), M.metalDark);
		batch.add(place(box(0.07, 0.07, 2.5), x + s * 1.2, y, z), M.metalDark);
		batch.add(place(box(0.05, 2.6, 0.05), x, y + 1.05, z + s * 1.2, 0, 0, s * 0.85), M.metalDark);
	}
	batch.add(place(box(3.4, 0.15, 3.4, 2), x, h, z), M.metalDark);
	for (const s of [-1, 1]) {
		batch.add(place(box(3.4, 0.9, 0.05), x, h + 0.5, z + s * 1.7), M.metalRust);
		batch.add(place(box(0.05, 0.9, 3.4), x + s * 1.7, h + 0.5, z), M.metalRust);
	}
	batch.add(place(box(1.4, 1.0, 1.4, 1), x, h + 0.6, z), M.khaki); // поворотный механизм
	for (let y = 0.4; y < h; y += 0.45) batch.add(place(box(0.5, 0.04, 0.04), x - 1.32, y, z), M.metalDark); // лесенка
	collide(x, z, 2.8, 2.8);
	const head = new THREE.Group();
	const dish = new THREE.Mesh(box(6.0, 1.6, 0.18), M.white);
	dish.position.set(0, 0.9, 0.3); dish.rotation.x = -0.3;
	const mast = new THREE.Mesh(box(0.2, 0.9, 0.2), M.metalDark);
	const feed = new THREE.Mesh(box(0.25, 0.25, 1.4), M.metalDark);
	feed.position.set(0, 0.9, -0.5);
	head.add(dish, mast, feed);
	head.position.set(x, h + 1.1, z);
	root.add(head);
	return head;
}

/** Насосная склада ГСМ 8×6 м: насосы на рамах, трубы, шкаф и ящик с инструментом; дверь — с севера (−Z). */
function buildPumpHouse(ctx, { name, cx, cz }) {
	const W = 8, D = 6, H = 3.0, hx = W / 2, hz = D / 2, t = 0.25;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.35 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-1.8], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.window('front', 1.8, { t, sill: M.concrete });
	for (const x of [-1.6, 2.0]) b.window('back', x, { t, sill: M.concrete });
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.top_(b.onWall(new THREE.PlaneGeometry(2.4, 0.5).translate(0, H - 0.45, 0.03), 'back', 0, t), T.signMaterial('ОГНЕОПАСНО', { bg: '#e8d8a0', fg: '#a01a10' }));
	for (const z of [-0.6, 1.6]) b.furniture(1.6, z, 0, [[1.6, 0.6, 0.8, 0, 0.5, 0, IM.machine], [0.6, 0.6, 0.6, 1.0, 0.5, 0, IM.metal], [0.2, 0.2, 1.4, -0.4, 1.0, 0, M.metalRust]], { solid: [2.4, 0.9] });
	b.furniture(-0.2, 0.5, 0, [[0.25, 0.25, 4.6, 0, 1.6, 0, M.metalRust]], { solid: [0, 0] });
	locker(b, 'Шкаф с ЗИП', -hx + 0.45, 1.2, Z, { ammo12: [3, 6, 0.35], zhivchik: 0.25, spore: [1, 2, 0.3] }, 1.0);
	b.container('Ящик с инструментом', -2.0, hz - 0.5, Math.PI, [[1.2, 0.6, 0.6, 0, 0.3, 0, IM.redBoard], [1.22, 0.05, 0.62, 0, 0.62, 0, IM.metal]], [1.2, 0.6], { ammo545: [6, 12, 0.35], grenade: 0.05, ammo919: [4, 8, 0.3] }, 0.7);
	return b.finish();
}

/**
 * Хранилище боеприпасов 12×8 м под земляной обсыпкой: толстые бетонные стены, распахнутые стальные ворота в
 * переднем торце (−Z), земляные валы по бокам и сзади, на крыше — дёрн. fill(b, hx, hz) — ящики и стеллажи.
 */
function buildBunker(ctx, { name, cx, cz, fill }) {
	const W = 12, D = 8, H = 3.2, hx = W / 2, hz = D / 2, t = 0.45;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 1.0 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0], w: 2.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.top_(place(box(W + 1.2, 0.4, D + 1.2, 3), 0, H + 0.2, 0), M.concreteDark);
	b.top_(place(box(W + 0.4, 0.5, D + 0.2, 3), 0, H + 0.6, 0.3), M.dirt);
	b.vent(-3, 1.5, H + 0.85, M.metalDark, { h: 0.7, r: 0.18 });
	b.vent(3, 1.5, H + 0.85, M.metalDark, { h: 0.7, r: 0.18 });
	for (const s of [-1, 1]) b.wallBox('front', s * 2.0, 1.3, 0.02, 2.05, 0.06, M.metalOlive, { t, off: 0.1 });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.6, 0.5).translate(0, H - 0.5, 0.03), 'front', 0, t), T.signMaterial('ХРАНИЛИЩЕ БОЕПРИПАСОВ', { bg: '#3c403c', fg: '#ece6d2', w: 512, h: 72 }));
	for (const s of [-1, 1]) {
		b.lower(place(box(3.0, 1.6, D + 1.0, 3), s * (hx + 1.4), 0.45, 0.4, 0, 0, s * 0.42), M.dirt, { cast: false });
		b.collide(s * (hx + 1.3), 0.4, 2.4, D + 0.9);
	}
	b.lower(place(box(W + 5.2, 1.6, 2.8, 3), 0, 0.45, hz + 1.3, 0, -0.42, 0), M.dirt, { cast: false });
	b.collide(0, hz + 1.2, W + 5.0, 2.2);
	fill(b, hx, hz);
	return b.finish();
}

/** Штабель авиабомб на поддоне: rows рядов по per штук; ry — вдоль чего лежат бомбы (нос — в +X своих осей). */
function bombStack(batch, M, collide, x, z, ry, rows = 2, per = 3) {
	const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
	batch.add(place(box(2.8, 0.14, per * 0.72 + 0.3, 1), x, 0.07, z, ry), M.wood);
	for (let r = 0; r < rows; r++) for (let i = 0; i < per - r; i++) {
		const lz = (i - (per - 1 - r) / 2) * 0.72, y = 0.45 + r * 0.58;
		const put = (g, lx, mat) => { const [px, pz] = at(lx, lz); batch.add(place(g, px, y, pz, ry), mat); };
		put(cylX(0.3, 0.3, 1.5, 10), 0, M.khaki);
		put(cylX(0.3, 0.05, 0.5, 10), 1.0, M.khaki);
		put(cylX(0.12, 0.28, 0.4, 8), -0.95, M.khaki);
		put(box(0.45, 0.6, 0.04), -1.15, M.metalOlive);
		put(box(0.45, 0.04, 0.6), -1.15, M.metalOlive);
		put(cylX(0.31, 0.31, 0.08, 10), 0.4, M.yellow); // маркировочный поясок
	}
	collide(x, z, 2.9, per * 0.72 + 0.4, ry);
}

/** Разбитый Ан-2: фюзеляж лёг на брюхо, нижнее крыло подломлено, верхнее сорвано и лежит рядом; обгорел. Нос — +X. */
function biplaneWreck(batch, M, collide, x, z, ry) {
	const F = frame(x, 0, z, ry), c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
	const put = (g, mat, m) => { g.applyMatrix4(m).applyMatrix4(F); batch.add(g, mat); };
	put(box(9.5, 1.8, 1.7, 1.5), M.khaki, frame(0, 1.0, 0, 0, 0, 0.06));
	put(box(3.0, 1.82, 1.72, 1.5), M.tankBlack, frame(2.4, 1.15, 0, 0, 0, 0.06)); // кабина обгорела
	put(cylX(0.9, 0.85, 1.4, 10), M.metalDark, frame(5.3, 1.3, 0));
	for (let k = 0; k < 4; k++) put(box(0.08, 1.4, 0.22).translate(0, 0.7, 0), M.metalDark, frame(6.05, 1.3, 0, 0, k * Z + 0.3, k === 1 ? 0.5 : 0));
	put(box(2.4, 0.15, 7.0).translate(0, 0, 3.5), M.khaki, frame(1.2, 0.5, 0.8, 0.1, 0.22, 0)); // нижнее правое — подломлено
	put(box(2.4, 0.15, 7.0).translate(0, 0, -3.5), M.khaki, frame(1.2, 0.45, -0.8, -0.05, -0.12, 0));
	put(box(2.6, 0.15, 13.0), M.tankBlack, frame(-1.5, 0.2, 7.6, 0.35)); // верхнее крыло лежит рядом
	put(box(1.6, 2.2, 0.15), M.khaki, frame(-4.8, 2.3, 0, 0, 0, 0.3)); // киль
	put(box(1.2, 0.1, 4.2), M.khaki, frame(-4.6, 1.7, 0));
	collide(...at(0.5, 0), 10.5, 2.0, ry);
	collide(...at(1.2, 0), 2.6, 15.0, ry);
	collide(...at(-1.5, 7.6), 2.8, 13.2, ry + 0.35);
}

export default {
	id: 'aerodrom',
	seed: 4444,
	half: 90, // 180×180 м: ядро — прежние 132×132 м, вокруг — окраина до внешнего забора
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const add = (g, mat, ...mats) => { for (const m of mats) g.applyMatrix4(m); batch.add(g, mat); };
		const stripe = (w, d, x, z, mat = M.white) => batch.add(place(planeXZ(w, d, 1), x, 0.03, z), mat, { cast: false });
		const RWC = (RW0 + RW1) / 2;

		// ---------- Покрытия: полоса с разметкой, рулёжки, стоянка, дороги, тропы ----------
		ground(184, RW1 - RW0, 0, RWC, M.concrete, 4, 0.02); // ВПП — до мути с обеих сторон
		ground(2 * APX, AP1 - AP0, 0, (AP0 + AP1) / 2, M.concrete, 4, 0.021); // стоянка
		ground(18, 5, -10, -24, M.concrete, 4, 0.0215); // рулёжка со стоянки на полосу
		for (const s of [-1, 1]) ground(11, 9, s * 47, -22.5, M.concrete, 4, 0.0215); // рулёжки к капонирам
		ground(26, 8, -40, 3, M.concrete, 4, 0.0212); // площадки перед ангарами
		ground(26, 8, 6, 3, M.concrete, 4, 0.0212);
		ground(6, 92, -20, 46, M.asphalt, 5, 0.022); // от южного выхода через ворота к стоянке
		ground(52, 6, 66, 0, M.asphalt, 5, 0.022); // от стоянки через задние ворота к восточному выходу
		ground(6, 12, 36, 16, M.asphalt, 5, 0.0222); // к воротам склада вооружения
		ground(32, 5, 39, 24.5, M.asphalt, 5, 0.0224); // двор склада вооружения
		ground(20, 7, 9, 35.5, M.asphalt, 5, 0.0224); // автопарк
		ground(5, 40, -40, -71, M.dirt, 4, 0.014); // тропы к северным выходам
		ground(5, 40, 40, -71, M.dirt, 4, 0.014);
		ground(14, 18, -8, 31, M.dirt, 4, 0.0141); // топливный склад — вытоптано
		for (let x = -69; x <= 69; x += 12) stripe(6, 0.6, x, RWC); // осевая линия полосы
		for (const x of [-81, 75, 87]) stripe(6, 0.6, x, RWC);
		for (const z of [RW0 + 0.6, RW1 - 0.6]) stripe(184, 0.4, 0, z); // кромки
		for (const s of [-1, 1]) for (let i = 0; i < 6; i++) stripe(10, 1.4, s * 46, RWC + (i - 2.5) * 3.4); // «клавиши» порогов
		for (const x of [-30, -14, 2, 18, 34]) stripe(0.25, 16, x, -11, M.yellow); // места стоянок
		stripe(70, 0.25, 0, -3, M.yellow);
		stripe(0.25, 6, -10, -24, M.yellow);
		const onRoad = (x, z, m = 0) => (z > RW0 - m && z < RW1 + m) || (Math.abs(x) < APX + m && z > AP0 - m && z < AP1 + m)
			|| (Math.abs(x + 10) < 9 + m && z > -27 && z < -21) || (Math.abs(Math.abs(x) - 47) < 5.5 + m && z > -27 && z < -18)
			|| ((Math.abs(x + 40) < 13 + m || Math.abs(x - 6) < 13 + m) && z > -1 - m && z < 7 + m)
			|| (Math.abs(x + 20) < 3 + m && z > 0) || (Math.abs(z) < 3 + m && x > APX) || (Math.abs(x - 36) < 3 + m && z > 10 && z < 22)
			|| (Math.abs(x - 39) < 16 + m && z > 22 && z < 27) || (Math.abs(x - 9) < 10 + m && Math.abs(z - 35.5) < 3.5 + m)
			|| (Math.abs(Math.abs(x) - 40) < 2.5 + m && z < FZ0)
			// окраина: рулёжка-2 и съезды, стоянки, площадка депо, плац, стоянка спецтехники, дорога к ГСМ, двор хранилищ
			|| (Math.abs(x) < 70 + m && z > -64 - m && z < -56 + m) || (Math.abs(Math.abs(x) - 68) < 4 + m && z > -59 - m && z < -47)
			|| (Math.abs(x) < 32 + m && z > -80 && z < -64) || (Math.abs(x + 68) < 9 + m && z > -26 && z < -20 + m)
			|| (Math.abs(x + 40) < 8 + m && z > 51 - m && z < 73 + m) || (Math.abs(x - 6) < 12 + m && z > 55 - m && z < 69 + m)
			|| (x > -17 && x < 44.5 + m && Math.abs(z - 47.5) < 2.5 + m) || (x > FX1 && x < OUT && z > 7 && z < 44);

		// ---------- Периметр: бетонный забор, колючка одним набором линий, ворота, проломы, вышки ----------
		const wires = [];
		const fence = (x0, z0, x1, z1) => { concreteFence(batch, M, collide, root, x0, z0, x1, z1, { wire: false }); wires.push([x0, z0, x1, z1]); };
		fence(FX0, FZ0, FX0, RW0 - 1); fence(FX0, RW1 + 1, FX0, FZ1); // запад и восток — с разрывом под полосу
		fence(FX1, FZ0, FX1, RW0 - 1); fence(FX1, RW1 + 1, FX1, -3.5); fence(FX1, 3.5, FX1, FZ1);
		fence(FX0, FZ0, -44, FZ0); fence(-36, FZ0, 36, FZ0); fence(44, FZ0, FX1, FZ0); // север — с проломами у троп
		fence(FX0, FZ1, -23.5, FZ1); fence(-11, FZ1, FX1, FZ1); // юг — ворота и КПП
		fence(AX, AZ, AX, FZ1); fence(AX, AZ, 28, AZ); fence(38, AZ, FX1, AZ); // ограда склада вооружения
		// внешний периметр окраины: разрывы под полосу, ворота у дорог, проломы у троп на север
		fence(-OUT, -OUT, -OUT, RW0 - 1); fence(-OUT, RW1 + 1, -OUT, OUT);
		fence(OUT, -OUT, OUT, RW0 - 1); fence(OUT, RW1 + 1, OUT, -4); fence(OUT, 4, OUT, OUT);
		fence(-OUT, -OUT, -44, -OUT); fence(-36, -OUT, 36, -OUT); fence(44, -OUT, OUT, -OUT);
		fence(-OUT, OUT, -23.5, OUT); fence(-11, OUT, OUT, OUT);
		{
			const pts = [], y = 2.75;
			for (const [x0, z0, x1, z1] of wires) {
				const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2);
				for (const dy of [0, 0.2]) for (let k = 0; k < n; k++) {
					for (const q of [k, k + 1]) pts.push(new THREE.Vector3(x0 + (x1 - x0) * q / n, y + dy + Math.sin(q * 2.1) * 0.05, z0 + (z1 - z0) * q / n));
				}
			}
			root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a3a38 })));
		}
		// поваленные плиты в проломах северного забора — по ним ходят
		for (const s of [-1, 1]) {
			batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), s * 41.5, 0.12, FZ0 + 1.6, 0.25 * s), M.concrete);
			batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), s * 38, 0.26, FZ0 - 1.2, -0.3 * s, 0.1, 0), M.concrete);
		}
		// главные ворота на юге: столб, поднятый шлагбаум, мешки, бетонные блоки змейкой на дороге, щит
		batch.add(place(box(0.6, 3.2, 0.6), -23.5, 1.6, FZ1), M.concreteDark); collide(-23.5, FZ1, 0.7, 0.7);
		barrier(batch, M, collide, -23.2, FZ1 + 1.6, 0, 6, true);
		sandbags(batch, M, collide, -27.5, FZ1 + 3.2, 3.2, 0);
		const block = (x, z, r) => { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); };
		block(-21.5, 50, 0.2); block(-18, 54.5, -0.3);
		billboard(batch, M, root, collide, -29, 47.5, 0, 'СТОЙ! ВОЕННЫЙ АЭРОДРОМ — ПРОЕЗД ПО ПРОПУСКАМ', { w: 5.4, h: 1.1, y: 1.9, bg: '#e8dcc0', fg: '#a01a10' });
		// задние ворота на востоке: столбы, створка сорвана и лежит на дороге
		for (const z of [-3.5, 3.5]) { batch.add(place(box(0.6, 3.2, 0.6), FX1, 1.6, z), M.concreteDark); collide(FX1, z, 0.7, 0.7); }
		batch.add(place(box(3.6, 0.08, 2.2), 59, 0.05, 1.6, 0.4), M.metalOlive);
		for (const [x, z] of [[FX0 + 2.5, FZ0 + 2.5], [FX1 - 2.5, FZ0 + 2.5], [FX0 + 2.5, FZ1 - 2.5], [FX1 - 2.5, FZ1 - 2.5], [AX + 2.5, FZ1 - 2.5]]) watchTower(batch, M, collide, x, z);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) watchTower(batch, M, collide, sx * (OUT - 2.5), sz * (OUT - 2.5)); // вышки внешнего периметра
		// внешний забор: плиты в северных проломах, столбы восточных ворот с поднятым шлагбаумом
		for (const s of [-1, 1]) {
			batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), s * 41.5, 0.12, -OUT + 1.6, -0.25 * s), M.concrete);
			batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), s * 38, 0.26, -OUT - 1.2, 0.3 * s, 0.1, 0), M.concrete);
		}
		for (const z of [-4, 4]) { batch.add(place(box(0.6, 3.2, 0.6), OUT, 1.6, z), M.concreteDark); collide(OUT, z, 0.7, 0.7); }
		barrier(batch, M, collide, OUT - 1.0, -3.6, Z, 7, true);
		// ворота склада вооружения: столб и поднятый шлагбаум
		batch.add(place(box(0.6, 3.2, 0.6), 38, 1.6, AZ), M.concreteDark); collide(38, AZ, 0.7, 0.7);
		barrier(batch, M, collide, 34.3, AZ, 0, 3.6, true);

		// ---------- Стоянка: транспортный самолёт, вертолёт; на полосе — разбитый горящий вертолёт ----------
		{
			const px = -14, pz = -13, pr = Z; // нос — на север, к полосе
			occluder('Plane', (kb) => transportPlane(kb, M, px, pz, pr), { cx: px, cz: pz + 3.75, ry: pr, hx: 13.5, hz: 13.2, top: 5.6 }, 0.3);
			collide(px, pz + 3.75, 25.5, 3.2, pr); // фюзеляж (крыло и двигатели — выше головы)
		}
		{
			const hx = 18, hz = -12, hr = 1.07, c = Math.cos(hr), s = Math.sin(hr), at = (lx) => [hx + lx * c, hz - lx * s];
			occluder('Helicopter', (kb) => helicopter(kb, M, hx, hz, hr), { cx: at(-1.8)[0], cz: at(-1.8)[1], ry: hr, hx: 6.8, hz: 2.2, top: 3.9 }, 0.25);
			collide(...at(0.65), 8.5, 2.9, hr);
			collide(...at(-6.0), 6.8, 1.0, hr);
		}
		{
			// разбитый вертолёт: лёг на бок, обгорел, лопасти повисли; хвостовая балка оторвана и лежит поодаль
			const hx = 28, hz = -40, hr = 2.4, c = Math.cos(hr), s = Math.sin(hr), at = (lx) => [hx + lx * c, hz - lx * s];
			helicopter(batch, M, hx, hz, hr, { paint: M.tankBlack, rotor: 'bent', roll: 0.38, tail: false });
			collide(...at(0.65), 8.5, 3.0, hr);
			tailBoom(batch, M, 0, 0, 0, M.tankBlack, frame(36, -1.45, -43.5, 1.3, 0.6, 0));
			collide(36, -43.5, 6.8, 1.3, 1.3);
			for (const [x, z, r] of [[22, -44, 0.3], [33, -36.5, 1.1], [25.5, -34.5, 2.0]]) batch.add(place(box(1.1, 0.25, 0.6), x, 0.12, z, r), M.metalDark);
		}
		// конус-ветроуказатель у рулёжки
		{
			const wx = -34, wz = -23.5;
			batch.add(place(box(0.08, 4.2, 0.08), wx, 2.1, wz), M.metalDark);
			const F = frame(wx, 3.95, wz, 0.9, 0, -0.25);
			for (let i = 0; i < 4; i++) add(cylX(0.3 - i * 0.05, 0.25 - i * 0.05, 0.5, 10).translate(0.3 + i * 0.5, 0, 0), i % 2 ? M.white : M.red, F);
			collide(wx, wz, 0.3, 0.3);
		}

		// ---------- Капониры: в западном — ящики и бочки, в восточном — БТР ----------
		caponier(occluder, collide, M, -47, -12);
		caponier(occluder, collide, M, 47, -12);
		const ammoBox = (x, z, r) => {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		};
		for (const [x, z, r] of [[-51.5, -9.5, 0.1], [-50.2, -8.4, 0.5], [-43, -8.6, -0.2], [41.5, -8.6, 0.15], [42.6, -9.8, 0.6]]) ammoBox(x, z, r);
		hazardBarrels(batch, M, collide, -47, -9, rnd, 5);
		btr(batch, M, root, collide, 48, -10, 0);

		// ---------- Ангары, КДП ----------
		buildings.push(buildHangar(bctx, { name: 'Hangar', cx: -40, cz: 14, ry: 0 }));
		{
			// второй ангар закрыт: те же стены и арка, ворота задвинуты
			const cx = 6, cz = 14, W = 22, D = 16, H = 4.6, rise = 5.2, hx = W / 2, hz = D / 2, RA = hx + 0.2, k = rise / RA;
			occluder('Hangar2', (kb) => {
				kb.add(place(box(W, H, D, 1.2, 1.2), cx, H / 2, cz), M.roofGreen);
				kb.add(new THREE.CylinderGeometry(RA, RA, D + 0.4, 22, 1, true, -Z, Math.PI).rotateX(-Z).scale(1, k, 1).translate(cx, H, cz), M.roofGreen);
				const gable = new THREE.Shape().absellipse(0, 0, RA, rise, 0, Math.PI, false);
				for (const s of [-1, 1]) { const g = new THREE.ShapeGeometry(gable, 12); if (s < 0) g.rotateY(Math.PI); kb.add(g.translate(cx, H, cz + s * hz), M.roofGreen); }
				for (const z of [-hz + 0.3, -hz / 2, 0, hz / 2, hz - 0.3]) kb.add(new THREE.TorusGeometry(RA + 0.04, 0.06, 4, 20, Math.PI).scale(1, k, 1).translate(cx, H, cz + z), M.metalDark);
				kb.add(place(box(10, H - 0.3, 0.14, 1.5), cx, (H - 0.3) / 2, cz - hz - 0.12), M.metalOlive);
				kb.add(place(box(0.08, H - 0.5, 0.06), cx, (H - 0.5) / 2, cz - hz - 0.2), M.metalDark);
				kb.add(place(box(W + 0.6, 0.22, 0.3), cx, H - 0.05, cz - hz - 0.35), M.metalDark);
			}, { cx, cz, ry: 0, hx: hx + 0.3, hz: hz + 0.4, top: H + rise }, 0.25);
			collide(cx, cz, W, D);
		}
		buildings.push(buildTower(bctx, { name: 'Tower', cx: 26, cz: 8, ry: 0 }));

		// ---------- Склад вооружения за своей оградой: КПП, склад, оружейка; логово элиты во дворе ----------
		buildings.push(
			buildCheckpoint(bctx, { name: 'ArmsGate', cx: 31, cz: AZ, ry: 0 }),
			buildDepot(bctx, { name: 'ArmsDepot', cx: 45, cz: 33, ry: 0 }),
			buildArmory(bctx, { name: 'Armory', cx: 28, cz: 32, ry: 0 }),
		);
		sandbags(batch, M, collide, 32.5, 27.2, 2.4, 0);
		{
			// гнездо элиты: бугры споровой массы вдоль стены склада и забора, кости (не мешают ходить)
			const flesh = new THREE.MeshStandardMaterial({ color: 0x4a1e1c, roughness: 0.38, metalness: 0.05 });
			for (const [i, [x, z]] of [[37, 26.6], [43, 26.9], [49, 26.7], [53.8, 25], [53.6, 23.2], [47, 23.1], [40.5, 23]].entries()) {
				const sc = 0.45 + (i % 3) * 0.2;
				batch.add(place(blob(sc, 1, 23 + i).scale(1.3, 0.5, 1), x, sc * 0.12, z, i * 0.9), flesh, { cast: false });
			}
			for (let i = 0; i < 9; i++) {
				const a = i * 2.1, d = 1 + (i % 4) * 0.8;
				batch.add(place(new THREE.CylinderGeometry(0.04, 0.05, 0.5 + (i % 3) * 0.2, 6).rotateZ(Z), 45 + Math.cos(a) * d, 0.05, 24.6 + Math.sin(a) * d * 0.5, a * 1.7), M.concrete, { cast: false });
			}
		}

		// ---------- Казарма лётного состава, главный КПП ----------
		buildings.push(
			buildArmyBarracks(bctx, { name: 'Barracks', cx: -42, cz: 35, ry: 0 }),
			buildCheckpoint(bctx, { name: 'Checkpoint', cx: -14, cz: FZ1, ry: 0 }),
		);
		ammoBox(-32, 29, 0.2);

		// ---------- Топливный склад, автопарк, радар и мачта связи ----------
		storageTank(batch, M, root, collide, -10, 30, 2.4, 5, M.khaki, 'ГСМ');
		storageTank(batch, M, root, collide, -10, 36.5, 2.4, 5, M.khaki, null);
		hazardBarrels(batch, M, collide, -4.5, 33, rnd, 6);
		armyTruck(batch, M, root, collide, -8, 24, Z); // топливозаправщик у ворот склада
		btr(batch, M, root, collide, 3, 35, 0);
		armyTruck(batch, M, root, collide, 9.5, 35, 0);
		armyTruck(batch, M, root, collide, 15.5, 35.3, 0.05);
		const radarHead = new THREE.Group();
		{
			// радар на прицепе: антенна вращается (update)
			const rx = 6, rz = 28, rry = Z, F = frame(rx, 0, rz, rry);
			add(box(3.2, 0.9, 1.9, 1.5), M.khaki, frame(0, 0.95, 0), F);
			add(box(1.2, 1.0, 1.6, 1.5), M.khaki, frame(-0.8, 1.9, 0), F);
			for (const sz of [-1, 1]) add(wheel(0.42, 0.25), M.tire, frame(0.4, 0.42, sz * 1.0), F);
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
		{
			// мачта связи: решётчатая, с растяжками в бетонные якоря
			const mx = 14, mz = 28, h = 12;
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.07, h, 0.07), mx + dx * 0.3, h / 2, mz + dz * 0.3), M.metalDark);
			for (let y = 1.2; y < h; y += 1.5) batch.add(place(box(0.66, 0.04, 0.66), mx, y, mz), M.metalDark);
			batch.add(place(box(0.05, 2.4, 0.05), mx, h + 1.2, mz), M.metalDark);
			batch.add(place(box(0.18, 0.18, 0.18), mx, h + 2.45, mz), M.red);
			collide(mx, mz, 1.0, 1.0);
		}

		// ---------- За периметром: брошенный «Урал» на севере, разбитая машина у ворот ----------
		armyTruck(batch, M, root, collide, -8, -58, 2.9);
		addCar(batch, M, root, -8, 46, 0.4, 0x6a6a5a, { crashed: true });
		collide(-8, 46, 4.3, 1.8, 0.4);

		// ================= Окраина: между прежним периметром и внешним забором =================

		// ---------- Север: вторая рулёжка, съезды на полосу, стоянки истребителей, заправщик ----------
		ground(140, 8, 0, -60, M.concrete, 4, 0.0216); // рулёжка-2 вдоль полосы за забором
		for (const s of [-1, 1]) ground(8, 12, s * 68, -53, M.concrete, 4, 0.0217); // съезды на полосу за торцами забора
		ground(64, 16, 0, -72, M.concrete, 4, 0.0214); // площадка стоянок
		stripe(140, 0.25, 0, -60, M.yellow);
		for (const s of [-1, 1]) stripe(0.25, 12, s * 68, -53, M.yellow);
		for (const x of [-28, -14, 0, 14, 28]) stripe(0.25, 15, x, -72.5, M.yellow);
		occluder('Stands', (kb) => {
			for (const [i, x] of [-21, -7, 7, 21].entries()) fighter(kb, M, x, -72, -Z, { paint: i % 2 ? M.silver : M.khaki });
		}, { cx: 0, cz: -72, ry: 0, hx: 29, hz: 8.5, top: 4.6 }, 0.3);
		for (const x of [-21, -7, 7, 21]) { collide(x, -71.8, 3.0, 15.2); collide(x, -74.0, 10.8, 4.6); }
		armyTruck(batch, M, root, collide, 30.5, -71, Math.PI); // топливозаправщик у стоянок
		for (const [x, z, r] of [[-30, -66, 0.2], [-29, -67.5, 1.1]]) ammoBox(x, z, r);

		// ---------- Северо-запад: обвалованный ангар воротами на рулёжку ----------
		buildings.push(buildShelter(bctx, { name: 'Hangar3', cx: -60, cz: -70, ry: Math.PI }));

		// ---------- Северо-восток: радиолокатор на вышке, пост РЛС, кабельные барабаны ----------
		const radar2 = radarTower(batch, root, M, collide, 64, -71);
		buildings.push(buildRadarPost(bctx, { name: 'RadarPost', cx: 52, cz: -70 }));
		for (const [x, z] of [[57.5, -66.5], [59, -75]]) {
			batch.add(place(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 14).rotateX(Z), x, 0.8, z), M.wood);
			collide(x, z, 1.7, 0.8);
		}
		batch.add(place(box(2.2, 1.4, 1.3, 1), 72, 0.7, -71), M.khaki); // дизель-генератор
		collide(72, -71, 2.3, 1.4);

		// ---------- Запад: пожарное депо с каланчой; разбитый Ан-2 в роще ----------
		ground(18, 6, -68, -23, M.concrete, 4, 0.0213);
		buildings.push(buildFireDepot(bctx, { name: 'FireDepot', cx: -68, cz: -14 }));
		{
			const [x, z] = [-75.5, -3];
			batch.add(place(box(3, 9, 3, 1.5), x, 4.5, z), M.whiteBrick);
			batch.add(place(box(3.4, 0.25, 3.4, 2), x, 9.1, z), M.concrete);
			for (const y of [3.5, 6.5]) batch.add(place(box(0.8, 1.1, 0.05), x, y, z + 1.53), M.metalDark);
			batch.add(place(box(2.4, 1.2, 2.4, 1), x, 9.8, z), M.whiteBrick);
			batch.add(place(box(2.8, 0.15, 2.8, 2), x, 10.5, z), M.roofMetal);
			collide(x, z, 3.1, 3.1);
		}
		biplaneWreck(batch, M, collide, -68, 22, 0.6);

		// ---------- Юго-запад: казармы лётного состава, плац с трибуной и флагштоком ----------
		buildings.push(
			buildArmyBarracks(bctx, { name: 'Barracks2', cx: -60, cz: 56, ry: 0 }),
			buildArmyBarracks(bctx, { name: 'Barracks3', cx: -60, cz: 70, ry: 0 }),
		);
		ground(16, 22, -40, 62, M.asphalt, 5, 0.0222); // плац
		for (const z of [55, 62, 69]) stripe(14, 0.2, -40, z);
		batch.add(place(box(0.12, 9, 0.12), -40, 4.5, 52.6), M.silver); collide(-40, 52.6, 0.4, 0.4);
		batch.add(place(box(1.6, 1.0, 0.03), -39.2, 8.3, 52.6), M.red);
		batch.add(place(box(2.0, 1.0, 6.0, 1), -46.6, 0.5, 62), M.concrete); // трибуна
		batch.add(place(box(1.0, 0.9, 5.6, 1), -47.1, 1.45, 62), M.concreteDark);
		collide(-46.6, 62, 2.0, 6.0);
		for (const [x, z, ry] of [[-50, 64, Math.PI / 2], [-50, 60, Math.PI / 2]]) bench(batch, M, x, z, ry);

		// ---------- Юг: внешний КПП у дороги, «змейка» из блоков, стоянка спецтехники ----------
		buildings.push(buildCheckpoint(bctx, { name: 'OuterGate', cx: -14, cz: OUT, ry: 0 }));
		batch.add(place(box(0.6, 3.2, 0.6), -23.5, 1.6, OUT), M.concreteDark); collide(-23.5, OUT, 0.7, 0.7);
		barrier(batch, M, collide, -23.2, OUT + 1.6, 0, 6, true);
		sandbags(batch, M, collide, -27.5, OUT - 3.2, 3.2, 0);
		block(-21.5, 72, 0.15); block(-18.2, 66, -0.25);
		billboard(batch, M, root, collide, -30, OUT + 3.2, 0, 'СТОЙ! ВОЕННЫЙ АЭРОДРОМ — ПРОЕЗД ПО ПРОПУСКАМ', { w: 5.4, h: 1.1, y: 1.9, bg: '#e8dcc0', fg: '#a01a10' });
		ground(24, 14, 6, 62, M.asphalt, 5, 0.0222);
		armyTruck(batch, M, root, collide, -1.5, 62, 0.04);
		armyTruck(batch, M, root, collide, 4.5, 62.4, -0.03);
		btr(batch, M, root, collide, 12, 62, 0.08);
		ground(62, 5, 13.5, 47.5, M.asphalt, 5, 0.0221); // дорога от южных ворот к складу ГСМ

		// ---------- Юго-восток: склад ГСМ — четыре резервуара в обваловании, насосная, ж/д цистерны ----------
		ground(36, 24, 44, 61, M.dirt, 4, 0.0142);
		{
			const bund = (x, z, w, d) => { batch.add(place(box(w, 1.0, d, 3), x, 0.35, z), M.dirt, { cast: false }); collide(x, z, w, d); };
			bund(31, 49, 10, 2); bund(55, 49, 14, 2); // северный вал — проезд посередине
			bund(44, 73, 38, 2); bund(26, 61, 2, 26); bund(62, 61, 2, 26);
		}
		storageTank(batch, M, root, collide, 35, 56, 4, 7, M.tankWhite, 'ГСМ');
		storageTank(batch, M, root, collide, 53, 56, 4, 7, M.tankWhite, null);
		storageTank(batch, M, root, collide, 35, 66, 4, 7, M.silver, null);
		storageTank(batch, M, root, collide, 53, 66, 4, 7, M.tankWhite, null);
		pipeRack(batch, M, collide, 30, 58, 61, { y: 4.2, step: 7 });
		buildings.push(buildPumpHouse(bctx, { name: 'Nasosnaya', cx: 70, cz: 56 }));
		armyTruck(batch, M, root, collide, 71, 68, 0.1); // топливозаправщик — горит
		hazardBarrels(batch, M, collide, 66, 63, rnd, 5);
		railTrack(batch, M, 4, 79.5, 77);
		tankWagon(batch, M, collide, 34, 77, 0, M.tankBlack);
		tankWagon(batch, M, collide, 46, 77, 0, M.tankBlack);
		batch.add(place(box(0.4, 1.0, 3.0), 4.4, 0.5, 77), M.red); // упор в конце пути

		// ---------- Восток: хранилища боеприпасов за своей оградой, штабеля авиабомб; памятник у ворот ----------
		fence(FX1, 7, 66, 7); fence(72, 7, OUT, 7); fence(FX1, 44, OUT, 44);
		ground(22, 36, 68, 25.5, M.concrete, 4, 0.0141);
		buildings.push(
			buildBunker(bctx, { name: 'BombStore1', cx: 68, cz: 17, fill: (b, hx, hz) => {
				gunCrate(b, 'Ящик выстрелов', -3.6, hz - 0.55, Math.PI, { rocket: [1, 3, 0.55], rpg7: 0.1, ammo762: [10, 20, 0.4] });
				gunCrate(b, 'Ящик КСВК', -1.2, hz - 0.55, Math.PI, { ksvk: 0.06, ammo127: [5, 12, 0.45], ammo76254: [10, 20, 0.35] });
				rack(b, 3.2, hz - 0.75, Math.PI, { vog25: [3, 6, 0.4], grenade: [1, 3, 0.35], ammo545: [20, 40, 0.5] });
				for (const s of [-1, 1]) b.furniture(s * (hx - 0.9), -1.2, 0, [[1.2, 0.14, 2.4, 0, 0.07, 0, b.IM.crate], [1.0, 0.5, 2.2, 0, 0.4, 0, b.IM.crateGreen]], { solid: [1.2, 2.4], prop: 'ammo' });
			} }),
			buildBunker(bctx, { name: 'BombStore2', cx: 68, cz: 34, fill: (b, hx, hz) => {
				gunCrate(b, 'Ящик РГ-6', -2.4, hz - 0.55, Math.PI, { rg6: 0.1, vog25: [3, 8, 0.5], grenade: [1, 2, 0.35] });
				safe(b, -hx + 0.55, -1.2, Z, { ammo127: [5, 10, 0.45], ksvk: 0.05, spore: [3, 6, 0.5], grenade: [1, 2, 0.3] });
				for (const x of [1.2, 3.6]) b.furniture(x, hz - 0.8, 0, [[2.0, 0.14, 1.2, 0, 0.07, 0, b.IM.crate], [1.8, 0.55, 1.0, 0, 0.42, 0, b.IM.crateGreen], [1.6, 0.5, 0.9, 0.05, 0.95, 0, b.IM.crateGreen]], { solid: [2.0, 1.2], prop: 'ammo' });
			} }),
		);
		bombStack(batch, M, collide, 61.5, 26.5, 0, 2, 3);
		bombStack(batch, M, collide, 74.5, 26.5, Math.PI, 2, 3);
		bombStack(batch, M, collide, 77.6, 11, Z, 1, 3);
		batch.add(place(box(2.0, 2.4, 2.0, 1.5), 59.5, 1.2, 10), M.whiteBrick); // будка часового у ворот
		batch.add(place(box(2.3, 0.12, 2.3, 2), 59.5, 2.46, 10), M.roofTar);
		collide(59.5, 10, 2.1, 2.1);
		batch.add(place(box(1.6, 3.2, 3.6, 1.5), 68, 1.6, -15), M.concrete); // памятник: МиГ на пилоне
		collide(68, -15, 2.0, 4.0);
		fighter(batch, M, 68, -15, 0.6, { y: 2.2, pitch: 0.28, paint: M.silver });
		addCar(batch, M, root, 74, -6, 2.2, 0x6a6a5a, { crashed: true });
		collide(74, -6, 4.3, 1.8, 2.2);

		return {
			start: [-20, 82.5, Math.PI],
			exits: [
				{ to: 'mikro', x0: -24, x1: -16, z0: 85.2, z1: 90, spawn: [-20, 82.5, Math.PI], sign: [-14.5, 84.5, '↓ Микрорайон'] },
				{ to: 'nii', x0: -44, x1: -36, z0: -90, z1: -85.2, spawn: [-40, -82.5, 0], sign: [-33.5, -84, '↑ НИИ'] },
				{ to: 'proval', x0: 36, x1: 44, z0: -90, z1: -85.2, spawn: [40, -82.5, 0], sign: [46.5, -84, '↑ Провал'] },
				{ to: 'shahta', x0: 85.2, x1: 90, z0: -4, z1: 4, spawn: [82.5, 0, -Z], sign: [84, 5.5, 'Шахта →'] },
			],
			// логово элиты — двор склада вооружения; руберы под крылом самолёта, в ангаре, у разбитого вертолёта и в автопарке;
			// топтуны водят стаи у вертолёта, КДП, капониров, казармы; бегуны — по полосе, у ворот и на тропах к соседям
			groups: [
				{ at: [44, 24.8], r: 4, elites: 1, rubers: 1, runners: 3 },
				{ at: [26.5, 26], r: 3, stompers: 1, runners: 1 },
				{ at: [-24, -7], r: 6, rubers: 1, runners: 2 },
				{ at: [12, -6], r: 5, stompers: 1, runners: 2 },
				{ at: [-46, 13], r: 4, rubers: 1, runners: 1 },
				{ at: [-20, 12], r: 5, stompers: 1, runners: 2 },
				{ at: [26, 0], r: 4, stompers: 1, runners: 1 },
				{ at: [0, -37], r: 8, runners: 3 },
				{ at: [21, -40], r: 5, rubers: 1, runners: 2 },
				{ at: [-30, -40], r: 6, stompers: 1, runners: 2 },
				{ at: [-47, -13], r: 3, stompers: 1, runners: 1 },
				{ at: [46, -15], r: 3, stompers: 1, runners: 1 },
				{ at: [-44, 27], r: 4, stompers: 1, runners: 2 },
				{ at: [-4, 28], r: 4, runners: 2 },
				{ at: [10, 27.5], r: 4, rubers: 1, runners: 1 },
				{ at: [-12, 52], r: 5, stompers: 1, runners: 2 },
				{ at: [-40, -57], r: 5, runners: 2 },
				{ at: [40, -57], r: 5, stompers: 1, runners: 1 },
				{ at: [50, 8], r: 4, runners: 2 },
				// окраина: второе логово элиты — между хранилищами боеприпасов; руберы у стоянок, ангара-укрытия, на плацу
				// и у склада ГСМ; топтуны у РЛС, пожарного депо, казарм, торца полосы и стоянки спецтехники
				{ at: [68, 26.5], r: 3, elites: 1, runners: 2 },
				{ at: [0, -66], r: 7, rubers: 1, runners: 2 },
				{ at: [-26, -60], r: 6, stompers: 1, runners: 2 },
				{ at: [-60, -58.5], r: 5, rubers: 1, runners: 1 },
				{ at: [60, -63], r: 5, stompers: 1, runners: 2 },
				{ at: [-68, -23], r: 5, stompers: 1, runners: 2 },
				{ at: [-66, 10], r: 6, runners: 2 },
				{ at: [-60, 63], r: 4, stompers: 1, runners: 2 },
				{ at: [-40, 62], r: 6, rubers: 1, runners: 2 },
				{ at: [-20, 73], r: 5, runners: 2 },
				{ at: [44, 61], r: 3, rubers: 1, runners: 2 },
				{ at: [70, -1], r: 5, runners: 2 },
				{ at: [72, -37], r: 6, stompers: 1, runners: 1 },
				{ at: [6, 72], r: 5, stompers: 1, runners: 2 },
			],
			onRoad,
			// горит разбитый вертолёт на полосе, бочка у КПП, костёр во дворе казармы
			fires: [[28, -40, 'car', 2.3], [-12.5, 46], [-36, 27, 'ground'], [71, 68, 'car', 2.0], [-68, 22, 'car', 1.6], [-56, 63, 'ground']],
			barrels: 12,
			trees(tryTree) {
				// на аэродроме деревьев почти нет: лес — за внешним забором у мути, внутри — роща на западе и редкие сосны
				for (let i = 0; i < 40; i++) tryTree(R(-86, 86), R(-86.5, -81.5), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 40; i++) tryTree(R(-86, 86), R(81.5, 86.5), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 26; i++) tryTree(R(-86.5, -81.5), R(-86, 86), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 26; i++) tryTree(R(81.5, 86.5), R(-86, 86), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 16; i++) tryTree(R(-78, -58), R(2, 40), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(-10, 22), R(70, 78), 'pine');
			},
			clutter: 10,
			blood: 28,
			puddles: 10,
			puddle: () => [R(-75, 75), R(-66, 0)],
			grass: 0.6,
			beltTrees: ['pine', 'pine', 'birch'],
			beltDensity: 0.6, // кольцо окраины — аэродром, а не лес: деревья пояса реже
			hint: (b) => ({
				Hangar: 'Ангар — верстаки и шкафы с инструментом, стеллаж, ящики у вертолёта',
				Tower: 'КДП — пульты диспетчеров, радиостанция, сейф начальника смены',
				ArmsGate: 'КПП склада вооружения — стол дежурного и шкаф',
				ArmsDepot: 'Склад вооружения — ящики с гранатомётами и выстрелами, пирамиды, сейф',
				Armory: 'Оружейка — пирамиды с оружием, ящик гранат, сейф',
				Barracks: 'Казарма лётного состава — тумбочки у коек и шкафы в каптёрке',
				Checkpoint: 'КПП аэродрома — стол дежурного и шкаф',
				OuterGate: 'Внешний КПП — стол дежурного и шкаф',
				Hangar3: 'Обвалованный ангар — верстаки, шкаф с инструментом и стеллаж у истребителя',
				RadarPost: 'Пост РЛС — пульт оператора и шкаф с ЗИП',
				FireDepot: 'Пожарное депо — верстак в боксе, шкаф с боёвкой и стол дежурного',
				Barracks2: 'Казарма лётного состава — тумбочки у коек и шкафы в каптёрке',
				Barracks3: 'Казарма лётного состава — тумбочки у коек и шкафы в каптёрке',
				Nasosnaya: 'Насосная склада ГСМ — шкаф с ЗИП и ящик с инструментом',
				BombStore1: 'Хранилище боеприпасов — ящики с выстрелами к РПГ и патронами 12,7, стеллаж с ВОГ',
				BombStore2: 'Хранилище боеприпасов — ящик РГ-6 и сейф',
			}[b.name]),
			update(dt, t) {
				radarHead.rotation.y = t * 1.1;
				radar2.rotation.y = -t * 0.8;
			},
		};
	},
};
