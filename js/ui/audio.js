/*
 * Звук и музыка: всё синтезируется на Web Audio, без файлов.
 * Музыка — оригинальная, в духе космической оперы: медь, струнные, литавры, военный барабан.
 * Ни мелодий, ни звуков из фильмов здесь нет — только свои темы и свои эффекты.
 *
 * Audio.music('desert' | 'battle' | null) — фоновая тема (с плавной сменой)
 * Audio.stinger('victory' | 'defeat')     — короткая фраза в конце боя
 * Audio.sfx(name, {pan, side, kind, big})  — эффект; громкость и частота ограничены
 * Браузеры разрешают звук только после касания экрана — движок включается на первое касание.
 */
(function (G) {
  'use strict';
  const A = {};
  const DEF = { music: 0.5, sfx: 0.75, mute: false };
  const prefs = (function () {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem('kolrat.audio') || '{}')); } catch (e) { return Object.assign({}, DEF); }
  })();
  A.prefs = prefs;
  function savePrefs() { try { localStorage.setItem('kolrat.audio', JSON.stringify(prefs)); } catch (e) { /* без хранилища — не страшно */ } }

  let ctx = null, master, musicBus, sfxBus, verbIn, noiseBuf;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = prefs.mute ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = prefs.music; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx; sfxBus.connect(master);
    // Зал: искусственная реверберация из затухающего шума
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    verb.buffer = ir;
    verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.3;
    verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (want && !song) startSong(want);
  }
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) globalThis.addEventListener && addEventListener(ev, unlock, { passive: true });
  if (globalThis.document) document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else if (!prefs.mute) ctx.resume().catch(() => {});
  });
  const live = () => ctx && ctx.state === 'running';

  // ---------- кирпичики ----------
  function osc(type, f, t) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function noise(t, dur) { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(t, Math.random()); n.stop(t + dur); return n; }
  function out(node, dest, pan, wet) {
    let last = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); last.connect(p); last = p; }
    last.connect(dest);
    if (wet) { const w = gain(wet); last.connect(w); w.connect(verbIn); }
  }
  function adsr(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(0.0001, t + a + hold, rel);
  }

  // ---------- инструменты (музыка) ----------
  const INST = {
    // медь: три пилы, фильтр «раскрывается» на атаке
    brass(m, t, dur, vel, dest) {
      const f = mtof(m), lp = filt('lowpass', f * 1.5, 1.4), g = gain(0);
      lp.frequency.setValueAtTime(f * 1.4, t);
      lp.frequency.linearRampToValueAtTime(f * (3 + vel * 5), t + 0.07);
      lp.frequency.setTargetAtTime(f * 2.4, t + 0.1, 0.25);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.13 * vel, t + 0.05);
      g.gain.setTargetAtTime(0.09 * vel, t + 0.06, 0.2);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.09);
      for (const [type, k, d, v] of [['sawtooth', 1, -6, 1], ['sawtooth', 1, 7, 1], ['square', 0.5, 0, 0.35]]) {
        const o = osc(type, f * k, t); o.detune.value = d; const og = gain(v);
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.6);
      }
      lp.connect(g); out(g, dest, 0, 0.35);
    },
    // струнные: мягкая атака, лёгкое вибрато
    strings(m, t, dur, vel, dest, short) {
      const f = mtof(m), lp = filt('lowpass', short ? 2600 : 1700, 0.6), g = gain(0);
      const a = short ? 0.015 : 0.35;
      adsr(g, t, a, 0.06 * vel, Math.max(0.01, dur - a), short ? 0.05 : 0.35);
      const lfo = osc('sine', 5.2, t), lg = gain(short ? 0 : 6); lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 1.5);
      for (const d of [-8, 0, 9]) {
        const o = osc('sawtooth', f, t); o.detune.value = d; lg.connect(o.detune);
        o.connect(lp); o.start(t); o.stop(t + dur + 1.5);
      }
      lp.connect(g); out(g, dest, 0, short ? 0.15 : 0.45);
    },
    bass(m, t, dur, vel, dest) {
      const f = mtof(m), g = gain(0), lp = filt('lowpass', 420, 0.8);
      adsr(g, t, 0.02, 0.2 * vel, dur, 0.15);
      const o = osc('triangle', f, t), o2 = osc('sine', f / 2, t), g2 = gain(0.6);
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
      o.start(t); o2.start(t); o.stop(t + dur + 0.8); o2.stop(t + dur + 0.8);
      out(g, dest, 0, 0.05);
    },
    // литавра: тон с провалом высоты и глухой удар
    timp(m, t, dur, vel, dest) {
      const f = mtof(m), g = gain(0);
      adsr(g, t, 0.005, 0.35 * vel, 0.05, 0.45);
      const o = osc('sine', f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
      o.connect(g); o.start(t); o.stop(t + 2);
      const n = noise(t, 0.15), lp = filt('lowpass', 260), ng = gain(0); adsr(ng, t, 0.003, 0.3 * vel, 0.02, 0.05);
      n.connect(lp); lp.connect(ng); out(ng, dest, 0, 0.3);
      out(g, dest, 0, 0.4);
    },
    snare(m, t, dur, vel, dest) {
      const n = noise(t, 0.25), bp = filt('bandpass', 1900, 0.7), g = gain(0);
      adsr(g, t, 0.002, 0.16 * vel, 0.02, 0.06);
      n.connect(bp); bp.connect(g); out(g, dest, 0.1, 0.2);
      const o = osc('triangle', 190, t), og = gain(0); adsr(og, t, 0.002, 0.08 * vel, 0.01, 0.04);
      o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.3);
    },
    // щипок (арфа-гусли): для пустынной темы
    pluck(m, t, dur, vel, dest) {
      const f = mtof(m), g = gain(0), lp = filt('lowpass', 3000, 0.5);
      adsr(g, t, 0.004, 0.07 * vel, 0.02, 0.35);
      const o = osc('triangle', f, t), o2 = osc('sine', f * 2, t), g2 = gain(0.3);
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
      o.start(t); o2.start(t); o.stop(t + 2); o2.stop(t + 2);
      out(g, dest, (m % 5 - 2) * 0.12, 0.5);
    },
    // тарелка-нарастание к новой части
    swell(m, t, dur, vel, dest) {
      const n = noise(t, dur + 0.3), hp = filt('highpass', 5000, 0.3), g = gain(0.0001);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08 * vel, t + dur); g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
      n.connect(hp); hp.connect(g); out(g, dest, 0, 0.5);
    },
  };

  // ---------- темы (оригинальные) ----------
  // Ноты — MIDI. Каждая тема — функция «что сыграть в такте bar», события в долях такта.
  const CH = { // аккорды для струнных
    Dm: [50, 57, 62, 65], Bb: [46, 53, 58, 62], C: [48, 55, 60, 64], Gm: [43, 50, 55, 58], A: [45, 52, 57, 61], F: [41, 48, 53, 57],
    Cm: [48, 55, 60, 63], Ab: [44, 51, 56, 60], Bb2: [46, 53, 58, 62], G: [43, 50, 55, 59], Fm: [41, 48, 53, 56], Eb: [39, 46, 51, 55],
  };
  const SONGS = {
    // «Песок и тишина»: медленная пустынная тема, ре-дорийский
    desert: {
      bpm: 70,
      bar(b, ev) {
        const prog = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Gm', 'Bb', 'A'];
        const c = CH[prog[b % 8]];
        for (const n of c) ev('strings', n, 0, 4, 0.55);
        ev('bass', c[0] - 12, 0, 3.5, 0.8);
        const cycle = Math.floor(b / 8) % 2;
        // переборы
        if (cycle === 0 || b % 8 < 4) [0, 1, 2, 3, 2, 1].forEach((k, i) => ev('pluck', c[k % c.length] + 12, i * 0.66, 0.5, 0.5 + (i === 0 ? 0.3 : 0)));
        // мелодия валторны — во втором круге
        if (cycle === 1) {
          const mel = {
            4: [[69, 0, 1], [74, 1, 1.5], [72, 2.5, 0.5], [69, 3, 1]],
            5: [[70, 0, 1], [69, 1, 0.5], [67, 1.5, 0.5], [65, 2, 2]],
            6: [[67, 0, 1], [69, 1, 1], [70, 2, 1], [72, 3, 1]],
            7: [[69, 0, 2.5], [64, 2.5, 0.5], [61, 3, 1]],
          }[b % 8];
          if (mel) for (const [n, at, d] of mel) ev('brass', n, at, d, 0.42);
        }
        if (b % 8 === 7) { ev('timp', 38, 2, 1, 0.5); ev('timp', 38, 2.5, 1, 0.6); ev('timp', 38, 3, 1, 0.75); ev('swell', 0, 2, 2, 0.6); }
        if (b % 8 === 0) ev('timp', 38, 0, 2, 0.6);
      },
    },
    // «Песчаная буря»: боевая тема, до минор, остинато струнных, медь, барабан
    battle: {
      bpm: 132,
      bar(b, ev) {
        const A = ['Cm', 'Ab', 'Bb2', 'G'], B = ['Cm', 'Fm', 'G', 'G'];
        const sec = Math.floor(b / 4) % 4; // A A B A'
        const name = (sec === 2 ? B : A)[b % 4];
        const c = CH[name], r = c[0];
        // остинато восьмыми
        [0, 0, 12, 0, 3, 0, 7, 0].forEach((k, i) => ev('strings', r - 12 + k + (name === 'G' && k === 3 ? 1 : 0), i * 0.5, 0.42, i % 2 ? 0.6 : 0.85, true));
        ev('bass', r - 24, 0, 1.8, 0.9); ev('bass', r - 24, 2, 1.8, 0.8);
        ev('timp', r - 24 + (r < 45 ? 12 : 0), 0, 1, 0.9);
        if (b % 2) ev('timp', r - 17, 2, 1, 0.6);
        ev('snare', 0, 1, 0.2, 0.7); ev('snare', 0, 3, 0.2, 0.75);
        if (b % 4 === 3) [3.25, 3.5, 3.75].forEach((at) => ev('snare', 0, at, 0.1, 0.5));
        // аккорды меди
        for (const n of c.slice(1)) { ev('brass', n, 0, 0.55, 0.55); if (sec !== 2) ev('brass', n, 2.5, 0.4, 0.4); }
        // мелодия — в части B
        if (sec === 2) {
          const mel = [
            [[67, 0, 1], [72, 1, 1], [75, 2, 1.5], [74, 3.5, 0.5]],
            [[72, 0, 1], [68, 1, 1], [65, 2, 2]],
            [[67, 0, 1], [71, 1, 1], [74, 2, 1], [77, 3, 1]],
            [[74, 0, 2], [71, 2, 2]],
          ][b % 4];
          for (const [n, at, d] of mel) ev('brass', n, at, d, 0.95);
        }
        if (b % 16 === 15) ev('swell', 0, 2, 2, 0.8);
      },
    },
  };

  // ---------- проигрывание ----------
  let want = null, song = null;
  function startSong(id) {
    if (!init()) return;
    const S = SONGS[id];
    if (!S) return;
    const g = gain(0.0001); g.connect(musicBus);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(1, now + 1.6);
    const st = { id: id, S: S, g: g, bar: 0, next: now + 0.12, timer: null };
    const spb = 60 / S.bpm;
    st.timer = setInterval(() => {
      if (!live()) return;
      while (st.next < ctx.currentTime + 0.3) {
        const t0 = st.next;
        S.bar(st.bar, (inst, n, at, d, vel, extra) => {
          const t = t0 + at * spb;
          if (t < ctx.currentTime - 0.02) return;
          INST[inst](n, t, d * spb, vel, st.g, extra);
        });
        st.bar++;
        st.next += 4 * spb;
      }
    }, 60);
    song = st;
  }
  function stopSong(fade) {
    if (!song) return;
    const st = song; song = null;
    clearInterval(st.timer);
    const now = ctx.currentTime;
    st.g.gain.cancelScheduledValues(now);
    st.g.gain.setValueAtTime(st.g.gain.value, now);
    st.g.gain.exponentialRampToValueAtTime(0.0001, now + (fade || 1.2));
    setTimeout(() => { try { st.g.disconnect(); } catch (e) { /* уже отключён */ } }, ((fade || 1.2) + 2) * 1000);
  }
  A.music = function (id) {
    if (want === id && (song ? song.id === id : !live())) return;
    want = id;
    if (!ctx) return; // включится на первое касание
    if (song && song.id === id) return;
    stopSong(1.2);
    if (id) startSong(id);
  };

  A.stinger = function (kind) {
    if (!live() || prefs.mute) return;
    const t = ctx.currentTime + 0.05, g = gain(1); g.connect(musicBus);
    if (song) { song.g.gain.cancelScheduledValues(t); song.g.gain.setValueAtTime(song.g.gain.value, t); song.g.gain.linearRampToValueAtTime(0.15, t + 0.3); song.g.gain.linearRampToValueAtTime(1, t + 4); }
    if (kind === 'victory') {
      [[60, 0, 0.2], [64, 0.18, 0.2], [67, 0.36, 0.25]].forEach(([n, at, d]) => INST.brass(n, t + at, d, 0.9, g));
      for (const n of [60, 64, 67, 72]) INST.brass(n, t + 0.6, 1.6, 0.9, g);
      for (const n of [48, 55, 64, 72]) INST.strings(n, t + 0.6, 2, 0.8, g);
      [0.5, 0.56, 0.62, 0.68].forEach((at) => INST.timp(36, t + at, 0.2, 0.6, g));
      INST.timp(36, t + 0.6, 1, 1, g);
    } else {
      for (const n of [48, 51, 55]) INST.strings(n, t, 2.4, 0.8, g);
      [[55, 0, 0.6], [51, 0.6, 0.6], [47, 1.2, 1.6]].forEach(([n, at, d]) => INST.brass(n, t + at, d, 0.75, g));
      INST.timp(36, t + 1.2, 1, 0.9, g);
    }
  };

  // ---------- эффекты (свои) ----------
  let win = 0, cnt = 0;
  function budget(max) {
    const now = ctx.currentTime;
    if (now - win > 0.1) { win = now; cnt = 0; }
    return cnt++ < max;
  }
  const SFX = {
    // бластер: короткий «вжик» с падающим тоном; у каждой стороны свой голос
    blaster(o) {
      const t = ctx.currentTime, k = o.kind || 'rifle';
      const hi = o.side === 0 ? 1 : 0.72;
      const f0 = { rifle: 1500, pistol: 1800, heavy: 950, sniper: 2400, droid: 1200, turret: 900 }[k] || 1400;
      const dur = { heavy: 0.22, sniper: 0.32, turret: 0.24 }[k] || 0.16;
      const g = gain(0); adsr(g, t, 0.003, (k === 'heavy' || k === 'turret' ? 0.22 : 0.16) * (o.vol || 1), dur * 0.4, dur * 0.35);
      const a = osc('square', f0 * hi, t); a.frequency.exponentialRampToValueAtTime(f0 * hi * 0.14, t + dur);
      const b = osc('sawtooth', f0 * hi * 1.51, t); b.frequency.exponentialRampToValueAtTime(f0 * hi * 0.2, t + dur);
      const bp = filt('bandpass', f0 * hi, 0.8); bp.frequency.exponentialRampToValueAtTime(f0 * hi * 0.3, t + dur);
      const bg = gain(0.5);
      a.connect(bp); b.connect(bg); bg.connect(bp); bp.connect(g);
      a.start(t); b.start(t); a.stop(t + dur + 0.1); b.stop(t + dur + 0.1);
      out(g, sfxBus, o.pan, 0.12);
    },
    ion(o) {
      const t = ctx.currentTime, g = gain(0); adsr(g, t, 0.005, 0.1, 0.12, 0.06);
      const a = osc('sine', 600, t); a.frequency.linearRampToValueAtTime(1800, t + 0.18);
      const l = osc('square', 40, t), lg = gain(300); l.connect(lg); lg.connect(a.frequency);
      a.connect(g); a.start(t); l.start(t); a.stop(t + 0.3); l.stop(t + 0.3);
      out(g, sfxBus, o.pan, 0.1);
    },
    // пороховое ружьё: хлопок и глухой отзвук
    slug(o) {
      const t = ctx.currentTime, n = noise(t, 0.3), bp = filt('bandpass', 1400, 0.6), g = gain(0);
      adsr(g, t, 0.002, 0.28, 0.01, 0.05); n.connect(bp); bp.connect(g); out(g, sfxBus, o.pan, 0.5);
      const th = osc('sine', 120, t), tg = gain(0); th.frequency.exponentialRampToValueAtTime(50, t + 0.15); adsr(tg, t, 0.002, 0.2, 0.02, 0.06);
      th.connect(tg); out(tg, sfxBus, o.pan); th.start(t); th.stop(t + 0.3);
    },
    melee(o) {
      const t = ctx.currentTime, n = noise(t, 0.25), bp = filt('bandpass', 700, 1.2), g = gain(0);
      bp.frequency.exponentialRampToValueAtTime(2200, t + 0.12);
      adsr(g, t, 0.03, 0.1, 0.05, 0.05); n.connect(bp); bp.connect(g); out(g, sfxBus, o.pan, 0.05);
      const th = osc('sine', 160, t + 0.12), tg = gain(0); th.frequency.exponentialRampToValueAtTime(60, t + 0.25); adsr(tg, t + 0.12, 0.003, 0.25, 0.02, 0.05);
      th.connect(tg); out(tg, sfxBus, o.pan); th.start(t + 0.12); th.stop(t + 0.4);
    },
    hit(o) {
      const t = ctx.currentTime;
      if (o.metal) {
        const p = osc('sine', 2300 + Math.random() * 600, t), g = gain(0); adsr(g, t, 0.002, 0.06, 0.01, 0.07);
        p.connect(g); out(g, sfxBus, o.pan, 0.2); p.start(t); p.stop(t + 0.4);
      }
      const n = noise(t, 0.1), hp = filt('highpass', 1800), g2 = gain(0); adsr(g2, t, 0.002, 0.07, 0.01, 0.02);
      n.connect(hp); hp.connect(g2); out(g2, sfxBus, o.pan);
    },
    // взрыв: шум с падающим фильтром и низкий удар; бочка — мощнее и дольше
    boom(o) {
      const t = ctx.currentTime, big = o.big ? 1.6 : 1;
      const n = noise(t, 1.6 * big), lp = filt('lowpass', 2400, 0.7), g = gain(0);
      lp.frequency.exponentialRampToValueAtTime(140, t + 0.7 * big);
      adsr(g, t, 0.005, 0.5 * Math.min(1.3, big), 0.08, 0.35 * big);
      n.connect(lp); lp.connect(g); out(g, sfxBus, o.pan, 0.6);
      const s = osc('sine', 90, t), sg = gain(0); s.frequency.exponentialRampToValueAtTime(32, t + 0.6 * big);
      adsr(sg, t, 0.004, 0.6, 0.1, 0.3 * big); s.connect(sg); out(sg, sfxBus, o.pan * 0.5, 0.3); s.start(t); s.stop(t + 1.8 * big);
    },
    // таймер гранаты: два писка
    nade(o) {
      const t = ctx.currentTime;
      for (const at of [0, 0.12]) {
        const p = osc('square', 2100, t + at), g = gain(0); adsr(g, t + at, 0.002, 0.035, 0.04, 0.01);
        p.connect(g); out(g, sfxBus, o.pan); p.start(t + at); p.stop(t + at + 0.1);
      }
    },
    // приказ по рации: щелчок, писк, шорох эфира
    order() {
      const t = ctx.currentTime;
      const n = noise(t, 0.18), bp = filt('bandpass', 2600, 1.5), g = gain(0); adsr(g, t, 0.003, 0.05, 0.08, 0.04);
      n.connect(bp); bp.connect(g); out(g, sfxBus, 0, 0.05);
      [[1046, 0.02], [1397, 0.1]].forEach(([f, at]) => {
        const p = osc('square', f, t + at), pg = gain(0), lp = filt('lowpass', 3000);
        adsr(pg, t + at, 0.003, 0.05, 0.05, 0.02); p.connect(lp); lp.connect(pg); out(pg, sfxBus); p.start(t + at); p.stop(t + at + 0.15);
      });
    },
    // рёв чудовища и боевой клич — свои синтезированные голоса
    roar(o) {
      const t = ctx.currentTime, s = osc('sawtooth', 85, t), l = osc('sine', 7, t), lg = gain(16);
      l.connect(lg); lg.connect(s.frequency); s.frequency.linearRampToValueAtTime(60, t + 1.6);
      const lp = filt('lowpass', 700, 2), g = gain(0); adsr(g, t, 0.15, 0.3, 0.9, 0.35);
      s.connect(lp); lp.connect(g); out(g, sfxBus, o.pan, 0.5);
      const n = noise(t, 1.8), nb = filt('bandpass', 400, 0.6), ng = gain(0); adsr(ng, t, 0.2, 0.15, 0.9, 0.3);
      n.connect(nb); nb.connect(ng); out(ng, sfxBus, o.pan, 0.4);
      s.start(t); l.start(t); s.stop(t + 2.2); l.stop(t + 2.2);
    },
    cry(o) {
      const t = ctx.currentTime, s = osc('sawtooth', 360, t), l = osc('sine', 11, t), lg = gain(110);
      l.connect(lg); lg.connect(s.frequency); s.frequency.linearRampToValueAtTime(520, t + 0.5); s.frequency.linearRampToValueAtTime(300, t + 1);
      const bp = filt('bandpass', 950, 1.4), g = gain(0); adsr(g, t, 0.06, 0.12, 0.75, 0.15);
      s.connect(bp); bp.connect(g); out(g, sfxBus, o.pan, 0.45);
      s.start(t); l.start(t); s.stop(t + 1.3); l.stop(t + 1.3);
    },
    click() {
      const t = ctx.currentTime, p = osc('sine', 1250, t), g = gain(0); adsr(g, t, 0.001, 0.035, 0.005, 0.015);
      p.connect(g); out(g, sfxBus); p.start(t); p.stop(t + 0.08);
    },
    // вызов по связи — событие
    alert() {
      const t = ctx.currentTime;
      [[880, 0], [1320, 0.11], [880, 0.22]].forEach(([f, at]) => {
        const p = osc('sine', f, t + at), g = gain(0); adsr(g, t + at, 0.004, 0.07, 0.06, 0.03);
        p.connect(g); out(g, sfxBus, 0, 0.2); p.start(t + at); p.stop(t + at + 0.2);
      });
    },
    // смена суток: колокольчик и порыв ветра
    day() {
      const t = ctx.currentTime;
      for (const [f, at] of [[659, 0], [988, 0.12], [1319, 0.24]]) {
        const p = osc('sine', f, t + at), g = gain(0); adsr(g, t + at, 0.005, 0.06, 0.05, 0.6);
        p.connect(g); out(g, sfxBus, 0, 0.6); p.start(t + at); p.stop(t + at + 2.5);
      }
      const n = noise(t, 2.2), bp = filt('bandpass', 500, 0.5), g = gain(0);
      bp.frequency.linearRampToValueAtTime(1400, t + 1); bp.frequency.linearRampToValueAtTime(400, t + 2);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.9); g.gain.linearRampToValueAtTime(0.0001, t + 2.1);
      n.connect(bp); bp.connect(g); out(g, sfxBus, 0, 0.2);
    },
    // стройка в лагере: лязг металла
    build() {
      const t = ctx.currentTime;
      for (const [f, at] of [[310, 0], [460, 0.09], [620, 0.18]]) {
        const p = osc('triangle', f, t + at), g = gain(0); adsr(g, t + at, 0.002, 0.07, 0.02, 0.12);
        p.connect(g); out(g, sfxBus, 0, 0.25); p.start(t + at); p.stop(t + at + 0.5);
        const n = noise(t + at, 0.06), hp = filt('highpass', 2500), ng = gain(0); adsr(ng, t + at, 0.001, 0.05, 0.01, 0.02);
        n.connect(hp); hp.connect(ng); out(ng, sfxBus);
      }
    },
  };

  A.sfx = function (name, o) {
    if (!live() || prefs.mute || prefs.sfx <= 0) return;
    const fn = SFX[name];
    if (!fn) return;
    o = o || {};
    if (!budget(o.max || 8)) return;
    try { fn(o); } catch (e) { /* звук не обязателен */ }
  };

  // ---------- настройки ----------
  A.set = function (key, v) {
    prefs[key] = v;
    savePrefs();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (key === 'music') musicBus.gain.setTargetAtTime(v, now, 0.05);
    if (key === 'sfx') sfxBus.gain.setTargetAtTime(v, now, 0.05);
    if (key === 'mute') { master.gain.setTargetAtTime(v ? 0 : 0.9, now, 0.05); if (!v) unlock(); }
  };
  A.available = () => !!(globalThis.AudioContext || globalThis.webkitAudioContext);

  G.Audio = A;
})(globalThis.G = globalThis.G || {});
