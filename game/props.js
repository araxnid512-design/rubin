// Постройки и предметы для локаций: скамейки, заборы, машины, деревья, трава, муть по краям.
// Всё складывается в общий Batch (статика сливается по материалам) и регистрирует коллайдеры.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { box, place } from './geom.js';

/** Половина размера локации, м (локация — квадрат 132×132 м). */
export const HALF = 66;
/** Граница, за которую нельзя зайти: дальше — муть по краям кластера. */
export const PLAY = HALF - 3.5;
/** Во сколько раз локация больше по площади, чем прежняя 100×100 м: столько же мелочей на квадратный метр. */
export const AREA = (HALF / 50) ** 2;

/** Время для ветра (секунды): обновляет уровень каждый кадр. */
export const WIND = { value: 0 };

/**
 * Материал, качающийся на ветру: вершины смещаются тем сильнее, чем выше над землёй (height — высота,
 * на которой качание полное), фаза зависит от места экземпляра — деревья качаются не в такт.
 */
export function windMaterial(base, { height = 6, amount = 0.12 } = {}) {
	const m = base.clone();
	m.onBeforeCompile = (shader) => {
		shader.uniforms.uWind = WIND;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nuniform float uWind;')
			.replace('#include <begin_vertex>', `#include <begin_vertex>
			#ifdef USE_INSTANCING
				vec3 wOrigin = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
			#else
				vec3 wOrigin = vec3(0.0);
			#endif
			float wK = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0);
			wK *= wK;
			transformed.x += sin(uWind * 1.6 + wOrigin.x * 0.35 + wOrigin.z * 0.21) * ${amount.toFixed(3)} * wK;
			transformed.z += cos(uWind * 1.15 + wOrigin.z * 0.31 + wOrigin.x * 0.17) * ${(amount * 0.7).toFixed(3)} * wK;`);
	};
	m.customProgramCacheKey = () => `wind${height}:${amount}`;
	return m;
}

// ---------- Постройки и предметы ----------

export function bench(batch, M, x, z, ry) {
	batch.add(place(box(1.6, 0.06, 0.4), x, 0.45, z, ry), M.woodGreen);
	batch.add(place(box(1.6, 0.35, 0.05), x, 0.7, z + 0.18, ry), M.woodGreen);
	for (const dx of [-0.65, 0.65]) batch.add(place(box(0.06, 0.45, 0.4), x + dx, 0.22, z, ry), M.metalDark);
}

export function swings(batch, M, x, z) {
	for (const dx of [-1.6, 1.6]) for (const dz of [-0.6, 0.6]) batch.add(place(box(0.08, 2.4, 0.08), x + dx, 1.2, z + dz * 0.9, 0, dz * 0.25), M.metalRust);
	batch.add(place(box(3.4, 0.08, 0.08), x, 2.35, z), M.metalRust);
	for (const dx of [-0.7, 0.7]) {
		batch.add(place(box(0.5, 0.05, 0.25), x + dx, 0.5, z), M.wood);
		for (const s of [-0.22, 0.22]) batch.add(place(box(0.02, 1.85, 0.02), x + dx + s, 1.42, z), M.metalDark);
	}
}

export function slide(batch, M, x, z) {
	batch.add(place(box(1, 1.6, 1, 1), x, 0.8, z), M.metalRust);
	batch.add(place(box(0.7, 0.05, 3.2), x, 0.85, z - 1.9, 0, 0.5), M.yellow);
}

// фонари: стекло горящего светит (на высоком качестве — со свечением), под ним на земле тёплое пятно света
// (без настоящего источника — телефону ничего не стоит); примерно каждый четвёртый фонарь разбит
let lampMats = null;
const lampMaterials = () => lampMats ??= {
	lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.45, 1.0), toneMapped: false }),
	dead: new THREE.MeshStandardMaterial({ color: 0x6a6e66, roughness: 0.4 }),
	pool: new THREE.MeshBasicMaterial({ map: T.softDotTexture('255,196,120'), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
};
/**
 * Настройки выгрузки для Godot-версии (tools/godot-export.html меняет их перед сборкой локаций; браузерная игра —
 * как прежде): poles — фонари и столбы ЛЭП (с камеры сверху — длинные палки через весь экран), treeKeep — доля
 * деревьев, treeScale — их размер (как в Dawn of Zombies: деревья невысокие и редкие).
 */
export const OPTIONS = { poles: true, treeKeep: 1, treeScale: 1 };

export function streetLamp(batch, M, collide, x, z) {
	if (!OPTIONS.poles) return;
	const L = lampMaterials();
	const lit = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 < 0.75;
	batch.add(place(box(0.22, 7, 0.22, 1, 3), x, 3.5, z), M.concrete);
	batch.add(place(box(0.1, 0.1, 1.7), x, 6.85, z - 0.8, 0, -0.12), M.metalDark);
	batch.add(place(box(0.32, 0.14, 0.55), x, 6.75, z - 1.65), M.metalDark);
	batch.add(place(box(0.24, 0.04, 0.42), x, 6.67, z - 1.65), lit ? L.lit : L.dead, { cast: false });
	if (lit) batch.add(place(new THREE.PlaneGeometry(6.5, 6.5).rotateX(-Math.PI / 2), x, 0.036, z - 1.65), L.pool, { cast: false });
	collide(x, z, 0.4, 0.4);
}

/** Баррикада поперёк трассы: бетонные блоки и мешки с песком, посередине проход. */
export function barricade(batch, M, collide, x, rnd) {
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
export function garden(batch, M, rnd, x, z, rows, len) {
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

export function woodpile(batch, M, collide, x, z, ry) {
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

export function outhouse(batch, M, collide, x, z, ry) {
	batch.add(place(box(1.1, 2.1, 1.1, 1.2), x, 1.05, z, ry), M.woodGrey);
	batch.add(place(box(1.3, 0.06, 1.4, 1), x, 2.2, z, ry, 0.12), M.roofMetal);
	const c = Math.cos(ry), s = Math.sin(ry);
	batch.add(place(box(0.8, 1.8, 0.04), x + 0.57 * s, 0.95, z + 0.57 * c, ry), M.wood); // дверь
	collide(x, z, 1.2, 1.2, ry);
}

/** Бельё на верёвке между двумя столбами. */
export function clothesline(batch, M, root, collide, x0, x1, z, rnd) {
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

export function bicycle(batch, M, x, z, ry) {
	for (const dx of [-0.52, 0.52]) batch.add(place(new THREE.TorusGeometry(0.33, 0.025, 6, 20).rotateX(Math.PI / 2), x + dx * Math.cos(ry), 0.03, z - dx * Math.sin(ry)), M.tire);
	batch.add(place(box(1.05, 0.04, 0.04), x, 0.05, z, ry), M.red);
	batch.add(place(box(0.04, 0.04, 0.45), x - 0.15 * Math.cos(ry), 0.05, z + 0.15 * Math.sin(ry), ry), M.metalDark);
}

export function settlementSign(batch, M, root, collide, x, z, text) {
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

export function fencePlot(batch, M, collide, cx, cz, W, D, gateSide, rnd) {
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

export function shed(batch, M, collide, x, z, ry) {
	batch.add(place(box(2.6, 2.2, 2.2, 1.2), x, 1.1, z, ry), M.woodGrey);
	batch.add(place(box(3, 0.08, 2.6, 2), x, 2.3, z, ry, 0, 0.12), M.roofMetal);
	collide(x, z, 2.7, 2.3, ry);
}

export function well(batch, M, collide, x, z) {
	batch.add(place(box(1.2, 0.9, 1.2, 1), x, 0.45, z), M.wood);
	for (const dx of [-0.55, 0.55]) batch.add(place(box(0.1, 1.8, 0.1), x + dx, 0.9, z), M.wood);
	batch.add(place(box(1.5, 0.06, 1.0, 1), x, 1.9, z, 0, 0.4), M.slate);
	batch.add(place(box(1.5, 0.06, 1.0, 1), x, 1.9, z, 0, -0.4), M.slate);
	collide(x, z, 1.3, 1.3);
}

/** Легковушка «жигули» из выдавленного силуэта. */
// общие материалы машин: стекло с отражением (видно с обеих сторон), фары, фонари, колпаки
let carMats = null;
const carMaterials = () => carMats ??= {
	glass: new THREE.MeshStandardMaterial({ color: 0x24303a, roughness: 0.06, metalness: 0.7, envMapIntensity: 1.6, side: THREE.DoubleSide }),
	cracked: new THREE.MeshStandardMaterial({ color: 0x66747a, roughness: 0.45, metalness: 0.4, side: THREE.DoubleSide }),
	head: new THREE.MeshStandardMaterial({ color: 0xe0dccb, roughness: 0.15, metalness: 0.3 }),
	tail: new THREE.MeshStandardMaterial({ color: 0x8c1c14, roughness: 0.3 }),
	chrome: new THREE.MeshStandardMaterial({ color: 0x9a9c9e, roughness: 0.35, metalness: 0.85 }),
	rim: new THREE.MeshStandardMaterial({ color: 0x5c5e60, roughness: 0.5, metalness: 0.7 }),
	plate: new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: 0.6 }),
	soot: new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 1 }),
};

/**
 * Старая советская легковушка (седан): кузов со скруглёнными кромками, крыша в цвет, стёкла кругом
 * (сверху — крыша, капот и багажник, а не чёрный ящик), хромированные бамперы, фары, фонари, номер,
 * колёса с колпаками. Краска выгоревшая, с ржавчиной и царапинами (carPaintMaterial). Всё сливается
 * в статику локации — машина не стоит лишних вызовов отрисовки. crashed — смят перед, треснуло стекло;
 * burned — обгоревший остов на дисках.
 */
export function addCar(batch, M, root, x, z, ry, color, { crashed = false, burned = false } = {}) {
	const C = carMaterials();
	const paint = T.carPaintMaterial([(color >> 16) & 255, (color >> 8) & 255, color & 255], { burned });
	const tf = new THREE.Matrix4().compose(new THREE.Vector3(x, crashed ? 0.05 : burned ? -0.1 : 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, crashed ? 0.06 : 0)), new THREE.Vector3(1, 1, 1));
	const add = (g, m, local) => { if (local) g.applyMatrix4(local); g.applyMatrix4(tf); batch.add(g, m, { cast: false }); };
	const at = (px, py, pz, rx = 0, ryy = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ryy, rz)), new THREE.Vector3(1, 1, 1));
	const extrude = (pts, depth, bevel) => {
		const sh = new THREE.Shape();
		sh.moveTo(...pts[0]); for (const p of pts.slice(1)) sh.lineTo(...p); sh.closePath();
		const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
		return g.translate(0, 0, -depth / 2);
	};
	// кузов: капот, борта, багажник (профиль сбоку, вытянут в ширину)
	const front = crashed ? 1.86 : 2.04;
	add(extrude([[-2.06, 0.3], [front, 0.3], [front + 0.06, 0.44], [front + 0.04, 0.72], [front - 0.88, 0.83], [-1.5, 0.85], [-2.02, 0.8], [-2.08, 0.5]], 1.56, 0.05), paint);
	// салон: стойки в цвет кузова, крыша, стёкла
	add(extrude([[-1.32, 0.84], [0.78, 0.84], [0.24, 1.34], [-1.0, 1.34]], 1.36, 0.03), paint);
	add(box(1.3, 0.05, 1.4, 1.5), paint, at(-0.38, 1.37, 0));
	const glass = burned ? C.soot : C.glass;
	// наклонное стекло между точками профиля a и b, чуть снаружи салона
	const slope = ([ax, ay], [bx, by], w, mat) => {
		const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len; // наружу от салона
		const ang = Math.atan2(dy, dx) - Math.PI / 2;
		add(new THREE.BoxGeometry(0.012, len * 0.9, w), mat, at((ax + bx) / 2 + nx * 0.035, (ay + by) / 2 + ny * 0.035, 0, 0, 0, ang));
	};
	slope([0.24, 1.34], [0.78, 0.84], 1.26, crashed ? C.cracked : glass); // лобовое
	slope([-1.32, 0.84], [-1.0, 1.34], 1.22, glass); // заднее
	// боковые окна: переднее и заднее с каждой стороны
	const pane = (pts) => { const sh = new THREE.Shape(); sh.moveTo(...pts[0]); for (const p of pts.slice(1)) sh.lineTo(...p); sh.closePath(); return new THREE.ShapeGeometry(sh); };
	for (const side of [1, -1]) {
		for (const pts of [[[0.62, 0.9], [0.22, 1.29], [-0.32, 1.29], [-0.32, 0.9]], [[-0.44, 0.9], [-0.44, 1.29], [-0.95, 1.29], [-1.2, 0.9]]]) {
			add(pane(pts), glass, at(0, 0, side * 0.725));
		}
		// бамперы, фары, фонари
		add(box(0.1, 0.26, 0.3), C.tail, at(-2.1, 0.64, side * 0.56));
		if (!burned) add(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), C.head, at(front + 0.07, 0.6, side * 0.55, 0, 0, Math.PI / 2));
		// колёса: шина и колпак; у обгоревшей — только диски
		for (const wx of [-1.28, 1.28]) {
			if (!burned) add(new THREE.CylinderGeometry(0.31, 0.31, 0.2, 16), M.tire, at(wx, 0.31, side * 0.72, Math.PI / 2));
			add(new THREE.CylinderGeometry(0.17, 0.17, burned ? 0.16 : 0.21, 12), C.rim, at(wx, burned ? 0.27 : 0.31, side * 0.72, Math.PI / 2));
		}
	}
	add(box(0.12, 0.14, 1.62), burned ? C.soot : C.chrome, at(front + 0.08, 0.4, 0));
	add(box(0.12, 0.14, 1.62), burned ? C.soot : C.chrome, at(-2.12, 0.4, 0));
	add(box(0.04, 0.18, 0.86), M.metalDark, at(front + 0.06, 0.6, 0)); // решётка радиатора
	if (!burned) add(box(0.02, 0.11, 0.48), C.plate, at(front + 0.15, 0.4, 0)); // номер
	if (crashed) add(box(0.9, 0.05, 1.3), paint, at(front - 0.5, 0.9, 0.05, 0.08, 0.1, 0.28)); // вздыбленный капот
}

export function bus(batch, M, root, x, z, ry) {
	const g = new THREE.Group();
	const paint = T.carPaintMaterial([190, 168, 90]);
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

export function birchMaterial() {
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

export function blob(r, detail, seed) {
	// общие вершины — сглаженные нормали: крона круглая и мягкая, а не гранёная
	const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail).deleteAttribute('normal').deleteAttribute('uv'));
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
	return g.toNonIndexed();
}

export function buildTrees(root, trees, M, chunk = HALF * 2) {
	const crowns = [];
	const variants = {
		birch: () => {
			const trunk = place(new THREE.CylinderGeometry(0.12, 0.2, 7, 12), 0, 3.5, 0);
			const crowns = [];
			for (let i = 0; i < 4; i++) crowns.push(place(blob(1.5, 1, i + 3), Math.sin(i * 2) * 0.8, 5.2 + i * 0.7, Math.cos(i * 2) * 0.8));
			return { trunk, trunkMat: M.birch, crown: mergeGeometries(crowns), crownMat: M.leaves };
		},
		apple: () => {
			const trunk = place(new THREE.CylinderGeometry(0.12, 0.18, 2.2, 10), 0, 1.1, 0);
			return { trunk, trunkMat: M.bark, crown: place(blob(1.8, 1, 11), 0, 3, 0), crownMat: M.leavesDry };
		},
		pine: () => {
			const trunk = place(new THREE.CylinderGeometry(0.15, 0.25, 9, 10), 0, 4.5, 0);
			const cones = [0, 1, 2, 3].map((i) => place(new THREE.ConeGeometry(2.2 - i * 0.45, 3, 12), 0, 4 + i * 1.6, 0));
			return { trunk, trunkMat: M.bark, crown: mergeGeometries(cones), crownMat: M.pine };
		},
	};
	// по участкам: деревья каждого вида на участке — свой меш, за экраном видеокарта их не рисует
	const tiles = new Map();
	for (const t of trees) {
		const key = `${t.kind}:${Math.floor(t.x / chunk)},${Math.floor(t.z / chunk)}`;
		if (!tiles.has(key)) tiles.set(key, []);
		tiles.get(key).push(t);
	}
	const kinds = {};
	for (const [key, list] of tiles) {
		const kind = key.split(':')[0];
		const v = (kinds[kind] ??= variants[kind]());
		v.crownWind ??= windMaterial(v.crownMat, { height: kind === 'apple' ? 4 : 8, amount: kind === 'pine' ? 0.12 : 0.22 });
		const trunk = new THREE.InstancedMesh(v.trunk, v.trunkMat, list.length);
		const crown = new THREE.InstancedMesh(v.crown, v.crownWind, list.length);
		const m = new THREE.Matrix4();
		list.forEach((t, i) => {
			m.compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.r, 0)), new THREE.Vector3(t.s, t.s * (0.9 + (i % 3) * 0.08), t.s));
			trunk.setMatrixAt(i, m);
			crown.setMatrixAt(i, m);
		});
		for (const im of [trunk, crown]) { im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; root.add(im); }
		crowns.push({ mesh: crown, list, matrix: new THREE.Matrix4() });
	}
	return crowns;
}

export function grassTufts(root, nav, rnd, count, indoors, onRoad = () => false, chunk = HALF * 2) {
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
	const mat = windMaterial(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), { height: 0.45, amount: 0.07 });
	const g1 = new THREE.PlaneGeometry(0.7, 0.45).translate(0, 0.22, 0);
	const g = mergeGeometries([g1, g1.clone().rotateY(Math.PI / 2)]);
	// кустики раскладываются по участкам: на каждый — свой меш, за экраном не рисуется
	const tiles = new Map();
	let n = 0;
	for (let i = 0; i < count * 2 && n < count; i++) {
		const x = (rnd() * 2 - 1) * (PLAY - 1), z = (rnd() * 2 - 1) * (PLAY - 1);
		if (onRoad(x, z, 0)) continue;
		if (nav.blockedAt(x, z, 0.5) || indoors(x, z, 0.4)) continue;
		const s = 0.6 + rnd() * 0.9, key = `${Math.floor(x / chunk)},${Math.floor(z / chunk)}`;
		if (!tiles.has(key)) tiles.set(key, []);
		tiles.get(key).push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 3, 0)), new THREE.Vector3(s, s, s)));
		n++;
	}
	for (const list of tiles.values()) {
		const im = new THREE.InstancedMesh(g, mat, list.length);
		list.forEach((m, i) => im.setMatrixAt(i, m));
		im.computeBoundingSphere();
		im.receiveShadow = true;
		root.add(im);
	}
}

export function markingMaterial() {
	const t = T.roadMarkingTexture();
	return new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.8 });
}

export function fogWalls(root) {
	const tex = T.fogWallTexture();
	const mats = [];
	const group = new THREE.Group();
	group.name = 'FogWalls';
	for (let side = 0; side < 4; side++) {
		for (let layer = 0; layer < 3; layer++) {
			const t = tex.clone();
			t.needsUpdate = true;
			t.repeat.set(3, 1);
			const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.42 + layer * 0.18, depthWrite: false, color: 0xb4b09a, fog: false, side: THREE.DoubleSide });
			mats.push({ m, speed: (0.004 + layer * 0.003) * (side % 2 ? -1 : 1) });
			const plane = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 30, 26), m);
			const d = HALF - 3 + layer * 2.5;
			plane.position.y = 11;
			if (side === 0) { plane.position.z = -d; }
			if (side === 1) { plane.position.z = d; plane.rotation.y = Math.PI; }
			if (side === 2) { plane.position.x = -d; plane.rotation.y = Math.PI / 2; }
			if (side === 3) { plane.position.x = d; plane.rotation.y = -Math.PI / 2; }
			group.add(plane);
		}
	}
	// земля у края тонет в светлой мути: дальше края — сплошная дымка, но без черноты
	const ring = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 50, HALF * 2 + 50), new THREE.ShaderMaterial({
		transparent: true, depthWrite: false,
		uniforms: { color: { value: new THREE.Color(0x8d8a78) }, edge: { value: HALF - 1 } },
		vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
		fragmentShader: 'uniform vec3 color; uniform float edge; varying vec2 vP; void main(){ float d = max(abs(vP.x), abs(vP.y)); float k = smoothstep(edge - 10.0, edge + 4.0, d); gl_FragColor = vec4(color, k * k * (3.0 - 2.0 * k) * 0.88); }',
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

/** Теплица-арка из поликарбоната вдоль Z: рёбра, плёнка и помидоры внутри. */
export function greenhouse(batch, M, collide, x, z, len = 5, w = 3, ry = 0) {
	const r = w / 2;
	const film = new THREE.CylinderGeometry(r, r, len, 14, 1, true, -Math.PI / 2, Math.PI);
	film.rotateX(-Math.PI / 2);
	batch.add(place(film, x, 0.15, z, ry), M.film, { cast: false });
	for (let k = 0; k <= Math.round(len / 1.2); k++) {
		const dz = -len / 2 + (k * len) / Math.round(len / 1.2);
		const rib = new THREE.TorusGeometry(r, 0.025, 4, 14, Math.PI);
		const c = Math.cos(ry), s = Math.sin(ry);
		batch.add(place(rib, x + dz * s, 0.15, z + dz * c, ry), M.metalDark);
	}
	for (let i = -1; i <= 1; i += 2) {
		const c = Math.cos(ry), s = Math.sin(ry);
		const px = x + i * 0.55 * c, pz = z - i * 0.55 * s;
		for (let k = -len / 2 + 0.5; k < len / 2 - 0.3; k += 0.6) {
			batch.add(place(new THREE.IcosahedronGeometry(0.22, 0).scale(1, 1.6, 1), px + k * s, 0.4, pz + k * c), M.leaves);
		}
	}
	collide(x, z, w + 0.1, len + 0.1, ry);
}

/** Пруд: тёмная вода с камышом по берегу; в воду не зайти. */
export function pond(batch, root, M, collide, x, z, rx, rz, rnd) {
	const water = new THREE.Mesh(new THREE.CircleGeometry(1, 32), M.water);
	water.rotation.x = -Math.PI / 2;
	water.scale.set(rx, rz, 1);
	water.position.set(x, 0.035, z);
	water.receiveShadow = true;
	root.add(water);
	const bank = new THREE.RingGeometry(0.92, 1.12, 32);
	bank.scale(rx, rz, 1).rotateX(-Math.PI / 2);
	batch.add(place(bank, x, 0.03, z), M.dirt, { cast: false });
	for (let i = 0; i < 40; i++) {
		const a = rnd() * Math.PI * 2, k = 0.88 + rnd() * 0.2;
		const px = x + Math.cos(a) * rx * k, pz = z + Math.sin(a) * rz * k;
		batch.add(place(new THREE.ConeGeometry(0.05, 0.9 + rnd() * 0.6, 4), px, 0.5, pz, 0, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3), M.leavesDry);
	}
	// коллайдер — полосы внутри эллипса
	const n = 6;
	for (let i = 0; i < n; i++) {
		const t = (i + 0.5) / n * 2 - 1, hw = Math.sqrt(1 - t * t) * rx * 0.86;
		collide(x, z + t * rz * 0.86, hw * 2, (rz * 0.86 * 2) / n);
	}
}

/** Трансформаторная будка с табличкой «Не влезай — убьёт». */
export function transformer(batch, root, M, collide, x, z) {
	batch.add(place(box(3, 3, 2.6, 1.5), x, 1.5, z), M.whiteBrick);
	batch.add(place(box(3.3, 0.15, 2.9, 2), x, 3.08, z), M.roofTar);
	batch.add(place(box(1.0, 2.0, 0.06), x - 0.6, 1.0, z + 1.32), M.metalOlive);
	const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), T.signMaterial('⚡', { bg: '#f0e040', fg: '#1a1a1a', w: 128, h: 90 }));
	sign.position.set(x + 0.7, 1.9, z + 1.32);
	root.add(sign);
	collide(x, z, 3.1, 2.7);
}

/** Деревянные столбы ЛЭП с провисшими проводами вдоль линии z от x0 до x1. */
export function powerLine(batch, root, M, collide, x0, x1, z, step = 22) {
	if (!OPTIONS.poles) return;
	const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
	let prev = null;
	for (let x = x0; x <= x1 + 0.01; x += step) {
		batch.add(place(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 7), x, 3.75, z), M.bark);
		batch.add(place(box(1.6, 0.12, 0.12), x, 7.0, z), M.wood);
		collide(x, z, 0.4, 0.4);
		if (prev !== null) {
			for (const off of [-0.65, 0.65]) {
				const pts = [];
				for (let k = 0; k <= 12; k++) {
					const t = k / 12;
					pts.push(new THREE.Vector3(prev + (x - prev) * t + off, 7.05 - Math.sin(Math.PI * t) * 0.9, z));
				}
				root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
			}
		}
		prev = x;
	}
}

/** Синяя бочка для полива. */
export function waterBarrel(batch, M, collide, x, z) {
	batch.add(place(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 12), x, 0.48, z), M.woodBlue);
	batch.add(place(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 12), x, 0.94, z), M.water);
	collide(x, z, 0.65, 0.65);
}
