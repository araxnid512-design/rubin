'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { G, runCampaign, resolvePending } = require('../tools/bot.js');

function quiet(s) { s.relations.tusken = 100; }

test('вызов флота: сигнал, отсчёт, последний бой, победа', () => {
  const s = G.Game.newGame({ seed: 501, difficulty: 'easy' });
  quiet(s);
  s.sections.comms.level = 3;
  assert.ok(G.Goals.commsReady(s));
  assert.strictEqual(G.Game.addOrder(s, G.Game.makeOrder(s, 'signal')), null);
  G.Game.endDay(s);
  resolvePending(s);
  assert.ok(s.signal);
  assert.ok(G.Goals.daysToFleet(s) > 0);
  s.signal.eta = s.day; // ускоряем прибытие
  G.Game.endDay(s);
  let guard = 0;
  let sawFinal = false;
  while (s.pending && guard++ < 40) {
    const p = s.pending;
    if (p.kind === 'event') {
      const o = G.Events.options(s, p).find((x) => !x.blocked);
      G.Game.act(s, { choice: p.result != null ? 'continue' : o.id });
    } else if (p.kind === 'battle') {
      if (/рубеж/i.test(p.ctx.title)) sawFinal = true;
      G.Game.act(s, { action: 'quick' });
    } else if (p.kind === 'battleResult') G.Game.act(s, { action: 'close' });
    else resolvePending(s);
  }
  assert.ok(sawFinal, 'финальный бой должен состояться');
  assert.ok(s.over);
  assert.ok(['fleet', 'fleet_costly', 'dead'].indexOf(s.over.reason) >= 0);
  assert.strictEqual(s.phase, 'over');
  assert.ok(G.Goals.score(s) >= 0);
});

test('шаттл: ремонт и старт', () => {
  const s = G.Game.newGame({ seed: 502 });
  quiet(s);
  const rng = G.Game.rng(s);
  s.sections.hangar.level = 1;
  s.res.scrap = 500; s.res.energy = 200;
  s.items.hyperParts = 2; s.items.fuel = 4;
  assert.ok(G.Progress.projectTargets(s).indexOf('shuttle') >= 0);
  assert.strictEqual(G.Progress.projectLock(s, 'shuttle'), null);
  G.Progress.work(s, rng, 'shuttle', 100);
  assert.ok(s.shuttleReady);
  assert.strictEqual(G.Game.addOrder(s, G.Game.makeOrder(s, 'launch')), null);
  G.Game.endDay(s);
  assert.ok(s.pending && s.pending.id === 'shuttle_launch');
  const opts = G.Events.options(s, s.pending).map((o) => o.id);
  assert.ok(opts.indexOf('some') >= 0, 'людей больше, чем мест');
  G.Game.act(s, { choice: 'some' });
  G.Game.act(s, { choice: 'continue' });
  assert.ok(s.over && s.over.reason === 'shuttle_some' && s.over.type === 'victory');
});

test('бегство генерала — поражение', () => {
  const s = G.Game.newGame({ seed: 503 });
  s.res.credits = 1000;
  G.Events.trigger(s, G.Game.rng(s), 'smugglers', {});
  G.Game.act(s, { choice: 'escape' });
  G.Game.act(s, { choice: 'continue' });
  assert.strictEqual(s.over.reason, 'abandon');
  assert.strictEqual(s.over.type, 'defeat');
});

test('бот проходит кампанию на лёгкой сложности', () => {
  let wins = 0;
  for (const seed of [11, 12, 13]) {
    const r = runCampaign(seed, 'easy', 160);
    if (r.victory) wins++;
    assert.ok(r.day > 10);
  }
  assert.ok(wins >= 2, 'побед: ' + wins);
});
