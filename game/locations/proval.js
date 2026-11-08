// Кластер «Провал»: химкомбинат «Прогресс», под которым Улей выел землю, — посреди завода огромная воронка.
// Главный ориентир — сам провал (север середины, радиус 18–22 м): чёрная бездна с пластами породы по склонам,
// край — рваный вал земли и обломков, плиты съезжают вниз, из глубины светятся споровые наросты, через край
// выползают тяжи споровой массы. Вокруг — АРЕНА шириной ~14 м (выжженная земля), тут живёт СКРЕБЕР: его логово —
// на северном краю (гнездо из костей и споровой массы, брошенные ящики военных — самая ценная добыча кластера).
// На арене — укрытия: бетонные плиты, блоки, глыбы, ржавые аппараты; ещё два гнезда — на западе и юго-востоке.
// Северо-восточный корпус (аппаратный цех) наполовину рухнул в провал: стены обрываются у края, плита перекрытия
// съехала вниз, кран-балка свисает над бездной. Северо-запад — руины цеха синтеза № 3 (стены без крыши, проломы,
// колонны-реакторы). Запад — склад реагентов (химия!), восток — ёмкостный парк с ржавыми ёмкостями; от обоих к
// провалу тянутся эстакады труб, оборванные над бездной. У северо-восточного края — ж/д тупик с цистернами.
// Юг: дорога с запада (Аэродром) на восток (Шахта) идёт вдоль южного края арены; у арены — оцепление военных:
// сгоревший БТР, мешки с песком, ежи, «Урал», палатка с оружейным ящиком. Дальше — аллея к южным воротам,
// заводоуправление (юго-запад) со стоянкой, центральная заводская лаборатория (юго-восток), шламонакопитель.
// Забор комбината — с проломами; за ним мёртвый лес. Земля отравлена: грунт и трава жёлто-серые.
// Опасность 4 — чёрная зона: скребер у северного края провала, две элиты — у склада реагентов и в ёмкостном
// парке, руберы — на арене, в обрушенном цехе и у лаборатории; топтуны и бегуны — по корпусам и дорогам.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, chair, table, CUT } from '../buildings.js';
import { addCar, blob, pond } from '../props.js';
import { concreteFence, storageTank, hazardBarrels, btr, armyTruck, sandbags, billboard, barrier, pipeRack, railTrack, tankWagon, pipePile } from '../props-industrial.js';

const Z = Math.PI / 2;
const DEG = Math.PI / 180;
const C = [0, -40]; // центр провала
const RC = 20; // средний радиус провала
const ARENA = 34; // внешний край арены (от центра провала)
const LAIR = [2, -66]; // логово скребера — северный край провала
const HALL_A = -28 * DEG; // обрушенный аппаратный цех: направление от центра провала
const HALL_SECTOR = 22 * DEG; // его сектор у края (там свои обломки)
const SHOP3 = [-60, -62]; // руины цеха синтеза № 3
const STORE = [-52, -24]; // склад реагентов
const ADMIN = [-46, 34]; // заводоуправление
const LAB = [46, 34]; // центральная заводская лаборатория
const TF = { x0: 44, x1: 74, z0: -48, z1: -12 }; // ёмкостный парк в обваловании
const FX = 78, FN = -80, FS = 62; // забор комбината: запад/восток (±x), север западной стороны, юг
const RAIL = -77; // ж/д тупик у северо-восточного края

/** Детерминированный шум 0…1 (без генератора случайных чисел: места не сдвигаются). */
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
/** Радиус края провала по направлению a (рад): неровный, 18–22 м. */
const rimR = (a) => RC * (1 + 0.055 * Math.sin(3 * a + 0.7) + 0.035 * Math.sin(7 * a + 2.1) + 0.02 * Math.sin(13 * a + 4));
/** Точка на направлении a в r м от центра провала. */
const polar = (a, r) => [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];
/** Точка над провалом (с запасом m за край). */
const inPit = (x, z, m = 0) => Math.hypot(x - C[0], z - C[1]) < rimR(Math.atan2(z - C[1], x - C[0])) + m;
/** Разница углов в −π…π. */
const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);
const UP = new THREE.Vector3(0, 1, 0);

/** Цилиндр радиуса r от точки a до точки b ([x, y, z]): труба, кость, арматура, ветка. */
function tube(kb, mat, a, b, r, seg = 8, opts) {
	const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const g = cyl(r, r, v.length(), seg);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, v.normalize()));
	kb.add(g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), mat, opts);
}

/** Брус сечением w от точки a до точки b (балки, фермы, кран-балка). */
function beam(kb, mat, a, b, w = 0.3) {
	const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const g = box(w, v.length(), w, 1, 2);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, v.normalize()));
	kb.add(g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), mat);
}

// ---------- Провал ----------

/**
 * Бездна: круговой градиент от бурого края к чёрной середине, рваные кольца пластов породы, языки осыпей.
 * Сверху читается как глубокая воронка (земля под ногами плоская — глубину рисует текстура).
 */
function pitMaterial() {
	const S = 512, h = S / 2, c = document.createElement('canvas');
	c.width = c.height = S;
	const g = c.getContext('2d'), rnd = T.mulberry(4321);
	const grad = g.createRadialGradient(h, h, 0, h, h, h);
	for (const [f, col] of [[0, '#000000'], [0.42, '#030303'], [0.62, '#0c0a09'], [0.78, '#1b1714'], [0.88, '#2c2620'], [0.95, '#3e352c'], [1, '#4a4034']]) grad.addColorStop(f, col);
	g.fillStyle = grad;
	g.fillRect(0, 0, S, S);
	// пласты породы по склонам: рваные кольца — светлые (известняк) и тёмные (сажа, сырость)
	for (let i = 0; i < 16; i++) {
		const f = 0.5 + rnd() * 0.47, light = rnd() < 0.5;
		g.strokeStyle = light ? `rgba(122,108,88,${(0.08 + f * 0.28).toFixed(2)})` : `rgba(0,0,0,${(0.25 + rnd() * 0.3).toFixed(2)})`;
		g.lineWidth = 1 + rnd() * 5 * f;
		let a = rnd() * Math.PI * 2;
		const end = a + Math.PI * (0.4 + rnd() * 1.4);
		g.beginPath();
		for (; a < end; a += 0.04) { const r = h * (f + Math.sin(a * 5 + i) * 0.012); g.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r); }
		g.stroke();
	}
	// осыпи: языки от края вниз
	for (let i = 0; i < 46; i++) {
		const a = rnd() * Math.PI * 2, r0 = h * (0.97 - rnd() * 0.05), r1 = h * (0.5 + rnd() * 0.32);
		g.strokeStyle = rnd() < 0.55 ? `rgba(112,98,80,${(0.12 + rnd() * 0.2).toFixed(2)})` : `rgba(14,12,10,${(0.3 + rnd() * 0.3).toFixed(2)})`;
		g.lineWidth = 2 + rnd() * 7;
		g.beginPath();
		g.moveTo(h + Math.cos(a) * r0, h + Math.sin(a) * r0);
		g.lineTo(h + Math.cos(a + 0.04) * r1, h + Math.sin(a + 0.04) * r1);
		g.stroke();
	}
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
}

/** Дно провала: круг с неровным краем, развёртка — единичный круг (градиент текстуры доходит ровно до края). */
function pitDisk(kb, mat) {
	const g = new THREE.CircleGeometry(1, 144).rotateX(-Math.PI / 2);
	const p = g.attributes.position;
	for (let i = 1; i < p.count; i++) {
		const x = p.getX(i), z = p.getZ(i), r = rimR(Math.atan2(z, x)) + 0.3;
		p.setXYZ(i, x * r, 0, z * r);
	}
	kb.add(g.translate(C[0], 0.04, C[1]), mat, { cast: false });
}

/**
 * Край провала: вал из земли и щебня по всему кругу — с внутренней стороны обрыв, наружу пологий спуск; гребень
 * рваный (выше-ниже). Профиль: [отступ от края, высота].
 */
/** Профиль вала по краю провала: [отступ от края, высота]. */
const LIP = [[-1.1, 0.046], [-0.5, 0.22], [0.0, 0.42], [0.45, 0.3], [1.0, 0.1], [1.9, 0.02]];
/** Высота вала в точке (x, z) — примерно, без неровностей гребня: чтобы тяжи и наросты не тонули в нём. */
function lipY(x, z) {
	const d = Math.hypot(x - C[0], z - C[1]) - rimR(Math.atan2(z - C[1], x - C[0]));
	if (d <= LIP[0][0]) return 0.04;
	for (let i = 1; i < LIP.length; i++) if (d <= LIP[i][0]) { const [d0, y0] = LIP[i - 1], [d1, y1] = LIP[i]; return y0 + (y1 - y0) * (d - d0) / (d1 - d0); }
	return 0.02;
}

function rimLip(kb, mat) {
	const A = 160, prof = LIP;
	const P = prof.length, pos = [], uv = [], idx = [];
	for (let j = 0; j <= A; j++) {
		const a = (j % A) / A * Math.PI * 2, r0 = rimR(a);
		const k = 0.8 + 0.28 * Math.sin(a * 11 + 0.5) + 0.22 * hash(j % A, 3); // гребень выше-ниже
		const wide = 1 + 0.35 * Math.sin(a * 5 + 1); // осыпь наружу то шире, то уже
		for (const [d, y] of prof) {
			const r = r0 + (d > 0 ? d * wide : d), x = C[0] + Math.cos(a) * r, z = C[1] + Math.sin(a) * r;
			pos.push(x, y > 0.1 ? y * k : y, z);
			uv.push(x / 4, z / 4);
		}
	}
	for (let j = 0; j < A; j++) for (let i = 0; i < P - 1; i++) {
		const b = j * P + i;
		idx.push(b, b + P, b + 1, b + P, b + P + 1, b + 1);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	kb.add(g, mat, { cast: false });
}

/** Провал непроходим: коллайдер — полосы вдоль X по многоугольнику края (с запасом на гребень вала). */
function pitCollide(collide) {
	const pts = [];
	for (let i = 0; i < 240; i++) { const a = i / 240 * Math.PI * 2; pts.push(polar(a, rimR(a) + 0.55)); }
	const z0 = Math.min(...pts.map((p) => p[1])), z1 = Math.max(...pts.map((p) => p[1])), n = 40, h = (z1 - z0) / n;
	for (let k = 0; k < n; k++) {
		const zm = z0 + (k + 0.5) * h;
		let xa = Infinity, xb = -Infinity;
		for (let i = 0; i < pts.length; i++) {
			const [px, pz] = pts[i], [qx, qz] = pts[(i + 1) % pts.length];
			if ((pz - zm) * (qz - zm) > 0 || pz === qz) continue;
			const x = px + (qx - px) * (zm - pz) / (qz - pz);
			xa = Math.min(xa, x); xb = Math.max(xb, x);
		}
		if (xb > xa) collide((xa + xb) / 2, zm, xb - xa, h + 0.05);
	}
}

/** Кости вокруг (x, z) в радиусе rad: трубчатые, черепа, грудные клетки (позвоночник и дуги рёбер); y — подъём. */
function bones(kb, mat, x, z, n, rad, seed, y = 0.045) {
	for (let i = 0; i < n; i++) {
		const a = seed + i * 2.39, d = rad * Math.sqrt(hash(seed, i)), len = 0.35 + hash(i, seed) * 0.4;
		kb.add(place(cyl(0.035, 0.045, len, 6).rotateZ(Z), x + Math.cos(a) * d, y, z + Math.sin(a) * d, a * 1.7), mat, { cast: false });
	}
	for (let i = 0; i < Math.max(1, Math.round(n / 5)); i++) {
		const a = seed * 1.3 + i * 2.7, d = rad * 0.6 * hash(seed + 3, i), sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
		kb.add(place(new THREE.SphereGeometry(0.12, 8, 6).scale(0.9, 0.85, 1.15), sx, y + 0.06, sz, a), mat, { cast: false });
		const ra = a + 1.2, cx = sx + Math.cos(ra) * 0.7, cz = sz + Math.sin(ra) * 0.7, yaw = a * 2.3;
		kb.add(place(cyl(0.03, 0.03, 0.8, 6).rotateZ(Z), cx, y + 0.02, cz, yaw), mat, { cast: false });
		for (let k = 0; k < 4; k++) {
			const rib = new THREE.TorusGeometry(0.16 - k * 0.015, 0.018, 4, 8, Math.PI).rotateY(Z).translate(-0.3 + k * 0.2, 0, 0);
			kb.add(place(rib, cx, y, cz, yaw), mat, { cast: false });
		}
	}
}

// ---------- Укрытия, техника, мелочи ----------

/** Противотанковый ёж: три сваренных двутавра. */
function hedgehog(kb, M, collide, x, z, ry) {
	for (let k = 0; k < 3; k++) kb.add(place(box(0.16, 2.0, 0.16).rotateX(Math.PI / 4).rotateY(ry + k * Math.PI * 2 / 3), x, 0.72, z), M.metalDark);
	collide(x, z, 1.5, 1.5, ry);
}

/** Укрытие на арене по виду: lean — плита наклонно, stack — плиты стопкой, vessel — ржавый аппарат на боку, blocks — ФБС, blob — глыба. */
function cover(kb, M, collide, kind, x, z, ry, seed) {
	if (kind === 'lean') {
		kb.add(place(box(3.4, 0.3, 2.2, 1.5).rotateX(1.05), x, 0.9, z, ry), M.concrete);
		kb.add(place(box(3.0, 0.25, 1.8, 1.5), x + Math.sin(ry) * 1.3, 0.13, z + Math.cos(ry) * 1.3, ry + 0.2), M.concreteDark);
		collide(x, z, 3.4, 1.4, ry);
		collide(x + Math.sin(ry) * 1.3, z + Math.cos(ry) * 1.3, 3.0, 1.8, ry + 0.2);
	} else if (kind === 'stack') {
		for (let k = 0; k < 3; k++) kb.add(place(box(3.6 - k * 0.3, 0.28, 1.8, 1.5), x + k * 0.15, 0.14 + k * 0.28, z, ry + k * 0.12 - 0.1), k % 2 ? M.concreteDark : M.concrete);
		collide(x, z, 3.9, 2.2, ry);
	} else if (kind === 'vessel') {
		kb.add(place(cyl(1.1, 1.1, 4.6, 16).rotateZ(Z), x, 1.05, z, ry), M.metalRust);
		kb.add(place(new THREE.SphereGeometry(1.1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1).rotateZ(-Z), x + Math.cos(ry) * 2.3, 1.05, z - Math.sin(ry) * 2.3, ry), M.metalRust);
		kb.add(place(cyl(0.3, 0.3, 0.6, 10), x - Math.cos(ry) * 1.0, 2.3, z + Math.sin(ry) * 1.0), M.metalDark); // штуцер
		collide(x, z, 5.0, 2.3, ry);
	} else if (kind === 'blocks') {
		for (const [dx, y, dz] of [[0, 0.3, -0.33], [0.1, 0.3, 0.33], [0.4, 0.9, 0]]) {
			kb.add(place(box(2.4, 0.6, 0.62, 1.2), x + Math.cos(ry) * dx + Math.sin(ry) * dz, y, z - Math.sin(ry) * dx + Math.cos(ry) * dz, ry + (y > 0.5 ? 0.15 : 0)), M.concreteDark);
		}
		collide(x, z, 2.8, 1.5, ry);
	} else {
		const s = 1.3 + hash(seed) * 0.4;
		kb.add(place(blob(s, 1, 700 + seed).scale(1.3, 0.75, 1), x, s * 0.35, z, ry), M.concreteDark);
		for (let k = 0; k < 4; k++) tube(kb, M.metalRust, [x + Math.cos(k * 1.6) * 0.5, 0.8, z + Math.sin(k * 1.6) * 0.5], [x + Math.cos(k * 1.6) * 0.9, 1.9 + hash(seed, k) * 0.6, z + Math.sin(k * 1.6) * 1.0], 0.025, 4);
		collide(x, z, s * 2.4, s * 1.9, ry);
	}
}

/**
 * Эстакада труб от a до b ([x, z]): опоры через step м, три трубы на высоте y. broken — у конца b (край провала)
 * пролёт рухнул: последняя опора за 5 м до края, трубы обрываются и свисают в бездну. skip — без первой опоры.
 */
function estakada(kb, M, collide, a, b, { y = 4.6, step = 8, broken = false, skip = false } = {}) {
	const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, ry = Math.atan2(-dz, dx);
	for (let d = skip ? step : 0; d <= (broken ? len - 5 : len) + 0.01; d += step) {
		const x = a[0] + ux * d, z = a[1] + uz * d;
		for (const s of [-0.9, 0.9]) kb.add(place(box(0.25, y, 0.25), x - uz * s, y / 2, z + ux * s, ry), M.metalRust);
		kb.add(place(box(0.25, 0.25, 2.2), x, y, z, ry), M.metalRust);
		collide(x, z, 0.5, 2.1, ry);
	}
	const end = broken ? len - 0.8 : len;
	for (const [off, r, mat, dy, droop] of [[-0.5, 0.35, M.silver, 0.45, 5.5], [0.15, 0.22, M.metalRust, 0.35, 3.5], [0.65, 0.18, M.metalDark, 0.3, 6.5]]) {
		const p0 = [a[0] - uz * off, y + dy, a[1] + ux * off], p1 = [p0[0] + ux * end, y + dy, p0[2] + uz * end];
		tube(kb, mat, p0, p1, r, 12);
		// оборванная труба: висит, уходя вниз в провал
		if (broken) tube(kb, mat, p1, [p1[0] + ux * droop * 0.55, y + dy - droop, p1[2] + uz * droop * 0.55], r * 0.98, 12);
	}
}

/** Сухое дерево: голый ствол и несколько веток. */
function deadTree(kb, M, collide, x, z, s, seed) {
	const h = (4.5 + hash(seed) * 3) * s;
	kb.add(place(cyl(0.1 * s, 0.22 * s, h, 7), x, h / 2, z, seed), M.bark);
	for (let k = 0; k < 4; k++) {
		const a = seed * 1.9 + k * 1.7, y = h * (0.45 + k * 0.13), len = (1.5 - k * 0.22) * s;
		tube(kb, M.bark, [x, y, z], [x + Math.cos(a) * len * 0.8, y + len * 0.6, z + Math.sin(a) * len * 0.8], 0.06 * s * (1 - k * 0.15), 5);
	}
	collide(x, z, 0.5, 0.5);
}

// ---------- Мебель-тайники ----------

/** Шкафчик (тайник); лицо — в +Z своих осей. */
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
/** Электрошкаф или шкаф КИП (тайник). */
const cabinet = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.1, 2.0, 0.6, 0, 1.0, 0, b.IM.machine], [0.02, 1.9, 0.02, 0, 1.0, 0.31, b.IM.black], [0.3, 0.2, 0.02, 0.25, 1.5, 0.31, b.IM.screen],
], [1.1, 0.6], loot, 2.0);
/** Стеллаж с банками и бутылями (тайник). */
const shelf = (b, name, x, z, rot, loot, w = 3.2) => b.container(name, x, z, rot, [
	...[-w / 2 + 0.05, w / 2 - 0.05].flatMap((dx) => [-0.35, 0.35].map((dz) => [0.07, 2.4, 0.07, dx, 1.2, dz, b.IM.rack])),
	...[0.15, 0.95, 1.75, 2.35].map((y) => [w, 0.05, 0.85, 0, y, 0, b.IM.rack]),
	[w * 0.3, 0.4, 0.5, -w * 0.25, 0.4, 0, b.IM.jars], [w * 0.25, 0.45, 0.55, w * 0.22, 0.4, 0, b.IM.bottles[0]],
	[w * 0.35, 0.35, 0.5, w * 0.1, 1.15, 0, b.IM.jars], [w * 0.2, 0.5, 0.5, -w * 0.3, 1.22, 0, b.IM.bottles[1]],
	[w * 0.4, 0.3, 0.5, -w * 0.05, 1.92, 0, b.IM.crate],
], [w, 0.9], loot, 2.4);
/** Длинный армейский ящик с замками (тайник). */
const armyCrate = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[1.8, 0.5, 0.65, 0, 0.25, 0, b.IM.crateGreen], [1.82, 0.05, 0.67, 0, 0.52, 0, b.IM.machine],
	[0.1, 0.12, 0.03, -0.55, 0.4, 0.34, b.IM.black], [0.1, 0.12, 0.03, 0.55, 0.4, 0.34, b.IM.black],
	[1.0, 1.0, 1.0, 0, 0, 0, b.IM.crateGreen, { geo: place(box(1.8, 0.06, 0.66), 0.05, 0.72, -0.12, 0, -0.6) }], // крышка откинута
], [1.8, 0.75], loot, 0.9);
/** Аптечка на стене (тайник). */
const firstAid = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [
	[0.5, 0.45, 0.2, 0, 1.4, 0, b.IM.white], [0.2, 0.06, 0.01, 0, 1.4, 0.105, b.IM.redBoard], [0.06, 0.2, 0.01, 0, 1.4, 0.106, b.IM.redBoard],
], [0.4, 0.2], loot, 1.65);

// ---------- Руины ----------

/**
 * Обломанная стена здания b (в его осях): вдоль X (axis 'x', на линии z = k) или вдоль Z (x = k) от s0 до s1. Верх
 * рваный — куски по ~2,4 м разной высоты (у пролома ниже); gaps — проломы [[a0, a1], …] без перемычек. Низ — со
 * стенами, верх — с «крышей» здания (исчезает, когда герой внутри или стена его загораживает).
 */
function ruinWall(b, axis, k, s0, s1, { mat, t = 0.4, gaps = [], H, seed = 0 }) {
	const solids = [];
	let cur = s0;
	for (const [a, c] of [...gaps].sort((p, q) => p[0] - q[0])) { if (a > cur) solids.push([cur, a]); cur = Math.max(cur, c); }
	if (cur < s1) solids.push([cur, s1]);
	for (const [a0, a1] of solids) {
		if (a1 - a0 < 0.2) continue;
		const n = Math.max(1, Math.round((a1 - a0) / 2.4));
		for (let i = 0; i < n; i++) {
			const p0 = a0 + (a1 - a0) * i / n, p1 = a0 + (a1 - a0) * (i + 1) / n, len = p1 - p0, mid = (p0 + p1) / 2;
			const byGap = (i === 0 && a0 > s0) || (i === n - 1 && a1 < s1);
			const h = Math.max(CUT + 0.35, H * (0.38 + 0.62 * hash(seed + mid * 0.37, k * 1.3)) * (byGap ? 0.6 : 1));
			const piece = (y0, y1, up) => {
				const g = axis === 'x' ? box(len + 0.01, y1 - y0, t, 1.5) : box(t, y1 - y0, len + 0.01, 1.5);
				place(g, axis === 'x' ? mid : k, (y0 + y1) / 2, axis === 'x' ? k : mid);
				if (up) b.top_(g, mat); else b.lower(g, mat);
			};
			piece(0, CUT, false);
			piece(CUT, h, true);
		}
		if (axis === 'x') b.collide((a0 + a1) / 2, k, a1 - a0, t + 0.04, 0, true); else b.collide(k, (a0 + a1) / 2, t + 0.04, a1 - a0, 0, true);
	}
}

/** Стойка каркаса (двутавр) высотой h: низ — со стенами, верх — с крышей. */
function column(b, x, z, h, mat, w = 0.4) {
	b.lower(place(box(w, CUT, w), x, CUT / 2, z), mat);
	b.top_(place(box(w, h - CUT, w), x, CUT + (h - CUT) / 2, z), mat);
	b.collide(x, z, w + 0.05, w + 0.05);
}

/** Вертикальный аппарат (реактор, колонна) радиуса r высотой h с куполом. */
function vessel(b, x, z, r, h, mat) {
	b.lower(place(cyl(r, r, CUT, 16), x, CUT / 2, z), mat);
	b.top_(place(cyl(r, r, h - CUT, 16), x, (CUT + h) / 2, z), mat);
	b.top_(place(new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1), x, h, z), mat);
	b.top_(place(cyl(0.18, 0.18, 1.2, 8), x + r * 0.4, h + 0.8, z), b.ctx.M.metalDark);
	b.collide(x, z, r * 2, r * 2);
}

/** Куча битого кирпича и бетона внутри здания (локальные x, z). */
function rubble(b, x, z, s, mat, seed) {
	b.lower(place(blob(s, 1, 500 + seed).scale(1.5, 0.42, 1.15), x, s * 0.12, z, seed), mat);
	b.lower(place(box(1.6 * s, 0.22, 1.1 * s, 1.2), x + s * 0.6, s * 0.35, z - s * 0.2, seed * 0.7, 0.25, 0.3), b.ctx.M.concrete);
	b.collide(x, z, s * 2.6, s * 1.9, seed);
}

/**
 * Руины цеха синтеза № 3 (28×16 м, кирпич): кровля рухнула, уцелел только кусок над западным концом; стены с рваным
 * верхом и проломами, стойки каркаса, две колонны синтеза на постаменте, обломки ферм и плит, кучи кирпича.
 * Ворота — на юг (к заводской дороге), проломы на север, запад и восток (к арене).
 */
function buildShop3(ctx, { name, cx, cz }) {
	const W = 28, D = 16, H = 7.5, hx = W / 2, hz = D / 2, t = 0.4;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.5 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.brick, t, H };
	ruinWall(b, 'x', -hz, -hx - t / 2, hx + t / 2, { ...wo, gaps: [[-5, 0]], seed: 11 });
	ruinWall(b, 'x', hz, -hx - t / 2, hx + t / 2, { ...wo, gaps: [[-10, -6], [4.5, 8]], seed: 12 });
	ruinWall(b, 'z', -hx, -hz + t / 2, hz - t / 2, { ...wo, gaps: [[-1.5, 2.2]], seed: 13 });
	ruinWall(b, 'z', hx, -hz + t / 2, hz - t / 2, { ...wo, gaps: [[-5.5, -1.2]], seed: 14 });
	// уцелевший кусок кровли над западным концом: плиты на ржавых фермах
	b.top_(place(box(7, 0.3, D + 0.4, 3), -hx + 3.5, H + 0.15, 0), M.roofTar);
	for (const x of [-12, -8.5]) b.top_(place(box(0.3, 0.9, D), x, H - 0.45, 0), M.metalRust);
	// стойки каркаса вдоль стен (одна упала — лежит поперёк цеха)
	for (const x of [-7, 0, 7]) for (const s of [-1, 1]) if (!(x === 0 && s > 0)) column(b, x, s * (hz - 0.6), H - 0.4, M.metalRust);
	b.lower(place(box(0.4, 0.4, 8.5), 1.5, 0.2, 2.6, 0.55), M.metalRust);
	b.collide(1.5, 2.6, 0.5, 8.5, 0.55);
	// колонны синтеза на постаменте, площадка обслуживания между ними
	b.lower(place(box(9, 0.6, 4.4, 2), 1.5, 0.3, -4.0), M.concreteDark);
	b.collide(1.5, -4.0, 9, 4.4);
	vessel(b, -1, -4.0, 1.4, 6.4, M.metalRust);
	vessel(b, 4, -4.0, 1.2, 5.6, M.tankWhite);
	b.top_(place(box(2.6, 0.12, 1.6), 1.5, 4.2, -4.0), M.metalDark);
	b.top_(place(cyl(0.2, 0.2, 5, 8).rotateZ(Z), 1.5, 5.2, -3.2), M.silver);
	// обломки: плита кровли наискось на куче, фермы, кирпич
	rubble(b, -4.5, 3.6, 1.5, M.brick, 3);
	rubble(b, 9.5, -1.0, 1.2, M.concreteDark, 4);
	b.lower(place(box(5.5, 0.3, 2.6, 1.5), -4.0, 1.0, 4.0, 0.3, 0, 0.32), M.concrete);
	beam({ add: (g, m) => b.lower(g, m) }, M.metalRust, [8.5, 0.2, 5.5], [12.5, 2.8, 2.5], 0.35);
	b.collide(10.5, 4.0, 4.5, 1.0, 0.64);
	// тайники: шкаф с ЗИП у западной стены, электрошкаф у северной, верстак у южной
	locker(b, 'Шкаф с ЗИП', -hx + t / 2 + 0.3, 4.6, Z, { ammo545: [6, 12, 0.4], parts: [1, 1, 0.3], scrap: [1, 3, 0.4] }, 1.0);
	cabinet(b, 'Электрошкаф', 8.5, -hz + t / 2 + 0.32, 0, { ammo919: [6, 12, 0.35], parts: [1, 2, 0.35], spore: [1, 2, 0.3] });
	b.container('Верстак', 10.5, hz - t / 2 - 0.45, Math.PI, [
		[2.0, 0.08, 0.8, 0, 0.9, 0, IM.furniture], [1.9, 0.5, 0.7, 0, 0.3, 0, IM.machine], [0.3, 0.25, 0.3, -0.6, 1.06, -0.15, IM.metal], [1.6, 0.8, 0.02, 0, 1.7, -0.39, IM.rack, { up: true }],
	], [2.0, 0.8], { ammo12: [4, 10, 0.4], fireaxe: 0.04, scrap: [1, 3, 0.4], powder: [1, 1, 0.15] }, 1.0);
	return b.finish();
}

/**
 * Аппаратный цех (24×14 м, бетон), наполовину рухнувший в провал: своя ось +X — к центру провала. Продольные стены
 * обрываются у края, торца у провала нет — плита перекрытия съехала вниз, кран-балка и ферма свисают над бездной,
 * реактор на боку лежит на краю. Ворота — в дальнем торце; проломы в обеих продольных стенах у края — по ним арена
 * идёт сквозь цех. Тайники — у дальнего торца: шкаф КИП и сейф начальника смены.
 */
function buildHall(ctx, { name, cx, cz, ry }) {
	const W = 24, D = 14, H = 8, hx = W / 2, hz = D / 2, t = 0.35;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + 0.5 });
	b.messKind = 'work';
	const { M } = ctx;
	// докуда пол и стены: до края провала по каждой линии вдоль цеха
	const reach = (z) => { for (let x = -hx; x < hx; x += 0.2) { const [wx, wz] = b.world(x, z); if (inPit(wx, wz, 0.2)) return x; } return hx; };
	const eN = reach(-hz), eS = reach(hz), eM = Math.min(eN, eS, reach(0), reach(-hz / 2), reach(hz / 2));
	b.edge = eM;
	b.lower(place(planeXZ(eM + hx, D - 0.1, 2), (eM - hx) / 2, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, H };
	ruinWall(b, 'x', -hz, -hx - t / 2, eN, { ...wo, gaps: [[-5.5, -3.8], [eN - 9, eN - 5.5]], seed: 21 });
	ruinWall(b, 'x', hz, -hx - t / 2, eS, { ...wo, gaps: [[eS - 9.5, eS - 6]], seed: 22 });
	ruinWall(b, 'z', -hx, -hz + t / 2, hz - t / 2, { ...wo, gaps: [[-1.8, 1.8]], seed: 23 });
	b.wallBox('left', -1.8 - 1.0, 1.9, 0.02, 2.6, 0.07, M.metalRust, { t, off: 0.05 }); // створка ворот висит
	// стойки и подкрановые балки по стенам (у края обломаны)
	for (const x of [-8, -2, 4]) for (const s of [-1, 1]) column(b, x, s * (hz - 0.6), H - 0.3, M.metalRust);
	for (const s of [-1, 1]) b.top_(place(box(Math.min(eN, eS) + hx - 2.5, 0.6, 0.35), (Math.min(eN, eS) - hx - 2.5) / 2, H - 1.2, s * (hz - 0.6)), M.metalRust);
	// плита перекрытия съехала в провал: верхний край на полу цеха, нижний — в бездне
	b.lower(place(box(7, 0.35, D - 3, 1.5), eM + 1.2, 0.25, -0.5, 0, 0, -0.42), M.concrete);
	b.collide(eM - 1.2, -0.5, 2.4, D - 3);
	// кран-балка свисает с обрыва северной стены, ферма — с южной
	const low = { add: (g, m) => b.lower(g, m) };
	beam(low, M.hazard, [eN - 0.6, H - 1.0, -hz + 0.6], [eN + 6.5, -0.8, -hz + 3.2], 0.55);
	beam(low, M.metalRust, [eS - 0.6, H - 0.8, hz - 0.6], [eS + 5.5, -1.0, hz - 3.5], 0.3);
	beam(low, M.metalRust, [eS + 1.5, H - 3.6, hz - 1.4], [eS + 3.4, 2.0, hz - 2.6], 0.22);
	// реактор лежит на боку у края, наполовину над бездной
	b.lower(place(cyl(1.5, 1.5, 6, 16).rotateZ(Z), eM + 0.8, 0.9, 4.4, 0.35, 0, -0.18), M.metalRust);
	b.collide(eM - 0.9, 4.6, 2.0, 2.8, 0.35);
	// обломки внутри
	rubble(b, -4.0, -3.6, 1.4, M.concreteDark, 5);
	rubble(b, -1.0, 4.4, 1.1, M.concreteDark, 6);
	b.lower(place(box(4.5, 0.3, 2.2, 1.5), -7.5, 0.55, 3.8, 0.4, 0, 0.22), M.concrete);
	b.collide(-7.5, 3.8, 4.5, 2.0, 0.4);
	// тайники у дальнего торца
	cabinet(b, 'Шкаф КИП', -hx + t / 2 + 0.32, -4.4, Z, { ammo76254: [5, 10, 0.35], parts: [1, 2, 0.35], chem: [1, 1, 0.3] });
	safe(b, 'Сейф начальника смены', -hx + t / 2 + 0.35, 4.6, Z, { ak74: 0.06, ammo545: [12, 24, 0.55], spore: [2, 5, 0.5] });
	return b.finish();
}

// ---------- Здания с интерьером ----------

/**
 * Склад реагентов 26×13 м: бетонные стены, высокие ленточные окна, ворота на юг. Вдоль северной стены — стеллажи
 * с банками и канистрами, у западной — бочки с кислотой, посередине — поддоны с мешками; в восточном конце —
 * контора кладовщика (стол, сейф) со своей дверью.
 */
function buildStore(ctx, { name, cx, cz }) {
	const W = 26, D = 13, H = 5, hx = W / 2, hz = D / 2, t = 0.35;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 0.7 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	const wo = { mat: M.concreteDark, t, lining: IM.whitewash, sx: 2 };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, side: 1 });
	b.wall('x', hz, -hx - t / 2, 5, { ...wo, doors: [-5], w: 3.4, side: -1 });
	b.wall('x', hz, 5, hx + t / 2, { ...wo, doors: [9.5], side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	b.wall('z', 6, -hz + t / 2, hz - t / 2, { mat: IM.factoryWall, t: 0.15, doors: [-3] }); // контора
	const sill = M.concreteDark;
	for (const x of [-10, -4, 2, 9.5]) b.window('front', x, { y: 3.6, t, sill });
	for (const x of [-10, 1.5]) b.window('back', x, { y: 3.6, t, sill });
	b.window('left', 0, { y: 3.6, t, sill }); b.window('right', 0, { y: 3.6, t, sill });
	for (const s of [-1, 1]) b.wallBox('back', -5 + s * 2.6, 1.7, 0.02, 2.5, 0.06, M.metalRust, { t }); // створки ворот
	b.canopy('back', -5, { w: 4.4, d: 1.4, y: 3.0, mat: M.metalRust, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(5.6, 0.7).translate(0, H - 0.75, 0.03), 'back', 3.2, t), T.signMaterial('СКЛАД РЕАГЕНТОВ · ЯДОВИТО', { bg: '#e8c020', fg: '#1a1a1a', w: 640, h: 80 }));
	b.top_(place(box(W + 0.6, 0.3, D + 0.6, 3), 0, H + 0.15, 0), M.roofMetal);
	for (const [x, z] of [[-8, -2], [0, 2], [9, -2]]) b.vent(x, z, H + 0.3, M.silver);
	// стеллажи вдоль северной стены
	const ny = -hz + t / 2 + 0.5;
	shelf(b, 'Стеллаж с реактивами', -9.5, ny, 0, { chem: [2, 4, 0.65], fuel: [1, 1, 0.15] });
	shelf(b, 'Стеллаж с канистрами', -5.5, ny, 0, { fuel: [1, 2, 0.5], chem: [1, 2, 0.4] });
	shelf(b, 'Стеллаж с ЗИП', -1.5, ny, 0, { parts: [1, 2, 0.4], scrap: [1, 3, 0.4], ammo12: [4, 8, 0.3] });
	b.furniture(2.5, ny, 0, [
		...[-1.55, 1.55].flatMap((dx) => [-0.35, 0.35].map((dz) => [0.07, 2.4, 0.07, dx, 1.2, dz, IM.rack])),
		...[0.15, 0.95, 1.75].map((y) => [3.2, 0.05, 0.85, 0, y, 0, IM.rack]), [1.2, 0.5, 0.6, -0.6, 0.42, 0, IM.crate],
	], { solid: [3.2, 0.9] });
	// бочки с кислотой у западной стены (тайник — вся группа)
	const bar = [];
	for (let i = 0; i < 6; i++) bar.push([1, 1, 1, 0, 0, 0, i % 3 === 1 ? M.hazard : M.metalOlive, { geo: place(cyl(0.3, 0.3, 0.9, 12), (i % 3 - 1) * 0.66, 0.45, (Math.floor(i / 3) - 0.5) * 0.66) }]);
	b.container('Бочки с кислотой', -hx + t / 2 + 0.75, 2.4, Z, bar, [2.0, 1.35], { chem: [1, 3, 0.5], powder: [1, 1, 0.15] }, 1.0);
	// поддоны с мешками, ящик с противогазами у ворот
	for (const [x, z, r] of [[-8.6, 3.4, 0.1], [0.5, 1.6, -0.05], [2.6, 2.2, 0.2]]) b.furniture(x, z, r, [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], [1.0, 0.4, 0.8, 0, 0.34, 0, IM.rag], [0.95, 0.38, 0.75, 0.03, 0.73, 0, IM.rag]], { solid: [1.25, 1.05] });
	b.container('Ящик с противогазами', -1.4, hz - t / 2 - 0.4, Math.PI, [
		[1.2, 0.6, 0.7, 0, 0.3, 0, IM.crateGreen], [1.22, 0.05, 0.72, 0, 0.62, 0, IM.machine], [0.3, 0.2, 0.25, -0.3, 0.75, 0, IM.black], [0.3, 0.2, 0.25, 0.2, 0.75, 0.05, IM.black],
	], [1.2, 0.7], { medkit: [1, 2, 0.45], chem: [1, 1, 0.25] }, 0.8);
	// контора кладовщика
	desk(b, 'Стол кладовщика', 9.6, -4.2, 0, { ammo545: [6, 12, 0.4], spore: [1, 2, 0.35], food: [1, 1, 0.2] });
	chair(b, 9.4, -5.1, 0);
	safe(b, 'Сейф кладовщика', hx - t / 2 - 0.35, 1.5, -Z, { deagle: 0.05, ammo50: [4, 8, 0.35], spore: [2, 5, 0.5], chem: [1, 2, 0.3] });
	b.furniture(7.0, 4.8, Z, [[1.0, 1.9, 0.45, 0, 0.95, 0, IM.furniture], [0.02, 1.8, 0.02, 0, 0.95, 0.23, IM.black]], { solid: [1.0, 0.45] });
	return b.finish();
}

/**
 * Заводоуправление 28×12 м, два этажа (заходят на первый): посередине вестибюль, на запад — бухгалтерия с кассой
 * и архив (шкаф с документами, аптечка), на восток — приёмная и кабинет директора (стол, сейф, стол заседаний).
 * Главный вход — с севера, от стоянки; задняя дверь — на юг.
 */
function buildAdmin(ctx, { name, cx, cz }) {
	const W = 28, D = 12, H = 3.4, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 3.9 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.5), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.brick, t, lining: IM.wallpaper[1] };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0], w: 1.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0], side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	const pw = { mat: IM.whitewash, t: 0.15 };
	b.wall('z', -9.5, -hz + t / 2, hz - t / 2, { ...pw, doors: [3] });
	b.wall('z', -3.5, -hz + t / 2, hz - t / 2, { ...pw, doors: [-3] });
	b.wall('z', 3.5, -hz + t / 2, hz - t / 2, { ...pw, doors: [-3] });
	b.wall('z', 9, -hz + t / 2, hz - t / 2, { ...pw, doors: [3] });
	const sill = M.brick;
	for (const x of [-12, -6.5, 6.2, 11.5]) { b.window('front', x, { t, sill }); b.window('back', x, { t, sill }); }
	b.window('left', 0, { t, sill }); b.window('right', -2.5, { t, sill }); b.window('right', 2.5, { t, sill });
	// второй этаж (глухой), плоская крыша с парапетом
	b.top_(place(box(W + 0.4, 0.3, D + 0.4, 3), 0, H + 0.15, 0), M.concrete);
	b.top_(place(box(W, 3.0, D, 2, 1.6), 0, H + 1.8, 0), M.brick);
	for (const side of ['front', 'back']) for (const [i, x] of [-12, -8, -4, 4, 8, 12].entries()) {
		b.top_(b.onWall(T.windowUV(new THREE.PlaneGeometry(1.1, 1.4), (i * 3 + side.length) % 4).translate(0, H + 1.9, 0.012), side, x, t), M.window);
	}
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 3.45, 0), M.roofTar);
	b.parapet(H + 3.6, M.brick, 0.3);
	for (const [x, z] of [[-9, -2], [3, 2.5], [10, -3]]) b.vent(x, z, H + 3.6, M.silver);
	b.canopy('front', 0, { w: 3.4, d: 1.6, y: 2.75, mat: M.concrete, posts: M.whiteBrick, t, thick: 0.2 });
	b.lower(place(box(3.4, 0.14, 1.3), 0, 0.07, -hz - 0.8), M.concrete);
	b.top_(b.onWall(new THREE.PlaneGeometry(6.4, 0.7).translate(0, H + 1.9, 0.03), 'front', 0, t), T.signMaterial('ЗАВОДОУПРАВЛЕНИЕ · ХИМКОМБИНАТ «ПРОГРЕСС»', { bg: '#1e2a44', fg: '#e8e4d0', w: 768, h: 84 }));
	// архив: шкаф с документами, аптечка, стеллаж с папками
	b.container('Шкаф с документами', -hx + t / 2 + 0.3, -2.4, Z, [[1.0, 2.0, 0.55, 0, 1.0, 0, IM.furniture], [0.02, 1.9, 0.02, 0, 1.0, 0.28, IM.black], [0.8, 0.3, 0.4, 0, 1.6, 0, IM.paper]], [1.0, 0.55], { ammo545: [5, 10, 0.3], zhivchik: 0.25, food: [1, 1, 0.2] }, 2.0);
	firstAid(b, 'Аптечка', -12.2, hz - t / 2 - 0.12, Math.PI, { zhivchik: [1, 2, 0.75] });
	b.furniture(-11.8, -hz + t / 2 + 0.25, 0, [[2.4, 2.0, 0.45, 0, 1.0, 0, IM.furnitureLight], ...[0.5, 1.1, 1.7].map((y, i) => [2.2, 0.3, 0.3, 0, y, 0.05, IM.books[i]])], { solid: [2.4, 0.45] });
	// бухгалтерия: столы, касса
	desk(b, 'Стол бухгалтера', -6.5, -1.6, 0, { ammo919: [4, 10, 0.4], spore: [1, 2, 0.35] });
	chair(b, -6.5, -2.45, 0);
	b.furniture(-6.0, 3.4, Math.PI, [[1.4, 0.05, 0.7, 0, 0.75, 0, IM.furniture], [0.45, 0.72, 0.65, -0.45, 0.36, 0, IM.furniture], [0.06, 0.72, 0.6, 0.65, 0.36, 0, IM.furniture]], { solid: [1.4, 0.7], prop: 'table' });
	safe(b, 'Касса', -9.5 + 0.075 + 0.33, -4.5, Z, { spore: [3, 7, 0.6], ammo50: [4, 8, 0.3], deagle: 0.04 });
	// вестибюль: стенд, вахта
	b.furniture(2.1, hz - t / 2 - 0.05, Math.PI, [[1.6, 1.1, 0.04, 0, 1.6, 0, IM.redBoard]], { solid: [0, 0], up: true });
	b.furniture(-2.4, 2.6, Z, [[1.6, 1.0, 0.6, 0, 0.5, 0, IM.furniture]], { solid: [1.6, 0.6] });
	// приёмная и кабинет директора
	desk(b, 'Стол секретаря', 6.2, -1.2, 0, { ammo919: [4, 8, 0.35], food: [1, 2, 0.3], zhivchik: 0.2 });
	chair(b, 6.2, -2.05, 0);
	desk(b, 'Стол директора', 11.6, 2.2, Math.PI, { ammo76251: [5, 10, 0.35], spore: [2, 4, 0.45] });
	chair(b, 11.6, 3.05, Math.PI);
	safe(b, 'Сейф директора', hx - t / 2 - 0.35, -4.4, -Z, { fnfal: 0.05, awm: 0.03, ammo76251: [6, 12, 0.45], spore: [3, 6, 0.55], grenade: [1, 1, 0.25] });
	table(b, 11.4, -2.0, Z, { w: 2.2, d: 0.9 });
	return b.finish();
}

/**
 * Центральная заводская лаборатория 24×12 м: на запад — аналитический зал (вытяжные шкафы у западной стены,
 * лабораторный стол-остров, шкаф с реактивами), посередине — коридор от входа, на восток — комната проб
 * (холодильник, стеллаж) и кабинет заведующей (стол, сейф). Вход — с севера, от двора.
 */
function buildLab(ctx, { name, cx, cz }) {
	const W = 24, D = 12, H = 3.6, hx = W / 2, hz = D / 2, t = 0.3;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + 1.4 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.5), 0, 0.025, 0), IM.linoleum, { cast: false });
	const wo = { mat: M.whiteBrick, t, lining: IM.whitewash };
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { ...wo, doors: [0.5], w: 1.6, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { ...wo, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { ...wo, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, side: -1 });
	const pw = { mat: IM.whitewash, t: 0.15 };
	b.wall('z', -3, -hz + t / 2, hz - t / 2, { ...pw, doors: [-2.5] });
	b.wall('z', 4, -hz + t / 2, hz - t / 2, { ...pw, doors: [-2.5, 3] });
	b.wall('x', 0, 4.08, hx - t / 2, { ...pw }); // проба | кабинет
	const sill = M.whiteBrick;
	for (const x of [-10, -6.5, 8, 10.5]) b.window('front', x, { t, sill });
	for (const x of [-10, -6.5, -0.5, 8, 10.5]) b.window('back', x, { t, sill });
	b.window('left', 0, { t, sill }); b.window('right', -3, { t, sill }); b.window('right', 3, { t, sill });
	b.top_(place(box(W + 0.5, 0.3, D + 0.5, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.whiteBrick, 0.3);
	// вытяжка от шкафов: короб по крыше, дефлекторы
	b.top_(place(box(0.6, 0.6, 8, 1), -10.5, H + 0.6, 0), M.silver);
	for (const [x, z] of [[-10.5, -3], [-10.5, 3], [6, 2]]) b.vent(x, z, H + 0.9, M.silver, { h: 0.9, r: 0.22 });
	b.canopy('front', 0.5, { w: 2.6, d: 1.3, y: 2.7, mat: M.concrete, t });
	b.top_(b.onWall(new THREE.PlaneGeometry(6.2, 0.6).translate(0, H - 0.5, 0.03), 'front', -6.5, t), T.signMaterial('ЦЕНТРАЛЬНАЯ ЗАВОДСКАЯ ЛАБОРАТОРИЯ', { bg: '#e8e4d6', fg: '#2a3a5a', w: 768, h: 74 }));
	// аналитический зал: два вытяжных шкафа у западной стены
	const hood = (nm, z, loot) => b.container(nm, -hx + t / 2 + 0.4, z, Z, [
		[1.5, 0.9, 0.75, 0, 0.45, 0, IM.white], [1.52, 0.05, 0.77, 0, 0.92, 0, IM.black], [1.5, 1.1, 0.35, 0, 1.5, -0.2, IM.white],
		[1.4, 0.7, 0.03, 0, 1.4, 0.2, IM.glass], [1.5, 0.3, 0.75, 0, 2.15, 0, IM.white], [0.3, 0.5, 0.3, 0, 2.55, -0.1, IM.metal],
		[0.1, 0.22, 0.1, -0.4, 1.06, 0.05, IM.jars], [0.12, 0.3, 0.12, 0.3, 1.1, 0, IM.bottles[1]],
	], [1.5, 0.75], loot, 2.4);
	hood('Вытяжной шкаф', -3.0, { chem: [1, 3, 0.6], medkit: [1, 1, 0.15] });
	hood('Вытяжной шкаф', 2.6, { chem: [1, 2, 0.55], grenade: 0.03, spore: [1, 2, 0.3] });
	b.container('Лабораторный стол', -7.0, 0.4, 0, [
		[2.4, 0.88, 1.2, 0, 0.44, 0, IM.white], [2.5, 0.05, 1.3, 0, 0.9, 0, IM.black],
		[0.05, 0.7, 0.05, -1.1, 1.27, 0, IM.metal], [0.05, 0.7, 0.05, 1.1, 1.27, 0, IM.metal], [2.3, 0.04, 0.3, 0, 1.6, 0, IM.metal],
		[0.1, 0.22, 0.1, -0.6, 1.73, 0, IM.jars], [0.1, 0.18, 0.1, 0.2, 1.71, 0, IM.bottles[0]], [0.14, 0.12, 0.14, 0.5, 0.98, 0.3, IM.glass],
	], [2.4, 1.2], { chem: [1, 2, 0.45], ammo919: [4, 10, 0.3], spore: [1, 2, 0.3] }, 1.8);
	b.container('Шкаф с реактивами', -7.5, -hz + t / 2 + 0.28, 0, [
		[1.3, 2.0, 0.5, 0, 1.0, 0, IM.white], [1.2, 1.2, 0.02, 0, 1.3, 0.26, IM.glass],
		[1.1, 0.25, 0.35, 0, 1.0, 0, IM.jars], [1.1, 0.28, 0.35, 0, 1.55, 0, IM.bottles[0]],
	], [1.3, 0.5], { chem: [2, 4, 0.7], grenade: 0.04 }, 2.0);
	// коридор: скамья, аварийный душ
	b.furniture(-2.3, 3.6, -Z, [[1.6, 0.06, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.42, 0.36, -0.7, 0.22, 0, IM.metal], [0.06, 0.42, 0.36, 0.7, 0.22, 0, IM.metal]], { solid: [1.6, 0.4] });
	b.furniture(3.4, 5.2, Math.PI, [[0.08, 2.3, 0.08, 0, 1.15, 0, IM.metal], [0.5, 0.06, 0.5, 0, 2.3, 0.2, IM.metal], [0.3, 0.05, 0.3, 0, 0.9, 0.2, IM.redBoard]], { solid: [0.3, 0.3] });
	// комната проб: холодильник и стеллаж
	b.container('Холодильник с пробами', hx - t / 2 - 0.36, -4.6, -Z, [
		[0.7, 1.8, 0.65, 0, 0.9, 0, IM.white], [0.04, 0.35, 0.04, -0.27, 1.1, 0.34, IM.metal], [0.6, 0.02, 0.02, 0, 1.25, 0.33, IM.black],
	], [0.7, 0.65], { chem: [1, 2, 0.5], medkit: [1, 2, 0.35], spore: [1, 3, 0.3] }, 1.8);
	b.furniture(7.5, -hz + t / 2 + 0.3, 0, [
		...[-0.9, 0.9].map((dx) => [0.06, 1.9, 0.5, dx, 0.95, 0, IM.rack]), ...[0.4, 1.0, 1.6].map((y) => [1.9, 0.04, 0.5, 0, y, 0, IM.rack]),
		[1.5, 0.22, 0.35, 0, 0.53, 0, IM.jars], [1.4, 0.22, 0.35, 0, 1.13, 0, IM.jars],
	], { solid: [1.9, 0.5] });
	// кабинет заведующей
	desk(b, 'Стол заведующей', 9.0, 3.4, Math.PI, { ammo919: [6, 12, 0.4], chem: [1, 1, 0.3], spore: [1, 3, 0.4] });
	chair(b, 9.0, 4.25, Math.PI);
	safe(b, 'Сейф заведующей', hx - t / 2 - 0.35, 1.4, -Z, { glock17: 0.06, ammo919: [8, 16, 0.5], spore: [3, 6, 0.55], chem: [1, 2, 0.3] });
	return b.finish();
}

/** Армейская палатка оцепления 6,4×4,6 м: брезент, двускатная крыша, вход с востока; оружейный ящик, патроны, аптечка, раскладушки. */
function buildTent(ctx, { name, cx, cz }) {
	const W = 6.4, D = 4.6, H = 2.2, hx = W / 2, hz = D / 2, t = 0.08, rise = 1.3;
	const b = new Building(ctx, { name, cx, cz, ry: 0, W, D, H, top: H + rise });
	b.messKind = 'army';
	const { M } = ctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1), 0, 0.022, 0), M.woodGrey, { cast: false });
	const wo = { mat: M.canvas, t, sx: 2 };
	b.wall('x', -hz, -hx, hx, wo);
	b.wall('x', hz, -hx, hx, wo);
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, wo);
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { ...wo, doors: [0], w: 1.4 });
	const slope = Math.atan2(rise, hz), sl = Math.hypot(rise, hz) + 0.25;
	for (const s of [-1, 1]) b.top_(box(W + 0.4, 0.06, sl, 2).rotateX(s * slope).translate(0, H + rise / 2, s * hz / 2), M.canvas);
	const tri = new THREE.Shape();
	tri.moveTo(-hz, 0); tri.lineTo(hz, 0); tri.lineTo(0, rise); tri.closePath();
	for (const s of [-1, 1]) b.top_(new THREE.ShapeGeometry(tri).rotateY(s * Z).translate(s * hx, H, 0), M.canvas);
	b.top_(place(cyl(0.12, 0.12, 1.4, 8).rotateX(Z), hx + 0.06, 2.15, 0), M.canvas); // полог скатан над входом
	// раскладушки, стол с рацией
	for (const z of [-1.3, 1.3]) b.furniture(-1.6, z, Z, [[0.8, 0.06, 1.9, 0, 0.42, 0, IM.blanketArmy], [0.04, 0.4, 1.9, -0.38, 0.2, 0, IM.metal], [0.04, 0.4, 1.9, 0.38, 0.2, 0, IM.metal]], { solid: [0.8, 1.9] });
	b.furniture(1.2, -hz + 0.45, 0, [[1.0, 0.04, 0.6, 0, 0.72, 0, IM.furnitureLight], [0.04, 0.7, 0.5, -0.45, 0.36, 0, IM.metal], [0.04, 0.7, 0.5, 0.45, 0.36, 0, IM.metal], [0.35, 0.25, 0.25, -0.2, 0.86, 0, IM.machine]], { solid: [1.0, 0.6] });
	// тайники
	armyCrate(b, 'Оружейный ящик', 0.9, hz - 0.5, Math.PI, { ak74: 0.12, svd: 0.06, rpk: 0.05, ammo545: [15, 30, 0.6], ammo76254: [5, 10, 0.35] });
	b.container('Ящик с патронами', -hx + 0.45, 0, Z, [
		[0.6, 0.45, 0.9, 0, 0.23, 0, IM.crateGreen], [0.62, 0.04, 0.92, 0, 0.47, 0, IM.machine], [0.5, 0.35, 0.5, 0, 0.67, 0.1, IM.crateGreen],
	], [0.6, 0.9], { ammo545: [20, 40, 0.7], ammo762: [10, 20, 0.4], grenade: [1, 2, 0.35] }, 0.9);
	b.container('Аптечка военных', 2.4, -hz + 0.4, 0, [[0.5, 0.3, 0.35, 0, 0.15, 0, IM.white], [0.2, 0.01, 0.06, 0, 0.31, 0, IM.redBoard], [0.06, 0.01, 0.2, 0, 0.311, 0, IM.redBoard]], [0.5, 0.35], { zhivchik: [1, 2, 0.7], spore: [1, 2, 0.3] }, 0.5);
	return b.finish();
}

/**
 * Брошенное у логова: тайники без стен (оружейный ящик военных, цинки, рюкзак погибшего) — «здание» в полметра
 * у гнезда, только чтобы держать тайники. caches — [[имя, мир x, мир z, поворот, вид, лут], …].
 */
function buildCaches(ctx, { name, cx, cz, caches }) {
	const b = new Building(ctx, { name, cx, cz, ry: 0, W: 0.5, D: 0.5, H: 0.2, top: 0.3 });
	b.messKind = null;
	const IM = b.IM;
	for (const [nm, x, z, rot, kind, loot] of caches) {
		const lx = x - cx, lz = z - cz;
		if (kind === 'crate') armyCrate(b, nm, lx, lz, rot, loot);
		else if (kind === 'zinc') b.container(nm, lx, lz, rot, [
			[0.7, 0.4, 0.45, 0, 0.2, 0, IM.crateGreen], [0.72, 0.04, 0.47, 0, 0.42, 0, IM.machine], [0.4, 0.15, 0.3, 0.1, 0.5, 0, IM.cans],
			[1.0, 1.0, 1.0, 0, 0, 0, IM.crateGreen, { geo: place(box(0.7, 0.4, 0.45), 0.7, 0.2, 0.2, 0.7) }],
		], [1.3, 0.8], loot, 0.6);
		else b.container(nm, lx, lz, rot, [
			[0.55, 0.35, 0.3, 0, 0.18, 0, IM.blanketArmy], [0.45, 0.2, 0.12, 0, 0.18, 0.2, IM.blanketArmy], [0.5, 0.08, 0.32, 0, 0.38, -0.02, IM.rag],
		], [0.6, 0.45], loot, 0.45);
	}
	return b.finish();
}

export default {
	id: 'proval',
	seed: 7606,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, buildings, bctx } = ctx;
		// отравленная земля: грунт и трава жёлто-серые, листва больная, вода в отстойнике зелёная; известь и кости
		M.dirt.color.setRGB(0.8, 0.77, 0.64);
		M.grass.color.setRGB(0.9, 0.84, 0.6);
		M.leaves.color.setHex(0x7a763c);
		M.pine.color.setHex(0x3e4632);
		M.water.color.setRGB(0.85, 1.0, 0.45);
		M.white.color.setHex(0xd2c8aa);
		const flesh = new THREE.MeshStandardMaterial({ color: 0x4a1e1c, roughness: 0.38, metalness: 0.05 });
		// светящиеся споровые наросты — один материал на всю локацию
		const glow = new THREE.MeshStandardMaterial({ color: 0xc8ff86, emissive: 0x7ae03a, emissiveIntensity: 1.35, roughness: 0.3 });
		const blood = new THREE.MeshStandardMaterial({ map: T.bloodDecalTexture(3), transparent: true, depthWrite: false, roughness: 0.3 });
		/** Споровый нарост: три светящихся бугра на подушке споровой массы. */
		const spore = (x, z, s, seed, y = 0) => {
			for (let k = 0; k < 3; k++) {
				const r = s * [1, 0.68, 0.5][k], a = seed * 2.4 + k * 2.1, d = k ? s * 0.95 : 0;
				batch.add(place(blob(r, 1, seed * 3 + k).scale(1, 0.75, 1), x + Math.cos(a) * d, y + r * 0.42, z + Math.sin(a) * d), glow, { cast: false });
			}
			batch.add(place(blob(s * 1.5, 1, seed + 50).scale(1.3, 0.25, 1.3), x, y + 0.04, z, seed), flesh, { cast: false });
		};
		/** Гнездо: кольцо бугров споровой массы, плоская подушка, кости, светящиеся наросты по краю, кровь. */
		const nest = (x, z, s, seed) => {
			for (let i = 0; i < 11; i++) {
				const a = seed + i * 0.571, d = (2.1 + hash(seed, i) * 0.6) * s, size = (0.4 + hash(i, seed) * 0.35) * s;
				batch.add(place(blob(size, 1, seed * 13 + i).scale(1.4, 0.6, 1), x + Math.cos(a) * d, size * 0.16, z + Math.sin(a) * d, a), flesh, { cast: false });
			}
			batch.add(place(blob(1.3 * s, 1, seed + 99).scale(1.6, 0.07, 1.6), x, 0.02, z), flesh, { cast: false });
			bones(batch, M.white, x, z, 10, 1.9 * s, seed, 0.11);
			for (let k = 0; k < 3; k++) { const a = seed * 0.7 + k * 2.1; spore(x + Math.cos(a) * 2.5 * s, z + Math.sin(a) * 2.5 * s, 0.24 + k * 0.05, seed + k * 7); }
			for (let k = 0; k < 4; k++) {
				const a = seed + k * 1.6, sz = (1.6 + (k % 2) * 0.9) * s;
				batch.add(place(new THREE.PlaneGeometry(sz, sz).rotateX(-Math.PI / 2), x + Math.cos(a) * k * 0.9 * s, 0.032 + k * 0.0004, z + Math.sin(a) * k * 0.9 * s, a), blood, { cast: false });
			}
		};

		// ---------- Покрытия: грунт комбината, дороги, площадки ----------
		ground(FX * 2, FS - FN, 0, (FN + FS) / 2, M.dirt, 6, 0.012); // территория комбината
		ground(176, 7, 0, 0, M.asphalt, 5, 0.02); // дорога с запада (Аэродром) на восток (Шахта) вдоль арены
		ground(7, FS - 20, 0, (20 + FS) / 2, M.asphalt, 5, 0.021); // аллея к южным воротам
		ground(40, 18, 0, 13, M.concrete, 4, 0.018); // площадь оцепления
		ground(28, 8, STORE[0], STORE[1] + 10.5, M.concrete, 4, 0.017); // у ворот склада реагентов
		ground(6, 10, STORE[0] - 5, -8.5, M.concrete, 4, 0.0172);
		ground(6, 50, -71, -29, M.asphalt, 5, 0.019); // заводская дорога к цеху № 3
		ground(36, 24, SHOP3[0], SHOP3[1], M.concrete, 4, 0.016); // двор цеха № 3
		ground(32, 16, ADMIN[0], 18, M.asphalt, 5, 0.019); // стоянка заводоуправления
		ground(28, 14, LAB[0], 19, M.concrete, 4, 0.018); // двор лаборатории
		ground(TF.x1 - TF.x0, TF.z1 - TF.z0, (TF.x0 + TF.x1) / 2, (TF.z0 + TF.z1) / 2, M.concrete, 4, 0.016); // ёмкостный парк
		ground(6, 9, 58, -7.5, M.concrete, 4, 0.0165);
		const onRoad = (x, z, m = 0) => Math.abs(z) < 3.5 + m || (Math.abs(x) < 3.5 + m && z > 0 && z < FS + m)
			|| (Math.abs(x) < 20 + m && z > 4 - m && z < 22 + m)
			|| Math.hypot(x - C[0], z - C[1]) < ARENA + 1.5 + m // арена и провал: ни деревьев, ни травы
			|| (Math.abs(x - STORE[0]) < 14 + m && z > STORE[1] + 6 && z < -3)
			|| (Math.abs(x + 71) < 3 + m && z > -54 - m && z < 0) || (Math.abs(x - SHOP3[0]) < 18 + m && Math.abs(z - SHOP3[1]) < 12 + m)
			|| (Math.abs(x - ADMIN[0]) < 16 + m && Math.abs(z - 18) < 8 + m) || (Math.abs(x - LAB[0]) < 14 + m && Math.abs(z - 19) < 7 + m)
			|| (x > TF.x0 - m && x < TF.x1 + m && z > TF.z0 - m && z < TF.z1 + m);

		// ---------- Провал: бездна, вал по краю, обломки, споровая масса ----------
		pitDisk(batch, pitMaterial());
		rimLip(batch, M.ballast);
		pitCollide(collide);
		{
			// арена: выжженная земля кольцом вокруг провала (внешний край неровный)
			const g = new THREE.RingGeometry(1, 2, 160, 1).rotateX(-Math.PI / 2);
			const p = g.attributes.position, uv = g.attributes.uv;
			for (let i = 0; i < p.count; i++) {
				const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
				const r = Math.hypot(x, z) < 1.5 ? rimR(a) + 1.0 : ARENA + 1.6 * Math.sin(a * 6 + 1) + 0.9 * Math.sin(a * 13 + 2);
				const wx = C[0] + Math.cos(a) * r, wz = C[1] + Math.sin(a) * r;
				p.setXYZ(i, wx, 0.0135, wz);
				uv.setXY(i, wx / 6, wz / 6);
			}
			g.computeVertexNormals();
			batch.add(g, M.roofTar, { cast: false });
		}
		// обломки по краю: плиты съезжают вниз, глыбы, куски перекрытий с арматурой, щебень
		for (let i = 0; i < 30; i++) {
			const a = (i / 30) * Math.PI * 2 + (hash(i, 7) - 0.5) * 0.12;
			if (Math.abs(angDiff(a, HALL_A)) < HALL_SECTOR) continue;
			const r0 = rimR(a), kind = i % 4;
			if (kind === 0) {
				const [x, z] = polar(a, r0 - 0.6), ry = -a + (hash(i, 3) - 0.5) * 0.4;
				batch.add(box(3.4, 0.28, 2.3 + hash(i) * 0.8, 1.5).rotateZ(0.3 + hash(i, 2) * 0.15).rotateY(ry).translate(x, 0.12, z), M.concrete);
				const [cx, cz] = polar(a, r0 + 0.6);
				collide(cx, cz, 1.2, 2.4, ry);
			} else if (kind === 1) {
				const s = 0.8 + hash(i, 4) * 0.7, [x, z] = polar(a, r0 + 1.1);
				batch.add(place(blob(s, 1, 40 + i).scale(1.2, 0.7, 1), x, s * 0.25, z, a), i % 8 === 1 ? M.concreteDark : M.ballast);
				collide(x, z, s * 1.7, s * 1.7, -a);
			} else if (kind === 2) {
				const [x, z] = polar(a, r0 + 0.9);
				batch.add(place(box(1.8, 0.35, 1.3, 1.2), x, 0.3, z, -a + 0.5, 0, 0.2), M.concreteDark);
				for (let k = 0; k < 4; k++) {
					const ox = (hash(i, k) - 0.5) * 1.2, oz = (hash(k, i) - 0.5) * 0.8;
					tube(batch, M.metalRust, [x + ox, 0.4, z + oz], [x + ox * 1.6 + 0.2, 1.2 + hash(i + k) * 0.6, z + oz * 1.6], 0.025, 4);
				}
				collide(x, z, 2.0, 1.6, -a + 0.5);
			} else {
				for (let k = 0; k < 4; k++) {
					const [x, z] = polar(a + (k - 1.5) * 0.04, r0 + 1.4 + hash(i, k) * 1.4), s = 0.25 + hash(k, i) * 0.25;
					batch.add(place(blob(s, 1, 60 + i * 4 + k).scale(1.2, 0.55, 1), x, lipY(x, z) + s * 0.12, z, k), M.ballast, { cast: false });
				}
			}
		}
		// в глубине: тёмные глыбы и плиты на склонах, светящиеся наросты (видно, как глубоко)
		for (let i = 0; i < 8; i++) {
			const a = i * 2.4 + 0.3, [x, z] = polar(a, rimR(a) * (0.6 + hash(i, 9) * 0.25)), s = 0.8 + hash(i, 10) * 1.0;
			batch.add(place(blob(s, 1, 80 + i).scale(1.4, 0.35, 1), x, 0.05, z, a), M.tankBlack, { cast: false });
		}
		for (let i = 0; i < 14; i++) {
			const a = i * 1.37 + 0.6, [x, z] = polar(a, rimR(a) * (0.15 + hash(i, 11) * 0.72));
			spore(x, z, 0.3 + hash(i, 12) * 0.35, 200 + i, 0.02);
		}
		// тяжи споровой массы выползают из провала на арену
		for (let i = 0; i < 9; i++) {
			const a0 = i * 0.7 + 0.25;
			if (Math.abs(angDiff(a0, HALL_A)) < HALL_SECTOR) continue;
			let dir = a0, [x, z] = polar(a0, rimR(a0) * 0.82);
			for (let k = 0; k < 7; k++) {
				dir += Math.sin(i * 3.1 + k * 1.7) * 0.32;
				const len = 1.5, nx = x + Math.cos(dir) * len, nz = z + Math.sin(dir) * len, rad = 0.2 - k * 0.022;
				// тяж лежит на земле и переползает гребень вала: концы — на высоте вала, кусок наклонён
				const y0 = lipY(x, z) * 1.25 + rad * 0.3, y1 = lipY(nx, nz) * 1.25 + rad * 0.3;
				batch.add(place(cyl(rad * 0.8, rad, Math.hypot(len, y1 - y0) + 0.15, 6).rotateZ(Z).scale(1, 0.6, 1), (x + nx) / 2, (y0 + y1) / 2, (z + nz) / 2, -dir, 0, Math.atan2(y1 - y0, len)), flesh, { cast: false });
				x = nx; z = nz;
			}
		}
		// наросты по краю
		for (let i = 0; i < 9; i++) {
			const a = i * 0.71 + 2.0;
			if (Math.abs(angDiff(a, HALL_A)) < HALL_SECTOR) continue;
			const [x, z] = polar(a, rimR(a) + 2.4 + hash(i, 13));
			spore(x, z, 0.26 + hash(i, 14) * 0.2, 300 + i, lipY(x, z));
		}

		// ---------- Логово скребера (север) и ещё два гнезда; укрытия на арене ----------
		nest(1.6, -63.4, 1.5, 3);
		nest(...polar(215 * DEG, 26), 1.1, 17);
		nest(...polar(52 * DEG, 26), 1.0, 29);
		for (const [deg, r, kind] of [[0, 30, 'blocks'], [40, 28, 'lean'], [65, 30, 'stack'], [90, 27, 'vessel'], [115, 30, 'blocks'], [140, 27, 'lean'],
			[160, 30, 'blob'], [195, 30, 'stack'], [235, 29, 'vessel'], [300, 31.5, 'blob']]) {
			const a = deg * DEG, [x, z] = polar(a, r);
			cover(batch, M, collide, kind, x, z, -a + Z + (hash(deg) - 0.5) * 0.5, deg);
		}
		// брошенное у логова: ящики военных, рюкзак; рядом — останки бойцов (каски, бронежилеты, кости)
		buildings.push(buildCaches(bctx, {
			name: 'Lair', cx: LAIR[0], cz: LAIR[1] - 1, caches: [
				['Оружейный ящик военных', -8.5, -68.6, 0.5, 'crate', { ak107: 0.12, svd: 0.1, ksvk: 0.06, rpg7: 0.05, rg6: 0.05, ammo545: [20, 40, 0.6], ammo127: [5, 10, 0.4] }],
				['Цинк с патронами', -3.6, -72.4, -0.3, 'zinc', { ammo76254: [15, 30, 0.6], ammo127: [6, 12, 0.45], rocket: [1, 2, 0.35], vog25: [2, 4, 0.35], grenade: [1, 3, 0.5] }],
				['Рюкзак погибшего бойца', 9.6, -70.4, -2.4, 'pack', { medkit: [1, 2, 0.6], spore: [3, 8, 0.6], grenade: [1, 2, 0.4], ammo545: [10, 20, 0.5], peas: [1, 2, 0.2] }],
			],
		}));
		for (const [i, [x, z]] of [[-6.5, -66.8], [-1.2, -70.6], [8.0, -68.6], [-11.5, -64.5]].entries()) {
			batch.add(place(new THREE.SphereGeometry(0.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), x + 0.5, 0.02, z + 0.3, i, 0.3 * (i % 2 ? 1 : -1)), M.khaki); // каска
			batch.add(place(box(0.5, 0.12, 0.6, 0.6), x - 0.3, 0.07, z - 0.2, i * 1.3), M.metalOlive); // бронежилет
			batch.add(place(box(0.08, 0.06, 0.8), x + 0.2, 0.04, z - 0.8, i * 0.9 + 0.4), M.metalDark); // брошенный ствол
			bones(batch, M.white, x, z, 5, 0.9, 40 + i * 5);
		}

		// ---------- Аппаратный цех рухнул в провал (северо-восток) ----------
		{
			const [hx, hz] = polar(HALL_A, 30);
			const hall = buildHall(bctx, { name: 'Hall', cx: hx, cz: hz, ry: Math.atan2(-(C[1] - hz), C[0] - hx) });
			buildings.push(hall);
			for (const [i, [lx, lz]] of [[hall.edge - 1.2, -5.6], [hall.edge - 3.0, 2.0], [hall.edge - 0.8, 5.8]].entries()) {
				const [x, z] = hall.world(lx, lz);
				spore(x, z, 0.3, 400 + i);
			}
		}

		// ---------- Руины цеха синтеза № 3 (северо-запад), склад реагентов (запад), эстакада к провалу ----------
		buildings.push(buildShop3(bctx, { name: 'Shop3', cx: SHOP3[0], cz: SHOP3[1] }));
		spore(SHOP3[0] + 11, SHOP3[1] - 6.2, 0.3, 500);
		spore(SHOP3[0] - 9, SHOP3[1] - 6.5, 0.24, 501);
		buildings.push(buildStore(bctx, { name: 'Store', cx: STORE[0], cz: STORE[1] }));
		hazardBarrels(batch, M, collide, STORE[0] + 9, STORE[1] + 9, rnd, 5);
		hazardBarrels(batch, M, collide, -66, -36, rnd, 6);
		pipeRack(batch, M, collide, -64, -36, -42);
		estakada(batch, M, collide, [-36, -42], polar(178 * DEG, rimR(178 * DEG)), { broken: true, skip: true });
		pipePile(batch, M, collide, -44, -8.5, 0.05);

		// ---------- Ёмкостный парк (восток): обвалование, ржавые ёмкости, упавшая цистерна, эстакада к провалу ----------
		{
			const { x0, x1, z0, z1 } = TF, h = 0.9;
			const wall = (ax, az, bx, bz) => {
				const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
				batch.add(place(box(len, h, 0.3, 1.5), (ax + bx) / 2, h / 2, (az + bz) / 2, -ang), M.concreteDark);
				collide((ax + bx) / 2, (az + bz) / 2, len, 0.4, -ang);
			};
			wall(x0, z0, x1, z0); wall(x1, z0, x1, z1);
			wall(x0, z0, x0, -31); wall(x0, -26, x0, z1); // проход эстакады с запада
			wall(x0, z1, 56, z1); wall(60, z1, x1, z1); // проезд с дороги
			storageTank(batch, M, root, collide, 52, -38, 3.4, 8, M.metalRust, 'АЗОТНАЯ КИСЛОТА');
			storageTank(batch, M, root, collide, 64, -38, 3.4, 8, M.metalRust, null);
			storageTank(batch, M, root, collide, 68, -24, 2.6, 6, M.tankWhite, null);
			// упавшая цистерна: лежит на боку, крыша смята
			batch.add(place(cyl(2.4, 2.4, 7.5, 20).rotateZ(Z), 54.5, 2.25, -20.5, 0.45), M.metalRust);
			batch.add(place(cyl(0.3, 2.45, 0.8, 20).rotateZ(-Z), 54.5 + Math.cos(0.45) * 4.15, 2.25, -20.5 - Math.sin(0.45) * 4.15, 0.45), M.metalRust);
			collide(54.5, -20.5, 8.3, 4.8, 0.45);
			batch.add(place(blob(2.2, 1, 909).scale(1.6, 0.06, 1.1), 50.6, 0.03, -18.6, 0.3), M.hazard, { cast: false }); // разлитое
			hazardBarrels(batch, M, collide, 70, -44, rnd, 5);
			estakada(batch, M, collide, [49, -28], polar(15 * DEG, rimR(15 * DEG)), { broken: true });
		}
		// ж/д тупик у северо-восточного края: цистерны
		railTrack(batch, M, 40, 87, RAIL);
		tankWagon(batch, M, collide, 52, RAIL, 0, M.metalRust);
		tankWagon(batch, M, collide, 64.2, RAIL, 0, M.tankBlack);
		batch.add(place(box(0.5, 1.0, 3.0), 40.3, 0.5, RAIL), M.red);
		collide(40.3, RAIL, 0.6, 3.0);

		// ---------- Оцепление военных у южного края арены ----------
		btr(batch, M, root, collide, -7, -8.5, Math.PI - 0.15); // сгорел, носом к провалу
		armyTruck(batch, M, root, collide, 13, 14, Z + 0.15);
		buildings.push(buildTent(bctx, { name: 'ArmyTent', cx: -12, cz: 15 }));
		sandbags(batch, M, collide, 6, -5.6, 4, 0.1);
		sandbags(batch, M, collide, -18, -5.2, 3.4, -0.2);
		sandbags(batch, M, collide, 16, -7.5, 3, 0.5);
		for (const [x, z, r] of [[-24, -8, 0.3], [-17, -9, 1.1], [22, -10, 0.7], [-28, -3.8, 0.2]]) hedgehog(batch, M, collide, x, z, r);
		billboard(batch, M, root, collide, 0, -5.4, 0, 'ЗОНА ЗАРАЖЕНИЯ · ПРОХОД ЗАПРЕЩЁН', { w: 6, h: 0.9, y: 2.4, bg: '#e8c020', fg: '#1a1a1a' });
		barrier(batch, M, collide, -3.8, 22, 0, 7.5, true);
		for (const [x, z, r] of [[-5.5, 10.6, 0.2], [-4.2, 11.6, 0.9], [7, 18.6, 0.1]]) {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		}
		for (const [x, z, r] of [[-30, 1.8, 0.1], [31, -1.6, -0.15]]) {
			beginProp('block', x, z, r);
			batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark);
			endProp();
			collide(x, z, 1.8, 0.9, r);
		}
		for (const [i, [x, z]] of [[-3, 7.5], [9.5, 4.8]].entries()) bones(batch, M.white, x, z, 5, 0.9, 70 + i * 3);

		// ---------- Юг: заводоуправление, лаборатория, шламонакопитель, свалка ----------
		buildings.push(buildAdmin(bctx, { name: 'Admin', cx: ADMIN[0], cz: ADMIN[1] }));
		buildings.push(buildLab(bctx, { name: 'Lab', cx: LAB[0], cz: LAB[1] }));
		for (const [x, z, r, col, opt] of [[-56, 16, Z, 0x3a5a6a, {}], [-52.4, 16.4, Z + 0.15, 0x7a2a22, { crashed: true }], [-38, 18.5, -Z + 0.2, 0x5a5a3a, { burned: true }],
			[-34, 1.6, 0.25, 0x5a5a4a, { burned: true }], [40, -1.2, 2.9, 0x6a3a2a, { crashed: true }], [52, 19.5, 1.2, 0xb8b0a0, { crashed: true }], [30, 54, 0.6, 0x4a4a40, { burned: true }]]) {
			addCar(batch, M, root, x, z, r, col, opt);
			collide(x, z, 4.3, 1.8, r);
		}
		pond(batch, root, M, collide, -22, 50, 9, 6, rnd);
		hazardBarrels(batch, M, collide, -36, 47, rnd, 5);
		hazardBarrels(batch, M, collide, 22, 46, rnd, 6);
		hazardBarrels(batch, M, collide, 62, 6, rnd, 4);
		pipePile(batch, M, collide, 26, 38, 0.3);

		// ---------- Забор комбината: ворота дорог, проломы; надпись над южными воротами ----------
		const fence = (x0, z0, x1, z1) => concreteFence(batch, M, collide, root, x0, z0, x1, z1, { wire: false });
		fence(-FX, FN, -FX, -40); fence(-FX, -34, -FX, -5); fence(-FX, 5, -FX, FS);
		fence(FX, -70, FX, -5); fence(FX, 5, FX, 30); fence(FX, 37, FX, FS);
		fence(-FX, FS, -50, FS); fence(-44, FS, -5, FS); fence(5, FS, 30, FS); fence(37, FS, FX, FS);
		for (const [x, z] of [[-FX, -5], [-FX, 5], [FX, -5], [FX, 5], [-5, FS], [5, FS]]) { batch.add(place(box(0.7, 3.2, 0.7), x, 1.6, z), M.concreteDark); collide(x, z, 0.8, 0.8); }
		batch.add(place(box(4.2, 0.08, 2.2), -FX + 1.8, 0.06, 8.2, 0.4), M.metalOlive); // сорванная створка лежит
		batch.add(place(box(4.0, 2.2, 0.08), FX + 1.2, 1.15, -7.4, 1.0), M.metalOlive); // вторая висит на одной петле
		collide(FX + 1.2, -7.4, 4.0, 0.25, 1.0);
		for (const [x, z, r] of [[-FX + 1.4, -37, Z + 0.2], [33.5, FS + 1.3, 0.15], [-47, FS - 1.2, -0.2], [FX - 1.3, 33.5, Z - 0.1]]) batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), x, 0.12, z, r), M.concrete); // плиты в проломах
		billboard(batch, M, root, collide, 0, FS, 0, 'ХИМКОМБИНАТ «ПРОГРЕСС»', { w: 9, h: 1.1, y: 4.4, bg: '#2a2c26', fg: '#e8dcae' });

		// ---------- Мёртвый лес: сухие деревья за забором и у северного края ----------
		for (let i = 0; i < 26; i++) {
			const side = i % 4;
			const x = side === 0 ? R(-86, 86) : side === 1 ? R(-86, -81) : side === 2 ? R(81, 86) : R(-80, 34);
			const z = side === 0 ? R(FS + 3, 86) : side === 3 ? R(-86, -81.5) : R(-80, FS);
			if (Math.abs(z) < 8 && side !== 0 && side !== 3) continue; // не на дороге к выходам
			deadTree(batch, M, collide, x, z, R(0.8, 1.2), i * 7 + 3);
		}

		return {
			start: [-82.5, 0, Z],
			exits: [
				{ to: 'aerodrom', x0: -90, x1: -85.2, z0: -3, z1: 3, spawn: [-82.5, 0, Z], sign: [-84, 4, '← Аэродром'] },
				{ to: 'shahta', x0: 85.2, x1: 90, z0: -3, z1: 3, spawn: [82.5, 0, -Z], sign: [84, 4, 'Шахта →'] },
			],
			// скребер — у северного края провала, в логове (с ним рубер и бегуны); две элиты в стороне — между складом
			// реагентов и цехом № 3 и в ёмкостном парке; руберы — на арене, в обрушенном цехе, у лаборатории
			groups: [
				{ at: LAIR, r: 7, skrebers: 1, rubers: 1, runners: 3 },
				{ at: [-58, -43], r: 5, elites: 1, runners: 2 },
				{ at: [60, -30], r: 5, elites: 1, runners: 2 },
				{ at: [-27, -52], r: 5, rubers: 1, runners: 2 },
				{ at: [30, -58], r: 4, rubers: 1, runners: 1 },
				{ at: [46, 20], r: 5, rubers: 1, runners: 2 },
				{ at: [22, -18], r: 5, stompers: 1, runners: 2 },
				{ at: SHOP3, r: 5, stompers: 1, runners: 2 },
				{ at: [-52, -12], r: 5, stompers: 1, runners: 2 },
				{ at: [-46, 18], r: 5, runners: 3 },
				{ at: [0, 12], r: 6, stompers: 1, runners: 2 },
				{ at: [-38, 0], r: 5, runners: 3 },
				{ at: [36, 0], r: 5, stompers: 1, runners: 2 },
				{ at: [-22, -18], r: 5, runners: 2 },
				{ at: [0, 40], r: 6, stompers: 1, runners: 2 },
				{ at: [-22, 39], r: 5, runners: 2 },
				{ at: [26, 52], r: 5, stompers: 1, runners: 1 },
				{ at: [-68, 12], r: 5, runners: 2 },
				{ at: [68, 10], r: 5, runners: 2 },
				{ at: [-62, -78], r: 4, stompers: 1, runners: 1 },
				{ at: [62, -64], r: 5, runners: 2 },
			],
			onRoad,
			// горит БТР у арены, костёр в логове, бочка у палатки, тлеет у упавшей цистерны
			fires: [[-7, -8.5, 'car', 2.1], [7, -67.5, 'ground'], [-6, 18.5], [52, -15.5, 'ground']],
			water: [[-22, 50, 9, 6]],
			barrels: 6,
			trees(tryTree) {
				// за южным забором — лес, вдоль западного и восточного заборов — редкие сосны и берёзы, у аллеи — берёзы
				for (let i = 0; i < 40; i++) tryTree(R(-86, 86), R(FS + 2.5, 86), rnd() < 0.5 ? 'birch' : 'pine');
				for (let i = 0; i < 12; i++) tryTree(R(-86, -FX - 2), R(-80, FS), 'pine');
				for (let i = 0; i < 12; i++) tryTree(R(FX + 2, 86), R(-80, FS), rnd() < 0.5 ? 'pine' : 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(-26, 26), R(26, 58), 'birch');
			},
			beltDensity: 0.25,
			beltTrees: ['pine', 'birch'],
			clutter: 9,
			blood: 26,
			puddles: 8,
			puddle: () => [R(-80, 80), R(-3, 3)],
			grass: 0.35,
			hint: (b) => ({
				Lair: 'Логово скребера — у края провала брошены ящики военных',
				Hall: 'Аппаратный цех — наполовину рухнул в провал; шкаф КИП и сейф начальника смены',
				Shop3: 'Руины цеха синтеза № 3 — шкаф с ЗИП, электрошкаф, верстак',
				Store: 'Склад реагентов — стеллажи с химией, бочки с кислотой, противогазы, контора кладовщика с сейфом',
				ArmyTent: 'Палатка оцепления — оружейный ящик, патроны, аптечка',
				Admin: 'Заводоуправление — архив, бухгалтерия с кассой, приёмная, кабинет директора с сейфом',
				Lab: 'Заводская лаборатория — вытяжные шкафы, реактивы, холодильник с пробами, сейф заведующей',
			}[b.name]),
		};
	},
};
