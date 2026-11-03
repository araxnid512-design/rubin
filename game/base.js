// База «Опорный» — постоянный кластер героя (NODES.base, kind 'base'): не перезагружается. Посреди площадки —
// терминал: в нём покупаются постройки (BUILDINGS, 20 штук) — с описанием и ценой; купленная сразу встаёт на своё
// место (локация game/locations/base.js строит купленное, на месте некупленного — фундамент с табличкой).
// Каждая постройка что-то даёт: оборону (стена, ворота, вышки, казарма, генератор, пулемётное гнездо), лавку
// оружейника (патроны и оружие дешевле), хранилище, лечение, доход (теплица, споровая ферма, мастерская, медпункт —
// копят добро, его забирают у терминала), быструю дорогу (гараж), сведения о мурах (радиовышка), возрождение на базе
// (бункер), урон огнестрела (тир), запас здоровья (столовая), места в отряде (казарма).
// Пока героя нет, на базу нападают заражённые: оборона не меньше силы нападения — отбились, иначе накопленное
// пропало. Здесь — данные и учёт; постройки на месте — locations/base.js, терминал и эффекты — game/main.js.

/**
 * Постройки: id → { name, price, desc (что это), gives (что даёт — коротко), def (оборона), needs (что построить
 * раньше), make (доход: { kind, every — раз во сколько секунд мира, n, max — сколько копится самое большее }),
 * up — улучшения до 2-го и 3-го уровня: [{ price, gives, def (прибавка к обороне), make (новый доход) }, …] }.
 * Порядок — порядок в терминале.
 */
export const BUILDINGS = {
	wall: { name: 'Стена', price: 600, def: 40, desc: 'Бетонный забор с колючкой по всему периметру базы.', gives: '+40 к обороне; заражённые идут только через ворота' , up: [{ price: 900, def: 30, gives: '+30 к обороне (всего 70): колючая спираль поверх забора' }, { price: 1400, def: 30, gives: '+30 к обороне (всего 100): бетонные блоки и прожекторы вдоль стены' }] },
	gate: { name: 'Ворота и КПП', price: 200, def: 10, needs: ['wall'], desc: 'Будка КПП и шлагбаум у южных ворот, при них охранник.', gives: '+10 к обороне, охранник у ворот' , up: [{ price: 300, def: 10, gives: '+10 к обороне (всего 20): второй охранник у ворот' }, { price: 500, def: 15, gives: '+15 к обороне (всего 35): у ворот пулемётчик за мешками' }] },
	towerNW: { name: 'Вышка (северо-запад)', price: 300, def: 15, desc: 'Сторожевая вышка в углу базы. На ней часовой со СВД.', gives: '+15 к обороне; часовой бьёт заражённых у базы' , up: [{ price: 450, def: 10, gives: '+10 к обороне (всего 25): прожектор, часовой бьёт дальше — 27 м' }, { price: 700, def: 15, gives: '+15 к обороне (всего 40): на вышке второй часовой — с РПК' }] },
	towerNE: { name: 'Вышка (северо-восток)', price: 300, def: 15, desc: 'Сторожевая вышка в углу базы. На ней часовой со СВД.', gives: '+15 к обороне; часовой бьёт заражённых у базы' , up: [{ price: 450, def: 10, gives: '+10 к обороне (всего 25): прожектор, часовой бьёт дальше — 27 м' }, { price: 700, def: 15, gives: '+15 к обороне (всего 40): на вышке второй часовой — с РПК' }] },
	towerSW: { name: 'Вышка (юго-запад)', price: 300, def: 15, desc: 'Сторожевая вышка в углу базы. На ней часовой со СВД.', gives: '+15 к обороне; часовой бьёт заражённых у базы' , up: [{ price: 450, def: 10, gives: '+10 к обороне (всего 25): прожектор, часовой бьёт дальше — 27 м' }, { price: 700, def: 15, gives: '+15 к обороне (всего 40): на вышке второй часовой — с РПК' }] },
	towerSE: { name: 'Вышка (юго-восток)', price: 300, def: 15, desc: 'Сторожевая вышка в углу базы. На ней часовой со СВД.', gives: '+15 к обороне; часовой бьёт заражённых у базы' , up: [{ price: 450, def: 10, gives: '+10 к обороне (всего 25): прожектор, часовой бьёт дальше — 27 м' }, { price: 700, def: 15, gives: '+15 к обороне (всего 40): на вышке второй часовой — с РПК' }] },
	barracks: { name: 'Казарма', price: 500, def: 15, desc: 'Длинная казарма с койками для бойцов.', gives: '+15 к обороне; в отряде на вылазку — до 6 наёмников (вместо 4)' , up: [{ price: 700, def: 10, gives: '+10 к обороне (всего 25): наёмник на посту базы держит оборону лучше (+15 вместо +10)' }, { price: 1000, def: 15, gives: '+15 к обороне (всего 40): наёмники с вылазок приносят на треть больше и реже гибнут' }] },
	armory: { name: 'Оружейная', price: 450, desc: 'Мастерская оружейника. Сам оружейник — за прилавком.', gives: 'оружейник продаёт патроны и оружие на 20 % дешевле торговца' , up: [{ price: 650, gives: 'оружейник продаёт на 30 % дешевле торговца' }, { price: 900, gives: 'оружейник продаёт на 40 % дешевле торговца' }] },
	warehouse: { name: 'Склад', price: 350, desc: 'Склад с полками и шкафами.', gives: 'хранилище на базе — то же, что в твоей комнате в «Полисе»' , up: [{ price: 500, gives: 'на склад свозят патроны: 15 шт. 5,45×39 раз в 15 минут (до 90)', make: { kind: 'ammo545', every: 900, n: 15, max: 90 } }, { price: 800, gives: 'патронов больше: 30 шт. 5,45×39 раз в 15 минут (до 180)', make: { kind: 'ammo545', every: 900, n: 30, max: 180 } }] },
	medbay: { name: 'Медпункт', price: 400, desc: 'Медпункт с койками и аптечками.', gives: 'лечение до полного здоровья бесплатно; живчик раз в 20 минут', make: { kind: 'zhivchik', every: 1200, n: 1, max: 3 } , up: [{ price: 550, gives: 'живчик раз в 12 минут (до 5)', make: { kind: 'zhivchik', every: 720, n: 1, max: 5 } }, { price: 800, gives: 'живчик раз в 7 минут (до 8)', make: { kind: 'zhivchik', every: 420, n: 1, max: 8 } }] },
	kitchen: { name: 'Столовая', price: 250, desc: 'Столовая с кухней: горячая еда для всех на базе.', gives: '+15 к наибольшему здоровью' , up: [{ price: 400, gives: '+25 к наибольшему здоровью; повар кормит на +45' }, { price: 650, gives: '+35 к наибольшему здоровью; повар кормит досыта — до полного' }] },
	generator: { name: 'Генератор', price: 300, def: 10, desc: 'Дизель-генератор и трансформатор: свет и прожекторы.', gives: '+10 к обороне; нужен для мастерской, радиовышки и споровой фермы' , up: [{ price: 450, def: 5, gives: '+5 к обороне (всего 15): прожекторы по всей базе' }, { price: 650, def: 10, gives: '+10 к обороне (всего 25): второй генератор про запас' }] },
	workshop: { name: 'Мастерская', price: 400, needs: ['generator'], desc: 'Верстаки и станок: здесь чинят и собирают.', gives: 'граната раз в 15 минут; топор чинится бесплатно', make: { kind: 'grenade', every: 900, n: 1, max: 4 } , up: [{ price: 600, gives: 'граната раз в 10 минут (до 6)', make: { kind: 'grenade', every: 600, n: 1, max: 6 } }, { price: 900, gives: 'граната раз в 6 минут (до 8)', make: { kind: 'grenade', every: 360, n: 1, max: 8 } }] },
	garage: { name: 'Гараж', price: 450, desc: 'Гараж с УАЗом на ходу.', gives: 'дорога по карте Улья на 30 % быстрее' , up: [{ price: 650, gives: 'дорога по карте Улья на 40 % быстрее' }, { price: 900, gives: 'дорога по карте Улья на 50 % быстрее' }] },
	radio: { name: 'Радиовышка', price: 300, needs: ['generator'], desc: 'Мачта с антеннами и радиостанция.', gives: 'где отряд муров — видно на карте Улья без информатора' , up: [{ price: 450, gives: 'слышно и внешников: где их охота — видно на карте Улья' }, { price: 700, def: 15, gives: '+15 к обороне: радист заранее слышит нападения на базу' }] },
	greenhouse: { name: 'Теплица', price: 200, desc: 'Теплица со споровым горохом.', gives: 'горошина раз в 15 минут', make: { kind: 'peas', every: 900, n: 1, max: 8 } , up: [{ price: 300, gives: 'горошина раз в 10 минут (до 12)', make: { kind: 'peas', every: 600, n: 1, max: 12 } }, { price: 500, gives: 'горошина раз в 6 минут (до 16)', make: { kind: 'peas', every: 360, n: 1, max: 16 } }] },
	sporefarm: { name: 'Споровая ферма', price: 650, needs: ['generator'], desc: 'Чаны с грибницей под лампами.', gives: '8 споранов раз в 10 минут', make: { kind: 'spore', every: 600, n: 8, max: 80 } , up: [{ price: 900, gives: '12 споранов раз в 10 минут (до 120)', make: { kind: 'spore', every: 600, n: 12, max: 120 } }, { price: 1300, gives: '18 споранов раз в 10 минут (до 160)', make: { kind: 'spore', every: 600, n: 18, max: 160 } }] },
	bunker: { name: 'Бункер', price: 600, desc: 'Бетонный бункер с запасом снаряжения.', gives: 'после гибели возрождаешься на базе, а не в «Полисе»' , up: [{ price: 800, gives: 'очнёшься с полным здоровьем, в бункере — тревожный набор: Glock 17, 34 патрона, живчик' }, { price: 1200, gives: 'оружие, что было в руках, остаётся с тобой после гибели' }] },
	range: { name: 'Тир', price: 250, desc: 'Стрельбище с мишенями: тренировка каждый день.', gives: '+10 % к урону огнестрела' , up: [{ price: 400, gives: '+15 % к урону огнестрела' }, { price: 650, gives: '+20 % к урону огнестрела' }] },
	mgnest: { name: 'Пулемётное гнездо', price: 350, def: 25, desc: 'Гнездо из мешков у ворот с пулемётом на станке.', gives: '+25 к обороне; пулемётчик бьёт заражённых у ворот' , up: [{ price: 500, def: 15, gives: '+15 к обороне (всего 40): второй пулемётчик' }, { price: 750, def: 20, gives: '+20 к обороне (всего 60): пулемётчики бьют дальше — 15 м' }] },
};
export const BUILD_IDS = Object.keys(BUILDINGS);

/** Нападения на базу, пока героя нет: перерыв, с, и сила (растёт с каждым нападением, до ATTACK_MAX). */
export const ATTACK_GAP = [1200, 2100];
export const ATTACK_POWER = [30, 140];
export const ATTACK_GROW = 5;
export const ATTACK_MAX = 320;

const rand = (a, b) => a + Math.random() * (b - a);

/** База в новом мире: ничего не построено. */
export function newBase(time = 0) {
	return { built: [], lv: {}, stock: {}, made: {}, nextAttack: time + rand(...ATTACK_GAP), attacks: 0, log: [], guards: [], trips: [] };
}

/** Из старого сохранения — база как в новом мире; неизвестные постройки — вон. */
export function normalizeBase(b, time) {
	if (!b || typeof b !== 'object') return newBase(time);
	b.built = (b.built ?? []).filter((id) => BUILDINGS[id]);
	b.lv ??= {};
	if (!Array.isArray(b.guards)) b.guards = []; // наёмники на постах: [{ id, gun, tint }] (game/main.js)
	b.trips ??= []; // последние вылазки наёмников: [{ text, time }]
	b.stock ??= {};
	b.made ??= {};
	b.nextAttack ??= time + rand(...ATTACK_GAP);
	b.attacks ??= 0;
	b.log ??= [];
	return b;
}

export const has = (b, id) => !!b?.built.includes(id);
/** Уровень постройки: 0 — не построена, 1 — построена, 2–3 — улучшена. */
export const level = (b, id) => (has(b, id) ? b.lv?.[id] ?? 1 : 0);
export const MAX_LEVEL = 3;
/** Наёмник на посту базы (game/mercs.js): столько прибавляет к обороне; с казармой 2-го уровня — больше. */
export const GUARD_DEF = 10, GUARD_DEF_UP = 15;

/** Оборона базы: def построенного с улучшениями и наёмники на постах. */
export function defense(b) {
	const own = b.built.reduce((s, id) => {
		const B = BUILDINGS[id], lv = level(b, id);
		return s + (B.def ?? 0) + (B.up ?? []).slice(0, lv - 1).reduce((a, u) => a + (u.def ?? 0), 0);
	}, 0);
	return own + (b.guards?.length ?? 0) * (level(b, 'barracks') >= 2 ? GUARD_DEF_UP : GUARD_DEF);
}

/** Доход постройки на её уровне (улучшение может дать доход, которого не было, — склад). */
export function makeOf(b, id) {
	const B = BUILDINGS[id], lv = level(b, id);
	let m = B.make ?? null;
	for (const u of (B.up ?? []).slice(0, lv - 1)) if (u.make) m = u.make;
	return m;
}

/** Что даёт постройка сейчас (на её уровне) — для терминала. */
export function givesNow(b, id) {
	const B = BUILDINGS[id], lv = level(b, id);
	return lv >= 2 ? B.up[lv - 2].gives : B.gives;
}

/** Можно ли улучшить: построено, не наибольший уровень, хватает споранов. Возвращает причину или null. */
export function cantUpgrade(b, id, spores) {
	const B = BUILDINGS[id], lv = level(b, id);
	if (!B) return 'нет такой постройки';
	if (!lv) return 'сначала построй';
	if (lv >= MAX_LEVEL || !B.up?.[lv - 1]) return 'наибольший уровень';
	if (spores < B.up[lv - 1].price) return 'не хватает споранов';
	return null;
}

/** Улучшить на уровень (споран списывает вызывающий). Новый доход считается с этого момента. */
export function upgrade(b, id, time) {
	const lv = level(b, id);
	if (!lv || lv >= MAX_LEVEL) return false;
	b.lv[id] = lv + 1;
	if (makeOf(b, id) && b.made[id] == null) b.made[id] = time;
	return true;
}

/** Можно ли купить: не построено, нужное построено, хватает споранов. Возвращает причину или null. */
export function cantBuy(b, id, spores) {
	const B = BUILDINGS[id];
	if (!B) return 'нет такой постройки';
	if (has(b, id)) return 'уже построено';
	const miss = (B.needs ?? []).filter((n) => !has(b, n));
	if (miss.length) return `сначала: ${miss.map((n) => BUILDINGS[n].name).join(', ')}`;
	if (spores < B.price) return 'не хватает споранов';
	return null;
}

/** Построить (споран списывает вызывающий). Доход новой постройки считается с этого момента. */
export function build(b, id, time) {
	if (has(b, id)) return false;
	b.built.push(id);
	if (BUILDINGS[id].make) b.made[id] = time;
	return true;
}

/**
 * Время мира дошло до now: постройки с доходом копят добро (до своего max), нападения на базу — когда героя там
 * нет (here — на базе ли герой). Возвращает события: { made: { kind: n } } / { attack: { power, def, held, lost } }.
 */
export function tickBase(b, now, here) {
	const events = [], made = {};
	for (const id of b.built) {
		const m = makeOf(b, id);
		if (!m) continue;
		b.made[id] ??= now;
		while (now - b.made[id] >= m.every) {
			b.made[id] += m.every;
			const have = b.stock[m.kind] ?? 0;
			const add = Math.max(0, Math.min(m.n, m.max - have));
			if (add > 0) { b.stock[m.kind] = have + add; made[m.kind] = (made[m.kind] ?? 0) + add; }
		}
	}
	if (Object.keys(made).length) events.push({ made });
	while (now >= b.nextAttack) {
		b.nextAttack += rand(...ATTACK_GAP);
		if (here) continue; // герой на базе — нападение отложено (сам и отобьёшься)
		const power = Math.round(Math.min(ATTACK_MAX, rand(...ATTACK_POWER) + b.attacks * ATTACK_GROW));
		const def = defense(b), held = def >= power;
		b.attacks++;
		const lost = held ? {} : { ...b.stock };
		if (!held) b.stock = {};
		const ev = { power, def, held, lost, time: now };
		b.log.unshift(ev);
		b.log.length = Math.min(b.log.length, 5);
		events.push({ attack: ev });
	}
	return events;
}

/** Забрать накопленное (всё). Возвращает { kind: n }. */
export function collect(b) {
	const got = { ...b.stock };
	b.stock = {};
	return got;
}

/**
 * Что дают постройки герою (main.js применяет): наибольшее здоровье, урон огнестрела, места в отряде, дорога,
 * скидка оружейника, возрождение на базе, сведения о мурах, бесплатный ремонт топора.
 */
export function perks(b) {
	const L = (id) => level(b, id), by = (id, list, none) => (L(id) ? list[L(id) - 1] : none);
	return {
		maxHp: by('kitchen', [15, 25, 35], 0),
		meal: by('kitchen', [30, 45, Infinity], 0), // сколько здоровья даёт повар
		gunDamage: by('range', [1.1, 1.15, 1.2], 1),
		party: L('barracks') ? 2 : 0,
		tripBonus: L('barracks') >= 3, // наёмники с вылазок — больше добычи, реже гибнут
		travel: by('garage', [0.7, 0.6, 0.5], 1),
		discount: by('armory', [0.8, 0.7, 0.6], 1),
		respawnAtBase: L('bunker') > 0,
		respawnKit: L('bunker') >= 2, // полное здоровье и тревожный набор
		keepGun: L('bunker') >= 3, // оружие в руках не пропадает
		radio: L('radio') > 0,
		radioExt: L('radio') >= 2, // слышно и внешников
		repair: L('workshop') > 0,
		heal: L('medbay') > 0,
		stash: L('warehouse') > 0,
	};
}
