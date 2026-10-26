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
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 300);
const SKY_H = '#f2b98a', SKY_T = '#7aa3c9';
scene.fog = new THREE.Fog(0xe7ab7c, 40, 190);
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, SKY_T); gr.addColorStop(0.55, '#e9b48c'); gr.addColorStop(1, SKY_H);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; scene.background = t;
}
const hemi = new THREE.HemisphereLight(0xffe7c7, 0x7a3e22, 0.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd7a8, 2.6);
sun.position.set(N / 2 - 16, 26, N / 2 + 12); sun.target.position.set(N / 2, 0, N / 2);
sun.castShadow = true; sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0x8fb6ff, 0.35); fill.position.set(N / 2 + 20, 14, N / 2 - 18); scene.add(fill);
// карта окружения: мягкие отражения неба на броне и металле
{
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#6f9cc8'); gr.addColorStop(0.45, '#f0c49a'); gr.addColorStop(0.55, '#c98652'); gr.addColorStop(1, '#5a3420');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1d0 })); sunBall.position.set(-5, 7, 4); es.add(sunBall);
  scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
}
// окольцованная планета в небе
{
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.translate(256, 256); g.rotate(-0.35);
  const ring = (front) => { g.save(); g.beginPath(); if (front) g.rect(-256, 0, 512, 256); else g.rect(-256, -256, 512, 256); g.clip(); for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(255,${210 - i * 10},${170 - i * 12},${0.32 - i * 0.04})`; g.lineWidth = 9 - i; g.beginPath(); g.ellipse(0, 0, 200 + i * 12, 46 + i * 3, 0, 0, 7); g.stroke(); } g.restore(); };
  ring(false);
  const pg = g.createRadialGradient(-40, -40, 10, 0, 0, 130); pg.addColorStop(0, '#f6d9b5'); pg.addColorStop(0.7, '#c98f6a'); pg.addColorStop(1, '#8a5a48');
  g.fillStyle = pg; g.beginPath(); g.arc(0, 0, 125, 0, 7); g.fill();
  g.fillStyle = 'rgba(120,70,50,.25)'; for (let i = 0; i < 5; i++) { g.fillRect(-125, -70 + i * 32, 250, 9); }
  ring(true);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, transparent: true, depthWrite: false, opacity: 0.85 }));
  sp.position.set(N / 2 - 70, 46, N / 2 - 95); sp.scale.setScalar(70); scene.add(sp);
}
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
// Земля: карта высот (дюны, рябь песка, каменные плиты, швы сетки, камешки) -> цвет + карта нормалей
function groundTextures() {
  const S = 1024, T = S / N, H = new Float32Array(S * S), slab = new Uint8Array(N * N), R = rng(77);
  function addNoise(cell, amp, seed) {
    const Rn = rng(seed), G = Math.ceil(S / cell) + 2, g = new Float32Array(G * G);
    for (let i = 0; i < g.length; i++) g[i] = Rn() * 2 - 1;
    for (let y = 0; y < S; y++) {
      const fy = y / cell, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < S; x++) {
        const fx = x / cell, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx), o = iy * G + ix;
        const top = g[o] + (g[o + 1] - g[o]) * sx, bot = g[o + G] + (g[o + G + 1] - g[o + G]) * sx;
        H[y * S + x] += amp * (top + (bot - top) * sy);
      }
    }
  }
  addNoise(170, 12, 1); addNoise(48, 4, 2); addNoise(9, 0.9, 3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) H[y * S + x] += 1.4 * Math.sin(x * 0.17 + y * 0.06 + Math.sin(y * 0.02 + x * 0.006) * 4);
  // каменные плиты, наполовину занесённые песком
  for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) {
    const inOutpost = tx >= 13 && tx <= 19 && tz >= 12 && tz <= 19;
    if (!(inOutpost || R() < 0.12)) continue;
    slab[tz * N + tx] = 1;
    const x0 = tx * T, y0 = tz * T, lift = inOutpost ? 7 : 4 + R() * 4;
    for (let y = 2; y < T - 2; y++) for (let x = 2; x < T - 2; x++) {
      const e = Math.min(x - 2, y - 2, T - 3 - x, T - 3 - y), k = Math.min(1, e / 3);
      H[(y0 + y) * S + x0 + x] += lift * k * k * (3 - 2 * k);
    }
  }
  // швы сетки
  for (let i = 0; i <= N; i++) { const p = Math.min(S - 1, i * T); for (let t = 0; t < S; t++) for (const o of [-1, 0]) { const q = p + o; if (q < 0 || q >= S) continue; H[t * S + q] -= 2.2; H[q * S + t] -= 2.2; } }
  // камешки
  const pebs = [];
  for (let i = 0; i < 2600; i++) {
    const cx = R() * S, cy = R() * S, r = 0.8 + R() * 2.2; pebs.push([cx, cy, r]);
    for (let y = Math.max(0, cy - r | 0); y <= Math.min(S - 1, cy + r); y++) for (let x = Math.max(0, cx - r | 0); x <= Math.min(S - 1, cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) H[y * S + x] += 3 * Math.sqrt(1 - d * d);
    }
  }
  // цвет
  const cc = document.createElement('canvas'); cc.width = cc.height = S; const cg = cc.getContext('2d'), img = cg.createImageData(S, S), d = img.data;
  const nc = document.createElement('canvas'); nc.width = nc.height = S; const ng = nc.getContext('2d'), nimg = ng.createImageData(S, S), nd = nimg.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, h = H[i], isSlab = slab[((y / T) | 0) * N + ((x / T) | 0)];
    let r = 203, g = 136, b = 84;
    if (isSlab) { r = 178; g = 146; b = 116; }
    const sh = 0.9 + h * 0.012 + (R() - 0.5) * 0.06;
    d[i * 4] = clamp(r * sh, 0, 255); d[i * 4 + 1] = clamp(g * sh, 0, 255); d[i * 4 + 2] = clamp(b * sh * 0.97, 0, 255); d[i * 4 + 3] = 255;
    const hl = H[y * S + Math.max(0, x - 1)], hr = H[y * S + Math.min(S - 1, x + 1)], hu = H[Math.max(0, y - 1) * S + x], hd = H[Math.min(S - 1, y + 1) * S + x];
    let nx = (hl - hr) * 0.11, ny = (hd - hu) * 0.11, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    nd[i * 4] = (nx * 0.5 + 0.5) * 255; nd[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; nd[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; nd[i * 4 + 3] = 255;
  }
  cg.putImageData(img, 0, 0); ng.putImageData(nimg, 0, 0);
  // трещины на плитах и тёмные камешки
  cg.strokeStyle = 'rgba(70,45,25,.45)'; cg.lineWidth = 1;
  for (let tz = 0; tz < N; tz++) for (let tx = 0; tx < N; tx++) if (slab[tz * N + tx] && R() < 0.6) {
    let x = tx * T + 4 + R() * (T - 8), y = tz * T + 4 + R() * (T - 8); cg.beginPath(); cg.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x = clamp(x + (R() - 0.5) * 14, tx * T + 3, tx * T + T - 3); y = clamp(y + (R() - 0.5) * 14, tz * T + 3, tz * T + T - 3); cg.lineTo(x, y); } cg.stroke();
  }
  for (const [x, y, r] of pebs) { cg.fillStyle = R() < 0.5 ? 'rgba(110,62,32,.55)' : 'rgba(160,110,80,.5)'; cg.beginPath(); cg.arc(x, y, r * 0.8, 0, 7); cg.fill(); }
  const map = new THREE.CanvasTexture(cc); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
  const normalMap = new THREE.CanvasTexture(nc); normalMap.anisotropy = 8;
  return { map, normalMap };
}
const world = new THREE.Group(); scene.add(world);
{
  const gt = groundTextures();
  const g = mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshStandardMaterial({ map: gt.map, normalMap: gt.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.93 }), false);
  g.rotation.x = -Math.PI / 2; g.position.set(N / 2, 0, N / 2); world.add(g);
  const outer = mesh(new THREE.PlaneGeometry(400, 400), mat(0xc98652, { roughness: 1 }), false);
  outer.rotation.x = -Math.PI / 2; outer.position.set(N / 2, -0.02, N / 2); world.add(outer);
}

// ---------- слияние статичной геометрии в один меш с цветами вершин
function merged(parts, m, ao = true) {
  let total = 0; const prepared = parts.map(p => { const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()); g.applyMatrix4(p.mtx); g.computeVertexNormals(); total += g.attributes.position.count; return [g, p.color]; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  for (const [g, c] of prepared) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    const py = g.attributes.position.array;
    for (let i = 0; i < g.attributes.position.count; i++) { const f = ao ? 0.5 + 0.5 * Math.min(1, Math.max(0, py[i * 3 + 1]) / 1.3) : 1; col[(o + i) * 3] = c.r * f; col[(o + i) * 3 + 1] = c.g * f; col[(o + i) * 3 + 2] = c.b * f; }
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
const PROPM = {
  crateA: mat(0x6c7684, { metalness: 0.5, roughness: 0.42 }), crateB: mat(0x8c7f63, { metalness: 0.35, roughness: 0.5 }),
  frame: mat(0x30353d, { metalness: 0.6, roughness: 0.4 }), barrier: mat(0x5c6470, { metalness: 0.6, roughness: 0.35 }), stripe: mat(0xb8392a, { roughness: 0.5 }),
  lightO: new THREE.MeshBasicMaterial({ color: 0xffa13d }), lightB: new THREE.MeshBasicMaterial({ color: 0x7fd4ff }),
};
// мягкая контактная тень под объектами и юнитами
const BLOB_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(30,15,5,.55)'); g.addColorStop(1, 'rgba(30,15,5,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const BLOB_MAT = new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false });
let blobs = null;
function buildBlobs() {
  if (blobs) world.remove(blobs);
  const geo = new THREE.PlaneGeometry(1.5, 1.5); geo.rotateX(-Math.PI / 2);
  blobs = new THREE.InstancedMesh(geo, BLOB_MAT, N * N); blobs.frustumCulled = false; blobs.renderOrder = 1; let k = 0; const d = new THREE.Object3D();
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (grid[id(x, z)] !== FLOOR && kind[id(x, z)] !== K.EDGE) { d.position.set(x + 0.5, 0.014, z + 0.5); d.updateMatrix(); blobs.setMatrixAt(k++, d.matrix); }
  blobs.count = k; world.add(blobs);
}
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
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(BOX, cx + sx * 0.47, 0.65, cz + sz * 0.47, 0, 0, 0, 0.07, 1.32, 0.07, 0x2a2420);
      for (const sz of [-1, 1]) { add(BOX, cx, 0.65, cz + sz * 0.505, 0, 0, 0, 0.02, 1.2, 0.02, 0x1d1915); add(BOX, cx + 0.08, 0.6, cz + sz * 0.52, 0, 0, 0, 0.04, 0.5, 0.03, 0xa8a090); add(BOX, cx - 0.08, 0.6, cz + sz * 0.52, 0, 0, 0, 0.04, 0.5, 0.03, 0xa8a090); }
      add(BOX, cx, 0.03, cz, 0, 0, 0, 1.04, 0.06, 1.04, 0x2a2420);
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
    const a = R() * Math.PI * 2, r = 52 + R() * 50, x = N / 2 + Math.cos(a) * r, z = N / 2 + Math.sin(a) * r, h = 8 + R() * 22;
    add(new THREE.CylinderGeometry(1, 1.25, 1, 9, 3), x, h / 2, z, 0, R() * 6, 0, 1.5 + R() * 3.5, h, 1.5 + R() * 3.5, rockCols[i % 4]);
    if (R() < 0.5) add(rockGeo(R, 0), x, h, z, 0, R() * 6, 0, 2 + R() * 2, 1, 2 + R() * 2, 0x8f4f2d);
  }
  // сухие кусты и обломки на свободных клетках (не мешают ходить)
  const CONE = new THREE.ConeGeometry(1, 1, 5), CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
  for (let i = 0; i < 70; i++) {
    const x = 1 + Math.floor(R() * (N - 2)), z = 1 + Math.floor(R() * (N - 2)); if (grid[id(x, z)] !== FLOOR) continue;
    const px = x + 0.15 + R() * 0.7, pz = z + 0.15 + R() * 0.7;
    if (i % 3) { for (let b = 0; b < 5; b++) add(CONE, px + (R() - 0.5) * 0.15, 0.1, pz + (R() - 0.5) * 0.15, (R() - 0.5) * 0.9, R() * 6, (R() - 0.5) * 0.9, 0.025, 0.24 + R() * 0.12, 0.025, R() < 0.5 ? 0x7d7442 : 0x9a7f4a); }
    else { add(BOX, px, 0.04, pz, R(), R() * 6, R() * 0.5, 0.12, 0.05, 0.18, 0xb8a072); add(CYL6, px + 0.12, 0.03, pz, 0, R() * 6, Math.PI / 2, 0.025, 0.25, 0.025, 0x4a4236); add(BOX, px - 0.1, 0.03, pz + 0.1, 0, R() * 6, 0, 0.06, 0.03, 0.2, 0x8f7a55); }
  }
  // сферические корабли Сепаратистов вдали
  const SPH = new THREE.SphereGeometry(1, 28, 18), TOR = new THREE.TorusGeometry(1, 0.035, 6, 48);
  for (const [a, r, rad] of [[-2.2, 120, 22], [-1.4, 150, 28]]) {
    const x = N / 2 + Math.cos(a) * r, z = N / 2 + Math.sin(a) * r;
    add(SPH, x, rad * 0.55, z, 0, 0, 0, rad, rad, rad, 0x8c7f76);
    add(TOR, x, rad * 0.55, z, Math.PI / 2, 0, 0, rad * 1.02, rad * 1.02, rad * 1.6, 0x5f5650);
    add(TOR, x, rad * 0.95, z, Math.PI / 2, 0, 0, rad * 0.8, rad * 0.8, rad * 1.2, 0x5f5650);
  }
  staticMesh = merged(parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1, flatShading: true }));
  world.add(staticMesh);
  if (glow.length) { glowMesh = merged(glow, new THREE.MeshBasicMaterial({ vertexColors: true }), false); glowMesh.castShadow = false; world.add(glowMesh); }
  // разрушаемые полуукрытия — отдельные объекты
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const k = kind[id(x, z)], cx = x + 0.5, cz = z + 0.5; let o = null;
    if (k === K.ROCK_S) { o = mesh(rockGeo(R, 0), new THREE.MeshStandardMaterial({ color: rockCols[Math.floor(R() * 4)], roughness: 0.9, flatShading: true })); at(o, cx, 0.3, cz, R(), R() * 6, 0); o.scale.set(0.46, 0.38, 0.46); }
    else if (k === K.CRATE) {
      // металлический ящик с каркасом, панелями и световой полосой
      o = new THREE.Group(); const base = R() < 0.5 ? PROPM.crateA : PROPM.crateB;
      o.add(at(rbox(0.74, 0.54, 0.74, base, 0.04), 0, 0.29, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.add(at(rbox(0.07, 0.6, 0.07, PROPM.frame, 0.02), sx * 0.37, 0.3, sz * 0.37));
      for (const y of [0.03, 0.57]) for (const r of [0, Math.PI / 2]) { const bar = rbox(0.8, 0.06, 0.06, PROPM.frame, 0.02); bar.rotation.y = r; for (const sd of [-1, 1]) { const b2 = bar.clone(); b2.position.set(r ? sd * 0.37 : 0, y, r ? 0 : sd * 0.37); o.add(b2); } }
      for (const sd of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.01), PROPM.lightO); st.position.set(0, 0.38, sd * 0.375); o.add(st); }
      o.add(at(rbox(0.5, 0.04, 0.5, PROPM.frame, 0.015), 0, 0.58, 0));
      if (R() < 0.3) { const small = new THREE.Group(); small.add(at(rbox(0.38, 0.3, 0.38, base, 0.03), 0, 0.15, 0)); small.add(at(rbox(0.4, 0.04, 0.4, PROPM.frame, 0.015), 0, 0.3, 0)); at(small, 0.08, 0.58, -0.05, 0, R(), 0); o.add(small); }
      at(o, cx, 0, cz, 0, Math.floor(R() * 4) * Math.PI / 2 + (R() - 0.5) * 0.2, 0);
    } else if (k === K.BARRIER) {
      // переносной барьер с эмиттером поверху
      o = new THREE.Group(); const hor = kind[id(x - 1, z)] === K.BARRIER || kind[id(x + 1, z)] === K.BARRIER;
      o.add(at(rbox(0.98, 0.5, 0.24, PROPM.barrier, 0.05), 0, 0.3, 0));
      o.add(at(rbox(1.0, 0.09, 0.34, PROPM.frame, 0.03), 0, 0.05, 0));
      o.add(at(rbox(0.96, 0.07, 0.16, PROPM.frame, 0.025), 0, 0.57, 0));
      o.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.05), PROPM.lightB), 0, 0.62, 0));
      for (const sd of [-0.33, 0, 0.33]) { o.add(at(rbox(0.07, 0.42, 0.27, PROPM.stripe, 0.02), sd, 0.3, 0)); }
      at(o, cx, 0, cz, 0, hor ? 0 : Math.PI / 2, 0);
    }
    if (o) { world.add(o); halfProps.set(id(x, z), o); }
  }
}
// мелкие камешки на песке (один InstancedMesh)
let pebbles = null;
function buildPebbles() {
  if (pebbles) world.remove(pebbles);
  const R = rng(99), geo = new THREE.IcosahedronGeometry(1, 0), n = 420;
  pebbles = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), n);
  const d = new THREE.Object3D(), c = new THREE.Color(); let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const x = R() * N, z = R() * N; if (cell(Math.floor(x), Math.floor(z)) !== FLOOR) continue;
    const s = 0.02 + R() * 0.05; d.position.set(x, s * 0.3, z); d.rotation.set(R() * 3, R() * 3, R() * 3); d.scale.set(s, s * 0.6, s * (0.8 + R() * 0.5)); d.updateMatrix();
    pebbles.setMatrixAt(k, d.matrix); pebbles.setColorAt(k, c.setHSL(0.06 + R() * 0.03, 0.45, 0.25 + R() * 0.2)); k++;
  }
  pebbles.count = k; pebbles.receiveShadow = true; pebbles.frustumCulled = false; world.add(pebbles);
}
const dust = (() => {
  const n = 260, pos = new Float32Array(n * 3), R = rng(5);
  for (let i = 0; i < n; i++) pos.set([R() * N, R() * 3, R() * N], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, map: TEX_DUST(), color: 0xffe2b8, transparent: true, opacity: 0.55, depthWrite: false }));
  p.frustumCulled = false; scene.add(p); return p;
})();
function TEX_DUST() { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); }
function dustUpdate(dt) {
  const a = dust.geometry.attributes.position, t = performance.now() / 1000;
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i) + dt * (0.35 + Math.sin(t + i) * 0.1), y = a.getY(i) + Math.sin(t * 0.7 + i * 1.3) * dt * 0.05, z = a.getZ(i) + dt * 0.12;
    if (x > N) x -= N; if (z > N) z -= N; a.setXYZ(i, x, y, z);
  }
  a.needsUpdate = true;
}
function destroyCover(x, z) {
  if (!inb(x, z) || grid[id(x, z)] !== HALF) return;
  const o = halfProps.get(id(x, z)); if (o) { world.remove(o); halfProps.delete(id(x, z)); }
  grid[id(x, z)] = FLOOR; kind[id(x, z)] = K.NONE; buildBlobs();
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
TEX.star = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.translate(64, 64);
  const gr = x.createRadialGradient(0, 0, 0, 0, 0, 40); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(-64, -64, 128, 128);
  for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); const g2 = x.createLinearGradient(0, 0, 62, 0); g2.addColorStop(0, 'rgba(255,255,255,.95)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.beginPath(); x.moveTo(0, -5); x.lineTo(62, 0); x.lineTo(0, 5); x.fill(); }
  return new THREE.CanvasTexture(c);
})();
TEX.scorch = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(20,10,5,.85)'); gr.addColorStop(0.5, 'rgba(40,20,10,.5)'); gr.addColorStop(1, 'rgba(40,20,10,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const TEAMCOL = { clone: 0x4fb4ff, droid: 0xff3b2a };
const boltLight = new THREE.PointLight(0xffffff, 0, 4, 2); scene.add(boltLight);

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
  // заряд бластера: белое ядро, цветное свечение, шлейф и бегущий свет
  const boltGeo = new THREE.CapsuleGeometry(0.02, 0.8, 3, 6), glowGeo = new THREE.CapsuleGeometry(0.06, 0.85, 3, 8), trailGeo = new THREE.CylinderGeometry(0.04, 0.0, 1.6, 8, 1, true);
  boltGeo.rotateX(Math.PI / 2); glowGeo.rotateX(Math.PI / 2); trailGeo.rotateX(Math.PI / 2); trailGeo.translate(0, 0, -1.1);
  const boltMats = {};
  for (const team of ['clone', 'droid']) boltMats[team] = [
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }),
    new THREE.MeshBasicMaterial({ color: TEAMCOL[team], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    new THREE.MeshBasicMaterial({ color: TEAMCOL[team], transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
  ];
  function bolt(from, to, team, speed = 40, onMove = null) {
    return new Promise(res => {
      const g = new THREE.Group(), [a, b, c] = boltMats[team];
      g.add(new THREE.Mesh(boltGeo, a), new THREE.Mesh(glowGeo, b), new THREE.Mesh(trailGeo, c));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: TEAMCOL[team], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })); sp.scale.setScalar(0.5); g.add(sp);
      g.position.copy(from); g.lookAt(to); scene.add(g);
      boltLight.color.set(TEAMCOL[team]); boltLight.intensity = 2.5;
      const dist = from.distanceTo(to); live.push({ g, sp, from: from.clone(), to: to.clone(), t: 0, dur: Math.max(0.06, dist / speed), res, team, onMove });
    });
  }
  function muzzle(p, color) {
    const s = sprite(TEX.star, color, true); s.position.copy(p); s.material.rotation = Math.random() * 3;
    sprites.push({ s, t: 0, life: 0.09, s0: 0.35, s1: 0.6, vy: 0, vx: 0, vz: 0, a: 1, flash: true });
    flash(p.x, p.y, p.z, color, 0.5, 0.08); puff(p.x, p.y, p.z, { color: 0x9a9a9a, life: 0.8, s0: 0.08, s1: 0.4, vy: 0.25, a: 0.35 });
  }
  const scorches = [], scorchGeo = new THREE.PlaneGeometry(1, 1); scorchGeo.rotateX(-Math.PI / 2);
  const scorchMat = new THREE.MeshBasicMaterial({ map: TEX.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  function scorch(x, z, size) {
    const m = new THREE.Mesh(scorchGeo, scorchMat); m.position.set(x, 0.012, z); m.rotation.y = Math.random() * 6; m.scale.setScalar(size * 2); m.renderOrder = 1; world.add(m); scorches.push(m);
    if (scorches.length > 60) world.remove(scorches.shift());
  }
  function clearDecals() { for (const m of scorches) world.remove(m); scorches.length = 0; }
  const rings = [];
  function explosion(x, z) {
    flash(x, 0.8, z, 0xffb050, 3.2, 0.35);
    for (let i = 0; i < 14; i++) puff(x + rand(-0.6, 0.6), rand(0.3, 1.2), z + rand(-0.6, 0.6), { color: i < 5 ? 0xffa040 : 0x4a3b33, life: rand(1.2, 2.6), s0: 0.6, s1: rand(2, 3.4), vy: rand(0.6, 1.8), vx: rand(-1, 1), vz: rand(-1, 1), a: i < 5 ? 0.9 : 0.7 });
    spark(x, 0.5, z, 0xffc070, 60, 6); scorch(x, z, 1.3);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffd090, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.06, z); scene.add(ring); rings.push({ m: ring, t: 0 });
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i]; b.t += dt; const k = Math.min(1, b.t / b.dur);
      b.g.position.lerpVectors(b.from, b.to, k); boltLight.position.copy(b.g.position);
      if (b.onMove) b.onMove(b.g.position);
      if (k >= 1) { scene.remove(b.g); b.sp.material.dispose(); live.splice(i, 1); b.res(); if (!live.length) boltLight.intensity = 0; }
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
  return { spark, debris, puff, flash, bolt, muzzle, scorch, clearDecals, explosion, update };
})();

// =====================================================================
//  МОДЕЛИ ЮНИТОВ
// =====================================================================
// Скруглённый параллелепипед: вершины коробки «надуваются» к скруглённым рёбрам
function roundBox(w, h, d, r = 0.03, seg = 3) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r, v = new THREE.Vector3(), inner = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); inner.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
    v.sub(inner); const L = v.length();
    if (L > 1e-6) { v.multiplyScalar(1 / L); n.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, inner.x + v.x * r, inner.y + v.y * r, inner.z + v.z * r); }
  }
  return g;
}
const rbox = (w, h, d, m, r = 0.03) => mesh(roundBox(w, h, d, r), m);
const caps = (r, len, m, seg = 10) => mesh(new THREE.CapsuleGeometry(r, len, 4, seg), m);
const HELMET_GEO = (() => {
  const pts = [[0.001, 0.172], [0.05, 0.17], [0.092, 0.158], [0.124, 0.136], [0.145, 0.1], [0.156, 0.05], [0.158, 0], [0.154, -0.05], [0.147, -0.095], [0.138, -0.13], [0.128, -0.155]];
  const g = new THREE.LatheGeometry(pts.reverse().map(([x, y]) => new THREE.Vector2(x, y)), 28); g.scale(1, 1, 1.12); return g;
})();
const B1HEAD_GEO = (() => {
  // вытянутая «морда» боевого дроида: профиль вращения вдоль оси Y, затем поворот вперёд
  const pts = [[0.001, -0.2], [0.03, -0.198], [0.045, -0.18], [0.052, -0.1], [0.062, 0], [0.075, 0.08], [0.085, 0.12], [0.084, 0.15], [0.07, 0.175], [0.04, 0.19], [0.001, 0.195]];
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 16); g.rotateX(-Math.PI / 2); g.scale(1.15, 0.85, 1); return g;
})();

// материалы
const M2 = {
  armor: mat(0xf2f4f6, { roughness: 0.28, metalness: 0.05 }), armorD: mat(0xc9cfd5, { roughness: 0.4, metalness: 0.05 }),
  suit: mat(0x17191d, { roughness: 0.85 }), visor: mat(0x07080a, { roughness: 0.08, metalness: 0.9 }),
  gun: mat(0x1c1e22, { roughness: 0.38, metalness: 0.65 }), gunL: mat(0x6b717a, { roughness: 0.3, metalness: 0.8 }),
  tan: mat(0xcdb27e, { roughness: 0.48, metalness: 0.35 }), tanD: mat(0x8f7a55, { roughness: 0.55, metalness: 0.35 }), tanJ: mat(0x4a4236, { roughness: 0.5, metalness: 0.6 }),
  b2: mat(0x7f8b9c, { roughness: 0.34, metalness: 0.7 }), b2D: mat(0x4c5562, { roughness: 0.5, metalness: 0.5 }),
  eye: mat(0x0a0a0a, { roughness: 0.2, metalness: 0.6 }), glowR: new THREE.MeshBasicMaterial({ color: 0xff4030 }),
};
const CLS_COL = { trooper: 0x2f6fdc, heavy: 0xc8302a, sniper: 0x4c8a3c, commander: 0xe07b22 };

// Склейка мешей одного шарнира с одинаковым материалом — меньше вызовов отрисовки
function mergeRig(root) {
  root.traverse(node => {
    if (node.isMesh) return;
    const groups = new Map();
    for (const c of node.children) if (c.isMesh && !c.userData.keep) { if (!groups.has(c.material)) groups.set(c.material, []); groups.get(c.material).push(c); }
    for (const [m, list] of groups) {
      if (list.length < 2) continue;
      let total = 0; const geos = list.map(c => { c.updateMatrix(); const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()); g.applyMatrix4(c.matrix); total += g.attributes.position.count; return g; });
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3); let o = 0;
      for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      for (const c of list) node.remove(c);
      node.add(mesh(bg, m));
    }
  });
}

function rifle(gun, cls) {
  const A = M2.gun, L = M2.gunL;
  if (cls === 'heavy') { // ротационный бластер
    gun.add(at(rbox(0.13, 0.15, 0.42, A, 0.03), 0, 0, 0.08));
    for (let i = 0; i < 6; i++) gun.add(at(cyl(0.017, 0.017, 0.46, L, 6), Math.cos(i * 1.047) * 0.045, Math.sin(i * 1.047) * 0.045, 0.48, Math.PI / 2));
    gun.add(at(cyl(0.07, 0.07, 0.05, A, 12), 0, 0, 0.32, Math.PI / 2)); gun.add(at(cyl(0.07, 0.07, 0.04, A, 12), 0, 0, 0.66, Math.PI / 2));
    gun.add(at(rbox(0.05, 0.16, 0.07, A, 0.02), 0, -0.13, 0.02)); gun.add(at(rbox(0.12, 0.1, 0.16, M2.armorD, 0.03), -0.1, -0.02, 0.05));
    return 0.72;
  }
  const long = cls === 'sniper';
  gun.add(at(rbox(0.055, 0.085, 0.36, A, 0.015), 0, 0, 0.08));
  gun.add(at(cyl(0.017, 0.02, long ? 0.62 : 0.34, L, 8), 0, 0.012, long ? 0.56 : 0.42, Math.PI / 2));
  gun.add(at(cyl(0.028, 0.028, 0.06, A, 8), 0, 0.012, long ? 0.86 : 0.58, Math.PI / 2));
  gun.add(at(rbox(0.04, 0.11, 0.05, A, 0.012), 0, -0.09, 0.02));
  gun.add(at(rbox(0.045, 0.075, 0.2, A, 0.015), 0, -0.01, -0.18));
  gun.add(at(rbox(0.03, 0.08, 0.04, L, 0.01), 0.04, -0.03, 0.12));
  gun.add(at(cyl(0.024, 0.024, long ? 0.3 : 0.16, A, 10), 0, 0.075, 0.08, Math.PI / 2));
  gun.add(at(cyl(0.026, 0.026, 0.01, L, 10), 0, 0.075, long ? 0.23 : 0.16, Math.PI / 2));
  return long ? 0.9 : 0.62;
}
function buildClone(cls) {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0), stripe = mat(CLS_COL[cls], { roughness: 0.35 });
  const W = M2.armor, S = M2.suit, rig = { root, body, kind: 'clone' };
  const hips = rig.hips = pivot(body, 0, 0.95, 0);
  hips.add(at(rbox(0.3, 0.15, 0.2, S, 0.05), 0, 0, 0));
  hips.add(at(rbox(0.32, 0.06, 0.21, S, 0.02), 0, 0.06, 0));
  hips.add(at(rbox(0.12, 0.13, 0.05, W, 0.02), 0, -0.05, 0.1));
  for (const s of [-1, 1]) hips.add(at(rbox(0.06, 0.05, 0.05, W, 0.015), s * 0.1, 0.06, 0.1));
  hips.add(at(rbox(0.14, 0.08, 0.05, W, 0.02), 0, 0.02, -0.11));
  for (const a of [-0.9, -0.45, 0.45, 0.9, 2.4, -2.4]) hips.add(at(rbox(0.06, 0.06, 0.04, S, 0.015), Math.sin(a) * 0.165, 0.05, Math.cos(a) * 0.115, 0, a));
  hips.add(at(cyl(0.035, 0.035, 0.08, M2.gunL, 10), 0.06, 0.04, -0.14, 0, 0, Math.PI / 2));
  for (const side of [-1, 1]) {
    const hip = pivot(hips, side * 0.1, -0.05, 0), knee = pivot(hip, 0, -0.42, 0);
    hip.add(at(caps(0.065, 0.28, S), 0, -0.2, 0));
    hip.add(at(rbox(0.135, 0.25, 0.155, W, 0.05), side * 0.005, -0.17, 0.012));
    knee.add(at(sph(0.06, S, 10, 8), 0, 0, 0));
    knee.add(at(rbox(0.11, 0.07, 0.06, W, 0.02), 0, -0.02, 0.06));
    knee.add(at(caps(0.062, 0.26, W), 0, -0.2, 0));
    knee.add(at(rbox(0.12, 0.09, 0.25, S, 0.035), 0, -0.41, 0.035));
    knee.add(at(rbox(0.12, 0.06, 0.13, W, 0.03), 0, -0.39, 0.1));
    if (side > 0 && cls !== 'heavy') { hip.add(at(rbox(0.05, 0.16, 0.09, S, 0.02), 0.085, -0.13, 0.0)); hip.add(at(rbox(0.035, 0.08, 0.12, M2.gun, 0.012), 0.09, -0.04, 0.02)); }
    rig[side < 0 ? 'hipL' : 'hipR'] = hip; rig[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  const torso = rig.torso = pivot(hips, 0, 0.07, 0);
  torso.add(at(rbox(0.26, 0.2, 0.17, S, 0.06), 0, 0.1, 0));
  torso.add(at(rbox(0.22, 0.12, 0.05, W, 0.025), 0, 0.1, 0.085));
  torso.add(at(rbox(0.38, 0.27, 0.23, W, 0.07), 0, 0.33, 0.005));
  torso.add(at(rbox(0.33, 0.3, 0.1, W, 0.04), 0, 0.31, -0.13));
  torso.add(at(rbox(0.26, 0.2, 0.09, S, 0.03), 0, 0.3, -0.2));
  torso.add(at(rbox(0.14, 0.06, 0.12, S, 0.02), 0, 0.49, 0));
  torso.add(at(rbox(0.05, 0.25, 0.02, stripe, 0.01), 0.1, 0.34, 0.12));
  if (cls === 'commander') { torso.add(at(rbox(0.05, 0.25, 0.02, stripe, 0.01), -0.1, 0.34, 0.12)); torso.add(at(cyl(0.006, 0.006, 0.45, M2.gunL, 4), -0.1, 0.62, -0.22)); }
  const head = rig.head = pivot(torso, 0, 0.58, 0.01);
  head.add(at(caps(0.055, 0.05, S), 0, -0.08, 0));
  head.add(at(mesh(HELMET_GEO, W), 0, 0.03, 0));
  // Т-образный визор облегает шлем: сегменты сферы чуть больше купола
  const seg = (ps, pl, ts, tl, m, r = 0.163) => { const g = new THREE.SphereGeometry(r, 24, 6, ps, pl, ts, tl); g.scale(1, 1, 1.12); return at(mesh(g, m), 0, 0.03, 0); };
  head.add(seg(Math.PI / 2 - 0.78, 1.56, 1.16, 0.3, M2.visor));
  head.add(seg(Math.PI / 2 - 0.2, 0.4, 1.4, 0.58, M2.visor));
  head.add(seg(Math.PI / 2 - 0.85, 1.7, 1.08, 0.08, M2.armorD, 0.164));
  head.add(seg(Math.PI / 2 - 0.42, 0.84, 2.0, 0.42, M2.armorD, 0.161));
  for (let i = -1; i <= 1; i++) head.add(at(box(0.008, 0.03, 0.01, M2.armorD), i * 0.02, -0.108, 0.17, 0.25));
  for (const s of [-1, 1]) head.add(at(cyl(0.035, 0.035, 0.03, M2.armorD, 12), s * 0.158, -0.02, 0, 0, 0, Math.PI / 2));
  head.add(at(rbox(0.035, 0.03, 0.27, stripe, 0.012), 0, 0.185, -0.005));
  if (cls === 'commander') head.add(at(rbox(0.02, 0.12, 0.02, M2.gunL, 0.006), 0.16, 0.08, 0.04));
  if (cls === 'sniper') head.add(at(cyl(0.025, 0.025, 0.06, M2.visor, 10), 0.11, 0.05, 0.12, Math.PI / 2));
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.235, 0.43, 0), el = pivot(sh, 0, -0.28, 0);
    const pauld = sph(0.095, W, 14, 10); pauld.scale.set(0.9, 0.62, 1.1); sh.add(at(pauld, side * 0.02, 0.0, 0));
    if (side > 0 || cls === 'commander') { const st = mesh(new THREE.SphereGeometry(0.097, 14, 6, 0, Math.PI * 2, 0, 0.6), stripe); st.scale.set(0.9, 0.62, 1.1); sh.add(at(st, side * 0.021, 0.003, 0)); }
    sh.add(at(caps(0.045, 0.18, S), 0, -0.13, 0));
    sh.add(at(caps(0.053, 0.1, W), 0, -0.12, 0.005));
    el.add(at(caps(0.05, 0.15, W), 0, -0.12, 0));
    el.add(at(rbox(0.07, 0.07, 0.09, S, 0.03), 0, -0.26, 0.01));
    for (let f = 0; f < 3; f++) el.add(at(rbox(0.016, 0.05, 0.02, S, 0.006), (f - 1) * 0.02, -0.3, 0.035));
    rig[side < 0 ? 'shL' : 'shR'] = sh; rig[side < 0 ? 'elL' : 'elR'] = el;
  }
  const gun = rig.gun = pivot(torso, 0.07, 0.3, 0.17);
  rig.muzzle = pivot(gun, 0, 0.012, rifle(gun, cls));
  rig.twoHand = true;
  return rig;
}
function buildDroid(type) {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0), rig = { root, body, kind: type };
  if (type === 'b2') {
    const B = M2.b2, D = M2.b2D;
    const hips = rig.hips = pivot(body, 0, 0.9, 0);
    hips.add(at(rbox(0.36, 0.16, 0.24, D, 0.05), 0, 0, 0));
    for (const side of [-1, 1]) {
      const hip = pivot(hips, side * 0.16, -0.05, 0), knee = pivot(hip, 0, -0.4, 0);
      hip.add(at(caps(0.085, 0.24, B), 0, -0.19, 0)); hip.add(at(sph(0.08, D, 10, 8), 0, -0.02, 0));
      knee.add(at(sph(0.075, D, 10, 8), 0, 0, 0)); knee.add(at(caps(0.08, 0.24, B), 0, -0.2, -0.01));
      knee.add(at(rbox(0.2, 0.08, 0.34, D, 0.03), 0, -0.41, 0.05));
      rig[side < 0 ? 'hipL' : 'hipR'] = hip; rig[side < 0 ? 'kneeL' : 'kneeR'] = knee;
    }
    const torso = rig.torso = pivot(hips, 0, 0.08, 0);
    const chest = sph(0.34, D, 20, 14); chest.scale.set(1.05, 1.0, 0.85); torso.add(at(chest, 0, 0.42, 0.03, 0.15));
    torso.add(at(rbox(0.3, 0.16, 0.22, D, 0.05), 0, 0.1, 0));
    const plate = sph(0.32, B, 20, 12); plate.scale.set(1.0, 0.82, 0.55); torso.add(at(plate, 0, 0.45, 0.19, 0.2));
    const top = sph(0.3, B, 18, 8); top.scale.set(1.05, 0.5, 0.8); torso.add(at(top, 0, 0.6, -0.02));
    torso.add(at(rbox(0.2, 0.22, 0.16, D, 0.04), 0, 0.42, -0.27));
    const head = rig.head = pivot(torso, 0, 0.7, 0.12);
    head.add(at(rbox(0.17, 0.09, 0.17, D, 0.03), 0, 0, 0));
    head.add(at(rbox(0.12, 0.018, 0.02, M2.glowR, 0.005), 0, 0.005, 0.087));
    for (const side of [-1, 1]) {
      const sh = pivot(torso, side * 0.38, 0.52, 0), el = pivot(sh, 0, -0.27, 0);
      sh.add(at(sph(0.11, D, 12, 10), 0, 0, 0)); sh.add(at(caps(0.07, 0.17, B), 0, -0.14, 0));
      el.add(at(rbox(0.17, 0.32, 0.19, B, 0.05), 0, -0.15, 0.01));
      for (const b of [-1, 1]) el.add(at(cyl(0.022, 0.022, 0.16, M2.gun, 8), b * 0.035, -0.3, 0.07, 0.15));
      rig[side < 0 ? 'shL' : 'shR'] = sh; rig[side < 0 ? 'elL' : 'elR'] = el;
    }
    rig.gun = rig.elR; rig.muzzle = pivot(rig.elR, 0, -0.39, 0.08); rig.twoHand = false; rig.wrist = true;
    return rig;
  }
  const T = M2.tan, TD = M2.tanD, J = M2.tanJ, mark = type === 'cmd' ? mat(0xe2b53b, { roughness: 0.4, metalness: 0.3 }) : null;
  const hips = rig.hips = pivot(body, 0, 1.0, 0);
  hips.add(at(rbox(0.19, 0.09, 0.12, TD, 0.03), 0, 0, 0));
  for (const side of [-1, 1]) {
    const hip = pivot(hips, side * 0.08, -0.04, 0), knee = pivot(hip, 0, -0.46, 0);
    hip.add(at(sph(0.035, J, 8, 6), 0, 0, 0));
    hip.add(at(cyl(0.022, 0.022, 0.45, J, 6), 0, -0.23, 0));
    hip.add(at(rbox(0.055, 0.26, 0.05, T, 0.02), 0, -0.2, 0.025));
    knee.add(at(cyl(0.035, 0.035, 0.05, J, 10), 0, 0, 0, 0, 0, Math.PI / 2));
    knee.add(at(cyl(0.02, 0.02, 0.46, J, 6), 0, -0.23, 0));
    knee.add(at(rbox(0.05, 0.3, 0.045, T, 0.02), 0, -0.2, 0.022));
    knee.add(at(rbox(0.08, 0.03, 0.22, T, 0.012), 0, -0.47, 0.05));
    rig[side < 0 ? 'hipL' : 'hipR'] = hip; rig[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  const torso = rig.torso = pivot(hips, 0, 0.05, 0);
  torso.add(at(cyl(0.022, 0.03, 0.2, J, 6), 0, 0.1, 0));
  torso.add(at(rbox(0.27, 0.24, 0.11, T, 0.035), 0, 0.33, 0.02));
  torso.add(at(rbox(0.2, 0.1, 0.03, TD, 0.012), 0, 0.3, 0.08));
  torso.add(at(rbox(0.23, 0.27, 0.17, TD, 0.04), 0, 0.33, -0.13));
  torso.add(at(rbox(0.12, 0.04, 0.12, T, 0.015), 0, 0.48, -0.12));
  if (mark) { torso.add(at(rbox(0.28, 0.06, 0.12, mark, 0.02), 0, 0.42, 0.02)); torso.add(at(cyl(0.005, 0.005, 0.4, J, 4), 0.08, 0.62, -0.18)); }
  torso.add(at(rbox(0.16, 0.035, 0.03, TD, 0.01), 0, 0.22, 0.075));
  const neck = pivot(torso, 0, 0.44, 0.04); neck.add(at(cyl(0.016, 0.016, 0.15, J, 6), 0, 0.06, 0.03, 0.55));
  const head = rig.head = pivot(neck, 0, 0.12, 0.08);
  head.add(at(mesh(B1HEAD_GEO, T), 0, 0, 0.06, 0.35));
  for (const s of [-1, 1]) head.add(at(cyl(0.032, 0.032, 0.03, M2.eye, 12), s * 0.09, 0.02, -0.055, 0, 0, Math.PI / 2));
  head.add(at(rbox(0.06, 0.015, 0.02, M2.eye, 0.005), 0, -0.045, 0.2, 0.35));
  if (mark) head.add(at(rbox(0.035, 0.02, 0.22, mark, 0.008), 0, 0.07, 0.02, 0.35));
  for (const side of [-1, 1]) {
    const sh = pivot(torso, side * 0.16, 0.42, 0), el = pivot(sh, 0, -0.27, 0);
    sh.add(at(sph(0.04, J, 8, 6), 0, 0, 0)); sh.add(at(cyl(0.02, 0.02, 0.27, J, 6), 0, -0.135, 0)); sh.add(at(rbox(0.045, 0.18, 0.04, T, 0.015), 0, -0.12, 0.012));
    sh.add(at(rbox(0.07, 0.035, 0.09, T, 0.012), side * 0.01, 0.035, 0, 0, 0, side * -0.25));
    el.add(at(cyl(0.024, 0.024, 0.03, J, 8), 0, 0, 0, 0, 0, Math.PI / 2)); el.add(at(cyl(0.018, 0.018, 0.25, J, 6), 0, -0.13, 0)); el.add(at(rbox(0.04, 0.17, 0.035, T, 0.012), 0, -0.12, 0.01));
    for (const f of [-1, 0, 1]) el.add(at(rbox(0.012, 0.06, 0.015, J, 0.004), f * 0.016, -0.29, 0.005));
    rig[side < 0 ? 'shL' : 'shR'] = sh; rig[side < 0 ? 'elL' : 'elR'] = el;
  }
  const gun = rig.gun = pivot(torso, 0.06, 0.28, 0.16);
  gun.add(at(rbox(0.04, 0.07, 0.3, M2.gun, 0.012), 0, 0, 0.06));
  gun.add(at(cyl(0.012, 0.014, 0.26, M2.gunL, 6), 0, 0.01, 0.33, Math.PI / 2));
  gun.add(at(rbox(0.03, 0.09, 0.04, M2.gun, 0.01), 0, -0.07, 0.0));
  gun.add(at(rbox(0.025, 0.04, 0.2, T, 0.01), 0, 0.0, -0.17));
  gun.add(at(cyl(0.018, 0.018, 0.12, M2.gun, 8), 0, 0.055, 0.06, Math.PI / 2));
  rig.muzzle = pivot(gun, 0, 0.01, 0.47); rig.twoHand = true;
  return rig;
}

// ---------- анимация: позы и действия
// Пружина к целевому углу — мягкие переходы между состояниями
function poseRig(u, dt) {
  if (u.rig.skinned) return poseSkinned(u, dt);
  const r = u.rig; u.t += dt;
  if (u.state === 'dead') return;
  const st = u.state, walk = st === 'walk' || st === 'run', run = st === 'run', aim = st === 'aim';
  if (st === 'idle') u.crouch = cell(u.x + 1, u.z) === HALF || cell(u.x - 1, u.z) === HALF || cell(u.x, u.z + 1) === HALF || cell(u.x, u.z - 1) === HALF;
  const crouch = (st === 'idle' && u.crouch) || st === 'hunker';
  const spd = u.team === 'droid' ? (u.type === 'b2' ? 8 : 11) : run ? 12 : 9.5;
  u.wph = walk ? u.wph + dt * spd : 0;
  const sw = Math.sin(u.wph), cw = Math.cos(u.wph), amp = run ? 0.75 : 0.55;
  const k = 1 - Math.exp(-dt * (aim ? 18 : 11));
  const set = (o, prop, v) => { if (o) o.rotation[prop] += (v - o.rotation[prop]) * k; };
  const breath = Math.sin(u.t * 1.8 + u.seed) * 0.025;
  // ноги
  if (crouch) {
    const deep = st === 'hunker';
    set(r.hipL, 'x', deep ? -1.5 : -1.25); set(r.kneeL, 'x', deep ? 2.1 : 1.6);
    set(r.hipR, 'x', deep ? -0.5 : -0.2); set(r.kneeR, 'x', deep ? 2.2 : 1.95);
  } else {
    set(r.hipL, 'x', walk ? sw * amp : 0.02); set(r.hipR, 'x', walk ? -sw * amp : -0.02);
    set(r.kneeL, 'x', walk ? Math.max(0, -cw) * (run ? 1.3 : 0.95) + 0.05 : 0.04); set(r.kneeR, 'x', walk ? Math.max(0, cw) * (run ? 1.3 : 0.95) + 0.05 : 0.04);
  }
  set(r.hipL, 'z', 0); set(r.hipR, 'z', 0);
  const y0 = r.hips.userData.y0, drop = crouch ? (st === 'hunker' ? 0.42 : 0.3) : 0;
  r.hips.position.y += ((y0 - drop + (walk ? Math.abs(cw) * 0.03 - 0.02 : 0)) - r.hips.position.y) * k;
  // корпус
  set(r.torso, 'x', (run ? 0.3 : walk ? 0.12 : crouch ? 0.28 : 0.02) + breath - u.flinch * 0.7);
  set(r.torso, 'y', walk ? sw * 0.12 : aim ? -0.12 : Math.sin(u.t * 0.4 + u.seed) * 0.05);
  set(r.torso, 'z', walk ? -cw * 0.04 : 0);
  u.flinch = Math.max(0, u.flinch - dt * 3.2);
  // голова оглядывается, дроиды подёргиваются
  u.headT -= dt; if (u.headT < 0) { u.headT = u.team === 'droid' ? rand(0.4, 2) : rand(1.5, 4); u.headY = rand(-0.6, 0.6) * (u.team === 'droid' ? 1 : 0.6); }
  set(r.head, 'y', aim || walk ? -r.torso.rotation.y : u.headY); set(r.head, 'x', aim ? 0.05 : crouch ? -0.2 : 0);
  // руки
  if (r.wrist) {
    const up = aim ? -1.5 : walk ? -0.25 + sw * 0.35 : -0.12;
    set(r.shR, 'x', up); set(r.shL, 'x', aim ? -1.5 : walk ? -0.25 - sw * 0.35 : -0.12);
    set(r.shR, 'z', aim ? 0.1 : -0.08); set(r.shL, 'z', aim ? -0.1 : 0.08);
    set(r.elR, 'x', aim ? -0.05 : -0.35); set(r.elL, 'x', aim ? -0.05 : -0.35);
  } else {
    const ready = aim ? 0 : crouch ? 0.35 : walk ? 0.55 + sw * 0.05 : 0.65;
    set(r.gun, 'x', ready); set(r.gun, 'y', aim ? 0.0 : 0.25);
    r.gun.position.z += (r.gun.userData.z0 - r.gun.position.z) * k * 0.6;
    r.gun.position.y += ((aim ? 0.43 : 0.28) - r.gun.position.y) * k;
    if (u.team === 'clone') {
      set(r.shR, 'x', aim ? -1.3 : -0.5); set(r.shR, 'z', aim ? -0.15 : -0.2); set(r.elR, 'x', aim ? -0.25 : -1.0);
      set(r.shL, 'x', aim ? -1.38 : -0.75); set(r.shL, 'z', aim ? 0.62 : 0.55); set(r.elL, 'x', aim ? -0.42 : -0.85);
    } else {
      set(r.shR, 'x', aim ? -1.35 : -0.45); set(r.shR, 'z', aim ? -0.1 : -0.1); set(r.elR, 'x', aim ? -0.15 : -0.9);
      set(r.shL, 'x', aim ? -1.45 : -0.7); set(r.shL, 'z', aim ? 0.55 : 0.5); set(r.elL, 'x', aim ? -0.35 : -0.75);
    }
  }
  // повреждённые дроиды искрят и дымят
  if (u.team === 'droid' && u.hp <= u.maxHp / 2 && u.rig.root.visible) {
    u.dmgT -= dt;
    if (u.dmgT < 0) { u.dmgT = rand(0.3, 1.4); const p = u.rig.root.position; FX.spark(p.x + rand(-0.1, 0.1), rand(0.5, 0.75), p.z + rand(-0.1, 0.1), 0x8fd8ff, 6, 1.5); if (Math.random() < 0.5) FX.puff(p.x, 0.7, p.z, { color: 0x2b2b2b, life: 1.6, s0: 0.15, s1: 0.7, vy: 0.5, a: 0.4 }); }
  }
}
// резкое движение оружия при выстреле
function recoil(u) {
  if (u.rig.skinned) { u.recoilK = 1; u.flinch = Math.max(u.flinch, 0.15); return; } if (!u.rig.wrist) { u.rig.gun.position.z -= 0.07; u.rig.gun.rotation.x -= 0.15; } else { u.rig.elR.rotation.x += 0.25; } u.rig.torso.rotation.x -= 0.06; }
// анимация гибели: подкашиваются ноги, корпус валится
async function deathAnim(u, fromDir) {
  if (u.rig.skinned) return deathSkinned(u, fromDir || 1);
  const r = u.rig, back = fromDir || (Math.random() < 0.5 ? -1 : 1);
  const s0 = { hipL: r.hipL.rotation.x, hipR: r.hipR.rotation.x, kneeL: r.kneeL.rotation.x, kneeR: r.kneeR.rotation.x, torso: r.torso.rotation.x, body: r.body.rotation.x, y: r.hips.position.y };
  if (u.team === 'droid' && u.type !== 'b2') { // судорога
    await tween(0.25, k => { r.torso.rotation.z = Math.sin(k * 30) * 0.25 * (1 - k); r.head && (r.head.rotation.y = Math.sin(k * 40) * 0.6); });
  }
  await tween(0.75, k => {
    const e = easeIO(Math.min(1, k * 1.6)), f = easeOut(Math.max(0, (k - 0.25) / 0.75));
    r.kneeL.rotation.x = lerp(s0.kneeL, 1.4, e); r.kneeR.rotation.x = lerp(s0.kneeR, 1.1, e);
    r.hipL.rotation.x = lerp(s0.hipL, -0.9, e); r.hipR.rotation.x = lerp(s0.hipR, -0.5, e);
    r.hips.position.y = lerp(s0.y, s0.y * 0.62, e);
    r.torso.rotation.x = lerp(s0.torso, back > 0 ? 0.6 : -0.3, e);
    r.body.rotation.x = s0.body + back * f * Math.PI / 2 * 0.92;
    r.body.position.y = Math.sin(f * Math.PI) * 0.04 + f * 0.05;
    if (r.shL) { r.shL.rotation.x = lerp(r.shL.rotation.x, -2.4 * f, 0.15); r.shR.rotation.x = lerp(r.shR.rotation.x, -0.5, 0.15); }
  });
}

// =====================================================================
//  РЕАЛИСТИЧНЫЕ ПЕРСОНАЖИ: модель солдата Mixamo (three.js examples) —
//  скелет, анимации стойки/ходьбы/бега; клоны, B1 и B2 — переделки одной модели
// =====================================================================
const CHAR = { gltf: null, variants: {}, clips: {}, corr: {}, ready: false };
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m1 = new THREE.Matrix4();
function b64ToBuf(b64) { const bin = atob(b64), n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
const boneKey = n => n.replace(/^mixamorig:?/, '');
const comp = (a, i, k) => (k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i));

// форма тела: во сколько раз «надуть» вершины вокруг кости (0 — убрать, например голову под шлем)
const SHAPES = {
  clone: n => (/^Head/.test(n) ? 0 : 1),
  b1: n => (/^Head/.test(n) ? 0 : n === 'Neck' ? 0.45 : /^Spine/.test(n) ? 0.5 : n === 'Hips' ? 0.55 : /Shoulder/.test(n) ? 0.5 : /ForeArm/.test(n) ? 0.36 : /Arm$/.test(n) ? 0.38 : /UpLeg/.test(n) ? 0.4 : /Leg$/.test(n) ? 0.36 : /Foot|Toe/.test(n) ? 0.6 : /Hand/.test(n) ? 0.6 : 1),
  b2: n => (/^Head/.test(n) ? 0 : n === 'Neck' ? 0.6 : n === 'Spine' ? 1.2 : n === 'Spine1' ? 1.45 : n === 'Spine2' ? 1.5 : n === 'Hips' ? 1.15 : /Shoulder/.test(n) ? 1.35 : /ForeArm/.test(n) ? 1.6 : /Arm$/.test(n) ? 1.35 : /UpLeg/.test(n) ? 1.25 : /Leg$/.test(n) ? 1.3 : /Foot|Toe/.test(n) ? 1.3 : /Hand/.test(n) ? 1.2 : 1),
};
// Переделка геометрии: каждая вершина сдвигается к оси своих костей (с учётом весов скиннинга)
function reshapeGeo(mesh, shape) {
  const geo = mesh.geometry.clone(), pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const bones = mesh.skeleton.bones, bp = mesh.skeleton.boneInverses.map(m => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
  const child = bones.map(b => { const c = b.children.find(ch => ch.isBone); return c ? bones.indexOf(c) : -1; });
  const fac = bones.map(b => shape(boneKey(b.name)));
  const v = new THREE.Vector3(), out = new THREE.Vector3(), d = new THREE.Vector3(), ab = new THREE.Vector3(), pr = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix); out.set(0, 0, 0); let wsum = 0, changed = false;
    for (let k = 0; k < 4; k++) {
      const w = comp(sw, i, k); if (w <= 0) continue; const bi = comp(si, i, k), f = fac[bi]; if (f !== 1) changed = true;
      const a = bp[bi], c = child[bi];
      if (c >= 0) { ab.subVectors(bp[c], a); const t = clamp(d.subVectors(v, a).dot(ab) / ab.lengthSq(), 0, 1); pr.copy(a).addScaledVector(ab, t); } else pr.copy(a);
      out.addScaledVector(d.subVectors(v, pr).multiplyScalar(f).add(pr), w); wsum += w;
    }
    if (!changed || wsum <= 0) continue;
    out.multiplyScalar(1 / wsum).applyMatrix4(mesh.bindMatrixInverse); pos.setXYZ(i, out.x, out.y, out.z);
  }
  return geo;
}
// перекраска текстуры: оттенки серого → белая броня / песочный металл / сталь
function tintTexture(img, tint, lo, hi) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
  g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const L = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255, v = lo + (hi - lo) * L;
    p[i] = clamp(v * tint[0] * 255, 0, 255); p[i + 1] = clamp(v * tint[1] * 255, 0, 255); p[i + 2] = clamp(v * tint[2] * 255, 0, 255);
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function loadCharacters() {
  return new Promise(res => {
    if (!window.MODEL_SOLDIER || !THREE.GLTFLoader) return res(false);
    try {
      new THREE.GLTFLoader().parse(b64ToBuf(window.MODEL_SOLDIER), '', g => {
        try { CHAR.gltf = g; prepareCharacters(); CHAR.ready = true; } catch (e) { console.warn('персонажи', e); }
        res(CHAR.ready);
      }, e => { console.warn('GLTF', e); res(false); });
    } catch (e) { console.warn(e); res(false); }
  });
}
function prepareCharacters() {
  const scene0 = CHAR.gltf.scene; let body = null;
  scene0.traverse(o => { if (o.isSkinnedMesh) { if (/visor/i.test(o.name)) CHAR.visorName = o.name; else body = o; } });
  CHAR.bodyName = body.name;
  for (const c of CHAR.gltf.animations) CHAR.clips[c.name.toLowerCase()] = c;
  const img = body.material.map.image, nrm = body.material.normalMap;
  const M = (map, o) => new THREE.MeshStandardMaterial(Object.assign({ map, normalMap: nrm, normalScale: new THREE.Vector2(1, 1) }, o));
  CHAR.variants.clone = { geo: reshapeGeo(body, SHAPES.clone), mat: M(tintTexture(img, [1, 1, 1.02], 0.62, 1.08), { roughness: 0.36, metalness: 0.05 }) };
  CHAR.variants.b1 = { geo: reshapeGeo(body, SHAPES.b1), mat: M(tintTexture(img, [0.95, 0.8, 0.56], 0.55, 1.1), { roughness: 0.48, metalness: 0.45 }) };
  CHAR.variants.b2 = { geo: reshapeGeo(body, SHAPES.b2), mat: M(tintTexture(img, [0.55, 0.62, 0.74], 0.3, 0.85), { roughness: 0.42, metalness: 0.5 }) };
  // модель в исходнике смотрит в −Z — разворачиваем лицом к +Z, как остальные объекты игры
  scene0.rotation.y = Math.PI;
  // поправки ориентации навесных деталей: в позе привязки деталь смотрит туда же, куда модель
  body.skeleton.pose(); const holder = new THREE.Group(); holder.add(scene0); holder.updateMatrixWorld(true);
  for (const b of body.skeleton.bones) {
    const q = new THREE.Quaternion(); b.matrixWorld.decompose(_v1, q, _v2);
    CHAR.corr[boneKey(b.name)] = q.invert();
  }
  holder.remove(scene0);
}

// ---------- сборка юнита на скелете
function cloneHelmet(cls) {
  const g = new THREE.Group(), W = M2.armor, stripe = mat(CLS_COL[cls], { roughness: 0.35 });
  g.add(at(mesh(HELMET_GEO, W), 0, 0.03, 0));
  const seg = (ps, pl, ts, tl, m, r = 0.163) => { const s = new THREE.SphereGeometry(r, 24, 6, ps, pl, ts, tl); s.scale(1, 1, 1.12); return at(mesh(s, m), 0, 0.03, 0); };
  g.add(seg(Math.PI / 2 - 0.78, 1.56, 1.16, 0.3, M2.visor)); g.add(seg(Math.PI / 2 - 0.2, 0.4, 1.4, 0.58, M2.visor));
  g.add(seg(Math.PI / 2 - 0.85, 1.7, 1.08, 0.08, M2.armorD, 0.164)); g.add(seg(Math.PI / 2 - 0.42, 0.84, 2.0, 0.42, M2.armorD, 0.161));
  for (let i = -1; i <= 1; i++) g.add(at(box(0.008, 0.03, 0.01, M2.armorD), i * 0.02, -0.108, 0.17, 0.25));
  for (const s of [-1, 1]) g.add(at(cyl(0.035, 0.035, 0.03, M2.armorD, 12), s * 0.158, -0.02, 0, 0, 0, Math.PI / 2));
  g.add(at(rbox(0.035, 0.03, 0.27, stripe, 0.012), 0, 0.185, -0.005));
  if (cls === 'commander') g.add(at(rbox(0.02, 0.12, 0.02, M2.gunL, 0.006), 0.16, 0.08, 0.04));
  if (cls === 'sniper') g.add(at(cyl(0.025, 0.025, 0.06, M2.visor, 10), 0.11, 0.05, 0.12, Math.PI / 2));
  return g;
}
function b1Head(mark) {
  const g = new THREE.Group(), T = M2.tan;
  g.add(at(cyl(0.016, 0.016, 0.14, M2.tanJ, 6), 0, -0.02, 0.0, 0.5));
  const h = new THREE.Group(); h.position.set(0, 0.07, 0.05); g.add(h);
  h.add(at(mesh(B1HEAD_GEO, T), 0, 0, 0.06, 0.35));
  for (const s of [-1, 1]) h.add(at(cyl(0.032, 0.032, 0.03, M2.eye, 12), s * 0.09, 0.02, -0.055, 0, 0, Math.PI / 2));
  h.add(at(rbox(0.06, 0.015, 0.02, M2.eye, 0.005), 0, -0.045, 0.2, 0.35));
  if (mark) h.add(at(rbox(0.035, 0.02, 0.22, mark, 0.008), 0, 0.07, 0.02, 0.35));
  return g;
}
function e5Rifle(gun) {
  gun.add(at(rbox(0.04, 0.07, 0.3, M2.gun, 0.012), 0, 0, 0.06));
  gun.add(at(cyl(0.012, 0.014, 0.26, M2.gunL, 6), 0, 0.01, 0.33, Math.PI / 2));
  gun.add(at(rbox(0.03, 0.09, 0.04, M2.gun, 0.01), 0, -0.07, 0.0));
  gun.add(at(rbox(0.025, 0.04, 0.2, M2.tan, 0.01), 0, 0.0, -0.17));
  gun.add(at(cyl(0.018, 0.018, 0.12, M2.gun, 8), 0, 0.055, 0.06, Math.PI / 2));
  return 0.47;
}
function buildSkinned(team, type) {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0);
  const model = THREE.SkeletonUtils.clone(CHAR.gltf.scene); body.add(model);
  const variant = team === 'clone' ? 'clone' : type === 'b2' ? 'b2' : 'b1', V = CHAR.variants[variant];
  model.traverse(o => {
    if (o.isSkinnedMesh) { if (o.name === CHAR.visorName) o.visible = false; else { o.geometry = V.geo; o.material = V.mat; } o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
  });
  const bones = {}; model.traverse(o => { if (o.isBone) bones[boneKey(o.name)] = o; });
  const mixer = new THREE.AnimationMixer(model), acts = {};
  for (const [k, c] of Object.entries(CHAR.clips)) acts[k] = mixer.clipAction(c);
  acts.idle.play(); acts.idle.time = Math.random() * acts.idle.getClip().duration;
  const rig = { root, body, model, bones, mixer, acts, cur: 'idle', skinned: true, kind: variant, att: [], twoHand: true };
  const attach = (obj, bone, x, y, z) => { body.add(obj); rig.att.push({ obj, bone: bones[bone], corr: CHAR.corr[bone], off: new THREE.Vector3(x, y, z) }); obj.traverse(m => { if (m.isMesh) m.castShadow = true; }); return obj; };
  // правая сторона модели (в позе привязки) — по положению правого плеча
  model.updateMatrixWorld(true); const side = Math.sign(body.worldToLocal(bones.RightArm.getWorldPosition(new THREE.Vector3())).x) || -1;
  rig.side = side;
  if (team === 'clone') {
    const stripe = mat(CLS_COL[type], { roughness: 0.35 });
    rig.head = attach(cloneHelmet(type), 'Head', 0, 0.075, 0.02);
    // наплечники: купол над плечом, у правого — цветная полоса класса
    const pad = (colored) => { const g = new THREE.Group(); const p = mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M2.armor); p.scale.set(1.15, 0.7, 1.15); g.add(p);
      if (colored) { const st = mesh(new THREE.SphereGeometry(0.092, 14, 4, 0, Math.PI * 2, 0, 0.6), stripe); st.scale.set(1.15, 0.7, 1.15); g.add(st); } return g; };
    attach(pad(true), 'RightArm', side * 0.05, 0.03, 0);
    attach(pad(type === 'commander'), 'LeftArm', -side * 0.05, 0.03, 0);
    attach(rbox(0.26, 0.2, 0.09, M2.suit, 0.03), 'Spine2', 0, 0.02, -0.17);
    attach(rbox(0.045, 0.2, 0.02, stripe, 0.008), 'Spine2', side * 0.08, 0.05, 0.135);
    rig.gun = new THREE.Group(); body.add(rig.gun); rig.muzzle = pivot(rig.gun, 0, 0.012, rifle(rig.gun, type));
    rig.grips = type === 'heavy' ? { r: [0, -0.1, 0.02], l: [-side * 0.11, 0.06, 0.1] } : type === 'sniper' ? { r: [0, -0.08, 0.0], l: [0, -0.03, 0.4] } : { r: [0, -0.08, 0.0], l: [0, -0.03, 0.3] };
  } else if (type === 'b2') {
    const D = M2.b2D, B = M2.b2;
    rig.head = attach((() => { const g = new THREE.Group(); g.add(at(rbox(0.18, 0.1, 0.18, D, 0.03), 0, 0, 0)); g.add(at(rbox(0.13, 0.018, 0.02, M2.glowR, 0.005), 0, 0.005, 0.092)); return g; })(), 'Neck', 0, 0.05, 0.06);
    const plate = sph(0.3, B, 18, 10); plate.scale.set(1.05, 0.85, 0.5); attach(plate, 'Spine2', 0, 0.05, 0.12);
    attach(rbox(0.24, 0.26, 0.16, D, 0.04), 'Spine2', 0, 0.06, -0.22);
    for (const [bn, s] of [['RightForeArm', side], ['LeftForeArm', -side]]) {
      // массивный кожух предплечья со сдвоенным бластером поверх кисти
      const g = new THREE.Group(); g.add(at(rbox(0.24, 0.2, 0.2, D, 0.05), s * 0.17, 0.02, 0));
      g.add(at(rbox(0.12, 0.08, 0.14, B, 0.03), s * 0.3, 0.08, 0));
      for (const b of [-1, 1]) g.add(at(cyl(0.026, 0.026, 0.22, M2.gun, 10), s * 0.36, 0.08, b * 0.04, 0, 0, Math.PI / 2));
      attach(g, bn, 0, 0, 0); if (bn === 'RightForeArm') { rig.muzzle = pivot(g, s * 0.48, 0.08, 0); rig.gun = g; }
    }
    rig.wrist = true; rig.twoHand = false;
  } else {
    const mark = type === 'cmd' ? mat(0xe2b53b, { roughness: 0.4, metalness: 0.3 }) : null;
    rig.head = attach(b1Head(mark), 'Neck', 0, 0.06, 0.02);
    attach(rbox(0.22, 0.26, 0.16, M2.tanD, 0.04), 'Spine2', 0, 0.02, -0.14);
    attach(rbox(0.26, 0.2, 0.06, M2.tan, 0.03), 'Spine2', 0, 0.04, 0.07);
    if (mark) { attach(rbox(0.27, 0.05, 0.07, mark, 0.02), 'Spine2', 0, 0.12, 0.08); attach(cyl(0.005, 0.005, 0.4, M2.tanJ, 4), 'Spine2', 0.08, 0.32, -0.18); }
    rig.gun = new THREE.Group(); body.add(rig.gun); rig.muzzle = pivot(rig.gun, 0, 0.01, e5Rifle(rig.gun));
    rig.grips = { r: [0, -0.08, 0.0], l: [0, -0.02, 0.2] };
  }
  if (rig.gun && !rig.wrist) rig.gun.traverse(m => { if (m.isMesh) m.castShadow = true; });
  rig.gunPos = new THREE.Vector3(); rig.gunQuat = new THREE.Quaternion(); rig.gunInit = false;
  return rig;
}

// ---------- обратная кинематика: две кости тянутся к цели
function bonePos(b, v) { return b.getWorldPosition(v); }
function pointBone(bone, child, target) {
  const bp = bonePos(bone, _v1), cp = bonePos(child, _v2);
  const from = cp.sub(bp).normalize(), to = _v3.copy(target).sub(bp).normalize();
  if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
  _q1.setFromUnitVectors(from, to);
  bone.getWorldQuaternion(_q2); _q1.multiply(_q2);
  bone.parent.getWorldQuaternion(_q2).invert(); bone.quaternion.copy(_q2.multiply(_q1));
  bone.updateMatrixWorld(true);
}
function twoBoneIK(upper, lower, end, target, pole) {
  const a = bonePos(upper, new THREE.Vector3()), b = bonePos(lower, new THREE.Vector3()), c = bonePos(end, new THREE.Vector3());
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c), dir = target.clone().sub(a); let d = dir.length(); dir.normalize();
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const pd = pole.clone().sub(a); pd.addScaledVector(dir, -pd.dot(dir)); if (pd.lengthSq() < 1e-8) pd.set(0, -1, 0); pd.normalize();
  const elbow = a.clone().addScaledVector(dir, x).addScaledVector(pd, h);
  pointBone(upper, lower, elbow); pointBone(lower, end, a.clone().addScaledVector(dir, d));
}
function rotateBoneWorld(bone, axisWorld, ang) {
  if (Math.abs(ang) < 1e-4) return;
  _q1.setFromAxisAngle(axisWorld, ang); bone.getWorldQuaternion(_q2); _q1.multiply(_q2);
  bone.parent.getWorldQuaternion(_q2).invert(); bone.quaternion.copy(_q2.multiply(_q1)); bone.updateMatrixWorld(true);
}
const RIFLE_POSES = { // положение рукоятки относительно груди (в осях модели) и наклон/поворот ствола
  aim: { off: [0.06, 0.12, 0.3], pitch: 0, yaw: 0.04 },
  ready: { off: [0.1, -0.08, 0.26], pitch: 0.55, yaw: 0.55 },
  run: { off: [0.1, -0.02, 0.28], pitch: 0.3, yaw: 0.6 },
  crouch: { off: [0.1, -0.05, 0.3], pitch: 0.35, yaw: 0.4 },
  heavy: { off: [0.1, -0.22, 0.26], pitch: 0.05, yaw: 0.05 },
};
function setAnim(rig, name, fade = 0.25) {
  if (rig.cur === name || !rig.acts[name]) return;
  const a = rig.acts[name], b = rig.acts[rig.cur]; a.reset().setEffectiveWeight(1).play(); if (b) a.crossFadeFrom(b, fade, false); rig.cur = name;
}
function poseSkinned(u, dt) {
  const r = u.rig; u.t += dt;
  if (u.state === 'dead') return;
  const st = u.state, walk = st === 'walk', run = st === 'run', aim = st === 'aim';
  if (st === 'idle') u.crouch = cell(u.x + 1, u.z) === HALF || cell(u.x - 1, u.z) === HALF || cell(u.x, u.z + 1) === HALF || cell(u.x, u.z - 1) === HALF;
  const crouch = (st === 'idle' && u.crouch) || st === 'hunker';
  setAnim(r, run ? 'run' : walk ? 'walk' : 'idle');
  if (r.acts.walk) r.acts.walk.timeScale = 1.35; if (r.acts.run) r.acts.run.timeScale = 1.05;
  r.mixer.update(dt);
  const B = r.bones, body = r.body; body.updateMatrixWorld(true);
  const toW = (x, y, z) => body.localToWorld(new THREE.Vector3(x, y, z));
  const fwdW = toW(0, 0, 1).sub(toW(0, 0, 0)).normalize(), upW = toW(0, 1, 0).sub(toW(0, 0, 0)).normalize(), rightW = new THREE.Vector3().crossVectors(fwdW, upW).normalize();
  const S = r.side; // знак оси X правой стороны модели
  // присед: опускаем таз, ноги стоят на месте
  const drop = crouch ? (st === 'hunker' ? 0.5 : 0.36) : 0;
  u.drop = lerp(u.drop || 0, drop, 1 - Math.exp(-dt * 10));
  if (u.drop > 0.01) {
    const fl = bonePos(B.LeftFoot, new THREE.Vector3()), fr = bonePos(B.RightFoot, new THREE.Vector3());
    const hp = bonePos(B.Hips, new THREE.Vector3()), np = hp.clone().addScaledVector(upW, -u.drop * body.getWorldScale(_v1).y).addScaledVector(fwdW, -0.05 * u.drop);
    B.Hips.position.copy(B.Hips.parent.worldToLocal(np)); B.Hips.updateMatrixWorld(true);
    const knee = (foot) => foot.clone().addScaledVector(fwdW, 1).addScaledVector(upW, 0.3);
    twoBoneIK(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, fl, knee(fl)); twoBoneIK(B.RightUpLeg, B.RightLeg, B.RightFoot, fr, knee(fr));
    rotateBoneWorld(B.Spine, rightW, -0.32 * u.drop / 0.36 * (st === 'hunker' ? 1.3 : 1));
  }
  // корпус: вздрагивание и поворот плеча к оружию при прицеливании
  u.flinch = Math.max(0, u.flinch - dt * 3.2);
  if (u.flinch > 0) rotateBoneWorld(B.Spine1, rightW, u.flinch * 0.45);
  if (aim && r.twoHand) rotateBoneWorld(B.Spine1, upW, -S * 0.25);
  if (!r.wrist) {
    // оружие: положение относительно груди, плавный переход между позами
    const P = r.kind === 'clone' && u.type === 'heavy' ? (aim ? RIFLE_POSES.heavy : RIFLE_POSES.ready) : aim ? RIFLE_POSES.aim : run ? RIFLE_POSES.run : crouch ? RIFLE_POSES.crouch : RIFLE_POSES.ready;
    const chest = body.worldToLocal(bonePos(B.Spine2, new THREE.Vector3()));
    const tp = new THREE.Vector3(chest.x + S * P.off[0], chest.y + P.off[1], chest.z + P.off[2]);
    const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.pitch, -S * P.yaw, 0, 'YXZ'));
    const k = r.gunInit ? 1 - Math.exp(-dt * 12) : 1; r.gunInit = true;
    r.gunPos.lerp(tp, k); r.gunQuat.slerp(tq, k);
    u.recoilK = Math.max(0, (u.recoilK || 0) - dt * 6);
    r.gun.position.copy(r.gunPos).add(new THREE.Vector3(0, 0.02, -0.07).applyQuaternion(r.gunQuat).multiplyScalar(u.recoilK));
    r.gun.quaternion.copy(r.gunQuat); r.gun.rotateX(-0.18 * u.recoilK); r.gun.updateMatrixWorld(true);
    // руки на оружие
    const gp = (a) => r.gun.localToWorld(new THREE.Vector3(a[0], a[1], a[2]));
    const shR = bonePos(B.RightArm, new THREE.Vector3()), shL = bonePos(B.LeftArm, new THREE.Vector3());
    twoBoneIK(B.RightArm, B.RightForeArm, B.RightHand, gp(r.grips.r), shR.clone().addScaledVector(rightW, 0.6).addScaledVector(upW, -0.8).addScaledVector(fwdW, -0.3));
    twoBoneIK(B.LeftArm, B.LeftForeArm, B.LeftHand, gp(r.grips.l), shL.clone().addScaledVector(rightW, -0.5).addScaledVector(upW, -0.8));
  } else if (aim) {
    // B2 вытягивает руки с бластерами вперёд
    const shR = bonePos(B.RightArm, new THREE.Vector3()), shL = bonePos(B.LeftArm, new THREE.Vector3()), sc = body.getWorldScale(_v1).y;
    twoBoneIK(B.RightArm, B.RightForeArm, B.RightHand, shR.clone().addScaledVector(fwdW, 0.62 * sc).addScaledVector(upW, -0.05 * sc), shR.clone().addScaledVector(upW, -1));
    twoBoneIK(B.LeftArm, B.LeftForeArm, B.LeftHand, shL.clone().addScaledVector(fwdW, 0.62 * sc).addScaledVector(upW, -0.05 * sc), shL.clone().addScaledVector(upW, -1));
  }
  // навесные детали следуют за костями
  const inv = _m1.copy(body.matrixWorld).invert();
  for (const a of r.att) {
    const m = new THREE.Matrix4().multiplyMatrices(inv, a.bone.matrixWorld), p = new THREE.Vector3(), q = new THREE.Quaternion(); m.decompose(p, q, _v1);
    q.multiply(a.corr); a.obj.quaternion.copy(q); a.obj.position.copy(p).add(_v2.copy(a.off).applyQuaternion(q));
  }
  // повреждённые дроиды искрят
  if (u.team === 'droid' && u.hp <= u.maxHp / 2 && r.root.visible) {
    u.dmgT -= dt;
    if (u.dmgT < 0) { u.dmgT = rand(0.3, 1.4); const p = r.root.position; FX.spark(p.x + rand(-0.1, 0.1), rand(0.6, 0.85), p.z + rand(-0.1, 0.1), 0x8fd8ff, 6, 1.5); if (Math.random() < 0.5) FX.puff(p.x, 0.8, p.z, { color: 0x2b2b2b, life: 1.6, s0: 0.15, s1: 0.7, vy: 0.5, a: 0.4 }); }
  }
}
async function deathSkinned(u, back) {
  const r = u.rig, y0 = r.body.rotation.x;
  if (r.acts.idle) { r.mixer.update(0); }
  await tween(0.85, k => {
    const f = easeOut(Math.max(0, (k - 0.1) / 0.9));
    r.body.rotation.x = y0 + back * f * Math.PI / 2 * 0.94; r.body.position.y = Math.sin(f * Math.PI) * 0.05 + f * 0.04;
  });
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

const UNIT_SCALE = 0.6;
function makeRig(team, type) {
  if (CHAR.ready) return buildSkinned(team, type);
  const rig = team === 'clone' ? buildClone(type) : buildDroid(type); mergeRig(rig.root); return rig;
}
function makeUnit(team, type, x, z, extra = {}) {
  const d = DEF[type], rig = makeRig(team, type);
  rig.root.scale.setScalar(UNIT_SCALE); if (rig.hips) rig.hips.userData.y0 = rig.hips.position.y;
  const u = Object.assign({ team, type, x, z, hp: d.hp, maxHp: d.hp, aim: d.aim, mob: d.mob, dmg: d.dmg, range: d.range, sight: d.sight, nades: d.nades || 0, burst: d.burst || 1, armor: d.armor || 0,
    ap: 0, alive: true, overwatch: false, hunker: false, rig, t: 0, wph: 0, seed: Math.random() * 6, flinch: 0, headT: 0, headY: 0, dmgT: 0, crouch: false, state: 'idle', yaw: team === 'clone' ? Math.PI * 0.75 : -Math.PI * 0.25, name: d.name, visible: team === 'clone' }, extra);
  rig.root.position.set(x + 0.5, 0, z + 0.5); rig.root.rotation.y = u.yaw;
  // невидимая «капсула» для выбора касанием
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.55 / UNIT_SCALE; hit.userData.unit = u; hit.userData.keep = true;
  if (rig.gun && !rig.skinned) rig.gun.userData.z0 = rig.gun.position.z;
  rig.root.add(hit); u.hit = hit; hit.scale.setScalar(1 / UNIT_SCALE);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), BLOB_MAT); blob.position.y = 0.02 / UNIT_SCALE; blob.renderOrder = 1; blob.userData.keep = true; rig.root.add(blob);
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
const cam = { kick: 0, fx: 4, fz: 26, yaw: -Math.PI / 4, pitch: 0.9, dist: 22, tfx: 4, tfz: 26, tyaw: -Math.PI / 4, tpitch: 0.9, tdist: 22, mode: 'tactical', cine: null, shake: 0 };
// почти изометрия: узкий угол обзора и дальняя камера — меньше искажений, больше поля на экране
const TAC_FOV = 30, ZOOM = [9, 46];
const VIEWS = { tactical: { pitch: 0.9, dist: 19 }, top: { pitch: 1.42, dist: 34 } };
// направление «от отряда к противнику»: камера стоит за спинами клонов
function squadYaw() {
  const cs = clones().length ? clones() : units.filter(u => u.team === 'clone'), ds = droids();
  if (!cs.length || !ds.length) return cam.tyaw;
  const cx = cs.reduce((a, u) => a + u.x, 0) / cs.length, cz = cs.reduce((a, u) => a + u.z, 0) / cs.length;
  const dx = ds.reduce((a, u) => a + u.x, 0) / ds.length - cx, dz = ds.reduce((a, u) => a + u.z, 0) / ds.length - cz;
  const a = Math.atan2(-dx, -dz);
  return Math.round(a / (Math.PI / 4)) * (Math.PI / 4); // кратно 45°, чтобы сетка смотрелась ровно
}
// тени строятся вокруг точки обзора — так они чётче
function sunFollow() {
  const half = clamp(cam.dist * 0.85, 12, 26), sc = sun.shadow.camera;
  if (Math.abs(sc.right - half) > 0.5) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
  const tx = Math.round(cam.fx), tz = Math.round(cam.fz);
  sun.target.position.set(tx, 0, tz); sun.position.set(tx - 16, 26, tz + 12);
}
function camUpdate(dt) {
  const k = Math.min(1, dt * 6);
  if (cam.cine) {
    const c = cam.cine; cam.kick = Math.max(0, cam.kick - dt * 0.35); camera.position.copy(c.pos); camera.lookAt(c.look.x, c.look.y + cam.kick, c.look.z);
    camera.fov = lerp(camera.fov, c.fov || 52, Math.min(1, dt * 9)); camera.updateProjectionMatrix();
  } else {
    cam.fx = lerp(cam.fx, cam.tfx, k); cam.fz = lerp(cam.fz, cam.tfz, k); cam.yaw = angleLerp(cam.yaw, cam.tyaw, k);
    cam.pitch = lerp(cam.pitch, cam.tpitch, k); cam.dist = lerp(cam.dist, cam.tdist, k);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.fx + Math.sin(cam.yaw) * cp * cam.dist, sp * cam.dist, cam.fz + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(cam.fx, 0, cam.fz); camera.fov = lerp(camera.fov, TAC_FOV, k); camera.updateProjectionMatrix();
  }
  sunFollow();
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt); camera.position.x += rand(-1, 1) * cam.shake * 0.4; camera.position.y += rand(-1, 1) * cam.shake * 0.4; }
}
// фокус чуть впереди бойца по направлению взгляда камеры — видно, куда идти
function focusUnit(u) { focus(u.x + 0.5 - Math.sin(cam.tyaw) * 2.2, u.z + 0.5 - Math.cos(cam.tyaw) * 2.2); }
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
moveTiles.count = 0; moveTiles.renderOrder = 3; moveTiles.frustumCulled = false; world.add(moveTiles);
// рамка зоны хода (как в XCOM): синяя — шаг, жёлтая — рывок
const edgeGeo = new THREE.PlaneGeometry(1.0, 0.07); edgeGeo.rotateX(-Math.PI / 2);
const moveEdges = new THREE.InstancedMesh(edgeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false }), N * N * 2);
moveEdges.count = 0; moveEdges.renderOrder = 4; moveEdges.frustumCulled = false; world.add(moveEdges);
const dotGeo = new THREE.CircleGeometry(0.07, 10); dotGeo.rotateX(-Math.PI / 2);
const pathDots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 200);
pathDots.count = 0; pathDots.renderOrder = 4; pathDots.frustumCulled = false; world.add(pathDots);
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
const ui = { mode: 'move', targets: [], ti: 0, pending: null, reach: null, nadeTile: null, chances: new Map(), preview: false };
let fastEnemy = store('cvd-fast') === 'on';
function hint(t) { const h = $('hint'); if (t) { h.textContent = t; h.classList.add('show'); } else h.classList.remove('show'); }
function banner(text, cls) { const b = $('banner'); b.textContent = text; b.className = ''; void b.offsetWidth; b.className = 'show ' + cls; }
// 3D-портрет: голова и плечи настоящей модели, отрисованные в текстуру
const PORTRAITS = new Map();
function portraitImage(team, type) {
  const key = team + type; if (PORTRAITS.has(key)) return PORTRAITS.get(key);
  const W = 192, H = 112, rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.encoding = THREE.sRGBEncoding;
  const ps = new THREE.Scene(); ps.environment = scene.environment;
  ps.add(new THREE.HemisphereLight(0xdfeeff, 0x553322, 0.35));
  const key1 = new THREE.DirectionalLight(0xfff0dd, 1.1); key1.position.set(2.5, 2, 1.2); ps.add(key1);
  const rim = new THREE.DirectionalLight(team === 'clone' ? 0x6fc4ff : 0xff6a50, 2.0); rim.position.set(-2, 1.5, -2); ps.add(rim);
  const rig = makeRig(team, type);
  rig.root.rotation.y = 0.22; ps.add(rig.root);
  if (rig.skinned) { const fake = { rig, team, type, state: 'idle', t: 0, flinch: 0, x: -5, z: -5, hp: 9, maxHp: 9, dmgT: 9 }; for (let i = 0; i < 3; i++) poseSkinned(fake, 0.02); }
  else { if (rig.gun && !rig.wrist) rig.gun.rotation.x = 0.6; if (rig.shR && !rig.wrist) { rig.shR.rotation.x = -0.5; rig.elR.rotation.x = -1.0; rig.shL.rotation.set(-0.75, 0, 0.5); rig.elL.rotation.x = -0.85; } }
  rig.root.updateMatrixWorld(true);
  const hp = new THREE.Vector3(); rig.head.getWorldPosition(hp);
  const pc = new THREE.PerspectiveCamera(28, W / H, 0.05, 20), up = type === 'b2' ? -0.25 : team === 'droid' ? 0.0 : 0.02, far = type === 'b2' ? 2.4 : 1;
  pc.position.set(hp.x + 0.5 * far, hp.y + up + 0.06, hp.z + 0.88 * far); pc.lookAt(hp.x + 0.02, hp.y + up - 0.03, hp.z + (team === 'droid' && type !== 'b2' ? 0.08 : 0));
  const prevTone = renderer.toneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(ps, pc);
  const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(null); renderer.toneMapping = prevTone; rt.dispose();
  const raw = document.createElement('canvas'); raw.width = W; raw.height = H; const rg = raw.getContext('2d'), img = rg.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  rg.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, team === 'clone' ? '#2a4a66' : '#5a2a24'); gr.addColorStop(1, '#0c1218'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.drawImage(raw, 0, 0);
  PORTRAITS.set(key, c); return c;
}
function portrait(u) {
  const src = portraitImage(u.team, u.type), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0); return c;
}
function buildSquadUI() {
  const box = $('squad'); box.innerHTML = '';
  for (const u of units.filter(u => u.team === 'clone')) {
    const d = document.createElement('div'); d.className = 'card'; d.appendChild(portrait(u));
    d.insertAdjacentHTML('beforeend', `<div class="cname">${u.call}</div><div class="hp"></div><div class="ap"></div><div class="badge"></div>`);
    d.addEventListener('click', () => { if (u.alive && phase === 'player' && !busy) { select(u); focusUnit(u); } });
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
  if (!ui.preview && u && u.alive) computeChances(u.x, u.z);
  const eb = $('enemyBar'); eb.innerHTML = '';
  if (can) for (const d of targetsFor(u)) {
    const si = shotInfo(u, d), b = document.createElement('button');
    b.className = 'eb' + (si.flank ? ' fl' : '') + (ui.mode === 'target' && ui.targets[ui.ti] === d ? ' cur' : '');
    b.innerHTML = `<div class="ic"></div>${si.chance}%`; b.querySelector('.ic').appendChild(portrait(d));
    b.setAttribute('aria-label', `${d.name}, шанс ${si.chance}%`);
    b.addEventListener('click', () => { Snd.init(); enterTarget(d); }); eb.appendChild(b);
  }
  const ui2 = $('unitInfo');
  if (u && u.alive && phase === 'player') { ui2.style.display = ''; ui2.innerHTML = `<b>${u.call}</b> · <span style="color:#4fb4ff">ход ${u.mob} кл.</span>${u.ap >= 2 ? ` · <span style="color:#ffc65a">рывок ${u.mob * 2} кл.</span>` : ''} · меткость ${u.aim} · урон ${u.dmg[0]}–${u.dmg[1]}${u.nades ? ' · гранат ' + u.nades : ''}`; }
  else ui2.style.display = 'none';
  $('bFast').classList.toggle('on', fastEnemy);
  $('bCam').classList.toggle('on', camMode === 'first'); $('bCam').setAttribute('aria-label', 'Камера выстрела: ' + CAM_MODES[camMode]);
  $('bCam').querySelector('b').textContent = camMode === 'first' ? '1' : camMode === 'third' ? '3' : 'A';
  $('bMus').classList.toggle('off', !Snd.musOn); $('bSfx').classList.toggle('off', !Snd.sfxOn);
}
const coverAround = u => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => cell(u.x + dx, u.z + dz) !== FLOOR);
const targetsFor = u => u ? droids().filter(d => d.visible && shotInfo(u, d)) : [];

// надписи над юнитами
const labels = $('labels');
function syncLabels() {
  const v = new THREE.Vector3(), W = innerWidth, H = innerHeight;
  const showCh = phase === 'player' && !busy && selected && selected.ap > 0;
  for (const u of units) {
    if (!u.label) { u.label = document.createElement('div'); u.label.className = 'ul ' + (u.team === 'clone' ? 'rep' : 'sep'); u.label.innerHTML = '<div class="ch"></div><div class="ap2"></div><div class="st"></div><div class="pips"></div>'; labels.appendChild(u.label); u.lkey = ''; }
    const show = u.alive && (u.team === 'clone' || u.visible) && !cam.cine && phase !== 'start' && phase !== 'intro';
    u.label.style.display = show ? '' : 'none'; if (!show) continue;
    v.set(u.rig.root.position.x, 1.32, u.rig.root.position.z).project(camera);
    if (v.z > 1) { u.label.style.display = 'none'; continue; }
    u.label.style.left = ((v.x + 1) / 2 * W) + 'px'; u.label.style.top = ((1 - v.y) / 2 * H) + 'px';
    const ch = showCh && u.team === 'droid' ? ui.chances.get(u) : null;
    const ap = u.team === 'clone' && phase === 'player' && u === selected ? u.ap : 0;
    const key = [u.hp, u.overwatch, u.hunker, ch ? ch.chance + (ch.flank ? 'f' : '') + (ui.preview ? 'p' : '') : '', ap].join('|');
    if (key !== u.lkey) {
      u.lkey = key; u.label.querySelector('.pips').innerHTML = pips(u.hp, u.maxHp);
      u.label.querySelector('.st').textContent = (u.overwatch ? '👁' : '') + (u.hunker ? '🛡' : '');
      const c = u.label.querySelector('.ch'); c.style.display = ch ? '' : 'none';
      if (ch) { c.textContent = ch.chance + '%'; c.className = 'ch' + (ch.flank ? ' fl' : '') + (ui.preview ? ' pre' : ''); }
      u.label.querySelector('.ap2').innerHTML = '<i></i>'.repeat(ap);
    }
  }
}
// шансы попадания по видимым дроидам — с текущей клетки или с клетки предпросмотра
function computeChances(x, z) {
  ui.chances = new Map(); const u = selected; if (!u || !u.alive) return 0;
  const fake = Object.assign({}, u, { x, z }); let danger = 0;
  for (const d of droids()) {
    if (!d.visible) continue;
    const si = shotInfo(fake, d); if (si) ui.chances.set(d, si);
    if (sightFrom(d, x, z, d.sight) && coverAt(x, z, d.x, d.z) === 0) danger++;
  }
  return danger;
}
function popText(u, text, cls) {
  const v = new THREE.Vector3(u.rig.root.position.x, 1.5, u.rig.root.position.z).project(camera);
  const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
  d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1500);
}

// ---------- выбор и подсветка
function select(u) {
  selected = u; ui.mode = 'move'; ui.pending = null; ui.preview = false; hint(''); hideTarget(); nadeRing.visible = nadeRange.visible = false;
  if (u) Snd.fx.select();
  showMoveRange(); refreshUI();
}
const colBlue = new THREE.Color(0x4fb4ff), colYel = new THREE.Color(0xffa424), dummy = new THREE.Object3D();
moveTiles.setColorAt(0, colBlue); moveEdges.setColorAt(0, colBlue);
function showMoveRange() {
  moveTiles.count = 0; moveEdges.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9);
  const u = selected; if (!u || !u.alive || u.ap <= 0 || phase !== 'player' || busy || ui.mode !== 'move') { ui.reach = null; return; }
  ui.reach = reach(u, u.mob * u.ap);
  const zone = i => { const c = ui.reach.cost[i]; return !isFinite(c) ? 0 : c <= u.mob + 0.01 ? 1 : 2; };
  let n = 0, e = 0;
  for (let i = 0; i < N * N; i++) {
    const z = zone(i); if (!z) continue;
    const x = i % N, y = Math.floor(i / N);
    if (ui.reach.cost[i] > 0) {
      dummy.position.set(x + 0.5, 0.03, y + 0.5); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); moveTiles.setMatrixAt(n, dummy.matrix);
      moveTiles.setColorAt(n, z === 1 ? colBlue : colYel); n++;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nz = inb(x + dx, y + dy) ? zone(id(x + dx, y + dy)) : 0;
      if (!((z === 1 && nz !== 1) || (z === 2 && nz === 0))) continue;
      dummy.position.set(x + 0.5 + dx * 0.46, 0.04, y + 0.5 + dy * 0.46); dummy.rotation.set(0, dx ? Math.PI / 2 : 0, 0); dummy.updateMatrix();
      moveEdges.setMatrixAt(e, dummy.matrix); moveEdges.setColorAt(e, z === 1 ? colBlue : colYel); e++;
    }
  }
  moveTiles.count = n; moveTiles.instanceMatrix.needsUpdate = true; if (moveTiles.instanceColor) moveTiles.instanceColor.needsUpdate = true;
  moveEdges.count = e; moveEdges.instanceMatrix.needsUpdate = true; if (moveEdges.instanceColor) moveEdges.instanceColor.needsUpdate = true;
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
  ui.mode = 'target'; ui.preview = false; ui.ti = Math.max(0, ui.targets.indexOf(t)); moveTiles.count = 0; moveEdges.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9);
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
  refreshUI();
}
function hideTarget() { $('targetPanel').classList.remove('show'); tgtRing.visible = false; if (ui.mode === 'target') ui.mode = 'move'; }

// =====================================================================
//  ДЕЙСТВИЯ
// =====================================================================
function faceTo(u, x, z) { return Math.atan2(x - u.rig.root.position.x, z - u.rig.root.position.z); }
async function turnTo(u, yaw, dur = 0.25) { const y0 = u.rig.root.rotation.y; await tween(dur, k => { u.rig.root.rotation.y = angleLerp(y0, yaw, easeIO(k)); }); u.yaw = yaw; }

async function moveUnit(u, path, dash = false) {
  // невидимый дроид идёт вне поля зрения — без анимации
  if (u.team === 'droid' && !u.visible && !path.some(([x, z]) => vis[id(x, z)])) {
    const [x, z] = path[path.length - 1]; u.x = x; u.z = z; u.rig.root.position.set(x + 0.5, 0, z + 0.5);
    if (path.length > 1) { const [a, b] = path[path.length - 2]; u.yaw = u.rig.root.rotation.y = Math.atan2(x - a, z - b); }
    return;
  }
  u.state = dash ? 'run' : 'walk'; const speed = dash ? 4.6 : 3.3;
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1], [x1, z1] = path[i], diag = x0 !== x1 && z0 !== z1, yaw = Math.atan2(x1 - x0, z1 - z0), y0 = u.rig.root.rotation.y;
    let stepped = false;
    await tween((diag ? 1.41 : 1) / speed, k => {
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
      u.state = dash ? 'run' : 'walk';
    }
  }
  u.state = 'idle';
  // разведка: клоны обнаружили группу дроидов
  if (u.team === 'clone') await checkPods();
}

// ---------- режиссёр выстрела
const UP = new THREE.Vector3(0, 1, 0);
const chestY = u => (u.state === 'hunker' ? 0.45 : u.crouch ? 0.58 : u.type === 'b2' ? 0.82 : 0.78);
const eyeY = u => (u.type === 'b2' ? 1.0 : u.team === 'droid' ? 0.95 : 0.98);
let thirdCount = 0, ownShots = 0;
// режим камеры выстрела: auto — крутые моменты и каждый второй свой выстрел,
// first — всегда от первого лица, third — кино-ракурсы (снайпер всё равно через оптику)
const CAM_MODES = { auto: 'Авто: крутые моменты + каждый второй выстрел', first: 'Всегда от первого лица', third: 'Кино-ракурсы от третьего лица' };
let camMode = CAM_MODES[store('cvd-cam')] ? store('cvd-cam') : 'auto';
function coolMoment(s, t, info, out) {
  if (s.team === 'droid') return out.kill || out.crit || (out.hit && info.chance <= 40);
  return out.kill || out.crit || info.flank || s.type === 'sniper' || s.type === 'heavy' || (out.hit && info.chance <= 50);
}
function wantFirstPerson(s, t, info, out, opts) {
  if (camMode === 'first') return true;
  if (camMode === 'third') return s.type === 'sniper' && !opts.reaction;
  if (opts.reaction) return false;
  if (coolMoment(s, t, info, out)) return true;
  return s.team === 'clone' && ownShots % 2 === 0;
}
function camCandidate(mode, s, t, sp, tp, dir, right, sChest, tChest) {
  const okTile = p => { const x = Math.floor(p.x), z = Math.floor(p.z); return inb(x, z) && cell(x, z) !== FULL; };
  if (mode === 'shoulder') {
    for (const back of [1.3, 0.95, 0.65]) for (const side of [-1, 1]) {
      const p = new THREE.Vector3(sp.x, 1.3, sp.z).addScaledVector(dir, -back).addScaledVector(right, side * 0.5);
      if (okTile(p) && camClear(p, tChest, s, t)) return { pos: p, look: tChest.clone().lerp(sChest, 0.12), fov: 48 };
    }
  } else if (mode === 'side') {
    for (const side of [-1, 1]) {
      const mid = sp.clone().lerp(tp, 0.3), p = new THREE.Vector3(mid.x, 0.55, mid.z).addScaledVector(right, side * 2.6);
      if (okTile(p) && camClear(p, tChest, s, t) && camClear(p, sChest, s, t)) return { pos: p, look: sChest.clone().lerp(tChest, 0.45), fov: 56 };
    }
  } else if (mode === 'reverse') {
    for (const side of [-1, 1]) {
      const p = new THREE.Vector3(tp.x, 1.15, tp.z).addScaledVector(dir, 1.45).addScaledVector(right, side * 0.6);
      if (okTile(p) && camClear(p, sChest, s, t)) return { pos: p, look: sChest.clone().lerp(tChest, 0.18), fov: 46 };
    }
  }
  return null;
}
// куда прилетит промах: луч продолжается до земли или препятствия
function missEnd(from, aim) {
  const d = aim.clone().sub(from).normalize(), p = from.clone();
  for (let i = 0; i < 300; i++) {
    p.addScaledVector(d, 0.1);
    const x = Math.floor(p.x), z = Math.floor(p.z), c = cell(x, z);
    if (p.y <= 0.02) { p.y = 0.02; return { p, ground: true }; }
    if (from.distanceTo(p) > 1.2 && ((c === FULL && p.y < 1.6) || (c === HALF && p.y < 0.58))) return { p, ground: false };
  }
  return { p, ground: false };
}
async function shoot(s, t, opts = {}) {
  const info = shotInfo(s, t, opts.reaction); if (!info) return;
  busy = true; refreshUI(); hideTarget(); hint('');
  const hit = Math.random() * 100 < info.chance, crit = hit && Math.random() * 100 < info.crit;
  const dmg = hit ? Math.max(1, randi(s.dmg[0], s.dmg[1]) + (crit ? 2 : 0) - (t.armor || 0)) : 0;
  const out = { hit, crit, dmg, kill: hit && t.hp - dmg <= 0 };
  const [ox, oz] = info.origin, moved = ox !== s.x || oz !== s.z, from0 = s.rig.root.position.clone();
  const wasVisible = s.rig.root.visible; s.rig.root.visible = true;
  // выход из-за укрытия
  if (moved) { s.state = 'walk'; const p0 = s.rig.root.position.clone(), p1 = new THREE.Vector3(ox + 0.5, 0, oz + 0.5); await tween(0.32, k => s.rig.root.position.lerpVectors(p0, p1, easeIO(k))); }
  s.state = 'aim'; s.crouch = false; s.hunker = false;
  await turnTo(s, faceTo(s, t.x + 0.5, t.z + 0.5), 0.22);
  // ракурс
  const sp = s.rig.root.position.clone(), tp = t.rig.root.position.clone();
  const dir = new THREE.Vector3(tp.x - sp.x, 0, tp.z - sp.z).normalize(), right = new THREE.Vector3(dir.z, 0, -dir.x);
  const tChest = new THREE.Vector3(tp.x, chestY(t), tp.z), sChest = new THREE.Vector3(sp.x, 0.7, sp.z);
  let mode = wantFirstPerson(s, t, info, out, opts) ? 'first' : null, cpos, clook, fov;
  if (s.team === 'clone' && !opts.reaction) ownShots++;
  const cool = coolMoment(s, t, info, out);
  if (!mode) {
    const order = s.team === 'droid' ? ['reverse', 'shoulder', 'side'] : ['shoulder', 'side', 'reverse'];
    for (let i = 0; i < 3 && !mode; i++) { const m = order[(thirdCount + i) % 3], c = camCandidate(m, s, t, sp, tp, dir, right, sChest, tChest); if (c) { mode = m; cpos = c.pos; clook = c.look; fov = c.fov; } }
    thirdCount++;
    if (!mode) mode = 'first';
  }
  const fp = mode === 'first', scoped = fp && s.type === 'sniper';
  if (fp) { cpos = new THREE.Vector3(sp.x, eyeY(s), sp.z).addScaledVector(dir, 0.12).addScaledVector(right, -0.03); clook = tChest.clone(); fov = scoped ? 16 : 40; }
  window.cineMode = fp ? 'first' : 'third';
  document.body.classList.add('cine');
  $('cineInfo').textContent = `${fp && cool && !opts.reaction ? '★ ' : ''}${s.team === 'clone' ? s.call : s.name} → ${t.team === 'clone' ? t.call : t.name} · ${info.chance}%${info.flank ? ' · ФЛАНГ' : ''}`;
  const st = { pos: camera.position.clone(), look: new THREE.Vector3(cam.fx, 0, cam.fz) };
  cam.cine = { pos: st.pos.clone(), look: st.look.clone(), fov: fp ? 50 : fov };
  await tween(opts.reaction ? 0.38 : 0.65, k => { const e = easeIO(k); cam.cine.pos.lerpVectors(st.pos, cpos, e); cam.cine.look.lerpVectors(st.look, clook, e); });
  if (fp) {
    s.rig.body.visible = false; cam.cine.fov = fov;
    if (scoped) document.body.classList.add('scope'); else { viewModel(s, true); document.body.classList.add('xhair'); }
    if (s.team === 'droid') document.body.classList.add('droidvision');
  }
  window.cineStage = 'aim';
  await wait(fp ? 0.45 : 0.25);
  // выстрелы
  const shots = s.burst, bulletCam = fp && out.kill && s.type === 'sniper';
  for (let i = 0; i < shots; i++) {
    const last = i === shots - 1, m = new THREE.Vector3();
    if (scoped) m.copy(cam.cine.pos).addScaledVector(dir, 0.3).add(new THREE.Vector3(0, -0.04, 0));
    else (fp ? fpMuzzle : s.rig.muzzle).getWorldPosition(m);
    let end;
    if (hit && (last || Math.random() < 0.7)) end = { p: tChest.clone().add(new THREE.Vector3(rand(-0.05, 0.05), rand(-0.07, 0.09), rand(-0.05, 0.05))), body: true };
    else { const aim = tChest.clone().addScaledVector(right, (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 0.65)).add(new THREE.Vector3(0, rand(-0.15, 0.3), 0)); end = missEnd(m, aim); }
    Snd.fx.blaster(s.team);
    FX.muzzle(m, TEAMCOL[s.team]);
    if (fp) fpKick(); else recoil(s);
    if (last && out.kill) slow = bulletCam ? 0.35 : 0.3;
    const b = FX.bolt(m, end.p, s.team, bulletCam ? 16 : 40, bulletCam ? pos => { cam.cine.pos.copy(pos).addScaledVector(dir, -0.6).add(new THREE.Vector3(0, 0.08, 0)); cam.cine.look.copy(tChest); cam.cine.fov = 42; } : null);
    if (bulletCam) { document.body.classList.remove('scope'); }
    const impact = () => {
      if (end.body) { FX.spark(end.p.x, end.p.y, end.p.z, t.team === 'droid' ? 0xffd27a : 0xffffff, 14, 2.5); return; }
      FX.spark(end.p.x, end.p.y, end.p.z, 0xffc070, 10, 2.2); FX.puff(end.p.x, end.p.y, end.p.z, { color: 0x8a6a50, life: 1.2, s0: 0.15, s1: 0.7, vy: 0.3, a: 0.5 });
      if (end.ground) FX.scorch(end.p.x, end.p.z, 0.22);
      if (!last || !hit) Snd.fx.miss();
    };
    if (!last) { b.then(impact); await wait(s.burst > 2 ? 0.09 : 0.14); continue; }
    await b; impact();
  }
  // результат
  if (hit) {
    Snd.fx.impact(); FX.spark(tChest.x, tChest.y, tChest.z, t.team === 'droid' ? 0xffd27a : 0xffffff, 26, 3);
    FX.flash(tChest.x, tChest.y, tChest.z, 0xffd27a, 0.7, 0.15); t.flinch = 1; cam.shake = fp ? 0.08 : 0.15;
    if (t.team === 'clone') FX.scorch(tp.x + rand(-0.2, 0.2), tp.z + rand(-0.2, 0.2), 0.18);
    t.hp = Math.max(0, t.hp - dmg); popText(t, (crit ? 'КРИТ! −' : '−') + dmg, crit ? 'crit' : 'dmg');
    if (fp) hitMarker(out.kill);
  } else popText(t, 'ПРОМАХ', 'miss');
  if (t.hp <= 0) { const k = killUnit(t, dir); await wait(0.25); slow = 1; await k; } else slow = 1;
  await wait(out.kill ? 1.0 : hit ? 0.75 : 0.55);
  // возврат камеры
  if (fp) { s.rig.body.visible = true; viewModel(s, false); }
  document.body.classList.remove('cine', 'scope', 'xhair', 'droidvision');
  window.cineStage = 'done';
  const back = tacticalPose(), c0 = { pos: cam.cine.pos.clone(), look: cam.cine.look.clone() };
  cam.cine.fov = 42;
  await tween(0.55, k => { const e = easeIO(k); cam.cine.pos.lerpVectors(c0.pos, back.pos, e); cam.cine.look.lerpVectors(c0.look, back.look, e); });
  cam.cine = null;
  if (moved) { s.state = 'walk'; const p0 = s.rig.root.position.clone(); await tween(0.32, k => s.rig.root.position.lerpVectors(p0, from0, easeIO(k))); }
  s.state = 'idle'; if (s.team === 'droid') s.rig.root.visible = wasVisible || s.visible;
  busy = false; refreshUI(); checkEnd();
}
function hitMarker(kill) { const h = $('hitmark'); h.setAttribute('class', ''); void h.getBoundingClientRect(); h.setAttribute('class', kill ? 'show kill' : 'show'); }
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
async function killUnit(t, dirFrom) {
  t.alive = false; t.overwatch = false; t.hunker = false; t.crouch = false; t.state = 'dead';
  const p = t.rig.root.position;
  if (t.team === 'droid') { kills++; Snd.fx.droidDeath(); FX.spark(p.x, 0.75, p.z, 0x8fd8ff, 40, 4); FX.flash(p.x, 0.7, p.z, 0x8fd8ff, 0.9, 0.2); }
  else Snd.fx.cloneDown();
  // падаем от стрелка
  let back = Math.random() < 0.5 ? -1 : 1;
  if (dirFrom) { const fwd = new THREE.Vector3(Math.sin(t.rig.root.rotation.y), 0, Math.cos(t.rig.root.rotation.y)); back = fwd.dot(dirFrom) > 0 ? 1 : -1; }
  if (t.team === 'droid' && t.type !== 'b2' && t.rig.head && Math.random() < 0.6) {
    const hd = t.rig.head; world.attach(hd); t.debris = [hd];
    const v = new THREE.Vector3(rand(-1.2, 1.2), 3, rand(-1.2, 1.2)), p0 = hd.position.clone();
    if (dirFrom) v.addScaledVector(dirFrom, 1.5);
    tween(1.1, k => { const tt = k * 1.1; hd.position.set(p0.x + v.x * tt, Math.max(0.05, p0.y + v.y * tt - 4.9 * tt * tt), p0.z + v.z * tt); hd.rotation.x += 0.25; hd.rotation.z += 0.18; });
    for (let i = 0; i < 4; i++) FX.puff(p.x, 0.8, p.z, { color: 0x333333, s1: 1.2, life: 1.8 });
  }
  await deathAnim(t, back);
  if (t.team === 'droid') FX.scorch(p.x, p.z, 0.4);
  refreshUI();
}
// модель оружия и рук для вида от первого лица
let fpGun = null; const fpMuzzle = new THREE.Object3D();
function viewModel(u, on) {
  if (fpGun) { camera.remove(fpGun); fpGun = null; }
  if (!on) return;
  fpGun = new THREE.Group(); const g = new THREE.Group(); fpGun.add(g);
  if (u.team === 'clone') {
    const mz = rifle(g, u.type); fpMuzzle.position.set(0, 0.012, mz); g.add(fpMuzzle);
    g.add(at(caps(0.05, 0.2, M2.armor), 0.03, -0.1, -0.12, 1.2, 0, 0.1)); g.add(at(rbox(0.07, 0.08, 0.1, M2.suit, 0.03), 0.0, -0.07, 0.0));
    g.add(at(caps(0.048, 0.2, M2.armor), -0.09, -0.1, 0.2, 1.0, 0, -0.5)); g.add(at(rbox(0.07, 0.06, 0.1, M2.suit, 0.03), -0.04, -0.05, 0.28));
  } else if (u.type === 'b2') {
    for (const sx of [-1, 1]) { g.add(at(rbox(0.17, 0.17, 0.42, M2.b2, 0.05), sx * 0.24, -0.06, 0.05)); for (const b of [-1, 1]) g.add(at(cyl(0.022, 0.022, 0.16, M2.gun, 8), sx * 0.24 + b * 0.035, -0.02, 0.3, Math.PI / 2)); }
    fpMuzzle.position.set(0.24, -0.02, 0.4); g.add(fpMuzzle);
  } else {
    g.add(at(rbox(0.04, 0.07, 0.3, M2.gun, 0.012), 0, 0, 0.06)); g.add(at(cyl(0.012, 0.014, 0.26, M2.gunL, 6), 0, 0.01, 0.33, Math.PI / 2));
    g.add(at(rbox(0.025, 0.04, 0.2, M2.tan, 0.01), 0, 0, -0.17)); g.add(at(cyl(0.018, 0.018, 0.12, M2.gun, 8), 0, 0.055, 0.06, Math.PI / 2));
    g.add(at(cyl(0.02, 0.02, 0.3, M2.tanJ, 6), 0.03, -0.12, -0.08, 1.2)); g.add(at(rbox(0.045, 0.2, 0.04, M2.tan, 0.012), 0.03, -0.12, -0.08, 1.2));
    fpMuzzle.position.set(0, 0.01, 0.47); g.add(fpMuzzle);
  }
  g.rotation.y = Math.PI; // ствол смотрит вперёд камеры (−Z)
  fpGun.position.set(0.15, -0.15, -0.36); fpGun.rotation.set(0.02, -0.05, 0); fpGun.scale.setScalar(0.72);
  fpGun.userData.base = fpGun.position.clone();
  fpGun.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 10; } });
  camera.add(fpGun); if (!camera.parent) scene.add(camera);
}
function fpKick() {
  if (fpGun) { fpGun.position.z += 0.06; fpGun.rotation.x += 0.12; }
  cam.kick = 0.06;
}
function fpUpdate(dt) {
  if (!fpGun) return; const b = fpGun.userData.base, k = Math.min(1, dt * 10);
  fpGun.position.x += (b.x + Math.sin(performance.now() / 700) * 0.004 - fpGun.position.x) * k;
  fpGun.position.y += (b.y + Math.sin(performance.now() / 450) * 0.003 - fpGun.position.y) * k;
  fpGun.position.z += (b.z - fpGun.position.z) * k; fpGun.rotation.x += (0.02 - fpGun.rotation.x) * k;
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
  const first = clones()[0]; select(first); if (first) focusUnit(first);
}
function afterAction() {
  if (phase !== 'player') return;
  if (selected && selected.alive && selected.ap > 0) { showMoveRange(); refreshUI(); return; }
  const nxt = clones().find(u => u.ap > 0);
  if (nxt) { select(nxt); focusUnit(nxt); } else endPlayerTurn();
}
function nextUnit() {
  const cs = clones().filter(u => u.ap > 0); if (!cs.length) return;
  const i = cs.indexOf(selected); const n = cs[(i + 1) % cs.length]; select(n); focusUnit(n);
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
  const danger = computeChances(x, z); ui.preview = true;
  hint((c <= u.mob + 0.01 ? `Шаг ${Math.round(c)} кл. (1 очко)` : `Рывок ${Math.round(c)} кл. (2 очка)`) + (cv === FULL ? ' · полное укрытие' : cv === HALF ? ' · частичное укрытие' : ' · без укрытия') + (danger ? ` · ⚠ открыт для ${danger}` : '') + ' · нажмите ещё раз');
}
function onHover(cx, cy) {
  if (isTouch || phase !== 'player' || busy || ui.mode !== 'move' || !ui.reach) return;
  const { tile } = pick(cx, cy); if (!tile || !inb(...tile)) return;
  const c = ui.reach.cost[id(...tile)];
  if (isFinite(c) && c > 0 && !(ui.pending && ui.pending[0] === tile[0] && ui.pending[1] === tile[1])) {
    ui.pending = tile; previewPath(...tile); const danger = computeChances(...tile); ui.preview = true;
    hint((c <= selected.mob + 0.01 ? 'Шаг' : 'Рывок') + (danger ? ` · ⚠ открыт для ${danger}` : '') + ' · щёлкните для перехода');
  }
}
async function doMove(u, x, z) {
  const c = ui.reach.cost[id(x, z)], path = pathTo(ui.reach, x, z);
  const dash = c > u.mob + 0.01; u.ap -= dash ? 2 : 1; busy = true; ui.preview = false; ui.pending = null; moveTiles.count = 0; moveEdges.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9); hint(''); refreshUI();
  await moveUnit(u, path, dash);
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
    const s = cam.dist * 2 * Math.tan(camera.fov * Math.PI / 360) / innerHeight * 1.3, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    focus(cam.tfx - (dx * cy + dy * sy) * s, cam.tfz - (-dx * sy + dy * cy) * s, true);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (drag.pinch) { cam.tdist = clamp(cam.tdist * drag.pinch.d / d, ZOOM[0], ZOOM[1]); cam.dist = cam.tdist; cam.tyaw -= ang - drag.pinch.a; cam.yaw = cam.tyaw; }
    drag.pinch = { d, a: ang }; drag.moved = true;
  }
});
const endPtr = e => { const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (p && drag && !drag.moved && ptrs.size === 0) onTap(e.clientX, e.clientY); if (ptrs.size < 2 && drag) drag.pinch = null; };
el.addEventListener('pointerup', endPtr); el.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
el.addEventListener('wheel', e => { e.preventDefault(); cam.tdist = clamp(cam.tdist * (e.deltaY > 0 ? 1.12 : 0.89), ZOOM[0], ZOOM[1]); }, { passive: false });
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
function rotateCam(dir) { cam.tyaw = Math.round(cam.tyaw / (Math.PI / 4)) * (Math.PI / 4) + dir * Math.PI / 4; Snd.fx.click(); }

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
  hideTarget(); ui.mode = 'nade'; ui.nadeTile = null; moveTiles.count = 0; moveEdges.count = 0; pathDots.count = 0; destRing.visible = false; showShields(-9, -9);
  nadeRange.position.set(u.x + 0.5, 0.05, u.z + 0.5); nadeRange.visible = true; hint('Выберите место броска (до 9 клеток)'); Snd.fx.click(); refreshUI();
});
on('aNext', () => nextUnit());
on('aEnd', () => endPlayerTurn());
on('bRotL', () => rotateCam(-1)); on('bRotR', () => rotateCam(1));
on('bCam', () => {
  const keys = Object.keys(CAM_MODES); camMode = keys[(keys.indexOf(camMode) + 1) % keys.length]; store('cvd-cam', camMode);
  Snd.fx.click(); refreshUI(); hint('Камера выстрела: ' + CAM_MODES[camMode]); clearTimeout(window.__camHint); window.__camHint = setTimeout(() => hint(''), 2200);
});
on('bFast', () => { fastEnemy = !fastEnemy; store('cvd-fast', fastEnemy ? 'on' : 'off'); refreshUI(); Snd.fx.click(); });
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
<b>Камера выстрела</b> (кнопка с камерой): «A» — от первого лица в крутые моменты и каждый второй выстрел, «1» — всегда от первого лица, «3» — кино-ракурсы.<br>
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
  buildProps(); buildPebbles(); buildBlobs(); mapReady = true;
}
function spawnUnits() {
  clearUnits();
  SQUAD.forEach(([cls, call, num], i) => units.push(makeUnit('clone', cls, CLONE_SPAWN[i][0], CLONE_SPAWN[i][1], { call, num })));
  PODS.forEach((p, pi) => p.tiles.forEach(([x, z], k) => units.push(makeUnit('droid', p.types[k], x, z, { pod: pi, home: [x, z] }))));
}
async function startGame() {
  Snd.init(); Music.start(); goFullscreen();
  $('startScr').classList.remove('show'); $('endScr').classList.remove('show'); $('howScr').classList.remove('show');
  setupWorld(); spawnUnits(); turn = 1; kills = 0; shotCount = 0; podsActive = [false, false, false]; seenEver.fill(0); FX.clearDecals();
  tweens.length = 0; busy = true; phase = 'intro'; cam.cine = null; document.body.classList.remove('cine');
  updateVisibility(); buildSquadUI(); document.body.classList.add('playing');
  // вступление: вид сверху на всё поле, затем спуск к отряду
  const yaw = squadYaw();
  cam.mode = 'tactical'; cam.fx = cam.tfx = N / 2; cam.fz = cam.tfz = N / 2; cam.pitch = cam.tpitch = 1.52; cam.dist = cam.tdist = 64; cam.yaw = cam.tyaw = yaw;
  hint('Разведка с орбиты…');
  await wait(1.4);
  // спуск за спины отряда, взгляд в сторону противника
  const cs = clones(), sx = cs.reduce((a, u) => a + u.x, 0) / cs.length + 0.5, sz = cs.reduce((a, u) => a + u.z, 0) / cs.length + 0.5;
  cam.tpitch = VIEWS.tactical.pitch; cam.tdist = VIEWS.tactical.dist; focus(sx - Math.sin(yaw) * 3, sz - Math.cos(yaw) * 3);
  await wait(1.6); hint('');
  busy = false; startPlayerTurn();
}

// ---------- главный цикл
let last = performance.now(), timeScale = 1, slow = 1; // timeScale — ускорение (тесты, кнопка), slow — замедление на убийствах
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  $('rotate').classList.toggle('show', isTouch && h > w);
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
let smokeT = 0, attractT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * timeScale * slow * (phase === 'enemy' && fastEnemy ? 2 : 1); last = now;
  tweensUpdate(dt); FX.update(dt); dustUpdate(dt);
  for (const u of units) poseRig(u, dt);
  // дым над обломками
  smokeT -= dt; if (smokeT < 0) { smokeT = 0.35; for (const [x, y, z] of smokeSources) FX.puff(x + rand(-0.2, 0.2), y, z + rand(-0.2, 0.2), { color: 0x3b332e, life: 3.2, s0: 0.3, s1: 1.8, vy: 0.5, a: 0.45 }); }
  // кольцо выбранного
  if (selected && selected.alive && phase === 'player') { selRing.visible = true; selRing.position.set(selected.rig.root.position.x, 0.04, selected.rig.root.position.z); selRing.scale.setScalar(1 + Math.sin(now / 250) * 0.06); } else selRing.visible = false;
  tgtRing.rotation.z += dt * 1.5;
  if (phase === 'start') { attractT += dt; cam.tyaw = cam.yaw = -Math.PI / 4 + attractT * 0.06; cam.fx = cam.tfx = N / 2; cam.fz = cam.tfz = N / 2; }
  fpUpdate(dt); camUpdate(dt); syncLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// стартовый экран: сцена на фоне (сначала загружаем модели персонажей)
loadCharacters().then(() => {
  setupWorld(); spawnUnits(); for (const u of units) u.rig.root.visible = true;
  cam.pitch = cam.tpitch = 1.0; cam.dist = cam.tdist = 50;
  resize(); $('loading').remove(); requestAnimationFrame(frame);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) Music.stop(); else if (phase !== 'start') Music.start(); });
window.appPause = () => { Music.stop(); };
