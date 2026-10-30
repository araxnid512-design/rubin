// Рюкзак в духе Last Day on Earth: слева герой в полный рост и два слота оружия (ближний бой
// и огнестрел), в центре ячейки рюкзака с количеством (запасное оружие, патроны, живчики,
// спораны, горох), справа описание выбранного предмета и действие. Пока рюкзак открыт, игра на паузе.

import { ITEMS, BAG_ORDER, plural } from './items.js';
import { WEAPONS, AMMO } from './weapons.js';

const SLOTS = 15;
const $ = (id) => document.getElementById(id);
const SLOT_NAMES = { melee: 'Ближний бой', gun: 'Огнестрел' };

export class Inventory {
	/**
	 * game: { player, bag, kit: { gear, owned, mags }, icons, figure(gear, hold), drink(), eatPearl(),
	 *         hold(slot), equipGear(id), setPaused(bool) }
	 */
	constructor(game) {
		this.game = game;
		this.el = $('inventory');
		this.selected = 'ammo9';
		$('inv-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		for (const id of ['inv-grid', 'inv-equip']) {
			$(id).addEventListener('click', (e) => {
				const slot = e.target.closest('[data-item]');
				if (slot) this.select(slot.dataset.item);
			});
		}
		$('inv-action').onclick = () => this.act();
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	open() {
		const g = this.game;
		if (this.isOpen || !g.player?.alive) return;
		this.el.classList.remove('hidden');
		g.setPaused(true);
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
		const g = this.game, kind = this.selected, kit = g.kit, p = g.player;
		const W = WEAPONS[kind];
		if (kind === 'zhivchik') g.drink();
		else if (kind === 'pearl') g.eatPearl();
		else if (W && kit.gear[W.slot] === kind) {
			// оружие из слота — в руки (смена анимацией после закрытия рюкзака)
			if (p.weapon !== kind) { this.close(); g.hold(W.slot); return; }
		} else if (W) g.equipGear(kind); // запасное из рюкзака — в слот, прежнее — в рюкзак
		this.render();
	}

	render() {
		const g = this.game, p = g.player, kit = g.kit, icons = g.icons ?? {};
		const key = `${kit.gear.melee}|${kit.gear.gun}|${p.hold}`;
		if (this.figureFor !== key) {
			this.figureFor = key;
			const src = g.figure?.(kit.gear, p.hold);
			if (src) $('inv-figure').src = src;
		}
		$('inv-hp').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
		// у ствола — патроны в магазине, у топора — полоска прочности
		const wearBar = (w) => {
			const W = WEAPONS[w];
			if (!W.durability) return '';
			const f = (kit.wear[w] ?? W.durability) / W.durability;
			return `<span class="wear${f <= 0.2 ? ' low' : ''}"><i style="width:${(f * 100).toFixed(0)}%"></i></span>`;
		};
		$('inv-equip').innerHTML = ['melee', 'gun'].map((slot) => {
			const w = kit.gear[slot];
			if (!w) return `<div class="slot weapon empty"><span class="slot-name">${SLOT_NAMES[slot]}</span></div>`;
			const W = WEAPONS[w];
			return `<button class="slot weapon${this.selected === w ? ' sel' : ''}" data-item="${w}">
				${icons[w] ? `<img src="${icons[w]}" alt="">` : ''}
				<span class="slot-name">${W.name}</span>
				${p.weapon === w ? '<span class="tag">в руках</span>' : ''}
				${W.ammo ? `<span class="count">${kit.mags[w] ?? 0}/${W.mag}</span>` : wearBar(w)}
			</button>`;
		}).join('');
		// рюкзак: запасное оружие, затем расходники
		const spare = kit.owned.filter((w) => !Object.values(kit.gear).includes(w));
		const items = [...spare, ...BAG_ORDER.filter((k) => (g.bag[k] ?? 0) > 0)];
		$('inv-grid').innerHTML = Array.from({ length: SLOTS }, (_, i) => {
			const k = items[i];
			if (!k) return '<div class="slot empty"></div>';
			const count = WEAPONS[k] ? (WEAPONS[k].ammo ? `${kit.mags[k] ?? 0}/${WEAPONS[k].mag}` : '') : g.bag[k];
			return `<button class="slot${this.selected === k ? ' sel' : ''}" data-item="${k}" title="${ITEMS[k].name}">
				${icons[k] ? `<img src="${icons[k]}" alt="">` : `<span class="slot-name">${ITEMS[k].name}</span>`}
				<span class="count">${count}</span>${WEAPONS[k] ? wearBar(k) : ''}
			</button>`;
		}).join('');
		$('inv-weight').textContent = `${items.length} / ${SLOTS}`;
		// описание выбранного
		let kind = this.selected;
		const valid = WEAPONS[kind] ? kit.owned.includes(kind) || Object.values(kit.gear).includes(kind) : (g.bag[kind] ?? 0) > 0;
		if (!ITEMS[kind] || !valid) kind = items[0] ?? p.weapon;
		this.selected = kind;
		const it = ITEMS[kind], W = WEAPONS[kind];
		$('inv-icon').src = icons[kind] ?? '';
		$('inv-name').textContent = it.name;
		let info;
		if (W) {
			const where = p.weapon === kind ? 'В руках' : kit.gear[W.slot] === kind ? (W.mount === 'back' ? 'За спиной' : W.mount ? 'На поясе' : 'Свободны') : 'В рюкзаке';
			if (W.ammo) info = `${where} · в магазине ${kit.mags[kind] ?? 0}/${W.mag}, в запасе ${g.bag[W.ammo] ?? 0} (${AMMO[W.ammo]})`;
			else if (W.durability) info = `${where} · урон ${W.damage} · прочность ${kit.wear[kind] ?? W.durability}/${W.durability} ударов`;
			else info = `${where} · урон ${W.damage}`;
		} else {
			const n = g.bag[kind];
			info = `${n} ${plural(n, it.forms)}`;
			const guns = Object.entries(WEAPONS).filter(([, w]) => w.ammo === kind).map(([, w]) => w.name);
			if (guns.length) info += ` · к оружию: ${guns.join(', ')}`;
		}
		$('inv-count').textContent = info;
		$('inv-desc').textContent = it.desc;
		const btn = $('inv-action');
		btn.classList.add('hidden');
		btn.disabled = false;
		if (kind === 'zhivchik') {
			btn.classList.remove('hidden');
			btn.textContent = p.hp >= p.maxHp ? 'Здоровье полное' : `${it.use} (+45)`;
			btn.disabled = p.hp >= p.maxHp;
		} else if (kind === 'pearl' && g.bag.pearl > 0) {
			btn.classList.remove('hidden');
			btn.textContent = p.maxHp >= 200 ? 'Здоровье на пределе' : `${it.use} (здоровье +20 навсегда)`;
			btn.disabled = p.maxHp >= 200;
		} else if (W && kit.gear[W.slot] === kind && p.weapon !== kind) {
			btn.classList.remove('hidden');
			btn.textContent = 'Взять в руки';
		} else if (W && kit.gear[W.slot] !== kind) {
			btn.classList.remove('hidden');
			btn.textContent = `В слот «${SLOT_NAMES[W.slot]}»`;
		}
	}
}
