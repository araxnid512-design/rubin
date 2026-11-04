// Карта Улья — мозаика ромбов: каждый кластер (и стаб, база, логова) — плитка-ромб со снимком локации, плитки лежат
// рядами-секторами сверху вниз (Чёрная зона, Глубина, Промзона, Окраина, внизу стаб и база; tile и BANDS в world.js) с
// небольшими зазорами. Переходы — мостики через зазор между соседними ромбами (ROUTES), у мостиков от текущего
// ромба — время в пути; по контуру ромба кластера — сколько осталось до перезагрузки. Идти можно в любую локацию:
// путь — по мостикам через соседние кластеры (shortestPath), время складывается, за каждый переход герой выпивает
// живчик (travelCost) — нет живчика, нет дороги. Список справа — все локации по секторам: время, цена в живчике, что
// там. Открывается у выхода из локации; выбор пункта — переход (время мира уходит на дорогу).

import { NODES, ROUTES, ZONES, BANDS, MAP_W, MAP_H, TILE_W, TILE_H, TILE_GAP, zoneOf, clustersOfZone, routesFrom, shortestPath, timeLeft, approx } from './world.js';
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
		const band = (id) => NODES[id].tile[1]; // ряд-сектор ромба
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
	 * Схема: ромбы-плитки рядами-секторами (подложка ряда — цветом пояса, подпись сектора — у ряда), мостики между
	 * соседними ромбами (бегущий пунктир и время — у мостиков отсюда или вдоль пути travel.path), по контуру ромба
	 * кластера — сколько осталось до перезагрузки, у стаба — флажок. Герой — портрет в кружке над ромбом here или
	 * (travel) на пути в доле t.
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
		const hw = TILE_W / 2, hh = TILE_H / 2, k = 1 - TILE_GAP; // ромб с зазором: вершины ближе к центру
		const rhomb = (x, y, f = k) => `${x},${y - hh * f} ${x + hw * f},${y} ${x},${y + hh * f} ${x - hw * f},${y}`;
		// подложка рядов-секторов: полоса цветом пояса во всю ширину; подпись сектора — сбоку от ряда, где свободно
		BANDS.forEach((b, row) => {
			const z = b.zone ? ZONES[b.zone] : null, tiles = Object.values(NODES).filter((n) => n.tile[1] === row);
			if (!tiles.length) return;
			const y = tiles[0].at[1], left = Math.min(...tiles.map((n) => n.at[0])) - hw * k, right = Math.max(...tiles.map((n) => n.at[0])) + hw * k;
			el('rect', { x: 0, y: y - hh * 0.5, width: MAP_W, height: hh, fill: z?.color ?? '#9ad070', class: 'wm-band' });
			const onRight = MAP_W - right >= left;
			const lab = el('text', { x: onRight ? MAP_W - 1.2 : 1.2, y: y + 0.9, class: 'wm-band-label', fill: z?.color ?? '#c8d0bc', 'text-anchor': onRight ? 'end' : 'start' });
			lab.textContent = (z ? z.name : b.name).toUpperCase();
		});
		// мостики через зазор между соседями: от края одного ромба до края другого
		const path = travel?.path ?? null;
		const onPath = (a, b) => path && path.some((n, i) => i < path.length - 1 && ((n === a && path[i + 1] === b) || (n === b && path[i + 1] === a)));
		for (const [a, b, t] of ROUTES) {
			const [x1, y1] = NODES[a].at, [x2, y2] = NODES[b].at;
			const active = travel ? onPath(a, b) : a === here || b === here;
			// пунктир бежит от героя: от текущего ромба (в пути — по порядку узлов пути)
			const fwd = travel ? path.indexOf(a) < path.indexOf(b) : a === here;
			const [p, q] = fwd ? [[x1, y1], [x2, y2]] : [[x2, y2], [x1, y1]];
			const t0 = 0.5 * k - 0.06, t1 = 1 - t0; // край своего ромба (с запасом) → край соседнего
			const P = (tt) => [p[0] + (q[0] - p[0]) * tt, p[1] + (q[1] - p[1]) * tt];
			const [ax, ay] = P(t0), [bx, by] = P(t1);
			el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'wm-bridge-bg' });
			el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: `wm-road${active ? ' active' : ''}` });
			// время — только у мостиков отсюда: подписи на всех рябят
			if (active && !travel) {
				const [mx, my] = P(0.5), horiz = Math.abs(y2 - y1) < 0.1;
				const tx = el('text', { x: mx, y: my + (horiz ? -1.4 : 1.1), class: 'wm-time' });
				tx.textContent = approx(t);
			}
		}
		const near = routesFrom(here).map((r) => r.to);
		const P4 = 4 * Math.hypot(hw * k, hh * k); // периметр ромба — для «кольца» перезагрузки по контуру
		for (const [id, n] of Object.entries(NODES)) {
			const [x, y] = n.at;
			const reachable = !travel && id !== here;
			const z = zoneOf(id);
			const g = el('g', { 'data-node': id, class: `wm-node ${n.kind}${z ? ` z${n.danger ?? 1}` : ''}${id === here && !travel ? ' here' : ''}${reachable ? ' reachable' : ''}${near.includes(id) && !travel ? ' next' : ''}${this.zone && !travel && z ? (z === ZONES[this.zone] ? ' zone-on' : ' zone-off') : ''}` });
			if (z) g.style.setProperty('--zc', z.color);
			// ромб: подложка, снимок локации внутри, рамка цветом пояса
			const cp = el('clipPath', { id: `${svg.id}-${id}` }, defs);
			el('polygon', { points: rhomb(x, y) }, cp);
			el('polygon', { points: rhomb(x, y), class: 'wm-dot' }, g);
			if (n.preview) el('image', { href: asset(n.preview), x: x - hw * k, y: y - hh * k, width: TILE_W * k, height: TILE_H * k, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${svg.id}-${id})`, class: 'wm-shot' }, g);
			el('polygon', { points: rhomb(x, y), class: 'wm-frame' }, g);
			if (n.kind === 'cluster') {
				// по контуру — доля цикла до перезагрузки (от верхней вершины по часовой)
				const left = Math.max(0, timeLeft(w, id)), frac = Math.min(1, left / 420);
				el('polygon', { points: rhomb(x, y, k * 0.86), class: 'wm-ring-bg' }, g);
				el('polygon', { points: rhomb(x, y, k * 0.86), class: `wm-ring${left < 60 ? ' low' : ''}`, 'stroke-dasharray': `${P4 * 0.86 * frac} ${P4}` }, g);
			}
			// соседи по мостику — мерцающий контур: туда ведут выходы
			if (near.includes(id) && !travel) el('polygon', { points: rhomb(x, y, k * 1.04), class: 'wm-glow' }, g);
			if (n.kind === 'stab') el('path', { d: `M${x + 3.4} ${y - 3.6}V${y - 8.8}l3.4 1.2-3.4 1.3`, class: 'wm-flag' }, g);
			// своя база — домик с флажком
			if (n.kind === 'base') el('path', { d: `M${x + 2.4} ${y - 3.6}l2.4-2.6 2.4 2.6v2.6h-4.8zM${x + 4.8} ${y - 6.2}V${y - 9.4}l2.6 1-2.6 1`, class: 'wm-base' }, g);
			// логово муров и форпост — красный крест
			if (n.kind === 'murs' || n.kind === 'ext') el('path', { d: `M${x + 3} ${y - 6}l3.2 3.2M${x + 6.2} ${y - 6}l-3.2 3.2`, class: 'wm-mur' }, g);
			// охота внешников (радио базы) — синяя точка слева, отряд муров — красная справа, стая — оранжевая внизу
			if (w.ext?.hunt?.at === id && w.ext.hunt.known) el('circle', { cx: x - hw * 0.55, cy: y - hh * 0.3, r: 1.5, class: 'wm-hunt' }, g);
			if (w.horde?.at === id && w.horde.known) el('circle', { cx: x, cy: y + hh * 0.62, r: 1.6, class: 'wm-horde' }, g);
			if (w.murs?.raid?.at === id && w.murs.raid.known) el('circle', { cx: x + hw * 0.55, cy: y - hh * 0.3, r: 1.5, class: 'wm-raid' }, g);
			const label = el('text', { x, y: y + 3.2, class: 'wm-label' }, g);
			label.textContent = n.short;
		}
		// герой: портрет в кружке над своим ромбом, в дороге — едет по ромбам пути
		let hx, hy;
		if (travel) [hx, hy] = this.pathPoint(path, travel.t);
		else [hx, hy] = NODES[here].at;
		const you = el('g', { class: 'wm-hero', transform: `translate(${hx} ${hy - (travel ? 0 : 3.4)})` });
		if (!travel) el('circle', { cx: 0, cy: 0, r: 3.6, class: 'wm-pulse' }, you);
		el('circle', { cx: 0, cy: 0, r: 3.7, class: 'wm-hero-ring' }, you);
		const portrait = this.game.icons?.portrait;
		if (portrait) el('image', { href: portrait, x: -3.3, y: -3.3, width: 6.6, height: 6.6, 'clip-path': `url(#${svg.id}-clip)` }, you);
		else el('circle', { cx: 0, cy: 0, r: 3, fill: '#c8d86a' }, you);
		this.heroEl = you;
	}

	/** Точка на ломаной пути (по центрам ромбов) в доле t (0…1) всей длины. */
	pathPoint(path, t) {
		const pts = path.map((id) => NODES[id].at);
		const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
		const total = seg.reduce((a, b) => a + b, 0) || 1;
		let d = Math.max(0, Math.min(1, t)) * total;
		for (let i = 0; i < seg.length; i++) {
			if (d <= seg[i] || i === seg.length - 1) {
				const f = seg[i] ? Math.min(1, d / seg[i]) : 1;
				return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
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
