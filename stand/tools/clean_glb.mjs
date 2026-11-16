// связные куски сетки: сколько их, какого размера и где; с параметром drop — убрать мелкие отдельные куски
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
const [src, dst, minTris] = process.argv.slice(2)
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(src)
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION'), idx = prim.getIndices()
  const n = pos.getCount(), ia = idx.getArray()
  // вершины с одинаковой позицией — одна (швы развёртки не рвут кусок)
  const key = new Map(), rep = new Int32Array(n), p = [0, 0, 0]
  for (let i = 0; i < n; i++) { pos.getElement(i, p); const k = p.map(v => Math.round(v * 20000)).join(','); if (!key.has(k)) key.set(k, i); rep[i] = key.get(k) }
  const par = new Int32Array(n).map((_, i) => i)
  const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a] } return a }
  for (let t = 0; t < ia.length; t += 3) { const a = find(rep[ia[t]]), b = find(rep[ia[t + 1]]), c = find(rep[ia[t + 2]]); par[b] = a; par[c] = a }
  const comp = new Map()
  for (let t = 0; t < ia.length; t += 3) {
    const r = find(rep[ia[t]]); if (!comp.has(r)) comp.set(r, { tris: 0, min: [9, 9, 9], max: [-9, -9, -9] })
    const c = comp.get(r); c.tris++
    for (let k = 0; k < 3; k++) { pos.getElement(ia[t + k], p); for (let a = 0; a < 3; a++) { c.min[a] = Math.min(c.min[a], p[a]); c.max[a] = Math.max(c.max[a], p[a]) } }
  }
  const list = [...comp.entries()].sort((a, b) => b[1].tris - a[1].tris)
  console.log('кусков', list.length)
  for (const [r, c] of list.slice(0, 12)) console.log(' ', c.tris, 'min', c.min.map(v => v.toFixed(3)).join(' '), 'max', c.max.map(v => v.toFixed(3)).join(' '))
  if (dst) {
    const keep = new Set(list.filter(([r, c]) => c.tris >= parseInt(minTris)).map(([r]) => r))
    const out = []
    for (let t = 0; t < ia.length; t += 3) if (keep.has(find(rep[ia[t]]))) out.push(ia[t], ia[t + 1], ia[t + 2])
    idx.setArray(new (ia.constructor)(out))
    console.log('оставлено треугольников', out.length / 3, 'из', ia.length / 3)
  }
}
if (dst) await io.write(dst, doc)
