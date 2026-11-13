'use strict';
/* Синтезированные звуки (без внешних файлов) */
(function (DW) {
  const S = {};
  let ctx = null, master = null, noiseBuf = null, out = null;

  function init() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      /* общий выход через мягкий компрессор, чтобы взрывы не хрипели */
      out = ctx.createDynamicsCompressor();
      out.threshold.value = -12; out.knee.value = 10; out.ratio.value = 4; out.attack.value = 0.004; out.release.value = 0.25;
      out.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(out);
      const len = Math.floor(ctx.sampleRate * 1.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (DW.Music) DW.Music._init();
      return true;
    } catch (e) { ctx = null; return false; }
  }

  let paused = false;
  S.unlock = function () {
    paused = false;
    if (!init()) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
  };
  /* приложение свёрнуто — глушим звук целиком; при возврате — продолжаем */
  S.suspend = function () { paused = true; if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } };
  S.resume = function () { if (!ctx) return; paused = false; if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } } };
  S.ctx = function () { return ctx; };
  S.out = function () { return out; };
  S.noiseBuf = function () { return noiseBuf; };
  S.isPaused = function () { return paused; };

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

  /* ---------- Выстрел по слоям ----------
     щелчок (короткий высокий треск), корпус (полосовой шум), удар (низкий тон с падением), хвост (глухой гул),
     эхо (свёртка со сгенерированным откликом: на улице коротко, в помещении и пещере — гулко), хрип (перегруз),
     затвор (механика после выстрела). Параметры — DW.WT (правятся в «Мастерской оружия»). */
  let verb = null, verbIn = null, shaper = null, lastTink = 0;
  function reverb() {
    if (verb) return verbIn;
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2) * (t < 0.012 ? t / 0.012 : 1); }
    }
    verb = ctx.createConvolver(); verb.buffer = buf;
    verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    verbIn.connect(verb); verb.connect(lp); lp.connect(master);
    return verbIn;
  }
  function distCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }
  function nz(t, dur, type, freq, q, gain, dst, a) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (a || 0.002)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(dst);
    src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.05);
    return g;
  }
  function tn(t, dur, f0, f1, type, gain, dst) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  }
  /* один выстрел ствола id; o: { when (с от сейчас), far (0..1 — дальше тише и глуше), env ('out'|'in'), p (свои параметры) } */
  S.shot = function (id, o) {
    if (!DW.settings.sound || !ctx || ctx.state === 'suspended') return;
    o = o || {};
    const P = o.p || (DW.WT ? DW.WT.get(id).snd : null);
    if (!P) { S.play('rifle'); return; }
    try {
      const t = ctx.currentTime + 0.01 + (o.when || 0);
      const far = o.far || 0, ph = DW.WT ? DW.WT.phys() : { echoOut: 0.25, echoIn: 0.9 };
      const pt = P.pitch * (1 + (Math.random() - 0.5) * 2 * (P.jit || 0));
      const out = ctx.createGain(); out.gain.value = P.vol * (1 - far * 0.6);
      // перегруз — общий на выстрел
      let dst = out;
      if (P.dist > 0.02) {
        const ws = ctx.createWaveShaper(); ws.curve = distCurve(P.dist * 8); ws.oversample = 'none';
        ws.connect(out); dst = ws;
      }
      if (far > 0.05) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000 - far * 6500; lp.connect(dst); dst = lp; }
      out.connect(master);
      // эхо
      const env = o.env === 'in' ? ph.echoIn : ph.echoOut;
      if (P.echo > 0.01 && env > 0.01) { const sg = ctx.createGain(); sg.gain.value = P.echo * env * (0.6 + far * 0.8); out.connect(sg); sg.connect(reverb()); }
      if (P.crack > 0.01) nz(t, 0.018, 'highpass', 3200 * pt, 0.7, 0.9 * P.crack, dst, 0.0008);
      if (P.body > 0.01) nz(t, P.bodyD, 'bandpass', P.bodyF * pt, 0.9, 0.85 * P.body, dst, 0.0015);
      if (P.thump > 0.01) tn(t, P.thumpD, P.thumpF * 1.9 * pt, P.thumpF * 0.45 * pt, 'triangle', 0.55 * P.thump, dst);
      if (P.tail > 0.01) nz(t + 0.008, P.tailD, 'lowpass', 520 * pt, 0.6, 0.45 * P.tail, dst, 0.02);
      if (P.mech > 0.01 && P.mechD > 0) {
        const tm = t + P.mechD / 1000;
        nz(tm, 0.05, 'bandpass', 2600, 4, 0.35 * P.mech, out); tn(tm, 0.03, 900, 500, 'square', 0.05 * P.mech, out);
        nz(tm + 0.12, 0.06, 'bandpass', 2100, 4, 0.4 * P.mech, out); tn(tm + 0.12, 0.035, 700, 380, 'square', 0.06 * P.mech, out);
      }
    } catch (e) { /* ignore */ }
  };
  /* звон гильзы о землю (не чаще 12 раз в секунду) */
  S.tink = function (big) {
    if (!DW.settings.sound || !ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    if (now - lastTink < 0.08) return;
    lastTink = now;
    const k = DW.WT ? DW.WT.phys().tink : 0.5;
    if (k <= 0.01) return;
    const f = (big ? 2600 : 3800) * (0.85 + Math.random() * 0.3);
    tone(now + 0.005, 0.09, f, f * 0.97, 'sine', 0.035 * k); tone(now + 0.005, 0.05, f * 1.51, f * 1.48, 'sine', 0.02 * k);
  };
  /* перезарядка по устройству ствола: диск, магазин, короб, затвор, помпа */
  S.reload = function (kind) {
    if (!DW.settings.sound || !ctx || ctx.state === 'suspended') return;
    const t = ctx.currentTime + 0.01;
    const clk = function (dt, f, g) { noise(t + dt, 0.045, f, 4, g); tone(t + dt, 0.03, f / 3, f / 5, 'square', g * 0.15); };
    try {
      switch (kind) {
        case 'drum': clk(0, 1800, 0.3); clk(0.22, 1500, 0.35); noise(t + 0.3, 0.25, 2800, 6, 0.08); clk(0.6, 2000, 0.4); clk(0.8, 2600, 0.35); break;
        case 'box': clk(0, 1600, 0.35); noise(t + 0.15, 0.35, 3500, 3, 0.12); clk(0.55, 1400, 0.4); clk(0.8, 2400, 0.4); break;
        case 'bolt': clk(0, 2400, 0.35); noise(t + 0.06, 0.08, 3000, 3, 0.25); clk(0.18, 2000, 0.4); break;
        case 'pump': clk(0, 1700, 0.3); clk(0.25, 1700, 0.3); noise(t + 0.45, 0.07, 1400, 2, 0.4); clk(0.58, 1200, 0.5); break;
        default: clk(0, 1700, 0.35); clk(0.32, 1500, 0.4); clk(0.55, 2400, 0.4); noise(t + 0.6, 0.06, 3000, 3, 0.25); break;
      }
    } catch (e) { /* ignore */ }
  };

  S.play = function (name) {
    if (!DW.settings.sound || !ctx) return;
    if (ctx.state === 'suspended') return;
    const t = ctx.currentTime + 0.01;
    try {
      switch (name) {
        case 'rifle':
          for (let i = 0; i < 3; i++) { noise(t + i * 0.09, 0.13, 1300, 0.8, 0.55); tone(t + i * 0.09, 0.08, 170, 60, 'square', 0.1); }
          break;
        case 'smg':
          for (let i = 0; i < 7; i++) { noise(t + i * 0.046, 0.07, 1700, 0.9, 0.42); tone(t + i * 0.046, 0.045, 210, 80, 'square', 0.07); }
          break;
        case 'ak2':
          for (let i = 0; i < 3; i++) { noise(t + i * 0.08, 0.11, 1800, 0.9, 0.5); tone(t + i * 0.08, 0.06, 240, 70, 'square', 0.09); }
          break;
        case 'hsniper':
          noise(t, 0.8, 900, 0.4, 1); tone(t, 0.35, 140, 30, 'sawtooth', 0.28); noise(t + 0.05, 0.6, 300, 0.5, 0.5);
          break;
        case 'hlmg':
          for (let i = 0; i < 5; i++) { noise(t + i * 0.085, 0.16, 600, 0.6, 0.7); tone(t + i * 0.085, 0.1, 100, 35, 'square', 0.16); }
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
