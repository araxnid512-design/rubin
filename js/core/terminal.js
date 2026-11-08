/*
 * Терминал связи: заказ бойцов и припасов за кредиты с доставкой шаттлом через несколько дней,
 * и доска заказов (контракты) от местных фракций — источник кредитов.
 * Состояние: s.terminal = { orders: [доставки в пути], seq, landed, offers, active, nextRefresh, cseq, done }
 */
(function (G) {
  'use strict';
  const U = G.U;
  const T = {};
  const C = () => G.CONFIG.terminal;
  const say = (s, t, tone) => G.Game.say(s, t, tone);

  T.ensure = function (s) {
    if (!s.terminal) s.terminal = { orders: [], seq: 0, landed: null, offers: [], active: [], nextRefresh: 0, cseq: 0, done: 0 };
    return s.terminal;
  };

  // ---------- ПОСТАВКИ ----------
  T.price = function (s, id) {
    const g = C().goods[id];
    let k = 1;
    if (g.rel) {
      const r = G.Factions ? G.Factions.rel(s, g.rel) : 0;
      k = r >= 0 ? 1 - Math.min(C().relDiscountMax, r * C().relDiscount) : 1 + -r * C().relPenalty;
    }
    return Math.round(g.price * k * (G.Res.diff ? (G.Res.diff(s).prices || 1) : 1));
  };

  // null — можно заказать, иначе причина
  T.why = function (s, id) {
    const g = C().goods[id];
    const t = T.ensure(s);
    if (!g) return 'Нет такого товара.';
    if (s.over) return 'Кампания окончена.';
    if (g.need && (s.sections[g.need[0]] ? s.sections[g.need[0]].level : 0) < g.need[1]) {
      return 'Нужен отсек «' + G.TEXT.sections[g.need[0]].name + '» уровня ' + g.need[1] + '.';
    }
    if (g.rel && G.Factions && G.Factions.rel(s, g.rel) < g.minRel) return 'Фракция «' + G.TEXT.factions[g.rel].name + '» не станет с нами работать.';
    if (t.orders.length >= C().maxOrders) return 'В пути уже ' + t.orders.length + ' шаттла — больше площадка не примет.';
    if (s.res.credits < T.price(s, id)) return 'Не хватает кредитов.';
    return null;
  };

  T.order = function (s, id) {
    const why = T.why(s, id);
    if (why) return why;
    const g = C().goods[id];
    const t = T.ensure(s);
    const price = T.price(s, id);
    G.Res.add(s, 'credits', -price);
    const o = { id: ++t.seq, good: id, eta: s.day + g.days, ordered: s.day, price: price };
    t.orders.push(o);
    s.stats.ordered = (s.stats.ordered || 0) + 1;
    say(s, 'Через терминал заказано: ' + G.TEXT.terminal.goods[id].name + ' за ' + price + ' кр. Шаттл прибудет ' + U.pl(g.days, ['день', 'дня', 'дней']).replace(/^1 день$/, 'завтра').replace(/^(\d+)/, 'через $1') + '.', 'info');
    return null;
  };

  function riskOf(s, g) {
    let p = C().lossChance * (g.risk || 1);
    if (s.sections.sensors && s.sections.sensors.level > 0) p *= C().sensorsMult;
    return p;
  }
  T.risk = (s, id) => riskOf(s, C().goods[id]);

  function deliver(s, rng, o) {
    const g = C().goods[o.good];
    const name = G.TEXT.terminal.goods[o.good].name;
    const got = [];
    if (g.unit) {
      for (let i = 0; i < g.n; i++) {
        let u;
        if (g.unit === 'merc') u = G.Units.createMerc(s, rng);
        else if (g.unit === 'droid') u = G.Units.createDroid(s, rng, { origin: 'shuttle' });
        else u = G.Units.createTrooper(s, rng, { xp: U.rollRange(rng, g.xp), origin: 'shuttle' });
        got.push(G.Units.title(u));
      }
      say(s, 'На рассвете у лагеря сел шаттл: «' + name + '». В строй встали: ' + got.join(', ') + '.', 'good');
    } else {
      const parts = [];
      for (const k in g.give) {
        if (k === 'bacta') { G.Res.addItem(s, 'bacta', g.give[k]); parts.push('бакта ×' + g.give[k]); }
        else { G.Res.add(s, k, g.give[k]); parts.push(G.TEXT.res[k].name.toLowerCase() + ' +' + g.give[k]); }
      }
      say(s, 'На рассвете сел грузовой шаттл: «' + name + '» — ' + parts.join(', ') + '.', 'good');
    }
    s.stats.shuttles = (s.stats.shuttles || 0) + 1;
    T.ensure(s).landed = { day: s.day + 1, good: o.good };
    G.Game.chron(s, s.day + 1, 'Прибыл шаттл: «' + name + '».', 'good');
  }

  // Рассвет: прилетают шаттлы, проверяются и обновляются заказы
  T.dawn = function (s, rng) {
    const t = T.ensure(s);
    const keep = [];
    for (const o of t.orders) {
      if (s.day + 1 < o.eta) { keep.push(o); continue; }
      const g = C().goods[o.good];
      if (rng.chance(riskOf(s, g))) {
        say(s, 'Шаттл с грузом «' + G.TEXT.terminal.goods[o.good].name + '» не долетел: его перехватили над пустошью. Деньги пропали.', 'bad');
        G.Game.chron(s, s.day + 1, 'Шаттл с поставкой перехвачен.', 'bad');
        continue;
      }
      if (!o.delayed && rng.chance(C().delayChance)) {
        o.delayed = true; o.eta++;
        say(s, 'Пыльная буря: шаттл «' + G.TEXT.terminal.goods[o.good].name + '» задерживается на сутки.', 'info');
        keep.push(o);
        continue;
      }
      deliver(s, rng, o);
    }
    t.orders = keep;
    T.check(s, s.day + 1);
    // сроки контрактов
    const K = C().contracts;
    t.active = t.active.filter((c) => {
      if (s.day + 1 <= c.deadline) return true;
      if (G.Factions && c.giver) G.Factions.change(s, c.giver, K.failRel);
      say(s, 'Сорван контракт: ' + T.title(c) + '. ' + G.TEXT.factions[c.giver].name + ' недовольны.', 'bad');
      return false;
    });
    if (s.day + 1 >= t.nextRefresh) T.refresh(s, s.day + 1);
  };

  // ---------- КОНТРАКТЫ ----------
  const GROUPS = {
    tusken: { types: ['tusken', 'tusken_rifle', 'tusken_chief'], giver: 'farmers', army: 'tusken' },
    bandits: { types: ['bandit', 'swoop', 'bandit_boss'], giver: 'hutt', army: 'bandits' },
    scavengers: { types: ['scavenger', 'scav_droid', 'scav_boss'], giver: 'jawa', army: 'scavengers' },
    deserters: { types: ['deserter', 'deserter_heavy', 'deserter_captain'], giver: 'guild', army: 'deserters' },
  };
  T.GROUPS = GROUPS;
  const CLEAR_GIVER = { tusken_camp: 'farmers', bandit_den: 'hutt', krayt_lair: 'farmers', outpost: 'guild', junkyard: 'jawa', rebel_post: 'guild', hutt_palace: 'guild' };

  const killsOf = (s, group) => GROUPS[group].types.reduce((a, t) => a + ((s.seen && s.seen[t]) || 0), 0);

  T.progress = function (s, c) {
    if (c.type === 'hunt') return [Math.min(c.need, killsOf(s, c.target) - c.base), c.need];
    if (c.type === 'clear') return [s.regions[c.target].cleared ? 1 : 0, 1];
    if (c.type === 'scout') return [Math.min(c.need, s.regions[c.target].explored), c.need];
    if (c.type === 'deliver') return [Math.min(c.need, c.res === 'water' ? s.res.water : s.res.scrap), c.need];
    return [0, 1];
  };

  T.title = function (c) {
    const X = G.TEXT.terminal.contracts;
    if (c.type === 'hunt') return X.hunt.replace('{n}', c.need).replace('{who}', G.TEXT.terminal.groups[c.target]);
    if (c.type === 'clear') return X.clear.replace('{place}', G.TEXT.regions[c.target].name);
    if (c.type === 'scout') return X.scout.replace('{place}', G.TEXT.regions[c.target].name).replace('{n}', c.need);
    if (c.type === 'deliver') return X.deliver.replace('{n}', c.need).replace('{what}', c.res === 'water' ? 'л воды' : 'ед. металла');
    return '';
  };

  // Новые предложения: свой генератор от зерна и дня — не сбивает основную случайность игры
  T.refresh = function (s, day) {
    const t = T.ensure(s);
    const K = C().contracts;
    const rng = G.Rng.make((s.seed * 7919 + day * 104729) | 0);
    const known = (id) => s.regions[id] && s.regions[id].known;
    const okGiver = (f) => !G.Factions || G.Factions.rel(s, f) > -30;
    const pool = [];
    for (const g in GROUPS) {
      const met = (s.seen && GROUPS[g].types.some((x) => s.seen[x] != null)) || Object.keys(G.CONFIG.regions).some((id) => known(id) && (G.CONFIG.regions[id].ambush === GROUPS[g].army || G.CONFIG.regions[id].enemy === GROUPS[g].army));
      if (met && okGiver(GROUPS[g].giver)) pool.push({ type: 'hunt', target: g, giver: GROUPS[g].giver });
    }
    for (const id in CLEAR_GIVER) {
      const r = s.regions[id];
      if (r && r.known && !r.cleared && r.explored >= 20 && okGiver(CLEAR_GIVER[id])) pool.push({ type: 'clear', target: id, giver: CLEAR_GIVER[id] });
    }
    for (const id in G.CONFIG.regions) {
      const r = s.regions[id];
      if (id !== 'crash' && r && r.known && r.explored < 45 && G.CONFIG.regions[id].kind !== 'hostile') pool.push({ type: 'scout', target: id, giver: rng.pick(['guild', 'hutt']) });
    }
    if (okGiver('hutt')) pool.push({ type: 'deliver', res: 'water', giver: 'hutt' });
    if (okGiver('jawa')) pool.push({ type: 'deliver', res: 'scrap', giver: 'jawa' });
    rng.shuffle(pool);
    const busy = new Set(t.active.map((c) => c.type + ':' + (c.target || c.res)));
    const offers = [];
    for (const p of pool) {
      if (offers.length >= K.slots) break;
      const key = p.type + ':' + (p.target || p.res);
      if (busy.has(key) || offers.some((o) => o.type + ':' + (o.target || o.res) === key)) continue;
      const c = Object.assign({ id: ++t.cseq }, p);
      const R = K.reward;
      if (p.type === 'hunt') { c.need = rng.int(K.hunt[0], K.hunt[1]); c.reward = c.need * R.perKill + rng.int(0, 30); c.days = K.days.hunt; }
      else if (p.type === 'clear') { c.need = 1; c.reward = rng.int(R.clear[0], R.clear[1]); c.days = K.days.clear; }
      else if (p.type === 'scout') { c.need = 60; c.reward = rng.int(R.scout[0], R.scout[1]); c.days = K.days.scout; }
      else { c.need = p.res === 'water' ? rng.int(12, 25) * 10 : rng.int(6, 14) * 10; c.reward = Math.round(c.need * (p.res === 'water' ? R.water : R.scrap)); c.days = K.days.deliver; }
      offers.push(c);
    }
    t.offers = offers;
    t.nextRefresh = day + K.refreshDays;
  };

  T.whyAccept = function (s, id) {
    const t = T.ensure(s);
    if (t.active.length >= C().contracts.maxActive) return 'Одновременно — не больше ' + C().contracts.maxActive + ' контрактов.';
    if (!t.offers.some((c) => c.id === id)) return 'Предложение уже снято.';
    return null;
  };

  T.accept = function (s, id) {
    const why = T.whyAccept(s, id);
    if (why) return why;
    const t = T.ensure(s);
    const c = t.offers.find((x) => x.id === id);
    t.offers = t.offers.filter((x) => x.id !== id);
    c.deadline = s.day + c.days;
    if (c.type === 'hunt') c.base = killsOf(s, c.target);
    t.active.push(c);
    say(s, 'Принят контракт: ' + T.title(c) + ' — ' + c.reward + ' кр., срок до дня ' + c.deadline + '.', 'info');
    return null;
  };

  function complete(s, c, day) {
    const t = T.ensure(s);
    G.Res.add(s, 'credits', c.reward);
    if (G.Factions && c.giver) G.Factions.change(s, c.giver, C().contracts.doneRel);
    t.done++;
    s.stats.contracts = (s.stats.contracts || 0) + 1;
    say(s, 'Контракт выполнен: ' + T.title(c) + '. Получено ' + c.reward + ' кр.', 'good');
    G.Game.chron(s, day || s.day, 'Выполнен контракт: ' + T.title(c) + ' (+' + c.reward + ' кр.).', 'good');
  }

  // Сдать груз по контракту доставки
  T.handIn = function (s, id) {
    const t = T.ensure(s);
    const c = t.active.find((x) => x.id === id);
    if (!c || c.type !== 'deliver') return 'Нечего сдавать.';
    const have = c.res === 'water' ? s.res.water : s.res.scrap;
    if (have < c.need) return 'Не хватает: нужно ' + c.need + '.';
    G.Res.add(s, c.res, -c.need);
    t.active = t.active.filter((x) => x !== c);
    complete(s, c);
    return null;
  };

  // Выполненные контракты (бои, разведка, разгром) закрываются сами
  T.check = function (s, day) {
    const t = T.ensure(s);
    const done = [];
    t.active = t.active.filter((c) => {
      if (c.type === 'deliver') return true;
      const [a, b] = T.progress(s, c);
      if (a >= b) { done.push(c); return false; }
      return true;
    });
    for (const c of done) complete(s, c, day);
    return done;
  };

  G.Terminal = T;
})(globalThis.G = globalThis.G || {});
