// Кластер «Больница»: городская больница №2 на окраине, которую Улей перенёс вместе с куском улицы.
// За оградой (спереди — решётка на кирпичных столбах, по бокам и сзади — бетонные плиты) — главный корпус
// в пять этажей с порталом входа, к нему пристроен приёмный покой (койки, тумбочки, шкафы) с навесом, под которым
// стоят машины скорой; терапевтический корпус в три этажа, сквер с клумбой, беседкой и лавочками, стоянка
// персонала. На хоздворе — котельная с трубой, кислородные ёмкости, трансформаторная, гараж скорой со стеллажами;
// в дальнем углу — морг с катафалком. Въезд — через КПП со шлагбаумом с улицы, калитка — с улицы на север.
// Снаружи: улица с остановкой, аптека, стоянка, частные дома за улицей на север, панельная четырёхэтажка.
// Выходы: на запад по улице (к стабу «Полис») и на север по улице (к Заречному).
// Опасность 2: много бегунов, топтуны водят стаи у корпусов, в сквере и на хоздворе.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { hash01 } from '../facade.js';
import { buildArmyBarracks, buildWarehouse, buildGuardhouse, buildCheckpoint, buildShop, buildHouse } from '../buildings.js';
import { bench, streetLamp, markingMaterial, addCar, bus, fencePlot, shed, woodpile, garden, outhouse, transformer } from '../props.js';
import { chimney, storageTank, barrier } from '../props-industrial.js';

// ограда больничной территории
const FX0 = -28, FX1 = 57, FZ0 = -50, FZ1 = 20;

/**
 * Машина скорой помощи («буханка»): белый фургон с красной полосой и крестами, маячок на крыше.
 * Перед — локальная +X (как у addCar); wreck — брошена с открытой дверью, чуть накренилась.
 */
function ambulance(batch, M, collide, x, z, ry, { wreck = false } = {}) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(wreck ? 0.04 : 0, ry, 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, mat, px, py, pz) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat);
	add(box(3.8, 0.28, 1.6), M.metalDark, 0, 0.42, 0); // рама
	add(box(4.4, 1.6, 1.94, 1.5), M.white, 0, 1.26, 0); // кузов
	add(box(4.0, 0.08, 1.8, 1.5), M.white, -0.1, 2.1, 0); // крыша
	add(box(4.42, 0.2, 1.96), M.red, 0, 1.12, 0); // красная полоса
	add(box(0.04, 0.55, 1.62), M.metalDark, 2.21, 1.68, 0); // лобовое стекло (тёмное, как у всех машин сверху)
	add(box(0.85, 0.5, 1.96), M.metalDark, 1.55, 1.68, 0); // окна кабины по бокам
	add(box(1.6, 0.36, 1.96), M.metalDark, -0.9, 1.78, 0); // окна салона
	for (const s of [-1, 1]) {
		add(box(0.5, 0.14, 0.02), M.red, -0.9, 1.45, s * 0.985); // красный крест на борту
		add(box(0.14, 0.5, 0.02), M.red, -0.9, 1.45, s * 0.985);
		for (const wx of [-1.35, 1.35]) add(new THREE.CylinderGeometry(0.4, 0.4, 0.26, 14).rotateX(Math.PI / 2), M.tire, wx, 0.4, s * 0.86);
	}
	add(box(0.14, 0.18, 2.0), M.metalDark, 2.24, 0.55, 0); // бамперы
	add(box(0.14, 0.18, 2.0), M.metalDark, -2.24, 0.55, 0);
	add(box(0.3, 0.16, 0.7), M.red, 1.5, 2.22, 0); // маячок
	if (wreck) add(box(0.9, 1.35, 0.05), M.white, 1.6, 1.25, 1.35); // распахнутая дверь кабины
	collide(x, z, 4.6, 2.1, ry);
}

/** Каталка: рама на колёсиках, матрас (декор с коллайдером). */
function stretcher(batch, M, collide, x, z, ry) {
	batch.add(place(box(1.9, 0.06, 0.62), x, 0.82, z, ry), M.metalDark);
	batch.add(place(box(1.8, 0.08, 0.56), x, 0.89, z, ry), M.white);
	const c = Math.cos(ry), s = Math.sin(ry);
	for (const [lx, lz] of [[-0.85, -0.26], [0.85, -0.26], [-0.85, 0.26], [0.85, 0.26]]) {
		batch.add(place(box(0.04, 0.8, 0.04), x + lx * c + lz * s, 0.4, z - lx * s + lz * c), M.metalDark);
	}
	collide(x, z, 2.0, 0.7, ry);
}

export default {
	id: 'bolnica',
	seed: 3301,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		// вывески: аптека (магазин) и морг (сторожка)
		M.shopSign = T.signMaterial('АПТЕКА', { bg: '#e6efe4', fg: '#1d7a3a' });
		M.guardSign = T.signMaterial('МОРГ', { bg: '#2a2c26', fg: '#e8e4d8' });
		const mark = markingMaterial();

		// ---------- Улицы, тротуары, проезды ----------
		ground(150, 8, 0, 28, M.asphalt, 5, 0.02); // улица запад—восток (к стабу)
		ground(8, 96, -36, -22, M.asphalt, 5, 0.022); // улица на север (к Заречному)
		ground(107, 0.15, 21.5, 28, mark, 6, 0.026);
		ground(35, 0.15, -57.5, 28, mark, 6, 0.026);
		ground(94, 0.15, -36, -23, mark, 6, 0.027, Math.PI / 2);
		ground(150, 2.2, 0, 22.9, M.concrete, 3, 0.014); // тротуары
		ground(150, 2.2, 0, 33.1, M.concrete, 3, 0.014);
		ground(2.2, 90, -30.9, -25, M.concrete, 3, 0.015);
		// бордюры вдоль улиц (разрывы — у въезда, калитки и перекрёстка)
		for (const [x0, x1, z] of [[-66, -40, 23.95], [-32, 5.6, 23.95], [13.4, 66, 23.95], [-66, -40, 32.05], [-32, 66, 32.05]]) {
			batch.add(place(box(x1 - x0, 0.14, 0.24, 2), (x0 + x1) / 2, 0.07, z), M.concrete, { cast: false });
		}
		for (const [z0, z1] of [[-66, -31], [-23, 21.8]]) batch.add(place(box(0.24, 0.14, z1 - z0, 2), -31.95, 0.07, (z0 + z1) / 2), M.concrete, { cast: false });
		// на территории: въезд от КПП, проезд вдоль корпусов, площадки у гаража и приёмного покоя, дорожки
		ground(7, 41, 9.5, 3.5, M.asphalt, 5, 0.021); // въезд (z −17…24)
		ground(54, 7, 16, -13, M.asphalt, 5, 0.023); // проезд вдоль корпусов (x −11…43)
		ground(13, 14, 39.5, -6, M.asphalt, 5, 0.022); // площадка у ворот гаража
		ground(14, 6, 21, -19.4, M.asphalt, 5, 0.024); // к приёмному покою, под навесом
		ground(6, 14, 0, -23.5, M.concrete, 3, 0.019); // к главному входу
		ground(29, 6, -17.5, -27, M.asphalt, 5, 0.02); // от калитки вдоль главного корпуса
		ground(20, 9, 27, 12.5, M.asphalt, 5, 0.021); // стоянка персонала
		ground(4.5, 4.5, 15, 12.5, M.asphalt, 5, 0.022);
		ground(18, 2.2, -2.5, 4, M.concrete, 3, 0.018); // дорожки сквера
		ground(2.2, 12, -6, 11, M.concrete, 3, 0.017);
		ground(2.2, 13, -2, -3.5, M.concrete, 3, 0.017);
		ground(20, 9, 46, -27.5, M.concrete, 4, 0.016); // хоздвор
		// снаружи: стоянка, площадка у аптеки
		ground(28, 13, 12, 40.5, M.asphalt, 5, 0.021);
		ground(10, 20, -24, 44, M.concrete, 3, 0.017);
		const roads = [
			[-80, 80, 24, 32], [-40, -32, -80, 28], [6, 13, -17, 24], [-11, 43, -16.5, -9.5], [33, 46, -13, 1], [14, 28, -22.4, -16.4],
			[-3, 3, -30.5, -16.5], [-32, -3, -30, -24], [12.7, 37, 8, 17], [-2, 26, 34, 47], [-29, -19, 34, 54],
			[-80, 80, 21.8, 24], [-80, 80, 32, 34.2], [-32, -29.8, -70, 24], [36, 56, -32, -23],
		];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

		// ---------- Ограда: решётка на кирпичных столбах спереди, бетонные плиты по бокам и сзади ----------
		const railing = (x0, x1, z) => {
			const n = Math.max(1, Math.round((x1 - x0) / 3.6)), step = (x1 - x0) / n;
			for (let i = 0; i <= n; i++) {
				batch.add(place(box(0.5, 1.9, 0.5, 1), x0 + i * step, 0.95, z), M.brick);
				batch.add(place(box(0.6, 0.08, 0.6), x0 + i * step, 1.94, z), M.concrete);
			}
			for (let i = 0; i < n; i++) {
				const xm = x0 + (i + 0.5) * step, len = step - 0.5;
				for (const y of [0.25, 1.55]) batch.add(place(box(len, 0.05, 0.05), xm, y, z), M.metalDark);
				for (let k = 0.16; k < len - 0.05; k += 0.24) batch.add(place(box(0.025, 1.45, 0.025), xm - len / 2 + k, 0.9, z), M.metalDark);
			}
			collide((x0 + x1) / 2, z, x1 - x0, 0.5);
		};
		railing(FX0, -0.5, FZ1);
		railing(13.5, FX1, FZ1);
		// бетонные плиты со столбами — одним материалом (у concreteFence рёбра темнее: лишний вызов отрисовки на участок)
		const plates = (x0, z0, x1, z1, h = 2.3) => {
			const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(len / 4));
			for (let i = 0; i < n; i++) {
				const t = (i + 0.5) / n;
				batch.add(place(box(len / n - 0.05, h, 0.16, 1.2, 1.2), x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t, -ang), M.concrete);
			}
			for (let i = 0; i <= n; i++) batch.add(place(box(0.3, h + 0.2, 0.3), x0 + (x1 - x0) * i / n, (h + 0.2) / 2, z0 + (z1 - z0) * i / n, -ang), M.concrete);
			collide((x0 + x1) / 2, (z0 + z1) / 2, len, 0.4, -ang);
		};
		plates(FX0, FZ0, FX0, -31.4); // запад, до калитки
		plates(FX0, -22.6, FX0, FZ1);
		plates(FX0, FZ0, 10, FZ0); // север — с проломом
		plates(14, FZ0, FX1, FZ0);
		plates(FX1, FZ0, FX1, FZ1); // восток
		// упавшие плиты в проломе северной стены
		batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), 12, 0.3, FZ0 - 1.4, 0.2, 0.1, 0), M.concrete);
		batch.add(place(box(3.9, 0.16, 2.3, 1.2, 1.2), 12.6, 0.12, FZ0 + 1.6, -0.15), M.concrete);
		// калитка с запада и ворота въезда: кирпичные столбы
		for (const [x, z] of [[FX0, -31.4], [FX0, -22.6], [5.9, FZ1], [13.3, FZ1]]) {
			batch.add(place(box(0.7, 2.6, 0.7, 1), x, 1.3, z), M.brick);
			batch.add(place(box(0.85, 0.1, 0.85), x, 2.65, z), M.concrete);
			collide(x, z, 0.7, 0.7);
		}
		batch.add(place(box(0.05, 2.0, 1.8), FX0 + 0.35, 1.0, -32.4, 0.15), M.metalDark); // распахнутая створка калитки
		collide(FX0 + 0.35, -32.4, 0.25, 1.8, 0.15);
		barrier(batch, M, collide, 12.7, FZ1 - 0.9, Math.PI, 6.4, true); // шлагбаум поднят

		// ---------- Корпуса без входа: стены, окна по фасадам, плоская крыша с парапетом ----------
		// win — фасады с окнами: s (юг, его видит камера), e, w; floors — этажи по 3 м
		const block = (name, { cx, cz, W, D, floors, mat = M.whiteBrick, win = ['s'], skip = () => false, extra = null, min = 0.22 }) => {
			const fh = 3.1, H = floors * fh + 0.4;
			occluder(name, (kb) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), mat);
				kb.add(place(box(W + 0.3, 0.5, D + 0.3, 2), cx, 0.25, cz), M.concrete); // цоколь
				kb.add(place(planeXZ(W, D, 4), cx, H + 0.03, cz), M.roofTar);
				for (const s of [-1, 1]) {
					kb.add(place(box(W + 0.4, 0.5, 0.25, 2), cx, H + 0.25, cz + s * (D / 2 + 0.075)), M.concrete);
					kb.add(place(box(0.25, 0.5, D - 0.1, 2), cx + s * (W / 2 + 0.075), H + 0.25, cz), M.concrete);
				}
				for (const side of win) {
					const along = side === 's' ? W : D, n = Math.floor((along - 1.2) / 3.2);
					// межэтажные пояса по фасаду
					for (let f = 1; f < floors; f++) {
						const y = 0.4 + f * fh;
						if (side === 's') kb.add(place(box(W + 0.05, 0.16, 0.08), cx, y, cz + D / 2 + 0.04), M.concrete);
						else kb.add(place(box(0.08, 0.16, D + 0.05), cx + (side === 'e' ? 1 : -1) * (W / 2 + 0.04), y, cz), M.concrete);
					}
					for (let i = 0; i < n; i++) for (let f = 0; f < floors; f++) {
						const a = -along / 2 + (along - (n - 1) * 3.2) / 2 + i * 3.2, y = 0.4 + f * fh + 1.55;
						if (skip(side, a, f)) continue;
						const h = hash01(name, side, i, f);
						const k = f === 0 ? (h < 0.35 ? 6 : h < 0.55 ? 5 : h < 0.8 ? 4 : 7) : (h < 0.1 ? 6 : h < 0.3 ? 5 : h < 0.55 ? 7 : 4);
						// клетка 6 атласа — заколоченное окно (доски нарисованы), отдельных досок не кладём: лишний материал
						const g = T.windowUV(new THREE.PlaneGeometry(1.62, 1.44), k);
						if (side === 's') g.translate(cx + a, y, cz + D / 2 + 0.02);
						else if (side === 'e') g.rotateY(Math.PI / 2).translate(cx + W / 2 + 0.02, y, cz - a);
						else g.rotateY(-Math.PI / 2).translate(cx - W / 2 - 0.02, y, cz + a);
						kb.add(g, M.window);
					}
				}
				extra?.(kb, H);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.4, hz: D / 2 + 0.6, top: H + 0.6 }, min);
			collide(cx, cz, W, D);
			return H;
		};

		// главный корпус (5 этажей): портал входа с колоннами, вывеска, крест, машинное отделение лифтов на крыше
		block('MainBlock', {
			cx: 8, cz: -37, W: 44, D: 13, floors: 5,
			skip: (side, a, f) => (f === 0 && Math.abs(8 + a) < 3) || (f === 1 && Math.abs(8 + a) < 5.5), // вход: портал и вывеска
			extra: (kb, H) => {
				const z = -30.5;
				kb.add(place(box(9, 0.35, 4.2, 2), 0, 3.6, z + 2.1), M.concrete); // плита портала
				kb.add(place(box(9.2, 0.5, 0.2, 2), 0, 3.95, z + 4.15), M.concrete);
				for (const x of [-4, -1.4, 1.4, 4]) kb.add(place(new THREE.CylinderGeometry(0.22, 0.25, 3.45, 12), x, 1.73, z + 3.7), M.white);
				kb.add(place(box(2.6, 2.4, 0.06), 0, 1.3, z + 0.03), M.glass); // двери
				kb.add(place(box(0.1, 2.4, 0.08), 0, 1.3, z + 0.07), M.metalDark);
				const sign = new THREE.PlaneGeometry(8.4, 0.9);
				sign.translate(0, 4.6, z + 0.03);
				kb.add(sign, T.signMaterial('ГОРОДСКАЯ БОЛЬНИЦА №2', { bg: '#e8e4d8', fg: '#1a3a7a', w: 640, h: 72 }));
				// красный крест на белом щите между четвёртым и пятым этажом
				kb.add(place(box(1.5, 1.5, 0.06), 0, 13.6, z + 0.03), M.white);
				kb.add(place(box(1.2, 0.38, 0.08), 0, 13.6, z + 0.07), M.red);
				kb.add(place(box(0.38, 1.2, 0.08), 0, 13.6, z + 0.07), M.red);
				// машинное отделение лифтов и вентшахты на крыше
				kb.add(place(box(5, 2.6, 4, 2), 12, H + 1.3, -38), M.whiteBrick);
				kb.add(place(box(5.3, 0.15, 4.3, 2), 12, H + 2.65, -38), M.roofTar);
				for (const [x, z2] of [[-8, -35], [-2, -39.5], [22, -35.5], [26, -39]]) kb.add(place(box(1.0, 0.9, 0.6, 1), x, H + 0.45, z2), M.whiteBrick);
			},
		});
		for (const x of [-4, -1.4, 1.4, 4]) collide(x, -26.8, 0.55, 0.55); // колонны портала
		batch.add(place(box(7, 0.15, 2.2, 1), 0, 0.075, -29.4), M.concrete); // крыльцо
		batch.add(place(box(7.6, 0.08, 1.0, 1), 0, 0.04, -27.9), M.concrete);

		// терапевтический корпус (3 этажа): вход с проезда, козырёк
		block('Therapy', {
			cx: -17, cz: -6, W: 12, D: 26, floors: 3, win: ['s', 'e', 'w'],
			skip: (side, a, f) => side === 'e' && f === 0 && Math.abs(-6 - a + 13) < 2, // вход
			extra: (kb) => {
				kb.add(place(box(3.4, 0.25, 2.4, 2), -9.8, 2.9, -13), M.concrete);
				kb.add(place(box(0.06, 2.3, 2.0), -10.97, 1.25, -13), M.glass);
				const sign = new THREE.PlaneGeometry(4.6, 0.6).rotateY(Math.PI / 2);
				sign.translate(-10.97, 3.55, -13);
				kb.add(sign, T.signMaterial('ТЕРАПИЯ', { bg: '#e8e4d8', fg: '#1a3a7a', w: 384, h: 64 }));
			},
		});
		batch.add(place(box(1.6, 0.15, 3.0, 1), -10.2, 0.075, -13), M.concrete);

		// котельная с трубой и кучей угля
		block('Boiler', {
			cx: 39, cz: -43, W: 10, D: 8, floors: 2, mat: M.brick,
			extra: (kb) => {
				kb.add(place(box(2.6, 3.0, 0.08), 41.5, 1.5, -38.96), M.metalRust); // ворота
				kb.add(place(box(4, 0.4, 0.6), 41.5, 3.3, -38.7), M.metalRust);
			},
		});
		chimney(batch, M, collide, 46.5, -43, 24);
		batch.add(place(new THREE.IcosahedronGeometry(1.6, 1).scale(1.5, 0.45, 1), 35.5, 0.3, -36.4, 0.3), M.tire);
		collide(35.5, -36.4, 4.2, 2.6);

		// ---------- Приёмный покой (можно зайти) — пристройка к главному корпусу, навес для машин скорой ----------
		buildings.push(buildArmyBarracks(bctx, { name: 'Reception', cx: 20, cz: -26.4, ry: Math.PI }));
		occluder('BayCanopy', (kb) => {
			kb.add(place(box(12, 0.2, 6.4, 2), 21, 3.7, -19.5, 0, -0.04), M.roofGreen);
			for (const x of [15.4, 26.6]) kb.add(place(box(0.25, 3.7, 0.25), x, 1.85, -16.6), M.metalDark);
			kb.add(place(box(12, 0.45, 0.08), 21, 3.45, -16.3), M.metalDark); // карниз по краю навеса
		}, { cx: 21, cz: -19.5, ry: 0, hx: 6.2, hz: 3.3, top: 3.9 }, 0.15);
		for (const x of [15.4, 26.6]) collide(x, -16.6, 0.35, 0.35);
		ambulance(batch, M, collide, 17.6, -19.6, Math.PI / 2);
		ambulance(batch, M, collide, 24.6, -19.2, -Math.PI / 2 + 0.06);
		stretcher(batch, M, collide, 32, -21, 0.3);

		// ---------- Гараж скорой (можно зайти): профлист, стеллажи с запчастями; хоздвор ----------
		buildings.push(buildWarehouse(bctx, { name: 'AmbulanceGarage', cx: 51, cz: -4, ry: Math.PI / 2 }));
		ambulance(batch, M, collide, 37, -6.5, 0.05);
		ambulance(batch, M, collide, 37.5, 5.4, Math.PI - 0.3, { wreck: true });
		storageTank(batch, M, root, collide, 51, -30, 1.1, 5.5, M.tankWhite, 'КИСЛОРОД');
		storageTank(batch, M, root, collide, 54, -30, 1.1, 5.5, M.tankWhite, null);
		transformer(batch, root, M, collide, 40, -24);
		for (let i = 0; i < 3; i++) {
			beginProp('dumpster', 33 + i * 1.4, -27.2, 0);
			batch.add(place(box(1.2, 1.1, 0.9, 1), 33 + i * 1.4, 0.55, -27.2, R(-0.1, 0.1)), M.green);
			endProp();
		}
		collide(34.4, -27.2, 4.4, 1);
		for (const [x, z] of [[31.6, -25.9], [36.3, -26], [35.8, -28.4]]) {
			batch.add(place(new THREE.IcosahedronGeometry(0.32, 1).scale(1, 0.75, 1), x, 0.22, z, R(0, 3)), M.tire);
		}

		// ---------- Морг в дальнем углу (можно зайти), катафалк, каталки ----------
		buildings.push(buildGuardhouse(bctx, { name: 'Morgue', cx: -21, cz: -44, ry: Math.PI }));
		addCar(batch, M, root, -22, -37.5, 0.04, 0x1c1c1e);
		collide(-22, -37.5, 4.3, 1.8, 0.04);
		stretcher(batch, M, collide, -15.8, -39.6, Math.PI / 2 + 0.2);

		// ---------- КПП у въезда (можно зайти) ----------
		buildings.push(buildCheckpoint(bctx, { name: 'Checkpoint', cx: 2.5, cz: FZ1, ry: 0 }));

		// ---------- Сквер: клумба, беседка, лавочки, фонари; стоянка персонала ----------
		{
			const [x, z] = [-2, 4];
			batch.add(place(new THREE.CylinderGeometry(2.6, 2.6, 0.35, 20), x, 0.175, z), M.concrete);
			batch.add(place(new THREE.CircleGeometry(2.4, 20).rotateX(-Math.PI / 2), x, 0.36, z), M.dirt, { cast: false });
			for (let i = 0; i < 9; i++) {
				const a = i * 0.7, d = i % 3 ? 1.5 : 0.4;
				batch.add(place(new THREE.IcosahedronGeometry(0.32, 0).scale(1, 0.7, 1), x + Math.cos(a) * d, 0.5, z + Math.sin(a) * d, a), M.leaves);
			}
			collide(x, z, 4.6, 4.6);
		}
		{
			// беседка: шесть столбов, пол, шатровая крыша
			const [x, z] = [-7, 14];
			batch.add(place(new THREE.CylinderGeometry(2.3, 2.3, 0.15, 6), x, 0.075, z), M.wood);
			for (let i = 0; i < 6; i++) {
				const a = i * Math.PI / 3 + Math.PI / 6, px = x + Math.cos(a) * 2.05, pz = z + Math.sin(a) * 2.05;
				batch.add(place(box(0.14, 2.6, 0.14), px, 1.4, pz), M.woodGreen);
				if (i !== 1) collide(px, pz, 0.3, 0.3);
			}
			batch.add(place(new THREE.ConeGeometry(2.8, 1.3, 6), x, 3.35, z, Math.PI / 6), M.roofGreen);
			batch.add(place(box(1.6, 0.08, 0.4), x, 0.5, z - 1.2), M.woodGreen);
		}
		for (const [x, z, ry] of [[-6, -2.4, 0], [2, -2.4, 0], [-9.4, 4, Math.PI / 2], [4.6, 1.8, -Math.PI / 2], [-3.8, 9.4, Math.PI], [1.5, 6.2, Math.PI],
			[-3.6, -23, Math.PI / 2], [3.6, -23, -Math.PI / 2], [-8, -24.6, Math.PI]]) bench(batch, M, x, z, ry);
		for (const [x, z] of [[4.8, 7], [4.8, -7], [14.2, 3.5], [14.2, -7], [-4.2, -18.5], [4.2, -18.5], [30, -18.5]]) streetLamp(batch, M, collide, x, z);
		const car = (x, z, ry, color, opts) => { addCar(batch, M, root, x, z, ry, color, opts); collide(x, z, 4.3, 1.8, ry); };
		car(20, 12.6, Math.PI / 2 + 0.04, 0x8a8a7a);
		car(23.4, 12.3, Math.PI / 2 - 0.05, 0x5a6a7a);
		car(30.4, 12.8, Math.PI / 2 + 0.1, 0x2a2826, { burned: true });
		car(33.8, 12.4, -Math.PI / 2, 0x7b5a3a);
		for (const x of [18.3, 21.7, 25.1, 28.5, 31.9, 35.3]) batch.add(place(planeXZ(0.12, 4.6), x, 0.03, 12.5), M.white, { cast: false });

		// ---------- Улица: остановка, стоянка напротив въезда, аптека, брошенные машины ----------
		{
			const x = 27, z = 22.6; // остановка у ограды: навес открыт к дороге
			batch.add(place(box(5, 2.4, 0.15, 1), x, 1.2, z - 0.7), M.concrete);
			batch.add(place(box(5.4, 0.15, 1.8, 1), x, 2.45, z), M.metalRust);
			for (const dx of [-2.4, 2.4]) batch.add(place(box(0.15, 2.4, 1.6, 1), x + dx, 1.2, z), M.concrete);
			batch.add(place(box(4, 0.08, 0.45), x, 0.5, z - 0.35), M.wood);
			collide(x, z - 0.3, 5.2, 1.0);
		}
		for (const x of [-52, -28, -4, 30, 54]) streetLamp(batch, M, collide, x, 35.2);
		car(0.5, 37.6, -Math.PI / 2, 0x9a9a8a);
		car(6.6, 37.4, -Math.PI / 2 + 0.08, 0x3a5a3a);
		car(16.2, 37.8, -Math.PI / 2 - 0.05, 0xa8402c, { crashed: true });
		car(22.4, 37.5, -Math.PI / 2, 0xc8c0a8);
		car(3.2, 44.2, Math.PI / 2 + 0.06, 0x2a3a5a);
		car(13, 44, Math.PI / 2, 0x6a6a5a);
		for (const x of [-0.8, 2.4, 5.6, 8.8, 12, 15.2, 18.4, 21.6, 24.8]) {
			batch.add(place(planeXZ(0.12, 4.4), x, 0.03, 37.5), M.white, { cast: false });
			batch.add(place(planeXZ(0.12, 4.4), x, 0.03, 44.3), M.white, { cast: false });
		}
		buildings.push(buildShop(bctx, { cx: -14, cz: 46 }));
		for (let i = 0; i < 3; i++) batch.add(place(box(1.2, 0.15, 0.8), -7.8, 0.08 + i * 0.16, 53, R(-0.2, 0.2)), M.wood); // поддоны у чёрного хода
		collide(-7.8, 53, 1.3, 1);
		car(-14, 26.4, 0.3, 0x8a2e24, { crashed: true });
		car(34, 29.6, Math.PI + 0.2, 0x1c1a18, { burned: true });
		car(-34.3, -44, Math.PI / 2 + 0.12, 0x5a6a3a);
		ambulance(batch, M, collide, -37.6, -6, -Math.PI / 2 - 0.25, { wreck: true });
		bus(batch, M, root, -50, 29.6, Math.PI / 2 + 0.04);
		collide(-50, 29.6, 2.6, 8.4, Math.PI / 2 + 0.04);

		// ---------- Панельная четырёхэтажка за улицей (без входа) ----------
		{
			const cx = 44, cz = 50, W = 32, D = 11, H = 11.2;
			occluder('Panel', (kb) => {
				kb.add(place(box(W, H, D, 3.2, 2.8), cx, H / 2 + 0.6, cz), M.panel);
				kb.add(place(box(W + 0.3, 0.8, D + 0.3, 2), cx, 0.4, cz), M.brick);
				kb.add(place(planeXZ(W, D, 4), cx, H + 0.63, cz), M.roofTar);
				for (const s of [-1, 1]) {
					kb.add(place(box(W + 0.4, 0.55, 0.25, 2), cx, H + 0.87, cz + s * (D / 2 + 0.075)), M.concrete);
					kb.add(place(box(0.25, 0.55, D - 0.1, 2), cx + s * (W / 2 + 0.075), H + 0.87, cz), M.concrete);
				}
				for (const ex of [-10, 0, 10]) {
					const x = cx + ex, z = cz - D / 2;
					kb.add(place(box(2.6, 0.15, 1.6), x, 2.9, z - 0.8), M.concrete); // козырёк подъезда
					kb.add(place(box(1.3, 2.2, 0.1), x, 1.7, z - 0.05), M.metalRust);
					kb.add(place(box(2.0, 1.8, 1.6, 2), x, H + 1.5, cz + 1.2), M.brick); // выход на крышу
				}
			}, { cx, cz, ry: 0, hx: W / 2 + 0.6, hz: D / 2 + 1.2, top: H + 2.4 }, 0.16);
			collide(cx, cz, W + 0.4, D + 0.4);
			for (const ex of [-10, 0, 10]) {
				batch.add(place(box(2.4, 0.3, 1.2, 1), cx + ex, 0.15, cz - D / 2 - 0.6), M.concrete);
				bench(batch, M, cx + ex + 2.3, cz - D / 2 - 2.2, 0);
			}
		}

		// ---------- Частные дома за улицей на север (можно зайти) ----------
		buildings.push(
			buildHouse(bctx, { name: 'House1', cx: -52, cz: -38, ry: -Math.PI / 2, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: -52, cz: -12, ry: -Math.PI / 2, rnd, variant: 1 }),
		);
		fencePlot(batch, M, collide, -51, -38, 16, 18, 'e', rnd);
		fencePlot(batch, M, collide, -51, -12, 16, 18, 'e', rnd);
		shed(batch, M, collide, -56.4, -30.6, 0.05);
		shed(batch, M, collide, -56.2, -19.4, -0.08);
		garden(batch, M, rnd, -47, -43, 3, 5);
		garden(batch, M, rnd, -47, -5.5, 3, 4.5);
		woodpile(batch, M, collide, -56.6, -45.4, 0);
		outhouse(batch, M, collide, -45.4, -19.6, Math.PI);

		return {
			start: [-58.5, 28, Math.PI / 2],
			exits: [
				{ to: 'stab', x0: -66, x1: -61.2, z0: 24, z1: 32, spawn: [-58.5, 28, Math.PI / 2], sign: [-60, 35, '← Стаб «Полис»'] },
				{ to: 'zarechny', x0: -40, x1: -32, z0: -66, z1: -61.2, spawn: [-36, -58.5, 0], sign: [-29.6, -60.2, '↑ Заречный'] },
			],
			// заражённые: бегуны у корпусов, в сквере, на улице; топтуны водят стаи у приёмного покоя, морга, хоздвора
			groups: [
				{ at: [22, -14], r: 6, runners: 2, stompers: 1 },
				{ at: [-2, -24], r: 6, runners: 3 },
				{ at: [-4, -6], r: 8, runners: 2 },
				{ at: [28, -3], r: 7, runners: 2 },
				{ at: [-6, -15], r: 5, runners: 2, stompers: 1 },
				{ at: [-20, -35], r: 5, runners: 2, stompers: 1 },
				{ at: [8, -47], r: 7, runners: 2 },
				{ at: [44, -32], r: 6, runners: 2, stompers: 1 },
				{ at: [47, -5], r: 6, runners: 3 }, // у ворот гаража и в нём
				{ at: [9, 13], r: 5, runners: 2 },
				{ at: [26, 4], r: 5, runners: 1 },
				{ at: [-20, 28], r: 9, runners: 2 },
				{ at: [40, 28], r: 9, runners: 2 },
				{ at: [12, 41], r: 7, runners: 2, stompers: 1 },
				{ at: [-24, 44], r: 5, runners: 2 },
				{ at: [-46, -25], r: 7, runners: 2 },
				{ at: [-36, -48], r: 7, runners: 2 },
				{ at: [42, 40], r: 7, runners: 2, stompers: 1 },
				{ at: [-44, 46], r: 8, runners: 2 },
			],
			onRoad,
			// горит машина на улице, костёр в сквере
			fires: [[34, 29.6, 'car'], [-6.5, -6.5, 'ground']],
			trees(tryTree) {
				// сквер и газоны — берёзы, у домов — яблони, вдоль улицы — ряд берёз
				for (let i = 0; i < 18; i++) tryTree(R(-10, 4.5), R(-8, 18.5), 'birch');
				for (let i = 0; i < 14; i++) tryTree(R(14, 42), R(-8, 7), 'birch');
				for (let i = 0; i < 8; i++) tryTree(R(-26, -12), R(9, 18.5), 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-26, 40), R(-48.5, -45), 'birch');
				for (let x = -60; x < 62; x += 7) tryTree(x + R(-1.5, 1.5), 35.8 + R(-0.4, 0.6), 'birch');
				for (let i = 0; i < 6; i++) tryTree(R(-58, -44), R(-46, -30), 'apple');
				for (let i = 0; i < 6; i++) tryTree(R(-58, -44), R(-20, -4), 'apple');
				for (let i = 0; i < 12; i++) tryTree(R(-60, -42), R(36, 60), 'birch');
			},
			beltTrees: ['birch'], // город: одни берёзы (каждый вид дерева на участке — лишние вызовы отрисовки)
			beltDensity: 0.85,
			clutter: 14,
			blood: 16,
			puddles: 8,
			puddle: () => [R(-60, 60), rnd() < 0.5 ? R(24.5, 31.5) : R(-55, 55)],
			grass: 0.9,
			hint: (b) => ({
				Reception: 'Приёмный покой — обыщи тумбочки у коек и шкафы с лекарствами',
				AmbulanceGarage: 'Гараж скорой — обыщи стеллажи с запчастями и ящики',
				Morgue: 'Морг — в шкафу охраны бывают патроны 12 калибра, в сейфе — автоматные',
				Checkpoint: 'КПП больницы — обыщи стол дежурного и шкаф',
				Shop: 'Аптека — живчики на витрине и стеллажах, в сейфе — патроны',
			}[b.name] ?? 'Дом — обыщи шкафы, тумбочки и сундук'),
		};
	},
};
