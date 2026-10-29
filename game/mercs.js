// Наёмники стаба: у каждого своё постоянное оружие. Еда им не нужна — нужны патроны их калибра
// (сами перезаряжаются из своего запаса) и живчики: сами они не лечатся.
// Нанимают у костра в стабе; в отряде — не больше двух.

import { WEAPONS, AMMO } from './weapons.js';
import { ITEMS } from './items.js';

export const MERCS = {
	shram: { name: 'Шрам', weapon: 'ak74', price: 120, hp: 120, tint: [0.55, 0.58, 0.48], desc: 'Бывший контрактник с АК-74. Держится рядом, бьёт короткими очередями.' },
	ded: { name: 'Дед', weapon: 'shotgun', price: 80, hp: 140, tint: [0.78, 0.66, 0.52], desc: 'Старый охотник с МР-133. Подпускает близко и почти не промахивается.' },
	botsman: { name: 'Боцман', weapon: 'ak47', price: 130, hp: 130, tint: [0.46, 0.5, 0.62], desc: 'Здоровяк с АК-47. Шумный, зато бегун падает с пары попаданий.' },
	sych: { name: 'Сыч', weapon: 'svd', price: 150, hp: 90, tint: [0.64, 0.66, 0.52], desc: 'Снайпер с СВД. Снимает заражённых издалека, вблизи беззащитен.' },
};
export const MAX_PARTY = 2;
/** Сколько здоровья наёмнику даёт один живчик. */
export const MERC_HEAL = 60;

/** Новый наёмник: полный магазин и ещё один в запасе. */
export const newMerc = (id) => ({ id, hp: MERCS[id].hp, mag: WEAPONS[MERCS[id].weapon].mag, ammo: WEAPONS[MERCS[id].weapon].mag });

const $ = (id) => document.getElementById(id);

/** Окно отряда: свои наёмники (патроны, живчик, отпустить) и — у костра в стабе — кого можно нанять. */
export class PartyWindow {
	/** game: { party, bag, icons, hire(id), giveAmmo(i), healMerc(i), dismiss(i), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('party');
		$('party-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		this.el.addEventListener('click', (e) => {
			const b = e.target.closest('[data-act]');
			if (!b || b.disabled) return;
			const g = this.game, i = +b.dataset.i;
			if (b.dataset.act === 'ammo') g.giveAmmo(i);
			if (b.dataset.act === 'heal') g.healMerc(i);
			if (b.dataset.act === 'dismiss') g.dismiss(i);
			if (b.dataset.act === 'hire') g.hire(b.dataset.id);
			this.render();
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	/** hiring — открыто у вербовщика: можно нанимать. */
	open({ hiring = false } = {}) {
		if (this.isOpen) return;
		this.hiring = hiring;
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
		const face = (id) => (icons[`merc_${id}`] ? `<img class="npc-face" src="${icons[`merc_${id}`]}" alt="">` : '');
		$('party-spores').textContent = bag.spore ?? 0;
		const mine = g.party.map((m, i) => {
			const D = MERCS[m.id], W = WEAPONS[D.weapon], spare = bag[W.ammo] ?? 0, give = Math.min(spare, W.mag);
			return `<div class="merc">
				${face(m.id)}
				<div class="merc-text"><b>${D.name}</b> <span class="muted">${W.name}</span>
					<div class="merc-hp"><i style="width:${Math.max(0, (m.hp / D.hp) * 100).toFixed(0)}%"></i></div>
					<span>здоровье ${Math.ceil(m.hp)}/${D.hp} · патроны ${m.mag} + ${m.ammo} (${AMMO[W.ammo]})</span></div>
				<div class="merc-btns">
					<button class="buy" data-act="ammo" data-i="${i}" ${give ? '' : 'disabled'}>Патроны +${give || W.mag} <small>(есть ${spare})</small></button>
					<button class="buy" data-act="heal" data-i="${i}" ${(bag.zhivchik ?? 0) > 0 && m.hp < D.hp ? '' : 'disabled'}>Живчик +${MERC_HEAL} <small>(есть ${bag.zhivchik ?? 0})</small></button>
					${this.hiring ? `<button class="stay small" data-act="dismiss" data-i="${i}">Отпустить</button>` : ''}
				</div></div>`;
		}).join('') || '<div class="muted">Наёмников нет. Нанять можно у костра в стабе «Полис».</div>';
		let hire = '';
		if (this.hiring) {
			const full = g.party.length >= MAX_PARTY;
			hire = `<div class="trade-sec">Нанять ${full ? `<span class="muted">· в отряде уже ${MAX_PARTY}</span>` : ''}</div>` + Object.entries(MERCS).filter(([id]) => !g.party.some((m) => m.id === id)).map(([id, D]) => {
				const W = WEAPONS[D.weapon];
				return `<div class="merc">
					${face(id)}
					<div class="merc-text"><b>${D.name}</b> <span class="muted">${W.name} · ${AMMO[W.ammo]} · здоровье ${D.hp}</span><span>${D.desc}</span></div>
					<div class="merc-btns"><button class="buy" data-act="hire" data-id="${id}" ${full || (bag.spore ?? 0) < D.price ? 'disabled' : ''}>Нанять · ${D.price} сп.</button></div></div>`;
			}).join('');
		}
		$('party-list').innerHTML = `<div class="trade-sec">Отряд (${g.party.length}/${MAX_PARTY})</div>${mine}${hire}`;
		$('party-hint').textContent = `Наёмникам не нужна еда: дай им патроны их калибра и живчики — сами они не лечатся. ${ITEMS.zhivchik.name} лечит наёмника на ${MERC_HEAL}.`;
	}
}
