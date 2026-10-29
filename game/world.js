// Карта мира: стаб и кластеры вокруг, дороги между ними, время мира и перезагрузки кластеров.
// Кластер — кусок Земли, который Улей раз в 5–7 минут подменяет свежей копией: всё, что внутри
// (и все, кто внутри), исчезает. Стаб — стабильный участок, он не перезагружается.
// Время мира идёт, пока герой в локации, и прыгает вперёд на время дороги.
// preview — снимок локации (scripts/render-previews.mjs) для карты Улья.

export const NODES = {
	stab: { name: 'Стаб «Полис»', short: 'Полис', kind: 'stab', at: [50, 74], preview: 'assets/previews/stab.jpg', desc: 'Стабильная территория: торговец, лекарь, охрана. Не перезагружается.' },
	zarechny: { name: 'Кластер «Заречный»', short: 'Заречный', kind: 'cluster', at: [76, 32], preview: 'assets/previews/zarechny.jpg', desc: 'Посёлок у трассы: хрущёвка, гаражи, частные дома, магазин. Патроны 9×18 в домах.' },
	dachi: { name: 'Кластер «Дачи»', short: 'Дачи', kind: 'cluster', at: [24, 30], preview: 'assets/previews/dachi.jpg', desc: 'Садовое товарищество: домики, теплицы, сторожка. Охотничьи патроны 12 калибра, обрезы.' },
};

/** Дороги: [откуда, куда, время в пути, с]. */
export const ROUTES = [
	['stab', 'zarechny', 75],
	['stab', 'dachi', 95],
	['zarechny', 'dachi', 60],
];

/** Сколько живёт кластер между перезагрузками, с. */
export const CYCLE = [300, 420];
/** Последняя минута: кислый запах, муть сгущается. */
export const WARN = 60;

const rand = (a, b) => a + Math.random() * (b - a);

export function routesFrom(id) {
	return ROUTES.filter(([a, b]) => a === id || b === id).map(([a, b, t]) => ({ to: a === id ? b : a, time: t }));
}

export function travelTime(from, to) {
	return ROUTES.find(([a, b]) => (a === from && b === to) || (a === to && b === from))?.[2] ?? 120;
}

/** Новый мир: герой в Заречном, до перезагрузки — 6 минут; Дачи — в случайной фазе. */
export function newWorld() {
	return {
		time: 0,
		at: 'zarechny',
		clusters: {
			zarechny: { next: 360, saved: null, reloads: 0 },
			dachi: { next: rand(90, CYCLE[1]), saved: null, reloads: 0 },
		},
	};
}

/**
 * Время мира идёт на dt. Кластеры, чей срок вышел, перезагружаются: сохранённое состояние
 * (убитые, обысканное, лежащее на земле) пропадает, новый срок — 5–7 минут. Возвращает id перезагрузившихся.
 */
export function advance(world, dt) {
	world.time += dt;
	const reloaded = [];
	for (const [id, c] of Object.entries(world.clusters)) {
		while (world.time >= c.next) {
			c.next += rand(...CYCLE);
			c.saved = null;
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
