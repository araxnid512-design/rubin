// Наёмники стаба: у каждого своё постоянное оружие. Еда им не нужна — нужны патроны их калибра
// (сами перезаряжаются из своего запаса) и живчики: сами они не лечатся.
// Нанимают у костра в стабе; нанятый живёт в комнате героя (там шесть коек) и стоит у своей койки.
// Снарядить его — дать патроны и живчик — и взять с собой можно только там: в бою пополнить нечем,
// а без патронов боец гибнет от первой же атаки, так что запас продумывают заранее. В отряде — не больше
// двух; вернувшись в стаб, уцелевшие снова расходятся по койкам. Служит, пока жив.
// Каждый — своего класса: штурмовик, снайпер, пулемётчик, охотник, медик, подрывник.

import { WEAPONS, AMMO } from './weapons.js';
import { ITEMS } from './items.js';

/**
 * Классы наёмников: роль в бою. keep — на каком расстоянии идёт за героем; reach — дальше этого не стреляет;
 * burst — длина очереди (у автоматического оружия); остальное — особенности класса (см. Merc в main.js).
 */
export const CLASSES = {
	assault: { name: 'Штурмовик', short: 'ШТ', keep: 2.3, reach: 24, burst: [3, 5], desc: 'Держится рядом, бьёт короткими очередями по ближайшим.' },
	sniper: { name: 'Снайпер', short: 'СН', keep: 4.2, reach: 40, prefer: 'far', kite: 3.5, desc: 'Идёт поодаль, первым снимает топтунов и дальних. Вблизи беззащитен — отходит.' },
	gunner: { name: 'Пулемётчик', short: 'ПУЛ', keep: 2.9, reach: 30, burst: [9, 15], plant: true, desc: 'Держит толпу длинными очередями; стреляет стоя, перезаряжается долго.' },
	hunter: { name: 'Охотник', short: 'ОХ', keep: 1.9, reach: 11, desc: 'Подпускает близко и бьёт картечью почти без промаха.' },
	medic: { name: 'Медик', short: 'МЕД', keep: 1.7, reach: 16, burst: [2, 4], heals: true, desc: 'Держится ближе всех и лечит героя и отряд живчиками из своей аптечки — пополняй её.' },
	sapper: { name: 'Подрывник', short: 'ПОД', keep: 2.6, reach: 24, burst: [3, 4], grenades: true, desc: 'Кидает Ф-1 в кучу заражённых или в топтуна, если свои не рядом с целью. Гранаты даёшь ты.' },
};

export const MERCS = {
	shram: { name: 'Шрам', cls: 'assault', weapon: 'ak74', price: 120, hp: 120, tint: [0.55, 0.58, 0.48], desc: 'Бывший контрактник с АК-74. Ровный, надёжный, патроны бережёт.' },
	botsman: { name: 'Боцман', cls: 'assault', weapon: 'ak47', price: 130, hp: 130, tint: [0.46, 0.5, 0.62], desc: 'Здоровяк с АК-47. Шумный, зато бегун падает с пары попаданий.' },
	sych: { name: 'Сыч', cls: 'sniper', weapon: 'svd', price: 150, hp: 90, tint: [0.64, 0.66, 0.52], desc: 'Снайпер с СВД: заражённый падает с выстрела. Стреляет редко.' },
	tihonya: { name: 'Тихоня', cls: 'sniper', weapon: 'vss', price: 170, hp: 90, tint: [0.4, 0.44, 0.4], desc: 'С бесшумным «Винторезом»: стреляет почти неслышно — соседи убитого не сбегаются.' },
	kuvalda: { name: 'Кувалда', cls: 'gunner', weapon: 'pkm', price: 200, hp: 160, tint: [0.58, 0.5, 0.42], desc: 'Пулемётчик с ПКМ. Лента на сотню — держит улицу, пока не кончится.' },
	ded: { name: 'Дед', cls: 'hunter', weapon: 'shotgun', price: 80, hp: 140, tint: [0.78, 0.66, 0.52], desc: 'Старый охотник с МР-133. Ждёт, пока подойдут, и не промахивается.' },
	dok: { name: 'Док', cls: 'medic', weapon: 'vector', price: 140, hp: 100, tint: [0.86, 0.86, 0.82], desc: 'Медик с «Вектором». В аптечке два живчика — дальше пополняешь ты.' },
	saper: { name: 'Сапёр', cls: 'sapper', weapon: 'aks', price: 150, hp: 120, tint: [0.5, 0.54, 0.4], desc: 'Подрывник с АКС-74У и двумя Ф-1 в разгрузке.' },
};
export const MAX_PARTY = 2;
/** Коек в комнате героя — столько наёмников можно нанять. */
export const ROOM_BEDS = 6;
/** Сколько здоровья даёт один живчик: наёмнику от героя и раненому — от медика. */
export const MERC_HEAL = 60;
/** Сколько гранат и живчиков (аптечка медика) у бойца при найме. */
const KIT = { medic: { meds: 2 }, sapper: { nades: 2 } };

/**
 * Новый наёмник: полный магазин и ещё один в запасе; out — идёт с героем (новый — ждёт в комнате);
 * bed — его койка; у медика аптечка (meds), у подрывника гранаты (nades).
 */
export const newMerc = (id, bed = 0) => {
	const D = MERCS[id], W = WEAPONS[D.weapon];
	return { id, hp: D.hp, mag: W.mag, ammo: W.mag, out: false, bed, ...KIT[D.cls] };
};

const $ = (id) => document.getElementById(id);

/**
 * Окно отряда: кто идёт с героем и кто ждёт в комнате. Патроны, живчик, взять/оставить — только в комнате
 * героя (подойдя к бойцу — его карточка); в остальных местах окно только показывает, как они. У вербовщика
 * у костра — ещё и кого можно нанять.
 */
export class PartyWindow {
	/** game: { roster, party, bag, icons, inRoom, hire(id), giveAmmo(id), healMerc(id), giveMeds(id), giveNade(id), takeMerc(id), leaveMerc(id), dismiss(id), setPaused(bool) } */
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
			if (b.dataset.act === 'meds') g.giveMeds(id);
			if (b.dataset.act === 'nade') g.giveNade(id);
			if (b.dataset.act === 'take') g.takeMerc(id);
			if (b.dataset.act === 'leave') g.leaveMerc(id);
			if (b.dataset.act === 'dismiss') g.dismiss(id);
			if (b.dataset.act === 'hire') g.hire(id);
			this.render();
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	/** hiring — открыто у вербовщика: можно нанимать; merc — подошёл к этому бойцу в комнате: только его карточка. */
	open({ hiring = false, merc = null } = {}) {
		if (this.isOpen) return;
		this.hiring = hiring;
		this.focus = merc;
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
		const g = this.game, bag = g.bag, icons = g.icons ?? {}, room = g.inRoom;
		const face = (id) => (icons[`merc_${id}`] ? `<img class="npc-face" src="${icons[`merc_${id}`]}" alt="">` : '');
		const badge = (cls) => `<span class="cls cls-${cls}">${CLASSES[cls].name}</span>`;
		const full = g.party.length >= MAX_PARTY;
		$('party-spores').textContent = bag.spore ?? 0;
		const card = (m) => {
			const D = MERCS[m.id], C = CLASSES[D.cls], W = WEAPONS[D.weapon], spare = bag[W.ammo] ?? 0, give = Math.min(spare, W.mag);
			let move = '';
			if (room && m.out) move = `<button class="stay small" data-act="leave" data-id="${m.id}">Оставить у койки</button>`;
			if (room && !m.out) move = `<button class="buy" data-act="take" data-id="${m.id}" ${full ? 'disabled' : ''}>Взять с собой</button>`;
			// своё снаряжение класса: аптечка медика, гранаты подрывника
			let kit = '', stock = '';
			if (C.heals) { stock = ` · в аптечке ${m.meds ?? 0}`; if (room) kit = `<button class="buy" data-act="meds" data-id="${m.id}" ${(bag.zhivchik ?? 0) > 0 ? '' : 'disabled'}>В аптечку живчик <small>(есть ${bag.zhivchik ?? 0})</small></button>`; }
			if (C.grenades) { stock = ` · гранат ${m.nades ?? 0}`; if (room) kit = `<button class="buy" data-act="nade" data-id="${m.id}" ${(bag.grenade ?? 0) > 0 ? '' : 'disabled'}>Ф-1 +1 <small>(есть ${bag.grenade ?? 0})</small></button>`; }
			const dry = m.mag + m.ammo <= 0;
			return `<div class="merc" data-merc="${m.id}">
				${face(m.id)}
				<div class="merc-text"><b>${D.name}</b> ${badge(D.cls)} <span class="muted">${W.name}</span>
					<div class="merc-hp"><i style="width:${Math.max(0, (m.hp / D.hp) * 100).toFixed(0)}%"></i></div>
					<span>здоровье ${Math.ceil(m.hp)}/${D.hp} · <span class="${dry ? 'warn' : ''}">патроны ${m.mag} + ${m.ammo} (${AMMO[W.ammo]})${dry ? ' — без патронов не отобьётся' : ''}</span>${stock}</span></div>
				<div class="merc-btns">
					${move}
					${room ? `<button class="buy" data-act="ammo" data-id="${m.id}" ${give ? '' : 'disabled'}>Патроны +${give || W.mag} <small>(есть ${spare})</small></button>
					<button class="buy" data-act="heal" data-id="${m.id}" ${(bag.zhivchik ?? 0) > 0 && m.hp < D.hp ? '' : 'disabled'}>Живчик +${MERC_HEAL} <small>(есть ${bag.zhivchik ?? 0})</small></button>` : ''}
					${kit}
					${this.hiring ? `<button class="stay small" data-act="dismiss" data-id="${m.id}">Отпустить совсем</button>` : ''}
				</div></div>`;
		};
		const home = g.roster.filter((m) => !m.out), one = room && g.roster.find((m) => m.id === this.focus);
		let html = '';
		if (one) {
			// подошёл к бойцу: только его карточка
			html += `<div class="trade-sec">${one.out ? `С тобой (${g.party.length}/${MAX_PARTY})` : `У своей койки · с тобой ${g.party.length}/${MAX_PARTY}`}</div>${card(one)}`;
		} else {
			html += `<div class="trade-sec">С тобой (${g.party.length}/${MAX_PARTY})</div>`;
			html += g.party.map(card).join('') || `<div class="muted">${g.roster.length ? 'Никого — возьми бойца у его койки в комнате.' : 'Наёмников нет. Нанять можно у костра в стабе «Полис».'}</div>`;
			if (home.length) {
				html += `<div class="trade-sec">В твоей комнате в стабе (${home.length})</div>`;
				html += room || this.hiring ? home.map(card).join('') : `<div class="muted">${home.map((m) => MERCS[m.id].name).join(', ')} — ждут у своих коек.</div>`;
			}
			if (g.roster.length && !room) html += '<div class="muted">Снарядить бойцов — патроны, живчик — и взять с собой можно только в твоей комнате в стабе, у их коек.</div>';
		}
		if (this.hiring) {
			// вербовщик: свободные бойцы по классам
			const beds = g.roster.length >= ROOM_BEDS;
			html += `<div class="trade-sec">Нанять ${beds ? `<span class="muted">· в комнате все ${ROOM_BEDS} койки заняты</span>` : `<span class="muted">· свободных коек ${ROOM_BEDS - g.roster.length}</span>`}</div>`;
			for (const [cls, C] of Object.entries(CLASSES)) {
				const free = Object.entries(MERCS).filter(([id, D]) => D.cls === cls && !g.roster.some((m) => m.id === id));
				if (!free.length) continue;
				html += `<div class="cls-head">${badge(cls)} <span class="muted">${C.desc}</span></div>`;
				html += free.map(([id, D]) => {
					const W = WEAPONS[D.weapon];
					return `<div class="merc" data-hire="${id}">
						${face(id)}
						<div class="merc-text"><b>${D.name}</b> <span class="muted">${W.name} · ${AMMO[W.ammo]} · здоровье ${D.hp}</span><span>${D.desc}</span></div>
						<div class="merc-btns"><button class="buy" data-act="hire" data-id="${id}" ${beds || (bag.spore ?? 0) < D.price ? 'disabled' : ''}>Нанять · ${D.price} сп.</button></div></div>`;
				}).join('');
			}
		}
		$('party-list').innerHTML = html;
		$('party-hint').textContent = `Нанятые живут в твоей комнате в стабе и стоят у своих коек: подойди к бойцу — дашь патроны их калибра и живчик (${ITEMS.zhivchik.name} — +${MERC_HEAL}; сами они не лечатся), возьмёшь с собой или оставишь. В бою пополнить нечем, а без патронов боец гибнет — продумывай запас заранее. На вылазку — не больше ${MAX_PARTY}; вернувшись в стаб, они снова у коек. Медику пополняй аптечку, подрывнику — гранаты.`;
	}
}
