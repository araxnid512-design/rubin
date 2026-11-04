// Наёмники стаба: у каждого своё постоянное оружие. Еда им не нужна — нужны патроны их калибра
// (сами перезаряжаются из своего запаса) и аптечки: сами они не лечатся.
// Нанимают у костра в стабе; нанятый живёт в комнате героя (там шесть коек) и стоит у своей койки.
// Снарядить его — дать патроны и аптечку — и взять с собой можно только там: в бою пополнить нечем,
// а без патронов боец гибнет от первой же атаки, так что запас продумывают заранее. В отряде — не больше
// четырёх (MAX_PARTY); вернувшись в стаб, уцелевшие снова расходятся по койкам. Служит, пока жив.
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
	assault: { name: 'Штурмовик', short: 'ШТ', keep: 2.3, burst: [3, 5], desc: 'Держится рядом, бьёт короткими очередями по ближайшим.' },
	sniper: { name: 'Снайпер', short: 'СН', keep: 4.2, prefer: 'far', kite: 3.5, desc: 'Идёт поодаль, первым снимает топтунов и дальних. Вблизи беззащитен — отходит.' },
	gunner: { name: 'Пулемётчик', short: 'ПУЛ', keep: 2.9, burst: [9, 15], plant: true, desc: 'Держит толпу длинными очередями; стреляет стоя, перезаряжается долго.' },
	hunter: { name: 'Охотник', short: 'ОХ', keep: 1.9, desc: 'Подпускает близко и бьёт картечью почти без промаха.' },
	medic: { name: 'Медик', short: 'МЕД', keep: 1.7, burst: [2, 4], heals: true, desc: 'Держится ближе всех и лечит героя и отряд из своей аптечки — пополняй её.' },
	sapper: { name: 'Подрывник', short: 'ПОД', keep: 2.6, burst: [3, 4], grenades: true, desc: 'Кидает Ф-1 в кучу заражённых или в топтуна, если свои не рядом с целью. Гранаты даёшь ты.' },
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
};
/** Сколько бойцов можно взять на вылазку (остальные ждут у коек). */
export const MAX_PARTY = 4;
/** Коек в комнате героя — столько наёмников можно нанять. */
export const ROOM_BEDS = 6;
/** Что сейчас делает боец (для окна): с героем, у койки, на посту, на вылазке. */
export function jobText(m, g) {
	if (m.job?.kind === 'post') return 'на посту на базе';
	if (m.job?.kind === 'trip') return `на вылазке в «${NODES[m.job.at].short}», вернётся ${approx(Math.max(0, m.job.end - g.world.time)).replace('~', 'через ~')}`;
	return m.out ? 'с тобой' : 'у койки в стабе';
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
	// автоматчикам — 150 патронов, дробовикам (у двустволки магазин на 2) — 10 в запас, остальным — магазин
	const ammo = W.auto < 0.2 ? Math.max(AUTO_START - W.mag, W.mag) : W.pellets ? 10 : W.mag;
	return { id, hp: D.hp, mag: W.mag, ammo, out: false, bed, ...KIT[D.cls] };
};

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
	const D = MERCS[st.id], W = WEAPONS[D.weapon], d = Math.max(1, danger);
	const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
	const dry = st.mag + st.ammo <= 0;
	let risk = (0.04 + 0.06 * d) * (dry ? 3 : 1) * (0.6 + 0.8 * (1 - st.hp / D.hp)) * (bonus ? 0.6 : 1);
	const dead = Math.random() < Math.min(0.85, risk);
	const used = Math.min(st.mag + st.ammo, ri(1, 3) * W.mag);
	const hurt = !dead && Math.random() < 0.3 + 0.08 * d ? Math.round(D.hp * (0.2 + Math.random() * 0.4)) : 0;
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

/**
 * Окно отряда: кто идёт с героем и кто ждёт в комнате. Патроны, аптечка, взять/оставить — только в комнате
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
	open({ hiring = false, merc = null, base = false } = {}) {
		if (this.isOpen) return;
		this.hiring = hiring;
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
		$('party-spores').textContent = bag.spore ?? 0;
		const card = (m) => {
			const D = MERCS[m.id], C = CLASSES[D.cls], W = WEAPONS[D.weapon], spare = bag[W.ammo] ?? 0, give = Math.min(spare, W.mag);
			let move = '';
			if (room && m.out) move = `<button class="stay small" data-act="leave" data-id="${m.id}">Оставить у койки</button>`;
			if (room && !m.out) move = `<button class="buy" data-act="take" data-id="${m.id}" ${full ? 'disabled' : ''}>Взять с собой</button>`;
			// своё снаряжение класса: аптечка медика, гранаты подрывника
			let kit = '', stock = '';
			if (C.heals) { stock = ` · в аптечке ${m.meds ?? 0}`; if (room) kit = `<button class="buy" data-act="meds" data-id="${m.id}" ${(bag.medkit ?? 0) > 0 ? '' : 'disabled'}>В аптечку перевязку <small>(есть ${bag.medkit ?? 0})</small></button>`; }
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
					<button class="buy" data-act="heal" data-id="${m.id}" ${(bag.medkit ?? 0) > 0 && m.hp < D.hp ? '' : 'disabled'}>Аптечка +${MERC_HEAL} <small>(есть ${bag.medkit ?? 0})</small></button>` : ''}
					${kit}
					${this.hiring ? `<button class="stay small" data-act="dismiss" data-id="${m.id}">Отпустить совсем</button>` : ''}
				</div></div>`;
		};
		const home = g.roster.filter((m) => !m.out && !m.job), one = room && g.roster.find((m) => m.id === this.focus && !m.job);
		const busy = g.roster.filter((m) => m.job);
		let html = '';
		if (one) {
			// подошёл к бойцу: только его карточка
			html += `<div class="trade-sec">${one.out ? `С тобой (${g.party.length}/${g.partyMax ?? MAX_PARTY})` : `У своей койки · с тобой ${g.party.length}/${g.partyMax ?? MAX_PARTY}`}</div>${card(one)}`;
		} else {
			html += `<div class="trade-sec">С тобой (${g.party.length}/${g.partyMax ?? MAX_PARTY})</div>`;
			html += g.party.map(card).join('') || `<div class="muted">${g.roster.length ? 'Никого — возьми бойца у его койки в комнате.' : 'Наёмников нет. Нанять можно у костра в стабе «Полис».'}</div>`;
			if (home.length) {
				html += `<div class="trade-sec">В твоей комнате в стабе (${home.length})</div>`;
				html += room || this.hiring ? home.map(card).join('') : `<div class="muted">${home.map((m) => MERCS[m.id].name).join(', ')} — ждут у своих коек.</div>`;
			}
			if (busy.length) html += `<div class="trade-sec">На базе «Опорный» (${busy.length})</div><div class="muted">${busy.map((m) => `${MERCS[m.id].name} — ${jobText(m, g)}`).join('; ')}.</div>`;
			if (g.roster.length && !room) html += '<div class="muted">Снарядить бойцов — патроны, аптечка — и взять с собой можно только в твоей комнате в стабе, у их коек (и на базе — в казарме).</div>';
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
		$('party-hint').textContent = `Нанятые живут в твоей комнате в стабе и стоят у своих коек: подойди к бойцу — дашь патроны их калибра и аптечку (${ITEMS.medkit.name} — +${MERC_HEAL}; сами они не лечатся), возьмёшь с собой или оставишь. В бою пополнить нечем, а без патронов боец гибнет — продумывай запас заранее. На вылазку — не больше ${g.partyMax ?? MAX_PARTY} (с казармой на базе — на двоих больше); вернувшись в стаб, они снова у коек. Медику пополняй аптечку, подрывнику — гранаты.`;
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
			const D = MERCS[m.id], W = WEAPONS[D.weapon], spare = bag[W.ammo] ?? 0, give = Math.min(spare, W.mag), dry = m.mag + m.ammo <= 0;
			const trip = m.job?.kind === 'trip', post = m.job?.kind === 'post';
			const opts = clusters.map((id) => `<option value="${id}">${NODES[id].short} · опасность ${NODES[id].danger ?? 1} · ${approx(g.tripTime(id))}</option>`).join('');
			const acts = trip ? '<button class="buy" disabled>В пути</button>'
				: `${post ? `<button class="stay small" data-act="unpost" data-id="${m.id}">Снять с поста</button>` : `<button class="buy" data-act="post" data-id="${m.id}" ${posted >= max ? 'disabled' : ''}>На пост</button>`}
					<span class="trip"><select aria-label="Куда">${opts}</select><button class="buy" data-act="trip" data-id="${m.id}">На вылазку</button></span>
					<button class="buy" data-act="ammo" data-id="${m.id}" ${give ? '' : 'disabled'}>Патроны +${give || W.mag} <small>(есть ${spare})</small></button>
					<button class="buy" data-act="heal" data-id="${m.id}" ${(bag.medkit ?? 0) > 0 && m.hp < D.hp ? '' : 'disabled'}>Аптечка +${MERC_HEAL}</button>`;
			return `<div class="merc" data-merc="${m.id}">${face(m.id)}
				<div class="merc-text"><b>${D.name}</b> <span class="cls cls-${D.cls}">${CLASSES[D.cls].name}</span> <span class="muted">${W.name}</span>
					<div class="merc-hp"><i style="width:${Math.max(0, (m.hp / D.hp) * 100).toFixed(0)}%"></i></div>
					<span>${jobText(m, g)} · здоровье ${Math.ceil(m.hp)}/${D.hp} · <span class="${dry ? 'warn' : ''}">патроны ${m.mag} + ${m.ammo}${dry ? ' — без патронов на вылазке почти верная гибель' : ''}</span></span></div>
				<div class="merc-btns">${acts}</div></div>`;
		}).join('') || '<div class="muted">Наёмников нет. Нанять можно у костра в стабе «Полис».</div>';
		const log = g.world.base?.trips ?? [];
		if (log.length) html += `<div class="trade-sec">Вылазки</div><div class="muted">${log.slice(0, 4).map((t) => t.text).join('; ')}.</div>`;
		$('party-list').innerHTML = html;
		$('party-hint').textContent = 'На посту боец — часовой базы: бьёт заражённых и прибавляет к обороне, пока ты в Улье. На вылазке — сам ходит в кластер: чем опаснее кластер, тем больше добычи и выше риск; раненый и без патронов гибнет чаще. Добыча — на склад базы (забрать у терминала), боец возвращается к своей койке в стабе.';
	}
}
