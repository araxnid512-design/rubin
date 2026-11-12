'use strict';
/* Запуск, главный цикл, ввод, главное меню */
(function (DW) {
  const U = DW.U, el = U.el;
  const Main = {};
  let cv, g, W = 0, H = 0, dpr = 1, scene = null, last = 0;

  /* ---------- Главное меню ---------- */
  const MS = {};
  let embers = [];
  MS.enter = function () {
    const ui = document.getElementById('ui');
    ui.innerHTML = '';
    const box = el('div', { class: 'title' });
    box.appendChild(el('div', { class: 't1', text: 'МЁРТВЫЙ МИР' }));
    box.appendChild(el('div', { class: 't2', text: 'Плацдарм' }));
    const btns = el('div', { class: 'tbtns' });
    const hasSave = DW.G.hasSave();
    if (hasSave) btns.appendChild(el('button', { class: 'btn primary big', text: 'Продолжить', onclick: function () { DW.SFX.unlock(); Main.continueGame(); } }));
    btns.appendChild(el('button', { class: 'btn big' + (hasSave ? '' : ' primary'), text: 'Новая игра', onclick: async function () {
      DW.SFX.unlock();
      if (hasSave) {
        const ok = await DW.UI.confirm('Новая игра', 'Текущее прохождение будет потеряно. Начать заново?', 'Начать');
        if (!ok) return;
      }
      Main.newGame();
    } }));
    btns.appendChild(el('button', { class: 'btn big', text: 'Как играть', onclick: function () { DW.UI.help(); } }));
    box.appendChild(btns);
    box.appendChild(DW.UI.settingsRow());
    box.appendChild(el('div', { class: 'tfoot', text: 'Фанатская игра по мотивам книги «Мёртвый мир»' }));
    ui.appendChild(box);
    embers = [];
  };
  MS.exit = function () { document.getElementById('ui').innerHTML = ''; };
  MS.update = function (dt) {
    if (embers.length < 70 && Math.random() < 0.5) embers.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 40, life: 4 + Math.random() * 5, t: 0, s: 1 + Math.random() * 2.5 });
    embers.forEach(function (e) { e.t += dt; e.x += e.vx * dt + Math.sin(e.t * 2) * 0.3; e.y += e.vy * dt; });
    embers = embers.filter(function (e) { return e.t < e.life; });
  };
  MS.render = function (c, w, h, d) {
    const t = performance.now() / 1000;
    c.setTransform(d, 0, 0, d, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1a1210'); sky.addColorStop(0.55, '#3a2418'); sky.addColorStop(1, '#120d0a');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    // солнце сквозь пыль
    const sx = w * 0.72, sy = h * 0.38;
    const sun = c.createRadialGradient(sx, sy, 5, sx, sy, h * 0.6);
    sun.addColorStop(0, 'rgba(255,170,90,0.55)'); sun.addColorStop(0.2, 'rgba(200,90,40,0.25)'); sun.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sun; c.fillRect(0, 0, w, h);
    // горы
    const layer = function (base, amp, col, seed, sc) {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) c.lineTo(x, base - U.fbm(x * sc, seed, seed, 4) * amp);
      c.lineTo(w, h); c.closePath(); c.fill();
    };
    layer(h * 0.68, h * 0.35, '#2a1c16', 3, 0.004);
    layer(h * 0.78, h * 0.25, '#1d1410', 9, 0.007);
    // руины
    c.fillStyle = '#120c0a';
    const rs = U.srng(42);
    for (let i = 0; i < 14; i++) {
      const bx = rs() * w, bw = 20 + rs() * 60, bh = 30 + rs() * 110;
      c.fillRect(bx, h * 0.84 - bh, bw, bh + h * 0.2);
      c.fillStyle = 'rgba(255,170,80,' + (0.15 + 0.1 * Math.sin(t * 2 + i)) + ')';
      if (rs() < 0.5) c.fillRect(bx + bw * 0.3, h * 0.84 - bh * 0.7, 3, 4);
      c.fillStyle = '#120c0a';
    }
    c.fillStyle = '#0c0807'; c.fillRect(0, h * 0.86, w, h * 0.14);
    // портал
    const px = w * 0.2, py = h * 0.66;
    const gl = 0.5 + Math.sin(t * 1.7) * 0.15;
    const pg = c.createRadialGradient(px, py, 4, px, py, h * 0.3);
    pg.addColorStop(0, 'rgba(140,240,255,' + gl + ')'); pg.addColorStop(1, 'rgba(95,212,230,0)');
    c.fillStyle = pg; c.fillRect(px - h * 0.3, py - h * 0.3, h * 0.6, h * 0.6);
    c.strokeStyle = '#3a4a55'; c.lineWidth = 7;
    c.beginPath(); c.ellipse(px, py, h * 0.07, h * 0.13, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(160,240,255,' + gl + ')'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(px, py, h * 0.07, h * 0.13, 0, 0, Math.PI * 2); c.stroke();
    embers.forEach(function (e) {
      c.globalAlpha = Math.max(0, 1 - e.t / e.life);
      c.fillStyle = '#ffaa55'; c.fillRect(e.x, e.y, e.s, e.s);
    });
    c.globalAlpha = 1;
  };
  MS.tap = function () {};
  MS.pan = function () {};
  MS.zoomAt = function () {};
  MS.back = function () {
    DW.UI.confirm('Выход', 'Выйти из игры?', 'Выйти').then(function (ok) {
      if (ok && window.AndroidBridge && window.AndroidBridge.exit) window.AndroidBridge.exit();
    });
  };

  /* ---------- Управление сценами ---------- */
  Main.setScene = function (s, arg) {
    DW.UI.closeAll();
    if (scene && scene.exit) scene.exit();
    scene = s;
    if (s.enter) s.enter(arg);
  };
  Main.scene = function () { return scene; };
  Main.toMenu = function () { DW.BT.clear(); Main.setScene(MS); };
  Main.toWorld = function () { Main.setScene(DW.WS); };
  Main.newGame = async function () {
    DW.G.newGame();
    DW.G.save();
    Main.toWorld();
    await DW.UI.alert('Мёртвый мир',
      'Приговор — Портал. Вас, шестерых заключённых, вытолкнули в мёртвый мир: серое небо, пустошь, руины чужой цивилизации и твари, что чуют живых издалека.<br><br>' +
      'Контора выдала автоматы, патроны и сухпаёк на несколько дней. Правила просты: здесь растут <b class="acc">драгоценные кристаллы</b>. Отправляйте их через Портал — и получите всё, что нужно: оружие, патроны, снаряжение, новых людей.<br><br>' +
      'Найдите место, закрепитесь, постройте базу. Выживите.<br><br><b class="bad">Но сначала — твари уже идут к точке высадки.</b>');
    const st = DW.G.state;
    await DW.WS.attack(DW.G.node(st.squadAt), 'normal');
  };
  Main.continueGame = function () {
    if (!DW.G.load()) { Main.newGame(); return; }
    const st = DW.G.state;
    if (st.over) { Main.ending(st.over); return; }
    if (st.battle) {
      try {
        const B = DW.BT.restore(st.battle);
        if (B.phase !== 'player') DW.BT.startPlayerTurn();
        Main.setScene(DW.BS, B);
        return;
      } catch (e) { console.error(e); st.battle = null; }
    }
    Main.toWorld();
  };
  Main.startBattle = function (opts) {
    const B = DW.BT.create(opts);
    DW.G.state.battle = B;
    DW.G.save();
    Main.setScene(DW.BS, B);
  };
  Main.afterBattle = function (sum) {
    const st = DW.G.state;
    if (st.over) { Main.ending(st.over); return; }
    Main.toWorld();
    const node = DW.G.node(st.squadAt);
    if (!st.flags.tipPortal && sum.result === 'victory') {
      st.flags.tipPortal = true;
      DW.UI.alert('Первая добыча', 'Драгоценности собраны. Откройте <b>Портал</b> внизу экрана, чтобы заказать у Конторы патроны, еду или новых бойцов. ' +
        'Груз придёт завтра в точку высадки.<br><br>Ищите на карте <b style="color:#7fb069">«Укрытие»</b> — там можно основать базу.');
    } else if (node && node.type === 'site' && node.cleared && st.baseNode === null) {
      DW.UI.toast('Здесь можно основать базу!', 'good');
    }
  };
  Main.ending = function (kind) {
    const st = DW.G.state;
    DW.G.save();
    const texts = {
      win_gems: ['Вольная', 'Контора получила свою тысячу драгоценностей и признала колонию. Теперь это ваш мир — мёртвый, но ваш. Бывшие заключённые стали первыми поселенцами.'],
      win_nest: ['Сердце мёртвого мира', 'Матка мертва, Гнездо горит. Твари рассеялись по пустоши, а у отряда наконец есть время строить, а не только отстреливаться. Мир ваш.'],
      lose: ['Конец пути', 'Последний боец отряда погиб. Портал молчит. Контора отправит новую партию заключённых — может, им повезёт больше.']
    };
    const tx = texts[kind] || texts.lose;
    Main.setScene(MS);
    DW.UI.modal({
      title: tx[0], cls: 'small k-' + (kind === 'lose' ? 'bad' : 'good'), closable: false,
      body: '<div class="ptext">' + tx[1] + '<br><br>Дней прожито: <b>' + st.day + '</b> · миссий: <b>' + st.stats.missions + '</b> · врагов убито: <b>' + st.stats.kills + '</b> · сдано драгоценностей: <b>' + st.delivered + '</b></div>',
      buttons: [{ text: 'В главное меню', cls: 'primary', onClick: function () { Main.toMenu(); } }]
    });
  };

  /* ---------- Ввод ---------- */
  function setupInput() {
    const pts = {};
    let pinch = null, moved = false, downAt = null;
    function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', function (e) {
      DW.SFX.unlock();
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      const p = pos(e);
      pts[e.pointerId] = { x: p[0], y: p[1] };
      const ids = Object.keys(pts);
      if (ids.length === 1) { moved = false; downAt = p; }
      if (ids.length === 2) {
        const a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        moved = true;
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      const p = pos(e);
      const prev = pts[e.pointerId];
      const ids = Object.keys(pts);
      if (ids.length === 1) {
        if (!moved && downAt && Math.hypot(p[0] - downAt[0], p[1] - downAt[1]) > 9) moved = true;
        if (moved && scene && scene.pan) scene.pan(p[0] - prev.x, p[1] - prev.y);
      } else if (ids.length === 2 && pinch) {
        pts[e.pointerId] = { x: p[0], y: p[1] };
        const a = pts[ids[0]], b = pts[ids[1]];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.d > 0 && scene && scene.zoomAt) scene.zoomAt(d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch.d = d;
        return;
      }
      pts[e.pointerId] = { x: p[0], y: p[1] };
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      const p = pos(e);
      delete pts[e.pointerId];
      const left = Object.keys(pts).length;
      if (left === 0) {
        if (!moved && scene && scene.tap) scene.tap(p[0], p[1]);
        pinch = null; downAt = null;
      }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; if (!Object.keys(pts).length) { pinch = null; moved = true; } });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      const p = pos(e);
      if (scene && scene.zoomAt) scene.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, p[0], p[1]);
    }, { passive: false });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') DW.onBack();
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    DW.TR.resize(W, H);
    DW.WR.view.w = W; DW.WR.view.h = H;
  }
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    if (scene) {
      try {
        if (scene.update) scene.update(dt);
        if (scene.render) scene.render(g, W, H, dpr);
      } catch (e) { console.error(e); }
    }
    requestAnimationFrame(loop);
  }

  DW.onBack = function () {
    if (DW.UI.closeTop()) return true;
    if (scene && scene.back) scene.back();
    return true;
  };
  DW.onPause = function () {
    if (DW.G.state && scene !== MS) DW.G.save();
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden) DW.onPause(); });

  Main.boot = function () {
    cv = document.getElementById('cv');
    g = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    setupInput();
    Main.setScene(MS);
    requestAnimationFrame(loop);
  };
  DW.Main = Main;
  DW.MS = MS;
  window.addEventListener('load', Main.boot);
})(window.DW);
