'use strict';
/* Голоса героинь.
   1) Живая речь — системный синтезатор речи телефона (через мост AndroidTTS) или Web Speech в браузере;
      у каждой героини свой тембр и темп.
   2) Голосовые эмоции — смешки, вздохи, «ой!», «хмф!» — синтезируются формантным синтезом и работают всегда. */
(function () {
  // базовая высота голоса (Гц) и параметры речи [тон, темп]
  const F0 = { fox: 250, slime: 295, harpy: 320, lamia: 200, dryad: 215, minotaur: 185, vampire: 205, valkyrie: 228, neko: 272, snow: 300, witch: 232, mermaid: 258, frog: 245, ghost: 312, dragon: 172 };
  const TTS = { fox: [1.25, 1.08], slime: [1.5, 1.0], harpy: [1.6, 1.2], lamia: [0.9, 0.85], dryad: [1.05, 0.8], minotaur: [0.85, 0.9], vampire: [0.8, 0.9], valkyrie: [1.0, 1.05], neko: [1.35, 1.0], snow: [1.45, 0.9],
    witch: [1.1, 1.0], mermaid: [1.2, 0.95], frog: [1.3, 1.15], ghost: [1.55, 0.85], dragon: [0.7, 0.9] };
  const VOW = { a: [850, 1250], i: [320, 2400], u: [340, 850], e: [520, 1950], o: [520, 950], m: [260, 1100] };
  U.ttsOn = true;

  /* ---------- Формантный «голос» ---------- */
  // один слог: гласная, длительность, высота в начале и конце (в долях от F0), громкость, придыхание
  function syl(ac, out, nb, t, f0, vow, dur, p0, p1, vol, breath) {
    const F = VOW[vow], o = ac.createOscillator(), g = ac.createGain(), mix = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * p0, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f0 * p1), t + dur);
    const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5.5; vg.gain.value = f0 * 0.012; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + dur + 0.05);
    for (let k = 0; k < 2; k++) { const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = F[k]; bp.Q.value = k ? 9 : 6; const bg = ac.createGain(); bg.gain.value = k ? 0.55 : 1; o.connect(bp); bp.connect(bg); bg.connect(mix); }
    if (breath) { const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain(); n.buffer = nb; nf.type = 'bandpass'; nf.frequency.value = F[1]; nf.Q.value = 1.2; ng.gain.value = breath; n.connect(nf); nf.connect(ng); ng.connect(mix); n.start(t, Math.random()); n.stop(t + dur + 0.05); }
    mix.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.3)); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.18);
    g.connect(out); o.start(t); o.stop(t + dur + 0.1);
  }
  // эмоции → последовательность слогов [гласная, начало, длительность, p0, p1, громкость, придыхание]
  const EMO = {
    giggle: [['i', 0, 0.075, 1.25, 1.35, 0.5, 0.15], ['i', 0.11, 0.075, 1.4, 1.5, 0.5, 0.15], ['i', 0.22, 0.09, 1.3, 1.15, 0.45, 0.15]],
    sigh: [['a', 0, 0.34, 1.2, 0.85, 0.42, 0.5]],
    hmph: [['m', 0, 0.09, 1.0, 0.95, 0.5, 0.2], ['u', 0.1, 0.11, 0.9, 0.72, 0.5, 0.35]],
    oh: [['o', 0, 0.17, 1.05, 1.55, 0.5, 0.15]],
    hehe: [['e', 0, 0.1, 0.95, 0.9, 0.45, 0.25], ['e', 0.15, 0.13, 0.9, 0.78, 0.45, 0.25]],
    yawn: [['a', 0, 0.3, 0.95, 1.1, 0.35, 0.4], ['o', 0.28, 0.35, 1.1, 0.75, 0.3, 0.5]],
    mm: [['m', 0, 0.36, 0.95, 1.12, 0.5, 0.1]],
    ai: [['a', 0, 0.1, 1.5, 1.6, 0.5, 0.2], ['i', 0.09, 0.13, 1.6, 1.3, 0.45, 0.2]],
    ha: [['a', 0, 0.11, 1.3, 1.05, 0.55, 0.3]],
    hi: [['i', 0, 0.1, 1.2, 1.4, 0.45, 0.1]]
  };
  const BY_EXPR = { happy: 'giggle', blush: 'sigh', angry: 'hmph', surprised: 'oh', smug: 'hehe', sleepy: 'yawn', love: 'mm', kiss: 'mm', wink: 'hehe', hurt: 'ai', normal: 'hi' };
  let lastEmo = 0;
  U.emote = function (id, kind) {
    const au = U._audio(); if (!au || !U.soundOn || au.ac.state !== 'running') return;
    const now = au.ac.currentTime; if (now - lastEmo < 0.12) return; lastEmo = now;
    const seq = EMO[kind] || EMO[BY_EXPR[kind]] || EMO.hi, f0 = (F0[id] || 230) * (0.97 + Math.random() * 0.06);
    const out = au.ac.createGain(); out.gain.value = 0.34; out.connect(au.master);
    for (const s of seq) syl(au.ac, out, au.nb, now + 0.02 + s[1], f0, s[0], s[2], s[3], s[4], s[5], s[6]);
    // особые звуки
    if (id === 'neko' && (kind === 'love' || kind === 'mm' || kind === 'blush')) for (let i = 0; i < 9; i++) syl(au.ac, out, au.nb, now + 0.05 + i * 0.045, 60, 'm', 0.04, 1, 1, 0.5, 0.2);
    if (id === 'frog' && (kind === 'happy' || kind === 'giggle')) { syl(au.ac, out, au.nb, now + 0.4, f0 * 0.5, 'a', 0.09, 0.8, 1.3, 0.5, 0.1); syl(au.ac, out, au.nb, now + 0.5, f0 * 0.5, 'a', 0.12, 1.3, 0.8, 0.5, 0.1); }
    setTimeout(() => { try { out.disconnect(); } catch (e) { } }, 1500);
  };

  /* ---------- Живая речь ---------- */
  const clean = t => t.replace(/\*[^*]*\*/g, ' ').replace(/[«»"]/g, '').replace(/…/g, '. ').replace(/\s+/g, ' ').trim();
  U.ttsAvailable = function () {
    try { if (window.AndroidTTS && AndroidTTS.ready()) return true; } catch (e) { }
    return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  };
  U.speak = function (id, text) {
    if (!U.soundOn || !U.ttsOn) return false;
    const v = TTS[id] || [1.1, 1], t = clean(text); if (!t) return false;
    try { if (window.AndroidTTS && AndroidTTS.ready()) { AndroidTTS.speak(t, v[0], v[1]); return true; } } catch (e) { }
    try {
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; u.pitch = Math.min(2, v[0]); u.rate = v[1];
        const ru = speechSynthesis.getVoices().find(q => /^ru/i.test(q.lang)); if (ru) u.voice = ru; else if (speechSynthesis.getVoices().length) return false;
        speechSynthesis.speak(u); return true;
      }
    } catch (e) { }
    return false;
  };
  U.shutUp = function () {
    try { if (window.AndroidTTS) AndroidTTS.stop(); } catch (e) { }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { }
  };
})();
