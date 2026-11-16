// Разрезать одну модель-набор на отдельные предметы: связные куски сетки объединяются в предметы по близости
// (сверху, в плоскости), каждый предмет — отдельный узел «item_N» в выходном GLB с общей текстурой.
// Предмет ставится в начало координат: по x и z — центр, по y — низ на нуле.
//   node split_glb.mjs вход.glb выход.glb [зазор, доля размера набора — по умолчанию 0.02] [размер текстуры] [flip]
// Набор, стоящий под углом, сначала выравнивается (ряд — вдоль x; flip — развернуть на 180°). Порядок предметов:
// по рядам (сверху вниз либо от дальнего к ближнему), в ряду — вдоль x. Печатает таблицу размеров.
// Если предмет состоит из нескольких связных кусков (коробка и патрон рядом), кроме целого «item_N» пишутся
// его части: «item_N_a» — самая крупная, «item_N_b» — остальные (в той же системе координат).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
const [src, dst, gapArg, texArg, flipArg] = process.argv.slice(2)
const flip = flipArg === 'flip'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(src)
await doc.transform(dequantize())
const root = doc.getRoot()
const N = parseInt(texArg || '1024')
for (const tex of root.listTextures()) {
  const img = sharp(Buffer.from(tex.getImage()))
  const m = await img.metadata()
  let out = img
  if (Math.max(m.width, m.height) > N) out = out.resize(N, N, { fit: 'inside' })
  const isColor = root.listMaterials().some(mt => mt.getBaseColorTexture() === tex)
  if (isColor) { tex.setImage(new Uint8Array(await out.jpeg({ quality: 88 }).toBuffer())); tex.setMimeType('image/jpeg') }
  else { tex.setImage(new Uint8Array(await out.png().toBuffer())); tex.setMimeType('image/png') }
}
// собрать все треугольники в мировых координатах
const prims = []
for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const M = node.getWorldMatrix()
  for (const p of mesh.listPrimitives()) prims.push({ p, M })
}
if (prims.length !== 1) console.log('примитивов:', prims.length, '— беру все с материалом первого')
const P = [], Nn = [], UV = [], IDX = []
let mat = null
for (const { p, M } of prims) {
  mat = mat || p.getMaterial()
  const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), uv = p.getAttribute('TEXCOORD_0')
  const base = P.length / 3
  const v = [0, 0, 0]
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v)
    P.push(M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14])
    if (nor) { nor.getElement(i, v); Nn.push(M[0] * v[0] + M[4] * v[1] + M[8] * v[2], M[1] * v[0] + M[5] * v[1] + M[9] * v[2], M[2] * v[0] + M[6] * v[1] + M[10] * v[2]) } else Nn.push(0, 1, 0)
    const w = [0, 0]
    if (uv) uv.getElement(i, w)
    UV.push(w[0], w[1])
  }
  const ind = p.getIndices()
  if (ind) for (let i = 0; i < ind.getCount(); i++) IDX.push(base + ind.getScalar(i))
  else for (let i = 0; i < pos.getCount(); i++) IDX.push(base + i)
}
const nv = P.length / 3
// связность: вершины с одинаковым положением — одна точка
const par = new Int32Array(nv).map((_, i) => i)
const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a] } return a }
const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b }
const key = new Map()
for (let i = 0; i < nv; i++) {
  const k = Math.round(P[i * 3] * 1e5) + '_' + Math.round(P[i * 3 + 1] * 1e5) + '_' + Math.round(P[i * 3 + 2] * 1e5)
  if (key.has(k)) uni(i, key.get(k)); else key.set(k, i)
}
for (let t = 0; t < IDX.length; t += 3) { uni(IDX[t], IDX[t + 1]); uni(IDX[t], IDX[t + 2]) }
const comps = new Map()
for (let t = 0; t < IDX.length; t += 3) {
  const r = find(IDX[t])
  let c = comps.get(r)
  if (!c) { c = { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; c.parts = [c.tris]; comps.set(r, c) }
  c.tris.push(t)
  for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) { const v = P[IDX[t + k] * 3 + a]; if (v < c.min[a]) c.min[a] = v; if (v > c.max[a]) c.max[a] = v }
}
let all = [...comps.values()]
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
for (const c of all) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], c.min[a]); mx[a] = Math.max(mx[a], c.max[a]) }
const span = Math.max(mx[0] - mn[0], mx[2] - mn[2])
const gap = parseFloat(gapArg || '0.02') * span
console.log('набор:', (mx[0] - mn[0]).toFixed(3), '×', (mx[1] - mn[1]).toFixed(3), '×', (mx[2] - mn[2]).toFixed(3), '· связных кусков', all.length, '· зазор', gap.toFixed(4))
// набор может стоять под углом (витрина): повернуть вокруг y так, чтобы ряд предметов шёл вдоль x
const ctr = c => [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2]
let sxx = 0, szz = 0, sxz = 0
const mcx = all.reduce((s, c) => s + ctr(c)[0], 0) / all.length, mcz = all.reduce((s, c) => s + ctr(c)[2], 0) / all.length
for (const c of all) { const q = ctr(c); sxx += (q[0] - mcx) ** 2; szz += (q[2] - mcz) ** 2; sxz += (q[0] - mcx) * (q[2] - mcz) }
let ang = 0.5 * Math.atan2(2 * sxz, sxx - szz) + (flip ? Math.PI : 0)
const ca = Math.cos(ang), sa = Math.sin(ang)
for (let i = 0; i < nv; i++) {
  const x = P[i * 3], z = P[i * 3 + 2]
  P[i * 3] = x * ca + z * sa; P[i * 3 + 2] = -x * sa + z * ca
  const nx = Nn[i * 3], nz = Nn[i * 3 + 2]
  Nn[i * 3] = nx * ca + nz * sa; Nn[i * 3 + 2] = -nx * sa + nz * ca
}
for (const c of all) {
  c.min = [1e9, 1e9, 1e9]; c.max = [-1e9, -1e9, -1e9]
  for (const t of c.tris) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) { const v = P[IDX[t + k] * 3 + a]; if (v < c.min[a]) c.min[a] = v; if (v > c.max[a]) c.max[a] = v }
}
console.log('поворот набора', (ang * 180 / Math.PI).toFixed(1), '°')
// куски → предметы: объединять, пока их рамки (x, y, z) пересекаются с зазором
let merged = true
while (merged) {
  merged = false
  outer: for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j]
    let hit = true
    for (let k = 0; k < 3; k++) if (!(a.min[k] - gap < b.max[k] && b.min[k] - gap < a.max[k])) hit = false
    if (hit) {
      if (a.parts[0] === a.tris) a.parts = [a.tris.slice()]
      a.parts.push(...(b.parts[0] === b.tris ? [b.tris.slice()] : b.parts))
      a.tris.push(...b.tris)
      for (let k = 0; k < 3; k++) { a.min[k] = Math.min(a.min[k], b.min[k]); a.max[k] = Math.max(a.max[k], b.max[k]) }
      all.splice(j, 1); merged = true; break outer
    }
  }
}
// порядок: ряды — сверху вниз (если набор стоит стеной) или от дальнего к ближнему; в ряду — вдоль x
const ys = all.map(c => ctr(c)[1]), zs = all.map(c => ctr(c)[2])
const wall = Math.max(...ys) - Math.min(...ys) > Math.max(...zs) - Math.min(...zs)
const rk = c => wall ? -ctr(c)[1] : ctr(c)[2]
const rspan = wall ? Math.max(...ys) - Math.min(...ys) : Math.max(...zs) - Math.min(...zs)
all.sort((a, b) => rk(a) - rk(b))
const rows = []
for (const c of all) {
  const r = rows.find(r => Math.abs(r.k - rk(c)) < rspan * 0.2)
  if (r) r.items.push(c); else rows.push({ k: rk(c), items: [c] })
}
const items = []
for (const r of rows) { r.items.sort((a, b) => ctr(a)[0] - ctr(b)[0]); items.push(...r.items) }
console.log(wall ? 'набор стоит стеной: ряды сверху вниз' : 'набор лежит: ряды от дальнего к ближнему', '· рядов', rows.length)
// новый документ: общий материал, узел на предмет
for (const n of root.listNodes()) n.dispose()
for (const m of root.listMeshes()) m.dispose()
for (const a of root.listAccessors()) a.dispose()
const buf = root.listBuffers()[0]
const scene = root.listScenes()[0]
const emit = (name, tris, cx, y0, cz) => {
  const remap = new Map()
  const p2 = [], n2 = [], u2 = [], i2 = []
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const v = IDX[t + k]
    let w = remap.get(v)
    if (w === undefined) {
      w = p2.length / 3; remap.set(v, w)
      p2.push(P[v * 3] - cx, P[v * 3 + 1] - y0, P[v * 3 + 2] - cz)
      n2.push(Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]); u2.push(UV[v * 2], UV[v * 2 + 1])
    }
    i2.push(w)
  }
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(p2)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(n2)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(u2)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(i2)).setBuffer(buf))
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)))
}
const box = tris => {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
  for (const t of tris) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) { const v = P[IDX[t + k] * 3 + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v }
  return [mn, mx]
}
items.forEach((c, n) => {
  const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2, y0 = c.min[1]
  const name = 'item_' + (n + 1)
  emit(name, c.tris, cx, y0, cz)
  console.log(name, 'размер', (c.max[0] - c.min[0]).toFixed(3), (c.max[1] - c.min[1]).toFixed(3), (c.max[2] - c.min[2]).toFixed(3), 'треугольников', c.tris.length, 'частей', c.parts.length)
  // части предмета (связные куски) — отдельными узлами в той же системе: самая крупная — «a», остальные вместе — «b»
  if (c.parts.length > 1) {
    const vol = t => { const [mn, mx] = box(t); return (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]) }
    const ps = c.parts.slice().sort((p, q) => vol(q) - vol(p))
    emit(name + '_a', ps[0], cx, y0, cz)
    emit(name + '_b', ps.slice(1).flat(), cx, y0, cz)
    for (const [k, t] of [['a', ps[0]], ['b', ps.slice(1).flat()]]) { const [mn, mx] = box(t); console.log('   ', name + '_' + k, (mx[0] - mn[0]).toFixed(3), (mx[1] - mn[1]).toFixed(3), (mx[2] - mn[2]).toFixed(3), 'треугольников', t.length) }
  }
})
await io.write(dst, doc)
