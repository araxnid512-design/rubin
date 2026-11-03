// Генератор геометрии зданий в локальных координатах (центр здания — начало координат).
// Состояния: разрушенное (ruin=1), рабочее (ruin=0), улучшенное (рабочее + детали), строительные леса.
import { V3, M3, Xf, RNG, hashStr } from '../engine/math.js';
import { MeshBuilder, MAT, jitter, darken } from '../engine/mesh.js';
import * as P from './props.js';

const v = (x, y, z) => new V3(x, y, z);
const T = (b, p) => new Xf(b, p);
const I = () => new M3();
export const FLOOR_H = 3.4;

export function doorInfo(def) {
  const [w, d] = def.size, [side, off] = def.door, hw = w / 2, hd = d / 2;
  switch (side) {
    case 'n': return { pos: v(off, 0, -hd), out: v(0, 0, -1) };
    case 's': return { pos: v(off, 0, hd), out: v(0, 0, 1) };
    case 'e': return { pos: v(hw, 0, off), out: v(1, 0, 0) };
    default: return { pos: v(-hw, 0, off), out: v(-1, 0, 0) };
  }
}

function openingsFor(def, side, length, floor) {
  const ops = [], kind = def.kind || '', hangar = !!def.hangar, [doorSide, doorOff] = def.door;
  const doorC = length / 2 + doorOff;
  if (floor === 0 && side === doorSide) {
    if (hangar) {
      if (kind === 'garage') for (const k of [-1, 0, 1]) ops.push({ c: length / 2 + k * 8.5, w: 4.2, kind: 'gate', h: 3.6 });
      else { ops.push({ c: doorC, w: 4.6, kind: 'gate', h: 3.8 }); ops.push({ c: doorC + 4.2, w: 1.6, kind: 'door', h: 2.3 }); }
    } else ops.push({ c: doorC, w: 1.6, kind: 'door', h: 2.3 });
  }
  if (kind === 'barracks' && floor === 0 && side === 'e') ops.push({ c: length / 2 + 12, w: 1.6, kind: 'door', h: 2.3 });
  const step = hangar ? 4.5 : 3.2, n = Math.floor((length - 1.6) / step);
  if (n <= 0) return ops;
  const start = (length - (n - 1) * step) / 2;
  for (let i = 0; i < n; i++) {
    const c = start + i * step;
    if (ops.some((o) => Math.abs(c - o.c) < o.w / 2 + 1)) continue;
    ops.push(hangar ? { c, w: 2.2, kind: 'window', h: 0.9, sill: 3.0 } : { c, w: 1.3, kind: 'window', h: 1.4, sill: 0.95 });
  }
  ops.sort((a, b) => a.c - b.c);
  return ops;
}

function wallRun(mb, glass, col, a, b, y0, h, t, ops, color, ruin, rng, trim) {
  const d = b.sub(a), L = d.len(), dir = d.mul(1 / L);
  const bas = M3.ry(Math.atan2(dir.x, dir.z) - Math.PI / 2), nrm = bas.mulV(v(0, 0, 1));
  let cursor = 0; const segs = [];
  for (const o of ops) { const c0 = o.c - o.w / 2, c1 = o.c + o.w / 2; if (c0 > cursor) segs.push([cursor, c0]); cursor = c1; }
  if (cursor < L) segs.push([cursor, L]);
  for (const [s0, s1] of segs) {
    if (s1 - s0 < 0.01) continue;
    if (ruin <= 0) mb.addBox(T(bas, a.add(dir.mul((s0 + s1) / 2)).add(v(0, y0 + h / 2, 0))), v(s1 - s0, h, t), color, y0 > 0.01);
    else {
      let x = s0;
      while (x < s1 - 0.01) {
        const w = Math.min(rng.range(0.6, 1.3), s1 - x), edge = Math.min(x, L - (x + w));
        const keep = 1 - ruin * Math.max(0, Math.min(0.8, rng.range(0, 1.1) - (edge < 1.2 ? 0.4 : 0)));
        let hh = Math.max(h * keep, Math.min(1, h));
        if (y0 > 0.01) hh = rng.f() > ruin * 0.5 ? h * keep : 0;
        if (hh > 0.05) mb.addBox(T(bas, a.add(dir.mul(x + w / 2)).add(v(0, y0 + hh / 2, 0))), v(w + 0.01, hh, t), jitter(color, rng, 0.05), y0 > 0.01);
        x += w;
      }
    }
    if (col) col.push([T(bas, a.add(dir.mul((s0 + s1) / 2)).add(v(0, y0 + h / 2, 0))), v(s1 - s0, h, t)]);
  }
  for (const o of ops) {
    const base = a.add(dir.mul(o.c));
    if (o.kind === 'door' || o.kind === 'gate') {
      const top = y0 + o.h;
      if (top < y0 + h - 0.02 && (ruin <= 0 || rng.f() > ruin * 0.4)) mb.addBox(T(bas, base.add(v(0, (top + y0 + h) / 2, 0))), v(o.w, y0 + h - top, t), color, true);
      if (col && top < y0 + h) col.push([T(bas, base.add(v(0, (top + y0 + h) / 2, 0))), v(o.w, y0 + h - top, t)]);
      for (const s of [-1, 1]) mb.addBox(T(bas, base.add(dir.mul(s * (o.w / 2 - 0.05))).add(v(0, y0 + o.h / 2, 0))), v(0.1, o.h, t + 0.06), trim, true);
      mb.addBox(T(bas, base.add(v(0, y0 + o.h, 0))), v(o.w, 0.12, t + 0.06), trim, true);
    } else {
      const sill = o.sill ?? 0.95, wtop = sill + o.h;
      mb.addBox(T(bas, base.add(v(0, y0 + sill / 2, 0))), v(o.w, sill, t), color, y0 > 0.01);
      if (wtop < h && (ruin <= 0 || rng.f() > ruin * 0.5)) mb.addBox(T(bas, base.add(v(0, y0 + (wtop + h) / 2, 0))), v(o.w, h - wtop, t), color, true);
      mb.addBox(T(bas, base.add(v(0, y0 + sill - 0.03, 0)).add(nrm.mul(0.08))), v(o.w + 0.15, 0.06, t + 0.16), trim, true);
      if (col) col.push([T(bas, base.add(v(0, y0 + h / 2, 0))), v(o.w, h, t)]);
      if (ruin <= 0) {
        const fc = [0.25, 0.27, 0.25, 0.2];
        for (const s of [-1, 0, 1]) mb.addBox(T(bas, base.add(dir.mul(s * (o.w / 2 - 0.03))).add(v(0, y0 + sill + o.h / 2, 0))), v(0.06, o.h, 0.1), fc, true);
        mb.addBox(T(bas, base.add(v(0, y0 + sill + o.h * 0.55, 0))), v(o.w, 0.05, 0.1), fc, true);
        glass.addBox(T(bas, base.add(v(0, y0 + sill + o.h / 2, 0))), v(o.w - 0.05, o.h - 0.05, 0.03), [0.25, 0.32, 0.36, 0.7], true);
      } else {
        const roll = rng.f();
        if (roll < 0.35) for (let k = 0; k < 3; k++) mb.addBox(T(bas.mul(M3.rz(rng.range(-0.25, 0.25))), base.add(v(0, y0 + sill + o.h * (0.2 + 0.3 * k), 0)).add(nrm.mul(t / 2 + 0.03))), v(o.w + 0.2, 0.16, 0.04), jitter([0.45, 0.36, 0.25, 0.4], rng, 0.1), true);
        else if (roll < 0.6) mb.addBox(T(bas.mul(M3.rz(0.3)), base.add(v(0, y0 + sill + o.h / 2, 0))), v(0.05, o.h * 0.9, 0.08), [0.22, 0.2, 0.18, 0.3], true);
        mb.addBox(T(bas, base.add(v(0, y0 + Math.min(wtop + 0.4, h - 0.1), 0)).add(nrm.mul(t / 2 + 0.005))), v(o.w * 0.9, 0.6, 0.01), [0.08, 0.07, 0.06, 0], true);
      }
    }
  }
}

function sideAB(side, hw, hd) {
  switch (side) {
    case 'n': return [v(-hw, 0, -hd), v(hw, 0, -hd)];
    case 's': return [v(-hw, 0, hd), v(hw, 0, hd)];
    case 'e': return [v(hw, 0, -hd), v(hw, 0, hd)];
    default: return [v(-hw, 0, -hd), v(-hw, 0, hd)];
  }
}

export function shell(def, ruin, seed) {
  const rng = new RNG(seed), sh = new MeshBuilder(), rf = new MeshBuilder(), gl = new MeshBuilder(), col = [];
  const [w, d] = def.size, hw = w / 2, hd = d / 2, floors = Math.max(1, def.floors || 1), hangar = !!def.hangar, brick = !!def.brick;
  let wallC = [...(def.wall || [0.6, 0.58, 0.54])]; wallC[3] = brick ? MAT.BRICK : MAT.CONCRETE;
  if (ruin > 0) wallC = darken(wallC, 0.12);
  const trim = brick ? [0.6, 0.58, 0.52, 0] : [0.42, 0.41, 0.38, 0];
  const t = brick ? 0.38 : 0.3, fh = hangar ? 5.2 : FLOOR_H;
  for (const side of ['n', 's', 'e', 'w']) {
    const [a, b] = sideAB(side, (side === 'e' || side === 'w') ? hw - t / 2 : hw, (side === 'n' || side === 's') ? hd - t / 2 : hd);
    const L = b.sub(a).len();
    for (let fi = 0; fi < floors; fi++) {
      wallRun(fi === 0 ? sh : rf, gl, fi === 0 ? col : null, a, b, fi * fh, fh, t, openingsFor(def, side, L, fi), wallC, fi === 0 ? ruin : Math.min(1, ruin * 1.3), rng, trim);
    }
    const dir = b.sub(a).norm();
    sh.addBox(T(M3.ry(Math.atan2(dir.x, dir.z) - Math.PI / 2), a.add(b).mul(0.5).add(v(0, 0.2, 0))), v(L + t, 0.4, t + 0.1), [0.35, 0.34, 0.32, 0], true);
  }
  for (let fi = 1; fi < floors; fi++) rf.addBox(T(I(), v(0, fi * fh, 0)), v(w + 0.1, 0.22, d + 0.1), trim);
  const top = floors * fh;
  if (hangar) hangarRoof(rf, w, d, top, ruin, rng, def); else flatRoof(rf, w, d, top, ruin, rng, wallC, trim);
  return { shell: sh, roof: rf, glass: gl, col, height: top };
}

function flatRoof(rf, w, d, top, ruin, rng, wallC, trim) {
  const slab = [0.45, 0.44, 0.41, 0], nx = Math.ceil(w / 3), nz = Math.ceil(d / 3);
  for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
    const cx = -w / 2 + ix * w / nx + w / nx / 2, cz = -d / 2 + iz * d / nz + d / nz / 2, ps = v(w / nx + 0.01, 0.25, d / nz + 0.01);
    if (ruin > 0) {
      const roll = rng.f();
      if (roll < 0.4 * ruin) continue;
      if (roll < 0.6 * ruin) { rf.addBox(T(M3.rx(rng.range(-0.6, 0.6)).mul(M3.rz(rng.range(-0.6, 0.6))), v(cx, top * 0.45, cz)), ps, darken(slab, 0.2)); continue; }
      rf.addBox(T(I(), v(cx, top + 0.12, cz)), ps, jitter(darken(slab, 0.15), rng, 0.08), false, jitter([0.2, 0.19, 0.18, 0], rng, 0.1));
    } else rf.addBox(T(I(), v(cx, top + 0.12, cz)), ps, slab, false, jitter([0.27, 0.26, 0.25, 0], rng, 0.05));
  }
  for (const s of [-1, 1]) {
    if (ruin <= 0 || rng.f() > ruin * 0.6) rf.addBox(T(I(), v(0, top + 0.3, s * d / 2)), v(w + 0.1, 0.6, 0.25), wallC, true);
    if (ruin <= 0 || rng.f() > ruin * 0.6) rf.addBox(T(I(), v(s * w / 2, top + 0.3, 0)), v(0.25, 0.6, d + 0.1), wallC, true);
  }
}

function hangarRoof(rf, w, d, top, ruin, rng, def) {
  const alongZ = d >= w, span = alongZ ? w : d, length = alongZ ? d : w, rise = span * 0.18, sheet = [0.38, 0.4, 0.4, 0.2];
  const n = Math.floor(length / 1.5), sw = (p) => (alongZ ? p : v(p.z, p.y, p.x));
  for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
    if (ruin > 0 && rng.f() < ruin * 0.45) continue;
    const lc = -length / 2 + i * length / n + length / n / 2;
    const pe = v(side * span / 2 * 1.04, top, lc), pr = v(0, top + rise, lc), c = pe.add(pr).mul(0.5);
    const ang = Math.atan2(rise, span / 2);
    let bas = M3.rz(-side * ang); let cc = jitter(sheet, rng, 0.08);
    if (ruin > 0 && rng.f() < 0.4) cc = [0.4, 0.24, 0.13, 0.3];
    if (!alongZ) bas = M3.ry(Math.PI / 2).mul(bas);
    rf.addBox(T(bas, sw(c)), v(span / 2 * 1.08 / Math.cos(ang), 0.06, length / n + 0.02), cc);
  }
  const gc = [...(def.wall || [0.5, 0.5, 0.46])]; gc[3] = 0;
  for (const e of [-1, 1]) {
    const a = sw(v(-span / 2, top, e * length / 2)), b = sw(v(span / 2, top, e * length / 2)), r = sw(v(0, top + rise, e * length / 2));
    if (ruin <= 0 || rng.f() > ruin * 0.5) { const nn = alongZ ? v(0, 0, e) : v(e, 0, 0); rf.tri(a, b, r, gc, nn); rf.tri(a, r, b, gc, nn.neg()); }
  }
  for (let i = 0; i <= Math.floor(length / 4); i++) {
    const lc = -length / 2 + i * 4, p0 = sw(v(-span / 2, top, lc)), p1 = sw(v(0, top + rise - 0.1, lc)), p2 = sw(v(span / 2, top, lc)), tc = [0.3, 0.2, 0.12, 0.3];
    rf.beam(p0, p1, 0.15, 0.2, tc); rf.beam(p1, p2, 0.15, 0.2, tc); rf.beam(p0, p2, 0.12, 0.15, tc);
  }
}

export function scaffold(def, height) {
  const mb = new MeshBuilder(), [w, d] = def.size, off = 0.9, pole = [0.4, 0.4, 0.42, 0.2], plank = [0.55, 0.42, 0.26, 0.4];
  const h = Math.min(height + 1, 8);
  for (const side of ['n', 's', 'e', 'w']) {
    const [a, b] = sideAB(side, w / 2 + off, d / 2 + off), L = b.sub(a).len(), n = Math.floor(L / 2.5) + 1;
    for (let i = 0; i <= n; i++) { const p = a.lerp(b, i / n); mb.cylBetween(p, p.add(v(0, h, 0)), 0.04, 0.04, 5, pole, false); }
    for (const y of [1.6, 3.4, 5.2]) if (y < h) {
      mb.beam(a.add(v(0, y, 0)), b.add(v(0, y, 0)), 0.05, 0.05, pole);
      const inn = a.add(b).mul(-0.5).flat().norm().mul(0.35);
      mb.beam(a.add(v(0, y - 0.05, 0)).add(inn), b.add(v(0, y - 0.05, 0)).add(inn), 0.6, 0.04, plank);
    }
    for (let i = 0; i < n; i++) mb.beam(a.lerp(b, i / n).add(v(0, 0.2, 0)), a.lerp(b, (i + 1) / n).add(v(0, Math.min(h, 3.4), 0)), 0.03, 0.03, pole);
  }
  return mb;
}

export function upgrades(def, height, rng) {
  const mb = new MeshBuilder(), [w, d] = def.size, di = doorInfo(def), dp = di.pos, out = di.out, side = v(out.z, 0, -out.x);
  const c = dp.add(out.mul(2.2));
  P.sandbags(mb, null, c.add(side.mul(3.2)).sub(out.mul(0.3)), c.add(side.mul(1.3)), 4, rng);
  P.sandbags(mb, null, c.sub(side.mul(1.3)), c.sub(side.mul(3.2)).sub(out.mul(0.3)), 4, rng);
  for (const s of [-1, 1]) mb.addBox(T(I(), v(s * (w / 2 + 0.2), 1.6, 0)), v(0.05, 1.6, 1.6), [0.3, 0.32, 0.3, 0.2], true);
  const rp = v(w * 0.3, height + 0.3, -d * 0.25);
  mb.cylBetween(rp, rp.add(v(0, 4, 0)), 0.04, 0.02, 5, [0.3, 0.3, 0.3, 0.2]);
  mb.addBox(T(I(), v(-w * 0.3, height + 0.5, d * 0.25)), v(1.2, 0.8, 0.8), [0.55, 0.55, 0.52, 0.2], true);
  mb.addBox(T(I(), dp.add(out.mul(0.25)).add(v(0, 3, 0))), v(0.4, 0.25, 0.3), [0.25, 0.25, 0.25, 0.2], true);
  mb.addBox(T(I(), dp.add(out.mul(0.42)).add(v(0, 3, 0))), v(0.3, 0.18, 0.02), [1.0, 0.95, 0.8, 0.8], true);
  const fp = dp.add(out.mul(0.2)).add(side.mul(1.6)).add(v(0, 2.6, 0)), fb = M3.look(out.neg());
  mb.addBox(T(fb, fp), v(0.9, 0.6, 0.02), [0.08, 0.08, 0.08, 0.5], true);
  mb.addBox(T(fb, fp.add(v(0, -0.6, 0))), v(0.9, 0.6, 0.02), [0.6, 0.06, 0.05, 0.5], true);
  return mb;
}

export function debrisInside(def, rng) {
  const mb = new MeshBuilder(), [w, d] = def.size;
  for (let i = 0; i < Math.floor(w * d / 40) + 2; i++) P.debrisSmall(mb, v(rng.range(-w * 0.4, w * 0.4), 0, rng.range(-d * 0.4, d * 0.4)), 1.2, 6, rng);
  return mb;
}

// ------------------------------------------------------------------ интерьеры
function partition(mb, col, a, b, doorC, color) {
  const ops = doorC >= 0 ? [{ c: doorC, w: 1.6, kind: 'door', h: 2.3 }] : [];
  wallRun(mb, new MeshBuilder(), col, a, b, 0, 3.2, 0.15, ops, color, 0, new RNG(1), darken(color, 0.2));
}

export function interior(def, ruined, seed) {
  const rng = new RNG(seed), mb = new MeshBuilder(), col = [], [w, d] = def.size, hw = w / 2, hd = d / 2, kind = def.kind;
  let term = v(), lights = [];
  let floorC = [0.42, 0.41, 0.38, 0];
  if (kind === 'hq') floorC = [0.45, 0.33, 0.22, 0.4]; else if (kind === 'medpoint') floorC = [0.62, 0.64, 0.6, 0]; else if (kind === 'barracks') floorC = [0.48, 0.36, 0.25, 0.4];
  if (!def.open && kind !== 'tower') mb.addBox(T(I(), v(0, 0.015, 0)), v(w - 0.2, 0.03, d - 0.2), floorC, true);
  const wc = [0.66, 0.64, 0.58, 0];
  const R = (yaw) => M3.ry(yaw);
  switch (kind) {
    case 'hq':
      partition(mb, col, v(-5, 0, -hd + 0.15), v(-5, 0, hd - 0.15), d - 2.5, wc);
      partition(mb, col, v(5, 0, -hd + 0.15), v(5, 0, hd - 0.15), d - 2.5, wc);
      P.mapTable(mb, col, T(I(), v(0, 0, -2.5))); term = v(0, 0, -1.2);
      P.table(mb, col, T(I(), v(-9.5, 0, 0)), [1.6, 0.8]); P.chair(mb, T(I(), v(-9.5, 0, -0.8)));
      P.locker(mb, col, T(R(Math.PI), v(-12.5, 0, -6.5))); P.locker(mb, col, T(R(Math.PI), v(-11.8, 0, -6.5)));
      P.table(mb, col, T(I(), v(9.5, 0, -4.5)), [2.0, 1.0], [0.35, 0.22, 0.14, 0.4]); P.chair(mb, T(R(Math.PI), v(9.5, 0, -5.4)));
      P.shelfRack(mb, col, T(I(), v(9.5, 0, 6.6)), 4, rng, 0.5);
      P.flag(mb, null, v(12.5, 0, -6.8), 2.4);
      for (let i = 0; i < 8; i++) mb.addBox(T(I(), v(-3.6, 0.1 + i * 0.2, -6.5 + i * 0.3)), v(1, 0.2, 0.3), [0.4, 0.4, 0.38, 0], true);
      col.push([T(I(), v(-3.6, 0.8, -5.4)), v(1, 1.6, 2.4)]);
      lights = [v(0, 3, -2), v(-9.5, 3, 0), v(9.5, 3, 0)];
      break;
    case 'barracks':
      for (let i = 0; i < 7; i++) {
        const z = -hd + 2.5 + i * 4.4;
        if (Math.abs(z) < 1.6 || Math.abs(z - 12) < 1.6) continue;
        P.bunkBed(mb, col, T(R(Math.PI / 2), v(-hw + 1.4, 0, z)));
        P.bunkBed(mb, col, T(R(Math.PI / 2), v(hw - 1.4, 0, z + 2.2)));
      }
      P.table(mb, col, T(I(), v(0, 0, -4)), [1.0, 2.6]); P.stove(mb, col, T(I(), v(0, 0, 6)));
      term = v(1.5, 0, -1.5); lights = [v(0, 3, -10), v(0, 3, 8)];
      break;
    case 'armory':
      P.weaponRack(mb, col, T(I(), v(-1, 0, -hd + 0.6)), 6, 8);
      P.weaponRack(mb, col, T(R(Math.PI), v(-1, 0, hd - 0.6)), 6, 6);
      for (let i = 0; i < 4; i++) P.ammoBox(mb, col, T(R(rng.range(-0.2, 0.2)), v(-hw + 1.2, 0.4 * (i % 2), -2 + Math.floor(i / 2))));
      P.table(mb, col, T(I(), v(2.5, 0, 1.5)), [1.6, 0.8]);
      term = v(4, 0, -2.5); lights = [v(0, 3, 0)];
      break;
    case 'warehouse':
      for (let row = 0; row < 3; row++) {
        P.shelfRack(mb, col, T(R(Math.PI / 2), v(-2 + row * 4.5, 0, -6)), 9, rng, ruined ? 0.25 : 0.7);
        P.shelfRack(mb, col, T(R(Math.PI / 2), v(-2 + row * 4.5, 0, 7)), 9, rng, ruined ? 0.25 : 0.7);
      }
      for (let i = 0; i < 6; i++) { P.pallet(mb, T(R(rng.f() * 0.4), v(-hw + 2.5, 0, -12 + i * 4.6))); P.crate(mb, col, T(R(rng.f() * 0.4), v(-hw + 2.5, 0.15, -12 + i * 4.6)), v(1, 0.8, 1)); }
      P.table(mb, col, T(I(), v(-hw + 2, 0, 3.5)), [1.6, 0.8]);
      term = v(-hw + 3.2, 0, 3.5); lights = [v(0, 4.5, -8), v(0, 4.5, 8)];
      break;
    case 'workshop':
      P.workbench(mb, col, T(R(Math.PI), v(2, 0, -hd + 0.9)), rng); P.workbench(mb, col, T(R(Math.PI), v(6, 0, -hd + 0.9)), rng);
      P.shelfRack(mb, col, T(I(), v(4, 0, hd - 0.7)), 6, rng, 0.5);
      mb.addBox(T(I(), v(-2, 0.5, 2)), v(1.4, 1, 1), [0.3, 0.32, 0.3, 0.2], true); col.push([T(I(), v(-2, 0.5, 2)), v(1.4, 1, 1)]);
      P.tireStack(mb, col, v(hw - 1.2, 0, 2.5), 3, rng);
      term = v(4, 0, -hd + 2); lights = [v(0, 4.5, 0)];
      break;
    case 'medpoint':
      for (let i = 0; i < 3; i++) P.medBed(mb, col, T(I(), v(-1.5 + i * 2.4, 0, 3)));
      P.cabinet(mb, col, T(R(Math.PI), v(4.5, 0, hd - 0.6)));
      P.table(mb, col, T(I(), v(5, 0, -1.5)), [1.4, 0.8], [0.75, 0.76, 0.74, 0.2]);
      term = v(5, 0, -0.5); lights = [v(0, 3, 0)];
      break;
    case 'radio':
      P.radioConsole(mb, col, T(I(), v(-1.5, 0, -hd + 1))); P.chair(mb, T(R(Math.PI), v(-1.5, 0, -hd + 2)));
      term = v(-1.5, 0, -hd + 2.4); lights = [v(0, 3, 0)];
      break;
    case 'generator':
      P.generatorUnit(mb, col, T(I(), v(0.5, 0, -1)), ruined);
      mb.addBox(T(I(), v(-hw + 0.5, 1.4, 2.5)), v(0.3, 1.4, 1.2), [0.35, 0.38, 0.35, 0.2], true);
      mb.addBox(T(I(), v(-hw + 0.66, 1.6, 2.5)), v(0.02, 0.3, 0.4), [0.9, 0.7, 0.2, 0.8], true);
      for (let i = 0; i < 3; i++) P.barrel(mb, col, v(hw - 1, 0, 2.6 - i * 0.7), [0.25, 0.35, 0.22, 0.2]);
      term = v(-hw + 1.4, 0, 2.5); lights = [v(0, 3, 0)];
      break;
    case 'garage':
      for (const k of [-1, 0, 1]) mb.addBox(T(I(), v(k * 8.5, 0.035, 1)), v(1, 0.02, 6), [0.15, 0.14, 0.13, 0], true);
      P.shelfRack(mb, col, T(I(), v(0, 0, hd - 0.7)), 8, rng, 0.4);
      if (ruined) P.uaz(mb, col, T(R(0.15), v(8.5, 0, 0.5)), undefined, true);
      term = v(-4, 0, hd - 2); lights = [v(-8, 4.5, 0), v(8, 4.5, 0)];
      break;
    case 'training': term = v(hw - 2, 0, 0); break;
    case 'kpp': term = v(8, 0, -2.5); break;
    case 'tower': term = v(0, 0, def.door[0] === 's' ? 2.6 : -2.6); break;
  }
  if (ruined && !def.open && kind !== 'tower') mb.append(debrisInside(def, rng));
  return { mb, col, terminal: term, lights };
}

// ------------------------------------------------------------------ КПП, тренировочная площадка, вышки
export function openSite(def, ruin, seed) {
  const rng = new RNG(seed), mb = new MeshBuilder(), rf = new MeshBuilder(), col = [], [w, d] = def.size;
  if (def.kind === 'kpp') {
    const bp = v(9, 0, -2);
    const bs = shell({ size: [4, 3], floors: 1, door: ['w', 0], wall: [0.62, 0.62, 0.58], kind: 'booth' }, ruin * 0.6, seed + 5);
    const bxf = T(I(), bp);
    mb.append(bs.shell, bxf); rf.append(bs.roof, bxf); mb.append(bs.glass, bxf);
    for (const c of bs.col) col.push([bxf.mul(c[0]), c[1]]);
    mb.addBox(T(I(), bp.add(v(0, 0.015, 0))), v(3.8, 0.03, 2.8), [0.4, 0.4, 0.38, 0], true);
    const armAng = ruin <= 0 ? 0 : -0.35;
    mb.addBox(T(I(), v(5.2, 0.5, 2.5)), v(0.4, 1, 0.4), [0.3, 0.3, 0.3, 0.2], true);
    mb.addBox(T(M3.rz(armAng), v(1, ruin <= 0 ? 1 : 0.6, 2.5)), v(8, 0.12, 0.12), [0.85, 0.85, 0.82, 0.2], true);
    for (let i = 0; i < 4; i++) mb.addBox(T(M3.rz(armAng), v(-2 + i * 2, ruin <= 0 ? 1 : 0.6, 2.5)), v(0.9, 0.13, 0.13), [0.8, 0.12, 0.1, 0.2], true);
    for (let [a, b] of [[v(-7.5, 0, -1.5), v(-2.5, 0, -1.5)], [v(2.5, 0, -1.5), v(6, 0, -1.5)], [v(-11, 0, -4), v(-7, 0, -4)], [v(7.5, 0, -5.5), v(11, 0, -5.5)]]) {
      if (ruin > 0) b = a.lerp(b, rng.range(0.5, 0.8));
      P.sandbags(mb, col, a, b, ruin <= 0 ? 4 : 2, rng);
    }
    for (const jp of [v(-3.4, 0, 8.6), v(3.4, 0, 5.6)]) P.jersey(mb, col, T(M3.ry(rng.range(-0.2, 0.2) * ruin), jp));
    if (ruin <= 0) for (const s of [-1, 1]) mb.addBox(T(I(), v(s * 9, 1.3, 2)), v(5.8, 2.4, 0.08), [0.3, 0.33, 0.28, 0.2], true);
    else mb.addBox(T(M3.rx(-1.45).mul(M3.ry(0.2)), v(-5, 0.15, 5)), v(5.8, 2.4, 0.08), [0.35, 0.22, 0.13, 0.3], true);
  } else if (def.kind === 'training') {
    const hw = w / 2, hd = d / 2, c = [0.45, 0.36, 0.25, 0.4];
    for (const s of [-1, 1]) {
      mb.beam(v(-hw, 0.9, s * hd), v(hw, 0.9, s * hd), 0.08, 0.08, c);
      mb.beam(v(-hw, 0.9, s * hd), v(-hw, 0.9, -s * hd), 0.08, 0.08, c);
      for (let i = 0; i <= Math.floor(w / 3); i++) mb.addBox(T(I(), v(-hw + i * 3, 0.5, s * hd)), v(0.1, 1, 0.1), c, true);
    }
    for (let i = 0; i < 5; i++) {
      const p = v(-hw + 2, 0, -8 + i * 3.5);
      if (ruin > 0 && rng.f() < 0.4) mb.addBox(T(M3.rz(Math.PI / 2), p.add(v(0, 0.1, 0))), v(0.6, 0.9, 0.03), [0.6, 0.55, 0.42, 0.5], true);
      else P.targetStand(mb, col, T(M3.ry(-Math.PI / 2), p));
    }
    for (let i = 0; i < 5; i++) P.sandbags(mb, col, v(hw - 9, 0, -9 + i * 3.5), v(hw - 9, 0, -7.6 + i * 3.5), 2, rng);
    for (let i = 0; i < 3; i++) { const p = v(-6 + i * 5, 0, hd - 4); mb.addBox(T(I(), p.add(v(0, 0.6, 0))), v(0.3, 1.2, 3), c, true); col.push([T(I(), p.add(v(0, 0.6, 0))), v(0.3, 1.2, 3)]); }
    for (let i = 0; i < 6; i++) P.tire(mb, T(I(), v(-10 + (i % 2), 0, hd - 9 - i)));
    mb.beam(v(4, 2.4, -hd + 3), v(7, 2.4, -hd + 3), 0.06, 0.06, P.C.METAL_GRAY);
    for (const x of [4, 7]) mb.addBox(T(I(), v(x, 1.2, -hd + 3)), v(0.1, 2.4, 0.1), P.C.METAL_GRAY, true);
    mb.addBox(T(I(), v(hw - 1.5, 1.2, 0)), v(0.1, 1.2, 2), [0.35, 0.3, 0.22, 0.4], true);
    mb.addBox(T(I(), v(hw - 1.56, 1.3, 0)), v(0.02, 0.9, 1.8), [0.75, 0.7, 0.6, 0.5], true);
    col.push([T(I(), v(hw - 1.5, 1.2, 0)), v(0.12, 2.4, 2)]);
  } else if (def.kind === 'tower') tower(mb, rf, col, ruin, rng);
  return { shell: mb, roof: rf, col, glass: new MeshBuilder(), height: 5.5 };
}

function tower(mb, rf, col, ruin, rng) {
  const h = 5.5, w = 1.6, wood = [0.42, 0.33, 0.22, 0.4];
  const lean = M3.rz(0.08 * ruin).mul(M3.rx(0.05 * ruin));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const base = v(sx * w * 1.2, 0, sz * w * 1.2);
    mb.beam(base, lean.mulV(v(sx * w, h, sz * w)), 0.2, 0.2, wood);
    col.push([T(I(), base.add(v(0, 1.5, 0))), v(0.3, 3, 0.3)]);
  }
  for (const y of [1.8, 3.6]) for (const s of [-1, 1]) {
    mb.beam(lean.mulV(v(-w * 1.13, y, s * w * 1.13)), lean.mulV(v(w * 1.13, y, s * w * 1.13)), 0.1, 0.1, wood);
    mb.beam(lean.mulV(v(s * w * 1.13, y, -w * 1.13)), lean.mulV(v(s * w * 1.13, y, w * 1.13)), 0.1, 0.1, wood);
  }
  for (let i = 0; i < 14; i++) mb.beam(v(-0.3, 0.3 + i * 0.38, w * 1.35 - i * 0.02), v(0.3, 0.3 + i * 0.38, w * 1.35 - i * 0.02), 0.05, 0.05, wood);
  const plat = new Xf(lean, v(0, h, 0));
  if (ruin < 0.8 || rng.f() < 0.5) {
    rf.addBox(plat.mul(T(I(), v(0, 0.1, 0))), v(w * 2.6, 0.15, w * 2.6), wood);
    for (const s of [-1, 1]) {
      rf.addBox(plat.mul(T(I(), v(0, 0.6, s * w * 1.25))), v(w * 2.6, 0.9, 0.06), darken(wood, 0.1));
      rf.addBox(plat.mul(T(I(), v(s * w * 1.25, 0.6, 0))), v(0.06, 0.9, w * 2.6), darken(wood, 0.1));
    }
  }
  if (ruin <= 0) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rf.beam(plat.mulV(v(sx * w * 1.2, 0.2, sz * w * 1.2)), plat.mulV(v(sx * w * 1.2, 2.4, sz * w * 1.2)), 0.08, 0.08, wood);
    rf.addBox(plat.mul(T(I(), v(0, 2.5, 0))), v(w * 3, 0.08, w * 3), [0.33, 0.35, 0.32, 0.2]);
    rf.addBox(plat.mul(T(I(), v(w, 1.3, -w))), v(0.35, 0.3, 0.4), [0.25, 0.25, 0.25, 0.2]);
    rf.addBox(plat.mul(T(I(), v(w, 1.3, -w - 0.21))), v(0.28, 0.22, 0.02), [1, 0.95, 0.8, 0.8]);
  }
}
export { hashStr };
