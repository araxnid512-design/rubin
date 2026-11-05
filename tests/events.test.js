'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

// Подготовить «богатое» состояние, в котором доступны почти все варианты
function richState(seed) {
  const s = G.Game.newGame({ seed });
  s.day = 31;
  s.res.credits = 2000; s.res.scrap = 800; s.res.water = 900; s.res.energy = 200;
  s.items.bacta = 10;
  for (const id in s.regions) if (!G.CONFIG.regions[id].hidden) s.regions[id].known = true;
  s.sections.comms.level = 1;
  s.relations.tusken = 0;
  return s;
}

// Пройти событие до конца: выбрать вариант, затем «Продолжить» по всем окнам
function resolveAll(s, firstChoice) {
  const rng = G.Game.rng(s);
  let guard = 0;
  let first = true;
  while (s.pending && guard++ < 30) {
    const p = s.pending;
    if (p.kind === 'event') {
      if (p.result != null) { G.Events.choose(s, rng, 'continue'); continue; }
      const opts = G.Events.options(s, p).filter((o) => !o.blocked);
      assert.ok(opts.length > 0, 'нет доступных вариантов в событии ' + p.id);
      const pick = first && firstChoice ? opts.find((o) => o.id === firstChoice) || opts[0] : opts[0];
      first = false;
      G.Events.choose(s, rng, pick.id);
      assert.ok(typeof p.result === 'string' && p.result.length > 0, 'пустой итог: ' + p.id + '/' + pick.id);
    } else if (p.kind === 'trade') {
      G.Trade.close(s);
    } else if (G.BattleFlow && (p.kind === 'battle' || p.kind === 'battleLive' || p.kind === 'battleResult')) {
      G.BattleFlow.autoResolve(s);
    } else break;
  }
  assert.strictEqual(s.pending, null);
}

test('каждый вариант каждого события отрабатывает без ошибок', () => {
  let checked = 0;
  for (const id of Object.keys(G.Events.defs)) {
    // Найдём варианты на «пустом» прогоне
    const probe = richState(1);
    if (id === 'missing_patrol') G.Game.addOrder(probe, G.Game.makeOrder(probe, 'recon', 'ridge', 6, 0));
    const ctx0 = id === 'tusken_raid' ? { surprised: false, strength: 10 } : id === 'hutt_job_return' ? { ids: [1, 2, 3] } : {};
    if (id === 'hutt_job_return') for (const uid of [1, 2, 3]) G.Units.byId(probe, uid).status = 'away';
    G.Events.trigger(probe, G.Game.rng(probe), id, ctx0);
    assert.ok(probe.pending, 'событие не запустилось: ' + id);
    const opts = G.Events.options(probe, probe.pending);
    for (const o of opts) {
      for (const seed of [1, 2, 3]) {
        const s = richState(seed);
        if (id === 'missing_patrol') G.Game.addOrder(s, G.Game.makeOrder(s, 'recon', 'ridge', 6, 0));
        const ctx = id === 'tusken_raid' ? { surprised: false, strength: 10 } : id === 'hutt_job_return' ? { ids: [1, 2, 3] } : {};
        if (id === 'hutt_job_return') for (const uid of [1, 2, 3]) G.Units.byId(s, uid).status = 'away';
        G.Events.trigger(s, G.Game.rng(s), id, ctx);
        resolveAll(s, o.id);
        checked++;
      }
    }
  }
  assert.ok(checked > 60);
});

test('события случаются в долгой кампании', () => {
  const s = G.Game.newGame({ seed: 4242 });
  let seen = 0;
  for (let d = 0; d < 40 && !s.over; d++) {
    const w = G.Actions.defs.water.targets(s);
    if (w.length) G.Game.addOrder(s, G.Game.makeOrder(s, 'water', w[0], 12, 0));
    G.Game.addOrder(s, G.Game.makeOrder(s, 'salvage', 'crash', 10, 2));
    G.Game.endDay(s);
    let guard = 0;
    while (s.pending && guard++ < 20) {
      if (s.pending.kind === 'event') seen++;
      const before = s.pending;
      if (s.pending.kind === 'event') {
        if (s.pending.result == null) {
          const o = G.Events.options(s, s.pending).find((x) => !x.blocked);
          G.Game.act(s, { choice: o.id });
        } else G.Game.act(s, { choice: 'continue' });
      } else if (s.pending.kind === 'trade') G.Game.act(s, { action: 'close' });
      else if (G.BattleFlow) G.BattleFlow.autoResolve(s), G.Game.run(s);
      if (s.pending === before) break;
    }
  }
  assert.ok(seen >= 5, 'событий слишком мало: ' + seen);
  assert.ok(Object.keys(s.eventLog).length >= 3);
});
