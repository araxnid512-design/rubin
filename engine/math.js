// Движок «Долг»: математика (векторы, базисы, кватернионы, матрицы 4×4).
// Соглашения: правая система координат, Y вверх, «вперёд» = −Z. Базис хранит оси-столбцы x, y, z.

export class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  clone() { return new V3(this.x, this.y, this.z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  add(b) { return new V3(this.x + b.x, this.y + b.y, this.z + b.z); }
  sub(b) { return new V3(this.x - b.x, this.y - b.y, this.z - b.z); }
  mul(s) { return new V3(this.x * s, this.y * s, this.z * s); }
  mulV(b) { return new V3(this.x * b.x, this.y * b.y, this.z * b.z); }
  neg() { return new V3(-this.x, -this.y, -this.z); }
  dot(b) { return this.x * b.x + this.y * b.y + this.z * b.z; }
  cross(b) { return new V3(this.y * b.z - this.z * b.y, this.z * b.x - this.x * b.z, this.x * b.y - this.y * b.x); }
  lenSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  len() { return Math.sqrt(this.lenSq()); }
  norm() { const l = this.len(); return l > 1e-9 ? new V3(this.x / l, this.y / l, this.z / l) : new V3(0, 0, 0); }
  lerp(b, t) { return new V3(this.x + (b.x - this.x) * t, this.y + (b.y - this.y) * t, this.z + (b.z - this.z) * t); }
  dist(b) { return Math.hypot(this.x - b.x, this.y - b.y, this.z - b.z); }
  distSq(b) { const dx = this.x - b.x, dy = this.y - b.y, dz = this.z - b.z; return dx * dx + dy * dy + dz * dz; }
  dist2(b) { return Math.hypot(this.x - b.x, this.z - b.z); }
  flat() { return new V3(this.x, 0, this.z); }
  addSelf(b) { this.x += b.x; this.y += b.y; this.z += b.z; return this; }
  scaleSelf(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  limit(l) { const n = this.len(); return n > l ? this.mul(l / n) : this.clone(); }
  toArray() { return [+this.x.toFixed(3), +this.y.toFixed(3), +this.z.toFixed(3)]; }
  static from(a) { return a instanceof V3 ? a.clone() : new V3(a[0], a[1], a[2]); }
}
export const v3 = (x = 0, y = 0, z = 0) => new V3(x, y, z);
export const UP = Object.freeze(new V3(0, 1, 0));
export const RIGHT = Object.freeze(new V3(1, 0, 0));
export const FORWARD = Object.freeze(new V3(0, 0, -1));

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const moveToward = (a, b, d) => (Math.abs(b - a) <= d ? b : a + Math.sign(b - a) * d);
export const angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;
export const fmod = (a, b) => ((a % b) + b) % b;
export const TAU = Math.PI * 2;
export const randRange = (a, b) => a + Math.random() * (b - a);

// Детерминированный генератор случайных чисел (mulberry32)
export class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  f() { return this.next(); }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
}
export const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ------------------------------------------------------------------ базис 3×3
export class M3 {
  constructor(x = new V3(1, 0, 0), y = new V3(0, 1, 0), z = new V3(0, 0, 1)) { this.x = x; this.y = y; this.z = z; }
  static ident() { return new M3(); }
  static axis(a, ang) {
    const n = a.norm(), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    const { x, y, z } = n;
    return new M3(
      new V3(t * x * x + c, t * x * y + s * z, t * x * z - s * y),
      new V3(t * x * y - s * z, t * y * y + c, t * y * z + s * x),
      new V3(t * x * z + s * y, t * y * z - s * x, t * z * z + c));
  }
  static rx(a) { return M3.axis(RIGHT, a); }
  static ry(a) { return M3.axis(UP, a); }
  static rz(a) { return M3.axis(FORWARD, a); } // поворот вокруг −Z (как Basis(Vector3.FORWARD, a))
  clone() { return new M3(this.x.clone(), this.y.clone(), this.z.clone()); }
  mulV(v) { return new V3(this.x.x * v.x + this.y.x * v.y + this.z.x * v.z, this.x.y * v.x + this.y.y * v.y + this.z.y * v.z, this.x.z * v.x + this.y.z * v.y + this.z.z * v.z); }
  mul(b) { return new M3(this.mulV(b.x), this.mulV(b.y), this.mulV(b.z)); }
  T() { return new M3(new V3(this.x.x, this.y.x, this.z.x), new V3(this.x.y, this.y.y, this.z.y), new V3(this.x.z, this.y.z, this.z.z)); }
  scaled(s) { return new M3(this.x.mul(s.x), this.y.mul(s.y), this.z.mul(s.z)); }
  ortho() { const x = this.x.norm(); const z = x.cross(this.y).norm(); const y = z.cross(x).norm(); return new M3(x, y, z); }
  // Базис кости: +Y = y, −Z ≈ fwd
  static yFwd(y, fwd) {
    let f = fwd.sub(y.mul(fwd.dot(y)));
    if (f.lenSq() < 1e-6) { f = FORWARD.sub(y.mul(FORWARD.dot(y))); if (f.lenSq() < 1e-6) f = UP.sub(y.mul(UP.dot(y))); }
    const z = f.norm().neg(); const x = y.cross(z).norm();
    return new M3(x, y, z.norm());
  }
  // Базис «смотреть вдоль fwd» (−Z = fwd), +Y ≈ up, затем крен
  static look(fwd, up = UP, roll = 0) {
    const z = fwd.norm().neg(); let x = up.cross(z);
    if (x.lenSq() < 1e-6) x = new V3(1, 0, 0);
    x = x.norm(); const y = z.cross(x).norm();
    let b = new M3(x, y, z);
    if (roll) b = b.mul(M3.rz(roll));
    return b;
  }
  toQuat() {
    const m00 = this.x.x, m11 = this.y.y, m22 = this.z.z;
    const tr = m00 + m11 + m22; let w, x, y, z;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (this.y.z - this.z.y) / s; y = (this.z.x - this.x.z) / s; z = (this.x.y - this.y.x) / s; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (this.y.z - this.z.y) / s; x = 0.25 * s; y = (this.y.x + this.x.y) / s; z = (this.z.x + this.x.z) / s; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (this.z.x - this.x.z) / s; x = (this.y.x + this.x.y) / s; y = 0.25 * s; z = (this.z.y + this.y.z) / s; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (this.x.y - this.y.x) / s; x = (this.z.x + this.x.z) / s; y = (this.z.y + this.y.z) / s; z = 0.25 * s; }
    return [x, y, z, w];
  }
  static fromQuat(q) {
    const [x, y, z, w] = q;
    return new M3(
      new V3(1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)),
      new V3(2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)),
      new V3(2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)));
  }
  slerp(b, t) { return M3.fromQuat(qslerp(this.toQuat(), b.toQuat(), t)); }
}

export function qslerp(a, b, t) {
  let [ax, ay, az, aw] = a; let [bx, by, bz, bw] = b;
  let d = ax * bx + ay * by + az * bz + aw * bw;
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0, k1;
  if (d > 0.9995) { k0 = 1 - t; k1 = t; }
  else { const th = Math.acos(d), s = Math.sin(th); k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s; }
  const r = [ax * k0 + bx * k1, ay * k0 + by * k1, az * k0 + bz * k1, aw * k0 + bw * k1];
  const l = Math.hypot(...r); return r.map((v) => v / l);
}

// ------------------------------------------------------------------ трансформация (базис + смещение)
export class Xf {
  constructor(basis = new M3(), origin = new V3()) { this.basis = basis; this.origin = origin; }
  static at(p, yaw = 0) { return new Xf(yaw ? M3.ry(yaw) : new M3(), p.clone ? p.clone() : V3.from(p)); }
  clone() { return new Xf(this.basis.clone(), this.origin.clone()); }
  mulV(v) { return this.basis.mulV(v).add(this.origin); }
  mul(b) { return new Xf(this.basis.mul(b.basis), this.mulV(b.origin)); }
  inv() { const bt = this.basis.T(); return new Xf(bt, bt.mulV(this.origin).neg()); }
  // для ортонормированных базисов
  toMat4(out = new Float32Array(16)) {
    const b = this.basis, o = this.origin;
    out[0] = b.x.x; out[1] = b.x.y; out[2] = b.x.z; out[3] = 0;
    out[4] = b.y.x; out[5] = b.y.y; out[6] = b.y.z; out[7] = 0;
    out[8] = b.z.x; out[9] = b.z.y; out[10] = b.z.z; out[11] = 0;
    out[12] = o.x; out[13] = o.y; out[14] = o.z; out[15] = 1;
    return out;
  }
}

// ------------------------------------------------------------------ матрицы 4×4 (столбцами, как в GL)
export const mat4 = {
  ident(o = new Float32Array(16)) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  mul(a, b, o = new Float32Array(16)) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fovY, aspect, near, far, o = new Float32Array(16)) {
    const f = 1 / Math.tan(fovY / 2); o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = (2 * far * near) / (near - far); return o;
  },
  ortho(l, r, b, t, n, f, o = new Float32Array(16)) {
    o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  },
  lookAt(eye, target, up = UP, o = new Float32Array(16)) {
    const z = eye.sub(target).norm(); let x = up.cross(z); if (x.lenSq() < 1e-8) x = new V3(1, 0, 0); x = x.norm(); const y = z.cross(x);
    o[0] = x.x; o[1] = y.x; o[2] = z.x; o[3] = 0;
    o[4] = x.y; o[5] = y.y; o[6] = z.y; o[7] = 0;
    o[8] = x.z; o[9] = y.z; o[10] = z.z; o[11] = 0;
    o[12] = -x.dot(eye); o[13] = -y.dot(eye); o[14] = -z.dot(eye); o[15] = 1; return o;
  },
  invert(m, o = new Float32Array(16)) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det) return mat4.ident(o); det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  xformPoint(m, p) {
    const x = p.x, y = p.y, z = p.z; const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return new V3((m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w);
  },
};

// Плоскости фрустума из матрицы вида-проекции (для отсечения сфер)
export function frustumPlanes(m) {
  const p = [];
  const add = (a, b, c, d) => { const l = Math.hypot(a, b, c); p.push([a / l, b / l, c / l, d / l]); };
  add(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
  add(m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
  add(m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
  add(m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
  add(m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
  add(m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
  return p;
}
export function sphereInFrustum(planes, x, y, z, r) {
  for (const p of planes) if (p[0] * x + p[1] * y + p[2] * z + p[3] < -r) return false;
  return true;
}
