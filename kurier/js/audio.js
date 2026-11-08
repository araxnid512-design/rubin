/* Курьер миров — музыка и звуки. Чиптюн-синтезатор на WebAudio: у каждого мира свой лад,
   темп, тембр и ритм; мелодия сочиняется из зерна мира, поэтому всегда одна и та же.
   Для боссов — та же тема быстрее и жёстче. Никаких файлов: всё синтезируется на лету. */
(function () {
  'use strict';
  const K = window.K;
  const A = (K.AUDIO = {});
  let ac = null, master, mus, sfx, noiseBuf, timer = null, cur = null, step = 0, nextT = 0;
  A.musicOn = true;
  A.sfxOn = true;

  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], penta: [0, 3, 5, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], whole: [0, 2, 4, 6, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
  const SONGS = {
    title: { bpm: 96, root: 57, scale: 'harm', chords: [0, 5, 3, 4], lead: 'square', leadVol: 0.06, bass: 'triangle', bassPat: 'x.......x.......', kick: 'x.......x.......', snare: '................', hat: '..x...x...x...x.', arp: 0.03, pad: 0.04, seed: 3, density: 0.4 },
    city: { bpm: 118, root: 57, scale: 'minor', chords: [0, 5, 2, 6], lead: 'sawtooth', leadVol: 0.045, bass: 'square', bassPat: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: 0.025, seed: 11, density: 0.55 },
    steppe: { bpm: 100, root: 62, scale: 'penta', chords: [0, 3, 2, 0], lead: 'square', leadVol: 0.055, bass: 'triangle', bassPat: 'x..x..x.x..x..x.', kick: 'x.....x.x.......', snare: '....x.......x.x.', hat: 'x...x...x...x...', tom: 'x.......x...x...', drone: 0.035, seed: 22, density: 0.5 },
    kingdom: { bpm: 112, root: 55, scale: 'major', chords: [0, 3, 4, 0], lead: 'square', leadVol: 0.05, bass: 'triangle', bassPat: 'x...x...x...x...', kick: 'x.......x.......', snare: '....x..x....x.xx', hat: 'x.x.x.x.x.x.x.x.', arp: 0.03, seed: 33, density: 0.5 },
    forest: { bpm: 92, root: 64, scale: 'dorian', chords: [0, 5, 3, 6], steps: 12, lead: 'triangle', leadVol: 0.1, bass: 'triangle', bassPat: 'x...........', kick: 'x...........', snare: '....x...x...', hat: '..x...x...x.', pad: 0.05, seed: 44, density: 0.45 },
    ice: { bpm: 84, root: 66, scale: 'lydian', chords: [0, 4, 5, 1], lead: 'sine', leadOct: 24, leadVol: 0.09, bass: 'triangle', bassPat: 'x.......x.......', kick: 'x...............', snare: '........x.......', hat: '....x.......x...', pad: 0.045, arp: 0.02, seed: 55, density: 0.4 },
    forge: { bpm: 134, root: 48, scale: 'phryg', chords: [0, 1, 0, 6], lead: 'sawtooth', leadVol: 0.045, bass: 'sawtooth', bassPat: 'xxx.xxx.xxx.x.x.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', seed: 66, density: 0.55 },
    rift: { bpm: 120, root: 59, scale: 'whole', chords: [0, 2, 4, 1], lead: 'square', leadVol: 0.045, bass: 'square', bassPat: 'x...x.x.x...x.x.', kick: 'x..x..x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.', pad: 0.04, arp: 0.025, seed: 77, density: 0.5 },
    ending: { bpm: 100, root: 60, scale: 'major', chords: [0, 5, 3, 4], lead: 'triangle', leadVol: 0.1, bass: 'triangle', bassPat: 'x...x...x...x...', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', pad: 0.05, arp: 0.025, seed: 88, density: 0.45 },
  };
  A.SONGS = SONGS;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function rngFrom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Мелодия: 8 тактов по схеме A A' B A'', сильные доли — звуки аккорда, слабые — шаги по ладу.
  function compose(S) {
    const r = rngFrom(S.seed * 7919);
    const steps = S.steps || 16, sc = SCALES[S.scale], L = sc.length;
    const phrase = (barA, barB) => {
      const out = new Array(steps * 2).fill(null);
      let prev = S.chords[barA] + 2;
      for (let i = 0; i < steps * 2; i++) {
        const chord = S.chords[i < steps ? barA : barB];
        const strong = i % 4 === 0;
        if (r() < (strong ? S.density + 0.3 : S.density * 0.55)) {
          let deg = strong ? chord + [0, 2, 4][Math.floor(r() * 3)] : prev + [-1, 1, -2, 2, 0][Math.floor(r() * 5)];
          deg = Math.max(-2, Math.min(L + 4, deg));
          out[i] = { deg, len: [1, 2, 2, 3][Math.floor(r() * 4)] };
          prev = deg;
        }
      }
      return out;
    };
    const A1 = phrase(0, 1), B1 = phrase(2, 3), A2 = A1.slice(), A3 = A1.slice();
    for (let i = steps * 2 - 6; i < steps * 2; i++) A2[i] = r() < 0.5 ? null : { deg: S.chords[1] + Math.floor(r() * 3), len: 2 };
    A3[steps * 2 - 4] = { deg: 0, len: 4 };
    for (let i = steps * 2 - 3; i < steps * 2; i++) A3[i] = null;
    const lead = [].concat(A1, A2, B1, A3);
    const chordAt = (bar) => S.chords[bar % S.chords.length];
    const toMidi = (deg, oct) => S.root + (oct || 0) + sc[((deg % L) + L) % L] + 12 * Math.floor(deg / L);
    return { lead, chordAt, toMidi, steps, bars: 8 };
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    mus = ac.createGain(); mus.gain.value = A.musicOn ? 0.55 : 0; mus.connect(master);
    sfx = ac.createGain(); sfx.gain.value = A.sfxOn ? 0.6 : 0; sfx.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  A.init = init;

  function tone(dest, type, f, t, dur, vol, slide) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dest, t, dur, vol, type, freq) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'highpass'; f.frequency.value = freq || 6000;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  function playStep(i, t) {
    const S = cur.S, C = cur.C, sd = cur.stepDur, steps = C.steps;
    const bar = Math.floor(i / steps), s = i % steps;
    const chord = C.chordAt(bar);
    const boss = cur.boss;
    const at = (pat) => pat && pat[s % pat.length] === 'x';
    // ударные
    if (at(S.kick) || (boss && s % 4 === 0)) tone(mus, 'sine', 160, t, 0.2, 0.5, 38);
    if (at(S.snare) || (boss && s % 8 === 4)) { noise(mus, t, 0.14, 0.22, 'bandpass', 1800); tone(mus, 'triangle', 220, t, 0.08, 0.12, 150); }
    if (at(S.hat)) noise(mus, t, 0.04, 0.06, 'highpass', 7500);
    if (at(S.tom)) tone(mus, 'sine', 110, t, 0.25, 0.25, 60);
    // бас
    if (at(S.bassPat)) {
      const up = (s / 2) % 2 === 1 && S.bassPat.indexOf('x.x.') >= 0 ? 12 : 0;
      tone(mus, S.bass, mtof(C.toMidi(chord, -24 + up)), t, sd * (boss ? 1.6 : 1.9), boss ? 0.13 : 0.1);
    }
    // протяжный гул степи и аккорды-подушки
    if (S.drone && s === 0) tone(mus, 'sawtooth', mtof(S.root - 24), t, sd * steps, S.drone * 0.6);
    if (S.pad && s === 0) for (const k of [0, 2, 4]) tone(mus, 'triangle', mtof(C.toMidi(chord + k, -12)), t, sd * steps * 0.95, S.pad);
    // арпеджио
    if (S.arp && s % 2 === 0) { const k = [0, 2, 4, 7][(s / 2) % 4]; tone(mus, 'square', mtof(C.toMidi(chord + k, 12)), t, sd * 0.9, S.arp); }
    // мелодия
    const n = C.lead[i % C.lead.length];
    if (n) {
      const f = mtof(C.toMidi(n.deg, S.leadOct || 12));
      tone(mus, S.lead, f, t, sd * n.len * 0.95, S.leadVol);
      if (S.scale === 'whole') tone(mus, S.lead, f * 1.008, t, sd * n.len * 0.95, S.leadVol * 0.6);
      if (S.leadOct === 24) tone(mus, 'sine', f * 2, t, sd * n.len * 0.6, S.leadVol * 0.25);
    }
  }

  function schedule() {
    if (!cur || !ac) return;
    while (nextT < ac.currentTime + 0.15) {
      playStep(step, nextT);
      nextT += cur.stepDur;
      step = (step + 1) % (cur.C.steps * cur.C.bars);
    }
  }

  A.play = function (name, boss) {
    if (!ac) return;
    const key = name + (boss ? ':boss' : '');
    if (cur && cur.key === key) return;
    A.stop();
    const S = SONGS[name] || SONGS.city;
    const C = compose(S);
    const bpm = S.bpm * (boss ? 1.18 : 1);
    cur = { key, S, C, boss: !!boss, stepDur: 60 / bpm / 4 };
    step = 0;
    nextT = ac.currentTime + 0.06;
    timer = setInterval(schedule, 25);
    schedule();
  };
  A.stop = function () { if (timer) clearInterval(timer); timer = null; cur = null; };
  A.setMusic = function (on) { A.musicOn = on; if (mus) mus.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.05); };
  A.setSfx = function (on) { A.sfxOn = on; if (sfx) sfx.gain.setTargetAtTime(on ? 0.6 : 0, ac.currentTime, 0.05); };

  // Звуки
  A.sfx = function (name) {
    if (!ac || !A.sfxOn) return;
    const t = ac.currentTime;
    switch (name) {
      case 'jump': tone(sfx, 'square', 320, t, 0.13, 0.12, 640); break;
      case 'djump': tone(sfx, 'square', 480, t, 0.14, 0.12, 960); break;
      case 'coin': tone(sfx, 'square', 988, t, 0.06, 0.1); tone(sfx, 'square', 1319, t + 0.06, 0.1, 0.1); break;
      case 'shard': [0, 4, 7, 12, 16].forEach((k, i) => tone(sfx, 'square', mtof(76 + k), t + i * 0.06, 0.12, 0.1)); break;
      case 'heart': tone(sfx, 'triangle', 660, t, 0.1, 0.18); tone(sfx, 'triangle', 880, t + 0.1, 0.16, 0.18); break;
      case 'stomp': noise(sfx, t, 0.12, 0.35, 'bandpass', 500); tone(sfx, 'square', 240, t, 0.12, 0.12, 80); break;
      case 'hurt': tone(sfx, 'sawtooth', 420, t, 0.28, 0.14, 110); break;
      case 'die': [0, -3, -7, -12].forEach((k, i) => tone(sfx, 'square', mtof(64 + k), t + i * 0.1, 0.14, 0.12)); break;
      case 'dash': noise(sfx, t, 0.2, 0.25, 'highpass', 1500); tone(sfx, 'sine', 300, t, 0.18, 0.12, 900); break;
      case 'fire': noise(sfx, t, 0.15, 0.2, 'bandpass', 900); tone(sfx, 'square', 620, t, 0.12, 0.08, 260); break;
      case 'break': noise(sfx, t, 0.25, 0.35, 'lowpass', 1200); break;
      case 'checkpoint': tone(sfx, 'square', 523, t, 0.1, 0.12); tone(sfx, 'square', 784, t + 0.1, 0.18, 0.12); break;
      case 'portal': tone(sfx, 'sine', 300, t, 0.7, 0.2, 1400); [0, 4, 7, 12].forEach((k, i) => tone(sfx, 'triangle', mtof(72 + k), t + 0.2 + i * 0.08, 0.2, 0.1)); break;
      case 'spring': tone(sfx, 'triangle', 200, t, 0.25, 0.2, 800); break;
      case 'shoot': noise(sfx, t, 0.08, 0.12, 'bandpass', 2500); break;
      case 'bossHit': tone(sfx, 'square', 220, t, 0.2, 0.18, 90); noise(sfx, t, 0.2, 0.3, 'bandpass', 700); break;
      case 'bossDie': noise(sfx, t, 1.2, 0.4, 'lowpass', 800); [12, 7, 4, 0, -5].forEach((k, i) => tone(sfx, 'square', mtof(60 + k), t + i * 0.12, 0.2, 0.12)); break;
      case 'slam': tone(sfx, 'sine', 120, t, 0.4, 0.4, 40); noise(sfx, t, 0.3, 0.3, 'lowpass', 400); break;
      case 'click': tone(sfx, 'square', 880, t, 0.04, 0.06); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16, 19].forEach((k, i) => tone(sfx, 'square', mtof(67 + k), t + i * 0.09, 0.14, 0.1)); break;
    }
  };
})();
