// Заражённые кластера на один цикл: сколько и кто — каждый раз заново и по опасности кластера (NODES.danger:
// 1 — окраина Улья, 2 — промзона, 3 — логово руберов). Группы локации (level.groups) — места, где их держится
// больше; чем опаснее кластер, тем гуще группы и тем чаще в них топтун, а в логове топтун дорастает до рубера.
// Сильные водят стаи: топтун или рубер — вожак, бегуны его группы ходят за ним; ещё несколько стай бродят
// по кластеру сами по себе. Стая поднимается вся, когда кто-то из неё заметил героя (Enemy в game/main.js).

/** Сколько заражённых самое большее (по опасности); в цикле — на 0–10 меньше, случайно. Лишние бегуны
 * отбрасываются — телефону тяжело. */
const CAP = [0, 42, 50, 58];
/** Сколько руберов самое большее: лишние остаются топтунами. */
const RUBER_CAP = [0, 0, 4, 10];
/** Вероятность, что бродячую стаю ведёт рубер, а не топтун. */
const RUBER_LEAD = [0, 0, 0.35, 0.5];

/**
 * Состав на цикл: [{ type, at, r, pack, lead }] — at/r: где и в каком радиусе (null — бродячая стая, место
 * выбирает populate); pack — номер стаи (0 — сам по себе), lead — вожак стаи.
 */
export function rollHorde(groups, danger = 1, rnd = Math.random) {
	const d = Math.max(1, Math.min(3, Math.round(danger)));
	const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
	const f = 0.5 + 0.2 * d; // густота групп: 0.7 / 0.9 / 1.1
	const out = [];
	let packs = 0;
	for (const g of groups) {
		let runners = Math.round((g.runners ?? 0) * f * (0.6 + rnd() * 0.8));
		let stompers = g.stompers ?? 0, rubers = g.rubers ?? 0;
		if (rnd() < 0.08 * (d - 1)) stompers++; // глубже в Улье — топтун и там, где его обычно нет
		if (d >= 3 && stompers && rnd() < 0.15) { stompers--; rubers++; } // в логове топтун перерастает в рубера
		const pack = rubers || stompers ? ++packs : 0;
		const at = g.at, r = g.r;
		const lead = rubers ? 'ruber' : stompers ? 'stomper' : null;
		if (lead === 'ruber') rubers--; else if (lead) stompers--;
		if (lead) runners += ri(1, d); // сильный уже собрал вокруг себя бегунов
		if (lead) out.push({ type: lead, at, r, pack, lead: true });
		for (let i = 0; i < rubers; i++) out.push({ type: 'ruber', at, r, pack });
		for (let i = 0; i < stompers; i++) out.push({ type: 'stomper', at, r, pack });
		for (let i = 0; i < runners; i++) out.push({ type: 'runner', at, r, pack });
	}
	// бродячие стаи: вожак и бегуны, глубже в Улье — ещё и топтун
	for (let i = 0, n = d + ri(0, 1); i < n; i++) {
		const pack = ++packs;
		out.push({ type: rnd() < RUBER_LEAD[d] ? 'ruber' : 'stomper', at: null, r: 4, pack, lead: true });
		for (let k = 0, m = ri(3, 4 + d); k < m; k++) out.push({ type: 'runner', at: null, r: 4, pack });
		if (d >= 2 && rnd() < 0.4) out.push({ type: 'stomper', at: null, r: 4, pack });
	}
	// руберов больше потолка — лишние так и не доросли, остаются топтунами
	for (let rubers = out.filter((e) => e.type === 'ruber'); rubers.length > RUBER_CAP[d];) rubers.splice(Math.floor(rnd() * rubers.length), 1)[0].type = 'stomper';
	// слишком много — убираем случайных бегунов: сначала одиночек, потом из стай (вожаков и сильных не трогаем)
	const cap = CAP[d] - ri(0, 10);
	while (out.length > cap) {
		let idx = out.map((e, i) => (e.type === 'runner' && !e.pack ? i : -1)).filter((i) => i >= 0);
		if (!idx.length) idx = out.map((e, i) => (e.type === 'runner' ? i : -1)).filter((i) => i >= 0);
		if (!idx.length) break;
		out.splice(idx[Math.floor(rnd() * idx.length)], 1);
	}
	return out;
}
