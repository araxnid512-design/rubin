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

test('инженерные работы: ремонт техники, сборка дроида', () => {
  const s = G.Game.newGame({ seed: 12 });
  const rng = G.Game.rng(s);
  s.res.scrap = 1000; s.res.energy = 400;
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

test('обустройство лагеря: постройки, стоимость, ограничения, снос', () => {
  const s = G.Game.newGame({ seed: 13 });
  s.res.scrap = 1000; s.res.energy = 400;
  const water0 = G.Base.waterProduction(s), energy0 = G.Base.energyProduction(s);
  assert.strictEqual(G.Camp.build(s, 'wall', 9, 7), null);
  assert.strictEqual(s.res.scrap, 1000 - G.CONFIG.camp.items.wall.cost.scrap);
  assert.ok(G.Camp.build(s, 'wall', 9, 7), 'на занятое место нельзя');
  assert.ok(G.Camp.build(s, 'wall', 2, 7), 'на корпус нельзя');
  assert.ok(G.Camp.build(s, 'vapor', 8, 3), 'влагоуловитель без отсека нельзя');
  s.sections.vapor.level = 1;
  assert.strictEqual(G.Camp.build(s, 'vapor', 8, 3), null);
  assert.strictEqual(G.Camp.build(s, 'panel', 8, 12), null);
  assert.ok(G.Base.waterProduction(s) > water0);
  assert.ok(G.Base.energyProduction(s) > energy0);
  assert.ok(G.Camp.build(s, 'turret', 11, 5), 'турель без комплекта нельзя');
  s.camp.kits.turret = 1;
  assert.strictEqual(G.Camp.build(s, 'turret', 11, 5), null);
  const id = G.Camp.at(s, 9, 7).id;
  G.Camp.demolish(s, id);
  assert.strictEqual(G.Camp.at(s, 9, 7), null);
});

test('нельзя наглухо перекрыть проход к лагерю', () => {
  const s = G.Game.newGame({ seed: 14 });
  s.res.scrap = 5000;
  G.CONFIG.camp.items.wall.max = 99;
  let refused = 0;
  for (let y = 0; y < G.CONFIG.battle.h; y++) if (G.Camp.build(s, 'wall', 12, y)) refused++;
  G.CONFIG.camp.items.wall.max = 20;
  assert.ok(refused >= 1, 'последняя баррикада в ряду должна быть запрещена');
});

test('постройки лагеря стоят на поле боя при обороне', () => {
  const s = G.Game.newGame({ seed: 15 });
  const rng = G.Game.rng(s);
  s.res.scrap = 1000; s.res.energy = 400;
  s.camp.kits.turret = 1;
  G.Camp.build(s, 'wall', 9, 6);
  G.Camp.build(s, 'turret', 11, 9);
  G.Camp.build(s, 'lamp', 8, 2);
  G.Progress.addVehicle(s, rng, 'walker', true);
  const p = G.BattleFlow.create(s, rng, { type: 'event', title: 'тест', army: 'tusken', strength: 12, unitIds: G.BattleFlow.campSquad(s), mode: 'camp', defender: 0, night: true });
  s.pending = p;
  const setup = G.BattleFlow.toSetup(s, p);
  const tur = setup.sides[0].units.find((u) => u.type === 'turret');
  assert.deepStrictEqual(tur.at, [11, 9]);
  assert.ok(setup.sides[0].units.some((u) => u.type === 'walker'));
  assert.ok(setup.light > 0);
  const B = G.BattleEngine.init(setup);
  assert.strictEqual(B.cells[6 * B.W + 9], G.BattleMap.T.WALL);
  const t = B.units.find((u) => u.type === 'turret');
  assert.deepStrictEqual([t.x, t.y], [11, 9]);
  G.BattleFlow.fight(s, true);
  assert.strictEqual(s.pending.kind, 'battleResult');
});

test('старые сохранения: баррикады и турели переезжают на поле лагеря', () => {
  const s = G.Game.newGame({ seed: 16 });
  delete s.camp;
  s.fort = { walls: 4 };
  s.vehicles = [{ id: 1, type: 'turret', ok: true, health: 100 }, { id: 2, type: 'turret', ok: false, health: 0 }];
  const m = G.Save.parse(JSON.stringify(s));
  assert.strictEqual(G.Camp.count(m, 'wall'), 4);
  assert.strictEqual(G.Camp.count(m, 'turret'), 1);
  assert.strictEqual(m.camp.kits.turret, 1);
  assert.strictEqual(m.vehicles.length, 0);
});

test('находки при разборе: техника и комплекты турелей появляются', () => {
  const s = G.Game.newGame({ seed: 15 });
  s.salvaged = 1000;
  const rng = G.Game.rng(s);
  for (let i = 0; i < 80; i++) G.Actions.rollFind(s, rng);
  assert.ok(s.vehicles.length > 0);
  assert.ok(s.camp.kits.turret > 0);
  assert.ok(G.Progress.vehiclesOf(s, 'walker').length <= 1);
});
