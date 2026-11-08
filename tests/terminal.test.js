'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

function runDay(s) {
  G.Game.endDay(s);
  let guard = 0;
  while (s.pending && guard++ < 20) {
    const p = s.pending;
    if (p.kind === 'event') G.Game.act(s, { choice: 0 });
    else if (p.kind === 'battle') G.Game.act(s, { action: 'quick' });
    else if (p.kind === 'battleLive') G.Game.act(s, { action: 'finish', cmds: [] });
    else if (p.kind === 'battleResult' || p.kind === 'trade') G.Game.act(s, { action: 'close' });
    else break;
  }
}

test('терминал: заказ списывает кредиты, шаттл привозит бойцов через указанное число дней', () => {
  const s = G.Game.newGame({ seed: 77 });
  s.res.credits = 1000;
  const before = s.units.length;
  const price = G.Terminal.price(s, 'mercs');
  assert.strictEqual(G.Terminal.order(s, 'mercs'), null);
  assert.strictEqual(s.res.credits, 1000 - price);
  assert.strictEqual(s.terminal.orders[0].eta, s.day + G.CONFIG.terminal.goods.mercs.days);
  // связь разрушена — имперская сеть недоступна
  assert.ok(G.Terminal.why(s, 'troopers'));
  G.CONFIG.terminal.lossChance = 0; G.CONFIG.terminal.delayChance = 0;
  for (let d = 0; d < 3 && !s.over; d++) runDay(s);
  assert.strictEqual(s.terminal.orders.length, 0);
  const mercs = s.units.filter((u) => u.kind === 'merc');
  assert.ok(mercs.length >= 2, 'наёмники прибыли');
  assert.ok(s.units.length >= before + 2);
  assert.ok(s.stats.shuttles >= 1);
  assert.ok(s.terminal.landed && s.terminal.landed.good === 'mercs');
});

test('терминал: не больше трёх шаттлов сразу и без денег не заказать', () => {
  const s = G.Game.newGame({ seed: 5 });
  s.res.credits = 0;
  assert.ok(G.Terminal.why(s, 'water'));
  s.res.credits = 5000;
  for (let i = 0; i < 3; i++) assert.strictEqual(G.Terminal.order(s, 'water'), null);
  assert.ok(G.Terminal.order(s, 'water'), 'четвёртый заказ отклонён');
});

test('контракты: охота засчитывается по сражённым, доставка — кнопкой, срыв портит отношения', () => {
  const s = G.Game.newGame({ seed: 9 });
  const t = s.terminal;
  assert.ok(t.offers.length > 0, 'есть предложения с первого дня');
  // охота
  const hunt = { id: 900, type: 'hunt', target: 'tusken', giver: 'farmers', need: 3, reward: 50, days: 5 };
  t.offers.push(hunt);
  assert.strictEqual(G.Terminal.accept(s, 900), null);
  s.seen = Object.assign({}, s.seen, { tusken: (s.seen.tusken || 0) + 2 });
  assert.deepStrictEqual(G.Terminal.check(s, s.day), []);
  s.seen.tusken += 1;
  const credits = s.res.credits, rel = G.Factions.rel(s, 'farmers');
  assert.strictEqual(G.Terminal.check(s, s.day).length, 1);
  assert.strictEqual(s.res.credits, credits + 50);
  assert.ok(G.Factions.rel(s, 'farmers') > rel);
  // доставка
  const del = { id: 901, type: 'deliver', res: 'scrap', giver: 'jawa', need: 20, reward: 60, days: 5 };
  t.offers.push(del);
  G.Terminal.accept(s, 901);
  s.res.scrap = 10;
  assert.ok(G.Terminal.handIn(s, 901));
  s.res.scrap = 30;
  assert.strictEqual(G.Terminal.handIn(s, 901), null);
  assert.strictEqual(s.res.scrap, 10);
  // срыв срока
  const late = { id: 902, type: 'clear', target: 'tusken_camp', giver: 'farmers', need: 1, reward: 200, days: 1 };
  t.offers.push(late);
  G.Terminal.accept(s, 902);
  const r0 = G.Factions.rel(s, 'farmers');
  s.day += 2;
  G.Terminal.dawn(s, G.Game.rng(s));
  assert.ok(!t.active.some((c) => c.id === 902));
  assert.ok(G.Factions.rel(s, 'farmers') < r0);
});

test('контракты одинаковы при одном зерне и не сбивают основную случайность', () => {
  const a = G.Game.newGame({ seed: 31 }), b = G.Game.newGame({ seed: 31 });
  assert.deepStrictEqual(a.terminal.offers, b.terminal.offers);
  const old = JSON.parse(JSON.stringify(a));
  delete old.terminal;
  const m = G.Save.migrate(old);
  assert.ok(m.terminal && Array.isArray(m.terminal.orders) && m.terminal.offers.length > 0);
});

test('учения: опыт отряду, одна площадка в день', () => {
  const s = G.Game.newGame({ seed: 12 });
  const o = G.Game.makeOrder(s, 'drill', null, 6, 0);
  assert.strictEqual(G.Game.addOrder(s, o), null);
  const xp0 = o.unitIds.map((id) => G.Units.byId(s, id).xp);
  assert.ok(G.Game.addOrder(s, G.Game.makeOrder(s, 'drill', null, 4, 0)), 'второй раз нельзя');
  runDay(s);
  const xp1 = o.unitIds.map((id) => G.Units.byId(s, id)).filter(G.Units.isAlive).map((u) => u.xp);
  assert.ok(xp1.every((x, i) => x > xp0[i]));
});
