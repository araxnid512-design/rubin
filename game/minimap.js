// План локации: рисуется один раз при постройке уровня из его данных (дороги, здания, препятствия,
// деревья, вода, выходы) — чёткий на любом масштабе и почти бесплатный для видеокарты.
// Из плана сделаны миникарта в углу экрана (где ты ходишь, стрелки к переходам)
// и полноэкранная карта локации (с тайниками и выходами).

import { NODES } from './world.js';
import { PLAY } from './level.js';

const S = 10; // пикселей на метр
const HALF = 50, SIZE = HALF * 2 * S;
const $ = (id) => document.getElementById(id);
const toPx = (v) => (v + HALF) * S;

const GROUND = { asphalt: '#4b4d4f', dirt: '#8a7550', concrete: '#9c9a91', sand: '#b8a27a' };
const TREE = { birch: ['#5f7c37', 1.7], pine: ['#33502c', 1.9], apple: ['#7d8c3c', 1.7] };

/** Сторона света, куда ведёт выход. */
export function side(e) {
	const x = (e.x0 + e.x1) / 2, z = (e.z0 + e.z1) / 2;
	return Math.abs(x) > Math.abs(z) ? (x > 0 ? 'восток' : 'запад') : (z > 0 ? 'юг' : 'север');
}

/** Куда ведёт выход — подпись. */
export const exitLabel = (e) => (e.to ? NODES[e.to].short : 'карта Улья');

/** Нарисовать план локации в canvas (SIZE×SIZE, север сверху). */
export function drawPlan(level) {
	const c = document.createElement('canvas');
	c.width = c.height = SIZE;
	const g = c.getContext('2d');
	const rect = (x, z, w, d, ry, fill, stroke) => {
		g.save();
		g.translate(toPx(x), toPx(z));
		g.rotate(-ry);
		g.fillStyle = fill;
		g.fillRect(-w * S / 2, -d * S / 2, w * S, d * S);
		if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.strokeRect(-w * S / 2, -d * S / 2, w * S, d * S); }
		g.restore();
	};
	// трава с пятнами
	g.fillStyle = '#56653e';
	g.fillRect(0, 0, SIZE, SIZE);
	let seed = 7;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	for (let i = 0; i < 900; i++) {
		g.fillStyle = rnd() < 0.5 ? 'rgba(40,52,30,0.18)' : 'rgba(120,130,80,0.14)';
		g.beginPath();
		g.arc(rnd() * SIZE, rnd() * SIZE, 6 + rnd() * 22, 0, Math.PI * 2);
		g.fill();
	}
	const { plan } = level;
	for (const r of plan.grounds) rect(r.x, r.z, r.w, r.d, r.ry, GROUND[r.kind]);
	for (const [x, z, rx, rz] of plan.water) {
		g.fillStyle = '#7a6a4a';
		g.beginPath(); g.ellipse(toPx(x), toPx(z), rx * S * 1.1, rz * S * 1.1, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#2f4c55';
		g.beginPath(); g.ellipse(toPx(x), toPx(z), rx * S, rz * S, 0, 0, Math.PI * 2); g.fill();
	}
	// дома, куда можно зайти: пол, поверх — стены (коллайдеры), видны двери
	for (const b of level.buildings) rect(b.cx, b.cz, b.W, b.D, b.ry, '#a08462');
	// большие постройки без входа: хрущёвка, гаражи, казарма
	for (const b of plan.blocks) rect(b.cx, b.cz, b.hx * 2 - 0.8, b.hz * 2 - 1.2, b.ry, '#6e6d66', '#3e3d38');
	const treeAt = new Set(plan.trees.map((t) => `${t.x.toFixed(2)}:${t.z.toFixed(2)}`));
	for (const k of level.colliders) {
		if (treeAt.has(`${k.x.toFixed(2)}:${k.z.toFixed(2)}`)) continue; // стволы рисуем кронами
		const thin = Math.min(k.hx, k.hz) < 0.2;
		rect(k.x, k.z, k.hx * 2, k.hz * 2, k.rot, thin ? '#3a3328' : 'rgba(52,50,44,0.85)');
	}
	// кроны деревьев полупрозрачные, чтобы под ними было видно дорожки
	for (const t of plan.trees) {
		const [col, r] = TREE[t.kind] ?? TREE.birch;
		g.fillStyle = col;
		g.globalAlpha = 0.82;
		g.beginPath(); g.arc(toPx(t.x), toPx(t.z), r * t.s * S, 0, Math.PI * 2); g.fill();
		g.globalAlpha = 1;
	}
	// край кластера — муть: тёмная рамка и пунктир «выход на карту Улья»
	const P = toPx(-PLAY), Q = toPx(PLAY);
	g.fillStyle = 'rgba(28,32,28,0.78)';
	g.fillRect(0, 0, SIZE, P); g.fillRect(0, Q, SIZE, SIZE - Q); g.fillRect(0, P, P, Q - P); g.fillRect(Q, P, SIZE - Q, Q - P);
	if (level.edge) {
		g.strokeStyle = 'rgba(232,200,96,0.8)';
		g.lineWidth = 4;
		g.setLineDash([18, 12]);
		g.strokeRect(P, P, Q - P, Q - P);
		g.setLineDash([]);
	}
	// выходы у дорог: светлая полоса и указатель куда
	for (const e of level.exits) {
		const x0 = toPx(e.x0), z0 = toPx(e.z0), x1 = toPx(e.x1), z1 = toPx(e.z1);
		g.fillStyle = 'rgba(240,210,100,0.45)';
		g.fillRect(x0, z0, x1 - x0, z1 - z0);
	}
	// жители стаба: торговец, лекарь, вербовщик, стол в комнате героя
	for (const st of level.stations) {
		g.fillStyle = '#1d4f9c';
		g.beginPath(); g.arc(toPx(st.x), toPx(st.z), 16, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#f4f4f0';
		g.font = 'bold 20px system-ui, sans-serif';
		g.textAlign = 'center'; g.textBaseline = 'middle';
		g.fillText({ trade: '₽', rest: '✚', mercs: '★', room: '⌂' }[st.id] ?? '•', toPx(st.x), toPx(st.z) + 1);
	}
	return c;
}

/** Миникарта в углу: круг с планом вокруг героя, стрелка — куда смотрит, на краю — стрелки к выходам. */
export class Minimap {
	constructor(game) {
		this.game = game;
		this.el = $('minimap');
		this.map = $('mm-map');
		this.arrow = $('mm-arrow');
		this.pointers = $('mm-pointers');
		this.mates = $('mm-mates');
		this.k = 3; // пикселей миникарты на метр
		this.t = 0;
	}

	/** Новая локация: свой план. */
	setLevel(level, planUrl) {
		this.level = level;
		this.map.style.backgroundImage = `url(${planUrl})`;
		this.map.style.backgroundSize = `${100 * this.k}px ${100 * this.k}px`;
		this.pointers.innerHTML = level.exits.map((e, i) => `<div class="mm-pointer" data-i="${i}"><i></i><span>${exitLabel(e)}</span></div>`).join('');
		this.t = 1;
	}

	update(dt, player) {
		if (!this.level || (this.t += dt) < 0.05) return;
		this.t = 0;
		const R = this.el.clientWidth / 2, k = this.k, p = player.pos;
		this.map.style.backgroundPosition = `${R - (p.x + HALF) * k}px ${R - (p.z + HALF) * k}px`;
		this.arrow.style.transform = `translate(-50%, -50%) rotate(${Math.PI - player.root.rotation.y}rad)`;
		// наёмники — голубые точки
		const mercs = (this.game.mercs ?? []).filter((m) => m.alive);
		while (this.mates.children.length < mercs.length) this.mates.append(document.createElement('i'));
		[...this.mates.children].forEach((el, i) => {
			const m = mercs[i];
			el.hidden = !m;
			if (m) el.style.transform = `translate(${R + (m.pos.x - p.x) * k}px, ${R + (m.pos.z - p.z) * k}px) translate(-50%, -50%)`;
		});
		// стрелки к выходам: на краю круга, если выход дальше видимого
		this.level.exits.forEach((e, i) => {
			const el = this.pointers.children[i];
			const cx = Math.max(e.x0, Math.min(e.x1, p.x)), cz = Math.max(e.z0, Math.min(e.z1, p.z));
			const dx = cx - p.x, dz = cz - p.z, d = Math.hypot(dx, dz);
			const r = Math.min(d * k, R + 4);
			el.style.transform = `translate(${R + (dx / (d || 1)) * r}px, ${R + (dz / (d || 1)) * r}px) translate(-50%, -50%)`;
			el.firstChild.style.transform = `rotate(${Math.atan2(dx, -dz)}rad)`;
			el.classList.toggle('far', d * k > R + 4);
		});
	}
}

/** Полноэкранная карта локации: план, герой, тайники (обысканные — серые), выходы и куда они ведут. */
export class LocationMap {
	/** game: { level, loc, player, world, setPaused(bool), worldMap } */
	constructor(game) {
		this.game = game;
		this.el = $('locmap');
		$('lm-close').onclick = () => this.close();
		$('lm-world').onclick = () => { this.close(); this.game.worldMap.open(null, { look: true }); };
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	setLevel(planUrl) { $('lm-img').src = planUrl; }

	open() {
		if (this.isOpen) return;
		this.el.classList.remove('hidden');
		this.game.setPaused(true);
		this.render();
	}

	close() {
		if (!this.isOpen) return;
		this.el.classList.add('hidden');
		this.game.setPaused(false);
	}

	toggle() { if (this.isOpen) this.close(); else this.open(); }

	render() {
		const g = this.game, L = g.level, p = g.player, node = NODES[g.loc];
		$('lm-title').textContent = node.name;
		const svg = [];
		// тайники: жёлтые — не обысканы, серые — пусто/обысканы
		for (const c of L.containers) svg.push(`<circle cx="${toPx(c.x)}" cy="${toPx(c.z)}" r="9" class="lm-box${c.searched ? ' done' : ''}"/>`);
		// выходы: подпись с направлением
		for (const e of L.exits) {
			const x = toPx(Math.max(-PLAY + 4, Math.min(PLAY - 4, (e.x0 + e.x1) / 2))), z = toPx(Math.max(-PLAY + 3, Math.min(PLAY - 3, (e.z0 + e.z1) / 2)));
			const text = e.to ? `→ ${NODES[e.to].short}` : 'Выход ↓';
			const w = text.length * 15 + 26;
			svg.push(`<g class="lm-exit" transform="translate(${x} ${z})"><rect x="${-w / 2}" y="-20" width="${w}" height="40" rx="20"/><text y="8">${text}</text></g>`);
		}
		// наёмники отряда
		for (const m of g.mercs ?? []) if (m.alive) svg.push(`<circle cx="${toPx(m.pos.x)}" cy="${toPx(m.pos.z)}" r="13" class="lm-mate"/>`);
		// герой: стрелка по направлению взгляда
		const deg = 180 - (p.root.rotation.y * 180) / Math.PI;
		svg.push(`<g transform="translate(${toPx(p.pos.x)} ${toPx(p.pos.z)}) rotate(${deg})"><circle r="26" class="lm-you-pulse"/><path d="M0 -24 L16 16 L0 7 L-16 16 Z" class="lm-you"/></g>`);
		$('lm-svg').innerHTML = svg.join('');
		const left = L.containers.filter((c) => !c.searched).length;
		$('lm-info').innerHTML = `
			${node.kind === 'cluster' ? `<div class="lm-row">Тайников не обыскано: <b>${left}</b> из ${L.containers.length}</div>` : ''}
			${L.stations.length ? `<div class="lm-row">${L.stations.map((st) => `${{ trade: '₽', rest: '✚', mercs: '★', room: '⌂' }[st.id] ?? '•'} ${st.id === 'mercs' ? 'Вербовщик наёмников' : st.name}`).join(' · ')}</div>` : ''}
			<div class="lm-legend"><span><i class="lg-you"></i>ты</span>${g.mercs?.some((m) => m.alive) ? '<span><i class="lg-mate"></i>наёмник</span>' : ''}${L.containers.length ? '<span><i class="lg-box"></i>тайник</span><span><i class="lg-done"></i>обыскан</span>' : ''}<span><i class="lg-exit"></i>выход</span></div>
			<div class="lm-exits">${L.exits.map((e) => `<div>${e.to ? `<b>${NODES[e.to].name}</b> — ${side(e)}, у указателя` : `<b>Выход в Улей</b> — ворота на ${side(e)}е`}</div>`).join('')}</div>
			<div class="lm-hint">${L.edge ? 'Уйти из кластера можно в любом месте: дойди до края — до мути (жёлтый пунктир), откроется карта Улья.' : 'Из стаба выходят только через ворота.'}</div>`;
	}
}
