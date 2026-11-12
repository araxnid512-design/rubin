'use strict';
/* Мир: открытая долина без клеток — ходьба нажатием, дикие девы на карте, интерьеры (башня, усадьба, пещера) */
(function () {
  const W = window.WD = {}, T = D.T;
  const GRASS = 0, PATH = 1, WATER = 2, TALL = 3, FLOWER = 4, WALL = 8;

  /* ---------- Интерьеры: карта из описания ---------- */
  function buildLegacy(id) {
    if (id === 'manor') FX.manorDef(D.MAPS.manor);
    const def = D.MAPS[id], w = def.w, h = def.h, r = U.rng(def.seed * 7919 + 1), N = w * h;
    const m = { id, def, w, h, tile: new Uint8Array(N), block: new Uint8Array(N), objs: [], npcs: [], signs: [], doors: [], exits: def.exits };
    const at = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const isExit = (x, y) => def.exits.some(e => e.x === x && e.y === y);
    const path = new Uint8Array(N);
    for (const pl of def.paths) for (let i = 0; i < pl.length - 1; i++) {
      const [x0, y0] = pl[i], [x1, y1] = pl[i + 1], dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) { const px = x0 + dx * k, py = y0 + dy * k; for (const [ax, ay] of dx ? [[px, py], [px, py - 1]] : [[px, py], [px + 1, py]]) if (inb(ax, ay)) path[at(ax, ay)] = 1; }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (def.indoor) { m.tile[i] = (x === 0 || y === 0 || x === w - 1 || y === h - 1) && !isExit(x, y) ? WALL : PATH === 1 && path[i] ? GRASS : GRASS; if (m.tile[i] === WALL) m.block[i] = 1; continue; }
      if (path[i]) { m.tile[i] = PATH; continue; }
      let wv = false; for (const p of def.ponds) if (Math.hypot(x - p[0], (y - p[1]) * 1.2) < p[2] + (U.noise(x * 1.7 + y * 3.1) - 0.5) * 0.8) wv = true;
      if (wv) { m.tile[i] = WATER; m.block[i] = 1; continue; }
      let tall = false; for (const g of def.grass) { const d = Math.hypot((x - g[0]) / g[2], (y - g[1]) / g[3]); if (d < 1 + (U.noise(x * 2.3 + y * 1.3 + 5) - 0.5) * 0.5) tall = true; }
      if (tall) { m.tile[i] = TALL; continue; }
      m.tile[i] = r() < def.flowers ? FLOWER : GRASS;
    }
    const treeKind = def.tree || (def.ground === 'forest' ? 'dark' : def.ground === 'rock' ? 'snowpine' : 'tree');
    const addTree = (x, y) => { m.block[at(x, y)] = 1; m.objs.push({ k: 'tree', im: U.pick(ART.objs[treeKind], r), x, y, sy: (y + 1) * T }); };
    // дома
    for (const ho of def.houses || []) {
      for (let y = ho.y; y < ho.y + 4; y++) for (let x = ho.x; x < ho.x + 4; x++) if (inb(x, y)) { m.block[at(x, y)] = 1; m.tile[at(x, y)] = GRASS; }
      m.objs.push({ k: 'house', im: ART.objs.house[ho.k], x: ho.x, y: ho.y, sy: (ho.y + 4) * T });
      m.doors.push({ k: ho.k, x: ho.x + 1, y: ho.y + 3 }, { k: ho.k, x: ho.x + 2, y: ho.y + 3 });
    }
    for (const [k, px, py] of def.props || []) { if (k !== 'rug') m.block[at(px, py)] = 1; m.objs.push({ k: 'prop', pk: k, im: ART.objs.prop[k], x: px, y: py, sy: (py + 1) * T - 4 }); }
    const reserved = new Uint8Array(N);
    for (const n of def.npcs) for (const [x, y] of [[n.x, n.y], n.aside || [n.x, n.y]]) if (inb(x, y)) reserved[at(x, y)] = 1;
    for (const s of def.signs) reserved[at(s.x, s.y)] = 1;
    for (const d of m.doors) if (inb(d.x, d.y + 1)) reserved[at(d.x, d.y + 1)] = 1;
    // граница
    if (!def.indoor) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1, i = at(x, y);
      if (edge && !isExit(x, y) && !path[i]) addTree(x, y);
      else if (!edge && !m.block[i] && !path[i] && !reserved[i] && m.tile[i] !== TALL && m.tile[i] !== WATER && r() < def.trees) {
        let nearPath = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy) && path[at(x + dx, y + dy)]) nearPath = true;
        if (!nearPath) { if (def.ground === 'rock' && r() < 0.35) { m.block[i] = 1; m.objs.push({ k: 'rock', im: ART.objs.rock, x, y, sy: (y + 1) * T - 4 }); } else addTree(x, y); }
      }
    }
    for (const s of def.signs) { m.block[at(s.x, s.y)] = 1; m.tile[at(s.x, s.y)] = m.tile[at(s.x, s.y)] === PATH ? PATH : GRASS; m.signs.push(s); m.objs.push({ k: 'sign', im: ART.objs.sign, x: s.x, y: s.y, sy: (s.y + 1) * T - 2 }); }
    for (const n of def.npcs) {
      if (n.girl === 'dragon' && G.S.caught.dragon) continue;
      const done = n.trainer && G.S.flags[n.trainer];
      const p = done && n.aside ? n.aside : [n.x, n.y];
      m.npcs.push({ id: n.id, look: n.look, girl: n.girl, x: p[0], y: p[1], face: done && n.aside ? 'down' : n.face, trainer: n.trainer, t: Math.random() * 9 });
    }
    return m;
  };
  /* ---------- Открытая долина ---------- */
  const WW = 96, WH = 64, VIL = [22, 34];
  const RIV = [[-2, 22], [10, 20], [24, 18], [40, 22], [56, 20], [70, 24], [98, 22]];
  const riverY = x => { for (let i = 0; i < RIV.length - 1; i++) { const a = RIV[i], b = RIV[i + 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return 22; };
  const nz = a => U.noise(a) - 0.5;
  W.ZN = { village: 'Деревня Кривые Ложки', meadow: 'Медовый луг', forest: 'Шептучий лес', mountain: 'Звонкие скалы', beach: 'Солёный пляж', swamp: 'Квакающее болото' };
  function buildWorld() {
    const w = WW, h = WH, N = w * h, r = U.rng(4242);
    const def = { n: 'Долина', w, h, ground: 'grass', seed: 77, exits: [], npcs: [], signs: [] };
    const m = { id: 'world', def, w, h, tile: new Uint8Array(N), block: new Uint8Array(N), gk: new Array(N), zone: new Array(N), objs: [], npcs: [], signs: [], doors: [], exits: [], gates: [], houses: [] };
    const at = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const wallX = y => Math.round(62 + nz(y * 0.3 + 3) * 3), bogX = y => Math.round(66 + nz(y * 0.27 + 7) * 3);
    // рельеф и зоны
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = at(x, y), ry = riverY(x) + nz(x * 0.21) * 1.2, shore = 58 + nz(x * 0.13) * 3, sandY = 50 + nz(x * 0.17 + 9) * 2.5;
      let g, z, water = false;
      if (y >= shore) { g = 'sand'; z = 'beach'; water = true; }
      else if (y < ry) { if (x > wallX(y)) { g = 'rock'; z = 'mountain'; } else { g = 'forest'; z = 'forest'; } }
      else if (y >= sandY) { g = 'sand'; z = 'beach'; }
      else if (x > bogX(y)) { g = 'swamp'; z = 'swamp'; }
      else { g = 'grass'; z = Math.hypot(x - VIL[0], (y - VIL[1]) * 1.25) < 12 ? 'village' : 'meadow'; }
      if (Math.abs(y - ry) < 1.5) water = true;
      m.gk[i] = g; m.zone[i] = z;
      if (water) { m.tile[i] = WATER; m.block[i] = 1; }
    }
    for (const [px, py, pr] of [[54, 40, 3.4], [12, 13, 2.4], [76, 38, 2.2], [84, 49, 2.6], [72, 44, 1.8], [90, 34, 2]]) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - px, (y - py) * 1.2) < pr + nz(x * 1.7 + y * 3.1) * 0.8) { m.tile[at(x, y)] = WATER; m.block[at(x, y)] = 1; }
    // дороги (кисть 2×2); через реку — мост
    const path = new Uint8Array(N);
    const road = pts => { for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let s = 0; s <= n; s++) { const px = Math.round(x0 + (x1 - x0) * s / n), py = Math.round(y0 + (y1 - y0) * s / n); for (const [ax, ay] of [[px, py], [px + 1, py], [px, py + 1], [px + 1, py + 1]]) if (inb(ax, ay)) path[at(ax, ay)] = 1; } } };
    road([[8, 34], [36, 34]]); road([[22, 30], [22, 53]]); road([[36, 34], [48, 32], [58, 36], [62, 38]]);
    road([[40, 33], [40, 10]]); road([[40, 10], [70, 11], [82, 10]]); road([[83, 10], [83, 8]]); road([[40, 14], [26, 12], [14, 10]]);
    road([[22, 53], [40, 54], [60, 53], [72, 50], [80, 45], [86, 42]]); road([[31, 35], [31, 41]]); road([[31, 41], [29, 41]]);
    for (let i = 0; i < N; i++) if (path[i]) { m.tile[i] = PATH; m.block[i] = 0; if (m.zone[i] === 'beach' && (i / w | 0) >= 57) { m.tile[i] = WATER; m.block[i] = 1; path[i] = 0; } }
    // дома
    const HOUSES = [{ k: 'elder', x: 10, y: 29 }, { k: 'tavern', x: 16, y: 29 }, { k: 'shop', x: 26, y: 29 }, { k: 'manor', x: 28, y: 37 }, { k: 'tower', x: 82, y: 4 }, { k: 'cave', x: 85, y: 38 }];
    for (const ho of HOUSES) {
      for (let y = ho.y; y < ho.y + 4; y++) for (let x = ho.x; x < ho.x + 4; x++) { const i = at(x, y); m.block[i] = 1; m.tile[i] = GRASS; path[i] = 0; }
      for (let x = ho.x; x < ho.x + 4; x++) { const i = at(x, ho.y + 4); if (m.tile[i] === WATER) { m.tile[i] = GRASS; m.block[i] = 0; } }
      m.objs.push({ k: 'house', hk: ho.k, im: ART.objs.house[ho.k], x: ho.x, y: ho.y, sy: (ho.y + 4) * T });
      m.doors.push({ k: ho.k, x: ho.x + 1, y: ho.y + 3 }, { k: ho.k, x: ho.x + 2, y: ho.y + 3 }); m.houses.push(ho);
    }
    // ворота: мост (Гена), перевал (Агриппина), южная калитка (после ведьмы)
    const gy = Math.round(riverY(40)), gx = wallX(10);
    m.gates.push({ x: 40, y: gy, flag: 'gena' }, { x: 41, y: gy, flag: 'gena' }, { x: gx, y: 10, flag: 'agrip' }, { x: gx, y: 11, flag: 'agrip' }, { x: 22, y: 47, flag: 'boss' }, { x: 23, y: 47, flag: 'boss' });
    const reserved = new Uint8Array(N), res = (x, y) => { if (inb(x, y)) reserved[at(x, y)] = 1; };
    for (const g of m.gates) res(g.x, g.y);
    for (const d of m.doors) { res(d.x, d.y + 1); res(d.x, d.y + 2); }
    const free = (x, y) => inb(x, y) && !m.block[at(x, y)] && !path[at(x, y)] && !reserved[at(x, y)] && m.tile[at(x, y)] !== WATER;
    const treeOf = z => z === 'forest' || z === 'swamp' ? 'dark' : z === 'mountain' ? 'snowpine' : z === 'beach' ? 'palm' : 'tree';
    const addTree = (x, y, k) => { m.block[at(x, y)] = 1; m.objs.push({ k: 'tree', im: U.pick(ART.objs[k || treeOf(m.zone[at(x, y)])], r), x, y, sy: (y + 1) * T }); };
    const addRock = (x, y) => { m.block[at(x, y)] = 1; m.objs.push({ k: 'rock', im: ART.objs.rock, x, y, sy: (y + 1) * T - 4 }); };
    const addProp = (k, x, y) => { if (!free(x, y)) return false; if (k !== 'rug') m.block[at(x, y)] = 1; reserved[at(x, y)] = 1; m.objs.push({ k: 'prop', pk: k, im: ART.objs.prop[k], x, y, sy: (y + 1) * T - 4 }); return true; };
    // скальная стена между лесом и горами, чаща между лугом и болотом, забор на юге
    for (let y = 0; y < h; y++) {
      if (y < riverY(wallX(y)) - 1) for (let d = -1; d <= 1; d++) { const x = wallX(y) + d; if (free(x, y)) addRock(x, y); }
      if (y > riverY(bogX(y)) + 1 && y < 47) for (let d = -1; d <= 1; d++) { const x = bogX(y) + d; if (free(x, y)) addTree(x, y, 'dark'); }
    }
    for (let x = 1; x <= bogX(47) + 1; x++) if (!(x === 22 || x === 23)) { if (free(x, 47)) addProp('fence', x, 47); else if (inb(x, 47) && !m.block[at(x, 47)] && m.tile[at(x, 47)] !== WATER) { m.block[at(x, 47)] = 1; } }
    // жители и соперники
    const NP = [{ id: 'pahom', x: 19, y: 37, look: 'old' }, { id: 'kid', x: 13, y: 37, look: 'kid' }, { id: 'marfa', x: 15, y: 37, look: 'marfa' }, { id: 'smith', x: 31, y: 32, look: 'smith' }, { id: 'milka', x: 7, y: 36, look: 'milka' }, { id: 'guard', x: 21, y: 46, look: 'guard' },
      { id: 'gena', x: 39, y: gy + 2, look: 'gena', trainer: 'gena' }, { id: 'agrip', x: gx - 3, y: 12, look: 'nun', trainer: 'agrip' }, { id: 'baron', x: 85, y: 8, look: 'baron', trainer: 'baron' },
      { id: 'tolya', x: 38, y: 52, look: 'tolya', trainer: 'tolya' }, { id: 'klava', x: 79, y: 47, look: 'klava', trainer: 'klava' }];
    for (const n of NP) { const i = at(n.x, n.y); if (m.tile[i] === WATER) m.tile[i] = GRASS; m.block[i] = 0; reserved[i] = 1; m.npcs.push({ id: n.id, look: n.look, x: n.x, y: n.y, face: 'down', trainer: n.trainer, t: r() * 9 }); }
    // предметы
    for (const [k, x, y] of [['well', 20, 37], ['stall', 14, 37], ['bench', 25, 37], ['lamp', 12, 33], ['lamp', 20, 33], ['lamp', 25, 33], ['lamp', 30, 36], ['lamp', 21, 41], ['lamp', 21, 45], ['lamp', 36, 33], ['barrel', 15, 33], ['barrel', 24, 32],
      ['cart', 34, 31], ['laundry', 8, 31], ['woodpile', 6, 37], ['haystack', 9, 39], ['flowers', 13, 33], ['flowers', 29, 33], ['flowers', 27, 41], ['bench', 18, 39],
      ['haystack', 44, 38], ['haystack', 50, 28], ['haystack', 58, 43], ['scarecrow', 46, 29], ['stump', 52, 35], ['stump', 36, 42], ['lamp', 39, 26], ['lamp', 42, 18],
      ['stone', 30, 8], ['stone', 31, 7], ['stone', 48, 6], ['bigshroom', 34, 14], ['bigshroom', 18, 6], ['bigshroom', 52, 15], ['stump', 28, 15], ['stump', 46, 13],
      ['snowman', 70, 6], ['snowman', 76, 14], ['crystal', 88, 12], ['crystal', 72, 16], ['crystal', 90, 5], ['torch', 81, 8], ['torch', 86, 8],
      ['boat', 30, 55], ['umbrella', 36, 52], ['umbrella', 50, 56], ['shell', 44, 56], ['shell', 26, 55], ['boat', 64, 55],
      ['reed', 74, 41], ['reed', 80, 50], ['reed', 88, 46], ['bigshroom', 78, 36], ['bigshroom', 87, 52], ['stump', 70, 48], ['torch', 84, 42], ['torch', 89, 42]]) addProp(k, x, y);
    for (const s of [{ x: 24, y: 36, t: '↑ Баба Нюра, таверна и лавка. → Медовый луг и мост в лес. ↓ Юг — за калиткой.' }, { x: 42, y: 25, t: '↑ Мост в Шептучий лес. Проход — если Гена разрешит.' },
      { x: 58, y: 12, t: '→ Перевал в Звонкие скалы. Башня ведьмы — на вершине.' }, { x: 24, y: 49, t: '↓ Солёный пляж. → Вдоль берега — болото и пещера.' }, { x: 84, y: 44, t: 'Пещера. Темно, сыро и кто-то хихикает.' }])
      if (free(s.x, s.y)) { m.block[at(s.x, s.y)] = 1; reserved[at(s.x, s.y)] = 1; m.signs.push(s); m.objs.push({ k: 'sign', im: ART.objs.sign, x: s.x, y: s.y, sy: (s.y + 1) * T - 2 }); }
    // деревья, камни, трава, цветы
    const DENS = { village: 0.03, meadow: 0.05, forest: 0.24, mountain: 0.09, beach: 0.03, swamp: 0.13 };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = at(x, y), z = m.zone[i]; if (m.tile[i] === WATER || m.block[i] || path[i]) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { addTree(x, y); continue; }
      if (reserved[i]) continue;
      let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy) && path[at(x + dx, y + dy)]) near = true;
      const q = r();
      if (!near && q < DENS[z]) { if (z === 'mountain' && r() < 0.35) addRock(x, y); else addTree(x, y); continue; }
      if (z !== 'village' && U.noise(x * 0.35 + y * 0.61) + U.noise(x * 0.17 - y * 0.29 + 40) > 1.3 && !near) { m.tile[i] = TALL; continue; }
      if (m.gk[i] === 'grass' && r() < 0.08) m.tile[i] = FLOWER;
    }
    // клады
    m.loot = []; for (let k = 0, tr = 0; k < 16 && tr < 900; tr++) { const x = 2 + (r() * (w - 4)) | 0, y = 2 + (r() * (h - 4)) | 0; if (!free(x, y) || m.zone[at(x, y)] === 'village' || m.tile[at(x, y)] === TALL) continue; m.loot.push({ id: k, x, y }); k++; }
    return m;
  }
  W.build = id => { const m = id === 'world' ? buildWorld() : buildLegacy(id); m.rows = []; for (let y = 0; y < m.h + 4; y++) m.rows.push([]); for (const o of m.objs) m.rows[Math.min(m.h + 3, Math.max(0, ((o.sy - 1) / T) | 0))].push(o); m.lights = m.objs.filter(o => o.k === 'house' || (o.k === 'prop' && (o.pk === 'lamp' || o.pk === 'torch' || o.pk === 'fireplace'))); m.chunks = new Map(); return m; };
  W.zoneAt = (tx, ty) => { const m = W.m; return m.zone ? (m.zone[ty * m.w + tx] || 'meadow') : m.id; };
  W.zoneId = () => W.zcur || (W.m ? W.m.id : 'village');

  /* ---------- Земля: рисуется кусками по мере надобности ---------- */
  const CH = 12;
  const gkAt = (m, i) => m.gk ? m.gk[i] : (ART.tiles[m.def.ground] ? m.def.ground : 'grass');
  function groundChunk(m, cx, cy) {
    const key = cx + ',' + cy; let c = m.chunks.get(key); if (c) { c.t = G.time; return c.cv; }
    const def = m.def, sc = G.lowq ? 1 : 1.25, [cv, x] = U.canvas(CH * T, CH * T, sc), tl = ART.tiles;
    const X0 = Math.max(0, cx * CH - 2), Y0 = Math.max(0, cy * CH - 2), X1 = Math.min(m.w, cx * CH + CH + 2), Y1 = Math.min(m.h, cy * CH + CH + 2);
    const tAt = (tx, ty) => tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? -1 : m.tile[ty * m.w + tx];
    const circ = (a, b, rr) => { x.beginPath(); x.arc(a, b, rr, 0, 6.283); x.fill(); };
    x.translate(-cx * CH * T, -cy * CH * T);
    for (let y = Y0; y < Y1; y++) for (let x0 = X0; x0 < X1; x0++) {
      const i = y * m.w + x0, t = m.tile[i], v = (x0 * 7 + y * 13) % 3, g = gkAt(m, i);
      const im = t === PATH ? (def.indoor ? tl.tower[v] : tl.path[v]) : t === WATER ? tl.water[v] : t === FLOWER ? tl.flower[v] : t === WALL ? tl[def.wall || 'wall'][v] : tl[g][v];
      x.drawImage(im, x0 * T, y * T, T + 0.5, T + 0.5);
    }
    // высокая трава — округлыми куртинами
    const talls = []; for (let y = Y0; y < Y1; y++) for (let x0 = X0; x0 < X1; x0++) if (m.tile[y * m.w + x0] === TALL) talls.push([x0, y]);
    if (talls.length) {
      const blob = rad => { x.beginPath(); for (const [tx, ty] of talls) { x.moveTo(tx * T + T / 2 + rad, ty * T + T / 2); x.arc(tx * T + T / 2, ty * T + T / 2, rad, 0, 6.283); } };
      x.fillStyle = 'rgba(20,40,10,.28)'; x.save(); x.translate(0, 4); blob(T * 0.74); x.fill(); x.restore();
      x.fillStyle = '#2f6a24'; blob(T * 0.74); x.fill();
      x.save(); blob(T * 0.69); x.clip();
      for (const [tx, ty] of talls) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) x.drawImage(tl.tall[((tx + dx) * 7 + (ty + dy) * 13 + 99) % 3], (tx + dx) * T, (ty + dy) * T, T + 0.5, T + 0.5); }
      const TT = { sand: 'rgba(235,200,90,.38)', dungeon: 'rgba(80,50,150,.42)', swamp: 'rgba(60,70,20,.25)', rock: 'rgba(200,220,255,.3)' };
      for (const gk2 in TT) { x.beginPath(); let any = false; for (const [tx, ty] of talls) if (gkAt(m, ty * m.w + tx) === gk2) { any = true; x.moveTo(tx * T + T / 2 + T * 0.7, ty * T + T / 2); x.arc(tx * T + T / 2, ty * T + T / 2, T * 0.7, 0, 6.283); } if (any) { x.fillStyle = TT[gk2]; x.fill('nonzero'); } }
      x.restore();
    }
    x.lineCap = 'round';
    for (let y = Y0; y < Y1; y++) for (let x0 = X0; x0 < X1; x0++) {
      const i = y * m.w + x0, t = m.tile[i], g = gkAt(m, i), r = U.rng(def.seed * 131 + x0 * 7919 + y * 104729);
      const px = x0 * T + 8 + r() * 32, py = y * T + 10 + r() * 30, q = r();
      if (t === PATH && !def.indoor) {
        // травинки и тень по краям троп; доски на мосту
        const bridge = m.gk && (tAt(x0 - 1, y) === WATER || tAt(x0 + 1, y) === WATER) && (tAt(x0, y - 1) === PATH || tAt(x0, y + 1) === PATH) && (tAt(x0 - 2, y) === WATER || tAt(x0 + 2, y) === WATER);
        if (bridge) { x.fillStyle = '#b8844a'; x.fillRect(x0 * T, y * T, T, T); x.strokeStyle = 'rgba(70,40,10,.5)'; x.lineWidth = 1.4; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(x0 * T, y * T + k * 12 + 6); x.lineTo(x0 * T + T, y * T + k * 12 + 6); x.stroke(); } }
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nt = tAt(x0 + dx, y + dy); if (nt === PATH || nt === -1) continue;
          if (nt === WATER) { if (bridge && dx) { x.fillStyle = '#7a5432'; x.fillRect(x0 * T + (dx > 0 ? T - 5 : 0), y * T, 5, T); } continue; }
          x.strokeStyle = 'rgba(90,60,30,.25)'; x.lineWidth = 3; x.beginPath(); if (dx) { const ex = x0 * T + (dx > 0 ? T - 1 : 1); x.moveTo(ex, y * T); x.lineTo(ex, y * T + T); } else { const ey = y * T + (dy > 0 ? T - 1 : 1); x.moveTo(x0 * T, ey); x.lineTo(x0 * T + T, ey); } x.stroke();
          x.strokeStyle = g === 'rock' ? '#8a8478' : g === 'sand' ? '#c8b070' : '#5cac44'; x.lineWidth = 1.6;
          for (let k = 0; k < 5; k++) { const kk = (k + r()) / 5; let bx, by; if (dx) { bx = x0 * T + (dx > 0 ? T : 0); by = y * T + kk * T; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx - dx * (4 + r() * 5), by - 2 - r() * 3); x.stroke(); } else { bx = x0 * T + kk * T; by = y * T + (dy > 0 ? T : 0); x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + (r() - 0.5) * 3, by - dy * (4 + r() * 5)); x.stroke(); } }
        }
        if (q < 0.2) { x.fillStyle = 'rgba(120,90,60,.5)'; circ(px, py, 1.6 + r() * 1.6); circ(px + 5, py + 2, 1.2); }
        continue;
      }
      if (t === WALL || t === TALL || def.indoor) continue;
      if (t === WATER) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const nt = tAt(x0 + dx, y + dy); if (nt === WATER || nt === -1) continue; x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(x0 * T + (dx > 0 ? T - 3 : 0), y * T + (dy > 0 ? T - 3 : 0), dx ? 3 : T, dy ? 3 : T); x.fillStyle = '#21121c'; x.fillRect(x0 * T + (dx > 0 ? T - 1 : dx < 0 ? -1 : 0), y * T + (dy > 0 ? T - 1 : dy < 0 ? -1 : 0), dx ? 2 : T, dy ? 2 : T); }
        if (q < 0.14 && !(m.gk && y > 56)) { x.fillStyle = '#3e9a48'; x.beginPath(); x.arc(px, py, 7, 0.5, 5.9); x.lineTo(px, py); x.fill(); x.strokeStyle = '#21121c'; x.lineWidth = 1.4; x.stroke(); if (q < 0.06) { x.fillStyle = '#ffb0d0'; for (let k = 0; k < 5; k++) circ(px + Math.cos(k * 1.257) * 3, py + Math.sin(k * 1.257) * 3, 2.2); x.fillStyle = '#ffe04a'; circ(px, py, 1.6); } }
        continue;
      }
      let shore = false; for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (tAt(x0 + dx, y + dy) === WATER) shore = true;
      if (shore && q < 0.7) { for (let k = 0; k < 4; k++) { const bx = px - 8 + k * 5, hh = 9 + r() * 9; x.strokeStyle = '#21121c'; x.lineWidth = 3; x.beginPath(); x.moveTo(bx, py + 6); x.lineTo(bx + (k % 2 ? 2 : -2), py + 6 - hh); x.stroke(); x.strokeStyle = g === 'sand' ? '#b8c860' : '#5aa040'; x.lineWidth = 1.6; x.stroke(); } continue; }
      if (q > 0.34 || t === FLOWER) continue;
      if (g === 'grass' || g === 'forest' || g === 'swamp') {
        if (q < 0.1) { x.fillStyle = 'rgba(70,60,50,.55)'; circ(px, py, 2.4); x.fillStyle = '#b8b0a4'; circ(px - 0.6, py - 0.8, 2); circ(px + 4, py + 1, 1.4); }
        else if (q < 0.2 && g !== 'grass') { x.fillStyle = '#21121c'; x.fillRect(px - 1.4, py - 1, 2.8, 6); x.fillStyle = '#f4ecdc'; x.fillRect(px - 0.8, py, 1.6, 4.4); x.beginPath(); x.arc(px, py, 4.6, Math.PI, 0); x.closePath(); x.fillStyle = g === 'swamp' ? '#b07ad8' : '#e8483a'; x.fill(); x.strokeStyle = '#21121c'; x.lineWidth = 1.4; x.stroke(); x.fillStyle = '#fff'; circ(px - 1.6, py - 2, 0.9); circ(px + 1.6, py - 1.6, 0.8); }
        else if (q < 0.27) { x.fillStyle = g === 'forest' ? '#3e8a34' : g === 'swamp' ? '#4a6a34' : '#58b848'; for (let k = 0; k < 3; k++) circ(px + Math.cos(k * 2.1) * 3, py + Math.sin(k * 2.1) * 3, 2.6); }
        else { x.fillStyle = ['#ff8ab0', '#ffe04a', '#ffffff', '#b07aff'][(q * 97 | 0) % 4]; for (let k = 0; k < 3; k++) circ(px + k * 5 - 5, py + (k % 2) * 3, 1.5); }
      } else if (g === 'rock') {
        if (q < 0.14) { x.fillStyle = '#8a8478'; circ(px, py, 3); x.fillStyle = '#b8b2a8'; circ(px - 0.8, py - 1, 2.2); circ(px + 5, py + 2, 1.6); }
        else if (q < 0.24) { x.fillStyle = '#f4f8ff'; x.beginPath(); x.ellipse(px, py, 9, 4.4, 0, 0, 6.283); x.fill(); }
        else { x.fillStyle = '#b8e0ff'; x.strokeStyle = '#21121c'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px - 3, py + 4); x.lineTo(px, py - 6); x.lineTo(px + 3, py + 4); x.closePath(); x.fill(); x.stroke(); }
      } else if (g === 'sand') {
        if (q < 0.1) { x.fillStyle = '#ff8a6a'; x.strokeStyle = '#21121c'; x.lineWidth = 1.2; x.beginPath(); for (let k = 0; k < 10; k++) { const a = k * 0.628 + q * 9, rr = k % 2 ? 2.2 : 5.4; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.closePath(); x.fill(); x.stroke(); }
        else if (q < 0.2) { x.fillStyle = '#fff4e8'; x.strokeStyle = '#21121c'; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, 4, Math.PI, 0); x.closePath(); x.fill(); x.stroke(); }
        else { x.fillStyle = 'rgba(160,130,80,.5)'; circ(px, py, 1.8); circ(px + 6, py + 3, 1.4); }
      } else if (g === 'dungeon') {
        if (q < 0.1) { x.fillStyle = '#e8e4d8'; x.strokeStyle = '#21121c'; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, 3.6, 0, 6.283); x.fill(); x.stroke(); x.fillStyle = '#21121c'; circ(px - 1.3, py - 0.4, 0.9); circ(px + 1.3, py - 0.4, 0.9); }
        else if (q < 0.22) { x.fillStyle = 'rgba(160,120,255,.55)'; for (let k = 0; k < 4; k++) circ(px + Math.cos(k * 1.7) * 5, py + Math.sin(k * 1.7) * 4, 1.4); }
      }
    }
    if (m.id === 'tower') { x.fillStyle = 'rgba(255,120,200,.12)'; x.fillRect(0, 0, m.w * T, m.h * T); x.fillStyle = '#4a2a5a'; x.fillRect(5 * T, 0, 3 * T, 2 * T); }
    if (m.chunks.size > 20) { let ok = null, ot = 1e18; for (const [k, v] of m.chunks) if (v.t < ot) { ot = v.t; ok = k; } m.chunks.delete(ok); }
    m.chunks.set(key, { cv, t: G.time });
    return cv;
  }

  /* ---------- Вход на карту, зоны ---------- */
  const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, SPEED = 150;
  W.enter = function (mapId, x, y, face) {
    const S = G.S; if (!D.MAPS[mapId] && mapId !== 'world') { mapId = 'world'; x = 21; y = 36; }
    S.map = mapId; S.x = x; S.y = y; if (face) S.face = face;
    W.m = W.build(mapId);
    W.hero = { px: x * T, py: y * T, walk: 0, mv: 0 };
    W.fol = { px: x * T - 18, py: y * T + 22, walk: 0, face: 'down', path: [] }; W.trail = [];
    W.goal = null; W.drag = null; W.path = null; W.mark = null; W.zcur = null;
    spawnWild(); zoneCheck(true);
    if (mapId === 'manor') FX.onManor();
  };
  function zoneCheck(force) {
    const S = G.S, z = W.zoneAt(S.x, S.y); if (z === W.zcur && !force) return;
    if (!force && W.zt > 0) return; W.zt = 1.2; W.zcur = z;
    FX.rollWeather(z);
    const m = W.m, name = W.ZN[z] || m.def.n;
    UI.zone(name + (m.def.indoor || m.def.cave ? '' : ' · ' + FX.PH[FX.phase()] + ' ' + FX.WX[S.wx]));
    U.music(FX.mapMusic()); ST.onEnter(z);
  }
  const gateClosed = (tx, ty) => { const g = W.m.gates && W.m.gates.find(q => q.x === tx && q.y === ty); return g && !G.S.flags[g.flag] ? g : null; };
  W.npcAt = (x, y) => W.m.npcs.find(n => n.x === x && n.y === y);
  W.solid = function (tx, ty) {
    const m = W.m; if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    return !!(m.block[ty * m.w + tx] || gateClosed(tx, ty) || W.npcAt(tx, ty));
  };
  W.walkable = (x, y) => !W.solid(x, y);
  const feet = () => [W.hero.px + T / 2, W.hero.py + T - 12];
  function canStand(fx, fy) { for (const [dx, dy] of [[-9, -5], [9, -5], [-9, 6], [9, 6]]) if (W.solid(Math.floor((fx + dx) / T), Math.floor((fy + dy) / T))) return false; return true; }

  /* ---------- Поиск пути ---------- */
  function findPath(sx, sy, goalFn) {
    const m = W.m, N = m.w * m.h, prev = new Int32Array(N).fill(-2), q = new Int32Array(N); let qh = 0, qt = 0;
    const s = sy * m.w + sx; prev[s] = -1; q[qt++] = s; let end = -1, n = 0;
    while (qh < qt && n++ < 9000) {
      const c = q[qh++], cx = c % m.w, cy = (c / m.w) | 0;
      if (goalFn(cx, cy)) { end = c; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (W.solid(nx, ny)) continue; if (dx && dy && (W.solid(cx + dx, cy) || W.solid(cx, cy + dy))) continue;
        const k = ny * m.w + nx; if (prev[k] !== -2) continue; prev[k] = c; q[qt++] = k;
      }
    }
    if (end < 0) return null;
    const out = []; for (let c = end; c !== s && c >= 0; c = prev[c]) out.push([(c % m.w) * T + T / 2, ((c / m.w) | 0) * T + T - 12]);
    return out.reverse();
  }
  // нажатие: к девице, жителю, двери, табличке, кладу или просто на землю
  W.tap = function (cx, cy) {
    if (!W.cam || G.mode !== 'world' || G.lock || UI.dialogOpen() || UI.modalOpen()) return;
    const m = W.m, S = G.S, wx = W.cam.left + cx * W.cam.k, wy = W.cam.top + cy * W.cam.k, tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    let act = null, ex = tx, ey = ty;
    const wl = (W.wild || []).find(q => Math.hypot(q.px + 24 - wx, q.py + 14 - wy) < 40);
    const n = m.npcs.find(q => Math.abs(q.x * T + 24 - wx) < 26 && wy > q.y * T - 26 && wy < q.y * T + T + 4);
    const sg = m.signs.find(q => q.x === tx && q.y === ty);
    const ho = m.houses && m.houses.find(q => tx >= q.x && tx < q.x + 4 && ty >= q.y - 1 && ty < q.y + 4);
    const dr = ho ? { k: ho.k, x: ho.x + 1, y: ho.y + 3 } : m.doors.find(q => q.x === tx && (q.y === ty || q.y === ty - 1));
    const pr = m.objs.find(o => o.k === 'prop' && o.pk === 'bath' && o.x === tx && (o.y === ty || o.y === ty + 1));
    if (wl) { act = { k: 'wild', w: wl }; ex = Math.floor((wl.px + 24) / T); ey = Math.floor((wl.py + 30) / T); }
    else if (n) { act = { k: 'npc', n }; ex = n.x; ey = n.y; }
    else if (sg) { act = { k: 'sign', s: sg }; }
    else if (dr) { act = { k: 'door', d: dr }; ex = dr.x; ey = dr.y; }
    else if (pr) { act = { k: 'bath' }; ex = pr.x; ey = pr.y; }
    else if (gateClosed(tx, ty)) { act = { k: 'gate', g: gateClosed(tx, ty) }; }
    const [fx, fy] = feet(), sx = Math.floor(fx / T), sy = Math.floor(fy / T);
    let p;
    if (act) p = act.k === 'wild' ? findPath(sx, sy, (x, y) => Math.abs(x - ex) + Math.abs(y - ey) <= 1) : act.k === 'door' ? findPath(sx, sy, (x, y) => y === ey + 1 && (x === ex || x === ex + 1)) : findPath(sx, sy, (x, y) => Math.abs(x - ex) + Math.abs(y - ey) === 1);
    else { p = findPath(sx, sy, (x, y) => x === tx && y === ty); if (p && p.length) p[p.length - 1] = [U.clamp(wx, tx * T + 10, tx * T + T - 10), U.clamp(wy, ty * T + 8, ty * T + T - 8)]; }
    if (!p) { if (act && act.k === 'gate') { W.goal = { act }; W.path = []; } else U.sfx('bump'); return; }
    W.path = p; W.goal = { act, ex, ey }; W.drag = null; W.mark = { x: act ? ex * T + 24 : wx, y: act ? ey * T + 30 : wy, t: 0, a: !!act };
    U.sfx('ui');
  };
  // идти к клетке (с карты долины): ближайшая свободная рядом с целью
  W.goTile = function (tx, ty) {
    const [fx, fy] = feet(), sx = Math.floor(fx / T), sy = Math.floor(fy / T);
    let best = null; for (let rad = 0; rad < 5 && !best; rad++) for (let dy = -rad; dy <= rad && !best; dy++) for (let dx = -rad; dx <= rad; dx++) if (!W.solid(tx + dx, ty + dy)) { best = [tx + dx, ty + dy]; break; }
    if (!best) return U.sfx('bump');
    const p = findPath(sx, sy, (x, y) => x === best[0] && y === best[1]); if (!p) { UI.toast('Туда пока не пройти.', 'down'); return; }
    W.path = p; W.goal = {}; W.drag = null; W.mark = { x: best[0] * T + 24, y: best[1] * T + 30, t: 0 };
  };
  W.steer = function (cx, cy) { if (!W.cam || G.mode !== 'world') return; W.drag = cx === null ? null : [W.cam.left + cx * W.cam.k, W.cam.top + cy * W.cam.k]; if (W.drag) { W.path = null; W.goal = null; } };

  /* ---------- Движение ---------- */
  W.update = function (dt, input, free) {
    const S = G.S, h = W.hero, m = W.m;
    if (W.zt > 0) W.zt -= dt; if (W.mark) { W.mark.t += dt; if (W.mark.t > 0.7 && !W.path) W.mark = null; }
    wildUpdate(dt);
    for (const n of m.npcs) n.t += dt;
    let vx = 0, vy = 0; const [fx, fy] = feet();
    if (free) {
      if (input) { vx = DIR[input][0]; vy = DIR[input][1]; W.path = null; W.goal = null; }
      else if (W.drag) { const dx = W.drag[0] - fx, dy = W.drag[1] - fy, d = Math.hypot(dx, dy); if (d > 12) { vx = dx / d; vy = dy / d; } }
      else if (W.path) {
        while (W.path.length && Math.hypot(W.path[0][0] - fx, W.path[0][1] - fy) < 5) W.path.shift();
        if (W.path.length) { const dx = W.path[0][0] - fx, dy = W.path[0][1] - fy, d = Math.hypot(dx, dy); vx = dx / d; vy = dy / d; }
        else { const g = W.goal; W.path = null; W.goal = null; if (g && g.act) doAct(g.act, g.ex, g.ey); }
      }
    }
    h.mv = 0;
    if (vx || vy) {
      const st = SPEED * dt; let moved = false;
      if (vx && canStand(fx + vx * st, fy)) { h.px += vx * st; moved = true; }
      const f2 = feet(); if (vy && canStand(f2[0], f2[1] + vy * st)) { h.py += vy * st; moved = true; }
      if (Math.abs(vx) > Math.abs(vy)) S.face = vx > 0 ? 'right' : 'left'; else S.face = vy > 0 ? 'down' : 'up';
      if (moved) { h.walk += dt * 13; h.mv = 1; W.stuck = 0; }
      else {
        // упёрлись: ворота с соперником или просто стена
        const tx = Math.floor((fx + vx * 16) / T), ty = Math.floor((fy + vy * 16) / T), g = gateClosed(tx, ty);
        if (g && free) { W.path = null; W.goal = null; W.drag = null; doAct({ k: 'gate', g }); }
        else if ((W.stuck = (W.stuck || 0) + dt) > 0.4) { W.path = null; W.goal = null; }
      }
    } else h.walk = 0;
    const [nx, ny] = feet(); S.x = Math.floor(nx / T); S.y = Math.floor(ny / T); S.px = h.px; S.py = h.py;
    // напарница идёт по следу
    const tr = W.trail; if (!tr.length || Math.hypot(tr[tr.length - 1][0] - h.px, tr[tr.length - 1][1] - h.py) > 6) { tr.push([h.px, h.py]); if (tr.length > 9) tr.shift(); }
    const f = W.fol, tg = tr[0] || [h.px, h.py], dx = tg[0] - f.px, dy = tg[1] - f.py, d = Math.hypot(dx, dy);
    if (d > 3 && tr.length >= 8) { const sp = Math.min(d, SPEED * 1.05 * dt); f.px += dx / d * sp; f.py += dy / d * sp; f.walk += dt * 13; f.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } else f.walk = 0;
    if (!free) return;
    // переходы, зоны, клады, случайные сценки
    const ex = m.exits.find(e => e.x === S.x && e.y === S.y);
    if (ex) { W.path = null; UI.fade(() => W.enter(ex.to, ex.tx, ex.ty)); return; }
    if (m.zone) zoneCheck(false);
    if (m.loot) for (const l of m.loot) if (!(S.loot && S.loot[l.id]) && Math.hypot(l.x * T + 24 - nx, l.y * T + 30 - ny) < 26) { S.loot = S.loot || {}; S.loot[l.id] = 1; const c = 20 + ((l.id * 37) % 5) * 10; S.money += c; U.sfx('loot'); UI.toast('Клад: +' + c + ' ₽', 'up'); }
    if (h.mv) { W.dist = (W.dist || 0) + SPEED * dt; if (W.dist > T) { W.dist = 0; ST.step(); } }
  };
  function face(tx, ty) { const S = G.S, dx = tx - S.x, dy = ty - S.y; S.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  function doAct(a, ex, ey) {
    const S = G.S;
    if (a.k === 'npc') { face(a.n.x, a.n.y); a.n.face = { up: 'down', down: 'up', left: 'right', right: 'left' }[S.face]; return talkNpc(a.n); }
    if (a.k === 'wild') { face(Math.floor((a.w.px + 24) / T), Math.floor((a.w.py + 30) / T)); return FX.court(a.w); }
    if (a.k === 'sign') { face(a.s.x, a.s.y); return UI.say([{ who: 'Табличка', t: a.s.t }]); }
    if (a.k === 'bath') return FX.bath();
    if (a.k === 'gate') { const n = W.m.npcs.find(q => q.trainer === a.g.flag); if (n) return trainerTalk(n); return UI.say([{ who: 'Стражник', t: 'На юг пока нельзя — туман. Разберись с ведьмой, Чаровник!' }]); }
    if (a.k === 'door') { S.face = 'up'; return door(a.d.k); }
  }
  function door(k) {
    const S = G.S;
    if (k === 'elder') return elder();
    if (k === 'shop') return UI.openShop();
    if (k === 'tavern') return UI.openTavern();
    if (k === 'manor') return UI.fade(() => W.enter('manor', 6, 9, 'up'));
    if (k === 'tower') { if (!S.flags.baron) { const n = W.m.npcs.find(q => q.trainer === 'baron'); return trainerTalk(n); } return UI.fade(() => W.enter('tower', 6, 10, 'up')); }
    if (k === 'cave') return UI.fade(() => W.enter('dungeon', 1, 8, 'right'));
  }
  function talkNpc(n) {
    if (n.girl === 'dragon') return FX.dragon();
    if (n.girl) return FX.resident(n);
    if (n.trainer) return trainerTalk(n);
    if (n.id === 'guard') return UI.say([{ who: 'Стражник', t: G.S.flags.boss ? 'Туман рассеялся — проходи на юг. Говорят, там русалки. Мне туда нельзя, я женат.' : 'Юг закрыт, пока в долине туман. Приказ старосты. И моей жены.' }]);
    const lines = D.NPC[n.id] || ['…']; return UI.say([{ who: (D.NPCN && D.NPCN[n.id]) || 'Житель', t: U.pick(lines, Math.random) }]);
  }
  // действие «перед собой» — для клавиатуры
  W.interact = function () {
    const S = G.S, [dx, dy] = DIR[S.face], tx = S.x + dx, ty = S.y + dy, m = W.m;
    const wl = (W.wild || []).find(q => Math.hypot(q.px - W.hero.px, q.py - W.hero.py) < 60); if (wl) return FX.court(wl);
    const n = W.npcAt(tx, ty); if (n) { n.face = { up: 'down', down: 'up', left: 'right', right: 'left' }[S.face]; return talkNpc(n); }
    const s = m.signs.find(q => q.x === tx && q.y === ty); if (s) return UI.say([{ who: 'Табличка', t: s.t }]);
    const d = m.doors.find(q => q.x === tx && q.y === ty); if (d) return door(d.k);
    const g = gateClosed(tx, ty); if (g) return doAct({ k: 'gate', g });
    const pr = m.objs.find(o => o.k === 'prop' && o.x === tx && o.y === ty); if (pr && pr.pk === 'bath') return FX.bath();
  };
  W.elder = elder;
  function elder() {
    const S = G.S;
    if (!S.flags.starter) {
      UI.say(D.NPC.elderIntro.map(t => ({ who: 'Баба Нюра', t })), () => UI.chooseStarter(id => {
        G.addGirl(id, 5); S.flags.starter = true; W.trail = []; spawnWild();
        UI.say([{ girl: id, expr: 'happy', t: D.GIRLS[id].tame }, ...ST.starter(id)], () => G.save());
      }));
    } else UI.say(ST.elder());
  }
  function trainerTalk(n) {
    const S = G.S, tr = D.TRAINERS[n.trainer];
    if (S.flags[n.trainer] && S.flags.boss && D.REMATCH[n.trainer]) return FX.rematch(n);
    if (S.flags[n.trainer]) return UI.say([{ who: tr.n, t: tr.after }]);
    if (!G.alive()) return UI.say([{ who: tr.n, t: 'Твои девицы без сил. Сначала отдохни в таверне, герой-любовник.' }]);
    UI.say(ST.before(n.trainer), () => BT.start({ trainer: n.trainer, zone: W.zoneId(), npc: n }));
  }
  W.trainerBeaten = function () { };

  /* ---------- Дикие девы на карте ---------- */
  W.HOME = { slime: 'meadow', harpy: 'meadow', neko: 'meadow', fox: 'forest', lamia: 'forest', dryad: 'forest', minotaur: 'forest', snow: 'mountain', valkyrie: 'mountain', vampire: 'mountain', mermaid: 'beach', frog: 'swamp', ghost: 'dungeon' };
  function spot(zone, far) {
    const m = W.m;
    for (let tr = 0; tr < 400; tr++) { const x = 2 + (Math.random() * (m.w - 4)) | 0, y = 2 + (Math.random() * (m.h - 4)) | 0, i = y * m.w + x; if (m.block[i] || m.tile[i] === WATER || m.tile[i] === PATH || W.npcAt(x, y)) continue; if (m.zone ? m.zone[i] !== zone : m.id !== zone) continue; if (far && Math.hypot(x - G.S.x, y - G.S.y) < 7) continue; if (zone === 'beach' && y < 51) continue; return [x, y]; }
    return null;
  }
  function spawnWild() {
    const S = G.S; W.wild = []; if (!S.flags.starter) return;
    for (const id in W.HOME) { if (S.caught[id]) continue; const p = spot(W.HOME[id], true); if (p) W.wild.push({ id, px: p[0] * T, py: p[1] * T, hx: p[0] * T, hy: p[1] * T, vx: 0, vy: 0, t: Math.random() * 3, st: 0, f: 'down', walk: 0 }); }
  }
  W.spawnWild = spawnWild;
  W.relocate = function (w) { const p = spot(W.HOME[w.id], true); if (p) { w.px = w.hx = p[0] * T; w.py = w.hy = p[1] * T; } };
  W.removeWild = id => { W.wild = (W.wild || []).filter(q => q.id !== id); };
  function wildUpdate(dt) {
    for (const w of W.wild || []) {
      w.t -= dt;
      if (w.st === 1) { const nx = w.px + w.vx * dt, ny = w.py + w.vy * dt; if (!W.solid(Math.floor((nx + 24) / T), Math.floor((ny + 34) / T)) && W.m.tile[Math.floor((ny + 34) / T) * W.m.w + Math.floor((nx + 24) / T)] !== WATER) { w.px = nx; w.py = ny; w.walk += dt * 11; } else w.t = 0; if (w.t <= 0) { w.st = 0; w.t = 1.5 + Math.random() * 4; w.walk = 0; } }
      else if (w.t <= 0) { const a = Math.random() * 6.283; let tx = w.px + Math.cos(a) * 60, ty = w.py + Math.sin(a) * 60; if (Math.hypot(tx - w.hx, ty - w.hy) > 130) { tx = w.hx; ty = w.hy; } const d = Math.hypot(tx - w.px, ty - w.py) || 1; w.vx = (tx - w.px) / d * 34; w.vy = (ty - w.py) / d * 34; w.st = 1; w.t = d / 34; w.f = Math.abs(w.vx) > Math.abs(w.vy) ? (w.vx > 0 ? 'right' : 'left') : 'down'; }
    }
  }

  /* ---------- Отрисовка ---------- */
  W.render = function (x, V) {
    const m = W.m, h = W.hero, z = V.h / (T * 8.6), S = G.S, tm = G.time;
    const hw = V.w / 2 / z, hh = V.h / 2 / z, mw = m.w * T, mh = m.h * T;
    let cx = h.px + T / 2, cy = h.py + T / 2;
    if (W.camx === undefined || Math.abs(W.camx - cx) > 400 || Math.abs(W.camy - cy) > 400) { W.camx = cx; W.camy = cy; }
    W.camx += (cx - W.camx) * Math.min(1, (G.dt || 0.016) * 7); W.camy += (cy - W.camy) * Math.min(1, (G.dt || 0.016) * 7);
    cx = mw < hw * 2 ? mw / 2 : U.clamp(W.camx, hw, mw - hw); cy = mh < hh * 2 ? mh / 2 : U.clamp(W.camy, hh, mh - hh);
    const left = cx - hw, top = cy - hh;
    W.cam = { left, top, k: hw * 2 / innerWidth };
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = m.def.indoor ? '#1a0e22' : '#2e5a2a'; x.fillRect(0, 0, V.w, V.h);
    x.setTransform(z, 0, 0, z, -left * z, -top * z);
    const c0 = Math.max(0, Math.floor(left / (CH * T))), c1 = Math.min(Math.ceil(m.w / CH) - 1, Math.floor((left + hw * 2) / (CH * T))), r0 = Math.max(0, Math.floor(top / (CH * T))), r1 = Math.min(Math.ceil(m.h / CH) - 1, Math.floor((top + hh * 2) / (CH * T)));
    for (let cy2 = r0; cy2 <= r1; cy2++) for (let cx2 = c0; cx2 <= c1; cx2++) x.drawImage(groundChunk(m, cx2, cy2), cx2 * CH * T, cy2 * CH * T, CH * T + 0.5, CH * T + 0.5);
    const x0 = Math.max(0, Math.floor(left / T)), x1 = Math.min(m.w - 1, Math.ceil((left + hw * 2) / T)), y0 = Math.max(0, Math.floor(top / T)), y1 = Math.min(m.h - 1, Math.ceil((top + hh * 2) / T));
    // блики на воде
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.6;
    for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) if (m.tile[y * m.w + xx] === WATER && ((xx * 7 + y * 3) % 2 === 0)) { const ph = (tm * 0.6 + xx * 0.3 + y * 0.7) % 1; x.globalAlpha = Math.sin(ph * Math.PI); x.beginPath(); x.moveTo(xx * T + 10 + ph * 10, y * T + 20); x.quadraticCurveTo(xx * T + 16 + ph * 10, y * T + 16, xx * T + 22 + ph * 10, y * T + 20); x.stroke(); }
    x.globalAlpha = 1;
    // клады и метка нажатия
    if (m.loot) for (const l of m.loot) if (!(S.loot && S.loot[l.id]) && l.x >= x0 - 1 && l.x <= x1 + 1 && l.y >= y0 - 1 && l.y <= y1 + 1) { const k = 0.7 + 0.3 * Math.sin(tm * 5 + l.id); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.7 * k; x.drawImage(ART.glow, l.x * T + 4, l.y * T + 6, 40, 40); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.fillStyle = '#ffd04a'; x.strokeStyle = '#21121c'; x.lineWidth = 1.6; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * 0.785 + tm, rr = i % 2 ? 3 : 8 * k; x.lineTo(l.x * T + 24 + Math.cos(a) * rr, l.y * T + 26 + Math.sin(a) * rr); } x.closePath(); x.fill(); x.stroke(); }
    if (W.mark) { const k = Math.min(1, W.mark.t / 0.5); x.strokeStyle = W.mark.a ? '#ff4f7b' : '#ffffff'; x.lineWidth = 3; x.globalAlpha = W.path ? 0.9 : 1 - k; x.beginPath(); x.ellipse(W.mark.x, W.mark.y, 8 + 10 * (W.path ? 0.5 + 0.2 * Math.sin(tm * 8) : k), 4 + 5 * (W.path ? 0.5 + 0.2 * Math.sin(tm * 8) : k), 0, 0, 6.283); x.stroke(); x.globalAlpha = 1; }
    FX.critters(x, m, tm, G.dt || 0.016, false);
    // объекты по глубине
    const list = [];
    for (let ry = Math.max(0, y0 - 1); ry <= Math.min(m.rows.length - 1, y1 + 4); ry++) for (const o of m.rows[ry]) if (o.x <= x1 + 1 && o.x + (o.k === 'house' ? 4 : 1) >= x0 - 1) list.push(o);
    for (const n of m.npcs) if (n.x >= x0 - 1 && n.x <= x1 + 1 && n.y >= y0 - 1 && n.y <= y1 + 2) list.push({ k: 'npc', n, sy: (n.y + 1) * T - 6 });
    for (const w of W.wild || []) if (w.px > left - 60 && w.px < left + hw * 2 + 20 && w.py > top - 80 && w.py < top + hh * 2 + 40) list.push({ k: 'wild', w, sy: w.py + T - 7 });
    const lead = S.party[0];
    if (lead && S.flags.starter) list.push({ k: 'fol', sy: W.fol.py + T - 7 });
    list.push({ k: 'hero', sy: h.py + T - 6 });
    for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) if (m.tile[y * m.w + xx] === TALL) list.push({ k: 'tall', x: xx, y, sy: (y + 1) * T - 0.5 });
    list.sort((a, b) => a.sy - b.sy);
    for (const o of list) {
      if (o.k === 'tree') { x.save(); x.translate(o.x * T + 24, (o.y + 1) * T + 4); x.transform(1, 0, Math.sin(tm * 1.1 + o.x * 0.9 + o.y * 1.7) * 0.03 + Math.sin(tm * 2.7 + o.x) * 0.008, 1, 0, 0); x.drawImage(o.im, -36, -96, 72, 96); x.restore(); }
      else if (o.k === 'house') x.drawImage(o.im, o.x * T, o.y * T, 4 * T, 4 * T);
      else if (o.k === 'rock' || o.k === 'sign') x.drawImage(o.im, o.x * T, o.y * T, T, T);
      else if (o.k === 'prop') { x.drawImage(o.im, o.x * T, (o.y + 1) * T - T * 1.5, T, T * 1.5); if (o.pk === 'lamp' || o.pk === 'torch' || o.pk === 'fireplace') { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.35 + Math.sin(tm * 3 + o.x) * 0.05; x.drawImage(ART.glow, o.x * T - 16, (o.y + 1) * T - T * 1.5 - 4, 80, 60); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; } }
      else if (o.k === 'tall') { x.save(); x.translate(o.x * T, (o.y + 1) * T); x.transform(1, 0, Math.sin(tm * 2 + o.x * 0.7 + o.y) * 0.06, 1, 0, 0); x.drawImage(ART.tallFront, 0, -T * 0.62, T, T * 0.62); x.restore(); }
      else if (o.k === 'npc') {
        const n = o.n; x.save(); x.translate(n.x * T + T / 2, (n.y + 1) * T - 6);
        if (n.look === 'witch') { x.scale(0.38, 0.38); ART.girl(x, 'witch', { t: tm, chibi: true, expr: 'smug' }); }
        else if (n.girl) { const gg = S.party.concat(S.box).find(q => q.id === n.girl); x.scale(0.36, 0.36); ART.girl(x, n.girl, { t: tm + n.t, chibi: true, expr: gg && FX.sulky(gg) ? 'angry' : 'happy', outfit: gg && gg.outfit, bloom: gg && gg.bloom }); }
        else ART.person(x, n.look, n.face, 0, tm + n.t);
        x.restore();
        if (n.trainer && !S.flags[n.trainer] && Math.abs(n.x - S.x) + Math.abs(n.y - S.y) < 6) bubble(x, n.x * T + T / 2 + 10, n.y * T - 40 + Math.sin(tm * 4) * 2, '!');
      } else if (o.k === 'wild') {
        const w = o.w, it = (S.court && S.court[w.id]) || 0;
        x.save(); x.translate(w.px + T / 2, w.py + T - 7); if (w.f === 'left') x.scale(-1, 1); x.scale(0.36, 0.36); ART.girl(x, w.id, { t: tm + w.hx, chibi: true, walk: w.walk, expr: it > 50 ? 'love' : it > 0 ? 'happy' : 'smug' }); x.restore();
        const by = w.py - 34 + Math.sin(tm * 3 + w.hx) * 2; ART.heart(x, w.px + T / 2, by, 6, it > 0 ? '#ff4f7b' : '#ffffff');
        if (!S.seen[w.id]) { x.fillStyle = '#21121c'; x.font = '900 9px sans-serif'; x.textAlign = 'center'; x.fillText('?', w.px + T / 2, by + 2.5); }
      } else if (o.k === 'fol') { x.save(); x.translate(W.fol.px + T / 2, W.fol.py + T - 7); if (W.fol.face === 'left') x.scale(-1, 1); x.scale(0.36, 0.36); ART.girl(x, lead.id, { t: tm, chibi: true, walk: W.fol.walk, bloom: lead.bloom, outfit: lead.outfit, expr: lead.aff >= 75 ? 'happy' : 'normal' }); x.restore(); if (lead.aff >= 50 && Math.sin(tm * 1.3) > 0.97) heartFloat(x, W.fol.px + T / 2, W.fol.py - 30); }
      else if (o.k === 'hero') { x.save(); x.translate(h.px + T / 2, h.py + T - 6); ART.person(x, 'hero', S.face, h.mv ? h.walk : 0, tm); x.restore(); }
    }
    for (const g of m.gates || []) if (!S.flags[g.flag] && g.x >= x0 - 1 && g.x <= x1 + 1 && g.y >= y0 - 1 && g.y <= y1 + 1) { x.fillStyle = 'rgba(255,79,123,' + (0.25 + 0.12 * Math.sin(tm * 4)) + ')'; x.fillRect(g.x * T + 2, g.y * T + 2, T - 4, T - 4); x.strokeStyle = '#21121c'; x.lineWidth = 3; x.beginPath(); x.moveTo(g.x * T + 8, g.y * T + 8); x.lineTo(g.x * T + T - 8, g.y * T + T - 8); x.moveTo(g.x * T + T - 8, g.y * T + 8); x.lineTo(g.x * T + 8, g.y * T + T - 8); x.stroke(); }
    ambient(x, m, left, top, hw * 2, hh * 2, tm, G.dt || 0.016);
    FX.critters(x, m, tm, G.dt || 0.016, true);
    if (!m.def.indoor) { x.globalAlpha = 0.13; for (let i = 0; i < 3; i++) { const cx2 = left + ((i * 613 + tm * 14) % (hw * 2 + 900)) - 450, cy2 = top + ((i * 397 + tm * 4) % (hh * 2 + 300)) - 150; x.drawImage(ART.soft, cx2 - 220, cy2 - 120, 440, 240); } x.globalAlpha = 1; }
    x.setTransform(1, 0, 0, 1, 0, 0);
    const tint = { forest: 'rgba(10,60,40,.14)', mountain: 'rgba(160,200,255,.12)', tower: 'rgba(120,30,140,.16)', meadow: 'rgba(255,220,140,.06)', village: 'rgba(255,200,150,.06)', beach: 'rgba(255,230,160,.08)', swamp: 'rgba(40,70,30,.2)', dungeon: 'rgba(40,20,80,.3)', manor: 'rgba(255,200,170,.08)' }[W.zoneId()];
    if (tint) { x.fillStyle = tint; x.fillRect(0, 0, V.w, V.h); }
    FX.screenFx(x, V, m, tm);
    FX.lights(x, m, tm, z, left, top);
    x.drawImage(ART.vign, 0, 0, V.w, V.h);
    if (m.id === 'tower') { x.fillStyle = 'rgba(255,90,180,' + (0.06 + 0.04 * Math.sin(tm * 2)) + ')'; x.fillRect(0, 0, V.w, V.h); }
  };

  const AMB = [];
  function ambient(x, m, left, top, vw, vh, tm, dt) {
    const kind = { meadow: 'fly', village: 'petal', forest: 'firefly', mountain: 'snow', tower: 'spark', beach: 'fly', swamp: 'firefly', dungeon: 'spark', manor: 'petal' }[W.zoneId()];
    const want = kind === 'snow' ? 40 : kind === 'fly' ? 10 : 18;
    while (AMB.length < want) AMB.push({ x: left + Math.random() * vw, y: top + Math.random() * vh, ph: Math.random() * 6, c: U.pick(['#ffffff', '#ffd84a', '#ff9ac8', '#9ad8ff'], Math.random), s: 0.7 + Math.random() * 0.6 });
    if (AMB.length > want) AMB.length = want;
    for (const p of AMB) {
      p.ph += dt;
      if (kind === 'snow') { p.y += 26 * p.s * dt; p.x += Math.sin(p.ph * 1.3) * 12 * dt; }
      else if (kind === 'petal') { p.y += 14 * dt; p.x += (14 + Math.sin(p.ph) * 10) * dt; }
      else { p.x += Math.sin(p.ph * 0.9) * 22 * dt + Math.cos(p.ph * 0.4) * 8 * dt; p.y += Math.cos(p.ph * 1.2) * 16 * dt; }
      if (p.x < left - 20) p.x += vw + 40; else if (p.x > left + vw + 20) p.x -= vw + 40;
      if (p.y < top - 20) p.y += vh + 40; else if (p.y > top + vh + 20) p.y -= vh + 40;
      if (kind === 'fly') { const f = Math.abs(Math.sin(p.ph * 12)) * 4 + 1; x.fillStyle = '#21121c'; x.fillRect(p.x - 0.5, p.y - 2, 1, 4); x.fillStyle = p.c; x.beginPath(); x.ellipse(p.x - f / 2, p.y, f / 2 + 0.3, 3, 0, 0, 6.283); x.ellipse(p.x + f / 2, p.y, f / 2 + 0.3, 3, 0, 0, 6.283); x.fill(); }
      else if (kind === 'petal') { x.fillStyle = '#ffb0cc'; x.beginPath(); x.ellipse(p.x, p.y, 3.2, 1.8, p.ph * 2, 0, 6.283); x.fill(); }
      else if (kind === 'snow') { x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(p.x, p.y, 1.6 * p.s + 0.6, 0, 6.283); x.fill(); }
      else { const a = 0.4 + 0.6 * Math.abs(Math.sin(p.ph * 2)); x.globalCompositeOperation = 'lighter'; x.globalAlpha = a; x.drawImage(ART.glow, p.x - 7, p.y - 7, 14, 14); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.fillStyle = kind === 'spark' ? '#ffb0ff' : '#f4ff9a'; x.fillRect(p.x - 1, p.y - 1, 2, 2); }
    }
    for (const o of m.lights || m.objs) if (o.k === 'house' && (o.hk === 'elder' || o.hk === 'tavern' || o.hk === 'shop' || !o.hk && o.im !== ART.objs.house.manor)) { for (let i = 0; i < 4; i++) { const ph = (tm * 0.35 + i * 0.25) % 1, px = (o.x + 4) * T - 54 + Math.sin(tm + i) * 4 + ph * 12, py = o.y * T + 4 * T - 182 - ph * 50; x.globalAlpha = (1 - ph) * 0.5; x.fillStyle = '#e8e4f0'; x.beginPath(); x.arc(px, py, 5 + ph * 9, 0, 6.283); x.fill(); } x.globalAlpha = 1; }
  }
  function bubble(x, px, py, t) {
    x.fillStyle = '#fff'; x.strokeStyle = '#21121c'; x.lineWidth = 2; x.beginPath(); x.ellipse(px, py, 9, 11, 0, 0, 6.283); x.moveTo(px - 3, py + 9); x.lineTo(px - 7, py + 16); x.lineTo(px + 2, py + 10); x.fill(); x.stroke();
    x.fillStyle = '#e8243a'; x.font = '900 15px sans-serif'; x.textAlign = 'center'; x.fillText(t, px, py + 5.5);
  }
  function heartFloat(x, px, py) { ART.heart(x, px, py, 5, '#ff4f7b'); }
})();
