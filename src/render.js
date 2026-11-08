'use strict';
// ---------- Камера, земля, эффекты и всё, что поверх карты ----------

// ----- эффекты и частицы -----
const FX = {
  list: [], parts: [],
  add(o) { o.t0 = performance.now(); this.list.push(o); R.dirty = true; },
  part(o) { o.t0 = performance.now(); this.parts.push(o); R.dirty = true; },
  text(x, y, s, col) { this.add({ k: 'text', x, y, s, col, d: 1150 }); },
  ring(x, y, r) { this.add({ k: 'ring', x, y, r, d: 800 }); },
  tracer(x0, y0, x1, y1) { this.add({ k: 'tr', x0, y0, x1, y1, d: 170 }); },
  arc(x0, y0, x1, y1) { this.add({ k: 'arc', x0, y0, x1, y1, d: Math.max(1, spd(380)) }); },
  flash(x, y, f) {
    this.add({ k: 'flash', x, y, f: f ?? 2, d: 120 });
    if ((CFG.gfx ?? 2) < 1) return;
    const a = ((f ?? 2) * Math.PI) / 4;
    for (let n = 0; n < 4; n++) this.part({ k: 'smoke', x: x + 0.5 + Math.cos(a) * 0.45, y: y + 0.5 + Math.sin(a) * 0.45, z: 1.0, vx: Math.cos(a) * 0.3 + (rnd() - 0.5) * 0.3, vy: Math.sin(a) * 0.3 + (rnd() - 0.5) * 0.3, vz: 0.45 + rnd() * 0.3, d: 900 + rnd() * 600, r: 0.09 + rnd() * 0.07 });
  },
  blood(x, y, n = 10) {
    if ((CFG.gfx ?? 2) < 1) return;
    for (let k = 0; k < n; k++) this.part({ k: 'blood', x: x + 0.5, y: y + 0.5, z: 0.8 + rnd() * 0.5, vx: (rnd() - 0.5) * 2.6, vy: (rnd() - 0.5) * 2.6, vz: rnd() * 1.8, d: 900, s: 0.025 + rnd() * 0.035 });
  },
  chips(x, y) {
    if ((CFG.gfx ?? 2) < 1) return;
    for (let k = 0; k < 7; k++) this.part({ k: 'chip', x: x + 0.5, y: y + 0.5, z: 0.6 + rnd() * 0.4, vx: (rnd() - 0.5) * 2, vy: (rnd() - 0.5) * 2, vz: 0.5 + rnd() * 1.5, d: 700, s: 0.04 });
  },
  dust(x, y) {
    if ((CFG.gfx ?? 2) < 2) return;
    for (let k = 0; k < 2; k++) this.part({ k: 'dust', x: x + 0.3 + rnd() * 0.4, y: y + 0.3 + rnd() * 0.4, z: 0.05, vx: (rnd() - 0.5) * 0.3, vy: (rnd() - 0.5) * 0.3, vz: 0.2, d: 600, r: 0.08 });
  },
};
function animTo(e, x, y, ms) {
  const fx = e.x, fy = e.y;
  e.x = x; e.y = y;
  if (x !== fx || y !== fy) { e.f = dirIdx(x - fx, y - fy); e.step = (e.step || 0) + 1; if (e.sid) FX.dust(fx, fy); }
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
// Удар: замах (откат назад), выпад к цели, доводка. Промис завершается в момент удара
function swing(e, tx, ty, ms = 520) {
  if (tx !== e.x || ty !== e.y) e.f = dirIdx(tx - e.x, ty - e.y);
  const d = spd(ms);
  if (!(d > 0)) return Promise.resolve();
  const l = Math.hypot(tx - e.x, ty - e.y) || 1;
  e.anim = { k: 'sw', dx: (tx - e.x) / l, dy: (ty - e.y) / l, t0: performance.now(), d };
  R.moving.add(e);
  return sleep(d * 0.5);
}
// Отшатнуться от точки (попадание, отдача)
function knock(e, fx, fy, a = 0.15, ms = 240) {
  const dx = e.x - fx, dy = e.y - fy, l = Math.hypot(dx, dy) || 1;
  e.kb = { dx: dx / l, dy: dy / l, a, t0: performance.now(), d: ms };
  R.until = Math.max(R.until, e.kb.t0 + ms);
}
function animPos(e, now) {
  let x = e.x, y = e.y;
  const a = e.anim;
  if (a) {
    let p = (now - a.t0) / a.d;
    if (p >= 1) { e.anim = null; R.moving.delete(e); }
    else if (a.k === 'mv') { p = p * (2 - p); x = a.fx + (e.x - a.fx) * p; y = a.fy + (e.y - a.fy) * p; }
    else if (a.k === 'sw') { const o = p < 0.42 ? -0.07 * Math.sin((p / 0.42) * Math.PI / 2) : 0.3 * Math.sin(((p - 0.42) / 0.58) * Math.PI); x += a.dx * o; y += a.dy * o; }
    else { const o = Math.sin(Math.PI * p) * 0.35; x += a.dx * o; y += a.dy * o; }
  }
  const kb = e.kb;
  if (kb) { const p = (now - kb.t0) / kb.d; if (p >= 1) e.kb = null; else { const o = kb.a * Math.sin(Math.PI * p) * (1 - p * 0.3); x += kb.dx * o; y += kb.dy * o; } }
  return [x, y];
}

// ----- палитра и помощники -----
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
  [T.WALL]: ['#a29f94', '#8f8c82', '#b4b1a6'],
  [T.BRICK]: ['#9a6450', '#8a5340', '#ab7560'],
  [T.WWALL]: ['#a27b4d', '#8a6440', '#bb9361'],
  [T.WINDOW]: ['#a29f94', '#8f8c82', '#b4b1a6'],
};
const MAPRGB = [];
for (let i = 0; i < TP.length; i++) if (TP[i]) { const h = TP[i].map; MAPRGB[i] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath(); c.moveTo(x + r, y);
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

// ----- текстуры земли: шум, доски, плитка, трава — генерируются под размер клетки -----
const GroundTex = {
  cache: new Map(), budget: 0,
  size(px) { for (const s of [12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160]) if (s >= px) return s; return 160; },
  get(g, v, px) {
    const s = this.size(px), key = g + '|' + v + '|' + s;
    let t = this.cache.get(key);
    if (t) return t;
    if (this.budget > 0) {
      const t0 = performance.now();
      t = this.make(g, v, s);
      this.budget -= performance.now() - t0;
      this.cache.set(key, t);
      if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value);
      return t;
    }
    R.dirty = true;
    for (const [k2, t2] of this.cache) if (k2.startsWith(g + '|' + v + '|')) return t2;
    return null;
  },
  make(g, v, s) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const c = cv.getContext('2d'), img = c.createImageData(s, s), d = img.data, seed = g * 131 + v * 17 + 7;
    const base = hexRgb((GC[g] || GC[T.DIRT])[v % 4]);
    const amp = { [T.GRASS]: [0.28, 0.16], [T.DIRT]: [0.24, 0.18], [T.ASPHALT]: [0.12, 0.3], [T.CONCRETE]: [0.14, 0.1], [T.WOOD]: [0.08, 0.06], [T.TILE]: [0.05, 0.04], [T.SIDEWALK]: [0.12, 0.1], [T.WATER]: [0.2, 0.05], [T.RUBBLE]: [0.25, 0.25] }[g] || [0.2, 0.1];
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const u = x / s, w = y / s;
      const n1 = vnoise(seed, u * 4, w * 4, 1), n2 = vnoise(seed + 9, u * 11, w * 11, 1), n3 = hash2(x, y, seed);
      const f = 1 + (n1 - 0.5) * amp[0] + (n2 - 0.5) * amp[0] * 0.6 + (n3 - 0.5) * amp[1];
      const o = (y * s + x) * 4;
      d[o] = base[0] * f + (g === T.GRASS ? (n1 - 0.5) * 18 : 0); d[o + 1] = base[1] * f; d[o + 2] = base[2] * f; d[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    const r = makeRng(seed * 7 + 3), L = Math.max(1, s / 48);
    const line = (x0, y0, x1, y1, col, wdt = L) => { c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    switch (g) {
      case T.GRASS:
        for (let k = 0; k < 34; k++) {
          const x = r() * s, y = r() * s, l = s * (0.05 + r() * 0.09), a = -Math.PI / 2 + (r() - 0.5) * 0.9;
          line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, r() < 0.5 ? 'rgba(140,170,80,0.38)' : 'rgba(20,32,10,0.35)');
        }
        if (v === 3) for (let k = 0; k < 4; k++) { c.fillStyle = r() < 0.5 ? '#d8d070' : '#e6e2d8'; c.fillRect(r() * s, r() * s, L * 1.5, L * 1.5); }
        break;
      case T.DIRT:
        for (let k = 0; k < 8; k++) { c.fillStyle = r() < 0.5 ? 'rgba(150,125,90,0.45)' : 'rgba(30,22,12,0.4)'; c.beginPath(); c.ellipse(r() * s, r() * s, s * (0.015 + r() * 0.03), s * (0.012 + r() * 0.02), r() * 3, 0, Math.PI * 2); c.fill(); }
        if (v === 1) { c.strokeStyle = 'rgba(25,18,10,0.45)'; c.lineWidth = L; c.beginPath(); let x = r() * s, y = 0; c.moveTo(x, y); while (y < s) { x += (r() - 0.5) * s * 0.2; y += s * 0.15; c.lineTo(x, y); } c.stroke(); }
        break;
      case T.ASPHALT:
        if (v === 2) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(s * 0.5, s * 0.55, s * 0.32, s * 0.2, 0.4, 0, Math.PI * 2); c.fill(); }
        if (v === 0) { c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = L; c.beginPath(); c.moveTo(s * 0.1, s * 0.2); c.lineTo(s * 0.35, s * 0.4); c.lineTo(s * 0.3, s * 0.7); c.lineTo(s * 0.55, s * 0.95); c.stroke(); }
        break;
      case T.CONCRETE: case T.SIDEWALK:
        if (g === T.SIDEWALK) { line(0, s / 2, s, s / 2, 'rgba(0,0,0,0.22)'); line(s / 2, 0, s / 2, s, 'rgba(0,0,0,0.22)'); }
        line(0, L / 2, s, L / 2, 'rgba(0,0,0,0.25)'); line(L / 2, 0, L / 2, s, 'rgba(0,0,0,0.25)');
        line(0, L * 1.5, s, L * 1.5, 'rgba(255,255,255,0.06)');
        if (v === 1) { c.fillStyle = 'rgba(70,45,20,0.16)'; c.beginPath(); c.ellipse(s * 0.6, s * 0.4, s * 0.22, s * 0.15, 0.7, 0, Math.PI * 2); c.fill(); }
        if (v === 3) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = L; c.beginPath(); c.moveTo(s * 0.7, 0); c.lineTo(s * 0.6, s * 0.35); c.lineTo(s * 0.8, s * 0.6); c.stroke(); }
        break;
      case T.WOOD: {
        const n = 4;
        for (let k = 0; k < n; k++) {
          const y0 = (k * s) / n, hh = s / n;
          c.fillStyle = `rgba(${r() < 0.5 ? '255,220,170' : '0,0,0'},${0.04 + r() * 0.06})`; c.fillRect(0, y0, s, hh);
          c.strokeStyle = 'rgba(40,24,10,0.18)'; c.lineWidth = L * 0.8;
          for (let j = 0; j < 2; j++) { c.beginPath(); const yy = y0 + hh * (0.3 + j * 0.4); c.moveTo(0, yy); for (let x = 0; x <= s; x += s / 8) c.lineTo(x, yy + Math.sin(x * 0.2 + k + j) * hh * 0.08); c.stroke(); }
          line(0, y0 + L / 2, s, y0 + L / 2, 'rgba(20,12,4,0.55)');
          const jx = ((k * 0.37 + v * 0.21) % 1) * s;
          line(jx, y0, jx, y0 + hh, 'rgba(20,12,4,0.5)');
          c.fillStyle = 'rgba(30,26,22,0.6)'; c.fillRect(jx + L * 2, y0 + hh / 2 - L / 2, L, L);
        }
        break;
      }
      case T.TILE: {
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { c.fillStyle = `rgba(${(tx + ty + v) % 2 ? '255,255,255' : '0,0,0'},0.05)`; c.fillRect((tx * s) / 2, (ty * s) / 2, s / 2, s / 2); }
        line(0, s / 2, s, s / 2, 'rgba(40,40,36,0.4)', L * 1.2); line(s / 2, 0, s / 2, s, 'rgba(40,40,36,0.4)', L * 1.2);
        line(0, L / 2, s, L / 2, 'rgba(40,40,36,0.4)', L * 1.2); line(L / 2, 0, L / 2, s, 'rgba(40,40,36,0.4)', L * 1.2);
        const gr = c.createLinearGradient(0, 0, s, s); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)');
        c.fillStyle = gr; c.fillRect(0, 0, s, s);
        break;
      }
      case T.WATER:
        for (let k = 0; k < 5; k++) { c.strokeStyle = 'rgba(170,200,215,0.18)'; c.lineWidth = L; c.beginPath(); c.ellipse(r() * s, r() * s, s * (0.08 + r() * 0.12), s * (0.03 + r() * 0.04), 0, 0, Math.PI * 2); c.stroke(); }
        line(s * 0.2, s * 0.3, s * 0.6, s * 0.28, 'rgba(230,240,245,0.25)', L * 1.2);
        break;
      case T.RUBBLE:
        for (let k = 0; k < 10; k++) {
          c.fillStyle = ['#7a756c', '#47433c', '#8c877c', '#5e5a52'][k % 4];
          const x = r() * s, y = r() * s, q = s * (0.04 + r() * 0.07);
          c.beginPath(); c.moveTo(x, y - q); c.lineTo(x + q, y - q * 0.2); c.lineTo(x + q * 0.4, y + q); c.lineTo(x - q * 0.8, y + q * 0.5); c.closePath(); c.fill();
        }
        break;
    }
    return cv;
  },
};
function drawGround(c, m, g, x, y, i, X, Y, w, h, lod) {
  const gfx = CFG.gfx ?? 2;
  let done = false;
  if (gfx >= 1 && lod >= 1) {
    const tex = GroundTex.get(g, (hash2(x, y, 1) * 4) | 0, w * R.dpr);
    if (tex) { c.drawImage(tex, X - 0.6, Y - 0.6, w + 1.2, h + 1.2); done = true; }
  }
  if (!done) {
    c.fillStyle = (GC[g] || GC[T.DIRT])[(hash2(x, y, 1) * 4) | 0];
    c.fillRect(X - 0.6, Y - 0.6, w + 1.2, h + 1.2);
    if (lod === 2 && g === T.GRASS) { c.fillStyle = 'rgba(130,160,80,0.22)'; c.fillRect(X + w * hash2(x, y, 2) * 0.8, Y + h * hash2(x, y, 3) * 0.8, Math.max(1, w * 0.06), h * 0.18); }
  }
  const md = m.meta[i], t = m.tiles[i];
  const road = TP[t].floor || t === T.BLOCK;
  if (road && g === T.ASPHALT) {
    c.fillStyle = 'rgba(214,180,80,0.7)';
    if (md & 2 && y % 3) c.fillRect(X + w * 0.45, Y + h * 0.15, Math.max(1, w * 0.1), h * 0.7);
    if (md & 4 && x % 3) c.fillRect(X + w * 0.15, Y + h * 0.45, w * 0.7, Math.max(1, h * 0.1));
    if (md & 8) { c.fillStyle = 'rgba(220,220,210,0.55)'; c.fillRect(X, Y, Math.max(1, w * 0.07), h); }
  } else if (road && g === T.DIRT && md & 6) {
    c.fillStyle = 'rgba(40,30,18,0.35)';
    if (md & 2) c.fillRect(X + w * 0.38, Y, w * 0.24, h);
    if (md & 4) c.fillRect(X, Y + h * 0.38, w, h * 0.24);
  }
  if (md & 48 && !TP[t].wall) {
    // рельсы: 16 — верхняя нитка пути, 32 — нижняя
    const top = md & 16, a = top ? 0.3 : 0, b = top ? 1 : 0.7, rl = top ? 0.62 : 0.38;
    c.fillStyle = 'rgba(66,48,30,0.92)';
    for (let s = 0.08; s < 1; s += 0.34) c.fillRect(X + w * s, Y + h * a, w * 0.14, h * (b - a));
    c.fillStyle = '#85847e'; c.fillRect(X, Y + h * rl, w, Math.max(1, h * 0.06));
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(X, Y + h * (rl + 0.06), w, Math.max(1, h * 0.03));
  }
  if (gfx >= 2 && lod === 2 && TP[t].floor) litter(c, g, x, y, X, Y, w);
}
// Мусор на земле: бумага, банки, шины, листья, осколки
function litter(c, g, x, y, X, Y, w) {
  const hv = hash2(x, y, 31);
  const indoor = g === T.WOOD || g === T.TILE || g === T.CONCRETE;
  if (hv > (indoor ? 0.07 : 0.09)) return;
  const kind = (hash2(x, y, 32) * 5) | 0, px = X + w * (0.2 + hash2(x, y, 33) * 0.6), py = Y + w * (0.2 + hash2(x, y, 34) * 0.6), a = hash2(x, y, 35) * 3;
  c.save(); c.translate(px, py); c.rotate(a);
  if (kind === 0) { c.fillStyle = 'rgba(220,214,196,0.85)'; c.fillRect(-w * 0.09, -w * 0.06, w * 0.18, w * 0.12); c.fillStyle = 'rgba(80,80,80,0.4)'; c.fillRect(-w * 0.06, -w * 0.02, w * 0.12, w * 0.012); }
  else if (kind === 1) { c.fillStyle = '#8a2f24'; c.fillRect(-w * 0.04, -w * 0.025, w * 0.08, w * 0.05); c.fillStyle = '#c9c3b2'; c.fillRect(w * 0.03, -w * 0.025, w * 0.012, w * 0.05); }
  else if (kind === 2 && !indoor) { c.strokeStyle = '#1b1a18'; c.lineWidth = w * 0.06; c.beginPath(); c.ellipse(0, 0, w * 0.13, w * 0.1, 0, 0, Math.PI * 2); c.stroke(); }
  else if (kind === 3) { c.fillStyle = indoor ? 'rgba(170,200,215,0.7)' : '#8a5a2a'; for (let k = 0; k < 4; k++) c.fillRect((hash2(x, k, 36) - 0.5) * w * 0.3, (hash2(k, y, 37) - 0.5) * w * 0.3, w * 0.04, w * 0.03); }
  else { c.fillStyle = 'rgba(60,90,50,0.8)'; c.fillRect(-w * 0.07, -w * 0.02, w * 0.14, w * 0.04); }
  c.restore();
}

// ----- камера и кадр -----
const R = {
  cv: null, c: null, dpr: 1, W: 1, H: 1,
  cam: { cx: 32, cy: 32, k: 46, rot: 0 }, dirty: true, mode: null, moving: new Set(),
  camAnim: null, shakeA: 0, shakeT: 0, menu: null, until: 0, lastIdle: 0, hits: [], objHits: [], pan: null, pinch: null,
  init(cv) {
    this.cv = cv; this.c = cv.getContext('2d', { alpha: false });
    this.resize();
    const loop = () => { requestAnimationFrame(loop); this.tick(); };
    requestAnimationFrame(loop);
  },
  resize() {
    if (!this.cv) return;
    const W = this.cv.clientWidth || 1, H = this.cv.clientHeight || 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, [1.25, 2, 3][CFG.gfx ?? 2]);
    this.W = W; this.H = H;
    this.cv.width = Math.round(W * this.dpr); this.cv.height = Math.round(H * this.dpr);
    this.clampCam();
    this.dirty = true;
  },
  proj(x, y, z = 0) { setCB(this.cam, this.W, this.H); P(x, y, z); return [PX, PY]; },
  unproj(sx, sy) { setCB(this.cam, this.W, this.H); return unP(sx, sy); },
  curMap() { return this.mode === 'base' ? this.base && this.base.m : TAC.m; },
  kMin() {
    const m = this.curMap();
    if (!m) return 8;
    const d = (m.w + m.h) * Math.SQRT1_2;
    return Math.max(6, Math.min(this.W / d, this.H / (d * VX.sE)) * 0.95);
  },
  clampCam() {
    const m = this.curMap();
    if (!m) return;
    this.cam.k = clamp(this.cam.k, this.kMin(), 110);
    this.cam.cx = clamp(this.cam.cx, 0, m.w); this.cam.cy = clamp(this.cam.cy, 0, m.h);
  },
  centerOn(x, y, instant) {
    const tx = x + 0.5, ty = y + 0.5;
    if (instant || CFG.speed >= 3 || reducedMotion) { this.cam.cx = tx; this.cam.cy = ty; this.camAnim = null; this.clampCam(); }
    else this.camAnim = { fx: this.cam.cx, fy: this.cam.cy, tx, ty, t0: performance.now(), d: 300 };
    this.dirty = true;
  },
  ensureVisible(x, y) {
    const [sx, sy] = this.proj(x + 0.5, y + 0.5, 0.9);
    const mx = Math.min(150, this.W * 0.22), my = Math.min(70, this.H * 0.18);
    if (sx < mx || sx > this.W - mx || sy < my || sy > this.H - my) this.centerOn(x, y);
  },
  zoomAt(sx, sy, f) {
    const w = this.unproj(sx, sy);
    this.cam.k = clamp(this.cam.k * f, this.kMin(), 110);
    const w2 = this.unproj(sx, sy);
    this.cam.cx += w[0] - w2[0]; this.cam.cy += w[1] - w2[1];
    this.camAnim = null; this.clampCam(); this.dirty = true;
  },
  rotate(d) { this.cam.rot = (this.cam.rot + d + 4) % 4; this.dirty = true; },
  panStart(sx, sy) { this.pan = { sx, sy, cx: this.cam.cx, cy: this.cam.cy }; this.camAnim = null; },
  panTo(sx, sy) {
    const p = this.pan;
    if (!p) return;
    setCB(this.cam, this.W, this.H);
    const a = (sx - p.sx) / this.cam.k, b = -(sy - p.sy) / (this.cam.k * VX.sE);
    this.cam.cx = p.cx - (a * CB.rx + b * CB.fx); this.cam.cy = p.cy - (a * CB.ry + b * CB.fy);
    this.clampCam(); this.dirty = true;
  },
  pinchStart(mx, my, d) { this.pinch = { d: d || 1, k: this.cam.k, w: this.unproj(mx, my) }; this.camAnim = null; },
  pinchTo(mx, my, d) {
    const q = this.pinch;
    if (!q) return;
    this.cam.k = clamp(q.k * (d || 1) / q.d, this.kMin(), 110);
    const w2 = this.unproj(mx, my);
    this.cam.cx += q.w[0] - w2[0]; this.cam.cy += q.w[1] - w2[1];
    this.clampCam(); this.dirty = true;
  },
  shake(a) {
    if (!CFG.shake || reducedMotion) return;
    this.shakeA = Math.max(this.shakeA, a); this.shakeT = performance.now(); this.dirty = true;
  },
  toTile(sx, sy) {
    for (let k = this.objHits.length - 1; k >= 0; k--) {
      const h = this.objHits[k];
      if (sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1) return { x: h.x, y: h.y };
    }
    const w = this.unproj(sx, sy);
    return { x: Math.floor(w[0]), y: Math.floor(w[1]) };
  },
  pick(ax, ay, onlyZ) {
    for (let k = this.hits.length - 1; k >= 0; k--) {
      const h = this.hits[k];
      if (onlyZ && !h.z) continue;
      if (ax >= h.x0 && ax <= h.x1 && ay >= h.y0 && ay <= h.y1) return h.e;
    }
    return null;
  },
  tick() {
    if (!this.mode) return;
    const now = performance.now();
    if (CFG.hq && this.cam.k >= 14 && now - this.lastIdle > (this.fireVis ? 100 : 320)) { this.lastIdle = now; this.dirty = true; }
    const active = this.moving.size || FX.list.length || FX.parts.length || this.camAnim || this.shakeA > 0 || this.until > now;
    if (!this.dirty && !active) return;
    if (this.mode === 'menu' && !this.dirty && now - (this.lastDraw || 0) < 40) return;   // фон меню — 25 кадров
    this.lastDraw = now;
    this.dirty = false;
    GroundTex.budget = 7;
    try { this.draw(now); } catch (e) { console.error(e); }
  },
  draw(now) {
    const c = this.c;
    this.fireVis = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0b0a08';
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.mode === 'tac' && TAC.m) {
      if (this.camAnim) {
        const a = this.camAnim, p = Math.min(1, (now - a.t0) / a.d), e = 1 - (1 - p) ** 3;
        this.cam.cx = a.fx + (a.tx - a.fx) * e; this.cam.cy = a.fy + (a.ty - a.fy) * e;
        if (p >= 1) { this.camAnim = null; this.clampCam(); }
      }
      let ox = 0, oy = 0;
      if (this.shakeA > 0) {
        const p = (now - this.shakeT) / 220;
        if (p >= 1) this.shakeA = 0;
        else { const a = this.shakeA * (1 - p); ox = (Math.random() * 2 - 1) * a; oy = (Math.random() * 2 - 1) * a; }
      }
      drawIso(c, TAC.m, this.cam, this.W, this.H, now, false, [ox, oy]);
    } else if (this.mode === 'base' && this.base) {
      if (this.camAnim) {
        const a = this.camAnim, p = Math.min(1, (now - a.t0) / a.d), e = 1 - (1 - p) ** 3;
        this.cam.cx = a.fx + (a.tx - a.fx) * e; this.cam.cy = a.fy + (a.ty - a.fy) * e;
        if (p >= 1) this.camAnim = null;
      }
      drawIso(c, this.base.m, this.cam, this.W, this.H, now, true, [0, 0], this.base.ents);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const g = c.createLinearGradient(0, 0, 0, this.H);
      g.addColorStop(0, 'rgba(11,10,8,0.55)'); g.addColorStop(0.18, 'rgba(11,10,8,0)'); g.addColorStop(0.82, 'rgba(11,10,8,0)'); g.addColorStop(1, 'rgba(11,10,8,0.6)');
      c.fillStyle = g; c.fillRect(0, 0, this.W, this.H);
    } else if (this.mode === 'menu' && this.menu) {
      const M = this.menu, t = (now - M.t0) / 1000;
      if (M.base && !reducedMotion) { M.cam.cx = M.base.cx + Math.sin(t * 0.045) * 4; M.cam.cy = M.base.cy + Math.sin(t * 0.031 + 1) * 3; this.until = Math.max(this.until, now + 200); }
      drawIso(c, M.m, M.cam, this.W, this.H, now, true, [0, 0], M.ents);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const g = c.createLinearGradient(0, 0, this.W, 0);
      g.addColorStop(0, 'rgba(11,10,8,0.95)'); g.addColorStop(0.5, 'rgba(11,10,8,0.66)'); g.addColorStop(1, 'rgba(11,10,8,0.25)');
      c.fillStyle = g; c.fillRect(0, 0, this.W, this.H);
      if (this.W >= 600) drawLineup(c, this.W, this.H, now);
    }
  },
  setMenuMap() {
    MenuScene.build();
    this.dirty = true;
  },
};

// ----- разметка на земле (в пространстве клеток) -----
function drawGroundMarks(c, m, k, x0, x1, y0, y1) {
  const SX = x => x * k, SY = y => y * k;
  if (m.evac && m.evac.length) {
    const set = new Set(m.evac);
    c.fillStyle = 'rgba(134,168,93,0.18)';
    c.strokeStyle = 'rgba(160,200,110,0.8)'; c.lineWidth = Math.max(1.5, k * 0.05);
    c.beginPath();
    for (const i of m.evac) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1 || !m.seen[i]) continue;
      const X = SX(x), Y = SY(y);
      c.fillRect(X, Y, k, k);
      if (!set.has(i - 1) || x === 0) { c.moveTo(X, Y); c.lineTo(X, Y + k); }
      if (!set.has(i + 1)) { c.moveTo(X + k, Y); c.lineTo(X + k, Y + k); }
      if (!set.has(i - m.w)) { c.moveTo(X, Y); c.lineTo(X + k, Y); }
      if (!set.has(i + m.w)) { c.moveTo(X, Y + k); c.lineTo(X + k, Y + k); }
    }
    c.stroke();
  }
  const u = curUnit(), rf = TAC.reach, pd = TAC.pend;
  if (u && rf && rf.uid === u.id && m.phase === 'player' && !TAC.busy && TAC.mode !== 'lure') {
    c.fillStyle = 'rgba(232,166,43,0.15)';
    c.strokeStyle = 'rgba(232,166,43,0.8)'; c.lineWidth = Math.max(1.2, k * 0.035);
    c.beginPath();
    const occ = new Set();
    for (const o of m.units) if (!o.dead && !o.evac) occ.add(MI(m, o.x, o.y));
    for (const z of m.zombies) if (m.vis[MI(m, z.x, z.y)]) occ.add(MI(m, z.x, z.y));
    const ok = j => j >= 0 && j < m.n && (rf.dist[j] >= 0 || !TP[m.tiles[j]].walk || occ.has(j) || !m.seen[j]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x;
      if (rf.dist[i] <= 0 || !m.seen[i]) continue;
      const X = SX(x), Y = SY(y);
      c.fillRect(X, Y, k, k);
      if (x === 0 || !ok(i - 1)) { c.moveTo(X, Y); c.lineTo(X, Y + k); }
      if (x === m.w - 1 || !ok(i + 1)) { c.moveTo(X + k, Y); c.lineTo(X + k, Y + k); }
      if (!ok(i - m.w)) { c.moveTo(X, Y); c.lineTo(X + k, Y); }
      if (!ok(i + m.w)) { c.moveTo(X, Y + k); c.lineTo(X + k, Y + k); }
    }
    c.stroke();
  }
  if (u && TAC.mode === 'lure') {
    c.setLineDash([k * 0.3, k * 0.3]); c.strokeStyle = 'rgba(232,166,43,0.8)'; c.lineWidth = Math.max(1.5, k * 0.04);
    circ(c, SX(u.x) + k / 2, SY(u.y) + k / 2, LURE_RANGE * k); c.stroke(); c.setLineDash([]);
  }
  if (pd && pd.path && u) {
    c.fillStyle = '#e8a62b';
    for (const i of pd.path) { const x = i % m.w, y = (i / m.w) | 0; circ(c, SX(x) + k / 2, SY(y) + k / 2, Math.max(2, k * 0.09)); c.fill(); }
    const last = pd.path[pd.path.length - 1], lx = last % m.w, ly = (last / m.w) | 0;
    c.strokeStyle = '#e8a62b'; c.lineWidth = Math.max(1.5, k * 0.06);
    circ(c, SX(lx) + k / 2, SY(ly) + k / 2, k * 0.34); c.stroke();
  }
  if (pd && pd.tx != null && pd.col !== '#ff6a50') {
    const X = SX(pd.tx), Y = SY(pd.ty), s = k * 0.28;
    c.strokeStyle = pd.col || '#e8a62b'; c.lineWidth = Math.max(1.5, k * 0.06);
    c.beginPath();
    c.moveTo(X, Y + s); c.lineTo(X, Y); c.lineTo(X + s, Y);
    c.moveTo(X + k - s, Y); c.lineTo(X + k, Y); c.lineTo(X + k, Y + s);
    c.moveTo(X + k, Y + k - s); c.lineTo(X + k, Y + k); c.lineTo(X + k - s, Y + k);
    c.moveTo(X + s, Y + k); c.lineTo(X, Y + k); c.lineTo(X, Y + k - s);
    c.stroke();
  }
}

// ----- эффекты поверх кадра (в экранных координатах) -----
function drawFX(c, now, gfx) {
  const k = CB.k, keep = [];
  for (const f of FX.list) {
    const p = (now - f.t0) / f.d;
    if (p >= 1) continue;
    keep.push(f);
    if (f.k === 'ring') {
      P(f.x + 0.5, f.y + 0.5, 0);
      c.strokeStyle = `rgba(232,166,43,${(1 - p) * 0.6})`; c.lineWidth = 2;
      const r = f.r * k * (0.15 + 0.85 * p);
      c.beginPath(); c.ellipse(PX, PY, r, r * CB.sE, 0, 0, Math.PI * 2); c.stroke();
    } else if (f.k === 'tr') {
      P(f.x0 + 0.5, f.y0 + 0.5, 1.05); const ax = PX, ay = PY; P(f.x1 + 0.5, f.y1 + 0.5, 0.95);
      const g = c.createLinearGradient(ax, ay, PX, PY);
      g.addColorStop(0, `rgba(255,236,170,${1 - p})`); g.addColorStop(1, `rgba(255,190,90,${(1 - p) * 0.4})`);
      c.strokeStyle = g; c.lineWidth = Math.max(1.5, k * 0.04);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(PX, PY); c.stroke();
    } else if (f.k === 'flash') {
      const a = (f.f * Math.PI) / 4;
      P(f.x + 0.5 + Math.cos(a) * 0.5, f.y + 0.5 + Math.sin(a) * 0.5, 1.02);
      const r = k * 0.35 * (1 - p * 0.5);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,220,140,${1 - p})`; circ(c, PX, PY, r * 0.55); c.fill();
      c.strokeStyle = `rgba(255,200,110,${(1 - p) * 0.9})`; c.lineWidth = Math.max(1, k * 0.03);
      c.beginPath();
      for (let n = 0; n < 6; n++) { const b = (n * Math.PI) / 3 + f.t0; c.moveTo(PX, PY); c.lineTo(PX + Math.cos(b) * r, PY + Math.sin(b) * r * 0.7); }
      c.stroke();
      c.globalCompositeOperation = 'source-over';
    } else if (f.k === 'arc') {
      const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p, z = 1 + Math.sin(Math.PI * p) * 2.2;
      P(x + 0.5, y + 0.5, z);
      c.fillStyle = '#7fb08a'; circ(c, PX, PY, Math.max(2.5, k * 0.09)); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; circ(c, PX - k * 0.03, PY - k * 0.03, Math.max(1, k * 0.03)); c.fill();
    }
  }
  FX.list = keep;
  // частицы
  const m = TAC.m, live = [];
  for (const q of FX.parts) {
    const p = (now - q.t0) / q.d, t = (now - q.t0) / 1000;
    if (p >= 1) continue;
    const x = q.x + q.vx * t, y = q.y + q.vy * t;
    let z = q.k === 'smoke' || q.k === 'dust' ? q.z + q.vz * t : q.z + q.vz * t - 4.9 * t * t;
    if (z <= 0 && (q.k === 'blood' || q.k === 'chip')) {
      if (q.k === 'blood' && m && m.decals.length < 600) {
        const tx = Math.floor(x), ty = Math.floor(y);
        if (inb(m, tx, ty)) m.decals.push({ k: 'spot', x: tx, y: ty, fx: x - tx, fy: y - ty, s: q.s * 1.6 });
      }
      continue;
    }
    live.push(q);
    P(x, y, z);
    if (q.k === 'smoke' || q.k === 'dust') {
      const r = (q.r + p * 0.25) * k;
      c.fillStyle = q.k === 'smoke' ? `rgba(170,166,158,${0.35 * (1 - p)})` : `rgba(150,130,100,${0.3 * (1 - p)})`;
      circ(c, PX, PY, r); c.fill();
    } else {
      const s = Math.max(1.5, q.s * k);
      c.fillStyle = q.k === 'blood' ? '#7a160e' : '#7a5a34';
      c.fillRect(PX - s / 2, PY - s / 2, s, s);
    }
  }
  FX.parts = live;
  // всплывающий текст
  for (const f of FX.list) {
    if (f.k !== 'text') continue;
    const p = (now - f.t0) / f.d;
    P(f.x + 0.5, f.y + 0.5, 2.1);
    const fs = clamp(k * 0.42, 12, 22);
    c.font = `600 ${fs}px Oswald, "Arial Narrow", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const Y = PY - p * k * 0.9;
    c.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(f.s, PX, Y);
    c.fillStyle = f.col; c.fillText(f.s, PX, Y);
    c.globalAlpha = 1;
  }
}

// ----- мини-карта -----
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
  for (const z of m.zombies) if (m.vis[MI(m, z.x, z.y)]) { c.fillStyle = isHuman(z) ? ZT[z.type].body : '#ff5a3c'; c.fillRect(ox + z.x * k, oy + z.y * k, k, k); }
  for (const cp of m.captives || []) if (!cp.freed && m.seen[MI(m, cp.x, cp.y)]) { c.fillStyle = '#f0c46a'; c.fillRect(ox + cp.x * k - k / 2, oy + cp.y * k - k / 2, k * 2, k * 2); }
  for (const u of m.units) if (!u.dead && !u.evac) { c.fillStyle = u.color; c.fillRect(ox + u.x * k - k / 2, oy + u.y * k - k / 2, k * 2, k * 2); }
  const pts = [[0, 0], [R.W, 0], [R.W, R.H], [0, R.H]].map(([sx, sy]) => R.unproj(sx, sy));
  c.strokeStyle = '#ece4cc'; c.lineWidth = 1.5;
  c.beginPath(); pts.forEach(([wx, wy], n) => (n ? c.lineTo : c.moveTo).call(c, ox + wx * k, oy + wy * k)); c.closePath(); c.stroke();
  return { k, ox, oy };
}

// ----- полоски здоровья, значки и шеврон над головами -----
function drawBadges(c, it, ts, lod) {
  const e = it.e, cx = it.cx, top = it.top;
  if (it.cap) {
    if (lod === 0) return;
    const fs = clamp(ts * 0.24, 10, 14);
    c.font = `600 ${fs}px Oswald, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText('ПЛЕННИК', cx, top - 3);
    c.fillStyle = '#f0c46a'; c.fillText('ПЛЕННИК', cx, top - 3);
    return;
  }
  const hum = it.z && isHuman(e);
  const maxhp = it.z ? (e.rf ? ZT.walker.hp : ZT[e.type].hp) : e.maxhp, hp = Math.max(0, e.hp);
  const showHp = lod > 0 && (!it.z || hum || hp < maxhp || (TAC.pend && TAC.pend.tx === e.x && TAC.pend.ty === e.y));
  let y = top - Math.max(5, ts * 0.12);
  if (showHp) {
    const n = Math.ceil(maxhp / 2), fill = Math.ceil(hp / 2);
    const pw = Math.max(2, ts * 0.062), ph = Math.max(3, ts * 0.075), gap = Math.max(1, Math.round(ts * 0.018));
    const W = n * pw + (n - 1) * gap, x0 = cx - W / 2;
    c.fillStyle = 'rgba(10,9,7,0.8)'; c.fillRect(x0 - 2, y - 2, W + 4, ph + 4);
    const f = hp / maxhp, col = hum ? ZT[e.type].body : it.z ? '#d9553c' : f > 0.6 ? '#9cc96a' : f > 0.3 ? '#e8a62b' : '#d9553c';
    for (let k = 0; k < n; k++) { c.fillStyle = k < fill ? col : '#3a3528'; c.fillRect(x0 + k * (pw + gap), y, pw, ph); }
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

// ----- отряд на фоне главного меню -----
const DEFAULT_SQUAD = [
  { id: 1, name: 'Марина', g: 'f', trait: 'medic', melee: 'knife', ranged: 'pistol', color: UNIT_COLORS[1] },
  { id: 2, name: 'Гоша', g: 'm', trait: 'strong', melee: 'bat', ranged: null, color: UNIT_COLORS[2] },
  { id: 3, name: 'Лёха', g: 'm', trait: 'marksman', melee: 'crowbar', ranged: 'pistol', color: UNIT_COLORS[0] },
  { id: 4, name: 'Семёныч', g: 'm', trait: 'hunter', melee: 'axe', ranged: 'shotgun', color: UNIT_COLORS[3] },
];
function drawLineup(c, W, H, now) {
  const ppl = (typeof S !== 'undefined' && S && S.survivors && S.survivors.length ? S.survivors : DEFAULT_SQUAD).slice(0, 4);
  const ts = clamp(H * 0.46, 90, 260), dirs = [3, 2, 1, 2];
  const x0 = W - ts * 0.6 * ppl.length - ts * 0.3 - Math.max(16, W * 0.03);
  ppl.forEach((s, i) => {
    const cx = x0 + i * ts * 0.66 + ts * 0.3, fy = H * 0.92 - (i % 2) * ts * 0.12;
    const g = c.createRadialGradient(cx, fy, 0, cx, fy, ts * 0.42);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(cx + ts * 0.08, fy + ts * 0.02, ts * 0.42, ts * 0.15, 0, 0, Math.PI * 2); c.fill();
    Spr.draw(c, Spr.look(s, 'h'), frameOf({ id: s.id }, now), dirs[i], cx, fy, ts, 8);
  });
}
