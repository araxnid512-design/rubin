'use strict';
/* Запуск, главный цикл, ввод, главное меню */
(function (DW) {
  const U = DW.U, el = U.el;
  const Main = {};
  let cv, g, W = 0, H = 0, dpr = 1, scene = null, last = 0;

  /* ---------- Главное меню ---------- */
  const MS = {};
  let embers = [];
  let menuSquad = null, emblem = null;
  function makeEmblem() {
    const c = DW.ART.canvas(160, 160);
    const g = c.getContext('2d');
    const s = 1.6;
    const gl = g.createRadialGradient(80, 80, 4, 80, 80, 74);
    gl.addColorStop(0, 'rgba(140,240,255,0.7)'); gl.addColorStop(0.5, 'rgba(95,212,230,0.2)'); gl.addColorStop(1, 'rgba(95,212,230,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(80, 80, 74, 0, 7); g.fill();
    g.lineWidth = 11; g.strokeStyle = '#2a3238'; g.beginPath(); g.ellipse(80, 80, 26 * s, 38 * s, 0, 0, 7); g.stroke();
    g.lineWidth = 4; g.strokeStyle = '#9fefff'; g.beginPath(); g.ellipse(80, 80, 26 * s, 38 * s, 0, 0, 7); g.stroke();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.fillStyle = '#e8a83e'; g.beginPath(); g.arc(80 + Math.cos(a) * 26 * s, 80 + Math.sin(a) * 38 * s, 3, 0, 7); g.fill(); }
    const pts = [[0, -34], [21, -9], [0, 32], [-21, -9]];
    g.fillStyle = '#5fd4e6'; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(80 + p[0], 82 + p[1]); else g.moveTo(80 + p[0], 82 + p[1]); }); g.closePath(); g.fill();
    g.fillStyle = '#2a8a9a'; g.beginPath(); g.moveTo(80, 48); g.lineTo(101, 73); g.lineTo(80, 114); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.moveTo(80, 48); g.lineTo(74, 73); g.lineTo(59, 73); g.closePath(); g.fill();
    return c.toDataURL();
  }
  MS.enter = function () {
    const ui = document.getElementById('ui');
    ui.innerHTML = '';
    if (!emblem) emblem = makeEmblem();
    if (!menuSquad) menuSquad = DW.D.START_SQUAD.map(function (t, i) { return { look: DW.ART.makeLook(i * 97 + 11, t.look), name: t.name, weapon: ['ak', 'lmg', 'sniper', 'ak', 'shotgun', 'ak'][i], armor: ['robe', 'robe', 'vest', 'robe', 'robe', 'robe'][i] }; });
    const box = el('div', { class: 'title' });
    box.appendChild(el('img', { class: 'temb', src: emblem, alt: '' }));
    box.appendChild(el('div', { class: 't1', text: 'МЁРТВЫЙ МИР' }));
    box.appendChild(el('div', { class: 't2', text: 'Плацдарм' }));
    box.appendChild(el('div', { class: 't3', text: 'Выживи. Закрепись. Отправь драгоценности через Портал.' }));
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
    if (embers.length < 90 && Math.random() < 0.6) embers.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 40, life: 4 + Math.random() * 5, t: 0, s: 1 + Math.random() * 2.5 });
    embers.forEach(function (e) { e.t += dt; e.x += e.vx * dt + Math.sin(e.t * 2) * 0.3; e.y += e.vy * dt; });
    embers = embers.filter(function (e) { return e.t < e.life; });
  };
  MS.render = function (c, w, h, d) {
    const t = performance.now() / 1000;
    const ART = DW.ART;
    c.setTransform(d, 0, 0, d, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#140e0c'); sky.addColorStop(0.5, '#41271a'); sky.addColorStop(0.75, '#5a3420'); sky.addColorStop(1, '#120d0a');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const sx = w * 0.74, sy = h * 0.42;
    const sun = c.createRadialGradient(sx, sy, 5, sx, sy, h * 0.7);
    sun.addColorStop(0, 'rgba(255,190,110,0.7)'); sun.addColorStop(0.12, 'rgba(240,120,60,0.35)'); sun.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sun; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,220,170,0.85)'; c.beginPath(); c.arc(sx, sy, h * 0.045, 0, 7); c.fill();
    // облака-полосы
    for (let i = 0; i < 5; i++) {
      const y = h * (0.12 + i * 0.08), off = ((t * (6 + i * 3)) % (w + 400)) - 200;
      const cg = c.createLinearGradient(0, y - 10, 0, y + 10);
      cg.addColorStop(0, 'rgba(90,50,35,0)'); cg.addColorStop(0.5, 'rgba(110,60,40,' + (0.25 - i * 0.03) + ')'); cg.addColorStop(1, 'rgba(90,50,35,0)');
      c.fillStyle = cg;
      for (let k = -1; k < 3; k++) { c.beginPath(); c.ellipse(off + k * (w * 0.6), y, w * 0.25, 9 + i * 2, 0, 0, 7); c.fill(); }
    }
    const layer = function (base, amp, col, seed, sc) {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) c.lineTo(x, base - U.fbm(x * sc, seed, seed, 4) * amp);
      c.lineTo(w, h); c.closePath(); c.fill();
    };
    layer(h * 0.66, h * 0.36, '#3a2418', 3, 0.004);
    layer(h * 0.74, h * 0.28, '#2a1a12', 9, 0.006);
    // руины
    const rs = U.srng(42);
    for (let i = 0; i < 16; i++) {
      const bx = rs() * w, bw = 18 + rs() * 56, bh = 30 + rs() * 120;
      c.fillStyle = '#160e0a';
      c.beginPath(); c.moveTo(bx, h * 0.84); c.lineTo(bx, h * 0.84 - bh); c.lineTo(bx + bw * 0.3, h * 0.84 - bh - rs() * 10); c.lineTo(bx + bw * 0.6, h * 0.84 - bh + rs() * 14); c.lineTo(bx + bw, h * 0.84 - bh * (0.7 + rs() * 0.3)); c.lineTo(bx + bw, h * 0.84); c.closePath(); c.fill();
      for (let k = 0; k < 4; k++) if (rs() < 0.4) { c.fillStyle = 'rgba(255,170,80,' + (0.12 + 0.12 * Math.sin(t * 2 + i + k)) + ')'; c.fillRect(bx + bw * (0.2 + rs() * 0.6), h * 0.84 - bh * (0.2 + rs() * 0.6), 3, 4); }
    }
    // гребень
    const gr = c.createLinearGradient(0, h * 0.8, 0, h);
    gr.addColorStop(0, '#24170f'); gr.addColorStop(1, '#0a0705');
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.83 + Math.sin(x * 0.01) * 6 + U.noise(x * 0.03, 1, 5) * 8);
    c.lineTo(w, h); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,150,80,0.35)'; c.lineWidth = 1.5;
    c.beginPath(); for (let x = 0; x <= w; x += 8) { const y = h * 0.83 + Math.sin(x * 0.01) * 6 + U.noise(x * 0.03, 1, 5) * 8; if (x) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
    // портал
    const px = w * 0.17, py = h * 0.62, pr = h * 0.15;
    const gl = 0.55 + Math.sin(t * 1.7) * 0.15;
    const pg = c.createRadialGradient(px, py, 4, px, py, h * 0.42);
    pg.addColorStop(0, 'rgba(150,240,255,' + gl + ')'); pg.addColorStop(0.35, 'rgba(95,212,230,0.18)'); pg.addColorStop(1, 'rgba(95,212,230,0)');
    c.fillStyle = pg; c.fillRect(0, 0, w, h);
    const ig = c.createRadialGradient(px, py, 2, px, py, pr);
    ig.addColorStop(0, 'rgba(230,255,255,0.95)'); ig.addColorStop(0.5, 'rgba(110,220,240,0.6)'); ig.addColorStop(1, 'rgba(40,120,150,0.2)');
    c.fillStyle = ig; c.beginPath(); c.ellipse(px, py, pr * 0.62, pr, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(220,255,255,0.6)'; c.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(px, py, pr * (0.15 + k * 0.1), pr * (0.25 + k * 0.15), 0, t * (1 + k * 0.3) + k, t * (1 + k * 0.3) + k + 2.2); c.stroke(); }
    c.strokeStyle = '#2a3238'; c.lineWidth = 10; c.beginPath(); c.ellipse(px, py, pr * 0.68, pr * 1.06, 0, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(170,245,255,' + gl + ')'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(px, py, pr * 0.68, pr * 1.06, 0, 0, 7); c.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillStyle = '#e8a83e'; c.beginPath(); c.arc(px + Math.cos(a) * pr * 0.68, py + Math.sin(a) * pr * 1.06, 2.6, 0, 7); c.fill(); }
    for (let i = 0; i < 14; i++) {
      const k = ((t * 0.4 + i / 14) % 1), a = i * 2.4;
      const rr = pr * 2.2 * (1 - k);
      c.fillStyle = 'rgba(170,245,255,' + (k * 0.8) + ')';
      c.fillRect(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8, 2, 2);
    }
    // отряд на гребне
    if (menuSquad) {
      const fs = Math.max(1.2, h / 260);
      menuSquad.forEach(function (m, i) {
        const x = w * 0.69 + i * 22 * fs + (i % 2) * 5 * fs, y = h * 0.86 + (i % 2) * 6 * fs + Math.sin(x * 0.01) * 4;
        c.save(); c.translate(x, y);
        ART.human(c, { look: m.look, body: '#c8691c', armor: m.armor, weapon: m.weapon, dir: -1, aim: i % 3 === 0 ? 0.2 : -0.08, scale: fs, cig: m.name === 'Мальборо', seed: i }, t * 1000);
        c.restore();
      });
      const shade = c.createLinearGradient(0, h * 0.62, 0, h);
      shade.addColorStop(0, 'rgba(20,10,5,0)'); shade.addColorStop(1, 'rgba(20,10,5,0.45)');
      c.fillStyle = shade; c.fillRect(0, h * 0.62, w, h * 0.38);
    }
    embers.forEach(function (e) {
      c.globalAlpha = Math.max(0, 1 - e.t / e.life);
      c.fillStyle = '#ffaa55'; c.fillRect(e.x, e.y, e.s, e.s);
    });
    c.globalAlpha = 1;
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  };
  MS.idle = function () { return true; };
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
      Main.poke();
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
      Main.poke();
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

  let maxDpr = 2;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    DW.TR.resize(W, H);
    DW.WR.view.w = W; DW.WR.view.h = H;
  }
  let frame = 0, lastInput = 0, renderAvg = 0, slowFrames = 0;
  Main.poke = function () { lastInput = performance.now(); };
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    frame++;
    if (scene) {
      try {
        if (scene.update) scene.update(dt);
        // в простое перерисовываем реже — экономия батареи
        const idle = t - lastInput > 400 && scene.idle && scene.idle();
        if (scene.render && (!idle || frame % 3 === 0)) {
          const r0 = performance.now();
          scene.render(g, W, H, dpr);
          const rt = performance.now() - r0;
          renderAvg = renderAvg * 0.9 + rt * 0.1;
          // адаптивное разрешение: если кадры слишком тяжёлые — снижаем плотность пикселей
          if (renderAvg > 24 && dpr > 1) {
            if (++slowFrames > 20) { maxDpr = Math.max(1, dpr - 0.5); slowFrames = 0; renderAvg = 0; resize(); }
          } else slowFrames = 0;
        }
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
