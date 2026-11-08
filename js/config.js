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
      normal: { upkeep: 1.08, enemy: 1.2,  danger: 1.15, loot: 1.0, events: 1.1 },
      hard:   { upkeep: 1.2,  enemy: 1.3,  danger: 1.35, loot: 0.8, events: 1.25 },
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
      relations: { jawa: 0, hutt: 0, tusken: -40, farmers: 10, guild: 0, scavengers: -10, deserters: -20 },
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
      droidEnergy: 3,               // энергия на дроида в сутки
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
      engineer:  { min: 1, max: 30, droids: true, suggest: 8, suggestDroids: 2, xp: 1 },
      repair:    { min: 1, max: 30, droids: true, suggest: 12, suggestDroids: 2, droidMult: 1.5, xp: 1 },
      guard:     { min: 1, max: 52, droids: true, suggest: 8, suggestDroids: 0, xp: 1 },
      trade:     { min: 2, max: 10, droids: false, suggest: 4, xp: 2, needExplored: 10 },
      diplomacy: { min: 1, max: 6, droids: false, suggest: 2, xp: 3, giftCredits: 40, giftWater: 40 },
      attack:    { min: 4, max: 52, droids: true, suggest: 20, suggestDroids: 2, xp: 10 },
      speech:    { gainMin: 4, gainMax: 9, repeatPenalty: 3, repeatDays: 3 },
      signal:    {},
      launch:    {},
      reward:    { credits: 60, discipline: 8, xp: 20 },
      // Учения: отряд весь день тренируется на плацу — опыт, немного дисциплины, редкие лёгкие травмы
      drill:     { min: 2, max: 16, droids: false, suggest: 8, xp: [9, 15], armoryXp: 4, injuryChance: 0.03, injury: [8, 18], disciplineFrom: 6, discipline: 1 },
    },

    // ---------- ТЕРМИНАЛ: поставки шаттлом и контракты ----------
    terminal: {
      maxOrders: 3,               // сколько шаттлов одновременно в пути
      lossChance: 0.05,           // шанс, что шаттл перехватят (деньги пропадают)
      sensorsMult: 0.5,           // сенсоры вдвое снижают риск перехвата
      delayChance: 0.1,           // буря задерживает шаттл на сутки
      relDiscount: 0.004, relDiscountMax: 0.25, relPenalty: 0.012,
      goods: {
        // бойцы
        mercs:    { group: 'troops', unit: 'merc', n: 2, price: 170, days: 2, rel: 'guild', minRel: -15, risk: 0.8 },
        droid:    { group: 'troops', unit: 'droid', n: 1, price: 160, days: 3, rel: 'jawa', minRel: -15 },
        troopers: { group: 'troops', unit: 'trooper', n: 3, price: 210, days: 4, need: ['comms', 1], xp: [20, 110], risk: 1.4 },
        veterans: { group: 'troops', unit: 'trooper', n: 2, price: 300, days: 5, need: ['comms', 2], xp: [190, 320], risk: 1.4 },
        // припасы
        water:    { group: 'supply', give: { water: 220 }, price: 95, days: 1, rel: 'hutt', minRel: -40 },
        bacta:    { group: 'supply', give: { bacta: 3 }, price: 85, days: 2, rel: 'hutt', minRel: -40 },
        scrap:    { group: 'supply', give: { scrap: 70 }, price: 80, days: 2, rel: 'jawa', minRel: -40 },
        cells:    { group: 'supply', give: { energy: 60 }, price: 70, days: 2, rel: 'jawa', minRel: -40 },
      },
      contracts: {
        slots: 3, refreshDays: 4, maxActive: 2, failRel: -4, doneRel: 5,
        hunt: [5, 10],
        days: { hunt: 8, clear: 10, scout: 6, deliver: 6 },
        reward: { perKill: 16, clear: [220, 320], scout: [70, 110], water: 0.85, scrap: 2.6 },
      },
    },

    // ---------- ДИПЛОМАТИЯ ----------
    diplomacy: {
      jawa:   { cost: { credits: 40 }, gain: [6, 12], needRegion: 'anchorhead', needExplored: 10 },
      hutt:   { cost: { credits: 80 }, gain: [5, 10], needRegion: 'mos_espa',   needExplored: 10 },
      tusken: { cost: { water: 60 },   gain: [4, 10], needRegion: 'jundland',   needExplored: 30, failChance: 0.25, failLoss: 6 },
      farmers:    { cost: { credits: 30 },  gain: [6, 12], needRegion: 'anchorhead', needExplored: 10 },
      scavengers: { cost: { scrap: 60 },    gain: [6, 12], needRegion: 'junkyard',   needExplored: 10 },
      deserters:  { cost: { water: 50 },    gain: [5, 10], needRegion: 'outpost',    needExplored: 30, failChance: 0.3, failLoss: 6 },
      guild:      { cost: { credits: 120 }, gain: [8, 14], needRegion: 'mos_espa',   needExplored: 30 },
      priceFactorPerPoint: 0.004,  // каждая единица отношения меняет цены на 0,4%
    },

    // ---------- ТОРГОВЛЯ ----------
    // buy — цена, по которой МЫ покупаем; sell — цена, по которой продаём.
    // stock — запас торговца на одну встречу.
    trade: {
      anchorhead: { faction: 'farmers',
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
      // падальщики хорошо платят за металл и торгуют деталями
      junkyard: { faction: 'scavengers', minRelation: 0,
        buy:  { fuel: 120, hyperParts: 320, bacta: 34 },
        sell: { scrap: 4 },
        stock: { fuel: 2, hyperParts: 1, bacta: 2 },
        needRelation: { fuel: 10, hyperParts: 25 } },
    },

    // ---------- ФРАКЦИИ: бонусы за отношения ----------
    factions: {
      farmersWater: [[25, 8], [50, 16]],   // [порог, литров в сутки] — фермеры привозят воду
      guildSafe: 30,                        // с этого уровня гильдия не присылает убийц
      scavengersPeace: 20,                  // с этого уровня падальщики не воруют обломки
      desertersJoin: 50,                    // с этого уровня аванпост может вернуться под знамёна
      attackRelation: -100,                 // отношения после нападения на их лагерь
    },

    // ---------- НОЧНЫЕ НАЛЁТЫ ----------
    raids: {
      baseChance: 0.045, perDay: 0.0025, maxChance: 0.26,
      guardReducePer: 0.03, guardReduceMax: 0.5,   // каждый часовой снижает шанс на 3% (до 50%)
      tuskenRelationFactor: 0.004,                 // отношения с таскенами
      strengthBase: 11, strengthPerDay: 0.32,
      alertGuards: 4,                              // столько часовых — и налёт не застанет врасплох
      surpriseMult: 1.5,
      lootWaterPerStrength: 6, lootScrapPerStrength: 2,
    },

    // ---------- ЗАСАДЫ И СТЫЧКИ (упрощённый расчёт) ----------
    skirmish: {
      enemyStrengthPerDanger: 4, enemyStrengthNoise: [0.7, 1.3],
      ambushBase: 0.5, ambushPerDanger: 0.2,  // засада: сила = (база + опасность × k) × размер отряда
      woundRate: 0.25, killRate: 0.08,      // от числа бойцов при равных силах
      winXp: 8,
    },

    // ---------- ОТСЕКИ КОРАБЛЯ ----------
    // level — стартовый уровень; levels[i] — стоимость ДОСТИЖЕНИЯ уровня i
    // (scrap — металлолом, energy — энергия, work — человеко-дни работы, items — особые детали)
    sections: {
      reactor:  { level: 1, levels: [null, null, { scrap: 140, energy: 0, work: 50 }, { scrap: 260, energy: 0, work: 80 }],
                  energy: [0, 24, 42, 64] },
      vapor:    { level: 0, levels: [null, { scrap: 70, energy: 25, work: 30 }, { scrap: 180, energy: 60, work: 60 }],
                  water: [0, 28, 52] },
      medbay:   { level: 0, levels: [null, { scrap: 60, energy: 30, work: 28 }, { scrap: 140, energy: 60, work: 50 }],
                  heal: [0, 4, 7], deathMult: [1, 0.35, 0.12] },
      armory:   { level: 0, levels: [null, { scrap: 80, energy: 20, work: 34 }, { scrap: 180, energy: 50, work: 60 }] },
      workshop: { level: 0, levels: [null, { scrap: 90, energy: 30, work: 38 }, { scrap: 190, energy: 60, work: 64 }] },
      hangar:   { level: 0, levels: [null, { scrap: 120, energy: 30, work: 48 }] },
      sensors:  { level: 0, levels: [null, { scrap: 50, energy: 30, work: 20 }], raidReduce: [0, 0.3] },
      comms:    { level: 0, levels: [null, { scrap: 100, energy: 40, work: 30 },
                                        { scrap: 160, energy: 80, work: 40, items: { commModule: 1 } },
                                        { scrap: 220, energy: 120, work: 50, items: { commModule: 1 } }] },
    },

    // ---------- НАХОДКИ ПРИ РАЗБОРЕ ОБЛОМКОВ ----------
    finds: [
      { id: 'bacta',      weight: 30, items: { bacta: [1, 3] } },
      { id: 'credits',    weight: 25, res: { credits: [20, 70] } },
      { id: 'cells',      weight: 25, res: { energy: [15, 40] } },
      { id: 'water',      weight: 15, res: { water: [30, 80] } },
      { id: 'commModule', weight: 7,  items: { commModule: [1, 1] }, minSalvaged: 300, maxItem: 2 },
      { id: 'turret',     weight: 9,  kit: 'turret', minSalvaged: 80 },
      { id: 'speeder',    weight: 6,  vehicle: 'speeder', minSalvaged: 150 },
      { id: 'walker',     weight: 3,  vehicle: 'walker', minSalvaged: 600, max: 1 },
    ],

    // ---------- ВЕХИ РАЗБОРА ----------
    // Когда в районе разобрано столько металла — гарантированная находка (один раз)
    milestones: [
      { id: 'crash_comms', region: 'crash', salvaged: 350, items: { commModule: 1 } },
      { id: 'crash_turret', region: 'crash', salvaged: 150, kit: 'turret' },
      { id: 'graveyard_speeder', region: 'graveyard', salvaged: 120, vehicle: 'speeder' },
      { id: 'graveyard_comms', region: 'graveyard', salvaged: 300, items: { commModule: 1 } },
      { id: 'graveyard_parts', region: 'graveyard', salvaged: 450, items: { hyperParts: 1 } },
    ],

    // ---------- РЕГИОНЫ ----------
    // kind: base — лагерь, wild — пустыня, town — поселение, hostile — вражеский лагерь
    // water/scrap — богатство (индекс в richness), pool — запас, regen — восстановление в сутки
    // links: [регион, % разведки, после которого он открывается]
    regions: {
      crash:       { kind: 'base', terrain: 'camp', ambush: 'tusken', dist: 0, danger: 0, water: 0, scrap: 3, scrapPool: 2600,
                     links: [['dunes', 0], ['ridge', 0]] },
      dunes:       { kind: 'wild', terrain: 'desert', ambush: 'tusken', dist: 1, danger: 1, water: 1, waterPool: 260, waterRegen: 4,
                     scrap: 1, scrapPool: 300, links: [['farm', 35], ['graveyard', 70]] },
      ridge:       { kind: 'wild', terrain: 'rocks', ambush: 'tusken', dist: 1, danger: 1, water: 2, waterPool: 320, waterRegen: 8,
                     scrap: 0, links: [['jundland', 40], ['canyon', 60], ['freighter', 50]] },
      farm:        { kind: 'wild', terrain: 'desert', ambush: 'tusken', dist: 2, danger: 1, water: 3, waterPool: 600, waterRegen: 14,
                     scrap: 1, scrapPool: 150, links: [['anchorhead', 60], ['saltflat', 40], ['oasis', 70]] },
      jundland:    { kind: 'wild', terrain: 'rocks', ambush: 'tusken', dist: 2, danger: 3, water: 2, waterPool: 500, waterRegen: 10,
                     scrap: 0, links: [['tusken_camp', 50], ['anchorhead', 80], ['outpost', 65]] },
      canyon:      { kind: 'wild', terrain: 'canyon', ambush: 'bandits', dist: 2, danger: 2, water: 1, waterPool: 200, waterRegen: 4,
                     scrap: 1, scrapPool: 200, links: [['bandit_den', 45], ['mos_espa', 85], ['windcaves', 60]] },
      graveyard:   { kind: 'wild', terrain: 'wreck', ambush: 'bandits', dist: 3, danger: 2, water: 0, scrap: 3, scrapPool: 1400,
                     links: [['krayt_lair', 60], ['junkyard', 40]] },
      anchorhead:  { kind: 'town', terrain: 'desert', ambush: 'bandits', dist: 3, danger: 1, trade: 'anchorhead', links: [] },
      mos_espa:    { kind: 'town', terrain: 'desert', ambush: 'bandits', dist: 4, danger: 2, trade: 'mos_espa', links: [['hutt_palace', 70]] },
      tusken_camp: { kind: 'hostile', terrain: 'rocks', ambush: 'tusken', dist: 3, danger: 3, enemy: 'tusken_camp', strength: 18 },
      bandit_den:  { kind: 'hostile', terrain: 'wreck', ambush: 'bandits', dist: 3, danger: 3, enemy: 'bandits', strength: 15 },
      krayt_lair:  { kind: 'hostile', terrain: 'desert', ambush: 'tusken', dist: 4, danger: 4, enemy: 'krayt', strength: 40 },
      hutt_palace: { kind: 'hostile', terrain: 'fort', ambush: 'hutt_guard', dist: 5, danger: 4, enemy: 'hutt_guard', strength: 60 },
      rebel_post:  { kind: 'hostile', terrain: 'rocks', ambush: 'rebels', dist: 4, danger: 3, enemy: 'rebels', strength: 17, hidden: true },
      junkyard:    { kind: 'town', terrain: 'wreck', ambush: 'scavengers', dist: 3, danger: 2, trade: 'junkyard', faction: 'scavengers',
                     attackable: true, enemy: 'scavengers', strength: 16, links: [] },
      outpost:     { kind: 'hostile', terrain: 'rocks', ambush: 'deserters', dist: 3, danger: 3, enemy: 'deserters', strength: 20, faction: 'deserters' },
      // новые места: оазис с прудом, соляная равнина, разбитый грузовик, пещеры в ущелье
      oasis:       { kind: 'wild', terrain: 'oasis', ambush: 'tusken', dist: 3, danger: 3, water: 4, waterPool: 900, waterRegen: 22, scrap: 0, links: [] },
      saltflat:    { kind: 'wild', terrain: 'salt', ambush: 'bandits', dist: 2, danger: 1, water: 0, scrap: 2, scrapPool: 500, links: [] },
      freighter:   { kind: 'wild', terrain: 'wreck', ambush: 'scavengers', dist: 2, danger: 2, water: 1, waterPool: 120, waterRegen: 2,
                     scrap: 3, scrapPool: 900, links: [] },
      windcaves:   { kind: 'wild', terrain: 'canyon', ambush: 'tusken', dist: 4, danger: 3, water: 3, waterPool: 700, waterRegen: 16,
                     scrap: 1, scrapPool: 200, links: [] },
    },

    // Добыча за победу над лагерем (упрощённый бой; в этапе 3 — по итогам автобоя)
    loot: {
      tusken_camp: { water: [80, 160], scrap: [20, 50], credits: [0, 40] },
      bandits:     { water: [40, 90], scrap: [40, 90], credits: [80, 180], items: { hyperParts: [1, 1], fuel: [0, 1] } },
      krayt:       { items: { kraytPearl: [1, 1] }, scrap: [0, 0] },
      hutt_guard:  { credits: [400, 700], water: [200, 300], items: { fuel: [1, 2] } },
      rebels:      { items: { commModule: [1, 1] }, credits: [50, 120], scrap: [30, 60] },
      scavengers:  { scrap: [150, 260], credits: [40, 120], items: { hyperParts: [0, 1], fuel: [0, 1] } },
      deserters:   { scrap: [60, 120], credits: [100, 220], water: [60, 120], items: { commModule: [0, 1], bacta: [2, 4] } },
    },

    // ---------- СОБЫТИЯ ----------
    // weight — вес при случайном выборе, minDay — не раньше дня, cooldown — дней до повтора,
    // max — сколько раз за кампанию. Остальные числа — последствия вариантов выбора.
    events: {
      fightGrowthPerDay: 0.005, // сила врагов в событиях растёт со временем
      dayChance: 0.45,     // шанс дневного события
      nightChance: 0.22,   // шанс ночного события (помимо налётов)
      list: {
        sandstorm:     { when: 'day', weight: 10, minDay: 2, cooldown: 5,
                         waterLoss: [15, 40], scrapLoss: [15, 35], droidEnergy: 15, droidDamage: [8, 18],
                         workScrap: [25, 50], workHurt: [1, 3], workHurtHp: [15, 30], workDisc: -3, waitDisc: -1 },
        heatwave:      { when: 'day', weight: 7, minDay: 3, cooldown: 6,
                         extraWaterPer: 1, extraDisc: 2, endureHurt: [8, 14], endureHp: [6, 12], endureDisc: -3, tentScrap: 30 },
        jawa_caravan:  { when: 'day', weight: 8, minDay: 3, cooldown: 7, stay: 3,
                         droidPrice: 180, droidHealth: [55, 75], raidStrength: 7,
                         raidScrap: [80, 150], raidCredits: [30, 90], raidRelation: -45 },
        hutt_envoy:    { when: 'day', weight: 6, minDay: 7, cooldown: 12, max: 3,
                         jobSquad: 6, jobDays: 4, jobPay: 300, jobRelation: 10, jobLossChance: 0.15,
                         tribute: 100, tributeRelation: 15, refuseRelation: -20, refuseDisc: 3,
                         scrapSell: 100, scrapPrice: 250 },
        hutt_job_return: { when: 'timer' },
        capsule_signal:{ when: 'any', weight: 7, minDay: 2, cooldown: 4, max: 4,
                         squad: 8, waterCost: 30, foundChance: 0.5, jawaChance: 0.25,
                         survivors: [2, 5], survivorHp: [35, 80], tuskenStrength: 6, ignoreDisc: -4 },
        capsule_jawas: { when: 'chain', ransomCredits: 120, ransomScrap: 90, forceStrength: 6, forceRelation: -30 },
        rebel_tracks:  { when: 'day', weight: 6, minDay: 6, cooldown: 8, max: 3,
                         ambushStrength: 8, trackChance: 0.6, trackRisk: 0.3, trackStrength: 10 },
        rebel_prisoner:{ when: 'chain', huttCredits: 200, huttRelation: 5, releaseDisc: -2 },
        krayt_roar:    { when: 'night', weight: 4, minDay: 9, cooldown: 12, max: 3,
                         hideRisk: 0.3, hideKills: [1, 2], baitWater: 60, fightStrength: 34, fightPearlChance: 1 },
        desertion_plot:{ when: 'day', weight: 14, minDay: 4, cooldown: 6,
                         below: 40, arrestDisc: 5, talkChance: 0.55, talkDisc: 4, talkFail: [1, 3],
                         letGo: [2, 5], letGoWater: 15, letGoDisc: 8 },
        sentry_shot:   { when: 'night', weight: 6, minDay: 2, cooldown: 5,
                         scoldDisc: 2, praiseDisc: -1, revealChance: 0.35 },
        cache_found:   { when: 'day', weight: 6, minDay: 2, cooldown: 6,
                         trapChance: 0.25, quickCredits: [60, 160], quickBacta: [1, 3], safeEnergy: 10, safeCredits: [40, 100] },
        reactor_leak:  { when: 'day', weight: 5, minDay: 5, cooldown: 10,
                         fixEnergy: 40, fixScrap: 20, pushFailChance: 0.5, pushEnergyLoss: 60, droidDamage: 30 },
        fever:         { when: 'day', weight: 5, minDay: 6, cooldown: 10,
                         bacta: 2, isolateSick: [3, 6], isolateHp: [15, 25], workSick: [5, 10], workHp: [10, 20], workDisc: -3 },
        merc_offer:    { when: 'day', weight: 5, minDay: 8, cooldown: 9, price: 90, minCredits: 90 },
        dewback:       { when: 'day', weight: 4, minDay: 3, cooldown: 15, max: 2,
                         tameChance: 0.6, tameHurtHp: [15, 30], feastDisc: 4, reconBonus: 0.25 },
        tusken_sign:   { when: 'day', weight: 4, minDay: 8, cooldown: 10, minRelation: -20,
                         water: 80, relation: 12, ignoreRelation: -5 },
        missing_patrol:{ when: 'day', weight: 4, minDay: 10, cooldown: 12,
                         lost: [2, 3], searchSquad: 10, searchStrength: 7, waitChance: 0.45, writeOffDisc: -5 },
        smugglers:     { when: 'day', weight: 3, minDay: 14, cooldown: 14, max: 3,
                         partsPrice: 350, fuelPrice: 110, fuelQty: 2, raidStrength: 16 },
        security_droid:{ when: 'day', weight: 4, minDay: 4, cooldown: 12, max: 3,
                         repairScrap: 60, repairEnergy: 30, droidHealth: [60, 80], scrapGain: 45, energyGain: 15 },
        broadcast:     { when: 'day', weight: 3, minDay: 12, cooldown: 15, needComms: 1, readDisc: 6 },
        bandit_toll:   { when: 'day', weight: 5, minDay: 9, cooldown: 10,
                         water: 60, scrap: 60 },
        bandit_raid:   { when: 'timer', strength: 13, lootWater: [40, 80], lootScrap: [30, 60], payWater: 90, payScrap: 90 },
        empire_day:    { when: 'fixed', day: 30, feastWater: 50, feastDisc: 8, plainDisc: 3 },
        womp_rats:     { when: 'night', weight: 5, minDay: 3, cooldown: 7, waterLoss: [10, 30], huntDisc: 1, trapEnergy: 5 },
        fleet_arrival: { when: 'signal' },
        rebel_strike:  { when: 'signal' },
        shuttle_launch:{ when: 'chain' },
        // новые фракции
        farm_plea:     { when: 'day', weight: 6, minDay: 8, cooldown: 9, squad: 10, allies: 3, strength: 9, water: 80, relation: 15, supplyCredits: 50, supplyRelation: 5, refuseRelation: -8 },
        farm_fair:     { when: 'day', weight: 4, minDay: 10, cooldown: 14, minRelation: 20, credits: 20, discipline: 6, relation: 4 },
        bounty_posted: { when: 'day', weight: 6, minDay: 12, max: 1, rumorChance: 0.4, rumorDisc: -3 },
        assassin_night:{ when: 'night', weight: 4, minDay: 13, cooldown: 8, strength: 9, hideScrap: 40, hideEnergy: 30 },
        guild_offer:   { when: 'day', weight: 4, minDay: 14, cooldown: 12, hirePrice: 260, payoff: 320, payoffRelation: 35 },
        scav_theft:    { when: 'night', weight: 5, minDay: 7, cooldown: 6, strength: 7, dealScrap: 40, dealCredits: 30, dealRelation: 8, ignoreScrap: 80, ignoreRelation: 2 },
        scav_caravan:  { when: 'day', weight: 4, minDay: 9, cooldown: 12, minRelation: 0, speederPrice: 150, kitPrice: 120 },
        deserter_signal:{ when: 'day', weight: 6, minDay: 8, max: 1, envoyWater: 30, envoyRelation: 12 },
        deserter_defectors:{ when: 'day', weight: 5, minDay: 12, cooldown: 10, minRelation: 15, count: [2, 4], xp: [60, 160], disc: -3, refuseRelation: -4 },
        deserter_raid: { when: 'night', weight: 4, minDay: 14, cooldown: 10, maxRelation: -10, strength: 12 },
        deserter_return:{ when: 'day', weight: 10, minDay: 15, max: 1, count: [6, 10], xp: [80, 220], disc: 6 },
        tusken_raid:   { when: 'raid', flareEnergy: 15, flareChance: 0.6, tributeWater: 60, tributeRelation: 3 },
      },
    },

    // ---------- СПЕЦИАЛИЗАЦИИ ----------
    // minRank — минимальное звание (индекс в ranks), minMissions — вылазок за плечами,
    // needSection — нужный отсек, cost — стоимость подготовки, days — дней учёбы
    specs: {
      sand:   { minRank: 1, minMissions: 6, cost: { water: 20 }, days: 1, waterSave: 0.4, fieldBonus: 0.15 },
      scout:  { minRank: 0, minMissions: 3, needVehicle: 'speeder', cost: { energy: 15 }, days: 1, reconMult: 1.6, ambushMult: 0.7 },
      heavy:  { minRank: 1, minMissions: 0, needSection: ['armory', 1], cost: { scrap: 40, energy: 20 }, days: 2 },
      sniper: { minRank: 2, minMissions: 0, needSection: ['armory', 1], cost: { scrap: 30, energy: 25 }, days: 3 },
      medic:  { minRank: 1, minMissions: 0, needSection: ['medbay', 1], cost: { items: { bacta: 2 } }, days: 2, campHeal: 1, campHealMax: 3 },
    },

    // ---------- ОБУСТРОЙСТВО ЛАГЕРЯ ----------
    // Постройки ставятся на поле перед корпусом (клетки x0..x1 поля боя) и видны в бою при обороне.
    // cell: wall — низкое укрытие, low — низкий объект (укрытие, не мешает стрелять), block — закрывает обзор,
    // unit — турель (стреляет в бою). upkeep — энергия в сутки.
    camp: {
      zone: { x0: 5, x1: 14 },
      refund: 0.5,
      items: {
        wall:   { cost: { scrap: 25 }, max: 16, cell: 'wall' },
        turret: { cost: { scrap: 25, energy: 25 }, max: 6, cell: 'unit', kit: true, upkeep: 1, destroyChance: 0.35 },
        vapor:  { cost: { scrap: 75, energy: 25 }, max: 3, cell: 'block', water: 8, need: ['vapor', 1] },
        panel:  { cost: { scrap: 60 }, max: 4, cell: 'low', energy: 4 },
        tent:   { cost: { scrap: 35 }, max: 4, cell: 'block', heal: 1 },
        mast:   { cost: { scrap: 40, energy: 20 }, max: 2, cell: 'block', raid: 0.12, upkeep: 1 },
        lamp:   { cost: { scrap: 20, energy: 10 }, max: 6, cell: 'low', night: 2, upkeep: 1 },
      },
    },

    // ---------- ТЕХНИКА, УКРЕПЛЕНИЯ, ДРОИДЫ ----------
    // Инженерные работы (приказ «Инженерные работы»): cost — материалы, work — человеко-дни
    projects: {
      fix_speeder:  { needSection: ['hangar', 1], cost: { scrap: 40, energy: 20 }, work: 8 },
      fix_walker:   { needSection: ['hangar', 1], cost: { scrap: 160, energy: 60 }, work: 32 },
      droid_repair: { needSection: ['workshop', 1], cost: { scrap: 30, energy: 20 }, work: 6, heal: 45 },
      droid_build:  { needSection: ['workshop', 2], cost: { scrap: 150, energy: 80 }, work: 30 },
      shuttle:      { needSection: ['hangar', 1], cost: { scrap: 300, energy: 150, items: { hyperParts: 2, fuel: 4 } }, work: 60 },
    },
    vehicles: {
      upkeep: { speeder: 0, walker: 4, turret: 1 },   // энергия в сутки за исправную машину
      battleDestroyChance: { walker: 0.3, turret: 0.4 },
    },
    droidSelfRepair: { perDay: [0, 6, 10], energy: 2 },  // мастерская дроидов чинит их сама
    armoryAccBonus: [0, 0, 4],                         // лучшее оружие из арсенала: +точность
    jawaSpeederPrice: 160,

    // ---------- ФИНАЛ ----------
    final: {
      fleetDays: 10,           // через сколько дней после сигнала приходит флот
      sectorBonusDays: 2,      // если известен сектор флота (событие «Обрывок передачи»)
      signalRaidMult: 2.0,     // после сигнала налёты чаще…
      signalStrengthMult: 1.3, // …и сильнее
      strikeChance: 0.4,       // шанс ночного удара повстанцев, услышавших сигнал
      strikeStrength: 24,
      finalArmy: 'rebels',
      finalStrength: 54,       // финальный бой перед посадкой флота
      mercyStrengthMult: 0.75, // если отпустили пленного повстанца — их меньше
      shuttleCapacity: 24,
      abandonCredits: 300,
    },
    // Итоговый счёт: base — за исход, survivor — за каждого выжившего и т.д.
    score: {
      base: { fleet: 1000, fleet_costly: 650, shuttle_all: 900, shuttle_some: 550, abandon: 50, dead: 0, mutiny: 0 },
      survivor: 40, kill: 2, death: -15, day: -4,
      diffMult: { easy: 0.7, normal: 1.0, hard: 1.4 },
    },

    // ---------- АВТОБОЙ ----------
    battle: {
      w: 24, h: 16,                 // размер поля в клетках
      maxTicks: 900,                // предел боя (тик = 0,1 с боевого времени)
      maxPerSide: 40,               // больше бойцов на поле не выводится
      playbackTps: 10,              // тиков в секунду при скорости ×1 (×1 — как в жизни, по умолчанию ×2)
      // Характеристики: hp — здоровье, armor — броня, acc — точность (%), dmg — урон,
      // range — дальность (клетки), cd — перезарядка (тики), speed — тиков на клетку, morale — стойкость (null — нет)
      types: {
        trooper:      { hp: 60,  armor: 2, acc: 48, dmg: [10, 15], range: 7,  cd: 12, speed: 6, morale: 60 },
        sand:         { hp: 62,  armor: 2, acc: 50, dmg: [10, 15], range: 7,  cd: 12, speed: 5, morale: 65, desert: true },
        heavy:        { hp: 74,  armor: 3, acc: 44, dmg: [8, 12],  range: 7,  cd: 20, speed: 8, morale: 65, burst: 3 },
        sniper:       { hp: 52,  armor: 1, acc: 70, dmg: [24, 32], range: 12, cd: 30, speed: 6, morale: 60, coverPierce: 0.5 },
        scout:        { hp: 56,  armor: 2, acc: 46, dmg: [9, 13],  range: 5,  cd: 11, speed: 3, morale: 60 },
        medic:        { hp: 56,  armor: 2, acc: 44, dmg: [8, 12],  range: 6,  cd: 14, speed: 6, morale: 65, heal: 9, healCd: 24 },
        droid:        { hp: 150, armor: 5, acc: 48, dmg: [12, 17], range: 6,  cd: 14, speed: 8, morale: null },
        merc:         { hp: 66,  armor: 2, acc: 50, dmg: [11, 16], range: 7,  cd: 12, speed: 6, morale: 55 },
        walker:       { hp: 320, armor: 8, acc: 58, dmg: [26, 34], range: 9,  cd: 22, speed: 9, morale: null, big: true },
        turret:       { hp: 140, armor: 6, acc: 60, dmg: [16, 22], range: 9,  cd: 14, speed: 0, morale: null, static: true },
        // противники
        tusken:       { hp: 66,  armor: 1, acc: 52, dmg: [15, 23], range: 1,  cd: 10, speed: 4, morale: 70 },
        tusken_rifle: { hp: 50,  armor: 0, acc: 62, dmg: [18, 26], range: 11, cd: 32, speed: 6, morale: 60 },
        tusken_chief: { hp: 95,  armor: 2, acc: 56, dmg: [20, 28], range: 1,  cd: 10, speed: 5, morale: 95, leader: true,
                        abil: { kind: 'cry', cd: 200, radius2: 36, below: 50, min: 2, morale: 25, supp: 15 } },
        jawa:         { hp: 26,  armor: 0, acc: 42, dmg: [6, 10],  range: 5,  cd: 12, speed: 5, morale: 30, ion: 2.5 },
        bandit:       { hp: 48,  armor: 1, acc: 46, dmg: [9, 13],  range: 6,  cd: 11, speed: 5, morale: 50 },
        swoop:        { hp: 42,  armor: 1, acc: 42, dmg: [9, 13],  range: 5,  cd: 11, speed: 2, morale: 50 },
        bandit_boss:  { hp: 90,  armor: 3, acc: 54, dmg: [12, 17], range: 6,  cd: 11, speed: 5, morale: 85, leader: true, abil: { kind: 'nade', cd: 190, range: 6, radius2: 2, dmg: [14, 22], supp: 22, min: 2 } },
        rebel:        { hp: 56,  armor: 1, acc: 56, dmg: [10, 14], range: 7,  cd: 12, speed: 5, morale: 65 },
        rebel_heavy:  { hp: 64,  armor: 2, acc: 48, dmg: [8, 12],  range: 7,  cd: 20, speed: 7, morale: 70, burst: 3 },
        rebel_officer:{ hp: 70,  armor: 2, acc: 60, dmg: [11, 15], range: 7,  cd: 12, speed: 5, morale: 90, leader: true, abil: { kind: 'nade', cd: 190, range: 6, radius2: 2, dmg: [14, 22], supp: 22, min: 2 } },
        smuggler:     { hp: 54,  armor: 1, acc: 58, dmg: [11, 16], range: 6,  cd: 11, speed: 5, morale: 55 },
        gamorrean:    { hp: 110, armor: 3, acc: 50, dmg: [20, 30], range: 1,  cd: 13, speed: 7, morale: 60 },
        hutt_guard:   { hp: 58,  armor: 2, acc: 54, dmg: [11, 15], range: 7,  cd: 12, speed: 6, morale: 55 },
        bounty_hunter:{ hp: 120, armor: 5, acc: 70, dmg: [16, 24], range: 9,  cd: 14, speed: 5, morale: 90,
                        abil: { kind: 'nade', cd: 200, range: 7, radius2: 2, dmg: [16, 24], supp: 22, min: 2 } },
        assassin_droid:{ hp: 140, armor: 6, acc: 66, dmg: [18, 26], range: 8, cd: 16, speed: 6, morale: null },
        scavenger:    { hp: 40,  armor: 1, acc: 42, dmg: [7, 11],  range: 5,  cd: 10, speed: 4, morale: 40 },
        scav_droid:   { hp: 95,  armor: 4, acc: 40, dmg: [10, 14], range: 4,  cd: 14, speed: 7, morale: null, blast: { radius2: 2, dmg: [14, 22] } },
        scav_boss:    { hp: 85,  armor: 3, acc: 50, dmg: [8, 12],  range: 6,  cd: 18, speed: 5, morale: 80, leader: true, burst: 3, abil: { kind: 'nade', cd: 190, range: 6, radius2: 2, dmg: [14, 22], supp: 22, min: 2 } },
        deserter:     { hp: 60,  armor: 2, acc: 50, dmg: [10, 15], range: 7,  cd: 12, speed: 6, morale: 55 },
        deserter_heavy:{ hp: 72, armor: 3, acc: 44, dmg: [8, 12],  range: 7,  cd: 20, speed: 8, morale: 60, burst: 3 },
        deserter_captain:{ hp: 80, armor: 2, acc: 58, dmg: [11, 15], range: 7, cd: 12, speed: 5, morale: 85, leader: true, abil: { kind: 'nade', cd: 190, range: 6, radius2: 2, dmg: [14, 22], supp: 22, min: 2 } },
        farmer:       { hp: 45,  armor: 0, acc: 46, dmg: [12, 18], range: 9,  cd: 22, speed: 6, morale: 50 },
        krayt:        { hp: 1500, armor: 6, acc: 72, dmg: [40, 60], range: 2, cd: 15, speed: 5, morale: null, big: true, sweep: 0.7,
                        abil: { kind: 'roar', cd: 170, radius2: 49, supp: 30, morale: 8 } },
      },
      // Состав врага: [тип, вес в отряде, «цена» в единицах силы]
      armies: {
        tusken:      { units: [['tusken', 3, 1], ['tusken_rifle', 1, 1.1]], leader: 'tusken_chief', leaderFrom: 14, tactic: 'flank', map: 'rocks', retreatAt: 0.65 },
        tusken_camp: { units: [['tusken', 3, 1], ['tusken_rifle', 1, 1.1]], leader: 'tusken_chief', leaderFrom: 0, tactic: 'defense', map: 'rocks', retreatAt: 0.75 },
        jawa:        { units: [['jawa', 1, 0.6]], tactic: 'defense', map: 'desert', retreatAt: 0.4 },
        bandits:     { units: [['bandit', 2, 1], ['swoop', 1, 1]], leader: 'bandit_boss', leaderFrom: 12, tactic: 'assault', map: 'rocks', retreatAt: 0.6 },
        rebels:      { units: [['rebel', 3, 1.1], ['rebel_heavy', 1, 1.3]], leader: 'rebel_officer', leaderFrom: 10, tactic: 'defense', map: 'rocks', retreatAt: 0.7 },
        smugglers:   { units: [['smuggler', 1, 1.1]], tactic: 'defense', map: 'desert', retreatAt: 0.6 },
        hutt_guard:  { units: [['hutt_guard', 2, 1.1], ['gamorrean', 1, 1.5]], tactic: 'defense', map: 'fort', retreatAt: 0.8 },
        guild:       { units: [['bounty_hunter', 2, 4], ['assassin_droid', 1, 4.5]], tactic: 'flank', map: 'desert', retreatAt: 0.6 },
        scavengers:  { units: [['scavenger', 3, 0.8], ['scav_droid', 1, 1.6]], leader: 'scav_boss', leaderFrom: 10, tactic: 'assault', map: 'wreck', retreatAt: 0.5 },
        deserters:   { units: [['deserter', 3, 1], ['deserter_heavy', 1, 1.3]], leader: 'deserter_captain', leaderFrom: 12, tactic: 'defense', map: 'rocks', retreatAt: 0.6 },
        krayt:       { units: [['krayt', 1, 34]], max: 1, tactic: 'assault', map: 'desert', retreatAt: 1 },
      },
      maxEnemies: 34,
      // Командиры (наши — от звания officerRank) воодушевляют бойцов в радиусе: +точность, быстрее восстанавливается дух
      aura: { officerRank: 3, radius2: 16, acc: 4, regen: 3 },
      throwTicks: 6,                // полёт гранаты (тики)
      // Бочки с топливом: сколько на поле по типу местности, где стоят, прочность, взрыв
      barrels: { count: { desert: [1, 3], rocks: [1, 2], wreck: [3, 5], fort: [2, 3] }, x0: 6, x1: 17, hp: 20, strayChance: 0.3, radius2: 5, dmg: [24, 40], supp: 35 },
      night: { acc: [-10, -3] },    // ночной бой: штраф точности [нашим, противнику]
      surprise: { morale: -20, enemyZone: [13, 18] }, // внезапный налёт
      hit: { min: 5, max: 95, distFree: 3, distPenalty: 3, moving: 10, suppFactor: 0.5, meleeBonus: 15, burstPenalty: 10 },
      cover: { solid: 30, wall: 40, dune: 10 },
      crit: { chance: 0.08, mult: 1.6 },
      morale: { allyDown: -10, allyRadius: 5, leaderDown: -25, hit: -4, regen: 0.08, breakAt: 15, rallyAt: 40, disciplineFactor: 0.4 },
      supp: { perMiss: 7, perHit: 4, decay: 0.5, max: 60, coverAt: 20 },
      defenseIdleAdvance: 70,       // обороняющиеся без цели столько тиков — начинают выдвигаться
      flankMaxTicks: 160,           // сколько длится обходной манёвр
      // Исход для упавших бойцов
      downed: { deathChance: 0.4, medicReduce: 0.1, medicReduceMax: 0.25, lostDeathChance: 0.7,
                heavyHealth: [12, 30], droidDestroyChance: 0.5, droidHealth: [10, 25] },
      xp: { participate: 3, kill: 8, win: 5 },
      scrapPerKill: 2,
      // Приказы генерала: cd — перезарядка, dur — длительность (тики)
      orders: {
        focus:   { cd: 180, dur: 50, acc: 12 },
        hold:    { cd: 240, dur: 60, morale: 30, armor: 2, lossTrigger: 0.2, moraleTrigger: 45 },
        smoke:   { cd: 260, dur: 80, radius2: 3, suppTrigger: 3 },
        rush:    { cd: 250, dur: 50, speed: 1.5 },
        grenade: { cd: 200, dmg: [26, 40], radius2: 2, supp: 30, minTargets: 3, needSection: ['armory', 1] },
        medkit:  { cd: 300, heal: 20, below: 0.5, minWounded: 3, needSection: ['medbay', 1] },
      },
      maxOrders: 2,
      retreatOptions: [0, 0.25, 0.5],
      // Ширина зон развёртывания
      zones: { attackerDepth: 4, defenderDepth: 5 },
    },

    // ---------- ЧЕРТЫ ХАРАКТЕРА ----------
    // Даются бойцу (и наёмнику) при появлении. В бою: acc — точность, hp — здоровье, morale — стойкость,
    // speed — множитель времени на шаг (меньше — быстрее); leader — воодушевляет бойцов рядом, как офицер.
    // death — множитель шанса гибели от тяжёлой раны, heal — множитель выздоровления, work — к работам и вылазкам.
    traits: {
      chance: 0.75,
      list: {
        eagle:   { weight: 3, acc: 6 },
        tough:   { weight: 3, hp: 12, heal: 1.3 },
        brave:   { weight: 3, morale: 15 },
        swift:   { weight: 2, speed: 0.85 },
        lucky:   { weight: 2, death: 0.55 },
        handy:   { weight: 2, work: 0.15 },
        leader:  { weight: 1, leader: true, morale: 5 },
        nervous: { weight: 2, morale: -15 },
        clumsy:  { weight: 1, acc: -5 },
      },
      nicknameKills: 5,             // столько побед в бою — и у бойца появляется прозвище
    },

    chronicleLimit: 1500,
  };
})(globalThis.G = globalThis.G || {});
