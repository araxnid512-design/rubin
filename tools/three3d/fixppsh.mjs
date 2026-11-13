// ППШ-41 из Tripo (по фото): диск вышел плоскостью к дулу — разворачиваем на 90° вокруг вертикали,
// чтобы стоял поперёк оружия, как у настоящего (плоскость диска — вдоль боковины).
// node tools/three3d/fixppsh.mjs  → art3d/src/h/w_ppsh41_fix.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(ROOT, 'art3d/src/h/w_ppsh41.glb'));
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
const n = P.getCount(), v = [0, 0, 0], q = [0, 0, 0];
// диск: полоса z, где модель широкая по x (ствол — к −z, приклад — к +z)
let z0 = 1e9, z1 = -1e9, y0 = 1e9, xm = 0;
for (let i = 0; i < n; i++) { P.getElement(i, v); if (Math.abs(v[0]) > 0.045) { z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); xm = Math.max(xm, Math.abs(v[0])); } }
// низ диска — самая низкая точка в его полосе
for (let i = 0; i < n; i++) { P.getElement(i, v); if (v[2] >= z0 - 0.01 && v[2] <= z1 + 0.01) y0 = Math.min(y0, v[1]); }
const r = xm, cy = y0 + r, cz = (z0 + z1) / 2;
console.log('диск: z', z0.toFixed(3), z1.toFixed(3), 'центр y', cy.toFixed(3), 'радиус', r.toFixed(3));
// ствольная коробка над диском не трогается
let recY = 1e9;
for (let i = 0; i < n; i++) { P.getElement(i, v); if (v[2] > z1 + 0.01 && v[2] < z1 + 0.06 && Math.abs(v[0]) < 0.04) recY = Math.min(recY, v[1]); }
const lim = Math.max(cy + r * 0.82, Math.min(recY, 0.205));
let moved = 0;
for (let i = 0; i < n; i++) {
  P.getElement(i, v);
  if (v[2] < z0 - 0.012 || v[2] > z1 + 0.012) continue;
  if ((v[0] * v[0] + (v[1] - cy) * (v[1] - cy)) > (r + 0.006) * (r + 0.006)) continue;
  if (v[1] > lim && Math.abs(v[0]) < 0.037) continue;
  // поворот на 90° вокруг вертикали через центр диска: x → z, z → −x
  const dx = v[0], dz = v[2] - cz;
  P.setElement(i, [-dz, v[1], cz + dx]);
  if (N) { N.getElement(i, q); N.setElement(i, [-q[2], q[1], q[0]]); }
  moved++;
}
console.log('развёрнуто вершин', moved, 'из', n);
await io.write(path.join(ROOT, 'art3d/src/h/w_ppsh41_fix.glb'), doc);
