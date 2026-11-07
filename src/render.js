'use strict';
// ---------- Отрисовка карты (Canvas 2D) ----------

const FX = {
  list: [],
  add(o) { o.t0 = performance.now(); this.list.push(o); R.dirty = true; },
  text(x, y, s, col) { this.add({ k: 'text', x, y, s, col, d: 1150 }); },
  ring(x, y, r) { this.add({ k: 'ring', x, y, r, d: 800 }); },
  tracer(x0, y0, x1, y1) { this.add({ k: 'tr', x0, y0, x1, y1, d: 170 }); },
  arc(x0, y0, x1, y1) { this.add({ k: 'arc', x0, y0, x1, y1, d: Math.max(1, spd(380)) }); },
};
function animTo(e, x, y, ms) {
  const fx = e.x, fy = e.y;
  e.x = x; e.y = y;
  if (x !== fx || y !== fy) { e.f = dirIdx(x - fx, y - fy); e.step = (e.step || 0) + 1; }
  if (!(ms > 0)) { e.anim = null; R.dirty = true; return Promise.resolve(); }
  e.anim = { k: 'mv', fx, fy, t0: performance.now(), d: ms };
  R.moving.add(e);
  return sleep(ms);
}
function lunge(e, tx, ty) {
  if (tx !== e.x || ty !== e.y) e.f = dirIdx(tx - e.x, ty - e.y);
  const ms = spd(150);
  if (!(ms > 0)) return Promise.resolve();
  e.anim = { k: 'lg', dx: tx - e.x, dy: ty - e.y, t0: performance.now(), d: ms };
  R.moving.add(e);
  return sleep(ms);
}
function animPos(e, now) {
  const a = e.anim;
  if (!a) return [e.x, e.y];
  let p = (now - a.t0) / a.d;
  if (p >= 1) { e.anim = null; R.moving.delete(e); return [e.x, e.y]; }
  if (a.k === 'mv') { p = p * (2 - p); return [a.fx + (e.x - a.fx) * p, a.fy + (e.y - a.fy) * p]; }
  const o = Math.sin(Math.PI * p) * 0.35;
  return [e.x + a.dx * o, e.y + a.dy * o];
}

// ----- Палитра -----
const GC = {
  [T.GRASS]: ['#3b4a2b', '#3f4e2d', '#37462a', '#425230'],
  [T.DIRT]: ['#5c4b34', '#594832', '#614f37', '#56462f'],
  [T.ASPHALT]: ['#3a3936', '#383734', '#3d3c39', '#363532'],
  [T.CONCRETE]: ['#605e57', '#5c5a53', '#636159', '#5e5c55'],
  [T.WOOD]: ['#6b4f33', '#674b30', '#6f5236', '#634830'],
  [T.TILE]: ['#7b7f79', '#787c76', '#7e827c', '#757973'],
  [T.SIDEWALK]: ['#686761', '#64635d', '#6c6b65', '#61605a'],
  [T.WATER]: ['#2a3940', '#2c3c44', '#283640', '#2e3e46'],
  [T.RUBBLE]: ['#57534a', '#5a564c', '#535047', '#5d594f'],
};
const WALLC = {
  [T.WALL]: ['#8f8c82', '#56544d', '#a6a397'],
  [T.BRICK]: ['#8a5340', '#5a3326', '#a06651'],
  [T.WWALL]: ['#a27b4d', '#5a3d22', '#bb9361'],
  [T.WINDOW]: ['#8f8c82', '#56544d', '#a6a397'],
};
const MAPRGB = [];
for (let i = 0; i < TP.length; i++) if (TP[i]) { const h = TP[i].map; MAPRGB[i] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => clamp(Math.round(((n >> s) & 255) * f), 0, 255).toString(16).padStart(2, '0');
  return '#' + ch(16) + ch(8) + ch(0);
}
const isWallAt = (m, x, y) => inb(m, x, y) && TP[m.tiles[MI(m, x, y)]].wall;
const reducedMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

// ----- Рендер -----
const R = {
  cv: null, c: null, dpr: 1, W: 1, H: 1,
  cam: { x: 0, y: 0, ts: 36 }, dirty: true, mode: null, moving: new Set(),
  camAnim: null, shakeA: 0, shakeT: 0, menu: null, until: 0, lastIdle: 0, hits: [],

  init(cv) {
    this.cv = cv; this.c = cv.getContext('2d', { alpha: false });
    this.resize();
    const loop = () => { requestAnimationFrame(loop); this.tick(); };
    requestAnimationFrame(loop);
  },
  resize() {
    if (!this.cv) return;
    const W = this.cv.clientWidth || 1, H = this.cv.clientHeight || 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, CFG.hq ? 2.5 : 1.25);
    this.W = W; this.H = H;
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.clampCam();
    this.dirty = true;
  },
  minTs() { const m = TAC.m; return m ? Math.max(5, Math.min(this.W / (m.w + 2), this.H / (m.h + 2))) : 8; },
  clampCam() {
    const m = TAC.m;
    if (!m) return;
    const ts = this.cam.ts = clamp(this.cam.ts, this.minTs(), 84);
    const vw = this.W / ts, vh = this.H / ts, pad = 3;
    this.cam.x = vw >= m.w + pad * 2 ? (m.w - vw) / 2 : clamp(this.cam.x, -pad, m.w + pad - vw);
    this.cam.y = vh >= m.h + pad * 2 ? (m.h - vh) / 2 : clamp(this.cam.y, -pad, m.h + pad - vh);
  },
  centerOn(x, y, instant) {
    const from = { x: this.cam.x, y: this.cam.y };
    this.cam.x = x + 0.5 - this.W / this.cam.ts / 2;
    this.cam.y = y + 0.5 - this.H / this.cam.ts / 2;
    this.clampCam();
    if (!instant && CFG.speed < 3 && !reducedMotion) {
      this.camAnim = { fx: from.x, fy: from.y, tx: this.cam.x, ty: this.cam.y, t0: performance.now(), d: 280 };
      this.cam.x = from.x; this.cam.y = from.y;
    }
    this.dirty = true;
  },
  ensureVisible(x, y) {
    const ts = this.cam.ts, sx = (x + 0.5 - this.cam.x) * ts, sy = (y + 0.5 - this.cam.y) * ts;
    const mx = Math.min(150, this.W * 0.22), my = Math.min(70, this.H * 0.18);
    if (sx < mx || sx > this.W - mx || sy < my || sy > this.H - my) this.centerOn(x, y);
  },
  zoomAt(sx, sy, f) {
    const wx = this.cam.x + sx / this.cam.ts, wy = this.cam.y + sy / this.cam.ts;
    this.cam.ts = clamp(this.cam.ts * f, this.minTs(), 84);
    this.cam.x = wx - sx / this.cam.ts; this.cam.y = wy - sy / this.cam.ts;
    this.camAnim = null;
    this.clampCam();
    this.dirty = true;
  },
  shake(a) {
    if (!CFG.shake || reducedMotion) return;
    this.shakeA = Math.max(this.shakeA, a); this.shakeT = performance.now(); this.dirty = true;
  },
  toTile(sx, sy) { return { x: Math.floor(this.cam.x + sx / this.cam.ts), y: Math.floor(this.cam.y + sy / this.cam.ts) }; },
  tick() {
    if (!this.mode) return;
    const now = performance.now();
    if (CFG.hq && now - this.lastIdle > 320) { this.lastIdle = now; this.dirty = true; }
    const active = this.moving.size || FX.list.length || this.camAnim || this.shakeA > 0 || this.until > now;
    if (!this.dirty && !active) return;
    this.dirty = false;
    try { this.draw(performance.now()); } catch (e) { console.error(e); }
  },
  draw(now) {
    const c = this.c;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#0b0a08';
    c.fillRect(0, 0, this.W, this.H);
    if (this.mode === 'tac' && TAC.m) {
      if (this.camAnim) {
        const a = this.camAnim, p = Math.min(1, (now - a.t0) / a.d), e = 1 - (1 - p) ** 3;
        this.cam.x = a.fx + (a.tx - a.fx) * e; this.cam.y = a.fy + (a.ty - a.fy) * e;
        if (p >= 1) this.camAnim = null;
      }
      let ox = 0, oy = 0;
      if (this.shakeA > 0) {
        const p = (now - this.shakeT) / 220;
        if (p >= 1) this.shakeA = 0;
        else { const a = this.shakeA * (1 - p); ox = (Math.random() * 2 - 1) * a; oy = (Math.random() * 2 - 1) * a; }
      }
      c.translate(ox, oy);
      drawMap(c, TAC.m, this.cam, this.W, this.H, now, false);
    } else if (this.mode === 'menu' && this.menu) {
      drawMap(c, this.menu.m, this.menu.cam, this.W, this.H, now, true);
      const g = c.createLinearGradient(0, 0, this.W, 0);
      g.addColorStop(0, 'rgba(11,10,8,0.94)'); g.addColorStop(0.55, 'rgba(11,10,8,0.7)'); g.addColorStop(1, 'rgba(11,10,8,0.35)');
      c.fillStyle = g; c.fillRect(0, 0, this.W, this.H);
      if (this.W >= 600) drawLineup(c, this.W, this.H, now);
    }
  },
  // Фигура под пальцем (тело может заходить на соседнюю клетку)
  pick(ax, ay, onlyZ) {
    for (let k = this.hits.length - 1; k >= 0; k--) {
      const h = this.hits[k];
      if (onlyZ && !h.z) continue;
      if (ax >= h.x0 && ax <= h.x1 && ay >= h.y0 && ay <= h.y1) return h.e;
    }
    return null;
  },
  setMenuMap() {
    const { m } = genMap('factory', 9137);
    m.seen = new Uint8Array(m.n).fill(1); m.vis = new Uint8Array(m.n).fill(1);
    m.units = []; m.zombies = []; m.turn = 1;
    const ts = Math.max(14, Math.min(24, this.H / 26));
    this.menu = { m, cam: { x: 18 - this.W / ts / 2 + 6, y: 14 - this.H / ts / 2 + 6, ts } };
    this.dirty = true;
  },
};

// ----- Карта -----
function drawMap(c, m, cam, W, H, now, all) {
  const ts = cam.ts;
  if (ts >= 11) return drawMap3(c, m, cam, W, H, now, all);
  const x0 = Math.max(0, Math.floor(cam.x)), y0 = Math.max(0, Math.floor(cam.y));
  const x1 = Math.min(m.w - 1, Math.ceil(cam.x + W / ts)), y1 = Math.min(m.h - 1, Math.ceil(cam.y + H / ts));
  const lod = 0;
  const SX = x => Math.round((x - cam.x) * ts), SY = y => Math.round((y - cam.y) * ts);
  const seen = i => all || m.seen[i], vis = i => all || m.vis[i];

  // 1. тайлы
  for (let y = y0; y <= y1; y++) {
    const Y = SY(y), h = SY(y + 1) - Y;
    for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x;
      if (!seen(i)) continue;
      const X = SX(x), w = SX(x + 1) - X;
      drawTile(c, m, x, y, i, X, Y, w, h, lod);
    }
  }
  // 2. следы
  for (const d of m.decals) {
    const i = MI(m, d.x, d.y);
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1 || !seen(i)) continue;
    const X = SX(d.x) + ts / 2, Y = SY(d.y) + ts / 2;
    c.fillStyle = 'rgba(70,20,14,0.55)';
    c.beginPath(); c.ellipse(X + (d.r - 0.5) * ts * 0.3, Y + ts * 0.08, ts * 0.42, ts * 0.26, d.r * 3, 0, Math.PI * 2); c.fill();
    if (d.k === 'corpse') { c.fillStyle = '#3e4433'; c.beginPath(); c.ellipse(X, Y, ts * 0.3, ts * 0.18, d.r * 6, 0, Math.PI * 2); c.fill(); }
  }
  // 3. крупные объекты
  for (const p of m.props) {
    if (p.x + p.w < x0 || p.x > x1 + 1 || p.y + p.h < y0 || p.y > y1 + 1) continue;
    let any = all;
    for (let yy = p.y; yy < p.y + p.h && !any; yy++) for (let xx = p.x; xx < p.x + p.w; xx++) if (m.seen[MI(m, xx, yy)]) { any = true; break; }
    if (any) drawProp(c, p, SX(p.x), SY(p.y), SX(p.x + p.w) - SX(p.x), SY(p.y + p.h) - SY(p.y), ts, lod);
  }
  // 4. кроны деревьев
  if (lod > 0) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * m.w + x;
    if (m.tiles[i] !== T.TREE || !seen(i)) continue;
    const X = SX(x) + ts / 2, Y = SY(y) + ts / 2, hv = hash2(x, y, 9);
    c.fillStyle = 'rgba(0,0,0,0.3)'; circ(c, X + ts * 0.12, Y + ts * 0.16, ts * 0.6); c.fill();
    c.fillStyle = hv < 0.5 ? '#22341b' : '#2a3a1e'; circ(c, X, Y, ts * (0.56 + hv * 0.12)); c.fill();
    c.fillStyle = hv < 0.5 ? '#304a24' : '#3a4d27'; circ(c, X - ts * 0.14, Y - ts * 0.14, ts * 0.3); c.fill();
  }
  // 5. метки контейнеров
  for (const k in m.cont) {
    const i = +k, x = i % m.w, y = (i / m.w) | 0;
    if (x < x0 || x > x1 || y < y0 || y > y1 || !seen(i)) continue;
    const ct = m.cont[k], has = Object.keys(ct.loot).length > 0;
    if (ct.s && !has) continue;
    const X = SX(x) + ts * 0.8, Y = SY(y) + ts * 0.2, s = Math.max(2.5, ts * 0.11);
    c.beginPath(); c.moveTo(X, Y - s); c.lineTo(X + s, Y); c.lineTo(X, Y + s); c.lineTo(X - s, Y); c.closePath();
    if (!ct.s) { c.fillStyle = '#e8a62b'; c.fill(); c.strokeStyle = '#1b1406'; c.lineWidth = 1; c.stroke(); }
    else { c.strokeStyle = '#e8a62b'; c.lineWidth = 1.5; c.stroke(); }
  }
  // 7. туман
  if (!all) for (let y = y0; y <= y1; y++) {
    const Y = SY(y), h = SY(y + 1) - Y;
    for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x;
      if (m.vis[i]) continue;
      const X = SX(x), w = SX(x + 1) - X;
      c.fillStyle = m.seen[i] ? 'rgba(9,8,6,0.6)' : '#0b0a08';
      c.fillRect(X, Y, w, h);
    }
  }
  // 8. сумерки и ночь
  const tod = all ? 0 : timeOfDay(m);
  if (tod) { c.fillStyle = tod === 1 ? 'rgba(40,24,60,0.16)' : 'rgba(8,14,44,0.32)'; c.fillRect(-10, -10, W + 20, H + 20); }
  if (all) return;

  drawGroundMarks(c, m, cam, ts, x0, x1, y0, y1, SX, SY);
  const pd = TAC.pend;
  // 10. существа: 2.5D-фигуры, отсортированные по глубине
  const ents = [];
  for (const z of m.zombies) {
    if (!m.vis[MI(m, z.x, z.y)] && !(z.anim && z.anim.k === 'mv' && m.vis[MI(m, Math.round(z.anim.fx), Math.round(z.anim.fy))])) continue;
    const [px, py] = animPos(z, now);
    if (px < x0 - 2 || px > x1 + 1 || py < y0 - 1 || py > y1 + 2) continue;
    ents.push({ e: z, z: true, px, py });
  }
  for (const un of m.units) {
    if (un.dead || un.evac) continue;
    const [px, py] = animPos(un, now);
    ents.push({ e: un, z: false, px, py });
  }
  ents.sort((a, b) => a.py - b.py || a.px - b.px);
  R.hits = [];
  if (lod === 0) {
    for (const it of ents) {
      if (it.z) drawZombie(c, it.e, (it.px - cam.x) * ts, (it.py - cam.y) * ts, ts, lod);
      else drawUnit(c, it.e, (it.px - cam.x) * ts, (it.py - cam.y) * ts, ts, it.e.id === TAC.sel, lod);
    }
  } else {
    const tgt = pd && pd.tx != null ? MI(m, pd.tx, pd.ty) : -1;
    for (const it of ents) {
      it.cx = (it.px + 0.5 - cam.x) * ts; it.fy = (it.py + 0.74 - cam.y) * ts;
      const big = it.z && it.e.type === 'brute' ? 1.3 : 1;
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath(); c.ellipse(it.cx + ts * 0.07, it.fy + ts * 0.02, ts * 0.3 * big, ts * 0.12 * big, 0, 0, Math.PI * 2); c.fill();
      if (!it.z) {
        const sel = it.e.id === TAC.sel;
        c.strokeStyle = sel ? '#e8a62b' : it.e.color; c.globalAlpha = sel ? 1 : 0.55;
        c.lineWidth = Math.max(sel ? 2 : 1.5, ts * (sel ? 0.055 : 0.035));
        c.beginPath(); c.ellipse(it.cx, it.fy, ts * 0.4, ts * 0.17, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
      } else if (MI(m, it.e.x, it.e.y) === tgt) {
        c.strokeStyle = '#ff6a50'; c.lineWidth = Math.max(2, ts * 0.05);
        c.beginPath(); c.ellipse(it.cx, it.fy, ts * 0.42 * big, ts * 0.18 * big, 0, 0, Math.PI * 2); c.stroke();
      }
    }
    for (const it of ents) {
      const L = Spr.look(it.e, it.z ? 'z' : 'h');
      it.top = Spr.draw(c, L, frameOf(it.e, now), it.e.f ?? 2, it.cx, it.fy, ts);
      R.hits.push({ e: it.e, z: it.z, x0: it.cx - ts * 0.34, x1: it.cx + ts * 0.34, y0: it.top, y1: it.fy + ts * 0.1 });
    }
    for (const it of ents) drawBadges(c, it, ts, lod);
  }
  drawFX(c, cam, ts, now);
}

function drawTile(c, m, x, y, i, X, Y, w, h, lod) {
  const t = m.tiles[i], g = m.ground[i];
  if (lod === 0) {
    const rgb = MAPRGB[TP[t].floor ? g : t];
    c.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    c.fillRect(X, Y, w, h);
    return;
  }
  const tp = TP[t];
  if (tp.wall) {
    const [top, face, hl] = WALLC[t] || WALLC[T.WALL];
    c.fillStyle = top; c.fillRect(X, Y, w, h);
    if (!isWallAt(m, x, y + 1)) {
      const fh = Math.round(h * 0.38);
      c.fillStyle = face; c.fillRect(X, Y + h - fh, w, fh);
      if (lod === 2) {
        c.fillStyle = 'rgba(0,0,0,0.22)';
        if (t === T.BRICK) { c.fillRect(X, Y + h - fh / 2, w, 1); c.fillRect(X + ((x & 1) ? w * 0.5 : w * 0.2), Y + h - fh, 1, fh / 2); }
        else if (t === T.WWALL) { c.fillRect(X + w * 0.33, Y + h - fh, 1, fh); c.fillRect(X + w * 0.66, Y + h - fh, 1, fh); }
      }
    }
    if (lod === 2 && !isWallAt(m, x, y - 1)) { c.fillStyle = hl; c.fillRect(X, Y, w, Math.max(1, Math.round(h * 0.08))); }
    if (t === T.WINDOW) {
      const hz = isWallAt(m, x - 1, y) || isWallAt(m, x + 1, y);
      c.fillStyle = '#86a7bb';
      if (hz) c.fillRect(X, Y + h * 0.36, w, h * 0.2); else c.fillRect(X + w * 0.4, Y, w * 0.2, h);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      if (hz) c.fillRect(X + w * 0.15, Y + h * 0.38, w * 0.3, Math.max(1, h * 0.05)); else c.fillRect(X + w * 0.42, Y + h * 0.15, Math.max(1, w * 0.05), h * 0.3);
    }
    return;
  }
  drawGround(c, m, g, x, y, i, X, Y, w, h, lod);
  if (tp.floor) return;
  const cx = X + w / 2, cy = Y + h / 2;
  switch (t) {
    case T.FENCE: {
      const md = m.meta[i];
      const rail = md === 1 ? '#8d9296' : md === 2 ? '#bdb6a2' : '#6e5232', post = md === 1 ? '#5c6166' : md === 2 ? '#9a937f' : '#4b3720';
      const th = Math.max(1.5, h * (md === 1 ? 0.07 : 0.14)), ps = Math.max(2, w * 0.22);
      const n = (dx, dy) => { const nx = x + dx, ny = y + dy; if (!inb(m, nx, ny)) return false; const tt = m.tiles[MI(m, nx, ny)]; return tt === T.FENCE || TP[tt].wall; };
      c.fillStyle = rail;
      let any = false;
      if (n(-1, 0)) { c.fillRect(X, cy - th / 2, w / 2, th); any = true; }
      if (n(1, 0)) { c.fillRect(cx, cy - th / 2, w / 2, th); any = true; }
      if (n(0, -1)) { c.fillRect(cx - th / 2, Y, th, h / 2); any = true; }
      if (n(0, 1)) { c.fillRect(cx - th / 2, cy, th, h / 2); any = true; }
      if (!any) c.fillRect(X + w * 0.1, cy - th / 2, w * 0.8, th);
      c.fillStyle = post; c.fillRect(cx - ps / 2, cy - ps / 2, ps, ps);
      break;
    }
    case T.DOOR: case T.DOOR_OPEN: case T.DOOR_BROKEN: {
      const hz = isWallAt(m, x - 1, y) || isWallAt(m, x + 1, y);
      const metal = m.meta[i] & 1, col = metal ? '#737a7f' : '#8b5d2e', dk = metal ? '#454b50' : '#553718';
      c.fillStyle = dk;
      if (hz) { c.fillRect(X, Y + h * 0.36, w * 0.1, h * 0.28); c.fillRect(X + w * 0.9, Y + h * 0.36, w * 0.1, h * 0.28); }
      else { c.fillRect(X + w * 0.36, Y, w * 0.28, h * 0.1); c.fillRect(X + w * 0.36, Y + h * 0.9, w * 0.28, h * 0.1); }
      if (t === T.DOOR) {
        c.fillStyle = col;
        if (hz) c.fillRect(X + w * 0.08, Y + h * 0.39, w * 0.84, h * 0.22); else c.fillRect(X + w * 0.39, Y + h * 0.08, w * 0.22, h * 0.84);
        if (lod === 2) { c.fillStyle = '#d8c48a'; if (hz) c.fillRect(X + w * 0.72, Y + h * 0.47, Math.max(1.5, w * 0.06), Math.max(1.5, h * 0.06)); else c.fillRect(X + w * 0.47, Y + h * 0.72, Math.max(1.5, w * 0.06), Math.max(1.5, h * 0.06)); }
      } else if (t === T.DOOR_OPEN) {
        c.fillStyle = col;
        if (hz) c.fillRect(X + w * 0.08, Y + h * 0.42, w * 0.13, h * 0.58); else c.fillRect(X + w * 0.42, Y + h * 0.08, w * 0.58, h * 0.13);
      } else {
        c.fillStyle = col;
        c.fillRect(X + w * 0.12, Y + h * 0.5, w * 0.24, h * 0.09); c.fillRect(X + w * 0.6, Y + h * 0.4, w * 0.26, h * 0.08); c.fillRect(X + w * 0.4, Y + h * 0.66, w * 0.16, h * 0.07);
      }
      break;
    }
    case T.CROP: {
      const corn = m.meta[i] === 1, dk = corn ? '#4b6a2a' : '#9c8638', lt = corn ? '#6f8f3a' : '#c8ae55';
      for (let k = 0; k < 3; k++) {
        const sx = X + w * (0.08 + k * 0.32);
        c.fillStyle = dk; c.fillRect(sx, Y + h * 0.04, w * 0.22, h * 0.92);
        c.fillStyle = lt; c.fillRect(sx + w * 0.05, Y + h * (0.08 + hash2(x + k, y, 6) * 0.5), w * 0.12, h * 0.26);
      }
      break;
    }
    case T.BUSH:
      c.fillStyle = '#2a3c21'; circ(c, cx, cy, w * 0.44); c.fill();
      c.fillStyle = '#3c532d'; circ(c, cx - w * 0.12, cy - h * 0.12, w * 0.2); c.fill();
      break;
    case T.TREE:
      c.fillStyle = '#3a2a1a'; circ(c, cx, cy, w * 0.12); c.fill();
      break;
    case T.HAY:
      rr(c, X + w * 0.06, Y + h * 0.1, w * 0.88, h * 0.8, w * 0.15); c.fillStyle = '#b59c55'; c.fill();
      c.fillStyle = '#8c773c'; c.fillRect(X + w * 0.06, Y + h * 0.36, w * 0.88, Math.max(1, h * 0.05)); c.fillRect(X + w * 0.06, Y + h * 0.62, w * 0.88, Math.max(1, h * 0.05));
      break;
    case T.CRATE:
      c.fillStyle = '#4e3820'; c.fillRect(X + w * 0.1, Y + h * 0.1, w * 0.8, h * 0.8);
      c.fillStyle = '#7d5c35'; c.fillRect(X + w * 0.14, Y + h * 0.14, w * 0.72, h * 0.72);
      if (lod === 2) { c.strokeStyle = '#4e3820'; c.lineWidth = Math.max(1, w * 0.06); c.beginPath(); c.moveTo(X + w * 0.16, Y + h * 0.16); c.lineTo(X + w * 0.84, Y + h * 0.84); c.moveTo(X + w * 0.84, Y + h * 0.16); c.lineTo(X + w * 0.16, Y + h * 0.84); c.stroke(); }
      break;
    case T.SHELF:
      c.fillStyle = '#4a4e52'; c.fillRect(X + w * 0.06, Y + h * 0.18, w * 0.88, h * 0.64);
      c.fillStyle = '#62676b'; c.fillRect(X + w * 0.1, Y + h * 0.22, w * 0.8, h * 0.56);
      if (m.cont[i] && Object.keys(m.cont[i].loot).length && lod === 2) { c.fillStyle = '#a8794a'; c.fillRect(X + w * 0.16, Y + h * 0.3, w * 0.2, h * 0.2); c.fillStyle = '#7a8f5a'; c.fillRect(X + w * 0.5, Y + h * 0.48, w * 0.24, h * 0.22); }
      break;
    case T.LOCKER:
      c.fillStyle = '#3c4955'; c.fillRect(X + w * 0.14, Y + h * 0.08, w * 0.72, h * 0.84);
      c.fillStyle = '#566878'; c.fillRect(X + w * 0.18, Y + h * 0.12, w * 0.64, h * 0.76);
      c.fillStyle = '#3c4955'; c.fillRect(cx - 0.5, Y + h * 0.12, 1, h * 0.76);
      break;
    case T.FRIDGE:
      c.fillStyle = '#9a988e'; c.fillRect(X + w * 0.14, Y + h * 0.08, w * 0.72, h * 0.84);
      c.fillStyle = '#d6d4c8'; c.fillRect(X + w * 0.18, Y + h * 0.12, w * 0.64, h * 0.76);
      c.fillStyle = '#8a887e'; c.fillRect(X + w * 0.66, Y + h * 0.3, Math.max(1, w * 0.06), h * 0.24);
      break;
    case T.DESK:
      c.fillStyle = '#4f3a22'; c.fillRect(X + w * 0.06, Y + h * 0.16, w * 0.88, h * 0.68);
      c.fillStyle = '#7f6040'; c.fillRect(X + w * 0.1, Y + h * 0.2, w * 0.8, h * 0.6);
      if (lod === 2) { c.fillStyle = '#d8d2c0'; c.fillRect(X + w * 0.2, Y + h * 0.3, w * 0.25, h * 0.2); }
      break;
    case T.DRUM:
      c.fillStyle = '#5c2a1c'; circ(c, cx, cy, w * 0.38); c.fill();
      c.fillStyle = '#9b4a2f'; circ(c, cx, cy, w * 0.32); c.fill();
      c.strokeStyle = '#5c2a1c'; c.lineWidth = Math.max(1, w * 0.05); circ(c, cx, cy, w * 0.18); c.stroke();
      break;
    case T.WELL:
      c.fillStyle = '#7d7a70'; circ(c, cx, cy, w * 0.44); c.fill();
      c.fillStyle = '#1b262b'; circ(c, cx, cy, w * 0.27); c.fill();
      break;
    case T.MEDCAB:
      c.fillStyle = '#a19e93'; c.fillRect(X + w * 0.12, Y + h * 0.14, w * 0.76, h * 0.72);
      c.fillStyle = '#e2ded2'; c.fillRect(X + w * 0.16, Y + h * 0.18, w * 0.68, h * 0.64);
      c.fillStyle = '#c4402f'; c.fillRect(cx - w * 0.06, cy - h * 0.2, w * 0.12, h * 0.4); c.fillRect(cx - w * 0.2, cy - h * 0.06, w * 0.4, h * 0.12);
      break;
    case T.BENCH:
      c.fillStyle = '#3e3b33'; c.fillRect(X + w * 0.05, Y + h * 0.18, w * 0.9, h * 0.64);
      c.fillStyle = '#6f6a5c'; c.fillRect(X + w * 0.09, Y + h * 0.22, w * 0.82, h * 0.56);
      if (lod === 2) { c.fillStyle = '#b9b19a'; c.fillRect(X + w * 0.2, Y + h * 0.35, w * 0.35, h * 0.08); c.fillStyle = '#c4402f'; c.fillRect(X + w * 0.62, Y + h * 0.3, w * 0.14, h * 0.3); }
      break;
    case T.FURN: {
      const v = m.meta[i];
      if (v === 0) { c.fillStyle = '#4c4f5a'; c.fillRect(X + w * 0.1, Y + h * 0.04, w * 0.8, h * 0.92); c.fillStyle = '#c9c3b2'; c.fillRect(X + w * 0.16, Y + h * 0.08, w * 0.68, h * 0.24); }
      else if (v === 1) { c.fillStyle = '#5a4128'; circ(c, cx, cy, w * 0.4); c.fill(); c.fillStyle = '#7a5b3a'; circ(c, cx, cy, w * 0.34); c.fill(); }
      else if (v === 2) { c.fillStyle = '#4a3a52'; c.fillRect(X + w * 0.06, Y + h * 0.2, w * 0.88, h * 0.6); c.fillStyle = '#6b5878'; c.fillRect(X + w * 0.12, Y + h * 0.36, w * 0.76, h * 0.4); }
      else { c.fillStyle = '#5a4128'; c.fillRect(X + w * 0.06, Y + h * 0.36, w * 0.88, h * 0.28); }
      break;
    }
  }
  const ct = m.cont[i];
  if (ct && ct.s && !Object.keys(ct.loot).length && tp.furn) { c.fillStyle = 'rgba(0,0,0,0.32)'; c.fillRect(X + w * 0.06, Y + h * 0.06, w * 0.88, h * 0.88); }
}

function drawGround(c, m, g, x, y, i, X, Y, w, h, lod) {
  const pal = GC[g] || GC[T.DIRT];
  c.fillStyle = pal[(hash2(x, y, 1) * 4) | 0];
  c.fillRect(X, Y, w, h);
  const md = m.meta[i], t = m.tiles[i];
  const road = TP[t].floor || t === T.BLOCK;
  if (road && g === T.ASPHALT) {
    c.fillStyle = 'rgba(214,180,80,0.65)';
    if (md & 2 && y % 3) c.fillRect(X + w * 0.45, Y + h * 0.15, Math.max(1, w * 0.1), h * 0.7);
    if (md & 4 && x % 3) c.fillRect(X + w * 0.15, Y + h * 0.45, w * 0.7, Math.max(1, h * 0.1));
    if (md & 8) { c.fillStyle = 'rgba(220,220,210,0.5)'; c.fillRect(X, Y, Math.max(1, w * 0.07), h); }
  } else if (road && g === T.DIRT && md & 6) {
    c.fillStyle = 'rgba(40,30,18,0.35)';
    if (md & 2) c.fillRect(X + w * 0.38, Y, w * 0.24, h);
    if (md & 4) c.fillRect(X, Y + h * 0.38, w, h * 0.24);
  }
  if (lod < 2) return;
  const a = hash2(x, y, 2), b = hash2(x, y, 3);
  switch (g) {
    case T.GRASS:
      c.fillStyle = 'rgba(130,160,80,0.22)'; c.fillRect(X + w * a * 0.8, Y + h * b * 0.8, Math.max(1, w * 0.06), h * 0.18);
      c.fillStyle = 'rgba(15,25,8,0.25)'; c.fillRect(X + w * b * 0.8, Y + h * a * 0.8, Math.max(1, w * 0.06), h * 0.14);
      break;
    case T.DIRT:
      c.fillStyle = 'rgba(30,22,12,0.3)'; c.fillRect(X + w * a * 0.85, Y + h * b * 0.85, w * 0.08, h * 0.08);
      c.fillStyle = 'rgba(160,130,90,0.18)'; c.fillRect(X + w * b * 0.85, Y + h * a * 0.85, w * 0.06, h * 0.06);
      break;
    case T.ASPHALT:
      if (a > 0.86) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X + w * b, Y); c.lineTo(X + w * a * 0.6, Y + h * 0.5); c.lineTo(X + w * b * 0.9, Y + h); c.stroke(); }
      break;
    case T.CONCRETE: case T.SIDEWALK:
      c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(X, Y, w, 1); c.fillRect(X, Y, 1, h);
      if (a > 0.9) { c.fillStyle = 'rgba(60,40,20,0.2)'; circ(c, X + w * b, Y + h * a * 0.8, w * 0.2); c.fill(); }
      break;
    case T.WOOD:
      c.fillStyle = 'rgba(0,0,0,0.16)';
      c.fillRect(X, Y + Math.round(h / 3), w, 1); c.fillRect(X, Y + Math.round(h * 2 / 3), w, 1);
      c.fillRect(X + Math.round(w * a), Y, 1, h / 3);
      break;
    case T.TILE:
      if ((x + y) & 1) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(X, Y, w, h); }
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(X, Y, w, 1); c.fillRect(X, Y, 1, h);
      break;
    case T.WATER:
      c.fillStyle = 'rgba(170,200,210,0.14)'; c.fillRect(X + w * a * 0.5, Y + h * b * 0.8, w * 0.4, Math.max(1, h * 0.05));
      break;
    case T.RUBBLE:
      c.fillStyle = '#77726a'; c.fillRect(X + w * a * 0.7, Y + h * b * 0.7, w * 0.25, h * 0.2);
      c.fillStyle = '#46423b'; c.fillRect(X + w * b * 0.7, Y + h * a * 0.6, w * 0.2, h * 0.25);
      break;
  }
}

function drawProp(c, p, X, Y, W, H, ts, lod) {
  c.fillStyle = 'rgba(0,0,0,0.32)';
  rr(c, X + ts * 0.14, Y + ts * 0.18, W - ts * 0.14, H - ts * 0.14, ts * 0.25); c.fill();
  const v = p.v, f = p.f;
  switch (p.k) {
    case 'car': case 'ambulance': {
      const body = p.k === 'ambulance' ? '#e2ded2' : p.c;
      rr(c, X + ts * 0.08, Y + ts * 0.08, W - ts * 0.16, H - ts * 0.16, ts * 0.32); c.fillStyle = shade(body.startsWith('#') ? body : '#888888', 0.7); c.fill();
      rr(c, X + ts * 0.12, Y + ts * 0.12, W - ts * 0.24, H - ts * 0.24, ts * 0.28); c.fillStyle = body; c.fill();
      const ins = ts * 0.3;
      if (v) {
        const glassY = f ? Y + H * 0.66 : Y + H * 0.22;
        c.fillStyle = '#7e9fb1'; c.fillRect(X + ins, glassY, W - ins * 2, H * 0.1);
        c.fillStyle = shade(body, 0.82); c.fillRect(X + ins, Y + H * 0.34, W - ins * 2, H * 0.32);
      } else {
        const glassX = f ? X + W * 0.24 : X + W * 0.66;
        c.fillStyle = '#7e9fb1'; c.fillRect(glassX, Y + ins, W * 0.1, H - ins * 2);
        c.fillStyle = shade(body, 0.82); c.fillRect(X + W * 0.34, Y + ins, W * 0.32, H - ins * 2);
      }
      if (p.k === 'ambulance') {
        c.fillStyle = '#c4402f';
        if (v) c.fillRect(X + ts * 0.12, Y + H * 0.5 - ts * 0.06, W - ts * 0.24, ts * 0.12); else c.fillRect(X + W * 0.5 - ts * 0.06, Y + ts * 0.12, ts * 0.12, H - ts * 0.24);
      }
      if (p.start) {
        c.strokeStyle = '#a0c86e'; c.lineWidth = Math.max(1.5, ts * 0.06);
        rr(c, X + ts * 0.04, Y + ts * 0.04, W - ts * 0.08, H - ts * 0.08, ts * 0.34); c.stroke();
        if (lod > 0) {
          c.font = `600 ${clamp(ts * 0.36, 10, 16)}px Oswald, "Arial Narrow", sans-serif`;
          c.textAlign = 'center'; c.textBaseline = 'bottom';
          c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText('ВЫХОД', X + W / 2, Y - ts * 0.08);
          c.fillStyle = '#a0c86e'; c.fillText('ВЫХОД', X + W / 2, Y - ts * 0.08);
        }
      }
      break;
    }
    case 'truck': {
      const cab = v ? H / 3.2 : W / 3.2;
      const cabFirst = !f;
      c.fillStyle = '#6b685e'; rr(c, X + ts * 0.08, Y + ts * 0.08, W - ts * 0.16, H - ts * 0.16, ts * 0.12); c.fill();
      c.fillStyle = '#8a877b';
      if (v) c.fillRect(X + ts * 0.14, cabFirst ? Y + cab + ts * 0.1 : Y + ts * 0.14, W - ts * 0.28, H - cab - ts * 0.24);
      else c.fillRect(cabFirst ? X + cab + ts * 0.1 : X + ts * 0.14, Y + ts * 0.14, W - cab - ts * 0.24, H - ts * 0.28);
      c.fillStyle = p.c;
      if (v) rr(c, X + ts * 0.12, cabFirst ? Y + ts * 0.12 : Y + H - cab, W - ts * 0.24, cab - ts * 0.12, ts * 0.2);
      else rr(c, cabFirst ? X + ts * 0.12 : X + W - cab, Y + ts * 0.12, cab - ts * 0.12, H - ts * 0.24, ts * 0.2);
      c.fill();
      break;
    }
    case 'tractor':
      c.fillStyle = '#1e1c18';
      c.fillRect(X - ts * 0.05, Y + H * 0.55, W * 0.3, H * 0.4); c.fillRect(X + W * 0.75, Y + H * 0.55, W * 0.3, H * 0.4);
      c.fillRect(X + W * 0.05, Y + H * 0.05, W * 0.2, H * 0.25); c.fillRect(X + W * 0.75, Y + H * 0.05, W * 0.2, H * 0.25);
      c.fillStyle = p.c; rr(c, X + W * 0.22, Y + ts * 0.1, W * 0.56, H - ts * 0.2, ts * 0.15); c.fill();
      c.fillStyle = '#8fb0a0'; c.fillRect(X + W * 0.3, Y + H * 0.55, W * 0.4, H * 0.18);
      break;
    case 'machine':
      c.fillStyle = '#2f3233'; c.fillRect(X + ts * 0.06, Y + ts * 0.06, W - ts * 0.12, H - ts * 0.12);
      c.fillStyle = p.c; c.fillRect(X + ts * 0.14, Y + ts * 0.14, W - ts * 0.28, H - ts * 0.28);
      c.fillStyle = '#1c1e1f'; c.fillRect(X + W * 0.55, Y + H * 0.3, W * 0.3, H * 0.4);
      for (let k = 0; k * ts * 0.3 < W - ts * 0.3; k++) { c.fillStyle = k & 1 ? '#1b1a16' : '#d9a62b'; c.fillRect(X + ts * 0.14 + k * ts * 0.3, Y + H - ts * 0.3, ts * 0.3, ts * 0.14); }
      if (p.tall) { c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(X + ts * 0.14, Y + ts * 0.14, W - ts * 0.28, ts * 0.12); }
      break;
    case 'silo':
      c.fillStyle = '#6d6f6a'; circ(c, X + W / 2, Y + H / 2, W * 0.48); c.fill();
      c.fillStyle = '#8b8d88'; circ(c, X + W / 2, Y + H / 2, W * 0.42); c.fill();
      c.strokeStyle = '#6d6f6a'; c.lineWidth = Math.max(1, ts * 0.06);
      circ(c, X + W / 2, Y + H / 2, W * 0.28); c.stroke(); circ(c, X + W / 2, Y + H / 2, W * 0.12); c.stroke();
      break;
    case 'tank':
      rr(c, X + ts * 0.08, Y + ts * 0.15, W - ts * 0.16, H - ts * 0.3, H * 0.4); c.fillStyle = '#a6a397'; c.fill();
      c.fillStyle = '#7b786d';
      for (let k = 1; k < 4; k++) c.fillRect(X + W * k / 4, Y + ts * 0.15, Math.max(1, ts * 0.08), H - ts * 0.3);
      c.fillStyle = '#c4402f'; c.fillRect(X + W * 0.1, Y + H * 0.45, W * 0.12, H * 0.1);
      break;
  }
}

function drawZombie(c, z, X, Y, ts, lod) {
  const t = ZT[z.type], r = ts * t.r, cx = X + ts / 2, cy = Y + ts / 2;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(cx + ts * 0.05, cy + ts * 0.12, r, r * 0.75, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = t.body; circ(c, cx, cy, r); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = Math.max(1, ts * 0.04); c.stroke();
  c.fillStyle = t.skin; circ(c, cx, cy - r * 0.12, r * 0.56); c.fill();
  if (lod > 0) {
    const es = Math.max(1.5, r * 0.15);
    c.fillStyle = z.state === 'chase' ? '#ff5a3c' : '#d6c47c';
    c.fillRect(cx - r * 0.3, cy - r * 0.28, es, es); c.fillRect(cx + r * 0.3 - es, cy - r * 0.28, es, es);
  }
  if (z.type === 'brute' && lod > 0) { c.strokeStyle = '#2d3126'; c.lineWidth = Math.max(1, ts * 0.06); circ(c, cx, cy, r * 0.85); c.stroke(); }
  if (ts >= 14 && (z.state === 'chase' || z.state === 'investigate')) {
    const bx = cx + r * 0.75, by = cy - r * 0.85, br = Math.max(5, ts * 0.17);
    c.fillStyle = z.state === 'chase' ? '#c9472f' : '#b98420'; circ(c, bx, by, br); c.fill();
    c.fillStyle = '#fff3d6'; c.font = `700 ${br * 1.5}px Oswald, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(z.state === 'chase' ? '!' : '?', bx, by + br * 0.08);
  }
  if (z.hp < t.hp) {
    const bw = ts * 0.7, bh = Math.max(2, ts * 0.07), bx = cx - bw / 2, by = Y + ts * 0.02;
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    c.fillStyle = '#c9472f'; c.fillRect(bx, by, bw * Math.max(0, z.hp) / t.hp, bh);
  }
}

function drawUnit(c, u, X, Y, ts, sel, lod) {
  const r = ts * 0.38, cx = X + ts / 2, cy = Y + ts / 2;
  if (sel) { c.strokeStyle = '#e8a62b'; c.lineWidth = Math.max(2, ts * 0.07); circ(c, cx, cy, r + ts * 0.09); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,0.38)'; c.beginPath(); c.ellipse(cx + ts * 0.05, cy + ts * 0.12, r, r * 0.75, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#25221b'; circ(c, cx, cy, r); c.fill();
  c.strokeStyle = u.color; c.lineWidth = Math.max(2, ts * 0.09); circ(c, cx, cy, r - ts * 0.04); c.stroke();
  if (lod > 0) {
    c.fillStyle = u.color; c.font = `600 ${ts * 0.42}px Oswald, "Arial Narrow", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(u.name[0], cx, cy + ts * 0.02);
  }
  const bw = ts * 0.74, bh = Math.max(2, ts * 0.075), bx = cx - bw / 2, by = Y - ts * 0.04;
  c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  const f = u.hp / u.maxhp;
  c.fillStyle = f > 0.6 ? '#86a85d' : f > 0.3 ? '#e8a62b' : '#c9472f';
  c.fillRect(bx, by, bw * Math.max(0, f), bh);
  if (u.bitten) { c.fillStyle = '#a4d03c'; circ(c, cx + r * 0.85, cy - r * 0.6, Math.max(2.5, ts * 0.09)); c.fill(); }
  if (u.ow && lod > 0) {
    const ex = cx - r * 0.95, ey = cy - r * 0.65, s = Math.max(4, ts * 0.13);
    c.fillStyle = '#e8a62b'; c.beginPath(); c.ellipse(ex, ey, s, s * 0.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1b1406'; circ(c, ex, ey, s * 0.35); c.fill();
  }
}

function drawMinimap(cv, m) {
  const k = Math.max(2, Math.floor(Math.min(cv.width / m.w, cv.height / m.h)));
  const c = cv.getContext('2d');
  const img = new ImageData(m.w, m.h);
  for (let i = 0; i < m.n; i++) {
    let r = 11, g = 10, b = 8;
    if (m.seen[i]) {
      const t = m.tiles[i];
      const rgb = MAPRGB[TP[t].floor ? m.ground[i] : t];
      const f = m.vis[i] ? 1 : 0.55;
      r = rgb[0] * f; g = rgb[1] * f; b = rgb[2] * f;
    }
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  const off = document.createElement('canvas');
  off.width = m.w; off.height = m.h;
  off.getContext('2d').putImageData(img, 0, 0);
  c.fillStyle = '#0b0a08'; c.fillRect(0, 0, cv.width, cv.height);
  c.imageSmoothingEnabled = false;
  const ox = Math.floor((cv.width - m.w * k) / 2), oy = Math.floor((cv.height - m.h * k) / 2);
  c.drawImage(off, ox, oy, m.w * k, m.h * k);
  c.fillStyle = 'rgba(160,200,110,0.6)';
  for (const i of m.evac) c.fillRect(ox + (i % m.w) * k, oy + ((i / m.w) | 0) * k, k, k);
  for (const z of m.zombies) if (m.vis[MI(m, z.x, z.y)]) { c.fillStyle = '#ff5a3c'; c.fillRect(ox + z.x * k, oy + z.y * k, k, k); }
  for (const u of m.units) if (!u.dead && !u.evac) { c.fillStyle = u.color; c.fillRect(ox + u.x * k - k / 2, oy + u.y * k - k / 2, k * 2, k * 2); }
  c.strokeStyle = '#ece4cc'; c.lineWidth = 1.5;
  c.strokeRect(ox + R.cam.x * k, oy + R.cam.y * k, R.W / R.cam.ts * k, R.H / R.cam.ts * k);
  return { k, ox, oy };
}

// Полоски здоровья, значки и шеврон над головами
function drawBadges(c, it, ts, lod) {
  const e = it.e, cx = it.cx, top = it.top;
  const maxhp = it.z ? ZT[e.type].hp : e.maxhp, hp = Math.max(0, e.hp);
  const showHp = !it.z || hp < maxhp || (TAC.pend && TAC.pend.tx === e.x && TAC.pend.ty === e.y);
  let y = top - Math.max(5, ts * 0.12);
  if (showHp) {
    const n = Math.ceil(maxhp / 2), fill = Math.ceil(hp / 2);
    const pw = Math.max(2, ts * 0.062), ph = Math.max(3, ts * 0.075), gap = Math.max(1, Math.round(ts * 0.018));
    const W = n * pw + (n - 1) * gap, x0 = cx - W / 2;
    c.fillStyle = 'rgba(10,9,7,0.8)'; c.fillRect(x0 - 2, y - 2, W + 4, ph + 4);
    const f = hp / maxhp, col = it.z ? '#d9553c' : f > 0.6 ? '#9cc96a' : f > 0.3 ? '#e8a62b' : '#d9553c';
    for (let k = 0; k < n; k++) {
      c.fillStyle = k < fill ? col : '#3a3528';
      c.fillRect(x0 + k * (pw + gap), y, pw, ph);
    }
    if (!it.z && e.ow) {
      const ex = x0 - ph * 1.6, ey = y + ph / 2, s = Math.max(3.5, ts * 0.1);
      c.fillStyle = '#e8a62b'; c.beginPath(); c.ellipse(ex, ey, s, s * 0.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1b1406'; circ(c, ex, ey, s * 0.35); c.fill();
    }
    if (!it.z && e.bitten) { c.fillStyle = '#a4d03c'; circ(c, x0 + W + ph * 1.3, y + ph / 2, Math.max(2.5, ts * 0.075)); c.fill(); }
    y -= Math.max(4, ts * 0.06);
  }
  if (!it.z && e.id === TAC.sel) {
    const s = Math.max(5, ts * 0.13);
    c.fillStyle = '#e8a62b'; c.strokeStyle = '#1b1406'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx - s, y - s * 1.1); c.lineTo(cx + s, y - s * 1.1); c.lineTo(cx, y - 1); c.closePath(); c.fill(); c.stroke();
  }
  if (it.z && ts >= 14 && (e.state === 'chase' || e.state === 'investigate')) {
    const br = Math.max(5, ts * 0.15), bx = cx + ts * 0.3, by = top + br * 0.6;
    c.fillStyle = e.state === 'chase' ? '#c9472f' : '#b98420'; circ(c, bx, by, br); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#fff3d6'; c.font = `700 ${br * 1.5}px Oswald, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(e.state === 'chase' ? '!' : '?', bx, by + br * 0.08);
  }
}

// Отряд на фоне главного меню
const DEFAULT_SQUAD = [
  { id: 1, name: 'Марина', g: 'f', trait: 'medic', melee: 'knife', ranged: 'pistol', color: UNIT_COLORS[1] },
  { id: 2, name: 'Гоша', g: 'm', trait: 'strong', melee: 'bat', ranged: null, color: UNIT_COLORS[2] },
  { id: 3, name: 'Лёха', g: 'm', trait: 'marksman', melee: 'crowbar', ranged: 'pistol', color: UNIT_COLORS[0] },
  { id: 4, name: 'Семёныч', g: 'm', trait: 'hunter', melee: 'axe', ranged: 'shotgun', color: UNIT_COLORS[3] },
];
function drawLineup(c, W, H, now) {
  const ppl = (typeof S !== 'undefined' && S && S.survivors && S.survivors.length ? S.survivors : DEFAULT_SQUAD).slice(0, 4);
  const ts = clamp(H * 0.38, 80, 210), dirs = [3, 2, 1, 2];
  const x0 = W - ts * 0.55 * ppl.length - ts * 0.35 - Math.max(16, W * 0.03);
  ppl.forEach((s, i) => {
    const cx = x0 + i * ts * 0.62 + ts * 0.3, fy = H * 0.9 - (i % 2) * ts * 0.12;
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath(); c.ellipse(cx + ts * 0.06, fy, ts * 0.3, ts * 0.11, 0, 0, Math.PI * 2); c.fill();
    Spr.draw(c, Spr.look(s, 'h'), frameOf({ id: s.id }, now), dirs[i], cx, fy, ts, 6);
  });
}

// Разметка на земле: зона эвакуации, доступные клетки, путь, цель
function drawGroundMarks(c, m, cam, ts, x0, x1, y0, y1, SX, SY) {
  const seen = i => m.seen[i];
  // 6. зона эвакуации
  if (m.evac && m.evac.length) {
    const set = new Set(m.evac);
    c.fillStyle = 'rgba(134,168,93,0.16)';
    c.strokeStyle = 'rgba(160,200,110,0.75)'; c.lineWidth = Math.max(1, ts * 0.05);
    c.beginPath();
    for (const i of m.evac) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1 || !seen(i)) continue;
      const X = SX(x), Y = SY(y), w = SX(x + 1) - X, h = SY(y + 1) - Y;
      c.fillRect(X, Y, w, h);
      if (!set.has(i - 1) || x === 0) { c.moveTo(X, Y); c.lineTo(X, Y + h); }
      if (!set.has(i + 1)) { c.moveTo(X + w, Y); c.lineTo(X + w, Y + h); }
      if (!set.has(i - m.w)) { c.moveTo(X, Y); c.lineTo(X + w, Y); }
      if (!set.has(i + m.w)) { c.moveTo(X, Y + h); c.lineTo(X + w, Y + h); }
    }
    c.stroke();
  }
  const u = curUnit(), rf = TAC.reach, pd = TAC.pend;
  if (u && rf && rf.uid === u.id && m.phase === 'player' && !TAC.busy && TAC.mode !== 'lure') {
    c.fillStyle = 'rgba(232,166,43,0.13)';
    c.strokeStyle = 'rgba(232,166,43,0.75)'; c.lineWidth = Math.max(1, ts * 0.035);
    c.beginPath();
    const occ = new Set();
    for (const o of m.units) if (!o.dead && !o.evac) occ.add(MI(m, o.x, o.y));
    for (const z of m.zombies) if (m.vis[MI(m, z.x, z.y)]) occ.add(MI(m, z.x, z.y));
    const ok = j => j >= 0 && j < m.n && (rf.dist[j] >= 0 || !TP[m.tiles[j]].walk || occ.has(j) || !m.seen[j]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x;
      if (rf.dist[i] <= 0 || !m.seen[i]) continue;
      const X = SX(x), Y = SY(y), w = SX(x + 1) - X, h = SY(y + 1) - Y;
      c.fillRect(X, Y, w, h);
      if (x === 0 || !ok(i - 1)) { c.moveTo(X, Y); c.lineTo(X, Y + h); }
      if (x === m.w - 1 || !ok(i + 1)) { c.moveTo(X + w, Y); c.lineTo(X + w, Y + h); }
      if (!ok(i - m.w)) { c.moveTo(X, Y); c.lineTo(X + w, Y); }
      if (!ok(i + m.w)) { c.moveTo(X, Y + h); c.lineTo(X + w, Y + h); }
    }
    c.stroke();
  }
  if (u && TAC.mode === 'lure') {
    c.setLineDash([6, 6]); c.strokeStyle = 'rgba(232,166,43,0.7)'; c.lineWidth = 1.5;
    circ(c, SX(u.x) + ts / 2, SY(u.y) + ts / 2, LURE_RANGE * ts); c.stroke(); c.setLineDash([]);
  }
  if (pd && pd.path && u) {
    c.fillStyle = '#e8a62b';
    for (const i of pd.path) { const x = i % m.w, y = (i / m.w) | 0; circ(c, SX(x) + ts / 2, SY(y) + ts / 2, Math.max(2, ts * 0.08)); c.fill(); }
    const last = pd.path[pd.path.length - 1], lx = last % m.w, ly = (last / m.w) | 0;
    c.strokeStyle = '#e8a62b'; c.lineWidth = Math.max(1.5, ts * 0.06);
    circ(c, SX(lx) + ts / 2, SY(ly) + ts / 2, ts * 0.32); c.stroke();
  }
  if (pd && pd.tx != null) {
    const X = SX(pd.tx), Y = SY(pd.ty), s = ts * 0.28;
    c.strokeStyle = pd.col || '#ff6a50'; c.lineWidth = Math.max(1.5, ts * 0.06);
    c.beginPath();
    c.moveTo(X, Y + s); c.lineTo(X, Y); c.lineTo(X + s, Y);
    c.moveTo(X + ts - s, Y); c.lineTo(X + ts, Y); c.lineTo(X + ts, Y + s);
    c.moveTo(X + ts, Y + ts - s); c.lineTo(X + ts, Y + ts); c.lineTo(X + ts - s, Y + ts);
    c.moveTo(X + s, Y + ts); c.lineTo(X, Y + ts); c.lineTo(X, Y + ts - s);
    c.stroke();
  }
}

// Эффекты: кольца шума, трассеры, бутылки, всплывающий текст
function drawFX(c, cam, ts, now) {
  const keep = [];
  for (const f of FX.list) {
    const p = (now - f.t0) / f.d;
    if (p >= 1) continue;
    keep.push(f);
    if (f.k === 'ring') {
      c.strokeStyle = `rgba(232,166,43,${(1 - p) * 0.55})`; c.lineWidth = 2;
      circ(c, (f.x + 0.5 - cam.x) * ts, (f.y + 0.5 - cam.y) * ts, f.r * ts * (0.15 + 0.85 * p)); c.stroke();
    } else if (f.k === 'tr') {
      const ax = (f.x0 + 0.5 - cam.x) * ts, ay = (f.y0 + 0.5 - cam.y) * ts, bx = (f.x1 + 0.5 - cam.x) * ts, by = (f.y1 + 0.5 - cam.y) * ts;
      c.strokeStyle = `rgba(255,226,150,${1 - p})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.fillStyle = `rgba(255,200,90,${1 - p})`; circ(c, ax, ay, ts * 0.25 * (1 - p)); c.fill();
    } else if (f.k === 'arc') {
      const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p - Math.sin(Math.PI * p) * 2;
      c.fillStyle = '#7fb08a'; circ(c, (x + 0.5 - cam.x) * ts, (y + 0.5 - cam.y) * ts, Math.max(2.5, ts * 0.1)); c.fill();
    } else if (f.k === 'text') {
      const fs = clamp(ts * 0.42, 12, 22);
      c.font = `600 ${fs}px Oswald, "Arial Narrow", sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const X = (f.x + 0.5 - cam.x) * ts, Y = (f.y + (ts >= 11 ? -0.45 : 0.1) - cam.y) * ts - p * ts * 0.9;
      c.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(f.s, X, Y);
      c.fillStyle = f.col; c.fillText(f.s, X, Y);
      c.globalAlpha = 1;
    }
  }
  FX.list = keep;
}
