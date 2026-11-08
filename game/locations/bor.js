// Кластер «Деревня Бор»: деревня на опушке соснового бора на окраине Улья. Грунтовая улица идёт с юга (от базы
// «Опорный») на север (к Лесопилке), от центра на восток уходит дорога к Дачам. Вдоль улицы — избы с огородами,
// банями, сараями и колодцами за заборами; в центре — сельпо, площадь с обелиском павшим, остановка и колодец;
// к западу — деревянная церковь с колокольней, за ней сосняк и кладбище с оградками; к востоку от улицы — колхозная
// ферма «Заря»: длинный коровник со стойлами, силосная башня, сеновал с рулонами сена, трактор с прицепом;
// на юго-востоке — пруд с мостками, банькой и берёзами. Брошено, но не разрушено: заборы стоят, окна целы через одно.
// Локация 180×180 м (half 90): вокруг старой деревни — новые концы. На северо-западе — улица Лесная (две избы и старый
// дом с огородами и банями, колодец-журавль), в её конце, на опушке бора, — пилорама под навесом с конторкой и штабелями
// брёвен. На северо-востоке, за фермой, — колхозный машинный двор: мастерская, навес с гусеничным трактором, сеялкой
// и плугом, комбайн, колёсный трактор, ёмкость ГСМ. На юге у улицы — почта с фельдшерским пунктом, за ней — ветряная
// мельница на бугре и колхозное поле со стогами и копнами у края; на востоке — сад с пасекой; на юго-западе — старое
// кладбище с оградками. По краям — опушки соснового бора и берёзовые перелески.
// Опасность 1: тихая окраина — бегуны по дворам и улицам, редкий топтун (площадь, ферма, кладбище, пилорама, машинный двор).

import * as THREE from 'three';
import * as T from '../textures.js';
import { box, place, planeXZ, beginProp, endProp } from '../geom.js';
import { boxTop } from '../facade.js';
import { Building, buildHouse, buildDacha, buildShop, table, chair } from '../buildings.js';
import { addCar, fencePlot, woodpile, outhouse, well, shed, garden, bench, pond, clothesline, waterBarrel, settlementSign, powerLine, transformer, bicycle } from '../props.js';
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
function cemetery(batch, M, collide, rnd, R, rows = [35.5, 38.5, 45.5, 48.5], x0 = -50, x1 = -35) {
	const cross = (x, z, mat) => {
		batch.add(place(box(0.09, 1.7, 0.09), x, 0.85, z), mat);
		batch.add(place(box(0.7, 0.09, 0.07), x, 1.3, z), mat);
		batch.add(place(box(0.4, 0.07, 0.06), x, 0.75, z, 0, 0, 0.35), mat);
	};
	for (const z of rows) for (let x = x0; x <= x1; x += 2.5) {
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

// ---------- Новые концы деревни: мелкие постройки и техника (всё — в общую статику) ----------

/** Смещение (lx, lz) в осях предмета с поворотом ry → мировая точка от (x, z). */
const at = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];

/** Плоские грани у многогранника (шатёр, призма): своя нормаль у каждой грани. */
function faceted(g) {
	const n = g.toNonIndexed();
	n.deleteAttribute('normal');
	n.computeVertexNormals();
	return n;
}

/** Треугольная призма вдоль X — чердак под двускатной крышей с фронтонами: основание w, высота h, длина len, низ на y = 0. */
function attic(w, h, len) {
	return faceted(new THREE.CylinderGeometry(1, 1, len, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).scale(1, h / 1.5, w / Math.sqrt(3)).translate(0, h / 3, 0));
}

/** Банька: сруб 3.4×2.8 м под жестяной крышей, труба, дверь и полок-скамья у входа (локальная +Z). */
function banya(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(3.4, 2.1, 2.8, 1.2), M.wood, 0, 1.05, 0);
	add(attic(2.8, 0.95, 3.4), M.wood, 0, 2.1, 0); // фронтоны
	const hz = 1.75, rise = 0.95, slope = Math.hypot(hz, rise), a = Math.atan2(rise, hz);
	for (const s of [-1, 1]) add(box(3.9, 0.07, slope, 2).rotateX(s * a), M.roofTin, 0, 2.1 + rise / 2 + 0.03, (s * hz) / 2);
	add(cyl(0.11, 0.11, 1.5, 8), M.metalDark, 0.95, 3.0, -0.5); // жестяная труба
	add(box(0.75, 1.75, 0.05), M.woodGrey, -0.85, 0.9, 1.43); // дверь
	add(box(1.6, 0.08, 0.4), M.woodGrey, 0.6, 0.45, 1.65); // лавка у входа
	collide(x, z, 3.5, 3.2, ry);
}

/** Колодец-журавль: сруб, столб-развилка и длинный шест с ведром. */
function shadoof(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(1.1, 0.8, 1.1, 1), M.wood, 0, 0.4, 0);
	add(box(0.2, 3.2, 0.2), M.bark, 2.2, 1.6, 0); // столб
	add(box(6.4, 0.1, 0.1).rotateZ(-0.42), M.woodGrey, 1.6, 3.0, 0); // шест: короткий конец с грузом вниз
	add(box(0.5, 0.4, 0.4), M.bark, 4.5, 2.05, 0); // груз-чурбак
	add(box(0.04, 1.4, 0.04), M.metalDark, -0.95, 3.3, 0); // цепь
	add(cyl(0.16, 0.13, 0.32, 8), M.metalDark, -0.95, 2.45, 0); // ведро
	collide(x, z, 1.4, 1.4, ry);
	const [px, pz] = at(x, z, ry, 2.2, 0);
	collide(px, pz, 0.4, 0.4);
}

/** Комбайн «Нива»: молотилка с бункером, кабина, жатка с мотовилом спереди (+X), выгрузной шнек. */
function combine(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(5.0, 2.0, 2.6, 1.5), M.red, -0.8, 2.0, 0); // молотилка
	add(box(3.0, 1.0, 2.3, 1.5), M.red, -1.4, 3.5, 0); // бункер
	add(box(1.6, 1.5, 1.7), M.metalDark, 1.3, 3.65, 0.2); // кабина (тёмные стёкла)
	add(box(1.8, 0.1, 1.9), M.red, 1.3, 4.45, 0.2);
	add(box(1.5, 1.0, 1.6).rotateZ(0.5), M.red, 2.3, 1.55, 0); // наклонная камера
	add(box(1.3, 0.8, 5.4, 1.5), M.yellow, 3.4, 0.6, 0); // жатка
	add(cyl(0.38, 0.38, 5.2, 10).rotateX(Math.PI / 2), M.red, 3.7, 1.25, 0); // мотовило
	for (const s of [-1, 1]) {
		add(cyl(0.78, 0.78, 0.5, 16).rotateX(Math.PI / 2), M.tire, 0.9, 0.78, s * 1.3); // ведущие колёса
		add(cyl(0.48, 0.48, 0.34, 12).rotateX(Math.PI / 2), M.tire, -2.8, 0.48, s * 1.1); // управляемые
	}
	add(cyl(0.16, 0.16, 4.0, 8).rotateZ(Math.PI / 2 - 0.25).rotateY(0.6), M.red, -2.4, 3.9, -1.9); // выгрузной шнек
	add(box(0.6, 0.5, 0.6), M.metalDark, -3.2, 3.2, 0.6); // двигатель
	const [bx, bz] = at(x, z, ry, -0.8, 0), [hx, hz] = at(x, z, ry, 3.4, 0);
	collide(bx, bz, 6.2, 3.0, ry);
	collide(hx, hz, 1.6, 5.6, ry);
}

/** Гусеничный трактор ДТ-75: гусеницы, капот, кабина. Перед — локальная +X. */
function crawler(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	for (const s of [-1, 1]) {
		add(box(3.3, 0.75, 0.45, 1), M.tire, 0, 0.42, s * 0.9);
		for (const lx of [-1.2, -0.4, 0.4, 1.2]) add(cyl(0.22, 0.22, 0.5, 10).rotateX(Math.PI / 2), M.metalDark, lx, 0.32, s * 0.9);
	}
	add(box(2.8, 0.7, 1.3), M.metalDark, 0, 0.95, 0);
	add(box(1.6, 0.85, 1.35, 1.2), M.red, 0.85, 1.6, 0); // капот
	add(box(1.2, 1.3, 1.6), M.metalDark, -0.75, 1.95, 0); // кабина
	add(box(1.4, 0.08, 1.8), M.red, -0.75, 2.65, 0);
	add(cyl(0.06, 0.06, 0.9, 6), M.metalDark, 1.2, 2.4, 0.35); // выхлопная труба
	add(box(0.2, 0.7, 1.9), M.metalDark, 1.75, 0.9, 0); // отвал
	collide(x, z, 3.6, 2.4, ry);
}

/** Сеялка: длинный ящик-бункер на двух колёсах, сошники, дышло вперёд (+X). */
function seeder(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(1.1, 0.7, 3.6, 1.2), M.green, 0, 1.2, 0);
	add(box(1.2, 0.06, 3.7), M.metalDark, 0, 1.58, 0);
	for (const s of [-1, 1]) add(cyl(0.55, 0.55, 0.15, 14).rotateX(Math.PI / 2), M.metalDark, 0, 0.55, s * 1.95);
	for (let i = 0; i < 8; i++) add(box(0.06, 0.6, 0.06), M.metalDark, -0.3, 0.45, -1.6 + i * 0.45);
	add(box(1.8, 0.1, 0.1), M.metalDark, 1.4, 0.7, 0);
	collide(x, z, 1.6, 4.2, ry);
}

/** Плуг: рама с четырьмя корпусами-лемехами, опорное колесо. */
function plow(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	add(box(3.2, 0.14, 0.14).rotateY(0.35), M.metalRust, 0, 0.75, 0);
	for (let i = 0; i < 4; i++) add(box(0.6, 0.55, 0.12).rotateY(0.9), M.metalRust, -1.2 + i * 0.8, 0.35, -0.5 + i * 0.3);
	add(cyl(0.3, 0.3, 0.12, 12).rotateX(Math.PI / 2), M.metalDark, -1.4, 0.3, -0.9);
	collide(x, z, 3.0, 1.9, ry);
}

/** Стог сена: круглый, с шапкой и шестом на макушке; s — размер. */
function haystack(batch, M, collide, x, z, s = 1) {
	batch.add(place(new THREE.CylinderGeometry(1.45 * s, 1.6 * s, 1.5 * s, 12), x, 0.75 * s, z), M.woodYellow);
	batch.add(place(new THREE.SphereGeometry(1.5 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.35, 1), x, 1.5 * s, z), M.woodYellow);
	batch.add(place(box(0.07, 1.0 * s, 0.07), x, 3.7 * s, z), M.woodGrey);
	collide(x, z, 3.1 * s, 3.1 * s);
}

/** Копна: конус снопов. */
function stook(batch, M, collide, x, z) {
	batch.add(place(new THREE.ConeGeometry(0.75, 1.5, 8), x, 0.75, z, (x * 7.1) % 6.28), M.woodYellow);
	collide(x, z, 1.1, 1.1);
}

/** Штабель брёвен вдоль локальной X: ряды пирамидой, клинья по краям. */
function logPile(batch, M, collide, x, z, ry, len = 6) {
	const add = placer(batch, x, z, ry);
	for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) add(cyl(0.22, 0.22, len, 8).rotateZ(Math.PI / 2), M.bark, 0, 0.22 + r * 0.38, -1.1 + i * 0.44 + r * 0.22);
	for (const s of [-1, 1]) add(box(0.14, 0.9, 0.14), M.woodGrey, s * (len / 2 - 0.4), 0.45, 1.45);
	collide(x, z, len + 0.2, 2.9, ry);
}

/** Штабель досок на прокладках. */
function boardStack(batch, M, collide, x, z, ry) {
	const add = placer(batch, x, z, ry);
	for (let k = 0; k < 5; k++) {
		add(box(4.2, 0.12, 1.4, 2), k % 2 ? M.woodYellow : M.wood, 0, 0.14 + k * 0.2, 0);
		for (const lx of [-1.6, 0, 1.6]) add(box(0.08, 0.08, 1.4), M.woodGrey, lx, 0.24 + k * 0.2, 0);
	}
	collide(x, z, 4.3, 1.5, ry);
}

/** Улей на подставке: корпус, крышка; paint — материал окраски. */
function hive(batch, M, collide, x, z, paint) {
	batch.add(place(box(0.55, 0.3, 0.45), x, 0.15, z), M.woodGrey);
	batch.add(place(box(0.6, 0.55, 0.5, 1), x, 0.58, z), paint);
	batch.add(place(box(0.7, 0.07, 0.6), x, 0.9, z, 0, 0.08), M.roofTin);
	collide(x, z, 0.75, 0.65);
}

// ---------- Почта с фельдшерским пунктом (можно зайти) ----------

/**
 * Кирпичный дом 12×8 м под шиферной крышей; две двери с фасада (−Z локально): слева — почта (стол почтальона,
 * сейф, стеллаж с посылками), справа — фельдшерско-акушерский пункт (аптечный шкаф, шкаф и стол фельдшера,
 * кушетка). Между ними глухая перегородка.
 */
function buildPost(ctx, { name = 'Post', cx, cz, ry = 0 }) {
	const W = 12, D = 8, H = 3.0, rise = 1.7;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + rise });
	b.messKind = 'shop';
	const { M } = ctx, IM = b.IM;
	const t = 0.25, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), IM.linoleum, { cast: false });
	for (const [w, d, x, z] of [[W + 0.3, 0.25, 0, -hz - 0.05], [W + 0.3, 0.25, 0, hz + 0.05], [0.25, D + 0.3, -hx - 0.05, 0], [0.25, D + 0.3, hx + 0.05, 0]]) {
		b.lower(place(box(w, 0.35, d, 2), x, 0.175, z), M.concreteDark);
	}
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, doors: [-3, 3], lining: IM.shopWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.shopWall, side: -1 });
	b.wall('z', 0, -hz + t / 2, hz - t / 2, { mat: IM.shopWall, t: 0.15 }); // перегородка: почта | ФАП
	const sill = M.whiteBrick;
	for (const x of [-5, 0.01, 5]) b.window('front', x, { t, sill });
	for (const x of [-4.5, -1.5, 1.5, 4.5]) b.window('back', x, { t, sill });
	b.window('left', 0, { t, sill }); b.window('right', 0, { t, sill });
	// крылечки, козырьки, открытые двери
	for (const x of [-3, 3]) {
		b.lower(place(box(1.7, 0.16, 0.9), x, 0.08, -hz - 0.55), M.concrete);
		b.canopy('front', x, { w: 1.8, d: 1.0, y: 2.45, mat: M.roofMetal, t });
		b.wallBox('front', x + 1.25, 1.1, 0.02, 2.05, 0.05, M.woodBlue, { t });
	}
	b.top_(b.onWall(new THREE.PlaneGeometry(4.6, 0.6).translate(0, H - 0.32, 0.03), 'front', 0, t), T.signMaterial('ПОЧТА · ФАП', { bg: '#1d4f9c', fg: '#f0f0e8', w: 512, h: 68 }));
	// двускатная шиферная крыша, конёк вдоль X, фронтоны из кирпича
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
	b.chimney(-2, 1.2, H + 0.6, H + rise + 0.7, 0.45, M.whiteBrick);
	// почта: стол почтальона с весами, сейф, стеллаж с посылками, лавка для посетителей
	b.container('Стол почтальона', -4.0, 2.75, Math.PI, [
		[1.4, 0.75, 0.7, 0, 0.375, 0, IM.furniture], [0.35, 0.12, 0.3, 0.35, 0.81, 0, IM.metal], [0.5, 0.06, 0.35, -0.3, 0.78, 0.05, IM.paper],
	], [1.4, 0.7], { ammo919: [3, 6, 0.35], spore: [1, 3, 0.35], zhivchik: 0.2 }, 0.95);
	chair(b, -4.7, 1.95, Math.PI);
	b.container('Сейф почты', -5.5, -2.4, Math.PI / 2, [
		[0.7, 1.1, 0.6, 0, 0.55, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, IM.black], [0.03, 0.2, 0.03, -0.2, 0.7, 0.31, IM.black],
	], [0.7, 0.6], { spore: [2, 5, 0.6], ammo919: [4, 10, 0.4], ammo50: [2, 5, 0.12] }, 1.1);
	b.container('Посылки', -1.4, 3.55, Math.PI, [
		...[-0.85, 0.85].flatMap((dx) => [[0.06, 1.9, 0.5, dx, 0.95, 0, IM.furnitureLight]]),
		...[0.15, 0.85, 1.55].map((y) => [1.8, 0.04, 0.5, 0, y, 0, IM.furnitureLight]),
		[0.5, 0.35, 0.4, -0.45, 0.35, 0, IM.crate], [0.4, 0.3, 0.35, 0.4, 0.33, 0, IM.paper], [0.6, 0.4, 0.4, 0.1, 1.07, 0, IM.crate], [0.45, 0.3, 0.35, -0.5, 1.72, 0, IM.paper],
	], [1.8, 0.5], { ammo12: [3, 6, 0.35], zhivchik: 0.25, ammo919: [3, 6, 0.25], spore: 0.2 }, 1.9);
	b.furniture(-1.0, -3.35, 0, [[1.6, 0.06, 0.4, 0, 0.45, 0, IM.furnitureLight], [0.06, 0.45, 0.35, -0.7, 0.22, 0, IM.furnitureLight], [0.06, 0.45, 0.35, 0.7, 0.22, 0, IM.furnitureLight]], { solid: [1.6, 0.4] });
	// ФАП: аптечный шкаф, шкаф и стол фельдшера, кушетка у перегородки
	b.container('Аптечный шкаф', 5.55, -1.6, -Math.PI / 2, [
		[0.9, 1.8, 0.45, 0, 0.9, 0, IM.white], [0.8, 0.9, 0.02, 0, 1.3, 0.23, IM.glass], [0.3, 0.1, 0.02, 0, 0.55, 0.24, IM.redBoard], [0.1, 0.3, 0.02, 0, 0.55, 0.25, IM.redBoard],
	], [0.9, 0.45], { zhivchik: [1, 2, 0.75], spore: 0.2 }, 1.8);
	b.container('Шкаф фельдшера', 5.55, 1.6, -Math.PI / 2, [
		[1.0, 1.9, 0.5, 0, 0.95, 0, IM.white], [0.02, 1.8, 0.02, 0, 0.95, 0.26, IM.black], [0.04, 0.12, 0.03, 0.1, 1.0, 0.27, IM.metal],
	], [1.0, 0.5], { zhivchik: 0.45, ammo919: [3, 6, 0.3], spore: [1, 2, 0.3] }, 1.9);
	b.container('Стол фельдшера', 2.6, 3.05, Math.PI, [
		[1.2, 0.75, 0.65, 0, 0.375, 0, IM.furnitureLight], [0.4, 0.04, 0.3, 0.2, 0.77, 0, IM.paper], [0.08, 0.25, 0.08, -0.4, 0.88, 0, IM.black],
	], [1.2, 0.65], { zhivchik: 0.35, ammo12: [2, 5, 0.25] }, 0.95);
	chair(b, 1.9, 2.25, Math.PI);
	b.furniture(0.5, -0.6, 0, [[0.7, 0.5, 1.9, 0, 0.25, 0, IM.white], [0.7, 0.1, 1.85, 0, 0.55, 0, IM.linen], [0.6, 0.12, 0.4, 0, 0.66, -0.7, IM.linen]], { solid: [0.7, 1.9] }); // кушетка
	return b.finish();
}

// ---------- Ветряная мельница (можно зайти) ----------

/**
 * Мельница-шатровка: бревенчатый четверик 5.6×5.6 м с дверью (−Z локально), над ним восьмигранный шатёр, колпак
 * и четыре крыла на валу над дверью. Внутри — жернова с ковшом, мешки с мукой и ларь мельника.
 */
function buildMill(ctx, { name = 'Mill', cx, cz, ry = 0 }) {
	const W = 5.6, D = 5.6, H = 3.0;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: 12.5 });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	const t = 0.24, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	for (const [w, d, x, z] of [[W + 0.3, 0.25, 0, -hz - 0.05], [W + 0.3, 0.25, 0, hz + 0.05], [0.25, D + 0.3, -hx - 0.05, 0], [0.25, D + 0.3, hx + 0.05, 0]]) {
		b.lower(place(box(w, 0.4, d, 2), x, 0.2, z), M.concreteDark);
	}
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.woodGrey, t, doors: [0], w: 1.3 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.woodGrey, t });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.woodGrey, t });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.woodGrey, t });
	b.window('left', 0.6, { t, trim: M.wood }); b.window('right', -0.6, { t, trim: M.wood }); b.window('back', 0, { t, trim: M.wood });
	b.lower(place(box(1.8, 0.2, 1.0), 0, 0.1, -hz - 0.6), M.wood);
	b.furniture(-0.62, -hz + 0.1, -1.7, [[1.2, 2.0, 0.05, 0.6, 1.0, 0, M.wood]], { up: true }); // дверь открыта внутрь
	// шатёр: восьмигранная усечённая пирамида над четвериком, обходной пояс, колпак с крышей
	b.top_(place(box(W + 0.6, 0.14, D + 0.6, 2), 0, H + 0.07, 0), M.roofTin);
	b.top_(place(faceted(new THREE.CylinderGeometry(1.75, 2.75, 5.2, 8, 1, true).rotateY(Math.PI / 8)), 0, H + 2.74, 0), M.woodGrey);
	b.top_(place(faceted(new THREE.CylinderGeometry(2.05, 2.05, 0.9, 8).rotateY(Math.PI / 8)), 0, H + 5.75, 0), M.wood);
	b.top_(place(faceted(new THREE.ConeGeometry(2.3, 1.7, 8).rotateY(Math.PI / 8)), 0, H + 7.05, 0), M.roofTin);
	// вал и крылья над дверью (решётка из реек с полотном)
	const hubY = H + 5.75, hubZ = -2.35;
	b.top_(place(cyl(0.2, 0.2, 1.4, 8).rotateX(Math.PI / 2), 0, hubY, hubZ + 0.4), M.bark);
	b.top_(place(box(0.5, 0.5, 0.3), 0, hubY, hubZ - 0.3), M.bark);
	for (let i = 0; i < 4; i++) {
		const a = i * Math.PI / 2 + 0.38;
		b.top_(place(box(0.16, 4.8, 0.16).translate(0, 2.5, 0).rotateZ(a), 0, hubY, hubZ - 0.45), M.wood);
		b.top_(place(box(1.1, 3.5, 0.05, 1).translate(0.62, 3.0, 0).rotateZ(a), 0, hubY, hubZ - 0.52), M.woodGrey);
		for (const r of [1.6, 2.8, 4.0]) b.top_(place(box(1.3, 0.07, 0.07).translate(0.55, r, 0).rotateZ(a), 0, hubY, hubZ - 0.58), M.wood);
	}
	// внутри: жернова с ковшом, мешки, ларь
	b.furniture(0, 1.2, 0, [
		[1.6, 0.6, 1.6, 0, 0.3, 0, IM.furniture],
		[0, 0, 0, 0, 0, 0, M.concrete, { geo: cyl(0.72, 0.72, 0.22, 16).translate(0, 0.71, 0) }],
		[0, 0, 0, 0, 0, 0, M.concrete, { geo: cyl(0.7, 0.7, 0.2, 16).translate(0, 0.93, 0) }],
		[0, 0, 0, 0, 0, 0, IM.furnitureLight, { geo: new THREE.ConeGeometry(0.55, 0.7, 4).rotateX(Math.PI).translate(0, 1.55, 0) }],
		[0.08, 1.3, 0.08, 0.6, 1.3, 0.6, IM.furniture], [0.08, 1.3, 0.08, -0.6, 1.3, 0.6, IM.furniture],
	], { solid: [1.6, 1.6] });
	b.container('Мешки с мукой', -2.15, 1.5, Math.PI / 2, [
		[0, 0, 0, 0, 0, 0, IM.linen, { geo: new THREE.SphereGeometry(0.35, 8, 6).scale(1.3, 0.75, 0.9).translate(-0.3, 0.26, 0) }],
		[0, 0, 0, 0, 0, 0, IM.linen, { geo: new THREE.SphereGeometry(0.35, 8, 6).scale(1.3, 0.75, 0.9).translate(0.4, 0.26, 0.05) }],
		[0, 0, 0, 0, 0, 0, IM.linen, { geo: new THREE.SphereGeometry(0.35, 8, 6).scale(1.3, 0.75, 0.9).translate(0.05, 0.7, 0) }],
	], [1.3, 0.7], { zhivchik: 0.3, spore: [1, 3, 0.4], ammo12: [2, 6, 0.3] }, 0.9);
	b.container('Ларь мельника', 2.2, 1.4, -Math.PI / 2, [
		[1.0, 0.6, 0.6, 0, 0.3, 0, IM.furnitureLight], [1.04, 0.08, 0.64, 0, 0.64, 0, IM.furniture],
	], [1.0, 0.6], { ammo12: [4, 8, 0.45], dbarrel: 0.06, spore: 0.25, zhivchik: 0.2 }, 0.7);
	return b.finish();
}

// ---------- Мастерская машинного двора (можно зайти) ----------

/**
 * Кирпичная мастерская 14×9 м под крышей из профлиста: ворота и дверь конторки с фасада (−Z локально). В цеху —
 * смотровая яма, токарный станок, верстак, стеллаж с запчастями, двигатель на подставке; за перегородкой —
 * конторка бригадира: сейф, шкаф, стол.
 */
function buildMtm(ctx, { name = 'Mtm', cx, cz, ry = 0 }) {
	const W = 14, D = 9, H = 3.8, rise = 1.6;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + rise });
	b.messKind = 'work';
	const { M } = ctx, IM = b.IM;
	const t = 0.3, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 2), 0, 0.025, 0), M.concreteDark, { cast: false });
	b.wall('x', -hz, -hx - t / 2, 1.2, { mat: M.whiteBrick, t, doors: [-3], w: 3.2, lining: IM.factoryWall, side: 1 });
	b.wall('x', -hz, 1.2, hx + t / 2, { mat: M.whiteBrick, t, doors: [4.8], lining: IM.factoryWall, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.whiteBrick, t, lining: IM.factoryWall, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.factoryWall, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.whiteBrick, t, lining: IM.factoryWall, side: -1 });
	b.wall('z', 2.4, -hz + t / 2, hz - t / 2, { mat: IM.factoryWall, t: 0.15, doors: [-2.6] }); // конторка
	const sill = M.whiteBrick;
	for (const x of [-5.2, -1.2, 4.6]) b.window('back', x, { y: 2.3, t, sill });
	b.window('front', 0.6, { y: 2.3, t, sill });
	b.window('left', 0, { y: 2.3, t, sill }); b.window('right', 1.2, { y: 2.3, t, sill });
	// створки ворот распахнуты, козырёк над дверью, крыльцо
	for (const s of [-1, 1]) b.wallBox('front', -3 + s * 2.25, 1.2, 0.02, 2.05, 0.06, M.metalRust, { t });
	b.wallBox('front', 4.8 + 1.2, 1.1, 0.02, 2.05, 0.05, M.metalOlive, { t });
	b.canopy('front', 4.8, { w: 1.8, d: 1.0, y: 2.45, mat: M.roofMetal, t });
	b.lower(place(box(1.6, 0.16, 0.9), 4.8, 0.08, -hz - 0.55), M.concrete);
	b.lower(place(box(3.4, 0.08, 1.4, 2), -3, 0.04, -hz - 0.75), M.concrete);
	// крыша из профлиста, конёк вдоль X, фронтоны кирпичные
	const half = hz + 0.45, slope = Math.hypot(half, rise), a = Math.atan2(rise, half);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.7, 0.08, slope, 2), 0, H + rise / 2, (s * half) / 2, 0, s * a), M.roofMetal);
	b.top_(place(boxTop(W + 0.74, 0.1, 0.26, 1), 0, H + rise + 0.04, 0), M.metalRust);
	for (const sx of [-1, 1]) {
		const x = sx * (hx + 0.01);
		const p = [x, H, -hz], q = [x, H, hz], tp = [x, H + rise, 0];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [...p, ...tp, ...q] : [...p, ...q, ...tp]), 3));
		tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sx > 0 ? [0, 0, D / 4, 1, D / 2, 0] : [0, 0, D / 2, 0, D / 4, 1]), 2));
		tri.computeVertexNormals();
		b.top_(tri, M.whiteBrick);
	}
	b.vent(-3, 0, H + rise - 0.1, M.silver, { h: 0.6, r: 0.18 });
	// цех: смотровая яма, станок, верстак, стеллаж, двигатель на подставке, колесо от трактора
	b.lower(place(planeXZ(1.3, 5.2), -3, 0.032, 0.9), IM.black, { cast: false });
	b.container('Верстак', -6.4, 2.2, Math.PI / 2, [
		[2.0, 0.85, 0.8, 0, 0.42, 0, IM.furniture], [2.1, 0.06, 0.85, 0, 0.88, 0, IM.metal], [0.4, 0.3, 0.25, 0.5, 1.06, -0.15, IM.machine], [0.3, 0.2, 0.2, -0.6, 1.0, -0.1, IM.black],
	], [2.0, 0.8], { ammo12: [3, 6, 0.4], fireaxe: 0.06, ammo762: [4, 8, 0.25] }, 1.0);
	b.container('Стеллаж с запчастями', -0.6, 3.95, Math.PI, [
		...[-1.4, 1.4].flatMap((dx) => [-0.3, 0.3].map((dz) => [0.08, 2.2, 0.08, dx, 1.1, dz, IM.rack])),
		...[0.15, 0.9, 1.65, 2.15].map((y) => [2.9, 0.05, 0.7, 0, y, 0, IM.rack]),
		[0.7, 0.45, 0.5, -0.8, 0.4, 0, IM.machine], [0.6, 0.4, 0.5, 0.6, 0.38, 0, IM.crate], [0.9, 0.5, 0.5, 0, 1.17, 0, IM.machine], [0.5, 0.35, 0.45, -0.8, 1.85, 0, IM.crateGreen],
	], [3.0, 0.8], { ammo545: [4, 10, 0.3], ammo12: [3, 6, 0.35], grenade: 0.03, zhivchik: 0.15 }, 2.2);
	b.furniture(-6.2, -2.4, Math.PI / 2, [
		[1.9, 0.9, 0.6, 0, 0.45, 0, IM.machine], [0.5, 0.4, 0.45, -0.6, 1.1, 0, IM.machine], [0.9, 0.12, 0.12, 0.2, 1.05, 0, IM.metal],
	], { solid: [1.9, 0.6], prop: 'lathe' });
	b.furniture(0.6, -1.8, 0.2, [[1.0, 0.7, 0.8, 0, 0.35, 0, IM.metal], [0.9, 0.6, 0.6, 0, 1.0, 0, IM.machine], [0.3, 0.3, 0.3, 0.45, 1.2, 0, IM.black]], { solid: [1.0, 0.8] });
	b.furniture(1.5, 2.5, 0, [[0, 0, 0, 0, 0, 0, IM.black, { geo: cyl(0.75, 0.75, 0.42, 16).rotateZ(Math.PI / 2).rotateY(0.3).translate(0, 0.75, 0) }]], { solid: [0.6, 1.5] });
	// конторка бригадира
	b.container('Сейф бригадира', 6.5, 3.2, -Math.PI / 2, [
		[0.7, 1.1, 0.6, 0, 0.55, 0, IM.metal], [0.12, 0.12, 0.03, 0.15, 0.7, 0.31, IM.black], [0.03, 0.2, 0.03, -0.2, 0.7, 0.31, IM.black],
	], [0.7, 0.6], { spore: [2, 4, 0.5], ammo919: [4, 10, 0.4], glock17: 0.05 }, 1.1);
	b.container('Шкаф', 3.4, 3.95, Math.PI, [
		[1.0, 1.9, 0.5, 0, 0.95, 0, IM.furniture], [0.02, 1.78, 0.02, 0, 0.95, 0.255, IM.black], [0.04, 0.12, 0.03, -0.08, 1.05, 0.27, IM.metal], [0.04, 0.12, 0.03, 0.08, 1.05, 0.27, IM.metal],
	], [1.0, 0.5], { ammo12: [3, 6, 0.4], zhivchik: 0.25, ammo762: [3, 6, 0.15] }, 1.9);
	table(b, 5.0, 0.6, 0, { w: 1.1, d: 0.7 });
	chair(b, 5.0, 1.35, Math.PI);
	return b.finish();
}

// ---------- Контора пилорамы (можно зайти) ----------

/** Бревенчатая конторка 6×4 м: стол мастера, шкаф, буржуйка, топчан. Дверь — с фасада (−Z локально), правее середины. */
function buildSawOffice(ctx, { name = 'SawOffice', cx, cz, ry = 0 }) {
	const W = 6, D = 4, H = 2.6, rise = 1.2;
	const b = new Building(ctx, { name, cx, cz, ry, W, D, H, top: H + rise });
	const { M } = ctx, IM = b.IM;
	const t = 0.2, hx = W / 2, hz = D / 2;
	b.lower(place(planeXZ(W - 0.1, D - 0.1, 1.2), 0, 0.025, 0), IM.floor, { cast: false });
	b.wall('x', -hz, -hx - t / 2, hx + t / 2, { mat: M.wood, t, doors: [1.5], lining: IM.whitewash, side: 1 });
	b.wall('x', hz, -hx - t / 2, hx + t / 2, { mat: M.wood, t, lining: IM.whitewash, side: -1 });
	b.wall('z', -hx, -hz + t / 2, hz - t / 2, { mat: M.wood, t, lining: IM.whitewash, side: 1 });
	b.wall('z', hx, -hz + t / 2, hz - t / 2, { mat: M.wood, t, lining: IM.whitewash, side: -1 });
	b.window('front', -1.4, { t, trim: M.woodGrey }); b.window('left', 0, { t, trim: M.woodGrey });
	b.lower(place(box(1.4, 0.16, 0.8), 1.5, 0.08, -hz - 0.5), M.woodGrey);
	b.furniture(1.5 - 0.6, -hz + 0.08, -1.6, [[1.15, 1.95, 0.05, 0.58, 0.98, 0, M.woodGrey]], { up: true });
	const half = hz + 0.4, slope = Math.hypot(half, rise), a = Math.atan2(rise, half);
	for (const s of [-1, 1]) b.top_(place(box(W + 0.6, 0.07, slope, 2), 0, H + rise / 2, (s * half) / 2, 0, s * a), M.roofTin);
	b.top_(place(attic(D, rise, W), 0, H, 0), M.wood);
	b.container('Стол мастера', -1.9, 1.3, Math.PI, [
		[1.2, 0.75, 0.65, 0, 0.375, 0, IM.furniture], [0.5, 0.05, 0.35, 0.2, 0.77, 0, IM.paper], [0.25, 0.25, 0.25, -0.35, 0.87, 0, IM.black],
	], [1.2, 0.65], { ammo12: [3, 6, 0.45], spore: [1, 3, 0.35], zhivchik: 0.2 }, 0.95);
	b.container('Шкаф', 2.35, 1.5, Math.PI, [
		[1.0, 1.9, 0.5, 0, 0.95, 0, IM.furniture], [0.02, 1.78, 0.02, 0, 0.95, 0.255, IM.black], [0.04, 0.12, 0.03, -0.08, 1.05, 0.27, IM.metal], [0.04, 0.12, 0.03, 0.08, 1.05, 0.27, IM.metal],
	], [1.0, 0.5], { ammo12: [3, 8, 0.45], dbarrel: 0.07, ammo919: [2, 5, 0.2] }, 1.9);
	b.furniture(-2.4, -1.15, 0, [[0.5, 0.6, 0.7, 0, 0.3, 0, IM.black], [0.12, 0.12, 0.3, 0, 0.45, 0.45, IM.black]], { solid: [0.6, 0.8], prop: 'burzhuyka' });
	b.furniture(-2.4, -1.15, 0, [[0.12, 2.2, 0.12, 0, 1.75, -0.2, IM.black]], { up: true }); // труба буржуйки
	b.furniture(0.2, 1.5, 0, [[1.8, 0.4, 0.7, 0, 0.2, 0, IM.furnitureLight], [1.7, 0.08, 0.65, 0, 0.44, 0, IM.blanket]], { solid: [1.8, 0.7] }); // топчан
	return b.finish();
}

// избы с участками: [cx, cz, W, D] — для яблонь
const PLOTS = [[-14.5, 28, 17, 15], [-14.5, -38, 17, 15], [14.5, 30, 17, 15], [30, -3, 18, 15], [13.5, -24, 13, 12], [-23, -77.5, 20, 14], [-49, -77.5, 20, 14], [-36, -55, 14, 12]];
// где деревья не сажаем: участки улицы Лесной, старое кладбище, пасека, бугор мельницы, двор почты — [x0, x1, z0, z1]
const NO_TREES = [[-33, -13, -85, -70], [-59, -39, -85, -70], [-43, -29, -61, -49], [-58, -34, 64, 80], [57, 75, 26, 44], [24, 38, 59, 73], [3.5, 20, 57, 71]];

export default {
	id: 'bor',
	seed: 4411,
	half: 90, // 180×180 м
	build(ctx) {
		const { rnd, R, root, batch, collide, M, ground, occluder, buildings, bctx } = ctx;
		M.shopSign = T.signMaterial('СЕЛЬПО', { bg: '#dbd3b0', fg: '#2a3f7a' });

		// ---------- Дороги: улица с юга на север, дорога на восток к Дачам, съезд на ферму, площадь, дорожки ----------
		ground(7, 180, 0, 0, M.dirt, 4, 0.02); // улица (z −90…90)
		ground(90, 7, 45, 10, M.dirt, 4, 0.018); // на восток, к Дачам
		ground(21, 6, 13.5, -33, M.dirt, 4, 0.017); // съезд к ферме
		ground(36, 32, 42, -35, M.dirt, 5, 0.014); // двор фермы
		ground(9, 9, -9.5, 3, M.concrete, 3, 0.015); // площадь с обелиском — плиты
		ground(14, 4, -10, -3.5, M.dirt, 4, 0.016); // проулок к церкви
		ground(18, 18, -25, -11, M.dirt, 4, 0.013); // церковный двор
		ground(26, 3.5, -17.5, 42, M.dirt, 4, 0.016); // дорожка на кладбище
		ground(5, 15, 5.3, -8, M.dirt, 4, 0.017); // перед сельпо
		for (const [x, z] of [[-4.75, 28], [4.75, 30], [-4.75, -38], [5.25, -24]]) ground(2.5, 4, x, z, M.dirt, 4, 0.017); // тропинки к калиткам
		ground(4, 2, 34.25, 5.5, M.dirt, 4, 0.017);
		// новые концы: улица Лесная и проезд к машинному двору (z −69…−63), двор пилорамы, машинный двор, площадка
		// у почты, дорожка к мельнице, полевая дорога, колхозное поле, дорожка на старое кладбище
		ground(66, 6, -36.5, -66, M.dirt, 4, 0.0175);
		ground(20.5, 6, 13.75, -66, M.dirt, 4, 0.0175);
		ground(16, 30, -76, -67, M.dirt, 5, 0.0136);
		ground(46, 28, 47, -71, M.dirt, 5, 0.0134);
		ground(7.5, 9, 7.25, 64, M.dirt, 4, 0.017);
		ground(3.5, 10.5, 26.5, 70.25, M.dirt, 4, 0.0172);
		ground(40.5, 4, 23.75, 76.5, M.dirt, 4, 0.0174);
		ground(40, 29, 64, 69.5, M.dirt, 6, 0.012);
		ground(30.5, 3.5, -18.75, 72, M.dirt, 4, 0.016);
		for (const [x, z] of [[-18, -69.75], [-44, -69.75], [-32.5, -62.25]]) ground(3, 1.5, x, z, M.dirt, 4, 0.017); // тропинки к калиткам
		const roads = [
			[-3.5, 3.5, -90, 90], [0, 90, 6.5, 13.5], [3, 24, -36, -30], [24, 60, -51, -19], [-17, -3, -5.5, -1.5], [-34, -16, -20, -2],
			[-14, -5, -1.5, 7.5], [-30.5, -4.5, 40.25, 43.75], [2.8, 7.8, -15.5, -0.5],
			[-69.5, -3.5, -69, -63], [3.5, 24, -69, -63], [-84, -68, -82, -52], [24, 70, -85, -57], [3.5, 11, 59.5, 68.5],
			[24.75, 28.25, 65, 75.5], [3.5, 44, 74.5, 78.5], [44, 84, 55, 84], [-34, -3.5, 70.25, 73.75],
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

		// ================= Новые концы деревни (локация 180×180 м) =================

		// ---------- Улица Лесная (северо-запад): две избы и старый дом с огородами, банями, колодцами ----------
		buildings.push(
			buildHouse(bctx, { name: 'House5', cx: -19, cz: -76.5, ry: Math.PI, rnd, variant: 5 }),
			buildHouse(bctx, { name: 'House6', cx: -45, cz: -76.5, ry: Math.PI, rnd, variant: 7 }),
			buildDacha(bctx, { name: 'OldHouse2', cx: -36, cz: -56, ry: 0, rnd, variant: 2, paint: M.woodGrey }),
		);
		// изба 5: баня, огород, дровник, туалет; колодец у проулка
		fencePlot(batch, M, collide, -23, -77.5, 20, 14, 's', rnd);
		banya(batch, M, collide, -29.5, -74, Math.PI / 2);
		garden(batch, M, rnd, -29.5, -80.5, 3, 6);
		woodpile(batch, M, collide, -20, -83.2, 0);
		outhouse(batch, M, collide, -25.8, -83.3, 0);
		well(batch, M, collide, -11, -71.3);
		// изба 6
		fencePlot(batch, M, collide, -49, -77.5, 20, 14, 's', rnd);
		banya(batch, M, collide, -55.5, -74, Math.PI / 2);
		garden(batch, M, rnd, -55.5, -80.5, 3, 6);
		woodpile(batch, M, collide, -46, -83.2, 0);
		outhouse(batch, M, collide, -51.5, -83.3, 0);
		waterBarrel(batch, M, collide, -52.6, -72.4);
		// старый дом напротив: баня за домом, грядки, дрова; на улице — колодец-журавль, лавка, брошенный «Москвич»
		fencePlot(batch, M, collide, -36, -55, 14, 12, 'n', rnd);
		banya(batch, M, collide, -36.5, -50.9, Math.PI);
		garden(batch, M, rnd, -41, -55, 2, 7);
		woodpile(batch, M, collide, -30.4, -55, Math.PI / 2);
		shadoof(batch, M, collide, -22, -58.5, 0);
		bench(batch, M, -26, -61.6, 0);
		addCar(batch, M, root, -60, -65.6, 0.08, 0x6a5a48);
		collide(-60, -65.6, 4.3, 1.8, 0.08);

		// ---------- Пилорама на опушке (конец улицы Лесной): навес с пильной рамой, штабели брёвен и досок, конторка ----------
		occluder('SawShed', (kb) => {
			const cx = -77, cz = -69;
			for (const x of [-4.6, 4.6]) for (const z of [-6.5, -2, 2.5, 7]) kb.add(place(box(0.25, 3.8, 0.25), cx + x, 1.9, cz + z), M.wood);
			for (const x of [-4.6, 4.6]) kb.add(place(box(0.22, 0.22, 14), cx + x, 3.75, cz + 0.25), M.wood);
			kb.add(place(box(10.4, 0.1, 15, 2), cx, 4.0, cz + 0.25, 0, 0, 0.08), M.roofTin); // односкатная крыша
		}, { cx: -77, cz: -68.75, ry: 0, hx: 5.3, hz: 7.6, top: 4.6 }, 0.15);
		for (const x of [-4.6, 4.6]) for (const z of [-6.5, -2, 2.5, 7]) collide(-77 + x, -69 + z, 0.35, 0.35);
		{
			const x = -77, z = -69;
			for (const dx of [-0.75, 0.75]) batch.add(place(box(0.08, 0.14, 14), x + dx, 0.08, z), M.rail, { cast: false }); // рельсы тележки
			for (const dx of [-1.1, 1.1]) batch.add(place(box(0.3, 3.0, 0.3), x + dx, 1.5, z), M.metalDark); // пильная рама
			batch.add(place(box(2.6, 0.4, 0.5), x, 3.0, z), M.metalDark);
			batch.add(place(box(1.9, 1.5, 0.06), x, 1.2, z), M.silver); // пилы
			batch.add(place(box(2.4, 0.6, 0.8), x, 0.3, z + 0.7), M.green); // привод
			batch.add(place(box(1.4, 0.4, 2.0), x, 0.45, z - 3.5), M.metalRust); // тележка
			batch.add(place(cyl(0.35, 0.35, 6.5, 10).rotateX(Math.PI / 2), x, 1.0, z - 3.6), M.bark); // бревно на тележке
			batch.add(place(new THREE.SphereGeometry(1.6, 10, 6).scale(1.3, 0.45, 1.0), x + 2.6, 0.1, z + 3.5), M.woodYellow); // опилки
			collide(x, z - 1.5, 2.8, 9.5);
		}
		logPile(batch, M, collide, -80.5, -56.5, Math.PI / 2);
		logPile(batch, M, collide, -76, -80.2, 0);
		boardStack(batch, M, collide, -70.5, -79.5, Math.PI / 2);
		boardStack(batch, M, collide, -70.6, -73, Math.PI / 2);
		buildings.push(buildSawOffice(bctx, { cx: -73, cz: -56, ry: 0 }));

		// ---------- Колхозный машинный двор (северо-восток, за фермой) ----------
		railFence(batch, M, collide, 23, -85, 23, -57, [0.53, 0.83]); // въезд с проезда — z −69…−63
		railFence(batch, M, collide, 23, -56, 44, -56);
		billboard(batch, M, root, collide, 24.5, -66, -Math.PI / 2, 'МТМ КОЛХОЗА «ЗАРЯ»', { w: 5.4, h: 0.8, y: 3.2 });
		buildings.push(buildMtm(bctx, { cx: 36, cz: -78.5, ry: Math.PI }));
		occluder('MachineShed', (kb) => {
			const cx = 57, cz = -79.5;
			for (const x of [-10, -5, 0, 5, 10]) for (const z of [-3.5, 3.5]) kb.add(place(box(0.25, 4.2, 0.25), cx + x, 2.1, cz + z), M.metalDark);
			for (const z of [-3.5, 3.5]) kb.add(place(box(20.4, 0.25, 0.25), cx, 4.15, cz + z), M.metalDark);
			kb.add(place(box(21.2, 0.1, 8.4, 2), cx, 4.45, cz, 0, -0.06), M.roofMetal);
		}, { cx: 57, cz: -79.5, ry: 0, hx: 10.6, hz: 4.2, top: 4.8 }, 0.15);
		for (const x of [-10, -5, 0, 5, 10]) for (const z of [-3.5, 3.5]) collide(57 + x, -79.5 + z, 0.35, 0.35);
		crawler(batch, M, collide, 50.5, -79.5, 0);
		seeder(batch, M, collide, 58, -80, 0);
		plow(batch, M, collide, 64, -79.5, 0.2);
		combine(batch, M, collide, 56, -65.5, Math.PI);
		tractor(batch, M, collide, 38, -63.5, -0.25);
		{ // ёмкость ГСМ на опорах, колонка
			const x = 66, z = -62;
			batch.add(place(cyl(1.1, 1.1, 5, 16).rotateX(Math.PI / 2), x, 1.9, z), M.metalRust);
			for (const dz of [-1.6, 1.6]) batch.add(place(box(1.6, 0.9, 0.4), x, 0.45, z + dz), M.concrete);
			batch.add(place(box(0.5, 0.3, 0.5), x, 3.05, z), M.metalDark);
			batch.add(place(box(0.5, 1.3, 0.4), x - 1.8, 0.65, z + 2.0), M.red);
			collide(x, z, 2.4, 5.2);
			collide(x - 1.8, z + 2.0, 0.6, 0.5);
		}
		for (const [x, z] of [[68.6, -58.4], [69.3, -59.1], [68.5, -59.8]]) {
			beginProp('barrel', x, z, 0);
			batch.add(place(cyl(0.3, 0.3, 0.9, 12), x, 0.45, z), M.metalRust);
			endProp();
			collide(x, z, 0.6, 0.6);
		}
		for (const [x, z] of [[44.8, -72.6], [45.5, -72.0], [44.6, -71.3], [27.2, -72.3]]) {
			beginProp('tire', x, z, 0);
			batch.add(place(new THREE.TorusGeometry(0.4, 0.15, 8, 14), x, 0.15, z, 0, Math.PI / 2), M.tire);
			endProp();
		}
		for (const [x, z, ry] of [[27.5, -61.5, 0.3], [28.6, -61.2, -0.2]]) {
			beginProp('crate', x, z, ry);
			batch.add(place(box(0.9, 0.6, 0.7, 1), x, 0.3, z, ry), M.wood);
			endProp();
			collide(x, z, 0.95, 0.75, ry);
		}

		// ---------- Почта с фельдшерским пунктом у улицы (юг): площадка, почтовый ящик, велосипед почтальона, «буханка» ----------
		buildings.push(buildPost(bctx, { cx: 15, cz: 64, ry: Math.PI / 2 }));
		batch.add(place(box(0.08, 1.1, 0.08), 9.6, 0.55, 69.4), M.metalDark);
		batch.add(place(box(0.45, 0.5, 0.3, 1), 9.6, 1.25, 69.4), M.woodBlue); // почтовый ящик
		collide(9.6, 69.4, 0.5, 0.4);
		bicycle(batch, M, 10.0, 65.0, Math.PI / 2 - 0.2);
		bench(batch, M, 9.6, 60.3, -Math.PI / 2);
		addCar(batch, M, root, 7.5, 56.6, 0.1, 0xd8d6cc, { model: 'e_uaz' });
		collide(7.5, 56.6, 4.3, 1.8, 0.1);

		// ---------- Ветряная мельница на бугре, дорожка к полевой дороге ----------
		batch.add(place(new THREE.CircleGeometry(6.5, 20).rotateX(-Math.PI / 2), 31, 0.016, 66), M.dirt, { cast: false });
		buildings.push(buildMill(bctx, { cx: 31, cz: 66, ry: Math.PI / 2 }));
		batch.add(place(cyl(0.7, 0.7, 0.25, 16).rotateZ(1.3), 35.2, 0.72, 70.6), M.concrete); // старый жёрнов у стены
		collide(35.2, 70.6, 0.8, 1.5);

		// ---------- Колхозное поле у юго-восточного края: стерня, стога, копны, тракторная тележка ----------
		for (let z = 56.5; z < 83.5; z += 1.6) batch.add(place(box(38.5, 0.08, 0.32, 4), 64, 0.05, z), M.leavesDry, { cast: false });
		for (const [x, z, s] of [[50, 60, 1], [66, 58.8, 1.1], [80.5, 61, 0.9], [57, 72, 1.15], [75, 75.5, 1], [48.5, 80.5, 0.95], [64, 81.5, 1.05]]) haystack(batch, M, collide, x, z, s);
		for (const [x, z] of [[46.5, 66], [50.5, 66.4], [54.5, 66], [64.5, 66.2], [68.5, 66], [72.5, 66.4], [82, 68], [52.5, 77], [56.5, 77.4], [69, 79.5], [80.5, 81.5]]) stook(batch, M, collide, x, z);
		trailer(batch, M, collide, 73, 63, 0.4);

		// ---------- Старое кладбище на юго-западе: штакетник, калитка с дорожки от улицы ----------
		fencePlot(batch, M, collide, -46, 72, 24, 16, 'e', rnd);
		cemetery(batch, M, collide, rnd, R, [66.6, 69.2, 74.8, 77.4], -56, -38);

		// ---------- Колхозный сад с пасекой (восток, за прудом): ульи рядами, омшаник, лавка ----------
		const hivePaint = [M.woodBlue, M.woodYellow, M.woodGreen];
		for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) hive(batch, M, collide, 60 + i * 4, 29 + j * 5.5, hivePaint[(i + j) % 3]);
		shed(batch, M, collide, 74.5, 34.5, Math.PI / 2); // омшаник
		bench(batch, M, 66, 44.5, Math.PI);

		return {
			start: [0, 82.5, Math.PI],
			exits: [
				{ to: 'base', x0: -3.5, x1: 3.5, z0: 85.2, z1: 90, spawn: [0, 82.5, Math.PI], sign: [4.6, 84, '↓ База «Опорный»'] },
				{ to: 'vokzal', x0: -3.5, x1: 3.5, z0: -90, z1: -85.2, spawn: [0, -82.5, 0], sign: [4.6, -84, '↑ Станция'] },
				{ to: 'lesopilka', x0: 85.2, x1: 90, z0: 6.5, z1: 13.5, spawn: [82.5, 10, -Math.PI / 2], sign: [84, 14.2, 'Лесопилка →'] },
			],
			// заражённые: бегуны по дворам, у сельпо и на улицах; топтуны — на площади, во дворе фермы, на кладбище,
			// на пилораме и на машинном дворе
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
				// новые концы
				{ at: [-18, -66], r: 6, runners: 2 }, // улица Лесная
				{ at: [-46, -66], r: 6, runners: 2 },
				{ at: [-36, -60], r: 4, runners: 1 }, // у старого дома
				{ at: [-76, -66], r: 7, runners: 2, stompers: 1 }, // пилорама
				{ at: [38, -66], r: 7, runners: 2 }, // машинный двор
				{ at: [56, -72], r: 7, runners: 2, stompers: 1 }, // у навеса и комбайна
				{ at: [36, -78.5], r: 4, runners: 1 }, // в мастерской
				{ at: [7, 64], r: 5, runners: 2 }, // у почты
				{ at: [27, 72], r: 5, runners: 1 }, // у мельницы
				{ at: [62, 68], r: 9, runners: 3 }, // поле
				{ at: [-46, 72], r: 7, runners: 2 }, // старое кладбище
				{ at: [-1, 64], r: 6, runners: 2 }, // южный конец улицы
				{ at: [66, 36], r: 7, runners: 1 }, // пасека
				{ at: [-70, 12], r: 7, runners: 1 }, // в бору
			],
			onRoad,
			// горит остов машины на северном выезде, костёр у пруда, бочка на машинном дворе, костёр на пилораме
			fires: [[1, -52, 'car'], [31.5, 47.5, 'ground'], [62, -58.5], [-71, -61, 'ground']],
			water: [[36, 38, 10, 6]],
			trees(tryTree) {
				const bare = (x, z) => NO_TREES.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
				// яблони на участках; сосновый бор на западе — от церкви до края (на кладбищах и во дворах не сажаем);
				// опушки бора у северного, восточного и южного края, перед ними — берёзовые перелески
				for (const [cx, cz, W, D] of PLOTS) for (let k = 0; k < 3; k++) tryTree(cx + R(-W / 2 + 1.5, W / 2 - 1.5), cz + R(-D / 2 + 1.5, D / 2 - 1.5), 'apple');
				for (let i = 0; i < 90; i++) {
					const x = R(-62, -33), z = R(-62, 62);
					if (x > -53 && z > 32 && z < 52 && rnd() < 0.8) continue; // кладбище — почти без деревьев
					if (!bare(x, z)) tryTree(x, z, 'pine');
				}
				for (let i = 0; i < 120; i++) { const x = R(-86, -62), z = R(-86, 86); if (!bare(x, z)) tryTree(x, z, 'pine'); }
				for (let i = 0; i < 45; i++) { const x = R(-62, -33), z = rnd() < 0.5 ? R(-86, -62) : R(62, 86); if (!bare(x, z)) tryTree(x, z, 'pine'); }
				for (let i = 0; i < 55; i++) { const x = R(-33, 86), z = R(-86, -77); if (!bare(x, z)) tryTree(x, z, 'pine'); }
				for (let i = 0; i < 60; i++) tryTree(R(76, 86), R(-77, 54), 'pine');
				for (let i = 0; i < 40; i++) { const x = R(-33, 44), z = R(79, 86); if (!bare(x, z)) tryTree(x, z, 'pine'); }
				for (let i = 0; i < 22; i++) tryTree(R(62, 76), R(-50, 2), 'birch');
				for (let i = 0; i < 12; i++) tryTree(R(6, 22), R(-60, -34), 'birch');
				// каждый вид дерева на участке 33 м — лишние вызовы отрисовки: сосны у церкви и берёзы у пруда — в своих участках
				for (let i = 0; i < 12; i++) tryTree(R(-33, -22), R(-32, -1), 'pine');
				for (let i = 0; i < 16; i++) tryTree(36 + R(-8, 14), 38 + R(-4, 10), 'birch');
				for (let x = 36; x < 82; x += 6) tryTree(x + R(-1, 1), 17.5 + R(-0.3, 0.5), 'birch');
				// яблоневый сад вокруг пасеки, берёзы вдоль южного конца улицы
				for (let i = 0; i < 22; i++) tryTree(R(55, 77), R(23, 47), 'apple');
				for (let z = 58; z < 82; z += 7) tryTree(-6 + R(-0.5, 0.5), z + R(-1, 1), 'birch');
			},
			beltTrees: ['pine'],
			beltDensity: 0.4, // опушки по краям — в trees(): пояс только добавляет редкие сосны
			clutter: 7,
			blood: 10,
			puddles: 10,
			puddle: () => [R(-55, 70), rnd() < 0.5 ? R(-4, 4) : R(-80, 80)],
			grass: 1.4,
			hint: (b) => ({
				Shop: 'Сельпо — на стеллажах живчики, в сейфе подсобки патроны',
				Church: 'Церковь — свечной ящик у входа и сундук в притворе',
				Cowshed: 'Коровник — шкаф ветеринара, ящик с комбикормом и верстак у ворот',
				OldHouse: 'Старый домик — обыщи шкаф, сундук и буфет',
				OldHouse2: 'Старый дом на Лесной — обыщи шкаф, сундук и буфет',
				Post: 'Почта и ФАП — сейф и посылки на почте, аптечный шкаф у фельдшера',
				Mill: 'Мельница — мешки с мукой и ларь мельника',
				Mtm: 'Мастерская машинного двора — верстак, стеллаж с запчастями, сейф бригадира',
				SawOffice: 'Контора пилорамы — стол мастера и шкаф',
			}[b.name] ?? 'Изба — обыщи буфет, шкафы, тумбочку и сундук'),
		};
	},
};
