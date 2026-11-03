// Построение статической части локации «База Долга» 300×300 м: земля, периметр, дороги, окружение,
// растительность, коллизии. Геометрия объединяется по чанкам 50×50 м (мало вызовов отрисовки, отсечение).
import { V3, M3, Xf, RNG, TAU, clamp } from '../engine/math.js';
import { MeshBuilder, jitter } from '../engine/mesh.js';
import { ValueNoise } from '../engine/noise.js';
import * as L from './layout.js';
import * as P from './props.js';
import * as BG from './building_gen.js';

const v = (x, y, z) => new V3(x, y, z);
const T = (b, p) => new Xf(b, p);
const I = () => new M3();
export const CHUNK = 50, HALF = 150, SPLAT = 512;

export class WorldBuilder {
  constructor() {
    this.rng = new RNG(20241104);
    this.chunks = new Map(); this.fol = new Map();
    this.col = []; this.lampPoints = []; this.firePoints = []; this.grass = []; this.signs = [];
    this.splat = new Uint8Array(SPLAT * SPLAT * 4);
  }
  key(p) { return clamp(Math.floor((p.x + HALF) / CHUNK), 0, 5) + ',' + clamp(Math.floor((p.z + HALF) / CHUNK), 0, 5); }
  mbAt(p) { const k = this.key(p); if (!this.chunks.has(k)) this.chunks.set(k, new MeshBuilder()); return this.chunks.get(k); }
  folAt(p) { const k = this.key(p); if (!this.fol.has(k)) this.fol.set(k, new MeshBuilder()); return this.fol.get(k); }

  // ------------------------------------------------------------------ карта смешивания
  px(v0) { return clamp(Math.floor((v0 + HALF) / (2 * HALF) * SPLAT), 0, SPLAT - 1); }
  sget(x, z, ch) { return this.splat[(z * SPLAT + x) * 4 + ch] / 255; }
  sset(x, z, ch, val) { this.splat[(z * SPLAT + x) * 4 + ch] = Math.round(clamp(val, 0, 1) * 255); }
  rect(cx, cz, w, d, ch, val) {
    for (let z = this.px(cz - d / 2); z <= this.px(cz + d / 2); z++) for (let x = this.px(cx - w / 2); x <= this.px(cx + w / 2); x++) {
      this.sset(x, z, ch, Math.max(this.sget(x, z, ch), val));
      if (ch === 0 || ch === 2) this.sset(x, z, 1, Math.min(this.sget(x, z, 1), 1 - val));
    }
  }
  clearGrassRect(cx, cz, w, d) { for (let z = this.px(cz - d / 2); z <= this.px(cz + d / 2); z++) for (let x = this.px(cx - w / 2); x <= this.px(cx + w / 2); x++) this.sset(x, z, 1, Math.min(this.sget(x, z, 1), 0.1)); }
  line(a, b, w, ch, val, mode = 'max') {
    const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]), steps = Math.floor(l / (2 * HALF / SPLAT)) + 1;
    const r = Math.floor(w * 0.5 / (2 * HALF) * SPLAT) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, px = this.px(a[0] + d[0] * t), pz = this.px(a[1] + d[1] * t);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const x = px + dx, z = pz + dz; if (x < 0 || z < 0 || x >= SPLAT || z >= SPLAT) continue;
        if (mode === 'cleargrass') { this.sset(x, z, 1, Math.min(this.sget(x, z, 1), 0.15)); continue; }
        this.sset(x, z, ch, Math.max(this.sget(x, z, ch), val));
        if (ch !== 1 && ch !== 3) this.sset(x, z, 1, Math.min(this.sget(x, z, 1), 1 - val));
      }
    }
  }
  circle(cx, cz, r, ch, val) {
    const pr = Math.floor(r / (2 * HALF) * SPLAT) + 1, px = this.px(cx), pz = this.px(cz);
    for (let dz = -pr; dz <= pr; dz++) for (let dx = -pr; dx <= pr; dx++) {
      const x = px + dx, z = pz + dz; if (x < 0 || z < 0 || x >= SPLAT || z >= SPLAT) continue;
      const dist = Math.hypot(dx, dz) / pr; if (dist > 1) continue;
      this.sset(x, z, ch, Math.max(this.sget(x, z, ch), val * (1 - dist * dist)));
    }
  }
  grassAt(x, z) { return this.sget(this.px(x), this.px(z), 1); }
  pavedAt(x, z) { const px = this.px(x), pz = this.px(z); return this.sget(px, pz, 0) > 0.4 || this.sget(px, pz, 2) > 0.4; }

  buildSplat() {
    const nz = new ValueNoise(77, 512), [mnx, mnz] = L.WALL_MIN, [mxx, mxz] = L.WALL_MAX;
    for (let z = 0; z < SPLAT; z++) for (let x = 0; x < SPLAT; x++) {
      const wx = (x + 0.5) / SPLAT * 2 * HALF - HALF, wz = (z + 0.5) / SPLAT * 2 * HALF - HALF;
      const n = nz.fbm(wx * 0.03, wz * 0.03, 3);
      const inside = wx > mnx && wx < mxx && wz > mnz && wz < mxz;
      let g;
      if (inside) { const edge = Math.min(wx - mnx, mxx - wx, wz - mnz, mxz - wz); g = clamp(n * 1.6 - 0.62 + (edge < 8 ? 0.5 : 0), 0, 1); }
      else g = clamp(n * 1.5 - 0.05, 0, 1);
      const wet = clamp(nz.fbm(wx * 0.07 + 300, wz * 0.07, 2) * 2.2 - 1.35, 0, 1);
      const o = (z * SPLAT + x) * 4; this.splat[o] = 0; this.splat[o + 1] = g * 255; this.splat[o + 2] = 0; this.splat[o + 3] = wet * 0.8 * 255;
    }
    for (const [c, s] of L.PADS) this.rect(c[0], c[1], s[0], s[1], 2, 1);
    for (const r of L.ROADS) {
      const type = r[3];
      if (type === 0) this.line(r[0], r[1], r[2], 0, 1);
      else if (type === 2) this.line(r[0], r[1], r[2], 2, 1);
      else {
        this.line(r[0], r[1], r[2], 1, 0, 'cleargrass');
        const d = [r[1][0] - r[0][0], r[1][1] - r[0][1]], l = Math.hypot(...d), sd = [-d[1] / l, d[0] / l];
        for (const s of [-0.9, 0.9]) this.line([r[0][0] + sd[0] * s, r[0][1] + sd[1] * s], [r[1][0] + sd[0] * s, r[1][1] + sd[1] * s], 0.6, 3, 0.45);
      }
    }
    for (const b of L.BUILDINGS) {
      const [bx, bz] = b.pos, [bw, bd] = b.size;
      if (b.open) { if (b.kind === 'kpp') this.rect(bx, bz, bw, bd, 2, 1); else this.clearGrassRect(bx, bz, bw, bd); continue; }
      this.rect(bx, bz, bw + 3, bd + 3, 2, 1);
    }
    for (const r of L.RUINS) this.clearGrassRect(r.pos[0], r.pos[1], r.size[0] + 2, r.size[1] + 2);
    for (let i = 0; i < 26; i++) this.circle(this.rng.range(-90, 90), this.rng.range(-95, 75), this.rng.range(1.5, 4), 3, this.rng.range(0.55, 0.85));
    for (let i = 0; i < 12; i++) this.circle(this.rng.range(-80, -40), this.rng.range(100, 140), this.rng.range(3, 8), 3, 0.85);
    for (const a of L.ANOMALIES) if (a.kind === 'fire') this.clearGrassRect(a.pos[0], a.pos[2], a.r * 2.4, a.r * 2.4);
  }

  // ------------------------------------------------------------------ земля
  groundBuilders() {
    const out = [];
    for (let iz = 0; iz < 6; iz++) for (let ix = 0; ix < 6; ix++) {
      const mb = new MeshBuilder(), x0 = -HALF + ix * CHUNK, z0 = -HALF + iz * CHUNK, s = CHUNK / 5;
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
        const p0 = v(x0 + a * s, 0, z0 + b * s);
        mb.quad(p0, p0.add(v(0, 0, s)), p0.add(v(s, 0, s)), p0.add(v(s, 0, 0)), [1, 1, 1, 0], v(0, 1, 0));
      }
      out.push(mb);
    }
    return out;
  }

  // ------------------------------------------------------------------ периметр
  gaps(side) {
    const g = [];
    if (side === 's') g.push([-L.GATE_HALF, L.GATE_HALF]);
    for (const br of L.BREACHES) if (br.side === side) g.push([br.at - br.w / 2, br.at + br.w / 2]);
    return g.sort((a, b) => a[0] - b[0]);
  }
  buildPerimeter() {
    const [mnx, mnz] = L.WALL_MIN, [mxx, mxz] = L.WALL_MAX, rng = this.rng;
    const sides = { n: [v(mnx, 0, mnz), v(mxx, 0, mnz), true], s: [v(mnx, 0, mxz), v(mxx, 0, mxz), true], w: [v(mnx, 0, mnz), v(mnx, 0, mxz), false], e: [v(mxx, 0, mnz), v(mxx, 0, mxz), false] };
    for (const side in sides) {
      const [a, b, ax] = sides[side], gaps = this.gaps(side);
      let cursor = ax ? a.x : a.z; const pieces = [];
      for (const g of gaps) { pieces.push([cursor, g[0]]); cursor = g[1]; }
      pieces.push([cursor, ax ? b.x : b.z]);
      for (const [p0, p1] of pieces) {
        let x = p0;
        while (x < p1 - 0.5) {
          const x2 = Math.min(x + 12, p1);
          const pa = ax ? v(x, 0, a.z) : v(a.x, 0, x), pb = ax ? v(x2, 0, a.z) : v(a.x, 0, x2), mid = pa.add(pb).mul(0.5);
          P.po2Fence(this.mbAt(mid), this.col, pa, pb, L.WALL_H, rng, rng.f() < 0.4 ? 0.35 : 0.05);
          if (rng.f() < 0.75) P.barbedWire(this.mbAt(mid), pa, pb, L.WALL_H + 0.25);
          x = x2;
        }
      }
      if (side === 's') continue;
      for (const g of gaps) {
        const gc = (g[0] + g[1]) / 2, pos = ax ? v(gc, 0, a.z) : v(a.x, 0, gc), mb = this.mbAt(pos);
        for (let k = 0; k < 2; k++) {
          const off = v(rng.range(-1.5, 1.5), 0.15, rng.range(-1.5, 1.5));
          const bas = M3.ry((ax ? 0 : Math.PI / 2) + rng.range(-0.5, 0.5)).mul(M3.rx(rng.range(1.2, 1.5)));
          mb.addBox(T(bas, pos.add(off).add((ax ? v(0, 0, 2.5) : v(2.5, 0, 0)).mul(k === 0 ? 1 : -1))), v(3.8, 2.4, 0.16), P.C.CONCRETE);
        }
        P.debrisSmall(mb, pos, 3, 25, rng);
      }
    }
    for (const c of [v(mnx, 0, mnz), v(mxx, 0, mnz), v(mnx, 0, mxz), v(mxx, 0, mxz)]) this.mbAt(c).addBox(T(I(), c.add(v(0, 1.5, 0))), v(0.5, 3, 0.5), P.C.CONCRETE_D);
  }

  nearJunction(p) {
    for (const r of L.ROADS) for (const e of [r[0], r[1]]) if (Math.hypot(p.x - e[0], p.z - e[1]) < 6) return true;
    if (Math.abs(p.z - 18) < 5 && (Math.abs(p.x) < 6 || Math.abs(Math.abs(p.x) - 38) < 5)) return true;
    if (Math.abs(p.z + 90) < 5 && Math.abs(Math.abs(p.x) - 38) < 5) return true;
    return false;
  }
  buildRoads() {
    for (const r of L.ROADS) {
      if (r[3] !== 0) continue;
      const a = r[0], b = r[1], w = r[2], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d), dn = [d[0] / l, d[1] / l], sd = [-dn[1], dn[0]];
      for (const s of [-1, 1]) {
        let t = 0;
        while (t < l) {
          const t2 = Math.min(t + 6, l);
          const p0 = [a[0] + dn[0] * t + sd[0] * (w / 2 + 0.15) * s, a[1] + dn[1] * t + sd[1] * (w / 2 + 0.15) * s];
          const p1 = [a[0] + dn[0] * t2 + sd[0] * (w / 2 + 0.15) * s, a[1] + dn[1] * t2 + sd[1] * (w / 2 + 0.15) * s];
          const mid = v((p0[0] + p1[0]) / 2, 0, (p0[1] + p1[1]) / 2);
          const inside = Math.abs(mid.x) < 98 && mid.z > -103 && mid.z < 80;
          if (inside && this.rng.f() > 0.15 && !this.nearJunction(mid)) this.mbAt(mid).beam(v(p0[0], 0.08, p0[1]), v(p1[0], 0.08, p1[1]), 0.2, 0.16, [0.6, 0.6, 0.57, 0]);
          t = t2;
        }
      }
    }
  }

  // ------------------------------------------------------------------ окружение
  buildProps() {
    const rng = this.rng, col = this.col, m = (p) => this.mbAt(p);
    const lamps = [v(-5.5, 0, 30), v(5.5, 0, 50), v(-5.5, 0, 66), v(-30, 0, 22.5), v(-60, 0, 22.5), v(30, 0, 13.5), v(62, 0, 13.5), v(-42, 0, -20), v(42, 0, -30),
      v(-42, 0, -70), v(42, 0, -75), v(-18, 0, -2), v(18, 0, -2), v(-18, 0, -27), v(18, 0, -27)];
    lamps.forEach((p, i) => {
      let yaw = Math.abs(p.z - 22.5) < 0.1 ? Math.PI : Math.abs(p.z - 13.5) < 0.1 ? 0 : p.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      const broken = i % 4 === 3, head = P.lampPost(m(p), col, p, yaw, broken);
      if (!broken) this.lampPoints.push(head);
    });
    P.flag(m(v(0, 0, -24)), col, v(0, 0, -24.5), 9);
    this.firePoints.push(v(5.5, 0, -12));
    P.barrel(m(v(5.5, 0, -12)), col, v(5.5, 0, -12), [0.2, 0.17, 0.14, 0.3]);
    for (const p of [v(4, 0, -13.3), v(7.2, 0, -11)]) P.crate(m(p), null, T(M3.ry(rng.f()), p), v(0.6, 0.45, 0.6));
    P.btr(m(v(-20, 0, 58)), col, T(M3.ry(0.4), v(-20, 0, 58)), true);
    P.uaz(m(v(24, 0, -14)), col, T(M3.ry(1.9), v(24, 0, -14)), undefined, true);
    P.truck(m(v(46, 0, -70)), col, T(M3.ry(0.05), v(46, 0, -70)), undefined, true);
    P.uaz(m(v(-48, 0, 12)), col, T(M3.ry(-0.6), v(-48, 0, 12)));
    P.truck(m(v(13, 0, 108)), col, T(M3.ry(0.25), v(13, 0, 108)), [0.32, 0.36, 0.25, 0.2], false, true);
    P.uaz(m(v(-11, 0, 129)), col, T(M3.ry(-0.4), v(-11, 0, 129)), [0.3, 0.34, 0.24, 0.2]);
    P.btr(m(v(-24, 0, 96)), col, T(M3.ry(1.2), v(-24, 0, 96)), true);
    P.truck(m(v(27, 0, 26)), col, T(M3.ry(1.57), v(27, 0, 26)), undefined, true);
    P.truck(m(v(118, 0, -58)), col, T(M3.ry(2.6), v(118, 0, -58)), [0.22, 0.24, 0.3, 0.2], false, true);
    P.uaz(m(v(-114, 0, -112)), col, T(M3.ry(0.9), v(-114, 0, -112)), undefined, true);
    P.shippingContainer(m(v(48, 0, -84)), col, T(M3.ry(Math.PI / 2), v(48, 0, -84)), [0.32, 0.38, 0.45, 0.2]);
    P.shippingContainer(m(v(56, 0, -84)), col, T(M3.ry(Math.PI / 2 + 0.05), v(56, 0, -83.5)), [0.5, 0.25, 0.16, 0.2]);
    P.shippingContainer(m(v(82, 0, -40)), col, T(I(), v(82, 0, -40)), [0.28, 0.35, 0.25, 0.2]);
    P.shippingContainer(m(v(82, 0, 50)), col, T(M3.ry(0.1), v(82, 0, 50)), [0.45, 0.42, 0.3, 0.2]);
    P.fuelTank(m(v(-34, 0, -72)), col, T(I(), v(-34, 0, -72)), 7, 1.3);
    P.fuelTank(m(v(-30, 0, -82)), col, T(M3.ry(Math.PI / 2), v(-30, 0, -82)), 5, 1.0, [0.42, 0.25, 0.14, 0.3]);
    this.mast(v(29, 0, -76), 24);
    const ch = v(26.5, 0, 53), cm = m(ch);
    cm.addCyl(T(I(), ch), 1.5, 0.9, 22, 12, [0.55, 0.33, 0.25, 0.1]);
    for (const y of [6, 12, 18]) cm.addCyl(T(I(), ch.add(v(0, y, 0))), 1.5 - y * 0.027 + 0.08, 1.5 - y * 0.027 + 0.08, 0.3, 12, [0.4, 0.4, 0.4, 0.3], false);
    col.push([T(I(), ch.add(v(0, 3, 0))), v(2.8, 6, 2.8)]);
    this.pipeline([v(26, 0, 44), v(26, 0, 30), v(-46, 0, 30), v(-46, 0, -20)], 3.2);
    this.pipeline([v(-90, 0, -96), v(90, 0, -96)], 2.4);
    for (let i = 0; i < 9; i++) { const p = v(-24 + i * 6 + rng.range(-1, 1), 0, 92 + rng.range(-2, 3)); if (Math.abs(p.x) < 6) continue; P.tankTrap(m(p), col, p, rng.f() * TAU); }
    for (const i of [0, 3]) { const p = v(-6 + i * 4, 0, 88); P.concreteBlock(m(p), col, T(M3.ry(rng.range(-0.2, 0.2)), p), v(2.4, 0.9, 0.9)); }
    P.sandbags(m(v(-96, 0, -30)), col, v(-95, 0, -26.5), v(-95, 0, -24), 3, rng);
    P.sandbags(m(v(96, 0, 22)), col, v(95, 0, 18.5), v(95, 0, 20.5), 3, rng);
    P.sandbags(m(v(40, 0, -101)), col, v(36, 0, -100), v(38, 0, -100), 3, rng);
    for (const p of [v(-12, 0, 8), v(14, 0, -60), v(-44, 0, -52), v(48, 0, 8), v(-32, 0, 60), v(70, 0, 60), v(-86, 0, 40), v(86, 0, -10), v(10, 0, 38), v(-50, 0, -88), v(60, 0, -95), v(-88, 0, -50), v(30, 0, -40), v(-20, 0, -40)])
      P.rubblePile(m(p), col, p, rng.range(1.2, 2.4), rng, rng.range(0.6, 1.2));
    for (let i = 0; i < 140; i++) { const p = v(rng.range(-95, 95), 0, rng.range(-100, 78)); if (this.pavedAt(p.x, p.z) && rng.f() < 0.6) continue; P.debrisSmall(m(p), p, rng.range(0.8, 2.5), rng.int(4, 10), rng); }
    for (let i = 0; i < 16; i++) { const p = v(rng.range(-85, 85), 0, rng.range(-95, 70)); P.crater(m(p), p, rng.range(1.5, 2.8), rng); }
    for (const c of [v(46, 0, -20), v(-46, 0, 34), v(30, 0, -84), v(-30, 0, -88), v(52, 0, 30), v(-52, 0, -10), v(14, 0, 62), v(-14, 0, -64), v(76, 0, 20), v(-76, 0, -16), v(84, 0, -100), v(-84, 0, 70), v(18, 0, 6), v(-30, 0, 26)]) {
      const mm = m(c);
      for (let k = 0, n = rng.int(2, 5); k < n; k++) {
        const p = c.add(v(rng.range(-3, 3), 0, rng.range(-3, 3)));
        switch (rng.int(0, 4)) {
          case 0: P.crate(mm, col, T(M3.ry(rng.f() * TAU), p), v(1, 0.8, 1)); break;
          case 1: P.barrel(mm, col, p, jitter(rng.f() < 0.5 ? [0.3, 0.36, 0.25, 0.2] : [0.45, 0.2, 0.12, 0.3], rng), rng.f() < 0.3, rng.f() * TAU); break;
          case 2: P.pallet(mm, T(M3.ry(rng.f() * TAU), p)); break;
          case 3: P.tireStack(mm, col, p, rng.int(1, 4), rng); break;
          default: P.ammoBox(mm, col, T(M3.ry(rng.f() * TAU), p));
        }
      }
    }
    P.cableDrum(m(v(40, 0, 36)), col, v(40, 0, 36), 0.3);
    P.cableDrum(m(v(-36, 0, -99)), col, v(-36, 0, -99), 1.2);
    P.plankStack(m(v(-52, 0, 26)), col, v(-52, 0, 26), 0.1, rng);
    P.plankStack(m(v(49, 0, -24)), col, v(49, 0, -24), Math.PI / 2, rng);
    this.railway();
    this.banditCamp(v(124, 0, -62));
    for (let i = 0; i < 10; i++) { const p = v(-118 + rng.range(-10, 10), 0, -120 + rng.range(-8, 8)); m(p).addBox(T(M3.ry(rng.f() * TAU), p.add(v(0, 0.03, 0))), v(0.3, 0.05, 0.05), [0.85, 0.82, 0.72, 0.9]); }
    for (let i = 0; i < 6; i++) { const p = v(-140 + i * 4, 0, -12); if (rng.f() < 0.7) m(p).beam(p.add(v(0, 0.6, 0)), p.add(v(3.6, 0.6 + rng.range(-0.2, 0.2), 0)), 0.08, 1.2, [0.38, 0.3, 0.22, 0.4]); }
    for (const e of L.EXITS) this.signs.push({ pos: v(...e.pos).add(e.id === 'exit_south' ? v(-4, 0, -2) : v(0, 0, -4)), text: '→ ' + e.name });
  }

  mast(p, h) {
    const mb = this.mbAt(p), c = [0.55, 0.2, 0.15, 0.2], c2 = [0.8, 0.8, 0.78, 0.2];
    for (let i = 0; i < 8; i++) {
      const y0 = h * i / 8, y1 = h * (i + 1) / 8, r0 = 1.2 * (1 - 0.6 * i / 8), r1 = 1.2 * (1 - 0.6 * (i + 1) / 8), cc = i % 2 === 0 ? c : c2;
      for (let k = 0; k < 3; k++) {
        const a0 = TAU * k / 3, a1 = TAU * (k + 1) / 3;
        const p0 = p.add(v(Math.cos(a0) * r0, y0, Math.sin(a0) * r0));
        mb.beam(p0, p.add(v(Math.cos(a0) * r1, y1, Math.sin(a0) * r1)), 0.08, 0.08, cc);
        mb.beam(p0, p.add(v(Math.cos(a1) * r1, y1, Math.sin(a1) * r1)), 0.04, 0.04, cc);
        mb.beam(p0, p.add(v(Math.cos(a1) * r0, y0, Math.sin(a1) * r0)), 0.04, 0.04, cc);
      }
    }
    mb.addBox(T(I(), p.add(v(0, h * 0.8, 0))), v(1.2, 0.6, 0.1), [0.3, 0.3, 0.3, 0.2]);
    mb.addBox(T(I(), p.add(v(0, h + 0.2, 0))), v(0.2, 0.2, 0.2), [0.9, 0.2, 0.15, 0.8]);
    this.col.push([T(I(), p.add(v(0, 2, 0))), v(2.4, 4, 2.4)]);
  }
  pipeline(pts, h) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = b.sub(a).len(), n = Math.floor(l / 6);
      for (let k = 0; k <= n; k++) {
        const p = a.lerp(b, k / Math.max(n, 1)), mm = this.mbAt(p);
        mm.addBox(T(I(), p.add(v(0, h / 2, 0))), v(0.3, h, 0.3), P.C.CONCRETE_D, true);
        mm.addBox(T(I(), p.add(v(0, h, 0))), v(1.4, 0.15, 1.4), P.C.CONCRETE_D, true);
        this.col.push([T(I(), p.add(v(0, 1, 0))), v(0.4, 2, 0.4)]);
      }
      let seg = 0;
      while (seg < l) {
        const s2 = Math.min(seg + 10, l), p0 = a.lerp(b, seg / l).add(v(0, h + 0.4, 0)), p1 = a.lerp(b, s2 / l).add(v(0, h + 0.4, 0));
        const mid = p0.add(p1).mul(0.5), side = b.sub(a).norm().cross(v(0, 1, 0)).mul(0.35);
        if (this.rng.f() > 0.12) this.mbAt(mid).cylBetween(p0.add(side), p1.add(side), 0.28, 0.28, 8, this.rng.f() < 0.6 ? [0.5, 0.48, 0.42, 0.5] : P.C.RUST, false);
        this.mbAt(mid).cylBetween(p0.sub(side), p1.sub(side), 0.2, 0.2, 8, P.C.RUST, false);
        seg = s2;
      }
    }
  }
  railway() {
    const z = -128;
    for (let x = -HALF; x < HALF; x += 10) {
      const x2 = Math.min(x + 10, HALF), mm = this.mbAt(v((x + x2) / 2, 0, z));
      mm.addBox(T(I(), v((x + x2) / 2, 0.1, z)), v(x2 - x, 0.2, 3.4), [0.36, 0.34, 0.3, 0], true);
      for (const s of [-0.76, 0.76]) mm.addBox(T(I(), v((x + x2) / 2, 0.32, z + s)), v(x2 - x, 0.14, 0.08), [0.35, 0.22, 0.14, 0.3], true);
      for (let k = x; k < x2; k += 0.75) mm.addBox(T(I(), v(k + 0.3, 0.22, z)), v(0.25, 0.1, 2.6), [0.3, 0.24, 0.18, 0.4], true);
    }
    for (let i = 0; i < 4; i++) {
      const p = v(-58 + i * 13.5, 0, z), mm = this.mbAt(p), c = jitter([0.42, 0.24, 0.16, 0.3], this.rng, 0.1);
      if (i === 2) mm.addCyl(T(M3.rz(Math.PI / 2), p.add(v(6, 2.3, 0))), 1.4, 1.4, 12, 12, [0.2, 0.2, 0.2, 0.2]);
      else {
        mm.addBox(T(I(), p.add(v(0, 2.5, 0))), v(12.5, 3, 2.9), c, true);
        mm.addBox(T(I(), p.add(v(0, 4.05, 0))), v(12.6, 0.12, 3), [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, c[3]], true);
        mm.addBox(T(I(), p.add(v(0, 2.4, 1.46))), v(2.6, 2.6, 0.05), [0.08, 0.07, 0.06, 0.3], true);
      }
      mm.addBox(T(I(), p.add(v(0, 0.9, 0))), v(12, 0.5, 2.6), [0.15, 0.14, 0.13, 0.2], true);
      for (const s of [-4.5, 4.5]) for (const zz of [-0.76, 0.76]) mm.addCyl(T(M3.rx(Math.PI / 2), p.add(v(s, 0.45, zz - 0.06))), 0.45, 0.45, 0.12, 10, [0.15, 0.13, 0.12, 0.3]);
      this.col.push([T(I(), p.add(v(0, 2, 0))), v(12.5, 4, 3)]);
    }
  }
  banditCamp(c) {
    const mm = this.mbAt(c), rng = this.rng;
    for (const [p, yaw] of [[c.add(v(-6, 0, -4)), 0.3], [c.add(v(-1, 0, 6)), -0.4], [c.add(v(6, 0, -6)), 1.2]]) {
      const b = M3.ry(yaw), tc = jitter([0.3, 0.32, 0.22, 0.5], rng, 0.1), w = 1.6, l = 3.2, h = 1.7;
      for (const s of [-1, 1]) {
        const a1 = p.add(b.mulV(v(s * w, 0, -l / 2))), a2 = p.add(b.mulV(v(s * w, 0, l / 2))), a3 = p.add(b.mulV(v(0, h, l / 2))), a4 = p.add(b.mulV(v(0, h, -l / 2)));
        mm.quad(a1, a2, a3, a4, tc, b.mulV(v(s, 0.9, 0)).norm());
        mm.quad(a1, a4, a3, a2, [tc[0] * 0.7, tc[1] * 0.7, tc[2] * 0.7, tc[3]], b.mulV(v(-s, -0.9, 0)).norm());
      }
      mm.tri(p.add(b.mulV(v(-w, 0, l / 2))), p.add(b.mulV(v(w, 0, l / 2))), p.add(b.mulV(v(0, h, l / 2))), tc, b.mulV(v(0, 0, 1)));
      this.col.push([T(b, p.add(v(0, 0.8, 0))), v(w * 2, 1.6, l)]);
    }
    this.firePoints.push(c.clone());
    P.barrel(mm, this.col, c, [0.18, 0.15, 0.12, 0.3]);
    P.sandbags(mm, this.col, c.add(v(-12, 0, 8)), c.add(v(-12, 0, 2)), 3, rng);
    P.sandbags(mm, this.col, c.add(v(-10, 0, -10)), c.add(v(-14, 0, -6)), 3, rng);
    for (let i = 0; i < 4; i++) P.crate(mm, this.col, T(M3.ry(rng.f() * TAU), c.add(v(rng.range(-4, 4), 0, rng.range(2, 5)))), v(0.9, 0.7, 0.9));
    P.chainlink(mm, this.col, c.add(v(-16, 0, -14)), c.add(v(-16, 0, 14)));
  }

  buildRuins() {
    for (const r of L.RUINS) {
      const d = { ...r, kind: 'ruin', floors: 1 }, sh = BG.shell(d, 1.0, BG.hashStr(r.id)), xf = T(I(), v(r.pos[0], 0, r.pos[1]));
      const mm = this.mbAt(xf.origin);
      mm.append(sh.shell, xf); mm.append(sh.roof, xf); mm.append(BG.debrisInside(d, new RNG(BG.hashStr(r.id) + 1)), xf);
      mm.addBox(xf.mul(T(I(), v(0, 0.015, 0))), v(r.size[0] - 0.3, 0.03, r.size[1] - 0.3), [0.38, 0.36, 0.33, 0], true);
      for (const c of sh.col) this.col.push([xf.mul(c[0]), c[1]]);
    }
  }

  // ------------------------------------------------------------------ растительность
  blocked(p, r) {
    if (this.pavedAt(p.x, p.z)) return true;
    for (const b of L.BUILDINGS) if (Math.abs(p.x - b.pos[0]) < b.size[0] / 2 + r + 1.5 && Math.abs(p.z - b.pos[1]) < b.size[1] / 2 + r + 1.5) return true;
    for (const b of L.RUINS) if (Math.abs(p.x - b.pos[0]) < b.size[0] / 2 + r + 1 && Math.abs(p.z - b.pos[1]) < b.size[1] / 2 + r + 1) return true;
    if (Math.abs(p.z + 128) < 3.5 + r) return true;
    for (const e of L.EXITS) if (Math.hypot(p.x - e.pos[0], p.z - e.pos[2]) < 10) return true;
    for (const c of L.CONTAINERS) if (Math.hypot(p.x - c.pos[0], p.z - c.pos[2]) < 3 + r) return true;
    for (const g of L.ENEMY_GROUPS) if (g.kind === 'bandit' && Math.hypot(p.x - g.pos[0], p.z - g.pos[2]) < 17) return true;
    return false;
  }
  insideWall(p, m) { return p.x > L.WALL_MIN[0] - m && p.x < L.WALL_MAX[0] + m && p.z > L.WALL_MIN[1] - m && p.z < L.WALL_MAX[1] + m; }
  buildVegetation() {
    const rng = this.rng; let placed = 0, attempts = 0;
    while (placed < 520 && attempts < 6000) {
      attempts++;
      const p = v(rng.range(-HALF + 2, HALF - 2), 0, rng.range(-HALF + 2, HALF - 2));
      const edge = Math.min(HALF - Math.abs(p.x), HALF - Math.abs(p.z)), inside = this.insideWall(p, 4);
      let prob;
      if (edge < 14) prob = 0.95;
      else if (!inside) prob = 0.25 + clamp(this.grassAt(p.x, p.z) - 0.5, 0, 0.5);
      else { const we = Math.min(p.x - L.WALL_MIN[0], L.WALL_MAX[0] - p.x, p.z - L.WALL_MIN[1], L.WALL_MAX[1] - p.z); prob = we > 2 && we < 6 ? 0.25 : 0; }
      if (rng.f() > prob || this.blocked(p, 1.5)) continue;
      let clear = true;
      for (const r of L.ROADS) {
        const a = r[0], b = r[1], dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
        if (Math.hypot(p.x - (a[0] + dx * t), p.z - (a[1] + dz * t)) < r[2] / 2 + 2.5) { clear = false; break; }
      }
      if (!clear) continue;
      if (this.insideWall(p, 3.5) && !this.insideWall(p, -3.5)) continue;
      const fm = this.folAt(p), h = rng.range(7, 13), roll = rng.f();
      if (inside || roll < 0.35) P.treeBirch(fm, p, h * 0.85, rng);
      else if (roll < 0.85) P.treePine(fm, p, h, rng);
      else P.treeDead(fm, p, h * 0.7, rng);
      this.col.push([T(I(), p.add(v(0, 1.5, 0))), v(0.5, 3, 0.5)]);
      placed++;
    }
    for (let i = 0; i < 420; i++) {
      const p = v(rng.range(-HALF + 3, HALF - 3), 0, rng.range(-HALF + 3, HALF - 3));
      if (this.grassAt(p.x, p.z) < 0.45 || this.blocked(p, 1)) continue;
      P.bush(this.folAt(p), p, rng.range(0.7, 1.4), rng);
    }
    for (let i = 0; i < 26000; i++) {
      const x = rng.range(-HALF, HALF), z = rng.range(-HALF, HALF);
      if (this.grassAt(x, z) < 0.5 + rng.f() * 0.25 || this.pavedAt(x, z)) continue;
      this.grass.push([x, z, rng.f() * TAU, rng.range(0.7, 1.4)]);
    }
  }
  // Трава по чанкам: Float32Array [x, z, rot, scale]
  grassChunks() {
    const m = new Map();
    for (const g of this.grass) { const k = this.key(v(g[0], 0, g[1])); if (!m.has(k)) m.set(k, []); m.get(k).push(g); }
    const out = [];
    for (const [, arr] of m) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.rng.f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      out.push(new Float32Array(arr.flat()));
    }
    return out;
  }
}
