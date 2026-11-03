// Муры — бандиты Улья со своим стабом «Карьер». Их до 50 (MUR_LIMIT); раз в 5–20 минут времени мира отряд
// в 5–10 человек уходит на вылазку в кластер (в «Полис» — никогда): бьёт заражённых и выносит тайники. На добытые
// спораны муры нанимают новых бойцов (до лимита), остальное — патроны, гранаты, живчики, стволы — хранят в шкафах
// своего склада. Раз в два часа времени мира стаб пополняется до 50. Здесь — только учёт; бой — в game/main.js.
// Вылазка, на которую герой не попал, считается заочно: часть заражённых перебита, часть тайников пуста.
// Главарь (boss) сидит в «Карьере» и руководит: пока он жив, муры в бою слаженнее (обход, гранаты по команде),
// вылазки идут; убит — вылазок нет, пока при пополнении стаба не выберут нового.

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
/**
 * Муры стреляют по людям хуже, чем по заражённым: заметив героя или наёмника, сначала целятся (MUR_AIM, с),
 * попадают реже (MUR_ACCURACY — доля обычной точности) и ранят слабее (MUR_DAMAGE — доля урона ствола) —
 * под их огнём можно продержаться и отойти, а не лечь за секунду.
 */
export const MUR_AIM = [1.0, 2.2];
export const MUR_ACCURACY = 0.45;
export const MUR_DAMAGE = 0.3;
/**
 * По одному человеку стреляют по очереди: разом — не больше MUR_SHOOTERS муров, каждый — MUR_TURN секунд,
 * потом отдыхает MUR_REST и уступает место; остальные держат на прицеле. Тревога в «Карьере» поднимает
 * десяток стволов, но под огнём всего двух-трёх — есть время отойти за укрытие или отстреляться.
 */
export const MUR_SHOOTERS = 3;
export const MUR_TURN = [2.5, 4];
export const MUR_REST = [1.5, 3];
/** Здоровье главаря, какую долю урона он получает (бронежилет) и его ствол. */
export const BOSS_HP = 480;
export const BOSS_ARMOR = 0.55;
export const BOSS_GUN = 'ak107';
/** Клички главаря: при выборах нового — случайная. */
export const BOSS_NAMES = ['Хряк', 'Сыч', 'Батя', 'Шрам', 'Кабан', 'Глыба', 'Седой'];
/**
 * Тактика муров в бою с людьми (game/main.js, Bandit.tactics): держатся у укрытий на дистанции своего ствола,
 * перезаряжаются и перевязываются за укрытием, по команде обходят с фланга, засевшего выкуривают гранатой.
 * MUR_NADE_SHARE — у какой доли муров есть граната; MUR_NADE_GAP — перерыв между гранатами отряда, с (с главарём
 * и без); MUR_FLANK_GAP — как часто отряд посылает бойцов в обход, с (с главарём и без).
 */
export const MUR_NADE_SHARE = 0.35;
export const MUR_NADE_GAP = [14, 28];
export const MUR_FLANK_GAP = [7, 14];
/** Лут с убитого мура (вчетверо меньше прежнего, стволы не падают): патронов к его стволу и шанс спорана. */
export const MUR_DROP_AMMO = [2, 8];
export const MUR_DROP_SPORE = 0.5;

/** Оружие муров: у каждого — одно из этих (без дробовиков: картечь рассчитана на заражённых). */
export const MUR_GUNS = ['aks', 'aks', 'ak74', 'ak74', 'ak47', 'ak47', 'rpk', 'svd'];

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
		boss: newBoss(),
	};
}

/** Новый главарь: жив, со случайной кличкой. */
export function newBoss(old = null) {
	const names = BOSS_NAMES.filter((n) => n !== old);
	return { alive: true, name: names[Math.floor(Math.random() * names.length)] };
}

/** Из старого сохранения — муры как в новом мире. */
export function normalizeMurs(m, time) {
	if (!m || typeof m !== 'object') return newMurs(time);
	m.stash ??= {};
	m.count = Math.max(0, Math.min(MUR_LIMIT, m.count ?? MUR_LIMIT));
	m.nextRaid ??= time + rand(...RAID_GAP);
	m.renewAt ??= time + MUR_RENEW;
	m.raids ??= 0;
	m.boss ??= newBoss();
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
		// без главаря стаб выбирает нового
		if (m.boss && !m.boss.alive) { m.boss = newBoss(m.boss.name); events.push({ newBoss: m.boss.name }); }
	}
	if (m.raid && now >= m.raid.end && !m.raid.live) {
		const raid = m.raid;
		m.raid = null;
		events.push({ ended: raid, summary: resolveRaid(m, raid, danger(raid.at)) });
		m.nextRaid = now + rand(...RAID_GAP);
	}
	if (!m.raid && now >= m.nextRaid) {
		const free = m.count - GARRISON;
		// без главаря на вылазки не ходят — некому вести
		if (free >= 5 && clusters.length && m.boss?.alive !== false) {
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
