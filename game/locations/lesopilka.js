// Кластер «Лесопилка»: лесопилка «Кедр» у реки на окраине Улья. Вдоль западного края течёт река (по воде не
// пройти): у берега — бон и сплавные брёвна, бревнотаска поднимает их под навес пилорамы (рама, тележки на рельсах).
// Рядом — цех (станки, верстак, шкафчики, конторка мастера с сейфом), на севере — склад круглого леса: штабеля
// брёвен; на юге — штабеля досок под листами железа, кучи опилок, печь для отходов, мостки с лодкой. Через двор
// проходит грунтовка: на юг (к Дачам) и на север (к «Карьеру»). У дороги — контора (оружейный шкаф сторожа,
// сейф), навес с трактором и прицепом-роспуском, лесовоз; за дорогой — посёлок рабочих: барак и два дома
// с огородами. Кругом сосновый лес, на востоке — пожарная вышка.
// Локация 180×180 м: вокруг прежней лесопилки (132×132) — новые районы. На севере — новый склад круглого леса со
// штабелями брёвен (укрытия) под козловым краном и гараж лесовозов; на северо-востоке у края — делянка с пнями и
// порубочными остатками. На востоке вдоль промдороги — котельная на опилках с трубой и сушильные камеры; посёлок
// рабочих продолжается на восток: столовая, второй барак, дом и домик с огородами. На юге у реки — причал
// с баржей и краном-укосиной, будка причала. Река продлена на всю высоту локации.
// Опасность 1: тихая окраина — бегуны, один-два топтуна.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ } from '../geom.js';
import { boxTop } from '../facade.js';
import { Building, table, chair, buildWorkshop, buildArmyBarracks, buildHouse, buildGuardhouse, buildDacha } from '../buildings.js';
import { addCar, fencePlot, woodpile, outhouse, well, shed, garden, transformer, bench } from '../props.js';
import { armyTruck, watchTower, storageTank, billboard, chimney } from '../props-industrial.js';

// река вдоль западного края: середина и полуширина русла по z (берег всегда западнее x = −56,7 — дальний берег
// за водой недостижим, туда не попадают бродячие стаи)
const riverX = (z) => -51 + 1.5 * Math.sin(z / 16 + 0.6);
const riverHW = (z) => 8 + 0.8 * Math.sin(z / 21 + 1.7);
const bankL = (z) => riverX(z) - riverHW(z);
const bankR = (z) => riverX(z) + riverHW(z);
const PIER_Z = 35; // мостки: полоса z 34…36 (как одна полоса коллайдеров реки)
const PIER_LEN = 7.5;
const QUAY_Z0 = 64, QUAY_Z1 = 68, QUAY_LEN = 8; // причал с баржей: полоса z 64…68 (две полосы коллайдеров реки)

/** Лента вдоль z между линиями left(z) и right(z) на высоте y; развёртка — в метрах / s (вода, берега). */
function ribbon(left, right, y, s, z0 = -72, z1 = 72, step = 2) {
	const pos = [], uv = [], nrm = [], idx = [];
	for (let z = z0, i = 0; z <= z1 + 1e-6; z += step, i++) {
		const a = left(z), b = right(z);
		pos.push(a, y, z, b, y, z);
		uv.push(a / s, -z / s, b / s, -z / s);
		nrm.push(0, 1, 0, 0, 1, 0);
		if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	return g;
}

/** Колёсный трактор («Беларус»): красный капот и крыша кабины, большие задние колёса. Перед — локальная +X. */
function tractor(batch, M, collide, x, z, ry) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(3.0, 0.45, 0.9), M.metalDark, 0.2, 0.75, 0); // рама
	add(box(1.7, 0.75, 0.95, 1.2), M.red, 0.85, 1.32, 0); // капот
	add(box(0.1, 0.5, 0.8), M.metalDark, 1.72, 1.25, 0); // решётка радиатора
	add(box(1.25, 1.2, 1.35), M.metalDark, -0.75, 2.1, 0); // кабина (стёкла сверху — тёмные)
	add(box(1.45, 0.1, 1.55), M.red, -0.75, 2.75, 0); // крыша кабины
	for (const s of [-1, 1]) {
		add(new THREE.CylinderGeometry(0.78, 0.78, 0.45, 16).rotateX(Math.PI / 2), M.tire, -0.75, 0.78, s * 0.98);
		add(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 12).rotateX(Math.PI / 2), M.tire, 1.25, 0.45, s * 0.72);
		add(box(1.4, 0.06, 0.5), M.red, -0.75, 1.62, s * 0.98); // крылья над задними колёсами
	}
	add(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), M.metalDark, 1.3, 2.1, 0.32); // выхлопная труба
	collide(x, z, 3.7, 2.5, ry);
}

const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);

/** Лесовоз (МАЗ с кониками): кабина, капот, рама, коники со стойками, брёвна. Перед — локальная +X; paint — материал кабины. */
function logTruck(batch, M, collide, x, z, ry, paint) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(9.0, 0.35, 0.9), M.metalDark, -0.5, 0.95, 0); // рама
	add(box(1.9, 1.7, 2.4, 1.2), paint, 3.0, 2.0, 0); // кабина
	add(box(0.06, 0.7, 2.1), M.glass, 3.97, 2.35, 0);
	add(box(1.2, 1.0, 2.3, 1.2), paint, 4.4, 1.45, 0); // капот
	add(box(0.12, 0.6, 2.0), M.metalDark, 5.0, 1.2, 0);
	add(box(0.4, 0.15, 2.4), M.metalDark, 5.05, 0.75, 0); // бампер
	for (const s of [-1, 1]) {
		for (const wx of [3.6, -1.4, -2.9]) add(cyl(0.55, 0.55, 0.4, 16).rotateX(Math.PI / 2), M.tire, wx, 0.55, s * 1.05);
		add(box(1.4, 0.06, 0.5), M.metalDark, 3.6, 1.25, s * 1.05);
	}
	add(box(0.3, 2.4, 2.5), M.metalDark, 1.9, 1.9, 0); // щит за кабиной
	for (const kx of [0.2, -3.6]) {
		add(box(0.3, 0.25, 2.4), M.metalDark, kx, 1.25, 0);
		for (const s of [-1, 1]) add(box(0.12, 1.6, 0.12), M.metalDark, kx, 2.1, s * 1.15);
	}
	for (const [dy, dz] of [[1.62, -0.75], [1.62, -0.25], [1.62, 0.25], [1.62, 0.75], [2.08, -0.5], [2.08, 0], [2.08, 0.5], [2.52, -0.25], [2.52, 0.25]]) {
		add(cyl(0.24, 0.26, 6.6, 8).rotateZ(Math.PI / 2), M.bark, -1.7, dy, dz);
	}
	const c = Math.cos(ry), s = Math.sin(ry);
	collide(x + c * 0.12, z - s * 0.12, 10.4, 2.6, ry);
}

/** Баржа у причала: плоский корпус наполовину в воде, борта, рубка на корме, на палубе — брёвна. Длина — вдоль локальной X. */
function barge(batch, M, x, z, ry) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(14, 1.0, 5, 2), M.metalRust, 0, 0.15, 0);
	for (const s of [-1, 1]) { add(box(14.2, 0.35, 0.25), M.metalDark, 0, 0.8, s * 2.5); add(box(0.25, 0.35, 5), M.metalDark, s * 7, 0.8, 0); }
	add(box(2.4, 2.2, 3.2, 1.2), M.white, -5.4, 1.75, 0); // рубка
	add(box(2.7, 0.12, 3.5), M.metalDark, -5.4, 2.9, 0);
	add(box(0.06, 0.55, 2.6), M.metalDark, -4.18, 2.2, 0); // окна рубки
	add(cyl(0.16, 0.16, 1.4, 8), M.metalDark, -6.0, 3.6, 0.9); // труба
	for (const [dy, dz] of [[0.95, -1.5], [0.95, -0.9], [0.95, -0.3], [0.95, 0.3], [0.95, 0.9], [0.95, 1.5], [1.45, -1.2], [1.45, -0.6], [1.45, 0], [1.45, 0.6], [1.45, 1.2], [1.95, -0.3], [1.95, 0.3]]) {
		add(cyl(0.26, 0.28, 7.5, 8).rotateZ(Math.PI / 2), M.bark, 1.8, dy, dz);
	}
	for (const kx of [-1.6, 5.2]) for (const s of [-1, 1]) add(box(0.12, 1.6, 0.12), M.metalDark, kx, 1.4, s * 2.0); // стойки
}

/** Кран-укосина на берегу: мачта на бетонной опоре, наклонная стрела к (tx, tz), растяжка, трос с пачкой брёвен. */
function jibCrane(batch, M, collide, x, z, tx, tz) {
	batch.add(place(box(2.4, 0.6, 2.4, 1), x, 0.3, z), M.concrete);
	batch.add(place(box(0.5, 9.4, 0.5), x, 5.0, z), M.metalRust);
	const dx = tx - x, dz = tz - z, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), y0 = 2.2, y1 = 8.4, y2 = 9.6;
	batch.add(place(box(Math.hypot(L, y1 - y0), 0.35, 0.35), (x + tx) / 2, (y0 + y1) / 2, (z + tz) / 2, ry, 0, Math.atan2(y1 - y0, L)), M.yellow);
	batch.add(place(box(Math.hypot(L, y2 - y1), 0.06, 0.06), (x + tx) / 2, (y1 + y2) / 2, (z + tz) / 2, ry, 0, Math.atan2(y1 - y2, L)), M.metalDark);
	batch.add(place(box(1.3, 1.3, 1.3), x - (dx / L) * 1.3, 1.25, z - (dz / L) * 1.3), M.concreteDark); // противовес
	batch.add(place(box(0.05, y1 - 4.4, 0.05), tx, (y1 + 4.4) / 2, tz), M.metalDark); // трос
	for (const [dy, dw] of [[0, -0.28], [0, 0.28], [0.44, 0]]) {
		batch.add(place(cyl(0.22, 0.22, 4.6, 8).rotateZ(Math.PI / 2).translate(0, dy, dw), tx, 3.9, tz, ry + Math.PI / 2), M.bark);
	}
	collide(x, z, 2.4, 2.4);
	collide(x - (dx / L) * 1.3, z - (dz / L) * 1.3, 1.3, 1.3);
}

// ---------- Мебель новых построек (лицо — +Z своих осей; тайники обыскивают спереди) ----------

const desk = (b, name, x, z, rot, loot, w = 1.3) => b.container(name, x, z, rot, [
	[w, 0.05, 0.7, 0, 0.75, 0, b.IM.furniture], [0.45, 0.72, 0.66, w / 2 - 0.25, 0.36, 0, b.IM.furniture],
	[0.06, 0.72, 0.06, -w / 2 + 0.06, 0.36, -0.3, b.IM.furniture], [0.06, 0.72, 0.06, -w / 2 + 0.06, 0.36, 0.3, b.IM.furniture],
	[0.3, 0.03, 0.22, -0.2, 0.79, 0.05, b.IM.white],
], [w, 0.7], loot, 0.95);
const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat], [0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal], [0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);
const fridge = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.65, 1.7, 0.62, 0, 0.85, 0, b.IM.white], [0.04, 0.35, 0.04, -0.25, 1.1, 0.33, b.IM.metal], [0.6, 0.02, 0.02, 0, 1.2, 0.315, b.IM.black],
], [0.65, 0.62], loot, 1.7);
const nightstand = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.5, 0.65, 0.45, 0, 0.33, 0, b.IM.furnitureLight], [0.44, 0.02, 0.02, 0, 0.5, 0.23, b.IM.black],
], [0.5, 0.45], loot, 0.65);
const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine],
], [2.0, 0.8], loot, 1.0);
const rack = (b, name, x, z, rot, loot, w = 2.4) => b.container(name, x, z, rot, [
	...[-w / 2 + 0.05, w / 2 - 0.05].flatMap((dx) => [-0.25, 0.25].map((dz) => [0.06, 2.0, 0.06, dx, 1.0, dz, b.IM.rack])),
	...[0.15, 0.85, 1.55].map((y) => [w, 0.04, 0.55, 0, y, 0, b.IM.rack]),
	[0.8, 0.45, 0.5, -0.6, 0.4, 0, b.IM.crate], [0.6, 0.4, 0.45, 0.5, 1.07, 0, b.IM.crateGreen], [0.9, 0.35, 0.5, 0.2, 1.75, 0, b.IM.crate],
], [w, 0.6], loot, 2.0);
const locker = (b, name, x, z, rot, loot, w = 0.85) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);
/** Двухъярусная койка барака. */
const bunk = (b, x, z, rot) => {
	const { metal, blanketArmy, linen } = b.IM, parts = [];
	for (const y of [0.42, 1.35]) parts.push([0.85, 0.06, 1.95, 0, y, 0, metal], [0.82, 0.1, 1.8, 0, y + 0.08, 0.05, blanketArmy], [0.6, 0.1, 0.32, 0, y + 0.16, -0.75, linen]);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([0.05, 1.75, 0.05, sx * 0.4, 0.875, sz * 0.95, metal]);
	b.furniture(x, z, rot, parts, { solid: [0.9, 2.0], prop: 'bunk' });
};
/** Стол с двумя лавками (столовая). */
const messTable = (b, x, z) => b.furniture(x, z, 0, [
	[1.6, 0.05, 0.8, 0, 0.75, 0, b.IM.furnitureLight], [0.08, 0.72, 0.6, -0.7, 0.36, 0, b.IM.metal], [0.08, 0.72, 0.6, 0.7, 0.36, 0, b.IM.metal],
	[1.6, 0.05, 0.3, 0, 0.45, -0.75, b.IM.furniture], [1.6, 0.05, 0.3, 0, 0.45, 0.75, b.IM.furniture],
	[0.06, 0.43, 0.25, -0.7, 0.22, -0.75, b.IM.metal], [0.06, 0.43, 0.25, 0.7, 0.22, -0.75, b.IM.metal],
	[0.06, 0.43, 0.25, -0.7, 0.22, 0.75, b.IM.metal], [0.06, 0.43, 0.25, 0.7, 0.22, 0.75, b.IM.metal],
], { solid: [1.6, 1.9] });

/** Двускатная крыша вдоль X с фронтонами (gable — материал фронтонов) и коньком. */
function gableRoof(b, M, roof, gable, rise = 1.4) {
	const { W, D, H } = b, hx = W / 2, hz = D / 2, slope = Math.hypot(hz + 0.4, rise);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.6, 0.08, slope, 2), 0, H + rise / 2, s * (hz + 0.4) / 2, 0, s * Math.atan2(rise, hz + 0.4)), roof);
	b.top_(place(boxTop(W + 0.64, 0.1, 0.26, 1), 0, H + rise + 0.035, 0), M.metalRust);
	for (const sx of [-1, 1]) {
		const x = sx * (hx + 0.01), a = [x, H, -hz], c = [x, H, hz], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...a, ...tp, ...c] : [...a, ...c, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 4, 1, D / 2, 0] : [0, 0, D / 2, 0, D / 4, 1]), 2));
		tri.computeVertexNormals();
		b.top_(tri, gable);
	}
}

/**
 * Гараж лесовозов 22×12 м: два высоких проёма ворот с юга, внутри — лесовоз над смотровой канавой, верстак,
 * стеллаж с запчастями; в восточном конце — конторка механика (шкафчик водителя, стол). Тайники: 3.
 */
function buildTruckGarage(bctx, batch, collide, { cx, cz }) {
	const W = 22, D = 12, H = 5.4, t = 0.3, hx = W / 2, hz = D / 2, G = 2.1, GH = 4.2; // G — полуширина ворот, GH — их высота
	const b = new Building(bctx, { name: 'TruckGarage', cx, cz, ry: 0, W, D, H, top: H + 2.0 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	for (const [a0, a1] of [[-hx - t / 2, -5 - G], [-5 + G, 1.5 - G], [1.5 + G, hx + t / 2]]) b.wall('x', hz, a0, a1, { mat: M.brick, t, lining: IM.factoryWall, side: -1 });
	for (const g of [-5, 1.5]) b.top_(place(box(2 * G, H - GH, t, 1.5), g, (GH + H) / 2, hz), M.brick); // перемычки над воротами
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, doors: [3], lining: IM.factoryWall, side: -1 });
	b.wall('z', 6.5, -hz + t / 2, hz - t / 2, { mat: IM.factoryWall, t: 0.15, doors: [-2.5] }); // конторка
	const sill = M.brick;
	for (const x of [-8, -2, 4, 9]) b.window('front', x, { y: 3.2, t, sill });
	b.window('right', -2, { t, sill });
	b.window('left', 0, { y: 3.2, t, sill });
	for (const x of [-8.15, -1.85, 4.65]) b.wallBox('back', x, 2.1, 0.02, GH - 0.1, 0.07, M.metalRust, { t }); // створки распахнуты к стене
	gableRoof(b, M, M.roofMetal, M.brick, 1.6);
	b.top_(b.onWall(new THREE.PlaneGeometry(4.2, 0.6).translate(0, 3.6, 0.03), 'back', 8.8, t), T.signMaterial('ГАРАЖ ЛЕСОВОЗОВ', { bg: '#2a2c26', fg: '#e8dcae', w: 512, h: 72 }));
	// смотровая канава во втором боксе (жёлтые края), над ней — лесовоз
	b.lower(place(planeXZ(1.0, 6, 1), 1.5, 0.03, -0.5), IM.black, { cast: false });
	for (const s of [-1, 1]) b.lower(place(box(0.12, 0.05, 6), 1.5 + s * 0.56, 0.03, -0.5), M.yellow, { cast: false });
	const [tx, tz] = b.world(1.5, -0.1);
	logTruck(batch, M, collide, tx, tz, -Math.PI / 2, M.green);
	workbench(b, 'Верстак', -1.75, -5.42, 0, { ammo12: [3, 6, 0.35], scrap: [1, 2, 0.35], grenade: 0.03, ammo919: [2, 5, 0.3] });
	rack(b, 'Стеллаж с запчастями', -10.52, -2, Math.PI / 2, { parts: [1, 1, 0.35], fuel: [1, 1, 0.3], ammo12: [2, 5, 0.3], spore: 0.15 });
	b.furniture(-10.3, 3.2, 0, [[0.6, 0.5, 0.6, 0, 0.25, 0, IM.black]], { solid: [0.6, 0.6], prop: 'tire' });
	b.furniture(-7.5, 4.6, 0.3, [[0.5, 0.75, 0.5, 0, 0.37, 0, IM.metal]], { solid: [0.5, 0.5], prop: 'barrel' });
	// конторка механика
	locker(b, 'Шкафчик водителя', 10.57, -4.5, -Math.PI / 2, { ammo12: [3, 6, 0.4], medkit: [1, 1, 0.3], ammo545: [4, 8, 0.2], spore: 0.2 });
	b.furniture(8.5, -5.2, 0, [[1.2, 0.05, 0.6, 0, 0.75, 0, IM.furniture], [1.1, 0.72, 0.5, 0, 0.36, 0, IM.furniture]], { solid: [1.2, 0.6] });
	chair(b, 8.5, -4.5, Math.PI);
	return b.finish();
}

/**
 * Сушильные камеры 22×10 м в алюминиевой обшивке: две камеры с воротами на юг (внутри — тележки со штабелями досок
 * на рельсах, трубы отопления), третья секция — пультовая (пульт сушильщика, шкаф). Тайники: 2.
 */
function buildKilns(bctx, batch, { cx, cz }) {
	const W = 22, D = 10, H = 4.4, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'DryKilns', cx, cz, ry: 0, W, D, H, top: H + 0.9 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wm = { mat: M.tankWhite, t, lining: M.metalDark, sx: 1.2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wm, side: 1 });
	b.wall('x', hz, -hx - t / 2, 3, { ...wm, side: -1, doors: [-7.5, -0.5], w: 3.0 }); // ворота камер
	b.wall('x', hz, 3, hx + t / 2, { ...wm, side: -1, doors: [7] }); // дверь пультовой
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wm, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wm, side: -1 });
	b.wall('z', -4, -hz + t / 2, hz - t / 2, { mat: M.metalDark, t: 0.2 });
	b.wall('z', 3, -hz + t / 2, hz - t / 2, { mat: M.metalDark, t: 0.2, doors: [-2] });
	b.window('back', 9.5, { t, sill: M.metalDark }); b.window('right', 0, { t, sill: M.metalDark });
	for (const g of [-7.5, -0.5]) for (const s of [-1, 1]) b.wallBox('back', g + s * 2.2, 1.45, 0.02, 2.1, 0.08, M.metalRust, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(4.4, 0.55).translate(0, 3.3, 0.03), 'back', 7, t), T.signMaterial('СУШИЛЬНЫЕ КАМЕРЫ', { bg: '#2a2c26', fg: '#e8dcae', w: 512, h: 64 }));
	// плоская кровля, вентиляторы камер на крыше
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofMetal);
	for (const x of [-7.5, -0.5]) {
		b.top_(place(boxTop(1.6, 0.7, 1.6, 1), x, H + 0.6, -1.5), M.metalDark);
		b.top_(place(cyl(0.6, 0.6, 0.2, 14), x, H + 1.0, -1.5), M.silver);
	}
	b.vent(8, -2, H + 0.25, M.silver);
	// камеры: рельсы, тележки со штабелями досок на прокладках, трубы отопления вдоль северной стены
	for (const g of [-7.5, -0.5]) {
		for (const s of [-1, 1]) b.lower(place(box(0.08, 0.06, D - 0.6), g + s * 0.6, 0.05, 0), M.rail, { cast: false });
		b.furniture(g, -1.6, 0, [
			[2.2, 0.3, 4.0, 0, 0.3, 0, M.metalRust],
			...[0.65, 1.05, 1.45, 1.85].map((y) => [2.0, 0.34, 3.6, 0, y, 0, M.woodYellow]),
			...[0.84, 1.24, 1.64].map((y) => [2.06, 0.06, 0.1, 0, y, -1.2, M.wood]),
		], { solid: [2.2, 4.0] });
		b.furniture(g, -4.55, 0, [[6.4, 0.18, 0.18, 0, 0.6, 0, M.metalRust], [6.4, 0.18, 0.18, 0, 1.0, 0, M.metalRust]], { solid: [0, 0] });
	}
	// пультовая
	desk(b, 'Пульт сушильщика', 7, -4.47, 0, { ammo919: [3, 6, 0.35], ammo12: [2, 5, 0.3], spore: [1, 2, 0.25], medkit: [1, 1, 0.2] });
	chair(b, 7, -3.7, Math.PI);
	b.furniture(10.55, -1.5, -Math.PI / 2, [[1.8, 1.6, 0.5, 0, 0.8, 0, IM.machine], [1.4, 0.6, 0.04, 0, 1.2, 0.26, IM.white]], { solid: [1.8, 0.5] }); // щит управления
	cabinet(b, 'Шкаф', 3.38, 3.0, Math.PI / 2, 1.0, 1.9, 0.55, { ammo12: [3, 6, 0.35], fuel: [1, 1, 0.25], spore: 0.2 });
	// снаружи: рельсы от ворот, тележка с досками ждёт загрузки
	for (const g of [-7.5, -0.5]) for (const s of [-1, 1]) batch.add(place(box(0.08, 0.06, 7), b.cx + g + s * 0.6, 0.05, b.cz + hz + 3.5), M.rail, { cast: false });
	return b.finish();
}

/**
 * Котельная на опилках 12×9 м: котёл с топкой, бункер опилок со шнеком, дымоход сквозь крышу; ворота с запада
 * (подвозить опилки), дверь с юга. Труба — снаружи (chimney). Тайник: шкафчик кочегара.
 */
function buildSawBoiler(bctx, { cx, cz }) {
	const W = 12, D = 9, H = 4.6, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'SawBoiler', cx, cz, ry: 0, W, D, H, top: H + 0.5 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [-2], w: 1.4, lining: IM.factoryWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, doors: [1.2], w: 2.6, lining: IM.factoryWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.factoryWall, side: -1 });
	const sill = M.brick;
	for (const x of [-3, 3]) b.window('front', x, { y: 3.2, t, sill });
	b.window('back', 2.5, { y: 3.2, t, sill });
	b.wallBox('back', -2 + 1.15, 1.0, 0.02, 2.05, 0.05, M.metalRust, { t });
	for (const s of [-1, 1]) b.wallBox('left', 1.2 + s * 1.96, 1.28, 0.02, 2.06, 0.06, M.metalRust, { t });
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.3);
	b.top_(b.onWall(new THREE.PlaneGeometry(3.2, 0.5).translate(0, H - 0.5, 0.03), 'back', 2.5, t), T.signMaterial('КОТЕЛЬНАЯ', { bg: '#2a2c26', fg: '#e8dcae', w: 384, h: 60 }));
	// котёл, бункер опилок со шнеком, дымоход
	b.furniture(2.6, -1.8, 0, [
		[3.2, 2.6, 3.4, 0, 1.3, 0, IM.machine], [3.3, 0.12, 3.5, 0, 2.65, 0, IM.metal],
		[0.8, 0.6, 0.06, -0.6, 0.8, 1.73, IM.black], [0.5, 0.4, 0.06, 0.7, 1.7, 1.73, IM.black],
	], { solid: [3.2, 3.4] });
	b.furniture(3.4, -2.6, 0, [[0.55, H - 2.6, 0.55, 0, 2.6 + (H - 2.6) / 2, 0, M.metalRust]], { up: true });
	b.furniture(-3.6, -2.4, 0, [[2.6, 1.2, 2.6, 0, 0.6, 0, M.metalRust], [2.4, 0.3, 2.4, 0, 1.15, 0, M.woodYellow]], { solid: [2.6, 2.6] });
	b.furniture(-0.65, -2.2, 0, [[1.4, 0.35, 0.35, 0, 0.9, 0, IM.metal], [0.1, 0.9, 0.1, 0, 0.45, 0, IM.metal]], { solid: [1.4, 0.4] }); // шнек
	b.furniture(5.0, 2.8, 0, [[1.0, 0.8, 0.8, 0, 0.4, 0, IM.machine], [0.3, 0.5, 0.3, 0.2, 1.0, 0, IM.metal]], { solid: [1.0, 0.8] }); // насос
	locker(b, 'Шкафчик кочегара', 5.57, 0.6, -Math.PI / 2, { ammo12: [3, 6, 0.4], medkit: [1, 1, 0.3], fuel: [1, 1, 0.25], spore: 0.2 });
	b.furniture(-1.5, 3.9, Math.PI, [[1.2, 0.05, 0.6, 0, 0.75, 0, IM.furniture], [1.1, 0.72, 0.5, 0, 0.36, 0, IM.furniture]], { solid: [1.2, 0.6] });
	return b.finish();
}

/**
 * Столовая посёлка 14×9 м: зал со столами и лавками, раздача у перегородки, кухня с плитой, холодильником и
 * разделочным столом; вход с улицы (юг), чёрный ход на кухню с востока. Тайники: раздача, холодильник.
 */
function buildCanteen(bctx, { cx, cz }) {
	const W = 14, D = 9, H = 3.2, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Canteen', cx, cz, ry: 0, W, D, H, top: H + 1.5 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [-3], w: 1.5, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: [-2], lining: IM.whitewash, side: -1 });
	b.wall('z', 2, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [-2.6] });
	const sill = M.whiteBrick;
	for (const x of [-5.5, -0.5, 4.5]) b.window('back', x, { t, sill });
	for (const x of [-5, -1, 4.5]) b.window('front', x, { t, sill });
	b.window('left', 0, { t, sill });
	b.lower(place(box(2.0, 0.15, 1.0, 1), -3, 0.075, hz + 0.6), M.concrete);
	b.canopy('back', -3, { w: 2.2, d: 1.2, y: 2.35, mat: M.metalRust, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.2, 0.5).translate(0, H - 0.35, 0.03), 'back', -3, t), T.signMaterial('СТОЛОВАЯ', { bg: '#e8e4d8', fg: '#5a2a1a', w: 384, h: 60 }));
	gableRoof(b, M, M.slate, M.whiteBrick, 1.5);
	b.chimney(4.5, -2.6, H + 0.4, H + 2.2, 0.5, M.whiteBrick);
	for (const [x, z] of [[-5, -2.3], [-5, 1.6], [-1.8, -2.3], [-1.8, 1.6]]) messTable(b, x, z);
	b.container('Раздача', 1.545, 0.3, -Math.PI / 2, [
		[3.0, 1.0, 0.7, 0, 0.5, 0, IM.metal], [3.1, 0.05, 0.8, 0, 1.02, 0, IM.furnitureLight], [2.6, 0.15, 0.4, 0, 1.12, 0, IM.cans],
	], [3.0, 0.7], { ammo919: [2, 5, 0.3], medkit: [1, 1, 0.25], food: [1, 2, 0.4], spore: 0.2 }, 1.2);
	// кухня
	b.furniture(4.5, -3.92, 0, [[2.0, 0.9, 0.8, 0, 0.45, 0, IM.black], [1.9, 0.04, 0.7, 0, 0.92, 0, IM.metal], [1.6, 0.6, 0.9, 0, 2.3, 0, IM.metal]], { solid: [2.0, 0.8] }); // плита и вытяжка
	fridge(b, 'Холодильник', 6.53, 3.4, -Math.PI / 2, { medkit: [1, 1, 0.25], food: [1, 2, 0.45], spore: 0.15 });
	b.furniture(4.3, 1.2, 0, [[1.4, 0.05, 0.7, 0, 0.85, 0, IM.metal], [1.3, 0.8, 0.6, 0, 0.4, 0, IM.furnitureLight]], { solid: [1.4, 0.7] });
	return b.finish();
}

/**
 * Барак рабочих №2 14×8 м, дощатый: двухъярусные койки с тумбочками, буржуйка, стол; в восточном конце —
 * каптёрка со шкафом. Вход с юга. Тайники: две тумбочки, шкаф.
 */
function buildBarrack2(bctx, { cx, cz }) {
	const W = 14, D = 8, H = 3.0, t = 0.2, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Barrack2', cx, cz, ry: 0, W, D, H, top: H + 1.5 });
	b.messKind = 'army';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.woodGrey, t, lining: IM.whitewash, side: 1, sx: 1.2 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.woodGrey, t, doors: [-2], lining: IM.whitewash, side: -1, sx: 1.2 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.woodGrey, t, lining: IM.whitewash, side: 1, sx: 1.2 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.woodGrey, t, lining: IM.whitewash, side: -1, sx: 1.2 });
	b.wall('z', 3.5, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.12, doors: [2.3] });
	const trim = IM.whitewash;
	for (const x of [-4.5, -2.2, 0.2, 5.2]) b.window('front', x, { t, trim });
	for (const x of [-5, 1.5, 5.2]) b.window('back', x, { t, trim });
	b.window('left', 0, { t, trim }); b.window('right', 0, { t, trim });
	b.lower(place(box(1.6, 0.18, 0.9), -2, 0.09, hz + 0.55), M.wood);
	b.canopy('back', -2, { w: 1.9, d: 1.1, y: 2.3, mat: M.roofMetal, posts: M.woodGrey, t });
	b.wallBox('back', -2 + 1.05, 1.0, 0.02, 2.0, 0.05, M.wood, { t });
	gableRoof(b, M, M.slate, M.woodGrey, 1.4);
	for (const x of [-5.6, -3.3, -1.0, 1.3]) bunk(b, x, -2.87, 0);
	for (const x of [-5.6, 1.3]) bunk(b, x, 2.87, Math.PI);
	nightstand(b, 'Тумбочка', -4.45, -3.62, 0, { ammo12: [2, 5, 0.4], ammo919: [2, 4, 0.3], spore: 0.2 });
	nightstand(b, 'Тумбочка', 0.15, -3.62, 0, { ammo12: [2, 4, 0.35], medkit: [1, 1, 0.25], spore: 0.2 });
	// буржуйка с трубой, стол с табуретами
	b.furniture(-6.2, 0.4, 0, [[0.55, 0.6, 0.45, 0, 0.3, 0, IM.black]], { solid: [0.6, 0.5], prop: 'burzhuyka' });
	b.furniture(-6.2, 0.3, 0, [[0.14, b.top - 0.9, 0.14, 0, 1.0 + (b.top - 0.9) / 2, 0, IM.metal]], { up: true });
	table(b, -3.0, 0.2, 0, { w: 1.4, d: 0.7 });
	for (const x of [-3.5, -2.5]) chair(b, x, -0.5, 0);
	// каптёрка
	cabinet(b, 'Шкаф', 6.6, -2.4, -Math.PI / 2, 1.0, 1.9, 0.55, { ammo12: [4, 8, 0.45], dbarrel: 0.06, medkit: [1, 1, 0.3], ammo919: [3, 6, 0.3] });
	b.furniture(4.2, -3.55, 0, [[1.2, 1.6, 0.4, 0, 0.8, 0, IM.furniture], [1.0, 0.3, 0.3, 0, 1.1, 0.03, IM.blanketArmy]], { solid: [1.2, 0.4] });
	return b.finish();
}

/** Будка причала 5×4 м из досок: ящик с вещами сторожа, вёсла, бухты каната; спасательный круг снаружи. Вход с юга. */
function buildDockShed(bctx, { cx, cz }) {
	const W = 5, D = 4, H = 2.5, t = 0.16, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'DockShed', cx, cz, ry: 0, W, D, H, top: H + 0.6 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.03, 0), IM.floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.woodGrey, t, sx: 1.2 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.woodGrey, t, doors: [1.0], w: 1.2, sx: 1.2 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.woodGrey, t, sx: 1.2 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.woodGrey, t, sx: 1.2 });
	b.window('back', -1.2, { t, trim: M.wood }); b.window('left', 0, { t, trim: M.wood });
	b.top_(place(box(W + 0.6, 0.08, D + 0.7, 2), 0, H + 0.25, 0, 0, 0.1), M.roofMetal);
	b.top_(b.onWall(new THREE.TorusGeometry(0.32, 0.08, 8, 16).translate(0, 1.6, 0.1), 'back', -2.0, t), M.red); // спасательный круг
	b.container('Ящик причала', -1.4, -1.6, 0, [
		[1.0, 0.55, 0.55, 0, 0.27, 0, IM.crate], [1.02, 0.06, 0.57, 0, 0.57, 0, IM.furniture], [0.06, 0.6, 0.58, -0.32, 0.3, 0, IM.metal], [0.06, 0.6, 0.58, 0.32, 0.3, 0, IM.metal],
	], [1.0, 0.55], { ammo12: [3, 8, 0.45], fuel: [1, 1, 0.3], medkit: [1, 1, 0.2], spore: 0.2 }, 0.6);
	b.furniture(1.9, -1.0, 0, [[0.08, 2.2, 0.08, -0.15, 1.1, 0, IM.furnitureLight], [0.08, 2.2, 0.08, 0.1, 1.1, 0.05, IM.furnitureLight]], { solid: [0, 0] }); // вёсла
	b.furniture(1.7, 1.1, 0, [[0.7, 0.3, 0.7, 0, 0.15, 0, IM.rag]], { solid: [0.7, 0.7] }); // бухта каната
	return b.finish();
}

export default {
	id: 'lesopilka',
	seed: 3302,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		M.guardSign = T.signMaterial('КОНТОРА', { bg: '#2a2c26', fg: '#e8dcae' });

		// ---------- Река: вода, берега, тростник; по воде не пройти (коллайдеры полосами по 2 м) ----------
		batch.add(ribbon(bankL, bankR, 0.04, 18, -92, 92), M.water, { cast: false });
		batch.add(ribbon((z) => bankR(z) - 0.6, (z) => bankR(z) + 3.2, 0.016, 4, -92, 92), M.dirt, { cast: false });
		batch.add(ribbon((z) => bankL(z) - 4, (z) => bankL(z) + 0.6, 0.016, 4, -92, 92), M.dirt, { cast: false });
		const pierEnd = bankR(PIER_Z) - PIER_LEN;
		const quayEnd = bankR((QUAY_Z0 + QUAY_Z1) / 2) - QUAY_LEN;
		for (let z0 = -90; z0 < 90; z0 += 2) {
			const xl = Math.min(bankL(z0), bankL(z0 + 2)) - 0.2;
			const xr = z0 === PIER_Z - 1 ? pierEnd - 0.3 : z0 >= QUAY_Z0 && z0 < QUAY_Z1 ? quayEnd - 0.3 : Math.min(bankR(z0), bankR(z0 + 2)) - 0.6;
			collide((xl + xr) / 2, z0 + 1, xr - xl, 2);
		}
		for (let i = 0; i < 70; i++) {
			const z = R(-64, 64), east = rnd() < 0.6;
			if (Math.abs(z - PIER_Z) < 3 || (east && Math.abs(z) < 12)) continue; // у мостков и у бревнотаски — чисто
			const x = east ? bankR(z) + R(-0.7, 0.2) : bankL(z) + R(-0.2, 0.7);
			for (let k = 0; k < 3; k++) {
				batch.add(place(new THREE.ConeGeometry(0.05, 0.9 + rnd() * 0.7, 4), x + R(-0.3, 0.3), 0.5, z + R(-0.4, 0.4), 0, R(-0.15, 0.15), R(-0.15, 0.15)), M.leavesDry);
			}
		}
		// мостки с лодкой
		{
			const x0 = pierEnd, x1 = bankR(PIER_Z) + 0.6, len = x1 - x0;
			batch.add(place(box(len, 0.12, 1.8, 1.2), (x0 + x1) / 2, 0.35, PIER_Z), M.woodGrey);
			for (let x = x0 + 0.3; x < x1 - 0.5; x += 1.8) for (const dz of [-0.8, 0.8]) batch.add(place(box(0.14, 0.6, 0.14), x, 0.1, PIER_Z + dz), M.wood);
			const bx = x0 + 3.2, bz = PIER_Z + 2.3;
			batch.add(place(box(3.0, 0.4, 1.1, 1.2), bx, 0.2, bz, 0.08), M.woodGreen); // лодка
			batch.add(place(box(0.78, 0.38, 0.78), bx + 1.55, 0.2, bz - 0.12, Math.PI / 4 + 0.08), M.woodGreen);
			for (const dx of [-0.7, 0.5]) batch.add(place(box(0.25, 0.05, 1.0), bx + dx, 0.42, bz, 0.08), M.wood);
		}
		// сплавные брёвна у берега и бон из брёвен
		for (let i = 0; i < 12; i++) {
			const z = R(-8, 7), x = bankR(z) - R(1.6, 7);
			batch.add(place(new THREE.CylinderGeometry(0.25, 0.25, R(3.5, 5.5), 8).rotateZ(Math.PI / 2), x, 0.06, z, R(-0.5, 0.5)), M.bark);
		}
		{
			const pts = [[bankR(-11) - 0.5, -11], [bankR(-11) - 8.5, -9], [bankR(9) - 8.5, 9], [bankR(11) - 0.5, 11]];
			for (let k = 1; k < pts.length; k++) {
				const [ax, az] = pts[k - 1], [bx, bz] = pts[k], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 4);
				for (let j = 0; j < n; j++) {
					const t = (j + 0.5) / n;
					batch.add(place(new THREE.CylinderGeometry(0.22, 0.22, len / n - 0.15, 8).rotateZ(Math.PI / 2), ax + (bx - ax) * t, 0.05, az + (bz - az) * t, -Math.atan2(bz - az, bx - ax)), M.bark);
				}
			}
		}

		// ---------- Дороги и двор ----------
		ground(6, 74, 6, 53, M.dirt, 4, 0.02); // на юг, к Дачам (z 16…90)
		ground(6, 76, 0, -52, M.dirt, 4, 0.02); // на север, к «Карьеру» (z −90…−14)
		ground(34, 30, -4, 1, M.dirt, 5, 0.014); // двор лесопилки
		ground(38, 4, 27, 37.5, M.dirt, 4, 0.018); // улица посёлка
		ground(24, 14, 22, -26, M.dirt, 4, 0.016); // площадка у навеса с техникой
		ground(8, 5, 6.5, -26, M.dirt, 4, 0.017);
		ground(20, 16, -12, 35, M.dirt, 4, 0.015); // склад досок
		ground(14, 34, -27, -24, M.dirt, 4, 0.013); // склад круглого леса
		ground(14, 12, -27, 0, M.dirt, 4, 0.015); // под навесом пилорамы
		const roads = [[3, 9, 16, 92], [-3, 3, -92, -14], [-21, 13, -14, 16], [8, 46, 35.5, 39.5], [24, 28, 39.5, 45.5], [42, 46, 39.5, 45.5], [2.5, 34, -33, -19], [-50, -42, 34, 36], [-35, -19, -6, 6], [-22, -2, 27, 43]];
		// поляны без деревьев (делянка): tryTree спрашивает onRoad с запасом 1 м — там деревья не сажаем, трава растёт
		const clear = [];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m)
			|| (m >= 1 && clear.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1));

		// ---------- Навес пилорамы: рама, тележки на рельсах; бревнотаска от реки ----------
		occluder('SawShed', (kb) => {
			// односкатная крыша: столбы доходят до неё (к востоку — выше)
			for (const x of [-34, -27, -20]) for (const z of [-5, 5]) { const h = 4.27 + (x + 27) * 0.06; kb.add(place(box(0.3, h, 0.3), x, h / 2, z), M.wood); }
			kb.add(place(box(15.2, 0.15, 11.2, 2), -27, 4.35, 0, 0, 0, 0.06), M.roofMetal);
		}, { cx: -27, cz: 0, ry: 0, hx: 7.6, hz: 5.6, top: 4.6 }, 0.15);
		for (const x of [-34, -27, -20]) for (const z of [-5, 5]) collide(x, z, 0.35, 0.35);
		for (const dz of [-0.55, 0.55]) batch.add(place(box(14, 0.12, 0.08), -27, 0.18, dz), M.rail, { cast: false });
		for (let x = -33.6; x < -20; x += 0.9) batch.add(place(box(0.2, 0.1, 1.6), x, 0.06, 0), M.sleeper, { cast: false });
		// пилорамная рама: станина, стойки, верхняя балка, полотна пил
		batch.add(place(box(1.3, 0.6, 2.6), -27, 0.3, 0), M.green);
		for (const dz of [-1.0, 1.0]) batch.add(place(box(0.3, 2.9, 0.3), -27, 1.45, dz), M.green);
		batch.add(place(box(0.5, 0.5, 2.4), -27, 2.75, 0), M.green);
		for (const dz of [-0.3, -0.1, 0.1, 0.3]) batch.add(place(box(0.04, 1.6, 0.02), -27, 1.4, dz), M.metalDark);
		batch.add(place(new THREE.ConeGeometry(1.2, 0.5, 10), -27, 0.25, -2.6), M.woodYellow); // опилки
		collide(-27, 0, 1.5, 2.7);
		// тележки: с бревном (к раме) и с брусом (после рамы)
		batch.add(place(box(1.4, 0.35, 1.2), -31.6, 0.42, 0), M.metalRust);
		batch.add(place(new THREE.CylinderGeometry(0.32, 0.3, 5.2, 10).rotateZ(Math.PI / 2), -31.2, 0.95, 0), M.bark);
		collide(-31.4, 0, 5.2, 1.3);
		batch.add(place(box(1.4, 0.35, 1.2), -23, 0.42, 0), M.metalRust);
		for (const [dy, dz] of [[0.75, -0.18], [0.75, 0.18], [1.05, 0]]) batch.add(place(box(4.2, 0.3, 0.3), -23, dy, dz), M.woodYellow);
		collide(-23, 0, 4.4, 1.3);
		// бревнотаска: наклонный жёлоб от воды под навес
		{
			const rz = Math.atan2(1.3, 11.5);
			batch.add(place(box(12.2, 0.25, 1.1), -40.3, 0.42, 0, 0, 0, rz), M.metalRust);
			for (const dz of [-0.6, 0.6]) batch.add(place(box(12.2, 0.12, 0.08), -40.3, 0.62, dz, 0, 0, rz), M.metalDark);
			for (const x of [-39, -36]) { const h = 0.42 + (x + 40.3) * Math.tan(rz) - 0.12; batch.add(place(box(0.2, h, 0.2), x, h / 2, 0), M.metalDark); }
			batch.add(place(new THREE.CylinderGeometry(0.3, 0.3, 4.6, 10).rotateZ(Math.PI / 2 + rz), -39, 0.95, 0), M.bark);
			collide(-38.2, 0, 7.8, 1.4);
		}

		// ---------- Цех лесопилки (можно зайти) ----------
		buildings.push(buildWorkshop(bctx, { name: 'Sawmill', cx: -24, cz: 18, ry: 0 }));
		transformer(batch, root, M, collide, -6, 21);

		// ---------- Склад круглого леса: штабеля брёвен между стойками ----------
		const logStack = (x, z, ry, len, rows, per) => {
			for (let r = 0; r < rows; r++) {
				const n = per - r;
				for (let i = 0; i < n; i++) {
					const rad = R(0.2, 0.27), lz = (i - (n - 1) / 2) * 0.5, y = 0.25 + r * 0.43;
					const g = new THREE.CylinderGeometry(rad, rad * 1.08, len + R(-0.5, 0.3), 8).rotateZ(Math.PI / 2).translate(R(-0.25, 0.25), y, lz);
					batch.add(place(g, x, 0, z, ry), M.bark);
				}
			}
			const h = rows * 0.43 + 0.25;
			for (const sx of [-len / 2 + 0.7, len / 2 - 0.7]) for (const sz of [-1, 1]) {
				batch.add(place(box(0.14, h, 0.14).translate(sx, h / 2, sz * (per * 0.25 + 0.1)), x, 0, z, ry), M.wood);
			}
			collide(x, z, len + 0.4, per * 0.5 + 0.4, ry);
		};
		for (const [x, z] of [[-33, -16], [-33, -23], [-33, -30], [-20, -16], [-20, -23], [-20, -30]]) logStack(x, z, R(-0.04, 0.04), 8, 4, 7);
		logStack(-8, -21, Math.PI / 2 + 0.03, 7, 3, 6);
		logStack(-27, -40, 0.25, 6, 2, 5);
		// куча брёвен вперемешку
		for (let i = 0; i < 9; i++) {
			batch.add(place(new THREE.CylinderGeometry(0.24, 0.26, R(4, 6), 8).rotateZ(Math.PI / 2), -14 + R(-1.2, 1.2), 0.25 + (i % 3) * 0.35, -38 + R(-1.2, 1.2), R(0, Math.PI)), M.bark);
		}
		collide(-14, -38, 5.2, 5.2);

		// ---------- Склад досок, опилки, печь для отходов ----------
		const boards = (x, z, ry, len = 6, w = 2.4, layers = 7) => {
			for (const sx of [-len / 2 + 0.5, 0, len / 2 - 0.5]) batch.add(place(box(0.2, 0.14, w + 0.2).translate(sx, 0.07, 0), x, 0, z, ry), M.wood); // лаги
			for (let k = 0; k < layers; k++) {
				const y = 0.22 + k * 0.22;
				batch.add(place(box(len, 0.12, w, 2).translate(0, y, 0), x, 0, z, ry), M.woodYellow);
				for (const sx of [-len / 2 + 0.5, 0, len / 2 - 0.5]) batch.add(place(box(0.08, 0.1, w + 0.08).translate(sx, y + 0.11, 0), x, 0, z, ry), M.wood); // прокладки
			}
			batch.add(place(box(len + 0.5, 0.05, w + 0.5, 2).translate(0, 0.22 + layers * 0.22 + 0.1, 0), x, 0, z, ry), M.roofMetal); // лист железа сверху
			collide(x, z, len + 0.2, w + 0.2, ry);
		};
		boards(-16, 31, 0.02); boards(-7, 31, -0.03); boards(-16, 38, 0); boards(-7, 38.4, 0.05, 5, 2.2, 5);
		for (const [x, z, r, h] of [[-35, 31, 2.6, 1.7], [-28, 34, 1.8, 1.2], [-16, 6, 1.6, 1.0]]) {
			batch.add(place(new THREE.ConeGeometry(r, h, 12), x, h / 2, z), M.woodYellow); // кучи опилок
			collide(x, z, r * 1.3, r * 1.3);
		}
		{
			const x = -30, z = 44; // печь для отходов: ржавый котёл с трубой
			batch.add(place(new THREE.CylinderGeometry(1.4, 1.6, 3.4, 14), x, 1.7, z), M.metalRust);
			batch.add(place(new THREE.ConeGeometry(1.5, 0.9, 14), x, 3.85, z), M.metalRust);
			batch.add(place(new THREE.CylinderGeometry(0.25, 0.25, 3, 8), x, 5.5, z), M.metalDark);
			batch.add(place(box(0.9, 0.9, 0.05), x, 0.7, z + 1.56), M.metalDark); // топка
			collide(x, z, 3.2, 3.2);
		}

		// ---------- Контора у дороги (можно зайти), вывеска над въездом ----------
		buildings.push(buildGuardhouse(bctx, { name: 'Office', cx: 17, cz: 4, ry: Math.PI / 2 }));
		bench(batch, M, 13.4, 1.6, -Math.PI / 2);
		billboard(batch, M, root, collide, 6, 48, 0, 'ЛЕСОПИЛКА «КЕДР»', { w: 7.6, h: 0.9, y: 4.2, bg: '#2a2c26', fg: '#e8dcae' });
		addCar(batch, M, root, 10.6, 10.4, 0.15, 0x5a6a3a);
		collide(10.6, 10.4, 4.3, 1.8, 0.15);

		// ---------- Навес с техникой: трактор, прицеп-роспуск с брёвнами; лесовоз у дороги ----------
		occluder('MachineShed', (kb) => {
			for (const x of [14, 22, 30]) for (const z of [-30, -22]) { const h = 3.97 + (x - 22) * 0.04; kb.add(place(box(0.3, h, 0.3), x, h / 2, z), M.metalDark); }
			kb.add(place(box(18, 0.15, 9.2, 2), 22, 4.05, -26, 0, 0, 0.04), M.roofMetal);
		}, { cx: 22, cz: -26, ry: 0, hx: 9.2, hz: 4.8, top: 4.3 }, 0.15);
		for (const x of [14, 22, 30]) for (const z of [-30, -22]) collide(x, z, 0.35, 0.35);
		tractor(batch, M, collide, 17.6, -26, 0.04);
		{
			const x = 25.6, z = -26.2; // прицеп-роспуск: рама, две оси, коники со стойками, брёвна
			batch.add(place(box(5.6, 0.22, 0.4), x, 0.9, z), M.metalDark);
			for (const dx of [-1.9, 1.9]) {
				batch.add(place(box(0.3, 0.2, 2.2), x + dx, 1.1, z), M.metalDark);
				for (const dz of [-1.05, 1.05]) batch.add(place(box(0.12, 1.5, 0.12), x + dx, 1.9, z + dz), M.metalDark);
				for (const dz of [-0.85, 0.85]) batch.add(place(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12).rotateX(Math.PI / 2), x + dx, 0.48, z + dz), M.tire);
			}
			for (const [dy, dz] of [[1.45, -0.6], [1.45, 0], [1.45, 0.6], [1.85, -0.3], [1.85, 0.3], [2.25, 0]]) {
				batch.add(place(new THREE.CylinderGeometry(0.22, 0.24, 6.2, 8).rotateZ(Math.PI / 2), x, dy, z + dz), M.bark);
			}
			collide(x, z, 6.4, 2.4);
		}
		storageTank(batch, M, root, collide, 34.6, -20, 1.0, 2.8, M.khaki, 'ГСМ');
		armyTruck(batch, M, root, collide, 7.4, -42, Math.PI); // лесовоз у дороги, кабиной на север
		addCar(batch, M, root, 1.2, -51, Math.PI / 2 + 0.25, 0x1c1a18, { burned: true });
		collide(1.2, -51, 4.3, 1.8, Math.PI / 2 + 0.25);

		// ---------- Посёлок рабочих: барак и два дома с огородами (можно зайти) ----------
		buildings.push(
			buildArmyBarracks(bctx, { name: 'Barrack', cx: 27, cz: 24, ry: Math.PI }),
			buildHouse(bctx, { name: 'House1', cx: 22, cz: 52, ry: 0, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: 40, cz: 52, ry: 0, rnd, variant: 2 }),
		);
		// дома — подальше от барака: в кадре на телефоне не больше двух построек с мебелью
		fencePlot(batch, M, collide, 22, 52, 16, 14, 'n', rnd);
		fencePlot(batch, M, collide, 40, 52, 16, 14, 'n', rnd);
		ground(4, 6, 26, 42.5, M.dirt, 4, 0.017); // тропинки от улицы к калиткам
		ground(4, 6, 44, 42.5, M.dirt, 4, 0.017);
		garden(batch, M, rnd, 15.6, 52.5, 2, 8);
		garden(batch, M, rnd, 46, 52.5, 2, 6);
		outhouse(batch, M, collide, 28.6, 57.6, 0);
		outhouse(batch, M, collide, 33.4, 57.6, 0);
		woodpile(batch, M, collide, 22, 57.6, 0);
		shed(batch, M, collide, 46, 57.5, 0.05); // баня
		woodpile(batch, M, collide, 38.6, 24, Math.PI / 2); // у барака
		well(batch, M, collide, 12.6, 43);
		bench(batch, M, 15.6, 33.4, Math.PI / 2);
		batch.add(place(box(1.6, 0.06, 0.8), 14.6, 0.76, 29.5), M.woodGrey); // стол у барака
		for (const dx of [-0.6, 0.6]) batch.add(place(box(0.08, 0.74, 0.7), 14.6 + dx, 0.37, 29.5), M.wood);
		collide(14.6, 29.5, 1.7, 0.9);
		watchTower(batch, M, collide, 46, 8); // пожарная вышка в лесу

		// ================= Новые районы (локация 180×180 м) =================
		// всё новое — после прежнего: генератор случайных чисел для старой лесопилки идёт как раньше

		// ---------- Река у новых краёв: камыш (у причала — чисто) ----------
		for (let i = 0; i < 40; i++) {
			const z = rnd() < 0.5 ? R(-88, -64) : R(64, 88), east = rnd() < 0.6;
			if (east && z > 56) continue;
			const x = east ? bankR(z) + R(-0.7, 0.2) : bankL(z) + R(-0.2, 0.7);
			for (let k = 0; k < 3; k++) {
				batch.add(place(new THREE.ConeGeometry(0.05, 0.9 + rnd() * 0.7, 4), x + R(-0.3, 0.3), 0.5, z + R(-0.4, 0.4), 0, R(-0.15, 0.15), R(-0.15, 0.15)), M.leavesDry);
			}
		}

		// ---------- Проезды и площадки ----------
		ground(32, 22, -22, -67, M.dirt, 5, 0.015); // новый склад круглого леса
		ground(77, 4.5, 47.5, -46, M.dirt, 4, 0.019); // промдорога на восток
		ground(24, 14, 26, -55, M.dirt, 4, 0.016); // площадка у гаража лесовозов
		ground(5, 10, 62, -53, M.dirt, 4, 0.017); // волок на делянку
		ground(12, 20, 56, -34, M.dirt, 4, 0.016); // двор котельной
		ground(24, 12, 70, 7, M.dirt, 4, 0.016); // двор сушильных камер
		ground(40, 4, 66, 37.5, M.dirt, 4, 0.018); // улица посёлка — на восток
		ground(3, 7, 56, 32, M.dirt, 4, 0.017); // к столовой
		ground(3, 7.5, 75, 31.75, M.dirt, 4, 0.017); // к бараку №2
		ground(4, 6, 64, 42.5, M.dirt, 4, 0.017); // к калиткам
		ground(4, 6, 79.75, 42.5, M.dirt, 4, 0.017);
		ground(49, 4.5, -20.5, 66, M.dirt, 4, 0.019); // дорога к причалу
		roads.push(
			[-38, -6, -78, -56], [9, 88, -48.5, -43.5], [14, 38, -62, -48], [59.5, 64.5, -58, -48], [50, 62, -44, -24], [58, 82, 1, 13],
			[46, 88, 35.5, 39.5], [54.5, 57.5, 28.5, 35.5], [73.5, 76.5, 28, 35.5], [62, 66, 39.5, 45.5], [77.75, 81.75, 39.5, 45.5], [-45, 4, 63.5, 68.5],
		);
		clear.push([46, 87, -87, -54]);

		// ---------- Север: склад круглого леса под козловым краном ----------
		for (const z of [-74, -67, -60]) for (const x of [-30, -15]) logStack(x, z, R(-0.04, 0.04), 9, 4, 7);
		{
			const z = -67;
			for (const x of [-37.2, -7.6]) {
				batch.add(place(box(0.14, 0.1, 22), x, 0.05, z), M.rail, { cast: false }); // рельс
				for (const s of [-1, 1]) {
					batch.add(place(box(0.4, 9.66, 0.4), x, 4.6, z + s * 1.75, 0, -s * 0.371), M.yellow); // ноги
					batch.add(place(box(0.9, 0.5, 1.2), x, 0.25, z + s * 3.5), M.metalDark); // ходовая тележка
					collide(x, z + s * 3.5, 0.9, 1.2);
				}
				batch.add(place(box(0.7, 0.6, 2.0), x, 9.1, z), M.yellow);
			}
			batch.add(place(box(31.2, 0.9, 1.2, 2), -22.4, 9.75, z), M.yellow); // пролёт
			batch.add(place(box(1.8, 0.8, 1.6), -22, 10.6, z), M.metalDark); // тележка
			batch.add(place(box(1.6, 1.5, 1.5), -11, 8.55, z + 1.4), M.metalDark); // кабина крановщика
			batch.add(place(box(0.05, 4.4, 0.05), -22, 7.1, z), M.metalDark); // трос
			batch.add(place(box(4.6, 0.12, 0.3), -22, 4.9, z), M.metalDark); // траверса
			for (const [dy, dz] of [[0, -0.28], [0, 0.28], [0.44, 0]]) batch.add(place(cyl(0.22, 0.22, 5.4, 8).rotateZ(Math.PI / 2), -22, 4.2 + dy, z + dz), M.bark);
		}
		logTruck(batch, M, collide, -20, -52.5, Math.PI, M.khaki);

		// ---------- Север: гараж лесовозов, лесовозы на площадке ----------
		buildings.push(buildTruckGarage(bctx, batch, collide, { cx: 26, cz: -68 }));
		logTruck(batch, M, collide, 33.5, -55, -Math.PI / 2 + 0.05, M.red);
		logTruck(batch, M, collide, 16.5, -54.5, -Math.PI / 2 - 0.04, M.green);

		// ---------- Северо-восток: делянка у края — пни, поваленные стволы, порубочные остатки, трактор ----------
		for (let i = 0; i < 34; i++) {
			const x = R(49, 84), z = R(-84, -57), r = R(0.25, 0.42), h = R(0.3, 0.6);
			if (x > 58.5 && x < 65.5 && z > -60) continue; // волок
			batch.add(place(cyl(r, r * 1.15, h, 9), x, h / 2, z), M.bark);
			batch.add(place(new THREE.CircleGeometry(r * 0.92, 9).rotateX(-Math.PI / 2), x, h + 0.005, z), M.woodYellow, { cast: false });
			collide(x, z, r * 2, r * 2);
		}
		for (let i = 0; i < 6; i++) {
			const x = R(52, 80), z = R(-80, -63), a = R(0, Math.PI), len = R(8, 12);
			batch.add(place(cyl(0.28, 0.36, len, 9).rotateZ(Math.PI / 2), x, 0.32, z, a), M.bark);
			collide(x, z, len, 0.75, a);
		}
		for (let i = 0; i < 4; i++) {
			const x = R(51, 82), z = R(-82, -61);
			batch.add(place(new THREE.IcosahedronGeometry(1.2, 1).scale(1.3, 0.45, 1.0), x, 0.35, z, R(0, 3)), M.leavesDry);
			for (let k = 0; k < 5; k++) batch.add(place(cyl(0.05, 0.07, R(1.8, 3), 5).rotateZ(Math.PI / 2 + R(-0.3, 0.3)), x + R(-0.8, 0.8), 0.5, z + R(-0.6, 0.6), R(0, 3.1)), M.bark);
			collide(x, z, 2.8, 2.2);
		}
		logStack(70, -58.5, 0.05, 7, 3, 6);
		tractor(batch, M, collide, 55, -61, 0.4);

		// ---------- Восток: котельная на опилках с трубой, кучи опилок ----------
		buildings.push(buildSawBoiler(bctx, { cx: 68, cz: -30 }));
		chimney(batch, M, collide, 78.2, -31, 18);
		batch.add(place(box(2.4, 0.8, 0.8), 75.2, 4.0, -31), M.metalRust); // боров
		for (const [x, z, r, h] of [[55, -36, 3.2, 2.2], [57.5, -28.5, 2.0, 1.4]]) {
			batch.add(place(new THREE.ConeGeometry(r, h, 12), x, h / 2, z), M.woodYellow);
			collide(x, z, r * 1.3, r * 1.3);
		}

		// ---------- Восток: сушильные камеры, тележка и штабель досок во дворе ----------
		buildings.push(buildKilns(bctx, batch, { cx: 70, cz: -4 }));
		batch.add(place(box(2.2, 0.3, 4.0), 69.5, 0.3, 9.6), M.metalRust);
		for (const y of [0.65, 1.05, 1.45]) batch.add(place(box(2.0, 0.34, 3.6), 69.5, y, 9.6), M.woodYellow);
		collide(69.5, 9.6, 2.2, 4.0);
		boards(78.5, 8.5, Math.PI / 2, 5, 2.2, 6);

		// ---------- Посёлок рабочих — на восток: столовая, барак №2, дом и домик с огородами ----------
		buildings.push(
			buildCanteen(bctx, { cx: 59, cz: 24 }),
			buildBarrack2(bctx, { cx: 77, cz: 24 }),
			buildHouse(bctx, { name: 'House3', cx: 60, cz: 52, ry: 0, rnd, variant: 0 }),
			buildDacha(bctx, { name: 'House4', cx: 77, cz: 51, ry: 0, rnd, variant: 2 }),
		);
		fencePlot(batch, M, collide, 60, 52, 16, 14, 'n', rnd);
		fencePlot(batch, M, collide, 77, 51, 13, 12, 'n', rnd);
		garden(batch, M, rnd, 66.5, 52.5, 2, 8);
		garden(batch, M, rnd, 82, 51.5, 2, 6);
		outhouse(batch, M, collide, 54, 57.6, 0);
		woodpile(batch, M, collide, 58, 57.6, 0);
		woodpile(batch, M, collide, 74, 55.8, 0);
		well(batch, M, collide, 69.3, 42.8);
		bench(batch, M, 63, 30.2, Math.PI);
		woodpile(batch, M, collide, 85, 24, Math.PI / 2); // у барака

		// ---------- Юг: причал с баржей и краном-укосиной, будка причала, штабели на берегу ----------
		{
			const x0 = quayEnd, x1 = bankR(66) + 0.6, len = x1 - x0, zc = (QUAY_Z0 + QUAY_Z1) / 2;
			batch.add(place(box(len, 0.14, QUAY_Z1 - QUAY_Z0, 1.2), (x0 + x1) / 2, 0.36, zc), M.woodGrey);
			for (let x = x0 + 0.3; x < x1 - 0.5; x += 2) for (const dz of [-1.85, 1.85]) batch.add(place(box(0.2, 0.7, 0.2), x, 0.08, zc + dz), M.wood);
			for (const dz of [-1.6, 1.6]) batch.add(place(cyl(0.14, 0.16, 0.45, 8), x0 + 0.4, 0.6, zc + dz), M.metalDark); // кнехты
		}
		barge(batch, M, -52.4, 76.5, Math.PI / 2 + 0.03);
		jibCrane(batch, M, collide, -42, 72, -51.5, 75.5);
		buildings.push(buildDockShed(bctx, { cx: -36, cz: 60 }));
		logStack(-31, 74, 0.04, 7, 3, 6);
		logStack(-22, 74.5, -0.03, 7, 3, 6);

		return {
			start: [6, 82.5, Math.PI],
			exits: [
				{ to: 'dachi', x0: 3, x1: 9, z0: 85.2, z1: 90, spawn: [6, 82.5, Math.PI], sign: [10.6, 84, '↓ Дачи'] },
				{ to: 'himmash', x0: -3, x1: 3, z0: -90, z1: -85.2, spawn: [0, -82.5, 0], sign: [4.6, -84, '↑ Химмаш'] },
			],
			// заражённые: бегуны во дворе, у штабелей, у барака и домов; топтун — во дворе и у навеса с техникой
			groups: [
				{ at: [-4, 0], r: 8, runners: 3, stompers: 1 },
				{ at: [-26, -26], r: 8, runners: 3 },
				{ at: [-27, 7], r: 4, runners: 2 },
				{ at: [-24, 18], r: 6, runners: 2 }, // в цеху
				{ at: [-34, 38], r: 5, runners: 2 },
				{ at: [-11, 34], r: 6, runners: 2 },
				{ at: [14, 33], r: 5, runners: 3 },
				{ at: [31, 50], r: 7, runners: 2 },
				{ at: [11, 4], r: 4, runners: 1 },
				{ at: [22, -18], r: 6, runners: 2, stompers: 1 },
				{ at: [1, -46], r: 7, runners: 2 },
				{ at: [6, 40], r: 6, runners: 2 },
				{ at: [46, -10], r: 9, runners: 2 },
				{ at: [44, 24], r: 7, runners: 1 },
				{ at: [-14, -32], r: 6, runners: 1 },
				// новые районы: бегуны, топтун изредка на складе круглого леса
				{ at: [-22.5, -63.5], r: 8, runners: 3, stompers: 1 },
				{ at: [26, -54], r: 7, runners: 3 },
				{ at: [66, -70], r: 9, runners: 2 },
				{ at: [66, -22], r: 5, runners: 2 },
				{ at: [70, 4], r: 6, runners: 2 },
				{ at: [59, 32], r: 6, runners: 3 },
				{ at: [77, 31], r: 5, runners: 2 },
				{ at: [70, 44], r: 7, runners: 2 },
				{ at: [-34, 68], r: 7, runners: 2 },
				{ at: [44, -46], r: 7, runners: 2 },
			],
			onRoad,
			// горит машина на северной дороге, костёр у барака
			fires: [[1.2, -51, 'car'], [13.4, 25.6, 'ground'], [62, -66, 'ground']],
			water: [[riverX(0), 0, 8.6, 140]], // на плане локации — полоса реки вдоль западного края
			trees(tryTree) {
				// сосновый бор: дальний берег, восток, север и юг; берёзы — только вдоль ближнего берега (каждый вид дерева
				// на участке — лишние вызовы отрисовки); посёлок и огороды — без деревьев
				// (180×180 м: бор доходит до нового края — до мути; посёлки, дворы и делянка — без деревьев)
				for (let i = 0; i < 110; i++) { const z = R(-86, 86); tryTree(R(-86, bankL(z) - 1.2), z, 'pine'); }
				for (let i = 0; i < 110; i++) {
					const x = R(36, 86), z = R(-86, 86);
					if (z > 15 && z < 61) continue; // посёлок рабочих
					tryTree(x, z, 'pine');
				}
				for (let i = 0; i < 40; i++) tryTree(R(-40, 46), R(-86, -40), 'pine');
				for (let i = 0; i < 22; i++) { const z = R(-84, 84); tryTree(bankR(z) + R(3.5, 7), z, 'birch'); }
				for (let i = 0; i < 10; i++) tryTree(R(12, 34), R(-14, 22), 'pine');
				for (let i = 0; i < 18; i++) tryTree(R(-26, 2), R(46, 86), 'pine');
				for (let i = 0; i < 30; i++) tryTree(R(12, 86), R(62, 86), 'pine');
			},
			beltTrees: ['pine'],
			beltDensity: 1.4,
			clutter: 9,
			blood: 14,
			puddles: 8,
			puddle: () => [R(-36, 84), R(-84, 84)],
			grass: 1.3,
			hint: (b) => ({
				Sawmill: 'Цех лесопилки — обыщи верстак, шкафчики рабочих, аптечку и сейф мастера',
				Office: 'Контора — в оружейном шкафу сторожа бывают двустволка и патроны 12 калибра',
				Barrack: 'Барак рабочих — обыщи тумбочки у коек и шкафы в каптёрке',
				TruckGarage: 'Гараж лесовозов — верстак, стеллаж с запчастями, шкафчик водителя в конторке',
				DryKilns: 'Сушильные камеры — пульт сушильщика и шкаф в пультовой',
				SawBoiler: 'Котельная на опилках — шкафчик кочегара',
				Canteen: 'Столовая — раздача и холодильник на кухне',
				Barrack2: 'Барак №2 — тумбочки у коек и шкаф в каптёрке',
				DockShed: 'Будка причала — ящик сторожа',
			}[b.name] ?? 'Дом рабочего — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
