// Кочующая стая: сильный мутант — рубер или элита — собрал вокруг себя большую стаю и водит её по Улью: постоит в
// кластере 7–12 минут и уходит в соседний (по дорогам карты), бывает — и к базе героя (там это нападение). В кластере,
// где герой, стая не уходит, пока он там: её можно найти и убить вожака — тогда стая распадается, а новый сильный
// соберёт свою не скоро. Где сейчас стая и куда пойдёт — знает информатор в «Полисе»; радио базы слышит, когда она
// идёт к базе. Здесь — учёт (world.horde); бой и живая стая — game/main.js (spawnHorde, hordeArrived).

import { NODES, routesFrom } from './world.js';

/** Когда соберётся первая стая и через сколько после гибели вожака — новая, с. */
export const HORDE_FIRST = [600, 1500];
export const HORDE_GAP = [1800, 3000];
/** Сколько стая стоит в кластере перед переходом, с. */
export const HORDE_STAY = [420, 720];
/** Сколько голов в стае (с вожаком) и шанс, что водит элита, а не рубер. */
export const HORDE_SIZE = [12, 18];
export const HORDE_ELITE = 0.35;
/** Клички вожаков — так их зовут в стабе. */
export const HORDE_NAMES = ['Хромой', 'Рваный', 'Крюк', 'Шатун', 'Пастух', 'Бугор', 'Мясник', 'Горбун'];

const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/** Стаи пока нет: соберётся через 10–25 минут. */
export function newHorde(time = 0) {
	return { at: null, to: null, from: null, next: time + rand(...HORDE_FIRST), lead: null, name: null, size: 0, known: false };
}

export function normalizeHorde(h, time) {
	if (!h || typeof h !== 'object') return newHorde(time);
	h.next ??= time + rand(...HORDE_FIRST);
	h.size ??= 0;
	if (h.at && !NODES[h.at]) h.at = null;
	return h;
}

/** Куда пойдёт стая из at (не назад, если есть куда ещё): кластеры и база героя; к базе — реже. */
export function nextStop(at, from = null) {
	const ways = routesFrom(at).map((r) => r.to).filter((id) => NODES[id].kind === 'cluster' || NODES[id].kind === 'base');
	let pool = ways.filter((id) => id !== from);
	if (!pool.length) pool = ways;
	if (!pool.length) return at;
	const w = pool.map((id) => (NODES[id].kind === 'base' ? 0.5 : 1));
	let k = Math.random() * w.reduce((a, b) => a + b, 0);
	for (let i = 0; i < pool.length; i++) { k -= w[i]; if (k <= 0) return pool[i]; }
	return pool[0];
}

/**
 * Время мира дошло до now. here — где герой: оттуда стая не уходит, пока он там. Возвращает события:
 * { spawned: at } — собралась стая; { moved: { from, to } } — перешла (to может быть 'base' — нападение на базу).
 */
export function tickHorde(h, now, here) {
	const events = [];
	if (!h.at) {
		if (now < h.next) return events;
		const clusters = Object.keys(NODES).filter((id) => NODES[id].kind === 'cluster' && (NODES[id].danger ?? 1) >= 2);
		h.at = clusters[Math.floor(Math.random() * clusters.length)];
		h.from = null;
		h.lead = Math.random() < HORDE_ELITE ? 'elite' : 'ruber';
		h.name = HORDE_NAMES[Math.floor(Math.random() * HORDE_NAMES.length)];
		h.size = ri(...HORDE_SIZE);
		h.next = now + rand(...HORDE_STAY);
		h.to = nextStop(h.at);
		h.known = false;
		events.push({ spawned: h.at });
		return events;
	}
	if (now < h.next) return events;
	// герой в одном кластере со стаей — она никуда не уходит, пока он там
	if (h.at === here) { h.next = now + 60; return events; }
	const from = h.at;
	h.at = h.to ?? nextStop(from);
	h.from = from;
	h.to = nextStop(h.at, from);
	// у базы стая не задерживается: нападение — и дальше
	h.next = now + (NODES[h.at].kind === 'base' ? 90 : rand(...HORDE_STAY));
	h.known = false;
	events.push({ moved: { from, to: h.at } });
	return events;
}

/** Вожак убит: стая распалась, новая соберётся не скоро. */
export function hordeBroken(h, now) {
	Object.assign(h, { at: null, to: null, from: null, lead: null, size: 0, known: false, next: now + rand(...HORDE_GAP) });
}

/** Что скажет об этом информатор. approx — «~2 мин». */
export function hordeText(h, now, approx) {
	if (!h.at) return 'Большой стаи сейчас нет: сильные бродят поодиночке. Но это ненадолго — какой-нибудь рубер соберёт своих. Заходи позже.';
	const who = h.lead === 'elite' ? 'элита' : 'рубер';
	const where = NODES[h.at].kind === 'base' ? 'у твоей базы' : `в кластере «${NODES[h.at].short}»`;
	const next = h.to && h.to !== h.at ? ` Скоро двинется — скорее всего в ${NODES[h.to].kind === 'base' ? 'сторону твоей базы' : `«${NODES[h.to].short}»`}, примерно через ${approx(Math.max(0, h.next - now))}.` : '';
	return `Стаю голов в ${h.size} водит ${who} по кличке «${h.name}» — сейчас ${where}.${next} Убьёшь вожака — стая разбежится. Отметил на карте.`;
}
