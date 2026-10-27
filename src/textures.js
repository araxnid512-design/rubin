// Процедурные бесшовные текстуры (цвет + карта нормалей) для кожи и ткани.
// Генерируются в чистом JS как DataTexture, поэтому работают и в Node при экспорте в GLB.

import * as THREE from 'three';
import { tileFbm, tileNoise, smoothstep } from './noise.js';

const mix = (a, b, t) => a + (b - a) * t;

function makeTexture(data, size, srgb) {
	const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.magFilter = THREE.LinearFilter;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.generateMipmaps = true;
	tex.anisotropy = 4;
	tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	tex.needsUpdate = true;
	return tex;
}

function heightToNormal(height, size, strength) {
	const data = new Uint8Array(size * size * 4);
	const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
			const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
			const len = Math.hypot(dx, dy, 1);
			const i = (y * size + x) * 4;
			data[i] = (-dx / len * 0.5 + 0.5) * 255;
			data[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
			data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
			data[i + 3] = 255;
		}
	}
	return data;
}

/** Кожа зомби: серо-зелёная, пятнистая, с венами, синяками, гнилью и порами. */
export function createSkinTextures(size = 512) {
	const color = new Uint8Array(size * size * 4);
	const height = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const u = x / size, v = y / size;
			const base = tileFbm(u, v, 4, 4, 1);
			const mottle = tileFbm(u, v, 8, 3, 7);
			const bruise = smoothstep(0.56, 0.7, tileFbm(u, v, 3, 3, 13));
			const rot = smoothstep(0.62, 0.74, tileFbm(u, v, 5, 4, 21));
			// Вены: «хребты» шума, тонкие ветвящиеся линии.
			const vn = tileFbm(u, v, 10, 4, 33);
			const vein = smoothstep(0.975, 0.997, 1 - Math.abs(vn * 2 - 1)) * smoothstep(0.45, 0.65, tileFbm(u, v, 3, 2, 41));
			const pores = tileNoise(u, v, 192, 51);
			const wrinkle = tileFbm(u, v * 0.5 + u * 0.5, 16, 2, 61);

			let r = mix(0.6, 0.45, base), g = mix(0.64, 0.5, base), b = mix(0.52, 0.4, base);
			r *= mix(0.88, 1.08, mottle); g *= mix(0.9, 1.06, mottle); b *= mix(0.9, 1.05, mottle);
			r = mix(r, 0.47, bruise * 0.35); g = mix(g, 0.4, bruise * 0.35); b = mix(b, 0.44, bruise * 0.35);
			r = mix(r, 0.33, rot * 0.6); g = mix(g, 0.32, rot * 0.6); b = mix(b, 0.2, rot * 0.6);
			r = mix(r, 0.34, vein * 0.55); g = mix(g, 0.3, vein * 0.55); b = mix(b, 0.38, vein * 0.55);
			const speck = smoothstep(0.86, 0.97, pores) * 0.18;
			r *= 1 - speck; g *= 1 - speck; b *= 1 - speck;

			const i = y * size + x;
			color[i * 4] = Math.min(255, r * 255);
			color[i * 4 + 1] = Math.min(255, g * 255);
			color[i * 4 + 2] = Math.min(255, b * 255);
			color[i * 4 + 3] = 255;
			height[i] = base * 0.6 + vein * 0.45 - rot * 0.8 - pores * 0.12 + wrinkle * 0.35;
		}
	}
	return {
		map: makeTexture(color, size, true),
		normalMap: makeTexture(heightToNormal(height, size, 2.2), size, false),
	};
}

/** Ткань: светлая основа (цвет задаётся вершинами), плетение, грязь и пятна. */
export function createClothTextures(size = 512) {
	const color = new Uint8Array(size * size * 4);
	const height = new Float32Array(size * size);
	const weaveFreq = 96;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const u = x / size, v = y / size;
			const warp = Math.sin(u * Math.PI * 2 * weaveFreq);
			const weft = Math.sin(v * Math.PI * 2 * weaveFreq);
			const weave = (warp * (weft > 0 ? 1 : 0.4) + weft * (warp > 0 ? 0.4 : 1)) * 0.5;
			const grime = tileFbm(u, v, 4, 4, 71);
			const stain = smoothstep(0.62, 0.8, tileFbm(u, v, 4, 5, 83)) * 0.75;
			const wrinkles = tileFbm(u * 0.7 + v * 0.3, v, 6, 3, 91);
			const fiber = tileNoise(u, v, 256, 97);

			let l = 0.86 + weave * 0.05 + (fiber - 0.5) * 0.06;
			l *= mix(1.0, 0.78, smoothstep(0.35, 0.8, grime));
			let r = l, g = l, b = l;
			r = mix(r, l * 0.62, stain); g = mix(g, l * 0.5, stain); b = mix(b, l * 0.38, stain);

			const i = y * size + x;
			color[i * 4] = Math.min(255, r * 255);
			color[i * 4 + 1] = Math.min(255, g * 255);
			color[i * 4 + 2] = Math.min(255, b * 255);
			color[i * 4 + 3] = 255;
			height[i] = weave * 0.35 + wrinkles * 2.0 + fiber * 0.1;
		}
	}
	return {
		map: makeTexture(color, size, true),
		normalMap: makeTexture(heightToNormal(height, size, 1.6), size, false),
	};
}
