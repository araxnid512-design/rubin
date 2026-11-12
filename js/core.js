'use strict';
// ===== Общее состояние, инвентарь, генерация локаций, навигация =====
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
const R = Math.random, rnd = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const iso = (x, y) => [(x - y) * 32, (x + y) * 16];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = a => a[Math.floor(R() * a.length)];
const SAVE = 'rubin_save_v2';
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

let W, H, dpr, zoom, camX = 0, camY = 0, camSet = false;
let G = null, loc = null, P = null;
let time = 0, shake = 0, pfield = null, pft = 0, flash = 0, hitstop = 0;
const ui = {panel: null, tab: 'inv', arg: null, sel: null, mapSel: null};
const keys = {}, joy = {id: null, x: 0, y: 0, sx: 0, sy: 0};
let atkHeld = false;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  zoom = clamp(Math.min(W, H) / 430, 1, 1.9);
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
  if (r) dropBag([[id, r, d]], P.x, P.y);
  return r;
}

// ---------- прогресс ----------
const pk = id => G.perks[id] || 0;
const modLv = id => G.mods[id] || 0;
const maxHp = () => 100 + 20 * pk('tough');
const xpNeed = () => 50 + 40 * (G.lvl - 1);
function rollOffer() {
  const ids = Object.keys(PERKS).filter(id => pk(id) < 3).sort(() => R() - .5);
  G.offer = ids.slice(0, 3);
}
function addXp(n) {
  G.xp += n;
  while (G.xp >= xpNeed()) {
    G.xp -= xpNeed(); G.lvl++; G.pts++;
    if (!G.offer) rollOffer();
    toast(`Уровень ${G.lvl}! Выберите навык (K)`, 'gold'); sfx(520, .25, 'triangle', .06, 500);
    if (P) burst(P.x, P.y, 30, '#ffe080', 16, 2.2);
  }
}
function newContracts() {
  const out = [], rw = () => { const r = pick(Q_REWARD); return [r[0], r[1]]; };
  const br = Q_BRING.slice().sort(() => R() - .5);
  for (let i = 0; i < 2; i++) out.push({type: 'bring', id: br[i][0], n: br[i][1], rw: [rw()], xp: 35});
  const k = pick(Q_KILL); out.push({type: 'kill', id: k[0], n: k[1], prog: 0, rw: [rw(), rw()], xp: 60});
  G.contracts = out;
}
function newGame() {
  G = {v: 2, day: 1, clock: 8, won: false, kills: 0, xp: 0, lvl: 1, pts: 0, offer: null, perks: {}, ups: {}, bp: {},
    mods: {hatch: 1, storage: 1, bed: 1}, acc: {water: 0, garden: 0}, contracts: [],
    storage: new Array(30).fill(null),
    p: {hp: 100, hunger: 90, thirst: 90, filter: 100, fcap: 100, bleed: 0, inv: new Array(12).fill(null), eq: {weapon: null, armor: null}}};
  add(G.p.inv, 'filter', 2); add(G.p.inv, 'canned', 2); add(G.p.inv, 'water', 2); add(G.p.inv, 'bandage', 1);
}
function save() { try { localStorage.setItem(SAVE, JSON.stringify(G)); } catch (e) {} }
function load() { try { const g = JSON.parse(localStorage.getItem(SAVE)); if (g && g.v === 2 && g.p) return g; } catch (e) {} return null; }

function mkPlayer(x, y) {
  P = {x, y, r: .25, fx: 1, dx: .7, dy: .7, walk: 0, cd: 0, atk: 0, hurt: 0, auto: null, af: null, aft: 0, gather: null, stuck: 0, cough: 0,
    sneak: false, st: 100, stWait: 0, dash: 0, ddx: 0, ddy: 0, inv: 0, step: 0};
  camSet = false;
}

// ---------- локации ----------
function mkLoc(id, N) {
  return {id, N, ground: new Uint8Array(N * N), solid: new Uint8Array(N * N), nodes: [], nmap: new Map(), walls: [], en: [], proj: [], fx: [], txt: [], fog: [], noise: 0, spawnT: 30, t: 0};
}
function rollLoot(k) {
  const d = NODES[k], out = [];
  if (d.table) {
    const t = TABLES[d.table], tot = t.reduce((s, e) => s + e[1], 0);
    for (let i = 0; i < (k === 'cache' ? 5 : 3); i++) { let r = R() * tot; for (const e of t) { r -= e[1]; if (r <= 0) { for (let j = ri(e[2], e[3]); j > 0; j--) out.push(e[0]); break; } } }
  } else if (d.loot) for (const [id, a, b, p] of d.loot) if (p == null || R() < p) for (let j = ri(a, b); j > 0; j--) out.push(id);
  return out.sort(() => R() - .5);
}
function addNode(L, k, x, y, ex) {
  const n = Object.assign({k, x, y, v: R(), sh: 0}, ex);
  if (k === 'bag') n.loot = []; else if (k !== 'mod') { n.units = rollLoot(k); n.hp = NODES[k].hp; }
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
    for (const [id, n, d] of loot) { const o = b.loot.find(l => l[0] === id && stackOf(id) > 1); if (o) o[1] += n; else b.loot.push([id, n, d]); }
    return;
  }
}

function genBunker() {
  const N = 13, L = mkLoc('bunker', N);
  L.bunker = true; L.name = 'Бункер «Рубин»'; L.bg = '#050608'; L.gt = 'bunker';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x;
    if (x >= 1 && x <= 11 && y >= 1 && y <= 9) L.ground[k] = 1;
    else { L.solid[k] = 1; if ((x === 0 && y <= 9) || (y === 0 && x <= 11)) L.walls.push({x, y, h: 50, bunk: 1, v: R()}); }
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
  L.roads = [];
  if (def.roads) {
    for (const r of [ri(6, (N >> 1) - 4), ri((N >> 1) + 2, N - 9)]) { L.roads.push(['h', r]); for (let x = 0; x < N; x++) L.ground[r * N + x] = L.ground[(r + 1) * N + x] = 4; }
    for (const c of [ri(6, (N >> 1) - 4), ri((N >> 1) + 3, N - 9)]) { L.roads.push(['v', c]); for (let y = 0; y < N; y++) L.ground[y * N + c] = L.ground[y * N + c + 1] = 4; }
  }
  const sx = N >> 1, sy = N - 3; L.spawn = [sx + .5, sy + .5];
  const free = (x, y) => x >= 2 && y >= 2 && x < N - 2 && y < N - 2 && !L.solid[y * N + x] && !L.nmap.has(y * N + x) && Math.hypot(x - sx, y - sy) > 2.5;
  const place = (pred) => { for (let i = 0; i < 400; i++) { const x = ri(2, N - 3), y = ri(2, N - 3); if (free(x, y) && (!pred || pred(x, y))) return [x, y]; } return null; };
  // руины зданий
  const bl = [];
  for (let b = 0, tries = 0; b < (def.buildings || 0) && tries < 400; tries++) {
    const w = ri(4, 7), h = ri(4, 7), x0 = ri(3, N - 4 - w), y0 = ri(3, N - 4 - h);
    if (x0 + w > N - 3 || y0 + h > N - 3) continue;
    if (sx >= x0 - 3 && sx <= x0 + w + 2 && sy >= y0 - 3 && sy <= y0 + h + 2) continue;
    if (bl.some(o => x0 < o[0] + o[2] + 2 && x0 + w + 2 > o[0] && y0 < o[1] + o[3] + 2 && y0 + h + 2 > o[1])) continue;
    let road = false; for (let y = y0; y < y0 + h && !road; y++) for (let x = x0; x < x0 + w; x++) if (L.ground[y * N + x] === 4) { road = true; break; }
    if (road) continue;
    bl.push([x0, y0, w, h]); b++;
    const doors = [[x0 + ri(1, w - 2), y0], [x0 + ri(1, w - 2), y0 + h - 1], [x0, y0 + ri(1, h - 2)], [x0 + w - 1, y0 + ri(1, h - 2)]];
    const tall = ri(26, 40);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      L.ground[y * N + x] = 3;
      if (edge && R() < .84 && !doors.some(d => d[0] === x && d[1] === y)) {
        const back = x === x0 || y === y0; // дальние стены выше, ближние ниже — чтобы не закрывать обзор
        L.solid[y * N + x] = 1; L.walls.push({x, y, h: back ? tall - ri(0, 8) : ri(10, 18), v: R(), win: back && R() < .5});
      }
    }
    if (R() < .85) addNode(L, def.bcrate, x0 + ri(1, w - 2), y0 + ri(1, h - 2));
    if (R() < .4) { const x = x0 + ri(1, w - 2), y = y0 + ri(1, h - 2); if (!L.nmap.has(y * N + x)) addNode(L, def.bcrate, x, y); }
  }
  const c = N / 2;
  for (const k in def.nodes) for (let i = 0; i < def.nodes[k]; i++) {
    const p = place(k === 'ruby' ? (x, y) => Math.hypot(x - c, y - c) < 8 : k === 'car' && def.roads && R() < .75 ? (x, y) => L.ground[y * N + x] === 4 : null);
    if (p) addNode(L, k, p[0], p[1]);
  }
  for (const t in def.en) for (let i = 0; i < def.en[t]; i++) {
    const p = place(t === 'boss' ? (x, y) => Math.hypot(x - c, y - c) < 4 : (x, y) => Math.hypot(x - sx, y - sy) > 9);
    if (p) spawnEnemy(L, t, p[0] + .5, p[1] + .5);
  }
  // тайник с чертежом под охраной элитного врага
  if (def.bps) {
    const p = place((x, y) => Math.hypot(x - sx, y - sy) > N * .45);
    if (p) {
      addNode(L, 'cache', p[0], p[1]);
      const t = Object.keys(def.en).filter(t => t !== 'boss').sort((a, b) => ENEMIES[b].hp - ENEMIES[a].hp)[0];
      for (const [ax, ay] of D8) if (free(p[0] + ax, p[1] + ay)) { spawnEnemy(L, t, p[0] + ax + .5, p[1] + ay + .5, true); break; }
    }
  }
  L.base = L.en.length;
  for (let i = 0; i < 9; i++) L.fog.push({x: rnd(0, N), y: rnd(0, N), vx: rnd(-.25, .25), vy: rnd(-.25, .25), s: rnd(.8, 1.6), a: rnd(.5, 1)});
  paintGround(L);
  return L;
}
function spawnEnemy(L, t, x, y, elite) {
  const d = ENEMIES[t], a = R() * 6.28;
  const e = {t, def: d, x, y, hp: d.hp * (elite ? 1.9 : 1), mhp: d.hp * (elite ? 1.9 : 1), r: Math.min(.4, .26 * d.sz), cd: rnd(0, 1), wind: 0, aggro: false, alert: 0, lost: 0,
    wt: rnd(0, 3), wx: 0, wy: 0, fx: 1, fdx: Math.cos(a), fdy: Math.sin(a), walk: R() * 6, hit: 0, stun: 0, atk: 0, elite: !!elite};
  L.en.push(e); return e;
}

// ---------- отрисовка земли (один раз на локацию) ----------
function vnoise(x, y, s) {
  const h = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7 + s) * 43758.5453; return n - Math.floor(n); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
const GCOL = { // [основа, пятна, пол зданий, дорога] в HSL
  grass: [[92, 26, 24], [70, 22, 20], [30, 12, 26], [30, 10, 20]],
  dirt: [[32, 26, 27], [26, 20, 22], [30, 10, 22], [30, 10, 20]],
  asph: [[95, 14, 21], [40, 10, 24], [28, 9, 30], [220, 6, 17]],
  conc: [[45, 7, 31], [70, 12, 24], [30, 8, 36], [220, 5, 19]],
  sludge: [[95, 30, 16], [84, 42, 21], [30, 8, 26], [30, 10, 20]],
  bunker: [[212, 10, 22]],
};
function paintGround(L) {
  const N = L.N, c = document.createElement('canvas'); c.width = N * 64; c.height = N * 32 + 4;
  const g = c.getContext('2d'); g.translate(N * 32, 2);
  const cols = GCOL[L.gt], seed = R() * 100;
  const dia = (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + 32, py + 16); g.lineTo(px, py + 32); g.lineTo(px - 32, py + 16); g.closePath(); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = L.ground[y * N + x]; if (!t) continue;
    const [h, s, l] = cols[t - 1], [px, py] = iso(x, y);
    const exit = !L.bunker && (x < 2 || y < 2 || x >= N - 2 || y >= N - 2);
    const ll = l + (vnoise(x * .32, y * .32, seed) - .5) * (L.bunker ? 4 : 9) + rnd(-.7, .7) + (exit ? 6 : 0) + (L.bunker && (x + y) % 2 ? 1.2 : 0);
    const col = `hsl(${h + (vnoise(x * .2, y * .2, seed + 9) - .5) * 14},${s}%,${ll}%)`;
    g.fillStyle = col; g.strokeStyle = L.bunker ? '#0008' : col; g.lineWidth = 1; dia(px, py); g.fill(); g.stroke();
    if (L.bunker) { g.fillStyle = '#ffffff12'; for (const [ax, ay] of [[0, 3], [26, 16], [0, 29], [-26, 16]]) g.fillRect(px + ax - 1, py + ay - 1, 2, 2); continue; }
    // мелкие детали
    const cx = px + rnd(-16, 16), cy = py + 16 + rnd(-6, 6), k = R();
    if (t === 4) { if (k < .18) { g.strokeStyle = '#0006'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + rnd(-10, 10), cy + rnd(-5, 5)); g.lineTo(cx + rnd(-14, 14), cy + rnd(-7, 7)); g.stroke(); } continue; }
    if (L.gt === 'grass' && t !== 3) {
      if (k < .55) { g.strokeStyle = `hsl(${h + rnd(-10, 10)},${s + 8}%,${ll + rnd(5, 11)}%)`; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < 4; i++) { const tx = cx + rnd(-10, 10), ty = cy + rnd(-5, 5); g.moveTo(tx, ty); g.lineTo(tx + rnd(-2, 2), ty - rnd(3, 6)); } g.stroke(); }
      else if (k < .6) { g.fillStyle = pick(['#d8c860', '#c090d0', '#e0e0d0']); g.fillRect(cx, cy, 2, 2); g.fillRect(cx + 5, cy + 2, 2, 2); }
      else if (k < .7) { g.fillStyle = '#6a4a2a88'; g.fillRect(cx, cy, 3, 1.5); g.fillRect(cx - 6, cy + 3, 2.5, 1.5); }
    } else if (L.gt === 'sludge') {
      if (t === 2 && k < .5) { g.fillStyle = '#c8ff5044'; g.beginPath(); g.ellipse(cx, cy, rnd(2, 6), rnd(1, 3), 0, 0, 6.283); g.fill(); }
      else if (k < .08) { g.strokeStyle = '#d8d0c0aa'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 5, cy); g.lineTo(cx + 5, cy + 2); g.stroke(); }
    } else {
      if (k < .3) { g.fillStyle = `hsla(${h},${s}%,${ll + (R() < .5 ? 9 : -8)}%,.8)`; for (let i = 0; i < 3; i++) g.fillRect(px + rnd(-18, 18), py + 16 + rnd(-7, 7), rnd(1, 4), rnd(1, 2)); }
      else if (k < .4) { g.strokeStyle = '#0005'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + rnd(-9, 9), cy + rnd(-4, 4)); g.lineTo(cx + rnd(-12, 12), cy + rnd(-6, 6)); g.stroke(); }
      else if (k < .46 && t !== 3) { g.fillStyle = '#00000022'; g.beginPath(); g.ellipse(cx, cy, rnd(6, 12), rnd(3, 6), 0, 0, 6.283); g.fill(); }
    }
  }
  if (L.bunker) { // разметка у люка
    const m = MODS.hatch;
    for (const [ax, ay] of D8) { const [px, py] = iso(m.x + ax, m.y + ay); if (L.ground[(m.y + ay) * N + m.x + ax]) { g.fillStyle = '#e0b03022'; dia(px, py); g.fill(); } }
  } else {
    g.strokeStyle = '#f0d87055'; g.lineWidth = 2; g.setLineDash([10, 8]); g.beginPath();
    const a = iso(2, 2), b = iso(N - 2, 2), d = iso(N - 2, N - 2), e = iso(2, N - 2);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.closePath(); g.stroke();
    g.strokeStyle = '#e8e0c066'; g.setLineDash([14, 14]);
    for (const [dir, i] of L.roads) { const p = dir === 'h' ? iso(0, i + 1) : iso(i + 1, 0), q = dir === 'h' ? iso(N, i + 1) : iso(i + 1, N); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
    g.setLineDash([]);
  }
  L.gc = c;
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

// ---------- частицы ----------
function burst(x, y, h, c, n, sp = 1.6, up = 50) {
  for (let i = 0; i < n; i++) loc.fx.push({k: 'p', x, y, h: h + rnd(-4, 4), vx: rnd(-sp, sp), vy: rnd(-sp, sp), vh: rnd(up * .4, up), c, s: rnd(1.5, 3), t: 0, T: rnd(.35, .7)});
}
function floatText(x, y, h, s, c, big) { loc.txt.push({x, y, h, s, c, big, t: 0}); }

// ---------- время суток ----------
// 0 — день, 1 — глубокая ночь
function darkness() {
  const c = G.clock;
  if (c >= 7 && c < 18) return 0;
  if (c >= 18 && c < 21) return (c - 18) / 3;
  if (c >= 21 || c < 4) return 1;
  return 1 - (c - 4) / 3;
}
const clockStr = () => { const h = Math.floor(G.clock), m = Math.floor((G.clock - h) * 60); return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`; };
