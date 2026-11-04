// Торговец стаба: оружие, патроны и живчики за спораны; горох и чёрный жемчуг меняются на спораны. Вкладка
// «Продать»: оружие, что при себе (не в хранилище), патроны и гранаты — за долю цены прилавка (SELL_RATE).
// Пока окно открыто, игра на паузе.

import { ITEMS } from './items.js';
import { WEAPONS, AMMO } from './weapons.js';

/** Прилавок: что продаётся, сколько штук за раз и почём (в споранах); sec — раздел на прилавке. */
export const SHOP = [
	...['fireaxe', 'glock17', 'deagle', 'dbarrel', 'spas12', 'mp5', 'aks', 'ak74', 'ak47', 'ak107', 'g36', 'aug', 'fnfal', 'rpk', 'svd', 'awm']
		.map((id) => ({ id, n: 1, price: WEAPONS[id].price, sec: 'Оружие' })),
	...['ksvk', 'rg6', 'rpg7'].map((id) => ({ id, n: 1, price: WEAPONS[id].price, sec: 'Тяжёлое оружие' })),
	{ id: 'ammo127', n: 5, price: 22, sec: 'Тяжёлое оружие' },
	{ id: 'vog25', n: 6, price: 42, sec: 'Тяжёлое оружие' },
	{ id: 'rocket', n: 1, price: 30, sec: 'Тяжёлое оружие' },
	{ id: 'ammo919', n: 17, price: 6, sec: 'Патроны' },
	{ id: 'ammo919', n: 60, price: 18, sec: 'Патроны' },
	{ id: 'ammo50', n: 7, price: 8, sec: 'Патроны' },
	{ id: 'ammo12', n: 8, price: 7, sec: 'Патроны' },
	{ id: 'ammo545', n: 30, price: 15, sec: 'Патроны' },
	{ id: 'ammo556', n: 30, price: 16, sec: 'Патроны' },
	{ id: 'ammo762', n: 30, price: 18, sec: 'Патроны' },
	{ id: 'ammo762', n: 75, price: 42, sec: 'Патроны' }, // барабан к РПК
	{ id: 'ammo76251', n: 20, price: 20, sec: 'Патроны' },
	{ id: 'ammo76254', n: 10, price: 16, sec: 'Патроны' },
	{ id: 'medkit', n: 1, price: 8, sec: 'Разное' },
	{ id: 'zhivchik', n: 1, price: 6, sec: 'Разное' },
	{ id: 'zhivchik', n: 5, price: 27, sec: 'Разное' },
	{ id: 'grenade', n: 1, price: 10, sec: 'Разное' },
];
/** Торговец покупает за такую долю цены прилавка (топор — ещё и по износу). */
export const SELL_RATE = 0.4;
/** Что можно продать, кроме оружия: патроны всех калибров и гранаты. */
export const SELLABLE = [...Object.keys(AMMO), 'grenade'];
/** Пачка вида kind на прилавке (самая маленькая): { n, price } — по ней считается цена продажи. */
export function packOf(kind) {
	return SHOP.filter((o) => o.id === kind).sort((a, b) => a.n - b.n)[0] ?? null;
}
/** Сколько споранов торговец даст за n штук вида kind (не меньше 1, если вообще покупает). */
export function sellPrice(kind, n = 1, wear = null) {
	const W = WEAPONS[kind];
	if (W) return Math.max(1, Math.round(W.price * SELL_RATE * (W.durability && wear !== null ? wear / W.durability : 1)));
	const p = packOf(kind);
	return p ? Math.floor((p.price / p.n) * n * SELL_RATE) : 0;
}
/** Сколько штук продаётся одной кнопкой «пачка»: пачка прилавка, но так, чтобы вышел хотя бы 1 споран. */
export function sellPack(kind) {
	const p = packOf(kind);
	if (!p) return 0;
	let n = p.n;
	while (sellPrice(kind, n) < 1) n += p.n;
	return n;
}

/** Сколько споранов даёт торговец за горошину. */
export const PEA_RATE = 5;
/** Сколько споранов даёт торговец за чёрную жемчужину. */
export const PEARL_PRICE = 150;

const $ = (id) => document.getElementById(id);

export class Trade {
	/** game: { bag, kit: { owned, wear }, icons, buy(offer), sell(kind, n), exchangePeas(n), sellPearl(), setPaused(bool), player } */
	constructor(game) {
		this.game = game;
		this.mode = 'buy';
		this.el = $('trade');
		for (const b of document.querySelectorAll('#trade-tabs [data-mode]')) b.onclick = () => { this.mode = b.dataset.mode; this.render(); };
		$('trade-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('trade-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-buy]');
			if (b && !b.disabled) { const o = SHOP[+b.dataset.buy]; this.game.buy({ ...o, price: this.price(o) }); this.render(); }
			const s = e.target.closest('[data-sell]');
			if (s && !s.disabled) { this.game.sell(s.dataset.sell, +s.dataset.n); this.render(); }
		});
		$('trade-peas-1').onclick = () => { this.game.exchangePeas(1); this.render(); };
		$('trade-peas-all').onclick = () => { this.game.exchangePeas(this.game.bag.peas ?? 0); this.render(); };
		$('trade-pearl').onclick = () => { this.game.sellPearl(); this.render(); };
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	/** Цена предложения с учётом скидки (у оружейника базы — дешевле). */
	price(o) { return Math.max(1, Math.ceil(o.price * (this.discount ?? 1))); }

	/** armory — лавка оружейника на базе: те же товары на 20 % дешевле (base.js perks.discount). */
	open({ armory = false } = {}) {
		if (this.isOpen) return;
		this.discount = armory ? this.game.basePerks?.().discount ?? 0.8 : 1;
		this.el.querySelector('.inv-head b').textContent = armory ? 'Оружейник' : 'Торговец';
		this.el.querySelector('.inv-head .muted').textContent = armory ? 'база «Опорный» · на 20 % дешевле · игра на паузе' : 'стаб «Полис» · игра на паузе';
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
		const g = this.game, bag = g.bag, icons = g.icons ?? {};
		const spores = bag.spore ?? 0, peas = bag.peas ?? 0;
		$('trade-spores').textContent = spores;
		$('trade-peas').textContent = peas;
		for (const b of document.querySelectorAll('#trade-tabs [data-mode]')) b.classList.toggle('on', b.dataset.mode === this.mode);
		if (this.mode === 'sell') { $('trade-list').innerHTML = this.sellList(); this.renderExchange(); return; }
		let sec = null;
		$('trade-list').innerHTML = SHOP.map((o, i) => {
			const head = o.sec !== sec ? `<div class="trade-sec">${(sec = o.sec)}</div>` : '';
			const it = ITEMS[o.id], W = WEAPONS[o.id];
			const stored = !!W && !!g.stash?.guns[o.id];
			const owned = !!W && (g.kit.owned.includes(o.id) || stored);
			// топор тупится: изношенный можно сменить на новый
			const wear = owned && W.durability ? g.kit.wear?.[o.id] ?? W.durability : null;
			const renew = !stored && wear !== null && wear < W.durability;
			let have = `есть: ${bag[o.id] ?? 0}`;
			if (W?.ammo) have = `${AMMO[W.ammo]} · урон ${W.damage}${W.pellets ? `×${W.pellets}` : ''}`;
			if (W?.blast) have = `${AMMO[W.ammo]} · разрыв ${String(W.blast.r).replace('.', ',')} м`;
			if (W?.pierce) have += ' · насквозь';
			if (W) have = stored ? 'лежит в хранилище' : owned ? (wear !== null ? `прочность ${wear}/${W.durability}` : 'уже есть') : W.ammo ? have : `урон ${W.damage} · ${W.durability} ударов`;
			const price = this.price(o);
			const label = renew ? `Новый · ${price} сп.` : stored ? 'В хранилище' : owned ? (wear !== null ? 'Целый' : 'Куплено') : `${price} сп.`;
			const off = (owned && !renew) || spores < price;
			return `${head}<div class="offer${owned && !renew ? ' owned' : ''}">
				<div class="offer-icon">${icons[o.id] ? `<img src="${icons[o.id]}" alt="">` : ''}</div>
				<div class="offer-text"><b>${o.n > 1 ? `${it.name} ×${o.n}` : it.name}</b><span>${have}</span></div>
				<button class="buy" data-buy="${i}" ${off ? 'disabled' : ''}>${label}</button>
			</div>`;
		}).join('');
		this.renderExchange();
	}

	/** Вкладка «Продать»: оружие при себе и патроны с гранатами из рюкзака. */
	sellList() {
		const g = this.game, bag = g.bag, kit = g.kit, icons = g.icons ?? {};
		const card = (id, title, sub, buttons) => `<div class="offer">
			<div class="offer-icon">${icons[id] ? `<img src="${icons[id]}" alt="">` : ''}</div>
			<div class="offer-text"><b>${title}</b><span>${sub}</span></div>
			<div class="sell-btns">${buttons}</div>
		</div>`;
		const btn = (id, n, price, text) => `<button class="buy" data-sell="${id}" data-n="${n}" ${price < 1 ? 'disabled' : ''}>${text} · ${price} сп.</button>`;
		const guns = kit.owned.filter((id) => WEAPONS[id] && id !== 'fists').map((id) => {
			const W = WEAPONS[id], wear = W.durability ? kit.wear?.[id] ?? W.durability : null;
			const where = Object.values(kit.gear).includes(id) ? 'в слоте' : 'в рюкзаке';
			const mag = W.ammo && kit.mags[id] ? ` · в магазине ${kit.mags[id]} — вернутся в рюкзак` : '';
			return card(id, W.name, `${where}${wear !== null ? ` · прочность ${wear}/${W.durability}` : ''}${mag}`, btn(id, 1, sellPrice(id, 1, wear), 'Продать'));
		});
		const goods = SELLABLE.filter((k) => (bag[k] ?? 0) > 0).map((k) => {
			const n = bag[k], pack = sellPack(k), it = ITEMS[k];
			const b = (pack && pack < n ? btn(k, pack, sellPrice(k, pack), `${pack} шт.`) : '') + btn(k, n, sellPrice(k, n), n > 1 ? `Все ${n}` : '1 шт.');
			return card(k, it.name, `есть: ${n}`, b);
		});
		const sec = (t) => `<div class="trade-sec">${t}</div>`;
		const empty = (t) => `<div class="muted sell-empty">${t}</div>`;
		return sec('Оружие при себе') + (guns.length ? guns.join('') : empty('Нечего продать: оружие в хранилище продаётся, только если взять его с собой'))
			+ sec('Патроны и гранаты') + (goods.length ? goods.join('') : empty('Патронов и гранат нет'));
	}

	renderExchange() {
		const bag = this.game.bag, peas = bag.peas ?? 0;
		$('trade-peas-1').disabled = peas < 1;
		$('trade-peas-all').disabled = peas < 2;
		$('trade-peas-all').textContent = peas > 1 ? `Все ${peas} → ${peas * PEA_RATE}` : 'Все';
		const pearls = bag.pearl ?? 0;
		$('trade-pearls').textContent = pearls;
		$('trade-pearl').disabled = pearls < 1;
	}
}
