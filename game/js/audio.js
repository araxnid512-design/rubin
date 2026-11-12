'use strict';
/* Синтезированные звуки (без внешних файлов) */
(function (DW) {
  const S = {};
  let ctx = null, master = null, noiseBuf = null;

  function init() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { ctx = null; return false; }
  }

  S.unlock = function () {
    if (!init()) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
  };

  function noise(t, dur, freq, q, gain, type) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.05);
  }
  function tone(t, dur, f0, f1, type, gain) {
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  S.play = function (name) {
    if (!DW.settings.sound || !ctx) return;
    if (ctx.state === 'suspended') return;
    const t = ctx.currentTime + 0.01;
    try {
      switch (name) {
        case 'rifle':
          for (let i = 0; i < 3; i++) { noise(t + i * 0.09, 0.13, 1300, 0.8, 0.55); tone(t + i * 0.09, 0.08, 170, 60, 'square', 0.1); }
          break;
        case 'lmg':
          for (let i = 0; i < 6; i++) { noise(t + i * 0.07, 0.11, 900, 0.8, 0.55); tone(t + i * 0.07, 0.07, 140, 50, 'square', 0.1); }
          break;
        case 'shotgun':
          noise(t, 0.4, 650, 0.6, 0.9); tone(t, 0.22, 120, 40, 'square', 0.22);
          noise(t + 0.35, 0.06, 2500, 3, 0.25); noise(t + 0.5, 0.06, 2000, 3, 0.25);
          break;
        case 'sniper':
          noise(t, 0.55, 2200, 0.5, 0.8); tone(t, 0.16, 320, 50, 'sawtooth', 0.18);
          break;
        case 'spit':
          noise(t, 0.3, 3200, 2, 0.3); tone(t, 0.25, 420, 110, 'sine', 0.15);
          break;
        case 'beam':
          tone(t, 0.35, 1400, 300, 'sawtooth', 0.12); tone(t, 0.35, 700, 150, 'square', 0.06);
          break;
        case 'melee':
          noise(t, 0.16, 500, 1, 0.5); tone(t, 0.16, 95, 45, 'sawtooth', 0.2);
          break;
        case 'growl':
          tone(t, 0.7, 75, 52, 'sawtooth', 0.16); noise(t, 0.6, 300, 1.5, 0.25, 'lowpass');
          break;
        case 'explosion':
          noise(t, 1.3, 220, 0.5, 1.0, 'lowpass'); tone(t, 0.7, 85, 28, 'sine', 0.55);
          break;
        case 'hit':
          tone(t, 0.08, 220, 80, 'square', 0.09);
          break;
        case 'click':
          tone(t, 0.05, 900, 600, 'sine', 0.07);
          break;
        case 'portal':
          tone(t, 1.3, 180, 820, 'sine', 0.14); tone(t + 0.12, 1.2, 270, 1250, 'triangle', 0.07);
          break;
        case 'alert':
          tone(t, 0.14, 660, 660, 'square', 0.07); tone(t + 0.18, 0.16, 880, 880, 'square', 0.07);
          break;
        case 'pickup':
          tone(t, 0.12, 900, 1500, 'sine', 0.12); tone(t + 0.08, 0.16, 1300, 2100, 'sine', 0.09);
          break;
        case 'reload':
          noise(t, 0.05, 3000, 3, 0.3); noise(t + 0.16, 0.06, 2400, 3, 0.35);
          break;
        case 'death':
          tone(t, 0.55, 230, 60, 'sawtooth', 0.1);
          break;
        case 'build':
          noise(t, 0.1, 800, 2, 0.4); noise(t + 0.18, 0.1, 700, 2, 0.4); noise(t + 0.36, 0.1, 900, 2, 0.4);
          break;
        case 'step':
          tone(t, 0.25, 120, 90, 'triangle', 0.08);
          break;
        default:
          break;
      }
    } catch (e) { /* ignore */ }
  };

  DW.SFX = S;
})(window.DW);
