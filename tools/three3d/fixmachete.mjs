// Тесак из Tripo лежит по диагонали — поворачиваем вдоль оси: остриё к −Z, рукоять к +Z, лезвие вниз (ширина по Y).
// node tools/three3d/fixmachete.mjs → art3d/src/h/w_machete_fix.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(ROOT, 'art3d/src/h/w_machete.glb'));
const prims = []; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) prims.push(p);
const all = []; const v = [0, 0, 0];
prims.forEach((p) => { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); all.push(v.slice()); } });
const c = [0, 0, 0]; all.forEach((q) => { for (let k = 0; k < 3; k++) c[k] += q[k] / all.length; });
// ковариация и главные оси (степенной метод)
const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
all.forEach((q) => { const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; });
const mul = (M, x) => [0, 1, 2].map((i) => M[i][0] * x[0] + M[i][1] * x[1] + M[i][2] * x[2]);
const norm = (x) => { const l = Math.hypot(x[0], x[1], x[2]); return x.map((t) => t / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let e1 = [0.3, 0.6, 0.7]; for (let k = 0; k < 60; k++) e1 = norm(mul(C, e1));
const C2 = C.map((r, i) => r.map((x, j) => x - dot(mul(C, e1), e1) * e1[i] * e1[j]));
let e2 = norm([e1[1], -e1[0], 0.2]); for (let k = 0; k < 60; k++) { e2 = mul(C2, e2); const p = dot(e2, e1); e2 = norm(e2.map((t, i) => t - p * e1[i])); }
const e3 = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
// концы: где ширина по e2 меньше — рукоять
const proj = all.map((q) => { const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]]; return [dot(d, e1), dot(d, e2)]; });
const mn = Math.min(...proj.map((p) => p[0])), mx = Math.max(...proj.map((p) => p[0])), L = mx - mn;
const wAt = (lo, hi) => { let a = 1e9, b = -1e9; proj.forEach((p) => { if (p[0] >= lo && p[0] <= hi) { a = Math.min(a, p[1]); b = Math.max(b, p[1]); } }); return b - a; };
const wMin = wAt(mn, mn + L * 0.2), wMax = wAt(mx - L * 0.2, mx);
// ось Z модели: от рукояти к острию — минус; рукоять там, где уже
const handleAtMin = wMin < wMax;
const zAx = handleAtMin ? e1.map((t) => -t) : e1;        // +Z смотрит на рукоять
// лезвие (широкая сторона) — по Y; остриё/обух неважно для силуэта
const yAx = e2, xAx = norm([yAx[1] * zAx[2] - yAx[2] * zAx[1], yAx[2] * zAx[0] - yAx[0] * zAx[2], yAx[0] * zAx[1] - yAx[1] * zAx[0]]);
void e3;
prims.forEach((p) => {
  const a = p.getAttribute('POSITION'), n = p.getAttribute('NORMAL'), w = [0, 0, 0];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, w); const d = [w[0] - c[0], w[1] - c[1], w[2] - c[2]]; a.setElement(i, [dot(d, xAx), dot(d, yAx), dot(d, zAx)]); }
  if (n) for (let i = 0; i < n.getCount(); i++) { n.getElement(i, w); n.setElement(i, [dot(w, xAx), dot(w, yAx), dot(w, zAx)]); }
});
for (const nd of doc.getRoot().listNodes()) { nd.setTranslation([0, 0, 0]); nd.setRotation([0, 0, 0, 1]); nd.setScale([1, 1, 1]); }
await io.write(path.join(ROOT, 'art3d/src/h/w_machete_fix.glb'), doc);
console.log('тесак: длина', L.toFixed(3), 'ширина у концов', wMin.toFixed(3), wMax.toFixed(3), 'рукоять', handleAtMin ? 'у min' : 'у max');
