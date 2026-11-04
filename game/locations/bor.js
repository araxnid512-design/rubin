// Кластер «Деревня Бор»: деревня на опушке соснового бора на окраине Улья. Грунтовая улица идёт с юга (от базы
// «Опорный») на север (к Лесопилке), от центра на восток уходит дорога к Дачам. Вдоль улицы — избы с огородами,
// банями, сараями и колодцами за заборами; в центре — сельпо, площадь с обелиском павшим, остановка и колодец;
// к западу — деревянная церковь с колокольней, за ней сосняк и кладбище с оградками; к востоку от улицы — колхозная
// ферма «Заря»: длинный коровник со стойлами, силосная башня, сеновал с рулонами сена, трактор с прицепом;
// на юго-востоке — пруд с мостками, банькой и берёзами. Брошено, но не разрушено: заборы стоят, окна целы через одно.
// Опасность 1: тихая окраина — бегуны по дворам и улице, два-три топтуна (площадь, ферма, кладбище).

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { boxTop } from '../facade.js';
import { Building, buildHouse, buildDacha, buildShop } from '../buildings.js';
import { addCar, fencePlot, woodpile, outhouse, well, shed, garden, bench, pond, clothesline, waterBarrel, settlementSign, powerLine, transformer } from '../props.js';
import { billboard } from '../props-industrial.js';

const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);

/** Матрица «поставить в точку (x, z) с поворотом ry» и добавление коробки в её осях. */
function placer(batch, x, z, ry) {
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
	return (g, mat, px, py, pz, opts) => batch.add(g.translate(px, py, pz).applyMatrix4(tf), mat, opts);
}

/** Колёсный трактор (зелёный «ЮМЗ»): капот, кабина, большие задние колёса. Перед — локальная +X. */
function tractor(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(3.0, 0.45, 0.9), M.metalDark, 0.2, 0.75, 0); // рама
	add(box(1.7, 0.75, 0.95, 1.2), M.green, 0.85, 1.32, 0); // капот
	add(box(0.1, 0.5, 0.8), M.metalDark, 1.72, 1.25, 0); // решётка радиатора
	add(box(1.25, 1.2, 1.35), M.metalDark, -0.75, 2.1, 0); // кабина (стёкла — тёмные)
	add(box(1.45, 0.1, 1.55), M.green, -0.75, 2.75, 0); // крыша кабины
	for (const s of [-1, 1]) {
		add(cyl(0.78, 0.78, 0.45, 16).rotateX(Math.PI / 2), M.tire, -0.75, 0.78, s * 0.98);
		add(cyl(0.45, 0.45, 0.28, 12).rotateX(Math.PI / 2), M.tire, 1.25, 0.45, s * 0.72);
		add(box(1.4, 0.06, 0.5), M.green, -0.75, 1.62, s * 0.98); // крылья над задними колёсами
	}
	add(cyl(0.05, 0.05, 1.1, 6), M.metalDark, 1.3, 2.1, 0.32); // выхлопная труба
	add(box(0.3, 0.3, 0.9), M.metalDark, -1.75, 0.7, 0); // фаркоп
	collide(x, z, 3.7, 2.5, ry);
}

/** Тракторный прицеп с сеном: рама, кузов с бортами, два ската, дышло вперёд (+X). */
function trailer(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(4.2, 0.2, 0.5), M.metalDark, 0, 0.72, 0);
	add(box(4.0, 0.75, 2.0, 1.5), M.metalRust, 0, 1.22, 0);
	add(new THREE.SphereGeometry(1.2, 10, 7).scale(1.6, 0.5, 0.82), M.woodYellow, 0, 1.75, 0); // сено горкой
	for (const dx of [-1.3, 1.1]) for (const s of [-1, 1]) add(cyl(0.5, 0.5, 0.3, 12).rotateX(Math.PI / 2), M.tire, dx, 0.5, s * 1.05);
	add(box(1.7, 0.12, 0.12), M.metalDark, 2.8, 0.68, 0); // дышло
	collide(x, z, 5.6, 2.2, ry);
}

/** Сельская остановка: кирпичная коробка без передней стенки, лавка внутри. Открыта в сторону локальной +Z. */
function busStop(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(4.6, 2.4, 0.15, 1.5), M.whiteBrick, 0, 1.2, -0.75);
	for (const dx of [-2.25, 2.25]) add(box(0.15, 2.4, 1.6, 1.5), M.whiteBrick, dx, 1.2, 0);
	add(box(5.0, 0.12, 2.0, 2), M.roofMetal, 0, 2.5, 0.05);
	add(box(3.8, 0.08, 0.42), M.wood, 0, 0.5, -0.4);
	for (const dx of [-1.6, 1.6]) add(box(0.08, 0.5, 0.4), M.wood, dx, 0.25, -0.4);
	collide(x, z, 4.7, 1.7, ry);
}

/** Обелиск павшим односельчанам: бетонная пирамидка со звездой, табличка, оградка из труб. Лицом к югу. */
function monument(batch, M, collide, x, z) {
	batch.add(place(box(1.6, 0.4, 1.6, 1), x, 0.2, z), M.concrete);
	batch.add(place(box(1.1, 0.5, 1.1, 1), x, 0.65, z), M.concrete);
	batch.add(place(cyl(0.22, 0.4, 3.2, 4).rotateY(Math.PI / 4), x, 2.5, z), M.concrete);
	const star = new THREE.Shape();
	for (let i = 0; i < 10; i++) {
		const r = i % 2 ? 0.14 : 0.32, a = Math.PI / 2 + (i * Math.PI) / 5;
		if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
	}
	star.closePath();
	batch.add(place(new THREE.ShapeGeometry(star), x, 3.4, z + 0.21), M.red);
	batch.add(place(box(0.7, 0.45, 0.04), x, 1.35, z + 0.57), M.metalDark); // табличка (материал оградки — без лишнего вызова)
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) batch.add(place(box(0.06, 0.6, 0.06), x + sx * 1.6, 0.3, z + sz * 1.6), M.metalDark);
	for (const s of [-1, 1]) {
		batch.add(place(box(3.2, 0.04, 0.04), x, 0.55, z + s * 1.6), M.metalDark);
		batch.add(place(box(0.04, 0.04, 3.2), x + s * 1.6, 0.55, z), M.metalDark);
	}
	collide(x, z, 3.4, 3.4);
}

/** Жердяная изгородь от (x0,z0) до (x1,z1): столбы через 3 м, две жерди; gap — [t0, t1] доля длины без изгороди. */
function railFence(batch, M, collide, x0, z0, x1, z1, gap = null) {
	const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.max(1, Math.round(len / 3)), sl = len / n;
	const at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
	const inGap = (t) => gap && t > gap[0] + 0.01 && t < gap[1] - 0.01;
	for (let i = 0; i <= n; i++) {
		if (inGap(i / n)) continue;
		const [x, z] = at(i / n);
		batch.add(place(box(0.14, 1.3, 0.14), x, 0.65, z), M.woodGrey);
	}
	for (let i = 0; i < n; i++) {
		const tm = (i + 0.5) / n;
		if (inGap(tm)) continue;
		const [x, z] = at(tm);
		for (const y of [0.5, 1.0]) batch.add(place(box(sl, 0.1, 0.07), x, y, z, -ang), M.woodGrey);
		collide(x, z, sl, 0.2, -ang);
	}
}

/** Силосная башня: бетонные кольца, конус крыши, лесенка, жёлоб выгрузки. */
function silo(batch, M, collide, x, z) {
	batch.add(place(cyl(2.3, 2.3, 12, 18), x, 6, z), M.concrete);
	for (const y of [3, 6, 9]) batch.add(place(cyl(2.42, 2.42, 0.25, 18), x, y, z), M.concreteDark);
	batch.add(place(new THREE.ConeGeometry(2.7, 1.9, 18), x, 12.9, z), M.roofMetal);
	batch.add(place(cyl(0.3, 0.3, 0.8, 8), x, 14, z), M.metalDark);
	for (let y = 0.8; y < 12; y += 0.5) batch.add(place(box(0.5, 0.04, 0.05), x + 2.36, y, z), M.metalDark);
	batch.add(place(box(5, 0.45, 0.45), x - 4.3, 8.2, z + 1.0, 0, 0, 0.5), M.metalRust); // жёлоб выгрузки
	batch.add(place(box(0.2, 7.0, 0.2), x - 6.3, 3.5, z + 1.0), M.metalDark); // опора жёлоба
	collide(x, z, 5, 5);
	collide(x - 6.3, z + 1.0, 0.4, 0.4);
}

/**
 * Сельское кладбище внутри ограды: холмики, деревянные и железные кресты, пирамидки со звёздами, у трети —
 * оградки из труб. Посередине — дорожка от калитки (ряды её не занимают).
 */
function cemetery(batch, M, collide, rnd, R) {
	const cross = (x, z, mat) => {
		batch.add(place(box(0.09, 1.7, 0.09), x, 0.85, z), mat);
		batch.add(place(box(0.7, 0.09, 0.07), x, 1.3, z), mat);
		batch.add(place(box(0.4, 0.07, 0.06), x, 0.75, z, 0, 0, 0.35), mat);
	};
	for (const z of [35.5, 38.5, 45.5, 48.5]) for (let x = -50; x <= -35; x += 2.5) {
		const gx = x + R(-0.15, 0.15), gz = z + R(-0.15, 0.15), k = rnd();
		batch.add(place(new THREE.SphereGeometry(0.5, 8, 6).scale(0.9, 0.4, 1.9), gx, 0.04, gz), M.dirt);
		if (k < 0.45) cross(gx, gz - 0.9, M.woodGrey);
		else if (k < 0.75) cross(gx, gz - 0.9, M.metalDark);
		else {
			batch.add(place(cyl(0.1, 0.2, 1.5, 4).rotateY(Math.PI / 4), gx, 0.75, gz - 0.9), M.silver);
			batch.add(place(box(0.22, 0.22, 0.04), gx, 1.62, gz - 0.9, Math.PI / 4), M.red);
		}
		if (rnd() < 0.35) {
			for (const sx of [-1, 1]) for (const sz of [-1, 1]) batch.add(place(box(0.05, 0.55, 0.05), gx + sx * 0.8, 0.27, gz + sz * 1.3), M.metalDark);
			for (const s of [-1, 1]) {
				batch.add(place(box(1.6, 0.04, 0.04), gx, 0.5, gz + s * 1.3), M.metalDark);
				batch.add(place(box(0.04, 0.04, 2.6), gx + s * 0.8, 0.5, gz), M.metalDark);
			}
			collide(gx, gz, 1.7, 2.7);
		} else collide(gx, gz, 1.0, 2.0);
	}
}

// ---------- Церковь (можно зайти): сруб 7×11 м, колокольня над входом, главка с крестом; внутри иконостас ----------

function buildChurch(ctx, { name = 'Church', cx, cz, ry = 0 }) {
	const W = 7, D = 11, H = 3.4, rise = 2.2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: 12.8 });
	const { M } = ctx, IM = b.IM;
	const t = 0.22, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	for (const [w, d, x, z] of [[W + 0.3, 0.25, 0, -hz - 0.05], [W + 0.3, 0.25, 0, hz + 0.05], [0.25, D + 0.3, -hx - 0.05, 0], [0.25, D + 0.3, hx + 0.05, 0]]) {
		b.lower(place(box(w, 0.35, d, 2), x, 0.175, z), M.concreteDark);
	}
	// сруб с побелкой внутри; дверь в передней стене (−Z локально)
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.wood, t, doors: [0], w: 1.5, lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.wood, t, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.wood, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.wood, t, lining: IM.whitewash, side: -1 });
	for (const z of [-2.2, 1.2]) { b.window('left', z, { t, trim: M.woodGrey }); b.window('right', z, { t, trim: M.woodGrey }); }
	// крыльцо, открытая дверь, навес на столбах
	b.lower(place(box(2.2, 0.18, 1.2), 0, 0.09, -hz - 0.75), M.woodGrey);
	b.lower(place(boxTop(1.8, 0.09, 0.4), 0, 0.045, -hz - 1.5), M.woodGrey);
	b.furniture(-0.7, -hz + 0.1, -1.75, [[1.3, 2.05, 0.05, 0.65, 1.03, 0, M.woodGrey]], { up: true });
	b.canopy('front', 0, { w: 2.4, d: 1.3, y: 2.6, mat: M.slate, posts: M.woodGrey, t });
	// двускатная крыша, конёк вдоль Z; фронтоны — доски
	const half = hx + 0.45, slope = Math.hypot(half, rise), a = Math.atan2(rise, half);
	for (const s of [-1, 1]) b.top_(place(box(slope, 0.08, D + 0.9, 2), (s * half) / 2, H + rise / 2, 0, 0, 0, -s * a), M.slate);
	b.top_(place(boxTop(0.24, 0.1, D + 0.94, 1), 0, H + rise + 0.04, 0), M.woodGrey);
	for (const sz of [-1, 1]) {
		const z = sz * (hz + 0.01);
		const p = [-hx, H, z], q = [hx, H, z], tp = [0, H + rise, z];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sz > 0 ? [...p, ...q, ...tp] : [...p, ...tp, ...q]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sz > 0 ? [0, 0, W / 2, 0, W / 4, 1] : [0, 0, W / 4, 1, W / 2, 0]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.wood);
	}
	// колокольня над входом: четверик сквозь крышу, звонница на столбах с колоколом, шатёр, луковка с крестом
	const onion = (x, y, z, r, dome) => {
		b.top_(place(cyl(r * 0.5, r * 0.5, r * 0.9, 10), x, y + r * 0.45, z), M.woodGrey);
		b.top_(place(new THREE.SphereGeometry(r, 12, 10).scale(1, 1.3, 1), x, y + r * 0.9 + r * 1.15, z), dome);
		const top = y + r * 0.9 + r * 2.45;
		b.top_(place(cyl(0.02, 0.07, r * 0.5, 6), x, top + r * 0.2, z), dome);
		b.top_(place(box(0.05, 1.0, 0.05), x, top + r * 0.4 + 0.5, z), M.yellow);
		b.top_(place(box(0.5, 0.05, 0.05), x, top + r * 0.4 + 0.75, z), M.yellow);
		b.top_(place(box(0.3, 0.04, 0.04), x, top + r * 0.4 + 0.3, z, 0, 0, 0.5), M.yellow);
	};
	const tz = -hz + 2.2, y1 = H + rise + 1.2;
	b.top_(place(box(2.8, y1 - H - 0.6, 2.8, 1.2), 0, (H + 0.6 + y1) / 2, tz), M.wood);
	b.top_(place(box(3.1, 0.2, 3.1, 1), 0, y1 + 0.1, tz), M.woodGrey);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.top_(place(box(0.16, 1.9, 0.16), sx * 1.2, y1 + 1.15, tz + sz * 1.2), M.woodGrey);
	for (const s of [-1, 1]) {
		b.top_(place(box(2.5, 0.45, 0.06), 0, y1 + 0.45, tz + s * 1.2), M.woodGrey);
		b.top_(place(box(0.06, 0.45, 2.5), s * 1.2, y1 + 0.45, tz), M.woodGrey);
	}
	b.top_(place(cyl(0.22, 0.34, 0.45, 10), 0, y1 + 1.45, tz), M.yellow); // колокол
	b.top_(place(new THREE.ConeGeometry(2.15, 1.7, 4).rotateY(Math.PI / 4), 0, y1 + 2.1 + 0.85, tz), M.slate); // шатёр
	onion(0, y1 + 3.65, tz, 0.42, M.yellow);
	// главка над молельным залом
	onion(0, H + rise - 0.3, 2.4, 0.95, M.yellow);
	// внутри: иконостас у дальней стены, аналой и подсвечники, лавки вдоль стен, дорожка
	const icons = [[6.4, 2.8, 0.2, 0, 1.4, 0, IM.furnitureLight], [1.2, 2.0, 0.06, 0, 1.0, 0.12, M.yellow]];
	for (let i = 0; i < 5; i++) {
		const x = -2.4 + i * 1.2, y = i === 2 ? 2.45 : 1.3;
		icons.push([0.8, 0.95, 0.03, x, y, 0.11, M.yellow], [0.66, 0.8, 0.04, x, y, 0.125, IM.blanket]);
	}
	b.furniture(0, hz - 0.42, Math.PI, icons, { solid: [6.4, 0.3] });
	b.furniture(0, 2.2, 0, [[0.6, 1.0, 0.5, 0, 0.5, 0, IM.furniture], [0.7, 0.04, 0.6, 0, 1.08, 0, IM.blanket]], { solid: [0.6, 0.5] }); // аналой
	for (const x of [-1.8, 1.8]) b.furniture(x, 2.0, 0, [[0.06, 1.1, 0.06, 0, 0.55, 0, IM.cans], [0.5, 0.04, 0.5, 0, 1.12, 0, IM.cans], [0.2, 0.02, 0.2, 0, 0.3, 0, IM.cans]], { solid: [0.5, 0.5] });
	for (const x of [-hx + 0.45, hx - 0.45]) b.furniture(x, -1.3, 0, [[0.4, 0.45, 2.4, 0, 0.22, 0, IM.furnitureLight]], { solid: [0.4, 2.4] });
	b.lower(place(planeXZ(1.6, 7.0, 1.6, 1.6), 0, 0.032, -0.8), IM.rug, { cast: false });
	// тайники: свечной ящик у входа и сундук в притворе
	b.container('Свечной ящик', hx - 0.62, -hz + 1.7, -Math.PI / 2, [
		[1.2, 1.0, 0.6, 0, 0.5, 0, IM.furniture], [1.25, 0.05, 0.65, 0, 1.03, 0, IM.furnitureLight],
		[0.3, 0.12, 0.3, 0.3, 1.11, 0, IM.cans], [0.4, 0.08, 0.3, -0.25, 1.09, 0.05, IM.books[0]],
	], [1.2, 0.6], { zhivchik: 0.5, spore: [1, 3, 0.45], ammo919: [3, 6, 0.3] }, 1.1);
	b.container('Сундук', -hx + 0.55, -hz + 1.5, Math.PI / 2, [
		[1.0, 0.5, 0.55, 0, 0.25, 0, IM.furnitureLight], [1.02, 0.08, 0.57, 0, 0.53, 0, IM.furniture],
		[0.06, 0.58, 0.58, -0.32, 0.29, 0, IM.metal], [0.06, 0.58, 0.58, 0.32, 0.29, 0, IM.metal],
	], [1.0, 0.55], { ammo12: [4, 8, 0.5], dbarrel: 0.08, spore: 0.3, zhivchik: 0.25 }, 0.57);
	return b.finish();
}

// ---------- Коровник (можно зайти): кирпичный 30×10 м, ворота в торцах, два ряда стойл, в углах — каморки ----------

function buildCowshed(ctx, { name = 'Cowshed', cx, cz, ry = 0 }) {
	const W = 30, D = 10, H = 3.2, rise = 2.2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + rise });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	const t = 0.3, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concreteDark, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [-9], lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: [0], w: 3.2, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, doors: [0], w: 3.2, lining: IM.whitewash, side: -1 });
	for (const x of [-12, -6, 0, 6, 12]) { b.window('front', x, { y: 2.2, t, sill: M.whiteBrick }); b.window('back', x, { y: 2.2, t, sill: M.whiteBrick }); }
	// створки ворот распахнуты к стенам, дверь каморки открыта, козырёк
	for (const side of ['left', 'right']) for (const s of [-1, 1]) b.wallBox(side, s * 2.25, 1.2, 0.02, 2.05, 0.06, M.metalRust, { t });
	b.wallBox('front', -9 + 1.2, 1.1, 0.02, 2.05, 0.05, M.woodGrey, { t });
	b.canopy('front', -9, { w: 1.8, d: 1.0, y: 2.4, mat: M.slate, t });
	b.lower(place(box(1.6, 0.16, 1.0), -9, 0.08, -hz - 0.6), M.concrete);
	// шиферная крыша, конёк вдоль X; фронтоны кирпичные; дефлекторы
	const half = hz + 0.5, slope = Math.hypot(half, rise), a = Math.atan2(rise, half);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.8, 0.08, slope, 2), 0, H + rise / 2, (s * half) / 2, 0, s * a), M.slate);
	b.top_(place(boxTop(W + 0.84, 0.1, 0.26, 1), 0, H + rise + 0.04, 0), M.woodGrey);
	for (const sx of [-1, 1]) {
		const x = sx * (hx + 0.01);
		const p = [x, H, -hz], q = [x, H, hz], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...p, ...tp, ...q] : [...p, ...q, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 4, 1, D / 2, 0] : [0, 0, D / 2, 0, D / 4, 1]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.whiteBrick);
	}
	for (const x of [-10, 0, 10]) b.vent(x, 0, H + rise - 0.1, M.silver, { h: 0.7, r: 0.18 });
	// стойла вдоль длинных стен: кормушки-жёлоба, перегородки из труб; в проходе — бидоны
	for (const s of [-1, 1]) {
		b.furniture(0, s * (hz - 0.65), 0, [[25, 0.45, 0.55, 0, 0.22, 0, M.concreteDark], [24.6, 0.05, 0.3, 0, 0.42, 0, IM.rag]], { solid: [25, 0.55] });
		for (let x = -11; x <= 11; x += 2.2) {
			b.furniture(x, s * (hz - 1.6), 0, [
				[0.06, 1.2, 0.06, 0, 0.6, -s * 0.8, IM.metal], [0.06, 0.06, 1.7, 0, 1.15, 0, IM.metal], [0.06, 0.06, 1.7, 0, 0.6, 0, IM.metal],
			], { solid: [0.12, 1.7] });
		}
	}
	// солома в стойлах (готовая геометрия — в осях здания, без смещения мебели), бидоны в проходе
	for (let i = 0; i < 6; i++) {
		const sx = i % 2 ? 1 : -1, x = -9.9 + (i % 3) * 6.6 + (i >= 3 ? 2.2 : 0);
		b.furniture(0, 0, 0, [[0, 0, 0, 0, 0, 0, M.woodYellow, { geo: new THREE.SphereGeometry(0.6, 8, 6).scale(1.2, 0.45, 1.1).translate(x, 0.1, sx * (hz - 1.6)) }]]);
	}
	for (const [x, z] of [[-2.6, -1.9], [-2.1, -1.5], [-2.6, -1.3]]) b.furniture(0, 0, 0, [[0, 0, 0, 0, 0, 0, M.silver, { geo: cyl(0.17, 0.2, 0.55, 10).translate(x, 0.28, z) }]]);
	b.furniture(-2.4, -1.6, 0, [], { solid: [1.0, 1.0] });
	// тайники: шкаф ветеринара и ящик с комбикормом у западных ворот, верстак у восточных
	b.container('Шкаф ветеринара', -hx + 0.6, 2.3, Math.PI / 2, [
		[1.0, 1.8, 0.45, 0, 0.9, 0, IM.white], [0.02, 1.7, 0.02, 0, 0.9, 0.23, IM.black],
		[0.3, 0.1, 0.02, 0, 1.3, 0.24, IM.redBoard], [0.1, 0.3, 0.02, 0, 1.3, 0.25, IM.redBoard],
	], [1.0, 0.45], { zhivchik: [1, 2, 0.6], ammo919: [3, 6, 0.3] }, 1.8);
	b.container('Ящик с комбикормом', -hx + 0.95, -2.3, Math.PI / 2, [[1.4, 0.7, 1.0, 0, 0.35, 0, IM.crate], [1.2, 0.3, 0.8, 0, 0.75, 0, IM.rag]], [1.4, 1.0], { ammo12: [4, 8, 0.55], spore: 0.25, dbarrel: 0.05 }, 0.9);
	b.container('Верстак', hx - 0.6, 2.3, -Math.PI / 2, [
		[2.0, 0.85, 0.8, 0, 0.42, 0, IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, IM.machine],
	], [2.0, 0.8], { ammo12: [3, 6, 0.45], fireaxe: 0.08, ammo762: [4, 8, 0.2] }, 1.0);
	return b.finish();
}

// избы с участками: [cx, cz, W, D] — для яблонь
const PLOTS = [[-14.5, 28, 17, 15], [-14.5, -38, 17, 15], [14.5, 30, 17, 15], [30, -3, 18, 15], [13.5, -24, 13, 12]];

export default {
	id: 'bor',
	seed: 4411,
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		M.shopSign = T.signMaterial('СЕЛЬПО', { bg: '#dbd3b0', fg: '#2a3f7a' });

		// ---------- Дороги: улица с юга на север, дорога на восток к Дачам, съезд на ферму, площадь, дорожки ----------
		ground(7, 140, 0, 0, M.dirt, 4, 0.02); // улица (z −70…70)
		ground(70, 7, 35, 10, M.dirt, 4, 0.018); // на восток, к Дачам
		ground(21, 6, 13.5, -33, M.dirt, 4, 0.017); // съезд к ферме
		ground(36, 32, 42, -35, M.dirt, 5, 0.014); // двор фермы
		ground(9, 9, -9.5, 3, M.concrete, 3, 0.015); // площадь с обелиском — плиты
		ground(14, 4, -10, -3.5, M.dirt, 4, 0.016); // проулок к церкви
		ground(18, 18, -25, -11, M.dirt, 4, 0.013); // церковный двор
		ground(26, 3.5, -17.5, 42, M.dirt, 4, 0.016); // дорожка на кладбище
		ground(5, 15, 5.3, -8, M.dirt, 4, 0.017); // перед сельпо
		for (const [x, z] of [[-4.75, 28], [4.75, 30], [-4.75, -38], [5.25, -24]]) ground(2.5, 4, x, z, M.dirt, 4, 0.017); // тропинки к калиткам
		ground(4, 2, 34.25, 5.5, M.dirt, 4, 0.017);
		const roads = [
			[-3.5, 3.5, -70, 70], [0, 70, 6.5, 13.5], [3, 24, -36, -30], [24, 60, -51, -19], [-17, -3, -5.5, -1.5], [-34, -16, -20, -2],
			[-14, -5, -1.5, 7.5], [-30.5, -4.5, 40.25, 43.75], [2.8, 7.8, -15.5, -0.5],
		];
		const onRoad = (x, z, m = 0) => roads.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

		// ---------- Центр: сельпо, площадь с обелиском, остановка, колодец, доска объявлений ----------
		buildings.push(buildShop(bctx, { cx: 11.5, cz: -8 }));
		addCar(batch, M, root, 4.8, -4, Math.PI / 2 + 0.08, 0x6a7a4a); // «Нива» у крыльца
		collide(4.8, -4, 4.3, 1.8, Math.PI / 2 + 0.08);
		batch.add(place(box(1.6, 1.0, 0.08), 8.6, 1.5, 0.6), M.woodGrey); // доска объявлений
		for (const dx of [-0.7, 0.7]) batch.add(place(box(0.08, 2.0, 0.08), 8.6 + dx, 1.0, 0.6), M.wood);
		collide(8.6, 0.6, 1.7, 0.3);
		monument(batch, M, collide, -9.5, 1);
		bench(batch, M, -13, 5.8, 0);
		bench(batch, M, -6, 5.8, 0);
		busStop(batch, M, collide, 7.5, 18, -Math.PI / 2);
		well(batch, M, collide, -6.5, 14);
		powerLine(batch, root, M, collide, 12, 56, 15.5); // только вдоль дороги на Дачи: каждый провод — вызов отрисовки
		settlementSign(batch, M, root, collide, 6, 50, 'ДЕРЕВНЯ БОР');
		addCar(batch, M, root, -1.6, 44, Math.PI / 2 + 0.25, 0xb8b0a0, { crashed: true });
		collide(-1.6, 44, 4.3, 1.8, Math.PI / 2 + 0.25);
		addCar(batch, M, root, 1, -52, Math.PI / 2 - 0.2, 0x1c1a18, { burned: true });
		collide(1, -52, 4.3, 1.8, Math.PI / 2 - 0.2);

		// ---------- Избы с участками (можно зайти): огороды, бани, сараи, колодцы, дровники ----------
		buildings.push(
			buildHouse(bctx, { name: 'House1', cx: -14, cz: 28, ry: -Math.PI / 2, rnd, variant: 0 }),
			buildHouse(bctx, { name: 'House2', cx: -14, cz: -38, ry: -Math.PI / 2, rnd, variant: 1 }),
			buildHouse(bctx, { name: 'House3', cx: 14, cz: 30, ry: Math.PI / 2, rnd, variant: 2 }),
			buildHouse(bctx, { name: 'House4', cx: 30, cz: -2, ry: Math.PI, rnd, variant: 3 }),
			buildDacha(bctx, { name: 'OldHouse', cx: 15, cz: -24, ry: Math.PI / 2, rnd, variant: 1, paint: M.woodGrey }),
		);
		// дом 1 — у площади, западная сторона: баня, огород, бельё
		fencePlot(batch, M, collide, -14.5, 28, 17, 15, 'e', rnd);
		garden(batch, M, rnd, -21, 28, 3, 8);
		shed(batch, M, collide, -20.5, 22.5, 0.05); // баня
		outhouse(batch, M, collide, -11.5, 34.4, Math.PI);
		woodpile(batch, M, collide, -21.5, 34.4, 0);
		well(batch, M, collide, -8, 24);
		waterBarrel(batch, M, collide, -18.5, 22.2);
		// дом 2 — северный край, западная сторона
		fencePlot(batch, M, collide, -14.5, -38, 17, 15, 'e', rnd);
		garden(batch, M, rnd, -21, -38, 3, 8);
		shed(batch, M, collide, -20.5, -32.8, -0.05);
		clothesline(batch, M, root, collide, -20, -16.5, -42.5, rnd); // бельё — подальше от центра (у каждой тряпки свой материал)
		outhouse(batch, M, collide, -20, -44.3, 0);
		woodpile(batch, M, collide, -14, -43.5, 0);
		well(batch, M, collide, -8.5, -40);
		waterBarrel(batch, M, collide, -18.3, -44.2);
		// дом 3 — у остановки, восточная сторона
		fencePlot(batch, M, collide, 14.5, 30, 17, 15, 'w', rnd);
		garden(batch, M, rnd, 21, 30, 3, 8);
		shed(batch, M, collide, 20.5, 36.2, 0.05); // сарай
		outhouse(batch, M, collide, 14, 36.4, Math.PI);
		woodpile(batch, M, collide, 20, 24.2, 0);
		well(batch, M, collide, 8, 34);
		waterBarrel(batch, M, collide, 18.5, 24);
		// дом 4 — у дороги на Дачи, лицом на юг
		fencePlot(batch, M, collide, 30, -3, 18, 15, 's', rnd);
		garden(batch, M, rnd, 30, -8.5, 6, 3);
		shed(batch, M, collide, 23.4, -2, 0); // баня
		outhouse(batch, M, collide, 37.5, -8.5, Math.PI);
		woodpile(batch, M, collide, 23.3, -8, Math.PI / 2);
		well(batch, M, collide, 27, 3);
		waterBarrel(batch, M, collide, 37, -3);
		// старый домик — у съезда на ферму
		fencePlot(batch, M, collide, 13.5, -24, 13, 12, 'w', rnd);
		garden(batch, M, rnd, 19.3, -24, 2, 6);
		outhouse(batch, M, collide, 18.8, -28.5, Math.PI);
		woodpile(batch, M, collide, 15, -29, 0);
		well(batch, M, collide, 9, -27.5);

		// ---------- Церковь (можно зайти), двор с лавками и поклонным крестом ----------
		buildings.push(buildChurch(bctx, { cx: -25, cz: -13, ry: Math.PI }));
		bench(batch, M, -29.5, -4.5, 0);
		bench(batch, M, -20.5, -4.5, 0);
		batch.add(place(box(0.14, 2.8, 0.14), -31.5, 1.4, -17), M.woodGrey); // поклонный крест
		batch.add(place(box(1.1, 0.14, 0.12), -31.5, 2.1, -17), M.woodGrey);
		batch.add(place(box(0.6, 0.1, 0.1), -31.5, 1.3, -17, 0, 0, 0.35), M.woodGrey);
		collide(-31.5, -17, 0.4, 0.4);

		// ---------- Кладбище за церковью: штакетник, калитка с дорожки ----------
		fencePlot(batch, M, collide, -42, 42, 22, 20, 'e', rnd);
		cemetery(batch, M, collide, rnd, R);

		// ---------- Ферма «Заря»: изгородь с въездом, коровник, силосная башня, сеновал, техника, КТП ----------
		railFence(batch, M, collide, 23, -49, 23, -19, [0.4, 0.667]); // въезд — z −37…−28
		railFence(batch, M, collide, 23, -19, 60, -19);
		billboard(batch, M, root, collide, 24.5, -33, -Math.PI / 2, 'КОЛХОЗ «ЗАРЯ»', { w: 7.4, h: 1.0, y: 3.4, bg: '#c8b88a', fg: '#7a1c14' });
		buildings.push(buildCowshed(bctx, { cx: 42, cz: -41, ry: Math.PI }));
		silo(batch, M, collide, 56, -50);
		occluder('HayBarn', (kb) => {
			const cx = 30, cz = -25, half = 3.9, rise = 1.6, slope = Math.hypot(half, rise), a = Math.atan2(rise, half);
			for (const x of [-4.8, 0, 4.8]) for (const z of [-3.2, 3.2]) kb.add(place(box(0.28, 3.6, 0.28), cx + x, 1.8, cz + z), M.wood);
			for (const z of [-3.2, 3.2]) kb.add(place(box(10.4, 0.22, 0.22), cx, 3.5, cz + z), M.wood);
			for (const s of [-1, 1]) kb.add(place(box(11, 0.1, slope, 2), cx, 3.6 + rise / 2, cz + (s * half) / 2, 0, s * a), M.roofTin);
			kb.add(place(boxTop(11.04, 0.12, 0.26, 1), cx, 3.6 + rise + 0.05, cz), M.wood);
		}, { cx: 30, cz: -25, ry: 0, hx: 5.6, hz: 4.0, top: 5.4 }, 0.15);
		for (const x of [-4.8, 0, 4.8]) for (const z of [-3.2, 3.2]) collide(30 + x, -25 + z, 0.35, 0.35);
		for (const [x, z, ry] of [[27.5, -25, 0], [30.2, -25.3, 0.1], [33, -24.8, -0.08], [28.8, -22.2, 0.2], [36.6, -27.5, 0.9]]) {
			batch.add(place(cyl(0.75, 0.75, 1.3, 12).rotateX(Math.PI / 2), x, 0.75, z, ry), M.woodYellow); // рулоны сена
			collide(x, z, 1.5, 1.4, ry);
		}
		batch.add(place(new THREE.SphereGeometry(1.0, 9, 6).scale(1.4, 0.6, 1.2), 31.5, 0.2, -27.6), M.woodYellow); // растрёпанная копна
		tractor(batch, M, collide, 44, -27, 0.15);
		trailer(batch, M, collide, 49.6, -27.8, 0.15);
		transformer(batch, root, M, collide, 38, -21.5);
		batch.add(place(box(3.0, 0.6, 0.8, 1), 36, 0.3, -33.5), M.concrete); // поилка
		collide(36, -33.5, 3.1, 0.9);
		for (const [x, z] of [[25.2, -45.6], [25.9, -45.0], [25.3, -44.3]]) {
			beginProp('barrel', x, z, 0);
			batch.add(place(cyl(0.3, 0.3, 0.9, 12), x, 0.45, z), M.metalRust);
			endProp();
			collide(x, z, 0.6, 0.6);
		}
		for (const [x, z, ry] of [[27.4, -45.2, 0.2], [28.4, -45.3, -0.1]]) {
			beginProp('crate', x, z, ry);
			batch.add(place(box(0.9, 0.6, 0.7, 1), x, 0.3, z, ry), M.wood);
			endProp();
			collide(x, z, 0.95, 0.75, ry);
		}
		for (const [x, z] of [[53, -32], [53.6, -31.4], [54.2, -32.1]]) {
			beginProp('tire', x, z, 0);
			batch.add(place(new THREE.TorusGeometry(0.4, 0.15, 8, 14), x, 0.15, z, 0, Math.PI / 2), M.tire);
			endProp();
		}
		well(batch, M, collide, 28, -47);

		// ---------- Пруд на юго-востоке: мостки, банька, костёр, лавка ----------
		pond(batch, root, M, collide, 36, 38, 10, 6, rnd);
		batch.add(place(box(1.4, 0.1, 3.6, 1.2), 36, 0.32, 44.4), M.woodGrey); // мостки
		for (const z of [43.2, 45.6]) for (const dx of [-0.6, 0.6]) batch.add(place(box(0.12, 0.5, 0.12), 36 + dx, 0.1, z), M.wood);
		shed(batch, M, collide, 27, 49, 0.1); // банька
		bench(batch, M, 40, 47, Math.PI);

		return {
			start: [0, 58.5, Math.PI],
			exits: [
				{ to: 'base', x0: -3.5, x1: 3.5, z0: 61.2, z1: 66, spawn: [0, 58.5, Math.PI], sign: [4.6, 60.2, '↓ База «Опорный»'] },
				{ to: 'lesopilka', x0: -3.5, x1: 3.5, z0: -66, z1: -61.2, spawn: [0, -58.5, 0], sign: [4.6, -60.2, '↑ Лесопилка'] },
				{ to: 'dachi', x0: 61.2, x1: 66, z0: 6.5, z1: 13.5, spawn: [58.5, 10, -Math.PI / 2], sign: [59.6, 14.2, 'Дачи →'] },
			],
			// заражённые: бегуны по дворам, у сельпо и на улице; топтуны — на площади, во дворе фермы и на кладбище
			groups: [
				{ at: [0, 40], r: 7, runners: 2 },
				{ at: [-8.5, 31], r: 4, runners: 2 },
				{ at: [9.5, 32], r: 4, runners: 2 },
				{ at: [-9, 4], r: 6, runners: 3, stompers: 1 },
				{ at: [5, -9], r: 5, runners: 2 },
				{ at: [-24, -4], r: 6, runners: 2 },
				{ at: [-8.5, -35], r: 4, runners: 1 },
				{ at: [9.5, -24], r: 3, runners: 1 },
				{ at: [40, -31], r: 8, runners: 3, stompers: 1 },
				{ at: [42, -41], r: 7, runners: 2 }, // в коровнике
				{ at: [30, 10], r: 6, runners: 2 },
				{ at: [52, 10], r: 7, runners: 1 },
				{ at: [-42, 42], r: 7, runners: 2, stompers: 1 },
				{ at: [38, 48], r: 6, runners: 2 },
				{ at: [-1, -46], r: 7, runners: 2 },
				{ at: [30, 3], r: 4, runners: 1 },
				{ at: [-26, 30], r: 6, runners: 1 },
			],
			onRoad,
			// горит остов машины на северном выезде, костёр у пруда
			fires: [[1, -52, 'car'], [31.5, 47.5, 'ground']],
			water: [[36, 38, 10, 6]],
			trees(tryTree) {
				// яблони на участках; сосновый бор на западе (на кладбище — редкие сосны), север, восток и юг;
				// берёзы у пруда и вдоль дороги на Дачи
				for (const [cx, cz, W, D] of PLOTS) for (let k = 0; k < 3; k++) tryTree(cx + R(-W / 2 + 1.5, W / 2 - 1.5), cz + R(-D / 2 + 1.5, D / 2 - 1.5), 'apple');
				for (let i = 0; i < 90; i++) {
					const x = R(-62, -33), z = R(-62, 62);
					if (x > -53 && z > 32 && z < 52 && rnd() < 0.8) continue; // кладбище — почти без деревьев
					tryTree(x, z, 'pine');
				}
				for (let i = 0; i < 40; i++) tryTree(R(-33, 62), R(-62, -52), 'pine');
				for (let i = 0; i < 40; i++) tryTree(R(50, 62), R(-50, 62), 'pine');
				for (let i = 0; i < 30; i++) tryTree(R(-33, 62), R(52, 62), 'pine');
				// каждый вид дерева на участке 33 м — лишние вызовы отрисовки: сосны у церкви и берёзы у пруда — в своих участках
				for (let i = 0; i < 12; i++) tryTree(R(-33, -22), R(-32, -1), 'pine');
				for (let i = 0; i < 16; i++) tryTree(36 + R(-8, 14), 38 + R(-4, 10), 'birch');
				for (let x = 36; x < 58; x += 6) tryTree(x + R(-1, 1), 17.5 + R(-0.3, 0.5), 'birch');
			},
			beltTrees: ['pine'],
			beltDensity: 1.3,
			clutter: 7,
			blood: 10,
			puddles: 10,
			puddle: () => [R(-40, 50), rnd() < 0.5 ? R(-4, 4) : R(-55, 55)],
			grass: 1.4,
			hint: (b) => ({
				Shop: 'Сельпо — на стеллажах живчики, в сейфе подсобки патроны',
				Church: 'Церковь — свечной ящик у входа и сундук в притворе',
				Cowshed: 'Коровник — шкаф ветеринара, ящик с комбикормом и верстак у ворот',
				OldHouse: 'Старый домик — обыщи шкаф, сундук и буфет',
			}[b.name] ?? 'Изба — обыщи буфет, шкафы, тумбочку и сундук'),
		};
	},
};
