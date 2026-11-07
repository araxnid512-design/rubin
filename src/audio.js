'use strict';
// ---------- Синтезированные звуки (WebAudio, без файлов) ----------
const Sfx = {
  ctx: null, nb: null, master: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.nb = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.setVol();
    } catch (e) { this.ctx = null; }
  },
  setVol() { if (this.master) this.master.gain.value = CFG.sound ? CFG.vol * 0.55 : 0; },
  noise(t, dur, f0, f1, gain, type = 'lowpass') {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; f.type = type;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  tone(t, dur, f0, f1, gain, type = 'sine') {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  play(k) {
    if (!CFG.sound || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const t = this.ctx.currentTime + 0.005;
      switch (k) {
        case 'shot': this.noise(t, 0.22, 3500, 300, 0.9); this.tone(t, 0.12, 180, 50, 0.6); break;
        case 'silenced': this.noise(t, 0.08, 1800, 400, 0.35, 'bandpass'); break;
        case 'shotgun': this.noise(t, 0.45, 2500, 120, 1.0); this.tone(t, 0.25, 120, 35, 0.8); break;
        case 'rifle': this.noise(t, 0.35, 5000, 200, 0.9); this.tone(t, 0.18, 220, 40, 0.6, 'triangle'); break;
        case 'melee': this.tone(t, 0.12, 140, 60, 0.7); this.noise(t, 0.08, 900, 200, 0.4); break;
        case 'stab': this.noise(t, 0.1, 2400, 600, 0.35, 'bandpass'); this.tone(t, 0.08, 300, 120, 0.2); break;
        case 'hurt': this.tone(t, 0.25, 220, 90, 0.5, 'sawtooth'); this.noise(t, 0.12, 1200, 300, 0.4); break;
        case 'zdie': this.tone(t, 0.4, 110, 45, 0.45, 'sawtooth'); break;
        case 'groan': this.tone(t, 0.6, 90 + Math.random() * 30, 60, 0.2, 'sawtooth'); break;
        case 'scream': this.tone(t, 0.7, 500, 1400, 0.35, 'sawtooth'); this.tone(t + 0.05, 0.6, 760, 1900, 0.2, 'square'); break;
        case 'door': this.tone(t, 0.15, 180, 120, 0.4, 'triangle'); this.noise(t, 0.1, 600, 200, 0.3); break;
        case 'bash': this.tone(t, 0.18, 90, 40, 0.8); this.noise(t, 0.15, 800, 100, 0.5); break;
        case 'search': this.noise(t, 0.25, 1500, 900, 0.25, 'bandpass'); this.noise(t + 0.15, 0.2, 1200, 700, 0.2, 'bandpass'); break;
        case 'click': this.tone(t, 0.05, 900, 600, 0.15, 'square'); break;
        case 'alarm': this.tone(t, 0.25, 440, 440, 0.3, 'square'); this.tone(t + 0.28, 0.25, 330, 330, 0.3, 'square'); break;
        case 'throw': this.noise(t, 0.18, 900, 2500, 0.2, 'bandpass'); this.noise(t + 0.25, 0.3, 5000, 1500, 0.5, 'highpass'); break;
        case 'evac': this.tone(t, 0.3, 140, 220, 0.4, 'sawtooth'); this.tone(t + 0.3, 0.4, 220, 330, 0.3, 'sawtooth'); break;
        case 'death': this.tone(t, 0.9, 300, 70, 0.5, 'triangle'); break;
        case 'heal': this.tone(t, 0.15, 520, 780, 0.2); this.tone(t + 0.12, 0.2, 780, 1040, 0.15); break;
        case 'step': this.noise(t, 0.04, 700, 300, 0.08); break;
      }
    } catch (e) { /* звук не критичен */ }
  },
};
