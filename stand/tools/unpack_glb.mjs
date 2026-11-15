// Распаковка GLB для Godot: убирает сжатие meshopt и квантование, текстуры WebP → PNG.
// Запуск (из tools/three3d, там установлены библиотеки): node ../../stand/tools/unpack_glb.mjs вход.glb выход.glb
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const [src, dst] = process.argv.slice(2)
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(src)
await doc.transform(dequantize())
for (const tex of doc.getRoot().listTextures()) {
  if (tex.getMimeType() === 'image/webp') {
    tex.setImage(new Uint8Array(await sharp(Buffer.from(tex.getImage())).png().toBuffer()))
    tex.setMimeType('image/png')
  }
}
for (const ext of doc.getRoot().listExtensionsUsed()) {
  if (['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp'].includes(ext.extensionName)) ext.dispose()
}
await io.write(dst, doc)
console.log('готово:', dst, doc.getRoot().listExtensionsUsed().map((e) => e.extensionName))
