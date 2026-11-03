// Движок «Долг»: навигационная сетка (0,5 м) и поиск пути A* со сглаживанием.
// Препятствия растрируются из коллайдеров с «раздутием» на радиус агента.
import { V3 } from './math.js';

const SQ2 = Math.SQRT2;

export class NavGrid {
  constructor(half = 150, cell = 0.5, agentRadius = 0.32) {
    this.half = half; this.cell = cell; this.n = Math.round((half * 2) / cell); this.r = agentRadius;
    const N = this.n * this.n;
    this.blocked = new Uint8Array(N);
    this.g = new Float32Array(N); this.parent = new Int32Array(N); this.stamp = new Uint32Array(N); this.closed = new Uint32Array(N);
    this.q = 0;
    this.heapN = new Int32Array(N); this.heapF = new Float32Array(N); this.heapSize = 0;
    this.stats = { queries: 0, expanded: 0, ms: 0 };
  }
  idx(x, z) { return z * this.n + x; }
  toCell(x) { return Math.floor((x + this.half) / this.cell); }
  toWorld(i) { return -this.half + (i + 0.5) * this.cell; }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < this.n && z < this.n; }
  walkable(x, z) { return this.inBounds(x, z) && !this.blocked[z * this.n + x]; }
  walkableAt(p) { return this.walkable(this.toCell(p.x), this.toCell(p.z)); }

  _raster(c, x0c, z0c, x1c, z1c) {
    if (!c.enabled || !(c.layer & 1) || c.y1 < 0.3 || c.y0 > 1.7) return;
    const r = this.r, ext = c.r2 + r;
    const x0 = Math.max(x0c, this.toCell(c.cx - ext)), x1 = Math.min(x1c, this.toCell(c.cx + ext));
    const z0 = Math.max(z0c, this.toCell(c.cz - ext)), z1 = Math.min(z1c, this.toCell(c.cz + ext));
    for (let z = z0; z <= z1; z++) {
      const wz = this.toWorld(z);
      for (let x = x0; x <= x1; x++) {
        const wx = this.toWorld(x); const [qx, qz] = c.closest(wx, wz);
        if ((wx - qx) * (wx - qx) + (wz - qz) * (wz - qz) <= r * r) this.blocked[z * this.n + x] = 1;
      }
    }
  }
  build(colliders) {
    this.blocked.fill(0);
    for (const c of colliders) this._raster(c, 0, 0, this.n - 1, this.n - 1);
    // край карты
    const m = Math.ceil(0.8 / this.cell);
    for (let z = 0; z < this.n; z++) for (let x = 0; x < this.n; x++) if (x < m || z < m || x >= this.n - m || z >= this.n - m) this.blocked[z * this.n + x] = 1;
  }
  rebuildRegion(cx, cz, radius, physics) {
    const x0 = Math.max(0, this.toCell(cx - radius)), x1 = Math.min(this.n - 1, this.toCell(cx + radius));
    const z0 = Math.max(0, this.toCell(cz - radius)), z1 = Math.min(this.n - 1, this.toCell(cz + radius));
    for (let z = z0; z <= z1; z++) this.blocked.fill(0, z * this.n + x0, z * this.n + x1 + 1);
    for (const c of physics.near(cx, cz, radius + 4)) this._raster(c, x0, z0, x1, z1);
  }
  nearestWalkable(p, maxR = 8) {
    const cx = this.toCell(p.x), cz = this.toCell(p.z);
    if (this.walkable(cx, cz)) return [cx, cz];
    const R = Math.ceil(maxR / this.cell);
    for (let r = 1; r <= R; r++) {
      let best = null, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.walkable(cx + dx, cz + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [cx + dx, cz + dz]; } }
      }
      if (best) return best;
    }
    return null;
  }
  // прямая видимость по клеткам
  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), steps = Math.ceil(l / (this.cell * 0.5));
    for (let i = 1; i < steps; i++) { const t = i / steps; if (!this.walkable(this.toCell(ax + dx * t), this.toCell(az + dz * t))) return false; }
    return true;
  }
  _push(node, f) {
    let i = this.heapSize++; const N = this.heapN, F = this.heapF;
    while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= f) break; N[i] = N[p]; F[i] = F[p]; i = p; }
    N[i] = node; F[i] = f;
  }
  _pop() {
    const N = this.heapN, F = this.heapF, top = N[0]; const n = --this.heapSize; const ln = N[n], lf = F[n];
    let i = 0;
    while (true) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && F[c + 1] < F[c]) c++; if (F[c] >= lf) break; N[i] = N[c]; F[i] = F[c]; i = c; }
    N[i] = ln; F[i] = lf; return top;
  }
  findPath(from, to, maxExpand = 60000) {
    const t0 = performance.now();
    this.stats.queries++;
    const s = this.nearestWalkable(from, 3), e = this.nearestWalkable(to, 6);
    if (!s || !e) return [];
    const n = this.n, start = s[1] * n + s[0], goal = e[1] * n + e[0];
    const q = ++this.q; const ex = e[0], ez = e[1];
    const h = (x, z) => { const dx = Math.abs(x - ex), dz = Math.abs(z - ez); return (dx + dz) + (SQ2 - 2) * Math.min(dx, dz); };
    this.heapSize = 0; this.g[start] = 0; this.stamp[start] = q; this.parent[start] = -1; this._push(start, h(s[0], s[1]));
    let best = start, bestH = Infinity, expanded = 0, found = false;
    while (this.heapSize > 0) {
      const cur = this._pop();
      if (this.closed[cur] === q) continue;
      this.closed[cur] = q;
      if (cur === goal) { found = true; break; }
      const cx = cur % n, cz = (cur / n) | 0;
      const hc = h(cx, cz); if (hc < bestH) { bestH = hc; best = cur; }
      if (++expanded > maxExpand) break;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkable(nx, nz)) continue;
        if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue; // без «срезания» углов
        const ni = nz * n + nx; if (this.closed[ni] === q) continue;
        const ng = this.g[cur] + (dx && dz ? SQ2 : 1);
        if (this.stamp[ni] !== q || ng < this.g[ni]) { this.stamp[ni] = q; this.g[ni] = ng; this.parent[ni] = cur; this._push(ni, ng + h(nx, nz) * 1.001); }
      }
    }
    this.stats.expanded += expanded;
    let node = found ? goal : best; const cells = [];
    while (node !== -1) { cells.push(node); node = this.parent[node]; if (cells.length > 5000) break; }
    cells.reverse();
    // сглаживание: оставляем только точки, между которыми нет прямой видимости
    const pts = cells.map((c) => new V3(this.toWorld(c % n), 0, this.toWorld((c / n) | 0)));
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.los(pts[i].x, pts[i].z, pts[j].x, pts[j].z)) j = Math.max(i + 1, j - Math.max(1, ((j - i) / 4) | 0));
      out.push(pts[j]); i = j;
    }
    if (found && out.length) { const last = out[out.length - 1]; if (this.walkableAt(to)) { last.x = to.x; last.z = to.z; } }
    this.stats.ms += performance.now() - t0;
    out.reached = found;
    return out;
  }
}
