// Промзона и военная часть: бетонный забор с колючкой, рельсы и цистерны, водонапорная башня, труба котельной,
// эстакада труб, ёмкости ГСМ, БТР и армейский грузовик, шлагбаум, вышка, мешки с песком.
// Всё статичное — в общий batch (сливается по материалам); провода и надписи — отдельными объектами в root.

import * as THREE from 'three';
import * as T from './textures.js';
import { box, place } from './geom.js';

const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);
/** Цилиндр вдоль оси X (бочка на боку, цистерна, труба). */
const cylX = (r, len, seg = 16) => cyl(r, r, len, seg).rotateZ(Math.PI / 2);

/** Колючая проволока: две нитки поверх линии (x0,z0)→(x1,z1) на высоте y. */
function barbedWire(root, x0, z0, x1, z1, y) {
	const wire = new THREE.LineBasicMaterial({ color: 0x3a3a38 });
	const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len * 4);
	for (const dy of [0, 0.2]) {
		const pts = [];
		for (let k = 0; k <= n; k++) {
			const t = k / n;
			pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y + dy + Math.sin(k * 2.1) * 0.06, z0 + (z1 - z0) * t));
		}
		root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
	}
}

/** Бетонный забор из плит ПО-2 (с ромбиками) от (x0,z0) до (x1,z1); wire — колючка поверху. */
export function concreteFence(batch, M, collide, root, x0, z0, x1, z1, { h = 2.5, wire = true } = {}) {
	const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
	const n = Math.max(1, Math.round(len / 4));
	for (let i = 0; i < n; i++) {
		const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
		batch.add(place(box(len / n - 0.05, h, 0.16, 1.2, 1.2), x, h / 2, z, -ang), M.concrete);
		// рельеф плиты: горизонтальные рёбра
		for (const y of [h * 0.3, h * 0.65]) batch.add(place(box(len / n - 0.3, 0.12, 0.2), x, y, z, -ang), M.concreteDark);
	}
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		batch.add(place(box(0.3, h + 0.2, 0.3), x0 + (x1 - x0) * t, (h + 0.2) / 2, z0 + (z1 - z0) * t, -ang), M.concreteDark);
	}
	collide((x0 + x1) / 2, (z0 + z1) / 2, len, 0.4, -ang);
	if (wire) barbedWire(root, x0, z0, x1, z1, h + 0.25);
}

/** Ж/д путь вдоль X от x0 до x1 на линии z: щебень, шпалы, рельсы (по путям можно ходить). */
export function railTrack(batch, M, x0, x1, z) {
	const len = x1 - x0, cx = (x0 + x1) / 2;
	batch.add(place(box(len, 0.1, 3.0, 2), cx, 0.05, z), M.ballast, { cast: false });
	for (let x = x0 + 0.35; x < x1; x += 0.7) batch.add(place(box(0.22, 0.1, 2.5), x, 0.12, z), M.sleeper, { cast: false });
	for (const dz of [-0.76, 0.76]) batch.add(place(box(len, 0.14, 0.08), cx, 0.24, z + dz), M.rail, { cast: false });
}

/** Тележки вагона: колёсные пары под рамой. */
function bogies(batch, M, x, z, ry, half) {
	const c = Math.cos(ry), s = Math.sin(ry);
	const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
	for (const bx of [-half + 1.4, half - 1.4]) {
		const [px, pz] = at(bx, 0);
		batch.add(place(box(2.2, 0.5, 2.0), px, 0.55, pz, ry), M.metalDark);
		for (const wx of [-0.7, 0.7]) for (const wz of [-0.76, 0.76]) {
			const [qx, qz] = at(bx + wx, wz);
			batch.add(place(cyl(0.45, 0.45, 0.14, 14).rotateX(Math.PI / 2), qx, 0.45, qz, ry), M.rail);
		}
	}
}

/** Цистерна на ж/д ходу: бочка 10 м, колпак, лесенка; paint — материал окраски. */
export function tankWagon(batch, M, collide, x, z, ry, paint) {
	const L = 10.4;
	bogies(batch, M, x, z, ry, L / 2);
	batch.add(place(box(L, 0.3, 2.4), x, 1.05, z, ry), M.metalDark); // рама
	const tank = cylX(1.45, L - 0.6, 20);
	batch.add(place(tank, x, 2.6, z, ry), paint);
	for (const ex of [-1, 1]) {
		const cap = new THREE.SphereGeometry(1.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1).rotateZ(-ex * Math.PI / 2);
		const c = Math.cos(ry), s = Math.sin(ry), lx = ex * (L / 2 - 0.3);
		batch.add(place(cap, x + lx * c, 2.6, z - lx * s, ry), paint);
	}
	batch.add(place(cyl(0.55, 0.55, 0.5, 14), x, 4.2, z, ry), paint); // колпак
	batch.add(place(box(1.6, 0.06, 0.6), x, 4.15, z, ry), M.metalDark); // площадка
	collide(x, z, L, 3.0, ry);
}

/** Платформа с морским контейнером. */
export function flatWagon(batch, M, collide, x, z, ry, cargo) {
	const L = 12.6;
	bogies(batch, M, x, z, ry, L / 2);
	batch.add(place(box(L, 0.35, 2.6), x, 1.1, z, ry), M.metalDark);
	batch.add(place(box(6, 2.6, 2.4, 1.5), x - Math.cos(ry) * 2.6, 2.6, z + Math.sin(ry) * 2.6, ry), cargo);
	collide(x, z, L, 3.0, ry);
}

/** Водонапорная башня Рожновского: кирпичный ствол, стальной бак наверху, лесенка. */
export function waterTower(batch, M, collide, x, z) {
	batch.add(place(cyl(1.5, 1.8, 13, 16), x, 6.5, z), M.brick);
	batch.add(place(cyl(2.8, 2.8, 3.6, 20), x, 14.6, z), M.metalRust);
	batch.add(place(cyl(2.95, 0.4, 1.0, 20), x, 16.9, z), M.metalRust);
	batch.add(place(box(1.0, 2.0, 0.08), x, 1.0, z + 1.75), M.metalDark); // дверь
	for (let y = 1; y < 13; y += 0.5) batch.add(place(box(0.5, 0.04, 0.04), x - 1.85, y, z), M.metalDark); // скобы-лесенка
	collide(x, z, 3.6, 3.6);
}

/** Кирпичная труба котельной с красно-белыми поясами. */
export function chimney(batch, M, collide, x, z, h = 26) {
	batch.add(place(box(4.2, 2.2, 4.2, 1.5), x, 1.1, z), M.brick);
	batch.add(place(cyl(0.95, 1.6, h, 16), x, h / 2 + 2, z), M.brick);
	for (const y of [h * 0.72, h * 0.86]) batch.add(place(cyl(1.18 - (y / h) * 0.45, 1.2 - (y / h) * 0.45, 1.2, 16), x, y + 2, z), M.whiteBrick);
	batch.add(place(cyl(1.08, 1.08, 0.6, 16), x, h + 2, z), M.red);
	collide(x, z, 4.2, 4.2);
}

/** Эстакада трубопроводов вдоль X: опоры через step м, три трубы (одна в серебристой изоляции). */
export function pipeRack(batch, M, collide, x0, x1, z, { y = 4.6, step = 7 } = {}) {
	const len = x1 - x0, cx = (x0 + x1) / 2;
	for (let x = x0; x <= x1 + 0.01; x += step) {
		for (const dz of [-0.9, 0.9]) batch.add(place(box(0.25, y, 0.25), x, y / 2, z + dz), M.metalRust);
		batch.add(place(box(0.25, 0.25, 2.2), x, y, z), M.metalRust);
		collide(x, z, 0.5, 2.1);
	}
	batch.add(place(cylX(0.35, len, 14), cx, y + 0.45, z - 0.5), M.silver);
	batch.add(place(cylX(0.22, len, 12), cx, y + 0.35, z + 0.15), M.metalRust);
	batch.add(place(cylX(0.18, len, 12), cx, y + 0.3, z + 0.65), M.metalDark);
}

/** Вертикальная ёмкость (ГСМ, кислота): обечайка, крыша-конус, лесенка; label — надпись. */
export function storageTank(batch, M, root, collide, x, z, r, h, paint, label) {
	batch.add(place(cyl(r, r, h, 24), x, h / 2, z), paint);
	batch.add(place(cyl(0.3, r + 0.1, 0.8, 24), x, h + 0.4, z), paint);
	for (let y = 0.6; y < h; y += 0.5) batch.add(place(box(0.5, 0.04, 0.04), x, y, z + r + 0.08), M.metalDark);
	if (label) {
		const s = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.4, 0.6), T.signMaterial(label, { bg: '#d8d0b0', fg: '#8a1a10', w: 384, h: 96 }));
		s.position.set(x, h * 0.6, z + r + 0.02);
		root.add(s);
	}
	collide(x, z, r * 2, r * 2);
}

/** Штабель больших труб. */
export function pipePile(batch, M, collide, x, z, ry = 0) {
	const c = Math.cos(ry), s = Math.sin(ry);
	const rows = [[-1.1, 0.5], [0, 0.5], [1.1, 0.5], [-0.55, 1.45], [0.55, 1.45]];
	for (const [lz, y] of rows) batch.add(place(cylX(0.5, 7, 14), x + lz * s, y, z + lz * c, ry), M.metalRust);
	collide(x, z, 7.2, 3.4, ry);
}

/** Бочки с химией (жёлтые с чёрной полосой), кучкой. */
export function hazardBarrels(batch, M, collide, x, z, rnd, n = 5) {
	for (let i = 0; i < n; i++) {
		const bx = x + (i % 3) * 0.7 - 0.7, bz = z + Math.floor(i / 3) * 0.7, tipped = rnd() < 0.2;
		if (tipped) batch.add(place(cyl(0.3, 0.3, 0.9, 12).rotateZ(Math.PI / 2), bx, 0.3, bz, rnd() * 3), M.hazard);
		else {
			batch.add(place(cyl(0.3, 0.3, 0.9, 12), bx, 0.45, bz), M.hazard);
			batch.add(place(cyl(0.31, 0.31, 0.12, 12), bx, 0.6, bz), M.metalDark);
		}
	}
	collide(x, z + 0.35, 2.2, 1.6);
}

/** БТР-80: восемь колёс, корпус с клиновидным носом, башенка с КПВТ. ry — куда смотрит нос. */
export function btr(batch, M, root, collide, x, z, ry) {
	const g = new THREE.Group();
	const add = (geo, mat, px, py, pz, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); };
	add(box(2.8, 1.1, 6.6, 2), M.khaki, 0, 1.25, 0);
	add(box(2.6, 0.5, 1.4, 2), M.khaki, 0, 1.55, 3.3, -0.55); // нос
	add(box(2.4, 0.5, 4.8, 2), M.khaki, 0, 2.0, -0.6);
	add(cyl(0.6, 0.7, 0.55, 14), M.khaki, 0, 2.5, 0.6);
	add(cyl(0.06, 0.06, 2.2, 8), M.metalDark, 0, 2.6, 1.8, Math.PI / 2);
	for (const wz of [-2.4, -0.9, 0.9, 2.4]) for (const wx of [-1.45, 1.45]) add(cyl(0.6, 0.6, 0.4, 16), M.tire, wx, 0.6, wz, 0, Math.PI / 2);
	g.position.set(x, 0, z); g.rotation.y = ry;
	root.add(g);
	collide(x, z, 3.2, 6.9, ry);
}

/** Армейский «Урал»: кабина, кузов под тентом. ry — куда смотрит кабина. */
export function armyTruck(batch, M, root, collide, x, z, ry) {
	const g = new THREE.Group();
	const add = (geo, mat, px, py, pz, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; g.add(m); };
	add(box(2.3, 0.4, 7.2), M.metalDark, 0, 1.0, 0);
	add(box(2.4, 1.3, 1.8, 1.5), M.khaki, 0, 1.85, 2.6); // кабина
	add(box(2.2, 0.6, 0.05), M.glass, 0, 2.2, 3.52);
	add(box(2.4, 1.2, 1.1, 1.5), M.khaki, 0, 1.45, 3.85); // капот
	add(box(2.5, 0.6, 4.4, 1.5), M.khaki, 0, 1.5, -1.2); // борта
	add(box(2.5, 1.5, 4.4, 2), M.canvas, 0, 2.55, -1.2); // тент
	for (const wz of [2.9, -0.4, -1.9]) for (const wx of [-1.15, 1.15]) add(cyl(0.55, 0.55, 0.4, 16), M.tire, wx, 0.55, wz, Math.PI / 2);
	g.position.set(x, 0, z); g.rotation.y = ry;
	root.add(g);
	collide(x, z, 2.7, 7.6, ry);
}

/** Шлагбаум у КПП: тумба и полосатая стрела (opened — поднята). */
export function barrier(batch, M, collide, x, z, ry, len = 5, opened = false) {
	batch.add(place(box(0.4, 1.0, 0.4), x, 0.5, z, ry), M.metalDark);
	const c = Math.cos(ry), s = Math.sin(ry);
	for (let i = 0; i < 6; i++) {
		const t = (i + 0.5) / 6 * len;
		const seg = box(len / 6, 0.12, 0.12);
		if (opened) batch.add(place(seg, x, 1.0 + t * 0.9, z, ry, 0, Math.PI / 2 * 0.9), i % 2 ? M.white : M.red);
		else batch.add(place(seg, x + c * t, 0.95, z - s * t, ry), i % 2 ? M.white : M.red);
	}
	collide(x, z, 0.5, 0.5);
}

/** Деревянная вышка часового с навесом. */
export function watchTower(batch, M, collide, x, z) {
	for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.16, 4.2, 0.16), x + dx * 0.9, 2.1, z + dz * 0.9), M.wood);
	batch.add(place(box(2.3, 0.14, 2.3), x, 4.2, z), M.wood);
	for (const [w, d, ox, oz] of [[2.3, 0.06, 0, -1.12], [2.3, 0.06, 0, 1.12], [0.06, 2.3, -1.12, 0], [0.06, 2.3, 1.12, 0]]) batch.add(place(box(w, 0.9, d), x + ox, 4.7, z + oz), M.woodGrey);
	for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add(place(box(0.1, 1.6, 0.1), x + dx * 1.1, 5.0, z + dz * 1.1), M.wood);
	batch.add(place(box(2.7, 0.1, 2.7, 2), x, 5.85, z), M.roofMetal);
	collide(x, z, 2.1, 2.1);
}

/** Огневая точка из мешков с песком: стенка длиной len, поворот ry. */
export function sandbags(batch, M, collide, x, z, len, ry) {
	const c = Math.cos(ry), s = Math.sin(ry);
	const n = Math.round(len / 0.55);
	for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
		const t = (i + 0.5 + (k % 2) * 0.5) / n * len - len / 2;
		if (t > len / 2) continue;
		batch.add(place(new THREE.SphereGeometry(0.3, 8, 6).scale(1.0, 0.45, 0.7), x + c * t, 0.14 + k * 0.25, z - s * t, ry), M.sandbag);
	}
	collide(x, z, len, 0.7, ry);
}

/** Щит с надписью на двух столбах (лозунг, указатель). */
export function billboard(batch, M, root, collide, x, z, ry, text, { w = 4, h = 1.2, y = 2.2, bg = '#c8b88a', fg = '#7a1c14' } = {}) {
	const c = Math.cos(ry), s = Math.sin(ry);
	for (const d of [-w / 2 + 0.2, w / 2 - 0.2]) batch.add(place(box(0.12, y + h / 2, 0.12), x + c * d, (y + h / 2) / 2, z - s * d), M.metalDark);
	const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), T.signMaterial(text, { bg, fg, w: 640, h: Math.round(640 * h / w) }));
	sign.position.set(x, y, z); sign.rotation.y = ry;
	root.add(sign);
	const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.metalDark);
	back.position.set(x - s * 0.01, y, z - c * 0.01); back.rotation.y = ry + Math.PI;
	root.add(back);
	// мешают только столбы: под щитом можно пройти (вывеска над воротами)
	for (const d of [-w / 2 + 0.2, w / 2 - 0.2]) collide(x + c * d, z - s * d, 0.35, 0.35);
}
