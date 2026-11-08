// Карта Улья — местность: одна большая карта (север сверху) с рекой, озером, болотами, лесами и холмами (TERRAIN в
// world.js); пункты — кружки со снимком локации на своих местах (NODES[id].pos), рамка — цветом пояса, вокруг кластера —
// сколько осталось до перезагрузки; пояса — мягкие пятна цвета пояса под кластерами (на севере Чёрная зона, к югу —
// Глубина, Промзона, Окраина, внизу стаб и база). Дороги (ROUTES) — изгибистые просёлки между соседями, у дорог отсюда —
// время в пути. Идти можно в любую локацию: путь — по дорогам через соседние кластеры (shortestPath), время
// складывается, за каждый переход герой выпивает живчик (travelCost) — нет живчика, нет дороги (машина с базы —
// без живчика, game/main.js). Список справа — все локации по секторам: время, цена, что там. Открывается у выхода из
// локации. Нажал на пункт или «Выбрать» — пункт выбран: путь подсвечен, под картой — время, через что, сколько живчика
// нужно и сколько есть; переход — только кнопкой «Подтвердить». Время мира уходит на дорогу.

import { NODES, ROUTES, ZONES, BANDS, MAP_W, MAP_H, TERRAIN, bandOf, zoneOf, clustersOfZone, routesFrom, shortestPath, timeLeft, approx } from './world.js';
import { defense, BUILD_IDS } from './base.js';
import { asset } from './assets.js';
import { plural } from './items.js';
import { murStance, STANCE } from './murs.js';
import { CAR } from './economy.js';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const HOPS = ['переход', 'перехода', 'переходов'];

export class WorldMap {
	/** game: { world, loc, bag, travel(to) → false, если не хватило живчика, setPaused(bool), toast } */
	constructor(game) {
		this.game = game;
		this.el = $('worldmap');
		$('wm-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		// карточка или «Выбрать» — только выбор пункта (переход — кнопкой «Подтвердить» под схемой)
		$('wm-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-go]') ?? e.target.closest('.route[data-to]');
			const to = b?.dataset.go ?? b?.dataset.to;
			if (to) this.select(to);
		});
		// легенда поясов: нажал — подсветить кластеры пояса на схеме (ещё раз — снять)
		$('wm-legend')?.addEventListener('click', (e) => {
			const b = e.target.closest('[data-zone]');
			if (!b) return;
			this.zone = this.zone === +b.dataset.zone ? null : +b.dataset.zone;
			this.render();
		});
		$('wm-svg').addEventListener('click', (e) => {
			const n = e.target.closest('[data-node]');
			if (n && n.dataset.node !== this.game.loc) this.select(n.dataset.node);
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	/**
	 * suggest — куда ведёт выход, у которого стоит герой (подсвечивается первым).
	 * look — просто посмотреть: идти можно только от выхода из локации.
	 */
	open(suggest = null, { look = false, car = false } = {}) {
		if (this.isOpen) return;
		this.suggest = suggest;
		this.look = look;
		// машина здесь: можно ехать (сел за руль — сразу на машине)
		this.useCar = car || (this.useCar && !!this.game.carHere?.());
		// у выхода сразу выбран пункт, куда он ведёт: осталось подтвердить (или выбрать другой)
		this.sel = look ? null : suggest;
		this.el.classList.remove('hidden');
		this.game.setPaused(true);
		this.render();
	}

	close() {
		if (!this.isOpen) return;
		this.el.classList.add('hidden');
		this.game.setPaused(false);
	}

	/** Выбрать пункт (null — снять выбор): путь на схеме и панель подтверждения под ней. */
	select(to) {
		this.sel = to && to !== this.game.loc && NODES[to] ? to : null;
		this.render();
		// выбранная карточка — в поле зрения списка (только по вертикали: окно не сдвигается вбок)
		const card = document.querySelector(`#wm-list .route[data-to="${this.sel}"]`), box = this.el.querySelector('.inv');
		if (card && box) {
			const r = card.getBoundingClientRect(), b = box.getBoundingClientRect();
			if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - (b.height - r.height) / 2;
		}
	}

	/** Выбранный пункт: путь, время, цена; можно ли идти (не «просто посмотреть», живчика хватает). */
	choice() {
		const r = this.sel && this.routes?.find((x) => x.to === this.sel);
		if (!r) return null;
		const g = this.game, car = this.useCar && g.carHere?.() ? g.world.car : null;
		if (car) {
			// на машине: без живчика, вдвое быстрее, бензин — по переходам; сломана — не поедет
			const fuel = r.cost * CAR.perHop, broken = car.cond <= 0;
			return { ...r, car: true, time: Math.round(r.time * CAR.speed), fuel, tank: Math.round(car.fuel), broken, have: g.bag?.zhivchik ?? 0, short: fuel > car.fuel || broken, ok: !this.look && !broken && fuel <= car.fuel };
		}
		const have = g.bag?.zhivchik ?? 0;
		return { ...r, have, short: r.cost > have, ok: !this.look && r.cost <= have };
	}

	/** «Подтвердить переход». */
	confirm() {
		const c = this.choice();
		if (c?.ok) this.go(c.to, c.car);
	}

	/** Идти: не хватило живчика — карта остаётся, игра скажет, сколько нужно. */
	go(to, car = false) {
		if (this.game.travel(to, { car }) === false) { this.render(); return; }
		this.el.classList.add('hidden');
	}

	/** Что ждёт в пункте to, если выйти сейчас: строка состояния кластера. */
	status(to, travel) {
		const w = this.game.world, node = NODES[to];
		if (node.kind === 'stab') return 'безопасно';
		if (node.kind === 'base') return `твоя база · оборона ${defense(w.base)} · построено ${w.base.built.length}/${BUILD_IDS.length}`;
		if (node.kind === 'murs') {
			// отношения с мурами: в войну стреляют сразу, в мире — барыга и наём бойца на одну вылазку
			const st = murStance(w.murs), how = st === 'war' ? 'стреляют сразу' : st === 'friend' ? 'торговля дешевле, бойцы на вылазку' : 'не стреляй первым — торговля и наём';
			return `<span class="${st === 'war' ? 'danger' : st === 'friend' ? 'stance-friend' : ''}">логово муров — около ${w.murs.count} стволов · ${STANCE[st]}: ${how}</span>`;
		}
		if (node.kind === 'ext') return `<span class="danger">форпост внешников — около ${w.ext?.count ?? 0} бойцов в броне</span>`;
		// где отряд муров — знаешь, только если купил сведения у информатора в «Полисе»
		const murs = (w.murs.raid?.at === to && w.murs.raid.known ? ' · <span class="danger">там муры (сказал информатор)</span>' : '')
			+ (w.ext?.hunt?.at === to && w.ext.hunt.known ? ' · <span class="danger">там охотятся внешники</span>' : '')
			+ (w.horde?.at === to && w.horde.known ? ` · <span class="danger">там стая «${w.horde.name}»</span>` : '');
		const left = timeLeft(w, to) - travel;
		if (left <= 0) return 'перезагрузится, пока идёшь — придёшь в свежий кластер';
		if (left < 60) return `<span class="danger">перезагрузка через ${approx(left)} после прихода!</span>`;
		const fresh = w.clusters[to].saved ? 'ты здесь уже был' : 'не тронут';
		return `перезагрузка через ${approx(left)} после прихода · ${fresh}${murs}`;
	}

	render() {
		const g = this.game, here = g.loc, have = g.bag?.zhivchik ?? 0;
		// гараж на базе — дорога быстрее
		const k = this.game.basePerks?.().travel ?? 1;
		// все локации, кроме текущей: кратчайший путь, время с учётом гаража, цена в живчике (по переходу за узел)
		const all = Object.keys(NODES).filter((id) => id !== here).map((to) => {
			const p = shortestPath(here, to);
			return { to, time: Math.round(p.time * k), cost: p.nodes.length - 1, path: p.nodes };
		});
		const band = bandOf; // сектор: Чёрная зона … стаб и база
		// сначала куда ведёт выход, потом секторами снизу вверх (стаб и база, Окраина … Чёрная зона), внутри — по времени
		const routes = all.sort((a, b) => (b.to === this.suggest) - (a.to === this.suggest) || band(b.to) - band(a.to) || a.time - b.time);
		this.routes = routes;
		const hereLeft = timeLeft(g.world, here);
		const kind = NODES[here].kind;
		const where = kind === 'stab' ? 'ты в стабе' : kind === 'murs' ? 'ты в логове муров' : kind === 'ext' ? 'ты на форпосте внешников' : kind === 'base' ? 'ты на своей базе' : `до перезагрузки кластера ${approx(hereLeft)}`;
		$('wm-sub').textContent = `${where} · живчик ×${have}`;
		const hereNode = NODES[here];
		// пояс кластера: цветная метка со звёздами, кто водится и что искать
		const zone = (id) => { const z = zoneOf(id); return z ? `<span class="wm-zone" style="--zc:${z.color}">${z.stars} ${z.name}</span>` : ''; };
		const zoneInfo = (id) => { const z = zoneOf(id); return z ? `<span class="muted">водятся: ${z.who} · искать: ${z.loot}</span>` : ''; };
		const herecard = `<div class="route here-card"><img class="route-img" src="${asset(hereNode.preview)}" alt="">
			<div class="route-text"><span class="muted">ты здесь</span><b>${hereNode.name} ${zone(here)}</b>
				<span>${kind === 'stab' ? 'безопасно' : kind === 'murs' ? 'логово муров' : kind === 'ext' ? 'форпост внешников' : kind === 'base' ? this.status(here, 0) : `до перезагрузки ${approx(hereLeft)}`}</span></div></div>`;
		let sec = null;
		const cards = routes.map(({ to, time, cost }) => {
			const b = band(to), bz = BANDS[b], z = bz?.zone ? ZONES[bz.zone] : null;
			const head = to !== this.suggest && b !== sec ? `<div class="trade-sec wm-sec" style="--zc:${z?.color ?? '#9ad070'}">${z ? `${z.stars} ${z.name}` : bz?.name ?? ''}</div>` : '';
			if (to !== this.suggest) sec = b;
			const short = cost > have, sel = to === this.sel;
			return `${head}<div class="route${to === this.suggest ? ' suggest' : ''}${short ? ' far' : ''}${sel ? ' sel' : ''}" data-to="${to}">
				<img class="route-img" src="${asset(NODES[to].preview)}" alt="">
				<div class="route-text"><b>${NODES[to].name} ${zone(to)}</b>
					<span>в пути ${approx(time)} · ${cost} ${plural(cost, HOPS)} · <span class="wm-cost${short ? ' danger' : ''}">живчик ×${cost}${short ? ` — есть ${have}` : ''}</span></span>
					<span>${this.status(to, time)}</span>
					<span class="muted">${NODES[to].desc}</span>${zoneInfo(to)}</div>
				<button class="go pick${sel ? ' on' : ''}" data-go="${to}">${sel ? 'Выбрано' : 'Выбрать'}</button>
			</div>`;
		});
		$('wm-list').innerHTML = herecard + cards.join('') + (this.look
			? `<div class="wm-hint">${kind === 'stab' ? 'Выход — через ворота стаба на юге' : kind === 'murs' ? 'Выход — через ворота «Карьера» на юге' : kind === 'ext' ? 'Выход — через ворота форпоста на юге' : 'Чтобы уйти, дойди до края кластера (муть) в любом месте или к синему указателю у дороги'}. Идти можно в любую локацию — через другие кластеры: за каждый переход выпивается живчик.</div><button class="stay" id="wm-stay">Закрыть</button>`
			: `<div class="wm-hint">Идти можно в любую локацию — путь ляжет через другие кластеры, за каждый переход герой выпивает живчик. Выбери пункт, проверь цену и нажми «Подтвердить переход». Живчик продаёт торговец, варят знахарь и медпункт базы.</div><button class="stay" id="wm-stay">Остаться</button>`);
		$('wm-stay').onclick = () => this.close();
		this.draw(here, routes);
		this.legend();
		this.confirmPanel();
	}

	/** Под схемой: выбранный пункт — дорога, время, цена в живчике и кнопка «Подтвердить переход». */
	confirmPanel() {
		const box = $('wm-confirm');
		if (!box) return;
		const c = this.choice();
		if (!c) {
			box.innerHTML = `<div class="wm-hint wm-pick-hint">${this.look ? 'Нажми на кластер — покажу дорогу туда, время и цену в живчике. Уйти можно только от выхода из локации.' : 'Нажми на кластер на схеме или «Выбрать» в списке — покажу дорогу, время и цену в живчике.'}</div>`;
			return;
		}
		const z = zoneOf(c.to);
		const via = c.path.slice(1, -1).map((id) => NODES[id].short ?? NODES[id].name);
		const car = this.game.carHere?.() && !this.look;
		const why = this.look ? 'Отсюда не уйти: дойди до края кластера (муть) или к выходу.'
			: c.car ? (c.broken ? 'Машина сломана — почини деталями (подойди к ней).' : c.short ? `Не хватает бензина: нужно ${c.fuel} л, в баке ${c.tank} л — залей канистры (подойди к машине).` : '')
			: c.short ? `Не хватает живчика: нужно ${c.cost}, есть ${c.have} — переход невозможен. Живчик продаёт торговец, варят знахарь и медпункт базы.` : '';
		const cost = c.car ? `<span class="wm-cost${c.short ? ' danger' : ''}">на машине: бензин ${c.fuel} л из ${c.tank} л, без живчика · состояние ${Math.round(this.game.world.car.cond)} %</span>`
			: `<span class="wm-cost${c.short ? ' danger' : ''}">живчик: нужно ${c.cost}, есть ${c.have}${c.short ? '' : ` → останется ${c.have - c.cost}`}</span>`;
		const modes = car ? `<div class="wm-modes"><button class="${c.car ? 'stay' : 'go'} small" id="wm-foot">Пешком · живчик ×${c.cost}</button><button class="${c.car ? 'go' : 'stay'} small" id="wm-car">На машине · ${c.cost * CAR.perHop} л</button></div>` : '';
		box.innerHTML = `<div class="wm-pick${c.short ? ' short' : ''}">
			<img class="route-img" src="${asset(NODES[c.to].preview)}" alt="">
			<div class="route-text"><b>${NODES[c.to].name}${z ? ` <span class="wm-zone" style="--zc:${z.color}">${z.stars} ${z.name}</span>` : ''}</b>
				<span>в пути ${approx(c.time)} · ${c.cost} ${plural(c.cost, HOPS)}${via.length ? ` · через ${via.join(' → ')}` : ''}</span>
				${cost}${modes}
				<span>${this.status(c.to, c.time)}</span>
				${why ? `<span class="${c.short ? 'danger' : 'muted'}">${why}</span>` : ''}</div>
			<div class="wm-pick-btns"><button class="go" id="wm-go" ${c.ok ? '' : 'disabled'}>Подтвердить переход</button><button class="stay" id="wm-cancel">Отмена</button></div>
		</div>`;
		$('wm-go').onclick = () => this.confirm();
		$('wm-cancel').onclick = () => this.select(null);
		if ($('wm-foot')) $('wm-foot').onclick = () => { this.useCar = false; this.render(); };
		if ($('wm-car')) $('wm-car').onclick = () => { this.useCar = true; this.render(); };
	}

	/** Легенда поясов под схемой: цвет, звёзды, название, сколько кластеров; выбранный пояс — подсвечен. */
	legend() {
		const el = $('wm-legend');
		if (!el) return;
		el.innerHTML = Object.entries(ZONES).map(([k, z]) => `<button class="wm-zone-btn${this.zone === +k ? ' on' : ''}" data-zone="${k}" style="--zc:${z.color}" title="${z.desc}"><i></i>${z.stars} ${z.name} · ${clustersOfZone(+k).length}</button>`).join('');
		const z = this.zone && ZONES[this.zone];
		$('wm-zone-desc').textContent = z ? `${z.name}: ${z.desc} Водятся: ${z.who}. Искать: ${z.loot}.` : 'Чем севернее (выше по карте), тем опаснее заражённые и богаче тайники. Нажми на пункт — покажу дорогу и цену, переход — кнопкой «Подтвердить»; нажми пояс — покажу его кластеры.';
	}

	/**
	 * Карта-местность: земля, пятна поясов, холмы, леса, болота, озеро, река; дороги-кривые между соседями (бегущий
	 * пунктир и время — у дорог отсюда или вдоль пути travel.path), пункты — кружки со снимком, вокруг кластера — доля
	 * цикла до перезагрузки. Герой — портрет в кружке над пунктом here или (travel) на пути в доле t.
	 */
	draw(here, routes, { svg = $('wm-svg'), travel = null } = {}) {
		const w = this.game.world;
		const el = (tag, attrs, parent = svg) => {
			const e = document.createElementNS(SVG, tag);
			for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
			parent.appendChild(e);
			return e;
		};
		svg.innerHTML = '';
		svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
		const defs = el('defs', {});
		const clip = el('clipPath', { id: `${svg.id}-clip` }, defs);
		el('circle', { cx: 0, cy: 0, r: 3.3 }, clip);
		// пятна поясов: радиальный градиент цвета пояса
		for (const [k, z] of Object.entries(ZONES)) {
			const gr = el('radialGradient', { id: `${svg.id}-z${k}` }, defs);
			el('stop', { offset: '0%', 'stop-color': z.color, 'stop-opacity': 0.3 }, gr);
			el('stop', { offset: '100%', 'stop-color': z.color, 'stop-opacity': 0 }, gr);
		}
		// ---------- местность ----------
		el('rect', { x: 0, y: 0, width: MAP_W, height: MAP_H, class: 'wm-land' });
		for (const [id, n] of Object.entries(NODES)) {
			const z = zoneOf(id);
			if (z) el('circle', { cx: n.at[0], cy: n.at[1], r: 17, fill: `url(#${svg.id}-z${n.danger ?? 1})`, class: 'wm-zonefield' });
		}
		const rnd = mulberry(7);
		for (const [x, y, rx, ry] of TERRAIN.hills) {
			for (let k = 0; k < 3; k++) el('ellipse', { cx: x, cy: y, rx: rx * (1 - k * 0.3), ry: ry * (1 - k * 0.3), class: 'wm-hill' });
		}
		for (const [x, y, rx, ry] of TERRAIN.swamp) {
			el('ellipse', { cx: x, cy: y, rx, ry, class: 'wm-swamp' });
			for (let k = 0; k < 5; k++) { const yy = y - ry * 0.6 + k * ry * 0.3, xx = x + (rnd() - 0.5) * rx; el('path', { d: `M${xx - 1.2} ${yy}h2.4`, class: 'wm-swamp-line' }); }
		}
		// лес — россыпь крон (детерминированно)
		for (const [x, y, rx, ry] of TERRAIN.forest) {
			const n = Math.round((rx * ry) / 3.2);
			for (let k = 0; k < n; k++) {
				const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
				el('circle', { cx: x + Math.cos(a) * r * rx, cy: y + Math.sin(a) * r * ry, r: 0.9 + rnd() * 0.7, class: `wm-tree${rnd() < 0.4 ? ' dark' : ''}` });
			}
		}
		el('path', { d: TERRAIN.river, class: 'wm-river-bank' });
		el('path', { d: TERRAIN.river, class: 'wm-river' });
		const L = TERRAIN.lake;
		el('ellipse', { cx: L.x, cy: L.y, rx: L.rx + 0.6, ry: L.ry + 0.6, class: 'wm-river-bank' });
		el('ellipse', { cx: L.x, cy: L.y, rx: L.rx, ry: L.ry, class: 'wm-lake' });
		// ---------- дороги ----------
		const path = travel?.path ?? null;
		const linked = (list, a, b) => !!list && list.some((n, i) => i < list.length - 1 && ((n === a && list[i + 1] === b) || (n === b && list[i + 1] === a)));
		const selPath = !travel && this.sel && NODES[this.sel] ? shortestPath(here, this.sel).nodes : null;
		for (const [a, b, t] of ROUTES) {
			const chosen = linked(selPath, a, b);
			const active = travel ? linked(path, a, b) : chosen || (!selPath && (a === here || b === here));
			// пунктир бежит от героя: от текущего пункта (в пути и к выбранному — по порядку узлов пути)
			const order = travel ? path : chosen ? selPath : null;
			const fwd = order ? order.indexOf(a) < order.indexOf(b) : a === here;
			const [p, c, q] = roadCurve(fwd ? a : b, fwd ? b : a);
			const d = `M${p[0]} ${p[1]}Q${c[0]} ${c[1]} ${q[0]} ${q[1]}`;
			el('path', { d, class: 'wm-road-bg' });
			el('path', { d, class: `wm-road${active ? ' active' : ''}${chosen ? ' chosen' : ''}` });
			// время — только у дорог отсюда и вдоль выбранного пути: подписи на всех рябят
			if (active && !travel) {
				const [mx, my] = bez(p, c, q, 0.5);
				const tx = el('text', { x: mx, y: my - 1, class: 'wm-time' });
				tx.textContent = approx(t);
			}
		}
		// ---------- пункты ----------
		const near = routesFrom(here).map((r) => r.to);
		const R = 4.2, C = 2 * Math.PI * (R - 0.55); // радиус кружка; длина «кольца» перезагрузки
		for (const [id, n] of Object.entries(NODES)) {
			const [x, y] = n.at;
			const reachable = !travel && id !== here;
			const z = zoneOf(id);
			const sel = !travel && id === this.sel, via = !!selPath && !sel && id !== here && selPath.includes(id);
			const g = el('g', { 'data-node': id, class: `wm-node ${n.kind}${z ? ` z${n.danger ?? 1}` : ''}${id === here && !travel ? ' here' : ''}${reachable ? ' reachable' : ''}${near.includes(id) && !travel && !selPath ? ' next' : ''}${sel ? ' sel' : ''}${via ? ' via' : ''}${this.zone && !travel && z ? (z === ZONES[this.zone] ? ' zone-on' : ' zone-off') : ''}` });
			if (z) g.style.setProperty('--zc', z.color);
			const cp = el('clipPath', { id: `${svg.id}-${id}` }, defs);
			el('circle', { cx: x, cy: y, r: R }, cp);
			el('circle', { cx: x, cy: y, r: R, class: 'wm-dot' }, g);
			if (n.preview) el('image', { href: asset(n.preview), x: x - R * 1.4, y: y - R, width: R * 2.8, height: R * 2, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${svg.id}-${id})`, class: 'wm-shot' }, g);
			el('circle', { cx: x, cy: y, r: R, class: 'wm-frame' }, g);
			if (n.kind === 'cluster') {
				// по кругу — доля цикла до перезагрузки (от верха по часовой)
				const left = Math.max(0, timeLeft(w, id)), frac = Math.min(1, left / 420);
				el('circle', { cx: x, cy: y, r: R - 0.55, class: 'wm-ring-bg' }, g);
				el('circle', { cx: x, cy: y, r: R - 0.55, class: `wm-ring${left < 60 ? ' low' : ''}`, 'stroke-dasharray': `${C * frac} ${C}`, transform: `rotate(-90 ${x} ${y})` }, g);
			}
			// соседи по дороге и выбранный — мерцающий круг
			if ((sel || (near.includes(id) && !selPath)) && !travel) el('circle', { cx: x, cy: y, r: R + 0.9, class: `wm-glow${sel ? ' sel' : ''}` }, g);
			if (n.kind === 'stab') el('path', { d: `M${x + 3.2} ${y - 3}V${y - 8.2}l3.4 1.2-3.4 1.3`, class: 'wm-flag' }, g);
			// своя база — домик с флажком
			if (n.kind === 'base') el('path', { d: `M${x + 2.6} ${y - 3}l2.4-2.6 2.4 2.6v2.6h-4.8zM${x + 5} ${y - 5.6}V${y - 8.8}l2.6 1-2.6 1`, class: 'wm-base' }, g);
			// логово муров и форпост — красный крест
			if (n.kind === 'murs' || n.kind === 'ext') el('path', { d: `M${x + 2.8} ${y - 5.6}l3.2 3.2M${x + 6} ${y - 5.6}l-3.2 3.2`, class: 'wm-mur' }, g);
			// охота внешников — синяя точка слева, отряд муров — красная справа, стая — оранжевая внизу
			if (w.ext?.hunt?.at === id && w.ext.hunt.known) el('circle', { cx: x - R - 0.6, cy: y - 1.6, r: 1.4, class: 'wm-hunt' }, g);
			if (w.horde?.at === id && w.horde.known) el('circle', { cx: x, cy: y + R + 0.4, r: 1.5, class: 'wm-horde' }, g);
			if (w.murs?.raid?.at === id && w.murs.raid.known) el('circle', { cx: x + R + 0.6, cy: y - 1.6, r: 1.4, class: 'wm-raid' }, g);
			const label = el('text', { x, y: y + R + 3.1, class: 'wm-label' }, g);
			label.textContent = n.short;
		}
		// герой: портрет в кружке над своим пунктом, в дороге — едет по дорогам пути
		let hx, hy;
		if (travel) [hx, hy] = this.pathPoint(path, travel.t);
		else [hx, hy] = NODES[here].at;
		const you = el('g', { class: 'wm-hero', transform: `translate(${hx} ${hy - (travel ? 0 : 5.6)})` });
		if (!travel) el('circle', { cx: 0, cy: 0, r: 3.6, class: 'wm-pulse' }, you);
		el('circle', { cx: 0, cy: 0, r: 3.7, class: 'wm-hero-ring' }, you);
		const portrait = this.game.icons?.portrait;
		if (portrait) el('image', { href: portrait, x: -3.3, y: -3.3, width: 6.6, height: 6.6, 'clip-path': `url(#${svg.id}-clip)` }, you);
		else el('circle', { cx: 0, cy: 0, r: 3, fill: '#c8d86a' }, you);
		this.heroEl = you;
	}

	/** Точка на пути (по дорогам-кривым между узлами) в доле t (0…1) всей длины. */
	pathPoint(path, t) {
		const segs = path.slice(1).map((id, i) => roadCurve(path[i], id));
		const lens = segs.map(curveLen);
		const total = lens.reduce((a, b) => a + b, 0) || 1;
		let d = Math.max(0, Math.min(1, t)) * total;
		for (let i = 0; i < segs.length; i++) {
			if (d <= lens[i] || i === segs.length - 1) return bez(...segs[i], lens[i] ? Math.min(1, d / lens[i]) : 1);
			d -= lens[i];
		}
		return NODES[path[path.length - 1]].at;
	}

	/** Переход по дороге: портрет героя едет по узлам пути от from к to за ms миллисекунд, потом done(). */
	animateTravel(from, to, ms, done) {
		const svg = $('travel-svg');
		$('travel-img').src = asset(NODES[to].preview);
		const path = shortestPath(from, to).nodes;
		this.draw(from, [], { svg, travel: { from, to, t: 0, path } });
		const t0 = performance.now();
		let finished = false;
		const finish = () => { if (!finished) { finished = true; done(); } };
		const step = () => {
			if (finished) return;
			const k = Math.min(1, (performance.now() - t0) / ms), e = k * k * (3 - 2 * k);
			const [x, y] = this.pathPoint(path, e);
			this.heroEl?.setAttribute('transform', `translate(${x} ${y})`);
			if (k < 1) requestAnimationFrame(step); else finish();
		};
		requestAnimationFrame(step);
		setTimeout(finish, ms + 600); // вкладка спрятана и кадров нет — всё равно приходим
	}
}

/** Генератор случайных чисел с зерном (рисунок леса одинаковый каждый раз). */
function mulberry(a) {
	return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Дорога from → to: [начало, опорная точка, конец] квадратичной кривой; изгиб — свой у каждой пары (по именам). */
export function roadCurve(from, to) {
	const [a, b] = from < to ? [from, to] : [to, from];
	let h = 0;
	for (const ch of a + b) h = (h * 31 + ch.charCodeAt(0)) | 0;
	const bend = (((h >>> 0) % 1000) / 1000 - 0.5) * 0.36; // доля длины вбок: −18…+18 %
	const p = NODES[a].at, q = NODES[b].at, dx = q[0] - p[0], dy = q[1] - p[1];
	const c = [(p[0] + q[0]) / 2 - dy * bend, (p[1] + q[1]) / 2 + dx * bend];
	return from === a ? [p, c, q] : [q, c, p];
}

/** Точка квадратичной кривой (p, c, q) в доле t. */
function bez(p, c, q, t) {
	const u = 1 - t;
	return [u * u * p[0] + 2 * u * t * c[0] + t * t * q[0], u * u * p[1] + 2 * u * t * c[1] + t * t * q[1]];
}

/** Длина кривой (по 12 отрезкам). */
function curveLen([p, c, q]) {
	let len = 0, prev = p;
	for (let k = 1; k <= 12; k++) { const pt = bez(p, c, q, k / 12); len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]); prev = pt; }
	return len;
}
