/*
 * Территории: любую известную локацию можно атаковать и взять под контроль.
 * Пустоши — «зачистка» от тех, кто устраивает там засады; поселения — захват (фракция становится врагом);
 * вражеские лагеря — разгром. Свои территории каждый день приносят доход, засад там почти нет,
 * но враги пытаются их отбить — тогда генерал решает: держать позицию или отступить.
 */
(function (G) {
  'use strict';
  const U = G.U;
  const T = {};
  const C = () => G.CONFIG.territory;
  const say = (s, t, tone) => G.Game.say(s, t, tone);

  T.owned = (s, id) => !!(s.regions[id] && s.regions[id].owner === 'us');
  T.list = (s) => Object.keys(s.regions).filter((id) => T.owned(s, id));
  T.count = (s) => T.list(s).length;
  T.total = () => Object.keys(G.CONFIG.regions).filter((id) => id !== 'crash').length;

  // Кого и с какой силой встретим при атаке на место
  T.attackSpec = function (s, id) {
    const rc = G.CONFIG.regions[id];
    const town = C().towns[id];
    if (rc.kind === 'hostile' || (rc.attackable && rc.enemy)) {
      return { army: rc.enemy, strength: rc.strength, faction: rc.faction || null, kind: 'base', loot: rc.enemy };
    }
    if (town) return { army: town.army, strength: town.strength, faction: town.faction, kind: 'town', loot: town.army };
    const W = C().wild;
    return { army: rc.ambush || 'tusken', strength: W.base + W.perDanger * (rc.danger || 1), faction: null, kind: 'wild', loot: 'sweep' };
  };

  T.canAttack = function (s, id) {
    if (id === 'crash' || !s.regions[id] || !s.regions[id].known || T.owned(s, id)) return false;
    const rc = G.CONFIG.regions[id];
    if (rc.kind === 'hostile') return !s.regions[id].cleared;
    if (rc.kind === 'town') return !!(rc.attackable || C().towns[id]);
    return rc.kind === 'wild';
  };

  // Взять место под контроль (после победы при атаке)
  T.capture = function (s, id) {
    const r = s.regions[id];
    r.owner = 'us';
    r.heldSince = s.day;
    s.stats.captured = (s.stats.captured || 0) + 1;
    G.Game.chron(s, s.day, '«' + G.Regions.name(id) + '» под нашим контролем.', 'good');
  };

  T.lose = function (s, id, why) {
    const r = s.regions[id];
    if (!r || r.owner !== 'us') return;
    r.owner = null;
    const rc = G.CONFIG.regions[id];
    if (rc.kind === 'hostile') r.cleared = false;
    s.stats.lost = (s.stats.lost || 0) + 1;
    G.Game.chron(s, s.day, '«' + G.Regions.name(id) + '» потеряно' + (why ? ': ' + why : '') + '.', 'bad');
  };

  // Что место даёт в сутки
  T.income = function (s, id) {
    const I = C().income;
    const rc = G.CONFIG.regions[id];
    const out = { water: 0, scrap: 0, credits: 0 };
    if (I.towns[id]) Object.assign(out, I.towns[id]);
    else if (rc.kind === 'hostile') { out.water = I.base.water; out.scrap = I.base.scrap; }
    else { out.water = (rc.water || 0) * I.waterPerLevel; out.scrap = (rc.scrap || 0) * I.scrapPerLevel; }
    return out;
  };
  T.incomeText = function (inc) {
    const p = [];
    if (inc.water) p.push('сухари +' + inc.water);
    if (inc.scrap) p.push('металл +' + inc.scrap);
    if (inc.credits) p.push('кредиты +' + inc.credits);
    return p.join(', ');
  };

  T.counterChance = function (s, id) {
    const K = C().counter;
    const rc = G.CONFIG.regions[id];
    if (K.never.indexOf(id) >= 0) return 0;
    const fresh = s.day - (s.regions[id].heldSince || 0) < K.graceDays ? 0 : 1;
    return fresh * Math.min(K.max, K.base + K.perDanger * (rc.danger || 1) + K.perOwned * Math.max(0, T.count(s) - 1));
  };

  // Рассвет: доход со всех территорий и, возможно, одна контратака
  T.dawn = function (s, rng) {
    const owned = T.list(s);
    if (!owned.length) return;
    const sum = { water: 0, scrap: 0, credits: 0 };
    for (const id of owned) {
      const inc = T.income(s, id);
      for (const k in sum) sum[k] += inc[k] || 0;
    }
    for (const k in sum) if (sum[k]) G.Res.add(s, k, sum[k]);
    const txt = T.incomeText(sum);
    if (txt) say(s, 'Наши территории (' + owned.length + ') дали: ' + txt + '.', 'good');
    // контратака — не чаще одной в сутки
    const cand = owned.filter((id) => rng.chance(T.counterChance(s, id)));
    if (cand.length && G.Events && G.Events.defs.counterattack) {
      const id = rng.pick(cand);
      const spec = T.attackSpec(s, id);
      G.Events.queueNow(s, 'counterattack', { region: id, army: spec.army, strength: Math.round(spec.strength * C().counter.strengthMult) });
    }
  };

  G.Territory = T;
})(globalThis.G = globalThis.G || {});
