// Кластер «НИИ»: закрытый научный городок (почтовый ящик 17), который Улей забрал целиком — с охраной и подопытными.
// По периметру — бетонный забор с колючкой и вышками. С запада трасса упирается в КПП со шлагбаумом: за ним «Урал»
// охраны и караулка с оружием; на восток трасса уходит через сорванные задние ворота с постом охраны.
// Север — лабораторный двор: трёхэтажный лабораторный корпус, виварий с вольерами, опытный корпус (цех со станками),
// ёмкости азота и кислорода. Военные пытались оцепить двор — у ворот мешки с песком и брошенный горящий БТР.
// Во дворе — логово ЭЛИТЫ, высшей стадии заражённого: гнездо из споровой массы и костей, вокруг — руберы.
// Юг — заводоуправление НИИ со стоянкой, склад, водонапорная башня, трансформаторная будка.
// Окраина за забором: сосновый лес, могильник бочек с химией на севере, брошенный «Урал» и бетонные блоки на трассе.

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, beginProp, endProp } from '../geom.js';
import { buildCheckpoint, buildArmory, buildWarehouse, buildWorkshop, buildGuardhouse } from '../buildings.js';
import { addCar, streetLamp, transformer, blob, markingMaterial } from '../props.js';
import { concreteFence, storageTank, hazardBarrels, btr, armyTruck, barrier, watchTower, sandbags, billboard, waterTower } from '../props-industrial.js';

const FX0 = -40, FX1 = 46, FZ0 = -46, FZ1 = 40; // периметр городка
const LAIR = [2, -17]; // гнездо элиты посреди лабораторного двора

export default {
	id: 'nii',
	seed: 1971,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;

		// ---------- Дороги, дворы, стоянка ----------
		ground(150, 7, 0, 6, M.asphalt, 5, 0.02); // трасса через городок
		ground(150, 0.15, 0, 6, markingMaterial(), 6, 0.026);
		ground(44, 26.5, 2, -17.25, M.concrete, 4, 0.016); // лабораторный двор — бетонные плиты
		ground(8, 7, 1, -0.5, M.asphalt, 5, 0.019); // от трассы к воротам двора
		ground(12, 20, -35, -18, M.dirt, 4, 0.014); // вытоптанная земля у вольеров
		ground(30, 10, -2, 15.5, M.asphalt, 5, 0.019); // стоянка у заводоуправления
		ground(18, 8, 26, 17.5, M.asphalt, 5, 0.0192); // площадка у склада
		ground(6, 12, 28, -40, M.dirt, 4, 0.014); // проезд к боковой двери опытного корпуса
		ground(10, 6, -28, 12.5, M.concrete, 4, 0.017); // у караулки
		const onRoad = (x, z, m = 0) => Math.abs(z - 6) < 4 + m || (Math.abs(x - 2) < 22 + m && z < -4 + m && z > -30.5 - m)
			|| (Math.abs(x - 1) < 4 + m && z < 3 && z > -4) || (Math.abs(x + 2) < 15 + m && Math.abs(z - 15.5) < 5 + m)
			|| (Math.abs(x - 26) < 9 + m && Math.abs(z - 17.5) < 4 + m);

		// ---------- Периметр: забор с колючкой, КПП со шлагбаумом, задние ворота ----------
		concreteFence(batch, M, collide, root, FX0, FZ0, FX0, -4.6);
		concreteFence(batch, M, collide, root, FX0, 10.4, FX0, FZ1);
		concreteFence(batch, M, collide, root, FX0, FZ0, FX1, FZ0);
		concreteFence(batch, M, collide, root, FX0, FZ1, FX1, FZ1);
		concreteFence(batch, M, collide, root, FX1, FZ0, FX1, 2);
		concreteFence(batch, M, collide, root, FX1, 10, FX1, FZ1);
		buildings.push(buildCheckpoint(bctx, { name: 'Checkpoint', cx: FX0, cz: -1.5, ry: -Math.PI / 2 }));
		barrier(batch, M, collide, FX0, 2.4, Math.PI / 2, 7.2, true);
		for (const [x, z] of [[FX0, 2.2], [FX0, 10.2], [FX1, 1.8], [FX1, 10.2]]) { batch.add(place(box(0.6, 3.2, 0.6), x, 1.6, z), M.concreteDark); collide(x, z, 0.7, 0.7); }
		// задние ворота сорваны и лежат на дороге
		batch.add(place(box(3.8, 0.08, 2.2), 49.5, 0.05, 4.2, 0.35), M.metalOlive);
		batch.add(place(box(3.8, 0.08, 2.2), 48.2, 0.13, 8.4, -0.6, 0.06), M.metalOlive);
		for (const [x, z] of [[FX0 + 2.5, FZ0 + 2.5], [FX1 - 2.5, FZ0 + 2.5], [FX1 - 2.5, FZ1 - 2.5], [FX0 + 2.5, FZ1 - 2.5]]) watchTower(batch, M, collide, x, z);
		billboard(batch, M, root, collide, -52, 12.6, 0, 'СТОЙ! ЗАПРЕТНАЯ ЗОНА · П/Я-17', { w: 5.2, h: 1.1, y: 1.8, bg: '#e8dcc0', fg: '#a01a10' });

		// ---------- Охрана у КПП: «Урал», караулка за мешками ----------
		// караулка и «Урал» — в одном участке отсечения (x −33…0): меньше вызовов отрисовки
		armyTruck(batch, M, root, collide, -27.5, -2.6, Math.PI / 2 + 0.1);
		buildings.push(buildArmory(bctx, { name: 'Guardroom', cx: -28, cz: 18, ry: 0 }));
		sandbags(batch, M, collide, -26, 12.4, 3, 0);
		for (const [x, z, r] of [[-22.6, 18, 0.1], [-22.3, 19.6, 0.5]]) {
			beginProp('ammo', x, z, r);
			batch.add(place(box(1.0, 0.7, 0.7), x, 0.35, z, r), M.metalOlive);
			batch.add(place(box(0.9, 0.6, 0.6), x, 1.0, z, r + 0.1), M.metalOlive);
			endProp();
			collide(x, z, 1.1, 0.9, r);
		}

		// ---------- Лабораторный корпус (три этажа, без входа: двери заварены) ----------
		{
			const cx = 2, cz = -36, W = 34, D = 11, H = 10.4, fz = cz + D / 2;
			occluder('Lab', (kb, group) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.whiteBrick);
				kb.add(place(box(W + 0.3, 0.7, D + 0.3, 2), cx, 0.35, cz), M.concreteDark); // цоколь
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (const s of [-1, 1]) {
					kb.add(place(box(W + 0.5, 0.45, 0.2), cx, H + 0.5, cz + s * (D / 2 + 0.1)), M.concrete); // парапет
					kb.add(place(box(0.2, 0.45, D + 0.4), cx + s * (W / 2 + 0.1), H + 0.5, cz), M.concrete);
				}
				for (const y of [3.5, 7.0]) kb.add(place(box(W + 0.1, 0.22, 0.12), cx, y, fz + 0.06), M.concrete); // междуэтажные пояса
				// окна: ленты по этажам — выбитые, заклеенные, целые; по месту, без генератора случайных чисел
				for (let i = 0; i < 11; i++) for (let f = 0; f < 3; f++) {
					if (f === 0 && i === 5) continue; // над тамбуром
					const x = cx - W / 2 + 1.9 + i * 3.02, k = [0, 1, 0, 3, 1, 0, 2][(i * 3 + f * 5) % 7];
					const win = T.windowUV(new THREE.PlaneGeometry(1.8, 1.5), k);
					win.translate(x, 1.9 + f * 3.45, fz + 0.01);
					kb.add(win, M.window);
					if (f < 2 && i % 2 === 0) { const back = T.windowUV(new THREE.PlaneGeometry(1.8, 1.5), (k + 1) % 4); back.rotateY(Math.PI); back.translate(x, 1.9 + f * 3.45, cz - D / 2 - 0.01); kb.add(back, M.window); }
				}
				// тамбур входа со стеклянными дверями, козырёк
				kb.add(place(box(6, 3.3, 3, 2, 1.6), cx, 1.65, fz + 1.5), M.whiteBrick);
				kb.add(place(box(6.6, 0.25, 3.6), cx, 3.42, fz + 1.6), M.roofTar);
				kb.add(place(box(2.8, 2.4, 0.06), cx, 1.2, fz + 3.03), M.glass);
				kb.add(place(box(0.12, 2.4, 0.1), cx, 1.2, fz + 3.07), M.metalDark);
				for (const s of [-1, 1]) kb.add(place(box(1.6, 0.1, 0.1), cx + s * 0.75, 1.2, fz + 3.08, 0, 0, s * 0.5), M.metalRust); // двери заварены крест-накрест
				// на крыше: вентиляционные камеры, воздуховод, вытяжная труба
				for (const x of [-12, -4.5, 7, 13]) kb.add(place(box(1.8, 1.3, 1.8, 1), cx + x, H + 0.95, cz - 1.5), M.silver);
				kb.add(place(box(18, 0.7, 0.7, 1), cx - 1, H + 0.65, cz + 2.2), M.silver);
				kb.add(place(new THREE.CylinderGeometry(0.5, 0.65, 7, 12), cx + 15, H + 3.5, cz - 3), M.metalRust);
				const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.62), T.signMaterial('ЛАБОРАТОРНЫЙ КОРПУС № 2', { bg: '#e8e4d6', fg: '#2a3a5a', w: 640, h: 74 }));
				sign.position.set(cx, 4.05, fz + 1.5);
				group.add(sign);
				kb.add(place(box(5.6, 0.75, 0.08), cx, 4.05, fz + 1.46), M.metalDark);
			}, { cx, cz: cz + 1.5, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 1.6, top: H + 1.3 }, 0.18);
			collide(cx, cz, W, D);
			collide(cx, fz + 1.5, 6, 3);
		}

		// ---------- Виварий с вольерами и опытный корпус ----------
		buildings.push(
			buildWarehouse(bctx, { name: 'Vivarium', cx: -25, cz: -18, ry: -Math.PI / 2 }),
			buildWorkshop(bctx, { name: 'LabHall', cx: 31, cz: -22, ry: Math.PI / 2 }),
		);
		// вольеры для подопытных: прутья выгнуты изнутри, дверцы сорваны
		for (const [i, cz] of [-22.5, -17.5, -12.5].entries()) {
			const cx = -35, hw = 2, hd = 2;
			for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) batch.add(place(box(0.12, 2.3, 0.12), cx + dx * hw, 1.15, cz + dz * hd), M.metalDark);
			for (const s of [-1, 1]) {
				batch.add(place(box(2 * hw, 0.08, 0.08), cx, 2.28, cz + s * hd), M.metalDark);
				batch.add(place(box(0.08, 0.08, 2 * hd), cx + s * hw, 2.28, cz), M.metalDark);
			}
			for (let k = -hd + 0.35; k < hd - 0.2; k += 0.38) {
				const bend = i === 1 && Math.abs(k) < 0.8 ? 0.45 : 0; // вырвано изнутри
				batch.add(place(box(0.04, 2.2, 0.04), cx - hw, 1.1, cz + k, 0, 0, bend), M.metalDark);
				batch.add(place(box(0.04, 2.2, 0.04), cx + k, 1.1, cz - hd), M.metalDark);
				batch.add(place(box(0.04, 2.2, 0.04), cx + k, 1.1, cz + hd), M.metalDark);
				if (Math.abs(k) > 0.7 || i === 2) batch.add(place(box(0.04, 2.2, 0.04), cx + hw, 1.1, cz + k, 0, -bend * 0.6), M.metalDark);
			}
			if (i !== 2) batch.add(place(box(1.3, 0.05, 1.0), cx + hw + 0.9, 0.04, cz + 0.3, 0.4), M.metalDark); // сорванная дверца
			collide(cx, cz, 2 * hw + 0.2, 2 * hd + 0.2);
		}
		hazardBarrels(batch, M, collide, -35, -29, rnd, 5);

		// ---------- Ограда двора, ворота с мешками и брошенный БТР ----------
		concreteFence(batch, M, collide, root, -20, -10, -20, -4, { wire: false });
		concreteFence(batch, M, collide, root, -20, -4, -3, -4);
		concreteFence(batch, M, collide, root, 5, -4, 24, -4);
		concreteFence(batch, M, collide, root, 24, -4, 24, -10, { wire: false });
		concreteFence(batch, M, collide, root, -20, -26, -20, -32, { wire: false });
		concreteFence(batch, M, collide, root, -20, -32, -15, -32, { wire: false });
		concreteFence(batch, M, collide, root, 19, -32, 24, -32, { wire: false });
		billboard(batch, M, root, collide, 1, -4, 0, 'ОПАСНО! БИОЛОГИЧЕСКАЯ УГРОЗА', { w: 7.6, h: 1.0, y: 3.4, bg: '#e8c020', fg: '#1a1a1a' });
		sandbags(batch, M, collide, -6.8, -1.4, 3.4, 0);
		sandbags(batch, M, collide, 8.4, -1.6, 2.6, -0.25);
		btr(batch, M, root, collide, 14, -0.6, Math.PI / 2 - 0.22);
		for (const [x, z, r] of [[-3.8, -2.4, 0.2], [6, -2.6, -0.1]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }

		// ---------- Лабораторный двор: ёмкость азота, баллоны, бочки, разбитая машина ----------
		storageTank(batch, M, root, collide, -13.5, -9, 1.5, 4.4, M.tankWhite, null); // сосуд для азота (без надписи — экономия вызова отрисовки)
		{
			// стойка с газовыми баллонами у ворот опытного корпуса
			const x = 19.6, z = -12.5;
			batch.add(place(box(0.1, 1.5, 3.2), x - 0.45, 0.75, z), M.metalDark);
			batch.add(place(box(0.9, 0.08, 3.2), x, 1.2, z), M.metalDark);
			for (let i = 0; i < 7; i++) {
				const tipped = i === 5;
				const g = new THREE.CylinderGeometry(0.13, 0.13, 1.5, 10);
				if (tipped) batch.add(place(g.rotateZ(Math.PI / 2), x + 1.2, 0.13, z + 1.4, 0.7), M.red);
				else batch.add(place(g, x, 0.75, z - 1.35 + i * 0.42), i % 3 ? M.metalDark : M.red); // чёрные — азот, красные — пропан
			}
			collide(x, z, 1.0, 3.3);
		}
		hazardBarrels(batch, M, collide, -12, -27.4, rnd, 5);
		hazardBarrels(batch, M, collide, 18.4, -27, rnd, 4);
		addCar(batch, M, root, 12.5, -24, 0.5, 0xb8b0a0, { crashed: true });
		collide(12.5, -24, 4.3, 1.8, 0.5);
		// брошенные ящики
		for (const [x, z, r] of [[-9, -20.5, 0.3], [-8.2, -21.6, 1.1], [16, -7.5, 0.2]]) {
			beginProp('crate', x, z, r);
			batch.add(place(box(1.1, 0.8, 0.8), x, 0.4, z, r), M.wood);
			endProp();
			collide(x, z, 1.2, 0.9, r);
		}

		// ---------- Гнездо элиты: споровая масса, кости, кровь (не мешает ходить) ----------
		{
			const flesh = new THREE.MeshStandardMaterial({ color: 0x4a1e1c, roughness: 0.38, metalness: 0.05 });
			const blood = new THREE.MeshStandardMaterial({ map: T.bloodDecalTexture(3), transparent: true, depthWrite: false, roughness: 0.3 });
			const [lx, lz] = LAIR;
			// бугры споровой массы кольцом вокруг гнезда (середина свободна — там бой)
			for (let i = 0; i < 14; i++) {
				const a = i * 0.449 * Math.PI, d = 3.2 + (i % 4) * 0.7, s = 0.4 + (i % 3) * 0.22;
				batch.add(place(blob(s, 1, 17 + i).scale(1.3, 0.5, 1), lx + Math.cos(a) * d, s * 0.12, lz + Math.sin(a) * d, a), flesh, { cast: false });
			}
			// тяжи споровой массы извиваются по плитам от гнезда
			for (let i = 0; i < 7; i++) {
				let a = i * 0.9 + 0.4, x = lx + Math.cos(a) * 2.8, z = lz + Math.sin(a) * 2.8;
				for (let k = 0; k < 6; k++) {
					a += Math.sin(i * 3.1 + k * 1.7) * 0.45;
					const len = 1.1, nx = x + Math.cos(a) * len, nz = z + Math.sin(a) * len, r = 0.13 - k * 0.015;
					batch.add(place(new THREE.CylinderGeometry(r * 0.8, r, len + 0.12, 6).rotateZ(Math.PI / 2).scale(1, 0.6, 1), (x + nx) / 2, 0.05, (z + nz) / 2, -a), flesh, { cast: false });
					x = nx; z = nz;
				}
			}
			for (let i = 0; i < 12; i++) {
				const a = i * 2.1, d = 1 + (i % 5) * 0.9;
				batch.add(place(new THREE.CylinderGeometry(0.04, 0.05, 0.5 + (i % 3) * 0.2, 6).rotateZ(Math.PI / 2), lx + Math.cos(a) * d, 0.05, lz + Math.sin(a) * d, a * 1.7), M.concrete, { cast: false }); // кости
			}
			for (let i = 0; i < 7; i++) {
				const s = 1.6 + (i % 3) * 0.8, a = i * 0.9;
				batch.add(place(new THREE.PlaneGeometry(s, s).rotateX(-Math.PI / 2), lx + Math.cos(a) * (i % 4) * 1.4, 0.031 + i * 0.0004, lz + Math.sin(a) * (i % 4) * 1.4, a), blood, { cast: false });
			}
		}

		// ---------- Ёмкости у опытного корпуса ----------
		storageTank(batch, M, root, collide, 30, -4.2, 2.2, 6, M.tankWhite, 'АЗОТ');
		storageTank(batch, M, root, collide, 36.6, -4.2, 2.2, 6, M.tankWhite, 'КИСЛОРОД');
		hazardBarrels(batch, M, collide, 41.5, -7, rnd, 4);

		// ---------- Юг: заводоуправление НИИ со стоянкой ----------
		{
			const cx = -2, cz = 27, W = 28, D = 10, H = 7.2, nz = cz - D / 2;
			occluder('Admin', (kb, group) => {
				kb.add(place(box(W, H, D, 2, 1.6), cx, H / 2, cz), M.brick);
				kb.add(place(box(W + 0.3, 0.6, D + 0.3, 2), cx, 0.3, cz), M.concreteDark);
				kb.add(place(box(W + 0.4, 0.3, D + 0.4, 3), cx, H + 0.15, cz), M.roofTar);
				for (let i = 0; i < 9; i++) for (let f = 0; f < 2; f++) {
					for (const face of [1, -1]) {
						if (face < 0 && f === 0 && i === 4) continue; // вход
						const win = T.windowUV(new THREE.PlaneGeometry(1.4, 1.5), [0, 3, 0, 1, 0, 2, 0, 1, 3][(i * 4 + f * 3 + (face > 0 ? 0 : 5)) % 9]);
						if (face < 0) win.rotateY(Math.PI);
						win.translate(cx - W / 2 + 2 + i * 3, 1.9 + f * 3.2, cz + face * (D / 2 + 0.01));
						kb.add(win, M.window);
					}
				}
				// вход с трассы: козырёк на столбах, крыльцо, двери
				kb.add(place(box(2.4, 2.4, 0.1), cx, 1.2, nz - 0.05), M.metalDark);
				kb.add(place(box(4.4, 0.2, 2), cx, 3.0, nz - 1), M.concrete);
				for (const s of [-1, 1]) kb.add(place(box(0.25, 3, 0.25), cx + s * 2, 1.5, nz - 1.8), M.concrete);
				kb.add(place(box(4, 0.3, 1.6, 1), cx, 0.15, nz - 0.8), M.concrete);
				const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), T.signMaterial('НИИ П/Я-17', { bg: '#1e2a44', fg: '#e8e4d0', w: 640, h: 100 }));
				sign.position.set(cx, H + 1.05, cz + D / 2 - 0.4);
				group.add(sign);
				kb.add(place(box(9.2, 0.15, 0.15), cx, H + 0.3, cz + D / 2 - 0.45), M.metalDark);
			}, { cx, cz, ry: 0, hx: W / 2 + 0.3, hz: D / 2 + 1.9, top: H + 1.8 }, 0.22);
			collide(cx, cz, W, D);
			for (const s of [-1, 1]) collide(cx + s * 2, nz - 1.8, 0.4, 0.4);
		}
		addCar(batch, M, root, -12, 17.5, Math.PI / 2, 0x3a5a6a);
		collide(-12, 17.5, 4.3, 1.8, Math.PI / 2);
		addCar(batch, M, root, -8.6, 17.8, Math.PI / 2 + 0.12, 0x7a2a22);
		collide(-8.6, 17.8, 4.3, 1.8, Math.PI / 2 + 0.12);
		addCar(batch, M, root, 7.5, 17.2, -Math.PI / 2 + 0.2, 0x5a5a3a, { burned: true });
		collide(7.5, 17.2, 4.3, 1.8, -Math.PI / 2 + 0.2);
		for (const x of [15, 32]) streetLamp(batch, M, collide, x, 11.2);
		transformer(batch, root, M, collide, 16, 15);

		// ---------- Склад, задний пост, водонапорная башня ----------
		buildings.push(
			buildWarehouse(bctx, { name: 'Store', cx: 26, cz: 27, ry: 0 }),
			buildGuardhouse(bctx, { name: 'Post', cx: 40, cz: 15, ry: 0 }),
		);
		occluder('WaterTower', (kb) => waterTower(kb, M, collide, 40.5, 31), { cx: 40.5, cz: 31, ry: 0, hx: 3.0, hz: 3.0, top: 17.4 }, 0.2);
		hazardBarrels(batch, M, collide, 20, 35.6, rnd, 4);

		// ---------- Окраина, за забором ----------
		// запад: брошенный «Урал» и бетонные блоки на трассе перед КПП
		armyTruck(batch, M, root, collide, -51, -0.4, Math.PI / 2 - 0.08);
		for (const [x, z, r] of [[-46, 3.6, 0.1], [-44.6, 8.6, -0.15], [-56, 10.8, 0.4]]) { beginProp('block', x, z, r); batch.add(place(box(1.8, 0.9, 0.9, 1), x, 0.45, z, r), M.concreteDark); endProp(); collide(x, z, 1.8, 0.9, r); }
		// север: могильник — бочки с химией в лесу
		hazardBarrels(batch, M, collide, -8, -55, rnd, 6);
		hazardBarrels(batch, M, collide, 4, -57, rnd, 5);
		hazardBarrels(batch, M, collide, 14, -54, rnd, 6);
		// восток: разбитая машина у дороги
		addCar(batch, M, root, 55, 3.6, 0.25, 0x6a6a5a, { crashed: true });
		collide(55, 3.6, 4.3, 1.8, 0.25);

		return {
			start: [-59, 6, Math.PI / 2],
			exits: [
				{ to: 'himmash', x0: -66, x1: -61.2, z0: 2, z1: 10, spawn: [-59, 6, Math.PI / 2], sign: [-60, 11.2, '← Химмаш'] },
				{ to: 'voench', x0: 61.2, x1: 66, z0: 2, z1: 10, spawn: [59, 6, -Math.PI / 2], sign: [60, 11.2, 'Военная часть →'] },
			],
			// логово элиты: во дворе лаборатории — только элита со своей стаей (рубер и бегуны), остальные — вокруг двора:
			// руберы в опытном корпусе, на стоянке и у ёмкостей; топтуны в виварии, за корпусами и у ворот
			groups: [
				{ at: LAIR, r: 6, elites: 1, rubers: 1, runners: 4 },
				{ at: [31, -22], r: 4, rubers: 1, runners: 1 },
				{ at: [-25, -18], r: 3, stompers: 1, runners: 1 },
				{ at: [-8, -43], r: 4, stompers: 1, runners: 2 },
				{ at: [42, -24], r: 4, runners: 2, stompers: 1 },
				{ at: [-32, 4], r: 5, runners: 2, stompers: 1 },
				{ at: [-2, 14], r: 6, runners: 2, rubers: 1 },
				{ at: [26, 18], r: 5, stompers: 1, runners: 1 },
				{ at: [34, -9], r: 4, rubers: 1 },
				{ at: [40, 6], r: 5, runners: 2 },
				{ at: [12, 6], r: 8, runners: 2 },
				{ at: [-28, 30], r: 5, runners: 1, stompers: 1 },
				{ at: [10, -42], r: 5, runners: 2 },
				// окраина
				{ at: [-54, 20], r: 6, runners: 2 },
				{ at: [54, -20], r: 6, runners: 1, stompers: 1 },
				{ at: [3, -52], r: 6, stompers: 1, runners: 1 },
				{ at: [-20, 54], r: 7, runners: 2, stompers: 1 },
				{ at: [54, 32], r: 6, runners: 2 },
			],
			onRoad,
			// горит брошенный БТР у ворот двора, бочка у КПП, тлеет у вольеров
			fires: [[14, -0.6, 'car', 2.1], [-34.5, 9.8], [-30, -26, 'ground']],
			barrels: 6,
			trees(tryTree) {
				// за забором — сосновый лес; в городке — берёзы вдоль трассы и у заводоуправления
				for (let i = 0; i < 40; i++) tryTree(R(-62, 62), R(-62, FZ0 - 1.5), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 30; i++) tryTree(R(-62, FX0 - 1.5), R(-44, 62), rnd() < 0.75 ? 'pine' : 'birch');
				for (let i = 0; i < 20; i++) tryTree(R(-38, 62), R(FZ1 + 1.5, 62), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 14; i++) tryTree(R(FX1 + 1.5, 62), R(-44, 38), rnd() < 0.7 ? 'pine' : 'birch');
				for (let i = 0; i < 12; i++) tryTree(R(-24, 34), R(10.5, 12.5), 'birch');
				for (let i = 0; i < 10; i++) tryTree(R(-36, 44), R(33, 38), 'birch');
			},
			clutter: 14,
			blood: 30,
			puddles: 12,
			puddle: () => [R(-40, 46), rnd() < 0.5 ? R(3, 9) : R(-28, -6)],
			grass: 0.7,
			beltTrees: ['pine', 'pine', 'birch'],
			hint: (b) => ({
				Checkpoint: 'КПП НИИ — стол дежурного и шкаф',
				Guardroom: 'Караулка охраны — пирамиды с оружием, ящик гранат, сейф',
				Vivarium: 'Виварий — стеллажи с ящиками; клетки пусты',
				LabHall: 'Опытный корпус — шкафчики в раздевалке, верстак, сейф заведующего',
				Store: 'Склад НИИ — стеллажи с ящиками, бывают гранаты',
				Post: 'Пост у задних ворот — шкаф охранника и сейф',
			}[b.name]),
		};
	},
};
