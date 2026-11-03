// Движок «Долг»: процедурные звуки на WebAudio (генерируются при запуске — внешние файлы не нужны).
// play(name) — звук интерфейса; playAt(name, pos) — позиционный звук (затухание по расстоянию до слушателя, панорама).
const RATE = 22050;

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; }; }
const gen = (dur, fn) => { const n = Math.floor(dur * RATE), d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = fn(i / RATE, i); return d; };

function shot(dur, body, crack, low, seed) {
  const r = rngf(seed); let lp = 0, lp2 = 0;
  return gen(dur, (t) => { const nz = r(); lp += (nz - lp) * low; lp2 += (lp - lp2) * 0.3; const boom = Math.sin(t * 2 * Math.PI * (90 - t * 120)) * Math.exp(-t * body * 0.7) * 0.6; return (lp2 * 2.2 * Math.exp(-t * body) + Math.exp(-t * crack) * nz * 0.5 + boom) * 0.8; });
}
const tone = (dur, f, decay, amp, f2 = -1) => gen(dur, (t) => Math.sin(t * 2 * Math.PI * (f2 < 0 || t < dur * 0.5 ? f : f2)) * Math.exp(-t * decay) * amp);
function noiseBurst(dur, decay, lowpass, seed) { const r = rngf(seed); let lp = 0; return gen(dur, (t) => { lp += (r() - lp) * lowpass; return lp * Math.exp(-t * decay) * 1.4; }); }
function clank(dur, seed) {
  const r = rngf(seed), hits = [0, dur * 0.45];
  return gen(dur, (t) => { let v = 0; for (const h of hits) { const dt = t - h; if (dt >= 0) v += (Math.sin(dt * 2 * Math.PI * 2300) * 0.4 + Math.sin(dt * 2 * Math.PI * 3400) * 0.3 + r() * 0.3) * Math.exp(-dt * 40); } return v * 0.5; });
}
function bark() { const r = rngf(5); return gen(0.3, (t) => { const f = 420 - t * 700; return (Math.sin(t * 2 * Math.PI * f) * 0.6 + Math.sin(t * 2 * Math.PI * f * 2.1) * 0.3 + r() * 0.4) * Math.sin(Math.min(t / 0.3, 1) * Math.PI) * 0.6; }); }
function growl() { const r = rngf(6); let lp = 0; return gen(0.8, (t) => { lp += (r() - lp) * 0.08; return (lp * 3 + Math.sin(t * 2 * Math.PI * 95) * 0.3) * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 28)) * Math.sin(Math.min(t / 0.8, 1) * Math.PI) * 0.7; }); }
function groan() { const r = rngf(7); let lp = 0; return gen(1, (t) => { lp += (r() - lp) * 0.05; const f = 140 + Math.sin(t * 3) * 25; return (Math.sin(t * 2 * Math.PI * f) * 0.4 + lp * 2) * Math.sin(Math.min(t, 1) * Math.PI) * 0.5; }); }
const creak = () => gen(0.6, (t) => Math.sin(t * 2 * Math.PI * (300 + Math.sin(t * 9) * 120)) * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 60)) * Math.sin(Math.min(t / 0.6, 1) * Math.PI) * 0.25);
const hum = (dur, loop) => gen(dur, (t) => (Math.sin(t * 2 * Math.PI * 50) * 0.5 + Math.sin(t * 2 * Math.PI * 100) * 0.25 + Math.sin(t * 2 * Math.PI * 150) * 0.1) * (loop ? 1 : Math.min(t * 2, 1)) * 0.4);
function stat(dur) { const r = rngf(21); return gen(dur, (t) => (r() * 0.25 * (0.6 + 0.4 * Math.sin(t * 3)) + (Math.abs(r()) < 0.002 ? 0.8 : 0)) * 0.5); }
function wind(dur) {
  const r = rngf(33); let lp = 0, lp2 = 0;
  const d = gen(dur, (t) => { lp += (r() - lp) * 0.02; lp2 += (lp - lp2) * 0.05; return lp2 * 6 * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI / dur * 2)); });
  const n = d.length, fade = Math.floor(0.3 * RATE);
  for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[n - fade + i] * (1 - k); }
  return d;
}
function step(seed) { const r = rngf(seed); let lp = 0; return gen(0.09, (t) => { lp += (r() - lp) * 0.15; return lp * Math.exp(-t * 45) * 1.4; }); }

const DEFS = {
  shot_pistol: () => shot(0.35, 14, 60, 0.35, 1), shot_rifle: () => shot(0.45, 10, 45, 0.3, 2), shot_smg: () => shot(0.3, 15, 55, 0.4, 3),
  shot_mg: () => shot(0.5, 8, 40, 0.25, 4), shot_sniper: () => shot(0.9, 5, 30, 0.22, 5), shot_shotgun: () => shot(0.6, 7, 25, 0.2, 6),
  shot_launcher: () => shot(0.5, 9, 20, 0.12, 7), shot_silenced: () => shot(0.18, 30, 90, 0.6, 8), explosion: () => shot(1.4, 3, 12, 0.08, 9),
  click: () => tone(0.04, 1800, 80, 0.4), reload: () => clank(0.5, 3), pickup: () => clank(0.18, 1), ui: () => tone(0.06, 900, 50, 0.35),
  ui_ok: () => tone(0.15, 660, 18, 0.35, 990), step: () => step(11), hit: () => noiseBurst(0.12, 30, 0.5, 12), impact: () => noiseBurst(0.08, 50, 0.7, 13),
  bark, growl, groan, hammer: () => clank(0.25, 2), door: creak, build_done: () => tone(0.5, 440, 4, 0.3, 660), power_on: () => hum(1.2, false),
  radio: () => stat(1.5), zap: () => noiseBurst(0.35, 8, 0.9, 14), fire: () => noiseBurst(0.6, 3, 0.3, 15),
  amb_wind: () => wind(6), amb_hum: () => hum(2, true), amb_radio: () => stat(3),
};

export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.volume = 1; this.listener = { x: 0, z: 0, rx: 1, rz: 0 }; this.ambient = null; this.ambName = ''; this.genMs = 0;
    this.active = 0;
  }
  // Создаётся по первому жесту пользователя (требование браузеров)
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); const t0 = performance.now();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    for (const [k, f] of Object.entries(DEFS)) { const d = f(); const b = this.ctx.createBuffer(1, d.length, RATE); b.copyToChannel(d, 0); this.buffers[k] = b; }
    this.genMs = Math.round(performance.now() - t0);
    console.log('[Audio] сгенерировано', Object.keys(this.buffers).length, 'звуков за', this.genMs, 'мс');
    if (this._pendingAmb) this.setAmbient(this._pendingAmb);
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setListener(pos, rightVec) { this.listener = { x: pos.x, z: pos.z, rx: rightVec.x, rz: rightVec.z }; }
  _src(name, gain, pitch) {
    if (!this.ctx || !this.buffers[name] || this.volume <= 0 || this.active > 24) return null;
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers[name]; s.playbackRate.value = pitch;
    const g = this.ctx.createGain(); g.gain.value = gain;
    s.connect(g); this.active++; s.onended = () => { this.active--; };
    return { s, g };
  }
  play(name, db = 0, pitch = 1) {
    const n = this._src(name, Math.pow(10, db / 20), pitch); if (!n) return;
    n.g.connect(this.master); n.s.start();
  }
  playAt(name, pos, db = 0, pitch = 1) {
    if (!this.ctx) return;
    const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z, d = Math.hypot(dx, dz);
    if (d > 90) return;
    const att = 1 / (1 + Math.max(0, d - 4) * 0.09);
    const n = this._src(name, Math.pow(10, db / 20) * att, pitch * (0.94 + Math.random() * 0.12)); if (!n) return;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, d > 0.1 ? (dx * this.listener.rx + dz * this.listener.rz) / d * 0.8 : 0));
      n.g.connect(p); p.connect(this.master);
    } else n.g.connect(this.master);
    n.s.start();
  }
  setAmbient(name) {
    if (!this.ctx) { this._pendingAmb = name; return; }
    if (name === this.ambName) return;
    if (this.ambient) { try { this.ambient.s.stop(); } catch (e) { /* уже остановлен */ } this.ambient = null; }
    this.ambName = name; if (!name || !this.buffers[name]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers[name]; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0.16; s.connect(g); g.connect(this.master); s.start();
    this.ambient = { s, g };
  }
}
export const audio = new Audio();
