// Хранилище в комнате героя (стаб): оружие, патроны, гранаты и живчики, сложенные сюда, при гибели не пропадают —
// пропадает только то, что было с собой. Валюту (спораны, горох, чёрный жемчуг) класть не нужно: она остаётся
// при герое и после смерти. Пока окно открыто, игра на паузе.

import { ITEMS, BAG_ORDER, plural } from './items.js';
import { WEAPONS } from './weapons.js';

/** Валюта: при гибели остаётся с героем, в хранилище не кладётся. */
export const CURRENCY = ['spore', 'peas', 'pearl'];
/** Что из рюкзака можно сложить (всё, кроме валюты). */
export const STORABLE = BAG_ORDER.filter((k) => !CURRENCY.includes(k));

/** Пустое хранилище: bag — расходники по видам, guns — оружие: id → { mag, wear }. */
export const newStash = () => ({ bag: {}, guns: {} });

/** Хранилище из старого сохранения (или его отсутствия). */
export function normalizeStash(s) {
	const st = s && typeof s === 'object' ? s : newStash();
	st.bag ??= {};
	st.guns ??= {};
	for (const id of Object.keys(st.guns)) if (!WEAPONS[id] || id === 'fists') delete st.guns[id];
	return st;
}

const $ = (id) => document.getElementById(id);

export class StashWindow {
	/** game: { bag, kit, stash, icons, store(kind), take(kind), storeAll(), takeAll(), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('stash');
		$('stash-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		this.el.addEventListener('click', (e) => {
			const b = e.target.closest('[data-store],[data-take]');
			if (!b || b.disabled) return;
			if (b.dataset.store) this.game.store(b.dataset.store); else this.game.take(b.dataset.take);
			this.render();
		});
		$('stash-store-all').onclick = () => { this.game.storeAll(); this.render(); };
		$('stash-take-all').onclick = () => { this.game.takeAll(); this.render(); };
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	open() {
		if (this.isOpen) return;
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
		const g = this.game, icons = g.icons ?? {};
		const row = (kind, text, sub, btn) => `<div class="offer">
			<div class="offer-icon">${icons[kind] ? `<img src="${icons[kind]}" alt="">` : ''}</div>
			<div class="offer-text"><b>${text}</b><span>${sub}</span></div>${btn}</div>`;
		const count = (k, n) => `${n} ${plural(n, ITEMS[k].forms ?? ['шт.', 'шт.', 'шт.'])}`;
		const gunSub = (id, st) => {
			const W = WEAPONS[id];
			if (W.durability) return `прочность ${st.wear ?? W.durability}/${W.durability}`;
			return W.ammo ? `в магазине ${st.mag ?? 0}` : '';
		};
		const kit = g.kit;
		// с собой: оружие (кроме кулаков) и расходники
		const mine = kit.owned.filter((id) => id !== 'fists').map((id) => {
			const where = Object.values(kit.gear).includes(id) ? 'в руках / на теле' : 'в рюкзаке';
			return row(id, WEAPONS[id].name, `${where} · ${gunSub(id, { mag: kit.mags[id], wear: kit.wear[id] })}`, `<button class="buy" data-store="${id}">В хранилище →</button>`);
		}).concat(STORABLE.filter((k) => (g.bag[k] ?? 0) > 0).map((k) => row(k, ITEMS[k].name, count(k, g.bag[k]), `<button class="buy" data-store="${k}">В хранилище →</button>`)));
		const kept = Object.entries(g.stash.guns).map(([id, st]) => row(id, WEAPONS[id].name, gunSub(id, st), `<button class="buy" data-take="${id}">← Взять</button>`))
			.concat(STORABLE.filter((k) => (g.stash.bag[k] ?? 0) > 0).map((k) => row(k, ITEMS[k].name, count(k, g.stash.bag[k]), `<button class="buy" data-take="${k}">← Взять</button>`)));
		$('stash-mine').innerHTML = mine.join('') || '<div class="muted">С собой ничего, кроме кулаков и валюты.</div>';
		$('stash-kept').innerHTML = kept.join('') || '<div class="muted">Пусто. Купи у торговца оружие и патроны про запас и сложи сюда — при гибели они не пропадут.</div>';
		$('stash-store-all').disabled = !mine.length;
		$('stash-take-all').disabled = !kept.length;
		$('stash-wallet').textContent = `Спораны ${g.bag.spore ?? 0} · горох ${g.bag.peas ?? 0} · жемчуг ${g.bag.pearl ?? 0}`;
	}
}
