// Движок: процедурная low-poly геометрия.
// Цвет вершины: [r, g, b, a], где rgb — альбедо (sRGB), a — код материала (MAT.*).
// Передние грани — против часовой стрелки (CCW), как принято в WebGL.
import { V3, M3, Xf, TAU } from './math.js';

export const MAT = { CONCRETE: 0.0, BRICK: 0.1, PAINT: 0.2, RUST: 0.3, WOOD: 0.4, CLOTH: 0.5, FOLIAGE: 0.6, GLASS: 0.7, LAMP: 0.8, SKIN: 0.9, RUBBER: 1.0 };

export const col = (r, g, b, m = 0) => [r, g, b, m];
export const withMat = (c, m) => [c[0], c[1], c[2], m];
export const darken = (c, k) => [c[0] * (1 - k), c[1] * (1 - k), c[2] * (1 - k), c[3]];
export const lighten = (c, k) => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k, c[3]];
export const jitter = (c, rng, amt = 0.08) => { const k = 1 + rng.range(-amt, amt); return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k), c[3]]; };

const FACES = [
  [new V3(1, 0, 0), new V3(0, 0, -1), new V3(0, 1, 0)],
  [new V3(-1, 0, 0), new V3(0, 0, 1), new V3(0, 1, 0)],
  [new V3(0, 1, 0), new V3(1, 0, 0), new V3(0, 0, -1)],
  [new V3(0, -1, 0), new V3(1, 0, 0), new V3(0, 0, 1)],
  [new V3(0, 0, 1), new V3(1, 0, 0), new V3(0, 1, 0)],
  [new V3(0, 0, -1), new V3(-1, 0, 0), new V3(0, 1, 0)],
];

export class MeshBuilder {
  constructor() {
    this.p = []; this.n = []; this.c = []; this.i = [];
    this.b = []; this.w = []; this.skinned = false;
    this._sb = [0, 0, 0, 0]; this._sw = [1, 0, 0, 0];
  }
  vcount() { return this.p.length / 3; }
  isEmpty() { return this.i.length === 0; }
  setBone(b) { this.skinned = true; this._sb = [b, 0, 0, 0]; this._sw = [1, 0, 0, 0]; }
  _v(pt, nm, c) {
    this.p.push(pt.x, pt.y, pt.z); this.n.push(nm.x, nm.y, nm.z); this.c.push(c[0], c[1], c[2], c[3]);
    if (this.skinned) { this.b.push(...this._sb); this.w.push(...this._sw); }
    return this.p.length / 3 - 1;
  }
  _vs(pt, nm, c, bb, ww) {
    this.p.push(pt.x, pt.y, pt.z); this.n.push(nm.x, nm.y, nm.z); this.c.push(c[0], c[1], c[2], c[3]);
    this.b.push(...bb); this.w.push(...ww);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c, color, n = null) {
    const fn = b.sub(a).cross(c.sub(a));
    if (fn.lenSq() < 1e-12) return;
    if (!n) n = fn.norm();
    const i0 = this._v(a, n, color), i1 = this._v(b, n, color), i2 = this._v(c, n, color);
    if (fn.dot(n) > 0) this.i.push(i0, i1, i2); else this.i.push(i0, i2, i1);
  }
  quad(p0, p1, p2, p3, color, n = null) {
    let fn = p1.sub(p0).cross(p2.sub(p0));
    if (fn.lenSq() < 1e-12) fn = p2.sub(p0).cross(p3.sub(p0));
    if (!n) n = fn.norm();
    const i0 = this._v(p0, n, color), i1 = this._v(p1, n, color), i2 = this._v(p2, n, color), i3 = this._v(p3, n, color);
    if (fn.dot(n) > 0) this.i.push(i0, i1, i2, i0, i2, i3); else this.i.push(i0, i2, i1, i0, i3, i2);
  }
  quadSmooth(p, n, color, faceN) {
    const fn = p[1].sub(p[0]).cross(p[2].sub(p[0]));
    const i0 = this._v(p[0], n[0], color), i1 = this._v(p[1], n[1], color), i2 = this._v(p[2], n[2], color), i3 = this._v(p[3], n[3], color);
    if (fn.dot(faceN) > 0) this.i.push(i0, i1, i2, i0, i2, i3); else this.i.push(i0, i2, i1, i0, i3, i2);
  }
  // Параллелепипед с центром в начале xf
  addBox(xf, size, color, skipBottom = false, topCol = null) {
    const h = size.mul(0.5), b = xf.basis;
    for (let fi = 0; fi < 6; fi++) {
      if (skipBottom && fi === 3) continue;
      const [n, u, v] = FACES[fi];
      const c = n.mulV(h), uu = u.mulV(h), vv = v.mulV(h);
      const wn = b.mulV(n).norm();
      const fc = fi === 2 && topCol ? topCol : color;
      const i0 = this._v(xf.mulV(c.sub(uu).sub(vv)), wn, fc), i1 = this._v(xf.mulV(c.add(uu).sub(vv)), wn, fc);
      const i2 = this._v(xf.mulV(c.add(uu).add(vv)), wn, fc), i3 = this._v(xf.mulV(c.sub(uu).add(vv)), wn, fc);
      this.i.push(i0, i1, i2, i0, i2, i3);
    }
  }
  box(center, size, color, yaw = 0, skipBottom = false) { this.addBox(new Xf(yaw ? M3.ry(yaw) : new M3(), center), size, color, skipBottom); }
  boxMinMax(a, b, color, skipBottom = false) {
    const mn = new V3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)), mx = new V3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
    this.addBox(new Xf(new M3(), mn.add(mx).mul(0.5)), mx.sub(mn), color, skipBottom);
  }
  // Цилиндр/конус вдоль локальной Y от 0 до h
  addCyl(xf, r0, r1, h, sides, color, caps = true, smooth = true, capCol = null) {
    const b = xf.basis, slope = (r0 - r1) / Math.max(h, 1e-4);
    for (let i = 0; i < sides; i++) {
      const a0 = TAU * i / sides, a1 = TAU * (i + 1) / sides;
      const d0 = new V3(Math.cos(a0), 0, Math.sin(a0)), d1 = new V3(Math.cos(a1), 0, Math.sin(a1));
      const p0 = xf.mulV(d0.mul(r0)), p1 = xf.mulV(d1.mul(r0)), p2 = xf.mulV(d1.mul(r1).add(new V3(0, h, 0))), p3 = xf.mulV(d0.mul(r1).add(new V3(0, h, 0)));
      const dm = d0.add(d1).norm();
      const fn = b.mulV(dm.add(new V3(0, slope, 0)).norm()).norm();
      if (smooth) {
        const n0 = b.mulV(d0.add(new V3(0, slope, 0)).norm()).norm(), n1 = b.mulV(d1.add(new V3(0, slope, 0)).norm()).norm();
        this.quadSmooth([p0, p1, p2, p3], [n0, n1, n1, n0], color, fn);
      } else this.quad(p0, p1, p2, p3, color, fn);
    }
    if (caps) {
      const cc = capCol || color, top = xf.mulV(new V3(0, h, 0)), bot = xf.mulV(new V3()), up = b.mulV(new V3(0, 1, 0)).norm();
      for (let i = 0; i < sides; i++) {
        const a0 = TAU * i / sides, a1 = TAU * (i + 1) / sides;
        const d0 = new V3(Math.cos(a0), 0, Math.sin(a0)), d1 = new V3(Math.cos(a1), 0, Math.sin(a1));
        if (r1 > 0.001) this.tri(top, xf.mulV(d0.mul(r1).add(new V3(0, h, 0))), xf.mulV(d1.mul(r1).add(new V3(0, h, 0))), cc, up);
        if (r0 > 0.001) this.tri(bot, xf.mulV(d1.mul(r0)), xf.mulV(d0.mul(r0)), cc, up.neg());
      }
    }
  }
  cyl(base, r, h, sides, color, caps = true) { this.addCyl(new Xf(new M3(), base), r, r, h, sides, color, caps); }
  cylBetween(a, b, r0, r1, sides, color, caps = true) {
    const d = b.sub(a), l = d.len(); if (l < 1e-4) return;
    const y = d.mul(1 / l);
    const x = y.cross(Math.abs(y.z) < 0.9 ? new V3(0, 0, -1) : new V3(1, 0, 0)).norm();
    const z = x.cross(y).norm();
    this.addCyl(new Xf(new M3(x, y, z), a), r0, r1, l, sides, color, caps);
  }
  beam(a, b, w, hgt, color) {
    const d = b.sub(a), l = d.len(); if (l < 1e-4) return;
    const z = d.mul(1 / l);
    const up = Math.abs(z.y) < 0.95 ? new V3(0, 1, 0) : new V3(1, 0, 0);
    const x = up.cross(z).norm(), y = z.cross(x).norm();
    this.addBox(new Xf(new M3(x, y, z), a.add(b).mul(0.5)), new V3(w, hgt, l), color);
  }
  addBlob(center, radius, color, rng, rough = 0.25, flatBottom = false) {
    const base = [new V3(1, 0, 0), new V3(-1, 0, 0), new V3(0, 1, 0), new V3(0, -1, 0), new V3(0, 0, 1), new V3(0, 0, -1)];
    const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]];
    const pts = base.slice(), cache = new Map(), tris = [];
    const mid = (a, b) => { const k = Math.min(a, b) * 64 + Math.max(a, b); if (cache.has(k)) return cache.get(k); pts.push(pts[a].add(pts[b]).mul(0.5).norm()); cache.set(k, pts.length - 1); return pts.length - 1; };
    for (const [a, b, c] of faces) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); tris.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    const disp = pts.map((p) => { const k = 1 + rng.range(-rough, rough); let q = p.mul(k); q = new V3(q.x * radius.x, q.y * radius.y, q.z * radius.z); if (flatBottom && q.y < -radius.y * 0.3) q.y = -radius.y * 0.3; return center.add(q); });
    for (const t of tris) {
      const pa = disp[t[0]], pb = disp[t[1]], pc = disp[t[2]];
      let n = pb.sub(pa).cross(pc.sub(pa)).norm();
      if (n.dot(pa.add(pb).add(pc).mul(1 / 3).sub(center)) < 0) n = n.neg();
      this.tri(pa, pb, pc, jitter(color, rng, 0.06), n);
    }
  }
  // Сегмент тела (эллиптическая призма) со скиннингом колец
  addLimb(p0, p1, rx0, rz0, rx1, rz1, sides, color, fwd, b0, w0, b1, w1, cap0 = false, cap1 = false) {
    this.skinned = true;
    const y = p1.sub(p0).norm();
    const z = fwd.sub(y.mul(fwd.dot(y))).norm();
    const x = y.cross(z).norm();
    const r0 = [], r1 = [], nr = [];
    for (let i = 0; i < sides; i++) {
      const a = TAU * i / sides, ca = Math.cos(a), sa = Math.sin(a);
      r0.push(p0.add(x.mul(ca * rx0)).add(z.mul(sa * rz0)));
      r1.push(p1.add(x.mul(ca * rx1)).add(z.mul(sa * rz1)));
      nr.push(x.mul(ca / Math.max(rx0, 1e-3)).add(z.mul(sa / Math.max(rz0, 1e-3))).norm());
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const fn = nr[i].add(nr[j]).norm();
      const i0 = this._vs(r0[i], nr[i], color, b0, w0), i1 = this._vs(r0[j], nr[j], color, b0, w0);
      const i2 = this._vs(r1[j], nr[j], color, b1, w1), i3 = this._vs(r1[i], nr[i], color, b1, w1);
      const tn = r0[j].sub(r0[i]).cross(r1[j].sub(r0[i]));
      if (tn.dot(fn) > 0) this.i.push(i0, i1, i2, i0, i2, i3); else this.i.push(i0, i2, i1, i0, i3, i2);
    }
    const cap = (ring, center, nrm, bb, ww) => {
      const ci = this._vs(center, nrm, color, bb, ww);
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const ia = this._vs(ring[i], nrm, color, bb, ww), ib = this._vs(ring[j], nrm, color, bb, ww);
        const tn = ring[i].sub(center).cross(ring[j].sub(center));
        if (tn.dot(nrm) > 0) this.i.push(ci, ia, ib); else this.i.push(ci, ib, ia);
      }
    };
    if (cap0) cap(r0, p0, y.neg(), b0, w0);
    if (cap1) cap(r1, p1, y, b1, w1);
  }
  append(o, xf = null) {
    const base = this.vcount();
    for (let k = 0; k < o.p.length; k += 3) {
      const pt = new V3(o.p[k], o.p[k + 1], o.p[k + 2]), nm = new V3(o.n[k], o.n[k + 1], o.n[k + 2]);
      if (xf) { const q = xf.mulV(pt), n2 = xf.basis.mulV(nm).norm(); this.p.push(q.x, q.y, q.z); this.n.push(n2.x, n2.y, n2.z); }
      else { this.p.push(pt.x, pt.y, pt.z); this.n.push(nm.x, nm.y, nm.z); }
    }
    for (const v of o.c) this.c.push(v);
    if (this.skinned || o.skinned) { for (const v of o.b) this.b.push(v); for (const v of o.w) this.w.push(v); }
    for (const v of o.i) this.i.push(base + v);
  }
  // Готовые массивы для GPU
  data() {
    const nv = this.vcount();
    const c8 = new Uint8Array(nv * 4);
    for (let k = 0; k < nv * 4; k++) c8[k] = Math.max(0, Math.min(255, Math.round(this.c[k] * 255)));
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < this.p.length; k += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], this.p[k + a]); mx[a] = Math.max(mx[a], this.p[k + a]); }
    const ctr = new V3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
    const rad = nv ? Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 : 0;
    const d = { pos: new Float32Array(this.p), nrm: new Float32Array(this.n), col: c8, idx: new Uint32Array(this.i), center: ctr, radius: rad, count: this.i.length };
    if (this.skinned) {
      d.bones = new Uint8Array(this.b);
      const w8 = new Uint8Array(this.w.length); for (let k = 0; k < this.w.length; k++) w8[k] = Math.round(this.w[k] * 255);
      d.weights = w8;
    }
    return d;
  }
  // Треугольники (для отладки/навигации)
  faces() { const out = []; for (let k = 0; k < this.i.length; k++) { const v = this.i[k] * 3; out.push(new V3(this.p[v], this.p[v + 1], this.p[v + 2])); } return out; }
}
