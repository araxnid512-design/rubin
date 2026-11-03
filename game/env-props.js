// Предметы окружения из Tripo (машины, мебель, улица, промзона) вместо процедурных — как в Godot-версии
// (godot/scripts/env_props.gd, план docs/tripo/plan_environment.md). Модели — один файл models/game/env.glb с общим
// атласом и одним материалом (scripts/shrink-env.mjs). Строители предметов оборачивают свою геометрию в
// beginProp(вид, x, z, ry) … endProp() (game/geom.js): пока модели загружены, геометрия внутри в статику не идёт,
// а её габарит записывается меткой — коллизии, тайники и вызовы генератора случайных чисел остаются прежними.
// По меткам модель вписывается в габарит старого предмета (место и поворот — его), и все предметы участка 33 м
// сливаются в ОДИН меш: один вызов отрисовки на участок в кадре (за кадром — отсечение по рамке камеры).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Вид предмета (beginProp) → модели (у обычных машин — по очереди несколько); как PROP_MODELS в tools/godot-export.html. */
export const PROP_MODELS = {
	car: ['e_vaz2107', 'e_niva', 'e_volga', 'e_uaz'], car_crashed: ['e_vaz_crashed'], car_burned: ['e_vaz_burned'],
	bus: ['e_paz'], btr: ['e_btr80'], truck: ['e_ural'],
	fridge: ['e_fridge'], stove: ['e_pech'], burzhuyka: ['e_burzhuyka'], sofa: ['e_sofa'], bed: ['e_bed'],
	wardrobe: ['e_wardrobe'], buffet: ['e_buffet'], drawers: ['e_drawers'], nightstand: ['e_nightstand'], chest: ['e_chest'],
	table: ['e_table'], chair: ['e_chair'], tv: ['e_tv'], bunk: ['e_bunk'], lathe: ['e_lathe'],
	barrel: ['e_barrel'], tire: ['e_tire'], trash: ['e_trashbags'], crate: ['e_crate'], bench: ['e_bench'],
	dumpster: ['e_dumpster'], block: ['e_block'], sandbags: ['e_sandbags'], woodpile: ['e_woodpile'], well: ['e_well'],
	pipes: ['e_pipes'], hazard: ['e_hazard'], ammo: ['e_ammo'],
};

// Поворот модели вокруг Y, чтобы её перед смотрел туда же, что перед процедурного предмета. Модели Tripo лежат в файле
// передом к +X; перед легковушки (addCar) — тоже +X, у автобуса, БТР, «Урала» и мебели (лицо тайника, экран, устье
// печи) — +Z: поворот −90°. Стул в файле повёрнут сиденьем к +X+Z, койка лежит вдоль Z, трубы — вдоль X; у скамейки
// спинка в +Z, сидят лицом к −Z. Сверено по листам моделей сверху (как FRONT в env_props.gd).
const Q = -Math.PI / 2;
const FRONT = {
	e_paz: Q, e_btr80: Q, e_ural: Q,
	e_fridge: Q, e_pech: Q, e_burzhuyka: Q, e_sofa: Q, e_bed: Q, e_wardrobe: Q, e_buffet: Q,
	e_drawers: Q, e_nightstand: Q, e_chest: Q, e_table: Q, e_chair: -0.75, e_tv: Q, e_bunk: 0, e_lathe: Q,
	e_barrel: Q, e_tire: Q, e_trashbags: Q, e_crate: Q, e_dumpster: Q, e_block: Q, e_sandbags: Q,
	e_woodpile: Q, e_well: Q, e_pipes: 0, e_hazard: Q, e_ammo: Q, e_bench: Math.PI / 2,
};
/** Без «переда» (стол, ящики, блок): длинная сторона модели легла поперёк габарита — поворот на 90°. */
const AUTO_TURN = new Set(['e_table', 'e_crate', 'e_ammo', 'e_block', 'e_dumpster']);
/** Свой предел искажения пропорций: штабель труб и стенку мешков можно тянуть вдоль (коллайдер сплошной). */
const DISTORT = { e_pipes: 0.4, e_sandbags: 0.4 };
/**
 * Техника — без искажения пропорций: один масштаб на все оси, длина — по габариту, но поперёк — не шире габарита
 * больше чем в RIGID_WIDE раз (иначе широкая модель торчала бы из коллайдера в стену или соседнюю машину).
 */
const RIGID = new Set(['e_vaz2107', 'e_vaz_crashed', 'e_vaz_burned', 'e_niva', 'e_volga', 'e_uaz', 'e_paz', 'e_btr80', 'e_ural']);
const RIGID_WIDE = 1.15;
/** Оттенок кузова из метки (цвет краски процедурной машины) — наполовину: у моделей своя краска. */
const TINT_MIX = 0.5;

let models = null; // id → { geometry: в осях предмета (FRONT), центр габарита в начале осей; size }
let material = null;
let kinds = null;

/** Загрузить модели (load — загрузчик GLB игры). Без них предметы остаются процедурными. */
export async function loadEnvProps(load) {
	const gltf = await load('env');
	gltf.scene.updateMatrixWorld(true);
	models = {};
	gltf.scene.traverse((o) => {
		if (!o.isMesh) return;
		material ??= o.material;
		// сжатые (квантованные) вершины → обычные числа в осях модели: их потом двигают и сливают
		const src = o.geometry, g = new THREE.BufferGeometry();
		for (const name of ['position', 'normal', 'uv']) {
			const a = src.attributes[name], n = a.count, size = a.itemSize, arr = new Float32Array(n * size);
			for (let i = 0; i < n; i++) {
				arr[i * size] = a.getX(i);
				arr[i * size + 1] = a.getY(i);
				if (size > 2) arr[i * size + 2] = a.getZ(i);
			}
			g.setAttribute(name, new THREE.BufferAttribute(arr, size));
		}
		g.setIndex(new THREE.BufferAttribute(Uint32Array.from(src.index.array), 1));
		g.applyMatrix4(o.matrixWorld);
		g.rotateY(FRONT[o.name] ?? 0);
		g.computeBoundingBox();
		const box = g.boundingBox, c = box.getCenter(new THREE.Vector3());
		g.translate(-c.x, -c.y, -c.z);
		models[o.name] = { geometry: g, size: box.getSize(new THREE.Vector3()) };
		src.dispose();
	});
	material = material.clone();
	material.vertexColors = true; // оттенок кузова машин — цветом вершин
	material.roughness = 0.85;
	material.metalness = 0.05;
	material.name = 'envProps';
	material.userData.shared = true; // общий для всех локаций: level.dispose() его не освобождает
	kinds = new Set(Object.keys(PROP_MODELS).filter((t) => PROP_MODELS[t].some((m) => models[m])));
	return kinds;
}

/** Виды предметов, для которых модели загружены, или null. */
export function envKinds() { return kinds; }

/** Масштаб по осям: модель have — в габарит want, искажение пропорций не больше ±distort. */
function fitScale(have, want, distort) {
	const k = [want.x / Math.max(have.x, 0.001), want.y / Math.max(have.y, 0.001), want.z / Math.max(have.z, 0.001)];
	const mean = (k[0] + k[1] + k[2]) / 3, lo = mean * (1 - distort), hi = mean * (1 + distort);
	return new THREE.Vector3(...k.map((v) => Math.min(hi, Math.max(lo, v))));
}

/** Один масштаб на все оси (техника). */
function rigidScale(have, want) {
	const kx = want.x / Math.max(have.x, 0.001), kz = want.z / Math.max(have.z, 0.001);
	const s = want.x >= want.z ? Math.min(kx, kz * RIGID_WIDE) : Math.min(kz, kx * RIGID_WIDE);
	return new THREE.Vector3(s, s, s);
}

const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Поставить предметы по меткам (PROPS.list) в узел root: модели всех предметов участка chunk — одним мешем.
 * Возвращает число поставленных.
 */
export function placeEnvProps(root, list, chunk) {
	if (!models) return 0;
	const groups = new Map();
	let n = 0;
	list.forEach((p, i) => {
		const ms = PROP_MODELS[p.t]?.filter((m) => models[m]) ?? [];
		const id = p.m && models[p.m] ? p.m : ms[i % ms.length];
		const info = models[id];
		if (!info) return;
		const want = new THREE.Vector3(...p.s);
		let have = info.size;
		const turn = AUTO_TURN.has(id) && (want.x - want.z) * (have.x - have.z) < 0;
		if (turn) have = new THREE.Vector3(have.z, have.y, have.x);
		const k = RIGID.has(id) ? rigidScale(have, want) : fitScale(have, want, DISTORT[id] ?? 0.2);
		// место и поворот предмета → центр габарита в его осях; низ модели — на низ габарита
		_m.makeRotationY(p.ry).setPosition(p.x, 0, p.z);
		_l.makeScale(k.x, k.y, k.z).setPosition(p.c[0], p.c[1] - want.y / 2 + have.y * k.y / 2, p.c[2]);
		if (turn) _l.multiply(_r.makeRotationY(Math.PI / 2));
		const g = info.geometry.clone().applyMatrix4(_m.multiply(_l));
		// цвет вершин: оттенок кузова (у остальных белый), в линейном пространстве цвета
		const t = p.tint ?? [1, 1, 1];
		_c.setRGB(1 + (t[0] - 1) * TINT_MIX, 1 + (t[1] - 1) * TINT_MIX, 1 + (t[2] - 1) * TINT_MIX, THREE.SRGBColorSpace);
		const cnt = g.attributes.position.count, col = new Float32Array(cnt * 3);
		for (let v = 0; v < cnt; v++) col.set([_c.r, _c.g, _c.b], v * 3);
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		const key = `${Math.floor(p.x / chunk)},${Math.floor(p.z / chunk)}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(g);
		n++;
	});
	for (const [key, list2] of groups) {
		const merged = mergeGeometries(list2);
		for (const g of list2) g.dispose();
		const mesh = new THREE.Mesh(merged, material);
		mesh.name = `Props:${key}`;
		mesh.matrixAutoUpdate = false;
		root.add(mesh);
	}
	return n;
}
