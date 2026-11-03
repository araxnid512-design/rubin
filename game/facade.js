// Детали фасадов и крыш: наличники, доски на окнах, козырьки, водостоки, вентиляция, хлам на балконах.
// Геометрия дешёвая: где деталь прижата к стене, у неё только видимые грани (четырёхугольники), остальное —
// коробки; всё сливается в пачки по материалам. Вид и место деталей — детерминированные (hash01 от имени постройки
// и номера детали): генератор случайных чисел локации не трогается, тайники, лут и заражённые не сдвигаются.

import * as THREE from 'three';
import { box } from './geom.js';
import { windowUV } from './textures.js';

/** Число 0..1 по набору значений — постоянное (вместо rnd(), чтобы не сдвигать случайности локации). */
export function hash01(...parts) {
	const s = parts.join('|');
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
	h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3();

/**
 * Набор четырёхугольников и треугольников → BufferGeometry с нормалями и UV в метрах (s — метров на повтор текстуры).
 * Углы — против часовой стрелки, если смотреть на лицевую сторону.
 */
export class Quads {
	constructor(s = 1) { this.p = []; this.n = []; this.uv = []; this.s = s; }

	_face(pts) {
		const [A, B] = pts, D = pts[pts.length - 1];
		_u.subVectors(B, A); _v.subVectors(D, A);
		_n.crossVectors(_u, _v).normalize();
		_u.normalize(); _v.crossVectors(_n, _u); // ось v — в плоскости грани, поперёк u
		const tri = pts.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2];
		for (const k of tri) {
			const P = pts[k];
			this.p.push(P.x, P.y, P.z);
			this.n.push(_n.x, _n.y, _n.z);
			_p.subVectors(P, A);
			this.uv.push(_p.dot(_u) / this.s, _p.dot(_v) / this.s);
		}
		return this;
	}
	quad(a, b, c, d) { return this._face([_a.set(...a), _b.set(...b), _c.set(...c), _d.set(...d)]); }
	tri(a, b, c) { return this._face([_a.set(...a), _b.set(...b), _c.set(...c)]); }

	/** Брусок, прижатый к плоскости z = z0 (задней грани нет): x0..x1, y0..y1, выступ до z1; bottom — с нижней гранью. */
	ledge(x0, x1, y0, y1, z0, z1, { bottom = false, ends = true } = {}) {
		this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // лицо
		this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]); // верх
		if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
		if (ends) {
			this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
			this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
		}
		return this;
	}

	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
		return g;
	}
}

/**
 * Наличник деревенского окна w×h (окно на плоскости z = 0, центр в начале координат, лицо — к +Z):
 * боковые доски, карниз с треугольным «кокошником» сверху и подоконный отлив. 15 треугольников.
 */
export function windowTrim(w = 1.1, h = 1.4) {
	const q = new Quads(0.5), x = w / 2, y = h / 2, b = 0.09;
	q.quad([-x - b, -y - 0.02, 0.035], [-x, -y - 0.02, 0.035], [-x, y + 0.02, 0.035], [-x - b, y + 0.02, 0.035]);
	q.quad([x, -y - 0.02, 0.035], [x + b, -y - 0.02, 0.035], [x + b, y + 0.02, 0.035], [x, y + 0.02, 0.035]);
	q.ledge(-x - b - 0.05, x + b + 0.05, y + 0.02, y + 0.13, 0, 0.09, { ends: false }); // карниз
	q.tri([-x - b, y + 0.13, 0.05], [x + b, y + 0.13, 0.05], [0, y + 0.36, 0.05]); // кокошник
	q.ledge(-x - b - 0.04, x + b + 0.04, -y - 0.09, -y - 0.02, 0, 0.13, { ends: false }); // отлив
	return q.geometry();
}

/** Подоконник и перемычка кирпичного окна w×h (бетон/жесть): 8 треугольников. */
export function windowSill(w = 1.1, h = 1.4) {
	const q = new Quads(0.5), x = w / 2 + 0.06, y = h / 2;
	q.ledge(-x, x, -y - 0.08, -y, 0, 0.12, { ends: false });
	q.ledge(-x, x, y, y + 0.14, 0, 0.03, { ends: false });
	return q.geometry();
}

/**
 * Две-три доски крест-накрест или поперёк проёма w×h (окно на плоскости z = 0, лицо к +Z); k — вариант (0..1).
 * Коробки (их видно с боков): 24–36 треугольников.
 */
export function windowBoards(w, h, k, box) {
	const list = [];
	const n = k < 0.5 ? 2 : 3, len = w + 0.24;
	for (let i = 0; i < n; i++) {
		const g = box(len, 0.15 + (i % 2) * 0.03, 0.035, 0.8);
		const tilt = k < 0.5 ? (i ? -1 : 1) * Math.atan2(h * 0.7, w) : (hash01(k, i) - 0.5) * 0.35;
		const y = k < 0.5 ? 0 : (i - (n - 1) / 2) * h * 0.32;
		g.rotateZ(tilt);
		g.translate((hash01(i, k, 'x') - 0.5) * 0.08, y, 0.05 + i * 0.015);
		list.push(g);
	}
	return list;
}

// ---------- Хрущёвка (Заречный) ----------

/**
 * Балкон: плита и ограждение буквой П из четырёхугольников (с обеих сторон и с верхней кромкой — 18 треугольников).
 * x, y — середина и уровень плиты; zFace — плоскость фасада; dir — куда выступает (±1 по Z); rail — материал
 * ограждения; h — постоянное число 0..1: застеклён (окна из атласа) или на плите хлам. full = false — только
 * наружные грани (фасад, который камера почти не видит).
 */
export function balcony(kb, M, x, y, zFace, dir, rail, h, { full = true, top = false } = {}) {
	const at = (g) => { if (dir < 0) g.rotateY(Math.PI); return g.translate(x, 0, zFace); };
	kb.add(at(box(2.8, 0.12, 1.1, 1).translate(0, y, 0.55)), M.concrete);
	const q = new Quads(1), y0 = y + 0.06, y1 = y + 1.06, X = 1.4, Z = 1.1, t = 0.06;
	q.quad([-X, y0, Z], [X, y0, Z], [X, y1, Z], [-X, y1, Z]);
	q.quad([-X, y1, Z], [X, y1, Z], [X, y1, Z - t], [-X, y1, Z - t]);
	q.quad([X, y0, Z - t], [X, y0, 0], [X, y1, 0], [X, y1, Z - t]);
	q.quad([-X, y0, 0], [-X, y0, Z - t], [-X, y1, Z - t], [-X, y1, 0]);
	if (full) {
		q.quad([X, y0, Z - t], [-X, y0, Z - t], [-X, y1, Z - t], [X, y1, Z - t]);
		q.quad([X - t, y0, 0], [X - t, y0, Z - t], [X - t, y1, Z - t], [X - t, y1, 0]);
		q.quad([-X + t, y0, Z - t], [-X + t, y0, 0], [-X + t, y1, 0], [-X + t, y1, Z - t]);
		q.quad([X - t, y1, Z - t], [X, y1, Z - t], [X, y1, 0], [X - t, y1, 0]);
		q.quad([-X, y1, Z - t], [-X + t, y1, Z - t], [-X + t, y1, 0], [-X, y1, 0]);
	}
	kb.add(at(q.geometry()), rail);
	if (!full) return;
	if (h < 0.3) {
		// застеклённый балкон: деревянные рамы до плиты сверху (у верхнего этажа — свой козырёк)
		const gh = 1.62, gy = y1 + gh / 2;
		kb.add(at(windowUV(new THREE.PlaneGeometry(2.8, gh), h < 0.12 ? 7 : 4).translate(0, gy, Z - 0.02)), M.window);
		for (const s of [-1, 1]) kb.add(at(windowUV(new THREE.PlaneGeometry(Z - 0.04, gh), 4).rotateY(s * Math.PI / 2).translate(s * (X - 0.02), gy, Z / 2)), M.window);
		if (top) kb.add(at(box(3.0, 0.08, 1.3, 1).rotateX(0.06).translate(0, y1 + gh + 0.06, 0.6)), M.metalRust);
	} else if (h < 0.75) {
		// хлам: ящики, старая тумба, покрышка, свёрнутый ковёр
		const k = Math.floor(hash01(h, 'junk') * 4);
		const side = hash01(h, 's') < 0.5 ? -1 : 1;
		if (k === 0) { kb.add(at(box(0.6, 0.45, 0.45, 0.8).translate(side * 0.8, y + 0.29, 0.6)), M.woodGrey); kb.add(at(box(0.5, 0.35, 0.4, 0.8).translate(side * 0.75, y + 0.68, 0.62)), M.wood); }
		if (k === 1) kb.add(at(box(0.6, 0.9, 0.5, 0.8).translate(side * 0.85, y + 0.51, 0.55)), M.white);
		if (k === 2) kb.add(at(box(0.6, 0.22, 0.6, 1).translate(side * 0.7, y + 0.17, 0.6)), M.tire);
		if (k === 3) kb.add(at(box(2.0, 0.22, 0.22, 1).translate(side * 0.15, y + 0.17, 0.8)), M.canvas);
	}
}

/**
 * Хрущёвка: крыша с парапетом, выходами на крышу, вентшахтами и антеннами; окна обоих длинных фасадов — плоскости
 * с клетками атласа окон (целые, выбитые и закопчённые, заколоченные — у первого этажа с досками поверх,
 * с занавесками); балконы на южном фасаде; водосточные трубы. Всё — в группе здания (исчезает вместе с ним).
 */
export function khrushchyovkaDetails(kb, M, { cx, cz, W, D, H }) {
	const top = H + 0.6;
	// крыша: рубероид ниже парапета
	kb.add(box(W, 0.06, D, 4).translate(cx, top + 0.03, cz), M.roofTar);
	for (const s of [-1, 1]) {
		kb.add(box(W + 0.4, 0.55, 0.25, 2).translate(cx, top + 0.275, cz + s * (D / 2 + 0.075)), M.concrete);
		kb.add(box(0.25, 0.55, D - 0.1, 2).translate(cx + s * (W / 2 + 0.075), top + 0.275, cz), M.concrete);
	}
	// выходы на крышу над подъездами: будка с железной дверью к югу
	for (const ex of [-12.8, 0, 12.8]) {
		const x = cx + ex, z = cz - D / 2 + 1.6;
		kb.add(box(2.2, 2.0, 1.8, 2).translate(x, top + 1.0, z), M.brick);
		kb.add(box(2.5, 0.12, 2.1, 2).translate(x, top + 2.06, z), M.roofTar);
		kb.add(box(0.9, 1.75, 0.06, 1).translate(x + 0.4, top + 0.9, z + 0.92), M.metalRust);
	}
	// вентшахты: кирпич с бетонной крышкой
	for (const [i, ex] of [-15.6, -9.4, -3.2, 3.2, 9.4, 15.6].entries()) {
		const x = cx + ex, z = cz + (i % 2 ? 1.2 : -0.6);
		kb.add(box(1.0, 0.85, 0.55, 1).translate(x, top + 0.425, z), M.brick);
		kb.add(box(1.16, 0.08, 0.7, 1).translate(x, top + 0.92, z), M.concrete);
	}
	// телевизионные антенны и заплатки рубероида
	for (const [ex, ez] of [[-11, 3.2], [5.5, 2.4], [14, -2.8]]) {
		const x = cx + ex, z = cz + ez;
		kb.add(box(0.06, 2.4, 0.06, 1).translate(x, top + 1.2, z), M.metalDark);
		kb.add(box(1.3, 0.04, 0.04, 1).translate(x, top + 2.2, z), M.metalDark);
		kb.add(box(0.9, 0.04, 0.04, 1).translate(x, top + 1.85, z), M.metalDark);
	}
	for (const [ex, ez, w, d, r] of [[-6, 1.8, 3.2, 2.0, 0.2], [8, -1.5, 2.4, 1.6, -0.3], [-15, -2.6, 2.0, 2.6, 0.1]]) {
		kb.add(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).rotateY(r).translate(cx + ex, top + 0.065, cz + ez), M.tire);
	}
	// окна длинных фасадов: клетки атласа (см. houseWindowMaterial) — по месту, без генератора случайных чисел
	for (const s of [-1, 1]) for (let f = 0; f < 5; f++) for (let c = 0; c < 12; c++) {
		const h = hash01('khr-win', s, f, c), x = cx - W / 2 + 1.6 + c * 3.2, y = 0.6 + f * 2.8 + 1.38;
		const k = f === 0 ? (h < 0.32 ? 6 : h < 0.5 ? 5 : h < 0.75 ? 4 : 7) : (h < 0.08 ? 6 : h < 0.25 ? 5 : h < 0.5 ? 7 : 4);
		const g = windowUV(new THREE.PlaneGeometry(1.62, 1.44), k);
		if (s < 0) g.rotateY(Math.PI);
		kb.add(g.translate(x, y, cz + s * (D / 2 + 0.02)), M.window);
		if (k === 6 && f === 0) for (const b of windowBoards(1.45, 1.3, hash01(h, 'b'), box)) {
			if (s < 0) b.rotateY(Math.PI);
			kb.add(b.translate(x, y, cz + s * (D / 2 + 0.03)), M.woodGrey);
		}
	}
	// балконы на южном фасаде — стояками (по два через два), часть обвалилась или снята
	for (let f = 1; f < 5; f++) for (const c of [1, 2, 5, 6, 9, 10]) {
		const h = hash01('khr-s', c, f);
		if (h > 0.86) continue;
		const rail = [M.metalRust, M.woodGrey, M.metalOlive][Math.floor(hash01(c, f, 'rail') * 3)];
		balcony(kb, M, cx - W / 2 + 1.6 + c * 3.2, 0.6 + f * 2.8, cz + D / 2, 1, rail, h, { top: f === 4 });
	}
	// водосточные трубы: воронка у парапета, колено у земли
	for (const s of [-1, 1]) for (const ex of [-(W / 2 - 0.3), -6.4, 6.4, W / 2 - 0.3]) {
		const x = cx + ex, z = cz + s * (D / 2 + 0.11);
		kb.add(box(0.14, top + 0.2, 0.14, 1).translate(x, (top + 0.2) / 2 + 0.3, z), M.roofTin);
		kb.add(box(0.3, 0.3, 0.3, 1).translate(x, top + 0.35, z + s * 0.04), M.roofTin);
		kb.add(box(0.14, 0.12, 0.42, 1).translate(x, 0.33, z + s * 0.16), M.roofTin);
	}
}
