// Общие помощники статической геометрии: слияние мешей по материалам, коробки с UV в метрах.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- Метки предметов для Godot ----------
// Godot-версия ставит вместо процедурных предметов модели Tripo. Строитель предмета оборачивает свою геометрию
// в beginProp(вид, x, z, ry) … endProp(): при PROPS.on (включает только выгрузка для Godot) геометрия внутри
// не идёт в пачку, а её габарит (в осях предмета) записывается меткой в PROPS.list. Коллизии и вызовы
// генератора случайных чисел в строителях остаются как были — места лута, бочек и заражённых не сдвигаются.
// PROPS.types — виды, для которых в Godot есть модель (остальные предметы остаются процедурными).
export const PROPS = { on: false, list: [], types: null };
let propScope = null;
const _pv = new THREE.Vector3();

export function beginProp(type, x, z, ry = 0, extra = null) {
	if (!PROPS.on || (PROPS.types && !PROPS.types.has(type))) return;
	propScope = { type, x, z, ry, extra, cos: Math.cos(-ry), sin: Math.sin(-ry), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

/** Габарит предмета в его осях (геометрия уже в осях локации). */
function propAccumulate(geometry) {
	const s = propScope, pos = geometry.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		_pv.fromBufferAttribute(pos, i);
		const dx = _pv.x - s.x, dz = _pv.z - s.z;
		const lx = dx * s.cos + dz * s.sin, lz = -dx * s.sin + dz * s.cos;
		const v = [lx, _pv.y, lz];
		for (let k = 0; k < 3; k++) { if (v[k] < s.min[k]) s.min[k] = v[k]; if (v[k] > s.max[k]) s.max[k] = v[k]; }
	}
}

/** Добавить в метку габарит готового узла (машины-группы: автобус, БТР, «Урал»). */
export function propObject(object) {
	if (!propScope) return;
	object.updateMatrixWorld(true);
	object.traverse((o) => {
		if (!o.isMesh) return;
		const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
		propAccumulate(g);
		g.dispose();
	});
}

export function endProp() {
	const s = propScope;
	propScope = null;
	if (!s || !isFinite(s.min[0])) return false;
	const r = (v) => Math.round(v * 1000) / 1000;
	const c = [0, 1, 2].map((k) => r((s.min[k] + s.max[k]) / 2));
	const size = [0, 1, 2].map((k) => r(s.max[k] - s.min[k]));
	const m = { t: s.type, x: r(s.x), z: r(s.z), ry: r(s.ry), c, s: size };
	if (s.extra) Object.assign(m, s.extra);
	PROPS.list.push(m);
	return true;
}

/** Внутри метки предмета: геометрия не нужна (её заменит модель в Godot). */
export function inProp() { return propScope !== null; }

// ---------- Слияние статики ----------

export class Batch {
	/**
	 * chunk — размер участка, м: мелочь сливается по участкам, и то, что за экраном, видеокарта не рисует
	 * (отсечение по рамке камеры); крупное (дороги, земля — больше участка) — одним мешем на материал.
	 */
	constructor({ chunk = 0 } = {}) { this.groups = new Map(); this.chunk = chunk; }
	add(geometry, material, { cast = true, receive = true } = {}) {
		if (propScope) { propAccumulate(geometry); return; }
		let key = material.uuid + cast + receive;
		if (this.chunk) {
			geometry.computeBoundingBox();
			const b = geometry.boundingBox, c = this.chunk;
			if (b.max.x - b.min.x < c * 0.75 && b.max.z - b.min.z < c * 0.75) key += `:${Math.floor((b.min.x + b.max.x) / 2 / c)},${Math.floor((b.min.z + b.max.z) / 2 / c)}`;
		}
		if (!this.groups.has(key)) this.groups.set(key, { material, cast, receive, list: [] });
		const g = geometry.index ? geometry.toNonIndexed() : geometry;
		for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
		// без развёртки (валуны, кроны) — нулевая: иначе с остальными мешами того же материала не слить
		if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
		if (!g.attributes.normal) g.computeVertexNormals();
		this.groups.get(key).list.push(g);
	}
	build(parent) {
		for (const { material, cast, receive, list } of this.groups.values()) {
			const mesh = new THREE.Mesh(mergeGeometries(list), material);
			mesh.castShadow = cast;
			mesh.receiveShadow = receive;
			mesh.matrixAutoUpdate = false;
			parent.add(mesh);
		}
	}
}

/** Коробка с UV в метрах: текстура повторяется каждые sx×sy метров. */
export function box(w, h, d, sx = 1, sy = sx) {
	const g = new THREE.BoxGeometry(w, h, d);
	const uv = g.attributes.uv;
	const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
	for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
		const k = f * 4 + i;
		uv.setXY(k, uv.getX(k) * dims[f][0] / sx, uv.getY(k) * dims[f][1] / sy);
	}
	return g;
}

export function place(g, x, y, z, ry = 0, rx = 0, rz = 0) {
	const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
	return g.applyMatrix4(m);
}

export function planeXZ(w, d, sx = 1, sy = sx) {
	const g = new THREE.PlaneGeometry(w, d);
	g.rotateX(-Math.PI / 2);
	const uv = g.attributes.uv;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / sx, uv.getY(i) * d / sy);
	return g;
}
