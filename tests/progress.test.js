'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();
const { resolvePending } = require('./bot.js');

function quietDay(s) {
  s.relations.tusken = 100; // без налётов
  G.Game.endDay(s);
  resolvePending(s);
}

test('подготовка специалиста: требования, стоимость, срок', () => {
  const s = G.Game.newGame({ seed: 8 });
  const u = G.Units.troopers(s).find((x) => G.Units.rankIndex(x) >= 1 && x.health >= 80);
  assert.ok(G.Progress.specReq(s, u, 'heavy'), 'без арсенала нельзя');
  s.sections.armory.level = 1;
  s.res.scrap = 200; s.res.energy = 200;
  assert.strictEqual(G.Progress.specReq(s, u, 'heavy'), null);
  assert.strictEqual(G.Progress.train(s, u, 'heavy'), null);
  assert.strictEqual(u.status, 'training');
  assert.ok(!G.Units.isFit(s, u));
  for (let i = 0; i < G.CONFIG.specs.heavy.days; i++) quietDay(s);
  assert.strictEqual(u.status, 'ok');
  assert.strictEqual(u.spec, 'heavy');
  assert.strictEqual(G.BattleFlow.unitEntry(s, u).type, 'heavy');
});

test('разведчику нужен исправный спидер', () => {
  const s = G.Game.newGame({ seed: 9 });
  const u = G.Units.troopers(s).find((x) => x.health >= 80);
  u.missions = 10;
  assert.ok(G.Progress.specReq(s, u, 'scout'));
  G.Progress.addVehicle(s, G.Game.rng(s), 'speeder', true);
  assert.strictEqual(G.Progress.specReq(s, u, 'scout'), null);
});

test('песчаные штурмовики пьют меньше', () => {
  const s = G.Game.newGame({ seed: 10 });
  const before = G.Day.waterNeed(s, []);
  for (const u of G.Units.troopers(s).slice(0, 10)) u.spec = 'sand';
  assert.ok(G.Day.waterNeed(s, []) < before);
});

test('инженерные работы: баррикады, ремонт техники, сборка дроида', () => {
  const s = G.Game.newGame({ seed: 12 });
  const rng = G.Game.rng(s);
  s.res.scrap = 1000; s.res.energy = 400;
  G.Progress.work(s, rng, 'wall', 100);
  assert.strictEqual(s.fort.walls, 1);
  const v = G.Progress.addVehicle(s, rng, 'walker', false);
  assert.ok(G.Progress.projectLock(s, 'fix:' + v.id), 'без ангара нельзя');
  s.sections.hangar.level = 1;
  assert.strictEqual(G.Progress.projectLock(s, 'fix:' + v.id), null);
  G.Progress.work(s, rng, 'fix:' + v.id, 100);
  assert.ok(v.ok);
  s.sections.workshop.level = 2;
  const droids = G.Units.droids(s).length;
  G.Progress.work(s, rng, 'droid_build', 100);
  assert.strictEqual(G.Units.droids(s).length, droids + 1);
});

test('приказ «Инженерные работы» строит баррикаду за несколько дней', () => {
  const s = G.Game.newGame({ seed: 13 });
  s.res.scrap = 300;
  for (let d = 0; d < 3; d++) {
    const err = G.Game.addOrder(s, G.Game.makeOrder(s, 'engineer', 'wall', 4, 0));
    assert.strictEqual(err, null);
    quietDay(s);
    if (s.fort.walls) break;
  }
  assert.strictEqual(s.fort.walls, 1);
});

test('турели и шагоход выходят на защиту лагеря', () => {
  const s = G.Game.newGame({ seed: 14 });
  const rng = G.Game.rng(s);
  G.Progress.addVehicle(s, rng, 'turret', true);
  G.Progress.addVehicle(s, rng, 'walker', true);
  s.fort.walls = 6;
  const p = G.BattleFlow.create(s, rng, { type: 'event', title: 'тест', army: 'tusken', strength: 12, unitIds: G.BattleFlow.campSquad(s), mode: 'camp', defender: 0 });
  s.pending = p;
  const setup = G.BattleFlow.toSetup(s, p);
  const types = setup.sides[0].units.map((u) => u.type);
  assert.ok(types.indexOf('turret') >= 0);
  assert.ok(types.indexOf('walker') >= 0);
  assert.strictEqual(setup.map.walls, 6);
  G.BattleFlow.fight(s, true);
  assert.strictEqual(s.pending.kind, 'battleResult');
});

test('находки при разборе: техника появляется', () => {
  const s = G.Game.newGame({ seed: 15 });
  s.salvaged = 1000;
  const rng = G.Game.rng(s);
  for (let i = 0; i < 80; i++) G.Actions.rollFind(s, rng);
  assert.ok(s.vehicles.length > 0);
  assert.ok(G.Progress.vehiclesOf(s, 'walker').length <= 1);
});
