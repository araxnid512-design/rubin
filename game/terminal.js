// Терминал базы «Опорный» (game/base.js): 20 построек — что это, что даёт, почём; купленная сразу встаёт на своё
// место (game.buyBuilding перестраивает локацию). Построенную можно улучшить до 2-го и 3-го уровня (game.upgradeBuilding). Сверху — спораны, оборона и накопленное добро (теплица, ферма,
// мастерская, медпункт) — забрать одной кнопкой; снизу — последние нападения на базу. Пока окно открыто — пауза.

import { BUILDINGS, BUILD_IDS, MAX_LEVEL, cantBuy, cantUpgrade, defense, givesNow, has, level } from './base.js';
import { ITEMS, plural } from './items.js';

const $ = (id) => document.getElementById(id);

export class TerminalWindow {
	/** game: { bag, world, roster, icons, partyWindow, buyBuilding(id), upgradeBuilding(id), collectBase(), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('terminal');
		$('term-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('term-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-build]'), u = e.target.closest('[data-up]');
			if (b && !b.disabled) { this.game.buyBuilding(b.dataset.build); this.render(); }
			if (u && !u.disabled) { this.game.upgradeBuilding(u.dataset.up); this.render(); }
		});
		$('term-collect').onclick = () => { this.game.collectBase(); this.render(); };
		// наёмники: посты на базе и вылазки без героя (окно отряда в режиме базы)
		$('term-mercs').onclick = () => { this.close(); this.game.partyWindow.open({ base: true }); };
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
		const g = this.game, b = g.world.base, spores = g.bag.spore ?? 0;
		$('term-spores').textContent = spores;
		$('term-def').textContent = defense(b);
		$('term-count').textContent = `${b.built.length}/${BUILD_IDS.length}`;
		// накопленное добро построек
		const stock = Object.entries(b.stock).filter(([, n]) => n > 0);
		$('term-stock-text').innerHTML = stock.length
			? `Накоплено: <b>${stock.map(([k, n]) => `${ITEMS[k].name.toLowerCase()} ×${n}`).join(', ')}</b>`
			: 'Накопленного нет — теплица, ферма, мастерская, медпункт и склад копят добро, пока ты в Улье; наёмники с вылазок приносят добычу сюда же';
		$('term-collect').disabled = !stock.length;
		$('term-mercs').disabled = !g.roster.length;
		$('term-list').innerHTML = BUILD_IDS.map((id) => {
			const B = BUILDINGS[id], done = has(b, id), lv = level(b, id);
			// не построено — «Построить»; построено — «Улучшить» (и что даст следующий уровень); на 3-м — наибольший
			let btn, next = '';
			if (!done) {
				const why = cantBuy(b, id, spores);
				btn = `<button class="buy" data-build="${id}" ${why ? 'disabled' : ''}>${why && why !== 'не хватает споранов' ? why : `Построить · ${B.price} сп.`}</button>`;
			} else if (lv < MAX_LEVEL && B.up?.[lv - 1]) {
				const up = B.up[lv - 1];
				next = `<span class="next">Ур. ${lv + 1}: ${up.gives}</span>`;
				btn = `<button class="buy up" data-up="${id}" ${cantUpgrade(b, id, spores) ? 'disabled' : ''}>Улучшить · ${up.price} сп.</button>`;
			} else btn = '<button class="buy" disabled>Наибольший уровень</button>';
			return `<div class="offer build${done ? ' owned' : ''}">
				<div class="offer-text"><b>${B.name}${done ? ` <i class="lv">ур. ${lv}</i>` : ''}</b>
					<span class="gives">${givesNow(b, id)}</span><span>${B.desc}</span>${next}</div>
				${btn}
			</div>`;
		}).join('');
		// последние нападения
		$('term-log').innerHTML = b.log.length
			? `Нападения на базу: ${b.log.slice(0, 3).map((a) => a.held ? `отбились (сила ${a.power}, оборона ${a.def})` : `прорвались (сила ${a.power}, оборона ${a.def}) — накопленное растащили`).join('; ')}.`
			: `Пока ты в Улье, на базу нападают заражённые: оборона не меньше силы нападения — отбиваются, иначе накопленное растаскивают. Сила растёт с каждым разом.`;
	}
}

/** «2 горошины, 16 споранов» — что забрал. */
export function stockText(got) {
	return Object.entries(got).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${plural(n, ITEMS[k].forms)}`).join(', ');
}
