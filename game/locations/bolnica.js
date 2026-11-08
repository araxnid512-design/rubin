// Кластер «Больница»: городская больница №2 на окраине, которую Улей перенёс вместе с куском улицы.
// За оградой (спереди — решётка на кирпичных столбах, по бокам и сзади — бетонные плиты) — главный корпус
// в пять этажей с порталом входа, к нему пристроен приёмный покой (койки, тумбочки, шкафы) с навесом, под которым
// стоят машины скорой; терапевтический корпус в три этажа, сквер с клумбой, беседкой и лавочками, стоянка
// персонала. На хоздворе — котельная с трубой, кислородные ёмкости, трансформаторная, гараж скорой со стеллажами;
// в дальнем углу — морг с катафалком. Въезд — через КПП со шлагбаумом с улицы, калитка — с улицы на север.
// Снаружи: улица с остановкой, аптека, стоянка, частные дома за улицей на север, панельная четырёхэтажка.
// Выходы: на запад по улице (к стабу «Полис») и на север по улице (к Заречному).
// Локация 180×180 м: вокруг прежнего квартала (132×132) — новые районы. На юге, за улицей, по продолжению северной
// улицы — поликлиника с кабинетами врачей, угловая аптека, общежитие медперсонала, больничный парк с фонтаном,
// беседкой и прудом. На востоке — проезд к гаражам подстанции скорой, стоянка; на северо-востоке за бетонной
// оградой с колючкой — инфекционное отделение, палатка санобработки. На севере — вертолётная площадка
// санавиации с Ми-8 и будкой диспетчера, на северо-западе — центральная котельная с трубой.
// Опасность 2: много бегунов, топтуны водят стаи у корпусов, в сквере и на хоздворе, в коридорах поликлиники,
// общежития и инфекционного отделения; во дворе инфекционки держится рубер.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { hash01, boxTop } from '../facade.js';
import { Building, table, chair, bed, buildArmyBarracks, buildWarehouse, buildGuardhouse, buildCheckpoint, buildShop, buildHouse } from '../buildings.js';
import { bench, streetLamp, markingMaterial, addCar, bus, fencePlot, shed, woodpile, garden, outhouse, transformer, pond } from '../props.js';
import { chimney, storageTank, barrier, hazardBarrels, billboard } from '../props-industrial.js';

// ограда больничной территории
const FX0 = -28, FX1 = 57, FZ0 = -50, FZ1 = 20;

/**
 * Машина скорой помощи («буханка»): белый фургон с красной полосой и крестами, маячок на крыше.
 * Перед — локальная +X (как у addCar); wreck — брошена с открытой дверью, чуть накренилась.
 */
function ambulance(batch, M, collide, x, z, ry, { wreck = false } = {}) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(wreck ? 0.04 : 0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(3.8, 0.28, 1.6), M.metalDark, 0, 0.42, 0); // рама
	add(box(4.4, 1.6, 1.94, 1.5), M.white, 0, 1.26, 0); // кузов
	add(box(4.0, 0.08, 1.8, 1.5), M.white, -0.1, 2.1, 0); // крыша
	add(box(4.42, 0.2, 1.96), M.red, 0, 1.12, 0); // красная полоса
	add(box(0.04, 0.55, 1.62), M.metalDark, 2.21, 1.68, 0); // лобовое стекло (тёмное, как у всех машин сверху)
	add(box(0.85, 0.5, 1.96), M.metalDark, 1.55, 1.68, 0); // окна кабины по бокам
	add(box(1.6, 0.36, 1.96), M.metalDark, -0.9, 1.78, 0); // окна салона
	for (const s of [-1, 1]) {
		add(box(0.5, 0.14, 0.02), M.red, -0.9, 1.45, s * 0.985); // красный крест на борту
		add(box(0.14, 0.5, 0.02), M.red, -0.9, 1.45, s * 0.985);
		for (const wx of [-1.35, 1.35]) add(new THREE.CylinderGeometry(0.4, 0.4, 0.26, 14).rotateX(Math.PI / 2), M.tire, wx, 0.4, s * 0.86);
	}
	add(box(0.14, 0.18, 2.0), M.metalDark, 2.24, 0.55, 0); // бамперы
	add(box(0.14, 0.18, 2.0), M.metalDark, -2.24, 0.55, 0);
	add(box(0.3, 0.16, 0.7), M.red, 1.5, 2.22, 0); // маячок
	if (wreck) add(box(0.9, 1.35, 0.05), M.white, 1.6, 1.25, 1.35); // распахнутая дверь кабины
	collide(x, z, 4.6, 2.1, ry);
}

/** Каталка: рама на колёсиках, матрас (декор с коллайдером). */
function stretcher(batch, M, collide, x, z, ry) {
	batch.add(place(box(1.9, 0.06, 0.62), x, 0.82, z, ry), M.metalDark);
	batch.add(place(box(1.8, 0.08, 0.56), x, 0.89, z, ry), M.white);
	const c = Math.cos(ry), s = Math.sin(ry);
	for (const [lx, lz] of [[-0.85, -0.26], [0.85, -0.26], [-0.85, 0.26], [0.85, 0.26]]) {
		batch.add(place(box(0.04, 0.8, 0.04), x + lx * c + lz * s, 0.4, z - lx * s + lz * c), M.metalDark);
	}
	collide(x, z, 2.0, 0.7, ry);
}

const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);

// ---------- Мебель новых корпусов (лицо — +Z своих осей; тайники обыскивают спереди) ----------

/** Шкаф с дверцами. */
const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);
/** Медицинский шкаф: белый, верх застеклён, за стеклом склянки и пузырьки. */
const medCabinet = (b, name, x, z, rot, loot, w = 1.0) => b.container(name, x, z, rot, [
	[w, 1.9, 0.45, 0, 0.95, 0, b.IM.white],
	[w - 0.1, 0.9, 0.02, 0, 1.35, 0.23, b.IM.glass],
	[w - 0.25, 0.2, 0.28, 0, 1.12, 0.02, b.IM.jars],
	[w - 0.35, 0.22, 0.28, 0, 1.55, 0.02, b.IM.bottles[0]],
	[0.02, 0.75, 0.02, 0, 0.42, 0.23, b.IM.black],
], [w, 0.45], loot, 1.9);
/** Письменный стол с тумбой и бумагами. */
const desk = (b, name, x, z, rot, loot, w = 1.3) => b.container(name, x, z, rot, [
	[w, 0.05, 0.7, 0, 0.75, 0, b.IM.furniture], [0.45, 0.72, 0.66, w / 2 - 0.25, 0.36, 0, b.IM.furniture],
	[0.06, 0.72, 0.06, -w / 2 + 0.06, 0.36, -0.3, b.IM.furniture], [0.06, 0.72, 0.06, -w / 2 + 0.06, 0.36, 0.3, b.IM.furniture],
	[0.3, 0.03, 0.22, -0.2, 0.79, 0.05, b.IM.white],
], [w, 0.7], loot, 0.95);
/** Сейф. */
const safe = (b, name, x, z, rot, loot, h = 1.1) => b.container(name, x, z, rot, [
	[0.7, h, 0.6, 0, h / 2, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, h * 0.64, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, h * 0.64, 0.31, b.IM.black],
], [0.7, 0.6], loot, h);
/** Холодильник. */
const fridge = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.65, 1.7, 0.62, 0, 0.85, 0, b.IM.white], [0.04, 0.35, 0.04, -0.25, 1.1, 0.33, b.IM.metal], [0.6, 0.02, 0.02, 0, 1.2, 0.315, b.IM.black],
], [0.65, 0.62], loot, 1.7);
/** Тумбочка. */
const nightstand = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.5, 0.65, 0.45, 0, 0.33, 0, b.IM.furnitureLight], [0.44, 0.02, 0.02, 0, 0.5, 0.23, b.IM.black],
], [0.5, 0.45], loot, 0.65);
/** Верстак с тисками. */
const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine],
], [2.0, 0.8], loot, 1.0);
/** Стеллаж с ящиками. */
const rack = (b, name, x, z, rot, loot, w = 2.4) => b.container(name, x, z, rot, [
	...[-w / 2 + 0.05, w / 2 - 0.05].flatMap((dx) => [-0.25, 0.25].map((dz) => [0.06, 2.0, 0.06, dx, 1.0, dz, b.IM.rack])),
	...[0.15, 0.85, 1.55].map((y) => [w, 0.04, 0.55, 0, y, 0, b.IM.rack]),
	[0.8, 0.45, 0.5, -0.6, 0.4, 0, b.IM.crate], [0.6, 0.4, 0.45, 0.5, 1.07, 0, b.IM.crateGreen], [0.9, 0.35, 0.5, 0.2, 1.75, 0, b.IM.crate],
], [w, 0.6], loot, 2.0);
/** Железный шкафчик (раздевалка). */
const locker = (b, name, x, z, rot, loot, w = 0.85) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);
/** Медицинская кушетка, обитая клеёнкой, изголовье приподнято. */
const couch = (b, x, z, rot) => b.furniture(x, z, rot, [
	[0.7, 0.14, 1.9, 0, 0.55, 0, b.IM.sofa], [0.7, 0.3, 0.45, 0, 0.72, -0.72, b.IM.sofa],
	...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.05, 0.5, 0.05, sx * 0.3, 0.25, sz * 0.85, b.IM.metal]),
], { solid: [0.7, 1.9] });
/** Больничная койка: железная рама, матрас, подушка, спинки. */
const hospitalBed = (b, x, z, rot) => b.furniture(x, z, rot, [
	[0.9, 0.08, 2.0, 0, 0.55, 0, b.IM.metal], [0.86, 0.14, 1.9, 0, 0.66, 0.02, b.IM.linen], [0.6, 0.12, 0.35, 0, 0.78, -0.75, b.IM.linen],
	[0.9, 0.5, 0.05, 0, 0.8, -1.0, b.IM.metal], [0.9, 0.35, 0.05, 0, 0.72, 1.0, b.IM.metal],
	...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.05, 0.55, 0.05, sx * 0.4, 0.27, sz * 0.95, b.IM.metal]),
], { solid: [0.9, 2.0] });
/** Книжный шкаф / шкаф для карточек без тайника. */
const bookcase = (b, x, z, rot, w = 1.2) => b.furniture(x, z, rot, [
	[w, 1.9, 0.45, 0, 0.95, 0, b.IM.furniture], ...[0.5, 1.0, 1.45].map((y) => [w - 0.2, 0.3, 0.3, 0, y, 0.06, b.IM.books[Math.round(y * 2) % 3]]),
], { solid: [w, 0.45] });

/**
 * Поликлиника 30×13 м: первый этаж — можно зайти, второй — фасадом (occluder). Вход с севера под козырьком
 * в вестибюль с регистратурой, коридор вдоль здания, двери в торцах коридора. Кабинеты на север: терапевт,
 * участковый врач, аптечный киоск, хирург; на юг: процедурная, лаборатория, кабинет врача, главврач.
 * Тайники: регистратура, шкафы врачей и процедурной (аптечки), шкаф с реактивами (химия), киоск, сейф главврача.
 */
function buildPolyclinic(bctx, occluder, { cx, cz }) {
	const W = 30, D = 13, H = 3.4, t = 0.3, hx = W / 2, hz = D / 2, cw = 1.6, door = 1.3;
	const b = new Building(bctx, { name: 'Polyclinic', cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [door], w: 1.6, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: [0], w: 1.4, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: [0], w: 1.4, lining: IM.shopWall, side: -1 });
	// коридор: перегородки с дверями кабинетов; вестибюль (x −3…3 на севере) открыт в коридор
	const P = { mat: IM.whitewash, t: 0.15 };
	b.wall('x', -cw, -hx + t / 2, -3, { ...P, doors: [-12, -6] });
	b.wall('x', -cw, 3, hx - t / 2, { ...P, doors: [6, 12] });
	b.wall('x', cw, -hx + t / 2, hx - t / 2, { ...P, doors: [-11.25, -3.75, 3.75, 11.25] });
	for (const x of [-9, -3, 3, 9]) b.wall('z', x, -hz + t / 2, -cw - 0.075, P);
	for (const x of [-7.5, 0, 7.5]) b.wall('z', x, cw + 0.075, hz - t / 2, P);
	const sill = M.whiteBrick;
	for (const x of [-12, -6, 6, 12]) b.window('front', x, { t, sill });
	for (const x of [-11.25, -3.75, 3.75, 11.25]) b.window('back', x, { t, sill });
	for (const z of [-4, 4]) { b.window('left', z, { t, sill }); b.window('right', z, { t, sill }); }
	// крыльцо, козырёк на столбах, распахнутые стеклянные двери; ступени у торцевых дверей
	b.lower(place(box(4.2, 0.2, 1.8, 1), door, 0.1, -hz - 1.0), M.concrete);
	b.canopy('front', door, { w: 4.2, d: 1.9, y: 3.0, mat: M.concrete, posts: M.concrete, t, thick: 0.18 });
	for (const s of [-1, 1]) b.furniture(door + s * 0.8, -hz + 0.1, s * 1.75, [[0.8, 2.05, 0.05, s * -0.4, 1.03, 0, M.glass]], { up: true });
	for (const s of [-1, 1]) b.lower(place(box(1.0, 0.15, 2.0, 1), s * (hx + 0.65), 0.075, 0), M.concrete);
	// вестибюль: регистратура за стеклом, скамья ожидания
	b.container('Регистратура', -2.4, -4.2, Math.PI / 2, [
		[2.4, 1.05, 0.6, 0, 0.525, 0, IM.furnitureLight], [2.5, 0.05, 0.7, 0, 1.07, 0, IM.furniture], [2.2, 0.7, 0.04, 0, 1.45, -0.2, IM.glass],
	], [2.4, 0.6], { medkit: [1, 1, 0.35], ammo919: [3, 6, 0.4], spore: 0.2 }, 1.2);
	b.furniture(2.6, -4.6, -Math.PI / 2, [
		[1.8, 0.06, 0.42, 0, 0.45, 0, IM.furnitureLight], [1.8, 0.4, 0.06, 0, 0.7, -0.18, IM.furnitureLight],
		[0.06, 0.45, 0.4, -0.8, 0.22, 0, IM.metal], [0.06, 0.45, 0.4, 0.8, 0.22, 0, IM.metal],
	], { solid: [1.8, 0.42] });
	// кабинет терапевта
	medCabinet(b, 'Шкаф терапевта', -14.6, -3.4, Math.PI / 2, { medkit: [1, 1, 0.45], chem: [1, 1, 0.25], spore: 0.15 });
	table(b, -12, -5.5, 0, { w: 1.1, d: 0.7 });
	chair(b, -12, -4.85, Math.PI);
	couch(b, -9.5, -4.3, 0);
	// кабинет участкового врача
	desk(b, 'Стол врача', -6, -5.6, 0, { medkit: [1, 1, 0.3], ammo919: [2, 5, 0.35], spore: 0.2 });
	chair(b, -7.3, -5.4, Math.PI / 2);
	couch(b, -3.5, -4.2, 0);
	bookcase(b, -8.55, -3.0, Math.PI / 2, 1.0);
	// аптечный киоск: витрина у окна, полки
	b.container('Аптечный киоск', 6, -6.05, 0, [
		[2.2, 1.0, 0.55, 0, 0.5, 0, IM.white], [2.2, 0.9, 0.35, 0, 1.5, -0.1, IM.glass], [1.9, 0.2, 0.25, 0, 1.25, -0.1, IM.jars], [1.8, 0.2, 0.25, 0, 1.7, -0.1, IM.bottles[1]],
	], [2.2, 0.55], { medkit: [1, 2, 0.55], chem: [1, 1, 0.25], spore: 0.15 }, 1.95);
	bookcase(b, 8.6, -4.2, -Math.PI / 2, 1.6);
	// кабинет хирурга
	table(b, 12, -5.5, 0, { w: 1.1, d: 0.7 });
	chair(b, 12, -4.85, Math.PI);
	couch(b, 14.4, -4.3, 0);
	bookcase(b, 9.33, -3.2, Math.PI / 2, 1.0);
	// процедурная
	medCabinet(b, 'Процедурный шкаф', -14.6, 4.2, Math.PI / 2, { medkit: [1, 2, 0.5], chem: [1, 2, 0.35] });
	couch(b, -8.0, 4.4, 0);
	b.furniture(-11.25, 5.95, 0, [[0.9, 0.8, 0.5, 0, 0.4, 0, IM.white], [0.9, 0.04, 0.5, 0, 0.82, 0, IM.metal]], { solid: [0.9, 0.5] }); // процедурный столик
	// лаборатория: шкаф с реактивами, стол с микроскопом
	cabinet(b, 'Шкаф с реактивами', -5.6, 6.07, Math.PI, 1.2, 2.0, 0.5, { chem: [1, 3, 0.6], medkit: [1, 1, 0.2], grenade: 0.03 }, IM.white);
	b.furniture(-1.6, 4.4, 0, [
		[1.6, 0.05, 0.75, 0, 0.9, 0, IM.white], [1.5, 0.85, 0.7, 0, 0.43, 0, IM.machine], [0.3, 0.35, 0.3, -0.4, 1.1, 0, IM.black], [0.2, 0.25, 0.2, 0.4, 1.05, 0.1, IM.glass],
	], { solid: [1.6, 0.75] });
	// кабинет врача (южный)
	table(b, 3.75, 5.7, 0, { w: 1.2, d: 0.7 });
	chair(b, 3.75, 5.0, 0);
	couch(b, 7.0, 4.0, 0);
	bookcase(b, 0.33, 4.0, Math.PI / 2, 1.0);
	// кабинет главврача: сейф, стол, шкаф с книгами
	safe(b, 'Сейф главврача', 14.52, 5.5, -Math.PI / 2, { medkit: [1, 2, 0.4], ammo919: [6, 12, 0.6], spore: [2, 4, 0.5], glock17: 0.05, chem: [1, 1, 0.3] });
	table(b, 11.25, 5.6, 0, { w: 1.5, d: 0.8 });
	chair(b, 11.25, 4.9, 0);
	bookcase(b, 7.83, 4.4, Math.PI / 2, 1.4);
	// скамейки в коридоре у кабинетов
	for (const x of [-9, 9]) b.furniture(x, -1.25, 0, [[1.8, 0.06, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.45, 0.4, -0.8, 0.22, 0, IM.metal], [0.06, 0.45, 0.4, 0.8, 0.22, 0, IM.metal]], { solid: [1.8, 0.4] });
	// второй этаж: фасад с окнами, вывеска к камере и над входом, плоская крыша с парапетом и вытяжками
	const y0 = H + 0.4, H2 = 3.3, top = y0 + H2;
	const sign = T.signMaterial('ГОРОДСКАЯ ПОЛИКЛИНИКА', { bg: '#e8e4d8', fg: '#1a3a7a', w: 640, h: 72 });
	occluder('PolyclinicTop', (kb) => {
		kb.add(place(box(W + 0.3, 0.3, D + 0.3, 2), cx, y0 - 0.15, cz), M.concrete);
		kb.add(place(box(W, H2, D, 2, 1.6), cx, y0 + H2 / 2, cz), M.whiteBrick);
		for (let i = 0; i < 9; i++) for (const s of [1, -1]) {
			const x = cx - 13 + i * 3.25, h = hash01('poly', s, i), k = h < 0.2 ? 5 : h < 0.35 ? 6 : h < 0.6 ? 7 : 4;
			const g = T.windowUV(new THREE.PlaneGeometry(1.62, 1.4), k);
			if (s < 0) g.rotateY(Math.PI);
			kb.add(g.translate(x, y0 + 1.5, cz + s * (D / 2 + 0.02)), M.window);
		}
		for (const s of [1, -1]) {
			const g = new THREE.PlaneGeometry(8.4, 0.62);
			if (s < 0) g.rotateY(Math.PI);
			kb.add(g.translate(cx + (s < 0 ? door : 0), y0 + H2 - 0.42, cz + s * (D / 2 + 0.03)), sign);
		}
		kb.add(planeXZ(W, D, 4).translate(cx, top + 0.04, cz), M.roofTar);
		for (const s of [-1, 1]) {
			kb.add(boxTop(W + 0.4, 0.5, 0.25, 2).translate(cx, top + 0.25, cz + s * (D / 2 + 0.075)), M.concrete);
			kb.add(boxTop(0.25, 0.5, D - 0.1, 2).translate(cx + s * (W / 2 + 0.075), top + 0.25, cz), M.concrete);
		}
		for (const [ex, ez] of [[-11, -3], [-4, 2.5], [5, -2.5], [12, 3]]) kb.add(boxTop(1.0, 0.8, 0.6, 1).translate(cx + ex, top + 0.4, cz + ez), M.whiteBrick);
		kb.add(boxTop(3.0, 2.2, 2.6, 2).translate(cx + 8, top + 1.1, cz + 0.5), M.whiteBrick); // машинное отделение лифта
		kb.add(boxTop(3.3, 0.12, 2.9, 2).translate(cx + 8, top + 2.26, cz + 0.5), M.roofTar);
	}, { cx, cz, ry: 0, hx: W / 2 + 0.5, hz: D / 2 + 1.0, top: top + 2.4 }, 0.2);
	return b.finish();
}

/**
 * Аптека 10×8 м на углу улицы: торговый зал с витринами и прилавком, за прилавком — стеллаж с лекарствами,
 * холодильник и сейф; вход с улицы (−Z), чёрный ход на задний двор.
 */
function buildPharmacy(bctx, { cx, cz }) {
	const W = 10, D = 8, H = 3.2, t = 0.25, hx = W / 2, hz = D / 2, door = -2.6;
	const b = new Building(bctx, { name: 'Pharmacy', cx, cz, ry: 0, W, D, H, top: H + 0.5 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [door], w: 1.5, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [door], lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.window('back', 2.0, { t, sill: M.whiteBrick }); b.window('right', 0, { t, sill: M.whiteBrick });
	// витрины с решётками, вывеска «АПТЕКА», зелёный крест над входом
	for (const x of [0.6, 3.4]) {
		b.top_(b.onWall(new THREE.PlaneGeometry(2.2, 1.5).translate(0, 1.7, 0.02), 'front', x, t), M.glass);
		for (let k = -0.9; k <= 0.91; k += 0.3) b.top_(b.onWall(box(0.04, 1.5, 0.04).translate(k, 1.7, 0.07), 'front', x, t), M.metalDark);
	}
	b.top_(b.onWall(new THREE.PlaneGeometry(4.6, 0.7).translate(0, H - 0.32, 0.03), 'front', 2.0, t), M.shopSign);
	b.top_(b.onWall(box(0.72, 0.22, 0.06).translate(0, 2.72, 0.05), 'front', door, t), M.green);
	b.top_(b.onWall(box(0.22, 0.72, 0.06).translate(0, 2.72, 0.05), 'front', door, t), M.green);
	b.lower(place(box(1.8, 0.15, 1.0, 1), door, 0.075, -hz - 0.6), M.concrete);
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.vent(2.5, 2.0, H + 0.25, M.metalDark, { h: 0.6 });
	// торговый зал: прилавок поперёк, стойка-витрина у стены
	b.container('Прилавок', 1.6, -0.6, Math.PI, [
		[5.4, 1.0, 0.7, 0, 0.5, 0, IM.furnitureLight], [5.5, 0.05, 0.8, 0, 1.02, 0, IM.furniture],
		[3.0, 0.5, 0.35, -0.6, 1.3, 0.15, IM.glass], [0.45, 0.25, 0.35, 2.0, 1.17, 0, IM.black],
	], [5.4, 0.7], { medkit: [1, 2, 0.5], ammo919: [3, 6, 0.3], spore: 0.25 }, 1.3);
	b.furniture(-4.55, -2.4, Math.PI / 2, [[1.8, 1.6, 0.45, 0, 0.8, 0, IM.white], [1.7, 0.25, 0.35, 0, 1.0, 0.03, IM.jars], [1.6, 0.25, 0.35, 0, 1.4, 0.03, IM.cans]], { solid: [1.8, 0.45] });
	// за прилавком: стеллаж с лекарствами, холодильник с вакцинами, сейф
	b.container('Стеллаж с лекарствами', 1.4, 3.62, Math.PI, [
		[2.6, 1.9, 0.45, 0, 0.95, 0, IM.white], ...[0.5, 1.0, 1.5].map((y) => [2.5, 0.04, 0.44, 0, y, 0.01, IM.furniture]),
		[2.1, 0.22, 0.3, 0, 0.62, 0.05, IM.jars], [1.8, 0.2, 0.3, 0.2, 1.12, 0.05, IM.bottles[0]], [2.0, 0.2, 0.3, -0.1, 1.62, 0.05, IM.cans],
	], [2.6, 0.45], { medkit: [1, 2, 0.5], chem: [1, 2, 0.4] }, 1.9);
	fridge(b, 'Холодильник с вакцинами', 4.53, 2.4, -Math.PI / 2, { medkit: [1, 1, 0.4], chem: [1, 1, 0.35], spore: 0.15 });
	safe(b, 'Сейф', -4.54, 3.3, Math.PI / 2, { ammo919: [6, 12, 0.6], spore: [2, 4, 0.45], ammo50: [2, 5, 0.15], medkit: [1, 1, 0.3] });
	return b.finish();
}

/**
 * Общежитие медперсонала 22×10 м: первый этаж — можно зайти, второй — фасадом. Вход с севера в вестибюль
 * с вахтой, коридор вдоль здания, комнаты с кроватями по обе стороны, общая кухня; дверь в восточном торце.
 * Тайники: шкаф, две тумбочки, холодильник на кухне.
 */
function buildDorm(bctx, occluder, { cx, cz }) {
	const W = 22, D = 10, H = 3.0, t = 0.3, hx = W / 2, hz = D / 2, cw = 1.0;
	const b = new Building(bctx, { name: 'Dormitory', cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'home';
	const { M } = bctx, IM = b.IM;
	const paper = IM.wallpaper[1];
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [0], w: 1.5, lining: paper, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: paper, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: paper, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, doors: [0], lining: paper, side: -1 });
	const P = { mat: paper, t: 0.14 };
	b.wall('x', -cw, -hx + t / 2, -2, { ...P, doors: [-8.75, -4.25] });
	b.wall('x', -cw, 2, hx - t / 2, { ...P, doors: [4.25, 8.75] });
	b.wall('x', cw, -hx + t / 2, hx - t / 2, { ...P, doors: [-8.25, -2.75, 2.75, 8.25] });
	for (const x of [-6.5, -2, 2, 6.5]) b.wall('z', x, -hz + t / 2, -cw - 0.07, P);
	for (const x of [-5.5, 0, 5.5]) b.wall('z', x, cw + 0.07, hz - t / 2, P);
	const sill = M.brick;
	for (const x of [-8.75, -4.25, 4.25, 8.75]) b.window('front', x, { t, sill });
	for (const x of [-8.25, -2.75, 2.75, 8.25]) b.window('back', x, { t, sill });
	for (const z of [-3, 3]) { b.window('left', z, { t, sill }); b.window('right', z, { t, sill }); }
	b.lower(place(box(2.4, 0.18, 1.2, 1), 0, 0.09, -hz - 0.7), M.concrete);
	b.canopy('front', 0, { w: 2.6, d: 1.4, y: 2.6, mat: M.metalRust, posts: M.brick, t });
	b.wallBox('front', 1.35, 1.1, 0.02, 2.05, 0.05, M.woodGrey, { t }); // дверь распахнута наружу
	// комната 1: кровать, шкаф
	bed(b, -9.65, -3.6, Math.PI / 2);
	cabinet(b, 'Шкаф', -7.2, -4.54, 0, 1.0, 1.9, 0.55, { ammo919: [3, 6, 0.45], medkit: [1, 1, 0.3], spore: 0.2 });
	// комната 2: две кровати
	bed(b, -5.6, -3.4, 0);
	bed(b, -2.9, -3.4, 0);
	// вахта
	b.furniture(-1.5, -3.6, Math.PI / 2, [[1.3, 0.75, 0.6, 0, 0.375, 0, IM.furniture], [0.35, 0.28, 0.25, 0.3, 0.9, 0, IM.black]], { solid: [1.3, 0.6] });
	chair(b, -0.8, -3.6, -Math.PI / 2);
	// комнаты 3 и 4
	bed(b, 5.6, -3.4, 0);
	b.furniture(2.6, -4.57, 0, [[1.0, 1.9, 0.5, 0, 0.95, 0, IM.furniture]], { solid: [1.0, 0.5] });
	bed(b, 9.9, -3.4, 0);
	nightstand(b, 'Тумбочка', 8.4, -4.6, 0, { medkit: [1, 1, 0.35], ammo919: [2, 5, 0.4] });
	// южные комнаты: две кровати с тумбочкой, кухня, ещё две комнаты
	bed(b, -9.9, 3.4, Math.PI);
	bed(b, -6.4, 3.4, Math.PI);
	nightstand(b, 'Тумбочка', -8.6, 4.6, Math.PI, { ammo919: [3, 5, 0.4], spore: 0.25, medkit: [1, 1, 0.2] });
	fridge(b, 'Холодильник', -0.41, 3.8, -Math.PI / 2, { medkit: [1, 1, 0.3], spore: 0.15 });
	b.furniture(-4.9, 4.4, Math.PI / 2, [[0.6, 0.85, 0.6, 0, 0.42, 0, IM.white], [0.5, 0.02, 0.5, 0, 0.86, 0, IM.black]], { solid: [0.6, 0.6] }); // электроплита
	table(b, -3.6, 3.6, 0, { w: 1.0, d: 0.7 });
	chair(b, -3.6, 2.85, 0);
	bed(b, 1.0, 3.4, Math.PI);
	bed(b, 4.5, 3.4, Math.PI);
	bed(b, 9.9, 3.4, Math.PI);
	b.furniture(6.1, 4.57, Math.PI, [[1.0, 1.9, 0.5, 0, 0.95, 0, IM.furniture]], { solid: [1.0, 0.5] });
	// второй этаж
	const y0 = H + 0.35, H2 = 3.0, top = y0 + H2;
	const sign = T.signMaterial('ОБЩЕЖИТИЕ МЕДПЕРСОНАЛА', { bg: '#e8e4d8', fg: '#5a2a1a', w: 640, h: 72 });
	occluder('DormTop', (kb) => {
		kb.add(place(box(W + 0.3, 0.3, D + 0.3, 2), cx, y0 - 0.15, cz), M.concrete);
		kb.add(place(box(W, H2, D, 2, 1.6), cx, y0 + H2 / 2, cz), M.brick);
		for (let i = 0; i < 7; i++) for (const s of [1, -1]) {
			const x = cx - 9 + i * 3, h = hash01('dorm', s, i), k = h < 0.25 ? 5 : h < 0.4 ? 6 : h < 0.65 ? 7 : 4;
			const g = T.windowUV(new THREE.PlaneGeometry(1.5, 1.35), k);
			if (s < 0) g.rotateY(Math.PI);
			kb.add(g.translate(x, y0 + 1.4, cz + s * (D / 2 + 0.02)), M.window);
		}
		kb.add(new THREE.PlaneGeometry(8.0, 0.6).translate(cx, y0 + H2 - 0.36, cz + D / 2 + 0.03), sign);
		kb.add(planeXZ(W, D, 4).translate(cx, top + 0.04, cz), M.roofTar);
		for (const s of [-1, 1]) {
			kb.add(boxTop(W + 0.4, 0.45, 0.25, 2).translate(cx, top + 0.22, cz + s * (D / 2 + 0.075)), M.brick);
			kb.add(boxTop(0.25, 0.45, D - 0.1, 2).translate(cx + s * (W / 2 + 0.075), top + 0.22, cz), M.brick);
		}
		for (const ex of [-6, 6]) kb.add(boxTop(0.9, 0.8, 0.6, 1).translate(cx + ex, top + 0.4, cz + 1.5), M.brick);
	}, { cx, cz, ry: 0, hx: W / 2 + 0.5, hz: D / 2 + 1.0, top: top + 1.0 }, 0.2);
	return b.finish();
}

/**
 * Инфекционное отделение 28×11 м за своей оградой: коридор вдоль южной стены (входы с юга и с востока),
 * на север — боксы с койками, пост медсестры и лаборатория. Тайники: тумбочка, шкаф с лекарствами,
 * стол поста, сейф с наркотиками, холодильник лаборатории.
 */
function buildInfection(bctx, batch, collide, { cx, cz }) {
	const W = 28, D = 11, H = 3.3, t = 0.3, hx = W / 2, hz = D / 2, cr = 2.5; // cr — перегородка коридора
	const b = new Building(bctx, { name: 'Infection', cx, cz, ry: 0, W, D, H, top: H + 0.5 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.plaster, t, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.plaster, t, doors: [-10, 0], w: 1.6, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, doors: [4], lining: IM.shopWall, side: -1 });
	const P = { mat: IM.whitewash, t: 0.15 };
	b.wall('x', cr, -hx + t / 2, -2.8, { ...P, doors: [-11.2, -5.6] });
	b.wall('x', cr, 2.8, hx - t / 2, { ...P, doors: [5.6, 11.2] });
	for (const x of [-8.4, -2.8, 2.8, 8.4]) b.wall('z', x, -hz + t / 2, cr - 0.075, P);
	const sill = M.plaster;
	for (const x of [-11.2, -5.6, 0, 5.6, 11.2]) b.window('front', x, { t, sill });
	for (const x of [-6, 5, 10]) b.window('back', x, { t, sill });
	b.window('left', -1.5, { t, sill }); b.window('right', -1.5, { t, sill });
	// плоская крыша с парапетом, вытяжки боксов; вывеска и козырёк над главным входом
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.plaster, 0.35);
	for (const x of [-11.2, -5.6, 5.6, 11.2]) b.vent(x, -2, H + 0.3, M.silver);
	b.canopy('back', 0, { w: 3.0, d: 1.5, y: 2.6, mat: M.roofTar, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(6.4, 0.6).translate(0, H - 0.3, 0.03), 'back', 0, t), T.signMaterial('ИНФЕКЦИОННОЕ ОТДЕЛЕНИЕ', { bg: '#e8e4d8', fg: '#8a1a10', w: 640, h: 60 }));
	for (const x of [-10, 0]) b.lower(place(box(2.0, 0.15, 1.0, 1), x, 0.075, hz + 0.65), M.concrete);
	// бокс 1: койка, тумбочка, капельница
	hospitalBed(b, -12.6, -3.0, 0);
	nightstand(b, 'Тумбочка', -11.4, -5.09, 0, { medkit: [1, 1, 0.4], ammo919: [2, 4, 0.3], spore: 0.2 });
	b.furniture(-11.6, -1.6, 0, [[0.04, 1.8, 0.04, 0, 0.9, 0, IM.metal], [0.4, 0.04, 0.04, 0, 1.78, 0, IM.metal], [0.12, 0.22, 0.06, 0.15, 1.6, 0, IM.glass]], { solid: [0, 0] });
	// бокс 2: койка, шкаф с лекарствами
	hospitalBed(b, -7.2, -3.0, 0);
	medCabinet(b, 'Шкаф с лекарствами', -3.13, -3.6, -Math.PI / 2, { medkit: [1, 2, 0.5], chem: [1, 2, 0.4] });
	// пост медсестры: стол, стул, сейф, полки с лекарствами
	desk(b, 'Пост медсестры', 0, 0.2, 0, { medkit: [1, 1, 0.4], ammo919: [3, 6, 0.4], spore: 0.25 });
	chair(b, 0, -0.65, 0);
	safe(b, 'Сейф', 1.8, -5.02, 0, { chem: [1, 2, 0.45], medkit: [1, 2, 0.45], ammo545: [5, 12, 0.3], spore: [1, 3, 0.35] });
	b.furniture(-2.47, -3.0, Math.PI / 2, [[1.6, 1.8, 0.45, 0, 0.9, 0, IM.white], [1.5, 0.25, 0.35, 0, 1.2, 0.03, IM.jars]], { solid: [1.6, 0.45] });
	// бокс 3: две койки
	hospitalBed(b, 4.0, -3.0, 0);
	hospitalBed(b, 7.2, -3.0, 0);
	// лаборатория: холодильник с пробами, стол, жёлтые баки для отходов
	fridge(b, 'Холодильник лаборатории', 13.51, -3.0, -Math.PI / 2, { chem: [1, 2, 0.5], medkit: [1, 1, 0.25] });
	b.furniture(11.2, -4.97, 0, [[2.0, 0.05, 0.7, 0, 0.9, 0, IM.white], [1.9, 0.85, 0.65, 0, 0.43, 0, IM.machine], [0.4, 0.3, 0.35, 0.5, 1.07, 0, IM.black]], { solid: [2.0, 0.7] });
	b.furniture(9.1, -0.5, 0, [[0.5, 0.6, 0.5, 0, 0.3, 0, M.hazard]], { solid: [0.5, 0.5] });
	// коридор: брошенная каталка
	stretcher(batch, M, collide, cx + 6.5, cz + 4.1, 0.08);
	return b.finish();
}

/**
 * Ряд гаражей подстанции скорой: одно здание, боксы через перегородки, ворота на запад (−X). loot — тайник
 * каждого бокса ({ kind: 'bench' | 'rack' | 'locker', loot }) или null — ворота заперты.
 */
function buildBays(bctx, { name, cx, cz, loot }) {
	const n = loot.length, bay = 4.5, depth = 7, t = 0.25, H = 3.2, W = depth, D = n * bay, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	const centers = [...Array(n)].map((_, i) => -hz + bay / 2 + i * bay);
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: centers.filter((_, i) => loot[i]), w: 3.0 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t });
	for (let i = 1; i < n; i++) b.wall('x', -hz + i * bay, -hx + t / 2, hx - t / 2, { mat: M.whiteBrick, t: 0.15 });
	b.top_(place(box(W + 0.5, 0.16, D + 0.5, 3), 0, H + 0.08, 0), M.roofTar);
	// красный крест и надпись на торце к камере
	b.top_(b.onWall(box(1.3, 0.36, 0.06).translate(0, 2.2, 0.04), 'back', 0, t), M.red);
	b.top_(b.onWall(box(0.36, 1.3, 0.06).translate(0, 2.2, 0.04), 'back', 0, t), M.red);
	for (const [i, at] of centers.entries()) {
		const L = loot[i];
		if (!L) { b.wallBox('left', at, 3.1, 0.02, 2.35, 0.06, M.metalOlive, { t }); continue; }
		// створки распахнуты наружу; внутри у задней стены — тайник, покрышка или канистра
		for (const s of [-1, 1]) b.furniture(-hx + 0.1, at + s * 1.5, Math.PI / 2 + s * 1.65, [[1.45, 2.2, 0.06, s * 0.72, 1.1, 0, M.metalOlive]], { up: true });
		if (L.kind === 'bench') workbench(b, 'Верстак', hx - 0.55, at, -Math.PI / 2, L.loot);
		else if (L.kind === 'rack') rack(b, 'Стеллаж с запчастями', hx - 0.46, at, -Math.PI / 2, L.loot);
		else locker(b, 'Шкафчик водителя', hx - 0.41, at, -Math.PI / 2, L.loot);
		if (i % 2) b.furniture(1.0, at + 1.4, 0, [[0.6, 0.5, 0.6, 0, 0.25, 0, IM.black]], { solid: [0.6, 0.6], prop: 'tire' });
		else b.furniture(1.0, at - 1.4, 0.3, [[0.5, 0.75, 0.5, 0, 0.37, 0, IM.metal]], { solid: [0.5, 0.5], prop: 'barrel' });
	}
	return b.finish();
}

/**
 * Котельная больничного городка 14×10 м: два котла с топками, насосы, трубы под потолком, щит с манометрами.
 * Ворота с юга, дверь с востока; труба — снаружи (chimney). Тайники: шкафчик кочегара и верстак.
 */
function buildBoilerHouse(bctx, { name, cx, cz }) {
	const W = 14, D = 10, H = 5.0, t = 0.3, hx = W / 2, hz = D / 2, gate = -3;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.5 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [gate], w: 2.6, lining: IM.factoryWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, doors: [2], lining: IM.factoryWall, side: -1 });
	const sill = M.brick;
	for (const x of [-4, 0, 4]) b.window('front', x, { y: 3.4, t, sill });
	for (const x of [1.5, 4.5]) b.window('back', x, { y: 3.4, t, sill });
	b.window('left', 0, { y: 3.4, t, sill });
	for (const s of [-1, 1]) b.wallBox('back', gate + s * 1.96, 1.28, 0.02, 2.06, 0.06, M.metalRust, { t });
	b.canopy('back', gate, { w: 3.4, d: 1.3, y: 2.6, mat: M.metalRust, t });
	b.wallBox('right', 2 + 1.0, 1.0, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.35);
	b.vent(4.5, 2.5, H + 0.3, M.silver);
	// котлы: обмуровка, топки, дымоходы под крышу
	for (const x of [-3.5, 2.5]) {
		b.furniture(x, -2.4, 0, [
			[2.4, 2.4, 3.6, 0, 1.2, 0, IM.machine], [2.5, 0.12, 3.7, 0, 2.45, 0, IM.metal],
			[0.7, 0.6, 0.06, -0.4, 0.8, 1.83, IM.black], [0.5, 0.4, 0.06, 0.6, 1.6, 1.83, IM.black],
		], { solid: [2.4, 3.6] });
		b.furniture(x, -3.4, 0, [[0.5, H - 2.5, 0.5, 0, 2.5 + (H - 2.5) / 2, 0, M.metalRust]], { up: true });
	}
	b.furniture(5.6, -3.9, 0, [[1.2, 0.9, 0.8, 0, 0.45, 0, IM.machine], [0.3, 0.6, 0.3, 0.3, 1.2, 0, IM.metal]], { solid: [1.2, 0.8] }); // насос
	b.furniture(0, -4.6, 0, [[W - 1.4, 0.25, 0.25, 0, 3.6, 0, M.silver], [W - 1.4, 0.18, 0.18, 0, 3.2, 0.2, M.metalRust]], { up: true }); // трубы
	b.furniture(-6.7, -2.0, Math.PI / 2, [[1.6, 1.0, 0.06, 0, 1.6, 0, IM.redBoard], [1.3, 0.7, 0.04, 0, 1.6, 0.04, IM.white]], { solid: [0, 0] }); // щит с манометрами
	b.furniture(-0.5, 2.6, 0.4, [[1.8, 0.7, 1.4, 0, 0.35, 0, M.tire]], { solid: [1.8, 1.4] }); // куча угля
	locker(b, 'Шкафчик кочегара', -6.57, 2.5, Math.PI / 2, { ammo12: [3, 6, 0.4], medkit: [1, 1, 0.3], spore: 0.2, fireaxe: 0.04 });
	workbench(b, 'Верстак', 3.0, 4.42, Math.PI, { ammo919: [3, 6, 0.35], grenade: 0.03, ammo12: [2, 4, 0.3] });
	return b.finish();
}

/** Будка диспетчера санавиации у вертолётной площадки 5×4 м: стол с рацией, шкаф. Вход — с запада. */
function buildHeliBooth(bctx, { cx, cz }) {
	const W = 5, D = 4, H = 2.7, t = 0.22, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'HeliBooth', cx, cz, ry: 0, W, D, H, top: H + 0.3 });
	b.messKind = 'army';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: [0.5], w: 1.2, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.window('front', 0.8, { t, sill: M.whiteBrick }); b.window('back', 0.5, { t, sill: M.whiteBrick }); b.window('right', 0, { t, sill: M.whiteBrick });
	b.top_(place(box(W + 0.5, 0.22, D + 0.5, 3), 0, H + 0.11, 0), M.roofTar);
	b.top_(place(box(0.06, 3.2, 0.06), 1.8, H + 1.8, -1.2), M.metalDark); // антенна
	b.top_(b.onWall(new THREE.PlaneGeometry(3.2, 0.5).translate(0, H - 0.35, 0.03), 'back', 0.2, t), T.signMaterial('САНАВИАЦИЯ', { bg: '#e8e4d8', fg: '#8a1a10', w: 384, h: 60 }));
	b.lower(place(box(1.0, 0.15, 1.5, 1), -hx - 0.55, 0.075, 0.5), M.concrete);
	desk(b, 'Стол диспетчера', 0.9, -1.51, 0, { medkit: [1, 2, 0.5], ammo919: [3, 6, 0.4], spore: [1, 2, 0.3] });
	b.furniture(0.9, -1.7, 0, [[0.45, 0.25, 0.3, -0.3, 0.9, 0, IM.machine]], { solid: [0, 0] }); // рация
	b.furniture(2.15, 0.9, -Math.PI / 2, [[1.0, 1.9, 0.45, 0, 0.95, 0, IM.locker]], { solid: [1.0, 0.45] });
	return b.finish();
}

/**
 * Вертолёт санавиации (Ми-8): белый с красной полосой и крестом, кабина, двигатели, хвостовая балка с килем,
 * лопасти несущего винта провисли. Перед — локальная +X; всё — в общую статику, коллайдеры по фюзеляжу и балке.
 */
function helicopter(batch, M, collide, x, z, ry) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(8.0, 2.5, 2.4, 1.5), M.white, 0, 1.85, 0); // салон
	add(box(8.04, 0.32, 2.44), M.red, 0, 1.35, 0); // полоса
	add(box(4.6, 0.5, 2.44), M.metalDark, -0.6, 2.4, 0); // окна салона
	add(box(1.6, 2.0, 2.2, 1.2), M.white, 4.7, 1.6, 0); // кабина
	add(box(0.9, 1.0, 2.0), M.metalDark, 5.4, 2.1, 0); // остекление кабины
	add(box(0.9, 0.9, 1.8), M.white, 5.85, 1.0, 0); // нос
	add(box(4.6, 1.0, 1.9, 1.5), M.white, 0.6, 3.55, 0); // двигатели
	add(cyl(0.45, 0.45, 0.4, 12).rotateZ(Math.PI / 2), M.metalDark, 3.0, 3.55, 0); // воздухозаборник
	add(cyl(0.25, 0.5, 7.4, 12).rotateZ(Math.PI / 2), M.white, -7.6, 2.55, 0); // хвостовая балка
	add(box(1.4, 2.0, 0.16), M.white, -11.2, 3.35, 0); // киль
	add(box(0.1, 2.4, 0.2), M.metalDark, -11.3, 3.6, 0.28); // хвостовой винт
	add(box(1.6, 0.08, 0.5), M.white, -10.4, 2.6, 0); // стабилизатор
	for (const s of [-1, 1]) {
		add(box(0.5, 0.5, 0.02), M.red, -1.6, 2.0, s * 1.215); // красный крест на борту
		add(box(0.16, 0.16, 0.02), M.white, -1.6, 2.0, s * 1.22);
		add(cyl(0.38, 0.38, 0.3, 12).rotateX(Math.PI / 2), M.tire, -1.2, 0.38, s * 1.55); // колёса
		add(box(0.12, 0.7, 0.9), M.metalDark, -1.2, 0.7, s * 1.25);
		add(box(1.6, 0.9, 0.5), M.white, 1.0, 0.95, s * 1.4); // топливные баки по бортам
	}
	add(cyl(0.3, 0.3, 0.25, 10).rotateX(Math.PI / 2), M.tire, 4.6, 0.3, 0); // переднее колесо
	add(cyl(0.3, 0.3, 0.6, 10), M.metalDark, 0.6, 4.3, 0); // втулка винта
	for (let i = 0; i < 5; i++) add(box(10.6, 0.06, 0.48).translate(5.3, 0, 0).rotateZ(-0.05).rotateY(i * Math.PI * 0.4 + 0.3), M.metalDark, 0.6, 4.55, 0);
	const c = Math.cos(ry), s = Math.sin(ry);
	collide(x + c * 1.1, z - s * 1.1, 10.4, 3.4, ry);
	collide(x - c * 8.0, z + s * 8.0, 7.6, 0.9, ry);
}

/** Армейская палатка санобработки: брезентовые стены и двускатная крыша (без входа — укрытие). */
function tent(batch, M, collide, x, z, ry, len = 6, w = 4) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat) => batch.add(g.applyMatrix4(tf), mat);
	add(box(len, 1.5, w, 2).translate(0, 0.75, 0), M.canvas);
	const rise = 1.1, slope = Math.hypot(w / 2 + 0.15, rise), a = Math.atan2(rise, w / 2 + 0.15);
	for (const s of [-1, 1]) add(box(len + 0.3, 0.06, slope, 2).rotateX(s * a).translate(0, 1.5 + rise / 2, s * (w / 2 + 0.15) / 2), M.canvas);
	add(box(len + 0.4, 0.08, 0.08).translate(0, 1.5 + rise + 0.03, 0), M.metalDark);
	add(box(0.9, 1.3, 0.04).translate(-len / 2 + 1.2, 0.65, w / 2 + 0.02), M.metalDark); // полог входа
	add(box(0.7, 0.7, 0.02).translate(0, 1.0, w / 2 + 0.03), M.white); // белый круг с крестом
	add(box(0.46, 0.14, 0.02).translate(0, 1.0, w / 2 + 0.045), M.red);
	add(box(0.14, 0.46, 0.02).translate(0, 1.0, w / 2 + 0.045), M.red);
	collide(x, z, len + 0.2, w + 0.2, ry);
}

export default {
	id: 'bolnica',
	seed: 3301,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// вывески: аптека (магазин) и морг (сторожка)
		M.shopSign = T.signMaterial('АПТЕКА', { bg: '#e6efe4', fg: '#1d7a3a' });
		M.guardSign = T.signMaterial('МОРГ', { bg: '#2a2c26', fg: '#e8e4d8' });
		const mark = markingMaterial();

		// ---------- Улицы, тротуары, проезды ----------
		ground(180, 8, 0, 28, M.asphalt, 5, 0.02); // улица запад—восток (к стабу)
		ground(8, 116, -36, -32, M.asphalt, 5, 0.022); // улица на север (к Заречному)
		ground(122, 0.15, 29, 28, mark, 6, 0.026);
		ground(50, 0.15, -65, 28, mark, 6, 0.026);
		ground(114, 0.15, -36, -33, mark, 6, 0.027, Math.PI / 2);
		ground(180, 2.2, 0, 22.9, M.concrete, 3, 0.014); // тротуары
		ground(180, 2.2, 0, 33.1, M.concrete, 3, 0.014);
		ground(2.2, 110, -30.9, -35, M.concrete, 3, 0.015);
		// бордюры вдоль улиц (разрывы — у въезда, калитки, перекрёстков и проезда к гаражам скорой)
		for (const [x0, x1, z] of [[-90, -40, 23.95], [-32, 5.6, 23.95], [13.4, 60, 23.95], [67, 90, 23.95], [-90, -40, 32.05], [-32, 90, 32.05]]) {
			batch.add(place(box(x1 - x0, 0.14, 0.24, 2), (x0 + x1) / 2, 0.07, z), M.concrete, { cast: false });
		}
		for (const [z0, z1] of [[-90, -31], [-23, 21.8]]) batch.add(place(box(0.24, 0.14, z1 - z0, 2), -31.95, 0.07, (z0 + z1) / 2), M.concrete, { cast: false });
		// на территории: въезд от КПП, проезд вдоль корпусов, площадки у гаража и приёмного покоя, дорожки
		ground(7, 41, 9.5, 3.5, M.asphalt, 5, 0.021); // въезд (z −17…24)
		ground(54, 7, 16, -13, M.asphalt, 5, 0.023); // проезд вдоль корпусов (x −11…43)
		ground(13, 14, 39.5, -6, M.asphalt, 5, 0.022); // площадка у ворот гаража
		ground(14, 6, 21, -19.4, M.asphalt, 5, 0.024); // к приёмному покою, под навесом
		ground(6, 14, 0, -23.5, M.concrete, 3, 0.019); // к главному входу
		ground(29, 6, -17.5, -27, M.asphalt, 5, 0.02); // от калитки вдоль главного корпуса
		ground(20, 9, 27, 12.5, M.asphalt, 5, 0.021); // стоянка персонала
		ground(4.5, 4.5, 15, 12.5, M.asphalt, 5, 0.022);
		ground(18, 2.2, -2.5, 4, M.concrete, 3, 0.018); // дорожки сквера
		ground(2.2, 12, -6, 11, M.concrete, 3, 0.017);
		ground(2.2, 13, -2, -3.5, M.concrete, 3, 0.017);
		ground(20, 9, 46, -27.5, M.concrete, 4, 0.016); // хоздвор
		// снаружи: стоянка, площадка у аптеки
		ground(28, 13, 12, 40.5, M.asphalt, 5, 0.021);
		ground(10, 20, -24, 44, M.concrete, 3, 0.017);
		const roads = [
			[-92, 92, 24, 32], [-40, -32, -92, 92], [6, 13, -17, 24], [-11, 43, -16.5, -9.5], [33, 46, -13, 1], [14, 28, -22.4, -16.4],
			[-3, 3, -30.5, -16.5], [-32, -3, -30, -24], [12.7, 37, 8, 17], [-2, 26, 34, 47], [-29, -19, 34, 54],
			[-92, 92, 21.8, 24], [-92, 92, 32, 34.2], [-32, -29.8, -92, 24], [36, 56, -32, -23],
		];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

		// ---------- Ограда: решётка на кирпичных столбах спереди, бетонные плиты по бокам и сзади ----------
		const railing = (x0, x1, z) => {
			const n = Math.max(1, Math.round((x1 - x0) / 3.6)), step = (x1 - x0) / n;
			for (let i = 0; i <= n; i++) {
				batch.add(place(box(0.5, 1.9, 0.5, 1), x0 + i * step, 0.95, z), M.brick);
				batch.add(place(box(0.6, 0.08, 0.6), x0 + i * step, 1.94, z), M.concrete);
			}
			for (let i = 0; i < n; i++) {
				const xm = x0 + (i + 0.5) * step, len = step - 0.5;
				for (const y of [0.25, 1.55]) batch.add(place(box(len, 0.05, 0.05), xm, y, z), M.metalDark);
				for (let k = 0.16; k < len - 0.05; k += 0.24) batch.add(place(box(0.025, 1.45, 0.025), xm - len / 2 + k, 0.9, z), M.metalDark);
			}
			collide((x0 + x1) / 2, z, x1 - x0, 0.5);
		};
		railing(FX0, -0.5, FZ1);
		railing(13.5, FX1, FZ1);
		// бетонные плиты со столбами — одним материалом (у concreteFence рёбра темнее: лишний вызов отрисовки на участок)
		const plates = (x0, z0, x1, z1, h = 2.3) => {
			const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(len / 4));
			for (let i = 0; i < n; i++) {
				const t = (i + 0.5) / n;
				batch.add(place(box(len / n - 0.05, h, 0.16, 1.2, 1.2), x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t, -ang), M.concrete);
			}
			for (let i = 0; i <= n; i++) batch.add(place(box(0.3, h + 0.2, 0.3), x0 + (x1 - x0) * i / n, (h + 0.2) / 2, z0 + (z1 - z0) * i / n, -ang), M.concrete);
			collide((x0 + x1) / 2, (z0 + z1) / 2, len, 0.4, -ang);
		};
		plates(FX0, FZ0, FX0, -31.4); // запад, до калитки
		plates(FX0, -22.6, FX0, FZ1);
		plates(FX0, FZ0, 10, FZ0); // север — с проломом
		plates(14, FZ0, FX1, FZ0);
		plates(FX1, FZ0, FX1, FZ1); // восток
		// упавшие плиты в проломе северной стены
		batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), 12, 0.3, FZ0 - 1.4, 0.2, 0.1, 0), M.concrete);
		batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), 12.6, 0.12, FZ0 + 1.6, -0.15), M.concrete);
		// калитка с запада и ворота въезда: кирпичные столбы
		for (const [x, z] of [[FX0, -31.4], [FX0, -22.6], [5.9, FZ1], [13.3, FZ1]]) {
			batch.add(place(box(0.7, 2.6, 0.7, 1), x, 1.3, z), M.brick);
			batch.add(place(box(0.85, 0.1, 0.85), x, 2.65, z), M.concrete);
			collide(x, z, 0.7, 0.7);
		}
		batch.add(place(box(0.05, 2.0, 1.8), FX0 + 0.35, 1.0, -32.4, 0.15), M.metalDark); // распахнутая створка калитки
		collide(FX0 + 0.35, -32.4, 0.25, 1.8, 0.15);
		barrier(batch, M, collide, 12.7, FZ1 - 0.9, Math.PI, 6.4, true); // шлагбаум поднят

		// ---------- Корпуса без входа: стены, окна по фасадам, плоская крыша с парапетом ----------
		// win — фасады с окнами: s (юг, его видит камера), e, w; floors — этажи по 3 м
		const block = (name, { cx, cz, W, D, floors, mat = M.whiteBrick, win = ['s'], skip = () => false, extra = null, min = 0.22 }) => {
			const fh = 3.1, H = floors * fh + 0.4;
			occluder(name, (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), mat);
				kb.add(place(box(W + 0.3, 0.5, D + 0.3, 2), cx, 0.25, cz), M.concrete); // цоколь
				kb.add(place(planeXZ(W, D, 4), cx, H + 0.03, cz), M.roofTar);
				for (const s of [-1, 1]) {
					kb.add(place(box(W + 0.4, 0.5, 0.25, 2), cx, H + 0.25, cz + s * (D / 2 + 0.075)), M.concrete);
					kb.add(place(box(0.25, 0.5, D - 0.1, 2), cx + s * (W / 2 + 0.075), H + 0.25, cz), M.concrete);
				}
				for (const side of win) {
					const along = side === 's' ? W : D, n = Math.floor((along - 1.2) / 3.2);
					// межэтажные пояса по фасаду
					for (let f = 1; f < floors; f++) {
						const y = 0.4 + f * fh;
						if (side === 's') kb.add(place(box(W + 0.05, 0.16, 0.08), cx, y, cz + D / 2 + 0.04), M.concrete);
						else kb.add(place(box(0.08, 0.16, D + 0.05), cx + (side === 'e' ? 1 : -1) * (W / 2 + 0.04), y, cz), M.concrete);
					}
					for (let i = 0; i < n; i++) for (let f = 0; f < floors; f++) {
						const a = -along / 2 + (along - (n - 1) * 3.2) / 2 + i * 3.2, y = 0.4 + f * fh + 1.55;
						if (skip(side, a, f)) continue;
						const h = hash01(name, side, i, f);
						const k = f === 0 ? (h < 0.35 ? 6 : h < 0.55 ? 5 : h < 0.8 ? 4 : 7) : (h < 0.1 ? 6 : h < 0.3 ? 5 : h < 0.55 ? 7 : 4);
						// клетка 6 атласа — заколоченное окно (доски нарисованы), отдельных досок не кладём: лишний материал
						const g = T.windowUV(new THREE.PlaneGeometry(1.62, 1.44), k);
						if (side === 's') g.translate(cx + a, y, cz + D / 2 + 0.02);
						else if (side === 'e') g.rotateY(Math.PI / 2).translate(cx + W / 2 + 0.02, y, cz - a);
						else g.rotateY(-Math.PI / 2).translate(cx - W / 2 - 0.02, y, cz + a);
						kb.add(g, M.window);
					}
				}
				extra?.(kb, H);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.4, hz: D / 2 + 0.6, top: H + 0.6 }, min);
			collide(cx, cz, W, D);
			return H;
		};

		// главный корпус (5 этажей): портал входа с колоннами, вывеска, крест, машинное отделение лифтов на крыше
		block('MainBlock', {
			cx: 8, cz: -37, W: 44, D: 13, floors: 5,
			skip: (side, a, f) => (f === 0 && Math.abs(8 + a) < 3) || (f === 1 && Math.abs(8 + a) < 5.5), // вход: портал и вывеска
			extra: (kb, H) => {
				const z = -30.5;
				kb.add(place(box(9, 0.35, 4.2, 2), 0, 3.6, z + 2.1), M.concrete); // плита портала
				kb.add(place(box(9.2, 0.5, 0.2, 2), 0, 3.95, z + 4.15), M.concrete);
				for (const x of [-4, -1.4, 1.4, 4]) kb.add(place(new THREE.CylinderGeometry(0.22, 0.25, 3.45, 12), x, 1.73, z + 3.7), M.white);
				kb.add(place(box(2.6, 2.4, 0.06), 0, 1.3, z + 0.03), M.glass); // двери
				kb.add(place(box(0.1, 2.4, 0.08), 0, 1.3, z + 0.07), M.metalDark);
				const sign = new THREE.PlaneGeometry(8.4, 0.9);
				sign.translate(0, 4.6, z + 0.03);
				kb.add(sign, T.signMaterial('ГОРОДСКАЯ БОЛЬНИЦА №2', { bg: '#e8e4d8', fg: '#1a3a7a', w: 640, h: 72 }));
				// красный крест на белом щите между четвёртым и пятым этажом
				kb.add(place(box(1.5, 1.5, 0.06), 0, 13.6, z + 0.03), M.white);
				kb.add(place(box(1.2, 0.38, 0.08), 0, 13.6, z + 0.07), M.red);
				kb.add(place(box(0.38, 1.2, 0.08), 0, 13.6, z + 0.07), M.red);
				// машинное отделение лифтов и вентшахты на крыше
				kb.add(place(box(5, 2.6, 4, 2), 12, H + 1.3, -38), M.whiteBrick);
				kb.add(place(box(5.3, 0.15, 4.3, 2), 12, H + 2.65, -38), M.roofTar);
				for (const [x, z2] of [[-8, -35], [-2, -39.5], [22, -35.5], [26, -39]]) kb.add(place(box(1.0, 0.9, 0.6, 1), x, H + 0.45, z2), M.whiteBrick);
			},
		});
		for (const x of [-4, -1.4, 1.4, 4]) collide(x, -26.8, 0.55, 0.55); // колонны портала
		batch.add(place(box(7, 0.15, 2.2, 1), 0, 0.075, -29.4), M.concrete); // крыльцо
		batch.add(place(box(7.6, 0.08, 1.0, 1), 0, 0.04, -27.9), M.concrete);

		// терапевтический корпус (3 этажа): вход с проезда, козырёк
		block('Therapy', {
			cx: -17, cz: -6, W: 12, D: 26, floors: 3, win: ['s', 'e', 'w'],
			skip: (side, a, f) => side === 'e' && f === 0 && Math.abs(-6 - a + 13) < 2, // вход
			extra: (kb) => {
				kb.add(place(box(3.4, 0.25, 2.4, 2), -9.8, 2.9, -13), M.concrete);
				kb.add(place(box(0.06, 2.3, 2.0), -10.97, 1.25, -13), M.glass);
				const sign = new THREE.PlaneGeometry(4.6, 0.6).rotateY(Math.PI / 2);
				sign.translate(-10.97, 3.55, -13);
				kb.add(sign, T.signMaterial('ТЕРАПИЯ', { bg: '#e8e4d8', fg: '#1a3a7a', w: 384, h: 64 }));
			},
		});
		batch.add(place(box(1.6, 0.15, 3.0, 1), -10.2, 0.075, -13), M.concrete);

		// котельная с трубой и кучей угля
		block('Boiler', {
			cx: 39, cz: -43, W: 10, D: 8, floors: 2, mat: M.brick,
			extra: (kb) => {
				kb.add(place(box(2.6, 3.0, 0.08), 41.5, 1.5, -38.96), M.metalRust); // ворота
				kb.add(place(box(4, 0.4, 0.6), 41.5, 3.3, -38.7), M.metalRust);
			},
		});
		chimney(batch, M, collide, 46.5, -43, 24);
		batch.add(place(new THREE.IcosahedronGeometry(1.6, 1).scale(1.5, 0.45, 1), 35.5, 0.3, -36.4, 0.3), M.tire);
		collide(35.5, -36.4, 4.2, 2.6);

		// ---------- Приёмный покой (можно зайти) — пристройка к главному корпусу, навес для машин скорой ----------
		buildings.push(buildArmyBarracks(bctx, { name: 'Reception', cx: 20, cz: -26.4, ry: Math.PI }));
		occluder('BayCanopy', (kb) => {
			kb.add(place(box(12, 0.2, 6.4, 2), 21, 3.7, -19.5, 0, -0.04), M.roofGreen);
			for (const x of [15.4, 26.6]) kb.add(place(box(0.25, 3.7, 0.25), x, 1.85, -16.6), M.metalDark);
			kb.add(place(box(12, 0.45, 0.08), 21, 3.45, -16.3), M.metalDark); // карниз по краю навеса
		}, { cx: 21, cz: -19.5, ry: 0, hx: 6.2, hz: 3.3, top: 3.9 }, 0.15);
		for (const x of [15.4, 26.6]) collide(x, -16.6, 0.35, 0.35);
		ambulance(batch, M, collide, 17.6, -19.6, Math.PI / 2);
		ambulance(batch, M, collide, 24.6, -19.2, -Math.PI / 2 + 0.06);
		stretcher(batch, M, collide, 32, -21, 0.3);

		// ---------- Гараж скорой (можно зайти): профлист, стеллажи с запчастями; хоздвор ----------
		buildings.push(buildWarehouse(bctx, { name: 'AmbulanceGarage', cx: 51, cz: -4, ry: Math.PI / 2 }));
		ambulance(batch, M, collide, 37, -6.5, 0.05);
		ambulance(batch, M, collide, 37.5, 5.4, Math.PI - 0.3, { wreck: true });
		storageTank(batch, M, root, collide, 51, -30, 1.1, 5.5, M.tankWhite, 'КИСЛОРОД');
		storageTank(batch, M, root, collide, 54, -30, 1.1, 5.5, M.tankWhite, null);
		transformer(batch, root, M, collide, 40, -24);
		for (let i = 0; i < 3; i++) {
			beginProp('dumpster', 33 + i * 1.4, -27.2, 0);
			batch.add(place(box(1.2, 1.1, 0.9, 1), 33 + i * 1.4, 0.55, -27.2, R(-0.1, 0.1)), M.green);
			endProp();
		}
		collide(34.4, -27.2, 4.4, 1);
		for (const [x, z] of [[31.6, -25.9], [36.3, -26], [35.8, -28.4]]) {
			batch.add(place(new THREE.IcosahedronGeometry(0.32, 1).scale(1, 0.75, 1), x, 0.22, z, R(0, 3)), M.tire);
		}

		// ---------- Морг в дальнем углу (можно зайти), катафалк, каталки ----------
		buildings.push(buildGuardhouse(bctx, { name: 'Morgue', cx: -21, cz: -44, ry: Math.PI }));
		addCar(batch, M, root, -22, -37.5, 0.04, 0x1c1c1e);
		collide(-22, -37.5, 4.3, 1.8, 0.04);
		stretcher(batch, M, collide, -15.8, -39.6, Math.PI / 2 + 0.2);

		// ---------- КПП у въезда (можно зайти) ----------
		buildings.push(buildCheckpoint(bctx, { name: 'Checkpoint', cx: 2.5, cz: FZ1, ry: 0 }));

		// ---------- Сквер: клумба, беседка, лавочки, фонари; стоянка персонала ----------
		{
			const [x, z] = [-2, 4];
			batch.add(place(new THREE.CylinderGeometry(2.6, 2.6, 0.35, 20), x, 0.175, z), M.concrete);
			batch.add(place(new THREE.CircleGeometry(2.4, 20).rotateX(-Math.PI / 2), x, 0.36, z), M.dirt, { cast: false });
			for (let i = 0; i < 9; i++) {
				const a = i * 0.7, d = i % 3 ? 1.5 : 0.4;
				batch.add(place(new THREE.IcosahedronGeometry(0.32, 0).scale(1, 0.7, 1), x + Math.cos(a) * d, 0.5, z + Math.sin(a) * d, a), M.leaves);
			}
			collide(x, z, 4.6, 4.6);
		}
		{
			// беседка: шесть столбов, пол, шатровая крыша
			const [x, z] = [-7, 14];
			batch.add(place(new THREE.CylinderGeometry(2.3, 2.3, 0.15, 6), x, 0.075, z), M.wood);
			for (let i = 0; i < 6; i++) {
				const a = i * Math.PI / 3 + Math.PI / 6, px = x + Math.cos(a) * 2.05, pz = z + Math.sin(a) * 2.05;
				batch.add(place(box(0.14, 2.6, 0.14), px, 1.4, pz), M.woodGreen);
				if (i !== 1) collide(px, pz, 0.3, 0.3);
			}
			batch.add(place(new THREE.ConeGeometry(2.8, 1.3, 6), x, 3.35, z, Math.PI / 6), M.roofGreen);
			batch.add(place(box(1.6, 0.08, 0.4), x, 0.5, z - 1.2), M.woodGreen);
		}
		for (const [x, z, ry] of [[-6, -2.4, 0], [2, -2.4, 0], [-9.4, 4, Math.PI / 2], [4.6, 1.8, -Math.PI / 2], [-3.8, 9.4, Math.PI], [1.5, 6.2, Math.PI],
			[-3.6, -23, Math.PI / 2], [3.6, -23, -Math.PI / 2], [-8, -24.6, Math.PI]]) bench(batch, M, x, z, ry);
		for (const [x, z] of [[4.8, 7], [4.8, -7], [14.2, 3.5], [14.2, -7], [-4.2, -18.5], [4.2, -18.5], [30, -18.5]]) streetLamp(batch, M, collide, x, z);
		const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
		car(20, 12.6, Math.PI / 2 + 0.04, 0x8a8a7a);
		car(23.4, 12.3, Math.PI / 2 - 0.05, 0x5a6a7a);
		car(30.4, 12.8, Math.PI / 2 + 0.1, 0x2a2826, { burned: true });
		car(33.8, 12.4, -Math.PI / 2, 0x7b5a3a);
		for (const x of [18.3, 21.7, 25.1, 28.5, 31.9, 35.3]) batch.add(place(planeXZ(0.12, 4.6), x, 0.03, 12.5), M.white, { cast: false });

		// ---------- Улица: остановка, стоянка напротив въезда, аптека, брошенные машины ----------
		{
			const x = 27, z = 22.6; // остановка у ограды: навес открыт к дороге
			batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z - 0.7), M.concrete);
			batch.add(place(box(5.4, 0.15, 1.8, 1), x, 2.45, z), M.metalRust);
			for (const dx of [-2.4, 2.4]) batch.add(place(box(0.15, 2.4, 1.6, 1), x + dx, 1.2, z), M.concrete);
			batch.add(place(box(4, 0.08, 0.45), x, 0.5, z - 0.35), M.wood);
			collide(x, z - 0.3, 5.2, 1.0);
		}
		for (const x of [-52, -28, -4, 30, 54]) streetLamp(batch, M, collide, x, 35.2);
		car(0.5, 37.6, -Math.PI / 2, 0x9a9a8a);
		car(6.6, 37.4, -Math.PI / 2 + 0.08, 0x3a5a3a);
		car(16.2, 37.8, -Math.PI / 2 - 0.05, 0xa8402c, { crashed: true });
		car(22.4, 37.5, -Math.PI / 2, 0xc8c0a8);
		car(3.2, 44.2, Math.PI / 2 + 0.06, 0x2a3a5a);
		car(13, 44, Math.PI / 2, 0x6a6a5a);
		for (const x of [-0.8, 2.4, 5.6, 8.8, 12, 15.2, 18.4, 21.6, 24.8]) {
			batch.add(place(planeXZ(0.12, 4.4), x, 0.03, 37.5), M.white, { cast: false });
			batch.add(place(planeXZ(0.12, 4.4), x, 0.03, 44.3), M.white, { cast: false });
		}
		buildings.push(buildShop(bctx, { cx: -14, cz: 46 }));
		for (let i = 0; i < 3; i++) batch.add(place(box(1.2, 0.15, 0.8), -7.8, 0.08 + i * 0.16, 53, R(-0.2, 0.2)), M.wood); // поддоны у чёрного хода
		collide(-7.8, 53, 1.3, 1);
		car(-14, 26.4, 0.3, 0x8a2e24, { crashed: true });
		car(34, 29.6, Math.PI + 0.2, 0x1c1a18, { burned: true });
		car(-34.3, -44, Math.PI / 2 + 0.12, 0x5a6a3a);
		ambulance(batch, M, collide, -37.6, -6, -Math.PI / 2 - 0.25, { wreck: true });
		bus(batch, M, root, -50, 29.6, Math.PI / 2 + 0.04);
		collide(-50, 29.6, 2.6, 8.4, Math.PI / 2 + 0.04);

		// ---------- Панельная четырёхэтажка за улицей (без входа) ----------
		{
			const cx = 44, cz = 50, W = 32, D = 11, H = 11.2;
			occluder('Panel', (kb) => {
				kb.add(place(box(W, H, D, 3.2, 2.8), cx, H / 2 + 0.6, cz), M.panel);
				kb.add(place(box(W + 0.3, 0.8, D + 0.3, 2), cx, 0.4, cz), M.brick);
				kb.add(place(planeXZ(W, D, 4), cx, H + 0.63, cz), M.roofTar);
				for (const s of [-1, 1]) {
					kb.add(place(box(W + 0.4, 0.55, 0.25, 2), cx, H + 0.87, cz + s * (D / 2 + 0.075)), M.concrete);
					kb.add(place(box(0.25, 0.55, D - 0.1, 2), cx + s * (W / 2 + 0.075), H + 0.87, cz), M.concrete);
				}
				for (const ex of [-10, 0, 10]) {
					const x = cx + ex, z = cz - D / 2;
					kb.add(place(box(2.6, 0.15, 1.6), x, 2.9, z - 0.8), M.concrete); // козырёк подъезда
					kb.add(place(box(1.3, 2.2, 0.1), x, 1.7, z - 0.05), M.metalRust);
					kb.add(place(box(2.0, 1.8, 1.6, 2), x, H + 1.5, cz + 1.2), M.brick); // выход на крышу
				}
			}, { cx, cz, ry: 0, hx: W / 2 + 0.6, hz: D / 2 + 1.2, top: H + 2.4 }, 0.16);
			collide(cx, cz, W + 0.4, D + 0.4);
			for (const ex of [-10, 0, 10]) {
				batch.add(place(box(2.4, 0.3, 1.2, 1), cx + ex, 0.15, cz - D / 2 - 0.6), M.concrete);
				bench(batch, M, cx + ex + 2.3, cz - D / 2 - 2.2, 0);
			}
		}

		// ---------- Частные дома за улицей на север (можно зайти) ----------
		buildings.push(
			buildHouse(bctx, { name: 'House1', cx: -52, cz: -38, ry: -Math.PI / 2, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: -52, cz: -12, ry: -Math.PI / 2, rnd, variant: 1 }),
		);
		fencePlot(batch, M, collide, -51, -38, 16, 18, 'e', rnd);
		fencePlot(batch, M, collide, -51, -12, 16, 18, 'e', rnd);
		shed(batch, M, collide, -56.4, -30.6, 0.05);
		shed(batch, M, collide, -56.2, -19.4, -0.08);
		garden(batch, M, rnd, -47, -43, 3, 5);
		garden(batch, M, rnd, -47, -5.5, 3, 4.5);
		woodpile(batch, M, collide, -56.6, -45.4, 0);
		outhouse(batch, M, collide, -45.4, -19.6, Math.PI);

		// ================= Новые районы (локация 180×180 м) =================
		// всё новое — после прежнего: генератор случайных чисел для старого квартала идёт как раньше

		// ---------- Проезды и площадки ----------
		ground(8, 58, -36, 61, M.asphalt, 5, 0.021); // улица на юг — продолжение северной (уходит в муть)
		ground(54, 0.15, -36, 63, mark, 6, 0.027, Math.PI / 2);
		ground(7, 91, 63.5, -21.5, M.asphalt, 5, 0.021); // проезд вдоль восточной ограды: гаражи скорой, инфекционка
		ground(8.5, 30, 71.25, -22, M.asphalt, 5, 0.022); // площадка у гаражей скорой
		ground(19, 20, 76.5, 8, M.asphalt, 5, 0.022); // стоянка
		ground(42, 7, 48, -63.5, M.concrete, 3, 0.016); // двор инфекционного отделения
		ground(20, 20, -4, -72, M.concrete, 4, 0.018); // вертолётная площадка
		ground(16, 6, -22, -72, M.asphalt, 5, 0.021); // подъезд к ней с улицы
		ground(3, 12, 12, -57, M.dirt, 4, 0.017); // тропа от пролома к будке диспетчера
		ground(15, 16, -47.5, -70, M.concrete, 3, 0.016); // двор котельной
		ground(36, 8, -14, 59, M.asphalt, 5, 0.021); // площадка у поликлиники
		ground(4, 4.2, -54.6, 36.2, M.concrete, 3, 0.018); // к аптеке
		ground(33, 7, -56.5, 61.5, M.asphalt, 5, 0.02); // двор общежития
		ground(54, 2.6, 35, 72, M.concrete, 3, 0.017); // аллеи парка
		ground(2.6, 28, 35, 72, M.concrete, 3, 0.0175);
		ground(2.2, 11, 12, 52.5, M.concrete, 3, 0.017);
		roads.push(
			[60, 67, -67, 24], [67, 75.5, -37, -7], [67, 86, -2, 18], [27, 69, -67, -60], [-14, 6, -82, -62], [-30, -14, -75, -69],
			[10.5, 13.5, -63, -51], [-55, -40, -78, -62], [-32, 4, 55, 63], [-56.6, -52.6, 34, 38.3], [-73, -40, 58, 65],
			[8, 62, 70.7, 73.3], [33.7, 36.3, 58, 86], [10.9, 13.1, 47, 58],
		);

		// ---------- Юг: поликлиника и площадка перед ней ----------
		buildings.push(buildPolyclinic(bctx, occluder, { cx: -12, cz: 70 }));
		ambulance(batch, M, collide, -4.5, 58.8, Math.PI - 0.08);
		car(-27, 59, Math.PI / 2, 0x6a7a8a);
		car(-23.4, 58.8, Math.PI / 2 - 0.06, 0x8a7a5a, { crashed: true });
		for (const x of [-25.2, -21.6]) batch.add(place(planeXZ(0.12, 4.6), x, 0.03, 59), M.white, { cast: false });
		for (const [x, z, ry] of [[-16.5, 62.6, Math.PI], [-6, 62.6, Math.PI], [-13.5, 55.6, 0]]) bench(batch, M, x, z, ry);
		for (const [x, z] of [[-30.2, 50], [-30.2, 74], [3.6, 57]]) streetLamp(batch, M, collide, x, z);

		// ---------- Угловая аптека ----------
		buildings.push(buildPharmacy(bctx, { cx: -52, cz: 42 }));
		for (let i = 0; i < 3; i++) batch.add(place(box(1.2, 0.15, 0.8), -46.2, 0.08 + i * 0.16, 47.5, 0.1 * i), M.wood); // поддоны у чёрного хода
		collide(-46.2, 47.5, 1.3, 1);

		// ---------- Общежитие медперсонала: двор с машиной и мусорными баками ----------
		buildings.push(buildDorm(bctx, occluder, { cx: -62, cz: 70 }));
		car(-69, 61.3, 0.05, 0x4a5a6a);
		for (let i = 0; i < 2; i++) {
			beginProp('dumpster', -46 + i * 1.4, 63.3, 0);
			batch.add(place(box(1.2, 1.1, 0.9, 1), -46 + i * 1.4, 0.55, 63.3), M.green);
			endProp();
		}
		collide(-45.3, 63.3, 3.0, 1);
		for (const [x, z] of [[-57, 64.2], [-66.5, 64.2]]) bench(batch, M, x, z, 0);
		streetLamp(batch, M, collide, -51, 58.8);

		// ---------- Больничный парк: аллеи крестом, фонтан, беседка, клумбы, пруд, памятник, низкая ограда ----------
		{
			const [fx, fz] = [35, 72];
			batch.add(place(new THREE.CircleGeometry(6.5, 28).rotateX(-Math.PI / 2), fx, 0.019, fz), M.concrete, { cast: false });
			batch.add(place(cyl(3.0, 3.1, 0.6, 24), fx, 0.3, fz), M.concrete); // чаша фонтана
			batch.add(place(new THREE.CircleGeometry(2.75, 24).rotateX(-Math.PI / 2), fx, 0.52, fz), M.water, { cast: false });
			batch.add(place(cyl(0.35, 0.5, 1.6, 12), fx, 0.8, fz), M.concrete);
			batch.add(place(cyl(1.0, 0.3, 0.3, 16), fx, 1.7, fz), M.concrete);
			collide(fx, fz, 6.0, 6.0);
			// скамейки кругом, лицом к фонтану
			for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; bench(batch, M, fx + Math.cos(a) * 5.4, fz + Math.sin(a) * 5.4, Math.PI / 2 - a); }
		}
		{
			// беседка: шесть столбов, пол, шатровая крыша
			const [x, z] = [18, 80];
			batch.add(place(new THREE.CylinderGeometry(2.3, 2.3, 0.15, 6), x, 0.075, z), M.wood);
			for (let i = 0; i < 6; i++) {
				const a = i * Math.PI / 3 + Math.PI / 6, px = x + Math.cos(a) * 2.05, pz = z + Math.sin(a) * 2.05;
				batch.add(place(box(0.14, 2.6, 0.14), px, 1.4, pz), M.woodGreen);
				if (i !== 4) collide(px, pz, 0.3, 0.3);
			}
			batch.add(place(new THREE.ConeGeometry(2.8, 1.3, 6), x, 3.35, z, Math.PI / 6), M.roofGreen);
			batch.add(place(box(1.6, 0.08, 0.4), x, 0.5, z + 1.2), M.woodGreen);
		}
		for (const [x, z] of [[22, 65], [48, 65], [26, 79]]) { // клумбы
			batch.add(place(cyl(1.8, 1.8, 0.35, 16), x, 0.175, z), M.concrete);
			batch.add(place(new THREE.CircleGeometry(1.6, 16).rotateX(-Math.PI / 2), x, 0.36, z), M.dirt, { cast: false });
			for (let i = 0; i < 6; i++) { const a = i * 1.05, d = i % 2 ? 1.0 : 0.3; batch.add(place(new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.7, 1), x + Math.cos(a) * d, 0.48, z + Math.sin(a) * d, a), M.leaves); }
			collide(x, z, 3.2, 3.2);
		}
		pond(batch, root, M, collide, 52, 80, 5, 2.8, rnd);
		{
			// памятник врачу: постамент и бюст
			const [x, z] = [52, 64.5];
			batch.add(place(box(2.0, 0.2, 2.0), x, 0.1, z), M.concrete);
			batch.add(place(box(1.4, 1.8, 1.4, 1), x, 1.0, z), M.concrete);
			batch.add(place(box(0.8, 0.7, 0.5), x, 2.25, z), M.metalDark);
			batch.add(place(new THREE.SphereGeometry(0.32, 10, 8), x, 2.85, z), M.metalDark);
			collide(x, z, 2.0, 2.0);
		}
		for (const [x, z, ry] of [[14, 70.2, Math.PI], [24, 74.2, 0], [46, 70.2, Math.PI], [58, 74.2, 0], [33.2, 63, Math.PI / 2], [36.8, 82, -Math.PI / 2]]) bench(batch, M, x, z, ry);
		for (const [x, z] of [[26, 69.8], [44, 69.8], [37.2, 61], [37.2, 84]]) streetLamp(batch, M, collide, x, z);
		for (const [x0, x1] of [[8, 10.6], [13.4, 33.4], [36.6, 62]]) {
			const z = 58.3, len = x1 - x0;
			for (const y of [0.35, 0.85]) batch.add(place(box(len, 0.05, 0.05), (x0 + x1) / 2, y, z), M.metalDark);
			for (let x = x0; x <= x1 + 0.01; x += 2) batch.add(place(box(0.08, 0.95, 0.08), x, 0.47, z), M.metalDark);
			collide((x0 + x1) / 2, z, len, 0.2);
		}

		// ---------- Восток: гаражи подстанции скорой, стоянка ----------
		buildings.push(buildBays(bctx, { name: 'AmbulanceBays', cx: 79, cz: -22, loot: [
			{ kind: 'bench', loot: { ammo919: [3, 6, 0.4], medkit: [1, 1, 0.35], fuel: [1, 1, 0.2] } }, null,
			{ kind: 'rack', loot: { medkit: [1, 2, 0.45], ammo12: [3, 6, 0.3], parts: [1, 1, 0.25] } }, null,
			{ kind: 'locker', loot: { ammo545: [5, 10, 0.3], medkit: [1, 1, 0.4], spore: 0.25 } }, null,
		] }));
		for (const z of [-28.75, -19.75, -10.75]) ambulance(batch, M, collide, 70, z + R(-0.3, 0.3), R(-0.06, 0.06));
		for (const [x, z, ry, c, o] of [[72, 1.2, 0, 0x8a8a7a], [72, 4.7, 0.05, 0x3a4a6a], [72, 11.6, -0.04, 0xa89a7a], [82.2, 1.5, Math.PI, 0x5a3a2a],
			[82.2, 5.0, Math.PI + 0.1, 0x2a2826, { burned: true }], [82.2, 12, Math.PI, 0x6a7a5a], [82.2, 15.4, Math.PI - 0.06, 0x9a3a2a, { crashed: true }]]) car(x, z, ry, c, o);
		ambulance(batch, M, collide, 72.3, 15.3, 0.03);
		for (const z of [-0.55, 2.95, 6.45, 9.95, 13.45, 16.95]) for (const x of [72, 82.2]) batch.add(place(planeXZ(4.6, 0.12), x, 0.03, z), M.white, { cast: false });
		for (const z of [-3.5, 19]) streetLamp(batch, M, collide, 67.6, z);
		for (const x of [-76, 78]) streetLamp(batch, M, collide, x, 35.2);
		car(80, 26.5, 0.2, 0x5a5a52, { crashed: true });

		// ---------- Северо-восток: инфекционное отделение за бетонной оградой с колючкой ----------
		{
			const IX0 = 20, IX1 = 84, IZ0 = -84.5, IZ1 = -59;
			const wire = (x0, z0, x1, z1) => { // колючка: три нитки поверх плит
				const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
				for (const y of [2.38, 2.52, 2.66]) batch.add(place(box(len, 0.03, 0.03), (x0 + x1) / 2, y, (z0 + z1) / 2, -ang), M.metalDark);
			};
			for (const [x0, z0, x1, z1] of [[IX0, IZ1, 27, IZ1], [31, IZ1, 60, IZ1], [67, IZ1, IX1, IZ1], [IX0, IZ0, IX1, IZ0], [IX0, IZ0, IX0, IZ1], [IX1, IZ0, IX1, IZ1]]) {
				plates(x0, z0, x1, z1);
				wire(x0, z0, x1, z1);
			}
			batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), 29, 0.2, IZ1 + 1.3, 0.15, 0.08, 0), M.concrete); // упавшая плита в проломе
			for (const x of [60, 67]) { batch.add(place(box(0.7, 2.8, 0.7, 1), x, 1.4, IZ1), M.concrete); collide(x, IZ1, 0.7, 0.7); }
			barrier(batch, M, collide, 67.4, IZ1 + 0.9, Math.PI, 6.6, true);
			billboard(batch, M, root, collide, 54, IZ1 + 1.6, 0, 'КАРАНТИН! ВХОД ЗАПРЕЩЁН', { w: 4.6, h: 0.9, y: 1.9, bg: '#e8e4d8', fg: '#8a1a10' });
			buildings.push(buildInfection(bctx, batch, collide, { cx: 44, cz: -73 }));
			tent(batch, M, collide, 72, -70, 0.05);
			ambulance(batch, M, collide, 63, -77, Math.PI / 2 + 0.3, { wreck: true });
			hazardBarrels(batch, M, collide, 24, -64, rnd, 5);
			hazardBarrels(batch, M, collide, 77, -80, rnd, 6);
			stretcher(batch, M, collide, 68, -64.5, 0.6);
			stretcher(batch, M, collide, 25.5, -76, Math.PI / 2 - 0.2);
		}

		// ---------- Север: вертолётная площадка санавиации, будка диспетчера ----------
		{
			const [px, pz] = [-4, -72];
			batch.add(place(new THREE.RingGeometry(6.2, 6.7, 32).rotateX(-Math.PI / 2), px, 0.03, pz), M.white, { cast: false });
			for (const [w, d, dx] of [[0.7, 5.0, -1.4], [0.7, 5.0, 1.4], [2.1, 0.7, 0]]) batch.add(place(planeXZ(w, d), px + dx, 0.032, pz), M.white, { cast: false }); // буква H
			for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; batch.add(place(box(0.3, 0.12, 0.3), px + Math.cos(a) * 9.4, 0.06, pz + Math.sin(a) * 9.4), M.yellow); } // огни по краю
			helicopter(batch, M, collide, px - 0.5, pz + 0.5, 0.35);
			batch.add(place(box(0.1, 5, 0.1), 7.5, 2.5, -81), M.metalDark); // ветроуказатель
			batch.add(place(cyl(0.35, 0.15, 2.2, 10).rotateZ(Math.PI / 2 - 0.25), 8.6, 4.6, -81), M.red);
			collide(7.5, -81, 0.3, 0.3);
		}
		buildings.push(buildHeliBooth(bctx, { cx: 12, cz: -66 }));

		// ---------- Северо-запад: центральная котельная с трубой, кучи угля ----------
		buildings.push(buildBoilerHouse(bctx, { name: 'BoilerHouse', cx: -62, cz: -70 }));
		chimney(batch, M, collide, -62, -78.4, 24);
		batch.add(place(box(1.0, 0.9, 3.0), -62, 4.2, -75.6), M.metalRust); // боров к трубе
		for (const [x, z, s] of [[-48, -75, 1.7], [-44.5, -66, 1.3]]) {
			batch.add(place(new THREE.IcosahedronGeometry(s, 1).scale(1.6, 0.5, 1.2), x, 0.3, z, x * 0.1), M.tire);
			collide(x, z, s * 3, s * 2.2);
		}

		return {
			start: [-82.5, 28, Math.PI / 2],
			exits: [
				{ to: 'podstanciya', x0: -90, x1: -85.2, z0: 24, z1: 32, spawn: [-82.5, 28, Math.PI / 2], sign: [-84, 35, '← Подстанция'] },
				{ to: 'zarechny', x0: -40, x1: -32, z0: -90, z1: -85.2, spawn: [-36, -82.5, 0], sign: [-29.6, -84, '↑ Заречный'] },
			],
			// заражённые: бегуны у корпусов, в сквере, на улице; топтуны водят стаи у приёмного покоя, морга, хоздвора
			groups: [
				{ at: [22, -14], r: 6, runners: 2, stompers: 1 },
				{ at: [-2, -24], r: 6, runners: 3 },
				{ at: [-4, -6], r: 8, runners: 2 },
				{ at: [28, -3], r: 7, runners: 2 },
				{ at: [-6, -15], r: 5, runners: 2, stompers: 1 },
				{ at: [-20, -35], r: 5, runners: 2, stompers: 1 },
				{ at: [8, -47], r: 7, runners: 2 },
				{ at: [44, -32], r: 6, runners: 2, stompers: 1 },
				{ at: [47, -5], r: 6, runners: 3 }, // у ворот гаража и в нём
				{ at: [9, 13], r: 5, runners: 2 },
				{ at: [26, 4], r: 5, runners: 1 },
				{ at: [-20, 28], r: 9, runners: 2 },
				{ at: [40, 28], r: 9, runners: 2 },
				{ at: [12, 41], r: 7, runners: 2, stompers: 1 },
				{ at: [-24, 44], r: 5, runners: 2 },
				{ at: [-46, -25], r: 7, runners: 2 },
				{ at: [-36, -48], r: 7, runners: 2 },
				{ at: [42, 40], r: 7, runners: 2, stompers: 1 },
				{ at: [-44, 46], r: 8, runners: 2 },
				// новые районы: топтуны в коридорах поликлиники, общежития и инфекционки, рубер во дворе инфекционки
				{ at: [-12, 70], r: 5, runners: 2, stompers: 1 },
				{ at: [-14, 59], r: 7, runners: 3 },
				{ at: [-52, 50], r: 5, runners: 2 },
				{ at: [-58, 61], r: 6, runners: 3 },
				{ at: [-62, 70], r: 4, runners: 1, stompers: 1 },
				{ at: [30, 75], r: 8, runners: 3 },
				{ at: [50, 70], r: 6, runners: 2 },
				{ at: [44, -69], r: 5, runners: 2, stompers: 1 },
				{ at: [76, -77], r: 5, runners: 2, rubers: 1 },
				{ at: [-4, -64], r: 6, runners: 2 },
				{ at: [71, -22], r: 6, runners: 3, stompers: 1 },
				{ at: [77, 8], r: 5, runners: 2 },
				{ at: [-50, -68], r: 6, runners: 2, stompers: 1 },
				{ at: [-74, -6], r: 8, runners: 2 },
			],
			onRoad,
			// горит машина на улице, костёр в сквере, догорает машина на новой стоянке
			fires: [[34, 29.6, 'car'], [-6.5, -6.5, 'ground'], [82.2, 5.0, 'car']],
			trees(tryTree) {
				// сквер и газоны — берёзы, у домов — яблони, вдоль улицы — ряд берёз
				for (let i = 0; i < 18; i++) tryTree(R(-10, 4.5), R(-8, 18.5), 'birch');
				for (let i = 0; i < 14; i++) tryTree(R(14, 42), R(-8, 7), 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(-26, -12), R(9, 18.5), 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-26, 40), R(-48.5, -45), 'birch');
				for (let x = -60; x < 62; x += 7) tryTree(x + R(-1.5, 1.5), 35.8 + R(-0.4, 0.6), 'birch');
				for (let i = 0; i < 6; i++) tryTree(R(-58, -44), R(-46, -30), 'apple');
				for (let i = 0; i < 6; i++) tryTree(R(-58, -44), R(-20, -4), 'apple');
				for (let i = 0; i < 12; i++) tryTree(R(-60, -42), R(36, 60), 'birch');
				// новые районы: берёзы в больничном парке, ряд вдоль продолжения улицы, роща на западе, у южного края
				for (let i = 0; i < 30; i++) tryTree(R(9, 61), R(59, 85.5), 'birch');
				for (const x of [-86, -79, -72, -65, 66, 73, 80, 86]) tryTree(x + R(-1.2, 1.2), 35.8 + R(-0.4, 0.6), 'birch');
				for (let i = 0; i < 20; i++) tryTree(R(-86, -62), R(-46, 18), 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-86, -76), R(40, 86), 'birch');
			},
			beltTrees: ['birch'], // город: одни берёзы (каждый вид дерева на участке — лишние вызовы отрисовки)
			beltDensity: 1.4,
			clutter: 14,
			blood: 16,
			puddles: 8,
			puddle: () => [R(-86, 86), rnd() < 0.5 ? R(24.5, 31.5) : R(-84, 84)],
			grass: 0.9,
			hint: (b) => ({
				Reception: 'Приёмный покой — обыщи тумбочки у коек и шкафы с лекарствами',
				AmbulanceGarage: 'Гараж скорой — обыщи стеллажи с запчастями и ящики',
				Morgue: 'Морг — в шкафу охраны бывают патроны 12 калибра, в сейфе — автоматные',
				Checkpoint: 'КПП больницы — обыщи стол дежурного и шкаф',
				Shop: 'Аптека — живчики на витрине и стеллажах, в сейфе — патроны',
				Polyclinic: 'Поликлиника — регистратура, шкафы врачей и процедурной (аптечки), реактивы в лаборатории, сейф главврача',
				Pharmacy: 'Аптека на углу — прилавок, стеллаж с лекарствами, холодильник с вакцинами и сейф',
				Dormitory: 'Общежитие медперсонала — шкаф, тумбочки у коек, холодильник на кухне',
				Infection: 'Инфекционное отделение — пост медсестры, сейф, шкаф с лекарствами, холодильник лаборатории',
				AmbulanceBays: 'Гаражи скорой — верстак, стеллаж с запчастями и шкафчик водителя в открытых боксах',
				BoilerHouse: 'Котельная — шкафчик кочегара и верстак',
				HeliBooth: 'Будка санавиации — стол диспетчера с аптечками',
			}[b.name] ?? 'Дом — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
