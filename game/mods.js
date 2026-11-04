// Доработка стволов в мастерской базы «Опорный»: механик ставит на ствол оптический прицел, глушитель, увеличенный
// магазин или дульный тормоз. Доработки — навсегда у этого ствола (kit.mods[id]), видны на модели в руках; на дуло —
// что-то одно (глушитель или тормоз). Параметры ствола с доработками — gunStats(id, mods) (герой стреляет ими).
// Окно — ModsWindow (там же «Починить топор»).

import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

/** Доработки: название, цена в споранах, что даёт, на какие стволы встаёт (fits). */
export const MODS = {
	scope: {
		name: 'Оптический прицел', price: 60,
		desc: 'Дальность +25 %, на пределе мажешь реже.',
		fits: (W) => W.anim === 'rifle' && !W.pellets && !W.proj && (W.falloff ?? 0.35) > 0.1,
	},
	supp: {
		name: 'Глушитель', price: 70,
		desc: 'Выстрел вдвое тише — на шум сбегаются с меньшей округи; вспышки почти нет, урон −5 %.',
		fits: (W) => W.slot === 'gun' && !W.pellets && !W.proj && !W.heavy && W.ammo !== 'ammo50',
	},
	mag: {
		name: 'Увеличенный магазин', price: 50,
		desc: 'Патронов в магазине в полтора раза больше.',
		fits: (W) => W.slot === 'gun' && !W.proj && !W.heavy && W.mag >= 5 && W.mag <= 30,
	},
	brake: {
		name: 'Дульный тормоз', price: 40,
		desc: 'Отдача и разброс в очереди на треть меньше.',
		fits: (W) => W.slot === 'gun' && !W.pellets && !W.proj && !W.heavy && W.anim === 'rifle',
	},
};
/** На дуло встаёт что-то одно. */
const MUZZLE = ['supp', 'brake'];

/** Доработки ствола id, которые на него вообще встают. */
export const modsFor = (id) => Object.keys(MODS).filter((k) => WEAPONS[id] && MODS[k].fits(WEAPONS[id]));

const cache = {};
/** Параметры ствола id с его доработками (без доработок — сам WEAPONS[id]). */
export function gunStats(id, mods) {
	const W = WEAPONS[id], m = mods?.[id];
	if (!W || !m) return W;
	const sig = Object.keys(MODS).filter((k) => m[k]).join(',');
	if (!sig) return W;
	if (cache[id]?.sig === sig) return cache[id].o;
	const o = { ...W, mods: sig };
	if (m.scope) { o.range = Math.round(W.range * 1.25 * 10) / 10; o.falloff = (W.falloff ?? 0.35) * 0.6; }
	if (m.supp) { o.noise = Math.round(W.noise * 0.5); o.flash = (W.flash ?? 1) * 0.25; o.damage = W.damage * 0.95; o.supp = true; }
	if (m.mag) o.mag = Math.round(W.mag * 1.5);
	if (m.brake) { o.kick = W.kick * 0.6; o.spread = (W.spread ?? 0) * 0.65; }
	cache[id] = { sig, o };
	return o;
}

/** Можно ли поставить доработку k на ствол id (null — можно, иначе — почему нет). */
export function cantMod(kit, id, k, spores) {
	const m = kit.mods?.[id] ?? {};
	if (!MODS[k]?.fits(WEAPONS[id])) return 'не встаёт';
	if (m[k]) return 'уже стоит';
	if (spores < MODS[k].price) return 'не хватает споранов';
	return null;
}

/** Поставить доработку (снимает другую с дула). */
export function addMod(kit, id, k) {
	kit.mods ??= {};
	const m = (kit.mods[id] ??= {});
	if (MUZZLE.includes(k)) for (const o of MUZZLE) delete m[o];
	m[k] = true;
}

// ---------- на модели ----------
let mats = null;
const matsOf = () => (mats ??= {
	black: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.55, metalness: 0.5 }),
	steel: new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.4, metalness: 0.75 }),
	glass: new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.08, metalness: 0.6, emissive: 0x0a1420 }),
});
const cyl = (r, len, mat) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);

/**
 * Доработки на модели ствола (оси хвата: ствол по −Y, верх +Z): глушитель или тормоз на дуле (дуло сдвигается
 * вперёд — вспышка и пули оттуда), прицел над коробкой, увеличенный магазин — второй магазин, примотанный к первому.
 */
export function decorateGun(g, mods) {
	if (!mods || !g.userData.muzzle) return g;
	const M = matsOf(), mz = g.userData.muzzle;
	g.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(g);
	const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
	box.applyMatrix4(inv);
	const len = box.max.y - box.min.y;
	const add = (o) => { o.castShadow = true; g.add(o); return o; };
	if (mods.supp) {
		const L = Math.max(0.1, len * 0.18);
		add(cyl(0.017, L, M.black)).position.set(mz.x, mz.y - L / 2, mz.z);
		add(cyl(0.0185, 0.012, M.steel)).position.set(mz.x, mz.y - 0.006, mz.z);
		g.userData.muzzle = mz.clone().setY(mz.y - L);
	} else if (mods.brake) {
		add(cyl(0.014, 0.045, M.steel)).position.set(mz.x, mz.y - 0.022, mz.z);
		for (const dy of [-0.012, -0.03]) add(new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.006, 0.006), M.black)).position.set(mz.x, mz.y + dy, mz.z);
		g.userData.muzzle = mz.clone().setY(mz.y - 0.045);
	}
	if (mods.scope) {
		const z = box.max.z + 0.022, y = box.min.y + len * 0.62;
		add(cyl(0.013, 0.13, M.black)).position.set(0, y, z);
		add(cyl(0.017, 0.03, M.black)).position.set(0, y - 0.07, z);
		add(cyl(0.0155, 0.003, M.glass)).position.set(0, y - 0.086, z);
		add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.022), M.steel)).position.set(0, y, z - 0.018);
	}
	if (mods.mag) {
		// второй магазин изолентой к первому — под коробкой у рукояти
		const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.08), M.steel));
		m.position.set(0.024, -0.075, -0.035);
		m.rotation.x = 0.25;
		add(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.05, 0.012), M.black)).position.set(0.012, -0.075, -0.03);
	}
	return g;
}

const $ = (id) => document.getElementById(id);

/**
 * Окно мастерской: починить топор и доработать стволы (при себе и в хранилище). Пока открыто — пауза.
 * game: { kit, bag, stash, icons, buyMod(id, k), repairMelee(), setPaused(bool) }
 */
export class ModsWindow {
	constructor(game) {
		this.game = game;
		this.el = $('mods');
		$('mods-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('mods-list').addEventListener('click', (e) => {
			const b = e.target.closest('[data-mod]');
			if (!b || b.disabled) return;
			if (b.dataset.mod === 'repair') this.game.repairMelee();
			else this.game.buyMod(b.dataset.gun, b.dataset.mod);
			this.render();
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

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

	render() {
		const g = this.game, kit = g.kit, spores = g.bag.spore ?? 0, icons = g.icons ?? {};
		$('mods-spores').textContent = spores;
		const melee = kit.owned.filter((id) => WEAPONS[id].durability);
		const worn = melee.filter((id) => (kit.wear[id] ?? WEAPONS[id].durability) < WEAPONS[id].durability);
		const guns = [...new Set([...kit.owned, ...Object.keys(g.stash?.guns ?? {})])].filter((id) => modsFor(id).length);
		const card = (id, title, sub, btns) => `<div class="offer quest">
			<div class="offer-icon">${icons[id] ? `<img src="${icons[id]}" alt="">` : ''}</div>
			<div class="offer-text"><b>${title}</b><span>${sub}</span></div><div class="sell-btns mod-btns">${btns}</div></div>`;
		const rows = guns.map((id) => {
			const m = kit.mods?.[id] ?? {}, W = WEAPONS[id], S = gunStats(id, kit.mods);
			const on = modsFor(id).filter((k) => m[k]).map((k) => MODS[k].name.toLowerCase());
			const stats = `дальность ${String(S.range).replace('.', ',')} м · магазин ${S.mag} · шум ${S.noise}`;
			const where = kit.owned.includes(id) ? '' : ' · в хранилище';
			const btns = modsFor(id).map((k) => {
				const why = cantMod(kit, id, k, spores);
				return `<button class="buy small" data-mod="${k}" data-gun="${id}" ${why ? 'disabled' : ''} title="${MODS[k].desc}">${m[k] ? `✓ ${MODS[k].name}` : `${MODS[k].name} · ${MODS[k].price} сп.`}</button>`;
			}).join('');
			return card(id, W.name, `${on.length ? `стоит: ${on.join(', ')}` : 'без доработок'}${where}<br>${stats}`, btns);
		});
		const repair = melee.length ? card(melee[0], 'Починить топор', worn.length ? `прочность ${kit.wear[worn[0]] ?? 0}/${WEAPONS[worn[0]].durability} — бесплатно` : 'топор цел', `<button class="buy" data-mod="repair" ${worn.length ? '' : 'disabled'}>Починить</button>`) : '';
		const legend = Object.values(MODS).map((x) => `<b>${x.name}</b> — ${x.desc}`).join('<br>');
		$('mods-list').innerHTML = `<div class="trade-sec">Топор</div>${repair || '<div class="muted">Топора нет.</div>'}`
			+ `<div class="trade-sec">Доработка стволов</div>${rows.join('') || '<div class="muted">Дорабатывать нечего: принеси огнестрел (при себе или в хранилище). На гранатомёты и КСВК доработок нет.</div>'}`
			+ `<div class="stash-note">${legend}<br>На дуло встаёт что-то одно: глушитель или тормоз. Доработка остаётся на стволе навсегда.</div>`;
	}
}
