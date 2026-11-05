// Движок: загрузка моделей glTF 2.0 / GLB (например, из Tripo AI) без сторонних библиотек.
// Меши (позиции, нормали, UV, цвет материала), текстуры baseColor, скелет (JOINTS_0/WEIGHTS_0, inverseBindMatrices),
// анимации (перенос/поворот/масштаб, LINEAR/STEP/CUBICSPLINE) с плавным переходом между клипами.
import { RenderObject } from './renderer.js';
import { V3 } from './math.js';

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

// ------------------------------------------------------------------ матрицы 4×4 (столбцы, как в glTF)
export const M4 = {
  ident: () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b, out = new Float32Array(16)) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return out;
  },
  trs(t, q, s, out = new Float32Array(16)) {
    const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    out[0] = (1 - (yy + zz)) * s[0]; out[1] = (xy + wz) * s[0]; out[2] = (xz - wy) * s[0]; out[3] = 0;
    out[4] = (xy - wz) * s[1]; out[5] = (1 - (xx + zz)) * s[1]; out[6] = (yz + wx) * s[1]; out[7] = 0;
    out[8] = (xz + wy) * s[2]; out[9] = (yz - wx) * s[2]; out[10] = (1 - (xx + yy)) * s[2]; out[11] = 0;
    out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
    return out;
  },
  point(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
};
// разложение матрицы узла на TRS (для узлов, заданных matrix)
function decompose(m) {
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const r = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz];
  const tr = r[0] + r[4] + r[8]; let q;
  if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; q = [(r[5] - r[7]) / S, (r[6] - r[2]) / S, (r[1] - r[3]) / S, 0.25 * S]; }
  else if (r[0] > r[4] && r[0] > r[8]) { const S = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2; q = [0.25 * S, (r[3] + r[1]) / S, (r[6] + r[2]) / S, (r[5] - r[7]) / S]; }
  else if (r[4] > r[8]) { const S = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2; q = [(r[3] + r[1]) / S, 0.25 * S, (r[7] + r[5]) / S, (r[6] - r[2]) / S]; }
  else { const S = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2; q = [(r[6] + r[2]) / S, (r[7] + r[5]) / S, 0.25 * S, (r[1] - r[3]) / S]; }
  return { t: [m[12], m[13], m[14]], r: q, s: [sx, sy, sz] };
}
function nlerpQ(a, b, t, out) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = d < 0 ? -1 : 1;
  for (let i = 0; i < 4; i++) out[i] = a[i] + (b[i] * s - a[i]) * t;
  const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1; for (let i = 0; i < 4; i++) out[i] /= l;
  return out;
}

// ------------------------------------------------------------------ разбор контейнера
export function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Не GLB-файл');
  let off = 12, json = null, bin = null;
  while (off + 8 <= dv.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (type === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  if (!json) throw new Error('В GLB нет JSON');
  return { json, bin };
}
function readAccessor(g, i) {
  const a = g.json.accessors[i]; if (a.bufferView == null) return new (CT[a.componentType])(a.count * NC[a.type]);
  const bv = g.json.bufferViews[a.bufferView], T = CT[a.componentType], n = NC[a.type], sz = T.BYTES_PER_ELEMENT;
  const stride = bv.byteStride || n * sz, base = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new T(a.count * n);
  if (stride === n * sz && base % sz === 0) out.set(new T(g.bin, base, a.count * n));
  else { const src = new DataView(g.bin), get = { 1: 'getInt8', 2: 'getInt16', 4: 'getFloat32' }; const fn = T === Float32Array ? 'getFloat32' : T === Uint32Array ? 'getUint32' : T === Uint16Array ? 'getUint16' : T === Uint8Array ? 'getUint8' : get[sz]; for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = src[fn](base + k * stride + c * sz, true); }
  if (a.normalized && NORM[a.componentType]) { const f = new Float32Array(out.length); for (let k = 0; k < out.length; k++) f[k] = Math.max(-1, out[k] / NORM[a.componentType]); return f; }
  return out;
}

// ------------------------------------------------------------------ ресурс: геометрия, текстуры, скелеты, клипы
export class GltfAsset {
  static async load(r, url) {
    const res = await fetch(url); if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const a = new GltfAsset(r, parseGLB(await res.arrayBuffer()), url); await a.ready; return a;
  }
  constructor(r, g, name = '') {
    this.r = r; this.g = g; this.name = name; const J = g.json;
    this.nodes = (J.nodes || []).map((n, i) => {
      const d = n.matrix ? decompose(n.matrix) : { t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1] };
      return { i, name: n.name || '', children: n.children || [], mesh: n.mesh, skin: n.skin, rest: d, parent: -1 };
    });
    for (const n of this.nodes) for (const c of n.children) this.nodes[c].parent = n.i;
    const scene = J.scenes ? J.scenes[J.scene || 0] : { nodes: this.nodes.filter((n) => n.parent < 0).map((n) => n.i) };
    this.roots = scene.nodes; this.order = []; const walk = (i) => { this.order.push(i); for (const c of this.nodes[i].children) walk(c); }; for (const r0 of this.roots) walk(r0);
    // текстуры
    this.textures = []; const imgs = J.images || [];
    this.ready = Promise.all(imgs.map(async (im, k) => {
      try {
        let blob;
        if (im.bufferView != null) { const bv = J.bufferViews[im.bufferView]; blob = new Blob([new Uint8Array(g.bin, bv.byteOffset || 0, bv.byteLength)], { type: im.mimeType || 'image/png' }); }
        else if (im.uri) blob = await (await fetch(new URL(im.uri, new URL(name, location.href)))).blob();
        const bmp = await createImageBitmap(blob); this.textures[k] = r.textureImage(bmp);
      } catch (e) { this.textures[k] = null; }
    })).then(() => this._build());
  }
  _build() {
    const J = this.g.json, g = this.g;
    this.skins = (J.skins || []).map((s) => ({ joints: s.joints, ibm: s.inverseBindMatrices != null ? readAccessor(g, s.inverseBindMatrices) : null }));
    this.prims = [];
    const mats = J.materials || [];
    for (const n of this.nodes) {
      if (n.mesh == null) continue;
      for (const pr of J.meshes[n.mesh].primitives) {
        if (pr.mode != null && pr.mode !== 4) continue;
        const A = pr.attributes, pos = readAccessor(g, A.POSITION), nv = pos.length / 3;
        const idx = pr.indices != null ? Uint32Array.from(readAccessor(g, pr.indices)) : Uint32Array.from({ length: nv }, (_, k) => k);
        let nrm = A.NORMAL != null ? readAccessor(g, A.NORMAL) : null;
        if (!nrm) { nrm = new Float32Array(pos.length); for (let k = 0; k < idx.length; k += 3) { const [a, b, c] = [idx[k] * 3, idx[k + 1] * 3, idx[k + 2] * 3]; const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx; for (const q of [a, b, c]) { nrm[q] += fx; nrm[q + 1] += fy; nrm[q + 2] += fz; } } for (let k = 0; k < nrm.length; k += 3) { const l = Math.hypot(nrm[k], nrm[k + 1], nrm[k + 2]) || 1; nrm[k] /= l; nrm[k + 1] /= l; nrm[k + 2] /= l; } }
        const m = mats[pr.material] || {}, pbr = m.pbrMetallicRoughness || {}, f = pbr.baseColorFactor || [1, 1, 1, 1];
        const tex = pbr.baseColorTexture ? this.textures[(J.textures[pbr.baseColorTexture.index] || {}).source] || null : null;
        const vc = A.COLOR_0 != null ? readAccessor(g, A.COLOR_0) : null, vcn = vc ? vc.length / nv : 0;
        const col = new Uint8Array(nv * 4);
        for (let k = 0; k < nv; k++) { for (let c = 0; c < 3; c++) col[k * 4 + c] = Math.round(Math.min(1, f[c] * (vc ? vc[k * vcn + c] : 1)) * 255); col[k * 4 + 3] = 0; }
        const d = { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), col, idx, count: idx.length, uv: A.TEXCOORD_0 != null ? Float32Array.from(readAccessor(g, A.TEXCOORD_0)) : null };
        if (A.JOINTS_0 != null && n.skin != null) {
          const jn = readAccessor(g, A.JOINTS_0), wt = readAccessor(g, A.WEIGHTS_0), nj = this.skins[n.skin].joints.length;
          d.bones = nj < 256 ? Uint8Array.from(jn) : Uint16Array.from(jn);
          d.weights = new Uint8Array(nv * 4);
          for (let k = 0; k < nv; k++) { let s = 0; for (let c = 0; c < 4; c++) s += wt[k * 4 + c]; for (let c = 0; c < 4; c++) d.weights[k * 4 + c] = Math.round(wt[k * 4 + c] / (s || 1) * 255); }
        }
        // габариты в позе покоя (для подгонки под размеры игры)
        let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (let k = 0; k < pos.length; k += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pos[k + c]); mx[c] = Math.max(mx[c], pos[k + c]); }
        d.center = new V3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2); d.radius = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2;
        this.prims.push({ node: n.i, skin: d.bones ? n.skin : null, mesh: this.r.createMesh(d), tex, bmin: mn, bmax: mx });
      }
    }
    // клипы
    this.clips = (J.animations || []).map((an, k) => {
      let dur = 0;
      const ch = an.channels.map((c) => { const smp = an.samplers[c.sampler], times = readAccessor(g, smp.input), vals = readAccessor(g, smp.output); dur = Math.max(dur, times[times.length - 1] || 0); return { node: c.target.node, path: c.target.path, times, vals, interp: smp.interpolation || 'LINEAR' }; }).filter((c) => c.node != null && c.path !== 'weights');
      return { name: an.name || 'clip' + k, dur: dur || 1, ch };
    });
    // габариты всей модели в позе покоя
    const glob = this.pose(null, 0); const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const p of this.prims) for (const cx of [p.bmin[0], p.bmax[0]]) for (const cy of [p.bmin[1], p.bmax[1]]) for (const cz of [p.bmin[2], p.bmax[2]]) { const q = p.skin != null ? [cx, cy, cz] : M4.point(glob[p.node], cx, cy, cz); for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], q[c]); mx[c] = Math.max(mx[c], q[c]); } }
    this.bmin = mn; this.bmax = mx;
    return this;
  }
  clip(name) { return this.clips.find((c) => c.name === name) || null; }
  // глобальные матрицы узлов для клипа a (и b с весом w — переход)
  pose(a, ta, b = null, tb = 0, w = 0) {
    const N = this.nodes, T = N.map((n) => n.rest.t.slice()), R = N.map((n) => n.rest.r.slice()), S = N.map((n) => n.rest.s.slice());
    const apply = (clip, time, k) => {
      if (!clip) return;
      const t = clip.dur > 0 ? time % clip.dur : 0;
      for (const c of clip.ch) {
        const ts = c.times, n = c.path === 'rotation' ? 4 : 3, cub = c.interp === 'CUBICSPLINE' ? 3 : 1;
        let i = 0, hi = ts.length - 1; if (t >= ts[hi]) i = hi; else { while (i < hi && ts[i + 1] <= t) i++; }
        const j = Math.min(i + 1, hi), f = c.interp === 'STEP' || j === i ? 0 : (t - ts[i]) / Math.max(1e-6, ts[j] - ts[i]);
        const va = (ix) => (cub === 3 ? ix * 3 * n + n : ix * n);
        const tgt = c.path === 'translation' ? T[c.node] : c.path === 'rotation' ? R[c.node] : S[c.node], tmp = new Array(n);
        if (n === 4) nlerpQ([c.vals[va(i)], c.vals[va(i) + 1], c.vals[va(i) + 2], c.vals[va(i) + 3]], [c.vals[va(j)], c.vals[va(j) + 1], c.vals[va(j) + 2], c.vals[va(j) + 3]], f, tmp);
        else for (let q = 0; q < n; q++) tmp[q] = c.vals[va(i) + q] + (c.vals[va(j) + q] - c.vals[va(i) + q]) * f;
        if (k >= 1) { for (let q = 0; q < n; q++) tgt[q] = tmp[q]; } else if (n === 4) nlerpQ(tgt, tmp, k, tgt); else for (let q = 0; q < n; q++) tgt[q] += (tmp[q] - tgt[q]) * k;
      }
    };
    apply(a, ta, 1); if (b && w > 0) apply(b, tb, w);
    const G = new Array(N.length), L = new Float32Array(16);
    for (const i of this.order) { M4.trs(T[i], R[i], S[i], L); G[i] = N[i].parent >= 0 ? M4.mul(G[N[i].parent], L) : L.slice(); }
    for (let i = 0; i < N.length; i++) if (!G[i]) G[i] = M4.trs(T[i], R[i], S[i]);
    return G;
  }
  findNode(re) { const n = this.nodes.find((x) => re.test(x.name)); return n ? n.i : -1; }
}

// ------------------------------------------------------------------ экземпляр модели в сцене
export class GltfInstance {
  // fit: { size:[ширина, высота, глубина] | height } — подгонка под размеры игры; pivot — низ по центру; yaw — поправка поворота
  constructor(asset, kind = 'world', fit = {}) {
    this.a = asset; this.r = asset.r; this.objs = []; this.time = 0; this.clipA = null; this.clipB = null; this.tB = 0; this.fade = 0; this.fadeDur = 0.25; this.speed = 1;
    const mn = asset.bmin, mx = asset.bmax, sz = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    let s = 1;
    if (fit.height) s = fit.height / Math.max(1e-4, sz[1]);
    else if (fit.size) s = Math.min(fit.size[0] / Math.max(1e-4, sz[0]), fit.size[2] / Math.max(1e-4, sz[2]), fit.size[1] ? fit.size[1] / Math.max(1e-4, sz[1]) : Infinity);
    else if (fit.length) s = fit.length / Math.max(1e-4, Math.max(sz[0], sz[2]));
    const yaw = (fit.yaw || 0) + (fit.alignLong && sz[0] > sz[2] ? Math.PI / 2 : 0), c = Math.cos(yaw), sn = Math.sin(yaw);
    // нормализация: центр по X/Z, низ на y=0, масштаб, поворот вокруг Y
    const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
    this.norm = M4.mul(new Float32Array([c * s, 0, -sn * s, 0, 0, s, 0, 0, sn * s, 0, c * s, 0, 0, 0, 0, 1]), M4.trs([-cx, -mn[1], -cz], [0, 0, 0, 1], [1, 1, 1]));
    this.scale = s; this.height = sz[1] * s;
    for (const p of asset.prims) {
      const o = this.r.add(new RenderObject(p.mesh, kind)); o.tex = p.tex; o.cutout = false; o._prim = p;
      if (p.skin != null) o.boneTex = this.r.boneTexture(asset.skins[p.skin].joints.length);
      this.objs.push(o);
    }
    this.root = M4.ident(); this.update(0);
  }
  play(name, fade = 0.25, speed = 1) {
    const clip = typeof name === 'string' ? this.a.clip(name) : name; if (!clip || clip === this.clipA) { this.speed = speed; return; }
    this.clipB = this.clipA; this.tB = this.time; this.clipA = clip; this.time = 0; this.fade = this.clipB ? fade : 0; this.fadeDur = fade; this.speed = speed;
  }
  // xf — мировая трансформация (Xf движка) или матрица 4×4
  setXf(xf) {
    if (xf instanceof Float32Array) { this.root = xf; return; }
    const b = xf.basis, o = xf.origin;
    this.root = new Float32Array([b.x.x, b.x.y, b.x.z, 0, b.y.x, b.y.y, b.y.z, 0, b.z.x, b.z.y, b.z.z, 0, o.x, o.y, o.z, 1]);
  }
  update(dt) {
    this.time += dt * this.speed; if (this.fade > 0) { this.fade = Math.max(0, this.fade - dt); this.tB += dt * this.speed; }
    const w = this.fade > 0 && this.fadeDur > 0 ? this.fade / this.fadeDur : 0;
    const G = this.a.pose(this.clipA, this.time, this.clipB, this.tB, w);
    this.G = G;
    const M = M4.mul(this.root, this.norm);
    for (const o of this.objs) {
      const p = o._prim;
      if (p.skin != null) {
        const sk = this.a.skins[p.skin], bt = o.boneTex, tmp = new Float32Array(16);
        sk.joints.forEach((j, k) => { const ibm = sk.ibm ? sk.ibm.subarray(k * 16, k * 16 + 16) : M4.ident(); M4.mul(G[j], ibm, tmp); bt.data.set(tmp, k * 16); });
        bt.dirty = true; o.model = M; this._bounds(o, M);
      } else { const m = M4.mul(M, G[p.node]); o.model = m; this._bounds(o, m); }
    }
  }
  _bounds(o, m) { const c = o.mesh.center || new V3(), q = M4.point(m, c.x, c.y, c.z); if (o.wc) { o.wc.x = q[0]; o.wc.y = q[1]; o.wc.z = q[2]; } o.wr = (o.mesh.radius || 1) * this.scale * 1.6 + 0.5; }
  // мировая матрица узла (например, кисти — для оружия в руке)
  nodeMatrix(i) { return M4.mul(M4.mul(this.root, this.norm), this.G[i]); }
  setVisible(v) { for (const o of this.objs) o.visible = v; }
  set clipY(y) { for (const o of this.objs) o.clipY = y; }
  set shadow(v) { for (const o of this.objs) o.shadow = v; }
  set tint(t) { for (const o of this.objs) o.tint = t; }
  set hit(k) { for (const o of this.objs) o.hit = k; }
  destroy() { for (const o of this.objs) this.r.remove(o); this.objs = []; }
}
