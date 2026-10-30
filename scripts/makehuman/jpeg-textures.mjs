// Текстуры моделей — в JPEG: цвет кожи и одежды и карты нормалей непрозрачны, PNG для них в 4–6 раз тяжелее.
// Текстуры прозрачных материалов (глаза — alphaMode MASK) остаются PNG. GLB перепаковывается целиком:
// буферы картинок меняются, смещения остальных данных пересчитываются.
//
//   node scripts/makehuman/jpeg-textures.mjs models/game/*.glb   — пережать готовые модели на месте

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const align4 = (n) => (n + 3) & ~3;

/** glb — ArrayBuffer/Buffer модели; quality — для цвета, нормали жмутся мягче. Возвращает { glb, report }. */
export function jpegTextures(glb, { quality = 84, normalQuality = 92 } = {}) {
	const buf = Buffer.from(glb);
	const jsonLen = buf.readUInt32LE(12);
	const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
	const binStart = 20 + align4(jsonLen) + 8;
	const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + align4(jsonLen)));
	// какие картинки можно в JPEG и с каким качеством
	const role = new Map(); // индекс картинки → 'color' | 'normal' | 'alpha'
	const imageOf = (tex) => (tex == null ? null : json.textures[tex.index].source);
	for (const m of json.materials ?? []) {
		const alpha = m.alphaMode === 'MASK' || m.alphaMode === 'BLEND';
		const color = imageOf(m.pbrMetallicRoughness?.baseColorTexture), normal = imageOf(m.normalTexture);
		if (color != null) role.set(color, alpha ? 'alpha' : role.get(color) === 'alpha' ? 'alpha' : 'color');
		if (normal != null && role.get(normal) !== 'alpha') role.set(normal, 'normal');
	}
	const views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
	const report = [];
	(json.images ?? []).forEach((img, i) => {
		const r = role.get(i);
		if (!r || r === 'alpha' || img.mimeType !== 'image/png') return;
		// PNG из экспортёра иногда с хвостом после IEND — читаем до конца картинки
		const raw = Buffer.from(views[img.bufferView]), end = raw.lastIndexOf('IEND') + 8;
		const png = PNG.sync.read(end > 8 ? raw.subarray(0, end) : raw);
		const out = jpeg.encode({ data: png.data, width: png.width, height: png.height }, r === 'normal' ? normalQuality : quality).data;
		report.push(`${r} ${(views[img.bufferView].length / 1024).toFixed(0)}→${(out.length / 1024).toFixed(0)} КБ`);
		views[img.bufferView] = out;
		img.mimeType = 'image/jpeg';
	});
	// новый двоичный блок: все буферы подряд с выравниванием по 4 байта
	let offset = 0;
	const parts = [];
	json.bufferViews.forEach((v, i) => {
		const pad = align4(offset) - offset;
		if (pad) parts.push(Buffer.alloc(pad));
		offset += pad;
		v.byteOffset = offset;
		v.byteLength = views[i].length;
		parts.push(Buffer.from(views[i]));
		offset += views[i].length;
	});
	const binOut = Buffer.concat([...parts, Buffer.alloc(align4(offset) - offset)]);
	json.buffers[0].byteLength = binOut.length;
	const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
	const jsonOut = Buffer.concat([jsonBuf, Buffer.alloc(align4(jsonBuf.length) - jsonBuf.length, 0x20)]);
	const header = Buffer.alloc(12);
	header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
	header.writeUInt32LE(12 + 8 + jsonOut.length + 8 + binOut.length, 8);
	const chunk = (data, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]); };
	return { glb: Buffer.concat([header, chunk(jsonOut, 0x4e4f534a), chunk(binOut, 0x004e4942)]), report: report.join(', ') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	for (const file of process.argv.slice(2)) {
		const src = await readFile(file);
		const { glb, report } = jpegTextures(src);
		await writeFile(file, glb);
		console.log(`${file}: ${(src.length / 1024).toFixed(0)} → ${(glb.length / 1024).toFixed(0)} КБ (${report || 'без изменений'})`);
	}
}
