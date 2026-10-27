// Звук и музыка: всё синтезируется через WebAudio, без файлов.
// Контекст создаётся после первого касания (требование мобильных браузеров).
// Шины: эффекты, мотор и музыка → компрессор → выход; эффекты и музыка — с лёгким эхом.
(function () {
  const KEY = 'styx-road-sound', MKEY = 'styx-road-music';
  let ctx = null, out = null, sfx = null, eng = null, mus = null, verb = null, noiseBuf = null, engineNodes = null;
  let enabled = true, musicOn = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; musicOn = localStorage.getItem(MKEY) !== 'off'; } catch (e) { /* нет хранилища */ }
  const A = () => window.CONFIG.AUDIO;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && !window.Platform.paused) ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    out = ctx.createGain();
    out.connect(comp);
    // Эхо: свёртка с затухающим шумом — мягкий «объём» без файлов.
    verb = ctx.createConvolver();
    const len = Math.round(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const verbGain = ctx.createGain(); verbGain.gain.value = 0.35;
    verb.connect(verbGain).connect(out);
    sfx = bus(A().sfx, 0.12);
    eng = bus(A().engine, 0);
    mus = bus(0, 0.22);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    Music.tick();
    return true;
  }
  window.addEventListener('pointerdown', ensure, { capture: true });
  window.addEventListener('keydown', ensure, { capture: true });

  function bus(level, send) {
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(out);
    if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(verb); }
    return g;
  }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfx.gain.setTargetAtTime(enabled ? A().sfx : 0, t, 0.05);
    eng.gain.setTargetAtTime(enabled ? A().engine : 0, t, 0.05);
    mus.gain.setTargetAtTime(musicOn ? A().music : 0, t, 0.3);
  }

  function ready() { return ctx && enabled; }

  function env(gain, t, attack, decay, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // Шумовой удар: фильтр, длительность, громкость. to — шина (по умолчанию эффекты).
  function noise(dur, type, freq, peak, opt) {
    const o = opt || {};
    const t = (o.at || ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    env(g, t, o.attack || 0.003, dur, peak);
    src.connect(f).connect(g).connect(o.to || sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.1);
  }

  // Тон со спадом высоты (удары, писк, колокольчик).
  function tone(type, f0, f1, dur, peak, opt) {
    const o = opt || {};
    const t = (o.at || ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node = node.connect(f); }
    const g = ctx.createGain();
    env(g, t, o.attack || 0.005, dur, peak);
    node.connect(g).connect(o.to || sfx);
    osc.start(t);
    osc.stop(t + (o.attack || 0.005) + dur + 0.05);
  }

  const vary = (x, k) => x * (1 + (Math.random() - 0.5) * k);

  const Sound = {
    // Выстрел пулемёта: сухой щелчок и короткий хлопок, без визга.
    shot(heavy) {
      if (!ready()) return;
      noise(heavy ? 0.12 : 0.07, 'bandpass', vary(heavy ? 900 : 1500, 0.2), heavy ? 0.5 : 0.32, { q: 0.6 });
      tone('sine', heavy ? 120 : 170, 55, heavy ? 0.1 : 0.06, heavy ? 0.35 : 0.22);
    },
    hit() { if (!ready()) return; noise(0.08, 'lowpass', 600, 0.35); tone('sine', 120, 60, 0.08, 0.25); },
    // Сбили заражённого: глухой шлепок с хрустом.
    crunch(vol) {
      if (!ready()) return;
      const v = Math.min(1, vol || 1);
      noise(0.1, 'bandpass', vary(700, 0.3), 0.45 * v, { q: 1.2 });
      noise(0.05, 'highpass', 2500, 0.12 * v, { at: ctx.currentTime + 0.01 });
      tone('sine', vary(110, 0.2), 45, 0.12, 0.4 * v);
    },
    thud(vol) {
      if (!ready()) return;
      const v = Math.min(1, vol || 1);
      tone('sine', 75, 32, 0.28, 0.55 * v);
      noise(0.16, 'lowpass', 240, 0.35 * v);
    },
    // Приземление: мягкий удар подвески, громче при сильном падении.
    land(vol) {
      if (!ready()) return;
      const v = Math.min(1, vol);
      tone('sine', 90, 40, 0.2, 0.4 * v);
      noise(0.12, 'lowpass', 400, 0.25 * v);
    },
    // Взрыв мины.
    boom() {
      if (!ready()) return;
      tone('sine', 70, 24, 0.7, 0.8);
      noise(0.7, 'lowpass', 900, 0.6, { sweep: 120 });
      noise(0.15, 'highpass', 1800, 0.2);
    },
    // Подбор: короткий колокольчик на случайной ноте пентатоники.
    pickup(kind) {
      if (!ready()) return;
      const notes = [880, 988, 1175, 1319, 1480];
      const f = kind === 'pearl' ? 1760 : kind === 'peas' ? 1319 : notes[Math.floor(Math.random() * notes.length)];
      tone('sine', f, f, 0.22, 0.16);
      tone('sine', f * 2.01, f * 2.01, 0.12, 0.05);
      if (kind === 'pearl' || kind === 'peas') tone('sine', f * 1.5, f * 1.5, 0.3, 0.12, { at: ctx.currentTime + 0.08 });
    },
    broken() { if (!ready()) return; tone('triangle', 440, 330, 0.18, 0.18); tone('triangle', 330, 220, 0.25, 0.18, { at: ctx.currentTime + 0.18 }); },
    nitro() { if (!ready()) return; noise(0.5, 'bandpass', 500, 0.25, { sweep: 2200, attack: 0.05, q: 1.5 }); },
    flame() { if (!ready()) return; noise(0.32, 'lowpass', 800, 0.22, { attack: 0.04, rate: 0.6 }); },
    saw() { if (!ready()) return; tone('triangle', vary(520, 0.05), 480, 0.16, 0.07, { lp: 2500 }); noise(0.1, 'bandpass', 3000, 0.06, { q: 2 }); },
    click() { if (!ready()) return; tone('sine', 1200, 900, 0.04, 0.08); },
    // Доехали до стаба: короткая мажорная фанфара.
    win() {
      if (!ready()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.35, 0.18, { at: ctx.currentTime + i * 0.12, lp: 3000 }));
    },
    // Машина разбита или перевернулась: нисходящий мотив.
    lose() {
      if (!ready()) return;
      [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.4, 0.16, { at: ctx.currentTime + i * 0.2, lp: 1800 }));
    },
    get enabled() { return enabled; },
    get musicOn() { return musicOn; },

    // Мотор: мягкое урчание — треугольник с обертоном и сабом, пульсация цилиндров,
    // приглушено фильтром. Высота — от оборотов (0..1), громкость — от газа.
    engine(rpm, throttle) {
      if (!ctx) return;
      if (!engineNodes) {
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator();
        o1.type = 'triangle'; o2.type = 'sine'; sub.type = 'sine';
        const g2 = ctx.createGain(); g2.gain.value = 0.3;
        const gs = ctx.createGain(); gs.gain.value = 0.6;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 0.5;
        // Пульсация: громкость дышит в такт вспышкам в цилиндрах.
        const pulse = ctx.createGain(); pulse.gain.value = 0.8;
        const lfo = ctx.createOscillator(); lfo.type = 'sine';
        const depth = ctx.createGain(); depth.gain.value = 0.2;
        lfo.connect(depth).connect(pulse.gain);
        const g = ctx.createGain(); g.gain.value = 0;
        o1.connect(f); o2.connect(g2).connect(f); sub.connect(gs).connect(f);
        f.connect(pulse).connect(g).connect(eng);
        for (const o of [o1, o2, sub, lfo]) o.start();
        engineNodes = { o1, o2, sub, lfo, f, g };
      }
      const t = ctx.currentTime, E = A().engineTone;
      const base = E.idle + rpm * E.range;
      const n = engineNodes;
      n.o1.frequency.setTargetAtTime(base, t, 0.08);
      n.o2.frequency.setTargetAtTime(base * 2, t, 0.08);
      n.sub.frequency.setTargetAtTime(base * 0.5, t, 0.08);
      n.lfo.frequency.setTargetAtTime(base * 0.25, t, 0.08);
      n.f.frequency.setTargetAtTime(220 + rpm * 520 + throttle * 220, t, 0.1);
      n.g.gain.setTargetAtTime(E.volIdle + throttle * E.volGas, t, 0.12);
    },
    engineOff() {
      if (engineNodes && ctx) engineNodes.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* нет хранилища */ }
      ensure();
      applyVolumes();
      return enabled;
    },
    toggleMusic() {
      musicOn = !musicOn;
      try { localStorage.setItem(MKEY, musicOn ? 'on' : 'off'); } catch (e) { /* нет хранилища */ }
      ensure();
      applyVolumes();
      return musicOn;
    },
  };

  // --- Музыка ---
  // Боевая: барабаны, бас, арпеджио и подклад по аккордам минорной прогрессии i–VI–VII–v.
  // Спокойная (стаб, меню): только подклад и редкие колокольчики.
  // Ноты планируются заранее с запасом (lookahead), чтобы не сбивался ритм.
  const PROG = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]];   // полутона от тоники: i, VI, VII, v
  const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0];
  const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
  const ARP = [[0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2], [0, 2, 1, 2, 0, 0, 2, 1, 0, 2, 1, 2, 2, 1, 0, 1]];
  const Music = {
    mode: 'off', root: 50, bpm: 128, boss: false, step: 0, next: 0, timer: 0,

    // mode: 'battle' | 'calm' | 'off'; level — номер уровня: своя тональность и темп.
    play(mode, level) {
      const M = A().musicLevels[level || 0] || A().musicLevels[0];
      if (mode === this.mode && (mode !== 'battle' || (this.root === M.root && this.bpm === M.bpm))) return;
      this.mode = mode;
      this.boss = false;
      if (mode === 'battle') { this.root = M.root; this.bpm = M.bpm; } else { this.root = 50; this.bpm = 72; }
      this.step = 0;
      if (ctx) this.next = ctx.currentTime + 0.1;
      this.tick();
    },
    setBoss(on) { this.boss = !!on; },

    tick() {
      clearTimeout(this.timer);
      if (!ctx || this.mode === 'off') return;
      if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
      const dur = 60 / this.bpm / 4;
      while (this.next < ctx.currentTime + 0.15) {
        if (musicOn && !window.Platform.paused) this.note(this.step, this.next, dur);
        this.next += dur;
        this.step = (this.step + 1) % 256;
      }
      this.timer = setTimeout(() => this.tick(), 30);
    },

    note(step, t, dur) {
      const s = step % 16, bar = Math.floor(step / 16) % 4, chord = PROG[bar];
      const hz = (semi) => 440 * Math.pow(2, (this.root + semi - 69) / 12);
      // Подклад: аккорд на весь такт, мягкие пилы за фильтром.
      if (s === 0) {
        for (const semi of chord) {
          for (const det of [-6, 6]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = hz(semi + 12);
            o.detune.value = det;
            const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.mode === 'calm' ? 700 : 1000;
            const g = ctx.createGain();
            const len = dur * 16;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(this.mode === 'calm' ? 0.025 : 0.018, t + len * 0.3);
            g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.05);
            o.connect(f).connect(g).connect(mus);
            o.start(t); o.stop(t + len * 1.1);
          }
        }
      }
      if (this.mode === 'calm') {
        // Редкие колокольчики по нотам аккорда.
        if ((s === 0 || s === 6 || s === 10) && Math.random() < 0.55) {
          const f = hz(chord[Math.floor(Math.random() * 3)] + 24);
          tone('sine', f, f, 1.2, 0.05, { at: t, to: mus });
        }
        return;
      }
      // Боевая: барабаны.
      if (KICK[s]) { tone('sine', 150, 42, 0.22, 0.55, { at: t, to: mus }); }
      if (SNARE[s] && !(s === 15 && bar !== 3)) {
        noise(0.14, 'bandpass', 1800, 0.28, { at: t, to: mus, q: 0.7 });
        tone('triangle', 200, 160, 0.08, 0.12, { at: t, to: mus });
      }
      if (s % 2 === 0) noise(s % 4 === 2 ? 0.05 : 0.03, 'highpass', 7000, s % 4 === 2 ? 0.1 : 0.06, { at: t, to: mus });
      // Бас: восьмые с октавным скачком.
      if (s % 2 === 0) {
        const f = hz(chord[0] - 12 + (s % 4 === 2 ? 12 : 0));
        tone('sawtooth', f, f, dur * 1.6, 0.13, { at: t, to: mus, lp: 420 });
      }
      // Арпеджио; у босса — громче и октавой выше, плюс тарелки.
      const pat = ARP[Math.floor(step / 64) % 2];
      const f = hz(chord[pat[s]] + (this.boss ? 24 : 12));
      tone('square', f, f, dur * 0.9, this.boss ? 0.05 : 0.032, { at: t, to: mus, lp: this.boss ? 2600 : 1600 });
      if (this.boss && s === 0) noise(0.6, 'highpass', 5000, 0.12, { at: t, to: mus });
      if (this.boss && (s === 3 || s === 11)) tone('sine', 110, 50, 0.2, 0.35, { at: t, to: mus });
    },
  };

  // Свернули приложение или пауза — тишина; вернулись — звук снова.
  window.Platform.on('pause', () => { if (ctx) ctx.suspend(); });
  window.Platform.on('resume', () => { if (ctx) ctx.resume(); });

  window.Sound = Sound;
  window.Music = Music;
})();
