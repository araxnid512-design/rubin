/*
 * ЕДИНЫЙ КОНФИГ ИГРЫ.
 * Здесь собраны ВСЕ числа: стартовые запасы, расход, урон, цены, шансы событий.
 * Тексты лежат в js/content/*.ru.js и ссылаются на эти значения по ключам.
 * Меняйте смело — после изменения просто перезагрузите страницу.
 */
(function (G) {
  'use strict';

  G.CONFIG = {
    saveVersion: 1,

    // Множители сложности
    difficulty: {
      easy:   { upkeep: 0.8,  enemy: 0.8,  danger: 0.7, loot: 1.25, events: 0.8 },
      normal: { upkeep: 1.0,  enemy: 1.0,  danger: 1.0, loot: 1.0,  events: 1.0 },
      hard:   { upkeep: 1.15, enemy: 1.25, danger: 1.3, loot: 0.85, events: 1.2 },
    },

    // ---------- СТАРТ ----------
    start: {
      troopers: 52,
      droids: 2,
      resources: { water: 420, scrap: 30, energy: 80, credits: 150, discipline: 65 },
      items: { bacta: 4, commModule: 0, hyperParts: 0, fuel: 0, kraytPearl: 0 },
      officers: { lt: 1, sgt: 4, cpl: 9 }, // остальные — рядовые
      xpByRank: { pvt: [0, 30], cpl: [40, 90], sgt: [100, 170], lt: [300, 360] },
      lightWounded: 5,   // ранены при крушении
      heavyWounded: 2,
      lightHealth: [50, 75],
      heavyHealth: [26, 36],
      relations: { jawa: 0, hutt: 0, tusken: -40 },
      knownRegions: ['dunes', 'ridge'],
    },

    // ---------- ЗВАНИЯ ----------
    // xp — порог опыта; acc — бонус к точности (%), hp — бонус к здоровью в бою,
    // morale — бонус к стойкости, eff — бонус к эффективности работ и вылазок
    ranks: [
      { id: 'pvt',  xp: 0,   acc: 0,  hp: 0,  morale: 0,  eff: 0 },
      { id: 'cpl',  xp: 40,  acc: 4,  hp: 5,  morale: 3,  eff: 0.04 },
      { id: 'sgt',  xp: 100, acc: 8,  hp: 10, morale: 6,  eff: 0.08 },
      { id: 'ssgt', xp: 180, acc: 11, hp: 14, morale: 9,  eff: 0.11 },
      { id: 'lt',   xp: 300, acc: 14, hp: 18, morale: 12, eff: 0.14 },
      { id: 'cpt',  xp: 480, acc: 17, hp: 22, morale: 15, eff: 0.17 },
    ],

    // ---------- ЗДОРОВЬЕ (0–100) ----------
    health: {
      lightBelow: 80,       // ниже — лёгкое ранение (боец работает хуже)
      heavyBelow: 40,       // ниже — тяжёлое ранение (не может выходить в поле)
      criticalBelow: 25,    // ниже — риск смерти каждую ночь
      criticalDeathChance: 0.06,
      healLight: 5,         // восстановление за сутки
      healHeavy: 3,
      bactaHeal: 18,        // один медпакет бакты
      lightEff: 0.7,        // эффективность легкораненого
    },

    // ---------- ПАЁК И РАСХОД ----------
    rations: {
      full:    { water: 2.0, discipline: 0,  health: 0 },
      reduced: { water: 1.4, discipline: -2, health: -2 },
      minimal: { water: 0.8, discipline: -5, health: -5 },
    },
    upkeep: {
      woundedExtraWater: 1,         // тяжелораненым — доп. вода в сутки
      expeditionWaterPerDist: 0.5,  // доп. вода бойцу вылазки за единицу расстояния
      droidEnergy: 4,               // энергия на дроида в сутки
      baseEnergy: 8,                // жизнеобеспечение лагеря
      thirstHealth: 12,             // если воды нет совсем: потеря здоровья
      thirstDiscipline: 10,         // и дисциплины
      droidNoEnergyDamage: 6,       // износ дроида без питания
      energyCapBase: 120,
      energyCapPerReactor: 80,
    },

    // ---------- ДИСЦИПЛИНА (0–100) ----------
    discipline: {
      max: 100,
      driftAbove: 60, drift: -1,    // выше порога медленно падает (тоска, жара)
      trooperDeath: -2,
      victory: 5,
      defeat: -8,
      lowThreshold: 35, lowEff: 0.8,   // при низкой — работы хуже
      highThreshold: 75, highEff: 1.1, // при высокой — лучше
      desertionBelow: 20, desertionChance: 0.3, desertionMax: 3,
      wellSupplied: 1,              // полный паёк и вода на 5+ дней
      wellSuppliedDays: 5,
    },

    // ---------- ПРИКАЗЫ ----------
    orders: { perDay: 3 },

    actions: {
      recon:     { min: 2, max: 12, droids: false, suggest: 5, exploreBase: 8, explorePerTrooper: 5, effCap: 8,
                   ambushBase: 0.05, ambushPerDanger: 0.05, smallSquad: 4, smallSquadRisk: 1.5, xp: 6 },
      water:     { min: 2, max: 24, droids: false, suggest: 12, perWorker: 6, effCap: 14, overCapEff: 0.3, needExplored: 20,
                   richness: [0, 0.6, 1.0, 1.5, 2.2], noise: [0.75, 1.25], ambushMult: 0.5, xp: 2 },
      salvage:   { min: 1, max: 30, droids: true, suggest: 12, suggestDroids: 2, perWorker: 3, droidMult: 1.6, effCap: 14, overCapEff: 0.3,
                   richness: [0, 0.6, 1.0, 1.4], noise: [0.8, 1.2],
                   injuryChance: 0.012, findChance: 0.14, ambushMult: 0.5, xp: 1 },
      repair:    { min: 1, max: 30, droids: true, suggest: 12, suggestDroids: 2, droidMult: 1.5, xp: 1 },
      guard:     { min: 1, max: 52, droids: true, suggest: 8, suggestDroids: 0, xp: 1 },
      trade:     { min: 2, max: 10, droids: false, suggest: 4, xp: 2, needExplored: 10 },
      diplomacy: { min: 1, max: 6, droids: false, suggest: 2, xp: 3, giftCredits: 40, giftWater: 40 },
      attack:    { min: 4, max: 52, droids: true, suggest: 20, suggestDroids: 2, xp: 10 },
      speech:    { gainMin: 4, gainMax: 9, repeatPenalty: 3, repeatDays: 3 },
      reward:    { credits: 60, discipline: 8, xp: 20 },
    },

    // ---------- ДИПЛОМАТИЯ ----------
    diplomacy: {
      jawa:   { cost: { credits: 40 }, gain: [6, 12], needRegion: 'anchorhead', needExplored: 10 },
      hutt:   { cost: { credits: 80 }, gain: [5, 10], needRegion: 'mos_espa',   needExplored: 10 },
      tusken: { cost: { water: 60 },   gain: [4, 10], needRegion: 'jundland',   needExplored: 30, failChance: 0.25, failLoss: 6 },
      priceFactorPerPoint: 0.004,  // каждая единица отношения меняет цены на 0,4%
    },

    // ---------- ТОРГОВЛЯ ----------
    // buy — цена, по которой МЫ покупаем; sell — цена, по которой продаём.
    // stock — запас торговца на одну встречу.
    trade: {
      anchorhead: { faction: 'jawa',
        buy:  { water: 2, bacta: 32 },
        sell: { scrap: 2 },
        stock: { water: 300, bacta: 5 } },
      mos_espa: { faction: 'hutt',
        buy:  { water: 3, bacta: 26, fuel: 140, hyperParts: 420, commModule: 650 },
        sell: { scrap: 3, kraytPearl: 700 },
        stock: { water: 400, bacta: 8, fuel: 3, hyperParts: 1, commModule: 1 },
        needRelation: { hyperParts: 10, commModule: 25 } },
      jawa: { faction: 'jawa',
        buy:  { water: 2, bacta: 30 },
        sell: { scrap: 3 },
        stock: { water: 200, bacta: 3 } },
    },

    // ---------- НОЧНЫЕ НАЛЁТЫ ----------
    raids: {
      baseChance: 0.05, perDay: 0.004, maxChance: 0.35,
      guardReducePer: 0.03, guardReduceMax: 0.5,   // каждый часовой снижает шанс на 3% (до 50%)
      tuskenRelationFactor: 0.004,                 // отношения с таскенами
      strengthBase: 8, strengthPerDay: 0.35,
      alertGuards: 4,                              // столько часовых — и налёт не застанет врасплох
      surpriseMult: 1.5,
      lootWaterPerStrength: 6, lootScrapPerStrength: 2,
    },

    // ---------- ЗАСАДЫ И СТЫЧКИ (упрощённый расчёт) ----------
    skirmish: {
      enemyStrengthPerDanger: 4, enemyStrengthNoise: [0.7, 1.3],
      woundRate: 0.25, killRate: 0.08,      // от числа бойцов при равных силах
      winXp: 8,
    },

    // ---------- ОТСЕКИ КОРАБЛЯ ----------
    // level — стартовый уровень; levels[i] — стоимость ДОСТИЖЕНИЯ уровня i
    // (scrap — металлолом, energy — энергия, work — человеко-дни работы, items — особые детали)
    sections: {
      reactor:  { level: 1, levels: [null, null, { scrap: 140, energy: 0, work: 50 }, { scrap: 260, energy: 0, work: 80 }],
                  energy: [0, 24, 40, 60] },
      vapor:    { level: 0, levels: [null, { scrap: 70, energy: 25, work: 30 }, { scrap: 180, energy: 60, work: 60 }],
                  water: [0, 30, 60] },
      medbay:   { level: 0, levels: [null, { scrap: 60, energy: 30, work: 28 }, { scrap: 140, energy: 60, work: 50 }],
                  heal: [0, 4, 7], deathMult: [1, 0.35, 0.12] },
      armory:   { level: 0, levels: [null, { scrap: 80, energy: 20, work: 34 }, { scrap: 180, energy: 50, work: 60 }] },
      workshop: { level: 0, levels: [null, { scrap: 90, energy: 30, work: 38 }, { scrap: 190, energy: 60, work: 64 }] },
      hangar:   { level: 0, levels: [null, { scrap: 120, energy: 30, work: 48 }] },
      sensors:  { level: 0, levels: [null, { scrap: 50, energy: 30, work: 20 }], raidReduce: [0, 0.3] },
      comms:    { level: 0, levels: [null, { scrap: 100, energy: 40, work: 40 },
                                        { scrap: 160, energy: 80, work: 55, items: { commModule: 1 } },
                                        { scrap: 220, energy: 150, work: 70, items: { commModule: 2 } }] },
    },

    // ---------- НАХОДКИ ПРИ РАЗБОРЕ ОБЛОМКОВ ----------
    finds: [
      { id: 'bacta',      weight: 30, items: { bacta: [1, 3] } },
      { id: 'credits',    weight: 25, res: { credits: [20, 70] } },
      { id: 'cells',      weight: 25, res: { energy: [15, 40] } },
      { id: 'water',      weight: 15, res: { water: [30, 80] } },
      { id: 'commModule', weight: 5,  items: { commModule: [1, 1] }, minSalvaged: 300 },
    ],

    // ---------- РЕГИОНЫ ----------
    // kind: base — лагерь, wild — пустыня, town — поселение, hostile — вражеский лагерь
    // water/scrap — богатство (индекс в richness), pool — запас, regen — восстановление в сутки
    // links: [регион, % разведки, после которого он открывается]
    regions: {
      crash:       { kind: 'base', dist: 0, danger: 0, water: 0, scrap: 3, scrapPool: 2600,
                     links: [['dunes', 0], ['ridge', 0]] },
      dunes:       { kind: 'wild', dist: 1, danger: 1, water: 1, waterPool: 260, waterRegen: 4,
                     scrap: 1, scrapPool: 300, links: [['farm', 35], ['graveyard', 70]] },
      ridge:       { kind: 'wild', dist: 1, danger: 1, water: 2, waterPool: 320, waterRegen: 8,
                     scrap: 0, links: [['jundland', 40], ['canyon', 60]] },
      farm:        { kind: 'wild', dist: 2, danger: 1, water: 3, waterPool: 600, waterRegen: 14,
                     scrap: 1, scrapPool: 150, links: [['anchorhead', 60]] },
      jundland:    { kind: 'wild', dist: 2, danger: 3, water: 2, waterPool: 500, waterRegen: 10,
                     scrap: 0, links: [['tusken_camp', 50], ['anchorhead', 80]] },
      canyon:      { kind: 'wild', dist: 2, danger: 2, water: 1, waterPool: 200, waterRegen: 4,
                     scrap: 1, scrapPool: 200, links: [['bandit_den', 45], ['mos_espa', 85]] },
      graveyard:   { kind: 'wild', dist: 3, danger: 2, water: 0, scrap: 3, scrapPool: 1400,
                     links: [['krayt_lair', 60]] },
      anchorhead:  { kind: 'town', dist: 3, danger: 1, trade: 'anchorhead', links: [] },
      mos_espa:    { kind: 'town', dist: 4, danger: 2, trade: 'mos_espa', links: [['hutt_palace', 70]] },
      tusken_camp: { kind: 'hostile', dist: 3, danger: 3, enemy: 'tusken_camp', strength: 18 },
      bandit_den:  { kind: 'hostile', dist: 3, danger: 3, enemy: 'bandits', strength: 15 },
      krayt_lair:  { kind: 'hostile', dist: 4, danger: 4, enemy: 'krayt', strength: 40 },
      hutt_palace: { kind: 'hostile', dist: 5, danger: 4, enemy: 'hutt_guard', strength: 60 },
      rebel_post:  { kind: 'hostile', dist: 4, danger: 3, enemy: 'rebels', strength: 24, hidden: true },
    },

    // Добыча за победу над лагерем (упрощённый бой; в этапе 3 — по итогам автобоя)
    loot: {
      tusken_camp: { water: [80, 160], scrap: [20, 50], credits: [0, 40] },
      bandits:     { water: [40, 90], scrap: [40, 90], credits: [80, 180] },
      krayt:       { items: { kraytPearl: [1, 1] }, scrap: [0, 0] },
      hutt_guard:  { credits: [400, 700], water: [200, 300], items: { fuel: [1, 2] } },
      rebels:      { items: { commModule: [1, 1] }, credits: [50, 120], scrap: [30, 60] },
    },

    chronicleLimit: 1500,
  };
})(globalThis.G = globalThis.G || {});
