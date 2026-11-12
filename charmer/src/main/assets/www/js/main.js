'use strict';
/* Запуск, состояние игрока, сохранение, главный цикл */
(function () {
  const $ = id => document.getElementById(id), cv = $('cv'), G = window.G;
  const KEY = 'charmer_v1';
  G.time = 0; G.mode = 'title'; G.lock = false;
  G.view = { w: 2, h: 2 };

  /* ---------- Героини: показатели и опыт ---------- */
  G.stats = function (g) {
    const B = D.GIRLS[g.id].base, L = g.lvl, k = (g.bloom ? 1.12 : 1) * (g.aff >= 100 ? 1.05 : 1);
    return { hp: Math.floor((2 * B.hp * L / 100 + L + 10) * k), atk: Math.floor((2 * B.atk * L / 100 + 5) * k), def: Math.floor((2 * B.def * L / 100 + 5) * k), spd: Math.floor((2 * B.spd * L / 100 + 5) * k) };
  };
  G.need = L => 20 + L * L * 6;
  G.skillsOf = g => D.GIRLS[g.id].skills.filter(s => s[1] <= g.lvl).map(s => s[0]);
  G.mkGirl = function (id, lvl) { const g = { uid: 0, id, lvl, xp: 0, hp: 1, aff: 0, bloom: lvl >= 15, talked: false, dates: 0, dated: false }; g.hp = G.stats(g).hp; return g; };
  G.addGirl = function (id, lvl, hp) {
    const S = G.S, g = G.mkGirl(id, lvl); g.uid = S.uid++; if (hp !== undefined) g.hp = Math.max(1, hp);
    (S.party.length < 6 ? S.party : S.box).push(g); S.caught[id] = true; S.seen[id] = true; return g;
  };
  G.alive = () => G.S.party.some(g => g.hp > 0);
  G.healAll = () => { for (const g of G.S.party.concat(G.S.box)) g.hp = G.stats(g).hp; };

  /* ---------- Сохранение ---------- */
  function fresh() { return { map: 'village', x: 5, y: 7, face: 'up', money: 120, bag: { seal: 5, potion: 3, pie: 2 }, party: [], box: [], seen: {}, caught: {}, flags: {}, uid: 1 }; }
  G.save = function () {
    if (!G.S || G.mode === 'title') return;
    const clean = g => ({ uid: g.uid, id: g.id, lvl: g.lvl, xp: g.xp, hp: g.hp, aff: g.aff, bloom: g.bloom, talked: g.talked, dates: g.dates || 0, dated: !!g.dated });
    const o = Object.assign({}, G.S, { party: G.S.party.map(clean), box: G.S.box.map(clean) });
    if (G.mode === 'battle') return;
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, s: o })); } catch (e) { }
  };
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.v === 1 && d.s) return Object.assign(fresh(), d.s); } catch (e) { } return null; }
  G.saveCfg = () => { try { localStorage.setItem('charmer_cfg', JSON.stringify({ s: U.soundOn })); } catch (e) { } };
  G.reset = function () { try { localStorage.removeItem(KEY); } catch (e) { } G.S = fresh(); WD.enter('village', G.S.x, G.S.y, 'up'); setTimeout(intro, 300); };

  /* ---------- Действия ---------- */
  G.actionA = function () {
    if (UI.dialogOpen()) return;
    if (G.mode === 'world' && !G.lock && !UI.modalOpen() && WD.hero.mv <= 0) WD.interact();
  };
  G.onBack = function () {
    if ($('title').classList.contains('hide') === false) return;
    if (UI.modalOpen()) { if (!$('modal').classList.contains('noclose')) UI.close(); return; }
    if (UI.dialogOpen() || G.mode !== 'world') return;
    UI.openMenu();
  };
  function intro() { if (!G.S.flags.starter) { G.S.x = 5; G.S.y = 7; G.S.face = 'up'; WD.enter('village', 5, 7, 'up'); WD.interact(); } }

  /* ---------- Размер кадра ---------- */
  function resize() {
    const w = innerWidth, h = innerHeight, s = Math.min(devicePixelRatio || 1, 760 / h);
    cv.width = Math.max(2, Math.round(w * s)); cv.height = Math.max(2, Math.round(h * s)); G.view.w = cv.width; G.view.h = cv.height;
  }
  addEventListener('resize', resize);

  /* ---------- Цикл ---------- */
  let last = 0, saveT = 0, fA = 0, fN = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    let dt = (t - last) / 1000; last = t; if (!(dt > 0)) return; if (dt > 0.1) dt = 0.1;
    G.time += dt; G.dt = dt; fA += dt; fN++; if (fA > 0.5) { $('fps').textContent = Math.round(fN / fA) + ' FPS'; fA = 0; fN = 0; }
    UI.tick(dt);
    const x = G.ctx;
    if (G.mode === 'battle') { BT.update(dt); BT.render(x, G.view); }
    else { const free = G.mode === 'world' && !UI.dialogOpen() && !UI.modalOpen() && !G.lock; WD.update(dt, free ? UI.dir() : null); WD.render(x, G.view); }
    UI.drawLive(G.time);
    if ((saveT += dt) > 20) { saveT = 0; G.save(); }
  }
  function boot() {
    G.ctx = cv.getContext('2d', { alpha: false });
    try { const c = JSON.parse(localStorage.getItem('charmer_cfg')); if (c) U.soundOn = c.s; } catch (e) { }
    ART.init(); resize();
    const had = load(); G.S = had || fresh();
    WD.enter(G.S.map, G.S.x, G.S.y, G.S.face);
    // героини на заставке
    const tg = $('t-girls'); for (const [id, ex] of [['dryad', 'smug'], ['fox', 'happy'], ['slime', 'blush']]) { const c = document.createElement('canvas'); c.width = 220; c.height = 300; tg.appendChild(c); UI.titlePic(c, id, ex); }
    if (had && had.flags.starter) { $('btn-play').textContent = 'ПРОДОЛЖИТЬ'; $('btn-new').classList.remove('hide'); }
    const start = () => { U.audioInit(); $('title').classList.add('hide'); document.body.classList.remove('title'); G.mode = 'world'; U.music(G.S.map === 'village' ? 'tavern' : 'world'); setTimeout(intro, 350); };
    $('btn-play').onclick = start;
    $('btn-new').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { } G.S = fresh(); WD.enter('village', 5, 7, 'up'); start(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); else last = performance.now(); });
    addEventListener('pagehide', G.save);
    requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  }
  window.addEventListener('load', boot);
})();
