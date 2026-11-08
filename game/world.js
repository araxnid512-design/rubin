// Карта мира: стаб и кластеры вокруг, дороги между ними, время мира и перезагрузки кластеров.
// Кластер — кусок Земли, который Улей раз в 10–12 минут подменяет свежей копией: всё, что внутри
// (и все, кто внутри), исчезает. Стаб — стабильный участок, он не перезагружается.
// Время мира идёт, пока герой в локации, и прыгает вперёд на время дороги.
// preview — снимок локации (scripts/render-previews.mjs) для карты Улья.
// Муры — бандиты со своим стабом «Карьер»: вылазки в кластеры и учёт — game/murs.js, состояние — world.murs.
// База «Опорный» (kind 'base') — постоянный кластер героя: не перезагружается, постройки покупаются в терминале
// (game/base.js), состояние — world.base. Внешники — пришлые солдаты с форпостом (kind 'ext'): охоты и учёт —
// game/ext.js, состояние — world.ext.

import { newMurs, normalizeMurs } from './murs.js';
import { newBase, normalizeBase } from './base.js';
import { newExt, normalizeExt } from './ext.js';
import { newHorde, normalizeHorde } from './migrant.js';
import { newQuests, normalizeQuests } from './quests.js';
import { normalizeEconomy, CAR } from './economy.js';

// pos — точка узла на карте-местности Улья (game/worldmap.js, MAP_W×MAP_H, север сверху): at = pos; от неё зависит и
// сторона прихода в локацию без своего выхода к соседу (level.entry). Дороги (ROUTES) — между соседями по местности.
export const NODES = {
	stab: { name: 'Стаб «Полис»', short: 'Полис', kind: 'stab', pos: [80, 92], preview: 'assets/previews/stab.jpg', desc: 'Стабильная территория: торговец, лекарь, охрана. Не перезагружается.' },
	zarechny: { name: 'Кластер «Заречный»', short: 'Заречный', kind: 'cluster', pos: [92, 76], preview: 'assets/previews/zarechny.jpg', desc: 'Посёлок у трассы: хрущёвка, гаражи, частные дома, магазин. Патроны 9×18 в домах.' },
	dachi: { name: 'Кластер «Дачи»', short: 'Дачи', kind: 'cluster', pos: [60, 74], preview: 'assets/previews/dachi.jpg', desc: 'Садовое товарищество: домики, теплицы, сторожка. Охотничьи патроны 12 калибра, обрезы.' },
	// глубже в Улье: развитые заражённые — топтуны и руберы, у руберов бывает чёрный жемчуг
	voench: { name: 'Кластер «Военная часть»', short: 'В/ч', kind: 'cluster', danger: 3, pos: [48, 32], preview: 'assets/previews/voench.jpg', desc: 'Брошенная войсковая часть: КПП, казарма, оружейка, ангары с техникой. Логово руберов — оружие, гранаты, чёрный жемчуг.' },
	murs: { name: 'Стаб муров «Карьер»', short: 'Карьер', kind: 'murs', pos: [10, 30], preview: 'assets/previews/murs.jpg', desc: 'Логово муров — бандитов, которые охотятся на иммунных. До пятидесяти стволов: зайти можно, выйти — вряд ли. В шкафах склада — всё, что они вынесли из кластеров.' },
	himmash: { name: 'Кластер «Химмаш»', short: 'Химмаш', kind: 'cluster', danger: 2, pos: [42, 56], preview: 'assets/previews/himmash.jpg', desc: 'Заводская промзона: цех, склад, ж/д тупик с цистернами. Много топтунов и два рубера — горох, чёрный жемчуг.' },
	// новые кластеры и база героя
	base: { name: 'База «Опорный»', short: 'База', kind: 'base', pos: [50, 92], preview: 'assets/previews/base.jpg', desc: 'Твоя база — постоянный кластер, не перезагружается. В терминале посреди площадки покупаются постройки: стена, вышки, казарма, оружейная, склад и другие — каждая что-то даёт.' },
	bolnica: { name: 'Кластер «Больница»', short: 'Больница', kind: 'cluster', danger: 2, pos: [104, 54], preview: 'assets/previews/bolnica.jpg', desc: 'Городская больница: корпуса, приёмный покой, морг, гаражи скорой. Живчики и патроны у охраны, топтуны в коридорах.' },
	lesopilka: { name: 'Кластер «Лесопилка»', short: 'Лесопилка', kind: 'cluster', danger: 1, pos: [34, 76], preview: 'assets/previews/lesopilka.jpg', desc: 'Лесопилка у реки: пилорама, штабеля брёвен, бараки рабочих, контора. Тихая окраина — охотничьи ружья и патроны 12 калибра.' },
	podstanciya: { name: 'Кластер «Подстанция»', short: 'Подстанция', kind: 'cluster', danger: 2, pos: [72, 58], preview: 'assets/previews/podstanciya.jpg', desc: 'Электроподстанция и посёлок энергетиков: трансформаторы, щитовая, общежитие, гаражи. Топтуны и рубер у трансформаторов.' },
	// ещё четыре кластера (2026-11-04): деревня на окраине, станция в промзоне, микрорайон в глубине, аэродром в чёрной зоне
	bor: { name: 'Кластер «Деревня Бор»', short: 'Бор', kind: 'cluster', danger: 1, pos: [12, 78], preview: 'assets/previews/bor.jpg', desc: 'Деревня на опушке бора: избы с огородами, сельпо, колхозная ферма, церковь. Тихо — бегуны и редкий топтун. Охотничьи ружья, патроны 12 калибра.' },
	vokzal: { name: 'Кластер «Ж/д станция»', short: 'Станция', kind: 'cluster', danger: 2, pos: [12, 60], preview: 'assets/previews/vokzal.jpg', desc: 'Узловая станция: вокзал, платформы, составы и цистерны, депо, водокачка. Топтуны в депо, бегуны на путях. Патроны у транспортной милиции.' },
	mikro: { name: 'Кластер «Микрорайон»', short: 'Микрорайон', kind: 'cluster', danger: 3, pos: [96, 30], preview: 'assets/previews/mikro.jpg', desc: 'Спальный район: панельные девятиэтажки с магазинами внизу, школа, гаражи. Логово руберов во дворах. Много тайников, бывает чёрный жемчуг.' },
	aerodrom: { name: 'Кластер «Аэродром»', short: 'Аэродром', kind: 'cluster', danger: 4, pos: [100, 12], preview: 'assets/previews/aerodrom.jpg', desc: 'Военный аэродром: полоса, ангары, вертолёты, командно-диспетчерский пункт, склад вооружения. Элита и руберы. Гранатомёты и выстрелы к ним, крупнокалиберные патроны.' },
	// внешники — пришлые солдаты с хорошим снаряжением, охотятся на иммунных (game/ext.js); их форпост — глубоко в Улье
	forpost: { name: 'Форпост внешников', short: 'Форпост', kind: 'ext', pos: [30, 14], preview: 'assets/previews/forpost.jpg', desc: 'Укреплённый лагерь внешников — пришлых солдат в форме, с хорошим оружием и бронёй. Охотятся на иммунных. В контейнерах склада — их снаряжение: зайти можно, выйти — вряд ли.' },
	nii: { name: 'Кластер «НИИ»', short: 'НИИ', kind: 'cluster', danger: 4, pos: [62, 14], preview: 'assets/previews/nii.jpg', desc: 'Закрытый научный городок: лабораторный корпус, виварий, ограда с КПП. Логово элиты — самого опасного мутанта Улья. Редкое оружие и чёрный жемчуг.' },
	// ещё пять кластеров (2026-11-08): речной порт в Промзоне, нефтебаза, тюрьма и торговый центр в Глубине, шахта в Чёрной зоне
	port: { name: 'Кластер «Речной порт»', short: 'Порт', kind: 'cluster', danger: 2, pos: [136, 56], preview: 'assets/previews/port.jpg', desc: 'Грузовой порт на реке: причалы с кранами, баржи, контейнерный двор, пакгаузы, контора порта. Топтуны среди контейнеров. Патроны и снаряжение в контейнерах.' },
	neftebaza: { name: 'Кластер «Нефтебаза»', short: 'Нефтебаза', kind: 'cluster', danger: 3, pos: [24, 46], preview: 'assets/previews/neftebaza.jpg', desc: 'Нефтебаза: резервуарный парк, сливная эстакада с цистернами, насосная, АЗС, гаражи бензовозов. Бочки с горючим рвутся от пули. Руберы в обваловке, топливо для генератора.' },
	tyurma: { name: 'Кластер «Тюрьма»', short: 'Тюрьма', kind: 'cluster', danger: 3, pos: [128, 38], preview: 'assets/previews/tyurma.jpg', desc: 'Исправительная колония: стена с вышками, бараки, промзона, ШИЗО, административный корпус. Узкие проходы и толпы заражённых в робах. Оружейная охраны.' },
	tc: { name: 'Кластер «Торговый центр»', short: 'ТЦ', kind: 'cluster', danger: 3, pos: [72, 40], preview: 'assets/previews/tc.jpg', desc: 'Торговый центр «Улей» с огромной парковкой: магазины, гипермаркет, фудкорт, склад. Внутри темно и тесно — логово руберов. Много тайников: еда, лекарства, вещи.' },
	// логово скребера (2026-11-08): высшая стадия заражённого — сильнее элиты; с него красная жемчужина
	proval: { name: 'Кластер «Провал»', short: 'Провал', kind: 'cluster', danger: 4, pos: [118, 5], preview: 'assets/previews/proval.jpg', desc: 'Провал на месте химкомбината: обрушенные корпуса над огромной воронкой, споровые наросты, кости. Логово скребера — сильнее элиты, раны затягивает, бьёт по земле так, что сбивает с ног. С него — красная жемчужина.' },
	shahta: { name: 'Кластер «Шахта»', short: 'Шахта', kind: 'cluster', danger: 4, pos: [136, 18], preview: 'assets/previews/shahta.jpg', desc: 'Угольная шахта: копёр, обогатительная фабрика, терриконы, вагонетки, административно-бытовой комбинат. Элита у ствола шахты. Взрывчатка и редкое оружие.' },
};
for (const n of Object.values(NODES)) n.at = n.pos;

/**
 * Пояса Улья (2026-11-04, систематизация кластеров): по опасности кластера (danger 1–4) — Окраина, Промзона,
 * Глубина, Чёрная зона. У пояса — цвет на карте, звёзды, кто водится и что там искать (лут по поясу — game/main.js,
 * rollLoot: в Глубине и Чёрной зоне в тайники добавляются редкие вещи). Стаб, база, «Карьер» и форпост — вне поясов.
 */
export const ZONES = {
	1: { id: 'okraina', name: 'Окраина', color: '#8fc46a', stars: '★☆☆☆', who: 'бегуны, редкий топтун', loot: 'патроны 9×19 и 12 кал., ружья, живчики, спораны', desc: 'Ближний пояс Улья: деревни, дачи, лесопилка. Безопаснее всего — сюда ходят новички.' },
	2: { id: 'promzona', name: 'Промзона', color: '#e0c45a', stars: '★★☆☆', who: 'топтуны, рубер', loot: 'автоматные патроны, гранаты, горох, бывает автомат', desc: 'Заводы, станция, больница, подстанция, речной порт. Топтуны ходят стаями, попадается рубер.' },
	3: { id: 'glubina', name: 'Глубина', color: '#f08a3c', stars: '★★★☆', who: 'логово руберов', loot: 'стволы, 7,62 и 12,7, чёрный жемчуг, выстрелы к гранатомётам', desc: 'Военная часть, микрорайон, нефтебаза, тюрьма, торговый центр. Руберы водят стаи, иногда дорастают до элиты. Без наёмников — не суйся.' },
	4: { id: 'black', name: 'Чёрная зона', color: '#e0442c', stars: '★★★★', who: 'элита, руберы', loot: 'тяжёлое оружие, 12,7×108, ВОГ-25, ПГ-7В, чёрный жемчуг', desc: 'НИИ, аэродром, шахта и Провал: логово элиты, в Провале — скребер. Самое опасное и самое богатое место Улья.' },
};
/** Пояс кластера id (null — стаб, база, логова). */
export const zoneOf = (id) => (NODES[id]?.kind === 'cluster' ? ZONES[Math.max(1, Math.min(4, NODES[id].danger ?? 1))] : null);
/** Кластеры пояса z (1–4). */
export const clustersOfZone = (z) => Object.keys(NODES).filter((id) => NODES[id].kind === 'cluster' && Math.max(1, Math.min(4, NODES[id].danger ?? 1)) === z);

/** Секторы Улья для списка на карте (сверху вниз): пояс (ZONES, null — стаб и база) и подпись. */
export const BANDS = [
	{ zone: 4, name: 'Чёрная зона' },
	{ zone: 3, name: 'Глубина' },
	{ zone: 2, name: 'Промзона' },
	{ zone: 1, name: 'Окраина' },
	{ zone: null, name: 'Стаб и база' },
];
/** Сектор узла (номер в BANDS): кластер — по опасности, форпост — Чёрная зона, «Карьер» — Глубина, стаб и база — внизу. */
export const bandOf = (id) => {
	const n = NODES[id];
	if (n?.kind === 'cluster') return 4 - Math.max(1, Math.min(4, n.danger ?? 1));
	return n?.kind === 'ext' ? 0 : n?.kind === 'murs' ? 1 : 4;
};

/**
 * Карта Улья — местность (game/worldmap.js): MAP_W×MAP_H условных единиц, север сверху; у узла pos — точка на карте
 * (от неё — сторона, откуда приходишь в локацию без своего выхода к соседу, level.entry). Река, леса, озеро, болото и
 * холмы — TERRAIN (рисуются под дорогами).
 */
export const MAP_W = 160, MAP_H = 100;
export const TERRAIN = {
	// река: с востока, мимо порта, между Подстанцией и Заречным, на запад мимо Лесопилки (Заречный — за рекой)
	river: 'M162 44 C150 46 144 50 140 60 S124 66 112 66 S98 64 86 67 S74 82 56 83 S28 81 14 86 S2 88 -2 87',
	lake: { x: 54, y: 64, rx: 4.5, ry: 2.6 },
	swamp: [[66, 22, 7, 4], [20, 24, 5, 3]],
	forest: [[8, 70, 9, 7], [22, 88, 10, 5], [24, 66, 6, 4], [4, 44, 6, 9], [44, 22, 6, 5], [80, 22, 7, 4], [118, 26, 7, 5], [150, 32, 8, 6], [116, 80, 10, 6], [148, 76, 10, 8], [64, 94, 8, 4], [100, 92, 9, 4], [84, 6, 8, 4], [120, 6, 9, 4], [6, 12, 8, 6]],
	hills: [[10, 34, 9, 6], [140, 24, 12, 7], [152, 12, 8, 5]],
};

/** Дороги: [откуда, куда, время в пути, с]. */
export const ROUTES = [
	// Чёрная зона (север)
	['forpost', 'nii', 85],
	['nii', 'aerodrom', 80],
	['aerodrom', 'shahta', 85],
	['aerodrom', 'proval', 90],
	['shahta', 'proval', 85],
	['forpost', 'murs', 90],
	['forpost', 'voench', 95],
	// Глубина
	['nii', 'voench', 80],
	['nii', 'tc', 90],
	['aerodrom', 'mikro', 75],
	['shahta', 'tyurma', 80],
	['murs', 'neftebaza', 75],
	['voench', 'neftebaza', 80],
	['voench', 'tc', 70],
	['tc', 'mikro', 70],
	['mikro', 'tyurma', 75],
	// Глубина — Промзона
	['murs', 'vokzal', 80],
	['neftebaza', 'vokzal', 70],
	['neftebaza', 'himmash', 75],
	['voench', 'himmash', 90],
	['tc', 'podstanciya', 70],
	['mikro', 'bolnica', 80],
	['tyurma', 'port', 80],
	// Промзона
	['vokzal', 'himmash', 60],
	['himmash', 'podstanciya', 60],
	['podstanciya', 'bolnica', 70],
	['bolnica', 'port', 75],
	// Промзона — Окраина
	['vokzal', 'bor', 70],
	['vokzal', 'lesopilka', 70],
	['himmash', 'lesopilka', 75],
	['himmash', 'dachi', 85],
	['podstanciya', 'dachi', 75],
	['podstanciya', 'zarechny', 60],
	['bolnica', 'zarechny', 60],
	['port', 'zarechny', 90],
	// Окраина
	['bor', 'lesopilka', 80],
	['lesopilka', 'dachi', 70],
	['dachi', 'zarechny', 60],
	// стаб и база
	['lesopilka', 'base', 70],
	['bor', 'base', 85],
	['dachi', 'base', 75],
	['dachi', 'stab', 95],
	['zarechny', 'stab', 75],
	['base', 'stab', 60],
];

/** Сколько живёт кластер между перезагрузками, с. */
export const CYCLE = [600, 720];
/**
 * «Кисляк» перед перезагрузкой: за WARN секунд — кислый запах; за RAGE — муть сгущается, гудит, заражённые звереют
 * (быстрее, злее, сбегаются на героя); за 30 с Улей гонит из мути новых (game/main.js, updateCluster).
 */
export const WARN = 120;
export const RAGE = 60;

const rand = (a, b) => a + Math.random() * (b - a);

export function routesFrom(id) {
	return ROUTES.filter(([a, b]) => a === id || b === id).map(([a, b, t]) => ({ to: a === id ? b : a, time: t }));
}

export function travelTime(from, to) {
	return ROUTES.find(([a, b]) => (a === from && b === to) || (a === to && b === from))?.[2] ?? 120;
}

/**
 * Кратчайший путь по дорогам Улья от from до to: { nodes: [from, …, to], time } (по времени в пути). Идти можно в любую
 * локацию — через промежуточные кластеры; за каждый переход (ребро пути) герой выпивает живчик (travelCost).
 */
export function shortestPath(from, to) {
	if (from === to) return { nodes: [from], time: 0 };
	const dist = { [from]: 0 }, prev = {}, left = new Set(Object.keys(NODES));
	while (left.size) {
		let u = null;
		for (const n of left) if (dist[n] != null && (u === null || dist[n] < dist[u])) u = n;
		if (u === null || u === to) break;
		left.delete(u);
		for (const { to: v, time } of routesFrom(u)) if (left.has(v) && (dist[v] == null || dist[u] + time < dist[v])) { dist[v] = dist[u] + time; prev[v] = u; }
	}
	if (dist[to] == null) return { nodes: [from, to], time: 240 };
	const nodes = [to];
	while (nodes[0] !== from) nodes.unshift(prev[nodes[0]]);
	return { nodes, time: dist[to] };
}
/** Сколько живчика нужно на дорогу from → to: по одному на каждый переход между узлами. */
export const travelCost = (from, to) => Math.max(0, shortestPath(from, to).nodes.length - 1);

/** Кратчайшая дорога по карте Улья (через другие узлы), с — для вылазок наёмников с базы. */
export function pathTime(from, to) {
	const dist = { [from]: 0 }, left = new Set(Object.keys(NODES));
	while (left.size) {
		let u = null;
		for (const n of left) if (dist[n] != null && (u === null || dist[n] < dist[u])) u = n;
		if (u === null || u === to) break;
		left.delete(u);
		for (const { to: v, time } of routesFrom(u)) if (left.has(v) && (dist[v] == null || dist[u] + time < dist[v])) dist[v] = dist[u] + time;
	}
	return dist[to] ?? 240;
}

/** Новый мир: герой в Заречном, до перезагрузки — 10 минут; остальные кластеры — в случайной фазе. */
export function newWorld() {
	return normalizeWorld({
		time: 0,
		at: 'zarechny',
		clusters: {
			zarechny: { next: 600, saved: null, reloads: 0 },
			dachi: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			himmash: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			voench: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			bolnica: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			lesopilka: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			podstanciya: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			nii: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			bor: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			vokzal: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			mikro: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			aerodrom: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			port: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			neftebaza: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			tyurma: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			tc: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			shahta: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
			proval: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
		},
		murs: newMurs(0),
		base: newBase(0),
		ext: newExt(0),
		horde: newHorde(0), // кочующая стая с вожаком (game/migrant.js)
		quests: newQuests(0), // доска заданий (game/quests.js)
	});
}

/** Сохранение из старой версии: кластеры, которых тогда не было, — в случайной фазе. */
export function normalizeWorld(world) {
	for (const [id, n] of Object.entries(NODES)) {
		if (n.kind === 'cluster' && !world.clusters[id]) world.clusters[id] = { next: world.time + rand(90, CYCLE[1]), saved: null, reloads: 0 };
	}
	world.murs = normalizeMurs(world.murs, world.time);
	world.base = normalizeBase(world.base, world.time);
	world.ext = normalizeExt(world.ext, world.time);
	world.horde = normalizeHorde(world.horde, world.time);
	world.quests = normalizeQuests(world.quests, world.time);
	normalizeEconomy(world); // жители, караваны, спрос на рынках (game/economy.js)
	// машина (УАЗ из гаража базы): где стоит, бензин в баке, л, состояние, %
	if (world.base.built.includes('garage')) world.car ??= { at: 'base', fuel: CAR.tank / 2, cond: 100 };
	return world;
}

/**
 * Время мира идёт на dt. Кластеры, чей срок вышел, перезагружаются: сохранённое состояние
 * (убитые, обысканное, лежащее на земле) пропадает, новый срок — 10–12 минут. Возвращает id перезагрузившихся.
 */
export function advance(world, dt) {
	world.time += dt;
	const reloaded = [];
	for (const [id, c] of Object.entries(world.clusters)) {
		while (world.time >= c.next) {
			c.next += rand(...CYCLE);
			c.saved = null;
			c.raided = null; // следы вылазки муров — вместе с кластером
			c.reloads++;
			reloaded.push(id);
		}
	}
	return reloaded;
}

/** Секунд до перезагрузки кластера (Infinity для стаба). */
export function timeLeft(world, id) {
	const c = world.clusters[id];
	return c ? c.next - world.time : Infinity;
}

/** «4:05» */
export function clock(s) {
	s = Math.max(0, Math.ceil(s));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** «~2 мин», «~40 с» — как чувствует иммунный, без точных секунд. */
export function approx(s) {
	if (s < 50) return `~${Math.max(10, Math.round(s / 10) * 10)} с`;
	const m = Math.round(s / 30) / 2;
	return `~${String(m).replace('.', ',')} мин`;
}

// ---------- Сохранение ----------

const KEY = 'ulei-cluster17-save';

export function saveGame(data) {
	try {
		localStorage.setItem(KEY, JSON.stringify({ v: 1, ...data }));
		return true;
	} catch {
		return false;
	}
}

export function loadGame() {
	try {
		const d = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		return d?.v === 1 ? d : null;
	} catch {
		return null;
	}
}

export function clearSave() {
	try { localStorage.removeItem(KEY); } catch { /* хранилище недоступно */ }
}
