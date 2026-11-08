// Кластер «Торговый центр»: ТЦ «Улей» на выезде из города — Улей перенёс его вместе с огромной парковкой и куском
// проспекта. Сам центр (76×44 м) — три здания, в которые заходят (у того, где герой, крыша и верх стен убираются):
// • галерея вдоль фасада — главный вход с порталом и козырьком, сухой фонтан, коридор под световым фонарём, магазины
//   (одежда, обувь, аптека, электроника, связь, «Охота и рыбалка», игрушки, ювелирный), туалеты, подсобка, фудкорт;
// • гипермаркет за ней — лабиринт стеллажей (часть повалена, проходы перегорожены паллетами), холодильные витрины,
//   мясной и хлебный отделы, кассы, зона паллет, кабинет управляющего с сейфом;
// • склад — стеллажи с паллетами, погрузчик, конторка кладовщика; сзади погрузочная рампа с фурами и ворота.
// Снаружи: парковка с разметкой, островками и фонарями, брошенные машины и тележки, стела «УЛЕЙ», остановка с ларьками,
// проспект; за проспектом — АЗС с магазином и автомойка; по бокам — бургерная и садовый центр; сзади — хоздвор, пост охраны.
// Выходы: север (НИИ) — от хоздвора, запад (В/ч) и восток (Микрорайон) — по проспекту, юг (Подстанция) — от проспекта.
// Опасность 3 — логово руберов: руберы и топтуны внутри ТЦ, стаи бегунов на парковке и улице.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { Building, table, chair, buildCheckpoint } from '../buildings.js';
import { hash01, boxTop } from '../facade.js';
import { bench, streetLamp, addCar, bus, markingMaterial, greenhouse, transformer } from '../props.js';
import { billboard, barrier, sandbags } from '../props-industrial.js';

// ---------- Что лежит в тайниках ----------

const LOOT = {
	food: { zhivchik: 0.3, spore: 0.25 },
	drink: { zhivchik: 0.25, spore: 0.25 },
	pharm: { zhivchik: [1, 2, 0.6], spore: 0.15 },
	clothes: { spore: 0.3, ammo919: [2, 5, 0.25] },
	tech: { spore: [1, 3, 0.45] },
	cash: { spore: [2, 5, 0.6], ammo919: [2, 5, 0.2] },
	safe: { spore: [3, 8, 0.75], ammo50: [3, 7, 0.25], ammo919: [8, 14, 0.5], deagle: 0.04 },
	bigsafe: { spore: [4, 10, 0.8], ammo545: [10, 20, 0.35], ak74: 0.05, grenade: 0.06 },
	gun: { ammo12: [6, 14, 0.85], dbarrel: 0.25, spas12: 0.08, ammo76254: [4, 8, 0.15] },
	hunt: { ammo12: [4, 8, 0.55], ammo762: [5, 10, 0.25], grenade: 0.05, fireaxe: 0.06 },
	tools: { ammo12: [3, 6, 0.35], fireaxe: 0.06, grenade: 0.04, spore: 0.2 },
	home: { spore: 0.3, ammo919: [2, 5, 0.2] },
	toys: { spore: 0.3, peas: 0.15 },
	jewel: { spore: [3, 8, 0.65], peas: [1, 2, 0.3] },
	locker: { ammo919: [3, 8, 0.45], zhivchik: 0.25, spore: 0.3, glock17: 0.04 },
	desk: { spore: [2, 5, 0.5], ammo919: [4, 8, 0.4] },
	kitchen: { zhivchik: 0.25, spore: 0.3 },
	fridge: { zhivchik: 0.4 },
	medbox: { zhivchik: [1, 1, 0.55] },
	rack: { zhivchik: 0.3, ammo545: [5, 15, 0.25], spore: 0.3 },
	cargo: { zhivchik: [1, 2, 0.4], ammo545: [10, 20, 0.3], ammo762: [10, 20, 0.2], grenade: 0.08 },
	kiosk: { spore: 0.4, zhivchik: 0.2 },
};

// ---------- Помощники ----------

/** Матрица места: точка и повороты (как у Object3D: rotation.y = ry). */
const at = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
/** Точка в осях предмета (поворот ry) → мир. */
const loc = (x, z, ry, lx, lz = 0) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

/** Товар на полках по отделу: материалы трёх ярусов снизу вверх. */
function goods(IM, kind) {
	switch (kind) {
		case 'food': return [IM.cans, IM.jars, IM.cans];
		case 'drink': return [IM.bottles[0], IM.bottles[1], IM.jars];
		case 'pharm': return [IM.white, IM.jars, IM.white];
		case 'tech': return [IM.black, IM.screen, IM.metal];
		case 'clothes': return [IM.rag, IM.blanket, IM.sofa];
		case 'shoes': return [IM.black, IM.furnitureLight, IM.rag];
		case 'toys': return [IM.redBoard, IM.books[1], IM.blanket];
		case 'home': return [IM.white, IM.crate, IM.books[2]];
		case 'tools': return [IM.metal, IM.crate, IM.black];
		default: return [IM.crate, IM.crate, IM.crate];
	}
}

// ---------- Мебель магазинов (в осях здания; лицо мебели — +Z её осей, там точка обыска) ----------

/** Пристенный стеллаж 0,5 м глубиной: три яруса с товаром, часть растащили. */
function shelf(b, x, z, rot, kind, loot = null, name = 'Стеллаж', len = 2.4) {
	const IM = b.IM, g = goods(IM, kind);
	const parts = [[len, 1.9, 0.06, 0, 0.95, -0.22, IM.furnitureLight], [len, 0.12, 0.5, 0, 0.06, 0, IM.furnitureLight], [len, 0.04, 0.5, 0, 1.9, 0, IM.furnitureLight]];
	[0.45, 0.95, 1.45].forEach((y, i) => {
		parts.push([len - 0.04, 0.03, 0.46, 0, y, 0.02, IM.furniture]);
		const k = hash01(b.name, x, z, i);
		if (k > 0.2) parts.push([(len - 0.4) * (0.45 + 0.55 * k), 0.26, 0.3, (k - 0.6) * 0.3, y + 0.145, 0.04, g[i]]);
	});
	if (loot) b.container(name, x, z, rot, parts, [len, 0.5], loot, 1.9);
	else b.furniture(x, z, rot, parts, { solid: [len, 0.5] });
}

/** Островной стеллаж гипермаркета: двусторонний, 1 м глубиной, вдоль своей оси X. */
function gondolaParts(b, len, kind, key) {
	const IM = b.IM, g = goods(IM, kind);
	const parts = [[len, 0.12, 1.0, 0, 0.06, 0, IM.black], [len, 1.75, 0.05, 0, 0.95, 0, IM.white], [len, 0.06, 0.1, 0, 1.84, 0, IM.redBoard]];
	for (const s of [-1, 1]) [0.42, 0.92, 1.42].forEach((y, i) => {
		parts.push([len - 0.05, 0.03, 0.44, 0, y, s * 0.26, IM.white]);
		const k = hash01(b.name, key, s, i);
		if (k > 0.25) parts.push([(len - 0.4) * (0.45 + 0.55 * k), 0.26, 0.34, (k - 0.6) * 0.5, y + 0.145, s * 0.27, g[i]]);
	});
	return parts;
}
function gondola(b, x, z, rot, len, kind, loot = null, name = 'Стеллаж') {
	const parts = gondolaParts(b, len, kind, `${x}:${z}`);
	if (loot) b.container(name, x, z, rot, parts, [len, 1.0], loot, 1.85);
	else b.furniture(x, z, rot, parts, { solid: [len, 1.0] });
}
/** Поваленный стеллаж: лежит на боку (верх чуть приподнят товаром), вокруг рассыпано. */
function toppled(b, x, z, rot, len, kind) {
	const parts = gondolaParts(b, len, kind, `t${x}:${z}`).map(([w, h, d, px, py, pz, mat]) => [0, 0, 0, 0, 0, 0, mat, { geo: box(w, h, d, 0.8).translate(px, py, pz).rotateX(-1.42).translate(0, 0.52, 0.91) }]);
	const g = goods(b.IM, kind);
	for (let i = 0; i < 7; i++) {
		const k = hash01(b.name, x, z, 's', i), q = hash01(b.name, z, x, 'q', i);
		parts.push([0.32, 0.18, 0.26, (k - 0.5) * len, 0.09, (q < 0.5 ? -1 : 1) * (1.15 + q * 0.4), g[i % 3]]);
	}
	b.furniture(x, z, rot, parts, { solid: [len, 2.0] });
}

/** Прилавок с кассой; glass — стеклянная витрина. */
function counter(b, name, x, z, rot, w, loot, glass = false) {
	const IM = b.IM;
	const parts = glass
		? [[w, 0.9, 0.7, 0, 0.45, 0, IM.white], [w - 0.1, 0.32, 0.6, 0, 1.06, 0, IM.glass], [w * 0.6, 0.08, 0.4, -w * 0.1, 0.94, 0, IM.jars]]
		: [[w, 1.0, 0.7, 0, 0.5, 0, IM.furniture], [w + 0.1, 0.05, 0.8, 0, 1.02, 0, IM.furnitureLight], [0.45, 0.25, 0.35, w / 2 - 0.5, 1.17, -0.1, IM.black]];
	if (loot) b.container(name, x, z, rot, parts, [w, 0.7], loot, 1.25);
	else b.furniture(x, z, rot, parts, { solid: [w, 0.7] });
}

/** Тайник (loot) или та же мебель без тайника (loot = null; prop — модель Tripo в игре). */
function piece(b, name, x, z, rot, parts, solid, loot, h, prop = null) {
	if (loot) b.container(name, x, z, rot, parts, solid, loot, h);
	else b.furniture(x, z, rot, parts, { solid, prop });
}

const safe = (b, x, z, rot, loot) => b.container('Сейф', x, z, rot, [[0.7, 1.1, 0.6, 0, 0.55, 0, b.IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, b.IM.black]], [0.7, 0.6], loot, 1.1);
const cabinet = (b, x, z, rot, w, loot) => piece(b, 'Шкаф', x, z, rot, [
	[w, 2.0, 0.55, 0, 1.0, 0, b.IM.furniture], [0.02, 1.88, 0.02, 0, 1.0, 0.28, b.IM.black],
	[0.04, 0.12, 0.03, -0.08, 1.1, 0.29, b.IM.metal], [0.04, 0.12, 0.03, 0.08, 1.1, 0.29, b.IM.metal],
], [w, 0.55], loot, 2.0, 'wardrobe');
const fridge = (b, x, z, rot, loot) => piece(b, 'Холодильник', x, z, rot, [[0.62, 1.5, 0.6, 0, 0.75, 0, b.IM.white], [0.04, 0.3, 0.04, -0.24, 1.0, 0.32, b.IM.metal]], [0.62, 0.6], loot, 1.5, 'fridge');
const atm = (b, x, z, rot, loot) => b.container('Банкомат', x, z, rot, [[0.8, 1.7, 0.7, 0, 0.85, 0, b.IM.metal], [0.5, 0.35, 0.03, 0, 1.3, 0.36, b.IM.screen], [0.3, 0.06, 0.04, 0, 1.0, 0.36, b.IM.black]], [0.8, 0.7], loot, 1.7);
const desk = (b, name, x, z, rot, loot) => b.container(name, x, z, rot, [[1.4, 0.75, 0.7, 0, 0.375, 0, b.IM.furniture], [0.45, 0.32, 0.3, 0.35, 0.91, -0.1, b.IM.black]], [1.4, 0.7], loot, 0.95);

/** Вешалка-рейл с одеждой. */
function rail(b, x, z, rot, len) {
	const IM = b.IM, parts = [[len, 0.03, 0.03, 0, 1.45, 0, IM.metal]];
	for (const s of [-1, 1]) parts.push([0.04, 1.45, 0.04, (s * len) / 2, 0.72, 0, IM.metal], [0.04, 0.04, 0.5, (s * len) / 2, 0.02, 0, IM.metal]);
	const k = hash01(b.name, x, z);
	parts.push([(len - 0.2) * (0.5 + 0.5 * k), 0.85, 0.36, (k - 0.5) * 0.4, 0.98, 0, k < 0.5 ? IM.rag : IM.blanket]);
	b.furniture(x, z, rot, parts, { solid: [len, 0.5] });
}

/** Паллета с коробками (h — высота штабеля). */
function pallet(b, x, z, rot, h, loot = null) {
	const IM = b.IM, k = hash01(b.name, x, z);
	const parts = [[1.2, 0.14, 1.0, 0, 0.07, 0, IM.crate], [1.1, h, 0.92, 0, 0.14 + h / 2, 0, k < 0.5 ? IM.furnitureLight : IM.crate]];
	if (k > 0.55) parts.push([0.5, 0.4, 0.45, 0.2, 0.34 + h, -0.1, IM.furnitureLight]);
	if (loot) b.container('Паллета с товаром', x, z, rot, parts, [1.2, 1.0], loot, h + 0.4);
	else b.furniture(x, z, rot, parts, { solid: [1.2, 1.0] });
}

/** Складской стеллаж: стойки, жёлтые балки, паллеты с коробками на двух ярусах. */
function palletRack(b, x, z, rot, len, loot = null) {
	const IM = b.IM, M = b.ctx.M, parts = [];
	for (const px of [-len / 2, 0, len / 2]) for (const pz of [-0.55, 0.55]) parts.push([0.08, 2.5, 0.08, px, 1.25, pz, IM.rack]);
	for (const y of [1.3, 2.45]) for (const pz of [-0.55, 0.55]) parts.push([len, 0.1, 0.06, 0, y, pz, M.hazard]);
	for (const [y, lvl] of [[0, 0], [1.35, 1]]) for (const s of [-1, 1]) {
		const k = hash01(b.name, x, z, lvl, s);
		if (lvl > 0 && k < 0.3) continue;
		const h = 0.7 + k * 0.3;
		parts.push([len / 2 - 0.35, 0.12, 1.0, (s * len) / 4, y + 0.06, 0, IM.crate], [len / 2 - 0.45, h, 0.92, (s * len) / 4, y + 0.12 + h / 2, 0, k < 0.5 ? IM.furnitureLight : IM.crate]);
	}
	if (loot) b.container('Стеллаж с паллетами', x, z, rot, parts, [len, 1.2], loot, 2.5);
	else b.furniture(x, z, rot, parts, { solid: [len, 1.2] });
}

/** Погрузчик: корпус, противовес, рама кабины, мачта с вилами. */
function forklift(b, x, z, rot) {
	const IM = b.IM, M = b.ctx.M;
	b.furniture(x, z, rot, [
		[1.15, 0.9, 1.9, 0, 0.75, -0.1, M.hazard], [1.15, 0.7, 0.45, 0, 0.75, -1.15, IM.black],
		...[[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.7], [0.5, -0.7]].map(([px, pz]) => [0.06, 1.25, 0.06, px, 1.82, pz, IM.black]),
		[1.15, 0.06, 1.35, 0, 2.45, -0.1, IM.black], [0.9, 2.3, 0.12, 0, 1.15, 0.92, IM.black],
		[0.12, 0.06, 1.1, -0.3, 0.12, 1.5, IM.metal], [0.12, 0.06, 1.1, 0.3, 0.12, 1.5, IM.metal],
		...[[-0.6, 0.45, 0.55], [0.6, 0.45, 0.55], [-0.6, -0.9, 0.45], [0.6, -0.9, 0.45]].map(([px, pz, r]) => [0.3, r, r, px, r / 2, pz, IM.black]),
	], { solid: [1.3, 3.4] });
}

/** Кадка с засохшей пальмой (или кустом). */
function planter(b, x, z, palm = true) {
	const M = b.ctx.M;
	b.furniture(x, z, 0, [[1.3, 0.55, 1.3, 0, 0.275, 0, M.concrete]], { solid: [1.3, 1.3] });
	b.lower(place(planeXZ(1.15, 1.15), x, 0.56, z), M.dirt, { cast: false });
	if (!palm) { b.lower(place(new THREE.IcosahedronGeometry(0.55, 1).scale(1, 0.7, 1), x, 0.85, z), M.leaves); return; }
	b.lower(place(new THREE.CylinderGeometry(0.08, 0.12, 2.3, 6), x, 1.7, z), M.bark);
	for (let i = 0; i < 6; i++) {
		const a = i * 1.047 + hash01(b.name, x, z) * 2;
		b.lower(place(new THREE.IcosahedronGeometry(0.5, 0).scale(1.7, 0.18, 0.55), x + Math.cos(a) * 0.65, 2.7 - (i % 2) * 0.25, z - Math.sin(a) * 0.65, a, 0, -0.35), M.leavesDry);
	}
}

/** Сухой фонтан: чаша, бортик, тумба с вазой. */
function fountain(b, x, z) {
	const M = b.ctx.M;
	b.lower(new THREE.CylinderGeometry(1.8, 1.85, 0.5, 24, 1, true).translate(x, 0.25, z), M.concrete);
	b.lower(new THREE.RingGeometry(1.5, 1.85, 24).rotateX(-Math.PI / 2).translate(x, 0.5, z), M.concrete, { cast: false });
	b.lower(new THREE.CircleGeometry(1.55, 24).rotateX(-Math.PI / 2).translate(x, 0.14, z), M.concreteDark, { cast: false });
	b.lower(new THREE.CylinderGeometry(0.3, 0.42, 1.3, 12).translate(x, 0.65, z), M.concrete);
	b.lower(new THREE.CylinderGeometry(0.85, 0.35, 0.3, 16).translate(x, 1.42, z), M.concrete);
	b.collide(x, z, 3.5, 3.5);
	b.solids.push([x, z, 3.5, 3.5, 0]);
}

/** Блок туалетных кабинок: перегородки, унитазы, приоткрытые дверцы. */
function stalls(b, x, z, rot, n = 2) {
	const IM = b.IM, w = 1.65, parts = [];
	for (let i = 0; i <= n; i++) parts.push([0.05, 2.0, 1.45, (-n * w) / 2 + i * w, 1.0, 0, IM.shopWall]);
	for (let i = 0; i < n; i++) {
		const cx = (-n * w) / 2 + (i + 0.5) * w;
		parts.push([0.42, 0.42, 0.62, cx, 0.21, -0.35, IM.white]);
		parts.push([0.75, 1.8, 0.04, cx - 0.4 + hash01(b.name, x, i) * 0.5, 1.0, 0.73, IM.shopWall]);
	}
	b.furniture(x, z, rot, parts, { solid: [n * w + 0.1, 1.5] });
}

/** Витрина на наружной стене (лицо — +Z здания, к парковке): стекло с импостами и вывеска над ним. */
function vitrine(b, x0, x1, zFace, sign) {
	const M = b.ctx.M, w = x1 - x0 - 1.2, cx = (x0 + x1) / 2, n = Math.max(1, Math.round(w / 1.6));
	b.top_(new THREE.PlaneGeometry(w, 2.4).translate(cx, 2.1, zFace), M.glass);
	for (let i = 0; i <= n; i++) b.top_(place(box(0.08, 2.5, 0.06), cx - w / 2 + (i * w) / n, 2.1, zFace + 0.03), M.tankBlack);
	if (sign) b.top_(new THREE.PlaneGeometry(Math.min(w, 5.2), 0.75).translate(cx, 3.72, zFace + 0.01), sign);
}

// ---------- Торговый центр ----------

/**
 * Галерея 76×22 м (центр — (0, −23), юг — фасад к парковке): ряд магазинов вдоль фасада, коридор под световым фонарём,
 * северный ряд — игрушки, вход в гипермаркет, ювелирный, туалеты, подсобка, фудкорт. Вход — по оси, двери в торцах.
 */
function buildGallery(bctx, S) {
	const W = 76, D = 22, H = 4.2, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Galereya', cx: 0, cz: -23, ry: 0, W, D, H, top: 7.9 });
	b.messKind = 'shop';
	const { M, batch, collide } = bctx, IM = b.IM;
	const wz = (z) => z - 23; // локальная z → мировая (здание не повёрнуто)
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	// наружные стены (северную — общую с гипермаркетом и складом — ставят они)
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.plaster, t, doors: [0], w: 4, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, doors: [-0.5], w: 2.4, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.plaster, t, doors: [-0.5], w: 2.4, lining: IM.shopWall, side: -1 });
	// перегородки: южный ряд магазинов (витрины к коридору), северный ряд
	const P = { mat: IM.shopWall, t: 0.15 };
	b.wall('x', 3, -hx + t / 2, -5, { ...P, doors: [-30, -22, -9.5], w: 2.2 });
	b.wall('x', 3, 5, hx - t / 2, { ...P, doors: [9.5, 22, 31], w: 2.2 });
	for (const x of [-27, -17, -5, 5, 17, 27]) b.wall('z', x, 3.075, hz - t / 2, P);
	b.wall('x', -4, -hx + t / 2, -30, { ...P, doors: [-34], w: 2.2 });
	b.wall('x', -4, -8, 0, { ...P, doors: [-4], w: 2.2 });
	b.wall('x', -4, 0, 8, { ...P, doors: [4], w: 1.4 });
	b.wall('x', -4, 8, 12, { ...P, doors: [10], w: 1.2 });
	for (const x of [-30, -8, 0, 8, 12]) b.wall('z', x, -hz + 0.15, -4.075, P);
	b.wall('z', 4, -hz + 0.15, -7.2, P); // туалет: М | Ж

	// ---------- фасад: витрины с вывесками, жёлтая полоса, портал входа с названием, козырёк ----------
	const face = hz + t / 2 + 0.02;
	vitrine(b, -38, -27, face, S.odezhda);
	vitrine(b, -27, -17, face, S.obuv);
	vitrine(b, -17, -7.2, face, S.apteka);
	vitrine(b, 7.2, 17, face, S.tech);
	vitrine(b, 17, 27, face, S.svyaz);
	vitrine(b, 27, 38, face, S.ohota);
	b.top_(place(box(W + 0.4, 0.42, 0.12), 0, H - 0.25, face + 0.05), M.yellow);
	for (const s of [-1, 1]) {
		b.wallBox('back', s * 6.4, 1.2, 0, 7.9, 1.0, M.yellow, { t });
		b.collide(s * 6.4, hz + t / 2 + 0.5, 1.2, 1.0);
		b.top_(new THREE.PlaneGeometry(3.6, 1.95).translate(s * 3.9, 1.05, face + 0.01), M.glass); // стекло по бокам от дверей
	}
	// над входом — остеклённый объём на крыше, сверху чёрный аттик с названием
	b.top_(place(boxTop(12, 3.4, 5, 2), 0, H + 1.7, hz - 2.4), M.plaster);
	b.top_(new THREE.PlaneGeometry(11.6, 2.0).translate(0, H + 1.05, hz + 0.12), M.glass);
	b.top_(new THREE.PlaneGeometry(11.6, 2.4).translate(0, 2.0 + 1.2 - 0.05, face + 0.01), M.glass); // витраж над дверями
	b.top_(place(box(13.6, 1.4, 0.9), 0, H + 3.1, hz + 0.0), M.tankBlack);
	b.top_(new THREE.PlaneGeometry(11.4, 1.15).translate(0, H + 3.1, hz + 0.46), S.ulei);
	b.canopy('back', 0, { w: 9.4, d: 3.6, y: 3.0, mat: M.tankBlack, posts: M.metalDark, t, thick: 0.16 });
	for (const s of [-1, 1]) collide(s * 4.6, wz(hz + t / 2 + 3.44 + 0.05), 0.3, 0.3);
	// пчелиные соты на пилонах
	for (const s of [-1, 1]) for (const [dy, dx] of [[5.2, 0], [5.9, 0.35], [6.6, 0]]) {
		b.top_(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 6).rotateX(Math.PI / 2).translate(s * (6.4 + dx - 0.17), dy, hz + t / 2 + 1.03), M.tankBlack);
	}
	// крыша: две плиты, над коридором — световой фонарь; парапет, вентиляция
	b.top_(place(box(W + 0.3, 0.3, 7.3, 3), 0, H + 0.15, -7.5), M.roofTar);
	b.top_(place(box(W + 0.3, 0.3, 8.3, 3), 0, H + 0.15, 7.0), M.roofTar);
	b.top_(place(boxTop(W - 2, 0.9, 7.2, 2), 0, H + 0.45, -0.5), M.glass);
	for (let x = -hx + 1.5; x <= hx - 1.5; x += 3.6) b.top_(place(boxTop(0.12, 0.1, 7.3, 1), x, H + 0.95, -0.5), M.tankBlack);
	b.parapet(H + 0.3, M.tankBlack, 0.45);
	for (const [x, z] of [[-25, -8], [-12, -8.2], [21, -8.4], [31, -7.6]]) b.top_(place(boxTop(2.2, 1.0, 1.6, 1), x, H + 0.8, z), M.silver);
	for (const [x, z] of [[-33, 7.5], [-20, 8], [18, 7.5], [33, 8.2]]) b.vent(x, z, H + 0.3, M.metalDark, { h: 0.6 });

	// ---------- южный ряд ----------
	// одежда: полки, стеллаж, рейлы, примерочные, касса, манекен
	shelf(b, -37.6, 7.2, Math.PI / 2, 'clothes', null, 'Полка', 2.8);
	shelf(b, -33.5, 10.6, Math.PI, 'clothes', LOOT.clothes);
	counter(b, 'Касса', -35.6, 4.2, 0, 1.8, LOOT.cash);
	rail(b, -32.5, 6.3, 0, 2.6);
	rail(b, -32.5, 8.1, 0.12, 2.6);
	b.furniture(-28.3, 9.0, -Math.PI / 2, [
		[2.8, 2.1, 0.05, 0, 1.05, -0.7, IM.shopWall], [0.05, 2.1, 1.4, -1.4, 1.05, 0, IM.shopWall], [0.05, 2.1, 1.4, 0, 1.05, 0, IM.shopWall], [0.05, 2.1, 1.4, 1.4, 1.05, 0, IM.shopWall],
		[1.25, 1.8, 0.03, -0.7, 1.1, 0.7, IM.blanket], [0.6, 1.8, 0.03, 0.95, 1.1, 0.7, IM.blanket],
	], { solid: [2.8, 1.4] }); // примерочные
	b.furniture(-29.6, 5.2, 0, [[0.4, 0.05, 0.4, 0, 0.05, 0, IM.metal], [0.05, 1.0, 0.05, 0, 0.55, 0, IM.metal], [0.42, 0.7, 0.26, 0, 1.4, 0, IM.rag]], { solid: [0.5, 0.5] }); // манекен
	// обувь
	shelf(b, -24.6, 10.6, Math.PI, 'shoes', LOOT.clothes, 'Стеллаж с обувью');
	shelf(b, -20.6, 10.6, Math.PI, 'shoes');
	shelf(b, -26.65, 7.2, Math.PI / 2, 'shoes');
	counter(b, 'Касса', -18.0, 6.0, -Math.PI / 2, 1.8, LOOT.cash);
	b.furniture(-22, 7.4, 0, [[1.6, 0.42, 0.5, 0, 0.21, 0, IM.sofa]], { solid: [1.6, 0.5] }); // пуф
	// аптека: витрина поперёк зала, за ней стеллажи с лекарствами, сейф, холодильник с инсулином
	counter(b, 'Витрина', -12.5, 7.0, Math.PI, 5.0, LOOT.pharm, true);
	shelf(b, -14.3, 10.6, Math.PI, 'pharm', LOOT.pharm, 'Стеллаж с лекарствами');
	shelf(b, -11.6, 10.6, Math.PI, 'pharm');
	shelf(b, -16.65, 4.8, Math.PI / 2, 'pharm');
	safe(b, -6.0, 10.3, Math.PI, LOOT.safe);
	fridge(b, -8.6, 10.5, Math.PI, null);
	// вестибюль: фонтан, банкомат, стенд со схемой этажа
	fountain(b, 0, 6.8);
	atm(b, -4.55, 9.8, Math.PI / 2, { spore: [2, 6, 0.55] });
	b.furniture(3.9, 4.4, -0.3, [[1.3, 1.9, 0.12, 0, 0.95, 0, IM.black], [1.1, 1.2, 0.02, 0, 1.3, 0.07, IM.paper]], { solid: [1.3, 0.2] });
	// электроника: стеллажи с телевизорами, стол-витрина с ноутбуками, касса
	shelf(b, 7.6, 10.6, Math.PI, 'tech', LOOT.tech);
	shelf(b, 10.4, 10.6, Math.PI, 'tech');
	shelf(b, 13.2, 10.6, Math.PI, 'tech');
	b.furniture(11, 6.6, 0, [
		[3.0, 0.9, 1.2, 0, 0.45, 0, IM.furnitureLight], [0.5, 0.03, 0.35, -1.0, 0.92, 0, IM.black], [0.5, 0.3, 0.02, -1.0, 1.06, -0.17, IM.screen],
		[0.5, 0.03, 0.35, 0.1, 0.92, 0.1, IM.black], [0.5, 0.3, 0.02, 0.1, 1.06, -0.07, IM.screen], [0.6, 0.4, 0.4, 1.0, 1.1, 0, IM.black],
	], { solid: [3.0, 1.2] });
	counter(b, 'Касса', 16.0, 5.0, -Math.PI / 2, 1.8, LOOT.cash);
	// связь: витрина с телефонами, касса, стойка
	counter(b, 'Витрина', 20.5, 10.4, Math.PI, 3.4, LOOT.tech, true);
	counter(b, 'Касса', 26.2, 6.4, -Math.PI / 2, 1.8, LOOT.cash);
	shelf(b, 17.35, 6.5, Math.PI / 2, 'tech');
	b.furniture(22, 7.0, 0, [[1.6, 1.0, 0.7, 0, 0.5, 0, IM.white], [1.4, 0.06, 0.5, 0, 1.03, 0, IM.black]], { solid: [1.6, 0.7] });
	// «Охота и рыбалка»: оружейный шкаф, стеллаж со снаряжением, прилавок, палатка, удочки
	b.container('Оружейный шкаф', 31.5, 10.55, Math.PI, [
		[2.0, 1.9, 0.45, 0, 0.95, 0, IM.metal], [1.8, 1.6, 0.02, 0, 1.0, 0.23, IM.glass],
		...[-0.7, -0.35, 0, 0.35, 0.7].map((x) => [0.07, 1.1, 0.08, x, 1.0, 0.1, IM.black]),
	], [2.0, 0.45], LOOT.gun, 1.9);
	shelf(b, 35.2, 10.6, Math.PI, 'tools', LOOT.hunt, 'Стеллаж со снаряжением');
	counter(b, 'Прилавок', 37.2, 6.0, -Math.PI / 2, 2.6, LOOT.hunt);
	b.lower(place(new THREE.ConeGeometry(1.25, 1.5, 4), 29.6, 0.75, 7.0, Math.PI / 4), M.canvas);
	b.collide(29.6, 7.0, 1.8, 1.8); b.solids.push([29.6, 7.0, 1.8, 1.8, 0]);
	b.furniture(27.35, 5.2, Math.PI / 2, [...[-0.6, -0.3, 0, 0.3, 0.6].map((x) => [0.03, 2.2, 0.03, x, 1.1, 0.05, IM.black]), [1.5, 0.08, 0.2, 0, 0.3, 0, IM.furniture]], { solid: [1.5, 0.3] }); // удочки

	// ---------- северный ряд ----------
	// игрушки
	shelf(b, -35.6, -10.6, 0, 'toys', LOOT.toys);
	shelf(b, -32.6, -10.6, 0, 'toys');
	counter(b, 'Касса', -30.65, -7.2, -Math.PI / 2, 1.8, null);
	b.furniture(-36.4, -6.0, 0.4, [[0.8, 0.4, 1.3, 0, 0.3, 0, IM.redBoard], [0.7, 0.3, 0.6, 0, 0.62, -0.1, IM.redBoard]], { solid: [0.9, 1.4] }); // детская машинка
	// перед гипермаркетом: тележки, камера хранения, стойка информации, фотобудка
	for (let i = 0; i < 5; i++) cart(batch, M, null, -29 + i * 0.42, wz(-10.1), Math.PI / 2);
	collide(-28.15, wz(-10.1), 2.8, 0.7);
	b.solids.push([-28.15, -10.1, 2.8, 0.7, 0]);
	b.container('Камера хранения', -11.5, -10.55, 0, [
		[3.0, 1.9, 0.5, 0, 0.95, 0, IM.locker],
		...[0.5, 1.0, 1.5].map((y) => [2.95, 0.02, 0.02, 0, y, 0.26, IM.black]),
		...[-0.75, 0, 0.75].map((x) => [0.02, 1.85, 0.02, x, 0.95, 0.26, IM.black]),
	], [3.0, 0.5], LOOT.locker, 1.9);
	counter(b, 'Стойка информации', -27.0, -6.0, 0, 2.2, LOOT.desk);
	b.furniture(-9.0, -10.1, 0, [[1.2, 2.0, 1.0, 0, 1.0, 0, IM.redBoard], [0.5, 1.4, 0.02, 0.2, 1.1, 0.51, IM.blanket]], { solid: [1.2, 1.0] }); // фотобудка
	// ювелирный
	counter(b, 'Витрина', -5.2, -8.6, 0, 3.6, LOOT.jewel, true);
	safe(b, -1.0, -10.4, 0, LOOT.jewel);
	counter(b, null, -7.55, -6.0, Math.PI / 2, 2.0, null, true);
	// туалеты: кабинки, раковины, аптечка на стене
	stalls(b, 2.0, -10.1, 0);
	stalls(b, 6.0, -10.1, 0);
	for (const [x, r] of [[0.4, Math.PI / 2], [7.6, -Math.PI / 2]]) b.furniture(x, -6.6, r, [[1.6, 0.85, 0.5, 0, 0.42, 0, IM.white], [1.4, 0.7, 0.03, 0, 1.55, -0.22, IM.glass]], { solid: [1.6, 0.5] });
	b.container('Аптечка на стене', 1.6, -4.45, Math.PI, [[0.8, 0.8, 0.4, 0, 1.3, 0, IM.white], [0.3, 0.3, 0.02, 0, 1.3, 0.21, IM.redBoard]], [0.8, 0.4], LOOT.medbox, 1.7);
	// подсобка: шкаф уборщицы, стеллаж с химией, ведро со шваброй
	cabinet(b, 8.35, -8.8, Math.PI / 2, 1.0, LOOT.home);
	shelf(b, 11.65, -8.5, -Math.PI / 2, 'tools', LOOT.tools, 'Стеллаж с химией', 2.0);
	b.furniture(9.6, -10.3, 0, [[0.4, 0.35, 0.4, 0, 0.18, 0, IM.locker], [0.03, 1.3, 0.03, 0.1, 0.8, 0, IM.furniture]], { solid: [0.4, 0.4] });
	// фудкорт: три кухни у северной стены (стойка, за ней плиты и холодильник), столики
	const kitchens = [[15.5, 'Стойка «Шаурма»'], [21.5, 'Стойка «Пицца»'], [27.5, 'Стойка «Блины»']];
	for (const [x, name] of kitchens) {
		counter(b, name, x, -8.2, 0, 4.4, x === 21.5 ? null : LOOT.kitchen);
		const w = x === 21.5 ? 3.2 : 4.2, ox = x === 21.5 ? -0.5 : 0;
		b.furniture(x + ox, -10.45, 0, [[w, 0.9, 0.7, 0, 0.45, 0, IM.metal], [w * 0.4, 0.05, 0.5, -w * 0.2, 0.93, 0, IM.black], [0.5, 0.35, 0.5, w * 0.3, 1.08, 0, IM.metal]], { solid: [w, 0.7] });
	}
	fridge(b, 23.2, -10.5, 0, LOOT.fridge);
	for (const z of [-5.6, -2.2]) for (const x of [15, 19.5, 24, 28.5]) {
		if (hash01('fc', x, z) < 0.18) continue; // столик унесли
		table(b, x, z, Math.PI / 2, { w: 1.1, d: 0.75 });
		chair(b, x - 0.8, z, Math.PI / 2);
		if (hash01('fc2', x, z) < 0.7) chair(b, x + 0.8, z, -Math.PI / 2);
	}
	for (const [x, z] of [[13.2, -5.0], [31.2, -5.2]]) b.furniture(x, z, 0, [[0.5, 0.9, 0.5, 0, 0.45, 0, IM.locker]], { solid: [0.5, 0.5] }); // урны

	// ---------- коридор: кофейный островок, кадки с пальмами, лавки; баррикада у западного входа ----------
	b.container('Кофейный островок', -18, -0.5, 0, [
		[2.6, 1.0, 1.4, 0, 0.5, 0, IM.furniture], [2.7, 0.05, 1.5, 0, 1.02, 0, IM.furnitureLight],
		[0.5, 0.55, 0.45, -0.7, 1.32, 0, IM.black], [0.12, 1.4, 0.12, 1.15, 1.7, 0.6, IM.metal], [2.8, 0.06, 1.6, 0, 2.4, 0, IM.redBoard],
	], [2.6, 1.4], LOOT.kitchen, 1.4);
	planter(b, -27, -0.5);
	planter(b, -9, -0.5);
	planter(b, 9, -0.5, false);
	for (const [x, z, r] of [[-13, 2.4, 0], [-34.5, 2.4, 0], [14, 2.4, 0], [-22, -3.4, Math.PI], [33.5, 2.4, 0]]) bench(batch, M, x, wz(z), r);
	for (const [x, z] of [[-35.0, -3.3], [-35.0, -2.4], [-34.9, -1.5]]) b.furniture(x, z, hash01('br', z) * 0.4, [[0.9, 0.9, 0.85, 0, 0.45, 0, IM.crate]], { solid: [0.9, 0.85], prop: 'crate' });
	cart(batch, M, collide, -35.2, wz(-0.4), 0.3, true);
	return b.finish();
}

/**
 * Гипермаркет 48×22 м (центр — (−14, −45)): вход из галереи — широкий проём с кассами; островные стеллажи с севера на юг
 * в два ряда с поперечным проходом (два повалены, проходы перегорожены паллетами), холодильные витрины у северной стены,
 * мясной и хлебный отделы у западной, зона паллет и кабинет управляющего на востоке; выход на хоздвор и пожарный — на запад.
 */
function buildHyper(bctx, S) {
	const W = 48, D = 22, H = 6.5, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Gipermarket', cx: -14, cz: -45, ry: 0, W, D, H, top: H + 0.9 });
	b.messKind = 'shop';
	const { M, batch } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 3), 0, 0.025, 0), M.concreteDark, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.tankWhite, t, doors: [12], w: 1.6, lining: IM.whitewash, side: 1, sx: 2 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.tankWhite, t, doors: [7], w: 1.6, lining: IM.whitewash, side: 1, sx: 2 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: IM.shopWall, t, doors: [-5], w: 10, lining: IM.whitewash, side: -1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.concrete, t, doors: [1], w: 2.6, lining: IM.whitewash, side: -1 });
	// кабинет управляющего (северо-восточный угол)
	b.wall('x', -5.5, 18, hx - t / 2, { mat: IM.whitewash, t: 0.15, doors: [20.2], w: 1.2 });
	b.wall('z', 18, -hz + t / 2, -5.425, { mat: IM.whitewash, t: 0.15 });
	desk(b, 'Стол управляющего', 21.6, -9.8, 0, LOOT.desk);
	chair(b, 21.6, -10.5, 0);
	safe(b, 23.5, -7.2, -Math.PI / 2, LOOT.bigsafe);
	b.furniture(18.4, -9.6, Math.PI / 2, [[1.2, 1.5, 0.45, 0, 0.75, 0, IM.locker]], { solid: [1.2, 0.45] });
	// крыша, парапет, кондиционеры; над галереей видна верхняя часть южной стены — вывеска «Гипермаркет»
	b.top_(place(box(W + 0.3, 0.3, D + 0.3, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.tankBlack, 0.4);
	for (const [x, z] of [[-14, -4], [-4, -6.5], [7, 2], [16, -3]]) b.top_(place(boxTop(2.6, 1.1, 1.8, 1), x, H + 0.85, z), M.silver);
	for (const [x, z] of [[-20, 5], [0, 6], [12, -8]]) b.vent(x, z, H + 0.3, M.metalDark, { h: 0.7, r: 0.2 });
	b.top_(new THREE.PlaneGeometry(15, 1.35).translate(-5, 5.72, hz + t / 2 + 0.02), S.hyper);
	b.top_(place(box(W + 0.4, 0.3, 0.1), 0, H - 0.2, hz + t / 2 + 0.05), M.yellow);
	// островные стеллажи: северный ряд (z −8.2…−3.4) и южный (z −1.6…4.0)
	const xs = [-20, -16.5, -13, -9.5, -6, -2.5, 1, 4.5, 8, 11.5];
	const north = ['food', 'food', 'drink', 'drink', 'home', 'home', 'pharm', 'clothes', 'tools', 'toys'];
	const south = ['food', 'drink', 'drink', 'home', 'drink', 'food', 'food', 'clothes', 'toys', 'toys'];
	const nLoot = { [-20]: LOOT.food, [4.5]: LOOT.pharm };
	const sLoot = { [-13]: LOOT.drink, [1]: LOOT.food, [11.5]: LOOT.toys };
	xs.forEach((x, i) => {
		if (x === 8) toppled(b, x, -5.8, Math.PI / 2, 4.8, north[i]);
		else gondola(b, x, -5.8, Math.PI / 2, 4.8, north[i], nLoot[x] ?? null);
		if (x === -9.5) toppled(b, x, 1.2, Math.PI / 2, 5.6, south[i]);
		else gondola(b, x, 1.2, Math.PI / 2, 5.6, south[i], sLoot[x] ?? null);
	});
	pallet(b, -14.75, 1.2, 0.3, 1.2); // проход перегорожен
	pallet(b, 6.25, 1.6, -0.2, 1.0);
	// холодильные витрины у северной стены
	[-20.2, -16.4, -12.6, -8.8, -5.0, -1.2, 2.6, 6.4].forEach((x) => {
		const parts = [[3.6, 0.85, 1.0, 0, 0.42, 0, IM.white], [3.5, 0.5, 0.9, 0, 1.1, -0.05, IM.glass], [3.2, 0.12, 0.6, 0, 0.92, 0.05, hash01('fr', x) < 0.5 ? IM.cans : IM.jars], [3.6, 0.8, 0.15, 0, 1.25, -0.43, IM.white]];
		if (x === -12.6) b.container('Холодильная витрина', x, -10.3, 0, parts, [3.6, 1.0], LOOT.food, 1.7);
		else b.furniture(x, -10.3, 0, parts, { solid: [3.6, 1.0] });
	});
	// мясной и хлебный отделы у западной стены
	counter(b, 'Мясной отдел', -23.2, -6, Math.PI / 2, 3.0, LOOT.fridge, true);
	b.container('Хлебный отдел', -23.2, 0, Math.PI / 2, [[3.0, 1.0, 0.8, 0, 0.5, 0, IM.furnitureLight], [2.8, 0.25, 0.6, 0, 1.12, 0, IM.crate], [3.0, 0.8, 0.1, 0, 1.4, -0.35, IM.furnitureLight]], [3.0, 0.8], LOOT.food, 1.6);
	// кассы в проёме, камера хранения, промо-паллеты
	for (const [x, loot] of [[-7.5, LOOT.cash], [-4.5, LOOT.cash], [-1.5, null]]) {
		const parts = [[2.4, 0.85, 0.75, 0, 0.42, 0, IM.furniture], [1.5, 0.04, 0.5, -0.4, 0.87, 0, IM.black], [0.4, 0.3, 0.35, 0.85, 1.0, 0.1, IM.black], [0.32, 0.22, 0.04, 0.85, 1.3, 0.1, IM.screen]];
		if (loot) b.container('Касса', x, 7.5, Math.PI / 2, parts, [2.4, 0.75], loot, 1.3);
		else b.furniture(x, 7.5, Math.PI / 2, parts, { solid: [2.4, 0.75] });
	}
	b.container('Шкафчики', -18.5, 10.55, Math.PI, [[2.4, 1.8, 0.5, 0, 0.9, 0, IM.locker], ...[0.6, 1.2].map((y) => [2.35, 0.02, 0.02, 0, y, 0.26, IM.black]), ...[-0.6, 0, 0.6].map((x) => [0.02, 1.75, 0.02, x, 0.9, 0.26, IM.black])], [2.4, 0.5], LOOT.locker, 1.8);
	for (const [x, z, h] of [[5.5, 9.2, 0.9], [8.2, 8.6, 1.3], [12.5, 9.4, 0.7], [-15, 8.6, 1.1]]) pallet(b, x, z, hash01('pp', x) * 0.6, h);
	for (const [x, z, r] of [[2.0, 9.6, 0.4], [3.2, 7.4, 2.2], [-12.5, 8.6, 1.4], [15.5, 7.2, -0.6]]) cart(batch, M, bctx.collide, x - 14, z - 45, r, hash01('ct', x) < 0.4);
	// зона паллет на востоке: штабели, часть — с товаром
	for (const [x, z, h, loot] of [[15, -3, 1.4], [18, -3, 1.0], [21, -3, 1.6], [15, 0.5, 1.2, LOOT.food], [18, 4, 1.5], [21, 4.2, 0.8], [15, 4.4, 1.0]]) pallet(b, x, z, 0, h, loot ?? null);
	return b.finish();
}

/**
 * Склад 28×22 м (центр — (24, −45)): ряды стеллажей с паллетами, погрузчик, конторка кладовщика; сзади — три дока
 * погрузочной рампы (две фуры подогнаны) и ворота, сбоку — ворота на восточный проезд; дверь в фудкорт галереи.
 */
function buildSklad(bctx) {
	const W = 28, D = 22, H = 7, t = 0.3, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Sklad', cx: 24, cz: -45, ry: 0, W, D, H, top: H + 0.6 });
	b.messKind = 'work';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 3), 0, 0.025, 0), M.concreteDark, { cast: false });
	b.wall('x', -hz, -hx + t / 2, hx + t / 2, { mat: M.tankWhite, t, doors: [11], w: 3.2, lining: M.concrete, side: 1, sx: 2 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.tankWhite, t, doors: [2], w: 3.6, lining: M.concrete, side: -1, sx: 2 });
	b.wall('x', hz, -hx + t / 2, hx + t / 2, { mat: IM.shopWall, t, doors: [10.5], w: 1.6, lining: M.concrete, side: -1 });
	// доки рампы: рольставни (средняя поднята — за ней темно), ворота поднятые
	for (const x of [-10, -4, 2]) {
		b.wallBox('front', x, 3.4, 1.0, 4.2, 0.12, IM.black, { t });
		b.wallBox('front', x, 3.0, x === -4 ? 3.6 : 1.12, 4.0, 0.16, M.roofTin, { t });
	}
	b.wallBox('front', 11, 3.4, 3.4, 3.9, 0.3, M.roofTin, { t });
	b.wallBox('right', 2, 3.8, 3.5, 4.0, 0.3, M.roofTin, { t });
	b.top_(place(box(W + 0.3, 0.3, D + 0.3, 3), 0, H + 0.15, 0), M.roofTar);
	b.parapet(H + 0.3, M.tankBlack, 0.4);
	b.top_(place(box(W + 0.4, 0.3, 0.1), 0, H - 0.2, hz + t / 2 + 0.05), M.yellow);
	for (const [x, z] of [[-6, 3], [6, -4]]) b.vent(x, z, H + 0.3, M.metalDark, { h: 0.9, r: 0.25 });
	b.top_(place(boxTop(3.0, 1.2, 2.0, 1), -1, H + 0.9, -6), M.silver);
	// конторка кладовщика (юго-западный угол)
	b.wall('x', 6, -hx + 0.15, -8, { mat: IM.whitewash, t: 0.15, doors: [-11], w: 1.2 });
	b.wall('z', -8, 6.075, hz - t / 2, { mat: IM.whitewash, t: 0.15 });
	desk(b, 'Стол кладовщика', -11, 9.9, Math.PI, { ammo919: [4, 10, 0.5], ammo762: [5, 15, 0.3], spore: 0.3 });
	chair(b, -11, 10.5, Math.PI);
	cabinet(b, -13.55, 8.0, Math.PI / 2, 1.0, LOOT.locker);
	// стеллажи с паллетами: три ряда по три секции, между секциями — проходы
	for (const [z, rowLoot] of [[-6.5, { [-4.4]: 0 }], [-2.0, { [2.2]: Math.PI }], [2.5, { [-11]: 0 }]]) {
		for (const x of [-11, -4.4, 2.2]) {
			const r = rowLoot[x];
			palletRack(b, x, z, r ?? 0, 5.0, r !== undefined ? LOOT.rack : null);
		}
	}
	forklift(b, 8.5, -4.5, 0.4);
	b.container('Ящики', 6.5, -9.2, 0, [[1.4, 0.8, 1.0, 0, 0.4, 0, IM.crate], [1.0, 0.6, 0.8, -0.1, 1.1, 0, IM.crate], [0.7, 0.5, 0.6, 0.2, 1.65, 0, IM.crateGreen]], [1.4, 1.0], LOOT.cargo, 1.9);
	for (const [x, z, h] of [[-12, -9.2, 1.3], [-9.5, -9.4, 0.9], [1.0, -9.3, 1.4], [11.5, 6.0, 1.2], [12.6, 4.4, 0.8], [7.5, 8.6, 1.4]]) pallet(b, x, z, hash01('sp', x) * 0.5, h);
	return b.finish();
}

// ---------- Постройки у дороги (в них заходят) ----------

/** Магазин АЗС 9×6,5 м: вход с севера (от колонок), стеллажи, прилавок, холодильник. */
function buildAzsShop(bctx, S, cx, cz) {
	const W = 9, D = 6.5, H = 3.2, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'AzsShop', cx, cz, ry: 0, W, D, H, top: H + 0.5 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [-2.5], w: 1.4, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.top_(place(box(W + 0.6, 0.35, 0.1), 0, H - 0.2, hz + t / 2 + 0.05), M.red);
	b.top_(new THREE.PlaneGeometry(3.6, 0.9).translate(0, H + 0.75, hz + 0.1), S.azs);
	b.top_(place(box(3.8, 1.0, 0.1), 0, H + 0.75, hz + 0.03), M.metalDark);
	for (const x of [-2.4, 2.0]) b.top_(new THREE.PlaneGeometry(2.6, 1.3).translate(x, 1.7, hz + t / 2 + 0.02), M.glass);
	b.top_(new THREE.PlaneGeometry(3.4, 1.3).rotateY(Math.PI).translate(1.6, 1.7, -hz - t / 2 - 0.02), M.glass);
	b.canopy('front', -2.5, { w: 2.2, d: 1.0, y: 2.5, mat: M.red, t });
	b.lower(place(box(1.8, 0.16, 0.9), -2.5, 0.08, -hz - 0.55), M.concrete);
	counter(b, 'Прилавок', 3.2, -1.0, -Math.PI / 2, 2.4, LOOT.cash);
	shelf(b, -2.0, 2.85, Math.PI, 'food', LOOT.food);
	shelf(b, 1.0, 2.85, Math.PI, 'drink');
	fridge(b, -4.0, 0.5, Math.PI / 2, LOOT.fridge);
	b.furniture(-0.4, -0.6, 0, [[1.6, 1.2, 0.7, 0, 0.6, 0, IM.furnitureLight], [1.4, 0.2, 0.5, 0, 1.3, 0, IM.cans]], { solid: [1.6, 0.7] });
	return b.finish();
}

/** Автомойка 14×8 м: два бокса с воротами к проспекту (в одном — машина), каморка администратора. */
function buildMoyka(bctx, S, cx, cz, color) {
	const W = 14, D = 8, H = 4.0, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Moyka', cx, cz, ry: 0, W, D, H, top: H + 1.0 });
	b.messKind = 'work';
	const { M, batch, root, collide } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concrete, { cast: false });
	b.wall('x', -hz, -hx - t / 2, 2.5, { mat: M.whiteBrick, t, doors: [-4.75, 0], w: 3.4, lining: IM.whitewash, side: 1 });
	b.wall('x', -hz, 2.5, hx + t / 2, { mat: M.whiteBrick, t, doors: [4.75], w: 1.0, lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.wall('z', 2.5, -hz + t / 2, hz - t / 2, { mat: IM.whitewash, t: 0.15 });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTin);
	for (const z of [hz + 0.15, -hz - 0.15]) {
		const s = z > 0 ? 1 : -1;
		b.top_(place(box(5.2, 1.1, 0.12), -1.5, H + 0.75, z), M.metalDark);
		b.top_(new THREE.PlaneGeometry(5.0, 0.95).rotateY(s > 0 ? 0 : Math.PI).translate(-1.5, H + 0.75, z + s * 0.07), S.moyka);
	}
	for (const x of [-4.75, 0]) b.wallBox('front', x, 3.6, 2.15, 2.6, 0.35, M.roofTin, { t });
	addCar(batch, M, root, cx - 4.75, cz + 0.2, Math.PI / 2, color);
	collide(cx - 4.75, cz + 0.2, 4.3, 1.8, Math.PI / 2);
	b.solids.push([-4.75, 0.2, 1.8, 4.3, 0]);
	shelf(b, 0, 3.55, Math.PI, 'tools', LOOT.tools, 'Стеллаж с химией');
	b.furniture(-1.8, 3.4, Math.PI, [[0.7, 1.0, 0.5, 0, 0.5, 0, IM.machine], [0.3, 0.3, 0.3, 0, 1.15, 0, IM.black]], { solid: [0.7, 0.5] }); // мойка высокого давления
	desk(b, 'Стол администратора', 4.75, 2.6, Math.PI, LOOT.desk);
	chair(b, 4.75, 3.3, Math.PI);
	cabinet(b, 6.6, -1.4, -Math.PI / 2, 1.0, null);
	return b.finish();
}

/** Бургерная 12×9 м: вход с востока (с проезда), зал со столиками, стойка с кассой, кухня за ней. */
function buildBurger(bctx, S, cx, cz) {
	const W = 12, D = 9, H = 3.3, t = 0.25, hx = W / 2, hz = D / 2;
	const b = new Building(bctx, { name: 'Burger', cx, cz, ry: -Math.PI / 2, W, D, H, top: H + 0.6 });
	b.messKind = 'shop';
	const { M } = bctx, IM = b.IM;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, doors: [-3], w: 1.6, lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.brick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.brick, t, lining: IM.shopWall, side: -1 });
	b.top_(place(box(W + 0.5, 0.25, D + 0.5, 3), 0, H + 0.12, 0), M.roofTar);
	b.parapet(H + 0.25, M.yellow, 0.4);
	for (const z of [-2.6, 2.6]) b.top_(b.onWall(new THREE.PlaneGeometry(3.0, 1.2).translate(0, 1.7, 0.02), 'right', z, t), M.glass);
	for (const x of [0.5, 4.0]) b.top_(b.onWall(new THREE.PlaneGeometry(2.4, 1.2).translate(0, 1.7, 0.02), 'front', x, t), M.glass);
	b.top_(b.onWall(new THREE.PlaneGeometry(4.6, 0.9).translate(0, H - 0.55, 0.03), 'right', 0, t), S.burger);
	b.top_(b.onWall(new THREE.PlaneGeometry(4.6, 0.9).translate(0, H - 0.55, 0.03), 'front', 2.2, t), S.burger);
	b.canopy('front', -3, { w: 2.4, d: 1.1, y: 2.5, mat: M.yellow, t });
	counter(b, 'Прилавок', 1.5, 0.3, Math.PI, 5.0, LOOT.cash);
	b.furniture(3.6, 3.95, Math.PI, [[2.4, 0.9, 0.7, 0, 0.45, 0, IM.metal], [1.0, 0.1, 0.6, -0.5, 0.95, 0, IM.black], [0.8, 0.5, 0.6, 0.7, 1.15, 0, IM.metal]], { solid: [2.4, 0.7] }); // плита и фритюр
	shelf(b, 0.4, 4.1, Math.PI, 'food');
	fridge(b, 5.4, 2.4, -Math.PI / 2, LOOT.fridge);
	for (const z of [-2.0, 2.2]) {
		table(b, -4.3, z, 0, { w: 1.1, d: 0.75 });
		chair(b, -4.3, z - 0.75, 0);
		chair(b, -4.3, z + 0.75, Math.PI);
	}
	return b.finish();
}

// ---------- Предметы улицы (в мировых координатах) ----------

/** Тележка из супермаркета; tipped — лежит на боку; collide = null — без коллайдера (стоят в ряд). */
function cart(batch, M, collide, x, z, ry, tipped = false) {
	const m = at(x, tipped ? 0.3 : 0, z, ry, 0, tipped ? Math.PI / 2 : 0);
	const add = (w, h, d, px, py, pz, mat) => batch.add(box(w, h, d).translate(px, py, pz).applyMatrix4(m), mat);
	add(0.56, 0.42, 0.84, 0, 0.8, 0.06, M.silver); // корзина
	add(0.6, 0.05, 0.05, 0, 1.06, -0.42, M.red); // ручка
	add(0.46, 0.04, 0.7, 0, 0.16, 0.02, M.metalDark); // рама с колёсами
	for (const s of [-1, 1]) add(0.04, 0.62, 0.04, s * 0.2, 0.48, -0.36, M.metalDark);
	if (!collide) return;
	const [cx, cz] = tipped ? loc(x, z, ry, -0.55) : [x, z];
	collide(cx, cz, tipped ? 1.0 : 0.62, 0.9, ry);
}

/** Фура: кабина спереди (локальная +X), длинный фургон; open — задние двери распахнуты. */
function semiTruck(batch, M, collide, x, z, ry, { cab = M.red, open = false } = {}) {
	const m = at(x, 0, z, ry), add = (g, mat) => batch.add(g.applyMatrix4(m), mat);
	add(box(11, 2.7, 2.5, 2).translate(-1.3, 2.65, 0), M.tankWhite);
	add(box(10.6, 0.3, 1.1).translate(-1.3, 1.15, 0), M.metalDark);
	add(box(2.3, 2.4, 2.45, 1.5).translate(5.5, 1.85, 0), cab);
	add(box(0.06, 0.95, 2.1).translate(6.67, 2.4, 0), M.glass);
	add(box(2.4, 0.45, 2.4).translate(5.5, 0.7, 0), M.metalDark);
	for (const wx of [-5.6, -4.5, 3.8, 5.6]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.5, 0.5, 0.32, 14).rotateX(Math.PI / 2).translate(wx, 0.5, s * 1.05), M.tire);
	if (open) {
		add(box(0.04, 2.5, 2.4).translate(-6.81, 2.65, 0), M.tankBlack); // темнота в кузове
		for (const s of [-1, 1]) add(box(1.2, 2.5, 0.05).translate(-7.4, 2.65, s * 1.3), M.tankWhite);
	}
	const [cx, cz] = loc(x, z, ry, -0.05);
	collide(cx, cz, 13.5, 2.6, ry);
}

/** Бензовоз: цистерна и кабина (перед — локальная +X). */
function tanker(batch, M, collide, x, z, ry) {
	const m = at(x, 0, z, ry), add = (g, mat) => batch.add(g.applyMatrix4(m), mat);
	add(new THREE.CylinderGeometry(1.15, 1.15, 7.4, 16).rotateZ(Math.PI / 2).translate(-1.4, 2.25, 0), M.silver);
	add(box(7.6, 0.3, 1.1).translate(-1.4, 0.95, 0), M.metalDark);
	add(box(7.0, 0.12, 0.6).translate(-1.4, 3.43, 0), M.metalDark);
	add(box(2.2, 2.3, 2.4, 1.5).translate(3.6, 1.75, 0), M.red);
	add(box(0.06, 0.9, 2.1).translate(4.72, 2.3, 0), M.glass);
	for (const wx of [-4.2, -3.1, 3.4]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 14).rotateX(Math.PI / 2).translate(wx, 0.48, s * 1.02), M.tire);
	const [cx, cz] = loc(x, z, ry, -0.2);
	collide(cx, cz, 9.9, 2.5, ry);
}

/** Островок колонок АЗС: бордюр, две колонки. */
function pumpIsland(batch, M, collide, x, z) {
	batch.add(place(box(1.4, 0.18, 6, 2), x, 0.09, z), M.concrete);
	for (const dz of [-1.5, 1.5]) {
		batch.add(place(box(0.8, 1.6, 0.5), x, 0.98, z + dz), M.white);
		batch.add(place(box(0.84, 0.28, 0.54), x, 1.92, z + dz), M.red);
		for (const s of [-1, 1]) batch.add(place(box(0.5, 0.35, 0.02), x, 1.4, z + dz + s * 0.26), M.glass);
	}
	collide(x, z, 1.5, 6.1);
}

/** Ларёк-тайник у остановки: обыскивают через выбитое окно. */
function kiosk(holder, M, x, z, paint, sign, loot) {
	piece(holder, 'Ларёк', x, z, 0, [
		[2.8, 2.4, 2.2, 0, 1.2, 0, paint], [3.2, 0.12, 2.6, 0, 2.46, 0.1, M.metalDark],
		[2.0, 0.9, 0.04, 0, 1.45, 1.11, M.glass], [2.2, 0.06, 0.3, 0, 0.98, 1.2, M.metalDark],
		[2.4, 0.5, 0.04, 0, 2.15, 1.12, sign],
	], [2.8, 2.2], loot, 2.6);
}

/** Ограждение парковки: столбики с жёлтой полосой. */
function bollard(batch, M, collide, x, z) {
	batch.add(place(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), x, 0.4, z), M.tankBlack);
	batch.add(place(new THREE.CylinderGeometry(0.125, 0.125, 0.12, 8), x, 0.62, z), M.yellow);
	collide(x, z, 0.3, 0.3);
}

export default {
	id: 'tc',
	seed: 7404,
	half: 90,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		const mark = markingMaterial();
		const sign = (text, bg, fg, w = 512, h = 96) => T.signMaterial(text, { bg, fg, w, h });
		const S = {
			ulei: sign('ТЦ «УЛЕЙ»', '#141414', '#f0c020', 768, 80),
			stela: sign('УЛЕЙ', '#f0c020', '#141414', 384, 160),
			hyper: sign('ГИПЕРМАРКЕТ', '#1d5a2c', '#f4f0e0', 768, 72),
			odezhda: sign('ОДЕЖДА', '#ece6dc', '#6a2a5a'),
			obuv: sign('ОБУВЬ', '#2a2a2e', '#e8dcae'),
			apteka: sign('АПТЕКА', '#e6efe4', '#1d7a3a'),
			tech: sign('ЭЛЕКТРОНИКА', '#1e3a7a', '#f0f0f0'),
			svyaz: sign('СВЯЗЬ', '#e8c020', '#1a1a1a'),
			ohota: sign('ОХОТА И РЫБАЛКА', '#3a4a2a', '#e8e0c0'),
			fudkort: sign('ФУДКОРТ', '#c8401e', '#f8e8a0'),
			azs: sign('АЗС', '#c01e1e', '#f4f4f0', 256, 72),
			moyka: sign('АВТОМОЙКА', '#1d4f9c', '#f4f4f0'),
			burger: sign('БУРГЕРЫ', '#c8401e', '#f8e8a0'),
			tabak: sign('ТАБАК', '#2a3a5a', '#f0e8d0', 256, 56),
			pressa: sign('ПРЕССА', '#e8e4d8', '#b02218', 256, 56),
			cvety: sign('ЦВЕТЫ', '#3a6a3a', '#f4f0e0', 256, 56),
		};

		// ---------- Дороги, тротуары, парковка, площади ----------
		ground(180, 14, 0, 60, M.asphalt, 5, 0.02); // проспект (z 53…67)
		ground(180, 0.15, 0, 60, mark, 6, 0.026);
		for (const z of [56.5, 63.5]) ground(180, 0.12, 0, z, mark, 6, 0.025);
		ground(180, 2.6, 0, 51.7, M.concrete, 3, 0.014); // тротуары
		ground(180, 2.6, 0, 68.3, M.concrete, 3, 0.014);
		ground(10, 20.4, 0, 79.8, M.asphalt, 5, 0.021); // на юг, к Подстанции
		ground(20.4, 0.15, 0, 79.8, mark, 6, 0.026, Math.PI / 2);
		ground(116, 46, 0, 21, M.asphalt, 5, 0.019); // парковка (x −58…58, z −2…44)
		for (const x of [-30, 30]) ground(9, 9.4, x, 48.7, M.asphalt, 5, 0.022); // въезды с проспекта
		ground(86, 10, 0, -7, M.concrete, 3, 0.016); // площадь перед входом (z −12…−2)
		for (const x of [-48, 48]) ground(10, 125, x, -9.5, M.asphalt, 5, 0.02); // боковые проезды (z −72…53)
		ground(106, 16, 0, -64, M.asphalt, 5, 0.021); // хоздвор за ТЦ
		ground(10, 18.5, 0, -81.2, M.asphalt, 5, 0.022); // на север, к НИИ
		ground(18.5, 0.15, 0, -81.2, mark, 6, 0.026, Math.PI / 2);
		for (const s of [-1, 1]) ground(5.5, 3.2, s * 40.6, -23.5, M.concrete, 3, 0.018); // дорожки к боковым входам
		ground(5.5, 2.4, -40.6, -38, M.concrete, 3, 0.018); // к пожарному выходу гипермаркета
		ground(32, 16.4, 37, 78.3, M.concrete, 3, 0.017); // АЗС
		ground(16, 6, -36, 72.6, M.asphalt, 5, 0.022); // площадка автомойки
		ground(11, 14, -58.5, 22, M.asphalt, 5, 0.022); // стоянка бургерной
		ground(26, 20, 70, -10, M.dirt, 4, 0.015); // садовый центр
		// бордюр парковки со стороны газона; столбики перед площадью
		for (const [x0, x1] of [[-58, -34.5], [-25.5, 25.5], [34.5, 58]]) batch.add(place(box(x1 - x0, 0.14, 0.24, 2), (x0 + x1) / 2, 0.07, 44.1), M.concrete, { cast: false });
		for (let x = -41.6; x <= 41.7; x += 3.2) if (Math.abs(x) > 5) bollard(batch, M, collide, x, -2.4);
		// разметка: места (по 2,6 м), ось сдвоенных рядов, «зебры» через проезды по пешеходной оси
		const stalls = [];
		const rows = [[5, 15, true], [22, 32, true], [39, 44, false]];
		for (const [z0, z1, dbl] of rows) {
			const blocks = dbl ? [[-56, -31], [-29, -4], [4, 29], [31, 56]] : [[-56, -34.5], [-25.5, -4], [4, 25.5], [34.5, 56]];
			for (const [x0, x1] of blocks) {
				const n = Math.floor((x1 - x0) / 2.6), off = x0 + ((x1 - x0) - n * 2.6) / 2;
				for (let i = 0; i <= n; i++) batch.add(place(planeXZ(0.12, z1 - z0), off + i * 2.6, 0.03, (z0 + z1) / 2), M.white, { cast: false });
				if (dbl) batch.add(place(planeXZ(x1 - x0, 0.12), (x0 + x1) / 2, 0.03, (z0 + z1) / 2), M.white, { cast: false });
				for (let i = 0; i < n; i++) {
					const x = off + (i + 0.5) * 2.6;
					if (dbl) { stalls.push([x, z0 + 2.5, Math.PI / 2], [x, z1 - 2.5, -Math.PI / 2]); } else stalls.push([x, z0 + 2.5, -Math.PI / 2]);
				}
			}
		}
		for (const [z0, z1] of [[-2, 5], [15, 22], [32, 39]]) for (let z = z0 + 0.7; z < z1 - 0.4; z += 1.0) batch.add(place(planeXZ(5, 0.5), 0, 0.031, z), M.white, { cast: false });
		for (let z = 53.8; z < 66.6; z += 1.0) batch.add(place(planeXZ(4, 0.5), 0, 0.031, z), M.white, { cast: false }); // «зебра» через проспект
		// островки газона с бордюром: посередине (пешеходная ось), у въездов и по краям рядов
		const islands = [];
		for (const [z0, z1] of [[5, 15], [22, 32]]) for (const [x0, x1] of [[-4, 4], [-31, -29], [29, 31], [-58, -56], [56, 58]]) islands.push([x0, x1, z0, z1]);
		for (const [x0, x1, z0, z1] of islands) {
			const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
			batch.add(place(planeXZ(w - 0.3, d - 0.3, 2), cx, 0.06, cz), M.grass, { cast: false });
			for (const s of [-1, 1]) {
				batch.add(place(box(w, 0.15, 0.15, 2), cx, 0.075, cz + s * (d / 2 - 0.075)), M.concrete);
				batch.add(place(box(0.15, 0.15, d - 0.3, 2), cx + s * (w / 2 - 0.075), 0.075, cz), M.concrete);
			}
			if (w < 3) streetLamp(batch, M, collide, cx, cz + 1.65);
		}
		for (const z of [8.2, 25.2]) for (const s of [-1, 1]) streetLamp(batch, M, collide, s * 2.6, z + 2.4);
		for (const x of [-80, -55, -30, 12, 60, 82]) streetLamp(batch, M, collide, x, 69.2);
		for (const x of [-30.5, 30.5]) streetLamp(batch, M, collide, x, -3.6);
		for (const [x, z, r] of [[-1.5, 7.2, Math.PI / 2], [1.5, 12.8, -Math.PI / 2], [-1.5, 24.2, Math.PI / 2]]) bench(batch, M, x, z, r);

		const roads = [
			[-90, 90, 50.4, 69.6], [-5, 5, 69.6, 90], [-58, 58, -2, 44], [-34.5, -25.5, 44, 53], [25.5, 34.5, 44, 53],
			[-43, 43, -12, -2], [-53, -43, -72, 53], [43, 53, -72, 53], [-53, 53, -72, -56], [-5, 5, -90, -72],
			[21, 53, 70, 86.5], [-44, -28, 69.6, 75.6], [-64, -53, 15, 29], [-43.4, -37.8, -25.2, -21.8], [37.8, 43.4, -25.2, -21.8], [57, 83, -20, 0], [38, 43, -45, -41],
		];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m)
			&& !islands.some(([x0, x1, z0, z1]) => x > x0 + 0.4 && x < x1 - 0.4 && z > z0 + 0.4 && z < z1 - 0.4);

		// ---------- Торговый центр «Улей» ----------
		const holder = new Building(bctx, { name: 'Ulica', cx: 0, cz: 0, ry: 0, W: 0, D: 0, H: 0, top: 0 }); // тайники на улице
		holder.messKind = null;
		buildings.push(buildGallery(bctx, S), buildHyper(bctx, S), buildSklad(bctx));
		// погрузочная рампа склада: платформа, отбойники, пандус; две фуры подогнаны к докам, третья — с открытым кузовом
		batch.add(place(box(17, 1.1, 2.6, 2), 19.5, 0.55, -57.45), M.concrete);
		for (const x of [14, 20, 26]) for (const s of [-1, 1]) batch.add(place(box(0.25, 0.4, 0.16), x + s * 1.3, 0.75, -58.8), M.tire);
		batch.add(place(box(4.7, 0.2, 2.6, 2), 30.25, 0.5, -57.45, 0, 0, -0.24), M.concrete);
		collide(21.75, -57.45, 21.5, 2.6);
		semiTruck(batch, M, collide, 14, -65.6, Math.PI / 2);
		semiTruck(batch, M, collide, 26, -65.8, Math.PI / 2 + 0.03, { cab: M.woodBlue });
		semiTruck(batch, M, collide, -22, -64.2, 0.04, { cab: M.green, open: true });
		{
			const [x, z] = loc(-22, -64.2, 0.04, -6.65);
			holder.container('Кузов фуры', x, z, 0.04 - Math.PI / 2, [[0.9, 0.8, 0.8, -0.5, 1.7, -0.6, M.sandbag], [0.8, 0.7, 0.7, 0.5, 1.65, -0.9, M.sandbag], [1.6, 0.3, 0.06, 0, 0.75, 0.1, M.metalDark]], [2.2, 0.3], LOOT.cargo, 2.6);
		}
		// хоздвор: мусорные контейнеры, пресс, поддоны, шины, ворота склада
		for (let i = 0; i < 4; i++) {
			const x = -32 + i * 1.5;
			beginProp('dumpster', x, -57.4, 0);
			batch.add(place(box(1.3, 1.15, 1.0, 1), x, 0.58, -57.4, hash01('dm', i) * 0.2 - 0.1), i % 2 ? M.green : M.metalOlive);
			endProp();
		}
		collide(-29.75, -57.4, 6.3, 1.2);
		batch.add(place(box(2.4, 2.0, 4.2, 1.5), -8, 1.0, -59, 0), M.woodBlue); // мусорный пресс
		collide(-8, -59, 2.4, 4.2);
		for (const [x, z] of [[-14, -58], [-13, -59.6], [4, -58.4], [36, -59.5], [37.6, -60.4]]) {
			beginProp('crate', x, z, 0);
			for (let k = 0; k < 4; k++) batch.add(place(box(1.2, 0.14, 1.0), x, 0.07 + k * 0.15, z, hash01('pl', x, k) * 0.3), M.wood);
			endProp();
			collide(x, z, 1.3, 1.1);
		}
		ground(4, 4, 35, -58, M.concrete, 3, 0.024); // площадки у ворот склада
		ground(5, 4, 40.5, -43, M.concrete, 3, 0.024);
		for (const [x, z] of [[-14, -66], [-40, -60], [40, -66]]) {
			beginProp('tire', x, z, 0);
			for (let k = 0; k < 3; k++) batch.add(place(new THREE.TorusGeometry(0.34, 0.13, 8, 14), x + k * 0.1, 0.13 + k * 0.26, z, 0, Math.PI / 2), M.tire);
			endProp();
			collide(x, z, 0.9, 0.9);
		}
		// площадь перед входом: баррикада из мешков, кадки, урны, загон для тележек
		sandbags(batch, M, collide, -4.4, -6.6, 3.2, 0);
		sandbags(batch, M, collide, 4.4, -6.6, 3.2, 0);
		for (const [x, z] of [[-14, -9.5], [14, -9.5], [-26, -9.5], [26, -9.5]]) {
			batch.add(place(box(1.6, 0.6, 1.6, 1), x, 0.3, z), M.concrete);
			batch.add(place(new THREE.IcosahedronGeometry(0.6, 1).scale(1, 0.75, 1), x, 0.85, z), M.leavesDry);
			collide(x, z, 1.6, 1.6);
		}
		for (const [x, z, r] of [[-10, -9.6, 0], [10, -9.6, 0], [-34, -8.5, 0], [34, -8.5, 0]]) bench(batch, M, x, z, r);
		{
			const x = -20, z = -4.4; // загон для тележек под навесом
			batch.add(place(box(6.4, 0.1, 2.6, 2), x, 2.2, z), M.tankBlack);
			for (const dx of [-3, 3]) for (const dz of [-1.1, 1.1]) batch.add(place(box(0.08, 2.2, 0.08), x + dx, 1.1, z + dz), M.metalDark);
			batch.add(place(box(6.2, 0.05, 0.05), x, 0.9, z - 1.1), M.metalDark);
			for (let i = 0; i < 9; i++) cart(batch, M, null, x - 2.6 + i * 0.36, z + 0.45, Math.PI / 2);
			collide(x, z, 6.4, 2.4);
		}
		for (const [x, z] of [[18.5, -4.2], [-41, -10]]) {
			batch.add(place(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 10), x, 0.42, z), M.metalDark);
			collide(x, z, 0.6, 0.6);
		}

		// ---------- Стела «УЛЕЙ» у пешеходной оси ----------
		{
			const x = -9.5, z = 47.4;
			occluder('Stela', (kb) => {
				kb.add(place(box(3.4, 0.6, 1.4, 2), x, 0.3, z), M.concrete);
				kb.add(place(boxTop(2.6, 9, 0.9, 2), x, 5.1, z), M.tankBlack);
				for (const y of [9.6, 6.1, 3.0]) kb.add(place(boxTop(2.7, 0.22, 0.95, 1), x, y, z), M.yellow);
				kb.add(place(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 6).rotateX(Math.PI / 2), x, 8.4, z + 0.5), M.yellow);
				kb.add(place(new THREE.CylinderGeometry(0.5, 0.5, 0.17, 6).rotateX(Math.PI / 2), x, 8.4, z + 0.51), M.tankBlack);
				kb.add(new THREE.PlaneGeometry(2.4, 1.0).translate(x, 7.0, z + 0.47), S.stela);
				kb.add(new THREE.PlaneGeometry(2.3, 0.62).translate(x, 5.35, z + 0.47), S.hyper);
				kb.add(new THREE.PlaneGeometry(2.3, 0.5).translate(x, 4.55, z + 0.47), S.apteka);
				kb.add(new THREE.PlaneGeometry(2.3, 0.5).translate(x, 3.75, z + 0.47), S.fudkort);
			}, { cx: x, cz: z, ry: 0, hx: 1.8, hz: 0.8, top: 10 }, 0.25);
			collide(x, z, 3.4, 1.4);
		}
		billboard(batch, M, root, collide, -47, 47.6, 0, 'ТЦ «УЛЕЙ» — ВСЁ В ОДНОМ МЕСТЕ', { w: 7, h: 2.2, y: 3.6, bg: '#f0c020', fg: '#141414' });
		billboard(batch, M, root, collide, 47, 47.6, 0, 'ГИПЕРМАРКЕТ 24 ЧАСА', { w: 7, h: 2.2, y: 3.6, bg: '#1d5a2c', fg: '#f4f0e0' });

		// ---------- Остановка и ларьки на проспекте ----------
		{
			const x = 21, z = 51.6;
			batch.add(place(box(5, 2.2, 0.08, 1), x, 1.1, z - 0.7), M.glass);
			batch.add(place(box(5.4, 0.14, 1.8, 1), x, 2.4, z), M.tankBlack);
			for (const dx of [-2.45, 2.45]) batch.add(place(box(0.08, 2.3, 1.5, 1), x + dx, 1.15, z - 0.05), M.glass);
			batch.add(place(box(4, 0.08, 0.45), x, 0.5, z - 0.35), M.wood);
			collide(x, z - 0.3, 5.2, 1.0);
			bus(batch, M, root, 23, 55.8, Math.PI / 2 + 0.03);
			collide(23, 55.8, 2.6, 8.4, Math.PI / 2 + 0.03);
		}
		kiosk(holder, M, 6.5, 47.6, M.woodBlue, S.tabak, LOOT.kiosk);
		kiosk(holder, M, 10.0, 47.6, M.white, S.pressa, null); // пустой — без тайника
		kiosk(holder, M, 13.5, 47.6, M.woodGreen, S.cvety, LOOT.kiosk);

		// ---------- За проспектом: АЗС с магазином, автомойка ----------
		occluder('AzsCanopy', (kb) => {
			kb.add(place(boxTop(18, 0.7, 10, 2), 33, 5.35, 77.5), M.white);
			kb.add(place(boxTop(18.2, 0.45, 10.2, 2), 33, 4.85, 77.5), M.red);
			for (const dx of [-6, 6]) for (const dz of [-3, 3]) kb.add(place(boxTop(0.5, 4.7, 0.5, 1), 33 + dx, 2.35, 77.5 + dz), M.white);
			kb.add(new THREE.PlaneGeometry(3.6, 0.8).translate(33, 5.3, 82.62), S.azs);
		}, { cx: 33, cz: 77.5, ry: 0, hx: 9.2, hz: 5.2, top: 5.8 }, 0.18);
		for (const dx of [-6, 6]) for (const dz of [-3, 3]) collide(33 + dx, 77.5 + dz, 0.55, 0.55);
		pumpIsland(batch, M, collide, 28.5, 77.5);
		pumpIsland(batch, M, collide, 37.5, 77.5);
		buildings.push(buildAzsShop(bctx, S, 47.5, 79.5));
		batch.add(place(box(1.6, 5.2, 0.5, 1), 23, 2.6, 70.9), M.red);
		{
			const g = new THREE.PlaneGeometry(1.4, 0.6).translate(23, 4.4, 71.17);
			batch.add(g, S.azs, { cast: false });
		}
		collide(23, 70.9, 1.7, 0.6);
		tanker(batch, M, collide, 24.0, 80.5, Math.PI / 2);
		const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
		car(31.4, 76.8, Math.PI / 2 + 0.05, 0x8a8a7a);
		car(35.0, 78.6, -Math.PI / 2 + 0.1, 0x2a2826, { burned: true });
		buildings.push(buildMoyka(bctx, S, -36, 79.5, 0x5a6a7a));
		for (const [x, z] of [[-30.5, 73.5], [-41.5, 74]]) {
			batch.add(place(new THREE.CylinderGeometry(0.25, 0.25, 0.9, 10), x, 0.45, z), M.woodBlue);
			collide(x, z, 0.55, 0.55);
		}

		// ---------- По сторонам: бургерная с востока от западного проезда, садовый центр, контейнеры, подстанция ----------
		buildings.push(buildBurger(bctx, S, -69, 22));
		batch.add(place(box(0.25, 2.4, 1.8), -60.5, 1.2, 14.5), M.tankBlack); // меню для автокафе
		collide(-60.5, 14.5, 0.4, 1.9);
		car(-58.5, 18.2, Math.PI + 0.05, 0x3a5a3a);
		car(-58.0, 26.4, 0.1, 0x7b5a3a, { crashed: true });
		// садовый центр: забор, теплицы, мешки с землёй, будка-касса
		fencePlotGarden(batch, M, collide, 70, -10);
		greenhouse(batch, M, collide, 64, -13, 9, 3.6, 0);
		greenhouse(batch, M, collide, 70, -13, 9, 3.6, 0);
		for (const [x, z] of [[76.5, -16], [78.5, -16], [76.5, -13.5]]) {
			beginProp('sandbags', x, z, 0);
			for (let k = 0; k < 6; k++) batch.add(place(new THREE.SphereGeometry(0.32, 8, 6).scale(1.1, 0.4, 0.7), x + (k % 2) * 0.55 - 0.27, 0.16 + Math.floor(k / 2) * 0.24, z), M.sandbag);
			endProp();
			collide(x, z, 1.4, 0.9);
		}
		holder.container('Касса садового центра', 78, -5.2, -Math.PI / 2, [
			[2.2, 2.3, 1.8, 0, 1.15, -0.2, M.woodGreen], [2.6, 0.1, 2.4, 0, 2.4, 0, M.roofGreen], [1.4, 0.8, 0.04, 0, 1.4, 0.71, M.glass], [1.6, 0.06, 0.3, 0, 0.95, 0.8, M.wood],
		], [2.2, 1.8], { spore: [1, 4, 0.55], zhivchik: 0.2, ammo919: [3, 6, 0.25] }, 2.5);
		for (const [x, z, paint] of [[-68, -44, M.metalRust], [-68, -47, M.metalOlive], [-64, -54, M.woodBlue]]) {
			batch.add(place(box(6.1, 2.6, 2.45, 2), x, 1.3, z, x === -64 ? 0.4 : 0), paint);
			collide(x, z, 6.2, 2.5, x === -64 ? 0.4 : 0);
		}
		batch.add(place(box(6.1, 2.6, 2.45, 2), -68, 3.9, -45.5, 0.08), M.green);
		transformer(batch, root, M, collide, -62, -14);
		transformer(batch, root, M, collide, 62, -62);
		billboard(batch, M, root, collide, -64, 4, 0, 'ДОСТАВКА ПРОДУКТОВ 24/7', { w: 6, h: 2, y: 3.4, bg: '#e8e4d8', fg: '#b02218' });
		buildings.push(buildCheckpoint(bctx, { name: 'KPP', cx: 10.5, cz: -76, ry: 0 }));
		barrier(batch, M, collide, 5.8, -72.6, Math.PI, 10, true);

		// ---------- Машины на парковке и улице, тележки ----------
		const palette = [0x8a8a7a, 0x5a6a7a, 0x7b5a3a, 0x8a2e24, 0x3a5a3a];
		const burnt = [];
		for (const [x, z, ry] of stalls) {
			if (rnd() > 0.15) continue;
			const k = rnd(), opts = k < 0.07 ? { burned: true } : k < 0.15 ? { crashed: true } : {};
			const color = opts.burned ? 0x2a2826 : palette[Math.floor(rnd() * palette.length)];
			const cx = x + R(-0.25, 0.25), cz = z + R(-0.3, 0.3), cr = ry + R(-0.08, 0.08);
			car(cx, cz, cr, color, opts);
			if (opts.burned) burnt.push([cx, cz]);
		}
		// брошены как попало: в проездах, поперёк мест, одна врезалась в столбики
		car(-20, 18.5, 0.25, 0x5a6a7a);
		car(16, 35, -0.4, 0x8a2e24, { crashed: true });
		car(41, 1.5, 0.15, 0x8a8a7a);
		car(-45, 36.5, Math.PI + 0.3, 0x2a2826, { burned: true });
		car(7.5, -0.4, Math.PI / 2 + 0.6, 0x3a5a3a, { crashed: true });
		car(-14, 58, 0.08, 0x5a6a7a);
		car(-38, 62.8, Math.PI - 0.1, 0x8a8a7a, { crashed: true });
		car(52, 57.2, 0.4, 0x2a2826, { burned: true });
		car(66, 63, Math.PI + 0.05, 0x7b5a3a);
		car(-47.8, -30, Math.PI / 2 + 0.1, 0x5a6a7a);
		car(48.2, 20, -Math.PI / 2, 0x8a2e24, { crashed: true });
		for (let i = 0; i < 18; i++) {
			const x = R(-54, 54), z = rnd() < 0.3 ? R(-1.5, 4) : R(15.5, 21.5) + (rnd() < 0.5 ? 17 : 0);
			cart(batch, M, collide, x, z, R(0, 6.28), rnd() < 0.3);
		}

		holder.finish();
		buildings.push(holder);
		const firstBurnt = burnt[0] ?? [-45, 36.5];
		return {
			start: [0, 82.5, Math.PI],
			exits: [
				{ to: 'nii', x0: -4, x1: 4, z0: -90, z1: -85.2, spawn: [0, -82.5, 0], sign: [6.5, -84, '↑ НИИ'] },
				{ to: 'voench', x0: -90, x1: -85.2, z0: 55, z1: 65, spawn: [-82.5, 60, Math.PI / 2], sign: [-84, 51.6, '← В/ч'] },
				{ to: 'mikro', x0: 85.2, x1: 90, z0: 55, z1: 65, spawn: [82.5, 60, -Math.PI / 2], sign: [84, 68.4, 'Микрорайон →'] },
				{ to: 'podstanciya', x0: -4, x1: 4, z0: 85.2, z1: 90, spawn: [0, 82.5, Math.PI], sign: [6.5, 84, '↓ Подстанция'] },
			],
			// логово руберов: в галерее, гипермаркете и на складе — руберы и топтуны; стаи бегунов — на парковке, площади,
			// проспекте, на АЗС, у бургерной, в садовом центре и на хоздворе
			groups: [
				{ at: [-24, -24], r: 6, runners: 3, stompers: 1 }, // галерея: запад
				{ at: [22, -27], r: 6, runners: 3, rubers: 1 }, // фудкорт
				{ at: [0, -17], r: 4, runners: 2 }, // вестибюль у фонтана
				{ at: [-31, -16], r: 3, runners: 2 }, // одежда
				{ at: [32, -16], r: 3, runners: 1, stompers: 1 }, // «Охота и рыбалка»
				{ at: [-14, -47.5], r: 6, runners: 3, rubers: 1 }, // гипермаркет: стеллажи
				{ at: [-31, -40], r: 4, runners: 2, stompers: 1 }, // гипермаркет: отделы
				{ at: [5, -42], r: 4, runners: 2, stompers: 1 }, // гипермаркет: паллеты
				{ at: [26, -47], r: 5, runners: 2, rubers: 1 }, // склад
				{ at: [-38, 10], r: 7, runners: 3 },
				{ at: [-16, 26], r: 7, runners: 3 },
				{ at: [18, 8], r: 6, runners: 2, stompers: 1 },
				{ at: [40, 30], r: 7, runners: 3 },
				{ at: [2, 37], r: 6, runners: 2 },
				{ at: [-46, 40], r: 5, runners: 2 },
				{ at: [-20, -6], r: 5, runners: 3 },
				{ at: [22, -6], r: 5, runners: 2 },
				{ at: [-62, 60], r: 7, runners: 2 },
				{ at: [56, 60], r: 7, runners: 2, stompers: 1 },
				{ at: [4, 60], r: 6, runners: 2 },
				{ at: [36, 76], r: 6, runners: 2, stompers: 1 },
				{ at: [-36, 73], r: 5, runners: 2 },
				{ at: [-62, 20], r: 6, runners: 2 },
				{ at: [-70, -30], r: 8, runners: 2 },
				{ at: [66, -6], r: 6, runners: 2, stompers: 1 },
				{ at: [68, 28], r: 8, runners: 2 },
				{ at: [-20, -68], r: 6, runners: 2, stompers: 1 },
				{ at: [26, -69], r: 6, runners: 3 },
				{ at: [-2, -80], r: 6, runners: 2 },
			],
			onRoad,
			// горит машина на парковке и на АЗС; бочка-костёр у баррикады, костёр на хоздворе
			fires: [[firstBurnt[0], firstBurnt[1], 'car'], [35.0, 78.6, 'car'], [-7.5, -4.6, 'barrel'], [-12, -67, 'ground']],
			barrels: 8,
			trees(tryTree) {
				for (let x = -56; x <= 56; x += 5.5) tryTree(x + R(-0.8, 0.8), 47.4 + R(-0.6, 0.6), 'birch'); // газон вдоль проспекта
				for (const [z0, z1] of [[6, 14], [23, 31]]) for (let i = 0; i < 3; i++) tryTree(R(-2.6, 2.6), R(z0, z1), 'birch'); // островки
				for (let i = 0; i < 14; i++) tryTree(R(-86, -55), R(-70, 48), 'birch');
				for (let i = 0; i < 14; i++) tryTree(R(55, 86), R(-70, 48), 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-86, 20), R(70, 86), 'birch');
				for (let i = 0; i < 6; i++) tryTree(R(-41, -39), R(-55, -14), 'birch');
				for (let i = 0; i < 6; i++) tryTree(R(39, 41), R(-55, -28), 'birch');
			},
			beltTrees: ['birch'],
			beltDensity: 0.9,
			clutter: 12,
			blood: 18,
			puddles: 10,
			puddle: () => (rnd() < 0.7 ? [R(-56, 56), R(-1, 43)] : [R(-86, 86), R(53.5, 66.5)]),
			grass: 0.7,
			hint: (b) => ({
				Galereya: 'Галерея ТЦ: одежда, обувь, аптека, электроника, «Охота и рыбалка», игрушки, ювелирный, фудкорт — обыщи прилавки, витрины, сейфы. Тут логово руберов',
				Gipermarket: 'Гипермаркет — лабиринт стеллажей: еда и лекарства на полках, деньги в кассах, сейф в кабинете управляющего',
				Sklad: 'Склад ТЦ — стеллажи с паллетами, ящики у рампы, стол и шкаф кладовщика',
				AzsShop: 'Магазин АЗС — прилавок, стеллаж, холодильник',
				Moyka: 'Автомойка — стеллаж с химией, стол администратора, шкаф',
				Burger: 'Бургерная — касса на прилавке, кухня: стеллаж и холодильник',
				KPP: 'Пост охраны ТЦ — стол дежурного и шкаф',
			}[b.name]),
		};
	},
};

/** Забор садового центра из сетки на столбах; вход — с запада (от проезда). */
function fencePlotGarden(batch, M, collide, cx, cz) {
	const W = 26, D = 20, x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
	const seg = (ax, az, bx, bz) => {
		const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax), n = Math.max(1, Math.round(len / 3));
		for (let i = 0; i < n; i++) {
			const t0 = i / n, tm = (i + 0.5) / n;
			batch.add(place(box(len / n, 1.8, 0.03, 1, 1), ax + (bx - ax) * tm, 0.9, az + (bz - az) * tm, -ang), M.film, { cast: false });
			batch.add(place(box(0.08, 2.0, 0.08), ax + (bx - ax) * t0, 1.0, az + (bz - az) * t0), M.metalDark);
		}
		collide((ax + bx) / 2, (az + bz) / 2, len, 0.2, -ang);
	};
	seg(x0, z0, x1, z0);
	seg(x1, z0, x1, z1);
	seg(x1, z1, x0, z1);
	seg(x0, z1, x0, cz + 2);
	seg(x0, cz - 2, x0, z0);
}
