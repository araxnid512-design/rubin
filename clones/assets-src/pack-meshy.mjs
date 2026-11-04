// Сборка модели персонажа из результатов Meshy (риг + клипы) в один лёгкий GLB для clones/www/models.
// Нужны пакеты: @gltf-transform/core, extensions, functions 4.1, meshoptimizer, sharp (ставятся отдельно, не в зависимости игры).
// Пример: node pack-meshy.mjs rig.glb out.glb idle=anim89.glb walk=walking_armature.glb ... --ratio=0.84
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, quantize, simplify, weld, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [rigPath, outPath, ...clipArgs] = process.argv.slice(2);
const opt = Object.fromEntries(clipArgs.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(rigPath);
const root = doc.getRoot(), buf = root.listBuffers()[0];
for (const a of root.listAnimations()) a.dispose();
const byName = new Map(root.listNodes().map(n => [n.getName(), n]));
for (const arg of clipArgs.filter(a => !a.startsWith('--'))) {
  const [name, file] = arg.split('=');
  const src = await io.read(file);
  const sa = src.getRoot().listAnimations()[0];
  const anim = doc.createAnimation(name);
  for (const ch of sa.listChannels()) {
    const tn = ch.getTargetNode(), node = tn && byName.get(tn.getName());
    if (!node) continue;
    const s = ch.getSampler();
    const inp = doc.createAccessor().setType('SCALAR').setArray(s.getInput().getArray().slice()).setBuffer(buf);
    const out = doc.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice()).setBuffer(buf);
    const ns = doc.createAnimationSampler().setInput(inp).setOutput(out).setInterpolation(s.getInterpolation());
    anim.addSampler(ns).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
}
await MeshoptSimplifier.ready;
const ratio = +(opt.ratio || 1);
await doc.transform(
  weld(),
  ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false })] : []),
  resample(),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [+(opt.tex || 1024), +(opt.tex || 1024)], quality: 82 }),
  dedup(), prune(),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
);
await io.write(outPath, doc);
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
console.log(outPath, 'tris', tris, 'anims', root.listAnimations().map(a => a.getName()).join(','));
