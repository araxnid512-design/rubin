'use strict';
// ---------- Генерация карт локаций ----------

const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function newMap(w, h, seed) {
  const n = w * h;
  return {
    w, h, n, seed,
    tiles: new Uint8Array(n), ground: new Uint8Array(n), meta: new Uint8Array(n), resv: new Uint8Array(n),
    cont: {}, doorHP: {}, props: [], decals: [], buildings: [], indoor: [], evac: [], edge: [], start: { x: 0, y: 0 },
  };
}
const MI = (m, x, y) => y * m.w + x;
const inb = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
const isDoorT = t => t === T.DOOR || t === T.DOOR_OPEN || t === T.DOOR_BROKEN;

function put(m, x, y, t) {
  if (!inb(m, x, y)) return;
  const i = MI(m, x, y);
  m.tiles[i] = t;
  if (TP[t].floor) m.ground[i] = t;
}
function setGround(m, x, y, g) {
  if (!inb(m, x, y)) return;
  const i = MI(m, x, y);
  m.ground[i] = g;
  if (TP[m.tiles[i]].floor) m.tiles[i] = g;
}
function groundRect(m, x, y, w, h, g) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setGround(m, xx, yy, g); }
function reserve(m, x, y, w, h) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inb(m, xx, yy)) m.resv[MI(m, xx, yy)] = 1; }
function isFree(m, x, y, w, h) {
  if (x < 1 || y < 1 || x + w > m.w - 1 || y + h > m.h - 1) return false;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (m.resv[MI(m, xx, yy)]) return false;
  return true;
}
function findSpot(m, r, w, h, a, margin = 1, tries = 300) {
  for (let k = 0; k < tries; k++) {
    const x = r.int(a.x0, Math.max(a.x0, a.x1 - w)), y = r.int(a.y0, Math.max(a.y0, a.y1 - h));
    if (isFree(m, x - margin, y - margin, w + margin * 2, h + margin * 2)) return { x, y };
  }
  return null;
}
function nearDoor(m, x, y, d = 1) {
  for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) if (inb(m, xx, yy) && isDoorT(m.tiles[MI(m, xx, yy)])) return true;
  return false;
}
function touchesWall(m, x, y) {
  for (const [dx, dy] of DIR4) { const nx = x + dx, ny = y + dy; if (inb(m, nx, ny) && TP[m.tiles[MI(m, nx, ny)]].wall) return true; }
  return false;
}
function furnAround(m, x, y) {
  let c = 0;
  for (const [dx, dy] of DIR8) { const nx = x + dx, ny = y + dy; if (inb(m, nx, ny) && TP[m.tiles[MI(m, nx, ny)]].furn) c++; }
  return c;
}
// Прямоугольник целиком из пола и без дверей рядом
function clearRect(m, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (!inb(m, xx, yy) || !TP[m.tiles[MI(m, xx, yy)]].floor) return false;
    if (nearDoor(m, xx, yy, 1)) return false;
  }
  return true;
}

function rollLoot(r, table) {
  const out = {};
  for (const k in table) { const [p, lo, hi] = table[k]; if (r() < p * LOOT_MUL) out[k] = r.int(lo, hi); }
  return out;
}
function addCont(m, r, x, y, kind) {
  const C = CONT[kind];
  if (C.tile != null) put(m, x, y, C.tile);
  m.cont[MI(m, x, y)] = { k: kind, loot: rollLoot(r, C.loot), s: 0 };
}
const FURN_V = { bed: 0, table: 1, sofa: 2, bench: 3, pew: 4, desk: 5, bunk: 6, counter: 7, cot: 8 };
let LOOT_MUL = 1;   // меньше добычи при повторных вылазках
function placeItem(m, r, x, y, item) {
  if (item.startsWith('furn:')) { put(m, x, y, T.FURN); m.meta[MI(m, x, y)] = FURN_V[item.slice(5)] || 0; }
  else if (item === 'hay') put(m, x, y, T.HAY);
  else addCont(m, r, x, y, item);
}
function addProp(m, k, x, y, w, h, o = {}) {
  const p = Object.assign({ k, x, y, w, h }, o);
  m.props.push(p);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(m, xx, yy, o.tall ? T.BLOCKH : T.BLOCK);
  reserve(m, x, y, w, h);
  return p;
}
const CAR_COLORS = ['#6f7f8c', '#8c3a2b', '#3f5b43', '#a39a86', '#2f3f5c', '#7a6a3a', '#5a4a5c', '#b0b0a8'];
function addCar(m, r, x, y, vertical, k = 'car', trunkKind = 'trunk', trunkChance = 0.55) {
  const long = k === 'truck' ? 6 : 4, wide = k === 'truck' ? 3 : 2;
  const p = addProp(m, k, x, y, vertical ? wide : long, vertical ? long : wide, { c: r.pick(CAR_COLORS), v: vertical ? 1 : 0, f: r() < 0.5 ? 1 : 0 });
  if (r() < trunkChance) {
    // багажник — у «задней» стороны
    const tx = vertical ? p.x + (r() < 0.5 ? 0 : p.w - 1) : (p.f ? p.x : p.x + p.w - 1);
    const ty = vertical ? (p.f ? p.y : p.y + p.h - 1) : p.y + (r() < 0.5 ? 0 : p.h - 1);
    m.cont[MI(m, tx, ty)] = { k: trunkKind, loot: rollLoot(r, CONT[trunkKind].loot), s: 0 };
  }
  return p;
}

// ----- Здания -----
function makeDoor(m, b, x, y, state, metal) {
  const i = MI(m, x, y);
  m.ground[i] = b.o.floor;
  m.tiles[i] = state === 'open' ? T.DOOR_OPEN : state === 'broken' ? T.DOOR_BROKEN : T.DOOR;
  if (metal) m.meta[i] |= 1;
  m.doorHP[i] = metal ? 12 : 6;
  b.doors.push({ x, y });
}
const hasDoorAt = (b, x, y) => b.doors.some(d => d.x === x && d.y === y);
function innerDoorState(r, o) {
  if (o.innerDoor) return o.innerDoor;
  const v = r();
  return v < 0.45 ? 'closed' : v < 0.9 ? 'open' : 'broken';
}
function splitRooms(m, r, rc, o, b, depth) {
  const min = o.minRoom || 4, maxD = o.maxDepth ?? 3;
  const canV = rc.w >= min * 2 + 1, canH = rc.h >= min * 2 + 1;
  if (depth >= maxD || (!canV && !canH) || (depth > 0 && rc.w * rc.h < (o.stopArea || 36) && r() < 0.5)) { b.rooms.push(rc); return; }
  const vert = canV && canH ? (rc.w > rc.h * 1.25 ? true : rc.h > rc.w * 1.25 ? false : r() < 0.5) : canV;
  const inner = o.inner || o.wall;
  for (let a = 0; a < 10; a++) {
    if (vert) {
      const sx = rc.x + r.int(min, rc.w - min - 1);
      if (hasDoorAt(b, sx, rc.y - 1) || hasDoorAt(b, sx, rc.y + rc.h)) continue;
      for (let yy = rc.y; yy < rc.y + rc.h; yy++) put(m, sx, yy, inner);
      makeDoor(m, b, sx, rc.y + r.int(0, rc.h - 1), innerDoorState(r, o));
      splitRooms(m, r, { x: rc.x, y: rc.y, w: sx - rc.x, h: rc.h }, o, b, depth + 1);
      splitRooms(m, r, { x: sx + 1, y: rc.y, w: rc.x + rc.w - sx - 1, h: rc.h }, o, b, depth + 1);
      return;
    } else {
      const sy = rc.y + r.int(min, rc.h - min - 1);
      if (hasDoorAt(b, rc.x - 1, sy) || hasDoorAt(b, rc.x + rc.w, sy)) continue;
      for (let xx = rc.x; xx < rc.x + rc.w; xx++) put(m, xx, sy, inner);
      makeDoor(m, b, rc.x + r.int(0, rc.w - 1), sy, innerDoorState(r, o));
      splitRooms(m, r, { x: rc.x, y: rc.y, w: rc.w, h: sy - rc.y }, o, b, depth + 1);
      splitRooms(m, r, { x: rc.x, y: sy + 1, w: rc.w, h: rc.y + rc.h - sy - 1 }, o, b, depth + 1);
      return;
    }
  }
  b.rooms.push(rc);
}
// Точка на внешней стене: [x стены, y стены, x внутри, y внутри, x снаружи, y снаружи]
function wallPoint(r, b, side) {
  const { x, y, w, h } = b;
  if (side === 'n' || side === 's') {
    const dx = r.int(x + 2, x + w - 3), dy = side === 'n' ? y : y + h - 1;
    return [dx, dy, dx, side === 'n' ? y + 1 : y + h - 2, dx, side === 'n' ? y - 1 : y + h];
  }
  const dy = r.int(y + 2, y + h - 3), dx = side === 'w' ? x : x + w - 1;
  return [dx, dy, side === 'w' ? x + 1 : x + w - 2, dy, side === 'w' ? x - 1 : x + w, dy];
}
function building(m, r, x, y, w, h, o) {
  const b = { x, y, w, h, o, rooms: [], doors: [] };
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const i = MI(m, xx, yy);
    m.ground[i] = o.floor;
    m.tiles[i] = (xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1) ? o.wall : o.floor;
  }
  if (o.split === false) b.rooms.push({ x: x + 1, y: y + 1, w: w - 2, h: h - 2 });
  else splitRooms(m, r, { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }, o, b, 0);
  const sides = o.doorSides || ['n', 's', 'e', 'w'];
  let made = 0;
  for (let k = 0; k < 80 && made < (o.doors ?? 2); k++) {
    const [dx, dy, ix, iy, ox, oy] = wallPoint(r, b, r.pick(sides));
    if (!inb(m, ox, oy) || !TP[m.tiles[MI(m, ix, iy)]].floor || TP[m.tiles[MI(m, ox, oy)]].wall) continue;
    if (b.doors.some(d => cheb(d.x, d.y, dx, dy) < 3 && (d.x === x || d.y === y || d.x === x + w - 1 || d.y === y + h - 1))) continue;
    const v = r();
    makeDoor(m, b, dx, dy, o.extDoor || (v < 0.6 ? 'closed' : v < 0.85 ? 'open' : 'broken'), o.metal);
    made++;
  }
  for (let k = 0, made2 = 0; k < 80 && made2 < (o.windows || 0); k++) {
    const [dx, dy, ix, iy, ox, oy] = wallPoint(r, b, r.pick(['n', 's', 'e', 'w']));
    if (!inb(m, ox, oy) || !TP[m.tiles[MI(m, ix, iy)]].floor || TP[m.tiles[MI(m, ox, oy)]].wall) continue;
    if (nearDoor(m, dx, dy, 1) || m.tiles[MI(m, dx, dy)] === T.WINDOW) continue;
    put(m, dx, dy, T.WINDOW);
    made2++;
  }
  reserve(m, x - 1, y - 1, w + 2, h + 2);
  m.buildings.push(b);
  return b;
}
// Широкий проём в стене (амбар, гараж)
function opening(m, b, side, len) {
  const { x, y, w, h } = b;
  if (side === 'n' || side === 's') {
    const sx = x + Math.floor((w - len) / 2), yy = side === 'n' ? y : y + h - 1;
    for (let k = 0; k < len; k++) put(m, sx + k, yy, b.o.floor);
  } else {
    const sy = y + Math.floor((h - len) / 2), xx = side === 'w' ? x : x + w - 1;
    for (let k = 0; k < len; k++) put(m, xx, sy + k, b.o.floor);
  }
}
function furnishRoom(m, r, rm, pal, n) {
  const cands = [];
  for (let yy = rm.y; yy < rm.y + rm.h; yy++) for (let xx = rm.x; xx < rm.x + rm.w; xx++) {
    if (!TP[m.tiles[MI(m, xx, yy)]].floor || !touchesWall(m, xx, yy) || nearDoor(m, xx, yy, 1)) continue;
    cands.push([xx, yy]);
  }
  shuffle(cands, r);
  for (const [xx, yy] of cands) {
    if (n <= 0) break;
    if (!TP[m.tiles[MI(m, xx, yy)]].floor || furnAround(m, xx, yy) > 1) continue;
    placeItem(m, r, xx, yy, r.pick(pal));
    n--;
  }
}
function furnish(m, r, b, pal, per = 10) {
  for (const rm of b.rooms) furnishRoom(m, r, rm, pal, Math.max(1, Math.round(rm.w * rm.h / per)));
}

function placeStart(m, r, x, y) {
  addProp(m, 'car', x, y, 2, 3, { c: '#8a3424', start: true, v: 1 });
  m.start = { x: x + 1, y: y + 1 };
  m.evac = [];
  for (let yy = y - 2; yy <= y + 4; yy++) for (let xx = x - 2; xx <= x + 3; xx++) {
    if (!inb(m, xx, yy)) continue;
    const i = MI(m, xx, yy);
    if (TP[m.tiles[i]].walk) m.evac.push(i);
  }
}
function baseGround(m, a, b, sc, thr) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) put(m, x, y, vnoise(m.seed, x, y, sc) > thr ? b : a);
}
function scatterGreen(m, r, pTree, pBush, belt = 2) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = MI(m, x, y);
    if (m.resv[i]) continue;
    const t = m.tiles[i];
    if (t !== T.GRASS && t !== T.DIRT) continue;
    const d = Math.min(x, y, m.w - 1 - x, m.h - 1 - y);
    if (d < belt && r() < 0.5) put(m, x, y, T.TREE);
    else if (vnoise(m.seed + 7, x, y, 5) > 0.76 && r() < 0.55) put(m, x, y, T.TREE);
    else if (r() < pTree) put(m, x, y, T.TREE);
    else if (r() < pBush) put(m, x, y, T.BUSH);
  }
}
function fenceLine(m, x0, y0, x1, y1, meta, gapEvery = 0) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let k = 0; k <= n; k++) {
    const x = x0 + Math.sign(x1 - x0) * k, y = y0 + Math.sign(y1 - y0) * k;
    if (gapEvery && k % gapEvery >= gapEvery - 2) continue;
    if (!inb(m, x, y)) continue;
    const i = MI(m, x, y);
    if (!TP[m.tiles[i]].floor) continue;
    m.tiles[i] = T.FENCE; m.meta[i] = meta;
  }
}

// ----- Ферма -----
function genFarm(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 7, 0.72);
  const rx = r.int(27, 33), ry = r.int(24, 30);
  reserve(m, rx - 3, H - 11, 9, 11);
  groundRect(m, rx, 0, 3, H, T.DIRT);
  for (let y = 0; y < H; y++) { m.meta[MI(m, rx, y)] |= 2; m.meta[MI(m, rx + 2, y)] |= 2; }
  groundRect(m, 3, ry, W - 6, 3, T.DIRT);
  for (let x = 3; x < W - 3; x++) if (x < rx || x > rx + 2) { m.meta[MI(m, x, ry)] |= 4; m.meta[MI(m, x, ry + 2)] |= 4; }
  reserve(m, rx - 1, 0, 5, H); reserve(m, 2, ry - 1, W - 4, 5);

  const side = r() < 0.5 ? -1 : 1;
  const hw = r.int(13, 16), hh = r.int(9, 11);
  const hx = side < 0 ? rx - 2 - hw - r.int(0, 3) : rx + 5 + r.int(0, 3), hy = ry - hh - r.int(2, 4);
  const house = building(m, r, hx, hy, hw, hh, { wall: T.WWALL, floor: T.WOOD, minRoom: 3, maxDepth: 3, doors: 2, windows: 5, doorSides: side < 0 ? ['e', 's'] : ['w', 's'] });
  furnish(m, r, house, ['fridge', 'pantry', 'desk', 'furn:bed', 'furn:table', 'furn:sofa', 'locker', 'gun', 'medcab', 'pantry'], 8);

  const bw = r.int(14, 17), bh = r.int(10, 12);
  const bx = side < 0 ? rx + 5 + r.int(0, 3) : rx - 2 - bw - r.int(0, 3), by = ry - bh - r.int(2, 4);
  const barn = building(m, r, bx, by, bw, bh, { wall: T.WWALL, floor: T.DIRT, split: false, doors: 1, doorSides: ['n'] });
  opening(m, barn, side < 0 ? 'w' : 'e', 3);
  for (let k = 0; k < 3; k++) {
    const hx2 = r.int(bx + 2, bx + bw - 5), hy2 = r.int(by + 2, by + bh - 4);
    if (clearRect(m, hx2 - 1, hy2 - 1, 4, 4)) for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) put(m, hx2 + xx, hy2 + yy, T.HAY);
  }
  furnish(m, r, barn, ['seeds', 'crate', 'drum', 'toolbox', 'seeds', 'pallet'], 14);

  const yard = { x0: Math.min(hx, bx) - 6, y0: 3, x1: Math.max(hx + hw, bx + bw) + 6, y1: ry - 1 };
  for (let k = 0; k < 3; k++) {
    const sp = findSpot(m, r, 5, 5, yard, 1);
    if (!sp) continue;
    const sh = building(m, r, sp.x, sp.y, 5, 5, { wall: T.WWALL, floor: T.DIRT, split: false, doors: 1 });
    furnish(m, r, sh, ['crate', 'drum', 'toolbox', 'pallet'], 4);
  }
  let sp = findSpot(m, r, 3, 3, yard, 1); if (sp) addProp(m, 'silo', sp.x, sp.y, 3, 3, { tall: true });
  sp = findSpot(m, r, 1, 1, { x0: hx - 4, y0: hy - 4, x1: hx + hw + 4, y1: hy + hh + 4 }, 1); if (sp) { addCont(m, r, sp.x, sp.y, 'well'); reserve(m, sp.x, sp.y, 1, 1); }
  sp = findSpot(m, r, 2, 3, { x0: rx - 10, y0: ry + 4, x1: rx + 12, y1: ry + 16 }, 1); if (sp) addProp(m, 'tractor', sp.x, sp.y, 2, 3, { c: '#3d6b3a', v: 1 });
  sp = findSpot(m, r, 4, 2, yard, 1); if (sp) addCar(m, r, sp.x, sp.y, false, 'car', 'trunk', 0.8);

  // пруд
  sp = findSpot(m, r, 8, 6, { x0: 2, y0: 2, x1: W - 2, y1: H - 2 }, 1);
  if (sp && r() < 0.7) {
    for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 8; xx++) if (((xx - 3.5) / 4) ** 2 + ((yy - 2.5) / 3) ** 2 < 1) put(m, sp.x + xx, sp.y + yy, T.WATER);
    reserve(m, sp.x, sp.y, 8, 6);
  }
  // поля
  for (let k = 0; k < 16; k++) {
    const fw = r.int(9, 20), fh = r.int(7, 15);
    const f = findSpot(m, r, fw, fh, { x0: 2, y0: 2, x1: W - 2, y1: H - 2 }, 1);
    if (!f) continue;
    const corn = r() < 0.55 ? 1 : 0;
    for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) {
      setGround(m, f.x + xx, f.y + yy, T.DIRT);
      if (yy % 7 === 6) continue;
      put(m, f.x + xx, f.y + yy, T.CROP);
      m.meta[MI(m, f.x + xx, f.y + yy)] = corn;
    }
    if (r() < 0.6) fenceLine(m, f.x - 1, f.y - 1, f.x + fw, f.y - 1, 0, 7);
    if (r() < 0.4) fenceLine(m, f.x - 1, f.y + fh, f.x + fw, f.y + fh, 0, 7);
    reserve(m, f.x - 1, f.y - 1, fw + 2, fh + 2);
  }
  scatterGreen(m, r, 0.01, 0.025);
  placeStart(m, r, rx, H - 7);
}

// Квартал райцентра: кирпичные магазины, конторы и аптека вдоль улиц
function townBlock(m, r, x0, y0, x1, y1) {
  groundRect(m, x0, y0, x1 - x0 + 1, y1 - y0 + 1, T.SIDEWALK);
  const kinds = [
    ['mshelf', 'mshelf', 'register', 'cooler', 'foodcrate'],
    ['medcab', 'medcab', 'register', 'shelf'],
    ['desk', 'desk', 'locker', 'shelf', 'furn:table'],
    ['shelf', 'toolbox', 'crate', 'register'],
    ['fridge', 'furn:table', 'furn:counter', 'pantry', 'register'],
  ];
  for (let k = 0; k < 4; k++) {
    const bw = r.int(9, 14), bh = r.int(8, 10);
    const sp = findSpot(m, r, bw, bh, { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 }, 1, 60);
    if (!sp) continue;
    const b = building(m, r, sp.x, sp.y, bw, bh, { wall: T.BRICK, floor: r() < 0.5 ? T.TILE : T.WOOD, minRoom: 4, maxDepth: 2, doors: 2, windows: 6 });
    const pal = r.pick(kinds);
    furnish(m, r, b, pal, 7);
  }
}

// ----- Посёлок -----
function genSuburb(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.75);
  const vx = [r.int(12, 16), r.int(36, 42)], hy = [r.int(11, 15), r.int(34, 40)];
  for (const x of vx) { groundRect(m, x, 0, 3, H, T.ASPHALT); for (let y = 0; y < H; y++) m.meta[MI(m, x + 1, y)] |= 2; }
  for (const y of hy) { groundRect(m, 0, y, W, 3, T.ASPHALT); for (let x = 0; x < W; x++) m.meta[MI(m, x, y + 1)] |= 4; }
  for (const x of vx) for (const y of hy) for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 3; xx++) m.meta[MI(m, xx, yy)] &= ~6;
  // тротуары
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (m.ground[MI(m, x, y)] === T.ASPHALT) continue;
    let near = false;
    for (const [dx, dy] of DIR8) { const nx = x + dx, ny = y + dy; if (inb(m, nx, ny) && m.ground[MI(m, nx, ny)] === T.ASPHALT) near = true; }
    if (near) put(m, x, y, T.SIDEWALK);
  }
  for (const x of vx) reserve(m, x - 1, 0, 5, H);
  for (const y of hy) reserve(m, 0, y - 1, W, 5);
  reserve(m, vx[0] - 3, H - 11, 9, 11);
  const xs = [[1, vx[0] - 2], [vx[0] + 4, vx[1] - 2], [vx[1] + 4, W - 2]];
  const ys = [[1, hy[0] - 2], [hy[0] + 4, hy[1] - 2], [hy[1] + 4, H - 2]];
  for (const [x0, x1] of xs) for (const [y0, y1] of ys) {
    if (m.v === 1) { townBlock(m, r, x0, y0, x1, y1); continue; }
    for (let k = 0; k < 5; k++) {
      const dacha = m.v === 2;
      const hw = dacha ? r.int(5, 7) : r.int(8, 12), hh = dacha ? r.int(5, 6) : r.int(7, 9);
      const sp = findSpot(m, r, hw, hh, { x0: x0 + 2, y0: y0 + 2, x1: x1 - 2, y1: y1 - 2 }, 3, 60);
      if (!sp) continue;
      const brick = !dacha && r() < 0.5;
      const hb = building(m, r, sp.x, sp.y, hw, hh, { wall: brick ? T.BRICK : T.WWALL, floor: r() < 0.6 ? T.WOOD : T.TILE, minRoom: 3, maxDepth: dacha ? 1 : 3, doors: r.int(1, 2), windows: dacha ? 2 : 4 });
      if (dacha) furnish(m, r, hb, ['pantry', 'furn:bed', 'toolbox', 'seeds', 'furn:table', 'drum', 'fridge'], 6);
      else furnish(m, r, hb, ['fridge', 'pantry', 'desk', 'furn:bed', 'furn:sofa', 'furn:table', 'locker', 'medcab', 'shelf', 'gun', 'furn:bed'], 9);
      if (dacha) for (let g = 0; g < 2; g++) {
        const gx = sp.x + (g ? hw - 4 : 0), gy = sp.y + hh + 1;
        if (!isFree(m, gx, gy, 4, 2)) continue;
        for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 4; xx++) { setGround(m, gx + xx, gy + yy, T.DIRT); put(m, gx + xx, gy + yy, T.CROP); m.meta[MI(m, gx + xx, gy + yy)] = 0; }
      }
      // забор вокруг двора с калитками у дверей
      const fx = sp.x - 2, fy = sp.y - 2, fw = hw + 4, fh = hh + 4, meta = r() < 0.5 ? 0 : 2;
      const gates = hb.doors.filter(d => d.x === sp.x || d.y === sp.y || d.x === sp.x + hw - 1 || d.y === sp.y + hh - 1);
      for (let k2 = 0; k2 < fw; k2++) for (const yy of [fy, fy + fh - 1]) {
        const xx = fx + k2;
        if (gates.some(g => Math.abs(g.x - xx) <= 1) || r() < 0.08) continue;
        if (inb(m, xx, yy) && TP[m.tiles[MI(m, xx, yy)]].floor) { put(m, xx, yy, T.FENCE); m.meta[MI(m, xx, yy)] = meta; }
      }
      for (let k2 = 1; k2 < fh - 1; k2++) for (const xx of [fx, fx + fw - 1]) {
        const yy = fy + k2;
        if (gates.some(g => Math.abs(g.y - yy) <= 1) || r() < 0.08) continue;
        if (inb(m, xx, yy) && TP[m.tiles[MI(m, xx, yy)]].floor) { put(m, xx, yy, T.FENCE); m.meta[MI(m, xx, yy)] = meta; }
      }
      reserve(m, fx, fy, fw, fh);
    }
    const g = findSpot(m, r, 6, 5, { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 }, 1, 40);
    if (g) {
      const gb = building(m, r, g.x, g.y, 6, 5, { wall: T.BRICK, floor: T.CONCRETE, split: false, doors: 0 });
      opening(m, gb, r.pick(['n', 's']), 3);
      furnish(m, r, gb, ['crate', 'drum', 'toolbox', 'pallet'], 4);
    }
  }
  // машины на дорогах
  for (let k = 0; k < 9; k++) {
    if (r() < 0.5) {
      const x = r.pick(vx) + r.int(0, 1), y = r.int(2, H - 16);
      let ok = true;
      for (let yy = y; yy < y + 4; yy++) for (let xx = x; xx < x + 2; xx++) if (m.tiles[MI(m, xx, yy)] !== T.ASPHALT) ok = false;
      if (ok) addCar(m, r, x, y, true);
    } else {
      const y = r.pick(hy) + r.int(0, 1), x = r.int(2, W - 6);
      let ok = true;
      for (let yy = y; yy < y + 2; yy++) for (let xx = x; xx < x + 4; xx++) if (m.tiles[MI(m, xx, yy)] !== T.ASPHALT) ok = false;
      if (ok) addCar(m, r, x, y, false);
    }
  }
  for (let k = 0; k < (m.v === 1 ? 90 : 40); k++) {
    const x = r.int(1, W - 2), y = r.int(1, H - 14), i = MI(m, x, y);
    if ((m.tiles[i] === T.ASPHALT || m.tiles[i] === T.SIDEWALK) && !m.resv[i] && r() < 0.5) put(m, x, y, T.RUBBLE);
  }
  scatterGreen(m, r, m.v === 1 ? 0.01 : 0.035, m.v === 1 ? 0.015 : 0.035, 1);
  placeStart(m, r, vx[0], H - 7);
}

// ----- Завод -----
function genFactory(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.55);
  const fx0 = 3, fy0 = 3, fx1 = W - 4, fy1 = H - 11;
  groundRect(m, fx0, fy0, fx1 - fx0 + 1, fy1 - fy0 + 1, T.ASPHALT);
  const gx = r.int(22, 32);
  for (let x = fx0; x <= fx1; x++) {
    put(m, x, fy0, T.FENCE); m.meta[MI(m, x, fy0)] = 1;
    if (x < gx || x >= gx + 4) { put(m, x, fy1, T.FENCE); m.meta[MI(m, x, fy1)] = 1; }
  }
  const sgy = r.int(fy0 + 8, fy1 - 10), sgx = r() < 0.5 ? fx0 : fx1;
  for (let y = fy0; y <= fy1; y++) for (const x of [fx0, fx1]) {
    if (x === sgx && y >= sgy && y < sgy + 3) continue;
    put(m, x, y, T.FENCE); m.meta[MI(m, x, y)] = 1;
  }
  reserve(m, fx0 - 1, fy0 - 1, fx1 - fx0 + 3, 3); reserve(m, fx0 - 1, fy1 - 1, fx1 - fx0 + 3, 3);
  reserve(m, fx0 - 1, fy0 - 1, 3, fy1 - fy0 + 3); reserve(m, fx1 - 1, fy0 - 1, 3, fy1 - fy0 + 3);
  groundRect(m, gx, fy1, 4, H - fy1, T.ASPHALT);
  for (let y = fy1 + 1; y < H; y++) m.meta[MI(m, gx + 1, y)] |= 2;
  reserve(m, gx - 1, fy1 - 3, 6, H - fy1 + 3);
  reserve(m, gx - 3, H - 11, 10, 11);
  for (let y = sgy; y < sgy + 3; y++) for (let x = (sgx === fx0 ? 0 : fx1); x <= (sgx === fx0 ? fx0 : W - 1); x++) setGround(m, x, y, T.ASPHALT);
  const area = { x0: fx0 + 2, y0: fy0 + 2, x1: fx1 - 1, y1: fy1 - 2 };
  if (m.v === 1) {
    // пути и вагоны вдоль северного забора
    for (const ry of [fy0 + 3, fy0 + 7]) {
      for (let x = fx0 + 1; x < fx1; x++) for (let yy = ry; yy < ry + 2; yy++) { setGround(m, x, yy, T.DIRT); m.meta[MI(m, x, yy)] = yy === ry ? 16 : 32; }
      let x = fx0 + 2 + r.int(0, 4);
      while (x + 8 < fx1 - 1) {
        if (r() < 0.75) {
          const p = addProp(m, 'wagon', x, ry, 8, 2, { c: r.pick(['#6a3a2a', '#4a5a6a', '#5a4a3a', '#7a6a4a']), v: 0, f: 0, tall: true });
          if (r() < 0.7) m.cont[MI(m, p.x + 4, p.y + 1)] = { k: r.pick(['foodcrate', 'pallet', 'crate', 'ration']), loot: {}, s: 0 };
          const ct = m.cont[MI(m, p.x + 4, p.y + 1)]; if (ct) ct.loot = rollLoot(r, CONT[ct.k].loot);
        }
        x += 9 + r.int(0, 3);
      }
      reserve(m, fx0, ry - 1, fx1 - fx0, 4);
    }
    area.y0 = fy0 + 11;
    guard(m, Math.floor(W / 2), fy0 + 6, 5);
  }

  // главный цех
  const sw = r.int(24, 30), sh = r.int(14, 17);
  let sp = findSpot(m, r, sw, sh, { x0: area.x0, y0: area.y0, x1: area.x1, y1: area.y0 + sh + 10 }, 2) || findSpot(m, r, sw, sh, area, 2);
  if (sp) {
    const shop = building(m, r, sp.x, sp.y, sw, sh, { wall: T.WALL, floor: T.CONCRETE, minRoom: 6, maxDepth: 1, doors: 3, windows: 6, metal: true, innerDoor: 'open' });
    const big = shop.rooms.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
    for (let yy = big.y + 2; yy + 2 <= big.y + big.h - 2; yy += 4)
      for (let xx = big.x + 2; xx + 3 <= big.x + big.w - 2; xx += 5)
        if (r() < 0.8 && clearRect(m, xx - 1, yy - 1, 5, 4)) addProp(m, 'machine', xx, yy, 3, 2, { tall: r() < 0.5, c: r.pick(['#5d6b70', '#6b6450', '#56605a']) });
    furnish(m, r, shop, ['locker', 'toolbox', 'crate', 'drum', 'locker', 'toolbox'], 12);
  }
  // склад
  const ww = r.int(15, 18), wh = r.int(11, 13);
  sp = findSpot(m, r, ww, wh, area, 2);
  if (sp) {
    const wb = building(m, r, sp.x, sp.y, ww, wh, { wall: T.BRICK, floor: T.CONCRETE, split: false, doors: 2, windows: 2, metal: true });
    for (let yy = sp.y + 2; yy <= sp.y + wh - 3; yy += 3)
      for (let xx = sp.x + 2; xx <= sp.x + ww - 3; xx++) {
        if ((xx - sp.x - 2) % 6 === 5) continue;
        if (TP[m.tiles[MI(m, xx, yy)]].floor && !nearDoor(m, xx, yy, 1)) addCont(m, r, xx, yy, 'wshelf');
      }
  }
  // заводоуправление
  const ow = r.int(13, 15), oh = r.int(9, 11);
  sp = findSpot(m, r, ow, oh, area, 2);
  if (sp) {
    const ob = building(m, r, sp.x, sp.y, ow, oh, { wall: T.BRICK, floor: T.TILE, minRoom: 3, maxDepth: 3, doors: 2, windows: 5 });
    furnish(m, r, ob, ['desk', 'locker', 'medcab', 'furn:table', 'shelf', 'desk'], 8);
  }
  // котельная
  sp = findSpot(m, r, 8, 7, area, 2);
  if (sp) { const kb = building(m, r, sp.x, sp.y, 8, 7, { wall: T.BRICK, floor: T.CONCRETE, split: false, doors: 1, metal: true }); furnish(m, r, kb, ['drum', 'drum', 'toolbox', 'pallet'], 5); }
  // проходная у ворот
  sp = findSpot(m, r, 5, 4, { x0: gx - 9, y0: fy1 - 8, x1: gx + 13, y1: fy1 - 1 }, 1);
  if (sp) { const gb = building(m, r, sp.x, sp.y, 5, 4, { wall: T.WALL, floor: T.TILE, split: false, doors: 1, windows: 2 }); furnishRoom(m, r, gb.rooms[0], ['gun', 'desk'], 2); }
  // двор
  for (let k = 0; k < 3; k++) { const v = r() < 0.5; sp = findSpot(m, r, v ? 3 : 6, v ? 6 : 3, area, 1); if (sp) addCar(m, r, sp.x, sp.y, v, 'truck', 'trunk', 0.7); }
  sp = findSpot(m, r, 5, 3, area, 1);
  if (sp) { addProp(m, 'tank', sp.x, sp.y, 5, 3, { tall: true }); if (inb(m, sp.x + 5, sp.y + 1) && !m.resv[MI(m, sp.x + 5, sp.y + 1)]) { addCont(m, r, sp.x + 5, sp.y + 1, 'drum'); reserve(m, sp.x + 5, sp.y + 1, 1, 1); } }
  for (let k = 0; k < 7; k++) {
    sp = findSpot(m, r, 2, 2, area, 1);
    if (!sp) continue;
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) if (r() < 0.7) addCont(m, r, sp.x + xx, sp.y + yy, r() < 0.8 ? 'pallet' : 'crate');
    reserve(m, sp.x, sp.y, 2, 2);
  }
  for (let k = 0; k < 6; k++) { sp = findSpot(m, r, 1, 1, area, 1); if (sp) { addCont(m, r, sp.x, sp.y, 'drum'); reserve(m, sp.x, sp.y, 1, 1); } }
  for (let y = fy0 + 1; y < fy1; y++) for (let x = fx0 + 1; x < fx1; x++) {
    const i = MI(m, x, y);
    if (m.resv[i] || m.tiles[i] !== T.ASPHALT) continue;
    const n = vnoise(m.seed + 3, x, y, 4);
    if (n > 0.8) put(m, x, y, T.WATER); else if (n < 0.12 && r() < 0.5) put(m, x, y, T.RUBBLE);
  }
  scatterGreen(m, r, 0.02, 0.04, 2);
  placeStart(m, r, gx + 1, H - 7);
}

// ----- Больница -----
function genHospital(m, r) {
  const W = m.w, H = m.h;
  baseGround(m, T.GRASS, T.DIRT, 6, 0.8);
  const bw = r.int(46, 52), bh = 25, bx = Math.floor((W - bw) / 2), by = 4;
  const py0 = by + bh + 4, ph = 9;
  groundRect(m, 6, py0, W - 12, ph, T.ASPHALT);
  for (let x = 8; x < W - 8; x += 3) { m.meta[MI(m, x, py0)] |= 8; m.meta[MI(m, x, py0 + ph - 1)] |= 8; }
  const rdx = r.int(12, W - 16);
  groundRect(m, rdx, py0 + ph, 3, H - py0 - ph, T.ASPHALT);
  for (let y = py0 + ph; y < H; y++) m.meta[MI(m, rdx + 1, y)] |= 2;
  reserve(m, 5, py0 - 1, W - 10, ph + 2);
  reserve(m, rdx - 1, py0 + ph, 5, H - py0 - ph);
  reserve(m, rdx - 3, H - 11, 9, 11);

  const b = { x: bx, y: by, w: bw, h: bh, o: { floor: T.TILE }, rooms: [], doors: [] };
  for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) {
    const i = MI(m, xx, yy);
    m.ground[i] = T.TILE;
    m.tiles[i] = (xx === bx || yy === by || xx === bx + bw - 1 || yy === by + bh - 1) ? T.WALL : T.TILE;
  }
  const cy0 = by + 11;
  for (let xx = bx + 1; xx < bx + bw - 1; xx++) { put(m, xx, cy0 - 1, T.WALL); put(m, xx, cy0 + 3, T.WALL); }
  const mid = bx + Math.floor(bw / 2);
  const makeRow = (y0, h, doorY, south) => {
    let x = bx + 1;
    const end = bx + bw - 1;
    const rooms = [];
    while (end - x >= 3) {
      let w = r.int(5, 8);
      if (end - (x + w) < 6) w = end - x;
      rooms.push({ x, y: y0, w, h, south });
      x += w;
      if (x < end) { for (let yy = y0; yy < y0 + h; yy++) put(m, x, yy, T.WALL); x += 1; }
    }
    for (const rm of rooms) {
      const lobby = south && mid >= rm.x && mid + 1 < rm.x + rm.w;
      rm.lobby = lobby;
      const dx = lobby ? mid : rm.x + Math.floor(rm.w / 2);
      makeDoor(m, b, dx, doorY, lobby ? 'broken' : innerDoorState(r, {}));
      if (lobby) makeDoor(m, b, dx + 1, doorY, 'broken');
    }
    return rooms;
  };
  const north = makeRow(by + 1, cy0 - 1 - (by + 1), cy0 - 1, false);
  const south = makeRow(cy0 + 4, by + bh - 1 - (cy0 + 4), cy0 + 3, true);
  const lob = south.find(x => x.lobby);
  if (lob) { makeDoor(m, b, mid, by + bh - 1, 'open'); makeDoor(m, b, mid + 1, by + bh - 1, 'broken'); }
  else makeDoor(m, b, south[0].x + 1, by + bh - 1, 'open');
  makeDoor(m, b, bx, cy0 + 1, 'closed'); makeDoor(m, b, bx + bw - 1, cy0 + 1, 'closed');
  for (let k = 0; k < 10; k++) {
    const xx = r.int(bx + 2, bx + bw - 3);
    for (const yy of [by, by + bh - 1]) if (!nearDoor(m, xx, yy, 1) && m.tiles[MI(m, xx, yy)] === T.WALL && r() < 0.6) {
      const inner = yy === by ? yy + 1 : yy - 1;
      if (TP[m.tiles[MI(m, xx, inner)]].floor) put(m, xx, yy, T.WINDOW);
    }
  }
  const kinds = shuffle(['pharmacy', 'canteen', 'storage', 'office', 'office', 'ward', 'ward', 'ward', 'ward', 'ward', 'ward', 'ward', 'ward'], r);
  let ki = 0;
  for (const rm of [...north, ...south]) {
    b.rooms.push(rm);
    if (rm.lobby) { furnishRoom(m, r, rm, ['furn:sofa', 'desk', 'furn:bench'], 4); continue; }
    const k = kinds[ki++ % kinds.length];
    const n = Math.max(2, Math.round(rm.w * rm.h / 8));
    if (k === 'ward') furnishRoom(m, r, rm, ['furn:bed', 'furn:bed', 'furn:bed', 'medcab'], n);
    else if (k === 'pharmacy') furnishRoom(m, r, rm, ['medcab', 'medcab', 'shelf'], n + 1);
    else if (k === 'canteen') furnishRoom(m, r, rm, ['fridge', 'pantry', 'furn:table'], n);
    else if (k === 'storage') furnishRoom(m, r, rm, ['shelf', 'crate', 'locker'], n);
    else furnishRoom(m, r, rm, ['desk', 'locker', 'medcab'], n);
  }
  b.rooms.push({ x: bx + 1, y: cy0, w: bw - 2, h: 3 });
  m.buildings.push(b);
  reserve(m, bx - 2, by - 2, bw + 4, bh + 4);
  groundRect(m, mid - 1, by + bh, 4, py0 - by - bh, T.SIDEWALK);
  reserve(m, mid - 1, by + bh, 4, py0 - by - bh);
  // морг/гараж
  const sp = findSpot(m, r, 10, 7, { x0: 2, y0: by + bh + 1, x1: W - 2, y1: H - 2 }, 1);
  if (sp) { const gb = building(m, r, sp.x, sp.y, 10, 7, { wall: T.BRICK, floor: T.CONCRETE, minRoom: 3, maxDepth: 1, doors: 1, windows: 2 }); furnish(m, r, gb, ['medcab', 'locker', 'crate'], 6); }
  // парковка
  let ax = 8;
  for (let k = 0; k < 2; k++) {
    ax = r.int(8, W - 14);
    let ok = true;
    for (let yy = py0 + 3; yy < py0 + 5; yy++) for (let xx = ax; xx < ax + 4; xx++) if (m.tiles[MI(m, xx, yy)] !== T.ASPHALT) ok = false;
    if (ok) addCar(m, r, ax, py0 + 3, false, 'ambulance', 'ambtrunk', 0.9);
  }
  for (let x = 8; x < W - 9; x += 3) {
    if (r() > 0.4) continue;
    const y = r() < 0.5 ? py0 + 1 : py0 + ph - 4;
    let ok = true;
    for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 2; xx++) if (m.tiles[MI(m, xx, yy)] !== T.ASPHALT) ok = false;
    if (ok) { const p = addProp(m, 'car', x, y, 2, 3, { c: r.pick(CAR_COLORS), v: 1 }); if (r() < 0.4) m.cont[MI(m, p.x, p.y + 2)] = { k: 'trunk', loot: rollLoot(r, CONT.trunk.loot), s: 0 }; }
  }
  for (let k = 0; k < 6; k++) { const s2 = findSpot(m, r, 1, 1, { x0: 2, y0: 2, x1: W - 2, y1: py0 }, 1); if (s2) { placeItem(m, r, s2.x, s2.y, 'furn:bench'); reserve(m, s2.x, s2.y, 1, 1); } }
  scatterGreen(m, r, 0.045, 0.04, 2);
  placeStart(m, r, rdx, H - 7);
}

// Достижимость от старта, чистка недоступных контейнеров, списки клеток
function finalize(m) {
  const reach = new Uint8Array(m.n);
  const s = MI(m, m.start.x + 1, m.start.y);
  const st = [];
  for (const i of m.evac) { reach[i] = 1; st.push(i); }
  if (!st.length) { reach[s] = 1; st.push(s); }
  while (st.length) {
    const i = st.pop(), x = i % m.w, y = (i / m.w) | 0;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(m, nx, ny)) continue;
      const j = MI(m, nx, ny);
      if (reach[j] || !TP[m.tiles[j]].walk) continue;
      reach[j] = 1; st.push(j);
    }
  }
  for (const k in m.cont) {
    const i = +k, x = i % m.w, y = (i / m.w) | 0;
    let ok = false;
    for (const [dx, dy] of DIR8) { const nx = x + dx, ny = y + dy; if (inb(m, nx, ny) && reach[MI(m, nx, ny)]) ok = true; }
    if (!ok) delete m.cont[k];
  }
  m.indoor = [];
  for (const b of m.buildings) for (let yy = b.y + 1; yy < b.y + b.h - 1; yy++) for (let xx = b.x + 1; xx < b.x + b.w - 1; xx++) {
    const i = MI(m, xx, yy);
    if (reach[i] && TP[m.tiles[i]].walk && !isDoorT(m.tiles[i])) m.indoor.push(i);
  }
  const ev = new Set(m.evac);
  m.edge = [];
  for (let i = 0; i < m.n; i++) {
    const x = i % m.w, y = (i / m.w) | 0;
    if ((x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) && reach[i] && TP[m.tiles[i]].walk && !ev.has(i)) m.edge.push(i);
  }
  delete m.resv;
  m.buildings = m.buildings.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  return reach;
}

function genMap(loc, seed, lootMul = 1) {
  const L = LOCS[loc];
  const r = makeRng(seed);
  const m = newMap(L.w, L.h, seed);
  m.v = L.v || 0; m.loc = loc;
  const GEN = {
    farm: genFarm, suburb: genSuburb, factory: genFactory, hospital: genHospital, gas: genGas, market: genMarket, police: genPolice,
    school: genSchool, church: genChurch, checkpoint: genCheckpoint, forest: genForest, motel: genMotel, prison: genPrison, raidcamp: genRaidCamp,
  };
  LOOT_MUL = lootMul;
  try { GEN[L.gen](m, r); } finally { LOOT_MUL = 1; }
  const reach = finalize(m);
  return { m, reach };
}
