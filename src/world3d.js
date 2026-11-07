'use strict';
// ---------- Объёмный мир (вид 3/4): стены с высотой, мебель, техника, растительность ----------
// Рисуется по рядам с севера на юг: объекты ряда, затем фигуры, затем низкая растительность.
// Так стены и кроны закрывают тех, кто стоит за ними, а стоящие впереди — их.

const WALL_H = 0.62;   // высота стен, в долях клетки на экране
const WALL_T = 0.36;   // толщина стен
let DIM = 1;           // затемнение для тумана войны
const _dimC = new Map();
function F(col) {
  if (DIM === 1 || col[0] !== '#') return col;
  const k = col + DIM;
  let v = _dimC.get(k);
  if (v === undefined) { v = shade(col, DIM); if (_dimC.size > 3000) _dimC.clear(); _dimC.set(k, v); }
  return v;
}
// Коробка: основание (x, y, w, d) на земле, поднята на z0, высота hz — всё в пикселях экрана
function box3(c, x, y, w, d, hz, top, front, z0 = 0) {
  c.fillStyle = F(front); c.fillRect(x, y + d - z0 - hz, w, hz);
  c.fillStyle = F(top); c.fillRect(x, y - z0 - hz, w, d);
}
function cyl3(c, cx, cy, rx, ry, hz, top, side, z0 = 0) {
  const by = cy - z0, ty = by - hz;
  c.fillStyle = F(side);
  c.beginPath(); c.ellipse(cx, by, rx, ry, 0, 0, Math.PI); c.fill();
  c.fillRect(cx - rx, ty, rx * 2, hz);
  c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(cx - rx * 0.75, ty, rx * 0.45, hz);
  c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(cx + rx * 0.45, ty, rx * 0.55, hz);
  c.fillStyle = F(top); c.beginPath(); c.ellipse(cx, ty, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
const wallish = (m, x, y) => { if (!inb(m, x, y)) return false; const t = m.tiles[MI(m, x, y)]; return TP[t].wall || isDoorT(t); };

// Высота объекта (для меток добычи над ним), в долях клетки
const OBJ_H = {
  [T.CRATE]: 0.42, [T.SHELF]: 0.74, [T.LOCKER]: 0.78, [T.FRIDGE]: 0.76, [T.DESK]: 0.34, [T.DRUM]: 0.5,
  [T.WELL]: 0.28, [T.MEDCAB]: 0.56, [T.BENCH]: 0.36, [T.FURN]: 0.3, [T.HAY]: 0.42, [T.BLOCK]: 0.4, [T.BLOCKH]: 0.6,
};

// ----- стены -----
function wallPieces(m, x, y) {
  return { n: wallish(m, x, y - 1), s: wallish(m, x, y + 1), w: wallish(m, x - 1, y), e: wallish(m, x + 1, y) };
}
function drawWall3(c, m, x, y, t, X, Y, w, h, hz, lod) {
  const [top, face, hl] = WALLC[t] || WALLC[T.WALL];
  const P = wallPieces(m, x, y), a = (1 - WALL_T) / 2, b = a + WALL_T;
  const win = t === T.WINDOW;
  const piece = (px0, py0, px1, py1, front) => {
    const bx = X + w * px0, by = Y + h * py0, bw = w * (px1 - px0), bd = h * (py1 - py0);
    if (front) {
      c.fillStyle = F(face); c.fillRect(bx, by + bd - hz, bw, hz);
      if (lod === 2) {
        c.fillStyle = 'rgba(0,0,0,0.2)';
        const fy = by + bd - hz;
        if (t === T.BRICK) { for (let k = 1; k < 4; k++) c.fillRect(bx, fy + (hz * k) / 4, bw, 1); for (let k = 0; k < 4; k++) c.fillRect(bx + bw * ((k + x) % 2 ? 0.55 : 0.2), fy + (hz * k) / 4, 1, hz / 4); }
        else if (t === T.WWALL) { c.fillRect(bx + bw * 0.33, fy, 1, hz); c.fillRect(bx + bw * 0.66, fy, 1, hz); }
        else c.fillRect(bx, fy + hz * 0.5, bw, 1);
        c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(bx, by + bd - Math.max(1, hz * 0.07), bw, Math.max(1, hz * 0.07));
      }
      if (win && bw > w * 0.5) {
        c.fillStyle = F('#7e9fb4'); c.fillRect(bx + bw * 0.14, by + bd - hz * 0.8, bw * 0.72, hz * 0.42);
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(bx + bw * 0.2, by + bd - hz * 0.76, bw * 0.22, Math.max(1, hz * 0.06));
      }
    }
    c.fillStyle = F(top); c.fillRect(bx, by - hz, bw, bd);
  };
  // северный отросток, середина (с западным и восточным), южный отросток
  if (P.n) piece(a, 0, b, a, false);
  piece(P.w ? 0 : a, a, P.e ? 1 : b, b, true);
  if (P.s) piece(a, b, b, 1, !wallish(m, x, y + 1));
  // кромка сверху
  if (lod === 2 && !P.n) {
    c.fillStyle = F(hl);
    c.fillRect(X + w * (P.w ? 0 : a), Y + h * a - hz, w * ((P.e ? 1 : b) - (P.w ? 0 : a)), Math.max(1, h * 0.05));
  }
  if (win) {
    c.fillStyle = F('#86a7bb');
    const hz2 = P.w || P.e;
    if (hz2) c.fillRect(X, Y + h * 0.46 - hz, w, Math.max(1, h * 0.08));
    else c.fillRect(X + w * 0.46, Y - hz, Math.max(1, w * 0.08), h);
  }
}
function drawDoor3(c, m, x, y, t, i, X, Y, w, h, hz, lod) {
  const metal = m.meta[i] & 1, col = metal ? '#7b8287' : '#8e5f30', dk = metal ? '#4c5257' : '#5c3b1a';
  const P = wallPieces(m, x, y), hzD = hz * 0.9, a = (1 - WALL_T) / 2;
  const [wt, wf] = (() => {
    for (const [dx, dy] of DIR4) { const nx = x + dx, ny = y + dy; if (inb(m, nx, ny) && TP[m.tiles[MI(m, nx, ny)]].wall) return WALLC[m.tiles[MI(m, nx, ny)]]; }
    return WALLC[T.WALL];
  })();
  const horiz = P.w || P.e || !(P.n || P.s);
  if (horiz) {
    // косяки слева и справа
    if (P.w) box3(c, X, Y + h * a, w * 0.12, h * WALL_T, hz, wt, wf);
    if (t === T.DOOR) {
      box3(c, X + w * 0.1, Y + h * 0.43, w * 0.8, h * 0.14, hzD, shade(col, 1.15), col);
      if (lod === 2) { c.fillStyle = F('#d8c48a'); c.fillRect(X + w * 0.72, Y + h * 0.57 - hzD * 0.5, Math.max(1.5, w * 0.06), Math.max(1.5, h * 0.06)); }
    } else if (t === T.DOOR_OPEN) box3(c, X + w * 0.12, Y + h * 0.5, w * 0.12, h * 0.52, hzD, shade(col, 1.15), dk);
    else { c.fillStyle = F(col); c.fillRect(X + w * 0.15, Y + h * 0.62, w * 0.28, h * 0.08); c.fillRect(X + w * 0.55, Y + h * 0.45, w * 0.3, h * 0.07); }
    if (P.e) box3(c, X + w * 0.88, Y + h * a, w * 0.12, h * WALL_T, hz, wt, wf);
  } else {
    if (P.n) box3(c, X + w * a, Y, w * WALL_T, h * 0.12, hz, wt, wf);
    if (t === T.DOOR) box3(c, X + w * 0.43, Y + h * 0.1, w * 0.14, h * 0.8, hzD, shade(col, 1.15), dk);
    else if (t === T.DOOR_OPEN) box3(c, X + w * 0.5, Y + h * 0.12, w * 0.5, h * 0.12, hzD, shade(col, 1.15), col);
    else { c.fillStyle = F(col); c.fillRect(X + w * 0.38, Y + h * 0.3, w * 0.1, h * 0.25); c.fillRect(X + w * 0.5, Y + h * 0.6, w * 0.08, h * 0.25); }
    if (P.s) box3(c, X + w * a, Y + h * 0.88, w * WALL_T, h * 0.12, hz, wt, wf);
  }
}
function drawFence3(c, m, x, y, i, X, Y, w, h, ts) {
  const md = m.meta[i], hzF = ts * (md === 1 ? 0.5 : 0.38);
  const rail = md === 1 ? '#9aa0a4' : md === 2 ? '#c9c2ae' : '#7a5c38', post = md === 1 ? '#5c6166' : md === 2 ? '#a39c88' : '#53402a';
  const cx = X + w / 2, cy = Y + h / 2, ps = Math.max(2, w * 0.14), th = Math.max(1.5, h * 0.06);
  const n = (dx, dy) => { const nx = x + dx, ny = y + dy; if (!inb(m, nx, ny)) return false; const tt = m.tiles[MI(m, nx, ny)]; return tt === T.FENCE || TP[tt].wall; };
  const N = n(0, -1), S = n(0, 1), Wn = n(-1, 0), E = n(1, 0);
  const heights = md === 1 ? [hzF] : [hzF * 0.35, hzF * 0.8];
  const span = (x0, x1) => {
    if (md === 1) { c.fillStyle = 'rgba(150,160,165,0.22)'; c.fillRect(x0, cy - hzF, x1 - x0, hzF); }
    c.fillStyle = F(rail);
    for (const z of heights) c.fillRect(x0, cy - z - th / 2, x1 - x0, th);
  };
  const vspan = (y0, y1) => {
    if (md === 1) { c.fillStyle = 'rgba(150,160,165,0.3)'; c.fillRect(cx - 1, y0 - hzF, 2, y1 - y0); }
    c.fillStyle = F(rail);
    for (const z of heights) c.fillRect(cx - th / 2, y0 - z, th, y1 - y0);
  };
  if (N) vspan(Y, cy);
  if (Wn) span(X, cx);
  if (E) span(cx, X + w);
  if (!N && !S && !Wn && !E) span(X + w * 0.15, X + w * 0.85);
  box3(c, cx - ps / 2, cy - ps / 2, ps, ps, hzF * 1.08, shade(post, 1.2), post);
  if (S) vspan(cy, Y + h);
}
function drawTree3(c, x, y, X, Y, w, h, ts, cut) {
  const cx = X + w / 2, cy = Y + h * 0.62, hv = hash2(x, y, 9), sz = 0.85 + hv * 0.35;
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath(); c.ellipse(cx + ts * 0.35, cy + ts * 0.05, ts * 0.55 * sz, ts * 0.24 * sz, 0, 0, Math.PI * 2); c.fill();
  box3(c, cx - ts * 0.07, cy - ts * 0.05, ts * 0.14, ts * 0.1, ts * 0.62 * sz, '#5a4128', '#3e2c1a');
  if (cut) c.globalAlpha = 0.35;
  const ky = cy - ts * 0.98 * sz, r = ts * 0.58 * sz;
  c.fillStyle = F(hv < 0.5 ? '#1f3018' : '#26361b'); circ(c, cx, ky, r); c.fill();
  c.fillStyle = F(hv < 0.5 ? '#2b4320' : '#334722'); circ(c, cx - r * 0.18, ky - r * 0.18, r * 0.72); c.fill();
  c.fillStyle = F(hv < 0.5 ? '#3a5a2a' : '#45612e'); circ(c, cx - r * 0.38, ky - r * 0.38, r * 0.34); c.fill();
  c.globalAlpha = 1;
}
function drawBush3(c, x, y, X, Y, w, h, ts, occupied) {
  const cx = X + w / 2, cy = Y + h * 0.66, hv = hash2(x, y, 4);
  if (occupied) c.globalAlpha = 0.78;
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx + ts * 0.08, cy + ts * 0.06, ts * 0.42, ts * 0.16, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = F('#253820'); circ(c, cx - ts * 0.16, cy - ts * 0.16, ts * 0.27); c.fill(); circ(c, cx + ts * 0.17, cy - ts * 0.14, ts * 0.26); c.fill();
  c.fillStyle = F('#2f4627'); circ(c, cx, cy - ts * 0.26, ts * 0.3); c.fill();
  c.fillStyle = F(hv < 0.5 ? '#41603a' : '#4a6534'); circ(c, cx - ts * 0.09, cy - ts * 0.36, ts * 0.13); c.fill();
  c.globalAlpha = 1;
}
function drawCrop3(c, m, x, y, i, X, Y, w, h, ts, lod) {
  const corn = m.meta[i] === 1;
  const Hs = ts * (corn ? 0.6 : 0.32), dk = corn ? '#46622a' : '#9c8638', lt = corn ? '#6f8f3a' : '#d4b95c';
  const cols = corn ? 3 : 4, sw = Math.max(1.5, w * (corn ? 0.07 : 0.05));
  for (let r = 0; r < 2; r++) {
    const by = Y + h * (0.36 + r * 0.46);
    for (let k = 0; k < cols; k++) {
      const sx = X + w * ((k + 0.5) / cols) + (hash2(x * 4 + k, y * 2 + r, 6) - 0.5) * w * 0.12;
      const hh = Hs * (0.82 + hash2(x + k, y + r, 7) * 0.3);
      c.fillStyle = F(dk); c.fillRect(sx - sw / 2, by - hh, sw, hh);
      if (corn) {
        c.fillStyle = F(lt);
        c.fillRect(sx - sw * 3, by - hh * 0.5, sw * 2.8, sw * 1.1); c.fillRect(sx + sw * 0.3, by - hh * 0.74, sw * 2.8, sw * 1.1);
        if (lod === 2) c.fillRect(sx - sw * 2.6, by - hh * 0.92, sw * 2.4, sw);
        c.fillStyle = F('#c8b464'); c.fillRect(sx - sw / 2, by - hh - sw * 1.4, sw, sw * 1.6);
      } else { c.fillStyle = F(lt); c.beginPath(); c.ellipse(sx, by - hh, sw * 1.2, sw * 2.4, 0, 0, Math.PI * 2); c.fill(); }
    }
  }
}

// ----- мебель и прочие объекты в клетке -----
function drawObj3(c, m, x, y, i, X, Y, w, h, ts, lod, cut) {
  const t = m.tiles[i], hz = ts * WALL_H, H = k => ts * k;
  if (TP[t].wall) { if (cut) c.globalAlpha = 0.4; drawWall3(c, m, x, y, t, X, Y, w, h, hz, lod); c.globalAlpha = 1; return; }
  if (isDoorT(t)) { if (cut) c.globalAlpha = 0.4; drawDoor3(c, m, x, y, t, i, X, Y, w, h, hz, lod); c.globalAlpha = 1; return; }
  const ct = m.cont[i], hasLoot = ct && Object.keys(ct.loot).length > 0;
  switch (t) {
    case T.FENCE: drawFence3(c, m, x, y, i, X, Y, w, h, ts); break;
    case T.TREE: drawTree3(c, x, y, X, Y, w, h, ts, cut); break;
    case T.HAY:
      box3(c, X + w * 0.06, Y + h * 0.12, w * 0.88, h * 0.76, H(0.42), '#c4aa62', '#9c8442');
      c.fillStyle = F('#7d6a35'); c.fillRect(X + w * 0.3, Y + h * 0.12 - H(0.42), Math.max(1, w * 0.04), h * 0.76); c.fillRect(X + w * 0.66, Y + h * 0.12 - H(0.42), Math.max(1, w * 0.04), h * 0.76);
      break;
    case T.CRATE: {
      const bx = X + w * 0.12, by = Y + h * 0.18, bw = w * 0.76, bd = h * 0.64, hh = H(0.42);
      box3(c, bx, by, bw, bd, hh, '#8f6d43', '#6a4c2a');
      if (lod === 2) {
        c.strokeStyle = F('#5a3f22'); c.lineWidth = Math.max(1, w * 0.04);
        c.beginPath(); c.moveTo(bx, by - hh); c.lineTo(bx + bw, by + bd - hh); c.moveTo(bx + bw, by - hh); c.lineTo(bx, by + bd - hh);
        c.moveTo(bx, by + bd - hh * 0.5); c.lineTo(bx + bw, by + bd - hh * 0.5); c.stroke();
      }
      break;
    }
    case T.SHELF: {
      const bx = X + w * 0.05, by = Y + h * 0.3, bw = w * 0.9, bd = h * 0.4, hh = H(0.74);
      box3(c, bx, by, bw, bd, hh, '#6e7378', '#3e4246');
      c.fillStyle = F('#5d6266');
      for (let k = 1; k < 4; k++) c.fillRect(bx, by + bd - (hh * k) / 4, bw, Math.max(1, hh * 0.05));
      if (hasLoot && lod === 2) {
        c.fillStyle = F('#a8794a'); c.fillRect(bx + bw * 0.12, by + bd - hh * 0.47, bw * 0.22, hh * 0.18);
        c.fillStyle = F('#7a8f5a'); c.fillRect(bx + bw * 0.55, by + bd - hh * 0.72, bw * 0.25, hh * 0.19);
        c.fillStyle = F('#c9c3b2'); c.fillRect(bx + bw * 0.4, by + bd - hh * 0.22, bw * 0.18, hh * 0.17);
      }
      break;
    }
    case T.LOCKER: {
      const bx = X + w * 0.16, by = Y + h * 0.24, bw = w * 0.68, bd = h * 0.5, hh = H(0.8);
      box3(c, bx, by, bw, bd, hh, '#647889', '#4a5c6c');
      c.fillStyle = F('#34424e'); c.fillRect(bx + bw / 2 - 0.5, by + bd - hh, 1, hh);
      if (lod === 2) for (let k = 0; k < 3; k++) { c.fillRect(bx + bw * 0.12, by + bd - hh * (0.85 - k * 0.07), bw * 0.25, 1); c.fillRect(bx + bw * 0.62, by + bd - hh * (0.85 - k * 0.07), bw * 0.25, 1); }
      break;
    }
    case T.FRIDGE: {
      const bx = X + w * 0.16, by = Y + h * 0.2, bw = w * 0.68, bd = h * 0.56, hh = H(0.76);
      box3(c, bx, by, bw, bd, hh, '#e2e0d4', '#c4c2b6');
      c.fillStyle = F('#8e8c82'); c.fillRect(bx, by + bd - hh * 0.62, bw, 1); c.fillRect(bx + bw * 0.78, by + bd - hh * 0.9, Math.max(1, bw * 0.06), hh * 0.22);
      break;
    }
    case T.DESK: {
      const bx = X + w * 0.06, by = Y + h * 0.2, bw = w * 0.88, bd = h * 0.6, hh = H(0.34);
      box3(c, bx, by, bw, bd, hh, '#8a6946', '#5a4028');
      if (lod === 2) { c.fillStyle = F('#ddd6c2'); c.fillRect(bx + bw * 0.15, by - hh + bd * 0.2, bw * 0.28, bd * 0.4); c.fillStyle = F('#3b3a36'); c.fillRect(bx + bw * 0.55, by - hh + bd * 0.15, bw * 0.3, bd * 0.3); }
      break;
    }
    case T.DRUM:
      cyl3(c, X + w / 2, Y + h * 0.62, w * 0.32, h * 0.15, H(0.5), '#a85a3c', '#7a3a24');
      c.fillStyle = F('#5c2a1a'); c.fillRect(X + w * 0.18, Y + h * 0.62 - H(0.18), w * 0.64, Math.max(1, h * 0.04)); c.fillRect(X + w * 0.18, Y + h * 0.62 - H(0.36), w * 0.64, Math.max(1, h * 0.04));
      break;
    case T.WELL:
      cyl3(c, X + w / 2, Y + h * 0.62, w * 0.42, h * 0.2, H(0.28), '#8c897e', '#6a675e');
      c.fillStyle = F('#18242a'); c.beginPath(); c.ellipse(X + w / 2, Y + h * 0.62 - H(0.28), w * 0.28, h * 0.12, 0, 0, Math.PI * 2); c.fill();
      box3(c, X + w * 0.1, Y + h * 0.58, w * 0.05, h * 0.05, H(0.75), '#6a4c2c', '#4c341c');
      box3(c, X + w * 0.85, Y + h * 0.58, w * 0.05, h * 0.05, H(0.75), '#6a4c2c', '#4c341c');
      c.fillStyle = F('#6a4c2c'); c.fillRect(X + w * 0.1, Y + h * 0.58 - H(0.75), w * 0.8, Math.max(1, h * 0.05));
      break;
    case T.MEDCAB: {
      const bx = X + w * 0.14, by = Y + h * 0.26, bw = w * 0.72, bd = h * 0.48, hh = H(0.56);
      box3(c, bx, by, bw, bd, hh, '#e6e2d6', '#cbc6b9');
      const fx = bx + bw / 2, fy = by + bd - hh / 2;
      c.fillStyle = F('#c4402f'); c.fillRect(fx - bw * 0.07, fy - hh * 0.28, bw * 0.14, hh * 0.56); c.fillRect(fx - bw * 0.22, fy - hh * 0.08, bw * 0.44, hh * 0.16);
      break;
    }
    case T.BENCH: {
      const bx = X + w * 0.05, by = Y + h * 0.2, bw = w * 0.9, bd = h * 0.6, hh = H(0.36);
      box3(c, bx, by, bw, bd, hh, '#7d7768', '#555044');
      if (lod === 2) { c.fillStyle = F('#b9b19a'); c.fillRect(bx + bw * 0.15, by - hh + bd * 0.35, bw * 0.35, bd * 0.12); c.fillStyle = F('#c4402f'); c.fillRect(bx + bw * 0.6, by - hh + bd * 0.2, bw * 0.16, bd * 0.4); }
      break;
    }
    case T.FURN: {
      const v = m.meta[i];
      if (v === 0) {
        box3(c, X + w * 0.1, Y + h * 0.04, w * 0.8, h * 0.9, H(0.2), '#5c6170', '#3c404c');
        box3(c, X + w * 0.16, Y + h * 0.08, w * 0.68, h * 0.22, H(0.08), '#d6d0bf', '#b0aa98', H(0.2));
      } else if (v === 1) {
        cyl3(c, X + w / 2, Y + h * 0.6, w * 0.38, h * 0.2, H(0.3), '#8a6946', '#5a4028');
      } else if (v === 2) {
        box3(c, X + w * 0.06, Y + h * 0.18, w * 0.88, h * 0.24, H(0.42), '#7a6488', '#4e3e5a');
        box3(c, X + w * 0.06, Y + h * 0.42, w * 0.88, h * 0.42, H(0.22), '#7a6488', '#5a4868');
      } else box3(c, X + w * 0.06, Y + h * 0.36, w * 0.88, h * 0.3, H(0.2), '#7a5b3a', '#4f3a22');
      break;
    }
  }
}

// ----- техника и постройки на несколько клеток -----
function drawProp3(c, p, X, Y, W, Hh, ts, lod) {
  const u = ts, v = p.v, f = p.f;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(X + u * 0.18, Y + u * 0.2, W - u * 0.1, Hh - u * 0.1);
  switch (p.k) {
    case 'car': case 'ambulance': {
      const amb = p.k === 'ambulance', body = amb ? '#e2ded2' : p.c, bh = u * (amb ? 0.46 : 0.3);
      const bx = X + u * 0.08, by = Y + u * 0.1, bw = W - u * 0.16, bd = Hh - u * 0.2;
      // колёса
      c.fillStyle = F('#151412');
      if (v) { for (const yy of [by + bd * 0.12, by + bd * 0.7]) { c.fillRect(bx - u * 0.05, yy - u * 0.12, u * 0.12, bd * 0.18); c.fillRect(bx + bw - u * 0.07, yy - u * 0.12, u * 0.12, bd * 0.18); } }
      else { for (const xx of [bx + bw * 0.12, bx + bw * 0.72]) c.fillRect(xx, by + bd - u * 0.14, bw * 0.16, u * 0.16); }
      box3(c, bx, by, bw, bd, bh, shade(body, 1.08), shade(body, 0.72));
      // кабина
      let cx0, cy0, cw, cd;
      if (amb) {
        if (v) { cx0 = bx + bw * 0.1; cw = bw * 0.8; cd = bd * 0.22; cy0 = f ? by + bd - cd - bd * 0.04 : by + bd * 0.04; }
        else { cy0 = by + bd * 0.12; cd = bd * 0.76; cw = bw * 0.22; cx0 = f ? bx + bw * 0.04 : bx + bw - cw - bw * 0.04; }
        box3(c, cx0, cy0, cw, cd, u * 0.12, '#cfcabd', '#86a3b5', bh);
        c.fillStyle = F('#c4402f');
        c.fillRect(bx, by + bd - bh * 0.55, bw, bh * 0.16);
        const rx = bx + bw / 2, ry = by + bd / 2 - bh;
        c.fillRect(rx - u * 0.06, ry - u * 0.2, u * 0.12, u * 0.4); c.fillRect(rx - u * 0.2, ry - u * 0.06, u * 0.4, u * 0.12);
      } else {
        if (v) { cx0 = bx + bw * 0.12; cw = bw * 0.76; cd = bd * 0.42; cy0 = by + bd * 0.3; }
        else { cy0 = by + bd * 0.1; cd = bd * 0.8; cw = bw * 0.42; cx0 = bx + bw * 0.3; }
        box3(c, cx0, cy0, cw, cd, u * 0.24, shade(body, 0.9), '#7e9fb1', bh);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(cx0 + cw * 0.1, cy0 + cd - bh - u * 0.2, cw * 0.25, Math.max(1, u * 0.04));
      }
      if (p.start) {
        c.strokeStyle = '#a0c86e'; c.lineWidth = Math.max(1.5, u * 0.05);
        c.strokeRect(bx - u * 0.04, by - bh - u * 0.04, bw + u * 0.08, bd + bh + u * 0.08);
        if (lod > 0) {
          c.font = `600 ${clamp(u * 0.36, 10, 16)}px Oswald, "Arial Narrow", sans-serif`;
          c.textAlign = 'center'; c.textBaseline = 'bottom';
          c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText('ВЫХОД', bx + bw / 2, by - bh - u * 0.45);
          c.fillStyle = '#a0c86e'; c.fillText('ВЫХОД', bx + bw / 2, by - bh - u * 0.45);
        }
      }
      break;
    }
    case 'truck': {
      const cabFirst = !f;
      const bx = X + u * 0.08, by = Y + u * 0.08, bw = W - u * 0.16, bd = Hh - u * 0.16;
      if (v) {
        const cab = bd * 0.3;
        const cabY = cabFirst ? by : by + bd - cab, carY = cabFirst ? by + cab + u * 0.06 : by;
        const parts = [[bx + bw * 0.06, cabY, bw * 0.88, cab, u * 0.5, shade(p.c, 1.1), shade(p.c, 0.75)], [bx, carY, bw, bd - cab - u * 0.06, u * 0.85, '#94918a', '#6f6c64']];
        parts.sort((a, b) => a[1] - b[1]);
        for (const q of parts) box3(c, ...q);
      } else {
        const cab = bw * 0.3, cabX = cabFirst ? bx : bx + bw - cab, carX = cabFirst ? bx + cab + u * 0.06 : bx;
        box3(c, carX, by, bw - cab - u * 0.06, bd, u * 0.85, '#94918a', '#6f6c64');
        box3(c, cabX, by + bd * 0.06, cab, bd * 0.88, u * 0.5, shade(p.c, 1.1), shade(p.c, 0.75));
        c.fillStyle = F('#7e9fb1'); c.fillRect(cabX + cab * 0.15, by + bd - u * 0.42, cab * 0.7, u * 0.16);
      }
      break;
    }
    case 'tractor': {
      const cx = X + W / 2;
      c.fillStyle = F('#161411');
      c.fillRect(X - u * 0.04, Y + Hh * 0.55 - u * 0.3, W * 0.26, Hh * 0.42); c.fillRect(X + W * 0.78, Y + Hh * 0.55 - u * 0.3, W * 0.26, Hh * 0.42);
      box3(c, X + W * 0.2, Y + u * 0.1, W * 0.6, Hh - u * 0.2, u * 0.42, shade(p.c, 1.1), shade(p.c, 0.75));
      box3(c, cx - W * 0.22, Y + Hh * 0.5, W * 0.44, Hh * 0.35, u * 0.45, '#7a8a80', '#86a3b5', u * 0.42);
      c.fillStyle = F('#161411'); c.fillRect(X + W * 0.06, Y + Hh * 0.1 - u * 0.1, W * 0.16, Hh * 0.22); c.fillRect(X + W * 0.78, Y + Hh * 0.1 - u * 0.1, W * 0.16, Hh * 0.22);
      break;
    }
    case 'machine': {
      const hh = u * (p.tall ? 0.95 : 0.55);
      box3(c, X + u * 0.06, Y + u * 0.08, W - u * 0.12, Hh - u * 0.16, hh, shade(p.c, 1.12), shade(p.c, 0.72));
      const fy = Y + Hh - u * 0.08;
      for (let k = 0; k * u * 0.25 < W - u * 0.3; k++) { c.fillStyle = F(k & 1 ? '#1b1a16' : '#d9a62b'); c.fillRect(X + u * 0.06 + k * u * 0.25, fy - u * 0.14, u * 0.25, u * 0.1); }
      box3(c, X + W * 0.55, Y + Hh * 0.3, W * 0.3, Hh * 0.35, u * 0.18, '#2a2d2e', '#1c1e1f', hh);
      if (lod === 2) { c.fillStyle = F('#c4402f'); c.fillRect(X + W * 0.62, Y + Hh * 0.38 - hh - u * 0.18, u * 0.08, u * 0.08); c.fillStyle = F('#7fb08a'); c.fillRect(X + W * 0.72, Y + Hh * 0.38 - hh - u * 0.18, u * 0.08, u * 0.08); }
      break;
    }
    case 'silo': {
      const cx = X + W / 2, cy = Y + Hh * 0.62, rx = W * 0.46, ry = Hh * 0.22, hh = u * 1.9;
      cyl3(c, cx, cy, rx, ry, hh, '#a4a6a1', '#7f817c');
      c.fillStyle = F('#6a6c67');
      for (let k = 1; k < 5; k++) c.fillRect(cx - rx, cy - (hh * k) / 5, rx * 2, Math.max(1, u * 0.04));
      c.fillStyle = F('#b4b6b1'); c.beginPath(); c.ellipse(cx, cy - hh - ry * 0.3, rx * 0.8, ry * 1.1, 0, Math.PI, 0); c.fill();
      break;
    }
    case 'tank': {
      const bx = X + u * 0.08, by = Y + u * 0.2, bw = W - u * 0.16, bd = Hh - u * 0.4, hh = u * 0.75;
      box3(c, bx, by, bw, bd, hh, '#b6b3a8', '#8e8b81');
      c.fillStyle = F('#77746a');
      for (let k = 1; k < 4; k++) { const xx = bx + (bw * k) / 4; c.fillRect(xx, by - hh, Math.max(1, u * 0.06), bd + hh); }
      c.fillStyle = F('#c4402f'); c.fillRect(bx + bw * 0.08, by + bd - hh * 0.6, bw * 0.12, hh * 0.25);
      break;
    }
  }
}

// ----- карта целиком -----
const PROW = new WeakMap();
function propsByRow(m) {
  let r = PROW.get(m);
  if (!r) { r = new Map(); for (const p of m.props) { const k = p.y + p.h - 1; if (!r.has(k)) r.set(k, []); r.get(k).push(p); } PROW.set(m, r); }
  return r;
}
function drawMap3(c, m, cam, W, H, now, all) {
  const ts = cam.ts, lod = ts < 20 ? 1 : 2;
  const x0 = Math.max(0, Math.floor(cam.x) - 1), x1 = Math.min(m.w - 1, Math.ceil(cam.x + W / ts) + 1);
  const y0 = Math.max(0, Math.floor(cam.y)), y1 = Math.min(m.h - 1, Math.ceil(cam.y + H / ts)), yB = Math.min(m.h - 1, y1 + 3);
  const SX = x => Math.round((x - cam.x) * ts), SY = y => Math.round((y - cam.y) * ts);
  const seen = i => all || m.seen[i], vis = i => all || m.vis[i];

  // A. земля
  for (let y = y0; y <= yB; y++) {
    const Y = SY(y), h = SY(y + 1) - Y;
    for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x;
      if (!seen(i)) continue;
      const X = SX(x), w = SX(x + 1) - X;
      drawGround(c, m, m.ground[i], x, y, i, X, Y, w, h, lod);
    }
  }
  // B. следы
  for (const d of m.decals) {
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > yB || !seen(MI(m, d.x, d.y))) continue;
    const X = SX(d.x) + ts / 2, Y = SY(d.y) + ts * 0.62;
    c.fillStyle = 'rgba(70,20,14,0.55)';
    c.beginPath(); c.ellipse(X + (d.r - 0.5) * ts * 0.3, Y, ts * 0.42, ts * 0.22, d.r * 3, 0, Math.PI * 2); c.fill();
    if (d.k === 'corpse') { c.fillStyle = '#3e4433'; c.beginPath(); c.ellipse(X, Y - ts * 0.04, ts * 0.32, ts * 0.15, d.r * 0.6 - 0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#4d5540'; circ(c, X - ts * 0.22, Y - ts * 0.08, ts * 0.1); c.fill(); }
  }
  // C. туман на земле
  if (!all) for (let y = y0; y <= yB; y++) {
    const Y = SY(y), h = SY(y + 1) - Y;
    for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x;
      if (m.vis[i]) continue;
      const X = SX(x), w = SX(x + 1) - X;
      c.fillStyle = m.seen[i] ? 'rgba(9,8,6,0.6)' : '#0b0a08';
      c.fillRect(X, Y, w, h);
    }
  }
  // D. разметка на земле: эвакуация, доступные клетки, путь
  if (!all) drawGroundMarks(c, m, cam, ts, x0, x1, y0, yB, SX, SY);

  // E. ряды: объекты → фигуры → низкая растительность
  const rows = new Map();
  const cutW = new Set(), cutT = new Set(), occ = new Set();
  if (!all) {
    for (const z of m.zombies) {
      if (!m.vis[MI(m, z.x, z.y)] && !(z.anim && z.anim.k === 'mv' && m.vis[MI(m, Math.round(z.anim.fx), Math.round(z.anim.fy))])) continue;
      const [px, py] = animPos(z, now);
      if (px < x0 - 1 || px > x1 + 1 || py < y0 - 2 || py > yB) continue;
      const r = Math.round(py);
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r).push({ e: z, z: true, px, py });
    }
    for (const un of m.units) {
      if (un.dead || un.evac) continue;
      const [px, py] = animPos(un, now), r = Math.round(py);
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r).push({ e: un, z: false, px, py });
    }
    for (const list of rows.values()) for (const it of list) {
      const ex = Math.round(it.px), ey = Math.round(it.py);
      occ.add(MI(m, ex, ey));
      for (let dx = -1; dx <= 1; dx++) {
        if (inb(m, ex + dx, ey + 1)) cutW.add(MI(m, ex + dx, ey + 1));
        if (inb(m, ex + dx, ey + 1)) cutT.add(MI(m, ex + dx, ey + 1));
        if (inb(m, ex + dx, ey + 2)) cutT.add(MI(m, ex + dx, ey + 2));
      }
    }
  }
  const pRows = propsByRow(m), pd = TAC.pend, ents = [];
  const tgt = !all && pd && pd.tx != null ? MI(m, pd.tx, pd.ty) : -1;
  R.hits = [];
  for (let y = y0; y <= yB; y++) {
    const Y = SY(y), h = SY(y + 1) - Y;
    for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x, t = m.tiles[i];
      if (!seen(i) || TP[t].floor || t === T.CROP || t === T.BUSH || t === T.BLOCK || t === T.BLOCKH) continue;
      const X = SX(x), w = SX(x + 1) - X;
      DIM = vis(i) ? 1 : 0.45;
      const ct = m.cont[i];
      if (ct && ct.s && !Object.keys(ct.loot).length) DIM *= 0.72;
      drawObj3(c, m, x, y, i, X, Y, w, h, ts, lod, t === T.TREE ? cutT.has(i) : cutW.has(i));
    }
    const pl = pRows.get(y);
    if (pl) for (const p of pl) {
      if (p.x + p.w < x0 || p.x > x1 + 1) continue;
      let anySeen = all, anyVis = all;
      for (let yy = p.y; yy < p.y + p.h; yy++) for (let xx = p.x; xx < p.x + p.w; xx++) { const j = MI(m, xx, yy); if (m.seen[j]) anySeen = true; if (m.vis[j]) anyVis = true; }
      if (!anySeen) continue;
      DIM = anyVis ? 1 : 0.45;
      drawProp3(c, p, SX(p.x), SY(p.y), SX(p.x + p.w) - SX(p.x), SY(p.y + p.h) - SY(p.y), ts, lod);
    }
    DIM = 1;
    const list = rows.get(y);
    if (list) {
      list.sort((a, b) => a.px - b.px);
      for (const it of list) {
        drawFigure(c, m, it, cam, ts, now, tgt);
        ents.push(it);
      }
    }
    for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x, t = m.tiles[i];
      if ((t !== T.CROP && t !== T.BUSH) || !seen(i)) continue;
      const X = SX(x), w = SX(x + 1) - X;
      DIM = vis(i) ? 1 : 0.45;
      if (t === T.CROP) drawCrop3(c, m, x, y, i, X, Y, w, h, ts, lod);
      else drawBush3(c, x, y, X, Y, w, h, ts, occ.has(i));
    }
    DIM = 1;
  }
  // F. сумерки и ночь
  const tod = all ? 0 : timeOfDay(m);
  if (tod) { c.fillStyle = tod === 1 ? 'rgba(40,24,60,0.16)' : 'rgba(8,14,44,0.32)'; c.fillRect(-10, -10, W + 20, H + 20); }
  // G. метки добычи над предметами
  for (const k in m.cont) {
    const i = +k, x = i % m.w, y = (i / m.w) | 0;
    if (x < x0 || x > x1 || y < y0 || y > yB || !seen(i)) continue;
    const ct = m.cont[k], has = Object.keys(ct.loot).length > 0;
    if (ct.s && !has) continue;
    const oh = OBJ_H[m.tiles[i]] ?? 0.4;
    const X = SX(x) + ts * 0.5, Y = SY(y) + ts * 0.4 - oh * ts - ts * 0.14, s = Math.max(3, ts * 0.11);
    c.beginPath(); c.moveTo(X, Y - s); c.lineTo(X + s, Y); c.lineTo(X, Y + s); c.lineTo(X - s, Y); c.closePath();
    if (!ct.s) { c.fillStyle = '#e8a62b'; c.fill(); c.strokeStyle = '#1b1406'; c.lineWidth = 1; c.stroke(); }
    else { c.strokeStyle = '#e8a62b'; c.lineWidth = 1.5; c.stroke(); }
  }
  if (all) return;
  for (const it of ents) drawBadges(c, it, ts, lod);
  drawFX(c, cam, ts, now);
}
function drawFigure(c, m, it, cam, ts, now, tgt) {
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
  const L = Spr.look(it.e, it.z ? 'z' : 'h');
  it.top = Spr.draw(c, L, frameOf(it.e, now), it.e.f ?? 2, it.cx, it.fy, ts);
  R.hits.push({ e: it.e, z: it.z, x0: it.cx - ts * 0.34, x1: it.cx + ts * 0.34, y0: it.top, y1: it.fy + ts * 0.1 });
}
