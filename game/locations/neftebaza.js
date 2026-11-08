// Кластер «Нефтебаза»: перевалочная нефтебаза, которую Улей забрал целиком — с резервуарами, путями и АЗС у въезда.
// Север — резервуарный парк за забором: три обвалованных каре (земляные валы с проходами) — в западном четыре РВС,
// один выгорел дотла; в среднем два больших серебристых, в восточном — ржавый мазутный. От резервуаров на эстакадах
// идут трубы через служебную дорогу к насосной. Запад — сливная ж/д эстакада между двумя путями с нефтяными
// цистернами (пути уходят на юг, к станции), будка сливщика, у забора — нефтеловушка. Середина — насосная (зал
// с насосами, щитовая, бытовка), операторная, горизонтальные резервуары в бетонном бортике, дизель-генератор,
// мерники, контора с лабораторией, КПП главного въезда. Северо-восток — пожарная часть с каланчой. Юг — гаражи
// автоцистерн с бензовозами, станция налива под навесом, навес с бочками (тарный склад). Периметр — бетонный
// забор с колючкой: главные ворота на востоке (к Химмашу), служебные — к В/ч, на юге — к станции. Снаружи
// на востоке — трасса на север (к «Карьеру»), за ней АЗС с навесом и магазином и брошенная стоянка у дороги.
// Глубина (опасность 3): руберы в обваловке, топтуны водят стаи у насосной, гаражей и эстакады. Бочки с горючим
// рвутся от пули.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair, buildCheckpoint } from '../buildings.js';
import { addCar, bus, transformer } from '../props.js';
import { concreteFence, hazardBarrels, pipePile, barrier, billboard, sandbags } from '../props-industrial.js';

const Z = Math.PI / 2;
const ONE = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
// забор нефтебазы
const FX0 = -83, FX1 = 50, FZ0 = -83, FZ1 = 66;
// трасса вдоль востока (x 58…64); главная дорога (к Химмашу) и служебная (к В/ч) — вдоль X
const HX = 61, RZ1 = 30, RZ2 = -30;
// сливная эстакада (ось) и пути по сторонам, дорога к станции, внутренние проезды вдоль Z
const EX = -64, TX1 = EX - 4.5, TX2 = EX + 4.5, SX = -40, WX = -47, NX = 16;
// земляной вал обваловки: высота, низ, верх
const BH = 1.4, BW = 3.6, BT = 0.8;

// ---------- Помощники геометрии ----------

/** Матрица: сдвиг и поворот (Эйлер XYZ). */
const frame = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), ONE);
const cyl = (r0, r1, h, seg = 12, open = false) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);

/** UV цилиндра в метрах (tile — шаг текстуры); swap — u вдоль высоты (рёбра профлиста ложатся поясами-швами). */
function metricUV(g, around, along, tile = 1, swap = false) {
	const uv = g.attributes.uv;
	for (let i = 0; i < uv.count; i++) {
		const u = uv.getX(i) * around / tile, v = uv.getY(i) * along / tile;
		if (swap) uv.setXY(i, v, u); else uv.setXY(i, u, v);
	}
	return g;
}
/** Открытая труба вдоль X / Z (UV в метрах). */
const pipeX = (r, len, seg = 10) => metricUV(cyl(r, r, len, seg, true), 2 * Math.PI * r, len, 2).rotateZ(Z);
const pipeZ = (r, len, seg = 10) => metricUV(cyl(r, r, len, seg, true), 2 * Math.PI * r, len, 2).rotateX(Z);

/** Труба от точки a до точки b ([x, y, z]) в пачку kb. */
function pipeAB(kb, mat, a, b, r, seg = 10) {
	const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
	const g = metricUV(cyl(r, r, len, seg, true), 2 * Math.PI * r, len, 2);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
	kb.add(g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), mat);
}

/** Призма вдоль X с трапецией в сечении: низ wb, верх wt, высота h, торцы скошены (земляной вал). */
function ridge(len, h, wb, wt) {
	const g = box(len, h, wb, 3), p = g.attributes.position, inset = Math.min((wb - wt) / 2, len / 2 - 0.1);
	for (let i = 0; i < p.count; i++) {
		if (p.getY(i) < 0) continue;
		p.setZ(i, p.getZ(i) * wt / wb);
		p.setX(i, p.getX(i) - Math.sign(p.getX(i)) * inset);
	}
	g.translate(0, h / 2, 0);
	g.computeVertexNormals();
	return g;
}

/** Круг радиуса r — тремя коробками, вписанными в него (резервуар, колонна). */
function roundCollide(collide, x, z, r) {
	for (const [a, b] of [[0.924, 0.383], [0.707, 0.707], [0.383, 0.924]]) collide(x, z, 2 * r * a, 2 * r * b);
}

// ---------- Резервуары, трубы, пути ----------

/**
 * Вертикальный стальной резервуар (РВС) в точке x,z: радиус r, высота стенки h. Стенка поясами (рёбра профлиста
 * поперёк — сварные швы), кольцо жёсткости, крыша-конус с дыхательными клапанами и ограждением по краю, винтовая
 * лестница по стенке от угла a0 (у земли) на 130° вверх. burnt — горел: стенка в саже, крыша провалилась воронкой.
 * kb — пачка (occluder резервуара).
 */
function tankRVS(kb, M, x, z, r, h, { paint, a0 = 0, burnt = false, seg = 16 } = {}) {
	const shell = burnt ? M.tankBlack : paint;
	kb.add(metricUV(cyl(r, r, h, seg, true), 2 * Math.PI * r, h, 14, true).translate(x, h / 2, z), shell);
	const rh = Math.max(0.5, r * 0.13);
	if (burnt) {
		kb.add(cyl(r + 0.05, 0.9, rh * 2.2, seg, true).translate(x, h - rh * 1.1 + 0.05, z), M.tankBlack);
		// обрывки кровли по краю — листы задраны и смяты
		for (let i = 0; i < 5; i++) {
			const a = i * 1.37 + 0.4;
			kb.add(place(box(1.8, 0.05, 1.1), x + Math.cos(a) * (r - 0.6), h + 0.15, z + Math.sin(a) * (r - 0.6), -a, 0.3 * (i % 2 ? 1 : -1), 0.35), M.tankBlack);
		}
	} else {
		kb.add(metricUV(cyl(0.7, r + 0.12, rh, seg), 2 * Math.PI * r, r, 14, true).translate(x, h + rh / 2, z), paint);
		for (const [dx, dz] of [[0.35, 0.2], [-0.3, -0.45], [0.1, -0.6]]) kb.add(place(box(0.5, 0.6, 0.5), x + dx * r, h + rh * 0.45 + 0.3, z + dz * r), M.metalDark);
		kb.add(cyl(0.2, 0.2, 0.9, 8).translate(x, h + rh + 0.4, z), M.metalDark);
		// ограждение по краю крыши: поручень кольцом и стойки
		kb.add(new THREE.TorusGeometry(r - 0.1, 0.04, 3, seg * 2).rotateX(Z).translate(x, h + 1.05, z), M.metalDark);
		for (let i = 0; i < 10; i++) {
			const a = i * Math.PI / 5;
			kb.add(place(box(0.05, 1.0, 0.05), x + Math.cos(a) * (r - 0.1), h + 0.55, z + Math.sin(a) * (r - 0.1)), M.metalDark);
		}
	}
	kb.add(cyl(r + 0.16, r + 0.16, 0.24, seg, true).translate(x, h - 0.7, z), M.metalDark); // кольцо жёсткости
	kb.add(cyl(r + 0.08, r + 0.08, 0.4, seg, true).translate(x, 0.2, z), M.metalDark); // окрайка днища
	// винтовая лестница: наклонные марши по стенке, поручень снаружи, стойки; площадка наверху
	const n = Math.max(6, Math.round(h / 1.4)), span = 2.3, R = r + 0.5;
	for (let i = 0; i < n; i++) {
		const dth = span / n, th = a0 + dth * (i + 0.5), L = 2 * R * Math.sin(dth / 2), dy = h / n;
		const len = Math.hypot(L, dy), pitch = Math.atan2(dy, L), ry = Math.atan2(-Math.cos(th), -Math.sin(th)), ym = dy * (i + 0.5);
		kb.add(place(box(len, 0.07, 0.85), x + R * Math.cos(th), ym, z + R * Math.sin(th), ry, 0, pitch), M.metalDark);
		kb.add(place(box(len, 0.05, 0.05), x + (R + 0.42) * Math.cos(th), ym + 0.95, z + (R + 0.42) * Math.sin(th), ry, 0, pitch), M.metalDark);
		const t0 = a0 + dth * i;
		kb.add(place(box(0.05, 0.95, 0.05), x + (R + 0.42) * Math.cos(t0), dy * i + 0.48, z + (R + 0.42) * Math.sin(t0)), M.metalDark);
	}
	const te = a0 + span;
	kb.add(place(box(1.2, 0.08, 1.2), x + R * Math.cos(te), h, z + R * Math.sin(te), -te), M.metalDark);
}

/** Земляной вал от (x0,z0) до (x1,z1) — по оси X или Z; gaps — [середина, ширина] проходов. */
function bermLine(batch, M, collide, x0, z0, x1, z1, gaps = []) {
	const alongX = z0 === z1, k = alongX ? z0 : x0;
	const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
	const pieces = [];
	let cur = a0;
	for (const [g0, g1] of gaps.map(([c, w]) => [c - w / 2, c + w / 2]).sort((p, q) => p[0] - q[0])) {
		if (g0 > cur) pieces.push([cur, g0]);
		cur = Math.max(cur, g1);
	}
	if (cur < a1) pieces.push([cur, a1]);
	for (const [p0, p1] of pieces) {
		const len = p1 - p0, mid = (p0 + p1) / 2;
		if (alongX) { batch.add(place(ridge(len, BH, BW, BT), mid, 0, k), M.dirt); collide(mid, k, len, BW * 0.8); } else { batch.add(place(ridge(len, BH, BW, BT), k, 0, mid, Z), M.dirt); collide(k, mid, BW * 0.8, len); }
	}
}

/**
 * Трубопровод на Т-образных стойках по ломаной pts ([[x, z], …]) на высоте y; стойки — в изломах и через ~step м
 * (не на дорогах: avoid(x, z) — где ставить нельзя). Под трубой проходят, коллайдеры — стойки.
 */
function pipeLine(batch, M, collide, pts, { y = 4.4, r = 0.26, step = 6.5, mat = M.metalRust, avoid = () => false } = {}) {
	const post = (x, z) => {
		batch.add(place(box(0.24, y - 0.2, 0.24), x, (y - 0.2) / 2, z), M.metalDark);
		batch.add(place(box(0.7, 0.14, 0.7), x, y - r - 0.07, z), M.metalDark);
		collide(x, z, 0.4, 0.4);
	};
	for (let i = 0; i < pts.length - 1; i++) {
		const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / step));
		pipeAB(batch, mat, [ax, y, az], [bx, y, bz], r);
		for (let k = i === 0 ? 0 : 1; k <= n; k++) {
			const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
			if (!avoid(x, z)) post(x, z);
		}
	}
}

/**
 * Эстакада трубопроводов от (x0,z0) до (x1,z1): П-образные опоры высотой y через ~step м (не на дорогах — avoid),
 * на траверсах — трубы (первая в серебристой изоляции). Под трубами проходят; коллайдер — опора целиком.
 */
function pipeRack(batch, M, collide, x0, z0, x1, z1, { y = 4.4, step = 7, w = 1.8, pipes = 3, avoid = () => false } = {}) {
	const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), ry = -ang;
	const nx = -Math.sin(ang), nz = Math.cos(ang), n = Math.max(1, Math.round(len / step));
	for (let i = 0; i <= n; i++) {
		const px = x0 + (x1 - x0) * i / n, pz = z0 + (z1 - z0) * i / n;
		if (avoid(px, pz)) continue;
		for (const k of [-1, 1]) batch.add(place(box(0.22, y, 0.22), px + nx * k * w / 2, y / 2, pz + nz * k * w / 2, ry), M.metalRust);
		batch.add(place(box(0.24, 0.22, w + 0.3), px, y, pz, ry), M.metalRust);
		collide(px, pz, 0.4, w + 0.4, ry);
	}
	const mats = [M.silver, M.metalRust, M.metalDark], rs = [0.32, 0.22, 0.17];
	const ex = Math.cos(ang) * 0.5, ez = Math.sin(ang) * 0.5; // трубы чуть длиннее опор — стыкуются на углах
	for (let j = 0; j < pipes; j++) {
		const off = (j - (pipes - 1) / 2) * (w / pipes), r = rs[j];
		pipeAB(batch, mats[j], [x0 - ex + nx * off, y + 0.11 + r, z0 - ez + nz * off], [x1 + ex + nx * off, y + 0.11 + r, z1 + ez + nz * off], r);
	}
}

/** Ж/д путь вдоль Z от z0 до z1 на линии x: щебень, шпалы, рельсы (по путям ходят). */
function trackZ(batch, M, x, z0, z1) {
	const len = z1 - z0, cz = (z0 + z1) / 2;
	batch.add(place(box(3.0, 0.1, len, 2), x, 0.05, cz), M.ballast, { cast: false });
	for (let z = z0 + 0.35; z < z1; z += 0.7) batch.add(place(box(2.5, 0.1, 0.22), x, 0.12, z), M.sleeper, { cast: false });
	for (const dx of [-0.76, 0.76]) batch.add(place(box(0.08, 0.14, len), x + dx, 0.24, cz), M.rail, { cast: false });
}

/** Нефтяная ж/д цистерна вдоль Z (11,5 м): тележки, рама, котёл с днищами, колпак с площадкой, лесенки. */
function oilWagon(batch, M, collide, x, z, paint) {
	const L = 11.5;
	for (const bz of [-L / 2 + 1.7, L / 2 - 1.7]) {
		batch.add(place(box(2.0, 0.5, 2.4), x, 0.55, z + bz), M.metalDark);
		for (const wz of [-0.65, 0.65]) for (const wx of [-0.76, 0.76]) batch.add(place(cyl(0.45, 0.45, 0.14, 10).rotateZ(Z), x + wx, 0.45, z + bz + wz), M.rail);
	}
	batch.add(place(box(2.4, 0.3, L), x, 1.05, z), M.metalDark);
	batch.add(place(metricUV(cyl(1.5, 1.5, L - 0.9, 16, true), 9.4, L, 4).rotateX(Z), x, 2.65, z), paint);
	for (const e of [-1, 1]) batch.add(place(new THREE.SphereGeometry(1.5, 14, 5, 0, Math.PI * 2, 0, Z).scale(1, 0.3, 1).rotateX(e * Z), x, 2.65, z + e * (L - 0.9) / 2), paint);
	batch.add(place(cyl(0.6, 0.6, 0.55, 12), x, 4.35, z), paint); // колпак
	batch.add(place(box(1.5, 0.06, 1.8), x, 4.15, z), M.metalDark); // площадка у колпака
	for (const s of [-1, 1]) {
		batch.add(place(box(0.06, 0.9, 1.8), x + s * 0.75, 4.6, z), M.metalDark); // поручни
		for (const e of [-1, 1]) batch.add(place(box(0.5, 3.2, 0.06), x + s * 0.6, 2.6, z + e * (L / 2 - 0.1)), M.metalDark); // торцевые лесенки
	}
	collide(x, z, 3.0, L);
}

/** Тупиковый упор: бетонный блок с полосатым брусом поперёк пути (пути вдоль Z, путь кончается у z). */
function bufferStop(batch, M, collide, x, z) {
	batch.add(place(box(3.0, 1.2, 1.2, 1), x, 0.6, z - 0.6), M.concreteDark);
	for (let i = 0; i < 5; i++) batch.add(place(box(0.5, 0.3, 0.3), x - 1.0 + i * 0.5, 1.0, z + 0.1), i % 2 ? M.white : M.red);
	collide(x, z - 0.4, 3.0, 1.4);
}

/**
 * Сливная эстакада между путями (ось x, от z0 до z1): стойки через 6 м, настил на 4,5 м с перилами, лестницы
 * в торцах, коллектор под настилом; у каждой цистерны (slots — [z, слева есть, справа есть]) — стояк с рукавом
 * и откидной мостик на колпак. Настил закрывает героя от камеры — в occluder; стойки и лестницы — в общей пачке.
 */
function estakada(occluder, batch, M, collide, x, z0, z1, slots) {
	const Y = 4.5, n = Math.round((z1 - z0) / 6), cz = (z0 + z1) / 2, len = z1 - z0;
	for (let i = 0; i <= n; i++) {
		const z = z0 + len * i / n;
		for (const s of [-1, 1]) { batch.add(place(box(0.26, Y, 0.26), x + s * 1.1, Y / 2, z), M.metalRust); collide(x + s * 1.1, z, 0.4, 0.4); }
	}
	// лестницы в торцах: марш наружу от торца, поручни
	for (const [ze, dir] of [[z0, -1], [z1, 1]]) {
		const run = 5.2, sl = Math.hypot(Y, run), p = Math.atan2(Y, run);
		batch.add(place(box(1.0, 0.08, sl), x, Y / 2, ze + dir * run / 2, 0, dir * p), M.metalDark);
		for (const s of [-1, 1]) batch.add(place(box(0.05, 0.05, sl), x + s * 0.5, Y / 2 + 0.95, ze + dir * run / 2, 0, dir * p), M.hazard);
		collide(x, ze + dir * run / 2, 1.2, run);
	}
	occluder('Estakada', (kb) => {
		kb.add(place(box(2.8, 0.14, len + 0.4, 1.5), x, Y, cz), M.metalDark); // настил
		kb.add(place(box(2.6, 0.24, len), x, Y - 0.2, cz), M.metalRust); // балки
		for (const s of [-1, 1]) {
			kb.add(place(box(0.05, 0.05, len), x + s * 1.35, Y + 1.0, cz), M.hazard); // поручни
			kb.add(place(box(0.04, 0.04, len), x + s * 1.35, Y + 0.55, cz), M.hazard);
			for (let z = z0; z <= z1 + 0.01; z += 2) kb.add(place(box(0.05, 1.0, 0.05), x + s * 1.35, Y + 0.5, z), M.hazard);
		}
		kb.add(place(pipeZ(0.3, len, 12), x, Y - 0.6, cz), M.silver); // коллектор
		kb.add(place(pipeZ(0.18, len, 10), x - 0.6, Y - 0.55, cz), M.metalRust);
		for (const [zc, ...sides] of slots) {
			for (const [i, s] of [-1, 1].entries()) {
				if (!sides[i]) continue;
				const zs = zc + 0.45;
				kb.add(cyl(0.1, 0.1, 2.2, 8, true).translate(x + s * 1.2, Y + 1.0, zs), M.silver); // стояк
				kb.add(place(pipeX(0.09, 3.3, 8), x + s * 2.85, Y + 2.05, zs), M.silver); // рукав
				kb.add(cyl(0.09, 0.09, 1.7, 8, true).translate(x + s * 4.5, Y + 1.25, zs), M.silver); // в колпак
				kb.add(place(box(2.4, 0.06, 0.8), x + s * 2.7, Y + 0.12, zc - 0.3), M.metalDark); // откидной мостик
				for (const e of [-1, 1]) kb.add(place(box(2.4, 0.04, 0.04), x + s * 2.7, Y + 1.0, zc - 0.3 + e * 0.4), M.hazard);
			}
		}
	}, { cx: x, cz, ry: 0, hx: 1.7, hz: len / 2 + 0.5, top: Y + 2.3 }, 0.25);
}

/**
 * Грузовик с кабиной над мотором (вроде КамАЗа), нос — к +X своих осей. kind: 'fuel' — бензовоз с цистерной,
 * 'fire' — пожарная автоцистерна с лестницей на крыше. put(g, mat, m) — куда класть (m — матрица в осях машины).
 */
function truckParts(put, M, kind, cab, body) {
	put(box(8.0, 0.35, 1.0), M.metalDark, frame(-0.4, 0.95, 0)); // рама
	for (const wx of [2.9, -1.8, -3.1]) for (const s of [-1, 1]) put(cyl(0.55, 0.55, 0.42, 12).rotateX(Z), M.tire, frame(wx, 0.55, s * 1.0));
	put(box(2.0, 2.0, 2.45, 1.5), cab, frame(3.1, 2.15, 0)); // кабина
	put(box(0.05, 0.85, 2.2), M.glass, frame(4.11, 2.6, 0));
	for (const s of [-1, 1]) put(box(0.9, 0.7, 0.04), M.glass, frame(3.4, 2.6, s * 1.23));
	put(box(0.22, 0.35, 2.4), M.metalDark, frame(4.15, 1.25, 0)); // бампер
	put(box(1.9, 0.12, 2.35), M.metalDark, frame(3.0, 3.22, 0)); // козырёк
	if (kind === 'fuel') {
		const ell = (g) => g.scale(1, 0.82, 1.08);
		put(ell(cyl(1.15, 1.15, 5.4, 16, true).rotateZ(Z)), body, frame(-0.9, 2.35, 0));
		for (const e of [-1, 1]) put(ell(new THREE.SphereGeometry(1.15, 12, 5, 0, Math.PI * 2, 0, Z).scale(1, 0.25, 1).rotateZ(-e * Z)), body, frame(-0.9 + e * 2.7, 2.35, 0));
		for (const bx of [-2.6, 0.8]) put(ell(cyl(1.18, 1.18, 0.12, 16, true).rotateZ(Z)), M.metalDark, frame(bx, 2.35, 0)); // пояса
		put(box(0.9, 0.25, 0.7), M.metalDark, frame(-0.9, 3.33, 0)); // горловина
		put(box(5.0, 0.05, 0.5), M.metalDark, frame(-0.9, 3.36, 0)); // мостик по верху
		put(box(0.7, 0.35, 2.2), M.metalDark, frame(-3.9, 1.35, 0)); // отсек с рукавами
		for (const s of [-1, 1]) put(box(0.25, 0.5, 0.15), M.red, frame(-4.3, 1.2, s * 0.95)); // фонари
	} else {
		put(box(5.6, 2.1, 2.45, 1.5), body, frame(-1.0, 2.2, 0)); // кузов
		for (const s of [-1, 1]) {
			for (const bx of [-2.6, -0.8, 1.0]) put(box(1.6, 1.5, 0.03), M.silver, frame(bx, 2.15, s * 1.235)); // шторки отсеков
			put(box(5.6, 0.16, 0.03), M.white, frame(-1.0, 1.3, s * 1.24)); // полоса
			put(box(1.9, 0.16, 0.03), M.white, frame(3.1, 1.8, s * 1.24));
			put(box(5.2, 0.08, 0.06), M.silver, frame(-0.8, 3.45, s * 0.38)); // лестница на крыше
		}
		for (let i = 0; i < 11; i++) put(box(0.05, 0.05, 0.76), M.silver, frame(-3.1 + i * 0.46, 3.45, 0));
		put(box(0.5, 0.35, 0.6), M.metalDark, frame(1.5, 3.45, 0)); // лафетный ствол
		put(box(1.0, 0.18, 0.3), M.white, frame(3.2, 3.36, 0)); // мигалка
	}
}

/** Грузовик в пачку локации и коллайдер; ry — куда смотрит нос. */
function truck(batch, M, collide, x, z, ry, kind, cab, body, tilt = 0) {
	const F = frame(x, 0, z, ry, tilt);
	truckParts((g, mat, m) => batch.add(g.applyMatrix4(m).applyMatrix4(F), mat), M, kind, cab, body);
	collide(x + Math.cos(ry) * 0.1, z - Math.sin(ry) * 0.1, 8.7, 2.7, ry);
}

/** Пожарный щит: красная доска с инструментом на двух стойках и ящик с песком перед ней (лицом в ry). */
function fireShield(batch, M, collide, x, z, ry) {
	const c = Math.cos(ry), s = Math.sin(ry), put = (g, lx, y, lz, mat) => batch.add(place(g, x + lx * c + lz * s, y, z - lx * s + lz * c, ry), mat);
	put(box(1.4, 1.3, 0.06), 0, 1.25, 0, M.red);
	for (const lx of [-0.65, 0.65]) put(box(0.08, 1.9, 0.08), lx, 0.95, -0.05, M.metalDark);
	for (const [lx, w, h] of [[-0.4, 0.08, 1.0], [0, 0.3, 0.6], [0.4, 0.12, 0.9]]) put(box(w, h, 0.05), lx, 1.25, 0.06, M.metalDark);
	put(box(1.0, 0.6, 0.5), 0, 0.3, 0.6, M.red);
	collide(x + 0.3 * s, z + 0.3 * c, 1.5, 1.0, ry);
}

// ---------- Мебель-тайники ----------

/** Металлический шкафчик (лицо — +Z своих осей). */
const locker = (b, name, x, z, rot, loot, w = 0.85) => b.container(name, x, z, rot, [
	[w, 1.9, 0.5, 0, 0.95, 0, b.IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.26, b.IM.black], [0.25, 0.04, 0.02, w * 0.25, 1.7, 0.26, b.IM.black],
], [w, 0.5], loot, 1.9);
/** Сейф. */
const safe = (b, name, x, z, rot, loot, h = 1.1) => b.container(name, x, z, rot, [
	[0.7, h, 0.6, 0, h / 2, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, h * 0.64, 0.31, b.IM.black], [0.03, 0.2, 0.03, -0.2, h * 0.64, 0.31, b.IM.black],
], [0.7, 0.6], loot, h);
/** Верстак с тисками и инструментом. */
const bench = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[2.0, 0.08, 0.8, 0, 0.9, 0, b.IM.furniture], [1.9, 0.5, 0.7, 0, 0.3, 0, b.IM.machine], [0.3, 0.25, 0.3, -0.6, 1.06, -0.15, b.IM.metal],
	[0.5, 0.2, 0.3, 0.5, 1.04, 0.1, b.IM.redBoard], [1.9, 0.8, 0.02, 0, 1.7, -0.38, b.IM.rack],
], [2.0, 0.8], loot, 1.0);
/** Стеллаж шириной w с ящиками и канистрами. */
const shelf = (b, name, x, z, rot, w, loot, cans = b.IM.redBoard) => b.container(name, x, z, rot, [
	...[-w / 2 + 0.05, w / 2 - 0.05].flatMap((dx) => [-0.25, 0.25].map((dz) => [0.06, 2.0, 0.06, dx, 1.0, dz, b.IM.rack])),
	...[0.15, 0.85, 1.55].map((y) => [w, 0.04, 0.6, 0, y, 0, b.IM.rack]),
	[w * 0.35, 0.5, 0.45, -w * 0.25, 0.42, 0, b.IM.crate], [w * 0.3, 0.45, 0.4, w * 0.22, 0.4, 0, cans],
	[w * 0.4, 0.45, 0.45, w * 0.15, 1.1, 0, b.IM.crateGreen], [w * 0.25, 0.4, 0.4, -w * 0.3, 1.08, 0, cans], [w * 0.5, 0.35, 0.45, 0, 1.75, 0, b.IM.crate],
], [w, 0.6], loot, 2.0);
/** Стол с телефоном и бумагами. */
const desk = (b, name, x, z, rot, loot, w = 1.3) => b.container(name, x, z, rot, [
	[w, 0.75, 0.7, 0, 0.375, 0, b.IM.furniture], [0.35, 0.12, 0.25, w * 0.25, 0.81, -0.1, b.IM.black], [0.5, 0.01, 0.35, -w * 0.15, 0.755, 0.05, b.IM.paper],
], [w, 0.7], loot, 0.9);

// ---------- Постройки, в которые можно зайти ----------

/**
 * Насосная 22×11 м из кирпича: машинный зал с четырьмя насосными агрегатами вдоль северной стены (над ними
 * коллектор, в который входят трубы от резервуаров), в восточном торце — щитовая (шкаф КИП, электрощит) и бытовка
 * (шкафчики, сейф мастера). Двери — с юга (в зал и в бытовку) и с запада.
 */
function buildPumpStation(ctx, { name, cx, cz }) {
	const W = 22, D = 11, H = 5.2, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.8 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.factoryWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-4, 8], w: 1.6, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [1.5], side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 5, -hz + t / 2, hz - t / 2, { mat: IM.factoryWall, t: 0.15, doors: [-2.6] });
	b.wall('x', 0.4, 5, hx - t / 2, { mat: IM.factoryWall, t: 0.15 });
	const sill = M.brick;
	for (const x of [-8, 0.5, 3]) b.window('back', x, { y: 3.4, t, sill });
	for (const x of [-8.5, -4, 0.5, 8]) b.window('front', x, { y: 3.6, t, sill });
	b.window('left', -2.5, { y: 3.4, t, sill });
	for (const z of [-2.6, 2.8]) b.window('right', z, { y: 3.4, t, sill });
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.brick, 0.4);
	for (const [x, z] of [[-7, -2], [-1, 2.5], [8, -2]]) b.vent(x, z, H + 0.3, M.silver);
	b.canopy('back', -4, { w: 2.6, d: 1.3, y: 2.6, mat: M.metalRust, t });
	b.canopy('back', 8, { w: 1.9, d: 1.0, y: 2.5, mat: M.metalRust, t });
	b.wallBox('back', -4 + 1.35, 1.1, 0.02, 2.05, 0.05, M.metalRust, { t }); // двери распахнуты к стене
	b.wallBox('left', 1.5 - 1.15, 1.0, 0.02, 2.05, 0.05, M.metalRust, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(4.2, 0.7).translate(0, H - 0.75, 0.03), 'back', -4, t), T.signMaterial('НАСОСНАЯ № 2', { bg: '#2a2c26', fg: '#e8dcae', w: 512, h: 86 }));
	// насосные агрегаты: рама, мотор, муфта, корпус насоса, патрубок вверх к коллектору
	for (const x of [-8.6, -5.1, -1.6, 1.9]) {
		b.furniture(x, -3.5, 0, [
			[2.6, 0.3, 1.1, 0, 0.15, 0, IM.machine],
			[0, 0, 0, 0, 0, 0, M.green, { geo: cyl(0.42, 0.42, 1.2, 12).rotateZ(Z).translate(-0.6, 0.78, 0) }],
			[0, 0, 0, 0, 0, 0, IM.metal, { geo: cyl(0.14, 0.14, 0.4, 8).rotateZ(Z).translate(0.15, 0.78, 0) }],
			[0.8, 0.85, 0.8, 0.75, 0.73, 0, IM.machine],
			[0, 0, 0, 0, 0, 0, M.metalRust, { geo: cyl(0.16, 0.16, 2.9, 8).translate(0.75, 2.5, -0.25) }],
			[0, 0, 0, 0, 0, 0, M.metalRust, { geo: cyl(0.16, 0.16, 1.0, 8).rotateZ(Z).translate(1.6, 0.7, 0) }],
		], { solid: [2.7, 1.3] });
	}
	b.furniture(-2.9, -4.85, 0, [[0, 0, 0, 0, 0, 0, M.metalRust, { geo: cyl(0.22, 0.22, 15.4, 10).rotateZ(Z).translate(0, 0.45, 0) }]], { solid: [15.4, 0.6] }); // всасывающая труба у стены
	b.top_(place(pipeX(0.3, 15.6, 12), -3.0, 3.4, -4.2), M.metalRust); // напорный коллектор под потолком
	// тайники зала: ящик ЗИП у западной стены, верстак и шкаф с инструментом у южной
	b.container('Ящик с ЗИП', -hx + 0.55, 3.9, Z, [[1.2, 0.7, 0.8, 0, 0.35, 0, IM.crateGreen], [1.22, 0.05, 0.82, 0, 0.72, 0, IM.machine], [0.4, 0.3, 0.3, 0.2, 0.9, 0, IM.metal]], [1.2, 0.8], { ammo545: [8, 16, 0.45], ammo12: [4, 8, 0.35], zhivchik: 0.2, grenade: 0.05 }, 1.0);
	bench(b, 'Верстак', -8.6, hz - 0.55, Math.PI, { ammo762: [8, 16, 0.4], ammo919: [6, 12, 0.35], spore: [1, 2, 0.3] });
	locker(b, 'Шкаф с инструментом', 0.6, hz - 0.4, Math.PI, { ammo545: [6, 12, 0.4], fireaxe: 0.08, zhivchik: 0.25 }, 1.0);
	pipeStack(b, IM);
	// щитовая: шкаф КИП, электрощит
	b.container('Шкаф КИП', 7.4, -hz + 0.4, 0, [[1.6, 2.0, 0.5, 0, 1.0, 0, IM.machine], [0.02, 1.9, 0.02, 0, 1.0, 0.26, IM.black], [0.5, 0.3, 0.02, -0.4, 1.4, 0.26, IM.screen], [0.5, 0.3, 0.02, 0.4, 1.4, 0.26, IM.screen]], [1.6, 0.5], { ammo919: [6, 12, 0.45], spore: [1, 3, 0.35], zhivchik: 0.2 }, 2.0);
	b.container('Электрощит', hx - 0.4, -2.6, -Z, [[1.4, 1.9, 0.45, 0, 0.95, 0, IM.locker], [0.02, 1.8, 0.02, 0, 0.95, 0.23, IM.black], [0.08, 0.08, 0.04, 0.4, 1.2, 0.24, IM.redBoard]], [1.4, 0.45], { ammo556: [5, 10, 0.3], grenade: 0.06, spore: 0.2 }, 1.9);
	// бытовка: шкафчики, сейф мастера, стол
	locker(b, 'Шкафчик', 5.45, 1.5, Z, { ammo545: [5, 10, 0.4], zhivchik: 0.25, spore: 0.15 });
	locker(b, 'Шкафчик', 5.45, 2.45, Z, { ammo919: [4, 8, 0.4], ammo12: [3, 6, 0.3], zhivchik: 0.2 });
	safe(b, 'Сейф мастера', hx - 0.45, 1.6, -Z, { ammo545: [15, 30, 0.55], ammo76254: [5, 10, 0.25], spore: [2, 4, 0.5], deagle: 0.06 });
	table(b, 6.4, 4.4, 0, { w: 1.0, d: 0.7 });
	chair(b, 6.4, 3.75, Math.PI);
	return b.finish();
}

/** Штабель запасных труб на подкладках у восточной перегородки зала (не тайник). */
function pipeStack(b, IM) {
	b.furniture(3.4, 2.8, Z, [
		[2.8, 0.12, 0.2, 0, 0.06, -0.5, IM.crate], [2.8, 0.12, 0.2, 0, 0.06, 0.5, IM.crate],
		...[-0.6, -0.2, 0.2, 0.6].map((dx) => [0, 0, 0, 0, 0, 0, b.ctx.M.metalRust, { geo: cyl(0.17, 0.17, 2.4, 8).rotateX(Z).translate(dx, 0.3, 0) }]),
		...[-0.4, 0, 0.4].map((dx) => [0, 0, 0, 0, 0, 0, b.ctx.M.metalRust, { geo: cyl(0.17, 0.17, 2.4, 8).rotateX(Z).translate(dx, 0.62, 0) }]),
	], { solid: [2.8, 2.4] });
}

/**
 * Операторная 12×8 м: пульты операторов вдоль северной стены под мнемосхемой резервуарного парка, сейф начальника
 * смены, шкаф с документами, стол. Вход с юга.
 */
function buildOperator(ctx, { name, cx, cz }) {
	const W = 12, D = 8, H = 3.3, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-3.5], side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	for (const x of [-0.5, 3]) b.window('back', x, { t, sill: M.whiteBrick });
	for (const x of [-4, 4]) b.window('front', x, { t, sill: M.whiteBrick });
	b.window('left', 0.5, { t, sill: M.whiteBrick });
	b.window('right', -1.5, { t, sill: M.whiteBrick });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.parapet(H + 0.25, M.whiteBrick, 0.3);
	b.vent(-3.5, 1.5, H + 0.25, M.silver, { h: 0.5, r: 0.12 });
	b.top_(place(box(0.08, 3.5, 0.08), 4.5, H + 2.0, -2.5), M.metalDark); // антенна
	b.canopy('back', -3.5, { w: 1.8, d: 1.0, y: 2.45, mat: M.roofTar, t });
	b.wallBox('back', -3.5 + 1.1, 0.95, 0.02, 2.05, 0.05, M.metalOlive, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(3.2, 0.55).translate(0, H - 0.45, 0.03), 'back', 1.2, t), T.signMaterial('ОПЕРАТОРНАЯ', { bg: '#e8e4d8', fg: '#1d3f7a', w: 512, h: 88 }));
	// мнемосхема на северной стене — над пультами
	b.top_(place(box(5.2, 1.3, 0.04), -0.2, 2.1, -hz + t / 2 + 0.04), IM.screen);
	const console = (x, loot) => b.container('Пульт оператора', x, -hz + 0.6, 0, [
		[2.0, 0.08, 0.85, 0, 0.78, 0, IM.furniture], [0.08, 0.75, 0.75, -0.95, 0.38, 0, IM.furniture], [0.08, 0.75, 0.75, 0.95, 0.38, 0, IM.furniture],
		[1.9, 0.42, 0.36, 0, 1.0, -0.22, IM.machine], [0.6, 0.3, 0.03, -0.45, 1.05, -0.03, IM.screen], [0.5, 0.26, 0.03, 0.4, 1.03, -0.03, IM.screen],
	], [2.0, 0.85], loot, 1.15);
	console(-1.4, { ammo919: [6, 12, 0.5], zhivchik: 0.3, spore: [1, 2, 0.3] });
	console(1.0, { ammo545: [6, 12, 0.4], zhivchik: 0.25, ammo556: [5, 10, 0.2] });
	chair(b, -1.4, -hz + 1.75, Math.PI);
	chair(b, 1.0, -hz + 1.75, Math.PI);
	safe(b, 'Сейф начальника смены', hx - 0.45, 2.2, -Z, { ammo919: [8, 16, 0.6], glock17: 0.12, spore: [2, 5, 0.5], grenade: 0.06 }, 1.2);
	b.container('Шкаф с документами', -hx + 0.35, 1.4, Z, [[1.2, 1.9, 0.45, 0, 0.95, 0, IM.furnitureLight], [0.02, 1.8, 0.02, 0, 0.95, 0.23, IM.black], [1.1, 0.25, 0.35, 0, 1.45, 0.05, IM.paper]], [1.2, 0.45], { ammo12: [4, 8, 0.35], zhivchik: 0.3, ammo919: [4, 8, 0.3] }, 1.9);
	table(b, 1.6, 2.0, 0, { w: 1.2, d: 0.8 });
	chair(b, 1.6, 2.7, Math.PI);
	return b.finish();
}

/**
 * Контора с лабораторией 16×9 м под двускатной крышей: посередине — бухгалтерия (стол, шкаф с документами), слева —
 * лаборатория ГСМ (лабораторный стол с колбами, вытяжной шкаф, шкаф с реактивами), справа — кабинет директора
 * (стол, шкаф, сейф). Вход с юга, из бухгалтерии двери в обе комнаты.
 */
function buildOffice(ctx, { name, cx, cz }) {
	const W = 16, D = 9, H = 3.3, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 1.8 });
	b.messKind = 'home';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.plaster, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0], side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', -3, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [2.4] });
	b.wall('z', 3, -hz + t / 2, hz - t / 2, { mat: IM.wallpaper[1], t: 0.15, doors: [2.4] });
	for (const x of [-5.5, 2.0, 5.5]) b.window('back', x, { t, sill: M.whiteBrick });
	for (const x of [-5.5, 0, 5.5]) b.window('front', x, { t, sill: M.whiteBrick });
	b.window('left', 0, { t, sill: M.whiteBrick });
	b.window('right', -1, { t, sill: M.whiteBrick });
	// двускатная крыша вдоль X, фронтоны
	const rise = 1.5, slope = Math.hypot(hz + 0.5, rise);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.8, 0.08, slope, 2), 0, H + rise / 2, s * (hz + 0.5) / 2, 0, s * Math.atan2(rise, hz + 0.5)), M.roofGreen);
	for (const sx of [-1, 1]) {
		const x = sx * (hx + t / 2 + 0.01), a = [x, H, -hz - t / 2], c = [x, H, hz + t / 2], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...a, ...tp, ...c] : [...a, ...c, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 3, rise / 1.5, D / 1.5, 0] : [0, 0, D / 1.5, 0, D / 3, rise / 1.5]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.plaster);
	}
	b.top_(place(box(W + 0.84, 0.1, 0.26), 0, H + rise + 0.04, 0), M.metalRust);
	b.canopy('back', 0, { w: 2.4, d: 1.2, y: 2.5, mat: M.roofGreen, posts: M.metalDark, t });
	b.lower(place(box(2.2, 0.15, 0.9), 0, 0.075, hz + 0.6), M.concrete);
	b.wallBox('back', 0.95, 0.9, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(5.6, 0.5).translate(0, H - 0.35, 0.03), 'back', -4.2, t), T.signMaterial('КОНТОРА · ЛАБОРАТОРИЯ ГСМ', { bg: '#1d3f7a', fg: '#f0f0e8', w: 640, h: 58 }));
	// лаборатория
	b.container('Лабораторный стол', -6.2, -hz + 0.5, 0, [
		[2.0, 0.85, 0.75, 0, 0.42, 0, IM.white], [2.05, 0.05, 0.8, 0, 0.87, 0, IM.black],
		...[-0.6, -0.3, 0.1, 0.5].map((dx, i) => [0.1, 0.25 + (i % 2) * 0.1, 0.1, dx, 1.0, -0.1, IM.glass]), [1.9, 0.6, 0.25, 0, 1.5, -0.25, IM.furnitureLight],
	], [2.0, 0.75], { zhivchik: [1, 2, 0.55], spore: [1, 3, 0.35] }, 1.2);
	b.furniture(-4.0, -hz + 0.45, 0, [[1.2, 0.9, 0.7, 0, 0.45, 0, IM.white], [1.2, 1.1, 0.7, 0, 1.45, 0, IM.glass], [1.25, 0.25, 0.75, 0, 2.15, 0, IM.white], [0.25, 0.6, 0.25, 0, 2.6, 0, IM.metal]], { solid: [1.2, 0.7] }); // вытяжной шкаф
	b.container('Шкаф с реактивами', -hx + 0.35, 1.2, Z, [[1.2, 1.9, 0.45, 0, 0.95, 0, IM.white], [1.1, 0.7, 0.03, 0, 1.4, 0.23, IM.glass], ...[0.15, 0.45].map((y) => [1.1, 0.04, 0.4, 0, 1.2 + y, 0, IM.furniture])], [1.2, 0.45], { zhivchik: [1, 2, 0.5], grenade: 0.05, spore: 0.3 }, 1.9);
	chair(b, -6.2, -hz + 1.5, Math.PI);
	// бухгалтерия
	desk(b, 'Стол бухгалтера', -1.2, -hz + 0.55, 0, { ammo919: [4, 8, 0.4], spore: [1, 3, 0.4], zhivchik: 0.2 });
	chair(b, -1.2, -hz + 1.4, Math.PI);
	b.container('Шкаф с документами', 1.6, -hz + 0.35, 0, [[1.4, 1.9, 0.45, 0, 0.95, 0, IM.furniture], [0.02, 1.8, 0.02, 0, 0.95, 0.23, IM.black], [1.3, 0.3, 0.35, 0, 1.4, 0.03, IM.paper]], [1.4, 0.45], { ammo12: [4, 8, 0.35], ammo919: [3, 6, 0.3], zhivchik: 0.2 }, 1.9);
	// кабинет директора
	table(b, 5.6, -1.2, 0, { w: 1.6, d: 0.9 });
	chair(b, 5.6, -2.1, 0);
	safe(b, 'Сейф директора', hx - 0.45, 2.4, -Z, { spore: [3, 7, 0.6], ammo50: [4, 8, 0.35], deagle: 0.1, ammo545: [10, 20, 0.4] }, 1.2);
	b.container('Шкаф', 5.0, -hz + 0.35, 0, [[1.2, 2.0, 0.55, 0, 1.0, 0, IM.furniture], [0.02, 1.9, 0.02, 0, 1.0, 0.28, IM.black]], [1.2, 0.55], { ammo12: [4, 8, 0.4], dbarrel: 0.08, zhivchik: 0.2 }, 2.0);
	return b.finish();
}

/**
 * Пожарная часть 16×10 м: два бокса (в первом — пожарная автоцистерна, во втором — стеллаж с рукавами и ящик),
 * в торце — дежурка (шкафчики, аптечка, стол). Ворота — к служебной дороге (ry = π: перед — к +Z мира).
 */
function buildFireDepot(ctx, { name, cx, cz, ry }) {
	const W = 16, D = 10, H = 5.0, t = 0.3, hx = W / 2, hz = D / 2, GH = 4.0;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.5 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	// перед: два проёма ворот (до 4 м) с перемычками и дверь в дежурку
	b.wall('x', -hz, -hx - t / 2, -6.4, { ...wo, side: 1 });
	b.wall('x', -hz, -2.6, -0.4, { ...wo, side: 1 });
	b.wall('x', -hz, 3.4, hx + t / 2, { ...wo, doors: [6], w: 1.2, side: 1 });
	for (const gx of [-4.5, 1.5]) b.top_(place(box(3.8, H - GH, t, 1.5), gx, (GH + H) / 2, -hz), M.whiteBrick);
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 4.6, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15, doors: [2.6] });
	for (const x of [-4.5, 1.5]) b.window('back', x, { y: 3.2, t, sill: M.whiteBrick });
	b.window('right', 1.5, { t, sill: M.whiteBrick });
	b.window('left', 0, { y: 3.2, t, sill: M.whiteBrick });
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.whiteBrick, 0.35);
	b.vent(5.5, 2, H + 0.3, M.silver);
	// красные створки ворот распахнуты к стене, вывеска над воротами
	for (const gx of [-4.5, 1.5]) for (const s of [-1, 1]) b.wallBox('front', gx + s * 2.55, 1.6, 0.02, GH - 0.1, 0.07, M.red, { t });
	b.top_(b.onWall(new THREE.PlaneGeometry(7.5, 0.6).translate(0, H - 0.5, 0.03), 'front', -1.5, t), T.signMaterial('ПОЖАРНАЯ ЧАСТЬ', { bg: '#9a2a20', fg: '#f4f0e0', w: 512, h: 42 }));
	// автоцистерна в первом боксе (нос — к воротам)
	const truckF = frame(-4.5, 0, -0.2, Z);
	truckParts((g, mat, m) => b.lower(g.applyMatrix4(m).applyMatrix4(truckF), mat), M, 'fire', M.red, M.red);
	b.collide(-4.5, -0.2, 8.7, 2.7, Z);
	b.solids.push([-4.5, -0.2, 8.7, 2.7, Z]);
	// второй бокс: стеллаж с рукавами, ящик; дежурка: шкафчики, аптечка, стол
	b.container('Стеллаж с рукавами', 1.4, hz - 0.45, Math.PI, [
		...[-1.2, 1.2].map((dx) => [0.06, 2.0, 0.6, dx, 1.0, 0, IM.rack]), ...[0.4, 1.1, 1.8].map((y) => [2.4, 0.04, 0.6, 0, y, 0, IM.rack]),
		...[-0.7, 0, 0.7].flatMap((dx) => [0.32, 1.08].map((y) => [0, 0, 0, 0, 0, 0, IM.white, { geo: new THREE.TorusGeometry(0.25, 0.08, 4, 10).translate(dx, y + 0.3, 0) }])),
	], [2.4, 0.6], { fireaxe: 0.3, ammo12: [4, 8, 0.35], zhivchik: 0.3 }, 2.0);
	b.container('Ящик', 3.8, -1.8, -Z, [[1.2, 0.8, 0.8, 0, 0.4, 0, IM.redBoard], [1.22, 0.05, 0.82, 0, 0.82, 0, IM.black]], [1.2, 0.8], { grenade: 0.07, ammo545: [6, 12, 0.35], spore: [1, 2, 0.3] }, 0.9);
	locker(b, 'Шкафчик', 5.5, hz - 0.35, Math.PI, { ammo545: [5, 10, 0.4], zhivchik: 0.25, spore: 0.15 });
	locker(b, 'Шкафчик', 6.45, hz - 0.35, Math.PI, { ammo919: [4, 8, 0.4], ammo12: [3, 6, 0.35], zhivchik: 0.2 });
	b.container('Аптечка', hx - 0.2, -1.6, -Z, [[0.6, 0.5, 0.22, 0, 1.4, 0, IM.white], [0.24, 0.06, 0.01, 0, 1.4, 0.115, IM.redBoard], [0.06, 0.24, 0.01, 0, 1.4, 0.116, IM.redBoard]], [0.4, 0.2], { zhivchik: [1, 2, 0.75] }, 1.65);
	table(b, 6.3, 0.6, 0, { w: 1.0, d: 0.7 });
	chair(b, 6.3, 1.3, Math.PI);
	b.furniture(-hx + 0.15, 3.0, Z, [[1.4, 1.2, 0.05, 0, 1.4, 0, IM.redBoard]], { solid: [0, 0] }); // щит с инструментом
	return b.finish();
}

/**
 * Гаражи автоцистерн 30×12 м: четыре бокса с воротами на север (к главной дороге), между боксами — перегородки
 * с дверями. В первом и третьем — бензовозы, во втором — смотровая яма, верстак и шкаф, в четвёртом — мастерская
 * (верстак, сейф механика, шины). Сбоку — дверь в мастерскую.
 */
function buildGarage(ctx, { name, cx, cz }) {
	const W = 30, D = 12, H = 5.4, t = 0.3, hx = W / 2, hz = D / 2, GH = 4.3, GW = 4.4;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.factoryWall, sx: 2 };
	const gates = [-11.25, -3.75, 3.75, 11.25];
	let cur = -hx - t / 2;
	for (const gx of gates) { b.wall('x', -hz, cur, gx - GW / 2, { ...wo, side: 1 }); b.top_(place(box(GW, H - GH, t, 1.5), gx, (GH + H) / 2, -hz), M.concreteDark); cur = gx + GW / 2; }
	b.wall('x', -hz, cur, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [3], side: -1 });
	for (const x of [-7.5, 0, 7.5]) b.wall('z', x, -hz + t / 2, hz - t / 2, { mat: IM.factoryWall, t: 0.18, doors: [4.2], w: 1.1 });
	for (const x of [-11.25, -3.75, 3.75, 11.25]) b.window('back', x, { y: 3.4, t, sill: M.concrete });
	b.window('right', -2, { y: 3.2, t, sill: M.concrete });
	// плоская кровля из профлиста с небольшим скатом назад, дефлекторы
	b.top_(place(box(W + 0.6, 0.18, D + 0.8, 2), 0, H + 0.15, 0, 0, -0.03), M.roofMetal);
	for (const x of [-11, -4, 4, 11]) b.vent(x, 1, H + 0.3, M.silver, { h: 0.6, r: 0.16 });
	// ворота: в первом и третьем боксах подняты (секции под перемычкой), во втором и четвёртом распахнуты
	for (const [i, gx] of gates.entries()) {
		if (i % 2 === 0) b.top_(place(box(GW - 0.2, 0.5, 0.25), gx, GH - 0.3, -hz + 0.3), M.metalOlive);
		else for (const s of [-1, 1]) b.wallBox('front', gx + s * (GW / 2 + 1.1), 2.2, 0.02, GH - 0.1, 0.07, M.metalOlive, { t });
	}
	b.top_(b.onWall(new THREE.PlaneGeometry(9, 0.6).translate(0, H - 0.5, 0.03), 'front', 0, t), T.signMaterial('АВТОКОЛОННА · ГАРАЖ АВТОЦИСТЕРН', { bg: '#2a2c26', fg: '#e8dcae', w: 768, h: 52 }));
	// бензовозы носом к воротам
	for (const [gx, cab, body] of [[-11.25, M.white, M.silver], [3.75, M.red, M.hazard]]) {
		const F = frame(gx, 0, 0.3, Z);
		truckParts((g, mat, m) => b.lower(g.applyMatrix4(m).applyMatrix4(F), mat), M, 'fuel', cab, body);
		b.collide(gx, 0.3, 8.7, 2.7, Z);
		b.solids.push([gx, 0.3, 8.7, 2.7, Z]);
	}
	// первый бокс: стеллаж с канистрами у западной стены
	shelf(b, 'Стеллаж', -hx + 0.45, 2.6, Z, 2.2, { ammo545: [8, 16, 0.4], ammo12: [4, 8, 0.35], zhivchik: 0.25 });
	// второй бокс: смотровая яма, верстак, шкаф с инструментом
	b.lower(place(planeXZ(1.1, 6.5, 1), -3.75, 0.03, -0.5), IM.black, { cast: false });
	bench(b, 'Верстак', -3.75, hz - 0.55, Math.PI, { ammo762: [8, 16, 0.4], ammo545: [6, 12, 0.35], grenade: 0.05 });
	locker(b, 'Шкаф с инструментом', -7.5 + 0.4, -2.2, Z, { ammo919: [6, 12, 0.4], fireaxe: 0.06, zhivchik: 0.25 }, 1.0);
	// третий бокс: ящики у перегородки
	b.container('Ящики', 6.75, -3.4, -Z, [[1.2, 0.7, 0.9, 0, 0.35, 0, IM.crate], [1.0, 0.6, 0.8, 0.05, 1.0, 0, IM.crateGreen]], [1.2, 0.9], { ammo762: [10, 20, 0.45], ammo556: [6, 12, 0.3], spore: [1, 2, 0.3] }, 1.3);
	// четвёртый бокс — мастерская: верстак, сейф механика, шины, разобранный мотор
	bench(b, 'Верстак', hx - 0.55, -2.4, -Z, { ammo545: [8, 16, 0.4], ammo919: [4, 8, 0.3], zhivchik: 0.2 });
	safe(b, 'Сейф механика', 13.6, hz - 0.4, Math.PI, { ammo545: [15, 25, 0.5], ammo762: [10, 20, 0.4], spore: [2, 4, 0.5], aks: 0.1 }, 1.2);
	b.furniture(9.0, hz - 0.7, 0, [...[0, 1, 2, 3].map((i) => [0, 0, 0, 0, 0, 0, b.ctx.M.tire, { geo: new THREE.TorusGeometry(0.42, 0.17, 6, 12).rotateX(Z).translate(0, 0.17 + i * 0.32, 0) }])], { solid: [1.2, 1.2] });
	b.furniture(10.8, 0.5, 0.3, [[1.2, 0.15, 0.9, 0, 0.075, 0, IM.crate], [0.9, 0.7, 0.7, 0, 0.5, 0, IM.machine], [0.5, 0.3, 0.5, 0.1, 1.0, 0, IM.metal]], { solid: [1.2, 0.9] });
	return b.finish();
}

/**
 * Магазин АЗС 14×7 м: торговый зал (прилавок с кассой, два стеллажа с маслами и едой, холодильник) и подсобка
 * (сейф с выручкой, ящики). Витрины и вход — с севера, к колонкам.
 */
function buildAzsShop(ctx, { name, cx, cz }) {
	const W = 14, D = 7, H = 3.4, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.4 });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.shopWall };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [-3.6], w: 1.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 3.2, -hz + t / 2, hz - t / 2, { mat: IM.shopWall, t: 0.15, doors: [1.9], w: 1.1 });
	// витрины с решётками, вывеска, козырёк
	for (const x of [-0.6, 2.0]) {
		b.top_(b.onWall(new THREE.PlaneGeometry(2.2, 1.5).translate(0, 1.55, 0.015), 'front', x, t), M.glass);
		for (let k = -0.9; k <= 0.91; k += 0.45) b.top_(b.onWall(box(0.04, 1.5, 0.04).translate(k, 1.55, 0.05), 'front', x, t), M.metalDark);
	}
	b.window('back', 5, { t, sill: M.whiteBrick });
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofTar);
	b.top_(b.onWall(new THREE.PlaneGeometry(6, 0.95).translate(0, H - 0.5, 0.05), 'front', 0.4, t), M.shopSign);
	b.canopy('front', -3.6, { w: 2.4, d: 1.2, y: 2.4, mat: M.red, t });
	b.top_(place(box(1.2, 0.7, 0.8), 4.5, H + 0.65, 1.5), M.metalDark); // кондиционер на крыше
	b.wallBox('front', -3.6 + 1.25, 1.0, 0.02, 2.05, 0.05, M.glass, { t });
	// торговый зал
	b.container('Прилавок', -2.6, 0.9, Math.PI, [
		[3.0, 1.0, 0.7, 0, 0.5, 0, IM.furniture], [3.1, 0.05, 0.8, 0, 1.02, 0, IM.furnitureLight], [0.45, 0.25, 0.35, 0.9, 1.17, 0, IM.black], [1.2, 0.3, 0.4, -0.6, 1.2, 0, IM.glass],
	], [3.0, 0.7], { ammo919: [4, 8, 0.5], zhivchik: 0.35, spore: [1, 3, 0.35] }, 1.3);
	shelf(b, 'Стеллаж', -hx + 0.45, 0.2, Z, 2.4, { zhivchik: [1, 2, 0.45], ammo12: [3, 6, 0.3] });
	shelf(b, 'Стеллаж', 3.2 - 0.42, -1.6, -Z, 2.2, { zhivchik: 0.4, ammo919: [3, 6, 0.3], spore: 0.2 });
	b.container('Холодильник', 1.2, hz - 0.45, Math.PI, [[0.62, 1.5, 0.6, 0, 0.75, 0, IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, IM.metal]], [0.62, 0.6], { zhivchik: [1, 2, 0.7] }, 1.5);
	b.furniture(-5.0, 2.9, 0, [[1.4, 0.9, 0.6, 0, 0.45, 0, IM.redBoard]], { solid: [1.4, 0.6] }); // ларь-морозилка
	// подсобка
	safe(b, 'Сейф с выручкой', hx - 0.45, -1.6, -Z, { spore: [3, 6, 0.65], ammo919: [6, 12, 0.5], glock17: 0.1 });
	b.container('Ящики', 5.2, hz - 0.6, Math.PI, [[1.2, 0.7, 0.9, 0, 0.35, 0, IM.crate], [1.0, 0.5, 0.8, 0.05, 0.95, 0, IM.crate]], [1.2, 0.9], { zhivchik: [1, 2, 0.4], ammo12: [4, 8, 0.35], grenade: 0.04 }, 1.2);
	return b.finish();
}

/** Будка сливщика у эстакады 4,5×3,5 м: стол с журналами и шкафчик. Дверь на восток. */
function buildBooth(ctx, { name, cx, cz }) {
	const W = 4.5, D = 3.6, H = 2.7, t = 0.22, hx = W / 2, hz = D / 2;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.3 });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [0.6], w: 1.1, side: -1 });
	b.window('left', 0, { t, sill: M.whiteBrick });
	b.window('back', -0.8, { t, sill: M.whiteBrick });
	b.top_(place(box(W + 0.5, 0.22, D + 0.5, 3), 0, H + 0.11, 0), M.roofTar);
	b.canopy('right', 0.6, { w: 1.5, d: 0.8, y: 2.3, mat: M.roofTar, t });
	desk(b, 'Стол сливщика', -1.0, -hz + 0.45, 0, { ammo919: [4, 8, 0.45], zhivchik: 0.3, ammo545: [4, 8, 0.25] }, 1.2);
	chair(b, -1.0, -0.4, Math.PI);
	locker(b, 'Шкафчик', -1.0, hz - 0.35, Math.PI, { ammo12: [4, 8, 0.4], zhivchik: 0.25, spore: 0.2 });
	return b.finish();
}

export default {
	id: 'neftebaza',
	seed: 7202,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const stripe = (w, d, x, z, mat = M.white, y = 0.03) => batch.add(place(planeXZ(w, d, 1), x, y, z), mat, { cast: false });
		const oil = new THREE.MeshStandardMaterial({ color: 0x0b0b0a, roughness: 0.06, metalness: 0.4 }); // мазут в нефтеловушке
		const flammable = T.signMaterial('ОГНЕОПАСНО', { bg: '#d8c020', fg: '#1a1a18', w: 512, h: 110 });

		// ---------- Дороги и площадки ----------
		ground(6, 186, HX, 0, M.asphalt, 5, 0.02); // трасса на север
		ground(176, 7, 7, RZ2, M.asphalt, 5, 0.021); // служебная дорога (к В/ч)
		ground(150, 7, 17, RZ1, M.asphalt, 5, 0.0212); // главная дорога (к Химмашу)
		ground(6, 60, SX, 60, M.asphalt, 5, 0.0205); // к станции
		ground(6, 53, WX, 0, M.concrete, 4, 0.0195); // западный проезд
		ground(6, 53, NX, 0, M.concrete, 4, 0.0196); // восточный проезд
		ground(18, 50, EX, 2, M.dirt, 4, 0.014); // вдоль путей — грунт, пролито
		ground(24, 22, -30, -6, M.concrete, 4, 0.0175); // двор насосной
		ground(32, 10, 23, 39, M.concrete, 4, 0.018); // площадка перед гаражами
		ground(14, 20, -6, 46, M.concrete, 4, 0.0182); // станция налива
		ground(18, 6, 32, -36.5, M.concrete, 4, 0.0184); // выезд пожарной части
		ground(23, 27, 75.5, 46.5, M.asphalt, 5, 0.0186); // площадка АЗС
		ground(20, 40, 76, 0, M.asphalt, 5, 0.0188); // стоянка у трассы
		for (const [cx, cz, w, d] of [[-59, -55, 37, 37], [-8, -55, 47, 37], [36, -66, 21, 17]]) ground(w, d, cx, cz, M.sand, 4, 0.013); // каре обваловки — песок
		// разметка трассы и дорог
		for (let z = -86; z < 87; z += 8) if (Math.abs(z - RZ1) > 5 && Math.abs(z - RZ2) > 5) stripe(0.18, 3.6, HX, z);
		for (let x = 66; x < 88; x += 8) { stripe(3.6, 0.18, x, RZ1); stripe(3.6, 0.18, x, RZ2); }
		for (const x of [70, 74, 78, 82]) stripe(0.15, 5, x, -12, M.yellow, 0.031); // места стоянки
		const onRoad = (x, z, m = 0) => Math.abs(x - HX) < 3 + m || (Math.abs(z - RZ2) < 3.5 + m && x > -80 - m) || (Math.abs(z - RZ1) < 3.5 + m && x > -58 - m)
			|| (Math.abs(x - SX) < 3 + m && z > RZ1) || ((Math.abs(x - WX) < 3 + m || Math.abs(x - NX) < 3 + m) && Math.abs(z) < 27)
			|| (Math.abs(x - EX) < 9 + m && z > -24) || (Math.abs(x + 30) < 12 + m && Math.abs(z + 6) < 11 + m)
			|| (Math.abs(x - 23) < 16 + m && Math.abs(z - 39) < 5 + m) || (Math.abs(x + 6) < 7 + m && Math.abs(z - 46) < 10 + m)
			|| (x > 64 - m && Math.abs(z - 46.5) < 13.5 + m) || (x > 66 - m && Math.abs(z) < 20 + m) || (Math.abs(x - 32) < 9 + m && Math.abs(z + 36.5) < 3 + m)
			|| (Math.abs(x + 59) < 18.5 && Math.abs(z + 55) < 18.5) || (Math.abs(x + 8) < 23.5 && Math.abs(z + 55) < 18.5) || (Math.abs(x - 36) < 10.5 && Math.abs(z + 66) < 8.5);
		// стойки трубопроводов — не на дорогах и не в проходах
		const avoid = (x, z) => (Math.abs(z - RZ2) < 4.2 && x > -80) || (Math.abs(z - RZ1) < 4.2 && x > -58) || Math.abs(x - SX) < 3.6 || Math.abs(x - WX) < 3.6 || Math.abs(x - NX) < 3.6;

		// ---------- Забор с колючкой, ворота ----------
		const wires = [];
		const fence = (x0, z0, x1, z1) => { concreteFence(batch, M, collide, root, x0, z0, x1, z1, { wire: false }); wires.push([x0, z0, x1, z1]); };
		fence(FX0, FZ0, -38.5, FZ0); fence(-33.5, FZ0, FX1, FZ0); // север — пролом у пожарного проезда
		fence(FX0, FZ0, FX0, 17); fence(FX0, 22, FX0, FZ1); // запад — пролом
		fence(FX0, FZ1, -72, FZ1); fence(-56, FZ1, -44, FZ1); fence(-36, FZ1, FX1, FZ1); // юг — ворота для путей и к станции
		fence(FX1, FZ0, FX1, RZ2 - 4); fence(FX1, RZ2 + 4, FX1, RZ1 - 4); fence(FX1, RZ1 + 4, FX1, FZ1); // восток — служебные и главные ворота
		{
			const pts = [], y = 2.75;
			for (const [x0, z0, x1, z1] of wires) {
				const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2);
				for (const dy of [0, 0.2]) for (let k = 0; k < n; k++) for (const q of [k, k + 1]) pts.push(new THREE.Vector3(x0 + (x1 - x0) * q / n, y + dy + Math.sin(q * 2.1) * 0.05, z0 + (z1 - z0) * q / n));
			}
			root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a3a38 })));
		}
		const gatePost = (x, z) => { batch.add(place(box(0.6, 3.2, 0.6), x, 1.6, z), M.concreteDark); collide(x, z, 0.7, 0.7); };
		for (const z of [RZ1 - 4, RZ1 + 4, RZ2 - 4, RZ2 + 4]) gatePost(FX1, z);
		for (const x of [-72, -56, -44, -36]) gatePost(x, FZ1);
		// главные ворота: откатная створка отъехала вдоль забора, шлагбаум поднят, щит над въездом
		batch.add(place(box(0.12, 2.4, 8.2, 1.2), FX1 - 0.45, 1.3, RZ1 + 8.2), M.metalOlive);
		for (let k = -3.6; k <= 3.61; k += 0.6) batch.add(place(box(0.06, 2.3, 0.06), FX1 - 0.55, 1.3, RZ1 + 8.2 + k), M.metalDark);
		barrier(batch, M, collide, FX1 - 1.4, RZ1 + 4.6, 0, 6, true);
		billboard(batch, M, root, collide, FX1 + 0.6, RZ1, Z, 'НЕФТЕБАЗА № 7 · ВЪЕЗД ПО ПРОПУСКАМ', { w: 8.6, h: 1.0, y: 5.0, bg: '#e8dcc0', fg: '#1d3f7a' });
		// служебные ворота: створка сорвана и лежит на дороге; у южных ворот — шлагбаум
		batch.add(place(box(7.6, 0.1, 2.3, 1.2), FX1 + 3.4, 0.08, RZ2 + 1.2, 0.35, 0, 0.04), M.metalOlive);
		barrier(batch, M, collide, -36.6, FZ1 - 0.7, Math.PI, 7, true);
		// поваленные плиты в проломах
		batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), -36, 0.12, FZ0 - 1.4, 0.2), M.concrete);
		batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), FX0 - 1.3, 0.12, 19.5, Z + 0.15), M.concrete);
		// откатные ворота для путей — отъехали к западу
		batch.add(place(box(14, 2.4, 0.12, 1.2), -79, 1.3, FZ1 + 0.45), M.metalOlive);

		// ---------- Резервуарный парк: три каре в обваловке ----------
		// каре А (запад): четыре РВС-2000, юго-западный выгорел
		bermLine(batch, M, collide, -78 - BW / 2, -74, -40 + BW / 2, -74, [[-59, 4]]);
		bermLine(batch, M, collide, -78 - BW / 2, -36, -40 + BW / 2, -36, [[-65, 4.5]]);
		bermLine(batch, M, collide, -78, -74, -78, -36);
		bermLine(batch, M, collide, -40, -74, -40, -36, [[-55, 4]]);
		// каре Б (середина): два РВС-5000
		bermLine(batch, M, collide, -32 - BW / 2, -74, 16 + BW / 2, -74);
		bermLine(batch, M, collide, -32 - BW / 2, -36, 16 + BW / 2, -36, [[-16, 4.5], [10, 4]]);
		bermLine(batch, M, collide, -32, -74, -32, -36, [[-48, 4]]);
		bermLine(batch, M, collide, 16, -74, 16, -36, [[-62, 4]]);
		// каре В (восток): мазутный резервуар
		bermLine(batch, M, collide, 25 - BW / 2, -75, 47 + BW / 2, -75);
		bermLine(batch, M, collide, 25 - BW / 2, -57, 47 + BW / 2, -57, [[31, 4]]);
		bermLine(batch, M, collide, 25, -75, 25, -57, [[-70, 4]]);
		bermLine(batch, M, collide, 47, -75, 47, -57);
		const tanks = [
			// [x, z, r, h, окраска, начало лестницы, горел, надпись]
			[-67.5, -63.5, 6.2, 10.5, M.tankWhite, 0.6, false, '№ 1'],
			[-50.5, -63.5, 6.2, 10.5, M.tankWhite, 2.2, false, '№ 2'],
			[-67.5, -46.5, 6.2, 10.5, M.tankWhite, 4.0, true, null],
			[-50.5, -46.5, 6.2, 10.5, M.tankWhite, 0.9, false, '№ 4'],
			[-20, -55, 8.5, 12, M.silver, 0.3, false, '№ 5'],
			[4, -55, 8.5, 12, M.tankWhite, 2.9, false, '№ 6'],
			[36, -66, 5.4, 9, M.metalRust, 1.2, false, 'МАЗУТ'],
			[26, 0, 2.6, 7, M.silver, 3.8, false, null], // мерники у станции налива
			[34, 0, 2.6, 7, M.silver, 5.2, false, null],
		];
		for (const [i, [x, z, r, h, paint, a0, burnt, label]] of tanks.entries()) {
			occluder(`Tank${i + 1}`, (kb, group) => {
				tankRVS(kb, M, x, z, r, h, { paint, a0, burnt, seg: r > 4 ? 18 : 12 });
				if (label) {
					const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2.6, r * 0.6), 0.9), T.signMaterial(label, { bg: '#d8d6cc', fg: '#2a2a26', w: 256, h: 88 }));
					s.position.set(x, h * 0.62, z + r + 0.08);
					group.add(s);
				}
			}, { cx: x, cz: z, ry: 0, hx: r + 1.4, hz: r + 1.4, top: h + r * 0.13 + 1.2 }, 0.22);
			batch.add(cyl(r + 0.7, r + 0.85, 0.3, r > 4 ? 18 : 12).translate(x, 0.15, z), M.concrete);
			roundCollide(collide, x, z, r + 0.55);
		}
		// таблички «Огнеопасно» на валах у проходов
		for (const [x, z] of [[-62.5, -35.4], [-18.5, -35.4], [33.5, -56.4]]) {
			const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.36), flammable);
			s.position.set(x, 1.7, z + 0.1);
			root.add(s);
			batch.add(place(box(0.08, 1.9, 0.08), x, 0.95, z), M.metalDark);
		}
		// трубы в каре: между рядами резервуаров и вдоль южного вала; подъёмы через валы и служебную дорогу — к эстакаде
		pipeLine(batch, M, collide, [[-74, -55], [-44, -55]], { y: 3.6, step: 6 });
		for (const tx of [-67.5, -50.5]) for (const s of [-1, 1]) pipeAB(batch, M.metalRust, [tx, 3.6, -55], [tx, 3.6, -55 + s * 2.4], 0.2);
		pipeLine(batch, M, collide, [[-26, -44], [10, -44]], { y: 3.6, step: 6 });
		for (const tx of [-20, 4]) pipeAB(batch, M.metalRust, [tx, 3.6, -44], [tx, 3.6, -46.6], 0.22);
		for (const [rx, rz] of [[-59, -55], [-8, -44]]) {
			pipeAB(batch, M.metalRust, [rx, 3.4, rz], [rx, 4.95, rz], 0.26);
			pipeLine(batch, M, collide, [[rx, rz], [rx, -20.9]], { y: 4.75, step: 6.5, avoid });
		}

		// ---------- Трубопроводные эстакады к насосной и станции налива ----------
		pipeRack(batch, M, collide, -60, -20, 0, -20, { avoid });
		pipeAB(batch, M.metalRust, [EX + 0.9, 3.9, -14], [EX + 0.9, 3.9, -20], 0.26); // от коллектора сливной эстакады
		pipeAB(batch, M.metalRust, [EX + 0.9, 3.9, -20], [-60.5, 4.75, -20], 0.26);
		pipeAB(batch, M.metalRust, [-30, 4.75, -20], [-30, 4.75, -11.6], 0.3); // в насосную
		pipeAB(batch, M.silver, [-34, 4.9, -20], [-34, 4.9, -11.6], 0.22);
		pipeRack(batch, M, collide, -15, -6, -15, 40, { avoid, step: 7.7 });
		pipeRack(batch, M, collide, -15, 40, -11.4, 40, { avoid, pipes: 2 });
		pipeAB(batch, M.silver, [-11.4, 4.9, 40], [-6, 5.3, 40], 0.2); // под навес налива
		pipeAB(batch, M.metalRust, [-18.9, 4.75, -6], [-15, 4.75, -6], 0.26); // из насосной
		pipeRack(batch, M, collide, -15, 5, 22, 5, { avoid, pipes: 2 });
		for (const tx of [26, 34]) pipeAB(batch, M.silver, [tx, 4.75, 5], [tx, 4.75, 2.65], 0.18);
		pipeAB(batch, M.silver, [22, 4.75, 5], [34, 4.75, 5], 0.18);

		// ---------- Сливная ж/д эстакада, пути с цистернами, будка сливщика, нефтеловушка ----------
		trackZ(batch, M, TX1, -22, 92);
		trackZ(batch, M, TX2, -22, 92);
		for (const x of [TX1, TX2]) bufferStop(batch, M, collide, x, -22);
		estakada(occluder, batch, M, collide, EX, -14, 22, [[-8, true, true], [4, true, false], [16, true, true]]);
		for (const [x, z, paint] of [[TX1, -8, M.tankBlack], [TX1, 4, M.tankBlack], [TX1, 16, M.silver], [TX2, -8, M.tankBlack], [TX2, 16, M.tankBlack], [TX1, 40, M.metalRust], [TX1, 52.2, M.tankBlack], [TX2, 60, M.silver]]) oilWagon(batch, M, collide, x, z, paint);
		buildings.push(buildBooth(bctx, { name: 'Booth', cx: -54.5, cz: 8 }));
		fireShield(batch, M, collide, -54.5, -2, 0);
		{
			// нефтеловушка: бетонный бортик, мазут
			const px = -77, pz = 40, w = 7, d = 18;
			for (const s of [-1, 1]) {
				batch.add(place(box(w + 0.5, 0.6, 0.25), px, 0.3, pz + s * d / 2), M.concreteDark);
				batch.add(place(box(0.25, 0.6, d), px + s * w / 2, 0.3, pz), M.concreteDark);
			}
			batch.add(place(planeXZ(w, d, 2), px, 0.25, pz), oil, { cast: false });
			for (let i = 0; i < 4; i++) batch.add(place(box(0.08, 0.08, w + 0.4), px - w / 2 + 1.4 * (i + 1), 0.62, pz - d / 2 + 2 + i * 4.3, Z), M.metalDark); // мостки
			collide(px, pz, w + 0.5, d + 0.3);
		}

		// ---------- Насосная, операторная, генератор, горизонтальные резервуары, мерники ----------
		buildings.push(buildPumpStation(bctx, { name: 'PumpStation', cx: -30, cz: -6 }));
		buildings.push(buildOperator(bctx, { name: 'Operator', cx: -30, cz: 14 }));
		pipePile(batch, M, collide, -41, 21.5, Z);
		fireShield(batch, M, collide, -20, 5.4, Math.PI);
		{
			// дизель-генератор в контейнере, бак с топливом, трансформатор
			const gx = -6, gz = 14;
			batch.add(place(box(6, 2.6, 2.4, 1.5), gx, 1.3, gz), M.metalOlive);
			for (let k = 0; k < 6; k++) batch.add(place(box(0.06, 1.2, 0.04), gx + 1.4 + k * 0.25, 1.5, gz + 1.22), M.metalDark); // жалюзи
			batch.add(place(box(1.0, 2.0, 0.04), gx - 1.8, 1.0, gz + 1.22), M.metalDark); // дверь
			batch.add(cyl(0.16, 0.16, 2.0, 8).translate(gx - 2.2, 3.5, gz - 0.5), M.metalDark); // выхлоп
			batch.add(place(box(0.9, 0.8, 1.6), gx + 2.4, 3.0, gz), M.metalDark); // радиатор
			batch.add(place(metricUV(cyl(0.75, 0.75, 3.2, 12), 4.7, 3.2, 2).rotateZ(Z), gx, 1.15, gz + 3.0), M.hazard);
			for (const dx of [-1.1, 1.1]) batch.add(place(box(0.3, 0.6, 1.4), gx + dx, 0.3, gz + 3.0), M.concreteDark);
			collide(gx, gz + 0.9, 6.4, 5.4);
			transformer(batch, root, M, collide, 4, 14);
		}
		{
			// горизонтальные резервуары (РГС) на опорах в бетонном бортике
			const bx = -1.5, bz = -5.5;
			for (const z of [-10, -5.5, -1]) {
				batch.add(place(metricUV(cyl(1.5, 1.5, 9, 14, true), 9.4, 9, 4, true).rotateZ(Z), bx, 1.9, z), M.tankWhite);
				for (const e of [-1, 1]) batch.add(place(new THREE.SphereGeometry(1.5, 12, 4, 0, Math.PI * 2, 0, Z).scale(1, 0.25, 1).rotateZ(-e * Z), bx + e * 4.5, 1.9, z), M.tankWhite);
				for (const dx of [-2.8, 2.8]) batch.add(place(box(0.5, 0.9, 2.2), bx + dx, 0.45, z), M.concreteDark);
				batch.add(place(box(0.6, 0.4, 0.6), bx + 1.5, 3.55, z), M.metalDark);
				collide(bx, z, 9.6, 3.1);
			}
			const w = 14, d = 15;
			for (const [x0, z0, x1, z1] of [[bx - w / 2, bz - d / 2, bx + w / 2, bz - d / 2], [bx - w / 2, bz - d / 2, bx - w / 2, bz + d / 2], [bx + w / 2, bz - d / 2, bx + w / 2, bz + d / 2], [bx - w / 2, bz + d / 2, bx - 1.5, bz + d / 2], [bx + 1.5, bz + d / 2, bx + w / 2, bz + d / 2]]) {
				const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, along = z0 === z1;
				batch.add(place(box(along ? len + 0.25 : 0.25, 0.6, along ? 0.25 : len, 1), mx, 0.3, mz), M.concrete);
				collide(mx, mz, along ? len + 0.25 : 0.3, along ? 0.3 : len);
			}
		}
		fireShield(batch, M, collide, 40, 4.6, Math.PI);
		{
			// пожарный водоём: бетонная чаша, пирс для пожарных машин, табличка «ПВ»; пожарные гидранты вдоль дорог
			const px = 34, pz = -15, w = 14, d = 8;
			const water = new THREE.Mesh(planeXZ(w, d, 4), M.water);
			water.position.set(px, 0.06, pz);
			water.receiveShadow = true;
			root.add(water);
			for (const s of [-1, 1]) {
				batch.add(place(box(w + 0.6, 0.45, 0.3, 1), px, 0.22, pz + s * (d / 2 + 0.15)), M.concrete);
				batch.add(place(box(0.3, 0.45, d, 1), px + s * (w / 2 + 0.15), 0.22, pz), M.concrete);
			}
			batch.add(place(box(3.2, 0.3, 2.4, 1), px - 3, 0.15, pz + d / 2 + 1.5), M.concreteDark); // пирс
			batch.add(place(box(0.08, 1.8, 0.08), px - 5.2, 0.9, pz + d / 2 + 0.6), M.metalDark);
			const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), T.signMaterial('ПВ', { bg: '#f0f0e8', fg: '#a01a10', w: 128, h: 86 }));
			sign.position.set(px - 5.2, 1.85, pz + d / 2 + 0.65);
			root.add(sign);
			collide(px, pz, w + 0.6, d + 0.6);
			for (const [hx, hz] of [[-24, RZ2 - 3.9], [6, RZ2 - 3.9], [-36, RZ2 + 4.2], [26, RZ1 - 4.2], [-28, RZ1 + 4.2], [36, RZ2 + 4.2]]) {
				batch.add(cyl(0.16, 0.18, 0.8, 8).translate(hx, 0.4, hz), M.red);
				batch.add(cyl(0.2, 0.2, 0.12, 8).translate(hx, 0.82, hz), M.red);
				collide(hx, hz, 0.4, 0.4);
			}
		}

		// ---------- Контора, КПП, стоянка у конторы ----------
		buildings.push(
			buildOffice(bctx, { name: 'Office', cx: 30, cz: 12 }),
			buildCheckpoint(bctx, { name: 'Checkpoint', cx: 44.5, cz: 22, ry: Math.PI }),
		);
		sandbags(batch, M, collide, 46.5, 25.4, 2.4, 0);
		addCar(batch, M, root, 42.5, 8, 1.4, 0x5a6a7a);
		collide(42.5, 8, 4.3, 1.8, 1.4);
		addCar(batch, M, root, 42.8, 13.5, 1.7, 0x8a8478, { crashed: true });
		collide(42.8, 13.5, 4.3, 1.8, 1.7);

		// ---------- Пожарная часть, каланча ----------
		buildings.push(buildFireDepot(bctx, { name: 'FireDepot', cx: 32, cz: -44, ry: Math.PI }));
		{
			// каланча: решётчатая башня с будкой наблюдателя
			const kx = 45, kz = -45, h = 11;
			for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.16, h, 0.16), kx + dx * 1.2, h / 2, kz + dz * 1.2), M.red);
			for (let y = 1.8; y < h; y += 2.2) for (const [w, d, ox, oz] of [[2.4, 0.08, 0, -1.2], [2.4, 0.08, 0, 1.2], [0.08, 2.4, -1.2, 0], [0.08, 2.4, 1.2, 0]]) batch.add(place(box(w, 0.08, d), kx + ox, y, kz + oz), M.white);
			batch.add(place(box(3.0, 0.15, 3.0), kx, h, kz), M.metalDark);
			batch.add(place(box(2.6, 1.2, 2.6), kx, h + 0.75, kz), M.red);
			batch.add(place(box(2.64, 0.6, 2.64), kx, h + 1.65, kz), M.glass);
			batch.add(place(new THREE.ConeGeometry(2.2, 1.0, 4).rotateY(Math.PI / 4), kx, h + 2.45, kz), M.roofMetal);
			collide(kx, kz, 2.8, 2.8);
		}
		fireShield(batch, M, collide, 21, -36.2, 0);
		hazardBarrels(batch, M, collide, 42, -36, rnd, 4);

		// ---------- Гаражи автоцистерн, станция налива, тарный склад ----------
		buildings.push(buildGarage(bctx, { name: 'Garage', cx: 24, cz: 50 }));
		truck(batch, M, collide, 14, 38.5, 0.15, 'fuel', M.yellow, M.silver);
		truck(batch, M, collide, 32, 39, -0.1, 'fuel', M.white, M.hazard);
		truck(batch, M, collide, 8, 31.2, 2.6, 'fuel', M.tankBlack, M.tankBlack, 0.04); // сгоревший поперёк главной дороги
		for (const [x, z] of [[40.5, 46], [41, 49]]) { beginProp('tire', x, z, 0); batch.add(place(new THREE.TorusGeometry(0.42, 0.17, 6, 12).rotateX(Z), x, 0.17, z), M.tire); endProp(); }
		fireShield(batch, M, collide, 7, 44.5, -Z);
		{
			// станция налива автоцистерн: навес на колоннах, островок с наливными стояками, бензовоз под наливом
			const lx = -6, lz = 46;
			for (const [dx, dz] of [[-5.6, -7.4], [5.6, -7.4], [-5.6, 7.4], [5.6, 7.4]]) { batch.add(place(box(0.4, 6.2, 0.4), lx + dx, 3.1, lz + dz), M.metalDark); collide(lx + dx, lz + dz, 0.5, 0.5); }
			batch.add(place(box(2.2, 1.1, 12, 1.5), lx, 0.55, lz), M.concrete);
			for (const s of [-1, 1]) batch.add(place(box(0.05, 0.05, 12), lx + s * 1.05, 2.1, lz), M.hazard);
			for (const e of [-1, 1]) batch.add(place(box(1.0, 0.08, Math.hypot(1.1, 2.4)), lx, 0.55, lz + e * 7.2, 0, -e * Math.atan2(1.1, 2.4)), M.metalDark);
			collide(lx, lz, 2.4, 16.8);
			occluder('Naliv', (kb) => {
				kb.add(place(box(12.4, 0.4, 16, 2), lx, 6.3, lz), M.roofMetal);
				kb.add(place(box(12.6, 0.5, 16.2), lx, 5.95, lz), M.hazard);
				for (const z of [-4.5, 0, 4.5]) for (const s of [-1, 1]) {
					kb.add(cyl(0.12, 0.12, 4.0, 8, true).translate(lx + s * 0.8, 3.1, lz + z), M.silver);
					kb.add(place(pipeX(0.11, 2.6, 8), lx + s * 2.1, 5.0, lz + z), M.silver);
					kb.add(cyl(0.11, 0.11, 1.4, 8, true).translate(lx + s * 3.4, 4.3, lz + z), M.silver);
				}
				kb.add(place(pipeZ(0.24, 16, 10), lx, 5.3, lz), M.metalRust);
			}, { cx: lx, cz: lz, ry: 0, hx: 6.4, hz: 8.2, top: 6.6 }, 0.25);
			truck(batch, M, collide, lx - 3.6, lz + 0.5, Z, 'fuel', M.red, M.silver);
		}
		{
			// навес тарного склада: поддоны с бочками рядами, бочки штабелем на боку
			const sx = -26, sz = 50, w = 14, d = 8;
			for (const dx of [-w / 2, 0, w / 2]) for (const dz of [-d / 2, d / 2]) { batch.add(place(box(0.25, 4.0, 0.25), sx + dx, 2.0, sz + dz), M.metalRust); collide(sx + dx, sz + dz, 0.4, 0.4); }
			occluder('TareShed', (kb) => {
				kb.add(place(box(w + 0.8, 0.12, d + 1.0, 1.2), sx, 4.15, sz, 0, -0.06), M.roofMetal);
				kb.add(place(box(w + 0.4, 0.3, 0.2), sx, 3.9, sz - d / 2), M.metalRust);
				kb.add(place(box(w + 0.4, 0.3, 0.2), sx, 3.9, sz + d / 2), M.metalRust);
			}, { cx: sx, cz: sz, ry: 0, hx: w / 2 + 0.5, hz: d / 2 + 0.6, top: 4.4 }, 0.25);
			const barrel = (x, z, mat) => {
				beginProp('barrel', x, z, (x * 7 + z * 3) % 6.28);
				batch.add(place(cyl(0.3, 0.3, 0.9, 12), x, 0.6, z), mat);
				batch.add(place(cyl(0.31, 0.31, 0.06, 12), x, 0.82, z), M.metalDark);
				endProp();
			};
			for (const rz of [-2.2, 1.2]) {
				for (let i = 0; i < 5; i++) {
					const px = sx - 5.2 + i * 2.6;
					batch.add(place(box(1.3, 0.14, 1.3), px, 0.07, sz + rz), M.wood);
					for (const [ox, oz] of [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]]) if (!(i % 2 && ox > 0 && oz > 0)) barrel(px + ox, sz + rz + oz, (i + (oz > 0 ? 1 : 0)) % 3 ? M.red : M.metalRust);
				}
				collide(sx, sz + rz, 12.6, 1.4);
			}
			for (const [k, y] of [[0, 0.3], [1, 0.3], [2, 0.3], [0.5, 0.82], [1.5, 0.82]]) batch.add(place(cyl(0.3, 0.3, 0.9, 12).rotateX(Z), sx - 9.6, y, sz - 1.4 + k * 0.62), M.metalRust);
			collide(sx - 9.6, sz - 0.8, 1.0, 2.2);
			hazardBarrels(batch, M, collide, -31, 59.5, rnd, 5);
		}

		// ---------- За забором: АЗС у главного въезда ----------
		{
			const ax = 76, az = 42;
			// колонны, островки, колонки
			for (const [dx, dz] of [[-5.5, -3], [5.5, -3], [-5.5, 3], [5.5, 3]]) { batch.add(place(box(0.45, 5.0, 0.45), ax + dx, 2.5, az + dz), M.silver); collide(ax + dx, az + dz, 0.55, 0.55); }
			for (const dz of [-1.6, 1.6]) {
				batch.add(place(box(9, 0.18, 1.1, 1), ax, 0.09, az + dz), M.concrete);
				for (const dx of [-2.6, 2.6]) {
					batch.add(place(box(0.9, 1.8, 0.5), ax + dx, 1.08, az + dz), M.white);
					batch.add(place(box(0.92, 0.35, 0.52), ax + dx, 1.85, az + dz), M.red);
					batch.add(place(box(0.5, 0.3, 0.02), ax + dx, 1.4, az + dz + 0.26), M.glass);
					batch.add(place(box(0.5, 0.3, 0.02), ax + dx, 1.4, az + dz - 0.26), M.glass);
					batch.add(place(cyl(0.025, 0.025, 1.2, 4, true), ax + dx + 0.5, 0.8, az + dz + 0.2, 0, 0.3), M.tire);
				}
				collide(ax, az + dz, 8.6, 1.1);
			}
			occluder('AzsCanopy', (kb) => {
				kb.add(place(box(16, 0.6, 9.6, 2), ax, 5.3, az), M.white);
				kb.add(place(box(16.2, 0.32, 9.8), ax, 5.05, az), M.red);
				for (const dx of [-5, -1.7, 1.7, 5]) for (const dz of [-2.4, 2.4]) kb.add(place(box(0.9, 0.06, 0.4), ax + dx, 4.86, az + dz), M.white);
			}, { cx: ax, cz: az, ry: 0, hx: 8.2, hz: 5, top: 5.6 }, 0.12);
			buildings.push(buildAzsShop(bctx, { name: 'AzsShop', cx: 77, cz: 54.5 }));
			// стела с ценами у дороги
			batch.add(place(box(1.6, 6.0, 0.5, 1.5), 67.2, 3.0, 36.2), M.red);
			batch.add(place(box(1.4, 2.6, 0.04), 67.2, 3.0, 36.47), M.metalDark);
			for (let i = 0; i < 4; i++) batch.add(place(box(1.1, 0.4, 0.02), 67.2, 4.0 - i * 0.62, 36.5), i % 2 ? M.yellow : M.white);
			const st = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), T.signMaterial('АЗС', { bg: '#a01a10', fg: '#f4f0e0', w: 256, h: 150 }));
			st.position.set(67.2, 5.4, 36.47);
			root.add(st);
			collide(67.2, 36.2, 1.8, 0.7);
			// горловины подземных резервуаров, дыхательные трубы
			for (const [x, z] of [[70, 50.4], [72, 50.4], [74, 50.4]]) batch.add(place(box(0.8, 0.08, 0.8), x, 0.05, z), M.metalDark);
			for (const x of [84.6, 85.2]) batch.add(cyl(0.06, 0.06, 4.2, 6).translate(x, 2.1, 50.6), M.silver);
			addCar(batch, M, root, 75.5, 46.0, 0.05, 0x3a5a3a);
			collide(75.5, 46.0, 4.3, 1.8, 0.05);
			addCar(batch, M, root, 66.6, 52, Z - 0.2, 0x7a2a22, { burned: true });
			collide(66.6, 52, 4.3, 1.8, Z - 0.2);
			fireShield(batch, M, collide, 85.0, 44, -Z);
		}
		// брошенная стоянка у трассы: автобус, машины, сгоревший бензовоз
		bus(batch, M, root, 81, -4, 0.04);
		collide(81, -4, 2.6, 8.4, 0.04);
		addCar(batch, M, root, 70, -12, Z, 0x8a8a7a);
		collide(70, -12, 4.3, 1.8, Z);
		addCar(batch, M, root, 78.2, -12.4, Z + 0.15, 0x4a4a60, { crashed: true });
		collide(78.2, -12.4, 4.3, 1.8, Z + 0.15);
		addCar(batch, M, root, 73, 8, 0.6, 0x6a5a40, { burned: true });
		collide(73, 8, 4.3, 1.8, 0.6);
		truck(batch, M, collide, 78, 14.5, 0.1, 'fuel', M.green, M.silver);
		billboard(batch, M, root, collide, 70, -24, 0, 'НЕФТЕБАЗА № 7 — 300 м', { w: 4.6, h: 1.1, y: 2.4, bg: '#1d3f7a', fg: '#f0f0e8' });
		// на трассе — разбитые машины
		addCar(batch, M, root, 59.6, -54, -Z + 0.2, 0xa8a49a, { crashed: true });
		collide(59.6, -54, 4.3, 1.8, -Z + 0.2);
		addCar(batch, M, root, 62.4, 66, Z - 0.3, 0x5a4a3a, { burned: true });
		collide(62.4, 66, 4.3, 1.8, Z - 0.3);
		addCar(batch, M, root, -4, RZ2 + 0.8, 0.2, 0x2a3a5a, { burned: true }); // на служебной
		collide(-4, RZ2 + 0.8, 4.3, 1.8, 0.2);
		const block = (x, z, r) => { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); };
		block(54, RZ2 - 2.2, 0.2); block(53.4, RZ1 + 2.6, -0.15); block(SX - 2, 70, 1.4);

		const exits = [
			{ to: 'murs', x0: HX - 3, x1: HX + 3, z0: -90, z1: -85.2, spawn: [HX, -82.5, 0], sign: [HX + 4.5, -84, '↑ Карьер'] },
			{ to: 'voench', x0: 85.2, x1: 90, z0: RZ2 - 3, z1: RZ2 + 3, spawn: [82.5, RZ2, -Z], sign: [84, RZ2 + 4.5, 'В/ч →'] },
			{ to: 'himmash', x0: 85.2, x1: 90, z0: RZ1 - 3, z1: RZ1 + 3, spawn: [82.5, RZ1, -Z], sign: [84, RZ1 + 4.5, 'Химмаш →'] },
			{ to: 'vokzal', x0: SX - 3, x1: SX + 3, z0: 85.2, z1: 90, spawn: [SX, 82.5, Math.PI], sign: [SX + 4.5, 84, '↓ Станция'] },
		];
		return {
			start: [82.5, RZ1, -Z],
			exits,
			// логово руберов — в каре обваловки (у резервуаров); топтуны водят стаи у насосной, эстакады, гаражей,
			// пожарной части и АЗС; бегуны — по дорогам, путям и у забора
			groups: [
				{ at: [-59, -55], r: 6, rubers: 1, stompers: 1, runners: 2 },
				{ at: [-8, -55], r: 7, rubers: 1, runners: 3 },
				{ at: [36, -66], r: 9, rubers: 1, runners: 1 },
				{ at: [-36, -60], r: 4, runners: 2 },
				{ at: [20, -62], r: 4, stompers: 1, runners: 1 },
				{ at: [-20, -79], r: 6, runners: 2 },
				{ at: [-60, -28], r: 6, runners: 2 },
				{ at: [2, -28], r: 6, stompers: 1, runners: 2 },
				{ at: [32, -38], r: 5, stompers: 1, runners: 2 },
				{ at: [EX, 4], r: 5, stompers: 1, runners: 2 },
				{ at: [EX, 46], r: 6, runners: 3 },
				{ at: [-78, 26], r: 4, stompers: 1, runners: 1 },
				{ at: [-30, 4], r: 5, stompers: 1, runners: 2 },
				{ at: [-34, -6], r: 4, runners: 2 },
				{ at: [-12, 20], r: 5, runners: 2 },
				{ at: [6, -16], r: 5, rubers: 1, runners: 1 },
				{ at: [30, 22], r: 5, runners: 2 },
				{ at: [40, 30], r: 5, stompers: 1, runners: 2 },
				{ at: [22, 40], r: 6, stompers: 1, runners: 2 },
				{ at: [22, 50], r: 5, rubers: 1, runners: 1 },
				{ at: [-6, 50], r: 5, runners: 3 },
				{ at: [-26, 44], r: 5, stompers: 1, runners: 2 },
				{ at: [SX, 56], r: 5, runners: 2 },
				{ at: [75, 42], r: 6, stompers: 1, runners: 3 },
				{ at: [76, 0], r: 7, stompers: 1, runners: 2 },
				{ at: [HX, -60], r: 6, runners: 2 },
				{ at: [HX, 72], r: 6, runners: 2 },
				{ at: [74, -46], r: 6, runners: 2 },
			],
			onRoad,
			// горит бензовоз поперёк главной дороги и машина на стоянке, бочка у тарного склада, разлив у эстакады
			fires: [[8, 31.2, 'car', 3.6], [73, 8, 'car'], [-20, 56], [-54, 30, 'ground']],
			barrels: 14,
			trees(tryTree) {
				// за забором — лес на востоке и юге, березняк вдоль трассы; внутри — редкие берёзы у конторы
				for (let i = 0; i < 30; i++) tryTree(R(65, 86), R(-86, -35), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 12; i++) tryTree(R(65, 86), R(61, 86), rnd() < 0.5 ? 'pine' : 'birch');
				for (let z = -80; z < 86; z += 7) tryTree(R(52, 56), z + R(-1, 1), 'birch');
				for (let i = 0; i < 36; i++) tryTree(R(-56, 56), R(69, 86), rnd() < 0.55 ? 'pine' : 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(-86, -72), R(68, 86), 'pine');
				for (let i = 0; i < 6; i++) tryTree(R(22, 40), R(19, 23), 'birch');
				for (let i = 0; i < 6; i++) tryTree(R(-80, -72), R(-30, 26), 'birch');
			},
			beltTrees: ['birch', 'pine'],
			beltDensity: 0.15,
			clutter: 9,
			blood: 20,
			puddles: 12,
			puddle: () => [[R(-60, 48), RZ1 + R(-3, 3)], [R(-60, 48), RZ2 + R(-3, 3)], [EX + R(-6, 6), R(-20, 60)], [R(66, 86), R(34, 58)]][Math.floor(rnd() * 4)],
			grass: 0.5,
			hint: (b) => ({
				PumpStation: 'Насосная — ящик ЗИП и верстак в зале, шкаф КИП в щитовой, шкафчики и сейф мастера в бытовке',
				Operator: 'Операторная — пульты операторов, шкаф с документами, сейф начальника смены',
				Office: 'Контора — лаборатория ГСМ, бухгалтерия, кабинет директора с сейфом',
				FireDepot: 'Пожарная часть — стеллаж с рукавами, ящик, шкафчики и аптечка в дежурке',
				Garage: 'Гаражи автоцистерн — верстаки, стеллаж, шкаф с инструментом, сейф механика',
				AzsShop: 'Магазин АЗС — прилавок, стеллажи, холодильник, сейф с выручкой в подсобке',
				Booth: 'Будка сливщика — стол с журналами и шкафчик',
				Checkpoint: 'КПП нефтебазы — стол дежурного и шкаф',
			}[b.name]),
		};
	},
};
