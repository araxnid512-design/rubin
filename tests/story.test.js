'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

function closeAll(s, pick) {
  let guard = 0;
  while (s.pending && guard++ < 30) {
    const p = s.pending;
    if (p.kind === 'event') {
      if (p.result != null) G.Game.act(s, { choice: 'continue' });
      else { const o = G.Events.options(s, p).filter((x) => !x.blocked); G.Game.act(s, { choice: (pick && o.find((x) => x.id === pick[p.id])) ? pick[p.id] : o[0].id }); }
    } else if (p.kind === 'battle') G.Game.act(s, { action: 'quick' });
    else if (p.kind === 'battleResult' || p.kind === 'trade') G.Game.act(s, { action: 'close' });
    else break;
  }
}

test('штурм лагеря идёт в три этапа: после взятого этапа — выбор, место берётся на последнем', () => {
  const s = G.Game.newGame({ seed: 21 });
  s.regions.tusken_camp.known = true; s.regions.tusken_camp.explored = 50;
  assert.strictEqual(G.Territory.stages(s, 'tusken_camp'), 3);
  assert.strictEqual(G.Territory.stages(s, 'anchorhead'), 2);
  assert.strictEqual(G.Territory.stages(s, 'dunes'), 1);
  assert.strictEqual(G.Territory.stages(s, 'relay'), 2);
  // очень сильный отряд против ослабленного лагеря
  G.CONFIG.battle.types.tusken.hp = 5; G.CONFIG.battle.types.tusken_rifle.hp = 5; G.CONFIG.battle.types.tusken_chief.hp = 5;
  const squad = G.Units.alive(s).filter((u) => G.Units.isFit(s, u)).slice(0, 30);
  s.phase = 'resolving'; s.queue = [];
  G.BattleFlow.fromAttack(s, G.Game.rng(s), { target: 'tusken_camp' }, squad);
  assert.ok(/этап 1 из 3/.test(s.pending.ctx.title), s.pending.ctx.title);
  G.Game.act(s, { action: 'quick' });
  assert.ok(s.pending.report.won);
  G.Game.act(s, { action: 'close' });
  assert.strictEqual(s.pending && s.pending.id, 'siege_next', 'после этапа — выбор');
  assert.ok(!G.Territory.owned(s, 'tusken_camp'));
  assert.strictEqual(G.Territory.stageOf(s, 'tusken_camp'), 2);
  G.Game.act(s, { choice: 'push' });
  G.Game.act(s, { choice: 'continue' });
  assert.strictEqual(s.pending.kind, 'battle');
  assert.ok(/этап 2 из 3/.test(s.pending.ctx.title));
  closeAll(s, { siege_next: 'push' });
  assert.ok(G.Territory.owned(s, 'tusken_camp'), 'лагерь взят после трёх этапов');
  assert.ok(s.regions.tusken_camp.cleared);
});

test('стратегические точки дают бонусы всему лагерю', () => {
  const s = G.Game.newGame({ seed: 5 });
  for (const id in s.regions) s.regions[id].known = true;
  const raid0 = G.Day.raidChance(s), price0 = G.Terminal.price(s, 'mercs'), risk0 = G.Terminal.risk(s, 'mercs');
  s.regions.sensor.owner = 'us'; s.regions.relay.owner = 'us'; s.regions.battery.owner = 'us';
  assert.ok(G.Day.raidChance(s) < raid0);
  assert.ok(G.Terminal.price(s, 'mercs') < price0);
  assert.ok(G.Terminal.risk(s, 'mercs') < risk0);
  const b = G.BattleFlow.create(s, G.Game.rng(s), { type: 'event', title: 'тест', army: 'bandits', strength: 10, unitIds: [1, 2, 3], mode: 'field' });
  assert.ok(b.ctx.battery && b.enemies.every((e) => e.hpBonus < 0), 'батарея ослабляет врагов');
  s.regions.depot.owner = 'us'; s.regions.power.owner = 'us';
  assert.strictEqual(G.Territory.income(s, 'power').energy, 12);
  assert.ok(G.Territory.income(s, 'depot').water > 0);
});

test('директива: принять, выполнить — награда; провалить — дисциплина падает', () => {
  const s = G.Game.newGame({ seed: 9 });
  G.Directives.ensure(s);
  const d = { type: 'stock', need: s.res.water - 10, deadline: s.day + 5, reward: 'credits' };
  G.Directives.accept(s, d);
  const cr = s.res.credits;
  G.Directives.dawn(s);
  assert.strictEqual(s.directive, null);
  assert.strictEqual(s.res.credits, cr + G.CONFIG.directives.credits);
  assert.strictEqual(s.stats.directives, 1);
  G.Directives.accept(s, { type: 'territory', need: 99, deadline: s.day, reward: 'bacta' });
  const disc = s.res.discipline;
  G.Directives.dawn(s);
  assert.ok(s.res.discipline < disc);
  // шифровка приходит сама в назначенный день
  s.directive = null; s.directiveNext = s.day + 1; s.queue = [];
  G.Directives.dawn(s);
  assert.strictEqual(s.queue[0].id, 'directive');
  assert.ok(s.queue[0].ctx.d && s.queue[0].ctx.d.deadline > s.day);
});

test('странник с клинком отбивает выстрелы; союзник в финальном бою', () => {
  const setup = {
    v: 3, seed: 7, map: { type: 'canyon' }, mode: 'field', defender: null, army: 'hermit',
    sides: [
      { units: Array.from({ length: 10 }, () => ({ type: 'trooper', kind: 'trooper', label: 'рядовой', rank: 1, health: 100 })), tactic: 'assault', formation: 'line', orders: [], retreatAt: 0 },
      { units: [{ type: 'hermit' }], tactic: 'assault', formation: 'line', orders: [], retreatAt: 1 },
    ],
  };
  const B = G.BattleEngine.init(setup);
  while (!B.over && B.t < 2000) G.BattleEngine.tick(B);
  assert.ok(B.log.some((l) => /отбивает выстрел/.test(l.text)), 'есть отражённые выстрелы');
  const s = G.Game.newGame({ seed: 3 });
  s.flags.hermitAlly = true;
  G.Events.trigger(s, G.Game.rng(s), 'fleet_arrival', {});
  G.Game.act(s, { choice: 'hold' });
  G.Game.act(s, { choice: 'continue' });
  assert.strictEqual(s.pending.kind, 'battle');
  assert.ok(s.pending.allies.some((a) => a.type === 'hermit'));
});
