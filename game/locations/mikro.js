// Кластер «Микрорайон»: спальный район на краю города, который Улей забрал вместе с проспектом и перекрёстком.
// Четыре панельные девятиэтажки: внутрь заходят только на первый этаж (одно здание на весь след дома — магазин
// «Продукты», хозтовары, аптека, почта, ателье, участковый пункт, подъезды с почтовыми ящиками и лестницей);
// этажи 2–9 — фасад с окнами и балконами (occluder: становится прозрачным, когда загораживает героя). Между домами —
// дворы с детскими площадками, лавками и мусорными площадками; двухэтажная школа с классами на первом этаже и
// спортплощадкой; два ряда кирпичных гаражей (внутрь заходят — верстаки, стеллажи, в двух гаражах оружейные тайники);
// гаражи-ракушки, трансформаторная будка, брошенные машины и горящий автобус на перекрёстке.
// Выходы: на юг по проспекту (Заречный), на север (Военная часть), на запад по улице (Подстанция), на северо-запад
// по проезду (Аэродром). Опасность 3 — логово руберов: во дворах, у школы и гаражей; топтуны и много бегунов.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair } from '../buildings.js';
import { hash01, balcony, boxTop } from '../facade.js';
import { bench, swings, slide, streetLamp, addCar, bus, markingMaterial, transformer } from '../props.js';

// ---------- Мебель-тайники (лицо мебели — в +Z её осей) ----------

const shelf = (b, x, z, rot, loot, goods = 'food') => b.container('Стеллаж', x, z, rot, [
	[2.4, 1.9, 0.5, 0, 0.95, 0, b.IM.furnitureLight],
	...[0.45, 0.95, 1.45].map((y) => [2.3, 0.04, 0.48, 0, y, 0.02, b.IM.furniture]),
	...(goods === 'food' ? [[2.0, 0.22, 0.3, 0, 0.58, 0.05, b.IM.cans], [1.6, 0.25, 0.3, -0.2, 1.08, 0.05, b.IM.jars], [1.8, 0.22, 0.3, 0.15, 1.58, 0.05, b.IM.cans]]
		: goods === 'pharm' ? [[2.0, 0.2, 0.3, 0, 0.57, 0.05, b.IM.white], [1.7, 0.22, 0.3, 0.1, 1.07, 0.05, b.IM.white], [1.5, 0.2, 0.3, -0.2, 1.57, 0.05, b.IM.jars]]
		: [[1.9, 0.26, 0.32, 0, 0.6, 0.05, b.IM.metal], [1.4, 0.3, 0.3, 0.3, 1.12, 0.05, b.IM.crate], [2.0, 0.2, 0.3, -0.1, 1.57, 0.05, b.IM.black]]),
], [2.4, 0.5], loot, 1.9);

const counter = (b, name, x, z, rot, w, loot, top = null) => b.container(name, x, z, rot, [
	[w, 1.0, 0.7, 0, 0.5, 0, top ?? b.IM.furniture],
	[w + 0.1, 0.05, 0.8, 0, 1.02, 0, top ? b.IM.glass : b.IM.furnitureLight],
	[0.45, 0.25, 0.35, w / 2 - 0.8, 1.17, 0, b.IM.black], // касса
], [w, 0.7], loot, 1.25);

const safe = (b, x, z, rot, loot) => b.container('Сейф', x, z, rot, [
	[0.7, 1.1, 0.6, 0, 0.55, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, b.IM.black],
], [0.7, 0.6], loot, 1.1);

const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat],
	[0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
	[0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);

const locker = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.85, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, 0.2, 1.7, 0.26, b.IM.black],
], [0.85, 0.5], loot, 1.9);

/** Почтовые ящики на стене подъезда: блок 5×3 дверец. */
const mailboxes = (b, x, z, rot, loot) => b.container('Почтовые ящики', x, z, rot, [
	[1.5, 1.0, 0.24, 0, 1.3, 0, b.IM.metal],
	...[0, 1, 2, 3, 4].flatMap((i) => [0, 1, 2].map((j) => [0.26, 0.02, 0.02, -0.6 + i * 0.3, 0.85 + j * 0.33, 0.125, b.IM.black])),
], [1.5, 0.3], loot, 1.85);

/** Верстак с тисками (гаражи, хозтовары). */
const workbench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.85, 0.8, 0, 0.42, 0, b.IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, b.IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, b.IM.machine],
], [2.0, 0.8], loot, 1.0);

// ---------- Комнаты первого этажа (в осях здания: юг — +Z, там входы и витрины; r — { cx, x0, x1 }) ----------

/** Витрина магазина: стекло на южной стене (к камере), ниже — сплошной низ стены. */
function shopWindow(b, at, w, hz, t) {
	const win = new THREE.PlaneGeometry(w, 1.5);
	win.translate(at, 1.6, hz + t / 2 + 0.02);
	b.top_(win, b.ctx.M.glass);
}

/** Вывеска над витриной. */
function shopSign(b, mat, at, w, hz, t) {
	const g = new THREE.PlaneGeometry(w, w / 5.33);
	g.translate(at, 2.72, hz + t / 2 + 0.03);
	b.top_(g, mat);
}

const ROOMS = {
	// магазин «Продукты»: стеллажи у задней стены, прилавок с кассой у восточной, холодильная витрина, сейф
	shop: {
		door: -4.5,
		fill(b, r, { M, IM, hz, t }) {
			const c = r.cx;
			shopWindow(b, c + 1.8, 7.4, hz, t);
			shopSign(b, M.shopSign, c + 1.8, 4.6, hz, t);
			b.canopy('back', c - 4.5, { w: 2.3, d: 1.0, y: 2.5, mat: M.concrete, t });
			shelf(b, c - 4.0, -hz + 0.45, 0, { zhivchik: 0.3, spore: 0.25 });
			shelf(b, c - 1.2, -hz + 0.45, 0, { ammo919: [3, 6, 0.3], zhivchik: 0.25 });
			shelf(b, c + 1.6, -hz + 0.45, 0, { zhivchik: 0.35, spore: 0.2 });
			counter(b, 'Прилавок', c + 6.2, 0, -Math.PI / 2, 3.6, { ammo919: [4, 8, 0.5], zhivchik: 0.3 });
			safe(b, c + 6.1, 4.6, -Math.PI / 2, { ammo919: [8, 12, 0.7], ammo545: [10, 20, 0.35], ammo50: [3, 7, 0.2] });
			// холодильная витрина (пустая) и ящики у входа
			b.furniture(c - 6.4, -2.0, Math.PI / 2, [[2.0, 1.1, 0.8, 0, 0.55, 0, IM.white], [1.9, 0.3, 0.7, 0, 1.25, 0, IM.jars]], { solid: [2.0, 0.8] });
			b.furniture(c - 6.1, 4.3, 0.2, [[0.8, 0.6, 0.6, 0, 0.3, 0, IM.crate], [0.8, 0.6, 0.6, 0.05, 0.9, 0, IM.crate]], { solid: [0.8, 0.6], prop: 'crate' });
		},
	},
	// хозтовары: инструмент, краска, верстак в подсобке
	tools: {
		door: -5.2,
		fill(b, r, { M, IM, hz, t }) {
			const c = r.cx;
			shopWindow(b, c + 1.6, 8.0, hz, t);
			shopSign(b, T.signMaterial('ХОЗТОВАРЫ', { bg: '#d8d4c4', fg: '#2a4a8a' }), c + 1.6, 4.8, hz, t);
			b.canopy('back', c - 5.2, { w: 2.3, d: 1.0, y: 2.5, mat: M.concrete, t });
			shelf(b, c - 4.5, -hz + 0.45, 0, { ammo12: [3, 6, 0.4], fireaxe: 0.08 }, 'tools');
			shelf(b, c - 1.0, -hz + 0.45, 0, { ammo919: [4, 8, 0.3], grenade: 0.04 }, 'tools');
			counter(b, 'Прилавок', c + 6.6, -0.5, -Math.PI / 2, 3.6, { ammo12: [4, 8, 0.45], spore: 0.25 });
			workbench(b, 'Верстак', c + 2.8, -hz + 0.5, 0, { ammo762: [5, 10, 0.35], fireaxe: 0.1, grenade: 0.05 });
			// банки с краской и бочка у западной стены
			b.furniture(c - 6.8, 2.0, Math.PI / 2, [[1.6, 0.9, 0.5, 0, 0.45, 0, IM.metal], [1.4, 0.3, 0.3, 0, 1.05, 0.05, IM.cans]], { solid: [1.6, 0.5] });
			b.furniture(c - 6.5, 4.6, 0, [[0.6, 0.9, 0.6, 0, 0.45, 0, IM.metal]], { solid: [0.6, 0.6], prop: 'barrel' });
		},
	},
	// подъезд: лестница на верхние этажи (туда не попасть), лифт, почтовые ящики, шкафчик дворника
	hall: {
		door: 0,
		fill(b, r, { M, IM, hz, t }) {
			const c = r.cx;
			b.window('back', c - 2.1, { t, sill: M.concrete }); b.window('back', c + 2.1, { t, sill: M.concrete });
			b.canopy('back', c, { w: 2.6, d: 1.3, y: 2.55, mat: M.concrete, t });
			// железная дверь подъезда распахнута к стене
			b.furniture(c + 0.75, hz - 0.1, -1.7, [[1.4, 2.05, 0.05, 0.7, 1.03, 0, M.metalRust]], { up: true });
			// лестница: восемь ступеней к северной стене, под верхним маршем темно
			const steps = [];
			for (let i = 0; i < 8; i++) steps.push([1.6, 0.4 * (i + 1), 0.7, 0, 0.2 * (i + 1), 0.9 - 0.7 * i, i < 5 ? M.concrete : IM.black]);
			b.furniture(c + 1.5, -1.5, 0, steps, { solid: [1.7, 5.8] });
			b.furniture(c - 1.4, -hz + 0.12, 0, [[1.0, 2.1, 0.06, 0, 1.05, 0, IM.metal], [0.02, 2.0, 0.07, 0, 1.05, 0.01, IM.black]], { solid: [0, 0] }); // двери лифта
			mailboxes(b, c - 2.85, 1.5, Math.PI / 2, { ammo919: [3, 6, 0.4], zhivchik: 0.2, spore: 0.3 });
			b.furniture(c - 2.6, -3.6, Math.PI / 2, [[1.2, 0.05, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.45, 0.4, -0.5, 0.22, 0, IM.metal], [0.06, 0.45, 0.4, 0.5, 0.22, 0, IM.metal]], { solid: [1.2, 0.4] }); // скамья
		},
	},
	// аптека: витрина-прилавок со стеклом, стеллажи с лекарствами, сейф
	pharm: {
		door: 3.0,
		fill(b, r, { M, IM, hz, t }) {
			const c = r.cx;
			shopWindow(b, c - 1.8, 5.2, hz, t);
			shopSign(b, T.signMaterial('АПТЕКА', { bg: '#e6efe4', fg: '#1d7a3a' }), c - 1.8, 4.0, hz, t);
			b.canopy('back', c + 3.0, { w: 2.3, d: 1.0, y: 2.5, mat: M.concrete, t });
			counter(b, 'Витрина', c - 0.6, 0.6, 0, 4.4, { zhivchik: [1, 2, 0.6], spore: 0.2 }, IM.white);
			shelf(b, c - 3.2, -hz + 0.45, 0, { zhivchik: 0.5 }, 'pharm');
			shelf(b, c - 0.4, -hz + 0.45, 0, { zhivchik: 0.4, ammo919: [2, 4, 0.2] }, 'pharm');
			shelf(b, c + 2.4, -hz + 0.45, 0, { zhivchik: 0.45, spore: 0.2 }, 'pharm');
			safe(b, c + 4.6, -3.0, -Math.PI / 2, { ammo919: [6, 10, 0.6], zhivchik: [1, 3, 0.6], ammo50: [3, 6, 0.2] });
			b.furniture(c + 4.6, 1.8, -Math.PI / 2, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white]], { solid: [0.62, 0.6], prop: 'fridge' });
		},
	},
	// почта: стойка, посылки за ней, шкаф и сейф в углу; стол для писем в зале
	post: {
		door: 4.0,
		fill(b, r, { M, IM, hz, t }) {
			const c = r.cx;
			shopWindow(b, c - 1.4, 6.4, hz, t);
			shopSign(b, T.signMaterial('ПОЧТА', { bg: '#1e3a7a', fg: '#e8e8f0' }), c - 1.4, 3.6, hz, t);
			b.canopy('back', c + 4.0, { w: 2.3, d: 1.0, y: 2.5, mat: M.concrete, t });
			counter(b, 'Стойка', c - 2.4, 0.6, 0, 6.0, { ammo919: [4, 8, 0.45], spore: 0.3 });
			b.container('Посылки', c - 4.6, -3.8, 0, [[1.2, 0.5, 0.8, 0, 0.25, 0, IM.crate], [0.9, 0.45, 0.6, 0.1, 0.72, 0.05, IM.crate], [0.6, 0.4, 0.5, -0.2, 1.15, -0.05, IM.crate]], [1.2, 0.8], { ammo919: [5, 10, 0.5], ammo12: [3, 6, 0.3], zhivchik: 0.25, spore: 0.2 }, 1.35);
			cabinet(b, 'Шкаф', c + 0.4, -hz + 0.4, 0, 1.1, 2.0, 0.55, { ammo919: [4, 8, 0.4], spore: 0.3 });
			safe(b, c + 5.8, -4.2, -Math.PI / 2, { ammo545: [10, 20, 0.45], ammo50: [4, 8, 0.25], spore: [2, 4, 0.5] });
			table(b, c + 2.2, 3.4, 0, { w: 1.4, d: 0.7 });
			chair(b, c + 2.2, 4.2, 0);
		},
	},
	// ателье: швейные столы, манекен, шкаф с тканями
	atelier: {
		door: 2.6,
		fill(b, r, { M, IM, hz, t }) {
			const c = r.cx;
			shopWindow(b, c - 1.6, 3.6, hz, t);
			shopSign(b, T.signMaterial('АТЕЛЬЕ', { bg: '#e8dcd0', fg: '#7a2a4a' }), c - 1.6, 3.0, hz, t);
			b.canopy('back', c + 2.6, { w: 2.3, d: 1.0, y: 2.5, mat: M.concrete, t });
			table(b, c - 2.2, -1.5, 0, { w: 1.2, d: 0.7 });
			table(b, c - 2.2, -4.2, 0, { w: 1.2, d: 0.7 });
			chair(b, c - 2.2, -0.6, 0);
			b.furniture(c + 2.6, -2.5, 0, [[0.4, 0.05, 0.4, 0, 0.05, 0, IM.metal], [0.05, 1.0, 0.05, 0, 0.55, 0, IM.metal], [0.42, 0.7, 0.26, 0, 1.4, 0, IM.rag]], { solid: [0.5, 0.5] }); // манекен
			cabinet(b, 'Шкаф', c + 0.6, -hz + 0.4, 0, 1.3, 2.0, 0.55, { ammo919: [3, 6, 0.4], zhivchik: 0.25, spore: 0.2 });
			counter(b, 'Касса', c + 2.6, 2.4, 0, 1.6, { ammo919: [3, 6, 0.35], spore: 0.25 });
		},
	},
	// участковый пункт: стол дежурного, оружейный шкаф с ружьями, сейф, стенд «Их разыскивает милиция»
	police: {
		door: 3.6,
		fill(b, r, { M, IM, hz, t }) {
			const c = r.cx;
			b.window('back', c - 3.4, { t, sill: M.concrete }); b.window('back', c - 0.6, { t, sill: M.concrete });
			for (const at of [-3.4, -0.6]) for (let k = -0.45; k <= 0.46; k += 0.18) b.top_(place(box(0.04, 1.4, 0.04), c + at + k, 1.65, hz + t / 2 + 0.05), M.metalRust); // решётки
			shopSign(b, T.signMaterial('УЧАСТКОВЫЙ ПУНКТ', { bg: '#2a3a5a', fg: '#e8e4d8' }), c - 2.0, 4.8, hz, t);
			b.canopy('back', c + 3.6, { w: 2.3, d: 1.0, y: 2.5, mat: M.concrete, t });
			b.container('Стол дежурного', c - 1.0, -0.8, 0, [[1.3, 0.75, 0.7, 0, 0.375, 0, IM.furniture], [0.4, 0.3, 0.3, 0.3, 0.9, 0, IM.black]], [1.3, 0.7], { ammo919: [6, 12, 0.6], zhivchik: 0.3, ammo12: [4, 8, 0.4] }, 0.95);
			chair(b, c - 1.0, -1.8, 0);
			b.container('Оружейный шкаф', c + 5.6, -2.0, -Math.PI / 2, [[1.0, 1.8, 0.45, 0, 0.9, 0, IM.metal], [0.02, 1.7, 0.02, 0, 0.9, 0.23, IM.black], [0.05, 0.05, 0.04, 0.1, 1.0, 0.24, IM.black]], [1.0, 0.45], { ammo12: [6, 12, 0.8], dbarrel: 0.2, spas12: 0.06, ammo919: [6, 12, 0.5] }, 1.8);
			safe(b, c + 5.6, 1.0, -Math.PI / 2, { ammo545: [10, 25, 0.5], glock17: 0.15, spore: [2, 4, 0.4] });
			b.furniture(c - 4.0, -hz + 0.1, 0, [[2.2, 1.2, 0.05, 0, 1.6, 0, IM.redBoard], [1.9, 0.9, 0.02, 0, 1.6, 0.03, IM.paper]], { solid: [0, 0] }); // стенд
			b.furniture(c - 5.2, 2.6, Math.PI / 2, [[1.9, 0.35, 0.8, 0, 0.35, 0, IM.furniture], [1.8, 0.1, 0.75, 0, 0.56, 0, IM.blanketArmy]], { solid: [1.9, 0.8] }); // топчан
		},
	},
};

/**
 * Первый этаж девятиэтажки — одно здание на весь след дома (туда заходят): комнаты через перегородки, у каждой свой вход с
 * южной стороны (к камере) — магазин, аптека, почта, подъезды. rooms — слева направо { kind, w }, сумма w = W.
 */
function floor1(bctx, { name, cx, cz, W, D, rooms }) {
	const H = 3.2, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	let x = -hx;
	const list = rooms.map((r) => { const out = { ...r, x0: x, x1: x + r.w, cx: x + r.w / 2 }; x += r.w; return out; });
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	// наружные стены — бетон первого этажа; входы — в южной стене
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.concrete, t, doors: list.map((r) => r.cx + ROOMS[r.kind].door), w: 1.5, lining: IM.shopWall, side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.concrete, t, lining: IM.shopWall, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.concrete, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.concrete, t, lining: IM.shopWall, side: -1 });
	for (const r of list.slice(1)) b.wall('z', r.x0, -hz + t / 2, hz - t / 2, { mat: IM.shopWall, t: 0.15 });
	// крыльцо у каждого входа
	for (const r of list) b.lower(place(box(2.2, 0.18, 1.0, 1), r.cx + ROOMS[r.kind].door, 0.09, hz + 0.6), M.concrete);
	for (const r of list) ROOMS[r.kind].fill(b, r, { M, IM, hz, t });
	return b.finish();
}

/**
 * Верхние этажи девятиэтажки (2–9) над первым: межэтажный пояс, панельная коробка (окна — в текстуре панели), на южном
 * фасаде (его видит камера) окна из атласа и балконы стояками, плоская крыша с парапетом, выходами на крышу над
 * подъездами, вентшахтами и машинным отделением лифта. Вид окон и балконов — от hash01 (генератор локации не трогаем).
 * Материалов шесть (панель, бетон, рубероид, окна, ржавый металл, кирпич) — шесть вызовов отрисовки на дом.
 */
function tower(occluder, M, name, { cx, cz, W, D, y0 = 3.45, floors = 8, halls = [], balc = [] }) {
	const fh = 2.8, Hb = floors * fh, top = y0 + Hb, zs = cz + D / 2, cols = Math.round(W / 3.2);
	occluder(name, (kb) => {
		kb.add(place(box(W + 0.3, 0.35, D + 0.3, 2), cx, y0 - 0.17, cz), M.concrete); // пояс над первым этажом
		kb.add(place(box(W, Hb, D, 3.2, 2.8), cx, y0 + Hb / 2, cz), M.panel);
		// окна южного фасада: целые, выбитые, заклеенные, с занавесками
		for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
			const h = hash01(name, 'w', f, c), x = cx - W / 2 + 1.6 + c * 3.2, y = y0 + f * fh + 1.38;
			const k = h < (f < 2 ? 0.3 : 0.1) ? 5 : h < 0.3 ? 6 : h < 0.55 ? 7 : 4;
			kb.add(T.windowUV(new THREE.PlaneGeometry(1.62, 1.44), k).translate(x, y, zs + 0.02), M.window);
		}
		// балконы стояками: часть застеклена, часть обвалилась; ограждение — ржавый металл
		for (let f = 0; f < floors; f++) for (const c of balc) {
			const h = hash01(name, 'b', c, f);
			if (h > 0.9) continue;
			balcony(kb, M, cx - W / 2 + 1.6 + c * 3.2, y0 + f * fh, zs, 1, M.metalRust, h < 0.3 ? h : 0.8, { top: f === floors - 1 });
		}
		// крыша
		kb.add(planeXZ(W, D, 4).translate(cx, top + 0.04, cz), M.roofTar);
		for (const s of [-1, 1]) {
			kb.add(boxTop(W + 0.4, 0.55, 0.25, 2).translate(cx, top + 0.275, cz + s * (D / 2 + 0.075)), M.concrete);
			kb.add(boxTop(0.25, 0.55, D - 0.1, 2).translate(cx + s * (W / 2 + 0.075), top + 0.275, cz), M.concrete);
		}
		for (const ex of halls) {
			const x = cx + ex, z = cz - D / 2 + 1.8;
			kb.add(boxTop(2.4, 2.2, 2.0, 2).translate(x, top + 1.1, z), M.brick); // выход на крышу
			kb.add(boxTop(2.7, 0.12, 2.3, 2).translate(x, top + 2.26, z), M.roofTar);
			kb.add(boxTop(0.9, 1.8, 0.06, 1).translate(x + 0.45, top + 0.9, z + 1.02), M.metalRust);
			const mx = x + (ex > 0 ? -4.2 : 4.2); // машинное отделение лифта — к середине дома
			kb.add(boxTop(3.2, 2.6, 2.6, 2).translate(mx, top + 1.3, cz + 1.0), M.brick);
			kb.add(boxTop(3.5, 0.12, 2.9, 2).translate(mx, top + 2.66, cz + 1.0), M.roofTar);
		}
		for (let i = 0; i < cols; i += 2) {
			const x = cx - W / 2 + 1.6 + i * 3.2, z = cz + (i % 4 ? 2.2 : -2.6);
			kb.add(boxTop(1.0, 0.85, 0.55, 1).translate(x, top + 0.425, z), M.brick); // вентшахты
			kb.add(boxTop(1.16, 0.08, 0.7, 1).translate(x, top + 0.92, z), M.concrete);
		}
		for (const [ex, ez] of [[-W / 2 + 5, 3.5], [W / 2 - 7, 2.8]]) { // антенны
			kb.add(boxTop(0.06, 2.6, 0.06, 1).translate(cx + ex, top + 1.3, cz + ez), M.metalRust);
			kb.add(boxTop(1.3, 0.04, 0.04, 1).translate(cx + ex, top + 2.3, cz + ez), M.metalRust);
		}
	}, { cx, cz, ry: 0, hx: W / 2 + 0.6, hz: D / 2 + 1.2, top: top + 3.2 }, 0.16);
}

/**
 * Школа: первый этаж (туда заходят) — вестибюль с гардеробом и буфетом вдоль южной стены, три класса с партами,
 * доской и учительским столом; второй этаж — фасад (occluder). Вход — с юга, двойная дверь под козырьком на столбах.
 */
function buildSchool(bctx, occluder, { cx, cz }) {
	const W = 30, D = 13, H = 3.4, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'School', cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'home';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [0], w: 2.2, lining: IM.shopWall, side: -1 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	// коридор вдоль южной стены (z 2.4…6.5), классы за перегородкой с дверями
	b.wall('x', 2.4, -hx + t / 2, hx - t / 2, { mat: IM.shopWall, t: 0.15, doors: [-10, 0, 10] });
	b.wall('z', -5, -hz + t / 2, 2.4 - 0.075, { mat: IM.shopWall, t: 0.15 });
	b.wall('z', 5, -hz + t / 2, 2.4 - 0.075, { mat: IM.shopWall, t: 0.15 });
	for (const x of [-13.2, -10.2, -7.2, -4.2, 4.2, 7.2, 10.2, 13.2]) b.window('back', x, { t, sill: M.whiteBrick });
	for (const x of [-12, -8, -2, 2, 8, 12]) b.window('front', x, { t, sill: M.whiteBrick });
	// крыльцо, козырёк на столбах, двери распахнуты, вывеска
	b.lower(place(box(4.6, 0.3, 2.4, 1), 0, 0.15, hz + 1.2), M.concrete);
	b.lower(place(box(5.2, 0.12, 0.9, 1), 0, 0.06, hz + 2.8), M.concrete);
	b.canopy('back', 0, { w: 4.4, d: 2.2, y: 2.9, mat: M.concrete, posts: M.concrete, t, thick: 0.2 });
	for (const s of [-1, 1]) b.furniture(s * 1.1, hz - 0.1, s * 1.75, [[1.05, 2.05, 0.05, s * -0.52, 1.03, 0, M.woodGrey]], { up: true });
	// коридор: гардероб (вешалки с куртками) слева, буфет справа, скамьи
	b.container('Гардероб', -12.8, 4.4, Math.PI / 2, [
		[0.08, 1.7, 0.08, -1.2, 0.85, -0.2, IM.metal], [0.08, 1.7, 0.08, 1.2, 0.85, -0.2, IM.metal], [2.6, 0.05, 0.05, 0, 1.65, -0.2, IM.metal],
		...[-0.9, -0.4, 0.2, 0.7].map((x) => [0.4, 0.7, 0.25, x, 1.25, -0.18, IM.rag]),
	], [2.6, 0.5], { ammo919: [3, 6, 0.4], zhivchik: 0.3, spore: 0.25 }, 1.7);
	counter(b, 'Буфет', 11.8, 4.2, 0, 3.6, { zhivchik: 0.45, spore: 0.3, ammo919: [2, 5, 0.25] }, IM.white);
	for (const x of [-6, 6]) b.furniture(x, hz - 0.5, 0, [[2.2, 0.05, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.45, 0.4, -0.95, 0.22, 0, IM.metal], [0.06, 0.45, 0.4, 0.95, 0.22, 0, IM.metal]], { solid: [2.2, 0.4] });
	// классы: доска у северной стены, учительский стол, парты в два ряда
	const cls = (rc, loot, lab) => {
		b.furniture(rc + 1.0, -hz + 0.12, 0, [[3.2, 1.2, 0.06, 0, 1.6, 0, IM.screen], [3.4, 0.08, 0.1, 0, 0.98, 0.02, IM.furnitureLight]], { solid: [0, 0] }); // доска
		b.container('Учительский стол', rc - 2.8, -hz + 0.9, 0, [[1.3, 0.05, 0.7, 0, 0.75, 0, IM.furniture], [0.5, 0.7, 0.65, 0.35, 0.36, 0, IM.furniture], [0.06, 0.7, 0.06, -0.6, 0.36, 0.3, IM.furniture], [0.06, 0.7, 0.06, -0.6, 0.36, -0.3, IM.furniture], [0.3, 0.04, 0.22, -0.2, 0.8, 0, IM.books[0]]], [1.3, 0.7], loot, 0.95);
		for (const dx of [-1.9, 1.9]) for (const dz of [-3.0, -1.4, 0.2]) table(b, rc + dx, dz, 0, { w: 1.2, d: 0.6 });
		if (lab) cabinet(b, 'Шкаф с реактивами', rc + 4.4, -2.0, -Math.PI / 2, 1.2, 2.0, 0.5, { zhivchik: 0.35, spore: [1, 2, 0.35], grenade: 0.04 }, IM.white);
		else cabinet(b, 'Шкаф', rc - 4.6, -2.0, Math.PI / 2, 1.2, 2.0, 0.5, { ammo919: [3, 6, 0.4], zhivchik: 0.25 });
	};
	cls(-10, { ammo919: [4, 8, 0.5], zhivchik: 0.3 }, false);
	cls(0, { ammo919: [3, 6, 0.4], spore: 0.3 }, false);
	cls(10, { zhivchik: 0.35, ammo12: [2, 5, 0.3] }, true);
	// второй этаж: силикатный кирпич, окна из атласа на обоих фасадах, плоская крыша с парапетом и вытяжками
	const y0 = H + 0.4, H2 = 3.4, top = y0 + H2;
	occluder('SchoolTop', (kb) => {
		kb.add(place(box(W + 0.3, 0.3, D + 0.3, 2), cx, y0 - 0.15, cz), M.concrete);
		kb.add(place(box(W, H2, D, 2, 1.6), cx, y0 + H2 / 2, cz), M.whiteBrick);
		// вывеска над входом — между поясом и окнами второго этажа (над козырьком её видно)
		kb.add(new THREE.PlaneGeometry(5.6, 0.84).translate(cx, y0 + 0.62, cz + D / 2 + 0.03), T.signMaterial('ШКОЛА № 17', { bg: '#e8e4d6', fg: '#2a3a5a' }));
		for (let i = 0; i < 10; i++) for (const s of [1, -1]) {
			const x = cx - 13.5 + i * 3, h = hash01('school', s, i), k = h < 0.2 ? 5 : h < 0.35 ? 6 : h < 0.6 ? 7 : 4;
			const g = T.windowUV(new THREE.PlaneGeometry(1.62, 1.5), k);
			if (s < 0) g.rotateY(Math.PI);
			kb.add(g.translate(x, y0 + 1.75, cz + s * (D / 2 + 0.02)), M.window);
		}
		kb.add(planeXZ(W, D, 4).translate(cx, top + 0.04, cz), M.roofTar);
		for (const s of [-1, 1]) {
			kb.add(boxTop(W + 0.4, 0.5, 0.25, 2).translate(cx, top + 0.25, cz + s * (D / 2 + 0.075)), M.concrete);
			kb.add(boxTop(0.25, 0.5, D - 0.1, 2).translate(cx + s * (W / 2 + 0.075), top + 0.25, cz), M.concrete);
		}
		for (const [ex, ez] of [[-11, -3], [-4, 2], [5, -2.5], [12, 3]]) kb.add(boxTop(1.0, 0.8, 0.6, 1).translate(cx + ex, top + 0.4, cz + ez), M.whiteBrick);
	}, { cx, cz, ry: 0, hx: W / 2 + 0.5, hz: D / 2 + 1.0, top: top + 0.8 }, 0.2);
	return b.finish();
}

/**
 * Ряд кирпичных гаражей (туда заходят): одно здание, боксы через перегородки, у каждого ворота в передней стене;
 * side — где ворота: 'back' (+Z, на юг) или 'left' (−X, на запад). loot — тайник каждого бокса (null — ворота заперты).
 */
function buildGarages(bctx, { name, cx, cz, n, side, loot }) {
	const bay = 4, depth = 6, t = 0.25, H = 2.6;
	const W = side === 'back' ? n * bay : depth, D = side === 'back' ? depth : n * bay;
	const b = new Building(bctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.3 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM, hx = W / 2, hz = D / 2;
	const along = side === 'back' ? 'x' : 'z';
	const centers = [...Array(n)].map((_, i) => -n * bay / 2 + bay / 2 + i * bay);
	const open = centers.filter((_, i) => loot[i]);
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: side === 'back' ? open : [], w: 2.8 });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, doors: side === 'left' ? open : [], w: 2.8 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t });
	for (let i = 1; i < n; i++) {
		const k = -n * bay / 2 + i * bay;
		if (along === 'x') b.wall('z', k, -hz + t / 2, hz - t / 2, { mat: M.brick, t: 0.15 });
		else b.wall('x', k, -hx + t / 2, hx - t / 2, { mat: M.brick, t: 0.15 });
	}
	// плоская крыша с уклоном назад, рубероид
	b.top_(place(box(W + 0.5, 0.14, D + 0.5, 3), 0, H + 0.07, 0), M.roofTar);
	// ворота: распахнутые створки у открытых боксов, запертые — на стене
	for (const [i, c] of centers.entries()) {
		const at = c;
		if (loot[i]) {
			for (const s of [-1, 1]) {
				if (side === 'back') b.furniture(at + s * 1.4, hz - 0.1, s * -1.65, [[1.35, 2.1, 0.06, s * 0.67, 1.05, 0, M.metalRust]], { up: true });
				else b.furniture(-hx + 0.1, at + s * 1.4, Math.PI / 2 + s * 1.65, [[1.35, 2.1, 0.06, s * 0.67, 1.05, 0, M.metalRust]], { up: true });
			}
			// внутри: тайник у задней стены, покрышки и канистры
			const [lx, lz, rot] = side === 'back' ? [at, -hz + 0.6, 0] : [hx - 0.6, at, -Math.PI / 2];
			const L = loot[i];
			if (L.kind === 'bench') workbench(b, 'Верстак', lx, lz, rot, L.loot);
			else if (L.kind === 'shelf') shelf(b, lx, lz, rot, L.loot, 'tools');
			else if (L.kind === 'cache') b.container('Тайник под верстаком', lx, lz, rot, [[2.1, 0.06, 0.85, 0, 0.88, 0, IM.metal], ...[[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]].map(([px, pz]) => [0.08, 0.85, 0.08, px, 0.42, pz, IM.furniture]), [1.0, 0.5, 0.6, -0.3, 0.26, 0.05, IM.crateGreen], [0.5, 0.4, 0.4, 0.6, 0.2, 0.1, IM.crateGreen]], [2.0, 0.8], L.loot, 1.0);
			else if (L.kind === 'safe') safe(b, lx, lz, rot, L.loot);
			const [tx, tz] = side === 'back' ? [at + 1.4, -hz + 2.2] : [hx - 2.2, at - 1.4];
			if (i % 2) b.furniture(tx, tz, 0, [[0.6, 0.5, 0.6, 0, 0.25, 0, IM.black]], { solid: [0.6, 0.6], prop: 'tire' });
			else b.furniture(tx, tz, 0.3, [[0.5, 0.75, 0.5, 0, 0.37, 0, IM.metal]], { solid: [0.5, 0.5], prop: 'barrel' });
		} else {
			b.wallBox(side, at, 2.9, 0.02, 2.15, 0.06, M.metalOlive, { t });
		}
	}
	return b.finish();
}

export default {
	id: 'mikro',
	seed: 4433,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const mark = markingMaterial();

		// ---------- Проспект, улица, проезды, тротуары ----------
		ground(12, 150, -6, 0, M.asphalt, 5, 0.02); // проспект с севера на юг
		ground(150, 8, 0, 10, M.asphalt, 5, 0.022); // улица запад—восток (к Подстанции)
		ground(6, 72, -40, -30, M.asphalt, 5, 0.021); // проезд на северо-запад (к Аэродрому)
		ground(5, 56, 46.5, -22, M.asphalt, 5, 0.0215); // дворовый проезд между домами и гаражами
		ground(150, 0.15, -6, 0, mark, 6, 0.027, Math.PI / 2);
		ground(150, 0.15, 0, 10, mark, 6, 0.026);
		ground(2.4, 150, -13.2, 0, M.concrete, 3, 0.014); // тротуары проспекта
		ground(2.4, 150, 1.2, 0, M.concrete, 3, 0.014);
		ground(150, 2.4, 0, 4.8, M.concrete, 3, 0.0145); // тротуары улицы
		ground(150, 2.4, 0, 15.2, M.concrete, 3, 0.0145);
		// «зебры» на перекрёстке
		for (let i = 0; i < 7; i++) {
			batch.add(place(planeXZ(1.2, 0.5), -11 + i * 1.7, 0.03, 3.0), M.white, { cast: false });
			batch.add(place(planeXZ(1.2, 0.5), -11 + i * 1.7, 0.03, 17.0), M.white, { cast: false });
			batch.add(place(planeXZ(0.5, 1.2), -16.0, 0.03, 7.0 + i), M.white, { cast: false });
			batch.add(place(planeXZ(0.5, 1.2), 4.0, 0.03, 7.0 + i), M.white, { cast: false });
		}
		// бордюры (разрывы — на перекрёстке и у проездов)
		for (const [x, z0, z1] of [[-12.05, -66, 4.5], [-12.05, 15.5, 66], [0.05, -66, 4.5], [0.05, 15.5, 66]]) {
			batch.add(place(box(0.24, 0.14, z1 - z0, 2), x, 0.07, (z0 + z1) / 2), M.concrete, { cast: false });
		}
		for (const [z, x0, x1] of [[5.95, -66, -43.5], [5.95, -36.5, -12.5], [5.95, 0.5, 43.5], [5.95, 49.5, 66], [14.05, -66, -12.5], [14.05, 0.5, 66]]) {
			batch.add(place(box(x1 - x0, 0.14, 0.24, 2), (x0 + x1) / 2, 0.07, z), M.concrete, { cast: false });
		}
		// площадки перед домами (магазины), двор с площадкой, дорожки, стоянки, площадка у гаражей, спортплощадка
		ground(37, 5.4, 24, 0.9, M.concrete, 4, 0.016); // перед домом 1
		ground(20, 12, 22, -24, M.dirt, 4, 0.015); // детская площадка во дворе
		ground(37, 2.4, 24, -16.3, M.concrete, 3, 0.0155); // дорожка вдоль дома 1
		ground(37, 2.4, 24, -32.1, M.concrete, 3, 0.0155); // дорожка вдоль дома 2
		ground(2.4, 16, 5.4, -24, M.concrete, 3, 0.0165); // проход во двор с проспекта
		ground(12, 10, 50.5, -30, M.asphalt, 5, 0.0205); // площадка у гаражей (восток)
		ground(20, 8, -26.5, -17, M.asphalt, 5, 0.0205); // стоянка у дома 4
		ground(21, 2.4, -26.5, -22.4, M.concrete, 3, 0.0155); // дорожка вдоль дома 4
		ground(2.4, 22, -15.6, -13, M.concrete, 3, 0.0165);
		ground(26, 8, -44, 29, M.dirt, 4, 0.015); // перед гаражами (запад)
		ground(37, 4, -34, 48.4, M.concrete, 4, 0.016); // перед домом 3
		ground(2.4, 18, -15.6, 25, M.concrete, 3, 0.0165); // дорожка к дому 3
		ground(26, 14, 30, 48, M.asphalt, 5, 0.0205); // спортплощадка школы
		ground(2.4, 26, 12.5, 38.5, M.concrete, 3, 0.0165); // дорожка к школе
		ground(34, 2.4, 30, 39.2, M.concrete, 3, 0.0155);
		ground(4, 26, 53, 33, M.dirt, 4, 0.015); // перед ракушками на юго-востоке
		ground(6, 40, -52, -32, M.dirt, 4, 0.015); // перед ракушками в парке
		ground(10, 2.4, 7.5, 38.5, M.concrete, 3, 0.0165); // от проспекта к школе
		const roads = [[-12, 0, -80, 80], [-80, 80, 6, 14], [-43, -37, -70, 6], [44, 49, -50, 6]];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

		// ---------- Девятиэтажки: первый этаж — здание (заходят), выше — фасад ----------
		const HW = 35.2, HD = 12.8; // 11 панелей по 3,2 м, 4 панели в глубину
		buildings.push(floor1(bctx, { name: 'Dom1', cx: 24, cz: -8.4, W: HW, D: HD, rooms: [{ kind: 'shop', w: 14 }, { kind: 'hall', w: 6.4 }, { kind: 'tools', w: 14.8 }] }));
		tower(occluder, M, 'Dom1Top', { cx: 24, cz: -8.4, W: HW, D: HD, halls: [-0.4], balc: [1, 2, 8, 9] });
		buildings.push(floor1(bctx, { name: 'Dom2', cx: 24, cz: -40, W: HW, D: HD, rooms: [{ kind: 'pharm', w: 10 }, { kind: 'hall', w: 6.4 }, { kind: 'post', w: 12.4 }, { kind: 'hall', w: 6.4 }] }));
		tower(occluder, M, 'Dom2Top', { cx: 24, cz: -40, W: HW, D: HD, halls: [-4.4, 14.4], balc: [0, 1, 5, 6, 9, 10] });
		buildings.push(floor1(bctx, { name: 'Dom3', cx: -34, cz: 40, W: HW, D: HD, rooms: [{ kind: 'hall', w: 6.4 }, { kind: 'shop', w: 14 }, { kind: 'hall', w: 6.4 }, { kind: 'atelier', w: 8.4 }] }));
		tower(occluder, M, 'Dom3Top', { cx: -34, cz: 40, W: HW, D: HD, halls: [-14.4, 6.0], balc: [2, 3, 7, 8, 10] });
		buildings.push(floor1(bctx, { name: 'Dom4', cx: -26.4, cz: -30, W: 19.2, D: HD, rooms: [{ kind: 'hall', w: 6.4 }, { kind: 'police', w: 12.8 }] }));
		tower(occluder, M, 'Dom4Top', { cx: -26.4, cz: -30, W: 19.2, D: HD, halls: [-6.4], balc: [0, 1, 4, 5] });
		// лавочки у подъездов
		for (const [x, z] of [[23.6, -0.4], [19.6, -32.0], [38.4, -32.0], [-48.4, 48.0], [-28.0, 48.0], [-32.8, -22.0]]) {
			bench(batch, M, x + 2.4, z, Math.PI); bench(batch, M, x - 2.4, z, Math.PI);
		}

		// ---------- Двор между домами: детская площадка, лавки, мусорная площадка, костёр ----------
		swings(batch, M, 15, -24);
		collide(15, -24, 3.6, 1.6);
		slide(batch, M, 27, -21);
		collide(27, -21, 1.2, 1.2);
		batch.add(place(box(3, 0.3, 3, 1), 21, 0.15, -27), M.wood); // песочница
		batch.add(place(planeXZ(2.7, 2.7, 1), 21, 0.31, -27), M.sand, { cast: false });
		collide(21, -27, 3, 3);
		{
			// карусель: диск на стойке, четыре поручня
			const [x, z] = [30, -27];
			batch.add(place(new THREE.CylinderGeometry(1.2, 1.2, 0.08, 16), x, 0.42, z), M.yellow);
			batch.add(place(box(0.12, 0.9, 0.12), x, 0.45, z), M.metalRust);
			for (let i = 0; i < 4; i++) batch.add(place(box(0.05, 0.6, 1.1).translate(0, 0, 0.6), x, 0.78, z, i * Math.PI / 2), M.metalRust);
			collide(x, z, 2.5, 2.5);
		}
		for (const [x, z, ry] of [[12.5, -20, Math.PI], [12.5, -28, 0], [33, -20, Math.PI], [25, -30.4, 0]]) bench(batch, M, x, z, ry);
		for (const [x, z] of [[10, -20.5], [36, -28]]) streetLamp(batch, M, collide, x, z);
		const trashSpot = (x, z) => {
			for (let i = 0; i < 3; i++) {
				beginProp('dumpster', x - 1.4 + i * 1.4, z, 0);
				batch.add(place(box(1.2, 1.1, 0.9, 1), x - 1.4 + i * 1.4, 0.55, z, R(-0.1, 0.1)), M.green);
				endProp();
			}
			collide(x, z, 4.4, 1);
			batch.add(place(box(5.4, 1.5, 0.25, 1.5), x, 0.75, z - 0.8), M.brick); // кирпичная стенка с трёх сторон
			collide(x, z - 0.8, 5.4, 0.25);
			for (const s of [-1, 1]) { batch.add(place(box(0.25, 1.5, 2.0, 1.5), x + s * 2.6, 0.75, z + 0.2), M.brick); collide(x + s * 2.6, z + 0.2, 0.25, 2.0); }
			for (const [dx, dz] of [[-2.0, 1.1], [1.3, 1.2], [2.3, 0.9], [-0.6, 1.4]]) {
				beginProp('trash', x + dx, z + dz, R(0, 3));
				batch.add(place(new THREE.IcosahedronGeometry(0.32, 1).scale(1, 0.75, 1), x + dx, 0.22, z + dz, R(0, 3)), M.tire);
				endProp();
			}
		};
		trashSpot(40, -24);
		trashSpot(-33.5, -8);
		trashSpot(-58, 44);

		// ---------- Гаражи: кирпичные ряды (заходят) и ракушки ----------
		buildings.push(buildGarages(bctx, {
			name: 'GaragesA', cx: -44, cz: 22, n: 6, side: 'back',
			loot: [
				{ kind: 'bench', loot: { ammo12: [3, 6, 0.4], ammo919: [4, 8, 0.35], fireaxe: 0.08 } },
				{ kind: 'shelf', loot: { ammo762: [6, 12, 0.4], spore: 0.3, zhivchik: 0.2 } },
				null,
				{ kind: 'cache', loot: { ak74: 0.3, aks: 0.25, ammo545: [20, 40, 0.8], grenade: [1, 2, 0.3] } }, // оружейный тайник
				{ kind: 'bench', loot: { ammo12: [4, 8, 0.45], ammo762: [5, 10, 0.3] } },
				{ kind: 'shelf', loot: { ammo919: [5, 10, 0.4], spore: 0.3, grenade: 0.05 } },
			],
		}));
		buildings.push(buildGarages(bctx, {
			name: 'GaragesB', cx: 57, cz: -30, n: 6, side: 'left',
			loot: [
				{ kind: 'shelf', loot: { ammo762: [5, 10, 0.4], ammo12: [3, 6, 0.3] } },
				{ kind: 'safe', loot: { deagle: 0.2, mp5: 0.25, ammo919: [20, 40, 0.7], ammo50: [7, 14, 0.4] } }, // оружейный тайник
				{ kind: 'bench', loot: { ammo919: [4, 8, 0.4], fireaxe: 0.08, spore: 0.25 } },
				null,
				{ kind: 'shelf', loot: { ammo545: [8, 16, 0.4], zhivchik: 0.25 } },
				{ kind: 'bench', loot: { ammo12: [3, 6, 0.4], grenade: 0.06, spore: 0.3 } },
			],
		}));
		// ракушки: гнутый лист на каркасе, ворота к проезду
		const shell = (x, z, ry, mat) => {
			batch.add(place(box(2.9, 1.9, 5.2, 1.5), x, 0.95, z, ry), mat);
			batch.add(place(box(2.3, 0.35, 5.0, 1.5), x, 2.05, z, ry), mat);
			batch.add(place(box(0.05, 1.6, 0.08).translate(0, 0, 2.62), x, 0.9, z, ry), M.metalDark); // щель ворот
			collide(x, z, 3.0, 5.3, ry);
		};
		for (let i = 0; i < 5; i++) shell(-58 + i * 3.6, 56.5, 0, i % 2 ? M.metalRust : M.metalOlive); // юго-запад, за домом 3
		for (let i = 0; i < 6; i++) shell(-59.5, -50 + i * 3.6, Math.PI / 2, i % 3 ? M.metalRust : M.metalOlive); // парк, вдоль проезда
		for (let i = 0; i < 7; i++) shell(58, 22 + i * 3.6, -Math.PI / 2, i % 2 ? M.metalOlive : M.metalRust); // юго-восток

		// ---------- Школа и спортплощадка ----------
		buildings.push(buildSchool(bctx, occluder, { cx: 30, cz: 30 }));
		{
			// ворота по торцам площадки, турник, лавки, сетка на столбах с северной стороны
			const goal = (x, z) => {
				for (const dz of [-1.5, 1.5]) { batch.add(place(box(0.08, 2.0, 0.08), x, 1.0, z + dz), M.silver); collide(x, z + dz, 0.3, 0.3); }
				batch.add(place(box(0.08, 0.08, 3.1), x, 2.0, z), M.silver);
			};
			goal(18.5, 48); goal(41.5, 48);
			for (const dx of [-0.9, 0.9]) { batch.add(place(box(0.08, 2.2, 0.08), 14 + dx, 1.1, 54), M.silver); collide(14 + dx, 54, 0.3, 0.3); }
			batch.add(place(box(1.9, 0.06, 0.06), 14, 2.2, 54), M.silver);
			for (let x = 17; x <= 43; x += 4.33) { batch.add(place(box(0.08, 2.5, 0.08), x, 1.25, 40.7), M.silver); collide(x, 40.7, 0.3, 0.3); }
			batch.add(place(box(26, 0.05, 0.05), 30, 2.5, 40.7), M.silver);
			for (const [x, z, ry] of [[46, 44, -Math.PI / 2], [46, 50, -Math.PI / 2], [8, 44, Math.PI / 2]]) bench(batch, M, x, z, ry);
			// доска объявлений у входа и флагшток
			batch.add(place(box(0.1, 3.0, 0.1), 20, 1.5, 38.6), M.silver); collide(20, 38.6, 0.3, 0.3);
			batch.add(place(box(2.0, 1.1, 0.08), 40, 1.5, 38.6), M.woodGrey);
			for (const dx of [-0.9, 0.9]) batch.add(place(box(0.08, 2.1, 0.08), 40 + dx, 1.05, 38.6), M.woodGrey);
			collide(40, 38.6, 2.0, 0.2);
		}

		// ---------- Трансформаторная, остановка, фонари ----------
		transformer(batch, root, M, collide, -19, -6);
		transformer(batch, root, M, collide, 49, 57);
		{
			const x = -28, z = 4.0; // остановка на северном тротуаре, открыта к улице
			batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z - 0.8), M.concrete);
			batch.add(place(box(5.4, 0.15, 2.0, 1), x, 2.45, z), M.metalRust);
			for (const dx of [-2.4, 2.4]) batch.add(place(box(0.15, 2.4, 1.8, 1), x + dx, 1.2, z), M.concrete);
			batch.add(place(box(4, 0.08, 0.45), x, 0.5, z - 0.4), M.wood);
			collide(x, z - 0.4, 5.2, 1.0);
		}
		for (const x of [-54, -24, 20, 40, 58]) streetLamp(batch, M, collide, x, 15.4);
		for (const [x, z] of [[-24, 30], [-46, 30], [14, 44]]) streetLamp(batch, M, collide, x, z);

		// ---------- Машины и автобус ----------
		const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
		car(-1.6, -30, Math.PI / 2 + 0.03, 0x8a8a7a); // у восточного бордюра проспекта
		car(-1.5, -18, Math.PI / 2, 0x5a6a7a);
		car(-1.7, 30, Math.PI / 2 - 0.04, 0x7b5a3a);
		car(-10.4, -40, -Math.PI / 2, 0xc8c0a8);
		car(-10.5, 24, -Math.PI / 2 + 0.05, 0x3a5a3a);
		car(-6, 44, 0.9, 0x2a2826, { burned: true }); // сгорела посреди проспекта
		car(-3, 8.5, 0.35, 0x8a2e24, { crashed: true }); // врезалась на перекрёстке
		car(26, 11.5, Math.PI + 0.1, 0x9a9a8a);
		car(48, 8.3, 0.08, 0x5a7a8a, { crashed: true });
		car(-30, -17.5, Math.PI / 2 + 0.06, 0xa8a49a); // стоянка у дома 4
		car(-26.5, -17.8, Math.PI / 2, 0x3a5a7a);
		car(-20, -17.4, -Math.PI / 2 + 0.1, 0x1c1a18, { burned: true });
		car(50.2, -36, Math.PI / 2, 0x7b8a5a); // у гаражей
		car(50.4, -25, Math.PI / 2 - 0.08, 0x8a2e24);
		car(-24, 51, 0.2, 0x5a6a3a); // перед домом 3
		car(-40, 51.5, -0.15, 0xa8a49a, { crashed: true });
		car(16, 2.0, 0.1, 0x2a3a5a); // перед магазином
		car(53, 51, 1.3, 0x6a6a5a);
		bus(batch, M, root, -26, 9.6, Math.PI / 2 + 0.05); // горит на улице у остановки
		collide(-26, 9.6, 2.6, 8.4, Math.PI / 2 + 0.05);

		return {
			start: [-6, 58.5, Math.PI],
			exits: [
				{ to: 'zarechny', x0: -10, x1: -2, z0: 61.2, z1: 66, spawn: [-6, 58.5, Math.PI], sign: [-1, 60.2, '↓ Заречный'] },
				{ to: 'podstanciya', x0: -66, x1: -61.2, z0: 6, z1: 14, spawn: [-59, 10, Math.PI / 2], sign: [-60, 16.4, '← Подстанция'] },
				{ to: 'voench', x0: -10, x1: -2, z0: -66, z1: -61.2, spawn: [-6, -58.5, 0], sign: [0.5, -60.2, '↑ Военная часть'] },
				{ to: 'aerodrom', x0: -44, x1: -36, z0: -66, z1: -61.2, spawn: [-40, -58.5, 0], sign: [-34.5, -60.2, '↖ Аэродром'] },
			],
			// логово руберов: во дворе у детской площадки, на спортплощадке школы, у гаражей и во дворе дома 4;
			// топтуны водят стаи у мусорок, на стоянках и у ракушек; бегуны — по улицам
			groups: [
				{ at: [22, -24], r: 7, runners: 3, rubers: 1 },
				{ at: [38, -20], r: 5, runners: 2, stompers: 1 },
				{ at: [-6, 10], r: 7, runners: 3 },
				{ at: [20, 1], r: 6, runners: 2, stompers: 1 },
				{ at: [30, 48], r: 7, runners: 2, rubers: 1 },
				{ at: [30, 40], r: 4, runners: 2 },
				{ at: [-44, 29], r: 5, runners: 2, rubers: 1 },
				{ at: [-36, 54], r: 7, runners: 2, stompers: 1 },
				{ at: [-26, -12], r: 6, runners: 2, rubers: 1 },
				{ at: [-54, -30], r: 7, runners: 2, stompers: 1 },
				{ at: [50, -30], r: 5, runners: 2, stompers: 1 },
				{ at: [-6, -45], r: 7, runners: 2 },
				{ at: [-50, 10], r: 6, runners: 2 },
				{ at: [55, 45], r: 6, runners: 2, stompers: 1 },
				{ at: [24, -54], r: 7, runners: 2, stompers: 1 },
				{ at: [-26, 56], r: 5, runners: 2 },
				{ at: [-8, 30], r: 5, runners: 1 },
			],
			onRoad,
			// горит автобус у остановки и машина на проспекте; бочка у гаражей, костёр во дворе
			fires: [[-26, 9.6, 'car', 2.8], [-6, 44, 'car'], [-32, 30], [33, -31, 'ground']],
			barrels: 6,
			trees(tryTree) {
				// берёзы вдоль проспекта и улицы, во дворах; на западе — парк
				for (let z = -58; z < 60; z += 6) { tryTree(-15.6 + R(-0.5, 0.5), z + R(-1, 1), 'birch'); tryTree(3.6 + R(-0.5, 0.5), z + R(-1, 1), 'birch'); }
				for (let x = -58; x < 60; x += 7) tryTree(x + R(-1, 1), 17.6 + R(-0.3, 0.6), 'birch');
				for (let i = 0; i < 14; i++) tryTree(R(7, 41), R(-31, -17), 'birch'); // двор
				for (let i = 0; i < 8; i++) tryTree(R(-36, -17), R(-22, -8), 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-51, -17), R(49, 60), 'birch');
				for (let i = 0; i < 30; i++) tryTree(R(-62, -45), R(-62, 2), 'birch'); // парк
				for (let i = 0; i < 10; i++) tryTree(R(6, 44), R(-60, -48), 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(4, 12), R(20, 60), 'birch');
				for (let i = 0; i < 6; i++) tryTree(R(48, 54), R(20, 40), 'birch');
			},
			beltTrees: ['birch'], // город: одни берёзы (каждый вид дерева на участке — лишние вызовы отрисовки)
			beltDensity: 0.8,
			clutter: 12,
			blood: 24,
			puddles: 10,
			puddle: () => [R(-58, 58), rnd() < 0.5 ? R(6.5, 13.5) : R(-56, 56)],
			grass: 0.6,
			hint: (b) => ({
				Dom1: 'Первый этаж: «Продукты», подъезд, хозтовары — обыщи стеллажи, прилавки и сейфы',
				Dom2: 'Первый этаж: аптека, почта, подъезды — живчики на витрине, патроны в сейфах и посылках',
				Dom3: 'Первый этаж: «Продукты», ателье, подъезды — стеллажи, касса, почтовые ящики',
				Dom4: 'Участковый пункт — оружейный шкаф и сейф; в подъезде почтовые ящики',
				School: 'Школа — учительские столы и шкафы в классах, гардероб и буфет в коридоре',
				GaragesA: 'Гаражи — верстаки и стеллажи; в одном боксе тайник с оружием под верстаком',
				GaragesB: 'Гаражи — верстаки и стеллажи; в одном боксе сейф с оружием',
			}[b.name]),
		};
	},
};
