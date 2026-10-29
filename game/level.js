// Локация 100×100 м: кластер (кусок мира, перенесённый в Улей) или стаб.
// Общее для всех локаций: земля, материалы, деревья, мелочи, трава, муть по краям, выходы,
// навигация. Своё у каждой — в game/locations/*.js.
// Статика сливается в несколько мешей по материалам; препятствия → коллайдеры и сетка навигации.

import * as THREE from 'three';
import * as T from './textures.js';
import { Batch, box, place, planeXZ } from './geom.js';
import { Fader, segmentHitsBox } from './buildings.js';
import { HALF, WIND, birchMaterial, buildTrees, grassTufts, fogWalls } from './props.js';
import zarechny from './locations/zarechny.js';
import dachi from './locations/dachi.js';
import stab from './locations/stab.js';

export { HALF };
export const PLAY = 46.5; // граница, за которую нельзя зайти (дальше муть)
export const LOCATIONS = { zarechny, dachi, stab };

/** Материалы локации (один экземпляр на тип — для слияния). */
function materials() {
	return {
		grass: T.grassMaterial([1, 1]),
		asphalt: T.asphaltMaterial([1, 1]),
		dirt: T.dirtMaterial([1, 1]),
		panel: T.panelFacadeMaterial([1, 1]),
		concrete: T.concreteMaterial([1, 1]),
		concreteDark: T.concreteMaterial([1, 1], [112, 110, 104]),
		brick: T.brickMaterial([1, 1]),
		whiteBrick: T.brickMaterial([1, 1], [200, 196, 182]),
		plaster: T.plasterMaterial([1, 1]),
		wood: T.woodMaterial([1, 1]),
		woodGrey: T.woodMaterial([1, 1], [120, 112, 100]),
		woodGreen: T.woodMaterial([1, 1], [70, 96, 70]),
		woodBlue: T.woodMaterial([1, 1], [78, 98, 120]),
		woodYellow: T.woodMaterial([1, 1], [150, 128, 70]),
		slate: T.slateRoofMaterial([1, 1]),
		roofMetal: T.metalRoofMaterial([1, 1]),
		roofGreen: T.metalRoofMaterial([1, 1], [64, 92, 66]),
		roofTar: T.concreteMaterial([1, 1], [60, 58, 56]),
		metalDark: new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.55, metalness: 0.6 }),
		metalRust: T.metalRoofMaterial([1, 1], [96, 70, 52]),
		metalOlive: T.metalRoofMaterial([1, 1], [74, 82, 56]),
		glass: new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.08, metalness: 0.6 }),
		film: new THREE.MeshStandardMaterial({ color: 0xd8e0d8, roughness: 0.3, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
		tire: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.9 }),
		window: T.houseWindowMaterial(),
		shopSign: T.signMaterial('ПРОДУКТЫ'),
		birch: birchMaterial(),
		leaves: new THREE.MeshStandardMaterial({ color: 0x6c7f3c, roughness: 0.9, flatShading: true }),
		leavesDry: new THREE.MeshStandardMaterial({ color: 0x8a8a42, roughness: 0.9, flatShading: true }),
		pine: new THREE.MeshStandardMaterial({ color: 0x34452c, roughness: 0.9, flatShading: true }),
		bark: T.woodMaterial([1, 1], [74, 58, 44]),
		yellow: new THREE.MeshStandardMaterial({ color: 0xb8902c, roughness: 0.6 }),
		red: new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.6 }),
		green: new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: 0.7, metalness: 0.2 }),
		canvas: T.fabricMaterial([92, 98, 70]),
		sandbag: new THREE.MeshStandardMaterial({ color: 0x8a7e5c, roughness: 1 }),
		water: T.waterMaterial(),
		sand: T.dirtMaterial([1, 1]),
	};
}

/**
 * Собрать локацию id (см. LOCATIONS). Возвращает статику, коллайдеры, навигацию, здания и тайники,
 * выходы, группы заражённых, точки действий стаба и функции обновления вида.
 */
export function buildLevel(scene, { quality = 'high', id = 'zarechny' } = {}) {
	const L = LOCATIONS[id];
	const rnd = T.mulberry(L.seed);
	const R = (a, b) => a + (b - a) * rnd();
	const root = new THREE.Group();
	root.name = `Level:${id}`;
	scene.add(root);
	const batch = new Batch();
	const colliders = [];
	const collide = (x, z, w, d, rot = 0) => colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, c: Math.cos(rot), s: Math.sin(rot) });
	const M = materials();

	// ---------- Земля ----------
	batch.add(planeXZ(150, 150, 7), M.grass, { cast: false });
	// покрытия земли запоминаем для плана локации (дороги, грунтовки, плиты)
	const grounds = [];
	const ground = (w, d, x, z, mat, s = 4, y = 0.012, ry = 0) => {
		batch.add(place(planeXZ(w, d, s), x, y, z, ry), mat, { cast: false });
		const kind = mat === M.asphalt ? 'asphalt' : mat === M.dirt ? 'dirt' : mat === M.concrete ? 'concrete' : mat === M.sand ? 'sand' : null;
		if (kind) grounds.push({ w, d, x, z, ry, kind });
	};

	// здания, которые становятся прозрачными, когда загораживают героя от камеры
	const occluders = [];
	const occluder = (name, build, area, min = 0.2) => {
		const b = new Batch(), group = new THREE.Group();
		group.name = name;
		build(b, group);
		b.build(group);
		root.add(group);
		occluders.push({ name, fader: new Fader(group, { speed: 3 }), area, min });
	};
	const buildings = [];
	const bctx = { batch, root, collide, M };
	const spec = L.build({ rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx, quality });
	const onRoad = spec.onRoad ?? (() => false);

	// ---------- Выходы из локации: дорожный указатель и стрелки на земле ----------
	for (const e of spec.exits ?? []) exitMarker(batch, root, collide, M, e);

	// ---------- Деревья и кусты ----------
	const navProbe = makeNav(colliders); // временная сетка, чтобы не сажать деревья в стены
	// внутри зданий ничего уличного: ни деревьев, ни травы, ни луж
	const indoors = (x, z, m = 0.5) => buildings.some((b) => b.contains({ x, z }, m));
	const nearExit = (x, z, m) => (spec.exits ?? []).some((e) => x > e.x0 - m && x < e.x1 + m && z > e.z0 - m && z < e.z1 + m);
	const trees = [];
	const tryTree = (x, z, kind) => {
		if (Math.abs(x) > 47 || Math.abs(z) > 47) return;
		if (navProbe.blockedAt(x, z, 1.2) || indoors(x, z, 1.5) || nearExit(x, z, 2)) return;
		if (onRoad(x, z, 1)) return; // не на дорогах
		trees.push({ x, z, kind, s: R(0.8, 1.25), r: R(0, Math.PI * 2) });
		collide(x, z, 0.5, 0.5);
	};
	spec.trees?.(tryTree);
	const crowns = buildTrees(root, trees, M);

	// ---------- Мелочи: бочки, шины, мусор, кровь, лужи ----------
	for (let i = 0; i < (spec.clutter ?? 18); i++) {
		const x = R(-45, 45), z = R(-45, 45);
		if (navProbe.blockedAt(x, z, 0.8) || indoors(x, z) || nearExit(x, z, 1)) continue;
		const k = rnd();
		if (k < 0.35) {
			batch.add(place(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), x, 0.45, z), M.metalRust);
			collide(x, z, 0.6, 0.6);
		} else if (k < 0.7) {
			batch.add(place(new THREE.TorusGeometry(0.3, 0.12, 8, 14), x, 0.12, z, 0, Math.PI / 2), M.tire);
		} else {
			batch.add(place(new THREE.SphereGeometry(0.35, 8, 6).scale(1, 0.6, 1), x, 0.18, z), M.tire);
		}
	}
	const decals = new THREE.Group();
	for (let i = 0; i < (spec.blood ?? 26); i++) {
		const blood = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: T.bloodDecalTexture(i % 5), transparent: true, depthWrite: false, roughness: 0.3 }));
		blood.rotation.x = -Math.PI / 2; blood.rotation.z = R(0, 6.28);
		const s = R(0.8, 2.6);
		blood.scale.set(s, s, 1);
		blood.position.set(R(-44, 44), 0.03, R(-44, 44));
		if (!indoors(blood.position.x, blood.position.z, s)) decals.add(blood);
	}
	for (let i = 0; i < (spec.puddles ?? 14); i++) {
		// неровная лужа с мягким краем: блестит и отражает небо, а не тёмная дыра
		const puddle = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: 0x59636a, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.7, alphaMap: T.puddleTexture(i % 4), envMapIntensity: 3.5, depthWrite: false }));
		puddle.rotation.x = -Math.PI / 2; puddle.rotation.z = R(0, 6.28);
		puddle.scale.set(R(0.9, 2.4), R(0.6, 1.5), 1);
		const [px, pz] = spec.puddle?.() ?? [R(-45, 45), R(-44, 44)];
		puddle.position.set(px, 0.028, pz);
		if (!indoors(px, pz, 2.4)) decals.add(puddle);
	}
	root.add(decals);

	// ---------- Трава ----------
	if (quality !== 'low') grassTufts(root, navProbe, rnd, Math.round((quality === 'high' ? 2600 : 1200) * (spec.grass ?? 1)), indoors, onRoad);

	// ---------- Муть по краям кластера (у стаба её нет) ----------
	const fog = spec.fog === false ? null : fogWalls(root);

	batch.build(root);
	const nav = makeNav(colliders);
	const exits = (spec.exits ?? []).map((e) => ({ ...e, spawn: new THREE.Vector3(e.spawn[0], 0, e.spawn[1]), ry: e.spawn[2] }));
	return {
		id, root, colliders, nav, buildings, exits,
		containers: buildings.flatMap((b) => b.containers),
		groups: spec.groups ?? [],
		stations: spec.stations ?? [],
		room: spec.room ?? null, // комната героя (только в стабе)
		// для плана локации: покрытия, препятствия, крупные постройки, деревья, вода; edge — край локации
		// (муть) — выход на карту Улья в любом месте, у стаба выход только через ворота
		plan: { grounds, trees, water: spec.water ?? [], blocks: occluders.map((o) => ({ name: o.name, ...o.area })) },
		edge: spec.fog !== false,
		npcs: spec.npcs ?? [],
		hint: spec.hint,
		start: spec.start ? { pos: new THREE.Vector3(spec.start[0], 0, spec.start[1]), ry: spec.start[2] } : { pos: exits[0].spawn.clone(), ry: exits[0].ry },
		update(dt, t) {
			WIND.value = t;
			M.water.normalMap?.offset.set(t * 0.012, t * 0.019); // рябь на воде
			fog?.update(dt, t);
			spec.update?.(dt, t);
		},
		/** Выход, в зоне которого точка (с запасом m), или null. */
		exitAt(p, m = 0) { return exits.find((e) => p.x > e.x0 - m && p.x < e.x1 + m && p.z > e.z0 - m && p.z < e.z1 + m) ?? null; },
		/** Герой у края кластера (в мути): отсюда тоже можно уйти на карту Улья. m — запас внутрь. */
		atEdge(p, m = 0) { return spec.fog !== false && (Math.abs(p.x) > PLAY - 0.8 - m || Math.abs(p.z) > PLAY - 0.8 - m); },
		/** Ближайший к точке выход у дороги (куда подсказать идти). */
		nearestExit(p) {
			let best = null, bd = Infinity;
			for (const e of exits) {
				const d = Math.hypot(Math.max(e.x0 - p.x, 0, p.x - e.x1), Math.max(e.z0 - p.z, 0, p.z - e.z1));
				if (d < bd) { bd = d; best = e; }
			}
			return best;
		},
		/** Точка появления при приходе из локации from. */
		entry(from) {
			const e = exits.find((x) => x.to === from) ?? exits[0];
			return { pos: e.spawn.clone(), ry: e.ry };
		},
		/**
		 * Видимость зданий: у дома, где герой, исчезают крыша и верх стен; здания между камерой
		 * и героем становятся полупрозрачными.
		 */
		updateView(player, eye, dt) {
			const head = new THREE.Vector3(player.x, 1.1, player.z);
			for (const b of buildings) b.updateView(head, eye, dt);
			for (const o of occluders) {
				o.fader.target = segmentHitsBox(eye, head, o.area) ? o.min : 1;
				o.fader.update(dt);
			}
		},
		/** Здание, внутри которого точка (или null). */
		buildingAt(p) { return buildings.find((b) => b.contains(p)) ?? null; },
		/** Прячем кроны деревьев, которые закрывают игрока от камеры (камера с юга, сверху). */
		occlude(p) {
			for (const c of crowns) {
				let changed = false;
				c.list.forEach((t, i) => {
					const dx = t.x - p.x, dz = t.z - (p.z + 3.5);
					const want = Math.hypot(dx, dz * 0.7) < 5.5 ? 0.0 : 1;
					t.vis = t.vis ?? 1;
					const v = t.vis + (want - t.vis) * 0.2;
					if (Math.abs(v - t.vis) < 1e-3) return;
					t.vis = v;
					c.matrix.compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.r, 0)), new THREE.Vector3(t.s * v, t.s * v, t.s * v));
					c.mesh.setMatrixAt(i, c.matrix);
					changed = true;
				});
				if (changed) c.mesh.instanceMatrix.needsUpdate = true;
			}
		},
		/** Убрать локацию из сцены и освободить видеопамять. */
		dispose() {
			scene.remove(root);
			root.traverse((o) => {
				o.geometry?.dispose();
				for (const m of [o.material].flat()) {
					if (!m) continue;
					for (const k of ['map', 'normalMap']) m[k]?.dispose();
					m.dispose();
				}
			});
		},
	};
}

/** Выход: синий указатель «куда» на столбе у дороги и светлые стрелки на земле в зоне выхода. */
function exitMarker(batch, root, collide, M, e) {
	const [sx, sz, text] = e.sign;
	batch.add(place(box(0.08, 2.6, 0.08), sx, 1.3, sz), M.metalDark);
	const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.62), T.signMaterial(text, { bg: '#1d4f9c', fg: '#f4f4f0', w: 640, h: 152 }));
	sign.position.set(sx, 2.35, sz + 0.05);
	root.add(sign);
	const back = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.62), M.metalDark);
	back.position.set(sx, 2.35, sz);
	back.rotation.y = Math.PI;
	root.add(back);
	collide(sx, sz, 0.3, 0.3);
	// стрелки «туда» по направлению выхода (к ближайшему краю)
	const cx = (e.x0 + e.x1) / 2, cz = (e.z0 + e.z1) / 2;
	const dir = Math.abs(cx) > Math.abs(cz) ? [Math.sign(cx), 0] : [0, Math.sign(cz)];
	const ang = Math.atan2(dir[0], dir[1]);
	const shape = new THREE.Shape();
	shape.moveTo(0, 0.7); shape.lineTo(0.55, 0); shape.lineTo(0.22, 0); shape.lineTo(0.22, -0.6); shape.lineTo(-0.22, -0.6); shape.lineTo(-0.22, 0); shape.lineTo(-0.55, 0); shape.closePath();
	const geo = new THREE.ShapeGeometry(shape);
	const ax = Math.max(Math.min(cx - dir[0] * 3, 46), -46), az = Math.max(Math.min(cz - dir[1] * 3, 46), -46);
	for (let k = 0; k < 2; k++) {
		const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xeef2d0, transparent: true, opacity: 0.45, depthWrite: false }));
		m.rotation.set(-Math.PI / 2, 0, ang + Math.PI);
		m.position.set(ax + dir[0] * k * 1.6, 0.04, az + dir[1] * k * 1.6);
		root.add(m);
	}
}

// ---------- Навигация ----------

/** Шаг сетки навигации, м: мелкая сетка, чтобы зомби проходили в двери домов. */
export const CELL = 0.5;

/** Сетка CELL×CELL: занятые клетки (с запасом под радиус персонажа). */
export function makeNav(colliders, pad = 0.35) {
	const N = Math.round((HALF * 2) / CELL);
	const blocked = new Uint8Array(N * N);
	const center = (g) => g * CELL - HALF + CELL / 2;
	const inside = (c, x, z, p) => {
		const dx = x - c.x, dz = z - c.z;
		const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
		return Math.abs(lx) <= c.hx + p && Math.abs(lz) <= c.hz + p;
	};
	const cellOf = (v) => Math.floor((v + HALF) / CELL);
	for (const c of colliders) {
		const r = Math.hypot(c.hx, c.hz) + pad + CELL;
		for (let gz = Math.max(0, cellOf(c.z - r)); gz < Math.min(N, cellOf(c.z + r) + 1); gz++) {
			for (let gx = Math.max(0, cellOf(c.x - r)); gx < Math.min(N, cellOf(c.x + r) + 1); gx++) {
				if (inside(c, center(gx), center(gz), pad)) blocked[gz * N + gx] = 1;
			}
		}
	}
	for (let i = 0; i < N; i++) for (const [gx, gz] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) blocked[gz * N + gx] = 1;
	return {
		N, blocked, CELL,
		cell: (x, z) => [cellOf(x), cellOf(z)],
		/** Центр клетки в мировых координатах. */
		center,
		blockedAt(x, z, p = 0) {
			if (Math.abs(x) > PLAY || Math.abs(z) > PLAY) return true;
			return colliders.some((c) => inside(c, x, z, p));
		},
	};
}

/** Отталкивание круга (x,z,r) от коллайдеров. Возвращает исправленную позицию. */
export function resolveCollisions(pos, r, colliders) {
	for (const c of colliders) {
		const dx = pos.x - c.x, dz = pos.z - c.z;
		if (Math.abs(dx) > c.hx + c.hz + r + 1 || Math.abs(dz) > c.hx + c.hz + r + 1) continue;
		const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c; // в систему коллайдера (поворот как у Object3D.rotation.y)
		const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
		let ox = lx - qx, oz = lz - qz;
		const d2 = ox * ox + oz * oz;
		if (d2 > r * r) continue;
		let nx, nz, push;
		if (d2 > 1e-8) {
			const d = Math.sqrt(d2);
			nx = ox / d; nz = oz / d; push = r - d;
		} else {
			// центр внутри: выталкиваем по кратчайшей оси
			const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
			if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; push = pz + r; }
		}
		// обратно в мир
		pos.x += (nx * c.c + nz * c.s) * push;
		pos.z += (-nx * c.s + nz * c.c) * push;
	}
	pos.x = Math.max(-PLAY, Math.min(PLAY, pos.x));
	pos.z = Math.max(-PLAY, Math.min(PLAY, pos.z));
	return pos;
}
