'use strict';
/* Запуск, игровой цикл, сохранения, адаптивное качество */
(function () {
  const $ = id => document.getElementById(id), cv = $('cv');
  const QH = [860, 700, 560];        // высота буфера кадра для уровней качества
  G.qMode = 0;                       // 0 авто, 1 высокая, 2 средняя, 3 низкая
  let qLevel = 0;
  G.paused = true;

  function resize() {
    const w = innerWidth, h = innerHeight, dpr = devicePixelRatio || 1;
    const s = Math.min(dpr, QH[qLevel] / h);
    cv.width = Math.max(2, Math.round(w * s)); cv.height = Math.max(2, Math.round(h * s));
    const V = G.view; V.w = cv.width; V.h = cv.height; V.css = s; V.zoom = V.h / (G.TILE * 9.4);
    G.ui.layout();
  }
  G.setQuality = function (m) { G.qMode = m; qLevel = m === 0 ? 0 : m - 1; resize(); };
  addEventListener('resize', resize);

  /* ---------- Сохранения ---------- */
  G.saveSettings = function () {
    try { localStorage.setItem('rubin_cfg', JSON.stringify({ s: G.soundOn, q: G.qMode, f: G.ui.showFps })); } catch (e) { }
  };
  G.save = function () {
    if (!G.p || G.p.dead) return;
    const p = G.p, res = [], st = [], fl = [];
    for (const o of G.objs) { if (!o.a) res.push(o.i, 0, Math.round(o.t - G.time)); else if (o.hp < (o.K.hp || 1)) res.push(o.i, o.hp, 0); }
    for (let i = 0; i < G.cells.length; i++) { const s = G.cells[i]; if (s) st.push(s.inv ? [s.k, s.tx, s.ty, s.inv] : [s.k, s.tx, s.ty]); if (G.floors[i]) fl.push(i); }
    const d = { v: 1, time: G.time, quest: G.quest, stats: G.stats, res, st, fl,
      p: { x: p.x, y: p.y, hp: p.hp, maxhp: p.maxhp, food: p.food, water: p.water, xp: p.xp, lvl: p.lvl, inv: p.inv, armor: p.armor, hand: p.hand } };
    try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(d)); } catch (e) { }
  };
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(G.SAVE_KEY)); } catch (e) { }
    if (!d || d.v !== 1 || !d.p) return false;
    try {
      G.newGame();
      G.cells.fill(null); G.floors.fill(0); G.fires.length = 0;
      for (const i of d.fl) G.floors[i] = 1;
      for (const s of d.st) G.addStruct(s[0], s[1], s[2], s[3] ? { inv: s[3] } : null);
      G.time = d.time; G.day = Math.floor(G.time / G.DAYLEN) + 1; G.quest = d.quest; Object.assign(G.stats, d.stats);
      for (let i = 0; i < d.res.length; i += 3) {
        const o = G.objs[d.res[i]]; if (!o) continue;
        if (d.res[i + 1] > 0) o.hp = d.res[i + 1]; else { o.a = false; o.t = G.time + d.res[i + 2]; }
      }
      Object.assign(G.p, d.p); G.p.sy = G.p.y; G.cam.x = G.p.x; G.cam.y = G.p.y;
      return true;
    } catch (e) { return false; }
  }
  G.resetGame = function () {
    try { localStorage.removeItem(G.SAVE_KEY); } catch (e) { }
    G.newGame(); G.uiDirty = true;
  };

  /* ---------- Цикл ---------- */
  let last = 0, fAcc = 0, fN = 0, fps = 60, slowT = 0, warm = 4, saveT = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    let dt = (t - last) / 1000; last = t;
    if (!(dt > 0)) return;
    fAcc += dt; fN++;
    if (fAcc >= 0.5) {
      fps = Math.round(fN / fAcc);
      // авто-качество: если кадры стабильно проседают — снижаем разрешение
      if (!G.paused && G.qMode === 0 && warm <= 0) {
        if (fps < 50) { slowT += fAcc; if (slowT > 2.5 && qLevel < 2) { qLevel++; slowT = 0; warm = 3; resize(); } } else slowT = 0;
      }
      if (warm > 0) warm -= fAcc;
      fAcc = 0; fN = 0;
    }
    if (dt > 0.1) dt = 0.1;
    if (G.hitstop > 0) G.hitstop -= dt;
    else if (!G.paused) {
      G.update(dt);
      saveT += dt; if (saveT > 20) { saveT = 0; G.save(); }
    }
    G.render(G.paused ? 0 : dt);
    G.ui.frame(dt, fps);
  }

  function boot() {
    G.ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
    try { const c = JSON.parse(localStorage.getItem('rubin_cfg')); if (c) { G.soundOn = c.s; G.qMode = c.q | 0; G.ui.showFps = c.f; qLevel = G.qMode ? G.qMode - 1 : 0; } } catch (e) { }
    G.initArt(); G.initRender();
    const had = load();
    if (!had) G.newGame();
    G.makeMinimap();
    resize();
    if (had) $('btn-new').classList.remove('hide');
    if (had) $('btn-play').textContent = 'ПРОДОЛЖИТЬ';
    const start = () => { G.audioInit(); $('title').classList.add('hide'); document.body.classList.remove('title'); G.ui.layout(); G.paused = false; warm = 4; G.uiDirty = true; };
    $('btn-play').addEventListener('click', start);
    $('btn-new').addEventListener('click', () => { G.resetGame(); start(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { G.save(); G.input.act = false; G.input.mx = G.input.my = 0; } else last = performance.now(); });
    addEventListener('pagehide', G.save);
    requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  }
  boot();
})();
