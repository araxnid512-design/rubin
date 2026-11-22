// Вырезать колёса из цельной модели машины Tripo (колёса слиты с кузовом) и записать их центры — в игре на их
// место ставятся отдельные колёса (крутятся, поворачивают, ходят на подвеске).
// Модель: длина — вдоль X, верх — Y, ширина — Z (как у моделей Tripo). Колёса ищутся по точкам касания земли
// (самый низ модели по бокам — там только шины): четыре группы (перёд/зад × лево/право), центр колеса — середина
// пятна касания по X; радиус — доля длины машины (у УАЗ-469 шина ~0,84 м при длине 4,025 м → 0.104), ось — по Z.
// Вырезаются треугольники, все вершины которых лежат в цилиндре колеса (радиус ×1.05) снаружи внутренней грани.
// Запуск (из tools/three3d): node ../../stand/tools/cut_wheels.mjs вход.glb выход.glb колёса.json [радиус/длина=0.104]
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize, prune } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import fs from 'fs'

const [src, dst, jsonOut, hfrac] = process.argv.slice(2)
const RK = parseFloat(hfrac || '0.11')
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(src)
await doc.transform(dequantize())

// все вершины в системе модели (с учётом матриц узлов)
function mul(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]
}
const prims = []
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const m = node.getWorldMatrix()
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION')
    const pts = []
    for (let i = 0; i < pos.getCount(); i++) pts.push(mul(m, pos.getElement(i, [])))
    prims.push({ p, pts })
  }
}
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
for (const { pts } of prims) for (const q of pts) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]) }
const H = mx[1] - mn[1], W = mx[2] - mn[2], L = mx[0] - mn[0]
const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2
// точки касания: самый низ, снаружи середины ширины
const low = []
for (const { pts } of prims) for (const q of pts) if (q[1] < mn[1] + 0.03 * H && Math.abs(q[2] - cz) > 0.25 * W / 2) low.push(q)
let c0 = cx - L / 4, c1 = cx + L / 4
for (let it = 0; it < 30; it++) {
  let s0 = 0, n0 = 0, s1 = 0, n1 = 0
  for (const q of low) { if (Math.abs(q[0] - c0) < Math.abs(q[0] - c1)) { s0 += q[0]; n0++ } else { s1 += q[0]; n1++ } }
  if (n0) c0 = s0 / n0
  if (n1) c1 = s1 / n1
}
const R = RK * L
const wheels = []
for (const cc of [c0, c1]) {
  for (const side of [1, -1]) {
    const g = low.filter(q => Math.abs(q[0] - cc) <= Math.abs(q[0] - (cc === c0 ? c1 : c0)) && Math.sign(q[2] - cz) === side)
    if (g.length < 5) continue
    const xs = g.map(q => q[0]).sort((a, b) => a - b)
    const xm = (xs[Math.floor(xs.length * 0.05)] + xs[Math.floor(xs.length * 0.95)]) / 2
    const zs = g.map(q => Math.abs(q[2] - cz)).sort((a, b) => a - b)
    const zo = zs[Math.floor(zs.length * 0.97)]
    const zi = zs[Math.floor(zs.length * 0.03)]
    wheels.push({ x: xm, y: mn[1] + R, z: cz + side * (zo + zi) / 2, r: R, zo, zi, front: cc > cx, side, n: g.length })
  }
}
// ширина шины — оценка: 0.55 радиуса; внутренняя граница выреза — чуть глубже
let removed = 0, total = 0
for (const { p, pts } of prims) {
  const ind = p.getIndices()
  if (!ind) continue
  const arr = ind.getArray()
  const keep = []
  for (let t = 0; t < arr.length; t += 3) {
    total++
    let cut = true
    for (let k = 0; k < 3 && cut; k++) {
      const q = pts[arr[t + k]]
      let inW = false
      for (const w of wheels) {
        const d = Math.hypot(q[0] - w.x, q[1] - w.y)
        const zz = Math.abs(q[2] - cz)
        if (d < w.r * 1.1 && Math.sign(q[2] - cz) === w.side && zz > Math.min(w.zi, w.zo - w.r * 0.5) - w.r * 0.5) { inW = true; break }
      }
      cut = inW
    }
    if (cut) removed++
    else keep.push(arr[t], arr[t + 1], arr[t + 2])
  }
  ind.setArray(new (arr.constructor)(keep))
}
await doc.transform(prune())
await io.write(dst, doc)
const out = { model: { min: mn, max: mx }, wheels: wheels.map(w => ({ x: w.x, y: w.y, z: w.z, r: w.r, w: w.zo - w.zi, front: w.front, side: w.side })) }
fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1))
console.log('колёс', wheels.length, 'вырезано треугольников', removed, 'из', total)
for (const w of wheels) console.log(` ${w.front ? 'перед' : 'зад'} ${w.side > 0 ? '+z' : '-z'}: центр (${w.x.toFixed(3)}, ${w.y.toFixed(3)}, ${w.z.toFixed(3)}) r ${w.r.toFixed(3)} ширина ${(w.zo - w.zi).toFixed(3)} точек ${w.n}`)
