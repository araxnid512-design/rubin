// Запекание текстур в UV-развёртку: для каждого пикселя находим точку на поверхности
// (позиция, нормаль, атрибуты) и считаем цвет/высоту функцией от 3D-координат.
// Так узор не рвётся на швах развёртки и привязан к анатомии (рот, руки, ступни).

import * as THREE from 'three';

/**
 * @param {number} size — размер текстуры
 * @param {Array<{p:number[][], n:number[][], uv:number[][], a:number[][]}>} tris — треугольники
 * @param {(p:THREE.Vector3, n:THREE.Vector3, a:number[]) => {color:number[], height:number}} shade
 */
export function bakeAtlas(size, tris, shade) {
	const color = new Float32Array(size * size * 3);
	const height = new Float32Array(size * size);
	const filled = new Uint8Array(size * size);
	const p = new THREE.Vector3(), n = new THREE.Vector3();
	for (const t of tris) {
		const [u0, v0] = t.uv[0], [u1, v1] = t.uv[1], [u2, v2] = t.uv[2];
		// UV → пиксели (v вверх, строки текстуры сверху вниз — как в glTF с flipY=false)
		const x0 = u0 * size, y0 = (1 - v0) * size;
		const x1 = u1 * size, y1 = (1 - v1) * size;
		const x2 = u2 * size, y2 = (1 - v2) * size;
		const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
		if (Math.abs(area) < 1e-9) continue;
		const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
		const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
		const na = t.a[0].length;
		const attrs = new Array(na);
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				const px = x + 0.5, py = y + 0.5;
				let w1 = ((px - x0) * (y2 - y0) - (x2 - x0) * (py - y0)) / area;
				let w2 = ((x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)) / area;
				let w0 = 1 - w1 - w2;
				const eps = -0.02; // небольшой захват соседних пикселей против щелей
				if (w0 < eps || w1 < eps || w2 < eps) continue;
				const i = y * size + x;
				if (filled[i] && (w0 < 0 || w1 < 0 || w2 < 0)) continue;
				w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2);
				const s = w0 + w1 + w2;
				w0 /= s; w1 /= s; w2 /= s;
				p.set(
					t.p[0][0] * w0 + t.p[1][0] * w1 + t.p[2][0] * w2,
					t.p[0][1] * w0 + t.p[1][1] * w1 + t.p[2][1] * w2,
					t.p[0][2] * w0 + t.p[1][2] * w1 + t.p[2][2] * w2,
				);
				n.set(
					t.n[0][0] * w0 + t.n[1][0] * w1 + t.n[2][0] * w2,
					t.n[0][1] * w0 + t.n[1][1] * w1 + t.n[2][1] * w2,
					t.n[0][2] * w0 + t.n[1][2] * w1 + t.n[2][2] * w2,
				).normalize();
				for (let k = 0; k < na; k++) attrs[k] = t.a[0][k] * w0 + t.a[1][k] * w1 + t.a[2][k] * w2;
				const r = shade(p, n, attrs);
				color.set(r.color, i * 3);
				height[i] = r.height;
				filled[i] = (w0 >= 0 && w1 >= 0 && w2 >= 0) ? 2 : 1;
			}
		}
	}
	dilate(color, height, filled, size, 6);
	return { color, height, size };
}

// Расширяем заполненные области на несколько пикселей, чтобы mip-уровни не тянули фон на швах.
function dilate(color, height, filled, size, passes) {
	for (let pass = 0; pass < passes; pass++) {
		const next = filled.slice();
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const i = y * size + x;
				if (filled[i]) continue;
				let c = 0, r = 0, g = 0, b = 0, h = 0;
				for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
					const xx = x + dx, yy = y + dy;
					if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
					const j = yy * size + xx;
					if (!filled[j]) continue;
					r += color[j * 3]; g += color[j * 3 + 1]; b += color[j * 3 + 2]; h += height[j]; c++;
				}
				if (c) {
					color[i * 3] = r / c; color[i * 3 + 1] = g / c; color[i * 3 + 2] = b / c; height[i] = h / c;
					next[i] = 1;
				}
			}
		}
		filled.set(next);
	}
}

/** Цвет (sRGB 0..1) → RGBA8 DataTexture. */
export function colorTexture({ color, size }) {
	const data = new Uint8Array(size * size * 4);
	for (let i = 0; i < size * size; i++) {
		for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(Math.min(1, Math.max(0, color[i * 3 + k])) * 255);
		data[i * 4 + 3] = 255;
	}
	return makeTexture(data, size, true);
}

/** Высота → карта нормалей (в пространстве развёртки). */
export function normalTexture({ height, size }, strength) {
	const data = new Uint8Array(size * size * 4);
	const at = (x, y) => height[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
			const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
			const len = Math.hypot(dx, dy, 1);
			const i = (y * size + x) * 4;
			data[i] = (-dx / len * 0.5 + 0.5) * 255;
			data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
			data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
			data[i + 3] = 255;
		}
	}
	return makeTexture(data, size, false);
}

export function makeTexture(data, size, srgb, height = size) {
	const tex = new THREE.DataTexture(data, size, height, THREE.RGBAFormat);
	tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	tex.magFilter = THREE.LinearFilter;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.generateMipmaps = true;
	tex.flipY = false;
	tex.needsUpdate = true;
	return tex;
}
