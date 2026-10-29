// Оружие в системе координат хвата (узлы GripR/GripL в модели игрока):
// начало — центр кулака, +Z — в сторону большого пальца (вдоль топорища/рукояти),
// −Y — от запястья к пальцам (куда смотрит лезвие и ствол).

import * as THREE from 'three';

const shadow = (g) => { g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; };

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
	const head = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.07), steel);
	head.position.set(0, 0.005, L - 0.12);
	// клин лезвия, расширяется к режущей кромке (по −Y)
	const blade = new THREE.Shape();
	blade.moveTo(-0.035, 0); blade.lineTo(0.035, 0); blade.lineTo(0.06, -0.13); blade.lineTo(-0.055, -0.13); blade.closePath();
	const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
	bladeGeo.translate(0, -0.025, -0.006);
	bladeGeo.rotateY(Math.PI / 2);
	const bladeMesh = new THREE.Mesh(bladeGeo, steel);
	bladeMesh.position.set(0, 0, L - 0.12);
	const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.118), edgeMat);
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
const barrelY = (r, len) => new THREE.CylinderGeometry(r, r, len, 10); // цилиндр вдоль Y — как ствол

/** Обрез ИЖ-43: два ствола 12 калибра бок о бок, укороченный приклад-рукоять в кулаке. */
export function makeObrez() {
	const g = new THREE.Group();
	g.name = 'Obrez';
	const metal = M(0x26282a, 0.35, 0.8), wood = M(0x6a4024, 0.6);
	part(g, new THREE.BoxGeometry(0.034, 0.05, 0.13), wood, 0, 0.02, 0.0, -0.25); // рукоять в кулаке
	part(g, new THREE.BoxGeometry(0.05, 0.085, 0.06), metal, 0, -0.03, 0.062); // колодка
	for (const x of [-0.019, 0.019]) part(g, barrelY(0.018, 0.32), metal, x, -0.23, 0.07);
	part(g, new THREE.BoxGeometry(0.05, 0.13, 0.025), wood, 0, -0.13, 0.042); // цевьё
	part(g, new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI), metal, 0, -0.035, 0.03).rotation.y = Math.PI / 2;
	g.userData.muzzle = new THREE.Vector3(0, -0.39, 0.07);
	return shadow(g);
}

/** АКС-74У: пистолетная рукоять в кулаке, ствольная коробка, цевьё, магазин-«рожок», откидной приклад. */
export function makeAks() {
	const g = new THREE.Group();
	g.name = 'AKS74U';
	const metal = M(0x2a2c2e, 0.4, 0.75), wood = M(0x8a4a24, 0.55), mag = M(0x7a3a20, 0.6);
	part(g, new THREE.BoxGeometry(0.03, 0.035, 0.11), M(0x3a2a20, 0.7), 0, 0.012, 0.005, -0.3); // рукоять
	part(g, new THREE.BoxGeometry(0.05, 0.3, 0.07), metal, 0, -0.08, 0.078); // ствольная коробка
	part(g, new THREE.BoxGeometry(0.045, 0.3, 0.02), metal, 0, -0.08, 0.118); // крышка
	part(g, new THREE.BoxGeometry(0.056, 0.15, 0.05), wood, 0, -0.29, 0.07); // цевьё
	part(g, barrelY(0.015, 0.12), metal, 0, -0.42, 0.088);
	part(g, barrelY(0.022, 0.07), metal, 0, -0.5, 0.088); // пламегаситель
	part(g, barrelY(0.01, 0.17), metal, 0, -0.29, 0.122); // газовая трубка
	// изогнутый магазин: два наклонных куска
	part(g, new THREE.BoxGeometry(0.026, 0.06, 0.1), mag, 0, -0.11, 0.0, 0.2);
	part(g, new THREE.BoxGeometry(0.026, 0.06, 0.09), mag, 0, -0.14, -0.085, 0.55);
	// откидной приклад (разложен): две тяги и затыльник
	for (const z of [0.06, 0.11]) part(g, new THREE.BoxGeometry(0.012, 0.27, 0.012), metal, 0, 0.2, z);
	part(g, new THREE.BoxGeometry(0.03, 0.025, 0.1), metal, 0, 0.33, 0.085);
	g.userData.muzzle = new THREE.Vector3(0, -0.54, 0.088);
	return shadow(g);
}

// ---------- Каталог ----------

/** Патроны: какие бывают и как называются. */
/** МР-133: помповый дробовик — деревянные приклад и цевьё, длинный ствол над трубчатым магазином. */
export function makeShotgun() {
	const g = new THREE.Group();
	g.name = 'Shotgun';
	const metal = M(0x2a2c2e, 0.38, 0.8), wood = M(0x7a4a26, 0.6);
	part(g, new THREE.BoxGeometry(0.034, 0.05, 0.12), wood, 0, 0.025, 0.01, -0.3); // шейка приклада в кулаке
	part(g, new THREE.BoxGeometry(0.04, 0.26, 0.075), wood, 0, 0.19, 0.055, -0.08); // приклад
	part(g, new THREE.BoxGeometry(0.045, 0.02, 0.085), M(0x1a1a1a, 0.8), 0, 0.325, 0.045); // затыльник
	part(g, new THREE.BoxGeometry(0.046, 0.2, 0.07), metal, 0, -0.06, 0.08); // ствольная коробка
	part(g, barrelY(0.012, 0.5), metal, 0, -0.39, 0.105);
	part(g, barrelY(0.011, 0.4), metal, 0, -0.34, 0.077); // магазин-труба
	part(g, new THREE.BoxGeometry(0.05, 0.14, 0.046), wood, 0, -0.29, 0.075); // цевьё-помпа
	part(g, new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI), metal, 0, -0.03, 0.04).rotation.y = Math.PI / 2;
	g.userData.muzzle = new THREE.Vector3(0, -0.64, 0.105);
	return shadow(g);
}

/** «Вектор» — угловатый пистолет-пулемёт: высокий корпус, наклонный низ, длинный магазин, складной приклад. */
export function makeVector() {
	const g = new THREE.Group();
	g.name = 'Vector';
	const black = M(0x1c1d1f, 0.55, 0.3), dark = M(0x2c2e30, 0.4, 0.6);
	part(g, new THREE.BoxGeometry(0.03, 0.035, 0.11), black, 0, 0.01, 0.005, -0.25); // рукоять
	part(g, new THREE.BoxGeometry(0.046, 0.3, 0.07), black, 0, -0.07, 0.095); // корпус
	part(g, new THREE.BoxGeometry(0.044, 0.14, 0.06), black, 0, -0.12, 0.035, 0.35); // наклонный низ
	part(g, new THREE.BoxGeometry(0.036, 0.1, 0.04), dark, 0, -0.26, 0.11); // кожух ствола
	part(g, new THREE.BoxGeometry(0.012, 0.26, 0.012), dark, 0, -0.06, 0.137); // планка сверху
	part(g, new THREE.BoxGeometry(0.024, 0.045, 0.17), dark, 0, -0.04, -0.07); // магазин
	for (const z of [0.07, 0.115]) part(g, new THREE.BoxGeometry(0.01, 0.2, 0.01), dark, 0, 0.17, z); // приклад-рамка
	part(g, new THREE.BoxGeometry(0.03, 0.02, 0.07), black, 0, 0.27, 0.09);
	g.userData.muzzle = new THREE.Vector3(0, -0.32, 0.11);
	return shadow(g);
}

/** Автомат Калашникова: ak74 — пластик «сливового» цвета, дульный тормоз; ak47 — дерево и сталь, косой компенсатор. */
function makeKalash({ name, furniture, magMat, brake, stockLen = 0.3 }) {
	const g = new THREE.Group();
	g.name = name;
	const metal = M(0x2a2c2e, 0.4, 0.75);
	part(g, new THREE.BoxGeometry(0.03, 0.035, 0.11), furniture, 0, 0.012, 0.005, -0.3); // рукоять
	part(g, new THREE.BoxGeometry(0.05, 0.3, 0.07), metal, 0, -0.08, 0.078); // ствольная коробка
	part(g, new THREE.BoxGeometry(0.045, 0.3, 0.02), metal, 0, -0.08, 0.118); // крышка
	part(g, new THREE.BoxGeometry(0.056, 0.2, 0.05), furniture, 0, -0.32, 0.07); // цевьё
	part(g, barrelY(0.01, 0.2), furniture, 0, -0.32, 0.122); // газовая трубка с накладкой
	part(g, barrelY(0.012, 0.24), metal, 0, -0.52, 0.088);
	part(g, barrelY(brake ? 0.017 : 0.014, 0.08), metal, 0, -0.66, 0.088); // тормоз / компенсатор
	part(g, new THREE.BoxGeometry(0.01, 0.015, 0.03), metal, 0, -0.6, 0.11); // мушка
	part(g, new THREE.BoxGeometry(0.026, 0.06, 0.1), magMat, 0, -0.11, 0.0, 0.2); // изогнутый магазин
	part(g, new THREE.BoxGeometry(0.026, 0.065, 0.1), magMat, 0, -0.15, -0.09, 0.6);
	part(g, new THREE.BoxGeometry(0.04, stockLen, 0.07), furniture, 0, 0.07 + stockLen / 2, 0.055, -0.12); // приклад
	part(g, new THREE.BoxGeometry(0.044, 0.02, 0.09), M(0x1a1a1a, 0.7), 0, 0.08 + stockLen, 0.04);
	g.userData.muzzle = new THREE.Vector3(0, -0.71, 0.088);
	return shadow(g);
}
export const makeAk74 = () => makeKalash({ name: 'AK74', furniture: M(0x4a2e2a, 0.6), magMat: M(0x6a3424, 0.55), brake: true });
export const makeAk47 = () => makeKalash({ name: 'AK47', furniture: M(0x8a4a24, 0.55), magMat: M(0x2e3032, 0.45, 0.6), brake: false, stockLen: 0.32 });

/** СВД: длинный ствол, деревянный приклад-«скелет», цевьё, оптический прицел ПСО, магазин на 10. */
export function makeSvd() {
	const g = new THREE.Group();
	g.name = 'SVD';
	const metal = M(0x2a2c2e, 0.4, 0.75), wood = M(0x7e4422, 0.55), glass = M(0x203040, 0.1, 0.6);
	part(g, new THREE.BoxGeometry(0.032, 0.035, 0.1), wood, 0, 0.02, 0.01, -0.3); // рукоять приклада
	part(g, new THREE.BoxGeometry(0.046, 0.28, 0.066), metal, 0, -0.06, 0.08); // ствольная коробка
	// приклад-скелет: верхняя щека, нижняя планка, затыльник
	part(g, new THREE.BoxGeometry(0.04, 0.3, 0.03), wood, 0, 0.22, 0.1);
	part(g, new THREE.BoxGeometry(0.036, 0.26, 0.022), wood, 0, 0.2, 0.0, 0.18);
	part(g, new THREE.BoxGeometry(0.042, 0.03, 0.13), wood, 0, 0.37, 0.05);
	part(g, new THREE.BoxGeometry(0.052, 0.24, 0.05), wood, 0, -0.33, 0.075); // цевьё
	part(g, barrelY(0.011, 0.42), metal, 0, -0.66, 0.088);
	part(g, barrelY(0.014, 0.07), metal, 0, -0.9, 0.088); // пламегаситель
	part(g, barrelY(0.018, 0.22), metal, 0, -0.08, 0.16); // прицел
	part(g, barrelY(0.022, 0.03), metal, 0, -0.2, 0.16);
	part(g, barrelY(0.021, 0.004), glass, 0, -0.215, 0.16);
	part(g, new THREE.BoxGeometry(0.02, 0.08, 0.035), metal, 0, -0.06, 0.125); // кронштейн
	part(g, new THREE.BoxGeometry(0.024, 0.05, 0.09), metal, 0, -0.1, -0.025, 0.12); // магазин
	g.userData.muzzle = new THREE.Vector3(0, -0.94, 0.088);
	return shadow(g);
}

/** Граната Ф-1 «лимонка»: ребристый корпус, запал с рычагом и кольцом. Начало координат — центр. */
export function makeGrenade() {
	const g = new THREE.Group();
	g.name = 'Grenade';
	const olive = M(0x4e5a36, 0.6, 0.2), metal = M(0x8a8c88, 0.35, 0.8);
	const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8).scale(1, 1.28, 1), olive);
	g.add(body);
	for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.03 * Math.sin(Math.PI * (i + 1) / 5) + 0.002, 0.003, 4, 12), olive); r.rotation.x = Math.PI / 2; r.position.y = 0.038 * Math.cos(Math.PI * (i + 1) / 5) * 1.28; g.add(r); }
	part(g, barrelY(0.009, 0.025), metal, 0, 0.047, 0);
	const lever = part(g, new THREE.BoxGeometry(0.008, 0.06, 0.004), metal, 0.012, 0.03, 0.0);
	lever.rotation.z = -0.25;
	const ring = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0018, 4, 12), metal);
	ring.position.set(-0.014, 0.058, 0);
	g.add(ring);
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

export const AMMO = { ammo9: '9×18', ammo919: '9×19', ammo12: '12 кал.', ammo545: '5,45×39', ammo762: '7,62×39', ammo76254: '7,62×54R' };

/**
 * Оружие. slot — ближний бой (melee) или огнестрел (gun); anim — набор анимаций героя (axe, pistol, rifle);
 * mount — где висит, когда не в руках. cooldown — минимальный интервал между ударами/выстрелами,
 * auto — темп серии при зажатой кнопке, pellets/spread — дробь, noise — радиус шума.
 */
/**
 * Каталог. Ствол: damage — урон пули (дробины), range — дальность, cooldown/auto — темп одиночных и серии,
 * kick — встряска камеры, spread — разброс очереди (точность падает с дальностью и длиной очереди),
 * casing — что вылетает при выстреле/перезарядке (eject: 'shot' — гильза дробовика при каждом выстреле),
 * falloff — насколько падает точность к пределу дальности (по умолчанию 0.35, у снайперки — почти нет).
 */
export const WEAPONS = {
	// durability — сколько ударов по заражённым выдержит, потом ломается
	axe: { name: 'Топор', slot: 'melee', anim: 'axe', mount: 'axe', damage: 40, range: 2.1, arc: 1.15, cooldown: 0.78, hitTime: 0.32, speed: 1.05, noise: 6, durability: 60, price: 8, make: () => makeAxe(), desc: 'Тихое оружие ближнего боя: патронов не тратит, но тупится и ломается — выдерживает 60 ударов.' },
	fireaxe: { name: 'Пожарный топор', slot: 'melee', anim: 'axe', mount: 'axe', damage: 70, range: 2.4, arc: 1.25, cooldown: 1.0, hitTime: 0.36, speed: 0.92, noise: 7, durability: 90, price: 18, make: () => makeAxe({ fire: true }), desc: 'Тяжёлый топор с клювом: валит бегуна с удара, бьёт медленнее. Прочнее обычного — 90 ударов.' },
	// когда топор сломался и запасного нет
	fists: { name: 'Кулаки', slot: 'melee', anim: 'axe', mount: null, damage: 12, range: 1.5, arc: 1.0, cooldown: 0.6, hitTime: 0.28, speed: 1.2, noise: 3, make: () => Object.assign(new THREE.Group(), { name: 'Fists' }), desc: 'Топора нет — остаются кулаки. Бегуна так не забить: купи топор у торговца в стабе или найди в домах.' },
	pistol: { name: 'ПМ', slot: 'gun', anim: 'pistol', mount: 'holster', ammo: 'ammo9', damage: 26, range: 20, cooldown: 0.13, auto: 0.22, mag: 8, reload: 1.4, noise: 26, kick: 0.07, spread: 0.03, casing: 'brass', make: makePistol, desc: 'Пистолет Макарова, магазин на 8 патронов 9×18. Выстрел слышно издалека.' },
	obrez: { name: 'Обрез ИЖ-43', slot: 'gun', anim: 'pistol', mount: 'holster', ammo: 'ammo12', damage: 16, pellets: 8, spread: 0.32, range: 10, cooldown: 0.32, auto: 0.45, mag: 2, reload: 1.9, noise: 32, kick: 0.3, casing: 'shell', price: 30, make: makeObrez, desc: 'Два ствола 12 калибра: дробь в упор разрывает бегуна, но далеко не бьёт. Перезарядка долгая.' },
	shotgun: { name: 'МР-133', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo12', damage: 15, pellets: 9, spread: 0.24, range: 13, cooldown: 0.75, auto: 0.8, mag: 6, reload: 3.2, noise: 34, kick: 0.3, casing: 'shell', eject: 'shot', price: 45, make: makeShotgun, desc: 'Помповый дробовик 12 калибра: шесть патронов, картечь дальше и кучнее, чем у обреза. Каждый выстрел — передёрнуть цевьё.' },
	vector: { name: 'Вектор', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo919', damage: 18, range: 18, cooldown: 0.075, auto: 0.075, mag: 30, reload: 1.8, noise: 24, kick: 0.04, spread: 0.045, casing: 'brass', price: 70, make: makeVector, desc: 'Пистолет-пулемёт под 9×19: очень быстрый огонь, почти без отдачи. Магазин пустеет за пару секунд.' },
	aks: { name: 'АКС-74У', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo545', damage: 30, range: 26, cooldown: 0.1, auto: 0.1, mag: 30, reload: 2.2, noise: 34, kick: 0.09, spread: 0.05, casing: 'brass', price: 80, make: makeAks, desc: 'Укороченный автомат: 30 патронов 5,45×39, очередь при зажатой кнопке. Шумит на весь кластер.' },
	ak74: { name: 'АК-74', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo545', damage: 32, range: 30, cooldown: 0.1, auto: 0.1, mag: 30, reload: 2.3, noise: 36, kick: 0.09, spread: 0.035, casing: 'brass', price: 110, make: makeAk74, desc: 'Полноразмерный автомат 5,45×39: точнее и дальше, чем укороченный.' },
	ak47: { name: 'АК-47', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo762', damage: 42, range: 30, cooldown: 0.11, auto: 0.11, mag: 30, reload: 2.4, noise: 38, kick: 0.13, spread: 0.05, casing: 'brass', price: 120, make: makeAk47, desc: 'Калашников под 7,62×39: пуля тяжелее — бегун падает с одного-двух попаданий, но сильно уводит в очереди.' },
	svd: { name: 'СВД', slot: 'gun', anim: 'rifle', mount: 'back', ammo: 'ammo76254', damage: 130, range: 42, falloff: 0.08, cooldown: 0.95, auto: 1.0, mag: 10, reload: 2.6, noise: 44, kick: 0.25, spread: 0, casing: 'brass', price: 160, make: makeSvd, desc: 'Снайперская винтовка Драгунова, 7,62×54R: бьёт далеко и точно, заражённый падает с одного выстрела. Стреляет редко.' },
};

/** Пистолет Макарова: рукоять через кулак, ствол над большим пальцем смотрит по направлению пальцев. */
export function makePistol() {
	const g = new THREE.Group();
	g.name = 'Pistol';
	const metal = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.4, metalness: 0.75 });
	const grip = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.65 });
	// рукоять чуть наклонена назад, как у ПМ
	const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.032, 0.085), grip);
	handle.position.set(0, 0.004, 0.006);
	handle.rotation.x = -0.18;
	const frame = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.13, 0.022), metal);
	frame.position.set(0, -0.035, 0.052);
	const slide = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.16, 0.026), metal);
	slide.position.set(0, -0.045, 0.074);
	const guard = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), metal);
	guard.rotation.y = Math.PI / 2;
	guard.position.set(0, -0.03, 0.04);
	const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.012), metal);
	mag.position.set(0, 0.008, -0.052);
	g.add(handle, frame, slide, guard, mag);
	g.userData.muzzle = new THREE.Vector3(0, -0.128, 0.074);
	return shadow(g);
}
