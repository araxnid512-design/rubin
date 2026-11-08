'use strict';
// ---------- Новые локации и карта базы ----------

// Здание с коридором посередине и комнатами по обе стороны
function corridorBuilding(m, r, bx, by, bw, bh, o) {
  const b = { x: bx, y: by, w: bw, h: bh, o: { floor: o.floor }, rooms: [], doors: [] };
  for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) {
    const i = MI(m, xx, yy);
    m.ground[i] = o.floor;
    m.tiles[i] = (xx === bx || yy === by || xx === bx + bw - 1 || yy === by + bh - 1) ? o.wall : o.floor;
  }
  const cy0 = by + Math.floor((bh - 3) / 2);
  for (let xx = bx + 1; xx < bx + bw - 1; xx++) { put(m, xx, cy0 - 1, o.wall); put(m, xx, cy0 + 3, o.wall); }
  const mid = bx + Math.floor(bw / 2), [rw0, rw1] = o.rw || [5, 8];
  const row = (y0, h, doorY, south) => {
    let x = bx + 1;
    const end = bx + bw - 1, rooms = [];
    while (end - x >= rw0 - 1) {
      let w = r.int(rw0, rw1);
      if (end - (x + w) < rw0 + 1) w = end - x;
      rooms.push({ x, y: y0, w, h, south });
      x += w;
      if (x < end) { for (let yy = y0; yy < y0 + h; yy++) put(m, x, yy, o.wall); x += 1; }
    }
    for (const rm of rooms) {
      rm.lobby = south && o.entrance !== false && mid >= rm.x && mid + 1 < rm.x + rm.w;
      const dx = rm.lobby ? mid : rm.x + Math.floor(rm.w / 2);
      makeDoor(m, b, dx, doorY, rm.lobby ? 'broken' : o.cellDoor || innerDoorState(r, {}), o.metal);
      if (rm.lobby) makeDoor(m, b, dx + 1, doorY, 'broken');
    }
    return rooms;
  };
  const north = row(by + 1, cy0 - 1 - (by + 1), cy0 - 1, false);
  const south = row(cy0 + 4, by + bh - 1 - (cy0 + 4), cy0 + 3, true);
  if (south.some(x => x.lobby)) { makeDoor(m, b, mid, by + bh - 1, 'open'); makeDoor(m, b, mid + 1, by + bh - 1, 'broken'); }
  else makeDoor(m, b, south[0].x + 1, by + bh - 1, 'open');
  makeDoor(m, b, bx, cy0 + 1, 'closed'); makeDoor(m, b, bx + bw - 1, cy0 + 1, 'closed');
  for (let k = 0; k < bw / 4; k++) {
    const xx = r.int(bx + 2, bx + bw - 3);
    for (const yy of [by, by + bh - 1]) if (!nearDoor(m, xx, yy, 1) && m.tiles[MI(m, xx, yy)] === o.wall && r() < 0.6) {
      const inner = yy === by ? yy + 1 : yy - 1;
      if (TP[m.tiles[MI(m, xx, inner)]].floor) put(m, xx, yy, T.WINDOW);
    }
  }
  b.rooms.push(...north, ...south, { x: bx + 1, y: cy0, w: bw - 2, h: 3 });
  m.buildings.push(b);
  reserve(m, bx - 2, by - 2, bw + 4, bh + 4);
  return { b, north, south, cy0, mid };
}
// Парты рядами
function deskRows(m, rm, kind = 'furn:desk') {
  for (let yy = rm.y + 1; yy < rm.y + rm.h - 1; yy += 2) for (let xx = rm.x + 1; xx < rm.x + rm.w - 1; xx += 2) {
    if (TP[m.tiles[MI(m, xx, yy)]].floor && !nearDoor(m, xx, yy, 1)) placeItem(m, null, xx, yy, kind);
  }
}
function guard(m, x, y, rad = 2) {
  m.guard = m.guard || [];
  for (let yy = y - rad; yy <= y + rad; yy++) for (let xx = x - rad; xx <= x + rad; xx++) if (inb(m, xx, yy)) m.guard.push(MI(m, xx, yy));
}
function campfire(m, x, y) { addProp(m, 'campfire', x, y, 1, 1); m.fires = m.fires || []; m.fires.push([x, y]); }
function tents(m, r, area, n, col, round) {
  for (let k = 0; k < n; k++) {
    const sp = findSpot(m, r, 2, 2, area, 1, 80);
    if (sp) addProp(m, 'tent', sp.x, sp.y, 2, 2, { c: col || r.pick(['#6a6f52', '#7a5a3a', '#5a6a7a', '#8a7a5a']), round: round ? 1 : 0 });
  }
}
// Схрон у палаток
function tentStash(m, r, pal, p = 0.6) {
  for (const t of m.props) {
    if (t.k !== 'tent' || r() > p) continue;
    for (const [x, y] of [[t.x + 2, t.y + 1], [t.x - 1, t.y], [t.x, t.y + 2], [t.x + 1, t.y - 1]]) {
      if (!inb(m, x, y) || !TP[m.tiles[MI(m, x, y)]].floor || m.cont[MI(m, x, y)]) continue;
      addCont(m, r, x, y, r.pick(pal)); break;
    }
  }
}
function captive(m, r, x, y) {
  m.captives = m.captives || [];
  const [name, g] = r.pick(NAMES);
  m.captives.push({ x, y, name, g, color: r.pick(UNIT_COLORS), freed: false });
  if (inb(m, x + 1, y) && TP[m.tiles[MI(m, x + 1, y)]].floor) { put(m, x + 1, y, T.FENCE); m.meta[MI(m, x + 1, y)] = 0; }
  reserve(m, x - 1, y - 1, 3, 3);
}

// ----- заправка -----
function genGas(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.6);
  const rx = r.int(7, 11);
  groundRect(m, rx, 0, 4, H, T.ASPHALT);
  for (let y = 0; y < H; y++) m.meta[MI(m, rx + 2, y)] |= 2;
  reserve(m, rx - 1, 0, 6, H);
  reserve(m, rx - 3, H - 11, 10, 11);
  const lx = rx + 5, ly = 5, lw = W - lx - 2, lh = 24;
  groundRect(m, lx, ly, lw, lh, T.ASPHALT);
  const b = building(m, r, lx + lw - 12, ly + 1, 11, 8, { wall: T.BRICK, floor: T.TILE, minRoom: 4, maxDepth: 1, doors: 2, doorSides: ['w', 's'], windows: 4 });
  const rooms = b.rooms.slice().sort((a, c) => c.w * c.h - a.w * a.h);
  furnishRoom(m, r, rooms[0], ['mshelf', 'vending', 'register', 'cooler', 'mshelf'], 6);
  for (const rm of rooms.slice(1)) furnishRoom(m, r, rm, ['crate', 'drum', 'toolbox', 'foodcrate'], 3);
  for (const px of [lx + 3, lx + 8]) for (const py of [ly + 12, ly + 17]) {
    groundRect(m, px - 1, py - 1, 3, 3, T.CONCRETE);
    addProp(m, 'pump', px, py, 1, 1, { tall: true });
    m.cont[MI(m, px, py)] = { k: 'pump', loot: rollLoot(r, CONT.pump.loot), s: 0 };
    reserve(m, px - 1, py - 1, 3, 3);
  }
  for (let k = 0; k < 3; k++) { const sp = findSpot(m, r, 2, 4, { x0: lx, y0: ly, x1: lx + lw, y1: ly + lh }, 1, 60); if (sp) addCar(m, r, sp.x, sp.y, true); }
  for (let k = 0; k < 4; k++) { const sp = findSpot(m, r, 1, 1, { x0: lx, y0: ly, x1: lx + lw, y1: ly + lh }, 1, 40); if (sp) { addCont(m, r, sp.x, sp.y, r() < 0.6 ? 'drum' : 'crate'); reserve(m, sp.x, sp.y, 1, 1); } }
  guard(m, lx + lw - 7, ly + 11, 3);
  reserve(m, lx - 1, ly - 1, lw + 2, lh + 2);
  scatterGreen(m, r, 0.03, 0.04, 2);
  placeStart(m, r, rx, H - 7);
}

// ----- гастроном / торговый центр -----
function genMarket(m, r) {
  const W = m.w, H = m.h, big = m.v === 1;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.7);
  const bw = big ? 46 : 30, bh = big ? 28 : 19, bx = Math.floor((W - bw) / 2), by = 3;
  const py0 = by + bh + 2, ph = H - py0 - 11;
  groundRect(m, 3, py0, W - 6, ph, T.ASPHALT);
  for (let x = 5; x < W - 5; x += 3) { m.meta[MI(m, x, py0 + 1)] |= 8; m.meta[MI(m, x, py0 + ph - 2)] |= 8; }
  const rdx = r.int(6, W - 10);
  groundRect(m, rdx, py0 + ph, 3, H - py0 - ph, T.ASPHALT);
  reserve(m, rdx - 3, H - 11, 9, 11);
  const wall = big ? T.WALL : T.BRICK;
  const b = { x: bx, y: by, w: bw, h: bh, o: { floor: T.TILE }, rooms: [], doors: [] };
  for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) {
    const i = MI(m, xx, yy);
    m.ground[i] = T.TILE;
    m.tiles[i] = (xx === bx || yy === by || xx === bx + bw - 1 || yy === by + bh - 1) ? wall : T.TILE;
  }
  const sy = by + 5;
  for (let xx = bx + 1; xx < bx + bw - 1; xx++) put(m, xx, sy, wall);
  makeDoor(m, b, bx + Math.floor(bw * 0.3), sy, 'closed'); makeDoor(m, b, bx + Math.floor(bw * 0.7), sy, 'open');
  let hx0 = bx + 1, hx1 = bx + bw - 2;
  if (big) {
    for (const wx of [bx + 9, bx + bw - 10]) {
      for (let yy = sy + 1; yy < by + bh - 1; yy++) put(m, wx, yy, wall);
      const left = wx === bx + 9;
      for (let yy = sy + 1; yy < by + bh - 1; yy += 6) {
        if (yy > sy + 1) for (let xx = left ? bx + 1 : wx + 1; xx < (left ? wx : bx + bw - 1); xx++) put(m, xx, yy, wall);
        const dy = Math.min(yy + 3, by + bh - 2);
        makeDoor(m, b, wx, dy, r() < 0.5 ? 'open' : 'broken');
        const rm = { x: left ? bx + 1 : wx + 1, y: yy + (yy > sy + 1 ? 1 : 0), w: 8, h: 5 };
        b.rooms.push(rm);
        furnishRoom(m, r, rm, r.pick([['mshelf', 'register', 'shelf'], ['medcab', 'shelf', 'register'], ['locker', 'shelf', 'crate'], ['cooler', 'mshelf', 'register']]), 4);
      }
    }
    hx0 = bx + 10; hx1 = bx + bw - 11;
  }
  const hy0 = sy + 1, hy1 = by + bh - 2;
  for (let yy = hy0 + 2; yy <= hy1 - 4; yy += 3) for (let xx = hx0 + 2; xx <= hx1 - 2; xx++) {
    if ((xx - hx0 - 2) % 8 === 7) continue;
    if (TP[m.tiles[MI(m, xx, yy)]].floor && !nearDoor(m, xx, yy, 1)) addCont(m, r, xx, yy, 'mshelf');
  }
  for (let xx = hx0 + 1; xx <= hx1 - 1; xx += 2) if (TP[m.tiles[MI(m, xx, hy0)]].floor && !nearDoor(m, xx, hy0, 1) && r() < 0.6) addCont(m, r, xx, hy0, 'cooler');
  const mid = bx + Math.floor(bw / 2);
  for (let xx = hx0 + 2; xx <= hx1 - 2; xx += 3) {
    if (Math.abs(xx - mid) <= 1) continue;
    placeItem(m, r, xx, hy1 - 1, 'furn:counter');
    if (r() < 0.6) addCont(m, r, xx + 1 <= hx1 ? xx : xx, hy1 - 2, 'register');
  }
  for (let yy = by + 1; yy < sy; yy++) for (let xx = bx + 2; xx < bx + bw - 2; xx += 2) if (r() < 0.45 && !nearDoor(m, xx, yy, 1)) addCont(m, r, xx, yy, r() < 0.6 ? 'foodcrate' : 'pallet');
  makeDoor(m, b, mid, by + bh - 1, 'open'); makeDoor(m, b, mid + 1, by + bh - 1, 'broken');
  makeDoor(m, b, bx, sy + 3, 'closed'); makeDoor(m, b, bx + bw - 1, by + 2, 'closed');
  for (let k = 0; k < bw / 3; k++) { const xx = r.int(bx + 2, bx + bw - 3); if (!nearDoor(m, xx, by + bh - 1, 1)) put(m, xx, by + bh - 1, T.WINDOW); }
  b.rooms.push({ x: hx0, y: hy0, w: hx1 - hx0 + 1, h: hy1 - hy0 + 1 }, { x: bx + 1, y: by + 1, w: bw - 2, h: sy - by - 1 });
  m.buildings.push(b);
  reserve(m, bx - 2, by - 2, bw + 4, bh + 4);
  for (let x = 5; x < W - 7; x += 3) for (const y of [py0 + 1, py0 + ph - 4]) {
    if (r() > 0.45) continue;
    let ok = true;
    for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 2; xx++) if (m.tiles[MI(m, xx, yy)] !== T.ASPHALT || m.resv[MI(m, xx, yy)]) ok = false;
    if (ok) { const p = addProp(m, 'car', x, y, 2, 3, { c: r.pick(CAR_COLORS), v: 1, f: r() < 0.5 ? 1 : 0 }); if (r() < 0.4) m.cont[MI(m, p.x, p.y + 2)] = { k: 'trunk', loot: rollLoot(r, CONT.trunk.loot), s: 0 }; }
  }
  reserve(m, 3, py0, W - 6, ph);
  scatterGreen(m, r, 0.03, 0.04, 2);
  placeStart(m, r, rdx, H - 7);
}

// ----- отдел полиции -----
function genPolice(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.75);
  const sy = H - 13;
  groundRect(m, 0, sy, W, 3, T.ASPHALT);
  for (let x = 0; x < W; x++) m.meta[MI(m, x, sy + 1)] |= 4;
  const rdx = r.int(8, W - 12);
  groundRect(m, rdx, sy, 3, H - sy, T.ASPHALT);
  reserve(m, 0, sy - 1, W, 5); reserve(m, rdx - 3, H - 11, 9, 11);
  const fx0 = 3, fy0 = 3, fx1 = W - 4, fy1 = sy - 2;
  groundRect(m, fx0 + 1, fy0 + 1, fx1 - fx0 - 1, fy1 - fy0 - 1, T.CONCRETE);
  const gx = r.int(fx0 + 6, fx1 - 9);
  for (let x = fx0; x <= fx1; x++) { if (x < gx || x > gx + 3) { put(m, x, fy1, T.FENCE); m.meta[MI(m, x, fy1)] = 1; } put(m, x, fy0, T.FENCE); m.meta[MI(m, x, fy0)] = 1; }
  for (let y = fy0; y <= fy1; y++) for (const x of [fx0, fx1]) { put(m, x, y, T.FENCE); m.meta[MI(m, x, y)] = 1; }
  groundRect(m, gx, fy1, 4, sy - fy1, T.ASPHALT);
  reserve(m, fx0 - 1, fy0 - 1, fx1 - fx0 + 3, 2); reserve(m, fx0 - 1, fy1 - 1, fx1 - fx0 + 3, 2);
  reserve(m, fx0 - 1, fy0, 2, fy1 - fy0); reserve(m, fx1, fy0, 2, fy1 - fy0);
  const area = { x0: fx0 + 2, y0: fy0 + 2, x1: fx1 - 1, y1: fy1 - 2 };
  let bw = 24, bh = 14, sp = findSpot(m, r, bw, bh, area, 2);
  if (!sp) { bw = 20; bh = 12; sp = findSpot(m, r, bw, bh, area, 1); }
  if (sp) {
    const b = building(m, r, sp.x, sp.y, bw, bh, { wall: T.BRICK, floor: T.TILE, minRoom: 4, maxDepth: 3, doors: 2, windows: 7, doorSides: ['s', 'w', 'e'] });
    const rooms = b.rooms.slice().sort((a, c) => a.w * a.h - c.w * c.h);
    furnishRoom(m, r, rooms[0], ['armory', 'armory', 'locker'], 3);
    if (rooms[1]) furnishRoom(m, r, rooms[1], ['evidence', 'locker', 'shelf'], 3);
    for (const rm of rooms.slice(2)) furnishRoom(m, r, rm, ['desk', 'desk', 'locker', 'furn:table', 'medcab', 'shelf'], Math.max(2, Math.round(rm.w * rm.h / 8)));
  }
  sp = findSpot(m, r, 13, 6, area, 1);
  if (sp) {
    const cb = building(m, r, sp.x, sp.y, 13, 6, { wall: T.WALL, floor: T.CONCRETE, split: false, doors: 1, doorSides: ['s'], metal: true });
    for (let k = 0; k < 3; k++) {
      const cx = sp.x + 1 + k * 4;
      for (let xx = cx; xx < cx + 3; xx++) if (xx !== cx + 1) { put(m, xx, sp.y + 3, T.FENCE); m.meta[MI(m, xx, sp.y + 3)] = 1; }
      if (k < 2) for (let yy = sp.y + 1; yy <= sp.y + 3; yy++) put(m, cx + 3, yy, T.WALL);
      placeItem(m, r, cx, sp.y + 1, 'furn:cot');
    }
    m.buildings[m.buildings.length - 1] = cb;
  }
  for (let k = 0; k < 4; k++) { const s2 = findSpot(m, r, 2, 4, area, 1, 60); if (s2) { const p = addCar(m, r, s2.x, s2.y, true, 'car', 'trunk', 0.5); p.c = '#dcdad2'; p.pol = 1; } }
  for (let k = 0; k < 3; k++) { const s2 = findSpot(m, r, 4, 2, { x0: 1, y0: sy, x1: W - 1, y1: sy + 3 }, 0, 40); if (s2) addCar(m, r, s2.x, s2.y, false); }
  scatterGreen(m, r, 0.03, 0.04, 2);
  placeStart(m, r, rdx, H - 7);
}

// ----- школа -----
function genSchool(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 7, 0.78);
  const bw = r.int(40, 46), bh = 17, bx = Math.floor((W - bw) / 2), by = 4;
  const yard = { x: 4, y: by + bh + 2, w: W - 8, h: H - by - bh - 14 };
  groundRect(m, yard.x, yard.y, yard.w, yard.h, T.ASPHALT);
  const rdx = r.int(6, W - 10);
  groundRect(m, rdx, yard.y + yard.h, 3, H - yard.y - yard.h, T.ASPHALT);
  reserve(m, rdx - 3, H - 11, 9, 11);
  const cb = corridorBuilding(m, r, bx, by, bw, bh, { wall: T.BRICK, floor: T.WOOD, rw: [6, 9] });
  const kinds = shuffle(['class', 'class', 'class', 'class', 'class', 'canteen', 'office', 'gym', 'class', 'class', 'medic'], r);
  let ki = 0;
  for (const rm of [...cb.north, ...cb.south]) {
    if (rm.lobby) { furnishRoom(m, r, rm, ['furn:bench', 'locker', 'shelf'], 3); continue; }
    const k = kinds[ki++ % kinds.length];
    if (k === 'class') { deskRows(m, rm); furnishRoom(m, r, rm, ['desk', 'locker', 'shelf'], 2); }
    else if (k === 'canteen') furnishRoom(m, r, rm, ['fridge', 'pantry', 'foodcrate', 'furn:table', 'furn:table'], 6);
    else if (k === 'medic') furnishRoom(m, r, rm, ['medcab', 'medcab', 'furn:bed', 'desk'], 4);
    else if (k === 'gym') furnishRoom(m, r, rm, ['locker', 'crate'], 2);
    else furnishRoom(m, r, rm, ['desk', 'locker', 'medcab', 'shelf'], 3);
  }
  const fx0 = yard.x - 1, fy0 = by - 2, fx1 = yard.x + yard.w, fy1 = yard.y + yard.h;
  const gate = rdx;
  for (let x = fx0; x <= fx1; x++) { if (x < gate - 1 || x > gate + 3) { put(m, x, fy1, T.FENCE); m.meta[MI(m, x, fy1)] = 2; } }
  for (let y = fy0 + 6; y <= fy1; y++) for (const x of [fx0, fx1]) if (inb(m, x, y) && TP[m.tiles[MI(m, x, y)]].floor) { put(m, x, y, T.FENCE); m.meta[MI(m, x, y)] = 2; }
  reserve(m, fx0 - 1, fy1 - 1, fx1 - fx0 + 3, 3);
  const sp = findSpot(m, r, 7, 3, { x0: yard.x + 1, y0: yard.y + 1, x1: yard.x + yard.w - 1, y1: yard.y + yard.h - 1 }, 1, 60);
  if (sp) addProp(m, 'bus', sp.x, sp.y, 7, 3, { c: '#d9a62b', v: 0, f: r() < 0.5 ? 1 : 0 });
  for (let k = 0; k < 5; k++) { const s2 = findSpot(m, r, 1, 1, { x0: yard.x + 1, y0: yard.y + 1, x1: yard.x + yard.w - 1, y1: yard.y + yard.h - 1 }, 1, 40); if (s2) { placeItem(m, r, s2.x, s2.y, 'furn:bench'); reserve(m, s2.x, s2.y, 1, 1); } }
  reserve(m, yard.x, yard.y, yard.w, yard.h);
  scatterGreen(m, r, 0.04, 0.04, 2);
  placeStart(m, r, rdx, H - 7);
}

// ----- церковь и кладбище -----
function genChurch(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.74);
  const rdx = r.int(Math.floor(W * 0.35), Math.floor(W * 0.5));
  groundRect(m, rdx, Math.floor(H * 0.55), 3, H, T.DIRT);
  for (let y = Math.floor(H * 0.55); y < H; y++) { m.meta[MI(m, rdx, y)] |= 2; m.meta[MI(m, rdx + 2, y)] |= 2; }
  reserve(m, rdx - 1, Math.floor(H * 0.55), 5, H); reserve(m, rdx - 3, H - 11, 9, 11);
  const cw = 11, ch = 17, cx = rdx - 4, cy = 4;
  const b = building(m, r, cx, cy, cw, ch, { wall: T.WALL, floor: T.WOOD, split: false, doors: 1, doorSides: ['s'], extDoor: 'open', windows: 8 });
  makeDoor(m, b, cx + cw - 1, cy + 4, 'closed');
  for (let yy = cy + 5; yy <= cy + ch - 4; yy += 2) for (const xx of [cx + 2, cx + 3, cx + 4, cx + cw - 5, cx + cw - 4, cx + cw - 3]) if (TP[m.tiles[MI(m, xx, yy)]].floor) placeItem(m, r, xx, yy, 'furn:pew');
  addCont(m, r, cx + Math.floor(cw / 2), cy + 2, 'desk');
  addCont(m, r, cx + 1, cy + 1, 'pantry'); addCont(m, r, cx + cw - 2, cy + 1, 'medcab');
  const rightSp = W - 3 - (cx + cw + 2), leftSp = cx - 4;
  const gw = Math.min(16, Math.max(rightSp, leftSp)), gh = 14, gx = rightSp >= leftSp ? cx + cw + 2 : cx - 2 - gw, gy = 5;
  if (gw >= 8 && isFree(m, gx - 1, gy - 1, gw + 2, gh + 2)) {
    for (let yy = gy; yy < gy + gh; yy++) for (let xx = gx; xx < gx + gw; xx++) {
      const edge = xx === gx || yy === gy || xx === gx + gw - 1 || yy === gy + gh - 1;
      if (edge) { if (!(yy === gy + gh - 1 && Math.abs(xx - (gx + gw / 2)) < 1.5)) { put(m, xx, yy, T.FENCE); m.meta[MI(m, xx, yy)] = 2; } }
      else if ((xx - gx) % 2 === 1 && (yy - gy) % 3 === 1 && r() < 0.85) { put(m, xx, yy, T.GRAVE); m.meta[MI(m, xx, yy)] = r() < 0.5 ? 1 : 0; }
    }
    reserve(m, gx - 1, gy - 1, gw + 2, gh + 2);
    // склеп-сторожка у кладбища
    const kx = gx + Math.floor(gw / 2) - 2, ky = gy + gh + 1;
    if (isFree(m, kx - 1, ky, 6, 5)) { const kb = building(m, r, kx, ky, 5, 4, { wall: T.WALL, floor: T.CONCRETE, split: false, doors: 1, doorSides: ['s'] }); furnish(m, r, kb, ['crate', 'medcab', 'pantry', 'toolbox'], 2); }
  }
  for (let k = 0; k < 2; k++) {
    const sp = findSpot(m, r, 8, 6, { x0: 2, y0: 2, x1: W - 2, y1: H - 12 }, 2);
    if (sp) { const hb = building(m, r, sp.x, sp.y, 8, 6, { wall: T.WWALL, floor: T.WOOD, minRoom: 3, maxDepth: 1, doors: 1, windows: 2 }); furnish(m, r, hb, ['fridge', 'pantry', 'furn:bed', 'locker', 'medcab', 'desk'], 5); }
  }
  const camp = { x0: 3, y0: cy + ch + 1, x1: W - 3, y1: H - 12 };
  tents(m, r, camp, 3, '#7a7466', true);
  tentStash(m, r, ['crate', 'foodcrate', 'medcab', 'pantry'], 0.8);
  const fsp = findSpot(m, r, 1, 1, camp, 1);
  if (fsp) { campfire(m, fsp.x, fsp.y); guard(m, fsp.x, fsp.y, 3); }
  scatterGreen(m, r, 0.05, 0.04, 2);
  placeStart(m, r, rdx, H - 7);
}

// ----- блокпост / военная часть -----
function genCheckpoint(m, r) {
  const W = m.w, H = m.h, big = m.v === 1;
  baseGround(m, T.DIRT, T.GRASS, 6, 0.55);
  const rx = Math.floor(W / 2) - 2;
  groundRect(m, rx, 0, 4, H, T.ASPHALT);
  for (let y = 0; y < H; y++) m.meta[MI(m, rx + 2, y)] |= 2;
  reserve(m, rx - 1, 0, 6, H); reserve(m, rx - 3, H - 11, 10, 11);
  const ly = Math.floor(H * (big ? 0.62 : 0.5));
  if (big) {
    const fx0 = 3, fy0 = 3, fx1 = W - 4, fy1 = ly;
    for (let x = fx0; x <= fx1; x++) { put(m, x, fy0, T.WALL); if (x < rx || x > rx + 3) put(m, x, fy1, T.WALL); }
    for (let y = fy0; y <= fy1; y++) { put(m, fx0, y, T.WALL); put(m, fx1, y, T.WALL); }
    groundRect(m, fx0 + 1, fy0 + 1, fx1 - fx0 - 1, fy1 - fy0 - 1, T.CONCRETE);
    reserve(m, fx0 - 1, fy0 - 1, fx1 - fx0 + 3, 2); reserve(m, fx0 - 1, fy1 - 1, fx1 - fx0 + 3, 3);
    reserve(m, fx0 - 1, fy0, 2, fy1 - fy0); reserve(m, fx1, fy0, 2, fy1 - fy0);
    for (const [tx, ty] of [[fx0 + 1, fy0 + 1], [fx1 - 2, fy0 + 1], [rx - 3, fy1 - 2], [rx + 5, fy1 - 2]]) { addProp(m, 'tower', tx, ty, 2, 2, { tall: true }); guard(m, tx, ty + 2, 2); }
    const area = { x0: fx0 + 2, y0: fy0 + 2, x1: fx1 - 1, y1: fy1 - 2 };
    let sp = findSpot(m, r, 20, 7, area, 1);
    if (sp) { const bb = building(m, r, sp.x, sp.y, 20, 7, { wall: T.WALL, floor: T.CONCRETE, minRoom: 6, maxDepth: 1, doors: 2, windows: 5 }); for (const rm of bb.rooms) furnishRoom(m, r, rm, ['furn:bunk', 'furn:bunk', 'locker', 'ration'], Math.max(3, Math.round(rm.w * rm.h / 6))); guard(m, sp.x + 10, sp.y + 8, 3); }
    sp = findSpot(m, r, 12, 8, area, 1);
    if (sp) { const hq = building(m, r, sp.x, sp.y, 12, 8, { wall: T.WALL, floor: T.TILE, minRoom: 3, maxDepth: 2, doors: 2, windows: 4 }); const rooms = hq.rooms.slice().sort((a, c) => a.w * a.h - c.w * c.h); furnishRoom(m, r, rooms[0], ['armory', 'armory'], 2); for (const rm of rooms.slice(1)) furnishRoom(m, r, rm, ['desk', 'medcab', 'locker', 'ration'], 3); }
    sp = findSpot(m, r, 12, 8, area, 1);
    if (sp) { const wh = building(m, r, sp.x, sp.y, 12, 8, { wall: T.WALL, floor: T.CONCRETE, split: false, doors: 1, metal: true }); furnish(m, r, wh, ['ration', 'crate', 'ration', 'drum', 'armory'], 5); }
    for (let k = 0; k < 3; k++) { const s2 = findSpot(m, r, 3, 6, area, 1, 60); if (s2) { const p = addCar(m, r, s2.x, s2.y, true, 'truck', 'ration', 0.8); p.c = '#4a5a3a'; } }
    for (let k = 0; k < 3; k++) { const s2 = findSpot(m, r, 3, 4, area, 1, 60); if (s2) addProp(m, 'mtent', s2.x, s2.y, 3, 4, { c: '#4a5a3a' }); }
    const cpts = findSpot(m, r, 2, 2, area, 1);
    if (cpts) captive(m, r, cpts.x, cpts.y);
  }
  // линия мешков с песком поперёк дороги и гнёзда
  const sy = big ? ly + 6 : ly;
  for (let x = rx - 6; x <= rx + 9; x++) if (x < rx + 1 || x > rx + 2) { put(m, x, sy, T.SANDBAG); }
  for (const nx of [rx - 9, rx + 11]) for (let k = 0; k < 3; k++) { put(m, nx + k, sy - 2, T.SANDBAG); put(m, nx, sy - 2 + k, T.SANDBAG); put(m, nx + 2, sy - 2 + k, T.SANDBAG); }
  reserve(m, rx - 10, sy - 3, 24, 4);
  guard(m, rx + 1, sy - 2, 3);
  if (!big) {
    for (const tx of [rx - 4, rx + 6]) if (isFree(m, tx, sy - 5, 2, 2)) { addProp(m, 'tower', tx, sy - 5, 2, 2, { tall: true }); guard(m, tx, sy - 3, 1); }
    const camp = { x0: 3, y0: 3, x1: W - 3, y1: sy - 4 };
    for (let k = 0; k < 4; k++) { const s2 = findSpot(m, r, 3, 4, camp, 1, 60); if (s2) { addProp(m, 'mtent', s2.x, s2.y, 3, 4, { c: '#4a5a3a' }); if (inb(m, s2.x + 3, s2.y + 1) && !m.resv[MI(m, s2.x + 3, s2.y + 1)]) { addCont(m, r, s2.x + 3, s2.y + 1, 'ration'); reserve(m, s2.x + 3, s2.y + 1, 1, 1); } guard(m, s2.x + 1, s2.y + 5, 1); } }
    const bsp = findSpot(m, r, 6, 5, camp, 1);
    if (bsp) { const bk = building(m, r, bsp.x, bsp.y, 6, 5, { wall: T.WALL, floor: T.CONCRETE, split: false, doors: 1, metal: true }); furnish(m, r, bk, ['armory', 'ration', 'medcab'], 3); }
    for (let k = 0; k < 2; k++) { const s2 = findSpot(m, r, 3, 6, camp, 1, 60); if (s2) { const p = addCar(m, r, s2.x, s2.y, true, 'truck', 'ration', 0.7); p.c = '#4a5a3a'; } }
    fenceLine(m, 2, sy - 1, rx - 11, sy - 1, 1, 9); fenceLine(m, rx + 14, sy - 1, W - 3, sy - 1, 1, 9);
  }
  scatterGreen(m, r, 0.02, 0.05, 2);
  placeStart(m, r, rx, H - 7);
}

// ----- турбаза / стан Паствы -----
function genForest(m, r) {
  const W = m.w, H = m.h, cult = m.v === 1;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.72);
  const rdx = r.int(Math.floor(W * 0.4), Math.floor(W * 0.55)), ry = Math.floor(H * 0.45);
  groundRect(m, rdx, ry, 3, H - ry, T.DIRT);
  for (let y = ry; y < H; y++) { m.meta[MI(m, rdx, y)] |= 2; m.meta[MI(m, rdx + 2, y)] |= 2; }
  reserve(m, rdx - 1, ry, 5, H - ry); reserve(m, rdx - 3, H - 11, 9, 11);
  if (cult) {
    const cx = rdx + 1, cy = Math.floor(H * 0.3), rad = 10;
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) if (inb(m, x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) setGround(m, x, y, T.DIRT);
    groundRect(m, rdx, cy, 3, ry - cy, T.DIRT);
    campfire(m, cx, cy); reserve(m, cx - 1, cy - 1, 3, 3);
    addCont(m, r, cx, cy - 3, 'desk'); reserve(m, cx, cy - 3, 1, 1);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, tx = Math.round(cx + Math.cos(a) * 6) - 1, ty = Math.round(cy + Math.sin(a) * 6) - 1; if (isFree(m, tx, ty, 2, 2)) addProp(m, 'tent', tx, ty, 2, 2, { c: r.pick(['#7a7466', '#6a645a', '#8a8070']), round: 1 }); }
    for (let k = 0; k < 6; k++) { const a = r() * Math.PI * 2, tx = Math.round(cx + Math.cos(a) * 3.5), ty = Math.round(cy + Math.sin(a) * 3.5); if (isFree(m, tx, ty, 1, 1)) { addCont(m, r, tx, ty, r.pick(['pantry', 'crate', 'medcab', 'drum'])); reserve(m, tx, ty, 1, 1); } }
    tentStash(m, r, ['crate', 'foodcrate', 'medcab', 'pantry', 'drum'], 0.9);
    for (let k = 0; k < 3; k++) {
      const sp = findSpot(m, r, 5, 4, { x0: 2, y0: 2, x1: W - 2, y1: H - 12 }, 2, 80);
      if (sp) { const hb = building(m, r, sp.x, sp.y, 5, 4, { wall: T.WWALL, floor: T.WOOD, split: false, doors: 1, windows: 1 }); furnish(m, r, hb, ['pantry', 'crate', 'medcab', 'furn:bed'], 3); }
    }
    const caps = findSpot(m, r, 1, 1, { x0: cx - 8, y0: cy - 8, x1: cx + 8, y1: cy + 8 }, 1, 80);
    if (caps) captive(m, r, caps.x, caps.y);
    guard(m, cx, cy, 5);
    reserve(m, cx - rad, cy - rad, rad * 2 + 1, rad * 2 + 1);
  } else {
    const lsp = findSpot(m, r, 14, 9, { x0: 2, y0: 2, x1: W - 2, y1: H - 14 }, 1);
    if (lsp) { for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 14; xx++) if (((xx - 6.5) / 7) ** 2 + ((yy - 4) / 4.5) ** 2 < 1) put(m, lsp.x + xx, lsp.y + yy, T.WATER); reserve(m, lsp.x, lsp.y, 14, 9); }
    for (let k = 0; k < 6; k++) {
      const sp = findSpot(m, r, 6, 5, { x0: 2, y0: 2, x1: W - 2, y1: H - 12 }, 2, 80);
      if (!sp) continue;
      const b = building(m, r, sp.x, sp.y, 6, 5, { wall: T.WWALL, floor: T.WOOD, split: false, doors: 1, windows: 2 });
      furnish(m, r, b, ['furn:bed', 'fridge', 'pantry', 'locker', 'desk'], 4);
    }
    tents(m, r, { x0: 3, y0: 3, x1: W - 3, y1: H - 12 }, 3);
    tentStash(m, r, ['crate', 'foodcrate', 'drum'], 0.6);
    const fsp = findSpot(m, r, 1, 1, { x0: 3, y0: 3, x1: W - 3, y1: H - 12 }, 2);
    if (fsp) { campfire(m, fsp.x, fsp.y); for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2]]) if (isFree(m, fsp.x + dx, fsp.y + dy, 1, 1)) { placeItem(m, r, fsp.x + dx, fsp.y + dy, 'furn:bench'); reserve(m, fsp.x + dx, fsp.y + dy, 1, 1); } }
    const csp = findSpot(m, r, 2, 4, { x0: 2, y0: 2, x1: W - 2, y1: H - 12 }, 1);
    if (csp) addCar(m, r, csp.x, csp.y, true, 'car', 'trunk', 0.8);
  }
  scatterGreen(m, r, 0.12, 0.06, 3);
  placeStart(m, r, rdx, H - 7);
}

// ----- мотель -----
function genMotel(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.7);
  const ry = H - 9;
  groundRect(m, 0, ry, W, 3, T.ASPHALT);
  for (let x = 0; x < W; x++) m.meta[MI(m, x, ry + 1)] |= 4;
  const rdx = r.int(5, 10);
  groundRect(m, rdx, ry, 3, H - ry, T.ASPHALT);
  reserve(m, 0, ry - 1, W, 4); reserve(m, rdx - 3, H - 11, 9, 11);
  const py = ry - 12;
  groundRect(m, 3, py, W - 6, 11, T.ASPHALT);
  for (let x = 5; x < W - 5; x += 3) m.meta[MI(m, x, py + 1)] |= 8;
  const n = r.int(6, 7), bw = n * 5 + 1, bx = 3, by = py - 8;
  const b = { x: bx, y: by, w: bw, h: 8, o: { floor: T.WOOD }, rooms: [], doors: [] };
  for (let yy = by; yy < by + 8; yy++) for (let xx = bx; xx < bx + bw; xx++) {
    const i = MI(m, xx, yy);
    m.ground[i] = T.WOOD;
    m.tiles[i] = (xx === bx || yy === by || xx === bx + bw - 1 || yy === by + 7 || (xx - bx) % 5 === 0) ? T.BRICK : T.WOOD;
  }
  for (let k = 0; k < n; k++) {
    const x0 = bx + k * 5 + 1, rm = { x: x0, y: by + 1, w: 4, h: 6 };
    b.rooms.push(rm);
    const v = r();
    makeDoor(m, b, x0 + 1, by + 7, v < 0.5 ? 'closed' : v < 0.8 ? 'open' : 'broken');
    put(m, x0 + 3, by + 7, T.WINDOW);
    placeItem(m, r, x0, by + 1, 'furn:bed'); placeItem(m, r, x0 + 1, by + 1, 'furn:bed');
    furnishRoom(m, r, rm, ['fridge', 'locker', 'desk', 'medcab'], 2);
  }
  m.buildings.push(b);
  reserve(m, bx - 1, by - 1, bw + 2, 10);
  const ob = building(m, r, bx + bw + 2, by + 1, 8, 6, { wall: T.BRICK, floor: T.TILE, split: false, doors: 1, doorSides: ['s'], windows: 2 });
  furnishRoom(m, r, ob.rooms[0], ['register', 'desk', 'locker', 'vending'], 4);
  const psp = findSpot(m, r, 9, 6, { x0: 2, y0: 2, x1: W - 2, y1: by - 1 }, 1, 80) || findSpot(m, r, 9, 6, { x0: bx + bw + 2, y0: 2, x1: W - 2, y1: py }, 1, 80);
  if (psp) { groundRect(m, psp.x, psp.y, 9, 6, T.SIDEWALK); for (let yy = 1; yy < 5; yy++) for (let xx = 1; xx < 8; xx++) put(m, psp.x + xx, psp.y + yy, T.WATER); reserve(m, psp.x, psp.y, 9, 6); }
  for (let k = 0; k < 6; k++) { const x = r.int(4, W - 6); let ok = true; for (let yy = py + 2; yy < py + 5; yy++) for (let xx = x; xx < x + 2; xx++) if (m.tiles[MI(m, xx, yy)] !== T.ASPHALT || m.resv[MI(m, xx, yy)]) ok = false; if (ok) { const p = addProp(m, 'car', x, py + 2, 2, 3, { c: r.pick(CAR_COLORS), v: 1, f: 0 }); if (r() < 0.5) m.cont[MI(m, p.x, p.y + 2)] = { k: 'trunk', loot: rollLoot(r, CONT.trunk.loot), s: 0 }; } }
  const tsp = findSpot(m, r, 3, 5, { x0: 3, y0: py, x1: W - 3, y1: py + 11 }, 0, 40);
  if (tsp) addProp(m, 'trailer', tsp.x, tsp.y, 3, 5, { c: '#d6d2c4', v: 1 });
  guard(m, bx + Math.floor(bw / 2), py + 5, 4);
  reserve(m, 3, py, W - 6, 11);
  scatterGreen(m, r, 0.04, 0.04, 2);
  placeStart(m, r, rdx, H - 7);
}

// ----- колония -----
function genPrison(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.DIRT, T.GRASS, 6, 0.6);
  const gx = Math.floor(W / 2) - 2;
  groundRect(m, gx, H - 12, 4, 12, T.ASPHALT);
  reserve(m, gx - 3, H - 11, 10, 11);
  const ring = (mg, gap) => {
    const x0 = mg, y0 = mg, x1 = W - 1 - mg, y1 = H - 11 - mg;
    for (let x = x0; x <= x1; x++) { put(m, x, y0, T.FENCE); m.meta[MI(m, x, y0)] = 1; if (x < gap || x > gap + 3) { put(m, x, y1, T.FENCE); m.meta[MI(m, x, y1)] = 1; } }
    for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) { put(m, x, y, T.FENCE); m.meta[MI(m, x, y)] = 1; }
    reserve(m, x0 - 1, y0 - 1, x1 - x0 + 3, 3); reserve(m, x0 - 1, y1 - 1, x1 - x0 + 3, 3);
    reserve(m, x0 - 1, y0, 3, y1 - y0); reserve(m, x1 - 1, y0, 3, y1 - y0);
    return [x0, y0, x1, y1];
  };
  const [ox0, oy0, ox1, oy1] = ring(2, gx);
  const [ix0, iy0, ix1, iy1] = ring(5, gx);
  groundRect(m, gx, oy1, 4, H - oy1, T.ASPHALT);
  groundRect(m, ix0 + 1, iy0 + 1, ix1 - ix0 - 1, iy1 - iy0 - 1, T.ASPHALT);
  for (const [tx, ty] of [[ox0 + 1, oy0 + 1], [ox1 - 2, oy0 + 1], [ox0 + 1, oy1 - 2], [ox1 - 2, oy1 - 2]]) addProp(m, 'tower', tx, ty, 2, 2, { tall: true });
  const area = { x0: ix0 + 2, y0: iy0 + 2, x1: ix1 - 1, y1: iy1 - 2 };
  const left = r() < 0.5, bx0 = left ? ix0 + 3 : ix1 - 3 - 28, ox = left ? ix0 + 3 + 28 + 4 : ix0 + 3;
  for (let k = 0; k < 2; k++) {
    const sy = iy0 + 3 + k * 15;
    if (sy + 11 > iy1 - 2) break;
    const cb = corridorBuilding(m, r, bx0, sy, 28, 11, { wall: T.WALL, floor: T.CONCRETE, rw: [3, 4], entrance: true, metal: true, cellDoor: 'open' });
    for (const rm of [...cb.north, ...cb.south]) { if (rm.lobby) continue; placeItem(m, r, rm.x, rm.y + (rm.south ? rm.h - 1 : 0), 'furn:cot'); if (r() < 0.55) addCont(m, r, rm.x + rm.w - 1, rm.y + (rm.south ? rm.h - 1 : 0), r() < 0.8 ? 'locker' : 'pantry'); }
  }
  let sp = isFree(m, ox - 1, iy0 + 2, 16, 11) ? { x: ox, y: iy0 + 3 } : findSpot(m, r, 14, 9, area, 1);
  if (sp) { const ad = building(m, r, sp.x, sp.y, 14, 9, { wall: T.BRICK, floor: T.TILE, minRoom: 3, maxDepth: 2, doors: 2, windows: 4 }); const rooms = ad.rooms.slice().sort((a, c) => a.w * a.h - c.w * c.h); furnishRoom(m, r, rooms[0], ['armory', 'evidence'], 2); for (const rm of rooms.slice(1)) furnishRoom(m, r, rm, ['desk', 'medcab', 'locker', 'shelf'], 3); }
  sp = isFree(m, ox - 1, iy0 + 15, 14, 10) ? { x: ox, y: iy0 + 16 } : findSpot(m, r, 12, 8, area, 1);
  if (sp) { const cn = building(m, r, sp.x, sp.y, 12, 8, { wall: T.WALL, floor: T.TILE, split: false, doors: 2, windows: 3 }); furnishRoom(m, r, cn.rooms[0], ['fridge', 'pantry', 'foodcrate', 'furn:table', 'furn:table', 'furn:table'], 8); }
  for (let k = 0; k < 6; k++) { const s2 = findSpot(m, r, 1, 1, area, 1, 40); if (s2) { placeItem(m, r, s2.x, s2.y, 'furn:bench'); reserve(m, s2.x, s2.y, 1, 1); } }
  scatterGreen(m, r, 0.015, 0.03, 2);
  placeStart(m, r, gx, H - 7);
}

// ----- лагерь группировки -----
function genRaidCamp(m, r) {
  const W = m.w, H = m.h, big = m.v === 1;
  baseGround(m, T.DIRT, T.GRASS, 6, 0.6);
  const cw = big ? 36 : 30, ch = big ? 30 : 26, cx0 = Math.floor((W - cw) / 2), cy0 = 3;
  const gate = cx0 + Math.floor(cw / 2) - 1, rdx = gate;
  groundRect(m, rdx, cy0 + ch, 3, H - cy0 - ch, T.DIRT);
  reserve(m, rdx - 1, cy0 + ch - 1, 5, H - cy0 - ch + 1); reserve(m, rdx - 3, H - 11, 9, 11);
  // баррикада: забор, мешки и машины по кругу, ворота снизу
  for (let x = cx0; x < cx0 + cw; x++) for (const y of [cy0, cy0 + ch - 1]) {
    if (y === cy0 + ch - 1 && x >= gate && x < gate + 3) continue;
    put(m, x, y, (x + y) % 7 < 2 ? T.SANDBAG : T.FENCE); m.meta[MI(m, x, y)] = big ? 1 : 0;
  }
  for (let y = cy0; y < cy0 + ch; y++) for (const x of [cx0, cx0 + cw - 1]) { put(m, x, y, (x + y) % 6 < 2 ? T.SANDBAG : T.FENCE); m.meta[MI(m, x, y)] = big ? 1 : 0; }
  reserve(m, cx0 - 1, cy0 - 1, cw + 2, 2); reserve(m, cx0 - 1, cy0 + ch - 2, cw + 2, 3);
  reserve(m, cx0 - 1, cy0, 2, ch); reserve(m, cx0 + cw - 2, cy0, 3, ch);
  const area = { x0: cx0 + 2, y0: cy0 + 2, x1: cx0 + cw - 2, y1: cy0 + ch - 3 };
  const sp = findSpot(m, r, big ? 14 : 9, big ? 9 : 7, area, 1);
  if (sp) {
    const mb = building(m, r, sp.x, sp.y, big ? 14 : 9, big ? 9 : 7, { wall: big ? T.BRICK : T.WWALL, floor: big ? T.CONCRETE : T.WOOD, minRoom: 3, maxDepth: big ? 2 : 1, doors: 2, windows: 3 });
    const rooms = mb.rooms.slice().sort((a, c) => a.w * a.h - c.w * c.h);
    furnishRoom(m, r, rooms[0], ['armory', 'ration', 'foodcrate'], 3);
    for (const rm of rooms.slice(1)) furnishRoom(m, r, rm, ['foodcrate', 'ration', 'furn:bed', 'crate', 'drum', 'medcab'], 4);
    guard(m, sp.x + 3, sp.y + (big ? 10 : 8), 2);
  }
  tents(m, r, area, big ? 5 : 4);
  tentStash(m, r, ['crate', 'foodcrate', 'ration', 'drum', 'medcab'], 0.7);
  const fsp = findSpot(m, r, 1, 1, area, 2);
  if (fsp) { campfire(m, fsp.x, fsp.y); guard(m, fsp.x, fsp.y, 3); }
  if (isFree(m, gate - 4, cy0 + ch - 5, 2, 2)) addProp(m, 'tower', gate - 4, cy0 + ch - 5, 2, 2, { tall: true });
  guard(m, gate + 1, cy0 + ch - 3, 2);
  for (let k = 0; k < 2; k++) { const s2 = findSpot(m, r, 3, 6, area, 1, 60); if (s2) addCar(m, r, s2.x, s2.y, true, 'truck', 'ration', 0.7); }
  for (let k = 0; k < 6; k++) { const s2 = findSpot(m, r, 1, 1, area, 1, 40); if (s2) { addCont(m, r, s2.x, s2.y, r.pick(['crate', 'drum', 'ration', 'pallet'])); reserve(m, s2.x, s2.y, 1, 1); } }
  const nc = big ? 2 : 1;
  for (let k = 0; k < nc; k++) { const s2 = findSpot(m, r, 1, 1, area, 1, 80); if (s2) captive(m, r, s2.x, s2.y); }
  scatterGreen(m, r, 0.04, 0.04, 2);
  placeStart(m, r, rdx, H - 7);
}

// ----- карта базы: насосная станция и всё, что построено -----
const BASE_W = 40, BASE_H = 36;
function genBase(st) {
  const W = BASE_W, H = BASE_H, seed = st.seed || 777;
  const m = newMap(W, H, seed), r = makeRng(seed), B = st.build;
  m.v = 0; m.loc = 'base'; m.isBase = true;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.62);
  const fx0 = 4, fy0 = 3, fx1 = 35, fy1 = 30, gx = 19;
  groundRect(m, fx0 + 1, fy0 + 1, fx1 - fx0 - 1, fy1 - fy0 - 1, T.DIRT);
  groundRect(m, gx, fy1, 3, H - fy1, T.DIRT);
  for (let y = fy1; y < H; y++) { m.meta[MI(m, gx, y)] |= 2; m.meta[MI(m, gx + 2, y)] |= 2; }
  groundRect(m, gx, 14, 3, fy1 - 14, T.DIRT);
  // насосная станция
  const sb = building(m, r, 15, 5, 12, 9, { wall: T.WALL, floor: T.CONCRETE, minRoom: 4, maxDepth: 1, doors: 0, windows: 0 });
  makeDoor(m, sb, 20, 13, 'open'); makeDoor(m, sb, 26, 9, 'closed');
  for (const [x, y] of [[17, 5], [23, 5], [15, 9], [18, 13], [24, 13]]) if (!nearDoor(m, x, y, 1)) put(m, x, y, T.WINDOW);
  const rooms = sb.rooms.slice().sort((a, c) => c.w * c.h - a.w * a.h);
  furnishRoom(m, r, rooms[0], ['furn:bunk', 'furn:bunk', 'furn:table', 'locker', 'shelf'], 6);
  for (const rm of rooms.slice(1)) furnishRoom(m, r, rm, ['shelf', 'crate', 'drum', 'locker', 'fridge'], 3);
  // периметр
  if (B.walls >= 1) {
    const wallT = B.walls >= 3 ? T.WALL : T.FENCE;
    for (let x = fx0; x <= fx1; x++) for (const y of [fy0, fy1]) { if (y === fy1 && x >= gx && x <= gx + 2) continue; put(m, x, y, wallT); m.meta[MI(m, x, y)] = 0; }
    for (let y = fy0; y <= fy1; y++) for (const x of [fx0, fx1]) { put(m, x, y, wallT); m.meta[MI(m, x, y)] = 0; }
    if (B.walls >= 3) for (const x of [gx - 1, gx + 3]) put(m, x, fy1, T.WALL);
  } else {
    for (let x = fx0 + 1; x < fx1; x += 1) for (const y of [fy0, fy1]) { if (y === fy1 && x >= gx - 1 && x <= gx + 3) continue; if (r() < 0.22) put(m, x, y, r() < 0.5 ? T.CRATE : T.DRUM); }
  }
  if (B.walls >= 2) {
    for (let x = fx0 - 2; x <= fx1 + 2; x++) for (const y of [fy0 - 2, fy1 + 2]) { if (!inb(m, x, y) || (y === fy1 + 2 && x >= gx - 1 && x <= gx + 3)) continue; put(m, x, y, T.FENCE); m.meta[MI(m, x, y)] = 1; }
    for (let y = fy0 - 2; y <= fy1 + 2; y++) for (const x of [fx0 - 2, fx1 + 2]) { if (inb(m, x, y)) { put(m, x, y, T.FENCE); m.meta[MI(m, x, y)] = 1; } }
    for (const x of [gx - 2, gx + 4]) for (let k = 0; k < 2; k++) put(m, x, fy1 - 1 - k, T.SANDBAG);
    for (let k = -1; k <= 3; k++) if (k < 0 || k > 2) put(m, gx + k, fy1 - 3, T.SANDBAG);
  }
  if (B.walls >= 3) { addProp(m, 'tower', fx0 + 1, fy1 - 3, 2, 2, { tall: true }); addProp(m, 'tower', fx1 - 2, fy1 - 3, 2, 2, { tall: true }); addProp(m, 'tower', fx0 + 1, fy0 + 1, 2, 2, { tall: true }); }
  // огород — грядки слева
  const beds = [2, 2, 4, 6][B.garden] - (B.garden ? 0 : 1);
  for (let k = 0; k < beds; k++) {
    const x = 6 + (k % 2) * 4, y = 7 + Math.floor(k / 2) * 3;
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 3; xx++) { setGround(m, x + xx, y + yy, T.DIRT); put(m, x + xx, y + yy, B.garden ? T.CROP : T.DIRT); m.meta[MI(m, x + xx, y + yy)] = k % 2; }
  }
  if (B.garden >= 3) addCont(m, r, 13, 7, 'seeds');
  // вода — бочки и башня справа
  const nd = [1, 2, 4, 6][B.water];
  for (let k = 0; k < nd; k++) put(m, 29 + (k % 3) * 2, 6 + Math.floor(k / 3) * 2, T.DRUM);
  if (B.water >= 2) addProp(m, 'wtower', 30, 10, 2, 2, { tall: true });
  // рация
  if (B.radio >= 1) addProp(m, 'mast', 27, 5, 1, 1, { tall: true, hgt: B.radio >= 2 ? 6 : 4 });
  // лазарет слева внизу
  if (B.infirmary >= 1) {
    addProp(m, 'medtent', 7, 19, 3, 3, { c: '#d6d2c4' });
    put(m, 6, 23, T.FURN); m.meta[MI(m, 6, 23)] = FURN_V.cot;
    if (B.infirmary >= 2) { put(m, 8, 23, T.FURN); m.meta[MI(m, 8, 23)] = FURN_V.cot; put(m, 11, 19, T.MEDCAB); }
    if (B.infirmary >= 3) { put(m, 10, 23, T.FURN); m.meta[MI(m, 10, 23)] = FURN_V.cot; put(m, 11, 20, T.MEDCAB); }
  }
  // мастерская справа внизу
  if (B.workshop >= 1) { put(m, 28, 18, T.BENCH); put(m, 29, 18, T.CRATE); put(m, 27, 18, T.CRATE); }
  if (B.workshop >= 2) { const wb = building(m, r, 27, 22, 7, 5, { wall: T.WWALL, floor: T.CONCRETE, split: false, doors: 0 }); makeDoor(m, wb, 29, 22, 'open'); put(m, 28, 24, T.BENCH); put(m, 32, 24, T.DRUM); put(m, 32, 23, T.SHELF); }
  if (B.workshop >= 3) addProp(m, 'machine', 31, 17, 3, 2, { c: '#5d6b70' });
  // костёр, лавки, машина
  campfire(m, 20, 20);
  for (const [x, y] of [[18, 20], [22, 20]]) { put(m, x, y, T.FURN); m.meta[MI(m, x, y)] = FURN_V.bench; }
  addProp(m, 'car', 15, 25, 2, 3, { c: '#8a3424', v: 1, f: 1 });
  for (const k in m.cont) m.cont[k].loot = {};
  m.start = { x: 20, y: 22 };
  m.evac = [];
  m.idle = [[19, 19], [21, 19], [19, 21], [21, 21], [20, 15], [12, 12], [26, 19], [11, 22], [24, 23], [16, 17]];
  m.gate = { x: gx + 1, y: fy1 };
  const reach = finalize(m);
  return { m, reach };
}
