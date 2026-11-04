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

export const NODES = {
	stab: { name: 'Стаб «Полис»', short: 'Полис', kind: 'stab', at: [50, 86], preview: 'assets/previews/stab.jpg', desc: 'Стабильная территория: торговец, лекарь, охрана. Не перезагружается.' },
	zarechny: { name: 'Кластер «Заречный»', short: 'Заречный', kind: 'cluster', at: [80, 54], preview: 'assets/previews/zarechny.jpg', desc: 'Посёлок у трассы: хрущёвка, гаражи, частные дома, магазин. Патроны 9×18 в домах.' },
	dachi: { name: 'Кластер «Дачи»', short: 'Дачи', kind: 'cluster', at: [20, 52], preview: 'assets/previews/dachi.jpg', desc: 'Садовое товарищество: домики, теплицы, сторожка. Охотничьи патроны 12 калибра, обрезы.' },
	// глубже в Улье: развитые заражённые — топтуны и руберы, у руберов бывает чёрный жемчуг
	voench: { name: 'Кластер «Военная часть»', short: 'В/ч', kind: 'cluster', danger: 3, at: [84, 11], preview: 'assets/previews/voench.jpg', desc: 'Брошенная войсковая часть: КПП, казарма, оружейка, ангары с техникой. Логово руберов — оружие, гранаты, чёрный жемчуг.' },
	murs: { name: 'Стаб муров «Карьер»', short: 'Карьер', kind: 'murs', at: [13, 16], preview: 'assets/previews/murs.jpg', desc: 'Логово муров — бандитов, которые охотятся на иммунных. До пятидесяти стволов: зайти можно, выйти — вряд ли. В шкафах склада — всё, что они вынесли из кластеров.' },
	himmash: { name: 'Кластер «Химмаш»', short: 'Химмаш', kind: 'cluster', danger: 2, at: [46, 26], preview: 'assets/previews/himmash.jpg', desc: 'Заводская промзона: цех, склад, ж/д тупик с цистернами. Много топтунов и два рубера — горох, чёрный жемчуг.' },
	// новые кластеры и база героя
	base: { name: 'База «Опорный»', short: 'База', kind: 'base', at: [24, 84], preview: 'assets/previews/base.jpg', desc: 'Твоя база — постоянный кластер, не перезагружается. В терминале посреди площадки покупаются постройки: стена, вышки, казарма, оружейная, склад и другие — каждая что-то даёт.' },
	bolnica: { name: 'Кластер «Больница»', short: 'Больница', kind: 'cluster', danger: 2, at: [74, 76], preview: 'assets/previews/bolnica.jpg', desc: 'Городская больница: корпуса, приёмный покой, морг, гаражи скорой. Живчики и патроны у охраны, топтуны в коридорах.' },
	lesopilka: { name: 'Кластер «Лесопилка»', short: 'Лесопилка', kind: 'cluster', danger: 1, at: [6, 34], preview: 'assets/previews/lesopilka.jpg', desc: 'Лесопилка у реки: пилорама, штабеля брёвен, бараки рабочих, контора. Тихая окраина — охотничьи ружья и патроны 12 калибра.' },
	podstanciya: { name: 'Кластер «Подстанция»', short: 'Подстанция', kind: 'cluster', danger: 2, at: [60, 38], preview: 'assets/previews/podstanciya.jpg', desc: 'Электроподстанция и посёлок энергетиков: трансформаторы, щитовая, общежитие, гаражи. Топтуны и рубер у трансформаторов.' },
	// внешники — пришлые солдаты с хорошим снаряжением, охотятся на иммунных (game/ext.js); их форпост — глубоко в Улье
	forpost: { name: 'Форпост внешников', short: 'Форпост', kind: 'ext', at: [33, 7], preview: 'assets/previews/forpost.jpg', desc: 'Укреплённый лагерь внешников — пришлых солдат в форме, с хорошим оружием и бронёй. Охотятся на иммунных. В контейнерах склада — их снаряжение: зайти можно, выйти — вряд ли.' },
	nii: { name: 'Кластер «НИИ»', short: 'НИИ', kind: 'cluster', danger: 4, at: [60, 8], preview: 'assets/previews/nii.jpg', desc: 'Закрытый научный городок: лабораторный корпус, виварий, ограда с КПП. Логово элиты — самого опасного мутанта Улья. Редкое оружие и чёрный жемчуг.' },
};

/** Дороги: [откуда, куда, время в пути, с]. */
export const ROUTES = [
	['stab', 'zarechny', 75],
	['stab', 'dachi', 95],
	['zarechny', 'dachi', 60],
	['dachi', 'himmash', 85],
	['zarechny', 'himmash', 80],
	['himmash', 'voench', 90],
	['murs', 'dachi', 100],
	['murs', 'himmash', 90],
	['stab', 'base', 60],
	['base', 'dachi', 75],
	['stab', 'bolnica', 70],
	['bolnica', 'zarechny', 60],
	['dachi', 'lesopilka', 70],
	['lesopilka', 'murs', 80],
	['zarechny', 'podstanciya', 60],
	['podstanciya', 'himmash', 60],
	['podstanciya', 'voench', 90],
	['himmash', 'nii', 90],
	['voench', 'nii', 80],
	['forpost', 'nii', 85],
	['forpost', 'himmash', 100],
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
	return {
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
		},
		murs: newMurs(0),
		base: newBase(0),
		ext: newExt(0),
		horde: newHorde(0), // кочующая стая с вожаком (game/migrant.js)
		quests: newQuests(0), // доска заданий (game/quests.js)
	};
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
