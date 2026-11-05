/*
 * Движок событий. Само событие описано в js/content/events.ru.js (текст и варианты),
 * числа — в CONFIG.events.list. Событие показывается как окно с выбором (s.pending.kind = 'event'),
 * после выбора — итог и кнопка «Продолжить».
 */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;

  const Events = { defs: {}, after: {} };

  Events.def = function (id, d) { d.id = id; Events.defs[id] = d; };
  Events.cfg = (id) => G.CONFIG.events.list[id];

  function log(s) { return (s.eventLog = s.eventLog || {}); }

  function eligible(s, d, when) {
    const c = Events.cfg(d.id);
    if (!c) return false;
    const ok = c.when === when || (c.when === 'any' && (when === 'day' || when === 'night'));
    if (!ok) return false;
    if (c.minDay && s.day < c.minDay) return false;
    const l = log(s)[d.id];
    if (l) {
      if (c.max && l.count >= c.max) return false;
      if (c.cooldown && s.day - l.last < c.cooldown) return false;
    }
    if (d.cond && !d.cond(s)) return false;
    return true;
  }

  Events.weight = function (s, d) {
    let w = Events.cfg(d.id).weight || 0;
    if (d.weightMod) w *= d.weightMod(s);
    return w;
  };

  Events.roll = function (s, rng, when) {
    const list = Object.values(Events.defs).filter((d) => eligible(s, d, when));
    const d = rng.weighted(list, (x) => Events.weight(s, x));
    return d ? d.id : null;
  };

  // Вызывается при завершении дня: таймеры, события по дате, случайное дневное событие
  Events.planDay = function (s, rng) {
    s.timers = s.timers || [];
    const due = s.timers.filter((t) => t.day <= s.day);
    s.timers = s.timers.filter((t) => t.day > s.day);
    for (const t of due) s.queue.push({ step: 'event', id: t.id, ctx: t.ctx || {} });
    for (const id in G.CONFIG.events.list) {
      const c = Events.cfg(id);
      if (c.when === 'fixed' && c.day === s.day && Events.defs[id] && !log(s)[id]) s.queue.push({ step: 'event', id: id, ctx: {} });
    }
    const p = G.CONFIG.events.dayChance * G.Res.diff(s).events;
    if (rng.chance(p)) {
      const id = Events.roll(s, rng, 'day');
      if (id) s.queue.push({ step: 'event', id: id, ctx: {} });
    }
  };

  // Ночное событие (после проверки налёта)
  Events.rollNight = function (s, rng) {
    const p = G.CONFIG.events.nightChance * G.Res.diff(s).events;
    if (!rng.chance(p)) return;
    const id = Events.roll(s, rng, 'night');
    if (id) Events.queueNow(s, id, {});
  };

  // Поставить событие следующим шагом очереди
  Events.queueNow = function (s, id, ctx) {
    s.queue.unshift({ step: 'event', id: id, ctx: ctx || {} });
  };

  Events.schedule = function (s, id, inDays, ctx) {
    s.timers = s.timers || [];
    s.timers.push({ day: s.day + inDays, id: id, ctx: ctx || {} });
  };

  function makePending(s, rng, id, ctx) {
    const d = Events.defs[id];
    ctx = ctx || {};
    if (d.prepare) d.prepare(s, ctx, rng);
    const l = log(s);
    l[id] = { last: s.day, count: ((l[id] && l[id].count) || 0) + 1 };
    return {
      kind: 'event',
      id: id,
      ctx: ctx,
      title: typeof d.title === 'function' ? d.title(s, ctx) : d.title,
      text: d.text(s, ctx, rng),
      result: null,
      next: null,
    };
  }

  Events.trigger = function (s, rng, id, ctx) {
    const d = Events.defs[id];
    if (!d) return;
    ctx = ctx || {};
    // Событие могло утратить смысл (например, условие уже не выполняется)
    if (d.valid && !d.valid(s, ctx)) return;
    s.pending = makePending(s, rng, id, ctx);
  };

  // Варианты выбора с учётом условий
  Events.options = function (s, p) {
    const d = Events.defs[p.id];
    const list = typeof d.choices === 'function' ? d.choices(s, p.ctx) : d.choices;
    return list.filter((c) => !c.show || c.show(s, p.ctx)).map((c) => ({
      id: c.id,
      label: typeof c.label === 'function' ? c.label(s, p.ctx) : c.label,
      hint: typeof c.hint === 'function' ? c.hint(s, p.ctx) : c.hint || '',
      blocked: c.req ? c.req(s, p.ctx) : null,
    }));
  };

  Events.choose = function (s, rng, choiceId) {
    const p = s.pending;
    if (!p || p.kind !== 'event') return;
    if (p.result != null) {
      // «Продолжить»: переходим к следующему окну (торговля, бой, продолжение цепочки) или закрываем
      s.pending = p.next || null;
      if (s.pending && s.pending.kind === 'chain') s.pending = makePending(s, rng, s.pending.id, s.pending.ctx);
      return;
    }
    const d = Events.defs[p.id];
    const list = typeof d.choices === 'function' ? d.choices(s, p.ctx) : d.choices;
    const ch = list.find((c) => c.id === choiceId);
    if (!ch || (ch.show && !ch.show(s, p.ctx))) return;
    if (ch.req && ch.req(s, p.ctx)) return;
    E._p = p;
    const res = ch.run(s, p.ctx, rng, E) || '';
    E._p = null;
    p.result = res;
    p.choice = typeof ch.label === 'function' ? ch.label(s, p.ctx) : ch.label;
    G.Game.say(s, '«' + p.title + '». ' + res, 'event');
  };

  // ================= ПОМОЩНИКИ ДЛЯ ОПИСАНИЙ СОБЫТИЙ =================
  const E = {
    _p: null,

    // Изменить ресурсы, вернуть текст: «вода −30, металл +20»
    res(s, delta) {
      const parts = [];
      for (const k of ['water', 'scrap', 'energy', 'credits', 'discipline']) {
        if (!delta[k]) continue;
        const real = G.Res.add(s, k, delta[k]);
        if (real) parts.push(G.TEXT.res[k].name.toLowerCase() + ' ' + U.signed(real));
      }
      return parts.join(', ');
    },
    item(s, key, n) {
      G.Res.addItem(s, key, n);
      return G.TEXT.items[key].name + ' ' + (n > 0 ? '+' : '') + n;
    },
    disc(s, d) { return E.res(s, { discipline: d }); },
    rel(s, f, d) {
      s.relations[f] = U.clamp(s.relations[f] + d, -100, 100);
      return 'отношения с «' + G.TEXT.factions[f].name + '» ' + U.signed(d);
    },
    // Годные к службе люди (не дроиды)
    fitPeople(s) { return G.Units.people(s).filter((u) => G.Units.isFit(s, u)); },
    // Ранить n случайных бойцов
    hurt(s, rng, n, hp, cause, pool) {
      const cands = rng.shuffle((pool || E.fitPeople(s)).filter(G.Units.isAlive).slice());
      const hit = [];
      for (let i = 0; i < n && i < cands.length; i++) {
        G.Units.damage(s, cands[i], U.rollRange(rng, hp), cause);
        hit.push(cands[i]);
      }
      return hit;
    },
    kill(s, rng, n, cause, pool) {
      const cands = rng.shuffle((pool || E.fitPeople(s)).filter(G.Units.isAlive).slice());
      const dead = [];
      for (let i = 0; i < n && i < cands.length; i++) {
        G.Units.kill(s, cands[i], cause);
        dead.push(cands[i]);
      }
      return dead;
    },
    recruit(s, rng, n, opts) {
      const list = [];
      for (let i = 0; i < n; i++) {
        const xp = opts.xp ? U.rollRange(rng, opts.xp) : rng.int(0, 60);
        list.push(G.Units.createTrooper(s, rng, { xp: xp, health: opts.hp ? U.rollRange(rng, opts.hp) : 100, origin: opts.origin || 'capsule' }));
      }
      return list;
    },
    names(units) { return units.map((u) => G.Units.title(u)).join(', '); },
    schedule(s, id, days, ctx) { Events.schedule(s, id, days, ctx); },
    reveal(s, id) {
      const r = s.regions[id];
      if (r.known) return '';
      r.known = true;
      return 'на карте отмечено: ' + G.Regions.name(id);
    },
    // После окна события открыть другое окно (торговлю) или продолжение цепочки
    next(pending) { if (E._p) E._p.next = pending; },
    chain(id, ctx) { if (E._p) E._p.next = { kind: 'chain', id: id, ctx: ctx || {} }; },
    // Бой. spec: { enemy, strength, squad: 'camp' | число, title, after, ctx }
    fight(s, rng, spec) {
      if (G.BattleFlow && G.BattleFlow.fromEvent) return G.BattleFlow.fromEvent(s, rng, spec, E);
      return Events.abstractFight(s, rng, spec);
    },
  };
  Events.E = E;

  // Упрощённый расчёт стычки (до появления автобоя или при быстром расчёте)
  Events.abstractFight = function (s, rng, spec) {
    let squad;
    const fit = G.Units.alive(s).filter((u) => G.Units.isFit(s, u));
    if (spec.squad === 'camp') squad = fit.slice(0, Math.min(fit.length, 18));
    else {
      const ids = G.Units.pickSquad(s, fit, spec.squad || 8, 0, 'fighters');
      squad = ids.map((id) => G.Units.byId(s, id));
    }
    if (!squad.length) {
      const t = Events.after[spec.after] ? Events.after[spec.after](s, rng, false, spec.ctx || {}, E) : '';
      return 'Сражаться некому. ' + t;
    }
    const strength = spec.strength * G.Res.diff(s).enemy * (1 + s.day * 0.01);
    const res = G.Actions.skirmish(s, rng, squad, strength, spec.title || 'бой');
    if (res.won) G.Res.discipline(s, G.CONFIG.discipline.victory);
    else G.Res.discipline(s, G.CONFIG.discipline.defeat);
    let text = res.won ? 'Бой выигран.' : 'Бой проигран.';
    if (res.killed.length) text += ' Погибли: ' + E.names(res.killed) + '.';
    if (res.wounded.length) text += ' Ранены: ' + U.pl(res.wounded.length, F.fighter) + '.';
    if (!res.killed.length && !res.wounded.length) text += ' Без потерь.';
    if (spec.after && Events.after[spec.after]) text += ' ' + Events.after[spec.after](s, rng, res.won, spec.ctx || {}, E);
    return text;
  };

  G.Events = Events;
})(globalThis.G = globalThis.G || {});
