// Модели стволов Tripo (godot/assets/tripo/w_*.glb) → лёгкие для браузерной игры (models/game/w_*.glb):
// сетка упрощена (сверху ствол — десятки пикселей), одна текстура цвета, квантование и сжатие meshopt (его читает
// GLTFLoader с MeshoptDecoder, game/main.js). Все 16 стволов — около 0,7 МБ (офлайн-версия одним файлом — до 16 МБ).
// Пакеты gltf-transform в игру не входят — ставятся во временную папку (не в корень репозитория):
//   mkdir /tmp/gt && cd /tmp/gt && npm init -y && npm i @gltf-transform/core@4.2.1 @gltf-transform/functions@4.2.1 \
//     @gltf-transform/extensions@4.2.1 meshoptimizer@0.22.0 sharp@0.33.5 && cp <репозиторий>/scripts/shrink-weapons.mjs .
//   node shrink-weapons.mjs <репозиторий>/godot/assets/tripo <репозиторий>/models/game 0.38 192
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, quantize, textureCompress, prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const [src, dst, ratioArg, sizeArg] = process.argv.slice(2);
const RATIO = +(ratioArg ?? 0.38), SIZE = +(sizeArg ?? 192);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
let total = 0;
for (const f of readdirSync(src).filter((n) => /^w_.*\.glb$/.test(n) && n !== 'w_pkt.glb')) {
	const doc = await io.read(join(src, f));
	for (const m of doc.getRoot().listMaterials()) {
		// только цвет: карты нормалей и металла сверху не видны, а весят вдвое больше цвета
		m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
		m.setMetallicFactor(0.25).setRoughnessFactor(0.6);
	}
	await doc.transform(
		dedup(), prune(),
		weld({ tolerance: 0.0005 }),
		simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.004 }),
		textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [SIZE, SIZE], quality: 80 }),
		quantize(), prune(),
		meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
	);
	const out = join(dst, f);
	await io.write(out, doc);
	let tris = 0;
	for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
	const sz = statSync(out).size; total += sz;
	console.log(basename(f), Math.round(sz / 1024), 'КБ, треуг', tris);
}
console.log('всего', Math.round(total / 1024), 'КБ');
