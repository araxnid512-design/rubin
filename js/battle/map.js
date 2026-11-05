/* Генерация поля боя 24×16: песок, дюны, скалы, обломки, баррикады. Детерминированно от зерна. */
(function (G) {
  'use strict';

  const T = { SAND: 0, DUNE: 1, ROCK: 2, WRECK: 3, WALL: 4 };

  const BM = { T: T };

  BM.passable = (c) => c === T.SAND || c === T.DUNE;
  BM.blocksLos = (c) => c === T.ROCK || c === T.WRECK;
  BM.isCover = (c) => c === T.ROCK || c === T.WRECK || c === T.WALL;

  function make(w, h) {
    const cells = new Array(w * h).fill(T.SAND);
    return { w: w, h: h, cells: cells };
  }
  const idx = (m, x, y) => y * m.w + x;
  const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
  function set(m, x, y, t) { if (inside(m, x, y)) m.cells[idx(m, x, y)] = t; }
  function get(m, x, y) { return inside(m, x, y) ? m.cells[idx(m, x, y)] : T.ROCK; }

  // Пятно: эллипс с заданной плотностью
  function blob(m, rng, cx, cy, rx, ry, t, density) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1 && rng.chance(density)) set(m, x, y, t);
      }
    }
  }
  function rect(m, x0, y0, w, h, t) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(m, x, y, t);
  }

  // Освободить зоны развёртывания от непроходимых клеток (оставляя немного укрытий)
  function clearZone(m, rng, x0, x1, keep) {
    for (let y = 0; y < m.h; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = get(m, x, y);
        if (!BM.passable(c) && !rng.chance(keep)) set(m, x, y, T.SAND);
      }
    }
  }

  // Проверка связности левого и правого края; если нет прохода — прорубаем
  function ensurePath(m, rng) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const seen = new Uint8Array(m.w * m.h);
      const q = [];
      for (let y = 0; y < m.h; y++) if (BM.passable(get(m, 1, y))) { seen[idx(m, 1, y)] = 1; q.push(idx(m, 1, y)); }
      let reached = false;
      while (q.length) {
        const i = q.shift();
        const x = i % m.w, y = (i / m.w) | 0;
        if (x >= m.w - 2) { reached = true; break; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!inside(m, nx, ny)) continue;
          const j = idx(m, nx, ny);
          if (!seen[j] && BM.passable(m.cells[j])) { seen[j] = 1; q.push(j); }
        }
      }
      if (reached) return;
      const row = rng.int(2, m.h - 3);
      for (let x = 0; x < m.w; x++) if (!BM.passable(get(m, x, row))) set(m, x, row, T.SAND);
    }
  }

  const gen = {};

  gen.desert = function (m, rng) {
    const dunes = rng.int(6, 9);
    for (let i = 0; i < dunes; i++) blob(m, rng, rng.int(2, m.w - 3), rng.int(1, m.h - 2), rng.int(2, 3), rng.int(1, 2), T.DUNE, 0.75);
    const rocks = rng.int(2, 4);
    for (let i = 0; i < rocks; i++) blob(m, rng, rng.int(5, m.w - 6), rng.int(2, m.h - 3), rng.int(0, 1), rng.int(0, 1), T.ROCK, 0.85);
    const wr = rng.int(1, 3);
    for (let i = 0; i < wr; i++) rect(m, rng.int(5, m.w - 7), rng.int(1, m.h - 3), rng.int(1, 2), rng.int(1, 2), T.WRECK);
  };

  gen.rocks = function (m, rng) {
    const n = rng.int(8, 12);
    for (let i = 0; i < n; i++) blob(m, rng, rng.int(3, m.w - 4), rng.int(0, m.h - 1), rng.int(1, 2), rng.int(0, 2), T.ROCK, 0.65);
    const d = rng.int(2, 4);
    for (let i = 0; i < d; i++) blob(m, rng, rng.int(2, m.w - 3), rng.int(1, m.h - 2), 2, 1, T.DUNE, 0.6);
  };

  gen.wreck = function (m, rng) {
    const n = rng.int(9, 13);
    for (let i = 0; i < n; i++) rect(m, rng.int(3, m.w - 5), rng.int(0, m.h - 2), rng.int(1, 3), rng.int(1, 2), rng.chance(0.25) ? T.WALL : T.WRECK);
    const d = rng.int(3, 5);
    for (let i = 0; i < d; i++) blob(m, rng, rng.int(2, m.w - 3), rng.int(1, m.h - 2), 2, 1, T.DUNE, 0.6);
  };

  // Лагерь у корпуса: слева — громада корпуса, впереди — обломки и баррикады
  gen.camp = function (m, rng, spec) {
    rect(m, 0, 4, 3, 8, T.WRECK);
    rect(m, 3, 5, 2, 6, T.WRECK);
    set(m, 4, 7, T.SAND); set(m, 4, 8, T.SAND); // шлюз
    for (let i = 0; i < 6; i++) rect(m, rng.int(6, 13), rng.int(0, m.h - 2), rng.int(1, 2), 1, T.WRECK);
    const d = rng.int(3, 5);
    for (let i = 0; i < d; i++) blob(m, rng, rng.int(12, m.w - 3), rng.int(1, m.h - 2), 2, 1, T.DUNE, 0.6);
    const r = rng.int(2, 4);
    for (let i = 0; i < r; i++) blob(m, rng, rng.int(14, m.w - 4), rng.int(1, m.h - 2), 1, 1, T.ROCK, 0.7);
    // Баррикады (укрепления лагеря) — дуга перед позицией
    const walls = Math.min(12, (spec && spec.walls) || 0);
    const rows = [7, 8, 5, 10, 3, 12, 6, 9, 2, 13, 4, 11];
    for (let i = 0; i < walls; i++) set(m, 10 + (Math.abs(rows[i] - 7.5) > 4 ? -1 : 0), rows[i], T.WALL);
  };

  // Крепость: каменные стены с воротами вокруг позиции защитника
  gen.fort = function (m, rng) {
    gen.desert(m, rng);
    for (let y = 2; y <= 13; y++) set(m, 16, y, T.ROCK);
    for (let x = 16; x <= 22; x++) { set(m, x, 2, T.ROCK); set(m, x, 13, T.ROCK); }
    set(m, 16, 7, T.SAND); set(m, 16, 8, T.SAND); // ворота
    set(m, 16, 4, T.SAND); set(m, 16, 11, T.SAND); // проломы
    for (let i = 0; i < 4; i++) set(m, 18 + (i % 2), 4 + i * 2, T.WALL);
  };

  BM.generate = function (spec, rng) {
    const C = G.CONFIG.battle;
    const m = make(C.w, C.h);
    const type = (spec && spec.type) || 'desert';
    (gen[type] || gen.desert)(m, rng, spec);
    if (type !== 'camp') clearZone(m, rng, 0, 2, 0.15);
    else clearZone(m, rng, 5, 9, 0.3);
    if (type !== 'fort') clearZone(m, rng, m.w - 3, m.w - 1, 0.15);
    ensurePath(m, rng);
    m.type = type;
    return m;
  };

  BM.get = get;
  BM.idx = idx;
  BM.inside = inside;
  G.BattleMap = BM;
})(globalThis.G = globalThis.G || {});
