'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

test('атаковать можно пустоши, поселения и вражеские лагеря, но не свой лагерь', () => {
  const s = G.Game.newGame({ seed: 3 });
  for (const id in s.regions) s.regions[id].known = true;
  const T = G.Territory;
  assert.ok(T.canAttack(s, 'dunes'));
  assert.ok(T.canAttack(s, 'anchorhead'));
  assert.ok(T.canAttack(s, 'mos_espa'));
  assert.ok(T.canAttack(s, 'tusken_camp'));
  assert.ok(!T.canAttack(s, 'crash'));
  assert.strictEqual(T.attackSpec(s, 'anchorhead').faction, 'farmers');
  assert.strictEqual(T.attackSpec(s, 'dunes').kind, 'wild');
  const targets = G.Actions.defs.attack.targets(s);
  assert.ok(targets.indexOf('dunes') >= 0 && targets.indexOf('anchorhead') >= 0);
});

test('победа при зачистке делает место нашим: доход каждый день и меньше засад', () => {
  const s = G.Game.newGame({ seed: 8 });
  s.regions.ridge.explored = 50;
  const p0 = G.Actions.ambushChance(s, 'ridge', 6);
  // быстрый бой сильным отрядом против слабых засевших
  G.CONFIG.territory.wild.base = 1; G.CONFIG.territory.wild.perDanger = 0.5;
  const squad = G.Units.alive(s).filter((u) => G.Units.isFit(s, u)).slice(0, 20);
  G.BattleFlow.fromAttack(s, G.Game.rng(s), { target: 'ridge' }, squad);
  assert.strictEqual(s.pending.kind, 'battle');
  assert.ok(/Зачистка/.test(s.pending.ctx.title));
  G.Game.act(s, { action: 'quick' });
  assert.strictEqual(s.pending.kind, 'battleResult');
  assert.ok(s.pending.report.won, 'отряд победил');
  G.Game.act(s, { action: 'close' });
  assert.ok(G.Territory.owned(s, 'ridge'));
  assert.ok(G.Actions.ambushChance(s, 'ridge', 6) < p0);
  const inc = G.Territory.income(s, 'ridge');
  const before = { water: s.res.water, scrap: s.res.scrap };
  G.Territory.dawn(s, G.Rng.make(1));
  assert.strictEqual(s.res.water, Math.min(s.res.water, before.water + inc.water));
  assert.ok(s.res.water > before.water || inc.water === 0);
});

test('захват поселения делает фракцию врагом', () => {
  const s = G.Game.newGame({ seed: 4 });
  s.regions.anchorhead.known = true;
  const squad = G.Units.alive(s).slice(0, 10);
  G.BattleFlow.fromAttack(s, G.Game.rng(s), { target: 'anchorhead' }, squad);
  assert.ok(G.Factions.rel(s, 'farmers') < 0);
  assert.strictEqual(s.pending.ctx.army, 'militia');
});

test('контратака: удержать или отступить; старые разгромленные лагеря — наши', () => {
  const s = G.Game.newGame({ seed: 6 });
  s.regions.dunes.owner = 'us'; s.regions.dunes.heldSince = 0;
  G.Events.trigger(s, G.Game.rng(s), 'counterattack', { region: 'dunes', army: 'tusken', strength: 6 });
  assert.strictEqual(s.pending.kind, 'event');
  G.Game.act(s, { choice: 'leave' });
  assert.ok(!G.Territory.owned(s, 'dunes'));
  // миграция
  const old = JSON.parse(JSON.stringify(s));
  old.regions.tusken_camp.cleared = true; delete old.regions.tusken_camp.owner;
  const m = G.Save.migrate(old);
  assert.ok(G.Territory.owned(m, 'tusken_camp'));
});
