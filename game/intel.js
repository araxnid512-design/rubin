// Информатор в «Полисе», у лавки торговца: за спораны говорит, где сейчас отряд муров (game/murs.js) — в каком
// кластере, сколько стволов, как ходят и когда уйдут; вылазки нет — когда примерно следующая. Купленные сведения
// о вылазке видны и на карте Улья (красная точка у кластера), пока отряд не вернётся. Пока окно открыто — пауза.

import { NODES, approx } from './world.js';
import { plural } from './items.js';

/** Сколько споранов стоят сведения. */
export const INTEL_PRICE = 10;

/** Что скажет информатор о мурах сейчас (now — время мира). */
export function intelText(murs, now) {
	const r = murs.raid;
	if (r) {
		const how = r.mode === 'pairs' ? 'ходят парами' : 'идут кучей';
		return `Отряд муров — ${r.size} ${plural(r.size, ['ствол', 'ствола', 'стволов'])} — сейчас в кластере «${NODES[r.at].short}», ${how}. Уйдут примерно через ${approx(Math.max(0, r.end - now))}. Отметил тебе на карте.`;
	}
	return `Сейчас муры сидят в «Карьере», их около ${murs.count}. Следующая вылазка — примерно через ${approx(Math.max(0, murs.nextRaid - now))}, а куда — пока не знаю: заходи потом.`;
}

const $ = (id) => document.getElementById(id);

export class IntelWindow {
	/** game: { bag, world, icons, buyIntel(), setPaused(bool) } */
	constructor(game) {
		this.game = game;
		this.el = $('intel');
		$('intel-close').onclick = () => this.close();
		this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
		$('intel-buy').onclick = () => { this.told = this.game.buyIntel() ?? this.told; this.render(); };
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
		const g = this.game, spores = g.bag.spore ?? 0, raid = g.world.murs.raid;
		if (g.icons.informant) $('intel-avatar').src = g.icons.informant;
		$('intel-wallet').textContent = `Спораны ${spores}`;
		// уже купленное про эту вылазку — повторяет бесплатно
		const known = raid?.known && !this.told ? intelText(g.world.murs, g.world.time) : null;
		$('intel-text').textContent = this.told ?? known ?? `«Знаю, где муры и когда пойдут на вылазку. Скажу за ${INTEL_PRICE} ${plural(INTEL_PRICE, ['споран', 'спорана', 'споранов'])}».`;
		const btn = $('intel-buy');
		btn.hidden = !!(this.told || known);
		btn.disabled = spores < INTEL_PRICE;
		btn.textContent = `Узнать · ${INTEL_PRICE} сп.`;
	}
}
