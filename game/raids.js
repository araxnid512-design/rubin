// Налёты муров и внешников на базу героя «Опорный». Повод — месть (убил главаря муров или командира внешников,
// устроил резню в их логове, освободил пленных форпоста) или набег муров за запасами, когда база разрослась. Налёт
// приходит через 10–20 минут времени мира: если герой на базе — вживую (AssaultSquad в game/main.js: отряд из мути
// бежит к центру базы, часовые и наёмники на постах принимают бой), если нет — заочно: сила отряда против обороны
// базы (game/base.js, raid). Отбились — трофеи на склад базы; нет — накопленное растащили, часовые ранены.
// Состояние — world.murs.baseRaid / world.ext.baseRaid: { due, reason }.

/** Через сколько после повода приходит налёт, с. */
export const RAID_DELAY = [600, 1200];
/** Как часто муры думают о набеге за запасами (когда на базе от GREED_BUILT построек), с, и с какой вероятностью идут. */
export const GREED_GAP = [2700, 5400];
export const GREED_BUILT = 6;
export const GREED_CHANCE = 0.5;
/** Сколько бойцов в налёте и сила одного против обороны базы (заочно). */
export const RAID_SIZE = { murs: [6, 9], ext: [4, 6] };
export const RAID_POWER = { murs: 11, ext: 18 };
/** Сколько секунд отряд штурмует базу, прежде чем уйти. */
export const RAID_TIME = 240;
/** Резня в логове: столько убитых за один визит — и они придут мстить. */
export const MASSACRE = 10;

const rand = (a, b) => a + Math.random() * (b - a);

/** Повод для налёта: через 10–20 минут придут (если уже собираются — раньше не станут). */
export function planRaid(f, now, reason) {
	if (f.baseRaid) return false;
	f.baseRaid = { due: now + rand(...RAID_DELAY), reason };
	return true;
}

/** Набег муров за запасами: раз в 45–90 минут думают, большая ли база, — и идут с вероятностью GREED_CHANCE. */
export function greedCheck(murs, base, now) {
	murs.greedAt ??= now + rand(...GREED_GAP);
	if (now < murs.greedAt) return false;
	murs.greedAt = now + rand(...GREED_GAP);
	if ((base?.built.length ?? 0) < GREED_BUILT || Math.random() > GREED_CHANCE) return false;
	return planRaid(murs, now, 'набег за запасами');
}

/** Сколько бойцов пойдёт (не больше, чем у фракции есть сверх гарнизона). */
export function raidSize(faction, have) {
	const [a, b] = RAID_SIZE[faction];
	return Math.max(0, Math.min(Math.round(rand(a, b + 0.49)), have - (faction === 'ext' ? 8 : 10)));
}
