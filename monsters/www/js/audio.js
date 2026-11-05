// =====================================================================
//  ЗВУК: каждый монстр — свой инструмент или голос, синтезированный на Web Audio.
//  Общий такт: 96 ударов в минуту, песня из 16 тактов (256 шестнадцатых, ~40 с) по кругу:
//  куплет на «канонической» последовательности C–G/B–Am–Em/G–F–C/E–Dm/F–G7 (бас спускается ступенями)
//  и припев F–G–Em–Am–Dm–G–C–G7 с подъёмом мелодии. Все партии в одной гармонии — любые монстры звучат вместе.
// =====================================================================
const Sound = (() => {
  const BPM = 96, STEP = 60 / BPM / 4, STEPS = 256;
  let ctx = null, master, bus, revIn, dlyIn, noise = null, timer = 0, nextStep = 0, nextTime = 0, startT = 0, on = true, sfxOn = true;
  const voices = new Map(); // id монстра → { part, ch, send, notes: [] }

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    graph();
  }
  // общая цепочка: компрессор, мастер, зал, эхо (строится и для живого звука, и для записи песни в файл)
  function graph() {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ctx.destination);
    // мастер: убрать гул ниже 50 Гц, чуть «воздуха» сверху
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 45;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 7000; air.gain.value = 2.5;
    comp.connect(hp); hp.connect(air); air.connect(master);
    bus = ctx.createGain(); bus.gain.value = 0.6; bus.connect(comp);
    // хвост зала: свёртка с затухающим шумом
    const rev = ctx.createConvolver(); rev.buffer = impulse(2.3, 2.8);
    revIn = ctx.createGain(); revIn.gain.value = 1; revIn.connect(rev);
    const revOut = ctx.createGain(); revOut.gain.value = 0.35; rev.connect(revOut); revOut.connect(comp);
    // эхо на пунктирную восьмую: мягкое, с затуханием высоких
    const dl = ctx.createDelay(1.5); dl.delayTime.value = STEP * 3; const fb = ctx.createGain(); fb.gain.value = 0.33; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    dlyIn = ctx.createGain(); dlyIn.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); const dlOut = ctx.createGain(); dlOut.gain.value = 0.5; dlp.connect(dlOut); dlOut.connect(comp);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // запись песни целиком без динамика (OfflineAudioContext) — для проверки громкости и для превью
  async function renderMix(list, sec) {
    const saved = [ctx, master, bus, revIn, dlyIn, noise];
    ctx = new OfflineAudioContext(2, Math.ceil(44100 * sec), 44100); graph();
    for (const [part, pan] of list) {
      const ch = ctx.createGain(); ch.gain.value = (VOL[part] || 1) / Math.sqrt(list.filter(l => l[0] === part).length);
      const pn = ctx.createStereoPanner(); pn.pan.value = pan; ch.connect(pn); pn.connect(bus);
      const rs = ctx.createGain(); rs.gain.value = REV[part] || 0.25; ch.connect(rs); rs.connect(revIn);
      if (DLY[part]) { const d = ctx.createGain(); d.gain.value = DLY[part]; ch.connect(d); d.connect(dlyIn); }
      for (let st = 0; st < STEPS; st++) { const t = 0.05 + st * STEP; if (t > sec - 2) break; const evs = PARTS[part][st]; if (evs) for (const e of evs) INSTR[part](ch, t, e[0], e[1] * STEP, e[2], e[3]); }
    }
    const buf = await ctx.startRendering();
    [ctx, master, bus, revIn, dlyIn, noise] = saved;
    return buf;
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
          const dur = e[1] * STEP, vel = e[2] * (0.92 + Math.random() * 0.16); // живая игра: сила чуть гуляет
          INSTR[v.part](v.ch, nextTime, e[0], dur, vel, e[3]);
          v.notes.push({ t: nextTime, end: nextTime + Math.max(dur, 0.12), vel, m: e[0] });
          if (v.notes.length > 24) v.notes.shift();
        }
      }
      nextStep = (nextStep + 1) % STEPS; nextTime += STEP;
    }
  }
  // голос монстра на острове: свой канал громкости, место в стерео (по месту на острове), отправки в зал и эхо
  function add(id, part, pan = 0) {
    init(); if (voices.has(id)) return;
    const ch = ctx.createGain(); ch.gain.value = 0.0001;
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pn) { pn.pan.value = pan; ch.connect(pn); pn.connect(bus); } else ch.connect(bus);
    const s = ctx.createGain(); s.gain.value = REV[part] || 0.25; ch.connect(s); s.connect(revIn);
    if (DLY[part]) { const d = ctx.createGain(); d.gain.value = DLY[part]; ch.connect(d); d.connect(dlyIn); }
    ch.gain.setTargetAtTime(1, ctx.currentTime, 0.15);
    voices.set(id, { part, ch, pn, notes: [], level: 1, muted: false });
    balance();
  }
  function setPan(id, pan) { const v = voices.get(id); if (v && v.pn) v.pn.pan.setTargetAtTime(pan, ctx.currentTime, 0.2); }
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
  const REV = { pad: 0.45, opera: 0.4, lead: 0.35, whistle: 0.35, flute: 0.3, glock: 0.35, kick: 0.08, bass: 0.06, snare: 0.2, shaker: 0.12 };
  const DLY = { flute: 0.2, whistle: 0.24, glock: 0.3, lead: 0.12, marimba: 0.1, pluck: 0.1, opera: 0.1, frog: 0.08 };
  const VOL = { kick: 0.95, marimba: 0.9, flute: 0.85, shaker: 0.7, bass: 0.85, pad: 0.75, tom: 0.8, glock: 0.7, frog: 0.85, pluck: 0.8, brass: 0.7, lead: 0.75, whistle: 0.8, snare: 0.75, opera: 0.85 };

  // ---------- партитура: шаг 0…255, нота MIDI, длина в шагах, сила, дополнительно
  // такт: bass — нота баса (с обращением), root — основной тон аккорда, voc — 4 голоса аккорда, pad — 3 голоса хора
  const BARS = [
    // куплет
    { bass: 48, root: 48, voc: [60, 64, 67, 72], pad: [55, 60, 64] },   // C
    { bass: 47, root: 43, voc: [59, 62, 67, 71], pad: [55, 59, 62] },   // G/B
    { bass: 45, root: 45, voc: [57, 60, 64, 69], pad: [57, 60, 64] },   // Am
    { bass: 43, root: 40, voc: [55, 59, 64, 67], pad: [55, 59, 64] },   // Em/G
    { bass: 41, root: 41, voc: [57, 60, 65, 69], pad: [57, 60, 65] },   // F
    { bass: 40, root: 48, voc: [55, 60, 64, 67], pad: [55, 60, 64] },   // C/E
    { bass: 41, root: 38, voc: [57, 62, 65, 69], pad: [57, 62, 65] },   // Dm/F
    { bass: 43, root: 43, voc: [55, 59, 62, 65], pad: [55, 59, 65] },   // G7
    // припев
    { bass: 41, root: 41, voc: [57, 60, 65, 69], pad: [57, 60, 65], chorus: 1 }, // F
    { bass: 43, root: 43, voc: [55, 59, 62, 67], pad: [55, 59, 62], chorus: 1 }, // G
    { bass: 40, root: 40, voc: [55, 59, 64, 67], pad: [55, 59, 64], chorus: 1 }, // Em
    { bass: 45, root: 45, voc: [57, 60, 64, 69], pad: [57, 60, 64], chorus: 1 }, // Am
    { bass: 50, root: 38, voc: [57, 62, 65, 69], pad: [57, 62, 65], chorus: 1 }, // Dm
    { bass: 43, root: 43, voc: [55, 59, 62, 67], pad: [55, 59, 62], chorus: 1 }, // G
    { bass: 48, root: 48, voc: [55, 60, 64, 67], pad: [55, 60, 64], chorus: 1 }, // C
    { bass: 43, root: 43, voc: [55, 59, 62, 65], pad: [55, 59, 65], chorus: 1 }, // G7
  ];
  // главная мелодия (флейта): [шаг в такте, нота, длина] по тактам
  const MEL = [
    [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 79, 4]],
    [[0, 74, 6], [6, 72, 2], [8, 71, 4], [12, 74, 4]],
    [[0, 72, 6], [6, 71, 2], [8, 69, 4], [12, 76, 4]],
    [[0, 71, 6], [6, 72, 2], [8, 71, 4], [12, 67, 4]],
    [[0, 69, 4], [4, 72, 4], [8, 77, 6], [14, 76, 2]],
    [[0, 79, 4], [4, 76, 4], [8, 72, 6], [14, 74, 2]],
    [[0, 77, 4], [4, 76, 2], [6, 74, 2], [8, 81, 6], [14, 77, 2]],
    [[0, 74, 6], [6, 72, 2], [8, 71, 4], [12, 74, 4]],
    [[0, 72, 2], [2, 77, 2], [4, 81, 6], [10, 79, 2], [12, 77, 4]],
    [[0, 74, 2], [2, 79, 2], [4, 83, 6], [10, 81, 2], [12, 79, 4]],
    [[0, 71, 2], [2, 76, 2], [4, 79, 6], [10, 81, 2], [12, 79, 4]],
    [[0, 76, 2], [2, 81, 2], [4, 84, 8], [12, 83, 2], [14, 81, 2]],
    [[0, 81, 4], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 77, 4]],
    [[0, 79, 4], [4, 77, 2], [6, 76, 2], [8, 74, 6], [14, 71, 2]],
    [[0, 72, 4], [4, 76, 4], [8, 79, 4], [12, 84, 4]],
    [[0, 83, 6], [6, 81, 2], [8, 79, 4], [12, 77, 2], [14, 74, 2]],
  ];
  // верхний подголосок свиста: по ноте на такт (в куплете — нисходящая «каноническая» линия)
  const DESCANT = [88, 86, 84, 83, 81, 79, 81, 83, 81, 79, 79, 76, 77, 79, 79, 77];
  const third = m => { const pc = ((m % 12) + 12) % 12; return m - ({ 0: 3, 2: 3, 4: 4, 5: 3, 7: 3, 9: 4, 11: 4 }[pc] || 3); };
  const fifthNear = (b, r) => { const pc = (r + 7) % 12; let v = b + 1; while (v % 12 !== pc) v++; return v; };
  const PARTS = {};
  const put = (name, step, ...ev) => { (PARTS[name] = PARTS[name] || [])[step] = (PARTS[name][step] || []).concat([ev]); };
  BARS.forEach((B, b) => {
    const o = b * 16, ch = !!B.chorus, last = b % 8 === 7, R = B.root;
    // Бумбо: бочка; в припеве плотнее, «бум» голосом на нечётных тактах
    put('kick', o, 0, 1, 1); put('kick', o + 8, 0, 1, 0.9);
    if (ch) put('kick', o + 6, 0, 1, 0.55);
    if (b % 4 === 3) put('kick', o + 10, 0, 1, 0.6);
    if (last) put('kick', o + 14, 0, 1, 0.7);
    if (b % 2 === 0) put('kick', o, (R % 12) + 48, 3, 0.85, 'v');
    // Буля: маримба — арпеджио восьмыми, в припеве с ответом наверху
    (ch ? [0, 2, 1, 3, 2, 3, 1, 2] : [0, 1, 2, 3, 2, 1, 2, 1]).forEach((k, i) => put('marimba', o + i * 2, B.voc[k], 2, i % 2 ? 0.6 : 0.9));
    // Шурша: шуршалка шестнадцатыми и хлопки на 2 и 4
    for (let q = 0; q < 16; q++) put('shaker', o + q, 0, 1, q % 4 === 2 ? 0.75 : q % 2 ? 0.45 : 0.3);
    put('shaker', o + 4, 0, 1, 0.9, 'clap'); put('shaker', o + 12, 0, 1, 0.9, 'clap'); if (last) put('shaker', o + 15, 0, 1, 0.6, 'clap');
    // Глубун: бас ступенями вниз, квинта аккорда, октава
    const f5 = fifthNear(B.bass, R);
    [[0, B.bass, 6], [6, B.bass, 2], [8, f5, 4], [12, B.bass + 12, 2], [14, f5, 2]].forEach(([q, m, l], i) => put('bass', o + q, m, l, i ? 0.72 : 1));
    // Гудун: хор держит аккорд весь такт
    B.pad.forEach(m => put('pad', o, m, 15, ch ? 0.9 : 0.75));
    // Тумтум: бонги; в конце каждой половины — сбивка томами
    [3, 7, 11].forEach(q => put('tom', o + q, 67, 1, 0.5)); put('tom', o + 6, 60, 1, 0.55);
    if (last || b % 8 === 3) [[12, 57], [13, 53], [14, 50], [15, 45]].forEach(([q, m], i) => put('tom', o + q, m, 1, 0.55 + i * 0.12)); else put('tom', o + 14, 60, 1, 0.55);
    // Пузырик: колокольчики-пузыри; в припеве — россыпь
    put('glock', o, B.voc[3] + 12, 4, 0.8); put('glock', o + 10, B.voc[1] + 12, 2, 0.5);
    if (ch) { put('glock', o + 6, B.voc[2] + 12, 2, 0.45); put('glock', o + 14, B.voc[3] + 12, 2, 0.4); }
    if (last) [0, 1, 2, 3].forEach(i => put('glock', o + 12 + i, B.voc[i] + 24, 1, 0.45));
    // Квакуша: «ква-ква» в конце такта, в паузах мелодии
    put('frog', o + 12, B.voc[2] - 12 + (B.voc[2] < 62 ? 12 : 0), 2, 0.85); put('frog', o + 14, B.voc[1] - 12 + (B.voc[1] < 60 ? 12 : 0), 2, 0.7);
    // Бренчик: щипки на слабые доли, в припеве ещё и шестнадцатые
    [2, 6, 10, 14].forEach(q => put('pluck', o + q, B.voc[0], 1, q === 2 ? 0.9 : 0.7, B.voc.slice(0, 3)));
    if (ch) [3, 11].forEach(q => put('pluck', o + q, B.voc[0], 1, 0.45, B.voc.slice(0, 3)));
    // Громофон: медь — в куплете на конце фраз, в припеве «па-пам» каждый такт, перед повтором — фанфара
    if (ch || b % 4 === 3) { put('brass', o, B.voc[0], 2, ch ? 0.9 : 0.7, B.voc.slice(0, 3)); put('brass', o + 3, B.voc[0], 2, ch ? 0.75 : 0.6, B.voc.slice(0, 3)); }
    if (b === 15) [[8, 0], [10, 1], [12, 2], [14, 3]].forEach(([q, k]) => put('brass', o + q, B.voc[k], 2, 0.6 + k * 0.1, [B.voc[k], B.voc[k] + 7 - (k > 1 ? 12 : 0)]));
    // Свистун: долгая нота подголоска
    put('whistle', o, DESCANT[b], 14, 0.8);
    // Барабас: малый на 2 и 4, лёгкие призвуки, дробь перед повтором
    put('snare', o + 4, 0, 1, 0.9); put('snare', o + 12, 0, 1, 0.95);
    if (last) [12, 13, 14, 15].forEach((q, i) => put('snare', o + q, 0, 1, 0.35 + i * 0.18)); else [7, 10, 15].forEach(q => put('snare', o + q, 0, 1, ch ? 0.32 : 0.22));
    // мелодия и её голоса
    MEL[b].forEach(([q, m, l], i) => {
      put('flute', o + q, m, l, l >= 6 ? 0.95 : i % 2 ? 0.78 : 0.88);
      put('lead', o + q, third(m), l, 0.8, ['a', 'o', 'a', 'e', 'o'][i % 5]);
      put('opera', o + q, m - 12, l, 0.85, ['a', 'o', 'a', 'e', 'o'][(i + b) % 5]);
    });
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
    for (let st = 0; st < 32; st++) { const evs = PARTS[part][st]; if (evs) for (const e of evs) INSTR[part](ch, t0 + st * STEP, e[0], e[1] * STEP, e[2], e[3]); }
    setTimeout(() => ch.disconnect(), (32 * STEP + 2.5) * 1000);
  }

  return { init, start, add, remove, mute, setPan, renderMix, SONG_SEC: STEPS * STEP, PARTS_LIST: () => Object.keys(PARTS), singing, onsets, now, beat, setOn, setSfx, sfx, preview, suspend, resume, get on() { return on; }, get sfxOn() { return sfxOn; }, get ready() { return !!ctx; } };
})();
