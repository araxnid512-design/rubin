/*
 * Награды кампании: медали за победы, разведку, добычу и дипломатию.
 * Medals.update(s) — выдать новые (запоминает день) и вернуть их список; Medals.progress(s, m) — [сейчас, цель].
 */
(function (G) {
  'use strict';

  const M = {};
  const st = (s, k) => (s.stats && s.stats[k]) || 0;
  const people = (s) => s.units.filter((u) => u.kind !== 'droid');
  const cleared = (s, id) => !!(s.regions[id] && s.regions[id].cleared);
  const knownAll = (s) => {
    let n = 0, all = 0;
    for (const id in G.CONFIG.regions) { if (G.CONFIG.regions[id].hidden) continue; all++; if (s.regions[id] && s.regions[id].known) n++; }
    return [n, all];
  };
  const goal = (fn, need) => ({ test: (s) => fn(s) >= need, prog: (s) => [Math.min(need, fn(s)), need] });

  // tier: 1 — бронза, 2 — серебро, 3 — золото; icon — рисунок на медали
  M.list = [
    Object.assign({ id: 'first', icon: 'star', tier: 1 }, goal((s) => st(s, 'victories'), 1)),
    Object.assign({ id: 'wins10', icon: 'star', tier: 2 }, goal((s) => st(s, 'victories'), 10)),
    Object.assign({ id: 'wins25', icon: 'star', tier: 3 }, goal((s) => st(s, 'victories'), 25)),
    Object.assign({ id: 'flawless', icon: 'shield', tier: 2 }, goal((s) => st(s, 'flawless'), 1)),
    Object.assign({ id: 'flawless5', icon: 'shield', tier: 3 }, goal((s) => st(s, 'flawless'), 5)),
    Object.assign({ id: 'streak', icon: 'bolt', tier: 2 }, goal((s) => st(s, 'bestStreak'), 5)),
    Object.assign({ id: 'kills100', icon: 'cross', tier: 2 }, goal((s) => st(s, 'kills'), 100)),
    { id: 'krayt', icon: 'fang', tier: 3, test: (s) => cleared(s, 'krayt_lair') || ((s.seen || {}).krayt || 0) > 0 },
    { id: 'tusken', icon: 'flag', tier: 2, test: (s) => cleared(s, 'tusken_camp') },
    { id: 'bandits', icon: 'flag', tier: 2, test: (s) => cleared(s, 'bandit_den') },
    { id: 'hutt', icon: 'crown', tier: 3, test: (s) => cleared(s, 'hutt_palace') },
    { id: 'explorer', icon: 'eye', tier: 2, test: (s) => { const [n, all] = knownAll(s); return n >= all; }, prog: knownAll },
    Object.assign({ id: 'water', icon: 'drop', tier: 1 }, goal((s) => st(s, 'waterFound'), 1000)),
    Object.assign({ id: 'scrap', icon: 'gear', tier: 1 }, goal((s) => st(s, 'scrapFound'), 500)),
    Object.assign({ id: 'trader', icon: 'coin', tier: 1 }, goal((s) => st(s, 'trades'), 5)),
    { id: 'ally', icon: 'hand', tier: 2, test: (s) => G.Factions && G.Factions.list.some((f) => G.Factions.rel(s, f) >= 50) },
    { id: 'nick', icon: 'star', tier: 1, test: (s) => people(s).some((u) => u.nick) },
    { id: 'officer', icon: 'chevron', tier: 2, test: (s) => people(s).some((u) => G.Units.isAlive(u) && G.Units.rankIndex(u) >= 5) },
    Object.assign({ id: 'day30', icon: 'sun', tier: 2 }, goal((s) => s.day, 30)),
    Object.assign({ id: 'base', icon: 'gear', tier: 2 }, goal((s) => Object.keys(s.sections).filter((k) => s.sections[k].level >= 2).length, 3)),
    Object.assign({ id: 'shuttle', icon: 'bolt', tier: 1 }, goal((s) => st(s, 'shuttles'), 1)),
    Object.assign({ id: 'contracts', icon: 'coin', tier: 2 }, goal((s) => st(s, 'contracts'), 3)),
    { id: 'home', icon: 'crown', tier: 3, test: (s) => !!(s.over && s.over.type === 'victory') },
  ];

  M.has = (s, id) => !!(s.medals && s.medals[id] != null);
  M.progress = (s, m) => (m.prog ? m.prog(s) : null);

  M.update = function (s) {
    s.medals = s.medals || {};
    const fresh = [];
    for (const m of M.list) {
      if (s.medals[m.id] != null) continue;
      let ok = false;
      try { ok = !!m.test(s); } catch (e) { ok = false; }
      if (!ok) continue;
      s.medals[m.id] = s.day;
      fresh.push(m);
      const T = G.TEXT.medals && G.TEXT.medals[m.id];
      if (T && G.Game && G.Game.chron) G.Game.chron(s, s.day, 'Награда: «' + T.name + '».', 'good');
    }
    return fresh;
  };

  M.count = (s) => Object.keys(s.medals || {}).length;

  G.Medals = M;
})(globalThis.G = globalThis.G || {});
