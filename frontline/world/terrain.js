// Рельеф сектора 300×300 м: сетка высот 2 м, дороги по сплайну, поле металлолома, биомы трёх карт.
// Настоящая геометрия: высота и нормаль в любой точке, проверка уклона, луч камеры по земле.
import { V3, RNG, clamp, lerp, smoothstep } from '../../engine/math.js';
import { MeshBuilder } from '../../engine/mesh.js';

const v = (x, y, z) => new V3(x, y, z);
// ---------------------------------------------------------------- шум
function hash2(x, z, s) { let h = (x * 374761393 + z * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}
export function fbm(x, z, s, oct = 4) { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < oct; i++) { a += vnoise(x * f, z * f, s + i * 17) * amp; f *= 2; amp *= 0.5; } return a / 0.9375; }
const ridged = (x, z, s) => 1 - Math.abs(fbm(x, z, s, 4) * 2 - 1);
const gauss = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));

// ---------------------------------------------------------------- дороги: сглаженный сплайн Катмулла—Рома
export function splinePolyline(pts, step = 1.5) {
  const P = pts.map((p) => [p[0], p[1]]), out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
function distToPolyline(x, z, pl) {
  let best = Infinity;
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, az] = pl[i], [bx, bz] = pl[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * t - x, pz = az + dz * t - z, d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export const STYLE = {
  summer_grass_pine_birch: { seed: 11, rock: 0.55, sky: [0.47, 0.55, 0.62], ground: [0.27, 0.27, 0.2], fog: [0.66, 0.72, 0.74], sun: [1.15, 1.08, 0.95] },
  worn_grass_mud_craters_bare_trees: { seed: 23, rock: 0.75, sky: [0.46, 0.5, 0.54], ground: [0.27, 0.25, 0.21], fog: [0.62, 0.64, 0.63], sun: [1.08, 1.02, 0.92] },
  cold_rocky_plateau_sparse_pines: { seed: 37, rock: 1.0, sky: [0.45, 0.5, 0.58], ground: [0.25, 0.25, 0.24], fog: [0.62, 0.66, 0.7], sun: [1.0, 1.0, 0.98] },
};

export class Terrain {
  constructor(def) {
    this.def = def; this.style = STYLE[def.terrain_style]; this.seed = this.style.seed;
    this.cell = 2; this.n = 151; this.half = 150;
    this.road = splinePolyline(def.road_centerline_xz);
    this.branches = [];
    const f = def.scrap_field;
    if (f) { // ответвление грунтовки к полю металлолома (как на референсах)
      const c = f.center_xz, from = this.road.reduce((b, p) => (Math.hypot(p[0] - c[0], p[1] - c[1]) < Math.hypot(b[0] - c[0], b[1] - c[1]) ? p : b), this.road[0]);
      this.branches.push(splinePolyline([from, [lerp(from[0], c[0], 0.5), lerp(from[1], c[1], 0.5) + 6], [c[0] - f.width_m / 2 - 2, c[1] + 4]], 1.5));
    }
    this.craters = [];
    if (def.terrain_style.startsWith('worn')) {
      const rng = new RNG(91);
      for (let i = 0; i < 26; i++) { const x = rng.range(-70, 70), z = rng.range(-135, 135); if (this.roadDist(x, z) < 9) continue; this.craters.push([x, z, rng.range(3, 9), rng.range(0.6, 1.8), rng.range(0, 6.28)]); }
    }
    this.h = new Float32Array(this.n * this.n);
    for (let iz = 0; iz < this.n; iz++) for (let ix = 0; ix < this.n; ix++) this.h[iz * this.n + ix] = this.baseHeight(-150 + ix * 2, -150 + iz * 2);
    this.smoothRoad();
  }
  roadDist(x, z) { let d = distToPolyline(x, z, this.road); for (const b of this.branches) d = Math.min(d, distToPolyline(x, z, b) + 1.2); return d; }
  inScrapField(x, z, margin = 0) { const f = this.def.scrap_field; return !!f && Math.abs(x - f.center_xz[0]) < f.width_m / 2 + margin && Math.abs(z - f.center_xz[1]) < f.depth_m / 2 + margin; }
  baseHeight(x, z) {
    const s = this.seed, st = this.def.terrain_style;
    let h = 0;
    if (st.startsWith('summer')) {
      h = (fbm(x * 0.012, z * 0.012, s) - 0.5) * 2.2 + (fbm(x * 0.05, z * 0.05, s + 5) - 0.5) * 0.5;
      h += 12 * gauss(x, z, -122, -78, 38, 60) + 5 * gauss(x, z, -95, -20, 30, 30);          // лесистый холм на западе
      h += 3 * smoothstep(118, 150, x) + 2.2 * smoothstep(110, 150, -x) + 1.5 * smoothstep(120, 150, -z);
      const zc = this.def.buildable_zone_center_xz, dz = Math.hypot(x - zc[0], z - zc[1]);
      h = lerp(h, h * 0.25, 1 - smoothstep(this.def.buildable_zone_radius_m * 0.7, this.def.buildable_zone_radius_m, dz)); // ровная стройплощадка
    } else if (st.startsWith('worn')) {
      h = (fbm(x * 0.014, z * 0.014, s) - 0.5) * 2.6 + (fbm(x * 0.06, z * 0.06, s + 3) - 0.5) * 0.6;
      h += (8 + 6 * fbm(x * 0.02, z * 0.03, s + 9)) * smoothstep(-78, -118, x);                 // каменистый хребет на западе
      h += (4 + 4 * fbm(x * 0.03, z * 0.025, s + 11)) * smoothstep(80, 112, x);                 // низкие холмы на востоке
      h -= 1.3 * gauss(x, z, 38, 34, 22, 16);                                                     // заболоченная низина
      for (const [cx, cz, r, d, a] of this.craters) {                                              // воронки: неровные, с бруствером
        const k = Math.hypot(x - cx, z - cz) / (r * (0.85 + 0.3 * vnoise(Math.atan2(z - cz, x - cx) * 2 + a, 0, s)));
        if (k < 1.35) h += k < 1 ? -d * (1 - k * k) : d * 0.35 * (1 - (k - 1) / 0.35);
      }
    } else {
      h = (fbm(x * 0.016, z * 0.016, s) - 0.5) * 1.6 + (fbm(x * 0.07, z * 0.07, s + 2) - 0.5) * 0.7;
      const rid = ridged(x * 0.02, z * 0.02, s + 4);
      h += (9 + 14 * rid) * smoothstep(-82, -112, x);                                             // скальные уступы запада
      h += (8 + 12 * rid) * smoothstep(134, 148, x);                                              // уступ за полем металлолома
      h += (10 + 13 * rid) * smoothstep(-102, -138, z) * (1 - smoothstep(130, 150, z));           // гряда на севере
      h += 5 * rid * smoothstep(60, 135, Math.hypot(x + 10, z + 25)) * (1 - smoothstep(110, 150, z)); // каменистые бугры по краям плато
    }
    if (this.inScrapField(x, z, 10)) { const k = this.inScrapField(x, z, 0) ? 1 : 0.6; h = lerp(h, 0.2, k); }
    return h;
  }
  smoothRoad() { // полотно дороги — плавный продольный профиль, без резких уклонов поперёк
    const n = this.n, src = this.h.slice();
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const x = -150 + ix * 2, z = -150 + iz * 2, d = this.roadDist(x, z);
      if (d > 9) continue;
      let sum = 0, w = 0;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const jx = clamp(ix + dx, 0, n - 1), jz = clamp(iz + dz, 0, n - 1); sum += src[jz * n + jx]; w++; }
      const k = 1 - smoothstep(4, 9, d);
      this.h[iz * n + ix] = lerp(src[iz * n + ix], sum / w - 0.08, k);
    }
  }
  height(x, z) {
    const fx = clamp((x + 150) / 2, 0, this.n - 1.001), fz = clamp((z + 150) / 2, 0, this.n - 1.001), ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, n = this.n;
    const a = this.h[iz * n + ix], b = this.h[iz * n + ix + 1], c = this.h[(iz + 1) * n + ix], d = this.h[(iz + 1) * n + ix + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }
  normal(x, z) { const e = 1; return v(this.height(x - e, z) - this.height(x + e, z), 2 * e, this.height(x, z - e) - this.height(x, z + e)).norm(); }
  slopeDeg(x, z) { return Math.acos(clamp(this.normal(x, z).y, -1, 1)) * 180 / Math.PI; }
  // луч от камеры к земле (марш с уточнением)
  raycast(o, d, maxT = 400) {
    let t = 0, prev = o.y - this.height(o.x, o.z);
    for (let i = 0; i < 800 && t < maxT; i++) {
      t += 0.5 + t * 0.01; const p = o.add(d.mul(t)), diff = p.y - this.height(p.x, p.z);
      if (diff <= 0) { let a = t - (0.5 + t * 0.01), b = t; for (let k = 0; k < 12; k++) { const m = (a + b) / 2, q = o.add(d.mul(m)); if (q.y - this.height(q.x, q.z) > 0) a = m; else b = m; } return o.add(d.mul(b)); }
      prev = diff;
    }
    return null;
  }
  // цвет земли: биом, дорога, поле металлолома, воронки
  color(x, z, h, n) {
    const s = this.seed, st = this.def.terrain_style, g = fbm(x * 0.03, z * 0.03, s + 30), m = fbm(x * 0.11, z * 0.11, s + 31);
    let c;
    if (st.startsWith('summer')) {
      c = [lerp(0.33, 0.45, g), lerp(0.48, 0.56, m), lerp(0.18, 0.24, g)];
      if (m > 0.68) c = [0.52, 0.54, 0.26]; // светлые прогалины
      const forest = smoothstep(100, 125, Math.abs(x)); c = c.map((a, i) => lerp(a, [0.24, 0.34, 0.16][i], forest * 0.7));
    } else if (st.startsWith('worn')) {
      c = [lerp(0.42, 0.5, g), lerp(0.42, 0.47, m), lerp(0.26, 0.3, g)];
      const mud = smoothstep(0.55, 0.75, fbm(x * 0.05, z * 0.05, s + 32)); c = c.map((a, i) => lerp(a, [0.36, 0.31, 0.24][i], mud * 0.8));
      for (const [cx, cz, r] of this.craters) { const k = 1 - smoothstep(r * 0.5, r * 1.15, Math.hypot(x - cx, z - cz)); c = c.map((a, i) => lerp(a, [0.27, 0.23, 0.19][i], k * 0.8)); }
      const swamp = gauss(x, z, 38, 34, 18, 13); c = c.map((a, i) => lerp(a, [0.22, 0.27, 0.2][i], swamp * 0.8));
    } else {
      c = [lerp(0.48, 0.56, g), lerp(0.45, 0.5, m), lerp(0.32, 0.36, g)];
      const gravel = smoothstep(0.5, 0.75, m); c = c.map((a, i) => lerp(a, [0.45, 0.44, 0.41][i], gravel * 0.6));
    }
    const rd = this.roadDist(x, z), road = (1 - smoothstep(3, 7, rd + (m - 0.5) * 1.5)) * 0.55; // притоптанная обочина у ленты дороги
    c = c.map((a, i) => lerp(a, [0.46, 0.4, 0.28][i], road));
    if (this.inScrapField(x, z, 3)) c = c.map((a, i) => lerp(a, [0.38, 0.32, 0.25][i], 0.7));
    return c;
  }
  // меш: чанки 50×50 м (отсечение по фрустуму)
  buildChunks() {
    const out = [], per = 25, n = this.n, rock = this.style.rock;
    const normalAt = (ix, iz) => { const H = (a, b) => this.h[clamp(b, 0, n - 1) * n + clamp(a, 0, n - 1)]; return v(H(ix - 1, iz) - H(ix + 1, iz), 4, H(ix, iz - 1) - H(ix, iz + 1)).norm(); };
    for (let cz = 0; cz < 6; cz++) for (let cx = 0; cx < 6; cx++) {
      const mb = new MeshBuilder(), base = [];
      const x0 = cx * per, z0 = cz * per;
      for (let iz = z0; iz <= z0 + per; iz++) for (let ix = x0; ix <= x0 + per; ix++) {
        const x = -150 + ix * 2, z = -150 + iz * 2, h = this.h[iz * n + ix], nm = normalAt(ix, iz), c = this.color(x, z, h, nm);
        mb.p.push(x, h, z); mb.n.push(nm.x, nm.y, nm.z); mb.c.push(c[0], c[1], c[2], rock);
      }
      const W = per + 1;
      for (let iz = 0; iz < per; iz++) for (let ix = 0; ix < per; ix++) { const a = iz * W + ix, b = a + 1, c = a + W, d = c + 1; mb.i.push(a, c, b, b, c, d); }
      out.push(mb);
    }
    return out;
  }
  // цветная карта для мини-карты
  mapImage(size = 150) {
    const img = new Uint8ClampedArray(size * size * 4);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = -150 + (i + 0.5) * 300 / size, z = -150 + (j + 0.5) * 300 / size, h = this.height(x, z), nm = this.normal(x, z);
      let c = this.color(x, z, h, nm); const sh = 0.75 + 0.35 * clamp(nm.x * 0.6 - nm.z * 0.6 + nm.y * 0.5, 0, 1);
      if (nm.y < 0.82) c = c.map((a, k) => lerp(a, [0.42, 0.41, 0.38][k], this.style.rock));
      const k = (j * size + i) * 4; img[k] = c[0] * 255 * sh; img[k + 1] = c[1] * 255 * sh; img[k + 2] = c[2] * 255 * sh; img[k + 3] = 255;
    }
    return img;
  }
}
