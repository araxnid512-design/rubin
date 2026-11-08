/* Смена суток: вечер (расход), ночь (налёты), рассвет (лечение, новый день). */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;

  const Day = {};
  const say = (s, t, tone) => G.Game.say(s, t, tone);

  Day.disciplineFactor = function (s) {
    const D = G.CONFIG.discipline;
    if (s.res.discipline < D.lowThreshold) return D.lowEff;
    if (s.res.discipline >= D.highThreshold) return D.highEff;
    return 1;
  };

  // Потребность в сухарях на сутки; orders — приказы дня (для расчёта вылазок)
  Day.waterNeed = function (s, orders) {
    const C = G.CONFIG;
    const ration = C.rations[s.rations].water;
    let need = 0;
    const save = G.CONFIG.specs ? G.CONFIG.specs.sand.waterSave : 0;
    for (const u of G.Units.people(s)) {
      if (u.status === 'away' || u.status === 'missing') continue;
      need += u.spec === 'sand' ? Math.max(0.5, ration - save) : ration;
      if (G.Units.woundLevel(u) === 2) need += C.upkeep.woundedExtraWater;
    }
    for (const o of orders || []) {
      const rc = o.target && C.regions[o.target];
      if (rc && rc.dist) need += (o.troopers || 0) * rc.dist * C.upkeep.expeditionWaterPerDist;
    }
    return Math.round(need * G.Res.diff(s).upkeep);
  };

  Day.raidChance = function (s, guardsOverride) {
    const R = G.CONFIG.raids;
    let p = Math.min(R.maxChance, R.baseChance + R.perDay * s.day);
    const guards = guardsOverride != null ? guardsOverride : s.guards;
    p *= 1 - Math.min(R.guardReduceMax, guards * R.guardReducePer);
    p *= 1 - (G.CONFIG.sections.sensors.raidReduce[s.sections.sensors.level] || 0);
    p *= U.clamp(1 - s.relations.tusken * R.tuskenRelationFactor, 0.3, 1.6);
    if (s.regions.tusken_camp && s.regions.tusken_camp.cleared) p *= 0.4;
    p *= G.Res.diff(s).danger;
    if (s.signal) p *= G.CONFIG.final.signalRaidMult;
    if (G.Camp) p *= G.Camp.raidMult(s);
    if (G.Territory && G.Territory.point(s, 'sensor')) p *= G.CONFIG.territory.points.sensorRaid;
    if (s.flags && s.flags.hermitWarn >= s.day) p *= 0.5; // странник предупредил о налётчиках
    return U.clamp(p, 0, 0.9);
  };

  // ---------- ВЕЧЕР ----------
  Day.evening = function (s, rng) {
    const C = G.CONFIG;
    const parts = [];

    // Производство
    const wProd = G.Base.waterProduction(s);
    if (wProd) G.Res.add(s, 'water', wProd);
    const eProd = G.Base.energyProduction(s);
    const eUse = G.Base.energyUse(s);
    const eNet = eProd - eUse;
    if (s.res.energy + eNet < 0) {
      G.Res.add(s, 'energy', -s.res.energy);
      if (!s.droidsOffline) say(s, 'Энергии не хватает: дроиды переведены в спящий режим, системы лагеря на минимуме.', 'bad');
      s.droidsOffline = true;
      for (const d of G.Units.droids(s)) G.Units.damage(s, d, C.upkeep.droidNoEnergyDamage, 'износ без питания');
    } else {
      G.Res.add(s, 'energy', eNet);
      if (s.droidsOffline) say(s, 'Питание восстановлено — дроиды снова в строю.', 'good');
      s.droidsOffline = false;
    }

    if (G.Progress) G.Progress.evening(s);

    // Сухари
    const need = Day.waterNeed(s, s.orders);
    const R = C.rations[s.rations];
    if (s.res.water >= need) {
      G.Res.add(s, 'water', -need);
      parts.push('съедено ' + need + ' сухарей');
    } else {
      const f = 1 - s.res.water / Math.max(1, need);
      parts.push('сухарей хватило лишь на ' + Math.round((1 - f) * 100) + '% нормы');
      G.Res.add(s, 'water', -s.res.water);
      const hpLoss = Math.round(C.upkeep.thirstHealth * f);
      let died = 0;
      for (const u of G.Units.people(s)) if (G.Units.damage(s, u, hpLoss, 'умер от истощения')) died++;
      G.Res.discipline(s, -Math.round(C.upkeep.thirstDiscipline * f));
      say(s, 'Голод! Бойцы слабеют, в строю ропот.' + (died ? ' От истощения умерли: ' + U.pl(died, F.man) + '.' : ''), 'bad');
    }
    if (wProd) parts.push('кухня дала ' + wProd + ' сухарей');
    parts.push('энергия ' + U.signed(eNet));

    // Паёк
    if (R.health < 0) for (const u of G.Units.people(s)) G.Units.damage(s, u, -R.health, 'умер от истощения');
    if (R.discipline) G.Res.discipline(s, R.discipline);

    // Дисциплина: медленный дрейф и бонус за хорошее снабжение
    const D = C.discipline;
    if (s.res.discipline > D.driftAbove) G.Res.discipline(s, D.drift);
    if (s.rations === 'full' && Day.waterDaysLeft(s) >= D.wellSuppliedDays) G.Res.discipline(s, D.wellSupplied);

    say(s, 'Вечер: ' + parts.join(', ') + '.', 'info');
  };

  Day.waterDaysLeft = function (s) {
    const net = Day.waterNeed(s, null) - G.Base.waterProduction(s);
    return net <= 0 ? 99 : s.res.water / net;
  };

  // ---------- НОЧЬ ----------
  Day.night = function (s, rng) {
    if (rng.chance(Day.raidChance(s))) {
      if (!G.Events) { G.Battle.nightRaid(s, rng); return; }
      const R = G.CONFIG.raids;
      const surprised = s.guards < R.alertGuards && s.sections.sensors.level === 0;
      let strength = (R.strengthBase + R.strengthPerDay * s.day) * rng.range(0.7, 1.3);
      if (surprised) strength *= R.surpriseMult;
      if (s.signal) strength *= G.CONFIG.final.signalStrengthMult;
      G.Events.queueNow(s, 'tusken_raid', { surprised: surprised, strength: Math.round(strength * 10) / 10 });
      return;
    }
    if (G.Goals && G.Goals.night(s, rng)) return;
    if (G.Events) G.Events.rollNight(s, rng);
  };

  // ---------- РАССВЕТ ----------
  Day.dawn = function (s, rng) {
    const C = G.CONFIG;
    const H = C.health;

    if (G.Progress) G.Progress.dawn(s);
    if (G.Terminal) G.Terminal.dawn(s, rng);
    if (G.Territory) G.Territory.dawn(s, rng);
    if (G.Directives) G.Directives.dawn(s);

    // Лечение: медотсек и медики
    let heal = G.Base.healBonus(s) + (G.Camp ? G.Camp.heal(s) : 0);
    if (G.Progress) {
      const M = G.CONFIG.specs.medic;
      heal += Math.min(M.campHealMax, G.Progress.countSpec(s, 'medic', true) * M.campHeal);
    }
    for (const u of G.Units.people(s)) {
      if (u.health >= 100) continue;
      const heavy = u.health < H.heavyBelow;
      let gain = ((heavy ? H.healHeavy : H.healLight) + heal) * G.Units.traitVal(u, 'heal', 1);
      let usedBacta = false;
      if (heavy && s.items.bacta > 0) {
        s.items.bacta--;
        gain += H.bactaHeal;
        usedBacta = true;
      }
      if (!usedBacta && u.health < H.criticalBelow && rng.chance(H.criticalDeathChance * G.Base.deathMult(s))) {
        G.Units.kill(s, u, 'умер от ран');
        say(s, U.cap(G.Units.fullTitle(u)) + ' умер от ран этой ночью.', 'bad');
        continue;
      }
      u.health = Math.min(100, u.health + gain);
    }

    // Дезертирство
    const D = C.discipline;
    if (s.res.discipline < D.desertionBelow && rng.chance(D.desertionChance)) {
      const cands = G.Units.troopers(s).filter((u) => u.status === 'ok' && u.health >= H.heavyBelow);
      const n = Math.min(cands.length, rng.int(1, D.desertionMax));
      rng.shuffle(cands);
      const names = [];
      for (let i = 0; i < n; i++) {
        cands[i].status = 'deserted';
        cands[i].diedDay = s.day;
        s.stats.deserted++;
        names.push(G.Units.title(cands[i]));
      }
      if (n) say(s, 'Ночью из лагеря ушли ' + U.pl(n, F.fighter) + ' — забрав оружие и мешок сухарей: ' + names.join(', ') + '.', 'bad');
    }

    G.Regions.regen(s);
    for (const k in s.visitors) if (s.visitors[k] > 0) s.visitors[k]--;
    s.guards = 0;
  };

  G.Day = Day;
})(globalThis.G = globalThis.G || {});
