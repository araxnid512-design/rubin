// Простые детерминированные шумы без зависимостей: одинаковый результат в браузере и в Node.

function hash2(x, y, seed) {
	let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hash3(x, y, z, seed) {
	let h = (x * 374761393 + y * 668265263 + z * 1440662683 + seed * 2147483647) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;

/** Бесшовный (тайлящийся) value-noise 2D, u,v в [0,1), period — число ячеек. Результат 0..1. */
export function tileNoise(u, v, period, seed = 0) {
	const x = u * period;
	const y = v * period;
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const fx = fade(x - xi);
	const fy = fade(y - yi);
	const x0 = mod(xi, period), x1 = mod(xi + 1, period);
	const y0 = mod(yi, period), y1 = mod(yi + 1, period);
	return lerp(
		lerp(hash2(x0, y0, seed), hash2(x1, y0, seed), fx),
		lerp(hash2(x0, y1, seed), hash2(x1, y1, seed), fx),
		fy,
	);
}

/** Фрактальный бесшовный шум 2D. */
export function tileFbm(u, v, period, octaves = 4, seed = 0) {
	let sum = 0, amp = 0.5, norm = 0;
	for (let o = 0; o < octaves; o++) {
		sum += tileNoise(u, v, period, seed + o * 31) * amp;
		norm += amp;
		amp *= 0.5;
		period *= 2;
	}
	return sum / norm;
}

/** Value-noise 3D, результат 0..1. */
export function noise3(x, y, z, seed = 0) {
	const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
	const fx = fade(x - xi), fy = fade(y - yi), fz = fade(z - zi);
	const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
	return lerp(
		lerp(lerp(c(0, 0, 0), c(1, 0, 0), fx), lerp(c(0, 1, 0), c(1, 1, 0), fx), fy),
		lerp(lerp(c(0, 0, 1), c(1, 0, 1), fx), lerp(c(0, 1, 1), c(1, 1, 1), fx), fy),
		fz,
	);
}

export function fbm3(x, y, z, octaves = 3, seed = 0) {
	let sum = 0, amp = 0.5, norm = 0, f = 1;
	for (let o = 0; o < octaves; o++) {
		sum += noise3(x * f, y * f, z * f, seed + o * 17) * amp;
		norm += amp;
		amp *= 0.5;
		f *= 2;
	}
	return sum / norm;
}

/** Детерминированный генератор случайных чисел. */
export function rng(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const smoothstep = (a, b, x) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
