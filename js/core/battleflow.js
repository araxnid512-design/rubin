/*
 * Связь автобоя с игрой: подготовка боя (s.pending.kind = 'battle'),
 * расчёт боя движком, применение итогов к отряду, повторы.
 */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;
  const C = () => G.CONFIG.battle;

  const BF = {};
  BF.lastRun = null; // { id, res } — кэш последнего расчёта для анимации

  BF.defaults = { tactic: 'assault', formation: 'line', orders: ['focus', 'hold'], retreatAt: 0.5 };
  BF.prefs = function (s) {
    if (!s.battlePrefs) s.battlePrefs = U.clone(BF.defaults);
    return s.battlePrefs;
  };

  // Доступен ли приказ генерала (некоторые требуют восстановленных отсеков)
  BF.orderLock = function (s, id) {
    const o = C().orders[id];
    if (!o) return 'неизвестный приказ';
    if (o.needSection) {
      const [sec, lv] = o.needSection;
      if (s.sections[sec].level < lv) return 'нужен отсек «' + G.TEXT.sections[sec].name + '»';
    }
    return null;
  };
  BF.orderIds = () => Object.keys(C().orders);

  BF.unitType = function (u) {
    if (u.kind === 'droid') return 'droid';
    if (u.kind === 'merc') return 'merc';
    return u.spec || 'trooper';
  };
  BF.unitEntry = function (s, u) {
    return { uid: u.id, type: BF.unitType(u), kind: u.kind, label: G.Units.title(u), rank: G.Units.rankIndex(u), health: u.health };
  };

  // Состав противника по силе
  BF.army = function (s, rng, key, strength) {
    const A = C().armies[key] || C().armies.tusken;
    const list = [];
    let budget = strength;
    if (A.leader && strength >= A.leaderFrom) { list.push({ type: A.leader }); budget -= 2; }
    while (budget > 0.5 && list.length < C().maxEnemies) {
      const pick = rng.weighted(A.units, (x) => x[1]);
      if (A.max && list.length >= A.max) break;
      list.push({ type: pick[0] });
      budget -= pick[2];
    }
    if (!list.length) list.push({ type: A.units[0][0] });
    return list;
  };

  // Создать окно подготовки боя
  BF.create = function (s, rng, o) {
    s.battleSeq = (s.battleSeq || 0) + 1;
    const prefs = BF.prefs(s);
    const choices = U.clone(prefs);
    if (o.mode === 'camp') choices.tactic = prefs.campTactic || 'defense';
    choices.orders = choices.orders.filter((id) => !BF.orderLock(s, id)).slice(0, C().maxOrders);
    const army = o.army || 'tusken';
    const strength = Math.max(1, o.strength);
    return {
      kind: 'battle',
      id: s.battleSeq,
      seed: rng.next() | 0,
      ctx: {
        type: o.type, title: o.title, army: army, mode: o.mode || 'field', defender: o.defender != null ? o.defender : null,
        night: !!o.night, surprise: !!o.surprise, place: o.place || null, target: o.target || null,
        after: o.after || null, afterCtx: o.afterCtx || null, intel: o.intel != null ? o.intel : true,
      },
      unitIds: o.unitIds.slice(0, C().maxPerSide),
      enemies: BF.army(s, rng, army, strength),
      map: { type: o.map || (o.mode === 'camp' ? 'camp' : (C().armies[army] || {}).map || 'desert'), walls: o.mode === 'camp' ? BF.campWalls(s) : 0 },
      choices: choices,
    };
  };

  BF.campWalls = (s) => (s.fort && s.fort.walls) || 0;
  BF.campTurrets = (s) => (s.fort && s.fort.turrets) || 0;

  BF.campSquad = function (s) {
    // Дроиды — в первую очередь, затем самые здоровые и опытные бойцы
    return G.Units.alive(s).filter((u) => G.Units.isFit(s, u))
      .sort((a, b) => (b.kind === 'droid') - (a.kind === 'droid') || b.health - a.health || b.xp - a.xp)
      .slice(0, C().maxPerSide - BF.campTurrets(s)).map((u) => u.id);
  };

  // ---------- точки входа ----------
  BF.fromAttack = function (s, rng, order, squad) {
    const rc = G.Regions.cfg(order.target);
    const army = rc.enemy;
    s.pending = BF.create(s, rng, {
      type: 'attack', title: 'Атака: ' + G.Regions.name(order.target), army: army,
      strength: rc.strength * G.Res.diff(s).enemy * rng.range(0.9, 1.1),
      unitIds: squad.map((u) => u.id), place: order.target, target: order.target,
      defender: 1, mode: army === 'hutt_guard' ? 'fort' : 'field', map: rc.terrain,
      intel: s.regions[order.target].explored >= 30,
    });
  };

  BF.fromEvent = function (s, rng, spec, E) {
    const camp = spec.squad === 'camp';
    const fit = G.Units.alive(s).filter((u) => G.Units.isFit(s, u));
    const ids = camp ? BF.campSquad(s) : G.Units.pickSquad(s, fit, spec.squad || 8, 0, 'fighters');
    if (!ids.length) return G.Events.abstractFight(s, rng, spec);
    const strength = spec.strength * G.Res.diff(s).enemy * (1 + s.day * 0.01);
    const night = !!spec.night;
    E.next(BF.create(s, rng, {
      type: 'event', title: U.cap(spec.title || 'бой'), army: spec.enemy, strength: strength, unitIds: ids,
      mode: camp ? 'camp' : 'field', defender: camp ? 0 : null, night: night,
      surprise: !!(spec.ctx && spec.ctx.surprised), after: spec.after, afterCtx: spec.ctx || {},
    }));
    return 'Начинается бой.';
  };

  // Засада на отряд в поле — бой ставится в очередь сразу за приказом
  BF.ambush = function (s, rng, regionId, squad) {
    const rc = G.Regions.cfg(regionId);
    const strength = G.Actions.enemyStrengthFor(s, rng, regionId);
    const b = BF.create(s, rng, {
      type: 'ambush', title: 'Засада: ' + G.Regions.name(regionId), army: rc.ambush || 'tusken', strength: strength,
      unitIds: squad.filter(G.Units.isAlive).map((u) => u.id), place: regionId, map: rc.terrain || 'desert', defender: null,
    });
    s.queue.unshift({ step: 'battle', battle: b });
  };

  // ---------- выбор настроек ----------
  BF.set = function (s, key, value) {
    const p = s.pending;
    if (!p || p.kind !== 'battle') return;
    const prefs = BF.prefs(s);
    if (key === 'order') {
      if (BF.orderLock(s, value)) return;
      const list = p.choices.orders;
      const i = list.indexOf(value);
      if (i >= 0) list.splice(i, 1);
      else {
        list.push(value);
        while (list.length > C().maxOrders) list.shift();
      }
      prefs.orders = list.slice();
      return;
    }
    p.choices[key] = value;
    if (key === 'tactic' && p.ctx.mode === 'camp') prefs.campTactic = value;
    else prefs[key] = value;
  };

  // ---------- сборка setup для движка ----------
  BF.toSetup = function (s, p) {
    const A = C().armies[p.ctx.army] || C().armies.tusken;
    const ours = p.unitIds.map((id) => G.Units.byId(s, id)).filter((u) => u && G.Units.isAlive(u)).map((u) => BF.unitEntry(s, u));
    if (p.ctx.mode === 'camp') {
      for (let i = 0; i < BF.campTurrets(s); i++) ours.push({ uid: null, type: 'turret', kind: 'turret', label: 'турель №' + (i + 1), rank: 0, health: 100 });
    }
    let enemyTactic = A.tactic;
    if (p.ctx.type === 'attack' && enemyTactic !== 'assault') enemyTactic = 'defense';
    if (p.ctx.mode === 'camp' && enemyTactic === 'defense') enemyTactic = 'assault';
    return {
      v: 1, seed: p.seed, map: p.map, mode: p.ctx.mode, defender: p.ctx.defender,
      night: p.ctx.night, surprise: p.ctx.surprise, army: p.ctx.army,
      sides: [
        { units: ours, tactic: p.choices.tactic, formation: p.ctx.surprise ? 'spread' : p.choices.formation,
          orders: p.choices.orders.filter((id) => !BF.orderLock(s, id)), retreatAt: p.choices.retreatAt, discipline: s.res.discipline },
        { units: p.enemies, tactic: enemyTactic, formation: 'spread', orders: [], retreatAt: A.retreatAt },
      ],
    };
  };

  // ---------- бой ----------
  BF.fight = function (s, quick) {
    const p = s.pending;
    if (!p || p.kind !== 'battle') return;
    const setup = BF.toSetup(s, p);
    const res = G.BattleEngine.run(setup);
    BF.lastRun = { id: p.id, res: res };
    const report = BF.apply(s, p, setup, res);
    s.replays = s.replays || [];
    s.replays.unshift({ id: p.id, day: s.day, title: p.ctx.title, won: report.won, setup: setup });
    if (s.replays.length > 8) s.replays.length = 8;
    s.pending = { kind: 'battleResult', id: p.id, title: p.ctx.title, setup: setup, report: report, quick: !!quick };
  };

  BF.apply = function (s, p, setup, res) {
    const D = C().downed;
    const X = C().xp;
    const rng = G.Game.rng(s);
    const won = res.winner === 0;
    const retreated = res.reason === 'retreat';
    const killed = [], heavy = [], light = [], promoted = [];
    let medics = 0;
    for (const r of res.units) if (r.side === 0 && r.type === 'medic' && r.state === 'active') medics++;
    let kills = 0;
    for (const r of res.units) {
      if (r.side !== 0 || r.uid == null) continue;
      const u = G.Units.byId(s, r.uid);
      if (!u || !G.Units.isAlive(u)) continue;
      u.battles++;
      u.kills += r.kills;
      kills += r.kills;
      if (r.state === 'down') {
        if (u.kind === 'droid') {
          if (rng.chance(D.droidDestroyChance)) { G.Units.kill(s, u, 'уничтожен в бою: ' + p.ctx.title); killed.push(G.Units.title(u)); }
          else { u.health = U.rollRange(rng, D.droidHealth); heavy.push(G.Units.title(u)); }
          continue;
        }
        const chance = won || retreated ? D.deathChance - Math.min(D.medicReduceMax, medics * D.medicReduce) : D.lostDeathChance;
        if (rng.chance(chance)) { G.Units.kill(s, u, 'погиб в бою: ' + p.ctx.title); killed.push(G.Units.title(u)); continue; }
        u.health = U.rollRange(rng, D.heavyHealth);
        heavy.push(G.Units.title(u));
      } else {
        const hp = U.clamp(Math.round((r.hp / r.maxHp) * 100), 1, 100);
        if (hp < u.health) {
          u.health = hp;
          if (G.Units.woundLevel(u) > 0) (G.Units.woundLevel(u) === 2 ? heavy : light).push(G.Units.title(u));
        }
      }
      const before = G.Units.rankIndex(u);
      G.Units.addXp(s, u, X.participate + r.kills * X.kill + (won ? X.win : 0));
      if (G.Units.rankIndex(u) > before) promoted.push(u.num);
    }
    s.stats.kills += kills;
    s.stats.battles++;
    if (won) { s.stats.victories++; G.Res.discipline(s, G.CONFIG.discipline.victory); }
    else { s.stats.defeats++; G.Res.discipline(s, retreated ? Math.round(G.CONFIG.discipline.defeat / 2) : G.CONFIG.discipline.defeat); }

    const enemyDown = res.units.filter((r) => r.side === 1 && r.state === 'down').length;
    const enemyFled = res.units.filter((r) => r.side === 1 && (r.state === 'fled' || r.state === 'exited')).length;
    let loot = '';
    if (won && enemyDown) {
      const sc = Math.round(enemyDown * C().scrapPerKill * G.Res.diff(s).loot);
      if (sc) { G.Res.add(s, 'scrap', sc); loot = 'металл с поля боя +' + sc; }
    }
    if (p.ctx.type === 'attack' && won) {
      const rc = G.Regions.cfg(p.ctx.target);
      s.regions[p.ctx.target].cleared = true;
      const extra = G.Battle.grantLoot(s, rng, G.CONFIG.loot[rc.enemy]);
      if (extra) loot += (loot ? '; ' : '') + extra.replace(/^ Трофеи: /, '').replace(/\.$/, '');
    }
    let afterText = '';
    if (p.ctx.after && G.Events && G.Events.after[p.ctx.after]) {
      afterText = G.Events.after[p.ctx.after](s, rng, won, p.ctx.afterCtx || {}, G.Events.E);
    }
    const head = won ? 'Победа' : retreated ? 'Отступление' : 'Поражение';
    let line = p.ctx.title + ' — ' + head.toLowerCase() + '. Врагов выбито: ' + enemyDown + '.';
    if (killed.length) line += ' Погибли: ' + killed.join(', ') + '.';
    if (heavy.length) line += ' Тяжело ранены: ' + heavy.length + '.';
    if (loot) line += ' Трофеи: ' + loot + '.';
    if (afterText) line += ' ' + afterText;
    G.Game.say(s, line, won ? 'battle' : 'bad');
    // Последствия боя могли обнулить гарнизон
    G.Game.checkOver(s);
    return { won: won, reason: res.reason, head: head, killed: killed, heavy: heavy, light: light.length, promoted: promoted,
      enemyDown: enemyDown, enemyFled: enemyFled, kills: kills, loot: loot, afterText: afterText, ticks: res.ticks, hash: res.hash };
  };

  BF.act = function (s, payload) {
    const p = s.pending;
    if (!p) return;
    if (p.kind === 'battle') {
      if (payload.action === 'set') BF.set(s, payload.key, payload.value);
      else if (payload.action === 'fight') BF.fight(s, false);
      else if (payload.action === 'quick') BF.fight(s, true);
    } else if (p.kind === 'battleResult' && payload.action === 'close') {
      s.pending = null;
    }
  };

  // Для тестов и бота: быстрый бой без просмотра
  BF.autoResolve = function (s) {
    if (s.pending && s.pending.kind === 'battle') BF.fight(s, true);
    if (s.pending && s.pending.kind === 'battleResult') s.pending = null;
  };

  G.BattleFlow = BF;
})(globalThis.G = globalThis.G || {});
