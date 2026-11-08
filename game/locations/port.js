// Кластер «Речной порт»: грузовой порт на широкой реке, который Улей перенёс вместе с причалами и грузом.
// Вдоль восточного края — река (по воде не пройти) и причальная стенка с кнехтами и кранцами из покрышек; на причале —
// три портальных крана над причальным путём: у первого на крюке грейфер над баржей с щебнем, у третьего — контейнер
// над сухогрузом «Волжский-27». У стенки — баржа, буксир, сухогруз с контейнерами на люках, на юге — полузатонувший
// теплоход. Вторая линия — складской путь с вагонами вдоль рамп двух кирпичных пакгаузов (стеллажи, ящики, конторка
// кладовщика); между пакгаузами — открытые склады: трубы, рулоны стали, пакеты досок, бытовка докеров. В середине —
// контейнерный двор: стопки в один-три яруса, проходы-лабиринт, ричстакер с поднятым контейнером; часть контейнеров
// открыта — в глубине ящики с патронами и снаряжением. На юге — ремонтные мастерские, котельная, металлолом и слип
// с судном на кильблоках. Порт обнесён бетонным забором; за ним — улица с севера (к Тюрьме) на юг (к Заречному),
// с запада (от Больницы) к проходной со шлагбаумом идёт главная дорога. У проходной — контора порта, якорь-памятник,
// стоянка, гаражи. Опасность 2 (Промзона): бегуны на причале и улице, топтуны водят стаи в контейнерном дворе
// и пакгаузах, рубер — в пакгаузе № 1.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair, buildCheckpoint, buildWorkshop } from '../buildings.js';
import { addCar, bus, streetLamp, bench, transformer } from '../props.js';
import { concreteFence, flatWagon, tankWagon, pipePile, hazardBarrels, barrier, billboard } from '../props-industrial.js';

const Z = Math.PI / 2;
const ONE = new THREE.Vector3(1, 1, 1);
const QX = 58; // кордон причала: восточнее — река
const CX = 49.5, CR = [44, 55]; // ось кранов и подкрановые рельсы (колея 11 м)
const TA = 49.5, TB = 38; // причальный путь (под кранами) и складской (вдоль рамп пакгаузов)
const FX = -40; // забор порта
const SX = -64; // улица за забором (с севера на юг)
const RZ = 8; // главная дорога с запада через проходную к причалу: z 4…12
const C20 = 6.06, C40 = 12.19; // длины 20- и 40-футового контейнера

const frame = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), ONE);
const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const scaleUV = (g, k) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return g; };

/** Брус сечением w×h от точки a до точки b (фермы, тросы, раскосы). */
function beam(a, b, w, h = w) {
	const d = new THREE.Vector3().subVectors(b, a), len = d.length();
	const q = new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(len));
	return box(w, len, h).translate(0, len / 2, 0).applyMatrix4(new THREE.Matrix4().compose(a, q, ONE));
}

// ---------- Контейнеры ----------

/** Морской контейнер в осях F: вдоль своей Z (длина len), двери с запорами — в торце +Z, тёмная рама поверху. */
function shipCont(add, M, F, len, paint) {
	add(box(2.44, 2.59, len, 2.5).translate(0, 1.295, 0).applyMatrix4(F), paint);
	for (const s of [-1, 1]) add(box(0.1, 0.1, len + 0.02).translate(s * 1.18, 2.56, 0).applyMatrix4(F), M.metalDark);
	for (const bx of [-0.55, 0.55]) add(box(0.07, 2.42, 0.07).translate(bx, 1.29, len / 2 + 0.035).applyMatrix4(F), M.metalDark);
}

/**
 * Открытый контейнер, в который можно зайти: стенки из профлиста, пол из фанеры, двери распахнуты наружу; в глубине —
 * ящики (тайник). Двери — в торце −Z своих осей; len — длина (20 или 40 футов).
 */
function buildOpenCont(ctx, { name, cx, cz, ry, len, paint, stash, loot }) {
	const W = 2.44, D = len, H = 2.59, t = 0.07, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.1 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.12, D - 0.1, 1.2), 0, 0.03, 0), M.woodGrey, { cast: false });
	const wo = { mat: paint, t, sx: 2.5 };
	b.wall('z', -hx + t / 2, -hz, hz - t, wo);
	b.wall('z', hx - t / 2, -hz, hz - t, wo);
	b.wall('x', hz - t / 2, -hx, hx, wo);
	b.top_(place(box(W, 0.06, D, 2.5), 0, H + 0.03, 0), paint);
	for (const s of [-1, 1]) b.top_(place(box(0.1, 0.1, D + 0.02), s * (hx - 0.06), H + 0.03, 0), M.metalDark);
	b.lower(place(box(W, 0.12, 0.14), 0, 0.06, -hz + 0.07), M.metalDark); // порог
	b.top_(place(box(W, 0.22, 0.14), 0, H - 0.11, -hz + 0.07), M.metalDark); // балка над проёмом
	// створки распахнуты наружу: от петли (угол проёма) — на угол a от закрытого положения
	for (const [s, a] of [[-1, 1.7], [1, 2.0]]) {
		const dx = -s * Math.cos(a), dz = -Math.sin(a);
		b.furniture(s * hx + dx * 0.6, -hz + dz * 0.6, Math.atan2(-dz, dx), [
			[1.2, 2.45, 0.05, 0, 1.27, 0, paint],
			...[-0.3, 0.3].map((px) => [0.06, 2.3, 0.07, px, 1.27, 0.03, M.metalDark]),
		], { solid: [1.2, 0.12] });
	}
	// в глубине — ящики с грузом (тайник), у стенки — пара мешков
	b.container(stash, 0, hz - t - 0.5, Math.PI, [
		[0.95, 0.62, 0.8, -0.5, 0.31, 0, IM.crateGreen], [0.95, 0.62, 0.8, 0.5, 0.31, 0.02, IM.crate],
		[0.85, 0.55, 0.75, -0.42, 0.9, 0, IM.crateGreen], [0.7, 0.45, 0.6, 0.45, 0.85, 0.05, IM.machine],
	], [2.0, 0.85], loot, 1.2);
	for (const [px, pz, r] of [[-0.75, hz - 1.9, 0.3], [0.7, hz - 2.4, -0.4]]) b.lower(place(box(0.55, 0.2, 0.38), px, 0.13, pz, r), M.sandbag);
	return b.finish();
}

// ---------- Постройки, в которые можно зайти ----------

/**
 * Пакгауз 30×16 м: кирпич, двускатная кровля из профлиста. Двое ворот — к рампе и складскому пути (−Z своих осей),
 * одни — к дороге (+Z), дверь в торце (+X). Внутри — стеллажи вдоль задней стены и в середине, поддоны с мешками,
 * ящики, погрузчик; в углу — конторка кладовщика (стол, сейф). f = ±1 — конторка в левом или правом углу.
 */
function buildPakgauz(ctx, { name, cx, cz, ry, num, f = 1, loot }) {
	const W = 30, D = 16, H = 5.4, rise = 2.6, t = 0.35, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + rise + 0.3 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-8, 8], w: 3.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [4 * f], w: 3.6, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [-1.5], side: -1 });
	// конторка кладовщика в углу
	const kx = -10 * f, pw = { mat: IM.whitewash, t: 0.15 };
	b.wall('z', kx, 2.6, hz - t / 2, { ...pw, doors: [5.0] });
	b.wall('x', 2.6, f > 0 ? -hx + t / 2 : kx, f > 0 ? kx : hx - t / 2, pw);
	const sill = M.brick;
	for (const x of [-13, -3, 3, 13]) b.window('front', x, { y: 3.7, t, sill });
	for (const x of [-12.5, -7, 10, 13]) b.window('back', x * f, { y: 3.7, t, sill });
	for (const z of [-4.5, 4]) { b.window('left', z, { y: 3.7, t, sill }); b.window('right', z, { y: 3.7, t, sill }); }
	// откатные створки ворот отъехали вбок, рельс над проёмами
	for (const x of [-8, 8]) {
		b.wallBox('front', x + Math.sign(x) * 3.7, 3.7, 0.02, 2.08, 0.08, M.metalRust, { t });
		b.wallBox('front', x + Math.sign(x) * 1.8, 7.6, 2.16, 2.3, 0.1, M.metalDark, { t });
	}
	b.wallBox('back', 4 * f - 3.7 * f, 3.7, 0.02, 2.08, 0.08, M.metalRust, { t });
	b.wallBox('right', -1.5 + 1.1, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t }); // дверь в торце распахнута
	b.canopy('front', 0, { w: 26, d: 2.2, y: 3.4, mat: M.roofMetal, t }); // навес над рампой
	// двускатная кровля, фронтоны из кирпича, конёк, дефлекторы
	const slope = Math.hypot(hz + 0.4, rise), a = Math.atan2(rise, hz + 0.4);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.7, 0.08, slope, 2), 0, H + rise / 2, (s * (hz + 0.4)) / 2, 0, s * a), M.roofMetal);
	for (const sx of [-1, 1]) {
		const x = sx * (hx + t / 2 + 0.01);
		const p0 = [x, H, -hz - t / 2], p1 = [x, H, hz + t / 2], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...p0, ...tp, ...p1] : [...p0, ...p1, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 3, rise / 1.5, D / 1.5, 0] : [0, 0, D / 1.5, 0, D / 3, rise / 1.5]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.brick);
	}
	b.top_(place(box(W + 0.74, 0.12, 0.3), 0, H + rise + 0.03, 0), M.metalRust);
	for (const x of [-9, 0, 9]) b.vent(x, 0, H + rise - 0.05, M.silver, { h: 0.6, r: 0.2 });
	b.top_(b.onWall(new THREE.PlaneGeometry(5.4, 0.9).translate(0, H - 0.9, 0.03), 'right', 0, t), T.signMaterial(`ПАКГАУЗ № ${num}`, { bg: '#2a2c26', fg: '#e8dcae', w: 512, h: 86 }));
	// стеллажи: вдоль задней стены и ряд посередине (лицом к задней стене)
	const rack = (x, z, rot, l) => {
		const parts = [
			...[-1.9, 1.9].flatMap((dx) => [-0.4, 0.4].map((dz) => [0.08, 2.8, 0.08, dx, 1.4, dz, IM.rack])),
			...[0.15, 1.0, 1.85, 2.7].map((y) => [3.9, 0.05, 0.9, 0, y, 0, IM.rack]),
			[0.9, 0.6, 0.7, -1.2, 0.48, 0, IM.crate], [0.8, 0.5, 0.7, 0.6, 0.43, 0.05, IM.crateGreen], [1.0, 0.65, 0.7, -0.4, 1.35, 0, IM.crateGreen],
			[0.9, 0.6, 0.7, 1.3, 1.33, 0, IM.crate], [0.8, 0.5, 0.7, -1.3, 2.13, 0, IM.crate], [1.1, 0.5, 0.7, 0.9, 2.13, 0, IM.sofa],
		];
		if (l) b.container('Стеллаж', x, z, rot, parts, [4.0, 1.0], l, 2.8);
		else b.furniture(x, z, rot, parts, { solid: [4.0, 1.0] });
	};
	rack(-6.5 * f, hz - t / 2 - 0.55, Math.PI, loot.rack1);
	rack(11 * f, hz - t / 2 - 0.55, Math.PI, loot.rack2);
	rack(-6 * f, 1.0, 0, loot.rack3);
	rack(-1.5 * f, 1.0, 0, null);
	// поддоны с мешками и ящиками у ворот, ящики с грузом (тайник), погрузчик
	const pallet = (x, z, r, sacks) => b.furniture(x, z, r, sacks
		? [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], ...[-0.3, 0.3].flatMap((px) => [-0.25, 0.25].map((pz) => [0.55, 0.24, 0.42, px, 0.27, pz, M.sandbag])), [0.55, 0.24, 0.42, 0, 0.51, 0, M.sandbag], [0.55, 0.24, 0.42, -0.2, 0.75, 0.1, M.sandbag]]
		: [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], [1.0, 0.7, 0.8, 0, 0.49, 0, IM.crate], [0.8, 0.5, 0.7, 0.05, 1.09, 0, IM.crateGreen]], { solid: [1.25, 1.05] });
	pallet(-12.5 * f, -5.8, 0.1, true); pallet(-11 * f, -5.6, -0.15, true); pallet(-12.4 * f, -3.9, 0.05, false);
	pallet(4 * f, -5.6, 0.2, false); pallet(12.6 * f, 4.6, 0, true);
	// штабели груза посередине: мешки на поддонах в два яруса и ящики — сетка nx×nz поддонов, один коллайдер на штабель
	const stackOf = (x, z, nx, nz, sacks) => {
		const parts = [];
		for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
			const px = (i - (nx - 1) / 2) * 1.3, pz = (k - (nz - 1) / 2) * 1.1, tall = (i * 7 + k * 3 + num) % 4 !== 0;
			parts.push([1.2, 0.14, 1.0, px, 0.07, pz, IM.crate]);
			if (sacks) {
				for (const [sx, sz, y] of [[-0.3, -0.25, 0.27], [0.3, -0.25, 0.27], [-0.3, 0.25, 0.27], [0.3, 0.25, 0.27], [0, -0.22, 0.51], [0, 0.22, 0.51]]) parts.push([0.55, 0.24, 0.42, px + sx, y, pz + sz, M.sandbag]);
				if (tall) parts.push([1.0, 0.45, 0.8, px, 0.86, pz, M.sandbag]);
			} else {
				parts.push([1.1, 0.75, 0.95, px, 0.52, pz, (i + k) % 2 ? IM.crate : IM.crateGreen]);
				if (tall) parts.push([1.0, 0.65, 0.85, px + 0.04, 1.22, pz, (i + k) % 2 ? IM.crateGreen : IM.crate]);
			}
		}
		b.furniture(x, z, 0, parts, { solid: [nx * 1.3 - 0.05, nz * 1.1 - 0.05] });
	};
	stackOf(7 * f, -0.4, 3, 2, true);
	stackOf(11.3 * f, -0.4, 2, 2, false);
	stackOf(-12.2 * f, -0.6, 2, 2, num === 1);
	b.container('Ящики с грузом', 12.6 * f, -5.6, 0, [[1.2, 0.8, 1.2, 0, 0.4, 0, IM.crateGreen], [1.0, 0.6, 1.0, 0, 1.1, 0, IM.crateGreen], [0.9, 0.5, 0.6, 0.9, 0.25, 0.2, IM.crate]], [1.2, 1.2], loot.crates, 1.4);
	b.furniture(1.5 * f, -3.6, 0.35 * f, [
		[1.1, 0.9, 1.7, 0, 0.75, 0, M.yellow], [0.9, 1.0, 0.05, 0, 1.7, -0.3, IM.black],
		[0.08, 1.9, 0.08, -0.4, 1.15, 0.9, IM.black], [0.08, 1.9, 0.08, 0.4, 1.15, 0.9, IM.black],
		[0.1, 0.05, 1.0, -0.3, 0.15, 1.4, IM.metal], [0.1, 0.05, 1.0, 0.3, 0.15, 1.4, IM.metal],
	], { solid: [1.2, 2.4] });
	// конторка: стол кладовщика, сейф, стул, шкаф с накладными
	b.container('Стол кладовщика', -12.6 * f, hz - t / 2 - 0.45, Math.PI, [
		[1.3, 0.75, 0.7, 0, 0.375, 0, IM.furniture], [0.4, 0.3, 0.3, 0.3, 0.9, 0, IM.black], [0.35, 0.03, 0.25, -0.3, 0.77, 0.05, IM.paper],
	], [1.3, 0.7], loot.desk, 0.95);
	if (loot.safe) b.container('Сейф кладовщика', (-hx + t / 2 + 0.35) * f, 4.0, Z * f, [[0.7, 1.1, 0.6, 0, 0.55, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, IM.black]], [0.7, 0.6], loot.safe, 1.1);
	b.furniture(kx - 0.35 * f, 3.4, -Z * f, [[1.0, 1.9, 0.45, 0, 0.95, 0, IM.furniture]], { solid: [1.0, 0.45] });
	return b.finish();
}

/**
 * Контора порта 24×11 м, два этажа (заходят на первый): посередине — коридор; спереди (−Z) — вестибюль с вахтой,
 * диспетчерская (пульт, радиостанция) и касса (сейф, шкаф); сзади — кабинет начальника порта (стол, сейф),
 * красный уголок и комната охраны (оружейный шкаф).
 */
function buildOffice(ctx, { name, cx, cz, ry }) {
	const W = 24, D = 11, H = 3.3, t = 0.3, hx = W / 2, hz = D / 2, cw = 1.25, H2 = H + 0.3, F2 = 3.0;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H2 + F2 + 0.6 });
	b.messKind = 'home';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.plaster, t, lining: IM.wallpaper[1] };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0], w: 1.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	const pw = { mat: IM.whitewash, t: 0.15 };
	b.wall('x', -cw, -hx + t / 2, -4, { ...pw, doors: [-8] });
	b.wall('x', -cw, 4, hx - t / 2, { ...pw, doors: [8] });
	b.wall('x', cw, -hx + t / 2, hx - t / 2, { ...pw, doors: [-8, 0, 8] });
	for (const x of [-4, 4]) { b.wall('z', x, -hz + t / 2, -cw, pw); b.wall('z', x, cw, hz - t / 2, pw); }
	const sill = M.plaster;
	for (const x of [-10, -6, 6, 10]) b.window('front', x, { t, sill });
	for (const x of [-10, -6, -1.5, 1.5, 10]) b.window('back', x, { t, sill });
	for (const z of [-3.2, 3.2]) { b.window('left', z, { t, sill }); b.window('right', z, { t, sill }); }
	// второй этаж (не заходят): перекрытие, стены с окнами, плоская крыша с парапетом
	b.top_(place(box(W + t + 0.3, 0.3, D + t + 0.3, 3), 0, H + 0.15, 0), M.concrete);
	b.top_(place(box(W + t, F2, D + t, 2), 0, H2 + F2 / 2, 0), M.plaster);
	const win = (side, at, k) => b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.1, 1.4), k).translate(0, H2 + 1.55, 0.012), side, at, t), M.window);
	[-10, -6, -2, 2, 6, 10].forEach((x, i) => { win('front', x, [0, 3, 1, 0, 2, 0][i]); win('back', x, [1, 0, 0, 3, 0, 2][i]); });
	for (const z of [-3, 0, 3]) { win('left', z, z ? 0 : 3); win('right', z, z ? 1 : 0); }
	b.top_(place(box(W + t + 0.4, 0.25, D + t + 0.4, 3), 0, H2 + F2 + 0.12, 0), M.roofTar);
	b.parapet(H2 + F2 + 0.25, M.plaster, 0.35);
	b.vent(-7, 2, H2 + F2 + 0.25, M.silver);
	b.vent(5, -2.4, H2 + F2 + 0.25, M.silver, { h: 0.5, r: 0.12 });
	b.top_(place(box(0.08, 3.2, 0.08), 9, H2 + F2 + 1.85, 3), M.metalDark); // антенна диспетчерской
	b.top_(place(box(1.6, 0.05, 0.05), 9, H2 + F2 + 3.2, 3), M.metalDark);
	// вход: козырёк на столбах, крыльцо, распахнутая дверь; вывески
	b.canopy('front', 0, { w: 3.6, d: 1.8, y: 3.0, mat: M.roofTar, posts: M.concrete, t });
	b.lower(place(box(3.4, 0.18, 1.3, 1), 0, 0.09, -hz - 0.8), M.concrete);
	b.wallBox('front', 1.25, 0.8, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(5.0, 0.6).translate(0, H - 0.05, 0.03), 'front', 0, t), T.signMaterial('КОНТОРА ПОРТА', { bg: '#1d3f7a', fg: '#f0f0e8', w: 512, h: 62 }));
	b.top_(b.onWall(new THREE.PlaneGeometry(8.6, 0.9).translate(0, H2 + F2 - 0.6, 0.03), 'left', 0, t), T.signMaterial('УПРАВЛЕНИЕ РЕЧНОГО ПОРТА', { bg: '#e6e2d4', fg: '#1d3f7a', w: 768, h: 80 }));
	// вестибюль: стол вахтёра, доска объявлений, скамья
	b.container('Стол вахтёра', -2.7, -3.2, Z, [[1.3, 0.75, 0.7, 0, 0.375, 0, IM.furniture], [0.4, 0.3, 0.3, 0.3, 0.9, 0, IM.black], [0.3, 0.03, 0.22, -0.3, 0.77, 0, IM.paper]], [1.3, 0.7], { ammo919: [4, 8, 0.5], zhivchik: 0.25, spore: 0.15 }, 0.95);
	chair(b, -3.5, -3.2, Z);
	b.furniture(2.6, -hz + t / 2 + 0.25, 0, [[1.8, 0.4, 0.4, 0, 0.22, 0, IM.furnitureLight]], { solid: [1.8, 0.4] });
	b.furniture(3.8, -2.6, -Z, [[1.4, 1.0, 0.04, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0] });
	// диспетчерская: пульт у окон, радиостанция, стол с картой реки
	b.container('Пульт диспетчера', -8.3, -hz + t / 2 + 0.45, 0, [
		[1.9, 0.08, 0.85, 0, 0.78, 0, IM.furniture], [0.08, 0.75, 0.75, -0.9, 0.38, 0, IM.furniture], [0.08, 0.75, 0.75, 0.9, 0.38, 0, IM.furniture],
		[1.8, 0.42, 0.36, 0, 1.0, -0.22, IM.machine], [0.6, 0.3, 0.03, -0.45, 1.05, -0.03, IM.screen], [0.5, 0.26, 0.03, 0.4, 1.03, -0.03, IM.screen],
	], [1.9, 0.85], { ammo919: [6, 12, 0.5], zhivchik: 0.3, spore: [1, 2, 0.3] }, 1.15);
	chair(b, -6.9, -4.3, Math.PI * 0.8);
	b.furniture(-hx + t / 2 + 0.35, -3.2, Z, [[1.1, 0.75, 0.6, 0, 0.375, 0, IM.furniture], [0.6, 0.35, 0.4, -0.1, 0.93, 0, IM.machine], [0.03, 0.9, 0.03, 0.4, 1.4, -0.1, IM.black]], { solid: [1.1, 0.6] });
	b.furniture(-5.2, -3.4, 0, [[1.2, 0.05, 0.8, 0, 0.75, 0, IM.furniture], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.06, 0.72, 0.06, sx * 0.52, 0.36, sz * 0.32, IM.furniture]), [1.0, 0.01, 0.7, 0, 0.78, 0, IM.paper]], { solid: [1.2, 0.8], prop: 'table' });
	// касса: сейф, шкаф с бумагами, стол кассира
	b.container('Сейф кассы', hx - t / 2 - 0.35, -4.3, -Z, [[0.7, 1.1, 0.6, 0, 0.55, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, IM.black], [0.03, 0.2, 0.03, -0.2, 0.7, 0.31, IM.black]], [0.7, 0.6], { spore: [3, 8, 0.7], ammo919: [8, 16, 0.5], ammo50: [3, 6, 0.25] }, 1.1);
	b.container('Шкаф', 4.6, -4.95, 0, [[1.0, 1.9, 0.5, 0, 0.95, 0, IM.furniture], [0.02, 1.8, 0.02, 0, 0.95, 0.255, IM.black]], [1.0, 0.5], { ammo919: [4, 8, 0.4], zhivchik: 0.25 }, 1.9);
	table(b, 8, -3.6, 0, { w: 1.3, d: 0.7 });
	chair(b, 8, -4.4, 0);
	// кабинет начальника порта: стол, сейф, книжный шкаф, ковёр
	b.container('Стол начальника', -8, 3.6, Math.PI, [
		[1.7, 0.06, 0.85, 0, 0.76, 0, IM.furniture], [0.5, 0.73, 0.8, -0.55, 0.365, 0, IM.furniture], [0.5, 0.73, 0.8, 0.55, 0.365, 0, IM.furniture],
		[0.4, 0.3, 0.3, 0.5, 0.94, 0.1, IM.black], [0.4, 0.03, 0.3, -0.3, 0.8, 0, IM.paper],
	], [1.7, 0.85], { ammo919: [6, 12, 0.5], zhivchik: 0.3, deagle: 0.03 }, 0.95);
	chair(b, -8, 4.5, Math.PI);
	b.container('Сейф начальника', -hx + t / 2 + 0.35, 4.3, Z, [[0.7, 1.2, 0.6, 0, 0.6, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.75, 0.31, IM.black], [0.03, 0.2, 0.03, -0.2, 0.75, 0.31, IM.black]], [0.7, 0.6], { spore: [3, 7, 0.6], ammo50: [4, 8, 0.35], deagle: 0.06, grenade: 0.05 }, 1.2);
	b.furniture(-5.0, hz - t / 2 - 0.25, Math.PI, [[1.6, 2.0, 0.4, 0, 1.0, 0, IM.furniture], ...[0.5, 1.0, 1.5].map((y) => [1.4, 0.3, 0.3, 0, y, 0.03, IM.books[Math.round(y * 2) % 3]])], { solid: [1.6, 0.4] });
	const rugG = planeXZ(3.0, 2.0, 3.0, 2.0); rugG.translate(-8, 0.032, 2.9); b.lower(rugG, IM.rug, { cast: false });
	// красный уголок: длинный стол со стульями, доска почёта
	b.furniture(0, 3.4, 0, [[4.0, 0.06, 1.0, 0, 0.75, 0, IM.furnitureLight], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.07, 0.72, 0.07, sx * 1.9, 0.36, sz * 0.42, IM.furnitureLight])], { solid: [4.0, 1.0] });
	for (const x of [-1.4, 0, 1.4]) chair(b, x, 2.5, Math.PI);
	b.furniture(0, hz - t / 2 - 0.05, Math.PI, [[2.4, 1.2, 0.04, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0] });
	// комната охраны: оружейный шкаф, топчан, стол
	b.container('Оружейный шкаф', hx - t / 2 - 0.25, 3.8, -Z, [
		[1.0, 1.8, 0.45, 0, 0.9, 0, IM.metal], [0.02, 1.7, 0.02, 0, 0.9, 0.23, IM.black], [0.05, 0.05, 0.04, 0.1, 1.0, 0.24, IM.black],
	], [1.0, 0.45], { dbarrel: 0.2, ammo12: [6, 12, 0.7], glock17: 0.15, ammo919: [6, 12, 0.5], aks: 0.05, ammo545: [8, 16, 0.3] }, 1.8);
	b.furniture(6.4, hz - t / 2 - 0.45, Math.PI, [[1.9, 0.35, 0.8, 0, 0.35, 0, IM.furniture], [1.8, 0.1, 0.75, 0, 0.56, 0, IM.blanketArmy]], { solid: [1.9, 0.8] });
	table(b, 9.0, 2.6, 0, { w: 1.0, d: 0.6 });
	chair(b, 9.0, 3.3, Math.PI);
	return b.finish();
}

/** Бытовка докеров 9×4,6 м — вагончик из профлиста: шкафчики, стол со скамьями, буржуйка, аптечка. Дверь — в −Z. */
function buildBytovka(ctx, { name, cx, cz, ry }) {
	const W = 9, D = 4.6, H = 2.7, t = 0.14, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.3 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.roofGreen, t, lining: IM.factoryWall, sx: 2.5 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-2.4], side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [0.6, 3.0]) b.window('front', x, { t, sill: M.metalDark });
	b.window('back', 1.5, { t, sill: M.metalDark });
	b.window('right', 0, { t, sill: M.metalDark });
	b.top_(place(box(W + 0.4, 0.14, D + 0.4, 2.5), 0, H + 0.07, 0), M.roofMetal);
	b.wallBox('front', -2.4 - 1.1, 1.1, 0.02, 2.05, 0.05, M.metalOlive, { t });
	b.lower(place(box(1.6, 0.2, 0.9), -2.4, 0.1, -hz - 0.5), M.woodGrey); // ступенька
	b.chimney(3.7, 1.4, H + 0.1, H + 1.0, 0.18, M.metalDark);
	// шкафчики вдоль задней стены
	const locker = (x, l) => b.container('Шкафчик', x, hz - t / 2 - 0.27, Math.PI, [
		[0.85, 1.9, 0.5, 0, 0.95, 0, IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, IM.black], [0.25, 0.04, 0.02, 0.2, 1.7, 0.26, IM.black],
	], [0.85, 0.5], l, 1.9);
	locker(-3.9, { ammo919: [5, 10, 0.45], zhivchik: 0.25, spore: 0.2 });
	locker(-3.0, { ammo12: [4, 8, 0.4], ammo545: [5, 12, 0.3] });
	for (const x of [-2.1, -1.2]) b.furniture(x, hz - t / 2 - 0.27, Math.PI, [[0.85, 1.9, 0.5, 0, 0.95, 0, IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, IM.black]], { solid: [0.85, 0.5] });
	table(b, 2.2, 0.3, 0, { w: 1.6, d: 0.7 });
	b.furniture(2.2, -0.45, 0, [[1.6, 0.4, 0.32, 0, 0.22, 0, IM.furnitureLight]], { solid: [1.6, 0.32] });
	b.furniture(3.75, 1.45, Math.PI, [[0.6, 0.6, 0.7, 0, 0.3, 0, M.metalDark], [0.12, 0.12, 0.12, 0, 0.66, 0.2, M.metalDark]], { solid: [0.6, 0.7], prop: 'burzhuyka' });
	b.container('Аптечка', hx - t / 2 - 0.12, -1.0, -Z, [[0.5, 0.45, 0.2, 0, 1.4, 0, IM.white], [0.2, 0.06, 0.01, 0, 1.4, 0.105, IM.redBoard], [0.06, 0.2, 0.01, 0, 1.4, 0.106, IM.redBoard]], [0.4, 0.2], { zhivchik: [1, 2, 0.7] }, 1.65);
	return b.finish();
}

// ---------- Краны, суда, вагоны, техника ----------

/**
 * Портальный кран: портал на четырёх ногах над причальным путём (ходовые тележки — на подкрановых рельсах), поворотная
 * часть с машинным отделением, кабиной, противовесом и А-образной стойкой, решётчатая стрела над рекой; на крюке —
 * груз (load: 'grab' — грейфер, 'cont' — контейнер, 'hook' — пустой крюк). slew — поворот стрелы (0 — на восток).
 */
function portalCrane(kb, M, cz, slew, load, cargo) {
	const P = frame(CX, 0, cz), U = frame(CX, 0, cz, -slew);
	const put = (g, mat, F = P) => kb.add(g.applyMatrix4(F), mat);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
		const a = V(sx * 5.5, 0.9, sz * 4), b = V(sx * 4.6, 7.3, sz * 3.1);
		put(box(1.1, 0.9, 2.8).translate(sx * 5.5, 0.45, sz * 4), M.metalDark);
		put(beam(a, b, 0.7), M.yellow);
		put(beam(a.clone().lerp(b, 0.08), a.clone().lerp(b, 0.2), 0.74), M.red); // красно-белая полоса внизу ноги
		put(beam(a.clone().lerp(b, 0.2), a.clone().lerp(b, 0.32), 0.74), M.white);
	}
	for (const sz of [-1, 1]) put(box(10.1, 0.9, 0.9).translate(0, 7.6, sz * 3.1), M.yellow);
	for (const sx of [-1, 1]) {
		put(box(0.9, 0.9, 7.1).translate(sx * 4.6, 7.6, 0), M.yellow);
		put(beam(V(sx * 5.3, 1.8, -3.7), V(sx * 4.75, 7.1, 3.0), 0.3), M.yellow); // раскос
	}
	put(cyl(2.4, 2.6, 0.7, 16).translate(0, 8.4, 0), M.metalDark); // опорно-поворотный круг
	put(box(6.4, 3.0, 4.2, 2).translate(-1.0, 10.25, 0), M.yellow, U); // машинное отделение
	put(box(6.6, 0.16, 4.4).translate(-1.0, 11.83, 0), M.metalDark, U);
	put(box(1.5, 2.6, 3.8).translate(-4.9, 10.3, 0), M.red, U); // противовес
	put(box(1.8, 2.0, 1.7).translate(2.9, 9.75, 1.45), M.white, U); // кабина
	put(box(1.84, 0.85, 1.74).translate(2.95, 10.2, 1.45), M.glass, U);
	const apex = V(0.4, 16, 0), pivot = V(2.6, 9.6, 0), tip = V(2.6 + 20 * Math.cos(0.62), 9.6 + 20 * Math.sin(0.62), 0);
	for (const s of [-1, 1]) {
		put(beam(V(0.2, 11.9, s * 1.7), apex, 0.4), M.yellow, U); // А-образная стойка
		put(beam(V(-3.8, 11.9, s * 1.5), apex, 0.28), M.yellow, U);
		put(beam(V(apex.x, apex.y, s * 0.15), V(tip.x, tip.y + 0.3, s * 0.2), 0.06), M.metalDark, U); // тросы стрелы
	}
	// стрела: два пояса и решётка
	const chord = (s, k) => pivot.clone().lerp(tip, k).setZ(s * (0.65 - 0.4 * k));
	for (const s of [-1, 1]) put(beam(chord(s, 0), chord(s, 1), 0.36), M.yellow, U);
	for (let i = 0; i < 8; i++) {
		put(beam(chord(-1, i / 8), chord(1, (i + 1) / 8), 0.14), M.yellow, U);
		put(beam(chord(-1, (i + 1) / 8), chord(1, (i + 1) / 8), 0.14), M.yellow, U);
	}
	put(box(0.9, 0.9, 0.9).translate(tip.x, tip.y, 0), M.metalDark, U);
	// груз на тросе
	const hy = load === 'cont' ? 8.6 : load === 'grab' ? 9.4 : 13;
	put(beam(V(tip.x, tip.y - 0.45, 0), V(tip.x, hy + (load === 'cont' ? 3.0 : 1.7), 0), 0.06), M.metalDark, U);
	if (load === 'grab') {
		put(cyl(1.0, 0.5, 1.5, 8).translate(tip.x, hy + 0.75, 0), M.metalDark, U);
		put(box(1.7, 0.25, 0.5).translate(tip.x, hy + 1.6, 0), M.yellow, U);
	} else if (load === 'cont') {
		put(box(2.6, 0.3, 6.3).translate(tip.x, hy + 2.85, 0), M.metalDark, U); // спредер
		for (const [px, pz] of [[-1, -2.8], [1, -2.8], [-1, 2.8], [1, 2.8]]) put(beam(V(tip.x, hy + 4.4, 0), V(tip.x + px, hy + 3.0, pz), 0.04), M.metalDark, U);
		shipCont((g, m) => kb.add(g.applyMatrix4(U), m), M, frame(tip.x, hy, 0), C20, cargo);
	} else {
		put(box(0.5, 0.8, 0.4).translate(tip.x, hy + 0.9, 0), M.yellow, U);
		put(new THREE.TorusGeometry(0.22, 0.06, 6, 10, Math.PI * 1.4).translate(tip.x, hy + 0.3, 0), M.metalDark, U);
	}
}

/** Корпус судна в плане (нос — к +Y формы, в мире — к −Z): L×B, bow — длина заострения носа (0 — баржа). */
function hullShape(L, B, bow, round = 1.6) {
	const s = new THREE.Shape(), hb = B / 2, hl = L / 2;
	s.moveTo(-hb + round, -hl);
	s.lineTo(hb - round, -hl);
	s.quadraticCurveTo(hb, -hl, hb, -hl + round);
	if (bow > 0) {
		s.lineTo(hb, hl - bow);
		s.quadraticCurveTo(hb, hl - bow * 0.2, 0, hl);
		s.quadraticCurveTo(-hb, hl - bow * 0.2, -hb, hl - bow);
	} else {
		s.lineTo(hb, hl - round);
		s.quadraticCurveTo(hb, hl, hb - round, hl);
		s.lineTo(-hb + round, hl);
		s.quadraticCurveTo(-hb, hl, -hb, hl - round);
	}
	s.lineTo(-hb, -hl + round);
	s.quadraticCurveTo(-hb, -hl, -hb + round, -hl);
	return s;
}
/** Борт высотой h (от 0 вверх). */
const hullGeo = (shape, h) => new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 5 }).rotateX(-Z);
/** Палуба на высоте y. */
const deckGeo = (shape, y, k = 0.35) => scaleUV(new THREE.ShapeGeometry(shape, 5), k).rotateX(-Z).translate(0, y, 0);

/** Сухогруз «Волжский-27» 56×11 м (нос — к северу): люки трюмов, контейнеры на люках, надстройка с рубкой на корме. */
function freighter(batch, M, root, x, z, pal, rnd) {
	const L = 56, B = 11, h = 3.4, F = frame(x, 0, z);
	const add = (g, mat) => batch.add(g.applyMatrix4(F), mat);
	add(hullGeo(hullShape(L, B, 9), h), M.tankBlack);
	add(hullGeo(hullShape(L + 0.08, B + 0.08, 9), 0.4).translate(0, h - 0.6, 0), M.white);
	add(deckGeo(hullShape(L - 0.3, B - 0.3, 8.9), h + 0.01), M.metalRust);
	add(box(B - 1.2, 1.0, 0.2).translate(0, h + 0.5, -19.5), M.tankBlack); // фальшборт бака
	for (const hz of [-15.5, -6, 3.5, 13]) add(box(8.6, 0.8, 8.4, 2).translate(0, h + 0.4, hz), M.roofGreen); // люки
	// контейнеры поперёк судна на двух люках: нижний ярус — три, верхний — два
	for (const [hz, n2] of [[-6, 2], [3.5, 1]]) for (let k = 0; k < 3; k++) {
		const cz = hz - 2.5 + k * 2.5;
		shipCont(add, M, frame(0, h + 0.8, cz, Z), C20, pal[Math.floor(rnd() * pal.length)]);
		if (k < n2) shipCont(add, M, frame(0.1, h + 3.4, cz, Z + 0.02), C20, pal[Math.floor(rnd() * pal.length)]);
	}
	// надстройка на корме: две палубы, рубка с окнами, труба, мачта; шлюпка на шлюпбалках
	add(box(9.6, 2.6, 7.6, 2).translate(0, h + 1.3, 22.4), M.white);
	add(box(9.64, 0.6, 7.0).translate(0, h + 1.6, 22.4), M.glass);
	add(box(8.2, 2.4, 6.0, 2).translate(0, h + 3.8, 22.8), M.white);
	add(box(10.8, 2.2, 3.4, 2).translate(0, h + 6.1, 21.0), M.white);
	add(box(10.84, 0.8, 3.44).translate(0, h + 6.4, 21.0), M.glass);
	add(box(11.2, 0.16, 3.8).translate(0, h + 7.28, 21.0), M.metalDark);
	add(box(1.8, 2.8, 2.4).translate(0, h + 6.4, 25.0), M.red);
	add(box(1.84, 0.6, 2.44).translate(0, h + 7.6, 25.0), M.tankBlack);
	add(box(0.16, 3.2, 0.16).translate(0, h + 8.9, 21.0), M.metalDark);
	add(box(1.8, 0.12, 0.3).translate(0, h + 9.6, 21.0), M.metalDark);
	add(box(0.2, 7, 0.2).translate(0, h + 3.5, -23.5), M.metalDark); // носовая мачта
	add(box(1.3, 0.8, 4.4).translate(5.3, h + 3.2, 23.2), M.yellow); // шлюпка
	const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.75), T.signMaterial('ВОЛЖСКИЙ-27', { bg: '#1c1c1e', fg: '#e8e4d8', w: 512, h: 72 }));
	sign.position.set(x, h - 1.2, z + L / 2 + 0.04);
	root.add(sign);
}

/** Баржа 40×11 м с трюмом, полным щебня (под грейфером первого крана). */
function barge(batch, M, x, z) {
	const L = 40, B = 11, h = 2.3, F = frame(x, 0, z);
	const add = (g, mat) => batch.add(g.applyMatrix4(F), mat);
	add(hullGeo(hullShape(L, B, 0, 2.4), h), M.metalRust);
	add(hullGeo(hullShape(L + 0.08, B + 0.08, 0, 2.4), 0.3).translate(0, h - 0.45, 0), M.tankBlack);
	add(deckGeo(hullShape(L - 0.3, B - 0.3, 0, 2.3), h + 0.01), M.metalDark);
	const hl = L / 2 - 3.5, hb = B / 2 - 1.0;
	for (const s of [-1, 1]) {
		add(box(2 * hb + 0.3, 0.7, 0.3).translate(0, h + 0.35, s * hl), M.metalRust);
		add(box(0.3, 0.7, 2 * hl).translate(s * hb, h + 0.35, 0), M.metalRust);
	}
	for (const [pz, pl, ph] of [[-6, 20, 2.4], [10, 11, 1.6]]) {
		add(scaleUV(new THREE.CylinderGeometry(0.4, 1, ph, 4, 1), 4).rotateY(Math.PI / 4).scale((2 * hb) / 1.414, 1, pl / 1.414).translate(0, h + ph / 2, pz), M.ballast);
	}
}

/** Буксир 17×6,4 м: рубка, труба, покрышки-кранцы по бортам. */
function tug(batch, M, x, z) {
	const L = 17, B = 6.4, h = 2.2, F = frame(x, 0, z);
	const add = (g, mat) => batch.add(g.applyMatrix4(F), mat);
	add(hullGeo(hullShape(L, B, 4.5, 1.6), h), M.tankBlack);
	add(hullGeo(hullShape(L + 0.08, B + 0.08, 4.5, 1.6), 0.35).translate(0, h - 0.5, 0), M.red);
	add(deckGeo(hullShape(L - 0.3, B - 0.3, 4.4, 1.5), h + 0.01), M.metalDark);
	add(box(4.6, 2.2, 6.2, 2).translate(0, h + 1.1, 1.2), M.white);
	add(box(4.64, 0.6, 5.0).translate(0, h + 1.4, 1.2), M.glass);
	add(box(3.8, 1.9, 3.0, 2).translate(0, h + 3.15, -0.6), M.white);
	add(box(3.84, 0.8, 3.04).translate(0, h + 3.4, -0.6), M.glass);
	add(box(4.2, 0.14, 3.4).translate(0, h + 4.17, -0.6), M.metalDark);
	add(box(1.1, 1.6, 1.5).translate(0, h + 3.0, 3.4), M.red);
	add(box(1.14, 0.4, 1.54).translate(0, h + 3.95, 3.4), M.tankBlack);
	add(box(0.12, 2.6, 0.12).translate(0, h + 5.4, -0.6), M.metalDark);
	add(beam(V(-2.4, h, 6.2), V(0, h + 1.6, 6.2), 0.16), M.metalDark); // буксирная арка
	add(beam(V(2.4, h, 6.2), V(0, h + 1.6, 6.2), 0.16), M.metalDark);
	for (const s of [-1, 1]) for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(0.38, 0.14, 6, 12).rotateY(Z).translate(s * (B / 2 + 0.12), h - 0.6, -4 + i * 2.4), M.tire);
}

/** Полузатонувший прогулочный теплоход: сел на дно, накренился к реке, корма под водой. */
function sunkBoat(batch, M, x, z) {
	const L = 24, B = 5.8, h = 2.4, F = frame(x, -1.2, z, 0.08, -0.05, -0.17);
	const add = (g, mat) => batch.add(g.applyMatrix4(F), mat);
	add(hullGeo(hullShape(L, B, 6, 1.6), h), M.tankWhite);
	add(hullGeo(hullShape(L + 0.08, B + 0.08, 6, 1.6), 0.3).translate(0, h - 0.5, 0), M.contBlue);
	add(deckGeo(hullShape(L - 0.3, B - 0.3, 5.9, 1.5), h + 0.01), M.woodGrey);
	add(box(4.6, 2.2, 14.5, 2).translate(0, h + 1.1, 2.5), M.white);
	add(box(4.64, 0.8, 13.8).translate(0, h + 1.4, 2.5), M.glass);
	add(box(4.9, 0.12, 15).translate(0, h + 2.26, 2.5), M.contBlue);
	add(box(3.2, 1.6, 2.4, 2).translate(0, h + 3.0, -3.6), M.white);
	add(box(3.24, 0.6, 2.44).translate(0, h + 3.2, -3.6), M.glass);
	add(box(0.12, 2.2, 0.12).translate(0, h + 4.6, -3.6), M.metalDark);
}

/** Тележки вагона вдоль Z: по две колёсные пары. */
function bogiesZ(batch, M, x, z, half) {
	for (const bz of [-half + 1.6, half - 1.6]) {
		batch.add(place(box(2.0, 0.5, 2.4), x, 0.55, z + bz), M.metalDark);
		for (const wz of [-0.7, 0.7]) for (const wx of [-0.76, 0.76]) batch.add(place(cyl(0.45, 0.45, 0.14, 12).rotateZ(Z), x + wx, 0.45, z + bz + wz), M.rail);
	}
}

/** Полувагон 13,9 м вдоль Z: открытый кузов с рёбрами по бортам; груз — уголь или металлолом. */
function gondola(batch, M, collide, R, x, z, paint, cargo) {
	const L = 13.9, h = 2.1, y0 = 1.25;
	bogiesZ(batch, M, x, z, L / 2);
	batch.add(place(box(2.9, 0.3, L), x, 1.1, z), M.metalDark);
	for (const s of [-1, 1]) {
		batch.add(place(box(0.1, h, L, 1.5), x + s * 1.5, y0 + h / 2, z), paint);
		for (let i = 0; i <= 8; i++) batch.add(place(box(0.08, h, 0.14), x + s * 1.57, y0 + h / 2, z - L / 2 + 0.2 + (i * (L - 0.4)) / 8), M.metalDark);
		batch.add(place(box(3.1, h, 0.1, 1.5), x, y0 + h / 2, z + s * (L / 2 - 0.05)), paint);
	}
	if (cargo === 'coal') {
		batch.add(place(box(2.9, 0.3, L - 0.3), x, y0 + h - 0.35, z), M.tankBlack);
		for (const dz of [-4, 0, 4]) batch.add(place(new THREE.CylinderGeometry(0.2, 1, 0.6, 4).rotateY(Math.PI / 4).scale(1.9, 1, 2.6), x, y0 + h - 0.1, z + dz), M.tankBlack);
	} else {
		batch.add(place(box(2.9, 0.2, L - 0.3), x, y0 + h - 0.6, z), M.metalRust);
		for (let i = 0; i < 16; i++) {
			const g = i % 3 ? box(R(0.4, 1.6), R(0.08, 0.3), R(0.2, 0.7)) : cyl(0.12, 0.12, R(1, 2.4), 8);
			batch.add(place(g, x + R(-1.1, 1.1), y0 + h - R(0.1, 0.5), z + R(-6, 6), R(0, 3), R(-0.5, 0.5), R(-0.5, 0.5)), i % 4 ? M.metalRust : M.metalDark);
		}
	}
	collide(x, z, 3.2, L);
}

/** Крытый вагон 12 м вдоль Z: ржавый, дверь откачена (дверь — с запада, к рампе). */
function boxcar(batch, M, collide, x, z, paint) {
	const L = 12;
	bogiesZ(batch, M, x, z, L / 2);
	batch.add(place(box(2.9, 0.3, L), x, 1.1, z), M.metalDark);
	batch.add(place(box(2.9, 2.6, L, 1.5), x, 2.55, z), paint);
	batch.add(place(box(3.0, 0.14, L + 0.1), x, 3.92, z), M.metalDark);
	batch.add(place(box(2.0, 0.14, L - 0.4), x, 4.06, z), M.metalDark);
	batch.add(place(box(0.07, 2.2, 2.6), x - 1.5, 2.4, z + 1.6), M.metalDark);
	batch.add(place(box(0.08, 0.08, L - 1.5), x - 1.52, 3.72, z), M.metalDark);
	collide(x, z, 3.1, L);
}

/** Ричстакер (погрузчик контейнеров) с поднятым 20-футовым контейнером; перед — +X своих осей. */
function reachStacker(batch, M, collide, x, z, ry, cargo) {
	const F = frame(x, 0, z, ry);
	const add = (g, mat) => batch.add(g.applyMatrix4(F), mat);
	add(box(7.2, 1.3, 3.4, 1.5).translate(0, 1.35, 0), M.yellow);
	add(box(1.4, 1.5, 3.2).translate(-3.3, 2.0, 0), M.metalDark);
	for (const wx of [-2.4, 2.3]) for (const s of [-1, 1]) add(cyl(0.85, 0.85, 0.6, 14).rotateX(Z).translate(wx, 0.85, s * 1.55), M.tire);
	add(box(1.9, 2.0, 1.6).translate(-0.6, 3.0, -1.0), M.yellow);
	add(box(1.94, 0.9, 1.64).translate(-0.6, 3.4, -1.0), M.glass);
	add(beam(V(-2.8, 2.6, 0.4), V(4.6, 6.6, 0.4), 0.8), M.yellow);
	add(box(0.6, 0.6, 6.3).translate(5.0, 6.75, 0.4), M.metalDark);
	shipCont(add, M, frame(5.0, 3.95, 0.4), C20, cargo);
	collide(x, z, 7.6, 3.6, ry);
}

/** Седельный тягач с полуприцепом и 40-футовым контейнером; кабина — к +X своих осей. */
function contTruck(batch, M, collide, x, z, ry, paint, cargo) {
	const F = frame(x, 0, z, ry);
	const add = (g, mat) => batch.add(g.applyMatrix4(F), mat);
	add(box(2.2, 2.4, 2.5, 1.5).translate(6.5, 2.0, 0), paint);
	add(box(0.05, 0.95, 2.2).translate(7.62, 2.55, 0), M.glass);
	add(box(3.6, 0.35, 2.0).translate(5.6, 0.95, 0), M.metalDark);
	add(box(12.4, 0.35, 2.4).translate(-1.4, 1.35, 0), M.metalDark);
	for (const wx of [6.7, 4.5, -5.6, -6.9]) for (const s of [-1, 1]) add(cyl(0.5, 0.5, 0.36, 12).rotateX(Z).translate(wx, 0.5, s * 1.0), M.tire);
	shipCont(add, M, frame(-1.4, 1.53, 0, Z), C40, cargo);
	collide(x + Math.cos(ry) * 0.2, z - Math.sin(ry) * 0.2, 15.6, 2.6, ry);
}

/** Вилочный погрузчик; вилы — к +X своих осей. */
function forklift(batch, M, collide, x, z, ry) {
	const F = frame(x, 0, z, ry);
	const add = (g, mat) => batch.add(g.applyMatrix4(F), mat);
	add(box(1.8, 0.9, 1.1).translate(0, 0.75, 0), M.yellow);
	add(box(0.5, 0.9, 1.1).translate(-1.0, 0.75, 0), M.metalDark);
	for (const [px, pz] of [[-0.6, -0.5], [-0.6, 0.5], [0.4, -0.5], [0.4, 0.5]]) add(box(0.07, 1.2, 0.07).translate(px, 1.8, pz), M.metalDark);
	add(box(1.1, 0.06, 1.1).translate(-0.1, 2.4, 0), M.metalDark);
	for (const s of [-1, 1]) {
		add(box(0.1, 2.4, 0.1).translate(1.0, 1.25, s * 0.35), M.metalDark);
		add(box(1.1, 0.06, 0.12).translate(1.6, 0.18, s * 0.3), M.metalDark);
		for (const wx of [-0.55, 0.55]) add(cyl(0.3, 0.3, 0.22, 10).rotateX(Z).translate(wx, 0.3, s * 0.55), M.tire);
	}
	collide(x + Math.cos(ry) * 0.3, z - Math.sin(ry) * 0.3, 2.8, 1.3, ry);
}

/** Якорь-памятник на постаменте у проходной. */
function anchorMonument(batch, M, collide, x, z) {
	const put = (g, mat) => batch.add(g.translate(x, 0, z), mat);
	put(box(2.6, 0.9, 2.6, 1.5).translate(0, 0.45, 0), M.concrete);
	put(box(2.9, 0.12, 2.9).translate(0, 0.96, 0), M.concreteDark);
	put(box(0.32, 3.4, 0.32).translate(0, 2.7, 0), M.tankBlack); // веретено
	put(box(2.4, 0.24, 0.24).translate(0, 3.9, 0), M.tankBlack); // шток
	put(new THREE.TorusGeometry(0.34, 0.08, 6, 14).translate(0, 4.65, 0), M.tankBlack); // скоба
	put(new THREE.TorusGeometry(1.15, 0.15, 6, 16, Math.PI).rotateZ(Math.PI).translate(0, 2.4, 0), M.tankBlack); // рога
	for (const s of [-1, 1]) put(new THREE.ConeGeometry(0.3, 0.7, 4).translate(s * 1.15, 2.6, 0), M.tankBlack); // лапы
	put(new THREE.RingGeometry(1.7, 2.9, 20).rotateX(-Z).translate(0, 0.025, 0), M.dirt);
	collide(x, z, 2.8, 2.8);
}

export default {
	id: 'port',
	seed: 7101,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// краска контейнеров: свои синяя и красная и профлист из общих материалов
		M.contBlue = T.metalRoofMaterial([1, 1], [56, 88, 128]);
		M.contRed = T.metalRoofMaterial([1, 1], [150, 62, 44]);
		M.contBlue.name = 'contBlue'; M.contRed.name = 'contRed';
		const PAL = [M.contBlue, M.contRed, M.roofGreen, M.tankWhite, M.roofMetal, M.contBlue, M.contRed, M.metalOlive];
		const addB = (g, m) => batch.add(g, m);
		const stripe = (w, d, x, z, mat = M.yellow) => batch.add(place(planeXZ(w, d, 1), x, 0.028, z), mat, { cast: false });

		// ---------- Покрытия: весь порт замощён; за забором — улица, площадь у проходной, стоянка ----------
		ground(49, 178, -15.5, 0, M.concrete, 4, 0.016); // контейнерный двор (x −40…9)
		ground(6, 178, 12, 0, M.asphalt, 5, 0.02); // внутренняя дорога вдоль двора
		ground(25, 178, 27.5, 0, M.concrete, 4, 0.0155); // открытые склады и пакгаузы (x 15…40)
		ground(18.4, 178, 49.2, 0, M.concrete, 4, 0.017); // причал (x 40…58)
		ground(80, 8, 0, RZ, M.asphalt, 5, 0.022); // главная дорога внутри порта
		ground(16, 8, 44, RZ, M.asphalt, 5, 0.19); // переезд через пути на причал
		ground(8, 180, SX, 0, M.asphalt, 5, 0.02); // улица
		ground(50, 8, -65, RZ, M.asphalt, 5, 0.021); // дорога к Больнице
		ground(20, 18, -50, 6, M.asphalt, 5, 0.0205); // площадь у проходной
		ground(16, 20, -50, 36, M.asphalt, 5, 0.0205); // стоянка
		ground(4.5, 3, -57.8, -22, M.concrete, 3, 0.0215); // дорожка к конторе
		ground(19, 6.5, -50.5, -52.2, M.concrete, 4, 0.02); // перед гаражами
		ground(3, 8, -70, 22, M.concrete, 3, 0.02); // остановка
		for (const cz of [-52, 40]) { ground(4.4, 31, 34.2, cz, M.concrete, 3, 0.03); stripe(0.18, 31, 36.3, cz, M.hazard); } // рампы пакгаузов
		for (const [x, z, w, d] of [[-30, -36, 8, 5], [-4, -64, 6, 9], [2, 30, 7, 6], [-26, 52, 9, 6], [26, -76, 10, 7], [46, 60, 6, 10]]) ground(w, d, x, z, M.dirt, 4, 0.0175); // разбитые места, грязь
		// разметка: проходы контейнерного двора, линия безопасности на причале
		for (const [z0, z1] of [[-84, -6], [16, 58]]) for (let z = z0; z < z1; z += 4) for (const x of [-17.2, -10.8]) stripe(0.15, 2.4, x, z + 1.2);
		for (let x = -37; x < 8; x += 4) for (const z of [-46.7, -39.8]) stripe(2.4, 0.15, x + 1.2, z);
		stripe(0.15, 176, 41.6, 0);
		const onRoad = (x, z, m = 0) => (x > FX - 0.5 - m && x < QX + m) // весь порт замощён
			|| Math.abs(x - SX) < 4 + m // улица
			|| (Math.abs(z - RZ) < 4 + m && x < FX) // дорога к Больнице
			|| (x > -60 - m && x < FX && z > -3 - m && z < 15 + m) // площадь у проходной
			|| (x > -58 - m && x < -42 + m && z > 26 - m && z < 46 + m); // стоянка

		// ---------- Река и причальная стенка: кордон, кранцы, кнехты ----------
		batch.add(place(planeXZ(80, 260, 18), QX + 40, 0.04, 0), M.water, { cast: false });
		batch.add(place(box(0.8, 0.34, 184, 2), QX - 0.4, 0.17, 0), M.concreteDark);
		batch.add(place(planeXZ(1.0, 184, 2), QX + 0.5, 0.046, 0), M.tankBlack, { cast: false }); // тень под стенкой
		collide((QX - 0.6 + 100) / 2, 0, 100 - (QX - 0.6), 200);
		for (let z = -84; z <= 84; z += 6) batch.add(place(new THREE.TorusGeometry(0.42, 0.16, 6, 12).rotateY(Z), QX + 0.2, 0.14, z), M.tire);
		const bollards = [];
		for (let z = -80; z <= 80; z += 10) {
			batch.add(place(cyl(0.2, 0.26, 0.55, 10), QX - 1.0, 0.3, z), M.metalDark);
			batch.add(place(cyl(0.33, 0.33, 0.1, 10), QX - 1.0, 0.6, z), M.metalDark);
			collide(QX - 1.0, z, 0.6, 0.6);
			bollards.push(z);
		}
		for (const z of [-44, 26, 64]) { // спасательные круги
			batch.add(place(box(0.08, 1.5, 0.08), QX - 1.6, 0.75, z), M.metalDark);
			batch.add(place(new THREE.TorusGeometry(0.32, 0.08, 6, 14), QX - 1.6, 1.15, z + 0.06), M.red);
			collide(QX - 1.6, z, 0.3, 0.3);
		}

		// ---------- Суда у причала ----------
		barge(batch, M, 66.2, -60);
		tug(batch, M, 64.2, -28);
		freighter(batch, M, root, 66.8, 14, PAL, rnd);
		sunkBoat(batch, M, 67.5, 70);
		// швартовы: от кнехтов к бортам
		for (const [z, tx, tz, ty] of [[-70, 61, -73, 2.4], [-50, 61, -47, 2.4], [-30, 61.2, -33, 2.3], [-10, 61.6, -8, 3.5], [30, 61.6, 33, 3.5], [40, 61.6, 37, 3.5]]) {
			batch.add(beam(V(QX - 1.0, 0.6, z), V(tx, ty, tz), 0.06), M.sandbag);
		}

		// ---------- Причал: подкрановые рельсы, причальный путь, портальные краны ----------
		for (const x of CR) {
			batch.add(place(box(0.5, 0.012, 178), x, 0.024, 0), M.metalDark, { cast: false });
			batch.add(place(box(0.12, 0.06, 178), x, 0.04, 0), M.rail, { cast: false });
		}
		const trackZ = (x, z0, z1) => {
			const len = z1 - z0, cz = (z0 + z1) / 2;
			batch.add(place(box(3.0, 0.1, len, 2), x, 0.05, cz), M.ballast, { cast: false });
			for (let z = z0 + 0.35; z < z1; z += 0.7) batch.add(place(box(2.5, 0.1, 0.22), x, 0.12, z), M.sleeper, { cast: false });
			for (const dx of [-0.76, 0.76]) batch.add(place(box(0.08, 0.14, len), x + dx, 0.24, cz), M.rail, { cast: false });
			batch.add(place(box(3.0, 1.1, 0.6), x, 0.55, z1 + 0.3), M.red); // упор
			batch.add(place(box(3.2, 0.3, 0.3), x, 1.25, z1 + 0.2), M.white);
			collide(x, z1 + 0.3, 3.0, 0.6);
		};
		trackZ(TA, -90, 76);
		trackZ(TB, -90, 61);
		const CRANES = [[-58, -0.08, 'grab'], [-2, 0.42, 'hook'], [30, -0.2, 'cont']];
		CRANES.forEach(([cz, slew, load], i) => {
			occluder(`Crane${i + 1}`, (kb) => portalCrane(kb, M, cz, slew, load, M.contRed), { cx: CX, cz, ry: 0, hx: 6.4, hz: 4.9, top: 12.2 }, 0.2);
			for (const sx of [-1, 1]) for (const sz of [-1, 1]) collide(CX + sx * 5.5, cz + sz * 4, 1.2, 2.9);
		});
		// вагоны: полувагоны с углём и ломом на причальном пути, платформа с контейнером, крытые вагоны у пакгауза № 1, цистерна
		gondola(batch, M, collide, R, TA, -41, M.metalRust, 'scrap');
		gondola(batch, M, collide, R, TA, -26.7, M.roofMetal, 'coal');
		flatWagon(batch, M, collide, TA, 50, Z, M.contBlue);
		boxcar(batch, M, collide, TB, -60, M.metalRust);
		boxcar(batch, M, collide, TB, -46.6, M.roofGreen);
		tankWagon(batch, M, collide, TB, 47, Z, M.tankBlack);
		// груз на причале: контейнеры, поддоны с мешками, ящики, бочки, погрузчик, сгоревшая машина, прожекторы
		for (const [cz, paint] of [[16, M.contBlue], [22.5, M.tankWhite]]) { shipCont(addB, M, frame(52.9, 0, cz), C20, paint); collide(52.9, cz, 2.5, C20); }
		const sacks = (x, z, r) => {
			batch.add(place(box(1.2, 0.14, 1.0), x, 0.07, z, r), M.wood);
			for (let k = 0; k < 5; k++) batch.add(place(box(0.55, 0.24, 0.42), x + ((k % 2) - 0.5) * 0.6 * (k < 4 ? 1 : 0), 0.27 + Math.floor(k / 4) * 0.24, z + (Math.floor(k / 2) % 2 - 0.5) * 0.48 * (k < 4 ? 1 : 0), r + k * 0.2), M.sandbag);
			collide(x, z, 1.3, 1.1, r);
		};
		const crate = (x, z, r) => { beginProp('crate', x, z, r); batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood); endProp(); collide(x, z, 1.2, 0.9, r); };
		for (const [x, z, r] of [[42.2, -51, 0.1], [42.4, -49.2, -0.1], [42.0, -36, 0.3], [42.3, 34.5, 0], [42.1, 36.3, 0.2], [53, -76, 0.4]]) sacks(x, z, r);
		for (const [x, z, r] of [[42.5, -66, 0.2], [42.2, -64.6, 0.6], [53.2, -14, 0.1], [52.8, -12.6, -0.3], [42.4, 58, 0.5], [16.8, -82, 0.2]]) crate(x, z, r);
		forklift(batch, M, collide, 53.6, -20, 0.3);
		forklift(batch, M, collide, 34.4, -40, Math.PI - 0.25);
		hazardBarrels(batch, M, collide, 42.6, 66, rnd, 5);
		addCar(batch, M, root, 45.8, 70, 1.3, 0x5a5a3a, { burned: true }); collide(45.8, 70, 4.3, 1.8, 1.3);
		const mast = (x, z, h = 18) => {
			batch.add(place(cyl(0.16, 0.32, h, 8), x, h / 2, z), M.metalRust);
			batch.add(place(box(3.0, 0.25, 0.25), x, h - 0.4, z), M.metalDark);
			for (const dx of [-1.1, 0, 1.1]) batch.add(place(box(0.5, 0.35, 0.3), x + dx, h - 0.7, z), M.white);
			collide(x, z, 0.7, 0.7);
		};
		mast(41.6, -20); mast(41.6, 46); mast(-14, -43.3); mast(-33, 14.6); mast(34.8, -8);

		// ---------- Пакгаузы, открытые склады между ними, бытовка докеров ----------
		buildings.push(
			buildPakgauz(bctx, { name: 'Pakgauz1', cx: 24, cz: -52, ry: -Z, num: 1, f: 1, loot: {
				rack1: { ammo545: [10, 20, 0.5], ammo762: [10, 20, 0.4], zhivchik: 0.15 },
				rack2: { ammo919: [10, 20, 0.4], ammo12: [6, 10, 0.4], spore: [1, 3, 0.3] },
				rack3: { ammo762: [10, 25, 0.5], grenade: 0.08, ammo76254: [5, 10, 0.2] },
				crates: { ammo545: [10, 25, 0.5], ammo556: [10, 20, 0.3], grenade: 0.1 },
				desk: { ammo919: [4, 8, 0.5], zhivchik: 0.3, spore: [1, 2, 0.3] },
				safe: { spore: [2, 5, 0.6], ammo76254: [5, 10, 0.3], deagle: 0.04, ammo50: [3, 6, 0.25] },
			} }),
			buildPakgauz(bctx, { name: 'Pakgauz2', cx: 24, cz: 40, ry: -Z, num: 2, f: -1, loot: {
				rack1: { ammo12: [6, 12, 0.5], ammo919: [10, 20, 0.4], zhivchik: 0.2 },
				rack2: { ammo545: [10, 20, 0.45], grenade: 0.07, spore: [1, 2, 0.25] },
				rack3: { ammo762: [10, 20, 0.45], ammo76251: [5, 10, 0.2], zhivchik: 0.15 },
				crates: { ammo762: [15, 30, 0.5], rpk: 0.04, grenade: 0.08 },
				desk: { ammo919: [4, 8, 0.45], zhivchik: 0.3, ammo12: [3, 6, 0.3] },
			} }),
			buildBytovka(bctx, { name: 'Bytovka', cx: 24, cz: -16, ry: Math.PI }),
		);
		pipePile(batch, M, collide, 21.5, -29.5, 0);
		pipePile(batch, M, collide, 29.5, -29.2, 0.04);
		transformer(batch, root, M, collide, 33.6, -20.5);
		const coils = (x, z, n) => {
			for (const dx of [-0.5, 0.5]) batch.add(place(box(0.22, 0.16, n * 1.7), x + dx, 0.08, z + (n - 1) * 0.85), M.woodGrey);
			for (let i = 0; i < n; i++) batch.add(place(cyl(0.75, 0.75, 1.4, 16).rotateZ(Z), x, 0.9, z + i * 1.7), M.silver);
			collide(x, z + (n - 1) * 0.85, 1.6, n * 1.7);
		};
		coils(19.5, -6, 4); coils(22.5, -6, 3); coils(27, -82, 4); coils(30, -82, 3);
		const timber = (x, z, ry, n = 2) => {
			for (let k = 0; k < n; k++) {
				batch.add(place(box(5.6, 1.0, 1.3, 1.2), x, 0.55 + k * 1.12, z, ry), M.wood);
				for (const d of [-2, 0, 2]) batch.add(place(box(0.12, 0.1, 1.4).translate(d, 0, 0), x, 0.06 + k * 1.12, z, ry), M.woodGrey);
			}
			collide(x, z, 5.8, 1.4, ry);
		};
		timber(29, -4); timber(29, -1.6, 0, 1); timber(29, 0.8); timber(20.5, -78); timber(20.5, -75.6, 0, 1);
		contTruck(batch, M, collide, 24.5, 18.6, Math.PI, M.contBlue, M.contRed);
		forklift(batch, M, collide, 33.2, 15.4, 2.2);
		for (const [x, z, r] of [[17, 14, 0.2], [18.3, 15.6, 0.7], [17.4, 17.4, 0]]) crate(x, z, r);
		sacks(31, -12, 0.1); sacks(32.4, -11.6, -0.2);
		// слип с судном на кильблоках (южнее пакгауза № 2): корпус, леса, подпорки
		occluder('Slip', (kb) => {
			const F = frame(28, 1.3, 70, Z);
			const add = (g, m) => kb.add(g.applyMatrix4(F), m);
			add(hullGeo(hullShape(26, 7.6, 6.5, 1.6), 1.9), M.red);
			add(hullGeo(hullShape(26.06, 7.66, 6.5, 1.6), 2.6).translate(0, 1.9, 0), M.tankBlack);
			add(deckGeo(hullShape(25.7, 7.3, 6.4, 1.5), 4.51), M.metalRust);
			add(box(5.6, 2.2, 6.0, 2).translate(0, 5.6, 6.0), M.white);
			add(box(5.64, 0.7, 5.0).translate(0, 5.9, 6.0), M.glass);
			for (let i = 0; i < 6; i++) kb.add(place(box(1.4, 1.3, 2.2, 1), 28 - 10 + i * 4, 0.65, 70), M.sleeper); // кильблоки
			for (let i = 0; i < 5; i++) for (const s of [-1, 1]) kb.add(beam(V(28 - 9 + i * 4.5, 0, 70 + s * 5.4), V(28 - 9 + i * 4.5, 3.2, 70 + s * 3.75), 0.18), M.wood); // подпорки
			for (let i = 0; i < 6; i++) kb.add(place(box(0.08, 6.0, 0.08), 18 + i * 4, 3.0, 74.8), M.metalDark); // леса
			for (const y of [2.0, 4.0]) kb.add(place(box(21, 0.06, 0.7), 28, y, 74.6), M.woodGrey);
		}, { cx: 28, cz: 70, ry: 0, hx: 13.6, hz: 5.4, top: 6.8 }, 0.25);
		collide(28, 70, 26.4, 8);
		for (let i = 0; i < 5; i++) for (const s of [-1, 1]) collide(28 - 9 + i * 4.5, 70 + s * 5.2, 0.4, 0.6);
		collide(28, 74.8, 21, 0.3);

		// ---------- Контейнерный двор ----------
		// ряды с севера на юг: z0 — северный край ряда, длина — 20 или 40 футов; куски слева направо (западная часть —
		// от x = −37, восточная — от −11): число — проход, строка цифр — стопки (сколько ярусов), 'O' / 'o' — открытый
		// контейнер с тайником (двери на юг / на север). Главные проходы: x −17…−11 и z −46,5…−40.
		const ROWS = [
			[-84, C40, ['2332', 2.5, '121'], ['2211', 2, '22']],
			[-68.2, C20, ['11', 'O', 2, '3221'], ['33', 3, '1231']],
			[-58.7, C40, ['1221', 4, '22'], ['1', 'O', 3, '2321']],
			[-40, C20, ['23', 2.5, '1', 'O', 2.5, '32'], ['2222', 2.5, '1', 'O']],
			[-30.4, C40, ['3322', 3, '11'], ['11', 2, '332']],
			[-12, C20, ['12', 4, '221'], ['231', 3, '12']],
			[18, C20, ['22', 3, '1', 'o', 2, '21'], ['121', 3, '2']],
			[27.6, C40, ['2332', 2.5, '22'], ['11', 'O', 2, '221']],
			[43.4, C20, ['1', 'O', 3, '121'], ['22', 4, '1']],
		];
		const opens = [];
		let stacks = 0;
		const block = (x0, z0, len, cols) => {
			const c1 = PAL[Math.floor(rnd() * PAL.length)], c2 = PAL[Math.floor(rnd() * PAL.length)];
			const cz = z0 + len / 2, upper = [];
			let top = 0;
			cols.forEach((n, i) => {
				const x = x0 + 1.25 + i * 2.5;
				top = Math.max(top, n);
				for (let k = 0; k < n; k++) {
					const F = k ? frame(x + R(-0.07, 0.07), k * 2.6, cz + R(-0.25, 0.25), R(-0.025, 0.025)) : frame(x, 0, cz);
					const paint = rnd() < 0.6 ? c1 : c2;
					if (k) upper.push([F, paint]); else shipCont(addB, M, F, len, paint);
				}
			});
			for (let i = 0; i < cols.length;) { // стопки подряд — одним коллайдером
				if (!cols[i]) { i++; continue; }
				let j = i;
				while (j < cols.length && cols[j]) j++;
				collide(x0 + (i + j) * 1.25, cz, (j - i) * 2.5 - 0.06, len);
				i = j;
			}
			// верхние ярусы загораживают героя от камеры — полупрозрачные, когда он за ними
			if (upper.length) {
				occluder(`Stack${++stacks}`, (kb) => { for (const [F, p] of upper) shipCont((g, m) => kb.add(g, m), M, F, len, p); },
					{ cx: x0 + cols.length * 1.25, cz, ry: 0, hx: cols.length * 1.25 + 0.3, hz: len / 2 + 0.4, top: top * 2.6 }, 0.22);
			}
		};
		for (const [z0, len, west, east] of ROWS) {
			for (const [x0, items] of [[-37, west], [-11, east]]) {
				let x = x0;
				for (const it of items) {
					if (typeof it === 'number') x += it;
					else if (it === 'O' || it === 'o') { opens.push({ x: x + 1.25, z: z0 + len / 2, len, south: it === 'O' }); x += 2.5; }
					else { const cols = [...it].map(Number); block(x, z0, len, cols); x += cols.length * 2.5; }
				}
			}
		}
		// уроненный контейнер в широком проходе
		shipCont(addB, M, frame(-30, 0, -43.2, 1.35), C20, M.contRed); collide(-30, -43.2, 2.5, C20, 1.35);
		// открытые контейнеры: в глубине — ящики с патронами и снаряжением
		const OPEN = [
			['Ящики с патронами', { ammo545: [10, 25, 0.6], ammo762: [10, 20, 0.4], grenade: 0.06 }],
			['Ящики со снаряжением', { zhivchik: [1, 2, 0.45], ammo919: [8, 16, 0.5], spore: [1, 3, 0.3], grenade: 0.05 }],
			['Груз', { ammo12: [6, 12, 0.5], ammo556: [10, 20, 0.35], dbarrel: 0.06 }],
			['Ящики с патронами', { ammo76254: [5, 10, 0.35], ammo545: [10, 20, 0.5], grenade: 0.08 }],
			['Оружейный ящик', { ak74: 0.07, aks: 0.1, ammo545: [15, 30, 0.6] }],
			['Ящики', { ammo762: [10, 20, 0.5], rpk: 0.04, zhivchik: 0.25 }],
			['Контрабанда', { deagle: 0.05, ammo50: [4, 8, 0.4], spore: [2, 5, 0.5], g36: 0.03, ammo556: [10, 20, 0.4] }],
		];
		opens.forEach((o, i) => {
			const [stash, loot] = OPEN[i % OPEN.length];
			buildings.push(buildOpenCont(bctx, { name: `Cont${i + 1}`, cx: o.x, cz: o.z, ry: o.south ? Math.PI : 0, len: o.len, paint: PAL[(i * 3) % PAL.length], stash, loot }));
		});
		reachStacker(batch, M, collide, -26, -0.6, 0, M.contBlue);
		contTruck(batch, M, collide, -28, 10.2, Math.PI, M.red, M.tankWhite);
		contTruck(batch, M, collide, 0, 15.2, 0.03, M.contBlue, M.roofGreen);

		// ---------- Юг двора: ремонтные мастерские, котельная, металлолом ----------
		buildings.push(buildWorkshop(bctx, { name: 'Masterskie', cx: -14, cz: 72, ry: 0 }));
		{
			const x = -33, z = 76;
			batch.add(place(box(4.2, 2.2, 4.2, 1.5), x, 1.1, z), M.brick);
			batch.add(place(cyl(0.95, 1.5, 20, 16), x, 12, z), M.brick);
			for (const y of [16, 19]) batch.add(place(cyl(1.2 - (y / 22) * 0.45, 1.22 - (y / 22) * 0.45, 1.2, 16), x, y, z), M.whiteBrick);
			batch.add(place(cyl(1.0, 1.0, 0.6, 16), x, 22, z), M.red);
			collide(x, z, 4.2, 4.2);
			batch.add(place(new THREE.CylinderGeometry(0.5, 3.2, 1.6, 9).scale(1.3, 1, 0.9), -32, 0.8, 66.5), M.tankBlack); // уголь для котельной
			collide(-32, 66.5, 7, 4.6);
		}
		hazardBarrels(batch, M, collide, -29, 59.5, rnd, 5);
		{
			// куча металлолома: курган из ржавчины, сверху — обрезки труб, листы, балки
			const x = 2, z = 73;
			batch.add(place(new THREE.CylinderGeometry(0.8, 4.2, 2.0, 10).scale(1.3, 1, 0.9), x, 1.0, z), M.metalRust);
			for (let i = 0; i < 26; i++) {
				const a = rnd() * 6.28, d = rnd() * 3.6, g = i % 3 ? box(R(0.6, 2.6), R(0.06, 0.3), R(0.3, 1.2)) : cyl(0.15, 0.15, R(1.5, 3.5), 8);
				batch.add(place(g, x + Math.cos(a) * d * 1.3, 2.1 - d * 0.42, z + Math.sin(a) * d * 0.9, R(0, 3), R(-0.6, 0.6), R(-0.6, 0.6)), i % 4 ? M.metalRust : M.metalDark);
			}
			collide(x, z, 10, 6.6);
		}

		// ---------- Забор порта с проходной и шлагбаумом; проломы ----------
		const wires = [];
		const fence = (z0, z1) => { concreteFence(batch, M, collide, root, FX, z0, FX, z1, { wire: false }); wires.push([z0, z1]); };
		fence(-90, -64); fence(-60, -4.6); fence(13.6, 56); fence(60, 90);
		{
			const pts = [], y = 2.75;
			for (const [z0, z1] of wires) {
				const n = Math.ceil(Math.abs(z1 - z0) * 2);
				for (const dy of [0, 0.2]) for (let k = 0; k < n; k++) for (const q of [k, k + 1]) pts.push(V(FX, y + dy + Math.sin(q * 2.1) * 0.05, z0 + ((z1 - z0) * q) / n));
			}
			root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a3a38 })));
		}
		for (const [z, s] of [[-62, 1], [58, -1]]) { // проломы: плиты повалены, по ним ходят
			batch.add(place(box(2.2, 0.16, 3.9, 1.2, 1.2), FX + 1.4 * s, 0.12, z, 0.3 * s), M.concrete);
			batch.add(place(box(2.2, 0.16, 3.9, 1.2, 1.2), FX - 1.3 * s, 0.24, z + 0.4, -0.25 * s, 0, 0.12), M.concrete);
		}
		buildings.push(buildCheckpoint(bctx, { name: 'Prohodnaya', cx: FX, cz: -1.5, ry: Z }));
		batch.add(place(box(0.7, 3.2, 0.7), FX, 1.6, 13.6), M.concreteDark); collide(FX, 13.6, 0.8, 0.8);
		barrier(batch, M, collide, FX + 2.2, 12.8, Z, 8, true);
		billboard(batch, M, root, collide, -48, -5.2, 0, 'РЕЧНОЙ ПОРТ · ВХОД ПО ПРОПУСКАМ', { w: 6.4, h: 1.0, y: 2.3, bg: '#1d3f7a', fg: '#f0f0e8' });
		// перед воротами — бетонные блоки змейкой, разбитая машина, мешки с мусором
		for (const [x, z, r] of [[-47.5, 5.4, 0.1], [-44.6, 10.7, -0.15], [-51.5, 10.4, 0.3], [-53.4, 2.2, -0.4]]) {
			beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp();
			collide(x, z, 1.8, 0.9, r);
		}
		addCar(batch, M, root, -56.5, 0.6, 0.7, 0x7a2a22, { crashed: true }); collide(-56.5, 0.6, 4.3, 1.8, 0.7);
		for (const [x, z] of [[-41.6, -6.2], [-43, -6.6], [-58.6, 14]]) { beginProp('trash', x, z, x); batch.add(place(new THREE.SphereGeometry(0.35, 8, 6).scale(1, 0.6, 1), x, 0.18, z), M.tire); endProp(); }

		// ---------- За забором: контора порта, якорь-памятник, стоянка, гаражи, улица ----------
		buildings.push(buildOffice(bctx, { name: 'PortOffice', cx: -50, cz: -22, ry: Z }));
		anchorMonument(batch, M, collide, -51, 20.5);
		for (const [x, z, ry] of [[-54.6, 18.5, Z], [-47.4, 18.5, -Z]]) bench(batch, M, x, z, ry);
		const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
		car(-55, 29.5, Z + 0.05, 0x8a8a7a); car(-51.8, 29.6, Z - 0.04, 0x3a5a6a); car(-45.4, 29.4, Z, 0x7a2a22, { crashed: true });
		car(-54.8, 42.4, -Z + 0.06, 0x8a8a7a, { model: 'e_niva' }); car(-48.4, 42.6, -Z, 0x2a3a5a); car(-45, 42.2, -Z - 0.3, 0x5a5a3a, { burned: true });
		car(-61.6, -36, Z + 0.03, 0xc8b84a); car(-66.4, 52, -Z + 0.1, 0x3a5a6a, { crashed: true }); car(-61.8, 66, Z, 0x7a2a22);
		bus(batch, M, root, -66.6, 27, 0.03); collide(-66.6, 27, 2.6, 7.8, 0.03);
		{
			// остановка у улицы, ларёк
			const x = -70.6, z = 21.5;
			batch.add(place(box(0.15, 2.4, 5, 1), x - 0.9, 1.2, z), M.concrete);
			batch.add(place(box(2.2, 0.15, 5.4, 1), x, 2.45, z), M.metalRust);
			for (const dz of [-2.4, 2.4]) batch.add(place(box(0.12, 2.4, 0.12), x + 0.9, 1.2, z + dz), M.metalDark);
			collide(x - 0.9, z, 0.4, 5);
			bench(batch, M, x - 0.3, z, -Z);
			batch.add(place(box(2.6, 2.5, 2.2, 1.2), -71.5, 1.25, -4), M.woodBlue);
			batch.add(place(box(2.9, 0.1, 2.5, 2), -71.5, 2.55, -4), M.metalRust);
			batch.add(place(box(0.06, 0.8, 1.6), -70.17, 1.55, -4), M.glass);
			collide(-71.5, -4, 2.7, 2.3);
		}
		{
			// гаражи кооператива: ряд кирпичных боксов, ворота на юг
			const x0 = -59.5, z = -58.6, n = 5;
			for (let i = 0; i < n; i++) {
				const x = x0 + i * 3.5 + 1.75;
				batch.add(place(box(3.4, 2.5, 6, 1.5), x, 1.25, z), M.whiteBrick);
				batch.add(place(box(2.6, 2.1, 0.06), x, 1.05, z + 3.02), [M.metalRust, M.metalOlive, M.woodBlue][i % 3]);
				batch.add(place(box(3.6, 0.12, 6.4, 2), x, 2.56, z + 0.1, 0, -0.04), M.roofTar);
			}
			collide(x0 + n * 1.75, z, n * 3.5, 6);
		}
		{
			// лодка на кильблоках во дворе за гаражами
			const F = frame(-49, 0.7, 64, 0.4);
			batch.add(hullGeo(hullShape(6, 2.2, 1.6, 0.6), 0.9).applyMatrix4(F), M.woodGreen);
			for (const dz of [-1.6, 1.6]) batch.add(place(box(1.6, 0.7, 0.4), -49 + Math.sin(0.4) * dz, 0.35, 64 + Math.cos(0.4) * dz, 0.4), M.sleeper);
			collide(-49, 64, 2.4, 6.2, 0.4);
		}
		for (const [x, z] of [[-59.2, -76], [-59.2, -46], [-59.2, -12], [-59.2, 24], [-59.2, 56], [-68.8, 2], [-68.8, 40], [-68.8, -40]]) streetLamp(batch, M, collide, x, z);

		const exits = [
			{ to: 'tyurma', x0: SX - 3, x1: SX + 3, z0: -90, z1: -85.2, spawn: [SX, -82.5, 0], sign: [SX + 5, -84, '↑ Тюрьма'] },
			{ to: 'bolnica', x0: -90, x1: -85.2, z0: RZ - 3, z1: RZ + 3, spawn: [-82.5, RZ, Z], sign: [-84, RZ + 5.6, '← Больница'] },
			{ to: 'zarechny', x0: SX - 3, x1: SX + 3, z0: 85.2, z1: 90, spawn: [SX, 82.5, Math.PI], sign: [SX + 5, 84, '↓ Заречный'] },
		];
		return {
			start: [SX, 82.5, Math.PI],
			exits,
			// топтуны водят стаи в контейнерном дворе и пакгаузах, рубер — в пакгаузе № 1; бегуны — на причале, на путях,
			// у мастерских, за забором на улице и у конторы
			groups: [
				{ at: [-25, -76], r: 4, stompers: 1, runners: 2 },
				{ at: [-3, -69.8], r: 4, runners: 3 },
				{ at: [-14, -60], r: 5, stompers: 1, runners: 2 },
				{ at: [-26, -43], r: 5, runners: 2 },
				{ at: [-1, -43], r: 5, stompers: 1, runners: 1 },
				{ at: [-31, -21], r: 4, runners: 2 },
				{ at: [-14, -24], r: 4, stompers: 1, runners: 2 },
				{ at: [2, -15.5], r: 4, runners: 3 },
				{ at: [-25, 26], r: 4, stompers: 1, runners: 2 },
				{ at: [-4, 41.6], r: 4, runners: 2 },
				{ at: [-20, 53], r: 5, runners: 2 },
				{ at: [24, -53], r: 4, rubers: 1, runners: 2 },
				{ at: [23, 41], r: 4, stompers: 1, runners: 2 },
				{ at: [47, -72], r: 5, runners: 3 },
				{ at: [47, -38], r: 4, runners: 2 },
				{ at: [47, -10], r: 4, stompers: 1, runners: 2 },
				{ at: [47, 20], r: 5, runners: 2 },
				{ at: [47, 56], r: 5, runners: 3 },
				{ at: [26, -22], r: 5, runners: 2 },
				{ at: [26, 6], r: 5, runners: 2 },
				{ at: [28, 61], r: 4, runners: 2 },
				{ at: [-14, 61], r: 4, runners: 2 },
				{ at: [-14, 71], r: 3, stompers: 1, runners: 1 },
				{ at: [-50, -22], r: 4, runners: 2 },
				{ at: [SX, -54], r: 5, runners: 2 },
				{ at: [SX, 40], r: 5, runners: 2 },
				{ at: [-48, 8], r: 5, runners: 2 },
				{ at: [-50, 36], r: 5, runners: 2 },
				{ at: [-78, RZ], r: 5, runners: 2 },
				{ at: [12, -84], r: 4, runners: 2 },
			],
			onRoad,
			// горят бочка у бытовки, сгоревшая машина на причале, костёр у гаражей
			fires: [[29.5, -14.2], [45.8, 70, 'car'], [-52, -49.5, 'ground']],
			barrels: 7,
			trees(tryTree) {
				// деревья только за забором: вдоль улицы, у конторы, у гаражей и на пустыре на юге
				for (let i = 0; i < 40; i++) tryTree(R(-86, -70), R(-86, 86), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(-59, -42), R(-86, -64), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 16; i++) tryTree(R(-59, -42), R(48, 86), rnd() < 0.7 ? 'birch' : 'apple');
				for (const z of [-44, -36, 52, 60, 70, 78]) tryTree(-58.4 + R(-0.4, 0.4), z, 'birch');
			},
			beltDensity: 0.35,
			clutter: 14,
			blood: 16,
			puddles: 16,
			puddle: () => (rnd() < 0.8 ? [R(-38, 56), R(-84, 84)] : [R(-86, -42), R(-84, 84)]),
			grass: 1,
			hint: (b) => ({
				Pakgauz1: 'Пакгауз № 1 — стеллажи с ящиками, конторка кладовщика с сейфом',
				Pakgauz2: 'Пакгауз № 2 — стеллажи, ящики с грузом, стол кладовщика',
				PortOffice: 'Контора порта — диспетчерская, касса с сейфом, кабинет начальника, оружейный шкаф охраны',
				Prohodnaya: 'Проходная порта — стол дежурного и шкаф',
				Bytovka: 'Бытовка докеров — шкафчики и аптечка',
				Masterskie: 'Ремонтные мастерские порта — верстак, шкафчики слесарей, сейф мастера',
			}[b.name] ?? (/^Cont/.test(b.name) ? 'Открытый контейнер — в глубине ящики с грузом' : undefined)),
		};
	},
};
