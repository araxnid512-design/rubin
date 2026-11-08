// Терминал базы «Опорный» (game/base.js, game/economy.js). Вкладки:
// «Постройки» — 20 построек: что это, что даёт, почём; купленная сразу встаёт на место (game.buyBuilding перестраивает
// локацию), построенную можно улучшить до 2-го и 3-го уровня (game.upgradeBuilding);
// «Хозяйство» — склад ресурсов (сдать из рюкзака, взять), генератор и бензин, производство на постройках: кто работает,
// что из чего делается;
// «Жители» — кто живёт на базе, на какой работе, настроение (еда и плата), беженцы у ворот — принять;
// «Караваны» — продать со склада или купить в «Полисе» и «Карьере» по ценам спроса, караваны в пути.
// Сверху — спораны, оборона и накопленное добро построек (забрать одной кнопкой; ресурсы остаются на складе — сырьё);
// снизу — последние нападения на базу. Пока окно открыто — пауза.

import { BUILDINGS, BUILD_IDS, MAX_LEVEL, cantBuy, cantUpgrade, defense, givesNow, has, level } from './base.js';
import { ITEMS, RESOURCES, plural } from './items.js';
import { WORK, MARKETS, REFUGEE_PRICE, WAGE, FOOD_EACH, UPKEEP, GEN_BURN, RES_USE, peopleCap, workersOn, priceOf, sellValue, buyCost, powered, moraleK } from './economy.js';
import { approx } from './world.js';

const $ = (id) => document.getElementById(id);
const TABS = ['build', 'eco', 'people', 'caravan'];

export class TerminalWindow {
	/** game: { bag, world, roster, icons, partyWindow, buyBuilding(id), upgradeBuilding(id), collectBase(), depositRes(), takeRes(k, n), acceptRefugee(), assignJob(pid, job), releasePerson(pid), caravan(m, k, n, mode), mursStance(), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('terminal');
		this.tab = 'build';
		$('term-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		for (const b of document.querySelectorAll('#term-tabs [data-tab]')) b.onclick = () => { this.tab = b.dataset.tab; this.render(); };
		$('term-list').addEventListener('click', (e) => {
			const g = this.game, t = e.target.closest('button');
			if (!t || t.disabled) return;
			const d = t.dataset;
			if (d.build) g.buyBuilding(d.build);
			if (d.up) g.upgradeBuilding(d.up);
			if (d.deposit) g.depositRes();
			if (d.tin) g.toTreasury(d.tin === 'all' ? Infinity : +d.tin);
			if (d.tout) g.fromTreasury(d.tout === 'all' ? Infinity : +d.tout);
			if (d.take) g.takeRes(d.take, d.n === 'all' ? Infinity : +d.n);
			if (d.accept) g.acceptRefugee();
			if (d.release) g.releasePerson(d.release);
			if (d.hire) { const free = g.world.base.people.find((p) => !p.job); if (free) g.assignJob(free.id, d.hire); else g.toast?.('Свободных жителей нет — прими беженца (вкладка «Жители»)', 'warn'); }
			if (d.fire) { const p = g.world.base.people.find((x) => x.job === d.fire); if (p) g.assignJob(p.id, null); }
			if (d.sell) g.caravan(d.market, d.sell, d.n === 'all' ? g.world.base.stock[d.sell] ?? 0 : +d.n, 'sell');
			if (d.buy) g.caravan(d.market, d.buy, +d.n, 'buy');
			this.render();
		});
		$('term-list').addEventListener('change', (e) => {
			const s = e.target.closest('select[data-job]');
			if (s) { this.game.assignJob(s.dataset.job, s.value || null); this.render(); }
		});
		$('term-collect').onclick = () => { this.game.collectBase(); this.render(); };
		// наёмники: посты на базе и вылазки без героя (окно отряда в режиме базы)
		$('term-mercs').onclick = () => { this.close(); this.game.partyWindow.open({ base: true }); };
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	open(tab) {
		if (this.isOpen) return;
		if (TABS.includes(tab)) this.tab = tab;
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
		$('term-treasury').textContent = b.treasury ?? 0;
		$('term-def').textContent = defense(b);
		$('term-count').textContent = `${b.built.length}/${BUILD_IDS.length}`;
		for (const t of document.querySelectorAll('#term-tabs [data-tab]')) t.classList.toggle('on', t.dataset.tab === this.tab);
		// накопленное добро построек (ресурсы — на вкладке «Хозяйство»)
		const stock = Object.entries(b.stock).filter(([k, n]) => n > 0 && !RESOURCES.includes(k));
		$('term-stock-text').innerHTML = stock.length
			? `Накоплено: <b>${stock.map(([k, n]) => `${ITEMS[k].name.toLowerCase()} ×${n}`).join(', ')}</b>`
			: 'Накопленного нет — теплица, ферма, мастерская, медпункт и склад копят добро, пока ты в Улье; наёмники с вылазок приносят добычу сюда же';
		$('term-collect').disabled = !stock.length;
		$('term-mercs').disabled = !g.roster.length;
		$('term-list').innerHTML = this.tab === 'eco' ? this.eco() : this.tab === 'people' ? this.people() : this.tab === 'caravan' ? this.caravans() : this.builds();
		// последние нападения
		$('term-log').innerHTML = b.log.length
			? `Нападения на базу: ${b.log.slice(0, 3).map((a) => a.held ? `отбились (сила ${a.power}, оборона ${a.def})` : `прорвались (сила ${a.power}, оборона ${a.def}) — накопленное растащили`).join('; ')}.`
			: 'Пока ты в Улье, на базу нападают заражённые: оборона не меньше силы нападения — отбиваются, иначе накопленное (и ресурсы склада) растаскивают. Сила растёт с каждым разом.';
	}

	/** Постройки: купить и улучшить. */
	builds() {
		const g = this.game, b = g.world.base, spores = g.bag.spore ?? 0;
		return BUILD_IDS.map((id) => {
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
			const W = WORK[id];
			return `<div class="offer build${done ? ' owned' : ''}">
				<div class="offer-text"><b>${B.name}${done ? ` <i class="lv">ур. ${lv}</i>` : ''}</b>
					<span class="gives">${givesNow(b, id)}</span><span>${B.desc}</span>${W ? `<span class="muted">Жители: ${W.name} — ${recipe(W)}</span>` : ''}${next}</div>
				${btn}
			</div>`;
		}).join('');
	}

	/** Хозяйство: склад ресурсов, генератор, производство. */
	eco() {
		const g = this.game, b = g.world.base, icons = g.icons ?? {};
		const bagRes = RESOURCES.filter((k) => (g.bag[k] ?? 0) > 0).map((k) => `${ITEMS[k].name.toLowerCase()} ×${g.bag[k]}`);
		const tr = b.treasury ?? 0, my = g.bag.spore ?? 0;
		// казна базы — отдельно от твоих споранов: из неё плата жителям, покупки караванов и патроны наёмникам
		let html = `<div class="trade-sec">Казна базы: ${tr} сп. · твои спораны: ${my}</div>`;
		html += `<div class="eco-row"><div class="eco-text"><span>Из казны жители получают плату, караваны покупают товар, а наёмники дома (в стабе и на базе) сами пополняют патроны, перевязки и гранаты — покупать им патроны не нужно. В казну идут доход споровой фермы, выручка караванов и трофеи.</span></div>
			<button class="buy" data-tin="50" ${my >= 50 ? '' : 'disabled'}>В казну 50</button><button class="buy" data-tin="all" ${my ? '' : 'disabled'}>Все мои в казну</button>
			<button class="stay small" data-tout="50" ${tr >= 50 ? '' : 'disabled'}>Взять 50</button><button class="stay small" data-tout="all" ${tr ? '' : 'disabled'}>Взять все</button></div>`;
		html += `<div class="trade-sec">Склад ресурсов</div>`;
		html += `<div class="eco-row"><div class="eco-text"><span>В рюкзаке: ${bagRes.join(', ') || 'ресурсов нет'}</span><span class="muted">Сырьё для жителей, караванов и верстака берётся со склада. Нападение заражённых, если прорвутся, растащит и его.</span></div><button class="buy" data-deposit="1" ${bagRes.length ? '' : 'disabled'}>Сдать всё на склад</button></div>`;
		html += RESOURCES.map((k) => {
			const n = b.stock[k] ?? 0;
			return `<div class="eco-row" title="${ITEMS[k].desc}">${icons[k] ? `<img src="${icons[k]}" alt="" width="34" height="34">` : ''}<div class="eco-text"><b>${ITEMS[k].name}: ${n}</b><span class="muted">${RES_USE[k]}</span></div>
				<button class="buy" data-take="${k}" data-n="1" ${n ? '' : 'disabled'}>Взять 1</button><button class="buy" data-take="${k}" data-n="all" ${n ? '' : 'disabled'}>Взять все</button></div>`;
		}).join('');
		// генератор
		const gen = has(b, 'generator');
		html += `<div class="trade-sec">Свет</div><div class="eco-row"><div class="eco-text"><b>Генератор: ${!gen ? 'не построен' : powered(b) ? 'работает' : 'стоит — нет бензина'}</b><span class="muted">Мастерской, оружейной и споровой ферме нужен свет. Пока там работают жители, генератор жжёт ${GEN_BURN.fuel} ${plural(GEN_BURN.fuel, ITEMS.fuel.forms)} бензина за ${approx(GEN_BURN.every)}. Бензин — с нефтебазы, из гаражей, с караваном.</span></div></div>`;
		// производство
		html += `<div class="trade-sec">Производство · настроение жителей ${Math.round(b.morale ?? 70)} % (выработка ×${moraleK(b.morale ?? 70)})</div>`;
		for (const [id, W] of Object.entries(WORK)) {
			const built = has(b, id), lv = level(b, id), n = workersOn(b, id), slots = W.slots + Math.max(0, lv - 1);
			const lack = built && n && W.in && Object.entries(W.in).filter(([r, q]) => (b.stock[r] ?? 0) < q).map(([r]) => ITEMS[r].name.toLowerCase());
			const dark = built && n && W.power && !powered(b);
			const state = !built ? `сначала построй: ${BUILDINGS[id].name}` : dark ? '<span class="warn">стоит — нет света (бензин в генератор)</span>' : lack?.length ? `<span class="warn">стоит — на складе нет: ${lack.join(', ')}</span>` : n ? `работают ${n} — партия раз в ${approx(W.every)}` : 'никто не работает';
			html += `<div class="eco-row"><div class="eco-text"><b>${BUILDINGS[id].name}: ${W.name}</b><span>${recipe(W)} · жителей ${n}/${built ? slots : W.slots}</span><span class="muted">${state}</span></div>
				<button class="buy" data-hire="${id}" ${built && n < slots ? '' : 'disabled'}>+ житель</button><button class="stay small" data-fire="${id}" ${n ? '' : 'disabled'}>− житель</button></div>`;
		}
		return html;
	}

	/** Жители: кто, где работает, беженцы. */
	people() {
		const g = this.game, b = g.world.base, cap = peopleCap(b, (id) => level(b, id));
		const opts = (p) => `<select data-job="${p.id}" ${p.job === 'caravan' ? 'disabled' : ''}><option value="">без работы</option>${p.job === 'caravan' ? '<option value="caravan" selected>в караване</option>' : ''}${Object.entries(WORK).filter(([id]) => has(b, id)).map(([id, W]) => `<option value="${id}" ${p.job === id ? 'selected' : ''}>${BUILDINGS[id].name} — ${W.name}</option>`).join('')}</select>`;
		let html = `<div class="trade-sec">Жители: ${b.people.length}/${cap} · настроение <span class="morale"><i style="width:${Math.round(b.morale ?? 70)}%"></i></span> ${Math.round(b.morale ?? 70)} %</div>`;
		html += `<div class="eco-row"><div class="eco-text"><span>Раз в ${approx(UPKEEP)} каждый ест ${FOOD_EACH} ${plural(FOOD_EACH, ITEMS.food.forms)} со склада и получает ${WAGE} сп. платы из казны базы (сейчас в казне ${b.treasury ?? 0} сп.; консервы — огород, тайники, караваны). Сыты и при деньгах — работают лучше; голодные и без платы — хуже, а потом уходят.</span></div></div>`;
		html += b.people.map((p) => `<div class="eco-row"><div class="eco-text"><b>${p.name}</b><span class="muted">${p.job === 'caravan' ? 'в караване' : p.job ? `${BUILDINGS[p.job]?.name}: ${WORK[p.job]?.name}` : 'без работы'}</span></div>${opts(p)}<button class="stay small" data-release="${p.id}" ${p.job === 'caravan' ? 'disabled' : ''}>Отпустить</button></div>`).join('') || '<div class="muted">На базе пока никто не живёт.</div>';
		html += `<div class="trade-sec">Беженцы у ворот: ${b.refugees ?? 0}</div><div class="eco-row"><div class="eco-text"><span>Приходят сами раз в полчаса — час, бывает — с караваном из «Полиса». Принять — одеть, накормить, дать койку.</span></div><button class="buy" data-accept="1" ${(b.refugees ?? 0) > 0 && b.people.length < cap && (g.bag.spore ?? 0) >= REFUGEE_PRICE ? '' : 'disabled'}>Принять · ${REFUGEE_PRICE} сп.</button></div>`;
		return html;
	}

	/** Караваны: продать со склада, купить, кто в пути. */
	caravans() {
		const g = this.game, b = g.world.base, w = g.world, stance = g.mursStance?.() ?? 'neutral';
		let html = `<div class="eco-row"><div class="eco-text"><span>Караван — житель с тележкой: везёт ресурсы со склада на рынок и продаёт (выручка — в казну базы, когда вернётся) или покупает (за казну базы — сейчас ${b.treasury ?? 0} сп., товар — на склад). Продаёшь много — цена падает, со временем возвращается. В дороге бывает, грабят.</span></div></div>`;
		for (const [m, M] of Object.entries(MARKETS)) {
			const busy = b.caravans.find((c) => c.market === m), off = m === 'murs' && stance === 'war';
			html += `<div class="trade-sec">${M.name}${off ? ' — война с мурами: не пойдут' : busy ? ` — караван в пути, вернётся ${approx(Math.max(0, busy.back - w.time)).replace('~', 'через ~')}` : ''}</div>`;
			html += RESOURCES.map((k) => {
				const n = b.stock[k] ?? 0, sp = priceOf(w, m, k), bp = priceOf(w, m, k, true), lock = off || !!busy || !b.people.some((p) => p.job !== 'caravan');
				return `<div class="eco-row"><div class="eco-text"><b>${ITEMS[k].name}</b><span>продать по ${sp} сп. · купить по ${bp} сп. · на складе ${n}</span></div>
					<button class="buy" data-sell="${k}" data-market="${m}" data-n="10" ${lock || n < 10 ? 'disabled' : ''}>Продать 10 · ${sellValue(w, m, k, 10)}</button>
					<button class="buy" data-sell="${k}" data-market="${m}" data-n="all" ${lock || !n ? 'disabled' : ''}>Всё · ${sellValue(w, m, k, n)}</button>
					<button class="buy" data-buy="${k}" data-market="${m}" data-n="5" ${lock || (b.treasury ?? 0) < buyCost(w, m, k, 5) ? 'disabled' : ''}>Купить 5 · ${buyCost(w, m, k, 5)}</button></div>`;
			}).join('');
		}
		if (!b.people.length) html += '<div class="muted">Каравану нужен житель — прими беженца на вкладке «Жители».</div>';
		return html;
	}
}

/** «металлолом ×3 → детали ×1». */
function recipe(W) {
	const list = (o) => Object.entries(o).map(([k, n]) => `${ITEMS[k].name.toLowerCase()} ×${n}`).join(' + ');
	return W.in ? `${list(W.in)} → ${list(W.out)}` : list(W.out);
}

/** «2 горошины, 16 споранов» — что забрал. */
export function stockText(got) {
	return Object.entries(got).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${plural(n, ITEMS[k].forms)}`).join(', ');
}
