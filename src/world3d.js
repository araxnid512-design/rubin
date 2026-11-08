'use strict';
// ---------- Изометрический мир 2.5D: проекция, призмы, тени, свет ----------
// Камера смотрит по диагонали и поворачивается шагами по 90°. Земля рисуется
// аффинным преобразованием клеток, объёмные предметы — призмами и цилиндрами,
// всё по «диагональным рядам» от дальних к ближним, чтобы перекрытия были верными.

const ISO_F = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a / Math.SQRT2, b / Math.SQRT2]);
const WALL_Z = 1.25, WALL_LOW = 0.3, WALL_T = 0.34;
const SHD = [0.72, 0.16];          // смещение тени на экране на единицу высоты (× масштаб)
let CB = null, PX = 0, PY = 0;    // базис камеры текущего кадра и результат проекции
let DIM = 1, MODE = 0, SCX = null; // затемнение тумана; 0 — рисовать, 1 — тени

function setCB(cam, W, H, sx = 0, sy = 0) {
  const f = ISO_F[cam.rot];
  CB = {
    fx: f[0], fy: f[1], rx: -f[1], ry: f[0], k: cam.k, cx: cam.cx, cy: cam.cy,
    ox: W / 2 + sx, oy: H / 2 + sy, sE: VX.sE, cE: VX.cE, gx: Math.sign(f[0]), gy: Math.sign(f[1]), W, H,
  };
}
function P(x, y, z) {
  const dx = x - CB.cx, dy = y - CB.cy;
  PX = CB.ox + (dx * CB.rx + dy * CB.ry) * CB.k;
  PY = CB.oy - (dx * CB.fx + dy * CB.fy) * CB.k * CB.sE - z * CB.k * CB.cE;
}
function unP(sx, sy) {
  const a = (sx - CB.ox) / CB.k, b = -(sy - CB.oy) / (CB.k * CB.sE);
  return [CB.cx + a * CB.rx + b * CB.fx, CB.cy + a * CB.ry + b * CB.fy];
}
const nearKey = (x, y) => -(CB.gx * x + CB.gy * y);
const nearF = (x, y) => -(CB.fx * x + CB.fy * y);
// Направление спрайта для взгляда в мире (индекс 0..7) с учётом поворота камеры
function spriteDir(f) {
  const a = (f * Math.PI) / 4, wx = Math.cos(a), wy = Math.sin(a);
  return dirIdx(wx * CB.rx + wy * CB.ry, -(wx * CB.fx + wy * CB.fy));
}

// ----- цвета -----
const _sc = new Map();
function sh(col, f) {
  const q = Math.round(f * DIM * 100), key = col + q;
  let v = _sc.get(key);
  if (v === undefined) { v = shade(col, q / 100); if (_sc.size > 8000) _sc.clear(); _sc.set(key, v); }
  return v;
}

// ----- примитивы -----
function hullFill(pts) {
  const n = pts.length / 2, idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  idx.sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const cross = (o, a, b) => (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
  const lo = [], up = [];
  for (const i of idx) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop(); lo.push(i); }
  for (let j = idx.length - 1; j >= 0; j--) { const i = idx[j]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], i) <= 0) up.pop(); up.push(i); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1));
  if (h.length < 3) return;
  SCX.beginPath(); SCX.moveTo(pts[h[0] * 2], pts[h[0] * 2 + 1]);
  for (let k = 1; k < h.length; k++) SCX.lineTo(pts[h[k] * 2], pts[h[k] * 2 + 1]);
  SCX.closePath(); SCX.fill();
}
function quad(c, ax, ay, bx, by, cx, cy, dx, dy) { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx, cy); c.lineTo(dx, dy); c.closePath(); c.fill(); }
const FACES = [[0, 1, 0, 1, 1, 1], [0, -1, 1, 0, 0, 0], [1, 0, 1, 1, 1, 0], [-1, 0, 0, 0, 0, 1]]; // нормаль, углы двух нижних точек
// Призма: основание [x0..x1]×[y0..y1] в клетках, высота z0..z1
function pBox(c, x0, y0, x1, y1, z0, z1, col, det, topCol) {
  if (MODE === 1) {
    const sx = SHD[0] * CB.k, sy = SHD[1] * CB.k, pts = [];
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { P(x, y, 0); pts.push(PX + z0 * sx, PY + z0 * sy, PX + z1 * sx, PY + z1 * sy); }
    hullFill(pts);
    return;
  }
  const xs = [x0, x1], ys = [y0, y1];
  for (const F of FACES) {
    if (F[0] * CB.fx + F[1] * CB.fy >= -1e-6) continue;
    const lit = F[0] * CB.rx + F[1] * CB.ry < 0;
    const ax = xs[F[2]], ay = ys[F[3]], bx = xs[F[4]], by = ys[F[5]];
    P(ax, ay, z0); const p1x = PX, p1y = PY; P(bx, by, z0); const p2x = PX, p2y = PY;
    P(bx, by, z1); const p3x = PX, p3y = PY; P(ax, ay, z1); const p4x = PX, p4y = PY;
    c.fillStyle = sh(col, lit ? 0.9 : 0.64);
    quad(c, p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y);
    if (det && CB.k >= 26) faceDetail(c, det, ax, ay, bx, by, z0, z1, lit);
  }
  c.fillStyle = sh(topCol || col, 1.04);
  P(x0, y0, z1); const ax = PX, ay = PY; P(x1, y0, z1); const bx = PX, by = PY;
  P(x1, y1, z1); const cx = PX, cy = PY; P(x0, y1, z1);
  quad(c, ax, ay, bx, by, cx, cy, PX, PY);
}
function faceDetail(c, det, ax, ay, bx, by, z0, z1, lit) {
  c.strokeStyle = lit ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.2)';
  c.lineWidth = 1;
  c.beginPath();
  const H = z1 - z0;
  if (det === 'brick') {
    for (let k = 1; k < 6; k++) { const z = z0 + (H * k) / 6; P(ax, ay, z); c.moveTo(PX, PY); P(bx, by, z); c.lineTo(PX, PY); }
    for (let k = 0; k < 6; k++) {
      const t = k % 2 ? 0.33 : 0.72, z = z0 + (H * k) / 6;
      P(ax + (bx - ax) * t, ay + (by - ay) * t, z); c.moveTo(PX, PY); P(ax + (bx - ax) * t, ay + (by - ay) * t, z + H / 6); c.lineTo(PX, PY);
    }
  } else if (det === 'plank') {
    for (let k = 1; k < 4; k++) { const t = k / 4; P(ax + (bx - ax) * t, ay + (by - ay) * t, z0); c.moveTo(PX, PY); P(ax + (bx - ax) * t, ay + (by - ay) * t, z1); c.lineTo(PX, PY); }
  } else if (det === 'panel') {
    const z = z0 + H * 0.5; P(ax, ay, z); c.moveTo(PX, PY); P(bx, by, z); c.lineTo(PX, PY);
  }
  c.stroke();
  P(ax, ay, z0 + 0.04); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.moveTo(PX, PY); P(bx, by, z0 + 0.04); c.lineTo(PX, PY); c.stroke();
}
function pCyl(c, x, y, r, z0, z1, col, rings) {
  if (MODE === 1) {
    const sx = SHD[0] * CB.k, sy = SHD[1] * CB.k, pts = [];
    for (let a = 0; a < 8; a++) { P(x + Math.cos(a * 0.785) * r, y + Math.sin(a * 0.785) * r, 0); pts.push(PX + z0 * sx, PY + z0 * sy, PX + z1 * sx, PY + z1 * sy); }
    hullFill(pts);
    return;
  }
  P(x, y, z0); const bx = PX, by = PY; P(x, y, z1); const tx = PX, ty = PY;
  const rx = r * CB.k, ry = r * CB.k * CB.sE;
  const gr = c.createLinearGradient(bx - rx, 0, bx + rx, 0);
  gr.addColorStop(0, sh(col, 0.92)); gr.addColorStop(0.4, sh(col, 0.84)); gr.addColorStop(1, sh(col, 0.52));
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(tx - rx, ty); c.lineTo(bx - rx, by); c.ellipse(bx, by, rx, ry, 0, Math.PI, 0, true); c.lineTo(tx + rx, ty); c.closePath(); c.fill();
  if (rings && CB.k >= 20) {
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1;
    for (const z of rings) { P(x, y, z); c.beginPath(); c.ellipse(PX, PY, rx, ry, 0, 0, Math.PI); c.stroke(); }
  }
  c.fillStyle = sh(col, 1.05);
  c.beginPath(); c.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function pCone(c, x, y, r, z0, z1, col) {
  if (MODE === 1) {
    const sx = SHD[0] * CB.k, sy = SHD[1] * CB.k, pts = [];
    for (let a = 0; a < 8; a++) { P(x + Math.cos(a * 0.785) * r, y + Math.sin(a * 0.785) * r, 0); pts.push(PX + z0 * sx, PY + z0 * sy); }
    P(x, y, 0); pts.push(PX + z1 * sx, PY + z1 * sy);
    hullFill(pts);
    return;
  }
  P(x, y, z0); const bx = PX, by = PY; P(x, y, z1);
  const rx = r * CB.k, ry = r * CB.k * CB.sE;
  const gr = c.createLinearGradient(bx - rx, 0, bx + rx, 0);
  gr.addColorStop(0, sh(col, 1.0)); gr.addColorStop(1, sh(col, 0.58));
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(bx - rx, by); c.lineTo(PX, PY); c.lineTo(bx + rx, by); c.ellipse(bx, by, rx, ry, 0, 0, Math.PI); c.closePath(); c.fill();
}
function pBall(c, x, y, z, r, col) {
  P(x, y, z);
  const R0 = r * CB.k;
  if (MODE === 1) {
    const sx = SHD[0] * CB.k, sy = SHD[1] * CB.k; P(x, y, 0);
    SCX.beginPath(); SCX.ellipse(PX + z * sx, PY + z * sy, R0, R0 * CB.sE, 0, 0, Math.PI * 2); SCX.fill();
    return;
  }
  c.fillStyle = sh(col, 0.78); circ(c, PX, PY, R0); c.fill();
  c.fillStyle = sh(col, 0.98); circ(c, PX - R0 * 0.18, PY - R0 * 0.22, R0 * 0.68); c.fill();
  c.fillStyle = sh(col, 1.14); circ(c, PX - R0 * 0.36, PY - R0 * 0.42, R0 * 0.3); c.fill();
}

// Выпуклый многогранник: грани — списки вершин [x, y, z]
function pPoly(c, faces, col, ctr) {
  if (MODE === 1) {
    const sx = SHD[0] * CB.k, sy = SHD[1] * CB.k, pts = [];
    for (const f of faces) for (const v of f) { P(v[0], v[1], 0); pts.push(PX + v[2] * sx, PY + v[2] * sy); }
    hullFill(pts);
    return;
  }
  // знак площади «верхней» грани задаёт, какие грани смотрят на камеру
  P(0, 0, 0); const ox = PX, oy = PY; P(1, 0, 0); const ax = PX - ox, ay = PY - oy; P(0, 1, 0);
  const ref = Math.sign(ax * (PY - oy) - ay * (PX - ox));
  for (const f of faces) {
    const [a, b, d] = f;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let mx = 0, my = 0, mz = 0;
    for (const v of f) { mx += v[0]; my += v[1]; mz += v[2]; }
    mx /= f.length; my /= f.length; mz /= f.length;
    let flip = nx * (mx - ctr[0]) + ny * (my - ctr[1]) + nz * (mz - ctr[2]) < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const pts = [];
    for (const v of f) { P(v[0], v[1], v[2]); pts.push(PX, PY); }
    let area = 0;
    for (let i = 0; i < pts.length; i += 2) { const j = (i + 2) % pts.length; area += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; }
    if (Math.sign(area) * (flip ? -1 : 1) !== ref) continue;
    const L = Math.hypot(nx, ny, nz) || 1, h = Math.hypot(nx, ny) || 1;
    const side = (nx * -CB.rx + ny * -CB.ry) / h > 0 ? 0.9 : 0.64, up = Math.max(0, nz / L);
    c.fillStyle = sh(col, side + (1.04 - side) * up);
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }
}
// Двускатная крыша/палатка: стенки до z1, конёк на zr вдоль оси ax ('x' или 'y')
function ridgeFaces(x0, y0, x1, y1, z0, z1, zr, ax) {
  const F = [];
  if (ax === 'x') {
    const ym = (y0 + y1) / 2;
    if (z1 > z0) { F.push([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]); }
    F.push([[x0, y0, z1], [x1, y0, z1], [x1, ym, zr], [x0, ym, zr]], [[x0, y1, z1], [x1, y1, z1], [x1, ym, zr], [x0, ym, zr]]);
    F.push([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, ym, zr], [x0, y0, z1]], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, ym, zr], [x1, y0, z1]]);
  } else {
    const xm = (x0 + x1) / 2;
    if (z1 > z0) { F.push([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]); }
    F.push([[x0, y0, z1], [x0, y1, z1], [xm, y1, zr], [xm, y0, zr]], [[x1, y0, z1], [x1, y1, z1], [xm, y1, zr], [xm, y0, zr]]);
    F.push([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [xm, y0, zr], [x0, y0, z1]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [xm, y1, zr], [x0, y1, z1]]);
  }
  return F;
}
// Костёр: камни, поленья и живое пламя
function pFire(c, x, y, lit = true) {
  for (let a = 0; a < 7; a++) { const q = (a / 7) * Math.PI * 2; pBox(c, x + Math.cos(q) * 0.3 - 0.06, y + Math.sin(q) * 0.3 - 0.05, x + Math.cos(q) * 0.3 + 0.06, y + Math.sin(q) * 0.3 + 0.05, 0, 0.1, '#5e5a52'); }
  pBox(c, x - 0.22, y - 0.05, x + 0.22, y + 0.05, 0.02, 0.1, '#4a3420'); pBox(c, x - 0.05, y - 0.22, x + 0.05, y + 0.22, 0.08, 0.16, '#4a3420');
  if (MODE === 1 || !lit) return;
  const t = performance.now() / 1000;
  P(x, y, 0.1); const bx = PX, by = PY, k = CB.k;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const ph = t * (5 + i * 1.7) + i * 2.1, hgt = k * (0.42 + 0.14 * Math.sin(ph) + (i === 0 ? 0.12 : 0)), w = k * (0.15 - i * 0.022);
    const ox = Math.sin(ph * 0.7 + i) * k * 0.05 + (i - 1.5) * k * 0.05;
    const g = c.createLinearGradient(bx, by, bx, by - hgt);
    g.addColorStop(0, `rgba(255,${150 + i * 20},40,${0.85 * DIM})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(bx + ox - w, by); c.quadraticCurveTo(bx + ox - w * 0.6, by - hgt * 0.5, bx + ox, by - hgt); c.quadraticCurveTo(bx + ox + w * 0.6, by - hgt * 0.5, bx + ox + w, by); c.closePath(); c.fill();
  }
  const g2 = c.createRadialGradient(bx, by - k * 0.15, 0, bx, by - k * 0.15, k * 1.4);
  g2.addColorStop(0, `rgba(255,150,60,${0.32 * DIM})`); g2.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = g2; c.fillRect(bx - k * 1.4, by - k * 1.55, k * 2.8, k * 2.8);
  c.globalCompositeOperation = 'source-over';
  R.fireVis = true;
}

// ----- соседство стен -----
const wallish = (m, x, y) => { if (!inb(m, x, y)) return false; const t = m.tiles[MI(m, x, y)]; return TP[t].wall || isDoorT(t); };
function wallPieces(m, x, y) { return { n: wallish(m, x, y - 1), s: wallish(m, x, y + 1), w: wallish(m, x - 1, y), e: wallish(m, x + 1, y) }; }
const WALL_DET = { [T.WALL]: 'panel', [T.BRICK]: 'brick', [T.WWALL]: 'plank', [T.WINDOW]: 'panel' };

// Высота объекта (для меток добычи и попадания касанием), в клетках
const OBJ_H = {
  [T.CRATE]: 0.7, [T.SHELF]: 1.2, [T.LOCKER]: 1.27, [T.FRIDGE]: 1.23, [T.DESK]: 0.56, [T.DRUM]: 0.85,
  [T.WELL]: 0.45, [T.MEDCAB]: 0.92, [T.BENCH]: 0.62, [T.FURN]: 0.5, [T.HAY]: 0.68, [T.BLOCK]: 1.05, [T.BLOCKH]: 1.5,
  [T.SANDBAG]: 0.6, [T.GRAVE]: 0.7,
};

// ----- объект в клетке -----
function drawTileObj(c, m, x, y, i, lod, cut) {
  const t = m.tiles[i];
  if (TP[t].wall) return drawWallIso(c, m, x, y, t, lod, cut);
  if (isDoorT(t)) return drawDoorIso(c, m, x, y, t, i, cut);
  const ct = m.cont[i], loot = ct && Object.keys(ct.loot).length > 0;
  const B = (a, b, cc, d, z0, z1, col, det, top) => pBox(c, x + a, y + b, x + cc, y + d, z0, z1, col, det, top);
  switch (t) {
    case T.FENCE: return drawFenceIso(c, m, x, y, i);
    case T.SANDBAG: {
      const nb = (dx, dy) => inb(m, x + dx, y + dy) && m.tiles[MI(m, x + dx, y + dy)] === T.SANDBAG;
      const hx = nb(-1, 0) || nb(1, 0), a0 = nb(-1, 0) ? 0 : 0.1, a1 = nb(1, 0) ? 1 : 0.9, b0 = nb(0, -1) ? 0 : 0.1, b1 = nb(0, 1) ? 1 : 0.9;
      for (let l = 0; l < 3; l++) {
        const z = l * 0.19, o = l % 2 ? 0.05 : 0.02, col = (l + x + y) % 2 ? '#8a7a56' : '#978763', top = shade(col, 1.1);
        // мешки по два на клетку, ряды вперевязку
        const cuts = l % 2 ? [0, 0.5, 1] : [0, 0.25, 0.75, 1];
        for (let s2 = 0; s2 < cuts.length - 1; s2++) {
          const c0 = cuts[s2] + 0.015, c1 = cuts[s2 + 1] - 0.015;
          if (hx) B(Math.max(a0, c0), b0 + o, Math.min(a1, c1), b1 - o, z, z + 0.17, col, null, top);
          else B(a0 + o, Math.max(b0, c0), a1 - o, Math.min(b1, c1), z, z + 0.17, col, null, top);
        }
      }
      return;
    }
    case T.GRAVE:
      B(0.22, 0.16, 0.78, 0.86, 0, 0.07, '#5a4a33');
      if (m.meta[i]) { B(0.46, 0.2, 0.54, 0.3, 0, 0.82, '#5a4128'); B(0.3, 0.2, 0.7, 0.3, 0.52, 0.6, '#5a4128'); }
      else { B(0.26, 0.18, 0.74, 0.3, 0, 0.62, '#8a8a82', null, '#a2a29a'); if (MODE === 0) B(0.34, 0.3, 0.66, 0.31, 0.3, 0.5, '#6a6a62'); }
      return;
    case T.TREE: return drawTreeIso(c, x, y, cut);
    case T.HAY:
      B(0.06, 0.1, 0.94, 0.9, 0, 0.68, '#b39a52', null, '#c8ad62');
      if (MODE === 0) { B(0.06, 0.3, 0.94, 0.33, 0.68, 0.69, '#7d6a35'); B(0.06, 0.66, 0.94, 0.69, 0.68, 0.69, '#7d6a35'); }
      return;
    case T.CRATE:
      B(0.14, 0.14, 0.86, 0.86, 0, 0.66, '#7d5c35', 'plank', '#8f6d43');
      if (MODE === 0) { B(0.14, 0.44, 0.86, 0.56, 0.66, 0.7, '#5a3f22'); B(0.44, 0.14, 0.56, 0.86, 0.66, 0.7, '#5a3f22'); }
      return;
    case T.SHELF: {
      B(0.06, 0.28, 0.12, 0.72, 0, 1.2, '#4a4e52'); B(0.88, 0.28, 0.94, 0.72, 0, 1.2, '#4a4e52');
      for (const z of [0.06, 0.46, 0.86]) B(0.12, 0.28, 0.88, 0.72, z, z + 0.05, '#6b7075');
      if (loot && MODE === 0) { B(0.18, 0.34, 0.42, 0.62, 0.11, 0.33, '#a8794a'); B(0.5, 0.3, 0.8, 0.66, 0.51, 0.7, '#7a8f5a'); B(0.3, 0.36, 0.5, 0.6, 0.91, 1.05, '#c9c3b2'); }
      B(0.06, 0.28, 0.94, 0.72, 1.18, 1.23, '#6b7075');
      return;
    }
    case T.LOCKER:
      B(0.18, 0.28, 0.82, 0.72, 0, 1.27, '#526577', 'panel', '#647889');
      if (MODE === 0) B(0.49, 0.27, 0.51, 0.73, 0.05, 1.22, '#34424e');
      return;
    case T.FRIDGE:
      B(0.2, 0.22, 0.8, 0.78, 0, 1.23, '#cfcdc1', 'panel', '#e2e0d4');
      if (MODE === 0) B(0.66, 0.78, 0.7, 0.81, 0.62, 1.0, '#8e8c82');
      return;
    case T.DESK:
      B(0.1, 0.22, 0.17, 0.78, 0, 0.5, '#5a4028'); B(0.83, 0.22, 0.9, 0.78, 0, 0.5, '#5a4028');
      B(0.06, 0.18, 0.94, 0.82, 0.5, 0.56, '#8a6946');
      if (MODE === 0) { B(0.2, 0.3, 0.45, 0.6, 0.56, 0.58, '#ddd6c2'); B(0.55, 0.28, 0.85, 0.38, 0.56, 0.86, '#2f3134'); }
      return;
    case T.DRUM:
      pCyl(c, x + 0.5, y + 0.5, 0.3, 0, 0.85, '#8c3f2a', [0.28, 0.58]);
      return;
    case T.WELL:
      pCyl(c, x + 0.5, y + 0.5, 0.42, 0, 0.45, '#77746a');
      if (MODE === 0) { P(x + 0.5, y + 0.5, 0.45); c.fillStyle = sh('#18242a', 1); c.beginPath(); c.ellipse(PX, PY, 0.28 * CB.k, 0.28 * CB.k * CB.sE, 0, 0, Math.PI * 2); c.fill(); }
      B(0.08, 0.46, 0.14, 0.54, 0, 1.25, '#5a4128'); B(0.86, 0.46, 0.92, 0.54, 0, 1.25, '#5a4128');
      B(0.08, 0.46, 0.92, 0.54, 1.2, 1.28, '#6a4c2c');
      return;
    case T.MEDCAB:
      B(0.16, 0.3, 0.84, 0.7, 0, 0.92, '#cbc6b9', 'panel', '#e6e2d6');
      if (MODE === 0) { B(0.44, 0.3, 0.56, 0.7, 0.92, 0.94, '#c4402f'); B(0.3, 0.45, 0.7, 0.55, 0.92, 0.94, '#c4402f'); }
      return;
    case T.BENCH:
      for (const a of [0.1, 0.84]) for (const b of [0.24, 0.7]) B(a, b, a + 0.06, b + 0.06, 0, 0.55, '#4a463c');
      B(0.05, 0.2, 0.95, 0.8, 0.55, 0.62, '#7d7768');
      if (MODE === 0) { B(0.15, 0.35, 0.5, 0.45, 0.62, 0.66, '#b9b19a'); B(0.6, 0.3, 0.76, 0.6, 0.62, 0.78, '#c4402f'); }
      return;
    case T.FURN: {
      const v = m.meta[i];
      if (v === 0) {
        B(0.1, 0.05, 0.9, 0.95, 0, 0.3, '#3c404c');
        B(0.12, 0.08, 0.88, 0.92, 0.3, 0.4, '#d6d0bf');
        if (MODE === 0) { B(0.18, 0.1, 0.82, 0.3, 0.4, 0.48, '#e8e2d2'); B(0.12, 0.42, 0.88, 0.92, 0.4, 0.44, '#5c6170'); }
      } else if (v === 1) { pCyl(c, x + 0.5, y + 0.5, 0.06, 0, 0.5, '#4a3520'); pCyl(c, x + 0.5, y + 0.5, 0.4, 0.5, 0.56, '#8a6946'); }
      else if (v === 2) { B(0.06, 0.32, 0.94, 0.86, 0, 0.36, '#6b5878'); B(0.06, 0.14, 0.94, 0.32, 0, 0.72, '#5a4868'); B(0.04, 0.14, 0.14, 0.86, 0, 0.5, '#5a4868'); B(0.86, 0.14, 0.96, 0.86, 0, 0.5, '#5a4868'); }
      else if (v === 3) { B(0.1, 0.42, 0.16, 0.58, 0, 0.3, '#3e2c1a'); B(0.84, 0.42, 0.9, 0.58, 0, 0.3, '#3e2c1a'); B(0.06, 0.36, 0.94, 0.64, 0.3, 0.36, '#7a5b3a'); }
      else if (v === 4) { // церковная скамья
        B(0.04, 0.3, 0.1, 0.75, 0, 0.42, '#4a3420'); B(0.9, 0.3, 0.96, 0.75, 0, 0.42, '#4a3420');
        B(0.04, 0.32, 0.96, 0.72, 0.36, 0.42, '#6e4f30'); B(0.04, 0.66, 0.96, 0.74, 0.42, 0.88, '#5e4228');
      } else if (v === 5) { // парта и стул
        B(0.14, 0.12, 0.2, 0.56, 0, 0.52, '#5a5d60'); B(0.8, 0.12, 0.86, 0.56, 0, 0.52, '#5a5d60');
        B(0.1, 0.1, 0.9, 0.58, 0.52, 0.58, '#b39062');
        B(0.32, 0.66, 0.68, 0.9, 0, 0.32, '#5a5d60'); B(0.32, 0.66, 0.68, 0.9, 0.32, 0.36, '#7a5b3a'); B(0.32, 0.86, 0.68, 0.92, 0.36, 0.7, '#7a5b3a');
      } else if (v === 6) { // двухъярусная койка
        for (const a of [0.1, 0.84]) for (const b of [0.06, 0.88]) B(a, b, a + 0.06, b + 0.06, 0, 1.25, '#3f4a3a');
        for (const z of [0.3, 0.9]) { B(0.1, 0.06, 0.9, 0.94, z, z + 0.08, '#4a5a3a'); B(0.12, 0.08, 0.88, 0.92, z + 0.08, z + 0.17, '#6f7a5a'); }
        if (MODE === 0) B(0.16, 0.1, 0.84, 0.3, 1.07, 1.13, '#d6d0bf');
      } else if (v === 7) { // прилавок
        B(0.02, 0.28, 0.98, 0.72, 0, 0.82, '#6a5440', 'plank', '#8a7454');
        if (MODE === 0) B(0.0, 0.26, 1.0, 0.74, 0.82, 0.86, '#b8b2a2');
      } else { // нары / раскладушка
        B(0.12, 0.08, 0.18, 0.92, 0, 0.32, '#5a5d60'); B(0.82, 0.08, 0.88, 0.92, 0, 0.32, '#5a5d60');
        B(0.1, 0.06, 0.9, 0.94, 0.32, 0.4, '#6f7468'); if (MODE === 0) B(0.14, 0.08, 0.86, 0.26, 0.4, 0.46, '#c8c2b0');
      }
      return;
    }
  }
}
function drawWallIso(c, m, x, y, t, lod, cut) {
  const [top, face] = WALLC[t] || WALLC[T.WALL];
  const Q = wallPieces(m, x, y), a = (1 - WALL_T) / 2, b = a + WALL_T;
  const pcs = [[a, a, b, b]];
  if (Q.n) pcs.push([a, 0, b, a]);
  if (Q.s) pcs.push([a, b, b, 1]);
  if (Q.w) pcs.push([0, a, a, b]);
  if (Q.e) pcs.push([b, a, 1, b]);
  pcs.sort((p, q) => nearF(p[0] + p[2], p[1] + p[3]) - nearF(q[0] + q[2], q[1] + q[3]));
  const zTop = cut ? WALL_LOW : WALL_Z, det = lod === 2 ? WALL_DET[t] : null;
  for (const p of pcs) {
    const X0 = x + p[0], Y0 = y + p[1], X1 = x + p[2], Y1 = y + p[3];
    if (t === T.WINDOW && !cut) {
      pBox(c, X0, Y0, X1, Y1, 0, 0.5, face, det, top);
      if (MODE === 0) { c.globalAlpha = 0.55; pBox(c, X0 + 0.02, Y0 + 0.02, X1 - 0.02, Y1 - 0.02, 0.5, 1.02, '#7e9fb4'); c.globalAlpha = 1; }
      pBox(c, X0, Y0, X1, Y1, 1.02, WALL_Z, face, null, top);
    } else pBox(c, X0, Y0, X1, Y1, 0, zTop, face, det, top);
  }
}
function drawDoorIso(c, m, x, y, t, i, cut) {
  const metal = m.meta[i] & 1, col = metal ? '#737a7f' : '#8b5d2e';
  const Q = wallPieces(m, x, y), a = (1 - WALL_T) / 2, b = a + WALL_T;
  let wc = WALLC[T.WALL];
  for (const [dx, dy] of DIR4) { const nx = x + dx, ny = y + dy; if (inb(m, nx, ny) && TP[m.tiles[MI(m, nx, ny)]].wall) { wc = WALLC[m.tiles[MI(m, nx, ny)]]; break; } }
  const zt = cut ? WALL_LOW : WALL_Z, dz = Math.min(1.05, zt);
  const horiz = Q.w || Q.e || !(Q.n || Q.s);
  const items = [];
  if (horiz) {
    items.push([x, y + a, x + 0.08, y + b, 0, zt, wc[1], wc[0]], [x + 0.92, y + a, x + 1, y + b, 0, zt, wc[1], wc[0]]);
    if (!cut) items.push([x, y + a, x + 1, y + b, 1.05, WALL_Z, wc[1], wc[0]]);
    if (t === T.DOOR) items.push([x + 0.08, y + 0.45, x + 0.92, y + 0.55, 0, dz, col]);
    else if (t === T.DOOR_OPEN) items.push([x + 0.08, y + 0.1, x + 0.16, y + 0.92, 0, dz, col]);
    else items.push([x + 0.2, y + 0.58, x + 0.8, y + 0.9, 0, 0.06, col]);
  } else {
    items.push([x + a, y, x + b, y + 0.08, 0, zt, wc[1], wc[0]], [x + a, y + 0.92, x + b, y + 1, 0, zt, wc[1], wc[0]]);
    if (!cut) items.push([x + a, y, x + b, y + 1, 1.05, WALL_Z, wc[1], wc[0]]);
    if (t === T.DOOR) items.push([x + 0.45, y + 0.08, x + 0.55, y + 0.92, 0, dz, col]);
    else if (t === T.DOOR_OPEN) items.push([x + 0.1, y + 0.08, x + 0.92, y + 0.16, 0, dz, col]);
    else items.push([x + 0.58, y + 0.2, x + 0.9, y + 0.8, 0, 0.06, col]);
  }
  items.sort((p, q) => p[4] - q[4] || nearF(p[0] + p[2], p[1] + p[3]) - nearF(q[0] + q[2], q[1] + q[3]));
  for (const it of items) pBox(c, it[0], it[1], it[2], it[3], it[4], it[5], it[6], null, it[7]);
}
function drawFenceIso(c, m, x, y, i) {
  const md = m.meta[i], H = md === 1 ? 0.95 : 0.7;
  const rail = md === 1 ? '#8d9296' : md === 2 ? '#c9c2ae' : '#7a5c38', post = md === 1 ? '#5c6166' : md === 2 ? '#a39c88' : '#53402a';
  const n = (dx, dy) => { const nx = x + dx, ny = y + dy; if (!inb(m, nx, ny)) return false; const tt = m.tiles[MI(m, nx, ny)]; return tt === T.FENCE || TP[tt].wall; };
  const segs = [];
  if (n(0, -1)) segs.push([0.5, 0, 0.5, 0.5]);
  if (n(0, 1)) segs.push([0.5, 0.5, 0.5, 1]);
  if (n(-1, 0)) segs.push([0, 0.5, 0.5, 0.5]);
  if (n(1, 0)) segs.push([0.5, 0.5, 1, 0.5]);
  if (!segs.length) segs.push([0.15, 0.5, 0.85, 0.5]);
  const th = 0.035, mid = nearF(x + 0.5, y + 0.5);
  const drawSeg = s => {
    const x0 = x + Math.min(s[0], s[2]) - th, x1 = x + Math.max(s[0], s[2]) + th, y0 = y + Math.min(s[1], s[3]) - th, y1 = y + Math.max(s[1], s[3]) + th;
    if (md === 1) {
      if (MODE === 0) { c.globalAlpha = 0.32; pBox(c, x0, y0, x1, y1, 0.04, H, '#9aa2a6'); c.globalAlpha = 1; }
      pBox(c, x0, y0, x1, y1, H - 0.04, H, rail);
    } else for (const z of [0.25, 0.55]) pBox(c, x0, y0, x1, y1, z, z + 0.08, rail);
  };
  const back = segs.filter(s => nearF(x + (s[0] + s[2]) / 2, y + (s[1] + s[3]) / 2) < mid);
  back.forEach(drawSeg);
  pBox(c, x + 0.44, y + 0.44, x + 0.56, y + 0.56, 0, H + 0.06, post);
  segs.filter(s => !back.includes(s)).forEach(drawSeg);
}
function drawTreeIso(c, x, y, cut) {
  const hv = hash2(x, y, 9), sz = 0.85 + hv * 0.35;
  pCyl(c, x + 0.5, y + 0.5, 0.09 * sz, 0, 1.1 * sz, '#4a3520');
  if (cut && MODE === 0) c.globalAlpha = 0.32;
  const g1 = hv < 0.5 ? '#26391d' : '#2c3f1f', g2 = hv < 0.5 ? '#304a24' : '#3a5228';
  pBall(c, x + 0.35, y + 0.55, 1.45 * sz, 0.5 * sz, g1);
  pBall(c, x + 0.62, y + 0.4, 1.6 * sz, 0.52 * sz, g1);
  pBall(c, x + 0.5, y + 0.55, 1.95 * sz, 0.46 * sz, g2);
  c.globalAlpha = 1;
}
function drawBushIso(c, x, y, occupied) {
  if (occupied && MODE === 0) c.globalAlpha = 0.72;
  const hv = hash2(x, y, 4);
  pBall(c, x + 0.32, y + 0.55, 0.28, 0.3, '#253820');
  pBall(c, x + 0.68, y + 0.45, 0.3, 0.3, '#2b4123');
  pBall(c, x + 0.5, y + 0.62, 0.42, 0.33, hv < 0.5 ? '#36532c' : '#3f5a30');
  c.globalAlpha = 1;
}
function drawCropIso(c, m, x, y, i, lod) {
  if (MODE === 1) return;
  const corn = m.meta[i] === 1, H = corn ? 1.35 : 0.7, n = corn ? 3 : 4;
  const dk = sh(corn ? '#46622a' : '#9c8638', 1), lt = sh(corn ? '#6f8f3a' : '#d4b95c', 1), hd = sh(corn ? '#c8b464' : '#e0c56a', 1);
  const lw = Math.max(1.2, CB.k * (corn ? 0.045 : 0.03));
  const pts = [];
  for (let r = 0; r < 2; r++) for (let k = 0; k < n; k++) {
    const px = x + (k + 0.5) / n + (hash2(x * 4 + k, y * 2 + r, 6) - 0.5) * 0.12, py = y + 0.25 + r * 0.5 + (hash2(x + k, y + r, 5) - 0.5) * 0.12;
    pts.push([px, py, H * (0.82 + hash2(x + k, y + r, 7) * 0.3)]);
  }
  pts.sort((a, b) => nearF(a[0], a[1]) - nearF(b[0], b[1]));
  c.lineCap = 'round';
  for (const [px, py, h] of pts) {
    P(px, py, 0); const bx = PX, by = PY; P(px, py, h);
    c.strokeStyle = dk; c.lineWidth = lw; c.beginPath(); c.moveTo(bx, by); c.lineTo(PX, PY); c.stroke();
    if (corn) {
      if (lod === 2) {
        c.strokeStyle = lt; c.lineWidth = lw * 0.8; c.beginPath();
        P(px, py, h * 0.45); c.moveTo(PX, PY); c.lineTo(PX - CB.k * 0.16, PY + CB.k * 0.02);
        P(px, py, h * 0.7); c.moveTo(PX, PY); c.lineTo(PX + CB.k * 0.15, PY - CB.k * 0.01);
        c.stroke();
      }
      P(px, py, h); c.fillStyle = hd; c.fillRect(PX - lw * 0.6, PY - lw * 1.8, lw * 1.2, lw * 2);
    } else { P(px, py, h); c.fillStyle = hd; c.beginPath(); c.ellipse(PX, PY - lw, lw * 1.1, lw * 2.2, 0, 0, Math.PI * 2); c.fill(); }
  }
  c.lineCap = 'butt';
}

// ----- техника и большие предметы: набор призм, разрезанных по клеткам -----
function propPrims(p) {
  const out = [], v = p.v, f = p.f, x = p.x, y = p.y, w = p.w, h = p.h;
  const box = (x0, y0, x1, y1, z0, z1, col, top, alpha) => out.push({ t: 'box', x0, y0, x1, y1, z0, z1, col, top, alpha });
  // s — доля длины от зада к переду, i — доля ширины от левого борта
  const along = (s0, s1, i0, i1, z0, z1, col, top, alpha) => {
    if (v) { const a0 = f ? y + s0 * h : y + h - s1 * h, a1 = f ? y + s1 * h : y + h - s0 * h; box(x + i0 * w, a0, x + i1 * w, a1, z0, z1, col, top, alpha); }
    else { const a0 = f ? x + w - s1 * w : x + s0 * w, a1 = f ? x + w - s0 * w : x + s1 * w; box(a0, y + i0 * h, a1, y + i1 * h, z0, z1, col, top, alpha); }
  };
  const wheels = (list, r) => { for (const s of list) for (const [i0, i1] of [[0.02, 0.16], [0.84, 0.98]]) along(s - r, s + r, i0, i1, 0, 0.36, '#1a1916'); };
  switch (p.k) {
    case 'car':
      wheels([0.2, 0.8], 0.1);
      along(0.03, 0.97, 0.1, 0.9, 0.18, 0.6, p.c);
      along(0.3, 0.72, 0.16, 0.84, 0.6, 0.98, '#4c6272');
      along(0.32, 0.7, 0.18, 0.82, 0.98, 1.04, shade(p.c, 1.08));
      along(0.97, 0.995, 0.14, 0.3, 0.38, 0.5, '#e8dca0'); along(0.97, 0.995, 0.7, 0.86, 0.38, 0.5, '#e8dca0');
      along(0.005, 0.03, 0.14, 0.3, 0.4, 0.5, '#a8322a'); along(0.005, 0.03, 0.7, 0.86, 0.4, 0.5, '#a8322a');
      if (p.pol) { along(0.05, 0.95, 0.09, 0.91, 0.36, 0.44, '#2f4f8f'); along(0.45, 0.55, 0.22, 0.5, 1.04, 1.13, '#c4402f'); along(0.45, 0.55, 0.5, 0.78, 1.04, 1.13, '#3a6ab0'); }
      break;
    case 'ambulance':
      wheels([0.18, 0.82], 0.1);
      along(0.02, 0.7, 0.08, 0.92, 0.2, 1.3, '#e2ded2');
      along(0.7, 0.98, 0.1, 0.9, 0.2, 0.82, '#e2ded2');
      along(0.72, 0.9, 0.14, 0.86, 0.82, 1.12, '#4c6272');
      along(0.02, 0.7, 0.07, 0.93, 0.62, 0.74, '#c4402f');
      along(0.3, 0.42, 0.42, 0.58, 1.3, 1.33, '#c4402f'); along(0.33, 0.39, 0.3, 0.7, 1.3, 1.33, '#c4402f');
      along(0.72, 0.78, 0.2, 0.4, 1.12, 1.22, '#c4402f'); along(0.72, 0.78, 0.6, 0.8, 1.12, 1.22, '#3a6ab0');
      break;
    case 'truck':
      wheels([0.12, 0.45, 0.85], 0.07);
      along(0.02, 0.68, 0.04, 0.96, 0.3, 1.75, '#8e8b80', '#a4a196');
      along(0.71, 0.98, 0.08, 0.92, 0.25, 1.2, p.c);
      along(0.86, 0.96, 0.12, 0.88, 0.75, 1.1, '#4c6272');
      break;
    case 'tractor':
      for (const [i0, i1] of [[0, 0.2], [0.8, 1]]) { along(0.05, 0.4, i0, i1, 0, 0.8, '#1a1916'); along(0.72, 0.92, i0 + 0.04, i1 - 0.04, 0, 0.45, '#1a1916'); }
      along(0.42, 0.98, 0.22, 0.78, 0.3, 0.78, p.c);
      along(0.06, 0.45, 0.2, 0.8, 0.3, 0.85, shade(p.c, 0.85));
      along(0.1, 0.42, 0.24, 0.76, 0.85, 1.5, '#5a7380', null, 0.7);
      along(0.08, 0.44, 0.2, 0.8, 1.5, 1.56, shade(p.c, 1.1));
      along(0.8, 0.85, 0.3, 0.38, 0.78, 1.35, '#2a2a28');
      break;
    case 'machine': {
      const Hm = p.tall ? 1.5 : 0.95;
      box(x + 0.08, y + 0.08, x + w - 0.08, y + h - 0.08, 0, 0.12, '#d9a62b');
      box(x + 0.12, y + 0.12, x + w - 0.12, y + h - 0.12, 0.12, Hm, p.c);
      box(x + w * 0.55, y + h * 0.25, x + w * 0.85, y + h * 0.6, Hm, Hm + 0.3, '#2a2d2e');
      box(x + w * 0.15, y + h * 0.3, x + w * 0.45, y + h * 0.7, Hm, Hm + 0.08, '#3f4446');
      break;
    }
    case 'tank':
      for (const s of [0.15, 0.5, 0.85]) box(x + w * s - 0.15, y + 0.4, x + w * s + 0.15, y + h - 0.4, 0, 0.3, '#4a4840');
      box(x + 0.1, y + 0.3, x + w - 0.1, y + h - 0.3, 0.3, 1.25, '#9e9b90', '#b6b3a8');
      box(x + 0.15, y + 0.6, x + w - 0.15, y + h - 0.6, 1.25, 1.38, '#b6b3a8');
      box(x + w * 0.1, y + h - 0.32, x + w * 0.24, y + h - 0.3, 0.6, 0.8, '#c4402f');
      break;
    case 'bus':
      wheels([0.13, 0.82], 0.06);
      along(0.01, 0.99, 0.06, 0.94, 0.25, 1.55, p.c, shade(p.c, 1.1));
      along(0.06, 0.95, 0.05, 0.95, 0.85, 1.25, '#3e4e5a');
      along(0.0, 0.01, 0.1, 0.9, 0.25, 0.5, '#2a2a28'); along(0.99, 1.0, 0.1, 0.9, 0.25, 0.5, '#2a2a28');
      along(0.3, 0.7, 0.2, 0.8, 1.55, 1.6, '#c4c0b0');
      break;
    case 'trailer':
      wheels([0.45, 0.55], 0.05);
      along(0.0, 0.9, 0.04, 0.96, 0.3, 1.45, p.c, '#e4e0d4');
      along(0.05, 0.85, 0.03, 0.97, 0.7, 0.78, '#4a6a8a');
      along(0.15, 0.3, 0.03, 0.97, 0.9, 1.15, '#3e4e5a'); along(0.6, 0.75, 0.03, 0.97, 0.9, 1.15, '#3e4e5a');
      along(0.9, 1.0, 0.45, 0.55, 0.25, 0.35, '#2a2a28');
      break;
    case 'wagon':
      for (const s of [0.12, 0.88]) for (const [i0, i1] of [[0.02, 0.2], [0.8, 0.98]]) along(s - 0.08, s + 0.08, i0, i1, 0, 0.35, '#1e1d1a');
      along(0.0, 1.0, 0.08, 0.92, 0.3, 0.4, '#2a2826');
      along(0.01, 0.99, 0.04, 0.96, 0.4, 1.9, p.c, shade(p.c, 1.12));
      along(0.42, 0.58, 0.02, 0.98, 0.5, 1.75, shade(p.c, 0.78));
      along(0.0, 1.0, 0.1, 0.9, 1.9, 1.98, shade(p.c, 1.2));
      break;
    case 'pump':
      box(x + 0.22, y + 0.3, x + 0.78, y + 0.7, 0, 1.25, '#b8402f', '#d8d4c8');
      box(x + 0.3, y + 0.28, x + 0.7, y + 0.72, 0.75, 1.05, '#d8d4c8');
      box(x + 0.36, y + 0.27, x + 0.64, y + 0.73, 0.82, 0.98, '#2a3a2a');
      box(x + 0.78, y + 0.44, x + 0.86, y + 0.56, 0.2, 0.9, '#1e1d1a');
      break;
    case 'tent': {
      if (p.round) { out.push({ t: 'cone', x: x + w / 2, y: y + h / 2, r: Math.min(w, h) * 0.48, z0: 0, z1: 1.55, col: p.c }); out.push({ t: 'box', x0: x + w / 2 - 0.04, y0: y + h / 2 - 0.04, x1: x + w / 2 + 0.04, y1: y + h / 2 + 0.04, z0: 1.4, z1: 1.8, col: '#4a3420' }); break; }
      out.push({ t: 'ridge', x0: x + 0.1, y0: y + 0.12, x1: x + w - 0.1, y1: y + h - 0.12, z0: 0, z1: 0.08, zr: 1.05, ax: w >= h ? 'x' : 'y', col: p.c });
      break;
    }
    case 'mtent':
    case 'medtent': {
      const ax = h > w ? 'y' : 'x', med = p.k === 'medtent';
      out.push({ t: 'ridge', x0: x + 0.08, y0: y + 0.08, x1: x + w - 0.08, y1: y + h - 0.08, z0: 0, z1: med ? 0.5 : 0.4, zr: med ? 1.45 : 1.3, ax, col: p.c });
      if (med) {
        const cx = x + w / 2, cy = y + h / 2;
        if (ax === 'x') for (const xx of [x + 0.06, x + w - 0.08]) { box(xx, cy - 0.3, xx + 0.02, cy + 0.3, 0.55, 0.69, '#c4402f'); box(xx, cy - 0.07, xx + 0.02, cy + 0.07, 0.35, 0.9, '#c4402f'); }
        else for (const yy of [y + 0.06, y + h - 0.08]) { box(cx - 0.3, yy, cx + 0.3, yy + 0.02, 0.55, 0.69, '#c4402f'); box(cx - 0.07, yy, cx + 0.07, yy + 0.02, 0.35, 0.9, '#c4402f'); }
      }
      break;
    }
    case 'tower': {
      for (const [a, b] of [[0.1, 0.1], [w - 0.24, 0.1], [0.1, h - 0.24], [w - 0.24, h - 0.24]]) box(x + a, y + b, x + a + 0.14, y + b + 0.14, 0, 3.2, '#5a4a36');
      box(x + 0.02, y + 0.02, x + w - 0.02, y + h - 0.02, 2.1, 2.24, '#6e5a40');
      for (const [a0, b0, a1, b1] of [[0.02, 0.02, w - 0.02, 0.1], [0.02, h - 0.1, w - 0.02, h - 0.02], [0.02, 0.1, 0.1, h - 0.1], [w - 0.1, 0.1, w - 0.02, h - 0.1]]) box(x + a0, y + b0, x + a1, y + b1, 2.24, 2.62, '#8a7a56');
      box(x - 0.08, y - 0.08, x + w + 0.08, y + h + 0.08, 3.2, 3.3, '#4a4438');
      box(x + w * 0.3, y + h * 0.3, x + w * 0.7, y + h * 0.7, 3.3, 3.45, '#4a4438');
      break;
    }
    case 'mast': {
      const H2 = p.hgt || 4;
      box(x + 0.38, y + 0.38, x + 0.62, y + 0.62, 0, 0.2, '#5e5c55');
      box(x + 0.45, y + 0.45, x + 0.55, y + 0.55, 0.2, H2, '#9a9c97');
      for (let z = 1; z < H2; z += 1) box(x + 0.36, y + 0.36, x + 0.64, y + 0.64, z, z + 0.05, '#7a7c77');
      box(x + 0.2, y + 0.47, x + 0.8, y + 0.53, H2 - 0.6, H2 - 0.55, '#9a9c97');
      box(x + 0.46, y + 0.46, x + 0.54, y + 0.54, H2, H2 + 0.12, '#e0402f');
      break;
    }
    case 'wtower': {
      for (const [a, b] of [[0.2, 0.2], [w - 0.32, 0.2], [0.2, h - 0.32], [w - 0.32, h - 0.32]]) box(x + a, y + b, x + a + 0.12, y + b + 0.12, 0, 1.9, '#5a5d60');
      box(x + 0.3, y + 0.3, x + w - 0.3, y + h - 0.3, 0.9, 0.96, '#5a5d60');
      out.push({ t: 'cyl', x: x + w / 2, y: y + h / 2, r: w * 0.42, z0: 1.9, z1: 2.9, col: '#6f8a8a', rings: [2.2, 2.55] });
      out.push({ t: 'cone', x: x + w / 2, y: y + h / 2, r: w * 0.44, z0: 2.9, z1: 3.25, col: '#5a6e6e' });
      break;
    }
    case 'campfire':
      out.push({ t: 'fire', x: x + 0.5, y: y + 0.5, z0: 0 });
      break;
    case 'silo':
      out.push({ t: 'cyl', x: x + w / 2, y: y + h / 2, r: w * 0.46, z0: 0, z1: 2.8, col: '#878984', rings: [0.7, 1.4, 2.1] });
      out.push({ t: 'cone', x: x + w / 2, y: y + h / 2, r: w * 0.48, z0: 2.8, z1: 3.5, col: '#9a9c97' });
      break;
  }
  return out;
}
const PSLICE = new WeakMap();
function propSlices(m) {
  let map = PSLICE.get(m);
  if (map) return map;
  map = new Map();
  const push = (i, q) => { if (!map.has(i)) map.set(i, []); map.get(i).push(q); };
  for (const p of m.props) for (const q of propPrims(p)) {
    if (q.t === 'ridge') { push(MI(m, Math.floor((q.x0 + q.x1) / 2), Math.floor((q.y0 + q.y1) / 2)), q); continue; }
    if (q.t !== 'box') { push(MI(m, Math.floor(q.x), Math.floor(q.y)), q); continue; }
    for (let ty = Math.floor(q.y0); ty < Math.ceil(q.y1); ty++) for (let tx = Math.floor(q.x0); tx < Math.ceil(q.x1); tx++) {
      if (!inb(m, tx, ty)) continue;
      const s = Object.assign({}, q, { x0: Math.max(q.x0, tx), x1: Math.min(q.x1, tx + 1), y0: Math.max(q.y0, ty), y1: Math.min(q.y1, ty + 1) });
      if (s.x1 - s.x0 > 1e-3 && s.y1 - s.y0 > 1e-3) push(MI(m, tx, ty), s);
    }
  }
  PSLICE.set(m, map);
  return map;
}
function drawPrims(c, list) {
  const key = q => (q.t === 'box' || q.t === 'ridge' ? nearF((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2) : nearF(q.x, q.y));
  list.sort((a, b) => a.z0 - b.z0 || key(a) - key(b));
  for (const q of list) {
    if (q.t === 'cyl') pCyl(c, q.x, q.y, q.r, q.z0, q.z1, q.col, q.rings);
    else if (q.t === 'ridge') pPoly(c, q.f || (q.f = ridgeFaces(q.x0, q.y0, q.x1, q.y1, q.z0, q.z1, q.zr, q.ax)), q.col, [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.z1 / 2]);
    else if (q.t === 'fire') pFire(c, q.x, q.y);
    else if (q.t === 'cone') pCone(c, q.x, q.y, q.r, q.z0, q.z1, q.col);
    else {
      if (q.alpha && MODE === 0) c.globalAlpha = q.alpha;
      pBox(c, q.x0, q.y0, q.x1, q.y1, q.z0, q.z1, q.col, null, q.top);
      c.globalAlpha = 1;
    }
  }
}

// ----- кадр целиком -----
const LAYERS = { sc: null, lc: null, vg: null, vgKey: '' };
function layer(name, W, H, dpr) {
  let cv = LAYERS[name];
  const w = Math.round(W * dpr), h = Math.round(H * dpr);
  if (!cv) { cv = document.createElement('canvas'); LAYERS[name] = cv; }
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return cv;
}
const MAPCSS = MAPRGB.map(c => c && `rgb(${c[0]},${c[1]},${c[2]})`);
const isFlatT = t => TP[t].floor || t === T.CROP || t === T.BUSH || t === T.BLOCK || t === T.BLOCKH;
function drawIso(c, m, cam, W, H, now, all, shk = [0, 0], extra = null) {
  const dpr = R.dpr, gfx = CFG.gfx ?? 2;
  setCB(cam, W, H, shk[0], shk[1]);
  const k = cam.k, lod = k < 14 ? 0 : k < 24 ? 1 : 2;
  const seen = i => all || m.seen[i], vis = i => all || m.vis[i];
  // видимые клетки
  const corners = [unP(-k * 2, -k * 4), unP(W + k * 2, -k * 4), unP(-k * 2, H + k * 4), unP(W + k * 2, H + k * 4)];
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p[0])))), x1 = Math.min(m.w - 1, Math.ceil(Math.max(...corners.map(p => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map(p => p[1])))), y1 = Math.min(m.h - 1, Math.ceil(Math.max(...corners.map(p => p[1]))));
  const tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    P(x + 0.5, y + 0.5, 0);
    if (PX < -k * 1.5 || PX > W + k * 1.5 || PY < -k * 1.2 || PY > H + k * 3.5) continue;
    tiles.push(y * m.w + x);
  }
  // A. земля в пространстве клеток (аффинное преобразование)
  const e = CB.ox - k * (CB.cx * CB.rx + CB.cy * CB.ry), f = CB.oy + k * CB.sE * (CB.cx * CB.fx + CB.cy * CB.fy);
  const groundT = () => c.setTransform(dpr * CB.rx, -dpr * CB.fx * CB.sE, dpr * CB.ry, -dpr * CB.fy * CB.sE, dpr * e, dpr * f);
  groundT();
  for (const i of tiles) {
    if (!seen(i)) continue;
    const x = i % m.w, y = (i / m.w) | 0;
    if (lod === 0) { const t = m.tiles[i]; c.fillStyle = MAPCSS[TP[t].floor ? m.ground[i] : t]; c.fillRect(x * k - 0.6, y * k - 0.6, k + 1.2, k + 1.2); }
    else drawGround(c, m, m.ground[i], x, y, i, x * k, y * k, k, k, lod);
  }
  for (const d of m.decals) {
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1 || !seen(MI(m, d.x, d.y))) continue;
    const X = (d.x + 0.5) * k, Y = (d.y + 0.5) * k;
    if (d.k === 'spot') { c.fillStyle = 'rgba(92,18,12,0.7)'; circ(c, (d.x + d.fx) * k, (d.y + d.fy) * k, k * d.s); c.fill(); continue; }
    c.fillStyle = 'rgba(80,16,10,0.6)';
    c.beginPath(); c.ellipse(X + (d.r - 0.5) * k * 0.3, Y, k * 0.44, k * 0.34, d.r * 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(60,10,6,0.45)'; circ(c, X + k * 0.25, Y - k * 0.2, k * 0.1); c.fill();
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // фигуры по рядам и что они закрывают
  const pSl = propSlices(m);
  const cutW = new Set(), cutT = new Set(), occ = new Set(), rows = new Map();
  const bucket = (b, item) => { if (!rows.has(b)) rows.set(b, []); rows.get(b).push(item); };
  if (!all) {
    for (const z of m.zombies) {
      if (!m.vis[MI(m, z.x, z.y)] && !(z.anim && z.anim.k === 'mv' && m.vis[MI(m, Math.round(z.anim.fx), Math.round(z.anim.fy))])) continue;
      const [px, py] = animPos(z, now);
      bucket(Math.round(nearKey(px, py)), { e: z, z: true, px, py });
    }
    for (const un of m.units) {
      if (un.dead || un.evac) continue;
      const [px, py] = animPos(un, now);
      bucket(Math.round(nearKey(px, py)), { e: un, z: false, px, py });
    }
    for (const cp of m.captives || []) if (!cp.freed && m.seen[MI(m, cp.x, cp.y)]) bucket(Math.round(nearKey(cp.x, cp.y)), { e: cp, z: false, cap: true, px: cp.x, py: cp.y });
  } else if (extra) {
    for (const it of extra) { const [px, py] = animPos(it.e, now); bucket(Math.round(nearKey(px, py)), { e: it.e, z: false, base: true, px, py }); }
  }
  if (!all || extra) {
    for (const list of rows.values()) for (const it of list) {
      const ex = Math.round(it.px), ey = Math.round(it.py), nk = nearKey(ex, ey);
      occ.add(MI(m, ex, ey));
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const tx = ex + dx, ty = ey + dy;
        if (!inb(m, tx, ty)) continue;
        const dn = nearKey(tx, ty) - nk, side = Math.abs(dx * CB.rx + dy * CB.ry);
        if (dn >= 1 && dn <= 3 && side <= 1.25) cutW.add(MI(m, tx, ty));
        if (dn >= 1 && dn <= 4 && side <= 1.6) cutT.add(MI(m, tx, ty));
      }
    }
  }
  // B. тени на земле (отдельным слоем, без двойного затемнения)
  if (gfx >= 1 && lod >= 1) {
    const sc = layer('sc', W, H, dpr);
    SCX = sc.getContext('2d');
    SCX.setTransform(1, 0, 0, 1, 0, 0); SCX.clearRect(0, 0, sc.width, sc.height);
    SCX.setTransform(dpr, 0, 0, dpr, 0, 0); SCX.fillStyle = '#000';
    MODE = 1;
    for (const i of tiles) {
      if (!seen(i)) continue;
      const t = m.tiles[i], x = i % m.w, y = (i / m.w) | 0;
      if (pSl.has(i)) drawPrims(c, pSl.get(i).slice());
      if (t === T.BUSH) drawBushIso(c, x, y, false);
      else if (!isFlatT(t)) drawTileObj(c, m, x, y, i, lod, cutW.has(i));
    }
    for (const list of rows.values()) for (const it of list) {
      P(it.px + 0.5, it.py + 0.5, 0);
      const big = it.z && it.e.type === 'brute' ? 1.3 : 1, L = k * 0.54 * big;
      SCX.beginPath(); SCX.ellipse(PX + L * 0.5, PY + L * 0.22, L * 0.62, k * 0.17 * big, Math.atan2(SHD[1], SHD[0]), 0, Math.PI * 2); SCX.fill();
    }
    MODE = 0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 0.34; c.drawImage(sc, 0, 0); c.globalAlpha = 1;
  }
  // C. туман на земле и разметка
  groundT();
  if (!all) {
    for (const i of tiles) {
      if (m.vis[i]) continue;
      const x = i % m.w, y = (i / m.w) | 0;
      c.fillStyle = m.seen[i] ? 'rgba(9,8,6,0.6)' : '#0b0a08';
      c.fillRect(x * k - 0.6, y * k - 0.6, k + 1.2, k + 1.2);
    }
    drawGroundMarks(c, m, k, x0, x1, y0, y1);
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // D. объекты, тела и фигуры — по диагональным рядам от дальних к ближним
  const byKey = new Map();
  let kMin = 1e9, kMax = -1e9;
  for (const i of tiles) {
    if (!seen(i)) continue;
    const nk = nearKey(i % m.w, (i / m.w) | 0);
    if (!byKey.has(nk)) byKey.set(nk, []);
    byKey.get(nk).push(i);
    if (nk < kMin) kMin = nk; if (nk > kMax) kMax = nk;
  }
  for (const r of rows.keys()) { if (r < kMin) kMin = r; if (r > kMax) kMax = r; }
  const corpses = new Map();
  for (const d of m.decals) if ((d.k === 'corpse' && d.zt) || d.k === 'ucorpse') {
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1 || !seen(MI(m, d.x, d.y))) continue;
    const nk = nearKey(d.x, d.y);
    if (!corpses.has(nk)) corpses.set(nk, []);
    corpses.get(nk).push(d);
  }
  const pd = TAC.pend, tgt = !all && pd && pd.tx != null ? MI(m, pd.tx, pd.ty) : -1, ents = [];
  R.hits = []; R.objHits = [];
  for (let nk = kMin; nk <= kMax; nk++) {
    const list = byKey.get(nk) || [];
    for (const i of list) {
      const t = m.tiles[i], x = i % m.w, y = (i / m.w) | 0;
      DIM = vis(i) ? 1 : 0.45;
      const ct = m.cont[i];
      if (ct && ct.s && !Object.keys(ct.loot).length) DIM *= 0.72;
      if (lod === 0) continue;
      if (pSl.has(i)) drawPrims(c, pSl.get(i));
      if (isFlatT(t) && !ct) continue;
      if (!isFlatT(t)) drawTileObj(c, m, x, y, i, lod, t === T.TREE ? cutT.has(i) : cutW.has(i));
      if (ct || isDoorT(t)) {
        const hh = isDoorT(t) ? 1.1 : OBJ_H[t] ?? 0.8;
        P(x + 0.5, y + 0.5, 0); const bx = PX, by = PY; P(x + 0.5, y + 0.5, hh);
        R.objHits.push({ x, y, x0: bx - k * 0.55, x1: bx + k * 0.55, y0: PY - k * 0.3, y1: by + k * 0.3 });
      }
    }
    DIM = 1;
    const cl = corpses.get(nk);
    if (cl && lod > 0) for (const d of cl) {
      P(d.x + 0.5, d.y + 0.5, 0);
      const p = d.t0 ? (now - d.t0) / 620 : 2, fr = p < 0.33 ? 'd0' : p < 0.66 ? 'd1' : 'd2';
      if (p < 1) R.until = Math.max(R.until, now + 60);
      const L = d.k === 'ucorpse' ? Spr.look(d.u, 'h') : Spr.look({ type: d.zt, id: d.zid, rf: d.rf }, 'z');
      c.globalAlpha = vis(MI(m, d.x, d.y)) ? 1 : 0.5;
      Spr.draw(c, L, fr, spriteDir(d.f ?? 2), PX, PY, k);
      c.globalAlpha = 1;
      if (d.rise && !all && vis(MI(m, d.x, d.y))) {
        const left = d.rise - m.turn, a = 0.35 + 0.25 * Math.sin(now / 260);
        c.strokeStyle = `rgba(164,208,60,${left <= 1 ? a + 0.25 : a})`; c.lineWidth = Math.max(1.5, k * 0.035);
        c.beginPath(); c.ellipse(PX, PY, k * 0.42, k * 0.42 * CB.sE, 0, 0, Math.PI * 2); c.stroke();
        R.until = Math.max(R.until, now + 300);
      }
    }
    const el = rows.get(nk);
    if (el) {
      for (const it of el) { P(it.px + 0.5, it.py + 0.5, 0); it.sx = PX; }
      el.sort((a, b) => a.sx - b.sx);
      for (const it of el) { drawFigureIso(c, m, it, k, now, tgt, lod); ents.push(it); }
    }
    if (lod > 0) for (const i of list) {
      const t = m.tiles[i];
      if (t !== T.CROP && t !== T.BUSH) continue;
      DIM = vis(i) ? 1 : 0.45;
      const x = i % m.w, y = (i / m.w) | 0;
      if (t === T.CROP) { if (lod > 0) drawCropIso(c, m, x, y, i, lod); }
      else drawBushIso(c, x, y, occ.has(i));
    }
    DIM = 1;
  }
  // E. свет: сумерки и ночь — темнота с пятнами фонарей
  if (!all) lightLayer(c, m, now, W, H, dpr, gfx);
  // F. виньетка
  if (gfx >= 2) {
    const vg = layer('vg', W, H, dpr), key = vg.width + 'x' + vg.height;
    if (LAYERS.vgKey !== key) {
      const v = vg.getContext('2d'), g = v.createRadialGradient(vg.width / 2, vg.height / 2, Math.min(vg.width, vg.height) * 0.35, vg.width / 2, vg.height / 2, Math.hypot(vg.width, vg.height) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
      v.clearRect(0, 0, vg.width, vg.height); v.fillStyle = g; v.fillRect(0, 0, vg.width, vg.height);
      LAYERS.vgKey = key;
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(vg, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // G. метки добычи, надписи, значки, эффекты
  for (const kk in m.cont) {
    const i = +kk, x = i % m.w, y = (i / m.w) | 0;
    if (x < x0 || x > x1 || y < y0 || y > y1 || !seen(i)) continue;
    const ct = m.cont[kk];
    if (ct.s && !Object.keys(ct.loot).length) continue;
    P(x + 0.5, y + 0.5, (OBJ_H[m.tiles[i]] ?? 0.8) + 0.32);
    if (PX < -20 || PX > W + 20 || PY < -20 || PY > H + 20) continue;
    const s = Math.max(3.5, k * 0.12);
    c.beginPath(); c.moveTo(PX, PY - s); c.lineTo(PX + s, PY); c.lineTo(PX, PY + s); c.lineTo(PX - s, PY); c.closePath();
    if (!ct.s) { c.fillStyle = '#e8a62b'; c.fill(); c.strokeStyle = '#1b1406'; c.lineWidth = 1; c.stroke(); }
    else { c.strokeStyle = '#e8a62b'; c.lineWidth = 1.5; c.stroke(); }
  }
  for (const p of m.props) if (p.start && seen(MI(m, p.x, p.y))) {
    P(p.x + p.w / 2, p.y + p.h / 2, 1.7);
    c.font = `600 ${clamp(k * 0.32, 11, 17)}px Oswald, "Arial Narrow", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText('ВЫХОД', PX, PY);
    c.fillStyle = '#a0c86e'; c.fillText('ВЫХОД', PX, PY);
  }
  if (all) return;
  for (const it of ents) drawBadges(c, it, k, lod);
  drawFX(c, now, gfx);
}
function drawFigureIso(c, m, it, k, now, tgt, lod) {
  P(it.px + 0.5, it.py + 0.5, 0);
  it.cx = PX; it.fy = PY;
  const big = it.z && it.e.type === 'brute' ? 1.3 : 1, rx = k * 0.36 * big, ry = rx * CB.sE;
  if (!((CFG.gfx ?? 2) >= 1 && lod >= 1)) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(PX, PY, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); c.fill(); }
  if (it.cap) {
    const L = Spr.look({ sid: 'cap' + it.e.name, name: it.e.name, g: it.e.g, color: it.e.color, trait: 'quiet', melee: null, ranged: null }, 'h');
    it.top = Spr.draw(c, L, 'i0', spriteDir(0), PX, PY, k);
    c.strokeStyle = '#8a7a56'; c.lineWidth = Math.max(1, k * 0.03);
    P(it.px + 0.8, it.py + 0.5, 0.75); const rx2 = PX, ry2 = PY; P(it.px + 0.55, it.py + 0.5, 0.55);
    c.beginPath(); c.moveTo(PX, PY); c.lineTo(rx2, ry2); c.stroke();
    R.objHits.push({ x: it.e.x, y: it.e.y, x0: it.cx - k * 0.4, x1: it.cx + k * 0.4, y0: it.top, y1: it.fy + k * 0.2 });
    return;
  }
  if (it.base) {
  } else if (!it.z) {
    const sel = it.e.id === TAC.sel;
    c.strokeStyle = sel ? '#e8a62b' : it.e.color; c.globalAlpha = sel ? 1 : 0.6;
    c.lineWidth = Math.max(sel ? 2 : 1.5, k * (sel ? 0.05 : 0.032));
    c.beginPath(); c.ellipse(PX, PY, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
  } else if (MI(m, it.e.x, it.e.y) === tgt) {
    c.strokeStyle = '#ff6a50'; c.lineWidth = Math.max(2, k * 0.05);
    c.beginPath(); c.ellipse(PX, PY, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2); c.stroke();
  } else if (isHuman(it.e)) {
    c.strokeStyle = ZT[it.e.type].body; c.globalAlpha = 0.75; c.lineWidth = Math.max(1.5, k * 0.035);
    c.setLineDash([k * 0.12, k * 0.08]);
    c.beginPath(); c.ellipse(PX, PY, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]); c.globalAlpha = 1;
  }
  if (lod === 0) {
    c.fillStyle = it.z ? ZT[it.e.type].body : it.e.color;
    circ(c, PX, PY - k * 0.3, Math.max(2.5, k * 0.3)); c.fill();
    it.top = PY - k * 0.7;
  } else {
    const L = Spr.look(it.e, it.z ? 'z' : 'h'), fr = frameOf(it.e, now), dir = spriteDir(it.e.f ?? 2);
    it.top = Spr.draw(c, L, fr, dir, PX, PY, k);
    if (it.e.hitT && now - it.e.hitT < 110) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * (1 - (now - it.e.hitT) / 110);
      Spr.draw(c, L, fr, dir, PX, PY, k);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
  }
  R.hits.push({ e: it.e, z: it.z, x0: PX - k * 0.38, x1: PX + k * 0.38, y0: it.top, y1: PY + k * 0.15 });
}
function lightLayer(c, m, now, W, H, dpr, gfx) {
  const tod = m.tod ?? timeOfDay(m);
  const flashes = FX.list.filter(f => f.k === 'flash' && now - f.t0 < f.d);
  if (!tod && !flashes.length) return;
  if (gfx === 0) {
    if (tod) { c.fillStyle = tod === 1 ? 'rgba(40,24,60,0.16)' : 'rgba(8,14,44,0.32)'; c.fillRect(0, 0, W, H); }
    return;
  }
  const k = CB.k;
  if (tod) {
    const lc = layer('lc', W, H, dpr), l = lc.getContext('2d');
    l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, lc.width, lc.height);
    l.fillStyle = tod === 1 ? 'rgba(34,20,58,0.42)' : 'rgba(5,9,28,0.74)';
    l.fillRect(0, 0, lc.width, lc.height);
    l.setTransform(dpr, 0, 0, dpr, 0, 0);
    l.globalCompositeOperation = 'destination-out';
    const sr = sightR(m);
    for (const u of m.units ? liveUnits(m) : []) {
      const [px, py] = animPos(u, now);
      P(px + 0.5, py + 0.5, 0);
      const rad = (sr + (u.trait === 'hunter' ? 2 : 0)) * k * 0.9;
      l.save(); l.translate(PX, PY); l.scale(1, CB.sE);
      const g = l.createRadialGradient(0, 0, rad * 0.12, 0, 0, rad);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.82)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(0, 0, rad, 0, Math.PI * 2); l.fill();
      l.restore();
      if (tod === 2) {
        const a = ((u.f ?? 2) * Math.PI) / 4, len = sr + 3, cx0 = px + 0.5, cy0 = py + 0.5;
        P(cx0, cy0, 0.9); const sx0 = PX, sy0 = PY;
        P(cx0 + Math.cos(a - 0.38) * len, cy0 + Math.sin(a - 0.38) * len, 0); const ax = PX, ay = PY;
        P(cx0 + Math.cos(a + 0.38) * len, cy0 + Math.sin(a + 0.38) * len, 0); const bx = PX, by = PY;
        P(cx0 + Math.cos(a) * len, cy0 + Math.sin(a) * len, 0);
        const g2 = l.createLinearGradient(sx0, sy0, PX, PY);
        g2.addColorStop(0, 'rgba(0,0,0,0.95)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = g2; l.beginPath(); l.moveTo(sx0, sy0); l.lineTo(ax, ay); l.lineTo(bx, by); l.closePath(); l.fill();
      }
    }
    for (const [fx, fy] of m.fires || []) {
      P(fx + 0.5, fy + 0.5, 0);
      const fl = 1 + Math.sin(now / 90) * 0.04 + Math.sin(now / 37) * 0.03, rad = k * 4.2 * fl;
      l.save(); l.translate(PX, PY); l.scale(1, CB.sE);
      const g = l.createRadialGradient(0, 0, rad * 0.1, 0, 0, rad);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(0, 0, rad, 0, Math.PI * 2); l.fill();
      l.restore();
    }
    for (const fl of flashes) {
      P(fl.x + 0.5, fl.y + 0.5, 1);
      const g = l.createRadialGradient(PX, PY, 0, PX, PY, k * 4);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.fillRect(PX - k * 4, PY - k * 4, k * 8, k * 8);
    }
    l.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(lc, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // тёплые вспышки выстрелов
  c.globalCompositeOperation = 'lighter';
  for (const fl of flashes) {
    const p = (now - fl.t0) / fl.d;
    P(fl.x + 0.5, fl.y + 0.5, 1);
    const g = c.createRadialGradient(PX, PY, 0, PX, PY, k * 2.4);
    g.addColorStop(0, `rgba(255,190,90,${0.45 * (1 - p)})`); g.addColorStop(1, 'rgba(255,140,40,0)');
    c.fillStyle = g; c.fillRect(PX - k * 2.4, PY - k * 2.4, k * 4.8, k * 4.8);
  }
  c.globalCompositeOperation = 'source-over';
}
