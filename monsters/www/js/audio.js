// =====================================================================
//  ЗВУК: каждый монстр — свой инструмент или голос, синтезированный на Web Audio.
//  Общий такт: 100 ударов в минуту, песня из 4 тактов (64 шестнадцатых) по кругу.
//  Гармония C – Am – F – G, поэтому любые монстры звучат вместе.
// =====================================================================
const Sound = (() => {
  const BPM = 100, STEP = 60 / BPM / 4, STEPS = 64;
  let ctx = null, master, bus, revIn, noise = null, timer = 0, nextStep = 0, nextTime = 0, startT = 0, on = true, sfxOn = true;
  const voices = new Map(); // id монстра → { part, ch, send, notes: [] }

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ctx.destination);
    comp.connect(master);
    bus = ctx.createGain(); bus.gain.value = 0.7; bus.connect(comp);
    // хвост зала: свёртка с затухающим шумом
    const rev = ctx.createConvolver(); rev.buffer = impulse(2.3, 2.8);
    revIn = ctx.createGain(); revIn.gain.value = 1; revIn.connect(rev);
    const revOut = ctx.createGain(); revOut.gain.value = 0.35; rev.connect(revOut); revOut.connect(comp);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function start() {
    init(); if (ctx.state === 'suspended') ctx.resume();
    if (timer) return;
    nextTime = startT = ctx.currentTime + 0.12; nextStep = 0;
    timer = setInterval(tick, 25);
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.16) {
      for (const v of voices.values()) {
        const evs = PARTS[v.part][nextStep]; if (!evs) continue;
        for (const e of evs) {
          const dur = e[1] * STEP, vel = e[2];
          INSTR[v.part](v.ch, nextTime, e[0], dur, vel, e[3]);
          v.notes.push({ t: nextTime, end: nextTime + Math.max(dur, 0.12), vel, m: e[0] });
          if (v.notes.length > 24) v.notes.shift();
        }
      }
      nextStep = (nextStep + 1) % STEPS; nextTime += STEP;
    }
  }
  // голос монстра на острове: свой канал громкости и отправка в зал
  function add(id, part, send = 0.25) {
    init(); if (voices.has(id)) return;
    const ch = ctx.createGain(); ch.gain.value = 0.0001; ch.connect(bus);
    const s = ctx.createGain(); s.gain.value = send; ch.connect(s); s.connect(revIn);
    ch.gain.setTargetAtTime(1, ctx.currentTime, 0.15);
    voices.set(id, { part, ch, notes: [], level: 1, muted: false });
    balance();
  }
  function remove(id) {
    const v = voices.get(id); if (!v) return; voices.delete(id);
    v.ch.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => v.ch.disconnect(), 400);
    balance();
  }
  function mute(id, m) { const v = voices.get(id); if (!v) return; v.muted = m; balance(); }
  // одинаковые монстры поют одну партию: делим громкость, чтобы дубли не перегружали песню
  function balance() {
    const cnt = {}; for (const v of voices.values()) if (!v.muted) cnt[v.part] = (cnt[v.part] || 0) + 1;
    for (const v of voices.values()) {
      const g = v.muted ? 0 : (VOL[v.part] || 1) / Math.sqrt(cnt[v.part]);
      v.ch.gain.setTargetAtTime(g, ctx.currentTime, 0.08);
    }
  }
  // насколько монстр «поёт» прямо сейчас (0…1) — для рта и подпрыгиваний
  function singing(id) {
    const v = voices.get(id); if (!v || v.muted || !ctx) return 0;
    const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0); let s = 0;
    for (const n of v.notes) {
      if (now < n.t || now > n.end + 0.1) continue;
      const k = now > n.end ? 1 - (now - n.end) / 0.1 : Math.min(1, (now - n.t) / 0.03);
      s = Math.max(s, k * (0.45 + 0.55 * n.vel));
    }
    return s;
  }
  // новая нота за последние мгновения — повод выпустить ноту-частицу
  function onsets(id, since) {
    const v = voices.get(id); if (!v || v.muted || !ctx) return 0;
    const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0); let c = 0;
    for (const n of v.notes) if (n.t > since && n.t <= now) c++;
    return c;
  }
  const now = () => (ctx ? ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) : 0);
  const beat = () => (ctx && timer ? (now() - startT) / (STEP * 4) : 0); // номер доли с дробной частью
  function setOn(v) { on = v; if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.05); }
  function setSfx(v) { sfxOn = v; }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // ---------- строительные блоки
  const osc = (type, f, t) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    if (hold > 0) g.gain.setValueAtTime(Math.max(peak, 0.0002), t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    return t + a + hold + rel + 0.05;
  }
  function noiseSrc(t, dur) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }
  const filt = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function vib(o, t, rate, cents, delay) {
    const l = osc('sine', rate, t), g = gain(0); l.connect(g); g.connect(o.detune);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(cents, t + delay + 0.15); l.start(t); return l;
  }
  // гласные: форманты (Гц) — по ним голос звучит как «а», «о», «у»
  const VOWELS = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2700], e: [400, 1700, 2600], i: [300, 2200, 3000] };
  // поющий голос: пила через три полосовых фильтра-форманты, вибрато, мягкая атака
  function voice(out, t, f, dur, vel, o = {}) {
    const vw = VOWELS[o.vowel || 'a'], sh = o.shift || 1.12, end = t + dur;
    const src = osc('sawtooth', o.glide ? f * o.glide : f, t); if (o.glide) src.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const s2 = osc('sawtooth', f * 1.003, t);
    const l = vib(src, t, o.vibRate || 5.5, o.vib === undefined ? 22 : o.vib, Math.min(0.25, dur * 0.4)); const l2 = vib(s2, t, (o.vibRate || 5.5) * 1.02, o.vib === undefined ? 22 : o.vib, Math.min(0.25, dur * 0.4));
    const mix = gain(0.5); src.connect(mix); s2.connect(mix);
    const g = gain(); const fg = [1, 0.55, 0.2];
    vw.forEach((F, i) => { const b = filt('bandpass', F * sh, (F * sh) / (60 + i * 40)); const bg = gain(fg[i] * 2.4); mix.connect(b); b.connect(bg); bg.connect(g); });
    g.connect(out);
    const stop = env(g, t, o.att || 0.04, 0.55 * vel, Math.max(0, dur - (o.att || 0.04) - 0.05), o.rel || 0.12);
    [src, s2].forEach(x => { x.start(t); x.stop(stop); }); l.stop(stop); l2.stop(stop);
    // согласная в начале слога: «б», «к», «п» — короткий шумовой щелчок
    if (o.cons) { const n = noiseSrc(t - 0.005, 0.05), b = filt('bandpass', o.cons === 'k' ? 2600 : 900, 1.2), cg = gain(); n.connect(b); b.connect(cg); cg.connect(out); env(cg, t - 0.005, 0.003, 0.25 * vel, 0.01, 0.025); }
  }

  // ---------- инструменты монстров
  const INSTR = {
    // Бумбо: бочка животом и низкое «бум»
    kick(out, t, m, dur, vel, x) {
      if (x === 'v') { voice(out, t, hz(m), 0.32, vel * 0.8, { vowel: 'u', shift: 1, vib: 8, cons: 'b', att: 0.02 }); return; }
      const o = osc('sine', 150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      const g = gain(); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.003, 1.1 * vel, 0.02, 0.32));
      const c = osc('triangle', 900, t); c.frequency.exponentialRampToValueAtTime(120, t + 0.02); const cg = gain(); c.connect(cg); cg.connect(out); c.start(t); c.stop(env(cg, t, 0.001, 0.25 * vel, 0, 0.02));
    },
    // Буля: маримба — тёплая деревянная «капля»
    marimba(out, t, m, dur, vel) {
      const f = hz(m), g = gain(), o = osc('sine', f, t), o2 = osc('sine', f * 4, t), g2 = gain();
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      env(g2, t, 0.002, 0.18, 0, 0.12);
      o.start(t); o2.start(t); const e = env(g, t, 0.003, 0.5 * vel, 0, 0.55); o.stop(e); o2.stop(e);
    },
    // Фьюти: флейта с дыханием и вибрато — главная мелодия
    flute(out, t, m, dur, vel) {
      const f = hz(m), o = osc('triangle', f, t), o2 = osc('sine', f * 2, t), g = gain(), g2 = gain(0.12);
      const l = vib(o, t, 5.2, 14, 0.12); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      const e = env(g, t, 0.045, 0.42 * vel, Math.max(0, dur - 0.1), 0.1); o.start(t); o2.start(t); o.stop(e); o2.stop(e); l.stop(e);
      const n = noiseSrc(t, dur + 0.1), b = filt('bandpass', f * 2, 3), ng = gain(); n.connect(b); b.connect(ng); ng.connect(out); env(ng, t, 0.02, 0.05 * vel, Math.max(0, dur - 0.06), 0.08);
    },
    // Шурша: шуршалка и хлопки
    shaker(out, t, m, dur, vel, x) {
      if (x === 'clap') {
        const n = noiseSrc(t, 0.3), b = filt('bandpass', 1400, 0.9), g = gain(); n.connect(b); b.connect(g); g.connect(out);
        g.gain.setValueAtTime(0.0001, t);
        for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(0.7 * vel, t + i * 0.011); g.gain.exponentialRampToValueAtTime(0.05, t + i * 0.011 + 0.009); }
        g.gain.setValueAtTime(0.5 * vel, t + 0.034); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); return;
      }
      const n = noiseSrc(t, 0.1), b = filt('highpass', 6500, 0.7), g = gain(); n.connect(b); b.connect(g); g.connect(out); env(g, t, 0.006, 0.3 * vel, 0.01, 0.045);
    },
    // Глубун: басовая линия — пила через фильтр и чистый суб
    bass(out, t, m, dur, vel) {
      const f = hz(m), o = osc('sawtooth', f, t), s = osc('sine', f, t), lp = filt('lowpass', 1400, 4), g = gain(), sg = gain(0.9);
      lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.25);
      o.connect(lp); lp.connect(g); s.connect(sg); sg.connect(g); g.connect(out);
      const e = env(g, t, 0.006, 0.55 * vel, Math.max(0, dur - 0.06), 0.08); o.start(t); s.start(t); o.stop(e); s.stop(e);
    },
    // Гудун: хор «у-о», долгие аккорды
    pad(out, t, m, dur, vel) { voice(out, t, hz(m), dur, vel * 0.45, { vowel: 'o', shift: 1, vib: 10, vibRate: 4.6, att: 0.35, rel: 0.45 }); },
    // Тумтум: бонги и томы
    tom(out, t, m, dur, vel) {
      const f = hz(m), o = osc('sine', f * 1.7, t), g = gain(); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.002, 0.75 * vel, 0, f > 250 ? 0.16 : 0.32));
      const n = noiseSrc(t, 0.03), b = filt('bandpass', 3000, 1), ng = gain(); n.connect(b); b.connect(ng); ng.connect(out); env(ng, t, 0.001, 0.12 * vel, 0, 0.02);
    },
    // Пузырик: колокольчики-пузыри
    glock(out, t, m, dur, vel) {
      const f = hz(m), g = gain(); g.connect(out);
      [[1, 0.5, 1.4], [2.76, 0.18, 0.5], [5.4, 0.08, 0.25]].forEach(([k, a, d]) => { const o = osc('sine', f * k, t), og = gain(); o.connect(og); og.connect(g); o.start(t); o.stop(env(og, t, 0.002, a * vel, 0, d)); });
      g.gain.value = 0.7;
    },
    // Квакуша: «ква-ква» — слоги голосом
    frog(out, t, m, dur, vel) { voice(out, t, hz(m), dur, vel * 0.9, { vowel: 'a', shift: 1.25, vib: 30, cons: 'k', glide: 0.85, att: 0.025, rel: 0.08 }); },
    // Бренчик: щипковые аккорды «на слабую долю»
    pluck(out, t, m, dur, vel, x) {
      (x || [m]).forEach((mm, i) => {
        const tt = t + i * 0.014, f = hz(mm), o = osc('sawtooth', f, tt), lp = filt('lowpass', 3200, 2), g = gain();
        lp.frequency.setValueAtTime(3600, tt); lp.frequency.exponentialRampToValueAtTime(380, tt + 0.22);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(tt); o.stop(env(g, tt, 0.002, 0.2 * vel, 0, 0.32));
      });
    },
    // Громофон: медные «па-пам»
    brass(out, t, m, dur, vel, x) {
      (x || [m]).forEach(mm => {
        const f = hz(mm), g = gain(), lp = filt('lowpass', 600, 1.5);
        lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.04); lp.frequency.exponentialRampToValueAtTime(1100, t + 0.2);
        [0, 7].forEach(dt => { const o = osc('sawtooth', f, t); o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + dur + 0.2); });
        lp.connect(g); g.connect(out); env(g, t, 0.025, 0.16 * vel, Math.max(0, dur - 0.08), 0.1);
      });
    },
    // Певунья: второй голос под мелодией
    lead(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.75, { vowel: x || 'a', shift: 1.18, vib: 26, att: 0.05, rel: 0.12, cons: x === 'o' ? 'b' : null }); },
    // Свистун: чистый свист долгими нотами
    whistle(out, t, m, dur, vel) {
      const f = hz(m), o = osc('sine', f * 0.95, t), g = gain(); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const l = vib(o, t, 6, 18, 0.2); o.connect(g); g.connect(out); o.start(t); const e = env(g, t, 0.05, 0.22 * vel, Math.max(0, dur - 0.12), 0.12); o.stop(e); l.stop(e);
    },
    // Барабас: малый барабан
    snare(out, t, m, dur, vel) {
      const n = noiseSrc(t, 0.25), hp = filt('highpass', 1200, 0.7), g = gain(); n.connect(hp); hp.connect(g); g.connect(out); env(g, t, 0.002, 0.55 * vel, 0, 0.16);
      const o = osc('triangle', 210, t), og = gain(); o.frequency.exponentialRampToValueAtTime(150, t + 0.06); o.connect(og); og.connect(out); o.start(t); o.stop(env(og, t, 0.002, 0.45 * vel, 0, 0.08));
    },
    // Маэстро: оперный голос, мелодия октавой ниже
    opera(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel, { vowel: x || 'a', shift: 1.02, vib: 38, vibRate: 5.8, att: 0.06, rel: 0.2 }); },
  };
  const VOL = { kick: 0.95, marimba: 0.9, flute: 0.85, shaker: 0.7, bass: 0.85, pad: 0.75, tom: 0.8, glock: 0.7, frog: 0.85, pluck: 0.8, brass: 0.7, lead: 0.75, whistle: 0.8, snare: 0.75, opera: 0.85 };

  // ---------- партитура (шаг 0…63, нота MIDI, длина в шагах, сила, дополнительно)
  const BARS = [ // аккорды по тактам: корень и голоса
    { root: 36, voc: [60, 64, 67, 72], pad: [48, 52, 55], top: 84 },
    { root: 33, voc: [57, 60, 64, 69], pad: [45, 48, 52], top: 81 },
    { root: 41, voc: [57, 60, 65, 69], pad: [45, 48, 53], top: 81 },
    { root: 43, voc: [55, 59, 62, 67], pad: [43, 47, 50], top: 79 },
  ];
  const MELODY = [ // флейта: [шаг, нота, длина]
    [0, 67, 2], [2, 72, 2], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 76, 4],
    [16, 72, 2], [18, 76, 2], [20, 81, 6], [26, 79, 2], [28, 76, 4],
    [32, 77, 4], [36, 76, 2], [38, 74, 2], [40, 72, 4], [44, 69, 4],
    [48, 71, 2], [50, 72, 2], [52, 74, 4], [56, 79, 4], [60, 74, 4],
  ];
  const third = m => { const pc = ((m % 12) + 12) % 12; return m - ({ 0: 3, 2: 3, 4: 4, 5: 3, 7: 3, 9: 4, 11: 4 }[pc] || 3); };
  const PARTS = {};
  const put = (name, step, ...ev) => { (PARTS[name] = PARTS[name] || [])[step] = (PARTS[name][step] || []).concat([ev]); };
  for (let b = 0; b < 4; b++) {
    const B = BARS[b], o = b * 16;
    // бочка и «бум»
    put('kick', o, 0, 1, 1); put('kick', o + 8, 0, 1, 0.9); if (b === 3) put('kick', o + 14, 0, 1, 0.65);
    put('kick', o, B.root + 12, 3, 0.9, 'v');
    // маримба: арпеджио восьмыми
    [0, 1, 2, 3, 2, 1, 2, 1].forEach((k, i) => put('marimba', o + i * 2, B.voc[k], 2, i % 2 ? 0.6 : 0.9));
    // шуршалка шестнадцатыми, хлопки на 2 и 4
    for (let s = 0; s < 16; s++) put('shaker', o + s, 0, 1, s % 4 === 2 ? 0.75 : s % 2 ? 0.45 : 0.3);
    put('shaker', o + 4, 0, 1, 0.9, 'clap'); put('shaker', o + 12, 0, 1, 0.9, 'clap');
    // бас
    [[0, 0, 5], [6, 0, 2], [8, 7, 4], [12, 12, 2], [14, 7, 2]].forEach(([s, d, l]) => put('bass', o + s, B.root + d, l, s ? 0.75 : 1));
    // хор: аккорд на весь такт
    B.pad.forEach(m => put('pad', o, m, 15, 0.8));
    // бонги, в чётных тактах — сбивка томами
    [3, 7, 11].forEach(s => put('tom', o + s, 67, 1, 0.55)); [6].forEach(s => put('tom', o + s, 60, 1, 0.6));
    if (b % 2) [[12, 57], [13, 53], [14, 50], [15, 45]].forEach(([s, m], i) => put('tom', o + s, m, 1, 0.6 + i * 0.1));
    else put('tom', o + 14, 60, 1, 0.6);
    // колокольчики
    put('glock', o, B.top, 4, 0.8); put('glock', o + 10, B.voc[1] + 12, 2, 0.55); if (b === 3) put('glock', o + 14, 83, 2, 0.5);
    // «ква-ква» в конце каждого такта
    put('frog', o + 12, [67, 69, 69, 71][b], 2, 0.9); put('frog', o + 14, [64, 64, 65, 67][b], 2, 0.75);
    // щипки на слабые доли
    [2, 6, 10, 14].forEach(s => put('pluck', o + s, B.voc[0], 1, s === 2 ? 0.9 : 0.7, B.voc.slice(0, 3)));
    // медь: «па-пам» в начале такта
    put('brass', o, B.voc[0], 2, 0.9, B.voc.slice(0, 3)); put('brass', o + 3, B.voc[0], 2, 0.7, B.voc.slice(0, 3));
    if (b === 3) put('brass', o + 14, B.voc[1], 2, 0.6, B.voc.slice(1, 4));
    // свист: долгие ноты
    [[0, [79, 76, 77, 74][b]], [8, [76, 72, 72, 71][b]]].forEach(([s, m]) => put('whistle', o + s, m, 8, 0.8));
    // малый барабан
    put('snare', o + 4, 0, 1, 0.9); put('snare', o + 12, 0, 1, 0.95);
    if (b === 3) [12, 13, 14, 15].forEach((s, i) => put('snare', o + s, 0, 1, 0.35 + i * 0.18)); else [7, 10, 15].forEach(s => put('snare', o + s, 0, 1, 0.25));
  }
  MELODY.forEach(([s, m, l], i) => {
    put('flute', s, m, l, i % 3 === 2 ? 0.75 : 0.9);
    put('lead', s, third(m), l, 0.8, i % 2 ? 'o' : 'a');
    put('opera', s, m - 12, l, 0.85, ['a', 'o', 'a', 'e'][i % 4]);
  });

  // ---------- звуки интерфейса
  function sfx(kind) {
    if (!ctx || !sfxOn) return; const t = ctx.currentTime + 0.01, out = bus;
    if (kind === 'coin') { [1568, 2093].forEach((f, i) => { const o = osc('square', f, t + i * 0.07), g = gain(), lp = filt('lowpass', 4000); o.connect(lp); lp.connect(g); g.connect(out); o.start(t + i * 0.07); o.stop(env(g, t + i * 0.07, 0.002, 0.08, 0.03, 0.12)); }); }
    else if (kind === 'tap') { const o = osc('sine', 880, t), g = gain(); o.frequency.exponentialRampToValueAtTime(1320, t + 0.05); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.002, 0.12, 0, 0.07)); }
    else if (kind === 'pop') { const o = osc('sine', 300, t), g = gain(); o.frequency.exponentialRampToValueAtTime(900, t + 0.08); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.002, 0.25, 0, 0.1)); }
    else if (kind === 'eat') { for (let i = 0; i < 3; i++) { const o = osc('triangle', 220 + i * 40, t + i * 0.09), g = gain(); o.frequency.exponentialRampToValueAtTime(140, t + i * 0.09 + 0.06); o.connect(g); g.connect(out); o.start(t + i * 0.09); o.stop(env(g, t + i * 0.09, 0.003, 0.2, 0, 0.06)); } }
    else if (kind === 'level') { [523, 659, 784, 1047].forEach((f, i) => { const o = osc('triangle', f, t + i * 0.09), g = gain(); o.connect(g); g.connect(out); o.start(t + i * 0.09); o.stop(env(g, t + i * 0.09, 0.005, 0.18, 0.05, 0.25)); }); }
    else if (kind === 'hatch') { [784, 988, 1175, 1568, 1976].forEach((f, i) => { const o = osc('sine', f, t + i * 0.06), g = gain(); o.connect(g); g.connect(out); o.start(t + i * 0.06); o.stop(env(g, t + i * 0.06, 0.003, 0.16, 0.02, 0.4)); }); }
    else if (kind === 'deny') { const o = osc('square', 180, t), g = gain(), lp = filt('lowpass', 900); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.003, 0.1, 0.08, 0.06)); }
  }
  // короткая проба голоса монстра (в магазине и книге)
  function preview(part) {
    init(); if (ctx.state === 'suspended') ctx.resume();
    const ch = gain(VOL[part] || 1); ch.connect(bus); const s = gain(0.25); ch.connect(s); s.connect(revIn);
    const t0 = ctx.currentTime + 0.05;
    for (let st = 0; st < 16; st++) { const evs = PARTS[part][st]; if (evs) for (const e of evs) INSTR[part](ch, t0 + st * STEP, e[0], e[1] * STEP, e[2], e[3]); }
    setTimeout(() => ch.disconnect(), (16 * STEP + 2.5) * 1000);
  }

  return { init, start, add, remove, mute, singing, onsets, now, beat, setOn, setSfx, sfx, preview, suspend, resume, get on() { return on; }, get sfxOn() { return sfxOn; }, get ready() { return !!ctx; } };
})();
