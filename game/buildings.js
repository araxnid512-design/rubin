// Здания, в которые можно зайти: деревенские дома и магазин «Продукты».
// Стены собраны из кусков с дверными проёмами, внутри — пол, обои, мебель и тайники для обыска
// (шкафы, тумбочки, сундуки, буфеты — там патроны). Нижняя часть стен (до CUT) видна всегда,
// верх стен, окна и крыша — отдельная группа: она плавно исчезает, когда герой внутри, и становится
// полупрозрачной, когда здание загораживает героя от камеры (как в Last Day on Earth).

import * as THREE from 'three';
import * as T from './textures.js';
import { Batch, box, place, planeXZ } from './geom.js';

/** Высота, по которой срезаются стены, когда герой внутри. */
export const CUT = 1.05;
const DOOR_H = 2.1;

// ---------- Исчезновение ----------

/** Плавная прозрачность группы мешей (у группы свои копии материалов). */
export class Fader {
	constructor(group, { speed = 4 } = {}) {
		this.group = group;
		this.speed = speed;
		this.value = 1;
		this.target = 1;
		this.mats = [];
		group.traverse((o) => {
			if (!o.isMesh) return;
			o.material = o.material.clone();
			this.mats.push(o.material);
		});
	}

	update(dt) {
		if (this.value === this.target) return;
		const step = dt * this.speed;
		this.value = this.target > this.value ? Math.min(this.target, this.value + step) : Math.max(this.target, this.value - step);
		const v = this.value;
		this.group.visible = v > 0.01;
		const transparent = v < 0.999;
		for (const m of this.mats) {
			// у непрозрачного материала шейдер собран без альфы — при переключении его надо пересобрать
			if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
			m.opacity = v;
			m.depthWrite = v > 0.5;
		}
	}
}

/** Пересекает ли отрезок p→q (мировые точки) коробку в локальных осях здания. */
export function segmentHitsBox(p, q, { cx, cz, ry, hx, hz, top }) {
	const c = Math.cos(ry), s = Math.sin(ry);
	const loc = (v) => { const dx = v.x - cx, dz = v.z - cz; return [dx * c - dz * s, v.y, dx * s + dz * c]; };
	const a = loc(p), b = loc(q);
	const lo = [-hx, 0, -hz], hi = [hx, top, hz];
	let t0 = 0, t1 = 1;
	for (let k = 0; k < 3; k++) {
		const d = b[k] - a[k];
		if (Math.abs(d) < 1e-9) { if (a[k] < lo[k] || a[k] > hi[k]) return false; continue; }
		let ta = (lo[k] - a[k]) / d, tb = (hi[k] - a[k]) / d;
		if (ta > tb) [ta, tb] = [tb, ta];
		t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
		if (t0 > t1) return false;
	}
	return true;
}

// ---------- Материалы интерьера (по одному экземпляру — для слияния) ----------

let IM = null;
function interior() {
	IM ??= {
		wallpaper: [T.wallpaperMaterial([1, 1], [176, 160, 122], 0), T.wallpaperMaterial([1, 1], [140, 158, 150], 1), T.wallpaperMaterial([1, 1], [180, 150, 140], 2)],
		floor: T.woodMaterial([1, 1], [118, 80, 52]),
		whitewash: T.whitewashMaterial([1, 1]),
		shopWall: T.whitewashMaterial([1, 1], [156, 182, 168]),
		linoleum: T.linoleumMaterial([1, 1]),
		furniture: T.woodMaterial([1, 1], [96, 62, 40]),
		furnitureLight: T.woodMaterial([1, 1], [150, 116, 78]),
		sofa: T.fabricMaterial([92, 60, 44]),
		blanket: T.fabricMaterial([120, 40, 44]),
		linen: T.fabricMaterial([200, 196, 184]),
		rug: T.rugMaterial(),
		rugBlue: T.rugMaterial([40, 52, 96]),
		white: new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: 0.5 }),
		black: new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.4 }),
		screen: new THREE.MeshStandardMaterial({ color: 0x2a3430, roughness: 0.15, metalness: 0.3 }),
		metal: new THREE.MeshStandardMaterial({ color: 0x5a5e60, roughness: 0.45, metalness: 0.7 }),
		cans: new THREE.MeshStandardMaterial({ color: 0xa88c4a, roughness: 0.35, metalness: 0.6 }),
		jars: new THREE.MeshStandardMaterial({ color: 0x7a8a5a, roughness: 0.1, transparent: true, opacity: 0.85 }),
		crate: T.woodMaterial([1, 1], [140, 112, 70]),
	};
	return IM;
}

// ---------- Здание ----------

class Building {
	/**
	 * ctx: { batch (общая статика), root, collide, M }; W×D — снаружи по стенам, H — высота стен,
	 * top — высота с крышей (для проверки, загораживает ли здание героя).
	 */
	constructor(ctx, { name, cx, cz, ry = 0, W, D, H, top }) {
		Object.assign(this, { ctx, name, cx, cz, ry, W, D, H, top });
		this.c = Math.cos(ry);
		this.s = Math.sin(ry);
		this.matrix = new THREE.Matrix4().makeRotationY(ry).setPosition(cx, 0, cz);
		this.upper = new Batch();
		this.group = new THREE.Group();
		this.group.name = `${name}Upper`;
		this.containers = [];
		this.IM = interior();
	}

	/** Локальная точка → мир. */
	world(x, z) { return [this.cx + x * this.c + z * this.s, this.cz - x * this.s + z * this.c]; }
	/** Мировая точка → локальная. */
	local(x, z) { const dx = x - this.cx, dz = z - this.cz; return [dx * this.c - dz * this.s, dx * this.s + dz * this.c]; }
	lower(geo, mat, opts) { this.ctx.batch.add(geo.applyMatrix4(this.matrix), mat, opts); }
	top_(geo, mat, opts) { this.upper.add(geo.applyMatrix4(this.matrix), mat, opts); }
	collide(x, z, w, d, rot = 0) { const [wx, wz] = this.world(x, z); this.ctx.collide(wx, wz, w, d, this.ry + rot); }

	/** Герой внутри (по наружному контуру стен). */
	contains(p, margin = 0) {
		const [lx, lz] = this.local(p.x, p.z);
		return Math.abs(lx) < this.W / 2 + margin && Math.abs(lz) < this.D / 2 + margin;
	}

	/**
	 * Прямая стена вдоль X (axis 'x', на линии z = k) или вдоль Z (на линии x = k) от s0 до s1.
	 * doors — середины дверных проёмов (ширина w); lining — обои с внутренней стороны (side ±1).
	 */
	wall(axis, k, s0, s1, { mat, t = 0.2, doors = [], w = 1.3, lining = null, side = 1, sx = 1.5 }) {
		const H = this.H;
		const gaps = doors.map((d) => [d - w / 2, d + w / 2]).sort((a, b) => a[0] - b[0]);
		const solids = [];
		let cur = s0;
		for (const [d0, d1] of gaps) { if (d0 > cur) solids.push([cur, d0]); cur = d1; }
		if (cur < s1) solids.push([cur, s1]);
		const piece = (a0, a1, y0, y1, material, thick, off, up) => {
			const len = a1 - a0, mid = (a0 + a1) / 2, hh = y1 - y0;
			const g = axis === 'x' ? box(len, hh, thick, sx) : box(thick, hh, len, sx);
			place(g, axis === 'x' ? mid : k + off, y0 + hh / 2, axis === 'x' ? k + off : mid);
			if (up) this.top_(g, material); else this.lower(g, material);
		};
		const layers = (a0, a1, y0, y1, up) => {
			piece(a0, a1, y0, y1, mat, t, 0, up);
			if (lining) piece(a0, a1, y0, y1, lining, 0.02, side * (t / 2 + 0.012), up);
		};
		for (const [a0, a1] of solids) {
			layers(a0, a1, 0, CUT, false);
			layers(a0, a1, CUT, H, true);
			const len = a1 - a0, mid = (a0 + a1) / 2;
			if (axis === 'x') this.collide(mid, k, len, t + 0.04); else this.collide(k, mid, t + 0.04, len);
		}
		// перемычки над дверями и открытые двери
		for (const [d0, d1] of gaps) {
			layers(d0, d1, DOOR_H, H, true);
		}
	}

	/** Окно-наличник снаружи на стене: side — 'front' (−Z), 'back' (+Z), 'left' (−X), 'right' (+X). */
	window(side, at, { y = 1.65, t = 0.2 } = {}) {
		const g = new THREE.PlaneGeometry(1.1, 1.4);
		const off = t / 2 + 0.015;
		if (side === 'front') { g.rotateY(Math.PI); g.translate(at, y, -this.D / 2 - off); }
		if (side === 'back') g.translate(at, y, this.D / 2 + off);
		if (side === 'left') { g.rotateY(-Math.PI / 2); g.translate(-this.W / 2 - off, y, at); }
		if (side === 'right') { g.rotateY(Math.PI / 2); g.translate(this.W / 2 + off, y, at); }
		this.top_(g, this.ctx.M.window);
	}

	/** Мебель из коробок [w, h, d, x, y, z, материал] в своих осях (поворот rot), с коллайдером. */
	furniture(x, z, rot, parts, { solid = [0, 0], up = false } = {}) {
		const m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
		for (const [w, h, d, px, py, pz, mat, extra] of parts) {
			const g = extra?.geo ?? box(w, h, d, 0.8);
			if (!extra?.geo) g.translate(px, py, pz);
			g.applyMatrix4(m);
			if (up || extra?.up) this.top_(g, mat); else this.lower(g, mat);
		}
		if (solid[0] > 0) this.collide(x, z, solid[0], solid[1], rot);
	}

	/** Тайник: мебель, которую можно обыскать. loot — что может лежать (см. main.js). */
	container(name, x, z, rot, parts, solid, loot, height) {
		this.furniture(x, z, rot, parts, { solid });
		const [wx, wz] = this.world(x, z);
		// точка обыска — перед фасадом мебели (её «лицо» смотрит в +Z своих осей)
		const fx = x + Math.sin(rot) * (solid[1] / 2 + 0.45), fz = z + Math.cos(rot) * (solid[1] / 2 + 0.45);
		const [ax, az] = this.world(fx, fz);
		const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.softDotTexture('255,236,170'), transparent: true, depthWrite: false, opacity: 0.8 }));
		spark.scale.setScalar(0.45);
		spark.position.set(wx, height + 0.25, wz);
		this.ctx.root.add(spark);
		this.containers.push({ name, building: this.name, x: wx, z: wz, ax, az, loot, spark });
	}

	/** Собрать верхнюю группу (крыша, верх стен) в сцену. */
	finish() {
		this.upper.build(this.group);
		this.ctx.root.add(this.group);
		this.fader = new Fader(this.group);
		return this;
	}

	/** Прозрачность верха: внутри — нет верха, загораживает героя от камеры — полупрозрачный. */
	updateView(player, eye, dt) {
		const inside = this.contains(player, -0.05);
		const blocks = !inside && segmentHitsBox(eye, player, { cx: this.cx, cz: this.cz, ry: this.ry, hx: this.W / 2 + 0.3, hz: this.D / 2 + 0.3, top: this.top });
		this.inside = inside;
		this.fader.target = inside ? 0 : blocks ? 0.28 : 1;
		this.fader.update(dt);
	}
}

// ---------- Мебель ----------

function stove(b, x, z, rot) {
	const { whitewash } = b.IM;
	b.furniture(x, z, rot, [
		[1.5, 1.55, 1.7, 0, 0.775, 0, whitewash],
		[1.2, 0.35, 1.4, 0.1, 1.72, 0.1, whitewash],
		[0.5, 0.35, 0.05, -0.3, 0.75, 0.86, b.IM.black], // устье
	], { solid: [1.5, 1.7] });
	// труба — сквозь крышу, исчезает вместе с ней
	b.furniture(x, z, rot, [[0.5, b.top - 1.6, 0.5, 0.35, 1.9 + (b.top - 1.6) / 2, 0.4, whitewash]], { up: true });
}

function table(b, x, z, rot, { w = 1.1, d = 0.75, cloth = false } = {}) {
	const { furniture, linen } = b.IM;
	const parts = [[w, 0.05, d, 0, 0.75, 0, cloth ? linen : furniture]];
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([0.06, 0.72, 0.06, sx * (w / 2 - 0.08), 0.36, sz * (d / 2 - 0.08), furniture]);
	if (cloth) parts.push([w + 0.08, 0.25, d + 0.08, 0, 0.64, 0, linen]);
	b.furniture(x, z, rot, parts, { solid: [w, d] });
}

function chair(b, x, z, rot) {
	const f = b.IM.furnitureLight;
	b.furniture(x, z, rot, [
		[0.42, 0.05, 0.42, 0, 0.45, 0, f],
		[0.42, 0.5, 0.05, 0, 0.72, -0.19, f],
		...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [0.04, 0.45, 0.04, sx * 0.18, 0.22, sz * 0.18, f]),
	], { solid: [0.45, 0.45] });
}

function sofa(b, x, z, rot) {
	const { sofa: s, furniture } = b.IM;
	b.furniture(x, z, rot, [
		[2.0, 0.42, 0.8, 0, 0.21, 0.05, s],
		[2.0, 0.5, 0.2, 0, 0.66, -0.3, s],
		[0.18, 0.62, 0.85, -0.95, 0.31, 0.02, furniture],
		[0.18, 0.62, 0.85, 0.95, 0.31, 0.02, furniture],
	], { solid: [2.05, 0.85] });
}

function bed(b, x, z, rot) {
	const { furniture, blanket, linen } = b.IM;
	b.furniture(x, z, rot, [
		[1.3, 0.3, 2.0, 0, 0.3, 0, furniture],
		[1.32, 0.12, 1.5, 0, 0.5, 0.22, blanket],
		[1.2, 0.12, 0.45, 0, 0.5, -0.72, linen],
		[0.55, 0.16, 0.35, -0.3, 0.62, -0.75, linen],
		[0.55, 0.16, 0.35, 0.3, 0.62, -0.75, linen],
		[1.3, 0.9, 0.06, 0, 0.45, -1.0, furniture],
	], { solid: [1.3, 2.0] });
}

function tv(b, x, z, rot) {
	const { furniture, black, screen } = b.IM;
	b.furniture(x, z, rot, [
		[0.8, 0.55, 0.45, 0, 0.275, 0, furniture],
		[0.62, 0.5, 0.5, 0, 0.8, -0.02, black],
		[0.48, 0.38, 0.02, 0, 0.8, 0.235, screen],
	], { solid: [0.8, 0.5] });
}

function rug(b, x, z, rot, w, d, mat = b.IM.rug) {
	const g = planeXZ(w, d, w, d);
	g.rotateY(rot);
	g.translate(x, 0.032, z);
	b.lower(g, mat, { cast: false });
}

// тайники (лицо мебели — в +Z её осей)
const cabinet = (b, name, x, z, rot, w, h, d, loot, mat = b.IM.furniture) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, mat],
	[0.02, h - 0.12, 0.02, 0, h / 2, d / 2 + 0.005, b.IM.black], // щель между дверцами
	[0.04, 0.12, 0.03, -0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
	[0.04, 0.12, 0.03, 0.08, h * 0.55, d / 2 + 0.02, b.IM.metal],
], [w, d], loot, h);

const drawers = (b, name, x, z, rot, w, h, d, loot) => b.container(name, x, z, rot, [
	[w, h, d, 0, h / 2, 0, b.IM.furniture],
	...[0.25, 0.55, 0.82].filter((f) => f * h < h - 0.1).map((f) => [w - 0.1, 0.02, 0.02, 0, h * f, d / 2 + 0.005, b.IM.black]),
], [w, d], loot, h);

const chest = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.0, 0.5, 0.55, 0, 0.25, 0, b.IM.furnitureLight],
	[1.02, 0.08, 0.57, 0, 0.53, 0, b.IM.furniture],
	[0.06, 0.58, 0.58, -0.32, 0.29, 0, b.IM.metal],
	[0.06, 0.58, 0.58, 0.32, 0.29, 0, b.IM.metal],
], [1.0, 0.55], loot, 0.57);

const fridge = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.62, 1.5, 0.6, 0, 0.75, 0, b.IM.white],
	[0.04, 0.3, 0.04, -0.24, 1.0, 0.32, b.IM.metal],
], [0.62, 0.6], loot, 1.5);

// ---------- Деревенский дом ----------

/**
 * Дом-пятистенок 9.6×7.2 м: кухня с печью и входом, зал, спальня. Вход — в передней стене (−Z локально).
 * Тайники: буфет и холодильник на кухне, шкаф и комод в зале, тумбочка и сундук в спальне.
 */
export function buildHouse(ctx, { name, cx, cz, ry, rnd, variant = 0 }) {
	const W = 9.6, D = 7.2, H = 2.7;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 2.0 });
	const { M } = ctx;
	const IM = b.IM;
	const logs = rnd() < 0.5 ? M.wood : M.woodGrey;
	const paper = IM.wallpaper[variant % IM.wallpaper.length];
	const t = 0.2, hx = W / 2, hz = D / 2;
	// пол, цоколь, крыльцо
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	for (const [w, d, x, z] of [[W + 0.3, 0.25, 0, -hz - 0.05], [W + 0.3, 0.25, 0, hz + 0.05], [0.25, D + 0.3, -hx - 0.05, 0], [0.25, D + 0.3, hx + 0.05, 0]]) {
		b.lower(place(box(w, 0.35, d, 2), x, 0.175, z), M.concreteDark);
	}
	b.lower(place(box(1.8, 0.18, 1.0), 3.0, 0.09, -hz - 0.65), M.wood);
	// наружные стены (бревно) с обоями внутри; дверь в передней стене
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: logs, doors: [3.0], lining: paper, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: logs, lining: paper, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: logs, lining: paper, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: logs, lining: IM.whitewash, side: -1 });
	// перегородки: кухня | зал; зал | спальня
	b.wall('z', 1.2, -hz + t / 2, hz - t / 2, { mat: paper, t: 0.14, doors: [-1.6] });
	b.wall('x', 0.2, -hx + t / 2, 1.2 - 0.07, { mat: paper, t: 0.14, doors: [-1.5] });
	// окна
	for (const x of [-3.2, -0.9]) b.window('front', x);
	for (const x of [-3.2, -0.9, 3.0]) b.window('back', x);
	b.window('left', -1.7); b.window('left', 1.9); b.window('right', 1.0);
	// открытая входная дверь — внутрь кухни
	b.furniture(3.0 - 0.62, -hz + 0.1, -1.75, [[1.2, 2.05, 0.05, 0.6, 1.03, 0, M.woodGreen]], { up: true });
	// двускатная крыша вдоль X и фронтоны
	const rise = 1.8, roofLen = W + 0.8, slope = Math.hypot(hz + 0.5, rise);
	for (const s of [-1, 1]) {
		const g = box(roofLen, 0.08, slope, 2);
		place(g, 0, H + rise / 2, s * (hz + 0.5) / 2, 0, -s * Math.atan2(rise, hz + 0.5));
		b.top_(g, M.slate);
	}
	for (const sx of [-1, 1]) {
		const x = sx * (hx + 0.01);
		const a = [x, H, -hz], c = [x, H, hz], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...a, ...tp, ...c] : [...a, ...c, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 4, 1, D / 2, 0] : [0, 0, D / 2, 0, D / 4, 1]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.woodGrey);
	}
	// кухня
	stove(b, 3.95, 2.55, Math.PI);
	table(b, 2.45, 0.6, 0, { w: 0.8, d: 1.1 });
	chair(b, 1.75, 0.6, Math.PI / 2);
	chair(b, 3.15, 0.6, -Math.PI / 2);
	cabinet(b, 'Буфет', 4.45, -0.6, -Math.PI / 2, 1.1, 1.9, 0.5, { zhivchik: 0.35, ammo9: [3, 6, 0.4] }, IM.furnitureLight);
	fridge(b, 'Холодильник', 1.65, 3.05, Math.PI, { zhivchik: 0.5 });
	b.furniture(4.55, -2.9, -Math.PI / 2, [[0.5, 0.8, 0.4, 0, 0.4, 0, IM.furniture], [0.35, 0.3, 0.3, 0, 1.15, -0.02, IM.metal]], { solid: [0.5, 0.4] }); // рукомойник
	rug(b, 3.0, -2.6, 0, 1.2, 0.8, IM.rugBlue);
	// зал
	cabinet(b, 'Шкаф', 0.55, -3.25, 0, 1.1, 2.0, 0.55, { ammo9: [6, 10, 0.7], ammo12: [2, 4, 0.3] });
	drawers(b, 'Комод', -2.1, -3.3, 0, 1.2, 0.9, 0.45, { ammo9: [4, 8, 0.5], spore: 0.2 });
	sofa(b, -4.3, -1.5, Math.PI / 2);
	table(b, -2.3, -1.4, 0, { w: 1.0, d: 1.0, cloth: true });
	chair(b, -2.3, -2.25, 0);
	tv(b, 0.4, -0.15, Math.PI);
	rug(b, -2.3, -1.6, 0, 2.6, 1.8);
	// спальня
	bed(b, -3.9, 2.55, 0);
	drawers(b, 'Тумбочка', -2.95, 3.25, Math.PI, 0.5, 0.55, 0.45, { ammo9: [3, 6, 0.6] });
	chest(b, 'Сундук', 0.45, 3.2, Math.PI, { ammo9: [8, 12, 0.6], ammo12: [3, 6, 0.35], peas: 0.2, obrez: 0.06, axe: 0.06 });
	chair(b, -0.3, 1.0, Math.PI * 0.8);
	rug(b, -1.8, 1.9, Math.PI / 2, 1.6, 1.2, IM.rugBlue);
	return b.finish();
}

// ---------- Магазин «Продукты» ----------

/**
 * Магазин 9×13 м, вход с запада (−X локально), чёрный ход с востока. Торговый зал с прилавком,
 * стеллажами и холодильной витриной; подсобка с ящиками и сейфом.
 */
export function buildShop(ctx, { cx, cz }) {
	const W = 9, D = 13, H = 3.4;
	const b = new Building(ctx, { name: 'Shop', cx, cz, ry: 0, W, D, H, top: H + 0.35 });
	const { M } = ctx;
	const IM = b.IM;
	const t = 0.25, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('z', -hx, -hz - t / 2, hz + t / 2, { mat: M.whiteBrick, t, doors: [0], lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz - t / 2, hz + t / 2, { mat: M.whiteBrick, t, doors: [5.4], lining: IM.shopWall, side: -1 });
	b.wall('x', -hz, -hx + t / 2, hx - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx + t / 2, hx - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	// подсобка в южной части (+Z)
	b.wall('x', 3.0, -hx + t / 2, hx - t / 2, { mat: IM.shopWall, t: 0.15, doors: [2.6] });
	// плоская крыша
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	// вывеска, витрины с решётками, крыльцо
	const sign = new THREE.PlaneGeometry(7, 1.2);
	sign.rotateY(-Math.PI / 2); sign.translate(-hx - 0.06, H - 0.4, 0);
	b.top_(sign, M.shopSign);
	for (const dz of [-4, 4]) {
		const win = new THREE.PlaneGeometry(3, 1.6);
		win.rotateY(-Math.PI / 2); win.translate(-hx - t / 2 - 0.02, 1.7, dz);
		b.top_(win, M.glass);
		for (let k = -1.2; k <= 1.21; k += 0.4) b.top_(place(box(0.04, 1.6, 0.04), -hx - t / 2 - 0.07, 1.7, dz + k), M.metalDark);
	}
	b.lower(place(box(1.6, 0.25, 2.6, 1), -hx - 0.8, 0.125, 0), M.concrete);
	// торговый зал
	const shelf = (name, x, z, rot, loot) => b.container(name, x, z, rot, [
		[2.4, 1.9, 0.5, 0, 0.95, 0, IM.furnitureLight],
		...[0.45, 0.95, 1.45].map((y) => [2.3, 0.04, 0.48, 0, y, 0.02, IM.furniture]),
		[2.0, 0.22, 0.3, 0, 0.58, 0.05, IM.cans],
		[1.6, 0.25, 0.3, -0.2, 1.08, 0.05, IM.jars],
		[1.8, 0.22, 0.3, 0.15, 1.58, 0.05, IM.cans],
	], [2.4, 0.5], loot, 1.9);
	shelf('Стеллаж', -2.0, -6.05, 0, { zhivchik: 0.3, spore: 0.25 });
	shelf('Стеллаж', 1.6, -6.05, 0, { ammo9: [3, 5, 0.3], zhivchik: 0.25 });
	shelf('Стеллаж', 4.05, -2.6, -Math.PI / 2, { zhivchik: 0.35 });
	b.container('Прилавок', 1.4, -0.2, -Math.PI / 2, [
		[3.6, 1.0, 0.7, 0, 0.5, 0, IM.furniture],
		[3.7, 0.05, 0.8, 0, 1.02, 0, IM.furnitureLight],
		[0.45, 0.25, 0.35, 1.0, 1.17, 0.0, IM.black], // касса
	], [3.6, 0.7], { ammo9: [4, 7, 0.5], zhivchik: 0.3 }, 1.25);
	b.container('Витрина', -3.85, -2.8, Math.PI / 2, [
		[2.0, 1.1, 0.8, 0, 0.55, 0, IM.white],
		[1.9, 0.3, 0.7, 0, 1.25, 0, IM.jars],
	], [2.0, 0.8], { zhivchik: 0.6 }, 1.4);
	// подсобка
	const crate = (x, z, rot) => b.furniture(x, z, rot, [[0.8, 0.6, 0.6, 0, 0.3, 0, IM.crate], [0.8, 0.6, 0.6, 0.05, 0.9, 0, IM.crate]], { solid: [0.8, 0.6] });
	crate(-3.7, 5.9, 0); crate(-2.7, 5.9, 0.1);
	b.container('Ящики', -3.4, 4.0, Math.PI / 2, [[0.9, 0.7, 1.4, 0, 0.35, 0, IM.crate], [0.8, 0.5, 0.7, 0, 0.95, -0.3, IM.crate]], [0.9, 1.4], { ammo9: [5, 9, 0.7], spore: 0.3 }, 1.2);
	b.container('Сейф', 3.85, 3.6, -Math.PI / 2, [[0.7, 1.1, 0.6, 0, 0.55, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, IM.black]], [0.7, 0.6], { ammo9: [8, 12, 0.8], ammo545: [10, 20, 0.35] }, 1.1);
	return b.finish();
}

// ---------- Дачный домик ----------

/**
 * Дачный домик 6.4×5.2 м из досок: одна комната с буржуйкой, кроватью и столом. Вход — в передней
 * стене (−Z локально), справа. Тайники: шкаф, сундук, буфет. paint — цвет обшивки.
 */
export function buildDacha(ctx, { name, cx, cz, ry, rnd, variant = 0, paint }) {
	const W = 6.4, D = 5.2, H = 2.5;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 1.7 });
	const { M } = ctx;
	const IM = b.IM;
	const boards = paint ?? [M.woodGreen, M.woodBlue, M.woodYellow, M.woodGrey][variant % 4];
	const paper = IM.wallpaper[(variant + 1) % IM.wallpaper.length];
	const t = 0.16, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.03, 0), IM.floor, { cast: false });
	for (const [w, d, x, z] of [[W + 0.2, 0.2, 0, -hz], [W + 0.2, 0.2, 0, hz], [0.2, D + 0.2, -hx, 0], [0.2, D + 0.2, hx, 0]]) {
		b.lower(place(box(w, 0.3, d, 2), x, 0.15, z), M.concreteDark);
	}
	// крылечко
	b.lower(place(box(1.6, 0.2, 0.9), 1.7, 0.1, -hz - 0.55), M.wood);
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: boards, t, doors: [1.7], lining: paper, side: 1, sx: 1.2 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: boards, t, lining: paper, side: -1, sx: 1.2 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: boards, t, lining: paper, side: 1, sx: 1.2 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: boards, t, lining: paper, side: -1, sx: 1.2 });
	b.window('front', -1.4, { t }); b.window('back', 0.6, { t }); b.window('left', 0, { t });
	b.furniture(1.7 - 0.62, -hz + 0.08, -1.6, [[1.2, 1.95, 0.05, 0.6, 0.98, 0, M.wood]], { up: true }); // дверь открыта внутрь
	// двускатная крыша из ржавого или зелёного профлиста
	const rise = 1.4, slope = Math.hypot(hz + 0.45, rise);
	const roof = rnd() < 0.5 ? M.roofMetal : M.roofGreen;
	for (const s of [-1, 1]) {
		const g = box(W + 0.7, 0.07, slope, 2);
		place(g, 0, H + rise / 2, s * (hz + 0.45) / 2, 0, -s * Math.atan2(rise, hz + 0.45));
		b.top_(g, roof);
	}
	for (const sx of [-1, 1]) {
		const x = sx * (hx + 0.01);
		const a = [x, H, -hz], c = [x, H, hz], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...a, ...tp, ...c] : [...a, ...c, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 4, 1, D / 2, 0] : [0, 0, D / 2, 0, D / 4, 1]), 2));
		tri.computeVertexNormals();
		b.top_(tri, boards);
	}
	// буржуйка с трубой
	b.furniture(2.6, 1.7, 0, [[0.55, 0.6, 0.45, 0, 0.3, 0, IM.black], [0.14, 0.4, 0.14, 0, 0.8, -0.1, IM.metal]], { solid: [0.6, 0.5] });
	b.furniture(2.6, 1.6, 0, [[0.14, b.top - 0.9, 0.14, 0, 1.0 + (b.top - 0.9) / 2, 0, IM.metal]], { up: true });
	bed(b, -2.25, 1.35, 0);
	table(b, -0.2, 0.6, 0, { w: 0.9, d: 0.7, cloth: variant % 2 === 0 });
	chair(b, -0.2, -0.1, 0);
	rug(b, -0.6, 0.2, 0, 1.6, 1.1, variant % 2 ? IM.rug : IM.rugBlue);
	cabinet(b, 'Шкаф', -2.55, -2.2, 0, 1.0, 1.9, 0.5, { ammo9: [3, 6, 0.35], ammo12: [2, 5, 0.4], zhivchik: 0.2, axe: 0.08 });
	chest(b, 'Сундук', 0.9, 2.15, Math.PI, { ammo12: [4, 8, 0.45], spore: 0.15, peas: 0.1, obrez: 0.04 });
	cabinet(b, 'Буфет', 2.75, -0.6, -Math.PI / 2, 0.9, 1.5, 0.45, { zhivchik: 0.4, ammo9: [2, 4, 0.2] }, IM.furnitureLight);
	return b.finish();
}

// ---------- Сторожка садового товарищества ----------

/**
 * Кирпичная сторожка 7×5 м: топчан, стол сторожа, оружейный шкаф (охотничьи патроны, обрез),
 * сейф с автоматными патронами — подарок от уехавшего с кластером участкового.
 */
export function buildGuardhouse(ctx, { name = 'Guardhouse', cx, cz, ry = 0 }) {
	const W = 7, D = 5, H = 2.8;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.3 });
	const { M } = ctx;
	const IM = b.IM;
	const t = 0.25, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [-2.0], lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.window('front', 1.0, { t }); b.window('right', 0, { t });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	const sign = new THREE.PlaneGeometry(2.6, 0.5);
	sign.rotateY(Math.PI); sign.translate(1.0, H - 0.35, -hz - t / 2 - 0.02);
	b.top_(sign, ctx.M.guardSign ?? M.metalDark);
	b.lower(place(box(1.4, 0.2, 1.0), -2.0, 0.1, -hz - 0.6), M.concrete);
	table(b, 1.0, -1.6, 0, { w: 1.2, d: 0.6 });
	chair(b, 1.0, -1.0, Math.PI);
	b.furniture(-2.3, 1.6, 0, [[1.9, 0.35, 0.8, 0, 0.35, 0, IM.furniture], [1.8, 0.1, 0.75, 0, 0.56, 0, IM.blanket]], { solid: [1.9, 0.8] }); // топчан
	b.container('Оружейный шкаф', 3.1, 1.2, -Math.PI / 2, [
		[1.0, 1.8, 0.45, 0, 0.9, 0, IM.metal],
		[0.02, 1.7, 0.02, 0, 0.9, 0.23, IM.black],
		[0.05, 0.05, 0.04, 0.1, 1.0, 0.24, IM.black],
	], [1.0, 0.45], { ammo12: [6, 12, 0.85], obrez: 0.25, ammo9: [4, 8, 0.4] }, 1.8);
	b.container('Сейф', 3.1, -1.4, -Math.PI / 2, [[0.6, 0.9, 0.55, 0, 0.45, 0, IM.metal], [0.1, 0.1, 0.03, 0.12, 0.6, 0.28, IM.black]], [0.6, 0.55], { ammo545: [15, 30, 0.6], spore: 0.3 }, 0.9);
	return b.finish();
}
