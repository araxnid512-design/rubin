/* Приказы генерала: проверка, прогноз и исполнение. */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;

  const Actions = {};
  Actions.list = ['recon', 'water', 'salvage', 'repair', 'engineer', 'guard', 'drill', 'trade', 'diplomacy', 'attack', 'speech', 'reward'];

  const A = () => G.CONFIG.actions;
  const say = (s, t, tone) => G.Game.say(s, t, tone);

  // Суммарная рабочая сила отряда с убывающей отдачей сверх предела
  function workforce(s, units, opts) {
    let e = 0;
    for (const u of units) {
      let x = G.Units.efficiency(s, u);
      if (u.kind === 'droid') x *= opts.droidMult || 1;
      if (opts.spec && u.spec && opts.spec[u.spec]) x *= opts.spec[u.spec];
      e += x;
    }
    if (opts.cap && e > opts.cap) e = opts.cap + (e - opts.cap) * (opts.overCapEff || 0);
    return e * G.Day.disciplineFactor(s);
  }

  function regionOk(s, id) { return s.regions[id] && s.regions[id].known; }

  // ---------- Засады и стычки (упрощённый расчёт) ----------
  Actions.ambushChance = function (s, regionId, squadSize, mult, squad) {
    const a = A().recon;
    const cfg = G.Regions.cfg(regionId);
    let p = (a.ambushBase + a.ambushPerDanger * cfg.danger) * G.Res.diff(s).danger * (mult || 1);
    if (squadSize < a.smallSquad) p *= a.smallSquadRisk;
    if (squad && squad.some((u) => u.spec === 'scout')) p *= G.CONFIG.specs.scout.ambushMult;
    if (s.sections.sensors.level > 0) p *= 0.85;
    if (G.Territory && G.Territory.owned(s, regionId)) p *= G.CONFIG.territory.ambushMult;
    return Math.min(0.6, p);
  };

  Actions.enemyStrengthFor = function (s, rng, regionId) {
    const sk = G.CONFIG.skirmish;
    const cfg = G.Regions.cfg(regionId);
    return Math.max(2, cfg.danger * sk.enemyStrengthPerDanger * rng.range(sk.enemyStrengthNoise[0], sk.enemyStrengthNoise[1]) *
      G.Res.diff(s).enemy * (1 + s.day * 0.01));
  };

  // Стычка: squad — массив бойцов, enemy — сила противника. Возвращает { won, killed, wounded }
  Actions.skirmish = function (s, rng, squad, enemy, enemyName) {
    const sk = G.CONFIG.skirmish;
    let mine = U.sum(squad, (u) => G.Units.combatValue(s, u)) * G.Day.disciplineFactor(s);
    const won = mine * rng.range(0.8, 1.25) > enemy * rng.range(0.8, 1.25);
    const ratio = U.clamp(enemy / Math.max(1, mine), 0.15, 3);
    const lossMult = won ? 1 : 2;
    const living = squad.slice();
    rng.shuffle(living);
    let nKill = Math.round(squad.length * sk.killRate * ratio * lossMult * rng.range(0.5, 1.5));
    let nWound = Math.round(squad.length * sk.woundRate * ratio * lossMult * rng.range(0.5, 1.5));
    nKill = Math.min(nKill, living.length);
    const killed = [], wounded = [];
    for (let i = 0; i < nKill; i++) {
      const u = living.shift();
      G.Units.kill(s, u, 'погиб в бою: ' + enemyName);
      killed.push(u);
    }
    nWound = Math.min(nWound, living.length);
    for (let i = 0; i < nWound; i++) {
      const u = living.shift();
      if (G.Units.damage(s, u, rng.int(25, 55), 'погиб от ран: ' + enemyName)) killed.push(u);
      else wounded.push(u);
    }
    s.stats.battles++;
    if (won) {
      s.stats.victories++;
      s.stats.kills += Math.max(1, Math.round(enemy / 2));
      for (const u of squad) if (G.Units.isAlive(u)) G.Units.addXp(s, u, sk.winXp);
    } else s.stats.defeats++;
    return { won, killed, wounded };
  };

  function lossesText(res) {
    const parts = [];
    if (res.killed.length) parts.push('погибли: ' + res.killed.map((u) => G.Units.title(u)).join(', '));
    if (res.wounded.length) parts.push('ранены: ' + U.pl(res.wounded.length, F.fighter));
    return parts.length ? ' Потери — ' + parts.join('; ') + '.' : ' Обошлось без потерь.';
  }

  function maybeAmbush(s, rng, regionId, squad, mult) {
    const p = Actions.ambushChance(s, regionId, squad.length, mult, squad);
    if (!rng.chance(p)) return false;
    if (G.BattleFlow && squad.some(G.Units.isAlive)) {
      // Автобой: засада разыгрывается отдельным боем сразу после приказа
      say(s, 'На обратном пути из района «' + G.Regions.name(regionId) + '» отряд попал в засаду!', 'battle');
      G.BattleFlow.ambush(s, rng, regionId, squad);
      return false;
    }
    const enemy = Actions.enemyStrengthFor(s, rng, regionId);
    const res = Actions.skirmish(s, rng, squad, enemy, 'засада');
    const head = 'Засада в районе «' + G.Regions.name(regionId) + '»! ';
    if (res.won) {
      G.Res.discipline(s, 1);
      say(s, head + 'Отряд принял бой и отбросил нападавших.' + lossesText(res), 'battle');
    } else {
      G.Res.discipline(s, -3);
      say(s, head + 'Отряд с трудом вырвался из-под огня и отступил.' + lossesText(res), 'bad');
    }
    return true;
  }

  // ================= ОПИСАНИЯ ПРИКАЗОВ =================
  const defs = {};

  // ---------- Разведка ----------
  defs.recon = {
    prefer: 'scouts',
    targets: (s) => G.Regions.known(s).filter((id) => id !== 'crash'),
    preview(s, o) {
      const a = A().recon;
      const gain = a.exploreBase + a.explorePerTrooper * Math.min(o.troopers, a.effCap);
      const p = Actions.ambushChance(s, o.target, o.troopers);
      return 'Разведка района: примерно +' + Math.round(gain * G.Day.disciplineFactor(s)) + '%. Риск засады: ' + riskWord(p) + '.';
    },
    resolve(s, o, rng, squad) {
      const a = A().recon;
      const r = s.regions[o.target];
      const name = G.Regions.name(o.target);
      if (r.visits === 0) say(s, '«' + name + '». ' + G.TEXT.regions[o.target].desc, 'info');
      r.visits++;
      if (maybeAmbush(s, rng, o.target, squad, 1) && squad.every((u) => !G.Units.isAlive(u))) return;
      const alive = squad.filter(G.Units.isAlive);
      const eff = workforce(s, alive, { cap: a.effCap, overCapEff: 0.2, spec: { scout: G.CONFIG.specs.scout.reconMult, sand: 1 + G.CONFIG.specs.sand.fieldBonus } });
      const bonus = s.flags.dewback ? 1 + G.CONFIG.events.list.dewback.reconBonus : 1;
      const gained = G.Regions.explore(s, o.target, (a.exploreBase + a.explorePerTrooper * eff) * bonus * rng.range(0.8, 1.2));
      if (gained > 0) say(s, rng.pick(G.TEXT.results.recon) + ' Район «' + name + '» разведан на ' + r.explored + '%.', 'info');
      else say(s, 'Район «' + name + '» уже изучен вдоль и поперёк.', 'info');
      const cfg = G.Regions.cfg(o.target);
      if (cfg.kind === 'hostile' && r.explored >= 30) {
        say(s, 'Оценка сил противника: ' + strengthWord(s, cfg.strength * G.Res.diff(s).enemy) + '.', 'info');
      }
      for (const u of alive) G.Units.addXp(s, u, a.xp);
    },
  };

  // ---------- Добыча провизии (сухари) ----------
  defs.water = {
    prefer: 'workers',
    targets: (s) => G.Regions.known(s).filter((id) => {
      const c = G.Regions.cfg(id);
      return c.water > 0 && s.regions[id].explored >= A().water.needExplored;
    }),
    preview(s, o) {
      const a = A().water;
      const c = G.Regions.cfg(o.target);
      const est = Math.round(a.perWorker * Math.min(o.troopers, a.effCap) * a.richness[c.water] * G.Day.disciplineFactor(s));
      const left = s.regions[o.target].water;
      return 'Ожидается около ' + Math.min(est, left) + ' сухарей (в районе осталось примерно ' + left + '). Риск засады: ' +
        riskWord(Actions.ambushChance(s, o.target, o.troopers, a.ambushMult)) + '.';
    },
    resolve(s, o, rng, squad) {
      const a = A().water;
      const r = s.regions[o.target];
      const c = G.Regions.cfg(o.target);
      r.visits++;
      maybeAmbush(s, rng, o.target, squad, a.ambushMult);
      const alive = squad.filter(G.Units.isAlive);
      if (!alive.length) return;
      const eff = workforce(s, alive, { cap: a.effCap, overCapEff: a.overCapEff, spec: { sand: 1 + G.CONFIG.specs.sand.fieldBonus } });
      let amount = Math.round(a.perWorker * eff * a.richness[c.water] * rng.range(a.noise[0], a.noise[1]));
      amount = Math.min(amount, r.water);
      r.water -= amount;
      G.Res.add(s, 'water', amount);
      s.stats.waterFound += amount;
      const good = amount >= alive.length * a.perWorker * 0.5;
      say(s, rng.pick(good ? G.TEXT.results.water.good : G.TEXT.results.water.poor) +
        ' Добыто ' + amount + ' сухарей («' + G.Regions.name(o.target) + '»).', good ? 'good' : 'info');
      for (const u of alive) G.Units.addXp(s, u, a.xp);
    },
  };

  // ---------- Разбор обломков ----------
  defs.salvage = {
    prefer: 'workers',
    targets: (s) => G.Regions.known(s).filter((id) => {
      const c = G.Regions.cfg(id);
      return c.scrap > 0 && (id === 'crash' || s.regions[id].explored >= 20);
    }),
    preview(s, o) {
      const a = A().salvage;
      const c = G.Regions.cfg(o.target);
      const units = (o.unitIds || []).map((id) => G.Units.byId(s, id)).filter(Boolean);
      const eff = units.length ? workforce(s, units, { droidMult: a.droidMult, cap: a.effCap, overCapEff: a.overCapEff }) : o.troopers;
      const est = Math.round(a.perWorker * eff * a.richness[c.scrap]);
      return 'Ожидается около ' + Math.min(est, s.regions[o.target].scrap) + ' ед. металла (осталось ~' + s.regions[o.target].scrap + ').';
    },
    resolve(s, o, rng, squad) {
      const a = A().salvage;
      const r = s.regions[o.target];
      const c = G.Regions.cfg(o.target);
      if (o.target !== 'crash') maybeAmbush(s, rng, o.target, squad, a.ambushMult);
      const alive = squad.filter(G.Units.isAlive);
      if (!alive.length) return;
      const eff = workforce(s, alive, { droidMult: a.droidMult, cap: a.effCap, overCapEff: a.overCapEff });
      let amount = Math.round(a.perWorker * eff * a.richness[c.scrap] * rng.range(a.noise[0], a.noise[1]));
      amount = Math.min(amount, r.scrap);
      r.scrap -= amount;
      G.Res.add(s, 'scrap', amount);
      s.stats.scrapFound += amount;
      if (o.target === 'crash') s.salvaged += amount;
      r.salvaged = (r.salvaged || 0) + amount;
      Actions.milestones(s, rng, o.target);
      if (amount <= 0) {
        say(s, 'Здесь больше нечего снимать: «' + G.Regions.name(o.target) + '» разобран до основания.', 'info');
        return;
      }
      say(s, rng.pick(G.TEXT.results.salvage) + ' Получено ' + amount + ' ед. металлолома.', 'good');
      // Травмы на разборе
      for (const u of alive) {
        if (u.kind !== 'droid' && rng.chance(a.injuryChance)) {
          G.Units.damage(s, u, rng.int(20, 45), 'несчастный случай на разборе обломков');
          say(s, U.cap(G.Units.title(u)) + ' травмирован обрушившейся переборкой.', 'bad');
        }
      }
      // Находки
      if (rng.chance(a.findChance)) Actions.rollFind(s, rng);
      for (const u of alive) G.Units.addXp(s, u, a.xp);
    },
  };

  // Гарантированные находки по мере разбора
  Actions.milestones = function (s, rng, regionId) {
    const done = (s.flags.milestones = s.flags.milestones || {});
    for (const m of G.CONFIG.milestones || []) {
      if (m.region !== regionId || done[m.id] || (s.regions[regionId].salvaged || 0) < m.salvaged) continue;
      done[m.id] = true;
      if (m.kit) {
        G.Camp.ensure(s).kits[m.kit] = (s.camp.kits[m.kit] || 0) + 1;
        say(s, G.TEXT.milestones[m.id], 'good');
      } else if (m.vehicle && G.Progress) {
        const v = G.Progress.addVehicle(s, rng, m.vehicle, false);
        say(s, U.fill(G.TEXT.milestones[m.id], { name: G.Progress.vehicleName(v) }), 'good');
      } else {
        for (const k in m.items || {}) G.Res.addItem(s, k, m.items[k]);
        say(s, G.TEXT.milestones[m.id], 'good');
      }
    }
  };

  Actions.rollFind = function (s, rng) {
    const list = G.CONFIG.finds.filter((f) => (!f.minSalvaged || s.salvaged >= f.minSalvaged) &&
      (!f.maxItem || (s.flags['found_' + f.id] || 0) < f.maxItem) &&
      (!f.max || !f.vehicle || G.Progress.vehiclesOf(s, f.vehicle).length < f.max));
    const f = rng.weighted(list, (x) => x.weight);
    if (!f) return;
    if (f.kit) {
      G.Camp.ensure(s).kits[f.kit] = (s.camp.kits[f.kit] || 0) + 1;
      say(s, G.TEXT.finds[f.id], 'good');
      return;
    }
    if (f.vehicle) {
      const v = G.Progress.addVehicle(s, rng, f.vehicle, false);
      say(s, U.fill(G.TEXT.finds[f.id], { name: G.Progress.vehicleName(v) }), 'good');
      return;
    }
    let n = 0;
    if (f.maxItem) s.flags['found_' + f.id] = (s.flags['found_' + f.id] || 0) + 1;
    if (f.res) for (const k in f.res) { n = U.rollRange(rng, f.res[k]); G.Res.add(s, k, n); }
    if (f.items) for (const k in f.items) { n = U.rollRange(rng, f.items[k]); G.Res.addItem(s, k, n); }
    say(s, U.fill(G.TEXT.finds[f.id], { n: n, packs: U.plural(n, F.pack) }), 'good');
  };

  // ---------- Ремонт отсека ----------
  defs.repair = {
    prefer: 'workers',
    targets: (s) => Object.keys(s.sections).filter((id) => G.Base.nextCost(s, id)),
    targetName: (id) => G.TEXT.sections[id].name,
    validate(s, o) {
      const c = G.Base.canRepair(s, o.target);
      return c.ok ? null : c.reason;
    },
    preview(s, o) {
      const sec = s.sections[o.target];
      const cost = G.Base.nextCost(s, o.target);
      const units = (o.unitIds || []).map((id) => G.Units.byId(s, id)).filter(Boolean);
      const pts = units.length ? workforce(s, units, { droidMult: A().repair.droidMult }) : o.troopers;
      const left = cost.work - sec.progress;
      const days = Math.max(1, Math.ceil(left / Math.max(0.1, pts)));
      return (sec.paid ? 'Материалы уже заложены. ' : 'Будут списаны: ' + G.Res.costText(cost) + '. ') +
        'Осталось ' + Math.ceil(left) + ' чел.-дней работ — при таком отряде около ' + U.pl(days, F.day) + '.';
    },
    resolve(s, o, rng, squad) {
      const alive = squad.filter(G.Units.isAlive);
      const pts = workforce(s, alive, { droidMult: A().repair.droidMult });
      const text = G.Base.work(s, o.target, pts);
      const done = text.indexOf('завершён') >= 0;
      say(s, text, done ? 'good' : 'info');
      for (const u of alive) G.Units.addXp(s, u, A().repair.xp);
    },
  };

  // ---------- Инженерные работы: укрепления, техника, дроиды ----------
  defs.engineer = {
    prefer: 'workers',
    targets: (s) => G.Progress.projectTargets(s),
    validate(s, o) { return G.Progress.projectLock(s, o.target); },
    preview(s, o) {
      const kind = G.Progress.projectKind(s, o.target);
      const c = G.CONFIG.projects[kind];
      const st = G.Progress.projectState(s, o.target);
      const units = (o.unitIds || []).map((id) => G.Units.byId(s, id)).filter(Boolean);
      const pts = units.length ? workforce(s, units, { droidMult: A().repair.droidMult }) : o.troopers;
      const left = c.work - st.progress;
      const days = Math.max(1, Math.ceil(left / Math.max(0.1, pts)));
      return (st.paid ? 'Материалы уже заложены. ' : 'Будут списаны: ' + G.Res.costText(c.cost) + '. ') +
        'Осталось ' + Math.ceil(left) + ' чел.-дней — при таком отряде около ' + U.pl(days, F.day) + '.';
    },
    resolve(s, o, rng, squad) {
      const alive = squad.filter(G.Units.isAlive);
      const pts = workforce(s, alive, { droidMult: A().repair.droidMult });
      const text = G.Progress.work(s, rng, o.target, pts);
      say(s, text, /готов|в строю|собран|отремонтированы|восстановлен/.test(text) ? 'good' : 'info');
      for (const u of alive) G.Units.addXp(s, u, A().repair.xp);
    },
  };

  // ---------- Оборона ----------
  defs.guard = {
    prefer: 'fighters',
    targets: null,
    preview(s, o) {
      const p = G.Day.raidChance(s, (s.guards || 0) + o.troopers + (o.droids || 0));
      return 'Шанс ночного налёта снизится примерно до ' + Math.round(p * 100) + '%.';
    },
    resolve(s, o, rng, squad) {
      const n = squad.filter(G.Units.isAlive).length;
      s.guards += n;
      say(s, 'На ночь выставлены усиленные посты: ' + U.pl(n, F.fighter) + ' на периметре.', 'info');
    },
  };

  // ---------- Торговля ----------
  defs.trade = {
    prefer: 'fighters',
    targets(s) {
      const list = G.Regions.known(s).filter((id) => G.Regions.canTrade(s, id));
      if (s.visitors.jawa > 0 && !s.flags.jawaHostile) list.unshift('jawa');
      return list;
    },
    targetName: (id) => (id === 'jawa' ? 'Песчаный краулер джав' : G.Regions.name(id)),
    preview(s, o) {
      if (o.target === 'jawa') return 'Джавы стоят лагерем неподалёку. Откроется окно торговли.';
      return 'Откроется окно торговли. Риск в пути: ' + riskWord(Actions.ambushChance(s, o.target, o.troopers, 0.5)) + '.';
    },
    resolve(s, o, rng, squad) {
      if (o.target !== 'jawa') {
        maybeAmbush(s, rng, o.target, squad, 0.5);
        if (!squad.some(G.Units.isAlive)) return;
      }
      const partner = o.target === 'jawa' ? 'jawa' : G.Regions.cfg(o.target).trade;
      G.Trade.open(s, partner);
      for (const u of squad) if (G.Units.isAlive(u)) G.Units.addXp(s, u, A().trade.xp);
    },
  };

  // ---------- Дипломатия ----------
  defs.diplomacy = {
    prefer: 'scouts',
    targets(s) {
      return G.Factions.list.filter((f) => {
        if (!G.CONFIG.diplomacy[f] || s.flags['hostile_' + f]) return false;
        if (f === 'jawa' && s.flags.jawaHostile) return false;
        if (f === 'deserters' && s.regions.outpost.cleared) return false;
        return G.Factions.contact(s, f) || (f === 'jawa' && s.visitors.jawa > 0);
      });
    },
    targetName: (id) => G.TEXT.factions[id].name,
    validate(s, o) {
      const cost = G.CONFIG.diplomacy[o.target].cost;
      return G.Res.canPay(s, cost) ? null : 'Нужно: ' + G.Res.costText(cost) + '.';
    },
    preview(s, o) {
      const D = G.CONFIG.diplomacy[o.target];
      return 'Дар: ' + G.Res.costText(D.cost) + '. Сейчас отношения: ' + s.relations[o.target] + '.';
    },
    resolve(s, o, rng, squad) {
      const D = G.CONFIG.diplomacy[o.target];
      if (!G.Res.pay(s, D.cost)) { say(s, 'Посольство не состоялось: нечего дарить.', 'bad'); return; }
      const T = G.TEXT.diplomacy[o.target];
      if (D.failChance && rng.chance(D.failChance)) {
        s.relations[o.target] = U.clamp(s.relations[o.target] - D.failLoss, -100, 100);
        say(s, rng.pick(T.fail), 'bad');
        return;
      }
      const gain = rng.int(D.gain[0], D.gain[1]) + Math.min(3, squad.length - 1);
      s.relations[o.target] = U.clamp(s.relations[o.target] + gain, -100, 100);
      say(s, rng.pick(T.ok) + ' Отношения: ' + s.relations[o.target] + ' (' + U.signed(gain) + ').', 'good');
      for (const u of squad) if (G.Units.isAlive(u)) G.Units.addXp(s, u, A().diplomacy.xp);
    },
  };

  // ---------- Атака ----------
  defs.attack = {
    prefer: 'fighters',
    targets: (s) => G.Regions.known(s).filter((id) => G.Territory ? G.Territory.canAttack(s, id) : (G.Regions.cfg(id).kind === 'hostile' || G.Regions.cfg(id).attackable) && !s.regions[id].cleared),
    preview(s, o) {
      const sp = G.Territory.attackSpec(s, o.target);
      const e = sp.strength * G.Res.diff(s).enemy;
      const r = s.regions[o.target];
      const est = r.explored >= 30 ? 'Силы врага: ' + strengthWord(s, e) + '.' : 'Силы врага неизвестны — сначала стоит провести разведку.';
      const what = sp.kind === 'wild' ? ' Зачистка: после победы место станет нашим — засад меньше, каждый день доход.'
        : sp.kind === 'town' ? ' Захват поселения: «' + G.TEXT.factions[sp.faction].name + '» станут врагами, зато поселение будет платить дань.'
          : ' После победы лагерь перейдёт под наш контроль.';
      return est + what;
    },
    resolve(s, o, rng, squad) {
      if (G.BattleFlow) G.BattleFlow.fromAttack(s, rng, o, squad);
      else G.Battle.fromAttack(s, rng, o, squad);
    },
  };

  // ---------- Смотр и речь ----------
  defs.speech = {
    noSquad: true,
    targets: null,
    validate(s) {
      return s.orders.some((x) => x.type === 'speech') ? 'Одной речи в день достаточно.' : null;
    },
    preview(s) {
      const a = A().speech;
      const recent = s.day - s.lastSpeechDay <= a.repeatDays;
      return recent ? 'Генерал выступал недавно — эффект будет слабее.' : 'Дисциплина вырастет на ' + a.gainMin + '–' + a.gainMax + '.';
    },
    resolve(s, o, rng) {
      const a = A().speech;
      if (s.day - s.lastSpeechDay <= a.repeatDays) s.speechStreak++;
      else s.speechStreak = 0;
      s.lastSpeechDay = s.day;
      const gain = Math.max(0, rng.int(a.gainMin, a.gainMax) - a.repeatPenalty * s.speechStreak);
      G.Res.discipline(s, gain);
      say(s, (gain > 2 ? rng.pick(G.TEXT.speech) : G.TEXT.speechTired) + ' Дисциплина ' + U.signed(gain) + '.', gain > 2 ? 'good' : 'info');
    },
  };

  // ---------- Учения ----------
  defs.drill = {
    prefer: 'fighters',
    targets: null,
    validate(s) { return s.orders.some((x) => x.type === 'drill') ? 'Плац один — учения уже назначены.' : null; },
    preview(s, o) {
      const a = A().drill;
      const xp = Math.round((a.xp[0] + a.xp[1]) / 2 + (s.sections.armory.level > 0 ? a.armoryXp : 0));
      return 'Каждый получит около ' + xp + ' опыта' + (o.troopers >= a.disciplineFrom ? ', дисциплина +' + a.discipline : '') + '. Бывают лёгкие травмы.';
    },
    resolve(s, o, rng, squad) {
      const a = A().drill;
      const alive = squad.filter(G.Units.isAlive);
      let promoted = 0, hurt = 0;
      for (const u of alive) {
        const before = G.Units.rankIndex(u);
        G.Units.addXp(s, u, rng.int(a.xp[0], a.xp[1]) + (s.sections.armory.level > 0 ? a.armoryXp : 0));
        if (G.Units.rankIndex(u) > before) promoted++;
        if (u.kind !== 'droid' && rng.chance(a.injuryChance)) { u.health = Math.max(20, u.health - rng.int(a.injury[0], a.injury[1])); hurt++; }
      }
      if (alive.length >= a.disciplineFrom) G.Res.discipline(s, a.discipline);
      say(s, rng.pick(G.TEXT.drill) + ' На плацу отработали ' + U.pl(alive.length, F.fighter) + '.' +
        (promoted ? ' Повышены в звании: ' + promoted + '.' : '') + (hurt ? ' Лёгкие травмы: ' + hurt + '.' : ''), 'info');
    },
  };

  // ---------- Награждение ----------
  defs.reward = {
    noSquad: true,
    targets: null,
    validate(s) {
      if (s.orders.some((x) => x.type === 'reward')) return 'Награждение уже назначено.';
      return s.res.credits >= A().reward.credits ? null : 'Нужно ' + A().reward.credits + ' кредитов.';
    },
    preview() {
      const a = A().reward;
      return 'Стоимость: ' + a.credits + ' кр. Дисциплина +' + a.discipline + ', лучший боец получит опыт.';
    },
    resolve(s, o, rng) {
      const a = A().reward;
      if (s.res.credits < a.credits) { say(s, 'В полковой кассе не оказалось денег на награды.', 'bad'); return; }
      G.Res.add(s, 'credits', -a.credits);
      G.Res.discipline(s, a.discipline);
      const best = G.Units.troopers(s).sort((x, y) => (y.kills * 10 + y.xp) - (x.kills * 10 + x.xp))[0];
      if (best) {
        G.Units.addXp(s, best, a.xp);
        say(s, 'Перед строем генерал вручил награду: ' + G.Units.fullTitle(best) + '. Дисциплина +' + a.discipline + '.', 'good');
      }
    },
  };

  function riskWord(p) {
    if (p < 0.05) return 'ничтожный';
    if (p < 0.12) return 'низкий';
    if (p < 0.22) return 'средний';
    if (p < 0.35) return 'высокий';
    return 'очень высокий';
  }
  function strengthWord(s, e) {
    const mine = U.sum(G.Units.alive(s).filter((u) => G.Units.isFit(s, u)), (u) => G.Units.combatValue(s, u));
    const r = e / Math.max(1, mine);
    const word = e < 12 ? 'небольшой отряд' : e < 25 ? 'крупный отряд' : e < 45 ? 'серьёзные силы' : 'целая армия';
    return word + (r < 0.3 ? ' — нам по зубам' : r < 0.6 ? ' — бой будет тяжёлым' : ' — это очень опасно');
  }
  Actions.riskWord = riskWord;

  Actions.defs = defs;
  Actions.workforce = workforce;

  // Название цели для интерфейса
  Actions.targetName = function (type, target, s) {
    const d = defs[type];
    if (!target) return '';
    if (type === 'engineer') return G.Progress.projectName(s || (G.UI && G.UI.s), target);
    if (d.targetName) return d.targetName(target);
    return G.Regions.name(target);
  };

  G.Actions = Actions;
})(globalThis.G = globalThis.G || {});
