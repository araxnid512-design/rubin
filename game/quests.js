// Доска заданий: на площади базы «Опорный» и в стабе «Полис» висят поручения — принести вещи, убить сильных
// заражённых, перебить муров или внешников, зачистить кластер, найти пропавшего (принести его жетон), убить вожака
// кочующей стаи. Одновременно — до трёх взятых; выполненное сдают на любой доске (вещи для «принеси» отдаются там же),
// награда — спораны, иногда и вещь. Предложения обновляются раз в 20 минут времени мира. Учёт — world.quests;
// ход заданий ведёт game/main.js (questEvent), окно — QuestWindow.

import { NODES } from './world.js';
import { ITEMS, plural } from './items.js';

/** Сколько предложений на доске, сколько можно взять разом, раз во сколько секунд мира доска обновляется. */
export const QUEST_OFFERS = 3, QUEST_ACTIVE = 3, QUEST_REFRESH = 1200;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clusters = () => Object.keys(NODES).filter((id) => NODES[id].kind === 'cluster');
const ENEMY_NAMES = { stomper: ['топтуна', 'топтунов', 'топтунов'], ruber: ['рубера', 'руберов', 'руберов'], elite: ['элиту', 'элиты', 'элит'], skreber: ['скребера', 'скреберов', 'скреберов'] };
const FACTION_NAMES = { murs: ['мура', 'муров', 'муров'], ext: ['внешника', 'внешников', 'внешников'] };
/** Что просят принести: [вид, сколько, споранов за штуку]. */
// «Принеси»: награда за штуку — ниже цены торговца (живчик 5,4 за штуку пачкой, 5,45 — 0,5, 7,62 — 0,56, граната 10,
// 12 кал. — 0,875) и выше цены продажи ему (40 %): купить и сдать — в убыток, принести найденное — выгоднее продажи.
// Горох торговец не продаёт (меняет по 5 споранов) — за него больше.
const FETCH = [['peas', [3, 6], 7], ['zhivchik', [2, 3], 4.4], ['ammo545', [60, 90], 0.42], ['ammo762', [45, 75], 0.46], ['grenade', [1, 2], 8], ['ammo12', [16, 24], 0.72],
	// ресурсы (game/economy.js): бензин с нефтебазы, химия из больниц, детали — на заводах
	['fuel', [2, 4], 11], ['chem', [3, 5], 6], ['parts', [3, 5], 8], ['food', [6, 10], 3.5]];

/** Доска в новом мире: три предложения. */
export function newQuests(time = 0) {
	const q = { offers: [], active: [], next: time + QUEST_REFRESH, seq: 0, done: 0 };
	while (q.offers.length < QUEST_OFFERS) q.offers.push(makeQuest(q));
	return q;
}

export function normalizeQuests(q, time) {
	if (!q || typeof q !== 'object') return newQuests(time);
	q.offers ??= []; q.active ??= []; q.seq ??= 0; q.done ??= 0; q.next ??= time + QUEST_REFRESH;
	return q;
}

/** Новое поручение: вид, текст, сколько нужно, награда. horde — есть ли сейчас кочующая стая. */
export function makeQuest(q, horde = false) {
	const id = ++q.seq, roll = Math.random();
	if (horde && roll < 0.12) return { id, kind: 'horde', n: 1, got: 0, reward: { spore: 250, pearl: 1 } };
	if (roll < 0.3) {
		const [item, [a, b], per] = pick(FETCH), n = ri(a, b);
		return { id, kind: 'fetch', item, n, got: 0, reward: { spore: Math.max(8, Math.round(n * per)) } };
	}
	if (roll < 0.5) {
		const type = pick(['stomper', 'stomper', 'ruber', 'ruber', 'elite']), n = type === 'stomper' ? ri(2, 4) : type === 'ruber' ? ri(1, 2) : 1;
		return { id, kind: 'kill', type, n, got: 0, reward: { spore: n * { stomper: 20, ruber: 60, elite: 220 }[type], ...(type !== 'stomper' ? { grenade: 1 } : {}) } };
	}
	if (roll < 0.65) {
		const at = pick(clusters()), d = NODES[at].danger ?? 1, n = ri(15, 25);
		return { id, kind: 'clear', at, n, got: 0, reward: { spore: 40 + n * 2 + d * 15, zhivchik: 1 } };
	}
	if (roll < 0.82) {
		const faction = Math.random() < 0.65 ? 'murs' : 'ext', n = faction === 'murs' ? ri(3, 6) : ri(2, 4);
		return { id, kind: 'bandits', faction, n, got: 0, reward: { spore: n * (faction === 'murs' ? 16 : 30), ...(faction === 'ext' ? { ammo556: 30 } : {}) } };
	}
	const at = pick(clusters()), d = NODES[at].danger ?? 1;
	return { id, kind: 'find', at, n: 1, got: 0, reward: { spore: 50 + d * 25 } };
}

/** Текст поручения (с ходом выполнения для взятых). */
export function questText(t, bag = null) {
	const prog = (got) => ` — ${Math.min(got, t.n)}/${t.n}`;
	if (t.kind === 'fetch') return `Принеси ${t.n} ${plural(t.n, ITEMS[t.item].forms)}${bag ? ` — есть ${Math.min(bag[t.item] ?? 0, t.n)}/${t.n}` : ''}`;
	if (t.kind === 'kill') return `Убей ${t.n} ${plural(t.n, ENEMY_NAMES[t.type])} в любом кластере${bag ? prog(t.got) : ''}`;
	if (t.kind === 'clear') return `Зачисти кластер «${NODES[t.at].short}»: убей там ${t.n} заражённых${bag ? prog(t.got) : ''}`;
	if (t.kind === 'bandits') return `Убей ${t.n} ${plural(t.n, FACTION_NAMES[t.faction])}${bag ? prog(t.got) : ''}`;
	if (t.kind === 'find') return `В кластере «${NODES[t.at].short}» пропал человек — найди его тело и принеси жетон${bag ? (t.got ? ' — жетон у тебя' : ' — не найден') : ''}`;
	return `Убей вожака кочующей стаи${bag ? prog(t.got) : ''}`;
}

/** Награда строкой: «120 споранов, граната». */
export function rewardText(r) {
	return Object.entries(r).map(([k, n]) => `${n} ${plural(n, ITEMS[k].forms ?? ['шт.', 'шт.', 'шт.'])}`).join(', ');
}

/** Можно сдать: собрано нужное (для «принеси» — нужное есть в рюкзаке). */
export function questReady(t, bag) {
	return t.kind === 'fetch' ? (bag[t.item] ?? 0) >= t.n : t.got >= t.n;
}

/** Время дошло до now: доска обновляется (новые предложения вместо старых). */
export function refreshQuests(q, now, horde = false) {
	if (now < q.next && q.offers.length >= QUEST_OFFERS) return false;
	q.next = now + QUEST_REFRESH;
	q.offers = [];
	while (q.offers.length < QUEST_OFFERS) q.offers.push(makeQuest(q, horde));
	return true;
}

/**
 * Событие в игре — ход взятых заданий. ev: { kind: 'kill', type, at } — убит заражённый (at — где);
 * { kind: 'bandit', faction }; { kind: 'horde' } — убит вожак стаи; { kind: 'tag', at } — подобран жетон.
 * Возвращает задания, которые этим событием выполнены.
 */
export function questProgress(q, ev) {
	const done = [];
	for (const t of q.active) {
		if (t.got >= t.n) continue;
		let hit = false;
		if (ev.kind === 'kill' && t.kind === 'kill' && ev.type === t.type) hit = true;
		if (ev.kind === 'kill' && t.kind === 'clear' && ev.at === t.at) hit = true;
		if (ev.kind === 'bandit' && t.kind === 'bandits' && ev.faction === t.faction) hit = true;
		if (ev.kind === 'horde' && t.kind === 'horde') hit = true;
		if (ev.kind === 'tag' && t.kind === 'find' && ev.at === t.at) hit = true;
		if (!hit) continue;
		t.got++;
		if (t.got >= t.n) done.push(t);
	}
	return done;
}

const $ = (id) => document.getElementById(id);

/**
 * Окно доски: взятые (ход, «Сдать», «Отказаться») и предложения («Взять»). Пока открыто — пауза.
 * game: { world, bag, takeQuest(id), turnInQuest(id), dropQuest(id), setPaused(bool) }
 */
export class QuestWindow {
	constructor(game) {
		this.game = game;
		this.el = $('quests');
		$('quests-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('quests-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-q]');
			if (!b || b.disabled) return;
			const id = +b.dataset.id, g = this.game;
			if (b.dataset.q === 'take') g.takeQuest(id);
			if (b.dataset.q === 'turn') g.turnInQuest(id);
			if (b.dataset.q === 'drop') g.dropQuest(id);
			this.render();
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	open(where = 'Доска заданий') {
		if (this.isOpen) return;
		this.where = where;
		this.el.classList.remove('hidden');
		this.game.setPaused(true);
		this.render();
	}

	close() {
		if (!this.isOpen) return;
		this.el.classList.add('hidden');
		this.game.setPaused(false);
	}

	render() {
		const g = this.game, q = g.world.quests, bag = g.bag, full = q.active.length >= QUEST_ACTIVE;
		$('quests-where').textContent = `${this.where} · выполнено ${q.done} · игра на паузе`;
		const card = (t, mine) => `<div class="offer quest${mine && questReady(t, bag) ? ' ready' : ''}">
			<div class="offer-text"><b>${questText(t, mine ? bag : null)}</b><span class="gives">Награда: ${rewardText(t.reward)}</span></div>
			<div class="sell-btns">${mine
				? `<button class="buy" data-q="turn" data-id="${t.id}" ${questReady(t, bag) ? '' : 'disabled'}>Сдать</button><button class="stay small" data-q="drop" data-id="${t.id}">Отказаться</button>`
				: `<button class="buy" data-q="take" data-id="${t.id}" ${full ? 'disabled' : ''}>Взять</button>`}</div></div>`;
		$('quests-list').innerHTML = `<div class="trade-sec">Взятые (${q.active.length}/${QUEST_ACTIVE})</div>${q.active.map((t) => card(t, true)).join('') || '<div class="muted">Пока ничего не взято.</div>'}`
			+ `<div class="trade-sec">На доске</div>${q.offers.map((t) => card(t, false)).join('') || '<div class="muted">Всё разобрали — новые поручения повесят позже.</div>'}`;
	}
}
