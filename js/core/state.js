/* Состояние игры: новая кампания и работа с ресурсами. */
(function (G) {
  'use strict';
  const U = G.U;

  // ---------- РЕСУРСЫ ----------
  const Res = {};

  Res.diff = (s) => G.CONFIG.difficulty[s.difficulty] || G.CONFIG.difficulty.normal;

  Res.energyCap = function (s) {
    const up = G.CONFIG.upkeep;
    return up.energyCapBase + up.energyCapPerReactor * s.sections.reactor.level;
  };

  // Изменить ресурс с учётом ограничений; возвращает фактическое изменение
  Res.add = function (s, key, amount) {
    amount = Math.round(amount);
    const before = s.res[key];
    let v = before + amount;
    if (key === 'energy') v = U.clamp(v, 0, Res.energyCap(s));
    else if (key === 'discipline') v = U.clamp(v, 0, G.CONFIG.discipline.max);
    else v = Math.max(0, v);
    s.res[key] = v;
    return v - before;
  };
  Res.discipline = (s, delta) => Res.add(s, 'discipline', delta);

  Res.addItem = function (s, key, n) {
    s.items[key] = Math.max(0, (s.items[key] || 0) + n);
  };

  // cost = { scrap, energy, credits, water, items: { commModule: 1 } }
  Res.canPay = function (s, cost) {
    if (!cost) return true;
    for (const k of ['water', 'scrap', 'energy', 'credits']) {
      if (cost[k] && s.res[k] < cost[k]) return false;
    }
    if (cost.items) for (const k in cost.items) if ((s.items[k] || 0) < cost.items[k]) return false;
    return true;
  };
  Res.pay = function (s, cost) {
    if (!Res.canPay(s, cost)) return false;
    for (const k of ['water', 'scrap', 'energy', 'credits']) if (cost[k]) s.res[k] -= cost[k];
    if (cost.items) for (const k in cost.items) s.items[k] -= cost.items[k];
    return true;
  };
  Res.costText = function (cost) {
    const T = G.TEXT;
    const parts = [];
    for (const k of ['scrap', 'energy', 'water', 'credits']) {
      if (cost[k]) parts.push(k === 'water' ? cost[k] + ' л воды' : k === 'credits' ? cost[k] + ' кр.' : cost[k] + ' ' + T.res[k].gen);
    }
    if (cost.items) for (const k in cost.items) parts.push(T.items[k].name + ' ×' + cost.items[k]);
    return parts.join(', ');
  };

  // Запас воды в днях при текущем расходе
  Res.waterDays = function (s) {
    const need = G.Day.waterNeed(s, null) - G.Base.waterProduction(s);
    if (need <= 0) return Infinity;
    return s.res.water / need;
  };

  G.Res = Res;

  // ---------- НОВАЯ ИГРА ----------
  const State = {};

  State.newGame = function (opts) {
    opts = opts || {};
    const C = G.CONFIG;
    const seed = opts.seed != null ? (opts.seed >>> 0) : ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const s = {
      v: C.saveVersion,
      seed: seed,
      rng: { s: seed | 0 },
      day: 1,
      difficulty: opts.difficulty || 'normal',
      res: U.clone(C.start.resources),
      items: U.clone(C.start.items),
      rations: 'full',
      units: [],
      nextUnitId: 1,
      usedNums: {},
      sections: {},
      regions: {},
      relations: U.clone(C.start.relations),
      orders: [],
      queue: [],
      pending: null,
      guards: 0,
      report: { day: 1, lines: [] },
      lastReport: null,
      chronicle: [],
      flags: {},
      timers: [],
      eventLog: {},
      replays: [],
      vehicles: [],
      vehicleSeq: 0,
      fort: { walls: 0 },
      projects: {},
      visitors: {},
      lastSpeechDay: -10,
      speechStreak: 0,
      salvaged: 0,
      droidsOffline: false,
      stats: { kills: 0, deaths: 0, battles: 0, victories: 0, defeats: 0, waterFound: 0, scrapFound: 0, deserted: 0, raids: 0 },
      over: null,
      phase: 'orders',
    };
    const rng = new G.Rng(s.rng);

    // Отсеки
    for (const id in C.sections) {
      s.sections[id] = { level: C.sections[id].level, progress: 0, paid: false };
    }

    // Регионы
    for (const id in C.regions) {
      const r = C.regions[id];
      s.regions[id] = {
        known: id === 'crash' || C.start.knownRegions.indexOf(id) >= 0,
        explored: id === 'crash' ? 100 : 0,
        water: r.waterPool || 0,
        scrap: r.scrapPool || 0,
        visits: 0,
        cleared: false,
      };
    }

    // Бойцы: сначала офицеры, затем рядовые
    const ranksOrder = [['lt', C.start.officers.lt], ['sgt', C.start.officers.sgt], ['cpl', C.start.officers.cpl]];
    let made = 0;
    for (const [rank, n] of ranksOrder) {
      for (let i = 0; i < n && made < C.start.troopers; i++, made++) {
        G.Units.createTrooper(s, rng, { xp: U.rollRange(rng, C.start.xpByRank[rank]) });
      }
    }
    while (made < C.start.troopers) {
      G.Units.createTrooper(s, rng, { xp: U.rollRange(rng, C.start.xpByRank.pvt) });
      made++;
    }
    for (let i = 0; i < C.start.droids; i++) G.Units.createDroid(s, rng, { name: G.TEXT.names.droids[i] });

    // Раненые при крушении
    const troopers = rng.shuffle(G.Units.troopers(s).slice());
    let k = 0;
    for (let i = 0; i < C.start.heavyWounded; i++) troopers[k++].health = U.rollRange(rng, C.start.heavyHealth);
    for (let i = 0; i < C.start.lightWounded; i++) troopers[k++].health = U.rollRange(rng, C.start.lightHealth);

    // Вступительный доклад
    s.lastReport = {
      day: 0,
      title: 'Крушение',
      morning: G.TEXT.intro,
      lines: [],
    };
    G.Game.chron(s, 0, 'Звёздный разрушитель «Железный Предел» потерпел крушение в пустыне Татуина. Командование принял генерал Колрат.', 'event');
    return s;
  };

  G.State = State;
})(globalThis.G = globalThis.G || {});
