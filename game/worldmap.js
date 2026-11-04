// Карта Улья — схема секторами: полосы поясов сверху вниз (Чёрная зона, Глубина, Промзона, Окраина, внизу стаб и
// база), в каждой — свои кластеры (позиции NODES.at, полосы BANDS в world.js). Дороги со временем в пути (подписи —
// только у дорог от текущего узла, чтобы не рябило), у кластеров — кольцо «сколько до перезагрузки». Идти можно в любую
// локацию: путь — по кратчайшей дороге через другие кластеры (shortestPath), время складывается, за каждый переход
// герой выпивает живчик (travelCost) — нет живчика, нет дороги. Список справа — все локации по секторам: время, цена
// в живчике, что там. Открывается у выхода из локации; выбор пункта — переход (время мира уходит на дорогу).

import { NODES, ROUTES, ZONES, BANDS, MAP_W, MAP_H, zoneOf, clustersOfZone, routesFrom, shortestPath, timeLeft, approx } from './world.js';
import { defense, BUILD_IDS } from './base.js';
import { asset } from './assets.js';
import { plural } from './items.js';

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
		$('wm-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-go]');
			if (b && !b.disabled) this.go(b.dataset.go);
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
			if (n && !this.look && n.dataset.node !== this.game.loc) this.go(n.dataset.node);
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	/**
	 * suggest — куда ведёт выход, у которого стоит герой (подсвечивается первым).
	 * look — просто посмотреть: идти можно только от выхода из локации.
	 */
	open(suggest = null, { look = false } = {}) {
		if (this.isOpen) return;
		this.suggest = suggest;
		this.look = look;
		this.el.classList.remove('hidden');
		this.game.setPaused(true);
		this.render();
	}

	close() {
		if (!this.isOpen) return;
		this.el.classList.add('hidden');
		this.game.setPaused(false);
	}

	/** Идти: не хватило живчика — карта остаётся, игра скажет, сколько нужно. */
	go(to) {
		if (this.game.travel(to) === false) { this.render(); return; }
		this.el.classList.add('hidden');
	}

	/** Что ждёт в пункте to, если выйти сейчас: строка состояния кластера. */
	status(to, travel) {
		const w = this.game.world, node = NODES[to];
		if (node.kind === 'stab') return 'безопасно';
		if (node.kind === 'base') return `твоя база · оборона ${defense(w.base)} · построено ${w.base.built.length}/${BUILD_IDS.length}`;
		if (node.kind === 'murs') return `<span class="danger">логово муров — около ${w.murs.count} стволов</span>`;
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
		const band = (id) => BANDS.findIndex((b) => b.zone === (NODES[id].kind === 'cluster' ? Math.max(1, Math.min(4, NODES[id].danger ?? 1)) : NODES[id].kind === 'murs' ? 3 : NODES[id].kind === 'ext' ? 4 : null));
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
			const short = cost > have;
			return `${head}<div class="route${to === this.suggest ? ' suggest' : ''}${short ? ' far' : ''}">
				<img class="route-img" src="${asset(NODES[to].preview)}" alt="">
				<div class="route-text"><b>${NODES[to].name} ${zone(to)}</b>
					<span>в пути ${approx(time)} · ${cost} ${plural(cost, HOPS)} · <span class="wm-cost${short ? ' danger' : ''}">живчик ×${cost}${short ? ` — есть ${have}` : ''}</span></span>
					<span>${this.status(to, time)}</span>
					<span class="muted">${NODES[to].desc}</span>${zoneInfo(to)}</div>
				${this.look ? '' : `<button class="go" data-go="${to}" ${short ? 'disabled' : ''}>Идти</button>`}
			</div>`;
		});
		$('wm-list').innerHTML = herecard + cards.join('') + (this.look
			? `<div class="wm-hint">${kind === 'stab' ? 'Выход — через ворота стаба на юге' : kind === 'murs' ? 'Выход — через ворота «Карьера» на юге' : kind === 'ext' ? 'Выход — через ворота форпоста на юге' : 'Чтобы уйти, дойди до края кластера (муть) в любом месте или к синему указателю у дороги'}. Идти можно в любую локацию — через другие кластеры: за каждый переход выпивается живчик.</div><button class="stay" id="wm-stay">Закрыть</button>`
			: `<div class="wm-hint">Идти можно в любую локацию — путь ляжет через другие кластеры, за каждый переход герой выпивает живчик. Живчик продаёт торговец, варят знахарь и медпункт базы.</div><button class="stay" id="wm-stay">Остаться</button>`);
		$('wm-stay').onclick = () => this.close();
		this.draw(here, routes);
		this.legend();
	}

	/** Легенда поясов под схемой: цвет, звёзды, название, сколько кластеров; выбранный пояс — подсвечен. */
	legend() {
		const el = $('wm-legend');
		if (!el) return;
		el.innerHTML = Object.entries(ZONES).map(([k, z]) => `<button class="wm-zone-btn${this.zone === +k ? ' on' : ''}" data-zone="${k}" style="--zc:${z.color}" title="${z.desc}"><i></i>${z.stars} ${z.name} · ${clustersOfZone(+k).length}</button>`).join('');
		const z = this.zone && ZONES[this.zone];
		$('wm-zone-desc').textContent = z ? `${z.name}: ${z.desc} Водятся: ${z.who}. Искать: ${z.loot}.` : 'Сектора Улья: чем выше по схеме, тем опаснее заражённые и богаче тайники. Нажми на любой кластер — пойдёшь туда через другие; нажми пояс — покажу его кластеры.';
	}

	/**
	 * Схема: полосы-сектора с подписями, дороги пунктиром (бегущий пунктир и время — у дорог отсюда или вдоль пути
	 * travel.path), у кластеров — кольцо «сколько осталось до перезагрузки», у стаба — флажок. Герой — портрет в кружке:
	 * в пункте here или (travel) на дороге пути в доле t.
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
		const blur = el('filter', { id: `${svg.id}-blur` }, defs);
		el('feGaussianBlur', { stdDeviation: 4 }, blur);
		const clip = el('clipPath', { id: `${svg.id}-clip` }, defs);
		el('circle', { cx: 0, cy: 0, r: 4.2 }, clip);
		// полосы-сектора: подкрашены цветом пояса, подпись вдоль левого края, между полосами — тонкая черта
		for (const b of BANDS) {
			const z = b.zone ? ZONES[b.zone] : null;
			el('rect', { x: 0, y: b.y0, width: MAP_W, height: b.y1 - b.y0, fill: z?.color ?? '#9ad070', class: 'wm-band' });
			if (b.y0 > 0) el('line', { x1: 0, y1: b.y0, x2: MAP_W, y2: b.y0, class: 'wm-band-line' });
			const cy = (b.y0 + b.y1) / 2;
			const t = el('text', { x: 3.4, y: cy, class: 'wm-band-label', transform: `rotate(-90 3.4 ${cy})`, fill: z?.color ?? '#c8d0bc' });
			t.textContent = (z ? z.name : b.name).toUpperCase(); // звёзды — в легенде: подпись должна уместиться в полосу
		}
		// муть — медленно дышащие размытые пятна между кластерами
		for (const [x, y, r] of [[44, 8, 7], [100, 22, 8], [40, 30, 9], [96, 60, 6], [12, 52, 7], [60, 60, 6], [100, 84, 10], [52, 92, 7], [8, 90, 8]]) el('circle', { cx: x, cy: y, r, fill: '#2e3530', filter: `url(#${svg.id}-blur)`, class: 'wm-fog' });
		const path = travel?.path ?? null;
		const onPath = (a, b) => path && path.some((n, i) => i < path.length - 1 && ((n === a && path[i + 1] === b) || (n === b && path[i + 1] === a)));
		for (const [a, b, t] of ROUTES) {
			const [x1, y1] = NODES[a].at, [x2, y2] = NODES[b].at;
			const active = travel ? onPath(a, b) : a === here || b === here;
			// пунктир бежит от героя: рисуем линию от текущего пункта (в пути — по порядку узлов пути)
			const fwd = travel ? path.indexOf(a) < path.indexOf(b) : a === here;
			el('line', fwd ? { x1, y1, x2, y2 } : { x1: x2, y1: y2, x2: x1, y2: y1 }).setAttribute('class', `wm-road${active ? ' active' : ''}`);
			// время — только у дорог отсюда: подписи на всех дорогах рябят
			if (active && !travel) { const tx = el('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 1.5, class: 'wm-time' }); tx.textContent = approx(t); }
		}
		const near = routesFrom(here).map((r) => r.to);
		for (const [id, n] of Object.entries(NODES)) {
			const [x, y] = n.at;
			const reachable = !travel && id !== here;
			const z = zoneOf(id);
			const g = el('g', { 'data-node': id, class: `wm-node ${n.kind}${z ? ` z${n.danger ?? 1}` : ''}${id === here && !travel ? ' here' : ''}${reachable ? ' reachable' : ''}${near.includes(id) && !travel ? ' next' : ''}${this.zone && !travel && z ? (z === ZONES[this.zone] ? ' zone-on' : ' zone-off') : ''}` });
			if (z) g.style.setProperty('--zc', z.color);
			if (n.kind === 'cluster') {
				// кольцо: доля цикла до перезагрузки
				const left = Math.max(0, timeLeft(w, id)), frac = Math.min(1, left / 420);
				const R = 7.4, len = 2 * Math.PI * R;
				el('circle', { cx: x, cy: y, r: R, class: 'wm-ring-bg' }, g);
				el('circle', { cx: x, cy: y, r: R, class: `wm-ring${left < 60 ? ' low' : ''}`, 'stroke-dasharray': `${len * frac} ${len}`, transform: `rotate(-90 ${x} ${y})` }, g);
			}
			// соседи по дороге — мерцающее кольцо: туда ведут выходы
			if (near.includes(id) && !travel) el('circle', { cx: x, cy: y, r: 6.2, class: 'wm-glow' }, g);
			// пункт — круглый снимок локации в рамке
			const r = 5.8;
			const cp = el('clipPath', { id: `${svg.id}-${id}` }, defs);
			el('circle', { cx: x, cy: y, r }, cp);
			el('circle', { cx: x, cy: y, r: r + 0.2, class: 'wm-dot' }, g);
			if (n.preview) el('image', { href: asset(n.preview), x: x - r * 1.78, y: y - r, width: r * 3.56, height: r * 2, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${svg.id}-${id})` }, g);
			el('circle', { cx: x, cy: y, r, class: 'wm-frame' }, g);
			if (n.kind === 'stab') el('path', { d: `M${x + 3.4} ${y - 3.2}V${y - 8.4}l3.4 1.2-3.4 1.3`, class: 'wm-flag' }, g);
			// своя база — домик с флажком
			if (n.kind === 'base') el('path', { d: `M${x + 2.4} ${y - 3.6}l2.4-2.6 2.4 2.6v2.6h-4.8zM${x + 4.8} ${y - 6.2}V${y - 9.4}l2.6 1-2.6 1`, class: 'wm-base' }, g);
			// логово муров и форпост — красный крест; кластер, где их отряд (если сказал информатор), — точка
			if (n.kind === 'murs' || n.kind === 'ext') el('path', { d: `M${x + 2.6} ${y - 7.6}l3.6 3.6M${x + 6.2} ${y - 7.6}l-3.6 3.6`, class: 'wm-mur' }, g);
			// охота внешников (слышно по радио базы) — синяя точка
			if (w.ext?.hunt?.at === id && w.ext.hunt.known) el('circle', { cx: x - 4.6, cy: y - 4.6, r: 1.5, class: 'wm-hunt' }, g);
			// кочующая стая (сказал информатор) — оранжевая точка снизу
			if (w.horde?.at === id && w.horde.known) el('circle', { cx: x + 4.6, cy: y + 4.6, r: 1.6, class: 'wm-horde' }, g);
			if (w.murs?.raid?.at === id && w.murs.raid.known) el('circle', { cx: x + 4.6, cy: y - 4.6, r: 1.5, class: 'wm-raid' }, g);
			const label = el('text', { x, y: y + (n.kind === 'stab' || n.kind === 'base' ? 11 : 12.5), class: 'wm-label' }, g);
			label.textContent = n.short;
		}
		// герой: портрет в кружке, в пункте — с пульсом, в дороге — едет по узлам пути
		let hx, hy;
		if (travel) [hx, hy] = this.pathPoint(path, travel.t);
		else [hx, hy] = NODES[here].at;
		const you = el('g', { class: 'wm-hero', transform: `translate(${hx} ${hy - (travel ? 0 : 11)})` });
		if (!travel) el('circle', { cx: 0, cy: 0, r: 4.6, class: 'wm-pulse' }, you);
		el('circle', { cx: 0, cy: 0, r: 4.7, class: 'wm-hero-ring' }, you);
		const portrait = this.game.icons?.portrait;
		if (portrait) el('image', { href: portrait, x: -4.2, y: -4.2, width: 8.4, height: 8.4, 'clip-path': `url(#${svg.id}-clip)` }, you);
		else el('circle', { cx: 0, cy: 0, r: 3, fill: '#c8d86a' }, you);
		this.heroEl = you;
	}

	/** Точка на ломаной пути (по узлам) в доле t (0…1) всей длины. */
	pathPoint(path, t) {
		const pts = path.map((id) => NODES[id].at);
		const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
		const total = seg.reduce((a, b) => a + b, 0) || 1;
		let d = Math.max(0, Math.min(1, t)) * total;
		for (let i = 0; i < seg.length; i++) {
			if (d <= seg[i] || i === seg.length - 1) {
				const k = seg[i] ? Math.min(1, d / seg[i]) : 1;
				return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
			}
			d -= seg[i];
		}
		return pts[pts.length - 1];
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
