'use strict';
/* Процедурная музыка и звуки окружения (WebAudio, без внешних файлов).
   Музыка: лейтмотив в ре миноре, своё настроение у меню, карты, базы, боя и роликов.
   Окружение: ветер, дождь, пыльная буря, пещера, бункер, ночной вой мутантов. */
(function (DW) {
  const M = {};
  const SFX = DW.SFX;
  let ctx = null, musBus = null, ambBus = null, musPre = null, lite = false;
  let brown = null;
  let want = { mood: null, amb: null };
  let mood = null, layer = null, bar = 0, nextBar = 0, inten = 0, intenT = 0, timer = null;
  let amb = null, ambLayer = null, ambNodes = [];
  const VOL_MUS = 0.15, VOL_AMB = 0.24;

  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- Инициализация (вызывается из DW.SFX при первом касании) ---------- */
  M._init = function () {
    ctx = SFX.ctx();
    if (!ctx) return;
    lite = DW.gfxLevel() === 0;
    const out = SFX.out();
    musBus = ctx.createGain(); musBus.gain.value = 0; musBus.connect(out);
    ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(out);
    musPre = ctx.createGain(); musPre.connect(musBus);
    /* «пространство»: задержка с затухающим повтором и мягким фильтром */
    const send = ctx.createGain(); send.gain.value = 0.3;
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
    musPre.connect(send); send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musBus);
    /* бурый шум для ветра (3 с, без заметного повтора) */
    const len = Math.floor(ctx.sampleRate * 3);
    brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = brown.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
    /* сглаживаем шов петли */
    const F = 2000;
    for (let i = 0; i < F; i++) { const k = i / F; d[len - F + i] = d[len - F + i] * (1 - k) + d[i] * k; }
    if (!timer) timer = setInterval(tick, 200);
    M.refresh();
    apply();
  };

  function ready() { return ctx && ctx.state === 'running' && !SFX.isPaused(); }

  M.refresh = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    musBus.gain.cancelScheduledValues(t); musBus.gain.setValueAtTime(musBus.gain.value, t);
    musBus.gain.linearRampToValueAtTime(DW.settings.music !== false ? VOL_MUS : 0, t + 0.6);
    ambBus.gain.cancelScheduledValues(t); ambBus.gain.setValueAtTime(ambBus.gain.value, t);
    ambBus.gain.linearRampToValueAtTime(DW.settings.sound ? VOL_AMB : 0, t + 0.6);
  };

  /* Настроение музыки и фон окружения */
  M.set = function (m, a) {
    want.mood = m === undefined ? want.mood : m;
    want.amb = a === undefined ? want.amb : a;
    apply();
  };
  M.mood = function () { return mood; };
  M.ambience = function () { return amb; };
  /* Напряжение боя 0..1: при контакте музыка разгоняется */
  M.intensity = function (v) { intenT = Math.max(0, Math.min(1, v)); };

  function apply() {
    if (!ctx) return;
    if (want.mood !== mood) switchMood(want.mood);
    if (want.amb !== amb) switchAmb(want.amb);
  }

  function fadeOut(node, dur) {
    const t = ctx.currentTime;
    node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(0.0001, t + dur);
    setTimeout(function () { try { node.disconnect(); } catch (e) { /* ignore */ } }, dur * 1000 + 3500);
  }
  function fadeIn(dest, dur) {
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + dur);
    g.connect(dest);
    return g;
  }

  function switchMood(m) {
    if (layer) fadeOut(layer, 2.4);
    layer = null; mood = m;
    if (!m || !MOODS[m]) return;
    layer = fadeIn(musPre, 1.8);
    bar = 0; nextBar = ctx.currentTime + 0.15;
    if (m !== 'battle') { inten = 0; intenT = 0; }
  }

  /* ---------- Инструменты ---------- */
  function pad(dest, t, dur, notes, cut, vol) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(cut * 0.55, t); f.frequency.linearRampToValueAtTime(cut, t + dur * 0.5); f.frequency.linearRampToValueAtTime(cut * 0.65, t + dur + 1.5);
    const g = ctx.createGain();
    const at = Math.min(1.8, dur * 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + at);
    g.gain.setValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
    f.connect(g); g.connect(dest);
    const dets = lite ? [0] : [-8, 7];
    notes.forEach(function (n) {
      dets.forEach(function (dt) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt;
        o.connect(f); o.start(t); o.stop(t + dur + 1.7);
      });
    });
  }
  function pluck(dest, t, n, vol, dec, bright) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(n) * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(bright || 3200, t); f.frequency.exponentialRampToValueAtTime(600, t + dec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(t + dec + 0.05); o2.stop(t + dec + 0.05);
  }
  function bell(dest, t, n, vol, dec) {
    dec = dec || 3.2;
    [[1, 1, dec], [2.76, 0.28, dec * 0.45], [5.4, 0.1, dec * 0.25]].forEach(function (p) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(n) * p[0];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * p[1], t + 0.004); g.gain.exponentialRampToValueAtTime(0.0004, t + p[2]);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + p[2] + 0.05);
    });
  }
  function bass(dest, t, n, dur, vol) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n);
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = mtof(n) / 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
    o.connect(g); s.connect(g); g.connect(dest);
    o.start(t); s.start(t); o.stop(t + dur + 0.3); s.stop(t + dur + 0.3);
  }
  function pulse(dest, t, n, dur, vol, cut) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(cut * 2.2, t); f.frequency.exponentialRampToValueAtTime(cut * 0.6, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(dest, t, vol) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.45);
  }
  function noiseTo(dest, t, dur, freq, q, vol, type, buf) {
    const src = ctx.createBufferSource(); src.buffer = buf || SFX.noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.05);
  }
  function snare(dest, t, vol) {
    noiseTo(dest, t, 0.17, 1900, 0.7, vol);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.15);
  }
  function hat(dest, t, vol) { noiseTo(dest, t, 0.045, 7500, 0.8, vol, 'highpass'); }
  function tom(dest, t, n, vol) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(mtof(n), t); o.frequency.exponentialRampToValueAtTime(mtof(n) * 0.6, t + 0.3);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.4);
  }

  /* ---------- Гармония и лейтмотив (ре минор) ---------- */
  const CH = {
    Dm: [50, 57, 62, 65], Bb: [46, 58, 62, 65], Gm: [43, 55, 58, 62], A: [45, 57, 61, 64],
    F: [41, 57, 60, 65], C: [48, 55, 60, 64], D: [50, 57, 62, 66], G: [43, 55, 59, 62]
  };
  /* Тема «Мёртвый мир»: 8 тактов, [нота, начало в долях, длительность] */
  const THEME = [
    [[69, 0, 1.5], [67, 1.5, 0.5], [65, 2, 1], [64, 3, 1]], [[62, 0, 3]],
    [[65, 0, 1], [67, 1, 0.5], [69, 1.5, 0.5], [70, 2, 2]], [[69, 0, 2], [65, 2, 2]],
    [[67, 0, 1.5], [65, 1.5, 0.5], [62, 2, 1], [58, 3, 1]], [[62, 0, 3]],
    [[64, 0, 1], [61, 1, 1], [64, 2, 1], [69, 3, 1]], [[69, 0, 2], [67, 2, 1], [64, 3, 1]]
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 1];

  const MOODS = {
    menu: { bpm: 60, per: 2, prog: ['Dm', 'Bb', 'Gm', 'A'], fn: function (T, b, B, c, first) {
      if (first) { pad(layer, T, B * 8, CH[c].slice(1), 900, 0.045); bass(layer, T, CH[c][0] - 12, B * 7.5, 0.16); }
      const cyc = Math.floor(b / 8) % 2;
      THEME[b % 8].forEach(function (nt) {
        if (cyc === 0) pluck(layer, T + nt[1] * B, nt[0], 0.13, 1.6 + nt[2] * B);
        else bell(layer, T + nt[1] * B, nt[0] + 12, 0.05, 2.4 + nt[2]);
      });
    } },
    world: { bpm: 64, per: 2, prog: ['Dm', 'C', 'Bb', 'A'], fn: function (T, b, B, c, first) {
      if (first) { pad(layer, T, B * 8, CH[c].slice(1), 700, 0.038); bass(layer, T, CH[c][0] - 12, B * 7.5, 0.14); }
      const ch = CH[c];
      for (let i = 0; i < 8; i += (b % 4 === 3 ? 2 : 1)) {
        if (i % 2 === 1 && Math.random() < 0.45) continue;
        pluck(layer, T + i * B / 2, ch[ARP[i] % 4] + 12, 0.07, 1.4, 2400);
      }
      if (b % 8 === 4 && Math.random() < 0.7) THEME[Math.random() < 0.5 ? 0 : 4].forEach(function (nt) { bell(layer, T + nt[1] * B, nt[0] + 12, 0.035, 2.8); });
    } },
    base: { bpm: 76, per: 1, prog: ['F', 'C', 'Dm', 'Bb'], fn: function (T, b, B, c) {
      const ch = CH[c];
      if (b % 2 === 0) pad(layer, T, B * 4, ch.slice(1), 800, 0.03);
      bass(layer, T, ch[0] - 12, B * 1.8, 0.14); bass(layer, T + B * 2, ch[0] - 12 + (b % 2 ? 7 : 0), B * 1.8, 0.11);
      for (let i = 0; i < 8; i++) pluck(layer, T + i * B / 2 + (i % 2 ? 0.02 : 0), ch[ARP[i]] + 12, i === 0 ? 0.1 : 0.065, 1.1, 2800);
      if (b % 16 >= 8 && b % 8 < 6) THEME[b % 8].forEach(function (nt) { bell(layer, T + nt[1] * B, nt[0] + 12, 0.03, 2.2); });
    } },
    battle: { bpm: 104, per: 1, prog: ['Dm', 'Dm', 'Bb', 'A'], fn: function (T, b, B, c) {
      const ch = CH[c], hi = inten >= 0.55, breath = b % 16 >= 14;
      const cut = 380 + inten * 900;
      if (b % 2 === 0) pad(layer, T, B * 8, [ch[0], ch[1]], 420 + inten * 300, 0.035);
      if (breath) { if (b % 16 === 15) [50, 47, 43, 38].forEach(function (n, i) { tom(layer, T + (2 + i * 0.5) * B, n, 0.3); }); return; }
      for (let i = 0; i < 8; i++) {
        if (!hi && i % 2 === 1) continue;
        const acc = i === 0 || i === 3 || i === 6;
        pulse(layer, T + i * B / 2, ch[0] - 12 + (i === 7 && hi ? 12 : 0), B * 0.45, (acc ? 0.2 : 0.13) * (0.6 + inten * 0.4), cut);
      }
      kick(layer, T, 0.5);
      if (hi) {
        kick(layer, T + B * 1.5, 0.35); kick(layer, T + B * 2, 0.45);
        snare(layer, T + B, 0.22); snare(layer, T + B * 3, 0.22);
        for (let i = 0; i < 8; i++) hat(layer, T + i * B / 2, i % 2 ? 0.05 : 0.08);
        if (!lite) for (let i = 0; i < 16; i++) if (i % 4 !== 3) pluck(layer, T + i * B / 4, ch[(i * 3) % 4] + 24, 0.03, 0.35, 4200);
        if (b % 8 === 7) THEME[0].forEach(function (nt) { pluck(layer, T + nt[1] * B, nt[0], 0.09, 0.8, 3000); });
      } else if (b % 4 === 2) kick(layer, T + B * 2, 0.3);
    } },
    cine: { bpm: 52, per: 2, prog: ['Dm', 'Gm', 'Bb', 'A'], fn: function (T, b, B, c, first) {
      if (first) { pad(layer, T, B * 8, CH[c], 650, 0.06); bass(layer, T, CH[c][0] - 12, B * 7.5, 0.12); }
      THEME[b % 8].forEach(function (nt, i) { if (i === 0 || nt[2] >= 2) bell(layer, T + nt[1] * B, nt[0], 0.1, 3.6); });
    } },
    /* заставка: стук сердца в пустоте, затем тема на колоколе и щипке, нарастание к названию (такт 3) */
    intro: { bpm: 54, per: 1, prog: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'], fn: function (T, b, B, c) {
      const ch = CH[c];
      pad(layer, T, B * 4, b < 1 ? [ch[0], ch[0] + 7] : ch, b < 2 ? 420 : 750, b < 3 ? 0.05 : 0.065);
      bass(layer, T, ch[0] - 12, B * 3.8, b < 3 ? 0.13 : 0.16);
      if (b < 3) for (let i = 0; i < 4; i += 2) { kick(layer, T + i * B, 0.32); kick(layer, T + i * B + B * 0.28, 0.2); }
      if (b === 1) THEME[0].forEach(function (nt) { bell(layer, T + nt[1] * B, nt[0], 0.06, 3); });
      if (b === 2) {
        THEME[2].forEach(function (nt) { pluck(layer, T + nt[1] * B, nt[0], 0.12, 1.4 + nt[2] * B); });
        [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.125, 3.25, 3.375, 3.5, 3.625, 3.75, 3.875].forEach(function (x, i) { tom(layer, T + x * B, 38 + (i % 3) * 3, 0.1 + i * 0.016); });
      }
      if (b === 3) {
        // название: удар и колокольный аккорд
        kick(layer, T, 0.8); tom(layer, T, 33, 0.55); noiseTo(layer, T, 2.5, 300, 0.6, 0.25, 'lowpass');
        [62, 65, 69, 74].forEach(function (n, i) { bell(layer, T + i * 0.05, n, 0.1, 4.5); });
        THEME[0].forEach(function (nt) { pluck(layer, T + B + nt[1] * B * 0.75, nt[0], 0.1, 1.6); });
      }
      if (b >= 4) THEME[(b - 4) % 8].forEach(function (nt) { bell(layer, T + nt[1] * B, nt[0] + 12, 0.04, 2.6); });
    } },
    win: { bpm: 66, per: 2, prog: ['D', 'G', 'D', 'A'], fn: function (T, b, B, c, first) {
      if (first) { pad(layer, T, B * 8, CH[c].slice(1), 1100, 0.04); bass(layer, T, CH[c][0] - 12, B * 7.5, 0.14); }
      for (let i = 0; i < 8; i++) pluck(layer, T + i * B / 2, CH[c][ARP[i]] + 12, 0.07, 1.3, 3000);
    } }
  };

  function scheduleBar(T) {
    const md = MOODS[mood];
    const B = 60 / md.bpm;
    inten += (intenT - inten) * 0.5;
    if (Math.abs(intenT - inten) < 0.03) inten = intenT;
    const ci = Math.floor(bar / md.per) % md.prog.length;
    try { md.fn(T, bar, B, md.prog[ci], bar % md.per === 0); } catch (e) { /* ignore */ }
    return B * 4;
  }

  /* ---------- Окружение ---------- */
  function loopSrc(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(ctx.currentTime, Math.random() * 2); ambNodes.push(s); return s; }
  function lfo(freq, depth, target) {
    const o = ctx.createOscillator(); o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(target); o.start(); ambNodes.push(o);
  }
  function wind(dest, lvl, freq, speed) {
    const s = loopSrc(brown);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = lvl;
    s.connect(f); f.connect(g); g.connect(dest);
    lfo(0.05 * speed, freq * 0.45, f.frequency);
    lfo(0.083 * speed, lvl * 0.45, g.gain);
    /* низкий гул под ветром */
    const s2 = loopSrc(brown);
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 160;
    const g2 = ctx.createGain(); g2.gain.value = lvl * 0.5;
    s2.connect(f2); f2.connect(g2); g2.connect(dest);
  }
  function hum(dest, f0, lvl) {
    [1, 2, 3].forEach(function (k, i) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f0 * k;
      const g = ctx.createGain(); g.gain.value = lvl / (1 + i * 1.6);
      o.connect(g); g.connect(dest); o.start(); ambNodes.push(o);
    });
  }
  const AMBS = {
    wind: function (d) { wind(d, 0.55, 420, 1); },
    night: function (d) { wind(d, 0.38, 330, 0.8); },
    base: function (d) { wind(d, 0.32, 380, 0.9); },
    dust: function (d) {
      wind(d, 0.7, 650, 1.8);
      const s = loopSrc(SFX.noiseBuf());
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2600;
      const g = ctx.createGain(); g.gain.value = 0.05;
      s.connect(f); f.connect(g); g.connect(d); lfo(0.2, 0.03, g.gain);
    },
    rain: function (d) {
      wind(d, 0.3, 380, 1);
      const s = loopSrc(SFX.noiseBuf());
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.35;
      const g = ctx.createGain(); g.gain.value = 0.16;
      s.connect(f); f.connect(g); g.connect(d);
    },
    cave: function (d) {
      hum(d, 55, 0.05);
      const s = loopSrc(brown);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      const g = ctx.createGain(); g.gain.value = 0.4;
      s.connect(f); f.connect(g); g.connect(d);
    },
    interior: function (d) {
      hum(d, 50, 0.05);
      const s = loopSrc(brown);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.value = 0.3;
      s.connect(f); f.connect(g); g.connect(d); lfo(0.13, 0.08, g.gain);
    }
  };
  /* Редкие события окружения: [вероятность в секунду, функция] */
  const EVENTS = {
    night: [[0.035, howl]], wind: [[0.006, howl]], dust: [[0.01, gust]],
    rain: [[0.012, thunder]], cave: [[0.3, drip], [0.008, howl]], interior: [[0.04, creak], [0.15, drip]],
    base: [[0.05, hammer], [0.006, howl]]
  };
  function panned(dest) {
    if (!ctx.createStereoPanner) return dest;
    const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.8, 0.8); p.connect(dest);
    return p;
  }
  function howl(d, t) {
    const dd = panned(d);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = rnd(170, 260);
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.45, t + 0.9); o.frequency.linearRampToValueAtTime(f0 * 1.2, t + 2.2); o.frequency.linearRampToValueAtTime(f0 * 0.8, t + 3);
    const vib = ctx.createOscillator(); vib.frequency.value = rnd(4, 6);
    const vg = ctx.createGain(); vg.gain.value = f0 * 0.025; vib.connect(vg); vg.connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = f0 * 2.5; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.8); g.gain.linearRampToValueAtTime(0.035, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + 3.1);
    o.connect(f); f.connect(g); g.connect(dd);
    o.start(t); vib.start(t); o.stop(t + 3.2); vib.stop(t + 3.2);
  }
  function drip(d, t) {
    const dd = panned(d);
    const f0 = rnd(900, 1700);
    [0, 0.23, 0.46].forEach(function (dt, i) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, t + dt); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + dt + 0.09);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.11 / (1 + i * 2.5), t + dt); g.gain.exponentialRampToValueAtTime(0.0004, t + dt + 0.12);
      o.connect(g); g.connect(dd); o.start(t + dt); o.stop(t + dt + 0.14);
    });
  }
  function creak(d, t) {
    const dd = panned(d);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = rnd(45, 80);
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * rnd(1.2, 1.6), t + 0.7);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(500, 900); f.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f); f.connect(g); g.connect(dd); o.start(t); o.stop(t + 0.85);
  }
  function hammer(d, t) {
    const dd = panned(d);
    const n = 2 + Math.floor(Math.random() * 3), f0 = rnd(900, 1500);
    for (let i = 0; i < n; i++) noiseTo(dd, t + i * 0.42, 0.08, f0, 3, 0.07);
  }
  function thunder(d, t) {
    noiseTo(d, t, 3.5, 110, 0.7, 0.55, 'lowpass', brown);
    noiseTo(d, t + 0.1, 1.8, 300, 0.5, 0.2, 'lowpass', brown);
  }
  function gust(d, t) { noiseTo(panned(d), t, 2.4, 900, 0.6, 0.25, 'bandpass', brown); }

  function switchAmb(a) {
    if (ambLayer) {
      fadeOut(ambLayer, 1.8);
      const old = ambNodes; ambNodes = [];
      setTimeout(function () { old.forEach(function (n) { try { n.stop(); } catch (e) { /* ignore */ } }); }, 2200);
    }
    ambLayer = null; amb = a;
    if (!a || !AMBS[a]) return;
    ambLayer = fadeIn(ambBus, 2.2);
    try { AMBS[a](ambLayer); } catch (e) { /* ignore */ }
  }

  /* ---------- Планировщик ---------- */
  function tick() {
    if (!ready()) return;
    const now = ctx.currentTime;
    if (layer && mood && MOODS[mood]) {
      if (nextBar < now - 0.2) nextBar = now + 0.1;
      while (nextBar < now + 0.8) {
        const len = DW.settings.music !== false ? scheduleBar(nextBar) : 240 / MOODS[mood].bpm;
        nextBar += len; bar++;
      }
    }
    if (ambLayer && DW.settings.sound && EVENTS[amb]) {
      EVENTS[amb].forEach(function (ev) { if (Math.random() < ev[0] * 0.2) { try { ev[1](ambLayer, now + 0.05 + Math.random() * 0.2); } catch (e) { /* ignore */ } } });
    }
  }

  /* Короткие музыкальные акценты поверх темы */
  M.sting = function (kind) {
    if (!ready() || DW.settings.music === false) return;
    const t = ctx.currentTime + 0.03;
    try {
      if (kind === 'contact') {
        const g = ctx.createGain(); g.gain.value = 1; g.connect(musPre);
        pad(g, t, 0.9, [38, 44, 50], 700, 0.09); kick(g, t, 0.6); tom(g, t + 0.25, 38, 0.35);
      } else if (kind === 'victory') {
        [62, 66, 69, 74].forEach(function (n, i) { bell(musPre, t + i * 0.16, n, 0.09, 3); });
        pad(musPre, t + 0.5, 2.2, CH.D.slice(1), 1300, 0.05);
      } else if (kind === 'defeat') {
        [62, 60, 58, 57].forEach(function (n, i) { bass(musPre, t + i * 0.7, n - 24, 0.65, 0.13); });
        pad(musPre, t, 3, [50, 53, 57], 500, 0.05);
      }
    } catch (e) { /* ignore */ }
  };

  /* Подбор фона для боя по времени суток и погоде */
  M.ambFor = function (B) {
    if (!B) return 'wind';
    if (B.tod === 'interior') return 'interior';
    if (B.tod === 'cave') return 'cave';
    if (B.weather === 'rain') return 'rain';
    if (B.weather === 'dust') return 'dust';
    if (B.tod === 'night') return 'night';
    return 'wind';
  };
  /* для тестов: уровень на выходе */
  M._debug = function () { return { mood: mood, amb: amb, bar: bar, inten: inten, state: ctx ? ctx.state : 'none' }; };

  DW.Music = M;
})(window.DW);
