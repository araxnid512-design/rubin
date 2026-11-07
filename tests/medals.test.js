'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

test('награды: у каждой есть текст, выдаются один раз и запоминают день', () => {
  for (const m of G.Medals.list) assert.ok(G.TEXT.medals[m.id] && G.TEXT.medals[m.id].name, m.id);
  const s = G.Game.newGame({ seed: 8 });
  assert.deepStrictEqual(G.Medals.update(s), []);
  s.stats.victories = 1; s.day = 4;
  const fresh = G.Medals.update(s);
  assert.deepStrictEqual(fresh.map((m) => m.id), ['first']);
  assert.strictEqual(s.medals.first, 4);
  assert.deepStrictEqual(G.Medals.update(s), []);
  assert.deepStrictEqual(G.Medals.progress(s, G.Medals.list.find((m) => m.id === 'wins10')), [1, 10]);
  s.regions.tusken_camp.cleared = true;
  assert.ok(G.Medals.update(s).some((m) => m.id === 'tusken'));
});

test('бой пополняет справочник и считает победы без потерь и серии', () => {
  const s = G.Game.newGame({ seed: 12 });
  const rng = G.Game.rng(s);
  const ids = G.Units.alive(s).slice(0, 16).map((u) => u.id);
  s.pending = G.BattleFlow.create(s, rng, { type: 'event', title: 'Проверка', army: 'jawa', strength: 4, unitIds: ids, mode: 'field', defender: null, map: 'salt' });
  G.Game.act(s, { action: 'quick' });
  assert.strictEqual(s.pending.kind, 'battleResult');
  assert.ok(s.seen.jawa != null, 'джавы встречены');
  assert.strictEqual(s.stats.battles, 1);
  if (s.pending.report.won) {
    assert.strictEqual(s.stats.streak, 1);
    assert.strictEqual(s.stats.bestStreak, 1);
  }
  // старое сохранение без новых полей
  const old = JSON.parse(JSON.stringify(s));
  delete old.seen; delete old.stats.flawless; delete old.medals;
  const m = G.Save.migrate(old);
  assert.ok(m.seen && typeof m.stats.flawless === 'number');
});

test('новые места: карты оазиса, соли и ущелья проходимы от края до края', () => {
  for (const type of ['oasis', 'salt', 'canyon']) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const m = G.BattleMap.generate({ type: type }, G.Rng.make(seed));
      const W = m.w, H = m.h, seen = new Uint8Array(W * H), q = [];
      for (let y = 0; y < H; y++) if (G.BattleMap.passable(m.cells[y * W])) { seen[y * W] = 1; q.push(y * W); }
      let ok = false;
      while (q.length) {
        const i = q.shift(), x = i % W, y = (i / W) | 0;
        if (x === W - 1) { ok = true; break; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!seen[j] && G.BattleMap.passable(m.cells[j])) { seen[j] = 1; q.push(j); }
        }
      }
      assert.ok(ok, type + ' ' + seed);
    }
    assert.ok(G.TEXT.terrain[type] && G.TEXT.codex.terrain[type], type);
  }
  for (const id of ['oasis', 'saltflat', 'freighter', 'windcaves']) {
    assert.ok(G.TEXT.regions[id] && G.CONFIG.regions[id], id);
    const linked = Object.keys(G.CONFIG.regions).some((r) => (G.CONFIG.regions[r].links || []).some((l) => l[0] === id));
    assert.ok(linked, 'к месту ведёт путь: ' + id);
  }
});
