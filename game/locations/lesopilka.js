// Кластер «Лесопилка»: лесопилка «Кедр» у реки на окраине Улья. Вдоль западного края течёт река (по воде не
// пройти): у берега — бон и сплавные брёвна, бревнотаска поднимает их под навес пилорамы (рама, тележки на рельсах).
// Рядом — цех (станки, верстак, шкафчики, конторка мастера с сейфом), на севере — склад круглого леса: штабеля
// брёвен; на юге — штабеля досок под листами железа, кучи опилок, печь для отходов, мостки с лодкой. Через двор
// проходит грунтовка: на юг (к Дачам) и на север (к «Карьеру»). У дороги — контора (оружейный шкаф сторожа,
// сейф), навес с трактором и прицепом-роспуском, лесовоз; за дорогой — посёлок рабочих: барак и два дома
// с огородами. Кругом сосновый лес, на востоке — пожарная вышка.
// Опасность 1: тихая окраина — бегуны, один-два топтуна.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place } from '../geom.js';
import { buildWorkshop, buildArmyBarracks, buildHouse, buildGuardhouse } from '../buildings.js';
import { addCar, fencePlot, woodpile, outhouse, well, shed, garden, transformer, bench } from '../props.js';
import { armyTruck, watchTower, storageTank, billboard } from '../props-industrial.js';

// река вдоль западного края: середина и полуширина русла по z (берег всегда западнее x = −56,7 — дальний берег
// за водой недостижим, туда не попадают бродячие стаи)
const riverX = (z) => -51 + 1.5 * Math.sin(z / 16 + 0.6);
const riverHW = (z) => 8 + 0.8 * Math.sin(z / 21 + 1.7);
const bankL = (z) => riverX(z) - riverHW(z);
const bankR = (z) => riverX(z) + riverHW(z);
const PIER_Z = 35; // мостки: полоса z 34…36 (как одна полоса коллайдеров реки)
const PIER_LEN = 7.5;

/** Лента вдоль z между линиями left(z) и right(z) на высоте y; развёртка — в метрах / s (вода, берега). */
function ribbon(left, right, y, s, z0 = -72, z1 = 72, step = 2) {
	const pos = [], uv = [], nrm = [], idx = [];
	for (let z = z0, i = 0; z <= z1 + 1e-6; z += step, i++) {
		const a = left(z), b = right(z);
		pos.push(a, y, z, b, y, z);
		uv.push(a / s, -z / s, b / s, -z / s);
		nrm.push(0, 1, 0, 0, 1, 0);
		if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	return g;
}

/** Колёсный трактор («Беларус»): красный капот и крыша кабины, большие задние колёса. Перед — локальная +X. */
function tractor(batch, M, collide, x, z, ry) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(3.0, 0.45, 0.9), M.metalDark, 0.2, 0.75, 0); // рама
	add(box(1.7, 0.75, 0.95, 1.2), M.red, 0.85, 1.32, 0); // капот
	add(box(0.1, 0.5, 0.8), M.metalDark, 1.72, 1.25, 0); // решётка радиатора
	add(box(1.25, 1.2, 1.35), M.metalDark, -0.75, 2.1, 0); // кабина (стёкла сверху — тёмные)
	add(box(1.45, 0.1, 1.55), M.red, -0.75, 2.75, 0); // крыша кабины
	for (const s of [-1, 1]) {
		add(new THREE.CylinderGeometry(0.78, 0.78, 0.45, 16).rotateX(Math.PI / 2), M.tire, -0.75, 0.78, s * 0.98);
		add(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 12).rotateX(Math.PI / 2), M.tire, 1.25, 0.45, s * 0.72);
		add(box(1.4, 0.06, 0.5), M.red, -0.75, 1.62, s * 0.98); // крылья над задними колёсами
	}
	add(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), M.metalDark, 1.3, 2.1, 0.32); // выхлопная труба
	collide(x, z, 3.7, 2.5, ry);
}

export default {
	id: 'lesopilka',
	seed: 3302,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		M.guardSign = T.signMaterial('КОНТОРА', { bg: '#2a2c26', fg: '#e8dcae' });

		// ---------- Река: вода, берега, тростник; по воде не пройти (коллайдеры полосами по 2 м) ----------
		batch.add(ribbon(bankL, bankR, 0.04, 18), M.water, { cast: false });
		batch.add(ribbon((z) => bankR(z) - 0.6, (z) => bankR(z) + 3.2, 0.016, 4), M.dirt, { cast: false });
		batch.add(ribbon((z) => bankL(z) - 4, (z) => bankL(z) + 0.6, 0.016, 4), M.dirt, { cast: false });
		const pierEnd = bankR(PIER_Z) - PIER_LEN;
		for (let z0 = -66; z0 < 66; z0 += 2) {
			const xl = Math.min(bankL(z0), bankL(z0 + 2)) - 0.2;
			const xr = z0 === PIER_Z - 1 ? pierEnd - 0.3 : Math.min(bankR(z0), bankR(z0 + 2)) - 0.6;
			collide((xl + xr) / 2, z0 + 1, xr - xl, 2);
		}
		for (let i = 0; i < 70; i++) {
			const z = R(-64, 64), east = rnd() < 0.6;
			if (Math.abs(z - PIER_Z) < 3 || (east && Math.abs(z) < 12)) continue; // у мостков и у бревнотаски — чисто
			const x = east ? bankR(z) + R(-0.7, 0.2) : bankL(z) + R(-0.2, 0.7);
			for (let k = 0; k < 3; k++) {
				batch.add(place(new THREE.ConeGeometry(0.05, 0.9 + rnd() * 0.7, 4), x + R(-0.3, 0.3), 0.5, z + R(-0.4, 0.4), 0, R(-0.15, 0.15), R(-0.15, 0.15)), M.leavesDry);
			}
		}
		// мостки с лодкой
		{
			const x0 = pierEnd, x1 = bankR(PIER_Z) + 0.6, len = x1 - x0;
			batch.add(place(box(len, 0.12, 1.8, 1.2), (x0 + x1) / 2, 0.35, PIER_Z), M.woodGrey);
			for (let x = x0 + 0.3; x < x1 - 0.5; x += 1.8) for (const dz of [-0.8, 0.8]) batch.add(place(box(0.14, 0.6, 0.14), x, 0.1, PIER_Z + dz), M.wood);
			const bx = x0 + 3.2, bz = PIER_Z + 2.3;
			batch.add(place(box(3.0, 0.4, 1.1, 1.2), bx, 0.2, bz, 0.08), M.woodGreen); // лодка
			batch.add(place(box(0.78, 0.38, 0.78), bx + 1.55, 0.2, bz - 0.12, Math.PI / 4 + 0.08), M.woodGreen);
			for (const dx of [-0.7, 0.5]) batch.add(place(box(0.25, 0.05, 1.0), bx + dx, 0.42, bz, 0.08), M.wood);
		}
		// сплавные брёвна у берега и бон из брёвен
		for (let i = 0; i < 12; i++) {
			const z = R(-8, 7), x = bankR(z) - R(1.6, 7);
			batch.add(place(new THREE.CylinderGeometry(0.25, 0.25, R(3.5, 5.5), 8).rotateZ(Math.PI / 2), x, 0.06, z, R(-0.5, 0.5)), M.bark);
		}
		{
			const pts = [[bankR(-11) - 0.5, -11], [bankR(-11) - 8.5, -9], [bankR(9) - 8.5, 9], [bankR(11) - 0.5, 11]];
			for (let k = 1; k < pts.length; k++) {
				const [ax, az] = pts[k - 1], [bx, bz] = pts[k], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 4);
				for (let j = 0; j < n; j++) {
					const t = (j + 0.5) / n;
					batch.add(place(new THREE.CylinderGeometry(0.22, 0.22, len / n - 0.15, 8).rotateZ(Math.PI / 2), ax + (bx - ax) * t, 0.05, az + (bz - az) * t, -Math.atan2(bz - az, bx - ax)), M.bark);
				}
			}
		}

		// ---------- Дороги и двор ----------
		ground(6, 54, 6, 43, M.dirt, 4, 0.02); // на юг, к Дачам (z 16…70)
		ground(6, 56, 0, -42, M.dirt, 4, 0.02); // на север, к «Карьеру» (z −70…−14)
		ground(34, 30, -4, 1, M.dirt, 5, 0.014); // двор лесопилки
		ground(38, 4, 27, 37.5, M.dirt, 4, 0.018); // улица посёлка
		ground(24, 14, 22, -26, M.dirt, 4, 0.016); // площадка у навеса с техникой
		ground(8, 5, 6.5, -26, M.dirt, 4, 0.017);
		ground(20, 16, -12, 35, M.dirt, 4, 0.015); // склад досок
		ground(14, 34, -27, -24, M.dirt, 4, 0.013); // склад круглого леса
		ground(14, 12, -27, 0, M.dirt, 4, 0.015); // под навесом пилорамы
		const roads = [[3, 9, 16, 70], [-3, 3, -70, -14], [-21, 13, -14, 16], [8, 46, 35.5, 39.5], [24, 28, 39.5, 45.5], [42, 46, 39.5, 45.5], [2.5, 34, -33, -19], [-50, -42, 34, 36], [-35, -19, -6, 6], [-22, -2, 27, 43]];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

		// ---------- Навес пилорамы: рама, тележки на рельсах; бревнотаска от реки ----------
		occluder('SawShed', (kb) => {
			// односкатная крыша: столбы доходят до неё (к востоку — выше)
			for (const x of [-34, -27, -20]) for (const z of [-5, 5]) { const h = 4.27 + (x + 27) * 0.06; kb.add(place(box(0.3, h, 0.3), x, h / 2, z), M.wood); }
			kb.add(place(box(15.2, 0.15, 11.2, 2), -27, 4.35, 0, 0, 0, 0.06), M.roofMetal);
		}, { cx: -27, cz: 0, ry: 0, hx: 7.6, hz: 5.6, top: 4.6 }, 0.15);
		for (const x of [-34, -27, -20]) for (const z of [-5, 5]) collide(x, z, 0.35, 0.35);
		for (const dz of [-0.55, 0.55]) batch.add(place(box(14, 0.12, 0.08), -27, 0.18, dz), M.rail, { cast: false });
		for (let x = -33.6; x < -20; x += 0.9) batch.add(place(box(0.2, 0.1, 1.6), x, 0.06, 0), M.sleeper, { cast: false });
		// пилорамная рама: станина, стойки, верхняя балка, полотна пил
		batch.add(place(box(1.3, 0.6, 2.6), -27, 0.3, 0), M.green);
		for (const dz of [-1.0, 1.0]) batch.add(place(box(0.3, 2.9, 0.3), -27, 1.45, dz), M.green);
		batch.add(place(box(0.5, 0.5, 2.4), -27, 2.75, 0), M.green);
		for (const dz of [-0.3, -0.1, 0.1, 0.3]) batch.add(place(box(0.04, 1.6, 0.02), -27, 1.4, dz), M.metalDark);
		batch.add(place(new THREE.ConeGeometry(1.2, 0.5, 10), -27, 0.25, -2.6), M.woodYellow); // опилки
		collide(-27, 0, 1.5, 2.7);
		// тележки: с бревном (к раме) и с брусом (после рамы)
		batch.add(place(box(1.4, 0.35, 1.2), -31.6, 0.42, 0), M.metalRust);
		batch.add(place(new THREE.CylinderGeometry(0.32, 0.3, 5.2, 10).rotateZ(Math.PI / 2), -31.2, 0.95, 0), M.bark);
		collide(-31.4, 0, 5.2, 1.3);
		batch.add(place(box(1.4, 0.35, 1.2), -23, 0.42, 0), M.metalRust);
		for (const [dy, dz] of [[0.75, -0.18], [0.75, 0.18], [1.05, 0]]) batch.add(place(box(4.2, 0.3, 0.3), -23, dy, dz), M.woodYellow);
		collide(-23, 0, 4.4, 1.3);
		// бревнотаска: наклонный жёлоб от воды под навес
		{
			const rz = Math.atan2(1.3, 11.5);
			batch.add(place(box(12.2, 0.25, 1.1), -40.3, 0.42, 0, 0, 0, rz), M.metalRust);
			for (const dz of [-0.6, 0.6]) batch.add(place(box(12.2, 0.12, 0.08), -40.3, 0.62, dz, 0, 0, rz), M.metalDark);
			for (const x of [-39, -36]) { const h = 0.42 + (x + 40.3) * Math.tan(rz) - 0.12; batch.add(place(box(0.2, h, 0.2), x, h / 2, 0), M.metalDark); }
			batch.add(place(new THREE.CylinderGeometry(0.3, 0.3, 4.6, 10).rotateZ(Math.PI / 2 + rz), -39, 0.95, 0), M.bark);
			collide(-38.2, 0, 7.8, 1.4);
		}

		// ---------- Цех лесопилки (можно зайти) ----------
		buildings.push(buildWorkshop(bctx, { name: 'Sawmill', cx: -24, cz: 18, ry: 0 }));
		transformer(batch, root, M, collide, -6, 21);

		// ---------- Склад круглого леса: штабеля брёвен между стойками ----------
		const logStack = (x, z, ry, len, rows, per) => {
			for (let r = 0; r < rows; r++) {
				const n = per - r;
				for (let i = 0; i < n; i++) {
					const rad = R(0.2, 0.27), lz = (i - (n - 1) / 2) * 0.5, y = 0.25 + r * 0.43;
					const g = new THREE.CylinderGeometry(rad, rad * 1.08, len + R(-0.5, 0.3), 8).rotateZ(Math.PI / 2).translate(R(-0.25, 0.25), y, lz);
					batch.add(place(g, x, 0, z, ry), M.bark);
				}
			}
			const h = rows * 0.43 + 0.25;
			for (const sx of [-len / 2 + 0.7, len / 2 - 0.7]) for (const sz of [-1, 1]) {
				batch.add(place(box(0.14, h, 0.14).translate(sx, h / 2, sz * (per * 0.25 + 0.1)), x, 0, z, ry), M.wood);
			}
			collide(x, z, len + 0.4, per * 0.5 + 0.4, ry);
		};
		for (const [x, z] of [[-33, -16], [-33, -23], [-33, -30], [-20, -16], [-20, -23], [-20, -30]]) logStack(x, z, R(-0.04, 0.04), 8, 4, 7);
		logStack(-8, -21, Math.PI / 2 + 0.03, 7, 3, 6);
		logStack(-27, -40, 0.25, 6, 2, 5);
		// куча брёвен вперемешку
		for (let i = 0; i < 9; i++) {
			batch.add(place(new THREE.CylinderGeometry(0.24, 0.26, R(4, 6), 8).rotateZ(Math.PI / 2), -14 + R(-1.2, 1.2), 0.25 + (i % 3) * 0.35, -38 + R(-1.2, 1.2), R(0, Math.PI)), M.bark);
		}
		collide(-14, -38, 5.2, 5.2);

		// ---------- Склад досок, опилки, печь для отходов ----------
		const boards = (x, z, ry, len = 6, w = 2.4, layers = 7) => {
			for (const sx of [-len / 2 + 0.5, 0, len / 2 - 0.5]) batch.add(place(box(0.2, 0.14, w + 0.2).translate(sx, 0.07, 0), x, 0, z, ry), M.wood); // лаги
			for (let k = 0; k < layers; k++) {
				const y = 0.22 + k * 0.22;
				batch.add(place(box(len, 0.12, w, 2).translate(0, y, 0), x, 0, z, ry), M.woodYellow);
				for (const sx of [-len / 2 + 0.5, 0, len / 2 - 0.5]) batch.add(place(box(0.08, 0.1, w + 0.08).translate(sx, y + 0.11, 0), x, 0, z, ry), M.wood); // прокладки
			}
			batch.add(place(box(len + 0.5, 0.05, w + 0.5, 2).translate(0, 0.22 + layers * 0.22 + 0.1, 0), x, 0, z, ry), M.roofMetal); // лист железа сверху
			collide(x, z, len + 0.2, w + 0.2, ry);
		};
		boards(-16, 31, 0.02); boards(-7, 31, -0.03); boards(-16, 38, 0); boards(-7, 38.4, 0.05, 5, 2.2, 5);
		for (const [x, z, r, h] of [[-35, 31, 2.6, 1.7], [-28, 34, 1.8, 1.2], [-16, 6, 1.6, 1.0]]) {
			batch.add(place(new THREE.ConeGeometry(r, h, 12), x, h / 2, z), M.woodYellow); // кучи опилок
			collide(x, z, r * 1.3, r * 1.3);
		}
		{
			const x = -30, z = 44; // печь для отходов: ржавый котёл с трубой
			batch.add(place(new THREE.CylinderGeometry(1.4, 1.6, 3.4, 14), x, 1.7, z), M.metalRust);
			batch.add(place(new THREE.ConeGeometry(1.5, 0.9, 14), x, 3.85, z), M.metalRust);
			batch.add(place(new THREE.CylinderGeometry(0.25, 0.25, 3, 8), x, 5.5, z), M.metalDark);
			batch.add(place(box(0.9, 0.9, 0.05), x, 0.7, z + 1.56), M.metalDark); // топка
			collide(x, z, 3.2, 3.2);
		}

		// ---------- Контора у дороги (можно зайти), вывеска над въездом ----------
		buildings.push(buildGuardhouse(bctx, { name: 'Office', cx: 17, cz: 4, ry: Math.PI / 2 }));
		bench(batch, M, 13.4, 1.6, -Math.PI / 2);
		billboard(batch, M, root, collide, 6, 48, 0, 'ЛЕСОПИЛКА «КЕДР»', { w: 7.6, h: 0.9, y: 4.2, bg: '#2a2c26', fg: '#e8dcae' });
		addCar(batch, M, root, 10.6, 10.4, 0.15, 0x5a6a3a);
		collide(10.6, 10.4, 4.3, 1.8, 0.15);

		// ---------- Навес с техникой: трактор, прицеп-роспуск с брёвнами; лесовоз у дороги ----------
		occluder('MachineShed', (kb) => {
			for (const x of [14, 22, 30]) for (const z of [-30, -22]) { const h = 3.97 + (x - 22) * 0.04; kb.add(place(box(0.3, h, 0.3), x, h / 2, z), M.metalDark); }
			kb.add(place(box(18, 0.15, 9.2, 2), 22, 4.05, -26, 0, 0, 0.04), M.roofMetal);
		}, { cx: 22, cz: -26, ry: 0, hx: 9.2, hz: 4.8, top: 4.3 }, 0.15);
		for (const x of [14, 22, 30]) for (const z of [-30, -22]) collide(x, z, 0.35, 0.35);
		tractor(batch, M, collide, 17.6, -26, 0.04);
		{
			const x = 25.6, z = -26.2; // прицеп-роспуск: рама, две оси, коники со стойками, брёвна
			batch.add(place(box(5.6, 0.22, 0.4), x, 0.9, z), M.metalDark);
			for (const dx of [-1.9, 1.9]) {
				batch.add(place(box(0.3, 0.2, 2.2), x + dx, 1.1, z), M.metalDark);
				for (const dz of [-1.05, 1.05]) batch.add(place(box(0.12, 1.5, 0.12), x + dx, 1.9, z + dz), M.metalDark);
				for (const dz of [-0.85, 0.85]) batch.add(place(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12).rotateX(Math.PI / 2), x + dx, 0.48, z + dz), M.tire);
			}
			for (const [dy, dz] of [[1.45, -0.6], [1.45, 0], [1.45, 0.6], [1.85, -0.3], [1.85, 0.3], [2.25, 0]]) {
				batch.add(place(new THREE.CylinderGeometry(0.22, 0.24, 6.2, 8).rotateZ(Math.PI / 2), x, dy, z + dz), M.bark);
			}
			collide(x, z, 6.4, 2.4);
		}
		storageTank(batch, M, root, collide, 34.6, -20, 1.0, 2.8, M.khaki, 'ГСМ');
		armyTruck(batch, M, root, collide, 7.4, -42, Math.PI); // лесовоз у дороги, кабиной на север
		addCar(batch, M, root, 1.2, -51, Math.PI / 2 + 0.25, 0x1c1a18, { burned: true });
		collide(1.2, -51, 4.3, 1.8, Math.PI / 2 + 0.25);

		// ---------- Посёлок рабочих: барак и два дома с огородами (можно зайти) ----------
		buildings.push(
			buildArmyBarracks(bctx, { name: 'Barrack', cx: 27, cz: 24, ry: Math.PI }),
			buildHouse(bctx, { name: 'House1', cx: 22, cz: 52, ry: 0, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: 40, cz: 52, ry: 0, rnd, variant: 2 }),
		);
		// дома — подальше от барака: в кадре на телефоне не больше двух построек с мебелью
		fencePlot(batch, M, collide, 22, 52, 16, 14, 'n', rnd);
		fencePlot(batch, M, collide, 40, 52, 16, 14, 'n', rnd);
		ground(4, 6, 26, 42.5, M.dirt, 4, 0.017); // тропинки от улицы к калиткам
		ground(4, 6, 44, 42.5, M.dirt, 4, 0.017);
		garden(batch, M, rnd, 15.6, 52.5, 2, 8);
		garden(batch, M, rnd, 46, 52.5, 2, 6);
		outhouse(batch, M, collide, 28.6, 57.6, 0);
		outhouse(batch, M, collide, 33.4, 57.6, 0);
		woodpile(batch, M, collide, 22, 57.6, 0);
		shed(batch, M, collide, 46, 57.5, 0.05); // баня
		woodpile(batch, M, collide, 38.6, 24, Math.PI / 2); // у барака
		well(batch, M, collide, 12.6, 43);
		bench(batch, M, 15.6, 33.4, Math.PI / 2);
		batch.add(place(box(1.6, 0.06, 0.8), 14.6, 0.76, 29.5), M.woodGrey); // стол у барака
		for (const dx of [-0.6, 0.6]) batch.add(place(box(0.08, 0.74, 0.7), 14.6 + dx, 0.37, 29.5), M.wood);
		collide(14.6, 29.5, 1.7, 0.9);
		watchTower(batch, M, collide, 46, 8); // пожарная вышка в лесу

		return {
			start: [6, 58.5, Math.PI],
			exits: [
				{ to: 'dachi', x0: 3, x1: 9, z0: 61.2, z1: 66, spawn: [6, 58.5, Math.PI], sign: [10.6, 60.2, '↓ Дачи'] },
				{ to: 'murs', x0: -3, x1: 3, z0: -66, z1: -61.2, spawn: [0, -58.5, 0], sign: [4.6, -60.2, '↑ Карьер'] },
			],
			// заражённые: бегуны во дворе, у штабелей, у барака и домов; топтун — во дворе и у навеса с техникой
			groups: [
				{ at: [-4, 0], r: 8, runners: 3, stompers: 1 },
				{ at: [-26, -26], r: 8, runners: 3 },
				{ at: [-27, 7], r: 4, runners: 2 },
				{ at: [-24, 18], r: 6, runners: 2 }, // в цеху
				{ at: [-34, 38], r: 5, runners: 2 },
				{ at: [-11, 34], r: 6, runners: 2 },
				{ at: [14, 33], r: 5, runners: 3 },
				{ at: [31, 50], r: 7, runners: 2 },
				{ at: [11, 4], r: 4, runners: 1 },
				{ at: [22, -18], r: 6, runners: 2, stompers: 1 },
				{ at: [1, -46], r: 7, runners: 2 },
				{ at: [6, 40], r: 6, runners: 2 },
				{ at: [46, -10], r: 9, runners: 2 },
				{ at: [44, 24], r: 7, runners: 1 },
				{ at: [-14, -32], r: 6, runners: 1 },
			],
			onRoad,
			// горит машина на северной дороге, костёр у барака
			fires: [[1.2, -51, 'car'], [13.4, 25.6, 'ground']],
			water: [[riverX(0), 0, 8.6, 95]], // на плане локации — полоса реки вдоль западного края
			trees(tryTree) {
				// сосновый бор: дальний берег, восток, север и юг; берёзы — только вдоль ближнего берега (каждый вид дерева
				// на участке — лишние вызовы отрисовки); посёлок и огороды — без деревьев
				for (let i = 0; i < 70; i++) { const z = R(-62, 62); tryTree(R(-63, bankL(z) - 1.2), z, 'pine'); }
				for (let i = 0; i < 70; i++) {
					const x = R(36, 62), z = R(-62, 62);
					if (x < 49.5 && z > 17 && z < 61) continue;
					tryTree(x, z, 'pine');
				}
				for (let i = 0; i < 22; i++) tryTree(R(-40, 40), R(-62, -45), 'pine');
				for (let i = 0; i < 16; i++) { const z = R(-60, 60); tryTree(bankR(z) + R(3.5, 7), z, 'birch'); }
				for (let i = 0; i < 10; i++) tryTree(R(12, 34), R(-14, 22), 'pine');
				for (let i = 0; i < 10; i++) tryTree(R(-20, 2), R(46, 60), 'pine');
			},
			beltTrees: ['pine'],
			beltDensity: 1.2,
			clutter: 9,
			blood: 14,
			puddles: 8,
			puddle: () => [R(-36, 40), R(-60, 60)],
			grass: 1.3,
			hint: (b) => ({
				Sawmill: 'Цех лесопилки — обыщи верстак, шкафчики рабочих, аптечку и сейф мастера',
				Office: 'Контора — в оружейном шкафу сторожа бывают двустволка и патроны 12 калибра',
				Barrack: 'Барак рабочих — обыщи тумбочки у коек и шкафы в каптёрке',
			}[b.name] ?? 'Дом рабочего — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
