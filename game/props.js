// Библиотека процедурных объектов окружения в едином стиле (low-poly, постсоветская промзона 90-х).
// Каждая функция дописывает геометрию в MeshBuilder и (опционально) коллизии в массив col: [Xf, V3 размер].
import { V3, M3, Xf, TAU } from '../engine/math.js';
import { MeshBuilder, MAT, jitter, darken, lighten } from '../engine/mesh.js';

export const C = {
  CONCRETE: [0.58, 0.57, 0.53, 0.0], CONCRETE_D: [0.42, 0.41, 0.38, 0.0], RUST: [0.42, 0.24, 0.13, 0.3],
  METAL_GREEN: [0.24, 0.3, 0.2, 0.2], METAL_GRAY: [0.38, 0.39, 0.38, 0.2], METAL_BLUE: [0.22, 0.3, 0.38, 0.2],
  WOOD: [0.5, 0.38, 0.24, 0.4], WOOD_OLD: [0.4, 0.33, 0.25, 0.4], SAND: [0.55, 0.5, 0.36, 0.5], RUBBER: [0.1, 0.1, 0.1, 1.0],
  BURNT: [0.16, 0.13, 0.11, 0.3], BRICK: [0.55, 0.33, 0.25, 0.1], REBAR: [0.32, 0.2, 0.12, 0.3],
};
const I = () => new M3();
export const T = (b, v) => new Xf(b, v);
export const at = (x, y, z) => new Xf(new M3(), new V3(x, y, z));
const v = (x, y, z) => new V3(x, y, z);
export const addCol = (col, xf, size) => { if (col) col.push([xf, size]); };

// ---------------------------------------------------------------- ящики, бочки
export function crate(mb, col, xf, size = v(1, 0.8, 1), c = C.WOOD) {
  const h = size.y;
  mb.addBox(xf.mul(at(0, h / 2, 0)), size, c, true);
  const dk = darken(c, 0.25);
  for (const sx of [-1, 1]) mb.addBox(xf.mul(at(sx * size.x / 2, h / 2, 0)), v(0.03, h + 0.02, size.z * 0.98), dk, true);
  mb.addBox(xf.mul(at(0, h / 2, size.z / 2)), v(size.x * 0.9, 0.08, 0.03), dk, true);
  mb.addBox(xf.mul(at(0, h / 2, -size.z / 2)), v(size.x * 0.9, 0.08, 0.03), dk, true);
  addCol(col, xf.mul(at(0, h / 2, 0)), size);
}
export function ammoBox(mb, col, xf) {
  const c = [0.27, 0.33, 0.2, 0.4];
  mb.addBox(xf.mul(at(0, 0.2, 0)), v(0.9, 0.4, 0.45), c, true);
  mb.addBox(xf.mul(at(0, 0.41, 0)), v(0.92, 0.04, 0.47), darken(c, 0.2), true);
  for (const sx of [-0.3, 0.3]) mb.addBox(xf.mul(at(sx, 0.25, 0.23)), v(0.12, 0.06, 0.02), [0.15, 0.15, 0.15, 0.2], true);
  addCol(col, xf.mul(at(0, 0.2, 0)), v(0.9, 0.4, 0.45));
}
export function barrel(mb, col, pos, c, lying = false, yaw = 0) {
  let xf;
  if (lying) xf = T(M3.ry(yaw).mul(M3.rz(Math.PI / 2)), pos.add(v(0, 0.3, 0))).mul(at(0, -0.45, 0));
  else xf = T(M3.ry(yaw), pos);
  mb.addCyl(xf, 0.3, 0.3, 0.9, 10, c, true, true, darken(c, 0.2));
  for (const y of [0.2, 0.7]) mb.addCyl(xf.mul(at(0, y - 0.025, 0)), 0.315, 0.315, 0.05, 10, darken(c, 0.15), false);
  if (lying) addCol(col, T(M3.ry(yaw), pos.add(v(0, 0.3, 0))), v(0.9, 0.6, 0.6));
  else addCol(col, xf.mul(at(0, 0.45, 0)), v(0.6, 0.9, 0.6));
}
export function sandbags(mb, col, a, b, rows = 3, rng = null) {
  const d = b.sub(a); d.y = 0; const l = d.len(); if (l < 0.1) return;
  const dir = d.mul(1 / l), yaw = Math.atan2(-dir.x, -dir.z) + Math.PI / 2;
  const bag = v(0.62, 0.22, 0.38);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? 0 : 0.31, n = Math.floor((l - off) / 0.6);
    for (let i = 0; i < n; i++) {
      let p = a.add(dir.mul(off + 0.3 + i * 0.6)).add(v(0, 0.11 + r * 0.21, 0));
      let c = C.SAND;
      if (rng) { c = jitter(c, rng, 0.1); p = p.add(v(rng.range(-0.03, 0.03), 0, rng.range(-0.03, 0.03))); }
      mb.addBox(T(M3.ry(yaw + (rng ? rng.range(-0.06, 0.06) : 0)), p), bag, c, r === 0);
    }
  }
  const h = rows * 0.21 + 0.03;
  addCol(col, T(M3.ry(yaw), a.add(b).mul(0.5).add(v(0, h / 2, 0))), v(l, h, 0.42));
}
export function concreteBlock(mb, col, xf, size = v(2.4, 0.6, 0.6), c = C.CONCRETE) {
  mb.addBox(xf.mul(at(0, size.y / 2, 0)), size, c, true);
  addCol(col, xf.mul(at(0, size.y / 2, 0)), size);
}
export function jersey(mb, col, xf, c = C.CONCRETE) {
  mb.addBox(xf.mul(at(0, 0.2, 0)), v(2.0, 0.4, 0.6), c, true);
  mb.addBox(xf.mul(at(0, 0.6, 0)), v(2.0, 0.42, 0.24), c, true);
  mb.addBox(xf.mul(at(0, 0.6, 0)), v(0.6, 0.12, 0.25), [0.75, 0.15, 0.1, 0.2], true);
  addCol(col, xf.mul(at(0, 0.42, 0)), v(2.0, 0.84, 0.6));
}
export function tankTrap(mb, col, pos, yaw) {
  const b = M3.ry(yaw);
  for (const ax of [v(1, 0.9, 0).norm(), v(-1, 0.9, 0).norm(), v(0, 0.9, 1).norm()]) {
    const a = b.mulV(ax), l = 0.85, c = pos.add(v(0, 0.55, 0));
    mb.beam(c.sub(a.mul(l)), c.add(a.mul(l)), 0.12, 0.12, C.RUST);
  }
  addCol(col, T(b, pos.add(v(0, 0.55, 0))), v(1.2, 1.1, 1.2));
}
export function tire(mb, xf) { mb.addCyl(xf, 0.42, 0.42, 0.28, 10, C.RUBBER, true, true, [0.06, 0.06, 0.06, 1]); }
export function tireStack(mb, col, pos, n, rng) {
  for (let i = 0; i < n; i++) tire(mb, T(M3.ry(rng.f() * TAU), pos.add(v(rng.range(-0.06, 0.06), i * 0.28, rng.range(-0.06, 0.06)))));
  addCol(col, T(I(), pos.add(v(0, n * 0.14, 0))), v(0.84, n * 0.28, 0.84));
}
export function pallet(mb, xf, c = C.WOOD_OLD) {
  for (let i = 0; i < 5; i++) mb.addBox(xf.mul(at(-0.48 + i * 0.24, 0.13, 0)), v(0.14, 0.025, 1.2), c, true);
  for (const z of [-0.5, 0, 0.5]) mb.addBox(xf.mul(at(0, 0.06, z)), v(1.0, 0.1, 0.1), darken(c, 0.15), true);
}
export function cableDrum(mb, col, pos, yaw) {
  const xf = T(M3.ry(yaw).mul(M3.rz(Math.PI / 2)), pos.add(v(0, 0.75, 0))).mul(at(0, -0.5, 0));
  mb.addCyl(xf, 0.75, 0.75, 0.08, 12, C.WOOD);
  mb.addCyl(xf.mul(at(0, 0.92, 0)), 0.75, 0.75, 0.08, 12, C.WOOD);
  mb.addCyl(xf.mul(at(0, 0.08, 0)), 0.45, 0.45, 0.84, 10, [0.15, 0.15, 0.15, 1], false);
  addCol(col, T(M3.ry(yaw), pos.add(v(0, 0.75, 0))), v(1.0, 1.5, 1.5));
}
export function shippingContainer(mb, col, xf, c) {
  const L = 6, W = 2.44, H = 2.6;
  mb.addBox(xf.mul(at(0, H / 2, 0)), v(W, H, L), c, true);
  const rib = darken(c, 0.18);
  for (let i = 0; i < 14; i++) { const z = -L / 2 + 0.25 + i * (L - 0.5) / 13; for (const sx of [-1, 1]) mb.addBox(xf.mul(at(sx * (W / 2 + 0.02), H / 2, z)), v(0.05, H - 0.2, 0.12), rib, true); }
  for (const y of [0.06, H - 0.06]) for (const sx of [-1, 1]) mb.addBox(xf.mul(at(sx * (W / 2 + 0.03), y, 0)), v(0.08, 0.14, L + 0.04), darken(rib, 0.2), true);
  mb.addBox(xf.mul(at(0, H / 2, L / 2 + 0.02)), v(W - 0.1, H - 0.2, 0.04), rib, true);
  for (const sx of [-0.4, 0.4]) mb.addBox(xf.mul(at(sx, H / 2, L / 2 + 0.06)), v(0.05, H - 0.4, 0.05), C.METAL_GRAY, true);
  addCol(col, xf.mul(at(0, H / 2, 0)), v(W, H, L));
}
export function fuelTank(mb, col, xf, length = 6, r = 1.2, c = [0.5, 0.5, 0.46, 0.2]) {
  mb.addCyl(xf.mul(T(M3.rx(Math.PI / 2), v(0, r + 0.5, -length / 2))), r, r, length, 14, c, true, true, darken(c, 0.1));
  for (const z of [-length * 0.3, length * 0.3]) mb.addBox(xf.mul(at(0, 0.45, z)), v(r * 1.6, 0.9, 0.4), C.CONCRETE_D, true);
  mb.addCyl(xf.mul(at(0, r * 2 + 0.45, 0)), 0.25, 0.25, 0.3, 8, darken(c, 0.2));
  mb.beam(xf.mulV(v(r * 0.7, 0, length / 2 - 0.3)), xf.mulV(v(r * 0.7, r * 2 + 0.5, length / 2 - 0.3)), 0.06, 0.06, C.RUST);
  addCol(col, xf.mul(at(0, r + 0.5, 0)), v(r * 2, r * 2 + 1, length));
}

// ---------------------------------------------------------------- техника
const wheel = (mb, xf, x, y, z) => tire(mb, xf.mul(T(M3.rz(Math.PI / 2), v(x, y, z))).mul(at(0, -0.14, 0)));
export function uaz(mb, col, xf, c = [0.28, 0.33, 0.22, 0.2], burnt = false) {
  if (burnt) c = C.BURNT;
  const glass = burnt ? [0.05, 0.05, 0.05, 0.3] : [0.12, 0.14, 0.15, 0.7];
  mb.addBox(xf.mul(at(0, 0.75, 0.2)), v(1.78, 0.6, 3.2), c, true);
  mb.addBox(xf.mul(at(0, 0.62, -1.75)), v(1.7, 0.42, 0.9), c, true);
  mb.addBox(xf.mul(at(0, 1.4, 0.55)), v(1.72, 0.75, 2.3), burnt ? c : darken(c, 0.08), true);
  mb.addBox(xf.mul(T(M3.rx(-0.25), v(0, 1.33, -0.68))), v(1.6, 0.55, 0.05), glass, true);
  for (const sx of [-1, 1]) {
    mb.addBox(xf.mul(at(sx * 0.87, 1.42, 0.35)), v(0.03, 0.4, 1.7), glass, true);
    for (const z of [-1.35, 1.25]) wheel(mb, xf, sx * 0.81, 0.4, z);
  }
  mb.addBox(xf.mul(at(0, 0.6, -2.22)), v(1.4, 0.3, 0.1), C.RUBBER, true);
  for (const sx of [-0.6, 0.6]) mb.addBox(xf.mul(at(sx, 0.7, -2.21)), v(0.18, 0.18, 0.05), [0.7, 0.7, 0.6, 0.7], true);
  addCol(col, xf.mul(at(0, 0.9, 0)), v(1.85, 1.8, 4.5));
}
export function truck(mb, col, xf, c = [0.3, 0.36, 0.24, 0.2], burnt = false, tarp = true) {
  if (burnt) c = C.BURNT;
  const glass = burnt ? [0.04, 0.04, 0.04, 0.3] : [0.1, 0.12, 0.13, 0.7];
  mb.addBox(xf.mul(at(0, 0.9, 0.3)), v(0.9, 0.3, 7.0), [0.12, 0.12, 0.12, 0.2], true);
  mb.addBox(xf.mul(at(0, 1.55, -2.55)), v(2.3, 1.5, 1.6), c, true);
  mb.addBox(xf.mul(at(0, 1.2, -3.55)), v(2.0, 0.8, 0.9), c, true);
  mb.addBox(xf.mul(at(0, 1.85, -3.32)), v(2.0, 0.6, 0.05), glass, true);
  mb.addBox(xf.mul(at(0, 1.4, 1.2)), v(2.4, 0.5, 4.6), darken(c, 0.1), true);
  if (tarp && !burnt) mb.addBox(xf.mul(at(0, 2.4, 1.2)), v(2.45, 1.6, 4.6), [0.33, 0.35, 0.24, 0.5], true);
  else if (burnt) for (const z of [-0.6, 0.6, 1.8, 3.0]) mb.beam(xf.mulV(v(-1.15, 1.6, z)), xf.mulV(v(1.15, 1.6, z)), 0.05, 0.05, C.RUST);
  for (const sx of [-1, 1]) for (const z of [-2.9, 1.0, 2.4]) wheel(mb, xf, sx * 0.91, 0.52, z);
  addCol(col, xf.mul(at(0, 1.4, 0)), v(2.45, 2.8, 8.2));
}
export function btr(mb, col, xf, burnt = true) {
  const c = burnt ? C.BURNT : [0.3, 0.34, 0.24, 0.2];
  mb.addBox(xf.mul(at(0, 1.3, 0)), v(2.8, 1.2, 7.4), c, true);
  mb.addBox(xf.mul(T(M3.rx(0.6), v(0, 1.25, -3.75))), v(2.7, 1.0, 0.8), c, true);
  mb.addBox(xf.mul(at(0, 2.05, 0)), v(2.2, 0.35, 5.0), darken(c, 0.05), true);
  mb.addCyl(xf.mul(at(0, 2.2, -0.7)), 0.6, 0.5, 0.45, 8, c);
  mb.cylBetween(xf.mulV(v(0, 2.45, -1.0)), xf.mulV(v(0.2, 2.35, -2.9)), 0.06, 0.05, 6, [0.1, 0.1, 0.1, 0.2]);
  for (const sx of [-1, 1]) for (const z of [-2.6, -1.2, 1.0, 2.4]) wheel(mb, xf, sx * 1.24, 0.55, z);
  addCol(col, xf.mul(at(0, 1.2, 0)), v(2.9, 2.4, 8.0));
}

// ---------------------------------------------------------------- инфраструктура
export function lampPost(mb, col, pos, yaw, broken = false) {
  const b = M3.ry(yaw);
  mb.addCyl(T(b, pos), 0.12, 0.08, broken ? 4.2 : 7.0, 6, C.CONCRETE_D);
  const head = pos.add(v(0, 7, 0)).add(b.mulV(v(0, 0, -1.2)));
  if (!broken) {
    mb.beam(pos.add(v(0, 6.9, 0)), head.add(v(0, 0.05, 0)), 0.07, 0.07, C.METAL_GRAY);
    mb.addBox(T(b, head), v(0.3, 0.14, 0.55), C.METAL_GRAY);
    mb.addBox(T(b, head.add(v(0, -0.08, 0))), v(0.24, 0.03, 0.45), [1.0, 0.9, 0.7, 0.8]);
  }
  addCol(col, T(b, pos.add(v(0, 3.5, 0))), v(0.25, 7.0, 0.25));
  return head.add(v(0, -0.2, 0));
}
export function po2Fence(mb, col, a, b, h, rng, damage = 0) {
  const d = b.sub(a); d.y = 0; const l = d.len(); if (l < 0.2) return;
  const dir = d.mul(1 / l), yaw = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  const n = Math.ceil(l / 4), seg = l / n, bas = M3.ry(yaw);
  for (let i = 0; i < n; i++) {
    const c = a.add(dir.mul(seg * (i + 0.5)));
    let tilt = 0, hh = h;
    if (damage > 0 && rng.f() < damage) { tilt = rng.range(-0.18, 0.18); hh = h * rng.range(0.75, 1.0); }
    const pb = bas.mul(M3.rx(tilt));
    const cc = jitter(C.CONCRETE, rng, 0.07);
    mb.addBox(T(pb, c.add(v(0, hh / 2, 0))), v(seg - 0.05, hh, 0.16), cc, true);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
      const off = v(-seg / 2 + seg * (k + 0.5) / 4, hh * (r + 0.5) / 3, 0);
      for (const side of [-1, 1]) {
        const p = c.add(pb.mulV(off.add(v(0, 0, side * 0.085))));
        mb.addBox(T(pb.mul(M3.rz(Math.PI / 4)), p), v(0.32, 0.32, 0.02), darken(cc, 0.08));
      }
    }
    mb.addBox(T(bas, a.add(dir.mul(seg * i)).add(v(0, h / 2 + 0.1, 0))), v(0.24, h + 0.2, 0.24), C.CONCRETE_D, true);
  }
  mb.addBox(T(bas, b.add(v(0, h / 2 + 0.1, 0))), v(0.24, h + 0.2, 0.24), C.CONCRETE_D, true);
  addCol(col, T(bas, a.add(b).mul(0.5).add(v(0, h / 2, 0))), v(l, h, 0.3));
}
export function barbedWire(mb, a, b, y) {
  const d = b.sub(a), l = d.len(); if (l < 0.2) return;
  const n = Math.floor(l / 0.35), dir = d.mul(1 / l), side = v(0, 1, 0).cross(dir).norm();
  let prev = a.add(v(0, y, 0));
  for (let i = 1; i <= n; i++) {
    const t = i / n, ang = t * l * 9;
    const p = a.add(dir.mul(t * l)).add(v(0, y + Math.sin(ang) * 0.18, 0)).add(side.mul(Math.cos(ang) * 0.18));
    mb.beam(prev, p, 0.02, 0.02, [0.3, 0.27, 0.22, 0.3]); prev = p;
  }
}
export function chainlink(mb, col, a, b, h = 2.2) {
  const d = b.sub(a); d.y = 0; const l = d.len(), dir = d.mul(1 / l), n = Math.ceil(l / 3), c = [0.35, 0.36, 0.34, 0.3];
  for (let i = 0; i <= n; i++) mb.addCyl(T(I(), a.add(dir.mul(l * i / n))), 0.05, 0.05, h + 0.2, 6, C.METAL_GRAY, true);
  for (const y of [0.1, h / 2, h]) mb.beam(a.add(v(0, y, 0)), b.add(v(0, y, 0)), 0.03, 0.03, c);
  const k = Math.floor(l / 0.5);
  for (let i = 0; i < k; i++) {
    const p0 = a.add(dir.mul(l * i / k)), p1 = a.add(dir.mul(l * (i + 1) / k));
    mb.beam(p0.add(v(0, 0.1, 0)), p1.add(v(0, h, 0)), 0.012, 0.012, c);
    mb.beam(p0.add(v(0, h, 0)), p1.add(v(0, 0.1, 0)), 0.012, 0.012, c);
  }
  addCol(col, T(M3.ry(Math.atan2(dir.x, dir.z) + Math.PI / 2), a.add(b).mul(0.5).add(v(0, h / 2, 0))), v(l, h, 0.15));
}

// ---------------------------------------------------------------- завалы и мусор
export function rubblePile(mb, col, center, radius, rng, height = 1, withCol = true, c0 = C.CONCRETE) {
  const n = Math.floor(6 + radius * 7);
  for (let i = 0; i < n; i++) {
    const a = rng.f() * TAU, r = Math.sqrt(rng.f()) * radius, k = 1 - r / radius;
    const s = v(rng.range(0.3, 1.1), rng.range(0.15, 0.45), rng.range(0.3, 1.0)).mul(0.5 + k * 0.7);
    const p = center.add(v(Math.cos(a) * r, 0, Math.sin(a) * r)); p.y = k * height * 0.6 + s.y * 0.3;
    const bas = M3.ry(rng.f() * TAU).mul(M3.rx(rng.range(-0.5, 0.5))).mul(M3.rz(rng.range(-0.4, 0.4)));
    const roll = rng.f(); const cc = roll < 0.25 ? C.BRICK : roll < 0.35 ? C.CONCRETE_D : c0;
    mb.addBox(T(bas, p), s, jitter(cc, rng, 0.1));
  }
  for (let i = 0; i < Math.floor(radius * 2); i++) {
    const a = rng.f() * TAU, p = center.add(v(Math.cos(a), 0, Math.sin(a)).mul(rng.f() * radius * 0.7));
    mb.beam(p.add(v(0, 0.1, 0)), p.add(v(rng.range(-0.8, 0.8), rng.range(0.5, 1.3) * height, rng.range(-0.8, 0.8))), 0.03, 0.03, C.REBAR);
  }
  if (withCol) addCol(col, T(I(), center.add(v(0, height * 0.4, 0))), v(radius * 1.5, height * 0.8, radius * 1.5));
}
export function debrisSmall(mb, center, radius, n, rng) {
  for (let i = 0; i < n; i++) {
    const a = rng.f() * TAU, p = center.add(v(Math.cos(a), 0, Math.sin(a)).mul(Math.sqrt(rng.f()) * radius));
    const s = v(rng.range(0.08, 0.35), rng.range(0.04, 0.15), rng.range(0.08, 0.35));
    const roll = rng.f(); const c = roll < 0.5 ? C.CONCRETE : roll < 0.75 ? C.BRICK : roll < 0.9 ? C.RUST : C.WOOD_OLD;
    mb.addBox(T(M3.ry(rng.f() * TAU), p.add(v(0, s.y * 0.4, 0))), s, jitter(c, rng, 0.12), true);
  }
}
export function scrapHeap(mb, col, center, rng) {
  for (let i = 0; i < 9; i++) {
    const p = center.add(v(rng.range(-0.7, 0.7), 0, rng.range(-0.7, 0.7)));
    const s = v(rng.range(0.4, 1.1), rng.range(0.03, 0.3), rng.range(0.3, 0.8)); p.y = s.y * 0.5 + rng.f() * 0.25;
    mb.addBox(T(M3.ry(rng.f() * TAU).mul(M3.rx(rng.range(-0.6, 0.6))), p), s, jitter(i % 3 ? C.RUST : C.METAL_GRAY, rng, 0.15));
  }
  for (let i = 0; i < 3; i++) { const p = center.add(v(rng.range(-0.6, 0.6), 0.1, rng.range(-0.6, 0.6))); mb.cylBetween(p, p.add(v(rng.range(-1, 1), rng.range(0.1, 0.5), rng.range(-1, 1))), 0.05, 0.05, 6, C.RUST); }
  addCol(col, T(I(), center.add(v(0, 0.3, 0))), v(1.4, 0.6, 1.4));
}
export function plankStack(mb, col, center, yaw, rng) {
  for (let i = 0; i < 6; i++) mb.addBox(T(M3.ry(yaw + rng.range(-0.05, 0.05)), center.add(v(0, 0.06 + Math.floor(i / 3) * 0.11, -0.3 + (i % 3) * 0.3))), v(2.4, 0.1, 0.25), jitter(C.WOOD, rng, 0.1), true);
  addCol(col, T(M3.ry(yaw), center.add(v(0, 0.15, 0))), v(2.4, 0.3, 0.9));
}
export function crater(mb, center, radius, rng) {
  for (let i = 0; i < 10; i++) { const a = TAU * i / 10; mb.addBox(T(M3.ry(a), center.add(v(Math.cos(a), 0, Math.sin(a)).mul(radius)).add(v(0, 0.06, 0))), v(0.6, 0.18, radius * 0.7), jitter([0.3, 0.26, 0.2, 0], rng, 0.1), true); }
}

// ---------------------------------------------------------------- интерьер
export function bunkBed(mb, col, xf) {
  const m = C.METAL_BLUE;
  for (const sx of [-0.42, 0.42]) for (const sz of [-0.95, 0.95]) mb.addBox(xf.mul(at(sx, 0.85, sz)), v(0.05, 1.7, 0.05), m, true);
  for (const y of [0.4, 1.3]) {
    mb.addBox(xf.mul(at(0, y, 0)), v(0.88, 0.06, 1.95), m, true);
    mb.addBox(xf.mul(at(0, y + 0.08, 0)), v(0.8, 0.1, 1.85), [0.35, 0.37, 0.3, 0.5], true);
    mb.addBox(xf.mul(at(0, y + 0.17, -0.75)), v(0.5, 0.08, 0.3), [0.8, 0.8, 0.75, 0.5], true);
  }
  addCol(col, xf.mul(at(0, 0.85, 0)), v(0.9, 1.7, 2.0));
}
export function locker(mb, col, xf, c = [0.3, 0.36, 0.3, 0.2]) {
  mb.addBox(xf.mul(at(0, 0.95, 0)), v(0.6, 1.9, 0.5), c, true);
  mb.addBox(xf.mul(at(0, 0.95, -0.26)), v(0.02, 1.8, 0.02), darken(c, 0.3), true);
  addCol(col, xf.mul(at(0, 0.95, 0)), v(0.6, 1.9, 0.5));
}
export function table(mb, col, xf, size = [1.4, 0.8], c = C.WOOD) {
  mb.addBox(xf.mul(at(0, 0.76, 0)), v(size[0], 0.05, size[1]), c, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.addBox(xf.mul(at(sx * (size[0] / 2 - 0.05), 0.37, sz * (size[1] / 2 - 0.05))), v(0.05, 0.74, 0.05), darken(c, 0.2), true);
  addCol(col, xf.mul(at(0, 0.4, 0)), v(size[0], 0.8, size[1]));
}
export function chair(mb, xf, c = C.WOOD) {
  mb.addBox(xf.mul(at(0, 0.45, 0)), v(0.42, 0.04, 0.42), c, true);
  mb.addBox(xf.mul(at(0, 0.7, 0.2)), v(0.42, 0.5, 0.04), c, true);
  for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) mb.addBox(xf.mul(at(sx, 0.22, sz)), v(0.04, 0.45, 0.04), darken(c, 0.2), true);
}
export function shelfRack(mb, col, xf, length, rng, fill = 0.6) {
  const m = [0.3, 0.32, 0.36, 0.2], n = Math.floor(length / 1.2) + 1;
  for (let i = 0; i < n; i++) { const x = -length / 2 + length * i / (n - 1); for (const sz of [-0.35, 0.35]) mb.addBox(xf.mul(at(x, 1.2, sz)), v(0.06, 2.4, 0.06), m, true); }
  for (const y of [0.15, 0.9, 1.65, 2.35]) {
    mb.addBox(xf.mul(at(0, y, 0)), v(length, 0.04, 0.75), lighten(m, 0.05), true);
    let x = -length / 2 + 0.3;
    while (x < length / 2 - 0.3) {
      if (rng.f() < fill) {
        const s = v(rng.range(0.35, 0.7), rng.range(0.25, 0.55), rng.range(0.4, 0.6));
        const cc = [C.WOOD, [0.55, 0.47, 0.32, 0.5], [0.27, 0.33, 0.2, 0.4], C.METAL_GRAY][rng.int(0, 3)];
        mb.addBox(xf.mul(at(x, y + 0.02 + s.y / 2, 0)), s, jitter(cc, rng, 0.1), true); x += s.x + 0.08;
      } else x += 0.5;
    }
  }
  addCol(col, xf.mul(at(0, 1.2, 0)), v(length, 2.4, 0.8));
}
export function weaponRack(mb, col, xf, length, guns) {
  mb.addBox(xf.mul(at(0, 0.2, 0)), v(length, 0.4, 0.5), darken(C.WOOD, 0.2), true);
  mb.addBox(xf.mul(at(0, 1.3, 0.2)), v(length, 0.1, 0.12), darken(C.WOOD, 0.2), true);
  for (let i = 0; i < guns; i++) {
    const x = -length / 2 + 0.25 + i * (length - 0.5) / Math.max(1, guns - 1);
    mb.addBox(xf.mul(T(M3.rx(0.12), v(x, 0.85, 0.12))), v(0.05, 0.95, 0.07), [0.15, 0.15, 0.16, 0.2], true);
    mb.addBox(xf.mul(T(M3.rx(0.12), v(x, 0.6, 0.05))), v(0.05, 0.25, 0.1), [0.36, 0.17, 0.12, 0.4], true);
  }
  addCol(col, xf.mul(at(0, 0.7, 0)), v(length, 1.4, 0.5));
}
export function workbench(mb, col, xf, rng) {
  table(mb, col, xf, [2.2, 0.9], [0.35, 0.3, 0.25, 0.4]);
  mb.addBox(xf.mul(at(-0.7, 0.88, 0)), v(0.3, 0.2, 0.2), C.METAL_BLUE, true);
  mb.addBox(xf.mul(at(0, 1.4, 0.43)), v(2.2, 1.2, 0.04), [0.3, 0.3, 0.28, 0.2], true);
  for (let i = 0; i < 6; i++) mb.addBox(xf.mul(at(-0.9 + i * 0.35, 1.5 + rng.range(-0.2, 0.2), 0.4)), v(0.04, 0.3, 0.03), C.RUST, true);
}
export function generatorUnit(mb, col, xf, ruined) {
  const c = ruined ? [0.25, 0.24, 0.2, 0.3] : [0.3, 0.4, 0.3, 0.2];
  mb.addBox(xf.mul(at(0, 0.15, 0)), v(3.6, 0.3, 1.5), C.CONCRETE_D, true);
  mb.addBox(xf.mul(at(-0.5, 0.95, 0)), v(2.0, 1.3, 1.2), c, true);
  mb.addBox(xf.mul(at(1.05, 0.9, 0)), v(1.0, 1.2, 1.1), darken(c, 0.15), true);
  mb.addCyl(xf.mul(at(-1.1, 1.6, 0.3)), 0.12, 0.12, 1.6, 8, C.RUST);
  mb.addBox(xf.mul(at(1.05, 1.0, -0.56)), v(0.5, 0.4, 0.02), [0.9, 0.85, 0.5, 0.8], true);
  for (let i = 0; i < 4; i++) mb.addBox(xf.mul(at(-1.3 + i * 0.4, 1.62, 0)), v(0.08, 0.06, 1.0), darken(c, 0.25), true);
  addCol(col, xf.mul(at(0, 0.8, 0)), v(3.6, 1.6, 1.5));
}
export function radioConsole(mb, col, xf) {
  table(mb, col, xf, [2.4, 0.8], C.METAL_GRAY);
  const c = [0.32, 0.36, 0.3, 0.2];
  mb.addBox(xf.mul(at(-0.6, 1.05, 0.1)), v(0.9, 0.55, 0.5), c, true);
  mb.addBox(xf.mul(at(0.55, 1.0, 0.1)), v(0.8, 0.45, 0.5), darken(c, 0.1), true);
  mb.addBox(xf.mul(at(-0.6, 1.1, -0.16)), v(0.5, 0.2, 0.02), [0.3, 0.9, 0.5, 0.8], true);
  mb.addBox(xf.mul(at(0.55, 1.05, -0.16)), v(0.3, 0.12, 0.02), [1.0, 0.7, 0.2, 0.8], true);
  mb.addBox(xf.mul(at(0, 1.55, 0.3)), v(2.2, 0.5, 0.25), darken(c, 0.2), true);
}
export function medBed(mb, col, xf) {
  const m = [0.75, 0.76, 0.74, 0.2];
  mb.addBox(xf.mul(at(0, 0.55, 0)), v(0.9, 0.12, 2.0), m, true);
  mb.addBox(xf.mul(at(0, 0.66, 0)), v(0.82, 0.1, 1.9), [0.85, 0.87, 0.85, 0.5], true);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.9, 0.9]) mb.addBox(xf.mul(at(sx, 0.27, sz)), v(0.04, 0.55, 0.04), darken(m, 0.3), true);
  mb.addBox(xf.mul(at(0, 0.9, -0.98)), v(0.9, 0.6, 0.04), m, true);
  addCol(col, xf.mul(at(0, 0.45, 0)), v(0.9, 0.9, 2.0));
}
export function cabinet(mb, col, xf, c = [0.7, 0.7, 0.68, 0.2]) {
  mb.addBox(xf.mul(at(0, 0.9, 0)), v(1.0, 1.8, 0.45), c, true);
  mb.addBox(xf.mul(at(0, 1.35, -0.23)), v(0.9, 0.75, 0.02), [0.4, 0.5, 0.55, 0.7], true);
  addCol(col, xf.mul(at(0, 0.9, 0)), v(1.0, 1.8, 0.45));
}
export function mapTable(mb, col, xf) {
  table(mb, col, xf, [2.4, 1.4], darken(C.WOOD, 0.1));
  mb.addBox(xf.mul(at(0, 0.79, 0)), v(2.0, 0.01, 1.1), [0.75, 0.72, 0.55, 0.5], true);
  mb.addBox(xf.mul(at(0.3, 0.8, 0.1)), v(0.5, 0.01, 0.02), [0.7, 0.1, 0.1, 0.5], true);
  mb.addBox(xf.mul(at(-0.4, 0.8, -0.2)), v(0.02, 0.01, 0.6), [0.1, 0.1, 0.5, 0.5], true);
}
export function safeBox(mb, col, xf) {
  mb.addBox(xf.mul(at(0, 0.5, 0)), v(0.7, 1.0, 0.6), [0.22, 0.25, 0.22, 0.2], true);
  mb.addCyl(xf.mul(T(M3.rx(-Math.PI / 2), v(0.1, 0.6, -0.3))), 0.08, 0.08, 0.04, 8, C.METAL_GRAY);
  addCol(col, xf.mul(at(0, 0.5, 0)), v(0.7, 1.0, 0.6));
}
export function toolbox(mb, xf) {
  mb.addBox(xf.mul(at(0, 0.15, 0)), v(0.6, 0.3, 0.3), [0.75, 0.3, 0.1, 0.2], true);
  mb.addBox(xf.mul(at(0, 0.35, 0)), v(0.3, 0.05, 0.05), C.RUBBER, true);
}
export function stove(mb, col, xf) {
  mb.addCyl(xf, 0.35, 0.35, 0.8, 10, [0.15, 0.14, 0.13, 0.3]);
  mb.addCyl(xf.mul(at(0, 0.8, 0)), 0.08, 0.08, 2.2, 6, [0.2, 0.18, 0.16, 0.3]);
  addCol(col, xf.mul(at(0, 0.4, 0)), v(0.7, 0.8, 0.7));
}
export function flag(mb, col, pos, h = 9) {
  mb.addCyl(T(I(), pos), 0.08, 0.05, h, 8, C.METAL_GRAY);
  mb.addCyl(T(I(), pos), 0.4, 0.4, 0.3, 8, C.CONCRETE_D);
  const top = pos.add(v(0, h - 0.1, 0));
  for (let i = 0; i < 6; i++) {
    const x0 = 0.08 + i * 0.3, w0 = Math.sin(i * 0.9) * 0.1, w1 = Math.sin((i + 1) * 0.9) * 0.1;
    for (const [y0, y1, cc] of [[0, -0.6, [0.08, 0.08, 0.08, 0.5]], [-0.6, -1.2, [0.6, 0.06, 0.05, 0.5]]]) {
      mb.quad(top.add(v(x0, y0, w0)), top.add(v(x0 + 0.3, y0, w1)), top.add(v(x0 + 0.3, y1, w1)), top.add(v(x0, y1, w0)), cc);
      mb.quad(top.add(v(x0, y0, w0)), top.add(v(x0, y1, w0)), top.add(v(x0 + 0.3, y1, w1)), top.add(v(x0 + 0.3, y0, w1)), cc);
    }
  }
  addCol(col, T(I(), pos.add(v(0, h / 2, 0))), v(0.3, h, 0.3));
}
export function targetStand(mb, col, xf) {
  mb.addBox(xf.mul(at(0, 0.6, 0)), v(0.08, 1.2, 0.08), C.WOOD, true);
  mb.addBox(xf.mul(at(0, 1.35, 0)), v(0.6, 0.9, 0.03), [0.7, 0.65, 0.5, 0.5], true);
  mb.addBox(xf.mul(at(0, 1.45, -0.02)), v(0.25, 0.35, 0.01), [0.2, 0.2, 0.18, 0.5], true);
  addCol(col, xf.mul(at(0, 0.9, 0)), v(0.6, 1.8, 0.1));
}

// ---------------------------------------------------------------- растительность
export function treePine(mb, pos, h, rng) {
  mb.addCyl(T(M3.ry(rng.f() * TAU), pos), 0.18 * h / 10 + 0.05, 0.05, h, 6, [0.33, 0.24, 0.17, 0.6], false);
  const g = jitter([0.21, 0.31, 0.16, 0.6], rng, 0.12);
  for (let i = 0; i < 4; i++) {
    const y = h * (0.35 + 0.17 * i), r = (1 - i / 4) * h * 0.22 + 0.4;
    mb.addCyl(T(M3.ry(rng.f() * TAU), pos.add(v(0, y, 0))), r, 0.05, h * 0.3, 7, darken(g, 0.06 * i), true, false);
  }
}
export function treeBirch(mb, pos, h, rng) {
  const top = pos.add(v(rng.range(-0.3, 0.3), h, rng.range(-0.3, 0.3)));
  mb.cylBetween(pos, top, 0.13 * h / 9 + 0.04, 0.04, 6, [0.82, 0.8, 0.74, 0.6], false);
  mb.cylBetween(pos.add(v(0, h * 0.3, 0)), pos.add(v(0, h * 0.3 + 0.12, 0)), 0.15 * h / 9 + 0.045, 0.14 * h / 9 + 0.04, 6, [0.1, 0.1, 0.1, 0.6], false);
  const g = jitter([0.32, 0.4, 0.16, 0.6], rng, 0.15);
  for (let i = 0; i < 4; i++) mb.addBlob(pos.add(v(rng.range(-1.2, 1.2), h * rng.range(0.55, 0.95), rng.range(-1.2, 1.2))), v(1.4, 1.1, 1.4).mul(rng.range(0.7, 1.1) * h / 9), g, rng, 0.3);
}
export function treeDead(mb, pos, h, rng) {
  const c = [0.28, 0.23, 0.19, 0.6], top = pos.add(v(rng.range(-0.4, 0.4), h, rng.range(-0.4, 0.4)));
  mb.cylBetween(pos, top, 0.2, 0.04, 6, c, false);
  for (let i = 0; i < 4; i++) { const a = pos.lerp(top, rng.range(0.4, 0.85)); mb.cylBetween(a, a.add(v(rng.range(-1.8, 1.8), rng.range(0.5, 1.5), rng.range(-1.8, 1.8))), 0.06, 0.02, 4, c, false); }
}
export function bush(mb, pos, s, rng) {
  const g = jitter([0.27, 0.32, 0.14, 0.6], rng, 0.15);
  for (let i = 0; i < 3; i++) mb.addBlob(pos.add(v(rng.range(-0.5, 0.5) * s, 0.4 * s, rng.range(-0.5, 0.5) * s)), v(0.8, 0.6, 0.8).mul(s * rng.range(0.7, 1.1)), g, rng, 0.3, true);
}
export function grassTuft() {
  const mb = new MeshBuilder(); const rng = { f: Math.random };
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU, rr = r() * 0.18, base = v(Math.cos(a) * rr, 0, Math.sin(a) * rr), h = 0.3 + r() * 0.3;
    const lean = v(Math.cos(a), 0, Math.sin(a)).mul(0.05 + r() * 0.15), w = v(-Math.sin(a), 0, Math.cos(a)).mul(0.045);
    mb.tri(base.sub(w), base.add(w), base.add(lean).add(v(0, h, 0)), [0.25, 0.3, 0.12, 0.6]);
    const k = mb.c.length - 4; mb.c[k] = 0.5; mb.c[k + 1] = 0.5; mb.c[k + 2] = 0.24;
  }
  void rng;
  return mb;
}
