'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();
const { botDay, resolvePending } = require('./bot.js');

function troops(n, type) {
  return Array.from({ length: n }, (_, i) => ({ type: type || 'trooper', kind: 'trooper', label: 'рядовой ТК-' + (100 + i), rank: i % 3, health: 100 }));
}
function setupFor(seed, army) {
  return {
    seed, mode: 'field', defender: 1, map: { type: 'rocks' }, army: army || 'tusken',
    sides: [
      { units: troops(16), tactic: 'assault', formation: 'line', orders: ['focus', 'hold'], retreatAt: 0.5, discipline: 60 },
      { units: [{ type: 'tusken' }, { type: 'tusken' }, { type: 'tusken' }, { type: 'tusken_rifle' }, { type: 'tusken' }, { type: 'tusken_chief' }], tactic: 'defense' },
    ],
  };
}

test('бой детерминирован: одно зерно — один исход', () => {
  for (const seed of [1, 7, 42, 1234]) {
    const a = G.BattleEngine.run(setupFor(seed));
    const b = G.BattleEngine.run(JSON.parse(JSON.stringify(setupFor(seed))));
    assert.strictEqual(a.hash, b.hash);
    assert.strictEqual(a.ticks, b.ticks);
    assert.deepStrictEqual(a.log, b.log);
  }
});

test('бой всегда заканчивается в пределах лимита', () => {
  for (const army of ['tusken', 'bandits', 'rebels', 'jawa', 'smugglers', 'hutt_guard', 'krayt', 'guild', 'scavengers', 'deserters']) {
    for (const tactic of ['assault', 'defense', 'flank']) {
      const st = setupFor(5, army);
      st.sides[0].tactic = tactic;
      st.sides[1].units = G.BattleFlow.army({}, G.Rng.make(3), army, 14);
      const r = G.BattleEngine.run(st);
      assert.ok(r.ticks <= G.CONFIG.battle.maxTicks, army + '/' + tactic);
      assert.ok(r.winner === 0 || r.winner === 1);
      assert.ok(r.log.length > 1);
    }
  }
});

test('атака: окно подготовки, бой, итоги применяются к отряду', () => {
  const s = G.Game.newGame({ seed: 55 });
  s.regions.tusken_camp.known = true;
  s.regions.tusken_camp.explored = 50;
  const o = G.Game.makeOrder(s, 'attack', 'tusken_camp', 24, 2);
  assert.strictEqual(G.Game.addOrder(s, o), null);
  G.Game.endDay(s);
  assert.ok(s.pending && s.pending.kind === 'battle');
  G.Game.act(s, { action: 'set', key: 'tactic', value: 'flank' });
  G.Game.act(s, { action: 'set', key: 'order', value: 'smoke' });
  assert.strictEqual(s.pending.choices.tactic, 'flank');
  assert.ok(s.pending.choices.orders.indexOf('smoke') >= 0);
  assert.ok(s.pending.choices.orders.length <= G.CONFIG.battle.maxOrders);
  G.Game.act(s, { action: 'quick' });
  assert.strictEqual(s.pending.kind, 'battleResult');
  const rep = s.pending.report;
  assert.ok(typeof rep.won === 'boolean');
  assert.strictEqual(s.stats.battles, 1);
  assert.ok(s.units.some((u) => u.battles > 0));
  assert.strictEqual(s.replays.length, 1);
  // повтор из сохранения даёт тот же бой
  const replay = G.BattleEngine.run(JSON.parse(JSON.stringify(s.replays[0].setup)));
  assert.strictEqual(replay.hash, rep.hash);
  G.Game.act(s, { action: 'close' });
  resolvePending(s);
  assert.strictEqual(s.pending, null);
});

test('кампания с боями: 40 дней без ошибок', () => {
  for (const seed of [11, 22]) {
    const s = G.Game.newGame({ seed });
    for (let d = 0; d < 40 && !s.over; d++) {
      const targets = G.Actions.defs.attack.targets(s);
      if (targets.length && G.Game.freeCounts(s).people > 30) G.Game.addOrder(s, G.Game.makeOrder(s, 'attack', targets[0], 20, 1));
      botDay(s);
    }
    assert.ok(s.day > 5);
  }
});
