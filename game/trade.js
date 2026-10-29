// Торговец стаба: оружие, патроны и живчики за спораны; горох меняется на спораны.
// Пока окно открыто, игра на паузе.

import { ITEMS } from './items.js';
import { WEAPONS } from './weapons.js';

/** Прилавок: что продаётся, сколько штук за раз и почём (в споранах). */
export const SHOP = [
	{ id: 'ammo9', n: 8, price: 4 },
	{ id: 'ammo12', n: 6, price: 6 },
	{ id: 'ammo545', n: 30, price: 15 },
	{ id: 'zhivchik', n: 1, price: 6 },
	{ id: 'axe', n: 1, price: WEAPONS.axe.price },
	{ id: 'fireaxe', n: 1, price: WEAPONS.fireaxe.price },
	{ id: 'obrez', n: 1, price: WEAPONS.obrez.price },
	{ id: 'aks', n: 1, price: WEAPONS.aks.price },
];
/** Сколько споранов даёт торговец за горошину. */
export const PEA_RATE = 5;

const $ = (id) => document.getElementById(id);

export class Trade {
	/** game: { bag, kit: { owned, wear }, icons, buy(offer), exchangePeas(n), setPaused(bool), player } */
	constructor(game) {
		this.game = game;
		this.el = $('trade');
		$('trade-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('trade-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-buy]');
			if (b && !b.disabled) { this.game.buy(SHOP[+b.dataset.buy]); this.render(); }
		});
		$('trade-peas-1').onclick = () => { this.game.exchangePeas(1); this.render(); };
		$('trade-peas-all').onclick = () => { this.game.exchangePeas(this.game.bag.peas ?? 0); this.render(); };
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
		const g = this.game, bag = g.bag, icons = g.icons ?? {};
		const spores = bag.spore ?? 0, peas = bag.peas ?? 0;
		$('trade-spores').textContent = spores;
		$('trade-peas').textContent = peas;
		$('trade-list').innerHTML = SHOP.map((o, i) => {
			const it = ITEMS[o.id], W = WEAPONS[o.id];
			const owned = !!W && g.kit.owned.includes(o.id);
			// топор тупится: изношенный можно сменить на новый
			const wear = owned && W.durability ? g.kit.wear?.[o.id] ?? W.durability : null;
			const renew = wear !== null && wear < W.durability;
			let have = `есть: ${bag[o.id] ?? 0}`;
			if (W) have = owned ? (wear !== null ? `прочность ${wear}/${W.durability}` : 'уже есть') : `урон ${W.damage}${W.pellets ? `×${W.pellets}` : ''}${W.durability ? ` · ${W.durability} ударов` : ''}`;
			const label = renew ? `Новый · ${o.price} сп.` : owned ? (wear !== null ? 'Целый' : 'Куплено') : `${o.price} сп.`;
			const off = (owned && !renew) || spores < o.price;
			return `<div class="offer${owned && !renew ? ' owned' : ''}">
				<div class="offer-icon">${icons[o.id] ? `<img src="${icons[o.id]}" alt="">` : ''}</div>
				<div class="offer-text"><b>${o.n > 1 ? `${it.name} ×${o.n}` : it.name}</b><span>${have}</span></div>
				<button class="buy" data-buy="${i}" ${off ? 'disabled' : ''}>${label}</button>
			</div>`;
		}).join('');
		$('trade-peas-1').disabled = peas < 1;
		$('trade-peas-all').disabled = peas < 2;
		$('trade-peas-all').textContent = peas > 1 ? `Все ${peas} → ${peas * PEA_RATE}` : 'Все';
	}
}
