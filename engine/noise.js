// Движок «Долг»: процедурный шум (значений, fBm), бесшовные текстуры.
import { RNG } from './math.js';

export class ValueNoise {
  constructor(seed = 1, period = 256) {
    const rng = new RNG(seed);
    this.period = period;
    this.v = new Float32Array(period * period);
    for (let i = 0; i < this.v.length; i++) this.v[i] = rng.f();
  }
  _at(x, y) { const p = this.period; x = ((x % p) + p) % p; y = ((y % p) + p) % p; return this.v[y * p + x]; }
  get(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this._at(xi, yi), b = this._at(xi + 1, yi), c = this._at(xi, yi + 1), d = this._at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(x, y, oct = 4) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += this.get(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }
}

// Бесшовная текстура шума size×size (R8): частота задаётся числом ячеек base на сторону
export function noiseTexture(size, base, seed, oct = 4) {
  const n = new ValueNoise(seed, base * (1 << (oct - 1)) * 2);
  const out = new Uint8Array(size * size);
  // шум с периодом base*2^k на каждой октаве: используем периодичность решётки
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < oct; o++) {
      const cells = base << o;
      const nx = (x / size) * cells, ny = (y / size) * cells;
      s += periodic(n, nx, ny, cells) * amp; norm += amp; amp *= 0.5;
    }
    const v = s / norm;
    out[y * size + x] = Math.max(0, Math.min(255, Math.round(((v - 0.5) * 1.6 + 0.5) * 255)));
  }
  return out;
}

function periodic(n, x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const w = (a, b) => n._at(((a % p) + p) % p + p * 3, ((b % p) + p) % p + p * 5);
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
