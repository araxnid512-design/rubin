// Навигационная сетка сектора (0,5 м) поверх рельефа: препятствия — коллайдеры зданий, деревьев и камней
// (высота считается от земли под коллайдером), непроходимы склоны круче ~40° и края карты.
import { NavGrid } from '../engine/nav.js';
import { V3 } from '../engine/math.js';

export class FrontNav extends NavGrid {
  constructor(sector) { super(150, 0.5, 0.35); this.s = sector; }
  _raster(c, x0c, z0c, x1c, z1c) {
    const h = this.s.h(c.cx, c.cz);
    if (!c.enabled || !(c.layer & 1) || c.y1 - h < 0.3 || c.y0 - h > 1.7) return;
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
  _slopes(x0, z0, x1, z1) {
    const n = this.n, h = (x, z) => this.s.h(x, z);
    for (let z = z0 - (z0 & 1); z <= z1; z += 2) for (let x = x0 - (x0 & 1); x <= x1; x += 2) {
      const wx = this.toWorld(x) + 0.25, wz = this.toWorld(z) + 0.25;
      const g = Math.hypot(h(wx + 0.6, wz) - h(wx - 0.6, wz), h(wx, wz + 0.6) - h(wx, wz - 0.6)) / 1.2;
      if (g > 0.85) for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) if (x + dx < n && z + dz < n) this.blocked[(z + dz) * n + x + dx] = 1;
    }
  }
  buildAll(phys) { const t0 = performance.now(); this.build(phys.colliders.filter((c) => c.enabled)); this._slopes(0, 0, this.n - 1, this.n - 1); this.ms = performance.now() - t0; return this; }
  rebuildRegion(cx, cz, radius, phys) {
    super.rebuildRegion(cx, cz, radius, phys);
    this._slopes(Math.max(0, this.toCell(cx - radius)), Math.max(0, this.toCell(cz - radius)), Math.min(this.n - 1, this.toCell(cx + radius)), Math.min(this.n - 1, this.toCell(cz + radius)));
  }
  path(ax, az, bx, bz) { return this.findPath(new V3(ax, 0, az), new V3(bx, 0, bz), 40000); }
}
