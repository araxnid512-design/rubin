// Тестовая локация «Посёлок» (фрагмент кластера, 100×100 м), СССР, 1990 год.
// LORE: Кластеры — участки, перенесённые из разных миров.
// Координаты в метрах, ось Y вниз. Север — сверху.
(function () {
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const W = 100, H = 100;
  const WALL = 0.25;

  const world = {
    W, H,
    roads: [],
    areas: [],
    buildings: [],
    rects: [],     // твёрдые прямоугольники: стены, машины, заборы
    circles: [],   // твёрдые круги: стволы, столбы, башня
    trees: [],
    vehicles: [],
    containers: [],
    npcs: [],
    spawns: [],
    poles: [],
    props: [],     // декор без коллизий
    exit: { x: 97, y: 76, w: 3, h: 5 },
  };

  function solid(x, y, w, h, kind) {
    const r = { x, y, w, h, kind };
    world.rects.push(r);
    return r;
  }

  function container(id, x, y, w, h, name, table, extra) {
    world.containers.push(Object.assign({ id, x, y, w, h, name, table, items: null }, extra || {}));
  }

  // --- Дороги и площадки ---
  world.roads.push({ x: 52, y: 0, w: 6, h: 100, type: 'asphalt' });       // главная улица
  world.roads.push({ x: 58, y: 76, w: 42, h: 5, type: 'asphalt' });       // дорога на соседнюю зону
  world.roads.push({ x: 47, y: 14, w: 5, h: 3, type: 'dirt' });           // подъезды к домам
  world.roads.push({ x: 47, y: 26, w: 5, h: 3, type: 'dirt' });
  world.roads.push({ x: 47, y: 38, w: 5, h: 3, type: 'dirt' });
  world.roads.push({ x: 47, y: 50, w: 5, h: 3, type: 'dirt' });
  world.roads.push({ x: 36, y: 32.6, w: 11, h: 1.8, type: 'dirt' });       // тропа к дальнему дому
  world.roads.push({ x: 58, y: 24, w: 4, h: 3, type: 'dirt' });           // к магазину
  world.areas.push({ x: 64, y: 55, w: 26, h: 18, type: 'parking' });      // стоянка техники
  world.areas.push({ x: 58, y: 43, w: 4, h: 6, type: 'sidewalk' });       // остановка

  // --- Здания ---
  function building(def) {
    const b = Object.assign({ walls: [] }, def);
    const { x, y, w, h, door } = b;
    const sides = {
      n: [x, y, w, WALL, 'h'],
      s: [x, y + h - WALL, w, WALL, 'h'],
      w: [x, y, WALL, h, 'v'],
      e: [x + w - WALL, y, WALL, h, 'v'],
    };
    for (const [side, [sx, sy, sw, sh, dir]] of Object.entries(sides)) {
      if (door && door.side === side) {
        const dw = door.width || 1.3;
        if (dir === 'h') {
          const a = door.offset - dw / 2, bEnd = door.offset + dw / 2;
          b.walls.push(solid(sx, sy, a, sh, 'wall'));
          b.walls.push(solid(sx + bEnd, sy, sw - bEnd, sh, 'wall'));
        } else {
          const a = door.offset - dw / 2, bEnd = door.offset + dw / 2;
          b.walls.push(solid(sx, sy, sw, a, 'wall'));
          b.walls.push(solid(sx, sy + bEnd, sw, sh - bEnd, 'wall'));
        }
      } else {
        b.walls.push(solid(sx, sy, sw, sh, 'wall'));
      }
    }
    world.buildings.push(b);
    return b;
  }

  const houses = [
    { id: 'h1', x: 39, y: 12, roof: '#5a4a3a' },
    { id: 'h2', x: 39, y: 24, roof: '#4e5560' },
    { id: 'h3', x: 39, y: 36, roof: '#5f4636' },
    { id: 'h4', x: 39, y: 48, roof: '#4f5a48' },
  ];
  for (const h of houses) {
    building({ id: h.id, x: h.x, y: h.y, w: 8, h: 7, kind: 'house', roof: h.roof,
      door: { side: 'e', offset: 3.5 } });
    container(h.id + '-c1', h.x + 0.4, h.y + 0.4, 1.6, 0.7, 'Шкаф', 'cupboard', { building: h.id });
    container(h.id + '-c2', h.x + 0.4, h.y + 5.6, 1.2, 1.0, 'Тумбочка', 'cupboard', { building: h.id });
    // Забор палисадника с калиткой к дороге.
    solid(h.x - 1.5, h.y - 1.5, 11, 0.12, 'fence');
    solid(h.x - 1.5, h.y + 8.4, 11, 0.12, 'fence');
    solid(h.x - 1.5, h.y - 1.5, 0.12, 10, 'fence');
  }

  // Дальний дом у леса: здесь прячется выживший (задание «Найти выживших»).
  building({ id: 'h5', x: 29, y: 30, w: 7, h: 7, kind: 'house', roof: '#4a3f36',
    door: { side: 'e', offset: 4.2 } });
  container('h5-c1', 29.4, 30.4, 1.6, 0.7, 'Шкаф', 'cupboard', { building: 'h5' });
  world.npcs.push({ id: 'survivor', x: 31.2, y: 34.5, name: 'Выживший', quest: 'survivors', rescued: false });

  // Магазин «Продукты» — кирпичный, плоская крыша.
  building({ id: 'shop', x: 62, y: 19, w: 14, h: 10, kind: 'shop', roof: '#5d5d5a', sign: 'ПРОДУКТЫ',
    door: { side: 'w', offset: 6.5, width: 1.6 } });
  container('shop-fridge', 72, 19.4, 3.5, 0.9, 'Холодильник', 'fridge', { building: 'shop', quest: 'shop' });
  container('shop-counter', 65, 22, 1.0, 4.5, 'Прилавок', 'counter', { building: 'shop' });
  container('shop-back', 74.4, 25.5, 1.2, 3.0, 'Подсобка', 'cupboard', { building: 'shop' });

  // Гараж-автосервис у стоянки.
  building({ id: 'garage', x: 90, y: 56, w: 8, h: 8, kind: 'garage', roof: '#4b4f52', sign: 'АВТОСЕРВИС',
    door: { side: 'w', offset: 4, width: 2.4 } });
  container('garage-tools', 95.8, 56.5, 1.6, 0.8, 'Ящик с инструментами', 'toolbox', { building: 'garage' });

  // --- Транспорт ---
  function vehicle(id, kind, x, y, w, h, color, table, name, extra) {
    world.vehicles.push({ id, kind, x, y, w, h, color });
    solid(x, y, w, h, 'vehicle');
    if (table) {
      container(id + '-c', x, y, w, h, name, table, Object.assign({ vehicle: id }, extra || {}));
    }
  }
  vehicle('bus', 'bus', 55.4, 44, 2.5, 8, '#c9a227', 'bus', 'Автобус', { quest: 'bus' });
  vehicle('car1', 'car', 66, 57, 1.8, 4.2, '#7a2a24', 'glovebox', 'Бардачок');
  vehicle('car2', 'car', 69.5, 57, 1.8, 4.2, '#4a6a7a', 'glovebox', 'Бардачок');
  vehicle('car3', 'car', 67, 66, 1.8, 4.2, '#a59a7a', 'glovebox', 'Бардачок');
  vehicle('truck', 'truck', 76, 56, 2.5, 7, '#4a5a3a', 'military', 'Кабина грузовика');
  vehicle('tractor', 'tractor', 83, 65, 2.0, 3.2, '#b0602a', 'toolbox', 'Ящик трактора');
  vehicle('wreck1', 'car', 52.6, 22, 1.8, 4.2, '#6a6a5a', 'glovebox', 'Бардачок');
  vehicle('wreck2', 'car', 53.2, 68, 1.8, 4.2, '#5a3a5a', null);

  // Остановка: навес с задней стенкой.
  solid(61.6, 43.5, 0.2, 5, 'shelter');
  world.props.push({ kind: 'shelter', x: 59.5, y: 43.5, w: 2.3, h: 5 });

  // Водонапорная башня.
  world.circles.push({ x: 45, y: 66, r: 1.8, kind: 'tower' });
  world.props.push({ kind: 'tower', x: 45, y: 66, r: 1.8 });

  // Столбы ЛЭП вдоль дороги.
  for (let y = 4; y < 100; y += 12) {
    world.poles.push({ x: 59, y });
    world.circles.push({ x: 59, y, r: 0.15, kind: 'pole' });
  }

  // --- Лес ---
  const rand = rng(1990);
  function free(x, y, pad) {
    for (const r of world.rects) {
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return false;
    }
    for (const r of world.roads.concat(world.areas)) {
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return false;
    }
    for (const b of world.buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return false;
    }
    for (const c of world.circles) {
      if (Math.hypot(x - c.x, y - c.y) < c.r + pad) return false;
    }
    return true;
  }
  function tree(x, y) {
    const r = 1.3 + rand() * 1.2;
    world.trees.push({ x, y, r, shade: rand(), kind: rand() < 0.75 ? 'pine' : 'birch' });
    world.circles.push({ x, y, r: 0.35, kind: 'trunk' });
  }
  // Сплошной лес на западе.
  for (let i = 0; i < 900 && world.trees.length < 260; i++) {
    const x = rand() * 27, y = rand() * 100;
    if (free(x, y, 1.6)) tree(x, y);
  }
  // Редкие деревья по посёлку и на северо-востоке.
  for (let i = 0; i < 600 && world.trees.length < 360; i++) {
    const x = 27 + rand() * 73, y = rand() * 100;
    const ne = x > 78 && y < 50;
    if ((ne || rand() < 0.25) && free(x, y, 2.4)) tree(x, y);
  }

  // --- Заражённые ---
  world.spawns.push(
    { type: 'empty', x: 44, y: 20 },
    { type: 'empty', x: 36, y: 44 },
    { type: 'empty', x: 48, y: 56 },
    { type: 'empty', x: 60, y: 12 },
    { type: 'empty', x: 33, y: 22 },
    { type: 'runner', x: 70, y: 33 },
    { type: 'runner', x: 55, y: 30 },
    { type: 'runner', x: 80, y: 40 },
    { type: 'lottery', x: 63, y: 51 },
    { type: 'lottery', x: 74, y: 70 },
    { type: 'stomper', x: 86, y: 62 },
  );

  // --- Пространственная сетка для коллизий ---
  const CELL = 4;
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const grid = Array.from({ length: cols * rows }, () => ({ rects: [], circles: [] }));
  function cellsFor(x0, y0, x1, y1, fn) {
    const cx0 = Math.max(0, Math.floor(x0 / CELL)), cy0 = Math.max(0, Math.floor(y0 / CELL));
    const cx1 = Math.min(cols - 1, Math.floor(x1 / CELL)), cy1 = Math.min(rows - 1, Math.floor(y1 / CELL));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) fn(grid[cy * cols + cx]);
  }
  for (const r of world.rects) cellsFor(r.x, r.y, r.x + r.w, r.y + r.h, (c) => c.rects.push(r));
  for (const c of world.circles) cellsFor(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r, (g) => g.circles.push(c));

  function nearby(x, y, rad) {
    const rects = new Set(), circles = new Set();
    cellsFor(x - rad, y - rad, x + rad, y + rad, (c) => {
      c.rects.forEach((r) => rects.add(r));
      c.circles.forEach((k) => circles.add(k));
    });
    return { rects, circles };
  }

  // Выталкивает круг (ent.x, ent.y, r) из препятствий и границ карты.
  function resolve(ent, r) {
    const { rects, circles } = nearby(ent.x, ent.y, r + 1);
    for (const q of rects) {
      const cx = Math.max(q.x, Math.min(ent.x, q.x + q.w));
      const cy = Math.max(q.y, Math.min(ent.y, q.y + q.h));
      let dx = ent.x - cx, dy = ent.y - cy;
      const d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d > 1e-6) {
        ent.x += dx / d * (r - d);
        ent.y += dy / d * (r - d);
      } else {
        // Центр внутри прямоугольника — выталкиваем по кратчайшей оси.
        const left = ent.x - q.x, right = q.x + q.w - ent.x, top = ent.y - q.y, bottom = q.y + q.h - ent.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) ent.x = q.x - r; else if (m === right) ent.x = q.x + q.w + r;
        else if (m === top) ent.y = q.y - r; else ent.y = q.y + q.h + r;
      }
    }
    for (const c of circles) {
      const dx = ent.x - c.x, dy = ent.y - c.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const min = r + c.r;
      if (d < min) { ent.x += dx / d * (min - d); ent.y += dy / d * (min - d); }
    }
    ent.x = Math.max(r, Math.min(W - r, ent.x));
    ent.y = Math.max(r, Math.min(H - r, ent.y));
  }

  function move(ent, dx, dy, r) {
    const steps = Math.ceil(Math.hypot(dx, dy) / (r * 0.8)) || 1;
    for (let i = 0; i < steps; i++) {
      ent.x += dx / steps;
      ent.y += dy / steps;
      resolve(ent, r);
    }
  }

  // Перекрывают ли стены отрезок (для выстрелов и обнаружения).
  function blocked(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const seen = new Set();
    let hit = false;
    cellsFor(minX, minY, maxX, maxY, (c) => {
      if (hit) return;
      for (const q of c.rects) {
        if (seen.has(q) || q.kind !== 'wall') continue;
        seen.add(q);
        if (segmentRect(x1, y1, x2, y2, q)) { hit = true; return; }
      }
    });
    return hit;
  }

  function segmentRect(x1, y1, x2, y2, q) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const qv = [x1 - q.x, q.x + q.w - x1, y1 - q.y, q.y + q.h - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (qv[i] < 0) return false; continue; }
      const t = qv[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }

  function buildingAt(x, y) {
    for (const b of world.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
    }
    return null;
  }

  function distToRect(x, y, q) {
    const cx = Math.max(q.x, Math.min(x, q.x + q.w));
    const cy = Math.max(q.y, Math.min(y, q.y + q.h));
    return Math.hypot(x - cx, y - cy);
  }

  Object.assign(world, { move, resolve, blocked, buildingAt, distToRect, rng });
  window.World = world;
})();
