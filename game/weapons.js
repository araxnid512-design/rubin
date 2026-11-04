// Оружие в системе координат хвата (узлы GripR/GripL в модели игрока):
// начало — центр кулака, +Z — в сторону большого пальца (вдоль топорища/рукояти),
// −Y — от запястья к пальцам (куда смотрит лезвие и ствол).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTripo } from './tripo-weapons.js';

const shadow = (g) => { g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; };

/**
 * Опора левой кисти на двуручном оружии (userData.gripL): где центр левого кулака — узел GripL кисти героя — в осях
 * хвата и как цевьё лежит в ладони. Цевьё — наискось: большой палец вперёд-влево вдоль ствола, пальцы обхватывают
 * правый бок (как FOREGRIP в src/hero-animations.js — с ним запечены клипы с автоматом). Godot-версия выгружает
 * точку пустым узлом GripL (tools/godot-export.html) и ставит туда левую кисть через IK.
 * y — насколько впереди кулака правой руки (по стволу, −Y), z — высота центра кулака, x — сдвиг влево.
 */
const FOREGRIP_HANDLE = new THREE.Vector3(0.6, -0.6, 0.3);
const FOREGRIP_BLADE = new THREE.Vector3(-0.6, -0.6, 0.2);
function setGripL(g, y, z = 0.02, x = 0.03) {
	const Z = FOREGRIP_HANDLE.clone().normalize();
	const Y = FOREGRIP_BLADE.clone().addScaledVector(Z, -FOREGRIP_BLADE.dot(Z)).normalize().negate();
	const X = new THREE.Vector3().crossVectors(Y, Z);
	const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
	g.userData.gripL = { pos: new THREE.Vector3(x, y, z), quat };
}

/**
 * Наклон топорища в кулаке, градусы. Топорище лежит в ладони наискось — от основания мизинца
 * к указательному пальцу, поэтому оно отклонено от стороны большого пальца (+Z) к пальцам (−Y).
 * Так топор продолжает линию руки при небольшом отклонении кисти, как у настоящего хвата.
 */
export const AXE_GRIP_TILT = 35;

/**
 * Топор: хват у нижнего конца топорища, топорище уходит от большого пальца, лезвие — по пальцам.
 * fire — пожарный топор: длиннее, красная голова с клювом.
 */
export function makeAxe({ fire = false } = {}) {
	const g = new THREE.Group();
	g.name = fire ? 'FireAxe' : 'Axe';
	g.userData.tilt = THREE.MathUtils.degToRad(AXE_GRIP_TILT);
	const body = new THREE.Group(); // сам топор в своих осях: топорище по +Z, лезвие по −Y
	body.rotation.x = g.userData.tilt;
	const wood = new THREE.MeshStandardMaterial({ color: fire ? 0x9a6a3a : 0x7a5432, roughness: 0.75 });
	const steel = fire ? new THREE.MeshStandardMaterial({ color: 0xa82a20, roughness: 0.45, metalness: 0.5 }) : new THREE.MeshStandardMaterial({ color: 0x8e959a, roughness: 0.32, metalness: 0.9 });
	const edgeMat = new THREE.MeshStandardMaterial({ color: 0xc8ced2, roughness: 0.2, metalness: 1 });
	const L = fire ? 0.78 : 0.62;
	const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, L, 10), wood);
	handle.rotation.x = Math.PI / 2;
	handle.position.z = L / 2 - 0.09; // ниже кулака торчит 9 см
	const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), wood);
	knob.position.z = -0.09;
	// обух и щёки топора
	const head = new THREE.Mesh(rbox(0.03, 0.07, 0.07), steel);
	head.position.set(0, 0.005, L - 0.12);
	// клин лезвия, расширяется к режущей кромке (по −Y)
	const blade = new THREE.Shape();
	blade.moveTo(-0.035, 0); blade.lineTo(0.035, 0); blade.lineTo(0.06, -0.13); blade.lineTo(-0.055, -0.13); blade.closePath();
	const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
	bladeGeo.translate(0, -0.025, -0.006);
	bladeGeo.rotateY(Math.PI / 2);
	const bladeMesh = new THREE.Mesh(bladeGeo, steel);
	bladeMesh.position.set(0, 0, L - 0.12);
	const edge = new THREE.Mesh(rbox(0.006, 0.006, 0.118), edgeMat);
	edge.position.set(0, -0.158, L - 0.12);
	body.add(handle, knob, head, bladeMesh, edge);
	if (fire) {
		// клюв с обратной стороны головы
		const pick = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.13, 6), steel);
		pick.position.set(0, 0.09, L - 0.12);
		body.add(pick);
		bladeMesh.scale.set(1.15, 1.2, 1.2);
		edge.position.y = -0.19; edge.scale.z = 1.2;
	}
	g.add(body);
	return shadow(g);
}

const M = (color, roughness = 0.5, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const part = (g, geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
const barrelY = (r, len) => new THREE.CylinderGeometry(r, r, len, 14); // цилиндр вдоль Y — как ствол
/**
 * Деталь-брусок со скруглёнными рёбрами: металл и дерево не режут глаз острыми гранями (радиус — около
 * четверти самой тонкой стороны; на иконках и вблизи видно, что детали обработаны).
 */
const rbox = (w, h, d) => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.28);
/**
 * Рукоятка затворной рамы на правом боку ствольной коробки (правый бок — −X хвата): после выстрела рама
 * отскакивает назад (к прикладу, +Y) и возвращается — userData.action, анимирует game.cycleGun.
 */
const boltHandle = (g, mat, x, y, z) => {
	const h = part(g, rbox(0.03, 0.014, 0.014), mat, x, y, z);
	g.userData.action = { part: h, travel: 0.055, dur: 0.07 };
};

/** Обрез ИЖ-43: два ствола 12 калибра бок о бок, укороченный приклад-рукоять в кулаке. */
export function makeObrez() {
	const g = new THREE.Group();
	g.name = 'Obrez';
	const metal = M(0x26282a, 0.35, 0.8), wood = M(0x6a4024, 0.6);
	part(g, rbox(0.034, 0.05, 0.13), wood, 0, 0.02, 0.0, -0.25); // рукоять в кулаке
	part(g, rbox(0.05, 0.085, 0.06), metal, 0, -0.03, 0.062); // колодка
	for (const x of [-0.019, 0.019]) part(g, barrelY(0.018, 0.32), metal, x, -0.23, 0.07);
	part(g, rbox(0.05, 0.13, 0.025), wood, 0, -0.13, 0.042); // цевьё
	part(g, new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI), metal, 0, -0.035, 0.03).rotation.y = Math.PI / 2;
	g.userData.muzzle = new THREE.Vector3(0, -0.39, 0.07);
	setGripL(g, -0.14, 0.0); // под цевьём (клипы обреза пока одноручные — точка на будущее)
	return shadow(g);
}

/** АКС-74У: пистолетная рукоять в кулаке, ствольная коробка, цевьё, магазин-«рожок», откидной приклад. */
export function makeAks() {
	const g = new THREE.Group();
	g.name = 'AKS74U';
	const metal = M(0x2a2c2e, 0.4, 0.75), wood = M(0x8a4a24, 0.55), mag = M(0x7a3a20, 0.6);
	part(g, rbox(0.03, 0.035, 0.11), M(0x3a2a20, 0.7), 0, 0.012, 0.005, -0.3); // рукоять
	part(g, rbox(0.05, 0.3, 0.07), metal, 0, -0.08, 0.078); // ствольная коробка
	part(g, rbox(0.045, 0.3, 0.02), metal, 0, -0.08, 0.118); // крышка
	part(g, rbox(0.056, 0.15, 0.05), wood, 0, -0.29, 0.07); // цевьё
	part(g, barrelY(0.015, 0.12), metal, 0, -0.42, 0.088);
	part(g, barrelY(0.022, 0.07), metal, 0, -0.5, 0.088); // пламегаситель
	part(g, barrelY(0.01, 0.17), metal, 0, -0.29, 0.122); // газовая трубка
	// изогнутый магазин: два наклонных куска
	part(g, rbox(0.026, 0.06, 0.1), mag, 0, -0.11, 0.0, 0.2);
	part(g, rbox(0.026, 0.06, 0.09), mag, 0, -0.14, -0.085, 0.55);
	// откидной приклад (разложен): две тяги и затыльник
	for (const z of [0.06, 0.11]) part(g, rbox(0.012, 0.27, 0.012), metal, 0, 0.2, z);
	part(g, rbox(0.03, 0.025, 0.1), metal, 0, 0.33, 0.085);
	boltHandle(g, metal, -0.035, -0.02, 0.1);
	g.userData.muzzle = new THREE.Vector3(0, -0.54, 0.088);
	setGripL(g, -0.29); // цевьё
	return shadow(g);
}

// ---------- Каталог ----------

/** Патроны: какие бывают и как называются. */
/** МР-133: помповый дробовик — деревянные приклад и цевьё, длинный ствол над трубчатым магазином. */
export function makeShotgun() {
	const g = new THREE.Group();
	g.name = 'Shotgun';
	const metal = M(0x2a2c2e, 0.38, 0.8), wood = M(0x7a4a26, 0.6);
	part(g, rbox(0.034, 0.05, 0.12), wood, 0, 0.025, 0.01, -0.3); // шейка приклада в кулаке
	part(g, rbox(0.04, 0.26, 0.075), wood, 0, 0.19, 0.055, -0.08); // приклад
	part(g, rbox(0.045, 0.02, 0.085), M(0x1a1a1a, 0.8), 0, 0.325, 0.045); // затыльник
	part(g, rbox(0.046, 0.2, 0.07), metal, 0, -0.06, 0.08); // ствольная коробка
	part(g, barrelY(0.012, 0.5), metal, 0, -0.39, 0.105);
	part(g, barrelY(0.011, 0.4), metal, 0, -0.34, 0.077); // магазин-труба
	const pump = part(g, rbox(0.05, 0.14, 0.046), wood, 0, -0.29, 0.075); // цевьё-помпа
	part(g, new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI), metal, 0, -0.03, 0.04).rotation.y = Math.PI / 2;
	// после выстрела цевьё передёргивают: назад-вперёд (звук — в audio.js)
	g.userData.action = { part: pump, travel: 0.085, dur: 0.38, delay: 0.26 };
	g.userData.muzzle = new THREE.Vector3(0, -0.64, 0.105);
	setGripL(g, -0.29, 0.025); // цевьё-помпа
	return shadow(g);
}

/** «Вектор» — угловатый пистолет-пулемёт: высокий корпус, наклонный низ, длинный магазин, складной приклад. */
export function makeVector() {
	const g = new THREE.Group();
	g.name = 'Vector';
	const black = M(0x1c1d1f, 0.55, 0.3), dark = M(0x2c2e30, 0.4, 0.6);
	part(g, rbox(0.03, 0.035, 0.11), black, 0, 0.01, 0.005, -0.25); // рукоять
	part(g, rbox(0.046, 0.3, 0.07), black, 0, -0.07, 0.095); // корпус
	part(g, rbox(0.044, 0.14, 0.06), black, 0, -0.12, 0.035, 0.35); // наклонный низ
	part(g, rbox(0.036, 0.1, 0.04), dark, 0, -0.26, 0.11); // кожух ствола
	part(g, rbox(0.012, 0.26, 0.012), dark, 0, -0.06, 0.137); // планка сверху
	part(g, rbox(0.024, 0.045, 0.17), dark, 0, -0.04, -0.07); // магазин
	for (const z of [0.07, 0.115]) part(g, rbox(0.01, 0.2, 0.01), dark, 0, 0.17, z); // приклад-рамка
	part(g, rbox(0.03, 0.02, 0.07), black, 0, 0.27, 0.09);
	g.userData.muzzle = new THREE.Vector3(0, -0.32, 0.11);
	setGripL(g, -0.2, 0.035); // под кожухом ствола
	return shadow(g);
}

/** Автомат Калашникова: ak74 — пластик «сливового» цвета, дульный тормоз; ak47 — дерево и сталь, косой компенсатор. */
function makeKalash({ name, furniture, magMat, brake, stockLen = 0.3 }) {
	const g = new THREE.Group();
	g.name = name;
	const metal = M(0x2a2c2e, 0.4, 0.75);
	part(g, rbox(0.03, 0.035, 0.11), furniture, 0, 0.012, 0.005, -0.3); // рукоять
	part(g, rbox(0.05, 0.3, 0.07), metal, 0, -0.08, 0.078); // ствольная коробка
	part(g, rbox(0.045, 0.3, 0.02), metal, 0, -0.08, 0.118); // крышка
	part(g, rbox(0.056, 0.2, 0.05), furniture, 0, -0.32, 0.07); // цевьё
	part(g, barrelY(0.01, 0.2), furniture, 0, -0.32, 0.122); // газовая трубка с накладкой
	part(g, barrelY(0.012, 0.24), metal, 0, -0.52, 0.088);
	part(g, barrelY(brake ? 0.017 : 0.014, 0.08), metal, 0, -0.66, 0.088); // тормоз / компенсатор
	part(g, rbox(0.01, 0.015, 0.03), metal, 0, -0.6, 0.11); // мушка
	part(g, rbox(0.026, 0.06, 0.1), magMat, 0, -0.11, 0.0, 0.2); // изогнутый магазин
	part(g, rbox(0.026, 0.065, 0.1), magMat, 0, -0.15, -0.09, 0.6);
	part(g, rbox(0.04, stockLen, 0.07), furniture, 0, 0.07 + stockLen / 2, 0.055, -0.12); // приклад
	part(g, rbox(0.044, 0.02, 0.09), M(0x1a1a1a, 0.7), 0, 0.08 + stockLen, 0.04);
	boltHandle(g, metal, -0.035, -0.02, 0.1);
	g.userData.muzzle = new THREE.Vector3(0, -0.71, 0.088);
	setGripL(g, -0.29); // цевьё — та же точка, что в клипах с автоматом
	return shadow(g);
}
export const makeAk74 = () => makeKalash({ name: 'AK74', furniture: M(0x4a2e2a, 0.6), magMat: M(0x6a3424, 0.55), brake: true });
export const makeAk47 = () => makeKalash({ name: 'AK47', furniture: M(0x8a4a24, 0.55), magMat: M(0x2e3032, 0.45, 0.6), brake: false, stockLen: 0.32 });

/** СВД: длинный ствол, деревянный приклад-«скелет», цевьё, оптический прицел ПСО, магазин на 10. */
export function makeSvd() {
	const g = new THREE.Group();
	g.name = 'SVD';
	const metal = M(0x2a2c2e, 0.4, 0.75), wood = M(0x7e4422, 0.55), glass = M(0x203040, 0.1, 0.6);
	part(g, rbox(0.032, 0.035, 0.1), wood, 0, 0.02, 0.01, -0.3); // рукоять приклада
	part(g, rbox(0.046, 0.28, 0.066), metal, 0, -0.06, 0.08); // ствольная коробка
	// приклад-скелет: верхняя щека, нижняя планка, затыльник
	part(g, rbox(0.04, 0.3, 0.03), wood, 0, 0.22, 0.1);
	part(g, rbox(0.036, 0.26, 0.022), wood, 0, 0.2, 0.0, 0.18);
	part(g, rbox(0.042, 0.03, 0.13), wood, 0, 0.37, 0.05);
	part(g, rbox(0.052, 0.24, 0.05), wood, 0, -0.33, 0.075); // цевьё
	part(g, barrelY(0.011, 0.42), metal, 0, -0.66, 0.088);
	part(g, barrelY(0.014, 0.07), metal, 0, -0.9, 0.088); // пламегаситель
	part(g, barrelY(0.018, 0.22), metal, 0, -0.08, 0.16); // прицел
	part(g, barrelY(0.022, 0.03), metal, 0, -0.2, 0.16);
	part(g, barrelY(0.021, 0.004), glass, 0, -0.215, 0.16);
	part(g, rbox(0.02, 0.08, 0.035), metal, 0, -0.06, 0.125); // кронштейн
	part(g, rbox(0.024, 0.05, 0.09), metal, 0, -0.1, -0.025, 0.12); // магазин
	boltHandle(g, metal, -0.033, -0.01, 0.1);
	g.userData.muzzle = new THREE.Vector3(0, -0.94, 0.088);
	setGripL(g, -0.33, 0.025); // цевьё
	return shadow(g);
}

/** ПКМ: пулемёт под 7,62×54R — длинный ствол с ручкой, приклад-рамка, короб с лентой сбоку, сошки. */
export function makePkm() {
	const g = new THREE.Group();
	g.name = 'PKM';
	const metal = M(0x2a2c2e, 0.4, 0.75), dark = M(0x1e2022, 0.5, 0.6), olive = M(0x4a5236, 0.6, 0.3), stock = M(0x3a3634, 0.6, 0.2);
	part(g, rbox(0.032, 0.035, 0.1), stock, 0, 0.012, 0.005, -0.3); // рукоять
	part(g, rbox(0.056, 0.34, 0.075), metal, 0, -0.07, 0.085); // ствольная коробка
	part(g, rbox(0.05, 0.3, 0.02), dark, 0, -0.07, 0.13); // крышка
	// приклад-рамка
	part(g, rbox(0.036, 0.3, 0.025), stock, 0, 0.22, 0.1);
	part(g, rbox(0.03, 0.27, 0.02), stock, 0, 0.2, 0.0, 0.2);
	part(g, rbox(0.04, 0.03, 0.13), stock, 0, 0.37, 0.05);
	part(g, barrelY(0.014, 0.56), metal, 0, -0.52, 0.092); // ствол
	part(g, barrelY(0.019, 0.08), metal, 0, -0.83, 0.092); // пламегаситель
	part(g, barrelY(0.01, 0.42), dark, 0, -0.42, 0.06); // газовый цилиндр
	part(g, rbox(0.012, 0.03, 0.09), metal, 0, -0.34, 0.15); // ручка для переноски
	part(g, rbox(0.012, 0.09, 0.012), metal, 0, -0.34, 0.195);
	// сошки, сложенные вдоль ствола
	for (const x of [-0.016, 0.016]) part(g, rbox(0.008, 0.3, 0.008), dark, x, -0.6, 0.065);
	// короб с лентой — слева снизу, лента тянется в приёмник
	part(g, rbox(0.1, 0.11, 0.09), olive, -0.06, -0.12, 0.02);
	part(g, rbox(0.04, 0.02, 0.035), M(0xb8923e, 0.35, 0.85), -0.03, -0.1, 0.075);
	boltHandle(g, metal, -0.04, 0.0, 0.09); // над коробом, как у настоящего ПКМ
	g.userData.muzzle = new THREE.Vector3(0, -0.87, 0.092);
	setGripL(g, -0.3, 0.025); // под газовой трубкой
	return shadow(g);
}

/** ВСС «Винторез»: бесшумная снайперская винтовка — толстый интегрированный глушитель, приклад-скелет, прицел. */
export function makeVss() {
	const g = new THREE.Group();
	g.name = 'VSS';
	const metal = M(0x2a2c2e, 0.4, 0.75), dark = M(0x1c1d1f, 0.5, 0.5), wood = M(0x6e3e22, 0.55), glass = M(0x203040, 0.1, 0.6);
	part(g, rbox(0.03, 0.035, 0.1), wood, 0, 0.015, 0.008, -0.3); // рукоять приклада
	part(g, rbox(0.046, 0.24, 0.066), metal, 0, -0.05, 0.08); // ствольная коробка
	// приклад-скелет
	part(g, rbox(0.036, 0.26, 0.026), wood, 0, 0.2, 0.095);
	part(g, rbox(0.032, 0.22, 0.02), wood, 0, 0.18, 0.005, 0.2);
	part(g, rbox(0.04, 0.03, 0.12), wood, 0, 0.32, 0.05);
	part(g, rbox(0.05, 0.12, 0.048), wood, 0, -0.22, 0.075); // цевьё
	part(g, barrelY(0.026, 0.36), dark, 0, -0.44, 0.088); // глушитель
	part(g, barrelY(0.028, 0.02), metal, 0, -0.62, 0.088);
	part(g, barrelY(0.016, 0.18), metal, 0, -0.06, 0.155); // прицел
	part(g, barrelY(0.02, 0.028), metal, 0, -0.165, 0.155);
	part(g, barrelY(0.019, 0.004), glass, 0, -0.18, 0.155);
	part(g, rbox(0.018, 0.07, 0.03), metal, 0, -0.05, 0.123); // кронштейн
	part(g, rbox(0.026, 0.05, 0.1), metal, 0, -0.09, -0.03, 0.1); // магазин на 20
	boltHandle(g, metal, -0.033, 0.0, 0.1);
	g.userData.muzzle = new THREE.Vector3(0, -0.64, 0.088);
	setGripL(g, -0.22, 0.025); // цевьё
	return shadow(g);
}

// ---------- Новые стволы (SCAR-H, FN FAL, Steyr AUG, PM-63 RAK, SPAS-12) ----------
// Детали — скруглённые бруски, стволы-цилиндры и профили (контур в плоскости хвата, выдавленный по толщине),
// пистолетная рукоять наклонена как у настоящего оружия: низ — к прикладу. В конце детали одного материала
// сливаются в один меш: на телефоне ствол в руке и за спиной — несколько команд видеокарте, а не десятки.

/** Контур (u, v) → хват (x = толщина, y = u, z = v). */
const YZX = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
/**
 * Профильная деталь: draw(s) рисует контур в координатах хвата (y — вдоль ствола, z — вверх), depth — толщина
 * по X, кромки скруглены фаской bevel; holes — вырезы (функции, рисующие контур выреза).
 */
function slab(draw, depth, { bevel = Math.min(0.005, depth * 0.25), holes = [] } = {}) {
	const s = new THREE.Shape();
	draw(s);
	for (const h of holes) { const p = new THREE.Path(); h(p); s.holes.push(p); }
	const geo = new THREE.ExtrudeGeometry(s, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6 });
	geo.clearGroups();
	geo.translate(0, 0, -(depth - bevel * 2) / 2);
	geo.applyMatrix4(YZX);
	return mergeVertices(geo);
}
/** Мелкая деталь (прорезь, насечка) — простой брусок: скругления на ней не видно, а треугольников вшестеро меньше. */
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** Контур по точкам [[y, z], …] (для slab). */
const poly = (pts) => (s) => { s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); };
/** Трубка по точкам [[x, y, z], …] (скоба, крюк, ручка); flat — сплющить по X в ленту. */
function tube(g, mat, pts, r = 0.0035, flat = 1) {
	const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
	const m = part(g, new THREE.TubeGeometry(curve, pts.length * 6, r, 6), mat, 0, 0, 0);
	m.scale.x = flat;
	return m;
}
/** Пистолетная рукоять: профиль с выпуклой спинкой, наклон rake (низ уходит к прикладу, +Y). */
function pistolGrip(g, mat, { w = 0.03, front = -0.019, back = 0.021, top = 0.05, bottom = -0.062, rake = 0.3 } = {}) {
	const geo = slab((s) => {
		s.moveTo(front, top);
		s.lineTo(front, bottom + 0.012);
		s.quadraticCurveTo(front, bottom, front + 0.012, bottom);
		s.lineTo(back - 0.004, bottom);
		s.quadraticCurveTo(back + 0.002, bottom, back + 0.002, bottom + 0.012);
		s.quadraticCurveTo(back + 0.009, (top + bottom) / 2, back, top);
		s.closePath();
	}, w, { bevel: 0.006 });
	return part(g, geo, mat, 0, 0, 0, rake);
}
/** Спусковая скоба (трубка от рукояти вниз и вперёд) и спусковой крючок. */
function triggerGuard(g, mat, { y0 = -0.012, y1 = -0.075, top = 0.032, low = 0.008 } = {}) {
	tube(g, mat, [[0, y0, top], [0, y0 - 0.006, low + 0.004], [0, (y0 + y1) / 2, low], [0, y1 + 0.008, low + 0.004], [0, y1, top]], 0.0032, 1.4);
	part(g, rbox(0.006, 0.007, 0.022), mat, 0, y0 - 0.025, top - 0.012, 0.25);
}
/** Планка Пикатинни: основание и зубцы через 1 см; y0 > y1 (от приклада к стволу). */
function rail(g, mat, y0, y1, z, w = 0.022) {
	part(g, rbox(w, y0 - y1, 0.008), mat, 0, (y0 + y1) / 2, z);
	const tooth = new THREE.BoxGeometry(w + 0.003, 0.005, 0.004);
	for (let y = y0 - 0.006; y > y1 + 0.004; y -= 0.0105) part(g, tooth, mat, 0, y, z + 0.005);
}
/** Ряды отверстий на цилиндре (кожух ствола): angles — где по кругу (0 — сверху), от y0 к y1. */
function holes(g, mat, { y0, y1, n, z, r, angles }) {
	const disc = new THREE.CylinderGeometry(r * 0.24, r * 0.24, 0.004, 8);
	for (const a of angles) for (let i = 0; i < n; i++) {
		const y = y0 + ((y1 - y0) * (i + 0.5)) / n;
		const m = part(g, disc, mat, Math.sin(a) * r, y, z + Math.cos(a) * r);
		m.rotation.set(Math.PI / 2, a, 0, 'YXZ');
	}
}
/**
 * Детали одного материала — в один меш (ось хвата та же). keep — подвижные детали (затвор, цевьё), они
 * остаются отдельными, их двигает game.cycleGun.
 */
function merged(g, keep = []) {
	g.updateMatrixWorld(true);
	const byMat = new Map();
	for (const o of [...g.children]) {
		if (!o.isMesh || keep.includes(o)) continue;
		let geo = o.geometry.clone();
		geo.clearGroups();
		if (!geo.index) geo = mergeVertices(geo);
		geo.applyMatrix4(o.matrix);
		if (!byMat.has(o.material)) byMat.set(o.material, { geos: [], meshes: [] });
		byMat.get(o.material).geos.push(geo);
		byMat.get(o.material).meshes.push(o);
	}
	for (const [mat, { geos, meshes }] of byMat) {
		const geo = meshes.length > 1 ? mergeGeometries(geos) : null;
		if (!geo) continue; // одна деталь или не слилось — оставить как есть
		for (const o of meshes) g.remove(o);
		const m = new THREE.Mesh(geo, mat);
		m.name = `${g.name}_${mat.name || byMat.size}`;
		g.add(m);
	}
	return shadow(g);
}

/**
 * SCAR-H (Mk17): цвет «койот» — верхний ствольный короб с планкой Пикатинни во всю длину и боковыми планками
 * на цевье, полимерный нижний короб, прямой магазин на 20 патронов 7,62×51, складной приклад с вырезом и щекой,
 * рукоятка заряжания слева, пламегаситель.
 */
export function makeScar() {
	const g = new THREE.Group();
	g.name = 'SCAR';
	const fde = M(0xa68d64, 0.72, 0.05), upperMat = M(0xb39a6e, 0.55, 0.25), black = M(0x1d1e20, 0.5, 0.35), steel = M(0x2a2c2e, 0.38, 0.8);
	fde.name = 'fde'; upperMat.name = 'upper'; black.name = 'black'; steel.name = 'steel';
	// нижний короб с горловиной магазина
	part(g, slab(poly([[0.075, 0.068], [-0.19, 0.068], [-0.19, 0.036], [-0.176, 0.012], [-0.086, 0.012], [-0.066, 0.03], [0.03, 0.03], [0.075, 0.04]]), 0.05), fde, 0, 0, 0);
	pistolGrip(g, fde, { top: 0.045 });
	triggerGuard(g, fde, { y0: -0.014, y1: -0.082, top: 0.034 });
	// верхний короб — одно целое с цевьём; сверху планка, на цевье — боковые и нижняя
	part(g, rbox(0.056, 0.575, 0.062), upperMat, 0, -0.2, 0.098);
	rail(g, upperMat, 0.083, -0.48, 0.133);
	for (const x of [-0.031, 0.031]) part(g, rbox(0.009, 0.17, 0.02), upperMat, x, -0.39, 0.097);
	part(g, rbox(0.022, 0.17, 0.009), upperMat, 0, -0.39, 0.063);
	part(g, box(0.003, 0.065, 0.022), black, -0.0285, -0.035, 0.1); // окно выброса справа
	part(g, box(0.003, 0.2, 0.008), black, 0.0285, -0.15, 0.112); // паз рукоятки заряжания слева
	const handle = part(g, rbox(0.032, 0.016, 0.016), black, 0.042, -0.21, 0.112);
	// сложенные прицельные приспособления на планке
	part(g, rbox(0.02, 0.024, 0.013), black, 0, -0.465, 0.146);
	part(g, rbox(0.02, 0.02, 0.013), black, 0, 0.055, 0.146);
	// ствол, газовый блок и пламегаситель
	part(g, barrelY(0.0115, 0.2), steel, 0, -0.58, 0.092);
	part(g, barrelY(0.0145, 0.055), black, 0, -0.7, 0.092);
	for (const a of [0, 2.1, 4.2]) { const s = part(g, box(0.004, 0.04, 0.004), steel, Math.sin(a) * 0.0145, -0.705, 0.092 + Math.cos(a) * 0.0145); s.rotation.y = a; }
	// магазин 20 патронов, рёбра жёсткости и затыльник
	part(g, slab((s) => { s.moveTo(-0.172, 0.022); s.lineTo(-0.088, 0.022); s.quadraticCurveTo(-0.09, -0.04, -0.1, -0.104); s.lineTo(-0.18, -0.108); s.quadraticCurveTo(-0.17, -0.04, -0.172, 0.022); }, 0.03), black, 0, 0, 0);
	part(g, rbox(0.036, 0.094, 0.012), black, 0, -0.14, -0.112);
	// складной приклад: шарнир, тело с вырезом и щекой, резиновый затыльник
	part(g, rbox(0.05, 0.03, 0.062), black, 0, 0.092, 0.098);
	part(g, slab(poly([[0.105, 0.124], [0.345, 0.124], [0.362, 0.112], [0.362, -0.026], [0.34, -0.032], [0.25, 0.038], [0.15, 0.066], [0.105, 0.07]]), 0.04, {
		holes: [poly([[0.205, 0.1], [0.315, 0.1], [0.315, 0.012], [0.248, 0.058]])],
	}), fde, 0, 0, 0);
	part(g, rbox(0.044, 0.018, 0.162), black, 0, 0.372, 0.045);
	g.userData.action = { part: handle, travel: 0.04, dur: 0.07 };
	g.userData.muzzle = new THREE.Vector3(0, -0.73, 0.092);
	return merged(g, [handle]);
}

/**
 * FN FAL: воронёная сталь и дерево — деревянные приклад, рукоять и нижняя накладка цевья, сверху вентилируемый
 * кожух газовой трубки, прицел на заднем конце короба, сложенная ручка для переноски, магазин на 20, длинный
 * ствол с газовым регулятором, высокой мушкой и щелевым пламегасителем.
 */
export function makeFal() {
	const g = new THREE.Group();
	g.name = 'FAL';
	const steel = M(0x27282a, 0.42, 0.7), wood = M(0x7a4524, 0.55), dark = M(0x161718, 0.6, 0.3);
	steel.name = 'steel'; wood.name = 'wood'; dark.name = 'dark';
	// нижний короб со спуском и горловиной, верхний короб и крышка
	part(g, slab(poly([[0.072, 0.072], [-0.205, 0.072], [-0.205, 0.046], [-0.19, 0.02], [-0.092, 0.02], [-0.072, 0.034], [0.03, 0.034], [0.072, 0.044]]), 0.05), steel, 0, 0, 0);
	part(g, rbox(0.052, 0.282, 0.054), steel, 0, -0.066, 0.098);
	part(g, slab(poly([[0.075, 0.122], [-0.04, 0.134], [-0.205, 0.128], [-0.205, 0.118], [0.075, 0.116]]), 0.044), steel, 0, 0, 0);
	part(g, box(0.003, 0.07, 0.024), dark, -0.0275, -0.03, 0.1); // окно выброса
	// прицел: основание и диоптр
	part(g, rbox(0.026, 0.035, 0.02), steel, 0, 0.05, 0.138);
	part(g, rbox(0.012, 0.008, 0.024), steel, 0, 0.06, 0.155);
	// ручка для переноски сложена вдоль левого борта, рукоятка заряжания — слева спереди
	tube(g, steel, [[0.03, -0.05, 0.128], [0.04, -0.075, 0.15], [0.043, -0.14, 0.152], [0.038, -0.17, 0.132]], 0.0045);
	const handle = part(g, rbox(0.03, 0.014, 0.014), steel, 0.042, -0.17, 0.104);
	pistolGrip(g, wood, { top: 0.046 });
	triggerGuard(g, steel, { y0: -0.012, y1: -0.084, top: 0.036 });
	// цевьё: деревянная накладка снизу, сверху — кожух газовой трубки с прорезями
	part(g, slab(poly([[-0.205, 0.104], [-0.47, 0.104], [-0.47, 0.076], [-0.452, 0.058], [-0.225, 0.05], [-0.205, 0.062]]), 0.06, { bevel: 0.008 }), wood, 0, 0, 0);
	part(g, rbox(0.046, 0.262, 0.03), steel, 0, -0.337, 0.12);
	for (let i = 0; i < 5; i++) for (const x of [-0.0235, 0.0235]) part(g, box(0.003, 0.03, 0.009), dark, x, -0.255 - i * 0.042, 0.122);
	// ствол, газовый регулятор, мушка с ушками, пламегаситель
	part(g, barrelY(0.0115, 0.32), steel, 0, -0.63, 0.09);
	part(g, rbox(0.03, 0.04, 0.05), steel, 0, -0.49, 0.105);
	part(g, barrelY(0.008, 0.045), steel, 0, -0.53, 0.12);
	part(g, rbox(0.022, 0.024, 0.04), steel, 0, -0.735, 0.112);
	for (const x of [-0.009, 0.009]) part(g, rbox(0.004, 0.016, 0.028), steel, x, -0.735, 0.138);
	part(g, barrelY(0.0145, 0.075), steel, 0, -0.825, 0.09);
	for (const a of [-0.9, 0.9, Math.PI]) { const s = part(g, box(0.003, 0.05, 0.004), dark, Math.sin(a) * 0.0145, -0.83, 0.09 + Math.cos(a) * 0.0145); s.rotation.y = a; }
	// магазин на 20 и затыльник
	part(g, slab((s) => { s.moveTo(-0.184, 0.03); s.lineTo(-0.096, 0.03); s.quadraticCurveTo(-0.096, -0.04, -0.104, -0.11); s.lineTo(-0.19, -0.114); s.quadraticCurveTo(-0.184, -0.04, -0.184, 0.03); }, 0.03), steel, 0, 0, 0);
	part(g, rbox(0.036, 0.096, 0.011), steel, 0, -0.147, -0.116);
	// приклад: гребень, шейка у короба, затылок; стальной затыльник
	part(g, slab((s) => {
		s.moveTo(0.068, 0.124);
		s.lineTo(0.2, 0.12);
		s.lineTo(0.425, 0.112);
		s.lineTo(0.43, -0.03);
		s.quadraticCurveTo(0.3, 0.012, 0.16, 0.05);
		s.quadraticCurveTo(0.1, 0.056, 0.068, 0.064);
		s.closePath();
	}, 0.042, { bevel: 0.009 }), wood, 0, 0, 0);
	part(g, rbox(0.046, 0.012, 0.158), dark, 0, 0.438, 0.042);
	g.userData.action = { part: handle, travel: 0.05, dur: 0.07 };
	g.userData.muzzle = new THREE.Vector3(0, -0.865, 0.09);
	return merged(g, [handle]);
}

/**
 * Steyr AUG: буллпап — оливковое ложе от рукояти до затылка, магазин (дымчатый полимер) за рукоятью, большая
 * скоба вокруг кисти до складной передней рукояти, ручка с встроенным прицелом 1,5×, открытый ствол
 * с пламегасителем.
 */
export function makeAug() {
	const g = new THREE.Group();
	g.name = 'AUG';
	const olive = M(0x5f6647, 0.72, 0.05), black = M(0x1f2022, 0.45, 0.55), steel = M(0x2a2c2e, 0.38, 0.8), smoke = M(0x3d423e, 0.35, 0.1), glass = M(0x203040, 0.1, 0.6);
	olive.name = 'olive'; black.name = 'black'; steel.name = 'steel'; smoke.name = 'smoke'; glass.name = 'glass';
	// ложе: тонкое спереди, где выходит ствол, глубокое к затылку; горловина магазина за рукоятью
	part(g, slab((s) => {
		s.moveTo(-0.075, 0.086);
		s.lineTo(0.1, 0.096);
		s.lineTo(0.33, 0.104);
		s.quadraticCurveTo(0.375, 0.108, 0.385, 0.096);
		s.lineTo(0.385, -0.036);
		s.quadraticCurveTo(0.372, -0.052, 0.34, -0.05);
		s.lineTo(0.235, -0.032);
		s.quadraticCurveTo(0.19, -0.01, 0.16, -0.004);
		s.lineTo(0.07, 0.0);
		s.quadraticCurveTo(0.04, 0.012, 0.03, 0.036);
		s.lineTo(-0.035, 0.044);
		s.quadraticCurveTo(-0.07, 0.054, -0.075, 0.086);
	}, 0.058, { bevel: 0.012 }), olive, 0, 0, 0);
	part(g, box(0.004, 0.07, 0.03), black, -0.0345, 0.16, 0.06); // крышка окна выброса справа
	part(g, rbox(0.06, 0.012, 0.15), black, 0, 0.398, 0.03); // резиновый затыльник
	// ручка-прицел: основание на коробе, две стойки, труба прицела с объективом и окуляром
	part(g, slab(poly([[-0.095, 0.092], [-0.095, 0.118], [-0.072, 0.162], [0.16, 0.162], [0.18, 0.118], [0.18, 0.092]]), 0.03, {
		holes: [poly([[-0.05, 0.108], [0.142, 0.108], [0.142, 0.148], [-0.044, 0.148]])],
	}), black, 0, 0, 0);
	part(g, barrelY(0.0165, 0.27), black, 0, 0.04, 0.172);
	part(g, barrelY(0.021, 0.035), black, 0, -0.105, 0.172);
	part(g, barrelY(0.019, 0.004), glass, 0, -0.123, 0.172);
	part(g, barrelY(0.0185, 0.03), black, 0, 0.19, 0.172);
	part(g, barrelY(0.017, 0.004), glass, 0, 0.206, 0.172);
	const handle = part(g, rbox(0.026, 0.014, 0.016), black, 0.036, -0.05, 0.1); // рукоятка заряжания слева
	// ствол с муфтой, газовый цилиндр, пламегаситель
	part(g, barrelY(0.0125, 0.43), steel, 0, -0.29, 0.088);
	part(g, rbox(0.036, 0.055, 0.042), black, 0, -0.105, 0.078);
	part(g, barrelY(0.008, 0.08), black, 0, -0.16, 0.108);
	part(g, barrelY(0.016, 0.055), black, 0, -0.522, 0.088);
	// передняя рукоять (разложена) и большая скоба от неё до низа пистолетной рукояти
	part(g, slab(poly([[-0.098, 0.064], [-0.14, 0.064], [-0.152, -0.028], [-0.138, -0.044], [-0.11, -0.04], [-0.1, 0.0]]), 0.026, { bevel: 0.006 }), olive, 0, 0, 0);
	pistolGrip(g, olive, { top: 0.04 });
	tube(g, olive, [[0, 0.016, -0.064], [0, -0.03, -0.074], [0, -0.085, -0.066], [0, -0.115, -0.044]], 0.006, 2.2);
	part(g, rbox(0.006, 0.007, 0.024), black, 0, -0.03, 0.02, 0.25); // спуск
	// магазин за рукоятью: изогнут вперёд, затыльник
	part(g, slab((s) => { s.moveTo(0.082, 0.004); s.lineTo(0.158, 0.004); s.quadraticCurveTo(0.156, -0.08, 0.13, -0.146); s.lineTo(0.06, -0.136); s.quadraticCurveTo(0.082, -0.07, 0.082, 0.004); }, 0.03), smoke, 0, 0, 0);
	part(g, rbox(0.035, 0.08, 0.012), smoke, 0, 0.096, -0.143, -0.12);
	g.userData.action = { part: handle, travel: 0.04, dur: 0.07 };
	g.userData.muzzle = new THREE.Vector3(0, -0.552, 0.088);
	return merged(g, [handle]);
}

/**
 * PM-63 RAK: пистолет-пулемёт — затвор-кожух во всю длину с «ложкой»-компенсатором под дульным срезом,
 * рукоять с магазином на 25, торчащим снизу, разложенная складная передняя рукоять, приклад сложен
 * вдоль рамки (тяги по бокам, затыльник под рамкой).
 */
export function makePm63() {
	const g = new THREE.Group();
	g.name = 'PM63';
	const black = M(0x222325, 0.45, 0.6), grips = M(0x2c2622, 0.7, 0.1), dark = M(0x111213, 0.6, 0.3);
	black.name = 'black'; grips.name = 'grips'; dark.name = 'dark';
	// рамка под затвором и рукоять с магазином
	part(g, slab(poly([[0.055, 0.062], [-0.2, 0.062], [-0.2, 0.046], [-0.15, 0.04], [0.02, 0.038], [0.055, 0.046]]), 0.028), black, 0, 0, 0);
	pistolGrip(g, grips, { w: 0.028, front: -0.017, back: 0.02, top: 0.046, bottom: -0.056, rake: 0.22 });
	part(g, rbox(0.021, 0.027, 0.074), black, 0, 0.019, -0.088, 0.22);
	part(g, rbox(0.025, 0.034, 0.011), black, 0, 0.028, -0.126, 0.22);
	triggerGuard(g, black, { y0: -0.012, y1: -0.072, top: 0.036, low: 0.01 });
	// затвор-кожух, насечки сзади, прицел и мушка, «ложка» под стволом, окно выброса
	const slide = part(g, rbox(0.031, 0.285, 0.035), black, 0, -0.06, 0.079);
	for (let i = 0; i < 4; i++) part(g, box(0.033, 0.003, 0.022), dark, 0, 0.045 + i * 0.007, 0.08);
	part(g, rbox(0.018, 0.014, 0.008), black, 0, 0.062, 0.1);
	part(g, rbox(0.01, 0.012, 0.009), black, 0, -0.19, 0.1);
	part(g, rbox(0.029, 0.036, 0.012), black, 0, -0.214, 0.066);
	part(g, box(0.003, 0.05, 0.016), dark, -0.0155, -0.06, 0.084);
	part(g, barrelY(0.0075, 0.012), dark, 0, -0.2, 0.08); // дульный срез
	// передняя рукоять: шарнир под рамкой, рукоять вниз
	part(g, rbox(0.024, 0.02, 0.012), black, 0, -0.165, 0.038);
	part(g, slab(poly([[-0.152, 0.042], [-0.182, 0.042], [-0.19, -0.035], [-0.176, -0.046], [-0.156, -0.042], [-0.15, 0.0]]), 0.024, { bevel: 0.005 }), grips, 0, 0, 0);
	// сложенный приклад: тяги по бокам рамки, затыльник под ней впереди скобы
	for (const x of [-0.016, 0.016]) part(g, box(0.005, 0.2, 0.006), black, x, -0.035, 0.044);
	part(g, rbox(0.038, 0.016, 0.03), grips, 0, -0.128, 0.03);
	g.userData.action = { part: slide, travel: 0.03, dur: 0.06 };
	g.userData.muzzle = new THREE.Vector3(0, -0.206, 0.08);
	return merged(g, [slide]);
}

/**
 * SPAS-12: воронёный боевой дробовик — короб из сплава, ствол под перфорированным кожухом, ребристое
 * цевьё-помпа на трубчатом магазине, пистолетная рукоять, разложенный складной приклад из штампованных
 * тяг с крюком под предплечье.
 */
export function makeSpas12() {
	const g = new THREE.Group();
	g.name = 'SPAS12';
	const black = M(0x2a2c2f, 0.55, 0.45), alloy = M(0x3a3d41, 0.42, 0.6), poly12 = M(0x161718, 0.75, 0.05), steel = M(0x45484b, 0.35, 0.8), hole = M(0x050505, 0.9, 0);
	black.name = 'black'; alloy.name = 'alloy'; poly12.name = 'poly'; steel.name = 'steel'; hole.name = 'hole';
	// короб с окном подачи снизу, окно выброса и рукоятка затвора справа
	part(g, slab(poly([[0.065, 0.118], [-0.17, 0.118], [-0.17, 0.04], [-0.08, 0.03], [0.03, 0.03], [0.065, 0.046]]), 0.052, { bevel: 0.008 }), alloy, 0, 0, 0);
	part(g, box(0.003, 0.075, 0.032), hole, -0.0265, -0.06, 0.094);
	const bolt = part(g, rbox(0.03, 0.016, 0.013), steel, -0.036, -0.04, 0.092);
	part(g, rbox(0.03, 0.022, 0.016), black, 0, 0.045, 0.126); // целик
	pistolGrip(g, poly12, { top: 0.042 });
	triggerGuard(g, black, { y0: -0.012, y1: -0.08, top: 0.034 });
	// ствол, кожух с отверстиями, мушка
	part(g, barrelY(0.0125, 0.55), steel, 0, -0.445, 0.092);
	part(g, barrelY(0.019, 0.33), black, 0, -0.34, 0.095);
	holes(g, hole, { y0: -0.19, y1: -0.495, n: 8, z: 0.095, r: 0.0192, angles: [-0.9, 0, 0.9] });
	part(g, rbox(0.012, 0.02, 0.02), black, 0, -0.69, 0.11);
	// трубчатый магазин с заглушкой, хомут ствола
	part(g, barrelY(0.0125, 0.33), black, 0, -0.335, 0.058);
	part(g, barrelY(0.0145, 0.022), black, 0, -0.51, 0.058);
	part(g, rbox(0.03, 0.022, 0.06), black, 0, -0.5, 0.076);
	// ребристое цевьё-помпа (тело вращения вдоль ствола)
	const prof = [new THREE.Vector2(0.001, -0.375), new THREE.Vector2(0.026, -0.375)];
	for (let i = 0; i < 7; i++) {
		const y = -0.37 + i * 0.024;
		prof.push(new THREE.Vector2(0.029, y), new THREE.Vector2(0.0325, y + 0.004), new THREE.Vector2(0.0325, y + 0.012), new THREE.Vector2(0.029, y + 0.016));
	}
	prof.push(new THREE.Vector2(0.029, -0.2), new THREE.Vector2(0.024, -0.196), new THREE.Vector2(0.001, -0.196));
	const pump = part(g, new THREE.LatheGeometry(prof, 16), poly12, 0, 0, 0.072);
	pump.scale.x = 0.82;
	// складной приклад (разложен): верхняя и нижняя тяги, затыльник, крюк под предплечье
	part(g, rbox(0.03, 0.31, 0.012), black, 0, 0.215, 0.106);
	part(g, rbox(0.03, 0.318, 0.012), black, 0, 0.21, 0.004, -0.18);
	part(g, rbox(0.044, 0.016, 0.154), poly12, 0, 0.372, 0.042);
	tube(g, black, [[0, 0.36, -0.028], [0, 0.335, -0.07], [0, 0.285, -0.086], [0, 0.252, -0.068], [0, 0.258, -0.048]], 0.0055, 2.2);
	g.userData.action = { part: bolt, travel: 0.045, dur: 0.08 };
	g.userData.muzzle = new THREE.Vector3(0, -0.72, 0.092);
	return merged(g, [bolt]);
}

// ---------- Тяжёлое оружие (РПГ-7, РГ-6, КСВК) ----------
// Моделей Tripo у них нет — процедурные, в настоящую величину; потом вся модель ужимается вокруг хвата до SCALE
// (0,67 — как остальное оружие: просьба пользователя «на треть меньше настоящего»).

const HEAVY_SCALE = 0.67;
/** Модель в настоящую величину → на треть меньше: детали — во внутреннюю группу, точки дула и цевья — следом. */
function shrunk(g, k = HEAVY_SCALE, kick = 0.016) {
	const inner = new THREE.Group();
	inner.name = `${g.name}_body`;
	inner.scale.setScalar(k);
	inner.add(...g.children);
	g.add(inner);
	g.userData.muzzle?.multiplyScalar(k);
	g.userData.breech?.multiplyScalar(k);
	g.userData.gripL?.pos.multiplyScalar(k);
	g.userData.action = { part: inner, travel: kick, dur: 0.09 }; // отдача — вся модель назад по стволу
	return g;
}

/**
 * РПГ-7: труба 40 мм с деревянными накладками-теплоизоляторами, раструб сзади, две пистолетные рукоятки,
 * оптический прицел ПГО-7 слева; в трубе — выстрел ПГ-7В (зелёная надкалиберная граната с конусом и взрывателем).
 * userData.round — граната в трубе: после выстрела её нет, пока не перезарядишь.
 */
export function makeRpg7() {
	const g = new THREE.Group();
	g.name = 'RPG7';
	const steel = M(0x2c2f2c, 0.45, 0.6), wood = M(0x7a4a26, 0.6), olive = M(0x4a5a32, 0.55, 0.2), dark = M(0x161718, 0.6, 0.3), glass = M(0x203040, 0.1, 0.6);
	steel.name = 'steel'; wood.name = 'wood'; dark.name = 'dark';
	const z0 = 0.078;
	part(g, barrelY(0.021, 0.95), steel, 0, 0.115, z0); // труба: дуло y −0,36, казённик +0,59
	part(g, new THREE.CylinderGeometry(0.036, 0.022, 0.12, 14), steel, 0, 0.53, z0); // раструб
	part(g, barrelY(0.024, 0.02), dark, 0, -0.35, z0); // дульное кольцо
	part(g, barrelY(0.031, 0.3), wood, 0, 0.1, z0); // теплоизолятор
	part(g, barrelY(0.033, 0.012), dark, 0, -0.05, z0);
	part(g, barrelY(0.033, 0.012), dark, 0, 0.25, z0);
	pistolGrip(g, dark, { top: z0 - 0.02 });
	triggerGuard(g, dark, { y0: -0.012, y1: -0.07, top: z0 - 0.03 });
	part(g, rbox(0.03, 0.035, 0.09), dark, 0, -0.17, 0.012, -0.12); // передняя рукоятка
	part(g, rbox(0.03, 0.06, 0.02), steel, 0, -0.17, 0.052);
	// ПГО-7 слева на кронштейне, наглазник назад
	part(g, rbox(0.016, 0.05, 0.03), steel, 0.03, 0.03, z0 + 0.02);
	part(g, rbox(0.026, 0.13, 0.044), dark, 0.05, 0.02, z0 + 0.03);
	part(g, barrelY(0.014, 0.04), dark, 0.05, 0.1, z0 + 0.035);
	part(g, barrelY(0.012, 0.004), glass, 0.05, -0.05, z0 + 0.035);
	// мушка и целик сверху
	part(g, rbox(0.006, 0.01, 0.026), steel, 0, -0.3, z0 + 0.03);
	part(g, rbox(0.016, 0.01, 0.022), steel, 0, -0.02, z0 + 0.03);
	// выстрел ПГ-7В: хвостовик в трубе, переходник, корпус, конус, взрыватель
	const round = new THREE.Group();
	round.name = 'Round';
	const stem = new THREE.Mesh(barrelY(0.017, 0.09), olive); stem.position.y = -0.385;
	const taper = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.0425, 0.05, 16), olive); taper.position.y = -0.455;
	const body = new THREE.Mesh(barrelY(0.0425, 0.13), olive); body.position.y = -0.545;
	const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.0425, 0.011, 0.18, 16), olive); nose.position.y = -0.7;
	const fuse = new THREE.Mesh(barrelY(0.009, 0.03), M(0x8a8a80, 0.35, 0.8)); fuse.position.y = -0.805;
	round.add(stem, taper, body, nose, fuse);
	round.position.z = z0;
	g.add(round);
	g.userData.round = round;
	g.userData.muzzle = new THREE.Vector3(0, -0.36, z0);
	g.userData.breech = new THREE.Vector3(0, 0.6, z0);
	setGripL(g, -0.17, 0.0);
	merged(g, [round]);
	return shrunk(g, HEAVY_SCALE, 0.02);
}

/**
 * РГ-6: ручной гранатомёт под ВОГ-25 — барабан на 6 выстрелов, короткий ствол 40 мм, пистолетная и передняя
 * рукоятки, телескопический приклад с резиновым затыльником, коллиматор сверху. userData.drum — барабан
 * (после выстрела проворачивается на шестую часть).
 */
export function makeRg6() {
	const g = new THREE.Group();
	g.name = 'RG6';
	const black = M(0x22252a, 0.5, 0.45), steel = M(0x3a3e42, 0.4, 0.7), rubber = M(0x111213, 0.85, 0), hole = M(0x050505, 0.9, 0), glass = M(0x2a4a3a, 0.1, 0.6);
	black.name = 'black'; steel.name = 'steel';
	const z0 = 0.085;
	// барабан: ось вдоль ствола, 6 каморы по кругу на переднем торце
	const drum = new THREE.Group();
	drum.name = 'Drum';
	drum.add(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.15, 18), steel));
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2;
		const c = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.004, 10), hole);
		c.position.set(Math.cos(a) * 0.044, -0.076, Math.sin(a) * 0.044);
		drum.add(c);
		const f = new THREE.Mesh(rbox(0.012, 0.13, 0.012), black); // проточки между каморами
		f.position.set(Math.cos(a + Math.PI / 6) * 0.07, 0, Math.sin(a + Math.PI / 6) * 0.07);
		drum.add(f);
	}
	drum.position.set(0, -0.085, z0);
	g.add(drum);
	g.userData.drum = drum;
	part(g, barrelY(0.03, 0.17), black, 0, -0.245, z0 + 0.03); // ствол над осью барабана
	part(g, barrelY(0.034, 0.02), steel, 0, -0.325, z0 + 0.03);
	part(g, rbox(0.05, 0.05, 0.07), black, 0, 0.0, z0 - 0.005); // рамка за барабаном
	part(g, rbox(0.03, 0.2, 0.014), black, 0, -0.08, z0 + 0.08); // верхняя планка
	part(g, rbox(0.02, 0.05, 0.04), black, 0, -0.07, z0 + 0.105); // коллиматор
	part(g, rbox(0.022, 0.004, 0.032), glass, 0, -0.096, z0 + 0.105);
	pistolGrip(g, rubber, { top: z0 - 0.04 });
	triggerGuard(g, black, { y0: -0.012, y1: -0.07, top: z0 - 0.045 });
	part(g, rbox(0.032, 0.035, 0.1), rubber, 0, -0.24, z0 - 0.06, -0.1); // передняя рукоятка
	// телескопический приклад (выдвинут): две тяги и затыльник
	for (const x of [-0.018, 0.018]) part(g, barrelY(0.007, 0.3), steel, x, 0.17, z0);
	part(g, rbox(0.05, 0.03, 0.13), rubber, 0, 0.33, z0 - 0.03);
	g.userData.muzzle = new THREE.Vector3(0, -0.335, z0 + 0.03);
	setGripL(g, -0.24, z0 - 0.07);
	merged(g, [drum]);
	return shrunk(g, HEAVY_SCALE, 0.018);
}

/**
 * КСВК 12,7: крупнокалиберная снайперская винтовка-буллпап — длинный ствол с коробчатым дульным тормозом,
 * магазин на 5 за рукоятью, затыльник с амортизатором, сошки, оптический прицел. Пуля 12,7×108 пробивает
 * заражённого насквозь и бьёт следующего за ним.
 */
export function makeKsvk() {
	const g = new THREE.Group();
	g.name = 'KSVK';
	const black = M(0x24272a, 0.5, 0.45), steel = M(0x34383c, 0.38, 0.75), rubber = M(0x121314, 0.85, 0), glass = M(0x203040, 0.1, 0.6);
	black.name = 'black'; steel.name = 'steel';
	const z0 = 0.08;
	part(g, rbox(0.064, 0.52, 0.1), black, 0, 0.2, z0); // ствольная коробка (за рукоятью — буллпап)
	part(g, rbox(0.05, 0.2, 0.04), black, 0, 0.3, z0 + 0.065); // щека
	part(g, rbox(0.07, 0.04, 0.16), rubber, 0, 0.48, z0 - 0.01); // затыльник
	part(g, rbox(0.036, 0.1, 0.14), steel, 0, 0.17, z0 - 0.1); // магазин на 5
	pistolGrip(g, rubber, { top: z0 - 0.04 });
	triggerGuard(g, black, { y0: -0.012, y1: -0.075, top: z0 - 0.045 });
	part(g, barrelY(0.03, 0.32), black, 0, -0.2, z0 + 0.005); // цевьё-кожух
	part(g, barrelY(0.017, 0.56), steel, 0, -0.6, z0 + 0.005); // ствол
	part(g, rbox(0.07, 0.13, 0.055), black, 0, -0.93, z0 + 0.005); // дульный тормоз
	for (const y of [-0.9, -0.95]) part(g, box(0.074, 0.012, 0.03), M(0x050505, 0.9, 0), 0, y, z0 + 0.005);
	// сошки, сложенные под стволом
	for (const x of [-0.02, 0.02]) part(g, rbox(0.01, 0.34, 0.01), steel, x, -0.5, z0 - 0.035);
	// прицел на кронштейне
	part(g, rbox(0.024, 0.12, 0.04), steel, 0, 0.05, z0 + 0.075);
	part(g, barrelY(0.022, 0.3), black, 0, 0.04, z0 + 0.12);
	part(g, barrelY(0.028, 0.05), black, 0, -0.13, z0 + 0.12);
	part(g, barrelY(0.026, 0.004), glass, 0, -0.156, z0 + 0.12);
	part(g, rbox(0.016, 0.1, 0.03), steel, 0, -0.25, z0 + 0.05); // ручка переноски
	g.userData.muzzle = new THREE.Vector3(0, -1.0, z0 + 0.005);
	setGripL(g, -0.24, z0 - 0.02);
	merged(g);
	return shrunk(g, HEAVY_SCALE, 0.026);
}

/**
 * Граната Ф-1 «лимонка»: яйцевидный чугунный корпус, рифлённый сеткой «долек» (8 по кругу, 5 по высоте),
 * донная пробка, запал УЗРГМ сверху — трубка, изогнутый вдоль корпуса рычаг, кольцо с чекой.
 * Начало координат — центр корпуса.
 */
export function makeGrenade() {
	const g = new THREE.Group();
	g.name = 'Grenade';
	const olive = M(0x4a5634, 0.65, 0.25), metal = M(0x9a9c96, 0.35, 0.85), dark = M(0x2c3022, 0.7, 0.3);
	// корпус: профиль яйца, вращённый вокруг оси; дольки — вмятины по меридианам и параллелям
	const prof = [];
	for (let i = 0; i <= 16; i++) {
		const t = i / 16, a = -Math.PI / 2 + t * Math.PI;
		prof.push(new THREE.Vector2(Math.max(0.004, Math.cos(a) * 0.028 * (1 - 0.12 * t)), Math.sin(a) * 0.036));
	}
	const body = mergeVertices(new THREE.LatheGeometry(prof, 32).deleteAttribute('normal').deleteAttribute('uv'));
	const p = body.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
		if (r < 0.006) continue;
		const ang = Math.atan2(z, x), h = (y / 0.036 + 1) / 2; // 0 — низ, 1 — верх
		const groove = Math.max(Math.pow(Math.abs(Math.cos(ang * 4)), 18), Math.pow(Math.abs(Math.cos(h * Math.PI * 5)), 18) * (h > 0.08 && h < 0.92 ? 1 : 0));
		const k = 1 - 0.13 * groove;
		p.setXYZ(i, x * k, y, z * k);
	}
	body.computeVertexNormals();
	g.add(new THREE.Mesh(body, olive));
	part(g, new THREE.CylinderGeometry(0.008, 0.009, 0.005, 14), dark, 0, -0.037, 0); // донная пробка
	// запал: трубка и шляпка, рычаг вдоль корпуса, кольцо с чекой
	part(g, new THREE.CylinderGeometry(0.0085, 0.0095, 0.016, 14), metal, 0, 0.043, 0);
	part(g, new THREE.CylinderGeometry(0.011, 0.011, 0.004, 14), metal, 0, 0.051, 0);
	const lever = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
		new THREE.Vector3(0.006, 0.052, 0), new THREE.Vector3(0.016, 0.048, 0), new THREE.Vector3(0.026, 0.03, 0), new THREE.Vector3(0.03, 0.006, 0),
	]), 10, 0.0026, 6), metal);
	lever.scale.set(1, 1, 2.2); // плоская лента, а не пруток
	g.add(lever);
	const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0016, 6, 18), metal);
	ring.position.set(-0.017, 0.047, 0.004);
	ring.rotation.set(0.3, 0.6, 0);
	g.add(ring);
	part(g, new THREE.CylinderGeometry(0.0012, 0.0012, 0.02, 6), metal, -0.006, 0.046, 0, Math.PI / 2).rotation.z = Math.PI / 2; // чека
	return shadow(g);
}

/** Узлы креплений оружия на теле героя (см. heroMounts в профиле). */
export const MOUNTS = { axe: 'AxeMount', holster: 'HolsterMount', back: 'BackMount' };

/** Клипы героя под тип оружия в руках. */
export const CLIPS = {
	axe: { idle: 'Idle', walk: 'Walk', run: 'Run', hit: 'Hit', attack: 'Melee' },
	pistol: { idle: 'IdlePistol', walk: 'WalkPistol', run: 'RunPistol', hit: 'HitPistol', aim: 'AimPistol', shoot: 'Shoot', reload: 'Reload' },
	rifle: { idle: 'IdleRifle', walk: 'WalkRifle', run: 'RunRifle', hit: 'HitRifle', aim: 'AimRifle', shoot: 'ShootRifle', reload: 'ReloadRifle' },
};

/** Смена оружия: draw — топор → ствол, stow — ствол → топор (по типу ствола). */
export const EQUIP = {
	pistol: { draw: 'EquipPistol', stow: 'EquipAxe' },
	rifle: { draw: 'EquipRifle', stow: 'EquipAxeR' },
};

/** Калибры: id патронов → подпись. */
export const AMMO = { ammo919: '9×19', ammo50: '.50 AE', ammo12: '12 кал.', ammo545: '5,45×39', ammo556: '5,56×45', ammo762: '7,62×39', ammo76251: '7,62×51', ammo76254: '7,62×54R', ammo127: '12,7×108', vog25: 'ВОГ-25', rocket: 'ПГ-7В' };

/**
 * Убранное оружие и патроны → чем они становятся в старых сохранениях (в игре — только новые стволы из Tripo:
 * просьба пользователя «оружие используем новое»; простого топора нет — только пожарный).
 */
export const REMOVED = {
	axe: 'fireaxe', pistol: 'glock17', pm63: 'glock17', vector: 'mp5', obrez: 'dbarrel', shotgun: 'spas12', scar: 'fnfal',
	vss: 'svd', pkm: 'rpk', pkt: 'rpk', ammo9: 'ammo919', ammo939: 'ammo545',
};
/** Настоящий id (у убранного — новый). */
export const realId = (id) => REMOVED[id] ?? id;

// модель Tripo, посаженная по старой процедурной заготовке (game/tripo-weapons.js), а если её нет — сама заготовка
const tripo = (id, old) => () => makeTripo(id, old) ?? old();

/**
 * Каталог. slot — ближний бой (melee) или огнестрел (gun); anim — набор анимаций героя (axe, pistol, rifle); mount — где
 * висит, когда не в руках. Ствол: damage — урон пули (дробины), range — дальность, cooldown/auto — темп одиночных и
 * серии, kick — встряска камеры, spread — разброс очереди (точность падает с дальностью и длиной очереди), casing — что
 * вылетает при выстреле/перезарядке (eject: 'shot' — гильза дробовика при каждом выстреле), falloff — насколько падает
 * точность к пределу дальности (по умолчанию 0.35, у снайперских — почти нет), flash — размер дульной вспышки.
 * Модели — из Tripo (лист 16 стволов пользователя, docs/tripo/refs/weapons); ПКТ — только для техники, в руки не берётся.
 */
export const WEAPONS = {
	// durability — сколько ударов по заражённым выдержит, потом ломается
	fireaxe: { name: 'Пожарный топор', slot: 'melee', anim: 'axe', mount: 'axe', damage: 70, range: 2.4, arc: 1.25, cooldown: 1.0, hitTime: 0.36, speed: 0.92, noise: 7, durability: 90, price: 18, make: tripo('fireaxe', () => makeAxe({ fire: true })), desc: 'Тяжёлый топор с клювом: валит бегуна с удара, тихий. Тупится — выдерживает 90 ударов.' },
	// когда топор сломался и запасного нет
	fists: { name: 'Кулаки', slot: 'melee', anim: 'axe', mount: null, damage: 12, range: 1.5, arc: 1.0, cooldown: 0.6, hitTime: 0.28, speed: 1.2, noise: 3, make: () => Object.assign(new THREE.Group(), { name: 'Fists' }), desc: 'Топора нет — остаются кулаки. Бегуна так не забить: купи топор у торговца в стабе или найди в домах.' },
	glock17: { name: 'Glock 17', slot: 'gun', anim: 'pistol', mount: 'holster', ammo: 'ammo919', damage: 24, range: 6.5, cooldown: 0.12, auto: 0.2, mag: 17, reload: 1.4, noise: 26, kick: 0.07, flash: 0.8, spread: 0.03, casing: 'brass', price: 60, make: tripo('glock17', makePistol), desc: 'Пистолет 9×19: лёгкий, магазин на 17 патронов. Выстрел слышно издалека.' },
	deagle: { name: 'Desert Eagle', slot: 'gun', anim: 'pistol', mount: 'holster', ammo: 'ammo50', damage: 55, range: 7, cooldown: 0.4, auto: 0.5, mag: 7, reload: 1.6, noise: 34, kick: 0.16, flash: 1.2, spread: 0.04, casing: 'brass', price: 140, make: tripo('deagle', makePistol), desc: 'Тяжёлый пистолет .50 AE: валит с пары выстрелов, сильно подбрасывает. Магазин на 7.' },
	dbarrel: { name: 'Двустволка', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo12', damage: 17, pellets: 9, spread: 0.26, range: 5, cooldown: 0.35, auto: 0.6, mag: 2, reload: 2.2, noise: 36, kick: 0.32, flash: 1.6, casing: 'shell', price: 50, make: tripo('dbarrel', makeShotgun), desc: 'Охотничья двустволка 12 калибра: два быстрых выстрела картечью, потом долгая перезарядка.' },
	spas12: { name: 'SPAS-12', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo12', damage: 15, pellets: 9, spread: 0.22, range: 5, cooldown: 0.45, auto: 0.5, mag: 8, reload: 3.4, noise: 36, kick: 0.3, flash: 1.4, casing: 'shell', eject: 'shot', price: 200, make: tripo('spas12', makeSpas12), desc: 'Боевой дробовик 12 калибра: картечь веером, полуавтомат, восемь патронов в трубке.' },
	mp5: { name: 'HK MP5', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo919', damage: 20, range: 6.5, cooldown: 0.07, auto: 0.07, mag: 30, reload: 1.9, noise: 24, kick: 0.04, flash: 0.6, spread: 0.045, casing: 'brass', price: 110, make: tripo('mp5', makeVector), desc: 'Пистолет-пулемёт 9×19: быстрый огонь, почти без отдачи, тихий. Магазин пустеет за пару секунд.' },
	aks: { name: 'АКС-74У', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo545', damage: 30, range: 7, cooldown: 0.1, auto: 0.1, mag: 30, reload: 2.2, noise: 34, kick: 0.09, flash: 1.25, spread: 0.05, casing: 'brass', price: 80, make: tripo('aks', makeAks), desc: 'Укороченный автомат: 30 патронов 5,45×39, очередь при зажатой кнопке. Шумит на весь кластер.' },
	ak74: { name: 'АК-74', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo545', damage: 32, range: 8, cooldown: 0.1, auto: 0.1, mag: 30, reload: 2.3, noise: 36, kick: 0.09, flash: 0.9, spread: 0.035, casing: 'brass', price: 110, make: tripo('ak74', makeAk74), desc: 'Полноразмерный автомат 5,45×39: точнее и дальше, чем укороченный.' },
	ak47: { name: 'АК-47', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo762', damage: 42, range: 7.5, cooldown: 0.11, auto: 0.11, mag: 30, reload: 2.4, noise: 38, kick: 0.13, flash: 1.05, spread: 0.05, casing: 'brass', price: 120, make: tripo('ak47', makeAk47), desc: 'Калашников под 7,62×39: пуля тяжелее — бегун падает с одного-двух попаданий, но сильно уводит в очереди.' },
	ak107: { name: 'АК-107', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo545', damage: 33, range: 8.5, cooldown: 0.09, auto: 0.09, mag: 30, reload: 2.3, noise: 36, kick: 0.07, flash: 0.9, spread: 0.025, casing: 'brass', price: 180, make: tripo('ak107', makeAk74), desc: 'Автомат 5,45×39 со сбалансированной автоматикой: почти не уводит в очереди.' },
	g36: { name: 'HK G36', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo556', damage: 30, range: 8.5, cooldown: 0.085, auto: 0.085, mag: 30, reload: 2.3, noise: 34, kick: 0.07, flash: 0.9, spread: 0.03, casing: 'brass', price: 210, make: tripo('g36', makeScar), desc: 'Автомат 5,56×45 с ручкой-прицелом: лёгкий и точный.' },
	aug: { name: 'Steyr AUG', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo556', damage: 32, range: 8.5, cooldown: 0.09, auto: 0.09, mag: 30, reload: 2.6, noise: 34, kick: 0.08, flash: 0.9, spread: 0.03, casing: 'brass', price: 220, make: tripo('aug', makeAug), desc: 'Автомат-буллпап 5,56×45: короткий, точный, магазин за рукоятью.' },
	fnfal: { name: 'FN FAL', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo76251', damage: 46, range: 9, cooldown: 0.13, auto: 0.13, mag: 20, reload: 2.6, noise: 40, kick: 0.14, flash: 1.1, spread: 0.05, casing: 'brass', price: 240, make: tripo('fnfal', makeFal), desc: 'Боевая винтовка 7,62×51 с деревянным прикладом: бьёт сильно, уводит в очереди. Магазин на 20.' },
	rpk: { name: 'РПК', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo762', damage: 36, range: 9, cooldown: 0.1, auto: 0.1, mag: 75, reload: 4.0, noise: 42, kick: 0.11, flash: 1.1, spread: 0.05, casing: 'brass', price: 200, make: tripo('rpk', makeAk47), desc: 'Ручной пулемёт Калашникова 7,62×39: длинный ствол, сошки, барабан на 75 — держит толпу длинными очередями.' },
	svd: { name: 'СВД', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo76254', damage: 130, range: 18, falloff: 0.08, cooldown: 0.95, auto: 1.0, mag: 10, reload: 2.6, noise: 44, kick: 0.25, flash: 1.15, spread: 0, casing: 'brass', price: 160, make: tripo('svd', makeSvd), desc: 'Снайперская винтовка Драгунова, 7,62×54R: бьёт далеко и точно, заражённый падает с одного выстрела. Стреляет редко.' },
	awm: { name: 'Arctic Warfare', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo76251', damage: 160, range: 20, falloff: 0.06, cooldown: 1.3, auto: 1.4, mag: 5, reload: 2.8, noise: 46, kick: 0.28, flash: 1.2, spread: 0, casing: 'brass', price: 300, make: tripo('awm', makeSvd), desc: 'Снайперская винтовка 7,62×51 с продольно-скользящим затвором: самый дальний и сильный выстрел, после каждого — передёрнуть затвор.' },
	// тяжёлое оружие (2026-11-04): proj — снаряд летит видимо (rocket — прямо, lob — навесом) и рвётся (blast: радиус,
	// урон заражённым, урон своим), arm — через сколько метров полёта взводится (ближе — не взорвётся, только ударит);
	// pierce — сколько целей подряд пробивает пуля, ap — бронебойная (костяная броня рубера и бронежилеты почти не держат)
	rpg7: { name: 'РПГ-7', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'rocket', proj: 'rocket', speed: 34, arm: 4, blast: { r: 5, dmg: 280, hurt: 75 }, damage: 220, range: 22, falloff: 0.05, cooldown: 1.0, auto: 1.2, mag: 1, reload: 3.2, noise: 55, kick: 0.4, flash: 2.4, spread: 0.03, price: 650, heavy: true, make: makeRpg7, desc: 'Ручной противотанковый гранатомёт. Граната ПГ-7В летит прямо и рвётся у первой цели: рубер — с одного-двух попаданий, толпа — разом. Взводится через 4 м полёта. Сзади бьёт струя газов, перезарядка долгая.' },
	rg6: { name: 'РГ-6', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'vog25', proj: 'lob', speed: 20, arm: 3, blast: { r: 3.5, dmg: 125, hurt: 45 }, damage: 40, range: 17, falloff: 0.05, cooldown: 0.55, auto: 0.6, mag: 6, reload: 4.6, noise: 40, kick: 0.22, flash: 1.0, spread: 0.08, price: 480, heavy: true, make: makeRg6, desc: 'Револьверный гранатомёт: барабан на 6 ВОГ-25, гранаты летят навесом и рвутся у цели — разрыв 3,5 м. Шесть выстрелов подряд, потом долго набивать барабан.' },
	ksvk: { name: 'КСВК 12,7', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo127', damage: 240, pierce: 3, ap: true, range: 21, falloff: 0.04, cooldown: 1.5, auto: 1.6, mag: 5, reload: 3.4, noise: 52, kick: 0.42, flash: 1.7, spread: 0, casing: 'brass', price: 560, heavy: true, make: makeKsvk, desc: 'Крупнокалиберная снайперская винтовка 12,7×108: пуля прошивает заражённого насквозь и бьёт ещё двоих за ним, костяная броня и бронежилеты её почти не держат. Пять патронов, тяжёлая отдача.' },
};

/** Пистолет Макарова: рукоять через кулак, ствол над большим пальцем смотрит по направлению пальцев. */
export function makePistol() {
	const g = new THREE.Group();
	g.name = 'Pistol';
	const metal = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.4, metalness: 0.75 });
	const grip = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.65 });
	// рукоять чуть наклонена назад, как у ПМ
	const handle = new THREE.Mesh(rbox(0.026, 0.032, 0.085), grip);
	handle.position.set(0, 0.004, 0.006);
	handle.rotation.x = -0.18;
	const frame = new THREE.Mesh(rbox(0.024, 0.13, 0.022), metal);
	frame.position.set(0, -0.035, 0.052);
	const slide = new THREE.Mesh(rbox(0.027, 0.16, 0.026), metal);
	slide.position.set(0, -0.045, 0.074);
	const guard = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), metal);
	guard.rotation.y = Math.PI / 2;
	guard.position.set(0, -0.03, 0.04);
	const mag = new THREE.Mesh(rbox(0.022, 0.026, 0.012), metal);
	mag.position.set(0, 0.008, -0.052);
	g.add(handle, frame, slide, guard, mag);
	g.userData.action = { part: slide, travel: 0.028, dur: 0.07 }; // затвор откатывается назад, на последнем патроне встаёт на задержку
	g.userData.muzzle = new THREE.Vector3(0, -0.128, 0.074);
	return shadow(g);
}
