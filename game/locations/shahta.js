// Кластер «Шахта»: угольная шахта, которую Улей перенёс целиком — с копром, фабрикой и терриконами.
// Главный ориентир — копёр над стволом (север середины): решётчатая башня 27 м с двумя шкивами, подкос к зданию
// подъёмной машины, канаты к её барабану. У ствола — огороженная площадка: устье с клетью, вагонетки, узкоколейка
// к северо-западному террикону (по его склону — наклонный путь со скипом). Здесь же логово ЭЛИТЫ.
// К востоку — обогатительная фабрика (цех с отсадочными машинами и грохотом, надстройка корпуса): с копра к ней
// идёт конвейерная галерея на опорах, от неё вторая галерея — над угольным складом к бункеру погрузки над путями.
// Перед фабрикой — угольный склад: кучи угля, экскаватор грузит БелАЗ; за ней — радиальный сгуститель с водой.
// На юге середины — ж/д пути с гружёными полувагонами и тепловозом, переезд, котельная с трубой у тупика.
// К западу от ствола — АБК (раздевалка, ламповая, кабинеты), крытый переход из него на копёр, лесной склад.
// Юго-запад — ремонтные мастерские, гаражи, водонапорная башня; юг — главные ворота с КПП и шламоотстойник;
// юго-восток — склад взрывчатых материалов за своим забором с колючкой (обвалованное хранилище, склад средств
// инициирования, КПП): гранаты, ВОГи, выстрелы ПГ-7В, изредка гранатомёты — главная добыча кластера.
// Два террикона у северного края — непроходимые конусы породы. Земля — угольная пыль.
// Выходы: на запад (Аэродром) и на юг (Тюрьма). Опасность 4 — чёрная зона: две элиты у ствола, руберы у фабрики
// и на угольном складе, топтуны водят стаи по путям, у АБК и мастерских.

import * as THREE from 'three';
import * as T from '../textures.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, chair, table, buildWorkshop, buildCheckpoint } from '../buildings.js';
import { addCar, bus, blob, pond } from '../props.js';
import { concreteFence, waterTower, chimney, hazardBarrels, barrier, billboard, sandbags, watchTower } from '../props-industrial.js';

const Z = Math.PI / 2;
const SH = [0, -30]; // ствол шахты под копром
const TH = 27; // высота площадки шкивов
const FAC = [40, -30]; // обогатительная фабрика
const ABK = [-30, -12]; // административно-бытовой комбинат
const HOIST = [0, -60]; // здание подъёмной машины
const TA = 16, TB = 22; // ж/д пути (z)
const BUNKER = [62, TA]; // бункер погрузки над путём A
const THICK = [74, -24, 8.4]; // радиальный сгуститель: x, z, радиус
const TER = [[-58, -66, 22, 19, 3], [58, -67, 19, 17, 7]]; // терриконы: x, z, радиус, высота, зерно
const FW = -78, FS = 64, FE = 38; // забор шахты: западный (x), южный (z) — до x = FE
const VM = { x0: 46, x1: 80, z0: 48, z1: 80 }; // ограда склада ВМ

const ONE = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
/** Матрица: сдвиг и поворот (Эйлер XYZ). */
const frame = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), ONE);
const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);
/** Класть геометрию в пачку kb в осях предмета F (m — сдвиг внутри предмета). */
const putter = (kb, F) => (g, mat, m = null) => { if (m) g.applyMatrix4(m); kb.add(g.applyMatrix4(F), mat); };
/** Точка в осях предмета (x, z, поворот ry) → мир. */
const local = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

/** Балка сечением w×d от точки a до точки b (решётка копра, раскосы, канаты); F — матрица предмета. */
function beam(kb, mat, a, b, w = 0.3, d = w, F = null) {
	const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const g = box(w, v.length(), d, 1, 2);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, v.normalize()));
	g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
	if (F) g.applyMatrix4(F);
	kb.add(g, mat);
}

/** Коллайдер-эллипс rx×rz полосами вдоль x (кучи, терриконы, ёмкости): полосы целиком накрывают эллипс. */
function roundCollide(collide, x, z, rx, rz, n = 6) {
	for (let i = 0; i < n; i++) {
		const t0 = -1 + 2 * i / n, t1 = t0 + 2 / n, tm = t0 * t1 < 0 ? 0 : Math.min(Math.abs(t0), Math.abs(t1));
		collide(x, z + (t0 + t1) / 2 * rz, Math.sqrt(1 - tm * tm) * rx * 2, (t1 - t0) * rz);
	}
}

// ---------- Копёр, ствол, подъём ----------

/**
 * Копёр над стволом: четырёхногая решётчатая башня (сужается кверху), площадка со шкивами, подкос на север —
 * к зданию подъёмной машины, канаты к её барабану и вниз, в ствол. На восточной стороне — скиповой бункер,
 * от него на фабрику уходит конвейерная галерея. На южной грани — красная звезда и название шахты.
 */
function headframe(batch, root, M, collide, x, z) {
	const B = 3.6, Tp = 2.4; // полуширина башни внизу и наверху
	const leg = (sx, sz, y) => { const h = B + (Tp - B) * y / TH; return [x + sx * h, y, z + sz * h]; };
	const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
	for (const [sx, sz] of C) {
		beam(batch, M.metalRust, leg(sx, sz, 0), leg(sx, sz, TH), 0.55);
		batch.add(place(box(1.5, 0.5, 1.5), x + sx * B, 0.25, z + sz * B), M.concreteDark); // фундамент
		collide(x + sx * B, z + sz * B, 1.2, 1.2);
	}
	// пояса и раскосы граней (нижняя панель открыта — проход к стволу)
	const lv = [0, 4.5, 9, 13.5, 18, 22.5, TH];
	for (let i = 1; i < lv.length; i++) for (let k = 0; k < 4; k++) {
		const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 4];
		beam(batch, M.metalRust, leg(ax, az, lv[i]), leg(bx, bz, lv[i]), 0.3);
		if (i === 1) continue;
		if ((i + k) % 2) beam(batch, M.metalDark, leg(ax, az, lv[i - 1]), leg(bx, bz, lv[i]), 0.2);
		else beam(batch, M.metalDark, leg(bx, bz, lv[i - 1]), leg(ax, az, lv[i]), 0.2);
	}
	// площадка шкивов с перилами
	const P = Tp + 0.7;
	batch.add(place(box(2 * P, 0.35, 2 * P), x, TH, z), M.metalDark);
	for (const s of [-1, 1]) {
		batch.add(place(box(2 * P, 0.07, 0.07), x, TH + 1.1, z + s * P), M.red);
		batch.add(place(box(0.07, 0.07, 2 * P), x + s * P, TH + 1.1, z), M.red);
		for (const t of [-1, 1]) batch.add(place(box(0.07, 1.1, 0.07), x + s * P, TH + 0.6, z + t * P), M.metalDark);
	}
	// шкивы: колёса в плоскости YZ (канаты уходят на север), ось вдоль X на стойках
	const SY = TH + 2.75, SZ = z - 1.2, R = 2.4;
	for (const sx of [-0.75, 0.75]) {
		batch.add(place(new THREE.TorusGeometry(R, 0.17, 6, 28).rotateY(Z), x + sx, SY, SZ), M.metalDark);
		for (let k = 0; k < 3; k++) batch.add(place(box(0.08, 2 * R, 0.14), x + sx, SY, SZ, 0, k * Math.PI / 3), M.metalDark);
	}
	batch.add(place(cyl(0.18, 0.18, 3.6, 8).rotateZ(Z), x, SY, SZ), M.metalDark);
	for (const sx of [-1.7, 1.7]) {
		beam(batch, M.metalRust, [x + sx, TH + 0.2, SZ - 1.2], [x + sx, SY, SZ], 0.3);
		beam(batch, M.metalRust, [x + sx, TH + 0.2, SZ + 1.2], [x + sx, SY, SZ], 0.3);
	}
	// подкос на север: две ноги, распорки и раскосы
	const top = (sx) => leg(sx, -1, TH - 0.6), foot = (sx) => [x + sx * 3.6, 0, z - 17];
	for (const sx of [-1, 1]) {
		beam(batch, M.metalRust, top(sx), foot(sx), 0.6);
		batch.add(place(box(1.6, 0.5, 1.6), x + sx * 3.6, 0.25, z - 17), M.concreteDark);
		collide(x + sx * 3.6, z - 17, 1.3, 1.3);
	}
	const at = (sx, f) => top(sx).map((v, i) => v + (foot(sx)[i] - v) * f);
	for (const f of [0.25, 0.5, 0.75]) beam(batch, M.metalRust, at(-1, f), at(1, f), 0.3);
	for (const [f0, f1, s] of [[0, 0.25, 1], [0.25, 0.5, -1], [0.5, 0.75, 1]]) beam(batch, M.metalDark, at(-s, f0), at(s, f1), 0.2);
	// канаты: от шкивов к барабану подъёмной машины и вниз, к клети и в ствол
	for (const sx of [-0.75, 0.75]) {
		beam(batch, M.metalDark, [x + sx, SY + 0.6, SZ - R + 0.15], [HOIST[0] + sx, 6.0, HOIST[1] + 5.6], 0.06);
		beam(batch, M.metalDark, [x + sx, SY, SZ + R], [x + sx, sx < 0 ? 3.3 : 0.1, SZ + R], 0.06);
	}
	// проводники клети в башне
	for (const sx of [-1.05, 1.05]) batch.add(place(box(0.12, 22, 0.12), x + sx, 11, SZ + R), M.metalDark);
	// скиповой бункер на восточной грани и площадка у входа галереи из АБК на западной
	batch.add(place(box(3.6, 5.0, 4.0, 1.5), x + 4.7, 16.5, z), M.roofMetal);
	batch.add(place(cyl(2.2, 0.5, 2.0, 4).rotateY(Math.PI / 4), x + 4.7, 13.0, z), M.metalRust);
	batch.add(place(box(3.0, 0.3, 4.0), x - 4.2, 4.0, z + 1.5), M.metalDark);
	// красная звезда и название на южной грани
	const star = new THREE.Shape();
	for (let i = 0; i < 10; i++) {
		const r = i % 2 ? 0.62 : 1.5, a = i * Math.PI / 5;
		if (i) star.lineTo(Math.sin(a) * r, Math.cos(a) * r); else star.moveTo(0, r);
	}
	star.closePath();
	const hz = (y) => B + (Tp - B) * y / TH;
	batch.add(new THREE.ShapeGeometry(star).translate(x, 22.6, z + hz(22.6) + 0.32), M.red, { cast: false });
	const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.9), T.signMaterial('ШАХТА «ЦЕНТРАЛЬНАЯ»', { bg: '#7a1c14', fg: '#f0e6c8', w: 640, h: 104 }));
	sign.position.set(x, 19.6, z + hz(19.6) + 0.34);
	root.add(sign);
}

/**
 * Устье ствола: бетонный бортик вокруг проёма (в него не упасть), тёмная бездна, клеть у верхней посадки,
 * перила с калиткой. Коллайдер — весь проём.
 */
function shaftCollar(batch, M, collide, x, z) {
	const hx = 2.1, z0 = z - 2.5, z1 = z + 2.5;
	batch.add(place(planeXZ(2 * hx, z1 - z0, 1), x, 0.04, z), M.tire, { cast: false });
	for (const zz of [z0, z1]) batch.add(place(box(2 * hx + 0.5, 0.5, 0.25), x, 0.25, zz), M.concreteDark);
	for (const s of [-1, 1]) batch.add(place(box(0.25, 0.5, z1 - z0), x + s * (hx + 0.12), 0.25, z), M.concreteDark);
	// перила: столбики и две перекладины по трём сторонам; на юге — калитка посадки
	for (const s of [-1, 1]) {
		for (const zz of [z0, z, z1]) batch.add(place(box(0.08, 1.15, 0.08), x + s * (hx + 0.12), 0.95, zz), M.hazard);
		for (const y of [0.85, 1.45]) batch.add(place(box(0.06, 0.06, z1 - z0), x + s * (hx + 0.12), y, z), M.hazard);
	}
	for (const y of [0.85, 1.45]) batch.add(place(box(2 * hx + 0.3, 0.06, 0.06), x, y, z0), M.hazard);
	for (const y of [0.85, 1.25, 1.45]) batch.add(place(box(2 * hx + 0.3, 0.05, 0.05), x, y, z1 + 0.05), M.metalDark);
	// клеть у посадки: короб с решётчатой дверью
	batch.add(place(box(1.8, 2.7, 1.3, 1.2), x - 0.2, 1.65, z + 1.2), M.metalOlive);
	batch.add(place(box(1.5, 2.2, 0.05), x - 0.2, 1.55, z + 1.87), M.metalDark);
	batch.add(place(box(1.9, 0.12, 1.4), x - 0.2, 3.06, z + 1.2), M.metalDark);
	collide(x, z, 2 * hx + 0.7, z1 - z0 + 0.5);
}

/** Ограждение площадки ствола: стойки и три ряда труб; gaps — проёмы [[a0, a1], …] вдоль линии. */
function pipeFence(batch, M, collide, x0, z0, x1, z1, gaps = []) {
	const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
	let cur = 0;
	const segs = [];
	for (const [a, b] of gaps) { segs.push([cur, a]); cur = b; }
	segs.push([cur, len]);
	for (const [a, b] of segs) {
		if (b - a < 0.3) continue;
		const p = (t) => [x0 + (x1 - x0) * t / len, z0 + (z1 - z0) * t / len];
		const [mx, mz] = p((a + b) / 2);
		for (const y of [0.35, 1.05, 1.85]) batch.add(place(box(b - a, 0.07, 0.07), mx, y, mz, -ang), M.metalDark);
		const n = Math.max(1, Math.round((b - a) / 3));
		for (let i = 0; i <= n; i++) { const [px, pz] = p(a + (b - a) * i / n); batch.add(place(box(0.1, 2.0, 0.1), px, 1.0, pz, -ang), M.metalDark); }
		collide(mx, mz, b - a, 0.25, -ang);
	}
}

/**
 * Здание подъёмной машины 18×11 м: высокий кирпичный зал. Внутри — барабан с ребордами на тумбах, двигатель,
 * тормоза, пульт машиниста лицом к барабану, щиты управления, сейф, шкаф и верстак. В южной стене под крышей —
 * проёмы, в них уходят канаты с копра. Вход — с юга, от ствола.
 */
function buildHoist(ctx, { name, cx, cz }) {
	const W = 18, D = 11, H = 7, hx = W / 2, hz = D / 2, t = 0.35;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.9 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-6], w: 1.6, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [-6, -2, 2, 6]) b.window('front', x, { y: 4.4, t, sill: M.brick });
	for (const x of [3.5, 7]) b.window('back', x, { y: 4.4, t, sill: M.brick });
	for (const z of [-2.5, 2.5]) { b.window('left', z, { y: 4.4, t, sill: M.brick }); b.window('right', z, { y: 4.4, t, sill: M.brick }); }
	for (const x of [-0.75, 0.75]) b.top_(b.onWall(new THREE.PlaneGeometry(0.9, 0.9).translate(0, 6.0, 0.02), 'back', x, t), M.tire); // проёмы канатов
	b.wallBox('back', -6 + 1.0, 0.8, 0.02, 2.05, 0.05, M.metalRust, { t }); // дверь распахнута
	b.canopy('back', -6, { w: 2.2, d: 1.1, y: 2.6, mat: M.metalRust, t });
	b.top_(place(box(W + 0.6, 0.35, D + 0.6, 3), 0, H + 0.17, 0), M.roofTar);
	b.parapet(H + 0.35, M.brick, 0.35);
	for (const [x, z] of [[-5, -2], [4, 2.5]]) b.vent(x, z, H + 0.35, M.silver);
	// барабан подъёмной машины, двигатель, тормозные стойки
	b.furniture(1.4, 0.8, 0, [
		[1, 1, 1, 0, 0, 0, M.metalDark, { geo: place(cyl(1.5, 1.5, 4.4, 22).rotateZ(Z), -1.0, 1.9, 0) }],
		[1, 1, 1, 0, 0, 0, IM.machine, { geo: place(cyl(1.85, 1.85, 0.16, 22).rotateZ(Z), -3.2, 1.9, 0) }],
		[1, 1, 1, 0, 0, 0, IM.machine, { geo: place(cyl(1.85, 1.85, 0.16, 22).rotateZ(Z), 1.2, 1.9, 0) }],
		[1, 1, 1, 0, 0, 0, IM.metal, { geo: place(cyl(0.22, 0.22, 7.4, 10).rotateZ(Z), 0.2, 1.9, 0) }],
		[0.7, 1.7, 1.4, -3.8, 0.85, 0, M.concreteDark], [0.7, 1.7, 1.4, 1.8, 0.85, 0, M.concreteDark],
		[2.0, 1.9, 1.9, 3.0, 0.95, 0, IM.machine], [1.6, 0.5, 1.5, 3.0, 2.15, 0, M.metalDark],
		[0.3, 2.8, 0.4, -3.6, 1.4, 1.5, M.red], [0.3, 2.8, 0.4, 1.6, 1.4, 1.5, M.red],
	], { solid: [8.4, 4.0] });
	// пульт машиниста — лицом к барабану; щиты управления у северной стены
	b.container('Пульт машиниста', -5.0, 0.8, -Z, [
		[1.6, 0.85, 0.8, 0, 0.42, 0, IM.machine], [1.6, 0.4, 0.3, 0, 1.0, -0.25, IM.machine],
		[0.5, 0.25, 0.03, -0.35, 1.05, -0.09, IM.screen], [0.5, 0.25, 0.03, 0.35, 1.05, -0.09, IM.screen], [0.08, 0.3, 0.08, 0.6, 1.0, 0.25, IM.black],
	], [1.6, 0.8], { ammo545: [6, 14, 0.45], ammo919: [6, 12, 0.35], zhivchik: 0.25, spore: [1, 3, 0.35] }, 1.2);
	chair(b, -6.3, 0.2, -Z);
	for (const x of [-3.2, -2.0, -0.8]) b.furniture(x, -hz + t / 2 + 0.32, 0, [[1.1, 2.0, 0.6, 0, 1.0, 0, IM.machine], [0.3, 0.2, 0.02, 0.2, 1.5, 0.31, IM.screen]], { solid: [1.15, 0.6] });
	b.container('Шкаф управления', 1.4, -hz + t / 2 + 0.32, 0, [[1.1, 2.0, 0.6, 0, 1.0, 0, IM.machine], [0.02, 1.9, 0.02, 0, 1.0, 0.31, IM.black], [0.3, 0.2, 0.02, 0.25, 1.5, 0.31, IM.screen]], [1.1, 0.6], { ammo762: [8, 16, 0.4], grenade: 0.08, ammo76254: [5, 10, 0.25] }, 2.0);
	b.container('Сейф машиниста', -hx + t / 2 + 0.35, -3.4, Z, [[0.7, 1.2, 0.6, 0, 0.6, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.75, 0.31, IM.black]], [0.7, 0.6], { fnfal: 0.05, ammo76251: [6, 12, 0.4], ammo50: [4, 8, 0.3], spore: [2, 5, 0.55] }, 1.2);
	b.container('Верстак', hx - t / 2 - 0.45, -3.0, -Z, [
		[2.0, 0.08, 0.8, 0, 0.9, 0, IM.furniture], [1.9, 0.5, 0.7, 0, 0.3, 0, IM.machine], [0.3, 0.25, 0.3, -0.6, 1.06, -0.15, IM.metal], [1.6, 0.8, 0.02, 0, 1.7, -0.39, IM.rack, { up: true }],
	], [2.0, 0.8], { ammo12: [4, 10, 0.4], ammo545: [8, 16, 0.35], fireaxe: 0.05, zhivchik: 0.2 }, 1.0);
	// канаты от проёмов к барабану — с крышей (исчезают, когда герой внутри)
	const up = { add: (g, m) => b.top_(g, m) };
	for (const x of [-0.75, 0.75]) beam(up, M.metalDark, [x, 6.0, hz], [x + 0.4, 3.4, 0.8], 0.05);
	return b.finish();
}

// ---------- АБК ----------

/** Шкафчик раздевалки (тайник); лицо — в +Z своих осей. */
const locker = (b, name, x, z, rot, loot, w = 0.8) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);
/** Сейф (тайник). */
const safe = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.7, 1.2, 0.6, 0, 0.6, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, 0.75, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, 0.75, 0.31, b.IM.black],
], [0.7, 0.6], loot, 1.2);
/** Письменный стол с бумагами (тайник). */
const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.4, 0.05, 0.7, 0, 0.75, 0, b.IM.furniture], [0.45, 0.72, 0.65, -0.45, 0.36, 0, b.IM.furniture], [0.06, 0.72, 0.6, 0.65, 0.36, 0, b.IM.furniture],
	[0.5, 0.01, 0.35, 0.2, 0.78, 0.05, b.IM.paper], [0.25, 0.08, 0.2, -0.4, 0.8, -0.15, b.IM.black],
], [1.4, 0.7], loot, 0.85);

/**
 * АБК 28×12 м, два этажа (заходят на первый): посередине вестибюль (стол табельщика, турникеты), на запад —
 * раздевалка со шкафчиками и скамьями, на восток — ламповая (зарядные стеллажи с шахтёрскими лампами,
 * самоспасатели) и два кабинета: начальника участка (стол, сейф) и горного мастера (стол, аптечка).
 * Главный вход — с юга, от дороги; северная дверь — к стволу; со второго этажа на копёр идёт крытый переход.
 */
function buildABK(ctx, { name, cx, cz }) {
	const W = 28, D = 12, H = 3.4, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 3.9 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.5), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0], w: 1.6, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	// перегородки: раздевалка | вестибюль | ламповая | кабинеты (север — начальник, юг — горный мастер)
	const pw = { mat: IM.armyWall, t: 0.15 };
	for (const x of [-3.5, 3.5, 8.5]) b.wall('z', x, -hz + t / 2, hz - t / 2, { ...pw, doors: [3] });
	b.wall('x', 0, 8.58, hx - t / 2, { ...pw, doors: [11.3] });
	const sill = M.whiteBrick;
	for (const x of [-11, -7.5, 6, 11.3]) { b.window('back', x, { t, sill }); b.window('front', x, { t, sill }); }
	b.window('left', 0, { t, sill }); b.window('right', -3, { t, sill }); b.window('right', 3, { t, sill });
	// второй этаж (глухой — на него не подняться), плоская крыша с парапетом
	b.top_(place(box(W + 0.4, 0.3, D + 0.4, 3), 0, H + 0.15, 0), M.concrete);
	b.top_(place(box(W, 3.0, D, 2, 1.6), 0, H + 1.8, 0), M.whiteBrick);
	for (const side of ['back', 'front']) for (const [i, x] of [-11, -7.5, -4, 4, 7.5, 11].entries()) {
		b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.1, 1.4), (i + side.length) % 4).translate(0, H + 1.9, 0.012), side, x, t), M.window);
	}
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 3.45, 0), M.roofTar);
	b.parapet(H + 3.6, M.whiteBrick, 0.3);
	for (const [x, z] of [[-9, -2], [2, 2.5], [10, -3]]) b.vent(x, z, H + 3.6, M.silver);
	b.canopy('back', 0, { w: 3.2, d: 1.6, y: 2.75, mat: M.concrete, posts: M.whiteBrick, t, thick: 0.2 });
	b.lower(place(box(3.2, 0.14, 1.3), 0, 0.07, hz + 0.8), M.concrete);
	b.top_(b.onWall(new THREE.PlaneGeometry(4.4, 0.62).translate(0, H + 1.9, 0.03), 'back', 0, t), T.signMaterial('СЛАВА ШАХТЁРСКОМУ ТРУДУ!', { bg: '#7a1c14', fg: '#f0e6c8', w: 640, h: 90 }));
	// раздевалка: шкафчики вдоль западной и северной стен, скамьи
	const lx = -hx + t / 2 + 0.27;
	[[-4.4, { ammo545: [6, 12, 0.4], zhivchik: 0.25 }], [-2.6, null], [-0.8, { ammo919: [6, 12, 0.45], spore: [1, 2, 0.3] }], [1.0, null], [2.8, null], [4.6, null]].forEach(([z, loot]) => {
		if (loot) locker(b, 'Шкафчик', lx, z, Z, loot, 0.8);
		else b.furniture(lx, z, Z, [[0.8, 1.9, 0.5, 0, 0.95, 0, IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, IM.black]], { solid: [0.8, 0.5] });
	});
	for (const [i, x] of [-11.4, -9.8, -8.2, -6.6].entries()) {
		if (i === 2) locker(b, 'Шкафчик', x, -hz + t / 2 + 0.27, 0, { ammo12: [4, 10, 0.4], zhivchik: 0.25, spore: 0.2 });
		else b.furniture(x, -hz + t / 2 + 0.27, 0, [[0.8, 1.9, 0.5, 0, 0.95, 0, IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, IM.black]], { solid: [0.8, 0.5] });
	}
	for (const z of [-1.2, 2.2]) b.furniture(-8.5, z, 0, [[3.2, 0.06, 0.42, 0, 0.45, 0, IM.furnitureLight], [0.08, 0.42, 0.36, -1.4, 0.22, 0, IM.metal], [0.08, 0.42, 0.36, 1.4, 0.22, 0, IM.metal]], { solid: [3.2, 0.42] });
	// вестибюль: стол табельщика, турникеты, доска «Лучшие люди шахты»
	desk(b, 'Стол табельщика', -2.5, -2.0, Z, { ammo919: [4, 10, 0.4], zhivchik: 0.25, spore: [1, 2, 0.3] });
	for (const x of [-1.2, 1.2]) b.furniture(x, 1.0, 0, [[0.12, 1.0, 0.12, 0, 0.5, 0, IM.metal], [0.9, 0.05, 0.05, x > 0 ? -0.45 : 0.45, 0.95, 0, IM.metal]], { solid: [0.2, 0.2] });
	b.furniture(0, -hz + t / 2 + 0.05, 0, [[2.2, 1.2, 0.04, -2.2, 1.6, 0, IM.redBoard]], { solid: [0, 0], up: true });
	// ламповая: зарядный стеллаж с лампами, стеллаж самоспасателей
	b.container('Зарядный стеллаж', 6.0, -hz + t / 2 + 0.35, 0, [
		...[-1.3, 1.3].map((dx) => [0.06, 2.0, 0.6, dx, 1.0, 0, IM.rack]), ...[0.5, 1.1, 1.7].map((y) => [2.7, 0.05, 0.6, 0, y, 0, IM.rack]),
		...[0.5, 1.1, 1.7].flatMap((y) => [-0.9, -0.3, 0.3, 0.9].map((dx) => [0.16, 0.24, 0.16, dx, y + 0.15, 0.05, IM.black])),
	], [2.7, 0.6], { ammo545: [8, 16, 0.4], ammo556: [6, 12, 0.3], zhivchik: [1, 2, 0.3] }, 2.0);
	b.container('Стеллаж самоспасателей', 8.5 - 0.1 - 0.3, -0.8, -Z, [
		...[-0.9, 0.9].map((dx) => [0.06, 1.8, 0.5, dx, 0.9, 0, IM.rack]), ...[0.4, 1.0, 1.6].map((y) => [1.9, 0.05, 0.5, 0, y, 0, IM.rack]),
		...[0.4, 1.0].flatMap((y) => [-0.5, 0, 0.5].map((dx) => [0.3, 0.3, 0.22, dx, y + 0.17, 0, IM.machine])),
	], [1.9, 0.5], { zhivchik: [1, 2, 0.45], grenade: 0.06, spore: [1, 2, 0.3] }, 1.8);
	// кабинет начальника участка (север) и горного мастера (юг)
	desk(b, 'Стол начальника участка', 11.3, -4.6, 0, { ammo919: [6, 12, 0.45], ammo50: [4, 8, 0.25], spore: [1, 3, 0.4] });
	chair(b, 11.0, -5.45, 0);
	safe(b, 'Сейф начальника', hx - t / 2 - 0.35, -1.5, -Z, { deagle: 0.07, ammo50: [4, 8, 0.4], grenade: [1, 2, 0.3], spore: [3, 6, 0.55] });
	b.furniture(9.2, -hz + t / 2 + 0.25, 0, [[1.0, 1.9, 0.45, 0, 0.95, 0, IM.furniture], [0.02, 1.8, 0.02, 0, 0.95, 0.23, IM.black]], { solid: [1.0, 0.45] });
	desk(b, 'Стол горного мастера', 11.3, 4.6, Math.PI, { ammo545: [6, 12, 0.4], ammo762: [6, 12, 0.3], zhivchik: 0.3 });
	b.container('Аптечка', hx - t / 2 - 0.12, 1.4, -Z, [[0.5, 0.45, 0.2, 0, 1.4, 0, IM.white], [0.2, 0.06, 0.01, 0, 1.4, 0.105, IM.redBoard], [0.06, 0.2, 0.01, 0, 1.4, 0.106, IM.redBoard]], [0.4, 0.2], { zhivchik: [1, 2, 0.75] }, 1.65);
	return b.finish();
}

// ---------- Обогатительная фабрика ----------

/**
 * Главный корпус обогатительной фабрики 30×18 м, стены 8 м; над западной частью — надстройка (к ней приходит
 * галерея с копра). Внутри: две отсадочные машины и грохот вдоль северной стены, под потолком — конвейер; у
 * западной стены — шкафчики, у южной — верстак; в юго-восточном углу — конторка мастера (стол, сейф).
 * Ворота и дверь конторки — на юг, к угольному складу; дверь на запад — к стволу.
 */
function buildFactory(ctx, { name, cx, cz }) {
	const W = 30, D = 18, H = 8, hx = W / 2, hz = D / 2, t = 0.35;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 9.2 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, 4, { ...wo, doors: [-6], w: 3.6, side: -1 });
	b.wall('x', hz, 4, hx + t / 2, { ...wo, doors: [12.2], side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [-1.5], side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 9.5, 3, hz - t / 2, { mat: IM.factoryWall, t: 0.15, doors: [4.8] });
	b.wall('x', 3, 9.43, hx - t / 2, { mat: IM.factoryWall, t: 0.15 });
	const sill = M.brick;
	for (const x of [-12, -1, 2.5, 7]) b.window('back', x, { y: 5.6, t, sill });
	for (const x of [-12, -1, 7]) b.window('back', x, { y: 2.0, t, sill });
	for (const x of [-12, -6, 0, 6, 12]) b.window('front', x, { y: 5.6, t, sill });
	b.window('left', 4, { y: 5.6, t, sill });
	for (const z of [-4, 4]) b.window('right', z, { y: 5.6, t, sill });
	for (const s of [-1, 1]) b.wallBox('back', -6 + s * 2.7, 1.75, 0.02, 2.4, 0.06, M.metalRust, { t }); // створки ворот
	b.canopy('back', -6, { w: 4.6, d: 1.5, y: 3.0, mat: M.metalRust, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(7.0, 0.8).translate(0, H - 0.9, 0.03), 'back', -6, t), T.signMaterial('ЦОФ «ЦЕНТРАЛЬНАЯ»', { bg: '#2a2c26', fg: '#e8dcae', w: 640, h: 74 }));
	// кровля, надстройка корпуса с ленточным остеклением
	b.top_(place(box(W + 0.6, 0.35, D + 0.6, 3), 0, H + 0.17, 0), M.roofTar);
	b.parapet(H + 0.35, M.brick, 0.4);
	const UX = -8.5, UZ = -1.5, UW = 13, UD = 11, UH = 8.5, y0 = H + 0.35;
	b.top_(place(box(UW, UH, UD, 2, 1.6), UX, y0 + UH / 2, UZ), M.concreteDark);
	for (const y of [y0 + 2.6, y0 + 6.0]) {
		b.top_(place(box(UW - 1.4, 1.3, 0.06), UX, y, UZ + UD / 2 + 0.02), M.glass);
		b.top_(place(box(0.06, 1.3, UD - 1.6), UX + UW / 2 + 0.02, y, UZ), M.glass);
	}
	b.top_(place(box(UW + 0.5, 0.3, UD + 0.5, 3), UX, y0 + UH + 0.15, UZ), M.roofTar);
	b.vent(UX + 3, UZ + 2, y0 + UH + 0.3, M.silver, { h: 1.0, r: 0.3 });
	for (const [x, z] of [[4, -4], [9, 4], [12, -5]]) b.vent(x, z, H + 0.35, M.silver);
	b.top_(place(box(14, 0.6, 2.4, 2), 6, H + 0.65, 0), M.glass); // световой фонарь
	// отсадочные машины и грохот
	const jig = (x) => b.furniture(x, -4.6, 0, [
		[5.0, 2.2, 2.6, 0, 1.1, 0, IM.machine], [5.2, 0.15, 2.8, 0, 2.27, 0, M.metalDark],
		...[-1.8, -0.6, 0.6, 1.8].map((dx) => [0.3, 1.2, 0.3, dx, 2.9, -0.6, M.metalRust]), [1.4, 0.8, 1.2, 0, 2.75, 0.5, M.metalDark],
		[4.8, 0.5, 0.6, 0, 3.6, -0.6, M.metalRust],
	], { solid: [5.0, 2.6] });
	jig(-9.5); jig(-2.0);
	b.furniture(5.5, -4.6, 0, [
		...[[-1.8, -1], [1.8, -1], [-1.8, 1], [1.8, 1]].map(([px, pz]) => [0.2, 1.8, 0.2, px, 0.9, pz, M.metalDark]),
		[1, 1, 1, 0, 0, 0, M.metalRust, { geo: place(box(4.2, 0.35, 2.2), 0, 1.9, 0, 0, 0, 0.22) }],
		[1, 1, 1, 0, 0, 0, M.tankBlack, { geo: place(box(3.8, 0.12, 1.9), 0, 2.12, 0, 0, 0, 0.22) }],
		[1.0, 0.9, 0.9, 2.3, 0.45, 0, IM.machine],
	], { solid: [4.2, 2.4] });
	// конвейер под потолком вдоль цеха
	b.top_(place(box(26, 0.3, 1.2), 0, 5.6, 1.6), M.metalDark);
	b.top_(place(box(25.6, 0.12, 1.0), 0, 5.8, 1.6), M.tankBlack);
	for (const x of [-10, -2, 6]) b.top_(place(box(0.15, 2.2, 0.15), x, 6.9, 1.6), M.metalDark);
	// шкафы у северной стены, шкафчики у западной, верстак у южной
	b.container('Шкаф с ЗИП', -13.4, -hz + t / 2 + 0.3, 0, [[1.1, 2.0, 0.55, 0, 1.0, 0, IM.locker], [0.02, 1.9, 0.02, 0, 1.0, 0.28, IM.black]], [1.1, 0.55], { ammo545: [8, 16, 0.4], ammo12: [4, 8, 0.3], grenade: 0.06 }, 2.0);
	b.container('Электрошкаф', 10.0, -hz + t / 2 + 0.32, 0, [[1.1, 2.0, 0.6, 0, 1.0, 0, IM.machine], [0.3, 0.2, 0.02, 0.25, 1.5, 0.31, IM.screen]], [1.1, 0.6], { ammo919: [6, 12, 0.35], zhivchik: 0.25, spore: [1, 2, 0.3] }, 2.0);
	b.furniture(13.0, -hz + t / 2 + 0.45, 0, [[1.2, 0.8, 0.8, 0, 0.4, 0, IM.crateGreen], [1.0, 0.5, 0.7, 0.05, 1.05, 0, IM.crate]], { solid: [1.2, 0.8], prop: 'crate' });
	locker(b, 'Шкафчик', -hx + t / 2 + 0.27, 3.0, Z, { ammo545: [5, 12, 0.35], zhivchik: 0.2 });
	b.furniture(-hx + t / 2 + 0.27, 4.0, Z, [[0.8, 1.9, 0.5, 0, 0.95, 0, IM.locker]], { solid: [0.8, 0.5] });
	b.furniture(-hx + t / 2 + 0.27, 5.0, Z, [[0.8, 1.9, 0.5, 0, 0.95, 0, IM.locker]], { solid: [0.8, 0.5] });
	b.container('Верстак', -1.0, hz - t / 2 - 0.45, Math.PI, [
		[2.0, 0.08, 0.8, 0, 0.9, 0, IM.furniture], [1.9, 0.5, 0.7, 0, 0.3, 0, IM.machine], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, IM.machine], [1.6, 0.8, 0.02, 0, 1.7, -0.39, IM.rack, { up: true }],
	], [2.0, 0.8], { ammo12: [4, 8, 0.35], ammo545: [6, 12, 0.3], fireaxe: 0.04 }, 1.0);
	b.furniture(3.5, 6.6, 0.15, [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], [1.0, 0.5, 0.8, 0, 0.39, 0, IM.rag], [0.9, 0.4, 0.7, 0, 0.84, 0, IM.rag]], { solid: [1.25, 1.05] });
	// конторка мастера
	desk(b, 'Стол мастера', 12.4, 4.0, 0, { ammo545: [6, 12, 0.4], zhivchik: 0.3, spore: [1, 3, 0.4] });
	safe(b, 'Сейф мастера', hx - t / 2 - 0.35, 7.6, -Z, { ammo545: [15, 30, 0.55], ammo76254: [5, 10, 0.3], ak74: 0.06, spore: [2, 4, 0.5] });
	return b.finish();
}

/**
 * Конвейерная галерея: короб из профлиста с лентой окон от точки a до точки b ([x, y, z] — середина торца),
 * снизу ферма; supports — доли длины, где стоят опоры (две стойки с распорками, коллайдер).
 */
function gallery(kb, M, collide, a, b, supports = []) {
	const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], hl = Math.hypot(dx, dz), L = Math.hypot(hl, dy);
	const ry = Math.atan2(-dz, dx), F = frame((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, ry, 0, Math.atan2(dy, hl));
	const put = putter(kb, F), h = 2.3, w = 2.6;
	put(box(L, h, w, 1.2), M.roofMetal);
	put(box(L - 0.6, 0.45, w + 0.04), M.glass, frame(0, 0.35, 0));
	put(box(L, 0.4, w + 0.3), M.metalDark, frame(0, -h / 2 - 0.2, 0));
	const s = Math.sin(ry), c = Math.cos(ry);
	for (const f of supports) {
		const px = a[0] + dx * f, pz = a[2] + dz * f, py = a[1] + dy * f - h / 2 - 0.4;
		const P = (k, y, spread = 1.3) => [px + s * k * spread, y, pz + c * k * spread];
		for (const k of [-1, 1]) beam(kb, M.metalRust, P(k, 0, 1.5), P(k, py, 1.2), 0.38);
		for (const y of [py * 0.4, py * 0.75, py]) beam(kb, M.metalRust, P(-1, y, 1.25), P(1, y, 1.25), 0.22);
		beam(kb, M.metalDark, P(-1, 0.3, 1.45), P(1, py * 0.4, 1.3), 0.16);
		beam(kb, M.metalDark, P(1, py * 0.4, 1.3), P(-1, py * 0.75, 1.25), 0.16);
		collide(px, pz, 0.7, 3.5, ry);
	}
}

/** Бункер погрузки над путём: короб на четырёх бетонных стойках, воронка с затвором над полувагоном. */
function loadBunker(kb, M, collide, x, z) {
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
		kb.add(place(box(0.7, 7.2, 0.7), x + sx * 4.2, 3.6, z + sz * 3.3), M.concreteDark);
		collide(x + sx * 4.2, z + sz * 3.3, 0.9, 0.9);
	}
	for (const s of [-1, 1]) {
		kb.add(place(box(9.2, 0.6, 0.6), x, 7.0, z + s * 3.3), M.concreteDark);
		kb.add(place(box(0.6, 0.6, 7.2), x + s * 4.2, 7.0, z), M.concreteDark);
	}
	kb.add(place(box(9.6, 6.0, 7.4, 1.5), x, 10.3, z), M.roofMetal);
	kb.add(place(box(10.0, 0.3, 7.8), x, 13.4, z), M.metalDark);
	kb.add(place(cyl(3.6, 0.7, 2.6, 4).rotateY(Math.PI / 4).scale(1.4, 1, 1), x, 6.0, z), M.metalRust);
	kb.add(place(box(0.9, 0.9, 0.9), x, 4.4, z), M.metalDark);
	for (let y = 0.6; y < 13; y += 0.6) kb.add(place(box(0.5, 0.04, 0.04), x + 4.65, y, z + 3.3), M.metalDark); // скобы-лестница
}

/** Радиальный сгуститель: круглый бетонный чан с водой, центральная опора, мост с перилами до борта, привод. */
function thickener(kb, M, collide, x, z, r) {
	const n = 28;
	for (let i = 0; i < n; i++) {
		const a = (i + 0.5) / n * Math.PI * 2;
		kb.add(place(box(2 * Math.PI * (r + 0.18) / n + 0.05, 1.7, 0.36, 1.5), x + Math.cos(a) * r, 0.85, z + Math.sin(a) * r, -a - Z), M.concreteDark);
	}
	kb.add(place(new THREE.CircleGeometry(r - 0.15, 32).rotateX(-Z), x, 1.3, z), M.water, { cast: false });
	kb.add(place(cyl(0.8, 1.0, 3.2, 12), x, 1.6, z), M.concrete);
	kb.add(place(box(r + 0.4, 0.45, 1.5), x + r / 2, 2.7, z), M.metalRust);
	for (const s of [-1, 1]) {
		kb.add(place(box(r + 0.4, 0.05, 0.05), x + r / 2, 3.75, z + s * 0.72), M.hazard);
		for (let k = 0; k <= 4; k++) kb.add(place(box(0.05, 0.9, 0.05), x + 0.4 + k * r / 4, 3.3, z + s * 0.72), M.hazard);
	}
	kb.add(place(box(1.3, 1.1, 1.8), x + r + 0.1, 2.3, z), M.metalDark);
	kb.add(place(cyl(0.45, 0.45, 0.3, 12).rotateX(Z), x + r + 0.1, 1.9, z - 0.95), M.tire);
	roundCollide(collide, x, z, r + 0.4, r + 0.4, 8);
}

// ---------- Ж/д: пути, полувагоны, тепловоз ----------

/** Ж/д путь вдоль X: щебень и шпалы (кроме переездов gaps — там бетонный настил), рельсы сплошные. */
function track(kb, M, x0, x1, z, gaps = []) {
	let cur = x0;
	const segs = [];
	for (const [a, b] of gaps) { segs.push([cur, a]); cur = b; }
	segs.push([cur, x1]);
	for (const [a, b] of segs) {
		if (b - a < 0.5) continue;
		kb.add(place(box(b - a, 0.1, 3.0, 2), (a + b) / 2, 0.05, z), M.ballast, { cast: false });
		for (let x = a + 0.35; x < b; x += 0.7) kb.add(place(box(0.22, 0.1, 2.5), x, 0.12, z), M.sleeper, { cast: false });
	}
	for (const [a, b] of gaps) kb.add(place(box(b - a, 0.16, 3.2, 1.5), (a + b) / 2, 0.08, z), M.concreteDark, { cast: false });
	for (const dz of [-0.76, 0.76]) kb.add(place(box(x1 - x0, 0.14, 0.08), (x0 + x1) / 2, 0.24, z + dz), M.rail, { cast: false });
}

/** Тупиковый упор в конце пути (красно-белый брус). */
function bufferStop(kb, M, collide, x, z) {
	kb.add(place(box(0.6, 1.2, 2.8), x, 0.6, z), M.metalDark);
	kb.add(place(box(0.2, 0.5, 2.2), x + 0.4, 1.0, z), M.red);
	kb.add(place(box(0.21, 0.16, 2.21), x + 0.4, 1.0, z), M.white);
	collide(x, z, 0.8, 3.0);
}

/** Тележки вагона: put — в осях вагона, half — полудлина, axles — осей в тележке. */
function bogies(put, M, half, axles = 2) {
	for (const bx of [-half + 1.6, half - 1.6]) {
		put(box(axles * 1.2 + 1.0, 0.5, 2.0), M.metalDark, frame(bx, 0.55, 0));
		for (let i = 0; i < axles; i++) for (const wz of [-0.76, 0.76]) put(cyl(0.45, 0.45, 0.14, 12).rotateX(Z), M.rail, frame(bx + (i - (axles - 1) / 2) * 1.2, 0.45, wz));
	}
}

/** Полувагон 14 м: ржавые борта со стойками; load — гружён углём с горкой. Ось — X своих осей. */
function gondola(kb, M, collide, x, z, ry, load = true) {
	const L = 13.9, W = 3.1, put = putter(kb, frame(x, 0, z, ry));
	bogies(put, M, L / 2);
	put(box(L, 0.3, 2.8), M.metalDark, frame(0, 1.05, 0));
	put(box(L, 0.15, W - 0.1), M.metalRust, frame(0, 1.3, 0));
	for (const s of [-1, 1]) {
		put(box(L, 2.0, 0.1, 1.5), M.metalRust, frame(0, 2.35, s * W / 2));
		put(box(0.1, 2.0, W, 1.5), M.metalRust, frame(s * L / 2, 2.35, 0));
		put(box(L + 0.1, 0.12, 0.2), M.metalDark, frame(0, 3.38, s * W / 2));
		for (let i = 0; i < 7; i++) put(box(0.14, 2.0, 0.08), M.metalDark, frame(-L / 2 + 1 + i * (L - 2) / 6, 2.35, s * (W / 2 + 0.06)));
		put(box(0.3, 0.3, 2.6), M.metalDark, frame(s * (L / 2 + 0.2), 1.1, 0)); // буферный брус
	}
	if (load) {
		put(box(L - 0.3, 0.6, W - 0.25), M.tankBlack, frame(0, 3.0, 0));
		for (const dx of [-4.4, 0, 4.4]) put(new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Z).scale(2.3, 0.75, 1.35), M.tankBlack, frame(dx, 3.25, 0));
	}
	collide(x, z, L + 0.5, 3.1, ry);
}

/** Маневровый тепловоз 14 м: длинный капот, кабина у +X своих осей, две трёхосные тележки. */
function diesel(kb, M, collide, x, z, ry) {
	const L = 14, put = putter(kb, frame(x, 0, z, ry));
	bogies(put, M, L / 2 - 0.5, 3);
	put(box(L, 0.4, 2.9), M.metalDark, frame(0, 1.2, 0));
	put(box(L - 3.4, 2.3, 2.6, 1.5), M.green, frame(-1.7, 2.55, 0));
	put(box(L - 3.4, 0.22, 2.64), M.yellow, frame(-1.7, 2.0, 0));
	put(box(2.0, 1.2, 2.66), M.metalDark, frame(-5.6, 2.9, 0));
	put(box(0.6, 0.6, 0.6), M.metalDark, frame(-3.5, 4.0, 0));
	put(box(3.2, 3.0, 3.0, 1.5), M.green, frame(5.4, 2.9, 0));
	put(box(3.24, 0.9, 3.04), M.glass, frame(5.4, 3.55, 0));
	put(box(3.4, 0.2, 3.2), M.metalDark, frame(5.4, 4.5, 0));
	for (const ex of [-1, 1]) for (const bz of [-0.9, 0.9]) put(cyl(0.22, 0.4, 0.4, 10).rotateZ(Z), M.metalDark, frame(ex * (L / 2 + 0.2), 1.2, bz));
	collide(x, z, L + 0.6, 3.0, ry);
}

// ---------- Узкоколейка и вагонетки ----------

/** Узкоколейка (колея 0,6 м) от точки до точки: шпалы и два рельса. */
function narrowTrack(kb, M, x0, z0, x1, z1) {
	const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
	const n = Math.floor(len / 0.8);
	for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; kb.add(place(box(0.16, 0.08, 1.1), x0 + dx * t, 0.05, z0 + dz * t, ry), M.sleeper, { cast: false }); }
	for (const s of [-0.32, 0.32]) {
		const [px, pz] = local((x0 + x1) / 2, (z0 + z1) / 2, ry, 0, s);
		kb.add(place(box(len, 0.08, 0.05), px, 0.12, pz, ry), M.rail, { cast: false });
	}
}

/** Шахтная вагонетка: кузов на раме, четыре колеса; load — 'coal' или 'rock'; tip — лежит на боку. */
function minecart(kb, M, collide, x, z, ry, { load = null, tip = false, pitch = 0, y = 0 } = {}) {
	const put = putter(kb, frame(x, y + (tip ? 0.55 : 0), z, ry, tip ? 1.45 : 0, pitch));
	put(box(1.5, 0.75, 0.95, 1), M.metalRust, frame(0, 0.72, 0));
	for (const s of [-1, 1]) put(box(1.56, 0.07, 0.08), M.metalDark, frame(0, 1.1, s * 0.5));
	put(box(1.3, 0.14, 0.7), M.metalDark, frame(0, 0.3, 0));
	for (const wx of [-0.45, 0.45]) for (const wz of [-0.34, 0.34]) put(cyl(0.18, 0.18, 0.08, 10).rotateX(Z), M.metalDark, frame(wx, 0.18, wz));
	if (load) put(new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Z).scale(0.7, 0.32, 0.44), load === 'coal' ? M.tankBlack : M.ballast, frame(0, 1.06, 0));
	if (!y) collide(x, z, tip ? 1.8 : 1.6, tip ? 1.6 : 1.05, ry);
}

// ---------- Техника ----------

/** БелАЗ: рама, капот с площадкой, кабина слева, большие колёса (задние сдвоены), кузов с козырьком. Перед — +X. */
function dumpTruck(kb, M, collide, x, z, ry, { raised = false, load = true } = {}) {
	const put = putter(kb, frame(x, 0, z, ry));
	put(box(7.6, 0.6, 1.6), M.metalDark, frame(0, 1.25, 0));
	for (const s of [-1, 1]) {
		put(cyl(0.95, 0.95, 0.7, 14).rotateX(Z), M.tire, frame(2.6, 0.95, s * 1.45));
		put(cyl(0.45, 0.45, 0.72, 10).rotateX(Z), M.yellow, frame(2.6, 0.95, s * 1.46));
		for (const k of [1.2, 1.9]) put(cyl(0.95, 0.95, 0.62, 14).rotateX(Z), M.tire, frame(-2.0, 0.95, s * k));
	}
	put(box(1.8, 1.6, 2.6, 1.5), M.yellow, frame(3.1, 2.2, 0)); // капот
	put(box(0.08, 1.1, 1.8), M.metalDark, frame(4.02, 2.0, 0)); // решётка
	put(box(1.4, 0.14, 3.7), M.yellow, frame(3.0, 3.07, 0)); // площадка
	put(box(1.5, 1.5, 1.3, 1.5), M.yellow, frame(2.7, 3.9, -1.05)); // кабина
	put(box(0.05, 0.7, 1.1), M.glass, frame(3.47, 4.1, -1.05));
	put(box(0.9, 0.6, 0.05), M.glass, frame(2.7, 4.1, -1.72));
	for (let y = 0.8; y < 3.0; y += 0.45) put(box(0.04, 0.04, 0.5), M.metalDark, frame(3.9, y, 1.6)); // лесенка
	// кузов: шарнир сзади, поднят — опрокинут на 40°
	const H = frame(-3.6, 1.55, 0, 0, 0, raised ? 0.5 : 0);
	put(box(6.6, 0.25, 3.6), M.metalRust, H.clone().multiply(frame(3.3, 0.12, 0)));
	for (const s of [-1, 1]) put(box(6.6, 1.5, 0.14, 1.5), M.metalRust, H.clone().multiply(frame(3.3, 0.85, s * 1.75)));
	put(box(0.16, 2.0, 3.6), M.metalRust, H.clone().multiply(frame(6.55, 1.1, 0)));
	put(box(1.5, 0.12, 3.7), M.metalRust, H.clone().multiply(frame(7.3, 2.05, 0)));
	if (load && !raised) put(new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Z).scale(3.1, 0.9, 1.6), M.tankBlack, H.clone().multiply(frame(3.2, 1.1, 0)));
	if (raised) beam(kb, M.metalDark, [-1.0, 1.4, 0], [-0.4, 3.6, 0], 0.25, 0.25, frame(x, 0, z, ry)); // гидроцилиндр
	const [cx, cz] = local(x, z, ry, 0.3, 0);
	collide(cx, cz, 8.6, 3.9, ry);
}

/** Экскаватор-мехлопата: гусеницы, поворотная платформа с кузовом, кабина, стрела, рукоять и ковш. Стрела — к +X. */
function excavator(kb, M, collide, x, z, ry) {
	const F = frame(x, 0, z, ry), put = putter(kb, F);
	for (const s of [-1, 1]) {
		put(box(6.0, 1.2, 1.3, 1), M.metalDark, frame(0, 0.6, s * 2.0));
		for (const e of [-3, 3]) put(cyl(0.6, 0.6, 1.32, 10).rotateX(Z), M.metalDark, frame(e, 0.6, s * 2.0));
	}
	put(cyl(1.6, 1.6, 0.6, 14), M.metalDark, frame(0, 1.5, 0));
	put(box(6.0, 3.0, 4.4, 1.5), M.yellow, frame(-0.8, 3.3, 0));
	put(box(1.4, 1.8, 4.4), M.metalDark, frame(-4.4, 2.7, 0)); // противовес
	put(box(2.0, 2.0, 1.6, 1.5), M.yellow, frame(1.4, 5.8, 1.3)); // кабина
	put(box(0.05, 0.9, 1.3), M.glass, frame(2.42, 6.0, 1.3));
	put(box(1.2, 0.8, 0.05), M.glass, frame(1.4, 6.0, 2.11));
	for (let i = 0; i < 4; i++) put(box(0.08, 0.6, 0.6), M.metalDark, frame(-3.2 + i * 0.8, 4.0, -2.22)); // жалюзи
	// двуногая стойка, стрела, рукоять, ковш, канаты
	for (const s of [-1, 1]) beam(kb, M.metalDark, [-2.4, 4.8, s * 1.4], [-0.8, 8.0, 0], 0.22, 0.22, F);
	beam(kb, M.yellow, [1.6, 3.4, 0], [7.4, 10.4, 0], 0.9, 0.8, F);
	put(cyl(0.7, 0.7, 0.5, 14).rotateX(Z), M.metalDark, frame(7.5, 10.5, 0));
	beam(kb, M.metalDark, [-0.8, 8.0, 0], [7.4, 10.6, 0], 0.08, 0.08, F);
	beam(kb, M.yellow, [3.6, 6.0, 0], [8.4, 2.6, 0], 0.5, 0.6, F);
	put(box(1.8, 1.7, 2.0), M.metalRust, frame(8.8, 1.2, 0, 0, 0, -0.3));
	for (let i = 0; i < 4; i++) put(box(0.35, 0.18, 0.18), M.metalDark, frame(9.8, 0.55, -0.75 + i * 0.5, 0, 0, -0.3));
	beam(kb, M.metalDark, [7.6, 10.0, 0.3], [8.8, 2.1, 0.3], 0.07, 0.07, F);
	beam(kb, M.metalDark, [7.6, 10.0, -0.3], [8.8, 2.1, -0.3], 0.07, 0.07, F);
	const [bx, bz] = local(x, z, ry, -0.6, 0), [kx, kz] = local(x, z, ry, 8.9, 0);
	collide(bx, bz, 7.4, 5.4, ry);
	collide(kx, kz, 2.2, 2.2, ry);
}

/** Бульдозер: гусеницы, моторный отсек, кабина, отвал. Отвал — к +X. */
function bulldozer(kb, M, collide, x, z, ry) {
	const F = frame(x, 0, z, ry), put = putter(kb, F);
	for (const s of [-1, 1]) put(box(3.8, 0.9, 0.7, 1), M.metalDark, frame(0, 0.45, s * 1.2));
	put(box(2.8, 1.3, 1.8, 1.5), M.yellow, frame(0.5, 1.55, 0));
	put(box(1.5, 1.5, 1.7, 1.5), M.yellow, frame(-0.9, 2.95, 0));
	put(box(1.3, 0.7, 1.72), M.glass, frame(-0.9, 3.1, 0));
	put(box(0.12, 0.8, 0.12), M.metalDark, frame(1.2, 2.6, 0.4));
	put(box(0.3, 1.2, 3.4, 1), M.metalRust, frame(2.7, 0.65, 0, 0, 0, 0.12));
	for (const s of [-1, 1]) beam(kb, M.metalDark, [0.2, 0.7, s * 1.1], [2.6, 0.7, s * 1.1], 0.2, 0.2, F);
	put(box(0.6, 0.5, 1.4), M.metalDark, frame(-2.1, 0.7, 0));
	const [cx, cz] = local(x, z, ry, 0.3, 0);
	collide(cx, cz, 5.4, 3.5, ry);
}

// ---------- Отвалы и склады ----------

/**
 * Холм-конус rx×rz высотой h: усечённая неровная макушка, промоины от дождей, бугры по низу; развёртка сверху,
 * швы сшиты — склоны гладкие. Терриконы, кучи угля и породы.
 */
function mound(kb, mat, x, z, rx, rz, h, seed, { seg = 40, rows = 10, top = 0.12 } = {}) {
	const g = new THREE.CylinderGeometry(top, 1, h, seg, rows);
	g.deleteAttribute('normal');
	const p = g.attributes.position, ph = seed * 1.7, bump = Math.min(0.5, h * 0.06);
	for (let i = 0; i < p.count; i++) {
		const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), k = py / h + 0.5, a = Math.atan2(pz, px);
		const gully = Math.pow(Math.abs(Math.sin(a * 9 + ph)), 6) * 0.12 * Math.sin(Math.PI * Math.min(1, k * 1.2));
		const n = 1 + 0.06 * Math.sin(a * 3 + ph) + 0.05 * Math.sin(a * 7 + ph * 2) * (1 - k) - gully;
		p.setXYZ(i, px * n * rx, py + (k > 0.95 ? Math.sin(a * 4 + ph) * bump : 0), pz * n * rz);
	}
	const uv = new Float32Array(p.count * 2);
	for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 5; uv[i * 2 + 1] = p.getZ(i) / 5; }
	g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	const m = mergeVertices(g);
	m.computeVertexNormals();
	kb.add(m.translate(x, h / 2 - Math.min(0.3, h * 0.05), z), mat, { cast: false });
}

/** Террикон — непроходим: коллайдер полосами по всему основанию. */
function terricon(kb, M, collide, x, z, r, h, seed) {
	mound(kb, M.ballast, x, z, r, r, h, seed);
	roundCollide(collide, x, z, r * 0.98, r * 0.98, 12);
}

/** Куча угля или породы; коллайдер — по основанию, пологие края у земли проходимы. */
function heap(kb, mat, collide, x, z, rx, rz, h, seed) {
	mound(kb, mat, x, z, rx, rz, h, seed, { seg: 20, rows: 4, top: 0.18 });
	roundCollide(collide, x, z, rx * 0.84, rz * 0.84, 4);
}

/** Земляной вал (обваловка) вдоль X своих осей: трапеция w×h в сечении, длина len; коллайдер — по низу. */
function berm(kb, mat, collide, x, z, len, w, h, ry = 0) {
	const sh = new THREE.Shape(), run = Math.min(w * 0.4, h * 1.1);
	sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2 - run, h); sh.lineTo(-w / 2 + run, h); sh.closePath();
	const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2).rotateY(Z);
	const uv = g.attributes.uv;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
	kb.add(place(g, x, -0.05, z, ry), mat, { cast: false });
	collide(x, z, len, w * 0.8, ry);
}

/** Штабель крепёжного леса: брёвна пирамидой вдоль X. */
function timberStack(kb, M, collide, x, z, ry) {
	const put = putter(kb, frame(x, 0, z, ry));
	for (const [n, y] of [[5, 0.25], [4, 0.68], [3, 1.11]]) {
		for (let i = 0; i < n; i++) put(cyl(0.24, 0.24, 4.2, 8).rotateZ(Z), i % 2 ? M.bark : M.wood, frame(0, y, (i - (n - 1) / 2) * 0.48));
	}
	for (const e of [-1.6, 1.6]) put(box(0.12, 0.2, 2.6), M.woodGrey, frame(e, 0.08, 0));
	collide(x, z, 4.4, 2.6, ry);
}

/** Вентиляторная главного проветривания: кирпичная будка, канал к стволу, наклонный диффузор. */
function fanHouse(kb, M, collide, x, z) {
	kb.add(place(box(8, 4.5, 6, 1.5), x, 2.25, z), M.brick);
	kb.add(place(box(8.5, 0.3, 6.5, 3), x, 4.65, z), M.roofTar);
	kb.add(place(box(1.0, 2.0, 0.08), x - 2.5, 1.0, z + 3.04), M.metalOlive);
	kb.add(place(T.windowUV(new THREE.PlaneGeometry(1.1, 1.0), 1), x + 1.5, 2.8, z + 3.02), M.window);
	kb.add(place(box(5, 2.2, 2.2, 1.5), x - 6.5, 1.1, z), M.concreteDark); // канал к стволу
	kb.add(place(box(3.2, 3.2, 3.2, 1.5), x - 10.5, 1.6, z), M.brick); // оголовок вентиляционного ствола
	kb.add(place(box(3.6, 0.3, 3.6), x - 10.5, 3.35, z), M.concreteDark);
	kb.add(place(box(7, 2.6, 2.6, 1.5), x + 6.5, 3.2, z, 0, 0, 0.6), M.metalRust); // диффузор
	kb.add(place(box(0.3, 3.0, 0.3), x + 8.4, 1.5, z), M.metalDark);
	collide(x, z, 8, 6);
	collide(x - 8.5, z, 7.2, 3.2);
	collide(x + 6.5, z, 4.2, 2.6);
}

export default {
	id: 'shahta',
	seed: 7505,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// угольная пыль: грунт, щебень и трава здесь темнее (материалы у локации свои)
		M.dirt.color.setRGB(0.66, 0.64, 0.62);
		M.ballast.color.setRGB(0.7, 0.68, 0.66);
		M.grass.color.setRGB(0.82, 0.84, 0.8);
		const flesh = new THREE.MeshStandardMaterial({ color: 0x4a1e1c, roughness: 0.38, metalness: 0.05 });

		// ---------- Покрытия: грунт, угольная пыль, дороги, площадки ----------
		ground(168, 154, 6, -13, M.dirt, 6, 0.012); // территория шахты и отвалы
		ground(70, 25, 55, -0.5, M.roofTar, 4, 0.014); // угольный склад
		ground(140, 15, 20, 19, M.roofTar, 4, 0.0142); // пути
		ground(36, 30, -30, 10, M.roofTar, 4, 0.0141); // у котельной
		ground(112, 7, -34, 0, M.asphalt, 5, 0.02); // с запада (Аэродром) до угольного склада
		ground(7, 108, 0, 36, M.asphalt, 5, 0.021); // с юга (Тюрьма) к стволу
		ground(26, 26, SH[0], SH[1], M.concrete, 4, 0.018); // площадка ствола
		ground(34, 10, 34, -16, M.concrete, 4, 0.0182); // перед фабрикой
		ground(30, 4, ABK[0], -4.5, M.asphalt, 5, 0.0195); // у входа в АБК
		ground(50, 5, 29, 38, M.dirt, 4, 0.016); // к складу ВМ
		ground(5, 10, 54, 43, M.dirt, 4, 0.0161);
		ground(26, 9, -62, 12, M.concrete, 4, 0.017); // двор котельной
		ground(14, 8, -39, 53, M.concrete, 4, 0.017); // у ворот мастерских
		ground(22, 6, -64, 58, M.concrete, 4, 0.0172); // у гаражей
		ground(12, 10, 0, -48, M.dirt, 4, 0.0165); // к подъёмной машине
		const onRoad = (x, z, m = 0) => (Math.abs(z) < 3.5 + m && x < 22) || (Math.abs(x) < 3.5 + m && z > -18)
			|| (Math.abs(x - SH[0]) < 13 + m && z > SH[1] - 13 - m && z < SH[1] + 13 + m)
			|| (x > 18 - m && z > -14 - m && z < 26 + m) || (x > -54 - m && x < 18 && Math.abs(z - 19) < 5.5 + m)
			|| (Math.abs(x - 34) < 17 + m && Math.abs(z + 16) < 5 + m) || (Math.abs(z - 38) < 2.5 + m && x > 3 && x < 55)
			|| (Math.abs(x + 62) < 13 + m && Math.abs(z - 12) < 4.5 + m) || (Math.abs(x + 39) < 7 + m && Math.abs(z - 53) < 4 + m);

		// ---------- Забор шахты: запад и юг, главные ворота с КПП, западные ворота, пролом ----------
		const wires = [];
		const fence = (x0, z0, x1, z1) => { concreteFence(batch, M, collide, root, x0, z0, x1, z1, { wire: false }); wires.push([x0, z0, x1, z1]); };
		fence(FW, -40, FW, -4.5); fence(FW, 4.5, FW, FS);
		fence(FW, FS, -40, FS); fence(-36, FS, -4.5, FS); fence(4.5, FS, FE, FS);
		for (const [x, z] of [[FW, -4.5], [FW, 4.5], [-4.5, FS], [4.5, FS]]) { batch.add(place(box(0.7, 3.2, 0.7), x, 1.6, z), M.concreteDark); collide(x, z, 0.8, 0.8); }
		for (const s of [-1, 1]) batch.add(place(box(4.0, 2.2, 0.08), s * 6.3, 1.15, FS - 1.8, s * 0.75), M.metalOlive); // распахнутые створки
		batch.add(place(box(4.2, 2.2, 0.08), FW + 1.6, 1.15, -6.5, 1.2), M.metalOlive);
		batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), -38, 0.12, FS + 1.4, 0.2), M.concrete); // поваленная плита
		billboard(batch, M, root, collide, 0, FS, 0, 'ШАХТА «ЦЕНТРАЛЬНАЯ»', { w: 9, h: 1.1, y: 4.4, bg: '#2a2c26', fg: '#e8dcae' });
		barrier(batch, M, collide, -3.8, FS - 1, 0, 7.5, true);
		{
			// будка охраны у ворот
			const bx = 8, bz = FS - 4;
			batch.add(place(box(3, 2.6, 2.6, 1.5), bx, 1.3, bz), M.whiteBrick);
			batch.add(place(box(3.4, 0.2, 3.0, 2), bx, 2.7, bz), M.roofTar);
			batch.add(place(T.windowUV(new THREE.PlaneGeometry(1.4, 1.0), 1).rotateY(-Z), bx - 1.52, 1.6, bz), M.window);
			batch.add(place(box(0.9, 2.0, 0.06), bx + 0.6, 1.0, bz - 1.33), M.metalRust);
			collide(bx, bz, 3, 2.6);
		}

		// ---------- Копёр, ствол, огороженная площадка, подъёмная машина ----------
		// копёр загораживает героя у ствола и под подкосом — тогда полупрозрачный
		occluder('Headframe', (kb) => headframe(kb, root, M, collide, SH[0], SH[1]), { cx: SH[0], cz: SH[1], ry: 0, hx: 4.0, hz: 4.0, top: TH + 5.5 }, 0.25);
		shaftCollar(batch, M, collide, SH[0], SH[1]);
		{
			const x0 = SH[0] - 13, x1 = SH[0] + 13, z0 = SH[1] - 13, z1 = SH[1] + 13;
			pipeFence(batch, M, collide, x0, z1, x1, z1, [[9.5, 16.5]]); // юг: ворота к дороге
			pipeFence(batch, M, collide, x0, z0, x1, z0, [[11.5, 14.5]]); // север: калитка к подъёмной машине
			pipeFence(batch, M, collide, x0, z0, x0, z1, [[9.5, 16.5]]); // запад: проём узкоколейки
			pipeFence(batch, M, collide, x1, z0, x1, z1, [[3, 7]]); // восток: калитка к фабрике
			billboard(batch, M, root, collide, SH[0] + 7, z1 + 0.6, 0, 'СТВОЛ № 1 · ПОСТОРОННИМ ВХОД ЗАПРЕЩЁН', { w: 4.6, h: 0.8, y: 1.5, bg: '#e8dcc0', fg: '#a01a10' });
		}
		buildings.push(buildHoist(bctx, { name: 'Hoist', cx: HOIST[0], cz: HOIST[1] }));
		// логово элиты у ствола: бугры споровой массы у ног копра и у устья, кости
		for (const [i, [x, z]] of [[3.6, -25.2], [-3.4, -25.6], [4.2, -34.4], [-4.0, -34.0], [2.6, -22.8], [-6.2, -29.5], [6.4, -27.4], [-1.8, -36.6]].entries()) {
			const s = 0.45 + (i % 3) * 0.22;
			batch.add(place(blob(s, 1, 31 + i).scale(1.3, 0.5, 1), SH[0] + x, s * 0.12, z, i * 0.9), flesh, { cast: false });
		}
		for (let i = 0; i < 10; i++) {
			const a = i * 2.1, d = 3.6 + (i % 4) * 0.9;
			batch.add(place(cyl(0.04, 0.05, 0.5 + (i % 3) * 0.2, 6).rotateZ(Z), SH[0] + Math.cos(a) * d, 0.05, SH[1] + Math.sin(a) * d, a * 1.7), M.concrete, { cast: false });
		}

		// ---------- Узкоколейка к террикону, вагонетки, наклонный путь со скипом ----------
		{
			const [tx, tz, tr, th] = TER[0];
			const dir = [SH[0] - 24 - tx, SH[1] - tz], dl = Math.hypot(...dir), ux = dir[0] / dl, uz = dir[1] / dl;
			const foot = (d) => [tx + ux * d, tz + uz * d];
			const [fx, fz] = foot(tr + 0.6);
			narrowTrack(batch, M, SH[0] - 3, SH[1], SH[0] - 24, SH[1]);
			narrowTrack(batch, M, SH[0] - 24, SH[1], fx, fz);
			minecart(batch, M, collide, -7.5, SH[1], 0, { load: 'coal' });
			minecart(batch, M, collide, -9.3, SH[1], 0, { load: 'coal' });
			minecart(batch, M, collide, -18, SH[1], 0, { load: 'rock' });
			minecart(batch, M, collide, -20.5, SH[1] + 1.6, 0.4, { tip: true });
			const ry = Math.atan2(-uz, ux);
			for (const [d, opt] of [[8, { load: 'rock' }], [11, { tip: true }]]) {
				const [cx, cz] = [SH[0] - 24 + (fx - SH[0] + 24) * d / 30, SH[1] + (fz - SH[1]) * d / 30];
				minecart(batch, M, collide, cx, cz, ry + (opt.tip ? 0.5 : 0), opt);
			}
			// наклонный путь (скиповой подъёмник) по склону к макушке: настил на эстакаде, скип наверху, лебёдка у подножия
			const dTop = 6, yTop = th * (1 - dTop / tr) + 0.7, [ex, ez] = foot(dTop), y0 = 0.3;
			const len = Math.hypot(fx - ex, fz - ez), pitch = Math.atan2(yTop - y0, len), ryUp = Math.atan2(-(ez - fz), ex - fx);
			const F = frame((fx + ex) / 2, (y0 + yTop) / 2, (fz + ez) / 2, ryUp, 0, pitch);
			const L = Math.hypot(len, yTop - y0);
			batch.add(box(L, 0.3, 1.8).applyMatrix4(F), M.metalDark);
			for (const s of [-0.32, 0.32]) batch.add(box(L, 0.1, 0.06).applyMatrix4(frame(0, 0.2, s).premultiply(F)), M.rail);
			for (const s of [-0.85, 0.85]) batch.add(box(L, 0.06, 0.06).applyMatrix4(frame(0, 1.0, s).premultiply(F)), M.hazard);
			const sk = new THREE.Vector3(L / 2 - 2, 0.15, 0).applyMatrix4(F);
			minecart(batch, M, collide, sk.x, sk.z, ryUp, { load: 'rock', pitch, y: sk.y - 0.1 });
			collide(fx, fz, 2.0, 2.0, ryUp); // низ настила
			const [wx, wz] = foot(tr + 3.2);
			batch.add(place(box(2.6, 2.2, 2.4, 1.5), wx, 1.1, wz, ryUp), M.brick);
			batch.add(place(box(2.9, 0.15, 2.7), wx, 2.27, wz, ryUp), M.roofMetal);
			batch.add(place(cyl(0.5, 0.5, 1.4, 12).rotateX(Z), wx, 1.3, wz, ryUp + Z), M.metalDark);
			collide(wx, wz, 2.8, 2.8, ryUp);
		}

		// ---------- Терриконы у северного края; глыбы породы у подножия ----------
		for (const [x, z, r, h, s] of TER) terricon(batch, M, collide, x, z, r, h, s);
		for (const [i, [x, z, r]] of [[-34, -46, 1.2], [-30, -52, 0.8], [-40, -40, 1.0], [34, -50, 1.1], [36, -44, 0.7], [-74, -36, 1.3], [80, -44, 1.2], [44, -46, 0.9]].entries()) {
			batch.add(place(blob(r, 1, 300 + i), x, r * 0.35, z, i), i % 2 ? M.concreteDark : M.ballast);
			collide(x, z, r * 1.6, r * 1.6);
		}
		bulldozer(batch, M, collide, -26, -50, 2.4);
		heap(batch, M.ballast, collide, -31, -55, 3.2, 2.4, 2.0, 41); // порода, сдвинутая бульдозером

		// ---------- АБК, крытый переход на копёр, автобус у входа ----------
		buildings.push(buildABK(bctx, { name: 'ABK', cx: ABK[0], cz: ABK[1] }));
		{
			const a = [ABK[0] + 11.2, 5.4, ABK[1] - 6.3], b = [SH[0] - 3.4, 5.4, SH[1] + 1.5];
			const dx = b[0] - a[0], dz = b[2] - a[2];
			occluder('Passage', (kb) => gallery(kb, M, collide, a, b, [0.5]), { cx: (a[0] + b[0]) / 2, cz: (a[2] + b[2]) / 2, ry: Math.atan2(-dz, dx), hx: Math.hypot(dx, dz) / 2, hz: 1.6, top: 6.8 }, 0.3);
		}
		bus(batch, M, root, -52, -7.5, Z + 0.05);
		collide(-52, -7.5, 2.7, 7.9, Z + 0.05);
		addCar(batch, M, root, -46, -26, 0.4, 0x6a6a5a, { crashed: true });
		collide(-46, -26, 4.3, 1.9, 0.4);

		// ---------- Лесной склад: штабели крепёжного леса ----------
		for (const [x, z, r] of [[-62, -16, 0], [-62, -21, 0.05], [-55, -26, -0.1], [-68, -28, 0.15]]) timberStack(batch, M, collide, x, z, r);

		// ---------- Обогатительная фабрика, галереи, бункер погрузки, сгуститель ----------
		buildings.push(buildFactory(bctx, { name: 'Factory', cx: FAC[0], cz: FAC[1] }));
		gallery(batch, M, collide, [SH[0] + 6.6, 17.2, SH[1]], [FAC[0] - 15, 13.2, FAC[1] - 1.5], [0.4, 0.75]);
		{
			const a = [FAC[0] + 15.4, 10.6, FAC[1] + 4], b = [BUNKER[0] - 0.5, 12.0, BUNKER[1] - 3.6];
			const dx = b[0] - a[0], dz = b[2] - a[2];
			occluder('Gallery', (kb) => gallery(kb, M, collide, a, b, [0.3, 0.55, 0.8]), { cx: (a[0] + b[0]) / 2, cz: (a[2] + b[2]) / 2, ry: Math.atan2(-dz, dx), hx: Math.hypot(dx, dz) / 2, hz: 1.6, top: 13.8 }, 0.3);
		}
		occluder('Bunker', (kb) => loadBunker(kb, M, collide, BUNKER[0], BUNKER[1]), { cx: BUNKER[0], cz: BUNKER[1], ry: 0, hx: 5.0, hz: 3.9, top: 13.6 }, 0.3);
		thickener(batch, M, collide, ...THICK);
		hazardBarrels(batch, M, collide, 58, -18, rnd, 5);
		for (const [x, z, r] of [[22, -12, 0.1], [22.5, -19, 1.5], [57, -14, 0.3]]) {
			beginProp('block', x, z, r);
			batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark);
			endProp();
			collide(x, z, 1.8, 0.9, r);
		}

		// ---------- Угольный склад: кучи, экскаватор грузит БелАЗ ----------
		heap(batch, M.tankBlack, collide, 32, 2, 6, 4.5, 4.5, 11);
		heap(batch, M.tankBlack, collide, 46, -4, 6.5, 5, 5.5, 12);
		heap(batch, M.tankBlack, collide, 74, -2, 7, 5.5, 5, 13);
		heap(batch, M.tankBlack, collide, 84, 8, 4, 3, 3, 14);
		heap(batch, M.tankBlack, collide, -50, 8.5, 3, 2.5, 2.2, 15); // у котельной
		excavator(batch, M, collide, 41, 9, 2.52);
		dumpTruck(batch, M, collide, 51, 9.5, 0);

		// ---------- Пути: полувагоны, тепловоз, переезд, котельная у тупика ----------
		track(batch, M, -52, 88, TA, [[-4.5, 4.5]]);
		track(batch, M, -32, 88, TB, [[-4.5, 4.5]]);
		bufferStop(batch, M, collide, -52.6, TA);
		bufferStop(batch, M, collide, -32.6, TB);
		gondola(batch, M, collide, BUNKER[0], TA, 0, true);
		gondola(batch, M, collide, 78.2, TA, 0, true);
		gondola(batch, M, collide, -40, TA, 0, false);
		gondola(batch, M, collide, 30, TA, 0.02, false);
		diesel(batch, M, collide, 14, TB, Math.PI);
		gondola(batch, M, collide, 29.2, TB, 0, true);
		gondola(batch, M, collide, 47.5, TB, 0, true);
		gondola(batch, M, collide, 62.1, TB, 0, true);
		gondola(batch, M, collide, 80, TB, 0, false);
		gondola(batch, M, collide, -20, TB, 0, true);
		barrier(batch, M, collide, -5.2, TA - 3.2, 0, 4.5, true);
		barrier(batch, M, collide, 5.2, TB + 3.2, Math.PI, 4.5, true);
		{
			// котельная: кирпичный корпус, труба
			const cx = -62, cz = 12, W = 12, D = 9, H = 7.5;
			occluder('Boiler', (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.brick);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (const x of [-3.5, 0, 3.5]) kb.add(place(T.windowUV(new THREE.PlaneGeometry(1.4, 2.0), x === 0 ? 1 : 0), cx + x, 4.4, cz + D / 2 + 0.01), M.window);
				kb.add(place(box(2.4, 2.6, 0.1), cx + 4.2, 1.3, cz + D / 2 + 0.05), M.metalRust);
				kb.add(place(box(2.4, 2.6, 0.1), cx + W / 2 + 0.05, 1.3, cz - 1.5, Z), M.metalDark);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.6, top: H + 0.4 }, 0.25);
			collide(cx, cz, W, D);
			occluder('Chimney', (kb) => chimney(kb, M, collide, -73, 22, 30), { cx: -73, cz: 22, ry: 0, hx: 2.1, hz: 2.1, top: 32.5 }, 0.2);
		}

		// ---------- Юго-запад: мастерские, гаражи, водонапорная башня, техника ----------
		buildings.push(buildWorkshop(bctx, { name: 'Workshop', cx: -42, cz: 42, ry: Math.PI }));
		occluder('WaterTower', (kb) => waterTower(kb, M, collide, -66, 34), { cx: -66, cz: 34, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);
		{
			const gx = -64, gz = 52, n = 5; // ворота — на юг
			occluder('Garages', (kb) => {
				kb.add(place(box(4 * n, 3, 6, 1.5), gx, 1.5, gz), M.brick);
				kb.add(place(box(4 * n + 0.6, 0.25, 6.6, 3), gx, 3.12, gz), M.roofTar);
				for (let i = 0; i < n; i++) {
					const x = gx - 2 * n + 2 + i * 4;
					if (i === 1) {
						kb.add(place(planeXZ(3, 2.4, 1).rotateX(Z), x, 1.2, gz + 3.02), M.tire);
						for (const s of [-1, 1]) kb.add(place(box(1.5, 2.3, 0.06), x + s * 1.9, 1.15, gz + 3.7, -s * 1.2), M.metalRust);
					} else kb.add(place(box(3, 2.4, 0.08), x, 1.2, gz + 3.04), M.metalOlive);
				}
			}, { cx: gx, cz: gz, ry: 0, hx: 2 * n + 0.3, hz: 3.3, top: 3.3 }, 0.3);
			collide(gx, gz, 4 * n, 6);
		}
		dumpTruck(batch, M, collide, -22, 52, Z - 0.1, { raised: true });
		heap(batch, M.ballast, collide, -22.6, 60.6, 3, 1.6, 1.4, 21);
		addCar(batch, M, root, 14, 7, 2.8, 0x3a4a2a, { burned: true });
		collide(14, 7, 4.3, 1.9, 2.8);
		for (const [x, z, r] of [[-16, 34, 0.1], [-16, 40, 0.05], [-22, 30, 1.5]]) timberStack(batch, M, collide, x, z, r);
		hazardBarrels(batch, M, collide, -26, 37, rnd, 4);

		// ---------- Шламоотстойник ----------
		pond(batch, root, M, collide, 24, 50, 10, 6, rnd);

		// ---------- Вентиляторная главного проветривания (северо-восток) ----------
		fanHouse(batch, M, collide, 24, -58);

		// ---------- Склад ВМ за своим забором: КПП, хранилище в обваловке, склад СИ, молниеотводы ----------
		{
			const { x0, x1, z0, z1 } = VM;
			const vfence = (a, b, c, d) => { concreteFence(batch, M, collide, root, a, b, c, d, { wire: false }); wires.push([a, b, c, d]); };
			vfence(x0, z0, 51, z0); vfence(63, z0, x1, z0); vfence(x0, z0, x0, z1); vfence(x1, z0, x1, z1); vfence(x0, z1, x1, z1);
			batch.add(place(box(0.7, 3.2, 0.7), 51, 1.6, z0), M.concreteDark); collide(51, z0, 0.8, 0.8);
			barrier(batch, M, collide, 51.3, z0 - 0.6, 0, 5.6, false);
			buildings.push(buildCheckpoint(bctx, { name: 'VMGate', cx: 60, cz: z0, ry: 0 }));
			billboard(batch, M, root, collide, 44, z0 - 3, 0, 'ОПАСНО! СКЛАД ВМ · ВХОД ВОСПРЕЩЁН', { w: 5.4, h: 1.1, y: 1.9, bg: '#e8dcc0', fg: '#a01a10' });
			buildings.push(buildVMStore(bctx, { name: 'VMStore', cx: 66, cz: 66 }));
			buildings.push(buildDetonators(bctx, { name: 'Detonators', cx: 50.5, cz: 75 }));
			// обваловка хранилища с трёх сторон (север — вход)
			berm(batch, M.dirt, collide, 66, 66 + 4.5 + 2.4, 22, 4.2, 2.2);
			berm(batch, M.dirt, collide, 66 - 8 - 2.4, 65.4, 13, 4.2, 2.2, Z);
			berm(batch, M.dirt, collide, 66 + 8 + 2.4, 65.4, 13, 4.2, 2.2, Z);
			for (const [x, z] of [[57.5, 57], [76.5, 76.5]]) {
				batch.add(place(box(0.25, 16, 0.25), x, 8, z), M.metalDark);
				batch.add(place(box(1.2, 0.5, 1.2), x, 0.25, z), M.concreteDark);
				collide(x, z, 1.2, 1.2);
			}
			watchTower(batch, M, collide, x1 - 2.5, z0 + 2.5);
			sandbags(batch, M, collide, 56, 54, 3.4, 0);
			hazardBarrels(batch, M, collide, 49, 62, rnd, 4);
			for (const [x, z, r] of [[70, 57.5, 0.2], [73, 58.6, -0.1]]) {
				beginProp('ammo', x, z, r);
				batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
				batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
				endProp();
				collide(x, z, 1.1, 0.9, r);
			}
		}
		// колючая проволока по заборам — одним набором линий
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

		return {
			start: [0, 82.5, Math.PI],
			exits: [
				{ to: 'aerodrom', x0: -90, x1: -85.2, z0: -3, z1: 3, spawn: [-82.5, 0, Z], sign: [-84, 4.6, '← Аэродром'] },
				{ to: 'tyurma', x0: -3, x1: 3, z0: 85.2, z1: 90, spawn: [0, 82.5, Math.PI], sign: [4.6, 84, '↓ Тюрьма'] },
			],
			// две элиты — у ствола под копром и за ним, у подкоса; руберы — у фабрики, на угольном складе,
			// у сгустителя, у террикона и на складе ВМ; топтуны водят стаи по путям, у АБК, котельной и мастерских
			groups: [
				{ at: [SH[0], SH[1] + 4.5], r: 4, elites: 1, rubers: 1, runners: 3 },
				{ at: [SH[0] - 4, SH[1] - 10], r: 4, elites: 1, runners: 2 },
				{ at: [SH[0] + 8, SH[1] + 9], r: 4, stompers: 1, runners: 2 },
				{ at: [HOIST[0] - 4, HOIST[1] + 8], r: 4, rubers: 1, runners: 1 },
				{ at: [34, -15], r: 5, rubers: 1, runners: 2 },
				{ at: [44, -26], r: 4, rubers: 1, runners: 1 },
				{ at: [56, 2], r: 5, rubers: 1, runners: 2 },
				{ at: [66, 9], r: 4, stompers: 1, runners: 2 },
				{ at: [84, -14], r: 4, rubers: 1, runners: 1 },
				{ at: [62, -42], r: 5, stompers: 1, runners: 2 },
				{ at: [22, 12], r: 5, runners: 3 },
				{ at: [-20, 12], r: 5, stompers: 1, runners: 2 },
				{ at: [40, 27], r: 5, runners: 2 },
				{ at: [ABK[0], ABK[1]], r: 4, stompers: 1, runners: 2 },
				{ at: [-20, -26], r: 5, runners: 3 },
				{ at: [-34, -40], r: 5, rubers: 1, runners: 2 },
				{ at: [30, -48], r: 5, stompers: 1, runners: 1 },
				{ at: [-14, -54], r: 5, runners: 2 },
				{ at: [-52, 24], r: 5, stompers: 1, runners: 1 },
				{ at: [-64, -6], r: 5, runners: 2 },
				{ at: [-42, 42], r: 5, stompers: 1, runners: 2 },
				{ at: [-56, 49], r: 4, runners: 2 },
				{ at: [8, 50], r: 5, stompers: 1, runners: 2 },
				{ at: [34, 40], r: 5, runners: 2 },
				{ at: [-24, 74], r: 6, runners: 2 },
				{ at: [22, 76], r: 6, stompers: 1, runners: 1 },
				{ at: [62, 52], r: 4, rubers: 1, runners: 2 },
				{ at: [72, 38], r: 5, stompers: 1, runners: 2 },
				{ at: [-56, 2], r: 6, runners: 2 },
				{ at: [-82, -24], r: 4, runners: 1, stompers: 1 },
				{ at: [82, 42], r: 4, runners: 2 },
				{ at: [8, -4], r: 5, runners: 2 },
			],
			onRoad,
			// горит сгоревшая машина на перекрёстке, костёр у логова, бочка у главных ворот, тлеет у котельной
			fires: [[14, 7, 'car'], [-9, -20, 'ground'], [10, FS - 7], [-54, 14, 'ground']],
			water: [[24, 50, 10, 6], [THICK[0], THICK[1], THICK[2], THICK[2]]],
			barrels: 8,
			trees(tryTree) {
				// за южным забором — берёзы и сосны; у западного забора — берёзы; у АБК и отстойника — редкие берёзы
				for (let i = 0; i < 46; i++) tryTree(R(-86, 86), R(FS + 2.5, 86), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(-86, FW - 2), R(-40, FS), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(-46, -24), R(-28, -20), 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(10, 40), R(42, 60), 'birch');
			},
			beltDensity: 0.25,
			beltTrees: ['birch', 'birch', 'pine'],
			clutter: 9,
			blood: 22,
			puddles: 9,
			puddle: () => [R(-60, 80), R(-20, 40)],
			grass: 0.35,
			hint: (b) => ({
				Hoist: 'Подъёмная машина — пульт машиниста, щит управления, сейф, верстак',
				ABK: 'АБК — шкафчики в раздевалке, ламповая, кабинеты начальника и горного мастера',
				Factory: 'Обогатительная фабрика — шкафы с ЗИП, шкафчики, верстак, конторка мастера с сейфом',
				Workshop: 'Ремонтные мастерские — верстак, шкафчики, сейф мастера',
				VMGate: 'КПП склада ВМ — стол дежурного и шкаф',
				VMStore: 'Склад ВМ — ящики с гранатами, ВОГами и выстрелами, стеллаж, сейф',
				Detonators: 'Склад средств инициирования — шкаф и сейф взрывника',
			}[b.name]),
		};
	},
};

// ---------- Склад ВМ ----------

/** Длинный ящик с замками (тайник). */
const crate = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.8, 0.5, 0.65, 0, 0.25, 0, b.IM.crateGreen], [1.82, 0.05, 0.67, 0, 0.52, 0, b.IM.machine],
	[0.1, 0.12, 0.03, -0.55, 0.4, 0.34, b.IM.black], [0.1, 0.12, 0.03, 0.55, 0.4, 0.34, b.IM.black],
	[1.6, 0.42, 0.6, 0.04, 0.76, 0, b.IM.crateGreen],
], [1.8, 0.65], loot, 1.0);

/**
 * Хранилище ВМ 16×9 м: толстые бетонные стены, стальная двустворчатая дверь на север. Вдоль южной стены — ящики
 * с гранатами, ВОГами и выстрелами ПГ-7В, у восточной — стеллаж, у западной — сейф; у входа — поддоны с укупоркой.
 */
function buildVMStore(ctx, { name, cx, cz }) {
	const W = 16, D = 9, H = 3.6, hx = W / 2, hz = D / 2, t = 0.4;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.7 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-4], w: 1.9, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.top_(place(box(W + 0.6, 0.35, D + 0.6, 3), 0, H + 0.17, 0), M.roofTar);
	b.parapet(H + 0.35, M.concreteDark, 0.3);
	for (const x of [-4, 4]) b.vent(x, 0, H + 0.35, M.silver, { h: 0.5, r: 0.15 });
	for (const s of [-1, 1]) b.wallBox('front', -4 + s * 1.45, 0.95, 0.02, 2.05, 0.07, M.metalOlive, { t, off: 0.1 });
	b.canopy('front', -4, { w: 2.8, d: 1.2, y: 2.7, mat: M.concrete, t, thick: 0.18 });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.4, 0.5).translate(0, H - 0.35, 0.03), 'front', 3, t), T.signMaterial('ХРАНИЛИЩЕ ВМ № 1', { bg: '#a01a10', fg: '#f0e6c8', w: 512, h: 76 }));
	crate(b, 'Ящик с гранатами', -6, hz - t / 2 - 0.4, Math.PI, { grenade: [2, 4, 0.7], vog25: [2, 4, 0.25] });
	crate(b, 'Ящик ВОГ-25', -2.5, hz - t / 2 - 0.4, Math.PI, { vog25: [3, 6, 0.55], rg6: 0.08, grenade: [1, 2, 0.3] });
	crate(b, 'Ящик ПГ-7В', 1.0, hz - t / 2 - 0.4, Math.PI, { rocket: [1, 3, 0.5], rpg7: 0.1, grenade: [1, 2, 0.2] });
	crate(b, 'Ящик с взрывчаткой', 4.5, hz - t / 2 - 0.4, Math.PI, { grenade: [1, 3, 0.55], rocket: [1, 2, 0.3], vog25: [2, 4, 0.3] });
	b.container('Стеллаж', hx - t / 2 - 0.55, 0, -Z, [
		...[-1.9, 1.9].flatMap((dx) => [-0.4, 0.4].map((dz) => [0.08, 2.4, 0.08, dx, 1.2, dz, IM.rack])),
		...[0.15, 0.95, 1.75, 2.35].map((y) => [3.9, 0.05, 0.9, 0, y, 0, IM.rack]),
		[0.9, 0.55, 0.7, -1.2, 0.45, 0, IM.crateGreen], [0.8, 0.5, 0.7, 0.5, 0.43, 0.05, IM.black], [0.7, 0.45, 0.6, 1.4, 0.4, 0, IM.crateGreen],
		[1.0, 0.6, 0.7, -0.5, 1.28, 0, IM.crateGreen], [0.9, 0.5, 0.7, 1.1, 1.23, 0, IM.machine], [1.0, 0.4, 0.7, 0.6, 1.98, 0, IM.crateGreen],
	], [4.0, 1.0], { ammo127: [5, 10, 0.35], ammo76254: [10, 20, 0.4], grenade: [1, 2, 0.3] }, 2.4);
	safe(b, 'Сейф', -hx + t / 2 + 0.35, 1.0, Z, { ksvk: 0.06, awm: 0.04, ammo127: [5, 10, 0.35], spore: [3, 6, 0.5] });
	for (const [x, z] of [[-7.0, -2.8], [5.8, -3.2]]) b.furniture(x, z, 0.1, [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], [1.0, 0.5, 0.45, 0, 0.39, -0.24, IM.crateGreen], [1.0, 0.5, 0.45, 0, 0.39, 0.24, IM.crateGreen], [1.0, 0.45, 0.45, 0, 0.87, 0, IM.crateGreen]], { solid: [1.25, 1.05], prop: 'ammo' });
	b.furniture(1.5, -hz + t / 2 + 0.1, 0, [[1.0, 1.4, 0.05, 0, 1.4, 0, IM.redBoard, { up: true }], [0.3, 0.45, 0.3, 0, 0.23, 0.15, IM.redBoard]], { solid: [1.0, 0.4] }); // пожарный щит
	return b.finish();
}

/** Склад средств инициирования 7×5,5 м: шкаф с детонаторами и сейф взрывника. Вход — с севера. */
function buildDetonators(ctx, { name, cx, cz }) {
	const W = 7, D = 5.5, H = 3, hx = W / 2, hz = D / 2, t = 0.35;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [1.5], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.wallBox('front', 1.5 + 1.0, 0.85, 0.02, 2.05, 0.06, M.metalOlive, { t, off: 0.1 });
	b.container('Шкаф СИ', -hx + t / 2 + 0.3, 0.6, Z, [[1.2, 1.9, 0.55, 0, 0.95, 0, IM.metal], [0.02, 1.8, 0.02, 0, 0.95, 0.28, IM.black], [0.12, 0.12, 0.03, 0.2, 1.0, 0.29, IM.redBoard]], [1.2, 0.55], { grenade: [1, 2, 0.45], vog25: [2, 4, 0.3], spore: [1, 3, 0.3] }, 1.9);
	safe(b, 'Сейф взрывника', 2.3, hz - t / 2 - 0.35, Math.PI, { grenade: [1, 3, 0.5], ammo50: [4, 8, 0.3], deagle: 0.05, spore: [2, 4, 0.4] });
	table(b, -1.0, 1.6, 0, { w: 1.2, d: 0.6 });
	return b.finish();
}
