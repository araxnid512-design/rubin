'use strict';
/* Общие утилиты: математика, случайность, рисование, звук */
(function () {
  const U = window.U = {};
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.sstep = (a, b, x) => { x = U.clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  U.rng = function (a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  function h1(i) { let n = Math.imul(i | 0, 374761393); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  U.noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) + (h1(i + 1) - h1(i)) * u; };
  U.pick = (arr, r) => arr[(r() * arr.length) | 0];

  U.canvas = function (w, h, s) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * s)); c.height = Math.max(1, Math.ceil(h * s));
    const x = c.getContext('2d'); x.scale(s, s); return [c, x];
  };
  U.rr = function (x, X, Y, W, H, r) {
    r = Math.min(r, W / 2, H / 2);
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r);
    x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
  };
  U.lg = function (x, x0, y0, x1, y1, cols) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); return g;
  };
  U.radial = function (n, stops, sy) {
    const [c, x] = U.canvas(n, n * (sy || 1), 1), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    x.scale(1, sy || 1); x.fillStyle = g; x.fillRect(0, 0, n, n); return c;
  };
  U.mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  U.rgb = (c, a) => a === undefined ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

  /* ---------- Звук: всё синтезируется, без файлов ---------- */
  let ac = null, nb = null, master = null, hum = null, wind = null;
  U.soundOn = true;
  U.audioInit = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.85; master.connect(ac.destination);
      nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const loop = (type, f, q) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nb; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return g; };
      hum = loop('lowpass', 140, 1); wind = loop('bandpass', 420, 0.6);
      const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = 55; og.gain.value = 0.25; o.connect(og); og.connect(hum); o.start();
    } catch (e) { ac = null; }
  };
  U.ambience = function (h, w) {
    if (!ac || ac.state !== 'running') return;
    const k = U.soundOn ? 1 : 0, t = ac.currentTime;
    hum.gain.setTargetAtTime(h * 0.05 * k, t, 0.4); wind.gain.setTargetAtTime(w * 0.06 * k, t, 0.4);
  };
  function tone(f, f2, dur, type, vol, delay) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dur, vol, fc, q, delay) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nb; f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const SFX = {
    swing() { burst(0.14, 0.22, 1400, 0.5); },
    hit() { burst(0.12, 0.6, 380); tone(140, 60, 0.1, 'square', 0.08); },
    crit() { burst(0.18, 0.7, 300); tone(220, 50, 0.18, 'sawtooth', 0.12); },
    metal() { burst(0.08, 0.5, 3000, 2); tone(1400, 900, 0.12, 'triangle', 0.06); },
    hurt() { tone(200, 70, 0.25, 'sawtooth', 0.13); burst(0.1, 0.3, 500); },
    growl() { tone(90 + Math.random() * 30, 55, 0.5, 'sawtooth', 0.07); burst(0.4, 0.12, 260, 3); },
    step() { burst(0.04, 0.09, 260 + Math.random() * 80); },
    roll() { burst(0.25, 0.25, 600, 0.6); },
    search() { burst(0.06, 0.12, 1800 + Math.random() * 800, 1.5); },
    loot() { tone(620, 980, 0.08, 'sine', 0.12); tone(880, 1300, 0.1, 'sine', 0.09, 0.07); },
    build() { burst(0.12, 0.5, 700); tone(180, 150, 0.12, 'square', 0.07, 0.05); burst(0.1, 0.4, 900, 1, 0.16); },
    ui() { tone(720, 780, 0.04, 'sine', 0.06); },
    deny() { tone(190, 140, 0.13, 'square', 0.06); },
    good() { tone(523, 523, 0.1, 'triangle', 0.11); tone(659, 659, 0.1, 'triangle', 0.11, 0.09); tone(784, 784, 0.22, 'triangle', 0.11, 0.18); },
    alarm() { for (let i = 0; i < 3; i++) { tone(660, 520, 0.22, 'square', 0.07, i * 0.3); } },
    door() { burst(0.2, 0.7, 160, 1); tone(70, 40, 0.3, 'sine', 0.2); },
    ladder() { tone(900 + Math.random() * 200, 700, 0.04, 'triangle', 0.04); }
  };
  U.sfx = function (n) { if (ac && U.soundOn && ac.state === 'running') { try { SFX[n](); } catch (e) { } } };
})();
