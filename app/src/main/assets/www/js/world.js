'use strict';
/* Мир: рельеф, чанки земли, ресурсы, постройки */
(function () {
  const T = G.TILE, WT = G.WT, W = G.WORLD, noise = G.noise, sstep = G.sstep;
  const HX = (G.HOME.tx + 0.5) * T, HY = (G.HOME.ty + 0.5) * T;
  const PONDS = [[48.5 * T, 29 * T, 4.6 * T], [15 * T, 54 * T, 5.5 * T], [58 * T, 60 * T, 3.4 * T], [20 * T, 14 * T, 3.8 * T]];
  const GC = 128, GN = Math.ceil(W / GC);
  G.GC = GC; G.GN = GN;

  // >0 — вода, около нуля — берег
  function waterV(x, y) {
    let m = -9;
    for (let i = 0; i < PONDS.length; i++) {
      const p = PONDS[i], dx = x - p[0], dy = y - p[1], v = 1 - Math.sqrt(dx * dx + dy * dy) / p[2];
      if (v > m) m = v;
    }
    if (m < -0.6) return m;
    return m + (noise(x / 95, y / 95) - 0.5) * 0.36;
  }
  function dirtV(x, y) {
    const dx = x - HX, dy = y - HY, d = Math.sqrt(dx * dx + dy * dy);
    return noise(x / 230 + 9, y / 230 + 4) * 0.7 + noise(x / 70, y / 70) * 0.3 + Math.max(0, 1 - d / (5.6 * T)) * 0.75;
  }
  // разбитое шоссе через всю карту
  function roadY(x) { return HY + 7.6 * T + Math.sin(x / 820) * 2.2 * T + Math.sin(x / 310 + 1) * 0.5 * T; }
  G.roadY = roadY;
  G.waterV = waterV;
  G.isWater = (x, y) => waterV(x, y) > 0.04;
  // 0 трава, 1 земля, 2 песок, 3 вода
  G.terrKind = function (x, y) {
    const w = waterV(x, y);
    if (w > 0.04) return 3; if (w > -0.14) return 2;
    if (Math.abs(y - roadY(x)) < 56) return 4;
    return dirtV(x, y) > 0.64 ? 1 : 0;
  };

  /* ---------- Чанки земли ---------- */
  const CH = 512, CR = 384, PX = 128;
  const chunks = new Map();
  let tmp, tctx, img;
  function genChunk(cx, cy) {
    if (!tmp) { tmp = document.createElement('canvas'); tmp.width = tmp.height = PX + 2; tctx = tmp.getContext('2d'); img = tctx.createImageData(PX + 2, PX + 2); }
    const d = img.data, step = CH / PX, ox = cx * CH, oy = cy * CH;
    let k = 0;
    for (let j = -1; j <= PX; j++) for (let i = -1; i <= PX; i++) {
      const x = ox + (i + 0.5) * step, y = oy + (j + 0.5) * step;
      const n1 = noise(x / 190, y / 190), n2 = noise(x / 13, y / 13), n3 = noise(x / 420 + 31, y / 420 + 17);
      const sh = 0.9 + n2 * 0.2;
      const pt = 0.8 + noise(x / 58 + 7, y / 58) * 0.36;
      let r = (74 - n1 * 20 + n3 * 30) * sh * pt, g = (86 - n1 * 18 + n3 * 10) * sh * pt, b = (48 - n1 * 10 - n3 * 8) * sh * pt;
      const dv = sstep(0.58, 0.7, dirtV(x, y));
      if (dv > 0) { const m = 0.88 + n2 * 0.24; r += (88 * m - r) * dv; g += (74 * m - g) * dv; b += (58 * m - b) * dv; }
      const ra = Math.abs(y - roadY(x));
      if (ra < 74) {
        const s2 = 1 - sstep(48, 72, ra), m = 0.8 + n2 * 0.26 + (noise(x / 44, y / 44) - 0.5) * 0.3;
        let ar = 58 * m, ag = 58 * m, ab = 57 * m;
        r += (ar - r) * s2; g += (ag - g) * s2; b += (ab - b) * s2;
      }
      const w = waterV(x, y);
      if (w > -0.24) {
        const s = sstep(-0.24, -0.1, w), m = 0.94 + n2 * 0.12;
        r += (146 * m - r) * s; g += (134 * m - g) * s; b += (106 * m - b) * s;
        if (w > -0.02) {
          const wet = sstep(-0.02, 0.04, w); r -= 34 * wet; g -= 26 * wet; b -= 14 * wet;
          if (w > 0.04) {
            const dp = sstep(0.04, 0.42, w), rip = noise(x / 22, y / 9) * 14;
            r = 62 - dp * 40 + rip * 0.3; g = 92 - dp * 46 + rip * 0.7; b = 96 - dp * 36 + rip * 0.8;
            const fo = Math.max(0, 1 - Math.abs(w - 0.062) / 0.03); r += 70 * fo; g += 62 * fo; b += 56 * fo;
          }
        }
      }
      d[k++] = r; d[k++] = g; d[k++] = b; d[k++] = 255;
    }
    tctx.putImageData(img, 0, 0);
    const c = document.createElement('canvas'); c.width = c.height = CR;
    const x = c.getContext('2d', { alpha: false });
    x.imageSmoothingQuality = 'high';
    x.drawImage(tmp, 1, 1, PX, PX, 0, 0, CR, CR);
    // детали
    const s = CR / CH, rng = G.rng(cx * 7919 + cy * 104729 + 5);
    x.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    // разметка шоссе: выцветшие штрихи вдоль кривой дороги
    for (let dx = Math.floor(ox / 110) * 110 - 110; dx < ox + CH; dx += 110) {
      const y0 = roadY(dx), y1 = roadY(dx + 56);
      if (y1 < oy - 80 || y0 > oy + CH + 80 || G.isWater(dx, y0)) continue;
      if (noise(dx / 36, 3.3) > 0.3) { x.strokeStyle = 'rgba(170,156,104,' + (0.35 + noise(dx / 20, 1.7) * 0.45) + ')'; x.lineWidth = 4.5; x.beginPath(); x.moveTo(dx, y0); x.lineTo(dx + 56, y1); x.stroke(); }
      x.strokeStyle = 'rgba(160,158,146,.28)'; x.lineWidth = 3;
      for (const k of [-46, 46]) if (noise(dx / 50, 8.1 + k) > 0.4) { x.beginPath(); x.moveTo(dx, y0 + k); x.lineTo(dx + 110, roadY(dx + 110) + k); x.stroke(); }
    }
    const cols = ['#2f3d24', '#5a6638', '#7a7d4a'], paths = [new Path2D(), new Path2D(), new Path2D()];
    const flowers = [];
    for (let i = 0; i < 300; i++) {
      const px = ox + rng() * CH, py = oy + rng() * CH, kind = G.terrKind(px, py), q = rng();
      if (kind === 0) {
        if (q < 0.86) { const p = paths[(rng() * 3) | 0], h = 6 + rng() * 6; p.moveTo(px - 3.5, py - h * 0.75); p.lineTo(px, py); p.lineTo(px, py - h); p.moveTo(px, py); p.lineTo(px + 3.5, py - h * 0.75); }
        else flowers.push(px, py, (rng() * 3) | 0);
      } else if (kind === 1) {
        if (q < 0.25) { x.fillStyle = 'rgba(70,52,34,.5)'; x.beginPath(); x.ellipse(px, py, 2 + rng() * 3, 1.5 + rng() * 2, 0, 0, 7); x.fill(); }
        else if (q < 0.33) { x.fillStyle = '#9da3a8'; x.beginPath(); x.ellipse(px, py, 3.5, 2.5, 0, 0, 7); x.fill(); }
      } else if (kind === 4) {
        if (q < 0.16) { x.strokeStyle = 'rgba(12,12,11,.75)'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(px, py); let ax = px, ay = py; for (let n = 0; n < 4; n++) { ax += (rng() - 0.5) * 34; ay += (rng() - 0.5) * 22; x.lineTo(ax, ay); } x.stroke(); }
        else if (q < 0.24) { const p = paths[(rng() * 3) | 0]; p.moveTo(px - 3, py - 5); p.lineTo(px, py); p.lineTo(px, py - 7); p.moveTo(px, py); p.lineTo(px + 3, py - 5); }
        else if (q < 0.3) { x.fillStyle = 'rgba(20,20,18,.5)'; x.beginPath(); x.ellipse(px, py, 5 + rng() * 9, 3 + rng() * 5, rng() * 3, 0, 7); x.fill(); }
      } else if (kind === 2) {
        if (q < 0.3) { x.fillStyle = 'rgba(150,130,90,.6)'; x.fillRect(px, py, 2, 2); }
        else if (q < 0.34) { x.fillStyle = '#eee7d3'; x.beginPath(); x.ellipse(px, py, 3, 2, rng() * 3, 0, 7); x.fill(); }
      }
    }
    x.lineWidth = 1.7; x.lineCap = 'round';
    for (let i = 0; i < 3; i++) { x.strokeStyle = cols[i]; x.globalAlpha = 0.75; x.stroke(paths[i]); }
    x.globalAlpha = 1;
    // сухие листья и ветки вместо цветов
    const fc = ['rgba(120,84,40,.8)', 'rgba(92,60,30,.8)', 'rgba(140,116,60,.7)'];
    for (let i = 0; i < flowers.length; i += 3) {
      const px = flowers[i], py = flowers[i + 1];
      x.fillStyle = fc[flowers[i + 2]];
      for (let a = 0; a < 3; a++) { x.beginPath(); x.ellipse(px + (a - 1) * 6, py + ((a * 7) % 5) - 2, 3, 1.6, a * 1.3 + px, 0, 7); x.fill(); }
    }
    return c;
  }
  G.CH = CH;
  G.getChunk = function (cx, cy, make) {
    const key = cx * 1000 + cy;
    let c = chunks.get(key);
    if (!c && make) {
      if (chunks.size > 42) {  // выбрасываем самый дальний
        let far = -1, fk = 0;
        for (const k of chunks.keys()) { const dx = Math.floor(k / 1000) - cx, dy = k % 1000 - cy, dd = dx * dx + dy * dy; if (dd > far) { far = dd; fk = k; } }
        chunks.delete(fk);
      }
      c = genChunk(cx, cy); chunks.set(key, c);
    }
    return c;
  };

  /* ---------- Виды ресурсов ---------- */
  // r — радиус столкновения, ir — радиус взаимодействия
  G.KIND = {
    pine:   { r: 12, ir: 16, hp: 6, tool: 'axe', drop: 'wood', bonus: 2, re: 260, tree: 1, xp: 3 },
    oak:    { r: 14, ir: 18, hp: 8, tool: 'axe', drop: 'wood', bonus: 2, re: 300, tree: 1, xp: 4 },
    birch:  { r: 11, ir: 15, hp: 5, tool: 'axe', drop: 'wood', bonus: 1, re: 240, tree: 1, xp: 3 },
    rock:   { r: 25, ir: 28, hp: 8, tool: 'pick', drop: 'stone', bonus: 2, re: 320, xp: 4 },
    ore:    { r: 25, ir: 28, hp: 10, tool: 'pick', need: 1, drop: 'ore', bonus: 1, re: 480, xp: 7 },
    bush:   { r: 0, ir: 20, pick: ['berries', 2, 4], re: 170, xp: 2 },
    fiber:  { r: 0, ir: 14, pick: ['fiber', 2, 3], re: 140, xp: 1 },
    stick:  { r: 0, ir: 14, pick: ['stick', 1, 2], re: 200, xp: 1 },
    pebble: { r: 0, ir: 14, pick: ['stone', 1, 2], re: 220, xp: 1 },
    crate:  { r: 18, ir: 22, loot: 1, re: 900, xp: 10 },
    car:    { r: 34, ir: 44, loot: 1, re: 1500, xp: 18, keep: 1 }
  };

  let objs, grid;
  function gi(x, y) { return G.clamp((y / GC) | 0, 0, GN - 1) * GN + G.clamp((x / GC) | 0, 0, GN - 1); }
  function freeAt(x, y, minD) {
    const cx = (x / GC) | 0, cy = (y / GC) | 0;
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      if (i < 0 || j < 0 || i >= GN || j >= GN) continue;
      const l = grid[j * GN + i];
      for (let k = 0; k < l.length; k++) { const o = objs[l[k]], dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy < minD * minD) return false; }
    }
    return true;
  }
  function put(k, x, y, v) {
    const K = G.KIND[k];
    const o = { dk: 0, k, K, x, y, sy: y, v, hp: K.hp || 1, a: true, t: 0, hit: 0, fall: 1, i: objs.length };
    objs.push(o); grid[gi(x, y)].push(o.i);
    return o;
  }

  G.genWorld = function (seed) {
    const rng = G.rng(seed);
    objs = G.objs = []; grid = G.grid = [];
    for (let i = 0; i < GN * GN; i++) grid.push([]);
    G.cells = new Array(WT * WT).fill(null);
    G.floors = new Uint8Array(WT * WT);
    G.fires = [];
    const B = 2.6 * T, v3 = () => (rng() * 3) | 0;
    const homeD = (x, y) => Math.hypot(x - HX, y - HY);
    // плотная кромка леса по границе мира
    for (let y = 30; y < W; y += 46) for (let x = 30; x < W; x += 46) {
      if (x > B && x < W - B && y > B && y < W - B) continue;
      const px = x + (rng() - 0.5) * 26, py = y + (rng() - 0.5) * 26;
      if (!G.isWater(px, py)) put(rng() < 0.75 ? 'pine' : 'oak', px, py, v3());
    }
    const inPlay = (x, y) => x > B + 20 && x < W - B - 20 && y > B + 20 && y < W - B - 20;
    function scatter(n, fn) {
      for (let i = 0; i < n; i++) { const x = B + rng() * (W - 2 * B), y = B + rng() * (W - 2 * B); if (inPlay(x, y)) fn(x, y, G.terrKind(x, y), homeD(x, y)); }
    }
    // лес
    scatter(2600, (x, y, tk, hd) => {
      if (tk > 1 || hd < 6.6 * T) return;
      const f = noise(x / 300 + 3, y / 300 + 8);
      if (f < 0.42 + (tk === 1 ? 0.2 : 0)) return;
      if (!freeAt(x, y, 74)) return;
      const q = rng(), k = f > 0.62 ? (q < 0.7 ? 'pine' : q < 0.9 ? 'oak' : 'birch') : (q < 0.3 ? 'pine' : q < 0.65 ? 'oak' : 'birch');
      put(k, x, y, v3());
    });
    scatter(260, (x, y, tk, hd) => { if (tk <= 1 && hd > 5.5 * T && freeAt(x, y, 110)) put('rock', x, y, v3()); });
    scatter(160, (x, y, tk, hd) => { if (tk <= 1 && hd > 13 * T && noise(x / 200 + 50, y / 200) > 0.55 && freeAt(x, y, 100)) put('ore', x, y, v3()); });
    scatter(240, (x, y, tk, hd) => { if (tk === 0 && hd > 5 * T && freeAt(x, y, 70)) put('bush', x, y, v3()); });
    scatter(520, (x, y, tk, hd) => { if (tk === 0 && hd > 3.8 * T && freeAt(x, y, 54)) put('fiber', x, y, v3()); });
    scatter(300, (x, y, tk, hd) => { if (tk <= 1 && hd > 3.8 * T && freeAt(x, y, 50)) put('stick', x, y, v3()); });
    scatter(240, (x, y, tk, hd) => { if (tk <= 2 && hd > 3.8 * T && freeAt(x, y, 50)) put('pebble', x, y, v3()); });
    scatter(60, (x, y, tk, hd) => { if (tk <= 1 && hd > 12 * T && freeAt(x, y, 300)) put('crate', x, y, 0); });
    scatter(70, (x, y, tk, hd) => { if (tk <= 1 && hd > 9 * T && freeAt(x, y, 520)) put('car', x, y, v3()); });
    for (let i = 0; i < 14; i++) { const x = B + 120 + rng() * (W - 2 * B - 240), y = roadY(x) + (rng() - 0.5) * 56; if (!G.isWater(x, y) && G.terrKind(x, y) === 4 && freeAt(x, y, 300)) put('car', x, y, v3()); }
    { const x = HX + 5.2 * T, y = roadY(x) - 8; if (freeAt(x, y, 120)) put('car', x, y, 0); }
    // гарантированный старт возле дома
    const near = [['stick', -3.2, 3.4], ['stick', 2.6, 4.2], ['stick', -1.2, 5.3], ['pebble', 3.9, 2.2], ['pebble', -4.4, 1.2], ['pebble', 1.4, 5.6],
      ['fiber', -4.6, 3.6], ['fiber', 4.6, 4.4], ['fiber', 0.2, 6.2], ['bush', -5.4, -1.6], ['bush', 5.6, 0.4], ['pine', -6.2, 4.6], ['oak', 6.4, 4.2], ['birch', -5.6, -4.6], ['rock', 5.4, -3.6], ['pine', 3.6, 6.8]];
    for (const n of near) { const x = HX + n[1] * T, y = HY + n[2] * T; if (freeAt(x, y, 40)) put(n[0], x, y, v3()); }
    G.objs = objs;
  };

  /* ---------- Постройки ---------- */
  const SOLID = { wall: 1, door: 1, chest: 1, workbench: 1, bed: 1, campfire: 1 };
  G.addStruct = function (k, tx, ty, extra) {
    if (k === 'floor') { G.floors[ty * WT + tx] = 1; return null; }
    const s = { dk: 1, k, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, sy: (ty + 1) * T - (k === 'campfire' ? 26 : 0), solid: !!SOLID[k] };
    if (k === 'chest') s.inv = (extra && extra.inv) || new Array(12).fill(null);
    if (k === 'campfire') G.fires.push(s);
    G.cells[ty * WT + tx] = s;
    return s;
  };
  G.removeStruct = function (tx, ty) {
    const i = ty * WT + tx, s = G.cells[i];
    if (s) { G.cells[i] = null; if (s.k === 'campfire') G.fires.splice(G.fires.indexOf(s), 1); return s.k; }
    if (G.floors[i]) { G.floors[i] = 0; return 'floor'; }
    return null;
  };
  G.canBuild = function (k, tx, ty) {
    if (tx < 3 || ty < 3 || tx >= WT - 3 || ty >= WT - 3) return false;
    const i = ty * WT + tx, cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
    if (G.isWater(cx, cy) || G.isWater(cx - 28, cy - 28) || G.isWater(cx + 28, cy + 28)) return false;
    if (k === 'floor') { if (G.floors[i]) return false; }
    else if (G.cells[i]) return false;
    // ресурсы в клетке мешают
    const gx = (cx / GC) | 0, gy = (cy / GC) | 0;
    for (let j = gy - 1; j <= gy + 1; j++) for (let ii = gx - 1; ii <= gx + 1; ii++) {
      if (ii < 0 || j < 0 || ii >= GN || j >= GN) continue;
      const l = grid[j * GN + ii];
      for (let n = 0; n < l.length; n++) { const o = objs[l[n]]; if ((o.a || o.K.keep) && Math.abs(o.x - cx) < 34 + o.K.r * 0.5 && Math.abs(o.y - cy) < 34 + o.K.r * 0.5) return false; }
    }
    return true;
  };
  G.buildHome = function () {
    const hx = G.HOME.tx, hy = G.HOME.ty;
    for (let ty = hy - 3; ty <= hy + 1; ty++) for (let tx = hx - 3; tx <= hx + 2; tx++) {
      G.addStruct('floor', tx, ty);
      const edge = ty === hy - 3 || ty === hy + 1 || tx === hx - 3 || tx === hx + 2;
      if (edge) G.addStruct(tx === hx - 1 && ty === hy + 1 ? 'door' : 'wall', tx, ty);
    }
    G.addStruct('bed', hx - 2, hy - 2);
    const c = G.addStruct('chest', hx + 1, hy - 2);
    G.Inv.add(c.inv, 'canned', 2); G.Inv.add(c.inv, 'bandage', 1); G.Inv.add(c.inv, 'flask_full', 1); G.Inv.add(c.inv, 'cloth', 2);
    G.addStruct('campfire', hx, hy + 4);
  };
  G.spawnPoint = () => ({ x: (G.HOME.tx - 0.5) * T, y: (G.HOME.ty + 2.6) * T });

  /* ---------- Мини-карта ---------- */
  G.makeMinimap = function () {
    const n = 144, c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'), im = x.createImageData(n, n), d = im.data, s = W / n;
    const col = [[70, 84, 50], [92, 78, 60], [146, 134, 106], [44, 74, 84], [52, 52, 50]];
    for (let j = 0, k = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c4 = col[G.terrKind((i + 0.5) * s, (j + 0.5) * s)];
      d[k++] = c4[0]; d[k++] = c4[1]; d[k++] = c4[2]; d[k++] = 255;
    }
    x.putImageData(im, 0, 0);
    for (const o of objs) {
      if (o.K.tree) { x.fillStyle = 'rgba(22,40,28,.8)'; x.fillRect(o.x / s - 1, o.y / s - 1, 2.4, 2.4); }
      else if (o.k === 'rock' || o.k === 'ore') { x.fillStyle = o.k === 'ore' ? '#c8742e' : '#9aa0a6'; x.fillRect(o.x / s - 0.8, o.y / s - 0.8, 1.8, 1.8); }
    }
    G.mapBase = c;
  };
})();
