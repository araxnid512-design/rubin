// Торговец стаба: оружие, патроны и живчики за спораны; горох меняется на спораны.
// Пока окно открыто, игра на паузе.

import { ITEMS } from './items.js';
import { WEAPONS, AMMO } from './weapons.js';

/** Прилавок: что продаётся, сколько штук за раз и почём (в споранах); sec — раздел на прилавке. */
export const SHOP = [
	...['axe', 'fireaxe', 'obrez', 'shotgun', 'vector', 'aks', 'ak74', 'ak47', 'svd'].map((id) => ({ id, n: 1, price: WEAPONS[id].price, sec: 'Оружие' })),
	{ id: 'ammo9', n: 8, price: 4, sec: 'Патроны' },
	{ id: 'ammo919', n: 30, price: 10, sec: 'Патроны' },
	{ id: 'ammo12', n: 6, price: 6, sec: 'Патроны' },
	{ id: 'ammo545', n: 30, price: 15, sec: 'Патроны' },
	{ id: 'ammo762', n: 30, price: 18, sec: 'Патроны' },
	{ id: 'ammo76254', n: 10, price: 16, sec: 'Патроны' },
	{ id: 'zhivchik', n: 1, price: 6, sec: 'Разное' },
	{ id: 'grenade', n: 1, price: 10, sec: 'Разное' },
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
		let sec = null;
		$('trade-list').innerHTML = SHOP.map((o, i) => {
			const head = o.sec !== sec ? `<div class="trade-sec">${(sec = o.sec)}</div>` : '';
			const it = ITEMS[o.id], W = WEAPONS[o.id];
			const owned = !!W && g.kit.owned.includes(o.id);
			// топор тупится: изношенный можно сменить на новый
			const wear = owned && W.durability ? g.kit.wear?.[o.id] ?? W.durability : null;
			const renew = wear !== null && wear < W.durability;
			let have = `есть: ${bag[o.id] ?? 0}`;
			if (W?.ammo) have = `${AMMO[W.ammo]} · урон ${W.damage}${W.pellets ? `×${W.pellets}` : ''}`;
			if (W) have = owned ? (wear !== null ? `прочность ${wear}/${W.durability}` : 'уже есть') : W.ammo ? have : `урон ${W.damage} · ${W.durability} ударов`;
			const label = renew ? `Новый · ${o.price} сп.` : owned ? (wear !== null ? 'Целый' : 'Куплено') : `${o.price} сп.`;
			const off = (owned && !renew) || spores < o.price;
			return `${head}<div class="offer${owned && !renew ? ' owned' : ''}">
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
