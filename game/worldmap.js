// Карта Улья: стаб и кластеры, дороги со временем в пути, когда какой кластер перезагрузится.
// Открывается у выхода из локации; выбор пункта — переход (время мира уходит на дорогу).

import { NODES, ROUTES, routesFrom, timeLeft, approx } from './world.js';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';

export class WorldMap {
	/** game: { world, loc, travel(to), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('worldmap');
		$('wm-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('wm-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-go]');
			if (b) this.go(b.dataset.go);
		});
		$('wm-svg').addEventListener('click', (e) => {
			const n = e.target.closest('[data-node]');
			if (n && !this.look && n.dataset.node !== this.game.loc && routesFrom(this.game.loc).some((r) => r.to === n.dataset.node)) this.go(n.dataset.node);
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

	go(to) {
		this.el.classList.add('hidden');
		this.game.travel(to);
	}

	/** Что ждёт в пункте to, если выйти сейчас: строка состояния кластера. */
	status(to, travel) {
		const w = this.game.world, node = NODES[to];
		if (node.kind === 'stab') return 'безопасно';
		const left = timeLeft(w, to) - travel;
		if (left <= 0) return 'перезагрузится, пока идёшь — придёшь в свежий кластер';
		if (left < 60) return `<span class="danger">перезагрузка через ${approx(left)} после прихода!</span>`;
		const fresh = w.clusters[to].saved ? 'ты здесь уже был' : 'не тронут';
		return `перезагрузка через ${approx(left)} после прихода · ${fresh}`;
	}

	render() {
		const g = this.game, here = g.loc;
		const routes = routesFrom(here).sort((a, b) => (b.to === this.suggest) - (a.to === this.suggest));
		const hereLeft = timeLeft(g.world, here);
		$('wm-sub').textContent = NODES[here].kind === 'stab' ? 'ты в стабе' : `до перезагрузки кластера ${approx(hereLeft)}`;
		const hereNode = NODES[here];
		// где ты сейчас и куда можно пойти — у каждого пункта снимок локации
		const herecard = `<div class="route here-card"><img class="route-img" src="${hereNode.preview}" alt="">
			<div class="route-text"><span class="muted">ты здесь</span><b>${hereNode.name}</b>
				<span>${hereNode.kind === 'stab' ? 'безопасно' : `до перезагрузки ${approx(hereLeft)}`}</span></div></div>`;
		$('wm-list').innerHTML = herecard + routes.map(({ to, time }) => `
			<div class="route${to === this.suggest ? ' suggest' : ''}">
				<img class="route-img" src="${NODES[to].preview}" alt="">
				<div class="route-text"><b>${NODES[to].name}</b>
					<span>в пути ${approx(time)} · ${this.status(to, time)}</span>
					<span class="muted">${NODES[to].desc}</span></div>
				${this.look ? '' : `<button class="go" data-go="${to}">Идти</button>`}
			</div>`).join('') + (this.look
			? `<div class="wm-hint">${hereNode.kind === 'stab' ? 'Выход — через ворота стаба на юге' : 'Чтобы уйти, дойди до края кластера (муть) в любом месте или к синему указателю у дороги'}</div><button class="stay" id="wm-stay">Закрыть</button>`
			: '<button class="stay" id="wm-stay">Остаться</button>');
		$('wm-stay').onclick = () => this.close();
		this.draw(here, routes);
	}

	/**
	 * Схема: дороги пунктиром со временем (бегущий пунктир — дороги отсюда), у кластеров — кольцо
	 * «сколько осталось до перезагрузки», у стаба — флажок. Герой — портрет в кружке: в пункте here
	 * или (travel) на дороге from→to в доле пути t.
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
		const defs = el('defs', {});
		const blur = el('filter', { id: `${svg.id}-blur` }, defs);
		el('feGaussianBlur', { stdDeviation: 4 }, blur);
		const clip = el('clipPath', { id: `${svg.id}-clip` }, defs);
		el('circle', { cx: 0, cy: 0, r: 4.2 }, clip);
		// муть — медленно дышащие размытые пятна между кластерами
		for (const [x, y, r] of [[20, 14, 11], [64, 38, 8], [10, 76, 12], [90, 80, 12], [50, 62, 9], [28, 97, 10], [74, 98, 10], [95, 34, 7]]) el('circle', { cx: x, cy: y, r, fill: '#2e3530', filter: `url(#${svg.id}-blur)`, class: 'wm-fog' });
		for (const [a, b, t] of ROUTES) {
			const [x1, y1] = NODES[a].at, [x2, y2] = NODES[b].at;
			const active = travel ? (a === travel.from && b === travel.to) || (b === travel.from && a === travel.to) : a === here || b === here;
			// пунктир бежит от героя: рисуем линию от текущего пункта
			const fwd = travel ? a === travel.from : a === here;
			el('line', fwd ? { x1, y1, x2, y2 } : { x1: x2, y1: y2, x2: x1, y2: y1 }).setAttribute('class', `wm-road${active ? ' active' : ''}`);
			const tx = el('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 1.5, class: 'wm-time' });
			tx.textContent = approx(t);
		}
		for (const [id, n] of Object.entries(NODES)) {
			const [x, y] = n.at;
			const reachable = !travel && routes.some((r) => r.to === id);
			const g = el('g', { 'data-node': id, class: `wm-node ${n.kind}${id === here && !travel ? ' here' : ''}${reachable ? ' reachable' : ''}` });
			if (n.kind === 'cluster') {
				// кольцо: доля цикла до перезагрузки
				const left = Math.max(0, timeLeft(w, id)), frac = Math.min(1, left / 420);
				const R = 7.2, len = 2 * Math.PI * R;
				el('circle', { cx: x, cy: y, r: R, class: 'wm-ring-bg' }, g);
				el('circle', { cx: x, cy: y, r: R, class: `wm-ring${left < 60 ? ' low' : ''}`, 'stroke-dasharray': `${len * frac} ${len}`, transform: `rotate(-90 ${x} ${y})` }, g);
			}
			if (reachable) el('circle', { cx: x, cy: y, r: 6, class: 'wm-glow' }, g);
			// пункт — круглый снимок локации в рамке
			const r = 5.6;
			const cp = el('clipPath', { id: `${svg.id}-${id}` }, defs);
			el('circle', { cx: x, cy: y, r }, cp);
			el('circle', { cx: x, cy: y, r: r + 0.2, class: 'wm-dot' }, g);
			if (n.preview) el('image', { href: n.preview, x: x - r * 1.78, y: y - r, width: r * 3.56, height: r * 2, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${svg.id}-${id})` }, g);
			el('circle', { cx: x, cy: y, r, class: 'wm-frame' }, g);
			if (n.kind === 'stab') el('path', { d: `M${x + 3.4} ${y - 3.2}V${y - 8.4}l3.4 1.2-3.4 1.3`, class: 'wm-flag' }, g);
			const label = el('text', { x, y: y + (n.kind === 'stab' ? 11 : 12.5), class: 'wm-label' }, g);
			label.textContent = n.short;
		}
		// герой: портрет в кружке, в пункте — с пульсом, в дороге — едет по линии
		let hx, hy;
		if (travel) {
			const [x1, y1] = NODES[travel.from].at, [x2, y2] = NODES[travel.to].at;
			hx = x1 + (x2 - x1) * travel.t; hy = y1 + (y2 - y1) * travel.t;
		} else [hx, hy] = NODES[here].at;
		const you = el('g', { class: 'wm-hero', transform: `translate(${hx} ${hy - (travel ? 0 : 11)})` });
		if (!travel) el('circle', { cx: 0, cy: 0, r: 4.6, class: 'wm-pulse' }, you);
		el('circle', { cx: 0, cy: 0, r: 4.7, class: 'wm-hero-ring' }, you);
		const portrait = this.game.icons?.portrait;
		if (portrait) el('image', { href: portrait, x: -4.2, y: -4.2, width: 8.4, height: 8.4, 'clip-path': `url(#${svg.id}-clip)` }, you);
		else el('circle', { cx: 0, cy: 0, r: 3, fill: '#c8d86a' }, you);
		this.heroEl = you;
	}

	/** Переход по дороге: портрет героя едет от from к to за ms миллисекунд, потом done(). */
	animateTravel(from, to, ms, done) {
		const svg = $('travel-svg');
		$('travel-img').src = NODES[to].preview;
		this.draw(from, [], { svg, travel: { from, to, t: 0 } });
		const [x1, y1] = NODES[from].at, [x2, y2] = NODES[to].at;
		const t0 = performance.now();
		let finished = false;
		const finish = () => { if (!finished) { finished = true; done(); } };
		const step = () => {
			if (finished) return;
			const k = Math.min(1, (performance.now() - t0) / ms), e = k * k * (3 - 2 * k);
			this.heroEl?.setAttribute('transform', `translate(${x1 + (x2 - x1) * e} ${y1 + (y2 - y1) * e})`);
			if (k < 1) requestAnimationFrame(step); else finish();
		};
		requestAnimationFrame(step);
		setTimeout(finish, ms + 600); // вкладка спрятана и кадров нет — всё равно приходим
	}
}
