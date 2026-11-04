// Нарезка разрушителя Meshy на жёсткие части по разметке dk-seg.py: node dk-split.mjs model.glb labels.bin dk.glb
// Нужны @gltf-transform/core, extensions, functions 4.1, meshoptimizer, sharp (ставятся отдельно).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, textureCompress, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const [src, labPath, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot(), scene = root.listScenes()[0], buf = root.listBuffers()[0];
const oldNode = root.listNodes().find(n => n.getMesh());
const prim = oldNode.getMesh().listPrimitives()[0], mat = prim.getMaterial();
const lab = new Uint8Array(fs.readFileSync(labPath)), idx = prim.getIndices().getArray(), pos = prim.getAttribute('POSITION').getArray();
const NAMES = ['torso', 'head', 'armL', 'armR', 'legFL', 'legFR', 'legB'];
const tri = k => { const t = []; for (let i = 0; i < lab.length; i++) if (lab[i] === k) t.push(i); return t; };
const P = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
const cen = list => { const s = [0, 0, 0]; for (const p of list) for (let k = 0; k < 3; k++) s[k] += p[k] / list.length; return s; };
const vertsOf = k => { const v = []; for (const t of tri(k)) for (let j = 0; j < 3; j++) v.push(P(idx[t * 3 + j])); return v; };
let minY = Infinity; for (let i = 1; i < pos.length; i += 3) minY = Math.min(minY, pos[i]);
// суставы
const piv = {};
piv.torso = [0, -0.2, 0];
{ const v = vertsOf(1); let zmin = Infinity, ys = 0; for (const p of v) { zmin = Math.min(zmin, p[2]); ys += p[1] / v.length; } piv.head = [0, ys, zmin + 0.04]; }
for (const [k, n] of [[2, 'armL'], [3, 'armR']]) piv[n] = cen(vertsOf(k).filter(p => p[1] > 0.38));
for (const [k, n] of [[4, 'legFL'], [5, 'legFR'], [6, 'legB']]) {
  const v = vertsOf(k).map(p => [p, Math.hypot(p[0], p[1] + 0.2, p[2])]).sort((a, b) => a[1] - b[1]);
  piv[n] = cen(v.slice(0, Math.max(8, v.length * 0.04 | 0)).map(a => a[0]));
}
// стопы (для направления ноги) и дула (для вспышек выстрела)
const extra = {};
for (const [k, n] of [[4, 'legFL'], [5, 'legFR'], [6, 'legB']]) extra[n + 'Foot'] = cen(vertsOf(k).filter(p => p[1] < minY + 0.06));
for (const [k, n] of [[2, 'armL'], [3, 'armR']]) { const v = vertsOf(k); let zmax = -Infinity; for (const p of v) zmax = Math.max(zmax, p[2]); extra[n + 'Muzzle'] = cen(v.filter(p => p[2] > zmax - 0.03)); }
console.log(JSON.stringify({ piv, extra, minY }, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
// части: свой примитив на треугольники части; вершины сдвинуты к суставу
const attrs = prim.listSemantics().map(s => [s, prim.getAttribute(s)]);
for (let k = 0; k < NAMES.length; k++) {
  const ts = tri(k), map = new Map(), order = [];
  for (const t of ts) for (let j = 0; j < 3; j++) { const v = idx[t * 3 + j]; if (!map.has(v)) { map.set(v, order.length); order.push(v); } }
  const np = doc.createPrimitive().setMaterial(mat);
  for (const [s, a] of attrs) {
    const sz = a.getElementSize(), arr = a.getArray(), Ctor = arr.constructor, na = new Ctor(order.length * sz);
    order.forEach((v, i) => { for (let c = 0; c < sz; c++) na[i * sz + c] = arr[v * sz + c]; });
    if (s === 'POSITION') for (let i = 0; i < order.length; i++) for (let c = 0; c < 3; c++) na[i * 3 + c] -= piv[NAMES[k]][c];
    np.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(na).setNormalized(a.getNormalized()).setBuffer(buf));
  }
  const ni = new Uint32Array(ts.length * 3); ts.forEach((t, i) => { for (let j = 0; j < 3; j++) ni[i * 3 + j] = map.get(idx[t * 3 + j]); });
  np.setIndices(doc.createAccessor().setType('SCALAR').setArray(ni).setBuffer(buf));
  const node = doc.createNode('dk_' + NAMES[k]).setMesh(doc.createMesh('dk_' + NAMES[k]).addPrimitive(np)).setTranslation(piv[NAMES[k]]);
  scene.addChild(node);
}
for (const [n, p] of Object.entries(extra)) scene.addChild(doc.createNode('dk_' + n).setTranslation(p));
scene.addChild(doc.createNode('dk_ground').setTranslation([0, minY, 0]));
oldNode.dispose();
// суставы — в extras сцены: квантование меняет сдвиг и масштаб узлов
scene.setExtras({ dk: { piv, extra, minY } });
await MeshoptSimplifier.ready;
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: +(process.env.RATIO || 0.8), error: 0.002, lockBorder: true }),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 82 }),
  dedup(), prune({ keepLeaves: true }), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
);
await io.write(out, doc);
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
console.log(out, 'tris', tris, fs.statSync(out).size);
