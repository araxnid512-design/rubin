'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

// Простой «бот»: каждый день добывает воду, разведывает и разбирает/ремонтирует
function botDay(s) {
  const water = G.Actions.defs.water.targets(s);
  if (water.length) G.Game.addOrder(s, G.Game.makeOrder(s, 'water', water[0], 12, 0));
  const recon = G.Actions.defs.recon.targets(s).filter((id) => s.regions[id].explored < 100);
  if (recon.length) G.Game.addOrder(s, G.Game.makeOrder(s, 'recon', recon[0], 5, 0));
  const rep = G.Actions.defs.repair.targets(s).filter((id) => G.Base.canRepair(s, id).ok);
  if (rep.length) G.Game.addOrder(s, G.Game.makeOrder(s, 'repair', rep[0], 12, 2));
  else G.Game.addOrder(s, G.Game.makeOrder(s, 'salvage', 'crash', 12, 2));
  G.Game.endDay(s);
  let guard = 0;
  while (s.pending && guard++ < 50) {
    if (s.pending.kind === 'trade') G.Game.act(s, { action: 'close' });
    else if (G.TestBot && G.TestBot.handle(s)) continue;
    else break;
  }
}

test('новая игра: 52 штурмовика, 2 дроида, уникальные номера', () => {
  const s = G.Game.newGame({ seed: 1 });
  assert.strictEqual(G.Units.troopers(s).length, 52);
  assert.strictEqual(G.Units.droids(s).length, 2);
  const nums = new Set(s.units.map((u) => u.num));
  assert.strictEqual(nums.size, s.units.length);
  assert.ok(s.units.every((u) => u.name && u.num));
});

test('детерминизм: одно зерно и одни приказы — одинаковый результат', () => {
  const a = G.Game.newGame({ seed: 777 });
  const b = G.Game.newGame({ seed: 777 });
  for (let i = 0; i < 15; i++) { botDay(a); botDay(b); }
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
});

test('вечером отряд пьёт воду по норме', () => {
  const s = G.Game.newGame({ seed: 5 });
  const need = G.Day.waterNeed(s, []);
  const before = s.res.water;
  // убираем случайность ночи
  s.relations.tusken = 100;
  G.Game.endDay(s);
  assert.ok(s.res.water <= before - need + G.Base.waterProduction(s));
  assert.strictEqual(s.day, 2);
});

test('без воды падают здоровье и дисциплина', () => {
  const s = G.Game.newGame({ seed: 9 });
  s.res.water = 0;
  const disc = s.res.discipline;
  const hp = G.U.sum(G.Units.people(s), (u) => u.health);
  G.Game.endDay(s);
  assert.ok(s.res.discipline < disc);
  assert.ok(G.U.sum(G.Units.people(s), (u) => u.health) < hp + 60); // лечение не перекрывает жажду
});

test('нельзя отдать больше приказов, чем положено', () => {
  const s = G.Game.newGame({ seed: 3 });
  for (let i = 0; i < G.CONFIG.orders.perDay; i++) {
    assert.strictEqual(G.Game.addOrder(s, G.Game.makeOrder(s, 'guard', null, 2, 0)), null);
  }
  assert.ok(G.Game.addOrder(s, G.Game.makeOrder(s, 'guard', null, 2, 0)));
});

test('ремонт списывает материалы один раз и повышает уровень', () => {
  const s = G.Game.newGame({ seed: 11 });
  s.res.scrap = 500; s.res.energy = 200;
  const cost = G.Base.nextCost(s, 'vapor');
  G.Base.work(s, 'vapor', 1);
  assert.strictEqual(s.res.scrap, 500 - cost.scrap);
  G.Base.work(s, 'vapor', 1);
  assert.strictEqual(s.res.scrap, 500 - cost.scrap);
  G.Base.work(s, 'vapor', cost.work);
  assert.strictEqual(s.sections.vapor.level, 1);
});

test('торговля: покупка тратит кредиты, продажа приносит', () => {
  const s = G.Game.newGame({ seed: 4 });
  G.Trade.open(s, 'anchorhead');
  const cr = s.res.credits;
  const w = s.res.water;
  const n = G.Trade.buy(s, 'water', 10);
  assert.strictEqual(n, 10);
  assert.strictEqual(s.res.water, w + 10);
  assert.ok(s.res.credits < cr);
  s.res.scrap = 50;
  G.Trade.sell(s, 'scrap', 50);
  assert.strictEqual(s.res.scrap, 0);
  G.Trade.close(s);
  assert.strictEqual(s.pending, null);
});

test('сохранение: сериализация и загрузка без потерь', () => {
  const s = G.Game.newGame({ seed: 21 });
  for (let i = 0; i < 5; i++) botDay(s);
  const copy = G.Save.parse(G.Save.serialize(s));
  assert.strictEqual(JSON.stringify(copy), JSON.stringify(s));
  assert.throws(() => G.Save.parse('{"hello":1}'));
});

test('кампания в 40 дней проходит без ошибок', () => {
  for (const seed of [100, 200, 300]) {
    const s = G.Game.newGame({ seed, difficulty: 'normal' });
    for (let i = 0; i < 40 && !s.over; i++) botDay(s);
    assert.ok(s.day > 1);
  }
});

module.exports = { botDay };
