// Кластер «Подстанция»: электроподстанция 110/10 кВ и посёлок энергетиков, которые Улей перенёс вместе с куском трассы.
// Север — подстанция за бетонным забором с колючкой: три силовых трансформатора за бетонными перегородками,
// выключатели и порталы открытого распредустройства, ЗРУ-10 кВ, щитовая (дежурка электромонтёра с сейфом);
// от порталов на север уходит ЛЭП на решётчатой опоре. Северо-запад — склад РЭС: катушки кабеля, штабели труб,
// аварийный «Урал». Через центр — трасса: на восток к Заречному, на запад к Химмашу; на север дорога к военной части.
// Юг — посёлок энергетиков: общежитие, три дома за заборами, гаражи, трансформаторная будка, столбы 10 кВ вдоль улицы.
// Промзона средней глубины: бегуны, топтуны и один рубер, который держится у трансформаторов.
// Окраина: лес на севере и западе, остановка у трассы, сгоревшие машины.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, beginProp, endProp } from '../geom.js';
import { buildGuardhouse, buildWarehouse, buildArmyBarracks, buildHouse } from '../buildings.js';
import { addCar, bus, powerLine, transformer, fencePlot, shed, bench, swings, clothesline, markingMaterial } from '../props.js';
import { concreteFence, pipePile, hazardBarrels, armyTruck, billboard } from '../props-industrial.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Тонкий стержень от точки a до точки b (раскосы опоры ЛЭП, гирлянды изоляторов). */
function rod(batch, mat, a, b, r = 0.07, seg = 4) {
	const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
	g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
	batch.add(g, mat);
}

export default {
	id: 'podstanciya',
	seed: 1963,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// все провода — одним набором отрезков: один вызов отрисовки на всю подстанцию
		const wire = [];
		const span = (a, b, sag = 0.6, n = 8) => {
			for (let k = 0; k < n; k++) {
				const p = [k / n, (k + 1) / n].map((t) => new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t));
				wire.push(p[0], p[1]);
			}
		};

		// ---------- Трасса, дорога на север, проезды ----------
		ground(150, 8, 0, 4, M.asphalt, 5, 0.02);
		ground(150, 0.15, 0, 4, markingMaterial(), 6, 0.026);
		ground(150, 1.4, 0, 9.2, M.dirt, 3, 0.014); // обочина со стороны посёлка
		ground(6, 70, -8, -31, M.asphalt, 5, 0.022); // на север, к военной части
		ground(7, 10, 27.5, -5, M.concrete, 4, 0.018); // въезд на подстанцию
		ground(42, 38, 29, -29, M.dirt, 5, 0.013); // двор подстанции — щебёнка
		ground(6, 30, 27.5, -25, M.concrete, 4, 0.017); // проезд к трансформаторам
		ground(40, 5, 29, -19.5, M.concrete, 4, 0.0172); // вдоль трансформаторов
		ground(24, 14, -30, -6, M.concrete, 4, 0.016); // площадка склада РЭС
		ground(5, 36, 5, 27, M.dirt, 4, 0.015); // улица посёлка
		ground(46, 5, 6, 31, M.dirt, 4, 0.0152); // переулок между дворами
		ground(28, 10, 38, 17, M.asphalt, 5, 0.019); // площадка перед гаражами
		const onRoad = (x, z, m = 0) => Math.abs(z - 4) < 4.5 + m || (Math.abs(x + 8) < 3.5 + m && z < 2)
			|| (Math.abs(x - 27.5) < 3.5 + m && z < 0 && z > -40) || (Math.abs(z + 19.5) < 2.5 + m && x > 9 && x < 49)
			|| (Math.abs(x - 5) < 2.5 + m && z > 8 && z < 45) || (Math.abs(z - 31) < 2.5 + m && x > -17 && x < 29)
			|| (Math.abs(x - 38) < 14 + m && Math.abs(z - 17) < 5 + m);

		// ---------- Забор подстанции с воротами, колючка поверху ----------
		concreteFence(batch, M, collide, root, 8, -10, 24, -10);
		concreteFence(batch, M, collide, root, 31, -10, 50, -10);
		concreteFence(batch, M, collide, root, 50, -10, 50, -48);
		concreteFence(batch, M, collide, root, 8, -48, 50, -48);
		concreteFence(batch, M, collide, root, 8, -10, 8, -48);
		billboard(batch, M, root, collide, 27.5, -10, 0, 'ПС 110/10 кВ «ЗАРЕЧНАЯ»', { w: 7.4, h: 1.0, y: 4.0, bg: '#2a2c26', fg: '#e8dcae' });
		// распахнутые сетчатые створки ворот
		for (const s of [-1, 1]) batch.add(place(box(3.4, 2.1, 0.06), 27.5 + s * 4.6, 1.1, -8.7, s * 0.35), M.metalOlive);
		// таблички «Не влезай — убьёт» на заборе (к дороге)
		const danger = T.signMaterial('НЕ ВЛЕЗАЙ! УБЬЁТ', { bg: '#f0e040', fg: '#1a1a1a', w: 384, h: 128 });
		for (const x of [14, 40, 46]) batch.add(place(new THREE.PlaneGeometry(1.0, 0.34), x, 1.7, -9.89), danger, { cast: false });

		// ---------- Силовые трансформаторы за бетонными перегородками ----------
		const TZ = -25; // линия трансформаторов
		const power = (x, z) => {
			batch.add(place(box(6.2, 0.3, 4.8, 2), x, 0.15, z), M.concrete); // фундамент с маслоприёмником
			batch.add(place(box(4.2, 3.0, 2.4, 1.5), x, 1.8, z), M.tankWhite); // бак
			batch.add(place(box(4.4, 0.12, 2.6), x, 3.36, z), M.metalDark); // крышка
			for (const s of [-1, 1]) for (let i = 0; i < 9; i++) batch.add(place(box(0.06, 2.3, 0.8), x - 1.6 + i * 0.4, 1.75, z + s * 1.65), M.metalDark); // радиаторы
			// расширительный бак на стойках
			batch.add(place(new THREE.CylinderGeometry(0.42, 0.42, 2.8, 14).rotateZ(Math.PI / 2), x - 0.3, 4.15, z + 0.75), M.tankWhite);
			for (const dx of [-1.3, 0.7]) batch.add(place(box(0.1, 0.8, 0.1), x + dx, 3.75, z + 0.75), M.metalDark);
			// высоковольтные вводы — фарфоровые изоляторы с юбками (к порталам, на север)
			for (const dx of [-1.3, 0, 1.3]) {
				batch.add(place(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 8), x + dx, 4.35, z - 0.55), M.white);
				for (let k = 0; k < 4; k++) batch.add(place(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), x + dx, 3.8 + k * 0.38, z - 0.55), M.white);
			}
			batch.add(place(new THREE.PlaneGeometry(0.7, 0.24), x + 1.2, 2.2, z + 1.21), danger, { cast: false });
			collide(x, z, 5.4, 4.4);
		};
		for (const x of [18, 30, 42]) power(x, TZ);
		// бетонные перегородки между трансформаторами (от пожара)
		for (const x of [24, 36]) { batch.add(place(box(0.3, 5, 6.4, 2), x, 2.5, TZ), M.concrete); collide(x, TZ, 0.4, 6.4); }

		// ---------- Выключатели и порталы ОРУ-110 ----------
		const BZ = -33, PZ = -40;
		for (const x of [18, 30, 42]) {
			for (const dx of [-1.4, 1.4]) batch.add(place(box(0.16, 2.2, 0.16), x + dx, 1.1, BZ), M.metalDark);
			batch.add(place(box(3.2, 0.2, 0.6), x, 2.25, BZ), M.metalDark);
			batch.add(place(box(0.8, 1.2, 0.5), x + 0.4, 0.6, BZ + 0.5), M.metalOlive); // привод
			for (const dx of [-1.2, 0, 1.2]) {
				batch.add(place(new THREE.CylinderGeometry(0.13, 0.17, 1.5, 8), x + dx, 3.1, BZ), M.white);
				batch.add(place(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), x + dx, 3.95, BZ), M.metalDark);
				// провода: ввод трансформатора → выключатель → гирлянда портала
				span([x + dx, 5.25, TZ - 0.55], [x + dx, 4.1, BZ], 0.45);
				span([x + dx, 4.1, BZ], [x + dx * 1.4, 7.9, PZ], 0.35);
			}
			collide(x, BZ + 0.15, 3.4, 1.2);
		}
		// порталы: бетонные стойки и стальные траверсы, гирлянды изоляторов
		for (const x of [12, 24, 36, 48]) {
			batch.add(place(new THREE.CylinderGeometry(0.2, 0.26, 9.2, 8), x, 4.6, PZ), M.concrete);
			collide(x, PZ, 0.6, 0.6);
		}
		batch.add(place(box(36.4, 0.5, 0.5, 2), 30, 9.1, PZ), M.metalRust);
		batch.add(place(box(36.4, 0.12, 0.9), 30, 8.82, PZ), M.metalRust);
		for (const x of [16.3, 18, 19.7, 28.3, 30, 31.7, 40.3, 42, 43.7, 27, 30.5, 34]) rod(batch, M.green, [x, 8.85, PZ], [x, 7.9, PZ], 0.09, 6);

		// ---------- ЛЭП 110 кВ на север: решётчатая опора за забором ----------
		{
			const px = 30.5, pz = -57;
			const lv = [[0, 2.1], [4, 1.5], [8, 0.95], [11, 0.65], [15.5, 0.4]]; // высота, половина ширины
			const c = (y, h, sx, sz) => [px + sx * h, y, pz + sz * h];
			for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let i = 0; i < lv.length - 1; i++) rod(batch, M.silver, c(lv[i][0], lv[i][1], sx, sz), c(lv[i + 1][0], lv[i + 1][1], sx, sz), 0.09);
			// раскосы крестом по граням
			const faces = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
			for (const [[ax, az], [bx, bz]] of faces) for (let i = 0; i < lv.length - 1; i++) {
				rod(batch, M.silver, c(lv[i][0], lv[i][1], ax, az), c(lv[i + 1][0], lv[i + 1][1], bx, bz), 0.05);
				rod(batch, M.silver, c(lv[i][0], lv[i][1], bx, bz), c(lv[i + 1][0], lv[i + 1][1], ax, az), 0.05);
			}
			// траверсы: нижняя широкая, верхняя короче; с концов — гирлянды
			for (const [y, w] of [[11, 4.4], [13.6, 3]]) {
				rod(batch, M.silver, [px - w, y, pz], [px + w, y, pz], 0.08);
				for (const s of [-1, 1]) rod(batch, M.silver, [px + s * w, y, pz], [px + s * 0.4, y + 1.2, pz], 0.05);
			}
			const phases = [[px - 4.4, 11], [px + 4.4, 11], [px + 3, 13.6]];
			for (const [x, y] of phases) rod(batch, M.green, [x, y, pz], [x, y - 1.3, pz], 0.09, 6);
			[27, 30.5, 34].forEach((x, i) => {
				const [ax, ay] = phases[i];
				span([x, 7.9, PZ], [ax, ay - 1.3, pz], 1.2);
				span([ax, ay - 1.3, pz], [ax, ay - 1.8, -74], 1.6);
			});
			collide(px, pz, 4.4, 4.4);
			// трос молниезащиты над порталами
			span([12, 9.4, PZ], [48, 9.4, PZ], 0.4, 12);
		}

		// ---------- ЗРУ-10 кВ и щитовая ----------
		{
			const cx = 16.5, cz = -15.5, W = 12, D = 5, H = 5;
			occluder('ZRU', (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.whiteBrick);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				// ленточные окна под крышей и ворота ячеек на южном фасаде
				for (const [i, x] of [-4.2, -1.4, 1.4, 4.2].entries()) {
					const win = T.windowUV(new THREE.PlaneGeometry(1.6, 0.9), [1, 0, 3, 0][i]);
					win.translate(cx + x, 3.9, cz + D / 2 + 0.01);
					kb.add(win, M.window);
				}
				for (const x of [-3, 3]) kb.add(place(box(1.8, 2.3, 0.1), cx + x, 1.15, cz + D / 2 + 0.05), M.metalOlive);
				kb.add(place(box(W + 0.4, 0.4, 0.5), cx, 2.6, cz + D / 2 + 0.25), M.concrete); // козырёк
				kb.add(place(new THREE.PlaneGeometry(0.7, 0.24), cx - 3, 1.9, cz + D / 2 + 0.11), danger);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 0.6, top: H + 0.4 }, 0.25);
			collide(cx, cz, W, D);
		}
		buildings.push(buildGuardhouse(bctx, { name: 'Control', cx: 44, cz: -15, ry: Math.PI }));
		addCar(batch, M, root, 37.5, -14.2, Math.PI / 2, 0x5a6a4a, { model: 'e_niva' });
		collide(37.5, -14.2, 4.3, 1.8, Math.PI / 2);
		// катушки кабеля и ящики у ЗРУ, бочки масла у трансформаторов
		const drum = (x, z, r = 0.9, ry = 0) => {
			const c = Math.cos(ry), s = Math.sin(ry);
			for (const d of [-0.5, 0.5]) batch.add(place(new THREE.CylinderGeometry(r, r, 0.14, 16).rotateX(Math.PI / 2), x + d * s, r, z + d * c, ry), M.wood);
			batch.add(place(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.9, 14).rotateX(Math.PI / 2), x, r, z, ry), M.tire);
			collide(x, z, 2 * r + 0.1, 1.2, ry);
		};
		drum(12, -21.5); drum(14.6, -21.8, 0.75, 0.3);
		hazardBarrels(batch, M, collide, 46.5, -31, rnd, 5);
		for (const [x, z, r] of [[22, -44, 0.1], [24, -44.6, 0], [38, -44, 0.3]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }

		// ---------- Склад РЭС: катушки, трубы, аварийка ----------
		buildings.push(buildWarehouse(bctx, { name: 'Depot', cx: -30, cz: -18, ry: Math.PI }));
		drum(-21, -8, 1.0); drum(-18.4, -8.6, 1.0, 0.2); drum(-19.6, -11.6, 0.8, 1.4); drum(-40, -7.5, 0.9, 0.1);
		pipePile(batch, M, collide, -44, -14, Math.PI / 2);
		pipePile(batch, M, collide, -36, -32, 0.05);
		armyTruck(batch, M, root, collide, -26, -4, Math.PI / 2 + 0.08);
		hazardBarrels(batch, M, collide, -47, -27, rnd, 4);
		for (const [x, z, r] of [[-14, -16, 0.2], [-14.6, -17.4, 0.6], [-46, -4, 0]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood);
			endProp();
			collide(x, z, 1.2, 0.9, r);
		}
		// старая будка ТП у дороги на север
		transformer(batch, root, M, collide, -14, -40);

		// ---------- Посёлок энергетиков ----------
		buildings.push(
			buildArmyBarracks(bctx, { name: 'Dorm', cx: -26, cz: 20, ry: 0 }),
			buildHouse(bctx, { name: 'House1', cx: -4, cz: 21, ry: 0, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: 14, cz: 21, ry: 0, rnd, variant: 2 }),
			buildHouse(bctx, { name: 'House3', cx: 14, cz: 41, ry: 0, rnd, variant: 1 }),
		);
		fencePlot(batch, M, collide, -4, 21, 15, 13, 'n', rnd);
		fencePlot(batch, M, collide, 14, 21, 15, 13, 'n', rnd);
		fencePlot(batch, M, collide, 14, 41, 15, 13, 'n', rnd);
		shed(batch, M, collide, -9.4, 26.2, 0.05);
		shed(batch, M, collide, 19.6, 46, 3.1);
		clothesline(batch, M, root, collide, 8, 13, 26.4, rnd);
		// у общежития: скамейки, качели, бельё не сушат — сушат в доме
		bench(batch, M, -31, 13.6, 0);
		bench(batch, M, -21, 13.6, 0);
		swings(batch, M, -26, 30);
		transformer(batch, root, M, collide, -7, 40); // поселковая ТП
		// гаражи на площадке, ворота к улице
		{
			const z0 = 26, n = 6, w = 4, x0 = 28;
			occluder('Garages', (gb, group) => {
				for (let i = 0; i < n; i++) {
					const x = x0 + i * w;
					gb.add(place(box(w, 2.6, 6, 1.2), x, 1.3, z0), i % 3 === 1 ? M.whiteBrick : M.brick);
					gb.add(place(box(w + 0.1, 0.12, 6.4, 2), x, 2.66, z0 - 0.1, 0, -0.04), M.roofTar);
					const door = new THREE.Mesh(box(3, 2.2, 0.08), T.garageDoorMaterial(i % 3));
					door.position.set(x, 1.1, z0 - 3.02);
					group.add(door);
				}
			}, { cx: x0 + (n - 1) * w / 2, cz: z0, ry: 0, hx: n * w / 2 + 0.2, hz: 3.3, top: 2.9 }, 0.3);
			collide(x0 + (n - 1) * w / 2, z0, n * w, 6);
		}
		addCar(batch, M, root, 33, 17.5, 0.1, 0x7a2a22);
		collide(33, 17.5, 4.3, 1.8, 0.1);
		addCar(batch, M, root, 44, 16.5, Math.PI + 0.3, 0xb8b0a0, { crashed: true });
		collide(44, 16.5, 4.3, 1.8, Math.PI + 0.3);
		addCar(batch, M, root, -8, 12.6, Math.PI, 0x3a5a6a, { burned: true }); // сгорела у обочины
		collide(-8, 12.6, 4.3, 1.8, Math.PI);
		// столбы 10 кВ вдоль улицы посёлка
		powerLine(batch, root, M, collide, -44, 44, 11.6, 22);

		// ---------- Окраина ----------
		// остановка «Подстанция» у трассы на западе
		{
			const x = -40, z = -0.6;
			batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z - 0.9), M.concrete);
			batch.add(place(box(5.4, 0.15, 2.2, 1), x, 2.45, z), M.metalRust);
			for (const dx of [-2.4, 2.4]) batch.add(place(box(0.12, 2.4, 0.12), x + dx, 1.2, z + 0.9), M.metalDark);
			collide(x, z - 0.9, 5, 0.4);
			bench(batch, M, x, z - 0.3, Math.PI);
		}
		bus(batch, M, root, -52, 3, -Math.PI / 2 + 0.08);
		collide(-52, 3, 2.6, 7.8, -Math.PI / 2 + 0.08);
		addCar(batch, M, root, 50, 5.5, Math.PI + 0.15, 0x5a5a3a, { burned: true });
		collide(50, 5.5, 4.3, 1.8, Math.PI + 0.15);
		pipePile(batch, M, collide, 56, -36, 1.4);
		hazardBarrels(batch, M, collide, -54, 30, rnd, 4);
		transformer(batch, root, M, collide, 56, 28);

		// провода — в сцену одним мешем
		root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x1c1c1c })));

		const exits = [
			{ to: 'zarechny', x0: 61.2, x1: 66, z0: 0, z1: 8, spawn: [59, 4, -Math.PI / 2], sign: [60, 9.4, 'Заречный →'] },
			{ to: 'himmash', x0: -66, x1: -61.2, z0: 0, z1: 8, spawn: [-59, 4, Math.PI / 2], sign: [-60, 9.4, '← Химмаш'] },
			{ to: 'voench', x0: -11, x1: -5, z0: -66, z1: -61.2, spawn: [-8, -59, 0], sign: [-3.6, -60.2, '↑ В/ч'] },
		];
		return {
			start: [59, 4, -Math.PI / 2],
			exits,
			// бегуны и топтуны по посёлку и складу; рубер — у трансформаторов
			groups: [
				{ at: [30, -30], r: 4, rubers: 1, runners: 1 },
				{ at: [20, -44], r: 4, runners: 1, stompers: 1 },
				{ at: [36, -17], r: 5, runners: 2 },
				{ at: [-28, -7], r: 6, runners: 2, stompers: 1 },
				{ at: [-30, -19], r: 3, runners: 1 },
				{ at: [-26, 27], r: 5, runners: 2, stompers: 1 },
				{ at: [-26, 20], r: 3, runners: 1 },
				{ at: [5, 31], r: 6, runners: 2 },
				{ at: [38, 16], r: 6, runners: 1, stompers: 1 },
				{ at: [2, 4], r: 8, runners: 2 },
				{ at: [-8, -28], r: 6, runners: 2 },
				// окраина
				{ at: [-50, -40], r: 6, runners: 2 },
				{ at: [50, 40], r: 6, runners: 1, stompers: 1 },
				{ at: [-50, 36], r: 6, runners: 2 },
				{ at: [30, -60], r: 4, stompers: 1 },
				{ at: [-16, 54], r: 7, runners: 2 },
				{ at: [56, -24], r: 5, runners: 2 },
			],
			onRoad,
			// горят сгоревшая машина у обочины и бочка у склада; тлеет кабель у ЗРУ
			fires: [[-8, 12.6, 'car'], [-34, -2.5], [12, -19, 'ground']],
			barrels: 6, // бочки с маслом и соляркой
			trees(tryTree) {
				// лес на северо-западе, берёзы вдоль трассы и в посёлке, яблони во дворах
				for (let i = 0; i < 26; i++) tryTree(R(-60, -12), R(-46, -26), rnd() < 0.6 ? 'pine' : 'birch');
				for (let i = 0; i < 12; i++) tryTree(R(-3, 6), R(-46, -12), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 22; i++) tryTree(R(-62, 62), R(13.5, 14.8), rnd() < 0.7 ? 'birch' : 'pine');
				for (let i = 0; i < 10; i++) tryTree(R(-11, 21), R(25, 27.5), 'apple');
				for (let i = 0; i < 6; i++) tryTree(R(8, 21), R(45, 47), 'apple');
				for (let i = 0; i < 14; i++) tryTree(R(-46, -14), R(28, 46), rnd() < 0.6 ? 'birch' : 'pine');
				for (let i = 0; i < 8; i++) tryTree(R(26, 48), R(32, 46), 'birch');
			},
			clutter: 16,
			blood: 18,
			puddles: 14,
			puddle: () => [R(-46, 46), rnd() < 0.5 ? R(1, 7) : R(-44, -14)],
			grass: 0.8,
			hint: (b) => ({
				Control: 'Щитовая — шкаф дежурного электромонтёра и сейф',
				Depot: 'Склад РЭС — стеллажи с ящиками, бывают гранаты',
				Dorm: 'Общежитие энергетиков — тумбочки у коек, шкафы в каптёрке коменданта',
			}[b.name] ?? 'Дом энергетика — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
