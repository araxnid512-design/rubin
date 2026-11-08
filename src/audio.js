'use strict';
// ---------- Звук и музыка: синтез на WebAudio, без файлов ----------
// Эффекты строятся из шума, тонов и фильтров, проходят через ревербератор и компрессор.
// Музыка — генеративная: аккорды, мелодия и ритм складываются заново на лету под настроение экрана.

const Sfx = {
  ctx: null, master: null, music: null, revIn: null, nb: null, lastStep: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); Music.kick(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.build(new AC());
      document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {}); });
      Music.kick();
      if (this.ambKind) { const k = this.ambKind; this.ambKind = null; this.ambient(k); }
    } catch (e) { this.ctx = null; }
  },
  // Фон погоды: шум дождя или ветер в тумане
  ambient(kind) {
    if (!this.ctx) { this.ambKind = kind; return; }
    const c = this.ctx, t = c.currentTime;
    if (this.amb) {
      const a = this.amb; this.amb = null;
      a.g.gain.setTargetAtTime(0, t, 0.5);
      setTimeout(() => { try { a.s.stop(); if (a.lfo) a.lfo.stop(); } catch (e) { /* уже остановлен */ } }, 2500);
    }
    if (!kind) return;
    const s = c.createBufferSource(); s.buffer = this.nb; s.loop = true;
    const f = c.createBiquadFilter(), g = c.createGain();
    let lfo = null;
    if (kind === 'rain') { f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.45; }
    else {
      f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 2;
      lfo = c.createOscillator(); lfo.frequency.value = 0.11;
      const lg = c.createGain(); lg.gain.value = 0.025; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    }
    g.gain.value = 0; g.gain.setTargetAtTime(kind === 'rain' ? 0.075 : 0.045, t, 1.2);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random());
    this.amb = { s, g, lfo, kind };
  },
  thunder() {
    if (!CFG.sound || !this.ctx) return;
    const t = this.ctx.currentTime + 0.02, dist = 0.4 + Math.random() * 0.6;
    const to = this.out({ vol: 0.55 * dist, pan: Math.random() * 1.2 - 0.6, rev: 0.7 });
    this.noise(t, 0.35, { type: 'highpass', f0: 900, g: 0.25 * dist, a: 0.005, to });
    this.noise(t + 0.05, 3.2, { type: 'lowpass', f0: 420, f1: 50, q: 0.9, g: 0.8, a: 0.12, to });
    this.noise(t + 0.6, 2.2, { type: 'lowpass', f0: 260, f1: 40, g: 0.5, a: 0.3, to });
  },
  build(c) {
    this.ctx = c;
    {
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
      comp.connect(c.destination);
      this.master = c.createGain(); this.master.connect(comp);
      this.music = c.createGain(); this.music.connect(comp);
      this.revIn = c.createGain();
      const conv = c.createConvolver(); conv.buffer = this.impulse(2.4, 2.6);
      const rg = c.createGain(); rg.gain.value = 0.8;
      this.revIn.connect(conv); conv.connect(rg); rg.connect(comp);
      const len = c.sampleRate * 2;
      this.nb = c.createBuffer(1, len, c.sampleRate);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.setVol();
    }
  },
  impulse(sec, decay) {
    const c = this.ctx, len = Math.floor(sec * c.sampleRate), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  },
  setVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(CFG.sound ? CFG.vol * 0.9 : 0, t, 0.05);
    this.music.gain.setTargetAtTime(CFG.music ? CFG.musicVol * 0.55 : 0, t, 0.3);
  },
  // Выход звука: громкость, панорама и доля в ревербератор
  out(o) {
    const c = this.ctx, g = c.createGain();
    g.gain.value = o.vol ?? 1;
    let node = g;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); node = p; }
    node.connect(o.dest || this.master);
    if (o.rev) { const s = c.createGain(); s.gain.value = o.rev; node.connect(s); s.connect(this.revIn); }
    return g;
  },
  noise(t, dur, o) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; f.type = o.type || 'lowpass'; f.Q.value = o.q ?? 0.7;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t + dur);
    const a = o.a ?? 0.002;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.g ?? 0.5, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.to);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  tone(t, dur, o) {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
    osc.type = o.w || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    const a = o.a ?? 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.g ?? 0.3, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); src = f; }
    src.connect(g); g.connect(o.to);
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  },
  // Голос: пила с вибрато через два форманта
  voice(t, dur, o) {
    const c = this.ctx, osc = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(o.f0, t); osc.frequency.linearRampToValueAtTime(o.f1 || o.f0, t + dur);
    lfo.frequency.value = o.vib || 5; lg.gain.value = o.vd || 4; lfo.connect(lg); lg.connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.g ?? 0.3, t + (o.a ?? 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src = osc;
    if (o.dist) { const ws = c.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * o.dist); } ws.curve = cv; osc.connect(ws); src = ws; }
    for (const [fq, q, lv] of o.formants || [[520, 5, 1], [1100, 6, 0.6]]) {
      const f = c.createBiquadFilter(), fg = c.createGain();
      f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q; fg.gain.value = lv;
      src.connect(f); f.connect(fg); fg.connect(g);
    }
    g.connect(o.to);
    osc.start(t); lfo.start(t); osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  },
  // Положение источника на карте → громкость и панорама
  spatial(x, y, fall = 22) {
    if (x == null || !TAC.m || R.mode !== 'tac') return { vol: 1, pan: 0 };
    const [sx] = R.proj(x + 0.5, y + 0.5, 0);
    const d = Math.hypot(x + 0.5 - R.cam.cx, y + 0.5 - R.cam.cy);
    return { vol: clamp(1.15 - d / fall, 0.18, 1), pan: clamp((sx - R.W / 2) / (R.W / 2), -1, 1) * 0.7 };
  },
  play(k, o = {}) {
    if (!CFG.sound || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const t = this.ctx.currentTime + 0.01, sp = this.spatial(o.x, o.y, o.fall);
      const to = rev => this.out({ vol: sp.vol * (o.vol ?? 1), pan: sp.pan, rev });
      const r = () => Math.random();
      switch (k) {
        case 'shot': { const q = to(0.32); this.noise(t, 0.05, { type: 'highpass', f0: 2200, g: 1, to: q }); this.noise(t, 0.28, { f0: 3200, f1: 380, g: 0.75, to: q }); this.tone(t, 0.16, { f0: 165, f1: 48, g: 0.75, to: q }); this.tone(t + 0.012, 0.02, { w: 'square', f0: 1900, g: 0.08, to: q }); break; }
        case 'shotgun': { const q = to(0.5); this.noise(t, 0.06, { type: 'highpass', f0: 1800, g: 1, to: q }); this.noise(t, 0.65, { f0: 2600, f1: 140, g: 1, to: q }); this.tone(t, 0.38, { f0: 115, f1: 34, g: 1, to: q }); for (const dt of [0.5, 0.64]) this.noise(t + dt, 0.045, { type: 'bandpass', f0: 1300, q: 3, g: 0.35, to: q }); break; }
        case 'rifle': { const q = to(0.45); this.noise(t, 0.035, { type: 'highpass', f0: 3200, g: 1.1, to: q }); this.noise(t, 0.32, { f0: 4200, f1: 300, g: 0.85, to: q }); this.tone(t, 0.2, { f0: 190, f1: 44, g: 0.7, to: q }); this.noise(t + 0.2, 0.45, { f0: 1500, f1: 300, g: 0.22, to: q }); break; }
        case 'silenced': { const q = to(0.12); this.noise(t, 0.09, { type: 'bandpass', f0: 950, q: 1.2, g: 0.5, to: q }); this.tone(t, 0.016, { w: 'square', f0: 2500, g: 0.1, to: q }); this.noise(t + 0.05, 0.03, { type: 'bandpass', f0: 3200, q: 2, g: 0.25, to: q }); break; }
        case 'whoosh': { const q = to(0.05); this.noise(t, o.dur || 0.2, { type: 'bandpass', f0: 380, f1: 1900, q: 2.2, g: 0.6, a: 0.06, to: q }); break; }
        case 'stab': { const q = to(0.08); this.noise(t, 0.08, { type: 'bandpass', f0: 600, f1: 2200, q: 2, g: 0.25, a: 0.02, to: q }); this.noise(t + 0.07, 0.11, { type: 'bandpass', f0: 420, q: 4, g: 0.55, to: q }); this.tone(t + 0.07, 0.09, { f0: 150, f1: 70, g: 0.4, to: q }); break; }
        case 'hit_bat': { const q = to(0.12); this.tone(t, 0.08, { w: 'triangle', f0: 240, f1: 170, g: 0.5, to: q }); this.tone(t, 0.2, { f0: 95, f1: 48, g: 0.9, to: q }); this.noise(t, 0.12, { f0: 900, f1: 200, g: 0.55, to: q }); break; }
        case 'hit_axe': { const q = to(0.12); this.noise(t, 0.06, { type: 'bandpass', f0: 1500, q: 2, g: 0.6, to: q }); this.tone(t, 0.2, { f0: 90, f1: 45, g: 0.9, to: q }); this.noise(t + 0.02, 0.14, { type: 'bandpass', f0: 520, q: 5, g: 0.45, to: q }); break; }
        case 'hit_crowbar': { const q = to(0.18); this.tone(t, 0.35, { w: 'square', f0: 880, g: 0.06, lp: 2400, to: q }); this.tone(t, 0.45, { f0: 1420, g: 0.1, to: q }); this.tone(t, 0.18, { f0: 95, f1: 50, g: 0.8, to: q }); this.noise(t, 0.1, { f0: 800, f1: 200, g: 0.45, to: q }); break; }
        case 'flesh': { const q = to(0.08); this.noise(t, 0.09, { type: 'bandpass', f0: 600, q: 6, g: 0.35, to: q }); this.tone(t, 0.1, { f0: 120, f1: 60, g: 0.35, to: q }); break; }
        case 'zswipe': { const q = to(0.08); this.noise(t, 0.16, { type: 'bandpass', f0: 300, f1: 1100, q: 1.6, g: 0.55, a: 0.05, to: q }); break; }
        case 'hurt': { const q = to(0.15); this.voice(t, 0.24, { f0: 190, f1: 130, g: 0.35, a: 0.02, vib: 9, vd: 6, formants: [[700, 6, 1], [1250, 7, 0.7]], to: q }); this.tone(t, 0.18, { f0: 100, f1: 50, g: 0.7, to: q }); this.noise(t, 0.12, { f0: 1200, f1: 300, g: 0.35, to: q }); break; }
        case 'groan': { const q = to(0.35); const f0 = 85 + r() * 45; this.voice(t, 0.9 + r() * 0.5, { f0, f1: f0 * 0.8, g: 0.32, a: 0.18, vib: 4 + r() * 3, vd: 5, formants: [[450 + r() * 150, 5, 1], [950 + r() * 250, 6, 0.55]], to: q }); this.noise(t, 0.8, { f0: 700, g: 0.07, a: 0.2, to: q }); break; }
        case 'scream': { const q = to(0.5); this.voice(t, 1.0, { f0: 520, f1: 1150, g: 0.4, a: 0.05, vib: 9, vd: 35, dist: 4, formants: [[1500, 2, 1], [2600, 3, 0.6]], to: q }); this.noise(t, 0.7, { type: 'highpass', f0: 3000, g: 0.12, a: 0.05, to: q }); break; }
        case 'zdie': { const q = to(0.25); this.voice(t, 0.75, { f0: 110, f1: 55, g: 0.3, a: 0.05, vib: 3, vd: 3, to: q }); this.tone(t + 0.38, 0.22, { f0: 85, f1: 40, g: 0.7, to: q }); this.noise(t + 0.38, 0.2, { f0: 600, f1: 150, g: 0.4, to: q }); break; }
        case 'death': { const q = to(0.5); this.tone(t, 0.25, { f0: 85, f1: 40, g: 0.8, to: q }); this.noise(t, 0.2, { f0: 600, f1: 150, g: 0.4, to: q }); this.tone(t + 0.1, 1.6, { w: 'triangle', f0: 220, f1: 110, g: 0.18, a: 0.3, to: q }); this.tone(t + 0.1, 1.6, { w: 'triangle', f0: 261, f1: 130, g: 0.12, a: 0.3, to: q }); break; }
        case 'step': {
          if (performance.now() - this.lastStep < 60) break;
          this.lastStep = performance.now();
          const q = to(0.03), s = o.surf, v = (0.75 + r() * 0.5) * 1.9;
          if (s === 'grass' || s === 'crop') { this.noise(t, 0.08, { type: 'bandpass', f0: 1700 + r() * 600, q: 0.8, g: 0.13 * v, a: 0.01, to: q }); this.noise(t + 0.03, 0.06, { type: 'bandpass', f0: 2600, q: 1, g: 0.06 * v, to: q }); }
          else if (s === 'wood') { this.tone(t, 0.06, { w: 'triangle', f0: 190 + r() * 30, f1: 140, g: 0.16 * v, to: q }); this.noise(t, 0.04, { f0: 900, g: 0.08 * v, to: q }); }
          else if (s === 'water') { this.noise(t, 0.13, { type: 'bandpass', f0: 2400, q: 1, g: 0.14 * v, to: q }); this.tone(t + 0.02, 0.05, { f0: 900, f1: 1500, g: 0.05 * v, to: q }); }
          else if (s === 'dirt') { this.noise(t, 0.07, { f0: 700 + r() * 300, g: 0.16 * v, a: 0.006, to: q }); }
          else { this.noise(t, 0.045, { f0: 1300 + r() * 400, g: 0.18 * v, to: q }); this.tone(t, 0.04, { f0: 130, f1: 85, g: 0.1 * v, to: q }); }
          break;
        }
        case 'zstep': { const q = to(0.02); this.noise(t, 0.18, { f0: 450, g: 0.14, a: 0.04, to: q }); break; }
        case 'door': { const q = to(0.15); this.voice(t, 0.42, { f0: 300, f1: 420, g: 0.08, a: 0.05, vib: 12, vd: 20, formants: [[900, 9, 1]], to: q }); this.noise(t + 0.38, 0.03, { type: 'highpass', f0: 3000, g: 0.25, to: q }); this.tone(t + 0.38, 0.06, { w: 'triangle', f0: 220, f1: 160, g: 0.2, to: q }); break; }
        case 'bash': { const q = to(0.25); this.tone(t, 0.28, { f0: 72, f1: 38, g: 1, to: q }); this.noise(t, 0.14, { type: 'bandpass', f0: 1200, q: 1.5, g: 0.6, to: q }); this.noise(t + 0.02, 0.25, { f0: 500, f1: 120, g: 0.4, to: q }); break; }
        case 'search': { const q = to(0.05); for (let n = 0; n < 4; n++) this.noise(t + n * 0.075, 0.05 + r() * 0.05, { type: 'bandpass', f0: 800 + r() * 1800, q: 1.4, g: 0.14 + r() * 0.12, to: q }); break; }
        case 'pickup': { const q = to(0.1); this.tone(t, 0.08, { f0: 1500, g: 0.08, to: q }); this.tone(t + 0.06, 0.12, { f0: 2200, g: 0.06, to: q }); this.noise(t, 0.05, { type: 'bandpass', f0: 2500, q: 2, g: 0.1, to: q }); break; }
        case 'click': { const q = to(0); this.tone(t, 0.035, { f0: 1250, g: 0.07, to: q }); this.noise(t, 0.012, { type: 'highpass', f0: 4000, g: 0.06, to: q }); break; }
        case 'alarm': { const q = to(0.7); this.tone(t, 1.8, { w: 'sawtooth', f0: 70, f1: 62, g: 0.3, a: 0.6, lp: 380, to: q }); for (let n = 0; n < 3; n++) { const f0 = 80 + r() * 50; this.voice(t + 0.2 + n * 0.35, 1.2, { f0, f1: f0 * 0.75, g: 0.12, a: 0.3, vib: 4, vd: 4, to: q }); } this.tone(t, 0.5, { f0: 55, f1: 40, g: 0.6, to: q }); break; }
        case 'throw': { const q = to(0.3); this.noise(t, 0.26, { type: 'bandpass', f0: 500, f1: 2200, q: 2, g: 0.25, a: 0.08, to: q }); const tt = t + spd(380) / 1000; this.noise(tt, 0.22, { type: 'highpass', f0: 4200, g: 0.5, to: q }); for (let n = 0; n < 7; n++) this.tone(tt + r() * 0.12, 0.06 + r() * 0.18, { f0: 2200 + r() * 3200, g: 0.06, to: q }); break; }
        case 'evac': { const q = to(0.2); this.tone(t, 0.15, { f0: 80, f1: 40, g: 0.6, to: q }); this.tone(t + 0.2, 1.3, { w: 'sawtooth', f0: 42, f1: 78, g: 0.22, a: 0.15, lp: 420, to: q }); this.noise(t + 0.2, 1.3, { f0: 300, f1: 600, g: 0.15, a: 0.15, to: q }); break; }
        case 'heal': { const q = to(0.25); this.noise(t, 0.26, { type: 'bandpass', f0: 2400, f1: 700, q: 1.5, g: 0.22, a: 0.02, to: q }); this.tone(t + 0.22, 0.5, { f0: 880, g: 0.07, a: 0.02, to: q }); this.tone(t + 0.3, 0.55, { f0: 1320, g: 0.05, a: 0.02, to: q }); break; }
        case 'build': { const q = to(0.2); for (let n = 0; n < 3; n++) { this.tone(t + n * 0.16, 0.12, { f0: 140, f1: 70, g: 0.6, to: q }); this.noise(t + n * 0.16, 0.08, { type: 'bandpass', f0: 1800, q: 2, g: 0.3, to: q }); } break; }
      }
    } catch (e) { if (Sfx.debug) throw e; }
  },
};
const SURF = { [T.GRASS]: 'grass', [T.DIRT]: 'dirt', [T.WOOD]: 'wood', [T.WATER]: 'water' };
function surfAt(m, x, y) { const i = MI(m, x, y); return m.tiles[i] === T.CROP ? 'crop' : SURF[m.ground[i]] || 'hard'; }

// ----- генеративная музыка -----
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const MOODS = {
  menu: { bpm: 62, chords: [[57, 60, 64], [53, 57, 60], [48, 55, 64], [52, 55, 59]], scale: [57, 60, 62, 64, 67, 69, 72, 74, 76], mel: 0.3, arp: 0, beat: 0 },
  base: { bpm: 74, chords: [[57, 60, 64], [48, 52, 55], [55, 59, 62], [53, 57, 60]], scale: [57, 60, 62, 64, 67, 69, 72], mel: 0.12, arp: 1, beat: 0 },
  mission: { bpm: 68, chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 49, 52]], scale: [50, 52, 53, 55, 57, 58, 62, 64, 65], mel: 0.08, arp: 0, beat: 1 },
};
const Music = {
  mood: null, want: null, bus: null, timer: 0, next: 0, step: 0, bar: 0,
  kick() { if (this.want) this.set(this.want, true); },
  set(mood, force) {
    this.want = mood;
    if (!Sfx.ctx) return;
    if (!force && mood === this.mood && this.bus) return;
    const c = Sfx.ctx, t = c.currentTime;
    if (this.bus) { const old = this.bus; old.gain.setTargetAtTime(0.0001, t, 0.5); setTimeout(() => { try { old.disconnect(); } catch (e) { /* уже отключён */ } }, 2500); }
    this.mood = mood; this.bus = null;
    if (!mood || !CFG.music) return;
    this.bus = c.createGain();
    this.bus.gain.setValueAtTime(0.0001, t); this.bus.gain.setTargetAtTime(1, t + 0.3, 0.8);
    this.bus.connect(Sfx.music);
    const rs = c.createGain(); rs.gain.value = 0.55; this.bus.connect(rs); rs.connect(Sfx.revIn);
    this.next = t + 0.1; this.step = 0; this.bar = 0;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 90);
  },
  tick() {
    if (!this.bus || !Sfx.ctx || document.hidden) return;
    const c = Sfx.ctx, M = MOODS[this.mood];
    if (!M) return;
    const tense = this.mood === 'mission' && TAC.m ? Math.min(3, (TAC.m.threat || 0) + timeOfDay(TAC.m)) : 0;
    const spb = 60 / (M.bpm + tense * 6) / 2;
    while (this.next < c.currentTime + 0.35) {
      this.play(M, this.next, this.step % 8, this.bar, spb, tense);
      this.next += spb; this.step++;
      if (this.step % 8 === 0) this.bar++;
    }
  },
  play(M, t, s, bar, spb, tense) {
    const ch = M.chords[Math.floor(bar / 2) % M.chords.length], to = this.bus, r = Math.random;
    if (s === 0 && bar % 2 === 0) {
      for (const n of ch) this.pad(t, mtof(n), spb * 16, to);
      this.bass(t, mtof(ch[0] - 12), spb * 14, to);
    }
    if (M.arp) { const seq = [0, 1, 2, 1, 2, 1, 0, 2]; this.pluck(t, mtof(ch[seq[s]] + 12), 0.065, to); }
    if (r() < M.mel && s % 2 === 0) this.pluck(t, mtof(M.scale[(r() * M.scale.length) | 0] + 12), 0.14, to);
    if (this.mood === 'menu' && s === 4 && bar % 4 === 3) this.bell(t, mtof(M.scale[(r() * 4) | 0] + 24), to);
    if (M.beat) {
      if (s === 0 || s === 4) this.kickDrum(t, 0.55, to);
      if (s === 1 || s === 5) this.kickDrum(t, 0.3, to);
      if (tense >= 2 && (s === 3 || s === 7)) this.tom(t, 110, to);
      if (tense >= 1 && s % 2 === 1) this.tick16(t, to);
      if (s === 0 && bar % 4 === 2) this.swell(t, mtof(ch[2] + 12), spb * 12, to);
    }
  },
  osc(t, dur, w, f, g, att, rel, lp, to, det = 0) {
    const c = Sfx.ctx, o = c.createOscillator(), gg = c.createGain();
    o.type = w; o.frequency.value = f; o.detune.value = det;
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(g, t + att);
    gg.gain.setValueAtTime(g, t + Math.max(att, dur - rel)); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; f2.Q.value = 0.5; o.connect(f2); n = f2; }
    n.connect(gg); gg.connect(to);
    o.start(t); o.stop(t + dur + 0.05);
  },
  pad(t, f, dur, to) { const g = this.mood === 'menu' ? 0.04 : 0.025; this.osc(t, dur, 'sawtooth', f, g, 1.6, 2.5, 900, to, -8); this.osc(t, dur, 'sawtooth', f, g, 1.6, 2.5, 900, to, 8); },
  bass(t, f, dur, to) { this.osc(t, dur, 'sine', f, 0.14, 0.4, 1.5, 0, to); this.osc(t, dur, 'triangle', f, 0.04, 0.4, 1.5, 400, to); },
  pluck(t, f, g, to) { this.osc(t, 1.4, 'triangle', f, g, 0.005, 1.35, 2600, to); this.osc(t, 0.5, 'sawtooth', f, g * 0.25, 0.005, 0.48, 1400, to); },
  bell(t, f, to) { for (const [m, g] of [[1, 0.06], [2.76, 0.025], [5.4, 0.012]]) this.osc(t, 3, 'sine', f * m, g, 0.005, 2.9, 0, to); },
  kickDrum(t, g, to) {
    const c = Sfx.ctx, o = c.createOscillator(), gg = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(g * 0.5, t + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(gg); gg.connect(to); o.start(t); o.stop(t + 0.45);
  },
  tom(t, f, to) {
    const c = Sfx.ctx, o = c.createOscillator(), gg = c.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.3);
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.14, t + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(gg); gg.connect(to); o.start(t); o.stop(t + 0.4);
  },
  tick16(t, to) { Sfx.noise(t, 0.04, { type: 'highpass', f0: 6000, g: 0.035, to }); },
  swell(t, f, dur, to) {
    const c = Sfx.ctx, o = c.createOscillator(), bp = c.createBiquadFilter(), gg = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.6);
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.6); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(gg); gg.connect(to); o.start(t); o.stop(t + dur + 0.05);
  },
};
