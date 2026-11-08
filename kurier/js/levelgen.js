/* Курьер миров — сборщик уровней.
   Уровень складывается из участков: пропасть, ступени, платформы, шипы, враги, движущиеся плиты,
   батуты, лёд, конвейеры, шахты для прыжков от стен. Каждый участок построен так, чтобы
   его можно было пройти с теми способностями, которые у героя уже есть в этом мире.
   Зерно постоянное, поэтому уровень 3-2 всегда один и тот же. */
(function () {
  'use strict';
  const K = window.K;
  const T = (K.T = { EMPTY: 0, GROUND: 1, BLOCK: 2, PLAT: 3, SPIKE: 4, HAZARD: 5, ICE: 6, BOUNCE: 7, CRUMBLE: 8, CONV_L: 9, CONV_R: 10, BREAK: 11 });
  K.TILE = 32;
  K.ROWS = 17;

  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngFrom(seed) {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
  }
  K.rngFrom = rngFrom;
  K.hash = hash;

  function generate(wid, stage) {
    const world = K.worldById(wid);
    if (K.isBoss(wid, stage)) return arena(world);
    const H = K.ROWS;
    const W0 = world.len[stage - 1] || world.len[world.len.length - 1];
    const W = W0 + 60; // запас: последний участок и финиш не должны обрезаться
    const rng = rngFrom(hash(`kurier:${wid}-${stage}`));
    const ab = K.abilitiesFor(wid);
    const d = Math.min(1, (wid - 1 + (stage - 1) / world.levels) / 6.5);
    const tiles = new Uint8Array(W * H);
    const ents = [];
    const top = new Int16Array(W).fill(-1); // верх земли в каждой колонке (для проверок)
    let x = 0, gy = 13, lastCp = 0, shardsPlaced = 0, prev = '', prev2 = '';
    const signed = {};
    const hz = world.hazard === 'water' || world.hazard === 'lava' || world.hazard === 'void';

    const set = (cx, cy, v) => { if (cx >= 0 && cx < W && cy >= 0 && cy < H) tiles[cy * W + cx] = v; };
    const get = (cx, cy) => (cx >= 0 && cx < W && cy >= 0 && cy < H ? tiles[cy * W + cx] : T.EMPTY);
    const ground = (cx, gyy, surf) => { for (let y = gyy; y < H; y++) set(cx, y, y === gyy && surf ? surf : T.GROUND); top[cx] = gyy; };
    const pit = (cx) => { if (hz) { set(cx, H - 1, T.HAZARD); set(cx, H - 2, T.HAZARD); } top[cx] = -1; };
    const flat = (n, surf) => { for (let i = 0; i < n && x < W; i++) ground(x++, gy, surf); };
    const coin = (cx, cy) => ents.push({ t: 'coin', x: cx, y: cy });
    const coinLine = (x0, n, cy) => { for (let i = 0; i < n; i++) coin(x0 + i, cy); };
    const coinArc = (x0, x1, cy) => { const n = x1 - x0 + 1; for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) : 0.5; coin(x0 + i, cy - Math.round(Math.sin(k * Math.PI) * 2)); } };
    const enemy = (kind, cx, cy, extra) => ents.push(Object.assign({ t: 'enemy', kind, skin: world.enemies[kind === 'charge' ? 'walk' : kind] || world.enemies.walk, x: cx, y: cy }, extra || {}));
    const sign = (key, text, cx) => { if (signed[key]) return; signed[key] = 1; ents.push({ t: 'sign', x: cx, y: gy - 1, text }); };
    const clampGy = (v) => Math.max(6, Math.min(14, v));

    const seg = {
      flat() {
        const n = rng.int(4, 8), x0 = x;
        flat(n);
        if (rng.chance(0.5)) coinLine(x0 + 1, Math.min(4, n - 2), gy - 2);
        if (rng.chance(0.08)) ents.push({ t: 'heart', x: x0 + 2, y: gy - 1 });
      },
      step() {
        let dlt = rng.pick([-2, -1, 1, 2]);
        if (gy <= 9) dlt = Math.abs(dlt);
        if (gy >= 13) dlt = -Math.abs(dlt);
        gy = clampGy(gy + dlt);
        const x0 = x;
        flat(rng.int(3, 6));
        if (rng.chance(0.4)) coinLine(x0 + 1, 2, gy - 2);
      },
      gap() {
        const maxG = 3 + (d > 0.45 ? 1 : 0);
        const g = rng.int(2, maxG);
        let gy2 = g >= 4 ? gy + rng.pick([0, 0, 1]) : clampGy(gy + rng.pick([0, 0, 1, -1]));
        if (gy2 > 14) gy2 = 14;
        const x0 = x;
        for (let i = 0; i < g; i++) pit(x++);
        coinArc(x0, x - 1, Math.min(gy, gy2) - 3);
        gy = gy2;
        flat(rng.int(3, 5));
      },
      platforms() {
        ground(x++, gy);
        const plats = [];
        let px = x + rng.int(0, 1), py = gy - rng.int(1, 3);
        const k = rng.int(2, 3);
        for (let i = 0; i < k; i++) {
          const pw = rng.int(2, 3);
          plats.push([px, Math.max(5, py), pw]);
          px += pw + rng.int(1, 2);
          py = Math.max(5, Math.min(gy + 1, py + rng.int(-2, 2)));
        }
        const last = plats[plats.length - 1];
        const end = last[0] + last[2] + rng.int(1, 2);
        while (x < end) pit(x++);
        for (const [ppx, ppy, pw] of plats) { for (let i = 0; i < pw; i++) set(ppx + i, ppy, T.PLAT); if (rng.chance(0.6)) coinLine(ppx, pw, ppy - 1); }
        gy = clampGy(last[1] + rng.int(0, 1));
        flat(rng.int(3, 5));
      },
      spikes() {
        flat(2);
        const n = rng.int(2, 3) + (d > 0.6 ? 1 : 0), x0 = x;
        flat(n);
        for (let i = 0; i < n; i++) set(x0 + i, gy - 1, T.SPIKE);
        coinArc(x0, x0 + n - 1, gy - 3);
        flat(2);
      },
      enemies() {
        const n = rng.int(8, 12), x0 = x;
        flat(n);
        const cnt = 1 + (rng.chance(0.3 + d * 0.5) ? 1 : 0);
        enemy('walk', x0 + Math.floor(n / 2), gy - 1);
        if (cnt > 1) {
          const kind = rng.pick(['fly', 'jump', 'walk']);
          enemy(kind, x0 + n - 2, kind === 'fly' ? gy - 4 : gy - 1);
        }
        if (rng.chance(0.4)) coinLine(x0 + 2, 3, gy - 3);
      },
      pillars() {
        const k = rng.int(2, 3);
        for (let i = 0; i < k; i++) {
          const ph = rng.int(1, 3), x0 = x;
          for (let j = 0; j < 2; j++) { ground(x, gy); for (let y = gy - ph; y < gy; y++) set(x, y, T.BLOCK); top[x] = gy - ph; x++; }
          if (rng.chance(0.5)) coinLine(x0, 2, gy - ph - 1);
          const between = rng.int(1, 2);
          for (let j = 0; j < between; j++) { if (hz && rng.chance(0.5)) pit(x++); else ground(x++, gy); }
        }
        flat(2);
      },
      moving() {
        const x0 = x;
        if (rng.chance(0.65) || gy < 10) {
          const pw = rng.int(8, 10);
          for (let i = 0; i < pw; i++) pit(x++);
          ents.push({ t: 'mover', x: x0 + 1, y: gy, w: 3, axis: 'x', range: pw - 5, speed: 1.1 + d * 0.6 });
          coinLine(x0 + 3, pw - 6, gy - 3);
          flat(rng.int(3, 4));
        } else {
          const pw = 5;
          for (let i = 0; i < pw; i++) pit(x++);
          const up = 4;
          ents.push({ t: 'mover', x: x0 + 1, y: gy - 1, w: 3, axis: 'y', range: up, speed: 1 });
          gy = gy - up;
          flat(rng.int(4, 5));
        }
      },
      crumble() {
        const n = rng.int(5, 7), x0 = x;
        for (let i = 0; i < n; i++) { pit(x); set(x, gy, T.CRUMBLE); top[x] = gy; x++; }
        coinLine(x0 + 1, n - 2, gy - 2);
        flat(3);
      },
      shooter() {
        const x0 = x;
        flat(8);
        for (let y = gy - 2; y < gy; y++) { set(x0 + 5, y, T.BLOCK); set(x0 + 6, y, T.BLOCK); }
        top[x0 + 5] = top[x0 + 6] = gy - 2;
        enemy('shoot', x0 + 5, gy - 3);
      },
      charger() {
        const x0 = x;
        flat(12);
        enemy('charge', x0 + 10, gy - 1);
      },
      bounce() {
        if (gy - 6 < 6) { gy = clampGy(gy + 3); }
        const h = rng.int(5, 6), x0 = x;
        flat(3);
        ground(x++, gy, T.BOUNCE);
        flat(1);
        gy = gy - h;
        for (let i = 0; i < 2; i++) ground(x++, gy);
        coinLine(x0 + 3, 1, gy - 2);
        flat(rng.int(3, 4));
        sign('bounce', 'Прыгай на гриб-батут', x0 + 1);
      },
      djwall() {
        if (gy - 5 < 6) gy = clampGy(gy + 3);
        const h = rng.int(4, 5), x0 = x;
        flat(3);
        gy -= h;
        flat(rng.int(4, 6));
        coin(x0 + 3, gy - 2);
        sign('dj', 'Двойной прыжок: прыжок ещё раз в воздухе', x0);
      },
      dashgap() {
        const x0 = x;
        flat(3);
        const g = 6;
        for (let i = 0; i < g; i++) pit(x++);
        coinLine(x0 + 4, g - 2, gy - 2);
        flat(4);
        sign('dash', 'Рывок: Shift или X. Прыгни и сделай рывок', x0);
      },
      walljump() {
        if (gy - 6 < 5) gy = clampGy(gy + 3);
        const h = rng.int(5, 6), x0 = x;
        flat(2);
        // шахта: висячая левая стена, справа скала
        const shaftL = x;
        for (let i = 0; i < 3; i++) ground(x++, gy);
        for (let y = gy - h - 1; y <= gy - 3; y++) set(shaftL, y, T.BLOCK);
        top[shaftL] = gy;
        const hi = gy - h;
        gy = hi;
        flat(rng.int(4, 5));
        coin(shaftL + 1, hi);
        sign('wall', 'Прыжок от стены: в прыжке прижмись к стене и жми прыжок', x0);
      },
      ice() {
        const n = rng.int(10, 14), x0 = x;
        flat(n, T.ICE);
        if (rng.chance(0.5)) enemy('walk', x0 + Math.floor(n / 2), gy - 1);
        coinLine(x0 + 2, 4, gy - 2);
        if (rng.chance(0.6)) { const g = rng.int(2, 3); for (let i = 0; i < g; i++) pit(x++); flat(3); }
      },
      icicles() {
        const x0 = x;
        flat(11);
        for (let i = 1; i < 10; i++) set(x0 + i, gy - 6, T.BLOCK);
        for (const k of [2, 5, 8]) ents.push({ t: 'icicle', x: x0 + k, y: gy - 5 });
      },
      breakable() {
        const x0 = x;
        flat(3);
        for (let i = 0; i < 6; i++) { ground(x, gy); set(x, gy - 6, T.BLOCK); x++; }
        for (let y = gy - 5; y < gy; y++) { set(x0 + 4, y, T.BREAK); set(x0 + 5, y, T.BREAK); }
        coin(x0 + 7, gy - 2);
        flat(2);
        sign('break', ab.fire ? 'Ледяную стену растопит огненный шар (C) или пробьёт рывок' : 'Стену можно пробить рывком', x0);
      },
      conveyor() {
        const n = rng.int(9, 12), x0 = x;
        flat(n, rng.chance(0.5) ? T.CONV_L : T.CONV_R);
        if (rng.chance(0.5)) enemy('walk', x0 + n - 3, gy - 1);
        coinLine(x0 + 2, 3, gy - 2);
      },
      firejet() {
        const x0 = x;
        flat(12);
        [3, 6, 9].forEach((k, i) => ents.push({ t: 'firejet', x: x0 + k, y: gy - 1, phase: i * 50 }));
      },
      hazardpit() {
        const n = rng.int(9, 12), x0 = x;
        for (let i = 0; i < n; i++) pit(x++);
        let c = x0 + rng.int(2, 3);
        while (c < x0 + n - 2) {
          const w = rng.int(1, 2), ry = clampGy(gy + rng.int(-1, 1));
          for (let i = 0; i < w; i++) { for (let y = ry; y < K.ROWS - 2; y++) set(c + i, y, T.BLOCK); top[c + i] = ry; if (rng.chance(0.5)) coin(c + i, ry - 1); }
          c += w + rng.int(2, 3);
        }
        flat(3);
      },
      checkpoint() {
        const x0 = x;
        flat(4);
        ents.push({ t: 'flag', x: x0 + 1, y: gy - 1 });
        lastCp = x0;
      },
      shard() {
        const kind = rng.pick(gy >= 10 ? ['high', 'spikes', 'dip'] : ['spikes', 'dip']);
        const x0 = x;
        if (kind === 'high') {
          flat(7);
          for (let i = 0; i < 2; i++) { set(x0 + 1 + i, gy - 3, T.PLAT); set(x0 + 3 + i, gy - 6, T.PLAT); }
          ents.push({ t: 'shard', x: x0 + 4, y: gy - 8 });
          coin(x0 + 2, gy - 4);
        } else if (kind === 'spikes') {
          flat(2);
          const s = x;
          flat(3);
          for (let i = 0; i < 3; i++) set(s + i, gy - 1, T.SPIKE);
          ents.push({ t: 'shard', x: s + 1, y: gy - 3 });
          flat(2);
        } else {
          flat(2);
          const deep = Math.min(14, gy + 3), s = x;
          for (let i = 0; i < 5; i++) ground(x++, deep);
          ents.push({ t: 'shard', x: s + 2, y: deep - 1 });
          enemy('walk', s + 3, deep - 1);
          flat(3);
        }
        shardsPlaced++;
      },
    };

    // Начало: стена слева и ровная площадка.
    for (let y = 0; y < H; y++) set(0, y, T.BLOCK);
    top[0] = 0;
    x = 1;
    flat(7);
    const start = { x: 3, y: gy - 1 };

    // Первый уровень — обучение по сценарию.
    if (wid === 1 && stage === 1) {
      const tip = (cx, text) => ents.push({ t: 'sign', x: cx, y: top[cx] - 1, text });
      tip(5, K.TUTORIAL[0]);
      flat(4); gy -= 1; flat(5);
      tip(x - 2, K.TUTORIAL[1]);
      for (let i = 0; i < 2; i++) pit(x++);
      coinArc(x - 2, x - 1, gy - 3); flat(6);
      const ex = x; flat(10); enemy('walk', ex + 7, gy - 1); tip(ex + 1, K.TUTORIAL[2]);
      flat(4); tip(x, K.TUTORIAL[3]); flat(2); seg.checkpoint(); flat(6); gy = 12; flat(4); seg.gap();
      flat(2); tip(x - 1, K.TUTORIAL[4]); seg.shard();
    }

    const weights = Object.assign({}, world.seg);
    const need = { dashgap: 'dash', djwall: 'double', walljump: 'wall', breakable: null };
    for (const k of Object.keys(weights)) {
      if (need[k] && !ab[need[k]]) delete weights[k];
      if (k === 'breakable' && !(ab.fire || ab.dash)) delete weights[k];
    }
    const keys = Object.keys(weights);
    const pickSeg = () => {
      let tot = 0;
      for (const k of keys) tot += (k === prev && k === prev2) ? 0 : weights[k] * (k === 'enemies' ? 1 + d : 1);
      let r = rng.next() * tot;
      for (const k of keys) { const w = (k === prev && k === prev2) ? 0 : weights[k] * (k === 'enemies' ? 1 + d : 1); r -= w; if (r <= 0) return k; }
      return keys[0];
    };

    const shardAt = [0.28, 0.55, 0.8].map((k) => k * W0 / W);
    while (x < W0 - 22) {
      if (shardsPlaced < 3 && x > W * shardAt[shardsPlaced] && gy >= 8) { seg.shard(); continue; }
      if (x - lastCp > 62) { seg.checkpoint(); continue; }
      const k = pickSeg();
      prev2 = prev; prev = k;
      seg[k]();
      if (rng.chance(0.15)) seg.flat();
    }
    while (shardsPlaced < 3) seg.shard();
    // Финиш: ровная площадка, портал, стена справа.
    if (gy < 9) { gy = 12; }
    flat(6);
    const px = x;
    flat(8);
    ents.push({ t: 'portal', x: px + 3, y: gy - 1 });
    const realW = Math.min(W, x + 1);
    for (let y = 0; y < H; y++) set(realW - 1, y, T.BLOCK);

    let shardI = 0;
    ents.forEach((e) => { if (e.t === 'shard') e.i = shardI++; });
    const total = ents.filter((e) => e.t === 'coin').length;
    // обрезаем лишнюю ширину
    const out = new Uint8Array(realW * H);
    for (let y = 0; y < H; y++) for (let cx = 0; cx < realW; cx++) out[y * realW + cx] = tiles[y * W + cx];
    return { id: K.stageId(wid, stage), world: wid, stage, w: realW, h: H, tiles: out, ents, start, totalCoins: total, boss: false, top: Array.from(top.slice(0, realW)), abilities: ab };
  }

  // Арены боссов: один экран, стены по краям.
  function arena(world) {
    const W = 30, H = K.ROWS;
    const tiles = new Uint8Array(W * H);
    const set = (cx, cy, v) => { if (cx >= 0 && cx < W && cy >= 0 && cy < H) tiles[cy * W + cx] = v; };
    const gy = 14;
    for (let y = 0; y < H; y++) { set(0, y, T.BLOCK); set(W - 1, y, T.BLOCK); }
    for (let cx = 1; cx < W - 1; cx++) for (let y = gy; y < H; y++) set(cx, y, world.id === 5 && y === gy ? T.ICE : T.GROUND);
    const plat = (x0, x1, y, v) => { for (let cx = x0; cx <= x1; cx++) set(cx, y, v || T.PLAT); };
    const ents = [];
    switch (world.boss) {
      case 'pigeon': plat(4, 7, 10); plat(22, 25, 10); break;
      case 'wolf': plat(3, 5, 11); plat(24, 26, 11); break;
      case 'knight': plat(3, 6, 10); plat(23, 26, 10); plat(12, 17, 7); break;
      case 'treant': set(13, gy, T.BOUNCE); set(21, gy, T.BOUNCE); plat(16, 18, 9); break;
      case 'serpent': plat(3, 6, 10); plat(23, 26, 10); plat(12, 17, 6); break;
      case 'golem': plat(2, 5, 10); plat(24, 27, 10); plat(11, 18, 7); break;
      case 'keeper':
        for (const cx of [8, 9, 20, 21]) for (let y = gy; y < H; y++) set(cx, y, y >= H - 2 ? T.HAZARD : T.EMPTY);
        plat(3, 6, 10); plat(23, 26, 10); plat(12, 17, 7); plat(8, 9, 11); plat(20, 21, 11);
        break;
    }
    ents.push({ t: 'boss', kind: world.boss, x: world.boss === 'treant' ? 22 : 20, y: gy - 1 });
    return { id: K.stageId(world.id, world.levels + 1), world: world.id, stage: world.levels + 1, w: W, h: H, tiles, ents, start: { x: 3, y: gy - 1 }, totalCoins: 0, boss: true, top: [], abilities: K.abilitiesFor(world.id) };
  }

  K.generate = generate;
})();
