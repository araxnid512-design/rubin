'use strict';
/* Начальная заставка при запуске (по книге): мёртвый город на закате → Портал Института → заключённые выходят
   из света → название. Своя музыкальная тема (DW.Music 'intro'). Касание — следующий кадр, «Пропустить» — сразу в меню. */
(function (DW) {
  const SP = {};
  const BAR = 4 * 60 / 54 * 1000;   // такт темы заставки (54 удара в минуту), мс
  const SHOTS = [
    { dur: BAR, cap: 'Мир, переживший войну. <b class="acc">Мёртвый мир.</b>' },
    { dur: BAR, cap: 'Институт открыл сюда Портал. <b>В один конец.</b>' },
    { dur: BAR, cap: 'Заключённых выбрасывают сюда со старыми ППШ и сухпаем. Тюрьма без решёток.' },
    { dur: BAR * 1.6, cap: 'Выжить. Закрепиться. Отправить <b class="gem">драгоценности</b> через Портал.', title: true }
  ];
  let active = false;
  SP.active = function () { return active; };

  /* силуэт руин: ломаные крыши, проломы, торчащая арматура */
  function skyline(seed, n, hMin, hMax) {
    let s = seed;
    const r = function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const out = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.03 + r() * 0.07, h = hMin + r() * (hMax - hMin);
      const cut = r() < 0.6 ? r() * 0.5 : 0;
      out.push({ x: x, w: w, h: h, cut: cut, side: r() < 0.5, rebar: r() < 0.4, win: Math.floor(r() * 4) });
      x += w + (r() < 0.2 ? r() * 0.03 : 0);
    }
    return out;
  }
  const FAR = skyline(7, 40, 0.1, 0.32), NEAR = skyline(91, 26, 0.06, 0.22);
  function drawSky(g, w, h, t, k) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#120c0a'); sky.addColorStop(0.45, '#3c2318'); sky.addColorStop(0.7, '#6a3a20'); sky.addColorStop(1, '#1a110c');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sx = w * (0.68 - k * 0.04), sy = h * 0.5;
    const sun = g.createRadialGradient(sx, sy, 4, sx, sy, h * 0.75);
    sun.addColorStop(0, 'rgba(255,190,110,0.7)'); sun.addColorStop(0.15, 'rgba(240,110,50,0.3)'); sun.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,215,160,0.85)'; g.beginPath(); g.arc(sx, sy, h * 0.05, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) {
      const y = h * (0.16 + i * 0.09), off = ((t / 1000 * (8 + i * 4)) % (w + 600)) - 300;
      g.fillStyle = 'rgba(120,64,40,' + (0.2 - i * 0.03) + ')';
      for (let j = -1; j < 3; j++) { g.beginPath(); g.ellipse(off + j * w * 0.55, y, w * 0.24, 8 + i * 3, 0, 0, 7); g.fill(); }
    }
  }
  function drawCity(g, w, h, list, base, col, par) {
    g.fillStyle = col;
    list.forEach(function (b) {
      const x = (b.x - par) * w * 1.3, bw = b.w * w * 1.3, bh = b.h * h;
      if (x > w || x + bw < 0) return;
      g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - bh * (b.side ? 1 : 1 - b.cut));
      g.lineTo(x + bw * 0.5, base - bh * (1 - b.cut * 0.5)); g.lineTo(x + bw, base - bh * (b.side ? 1 - b.cut : 1)); g.lineTo(x + bw, base); g.closePath(); g.fill();
      if (b.rebar) { g.strokeStyle = col; g.lineWidth = 1.2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + bw * (0.3 + k * 0.2), base - bh * (1 - b.cut * 0.5)); g.lineTo(x + bw * (0.32 + k * 0.2), base - bh * (1 - b.cut * 0.5) - 6 - k * 3); g.stroke(); } }
    });
  }
  function drawPortal(g, cx, cy, R, t, open, flash) {
    // кольцо из камней
    const glow = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.6);
    glow.addColorStop(0, 'rgba(140,235,255,' + (0.55 * open) + ')'); glow.addColorStop(0.4, 'rgba(70,170,220,' + (0.22 * open) + ')'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);
    if (open > 0.01) {
      g.save(); g.beginPath(); g.ellipse(cx, cy, R * 0.82, R * 1.12, 0, 0, 7); g.clip();
      const inner = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
      inner.addColorStop(0, 'rgba(235,255,255,' + open + ')'); inner.addColorStop(0.45, 'rgba(120,220,250,' + (0.85 * open) + ')'); inner.addColorStop(1, 'rgba(30,90,140,' + (0.7 * open) + ')');
      g.fillStyle = inner; g.fillRect(cx - R, cy - R * 1.2, R * 2, R * 2.4);
      g.strokeStyle = 'rgba(255,255,255,' + (0.35 * open) + ')'; g.lineWidth = 2;
      for (let k = 0; k < 5; k++) { const ph = (t / 900 + k / 5) % 1; g.globalAlpha = 1 - ph; g.beginPath(); g.ellipse(cx, cy, R * 0.82 * ph, R * 1.12 * ph, 0, 0, 7); g.stroke(); }
      g.globalAlpha = 1; g.restore();
    }
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, x = cx + Math.cos(a) * R * 0.95, y = cy + Math.sin(a) * R * 1.25;
      g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(x, y, R * 0.16, R * 0.2, a, 0, 7); g.fill();
      g.fillStyle = 'rgba(160,230,255,' + (0.5 * open) + ')'; g.beginPath(); g.arc(x - Math.cos(a) * R * 0.06, y - Math.sin(a) * R * 0.08, R * 0.035, 0, 7); g.fill();
    }
    if (flash > 0) { g.fillStyle = 'rgba(220,250,255,' + flash + ')'; g.fillRect(0, 0, cx * 4, cy * 4); }
  }
  /* фигура выходящего: силуэт 3D-бойца (ходьба к камере) или простая тень, пока атлас не загружен */
  const BODIES = ['b_krut', 'b_marlboro', 'b_pris1', 'b_pris2', 'b_pris3', 'b_pris5'];
  function figure(g, x, y, sc, i, t) {
    const S3 = DW.S3;
    if (S3 && S3.ready(BODIES[i]) && S3.ready('w_ppsh')) {
      const n = S3.count(BODIES[i], 'walk') || 1;
      const f = S3.frame([[BODIES[i], 'walk', Math.floor(t / 120 + i * 3) % n, 1], ['w_ppsh', 'walk', Math.floor(t / 120 + i * 3) % n, 1]]);
      if (f) { g.drawImage(f.sh, x - f.ox * sc, y - f.oy * sc, f.w * sc, f.h * sc); return; }
    }
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(x, y - 47 * sc, 6 * sc, 7 * sc, 0, 0, 7); g.fill();
    g.fillRect(x - 9 * sc, y - 40 * sc, 18 * sc, 24 * sc);
    g.fillRect(x - 8 * sc, y - 17 * sc, 7 * sc, 17 * sc); g.fillRect(x + 1 * sc, y - 17 * sc, 7 * sc, 17 * sc);
  }

  SP.play = function () {
    if (active) return Promise.resolve();
    active = true;
    if (DW.S3) { BODIES.forEach(function (b) { DW.S3.load(b); }); DW.S3.load('w_ppsh'); }
    DW.SFX.unlock();
    if (DW.Music) DW.Music.set('intro', 'wind');
    return new Promise(function (res) {
      const root = DW.U.el('div', { class: 'cine splash' });
      const cv = DW.U.el('canvas', { class: 'cine-cv' });
      const cap = DW.U.el('div', { class: 'cine-cap' });
      const title = DW.U.el('div', { class: 'sp-title', html: '<div class="sp-t1">МЁРТВЫЙ МИР</div><div class="sp-t2">ПЛАЦДАРМ</div>' });
      const skip = DW.U.el('button', { class: 'cine-skip', text: 'Пропустить ›' });
      root.appendChild(cv); root.appendChild(title); root.appendChild(cap); root.appendChild(skip);
      document.getElementById('app').appendChild(root);
      const g = cv.getContext('2d');
      const S = { i: 0, t0: performance.now(), start: performance.now(), done: false, embers: [], boom: false };
      function setCap() {
        cap.classList.remove('show'); cap.innerHTML = SHOTS[S.i].cap; void cap.offsetWidth; cap.classList.add('show');
        title.classList.toggle('show', !!SHOTS[S.i].title);
        if (S.i === 1) setTimeout(function () { if (!S.done) DW.SFX.play('portal'); }, BAR * 0.25);
      }
      function next() { if (S.done) return; if (S.i < SHOTS.length - 1) { S.i++; S.t0 = performance.now(); setCap(); } else finish(); }
      function finish() {
        if (S.done) return;
        S.done = true; root.classList.add('out');
        if (DW.Music) DW.Music.set('menu', 'wind');
        setTimeout(function () { root.remove(); active = false; res(); }, 450);
      }
      skip.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      skip.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
      root.addEventListener('pointerdown', function () { if (performance.now() - S.t0 > 700) next(); });
      setCap();
      function frame() {
        if (S.done && !root.isConnected) return;
        requestAnimationFrame(frame);
        const w = root.clientWidth || 800, h = root.clientHeight || 400, dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const now = performance.now(), sh = SHOTS[S.i], el = now - S.t0, k = Math.min(1, el / sh.dur);
        if (el > sh.dur && !S.done) next();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const T = now - S.start;
        drawSky(g, w, h, T, S.i + k);
        const pan = (S.i + k) * 0.05;
        const ground = h * 0.78;
        drawCity(g, w, h, FAR, ground - h * 0.02, '#2a1a14', 0.02 + pan * 0.5);
        // Портал: появляется со второго кадра
        const open = S.i === 0 ? 0 : (S.i === 1 ? Math.min(1, Math.max(0, (k - 0.25) / 0.35)) : 1);
        const flash = S.i === 1 && k > 0.25 && k < 0.45 ? (1 - Math.abs(k - 0.3) / 0.15) * 0.6 : 0;
        const pz = S.i === 0 ? 0.7 : (S.i === 1 ? 0.7 + k * 0.4 : (S.i === 2 ? 1.1 : 0.9));
        const R = h * 0.17 * pz, pcx = w * 0.5, pcy = ground - R * 1.28;
        drawCity(g, w, h, NEAR, ground + 2, '#140d0a', 0.1 + pan * 1.2);
        g.fillStyle = '#100b08'; g.fillRect(0, ground, w, h - ground);
        if (S.i >= 1) {
          drawPortal(g, pcx, pcy, R, T, S.i === 3 ? 0.6 + Math.sin(T / 600) * 0.1 : open, Math.max(0, flash));
          // отсвет Портала на земле
          const lg = g.createRadialGradient(pcx, ground + 6, 4, pcx, ground + 6, R * 2.4);
          lg.addColorStop(0, 'rgba(120,220,255,' + (0.35 * open) + ')'); lg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = lg; g.beginPath(); g.ellipse(pcx, ground + 6, R * 2.4, R * 0.5, 0, 0, 7); g.fill();
        }
        // заключённые выходят из Портала к нам
        if (S.i >= 2) {
          for (let i = 0; i < 6; i++) {
            const st = i * 0.12, q = S.i === 2 ? Math.max(0, Math.min(1, (k - st) / (1 - st) * 1.15)) : 1;
            if (q <= 0) continue;
            const side = (i % 2 ? 1 : -1) * (0.04 + Math.floor(i / 2) * 0.07) * w;
            const sc = h / 380 * (0.9 + q * 1.4);
            figure(g, pcx + side * q, ground + q * (h - ground) * 0.75, sc, i, T);
          }
        }
        // искры и пыль
        if (S.embers.length < 70 && Math.random() < 0.5) S.embers.push({ x: Math.random() * w, y: h + 5, vx: (Math.random() - 0.5) * 18, vy: -18 - Math.random() * 36, t: 0, life: 4 + Math.random() * 4, s: 0.8 + Math.random() * 2 });
        S.embers.forEach(function (e) { e.t += 1 / 60; e.x += e.vx / 60 + Math.sin(e.t * 2) * 0.3; e.y += e.vy / 60; });
        S.embers = S.embers.filter(function (e) { return e.t < e.life; });
        g.globalCompositeOperation = 'lighter';
        S.embers.forEach(function (e) { g.fillStyle = 'rgba(255,' + (150 + Math.floor(e.s * 30)) + ',80,' + (0.7 * (1 - e.t / e.life)) + ')'; g.beginPath(); g.arc(e.x, e.y, e.s, 0, 7); g.fill(); });
        g.globalCompositeOperation = 'source-over';
        // виньетка и плавный вход
        const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.95);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
        g.fillStyle = vg; g.fillRect(0, 0, w, h);
        if (T < 1400) { g.fillStyle = 'rgba(0,0,0,' + (1 - T / 1400) + ')'; g.fillRect(0, 0, w, h); }
      }
      requestAnimationFrame(frame);
    });
  };

  DW.Splash = SP;
})(window.DW);
