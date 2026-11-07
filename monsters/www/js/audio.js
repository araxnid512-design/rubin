// =====================================================================
//  ЗВУК: каждый монстр — свой инструмент или голос, синтезированный на Web Audio.
//  Общий такт: 100 ударов в минуту, песня из 32 тактов (512 шестнадцатых, ~77 с) по кругу:
//  куплет C–G/B–Am–Em/G–F–C/E–Dm7–G7 → распевка Dm7–Em7–F–Gsus4/G (бас поднимается) →
//  припев C–G–Am–F–C–G–F/G–C → затишье Am–F–G–A7 → последний припев на тон выше (ре мажор) и разворот G7.
//  Все партии в одной гармонии — любые монстры звучат вместе.
// =====================================================================
const Sound = (() => {
  let BPM = 100, STEP = 60 / BPM / 4, STEPS = 512, SONG = 'green', dlyNode = null;
  const SONGS = {}; // песни островов: темп, шагов в такте, длина, откуда играть пробу
  let ctx = null, master, bus, revIn, dlyIn, noise = null, timer = 0, nextStep = 0, nextTime = 0, startT = 0, on = true, sfxOn = true;
  const voices = new Map(); // id монстра → { part, ch, send, notes: [] }

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    graph();
  }
  // общая цепочка: компрессор, мастер, зал, эхо (строится и для живого звука, и для записи песни в файл)
  const MASTER = 0.84; // запас до перегруза, когда поют все двадцать
  function graph() {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = on ? MASTER : 0; master.connect(ctx.destination);
    // мастер: убрать гул ниже 50 Гц, чуть «воздуха» сверху
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 45;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 7000; air.gain.value = 2.5;
    comp.connect(hp); hp.connect(air); air.connect(master);
    bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(comp);
    // хвост зала: свёртка с затухающим шумом
    const rev = ctx.createConvolver(); rev.buffer = impulse(2.3, 2.8);
    revIn = ctx.createGain(); revIn.gain.value = 1; revIn.connect(rev);
    const revOut = ctx.createGain(); revOut.gain.value = 0.35; rev.connect(revOut); revOut.connect(comp);
    // эхо на пунктирную восьмую: мягкое, с затуханием высоких
    const dl = ctx.createDelay(1.5); dl.delayTime.value = STEP * 3; dlyNode = dl; const fb = ctx.createGain(); fb.gain.value = 0.33; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    dlyIn = ctx.createGain(); dlyIn.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); const dlOut = ctx.createGain(); dlOut.gain.value = 0.5; dlp.connect(dlOut); dlOut.connect(comp);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // запись песни целиком без динамика (OfflineAudioContext) — для проверки громкости и для превью
  async function renderMix(list, sec, song) {
    const saved = [ctx, master, bus, revIn, dlyIn, noise, dlyNode, SONG]; if (song) useSong(song);
    ctx = new OfflineAudioContext(2, Math.ceil(44100 * sec), 44100); graph();
    for (const [part, pan] of list) {
      const ch = ctx.createGain(); ch.gain.value = (VOL[part] || 1) / Math.sqrt(list.filter(l => l[0] === part).length);
      const pn = ctx.createStereoPanner(); pn.pan.value = pan; ch.connect(pn); pn.connect(bus);
      const rs = ctx.createGain(); rs.gain.value = REV[part] || 0.25; ch.connect(rs); rs.connect(revIn);
      if (DLY[part]) { const d = ctx.createGain(); d.gain.value = DLY[part]; ch.connect(d); d.connect(dlyIn); }
      for (let st = 0; st < STEPS; st++) { const t = 0.05 + st * STEP; if (t > sec - 2) break; const evs = PARTS[part][st]; if (evs) for (const e of evs) play(part, ch, t, e, e[1] * STEP, e[2]); }
    }
    const buf = await ctx.startRendering();
    [ctx, master, bus, revIn, dlyIn, noise, dlyNode] = saved; useSong(saved[7]);
    return buf;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function useSong(id) { const S = SONGS[id]; SONG = id; BPM = S.bpm; STEP = 60 / BPM / 4; STEPS = S.steps; }
  // смена острова — смена песни: новая начинается с первого такта
  function setSong(id) {
    if (!SONGS[id] || id === SONG) return; useSong(id);
    if (dlyNode) dlyNode.delayTime.setValueAtTime(STEP * 3, ctx.currentTime);
    if (ctx && timer) { nextStep = 0; nextTime = startT = ctx.currentTime + 0.12; }
  }
  function start() {
    init(); if (ctx.state === 'suspended') ctx.resume();
    if (timer) return;
    nextTime = startT = ctx.currentTime + 0.12; nextStep = 0;
    timer = setInterval(tick, 25);
  }
  const TIGHT = new Set(['kick', 'snare', 'shaker', 'tom', 'bass', 'beatbox', 'rockkick', 'anvil', 'cowbell', 'fuzzbass', 'riff', 'oompah', 'woodblock', 'sleigh', 'claves', 'bongo', 'subbass', 'ukulele']);
  function tick() {
    while (nextTime < ctx.currentTime + 0.16) {
      for (const v of voices.values()) {
        const evs = PARTS[v.part][nextStep]; if (!evs) continue;
        for (const e of evs) {
          const dur = e[1] * STEP, vel = e[2] * (0.92 + Math.random() * 0.16); // живая игра: сила чуть гуляет
          const lag = TIGHT.has(v.part) ? 0 : Math.random() * 0.012; // певцы и мелодия чуть «дышат», ритм — точно в долю
          play(v.part, v.ch, nextTime + lag, e, dur, vel);
          v.notes.push({ t: nextTime, end: nextTime + Math.max(dur, 0.12), vel, m: e[0], v: vowelOf(v.part, e) });
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
  // гласная ноты — по ней монстр складывает рот: «а», «о», «у», «э», «и»
  function vowelOf(part, e) {
    const x = e[3];
    if (x === 'v') return VOX[part] ? VOX[part].vowel : 'a';
    switch (part) {
      case 'lead': case 'opera': case 'yodel': case 'rockvox': case 'icesoprano': return typeof x === 'string' ? x : part === 'rockvox' ? 'e' : 'a';
      case 'bassvox': case 'scat': case 'growl': case 'baritone': case 'calypsovox': case 'reggaevox': return Array.isArray(x) ? x[1] : 'o';
      case 'chant': return x === 'хо' ? 'o' : 'e';
      case 'pad': return 'o';
      case 'frog': case 'soprano': return 'a';
    }
    return null;
  }
  function vowel(id) {
    const v = voices.get(id); if (!v || v.muted || !ctx) return null;
    const t = now(); for (let i = v.notes.length - 1; i >= 0; i--) { const n = v.notes[i]; if (t >= n.t && t <= n.end + 0.05) return n.v; }
    return null;
  }
  const now = () => (ctx ? ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) : 0);
  const beat = () => (ctx && timer ? (now() - startT) / (STEP * 4) : 0); // номер доли с дробной частью
  function setOn(v) { on = v; if (master) master.gain.setTargetAtTime(v ? MASTER : 0, ctx.currentTime, 0.05); }
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
  // гласные: форманты (Гц) — по ним голос звучит как «а», «о», «у»…
  const VOWELS = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2700], e: [420, 1800, 2600], i: [300, 2200, 3000], y: [350, 1350, 2500] };
  // звонкие согласные — начальные форманты, из которых голос плавно переходит в гласную
  const CONS = { l: [380, 1100, 2600], m: [260, 950, 2300], n: [260, 1500, 2500], d: [320, 1650, 2600], b: [280, 850, 2300], v: [300, 1000, 2400], r: [420, 1300, 1800] };
  // взрывные — короткий шумовой щелчок перед гласной: [полоса, громкость]
  const BURST = { b: [500, 0.16], d: [1900, 0.2], t: [4200, 0.32], k: [2600, 0.3], p: [900, 0.22] };
  // шипящие и придыхание — шум перед слогом: [тип фильтра, частота, громкость]
  const FRIC = { s: ['highpass', 5200, 0.22], x: ['bandpass', 2600, 0.3], f: ['bandpass', 1500, 0.12], h: ['bandpass', 1400, 0.22] };
  // поющий голос: две пилы через три полосовых фильтра-форманты, вибрато, согласная в начале,
  // переход в другую гласную к концу ноты (o.to), шёпот и крик (o.breath)
  function voice(out, t, f, dur, vel, o = {}) {
    const v1 = VOWELS[o.vowel || 'a'], v2 = o.to ? VOWELS[o.to] : null, sh = o.shift || 1.12, c = o.cons, att = o.att || 0.04;
    const src = osc('sawtooth', o.glide ? f * o.glide : f, t), s2 = osc('sawtooth', (o.glide ? f * o.glide : f) * 1.003, t);
    if (o.glide) { src.frequency.exponentialRampToValueAtTime(f, t + 0.07); s2.frequency.exponentialRampToValueAtTime(f * 1.003, t + 0.07); }
    const vb = o.vib === undefined ? 22 : o.vib, vr = o.vibRate || 5.5, vd = Math.min(0.25, dur * 0.4);
    const l = vib(src, t, vr, vb, vd), l2 = vib(s2, t, vr * 1.02, vb, vd);
    const mix = gain(0.5); src.connect(mix); s2.connect(mix);
    const g = gain(), fg = [1, 0.55, 0.2], C = CONS[c];
    v1.forEach((F, i) => {
      const b = filt('bandpass', F * sh, (F * sh) / (60 + i * 40));
      if (C) { b.frequency.setValueAtTime(C[i] * sh, t); b.frequency.linearRampToValueAtTime(F * sh, t + 0.06); }
      if (v2) { b.frequency.setValueAtTime(F * sh, t + Math.max(0.07, dur * 0.35)); b.frequency.linearRampToValueAtTime(v2[i] * sh, t + Math.max(0.12, dur)); }
      const bg = gain(fg[i] * 2.4); mix.connect(b); b.connect(bg); bg.connect(g);
    });
    // шёпот/крик: шум, окрашенный теми же формантами
    if (o.breath) { const n = noiseSrc(t, dur + 0.2), ng = gain(o.breath); n.connect(ng); ng.connect(mix); }
    g.connect(out);
    const nasal = c === 'm' || c === 'n';
    const stop = env(g, t, nasal ? Math.max(att, 0.07) : att, 0.55 * vel, Math.max(0, dur - att - 0.05), o.rel || 0.12);
    [src, s2].forEach(x => { x.start(t); x.stop(stop); }); l.stop(stop); l2.stop(stop);
    if (BURST[c]) { const [bf, ba] = BURST[c], n = noiseSrc(t - 0.012, 0.06), bp = filt('bandpass', bf, 1.2), cg = gain(); n.connect(bp); bp.connect(cg); cg.connect(out); env(cg, t - 0.012, 0.002, ba * vel, 0.008, 0.03); }
    if (FRIC[c]) { const [ft, ff, fa] = FRIC[c], n = noiseSrc(t - 0.09, 0.14), fp = filt(ft, ff, ft === 'bandpass' ? 1.4 : 0.7), cg = gain(); n.connect(fp); fp.connect(cg); cg.connect(out); env(cg, t - 0.09, 0.03, fa * vel, 0.04, 0.03); }
  }
  // выкрики обычных монстров: свой слог у каждого
  const VOX = {
    kick: { cons: 'b', vowel: 'u', shift: 1, vib: 8, att: 0.02 },              // «бум»
    tom: { cons: 't', vowel: 'u', shift: 1.05, vib: 10 },                       // «тум»
    marimba: { cons: 'b', vowel: 'u', to: 'i', shift: 1.22, vib: 16 },         // «бу-уль»
    bass: { cons: 'm', vowel: 'o', to: 'u', shift: 0.95, vib: 12 },             // «о-ом»
    flute: { cons: 'f', vowel: 'u', to: 'i', shift: 1.28, vib: 20, breath: 0.08 }, // «фью»
    whistle: { cons: 'h', vowel: 'u', shift: 1.1, vib: 14, glide: 1.12 },       // «у-ху»
    shaker: { cons: 'x', vowel: 'u', shift: 1.2, vib: 0, breath: 0.35 },        // «шу» шёпотом
    pluck: { cons: 'l', vowel: 'a', shift: 1.15, vib: 20 },                     // «ля»
    snare: { cons: 't', vowel: 'a', shift: 1.1, vib: 0, att: 0.01 },            // «та»
    brass: { cons: 'p', vowel: 'a', shift: 1.05, vib: 10, att: 0.02 },          // «па»
  };

  // ---------- инструменты монстров
  const INSTR = {
    // Бумбо: бочка животом и низкое «бум»
    kick(out, t, m, dur, vel, x) {
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
    // Бубун: басом «дум-ду-дам» по басовой линии
    bassvox(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.85, { cons: x[0], vowel: x[1], shift: 0.95, vib: 10, att: 0.02, rel: 0.08 }); },
    // Тыц: битбокс — бочка губами «бм», хэт «тс», малый «пф», призвук «к»
    beatbox(out, t, m, dur, vel, x) {
      if (x === 'B') {
        const o = osc('sine', 130, t), g = gain(); o.frequency.exponentialRampToValueAtTime(48, t + 0.1); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.004, 0.95 * vel, 0.02, 0.2));
        const n = noiseSrc(t, 0.05), lp = filt('lowpass', 700, 1), ng = gain(); n.connect(lp); lp.connect(ng); ng.connect(out); env(ng, t, 0.002, 0.3 * vel, 0.005, 0.03); return;
      }
      if (x === 'ts') { const n = noiseSrc(t, 0.12), hp = filt('highpass', 6500, 0.8), bp = filt('bandpass', 9000, 1.5), g = gain(); n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out); env(g, t, 0.003, 0.4 * vel, dur > 0.2 ? 0.06 : 0.01, 0.05); return; }
      if (x === 'pf') { const n = noiseSrc(t, 0.25), bp = filt('bandpass', 1700, 0.9), g = gain(); n.connect(bp); bp.connect(g); g.connect(out); env(g, t, 0.002, 0.75 * vel, 0.02, 0.14);
        const o = osc('triangle', 190, t), og = gain(); o.frequency.exponentialRampToValueAtTime(120, t + 0.05); o.connect(og); og.connect(out); o.start(t); o.stop(env(og, t, 0.002, 0.25 * vel, 0, 0.06)); return; }
      const n = noiseSrc(t, 0.06), bp = filt('bandpass', 3200, 2), g = gain(); n.connect(bp); bp.connect(g); g.connect(out); env(g, t, 0.001, 0.35 * vel, 0, 0.03);
    },
    // Хейхо: выкрики «хей!» и «хо!»
    chant(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel, { cons: 'h', vowel: x === 'хо' ? 'o' : 'e', to: x === 'хо' ? 'u' : 'i', shift: 1.12, vib: 6, breath: 0.12, att: 0.015, rel: 0.1, glide: 0.94 }); },
    // Пузырик: сопрано «ла-а» и колокольчик на усике
    soprano(out, t, m, dur, vel, x) {
      voice(out, t, hz(m), dur, vel * 0.7, { cons: 'l', vowel: 'a', shift: 1.32, vib: 30, vibRate: 6, att: 0.06, rel: 0.25 });
      if (x) { const f = hz(m + 12), o = osc('sine', f, t), g = gain(); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.002, 0.12 * vel, 0, 0.9)); }
    },
    // Жар-птичка: йодль «о-ли-о-и» с прыжками через октаву
    yodel(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.8, { cons: x === 'i' ? 'l' : null, vowel: x, shift: 1.25, vib: 34, vibRate: 6.5, glide: x === 'i' ? 0.9 : 1.06, att: 0.02, rel: 0.08 }); },
    // Дубидуб: скэт «ду-би-ду-ба»
    scat(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.85, { cons: x[0], vowel: x[1], shift: 1.1, vib: 14, att: 0.015, rel: 0.07 }); },
    // Маэстро: оперный голос, мелодия октавой ниже
    opera(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel, { vowel: x || 'a', shift: 1.02, vib: 38, vibRate: 5.8, att: 0.06, rel: 0.2 }); },
  };
  const REV = { pad: 0.45, opera: 0.4, lead: 0.35, whistle: 0.35, flute: 0.3, glock: 0.35, kick: 0.08, bass: 0.06, snare: 0.2, shaker: 0.12, soprano: 0.5, yodel: 0.35, chant: 0.3, bassvox: 0.15, beatbox: 0.1, scat: 0.25 };
  const DLY = { flute: 0.2, whistle: 0.24, glock: 0.3, lead: 0.12, marimba: 0.1, pluck: 0.1, opera: 0.1, frog: 0.08, soprano: 0.22, yodel: 0.25, scat: 0.1, chant: 0.12 };
  // событие партии: 'v' — выкрик голосом (свой слог у каждого обычного монстра), иначе — инструмент
  function play(part, out, t, e, dur, vel) { if (e[3] === 'v') voice(out, t, hz(e[0]), dur, vel * 0.8, VOX[part]); else INSTR[part](out, t, e[0], dur, vel, e[3]); }
  const VOL = { kick: 0.95, marimba: 0.9, flute: 0.64, shaker: 0.7, bass: 0.48, pad: 0.95, tom: 1.0, frog: 1.7, pluck: 1.4, brass: 1.0, lead: 0.95, whistle: 0.8, snare: 1.05, opera: 0.85, bassvox: 0.8, beatbox: 0.75, chant: 1.4, soprano: 1.5, yodel: 1.0, scat: 0.75 };
  // ---------- инструменты монстров других островов
  // «перегруз» для рок-гитары и баса: мягкое ограничение волны
  let DRIVE = null;
  const drive = () => { if (!DRIVE) { DRIVE = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; DRIVE[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); } } const w = ctx.createWaveShaper(); w.curve = DRIVE; w.oversample = '2x'; return w; };
  // металлический удар: набор негармоничных призвуков
  function metal(out, t, f, parts, vel) { for (const [k, a, d] of parts) { const o = osc('sine', f * k, t), g = gain(); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.001, a * vel, 0, d)); } }
  Object.assign(INSTR, {
    // --- Вулкан
    // Уголёк: тяжёлая рок-бочка
    rockkick(out, t, m, dur, vel) {
      const o = osc('sine', 170, t), g = gain(); o.frequency.exponentialRampToValueAtTime(44, t + 0.11); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.002, 1.2 * vel, 0.04, 0.3));
      const n = noiseSrc(t, 0.03), b = filt('bandpass', 3500, 0.8), ng = gain(); n.connect(b); b.connect(ng); ng.connect(out); env(ng, t, 0.001, 0.35 * vel, 0, 0.02);
    },
    // Магмус: бас с перегрузом
    fuzzbass(out, t, m, dur, vel) {
      const f = hz(m), o = osc('sawtooth', f, t), s = osc('square', f / 2, t), sg = gain(0.35), d = drive(), lp = filt('lowpass', 900, 1.5), g = gain();
      lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
      o.connect(d); s.connect(sg); sg.connect(d); d.connect(lp); lp.connect(g); g.connect(out);
      const e = env(g, t, 0.004, 0.32 * vel, Math.max(0, dur - 0.05), 0.07); o.start(t); s.start(t); o.stop(e); s.stop(e);
    },
    // Искра: электрогитара — аккорды «пауэр», глухие восьмые и соло
    riff(out, t, m, dur, vel, x) {
      const notes = x || [m], muted = dur < 0.2 && x, d = drive(), lp = filt('lowpass', muted ? 1300 : 3400, 1.2), pk = filt('peaking', 1800, 1), g = gain();
      pk.gain.value = 5; d.connect(lp); lp.connect(pk); pk.connect(g); g.connect(out);
      const stop = env(g, t, 0.003, (x ? 0.16 : 0.2) * vel, muted ? 0.02 : Math.max(0, dur - 0.06), muted ? 0.07 : 0.16);
      notes.forEach((mm, i) => [0, 9].forEach(dt => { const o = osc('sawtooth', hz(mm), t + i * 0.006); o.detune.value = dt; if (!x) vib(o, t, 6, 18, 0.15).stop(stop); const og = gain(0.5); o.connect(og); og.connect(d); o.start(t + i * 0.006); o.stop(stop); }));
    },
    // Дымок: рок-орган с «вращающимся» дрожанием
    organ(out, t, m, dur, vel, x) {
      const g = gain(); g.connect(out); const stop = env(g, t, 0.012, 0.09 * vel, Math.max(0, dur - 0.05), 0.08);
      const l = osc('sine', 6.3, t), lg = gain(7); l.connect(lg); l.start(t); l.stop(stop);
      (x || [m]).forEach(mm => [[0.5, 0.5], [1, 1], [2, 0.6], [3, 0.3], [4, 0.25]].forEach(([k, a]) => { const o = osc('sine', hz(mm) * k, t), og = gain(a); lg.connect(o.detune); o.connect(og); og.connect(g); o.start(t); o.stop(stop); }));
    },
    // Перчик: коровий колокольчик и хэт
    cowbell(out, t, m, dur, vel, x) {
      if (x === 'hat' || x === 'open') { const n = noiseSrc(t, 0.3), hp = filt('highpass', 7500, 0.8), g = gain(); n.connect(hp); hp.connect(g); g.connect(out); env(g, t, 0.002, 0.28 * vel, x === 'open' ? 0.08 : 0.005, x === 'open' ? 0.12 : 0.035); return; }
      const bp = filt('bandpass', 820, 1.4), g = gain(); bp.connect(g); g.connect(out);
      const stop = env(g, t, 0.001, 0.5 * vel, 0.01, 0.22); [562, 845].forEach(f => { const o = osc('square', f, t); o.connect(bp); o.start(t); o.stop(stop); });
    },
    // Кремень: наковальня вместо малого барабана
    anvil(out, t, m, dur, vel, x) {
      metal(out, t, x === 'fill' ? 1150 : 920, [[1, 0.22, 0.5], [1.49, 0.14, 0.35], [2.31, 0.1, 0.25], [3.17, 0.06, 0.15]], vel);
      const n = noiseSrc(t, 0.2), bp = filt('bandpass', 2600, 0.8), g = gain(); n.connect(bp); bp.connect(g); g.connect(out); env(g, t, 0.001, 0.5 * vel, 0.01, 0.12);
    },
    // Дракоша: рок-вокал с хрипотцой
    rockvox(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.85, { vowel: x || 'e', shift: 1.14, vib: 30, vibRate: 5.6, breath: 0.07, att: 0.02, rel: 0.12, glide: 0.96 }); },
    // Вулканя: низкий рык «ро-ок», «хо!»
    growl(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.9, { cons: x[0], vowel: x[1], shift: 0.9, vib: 6, breath: 0.22, att: 0.02, rel: 0.12 }); },
    // --- Льдинка
    // Снежок: челеста — музыкальная шкатулка
    celesta(out, t, m, dur, vel) { metal(out, t, hz(m), [[1, 0.32, 1.3], [2, 0.08, 0.5], [4, 0.04, 0.18], [5.4, 0.015, 0.1]], vel); },
    // Сосулька: стеклянная гармоника — мягкий долгий звон с дрожанием
    glass(out, t, m, dur, vel) {
      const f = hz(m), g = gain(), tr = osc('sine', 5.2, t), tg = gain(0.25); tr.connect(tg); tg.connect(g.gain);
      g.connect(out); const stop = env(g, t, 0.18, 0.13 * vel, Math.max(0, dur - 0.3), 0.6);
      [[1, 1], [2, 0.18], [3.01, 0.05]].forEach(([k, a]) => { const o = osc('sine', f * k, t), og = gain(a); o.connect(og); og.connect(g); o.start(t); o.stop(stop); });
      tr.start(t); tr.stop(stop);
    },
    // Пингви: туба «умпа»
    oompah(out, t, m, dur, vel) {
      const f = hz(m), o = osc('sawtooth', f, t), s = osc('sine', f, t), lp = filt('lowpass', 400, 1.2), g = gain(), sg = gain(0.6);
      lp.frequency.setValueAtTime(350, t); lp.frequency.linearRampToValueAtTime(950, t + 0.05); lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
      o.connect(lp); lp.connect(g); s.connect(sg); sg.connect(g); g.connect(out);
      const e = env(g, t, 0.025, 0.5 * vel, Math.max(0, dur * 0.6 - 0.05), 0.12); o.start(t); s.start(t); o.stop(e); s.stop(e);
    },
    // Ёлочка: бубенцы
    sleigh(out, t, m, dur, vel, x) {
      const n = x === 'roll' ? 8 : 1;
      for (let i = 0; i < n; i++) {
        const tt = t + i * Math.min(0.09, dur / n), a = vel * (x === 'roll' ? 0.4 + i * 0.07 : 1);
        const ns = noiseSrc(tt, 0.2), bp = filt('bandpass', 7800, 2), g = gain(); ns.connect(bp); bp.connect(g); g.connect(out); env(g, tt, 0.002, 0.3 * a, 0.01, 0.12);
        metal(out, tt + 0.004, 2600, [[1, 0.05, 0.18], [1.43, 0.04, 0.14], [2.07, 0.03, 0.1]], a);
      }
    },
    // Морозик: скрипки — щипком (коротко) или смычком (долго)
    strings(out, t, m, dur, vel, x) {
      const notes = x || [m], pizz = dur < 0.3, lp = filt('lowpass', pizz ? 2200 : 1900, 0.8), g = gain(); lp.connect(g); g.connect(out);
      const stop = pizz ? env(g, t, 0.003, 0.18 * vel, 0, 0.28) : env(g, t, 0.16, 0.07 * vel, Math.max(0, dur - 0.25), 0.35);
      const l = osc('sine', 5.2, t), lg = gain(pizz ? 0 : 9); l.connect(lg); l.start(t); l.stop(stop);
      notes.forEach(mm => [-6, 6].forEach(dt => { const o = osc(pizz ? 'triangle' : 'sawtooth', hz(mm), t); o.detune.value = dt; lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(stop); }));
    },
    // Шишка: деревянная коробочка «цок»
    woodblock(out, t, m, dur, vel) {
      const f = hz(m) * 1.2, o = osc('sine', f * 1.4, t), g = gain(); o.frequency.exponentialRampToValueAtTime(f, t + 0.015); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.001, 0.45 * vel, 0, 0.06));
      const n = noiseSrc(t, 0.02), bp = filt('bandpass', 2400, 2), ng = gain(); n.connect(bp); bp.connect(ng); ng.connect(out); env(ng, t, 0.001, 0.15 * vel, 0, 0.01);
    },
    // Снежинка: высокое сопрано с хрустальным призвуком
    icesoprano(out, t, m, dur, vel, x) {
      voice(out, t, hz(m), dur, vel * 0.65, { cons: x === 'a' ? 'l' : null, vowel: x || 'a', shift: 1.36, vib: 30, vibRate: 6.2, att: 0.06, rel: 0.3 });
      const o = osc('sine', hz(m + 24), t), g = gain(); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.002, 0.04 * vel, 0, 0.5));
    },
    // Йетик: тёплый баритон
    baritone(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.8, { cons: x[0], vowel: x[1], shift: 0.98, vib: 18, vibRate: 5, att: 0.08, rel: 0.3 }); },
    // --- Лагуна
    // Крабик: клаве и щелчки клешнями
    claves(out, t, m, dur, vel, x) {
      const f = x === 'clack' ? 3300 : 2500, o = osc('sine', f, t), g = gain(); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.001, (x ? 0.25 : 0.4) * vel, 0, x ? 0.025 : 0.06));
    },
    // Медуза: стальной барабан
    steel(out, t, m, dur, vel) {
      const f = hz(m); metal(out, t, f, [[1, 0.3, 0.9], [2, 0.2, 0.55], [3, 0.08, 0.3], [4.2, 0.03, 0.14]], vel);
      const n = noiseSrc(t, 0.02), bp = filt('bandpass', f * 3, 2), ng = gain(); n.connect(bp); bp.connect(ng); ng.connect(out); env(ng, t, 0.001, 0.05 * vel, 0, 0.012);
    },
    // Кокос: бонги, шлепок ладонью
    bongo(out, t, m, dur, vel, x) {
      const f = hz(m), o = osc('sine', f * 1.5, t), g = gain(); o.frequency.exponentialRampToValueAtTime(f, t + 0.03); o.connect(g); g.connect(out); o.start(t); o.stop(env(g, t, 0.001, 0.6 * vel, 0, 0.14));
      if (x === 'slap') { const n = noiseSrc(t, 0.05), bp = filt('bandpass', 2200, 1.2), ng = gain(); n.connect(bp); bp.connect(ng); ng.connect(out); env(ng, t, 0.001, 0.35 * vel, 0, 0.04); }
    },
    // Китёнок: глубокий мягкий бас
    subbass(out, t, m, dur, vel) {
      const f = hz(m), o = osc('sine', f, t), o2 = osc('triangle', f * 2, t), g2 = gain(0.18), g = gain(); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      const e = env(g, t, 0.008, 0.6 * vel, Math.max(0, dur - 0.08), 0.1); o.start(t); o2.start(t); o.stop(e); o2.stop(e);
    },
    // Ракушка: укулеле — короткий бой
    ukulele(out, t, m, dur, vel, x) {
      (x || [m]).forEach((mm, i) => {
        const tt = t + i * 0.009, f = hz(mm + 12), o = osc('triangle', f, tt), o2 = osc('sawtooth', f, tt), g2 = gain(0.3), lp = filt('lowpass', 2600, 1), g = gain();
        lp.frequency.setValueAtTime(3000, tt); lp.frequency.exponentialRampToValueAtTime(700, tt + 0.12);
        o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out); const e = env(g, tt, 0.002, 0.13 * vel, 0, 0.17); o.start(tt); o2.start(tt); o.stop(e); o2.stop(e);
      });
    },
    // Попугайка: свирель с дыханием
    panflute(out, t, m, dur, vel) {
      const f = hz(m), o = osc('sine', f * 0.985, t), g = gain(); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); const l = vib(o, t, 5, 12, 0.12);
      o.connect(g); g.connect(out); const e = env(g, t, 0.05, 0.3 * vel, Math.max(0, dur - 0.1), 0.12); o.start(t); o.stop(e); l.stop(e);
      const n = noiseSrc(t, dur + 0.1), bp = filt('bandpass', f * 2, 4), ng = gain(); n.connect(bp); bp.connect(ng); ng.connect(out); env(ng, t, 0.02, 0.12 * vel, Math.max(0, dur - 0.08), 0.08);
    },
    // Дельфа: звонкий голос «ла-ла»
    calypsovox(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.85, { cons: x[0], vowel: x[1], shift: 1.2, vib: 24, vibRate: 5.8, att: 0.03, rel: 0.12 }); },
    // Панцирь: низкое «йо-о», «хей», «м-м»
    reggaevox(out, t, m, dur, vel, x) { voice(out, t, hz(m), dur, vel * 0.85, { cons: x[0], vowel: x[1], shift: 0.94, vib: 12, breath: 0.06, att: 0.03, rel: 0.15 }); },
  });
  Object.assign(REV, { rockkick: 0.06, fuzzbass: 0.04, riff: 0.12, organ: 0.25, cowbell: 0.12, anvil: 0.2, rockvox: 0.3, growl: 0.2,
    celesta: 0.45, glass: 0.55, oompah: 0.15, sleigh: 0.3, strings: 0.4, woodblock: 0.2, icesoprano: 0.55, baritone: 0.4,
    claves: 0.15, steel: 0.3, bongo: 0.12, subbass: 0.04, ukulele: 0.18, panflute: 0.35, calypsovox: 0.3, reggaevox: 0.25 });
  Object.assign(DLY, { riff: 0.12, rockvox: 0.14, celesta: 0.25, glass: 0.2, icesoprano: 0.2, steel: 0.18, panflute: 0.2, calypsovox: 0.12 });
  Object.assign(VOL, { rockkick: 0.95, fuzzbass: 0.8, riff: 0.9, organ: 0.9, cowbell: 0.75, anvil: 1.4, rockvox: 1.35, growl: 1.5,
    celesta: 1.25, glass: 0.7, oompah: 0.65, sleigh: 1.8, strings: 1.6, woodblock: 1.4, icesoprano: 1.7, baritone: 1.0,
    claves: 1.4, steel: 1.25, bongo: 0.9, subbass: 0.5, ukulele: 2.2, panflute: 0.9, calypsovox: 1.05, reggaevox: 1.0 });

  // ---------- партитура: 32 такта по 16 шестнадцатых, нота MIDI, длина в шагах, сила, дополнительно
  // Форма песни: куплет (8 тактов) → распевка с подъёмом (4) → припев (8) → затишье-проигрыш (4)
  // → последний припев на тон выше (8), а в самом конце — разворот G7, и песня по кругу снова в до мажоре.
  const FORM = [
    ['verse', 'C'], ['verse', 'G/B'], ['verse', 'Am'], ['verse', 'Em/G'], ['verse', 'F'], ['verse', 'C/E'], ['verse', 'Dm7'], ['verse', 'G7'],
    ['pre', 'Dm7'], ['pre', 'Em7'], ['pre', 'F'], ['pre', 'Gsus4', 'G'],
    ['chorus', 'C'], ['chorus', 'G'], ['chorus', 'Am'], ['chorus', 'F'], ['chorus', 'C'], ['chorus', 'G'], ['chorus', 'F', 'G'], ['chorus', 'C'],
    ['bridge', 'Am'], ['bridge', 'F'], ['bridge', 'G'], ['bridge', 'A7'],
    ['final', 'D'], ['final', 'A'], ['final', 'Bm'], ['final', 'G'], ['final', 'D'], ['final', 'A'], ['final', 'G', 'A'], ['final', 'D', 'G7'],
  ];
  // главная мелодия (Фьюти): [шаг в такте, нота, длина]. Куплет — «прыгучий» ритм 3+3+2, распевка — повторы с подъёмом,
  // припев — широкий запоминающийся мотив, затишье — плавная линия к хроматическому до-диезу.
  const MEL = [
    [[0, 76, 3], [3, 79, 3], [6, 76, 1], [7, 74, 1], [8, 72, 4], [12, 74, 2], [14, 76, 2]],
    [[0, 74, 3], [3, 79, 3], [6, 74, 1], [7, 72, 1], [8, 71, 6], [14, 67, 2]],
    [[0, 72, 3], [3, 76, 3], [6, 72, 1], [7, 71, 1], [8, 69, 4], [12, 71, 2], [14, 72, 2]],
    [[0, 71, 3], [3, 76, 3], [6, 79, 2], [8, 83, 6], [14, 81, 2]],
    [[0, 81, 3], [3, 84, 3], [6, 81, 1], [7, 79, 1], [8, 77, 4], [12, 79, 2], [14, 81, 2]],
    [[0, 79, 3], [3, 76, 3], [6, 72, 2], [8, 76, 2], [10, 79, 2], [12, 76, 4]],
    [[0, 77, 2], [2, 76, 1], [3, 74, 3], [6, 77, 2], [8, 81, 4], [12, 79, 2], [14, 77, 2]],
    [[0, 74, 3], [3, 71, 3], [6, 67, 4], [12, 72, 2], [14, 74, 2]],
    [[0, 77, 1], [2, 77, 1], [4, 77, 2], [6, 76, 2], [8, 74, 2], [10, 77, 2], [12, 81, 4]],
    [[0, 79, 1], [2, 79, 1], [4, 79, 2], [6, 74, 2], [8, 76, 2], [10, 79, 2], [12, 83, 4]],
    [[0, 81, 1], [2, 81, 1], [4, 81, 2], [6, 79, 2], [8, 77, 2], [10, 81, 2], [12, 84, 4]],
    [[0, 86, 6], [6, 84, 2], [8, 83, 4], [12, 79, 1], [13, 81, 1], [14, 83, 2]],
    [[0, 84, 6], [6, 83, 2], [8, 84, 2], [10, 86, 2], [12, 84, 4]],
    [[0, 83, 6], [6, 81, 2], [8, 79, 4], [12, 74, 2], [14, 79, 2]],
    [[0, 81, 6], [6, 79, 2], [8, 81, 2], [10, 83, 2], [12, 84, 4]],
    [[0, 81, 8], [8, 77, 2], [10, 79, 2], [12, 81, 2], [14, 79, 2]],
    [[0, 84, 6], [6, 83, 2], [8, 84, 2], [10, 86, 2], [12, 88, 4]],
    [[0, 86, 6], [6, 84, 2], [8, 83, 4], [12, 79, 4]],
    [[0, 81, 4], [4, 84, 4], [8, 83, 4], [12, 86, 4]],
    [[0, 84, 10], [12, 79, 2], [14, 77, 2]],
    [[0, 76, 8], [8, 72, 4], [12, 74, 4]],
    [[0, 77, 8], [8, 76, 4], [12, 72, 4]],
    [[0, 74, 4], [4, 79, 4], [8, 83, 4], [12, 86, 4]],
    [[0, 85, 6], [6, 83, 2], [8, 81, 4], [12, 79, 2], [14, 81, 2]],
  ];
  for (let b = 12; b < 19; b++) MEL.push(MEL[b].map(([q, m, l]) => [q, m + 2, l])); // последний припев на тон выше
  MEL.push([[0, 86, 8], [8, 83, 3], [11, 81, 1], [12, 79, 2], [14, 77, 2]]);       // и разворот обратно в до мажор
  // аккорды: бас ведём к ближайшему звуку, голоса — к ближайшему обращению (плавно, без скачков)
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], sus4: [0, 5, 7] };
  let prevBass = 48, prevVoc = [60, 64, 67, 72];
  function chord(name) {
    const [, r, acc, q, s] = name.match(/^([A-G])([#b]?)(m7|m|7|sus4)?(?:\/([A-G]))?$/);
    const root = (PC[r] + (acc === '#' ? 1 : acc === 'b' ? 11 : 0)) % 12, pcs = QUAL[q || ''].map(i => (root + i) % 12), bpc = s ? PC[s] : root;
    let bass = 0, best = 99;
    for (let m = 38; m <= 52; m++) if (m % 12 === bpc && Math.abs(m - prevBass) < best) { best = Math.abs(m - prevBass); bass = m; }
    let voc = null; best = 1e9;
    for (let k = 0; k < pcs.length; k++) {
      const rot = pcs.slice(k).concat(pcs.slice(0, k)), v = [];
      let m = 52; while (m % 12 !== rot[0]) m++;
      v.push(m); for (let i = 1; i < rot.length; i++) { m++; while (m % 12 !== rot[i]) m++; v.push(m); }
      if (v.length === 3) { m++; while (m % 12 !== root) m++; v.push(m); }
      const d = v.reduce((a, x, i) => a + Math.abs(x - prevVoc[i]), 0);
      if (d < best) { best = d; voc = v; }
    }
    prevBass = bass; prevVoc = voc;
    const fifth = (root + 7) % 12;
    return { bass, root, pcs, voc, pad: pcs.length === 4 ? voc.filter(x => x % 12 !== fifth).slice(0, 3) : voc.slice(0, 3) };
  }
  const tone = (m, C) => C.pcs.includes(((m % 12) + 12) % 12);
  // ближайший к нужной высоте звук аккорда (в любой октаве)
  const nearTone = (target, C) => { for (let d = 0; d < 12; d++) for (const s of [-1, 1]) { const m = target + d * s; if (tone(m, C)) return m; } return target; };
  // квинта аккорда над басом
  const fifthUp = (C) => { let v = C.bass + 1; while (v % 12 !== (C.root + 7) % 12) v++; return v; };
  // второй голос под мелодией: звук аккорда на терцию-кварту ниже, иначе терция по ладу
  const SCALE = [0, 2, 4, 5, 7, 9, 11];
  function below(m, C, K) {
    for (const d of [3, 4, 5, 7]) if (tone(m - d, C)) return m - d;
    let x = m - 3; while (!SCALE.includes((((x - K) % 12) + 12) % 12)) x--; return x;
  }
  const SYL = { du: ['d', 'u'], da: ['d', 'a'], bu: ['b', 'u'], bi: ['b', 'i'], ba: ['b', 'a'], do: ['d', 'o'], dom: ['d', 'o'] };
  const PARTS = {};
  const PART_SONG = {}; let building = 'green'; // какая партия в какой песне
  const put = (name, step, ...ev) => { PART_SONG[name] = building; (PARTS[name] = PARTS[name] || [])[step] = (PARTS[name][step] || []).concat([ev]); };
  const BARS = FORM.map(([sec, n1, n2]) => { const A = chord(n1), B = n2 ? chord(n2) : A; return { sec, A, B }; });
  BARS.forEach(({ sec, A, B }, b) => {
    const o = b * 16, at = q => (q >= 8 ? B : A);
    const verse = sec === 'verse', pre = sec === 'pre', bri = sec === 'bridge', fin = sec === 'final', cho = sec === 'chorus' || fin;
    const nb = BARS[(b + 1) % BARS.length], end = nb.sec !== sec || b === BARS.length - 1; // последний такт раздела — сбивка
    const ib = BARS.slice(0, b).filter(x => x.sec === sec).length;                         // номер такта внутри раздела
    const K = fin ? 2 : 0;                                                                 // тональность: в последнем припеве ре мажор
    // громкость раздела: куплет спокойнее, распевка нарастает, затишье тихое, последний припев громче всех
    const E = { verse: 0.86, pre: 0.88 + ib * 0.05, chorus: 1, bridge: ib === 3 ? 0.8 : 0.62, final: 1.1 }[sec];
    const v = (p, q, m, l, vel, x) => put(p, o + q, m, l, Math.min(1, vel * E), x);

    // ---- Бумбо: бочка
    if (verse) { v('kick', 0, 0, 1, 1); v('kick', 8, 0, 1, 0.9); if (ib % 4 === 3) v('kick', 10, 0, 1, 0.6); }
    else if (pre) { [0, 4, 8, 12].forEach(q => v('kick', q, 0, 1, 0.8 + ib * 0.05)); if (end) [10, 14].forEach(q => v('kick', q, 0, 1, 0.7)); }
    else if (cho) { v('kick', 0, 0, 1, 1); v('kick', 6, 0, 1, 0.6); v('kick', 8, 0, 1, 0.92); if (fin) v('kick', 11, 0, 1, 0.5); }
    else if (bri) { v('kick', 0, 0, 1, 0.75); if (ib >= 2) v('kick', 8, 0, 1, 0.8); if (ib === 3) [4, 12, 14].forEach(q => v('kick', q, 0, 1, 0.7)); }
    if (end && !bri) v('kick', 14, 0, 1, 0.7);
    if ((verse || cho) && ib % 2 === 0) v('kick', 0, (A.root % 12) + 48, 3, 0.85, 'v');                 // «бум»
    // ---- Барабас: малый барабан, призвуки, дробь в конце раздела
    if (!bri || ib === 2) { v('snare', 4, 0, 1, bri ? 0.6 : 0.9); v('snare', 12, 0, 1, bri ? 0.65 : 0.95); }
    if (bri && ib === 3) for (let q = 0; q < 16; q++) v('snare', q, 0, 1, 0.18 + q * 0.05);           // нарастающая дробь к последнему припеву
    else if (end) [12, 13, 14, 15].forEach((q, i) => v('snare', q, 0, 1, 0.35 + i * 0.18));
    else if (!bri) [7, 10, 15].forEach(q => v('snare', q, 0, 1, cho ? 0.32 : pre ? 0.28 : 0.22));
    if (pre && end) [8, 9, 10, 11].forEach((q, i) => v('snare', q, 0, 1, 0.3 + i * 0.1));
    if (end && (cho || pre)) [14, 15].forEach(q => v('snare', q, nearTone(64 + K, B), 1, 0.8, 'v'));               // «та-та»
    // ---- Шурша: шуршалка и хлопки
    if (bri && ib < 2) for (let q = 0; q < 16; q += 2) v('shaker', q, 0, 1, q % 4 === 2 ? 0.5 : 0.3);
    else for (let q = 0; q < 16; q++) v('shaker', q, 0, 1, q % 4 === 2 ? 0.75 : q % 2 ? 0.45 : 0.3);
    if (!bri || ib >= 2) { v('shaker', 4, 0, 1, 0.9, 'clap'); v('shaker', 12, 0, 1, 0.9, 'clap'); }
    if (cho && ib % 2 === 1) v('shaker', 14, 0, 1, 0.55, 'clap');
    if (bri && ib === 3) [6, 8, 10, 14].forEach(q => v('shaker', q, 0, 1, 0.7, 'clap'));
    if ((verse || cho) && ib % 2 === 0) v('shaker', 14, nearTone(67 + K, B), 1, 0.6, 'v');                           // «шу»
    // ---- Глубун: басовая линия
    if (verse) [[0, A.bass, 6], [6, A.bass, 2], [8, fifthUp(B), 4], [12, B.bass + 12, 2], [14, fifthUp(B), 2]].forEach(([q, m, l], i) => v('bass', q, m, l, i ? 0.72 : 1));
    else if (pre) for (let q = 0; q < 16; q += 2) { const C = at(q); v('bass', q, C.bass + (q === 6 || q === 14 ? 12 : 0), 2, 0.7 + (q === 0) * 0.25 + ib * 0.03); }
    else if (cho) [[0, A.bass, 3], [3, A.bass, 3], [6, A.bass + 12, 2], [8, B.bass, 3], [11, B.bass, 3], [14, fifthUp(B), 2]].forEach(([q, m, l], i) => v('bass', q, m, l, i % 3 ? 0.75 : 1));
    else if (bri) {
      if (ib < 2) v('bass', 0, A.bass, 15, 0.9);
      else if (ib === 2) { v('bass', 0, A.bass, 6, 0.9); v('bass', 8, A.bass, 6, 0.85); }
      else [[0, A.bass, 4], [4, A.bass + 12, 4], [8, A.bass + 2, 4], [12, A.bass + 4, 4]].forEach(([q, m, l], i) => v('bass', q, m, l, 0.8 + i * 0.05)); // ход вверх к ре
    }
    if (ib === 0 && (verse || cho)) v('bass', 0, A.bass + 12, 8, 0.85, 'v');                          // «о-ом»
    // ---- Гудун: хор держит аккорды
    const padV = bri ? 1 : cho ? 0.9 : pre ? 0.75 + ib * 0.05 : 0.7;
    if (B === A) A.pad.forEach(m => v('pad', 0, m, 15, padV)); else { A.pad.forEach(m => v('pad', 0, m, 7, padV)); B.pad.forEach(m => v('pad', 8, m, 7, padV)); }
    // ---- Буля: маримба
    if (bri) [0, 4, 8, 12].forEach((q, i) => v('marimba', q, at(q).voc[ib === 3 ? 3 - i : i] + (ib >= 2 ? 12 : 0), 4, 0.75));
    else {
      const pat = cho ? [0, 2, 1, 3, 2, 3, 1, 2] : pre ? [0, 2, 1, 3, 0, 2, 1, 3] : [0, 1, 2, 3, 2, 1, 2, 1];
      pat.forEach((k, i) => v('marimba', i * 2, at(i * 2).voc[k] + (fin && i % 2 ? 12 : 0), 2, i % 2 ? 0.6 : 0.9));
    }
    if ((verse || cho) && ib % 2 === 1) v('marimba', 14, B.voc[2], 2, 0.8, 'v');                     // «бу-уль»
    // ---- Тумтум: бонги и сбивки томами
    if (bri && ib < 3) { [6, 14].forEach(q => v('tom', q, 60, 1, 0.45)); if (ib === 2) [11, 13].forEach(q => v('tom', q, 67, 1, 0.45)); }
    else {
      [3, 7, 11].forEach(q => v('tom', q, 67, 1, 0.5)); v('tom', 6, 60, 1, 0.55);
      if (end || ib % 4 === 3) [[12, 57], [13, 53], [14, 50], [15, 45]].forEach(([q, m], i) => v('tom', q, m, 1, 0.55 + i * 0.12)); else v('tom', 14, 60, 1, 0.55);
    }
    if ((verse || cho) && ib % 4 === 3) v('tom', 8, nearTone(57 + K, B), 2, 0.85, 'v');               // «тум»
    // ---- Пузырик: сопрано «ла-а» с колокольчиком
    if (verse) { v('soprano', 0, nearTone(79, A), 7, 0.8, true); v('soprano', 8, nearTone(76, B), 7, 0.7, false); }
    else if (pre) v('soprano', 0, nearTone(77 + ib * 2, A), 15, 0.75 + ib * 0.05, true);
    else if (cho) [84, 81, 79, 76].forEach((tg, i) => v('soprano', i * 4, nearTone(tg + K, at(i * 4)), 3, i ? 0.7 : 0.85, i === 0));
    else v('soprano', 0, nearTone([84, 84, 83, 85][ib], A), 15, 0.85, true);
    // ---- Квакуша: «ква-ква» в паузах мелодии
    const fr = C => { let m = C.voc[2]; while (m > 64) m -= 12; while (m < 52) m += 12; return m; };
    if (verse) { v('frog', 12, fr(B), 2, 0.85); v('frog', 14, nearTone(fr(B) - 4, B), 2, 0.7); }
    else if (pre) v('frog', 14, fr(B), 2, 0.8);
    else if (cho) { v('frog', 6, fr(A), 2, 0.75); v('frog', 14, fr(B), 2, 0.85); }
    else if (ib % 2 === 1) v('frog', 14, fr(B), 2, 0.7);
    // ---- Бренчик: щипковые аккорды на слабую долю, в затишье — как арфа
    if (bri) for (let q = 0; q < 16; q += 2) { const C = at(q); v('pluck', q, C.voc[(q / 2) % 4] + 12, 2, 0.55 + (q % 4 === 0) * 0.15); }
    else {
      [2, 6, 10, 14].forEach(q => { const C = at(q); v('pluck', q, C.voc[0], 1, q === 2 ? 0.9 : 0.7, C.voc.slice(0, 3)); });
      if (cho || (pre && ib >= 2)) [3, 11].forEach(q => { const C = at(q); v('pluck', q, C.voc[0], 1, 0.45, C.voc.slice(0, 3)); });
    }
    if (cho && ib % 2 === 0) { v('pluck', 8, nearTone(69 + K, B), 2, 0.75, 'v'); v('pluck', 10, nearTone(67 + K, B), 2, 0.7, 'v'); } // «ля-ля»
    // ---- Громофон: медь
    const st = C => C.voc.slice(0, 3);
    if (verse && ib % 4 === 3) { v('brass', 0, A.voc[0], 2, 0.7, st(A)); v('brass', 3, A.voc[0], 2, 0.6, st(A)); v('brass', 8, nearTone(67, B), 1, 0.7, 'v'); v('brass', 10, nearTone(72, B), 2, 0.8, 'v'); }
    if (pre) { v('brass', 0, A.voc[0], 3, 0.6 + ib * 0.08, st(A)); if (!end) v('brass', 8, B.voc[0], 3, 0.55 + ib * 0.08, st(B)); }
    if (cho) { v('brass', 0, A.voc[0], 2, 0.9, st(A)); v('brass', 3, A.voc[0], 2, 0.75, st(A)); if (fin || B !== A) { v('brass', 8, B.voc[0], 2, 0.8, st(B)); v('brass', 11, B.voc[0], 2, 0.7, st(B)); } }
    if ((pre || bri) && end) [[8, 0], [10, 1], [12, 2], [14, 3]].forEach(([q, k]) => v('brass', q, B.voc[k], 2, 0.6 + k * 0.1, [B.voc[k] - 12, B.voc[k]])); // фанфара
    if (b === BARS.length - 1) [[8, 0], [11, 2], [14, 3]].forEach(([q, k], i) => v('brass', q, B.voc[k], 2, 0.7 + i * 0.1, st(B)));
    // ---- Свистун: подголосок долгими нотами
    const DES = { verse: [88, 86, 84, 83, 81, 79, 81, 79], pre: [81, 83, 84, 86], chorus: [88, 86, 84, 84, 88, 86, 84, 84], final: [90, 88, 86, 86, 90, 88, 86, 86] };
    if (DES[sec]) { if (B === A) v('whistle', 0, nearTone(DES[sec][ib], A), 14, 0.8); else { v('whistle', 0, nearTone(DES[sec][ib], A), 7, 0.8); v('whistle', 8, nearTone(DES[sec][ib], B), 6, 0.8); } }
    else if (ib >= 2) v('whistle', 8, nearTone(86, B), 7, 0.7);
    if ((verse || cho) && ib % 4 === 1) { v('whistle', 12, nearTone(76 + K, B), 1, 0.85, 'v'); v('whistle', 14, nearTone(71 + K, B), 2, 0.85, 'v'); } // «у-ху»
    // ---- элитные певцы
    // Бубун: басом «дум-ду-дам» по басовой линии, в затишье — долгое «до-ом»
    if (bri) { if (ib < 3) v('bassvox', 0, A.bass + 12, 12, 0.85, SYL.dom); else [0, 4, 8, 12].forEach((q, i) => v('bassvox', q, A.bass + 12 + [0, 0, 2, 4][i], 3, 0.8, SYL.du)); }
    else if (pre) [0, 4, 8, 12].forEach(q => v('bassvox', q, at(q).bass + 12, 3, q ? 0.75 : 0.9, q % 8 ? SYL.du : SYL.dom));
    else {
      let fv = fifthUp(B) + 12; if (fv > B.bass + 19) fv -= 12;
      [[0, A.bass + 12, 3, 'du'], [6, A.bass + 12, 2, 'du'], [8, fv, 3, 'da'], [11, B.bass + 12, 1, 'bu'], [14, fv, 2, 'du']].forEach(([q, m, l, sy], i) => v('bassvox', q, m, l, i ? 0.75 : 0.95, SYL[sy]));
    }
    // Тыц: битбокс
    if (bri && ib < 2) [2, 6, 10, 14].forEach(q => v('beatbox', q, 0, 1, 0.5, 'ts'));
    else {
      v('beatbox', 0, 0, 1, 1, 'B'); v('beatbox', 8, 0, 1, 0.9, 'B'); if (cho) v('beatbox', 10, 0, 1, 0.7, 'B'); if (ib % 4 === 3 || pre) v('beatbox', 6, 0, 1, 0.6, 'B');
      [2, 6, 10, 14].forEach(q => v('beatbox', q, 0, q === 14 && ib % 2 ? 2 : 1, 0.7, 'ts')); if (cho || pre) [1, 5, 9, 13].forEach(q => v('beatbox', q, 0, 1, 0.3, 'ts'));
      if (end) [12, 13, 14, 15].forEach((q, i) => v('beatbox', q, 0, 1, 0.45 + i * 0.15, 'pf')); else { v('beatbox', 4, 0, 1, 0.9, 'pf'); v('beatbox', 12, 0, 1, 0.95, 'pf'); [7, 15].forEach(q => v('beatbox', q, 0, 1, 0.45, 'k')); }
    }
    // Хейхо: «хей! — хо!»; в распевке — всё выше, перед припевом — четыре «хей!» подряд
    const cp = C => 55 + (((C.root - 7) % 12) + 12) % 12;
    if (cho) { v('chant', 4, cp(A), 2, 0.8, 'хей'); v('chant', 12, cp(B), 2, 0.9, 'хо'); if (end) v('chant', 14, cp(B) + 7, 2, 0.95, 'хей'); }
    else if (pre) { if (end) [8, 10, 12, 14].forEach((q, i) => v('chant', q, cp(B) + [0, 0, 4, 7][i], 2, 0.7 + i * 0.1, 'хей')); else v('chant', 12, nearTone(cp(A) + ib * 2, A), 2, 0.75 + ib * 0.1, 'хей'); }
    else if (verse && ib % 4 === 3) { v('chant', 12, cp(B), 2, 0.9, 'хей'); v('chant', 14, cp(B), 2, 0.95, 'хо'); }
    else if (bri && ib === 3) { v('chant', 12, cp(A), 2, 0.85, 'хей'); v('chant', 14, cp(A) + 7, 2, 1, 'хей'); }
    // Жар-птичка: йодль восьмыми с прыжком через октаву; в затишье отвечает Маэстро
    const yl = C => Math.min(C.voc[0] + 12, 79 + K), yh = C => Math.min(C.voc[1] + 12, 83 + K);
    if (cho) [[8, B.voc[0], 'o'], [10, yl(B), 'i'], [12, B.voc[2], 'o'], [14, yh(B), 'i']].forEach(([q, m, x]) => v('yodel', q, m, 2, 0.85, x));
    else if ((verse && ib % 2 === 1) || (bri && ib % 2 === 0)) [[10, B.voc[0], 'o'], [12, yl(B), 'i'], [14, B.voc[2], 'o']].forEach(([q, m, x]) => v('yodel', q, m, 2, 0.8, x));
    else if (pre && ib === 2) [[12, yl(B), 'i'], [14, yh(B), 'i']].forEach(([q, m, x]) => v('yodel', q, m, 2, 0.85, x));
    // Дубидуб: скэт «ду-би-ду-ба»; в затишье — сольный проход
    if (bri && ib === 2) [[0, 'du', 0], [2, 'bi', 1], [3, 'du', 2], [4, 'ba', 3], [6, 'du', 2], [7, 'bi', 1], [8, 'du', 0], [10, 'da', 1], [12, 'ba', 2], [14, 'du', 3]].forEach(([q, sy, k], i) => v('scat', q, A.voc[k] + 12 * (k < 2), q % 2 ? 1 : 2, i % 2 ? 0.7 : 0.85, SYL[sy]));
    else if (cho || pre) [[0, 'du', 0], [2, 'bi', 1], [3, 'du', 2], [6, 'ba', 3], [8, 'du', 2], [10, 'bi', 1], [11, 'da', 0], [14, 'ba', 2]].forEach(([q, sy, k], i) => v('scat', q, at(q).voc[k], q % 2 ? 1 : 2, i % 2 ? 0.7 : 0.85, SYL[sy]));
    else if (verse) [[2, 'du', 0], [3, 'bi', 1], [6, 'du', 2], [10, 'ba', 1], [14, 'da', 0]].forEach(([q, sy, k], i) => v('scat', q, at(q).voc[k], q % 2 ? 1 : 2, i % 2 ? 0.7 : 0.85, SYL[sy]));
    // выкрик Фьюти «фью» в конце фраз куплета
    if (verse && ib % 4 === 3) v('flute', 14, nearTone(79, B), 2, 0.75, 'v');
    // ---- мелодия и её голоса: Фьюти — мелодия, Певунья — второй голос ниже, Маэстро — октавой ниже
    MEL[b].forEach(([q, m, l], i) => {
      const C = at(q), vow = ['a', 'o', 'a', 'e', 'o'];
      v('flute', q, m, l, l >= 6 ? 0.95 : i % 2 ? 0.78 : 0.88);
      v('lead', q, below(m, C, K), l, 0.8, vow[i % 5]);
      v('opera', q, m - 12, l, bri ? 0.95 : 0.85, vow[(i + b) % 5]);
    });
  });

  SONGS.green = { name: 'Песня Певучего острова', bpm: 100, bar: 16, steps: 512, preview: 12 * 16 };

  // =====================================================================
  //  ПЕСНИ ДРУГИХ ОСТРОВОВ: у каждой свой темп, лад, размер и свои монстры
  // =====================================================================
  // общий построитель: такты по аккордам, мелодия по тактам, партии раскладывает gen(бар) — v(партия, шаг, нота, длина, сила, доп.)
  function song(id, o) {
    prevBass = o.bass0; prevVoc = o.voc0.slice(); building = id;
    const bars = o.form.map(([sec, n1, n2]) => { const A = chord(n1), B = n2 ? chord(n2) : A; return { sec, A, B }; });
    const half = o.bar / 2;
    bars.forEach((x, b) => {
      const off = b * o.bar, at = q => (q >= half ? x.B : x.A);
      const ib = bars.slice(0, b).filter(y => y.sec === x.sec).length, nb = bars[(b + 1) % bars.length];
      const end = nb.sec !== x.sec || b === bars.length - 1;
      const v = (p, q, m, l, vel, ex) => put(p, off + q, m, l, Math.min(1, vel * (o.energy ? o.energy(x.sec, ib) : 1)), ex);
      o.gen({ ...x, b, ib, end, at, v, mel: o.mel[b] || [], next: nb });
    });
    SONGS[id] = { name: o.name, bpm: o.bpm, bar: o.bar, steps: bars.length * o.bar, preview: o.preview * o.bar, bars };
  }
  const near = (prev, C, lo, hi) => { let best = prev, bd = 99; for (let m = lo; m <= hi; m++) if (tone(m, C) && Math.abs(m - prev) < bd) { bd = Math.abs(m - prev); best = m; } return best; };

  // ---------- «Огненный рок» — остров Вулкан: ми минор, 120 ударов, рифф → куплет → припев → соло гитары
  song('lava', {
    name: 'Огненный рок', bpm: 120, bar: 16, preview: 12, bass0: 40, voc0: [52, 59, 64, 67],
    form: [
      ['riff', 'Em'], ['riff', 'Em'], ['riff', 'C', 'D'], ['riff', 'Em'],
      ['verse', 'Em'], ['verse', 'C'], ['verse', 'G'], ['verse', 'D'], ['verse', 'Em'], ['verse', 'C'], ['verse', 'Am'], ['verse', 'B7'],
      ['chorus', 'C'], ['chorus', 'D'], ['chorus', 'Bm'], ['chorus', 'Em'], ['chorus', 'C'], ['chorus', 'D'], ['chorus', 'B7'], ['chorus', 'B7'],
      ['solo', 'Am'], ['solo', 'Em'], ['solo', 'C'], ['solo', 'B7'],
    ],
    mel: [, , , ,
      [[0, 64, 2], [2, 67, 2], [4, 67, 2], [6, 69, 2], [8, 71, 6], [14, 69, 2]],
      [[0, 67, 4], [4, 64, 2], [6, 67, 2], [8, 72, 4], [12, 67, 4]],
      [[0, 71, 2], [2, 74, 2], [4, 74, 2], [6, 71, 2], [8, 74, 4], [12, 76, 2], [14, 74, 2]],
      [[0, 74, 6], [6, 72, 2], [8, 69, 8]],
      [[0, 64, 2], [2, 67, 2], [4, 67, 2], [6, 69, 2], [8, 71, 6], [14, 72, 2]],
      [[0, 72, 4], [4, 71, 2], [6, 67, 2], [8, 64, 4], [12, 67, 4]],
      [[0, 69, 2], [2, 72, 2], [4, 76, 4], [8, 76, 2], [10, 72, 2], [12, 69, 4]],
      [[0, 71, 6], [6, 75, 2], [8, 78, 4], [12, 75, 4]],
      [[0, 76, 6], [6, 74, 2], [8, 72, 2], [10, 74, 2], [12, 76, 4]],
      [[0, 78, 6], [6, 76, 2], [8, 74, 4], [12, 69, 4]],
      [[0, 74, 2], [2, 74, 2], [4, 78, 4], [8, 78, 2], [10, 74, 2], [12, 71, 4]],
      [[0, 71, 6], [6, 74, 2], [8, 76, 8]],
      [[0, 76, 6], [6, 74, 2], [8, 72, 2], [10, 74, 2], [12, 79, 4]],
      [[0, 78, 6], [6, 76, 2], [8, 74, 2], [10, 76, 2], [12, 78, 4]],
      [[0, 78, 4], [4, 75, 4], [8, 71, 4], [12, 75, 4]],
      [[0, 78, 12]],
    ],
    energy: (sec, ib) => ({ riff: 0.85 + ib * 0.04, verse: 0.9, chorus: 1.05, solo: 1 }[sec]),
    gen({ sec, A, B, ib, end, at, v, mel, b }) {
      const riff = sec === 'riff', verse = sec === 'verse', cho = sec === 'chorus', solo = sec === 'solo';
      const pw = C => [C.bass + 12, C.bass + 19, C.bass + 24]; // «пауэр-аккорд»: основной тон, квинта, октава
      // Уголёк — бочка
      if (riff) { [0, 8].forEach(q => v('rockkick', q, 0, 1, 1)); if (ib >= 1) [3, 10].forEach(q => v('rockkick', q, 0, 1, 0.7)); }
      else if (verse) { [0, 7, 8].forEach(q => v('rockkick', q, 0, 1, q === 7 ? 0.6 : 0.95)); if (ib % 2) v('rockkick', 10, 0, 1, 0.65); }
      else if (cho) [0, 4, 8, 12].forEach(q => v('rockkick', q, 0, 1, q % 8 ? 0.8 : 1));
      else [0, 6, 8, 14].forEach(q => v('rockkick', q, 0, 1, q % 8 ? 0.7 : 0.95));
      if (end) [12, 13, 14, 15].forEach((q, i) => v('rockkick', q, 0, 1, 0.6 + i * 0.12));
      // Кремень — удары по наковальне на 2 и 4, в конце раздела — сбивка
      if (!(riff && ib < 1)) { v('anvil', 4, 0, 1, 0.9); v('anvil', 12, 0, 1, 0.95); }
      if (end) [10, 11, 14, 15].forEach((q, i) => v('anvil', q, 0, 1, 0.45 + i * 0.15, 'fill'));
      // Перчик — коровий колокольчик и хэт
      for (let q = 0; q < 16; q += 2) v('cowbell', q, 0, 1, q % 4 ? 0.45 : 0.7, solo && q % 8 === 6 ? 'open' : 'hat');
      if (cho) [0, 4, 8, 12].forEach(q => v('cowbell', q, 0, 1, q ? 0.7 : 0.9));
      if (riff && ib === 3) [0, 2, 4, 6].forEach(q => v('cowbell', q, 0, 1, 0.8));
      if (solo) [2, 10].forEach(q => v('cowbell', q, 0, 1, 0.7));
      // Искра — гитара: рифф, глухие восьмые, мощные аккорды, соло
      const RIFF = [[0, 52, 2], [3, 52, 1], [4, 55, 2], [6, 52, 1], [7, 57, 2], [10, 52, 1], [11, 58, 1], [12, 57, 2], [14, 55, 2]];
      if (riff && A.root === 4) RIFF.forEach(([q, m, l]) => v('riff', q, m, l, q % 4 ? 0.75 : 0.95));
      else if (riff) { v('riff', 0, A.bass + 12, 6, 0.95, pw(A)); v('riff', 8, B.bass + 12, 6, 0.95, pw(B)); }
      else if (verse) for (let q = 0; q < 16; q += 2) { const C = at(q); v('riff', q, C.bass + 12, 1, q % 4 ? 0.6 : 0.85, pw(C).slice(0, 2)); }
      else if (cho) [[0, 6], [6, 2], [8, 6], [14, 2]].forEach(([q, l]) => v('riff', q, at(q).bass + 12, l, q % 8 ? 0.75 : 1, pw(at(q))));
      else ([
        [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 69, 2], [6, 72, 1], [7, 74, 1], [8, 76, 4], [12, 79, 2], [14, 76, 2]],
        [[0, 79, 3], [3, 76, 1], [4, 74, 2], [6, 71, 2], [8, 74, 2], [10, 76, 2], [12, 71, 4]],
        [[0, 72, 1], [1, 74, 1], [2, 76, 1], [3, 79, 1], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 79, 1], [13, 76, 1], [14, 74, 2]],
        [[0, 75, 2], [2, 78, 2], [4, 81, 2], [6, 83, 6], [12, 81, 1], [13, 78, 1], [14, 75, 2]],
      ][ib]).forEach(([q, m, l]) => v('riff', q, m, l, 0.9));
      // Магмус — бас: в риффе вместе с гитарой, в куплете восьмыми, в припеве с октавами, в соло ходом
      if (riff && A.root === 4) RIFF.forEach(([q, m, l]) => v('fuzzbass', q, m - 12, l, 0.9));
      else if (riff) { v('fuzzbass', 0, A.bass, 6, 1); v('fuzzbass', 8, B.bass, 6, 1); }
      else if (verse) for (let q = 0; q < 16; q += 2) v('fuzzbass', q, at(q).bass, 2, q ? 0.75 : 1);
      else if (cho) [[0, 0], [3, 0], [6, 12], [8, 0], [11, 0], [14, 12]].forEach(([q, d]) => v('fuzzbass', q, at(q).bass + d, 2, q % 8 ? 0.8 : 1));
      else [0, 4, 8, 12].forEach((q, i) => v('fuzzbass', q, nearTone(A.bass + [0, 3, 5, 7][i], A) , 4, 0.85));
      // Дымок — орган: держит аккорды, в соло — отрывистые «удары»
      if (riff && ib >= 2) v('organ', 0, A.voc[0], 15, 0.6 + ib * 0.1, A.voc);
      else if (verse) [0, 8].forEach(q => v('organ', q, at(q).voc[0], 7, 0.7, at(q).voc));
      else if (cho) v('organ', 0, A.voc[0], 15, 0.9, A.voc);
      else if (solo) [0, 3, 6, 10].forEach(q => v('organ', q, A.voc[0], 2, 0.75, A.voc));
      // Дракоша — главный голос: «е-е», «о-о», «йе!»
      mel.forEach(([q, m, l], i) => v('rockvox', q, m, l, l >= 6 ? 0.95 : 0.85, ['e', 'a', 'o', 'e', 'a'][(i + b) % 5]));
      // Вулканя — рык и выкрики
      const gp = C => near(52, C, 45, 57);
      if (riff && ib === 3) [[8, 'h', 'o'], [12, 'h', 'o'], [14, 'h', 'e']].forEach(([q, c, x]) => v('growl', q, gp(B), 2, 0.95, [c, x]));
      else if (verse && ib % 4 === 3) v('growl', 0, gp(A), 8, 0.85, ['r', 'o']);
      else if (cho) { v('growl', 12, gp(B) + 12 > 64 ? gp(B) : gp(B) + 12, 2, 0.9, ['h', 'e']); if (ib % 2) v('growl', 14, gp(B), 2, 0.9, ['h', 'o']); }
      else if (solo && ib === 3) v('growl', 0, gp(A), 12, 0.95, ['j', 'e']);
    },
  });

  let bari = 57; // баритон Йетика ведёт свой голос от аккорда к аккорду
  // ---------- «Снежный вальс» — остров Льдинка: ре мажор, на три четверти, середина в си миноре
  song('ice', {
    name: 'Снежный вальс', bpm: 156, bar: 12, preview: 8, bass0: 38, voc0: [57, 62, 66, 69],
    form: [
      ['a', 'D'], ['a', 'Bm'], ['a', 'Em'], ['a', 'A7'], ['a', 'D'], ['a', 'F#m'], ['a', 'G'], ['a', 'A7'],
      ['a2', 'D'], ['a2', 'Bm'], ['a2', 'Em'], ['a2', 'A7'], ['a2', 'G'], ['a2', 'A7'], ['a2', 'D'], ['a2', 'D'],
      ['b', 'Bm'], ['b', 'F#7'], ['b', 'Bm'], ['b', 'Bm'], ['b', 'G'], ['b', 'D'], ['b', 'E7'], ['b', 'A7'],
      ['b2', 'D'], ['b2', 'D7'], ['b2', 'G'], ['b2', 'Gm'], ['b2', 'D'], ['b2', 'A7'], ['b2', 'D'], ['b2', 'A7'],
    ],
    mel: [
      [[0, 78, 8], [8, 81, 4]], [[0, 83, 8], [8, 81, 4]], [[0, 79, 4], [4, 78, 4], [8, 76, 4]], [[0, 76, 8], [8, 73, 4]],
      [[0, 74, 4], [4, 78, 4], [8, 81, 4]], [[0, 85, 8], [8, 81, 4]], [[0, 83, 4], [4, 79, 4], [8, 76, 4]], [[0, 79, 8], [8, 73, 4]],
      [[0, 78, 8], [8, 81, 4]], [[0, 83, 8], [8, 86, 4]], [[0, 88, 4], [4, 86, 4], [8, 83, 4]], [[0, 85, 8], [8, 81, 4]],
      [[0, 83, 4], [4, 86, 4], [8, 88, 4]], [[0, 85, 4], [4, 88, 4], [8, 85, 4]], [[0, 86, 12]], [[0, 74, 4], [4, 78, 4], [8, 81, 4]],
      [[0, 83, 8], [8, 78, 4]], [[0, 82, 8], [8, 78, 4]], [[0, 83, 4], [4, 85, 4], [8, 86, 4]], [[0, 86, 8], [8, 83, 4]],
      [[0, 79, 4], [4, 83, 4], [8, 86, 4]], [[0, 90, 8], [8, 86, 4]], [[0, 88, 4], [4, 86, 4], [8, 80, 4]], [[0, 81, 8], [8, 79, 4]],
      [[0, 78, 8], [8, 81, 4]], [[0, 84, 8], [8, 81, 4]], [[0, 83, 8], [8, 79, 4]], [[0, 82, 8], [8, 79, 4]],
      [[0, 78, 4], [4, 81, 4], [8, 86, 4]], [[0, 85, 4], [4, 88, 4], [8, 79, 4]], [[0, 86, 12]], [[0, 81, 4], [4, 79, 4], [8, 76, 4]],
    ],
    energy: (sec) => ({ a: 0.85, a2: 0.95, b: 0.9, b2: 1 }[sec]),
    gen({ sec, A, ib, end, v, mel, b }) {
      const second = sec === 'a2' || sec === 'b2', minor = sec === 'b';
      // Пингви — туба «умпа» на первую долю, на третью — квинта; в конце восьмитактов — ход вверх
      v('oompah', 0, A.bass, 4, 1); const f5 = fifthUp(A); if (ib % 2) v('oompah', 8, f5 - 12 >= 36 ? f5 - 12 : f5, 3, 0.7);
      if (end) [[4, 2], [8, 4]].forEach(([q, d]) => v('oompah', q, A.bass + d, 3, 0.75));
      // Морозик — скрипки: «па-па» щипком на 2 и 3, в середине — смычком долгими аккордами
      if (minor) v('strings', 0, A.voc[0], 11, 0.75, A.voc.slice(0, 3));
      else [4, 8].forEach(q => v('strings', q, A.voc[0], 2, q === 4 ? 0.85 : 0.7, A.voc.slice(0, 3)));
      // Ёлочка — бубенцы на 2 и 3, перед новой частью — перезвон
      [4, 8].forEach(q => v('sleigh', q, 0, 1, second ? 0.8 : 0.6)); if (second) v('sleigh', 10, 0, 1, 0.4);
      if (end) v('sleigh', 0, 0, 12, 0.7, 'roll');
      // Шишка — «цок-цок» деревяшками, как копытца
      if (second || minor) [0, 2, 4, 6, 8, 10].forEach(q => v('woodblock', q, q % 4 ? 79 : 72, 1, q ? 0.55 : 0.8)); else [0, 4, 8].forEach(q => v('woodblock', q, q ? 79 : 72, 1, 0.6));
      // Сосулька — стеклянная гармоника: долгий звук сверху раз в два такта, в середине — каждый такт
      if (ib % 2 === 0 || minor) v('glass', 0, nearTone(minor ? 86 : 90, A), minor ? 11 : 22, 0.8);
      // Снежок — мелодия на челесте, во второй раз с подголоском октавой выше
      mel.forEach(([q, m, l]) => { v('celesta', q, m, l, 0.9); if (second && l >= 8) v('celesta', q, m + 12, l, 0.45); });
      // Снежинка — сопрано: в повторах поёт мелодию, в первый раз — долгие верхние ноты
      if (second) mel.forEach(([q, m, l], i) => v('icesoprano', q, m, l, 0.85, ['a', 'a', 'o', 'i'][(i + b) % 4]));
      else if (ib % 2 === 1) v('icesoprano', 0, nearTone(88, A), 11, 0.75, 'a');
      // Йетик — баритон: подголосок долгими звуками, плавно от аккорда к аккорду
      v('baritone', 0, (bari = near(bari, A, 50, 62)), 11, 0.85, [['d', 'o'], ['m', 'o'], ['l', 'a'], ['d', 'u']][b % 4]);
    },
  });

  // ---------- «Солнечная лагуна» — остров Лагуна: фа мажор, калипсо, 108 ударов
  song('sea', {
    name: 'Солнечная лагуна', bpm: 108, bar: 16, preview: 8, bass0: 41, voc0: [57, 60, 65, 69],
    form: [
      ['verse', 'F'], ['verse', 'Bb'], ['verse', 'C7'], ['verse', 'F'], ['verse', 'F'], ['verse', 'Bb'], ['verse', 'C7'], ['verse', 'F'],
      ['chorus', 'Bb'], ['chorus', 'F'], ['chorus', 'C7'], ['chorus', 'F'], ['chorus', 'Bb'], ['chorus', 'F'], ['chorus', 'Gm7', 'C7'], ['chorus', 'F'],
      ['bridge', 'Dm'], ['bridge', 'Gm'], ['bridge', 'C7'], ['bridge', 'F'], ['bridge', 'Dm'], ['bridge', 'Gm'], ['bridge', 'C7'], ['bridge', 'C7'],
    ],
    mel: [
      [[0, 72, 2], [2, 77, 2], [4, 77, 3], [7, 77, 1], [8, 76, 2], [10, 77, 2], [12, 81, 4]],
      [[0, 82, 3], [3, 81, 3], [6, 79, 2], [8, 77, 4], [12, 74, 4]],
      [[0, 76, 2], [2, 79, 2], [4, 82, 3], [7, 81, 1], [8, 79, 4], [12, 76, 4]],
      [[0, 77, 6], [6, 76, 2], [8, 77, 8]],
      [[0, 72, 2], [2, 77, 2], [4, 77, 3], [7, 77, 1], [8, 79, 2], [10, 81, 2], [12, 84, 4]],
      [[0, 86, 3], [3, 84, 3], [6, 82, 2], [8, 77, 4], [12, 74, 4]],
      [[0, 79, 3], [3, 82, 3], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
      [[0, 77, 12]],
      [[0, 82, 4], [4, 86, 4], [8, 89, 3], [11, 86, 1], [12, 82, 4]],
      [[0, 81, 3], [3, 77, 3], [6, 81, 2], [8, 84, 8]],
      [[0, 82, 3], [3, 79, 3], [6, 76, 2], [8, 79, 4], [12, 82, 4]],
      [[0, 81, 6], [6, 79, 2], [8, 77, 8]],
      [[0, 82, 4], [4, 86, 4], [8, 89, 3], [11, 86, 1], [12, 82, 4]],
      [[0, 81, 3], [3, 84, 3], [6, 89, 2], [8, 86, 4], [12, 84, 4]],
      [[0, 82, 4], [4, 86, 4], [8, 84, 4], [12, 79, 4]],
      [[0, 77, 12]],
      [[0, 74, 4], [4, 77, 4], [8, 81, 8]],
      [[0, 82, 6], [6, 81, 2], [8, 79, 8]],
      [[0, 79, 4], [4, 76, 4], [8, 72, 4], [12, 76, 4]],
      [[0, 77, 8], [8, 81, 8]],
      [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 84, 2]],
      [[0, 86, 6], [6, 84, 2], [8, 82, 8]],
      [[0, 84, 4], [4, 82, 4], [8, 79, 4], [12, 76, 4]],
      [[0, 79, 6], [6, 76, 2], [8, 72, 8]],
    ],
    energy: (sec) => ({ verse: 0.9, chorus: 1.05, bridge: 0.88 }[sec]),
    gen({ sec, A, B, ib, end, at, v, mel, b }) {
      const verse = sec === 'verse', cho = sec === 'chorus', bri = sec === 'bridge';
      // Китёнок — бас калипсо «3+3+2»
      [[0, 0, 3], [3, 0, 3], [6, 5, 2], [8, 0, 3], [11, 0, 3], [14, 5, 2]].forEach(([q, f, l], i) => { const C = at(q); v('subbass', q, f ? fifthUp(C) - (fifthUp(C) > 47 ? 12 : 0) : C.bass, l, i % 3 ? 0.75 : 1); });
      // Ракушка — укулеле: короткие аккорды на слабые доли
      [2, 6, 10, 14].forEach(q => v('ukulele', q, at(q).voc[0], 1, q % 8 === 6 ? 0.9 : 0.7, at(q).voc.slice(0, 3)));
      if (cho) [4, 12].forEach(q => v('ukulele', q, at(q).voc[0], 1, 0.55, at(q).voc.slice(1, 4)));
      // Крабик — клаве «3-2» и щелчки клешнями
      (b % 2 ? [4, 8] : [0, 6, 12]).forEach(q => v('claves', q, 0, 1, 0.9));
      if (cho) [3, 7, 11, 15].forEach(q => v('claves', q, 0, 1, 0.5, 'clack'));
      if (end) [12, 13, 14, 15].forEach((q, i) => v('claves', q, 0, 1, 0.5 + i * 0.12, 'clack'));
      // Кокос — бонги: «мартильо» восьмыми, шлепки на 2 и 4
      for (let q = 0; q < 16; q += 2) v('bongo', q, q % 4 ? 71 : 64, 1, q % 4 ? 0.55 : 0.75);
      [6, 14].forEach(q => v('bongo', q, 69, 1, 0.9, 'slap')); if (cho) [5, 13].forEach(q => v('bongo', q, 71, 1, 0.4));
      if (end) [11, 13, 15].forEach(q => v('bongo', q, 64, 1, 0.7));
      // Медуза — стальной барабан: мелодия, в середине — переливы аккорда
      if (!bri) mel.forEach(([q, m, l]) => v('steel', q, m, l, 0.9));
      else for (let q = 0; q < 16; q += 2) { const C = at(q); v('steel', q, C.voc[[0, 1, 2, 3, 2, 1, 2, 3][q / 2]] + 12, 2, q % 4 ? 0.55 : 0.75); }
      // Попугайка — свирель: отвечает в паузах припева, в середине ведёт мелодию
      if (bri) mel.forEach(([q, m, l]) => v('panflute', q, m, l, 0.85));
      else if (cho && ib % 2 === 1) [[12, 0], [14, 1]].forEach(([q, k]) => v('panflute', q, nearTone([84, 81][k], B), 2, 0.8));
      else if (verse && ib % 4 === 3) [[12, 81], [13, 84], [14, 89]].forEach(([q, m]) => v('panflute', q, nearTone(m, B), q === 14 ? 2 : 1, 0.8));
      // Дельфа — главный голос в припеве и в середине, в куплете подпевает концы фраз
      if (!verse) mel.forEach(([q, m, l], i) => v('calypsovox', q, m - 12, l, 0.9, [['l', 'a'], [null, 'a'], ['l', 'e'], [null, 'o']][(i + b) % 4]));
      else if (ib % 2 === 1) mel.slice(-2).forEach(([q, m, l]) => v('calypsovox', q, m - 12, l, 0.8, ['l', 'a']));
      // Панцирь — низкое «йо-о» и «хей», в середине тянет «м-м»
      if (bri) v('reggaevox', 0, near(53, A, 48, 58), 14, 0.75, ['m', 'u']);
      else { v('reggaevox', 12, near(53, B, 48, 58), 2, 0.9, ['h', 'e']); v('reggaevox', 14, near(50, B, 45, 55), 2, 0.95, ['j', 'o']); }
    },
  });

  useSong('green');

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
  // короткая проба голоса монстра (в магазине и книге): начало припева
  function preview(part) {
    init(); if (ctx.state === 'suspended') ctx.resume();
    const ch = gain(VOL[part] || 1); ch.connect(bus); const s = gain(0.25); ch.connect(s); s.connect(revIn);
    const t0 = ctx.currentTime + 0.05, S = SONGS[PART_SONG[part]] || SONGS[SONG], step = 60 / S.bpm / 4, n = S.bar * 2;
    for (let st = 0; st < n; st++) { const evs = PARTS[part][S.preview + st]; if (evs) for (const e of evs) play(part, ch, t0 + st * step, e, e[1] * step, e[2]); }
    setTimeout(() => ch.disconnect(), (n * step + 2.5) * 1000);
  }

  return { init, start, add, remove, mute, setPan, renderMix, setSong, SONGS, vowel, bpb: () => SONGS[SONG].bar / 4, partSong: p => PART_SONG[p], get song() { return SONG; }, get SONG_SEC() { return STEPS * STEP; }, PARTS_LIST: () => Object.keys(PARTS), singing, onsets, now, beat, setOn, setSfx, sfx, preview, suspend, resume, get on() { return on; }, get sfxOn() { return sfxOn; }, get ready() { return !!ctx; } };
})();
