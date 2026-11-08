// Экономика базы «Опорный» (2026-11-08, просьба: «база более глобальный крафт, экономика»): ресурсы, цепочки
// переработки, жители на работе, караваны и цены по спросу, крафт на верстаке, машина из гаража.
//
// Ресурсы (items.js, RESOURCES): металлолом, детали, порох, химия, бензин, консервы. Находят их в тайниках (у каждой
// локации свой уклон — RES_OF), везут караваны, делают постройки базы. Хранятся в рюкзаке героя и на складе базы
// (world.base.stock): производство берёт сырьё со склада и кладёт туда же; верстак берёт из рюкзака, а на базе — и со склада.
//
// Цепочки (WORK): жители на постройках производят — разборка в гараже → металлолом; мастерская: металлолом → детали;
// медпункт: спораны → химия; оружейная: химия + металлолом → порох; теплица → консервы; споровая ферма → спораны.
// Один житель — одна партия за цикл (every), уровень постройки — больше партия. Мастерской, оружейной и ферме нужен свет:
// генератор жжёт бензин (GEN_BURN); бензина нет — они стоят.
//
// Казна базы (b.treasury, спораны; 2026-11-08 — «есть ваша казна и казна стаба»): своя у базы, отдельно от споранов
// героя. В неё идут доход споровой фермы, выручка караванов, трофеи; из неё — плата жителям, покупки караванов и
// патроны наёмникам (они дома сами пополняют боекомплект — game/main.js, resupplyMercs). Герой кладёт и берёт в терминале.
// Жители (b.people): работают, едят (консервы) и получают плату (спораны из казны) раз в UPKEEP секунд мира; сыт и
// получил плату — настроение растёт, нет — падает: при плохом настроении выработка ниже, совсем плохом — житель уходит.
// Новые — беженцы (b.refugees), приходят сами и с караванами; принять — за спораны в терминале.
//
// Караваны (b.caravans): житель везёт ресурсы со склада в «Полис» или «Карьер» на продажу (спораны — на склад, когда
// вернётся) или покупает там (платишь сразу, товар — на склад). Цена — по спросу рынка (world.econ.demand): продаёшь
// много — дешевеет, покупаешь — дорожает, со временем возвращается. В дороге могут ограбить (в «Карьер» в войну с
// мурами — не пойдут).
//
// Машина (world.car): УАЗ из гаража — по карте Улья без живчика, вдвое быстрее, жжёт бензин (FUEL_PER_HOP за
// переход), изнашивается; сломанную чинят деталями. Стоит там, куда на ней приехали.

import { RESOURCES, ITEMS } from './items.js';

/** Базовая цена ресурса, спораны за штуку. */
export const PRICE = { scrap: 2, parts: 7, powder: 6, chem: 5, fuel: 9, food: 3 };
/** Рынки караванов: что там в цене (множитель к PRICE), дорога в один конец — по карте Улья (pathTime). */
export const MARKETS = {
	stab: { name: '«Полис»', want: { scrap: 1, parts: 1.1, powder: 1, chem: 1.3, fuel: 1.2, food: 1.3 } },
	murs: { name: '«Карьер»', want: { scrap: 0.9, parts: 1.2, powder: 1.4, chem: 1, fuel: 1.4, food: 1.1 } },
};
/** Покупка дороже продажи (наценка рынка). */
export const BUY_MARKUP = 1.35;
/** Спрос: за каждую проданную штуку цена ниже на DEMAND_STEP (не ниже DEMAND_MIN), купленную — выше; к 1 — DEMAND_BACK в минуту. */
export const DEMAND_STEP = 0.012, DEMAND_MIN = 0.4, DEMAND_MAX = 1.8, DEMAND_BACK = 0.02;
/** Караван: стоянка на рынке, с; базовый риск ограбления и в «Карьер» при нейтралитете/дружбе с мурами. */
export const CARAVAN_STAY = 120, CARAVAN_RISK = { stab: 0.05, murs: { neutral: 0.1, friend: 0.03 } };

/**
 * Работа на постройках: out — что даёт партия, in — что съедает со склада, every — цикл, с, slots — мест для жителей,
 * power — нужен свет (генератор с бензином). Уровень постройки: партия × (1 + 0,5 × (ур. − 1)).
 */
export const WORK = {
	garage: { name: 'разборка машин', out: { scrap: 2 }, every: 600, slots: 2 },
	workshop: { name: 'сборка деталей', out: { parts: 1 }, in: { scrap: 3 }, every: 600, slots: 2, power: true },
	medbay: { name: 'химия из споранов', out: { chem: 1 }, in: { spore: 2 }, every: 600, slots: 2 },
	armory: { name: 'пороховой цех', out: { powder: 2 }, in: { chem: 1, scrap: 1 }, every: 900, slots: 2, power: true },
	greenhouse: { name: 'огород', out: { food: 2 }, every: 600, slots: 3 },
	sporefarm: { name: 'грибница', out: { spore: 3 }, every: 600, slots: 2, power: true },
	kitchen: { name: 'заготовки', out: { food: 1 }, every: 900, slots: 1 },
};
/** Генератор: столько бензина за GEN_BURN.every секунд, пока на постройках со светом кто-то работает. */
export const GEN_BURN = { fuel: 1, every: 1800 };
/** Жители: содержание раз в UPKEEP с — FOOD_EACH консервов и WAGE споранов на каждого; места — PEOPLE_CAP + по столовой. */
export const UPKEEP = 1800, FOOD_EACH = 1, WAGE = 3, PEOPLE_CAP = 4;
/** Принять беженца стоит столько споранов (одежда, койка, паёк); беженцы приходят раз в REFUGEE_GAP, ждут — до 3. */
export const REFUGEE_PRICE = 15, REFUGEE_GAP = [1200, 2400], REFUGEE_MAX = 3;
export const NAMES = ['Михалыч', 'Петрович', 'Зина', 'Ваня', 'Лёха', 'Тамара', 'Сергеич', 'Оля', 'Гена', 'Нина', 'Толик', 'Костя', 'Валя', 'Митя', 'Люба', 'Палыч', 'Саня', 'Галя'];

/** Машина: бак, л; канистра = CAN л; на переход — FUEL_PER_HOP л; износ за переход; ремонт — детали за каждые 25 %. */
export const CAR = { tank: 40, can: 10, perHop: 6, wear: [3, 9], fix: 25, speed: 0.5 };

/**
 * Верстак (станция craft в мастерской): рецепты — что нужно (need) и что выходит (out); lv — с какого уровня мастерской.
 * Ресурсы берутся из рюкзака, на базе — и со склада.
 */
export const RECIPES = [
	{ id: 'parts', name: 'Детали', out: { parts: 1 }, need: { scrap: 3 }, lv: 1 },
	{ id: 'ammo919', name: 'Патроны 9×19 ×30', out: { ammo919: 30 }, need: { powder: 1, scrap: 1 }, lv: 1 },
	{ id: 'ammo12', name: 'Патроны 12 кал. ×10', out: { ammo12: 10 }, need: { powder: 1, scrap: 1 }, lv: 1 },
	{ id: 'medkit', name: 'Аптечка', out: { medkit: 1 }, need: { chem: 2, food: 1 }, lv: 1 },
	{ id: 'zhivchik', name: 'Живчик', out: { zhivchik: 1 }, need: { chem: 1, spore: 3 }, lv: 1 },
	{ id: 'grenade', name: 'Граната Ф-1', out: { grenade: 1 }, need: { powder: 2, scrap: 1, parts: 1 }, lv: 1 },
	{ id: 'ammo545', name: 'Патроны 5,45×39 ×30', out: { ammo545: 30 }, need: { powder: 2, scrap: 1 }, lv: 2 },
	{ id: 'ammo762', name: 'Патроны 7,62×39 ×30', out: { ammo762: 30 }, need: { powder: 2, scrap: 2 }, lv: 2 },
	{ id: 'ammo556', name: 'Патроны 5,56×45 ×30', out: { ammo556: 30 }, need: { powder: 2, scrap: 1, parts: 1 }, lv: 2 },
	{ id: 'ammo76254', name: 'Патроны 7,62×54R ×10', out: { ammo76254: 10 }, need: { powder: 2, scrap: 1, parts: 1 }, lv: 2 },
	{ id: 'vog25', name: 'Выстрелы ВОГ-25 ×3', out: { vog25: 3 }, need: { powder: 3, parts: 1, scrap: 1 }, lv: 3 },
	{ id: 'rocket', name: 'Выстрел ПГ-7В', out: { rocket: 1 }, need: { powder: 4, parts: 2, scrap: 2 }, lv: 3 },
	{ id: 'ammo127', name: 'Патроны 12,7×108 ×5', out: { ammo127: 5 }, need: { powder: 3, scrap: 2, parts: 1 }, lv: 3 },
];

/** На что идёт ресурс — коротко (терминал). */
export const RES_USE = { scrap: 'детали, патроны, гранаты, порох', parts: 'гранаты, тяжёлое, ремонт машины', powder: 'патроны и гранаты на верстаке', chem: 'аптечки, живчик, порох', fuel: 'генератор (свет), машина', food: 'еда жителей, аптечки' };

/** Ресурсы в тайниках по умолчанию: [от, до, вероятность]. */
const RES_BASE = { scrap: [1, 3, 0.18], food: [1, 2, 0.1], parts: [1, 1, 0.07], chem: [1, 1, 0.045], fuel: [1, 1, 0.035], powder: [1, 1, 0.035] };
/** Уклон локаций: во сколько раз чаще такой ресурс в её тайниках. */
export const RES_OF = {
	neftebaza: { fuel: 5, scrap: 1.3 }, port: { scrap: 2, parts: 1.6, food: 1.6, fuel: 1.5 }, tc: { food: 3, chem: 2 },
	tyurma: { powder: 2.5, food: 1.5 }, shahta: { powder: 3.5, scrap: 2, parts: 1.6 }, himmash: { scrap: 2.2, chem: 1.6, parts: 1.3 },
	bolnica: { chem: 3.5, food: 1.2 }, voench: { powder: 2.5, parts: 1.6, fuel: 1.5 }, aerodrom: { fuel: 2.5, powder: 2.5, parts: 1.5 },
	nii: { chem: 3.5, parts: 1.5 }, vokzal: { scrap: 1.6, fuel: 1.8 }, podstanciya: { parts: 2.2, scrap: 1.6 },
	mikro: { food: 1.8, chem: 1.3 }, zarechny: { food: 1.4, scrap: 1.2 }, dachi: { food: 1.8 }, bor: { food: 1.8 }, lesopilka: { scrap: 1.3, fuel: 1.3 },
};
/** Ресурсы для тайника локации id: [[вид, сколько], …]. */
export function rollResources(id) {
	const out = [], k = RES_OF[id] ?? {};
	for (const [kind, [a, b, p]] of Object.entries(RES_BASE)) if (Math.random() < Math.min(0.85, p * (k[kind] ?? 1))) out.push([kind, a + Math.floor(Math.random() * (b - a + 1))]);
	return out;
}

const rand = (a, b) => a + Math.random() * (b - a);

/** Учёт экономики в новом мире (и в старом сохранении — недостающее). */
export function normalizeEconomy(world) {
	const b = world.base;
	b.treasury ??= 0;
	// спораны со склада (доход фермы, трофеи, добыча наёмников) — в казну
	if (b.stock.spore > 0) { b.treasury += b.stock.spore; delete b.stock.spore; }
	b.people ??= [];
	b.morale ??= 70;
	b.refugees ??= 1;
	b.refugeeAt ??= world.time + rand(...REFUGEE_GAP);
	b.upkeepAt ??= world.time + UPKEEP;
	b.workAt ??= {};
	b.genAt ??= world.time;
	b.caravans ??= [];
	b.econLog ??= [];
	world.econ ??= {};
	world.econ.demand ??= {};
	for (const m of Object.keys(MARKETS)) {
		world.econ.demand[m] ??= {};
		for (const r of RESOURCES) world.econ.demand[m][r] ??= 1;
	}
	world.econ.at ??= world.time;
	return world;
}

/** Сколько жителей помещается: PEOPLE_CAP и по 2 за уровень столовой. */
export const peopleCap = (b, lv) => PEOPLE_CAP + 2 * (lv('kitchen') ?? 0) + (lv('barracks') ? 2 : 0);
/** Множитель выработки по настроению. */
export const moraleK = (m) => (m >= 50 ? 1 : m >= 25 ? 0.6 : 0.3);
/** Свет есть: генератор построен и на складе есть бензин (или он ещё горит с прошлой заливки). */
export const powered = (b) => b.built.includes('generator') && ((b.stock.fuel ?? 0) > 0 || (b.genFuel ?? 0) > 0);

/** Цена штуки ресурса kind на рынке market: продажа (buy=false) или покупка. */
export function priceOf(world, market, kind, buy = false) {
	const d = world.econ?.demand?.[market]?.[kind] ?? 1;
	const p = PRICE[kind] * (MARKETS[market].want[kind] ?? 1) * d;
	return buy ? Math.max(1, Math.ceil(p * BUY_MARKUP)) : Math.max(1, Math.floor(p));
}
/** Сколько споранов дадут за n штук (цена падает по ходу продажи). */
export function sellValue(world, market, kind, n) {
	let sum = 0, d = world.econ.demand[market][kind];
	for (let i = 0; i < n; i++) { sum += Math.max(1, PRICE[kind] * (MARKETS[market].want[kind] ?? 1) * d); d = Math.max(DEMAND_MIN, d - DEMAND_STEP); }
	return Math.floor(sum);
}
/** Сколько стоит купить n штук (цена растёт по ходу покупки). */
export function buyCost(world, market, kind, n) {
	let sum = 0, d = world.econ.demand[market][kind];
	for (let i = 0; i < n; i++) { sum += PRICE[kind] * (MARKETS[market].want[kind] ?? 1) * d * BUY_MARKUP; d = Math.min(DEMAND_MAX, d + DEMAND_STEP); }
	return Math.ceil(sum);
}

/** Сколько ресурса r есть на базе (спораны — в казне). */
export const haveOf = (b, r) => (r === 'spore' ? b.treasury ?? 0 : b.stock[r] ?? 0);
/** Прибавить (убавить) ресурс r на базе (спораны — в казну). */
export function addTo(b, r, n) {
	if (r === 'spore') b.treasury = (b.treasury ?? 0) + n;
	else b.stock[r] = (b.stock[r] ?? 0) + n;
}

/** Свободные жители (без работы и не в караване). */
export const idlePeople = (b) => b.people.filter((p) => !p.job);
/** Работают на постройке id. */
export const workersOn = (b, id) => b.people.filter((p) => p.job === id).length;

/**
 * Время мира дошло до now: работа на постройках (сырьё → продукт на склад), генератор жжёт бензин, содержание жителей,
 * беженцы, спрос на рынках, возвращение караванов. lv(id) — уровень постройки; stance — отношения с мурами.
 * Возвращает события для ленты: { text, warn? }.
 */
export function tickEconomy(world, now, lv, stance = 'neutral') {
	const b = world.base, ev = [];
	normalizeEconomy(world);
	// генератор: пока на постройках со светом работают — раз в GEN_BURN.every со склада уходит канистра
	const needPower = Object.entries(WORK).some(([id, W]) => W.power && workersOn(b, id) > 0 && b.built.includes(id));
	if (b.built.includes('generator') && needPower) {
		while (now - b.genAt >= GEN_BURN.every) {
			b.genAt += GEN_BURN.every;
			if ((b.stock.fuel ?? 0) >= GEN_BURN.fuel) { b.stock.fuel -= GEN_BURN.fuel; b.genFuel = 1; } else if (b.genFuel) { b.genFuel = 0; ev.push({ text: 'Генератор встал — нет бензина: мастерская, оружейная и ферма без света', warn: true }); }
		}
	} else b.genAt = now;
	// работа: каждый житель на постройке — партия за цикл (если хватает сырья и, где нужно, света)
	const made = {};
	const mk = moraleK(b.morale);
	for (const [id, W] of Object.entries(WORK)) {
		const n = workersOn(b, id);
		if (!n || !b.built.includes(id)) { b.workAt[id] = now; continue; }
		b.workAt[id] ??= now;
		while (now - b.workAt[id] >= W.every) {
			b.workAt[id] += W.every;
			if (W.power && !powered(b)) continue;
			const k = (1 + 0.5 * ((lv(id) || 1) - 1)) * mk;
			for (let i = 0; i < n; i++) {
				if (W.in && Object.entries(W.in).some(([r, q]) => haveOf(b, r) < q)) break;
				for (const [r, q] of Object.entries(W.in ?? {})) addTo(b, r, -q);
				for (const [r, q] of Object.entries(W.out)) {
					const add = Math.max(1, Math.round(q * k));
					addTo(b, r, add);
					made[r] = (made[r] ?? 0) + add;
				}
			}
		}
	}
	if (Object.keys(made).length) ev.push({ made });
	// содержание жителей: еда и плата; настроение
	while (now >= b.upkeepAt) {
		b.upkeepAt += UPKEEP;
		const n = b.people.length;
		if (!n) continue;
		const food = Math.min(b.stock.food ?? 0, n * FOOD_EACH), pay = Math.min(b.treasury, n * WAGE);
		b.stock.food = (b.stock.food ?? 0) - food;
		b.treasury -= pay;
		const fed = food >= n * FOOD_EACH, paid = pay >= n * WAGE;
		b.morale = Math.max(0, Math.min(100, b.morale + (fed ? 8 : -22) + (paid ? 5 : -12)));
		if (!fed || !paid) ev.push({ text: `Жителям базы ${!fed ? 'не хватило еды' : ''}${!fed && !paid ? ' и ' : ''}${!paid ? 'не заплатили' : ''} — настроение ${Math.round(b.morale)} %: работают хуже`, warn: true });
		if (b.morale < 15 && b.people.length) {
			const p = b.people.splice(Math.floor(Math.random() * b.people.length), 1)[0];
			ev.push({ text: `${p.name} ушёл с базы — голодно и без платы`, warn: true });
		}
	}
	// беженцы приходят к воротам сами
	while (now >= b.refugeeAt) {
		b.refugeeAt += rand(...REFUGEE_GAP);
		if (b.refugees < REFUGEE_MAX) { b.refugees++; ev.push({ text: 'К воротам базы пришёл беженец — принять можно в терминале (вкладка «Жители»)' }); }
	}
	// спрос на рынках возвращается к обычному
	const mins = Math.max(0, now - world.econ.at) / 60;
	world.econ.at = now;
	for (const m of Object.values(world.econ.demand)) for (const r of Object.keys(m)) m[r] += Math.sign(1 - m[r]) * Math.min(Math.abs(1 - m[r]), DEMAND_BACK * mins);
	// караваны возвращаются
	for (const c of [...b.caravans]) {
		if (now < c.back) continue;
		b.caravans = b.caravans.filter((x) => x !== c);
		const p = b.people.find((x) => x.id === c.who);
		const risk = c.market === 'murs' ? CARAVAN_RISK.murs[stance] ?? 1 : CARAVAN_RISK.stab;
		if (Math.random() < risk) {
			// ограбили: товар и выручка пропали, житель ранен или погиб
			const dead = Math.random() < 0.4;
			if (p) { if (dead) b.people = b.people.filter((x) => x !== p); else p.job = null; }
			ev.push({ text: `Караван в ${MARKETS[c.market].name} ограбили по дороге${dead && p ? ` — ${p.name} не вернулся` : ''}: товар пропал`, warn: true });
			continue;
		}
		if (p) p.job = null;
		if (c.pay) b.treasury += c.pay;
		for (const [k, n] of Object.entries(c.buy ?? {})) b.stock[k] = (b.stock[k] ?? 0) + n;
		// с караваном из «Полиса» бывает беженец
		const ref = c.market === 'stab' && Math.random() < 0.3 && b.refugees < REFUGEE_MAX;
		if (ref) b.refugees++;
		const got = [c.pay ? `${c.pay} сп.` : '', ...Object.entries(c.buy ?? {}).map(([k, n]) => `${ITEMS[k].name.toLowerCase()} ×${n}`)].filter(Boolean).join(', ');
		ev.push({ text: `Караван вернулся из ${MARKETS[c.market].name}${got ? ` — на складе: ${got}` : ''}${ref ? '; с ним пришёл беженец' : ''}`, caravan: c });
	}
	return ev;
}

/**
 * Отправить караван: sell — { вид: n } со склада на продажу, buy — { вид: n } купить (платит герой сразу, cost).
 * tripTime — дорога туда-обратно, с. Возвращает караван или строку с причиной отказа.
 */
export function sendCaravan(world, market, { sell = {}, buy = {} }, now, tripTime, stance = 'neutral') {
	const b = world.base;
	if (market === 'murs' && stance === 'war') return 'в «Карьер» в войну с мурами караван не пойдёт';
	if (b.caravans.some((c) => c.market === market)) return `караван в ${MARKETS[market].name} уже в пути`;
	const p = idlePeople(b)[0] ?? b.people.find((x) => x.job && x.job !== 'caravan');
	if (!p) return 'некого послать — нужен житель (вкладка «Жители»)';
	for (const [k, n] of Object.entries(sell)) if ((b.stock[k] ?? 0) < n) return 'на складе столько нет';
	let pay = 0;
	for (const [k, n] of Object.entries(sell)) {
		if (n <= 0) continue;
		pay += sellValue(world, market, k, n);
		b.stock[k] -= n;
		world.econ.demand[market][k] = Math.max(DEMAND_MIN, world.econ.demand[market][k] - DEMAND_STEP * n);
	}
	for (const [k, n] of Object.entries(buy)) if (n > 0) world.econ.demand[market][k] = Math.min(DEMAND_MAX, world.econ.demand[market][k] + DEMAND_STEP * n);
	p.job = 'caravan';
	const c = { market, sell, buy, pay, who: p.id, back: now + tripTime + CARAVAN_STAY };
	b.caravans.push(c);
	return c;
}

/** Новый житель. */
export function newPerson(b) {
	const used = new Set(b.people.map((p) => p.name));
	const name = NAMES.find((n) => !used.has(n)) ?? `Житель ${b.people.length + 1}`;
	return { id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name, job: null };
}
