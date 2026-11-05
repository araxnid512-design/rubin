// Движок: физика плоской локации.
// Статичные препятствия — ориентированные боксы (OBB) в пространственной сетке.
// Персонажи — окружности в плоскости XZ (капсула на ровной земле); лучи — точная проверка OBB в 3D.
import { V3 } from './math.js';

const CELL = 4;

export class Collider {
  constructor(xf, size, layer = 1, owner = null) {
    // 3D-бокс: обратный базис для перевода луча в локальные координаты
    this.xf = xf; this.size = size; this.half = size.mul(0.5); this.layer = layer; this.owner = owner; this.enabled = true;
    this.inv = xf.inv();
    // проекция на плоскость: если бокс почти вертикален — OBB по рысканию, иначе AABB его углов
    const b = xf.basis; const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(xf.mulV(new V3(sx * this.half.x, sy * this.half.y, sz * this.half.z)));
    this.y0 = Math.min(...corners.map((c) => c.y)); this.y1 = Math.max(...corners.map((c) => c.y));
    if (Math.abs(b.y.y) > 0.9) {
      const ax = new V3(b.x.x, 0, b.x.z).norm();
      this.cx = xf.origin.x; this.cz = xf.origin.z; this.ux = ax.x; this.uz = ax.z;
      this.hx = this.half.x * Math.hypot(b.x.x, b.x.z) + this.half.y * Math.hypot(b.y.x, b.y.z) * 0;
      this.hz = this.half.z * Math.hypot(b.z.x, b.z.z);
      // учёт наклона: расширяем на проекцию вертикальной оси
      const tilt = this.half.y * Math.hypot(b.y.x, b.y.z);
      this.hx += tilt; this.hz += tilt;
    } else {
      const xs = corners.map((c) => c.x), zs = corners.map((c) => c.z);
      const mnx = Math.min(...xs), mxx = Math.max(...xs), mnz = Math.min(...zs), mxz = Math.max(...zs);
      this.cx = (mnx + mxx) / 2; this.cz = (mnz + mxz) / 2; this.ux = 1; this.uz = 0; this.hx = (mxx - mnx) / 2; this.hz = (mxz - mnz) / 2;
    }
    this.r2 = Math.hypot(this.hx, this.hz);
  }
  // ближайшая точка 2D-прямоугольника к (x, z)
  closest(x, z) {
    const dx = x - this.cx, dz = z - this.cz;
    let lx = dx * this.ux + dz * this.uz, lz = -dx * this.uz + dz * this.ux;
    lx = Math.max(-this.hx, Math.min(this.hx, lx)); lz = Math.max(-this.hz, Math.min(this.hz, lz));
    return [this.cx + lx * this.ux - lz * this.uz, this.cz + lx * this.uz + lz * this.ux];
  }
  // пересечение луча с 3D-боксом: расстояние или -1
  ray(o, d, maxT) {
    const lo = this.inv.mulV(o), ld = this.inv.basis.mulV(d);
    let t0 = 0, t1 = maxT; const h = this.half;
    for (const a of ['x', 'y', 'z']) {
      if (Math.abs(ld[a]) < 1e-9) { if (lo[a] < -h[a] || lo[a] > h[a]) return -1; continue; }
      let ta = (-h[a] - lo[a]) / ld[a], tb = (h[a] - lo[a]) / ld[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
    }
    return t0;
  }
  normalAt(p) {
    const lp = this.inv.mulV(p), h = this.half;
    let best = 'x', bd = Infinity;
    for (const a of ['x', 'y', 'z']) { const d = h[a] - Math.abs(lp[a]); if (d < bd) { bd = d; best = a; } }
    const n = new V3(); n[best] = Math.sign(lp[best]) || 1;
    return this.xf.basis.mulV(n).norm();
  }
}

export class Physics {
  constructor(half = 150) {
    this.half = half; this.n = Math.ceil((half * 2) / CELL);
    this.cells = Array.from({ length: this.n * this.n }, () => []);
    this.colliders = [];
    this.bodies = []; // динамические персонажи {pos, radius, layer, owner, height}
    this._stamp = 1; this._seen = new Map();
  }
  _range(c) {
    const r = c.r2;
    const x0 = Math.max(0, Math.floor((c.cx - r + this.half) / CELL)), x1 = Math.min(this.n - 1, Math.floor((c.cx + r + this.half) / CELL));
    const z0 = Math.max(0, Math.floor((c.cz - r + this.half) / CELL)), z1 = Math.min(this.n - 1, Math.floor((c.cz + r + this.half) / CELL));
    return [x0, x1, z0, z1];
  }
  add(xf, size, layer = 1, owner = null) {
    const c = new Collider(xf, size, layer, owner); c.id = this.colliders.length; this.colliders.push(c);
    const [x0, x1, z0, z1] = this._range(c);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.cells[z * this.n + x].push(c);
    return c;
  }
  remove(c) {
    c.enabled = false;
    const [x0, x1, z0, z1] = this._range(c);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const a = this.cells[z * this.n + x]; const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); }
  }
  near(x, z, r) {
    const out = [], stamp = ++this._stamp;
    const x0 = Math.max(0, Math.floor((x - r + this.half) / CELL)), x1 = Math.min(this.n - 1, Math.floor((x + r + this.half) / CELL));
    const z0 = Math.max(0, Math.floor((z - r + this.half) / CELL)), z1 = Math.min(this.n - 1, Math.floor((z + r + this.half) / CELL));
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) for (const c of this.cells[cz * this.n + cx]) {
      if (c._s === stamp || !c.enabled) continue; c._s = stamp; out.push(c);
    }
    return out;
  }
  // Перемещение окружности с выталкиванием из препятствий (скольжение вдоль стен)
  move(body, dx, dz) {
    const p = body.pos, r = body.radius;
    let nx = p.x + dx, nz = p.z + dz;
    const list = this.near(nx, nz, r + 2);
    for (let it = 0; it < 3; it++) {
      let pushed = false;
      for (const c of list) {
        if (!(c.layer & body.mask)) continue;
        if (c.y1 < p.y + 0.3 || c.y0 > p.y + 1.7) continue;
        const [qx, qz] = c.closest(nx, nz); const ex = nx - qx, ez = nz - qz, d2 = ex * ex + ez * ez;
        if (d2 < r * r) {
          if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; nx += ex * k; nz += ez * k; }
          else { // центр внутри бокса — выталкиваем по кратчайшей оси
            const ddx = nx - c.cx, ddz = nz - c.cz; const lx = ddx * c.ux + ddz * c.uz, lz = -ddx * c.uz + ddz * c.ux;
            if (c.hx - Math.abs(lx) < c.hz - Math.abs(lz)) { const s = Math.sign(lx) || 1, push = c.hx - Math.abs(lx) + r; nx += c.ux * s * push; nz += c.uz * s * push; }
            else { const s = Math.sign(lz) || 1, push = c.hz - Math.abs(lz) + r; nx += -c.uz * s * push; nz += c.ux * s * push; }
          }
          pushed = true;
        }
      }
      // другие персонажи — мягкое разведение
      for (const o of this.bodies) {
        if (o === body || !o.solid || !(o.layer & body.mask)) continue;
        const ex = nx - o.pos.x, ez = nz - o.pos.z, d2 = ex * ex + ez * ez, rr = r + o.radius;
        if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), k = (rr - d) / d * 0.5; nx += ex * k; nz += ez * k; pushed = true; }
      }
      if (!pushed) break;
    }
    const lim = this.half - 0.6;
    nx = Math.max(-lim, Math.min(lim, nx)); nz = Math.max(-lim, Math.min(lim, nz));
    p.x = nx; p.z = nz;
  }
  // Луч: ближайшее пересечение со статикой (маска) и персонажами (bodies)
  raycast(o, dir, maxT, mask = 1, exclude = null, hitBodies = true) {
    const d = dir.norm(); let best = null, bt = maxT;
    const steps = Math.ceil(maxT / CELL) + 1, stamp = ++this._stamp;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(i * CELL, maxT), px = o.x + d.x * t, pz = o.z + d.z * t;
      const cx = Math.floor((px + this.half) / CELL), cz = Math.floor((pz + this.half) / CELL);
      for (let zz = cz - 1; zz <= cz + 1; zz++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
        if (xx < 0 || zz < 0 || xx >= this.n || zz >= this.n) continue;
        for (const c of this.cells[zz * this.n + xx]) {
          if (c._s === stamp || !c.enabled || !(c.layer & mask)) continue; c._s = stamp;
          const h = c.ray(o, d, bt);
          if (h >= 0 && h < bt) { bt = h; best = { t: h, collider: c, body: null }; }
        }
      }
      if (best && t > bt + CELL) break;
    }
    if (hitBodies) for (const b of this.bodies) {
      if (!b.hittable || b === exclude || (exclude && b.owner === exclude)) continue;
      // вертикальный цилиндр
      const ox = o.x - b.pos.x, oz = o.z - b.pos.z, a = d.x * d.x + d.z * d.z;
      if (a < 1e-9) continue;
      const bb = 2 * (ox * d.x + oz * d.z), cc = ox * ox + oz * oz - b.radius * b.radius, disc = bb * bb - 4 * a * cc;
      if (disc < 0) continue;
      const t = (-bb - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t > bt) continue;
      const y = o.y + d.y * t;
      if (y < b.pos.y || y > b.pos.y + b.height) continue;
      bt = t; best = { t, collider: null, body: b };
    }
    if (best) { best.point = o.add(d.mul(best.t)); best.normal = best.collider ? best.collider.normalAt(best.point) : d.neg(); }
    return best;
  }
  lineClear(a, b, mask = 1) {
    const d = b.sub(a), l = d.len(); if (l < 1e-4) return true;
    return !this.raycast(a, d, l, mask, null, false);
  }
}
