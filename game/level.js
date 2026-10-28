// Локация 100×100 м: кусок посёлка, перенесённый в Улей (кластер).
// Статика сливается в несколько мешей по материалам; препятствия → коллайдеры и сетка навигации.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { Batch, box, place, planeXZ } from './geom.js';
import { buildHouse, buildShop, Fader, segmentHitsBox } from './buildings.js';

export const HALF = 50; // половина размера кластера
export const PLAY = 46.5; // граница, за которую нельзя зайти (дальше муть)

// ---------- Уровень ----------

export function buildLevel(scene, { quality = 'high' } = {}) {
	const rnd = T.mulberry(1337);
	const R = (a, b) => a + (b - a) * rnd();
	const root = new THREE.Group();
	root.name = 'Level';
	scene.add(root);
	const batch = new Batch();
	const colliders = [];
	const collide = (x, z, w, d, rot = 0) => colliders.push({ x, z, hx: w / 2, hz: d / 2, rot, c: Math.cos(rot), s: Math.sin(rot) });

	// Материалы (один экземпляр на тип — для слияния)
	const M = {
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
		slate: T.slateRoofMaterial([1, 1]),
		roofMetal: T.metalRoofMaterial([1, 1]),
		roofTar: T.concreteMaterial([1, 1], [60, 58, 56]),
		metalDark: new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.55, metalness: 0.6 }),
		metalRust: T.metalRoofMaterial([1, 1], [96, 70, 52]),
		glass: new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.08, metalness: 0.6 }),
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
		sand: T.dirtMaterial([1, 1]),
	};

	// ---------- Земля ----------
	batch.add(planeXZ(150, 150, 7), M.grass, { cast: false });
	const ground = (w, d, x, z, mat, s = 4, y = 0.012, ry = 0) => batch.add(place(planeXZ(w, d, s), x, y, z, ry), mat, { cast: false });
	// трасса (запад—восток) и улица на север
	ground(150, 8, 0, 6, M.asphalt, 5, 0.02);
	ground(150, 1.6, 0, 1.2, M.dirt, 3, 0.014);
	ground(150, 1.6, 0, 10.8, M.dirt, 3, 0.014);
	ground(6, 58, 12, -27, M.asphalt, 5, 0.022);
	ground(150, 0.15, 0, 6, markingMaterial(), 6, 0.026);
	// грунтовка к частным домам, двор хрущёвки, площадка у гаражей
	ground(56, 4, -18, -22, M.dirt, 4, 0.016);
	ground(42, 12, -18, 18, M.dirt, 5, 0.014);
	ground(40, 8, 20, 34, M.dirt, 5, 0.014);
	ground(14, 10, 26, -10, M.dirt, 4, 0.015);

	// здания, которые становятся прозрачными, когда загораживают героя от камеры
	const occluders = [];
	const occluder = (name, build, area, min = 0.2) => {
		const b = new Batch(), group = new THREE.Group();
		group.name = name;
		build(b, group);
		b.build(group);
		root.add(group);
		occluders.push({ fader: new Fader(group, { speed: 3 }), area, min });
	};

	// ---------- Хрущёвка (5 этажей) ----------
	{
		const cx = -18, cz = 30, W = 38.4, D = 12, H = 14;
		occluder('Khrushchyovka', (kb) => {
			kb.add(place(box(W, H, D, 3.2, 2.8), cx, H / 2 + 0.6, cz), M.panel);
			kb.add(place(box(W + 0.3, 0.8, D + 0.3, 2), cx, 0.4, cz), M.concreteDark); // цоколь
			kb.add(place(box(W + 0.4, 0.5, D + 0.4, 4), cx, H + 0.85, cz), M.concrete); // парапет
			kb.add(place(box(W, 0.1, D, 4), cx, H + 1.1, cz), M.roofTar);
			for (const ex of [-12.8, 0, 12.8]) {
				const x = cx + ex, z = cz - D / 2;
				kb.add(place(box(2.6, 0.15, 1.6), x, 2.9, z - 0.8), M.concrete); // козырёк
				kb.add(place(box(1.3, 2.2, 0.1), x, 1.7, z - 0.05), M.metalDark); // дверь
			}
			// балконы на северном фасаде
			for (let floor = 1; floor < 5; floor++) for (let c = 0; c < 12; c++) {
				if (c % 4 === 0 || rnd() < 0.45) continue;
				const x = cx - W / 2 + 1.6 + c * 3.2, y = 0.6 + floor * 2.8, z = cz - D / 2 - 0.55;
				kb.add(place(box(2.8, 0.12, 1.1), x, y, z), M.concrete);
				kb.add(place(box(2.8, 1.0, 0.06, 1), x, y + 0.56, z - 0.52), rnd() < 0.5 ? M.metalRust : M.woodGrey);
			}
		}, { cx, cz, ry: 0, hx: W / 2 + 0.6, hz: D / 2 + 1.2, top: H + 1.5 }, 0.16);
		collide(cx, cz, W + 0.4, D + 0.4);
		for (const ex of [-12.8, 0, 12.8]) {
			const x = cx + ex, z = cz - D / 2;
			batch.add(place(box(2.4, 0.3, 1.2, 1), x, 0.15, z - 0.6), M.concrete); // крыльцо
			// лавочки у подъезда
			bench(batch, M, x + 2.2, z - 2.2, 0);
			bench(batch, M, x - 2.2, z - 2.2, 0);
		}
		// детская площадка
		swings(batch, M, -26, 16);
		batch.add(place(box(3, 0.3, 3, 1), -16, 0.15, 17), M.wood); // песочница
		batch.add(place(planeXZ(2.7, 2.7, 1), -16, 0.31, 17), M.sand, { cast: false });
		collide(-16, 17, 3, 3);
		slide(batch, M, -21, 21);
		// мусорные контейнеры
		for (let i = 0; i < 3; i++) {
			batch.add(place(box(1.2, 1.1, 0.9, 1), -1 + i * 1.4, 0.55, 22, R(-0.1, 0.1)), M.green);
		}
		collide(0.4, 22, 4.4, 1);
	}

	// ---------- Гаражи ----------
	{
		const z0 = 41, n = 9, w = 4;
		occluder('Garages', (gb, group) => {
			for (let i = 0; i < n; i++) {
				const x = 4 + i * w;
				gb.add(place(box(w, 2.6, 6, 1.2), x, 1.3, z0), i % 3 === 0 ? M.whiteBrick : M.brick);
				gb.add(place(box(w + 0.1, 0.12, 6.4, 2), x, 2.66, z0 - 0.1, 0, -0.04), M.roofTar);
				const door = new THREE.Mesh(box(3, 2.2, 0.08), T.garageDoorMaterial(i));
				door.position.set(x, 1.1, z0 - 3.02);
				door.castShadow = true; door.receiveShadow = true;
				group.add(door);
			}
		}, { cx: 4 + (n - 1) * w / 2, cz: z0, ry: 0, hx: n * w / 2 + 0.2, hz: 3.3, top: 2.9 }, 0.3);
		collide(4 + (n - 1) * w / 2, z0, n * w, 6);
	}

	// ---------- Частные дома (можно зайти) ----------
	const bctx = { batch, root, collide, M };
	const buildings = [
		buildHouse(bctx, { name: 'House1', cx: -30, cz: -10, ry: 0, rnd, variant: 0 }),
		buildHouse(bctx, { name: 'House2', cx: -30, cz: -34, ry: Math.PI, rnd, variant: 1 }),
		buildHouse(bctx, { name: 'House3', cx: -6, cz: -34, ry: Math.PI, rnd, variant: 2 }),
	];
	fencePlot(batch, M, collide, -30, -10, 18, 14, 'n', rnd);
	fencePlot(batch, M, collide, -30, -34, 18, 14, 's', rnd);
	fencePlot(batch, M, collide, -6, -34, 16, 14, 's', rnd);
	shed(batch, M, collide, -37.2, -4.4, 0.1);
	shed(batch, M, collide, -23.4, -39.8, 2.9);
	well(batch, M, collide, -8, -12);

	// ---------- Магазин «Продукты» (можно зайти) ----------
	{
		const cx = 30, cz = -10, W = 9;
		buildings.push(buildShop(bctx, { cx, cz }));
		// ящики и поддоны у чёрного хода
		for (let i = 0; i < 4; i++) batch.add(place(box(1.2, 0.15, 0.8), cx + W / 2 + 1, 0.08 + i * 0.16, cz + 4, R(-0.2, 0.2)), M.wood);
		collide(cx + W / 2 + 1, cz + 4, 1.3, 1);
	}

	// ---------- Остановка ----------
	{
		const x = 30, z = 0.2;
		batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z - 0.9), M.concrete);
		batch.add(place(box(5.4, 0.15, 2.2, 1), x, 2.45, z), M.metalRust);
		for (const dx of [-2.4, 2.4]) batch.add(place(box(0.15, 2.4, 2, 1), x + dx, 1.2, z), M.concrete);
		batch.add(place(box(4, 0.08, 0.5), x, 0.5, z - 0.55), M.wood);
		collide(x, z - 0.4, 5.2, 1.2);
	}

	// ---------- Водонапорная башня ----------
	{
		const x = 38, z = -38;
		const pipe = new THREE.CylinderGeometry(0.9, 1.1, 12, 12);
		batch.add(place(pipe, x, 6, z), M.metalRust);
		const tank = new THREE.CylinderGeometry(2.6, 2.6, 3.5, 16);
		batch.add(place(tank, x, 13.6, z), M.metalRust);
		const cone = new THREE.ConeGeometry(2.8, 1.4, 16);
		batch.add(place(cone, x, 16.1, z), M.metalRust);
		collide(x, z, 2.4, 2.4);
	}

	// ---------- Столбы ЛЭП с проводами ----------
	{
		const poles = [-44, -22, 0, 22, 44].map((x) => [x, 0.4]);
		const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
		poles.forEach(([x, z], i) => {
			batch.add(place(box(0.28, 9, 0.28, 1, 3), x, 4.5, z, 0, 0, i === 3 ? 0.12 : 0), M.concrete);
			batch.add(place(box(2.2, 0.14, 0.14), x, 8.4, z, 0, 0, i === 3 ? 0.12 : 0), M.wood);
			collide(x, z, 0.5, 0.5);
			if (i === 0) return;
			const [px] = poles[i - 1];
			for (const off of [-0.9, 0, 0.9]) {
				const pts = [];
				for (let k = 0; k <= 16; k++) {
					const t = k / 16;
					pts.push(new THREE.Vector3(px + (x - px) * t + off * 0, 8.45 - Math.sin(Math.PI * t) * 1.1, z + off));
				}
				root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
			}
		});
	}

	// ---------- Машины ----------
	const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
	car(-30, 4.4, 0.18, 0x7b8a5a);
	car(4.5, 7.6, -2.95, 0xa8a49a);
	car(20, 4.2, 0.9, 0x8a2e24, { crashed: true });
	car(-34, 14.5, Math.PI / 2 + 0.05, 0x3a5a7a);
	car(-9, 15, Math.PI / 2 - 0.08, 0xc8c0a8);
	car(-4, -8, 0.6, 0x222222, { burned: true });
	car(22, -18, 0.35, 0x5a6a3a);
	bus(batch, M, root, 12, -27, 0.08);
	collide(12, -27, 2.6, 8.4, 0.08);

	// ---------- Обжитость: фонари, бордюры, баррикада, огороды, дворы, брошенные вещи ----------
	// бордюры вдоль трассы (на перекрёстке с улицей — разрыв)
	for (const [x0, x1, z] of [[-48, 8.6, 1.95], [15.4, 48, 1.95], [-48, 48, 10.05]]) {
		batch.add(place(box(x1 - x0, 0.14, 0.24, 2), (x0 + x1) / 2, 0.07, z), M.concrete, { cast: false });
	}
	for (const x of [-40, -16, 8, 32]) streetLamp(batch, M, collide, x, 11.4);
	barricade(batch, M, collide, -41.2, rnd);
	// огороды с грядками, поленницы, туалеты и бельё во дворах частных домов
	garden(batch, M, rnd, -24.0, -10, 3, 9);
	garden(batch, M, rnd, -24.0, -33, 3, 8.5);
	garden(batch, M, rnd, -12.9, -34, 2, 9);
	woodpile(batch, M, collide, -36.8, -7.8, Math.PI / 2);
	woodpile(batch, M, collide, -36.8, -31.2, Math.PI / 2);
	woodpile(batch, M, collide, 0.6, -33.2, Math.PI / 2);
	outhouse(batch, M, collide, -37.4, -15.6, 0);
	outhouse(batch, M, collide, -37.4, -39.6, Math.PI);
	outhouse(batch, M, collide, 1.0, -39.6, Math.PI);
	clothesline(batch, M, root, collide, -33.5, -27.5, -4.4, rnd);
	// мешки с мусором у баков, брошенные чемоданы и велосипед на трассе, знак посёлка
	for (const [x, z] of [[-2.3, 22.7], [3.0, 21.5], [2.7, 23.1], [-1.7, 23.4], [3.6, 22.4]]) {
		batch.add(place(new THREE.IcosahedronGeometry(0.32, 1).scale(1, 0.75, 1), x, 0.22, z, R(0, 3)), M.tire);
	}
	for (const [x, z, r] of [[22.6, 6.2, 0.4], [17.6, 7.4, 2.1], [-12.5, 3.6, 1.2]]) {
		batch.add(place(box(0.62, 0.42, 0.24), x, 0.13, z, r, Math.PI / 2), M.red);
		batch.add(place(box(0.2, 0.03, 0.04), x, 0.26, z, r), M.metalDark);
	}
	bicycle(batch, M, -20, 8.2, 0.6);
	settlementSign(batch, M, root, collide, 40.5, 11.8, 'ЗАРЕЧНЫЙ');

	// ---------- Деревья и кусты ----------
	const navProbe = makeNav(colliders); // временная сетка, чтобы не сажать деревья в стены
	// внутри зданий ничего уличного: ни деревьев, ни травы, ни луж
	const indoors = (x, z, m = 0.5) => buildings.some((b) => b.contains({ x, z }, m));
	const trees = [];
	const tryTree = (x, z, kind) => {
		if (Math.abs(x) > 47 || Math.abs(z) > 47) return;
		if (navProbe.blockedAt(x, z, 1.2) || indoors(x, z, 1.5)) return;
		if (Math.abs(z - 6) < 6.5 || (Math.abs(x - 12) < 4.5 && z < 4)) return; // не на дорогах
		trees.push({ x, z, kind, s: R(0.8, 1.25), r: R(0, Math.PI * 2) });
		collide(x, z, 0.5, 0.5);
	};
	for (let i = 0; i < 30; i++) tryTree(R(26, 46), R(-46, -22), rnd() < 0.8 ? 'birch' : 'pine'); // роща
	for (let i = 0; i < 16; i++) tryTree(R(-38, 0), R(12, 24) - (rnd() < 0.5 ? 0 : -2), 'birch'); // двор
	for (let i = 0; i < 40; i++) tryTree(R(-47, 47), R(-47, 47), rnd() < 0.7 ? 'birch' : (rnd() < 0.5 ? 'pine' : 'apple'));
	for (let i = 0; i < 14; i++) tryTree(R(-46, 46), R(44, 47), 'pine');
	const crowns = buildTrees(root, trees, M);

	// ---------- Мелочи: бочки, шины, мусор, кровь, лужи ----------
	for (let i = 0; i < 18; i++) {
		const x = R(-45, 45), z = R(-45, 45);
		if (navProbe.blockedAt(x, z, 0.8) || indoors(x, z)) continue;
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
	for (let i = 0; i < 26; i++) {
		const blood = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: T.bloodDecalTexture(i % 5), transparent: true, depthWrite: false, roughness: 0.3 }));
		blood.rotation.x = -Math.PI / 2; blood.rotation.z = R(0, 6.28);
		const s = R(0.8, 2.6);
		blood.scale.set(s, s, 1);
		blood.position.set(R(-44, 44), 0.03, R(-44, 44));
		if (!indoors(blood.position.x, blood.position.z, s)) decals.add(blood);
	}
	for (let i = 0; i < 14; i++) {
		const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshStandardMaterial({ color: 0x3a4044, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.55, envMapIntensity: 2.5 }));
		puddle.rotation.x = -Math.PI / 2;
		puddle.scale.set(R(0.8, 2.4), R(0.5, 1.4), 1);
		const onRoad = rnd() < 0.6;
		puddle.position.set(R(-45, 45), 0.028, onRoad ? R(3, 9) : R(-44, 44));
		if (!indoors(puddle.position.x, puddle.position.z, 2.4)) decals.add(puddle);
	}
	root.add(decals);

	// ---------- Трава ----------
	if (quality !== 'low') grassTufts(root, navProbe, rnd, quality === 'high' ? 2600 : 1200, indoors);

	// ---------- Муть по краям кластера ----------
	const fog = fogWalls(root);

	batch.build(root);
	const nav = makeNav(colliders);
	return {
		root, colliders, nav, buildings,
		containers: buildings.flatMap((b) => b.containers),
		playerStart: new THREE.Vector3(42, 0, 6), // на восточном конце трассы, у края кластера
		update(dt, t) { fog.update(dt, t); },
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
		edgeSpawn(avoid, minDist = 22) {
			for (let i = 0; i < 60; i++) {
				const side = Math.floor(Math.random() * 4), a = (Math.random() * 2 - 1) * 44;
				const x = side === 0 ? -45.5 : side === 1 ? 45.5 : a;
				const z = side === 2 ? -45.5 : side === 3 ? 45.5 : a;
				if (nav.blockedAt(x, z, 0.6)) continue;
				if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < minDist) continue;
				return new THREE.Vector3(x, 0, z);
			}
			return new THREE.Vector3(-45, 0, 6);
		},
	};
}

// ---------- Постройки и предметы ----------

function bench(batch, M, x, z, ry) {
	batch.add(place(box(1.6, 0.06, 0.4), x, 0.45, z, ry), M.woodGreen);
	batch.add(place(box(1.6, 0.35, 0.05), x, 0.7, z + 0.18, ry), M.woodGreen);
	for (const dx of [-0.65, 0.65]) batch.add(place(box(0.06, 0.45, 0.4), x + dx, 0.22, z, ry), M.metalDark);
}

function swings(batch, M, x, z) {
	for (const dx of [-1.6, 1.6]) for (const dz of [-0.6, 0.6]) batch.add(place(box(0.08, 2.4, 0.08), x + dx, 1.2, z + dz * 0.9, 0, dz * 0.25), M.metalRust);
	batch.add(place(box(3.4, 0.08, 0.08), x, 2.35, z), M.metalRust);
	for (const dx of [-0.7, 0.7]) {
		batch.add(place(box(0.5, 0.05, 0.25), x + dx, 0.5, z), M.wood);
		for (const s of [-0.22, 0.22]) batch.add(place(box(0.02, 1.85, 0.02), x + dx + s, 1.42, z), M.metalDark);
	}
}

function slide(batch, M, x, z) {
	batch.add(place(box(1, 1.6, 1, 1), x, 0.8, z), M.metalRust);
	batch.add(place(box(0.7, 0.05, 3.2), x, 0.85, z - 1.9, 0, 0.5), M.yellow);
}

function streetLamp(batch, M, collide, x, z) {
	batch.add(place(box(0.22, 7, 0.22, 1, 3), x, 3.5, z), M.concrete);
	batch.add(place(box(0.1, 0.1, 1.7), x, 6.85, z - 0.8, 0, -0.12), M.metalDark);
	batch.add(place(box(0.32, 0.14, 0.55), x, 6.75, z - 1.65), M.metalDark);
	batch.add(place(box(0.24, 0.04, 0.42), x, 6.67, z - 1.65), new THREE.MeshStandardMaterial({ color: 0xbfc4b8, roughness: 0.3 }));
	collide(x, z, 0.4, 0.4);
}

/** Баррикада поперёк трассы: бетонные блоки и мешки с песком, посередине проход. */
function barricade(batch, M, collide, x, rnd) {
	const bags = new THREE.MeshStandardMaterial({ color: 0x8a7e5c, roughness: 1 });
	for (const [z0, z1] of [[2.2, 4.6], [7.6, 10.0]]) {
		const zc = (z0 + z1) / 2, len = z1 - z0;
		batch.add(place(box(0.6, 0.6, len, 1), x, 0.3, zc), M.concreteDark);
		batch.add(place(box(0.6, 0.6, len * 0.7, 1), x, 0.9, zc + (rnd() - 0.5) * 0.4), M.concrete);
		for (let k = 0; k < Math.floor(len / 0.5); k++) {
			batch.add(place(new THREE.SphereGeometry(0.28, 8, 6).scale(1, 0.5, 1.6), x + 0.62, 0.14, z0 + 0.25 + k * 0.5, rnd() * 0.3), bags);
			if (k % 2 === 0) batch.add(place(new THREE.SphereGeometry(0.28, 8, 6).scale(1, 0.5, 1.6), x + 0.62, 0.4, z0 + 0.5 + k * 0.5, rnd() * 0.3), bags);
		}
		collide(x + 0.3, zc, 1.3, len);
	}
	// опрокинутый шлагбаум у прохода
	batch.add(place(box(0.08, 0.08, 3.2), x - 1.1, 0.06, 6.1, 0.4), M.red);
}

/** Огород: грядки с ботвой (по ним можно ходить). */
function garden(batch, M, rnd, x, z, rows, len) {
	const leaf = M.leaves, soil = M.dirt;
	for (let r = 0; r < rows; r++) {
		const rx = x + (r - (rows - 1) / 2) * 0.95;
		batch.add(place(box(0.65, 0.14, len, 1), rx, 0.07, z), soil, { cast: false });
		for (let k = 0.4; k < len - 0.3; k += 0.45) {
			if (rnd() < 0.15) continue;
			const sz = 0.16 + rnd() * 0.1;
			batch.add(place(new THREE.IcosahedronGeometry(sz, 0).scale(1, 0.8, 1), rx + (rnd() - 0.5) * 0.15, 0.2, z - len / 2 + k, rnd() * 3), leaf);
		}
	}
}

function woodpile(batch, M, collide, x, z, ry) {
	const log = M.bark;
	const c = Math.cos(ry), s = Math.sin(ry);
	for (let row = 0; row < 4; row++) for (let i = 0; i < 9 - row; i++) {
		const lx = -1.1 + i * 0.26 + row * 0.13, y = 0.13 + row * 0.22;
		const g = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 7).rotateX(Math.PI / 2);
		batch.add(place(g, x + lx * c, y, z - lx * s, ry), log);
	}
	batch.add(place(box(2.6, 0.06, 0.8, 2), x, 1.05, z, ry, 0.15), M.roofMetal); // навес
	collide(x, z, 2.5, 0.7, ry);
}

function outhouse(batch, M, collide, x, z, ry) {
	batch.add(place(box(1.1, 2.1, 1.1, 1.2), x, 1.05, z, ry), M.woodGrey);
	batch.add(place(box(1.3, 0.06, 1.4, 1), x, 2.2, z, ry, 0.12), M.roofMetal);
	const c = Math.cos(ry), s = Math.sin(ry);
	batch.add(place(box(0.8, 1.8, 0.04), x + 0.57 * s, 0.95, z + 0.57 * c, ry), M.wood); // дверь
	collide(x, z, 1.2, 1.2, ry);
}

/** Бельё на верёвке между двумя столбами. */
function clothesline(batch, M, root, collide, x0, x1, z, rnd) {
	for (const x of [x0, x1]) { batch.add(place(box(0.08, 2.0, 0.08), x, 1.0, z), M.wood); collide(x, z, 0.2, 0.2); }
	const pts = [];
	for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, 1.9 - Math.sin(Math.PI * t) * 0.18, z)); }
	root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a3a36 })));
	const colors = [0xb8b4a8, 0x6a7fa0, 0xa05048, 0xc8b878, 0x8a9a7a];
	for (let i = 0; i < 5; i++) {
		const t = 0.15 + i * 0.17, w = 0.5 + rnd() * 0.4, h = 0.5 + rnd() * 0.35;
		const cloth = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 1, side: THREE.DoubleSide });
		batch.add(place(new THREE.PlaneGeometry(w, h), x0 + (x1 - x0) * t, 1.9 - Math.sin(Math.PI * t) * 0.18 - h / 2, z, rnd() * 0.3 - 0.15), cloth);
	}
}

function bicycle(batch, M, x, z, ry) {
	for (const dx of [-0.52, 0.52]) batch.add(place(new THREE.TorusGeometry(0.33, 0.025, 6, 20).rotateX(Math.PI / 2), x + dx * Math.cos(ry), 0.03, z - dx * Math.sin(ry)), M.tire);
	batch.add(place(box(1.05, 0.04, 0.04), x, 0.05, z, ry), M.red);
	batch.add(place(box(0.04, 0.04, 0.45), x - 0.15 * Math.cos(ry), 0.05, z + 0.15 * Math.sin(ry), ry), M.metalDark);
}

function settlementSign(batch, M, root, collide, x, z, text) {
	for (const dx of [-1.0, 1.0]) batch.add(place(box(0.07, 2.4, 0.07), x + dx, 1.2, z), M.metalDark);
	// надпись к камере (она смотрит с юга), сзади — жесть
	const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), T.signMaterial(text, { bg: '#f0efe6', fg: '#1a1a1a' }));
	sign.position.set(x, 2.05, z + 0.04);
	root.add(sign);
	const back = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), M.metalDark);
	back.position.set(x, 2.05, z);
	back.rotation.y = Math.PI;
	root.add(back);
	collide(x, z, 2.2, 0.2);
}

function fencePlot(batch, M, collide, cx, cz, W, D, gateSide, rnd) {
	const seg = (x0, z0, x1, z1, gateAt) => {
		const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
		const n = Math.ceil(len / 2);
		for (let i = 0; i < n; i++) {
			const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
			if (gateAt !== undefined && Math.abs(tm - gateAt) < 0.12) continue; // калитка
			if (rnd() < 0.08) continue; // упавший пролёт
			const x = x0 + (x1 - x0) * tm, z = z0 + (z1 - z0) * tm;
			const tilt = (rnd() - 0.5) * 0.12;
			batch.add(place(box(len / n, 1.6, 0.05, 1, 1.6), x, 0.8, z, -ang, 0, tilt), M.woodGrey);
			batch.add(place(box(0.1, 1.8, 0.1), x0 + (x1 - x0) * t0, 0.9, z0 + (z1 - z0) * t0), M.wood);
			collide(x, z, len / n, 0.2, -ang);
		}
	};
	const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
	seg(x0, z0, x1, z0, gateSide === 'n' ? 0.75 : undefined);
	seg(x1, z0, x1, z1, gateSide === 'e' ? 0.5 : undefined);
	seg(x1, z1, x0, z1, gateSide === 's' ? 0.25 : undefined);
	seg(x0, z1, x0, z0, gateSide === 'w' ? 0.5 : undefined);
}

function shed(batch, M, collide, x, z, ry) {
	batch.add(place(box(2.6, 2.2, 2.2, 1.2), x, 1.1, z, ry), M.woodGrey);
	batch.add(place(box(3, 0.08, 2.6, 2), x, 2.3, z, ry, 0, 0.12), M.roofMetal);
	collide(x, z, 2.7, 2.3, ry);
}

function well(batch, M, collide, x, z) {
	batch.add(place(box(1.2, 0.9, 1.2, 1), x, 0.45, z), M.wood);
	for (const dx of [-0.55, 0.55]) batch.add(place(box(0.1, 1.8, 0.1), x + dx, 0.9, z), M.wood);
	batch.add(place(box(1.5, 0.06, 1.0, 1), x, 1.9, z, 0, 0.4), M.slate);
	batch.add(place(box(1.5, 0.06, 1.0, 1), x, 1.9, z, 0, -0.4), M.slate);
	collide(x, z, 1.3, 1.3);
}

/** Легковушка «жигули» из выдавленного силуэта. */
function addCar(batch, M, root, x, z, ry, color, { crashed = false, burned = false } = {}) {
	const paint = burned
		? new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.95 })
		: T.metalRoofMaterial([1, 1], [((color >> 16) & 255), ((color >> 8) & 255), (color & 255)]);
	paint.metalness = burned ? 0.1 : 0.35; paint.roughness = burned ? 0.95 : 0.55;
	const body = new THREE.Shape();
	body.moveTo(-2.05, 0.25); body.lineTo(2.05, 0.25); body.lineTo(2.1, 0.75); body.lineTo(1.2, 0.85);
	body.lineTo(-1.9, 0.85); body.lineTo(-2.1, 0.75); body.closePath();
	const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 1.62, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
	bodyGeo.translate(0, 0, -0.81);
	const cab = new THREE.Shape();
	cab.moveTo(-1.35, 0.85); cab.lineTo(0.9, 0.85); cab.lineTo(0.35, 1.38); cab.lineTo(-1.05, 1.38); cab.closePath();
	const cabGeo = new THREE.ExtrudeGeometry(cab, { depth: 1.42, bevelEnabled: false });
	cabGeo.translate(0, 0, -0.71);
	const roof = place(box(1.45, 0.06, 1.46), -0.35, 1.4, 0);
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, crashed ? 0.06 : 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, crashed ? 0.08 : 0)), new THREE.Vector3(1, 1, 1));
	const group = new THREE.Group();
	const mk = (g, m) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh; };
	mk(bodyGeo, paint);
	mk(cabGeo, burned ? M.metalDark : M.glass);
	mk(roof, paint);
	for (const [wx, wz] of [[-1.3, 0.72], [1.3, 0.72], [-1.3, -0.72], [1.3, -0.72]]) {
		const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), M.tire);
		wh.rotation.x = Math.PI / 2;
		wh.position.set(wx, burned ? 0.2 : 0.32, wz * 1.02);
		wh.castShadow = true;
		group.add(wh);
	}
	for (const s of [-0.55, 0.55]) {
		const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.11, 10), new THREE.MeshStandardMaterial({ color: 0xd8d4c0, roughness: 0.2 }));
		lamp.position.set(2.13, 0.6, s); lamp.rotation.y = Math.PI / 2;
		group.add(lamp);
	}
	group.applyMatrix4(tf);
	root.add(group);
	if (crashed) {
		// смятый капот и разбитое стекло — немного развернём кузов
		group.children[0].scale.x = 0.96;
	}
}

function bus(batch, M, root, x, z, ry) {
	const g = new THREE.Group();
	const paint = T.metalRoofMaterial([1, 1], [190, 168, 90]);
	paint.metalness = 0.3;
	const body = new THREE.Mesh(box(2.4, 1.3, 7.6, 2), paint);
	body.position.y = 1.0;
	const top = new THREE.Mesh(box(2.3, 0.9, 7.2, 2), M.glass);
	top.position.y = 2.1;
	const roof = new THREE.Mesh(box(2.4, 0.15, 7.4, 2), new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.6 }));
	roof.position.y = 2.6;
	for (const m of [body, top, roof]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
	for (let i = -2; i <= 2; i++) {
		const pillar = new THREE.Mesh(box(2.35, 0.9, 0.12), paint);
		pillar.position.set(0, 2.1, i * 1.5);
		g.add(pillar);
	}
	for (const [wx, wz] of [[-1.1, 2.6], [1.1, 2.6], [-1.1, -2.6], [1.1, -2.6]]) {
		const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14), M.tire);
		wh.rotation.z = Math.PI / 2; wh.position.set(wx, 0.45, wz);
		g.add(wh);
	}
	g.position.set(x, 0, z); g.rotation.y = ry;
	root.add(g);
}

function birchMaterial() {
	const c = document.createElement('canvas');
	c.width = 64; c.height = 256;
	const ctx = c.getContext('2d');
	ctx.fillStyle = '#e4e0d4'; ctx.fillRect(0, 0, 64, 256);
	for (let i = 0; i < 40; i++) {
		ctx.fillStyle = `rgba(30,28,26,${0.5 + Math.random() * 0.5})`;
		ctx.fillRect(Math.random() * 64, Math.random() * 256, 6 + Math.random() * 20, 1 + Math.random() * 4);
	}
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.colorSpace = THREE.SRGBColorSpace;
	return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
}

function blob(r, detail, seed) {
	const g = new THREE.IcosahedronGeometry(r, detail);
	const p = g.attributes.position;
	const rnd = T.mulberry(seed);
	const offs = Array.from({ length: 6 }, () => [rnd() * 6, rnd() * 6, rnd() * 6]);
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		const n = offs.reduce((s, o) => s + Math.sin(x * 2.3 + o[0]) * Math.sin(y * 2.1 + o[1]) * Math.sin(z * 2.7 + o[2]), 0) / 6;
		const k = 1 + n * 0.5;
		p.setXYZ(i, x * k, y * k * 0.85, z * k);
	}
	g.computeVertexNormals();
	return g;
}

function buildTrees(root, trees, M) {
	const crowns = [];
	const variants = {
		birch: () => {
			const trunk = place(new THREE.CylinderGeometry(0.12, 0.2, 7, 7), 0, 3.5, 0);
			const crowns = [];
			for (let i = 0; i < 4; i++) crowns.push(place(blob(1.5, 1, i + 3), Math.sin(i * 2) * 0.8, 5.2 + i * 0.7, Math.cos(i * 2) * 0.8));
			return { trunk, trunkMat: M.birch, crown: mergeGeometries(crowns), crownMat: M.leaves };
		},
		apple: () => {
			const trunk = place(new THREE.CylinderGeometry(0.12, 0.18, 2.2, 6), 0, 1.1, 0);
			return { trunk, trunkMat: M.bark, crown: place(blob(1.8, 1, 11), 0, 3, 0), crownMat: M.leavesDry };
		},
		pine: () => {
			const trunk = place(new THREE.CylinderGeometry(0.15, 0.25, 9, 6), 0, 4.5, 0);
			const cones = [0, 1, 2, 3].map((i) => place(new THREE.ConeGeometry(2.2 - i * 0.45, 3, 8), 0, 4 + i * 1.6, 0));
			return { trunk, trunkMat: M.bark, crown: mergeGeometries(cones), crownMat: M.pine };
		},
	};
	for (const [kind, make] of Object.entries(variants)) {
		const list = trees.filter((t) => t.kind === kind);
		if (!list.length) continue;
		const v = make();
		const trunk = new THREE.InstancedMesh(v.trunk, v.trunkMat, list.length);
		const crown = new THREE.InstancedMesh(v.crown, v.crownMat, list.length);
		const m = new THREE.Matrix4();
		list.forEach((t, i) => {
			m.compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.r, 0)), new THREE.Vector3(t.s, t.s * (0.9 + (i % 3) * 0.08), t.s));
			trunk.setMatrixAt(i, m);
			crown.setMatrixAt(i, m);
		});
		for (const im of [trunk, crown]) { im.castShadow = true; im.receiveShadow = true; root.add(im); }
		crowns.push({ mesh: crown, list, matrix: new THREE.Matrix4() });
	}
	return crowns;
}

function grassTufts(root, nav, rnd, count, indoors) {
	const c = document.createElement('canvas');
	c.width = 64; c.height = 64;
	const ctx = c.getContext('2d');
	for (let i = 0; i < 26; i++) {
		const x = 6 + rnd() * 52, h = 30 + rnd() * 30;
		ctx.strokeStyle = `rgb(${90 + rnd() * 50},${100 + rnd() * 40},${50 + rnd() * 20})`;
		ctx.lineWidth = 2 + rnd() * 2;
		ctx.beginPath(); ctx.moveTo(x, 64); ctx.quadraticCurveTo(x + (rnd() - 0.5) * 10, 64 - h / 2, x + (rnd() - 0.5) * 20, 64 - h); ctx.stroke();
	}
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
	const g1 = new THREE.PlaneGeometry(0.7, 0.45).translate(0, 0.22, 0);
	const g = mergeGeometries([g1, g1.clone().rotateY(Math.PI / 2)]);
	const im = new THREE.InstancedMesh(g, mat, count);
	const m = new THREE.Matrix4();
	let n = 0;
	for (let i = 0; i < count * 2 && n < count; i++) {
		const x = (rnd() * 2 - 1) * 48, z = (rnd() * 2 - 1) * 48;
		if (Math.abs(z - 6) < 5.5 || (Math.abs(x - 12) < 3.5 && z < 3)) continue;
		if (nav.blockedAt(x, z, 0.5) || indoors(x, z, 0.4)) continue;
		const s = 0.6 + rnd() * 0.9;
		m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 3, 0)), new THREE.Vector3(s, s, s));
		im.setMatrixAt(n++, m);
	}
	im.count = n;
	im.receiveShadow = true;
	root.add(im);
}

function markingMaterial() {
	const t = T.roadMarkingTexture();
	return new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.8 });
}

function fogWalls(root) {
	const tex = T.fogWallTexture();
	const mats = [];
	const group = new THREE.Group();
	for (let side = 0; side < 4; side++) {
		for (let layer = 0; layer < 3; layer++) {
			const t = tex.clone();
			t.needsUpdate = true;
			t.repeat.set(3, 1);
			const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55 + layer * 0.15, depthWrite: false, color: 0x6a7068, fog: false, side: THREE.DoubleSide });
			mats.push({ m, speed: (0.004 + layer * 0.003) * (side % 2 ? -1 : 1) });
			const plane = new THREE.Mesh(new THREE.PlaneGeometry(130, 26), m);
			const d = HALF - 3 + layer * 2.5;
			plane.position.y = 11;
			if (side === 0) { plane.position.z = -d; }
			if (side === 1) { plane.position.z = d; plane.rotation.y = Math.PI; }
			if (side === 2) { plane.position.x = -d; plane.rotation.y = Math.PI / 2; }
			if (side === 3) { plane.position.x = d; plane.rotation.y = -Math.PI / 2; }
			group.add(plane);
		}
	}
	// темнеющая земля у мути
	const ring = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.ShaderMaterial({
		transparent: true, depthWrite: false,
		uniforms: { color: { value: new THREE.Color(0x2a2e2a) } },
		vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
		fragmentShader: 'uniform vec3 color; varying vec2 vP; void main(){ float d = max(abs(vP.x), abs(vP.y)); gl_FragColor = vec4(color, smoothstep(40.0, 49.0, d) * 0.92); }',
	}));
	ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
	group.add(ring);
	root.add(group);
	return {
		update(dt) {
			for (const { m, speed } of mats) m.map.offset.x += speed * dt * 10;
		},
	};
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
