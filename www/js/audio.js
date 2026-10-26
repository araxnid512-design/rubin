// Звук: всё синтезируется через WebAudio, без файлов.
// Контекст создаётся после первого касания (требование мобильных браузеров).
(function () {
  const KEY = 'garrison-sound';
  let ctx = null, master = null, noiseBuf = null;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* нет хранилища */ }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.6 : 0;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  window.addEventListener('pointerdown', ensure, { capture: true });
  window.addEventListener('keydown', ensure, { capture: true });

  function ready() { return ctx && enabled; }

  function env(gain, t, attack, decay, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function noise(dur, filterType, freq, peak, vol) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    env(g, t, 0.003, dur, peak * (vol == null ? 1 : vol));
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function tone(type, f0, f1, dur, peak, vol) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    env(g, t, 0.01, dur, peak * (vol == null ? 1 : vol));
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const Sound = {
    shot(heavy) {
      noise(heavy ? 0.22 : 0.16, 'lowpass', heavy ? 1800 : 2600, heavy ? 0.9 : 0.7);
      tone('square', heavy ? 140 : 220, 50, 0.08, 0.25);
    },
    swing() { noise(0.12, 'bandpass', 900, 0.25); },
    // Очередь из автомата: три выстрела подряд. enemy — чужие стволы звучат глуше.
    burst(enemy) {
      if (!ready()) return;
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          noise(0.09, 'lowpass', enemy ? 1400 : 2400, enemy ? 0.35 : 0.45);
          tone('square', enemy ? 120 : 170, 50, 0.05, 0.12);
        }, i * 75);
      }
    },
    alarm() {
      if (!ready()) return;
      for (let i = 0; i < 3; i++) setTimeout(() => tone('sawtooth', 440, 660, 0.45, 0.18), i * 600);
    },
    hit() { noise(0.08, 'lowpass', 500, 0.6); tone('sine', 120, 60, 0.08, 0.3); },
    hurt() { tone('sawtooth', 180, 90, 0.18, 0.25); },
    // vol — 0..1 по расстоянию.
    growl(vol, deep) {
      if (!ready() || vol < 0.03) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const base = deep ? 55 : 85 + Math.random() * 30;
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 0.7, t + 0.6);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9 + Math.random() * 6;
      const lg = ctx.createGain();
      lg.gain.value = 18;
      lfo.connect(lg).connect(o.frequency);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 600;
      const g = ctx.createGain();
      env(g, t, 0.08, 0.6, 0.35 * vol);
      o.connect(f).connect(g).connect(master);
      o.start(t); lfo.start(t);
      o.stop(t + 0.75); lfo.stop(t + 0.75);
    },
    pickup() { tone('triangle', 600, 900, 0.09, 0.2); },
    broken() { tone('square', 300, 80, 0.3, 0.25); noise(0.2, 'highpass', 2000, 0.3); },
    quest() { tone('triangle', 520, 520, 0.12, 0.2); setTimeout(() => tone('triangle', 780, 780, 0.2, 0.2), 120); },
    step(vol) { noise(0.04, 'lowpass', 400, 0.12, vol); },
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* нет хранилища */ }
      ensure();
      if (master) master.gain.value = enabled ? 0.6 : 0;
      return enabled;
    },
  };

  window.Sound = Sound;
})();
