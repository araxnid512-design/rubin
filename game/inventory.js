// Рюкзак в духе Last Day on Earth: слева герой в полный рост и оружие (что в руках),
// в центре ячейки рюкзака с количеством, справа описание выбранного предмета и действие.
// Пока рюкзак открыт, игра на паузе.

import { ITEMS, BAG_ORDER, plural } from './items.js';

const SLOTS = 15;
const $ = (id) => document.getElementById(id);

export class Inventory {
	/**
	 * game: { player, bag, icons, figure(weapon), drink(), equip(weapon), setPaused(bool) }
	 */
	constructor(game) {
		this.game = game;
		this.el = $('inventory');
		this.selected = 'ammo';
		$('inv-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('inv-grid').addEventListener('click', (e) => {
			const slot = e.target.closest('[data-item]');
			if (slot) this.select(slot.dataset.item);
		});
		$('inv-equip').addEventListener('click', (e) => {
			const slot = e.target.closest('[data-item]');
			if (slot) this.select(slot.dataset.item);
		});
		$('inv-action').onclick = () => this.act();
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	open() {
		const g = this.game;
		if (this.isOpen || !g.player?.alive) return;
		this.el.classList.remove('hidden');
		g.setPaused(true);
		this.figureFor = null;
		this.render();
	}

	close() {
		if (!this.isOpen) return;
		this.el.classList.add('hidden');
		this.game.setPaused(false);
	}

	toggle() { if (this.isOpen) this.close(); else this.open(); }

	select(kind) {
		this.selected = kind;
		this.render();
	}

	/** Действие с выбранным предметом. */
	act() {
		const g = this.game, kind = this.selected;
		if (kind === 'zhivchik') g.drink();
		else if (ITEMS[kind]?.type === 'weapon' && g.player.weapon !== kind) {
			g.equip(kind);
			this.close();
			return;
		}
		this.render();
	}

	render() {
		const g = this.game, p = g.player, icons = g.icons ?? {};
		// фигура героя с оружием в руках (перерисовываем только при смене оружия)
		if (this.figureFor !== p.weapon) {
			this.figureFor = p.weapon;
			const src = g.figure?.(p.weapon);
			if (src) $('inv-figure').src = src;
		}
		$('inv-hp').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
		$('inv-equip').innerHTML = ['axe', 'pistol'].map((w) => `
			<button class="slot weapon${this.selected === w ? ' sel' : ''}" data-item="${w}">
				${icons[w] ? `<img src="${icons[w]}" alt="">` : ''}
				<span class="slot-name">${ITEMS[w].name}</span>
				${p.weapon === w ? '<span class="tag">в руках</span>' : ''}
				${w === 'pistol' ? `<span class="count">${p.ammo}/${g.mag}</span>` : ''}
			</button>`).join('');
		const items = BAG_ORDER.filter((k) => (g.bag[k] ?? 0) > 0);
		$('inv-grid').innerHTML = Array.from({ length: SLOTS }, (_, i) => {
			const k = items[i];
			if (!k) return '<div class="slot empty"></div>';
			return `<button class="slot${this.selected === k ? ' sel' : ''}" data-item="${k}" title="${ITEMS[k].name}">
				${icons[k] ? `<img src="${icons[k]}" alt="">` : `<span class="slot-name">${ITEMS[k].name}</span>`}
				<span class="count">${g.bag[k]}</span>
			</button>`;
		}).join('');
		$('inv-weight').textContent = `${items.length} / ${SLOTS}`;
		// описание выбранного
		let kind = this.selected;
		if (!ITEMS[kind] || (ITEMS[kind].type !== 'weapon' && !(g.bag[kind] > 0))) kind = items[0] ?? p.weapon;
		this.selected = kind;
		const it = ITEMS[kind];
		$('inv-icon').src = icons[kind] ?? '';
		$('inv-name').textContent = it.name;
		const n = g.bag[kind];
		let info = it.type === 'weapon' ? (p.weapon === kind ? 'В руках' : 'На поясе') : `${n} ${plural(n, it.forms)}`;
		if (kind === 'pistol' || kind === 'ammo') info += ` · в магазине ${p.ammo}/${g.mag}, в запасе ${g.bag.ammo ?? 0}`;
		$('inv-count').textContent = info;
		$('inv-desc').textContent = it.desc;
		const btn = $('inv-action');
		btn.classList.add('hidden');
		btn.disabled = false;
		if (kind === 'zhivchik') {
			btn.classList.remove('hidden');
			btn.textContent = p.hp >= p.maxHp ? 'Здоровье полное' : `${it.use} (+45)`;
			btn.disabled = p.hp >= p.maxHp;
		} else if (it.type === 'weapon' && p.weapon !== kind) {
			btn.classList.remove('hidden');
			btn.textContent = 'Взять в руки';
		}
	}
}
