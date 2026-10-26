'use strict';
/* global THREE */
// =====================================================================
//  Клоны против дроидов — пошаговая тактика на поле 32×32
// =====================================================================
const N = 32;
const $ = id => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

// =====================================================================
//  ЗВУК: синтез эффектов и оркестровый марш
// =====================================================================
const Snd = (() => {
  let ac = null, out, sfx, mus, verbIn, noise;
  let sfxOn = store('cvd-sfx') !== 'off', musOn = store('cvd-mus') !== 'off';
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ac.destination);
    out = ac.createGain(); out.gain.value = 0.9; out.connect(comp);
    sfx = ac.createGain(); sfx.gain.value = sfxOn ? 0.85 : 0; sfx.connect(out);
    mus = ac.createGain(); mus.gain.value = musOn ? 0.38 : 0; mus.connect(out);
    const len = ac.sampleRate * 2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const conv = ac.createConvolver(); conv.buffer = ir; const vg = ac.createGain(); vg.gain.value = 0.32;
    verbIn = ac.createGain(); verbIn.connect(conv); conv.connect(vg); vg.connect(out);
    const nl = ac.sampleRate; noise = ac.createBuffer(1, nl, ac.sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    Music.init(ac, mus, verbIn);
  }
  const now = () => ac.currentTime;
  function envGain(t, a, peak, d, dest, wet = 0) {
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest || sfx); if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbIn); }
    return g;
  }
  function osc(type, f1, f2, t, dur, g) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function nz(t, dur, type, f1, f2, q, g) {
    const s = ac.createBufferSource(); s.buffer = noise; const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t); if (f2 !== f1) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    s.connect(f); f.connect(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const fx = {
    blaster(team, delay = 0) {
      if (!ac) return; const t = now() + delay, hi = team === 'droid';
      osc('sawtooth', hi ? 2300 : 1700, hi ? 260 : 170, t, 0.22, envGain(t, 0.004, 0.32, 0.22, sfx, 0.5));
      osc('square', hi ? 1150 : 850, hi ? 140 : 95, t, 0.18, envGain(t, 0.004, 0.12, 0.16, sfx));
      nz(t, 0.08, 'bandpass', 3000, 1200, 1.5, envGain(t, 0.002, 0.25, 0.07));
    },
    heavy(delay = 0) { for (let i = 0; i < 3; i++) this.blaster('clone', delay + i * 0.11); },
    impact(delay = 0) {
      if (!ac) return; const t = now() + delay;
      nz(t, 0.25, 'lowpass', 4000, 400, 1, envGain(t, 0.003, 0.5, 0.25, sfx, 0.3));
      osc('sine', 180, 60, t, 0.15, envGain(t, 0.003, 0.35, 0.14));
    },
    miss(delay = 0) {
      if (!ac) return; const t = now() + delay;
      osc('sine', 2600, 900, t, 0.25, envGain(t, 0.01, 0.12, 0.24, sfx, 0.4));
      nz(t + 0.05, 0.15, 'highpass', 3000, 3000, 0.7, envGain(t + 0.05, 0.003, 0.2, 0.14));
    },
    explosion() {
      if (!ac) return; const t = now();
      nz(t, 1.4, 'lowpass', 2400, 90, 0.8, envGain(t, 0.005, 1.0, 1.4, sfx, 0.6));
      osc('sine', 110, 32, t, 0.9, envGain(t, 0.005, 0.9, 0.9));
      nz(t, 0.3, 'highpass', 2000, 2000, 0.5, envGain(t, 0.002, 0.3, 0.25));
    },
    step(team) {
      if (!ac) return; const t = now();
      if (team === 'droid') { osc('square', 900, 700, t, 0.03, envGain(t, 0.001, 0.035, 0.04)); nz(t, 0.04, 'highpass', 5000, 5000, 1, envGain(t, 0.001, 0.05, 0.035)); }
      else nz(t, 0.08, 'lowpass', 700, 300, 1, envGain(t, 0.002, 0.12, 0.07));
    },
    click() { if (!ac) return; const t = now(); osc('sine', 1400, 1800, t, 0.05, envGain(t, 0.002, 0.08, 0.05)); },
    select() { if (!ac) return; const t = now(); osc('triangle', 660, 660, t, 0.07, envGain(t, 0.003, 0.1, 0.07)); osc('triangle', 990, 990, t + 0.07, 0.09, envGain(t + 0.07, 0.003, 0.1, 0.09)); },
    deny() { if (!ac) return; const t = now(); osc('square', 180, 150, t, 0.16, envGain(t, 0.003, 0.08, 0.16)); },
    overwatch() { if (!ac) return; const t = now(); [880, 1175, 1568].forEach((f, i) => osc('sine', f, f, t + i * 0.07, 0.12, envGain(t + i * 0.07, 0.004, 0.09, 0.12, sfx, 0.3))); },
    hunker() { if (!ac) return; const t = now(); nz(t, 0.3, 'bandpass', 300, 900, 2, envGain(t, 0.05, 0.2, 0.25)); },
    turn(team) {
      if (!ac) return; const t = now(), base = team === 'clone' ? 293.66 : 220;
      [0, 7, 12].forEach((s, i) => {
        const f = base * Math.pow(2, s / 12), g = envGain(t + i * 0.12, 0.05, 0.13, 0.9, sfx, 0.5);
        osc('sawtooth', f, f, t + i * 0.12, 1, g); osc('sawtooth', f * 1.005, f * 1.005, t + i * 0.12, 1, g);
      });
    },
    alert() { if (!ac) return; const t = now(); for (let i = 0; i < 3; i++) osc('square', 740, 740, t + i * 0.16, 0.09, envGain(t + i * 0.16, 0.003, 0.08, 0.09)); },
    droidDeath() {
      if (!ac) return; const t = now();
      for (let i = 0; i < 5; i++) { const tt = t + i * 0.07 + Math.random() * 0.04; osc('square', rand(400, 1200), rand(200, 500), tt, 0.06, envGain(tt, 0.001, 0.06, 0.06)); }
      nz(t, 0.6, 'bandpass', 6000, 800, 3, envGain(t, 0.005, 0.18, 0.6, sfx, 0.3));
      osc('sawtooth', 300, 40, t, 0.7, envGain(t, 0.01, 0.1, 0.7));
    },
    cloneDown() { if (!ac) return; const t = now(); nz(t, 0.3, 'lowpass', 500, 120, 1, envGain(t, 0.01, 0.35, 0.3)); osc('sine', 120, 50, t, 0.3, envGain(t, 0.005, 0.25, 0.3)); },
    throwNade() { if (!ac) return; const t = now(); nz(t, 0.25, 'bandpass', 600, 2000, 1.5, envGain(t, 0.02, 0.15, 0.22)); for (let i = 0; i < 4; i++) osc('sine', 2000, 2000, t + 0.2 + i * 0.16, 0.05, envGain(t + 0.2 + i * 0.16, 0.002, 0.07, 0.05)); },
    win() { if (!ac) return; const t = now(); [293.66, 349.23, 440, 587.33].forEach((f, i) => { const g = envGain(t + i * 0.18, 0.04, 0.16, 1.4, sfx, 0.6); osc('sawtooth', f, f, t + i * 0.18, 1.5, g); osc('triangle', f / 2, f / 2, t + i * 0.18, 1.5, g); }); },
    lose() { if (!ac) return; const t = now(); [293.66, 277.18, 261.63, 220].forEach((f, i) => { const g = envGain(t + i * 0.32, 0.05, 0.14, 1.2, sfx, 0.6); osc('sawtooth', f, f * 0.98, t + i * 0.32, 1.3, g); }); },
    roger() {
      if (!ac) return;
      // «Роджер-роджер»: пила через формантные фильтры
      const t0 = now();
      const syl = (t, f0, f1a, f1b, f2a, f2b, d) => {
        const g = envGain(t, 0.02, 0.22, d, sfx, 0.25);
        const s = ac.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f0, t); s.frequency.linearRampToValueAtTime(f0 * 0.92, t + d);
        for (const [fa, fb] of [[f1a, f1b], [f2a, f2b]]) {
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(fa, t); bp.frequency.linearRampToValueAtTime(fb, t + d);
          s.connect(bp); bp.connect(g);
        }
        s.start(t); s.stop(t + d + 0.05);
      };
      for (let k = 0; k < 2; k++) { const t = t0 + k * 0.42; syl(t, 210, 520, 650, 900, 1100, 0.14); syl(t + 0.16, 190, 450, 380, 1700, 1900, 0.18); }
    },
  };
  function setSfx(on) { sfxOn = on; store('cvd-sfx', on ? 'on' : 'off'); if (sfx) sfx.gain.value = on ? 0.85 : 0; }
  function setMus(on) { musOn = on; store('cvd-mus', on ? 'on' : 'off'); if (mus) mus.gain.value = on ? 0.38 : 0; }
  return { init, fx, setSfx, setMus, get sfxOn() { return sfxOn; }, get musOn() { return musOn; }, get ctx() { return ac; } };
})();

// Оригинальный военный марш ре минор: струнное остинато, медь, литавры, малый барабан
const Music = (() => {
  let ac, out, verb, layers = {}, timer = null, step = 0, next = 0, intensity = 0.5;
  const BPM = 96, SD = 60 / BPM / 2;
  const CH = [[38, 3], [34, 4], [31, 3], [33, 4], [38, 3], [29, 4], [31, 3], [33, 4]];
  const MEL = [[0, 62, 4], [4, 65, 2], [6, 69, 2], [8, 70, 6], [14, 69, 2], [16, 67, 4], [20, 65, 2], [22, 62, 2], [24, 64, 4], [28, 61, 2], [30, 64, 2],
    [32, 69, 4], [36, 74, 2], [38, 72, 2], [40, 72, 6], [46, 69, 2], [48, 70, 4], [52, 67, 2], [54, 70, 2], [56, 69, 8]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function init(ctx, dest, v) {
    ac = ctx; out = dest; verb = v;
    for (const k of ['str', 'brass', 'drums', 'pad']) { layers[k] = ac.createGain(); layers[k].connect(out); }
    const w = ac.createGain(); w.gain.value = 0.5; layers.brass.connect(w); layers.pad.connect(w); w.connect(verb);
    setIntensity(intensity);
  }
  function setIntensity(v) {
    intensity = v; if (!ac) return; const t = ac.currentTime;
    layers.drums.gain.setTargetAtTime(0.5 + v * 0.6, t, 0.5); layers.brass.gain.setTargetAtTime(0.45 + v * 0.4, t, 0.5);
    layers.str.gain.setTargetAtTime(0.55 + v * 0.3, t, 0.5); layers.pad.gain.setTargetAtTime(0.7 - v * 0.4, t, 0.5);
  }
  function env(t, a, p, d, dest) { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p, t + a); g.gain.setValueAtTime(p, t + a + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dest); return g; }
  function voice(type, f, t, dur, g, cutoff, det = 0) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.Q.value = 0.8; lp.connect(g);
    for (const d of det ? [-det, det] : [0]) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
  }
  function drum(t, f0, f1, dec, vol) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dec); const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(g); g.connect(layers.drums); o.start(t); o.stop(t + dec + 0.05); }
  function snare(t, vol) {
    const len = ac.sampleRate * 0.2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
    const g = ac.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(layers.drums); s.start(t);
  }
  function play(i, t) {
    const k = i % 64, bar = Math.floor(k / 8), s8 = k % 8, [root, third] = CH[bar];
    // остинато струнных
    const pat = [0, 0, 7, 0, 12, 0, 7, third];
    voice('sawtooth', mtof(root + 12 + pat[s8]), t, SD * 0.8, env(t, 0.01, 0.09, SD * 0.8, layers.str), 1400, 6);
    if (s8 === 0) voice('sawtooth', mtof(root), t, SD * 7, env(t, 0.03, 0.11, SD * 7.5, layers.str), 500, 4);
    // медь (каждый второй проход)
    if (Math.floor(i / 64) % 2 === 1) for (const [st, m, len] of MEL) if (st === k) {
      voice('sawtooth', mtof(m), t, SD * len, env(t, 0.06, 0.1, SD * len * 0.95, layers.brass), 1800, 8);
      voice('square', mtof(m - 12), t, SD * len, env(t, 0.06, 0.04, SD * len * 0.95, layers.brass), 900);
    }
    // пэд
    if (s8 === 0) for (const iv of [0, third, 7]) voice('triangle', mtof(root + 24 + iv), t, SD * 8, env(t, 0.6, 0.035, SD * 8, layers.pad), 2000, 10);
    // ударные
    if (s8 === 0) drum(t, 110, 42, 0.5, 0.75);
    if (s8 === 4) drum(t, 100, 40, 0.4, 0.45);
    if ((bar === 3 || bar === 7) && s8 >= 5) drum(t, 120, 50, 0.2, 0.35);
    if (s8 === 2 || s8 === 6) snare(t, 0.32);
    if (s8 === 7 && bar % 2) snare(t, 0.12);
  }
  function start() {
    if (!ac || timer) return; next = ac.currentTime + 0.1;
    timer = setInterval(() => { while (next < ac.currentTime + 0.2) { play(step++, next); next += SD; } }, 40);
  }
  function stop() { clearInterval(timer); timer = null; }
  return { init, start, stop, setIntensity };
})();

// =====================================================================
//  КАРТА
// =====================================================================
const FLOOR = 0, HALF = 1, FULL = 2;
// виды объектов
const K = { NONE: 0, ROCK_S: 1, CRATE: 2, BARRIER: 3, ROCK_L: 4, WALL: 5, CONTAINER: 6, HULL: 7, EDGE: 8, PILLAR: 9, TOWER: 10 };
let grid, kind;
const id = (x, z) => z * N + x;
const inb = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
const cell = (x, z) => inb(x, z) ? grid[id(x, z)] : FULL;

const CLONE_SPAWN = [[3, 27], [5, 28], [4, 29], [6, 26], [2, 29]];
const PODS = [
  { tiles: [[15, 17], [17, 16], [16, 14]], types: ['b1', 'b1', 'b1'] },
  { tiles: [[26, 21], [27, 19], [25, 23]], types: ['b2', 'b1', 'b1'] },
  { tiles: [[24, 6], [26, 5], [22, 4]], types: ['cmd', 'b2', 'b1'] },
];

function genMap(seed) {
  const R = rng(seed);
  grid = new Uint8Array(N * N); kind = new Uint8Array(N * N);
  const set = (x, z, c, k) => { if (inb(x, z)) { grid[id(x, z)] = c; kind[id(x, z)] = k; } };
  const free = (x, z) => inb(x, z) && grid[id(x, z)] === FLOOR;
  const nearSpawn = (x, z, r) => CLONE_SPAWN.concat(...PODS.map(p => p.tiles)).some(([a, b]) => Math.abs(a - x) <= r && Math.abs(b - z) <= r);
  // граница каньона
  for (let i = 0; i < N; i++) { set(i, 0, FULL, K.EDGE); set(i, N - 1, FULL, K.EDGE); set(0, i, FULL, K.EDGE); set(N - 1, i, FULL, K.EDGE); }
  // выступы стен каньона
  for (let i = 0; i < 26; i++) {
    const side = Math.floor(R() * 4), p = 2 + Math.floor(R() * (N - 4)), d = 1 + Math.floor(R() * 2);
    for (let k = 1; k <= d; k++) { const [x, z] = [[p, k], [p, N - 1 - k], [k, p], [N - 1 - k, p]][side]; if (!nearSpawn(x, z, 2)) set(x, z, FULL, K.EDGE); }
  }
  // аванпост сепаратистов в центре
  for (let x = 13; x <= 19; x++) for (const z of [12, 19]) if (x !== 16) set(x, z, FULL, K.WALL);
  for (let z = 12; z <= 19; z++) for (const x of [13, 19]) if (z !== 15 && z !== 16) set(x, z, FULL, K.WALL);
  set(15, 15, HALF, K.CRATE); set(17, 18, HALF, K.CRATE); set(14, 13, FULL, K.PILLAR); set(18, 13, FULL, K.TOWER);
  set(16, 20, HALF, K.BARRIER); set(16, 11, HALF, K.BARRIER); set(12, 15, HALF, K.BARRIER); set(20, 16, HALF, K.BARRIER);
  // обломки республиканской канонерки
  for (let x = 7; x <= 11; x++) set(x, 20, FULL, K.HULL);
  set(8, 21, HALF, K.ROCK_S); set(10, 19, HALF, K.CRATE); set(12, 21, HALF, K.ROCK_S);
  // скальные массивы
  for (let i = 0; i < 9; i++) {
    const cx = 3 + Math.floor(R() * (N - 6)), cz = 3 + Math.floor(R() * (N - 6));
    if (nearSpawn(cx, cz, 3) || (cx > 10 && cx < 22 && cz > 9 && cz < 22)) continue;
    const r = 1 + R() * 1.4;
    for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) {
      const d = Math.hypot(x - cx, z - cz) + R() * 0.6;
      if (!free(x, z) || nearSpawn(x, z, 1)) continue;
      if (d < r) set(x, z, FULL, K.ROCK_L); else if (d < r + 0.9 && R() < 0.45) set(x, z, HALF, K.ROCK_S);
    }
  }
  // контейнеры
  for (let i = 0; i < 6; i++) {
    const x = 3 + Math.floor(R() * (N - 7)), z = 3 + Math.floor(R() * (N - 7)), hor = R() < 0.5;
    const t2 = hor ? [x + 1, z] : [x, z + 1];
    if (free(x, z) && free(...t2) && !nearSpawn(x, z, 2) && !(x > 11 && x < 21 && z > 10 && z < 21)) { set(x, z, FULL, K.CONTAINER); set(t2[0], t2[1], FULL, K.CONTAINER); }
  }
  // ящики и баррикады
  for (let i = 0; i < 34; i++) {
    const x = 2 + Math.floor(R() * (N - 4)), z = 2 + Math.floor(R() * (N - 4));
    if (!free(x, z) || nearSpawn(x, z, 1)) continue;
    const r = R();
    if (r < 0.45) set(x, z, HALF, K.CRATE);
    else if (r < 0.75) { const hor = R() < 0.5; for (let k = 0; k < 2 + Math.floor(R() * 2); k++) { const xx = hor ? x + k : x, zz = hor ? z : z + k; if (free(xx, zz) && !nearSpawn(xx, zz, 1)) set(xx, zz, HALF, K.BARRIER); } }
    else set(x, z, HALF, K.ROCK_S);
  }
  // укрытия у точки высадки клонов
  set(5, 25, HALF, K.CRATE); set(7, 27, HALF, K.BARRIER); set(7, 28, HALF, K.BARRIER); set(2, 25, HALF, K.ROCK_S);
  // связность: всё недостижимое от клонов — скала
  const seen = new Uint8Array(N * N), q = [CLONE_SPAWN[0]]; seen[id(...CLONE_SPAWN[0])] = 1;
  while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (free(nx, nz) && !seen[id(nx, nz)]) { seen[id(nx, nz)] = 1; q.push([nx, nz]); } } }
  for (const [x, z] of CLONE_SPAWN.concat(...PODS.map(p => p.tiles))) if (!seen[id(x, z)]) return false;
  for (let i = 0; i < N * N; i++) if (grid[i] === FLOOR && !seen[i]) { grid[i] = FULL; kind[i] = K.ROCK_L; }
  return true;
}

// =====================================================================
//  ТРЁХМЕРНАЯ СЦЕНА
// =====================================================================
THREE.ColorManagement.legacyMode = false; // цвета в sRGB, как задумано
const view = $('view');
const lowEnd = isTouch && (navigator.hardwareConcurrency || 4) <= 4;
const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 260);
const SKY_H = '#f2b98a', SKY_T = '#7aa3c9';
scene.fog = new THREE.Fog(0xe7ab7c, 34, 120);
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, SKY_T); gr.addColorStop(0.55, '#e9b48c'); gr.addColorStop(1, SKY_H);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; scene.background = t;
}
const hemi = new THREE.HemisphereLight(0xffe7c7, 0x7a3e22, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd7a8, 2.6);
sun.position.set(N / 2 - 16, 26, N / 2 + 12); sun.target.position.set(N / 2, 0, N / 2);
sun.castShadow = true; sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0x8fb6ff, 0.35); fill.position.set(N / 2 + 20, 14, N / 2 - 18); scene.add(fill);
// постоянный пул точечных огней (без перекомпиляции шейдеров)
const flashLights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffffff, 0, 6, 2); scene.add(l); return l; });

const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.65, metalness: 0.08 }, o));
const MAT = {
  armor: mat(0xeef1f4, { roughness: 0.32 }), under: mat(0x1d2026, { roughness: 0.75 }), visor: mat(0x0c0d10, { roughness: 0.15, metalness: 0.5 }),
  gun: mat(0x24272d, { roughness: 0.45, metalness: 0.5 }), gunL: mat(0x5b6069, { roughness: 0.4, metalness: 0.6 }),
  tan: mat(0xc7ad7c, { roughness: 0.55, metalness: 0.25 }), tanD: mat(0x8c7550, { roughness: 0.6, metalness: 0.25 }),
  b2: mat(0x5d6878, { roughness: 0.35, metalness: 0.65 }), b2D: mat(0x323844, { roughness: 0.45, metalness: 0.6 }),
  eye: new THREE.MeshBasicMaterial({ color: 0x1a0d05 }), red: new THREE.MeshBasicMaterial({ color: 0xff5040 }),
};
const STRIPE = { blue: mat(0x2f6fdc, { roughness: 0.4 }), orange: mat(0xe07b22, { roughness: 0.4 }), red: mat(0xc8302a, { roughness: 0.4 }), green: mat(0x4c8a3c, { roughness: 0.4 }), yellow: mat(0xe2b53b, { roughness: 0.4 }) };

function mesh(geo, m, cast = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; return o; }
const box = (w, h, d, m) => mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, s = 10) => mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);
const sph = (r, m, w = 14, h = 10) => mesh(new THREE.SphereGeometry(r, w, h), m);
function at(o, x, y, z, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---------- земля: процедурная текстура песка с сеткой
function groundTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rng(77);
  g.fillStyle = '#c98652'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { const x = R() * S, y = R() * S, r = 20 + R() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); const c1 = R() < 0.5 ? 'rgba(150,80,40,.18)' : 'rgba(235,170,110,.16)'; gr.addColorStop(0, c1); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const id2 = g.getImageData(0, 0, S, S), d = id2.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 22; d[i] += n; d[i + 1] += n * 0.8; d[i + 2] += n * 0.6; }
  g.putImageData(id2, 0, 0);
  for (let i = 0; i < 1400; i++) { g.fillStyle = R() < 0.5 ? 'rgba(110,60,30,.45)' : 'rgba(240,200,150,.4)'; const s = 1 + R() * 2.5; g.fillRect(R() * S, R() * S, s, s); }
  g.strokeStyle = 'rgba(120,60,30,.25)'; g.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) { let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  const t = S / N; g.strokeStyle = 'rgba(70,35,15,.22)'; g.lineWidth = 1.5;
  for (let i = 0; i <= N; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; return tex;
}
const world = new THREE.Group(); scene.add(world);
{
  const g = mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }), false);
  g.rotation.x = -Math.PI / 2; g.position.set(N / 2, 0, N / 2); world.add(g);
  const outer = mesh(new THREE.PlaneGeometry(400, 400), mat(0xc98652, { roughness: 1 }), false);
  outer.rotation.x = -Math.PI / 2; outer.position.set(N / 2, -0.02, N / 2); world.add(outer);
}

// ---------- слияние статичной геометрии в один меш с цветами вершин
function merged(parts, m) {
  let total = 0; const prepared = parts.map(p => { const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); g.applyMatrix4(p.mtx); g.computeVertexNormals(); total += g.attributes.position.count; return [g, p.color]; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  for (const [g, c] of prepared) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < g.attributes.position.count; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += g.attributes.position.count; g.dispose();
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return mesh(bg, m);
}
function rockGeo(R, detail = 1) {
  // одинаковый сдвиг для совпадающих вершин — без щелей между гранями
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
    let k = seen.get(key); if (k === undefined) { k = 0.75 + R() * 0.45; seen.set(key, k); }
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals(); return g;
}
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => { tmpE.set(rx, ry, rz); tmpQ.setFromEuler(tmpE); tmpP.set(x, y, z); tmpS.set(sx, sy, sz); return new THREE.Matrix4().compose(tmpP, tmpQ, tmpS); };
const C = h => new THREE.Color(h);

let staticMesh = null, glowMesh = null;
const halfProps = new Map(); // id -> Object3D (разрушаемые укрытия)
const smokeSources = [];
function buildProps() {
  const R = rng(1337), parts = [], glow = [];
  const rockCols = [0xa45f37, 0x8f4f2d, 0xb36c40, 0x9a5733];
  const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
  const add = (geo, x, y, z, rx, ry, rz, sx, sy, sz, color) => parts.push({ geo, mtx: M4(x, y, z, rx, ry, rz, sx, sy, sz), color: C(color) });
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = kind[id(x, z)], cx = x + 0.5, cz = z + 0.5;
    if (k === K.EDGE || k === K.ROCK_L) {
      const h = k === K.EDGE ? 1.5 + R() * 1.4 : 1.2 + R() * 0.9, col = rockCols[Math.floor(R() * 4)];
      add(rockGeo(R, 1), cx + (R() - 0.5) * 0.2, h * 0.42, cz + (R() - 0.5) * 0.2, R(), R() * 6, R() * 0.3, 0.62, h * 0.55, 0.62, col);
      if (R() < 0.6) add(rockGeo(R, 0), cx + (R() - 0.5) * 0.5, 0.25, cz + (R() - 0.5) * 0.5, R(), R() * 6, 0, 0.42, 0.3, 0.42, rockCols[Math.floor(R() * 4)]);
      if (k === K.EDGE && R() < 0.2) add(rockGeo(R, 0), cx, h * 0.9, cz, R(), R() * 6, 0, 0.35, 0.6, 0.35, 0x7d4126);
    } else if (k === K.WALL) {
      add(BOX, cx, 0.85, cz, 0, 0, 0, 1, 1.7, 1, 0x646c78);
      add(BOX, cx, 1.74, cz, 0, 0, 0, 1.04, 0.1, 1.04, 0x3c424c);
      add(BOX, cx, 0.12, cz, 0, 0, 0, 1.04, 0.24, 1.04, 0x3c424c);
      for (const s of [-1, 1]) { add(BOX, cx, 0.9, cz + s * 0.505, 0, 0, 0, 0.08, 1.3, 0.02, 0x4a5059); add(BOX, cx + s * 0.505, 0.9, cz, 0, 0, 0, 0.02, 1.3, 0.08, 0x4a5059); }
      if (R() < 0.3) glow.push({ geo: BOX, mtx: M4(cx, 1.45, cz + 0.51, 0, 0, 0, 0.5, 0.05, 0.02), color: C(0x67b8ff) });
    } else if (k === K.CONTAINER) {
      const col = R() < 0.5 ? 0x7b4a35 : 0x55606b;
      add(BOX, cx, 0.65, cz, 0, 0, 0, 0.98, 1.3, 0.98, col);
      for (let i = -2; i <= 2; i++) { add(BOX, cx + i * 0.2, 0.65, cz + 0.5, 0, 0, 0, 0.05, 1.25, 0.03, 0x2e2622); add(BOX, cx + i * 0.2, 0.65, cz - 0.5, 0, 0, 0, 0.05, 1.25, 0.03, 0x2e2622); }
      add(BOX, cx, 1.31, cz, 0, 0, 0, 1, 0.04, 1, 0x3a2e28);
    } else if (k === K.HULL) {
      add(CYL, cx, 0.62, cz, 0, 0, Math.PI / 2, 0.78, 1.02, 0.78, 0x6f7d5d);
      add(CYL, cx, 0.62, cz, 0, 0, Math.PI / 2, 0.8, 0.12, 0.8, 0x4c573f);
      add(BOX, cx, 1.15 + R() * 0.2, cz + (R() - 0.5) * 0.4, R() * 0.4, 0, R() * 0.3, 0.6, 0.06, 0.5, 0x8a3a2c);
      if (x === 7) add(new THREE.ConeGeometry(1, 1, 12), cx - 0.6, 0.62, cz, 0, 0, Math.PI / 2, 0.78, 0.9, 0.78, 0x6f7d5d);
      if (x === 11) { add(BOX, cx + 0.3, 1.3, cz - 0.6, 0.3, 0.4, 0.2, 1.6, 0.08, 0.9, 0x5c6a4c); smokeSources.push([cx + 0.4, 1.1, cz]); }
      if (x === 9) smokeSources.push([cx, 1.2, cz]);
    } else if (k === K.PILLAR) {
      add(CYL8, cx, 1.1, cz, 0, 0, 0, 0.36, 2.2, 0.36, 0x6b727e); add(CYL8, cx, 2.25, cz, 0, 0, 0, 0.46, 0.15, 0.46, 0x3c424c);
      glow.push({ geo: CYL8, mtx: M4(cx, 1.5, cz, 0, 0, 0, 0.37, 0.08, 0.37), color: C(0xff6a3d) });
    } else if (k === K.TOWER) {
      add(CYL8, cx, 1.6, cz, 0, 0, 0, 0.18, 3.2, 0.18, 0x4c535e); add(new THREE.SphereGeometry(1, 12, 8), cx, 3.25, cz, 0, 0, 0, 0.45, 0.25, 0.45, 0x6b727e);
      add(CYL8, cx, 0.2, cz, 0, 0, 0, 0.45, 0.4, 0.45, 0x3c424c);
      glow.push({ geo: new THREE.SphereGeometry(1, 10, 8), mtx: M4(cx, 3.42, cz, 0, 0, 0, 0.1, 0.1, 0.1), color: C(0xff3b30) });
    }
  }
  // вершины плато вне поля
  for (let i = 0; i < 60; i++) {
    const a = R() * Math.PI * 2, r = 24 + R() * 40, x = N / 2 + Math.cos(a) * r, z = N / 2 + Math.sin(a) * r, h = 5 + R() * 16;
    add(new THREE.CylinderGeometry(1, 1.25, 1, 9, 3), x, h / 2, z, 0, R() * 6, 0, 1.5 + R() * 3.5, h, 1.5 + R() * 3.5, rockCols[i % 4]);
    if (R() < 0.5) add(rockGeo(R, 0), x, h, z, 0, R() * 6, 0, 2 + R() * 2, 1, 2 + R() * 2, 0x8f4f2d);
  }
  staticMesh = merged(parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1, flatShading: true }));
  world.add(staticMesh);
  if (glow.length) { glowMesh = merged(glow, new THREE.MeshBasicMaterial({ vertexColors: true })); glowMesh.castShadow = false; world.add(glowMesh); }
  // разрушаемые полуукрытия — отдельные объекты
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = kind[id(x, z)], cx = x + 0.5, cz = z + 0.5; let o = null;
    if (k === K.ROCK_S) { o = mesh(rockGeo(R, 0), new THREE.MeshStandardMaterial({ color: rockCols[Math.floor(R() * 4)], roughness: 0.9, flatShading: true })); at(o, cx, 0.3, cz, R(), R() * 6, 0); o.scale.set(0.46, 0.38, 0.46); }
    else if (k === K.CRATE) {
      o = new THREE.Group(); const base = R() < 0.5 ? 0x6f7987 : 0x8a7d62;
      o.add(at(box(0.78, 0.58, 0.78, mat(base, { metalness: 0.4, roughness: 0.5 })), 0, 0.29, 0));
      o.add(at(box(0.82, 0.08, 0.82, mat(0x3a3f47, { metalness: 0.5 })), 0, 0.58, 0));
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.01), new THREE.MeshBasicMaterial({ color: 0xffa13d })); st.position.set(0, 0.35, 0.395); o.add(st);
      at(o, cx, 0, cz, 0, Math.floor(R() * 4) * Math.PI / 2 + (R() - 0.5) * 0.2, 0);
    } else if (k === K.BARRIER) {
      o = new THREE.Group(); const hor = kind[id(x - 1, z)] === K.BARRIER || kind[id(x + 1, z)] === K.BARRIER;
      o.add(at(box(1.0, 0.6, 0.26, mat(0x5a626e, { metalness: 0.55, roughness: 0.4 })), 0, 0.3, 0));
      o.add(at(box(1.0, 0.1, 0.32, mat(0x2f343c, { metalness: 0.5 })), 0, 0.05, 0));
      for (const s of [-0.3, 0.3]) o.add(at(box(0.08, 0.5, 0.28, mat(0xc0402e)), s, 0.3, 0));
      at(o, cx, 0, cz, 0, hor ? 0 : Math.PI / 2, 0);
    }
    if (o) { world.add(o); halfProps.set(id(x, z), o); }
  }
}
function destroyCover(x, z) {
  if (!inb(x, z) || grid[id(x, z)] !== HALF) return;
  const o = halfProps.get(id(x, z)); if (o) { world.remove(o); halfProps.delete(id(x, z)); }
  grid[id(x, z)] = FLOOR; kind[id(x, z)] = K.NONE;
  for (let i = 0; i < 10; i++) FX.debris(x + 0.5, 0.4, z + 0.5);
}

// =====================================================================
//  ЭФФЕКТЫ: заряды бластеров, искры, дым, взрывы
// =====================================================================
function glowTex(r = 255, g = 255, b = 255) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.35, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const TEX = { glow: glowTex(), smoke: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(0.6, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() };
const TEAMCOL = { clone: 0x4fb4ff, droid: 0xff3b2a };

const FX = (() => {
  const live = [];
  // искры: общий Points
  const MAXP = 400, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP);
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, map: TEX.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; scene.add(points); let pi = 0;
  for (let i = 0; i < MAXP; i++) pPos[i * 3 + 1] = -99;
  function spark(x, y, z, col, n = 14, sp = 3) {
    const c = new THREE.Color(col);
    for (let k = 0; k < n; k++) {
      const i = pi++ % MAXP; pPos.set([x, y, z], i * 3); pCol.set([c.r, c.g, c.b], i * 3);
      pVel.set([rand(-1, 1) * sp, rand(0.2, 1.2) * sp, rand(-1, 1) * sp], i * 3); pLife[i] = rand(0.3, 0.8);
    }
  }
  function debris(x, y, z) { spark(x, y, z, 0xb07040, 3, 2.5); }
  const sprites = [];
  function sprite(tex, color, blend) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending })); scene.add(s); return s; }
  function puff(x, y, z, opts = {}) {
    const s = sprite(TEX.smoke, opts.color || 0x6e5a4c, false); s.position.set(x, y, z);
    const o = { s, t: 0, life: opts.life || 2.2, s0: opts.s0 || 0.4, s1: opts.s1 || 1.6, vy: opts.vy || 0.6, vx: opts.vx || rand(-0.2, 0.2), vz: opts.vz || rand(-0.2, 0.2), a: opts.a || 0.55 };
    s.scale.setScalar(o.s0); s.material.opacity = 0; sprites.push(o);
  }
  function flash(x, y, z, color, scale = 0.6, life = 0.12) {
    const s = sprite(TEX.glow, color, true); s.position.set(x, y, z); s.scale.setScalar(scale);
    sprites.push({ s, t: 0, life, s0: scale, s1: scale * 1.4, vy: 0, vx: 0, vz: 0, a: 1, flash: true });
    const l = flashLights.reduce((a, b) => a.intensity <= b.intensity ? a : b); l.color.set(color); l.position.set(x, y, z); l.intensity = 3.2; l.distance = 5;
  }
  // заряд бластера
  const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.7, 6), glowGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.8, 8);
  boltGeo.rotateX(Math.PI / 2); glowGeo.rotateX(Math.PI / 2);
  function bolt(from, to, team, speed = 38) {
    return new Promise(res => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })));
      g.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: TEAMCOL[team], transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })));
      g.position.copy(from); g.lookAt(to); scene.add(g);
      const dist = from.distanceTo(to); live.push({ g, from: from.clone(), to: to.clone(), t: 0, dur: Math.max(0.06, dist / speed), res, team });
    });
  }
  const rings = [];
  function explosion(x, z) {
    flash(x, 0.8, z, 0xffb050, 3.2, 0.35);
    for (let i = 0; i < 14; i++) puff(x + rand(-0.6, 0.6), rand(0.3, 1.2), z + rand(-0.6, 0.6), { color: i < 5 ? 0xffa040 : 0x4a3b33, life: rand(1.2, 2.6), s0: 0.6, s1: rand(2, 3.4), vy: rand(0.6, 1.8), vx: rand(-1, 1), vz: rand(-1, 1), a: i < 5 ? 0.9 : 0.7 });
    spark(x, 0.5, z, 0xffc070, 60, 6);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z); scene.add(ring); rings.push({ m: ring, t: 0 });
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i]; b.t += dt; const k = Math.min(1, b.t / b.dur);
      b.g.position.lerpVectors(b.from, b.to, k);
      if (k >= 1) { scene.remove(b.g); live.splice(i, 1); b.res(); }
    }
    for (let i = 0; i < MAXP; i++) if (pLife[i] > 0) {
      pLife[i] -= dt; pVel[i * 3 + 1] -= 9 * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pPos[i * 3 + 1] < 0.02) { pPos[i * 3 + 1] = 0.02; pVel[i * 3 + 1] *= -0.35; pVel[i * 3] *= 0.6; pVel[i * 3 + 2] *= 0.6; }
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -99;
    }
    pGeo.attributes.position.needsUpdate = true;
    for (let i = sprites.length - 1; i >= 0; i--) {
      const o = sprites[i]; o.t += dt; const k = o.t / o.life;
      if (k >= 1) { scene.remove(o.s); o.s.material.dispose(); sprites.splice(i, 1); continue; }
      o.s.position.x += o.vx * dt; o.s.position.y += o.vy * dt; o.s.position.z += o.vz * dt;
      o.s.scale.setScalar(lerp(o.s0, o.s1, easeOut(k)));
      o.s.material.opacity = o.flash ? o.a * (1 - k) : o.a * Math.min(1, k * 6) * (1 - k);
    }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const s = 0.5 + r.t * 9; r.m.scale.setScalar(s); r.m.material.opacity = 0.8 * (1 - r.t / 0.45); if (r.t > 0.45) { scene.remove(r.m); rings.splice(i, 1); } }
    for (const l of flashLights) l.intensity = Math.max(0, l.intensity - dt * 22);
  }
  return { spark, debris, puff, flash, bolt, explosion, update };
})();

// =====================================================================
//  МОДЕЛИ ЮНИТОВ
// =====================================================================
// Модели построены лицом к +Z; рост ≈ 1.8 «человеческих» единиц, масштаб 0.52
function buildClone(cls) {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0), s = STRIPE[{ trooper: 'blue', heavy: 'red', sniper: 'green', commander: 'orange' }[cls]];
  const rig = { root, body };
  const hips = rig.hips = pivot(body, 0, 0.95, 0);
  hips.add(at(box(0.32, 0.16, 0.2, MAT.under), 0, 0, 0));
  hips.add(at(box(0.3, 0.1, 0.06, MAT.armor), 0, 0.02, 0.11));
  for (const side of [-1, 1]) {
    const hip = pivot(hips, side * 0.1, -0.06, 0), knee = pivot(hip, 0, -0.42, 0);
    hip.add(at(box(0.14, 0.4, 0.16, MAT.armor), 0, -0.2, 0.01));
    knee.add(at(sph(0.065, MAT.under, 8, 6), 0, 0, 0));
    knee.add(at(box(0.13, 0.4, 0.15, MAT.armor), 0, -0.21, 0));
    knee.add(at(box(0.14, 0.08, 0.24, MAT.under), 0, -0.42, 0.04));
    rig[side < 0 ? 'hipL' : 'hipR'] = hip; rig[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  const torso = rig.torso = pivot(hips, 0, 0.06, 0);
  torso.add(at(box(0.27, 0.2, 0.17, MAT.under), 0, 0.1, 0));
  torso.add(at(box(0.38, 0.32, 0.23, MAT.armor), 0, 0.34, 0));
  torso.add(at(box(0.2, 0.12, 0.02, MAT.under), 0, 0.3, 0.12));
  torso.add(at(box(0.3, 0.32, 0.12, MAT.armor), 0, 0.33, -0.17));
  torso.add(at(box(0.4, 0.05, 0.24, s), 0, 0.46, 0));
  const head = rig.head = pivot(torso, 0, 0.58, 0.01);
  const helm = sph(0.145, MAT.armor, 16, 12); helm.scale.set(1, 1.08, 1.1); head.add(at(helm, 0, 0.04, 0));
  head.add(at(box(0.2, 0.045, 0.03, MAT.visor), 0, 0.05, 0.145));
  head.add(at(box(0.055, 0.12, 0.03, MAT.visor), 0, -0.01, 0.15));
  head.add(at(box(0.16, 0.08, 0.06, MAT.armor), 0, -0.1, 0.11));
  head.add(at(box(0.03, 0.08, 0.26, s), 0, 0.18, 0));
  if (cls === 'commander') head.add(at(box(0.03, 0.16, 0.03, MAT.gunL), 0.15, 0.12, 0));
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.24, 0.44, 0), el = pivot(sh, 0, -0.29, 0);
    const bell = sph(0.1, MAT.armor, 10, 8); bell.scale.set(1, 0.8, 1.1); sh.add(at(bell, side * 0.02, 0, 0));
    if (side > 0) sh.add(at(box(0.04, 0.06, 0.2, s), 0.08, 0.02, 0));
    sh.add(at(box(0.1, 0.27, 0.11, MAT.armor), 0, -0.15, 0));
    el.add(at(box(0.09, 0.27, 0.1, MAT.armor), 0, -0.13, 0)); el.add(at(sph(0.05, MAT.under, 8, 6), 0, -0.28, 0));
    rig[side < 0 ? 'shL' : 'shR'] = sh; rig[side < 0 ? 'elL' : 'elR'] = el;
  }
  // оружие
  const gun = rig.gun = pivot(torso, 0.08, 0.3, 0.18);
  if (cls === 'heavy') {
    gun.add(at(box(0.12, 0.14, 0.5, MAT.gun), 0, 0, 0.1));
    for (let i = 0; i < 3; i++) gun.add(at(cyl(0.025, 0.025, 0.4, MAT.gunL, 8), Math.cos(i * 2.1) * 0.04, Math.sin(i * 2.1) * 0.04, 0.5, Math.PI / 2));
    gun.add(at(box(0.06, 0.16, 0.08, MAT.gun), 0, -0.12, 0.05));
  } else if (cls === 'sniper') {
    gun.add(at(box(0.06, 0.09, 0.85, MAT.gun), 0, 0, 0.25)); gun.add(at(cyl(0.035, 0.035, 0.24, MAT.gunL, 8), 0, 0.08, 0.2, Math.PI / 2));
    gun.add(at(box(0.05, 0.12, 0.06, MAT.gun), 0, -0.09, 0.05));
  } else {
    gun.add(at(box(0.07, 0.1, 0.55, MAT.gun), 0, 0, 0.14)); gun.add(at(cyl(0.025, 0.025, 0.16, MAT.gunL, 8), 0, 0.07, 0.12, Math.PI / 2));
    gun.add(at(box(0.05, 0.12, 0.06, MAT.gun), 0, -0.1, 0.04));
  }
  rig.muzzle = pivot(gun, 0, 0, cls === 'sniper' ? 0.68 : cls === 'heavy' ? 0.72 : 0.44);
  rig.twoHand = true;
  return rig;
}
function buildDroid(type) {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0), rig = { root, body };
  if (type === 'b2') {
    const hips = rig.hips = pivot(body, 0, 0.92, 0);
    hips.add(at(box(0.36, 0.16, 0.24, MAT.b2D), 0, 0, 0));
    for (const side of [-1, 1]) {
      const hip = pivot(hips, side * 0.15, -0.05, 0), knee = pivot(hip, 0, -0.42, 0);
      hip.add(at(box(0.17, 0.42, 0.2, MAT.b2), 0, -0.2, 0)); knee.add(at(box(0.16, 0.42, 0.18, MAT.b2), 0, -0.2, -0.02));
      knee.add(at(box(0.2, 0.08, 0.32, MAT.b2D), 0, -0.42, 0.05));
      rig[side < 0 ? 'hipL' : 'hipR'] = hip; rig[side < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    const torso = rig.torso = pivot(hips, 0, 0.08, 0);
    const chest = sph(0.32, MAT.b2, 16, 12); chest.scale.set(1.05, 1.0, 0.85); torso.add(at(chest, 0, 0.42, 0.02));
    torso.add(at(box(0.26, 0.2, 0.2, MAT.b2D), 0, 0.12, 0));
    const head = rig.head = pivot(torso, 0, 0.72, 0.05);
    head.add(at(box(0.16, 0.1, 0.16, MAT.b2D), 0, 0, 0));
    for (const s of [-1, 1]) head.add(at(sph(0.025, MAT.red, 8, 6), s * 0.05, 0.01, 0.08));
    for (const side of [-1, 1]) {
      const sh = pivot(torso, side * 0.36, 0.55, 0), el = pivot(sh, 0, -0.28, 0);
      sh.add(at(sph(0.1, MAT.b2D, 10, 8), 0, 0, 0)); sh.add(at(box(0.13, 0.28, 0.14, MAT.b2), 0, -0.14, 0));
      el.add(at(box(0.16, 0.3, 0.18, MAT.b2), 0, -0.15, 0));
      el.add(at(cyl(0.035, 0.035, 0.18, MAT.gun, 8), 0, -0.3, 0.06));
      rig[side < 0 ? 'shL' : 'shR'] = sh; rig[side < 0 ? 'elL' : 'elR'] = el;
    }
    rig.gun = rig.elR; rig.muzzle = pivot(rig.elR, 0, -0.42, 0.06); rig.twoHand = false; rig.wrist = true;
    return rig;
  }
  const T = MAT.tan, TD = MAT.tanD, mark = type === 'cmd' ? STRIPE.yellow : null;
  const hips = rig.hips = pivot(body, 0, 0.98, 0);
  hips.add(at(box(0.2, 0.1, 0.12, TD), 0, 0, 0));
  for (const side of [-1, 1]) {
    const hip = pivot(hips, side * 0.08, -0.04, 0), knee = pivot(hip, 0, -0.46, 0);
    hip.add(at(cyl(0.035, 0.03, 0.46, T, 8), 0, -0.23, 0)); hip.add(at(box(0.07, 0.16, 0.06, T), 0, -0.12, 0.02));
    knee.add(at(sph(0.04, TD, 8, 6), 0, 0, 0)); knee.add(at(cyl(0.03, 0.03, 0.46, T, 8), 0, -0.23, 0));
    knee.add(at(box(0.1, 0.04, 0.2, TD), 0, -0.47, 0.05));
    rig[side < 0 ? 'hipL' : 'hipR'] = hip; rig[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  const torso = rig.torso = pivot(hips, 0, 0.05, 0);
  torso.add(at(cyl(0.03, 0.03, 0.22, TD, 8), 0, 0.1, 0));
  torso.add(at(box(0.26, 0.26, 0.14, T), 0, 0.34, 0.02));
  torso.add(at(box(0.22, 0.24, 0.18, TD), 0, 0.33, -0.15));
  if (mark) torso.add(at(box(0.27, 0.06, 0.15, mark), 0, 0.4, 0.02));
  const neck = pivot(torso, 0, 0.47, 0.03); neck.add(at(cyl(0.02, 0.02, 0.12, TD, 6), 0, 0.06, 0, 0.5));
  const head = rig.head = pivot(neck, 0, 0.12, 0.05);
  const skull = cyl(0.055, 0.085, 0.34, T, 10); head.add(at(skull, 0, 0, 0.1, Math.PI / 2 + 0.3));
  for (const s of [-1, 1]) head.add(at(cyl(0.035, 0.035, 0.02, MAT.eye, 10), s * 0.075, 0.02, 0.0, 0, 0, Math.PI / 2));
  if (mark) head.add(at(box(0.03, 0.02, 0.24, mark), 0, 0.08, 0.1, 0.3));
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.16, 0.44, 0), el = pivot(sh, 0, -0.27, 0);
    sh.add(at(sph(0.045, TD, 8, 6), 0, 0, 0)); sh.add(at(cyl(0.028, 0.028, 0.27, T, 8), 0, -0.135, 0));
    el.add(at(cyl(0.026, 0.026, 0.26, T, 8), 0, -0.13, 0)); el.add(at(box(0.05, 0.06, 0.05, TD), 0, -0.27, 0));
    rig[side < 0 ? 'shL' : 'shR'] = sh; rig[side < 0 ? 'elL' : 'elR'] = el;
  }
  const gun = rig.gun = pivot(torso, 0.06, 0.28, 0.16);
  gun.add(at(box(0.045, 0.07, 0.5, MAT.gun), 0, 0, 0.12)); gun.add(at(box(0.04, 0.1, 0.05, MAT.gun), 0, -0.07, 0.0));
  gun.add(at(cyl(0.02, 0.02, 0.14, MAT.gunL, 6), 0, 0.05, 0.1, Math.PI / 2));
  rig.muzzle = pivot(gun, 0, 0, 0.4); rig.twoHand = true;
  return rig;
}

// поза: состояние idle / walk / aim / dead
function pose(u, dt) {
  const r = u.rig; u.t += dt;
  const walk = u.state === 'walk', aim = u.state === 'aim' || u.state === 'fire';
  u.wph = walk ? u.wph + dt * (u.team === 'droid' ? 10 : 9) : 0;
  const sw = Math.sin(u.wph), cw = Math.cos(u.wph);
  const breath = Math.sin(u.t * 2 + u.seed) * 0.02;
  const k = Math.min(1, dt * 12), set = (o, prop, v) => { if (o) o.rotation[prop] = lerp(o.rotation[prop], v, k); };
  if (u.state === 'dead') return;
  set(r.hipL, 'x', walk ? sw * 0.6 : 0); set(r.hipR, 'x', walk ? -sw * 0.6 : 0);
  set(r.kneeL, 'x', walk ? Math.max(0, -cw) * 0.9 : 0); set(r.kneeR, 'x', walk ? Math.max(0, cw) * 0.9 : 0);
  r.hips.position.y = r.hips.userData.y0 + (walk ? Math.abs(cw) * 0.025 : 0);
  set(r.torso, 'x', (walk ? 0.12 : 0) + breath - u.flinch * 0.6);
  u.flinch = Math.max(0, u.flinch - dt * 3);
  // голова: дроиды подёргиваются
  if (u.team === 'droid' && r.head) { u.headT -= dt; if (u.headT < 0) { u.headT = rand(0.6, 2.5); u.headY = rand(-0.5, 0.5); } set(r.head, 'y', aim ? 0 : u.headY); }
  // руки и оружие
  if (r.wrist) {
    const up = aim ? -1.45 : walk ? -0.2 + sw * 0.25 : -0.15;
    set(r.shR, 'x', up); set(r.shL, 'x', aim ? -1.45 : walk ? -0.2 - sw * 0.25 : -0.15);
    set(r.elR, 'x', aim ? -0.05 : -0.3); set(r.elL, 'x', aim ? -0.05 : -0.3);
  } else {
    const gx = aim ? 0 : walk ? 0.45 : 0.6;
    set(r.gun, 'x', gx); r.gun.position.z = lerp(r.gun.position.z, r.gun.userData.z0, k * 0.5); r.gun.position.y = lerp(r.gun.position.y, aim ? 0.42 : 0.28, k); r.gun.position.x = lerp(r.gun.position.x, aim ? 0.1 : 0.08, k);
    set(r.shR, 'x', aim ? -1.25 : -0.55); set(r.shR, 'z', aim ? -0.12 : -0.15); set(r.elR, 'x', aim ? -0.35 : -0.9);
    set(r.shL, 'x', aim ? -1.3 : -0.75); set(r.shL, 'z', aim ? 0.6 : 0.5); set(r.elL, 'x', aim ? -0.45 : -0.75);
  }
  if (u.state === 'hunker') { set(r.torso, 'x', 0.5); set(r.hipL, 'x', -1.2); set(r.hipR, 'x', -1.2); set(r.kneeL, 'x', 1.9); set(r.kneeR, 'x', 1.9); r.hips.position.y = r.hips.userData.y0 - 0.3; }
}

// =====================================================================
//  ЮНИТЫ И ПРАВИЛА
// =====================================================================
const DEF = {
  trooper: { name: 'Боец', hp: 6, aim: 70, mob: 6, dmg: [3, 5], range: 12, nades: 1, sight: 13 },
  heavy: { name: 'Пулемётчик', hp: 8, aim: 62, mob: 5, dmg: [4, 6], range: 10, nades: 1, burst: 3, sight: 12 },
  sniper: { name: 'Снайпер', hp: 5, aim: 82, mob: 5, dmg: [4, 7], range: 22, nades: 0, close: true, sight: 15 },
  commander: { name: 'Командир', hp: 7, aim: 74, mob: 6, dmg: [3, 5], range: 12, nades: 2, sight: 13 },
  b1: { name: 'Боевой дроид B1', hp: 4, aim: 52, mob: 6, dmg: [2, 4], range: 11, sight: 12 },
  b2: { name: 'Супердроид B2', hp: 9, aim: 60, mob: 5, dmg: [3, 5], range: 10, burst: 2, sight: 12, armor: 1 },
  cmd: { name: 'Дроид-командир', hp: 6, aim: 64, mob: 6, dmg: [3, 4], range: 12, sight: 13 },
};
const SQUAD = [['commander', 'Командир «Сокол»', 'CC-4012'], ['trooper', 'Боец «Искра»', 'CT-5597'], ['heavy', 'Пулемётчик «Молот»', 'CT-1138'], ['sniper', 'Снайпер «Тихий»', 'CT-3301'], ['trooper', 'Боец «Хмурый»', 'CT-8820']];
let units = [], turn = 1, phase = 'start', busy = false, selected = null, shotCount = 0, kills = 0, podsActive = [false, false, false];

function makeUnit(team, type, x, z, extra = {}) {
  const d = DEF[type], rig = team === 'clone' ? buildClone(type) : buildDroid(type);
  rig.root.scale.setScalar(0.52); rig.hips.userData.y0 = rig.hips.position.y;
  const u = Object.assign({ team, type, x, z, hp: d.hp, maxHp: d.hp, aim: d.aim, mob: d.mob, dmg: d.dmg, range: d.range, sight: d.sight, nades: d.nades || 0, burst: d.burst || 1, armor: d.armor || 0,
    ap: 0, alive: true, overwatch: false, hunker: false, rig, t: 0, wph: 0, seed: Math.random() * 6, flinch: 0, headT: 0, headY: 0, state: 'idle', yaw: team === 'clone' ? Math.PI * 0.75 : -Math.PI * 0.25, name: d.name, visible: team === 'clone' }, extra);
  rig.root.position.set(x + 0.5, 0, z + 0.5); rig.root.rotation.y = u.yaw;
  // невидимая «капсула» для выбора касанием
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.55 / 0.52; hit.userData.unit = u;
  if (rig.gun) rig.gun.userData.z0 = rig.gun.position.z;
  rig.root.add(hit); u.hit = hit; hit.scale.setScalar(1 / 0.52);
  world.add(rig.root);
  return u;
}
const clones = () => units.filter(u => u.team === 'clone' && u.alive);
const droids = () => units.filter(u => u.team === 'droid' && u.alive);
const unitAt = (x, z) => units.find(u => u.alive && u.x === x && u.z === z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- линия видимости
function losPts(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), n = Math.ceil(L * 4);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = Math.floor(ax + 0.5 + dx * t), z = Math.floor(az + 0.5 + dz * t);
    if ((x === ax && z === az) || (x === bx && z === bz)) continue;
    if (cell(x, z) === FULL) return false;
  }
  return true;
}
// позиции «выглянуть из-за укрытия»
function peekSpots(u) {
  // выглянуть можно только из-за полного укрытия — шаг вбок от него
  const s = [[u.x, u.z]];
  for (const [cx, cz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (cell(u.x + cx, u.z + cz) !== FULL) continue;
    for (const [px, pz] of [[cz, cx], [-cz, -cx]]) {
      const nx = u.x + px, nz = u.z + pz;
      if (cell(nx, nz) === FLOOR && !unitAt(nx, nz) && !s.some(([a, b]) => a === nx && b === nz)) s.push([nx, nz]);
    }
  }
  return s;
}
function sightFrom(u, tx, tz, range) {
  if (Math.hypot(u.x - tx, u.z - tz) > range + 0.01) return null;
  for (const [sx, sz] of peekSpots(u)) if (losPts(sx, sz, tx, tz)) return [sx, sz];
  return null;
}
function coverAt(tx, tz, fx, fz) {
  const dx = fx - tx, dz = fz - tz, L = Math.hypot(dx, dz) || 1; let best = 0;
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = cell(tx + ox, tz + oz); if (c === FLOOR) continue;
    if ((ox * dx + oz * dz) / L > 0.3) best = Math.max(best, c);
  }
  return best;
}
function shotInfo(s, t, reaction = false) {
  const origin = sightFrom(s, t.x, t.z, Math.max(s.sight, s.range + 4));
  if (!origin) return null;
  const d = Math.hypot(origin[0] - t.x, origin[1] - t.z);
  let aim = s.aim;
  const DEFCLS = DEF[s.type];
  if (d <= 2.5) aim += DEFCLS.close ? -10 : 15;
  if (d > s.range) aim -= Math.round((d - s.range) * 4);
  if (reaction) aim -= 15;
  const cov = coverAt(t.x, t.z, origin[0], origin[1]);
  let def = cov === FULL ? 40 : cov === HALF ? 20 : 0;
  if (t.hunker && def) def = Math.min(80, def * 2);
  const chance = clamp(aim - def, 5, 95);
  const crit = cov === 0 ? 40 : 5;
  return { origin, chance: Math.round(chance), crit, cov, flank: cov === 0, d };
}

// ---------- поиск пути (Дейкстра, 8 направлений без срезания углов)
function reach(u, maxCost) {
  const cost = new Float32Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1), done = new Uint8Array(N * N);
  const start = id(u.x, u.z); cost[start] = 0; const open = [start];
  const pass = (x, z) => cell(x, z) === FLOOR && !(unitAt(x, z) && unitAt(x, z) !== u);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[bi]]) bi = i;
    const c = open.splice(bi, 1)[0]; if (done[c]) continue; done[c] = 1;
    const cx = c % N, cz = Math.floor(c / N);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, nz = cz + dz; if (!pass(nx, nz)) continue;
      if (dx && dz && (!pass(cx + dx, cz) || !pass(cx, cz + dz))) continue;
      const nc = cost[c] + (dx && dz ? 1.41 : 1); if (nc > maxCost + 0.01) continue;
      const ni = id(nx, nz); if (nc < cost[ni]) { cost[ni] = nc; prev[ni] = c; open.push(ni); }
    }
  }
  return { cost, prev };
}
function pathTo(r, x, z) { const p = []; let c = id(x, z); while (c !== -1) { p.push([c % N, Math.floor(c / N)]); c = r.prev[c]; } return p.reverse(); }

// ---------- видимость (туман войны)
const vis = new Uint8Array(N * N), seenEver = new Uint8Array(N * N);
const fogData = new Uint8Array(N * N * 4), fogTex = new THREE.DataTexture(fogData, N, N, THREE.RGBAFormat);
fogTex.magFilter = THREE.LinearFilter; fogTex.minFilter = THREE.LinearFilter; fogTex.needsUpdate = true;
{
  const fog = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false }));
  fog.rotation.x = -Math.PI / 2; fog.position.set(N / 2, 0.025, N / 2); fog.renderOrder = 2; world.add(fog);
}
function updateVisibility() {
  vis.fill(0); const cs = clones();
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    for (const c of cs) if (Math.hypot(c.x - x, c.z - z) <= c.sight && losPts(c.x, c.z, x, z)) { vis[id(x, z)] = 1; seenEver[id(x, z)] = 1; break; }
  }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = ((N - 1 - z) * N + x) * 4, v = vis[id(x, z)], s = seenEver[id(x, z)];
    fogData[i] = 6; fogData[i + 1] = 10; fogData[i + 2] = 22; fogData[i + 3] = v ? 0 : s ? 95 : 150;
  }
  fogTex.needsUpdate = true;
  for (const d of units) if (d.team === 'droid') { d.visible = d.alive ? !!vis[id(d.x, d.z)] : d.visible; if (d.alive) d.rig.root.visible = d.visible || d.state === 'dead'; }
}

// =====================================================================
//  КАМЕРА
// =====================================================================
const cam = { fx: 4, fz: 26, yaw: Math.PI * 0.75, pitch: 0.95, dist: 15, tfx: 4, tfz: 26, tyaw: Math.PI * 0.75, tpitch: 0.95, tdist: 15, mode: 'tactical', cine: null, shake: 0 };
const VIEWS = { tactical: { pitch: 0.92, dist: 15 }, top: { pitch: 1.42, dist: 24 } };
function camUpdate(dt) {
  const k = Math.min(1, dt * 6);
  if (cam.cine) {
    const c = cam.cine; camera.position.copy(c.pos); camera.lookAt(c.look); camera.fov = lerp(camera.fov, c.fov || 52, k); camera.updateProjectionMatrix();
  } else {
    cam.fx = lerp(cam.fx, cam.tfx, k); cam.fz = lerp(cam.fz, cam.tfz, k); cam.yaw = angleLerp(cam.yaw, cam.tyaw, k);
    cam.pitch = lerp(cam.pitch, cam.tpitch, k); cam.dist = lerp(cam.dist, cam.tdist, k);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.fx + Math.sin(cam.yaw) * cp * cam.dist, sp * cam.dist, cam.fz + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(cam.fx, 0, cam.fz); camera.fov = lerp(camera.fov, 42, k); camera.updateProjectionMatrix();
  }
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt); camera.position.x += rand(-1, 1) * cam.shake * 0.4; camera.position.y += rand(-1, 1) * cam.shake * 0.4; }
}
function focus(x, z, snap) { cam.tfx = clamp(x, 1, N - 1); cam.tfz = clamp(z, 1, N - 1); if (snap) { cam.fx = cam.tfx; cam.fz = cam.tfz; } }
function tacticalPose() { const cp = Math.cos(cam.tpitch), sp = Math.sin(cam.tpitch); return { pos: new THREE.Vector3(cam.tfx + Math.sin(cam.tyaw) * cp * cam.tdist, sp * cam.tdist, cam.tfz + Math.cos(cam.tyaw) * cp * cam.tdist), look: new THREE.Vector3(cam.tfx, 0, cam.tfz) }; }

// ---------- анимации-промисы
const tweens = [];
function tween(dur, fn) { return new Promise(res => tweens.push({ t: 0, dur, fn, res })); }
const wait = s => tween(s, () => {});
function tweensUpdate(dt) { for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); w.fn(k); if (k >= 1) { tweens.splice(i, 1); w.res(); } } }

// =====================================================================
//  НАЛОЖЕНИЯ НА ПОЛЕ: радиус хода, путь, курсор, кольца
// =====================================================================
const tileGeo = new THREE.PlaneGeometry(0.9, 0.9); tileGeo.rotateX(-Math.PI / 2);
const moveTiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false }), N * N);
moveTiles.count = 0; moveTiles.renderOrder = 3; world.add(moveTiles);
const dotGeo = new THREE.CircleGeometry(0.07, 10); dotGeo.rotateX(-Math.PI / 2);
const pathDots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 200);
pathDots.count = 0; pathDots.renderOrder = 4; world.add(pathDots);
function ring(r0, r1, color, op = 0.9) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.renderOrder = 5; m.visible = false; world.add(m); return m; }
const selRing = ring(0.32, 0.4, 0x6fd0ff), destRing = ring(0.3, 0.42, 0xffffff), tgtRing = ring(0.36, 0.46, 0xff4a3a), nadeRing = ring(1.42, 1.5, 0xffb347), nadeRange = ring(8.9, 9, 0xffb347, 0.5);
// значки укрытий у выбранной клетки
function shieldTex(full) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.beginPath(); g.moveTo(32, 4); g.lineTo(56, 14); g.lineTo(54, 36); g.quadraticCurveTo(48, 54, 32, 60); g.quadraticCurveTo(16, 54, 10, 36); g.lineTo(8, 14); g.closePath();
  g.fillStyle = full ? 'rgba(111,208,255,.95)' : 'rgba(111,208,255,.25)'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#6fd0ff'; g.stroke();
  if (!full) { g.beginPath(); g.moveTo(10, 36); g.quadraticCurveTo(16, 54, 32, 60); g.quadraticCurveTo(48, 54, 54, 36); g.closePath(); g.fillStyle = '#6fd0ff'; g.fill(); }
  return new THREE.CanvasTexture(c);
}
const SHIELD = [null, shieldTex(false), shieldTex(true)];
const shields = [0, 1, 2, 3].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); s.scale.setScalar(0.42); s.visible = false; s.renderOrder = 9; scene.add(s); return s; });
function showShields(x, z) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz], i) => {
    const c = cell(x + dx, z + dz), s = shields[i];
    if (x < 0 || c === FLOOR) { s.visible = false; return; }
    s.visible = true; s.material.map = SHIELD[c]; s.material.needsUpdate = true; s.position.set(x + 0.5 + dx * 0.42, 0.75, z + 0.5 + dz * 0.42);
  });
}

// =====================================================================
//  ИНТЕРФЕЙС
// =====================================================================
const ui = { mode: 'move', targets: [], ti: 0, pending: null, reach: null, nadeTile: null };
function hint(t) { const h = $('hint'); if (t) { h.textContent = t; h.classList.add('show'); } else h.classList.remove('show'); }
function banner(text, cls) { const b = $('banner'); b.textContent = text; b.className = ''; void b.offsetWidth; b.className = 'show ' + cls; }
function portrait(u) {
  const c = document.createElement('canvas'); c.width = 120; c.height = 64; const g = c.getContext('2d');
  const col = { trooper: '#2f6fdc', heavy: '#c8302a', sniper: '#4c8a3c', commander: '#e07b22' }[u.type];
  g.fillStyle = '#e9edf1'; g.beginPath(); g.ellipse(60, 34, 22, 26, 0, 0, 7); g.fill();
  g.fillStyle = col; g.fillRect(56, 6, 8, 22);
  g.fillStyle = '#111'; g.fillRect(44, 30, 32, 7); g.fillRect(56, 30, 8, 20);
  g.fillStyle = '#cfd6dc'; g.fillRect(48, 52, 24, 8);
  return c;
}
function buildSquadUI() {
  const box = $('squad'); box.innerHTML = '';
  for (const u of units.filter(u => u.team === 'clone')) {
    const d = document.createElement('div'); d.className = 'card'; d.appendChild(portrait(u));
    d.insertAdjacentHTML('beforeend', `<div class="cname">${u.call}</div><div class="hp"></div><div class="ap"></div><div class="badge"></div>`);
    d.addEventListener('click', () => { if (u.alive && phase === 'player' && !busy) { select(u); focus(u.x + 0.5, u.z + 0.5); } });
    u.card = d; box.appendChild(d);
  }
  refreshUI();
}
function pips(n, max) { let s = ''; for (let i = 0; i < max; i++) s += `<i class="${i < n ? '' : 'e'}"></i>`; return s; }
function refreshUI() {
  for (const u of units) if (u.card) {
    u.card.classList.toggle('sel', u === selected); u.card.classList.toggle('dead', !u.alive); u.card.classList.toggle('done', u.alive && u.ap === 0);
    u.card.querySelector('.hp').innerHTML = pips(u.hp, u.maxHp); u.card.querySelector('.ap').innerHTML = u.alive ? pips(u.ap, 2) : '';
    u.card.querySelector('.badge').textContent = u.overwatch ? '👁' : u.hunker ? '🛡' : '';
  }
  const u = selected, can = u && u.alive && u.ap > 0 && phase === 'player' && !busy;
  $('aShoot').disabled = !can || !targetsFor(u).length;
  $('aOver').disabled = !can; $('aHunk').disabled = !can || !coverAround(u);
  $('aNade').disabled = !can || u.nades <= 0;
  $('aNext').disabled = phase !== 'player' || busy; $('aEnd').disabled = phase !== 'player' || busy;
  $('aNade').querySelector('.lbl').textContent = u && u.nades ? `Граната ×${u.nades}` : 'Граната';
  $('aShoot').classList.toggle('on', ui.mode === 'target'); $('aNade').classList.toggle('on', ui.mode === 'nade');
  $('objective').textContent = `Дроидов осталось: ${droids().length} · Клонов: ${clones().length}`;
  $('bMus').classList.toggle('off', !Snd.musOn); $('bSfx').classList.toggle('off', !Snd.sfxOn);
}
const coverAround = u => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => cell(u.x + dx, u.z + dz) !== FLOOR);
const targetsFor = u => u ? droids().filter(d => d.visible && shotInfo(u, d)) : [];

// надписи над юнитами
const labels = $('labels');
function syncLabels() {
  const v = new THREE.Vector3(), W = innerWidth, H = innerHeight;
  for (const u of units) {
    if (!u.label) { u.label = document.createElement('div'); u.label.className = 'ul ' + (u.team === 'clone' ? 'rep' : 'sep'); u.label.innerHTML = '<div class="st"></div><div class="pips"></div>'; labels.appendChild(u.label); u.lhp = -1; }
    const show = u.alive && (u.team === 'clone' || u.visible) && !cam.cine && phase !== 'start';
    u.label.style.display = show ? '' : 'none'; if (!show) continue;
    v.set(u.rig.root.position.x, 1.25, u.rig.root.position.z).project(camera);
    if (v.z > 1) { u.label.style.display = 'none'; continue; }
    u.label.style.left = ((v.x + 1) / 2 * W) + 'px'; u.label.style.top = ((1 - v.y) / 2 * H) + 'px';
    const key = u.hp * 10 + (u.overwatch ? 1 : 0) + (u.hunker ? 2 : 0);
    if (key !== u.lhp) { u.lhp = key; u.label.querySelector('.pips').innerHTML = pips(u.hp, u.maxHp); u.label.querySelector('.st').textContent = (u.overwatch ? '👁' : '') + (u.hunker ? '🛡' : ''); }
  }
}
function popText(u, text, cls) {
  const v = new THREE.Vector3(u.rig.root.position.x, 1.5, u.rig.root.position.z).project(camera);
  const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
  d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1500);
}

// ---------- выбор и подсветка
function select(u) {
  selected = u; ui.mode = 'move'; ui.pending = null; hideTarget(); nadeRing.visible = nadeRange.visible = false;
  if (u) Snd.fx.select();
  showMoveRange(); refreshUI();
}
const colBlue = new THREE.Color(0x4fb4ff), colYel = new THREE.Color(0xffc65a), dummy = new THREE.Object3D();
function showMoveRange() {
  moveTiles.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9);
  const u = selected; if (!u || !u.alive || u.ap <= 0 || phase !== 'player' || busy || ui.mode !== 'move') { ui.reach = null; return; }
  ui.reach = reach(u, u.mob * u.ap); let n = 0;
  for (let i = 0; i < N * N; i++) {
    const c = ui.reach.cost[i]; if (!isFinite(c) || c === 0) continue;
    dummy.position.set(i % N + 0.5, 0.03, Math.floor(i / N) + 0.5); dummy.updateMatrix(); moveTiles.setMatrixAt(n, dummy.matrix);
    moveTiles.setColorAt(n, c <= u.mob + 0.01 ? colBlue : colYel); n++;
  }
  moveTiles.count = n; moveTiles.instanceMatrix.needsUpdate = true; if (moveTiles.instanceColor) moveTiles.instanceColor.needsUpdate = true;
}
function previewPath(x, z) {
  const p = pathTo(ui.reach, x, z); pathDots.count = 0;
  let n = 0;
  for (let i = 0; i < p.length - 1 && n < 200; i++) for (let s = 0; s < 3; s++) {
    const t = s / 3, px = lerp(p[i][0], p[i + 1][0], t) + 0.5, pz = lerp(p[i][1], p[i + 1][1], t) + 0.5;
    dummy.position.set(px, 0.05, pz); dummy.updateMatrix(); pathDots.setMatrixAt(n++, dummy.matrix);
  }
  pathDots.count = n; pathDots.instanceMatrix.needsUpdate = true;
  destRing.position.set(x + 0.5, 0.05, z + 0.5); destRing.visible = true;
  destRing.material.color.set(ui.reach.cost[id(x, z)] <= selected.mob + 0.01 ? 0x6fd0ff : 0xffc65a);
  showShields(x, z);
}

// ---------- режим прицеливания
function enterTarget(t) {
  const u = selected; if (!u || u.ap <= 0) return;
  ui.targets = targetsFor(u); if (!ui.targets.length) { Snd.fx.deny(); hint('Нет целей в зоне видимости'); setTimeout(() => hint(''), 1500); return; }
  ui.mode = 'target'; ui.ti = Math.max(0, ui.targets.indexOf(t)); moveTiles.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9);
  Snd.fx.click(); showTarget(); refreshUI();
}
function showTarget() {
  const u = selected, t = ui.targets[ui.ti], s = shotInfo(u, t);
  if (!s) { hideTarget(); return; }
  $('targetPanel').classList.add('show');
  $('tpName').textContent = t.name; $('tpHp').textContent = `Прочность ${t.hp}/${t.maxHp}${t.armor ? ' · броня 1' : ''}`;
  $('tpChance').textContent = s.chance + '%';
  $('tpInfo').textContent = `Урон ${u.dmg[0]}–${u.dmg[1]}${u.burst > 1 ? ' ×очередь' : ''} · крит ${s.crit}% · ${s.flank ? 'ФЛАНГ!' : s.cov === FULL ? 'полное укрытие' : 'частичное укрытие'} · ${s.d.toFixed(0)} кл.`;
  tgtRing.visible = true; tgtRing.position.set(t.x + 0.5, 0.05, t.z + 0.5);
  focus((u.x + t.x) / 2 + 0.5, (u.z + t.z) / 2 + 0.5);
}
function hideTarget() { $('targetPanel').classList.remove('show'); tgtRing.visible = false; if (ui.mode === 'target') ui.mode = 'move'; }

// =====================================================================
//  ДЕЙСТВИЯ
// =====================================================================
function faceTo(u, x, z) { return Math.atan2(x - u.rig.root.position.x, z - u.rig.root.position.z); }
async function turnTo(u, yaw, dur = 0.25) { const y0 = u.rig.root.rotation.y; await tween(dur, k => { u.rig.root.rotation.y = angleLerp(y0, yaw, easeIO(k)); }); u.yaw = yaw; }

async function moveUnit(u, path) {
  // невидимый дроид идёт вне поля зрения — без анимации
  if (u.team === 'droid' && !u.visible && !path.some(([x, z]) => vis[id(x, z)])) {
    const [x, z] = path[path.length - 1]; u.x = x; u.z = z; u.rig.root.position.set(x + 0.5, 0, z + 0.5);
    if (path.length > 1) { const [a, b] = path[path.length - 2]; u.yaw = u.rig.root.rotation.y = Math.atan2(x - a, z - b); }
    return;
  }
  u.state = 'walk';
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1], [x1, z1] = path[i], diag = x0 !== x1 && z0 !== z1, yaw = Math.atan2(x1 - x0, z1 - z0), y0 = u.rig.root.rotation.y;
    let stepped = false;
    await tween((diag ? 1.41 : 1) / 3.3, k => {
      u.rig.root.position.set(lerp(x0, x1, k) + 0.5, 0, lerp(z0, z1, k) + 0.5); u.rig.root.rotation.y = angleLerp(y0, yaw, Math.min(1, k * 3));
      if (!stepped && k > 0.5) { stepped = true; if (u.team === 'clone' || u.visible) Snd.fx.step(u.team); }
      if (u.team === 'clone' || u.visible) focus(u.rig.root.position.x, u.rig.root.position.z);
    });
    u.x = x1; u.z = z1; u.yaw = yaw;
    if (u.team === 'clone') updateVisibility(); else { u.visible = !!vis[id(u.x, u.z)]; u.rig.root.visible = u.visible; }
    // реакция дозорных
    for (const o of units) {
      if (!o.alive || !o.overwatch || o.team === u.team || !u.alive) continue;
      if (o.team === 'droid' && !podsActive[o.pod]) continue;
      const s = shotInfo(o, u, true); if (!s || s.d > o.sight) continue;
      o.overwatch = false; u.state = 'idle';
      banner('ДОЗОРНЫЙ ОГОНЬ', o.team === 'clone' ? 'rep' : 'sep');
      await shoot(o, u, { reaction: true });
      if (!u.alive) return;
      u.state = 'walk';
    }
  }
  u.state = 'idle';
  // разведка: клоны обнаружили группу дроидов
  if (u.team === 'clone') await checkPods();
}

async function shoot(s, t, opts = {}) {
  const info = shotInfo(s, t, opts.reaction); if (!info) return;
  busy = true; refreshUI(); hideTarget(); hint('');
  const hit = Math.random() * 100 < info.chance, crit = hit && Math.random() * 100 < info.crit;
  let dmg = hit ? randi(s.dmg[0], s.dmg[1]) + (crit ? 2 : 0) - (t.armor || 0) : 0; if (hit) dmg = Math.max(1, dmg);
  const [ox, oz] = info.origin, moved = ox !== s.x || oz !== s.z, from0 = s.rig.root.position.clone();
  let firstPerson = (shotCount++ % 2 === 1) && !opts.reaction;
  const wasVisible = s.rig.root.visible; s.rig.root.visible = true;
  // выход из-за укрытия
  if (moved) { s.state = 'walk'; const p0 = s.rig.root.position.clone(); await tween(0.3, k => s.rig.root.position.lerpVectors(p0, new THREE.Vector3(ox + 0.5, 0, oz + 0.5), easeIO(k))); }
  s.state = 'aim'; s.hunker = false;
  await turnTo(s, faceTo(s, t.x + 0.5, t.z + 0.5), 0.2);
  // кинокамера
  document.body.classList.add('cine');
  $('cineInfo').textContent = `${s.team === 'clone' ? s.call : s.name} → ${t.team === 'clone' ? t.call : t.name} · ${info.chance}%`;
  const sp = s.rig.root.position, tp = t.rig.root.position;
  const dir = new THREE.Vector3(tp.x - sp.x, 0, tp.z - sp.z).normalize(), right = new THREE.Vector3(dir.z, 0, -dir.x);
  const tChest = new THREE.Vector3(tp.x, t.type === 'b2' ? 0.6 : 0.62, tp.z);
  let cpos, clook = tChest.clone(), fov;
  let tp3 = null;
  if (!firstPerson) {
    // ракурс из-за плеча: ищем точку, откуда цель не закрыта скалами и стенами
    for (const back of [1.25, 0.9, 0.6]) for (const side of [-1, 1]) {
      const p = new THREE.Vector3(sp.x, 1.35, sp.z).addScaledVector(dir, -back).addScaledVector(right, side * 0.5);
      if (cell(Math.floor(p.x), Math.floor(p.z)) === FULL) continue;
      if (camClear(p, tChest, s, t)) { tp3 = p; break; }
    }
    if (!tp3) firstPerson = true;
  }
  if (firstPerson) { cpos = new THREE.Vector3(sp.x, 0.86, sp.z).addScaledVector(dir, 0.18).addScaledVector(right, -0.06); fov = 46; }
  else { cpos = tp3; fov = 50; clook = tChest.clone().lerp(new THREE.Vector3(sp.x, 0.7, sp.z), 0.15); }
  const st = { pos: camera.position.clone(), look: new THREE.Vector3(cam.fx, 0, cam.fz) };
  cam.cine = { pos: st.pos.clone(), look: st.look.clone(), fov };
  await tween(opts.reaction ? 0.35 : 0.6, k => { const e = easeIO(k); cam.cine.pos.lerpVectors(st.pos, cpos, e); cam.cine.look.lerpVectors(st.look, clook, e); });
  if (firstPerson) { s.rig.body.visible = false; viewModel(s, true); }
  window.cineMode = firstPerson ? 'first' : 'third';
  await wait(0.25);
  // выстрелы
  const shots = s.burst;
  for (let i = 0; i < shots; i++) {
    const m = new THREE.Vector3(); (firstPerson ? fpMuzzle : s.rig.muzzle).getWorldPosition(m);
    let to;
    if (hit) to = tChest.clone().add(new THREE.Vector3(rand(-0.06, 0.06), rand(-0.08, 0.1), rand(-0.06, 0.06)));
    else { to = tChest.clone().addScaledVector(right, (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.7)).add(new THREE.Vector3(0, rand(-0.2, 0.35), 0)).addScaledVector(dir, rand(1.5, 4)); }
    s.team === 'clone' ? Snd.fx.blaster('clone') : Snd.fx.blaster('droid');
    FX.flash(m.x, m.y, m.z, TEAMCOL[s.team], 0.45, 0.08);
    if (!s.rig.wrist) s.rig.gun.position.z -= 0.05;
    const b = FX.bolt(m, to, s.team);
    if (i < shots - 1) { await wait(0.11); continue; }
    await b;
  }
  await wait(0.12);
  // результат
  if (hit) {
    Snd.fx.impact(); FX.spark(tChest.x, tChest.y, tChest.z, t.team === 'droid' ? 0xffd27a : 0xffffff, 26, 3);
    FX.flash(tChest.x, tChest.y, tChest.z, 0xffd27a, 0.7, 0.15); t.flinch = 1; cam.shake = 0.15;
    t.hp = Math.max(0, t.hp - dmg); popText(t, (crit ? 'КРИТ! −' : '−') + dmg, crit ? 'crit' : 'dmg');
  } else { Snd.fx.miss(); popText(t, 'ПРОМАХ', 'miss'); FX.spark(tChest.x + right.x * 0.5, 0.3, tChest.z + right.z * 0.5, 0xffe0a0, 8, 2); }
  if (t.hp <= 0) await killUnit(t);
  await wait(hit ? 0.8 : 0.6);
  // возврат камеры
  if (firstPerson) { s.rig.body.visible = true; viewModel(s, false); }
  const back = tacticalPose(), c0 = { pos: cam.cine.pos.clone(), look: cam.cine.look.clone() };
  document.body.classList.remove('cine');
  await tween(0.5, k => { const e = easeIO(k); cam.cine.pos.lerpVectors(c0.pos, back.pos, e); cam.cine.look.lerpVectors(c0.look, back.look, e); });
  cam.cine = null;
  if (moved) { s.state = 'walk'; const p0 = s.rig.root.position.clone(); await tween(0.3, k => s.rig.root.position.lerpVectors(p0, from0, easeIO(k))); }
  s.state = 'idle'; if (s.team === 'droid') s.rig.root.visible = wasVisible || s.visible;
  busy = false; refreshUI(); checkEnd();
}
// отрезок камера → цель не проходит сквозь высокие препятствия
function camClear(a, b, s, t) {
  const L = a.distanceTo(b), n = Math.ceil(L / 0.15);
  for (let i = 1; i < n; i++) {
    const k = i / n, x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k), z = lerp(a.z, b.z, k), tx = Math.floor(x), tz = Math.floor(z);
    if (Math.max(Math.abs(tx - s.x), Math.abs(tz - s.z)) <= 1 || Math.max(Math.abs(tx - t.x), Math.abs(tz - t.z)) <= 1) continue;
    const c = cell(tx, tz); if (c === FULL && y < 2.4) return false; if (c === HALF && y < 0.55) return false;
  }
  return true;
}
async function killUnit(t) {
  t.alive = false; t.overwatch = false; t.state = 'dead';
  if (t.team === 'droid') { kills++; Snd.fx.droidDeath(); FX.spark(t.rig.root.position.x, 0.8, t.rig.root.position.z, 0x7fd0ff, 40, 4); }
  else Snd.fx.cloneDown();
  const r = t.rig, y0 = r.body.rotation.x, back = Math.random() < 0.5 ? -1 : 1;
  if (t.team === 'droid' && t.type !== 'b2' && r.head) {
    // голова отлетает
    const hd = r.head; world.attach(hd); t.debris = [hd];
    const v = new THREE.Vector3(rand(-1.5, 1.5), 3.2, rand(-1.5, 1.5)), p0 = hd.position.clone();
    tween(1.1, k => { const tt = k * 1.1; hd.position.set(p0.x + v.x * tt, Math.max(0.05, p0.y + v.y * tt - 4.9 * tt * tt), p0.z + v.z * tt); hd.rotation.x += 0.25; hd.rotation.z += 0.18; });
    for (let i = 0; i < 4; i++) FX.puff(t.rig.root.position.x, 0.8, t.rig.root.position.z, { color: 0x333333, s1: 1.2, life: 1.8 });
  }
  await tween(0.7, k => { r.body.rotation.x = y0 + back * easeOut(k) * Math.PI / 2 * 0.98; r.body.position.y = Math.sin(k * Math.PI) * 0.05; });
  refreshUI();
}
// модель оружия в руках для вида от первого лица
let fpGun = null; const fpMuzzle = new THREE.Object3D();
function viewModel(u, on) {
  if (fpGun) { camera.remove(fpGun); fpGun = null; }
  if (!on) return;
  fpGun = new THREE.Group();
  if (u.team === 'clone') {
    fpGun.add(at(box(0.07, 0.09, 0.6, MAT.gun), 0, 0, -0.3)); fpGun.add(at(cyl(0.028, 0.028, 0.18, MAT.gunL, 8), 0, 0.075, -0.25, Math.PI / 2));
    fpGun.add(at(box(0.1, 0.1, 0.2, MAT.armor), -0.02, -0.08, -0.05)); fpGun.add(at(box(0.08, 0.08, 0.12, MAT.under), 0.01, -0.06, -0.38));
  } else if (u.type === 'b2') { fpGun.add(at(box(0.16, 0.16, 0.4, MAT.b2), 0, -0.02, -0.15)); fpGun.add(at(cyl(0.04, 0.04, 0.2, MAT.gun, 8), 0, 0.02, -0.4, Math.PI / 2)); }
  else { fpGun.add(at(box(0.05, 0.08, 0.55, MAT.gun), 0, 0, -0.3)); fpGun.add(at(cyl(0.025, 0.025, 0.4, MAT.tan, 6), 0.02, -0.1, -0.2, 0.9)); }
  fpGun.position.set(0.16, -0.15, -0.12); fpGun.rotation.y = 0.05; fpMuzzle.position.set(0, 0.0, -0.62); fpGun.add(fpMuzzle);
  fpGun.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
  camera.add(fpGun); if (!camera.parent) scene.add(camera);
}

async function throwNade(u, x, z) {
  busy = true; u.ap = 0; u.nades--; refreshUI(); hideTarget(); nadeRing.visible = nadeRange.visible = false; hint('');
  u.state = 'aim'; await turnTo(u, faceTo(u, x + 0.5, z + 0.5), 0.2);
  Snd.fx.throwNade();
  const g = sph(0.07, mat(0x3a3f47, { metalness: 0.7 })), led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  g.add(led); led.position.y = 0.06; scene.add(g);
  const p0 = new THREE.Vector3(u.rig.root.position.x, 0.9, u.rig.root.position.z), p1 = new THREE.Vector3(x + 0.5, 0.07, z + 0.5), L = p0.distanceTo(p1);
  focus((p0.x + p1.x) / 2, (p0.z + p1.z) / 2);
  await tween(0.5 + L * 0.06, k => { g.position.lerpVectors(p0, p1, k); g.position.y += Math.sin(k * Math.PI) * (1 + L * 0.25); g.rotation.x += 0.3; });
  await wait(0.35); scene.remove(g);
  FX.explosion(x + 0.5, z + 0.5); Snd.fx.explosion(); cam.shake = 0.6;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.hypot(dx, dz) <= 1.5) destroyCover(x + dx, z + dz);
  const hitList = units.filter(t => t.alive && Math.hypot(t.x - x, t.z - z) <= 1.5);
  for (const t of hitList) { const d = randi(3, 5); t.hp = Math.max(0, t.hp - d); t.flinch = 1; popText(t, '−' + d, 'dmg'); if (t.team === 'droid' && !t.visible) { t.visible = true; t.rig.root.visible = true; } }
  await wait(0.4);
  await Promise.all(hitList.filter(t => t.hp <= 0).map(killUnit));
  updateVisibility(); u.state = 'idle'; busy = false; refreshUI(); checkEnd();
  if (phase === 'player') afterAction();
}

// =====================================================================
//  ХОДЫ
// =====================================================================
async function startPlayerTurn() {
  phase = 'player'; Music.setIntensity(0.35);
  for (const u of clones()) { u.ap = 2; u.overwatch = false; if (u.hunker) { u.hunker = false; u.state = 'idle'; } }
  $('turnTitle').textContent = `ХОД ${turn} · РЕСПУБЛИКА`; $('turnTitle').className = 'rep';
  banner('ХОД РЕСПУБЛИКИ', 'rep'); Snd.fx.turn('clone');
  const first = clones()[0]; select(first); if (first) focus(first.x + 0.5, first.z + 0.5);
}
function afterAction() {
  if (phase !== 'player') return;
  if (selected && selected.alive && selected.ap > 0) { showMoveRange(); refreshUI(); return; }
  const nxt = clones().find(u => u.ap > 0);
  if (nxt) { select(nxt); focus(nxt.x + 0.5, nxt.z + 0.5); } else endPlayerTurn();
}
function nextUnit() {
  const cs = clones().filter(u => u.ap > 0); if (!cs.length) return;
  const i = cs.indexOf(selected); const n = cs[(i + 1) % cs.length]; select(n); focus(n.x + 0.5, n.z + 0.5);
}
async function endPlayerTurn() {
  if (phase !== 'player' || busy) return;
  phase = 'enemy'; select(null); refreshUI();
  $('turnTitle').textContent = `ХОД ${turn} · СЕПАРАТИСТЫ`; $('turnTitle').className = 'sep';
  banner('ХОД СЕПАРАТИСТОВ', 'sep'); Snd.fx.turn('droid'); Music.setIntensity(0.9);
  await wait(1.2);
  busy = true;
  for (const d of droids()) { d.ap = 2; d.overwatch = false; if (d.hunker) { d.hunker = false; d.state = 'idle'; } }
  for (const d of droids()) {
    if (phase === 'over') break;
    if (!d.alive) continue;
    if (podsActive[d.pod]) await aiAct(d); else await patrol(d);
  }
  busy = false;
  if (phase === 'over') return;
  turn++; startPlayerTurn();
}

// ---------- ИИ дроидов
function scoreTile(d, x, z) {
  let s = 0; const cs = clones();
  for (const c of cs) {
    const dd = Math.hypot(c.x - x, c.z - z); if (dd > 16) continue;
    if (losPts(c.x, c.z, x, z)) { const cv = coverAt(x, z, c.x, c.z); s += cv === FULL ? 26 : cv === HALF ? 12 : -22; }
  }
  // лучшая цель с этой клетки
  const fake = Object.assign({}, d, { x, z }); let best = 0;
  for (const c of cs) { const si = shotInfo(fake, c); if (si) best = Math.max(best, si.chance + (si.flank ? 25 : 0)); }
  s += best * 0.7;
  const near = Math.min(...cs.map(c => Math.hypot(c.x - x, c.z - z)));
  s -= Math.abs(near - 7) * 2.2;
  s += rand(-1, 1) * (d.type === 'b1' ? 14 : 6);
  return s;
}
function bestShot(d) {
  let best = null;
  for (const c of clones()) { const si = shotInfo(d, c); if (!si) continue; const v = si.chance + (c.hp <= d.dmg[1] ? 15 : 0) + (si.flank ? 10 : 0); if (!best || v > best.v) best = { t: c, si, v }; }
  return best;
}
async function aiMove(d, maxCost) {
  const r = reach(d, maxCost); let best = [d.x, d.z], bs = scoreTile(d, d.x, d.z) + 4;
  for (let i = 0; i < N * N; i++) { if (!isFinite(r.cost[i]) || r.cost[i] === 0) continue; const sc = scoreTile(d, i % N, Math.floor(i / N)); if (sc > bs) { bs = sc; best = [i % N, Math.floor(i / N)]; } }
  if (best[0] === d.x && best[1] === d.z) return false;
  await moveUnit(d, pathTo(r, best[0], best[1])); return true;
}
async function aiAct(d) {
  if (!d.alive || phase === 'over') return;
  if (d.visible) { focus(d.x + 0.5, d.z + 0.5); await wait(0.45); }
  let shot = bestShot(d);
  const covNow = clones().some(c => losPts(c.x, c.z, d.x, d.z) && coverAt(d.x, d.z, c.x, c.z) === 0);
  if (shot && shot.si.chance >= 55 && !covNow) { d.ap = 0; await shoot(d, shot.t); return; }
  await aiMove(d, d.mob); if (!d.alive || phase === 'over') return;
  d.ap = 1; shot = bestShot(d);
  if (shot && shot.si.chance >= 22) { d.ap = 0; await shoot(d, shot.t); return; }
  if (!clones().some(c => Math.hypot(c.x - d.x, c.z - d.z) < 14)) { await aiMove(d, d.mob); return; }
  d.ap = 0;
  if (d.type === 'b2' || Math.random() < 0.6) { d.overwatch = true; if (d.visible) popText(d, 'ДОЗОР', 'miss'); }
  else if (coverAround(d)) { d.hunker = true; d.state = 'hunker'; }
}
async function patrol(d) {
  // неактивные группы бродят возле позиции
  if (Math.random() < 0.5) return;
  const r = reach(d, 3), opts = [];
  for (let i = 0; i < N * N; i++) if (isFinite(r.cost[i]) && r.cost[i] > 0 && Math.hypot(i % N - d.home[0], Math.floor(i / N) - d.home[1]) < 4) opts.push(i);
  if (!opts.length) return; const t = opts[randi(0, opts.length - 1)];
  const path = pathTo(r, t % N, Math.floor(t / N));
  if (d.visible || vis[t]) await moveUnit(d, path);
  else { d.x = t % N; d.z = Math.floor(t / N); d.rig.root.position.set(d.x + 0.5, 0, d.z + 0.5); }
  if (clones().some(c => sightFrom(d, c.x, c.z, d.sight))) podsActive[d.pod] = true;
}
async function checkPods() {
  for (let p = 0; p < PODS.length; p++) {
    if (podsActive[p]) continue;
    const ms = droids().filter(d => d.pod === p && d.visible); if (!ms.length) continue;
    podsActive[p] = true;
    banner('ПРОТИВНИК ОБНАРУЖЕН', 'alert'); Snd.fx.alert();
    const all = droids().filter(d => d.pod === p);
    const cx = all.reduce((a, d) => a + d.x, 0) / all.length, cz = all.reduce((a, d) => a + d.z, 0) / all.length;
    focus(cx + 0.5, cz + 0.5); await wait(0.7); Snd.fx.roger(); await wait(0.5);
    // «рассыпаются» по укрытиям
    for (const d of all) { d.rig.root.visible = true; d.visible = true; await aiMove(d, d.mob); }
    updateVisibility();
  }
}
function checkEnd() {
  if (phase === 'over') return;
  if (!droids().length) gameOver(true); else if (!clones().length) gameOver(false);
}
function gameOver(win) {
  phase = 'over'; busy = true; select(null);
  setTimeout(() => {
    win ? Snd.fx.win() : Snd.fx.lose();
    $('endTitle').textContent = win ? 'ПОБЕДА РЕСПУБЛИКИ' : 'ОТРЯД УНИЧТОЖЕН';
    $('endTitle').style.color = win ? 'var(--holo)' : '#ff8a7a';
    const lost = units.filter(u => u.team === 'clone' && !u.alive).length;
    $('endStats').innerHTML = `Ходов: <b>${turn}</b><br>Уничтожено дроидов: <b>${kills}</b> из ${units.filter(u => u.team === 'droid').length}<br>Потери: <b>${lost}</b> из 5`;
    $('endScr').classList.add('show'); document.body.classList.remove('playing');
  }, 900);
}

// =====================================================================
//  ВВОД: касания, мышь, клавиатура
// =====================================================================
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pick(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(units.filter(u => u.alive && u.rig.root.visible).map(u => u.hit), false);
  const p = new THREE.Vector3(); const g = ray.ray.intersectPlane(groundPlane, p);
  return { unit: hits.length ? hits[0].object.userData.unit : null, tile: g ? [Math.floor(p.x), Math.floor(p.z)] : null };
}
function onTap(cx, cy) {
  if (phase !== 'player' || busy) return;
  const { unit, tile } = pick(cx, cy);
  const u = selected;
  if (ui.mode === 'nade') {
    if (!tile) return;
    const [x, z] = tile; if (!inb(x, z) || Math.hypot(x - u.x, z - u.z) > 9) { Snd.fx.deny(); return; }
    if (ui.nadeTile && ui.nadeTile[0] === x && ui.nadeTile[1] === z) { throwNade(u, x, z); return; }
    ui.nadeTile = [x, z]; nadeRing.position.set(x + 0.5, 0.06, z + 0.5); nadeRing.visible = true; Snd.fx.click();
    const n = units.filter(t => t.alive && t.team === 'droid' && t.visible && Math.hypot(t.x - x, t.z - z) <= 1.5).length;
    hint(`Целей в радиусе: ${n}. Нажмите ещё раз, чтобы бросить`); return;
  }
  if (unit && unit.team === 'clone') { if (unit !== u) { select(unit); } return; }
  if (unit && unit.team === 'droid') {
    if (u && u.ap > 0 && shotInfo(u, unit)) enterTarget(unit); else { Snd.fx.deny(); hint('Цель вне линии огня'); setTimeout(() => hint(''), 1400); }
    return;
  }
  if (ui.mode === 'target') { hideTarget(); showMoveRange(); refreshUI(); return; }
  if (!tile || !u || !ui.reach) return;
  const [x, z] = tile; if (!inb(x, z)) return;
  const c = ui.reach.cost[id(x, z)];
  if (!isFinite(c) || c === 0) { if (cell(x, z) === FLOOR && !unitAt(x, z)) { Snd.fx.deny(); } return; }
  if (ui.pending && ui.pending[0] === x && ui.pending[1] === z) { doMove(u, x, z); return; }
  ui.pending = [x, z]; previewPath(x, z); Snd.fx.click();
  const cv = Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => cell(x + dx, z + dz)));
  hint((c <= u.mob + 0.01 ? 'Перемещение (1 очко)' : 'Рывок (2 очка)') + (cv === FULL ? ' · полное укрытие' : cv === HALF ? ' · частичное укрытие' : ' · без укрытия') + ' · нажмите ещё раз');
}
function onHover(cx, cy) {
  if (isTouch || phase !== 'player' || busy || ui.mode !== 'move' || !ui.reach) return;
  const { tile } = pick(cx, cy); if (!tile || !inb(...tile)) return;
  const c = ui.reach.cost[id(...tile)]; if (isFinite(c) && c > 0 && !(ui.pending && ui.pending[0] === tile[0] && ui.pending[1] === tile[1])) { ui.pending = tile; previewPath(...tile); }
}
async function doMove(u, x, z) {
  const c = ui.reach.cost[id(x, z)], path = pathTo(ui.reach, x, z);
  u.ap -= c <= u.mob + 0.01 ? 1 : 2; busy = true; ui.pending = null; moveTiles.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9); hint(''); refreshUI();
  await moveUnit(u, path);
  busy = false; refreshUI(); checkEnd(); if (phase === 'player') afterAction();
}

// жесты камеры
const ptrs = new Map(); let drag = null;
const el = renderer.domElement;
el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }); drag = { moved: false, pinch: null }; });
el.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) { onHover(e.clientX, e.clientY); return; }
  const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (cam.cine) return;
  if (ptrs.size === 1) {
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 9) drag.moved = true;
    if (!drag.moved) return;
    const s = cam.dist / innerHeight * 1.6, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    focus(cam.tfx - (dx * cy + dy * sy) * s, cam.tfz - (-dx * sy + dy * cy) * s, true);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (drag.pinch) { cam.tdist = clamp(cam.tdist * drag.pinch.d / d, 6, 34); cam.dist = cam.tdist; cam.tyaw -= ang - drag.pinch.a; cam.yaw = cam.tyaw; }
    drag.pinch = { d, a: ang }; drag.moved = true;
  }
});
const endPtr = e => { const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (p && drag && !drag.moved && ptrs.size === 0) onTap(e.clientX, e.clientY); if (ptrs.size < 2 && drag) drag.pinch = null; };
el.addEventListener('pointerup', endPtr); el.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
el.addEventListener('wheel', e => { e.preventDefault(); cam.tdist = clamp(cam.tdist * (e.deltaY > 0 ? 1.12 : 0.89), 6, 34); }, { passive: false });
el.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (phase === 'start') { if (e.code === 'Enter' || e.code === 'Space') startGame(); return; }
  const k = e.code;
  if (k === 'KeyQ') rotateCam(-1); else if (k === 'KeyE') rotateCam(1);
  else if (k === 'KeyW' || k === 'ArrowUp') pan(0, -2); else if (k === 'KeyS' || k === 'ArrowDown') pan(0, 2);
  else if (k === 'KeyA' || k === 'ArrowLeft') pan(-2, 0); else if (k === 'KeyD' || k === 'ArrowRight') pan(2, 0);
  else if (k === 'Tab') { e.preventDefault(); if (ui.mode === 'target') { ui.ti = (ui.ti + 1) % ui.targets.length; showTarget(); } else nextUnit(); }
  else if (k === 'Digit1') $('aShoot').click(); else if (k === 'Digit2') $('aOver').click(); else if (k === 'Digit3') $('aNade').click(); else if (k === 'Digit4') $('aHunk').click();
  else if (k === 'Enter') { if (ui.mode === 'target') $('tpFire').click(); else $('aEnd').click(); }
  else if (k === 'Escape') { if (ui.mode !== 'move') { hideTarget(); ui.mode = 'move'; nadeRing.visible = nadeRange.visible = false; showMoveRange(); refreshUI(); hint(''); } else openMenu(); }
  else if (k === 'KeyV') $('bView').click();
});
function pan(dx, dz) { const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); focus(cam.tfx + dx * cy + dz * sy, cam.tfz - dx * sy + dz * cy); }
function rotateCam(dir) { cam.tyaw += dir * Math.PI / 2; Snd.fx.click(); }

// кнопки
const on = (i, f) => $(i).addEventListener('click', e => { Snd.init(); f(e); });
on('aShoot', () => { if (ui.mode === 'target') { hideTarget(); showMoveRange(); refreshUI(); } else enterTarget(null); });
on('tpPrev', () => { ui.ti = (ui.ti - 1 + ui.targets.length) % ui.targets.length; Snd.fx.click(); showTarget(); });
on('tpNext', () => { ui.ti = (ui.ti + 1) % ui.targets.length; Snd.fx.click(); showTarget(); });
on('tpFire', async () => { const u = selected, t = ui.targets[ui.ti]; if (!u || !t || busy) return; u.ap = 0; ui.mode = 'move'; await shoot(u, t); afterAction(); });
on('aOver', () => { const u = selected; if (!u || u.ap <= 0 || busy) return; u.ap = 0; u.overwatch = true; Snd.fx.overwatch(); popText(u, 'ДОЗОР', 'miss'); afterAction(); refreshUI(); });
on('aHunk', () => { const u = selected; if (!u || u.ap <= 0 || busy) return; u.ap = 0; u.hunker = true; u.state = 'hunker'; Snd.fx.hunker(); popText(u, 'УКРЫЛСЯ', 'miss'); afterAction(); refreshUI(); });
on('aNade', () => {
  const u = selected; if (!u || u.ap <= 0 || !u.nades || busy) return;
  if (ui.mode === 'nade') { ui.mode = 'move'; nadeRing.visible = nadeRange.visible = false; hint(''); showMoveRange(); refreshUI(); return; }
  hideTarget(); ui.mode = 'nade'; ui.nadeTile = null; moveTiles.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9);
  nadeRange.position.set(u.x + 0.5, 0.05, u.z + 0.5); nadeRange.visible = true; hint('Выберите место броска (до 9 клеток)'); Snd.fx.click(); refreshUI();
});
on('aNext', () => nextUnit());
on('aEnd', () => endPlayerTurn());
on('bRotL', () => rotateCam(-1)); on('bRotR', () => rotateCam(1));
on('bView', () => { cam.mode = cam.mode === 'top' ? 'tactical' : 'top'; cam.tpitch = VIEWS[cam.mode].pitch; cam.tdist = VIEWS[cam.mode].dist; Snd.fx.click(); });
on('bMus', () => { Snd.setMus(!Snd.musOn); refreshUI(); });
on('bSfx', () => { Snd.setSfx(!Snd.sfxOn); refreshUI(); });
on('bMenu', () => openMenu());
on('bResume', () => { $('menuScr').classList.remove('show'); goFullscreen(); });
on('bRestart', () => { $('menuScr').classList.remove('show'); startGame(); });
on('bAgain', () => { $('endScr').classList.remove('show'); startGame(); });
on('bPlay', () => startGame());
on('bHow', () => $('howScr').classList.add('show'));
on('bHow2', () => { $('menuScr').classList.remove('show'); $('howScr').classList.add('show'); });
on('bHowOk', () => $('howScr').classList.remove('show'));
function openMenu() { $('menuScr').classList.add('show'); }
$('helpText').innerHTML = `
<b>Цель:</b> уничтожить всех дроидов. У каждого клона <b>2 очка действия</b> за ход.<br>
<b>Перемещение:</b> ${isTouch ? 'коснитесь' : 'наведите и щёлкните'} клетки — синие стоят 1 очко, жёлтые (рывок) — 2. ${isTouch ? 'Второе касание подтверждает ход.' : 'Щёлкните ещё раз для подтверждения.'}<br>
<b>Укрытия:</b> щиты показывают защиту — полная даёт −40% к попаданию врага, частичная −20%. Без укрытия юнит на <b>фланге</b> и получает больше критов.<br>
<b>Огонь</b> завершает действия бойца. Коснитесь дроида или кнопки «Огонь», выберите цель и нажмите «ОГОНЬ». Камера переходит в кинорежим — от первого или третьего лица.<br>
<b>Дозор</b> — выстрел по врагу, который двинется в поле зрения. <b>Укрыться</b> — удвоить защиту укрытия. <b>Граната</b> бьёт по площади и разрушает частичные укрытия.<br>
<b>Камера:</b> ${isTouch ? 'перетаскивайте пальцем, щипок — масштаб и поворот' : 'перетаскивание мышью, колесо — масштаб, Q/E — поворот, V — вид сверху'}.`;

// =====================================================================
//  ЗАПУСК
// =====================================================================
async function goFullscreen() {
  const d = document.documentElement;
  try { if (!document.fullscreenElement && d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) {}
}
function clearUnits() { for (const u of units) { world.remove(u.rig.root); if (u.label) u.label.remove(); for (const o of u.debris || []) world.remove(o); } units = []; }
let mapReady = false;
function setupWorld() {
  let seed = 20240 + Math.floor(Math.random() * 9999);
  while (!genMap(seed)) seed++;
  if (staticMesh) { world.remove(staticMesh); staticMesh.geometry.dispose(); }
  if (glowMesh) { world.remove(glowMesh); glowMesh.geometry.dispose(); }
  for (const o of halfProps.values()) world.remove(o); halfProps.clear(); smokeSources.length = 0;
  buildProps(); mapReady = true;
}
function spawnUnits() {
  clearUnits();
  SQUAD.forEach(([cls, call, num], i) => units.push(makeUnit('clone', cls, CLONE_SPAWN[i][0], CLONE_SPAWN[i][1], { call, num })));
  PODS.forEach((p, pi) => p.tiles.forEach(([x, z], k) => units.push(makeUnit('droid', p.types[k], x, z, { pod: pi, home: [x, z] }))));
}
async function startGame() {
  Snd.init(); Music.start(); goFullscreen();
  $('startScr').classList.remove('show'); $('endScr').classList.remove('show'); $('howScr').classList.remove('show');
  setupWorld(); spawnUnits(); turn = 1; kills = 0; shotCount = 0; podsActive = [false, false, false]; seenEver.fill(0);
  tweens.length = 0; busy = true; phase = 'intro'; cam.cine = null; document.body.classList.remove('cine');
  updateVisibility(); buildSquadUI(); document.body.classList.add('playing');
  // вступление: вид сверху на всё поле, затем спуск к отряду
  cam.mode = 'tactical'; cam.fx = cam.tfx = N / 2; cam.fz = cam.tfz = N / 2; cam.pitch = cam.tpitch = 1.5; cam.dist = cam.tdist = 46; cam.yaw = cam.tyaw = Math.PI * 0.75;
  hint('Разведка с орбиты…');
  await wait(1.4);
  cam.tpitch = VIEWS.tactical.pitch; cam.tdist = VIEWS.tactical.dist; focus(4.5, 27.5);
  await wait(1.6); hint('');
  busy = false; startPlayerTurn();
}

// ---------- главный цикл
let last = performance.now(), timeScale = 1; // timeScale — для автотестов
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  $('rotate').classList.toggle('show', isTouch && h > w);
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
let smokeT = 0, attractT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * timeScale; last = now;
  tweensUpdate(dt); FX.update(dt);
  for (const u of units) pose(u, dt);
  // дым над обломками
  smokeT -= dt; if (smokeT < 0) { smokeT = 0.35; for (const [x, y, z] of smokeSources) FX.puff(x + rand(-0.2, 0.2), y, z + rand(-0.2, 0.2), { color: 0x3b332e, life: 3.2, s0: 0.3, s1: 1.8, vy: 0.5, a: 0.45 }); }
  // кольцо выбранного
  if (selected && selected.alive && phase === 'player') { selRing.visible = true; selRing.position.set(selected.rig.root.position.x, 0.04, selected.rig.root.position.z); selRing.scale.setScalar(1 + Math.sin(now / 250) * 0.06); } else selRing.visible = false;
  tgtRing.rotation.z += dt * 1.5;
  if (phase === 'start') { attractT += dt; cam.tyaw = cam.yaw = Math.PI * 0.75 + attractT * 0.06; cam.fx = cam.tfx = N / 2; cam.fz = cam.tfz = N / 2; }
  camUpdate(dt); syncLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// стартовый экран: сцена на фоне
setupWorld(); spawnUnits(); for (const u of units) u.rig.root.visible = true;
cam.pitch = cam.tpitch = 1.05; cam.dist = cam.tdist = 30;
resize(); $('loading').remove(); requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { if (document.hidden) Music.stop(); else if (phase !== 'start') Music.start(); });
window.appPause = () => { Music.stop(); };
