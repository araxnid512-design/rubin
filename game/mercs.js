// Наёмники стаба: у каждого своё постоянное оружие. Еда им не нужна — нужны патроны их калибра
// (сами перезаряжаются из своего запаса) и живчики: сами они не лечатся.
// Нанимают у костра в стабе; нанятый живёт в комнате героя (там четыре койки). Подойдя к нему,
// его берут с собой на вылазки или оставляют в комнате; в отряде — не больше двух. Служит, пока жив.

import { WEAPONS, AMMO } from './weapons.js';
import { ITEMS } from './items.js';

export const MERCS = {
	shram: { name: 'Шрам', weapon: 'ak74', price: 120, hp: 120, tint: [0.55, 0.58, 0.48], desc: 'Бывший контрактник с АК-74. Держится рядом, бьёт короткими очередями.' },
	ded: { name: 'Дед', weapon: 'shotgun', price: 80, hp: 140, tint: [0.78, 0.66, 0.52], desc: 'Старый охотник с МР-133. Подпускает близко и почти не промахивается.' },
	botsman: { name: 'Боцман', weapon: 'ak47', price: 130, hp: 130, tint: [0.46, 0.5, 0.62], desc: 'Здоровяк с АК-47. Шумный, зато бегун падает с пары попаданий.' },
	sych: { name: 'Сыч', weapon: 'svd', price: 150, hp: 90, tint: [0.64, 0.66, 0.52], desc: 'Снайпер с СВД. Снимает заражённых издалека, вблизи беззащитен.' },
};
export const MAX_PARTY = 2;
/** Коек в комнате героя — столько наёмников можно нанять. */
export const ROOM_BEDS = 4;
/** Сколько здоровья наёмнику даёт один живчик. */
export const MERC_HEAL = 60;

/** Новый наёмник: полный магазин и ещё один в запасе; out — идёт с героем (новый — ждёт в комнате). */
export const newMerc = (id) => ({ id, hp: MERCS[id].hp, mag: WEAPONS[MERCS[id].weapon].mag, ammo: WEAPONS[MERCS[id].weapon].mag, out: false });

const $ = (id) => document.getElementById(id);

/**
 * Окно отряда: кто идёт с героем и кто ждёт в комнате (патроны, живчик, взять/оставить — в стабе);
 * у вербовщика у костра — ещё и кого можно нанять.
 */
export class PartyWindow {
	/** game: { roster, party, bag, icons, inStab, hire(id), giveAmmo(id), healMerc(id), takeMerc(id), leaveMerc(id), dismiss(id), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('party');
		$('party-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		this.el.addEventListener('click', (e) => {
			const b = e.target.closest('[data-act]');
			if (!b || b.disabled) return;
			const g = this.game, id = b.dataset.id;
			if (b.dataset.act === 'ammo') g.giveAmmo(id);
			if (b.dataset.act === 'heal') g.healMerc(id);
			if (b.dataset.act === 'take') g.takeMerc(id);
			if (b.dataset.act === 'leave') g.leaveMerc(id);
			if (b.dataset.act === 'dismiss') g.dismiss(id);
			if (b.dataset.act === 'hire') g.hire(id);
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
		const g = this.game, bag = g.bag, icons = g.icons ?? {}, stab = g.inStab;
		const face = (id) => (icons[`merc_${id}`] ? `<img class="npc-face" src="${icons[`merc_${id}`]}" alt="">` : '');
		const full = g.party.length >= MAX_PARTY;
		$('party-spores').textContent = bag.spore ?? 0;
		const card = (m) => {
			const D = MERCS[m.id], W = WEAPONS[D.weapon], spare = bag[W.ammo] ?? 0, give = Math.min(spare, W.mag);
			let move = '';
			if (stab && m.out) move = `<button class="stay small" data-act="leave" data-id="${m.id}">Оставить в комнате</button>`;
			if (stab && !m.out) move = `<button class="buy" data-act="take" data-id="${m.id}" ${full ? 'disabled' : ''}>Взять с собой</button>`;
			return `<div class="merc">
				${face(m.id)}
				<div class="merc-text"><b>${D.name}</b> <span class="muted">${W.name}</span>
					<div class="merc-hp"><i style="width:${Math.max(0, (m.hp / D.hp) * 100).toFixed(0)}%"></i></div>
					<span>здоровье ${Math.ceil(m.hp)}/${D.hp} · патроны ${m.mag} + ${m.ammo} (${AMMO[W.ammo]})</span></div>
				<div class="merc-btns">
					${move}
					<button class="buy" data-act="ammo" data-id="${m.id}" ${give ? '' : 'disabled'}>Патроны +${give || W.mag} <small>(есть ${spare})</small></button>
					<button class="buy" data-act="heal" data-id="${m.id}" ${(bag.zhivchik ?? 0) > 0 && m.hp < D.hp ? '' : 'disabled'}>Живчик +${MERC_HEAL} <small>(есть ${bag.zhivchik ?? 0})</small></button>
					${this.hiring ? `<button class="stay small" data-act="dismiss" data-id="${m.id}">Отпустить совсем</button>` : ''}
				</div></div>`;
		};
		const home = g.roster.filter((m) => !m.out);
		let html = `<div class="trade-sec">С тобой (${g.party.length}/${MAX_PARTY})</div>`;
		html += g.party.map(card).join('') || `<div class="muted">${g.roster.length ? 'Никого — возьми бойца из комнаты.' : 'Наёмников нет. Нанять можно у костра в стабе «Полис».'}</div>`;
		if (home.length) {
			html += `<div class="trade-sec">В твоей комнате в стабе (${home.length})</div>`;
			html += stab ? home.map(card).join('') : `<div class="muted">${home.map((m) => MERCS[m.id].name).join(', ')} — ждут у своих коек.</div>`;
		}
		if (this.hiring) {
			const beds = g.roster.length >= ROOM_BEDS;
			const free = Object.entries(MERCS).filter(([id]) => !g.roster.some((m) => m.id === id));
			if (free.length) {
				html += `<div class="trade-sec">Нанять ${beds ? `<span class="muted">· в комнате все ${ROOM_BEDS} койки заняты</span>` : ''}</div>`;
				html += free.map(([id, D]) => {
					const W = WEAPONS[D.weapon];
					return `<div class="merc">
						${face(id)}
						<div class="merc-text"><b>${D.name}</b> <span class="muted">${W.name} · ${AMMO[W.ammo]} · здоровье ${D.hp}</span><span>${D.desc}</span></div>
						<div class="merc-btns"><button class="buy" data-act="hire" data-id="${id}" ${beds || (bag.spore ?? 0) < D.price ? 'disabled' : ''}>Нанять · ${D.price} сп.</button></div></div>`;
				}).join('');
			}
		}
		$('party-list').innerHTML = html;
		$('party-hint').textContent = `Нанятые живут в твоей комнате в стабе: подойди к бойцу — возьмёшь его с собой или оставишь. На вылазку — не больше ${MAX_PARTY}. Еда им не нужна: дай патроны их калибра и живчики — сами они не лечатся (${ITEMS.zhivchik.name} — +${MERC_HEAL}).`;
	}
}
