'use strict';
/* Запуск, камера, сохранение, игровой цикл */
(function () {
  const $ = id => document.getElementById(id), cv = $('cv'), G = window.G = {};
  const KEY = 'rubin_shelter_v2', QH = [900, 720, 560];
  G.view = { w: 2, h: 2, css: 1 }; G.q = 0; G.fps = true; G.paused = true;

  function resize() {
    const w = innerWidth, h = innerHeight, s = Math.min(devicePixelRatio || 1, QH[G.q] / h);
    cv.width = Math.max(2, Math.round(w * s)); cv.height = Math.max(2, Math.round(h * s));
    Object.assign(G.view, { w: cv.width, h: cv.height, css: s });
    const c = SH.cam, V = G.view; if (!c) return;
    const old = c.zdef;
    c.zdef = V.h / 330; c.zmin = Math.min(V.h / (D.TOP + D.ROWS * D.CH + 240), V.w / (D.WORLD_W + 260)); c.zmax = V.h / 190;
    c.zt = old ? c.zt * c.zdef / old : c.zdef; c.z = c.zt;
  }
  G.setQ = q => { G.q = q; resize(); };
  addEventListener('resize', resize);
  G.zoomTo = z => { const c = SH.cam; c.zt = U.clamp(z, c.zmin, c.zmax); };
  function camStep(dt) {
    const c = SH.cam, V = G.view;
    c.z += (c.zt - c.z) * Math.min(1, dt * 10);
    if (c.ty) { c.y += (D.TOP + D.CH * 0.25 - c.y) * Math.min(1, dt * 4); c.x += (D.SX - c.x) * Math.min(1, dt * 4); if (Math.abs(D.TOP + D.CH * 0.25 - c.y) < 3) c.ty = 0; }
    const hw = V.w / 2 / c.z, hh = V.h / 2 / c.z, x0 = -160, x1 = D.WORLD_W + 160, y0 = -230, y1 = D.TOP + D.ROWS * D.CH + 40;
    c.x = x1 - x0 < hw * 2 ? (x0 + x1) / 2 : U.clamp(c.x, x0 + hw, x1 - hw);
    c.y = y1 - y0 < hh * 2 ? (y0 + y1) / 2 : U.clamp(c.y, y0 + hh, y1 - hh);
  }

  /* ---------- Сохранение ---------- */
  G.save = function () {
    const s = SH.s; if (!s) return;
    const ri = r => r ? s.rooms.indexOf(r) : -1, out = Object.assign({}, s);
    out.rooms = s.rooms.map(r => ({ c: r.c, r: r.r, k: r.k, lvl: r.lvl, acc: r.acc, w: r.w.slice() }));
    out.ppl = s.ppl.map(p => ({ id: p.id, name: p.name, male: p.male, S: p.S, A: p.A, I: p.I, lvl: p.lvl, xp: p.xp, hp: Math.max(p.hp, p.st === 'out' ? 30 : 1), seedv: p.seedv,
      x: p.st === 'out' || p.surf || p.climb ? D.SX - 60 : p.x, row: p.st === 'out' || p.surf || p.climb ? 0 : p.row, job: ri(p.st === 'out' ? p.lastJob : p.job), down: p.st === 'down' ? p.dt : 0 }));
    out.alarm = false;
    try { localStorage.setItem(KEY, JSON.stringify({ v: 2, s: out })); } catch (e) { }
  };
  function load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
    if (!d || d.v !== 2 || !d.s) return false;
    try {
      SH.newGame(); const o = d.s, s = SH.s;
      for (const k of ['t', 'res', 'gear', 'door', 'raidT', 'radioT', 'raids', 'raidsWon', 'trips', 'goal', 'nid', 'kills']) if (o[k] !== undefined) s[k] = o[k];
      s.rooms = []; for (const row of SH.grid) row.fill(null);
      for (const r of o.rooms) { const rm = SH.room(r.c, r.r, r.k, r.lvl); rm.acc = r.acc || 0; }
      s.ppl = [];
      for (const q of o.ppl) {
        const p = { id: q.id, name: q.name, male: q.male, S: q.S, A: q.A, I: q.I, lvl: q.lvl, xp: q.xp, hp: q.hp, seedv: q.seedv };
        SH.s.ppl.push(p); const y = D.floorY(q.row);
        Object.assign(p, { x: q.x, y, row: q.row, tx: q.x, trow: q.row, job: null, st: 'idle', climb: false, face: 1, mv: 0, ph: 0, act: null, at: 0, wt: 1, seed: Math.random() * 9, hurt: 0, fl: 0, cd: 0 });
        p.style = SH.styleOf(p);
        if (q.down) { p.st = 'down'; p.dt = q.down; }
        if (q.job >= 0 && s.rooms[q.job]) SH.assign(p, s.rooms[q.job]);
      }
      return true;
    } catch (e) { console.error(e); return false; }
  }
  G.reset = function () { try { localStorage.removeItem(KEY); } catch (e) { } SH.newGame(); SH.cam = mkCam(); resize(); document.body.classList.remove('exp'); EX.e = null; };
  G.saveCfg = () => { try { localStorage.setItem('rubin_cfg2', JSON.stringify({ s: U.soundOn, q: G.q, f: G.fps })); } catch (e) { } };
  G.onBack = () => UI.back();
  function mkCam() { return { x: D.SX, y: D.TOP + D.CH * 0.3, z: 1, zt: 1, zdef: 0, zmin: 0.3, zmax: 3, ty: 0 }; }

  /* ---------- Цикл ---------- */
  let last = 0, fA = 0, fN = 0, slow = 0, warm = 4, saveT = 0, hurtV = -1;
  function frame(t) {
    requestAnimationFrame(frame);
    let dt = (t - last) / 1000; last = t; if (!(dt > 0)) return;
    fA += dt; fN++;
    if (fA >= 0.5) {
      const f = Math.round(fN / fA); if (G.fps) $('fps').textContent = f + ' FPS';
      if (!G.paused && warm <= 0) { if (f < 45) { slow += fA; if (slow > 3 && G.q < 2) { G.q++; slow = 0; warm = 3; resize(); } } else slow = 0; }
      if (warm > 0) warm -= fA; fA = 0; fN = 0;
    }
    if (dt > 0.1) dt = 0.1;
    const ctx = G.ctx, V = G.view;
    if (!G.paused) {
      SH.update(dt, !!EX.e);
      if (EX.e) EX.update(dt);
      if ((saveT += dt) > 15) { saveT = 0; if (!EX.e) G.save(); }
    }
    if (EX.e) EX.render(ctx, V, G.paused ? 0 : dt);
    else { camStep(dt); SH.render(ctx, V, G.paused ? 0 : dt); }
    const e = EX.e, hv = e ? Math.max(e.hurt > 0 ? e.hurt * 2.4 : 0, e.hp < 30 ? 0.35 + Math.sin(t / 200) * 0.1 : 0) : 0, hq = Math.round(hv * 20) / 20;
    if (hq !== hurtV) { hurtV = hq; $('hurt').style.opacity = hq; }
    U.ambience(e ? 0 : 1, e ? 1 : 0.25);
    UI.hud(dt);
  }
  function boot() {
    G.ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
    try { const c = JSON.parse(localStorage.getItem('rubin_cfg2')); if (c) { U.soundOn = c.s; G.q = c.q | 0; G.fps = c.f !== false; } } catch (e) { }
    ART.init(); UI.initHud();
    const had = load(); if (!had) SH.newGame();
    SH.cam = mkCam(); resize(); SH.ph = (SH.s.t % D.DAY) / D.DAY; SH.dark = ART.sky(SH.ph).dark;
    if (had) { $('btn-play').textContent = 'ПРОДОЛЖИТЬ'; $('btn-new').classList.remove('hide'); }
    const start = () => { U.audioInit(); $('title').classList.add('hide'); document.body.classList.remove('title'); G.paused = false; warm = 4; };
    $('btn-play').addEventListener('click', start);
    $('btn-new').addEventListener('click', () => { G.reset(); start(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!EX.e) G.save(); EX.in.l = EX.in.r = EX.in.act = false; } else last = performance.now(); });
    addEventListener('pagehide', () => { if (!EX.e) G.save(); });
    SH.onHit = () => { };
    requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  }
  boot();
})();
