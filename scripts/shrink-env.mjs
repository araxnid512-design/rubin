// Предметы окружения Tripo (godot/assets/tripo/e_*.glb: машины, мебель, улица) → один лёгкий файл для браузерной
// игры models/game/env.glb: сетки упрощены, у всех моделей ОДНА текстура (атлас 1024×1024: технике — клетки 256 px,
// остальным — 128 px, с полями из краевых пикселей) и один материал. Тогда все предметы участка игра сливает в один
// меш — один вызов отрисовки на участок (game/env-props.js). Узлы и сетки названы по модели (e_vaz2107 …).
// Пакеты gltf-transform в игру не входят — ставятся во временную папку (не в корень репозитория), как для
// scripts/shrink-weapons.mjs:
//   mkdir /tmp/gt && cd /tmp/gt && npm init -y && npm i @gltf-transform/core@4.2.1 @gltf-transform/functions@4.2.1 \
//     @gltf-transform/extensions@4.2.1 meshoptimizer@0.22.0 sharp@0.33.5 && cp <репозиторий>/scripts/shrink-env.mjs .
//   node shrink-env.mjs <репозиторий>/godot/assets/tripo <репозиторий>/models/game/env.glb
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, quantize, prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
// техника — крупнее на экране: клетка атласа 256 px и сетка подробнее
const VEHICLES = ['e_vaz2107', 'e_vaz_crashed', 'e_vaz_burned', 'e_niva', 'e_volga', 'e_uaz', 'e_paz', 'e_btr80', 'e_ural'];
const ATLAS = 1024, BIG = 256, SMALL = 128, PAD = 4;
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const files = readdirSync(src).filter((n) => /^e_.*\.glb$/.test(n)).sort();
const ids = files.map((f) => f.slice(0, -4));
const big = ids.filter((id) => VEHICLES.includes(id)), small = ids.filter((id) => !VEHICLES.includes(id));
// клетки: сначала крупные (256) построчно, оставшиеся клетки 256 делятся на четыре по 128
const cells = {};
const per = ATLAS / BIG;
let slot = 0;
for (const id of big) { cells[id] = { x: (slot % per) * BIG, y: Math.floor(slot / per) * BIG, s: BIG }; slot++; }
for (let i = 0; i < small.length; i++) {
	const s0 = slot + Math.floor(i / 4), q = i % 4;
	cells[small[i]] = { x: (s0 % per) * BIG + (q % 2) * SMALL, y: Math.floor(s0 / per) * BIG + Math.floor(q / 2) * SMALL, s: SMALL };
}
if (slot + Math.ceil(small.length / 4) > per * per) throw new Error('атлас мал для стольких моделей');

const outDoc = new Document();
const buffer = outDoc.createBuffer();
const material = outDoc.createMaterial('env').setMetallicFactor(0.05).setRoughnessFactor(0.85);
const scene = outDoc.createScene('env');
const tiles = [];
let total = 0;
for (const id of ids) {
	const doc = await io.read(join(src, `${id}.glb`));
	const isBig = VEHICLES.includes(id);
	// мелкое (бочка, шина, мешки) и так простое — упрощается меньше; мебель — до 40 %, техника — до 60 % (с камеры
	// сверху мелких граней не видно; предел ошибки — 1,2 % размера модели)
	const tris0 = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
	const ratio = isBig ? 0.6 : tris0 < 1000 ? 0.7 : 0.4;
	await doc.transform(dedup(), weld({ tolerance: 0.0005 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.012 }));
	const node = doc.getRoot().listNodes().find((n) => n.getMesh());
	const prim = node.getMesh().listPrimitives()[0];
	// картинка цвета → клетка атласа: ужать, поля — копия краевых пикселей (мип-уровни не тянут соседа)
	const cell = cells[id], inner = cell.s - PAD * 2;
	const img = prim.getMaterial().getBaseColorTexture().getImage();
	tiles.push({ input: await sharp(Buffer.from(img)).removeAlpha().resize(inner, inner).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).toBuffer(), left: cell.x, top: cell.y });
	// вершины — в осях модели (мировой матрицей узла), развёртка — в клетку атласа
	const M = node.getWorldMatrix();
	const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), UV = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
	const n = P.getCount(), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
	const v = [0, 0, 0], w = [0, 0];
	for (let i = 0; i < n; i++) {
		P.getElement(i, v);
		for (let k = 0; k < 3; k++) pos[i * 3 + k] = M[k] * v[0] + M[4 + k] * v[1] + M[8 + k] * v[2] + M[12 + k];
		N.getElement(i, v);
		// поворот без масштаба (у Tripo масштаб узла одинаковый по осям) — нормаль той же матрицей и нормировать
		const nx = M[0] * v[0] + M[4] * v[1] + M[8] * v[2], ny = M[1] * v[0] + M[5] * v[1] + M[9] * v[2], nz = M[2] * v[0] + M[6] * v[1] + M[10] * v[2];
		const l = Math.hypot(nx, ny, nz) || 1;
		nor.set([nx / l, ny / l, nz / l], i * 3);
		UV.getElement(i, w);
		const u = Math.min(1, Math.max(0, w[0])), t = Math.min(1, Math.max(0, w[1]));
		uv[i * 2] = (cell.x + PAD + u * inner) / ATLAS;
		uv[i * 2 + 1] = (cell.y + PAD + t * inner) / ATLAS;
	}
	const idx = I.getArray(), index = n < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx);
	const acc = (type, array) => outDoc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
	const p = outDoc.createPrimitive()
		.setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nor)).setAttribute('TEXCOORD_0', acc('VEC2', uv))
		.setIndices(acc('SCALAR', index)).setMaterial(material);
	scene.addChild(outDoc.createNode(id).setMesh(outDoc.createMesh(id).addPrimitive(p)));
	const tris = idx.length / 3;
	total += tris;
	console.log(id, 'треуг', tris0, '→', tris, 'клетка', cell.s);
}
const atlas = await sharp({ create: { width: ATLAS, height: ATLAS, channels: 3, background: '#808080' } }).composite(tiles).jpeg({ quality: 84 }).toBuffer();
material.setBaseColorTexture(outDoc.createTexture('envAtlas').setImage(atlas).setMimeType('image/jpeg'));
await outDoc.transform(quantize(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, outDoc);
console.log('моделей', ids.length, 'треуг всего', total, 'файл', Math.round(statSync(out).size / 1024), 'КБ (атлас', Math.round(atlas.length / 1024), 'КБ)');
