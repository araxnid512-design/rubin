// уменьшить текстуры GLB до N пикселей (JPEG для цвета, PNG для остальных) и убрать сжатие
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize, getBounds } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
const [src, dst, maxs] = process.argv.slice(2)
const N = parseInt(maxs || '1024')
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(src)
await doc.transform(dequantize())
for (const tex of doc.getRoot().listTextures()) {
  const img = sharp(Buffer.from(tex.getImage()))
  const m = await img.metadata()
  let out = img
  if (Math.max(m.width, m.height) > N) out = out.resize(N, N, { fit: 'inside' })
  const isColor = doc.getRoot().listMaterials().some(mt => mt.getBaseColorTexture() === tex)
  if (isColor) { tex.setImage(new Uint8Array(await out.jpeg({ quality: 88 }).toBuffer())); tex.setMimeType('image/jpeg') }
  else { tex.setImage(new Uint8Array(await out.png().toBuffer())); tex.setMimeType('image/png') }
  console.log(' текстура', m.width + 'x' + m.height, '→', Math.min(N, m.width), isColor ? 'jpeg' : 'png')
}
await io.write(dst, doc)
const b = getBounds(doc.getRoot().listScenes()[0])
console.log(dst.split('/').pop(), 'min', b.min.map(v => v.toFixed(3)).join(' '), 'max', b.max.map(v => v.toFixed(3)).join(' '))
