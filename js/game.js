(() => {
'use strict';
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
const R = Math.random, rnd = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const iso = (x, y) => [(x - y) * 32, (x + y) * 16];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const SAVE = 'rubin_save_v1';
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

let W, H, dpr, zoom, camX = 0, camY = 0;
let G = null, loc = null, P = null;
let time = 0, shake = 0, pfield = null, pft = 0, flash = 0;
const ui = {panel: null, arg: null, sel: null};
const keys = {}, joy = {id: null, x: 0, y: 0, sx: 0, sy: 0};
let atkHeld = false;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  zoom = clamp(Math.min(W, H) / 460, 1, 1.8);
}
addEventListener('resize', resize); resize();

// ---------- звук ----------
let ac = null;
function sfx(f, d = .08, type = 'square', v = .04, slide = 0) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}

// ---------- инвентарь ----------
const stackOf = id => ITEMS[id].s || (ITEMS[id].dur || ITEMS[id].armor ? 1 : 20);
function count(inv, id) { let c = 0; for (const s of inv) if (s && s.id === id) c += s.n; return c; }
function add(inv, id, n, d) {
  const it = ITEMS[id], st = stackOf(id);
  if (st > 1) for (const s of inv) { if (n <= 0) break; if (s && s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; } }
  for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) {
    const k = Math.min(n, st); inv[i] = {id, n: k}; if (it.dur) inv[i].d = d == null ? it.dur : d; n -= k;
  }
  return n;
}
function remove(inv, id, n) {
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) { const s = inv[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) inv[i] = null; } }
  return n;
}
const have = id => count(G.p.inv, id) + (loc && loc.bunker ? count(G.storage, id) : 0);
const haveAll = id => count(G.p.inv, id) + count(G.storage, id) + (G.p.eq.weapon && G.p.eq.weapon.id === id ? 1 : 0);
function pay(c) { for (const id in c) { const r = remove(G.p.inv, id, c[id]); if (r && loc.bunker) remove(G.storage, id, r); } }
function canPay(c) { for (const id in c) if (have(id) < c[id]) return false; return true; }
function give(id, n, d) {
  let r = add(G.p.inv, id, n, d);
  if (r && loc.bunker) r = add(G.storage, id, r, d);
  if (r) dropBag([[id, r]], P.x, P.y);
}

// ---------- игра / сохранение ----------
function newGame() {
  G = {v: 1, day: 1, slept: false, won: false, kills: 0, ups: {}, mods: {hatch: 1, storage: 1, bed: 1},
    storage: new Array(40).fill(null),
    p: {hp: 100, hunger: 90, thirst: 90, filter: 100, fcap: 100, inv: new Array(12).fill(null), eq: {weapon: null, armor: null}}};
  add(G.p.inv, 'filter', 2); add(G.p.inv, 'canned', 2); add(G.p.inv, 'water', 2); add(G.p.inv, 'bandage', 1);
}
function save() { try { localStorage.setItem(SAVE, JSON.stringify(G)); } catch (e) {} }
function load() { try { const g = JSON.parse(localStorage.getItem(SAVE)); if (g && g.v === 1 && g.p) return g; } catch (e) {} return null; }

function mkPlayer(x, y) { P = {x, y, r: .25, fx: 1, dx: 0, dy: 1, walk: 0, cd: 0, atk: 0, hurt: 0, auto: null, af: null, aft: 0, gather: null, stuck: 0, cough: 0}; }

// ---------- локации ----------
function mkLoc(id, N) {
  return {id, N, ground: new Uint8Array(N * N), solid: new Uint8Array(N * N), nodes: [], nmap: new Map(), walls: [], en: [], proj: [], fx: [], txt: []};
}
function rollLoot(k) {
  const d = NODES[k], out = [];
  const put = (id, n) => { const e = out.find(o => o[0] === id); if (e) e[1] += n; else out.push([id, n]); };
  if (d.table) {
    const t = TABLES[d.table], tot = t.reduce((s, e) => s + e[1], 0);
    for (let i = 0; i < 3; i++) { let r = R() * tot; for (const e of t) { r -= e[1]; if (r <= 0) { put(e[0], ri(e[2], e[3])); break; } } }
  } else if (d.loot) for (const [id, a, b, p] of d.loot) if (p == null || R() < p) put(id, ri(a, b));
  return out;
}
function addNode(L, k, x, y, ex) {
  const n = Object.assign({k, x, y, v: R(), loot: k === 'mod' || k === 'bag' ? [] : rollLoot(k)}, ex);
  L.nodes.push(n); L.nmap.set(y * L.N + x, n);
  if (k === 'mod' || NODES[k].solid) L.solid[y * L.N + x] = 2;
  return n;
}
function removeNode(n) {
  const i = loc.nodes.indexOf(n); if (i >= 0) loc.nodes.splice(i, 1);
  const k = n.y * loc.N + n.x; loc.nmap.delete(k); if (loc.solid[k] === 2) loc.solid[k] = 0; n.gone = true;
}
function dropBag(loot, x, y) {
  const N = loc.N, cx = x | 0, cy = y | 0;
  for (let r = 0; r < 4; r++) for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
    if (xx < 0 || yy < 0 || xx >= N || yy >= N || loc.solid[yy * N + xx]) continue;
    const e = loc.nmap.get(yy * N + xx);
    if (e && e.k !== 'bag') continue;
    const b = e || addNode(loc, 'bag', xx, yy);
    for (const [id, n] of loot) { const o = b.loot.find(l => l[0] === id && stackOf(id) > 1); if (o) o[1] += n; else b.loot.push([id, n]); }
    return;
  }
}

function genBunker() {
  const N = 13, L = mkLoc('bunker', N);
  L.bunker = true; L.name = 'Бункер «Рубин»'; L.bg = '#07080a'; L.gt = 'bunker';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x;
    if (x >= 1 && x <= 11 && y >= 1 && y <= 9) L.ground[k] = 1;
    else { L.solid[k] = 1; if ((x === 0 && y <= 9) || (y === 0 && x <= 11)) L.walls.push({x, y, h: 46, bunk: 1, v: R()}); }
  }
  for (const id in MODS) addNode(L, 'mod', MODS[id].x, MODS[id].y, {mod: id});
  L.spawn = [9.5, 8.5];
  paintGround(L);
  return L;
}

function genLoc(id) {
  const def = LOCS[id], N = def.size, L = mkLoc(id, N);
  L.def = def; L.name = def.n; L.bg = def.bg; L.gt = def.ground;
  L.ground.fill(1);
  for (let i = 0; i < N / 2; i++) {
    const cx = ri(0, N - 1), cy = ri(0, N - 1), r = rnd(1.5, 4);
    for (let y = Math.max(0, cy - 4); y < Math.min(N, cy + 5); y++) for (let x = Math.max(0, cx - 4); x < Math.min(N, cx + 5); x++)
      if (Math.hypot(x - cx, y - cy) < r + R()) L.ground[y * N + x] = 2;
  }
  const sx = N >> 1, sy = N - 3; L.spawn = [sx + .5, sy + .5];
  const free = (x, y) => x >= 2 && y >= 2 && x < N - 2 && y < N - 2 && !L.solid[y * N + x] && !L.nmap.has(y * N + x) && Math.hypot(x - sx, y - sy) > 2.5;
  const place = (pred) => { for (let i = 0; i < 300; i++) { const x = ri(2, N - 3), y = ri(2, N - 3); if (free(x, y) && (!pred || pred(x, y))) return [x, y]; } return null; };
  // руины зданий
  const bl = [];
  for (let b = 0, tries = 0; b < (def.buildings || 0) && tries < 200; tries++) {
    const w = ri(4, 7), h = ri(4, 7), x0 = ri(3, N - 4 - w), y0 = ri(3, N - 4 - h);
    if (x0 + w > N - 3 || y0 + h > N - 3) continue;
    if (sx >= x0 - 3 && sx <= x0 + w + 2 && sy >= y0 - 3 && sy <= y0 + h + 2) continue;
    if (bl.some(o => x0 < o[0] + o[2] + 2 && x0 + w + 2 > o[0] && y0 < o[1] + o[3] + 2 && y0 + h + 2 > o[1])) continue;
    bl.push([x0, y0, w, h]); b++;
    const doors = [[x0 + ri(1, w - 2), y0], [x0 + ri(1, w - 2), y0 + h - 1], [x0, y0 + ri(1, h - 2)]];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      L.ground[y * N + x] = 3;
      if (edge && R() < .86 && !doors.some(d => d[0] === x && d[1] === y)) { L.solid[y * N + x] = 1; L.walls.push({x, y, h: ri(14, 28), v: R()}); }
    }
    if (R() < .85) addNode(L, def.bcrate, x0 + ri(1, w - 2), y0 + ri(1, h - 2));
    if (R() < .4) { const x = x0 + ri(1, w - 2), y = y0 + ri(1, h - 2); if (!L.nmap.has(y * N + x)) addNode(L, def.bcrate, x, y); }
  }
  const c = N / 2;
  for (const k in def.nodes) for (let i = 0; i < def.nodes[k]; i++) {
    const p = place(k === 'ruby' ? (x, y) => Math.hypot(x - c, y - c) < 8 : null);
    if (p) addNode(L, k, p[0], p[1]);
  }
  for (const t in def.en) for (let i = 0; i < def.en[t]; i++) {
    const p = place(t === 'boss' ? (x, y) => Math.hypot(x - c, y - c) < 4 : (x, y) => Math.hypot(x - sx, y - sy) > 9);
    if (p) spawnEnemy(L, t, p[0] + .5, p[1] + .5);
  }
  paintGround(L);
  return L;
}
function spawnEnemy(L, t, x, y) {
  const d = ENEMIES[t];
  L.en.push({t, def: d, x, y, hp: d.hp, r: Math.min(.4, .26 * d.sz), cd: rnd(0, 1), wind: 0, aggro: false, wt: rnd(0, 3), wx: 0, wy: 0, fx: 1, walk: R() * 6, hit: 0});
}

const GCOL = {
  grass: [[88, 24, 23], [70, 20, 20], [30, 12, 26]],
  dirt: [[34, 24, 25], [28, 18, 30], [30, 10, 22]],
  asph: [[220, 5, 21], [100, 14, 22], [30, 8, 30]],
  conc: [[45, 6, 30], [60, 10, 24], [30, 8, 36]],
  sludge: [[95, 30, 16], [84, 42, 21], [30, 8, 26]],
  bunker: [[210, 9, 23], [210, 9, 23], [210, 9, 23]],
};
function paintGround(L) {
  const N = L.N, c = document.createElement('canvas'); c.width = N * 64; c.height = N * 32 + 4;
  const g = c.getContext('2d'); g.translate(N * 32, 2);
  const cols = GCOL[L.gt];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = L.ground[y * N + x]; if (!t) continue;
    const [h, s, l] = cols[t - 1], [px, py] = iso(x, y);
    const exit = !L.bunker && (x < 2 || y < 2 || x >= N - 2 || y >= N - 2);
    const col = `hsl(${h},${s}%,${l + rnd(-2, 2) + (exit ? 7 : 0)}%)`;
    g.fillStyle = col; g.strokeStyle = L.bunker ? '#0006' : col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + 32, py + 16); g.lineTo(px, py + 32); g.lineTo(px - 32, py + 16); g.closePath(); g.fill(); g.stroke();
    if (exit && (x + y) % 2 === 0) { g.fillStyle = '#e0c05022'; g.fill(); }
    if (L.bunker) continue;
    const k = R();
    if (k < .35) { // мелкие детали
      g.fillStyle = L.gt === 'sludge' && t === 2 ? '#b8ff4055' : `hsla(${h},${s}%,${l + (R() < .5 ? 9 : -7)}%,.8)`;
      for (let i = 0; i < 3; i++) g.fillRect(px + rnd(-18, 18), py + 16 + rnd(-7, 7), rnd(1, 4), rnd(1, 2));
    }
  }
  L.gc = c;
}

function enterLoc(id) {
  loc = genLoc(id); mkPlayer(loc.spawn[0], loc.spawn[1]); pfield = null;
  toast(`${loc.name}. Токсичность ×${loc.def.tox}`, loc.def.tox > 1.4 ? 'bad' : '');
  hud();
}
function enterBunker(trip) {
  loc = genBunker(); mkPlayer(loc.spawn[0], loc.spawn[1]); pfield = null;
  if (trip) {
    G.day++; G.slept = false;
    if (G.mods.water) { add(G.storage, 'dwater', 3); toast('Сборщик воды: +3 🥤 на склад'); }
    if (G.mods.garden) { add(G.storage, 'berries', 4); toast('Гидропоника: +4 🫐 на склад'); }
  }
  save(); hud();
}

// ---------- навигация ----------
function solidAt(x, y) { const N = loc.N; if (x < 0 || y < 0 || x >= N || y >= N) return true; return loc.solid[(y | 0) * N + (x | 0)] > 0; }
function blocked(x, y, r) { return solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r); }
function move(e, dx, dy) {
  let m = false;
  if (dx && !blocked(e.x + dx, e.y, e.r)) { e.x += dx; m = true; }
  if (dy && !blocked(e.x, e.y + dy, e.r)) { e.y += dy; m = true; }
  return m;
}
function lineClear(x0, y0, x1, y1, wallsOnly) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / .2), N = loc.N, tk = (y1 | 0) * N + (x1 | 0);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    const k = (y | 0) * N + (x | 0), s = loc.solid[k];
    if (s && k !== tk && (!wallsOnly || s === 1)) return false;
  }
  return true;
}
function walkClear(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1, px = -(y1 - y0) / d * .24, py = (x1 - x0) / d * .24;
  return lineClear(x0, y0, x1, y1) && lineClear(x0 + px, y0 + py, x1 + px, y1 + py) && lineClear(x0 - px, y0 - py, x1 - px, y1 - py);
}
function mkField(tx, ty, maxd = 40) {
  const N = loc.N, f = new Int16Array(N * N).fill(-1);
  if (tx < 0 || ty < 0 || tx >= N || ty >= N) return f;
  const q = new Int32Array(N * N); let h = 0, t = 0; f[ty * N + tx] = 0; q[t++] = ty * N + tx;
  while (h < t) {
    const c = q[h++], d = f[c]; if (d >= maxd) continue;
    const cx = c % N, cy = (c / N) | 0;
    for (const [ax, ay] of D4) {
      const nx = cx + ax, ny = cy + ay; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const k = ny * N + nx; if (f[k] >= 0 || loc.solid[k]) continue; f[k] = d + 1; q[t++] = k;
    }
  }
  return f;
}
function steer(e, tx, ty, f) {
  let dx = tx - e.x, dy = ty - e.y;
  const N = loc.N, cx = e.x | 0, cy = e.y | 0, cur = f ? f[cy * N + cx] : -1;
  if (cur > 0 && !walkClear(e.x, e.y, tx, ty)) {
    let best = cur, bx = -1, by = -1;
    for (const [ax, ay] of D8) {
      const nx = cx + ax, ny = cy + ay; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const v = f[ny * N + nx]; if (v < 0 || v >= best) continue;
      if (ax && ay && (loc.solid[cy * N + nx] || loc.solid[ny * N + cx])) continue;
      best = v; bx = nx; by = ny;
    }
    if (bx >= 0) { dx = bx + .5 - e.x; dy = by + .5 - e.y; }
  }
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// ---------- бой ----------
function weapon() {
  const s = G.p.eq.weapon; if (!s) return FISTS;
  const w = ITEMS[s.id].w;
  if (w.ranged && count(G.p.inv, 'ammo') < 1) return {dmg: 6, cd: .5, rg: .95, empty: 1};
  return w;
}
function wear(slot, isEq) {
  if (!slot || slot.d == null) return;
  if (--slot.d <= 0) {
    toast(`${ITEMS[slot.id].n}: сломано!`, 'bad'); sfx(120, .2, 'sawtooth', .05, -60);
    if (isEq) G.p.eq.weapon = null; else { const i = G.p.inv.indexOf(slot); if (i >= 0) G.p.inv[i] = null; }
  }
}
function findTool(type) {
  const w = G.p.eq.weapon; if (w && ITEMS[w.id].tool === type) return [w, true];
  const s = G.p.inv.find(s => s && ITEMS[s.id].tool === type); return s ? [s, false] : null;
}
function face(o) { const dx = o.x - P.x, dy = o.y - P.y; const s = dx - dy; if (Math.abs(s) > .01) P.fx = s > 0 ? 1 : -1; }
function nearestEnemy(maxd) { let b = null, bd = maxd; for (const e of loc.en) { const d = dist(e, P); if (d < bd) { bd = d; b = e; } } return b; }
function inRange(e) { const w = weapon(); return dist(e, P) <= w.rg + e.r * .6 && (!w.ranged || lineClear(P.x, P.y, e.x, e.y, true)); }
function attack(e) {
  const w = weapon(); P.cd = w.cd; P.atk = .22; face(e); P.gather = null;
  if (w.ranged) {
    remove(G.p.inv, 'ammo', 1);
    loc.fx.push({k: 'tracer', x: P.x, y: P.y, x2: e.x, y2: e.y, t: 0, T: .08});
    sfx(w.splash ? 90 : 160, .18, 'sawtooth', .09, -60);
    for (const o of loc.en) if (dist(o, P) < 11) o.aggro = true;
    if (w.splash) for (const o of loc.en.slice()) if (o !== e && dist(o, e) < 1.6) hitEnemy(o, w.dmg * .5);
  } else {
    sfx(220, .06, 'triangle', .05, -100);
    if (w.empty && !P.warnAmmo) { P.warnAmmo = 1; toast('Нет патронов — бьёте прикладом', 'bad'); }
    const d = dist(e, P) || 1; move(e, (e.x - P.x) / d * .22, (e.y - P.y) / d * .22);
  }
  hitEnemy(e, w.dmg * rnd(.85, 1.15));
  if (!w.empty) wear(G.p.eq.weapon, true);
}
function hitEnemy(e, d) {
  if (e.dead) return;
  e.hp -= d; e.aggro = true; e.hit = .15;
  loc.txt.push({x: e.x, y: e.y, h: 40 * e.def.sz, s: '' + Math.round(d), c: '#ffd070', t: 0});
  for (let i = 0; i < 4; i++) loc.fx.push({k: 'blood', x: e.x, y: e.y, vx: rnd(-1.5, 1.5), vy: rnd(-1.5, 1.5), h: 20 * e.def.sz, vh: rnd(20, 60), t: 0, T: .5});
  if (e.hp <= 0) {
    e.dead = true; loc.en.splice(loc.en.indexOf(e), 1); G.kills++;
    sfx(90, .25, 'sawtooth', .06, -50);
    const loot = []; for (const [id, p, a, b] of e.def.drop) if (R() < p) loot.push([id, ri(a, b)]);
    if (loot.length) dropBag(loot, e.x, e.y);
    loc.fx.push({k: 'splat', x: e.x, y: e.y, t: 0, T: 6, r: 14 * e.def.sz});
    if (e.def.cloud) {
      loc.fx.push({k: 'cloud', x: e.x, y: e.y, t: 0, T: 1.2});
      if (dist(e, P) < 2.4) { G.p.filter = Math.max(0, G.p.filter - 20); toast('Токсичное облако разъело фильтр! −20', 'bad'); }
    }
    if (e.def.boss) toast('Альфа-мутант повержен!', 'gold');
  }
}
function hurt(d) {
  const a = G.p.eq.armor; if (a) d *= 1 - ITEMS[a.id].armor;
  G.p.hp -= d; P.hurt = .25; shake = Math.max(shake, 5); P.gather = null;
  sfx(140, .12, 'square', .06, -70);
  loc.txt.push({x: P.x, y: P.y, h: 44, s: '-' + Math.round(d), c: '#ff5050', t: 0});
}
function die(why) {
  G.p.hp = 0; sfx(200, .8, 'sawtooth', .07, -170);
  openPanel('dead', why);
}
function respawn() {
  const p = G.p;
  p.inv.fill(null); p.hp = 70; p.hunger = Math.max(p.hunger, 45); p.thirst = Math.max(p.thirst, 45);
  if (p.filter < 30) { p.filter = 30; p.fcap = Math.max(p.fcap, 35); }
  closePanel(true); enterBunker(true);
  toast('Вы очнулись в бункере. Содержимое рюкзака потеряно.', 'bad');
}

// ---------- взаимодействие ----------
const inExit = () => !loc.bunker && (P.x < 2 || P.y < 2 || P.x >= loc.N - 2 || P.y >= loc.N - 2);
function nearestNode(maxd, ok) {
  let b = null, bd = maxd;
  for (const n of loc.nodes) { if (ok && !ok(n)) continue; const d = Math.hypot(n.x + .5 - P.x, n.y + .5 - P.y); if (d < bd) { bd = d; b = n; } }
  return b;
}
function doUse() {
  if (ui.panel) { if (ui.panel !== 'dead' && ui.panel !== 'title') closePanel(); return; }
  if (inExit()) { openPanel('map'); return; }
  // сначала то, что рядом; иначе — ближайшее, что можно собрать имеющимися инструментами
  const usable = n => n.k === 'mod' || !NODES[n.k].tool || findTool(NODES[n.k].tool);
  const n = nearestNode(1.7) || nearestNode(12, usable);
  if (n) { P.auto = {t: 'node', n}; P.af = null; }
}
function interact(n) {
  face({x: n.x + .5, y: n.y + .5});
  if (n.k === 'mod') return modAction(n.mod);
  const d = NODES[n.k];
  if (d.tool && !findTool(d.tool)) { toast(`Нужен инструмент: ${d.tool === 'axe' ? 'топор 🪓' : 'кирка ⛏️'}`, 'bad'); return; }
  if (!P.gather || P.gather.n !== n) P.gather = {n, t: 0, T: d.t};
}
function finishGather() {
  const n = P.gather.n, d = NODES[n.k], left = []; P.gather = null;
  let row = 0;
  for (const [id, c] of n.loot) {
    const r = add(G.p.inv, id, c);
    if (c - r > 0) loc.txt.push({x: P.x, y: P.y, h: 50 + 14 * row++, s: `+${c - r} ${ITEMS[id].i}`, c: '#d8f0a0', t: 0});
    if (r > 0) left.push([id, r]);
  }
  sfx(520, .07, 'triangle', .05, 200);
  if (d.tool) { const t = findTool(d.tool); if (t) wear(t[0], t[1]); }
  if (left.length) { n.loot = left; toast('Рюкзак полон!', 'bad'); } else removeNode(n);
}
function modAction(id) {
  const m = MODS[id];
  if (!G.mods[id]) return openPanel('build', id);
  if (id === 'hatch') return openPanel('map');
  if (id === 'storage') return openPanel('inv');
  if (id === 'bed') {
    if (G.slept) return toast('Вы уже отдыхали. Сначала сходите на вылазку.');
    const p = G.p; G.slept = true; p.hp = G.mods.med ? 100 : Math.min(100, p.hp + 50);
    p.hunger = Math.max(5, p.hunger - 15); p.thirst = Math.max(5, p.thirst - 15); flash = 1; save();
    return toast(G.mods.med ? 'Вы выспались. Здоровье восстановлено полностью.' : 'Вы выспались. +50 здоровья.');
  }
  if (STATIONS[id]) return openPanel('craft', id);
  toast(`${m.n}: ${m.d}`);
}
function useItem(i) {
  const s = G.p.inv[i]; if (!s) return;
  const it = ITEMS[s.id], p = G.p;
  if (it.eat) {
    const e = it.eat;
    if (e.hp > 0 && !e.hunger && !e.thirst && p.hp >= 100) return toast('Здоровье полное');
    if (e.hunger) p.hunger = Math.min(100, p.hunger + e.hunger);
    if (e.thirst) p.thirst = Math.min(100, p.thirst + e.thirst);
    if (e.hp) p.hp = clamp(p.hp + e.hp, 1, 100);
    sfx(400, .1, 'sine', .05, 150);
    if (--s.n <= 0) p.inv[i] = null;
  } else if (it.filt) {
    p.filter = it.filt; p.fcap = it.filt; if (--s.n <= 0) p.inv[i] = null;
    toast(`Установлен: ${it.n}`); sfx(300, .12, 'sine', .05, 200);
  } else if (it.w) { p.inv[i] = p.eq.weapon; p.eq.weapon = s; P.warnAmmo = 0; sfx(260, .05, 'triangle'); }
  else if (it.armor) { p.inv[i] = p.eq.armor; p.eq.armor = s; sfx(260, .05, 'triangle'); }
}
function quick(kind) {
  const inv = G.p.inv; let best = -1, bv = 0;
  inv.forEach((s, i) => {
    if (!s) return; const e = ITEMS[s.id].eat; if (!e) return;
    let v = 0;
    if (kind === 'eat') v = e.hunger || 0;
    else if (kind === 'drink') v = (e.thirst || 0) >= 15 ? e.thirst + (e.hp < 0 ? -30 : 0) + 31 : 0;
    else if (!e.hunger && !e.thirst) v = G.p.hp < 45 ? e.hp : 200 - e.hp;
    if (v > bv) { bv = v; best = i; }
  });
  if (best < 0) return toast(kind === 'eat' ? 'Нет еды' : kind === 'drink' ? 'Нет воды' : 'Нет медикаментов', 'bad');
  useItem(best);
}
function swapFilter() {
  for (const id of ['filter', 'filter2', 'filter0']) {
    const i = G.p.inv.findIndex(s => s && s.id === id);
    if (i >= 0) { useItem(i); return true; }
  }
  return false;
}

// ---------- обновление ----------
function update(dt) {
  time += dt;
  const p = G.p, b = loc.bunker;
  // выживание
  p.hunger = Math.max(0, p.hunger - dt * (b ? .05 : .11));
  p.thirst = Math.max(0, p.thirst - dt * (b ? .07 : .15));
  if (p.hunger <= 0) p.hp -= .8 * dt;
  if (p.thirst <= 0) p.hp -= 1.2 * dt;
  if (p.hunger > 40 && p.thirst > 40 && p.hp < 100) p.hp = Math.min(100, p.hp + dt * (b ? 1.2 : .35));
  if (!b) {
    const a = p.eq.armor, sv = a && ITEMS[a.id].save || 0, tox = loc.def.tox;
    if (p.filter > 0) {
      p.filter -= dt * (100 / 160) * tox * (1 - sv);
      if (p.filter <= 0) { p.filter = 0; if (!swapFilter()) toast('Фильтр закончился! Вы дышите отравой!', 'bad'); }
    } else if (!swapFilter()) {
      p.hp -= 2.5 * tox * dt;
      if ((P.cough -= dt) <= 0) { P.cough = 1.6; sfx(180, .1, 'sawtooth', .04, -80); loc.txt.push({x: P.x, y: P.y, h: 46, s: 'кхе-кхе…', c: '#b8e060', t: 0}); }
    }
  }
  if (p.hp <= 0) return die(p.filter <= 0 && !b ? 'Вы задохнулись без фильтра' : p.thirst <= 0 ? 'Вы умерли от жажды' : p.hunger <= 0 ? 'Вы умерли от голода' : 'Вас разорвали заражённые');

  updPlayer(dt);
  if (!b) updEnemies(dt);
  // эффекты
  for (let i = loc.fx.length - 1; i >= 0; i--) { const f = loc.fx[i]; f.t += dt; if (f.k === 'blood') { f.x += f.vx * dt; f.y += f.vy * dt; f.h += f.vh * dt; f.vh -= 200 * dt; } if (f.t >= f.T) loc.fx.splice(i, 1); }
  for (let i = loc.txt.length - 1; i >= 0; i--) { const t = loc.txt[i]; t.t += dt; if (t.t > 1) loc.txt.splice(i, 1); }
  shake = Math.max(0, shake - dt * 20); flash = Math.max(0, flash - dt);
}

function updPlayer(dt) {
  P.cd -= dt; P.atk = Math.max(0, P.atk - dt); P.hurt = Math.max(0, P.hurt - dt);
  const ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  const iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  const il = Math.hypot(ix, iy);
  let mx = 0, my = 0, manual = false;
  if (il > .15) {
    const wx = ix + iy, wy = iy - ix, l = Math.hypot(wx, wy) || 1, k = Math.min(1, il);
    mx = wx / l * k; my = wy / l * k; manual = true; P.auto = null; P.gather = null;
  } else if (P.auto) {
    const a = P.auto; let tx, ty, go = false;
    if (a.t === 'enemy') {
      if (a.e.dead) P.auto = null;
      else { tx = a.e.x; ty = a.e.y; if (inRange(a.e)) { face(a.e); if (P.cd <= 0) attack(a.e); } else go = true; }
    } else if (a.t === 'node') {
      tx = a.n.x + .5; ty = a.n.y + .5;
      if (a.n.gone) P.auto = null;
      else if (Math.hypot(tx - P.x, ty - P.y) < 1.3) { P.auto = null; interact(a.n); }
      else go = true;
    } else { tx = a.x; ty = a.y; if (Math.hypot(tx - P.x, ty - P.y) < .15) P.auto = null; else go = true; }
    if (go) {
      if ((P.aft -= dt) <= 0 || !P.af) { P.af = mkField(tx | 0, ty | 0); P.aft = .3; }
      [mx, my] = steer(P, tx, ty, P.af);
    }
  }
  if (mx || my) {
    const sp = (G.p.hunger <= 0 || G.p.thirst <= 0 ? 2.5 : 3.2) * dt, ox = P.x, oy = P.y;
    move(P, mx * sp, my * sp);
    const s = mx - my; if (Math.abs(s) > .1) P.fx = s > 0 ? 1 : -1;
    P.walk += dt * 11;
    if (!manual && Math.hypot(P.x - ox, P.y - oy) < sp * .2) { if ((P.stuck += dt) > .5) { P.auto = null; P.stuck = 0; } } else P.stuck = 0;
  } else P.walk = 0;
  if ((keys.Space || atkHeld) && !loc.bunker) {
    const e = nearestEnemy(9);
    if (e && inRange(e)) { face(e); if (P.cd <= 0) attack(e); }
    else if (e && !manual) { if (!P.auto || P.auto.t !== 'enemy') { P.auto = {t: 'enemy', e}; P.af = null; } }
    else if (!e && P.cd <= 0) { P.cd = .45; P.atk = .22; sfx(200, .05, 'triangle', .03, -80); }
  }
  if (P.gather) {
    const g = P.gather;
    if (g.n.gone) P.gather = null;
    else { g.t += dt; if (((g.tick = (g.tick || 0) + dt)) > .45) { g.tick = 0; P.atk = .22; sfx(150 + R() * 60, .04, 'square', .025); } if (g.t >= g.T) finishGather(); }
  }
}

function updEnemies(dt) {
  if ((pft -= dt) <= 0 || !pfield) { pfield = mkField(P.x | 0, P.y | 0, 26); pft = .25; }
  const en = loc.en;
  for (const e of en) {
    const d = dist(e, P), df = e.def;
    e.cd -= dt; e.hit = Math.max(0, e.hit - dt);
    if (!e.aggro && d < df.ag) { e.aggro = true; if (R() < .5) sfx(110 + R() * 40, .25, 'sawtooth', .03, -40); }
    if (e.aggro && d > 20) e.aggro = false;
    let mx = 0, my = 0, sp = df.sp * (df.boss && e.hp < df.hp / 2 ? 1.35 : 1);
    if (e.aggro) {
      const s = P.x - e.x - (P.y - e.y); if (Math.abs(s) > .05) e.fx = s > 0 ? 1 : -1;
      if (df.spit) {
        if (d < df.rg && e.cd <= 0 && lineClear(e.x, e.y, P.x, P.y, true)) {
          e.cd = df.cd; e.atk = .3; const l = d || 1;
          loc.proj.push({x: e.x, y: e.y, vx: (P.x - e.x) / l * 6.5, vy: (P.y - e.y) / l * 6.5, life: 1.4, dmg: df.dmg});
          sfx(500, .15, 'sine', .04, -300);
        }
        if (d > 5) [mx, my] = steer(e, P.x, P.y, pfield);
        else if (d < 2.8) { mx = (e.x - P.x) / (d || 1); my = (e.y - P.y) / (d || 1); }
      } else if (e.wind > 0) {
        if ((e.wind -= dt) <= 0) { e.cd = df.cd; if (d < df.rg + .4) hurt(df.dmg); }
      } else if (d <= df.rg && e.cd <= 0) { e.wind = .35; e.atk = .35; }
      else if (d > df.rg * .8) [mx, my] = steer(e, P.x, P.y, pfield);
    } else {
      if ((e.wt -= dt) <= 0) { e.wt = rnd(1, 4); if (R() < .6) { const a = R() * 6.28; e.wx = Math.cos(a); e.wy = Math.sin(a); } else e.wx = e.wy = 0; }
      mx = e.wx; my = e.wy; sp *= .35;
      const s = mx - my; if (Math.abs(s) > .1) e.fx = s > 0 ? 1 : -1;
    }
    e.atk = Math.max(0, (e.atk || 0) - dt);
    if (mx || my) { if (!move(e, mx * sp * dt, my * sp * dt) && !e.aggro) e.wt = 0; e.walk += dt * sp * 4; }
  }
  // расталкивание
  for (let i = 0; i < en.length; i++) for (let j = i + 1; j < en.length; j++) {
    const a = en[i], b = en[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d < m && d > .001) { const k = (m - d) / d * .5; move(a, -dx * k, -dy * k); move(b, dx * k, dy * k); }
  }
  for (const e of en) { const d = dist(e, P), m = e.r + P.r; if (d < m && d > .001) move(e, (e.x - P.x) / d * (m - d), (e.y - P.y) / d * (m - d)); }
  for (let i = loc.proj.length - 1; i >= 0; i--) {
    const p = loc.proj[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    const N = loc.N, out = p.x < 0 || p.y < 0 || p.x >= N || p.y >= N;
    if (!out && Math.hypot(p.x - P.x, p.y - P.y) < .4) { hurt(p.dmg); loc.proj.splice(i, 1); }
    else if (out || p.life <= 0 || loc.solid[(p.y | 0) * N + (p.x | 0)] === 1) loc.proj.splice(i, 1);
  }
}

// ---------- отрисовка ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = clamp(((n >> 16) & 255) * f, 0, 255) | 0, g = clamp(((n >> 8) & 255) * f, 0, 255) | 0, b = clamp((n & 255) * f, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}
function poly(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function cube(hw, hh, h, col, oy = 0) {
  poly([-hw, -h + oy, 0, hh - h + oy, 0, hh + oy, -hw, oy], shade(col, .72));
  poly([hw, -h + oy, 0, hh - h + oy, 0, hh + oy, hw, oy], shade(col, .52));
  poly([0, -hh - h + oy, hw, -h + oy, 0, hh - h + oy, -hw, -h + oy], col);
}
function ell(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fillStyle = fill; ctx.fill(); }

function drawNode(n) {
  const v = n.v;
  switch (n.k) {
    case 'tree': {
      ell(0, 2, 14, 6, '#0005');
      if (v > .72) { // сухое дерево
        ctx.strokeStyle = '#3d2e22'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, -40); ctx.moveTo(0, -22); ctx.lineTo(-13, -38); ctx.moveTo(1, -30); ctx.lineTo(12, -46); ctx.moveTo(1, -40); ctx.lineTo(-5, -56); ctx.stroke();
      } else {
        const s = .85 + v * .4; ctx.fillStyle = '#3d2e22'; ctx.fillRect(-3, -16, 6, 18);
        const c1 = v < .35 ? '#3a4a2a' : '#2f4a2e', c2 = v < .35 ? '#4a5a30' : '#3b5a37';
        poly([-17 * s, -12, 17 * s, -12, 0, -40 * s], c1); poly([0, -12, 17 * s, -12, 0, -40 * s], c2);
        poly([-13 * s, -28 * s, 13 * s, -28 * s, 0, -54 * s], c1); poly([0, -28 * s, 13 * s, -28 * s, 0, -54 * s], c2);
        poly([-9 * s, -44 * s, 9 * s, -44 * s, 0, -68 * s], c1); poly([0, -44 * s, 9 * s, -44 * s, 0, -68 * s], c2);
      }
      break;
    }
    case 'rock': case 'orev': case 'coal': {
      ell(0, 3, 20, 8, '#0005');
      poly([-18, 0, -13, -15, 1, -21, 15, -12, 19, 1, 5, 8, -9, 7], '#5c5e62');
      poly([-13, -15, 1, -21, 15, -12, 3, -7, -8, -6], '#7c7f84');
      if (n.k !== 'rock') { const c = n.k === 'orev' ? '#d08a45' : '#121216'; for (let i = 0; i < 6; i++) ell(-11 + (i * 37 * (v + .3)) % 24, -14 + (i * 53 * (v + .5)) % 16, 2.6, 2, c); }
      break;
    }
    case 'ruby': {
      const g = .5 + .5 * Math.sin(time * 3 + v * 9);
      ell(0, 2, 22, 10, `rgba(255,40,80,${.12 + g * .12})`);
      poly([-12, 2, -16, -18, -9, -28, -4, -6], '#b01030'); poly([-9, -28, -4, -6, -2, -20], '#ff5070');
      poly([-3, 4, -5, -30, 3, -42, 9, -26, 8, 3], '#d01840'); poly([3, -42, 9, -26, 8, 3, 3, -4], '#ff6080');
      poly([8, 4, 11, -14, 17, -20, 19, 0], '#b01030');
      break;
    }
    case 'sticks': ctx.strokeStyle = '#6a5034'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(10, -5); ctx.moveTo(-8, -5); ctx.lineTo(12, 4); ctx.moveTo(-3, 5); ctx.lineTo(4, -8); ctx.stroke(); break;
    case 'stones': ell(-6, 1, 7, 4.5, '#77797d'); ell(5, -2, 6, 4, '#8c8e92'); ell(4, 5, 5, 3, '#66686c'); break;
    case 'bush': case 'berry':
      ell(0, 3, 16, 6, '#0005');
      ell(-8, -6, 10, 9, '#34502a'); ell(7, -7, 11, 10, '#3e5d30'); ell(0, -14, 10, 9, '#4a6d38');
      if (n.k === 'berry') for (let i = 0; i < 6; i++) ell(-11 + (i * 41 * (v + .4)) % 22, -17 + (i * 29 * (v + .6)) % 14, 2, 2, '#7a50d0');
      break;
    case 'puddle': ell(0, 0, 22, 9, '#3a6a5acc'); ell(-5, -2, 9, 3, '#8ac0a055'); break;
    case 'scrapp':
      ell(0, 3, 20, 8, '#0005');
      poly([-17, 2, -10, -10, 2, -6, 6, 6], '#6a5a4a'); poly([-4, 4, 3, -16, 14, -9, 16, 3], '#7c7f84'); poly([-12, 5, -6, -3, 6, 2, 0, 9], '#8a4a30');
      ctx.strokeStyle = '#9a9da2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(10, -20); ctx.stroke();
      break;
    case 'car': {
      const c = v < .5 ? '#7a4a35' : '#4a5a6a';
      ell(0, 4, 30, 12, '#0006'); cube(27, 13, 11, c); cube(15, 8, 9, shade(c, .8), -11);
      poly([-13, -19, 0, -12, 0, -6, -13, -13], '#1c2226'); poly([13, -19, 0, -12, 0, -6, 13, -13], '#12171a');
      break;
    }
    case 'crate': ell(0, 3, 18, 8, '#0005'); cube(15, 7.5, 15, '#8a6a3c'); ctx.strokeStyle = '#5a4424'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(0, .5); ctx.lineTo(15, -7); ctx.stroke(); break;
    case 'milcrate': ell(0, 3, 20, 9, '#0005'); cube(17, 8.5, 13, '#4c5c38'); poly([-5, -17, 5, -17, 0, -13.5], '#d8d2b0'); break;
    case 'barrel':
      ell(0, 2, 12, 6, '#0005'); ctx.fillStyle = '#9a8a26'; ctx.fillRect(-9, -22, 18, 22); ell(0, 0, 9, 4.5, '#9a8a26'); ell(0, -22, 9, 4.5, '#c8b838');
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-9, -14, 18, 4); ell(1, -22, 4, 2, '#80e040');
      break;
    case 'bag': ell(0, 2, 9, 4, '#0005'); ell(0, -5, 8, 7, '#a58a5a'); ctx.fillStyle = '#6a5434'; ctx.fillRect(-3, -13, 6, 3); break;
    case 'mod': drawMod(n.mod); break;
  }
}
function drawMod(id) {
  const m = MODS[id], built = G.mods[id];
  if (!built) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#d8c98a88'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(28, 0); ctx.lineTo(0, 14); ctx.lineTo(-28, 0); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = .4; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(m.i, 0, 2); ctx.globalAlpha = 1;
    return;
  }
  if (id === 'hatch') {
    const g = ctx.createLinearGradient(0, -90, 0, 0); g.addColorStop(0, '#c8e08000'); g.addColorStop(1, '#c8e08040');
    poly([-14, -90, 14, -90, 26, 6, -26, 6], g);
    cube(24, 12, 4, '#4a5560');
    ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-8, -84); ctx.moveTo(8, -2); ctx.lineTo(8, -84);
    for (let y = -10; y > -84; y -= 12) { ctx.moveTo(-8, y); ctx.lineTo(8, y); } ctx.stroke();
    return;
  }
  ell(0, 4, 28, 12, '#0005');
  cube(25, 12.5, m.h, m.col);
  if (id === 'reactor') {
    const g = .5 + .5 * Math.sin(time * 2.5);
    ell(0, -m.h - 12, 16 + g * 4, 16 + g * 4, `rgba(255,40,80,${.15 + g * .2})`);
    poly([0, -m.h - 28, 9, -m.h - 12, 0, -m.h + 2, -9, -m.h - 12], '#ff3060'); poly([0, -m.h - 28, 9, -m.h - 12, 0, -m.h - 10], '#ff90a8');
    return;
  }
  if (id === 'bed') { cube(10, 5, 3, '#d8d0c0', -m.h - 5); }
  if (id === 'furnace') ell(-11, -m.h / 2 + 4, 6, 7, `rgba(255,${120 + 60 * Math.sin(time * 9)},30,.9)`);
  if (id === 'gen') { ell(0, -m.h - 2, 5, 2.5, `rgba(255,230,80,${.5 + .5 * Math.sin(time * 12)})`); }
  ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(m.i, 0, -m.h + 6);
}

function drawChar(o) { // o: sz, wide, fx, body, skin, walk, atk(0..1), kind, hit, wpn
  const s = o.sz;
  ell(0, 0, 11 * s * (o.wide || 1), 5 * s, '#0006');
  ctx.save(); ctx.scale(o.fx * s * (o.wide || 1), s);
  const sw = Math.sin(o.walk) * 3.5, bob = Math.abs(Math.sin(o.walk)) * 1.5;
  ctx.fillStyle = o.legs || '#2a2a2e';
  ctx.fillRect(-5 + sw, -9, 4, 9); ctx.fillRect(1 - sw, -9, 4, 9);
  ctx.translate(0, -bob);
  if (o.spikes) poly([-7, -24, -13, -30, -7, -19, -12, -21, -7, -14], '#2a1418');
  ctx.fillStyle = o.hit ? '#fff' : o.body; ctx.beginPath(); ctx.roundRect(-7, -25, 14, 17, 4); ctx.fill();
  if (o.kind === 'bloater') { ell(-2, -14, 2.5, 2.5, '#d8e060'); ell(3, -19, 2, 2, '#d8e060'); }
  // голова
  ell(0, -30, 6.5, 6.5, o.hit ? '#fff' : o.skin);
  if (o.kind === 'player') {
    ctx.fillStyle = o.body; ctx.beginPath(); ctx.arc(0, -30, 7, Math.PI * .95, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = '#1c1e20'; ctx.beginPath(); ctx.roundRect(-1, -33, 8, 8, 3); ctx.fill();
    ell(4, -30.5, 2, 2, '#8fe0e0'); ctx.fillStyle = o.low ? '#c04030' : '#5a6a48'; ctx.fillRect(5, -27.5, 5, 4.5);
  } else {
    ell(3.5, -31, 1.4, 1.4, o.boss ? '#ffe040' : '#ff3030');
    if (o.kind === 'spitter') { ctx.fillStyle = '#301838'; ctx.fillRect(1, -28, 6, 3 + (o.atk > 0 ? 3 : 0)); }
  }
  // рука
  ctx.save(); ctx.translate(2, -22);
  let ang = o.kind === 'player' ? .25 + Math.sin(o.walk) * .5 : -1.25 + Math.sin(o.walk * .7) * .15;
  if (o.atk > 0) ang = o.kind === 'player' ? -2.3 + (1 - o.atk) * 2.9 : -1.9 + (1 - o.atk) * 1.4;
  ctx.rotate(ang);
  ctx.fillStyle = o.hit ? '#fff' : shade(o.body.startsWith('#') ? o.body : '#555555', .8); ctx.fillRect(-2, 0, 4, 11);
  ell(0, 11, 2.4, 2.4, o.skin);
  if (o.spikes) poly([-2, 11, 0, 17, 2, 11], '#e8e0d0');
  if (o.wpn) drawWeapon(o.wpn);
  ctx.restore(); ctx.restore();
}
function drawWeapon(id) {
  ctx.save(); ctx.translate(0, 11); ctx.rotate(-1.35);
  const L = (c, w, l) => { ctx.fillStyle = c; ctx.fillRect(-2, -w / 2, l, w); };
  if (id === 'spear') { L('#7a5a3a', 2, 26); poly([24, -3, 31, 0, 24, 3], '#b8bcc0'); }
  else if (id === 'bat') { L('#8a6a44', 3.5, 20); ctx.fillStyle = '#c8ccd0'; for (let i = 0; i < 3; i++) ctx.fillRect(10 + i * 3, -4, 1, 8); }
  else if (id === 'machete') { L('#3a2a1a', 3, 6); poly([4, -2.5, 22, -2, 24, 2, 4, 2], '#c8ccd0'); }
  else if (id === 'axe') { L('#7a5a3a', 2.5, 17); poly([11, -6, 17, -6, 18, 0, 11, 0], '#9a9da2'); }
  else if (id === 'pick') { L('#7a5a3a', 2.5, 17); poly([14, -8, 17, -2, 14, 8, 13, 0], '#9a9da2'); }
  else if (id === 'pistol') { ctx.rotate(1.35 - .1); ctx.fillStyle = '#26282c'; ctx.fillRect(-1, -2, 10, 3.5); ctx.fillRect(-1, 0, 3, 5); }
  else if (id === 'shotgun') { ctx.rotate(1.35 - .1); ctx.fillStyle = '#5a4028'; ctx.fillRect(-6, -1.5, 8, 4); ctx.fillStyle = '#26282c'; ctx.fillRect(1, -2, 17, 3); }
  ctx.restore();
}

const spores = Array.from({length: 46}, () => ({x: R(), y: R(), s: rnd(.6, 2.2), v: rnd(.01, .04)}));
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = loc.bg; ctx.fillRect(0, 0, W, H);
  const [px, py] = iso(P.x, P.y);
  camX = px + (shake ? rnd(-shake, shake) : 0); camY = py - 20 + (shake ? rnd(-shake, shake) : 0);
  const z = dpr * zoom, ox = W / 2 / zoom - camX, oy = H / 2 / zoom - camY;
  ctx.setTransform(z, 0, 0, z, z * ox, z * oy);
  ctx.drawImage(loc.gc, -loc.N * 32, -2);
  const vw = W / 2 / zoom + 70, vh = H / 2 / zoom + 90;
  const vis = (sx, sy) => Math.abs(sx - camX) < vw && Math.abs(sy - camY) < vh;
  // плоские следы
  for (const f of loc.fx) if (f.k === 'splat') { const [sx, sy] = iso(f.x, f.y); ell(sx, sy, f.r, f.r / 2, `rgba(60,80,30,${.55 * (1 - f.t / f.T)})`); }
  // выделение цели
  const near = promptNode, tgt = P.auto && P.auto.t === 'enemy' ? P.auto.e : null;
  const ring = (x, y, r, c) => { const [sx, sy] = iso(x, y); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, r, r / 2, 0, 0, 6.283); ctx.stroke(); };
  if (near && !near.gone) ring(near.x + .5, near.y + .5, 26, '#e0d08099');
  if (tgt && !tgt.dead) ring(tgt.x, tgt.y, 18 * tgt.def.sz, '#ff5040cc');
  if (P.auto && P.auto.t === 'move') ring(P.auto.x, P.auto.y, 8, '#ffffff66');

  const list = [];
  for (const w of loc.walls) { const [sx, sy] = iso(w.x + .5, w.y + .5); if (vis(sx, sy)) list.push({d: w.x + w.y + 1, sx, sy, w}); }
  for (const n of loc.nodes) { const [sx, sy] = iso(n.x + .5, n.y + .5); if (vis(sx, sy)) list.push({d: n.x + n.y + (NODES[n.k] && !NODES[n.k].solid ? .2 : 1), sx, sy, n}); }
  for (const e of loc.en) { const [sx, sy] = iso(e.x, e.y); if (vis(sx, sy)) list.push({d: e.x + e.y, sx, sy, e}); }
  list.push({d: P.x + P.y, sx: px, sy: py, p: 1});
  list.sort((a, b) => a.d - b.d);
  for (const o of list) {
    ctx.save(); ctx.translate(o.sx, o.sy);
    if (o.w) {
      if (o.w.bunk) { cube(32, 16, o.w.h, '#3a4048'); ctx.fillStyle = '#22262c'; if (o.w.v < .3) ctx.fillRect(-2, -o.w.h + 6, 4, o.w.h - 4); }
      else cube(32, 16, o.w.h, o.w.v < .5 ? '#77756e' : '#6a6862');
    } else if (o.n) drawNode(o.n);
    else if (o.e) {
      const e = o.e, d = e.def;
      if (d.boss) ell(0, 0, 30, 14, `rgba(255,30,60,${.15 + .1 * Math.sin(time * 4)})`);
      drawChar({sz: d.sz, wide: d.wide, fx: e.fx, body: d.body, skin: d.skin, walk: e.walk, atk: e.atk > 0 ? e.atk / .35 : 0, kind: e.t, hit: e.hit > 0, spikes: d.spikes, boss: d.boss});
      if (e.hp < d.hp) { const w = 26 * d.sz, y = -44 * d.sz; ctx.fillStyle = '#000a'; ctx.fillRect(-w / 2, y, w, 4); ctx.fillStyle = d.boss ? '#ff3060' : '#c04030'; ctx.fillRect(-w / 2, y, w * e.hp / d.hp, 4); }
    } else {
      const a = G.p.eq.armor, w = G.p.eq.weapon;
      const body = a ? {jacket: '#5a4a34', plate: '#6a6e74', hazmat: '#c8a020'}[a.id] : '#3d5a4a';
      drawChar({sz: 1, fx: P.fx, body, skin: '#d0a888', walk: P.walk, atk: P.atk > 0 ? P.atk / .22 : 0, kind: 'player', hit: P.hurt > .15, wpn: P.gather && NODES[P.gather.n.k].tool || (w && w.id), low: G.p.filter <= 0 && !loc.bunker});
    }
    ctx.restore();
  }
  // снаряды, эффекты
  for (const p of loc.proj) { const [sx, sy] = iso(p.x, p.y); ell(sx, sy, 5, 2.5, '#0005'); ell(sx, sy - 20, 4.5, 4.5, '#a0e040'); ell(sx - 1, sy - 21, 2, 2, '#e0ff90'); }
  for (const f of loc.fx) {
    const [sx, sy] = iso(f.x, f.y), k = f.t / f.T;
    if (f.k === 'blood') ell(sx, sy - f.h, 2.2, 2.2, '#5a8030');
    else if (f.k === 'tracer') { const [ex, ey] = iso(f.x2, f.y2); ctx.strokeStyle = `rgba(255,230,140,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx + P.fx * 10, sy - 22); ctx.lineTo(ex, ey - 20); ctx.stroke(); ell(sx + P.fx * 12, sy - 22, 5, 5, `rgba(255,220,120,${1 - k})`); }
    else if (f.k === 'cloud') ell(sx, sy - 10, 75 * k + 20, 38 * k + 10, `rgba(170,210,50,${.5 * (1 - k)})`);
  }
  if (P.gather) {
    const g = P.gather, [sx, sy] = iso(g.n.x + .5, g.n.y + .5);
    ctx.lineWidth = 5; ctx.strokeStyle = '#000a'; ctx.beginPath(); ctx.arc(sx, sy - 50, 11, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = '#d8e070'; ctx.beginPath(); ctx.arc(sx, sy - 50, 11, -1.57, -1.57 + 6.283 * g.t / g.T); ctx.stroke();
  }
  if (near && !near.gone) {
    const [sx, sy] = iso(near.x + .5, near.y + .5);
    const nm = near.k === 'mod' ? MODS[near.mod].n + (G.mods[near.mod] ? '' : ' (не построено)') : NODES[near.k].n;
    ctx.font = '600 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000c'; ctx.fillStyle = '#f0e8c0';
    const yy = sy - (near.k === 'mod' ? MODS[near.mod].h + 30 : 66); ctx.strokeText(nm, sx, yy); ctx.fillText(nm, sx, yy);
  }
  ctx.textAlign = 'center';
  for (const t of loc.txt) {
    const [sx, sy] = iso(t.x, t.y); ctx.globalAlpha = 1 - t.t; ctx.font = '700 13px system-ui,sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = t.c; ctx.strokeText(t.s, sx, sy - t.h - t.t * 26); ctx.fillText(t.s, sx, sy - t.h - t.t * 26);
  }
  ctx.globalAlpha = 1;

  // атмосфера (в экранных координатах)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (loc.bunker) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .2, W / 2, H / 2, Math.max(W, H) * .75);
    g.addColorStop(0, G.mods.gen ? 'rgba(255,220,150,.05)' : 'rgba(0,0,0,.12)'); g.addColorStop(1, G.mods.gen ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.88)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    const f = loc.def.fog; ctx.fillStyle = `rgba(${f[0]},${f[1]},${f[2]},${f[3]})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(${f[0] + 60},${f[1] + 60},${f[2] + 40},.35)`;
    for (const s of spores) {
      const x = ((s.x * W - camX * zoom * .6 + time * 14 * s.s) % W + W) % W, y = ((s.y * H - camY * zoom * .6 + Math.sin(time * s.v * 20 + s.x * 9) * 20) % H + H) % H;
      ctx.fillRect(x, y, s.s, s.s);
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,16,4,.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (G.p.filter <= 0) { ctx.fillStyle = `rgba(150,200,30,${.12 + .1 * Math.sin(time * 5)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (P.hurt > 0) { ctx.fillStyle = `rgba(200,20,20,${P.hurt * 1.2})`; ctx.fillRect(0, 0, W, H); }
  if (flash > 0) { ctx.fillStyle = `rgba(0,0,0,${flash})`; ctx.fillRect(0, 0, W, H); }
  if (joy.id != null) {
    ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 45, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.arc(joy.sx + joy.x * 45, joy.sy + joy.y * 45, 20, 0, 6.283); ctx.fill();
  }
}

// ---------- HUD ----------
let promptNode = null, hudT = 0;
const toasts = $('#toasts');
function toast(s, cls = '') {
  const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = s; toasts.appendChild(d);
  while (toasts.children.length > 5) toasts.firstChild.remove();
  setTimeout(() => d.remove(), 4200);
}
function goalText() {
  const m = G.mods;
  if (G.won) return '♦️ Реактор запущен — воздух очищается. Вы победили!';
  if (!m.bench && !haveAll('axe') && !haveAll('pick')) return loc.bunker ? 'Цель: выйдите через люк 🪜 и соберите ветки, камни, волокно' : 'Цель: соберите ветки, камни, волокно и создайте топор и кирку (🔨)';
  if (!m.bench) return 'Цель: постройте верстак в бункере (10 🪵, 5 🪨)';
  if (!m.furnace) return 'Цель: постройте плавильню — железо и уголь';
  if (!m.filt) return 'Цель: постройте станцию фильтров для дальних вылазок';
  if (!m.kitchen) return 'Цель: постройте кухню — чистая вода и горячая еда';
  if (!m.gen) return 'Цель: соберите генератор (электроника и топливо — в руинах города)';
  if (!m.armory) return 'Цель: постройте оружейную — на базе и в Эпицентре без стволов тяжело';
  return `Цель: добудьте рубины в Эпицентре (${haveAll('ruby')}/8) и постройте реактор «Рубин»`;
}
function hud() {
  if (!G || !loc) return;
  const p = G.p, set = (id, v, max, txt) => {
    const el = $('#b-' + id); el.style.width = clamp(v / max * 100, 0, 100) + '%';
    el.parentNode.parentNode.classList.toggle('low', v / max < .2); $('#t-' + id).textContent = txt;
  };
  set('hp', p.hp, 100, Math.ceil(p.hp)); set('hu', p.hunger, 100, Math.ceil(p.hunger)); set('th', p.thirst, 100, Math.ceil(p.thirst));
  const sp = count(p.inv, 'filter') + count(p.inv, 'filter2') + count(p.inv, 'filter0');
  set('fi', p.filter, p.fcap, `${Math.ceil(p.filter / p.fcap * 100)}% +${sp}`);
  $('#locname').textContent = `${loc.name} · День ${G.day}`;
  $('#goal').textContent = goalText();
  $('#m-build').classList.toggle('hidden', !loc.bunker);
  $('#btns').classList.toggle('bunk', !!loc.bunker);
  const w = p.eq.weapon, wd = weapon();
  $('#weapon').textContent = (w ? `${ITEMS[w.id].i} ${ITEMS[w.id].n} ${w.d}/${ITEMS[w.id].dur}` : '👊 Кулаки') + (w && ITEMS[w.id].w.ranged ? ` · 🔶 ${count(p.inv, 'ammo')}` : '') + ` · урон ${wd.dmg}`;
  const q = {eat: 0, drink: 0, heal: 0};
  for (const s of p.inv) if (s && ITEMS[s.id].eat) { const e = ITEMS[s.id].eat; if (e.hunger) q.eat += s.n; if (e.thirst >= 15) q.drink += s.n; if (!e.hunger && !e.thirst) q.heal += s.n; }
  for (const k in q) { $('#q-' + k).textContent = q[k] || ''; $('#q-' + k).parentNode.classList.toggle('none', !q[k]); }
  // подсказка
  const pr = $('#prompt'); let txt = '', bad = false;
  promptNode = null;
  if (!ui.panel) {
    if (inExit()) txt = '<kbd>E</kbd>Покинуть локацию';
    else {
      const n = nearestNode(1.7); promptNode = n;
      if (n && !P.gather) {
        if (n.k === 'mod') txt = `<kbd>E</kbd>${G.mods[n.mod] ? MODS[n.mod].n : 'Построить: ' + MODS[n.mod].n}`;
        else { const d = NODES[n.k]; bad = d.tool && !findTool(d.tool); txt = `<kbd>E</kbd>${d.v}: ${d.n}` + (bad ? ` — нужен ${d.tool === 'axe' ? 'топор' : 'кирка'}` : ''); }
      }
    }
  }
  if (txt) pr.innerHTML = txt;
  pr.classList.toggle('on', !!txt); pr.classList.toggle('bad', !!bad);
}

// ---------- панели ----------
const panel = $('#panel');
function openPanel(t, arg) { ui.panel = t; ui.arg = arg; ui.sel = null; P && (P.auto = null, P.gather = null); for (const k in keys) keys[k] = 0; atkHeld = false; joy.id = null; joy.x = joy.y = 0; panel.classList.remove('hidden'); drawPanel(); }
function closePanel(silent) { ui.panel = null; panel.classList.add('hidden'); panel.innerHTML = ''; if (!silent && loc && loc.bunker) save(); }
const chips = c => '<div class="chips">' + Object.keys(c).map(id => `<span class="chip ${have(id) < c[id] ? 'no' : ''}">${ITEMS[id].i} ${have(id)}/${c[id]}</span>`).join('') + '</div>';
function itemDesc(id) {
  const it = ITEMS[id], a = [];
  if (it.w) a.push(`урон ${it.w.dmg}, дальность ${it.w.rg}` + (it.w.ranged ? ', тратит патроны' : ''));
  if (it.tool) a.push(it.tool === 'axe' ? 'рубит деревья' : 'дробит камень и руду');
  if (it.dur) a.push(`прочность ${it.dur}`);
  if (it.armor) a.push(`защита ${Math.round(it.armor * 100)}%`);
  if (it.filt) a.push(`ресурс ${it.filt}`);
  if (it.eat) { const e = it.eat; if (e.hunger) a.push(`сытость +${e.hunger}`); if (e.thirst) a.push(`вода +${e.thirst}`); if (e.hp) a.push(`здоровье ${e.hp > 0 ? '+' : ''}${e.hp}`); }
  if (it.d) a.push(it.d);
  return a.join(' · ');
}
function slotHtml(s, w, i) {
  const sel = ui.sel && ui.sel.w === w && ui.sel.i === i ? ' sel' : '';
  if (!s) return `<div class="slot${sel}" data-a="sel" data-w="${w}" data-i="${i}"></div>`;
  const it = ITEMS[s.id];
  return `<div class="slot${sel}" data-a="sel" data-w="${w}" data-i="${i}" title="${it.n}">${it.i}${s.n > 1 ? `<b>${s.n}</b>` : ''}${s.d != null ? `<span class="dur"><i style="width:${s.d / it.dur * 100}%"></i></span>` : ''}</div>`;
}
function selSlot() {
  const s = ui.sel; if (!s) return null;
  return s.w === 'inv' ? G.p.inv[s.i] : s.w === 'st' ? G.storage[s.i] : s.w === 'eqw' ? G.p.eq.weapon : G.p.eq.armor;
}
function drawPanel() {
  const t = ui.panel, p = G && G.p; let h = '';
  const head = (s, narrow) => `<div class="win ${narrow ? 'narrow' : ''}"><div class="ptitle"><span>${s}</span><button data-a="close">✕</button></div><div class="pbody">`;
  if (t === 'title') {
    h = `<div class="win narrow"><div class="title"><h1>БУНКЕР «РУБИН»</h1><h2>Изометрическая выживалка в зомби-апокалипсисе</h2>
      ${load() ? '<button class="btn big" data-a="continue">Продолжить</button>' : ''}<button class="btn big ${load() ? 'red' : ''}" data-a="new">Новая игра</button>
      <div class="keys"><kbd>WASD</kbd> / стрелки / клик — движение · <kbd>E</kbd> — действие · <kbd>Пробел</kbd> — атака<br>
      <kbd>I</kbd> рюкзак · <kbd>C</kbd> крафт · <kbd>B</kbd> бункер · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> еда, вода, лечение<br>На телефоне: джойстик в левой части экрана и кнопки справа</div></div></div>`;
  } else if (t === 'help') {
    h = head('Как выжить', 1) + `<p>Поверхность отравлена. Пока вы наверху, <b>фильтр противогаза</b> расходуется — тем быстрее, чем токсичнее локация. Без фильтра вы быстро теряете здоровье. Запасные фильтры ставятся автоматически.</p>
      <p><b>Бункер</b> — безопасное место. Стройте модули (🏗️), храните добычу на складе, создавайте фильтры, оружие и еду.</p>
      <p>Ветки, камни и кусты собираются руками. Для деревьев нужен <b>топор</b>, для валунов, руды, угля и кристаллов — <b>кирка</b>.</p>
      <p>Чтобы покинуть локацию, дойдите до светлой полосы по краю карты и нажмите <kbd>E</kbd>.</p>
      <p>При гибели содержимое рюкзака теряется, экипировка остаётся. Прогресс сохраняется в бункере.</p>
      <p><b>Главная цель</b> — добыть 8 рубиновых кристаллов в Эпицентре и построить реактор «Рубин».</p>
      <p class="keys"><kbd>WASD</kbd> движение · <kbd>E</kbd> действие · <kbd>Пробел</kbd> атака · <kbd>I</kbd> <kbd>C</kbd> <kbd>B</kbd> меню · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> быстрые предметы</p></div></div>`;
  } else if (t === 'inv') {
    const b = loc.bunker, s = selSlot(); let det = 'Выберите предмет';
    if (s) {
      const it = ITEMS[s.id], w = ui.sel.w, acts = [];
      if (w === 'inv') {
        if (it.eat) acts.push('<button class="btn" data-a="use">Использовать</button>');
        if (it.filt) acts.push('<button class="btn" data-a="use">Установить в противогаз</button>');
        if (it.w || it.armor) acts.push('<button class="btn" data-a="use">Экипировать</button>');
        if (b) acts.push('<button class="btn" data-a="tost">На склад</button>');
        acts.push('<button class="btn red" data-a="drop">Выбросить</button>');
      } else if (w === 'st') acts.push('<button class="btn" data-a="toinv">В рюкзак</button>');
      else acts.push('<button class="btn" data-a="uneq">Снять</button>');
      det = `<b>${it.i} ${it.n}</b>${s.n > 1 ? ' ×' + s.n : ''}${s.d != null ? ` (${s.d}/${it.dur})` : ''}<br><span style="color:#8f987a">${itemDesc(s.id)}</span><div class="acts">${acts.join('')}</div>`;
    }
    h = head(b ? 'Рюкзак и склад' : 'Рюкзак') + `<div class="row">
      <div class="col" style="flex:0 0 120px;min-width:120px"><h4>Экипировка</h4><div class="grid" style="grid-template-columns:1fr 1fr">${slotHtml(p.eq.weapon, 'eqw', 0)}${slotHtml(p.eq.armor, 'eqa', 0)}</div>
        <p style="font-size:11px">Оружие · Броня<br>Убито: ${G.kills}</p></div>
      <div class="col"><h4>Рюкзак ${p.inv.filter(x => x).length}/${p.inv.length} ${b ? '<button class="btn sm" data-a="allst">Ресурсы на склад</button>' : ''}</h4><div class="grid">${p.inv.map((s, i) => slotHtml(s, 'inv', i)).join('')}</div></div>
      ${b ? `<div class="col"><h4>Склад ${G.storage.filter(x => x).length}/${G.storage.length}</h4><div class="grid">${G.storage.map((s, i) => slotHtml(s, 'st', i)).join('')}</div></div>` : ''}
      </div><div class="detail">${det}</div></div></div>`;
  } else if (t === 'craft') {
    h = head('Создание предметов');
    const order = ui.arg ? [ui.arg, ...Object.keys(STATIONS).filter(s => s !== ui.arg)] : Object.keys(STATIONS);
    for (const st of order) {
      const ok = st === 'hand' || (loc.bunker && G.mods[st]);
      h += `<div class="sect ${ok ? '' : 'lock'}">${st === 'hand' ? '✋' : MODS[st].i} ${STATIONS[st]}${ok ? '' : G.mods[st] ? ' — доступно только в бункере' : ' — не построено'}</div>`;
      RECIPES.forEach((r, i) => {
        if (r.st !== st || (r.up && G.ups[r.up])) return;
        const it = r.out ? ITEMS[r.out] : r, can = ok && canPay(r.c) && (!r.req || G.ups[r.req]);
        h += `<div class="rec ${ok ? '' : 'off'}"><div class="ic">${it.i}</div><div class="inf"><div class="nm">${it.n}${r.k ? ' ×' + r.k : ''}</div><div class="ds">${r.out ? itemDesc(r.out) : r.d}${r.req && !G.ups[r.req] ? ' · сначала нужен обычный рюкзак' : ''}</div>${chips(r.c)}</div><button class="btn" data-a="craft" data-i="${i}" ${can ? '' : 'disabled'}>Создать</button></div>`;
      });
    }
    h += '</div></div>';
  } else if (t === 'build') {
    h = head('Обустройство бункера');
    const ids = Object.keys(MODS).filter(id => !MODS[id].base).sort((a, b) => (a === ui.arg ? -1 : b === ui.arg ? 1 : 0));
    for (const id of ids) {
      const m = MODS[id], done = G.mods[id], rq = m.req && !G.mods[m.req], can = !done && !rq && canPay(m.cost);
      h += `<div class="rec"><div class="ic">${m.i}</div><div class="inf"><div class="nm">${m.n}${done ? ' ✓' : ''}</div><div class="ds">${m.d}${rq ? ` · требуется: ${MODS[m.req].n}` : ''}</div>${done ? '' : chips(m.cost)}</div>${done ? '' : `<button class="btn" data-a="build" data-id="${id}" ${can ? '' : 'disabled'}>Построить</button>`}</div>`;
    }
    h += '</div></div>';
  } else if (t === 'map') {
    const sp = count(p.inv, 'filter') + count(p.inv, 'filter2') + count(p.inv, 'filter0');
    h = head('Карта вылазок') + `<p>Фильтр: <b>${Math.ceil(p.filter / p.fcap * 100)}%</b>, запасных: <b>${sp}</b>. Свободно ячеек: <b>${p.inv.filter(x => !x).length}</b>.${sp === 0 && p.filter < 50 ? ' <span style="color:#f0a090">Мало фильтров!</span>' : ''}</p>`;
    if (!loc.bunker) h += `<div class="loc" style="border-color:#d8c98a"><div class="inf"><div class="nm">🏠 Бункер «Рубин»</div><div class="ds">Вернуться домой с добычей. Прогресс сохранится.</div></div><button class="btn big" data-a="go" data-id="bunker">Домой</button></div>`;
    for (const id in LOCS) {
      const l = LOCS[id]; if (loc.id === id) continue;
      h += `<div class="loc" style="border-color:${['#6b7a45', '#8a9a45', '#c0a040', '#c07030', '#c03030'][l.danger - 1]}"><div class="inf"><div class="nm">${l.n}</div><div class="ds">${l.d}</div><div class="mt">Опасность: ${'☠️'.repeat(l.danger)} · Токсичность ×${l.tox} · ${l.loot}</div></div><button class="btn" data-a="go" data-id="${id}">В путь</button></div>`;
    }
    h += '</div></div>';
  } else if (t === 'dead') {
    h = `<div class="win narrow"><div class="title"><h1>ВЫ ПОГИБЛИ</h1><h2>${ui.arg}. День ${G.day}, убито заражённых: ${G.kills}</h2><p style="font-size:13px;color:#a8ab98;margin-bottom:14px">Содержимое рюкзака потеряно. Экипировка и склад в бункере сохранены.</p><button class="btn big" data-a="respawn">Очнуться в бункере</button></div></div>`;
  } else if (t === 'win') {
    h = `<div class="win narrow"><div class="title"><h1 style="color:#ff5070">♦️ РЕАКТОР ЗАПУЩЕН</h1><h2>Рубиновое ядро очищает воздух вокруг бункера. Вы справились за ${G.day} дн., уничтожив ${G.kills} заражённых.</h2><button class="btn big" data-a="close">Продолжить выживание</button></div></div>`;
  }
  panel.innerHTML = h;
}
panel.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) { if (e.target === panel && !['title', 'dead'].includes(ui.panel)) closePanel(); return; }
  const a = el.dataset.a, p = G && G.p;
  if (a === 'close') return closePanel();
  if (a === 'new') { newGame(); closePanel(true); $('#hud').classList.remove('hidden'); enterBunker(false); toast('Вы в бункере «Рубин». Наверху — отравленный мир.'); return openPanel('help'); }
  if (a === 'continue') { G = load(); closePanel(true); $('#hud').classList.remove('hidden'); return enterBunker(false); }
  if (a === 'respawn') return respawn();
  if (a === 'go') { const id = el.dataset.id, was = loc.bunker; if (was) save(); closePanel(true); return id === 'bunker' ? enterBunker(true) : enterLoc(id); }
  if (a === 'sel') { ui.sel = {w: el.dataset.w, i: +el.dataset.i}; if (!selSlot()) ui.sel = null; }
  else if (a === 'use') { useItem(ui.sel.i); if (!selSlot()) ui.sel = null; }
  else if (a === 'drop') { const s = selSlot(); p.inv[ui.sel.i] = null; if (!loc.bunker) { dropBag([[s.id, s.n]], P.x, P.y); } ui.sel = null; }
  else if (a === 'tost' || a === 'toinv') {
    const from = a === 'tost' ? p.inv : G.storage, to = a === 'tost' ? G.storage : p.inv, s = from[ui.sel.i];
    const r = add(to, s.id, s.n, s.d); if (r) { s.n = r; toast('Нет места', 'bad'); } else { from[ui.sel.i] = null; ui.sel = null; }
  } else if (a === 'allst') {
    p.inv.forEach((s, i) => { if (!s) return; const it = ITEMS[s.id]; if (it.eat || it.dur || it.armor || it.filt || s.id === 'ammo') return; const r = add(G.storage, s.id, s.n); if (r) s.n = r; else p.inv[i] = null; });
    ui.sel = null;
  } else if (a === 'uneq') {
    const k = ui.sel.w === 'eqw' ? 'weapon' : 'armor', i = p.inv.indexOf(null);
    if (i < 0) toast('Рюкзак полон', 'bad'); else { p.inv[i] = p.eq[k]; p.eq[k] = null; ui.sel = null; }
  } else if (a === 'craft') {
    const r = RECIPES[+el.dataset.i]; if (!canPay(r.c)) return;
    pay(r.c); sfx(600, .1, 'triangle', .05, 300);
    if (r.up) { G.ups[r.up] = 1; for (let i = 0; i < 6; i++) p.inv.push(null); toast(`${r.n}: +6 ячеек`, 'gold'); }
    else {
      const it = ITEMS[r.out], k = it.w && !it.tool ? 'weapon' : it.armor ? 'armor' : null;
      if (k && !p.eq[k]) p.eq[k] = {id: r.out, n: 1, ...(it.dur ? {d: it.dur} : {})}; else give(r.out, r.k || 1);
      toast(`Создано: ${ITEMS[r.out].n}${r.k ? ' ×' + r.k : ''}`);
    }
  } else if (a === 'build') {
    const id = el.dataset.id, m = MODS[id]; if (!canPay(m.cost)) return;
    pay(m.cost); G.mods[id] = 1; sfx(300, .3, 'triangle', .06, 500); toast(`Построено: ${m.n}`, 'gold'); save();
    if (id === 'reactor') { G.won = true; save(); return openPanel('win'); }
  }
  hud(); drawPanel();
});

// ---------- ввод ----------
function tap(cx, cy) {
  if (ui.panel || !loc) return;
  const px = (cx - W / 2) / zoom + camX, py = (cy - H / 2) / zoom + camY;
  for (const e of loc.en) { const [ex, ey] = iso(e.x, e.y), s = e.def.sz; if (Math.abs(px - ex) < 15 * s && py > ey - 40 * s && py < ey + 8) { P.auto = {t: 'enemy', e}; P.af = null; return; } }
  const w = (qx, qy) => [(qx / 32 + qy / 16) / 2, (qy / 16 - qx / 32) / 2];
  for (const off of [0, 16, 32]) {
    const [wx, wy] = w(px, py + off), n = loc.nmap.get((wy | 0) * loc.N + (wx | 0));
    if (n && wx >= 0 && wy >= 0 && (off === 0 || n.k === 'mod' || NODES[n.k].solid)) { P.auto = {t: 'node', n}; P.af = null; return; }
  }
  const [wx, wy] = w(px, py);
  P.auto = {t: 'move', x: wx, y: wy}; P.af = null; P.gather = null;
}
cv.addEventListener('pointerdown', e => {
  if (ui.panel) return;
  if (e.pointerType === 'touch' && e.clientX < W * .45 && e.clientY > H * .3 && joy.id == null) { joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.moved = false; joy.t = performance.now(); return; }
  tap(e.clientX, e.clientY);
});
addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.sx, dy = e.clientY - joy.sy, l = Math.hypot(dx, dy);
  if (l > 8) joy.moved = true;
  const k = l > 45 ? 45 / l : 1; joy.x = dx * k / 45; joy.y = dy * k / 45;
});
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; if (!joy.moved && performance.now() - joy.t < 300) tap(joy.sx, joy.sy); };
addEventListener('pointerup', joyEnd); addEventListener('pointercancel', joyEnd);
addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!G || !loc) return;
  if (ui.panel) {
    if (['title', 'dead'].includes(ui.panel)) return;
    if (e.code === 'Escape' || e.code === 'KeyE' || (e.code === 'KeyI' && ui.panel === 'inv') || (e.code === 'KeyC' && ui.panel === 'craft') || (e.code === 'KeyB' && ui.panel === 'build')) closePanel();
    return;
  }
  keys[e.code] = 1;
  if (e.repeat) return;
  if (e.code === 'KeyE') doUse();
  else if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); openPanel('inv'); }
  else if (e.code === 'KeyC') openPanel('craft');
  else if (e.code === 'KeyB' && loc.bunker) openPanel('build');
  else if (e.code === 'Digit1') quick('eat'); else if (e.code === 'Digit2') quick('drink'); else if (e.code === 'Digit3') quick('heal');
});
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; atkHeld = false; });
$('#menu').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b && !ui.panel) openPanel(b.dataset.m); });
$('#quick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b && !ui.panel) { quick(b.dataset.q); hud(); } });
$('#bUse').addEventListener('click', () => doUse());
const bAtk = $('#bAtk');
bAtk.addEventListener('pointerdown', e => { atkHeld = true; e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bAtk.addEventListener(ev, () => { atkHeld = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && loc && loc.bunker && !ui.panel) save(); });

// ---------- Android: полный экран и альбомная ориентация ----------
const coarse = matchMedia('(pointer:coarse)'), portrait = matchMedia('(orientation:portrait)');
function goLandscape() {
  if (!coarse.matches) return;
  try {
    const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    const p = document.fullscreenElement || !fs ? Promise.resolve() : fs.call(el, {navigationUI: 'hide'});
    Promise.resolve(p).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  } catch (e) {}
}
addEventListener('pointerup', goLandscape);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- цикл ----------
let last = 0;
function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  if (G && loc) {
    if (!ui.panel && !(coarse.matches && portrait.matches)) update(dt);
    render();
    if ((hudT -= dt) <= 0) { hud(); hudT = .12; }
  } else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0d0a'; ctx.fillRect(0, 0, cv.width, cv.height); }
  requestAnimationFrame(frame);
}
ui.panel = 'title'; panel.classList.remove('hidden'); drawPanel();
requestAnimationFrame(frame);

// отладочный доступ для тестов
window._dbg = {get G() { return G; }, get loc() { return loc; }, get P() { return P; }, enterLoc, enterBunker, give, update, tap};
})();
