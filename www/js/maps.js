// Генерация карт: районы города для вылазок и территория воинской части.
(function () {
  const D = window.GameData;
  const { BUILDING, OBSTACLE } = window.Cell;

  // Как выглядят здания в районе: размеры, цвет крыш, подписи.
  const STYLES = {
    outskirts: { sizes: [[6, 6], [7, 6], [6, 7], [8, 7]], roofs: ['#6a4a3a', '#5a5a62', '#704838', '#4e5a4a'], trees: 0.05, gap: 3, kind: 'house' },
    market: { sizes: [[3, 3], [4, 3], [3, 4], [14, 9]], roofs: ['#3e5a7a', '#7a3e3e', '#5a6a3e', '#6a6a6a'], trees: 0.01, gap: 2, kind: 'stall', big: { w: 18, h: 10, label: 'РЫНОК' } },
    school: { sizes: [[16, 7], [7, 14], [10, 6]], roofs: ['#7a6a5a', '#6a6a6a'], trees: 0.03, gap: 4, kind: 'panel', big: { w: 20, h: 9, label: 'ШКОЛА №3' } },
    industrial: { sizes: [[14, 9], [12, 10], [10, 6], [2, 5]], roofs: ['#5a5f62', '#6a6050', '#4e5560'], trees: 0.01, gap: 3, kind: 'warehouse' },
    hospital: { sizes: [[16, 7], [8, 12], [10, 6]], roofs: ['#8a8a86', '#7a7a76'], trees: 0.03, gap: 4, kind: 'panel', big: { w: 22, h: 10, label: 'БОЛЬНИЦА' } },
    police: { sizes: [[16, 7], [10, 6], [6, 6]], roofs: ['#6a6a6a', '#5a5a62'], trees: 0.02, gap: 3, kind: 'panel', big: { w: 14, h: 8, label: 'ПОЛИЦИЯ' } },
    military: { sizes: [[12, 6], [6, 10], [10, 5]], roofs: ['#4a5a3a', '#5a5a4a'], trees: 0.02, gap: 3, kind: 'panel', big: { w: 14, h: 8, label: 'ВОЕНКОМАТ' } },
    center: { sizes: [[20, 8], [8, 18], [14, 8], [10, 10]], roofs: ['#7a7672', '#6a6a70', '#8a7a6a'], trees: 0.015, gap: 3, kind: 'panel', big: { w: 18, h: 12, label: 'АДМИНИСТРАЦИЯ' } },
  };

  const W = 96, H = 64;
  const ROADS_X = [16, 46, 76];
  const ROADS_Y = [18, 40];
  const ROAD = 6;

  function district(def, visit) {
    const rand = window.rng(hash(def.id) + visit * 7919);
    const style = STYLES[def.id];
    const grid = new window.Grid(W, H);
    const map = {
      kind: 'city', w: W, h: H, grid, style: def.id,
      roads: [], buildings: [], cars: [], trees: [], lootPoints: [], survivorSpots: [], marauderSpots: [], zombieSpots: [],
      exit: { x: 43, y: 58, w: 12, h: 6 },
      entry: { x: 49, y: 61 },
    };

    for (const x of ROADS_X) map.roads.push({ x, y: 0, w: ROAD, h: H });
    for (const y of ROADS_Y) map.roads.push({ x: 0, y, w: W, h: ROAD });

    // Кварталы между дорогами.
    const xs = [0, ...ROADS_X.flatMap((x) => [x, x + ROAD]), W];
    const ys = [0, ...ROADS_Y.flatMap((y) => [y, y + ROAD]), H];
    const blocks = [];
    for (let i = 0; i < xs.length; i += 2) {
      for (let j = 0; j < ys.length; j += 2) {
        blocks.push({ x: xs[i] + 1.5, y: ys[j] + 1.5, w: xs[i + 1] - xs[i] - 3, h: ys[j + 1] - ys[j] - 3 });
      }
    }

    // Главное здание района — в квартале подальше от входа.
    let bigPlaced = null;
    if (style.big) {
      const b = blocks.filter((k) => k.y < 30 && k.w >= style.big.w && k.h >= style.big.h);
      const blk = b[Math.floor(rand() * b.length)] || blocks[0];
      const x = Math.floor(blk.x + (blk.w - style.big.w) / 2), y = Math.floor(blk.y + (blk.h - style.big.h) / 2);
      bigPlaced = addBuilding(map, x, y, style.big.w, style.big.h, style.roofs[0], style.big.label);
    }

    for (const blk of blocks) {
      const tries = 40;
      for (let t = 0; t < tries; t++) {
        const [bw, bh] = style.sizes[Math.floor(rand() * style.sizes.length)];
        if (bw > blk.w || bh > blk.h) continue;
        const x = Math.floor(blk.x + rand() * (blk.w - bw));
        const y = Math.floor(blk.y + rand() * (blk.h - bh));
        // Вход оставляем свободным от зданий.
        if (overlaps(x, y, bw, bh, map.exit.x - 3, map.exit.y - 6, map.exit.w + 6, 12)) continue;
        if (map.buildings.some((b) => overlaps(x, y, bw, bh, b.x - style.gap, b.y - style.gap, b.w + style.gap * 2, b.h + style.gap * 2))) continue;
        const kind = bw <= 4 && bh <= 4 ? 'stall' : (bw <= 2 || bh <= 2 ? 'container' : style.kind);
        addBuilding(map, x, y, bw, bh, style.roofs[Math.floor(rand() * style.roofs.length)], null, kind);
      }
    }

    // Брошенные машины на дорогах.
    const carColors = ['#7a2a24', '#4a6a7a', '#a59a7a', '#5a3a5a', '#3a5a3a', '#c9c2b0', '#2a3a5a'];
    for (let i = 0; i < 16; i++) {
      const vertical = rand() < 0.5;
      let x, y, w, h;
      if (vertical) {
        const rx = ROADS_X[Math.floor(rand() * ROADS_X.length)];
        x = rx + (rand() < 0.5 ? 0 : 4); y = Math.floor(rand() * (H - 6)); w = 2; h = 4;
      } else {
        const ry = ROADS_Y[Math.floor(rand() * ROADS_Y.length)];
        x = Math.floor(rand() * (W - 6)); y = ry + (rand() < 0.5 ? 0 : 4); w = 4; h = 2;
      }
      if (overlaps(x, y, w, h, map.exit.x - 2, map.exit.y - 8, map.exit.w + 4, 14)) continue;
      if (map.cars.some((c) => overlaps(x, y, w, h, c.x - 1, c.y - 1, c.w + 2, c.h + 2))) continue;
      map.cars.push({ x, y, w, h, color: carColors[Math.floor(rand() * carColors.length)], vertical });
      grid.fill(x, y, w, h, OBSTACLE);
    }

    // Деревья во дворах.
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (rand() > style.trees * 1.2) continue;
        if (onRoad(x, y) || grid.solid(x, y) || nearSolid(grid, x, y, 2)) continue;
        if (overlaps(x, y, 1, 1, map.exit.x - 2, map.exit.y - 6, map.exit.w + 4, 12)) continue;
        map.trees.push({ x: x + 0.5, y: y + 0.5, r: 0.9 + rand() * 0.7, shade: rand() });
        grid.fill(x, y, 1, 1, OBSTACLE);
      }
    }

    // Точки добычи у стен зданий.
    const lootKinds = [];
    for (const [k, n] of Object.entries(def.loot)) if (k !== 'points') for (let i = 0; i < n; i++) lootKinds.push(k);
    const spots = edgeSpots(map, rand, 14);
    shuffle(spots, rand);
    for (let i = 0; i < def.loot.points && spots.length; i++) {
      const s = spots.pop();
      const kind = lootKinds[Math.floor(rand() * lootKinds.length)];
      map.lootPoints.push({ x: s.x, y: s.y, kind });
    }

    // Выжившие прячутся у зданий подальше от входа.
    const sCount = def.survivors[0] + Math.floor(rand() * (def.survivors[1] - def.survivors[0] + 1));
    for (let i = 0; i < sCount && spots.length; i++) {
      const s = spots.pop();
      if (s.y > 45) { i--; continue; }
      map.survivorSpots.push(s);
    }

    // Лагерь мародёров у главного или случайного здания.
    if (def.marauders > 0) {
      const camp = bigPlaced || map.buildings[Math.floor(rand() * map.buildings.length)];
      const cx = camp.x + camp.w / 2, cy = camp.y + camp.h + 2;
      for (let i = 0; i < def.marauders; i++) {
        const p = grid.freeNear(cx + (rand() - 0.5) * 8, cy + rand() * 3, 6);
        map.marauderSpots.push(p);
      }
      const box = grid.freeNear(cx, cy + 1, 4);
      map.lootPoints.push({ x: box.x, y: box.y, kind: 'ammo', camp: true });
    }

    // Заражённые: группами по всему району, но не у входа.
    const mixKeys = Object.keys(def.mix);
    let left = def.zombies;
    while (left > 0) {
      const group = Math.min(left, 4 + Math.floor(rand() * 11));
      let gx, gy, guard = 0;
      do {
        gx = 2 + rand() * (W - 4);
        gy = 2 + rand() * (H - 4);
        guard++;
      } while ((grid.solid(Math.floor(gx), Math.floor(gy)) || Math.hypot(gx - map.entry.x, gy - map.entry.y) < 18) && guard < 50);
      for (let i = 0; i < group; i++) {
        const p = grid.freeNear(gx + (rand() - 0.5) * 5, gy + (rand() - 0.5) * 5, 4);
        let r = rand(), type = mixKeys[0];
        for (const k of mixKeys) { if ((r -= def.mix[k]) <= 0) { type = k; break; } }
        map.zombieSpots.push({ x: p.x, y: p.y, type });
      }
      left -= group;
    }
    return map;
  }

  function addBuilding(map, x, y, w, h, roof, label, kind) {
    const b = { x, y, w, h, roof, label, kind: kind || 'panel' };
    map.buildings.push(b);
    map.grid.fill(x, y, w, h, BUILDING);
    return b;
  }

  function onRoad(x, y) {
    return ROADS_X.some((r) => x >= r && x < r + ROAD) || ROADS_Y.some((r) => y >= r && y < r + ROAD);
  }

  function nearSolid(grid, x, y, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (grid.solid(x + dx, y + dy)) return true;
    return false;
  }

  // Свободные клетки вплотную к зданиям (там лежит добыча и прячутся люди).
  function edgeSpots(map, rand, minFromEntry) {
    const g = map.grid, out = [];
    for (const b of map.buildings) {
      if (b.kind === 'container') continue;
      const cand = [];
      for (let x = b.x; x < b.x + b.w; x++) { cand.push([x, b.y - 1]); cand.push([x, b.y + b.h]); }
      for (let y = b.y; y < b.y + b.h; y++) { cand.push([b.x - 1, y]); cand.push([b.x + b.w, y]); }
      shuffle(cand, rand);
      let n = 0;
      for (const [x, y] of cand) {
        if (n >= 2) break;
        if (g.solid(x, y)) continue;
        if (Math.hypot(x - map.entry.x, y - map.entry.y) < minFromEntry) continue;
        if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 6)) continue;
        out.push({ x: x + 0.5, y: y + 0.5 });
        n++;
      }
    }
    return out;
  }

  function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function shuffle(a, rand) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // --- Воинская часть ---
  // Часть стоит посреди поля: вокруг стен есть место, откуда подходит орда.
  const OX = 18, OY = 16;                 // отступ ограды от края карты
  const BW = 64 + OX * 2, BH = 46 + OY * 2;
  const WALL_RECT = { x0: 6 + OX, y0: 5 + OY, x1: 57 + OX, y1: 38 + OY };
  const GATE = { x0: 29 + OX, x1: 34 + OX };

  function base(c) {
    const grid = new window.Grid(BW, BH);
    const rand = window.rng(48);
    const hp = D.wallHp(c.buildings.walls) * c.wallIntegrity;
    const P = (x, y) => ({ x: x + OX, y: y + OY });
    const map = {
      kind: 'base', w: BW, h: BH, grid, wallRect: WALL_RECT,
      roads: [{ x: GATE.x0, y: WALL_RECT.y1, w: 6, h: BH - WALL_RECT.y1 }],
      buildings: [], cars: [], trees: [], lootPoints: [], wallCells: [], towers: [], pois: [], defense: [],
      inner: { x: WALL_RECT.x0 + 1, y: WALL_RECT.y0 + 1, w: WALL_RECT.x1 - WALL_RECT.x0 - 1, h: WALL_RECT.y1 - WALL_RECT.y0 - 1 },
      gate: { x: GATE.x0, y: WALL_RECT.y1, w: GATE.x1 - GATE.x0 + 1, h: 1 },
      plac: Object.assign(P(24, 17), { w: 16, h: 12 }),
      garden: c.buildings.garden ? Object.assign(P(9, 25), { w: 13, h: 10 }) : null,
      flag: P(32, 23),
      barracksDoor: P(16, 15),
      center: P(32, 22),
    };
    // Стены по периметру, ворота — та же стена, только рисуются иначе.
    const { x0, y0, x1, y1 } = WALL_RECT;
    for (let x = x0; x <= x1; x++) { wall(map, x, y0, hp); wall(map, x, y1, hp); }
    for (let y = y0 + 1; y < y1; y++) { wall(map, x0, y, hp); wall(map, x1, y, hp); }

    const B = (x, y, w, h, label, roof, kind) => addBuilding(map, x + OX, y + OY, w, h, roof, label, kind);
    B(26, 8, 12, 6, 'ШТАБ', '#5a6450');
    B(9, 8, 14, 6, 'КАЗАРМА', '#4e5a48');
    if (c.buildings.barracks >= 2) B(9, 16, 14, 6, 'КАЗАРМА-2', '#4e5a48');
    if (c.buildings.barracks >= 3) B(43, 32, 12, 5, 'КАЗАРМА-3', '#4e5a48');
    B(42, 8, 12, 6, 'СКЛАД', '#5a5a52');
    B(44, 17, 10, 5, 'МЕДПУНКТ', '#6a6a66');
    B(42, 25, 12, 6, 'СТОЛОВАЯ', '#5f564a');
    B(36, 34, 3, 3, 'КПП', '#5a6450', 'kpp');

    // Вышки по углам: столько, сколько построено.
    const corners = [[x0 + 1.5, y0 + 1.5], [x1 - 0.5, y0 + 1.5], [x0 + 1.5, y1 - 0.5], [x1 - 0.5, y1 - 0.5]];
    for (let i = 0; i < c.buildings.towers; i++) map.towers.push({ x: corners[i][0], y: corners[i][1] });

    // Точки, между которыми бродят бойцы в мирное время.
    map.pois = [[32, 15], [16, 15], [47, 15], [49, 23.5], [48, 32], [28, 20], [36, 20], [28, 27], [36, 27], [32, 34], [20, 32]]
      .map(([x, y]) => P(x, y));

    // Позиции обороны вдоль стен изнутри.
    for (let x = x0 + 3; x <= x1 - 3; x += 3) { map.defense.push({ x: x + 0.5, y: y0 + 2 }); map.defense.push({ x: x + 0.5, y: y1 - 1.2 }); }
    for (let y = y0 + 4; y <= y1 - 4; y += 3) { map.defense.push({ x: x0 + 2, y: y + 0.5 }); map.defense.push({ x: x1 - 1.2, y: y + 0.5 }); }
    for (let x = GATE.x0; x <= GATE.x1; x++) map.defense.push({ x: x + 0.5, y: y1 - 2.5 });
    shuffle(map.defense, rand);

    // Лес и кустарник вокруг части, дорога к воротам свободна.
    for (let i = 0; i < 1500 && map.trees.length < 160; i++) {
      const x = Math.floor(rand() * BW), y = Math.floor(rand() * BH);
      if (x >= x0 - 6 && x <= x1 + 6 && y >= y0 - 6 && y <= y1 + 6) continue;
      if (x >= GATE.x0 - 3 && x <= GATE.x1 + 3 && y > y1) continue;
      if (grid.solid(x, y)) continue;
      map.trees.push({ x: x + 0.5, y: y + 0.5, r: 1.2 + rand() * 1.1, shade: rand() });
      grid.fill(x, y, 1, 1, OBSTACLE);
    }
    return map;
  }

  function wall(map, x, y, hp) {
    map.grid.setWall(x, y, Math.max(1, hp));
    map.wallCells.push({ x, y, gate: y === WALL_RECT.y1 && x >= GATE.x0 && x <= GATE.x1 });
  }

  // Орда приходит волнами: каждая волна — плотная толпа с одной стороны.
  function hordeSpawns(map, count, rand, waves) {
    const out = [];
    const { x0, y0, x1, y1 } = WALL_RECT;
    const per = Math.ceil(count / waves);
    for (let w = 0; w < waves; w++) {
      const side = rand();
      let cx, cy;
      if (side < 0.4) { cx = (GATE.x0 + GATE.x1) / 2 + (rand() - 0.5) * 16; cy = y1 + 11 + rand() * 4; }
      else if (side < 0.6) { cx = x0 - 10 - rand() * 3; cy = y0 + rand() * (y1 - y0); }
      else if (side < 0.8) { cx = x1 + 10 + rand() * 3; cy = y0 + rand() * (y1 - y0); }
      else { cx = x0 + rand() * (x1 - x0); cy = y0 - 10 - rand() * 3; }
      for (let i = 0; i < per && out.length < count; i++) {
        const p = map.grid.freeNear(cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 10, 5);
        out.push({ x: p.x, y: p.y, delay: w * 22 + rand() * 6 });
      }
    }
    return out;
  }

  window.Maps = { district, base, hordeSpawns, WALL_RECT, GATE };
})();
