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
		$('wm-list').innerHTML = routes.map(({ to, time }) => `
			<div class="route${to === this.suggest ? ' suggest' : ''}">
				<div class="route-text"><b>${NODES[to].name}</b>
					<span>в пути ${approx(time)} · ${this.status(to, time)}</span>
					<span class="muted">${NODES[to].desc}</span></div>
				${this.look ? '' : `<button class="go" data-go="${to}">Идти</button>`}
			</div>`).join('') + (this.look
			? `<div class="wm-hint">${NODES[here].kind === 'stab' ? 'Выход — через ворота стаба на юге' : 'Чтобы уйти, дойди до края кластера — к синему указателю у дороги'}</div><button class="stay" id="wm-stay">Закрыть</button>`
			: '<button class="stay" id="wm-stay">Остаться</button>');
		$('wm-stay').onclick = () => this.close();
		this.draw(here, routes);
	}

	/** Схема: дороги пунктиром со временем, у кластеров — кольцо «сколько осталось до перезагрузки». */
	draw(here, routes) {
		const svg = $('wm-svg');
		const w = this.game.world;
		const el = (tag, attrs, parent = svg) => {
			const e = document.createElementNS(SVG, tag);
			for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
			parent.appendChild(e);
			return e;
		};
		svg.innerHTML = '';
		// муть — размытые пятна между кластерами
		const defs = el('defs', {});
		const blur = el('filter', { id: 'wm-blur' }, defs);
		el('feGaussianBlur', { stdDeviation: 4 }, blur);
		for (const [x, y, r] of [[50, 20, 16], [12, 62, 14], [88, 66, 15], [50, 46, 9], [30, 90, 12], [74, 92, 10]]) el('circle', { cx: x, cy: y, r, fill: '#2e3530', filter: 'url(#wm-blur)' });
		for (const [a, b, t] of ROUTES) {
			const [x1, y1] = NODES[a].at, [x2, y2] = NODES[b].at;
			const active = (a === here || b === here);
			el('line', { x1, y1, x2, y2, class: `wm-road${active ? ' active' : ''}` });
			const tx = el('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 1.5, class: 'wm-time' });
			tx.textContent = approx(t);
		}
		for (const [id, n] of Object.entries(NODES)) {
			const [x, y] = n.at;
			const reachable = routes.some((r) => r.to === id);
			const g = el('g', { 'data-node': id, class: `wm-node ${n.kind}${id === here ? ' here' : ''}${reachable ? ' reachable' : ''}` });
			if (n.kind === 'cluster') {
				// кольцо: доля цикла до перезагрузки
				const left = Math.max(0, timeLeft(w, id)), frac = Math.min(1, left / 420);
				const R = 7.2, len = 2 * Math.PI * R;
				el('circle', { cx: x, cy: y, r: R, class: 'wm-ring-bg' }, g);
				el('circle', { cx: x, cy: y, r: R, class: `wm-ring${left < 60 ? ' low' : ''}`, 'stroke-dasharray': `${len * frac} ${len}`, transform: `rotate(-90 ${x} ${y})` }, g);
			}
			el('circle', { cx: x, cy: y, r: n.kind === 'stab' ? 5.5 : 5, class: 'wm-dot' }, g);
			const label = el('text', { x, y: y + (n.kind === 'stab' ? 11 : 12.5), class: 'wm-label' }, g);
			label.textContent = n.short;
			if (id === here) {
				const you = el('text', { x, y: y - 9.5, class: 'wm-you' }, g);
				you.textContent = 'ты здесь';
			}
		}
	}
}
