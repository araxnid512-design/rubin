// Верстак в мастерской базы (game/economy.js, RECIPES): из ресурсов — детали, патроны, гранаты, аптечки, живчик,
// выстрелы к гранатомётам. Ресурсы берутся из рюкзака, на базе — и со склада. Рецепты открываются уровнем мастерской
// (1 — простые, 2 — винтовочные патроны, 3 — тяжёлое). Пока окно открыто — пауза.

import { RECIPES } from './economy.js';
import { ITEMS, RESOURCES, plural } from './items.js';
import { level } from './base.js';

const $ = (id) => document.getElementById(id);

export class CraftWindow {
	/** game: { bag, world, icons, resHave(kind), craft(id), setPaused(bool), atBase } */
	constructor(game) {
		this.game = game;
		this.el = $('craft');
		$('craft-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('craft-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-craft]');
			if (!b || b.disabled) return;
			const n = +(b.dataset.n || 1);
			for (let i = 0; i < n; i++) if (!this.game.craft(b.dataset.craft)) break;
			this.render();
		});
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
		const g = this.game, icons = g.icons ?? {}, lv = level(g.world.base, 'workshop');
		const have = (k) => g.resHave(k);
		$('craft-res').innerHTML = RESOURCES.map((k) => `<span title="${ITEMS[k].desc}">${icons[k] ? `<img src="${icons[k]}" alt="">` : ''}${ITEMS[k].name} <b>${have(k)}</b></span>`).join('');
		$('craft-lv').textContent = lv ? `мастерская ур. ${lv}` : 'мастерской нет';
		let sec = 0;
		$('craft-list').innerHTML = RECIPES.map((R) => {
			const head = R.lv !== sec ? `<div class="trade-sec">${(sec = R.lv) === 1 ? 'Простое' : R.lv === 2 ? 'Винтовочные патроны — мастерская 2-го уровня' : 'Тяжёлое — мастерская 3-го уровня'}</div>` : '';
			const [[outK]] = Object.entries(R.out);
			const need = Object.entries(R.need).map(([k, n]) => `<span class="${have(k) >= n ? '' : 'warn'}">${ITEMS[k].name.toLowerCase()} ${have(k)}/${n}</span>`).join(' · ');
			const locked = lv < R.lv, can = !locked && Object.entries(R.need).every(([k, n]) => have(k) >= n);
			const times = can ? Math.min(...Object.entries(R.need).map(([k, n]) => Math.floor(have(k) / n))) : 0;
			return `${head}<div class="offer${locked ? ' owned' : ''}">
				<div class="offer-icon">${icons[outK] ? `<img src="${icons[outK]}" alt="">` : ''}</div>
				<div class="offer-text"><b>${R.name}</b><span>${need}</span><span class="muted">в рюкзаке ${g.bag[outK] ?? 0} ${plural(g.bag[outK] ?? 0, ITEMS[outK].forms ?? ['шт.', 'шт.', 'шт.'])}</span></div>
				<div class="sell-btns">
					<button class="buy" data-craft="${R.id}" ${can ? '' : 'disabled'}>${locked ? `Мастерская ур. ${R.lv}` : 'Сделать'}</button>
					${times >= 5 ? `<button class="buy" data-craft="${R.id}" data-n="5">×5</button>` : ''}
				</div>
			</div>`;
		}).join('');
	}
}
