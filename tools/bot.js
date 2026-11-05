/*
 * Бот-стратег для проверки баланса. Играет кампанию целиком: ищет воду, чинит отсеки,
 * разведывает, добывает модули связи, вызывает флот или улетает на шаттле.
 * Используется в tools/simulate.js и в автотестах.
 */
'use strict';
const G = require('../tests/load.js').load();

// Предпочтения в событиях — по порядку
const PREF = {
  sandstorm: ['droids', 'wait'],
  heatwave: ['tents', 'water', 'endure'],
  jawa_caravan: ['droid', 'speeder', 'trade', 'ignore'],
  hutt_envoy: ['scrap', 'tribute', 'refuse'],
  capsule_signal: ['rescue', 'ignore'],
  capsule_jawas: ['scrap', 'pay', 'force'],
  rebel_tracks: ['track', 'ambush', 'ignore'],
  rebel_prisoner: ['map', 'release'],
  krayt_roar: ['bait', 'hide'],
  desertion_plot: ['talk', 'arrest'],
  sentry_shot: ['scold'],
  cache_found: ['safe', 'quick'],
  reactor_leak: ['fix', 'droid', 'push'],
  fever: ['bacta', 'isolate'],
  merc_offer: ['one', 'no'],
  dewback: ['tame', 'feast'],
  tusken_sign: ['give', 'ignore'],
  missing_patrol: ['search', 'wait'],
  smugglers: ['parts', 'fuel', 'leave'],
  security_droid: ['repair', 'scrap'],
  broadcast: ['read'],
  bandit_toll: ['scrap', 'water', 'refuse'],
  bandit_raid: ['fight'],
  empire_day: ['plain'],
  womp_rats: ['hunt'],
  tusken_raid: ['fight'],
  fleet_arrival: ['hold'],
  rebel_strike: ['fight'],
  shuttle_launch: ['all', 'some'],
  hutt_job_return: ['ok'],
};

function chooseEvent(s) {
  const p = s.pending;
  const opts = G.Events.options(s, p).filter((o) => !o.blocked);
  const pref = PREF[p.id] || [];
  for (const id of pref) { const o = opts.find((x) => x.id === id); if (o) return o.id; }
  const safe = opts.filter((o) => o.id !== 'escape');
  return (safe[0] || opts[0]).id;
}

function trade(s) {
  const p = s.pending;
  const cfg = G.CONFIG.trade[p.partner];
  if (cfg.buy.commModule && G.Goals.modulesNeeded(s) > (s.items.commModule || 0)) G.Trade.buy(s, 'commModule', 1);
  if (s.sections.hangar.level >= 1 && !s.shuttleReady) {
    if (cfg.buy.hyperParts && (s.items.hyperParts || 0) < 2) G.Trade.buy(s, 'hyperParts', 1);
    if (cfg.buy.fuel && (s.items.fuel || 0) < 4) G.Trade.buy(s, 'fuel', 4 - (s.items.fuel || 0));
  }
  if (s.items.kraytPearl && cfg.sell.kraytPearl) G.Trade.sell(s, 'kraytPearl', s.items.kraytPearl);
  if (s.res.scrap > 400 && cfg.sell.scrap) G.Trade.sell(s, 'scrap', s.res.scrap - 300);
  if (G.Day.waterDaysLeft(s) < 6 && cfg.buy.water) G.Trade.buy(s, 'water', Math.floor(s.res.credits * 0.5 / G.Trade.buyPrice(s, p.partner, 'water')));
  if ((s.items.bacta || 0) < 3 && cfg.buy.bacta) G.Trade.buy(s, 'bacta', 2);
  G.Game.act(s, { action: 'close' });
}

function resolvePending(s) {
  let guard = 0;
  while (s.pending && guard++ < 60) {
    const p = s.pending;
    if (p.kind === 'trade') trade(s);
    else if (p.kind === 'event') G.Game.act(s, { choice: p.result != null ? 'continue' : chooseEvent(s) });
    else if (p.kind === 'battle') {
      const camp = p.ctx.mode === 'camp';
      G.Game.act(s, { action: 'set', key: 'tactic', value: camp ? 'defense' : 'assault' });
      G.Game.act(s, { action: 'set', key: 'retreatAt', value: camp ? 0 : 0.5 });
      G.Game.act(s, { action: 'quick' });
    } else if (p.kind === 'battleResult') G.Game.act(s, { action: 'close' });
    else break;
  }
}

function add(s, type, target, n, d) {
  if (G.Game.ordersLeft(s) <= 0) return false;
  const cfg = G.CONFIG.actions[type] || {};
  const free = G.Game.freeCounts(s);
  let people = Math.min(n || 0, free.people, cfg.max || 99);
  const droids = cfg.droids ? Math.min(d || 0, free.droids) : 0;
  if (!G.Actions.defs[type].noSquad && people + droids < (cfg.min || 1)) return false;
  const o = G.Game.makeOrder(s, type, target, people, droids);
  return !G.Game.addOrder(s, o);
}

function smartOrders(s) {
  const waterDays = G.Day.waterDaysLeft(s);
  s.rations = waterDays < 1.5 ? 'reduced' : 'full';

  // Финал
  if (G.Goals.commsReady(s) && !s.signal) add(s, 'signal');
  if (s.shuttleReady && !s.signal) add(s, 'launch');

  // Вода
  if (waterDays < 6) {
    const wt = G.Actions.defs.water.targets(s).sort((a, b) =>
      s.regions[b].water * G.CONFIG.regions[b].water - s.regions[a].water * G.CONFIG.regions[a].water);
    if (wt.length && s.regions[wt[0]].water > 40) add(s, 'water', wt[0], 14);
  }

  // Дисциплина
  if (s.res.discipline < 50 && s.day - s.lastSpeechDay > 3) add(s, 'speech');
  else if (s.res.discipline < 40 && s.res.credits >= 60) add(s, 'reward');

  // Ремонт отсеков по приоритету
  const prio = [['vapor', 1], ['medbay', 1], ['vapor', 2], ['sensors', 1], ['comms', 1], ['reactor', 2], ['hangar', 1], ['armory', 1], ['comms', 2], ['comms', 3], ['workshop', 1], ['reactor', 3]];
  let built = false;
  for (const [id, lv] of prio) {
    if (s.sections[id].level >= lv || s.sections[id].level !== lv - 1) continue;
    if (!G.Base.canRepair(s, id).ok) continue;
    if (G.Actions.defs.repair.targets(s).indexOf(id) < 0) continue;
    built = add(s, 'repair', id, 14, 2);
    if (built) break;
  }
  if (!built) {
    const eng = ['shuttle', 'wall'].concat((s.vehicles || []).filter((v) => !v.ok).map((v) => 'fix:' + v.id));
    for (const key of eng) {
      if (G.Progress.projectTargets(s).indexOf(key) < 0 || G.Progress.projectLock(s, key)) continue;
      if (key === 'wall' && s.fort.walls >= 6) continue;
      built = add(s, 'engineer', key, 10, 2);
      if (built) break;
    }
  }
  // Металл нужен почти всегда: разбор обломков, а в лагере кончится — Кладбище кораблей
  const salvageTarget = s.regions.crash.scrap > 50 ? 'crash' : (G.Actions.defs.salvage.targets(s).filter((id) => id !== 'crash')[0] || 'crash');
  if (!built || s.res.scrap < 150) add(s, 'salvage', salvageTarget, 14, built ? 0 : 2);
  if (s.regions.graveyard.known && s.regions.graveyard.explored >= 20 && s.regions.graveyard.scrap > 0 && G.Goals.modulesNeeded(s) > (s.items.commModule || 0)) add(s, 'salvage', 'graveyard', 12);

  // Разведка, атака, торговля
  const fit = G.Units.people(s).filter((u) => G.Units.isFit(s, u)).length;
  if (s.regions.rebel_post.known && !s.regions.rebel_post.cleared && fit >= 32 && !s.signal) add(s, 'attack', 'rebel_post', 24, 2);
  if (G.Game.ordersLeft(s) > 0 && G.Goals.modulesNeeded(s) > (s.items.commModule || 0) && G.Regions.canTrade(s, 'mos_espa') &&
      s.relations.hutt >= 25 && s.res.credits >= 700) add(s, 'trade', 'mos_espa', 3);
  if (G.Game.ordersLeft(s) > 0 && G.Regions.canTrade(s, 'mos_espa') && s.relations.hutt < 25 && s.res.credits >= 250) add(s, 'diplomacy', 'hutt', 2);
  if (G.Game.ordersLeft(s) > 0 && s.items.kraytPearl && G.Regions.canTrade(s, 'mos_espa')) add(s, 'trade', 'mos_espa', 3);
  if (G.Game.ordersLeft(s) > 0) {
    const rec = G.Actions.defs.recon.targets(s).filter((id) => s.regions[id].explored < 100 && G.CONFIG.regions[id].kind !== 'hostile')
      .sort((a, b) => G.CONFIG.regions[a].dist - G.CONFIG.regions[b].dist);
    if (rec.length) add(s, 'recon', rec[0], 6);
  }
  if (G.Game.ordersLeft(s) > 0 && (s.signal || G.Day.raidChance(s) > 0.15)) add(s, 'guard', null, 8, 0);
}

function botDay(s) {
  smartOrders(s);
  G.Game.endDay(s);
  resolvePending(s);
}

function runCampaign(seed, difficulty, maxDays) {
  const s = G.Game.newGame({ seed: seed, difficulty: difficulty || 'normal' });
  maxDays = maxDays || 200;
  while (!s.over && s.day < maxDays) botDay(s);
  return {
    seed: seed,
    difficulty: s.difficulty,
    result: s.over ? s.over.reason : 'timeout',
    victory: !!(s.over && s.over.type === 'victory'),
    day: s.day,
    alive: G.Units.people(s).length,
    deaths: s.stats.deaths,
    battles: s.stats.battles,
    score: G.Goals.score(s),
    signalDay: s.signal ? s.signal.day : null,
  };
}

module.exports = { G, botDay, resolvePending, runCampaign, smartOrders };
