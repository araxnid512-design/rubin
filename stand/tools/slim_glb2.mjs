// уменьшить текстуры GLB: цвет — до N пикселей, остальные карты (нормали, шероховатость) — до M; всё в JPEG
//   node slim_glb2.mjs вход.glb выход.glb 1024 512
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize, getBounds } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
const [src, dst, maxs, others] = process.argv.slice(2)
const N = parseInt(maxs || '1024')
const M = parseInt(others || String(N / 2))
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(src)
await doc.transform(dequantize())
for (const tex of doc.getRoot().listTextures()) {
  const img = sharp(Buffer.from(tex.getImage()))
  const m = await img.metadata()
  const isColor = doc.getRoot().listMaterials().some(mt => mt.getBaseColorTexture() === tex)
  const lim = isColor ? N : M
  let out = img
  if (Math.max(m.width, m.height) > lim) out = out.resize(lim, lim, { fit: 'inside' })
  tex.setImage(new Uint8Array(await out.flatten({ background: '#000000' }).jpeg({ quality: isColor ? 86 : 88 }).toBuffer()))
  tex.setMimeType('image/jpeg')
}
await io.write(dst, doc)
const b = getBounds(doc.getRoot().listScenes()[0])
console.log(dst.split('/').pop(), 'min', b.min.map(v => v.toFixed(3)).join(' '), 'max', b.max.map(v => v.toFixed(3)).join(' '))
