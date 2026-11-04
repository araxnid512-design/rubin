// Внешники — пришлые из внешнего мира: солдаты в одинаковой форме, в бронежилетах, с хорошим натовским оружием.
// Охотятся на иммунных. Их форпост — глубоко в Улье (NODES.forpost, kind 'ext'): там до EXT_LIMIT бойцов и командир;
// раз в 15–35 минут времени мира группа в 3–5 человек уходит на охоту в кластер (опасные — чаще; до перезагрузки
// кластера уходят — HUNT_LEAVE, кто не успел, гибнет с ним — game/main.js, reloadDeath): бьёт заражённых,
// ищет иммунных — в кластере героя идёт прямо на него (они «чуют» иммунных). Раз в три часа форпост пополняется.
// Стреляют лучше муров, броня держит часть урона; с убитого — патроны, бывает живчик, граната и сам ствол.
// Здесь — учёт; бой — в game/main.js (Bandit с faction 'ext', HuntSquad, populateExt).

export const EXT_LIMIT = 24;
/** Раз во сколько секунд времени мира форпост пополняется до лимита (и выбирает нового командира). */
export const EXT_RENEW = 10800;
/** Перерыв между охотами и сколько охота длится, с. */
export const HUNT_GAP = [900, 2100];
export const HUNT_TIME = [150, 240];
/** Сколько внешников всегда остаётся в форпосте. */
export const EXT_GARRISON = 10;
/** Боец: здоровье, доля урона, что проходит сквозь бронежилет, прицеливание по человеку, точность и урон по людям. */
export const EXT_HP = 160;
export const EXT_ARMOR = 0.7;
export const EXT_AIM = [0.7, 1.5];
export const EXT_ACCURACY = 0.6;
export const EXT_DAMAGE = 0.4;
/** Командир форпоста: здоровье, броня, ствол; позывные — при выборах нового. */
export const CMD_HP = 650;
export const CMD_ARMOR = 0.5;
export const CMD_GUN = 'aug';
export const CMD_NAMES = ['Гранит', 'Кедр', 'Сокол', 'Штиль', 'Бор', 'Север'];
/** Оружие внешников: натовское и лучшее отечественное. */
export const EXT_GUNS = ['g36', 'g36', 'aug', 'aug', 'mp5', 'fnfal', 'awm'];
/** Лут с убитого: патроны к его стволу, спораны, шансы аптечки, гранаты и самого ствола. */
export const EXT_DROP_AMMO = [8, 20];
export const EXT_DROP_SPORE = [1, 3];
export const EXT_DROP_MED = 0.25;
export const EXT_DROP_NADE = 0.15;
export const EXT_DROP_GUN = 0.15;

/** Уходят из кластера за столько секунд до перезагрузки; охоту туда, где времени меньше LEAVE + HUNT_MIN, не начинают. */
export const HUNT_LEAVE = 120, HUNT_MIN = 90;

const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/**
 * Пленные в изоляторе форпоста: кого внешники поймали. merc — иммунный-боец (освободишь — пойдёт к тебе наёмником),
 * znahar — знахарь, barter — барыга (оба переберутся на базу героя). Новых ловят при пополнении форпоста.
 */
export const PRISONER_KINDS = ['merc', 'merc', 'znahar', 'barter'];
export function rollPrisoners() {
	const pool = [...PRISONER_KINDS], out = [];
	for (let i = 0; i < 2; i++) out.push({ kind: pool.splice(Math.floor(Math.random() * pool.length), 1)[0] });
	return out;
}

/** Внешники в новом мире: полный форпост, снаряжение на складе, первая охота — через 15–35 минут. */
export function newExt(time = 0) {
	return {
		prisoners: rollPrisoners(),
		count: EXT_LIMIT,
		stash: { ammo556: 150, ammo76251: 60, ammo919: 90, zhivchik: 4, grenade: 3, spore: 30 },
		nextHunt: time + rand(...HUNT_GAP),
		renewAt: time + EXT_RENEW,
		hunt: null,
		hunts: 0,
		cmd: newCmd(),
	};
}

/** Новый командир: жив, со случайным позывным. */
export function newCmd(old = null) {
	const names = CMD_NAMES.filter((n) => n !== old);
	return { alive: true, name: names[Math.floor(Math.random() * names.length)] };
}

/** Из старого сохранения (внешников тогда не было) — как в новом мире. */
export function normalizeExt(e, time) {
	if (!e || typeof e !== 'object') return newExt(time);
	e.stash ??= {};
	e.count = Math.max(0, Math.min(EXT_LIMIT, e.count ?? EXT_LIMIT));
	e.nextHunt ??= time + rand(...HUNT_GAP);
	e.renewAt ??= time + EXT_RENEW;
	e.hunts ??= 0;
	e.cmd ??= newCmd();
	e.prisoners ??= rollPrisoners();
	return e;
}

/**
 * Время мира дошло до now: пополнение, начало и конец охоты. clusters — куда можно пойти (id), here — где герой
 * (туда группа придёт вживую), danger(id) — опасность кластера: в опасные ходят чаще.
 * Возвращает события: { started: hunt } / { ended: hunt, summary } / { renewed: n } / { newCmd: name }.
 */
export function tickExt(e, now, clusters, here, danger = () => 1, left = () => Infinity) {
	const events = [];
	while (now >= e.renewAt) {
		e.renewAt += EXT_RENEW;
		const n = EXT_LIMIT - e.count;
		e.count = EXT_LIMIT;
		if (n > 0) events.push({ renewed: n });
		if (e.cmd && !e.cmd.alive) { e.cmd = newCmd(e.cmd.name); events.push({ newCmd: e.cmd.name }); }
		e.prisoners = rollPrisoners(); // наловили новых
	}
	if (e.hunt && now >= e.hunt.end && !e.hunt.live) {
		const hunt = e.hunt;
		e.hunt = null;
		events.push({ ended: hunt, summary: resolveHunt(e, hunt, danger(hunt.at)) });
		e.nextHunt = now + rand(...HUNT_GAP);
	}
	if (!e.hunt && now >= e.nextHunt) {
		const free = e.count - EXT_GARRISON;
		// только туда, где успеют уйти до перезагрузки (left(id) — секунд до неё)
		const safe = clusters.filter((id) => left(id) > HUNT_LEAVE + HUNT_MIN);
		if (free >= 3 && safe.length) {
			// куда — по весу опасности: в логова руберов и элиты ходят чаще
			const w = safe.map((id) => Math.max(1, danger(id)));
			let k = Math.random() * w.reduce((a, b) => a + b, 0), at = safe[0];
			for (let i = 0; i < safe.length; i++) { k -= w[i]; if (k <= 0) { at = safe[i]; break; } }
			e.hunt = { at, size: Math.min(free, ri(3, 5)), start: now, end: now + Math.min(rand(...HUNT_TIME), left(at) - HUNT_LEAVE), live: at === here, kills: 0 };
			e.hunts++;
			events.push({ started: e.hunt });
		} else e.nextHunt = now + rand(...HUNT_GAP);
	}
	return events;
}

/** Заочная охота: группа перебила часть заражённых, мало что взяла (им нужны иммунные), сама потеряла 0–1 бойца. */
export function resolveHunt(e, hunt, danger = 1) {
	const losses = Math.random() < 0.15 * danger ? 1 : 0;
	e.count = Math.max(0, e.count - losses);
	return { losses, mark: { kill: rand(0.3, 0.55), loot: rand(0.08, 0.2) } };
}

/** Что известно о внешниках (радио базы 2-го уровня). */
export function extText(e, nodes, now, approx) {
	const h = e.hunt;
	if (h) return `Внешники охотятся в кластере «${nodes[h.at].short}» — ${h.size} ${h.size === 1 ? 'боец' : h.size < 5 ? 'бойца' : 'бойцов'} в броне. Уйдут примерно через ${approx(Math.max(0, h.end - now))}.`;
	return `Внешники сидят на своём форпосте, их около ${e.count}${e.cmd?.alive !== false ? `, командует «${e.cmd?.name ?? ''}»` : ', командир убит'}.`;
}
