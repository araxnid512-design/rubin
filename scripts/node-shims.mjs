// Минимальные заглушки браузерных API, нужные GLTFExporter в Node:
// FileReader (бинарный GLB) и OffscreenCanvas/ImageData (запись DataTexture в PNG).
import * as zlibSync from 'node:zlib';

const { deflateSync } = zlibSync;

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
function crc32(buf) {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, 'ascii');
	data.copy(out, 8);
	out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
	return out;
}

/** RGBA → PNG. */
export function encodePNG(rgba, width, height) {
	const raw = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (width * 4 + 1)] = 0;
		Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr.set([8, 6, 0, 0, 0], 8);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

export function installNodeShims() {
	globalThis.FileReader ??= class {
		readAsArrayBuffer(blob) {
			blob.arrayBuffer().then((buffer) => {
				this.result = buffer;
				this.onloadend?.();
			});
		}
	};
	globalThis.ImageData ??= class {
		constructor(data, width, height) {
			Object.assign(this, { data, width, height });
		}
	};
	globalThis.OffscreenCanvas ??= class {
		constructor(width, height) {
			this.width = width;
			this.height = height;
			this.pixels = null;
			this.flipY = false;
		}
		getContext() {
			const canvas = this;
			return {
				translate() {},
				scale(x, y) { if (y < 0) canvas.flipY = true; },
				putImageData(img) {
					const { width, height, data } = img;
					const out = new Uint8Array(width * height * 4);
					for (let y = 0; y < height; y++) {
						const src = canvas.flipY ? height - 1 - y : y;
						out.set(data.subarray(src * width * 4, (src + 1) * width * 4), y * width * 4);
					}
					canvas.pixels = out;
				},
				drawImage() { throw new Error('drawImage не поддерживается в Node'); },
			};
		}
		async convertToBlob() {
			return new Blob([encodePNG(this.pixels, this.width, this.height)], { type: 'image/png' });
		}
	};
}

/** PNG (8 бит, RGB/RGBA, без чересстрочности) → { width, height, data: RGBA Uint8Array }. */
export function decodePNG(buf) {
	const { inflateSync } = zlibSync;
	let pos = 8;
	let width = 0, height = 0, colorType = 0;
	const idat = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString('ascii', pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			if (data[8] !== 8 || data[12] !== 0) throw new Error('Поддерживаются только 8-битные PNG без чересстрочности');
			colorType = data[9];
		} else if (type === 'IDAT') idat.push(data);
		else if (type === 'IEND') break;
		pos += 12 + len;
	}
	const bpp = { 2: 3, 6: 4 }[colorType];
	if (!bpp) throw new Error(`Неподдерживаемый тип цвета PNG: ${colorType}`);
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * bpp;
	const pixels = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const f = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const out = pixels.subarray(y * stride, (y + 1) * stride);
		const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : new Uint8Array(stride);
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? out[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
			let v = line[x];
			if (f === 1) v += a;
			else if (f === 2) v += b;
			else if (f === 3) v += (a + b) >> 1;
			else if (f === 4) {
				const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			out[x] = v & 255;
		}
	}
	if (bpp === 4) return { width, height, data: pixels };
	const rgba = new Uint8Array(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		rgba.set(pixels.subarray(i * 3, i * 3 + 3), i * 4);
		rgba[i * 4 + 3] = 255;
	}
	return { width, height, data: rgba };
}
