/*
 * Управление ходом. Вся игра — это состояние s и команды над ним:
 * добавить приказ, завершить день, ответить на событие, закрыть торговлю.
 * Исполнение дня идёт по очереди шагов (s.queue). Если шаг требует решения
 * игрока, он кладёт его в s.pending, и очередь ждёт ответа.
 */
(function (G) {
  'use strict';
  const U = G.U;

  const Game = {};

  Game.rng = (s) => new G.Rng(s.rng);

  Game.chron = function (s, day, text, tone) {
    s.chronicle.push({ d: day, t: text, k: tone || 'info' });
    const lim = G.CONFIG.chronicleLimit;
    if (s.chronicle.length > lim) s.chronicle.splice(0, s.chronicle.length - lim);
  };

  // Строка в текущий доклад и хронику
  Game.say = function (s, text, tone) {
    s.report.lines.push({ t: text, k: tone || 'info' });
    Game.chron(s, s.day, text, tone);
  };

  Game.newGame = (opts) => G.State.newGame(opts);

  // ---------- ПРИКАЗЫ ----------
  Game.busyIds = function (s) {
    const set = new Set();
    for (const o of s.orders) for (const id of o.unitIds || []) set.add(id);
    return set;
  };
  Game.freeUnits = function (s) {
    const busy = Game.busyIds(s);
    return G.Units.alive(s).filter((u) => !busy.has(u.id) && G.Units.isFit(s, u));
  };
  Game.freeCounts = function (s) {
    const free = Game.freeUnits(s);
    return {
      people: free.filter((u) => u.kind !== 'droid').length,
      droids: free.filter((u) => u.kind === 'droid').length,
    };
  };
  Game.ordersLeft = (s) => G.CONFIG.orders.perDay - s.orders.length;

  Game.makeOrder = function (s, type, target, troopers, droids) {
    const def = G.Actions.defs[type];
    const o = { type: type, target: target || null, troopers: troopers || 0, droids: droids || 0, unitIds: [] };
    if (!def.noSquad) {
      const cfg = G.CONFIG.actions[type];
      if (!cfg.droids) o.droids = 0;
      o.unitIds = G.Units.pickSquad(s, Game.freeUnits(s), o.troopers, o.droids, def.prefer);
    }
    return o;
  };

  // null — всё в порядке, иначе текст причины
  Game.validateOrder = function (s, o) {
    const def = G.Actions.defs[o.type];
    if (!def) return 'Неизвестный приказ.';
    if (s.pending || s.over) return 'Сейчас нельзя отдавать приказы.';
    if (Game.ordersLeft(s) <= 0) return 'На сегодня приказов больше нет: ' + G.CONFIG.orders.perDay + ' в день.';
    if (def.targets) {
      const t = def.targets(s);
      if (!o.target || t.indexOf(o.target) < 0) return 'Цель недоступна.';
      if (s.orders.some((x) => x.type === o.type && x.target === o.target)) return 'Такой приказ уже отдан.';
    }
    if (!def.noSquad) {
      const cfg = G.CONFIG.actions[o.type];
      if (o.troopers + o.droids < cfg.min) return 'Нужно не меньше ' + U.pl(cfg.min, U.FORMS.fighter) + '.';
      if (o.troopers + o.droids > cfg.max) return 'Не больше ' + U.pl(cfg.max, U.FORMS.fighter) + '.';
      if (o.unitIds.length < o.troopers + o.droids) return 'Не хватает свободных бойцов.';
    }
    if (def.validate) return def.validate(s, o);
    return null;
  };

  Game.addOrder = function (s, o) {
    const err = Game.validateOrder(s, o);
    if (err) return err;
    s.orders.push(o);
    return null;
  };

  Game.removeOrder = function (s, idx) {
    if (s.pending || s.phase !== 'orders') return;
    s.orders.splice(idx, 1);
  };

  Game.preview = function (s, o) {
    const def = G.Actions.defs[o.type];
    try { return def.preview ? def.preview(s, o) : ''; } catch (e) { return ''; }
  };

  // ---------- ХОД ----------
  Game.endDay = function (s) {
    if (s.pending || s.over || s.phase !== 'orders') return;
    s.daySnapshot = {
      res: U.clone(s.res),
      people: G.Units.people(s).length,
      droids: G.Units.droids(s).length,
    };
    s.queue = s.orders.map((o, i) => ({ step: 'order', idx: i }));
    if (G.Events) G.Events.planDay(s, Game.rng(s));
    s.queue.push({ step: 'evening' }, { step: 'night' }, { step: 'dawn' });
    s.phase = 'resolving';
    Game.run(s);
  };

  Game.run = function (s) {
    const rng = Game.rng(s);
    while (!s.pending && !s.over && s.queue.length) {
      const step = s.queue.shift();
      Game.process(s, step, rng);
      Game.checkOver(s);
    }
    if (!s.pending && !s.queue.length && s.phase === 'resolving' && !s.over) Game.finishDay(s, rng);
    if (s.over && s.phase !== 'over') {
      s.phase = 'over';
      Game.finishDay(s, rng, true);
    }
  };

  Game.process = function (s, step, rng) {
    switch (step.step) {
      case 'order': {
        const o = s.orders[step.idx];
        const def = G.Actions.defs[o.type];
        const squad = (o.unitIds || []).map((id) => G.Units.byId(s, id)).filter((u) => u && G.Units.isAlive(u));
        if (!def.noSquad && !squad.length) {
          Game.say(s, 'Приказ «' + G.TEXT.actions[o.type].name + '» не выполнен: некого отправить.', 'bad');
          return;
        }
        for (const u of squad) u.missions++;
        def.resolve(s, o, rng, squad);
        return;
      }
      case 'evening': G.Day.evening(s, rng); return;
      case 'night': G.Day.night(s, rng); return;
      case 'dawn': G.Day.dawn(s, rng); return;
      default:
        if (G.Events && step.step === 'event') { G.Events.trigger(s, rng, step.id, step.ctx); return; }
    }
  };

  Game.finishDay = function (s, rng, final) {
    const snap = s.daySnapshot || { res: s.res, people: 0, droids: 0 };
    const delta = {};
    for (const k in s.res) delta[k] = s.res[k] - snap.res[k];
    delta.people = G.Units.people(s).length - snap.people;
    delta.droids = G.Units.droids(s).length - snap.droids;
    s.lastReport = {
      day: s.day,
      title: 'Итоги дня ' + s.day,
      lines: s.report.lines,
      delta: delta,
    };
    if (final) return;
    s.day++;
    s.orders = [];
    s.report = { day: s.day, lines: [] };
    s.lastReport.morning = rng.pick(G.TEXT.morning);
    s.phase = 'orders';
  };

  Game.checkOver = function (s) {
    if (s.over) return;
    if (!G.Units.alive(s).length) {
      s.over = { type: 'defeat', reason: 'dead', day: s.day };
    } else if (!G.Units.people(s).length) {
      s.over = { type: 'defeat', reason: 'dead', day: s.day };
    } else if (s.res.discipline <= 0) {
      s.over = { type: 'defeat', reason: 'mutiny', day: s.day };
    }
    if (s.over) Game.chron(s, s.day, G.TEXT.endings[s.over.reason].title, 'bad');
  };

  // ---------- ОТВЕТ НА ОЖИДАЮЩЕЕ ВЗАИМОДЕЙСТВИЕ ----------
  Game.act = function (s, payload) {
    const p = s.pending;
    if (!p) return;
    if (p.kind === 'trade') {
      if (payload.action === 'buy') G.Trade.buy(s, payload.good, payload.n);
      else if (payload.action === 'sell') G.Trade.sell(s, payload.good, payload.n);
      else if (payload.action === 'close') { G.Trade.close(s); Game.run(s); }
      return;
    }
    if (p.kind === 'event' && G.Events) {
      G.Events.choose(s, Game.rng(s), payload.choice);
      if (!s.pending) Game.run(s);
      return;
    }
    if (G.BattleFlow && (p.kind === 'battle' || p.kind === 'battleResult')) {
      G.BattleFlow.act(s, payload);
      if (!s.pending) Game.run(s);
    }
  };

  // Смена пайка
  Game.setRations = function (s, r) {
    if (G.CONFIG.rations[r]) s.rations = r;
  };

  G.Game = Game;
})(globalThis.G = globalThis.G || {});
