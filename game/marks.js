// Следы боя: брызги и лужи крови, дырки от пуль на стенах, гарь от взрывов. Не тают со временем — держатся,
// пока кластер не перезагрузится (сохраняются вместе с ним: game.snapshot → saved.marks); в стабах — пока
// герой там. Рисуются пачками: один вид следа — одна команда видеокарте (InstancedMesh), сколько бы их ни
// было, поэтому долгий бой не роняет FPS. Если следов больше предела, самые старые уступают место новым.

import * as THREE from 'three';
import { bloodDecalTexture, splatterTexture, bulletHoleTexture, softDotTexture } from './textures.js';

/** Сколько следов каждого вида держится разом (по всей локации). */
export const MARK_CAPS = { splat: 600, pool: 160, hole: 400, scorch: 40 };

const tmpM = new THREE.Matrix4();
const dummy = new THREE.Object3D();
const r2 = (v) => Math.round(v * 100) / 100;

/** Пачка одного вида следа: по InstancedMesh на вариант текстуры, общий предел и порядок появления. */
class Pool {
	constructor(root, geo, mats, cap, order) {
		this.cap = cap;
		this.recs = []; // от старых к новым
		this.meshes = mats.map((mat) => {
			const im = new THREE.InstancedMesh(geo, mat, cap);
			im.count = 0;
			im.visible = false;
			im.frustumCulled = false; // следы по всей локации: одна пачка — один вызов, отсекать нечего
			im.renderOrder = order;
			im.userData.slots = [];
			root.add(im);
			return im;
		});
	}

	add(rec, matrix) {
		if (this.recs.length >= this.cap) this.remove(this.recs[0]);
		const im = this.meshes[rec.v];
		rec.slot = im.count;
		im.userData.slots[rec.slot] = rec;
		im.setMatrixAt(im.count++, matrix);
		im.instanceMatrix.needsUpdate = true;
		im.visible = true;
		this.recs.push(rec);
		return rec;
	}

	set(rec, matrix) {
		if (rec.slot < 0) return;
		const im = this.meshes[rec.v];
		im.setMatrixAt(rec.slot, matrix);
		im.instanceMatrix.needsUpdate = true;
	}

	remove(rec) {
		const im = this.meshes[rec.v], last = im.count - 1;
		if (rec.slot !== last) {
			// на место убранного — последний в пачке
			im.getMatrixAt(last, tmpM);
			im.setMatrixAt(rec.slot, tmpM);
			const moved = im.userData.slots[last];
			moved.slot = rec.slot;
			im.userData.slots[rec.slot] = moved;
		}
		im.count = last;
		im.userData.slots.length = last;
		im.instanceMatrix.needsUpdate = true;
		im.visible = last > 0;
		rec.slot = -1;
		const i = this.recs.indexOf(rec);
		if (i >= 0) this.recs.splice(i, 1);
	}

	clear() {
		for (const im of this.meshes) { im.count = 0; im.visible = false; im.userData.slots.length = 0; }
		for (const r of this.recs) r.slot = -1;
		this.recs = [];
	}

	get size() { return this.recs.length; }
}

export function createMarks(scene) {
	const root = new THREE.Group();
	root.name = 'Marks';
	scene.add(root);
	const ground = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const pools = {
		// гарь от взрыва — под кровью
		scorch: new Pool(root, ground, [new THREE.MeshBasicMaterial({ map: softDotTexture('14,12,10'), transparent: true, opacity: 0.8, depthWrite: false })], MARK_CAPS.scorch, 1),
		// лужа под убитым: растекается секунды четыре
		pool: new Pool(root, ground, [0, 1, 2, 3, 4].map((i) => new THREE.MeshStandardMaterial({ map: bloodDecalTexture(i), transparent: true, depthWrite: false, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -1 })), MARK_CAPS.pool, 2),
		// брызги: вытянуты по ходу полёта капель
		splat: new Pool(root, ground, [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({ map: splatterTexture(i), transparent: true, depthWrite: false, roughness: 0.22, polygonOffset: true, polygonOffsetFactor: -2 })), MARK_CAPS.splat, 3),
		// дырка от пули: на грани стены, лицом наружу
		hole: new Pool(root, new THREE.PlaneGeometry(0.16, 0.16), [new THREE.MeshStandardMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })], MARK_CAPS.hole, 3),
	};
	const growing = new Set();

	const groundMatrix = (x, y, z, ry, sx, sz) => {
		dummy.position.set(x, y, z);
		dummy.rotation.set(0, ry, 0);
		dummy.scale.set(sx, 1, sz);
		dummy.updateMatrix();
		return dummy.matrix;
	};
	const holeMatrix = (r) => {
		dummy.rotation.set(0, 0, 0);
		dummy.position.set(r.x, r.y, r.z);
		dummy.lookAt(r.x + Math.sin(r.a), r.y, r.z + Math.cos(r.a));
		dummy.rotateZ(r.rz);
		dummy.scale.setScalar(r.s);
		dummy.updateMatrix();
		return dummy.matrix;
	};
	// у каждого вида — как поставить на место и что сохранить
	const KIND = {
		splat: { put: (r) => groundMatrix(r.x, 0.03, r.z, r.ry, r.sx, r.sz), keys: ['v', 'x', 'z', 'ry', 'sx', 'sz'] },
		pool: { put: (r, k = 1) => groundMatrix(r.x, 0.035, r.z, r.ry, r.s * k, r.s * k), keys: ['v', 'x', 'z', 'ry', 's'] },
		scorch: { put: (r) => groundMatrix(r.x, 0.04, r.z, r.ry, 3.2, 3.2), keys: ['x', 'z', 'ry'] },
		hole: { put: holeMatrix, keys: ['x', 'y', 'z', 'a', 'rz', 's'] },
	};

	const add = (kind, r) => {
		r.kind = kind;
		r.v ??= 0;
		return pools[kind].add(r, KIND[kind].put(r));
	};

	return {
		root,
		pools,

		/** Брызги крови: size — размер, v — скорость капли (по ней пятно вытягивается). */
		splat(pos, size = 0.25, v = null) {
			const speed = v ? Math.hypot(v.x, v.z) : 0;
			const stretch = 1 + Math.min(1.2, speed * 0.25);
			return add('splat', {
				v: Math.floor(Math.random() * 4), x: pos.x, z: pos.z,
				ry: speed > 0.3 ? Math.atan2(-v.z, v.x) : Math.random() * Math.PI * 2, // +X текстуры — по ходу полёта
				sx: size * stretch * (0.8 + Math.random() * 0.4), sz: size * (0.7 + Math.random() * 0.4),
			});
		},

		/** Лужа крови под убитым: растекается от пятнышка до size за четыре секунды (grown — сразу растёкшаяся). */
		pool(pos, size, grown = false) {
			const r = add('pool', { v: Math.floor(Math.random() * 5), x: pos.x, z: pos.z, ry: Math.random() * Math.PI * 2, s: size });
			if (grown) return r;
			r.t = 0;
			pools.pool.set(r, KIND.pool.put(r, 0.2));
			growing.add(r);
			return r;
		},

		/** Дырка от пули на стене: (x, y, z) — на грани, nx/nz — наружу от стены. */
		hole(x, y, z, nx, nz) {
			return add('hole', { x, y, z, a: Math.atan2(nx, nz), rz: Math.random() * Math.PI * 2, s: 0.8 + Math.random() * 0.5 });
		},

		/** Выжженное пятно от взрыва. */
		scorch(pos) {
			return add('scorch', { x: pos.x, z: pos.z, ry: Math.random() * Math.PI * 2 });
		},

		update(dt) {
			for (const r of growing) {
				r.t += dt;
				const k = r.t >= 4 ? 1 : 0.2 + 0.8 * (1 - (1 - r.t / 4) ** 2);
				pools.pool.set(r, KIND.pool.put(r, k));
				if (k >= 1 || r.slot < 0) growing.delete(r);
			}
		},

		/** Всё смыть: перезагрузка кластера или другая локация. */
		clear() {
			for (const p of Object.values(pools)) p.clear();
			growing.clear();
		},

		/** Для сохранения кластера: { вид: [[поля...], ...] } — коротко, с точностью до сантиметра. */
		serialize() {
			const out = {};
			for (const [kind, p] of Object.entries(pools)) {
				if (p.size) out[kind] = p.recs.map((r) => KIND[kind].keys.map((k) => (k === 'v' ? r.v : r2(r[k]))));
			}
			return out;
		},

		/** Вернуть следы, какими их оставили (лужи — сразу растёкшиеся). */
		load(data) {
			this.clear();
			for (const [kind, list] of Object.entries(data ?? {})) {
				const spec = KIND[kind];
				if (!spec || !Array.isArray(list)) continue;
				for (const row of list.slice(-MARK_CAPS[kind])) {
					const r = {};
					spec.keys.forEach((k, i) => { r[k] = row[i]; });
					if (r.v >= pools[kind].meshes.length || r.v < 0) r.v = 0;
					add(kind, r);
				}
			}
		},

		/** Сколько следов сейчас по видам. */
		counts() { return Object.fromEntries(Object.entries(pools).map(([k, p]) => [k, p.size])); },
	};
}
