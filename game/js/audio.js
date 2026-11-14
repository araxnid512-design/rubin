'use strict';
/* Звуки: настоящие записи оружия (game/sfx/*.ogg, см. sfx/CREDITS.md) и синтез (существа, шаги, интерфейс,
   а также запасной голос, пока записи не загрузились) */
(function (DW) {
  const S = {};
  let ctx = null, master = null, noiseBuf = null, out = null, sbus = null;
  let offline = false;  // идёт отрисовка в OfflineAudioContext (S._render)

  /* общий выход через мягкий компрессор, чтобы взрывы не хрипели; записи — через свою шину sbus */
  function outChain(c) {
    out = c.createDynamicsCompressor();
    out.threshold.value = -12; out.knee.value = 10; out.ratio.value = 4; out.attack.value = 0.004; out.release.value = 0.25;
    out.connect(c.destination);
    master = c.createGain();
    master.gain.value = 0.45;
    master.connect(out);
    sbus = c.createGain();
    sbus.gain.value = SBUS;
    sbus.connect(master);
  }
  function init() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      outChain(ctx);
      const len = Math.floor(ctx.sampleRate * 1.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (DW.Music) DW.Music._init();
      return true;
    } catch (e) { ctx = null; return false; }
  }
  /* можно ли звучать сейчас */
  function live() { return DW.settings.sound && ctx && (offline || ctx.state !== 'suspended'); }

  let paused = false;
  S.unlock = function () {
    paused = false;
    if (!init()) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    bridge();
    if (DW.settings.sound) S.preload();
  };
  /* приложение свёрнуто — глушим звук целиком; при возврате — продолжаем */
  S.suspend = function () { paused = true; if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } };
  S.resume = function () { if (!ctx) return; paused = false; if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } } };
  S.ctx = function () { return ctx; };
  S.out = function () { return out; };
  S.noiseBuf = function () { return noiseBuf; };
  S.isPaused = function () { return paused; };

  function noise(t, dur, freq, q, gain, type) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.05);
  }
  function tone(t, dur, f0, f1, type, gain) {
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* ---------- Выстрел по слоям ----------
     щелчок (короткий высокий треск), корпус (полосовой шум), удар (низкий тон с падением), хвост (глухой гул),
     эхо (свёртка со сгенерированным откликом: на улице коротко, в помещении и пещере — гулко), хрип (перегруз),
     затвор (механика после выстрела). Параметры — DW.WT (правятся в «Мастерской оружия»). */
  let verb = null, verbIn = null, shaper = null, lastTink = 0;
  function reverb() {
    if (verb) return verbIn;
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2) * (t < 0.012 ? t / 0.012 : 1); }
    }
    verb = ctx.createConvolver(); verb.buffer = buf;
    verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    verbIn.connect(verb); verb.connect(lp); lp.connect(master);
    return verbIn;
  }
  function distCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return c;
  }
  function nz(t, dur, type, freq, q, gain, dst, a) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (a || 0.002)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(dst);
    src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.05);
    return g;
  }
  function tn(t, dur, f0, f1, type, gain, dst) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  }
  /* ---------- Настоящие записи: game/sfx/*.ogg ----------
     Выстрелы, перезарядка, гильзы, попадания, РПГ и взрывы — записи CC0 и общественного достояния (источники —
     sfx/CREDITS.md, сборка — tools/sfx/build.py). Грузятся после первого касания (S.unlock) через XHR +
     decodeAudioData: в APK игра открыта с file://, там fetch() не работает. Пока запись не загружена (или её нет),
     звучит прежний синтез. Имя файла: группа + номер дубля (rifle_2), дальний дубль — с «f» (rifle_f1). */
  const SFX_DIR = 'sfx/';
  const SBUS = 0.7;  // громкость записей относительно синтеза
  const MAXV = 24;    // одновременных голосов-записей (очереди нескольких стрелков не душат телефон)
  const FILES = ('rifle_1 rifle_2 rifle_3 smg_1 smg_2 smg_3 ak2_1 ak2_2 lmg_1 lmg_2 lmg_3 sniper_1 sniper_2 ' +
    'shotgun_1 shotgun_2 shotgun_3 pistol_1 pistol_2 pistol9_1 pistol9_2 smg9_1 smg9_2 hsniper_1 hsniper_2 hlmg_1 hlmg_2 ' +
    'supp_1 supp_2 rifle_f1 rifle_f2 smg_f1 smg_f2 ak2_f1 lmg_f1 sniper_f1 shotgun_f1 pistol_f1 pistol9_f1 smg9_f1 ' +
    'hsniper_f1 hlmg_f1 mech_pump mech_bolt expl_1 expl_2 expl_3 gren_1 gren_2 rpg_1 rpg_2 rpg_3 rpg_fly ' +
    'imp_stone_1 imp_stone_2 imp_metal_1 imp_metal_2 imp_wood_1 imp_wood_2 imp_dirt_1 imp_dirt_2 imp_flesh_1 imp_flesh_2 ' +
    'imp_glass_1 imp_glass_2 cas_1 cas_2 cas_3 cas_sh rl_mag rl_drum rl_box rl_bolt rl_pump rl_click dry').split(' ');
  const BUF = {};    // имя → AudioBuffer
  const GROUP = {};  // группа → имена: rifle_2 → rifle, rifle_f1 → rifle_f, imp_metal_1 → imp_metal, rl_mag → rl_mag
  FILES.forEach(function (n) { const g = n.replace(/_?\d+$/, ''); (GROUP[g] = GROUP[g] || []).push(n); });
  // ствол → набор записей (чужие стволы — по D.WEAPONS[id].snd)
  const FAM = { ppsh: 'smg', vityaz: 'smg9', ak: 'rifle', turret: 'rifle', ak2: 'ak2', ak74m: 'ak2', sniper: 'sniper', hsniper: 'hsniper',
    lmg: 'lmg', pkp: 'lmg', hlmg: 'hlmg', shotgun: 'shotgun', obrez: 'shotgun', tt: 'pistol', gsh18: 'pistol9', val: 'supp', vss: 'supp' };
  const FAM_SND = { smg: 'smg', rifle: 'rifle', ak2: 'ak2', sniper: 'sniper', hsniper: 'hsniper', lmg: 'lmg', hlmg: 'hlmg', shotgun: 'shotgun', pistol: 'pistol', supp: 'supp' };
  function famOf(id) {
    if (FAM[id]) return FAM[id];
    const W = DW.D && DW.D.WEAPONS && DW.D.WEAPONS[id];
    return (W && FAM_SND[W.snd]) || FAM_SND[id] || null;
  }
  // глушитель на обычном стволе: запись «Вала», выше для мелкого калибра, ниже для крупного
  const QTONE = { smg: 1.12, smg9: 1.15, pistol: 1.2, pistol9: 1.2, rifle: 1, ak2: 1.05, sniper: 0.92, lmg: 0.95, hsniper: 0.8, hlmg: 0.82, shotgun: 0.85 };
  // поправка громкости набора (в сборке у высокого пика RMS не дотянут без пережатия атаки)
  const FAMG = { smg: 1.12, hsniper: 1.19, hlmg: 1.12, shotgun: 1.19, pistol9: 1.19, smg9: 1.19 };
  // механика после выстрела (WT: mech, mechD): цевьё помпового дробовика, затвор КСВК
  const MECH = { shotgun: 'mech_pump', hsniper: 'mech_bolt' };
  // попадание по материалу
  const IMP = { metal: 'imp_metal', wood: 'imp_wood', sand: 'imp_dirt', dirt: 'imp_dirt', cloth: 'imp_dirt', flesh: 'imp_flesh', glass: 'imp_glass', crystal: 'imp_glass' };

  const stat = { ok: 0, fail: [] };
  let loadP = null;
  function xhrBuffer(url) {
    return new Promise(function (res, rej) {
      const x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = 'arraybuffer';
      x.onload = function () { if ((x.status === 200 || x.status === 0) && x.response && x.response.byteLength) res(x.response); else rej(new Error('XHR ' + x.status)); };
      x.onerror = function () { rej(new Error('XHR ошибка')); };
      x.send();
    });
  }
  function decode(ab) {
    return new Promise(function (res, rej) {
      try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); } catch (e) { rej(e); }
    });
  }
  /* загрузить все записи (по 4 сразу, выстрелы первыми); промис — { ok, fail: [имена], total } */
  S.preload = function () {
    if (loadP) return loadP;
    if (!ctx) return Promise.resolve({ ok: 0, fail: [], total: FILES.length });
    let i = 0;
    const next = function () {
      if (i >= FILES.length) return Promise.resolve();
      const n = FILES[i++];
      return xhrBuffer(SFX_DIR + n + '.ogg').then(decode).then(function (b) { BUF[n] = b; stat.ok++; }, function () { stat.fail.push(n); }).then(next);
    };
    loadP = Promise.all([next(), next(), next(), next()]).then(function () { return { ok: stat.ok, fail: stat.fail.slice(), total: FILES.length }; });
    return loadP;
  };
  /* для проверок: что загружено и какой набор у ствола */
  S.samples = function () { return { files: FILES.slice(), groups: GROUP, loaded: Object.keys(BUF), fail: stat.fail.slice(), voices: voices.length, fam: famOf }; };

  const voices = [];
  function cleanVoices(now) { for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= now) voices.splice(i, 1); }
  function fadeOut(v, t, d) {
    try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, d / 3); v.src.stop(t + d); } catch (e) { /* ignore */ }
    v.end = Math.min(v.end, t + d);
  }
  /* место для нового голоса: если все заняты — гасим самый неважный и старый (не важнее нового) */
  function freeVoice(pri) {
    const now = ctx.currentTime;
    cleanVoices(now);
    if (voices.length < MAXV) return true;
    let k = -1;
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      if (v.pri > pri) continue;
      if (k < 0 || v.pri < voices[k].pri || (v.pri === voices[k].pri && v.t0 < voices[k].t0)) k = i;
    }
    if (k < 0) return false;
    fadeOut(voices[k], now, 0.03);
    voices.splice(k, 1);
    return true;
  }
  /* сыграть запись: o = { t (время ctx), rate, gain, lp (Гц, 0 — без фильтра), send (на эхо), pri, off (с) } */
  function playBuf(buf, o) {
    if (!buf || !freeVoice(o.pri || 1)) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const rate = o.rate || 1;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = o.gain;
    src.connect(g);
    let node = g;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 0.5; g.connect(f); node = f; }
    node.connect(sbus);
    if (o.send > 0.005) { const s = ctx.createGain(); s.gain.value = o.send; node.connect(s); s.connect(reverb()); }
    const t = Math.max(o.t || 0, ctx.currentTime), off = Math.min(o.off || 0, buf.duration * 0.5);
    src.start(t, off);
    const v = { src: src, g: g, gain: o.gain, t0: t, end: t + (buf.duration - off) / rate + 0.05, pri: o.pri || 1 };
    src.onended = function () { const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); try { node.disconnect(); } catch (e) { /* ignore */ } };
    voices.push(v);
    return v;
  }
  const lastPick = {};
  /* случайный дубль группы (не тот же, что в прошлый раз); S.useSamples = false — только синтез */
  S.useSamples = true;
  function pick(g) {
    const L = S.useSamples && GROUP[g];
    if (!L) return null;
    const ok = L.filter(function (n) { return BUF[n]; });
    if (!ok.length) return null;
    let n = ok[Math.floor(Math.random() * ok.length)];
    if (ok.length > 1 && n === lastPick[g]) n = ok[(ok.indexOf(n) + 1) % ok.length];
    lastPick[g] = n;
    return BUF[n];
  }
  function indoors() {
    const B = DW.BT && DW.BT.get && DW.BT.get();
    return !!(B && (B.tod === 'interior' || B.tod === 'cave'));
  }
  /* очередь: хвост предыдущего выстрела того же ствола уводим под новый — меньше голосов, без каши;
     полный хвост остаётся у последнего выстрела очереди */
  const burst = {};
  function duck(v, t) {
    try {
      v.g.gain.setValueAtTime(v.gain, t + 0.004);
      v.g.gain.exponentialRampToValueAtTime(v.gain * 0.3, t + 0.06);
      v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      v.src.stop(t + 0.32);
      v.end = Math.min(v.end, t + 0.32);
    } catch (e) { /* ignore */ }
  }
  /* выстрел записью; false — записи нет, играть синтез */
  function shotSample(id, o) {
    const base = famOf(id);
    if (!base) return false;
    const quiet = !!o.quiet && base !== 'supp';  // у «Вала» и ВСС тишина уже в записи
    const fam = quiet ? 'supp' : base;
    const far = Math.max(0, Math.min(1, o.far || 0));
    let buf = far >= 0.25 && !quiet ? pick(fam + '_f') : null;  // враг на той стороне поля — запись «с середины стрельбища»
    const farRec = !!buf;
    if (!buf) buf = pick(fam);
    if (!buf) return false;
    // правки «Мастерской оружия» (громкость и тон) — относительно стандартных, разброс тона — свой у ствола
    const P = DW.WT && DW.WT.has(id) ? DW.WT.get(id).snd : null, P0 = P ? DW.WT.DEF[id].snd : null;
    const kv = P && P0.vol ? P.vol / P0.vol : 1, kp = P && P0.pitch ? P.pitch / P0.pitch : 1;
    const jit = Math.max(0.025, (P && P.jit) || 0);
    const rate = kp * (quiet ? QTONE[base] || 1 : 1) * (1 + (Math.random() - 0.5) * 1.4 * jit);
    const t = ctx.currentTime + 0.01 + (o.when || 0);
    const gain = kv * (FAMG[fam] || 1) * (0.88 + Math.random() * 0.24) * (farRec ? 1 - (far - 0.25) * 0.6 : 1 - far * 0.6);
    const lp = farRec ? (far > 0.5 ? 10000 - far * 5000 : 0) : (far > 0.05 ? 9000 - far * 6500 : 0);
    const ph = DW.WT ? DW.WT.phys() : { echoOut: 0.25, echoIn: 0.9 };
    const inside = o.env === 'in';
    const send = (P ? P.echo : 0.45) * (inside ? ph.echoIn : ph.echoOut) * (inside ? 0.9 : 0.5) * (quiet ? 0.4 : 1);
    const prev = burst[id];
    if (prev && t > prev.t0 && t - prev.t0 < 0.35) duck(prev, t);
    const v = playBuf(buf, { t: t, rate: rate, gain: gain, lp: lp, send: send, pri: 2, off: Math.random() * 0.002 });
    if (v) burst[id] = v;
    const mk = MECH[id];
    if (mk && !quiet && P && P.mech > 0.01 && P.mechD > 0) playBuf(BUF[mk], { t: t + P.mechD / 1000, gain: 0.45 * P.mech * (1 - far * 0.6), lp: lp, pri: 1 });
    return true;
  }
  /* выстрел РПГ: вышибной заряд и запуск двигателя, затем ракета уходит (тон и громкость падают — эффект Доплера);
     dur — время полёта, с */
  S.rocket = function (dur) {
    if (!live()) return;
    const t = ctx.currentTime + 0.01, d = Math.max(0.2, dur || 0.4);
    const inside = indoors();
    const b = pick('rpg');
    if (!b) { noise(t, 0.5, 700, 0.6, 0.7); noise(t + 0.05, 0.9, 1800, 0.7, 0.35); return; }
    playBuf(b, { t: t, gain: 0.95, rate: 0.96 + Math.random() * 0.08, send: inside ? 0.5 : 0.12, pri: 3 });
    const v = playBuf(BUF.rpg_fly, { t: t + 0.1, gain: 0.0001, pri: 2 });
    if (v) {
      v.src.playbackRate.setValueAtTime(1.15, t + 0.1);
      v.src.playbackRate.linearRampToValueAtTime(0.8, t + 0.1 + d + 0.4);
      v.g.gain.setValueAtTime(0.0001, t + 0.1);
      v.g.gain.exponentialRampToValueAtTime(0.7, t + 0.18);
      v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1 + d + 0.45);
      v.src.stop(t + 0.1 + d + 0.5);
      v.end = t + 0.1 + d + 0.5;
    }
  };
  /* взрыв: брошенная граната — граната, остальное (ракета, бочка, бак) — большой взрыв */
  let lastThrow = -9;
  function explode() {
    const now = ctx.currentTime;
    const gren = now - lastThrow < 2.5;
    const b = (gren && pick('gren')) || pick('expl');
    if (!b) return false;
    lastThrow = -9;
    playBuf(b, { t: now + 0.01, rate: 0.93 + Math.random() * 0.14, gain: gren ? 0.9 : 1, send: indoors() ? 0.45 : 0.1, pri: 3 });
    return true;
  }
  /* Мост к отрисовке боя: у выстрела РПГ нет своего вызова звука — он звучит, когда TR.projectileFx пускает ракету;
     бросок гранаты запоминаем, чтобы следующий взрыв звучал гранатой. Ставится при первом касании, когда все
     модули загружены (TR3 зовёт TR2.projectileFx, так что мост работает и в 3D). Появится прямой вызов
     DW.SFX.rocket() — мост можно убрать. */
  function bridge() {
    const T = DW.TR2 || DW.TR;
    if (!T || typeof T.projectileFx !== 'function' || T.projectileFx._sfx) return;
    const pf = T.projectileFx;
    const w = function (x0, y0, x1, y1, kind) {
      try {
        if (kind === 'rocket') S.rocket(0.4 / ((DW.settings && DW.settings.speed) || 1));
        else if (ctx) lastThrow = ctx.currentTime;
      } catch (e) { /* ignore */ }
      return pf.apply(this, arguments);
    };
    w._sfx = true;
    T.projectileFx = w;
  }
  /* для проверок: отрисовать звуки в OfflineAudioContext — fn вызывает обычные S.shot / S.play …
     (записи — уже загруженные); промис — AudioBuffer */
  S._render = function (sec, fn, rate) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const sr = rate || 44100, oc = new OAC(2, Math.ceil(sec * sr), sr);
    const keep = [ctx, out, master, sbus, verb, verbIn, lastTink, lastImp, voices.splice(0), Object.assign({}, burst)];
    ctx = oc; verb = null; verbIn = null; lastTink = -9; lastImp = -9; offline = true;
    outChain(oc);
    if (!noiseBuf) {
      noiseBuf = oc.createBuffer(1, Math.floor(sr * 1.5), sr);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    try { fn(S); } finally {
      ctx = keep[0]; out = keep[1]; master = keep[2]; sbus = keep[3]; verb = keep[4]; verbIn = keep[5]; lastTink = keep[6]; lastImp = keep[7];
      voices.length = 0; Array.prototype.push.apply(voices, keep[8]);
      for (const k in burst) delete burst[k];
      Object.assign(burst, keep[9]);
      offline = false;
    }
    return oc.startRendering();
  };

  /* один выстрел ствола id; o: { when (с от сейчас), far (0..1 — дальше тише и глуше), env ('out'|'in'), quiet,
     p (свои параметры синтеза — так звучит предпрослушка «Мастерской оружия») } */
  S.shot = function (id, o) {
    if (!live()) return;
    o = o || {};
    if (!o.p) { try { if (shotSample(id, o)) return; } catch (e) { /* ниже — синтез */ } }
    let P = o.p || (DW.WT ? DW.WT.get(id).snd : null);
    if (!P) { S.play('rifle'); return; }
    try {
      const t = ctx.currentTime + 0.01 + (o.when || 0);
      const far = o.far || 0, ph = DW.WT ? DW.WT.phys() : { echoOut: 0.25, echoIn: 0.9 };
      const pt = P.pitch * (1 + (Math.random() - 0.5) * 2 * (P.jit || 0));
      const out = ctx.createGain(); out.gain.value = P.vol * (1 - far * 0.6) * (o.quiet ? 0.35 : 1);
      if (o.quiet) P = Object.assign({}, P, { crack: P.crack * 0.15, tail: P.tail * 0.3, echo: P.echo * 0.3, thump: P.thump * 0.6, bodyF: P.bodyF * 0.7 });
      // перегруз — общий на выстрел
      let dst = out;
      if (P.dist > 0.02) {
        const ws = ctx.createWaveShaper(); ws.curve = distCurve(P.dist * 8); ws.oversample = 'none';
        ws.connect(out); dst = ws;
      }
      if (far > 0.05) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000 - far * 6500; lp.connect(dst); dst = lp; }
      out.connect(master);
      // эхо
      const env = o.env === 'in' ? ph.echoIn : ph.echoOut;
      if (P.echo > 0.01 && env > 0.01) { const sg = ctx.createGain(); sg.gain.value = P.echo * env * (0.6 + far * 0.8); out.connect(sg); sg.connect(reverb()); }
      if (P.crack > 0.01) nz(t, 0.018, 'highpass', 3200 * pt, 0.7, 0.9 * P.crack, dst, 0.0008);
      if (P.body > 0.01) nz(t, P.bodyD, 'bandpass', P.bodyF * pt, 0.9, 0.85 * P.body, dst, 0.0015);
      if (P.thump > 0.01) tn(t, P.thumpD, P.thumpF * 1.9 * pt, P.thumpF * 0.45 * pt, 'triangle', 0.55 * P.thump, dst);
      if (P.tail > 0.01) nz(t + 0.008, P.tailD, 'lowpass', 520 * pt, 0.6, 0.45 * P.tail, dst, 0.02);
      if (P.mech > 0.01 && P.mechD > 0) {
        const tm = t + P.mechD / 1000;
        nz(tm, 0.05, 'bandpass', 2600, 4, 0.35 * P.mech, out); tn(tm, 0.03, 900, 500, 'square', 0.05 * P.mech, out);
        nz(tm + 0.12, 0.06, 'bandpass', 2100, 4, 0.4 * P.mech, out); tn(tm + 0.12, 0.035, 700, 380, 'square', 0.06 * P.mech, out);
      }
    } catch (e) { /* ignore */ }
  };
  /* звон гильзы о землю (не чаще 12 раз в секунду); big — крупная гильза или гильза дробовика */
  S.tink = function (big) {
    if (!live()) return;
    const now = ctx.currentTime;
    if (now - lastTink < 0.08) return;
    lastTink = now;
    const k = DW.WT ? DW.WT.phys().tink : 0.5;
    if (k <= 0.01) return;
    try {
      const sh = big && Math.random() < 0.5, b = sh ? pick('cas_sh') : pick('cas');
      if (b) { playBuf(b, { t: now + 0.005, rate: (big && !sh ? 0.75 : 1) * (0.9 + Math.random() * 0.25), gain: 0.75 * k * (0.6 + Math.random() * 0.5), pri: 0 }); return; }
    } catch (e) { /* ниже — синтез */ }
    const f = (big ? 2600 : 3800) * (0.85 + Math.random() * 0.3);
    tone(now + 0.005, 0.09, f, f * 0.97, 'sine', 0.035 * k); tone(now + 0.005, 0.05, f * 1.51, f * 1.48, 'sine', 0.02 * k);
  };
  /* перезарядка по устройству ствола (WT.RK): диск, магазин, короб, затвор, помпа */
  S.reload = function (kind) {
    if (!live()) return;
    try {
      const b = pick('rl_' + (kind || 'mag')) || pick('rl_mag');
      if (b) { playBuf(b, { t: ctx.currentTime + 0.01, rate: 0.97 + Math.random() * 0.06, gain: 0.3, send: indoors() ? 0.08 : 0, pri: 1 }); return; }
    } catch (e) { /* ниже — синтез */ }
    const t = ctx.currentTime + 0.01;
    const clk = function (dt, f, g) { noise(t + dt, 0.045, f, 4, g); tone(t + dt, 0.03, f / 3, f / 5, 'square', g * 0.15); };
    try {
      switch (kind) {
        case 'drum': clk(0, 1800, 0.3); clk(0.22, 1500, 0.35); noise(t + 0.3, 0.25, 2800, 6, 0.08); clk(0.6, 2000, 0.4); clk(0.8, 2600, 0.35); break;
        case 'box': clk(0, 1600, 0.35); noise(t + 0.15, 0.35, 3500, 3, 0.12); clk(0.55, 1400, 0.4); clk(0.8, 2400, 0.4); break;
        case 'bolt': clk(0, 2400, 0.35); noise(t + 0.06, 0.08, 3000, 3, 0.25); clk(0.18, 2000, 0.4); break;
        case 'pump': clk(0, 1700, 0.3); clk(0.25, 1700, 0.3); noise(t + 0.45, 0.07, 1400, 2, 0.4); clk(0.58, 1200, 0.5); break;
        default: clk(0, 1700, 0.35); clk(0.32, 1500, 0.4); clk(0.55, 2400, 0.4); noise(t + 0.6, 0.06, 3000, 3, 0.25); break;
      }
    } catch (e) { /* ignore */ }
  };

  /* шаги по разной земле: мягкий грунт, бетон, металл, доски, щебень, пещера, плоть */
  let lastStep = 0, lastImp = 0, lastRadio = 0;
  S.step = function (mat, heavy) {
    if (!DW.settings.sound || !ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    if (now - lastStep < 0.11) return;
    lastStep = now;
    const t = now + 0.005, k = heavy ? 1.8 : 1, v = (0.85 + Math.random() * 0.3) * k;
    try {
      switch (mat) {
        case 'concrete': noise(t, 0.05, 1800, 1.4, 0.12 * v); tone(t, 0.04, 140, 90, 'triangle', 0.05 * v); break;
        case 'metal': noise(t, 0.06, 2600, 3, 0.1 * v); tone(t, 0.12, 420 + Math.random() * 60, 380, 'triangle', 0.04 * v); break;
        case 'wood': tone(t, 0.07, 180, 120, 'triangle', 0.09 * v); noise(t, 0.05, 900, 1.5, 0.07 * v); break;
        case 'rubble': for (let i = 0; i < 3; i++) noise(t + i * 0.018, 0.035, 2200 + i * 500, 2, 0.06 * v); break;
        case 'cave': noise(t, 0.08, 700, 1.2, 0.1 * v); noise(t + 0.09, 0.12, 600, 1.5, 0.03 * v); break;
        case 'flesh': noise(t, 0.09, 500, 2, 0.1 * v); tone(t, 0.08, 90, 60, 'sine', 0.05 * v); break;
        default: noise(t, 0.07, 600, 0.9, 0.1 * v); tone(t, 0.05, 110, 70, 'sine', 0.05 * v); break;
      }
    } catch (e) { /* ignore */ }
  };
  /* попадание по укрытию: камень и кирпич — крошка, металл — звон и рикошет, дерево — глухой стук, мешки — шлепок */
  S.impact = function (mat) {
    if (!live()) return;
    const now = ctx.currentTime;
    if (now - lastImp < 0.05) return;
    lastImp = now;
    const t = now + 0.005;
    try {
      const b = pick(IMP[mat] || 'imp_stone');
      if (b) {
        playBuf(b, { t: t, rate: 0.88 + Math.random() * 0.24, gain: 0.32 + Math.random() * 0.15, send: indoors() ? 0.1 : 0, pri: 1 });
        // визг рикошета от металла — синтез (записи рикошета под CC0 не нашлось)
        if (mat === 'metal' && Math.random() < 0.35) tone(t + 0.03, 0.3, 2600 + Math.random() * 900, 800, 'sine', 0.03);
        return;
      }
      if (mat === 'metal') { tone(t, 0.18, 1900 + Math.random() * 600, 1500, 'sine', 0.06); noise(t, 0.04, 4000, 2, 0.12); if (Math.random() < 0.4) tone(t + 0.02, 0.25, 2600, 900, 'sine', 0.04); }
      else if (mat === 'wood') { tone(t, 0.07, 220, 140, 'triangle', 0.1); noise(t, 0.06, 1200, 1.5, 0.1); }
      else if (mat === 'sand' || mat === 'dirt') { noise(t, 0.09, 500, 0.8, 0.14); }
      else if (mat === 'glass') { for (let i = 0; i < 4; i++) tone(t + i * 0.02, 0.12, 3000 + Math.random() * 2500, 2800, 'sine', 0.025); }
      else { noise(t, 0.05, 2400, 1.2, 0.16); noise(t + 0.03, 0.1, 1200, 1, 0.06); }
    } catch (e) { /* ignore */ }
  };
  /* «голос по рации»: щелчок, неразборчивая речь (гласные-форманты), щелчок. seed — свой тембр у каждого */
  S.radio = function (seed, enemy, len) {
    if (!DW.settings.sound || !ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    if (now - lastRadio < 1.1) return;
    lastRadio = now;
    try {
      const t0 = now + 0.01;
      const bus = ctx.createGain(); bus.gain.value = enemy ? 0.5 : 0.42;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = enemy ? 900 : 1500; bp.Q.value = enemy ? 0.5 : 0.9;
      bus.connect(bp); bp.connect(master);
      if (!enemy) { noise(t0, 0.05, 3000, 2, 0.1); }
      const f0 = (enemy ? 85 : 100) + ((seed * 37) % 50);
      const n = len || (3 + Math.floor(Math.random() * 4));
      let t = t0 + 0.06;
      const V = [[730, 1090], [530, 1840], [400, 1600], [570, 840], [300, 870], [660, 1700]];
      for (let i = 0; i < n; i++) {
        const d = 0.07 + Math.random() * 0.08, vw = V[Math.floor(Math.random() * V.length)];
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0 * (1 + (Math.random() - 0.5) * 0.12), t); o.frequency.linearRampToValueAtTime(f0 * (0.9 + Math.random() * 0.2), t + d);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.015); g.gain.setValueAtTime(0.2, t + d * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + d);
        o.connect(g);
        vw.forEach(function (fq, j) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 6; const fg = ctx.createGain(); fg.gain.value = j ? 0.6 : 1; g.connect(f); f.connect(fg); fg.connect(bus); });
        o.start(t); o.stop(t + d + 0.02);
        t += d + (Math.random() < 0.25 ? 0.06 : 0.015);
      }
      if (!enemy) { noise(t + 0.02, 0.06, 2600, 2, 0.08); tone(t + 0.02, 0.03, 1200, 1000, 'square', 0.02); }
    } catch (e) { /* ignore */ }
  };

  /* S.play с именем ствола (турель, ролики) — очередь записями: [ствол, выстрелов, темп, мс] */
  const PLAYGUN = { rifle: ['ak', 3, 90], pistol: ['tt', 2, 160], supp: ['val', 3, 100], smg: ['ppsh', 7, 46], ak2: ['ak2', 3, 80],
    hsniper: ['hsniper', 1, 0], hlmg: ['hlmg', 5, 85], lmg: ['lmg', 6, 70], shotgun: ['shotgun', 1, 0], sniper: ['sniper', 1, 0] };
  /* записью, если она есть: true — сыграно */
  function playSample(name, t) {
    const G = PLAYGUN[name];
    if (G) {
      if (!pick(famOf(G[0]))) return false;
      const env = indoors() ? 'in' : 'out';
      for (let i = 0; i < G[1]; i++) shotSample(G[0], { when: i * G[2] / 1000, env: env });
      return true;
    }
    let b = null;
    switch (name) {
      case 'explosion': return explode();
      case 'rocket': if (!pick('rpg')) return false; S.rocket(); return true;
      case 'hit': b = pick('imp_flesh'); if (b) playBuf(b, { t: t, rate: 0.85 + Math.random() * 0.25, gain: 0.32, pri: 1 }); break;
      case 'reload': b = pick('rl_click'); if (b) playBuf(b, { t: t, rate: 0.97 + Math.random() * 0.06, gain: 0.3, pri: 1 }); break;
      case 'dry': b = pick('dry'); if (b) playBuf(b, { t: t, rate: 0.95 + Math.random() * 0.1, gain: 0.45, pri: 1 }); break;
    }
    return !!b;
  }
  S.play = function (name) {
    if (!live()) return;
    const t = ctx.currentTime + 0.01;
    try {
      if (playSample(name, t)) return;
    } catch (e) { /* ниже — синтез */ }
    try {
      switch (name) {
        case 'rocket':
          noise(t, 0.5, 700, 0.6, 0.7); noise(t + 0.05, 0.9, 1800, 0.7, 0.35);
          break;
        case 'dry':
          tone(t, 0.03, 1800, 1200, 'square', 0.05); noise(t, 0.03, 3500, 4, 0.2);
          break;
        case 'rifle':
          for (let i = 0; i < 3; i++) { noise(t + i * 0.09, 0.13, 1300, 0.8, 0.55); tone(t + i * 0.09, 0.08, 170, 60, 'square', 0.1); }
          break;
        case 'pistol':
          for (let i = 0; i < 2; i++) { noise(t + i * 0.16, 0.09, 2100, 1.1, 0.45); tone(t + i * 0.16, 0.05, 260, 90, 'square', 0.08); }
          break;
        case 'supp':
          // бесшумное оружие: глухие хлопки и лязг затвора
          for (let i = 0; i < 3; i++) { noise(t + i * 0.1, 0.05, 700, 1.4, 0.22); noise(t + i * 0.1 + 0.02, 0.03, 3800, 4, 0.12); }
          break;
        case 'smg':
          for (let i = 0; i < 7; i++) { noise(t + i * 0.046, 0.07, 1700, 0.9, 0.42); tone(t + i * 0.046, 0.045, 210, 80, 'square', 0.07); }
          break;
        case 'ak2':
          for (let i = 0; i < 3; i++) { noise(t + i * 0.08, 0.11, 1800, 0.9, 0.5); tone(t + i * 0.08, 0.06, 240, 70, 'square', 0.09); }
          break;
        case 'hsniper':
          noise(t, 0.8, 900, 0.4, 1); tone(t, 0.35, 140, 30, 'sawtooth', 0.28); noise(t + 0.05, 0.6, 300, 0.5, 0.5);
          break;
        case 'hlmg':
          for (let i = 0; i < 5; i++) { noise(t + i * 0.085, 0.16, 600, 0.6, 0.7); tone(t + i * 0.085, 0.1, 100, 35, 'square', 0.16); }
          break;
        case 'lmg':
          for (let i = 0; i < 6; i++) { noise(t + i * 0.07, 0.11, 900, 0.8, 0.55); tone(t + i * 0.07, 0.07, 140, 50, 'square', 0.1); }
          break;
        case 'shotgun':
          noise(t, 0.4, 650, 0.6, 0.9); tone(t, 0.22, 120, 40, 'square', 0.22);
          noise(t + 0.35, 0.06, 2500, 3, 0.25); noise(t + 0.5, 0.06, 2000, 3, 0.25);
          break;
        case 'sniper':
          noise(t, 0.55, 2200, 0.5, 0.8); tone(t, 0.16, 320, 50, 'sawtooth', 0.18);
          break;
        case 'spit':
          noise(t, 0.3, 3200, 2, 0.3); tone(t, 0.25, 420, 110, 'sine', 0.15);
          break;
        case 'beam':
          tone(t, 0.35, 1400, 300, 'sawtooth', 0.12); tone(t, 0.35, 700, 150, 'square', 0.06);
          break;
        case 'melee':
          noise(t, 0.16, 500, 1, 0.5); tone(t, 0.16, 95, 45, 'sawtooth', 0.2);
          break;
        case 'growl':
          tone(t, 0.7, 75, 52, 'sawtooth', 0.16); noise(t, 0.6, 300, 1.5, 0.25, 'lowpass');
          break;
        case 'explosion':
          noise(t, 1.3, 220, 0.5, 1.0, 'lowpass'); tone(t, 0.7, 85, 28, 'sine', 0.55);
          break;
        case 'hit':
          tone(t, 0.08, 220, 80, 'square', 0.09);
          break;
        case 'click':
          tone(t, 0.05, 900, 600, 'sine', 0.07);
          break;
        case 'portal':
          tone(t, 1.3, 180, 820, 'sine', 0.14); tone(t + 0.12, 1.2, 270, 1250, 'triangle', 0.07);
          break;
        case 'alert':
          tone(t, 0.14, 660, 660, 'square', 0.07); tone(t + 0.18, 0.16, 880, 880, 'square', 0.07);
          break;
        case 'pickup':
          tone(t, 0.12, 900, 1500, 'sine', 0.12); tone(t + 0.08, 0.16, 1300, 2100, 'sine', 0.09);
          break;
        case 'reload':
          noise(t, 0.05, 3000, 3, 0.3); noise(t + 0.16, 0.06, 2400, 3, 0.35);
          break;
        case 'death':
          tone(t, 0.55, 230, 60, 'sawtooth', 0.1);
          break;
        case 'build':
          noise(t, 0.1, 800, 2, 0.4); noise(t + 0.18, 0.1, 700, 2, 0.4); noise(t + 0.36, 0.1, 900, 2, 0.4);
          break;
        case 'step':
          tone(t, 0.25, 120, 90, 'triangle', 0.08);
          break;
        default:
          break;
      }
    } catch (e) { /* ignore */ }
  };

  DW.SFX = S;
})(window.DW);
