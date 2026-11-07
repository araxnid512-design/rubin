'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();
const E = () => G.BattleEngine;

function setup(seed, army, extra) {
  const ours = Array.from({ length: 14 }, (_, i) => ({ type: i % 5 ? 'trooper' : 'heavy', kind: 'trooper', label: 'рядовой ТК-' + (200 + i), rank: i % 5, health: 100 }));
  return Object.assign({
    v: 2, seed: seed, map: { type: 'wreck' }, mode: 'field', defender: null, army: army,
    sides: [
      { units: ours, tactic: 'assault', formation: 'line', orders: ['grenade', 'smoke'], retreatAt: 0.5, discipline: 60 },
      { units: G.BattleFlow.army({}, G.Rng.make(seed), army, 16), tactic: 'assault', formation: 'spread', orders: [], retreatAt: 0.6 },
    ],
  }, extra || {});
}

test('живой бой: приказы по ходу боя повторяются точно', () => {
  for (const seed of [3, 11, 29]) {
    const B = E().init(setup(seed, 'deserters'));
    while (!B.over) {
      E().tick(B);
      if (B.t === 20) E().command(B, 'auto', 0);
      if (B.t === 50) E().command(B, 'smoke');
      if (B.t === 80) E().command(B, 'grenade');
      if (B.t === 400) E().command(B, 'retreat');
    }
    const live = E().result(B);
    const again = E().run(Object.assign(setup(seed, 'deserters'), { cmds: live.cmds }));
    assert.strictEqual(again.hash, live.hash, 'seed ' + seed);
    assert.ok(live.cmds.length >= 3);
  }
});

test('приказ по кнопке исполняется, перезарядка видна, без автоприказов штаб молчит', () => {
  const B = E().init(setup(5, 'bandits'));
  E().command(B, 'auto', 0);
  while (B.t < 30) E().tick(B);
  assert.strictEqual(B.log.filter((l) => l.k === 'order').length, 0);
  assert.strictEqual(E().orderWait(B, 'smoke'), 0);
  E().command(B, 'smoke');
  E().tick(B);
  assert.ok(B.smokes.length > 0);
  assert.ok(E().orderWait(B, 'smoke') > 0);
  assert.ok(B.fx.some((f) => f[1] === 'smoke'));
});

test('отход по приказу генерала', () => {
  const B = E().init(setup(8, 'rebels'));
  while (B.t < 15) E().tick(B);
  E().command(B, 'retreat');
  while (!B.over) E().tick(B);
  assert.strictEqual(B.winner, 1);
  assert.strictEqual(B.reason, 'retreat');
});

test('вожаки бросают гранаты, вожак таскенов кличет, бочки взрываются', () => {
  let nade = 0, barrels = 0, booms = 0, cry = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const r = E().run(setup(seed, seed % 2 ? 'bandits' : 'scavengers'));
    nade += r.fx.filter((f) => f[1] === 'nade').length;
    barrels += r.props.length;
    booms += r.booms.filter((b) => b[5] === 'barrel').length;
    const t = E().run(setup(seed, 'tusken'));
    cry += t.fx.filter((f) => f[1] === 'cry').length;
  }
  assert.ok(nade > 0, 'никто не бросил гранату');
  assert.ok(barrels > 0, 'на поле нет бочек');
  assert.ok(booms > 0, 'ни одна бочка не взорвалась');
  assert.ok(cry > 0, 'вожак таскенов ни разу не издал клич');
});

test('бочки не перекрывают проход через поле', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const B = E().init(setup(seed, 'scavengers'));
    // от левого края до правого есть путь по проходимым клеткам
    const W = B.W, Hh = B.H, seen = new Uint8Array(W * Hh), q = [];
    const pass = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && G.BattleMap.passable(B.cells[y * W + x]);
    for (let y = 0; y < Hh; y++) if (pass(0, y)) { seen[y * W] = 1; q.push([0, y]); }
    let ok = false;
    while (q.length) {
      const [x, y] = q.shift();
      if (x === W - 1) { ok = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (pass(x + dx, y + dy) && !seen[(y + dy) * W + x + dx]) { seen[(y + dy) * W + x + dx] = 1; q.push([x + dx, y + dy]); }
    }
    assert.ok(ok, 'seed ' + seed);
  }
});

test('в игре: «В бой» открывает живой бой, итог считается по командам игрока', () => {
  const s = G.Game.newGame({ seed: 77 });
  s.regions.tusken_camp.known = true;
  s.regions.tusken_camp.explored = 50;
  G.Game.addOrder(s, G.Game.makeOrder(s, 'attack', 'tusken_camp', 24, 2));
  G.Game.endDay(s);
  assert.strictEqual(s.pending.kind, 'battle');
  G.Game.act(s, { action: 'fight' });
  assert.strictEqual(s.pending.kind, 'battleLive');
  assert.ok(s.pending.setup.v >= 2);
  // как в интерфейсе: шагаем движок и отдаём приказ
  const B = E().init(JSON.parse(JSON.stringify(s.pending.setup)));
  while (B.t < 25) E().tick(B);
  E().command(B, 'auto', 0);
  E().command(B, 'focus');
  while (!B.over) E().tick(B);
  const live = E().result(B);
  G.Game.act(s, { action: 'finish', cmds: live.cmds.concat([[5, 'взлом'], 'мусор']) });
  assert.strictEqual(s.pending.kind, 'battleResult');
  assert.deepStrictEqual(s.pending.setup.cmds, live.cmds);
  assert.strictEqual(s.pending.report.hash, live.hash);
  assert.strictEqual(s.replays[0].setup.cmds.length, live.cmds.length);
  assert.ok(s.pending.report.acc == null || (s.pending.report.acc >= 0 && s.pending.report.acc <= 100));
  G.Game.act(s, { action: 'close' });
});

test('старые повторы (без живых приказов) убираются при загрузке', () => {
  const s = G.Game.newGame({ seed: 5 });
  s.replays = [{ id: 1, day: 1, title: 'старый', won: true, setup: { v: 1, seed: 1, sides: [] } }, { id: 2, day: 2, title: 'новый', won: true, setup: { v: 2, seed: 2, sides: [] } }];
  const back = G.Save.migrate(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(back.replays.map((r) => r.id), [2]);
});

test('взрывы разрушают баррикады из мешков (новые бои)', () => {
  let broken = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const r = E().run(Object.assign(setup(seed, 'deserters'), { v: 3, map: { type: 'wreck' } }));
    broken += r.broken.length;
    const old = E().run(Object.assign(setup(seed, 'deserters'), { v: 2, map: { type: 'wreck' } }));
    assert.strictEqual(old.broken.length, 0, 'старые бои повторяются как были');
  }
  assert.ok(broken > 0, 'ни одна баррикада не разрушилась');
});
