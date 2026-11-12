'use strict';
/* Музыка «Чаровника»: многодорожечный синтезатор на WebAudio.
   Мелодия, контрмелодия, аккорды-подклад, арпеджио, бас, ударные, эхо и реверберация.
   Все мелодии оригинальные и записаны прямо здесь — никаких файлов. */
(function () {
  /* ---------- Ноты и аккорды ---------- */
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = s => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14] };
  const chordOf = s => { const m = /^([A-G])([#b]?)(.*)$/.exec(s); return { root: (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, iv: QUAL[m[3]] || QUAL[''] }; };
  const toks = s => s.trim().split(/\s+/);

  /* ---------- Песни ---------- */
  // lead.n — ноты по восьмым (r: 2 шага по 1/16), «-» — тянуть, «.» — пауза
  const SONGS = {
    // Медовый луг — светлая, солнечная
    world: { bpm: 112, bar: 16, sw: 0.06,
      chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G'],
      lead: { inst: 'flute', alt: 'marimba', altV: 1.1, r: 2, v: 0.15, n: 'B4 - D5 - G5 - F#5 E5  F#5 - A5 - D5 - . .  E5 - G5 - B5 - A5 G5  E5 - - - C5 D5 E5 -  D5 - B4 - G4 - B4 D5  A5 - F#5 - D5 - E5 F#5  G5 - E5 - C5 - D5 E5  D5 - - - - - . .  G5 - - B5 A5 - G5 -  E5 - - G5 F#5 - E5 -  D5 - G5 - B5 - D6 -  C6 - B5 - A5 - F#5 -  E5 - G5 - C6 - B5 A5  A5 - F#5 - D5 - E5 F#5  G5 - - - B5 - D6 -  G5 - - - - - . .' },
      arp: { inst: 'bell', every: 2, oct: 5, v: 0.05, pat: [0, 1, 2, 1, 3, 2, 1, 2] },
      pad: { inst: 'pad', oct: 4, v: 0.035 },
      bass: { inst: 'bass', oct: 2, v: 0.2, pat: 'R.....R.5.....5.' },
      drums: { k: 'x.......x.......', s: '....o.......o...', h: '..x...x...x...x.', v: 0.7 } },
    // Деревня и усадьба — уютный вальс с гармошкой
    tavern: { gain: 1.3, bpm: 104, bar: 12, sw: 0,
      chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'D', 'D', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'],
      lead: { inst: 'accordion', alt: 'flute', altOct: 12, altV: 1.1, r: 2, v: 0.12, n: 'A4 - D5 F#5 A5 -  G5 - E5 - C#5 -  D5 - F#5 - B5 -  A5 - G5 F#5 E5 -  F#5 - A5 - F#5 D5  E5 - - C#5 E5 A5  D5 - - - F#5 E5  D5 - - - . .  B5 - - A5 G5 -  C#6 - - B5 A5 -  A5 - F#5 - C#5 -  D5 - F#5 - B5 -  B5 - A5 - G5 -  A5 - G5 - E5 -  F#5 - E5 - D5 -  D5 - - - . .' },
      stab: { inst: 'pluck', oct: 4, v: 0.045, pat: '....x...x...' },
      bass: { inst: 'bass', oct: 2, v: 0.22, pat: 'R...........' },
      drums: { k: 'x...........', h: '....o...o...', v: 0.5 } },
    // Шептучий лес и болото — загадочная, с флейтой и колокольчиками
    forest: { gain: 1.15, bpm: 84, bar: 16, sw: 0,
      chords: ['Em', 'C', 'D', 'Bm', 'Em', 'C', 'Am', 'B7'],
      lead: { inst: 'flute', alt: 'bell', altV: 0.8, r: 2, v: 0.14, n: 'B4 - - - E5 - G5 -  G5 - E5 - C5 - - -  D5 - F#5 - A5 - - -  F#5 - - - D5 - B4 -  E5 - G5 - B5 - A5 G5  E5 - - - G5 - E5 -  C5 - E5 - A5 - G5 -  F#5 - - - D#5 - - -' },
      arp: { inst: 'bell', every: 2, oct: 4, v: 0.055, pat: [0, 1, 2, 3, 4, 3, 2, 1] },
      pad: { inst: 'pad', oct: 3, v: 0.04 },
      bass: { inst: 'bass', oct: 2, v: 0.16, pat: 'R...............' },
      drums: { h: '..o...o...o...o.', v: 0.35 } },
    // Звонкие скалы — холодная, звенящая
    snow: { gain: 1.35, bpm: 88, bar: 16, sw: 0,
      chords: ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'E', 'E'],
      lead: { inst: 'bell', alt: 'flute', altOct: -12, altV: 1.1, r: 2, v: 0.12, n: 'C#6 - - - A5 - - -  F#5 - - - A5 - B5 -  C#6 - - - E6 - - -  B5 - - - G#5 - - -  A5 - C#6 - F#6 - E6 -  D6 - - - C#6 - B5 -  B5 - - - E6 - - -  G#5 - - - - - . .' },
      arp: { inst: 'pluck', every: 1, oct: 4, v: 0.035, pat: [0, 2, 4, 2, 1, 3, 4, 3] },
      pad: { inst: 'pad', oct: 4, v: 0.045 },
      bass: { inst: 'bass', oct: 2, v: 0.15, pat: 'R.......5.......' } },
    // Солёный пляж — тёплая, с маримбой и раскачкой
    beach: { bpm: 104, bar: 16, sw: 0.14,
      chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'],
      lead: { inst: 'marimba', alt: 'flute', altV: 0.9, r: 2, v: 0.16, n: 'C5 - F5 - A5 - G5 F5  A5 - - F5 D5 - - -  D5 - F5 - Bb5 - A5 G5  G5 - - - E5 - C5 -  F5 - A5 - C6 - A5 F5  D6 - C6 - A5 - F5 -  G5 - Bb5 - D6 - C6 Bb5  A5 - G5 - E5 - C5 -' },
      stab: { inst: 'pluck', oct: 4, v: 0.04, pat: '..x...x...x...x.' },
      bass: { inst: 'bass', oct: 2, v: 0.2, pat: 'R..R..5.R..R..5.' },
      drums: { k: 'x.....x...x.....', s: '....o.......o...', h: '..x...x...x...x.', v: 0.6 } },
    // Башня и подземелье — тёмная, таинственная
    dark: { bpm: 76, bar: 16, sw: 0,
      chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G7'],
      lead: { inst: 'epiano', alt: 'bell', altV: 0.85, r: 2, v: 0.13, n: 'G5 - - - Eb5 - C5 -  Ab5 - - - G5 - F5 -  F5 - Ab5 - C6 - - -  B5 - - - D6 - - -  C6 - - - G5 - Eb5 -  F5 - Eb5 - C5 - - -  D5 - F5 - Bb5 - Ab5 -  G5 - - - - - . .' },
      arp: { inst: 'bell', every: 4, oct: 5, v: 0.04, pat: [2, 1, 0, 1] },
      pad: { inst: 'pad', oct: 3, v: 0.05 },
      bass: { inst: 'bass', oct: 1, v: 0.2, pat: 'R.......R.......' },
      drums: { k: 'x...............', h: '........o.......', v: 0.4 } },
    // Бой с дикой девой — энергичный
    battle: { gain: 0.95, bpm: 152, bar: 16, sw: 0,
      chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'E', 'Am', 'F', 'G', 'E', 'E'],
      lead: { inst: 'saw', alt: 'pulse', altOct: 12, altV: 1.3, r: 2, v: 0.1, n: 'A5 . A5 G5 A5 - E5 -  F5 . F5 E5 F5 - C5 -  G5 . G5 F5 G5 - D5 -  G#5 - B5 - E6 - D6 B5  C6 - B5 A5 B5 - A5 G5  A5 - G5 F5 G5 - F5 E5  F5 - E5 D5 E5 - D5 B4  E5 - - - G#5 - B5 -  D6 - - C6 A5 - F5 -  E6 - - C6 A5 - E5 -  G#5 - B5 - D6 - E6 -  C6 - B5 - A5 - - -  A5 - C6 - F6 - E6 D6  D6 - B5 - G5 - A5 B5  G#5 - E5 - G#5 - B5 -  E6 - - - - - . .' },
      arp: { inst: 'pulse', every: 1, oct: 4, v: 0.03, pat: [0, 1, 2, 1] },
      pad: { inst: 'pad', oct: 3, v: 0.03 },
      bass: { inst: 'sbass', oct: 2, v: 0.2, pat: 'R.R.R.R.8.R.R.5.' },
      drums: { k: 'x...x...x...x...', s: '....x.......x..o', h: 'x.x.x.x.x.x.x.x.', v: 0.85 } },
    // Бой с соперником и ведьмой — мрачнее и быстрее
    boss: { gain: 0.85, bpm: 164, bar: 16, sw: 0,
      chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'],
      lead: { inst: 'saw', alt: 'saw', altOct: 12, altV: 0.8, r: 2, v: 0.1, n: 'D5 - F5 - A5 - D6 -  C6 - Bb5 - A5 - F5 -  G5 - E5 - C5 - E5 G5  C#6 - - - A5 - E5 -  D6 - C6 A5 F5 - A5 -  Bb5 - A5 G5 F5 - D5 -  G5 - Bb5 - D6 - G6 -  E6 - C#6 - A5 - - -' },
      lead2: { inst: 'pulse', r: 4, v: 0.05, n: 'D4 F4 A4 F4  Bb3 D4 F4 D4  C4 E4 G4 E4  A3 C#4 E4 C#4  D4 F4 A4 F4  Bb3 D4 F4 D4  G3 Bb3 D4 Bb3  A3 C#4 E4 A4' },
      pad: { inst: 'pad', oct: 3, v: 0.035 },
      bass: { inst: 'sbass', oct: 2, v: 0.22, pat: 'R.RR.RR.R.RR.R8.' },
      drums: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo', v: 0.9 } },
    // Свидания и признания — нежная
    date: { gain: 1.2, bpm: 74, bar: 16, sw: 0.08,
      chords: ['Bbmaj7', 'Gm7', 'Ebmaj7', 'F', 'Dm7', 'Gm7', 'Cm7', 'F'],
      lead: { inst: 'epiano', alt: 'bell', altOct: 12, altV: 0.7, r: 2, v: 0.14, n: 'F5 - - D5 F5 - Bb5 -  A5 - - G5 F5 - - -  G5 - - F5 Eb5 - G5 -  F5 - - - - - C5 D5  F5 - - E5 D5 - A5 -  Bb5 - - A5 G5 - D5 -  Eb5 - G5 - Bb5 - A5 G5  F5 - - - - - . .' },
      arp: { inst: 'epiano', every: 2, oct: 4, v: 0.04, pat: [0, 1, 2, 3, 2, 1, 2, 1] },
      pad: { inst: 'pad', oct: 3, v: 0.04 },
      bass: { inst: 'bass', oct: 2, v: 0.16, pat: 'R.......5.......' },
      drums: { h: '....o.......o...', v: 0.3 } },
    // Перепалки — комичная, пиццикато
    quarrel: { gain: 1.45, bpm: 138, bar: 16, sw: 0,
      chords: ['Gm', 'D', 'Gm', 'D', 'Cm', 'Gm', 'D', 'Gm'],
      lead: { inst: 'pizz', alt: 'marimba', r: 2, v: 0.17, n: 'G5 . D5 . G5 . A5 Bb5  A5 . F#5 . D5 . . .  Bb5 . A5 . G5 . D5 .  F#5 . A5 . D6 . . .  C6 . Bb5 . A5 . G5 .  Bb5 . A5 . G5 . D5 .  D5 . F#5 . A5 . C6 .  Bb5 . G5 . G4 . . .' },
      bass: { inst: 'pizz', oct: 2, v: 0.2, pat: 'R...5...R...5...' },
      drums: { k: 'x.......x.......', s: '....o.......o...', h: '..o...o...o...o.', v: 0.5 } }
  };
  U.SONGS = SONGS;

  /* ---------- Синтезатор ---------- */
  let A = null, bus = null, fxIn = null, rev = null, dly = null, song = null, step = 0, nextT = 0, timer = null, cur = null;
  function setup() { if (A) return true; const au = U._audio(); if (!au) return false; build(au); return true; }
  function build(au) {
    A = au; const ac = A.ac;
    fxIn = ac.createGain(); fxIn.gain.value = 1;
    // реверберация: синтетический импульс
    rev = ac.createConvolver(); const len = ac.sampleRate * 2.4, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = ir; const rg = ac.createGain(); rg.gain.value = 0.32; rev.connect(rg); rg.connect(A.master);
    // эхо
    dly = ac.createDelay(1); const fb = ac.createGain(), lp = ac.createBiquadFilter(), dg = ac.createGain(); fb.gain.value = 0.3; lp.type = 'lowpass'; lp.frequency.value = 2200; dg.gain.value = 0.22;
    dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(dg); dg.connect(A.master);
  }
  function env(g, t, a, peak, d, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, d); g.gain.setTargetAtTime(0.0001, end, rel);
  }
  function osc(type, f, t, end, det) { const o = A.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; o.start(t); o.stop(end + 0.05); return o; }
  // выход ноты: сухой сигнал в шину песни, часть — в реверберацию и эхо
  function out(node, wetR, wetD) {
    node.connect(bus);
    if (wetR) { const g = A.ac.createGain(); g.gain.value = wetR; node.connect(g); g.connect(rev); }
    if (wetD) { const g = A.ac.createGain(); g.gain.value = wetD; node.connect(g); g.connect(dly); }
  }
  const INST = {
    flute(t, f, d, v) { const ac = A.ac, end = t + d, g = ac.createGain(), o = osc('sine', f, t, end + 0.3), o2 = osc('triangle', f, t, end + 0.3), g2 = ac.createGain(); g2.gain.value = 0.25;
      const lfo = osc('sine', 5.2, t, end + 0.3), lg = ac.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.25); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      o.connect(g); o2.connect(g2); g2.connect(g); env(g, t, 0.05, v, 0.3, 0.75, 0.09, end); out(g, 0.35, 0.18); },
    bell(t, f, d, v) { const ac = A.ac, g = ac.createGain(), end = t + Math.max(d, 1.2); for (const [k, a] of [[1, 1], [2.76, 0.28], [5.4, 0.09]]) { const o = osc('sine', f * k, t, end + 0.5), og = ac.createGain(); og.gain.value = a; o.connect(og); og.connect(g); }
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.45); out(g, 0.45, 0.25); },
    pluck(t, f, d, v) { const ac = A.ac, g = ac.createGain(), lp = ac.createBiquadFilter(), end = t + Math.min(d, 0.5) + 0.3; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.setTargetAtTime(900, t, 0.12);
      osc('triangle', f, t, end).connect(lp); const o2 = osc('square', f * 2, t, end), g2 = ac.createGain(); g2.gain.value = 0.12; o2.connect(g2); g2.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.16); out(g, 0.25, 0.1); },
    marimba(t, f, d, v) { const ac = A.ac, g = ac.createGain(), end = t + 0.8; osc('sine', f, t, end).connect(g); const o2 = osc('sine', f * 4, t, end), g2 = ac.createGain(); g2.gain.setValueAtTime(0.3, t); g2.gain.setTargetAtTime(0.0001, t, 0.03); o2.connect(g2); g2.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.2); out(g, 0.3, 0.15); },
    epiano(t, f, d, v) { const ac = A.ac, g = ac.createGain(), end = t + Math.max(d, 1) + 0.6; osc('sine', f, t, end).connect(g); const o2 = osc('sine', f * 2, t, end), g2 = ac.createGain(); g2.gain.setValueAtTime(0.35, t); g2.gain.setTargetAtTime(0.02, t, 0.2); o2.connect(g2); g2.connect(g);
      const trem = osc('sine', 4.5, t, end), tg = ac.createGain(); tg.gain.value = v * 0.12; trem.connect(tg); tg.connect(g.gain);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setTargetAtTime(v * 0.35, t + 0.01, 0.35); g.gain.setTargetAtTime(0.0001, t + d, 0.25); out(g, 0.45, 0.2); },
    accordion(t, f, d, v) { const ac = A.ac, end = t + d, g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900;
      osc('square', f, t, end + 0.2, -7).connect(lp); osc('sawtooth', f, t, end + 0.2, 7).connect(lp); lp.connect(g);
      const trem = osc('sine', 6, t, end + 0.2), tg = ac.createGain(); tg.gain.value = v * 0.18; trem.connect(tg); tg.connect(g.gain);
      env(g, t, 0.03, v * 0.6, 0.2, 0.85, 0.06, end); out(g, 0.22, 0.05); },
    saw(t, f, d, v) { const ac = A.ac, end = t + d, g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(4200, t); lp.frequency.setTargetAtTime(1800, t, 0.12);
      const o1 = osc('sawtooth', f, t, end + 0.15, -8), o2 = osc('sawtooth', f, t, end + 0.15, 8); o1.connect(lp); o2.connect(lp); lp.connect(g);
      const lfo = osc('sine', 6, t, end + 0.15), lg = ac.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.3); lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      env(g, t, 0.008, v, 0.15, 0.7, 0.05, end); out(g, 0.18, 0.16); },
    pulse(t, f, d, v) { const ac = A.ac, end = t + Math.min(d, 0.25), g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; osc('square', f, t, end + 0.1).connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.06); out(g, 0.15, 0.12); },
    pizz(t, f, d, v) { const ac = A.ac, g = ac.createGain(), end = t + 0.4, lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; osc('triangle', f, t, end).connect(lp); const o2 = osc('sawtooth', f, t, end), g2 = ac.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.07); out(g, 0.25, 0.05); },
    pad(t, f, d, v) { const ac = A.ac, end = t + d, g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.7;
      osc('sawtooth', f, t, end + 1, -11).connect(lp); osc('sawtooth', f, t, end + 1, 11).connect(lp); osc('triangle', f / 2, t, end + 1).connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.6, d * 0.4)); g.gain.setTargetAtTime(0.0001, end, 0.35); out(g, 0.5, 0); },
    bass(t, f, d, v) { const ac = A.ac, end = t + d, g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; osc('triangle', f, t, end + 0.2).connect(lp); const s = osc('sine', f / 2, t, end + 0.2), sg = ac.createGain(); sg.gain.value = 0.5; s.connect(sg); sg.connect(lp); lp.connect(g);
      env(g, t, 0.01, v, 0.25, 0.6, 0.06, end); out(g, 0.05, 0); },
    sbass(t, f, d, v) { const ac = A.ac, end = t + d, g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(1600, t); lp.frequency.setTargetAtTime(380, t, 0.06);
      osc('sawtooth', f, t, end + 0.15).connect(lp); const s = osc('sine', f / 2, t, end + 0.15), sg = ac.createGain(); sg.gain.value = 0.6; s.connect(sg); sg.connect(lp); lp.connect(g);
      env(g, t, 0.005, v, 0.12, 0.55, 0.04, end); out(g, 0.03, 0); }
  };
  const DRUM = {
    k(t, v) { const ac = A.ac, o = osc('sine', 150, t, t + 0.35), g = ac.createGain(); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(g); g.gain.setValueAtTime(v * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); out(g, 0.04, 0); },
    s(t, v) { const ac = A.ac, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = A.nb; f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; n.connect(f); f.connect(g); g.gain.setValueAtTime(v * 0.42, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.17); n.start(t, Math.random()); n.stop(t + 0.2);
      const o = osc('triangle', 190, t, t + 0.1), og = ac.createGain(); og.gain.setValueAtTime(v * 0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(og); out(og, 0.1, 0); out(g, 0.18, 0); },
    h(t, v) { const ac = A.ac, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = A.nb; f.type = 'highpass'; f.frequency.value = 7200; n.connect(f); f.connect(g); g.gain.setValueAtTime(v * 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045); n.start(t, Math.random()); n.stop(t + 0.06); out(g, 0.05, 0); }
  };

  /* ---------- Подготовка песни ---------- */
  function compile(S) {
    const c = { S, chords: S.chords.map(chordOf), bars: S.chords.length };
    c.total = c.bars * S.bar;
    for (const k of ['lead', 'lead2']) if (S[k]) { const tk = toks(S[k].n), ev = []; for (let i = 0; i < tk.length; i++) { const x = tk[i]; if (x === '-' || x === '.') continue; let n = 1; while (tk[i + n] === '-') n++; ev.push({ at: i * S[k].r, len: n * S[k].r, m: midi(x) }); } c[k] = { ev, len: tk.length * S[k].r }; }
    return c;
  }
  function tones(ch, oct, n) { const out = []; for (let i = 0; out.length < n; i++) { const iv = ch.iv[i % ch.iv.length] + 12 * Math.floor(i / ch.iv.length); out.push(12 * (oct + 1) + ch.root + iv); } return out; }
  const BASSOFF = { R: 0, 3: 4, 5: 7, 8: 12 };

  function play(c, ai, t, sd) {
    const i = ai % c.total, loop = Math.floor(ai / c.total);
    const S = c.S, bar = Math.floor(i / S.bar) % c.bars, s = i % S.bar, ch = c.chords[bar];
    for (const k of ['lead', 'lead2']) if (c[k]) { const L = c[k], pos = i % L.len; const alt = loop % 2 === 1 && S[k].alt; for (const e of L.ev) if (e.at === pos) INST[alt ? S[k].alt : S[k].inst](t, hz(e.m + (alt ? S[k].altOct || 0 : 0)), e.len * sd * 0.95, S[k].v * (alt ? S[k].altV || 1 : 1)); }
    if (S.pad && s === 0) for (const n of tones(ch, S.pad.oct, 3)) INST[S.pad.inst](t, hz(n), S.bar * sd, S.pad.v);
    if (S.arp && s % S.arp.every === 0) { const tt = tones(ch, S.arp.oct, 6), k = (s / S.arp.every) % S.arp.pat.length; INST[S.arp.inst](t, hz(tt[S.arp.pat[k] % tt.length]), sd * S.arp.every, S.arp.v); }
    if (S.stab && S.stab.pat[s] === 'x') for (const n of tones(ch, S.stab.oct, 3)) INST[S.stab.inst](t, hz(n), sd * 2, S.stab.v);
    if (S.bass) { const p = S.bass.pat[s]; if (p && p !== '.') { let n = 1; while (n < 6 && S.bass.pat[(s + n) % S.bar] === '.') n++; INST[S.bass.inst](t, hz(12 * (S.bass.oct + 1) + ch.root + (BASSOFF[p] || 0)), n * sd * 0.9, S.bass.v); } }
    if (S.drums) for (const k of ['k', 's', 'h']) { const p = S.drums[k] && S.drums[k][s % S.drums[k].length]; if (p === 'x' || p === 'o') DRUM[k](t, S.drums.v * (p === 'x' ? 1 : 0.5)); }
  }
  function tick() {
    if (!A || !cur || A.ac.state !== 'running') return;
    if (!U.soundOn) { bus.gain.setTargetAtTime(0, A.ac.currentTime, 0.1); nextT = A.ac.currentTime + 0.1; return; }
    bus.gain.setTargetAtTime(cur.vol, A.ac.currentTime, 0.2);
    const sd = 60 / cur.c.S.bpm / 4;
    while (nextT < A.ac.currentTime + 0.3) {
      const sw = step % 2 ? cur.c.S.sw * sd : 0;
      play(cur.c, step, nextT + sw, sd);
      step++; nextT += sd;
    }
  }
  const CACHE = {};
  U.music = function (name) {
    if (U.song === name && cur) return; U.song = name;
    if (!setup()) return;
    const S = SONGS[name]; if (!S) return;
    const ac = A.ac;
    if (bus) { const old = bus; old.gain.cancelScheduledValues(ac.currentTime); old.gain.setTargetAtTime(0, ac.currentTime, 0.25); setTimeout(() => { try { old.disconnect(); } catch (e) { } }, 1600); }
    bus = ac.createGain(); bus.gain.value = 0; bus.connect(A.master);
    cur = { c: CACHE[name] || (CACHE[name] = compile(S)), vol: 0.62 * (S.gain || 1) };
    step = 0; nextT = ac.currentTime + 0.12;
    if (!timer) timer = setInterval(tick, 50);
  };
  // офлайн-рендер песни в буфер (для проверки уровней и демо-записей)
  U._renderSong = async function (name, secs) {
    const sr = 44100, oac = new OfflineAudioContext(2, sr * secs, sr), keep = [A, bus, rev, dly];
    const master = oac.createGain(); master.gain.value = 0.85; master.connect(oac.destination);
    const nb = oac.createBuffer(1, sr * 2, sr), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    build({ ac: oac, master, nb }); bus = oac.createGain(); bus.gain.value = 0.62 * (SONGS[name].gain || 1); bus.connect(master);
    const c = compile(SONGS[name]), sd = 60 / c.S.bpm / 4; let t = 0.05, i = 0;
    while (t < secs - 0.5) { play(c, i, t + (i % 2 ? c.S.sw * sd : 0), sd); i++; t += sd; }
    const buf = await oac.startRendering(); [A, bus, rev, dly] = keep;
    return [Array.from(buf.getChannelData(0)), Array.from(buf.getChannelData(1))];
  };
  // короткая победная фанфара
  U.fanfare = function () {
    if (!setup() || !U.soundOn || A.ac.state !== 'running') return;
    const keep = bus, t0 = A.ac.currentTime + 0.05, sd = 0.11;
    bus = A.ac.createGain(); bus.gain.value = 0.7; bus.connect(A.master);
    [['C5', 0, 1], ['E5', 1, 1], ['G5', 2, 1], ['C6', 3, 3], ['A5', 6, 1], ['C6', 7, 1], ['E6', 8, 6]].forEach(([n, a, l]) => { INST.saw(t0 + a * sd, hz(midi(n)), l * sd, 0.1); INST.bell(t0 + a * sd, hz(midi(n)), l * sd, 0.05); });
    INST.pad(t0 + 8 * sd, hz(midi('C4')), 0.8, 0.05); INST.pad(t0 + 8 * sd, hz(midi('E4')), 0.8, 0.05); INST.pad(t0 + 8 * sd, hz(midi('G4')), 0.8, 0.05);
    const fb = bus; setTimeout(() => { try { fb.disconnect(); } catch (e) { } }, 3000); bus = keep;
  };
  // музыка начинает играть сразу после первого касания
  const wake = () => { if (U.song && !cur) { const n = U.song; U.song = null; U.music(n); } };
  addEventListener('pointerdown', () => setTimeout(wake, 50));
})();
