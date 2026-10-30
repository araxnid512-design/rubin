// Процедурные текстуры локации (canvas): асфальт, трава, грязь, панели хрущёвки,
// кирпич, шифер, доски, гаражные ворота, окна, вывески, кровь и лужи.

import * as THREE from 'three';
import { tileFbm, tileNoise } from '../src/noise.js';

const cache = new Map();
let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

function canvas(w, h = w) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	return c;
}

function toTexture(c, { repeat = [1, 1], srgb = true } = {}) {
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(...repeat);
	t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	t.anisotropy = maxAniso;
	return t;
}

/** Заполнение пикселей функцией (u, v) → [r, g, b] (0..255) и высоты для карты нормалей. */
function pixels(size, fn) {
	const c = canvas(size);
	const ctx = c.getContext('2d');
	const img = ctx.createImageData(size, size);
	const height = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const [r, g, b, h = 0] = fn(x / size, y / size, x, y);
			const i = (y * size + x) * 4;
			img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
			height[y * size + x] = h;
		}
	}
	ctx.putImageData(img, 0, 0);
	return { c, ctx, height, size };
}

function normalFrom({ height, size }, strength = 2) {
	const c = canvas(size);
	const ctx = c.getContext('2d');
	const img = ctx.createImageData(size, size);
	const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
			const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
			const l = Math.hypot(dx, dy, 1);
			const i = (y * size + x) * 4;
			img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
			img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
			img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
			img.data[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return c;
}

const clamp = (v) => Math.max(0, Math.min(255, v));
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function memo(key, make) {
	if (!cache.has(key)) cache.set(key, make());
	return cache.get(key);
}

/** Материал по текстуре с картой нормалей. */
function texMaterial(key, make, { repeat = [1, 1], roughness = 0.9, metalness = 0, normal = 2, ...rest } = {}) {
	const { map, normalMap } = memo(key, () => {
		const p = make();
		return { map: toTexture(p.c), normalMap: normal ? toTexture(normalFrom(p, normal), { srgb: false }) : null };
	});
	const m = map.clone(); m.repeat.set(...repeat); m.needsUpdate = true;
	const n = normalMap?.clone(); if (n) { n.repeat.set(...repeat); n.needsUpdate = true; }
	return new THREE.MeshStandardMaterial({ map: m, normalMap: n, roughness, metalness, ...rest });
}

// ---------- Земля ----------

export function grassMaterial(repeat) {
	return texMaterial('grass', () => pixels(512, (u, v) => {
		const n = tileFbm(u, v, 8, 4, 1), d = tileFbm(u, v, 3, 3, 5), blade = tileNoise(u, v, 256, 9);
		let c = mixc([78, 92, 52], [104, 112, 62], n);
		c = mixc(c, [92, 80, 58], ss(0.6, 0.78, d) * 0.45); // проплешины
		c = mixc(c, [128, 120, 78], ss(0.62, 0.8, tileFbm(u, v, 16, 2, 13)) * 0.4); // сухая трава
		c = c.map((x) => clamp(x * (0.85 + blade * 0.3)));
		return [...c, n + blade * 0.6];
	}), { repeat, roughness: 0.95, normal: 1.5 });
}

export function asphaltMaterial(repeat) {
	return texMaterial('asphalt', () => pixels(512, (u, v) => {
		const n = tileFbm(u, v, 12, 4, 21), g = tileNoise(u, v, 256, 23), g2 = tileNoise(u, v, 128, 25);
		let l = 78 + n * 22 + (g - 0.5) * 22 + (g2 - 0.5) * 10;
		const crack = ss(0.985, 0.997, 1 - Math.abs(tileFbm(u, v, 4, 5, 27) * 2 - 1)) * ss(0.45, 0.6, tileFbm(u, v, 2, 2, 33));
		const patch = ss(0.64, 0.67, tileFbm(u, v, 2, 3, 29));
		l = l * (1 - patch * 0.18) - crack * 30;
		const wet = ss(0.62, 0.78, tileFbm(u, v, 2, 3, 31));
		return [clamp(l - wet * 8), clamp(l - wet * 8), clamp(l + 3 - wet * 6), n * 0.6 + g * 0.6 - crack * 1.5];
	}), { repeat, roughness: 0.9, normal: 2 });
}

export function dirtMaterial(repeat) {
	return texMaterial('dirt', () => pixels(512, (u, v) => {
		const n = tileFbm(u, v, 8, 5, 41), s = tileNoise(u, v, 200, 43);
		const pebble = ss(0.8, 0.9, tileNoise(u, v, 90, 47));
		let c = mixc([92, 78, 60], [120, 104, 80], n);
		c = mixc(c, [140, 134, 124], pebble * 0.6);
		return [...c.map((x) => clamp(x * (0.9 + s * 0.2))), n + pebble * 0.8];
	}), { repeat, roughness: 0.95, normal: 2 });
}

/** Разметка дороги: прерывистая осевая и краевые линии (прозрачная). */
export function roadMarkingTexture() {
	return memo('marking', () => {
		const c = canvas(512, 64), ctx = c.getContext('2d');
		ctx.fillStyle = 'rgba(230,230,220,0.85)';
		ctx.fillRect(0, 0, 300, 64); // штрих 3.5 м из 6
		const img = ctx.getImageData(0, 0, 512, 64);
		for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] *= 0.4 + Math.random() * 0.6; // стёртая краска
		ctx.putImageData(img, 0, 0);
		const t = toTexture(c);
		return t;
	});
}

// ---------- Здания ----------

/** Фасад хрущёвки: одна ячейка = панель 3.2×2.8 м с окном. */
export function panelFacadeMaterial(repeat, { balconyless = false } = {}) {
	return texMaterial(`panel${balconyless}`, () => {
		const p = pixels(256, (u, v, x, y) => {
			const n = tileFbm(u, v, 4, 4, 51), g = tileNoise(u, v, 128, 53);
			let c = mixc([168, 164, 152], [190, 186, 174], n).map((k) => k * (0.92 + g * 0.12));
			const seam = (x < 3 || y < 3) ? 1 : 0;
			c = mixc(c, [90, 88, 84], seam * 0.8);
			const streak = ss(0.55, 0.8, tileFbm(u * 0.3, v * 3, 8, 2, 57)) * v; // потёки
			c = mixc(c, [110, 108, 98], streak * 0.35);
			return [...c, n * 0.5 - seam * 2];
		});
		// окно
		const { ctx } = p;
		const wx = 70, wy = 70, ww = 116, wh = 120;
		ctx.fillStyle = '#5a5650'; ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
		const lit = Math.random() < 0.08;
		const glass = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
		glass.addColorStop(0, lit ? '#8c7a52' : '#28323a'); glass.addColorStop(0.5, lit ? '#6a5a3c' : '#3c4a54'); glass.addColorStop(1, lit ? '#584a30' : '#1a2228');
		ctx.fillStyle = glass; ctx.fillRect(wx, wy, ww, wh);
		ctx.fillStyle = '#d8d4c8'; // рамы
		ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + 34, ww, 5);
		ctx.strokeStyle = '#d8d4c8'; ctx.lineWidth = 5; ctx.strokeRect(wx, wy, ww, wh);
		ctx.fillStyle = '#9a968c'; ctx.fillRect(wx - 10, wy + wh + 6, ww + 20, 8); // отлив
		// трещины на стекле
		ctx.strokeStyle = 'rgba(200,210,215,0.5)'; ctx.lineWidth = 1;
		for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(wx + 30 + i * 20, wy + 50); ctx.lineTo(wx + 10 + i * 35, wy + 100); ctx.stroke(); }
		return p;
	}, { repeat, roughness: 0.92, normal: 1.5 });
}

export function brickMaterial(repeat, tint = [150, 72, 52]) {
	return texMaterial(`brick${tint}`, () => {
		const p = pixels(512, (u, v, x, y) => {
			const row = Math.floor(y / 21), off = (row % 2) * 32;
			const bx = (x + off) % 64, by = y % 21;
			const mortar = bx < 4 || by < 3;
			const id = Math.floor((x + off) / 64) * 31 + row * 17;
			const varb = tileNoise(((id * 0.137) % 1), ((id * 0.311) % 1), 64, 61);
			const n = tileFbm(u, v, 16, 3, 63);
			let c = mortar ? [150, 146, 136] : mixc(tint, tint.map((k) => k * 0.7), varb);
			c = c.map((k) => k * (0.85 + n * 0.3));
			return [...c.map(clamp), mortar ? -1 : n * 0.5];
		});
		return p;
	}, { repeat, roughness: 0.9, normal: 2.5 });
}

export function plasterMaterial(repeat, tint = [196, 184, 160]) {
	return texMaterial(`plaster${tint}`, () => pixels(256, (u, v) => {
		const n = tileFbm(u, v, 6, 5, 71);
		const peel = ss(0.63, 0.66, tileFbm(u, v, 4, 4, 73));
		let c = mixc(tint, tint.map((k) => k * 0.8), n);
		c = mixc(c, [150, 80, 60], peel * 0.8); // облупилась до кирпича
		c = mixc(c, [120, 116, 100], ss(0.5, 1, v) * 0.3);
		return [...c.map(clamp), n - peel];
	}), { repeat, roughness: 0.95, normal: 2 });
}

export function woodMaterial(repeat, tint = [110, 84, 60]) {
	return texMaterial(`wood${tint}`, () => pixels(256, (u, v, x, y) => {
		const plank = Math.floor(x / 32), gap = x % 32 < 2;
		const grain = tileFbm(u * 8 + plank * 0.37, v * 0.5, 8, 4, 81 + plank);
		const age = tileFbm(u, v, 4, 3, 83);
		let c = mixc(tint, tint.map((k) => k * 0.6), grain);
		c = mixc(c, [120, 118, 110], age * 0.5); // посерело от времени
		if (gap) c = c.map((k) => k * 0.35);
		return [...c.map(clamp), gap ? -2 : grain];
	}), { repeat, roughness: 0.95, normal: 2 });
}

export function slateRoofMaterial(repeat) {
	return texMaterial('slate', () => pixels(256, (u, v, x) => {
		const wave = Math.sin(u * Math.PI * 2 * 8) * 0.5 + 0.5; // волнистый шифер
		const n = tileFbm(u, v, 6, 4, 91);
		const moss = ss(0.6, 0.75, tileFbm(u, v, 4, 4, 93));
		let c = mixc([150, 150, 144], [110, 112, 106], n).map((k) => k * (0.8 + wave * 0.25));
		c = mixc(c, [80, 92, 60], moss * 0.6);
		return [...c.map(clamp), wave * 2 + n];
	}), { repeat, roughness: 0.9, normal: 2.5 });
}

export function metalRoofMaterial(repeat, tint = [120, 60, 50]) {
	return texMaterial(`metal${tint}`, () => pixels(256, (u, v) => {
		const rib = Math.abs(Math.sin(u * Math.PI * 10)) ** 6;
		const rust = ss(0.5, 0.8, tileFbm(u, v, 6, 4, 101));
		let c = mixc(tint, [110, 64, 36], rust);
		c = c.map((k) => k * (0.85 + rib * 0.25));
		return [...c.map(clamp), rib * 2 - rust * 0.3];
	}), { repeat, roughness: 0.7, metalness: 0.3, normal: 2 });
}

export function garageDoorMaterial(number) {
	return texMaterial(`garage${number}`, () => {
		const tint = [[96, 110, 96], [120, 90, 70], [80, 96, 118], [110, 110, 100]][number % 4];
		const p = pixels(256, (u, v, x, y) => {
			const rust = ss(0.48, 0.75, tileFbm(u, v, 5, 4, 111 + number));
			const panel = (x % 128 < 3 || y < 4 || y > 250) ? 0.6 : 1;
			let c = mixc(tint, [120, 70, 40], rust).map((k) => k * panel);
			c = mixc(c, [70, 50, 35], ss(0.75, 1, v) * 0.5);
			return [...c.map(clamp), panel < 1 ? -1 : -rust * 0.5];
		});
		p.ctx.fillStyle = 'rgba(240,240,230,0.75)';
		p.ctx.font = 'bold 40px sans-serif';
		p.ctx.fillText(String(number + 1), 112, 60);
		return p;
	}, { roughness: 0.65, metalness: 0.4, normal: 2 });
}

export function concreteMaterial(repeat, tint = [150, 148, 140]) {
	return texMaterial(`concrete${tint}`, () => pixels(256, (u, v) => {
		const n = tileFbm(u, v, 8, 4, 121), g = tileNoise(u, v, 128, 123);
		const c = mixc(tint, tint.map((k) => k * 0.75), n).map((k) => k * (0.9 + g * 0.2));
		return [...c.map(clamp), n + g * 0.4];
	}), { repeat, roughness: 0.95, normal: 2 });
}

// ---------- Интерьер ----------

/** Старые обои: вертикальные полосы с цветочным узором, выцветшие и в пятнах. */
export function wallpaperMaterial(repeat, tint = [176, 160, 122], seed = 0) {
	return texMaterial(`wallpaper${tint}${seed}`, () => pixels(256, (u, v, x, y) => {
		const stripe = Math.floor(x / 32) % 2;
		const flower = Math.max(0, 1 - Math.hypot(((x + (Math.floor(y / 64) % 2) * 16) % 32) - 16, (y % 64) - 32) / 9);
		const stain = ss(0.55, 0.8, tileFbm(u, v, 4, 4, 131 + seed));
		let c = mixc(tint, tint.map((k) => k * 0.86), stripe * 0.6);
		c = mixc(c, tint.map((k, i) => k * [0.75, 0.62, 0.55][i]), flower * 0.7);
		c = mixc(c, [120, 100, 70], stain * 0.45); // подтёки
		c = c.map((k) => k * (0.9 + tileNoise(u, v, 128, 133 + seed) * 0.12));
		return [...c.map(clamp), flower * 0.3 - stain * 0.2];
	}), { repeat, roughness: 0.95, normal: 1 });
}

/** Побелка или краска (печь, стены кухни и магазина): ровная, с лёгкими разводами и грязью снизу. */
export function whitewashMaterial(repeat, tint = [232, 228, 216]) {
	return texMaterial(`whitewash${tint}`, () => pixels(256, (u, v) => {
		const n = tileFbm(u, v, 6, 4, 171), soot = ss(0.55, 1, v) * tileFbm(u, v, 3, 3, 173);
		let c = mixc(tint, tint.map((k) => k * 0.89), n);
		c = mixc(c, [120, 114, 104], soot * 0.35).map((k) => k * (0.95 + tileNoise(u, v, 128, 175) * 0.07));
		return [...c.map(clamp), n * 0.5];
	}), { repeat, roughness: 0.95, normal: 1 });
}

/** Ковёр с советским орнаментом. */
export function rugMaterial(tint = [128, 34, 30]) {
	const t = memo(`rug${tint}`, () => {
		const p = pixels(256, (u, v, x, y) => {
			const dx = Math.abs(u - 0.5) * 2, dy = Math.abs(v - 0.5) * 2;
			const border = Math.max(dx, dy) > 0.82 ? 1 : 0, inner = Math.max(dx, dy) > 0.74 && !border ? 1 : 0;
			const diamond = (Math.abs(((u * 6) % 1) - 0.5) + Math.abs(((v * 4) % 1) - 0.5)) < 0.32 ? 1 : 0;
			const medallion = dx + dy < 0.55 ? 1 : 0;
			let c = tint;
			if (diamond) c = [196, 160, 96];
			if (medallion) c = mixc([30, 40, 70], [200, 170, 110], (dx + dy) < 0.3 ? 1 : 0);
			if (inner) c = [210, 186, 130];
			if (border) c = [40, 46, 70];
			const wear = tileFbm(u, v, 6, 3, 141);
			c = mixc(c, [120, 110, 96], ss(0.6, 0.9, wear) * 0.5).map((k) => k * (0.88 + tileNoise(u, v, 256, 143) * 0.15));
			return [...c.map(clamp), wear];
		});
		return toTexture(p.c);
	});
	return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
}

/** Линолеум «в шашечку» (магазин). */
export function linoleumMaterial(repeat) {
	return texMaterial('linoleum', () => pixels(256, (u, v, x, y) => {
		const check = (Math.floor(x / 64) + Math.floor(y / 64)) % 2;
		const dirt = ss(0.45, 0.85, tileFbm(u, v, 5, 4, 151));
		let c = check ? [150, 138, 112] : [108, 92, 74];
		c = mixc(c, [80, 70, 56], dirt * 0.6).map((k) => k * (0.92 + tileNoise(u, v, 128, 153) * 0.1));
		return [...c.map(clamp), check * 0.2 - dirt * 0.3];
	}), { repeat, roughness: 0.6, normal: 1 });
}

/** Вода пруда: тёмная, глянцевая, с мелкой рябью (карту нормалей сдвигает уровень — рябь бежит). */
export function waterMaterial() {
	const m = texMaterial('water', () => pixels(256, (u, v) => {
		const h = tileFbm(u, v, 6, 4, 171) * 0.7 + tileFbm(u, v, 14, 3, 173) * 0.3;
		const c = mixc([34, 50, 50], [52, 70, 66], h);
		return [...c, h];
	}), { repeat: [6, 6], roughness: 0.08, metalness: 0.15, normal: 3 });
	m.envMapIntensity = 2.2;
	m.normalScale.set(0.5, 0.5);
	return m;
}

/** Ткань (диван, покрывало) — однотонная с фактурой. */
export function fabricMaterial(tint) {
	return texMaterial(`fabric${tint}`, () => pixels(128, (u, v, x, y) => {
		const weave = ((x + y) % 4 < 2 ? 1 : 0) * 0.5 + tileNoise(u, v, 64, 161) * 0.5;
		const c = tint.map((k) => k * (0.82 + weave * 0.2));
		return [...c.map(clamp), weave];
	}), { repeat: [2, 2], roughness: 1, normal: 1 });
}

/** Окно деревенского дома с белыми наличниками. */
export function houseWindowMaterial() {
	const t = memo('housewin', () => {
		const c = canvas(128, 160), ctx = c.getContext('2d');
		ctx.fillStyle = '#e8e4d8'; ctx.fillRect(0, 0, 128, 160);
		ctx.fillStyle = '#d2cbb8';
		ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(64, 0); ctx.lineTo(128, 22); ctx.fill();
		const g = ctx.createLinearGradient(0, 30, 128, 140);
		g.addColorStop(0, '#2a3238'); g.addColorStop(1, '#141a1e');
		ctx.fillStyle = g; ctx.fillRect(14, 30, 100, 110);
		ctx.fillStyle = '#e8e4d8'; ctx.fillRect(61, 30, 6, 110); ctx.fillRect(14, 64, 100, 5);
		ctx.strokeStyle = 'rgba(180,190,195,0.45)'; ctx.beginPath(); ctx.moveTo(20, 80); ctx.lineTo(55, 130); ctx.stroke();
		return toTexture(c);
	});
	return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 });
}

/** Вывеска с надписью. */
export function signMaterial(text, { bg = '#e9e4d8', fg = '#b02218', w = 512, h = 96 } = {}) {
	const t = memo(`sign${text}`, () => {
		const c = canvas(w, h), ctx = c.getContext('2d');
		ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
		// длинная надпись ужимается по ширине таблички
		let size = h * 0.62;
		ctx.font = `bold ${size}px sans-serif`;
		const tw = ctx.measureText(text).width;
		if (tw > w * 0.92) { size *= (w * 0.92) / tw; ctx.font = `bold ${size}px sans-serif`; }
		ctx.fillStyle = fg;
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText(text, w / 2, h / 2 + 4);
		const img = ctx.getImageData(0, 0, w, h);
		for (let i = 0; i < img.data.length; i += 4) {
			const k = 0.75 + Math.random() * 0.25; // выгорело и запылилось
			img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
		}
		ctx.putImageData(img, 0, 0);
		return toTexture(c);
	});
	return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}

// ---------- Декали ----------

export function bloodDecalTexture(seed = 0) {
	return memo(`blood${seed}`, () => {
		const c = canvas(256), ctx = c.getContext('2d');
		const rnd = mulberry(seed + 1);
		for (let i = 0; i < 26; i++) {
			const r = 6 + rnd() * (i < 4 ? 50 : 16), a = rnd() * Math.PI * 2, d = rnd() * (i < 4 ? 20 : 100);
			ctx.fillStyle = `rgba(${70 + rnd() * 40},${6 + rnd() * 8},${6 + rnd() * 6},${0.55 + rnd() * 0.35})`;
			ctx.beginPath(); ctx.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, r * (0.5 + rnd() * 0.5), a, 0, Math.PI * 2); ctx.fill();
		}
		const t = toTexture(c);
		t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
		return t;
	});
}

/**
 * Брызги крови на земле: тёмная клякса с рваным краем и капли, вытянутые по ходу полёта (+X),
 * у краёв — тоньше и прозрачнее, как подсохшая кровь.
 */
export function splatterTexture(seed = 0) {
	return memo(`splatter${seed}`, () => {
		const c = canvas(128), ctx = c.getContext('2d');
		const rnd = mulberry(seed * 7 + 3);
		const col = (a) => `rgba(${58 + rnd() * 30},${3 + rnd() * 5},${3 + rnd() * 4},${a})`;
		// клякса: неровный многоугольник из наложенных капель
		for (let i = 0; i < 9; i++) {
			const a = rnd() * Math.PI * 2, d = rnd() * 12, r = 7 + rnd() * 12;
			ctx.fillStyle = col(0.75 + rnd() * 0.2);
			ctx.beginPath(); ctx.ellipse(46 + Math.cos(a) * d, 64 + Math.sin(a) * d, r * 1.3, r, rnd() * 0.6 - 0.3, 0, Math.PI * 2); ctx.fill();
		}
		// капли и потёки по ходу полёта
		for (let i = 0; i < 14; i++) {
			const x = 60 + rnd() * 62, y = 64 + (rnd() - 0.5) * (14 + (x - 60) * 0.7), r = 1 + rnd() * (5 - (x - 60) / 20);
			ctx.fillStyle = col(0.55 + rnd() * 0.4);
			ctx.beginPath(); ctx.ellipse(x, y, r * (1.4 + rnd()), r, 0, 0, Math.PI * 2); ctx.fill();
		}
		ctx.strokeStyle = col(0.7); ctx.lineCap = 'round';
		for (let i = 0; i < 3; i++) { ctx.lineWidth = 2 + rnd() * 3; ctx.beginPath(); ctx.moveTo(56, 64 + (rnd() - 0.5) * 16); ctx.lineTo(80 + rnd() * 30, 64 + (rnd() - 0.5) * 30); ctx.stroke(); }
		const t = toTexture(c);
		t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
		return t;
	});
}

/** Мягкая круглая текстура (тени-пятна, туман, свечение). */
export function softDotTexture(color = '255,255,255') {
	return memo(`dot${color}`, () => {
		const c = canvas(128), ctx = c.getContext('2d');
		const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
		g.addColorStop(0, `rgba(${color},1)`); g.addColorStop(1, `rgba(${color},0)`);
		ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
		const t = toTexture(c);
		t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
		return t;
	});
}

/** Лужа неровной формы с мягким краем (для alphaMap: белое — вода). */
export function puddleTexture(seed = 0) {
	return memo(`puddle${seed}`, () => {
		const c = canvas(128), ctx = c.getContext('2d');
		const rnd = mulberry(seed + 7);
		ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 128);
		for (let i = 0; i < 7; i++) {
			const r = 18 + rnd() * 22, a = rnd() * Math.PI * 2, d = i ? rnd() * 26 : 0;
			const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d;
			const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r);
			g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = g;
			ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
		}
		const t = toTexture(c, { srgb: false });
		t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
		return t;
	});
}

/** Стена мути: вертикальный градиент с клочьями (прокручивается в игре). */
export function fogWallTexture() {
	return memo('fogwall', () => {
		const p = pixels(256, (u, v) => {
			const n = tileFbm(u, v, 4, 5, 131);
			const l = 40 + n * 50;
			return [l, l + 4, l + 2];
		});
		const img = p.ctx.getImageData(0, 0, 256, 256);
		for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
			const n = tileFbm(x / 256, y / 256, 4, 4, 137);
			img.data[(y * 256 + x) * 4 + 3] = clamp(255 * Math.min(1, 0.35 + n * 0.9));
		}
		p.ctx.putImageData(img, 0, 0);
		return toTexture(p.c);
	});
}

export function mulberry(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
