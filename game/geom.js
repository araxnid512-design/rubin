// Общие помощники статической геометрии: слияние мешей по материалам, коробки с UV в метрах.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- Слияние статики ----------

export class Batch {
	constructor() { this.groups = new Map(); }
	add(geometry, material, { cast = true, receive = true } = {}) {
		const key = material.uuid + cast + receive;
		if (!this.groups.has(key)) this.groups.set(key, { material, cast, receive, list: [] });
		const g = geometry.index ? geometry.toNonIndexed() : geometry;
		for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
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
