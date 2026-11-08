// Наёмники стаба: у каждого своё постоянное оружие. Еда им не нужна — нужны патроны их калибра
// (сами перезаряжаются из своего запаса) и аптечки: сами они не лечатся.
// Нанимают у костра в стабе; нанятый живёт в комнате героя (там шесть коек) и стоит у своей койки, а коек нет — на
// базе «Опорный» (места у казармы: BASE_BEDS по её уровню). Из комнаты бойца можно отправить на базу и обратно
// (relocate). Взять с собой или оставить — у его дома: в комнате или на базе. Снарядить — дать патроны, аптечку, перевязки медику, гранаты подрывнику —
// можно и в вылазке: подойди к бойцу, когда рядом нет врагов (кнопка «Снарядить»), или из окна отряда, стоя рядом.
// Без патронов боец гибнет от первой же атаки. В отряде — не больше четырёх (MAX_PARTY); вернувшись в стаб,
// уцелевшие снова расходятся по койкам. Служит, пока жив. Заражённый подобрался близко — боец пятится к герою лицом
// к нему и стреляет (retreat — с какого расстояния).
// Каждый — своего класса: штурмовик, снайпер, пулемётчик, охотник, медик, подрывник.

import { WEAPONS, AMMO } from './weapons.js';
import { ITEMS } from './items.js';
import { NODES, approx } from './world.js';

/**
 * Классы наёмников: роль в бою. keep — на каком расстоянии идёт за героем; burst — длина очереди
 * (у автоматического оружия); остальное — особенности класса (см. Merc в main.js). Стреляет боец на дальность
 * своего оружия — ту же, что у героя с этим стволом (range в weapons.js): снайпер — на полтора экрана,
 * остальные — вблизи.
 */
export const CLASSES = {
	assault: { name: 'Штурмовик', short: 'ШТ', keep: 2.3, burst: [3, 5], retreat: 3, desc: 'Держится рядом, бьёт короткими очередями по ближайшим; прёт заражённый — отходит, стреляя.' },
	sniper: { name: 'Снайпер', short: 'СН', keep: 4.2, prefer: 'far', retreat: 5, desc: 'Идёт поодаль, первым снимает топтунов и дальних. Вблизи беззащитен — заранее отходит, стреляя.' },
	gunner: { name: 'Пулемётчик', short: 'ПУЛ', keep: 2.9, burst: [9, 15], plant: true, retreat: 2.6, desc: 'Держит толпу длинными очередями; стреляет стоя, перезаряжается долго. Вплотную — пятится с огнём от бедра.' },
	hunter: { name: 'Охотник', short: 'ОХ', keep: 1.9, retreat: 1.9, desc: 'Подпускает близко и бьёт картечью почти без промаха; отходит, только когда вцепились.' },
	medic: { name: 'Медик', short: 'МЕД', keep: 1.7, burst: [2, 4], heals: true, retreat: 3.4, desc: 'Держится ближе всех и лечит героя и отряд из своей аптечки — пополняй её.' },
	sapper: { name: 'Подрывник', short: 'ПОД', keep: 2.6, burst: [3, 4], grenades: true, retreat: 3, desc: 'Кидает Ф-1 в кучу заражённых или в топтуна, если свои не рядом с целью. Гранаты даёшь ты.' },
};

export const MERCS = {
	shram: { name: 'Шрам', cls: 'assault', weapon: 'ak74', price: 120, hp: 120, tint: [0.55, 0.58, 0.48], desc: 'Бывший контрактник с АК-74. Ровный, надёжный, патроны бережёт.' },
	botsman: { name: 'Боцман', cls: 'assault', weapon: 'ak47', price: 130, hp: 130, tint: [0.46, 0.5, 0.62], desc: 'Здоровяк с АК-47. Шумный, зато бегун падает с пары попаданий.' },
	sych: { name: 'Сыч', cls: 'sniper', weapon: 'svd', price: 150, hp: 90, tint: [0.64, 0.66, 0.52], desc: 'Снайпер с СВД: заражённый падает с выстрела. Стреляет редко.' },
	tihonya: { name: 'Тихоня', cls: 'sniper', weapon: 'awm', price: 170, hp: 90, tint: [0.4, 0.44, 0.4], desc: 'Снайпер с Arctic Warfare: бьёт дальше всех и сильнее всех, после выстрела передёргивает затвор.' },
	kuvalda: { name: 'Кувалда', cls: 'gunner', weapon: 'rpk', price: 200, hp: 160, tint: [0.58, 0.5, 0.42], desc: 'Пулемётчик с РПК. Барабан на 75 — держит улицу, пока не кончится.' },
	ded: { name: 'Дед', cls: 'hunter', weapon: 'dbarrel', price: 80, hp: 140, tint: [0.78, 0.66, 0.52], desc: 'Старый охотник с двустволкой. Ждёт, пока подойдут, и не промахивается.' },
	dok: { name: 'Док', cls: 'medic', weapon: 'mp5', price: 140, hp: 100, tint: [0.86, 0.86, 0.82], desc: 'Медик с MP5. В аптечке две перевязки — дальше пополняешь ты.' },
	saper: { name: 'Сапёр', cls: 'sapper', weapon: 'aks', price: 150, hp: 120, tint: [0.5, 0.54, 0.4], desc: 'Подрывник с АКС-74У и двумя Ф-1 в разгрузке.' },
	// муры «Карьера» — нанимаются у их бригадира на одну вылазку (mur: true): вернулся в стаб или на базу — ушёл к своим
	kaban: { name: 'Кабан', cls: 'assault', weapon: 'ak47', price: 70, hp: 125, tint: [0.42, 0.36, 0.3], mur: true, desc: 'Мур с АК-47. Здоровый и злой — бьёт в упор.' },
	kosoy: { name: 'Косой', cls: 'assault', weapon: 'aks', price: 55, hp: 105, tint: [0.36, 0.34, 0.3], mur: true, desc: 'Мур с АКС-74У. Шустрый, патроны жжёт быстро.' },
	lom: { name: 'Лом', cls: 'gunner', weapon: 'rpk', price: 100, hp: 150, tint: [0.4, 0.33, 0.28], mur: true, desc: 'Мур-пулемётчик с РПК. Держит толпу, пока не кончится барабан.' },
	shilo: { name: 'Шило', cls: 'sniper', weapon: 'svd', price: 90, hp: 95, tint: [0.38, 0.38, 0.32], mur: true, desc: 'Мур со СВД. Снимает дальних, вблизи отходит.' },
};

/**
 * Звания наёмников: опыт — за убитых (XP_KILL) и уцелевшие вылазки (XP_SORTIE; с базы без героя — XP_TRIP); каждое
 * звание — точнее (RANK_BONUS.acc), крепче (hp) и быстрее перезаряжается (reload).
 */
export const RANKS = [
	{ name: 'Рядовой', xp: 0 }, { name: 'Ефрейтор', xp: 25 }, { name: 'Мл. сержант', xp: 70 }, { name: 'Сержант', xp: 150 }, { name: 'Старшина', xp: 280 },
];
export const RANK_BONUS = { acc: 0.07, hp: 0.1, reload: 0.08 };
export const XP_KILL = { runner: 1, stomper: 4, ruber: 8, elite: 20, skreber: 60, murs: 5, ext: 7 };
export const XP_SORTIE = 5, XP_TRIP = 6;
/** Звание бойца (номер в RANKS). */
export function rankOf(st) { let r = 0; for (let i = 0; i < RANKS.length; i++) if ((st?.xp ?? 0) >= RANKS[i].xp) r = i; return r; }
/** Полное здоровье бойца с учётом звания. */
export function mercMaxHp(st) { return Math.round(MERCS[st.id].hp * (1 + RANK_BONUS.hp * rankOf(st))); }
/** «Сержант ★★★» и сколько до следующего звания. */
export function rankText(st) {
	const r = rankOf(st), next = RANKS[r + 1];
	return { name: RANKS[r].name, stars: '★'.repeat(r), next: next ? `${st.xp ?? 0}/${next.xp} опыта` : 'высшее звание', frac: next ? ((st.xp ?? 0) - RANKS[r].xp) / (next.xp - RANKS[r].xp) : 1 };
}
/** Сколько бойцов можно взять на вылазку (остальные ждут у коек). */
export const MAX_PARTY = 4;
/** Коек в комнате героя в стабе. */
export const ROOM_BEDS = 6;
/** Мест для наёмников на базе «Опорный»: без казармы — 2 (у костра), с казармой 1/2/3-го уровня — 6/8/10. */
export const BASE_BEDS = [2, 6, 8, 10];
/** Что сейчас делает боец (для окна): с героем, у койки, на посту, на вылазке. */
export function jobText(m, g) {
	if (m.job?.kind === 'post') return 'на посту на базе';
	if (m.job?.kind === 'trip') return `на вылазке в «${NODES[m.job.at].short}», вернётся ${approx(Math.max(0, m.job.end - g.world.time)).replace('~', 'через ~')}`;
	return m.out ? 'с тобой' : m.home === 'base' ? 'на базе «Опорный»' : 'у койки в стабе';
}

/** Сколько здоровья даёт одна аптечка: наёмнику от героя и раненому — от медика. */
export const MERC_HEAL = 60;
/** Сколько гранат и перевязок (аптечка медика) у бойца при найме. */
const KIT = { medic: { meds: 2 }, sapper: { nades: 2 } };
/** Патронов всего (в магазине и в запасе) у нанятого автоматчика — у кого оружие стреляет очередями. */
export const AUTO_START = 150;

/**
 * Новый наёмник: полный магазин и запас — у автоматчиков всего AUTO_START патронов, у остальных ещё один
 * магазин; дальше патроны даёт герой. out — идёт с героем (новый — ждёт в комнате); bed — его койка;
 * у медика аптечка (meds), у подрывника гранаты (nades).
 */
export const newMerc = (id, bed = 0) => {
	const D = MERCS[id], W = WEAPONS[D.weapon];
	return { id, hp: D.hp, mag: W.mag, ammo: spareAmmo(id), out: false, bed, ...KIT[D.cls] };
};
/** Запас патронов сверх магазина: автоматчикам — до 150 всего, дробовикам (у двустволки магазин на 2) — 10, остальным — магазин. */
export function spareAmmo(id) {
	const W = WEAPONS[MERCS[id].weapon];
	return W.auto < 0.2 ? Math.max(AUTO_START - W.mag, W.mag) : W.pellets ? 10 : W.mag;
}
/** Полный боекомплект бойца (магазин + запас) — до него он дома пополняется из казны базы. */
export const fullAmmo = (id) => WEAPONS[MERCS[id].weapon].mag + spareAmmo(id);
/** Сколько перевязок у медика и гранат у подрывника — до этого дома пополняются из казны. */
export const KIT_FULL = { meds: 2, nades: 2 };

// ---------- Наёмники на базе «Опорный»: посты и вылазки без героя ----------

/** Постов на базе для наёмников: два, с казармой — четыре. Боец на посту — часовой базы (+к обороне, base.js). */
export const BASE_POSTS = 2, BASE_POSTS_BARRACKS = 4;
/** Вылазка без героя: дорога туда и обратно + столько секунд мира на сам кластер. */
export const TRIP_WORK = 240;
/**
 * Чем кончится вылазка наёмника в кластер опасности danger: погиб ли, сколько здоровья потерял и патронов
 * сжёг, что принёс. bonus — казарма 3-го уровня (добычи на треть больше, гибнут реже). Без патронов — втрое опаснее.
 */
export function resolveTrip(st, danger = 1, bonus = false) {
	const D = MERCS[st.id], W = WEAPONS[D.weapon], d = Math.max(1, danger), max = mercMaxHp(st);
	const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
	const dry = st.mag + st.ammo <= 0;
	// бывалый (звание) гибнет реже: −10 % риска за ступень
	let risk = (0.04 + 0.06 * d) * (dry ? 3 : 1) * (0.6 + 0.8 * (1 - st.hp / max)) * (bonus ? 0.6 : 1) * (1 - 0.1 * rankOf(st));
	const dead = Math.random() < Math.min(0.85, risk);
	const used = Math.min(st.mag + st.ammo, ri(1, 3) * W.mag);
	const hurt = !dead && Math.random() < 0.3 + 0.08 * d ? Math.round(max * (0.2 + Math.random() * 0.4)) : 0;
	const k = bonus ? 1.33 : 1, loot = {};
	const add = (kind, n) => { n = Math.round(n * k); if (n > 0) loot[kind] = (loot[kind] ?? 0) + n; };
	if (!dead) {
		add('spore', ri(2, 5) * d);
		add(W.ammo, ri(8, 24));
		if (Math.random() < 0.35) add('ammo545', ri(10, 30));
		if (Math.random() < 0.15 * d) add('zhivchik', 1);
		if (Math.random() < 0.15) add('grenade', 1);
		if (d >= 2 && Math.random() < 0.3) add('peas', ri(1, 2));
		if (d >= 3 && Math.random() < 0.05) loot.pearl = 1;
	}
	return { dead, hurt, used, loot };
}

const $ = (id) => document.getElementById(id);

/** Звание в карточке: «Сержант ★★★» и полоска опыта до следующего. */
function rankBadge(m) {
	const t = rankText(m);
	return `<span class="rank" title="${t.next}">${t.name}${t.stars ? ` <i>${t.stars}</i>` : ''}<span class="xp"><i style="width:${(t.frac * 100).toFixed(0)}%"></i></span></span>`;
}

/**
 * Окно отряда: кто идёт с героем и кто ждёт в комнате. Взять/оставить — только в комнате героя; патроны, аптечку,
 * перевязки и гранаты — в комнате, на базе и в вылазке бойцу, рядом с которым стоишь (game.canEquip; подошёл к нему —
 * его карточка). У вербовщика у костра — ещё и кого можно нанять.
 */
export class PartyWindow {
	/** game: { roster, party, bag, icons, inRoom, canEquip(id), hire(id), giveAmmo(id, all), healMerc(id), giveMeds(id), giveNade(id), takeMerc(id), leaveMerc(id), dismiss(id), setPaused(bool) } */
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
			if (b.dataset.act === 'ammoAll') g.giveAmmo(id, true);
			if (b.dataset.act === 'heal') g.healMerc(id);
			if (b.dataset.act === 'meds') g.giveMeds(id);
			if (b.dataset.act === 'nade') g.giveNade(id);
			if (b.dataset.act === 'take') g.takeMerc(id);
			if (b.dataset.act === 'leave') g.leaveMerc(id);
			// отпустить совсем — только после подтверждения (кнопка рядом с наймом: раньше бойцы пропадали от случайного нажатия)
			if (b.dataset.act === 'dismiss') this.askDismiss = id;
			if (b.dataset.act === 'dismissNo') this.askDismiss = null;
			if (b.dataset.act === 'dismissYes') { this.askDismiss = null; g.dismiss(id); }
			if (b.dataset.act === 'relocate') g.relocate(id);
			if (b.dataset.act === 'hire') g.hire(id);
			if (b.dataset.act === 'hireMur') g.hireMur(id);
			if (b.dataset.act === 'post') g.postMerc(id);
			if (b.dataset.act === 'unpost') g.unpostMerc(id);
			if (b.dataset.act === 'trip') g.sendMerc(id, b.closest('.merc').querySelector('select')?.value);
			this.render();
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	/**
	 * hiring — открыто у вербовщика: можно нанимать; merc — подошёл к этому бойцу в комнате: только его карточка;
	 * base — на базе (казарма, терминал): посты и вылазки без героя.
	 */
	open({ hiring = false, merc = null, base = false, murs = false } = {}) {
		if (this.isOpen) return;
		this.hiring = hiring;
		this.murs = murs; // бригадир «Карьера»: муры на одну вылазку
		this.baseMode = base;
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
		if (this.baseMode) { this.renderBase(); return; }
		const g = this.game, bag = g.bag, icons = g.icons ?? {}, room = g.inRoom;
		const face = (id) => (icons[`merc_${id}`] ? `<img class="npc-face" src="${icons[`merc_${id}`]}" alt="">` : '');
		const badge = (cls) => `<span class="cls cls-${cls}">${CLASSES[cls].name}</span>`;
		const full = g.party.length >= (g.partyMax ?? MAX_PARTY);
		$('party-spores').textContent = `${bag.spore ?? 0} · казна базы ${g.world?.base?.treasury ?? 0}`;
		const card = (m) => {
			const D = MERCS[m.id], C = CLASSES[D.cls], W = WEAPONS[D.weapon], spare = bag[W.ammo] ?? 0, give = Math.min(spare, W.mag), max = mercMaxHp(m);
			// снарядить можно в комнате, на базе и в вылазке — стоя рядом с бойцом; дома патроны, перевязки и гранаты
			// боец пополняет сам — за счёт казны базы (game.resupplyMercs)
			const here = room || !!g.canEquip?.(m.id), atHome = room || !!g.atBase;
			let move = '';
			if (g.canLeave?.(m.id)) move = `<button class="stay small" data-act="leave" data-id="${m.id}">${g.inRoom ? 'Оставить у койки' : 'Оставить на базе'}</button>`;
			if (g.canTake?.(m.id)) move = `<button class="buy" data-act="take" data-id="${m.id}" ${full ? 'disabled' : ''}>Взять с собой</button>`;
			// переселить: из комнаты стаба — на базу, с базы — в стаб (если там есть место)
			if (g.canRelocate?.(m.id)) {
				const to = g.homeOf(m) === 'base' ? 'stab' : 'base', cap = to === 'base' ? g.baseBeds() : ROOM_BEDS, free = g.freeBed(to) != null;
				const used = g.roster.filter((o) => g.homeOf(o) === to).length;
				move += `<button class="stay small" data-act="relocate" data-id="${m.id}" ${free ? '' : 'disabled'}>${to === 'base' ? 'На базу «Опорный»' : 'Перевести в стаб'} <small>(мест ${used}/${cap})</small></button>`;
			}
			// своё снаряжение класса: аптечка медика, гранаты подрывника
			let kit = '', stock = '';
			if (C.heals) { stock = ` · в аптечке ${m.meds ?? 0}`; if (here) kit = `<button class="buy" data-act="meds" data-id="${m.id}" ${(bag.medkit ?? 0) > 0 ? '' : 'disabled'}>В аптечку перевязку <small>(есть ${bag.medkit ?? 0})</small></button>`; }
			if (C.grenades) { stock = ` · гранат ${m.nades ?? 0}`; if (here) kit = `<button class="buy" data-act="nade" data-id="${m.id}" ${(bag.grenade ?? 0) > 0 ? '' : 'disabled'}>Ф-1 +1 <small>(есть ${bag.grenade ?? 0})</small></button>`; }
			const dry = m.mag + m.ammo <= 0;
			return `<div class="merc" data-merc="${m.id}">
				${face(m.id)}
				<div class="merc-text"><b>${D.name}</b> ${badge(D.cls)} <span class="muted">${W.name}</span> ${m.temp ? '<span class="rank mur">мур · на одну вылазку</span>' : rankBadge(m)}
					<div class="merc-hp"><i style="width:${Math.max(0, (m.hp / max) * 100).toFixed(0)}%"></i></div>
					<span>здоровье ${Math.ceil(m.hp)}/${max} · <span class="${dry ? 'warn' : ''}">патроны ${m.mag} + ${m.ammo} (${AMMO[W.ammo]})${dry ? ' — без патронов не отобьётся' : ''}</span>${stock}</span></div>
				<div class="merc-btns">
					${move}
					${here && !atHome ? `<button class="buy" data-act="ammo" data-id="${m.id}" ${give ? '' : 'disabled'}>Патроны +${give || W.mag} <small>(есть ${spare})</small></button>
					${spare > W.mag ? `<button class="buy" data-act="ammoAll" data-id="${m.id}">Все ${spare}</button>` : ''}` : ''}${here && atHome ? `<span class="muted">патроны — из казны базы</span>` : ''}${here ? `
					<button class="buy" data-act="heal" data-id="${m.id}" ${(bag.medkit ?? 0) > 0 && m.hp < max ? '' : 'disabled'}>Аптечка +${MERC_HEAL} <small>(есть ${bag.medkit ?? 0})</small></button>` : ''}
					${kit}
					${this.hiring && (!this.murs || m.temp) ? (this.askDismiss === m.id ? `<span class="warn">Отпустить ${D.name} совсем?</span><button class="stay small" data-act="dismissYes" data-id="${m.id}">Да, отпустить</button><button class="buy" data-act="dismissNo" data-id="${m.id}">Нет</button>` : `<button class="stay small dismiss" data-act="dismiss" data-id="${m.id}">Отпустить совсем…</button>`) : ''}
				</div></div>`;
		};
		const home = g.roster.filter((m) => !m.out && !m.job), one = (room || g.canEquip?.(this.focus)) && g.roster.find((m) => m.id === this.focus && !m.job);
		const homeOf = (m) => (g.homeOf ? g.homeOf(m) : 'stab');
		const inStab = home.filter((m) => homeOf(m) === 'stab'), inBase = home.filter((m) => homeOf(m) === 'base');
		const busy = g.roster.filter((m) => m.job);
		let html = '';
		if (one) {
			// подошёл к бойцу: только его карточка
			html += `<div class="trade-sec">${one.out ? `С тобой (${g.party.length}/${g.partyMax ?? MAX_PARTY})` : `У своей койки · с тобой ${g.party.length}/${g.partyMax ?? MAX_PARTY}`}</div>${card(one)}`;
		} else {
			html += `<div class="trade-sec">С тобой (${g.party.length}/${g.partyMax ?? MAX_PARTY})</div>`;
			html += g.party.map(card).join('') || `<div class="muted">${g.roster.length ? 'Никого — возьми бойца у его койки в комнате.' : 'Наёмников нет. Нанять можно у костра в стабе «Полис».'}</div>`;
			if (inStab.length) {
				html += `<div class="trade-sec">В твоей комнате в стабе (${inStab.length}/${ROOM_BEDS})</div>`;
				html += room || (this.hiring && !this.murs) ? inStab.map(card).join('') : `<div class="muted">${inStab.map((m) => MERCS[m.id].name).join(', ')} — ждут у своих коек.</div>`;
			}
			if (inBase.length) {
				html += `<div class="trade-sec">На базе «Опорный» (${inBase.length}/${g.baseBeds?.() ?? 0})</div>`;
				html += g.atBase || (this.hiring && !this.murs) ? inBase.map(card).join('') : `<div class="muted">${inBase.map((m) => MERCS[m.id].name).join(', ')} — ждут на базе у казармы.</div>`;
			}
			if (busy.length) html += `<div class="trade-sec">На базе «Опорный» (${busy.length})</div><div class="muted">${busy.map((m) => `${MERCS[m.id].name} — ${jobText(m, g)}`).join('; ')}.</div>`;
			if (g.roster.length && !room) html += '<div class="muted">Снарядить бойца — патроны, аптечка, перевязки, гранаты — подойди к нему (когда рядом нет врагов — «Снарядить»). Взять с собой или оставить — только в твоей комнате в стабе, у коек.</div>';
		}
		if (this.hiring && this.murs) {
			// бригадир «Карьера»: мур идёт сразу с героем, без койки, и уходит к своим, когда герой вернётся домой
			const free = Object.entries(MERCS).filter(([id, D]) => D.mur && !g.roster.some((m) => m.id === id));
			html += `<div class="trade-sec">Нанять мура на одну вылазку <span class="muted">· с тобой ${g.party.length}/${g.partyMax ?? MAX_PARTY}${g.mursStance?.() === 'friend' ? ' · «своим» — на четверть дешевле' : ''}</span></div>`;
			html += free.map(([id, D]) => {
				const W = WEAPONS[D.weapon], price = g.murPrice?.(id) ?? D.price;
				return `<div class="merc" data-hire="${id}">
					${face(id)}
					<div class="merc-text"><b>${D.name}</b> ${badge(D.cls)} <span class="muted">${W.name} · ${AMMO[W.ammo]} · здоровье ${D.hp}</span><span>${D.desc}</span></div>
					<div class="merc-btns"><button class="buy" data-act="hireMur" data-id="${id}" ${full || (bag.spore ?? 0) < price ? 'disabled' : ''}>Нанять · ${price} сп.</button></div></div>`;
			}).join('') || '<div class="muted">Свободных бойцов нет — все уже с тобой.</div>';
		} else if (this.hiring) {
			// вербовщик: свободные бойцы по классам; коек в комнате нет — нанятый уходит на базу
			const stabFree = g.freeBed ? ROOM_BEDS - g.roster.filter((m) => homeOf(m) === 'stab').length : ROOM_BEDS - g.roster.length;
			const baseCap = g.baseBeds?.() ?? 0, baseFree = g.freeBed ? baseCap - g.roster.filter((m) => homeOf(m) === 'base').length : 0;
			const where = stabFree > 0 ? 'stab' : baseFree > 0 ? 'base' : null, beds = !where;
			html += `<div class="trade-sec">Нанять <span class="muted">· в комнате свободных коек ${Math.max(0, stabFree)} из ${ROOM_BEDS}, на базе мест ${Math.max(0, baseFree)} из ${baseCap}${beds ? ' — мест нет, улучши казарму на базе' : where === 'base' ? ' — нанятый пойдёт на базу' : ''}</span></div>`;
			for (const [cls, C] of Object.entries(CLASSES)) {
				const free = Object.entries(MERCS).filter(([id, D]) => D.cls === cls && !D.mur && !g.roster.some((m) => m.id === id));
				if (!free.length) continue;
				html += `<div class="cls-head">${badge(cls)} <span class="muted">${C.desc}</span></div>`;
				html += free.map(([id, D]) => {
					const W = WEAPONS[D.weapon];
					return `<div class="merc" data-hire="${id}">
						${face(id)}
						<div class="merc-text"><b>${D.name}</b> <span class="muted">${W.name} · ${AMMO[W.ammo]} · здоровье ${D.hp}</span><span>${D.desc}</span></div>
						<div class="merc-btns"><button class="buy" data-act="hire" data-id="${id}" ${beds || (bag.spore ?? 0) < D.price ? 'disabled' : ''}>Нанять · ${D.price} сп.${where === 'base' ? ' (на базу)' : ''}</button></div></div>`;
				}).join('');
			}
		}
		$('party-list').innerHTML = html;
		if (this.murs) { $('party-hint').textContent = 'Мур идёт с тобой сразу и дерётся как наёмник — патроны и аптечку даёшь ты. Койки ему не нужно: вернёшься в стаб, на базу или в «Карьер» — уйдёт к своим. Нападёшь на муров — уйдёт сразу: против своих не пойдёт. Опыта не копит.'; return; }
		$('party-hint').textContent = `Патроны, перевязки и гранаты бойцы дома (в стабе и на базе) пополняют сами — за счёт казны базы (положить спораны в казну — в терминале базы, вкладка «Хозяйство»). Нанятые живут в твоей комнате в стабе (${ROOM_BEDS} коек) или на базе «Опорный» (места у казармы — больше с её уровнем): из комнаты бойца можно отправить на базу и обратно. Взять с собой или оставить — у его дома. Снарядить — патроны их калибра, аптечку (${ITEMS.medkit.name} — +${MERC_HEAL}; сами они не лечатся), медику перевязки, подрывнику гранаты — можно и в вылазке: подойди к бойцу, когда рядом нет врагов. Без патронов боец гибнет. Прёт заражённый — бойцы пятятся к тебе и стреляют. На вылазку — не больше ${g.partyMax ?? MAX_PARTY} (с казармой на базе — на двоих больше); вернувшись домой (в стаб или на базу), они снова на своих местах.`;
	}

	/** На базе: каждого бойца — на пост (часовой, оборона выше) или на вылазку в кластер без героя; снарядить. */
	renderBase() {
		const g = this.game, bag = g.bag, icons = g.icons ?? {};
		const face = (id) => (icons[`merc_${id}`] ? `<img class="npc-face" src="${icons[`merc_${id}`]}" alt="">` : '');
		const posted = g.roster.filter((m) => m.job?.kind === 'post').length, max = g.postsMax();
		const clusters = Object.keys(NODES).filter((id) => NODES[id].kind === 'cluster');
		$('party-spores').textContent = bag.spore ?? 0;
		let html = `<div class="trade-sec">Посты на базе: ${posted}/${max} <span class="muted">· каждый на посту — к обороне базы; при прорыве заражённых часовые ранены</span></div>`;
		html += g.roster.map((m) => {
			const D = MERCS[m.id], W = WEAPONS[D.weapon], spare = bag[W.ammo] ?? 0, give = Math.min(spare, W.mag), dry = m.mag + m.ammo <= 0, max = mercMaxHp(m);
			const trip = m.job?.kind === 'trip', post = m.job?.kind === 'post';
			const opts = clusters.map((id) => `<option value="${id}">${NODES[id].short} · опасность ${NODES[id].danger ?? 1} · ${approx(g.tripTime(id))}</option>`).join('');
			const acts = trip ? '<button class="buy" disabled>В пути</button>'
				: `${post ? `<button class="stay small" data-act="unpost" data-id="${m.id}">Снять с поста</button>` : `<button class="buy" data-act="post" data-id="${m.id}" ${posted >= max ? 'disabled' : ''}>На пост</button>`}
					<span class="trip"><select aria-label="Куда">${opts}</select><button class="buy" data-act="trip" data-id="${m.id}">На вылазку</button></span>
					<span class="muted">патроны — из казны базы</span>
					<button class="buy" data-act="heal" data-id="${m.id}" ${(bag.medkit ?? 0) > 0 && m.hp < max ? '' : 'disabled'}>Аптечка +${MERC_HEAL}</button>`;
			return `<div class="merc" data-merc="${m.id}">${face(m.id)}
				<div class="merc-text"><b>${D.name}</b> <span class="cls cls-${D.cls}">${CLASSES[D.cls].name}</span> <span class="muted">${W.name}</span> ${m.temp ? '' : rankBadge(m)}
					<div class="merc-hp"><i style="width:${Math.max(0, (m.hp / max) * 100).toFixed(0)}%"></i></div>
					<span>${jobText(m, g)} · здоровье ${Math.ceil(m.hp)}/${max} · <span class="${dry ? 'warn' : ''}">патроны ${m.mag} + ${m.ammo}${dry ? ' — без патронов на вылазке почти верная гибель' : ''}</span></span></div>
				<div class="merc-btns">${acts}</div></div>`;
		}).join('') || '<div class="muted">Наёмников нет. Нанять можно у костра в стабе «Полис».</div>';
		const log = g.world.base?.trips ?? [];
		if (log.length) html += `<div class="trade-sec">Вылазки</div><div class="muted">${log.slice(0, 4).map((t) => t.text).join('; ')}.</div>`;
		$('party-list').innerHTML = html;
		$('party-hint').textContent = 'На посту боец — часовой базы: бьёт заражённых и прибавляет к обороне, пока ты в Улье. На вылазке — сам ходит в кластер: чем опаснее кластер, тем больше добычи и выше риск; раненый и без патронов гибнет чаще. Добыча — на склад базы (забрать у терминала), боец возвращается домой — к койке в стабе или к казарме на базе.';
	}
}
