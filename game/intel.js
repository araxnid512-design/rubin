// Информатор в «Полисе», у лавки торговца: за спораны продаёт сведения на три темы. Муры (game/murs.js) — где их
// отряд, сколько стволов, как ходят и когда уйдут (вылазки нет — когда следующая). Внешники (game/ext.js) — где
// охотятся и когда уйдут, сколько их на форпосте. Стая (game/migrant.js) — где кочует большая стая с сильным
// вожаком, кто водит и куда пойдёт. Купленное видно на карте Улья (красная — муры, синяя — внешники, оранжевая —
// стая), пока не сменится. Пока окно открыто — пауза.

import { NODES, approx } from './world.js';
import { plural } from './items.js';
import { extText } from './ext.js';
import { hordeText } from './migrant.js';
import { murStance } from './murs.js';

/** Сколько споранов стоят сведения о мурах (и по темам — TOPICS). */
export const INTEL_PRICE = 10;
/** Темы информатора: название, цена, о чём молчит, пока не заплатишь. */
export const TOPICS = {
	murs: { name: 'Муры', price: INTEL_PRICE, ask: 'где муры и когда пойдут на вылазку' },
	ext: { name: 'Внешники', price: 15, ask: 'где охотятся внешники и сколько их на форпосте' },
	horde: { name: 'Стая', price: 15, ask: 'где кочует большая стая, кто её водит и куда пойдёт' },
};

/** Сведения по теме сейчас. */
export function topicText(topic, world) {
	if (topic === 'ext') return `${extText(world.ext, NODES, world.time, approx)}${world.ext.hunt ? ' Отметил на карте.' : ''}`;
	if (topic === 'horde') return hordeText(world.horde, world.time, approx);
	return intelText(world.murs, world.time);
}

/** Уже куплено и ещё верно (вылазка, охота, стоянка стаи не сменились) — повторяет бесплатно. */
export function topicKnown(topic, world) {
	if (topic === 'ext') return !!world.ext.hunt?.known;
	if (topic === 'horde') return !!(world.horde.at && world.horde.known);
	return !!world.murs.raid?.known;
}

/** Как муры относятся к герою — словами информатора. */
export function stanceText(murs, now) {
	const st = murStance(murs);
	if (st === 'war') return ` И учти: у муров ты в чёрном списке — стреляют без разговоров, ищут тебя. Остынут ${murs.warUntil ? `примерно через ${approx(Math.max(0, murs.warUntil - now))}` : 'не скоро'}, если не будешь их больше трогать.`;
	if (st === 'friend') return ' К тебе у муров уважение — в «Карьере» примут как своего: барыга уступит, бригадир даст бойца дешевле.';
	return ' Тебя муры пока не трогают: не стреляй первым — пройдут мимо. В «Карьере» с тобой и поторгуют, и бойца на вылазку дадут.';
}

/** Что скажет информатор о мурах сейчас (now — время мира). */
export function intelText(murs, now) {
	return intelBody(murs, now) + stanceText(murs, now);
}

function intelBody(murs, now) {
	const r = murs.raid;
	if (r) {
		const how = r.mode === 'pairs' ? 'ходят парами' : 'идут кучей';
		return `Отряд муров — ${r.size} ${plural(r.size, ['ствол', 'ствола', 'стволов'])} — сейчас в кластере «${NODES[r.at].short}», ${how}. Уйдут примерно через ${approx(Math.max(0, r.end - now))}. Отметил тебе на карте.`;
	}
	const boss = murs.boss;
	if (boss && !boss.alive) return `Главаря муров кто-то положил — сидят в «Карьере» без него, их около ${murs.count}, на вылазки не ходят. Нового выберут, когда пополнятся — часа через два.`;
	return `Сейчас муры сидят в «Карьере», их около ${murs.count}${boss ? `, верховодит главарь «${boss.name}» — в бронежилете, при охране, у своей будки` : ''}. Следующая вылазка — примерно через ${approx(Math.max(0, murs.nextRaid - now))}, а куда — пока не знаю: заходи потом.`;
}

const $ = (id) => document.getElementById(id);

export class IntelWindow {
	/** game: { bag, world, icons, buyIntel(topic), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('intel');
		$('intel-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('intel-buys').addEventListener('click', (e) => {
			const b = e.target.closest('[data-topic]');
			if (!b || b.disabled) return;
			const t = b.dataset.topic, known = topicKnown(t, this.game.world);
			const text = known ? topicText(t, this.game.world) : this.game.buyIntel(t);
			if (text) this.told = text;
			this.render();
		});
	}

	get isOpen() { return !this.el.classList.contains('hidden'); }

	open() {
		if (this.isOpen) return;
		this.told = null;
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
		const g = this.game, spores = g.bag.spore ?? 0;
		if (g.icons.informant) $('intel-avatar').src = g.icons.informant;
		$('intel-wallet').textContent = `Спораны ${spores}`;
		$('intel-text').textContent = this.told ?? `«Знаю, ${Object.values(TOPICS).map((t) => t.ask).join('; ')}. Спрашивай — недорого».`;
		// уже купленное и ещё верное — бесплатно («Напомнить»)
		$('intel-buys').innerHTML = Object.entries(TOPICS).map(([id, t]) => {
			const known = topicKnown(id, g.world);
			return `<button class="buy" data-topic="${id}" ${!known && spores < t.price ? 'disabled' : ''}>${t.name} · ${known ? 'напомнить' : `${t.price} ${plural(t.price, ['споран', 'спорана', 'споранов'])}`}</button>`;
		}).join('');
	}
}
