// Муры — бандиты Улья со своим стабом «Карьер». Их до 50 (MUR_LIMIT); раз в 5–20 минут времени мира отряд
// в 5–10 человек уходит на вылазку в кластер (в «Полис» — никогда): бьёт заражённых и выносит тайники. На добытые
// спораны муры нанимают новых бойцов (до лимита), остальное — патроны, гранаты, живчики, стволы — хранят в шкафах
// своего склада. Раз в два часа времени мира стаб пополняется до 50. Здесь — только учёт; бой — в game/main.js.
// Вылазка, на которую герой не попал, считается заочно: часть заражённых перебита, часть тайников пуста.

export const MUR_LIMIT = 50;
/** Сколько споранов стоит нанять одного мура. */
export const MUR_PRICE = 30;
/** Раз во сколько секунд времени мира стаб пополняется до лимита. */
export const MUR_RENEW = 7200;
/** Перерыв между вылазками, с. */
export const RAID_GAP = [300, 1200];
/** Сколько длится вылазка, с: за это время отряд обходит кластер и уходит. */
export const RAID_TIME = [180, 300];
/** Сколько муров всегда остаётся в стабе. */
export const GARRISON = 10;
/** Оружие муров: у каждого — одно из этих (без дробовиков: картечь рассчитана на заражённых). */
export const MUR_GUNS = ['aks', 'aks', 'ak74', 'ak74', 'ak47', 'ak47', 'pkm', 'svd'];

const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/** Муры в новом мире: полный стаб, немного запасов в шкафах, первая вылазка — через 5–20 минут. */
export function newMurs(time = 0) {
	return {
		count: MUR_LIMIT,
		stash: { spore: 20, ammo545: 90, ammo762: 60, ammo76254: 20, zhivchik: 3, grenade: 1 },
		nextRaid: time + rand(...RAID_GAP),
		renewAt: time + MUR_RENEW,
		raid: null,
		raids: 0,
	};
}

/** Из старого сохранения — муры как в новом мире. */
export function normalizeMurs(m, time) {
	if (!m || typeof m !== 'object') return newMurs(time);
	m.stash ??= {};
	m.count = Math.max(0, Math.min(MUR_LIMIT, m.count ?? MUR_LIMIT));
	m.nextRaid ??= time + rand(...RAID_GAP);
	m.renewAt ??= time + MUR_RENEW;
	m.raids ??= 0;
	return m;
}

/** На добытые спораны — новые бойцы (до лимита), остальное остаётся в шкафах. */
export function hireMurs(m) {
	let hired = 0;
	while (m.count < MUR_LIMIT && (m.stash.spore ?? 0) >= MUR_PRICE) { m.stash.spore -= MUR_PRICE; m.count++; hired++; }
	return hired;
}

/** Добыча отряда — в шкафы стаба. */
export function storeLoot(m, loot) {
	for (const [k, n] of Object.entries(loot)) if (n > 0) m.stash[k] = (m.stash[k] ?? 0) + n;
}

/**
 * Время мира дошло до now: пополнение раз в два часа, начало и конец вылазок.
 * clusters — id кластеров, куда можно пойти; here — где сейчас герой (туда отряд придёт вживую).
 * Возвращает события: { started: raid } / { ended: raid, summary } / { renewed: n }.
 */
export function tickMurs(m, now, clusters, here, danger = () => 1) {
	const events = [];
	while (now >= m.renewAt) {
		m.renewAt += MUR_RENEW;
		const n = MUR_LIMIT - m.count;
		m.count = MUR_LIMIT;
		if (n > 0) events.push({ renewed: n });
	}
	if (m.raid && now >= m.raid.end && !m.raid.live) {
		const raid = m.raid;
		m.raid = null;
		events.push({ ended: raid, summary: resolveRaid(m, raid, danger(raid.at)) });
		m.nextRaid = now + rand(...RAID_GAP);
	}
	if (!m.raid && now >= m.nextRaid) {
		const free = m.count - GARRISON;
		if (free >= 5 && clusters.length) {
			const at = clusters[Math.floor(Math.random() * clusters.length)];
			m.raid = {
				at, size: Math.min(free, ri(5, 10)), start: now, end: now + rand(...RAID_TIME),
				mode: Math.random() < 0.5 ? 'crowd' : 'pairs', loot: {}, live: at === here, kills: 0,
			};
			m.raids++;
			events.push({ started: m.raid });
		} else m.nextRaid = now + rand(...RAID_GAP);
	}
	return events;
}

/**
 * Заочная вылазка: герой её не видел. Отряд перебил часть заражённых и выгреб часть тайников (метка raided
 * на кластере — её применяет populate), сам потерял 0–опасность бойцов, принёс спораны и патроны.
 */
export function resolveRaid(m, raid, danger = 1) {
	const kills = ri(4, 8) * raid.size / 6 | 0;
	const losses = Math.min(raid.size, ri(0, Math.max(1, Math.round(danger))));
	m.count = Math.max(0, m.count - losses);
	const loot = { spore: kills * ri(1, 2), ammo545: ri(10, 40), ammo762: ri(0, 30), ammo9: ri(0, 16), zhivchik: ri(0, 2), grenade: Math.random() < 0.2 ? 1 : 0 };
	for (const [k, n] of Object.entries(raid.loot ?? {})) loot[k] = (loot[k] ?? 0) + n;
	storeLoot(m, loot);
	const hired = hireMurs(m);
	return { kills, losses, loot, hired, mark: { kill: rand(0.35, 0.65), loot: rand(0.4, 0.75) } };
}
