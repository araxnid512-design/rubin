'use strict';
/* Процедурная графика: небо, фоны, предметы, отсеки убежища, иконки. Всё рисуется один раз при запуске. */
(function () {
  const A = window.ART = {};
  const { canvas, rr, lg } = U, PI = Math.PI, TAU = PI * 2;
  const OUT = '#0a0806';
  const spr = (w, h, ax, ay, fn, sc) => { const [c, x] = canvas(w, h, sc || 2); fn(x); return { c, w, h, ax, ay }; };
  A.put = function (x, s, px, py, k, flip) {
    k = k || 1;
    if (flip) { x.save(); x.translate(px, py); x.scale(-1, 1); x.drawImage(s.c, -s.ax * k, -s.ay * k, s.w * k, s.h * k); x.restore(); }
    else x.drawImage(s.c, px - s.ax * k, py - s.ay * k, s.w * k, s.h * k);
  };
  const circ = (x, a, b, r) => { x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); };
  const ell = (x, a, b, rx, ry, rot) => { x.beginPath(); x.ellipse(a, b, rx, ry, rot || 0, 0, TAU); x.fill(); };
  const poly = (x, p) => { x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); x.fill(); };
  const ln = (x, a, b, c, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
  const R = (x, X, Y, W, H, c) => { x.fillStyle = c; x.fillRect(X, Y, W, H); };
  const box = (x, X, Y, W, H, c, r) => { x.fillStyle = OUT; rr(x, X - 1.7, Y - 1.7, W + 3.4, H + 3.4, (r || 1) + 1.7); x.fill(); x.fillStyle = c; rr(x, X, Y, W, H, r || 1); x.fill(); };
  function streaks(x, rnd, X, Y, W, H, n, c) {
    for (let i = 0; i < n; i++) { const px = X + rnd() * W, py = Y + rnd() * H * 0.4, l = 8 + rnd() * H * 0.6; x.fillStyle = lg(x, 0, py, 0, py + l, [c, 'rgba(0,0,0,0)']); x.fillRect(px, py, 1 + rnd() * 3, l); }
  }
  function blots(x, rnd, X, Y, W, H, n, cols) { for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; ell(x, X + rnd() * W, Y + rnd() * H, 2 + rnd() * 10, 1 + rnd() * 5, rnd() * 3); } }

  /* ---------- Небо ---------- */
  const SKY = [[0, [56, 64, 90], [198, 134, 96], 0.35], [0.08, [84, 108, 132], [178, 174, 154], 0], [0.48, [92, 118, 142], [186, 186, 166], 0], [0.58, [72, 72, 102], [212, 126, 84], 0.18],
    [0.66, [34, 38, 62], [112, 70, 76], 0.55], [0.74, [11, 15, 28], [26, 32, 50], 0.84], [0.92, [11, 15, 28], [26, 32, 50], 0.84], [1, [56, 64, 90], [198, 134, 96], 0.35]];
  A.sky = function (ph) {
    ph = ((ph % 1) + 1) % 1; let i = 0; while (SKY[i + 1][0] < ph) i++;
    const a = SKY[i], b = SKY[i + 1], t = (ph - a[0]) / (b[0] - a[0]);
    const top = U.mixRGB(a[1], b[1], t), bot = U.mixRGB(a[2], b[2], t);
    return { top, bot, dark: a[3] + (b[3] - a[3]) * t, ph };
  };
  let clouds = null, stars = null;
  A.drawSky = function (x, W, horizon, camx, sk) {
    for (let i = 0, N = 7; i < N; i++) { x.fillStyle = U.rgb(U.mixRGB(sk.top, sk.bot, Math.pow(i / (N - 1), 1.3))); x.fillRect(0, Math.floor(horizon * i / N), W, Math.ceil(horizon / N) + 1); }
    const ph = sk.ph, H = horizon;
    if (sk.dark > 0.3) { x.globalAlpha = (sk.dark - 0.3) * 1.6; x.drawImage(stars, 0, 0, W, H * 0.9); x.globalAlpha = 1; }
    if (ph < 0.64) {   // солнце
      const a = ph / 0.64, sx = W * (0.15 + a * 0.7), sy = H * (0.9 - Math.sin(a * PI) * 0.7);
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.55; x.drawImage(A.glow, sx - H * 0.4, sy - H * 0.4, H * 0.8, H * 0.8); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      x.fillStyle = ph > 0.5 || ph < 0.06 ? '#ffd7a0' : '#fff4dc'; circ(x, sx, sy, H * 0.045);
    } else if (ph > 0.68 && ph < 0.98) {
      const a = (ph - 0.68) / 0.3, sx = W * (0.2 + a * 0.6), sy = H * (0.85 - Math.sin(a * PI) * 0.62);
      x.fillStyle = '#dfe4e8'; circ(x, sx, sy, H * 0.04); x.fillStyle = U.rgb(sk.top, 0.9); circ(x, sx + H * 0.018, sy - H * 0.01, H * 0.036);
    }
    const ck = 1 - sk.dark * 0.7;
    x.globalAlpha = 0.8 * ck;
    const cw = clouds.width / 2, off = ((camx * 0.05 + performance.now() * 0.004) % cw + cw) % cw;
    for (let px = -off * (H / 300); px < W; px += cw * (H / 300)) x.drawImage(clouds, px, H * 0.08, cw * (H / 300) + 1, clouds.height / 2 * (H / 300));
    x.globalAlpha = 1;
  };

  /* ---------- Слои фона ---------- */
  function hills(seed, col) {
    const [c, x] = canvas(1200, 260, 1), r = U.rng(seed);
    for (let k = 0; k < 2; k++) {
      x.fillStyle = k ? col : 'rgba(60,72,82,.55)'; x.beginPath(); x.moveTo(0, 260);
      for (let px = 0; px <= 1200; px += 20) x.lineTo(px, 150 + k * 40 - Math.sin(px / 190 + seed + k) * 30 - U.noise(px / 60 + k * 9) * 30);
      x.lineTo(1200, 260); x.fill(); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 2; x.stroke();
      for (let i = 0; i < 160; i++) { const px = r() * 1200, b = 150 + k * 40 - Math.sin(px / 190 + seed + k) * 30 - U.noise(px / 60 + k * 9) * 30 + 4, h = 10 + r() * 16; poly(x, [px - 4, b, px, b - h, px + 4, b]); }
    }
    return c;
  }
  function skyline(seed, col, dense) {
    const [c, x] = canvas(1200, 260, 1), r = U.rng(seed);
    for (let px = -20; px < 1220;) {
      const w = 40 + r() * 80, h = 60 + r() * (dense ? 190 : 120);
      x.fillStyle = col; x.beginPath(); x.moveTo(px, 260); x.lineTo(px, 260 - h);
      const broken = r() < 0.5; for (let i = 1; i <= 4; i++) x.lineTo(px + w * i / 4, 260 - h + (broken ? (r() - 0.2) * 40 : 0));
      x.lineTo(px + w, 260); x.fill();
      x.fillStyle = 'rgba(0,0,0,.35)'; for (let j = 0; j < h / 15 - 1; j++) for (let i = 0; i < w / 11 - 1; i++) if (r() < 0.55) x.fillRect(px + 4 + i * 11, 260 - h + 14 + j * 15, 5, 7);
      if (r() < 0.12) { x.strokeStyle = col; x.lineWidth = 3; ln(x, px + w / 2, 260 - h, px + w / 2, 260 - h - 70); ln(x, px + w / 2 - 50, 260 - h - 62, px + w / 2 + 40, 260 - h - 62); x.lineWidth = 1; ln(x, px + w / 2 + 30, 260 - h - 62, px + w / 2 + 30, 260 - h - 20); }
      px += w + r() * 18;
    }
    return c;
  }
  function treeline(seed, col, dead) {
    const [c, x] = canvas(1200, 260, 1), r = U.rng(seed);
    x.fillStyle = col; x.strokeStyle = col; x.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const px = r() * 1200, h = 90 + r() * 140;
      if (!dead || r() < 0.5) { for (let k = 0; k < 7; k++) { const y = 260 - h + k * h / 8, w = 6 + k * (6 + r() * 2); poly(x, [px - w, y + h / 7, px, y - 4, px + w, y + h / 7]); } x.fillRect(px - 2, 230, 4, 30); }
      else { const br = (a, b, ang, l, w) => { if (l < 8) return; const ex = a + Math.cos(ang) * l, ey = b + Math.sin(ang) * l; x.lineWidth = w; ln(x, a, b, ex, ey); br(ex, ey, ang - 0.35 - r() * 0.4, l * 0.7, w * 0.68); br(ex, ey, ang + 0.3 + r() * 0.4, l * 0.7, w * 0.68); }; br(px, 262, -PI / 2, h * 0.35, 7); }
    }
    x.fillRect(0, 248, 1200, 12);
    return c;
  }
  function poles(seed, col) {
    const [c, x] = canvas(1200, 260, 1), r = U.rng(seed);
    x.strokeStyle = col; x.fillStyle = col;
    const ps = []; for (let px = 30; px < 1200; px += 180 + r() * 40) { const t = (r() - 0.5) * 0.12; ps.push([px, t]); x.lineWidth = 6; ln(x, px, 262, px + t * 150, 110); x.lineWidth = 4; ln(x, px + t * 150 - 26, 122, px + t * 150 + 26, 120); }
    x.lineWidth = 1.2; for (let i = 0; i < ps.length - 1; i++) for (const o of [-20, 20]) { const a = ps[i], b = ps[i + 1], ax = a[0] + a[1] * 150 + o, bx = b[0] + b[1] * 150 + o; x.beginPath(); x.moveTo(ax, 121); x.quadraticCurveTo((ax + bx) / 2, 150, bx, 121); x.stroke(); }
    for (let i = 0; i < 26; i++) { const px = r() * 1200, h = 50 + r() * 70; for (let k = 0; k < 5; k++) { const y = 262 - h + k * h / 6, w = 5 + k * 5; poly(x, [px - w, y + h / 6, px, y - 3, px + w, y + h / 6]); } }
    x.fillRect(560, 120, 150, 70); x.fillRect(600, 190, 8, 72); x.fillRect(660, 190, 8, 72);
    x.fillRect(0, 250, 1200, 12);
    return c;
  }
  A.layers = {};
  function mkLayers() {
    A.layers.home = { far: hills(3, 'rgba(46,56,62,.95)'), mid: treeline(7, 'rgba(24,30,28,.95)', true) };
    A.layers.forest = { far: hills(11, 'rgba(44,54,58,.95)'), mid: treeline(13, 'rgba(22,32,28,.96)', false) };
    A.layers.gas = { far: hills(17, 'rgba(48,54,62,.95)'), mid: poles(19, 'rgba(26,28,30,.95)') };
    A.layers.city = { far: skyline(23, 'rgba(46,52,64,.95)', true), mid: skyline(29, 'rgba(28,30,36,.97)', false) };
  }
  // рисует дальний и средний слой с параллаксом и дымкой
  A.drawLayers = function (x, kind, W, horizon, camx, z, sk) {
    const L = A.layers[kind];
    [[L.far, 0.12, 0.85], [L.mid, 0.35, 1.05]].forEach(([im, par, k]) => {
      const w = 1200 * z * k, h = 260 * z * k; let x0 = -(((camx * par * z) % w) + w) % w;
      for (; x0 < W; x0 += w) x.drawImage(im, x0, horizon - h + 2 * z, w + 1, h);
      x.fillStyle = lg(x, 0, horizon - h, 0, horizon, [U.rgb(sk.bot, 0), U.rgb(sk.bot, 0.38 - k * 0.15)]); x.fillRect(0, horizon - h, W, h);
    });
  };

  /* ---------- Земля ---------- */
  function groundTile(kind) {
    const [c, x] = canvas(256, 140, 2), r = U.rng(kind.length * 31);
    const base = { home: ['#4a3d2e', '#2e261d'], forest: ['#46392b', '#2a2219'], gas: ['#3b3b3a', '#232322'], city: ['#3e3d3b', '#262524'] }[kind];
    x.fillStyle = lg(x, 0, 10, 0, 140, base); x.fillRect(0, 10, 256, 130);
    blots(x, r, 0, 16, 256, 120, 140, ['rgba(0,0,0,.18)', 'rgba(255,240,210,.05)', 'rgba(20,14,8,.25)']);
    if (kind === 'gas' || kind === 'city') {
      R(x, 0, 10, 256, 7, '#555452'); R(x, 0, 10, 256, 1.5, '#7a7975');
      x.strokeStyle = 'rgba(10,10,10,.6)'; x.lineWidth = 1; for (let i = 0; i < 9; i++) { let px = r() * 256, py = 18; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 24; py += 4 + r() * 8; x.lineTo(px, py); } x.stroke(); }
      if (kind === 'city') { for (let i = 0; i < 8; i++) R(x, i * 32, 10, 1, 7, 'rgba(0,0,0,.4)'); }
      for (let i = 0; i < 14; i++) { x.strokeStyle = ['#4a5a30', '#3a4826'][i % 2]; x.lineWidth = 1.2; const px = r() * 256; ln(x, px, 11, px + (r() - 0.5) * 3, 4 + r() * 4); }
    } else {
      R(x, 0, 8, 256, 6, kind === 'home' ? '#3e4a2c' : '#3a4a2a');
      for (let i = 0; i < 260; i++) { x.strokeStyle = ['#3c4a2a', '#56623a', '#2c3820', '#6a6a40'][i & 3]; x.lineWidth = 1.2; const px = r() * 256, h = 3 + r() * 9; ln(x, px, 13, px + (r() - 0.5) * 4, 13 - h); }
      for (let i = 0; i < 18; i++) { x.fillStyle = ['#5a554c', '#47433c'][i % 2]; ell(x, r() * 256, 22 + r() * 110, 2 + r() * 6, 1.5 + r() * 4); }
      x.strokeStyle = 'rgba(30,20,12,.5)'; x.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const px = r() * 256; x.beginPath(); x.moveTo(px, 16); x.quadraticCurveTo(px + 10, 40, px + (r() - 0.5) * 30, 60 + r() * 40); x.stroke(); }
    }
    return c;
  }
  A.ground = {};

  /* ---------- Предметы на поверхности ---------- */
  function car(col, r) {
    return spr(160, 70, 80, 64, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 80, 63, 76, 5);
      for (const [wx, fl] of [[36, 0], [124, 1]]) { x.fillStyle = OUT; ell(x, wx, 52 + fl * 2, 12.5, 12.5 - fl * 2); x.fillStyle = '#18191a'; ell(x, wx, 52 + fl * 2, 11, 11 - fl * 2); x.fillStyle = '#4a4e52'; ell(x, wx, 52 + fl * 2, 5, 5 - fl); }
      x.fillStyle = OUT; poly(x, [5, 50, 4, 34, 14, 28, 44, 26, 58, 8, 108, 8, 126, 26, 152, 30, 156, 40, 155, 50]);
      x.fillStyle = lg(x, 0, 8, 0, 52, [col[0], col[1], col[2]]); poly(x, [7, 48, 6, 35, 15, 30, 45, 28, 59, 10, 107, 10, 124, 28, 150, 32, 153, 40, 153, 48]);
      x.fillStyle = '#121618'; poly(x, [49, 27, 61, 13, 80, 13, 80, 27]); poly(x, [84, 27, 84, 13, 104, 13, 117, 27]);
      x.fillStyle = 'rgba(180,205,215,.2)'; poly(x, [55, 27, 62, 15, 68, 15, 61, 27]); poly(x, [90, 27, 92, 15, 96, 15, 94, 27]);
      x.strokeStyle = 'rgba(200,220,230,.4)'; x.lineWidth = 0.6; for (let i = 0; i < 8; i++) { const a = r() * TAU; ln(x, 100, 20, 100 + Math.cos(a) * 6, 20 + Math.sin(a) * 6); }
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; ln(x, 82, 28, 82, 47); ln(x, 47, 30, 46, 47); ln(x, 118, 30, 118, 46); ln(x, 8, 38, 152, 38);
      R(x, 64, 32, 7, 1.6, 'rgba(0,0,0,.6)'); R(x, 98, 32, 7, 1.6, 'rgba(0,0,0,.6)');
      R(x, 147, 33, 5, 4, '#cfc8a4'); R(x, 6, 34, 4, 4, '#5a1a14'); R(x, 2, 44, 10, 5, '#3a3e40'); R(x, 148, 44, 9, 5, '#3a3e40');
      x.fillStyle = 'rgba(255,255,255,.12)'; R(x, 18, 31, 128, 1.3, 'rgba(255,255,255,.14)');
      for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(' + (92 + r() * 50 | 0) + ',' + (40 + r() * 20 | 0) + ',16,' + (0.3 + r() * 0.45) + ')'; const px = 10 + r() * 140, py = 12 + r() * 34; ell(x, px, py, 1.5 + r() * 6, 1 + r() * 3.5, r() * 3); if (r() < 0.4) x.fillRect(px - 0.5, py, 1.1, 3 + r() * 8); }
    });
  }
  function van() {
    return spr(180, 90, 90, 84, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 90, 83, 86, 5);
      for (const wx of [40, 140]) { x.fillStyle = OUT; circ(x, wx, 71, 13); x.fillStyle = '#18191a'; circ(x, wx, 71, 11.5); x.fillStyle = '#5a5e62'; circ(x, wx, 71, 5); }
      x.fillStyle = OUT; poly(x, [4, 70, 4, 14, 128, 12, 150, 34, 176, 42, 177, 70]);
      x.fillStyle = lg(x, 0, 12, 0, 70, ['#8a8a78', '#6a6a5a', '#3e3e34']); poly(x, [6, 68, 6, 16, 127, 14, 148, 36, 174, 44, 175, 68]);
      x.fillStyle = '#121618'; poly(x, [131, 20, 146, 36, 131, 36]); x.fillRect(96, 20, 26, 16);
      x.fillStyle = 'rgba(180,205,215,.18)'; poly(x, [134, 23, 138, 23, 142, 34, 138, 34]);
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; ln(x, 60, 16, 60, 66); ln(x, 92, 16, 92, 66); ln(x, 128, 16, 128, 66); ln(x, 6, 48, 174, 48);
      R(x, 10, 6, 110, 4, '#3a3a34'); for (let i = 0; i < 6; i++) R(x, 14 + i * 20, 4, 3, 8, '#3a3a34');
      R(x, 22, 2, 30, 6, '#5a4a32'); R(x, 60, 0, 24, 8, '#4a5638');
      R(x, 168, 48, 6, 6, '#e8dca0'); R(x, 20, 26, 30, 16, 'rgba(0,0,0,.25)');
      x.fillStyle = '#b8a040'; x.font = '900 10px sans-serif'; x.fillText('ВЫХОД', 63, 32);
    });
  }
  function barrel(col, fire) {
    return spr(34, 46, 17, 44, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 17, 44, 16, 3);
      box(x, 3, 4, 28, 40, U.lg(x, 3, 0, 31, 0, [col[2], col[0], col[1], col[2]]), 3);
      R(x, 3, 14, 28, 2, 'rgba(0,0,0,.4)'); R(x, 3, 30, 28, 2, 'rgba(0,0,0,.4)'); R(x, 7, 6, 3, 36, 'rgba(255,255,255,.12)');
      const r = U.rng(col[0].length + (fire ? 9 : 0)); for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(' + (100 + r() * 50 | 0) + ',50,20,.5)'; ell(x, 5 + r() * 24, 8 + r() * 34, 1 + r() * 4, 1 + r() * 3); }
      if (fire) { x.fillStyle = '#100c08'; for (let i = 0; i < 4; i++) circ(x, 9 + i * 5.5, 22 + (i % 2) * 6, 1.8); x.fillStyle = '#1a1410'; ell(x, 17, 5, 13, 3); }
    });
  }
  function crate(mil) {
    return spr(46, 38, 23, 36, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 23, 36, 22, 3);
      box(x, 2, 4, 42, 32, mil ? U.lg(x, 0, 4, 0, 36, ['#5c6644', '#3e4630']) : U.lg(x, 0, 4, 0, 36, ['#8a6a44', '#5e4428']), 1.5);
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; for (let i = 1; i < 4; i++) ln(x, 2, 4 + i * 8, 44, 4 + i * 8);
      if (mil) { R(x, 8, 4, 4, 32, '#2a2f1e'); R(x, 34, 4, 4, 32, '#2a2f1e'); x.fillStyle = '#c9c2a0'; x.font = '700 7px sans-serif'; x.fillText('★', 20, 23); }
      else { x.strokeStyle = '#3a2a18'; x.lineWidth = 2.4; ln(x, 4, 6, 42, 34); }
    });
  }
  function dumpster() {
    return spr(92, 60, 46, 58, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 46, 58, 44, 3);
      x.fillStyle = OUT; poly(x, [4, 14, 88, 14, 84, 54, 8, 54]); x.fillStyle = U.lg(x, 0, 14, 0, 54, ['#3e5a4a', '#24362c']); poly(x, [5, 15, 87, 15, 83, 53, 9, 53]);
      x.fillStyle = OUT; poly(x, [2, 14, 90, 14, 86, 4, 6, 8]); x.fillStyle = '#2e4638'; poly(x, [4, 13, 88, 13, 85, 6, 7, 9]);
      for (let i = 0; i < 5; i++) R(x, 14 + i * 15, 18, 2, 32, 'rgba(0,0,0,.25)');
      x.fillStyle = '#1a1a18'; circ(x, 16, 55, 3); circ(x, 76, 55, 3);
      x.fillStyle = '#3a3a34'; poly(x, [30, 13, 40, 2, 50, 12]); x.fillStyle = '#5a5248'; poly(x, [52, 13, 60, 4, 70, 13]);
    });
  }
  function fridge() {
    return spr(40, 70, 20, 68, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 20, 68, 18, 3);
      box(x, 4, 2, 32, 66, U.lg(x, 4, 0, 36, 0, ['#b8b4a6', '#d8d4c6', '#9a9688']), 4);
      R(x, 4, 24, 32, 1.5, 'rgba(0,0,0,.45)'); R(x, 30, 8, 2, 12, '#6a6a64'); R(x, 30, 30, 2, 16, '#6a6a64');
      const r = U.rng(5); for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(110,70,30,' + (0.2 + r() * 0.3) + ')'; ell(x, 6 + r() * 28, 4 + r() * 62, 1 + r() * 4, 1 + r() * 3); }
    });
  }
  function locker() {
    return spr(36, 74, 18, 72, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 18, 72, 17, 3);
      box(x, 3, 2, 30, 70, U.lg(x, 3, 0, 33, 0, ['#4a5a5e', '#5e7074', '#3a4648']), 1.5);
      R(x, 17.5, 2, 1, 70, 'rgba(0,0,0,.6)'); for (let i = 0; i < 4; i++) { R(x, 6, 8 + i * 3, 9, 1, '#1e2628'); R(x, 21, 8 + i * 3, 9, 1, '#1e2628'); }
      R(x, 13, 34, 2, 6, '#b8bcbc'); R(x, 21, 34, 2, 6, '#b8bcbc');
    });
  }
  function pump() {
    return spr(40, 80, 20, 78, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 20, 78, 20, 3);
      box(x, 4, 8, 32, 70, U.lg(x, 4, 0, 36, 0, ['#9a2a24', '#c23a30', '#7a1e1a']), 3);
      R(x, 8, 14, 24, 14, '#1a1e20'); R(x, 10, 16, 20, 3, '#3a6a4a'); R(x, 10, 22, 12, 3, '#3a6a4a');
      R(x, 8, 34, 24, 26, '#d8d0b8'); for (let i = 0; i < 3; i++) R(x, 11, 38 + i * 7, 18, 3, '#9a9282');
      x.strokeStyle = '#141414'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(36, 30); x.quadraticCurveTo(46, 50, 36, 70); x.stroke();
      R(x, 2, 4, 36, 6, '#e8e0c8');
    });
  }
  function canopy() {
    return spr(560, 170, 280, 168, x => {
      for (const px of [70, 490]) box(x, px - 7, 34, 14, 134, U.lg(x, px - 7, 0, px + 7, 0, ['#8a8a84', '#b8b8b0', '#6a6a64']), 1);
      box(x, 10, 6, 540, 30, U.lg(x, 0, 6, 0, 36, ['#d8d4c4', '#a8a498']), 2);
      R(x, 10, 22, 540, 6, '#a82a22'); R(x, 10, 28, 540, 2, '#5a1612');
      x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 12; i++) x.fillRect(30 + i * 44, 8, 1, 14);
      box(x, 230, -2, 100, 24, '#1e2a3a', 2); x.fillStyle = '#e8c44a'; x.font = '900 16px sans-serif'; x.textAlign = 'center'; x.fillText('АЗС 24', 280, 16);
      R(x, 150, 36, 70, 4, 'rgba(0,0,0,.4)'); const r = U.rng(4); streaks(x, r, 10, 6, 540, 30, 30, 'rgba(70,40,20,.45)');
      x.fillStyle = 'rgba(0,0,0,.3)'; poly(x, [380, 36, 400, 36, 396, 54]);
    });
  }
  function shop() {
    return spr(300, 150, 150, 148, x => {
      box(x, 4, 20, 292, 128, U.lg(x, 0, 20, 0, 148, ['#8a8478', '#6a655a']), 2);
      R(x, 4, 14, 292, 12, '#3a3a36'); R(x, 4, 26, 292, 4, '#a82a22');
      for (const px of [20, 190]) { box(x, px, 50, 80, 60, '#141a1e', 1); x.fillStyle = 'rgba(160,190,200,.2)'; poly(x, [px + 4, 110, px + 30, 56, px + 44, 56, px + 18, 110]); x.strokeStyle = 'rgba(200,220,230,.4)'; x.lineWidth = 0.8; for (let i = 0; i < 6; i++) ln(x, px + 60, 70, px + 50 + i * 6, 56 + (i % 3) * 20); }
      box(x, 118, 60, 54, 88, '#0e1012', 1); R(x, 118, 60, 54, 4, '#3a3a36');
      x.fillStyle = '#e8c44a'; x.font = '900 13px sans-serif'; x.textAlign = 'center'; x.fillText('МАГАЗИН', 150, 46);
      const r = U.rng(8); streaks(x, r, 4, 20, 292, 128, 30, 'rgba(50,40,30,.4)'); blots(x, r, 4, 110, 292, 38, 20, ['rgba(40,30,20,.3)']);
      for (let i = 0; i < 6; i++) { x.fillStyle = ['#5a5248', '#4a453c'][i % 2]; ell(x, 20 + r() * 260, 146, 6 + r() * 12, 3 + r() * 3); }
    });
  }
  function facade(seed) {
    return spr(280, 300, 140, 298, x => {
      const r = U.rng(seed), floors = 3 + (r() * 2 | 0), top = 300 - floors * 66;
      x.fillStyle = OUT; x.beginPath(); x.moveTo(6, 300); x.lineTo(6, top); for (let i = 1; i <= 8; i++) x.lineTo(6 + i * 33.5, top + (r() < 0.5 ? r() * 40 : 0)); x.lineTo(274, 300); x.fill();
      x.save(); x.clip(); x.fillStyle = lg(x, 0, top, 0, 300, [['#7a7266', '#6a6a70', '#76665a'][seed % 3], '#4a4642']); x.fillRect(0, 0, 280, 300);
      for (let f = 0; f < floors; f++) { const y = 300 - (f + 1) * 66; R(x, 6, y + 62, 268, 4, 'rgba(0,0,0,.25)'); if (f === 0) continue; for (let i = 0; i < 4; i++) { const wx = 22 + i * 64; box(x, wx, y + 12, 36, 40, '#101214', 1); if (r() < 0.6) { x.fillStyle = 'rgba(150,180,190,.18)'; poly(x, [wx, y + 52, wx + 14, y + 26, wx + 22, y + 52]); } R(x, wx - 3, y + 52, 42, 3, '#3a3836'); } }
      box(x, 112, 220, 56, 80, '#0a0b0c', 1); R(x, 108, 216, 64, 6, '#3a3836');
      box(x, 24, 236, 60, 44, '#121416', 1); box(x, 196, 236, 60, 44, '#121416', 1);
      streaks(x, r, 6, top, 268, 300 - top, 40, 'rgba(30,24,18,.4)'); blots(x, r, 6, top, 268, 300 - top, 30, ['rgba(0,0,0,.12)', 'rgba(90,110,60,.18)']);
      x.strokeStyle = 'rgba(12,12,12,.6)'; x.lineWidth = 1.3; for (let i = 0; i < 8; i++) { let px = r() * 280, py = top + r() * 150; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 30; py += r() * 26; x.lineTo(px, py); } x.stroke(); }
      x.restore();
      for (let i = 0; i < 12; i++) { x.fillStyle = ['#5d5a54', '#4a4743', '#6a665e'][i % 3]; ell(x, 10 + r() * 260, 296, 6 + r() * 14, 4 + r() * 5); }
    });
  }
  function pine(seed) {
    return spr(124, 236, 62, 232, x => {
      const r = U.rng(seed); x.fillStyle = 'rgba(0,0,0,.32)'; ell(x, 62, 232, 36, 4.5);
      box(x, 57, 120, 10, 112, U.lg(x, 57, 0, 67, 0, ['#5e4632', '#3a2a1c', '#1e150c']), 1);
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.8; for (let i = 0; i < 6; i++) { const py = 140 + r() * 80; ln(x, 59 + r() * 6, py, 59 + r() * 6, py + 8); }
      for (let k = 0; k < 7; k++) {
        const y = 20 + k * 26, w = 13 + k * 6.8 + r() * 4, h = 42, pts = [62, y - 5];
        for (let i = 1; i <= 4; i++) { const t = i / 4; pts.push(62 + w * t * (0.88 + r() * 0.16) + (i % 2 ? 3 : -2), y + h * t * 0.86); }
        for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(62 + w - 2 * w * t, y + h + (i % 2 ? 4 + r() * 5 : -2)); }
        for (let i = 4; i >= 1; i--) { const t = i / 4; pts.push(62 - w * t * (0.88 + r() * 0.16) - (i % 2 ? 3 : -2), y + h * t * 0.86); }
        x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath();
        x.strokeStyle = OUT; x.lineWidth = 2.2; x.stroke();
        x.fillStyle = lg(x, 62 - w, 0, 62 + w, 0, ['#40604a', '#26402f', '#10201a']); x.fill();
        x.save(); x.clip(); x.lineCap = 'round';
        for (let i = 0; i < 80; i++) {
          const py = y + r() * h, k2 = Math.max(0.1, (py - y) / h), px = 62 + (r() * 2 - 1) * w * k2, dx = (px - 62) / w, l = 5 + r() * 6, lit = 0.55 - dx * 0.5 + (r() - 0.5) * 0.5;
          x.strokeStyle = lit > 0.75 ? '#6a8c68' : lit > 0.45 ? '#3e5e46' : lit > 0.2 ? '#22392b' : '#0d1a13'; x.lineWidth = 1.3; ln(x, px, py, px + dx * l, py + l * 0.75);
        }
        x.fillStyle = lg(x, 0, y - 4, 0, y + h + 8, ['rgba(230,240,210,.08)', 'rgba(0,0,0,0)', 'rgba(0,8,4,.55)']); x.fillRect(62 - w - 6, y - 6, w * 2 + 12, h + 16);
        x.restore();
      }
    });
  }
  function deadTree(seed) {
    return spr(140, 210, 70, 206, x => {
      const r = U.rng(seed); x.lineCap = 'round';
      const br = (a, b, ang, l, w) => { if (l < 7) return; const ex = a + Math.cos(ang) * l, ey = b + Math.sin(ang) * l; x.strokeStyle = OUT; x.lineWidth = w + 2; ln(x, a, b, ex, ey); x.strokeStyle = '#3a2e24'; x.lineWidth = w; ln(x, a, b, ex, ey); br(ex, ey, ang - 0.32 - r() * 0.4, l * 0.7, w * 0.66); br(ex, ey, ang + 0.28 + r() * 0.4, l * 0.7, w * 0.66); };
      br(70, 208, -PI / 2, 64, 10);
    });
  }
  function bush(berries) {
    return spr(70, 46, 35, 44, x => {
      const r = U.rng(berries ? 3 : 4); x.fillStyle = 'rgba(0,0,0,.3)'; ell(x, 35, 44, 32, 3);
      const bl = []; for (let i = 0; i < 9; i++) bl.push([35 + (r() - 0.5) * 44, 28 + (r() - 0.5) * 16, 9 + r() * 7]);
      x.fillStyle = OUT; for (const b of bl) circ(x, b[0], b[1], b[2] + 1.2);
      for (const b of bl) { x.fillStyle = '#26381e'; circ(x, b[0], b[1], b[2]); }
      for (let i = 0; i < 90; i++) { const b = bl[(r() * bl.length) | 0], a = r() * TAU, d = Math.sqrt(r()) * b[2]; x.fillStyle = ['#3d5631', '#4f6a3a', '#2f4426'][(r() * 3) | 0]; ell(x, b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d - 1, 2.6, 1.6, r() * 3); }
      if (berries) for (let i = 0; i < 12; i++) { const px = 14 + r() * 42, py = 20 + r() * 18; x.fillStyle = '#4a0a12'; circ(x, px, py + 0.6, 2.4); x.fillStyle = '#b01c2c'; circ(x, px, py, 2); }
    });
  }
  function corpse() {
    return spr(64, 20, 32, 18, x => {
      x.fillStyle = 'rgba(60,10,8,.5)'; ell(x, 30, 17, 28, 3);
      x.lineCap = 'round'; const L2 = (a, b, c, d, w, col) => { x.strokeStyle = OUT; x.lineWidth = w + 2; ln(x, a, b, c, d); x.strokeStyle = col; x.lineWidth = w; ln(x, a, b, c, d); };
      L2(10, 14, 30, 13, 9, '#3a3e34'); L2(30, 14, 44, 15, 6, '#2a2c30'); L2(44, 15, 58, 15, 5, '#2a2c30'); L2(18, 11, 26, 4, 4, '#3a3e34');
      x.fillStyle = OUT; circ(x, 4, 12, 6.6); x.fillStyle = '#b8b29c'; circ(x, 4, 12, 5.4); x.fillStyle = '#1a1712'; circ(x, 2, 11, 1.4);
      box(x, 14, 0, 14, 10, '#5a4a32', 2);
    });
  }
  function rock() { return spr(50, 30, 25, 28, x => { x.fillStyle = OUT; poly(x, [3, 28, 8, 12, 20, 4, 36, 6, 46, 16, 48, 28]); x.fillStyle = lg(x, 0, 4, 0, 28, ['#8a867c', '#5a5650']); poly(x, [5, 27, 9, 13, 20, 6, 35, 8, 44, 17, 46, 27]); x.fillStyle = 'rgba(90,110,60,.4)'; ell(x, 20, 9, 7, 2.6); }); }
  function sign() {
    return spr(40, 110, 20, 108, x => {
      x.save(); x.translate(20, 108); x.rotate(0.08);
      x.fillStyle = OUT; x.fillRect(-2.6, -64, 5.2, 64); x.fillStyle = '#6a6f72'; x.fillRect(-1.6, -64, 3.2, 64);
      x.fillStyle = OUT; poly(x, [0, -104, 19, -84, 0, -64, -19, -84]); x.fillStyle = '#b89a3a'; poly(x, [0, -100, 16, -84, 0, -68, -16, -84]);
      x.fillStyle = '#1c1a14'; x.fillRect(-1.6, -94, 3.2, 13); x.fillRect(-1.6, -78, 3.2, 3.2);
      x.restore();
    });
  }
  function lamp() {
    return spr(70, 200, 14, 198, x => {
      x.lineCap = 'round'; x.strokeStyle = OUT; x.lineWidth = 7; x.beginPath(); x.moveTo(14, 198); x.lineTo(14, 24); x.quadraticCurveTo(16, 10, 54, 14); x.stroke();
      x.strokeStyle = '#5a6064'; x.lineWidth = 4.6; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.15)'; x.lineWidth = 1; ln(x, 13, 196, 13, 28);
      box(x, 46, 11, 22, 7, '#2e3236', 3); R(x, 6, 182, 16, 16, '#3a3e42');
    });
  }
  function fence() {
    return spr(130, 70, 65, 68, x => {
      for (const px of [6, 64, 122]) box(x, px - 2.5, 4, 5, 64, '#5a6064', 1);
      x.strokeStyle = 'rgba(150,158,160,.55)'; x.lineWidth = 0.8;
      for (let i = -8; i < 26; i++) { ln(x, 6 + i * 7, 8, 6 + i * 7 + 54, 62); ln(x, 6 + i * 7 + 54, 8, 6 + i * 7, 62); }
      x.clearRect(0, 0, 6, 70); x.clearRect(122, 0, 8, 70); x.clearRect(70, 30, 30, 40);
      R(x, 6, 7, 116, 2.4, '#5a6064');
    });
  }
  function tires() { return spr(60, 44, 30, 42, x => { for (const [px, py] of [[18, 32], [42, 32], [30, 14]]) { x.fillStyle = OUT; ell(x, px, py, 14, 11); x.fillStyle = '#1e1f1e'; ell(x, px, py, 12.6, 9.6); x.fillStyle = '#0a0a0a'; ell(x, px, py, 5, 4); } }); }
  function sandbags() { return spr(80, 36, 40, 34, x => { for (let j = 0; j < 3; j++) for (let i = 0; i < 4 - j; i++) { const px = 12 + i * 18 + j * 9, py = 28 - j * 10; x.fillStyle = OUT; ell(x, px, py, 10, 6.4); x.fillStyle = ['#8a7a58', '#7a6c4c'][(i + j) % 2]; ell(x, px, py, 9, 5.4); R(x, px - 6, py, 12, 0.8, 'rgba(0,0,0,.3)'); } }); }
  function bench() { return spr(80, 40, 40, 38, x => { R(x, 6, 18, 68, 5, '#5a4630'); R(x, 6, 8, 68, 4, '#5a4630'); for (const px of [12, 66]) R(x, px, 8, 4, 30, '#2e2a26'); }); }
  function hatch() {
    return spr(200, 120, 100, 118, x => {
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 100, 118, 100, 5);
      x.fillStyle = OUT; poly(x, [10, 118, 20, 30, 182, 30, 192, 118]);
      x.fillStyle = lg(x, 0, 30, 0, 118, ['#7d7f78', '#5a5c58', '#3c3e3c']); poly(x, [12, 117, 22, 32, 180, 32, 190, 117]);
      box(x, 14, 22, 172, 12, U.lg(x, 0, 22, 0, 34, ['#9a9c94', '#6a6c66']), 1);
      for (let i = 0; i < 12; i++) R(x, 18 + i * 14, 34, 7, 5, i % 2 ? '#c9a23a' : '#1b1b1b');
      const r = U.rng(2); streaks(x, r, 20, 40, 160, 78, 20, 'rgba(40,30,20,.45)'); blots(x, r, 20, 90, 160, 28, 14, ['rgba(70,90,50,.4)']);
      x.strokeStyle = 'rgba(15,15,15,.6)'; x.lineWidth = 1.2; ln(x, 34, 50, 46, 80); ln(x, 46, 80, 38, 108); ln(x, 160, 46, 168, 70);
      box(x, 66, 46, 68, 72, '#1a1c1d', 2);
      R(x, 150, 60, 20, 14, '#2a2e30'); R(x, 152, 62, 16, 10, '#c9a23a'); x.fillStyle = '#1b1b1b'; poly(x, [160, 63, 166, 71, 154, 71]);
      box(x, 30, 4, 8, 26, '#4a4e50', 1); R(x, 26, 0, 16, 5, '#3a3e40');
    });
  }
  function hatchDoor(dmg) {
    return spr(64, 70, 32, 70, x => {
      x.fillStyle = lg(x, 0, 0, 64, 0, ['#4f5e52', '#62746a', '#3d4a42']); U.rr(x, 2, 2, 60, 68, 2); x.fill();
      x.strokeStyle = '#26302a'; x.lineWidth = 3; x.beginPath(); x.arc(32, 36, 12, 0, TAU); x.stroke();
      x.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * PI / 4; ln(x, 32 - Math.cos(a) * 12, 36 - Math.sin(a) * 12, 32 + Math.cos(a) * 12, 36 + Math.sin(a) * 12); }
      for (let i = 0; i < 5; i++) for (const px of [7, 57]) { x.fillStyle = '#2a332d'; circ(x, px, 8 + i * 14, 1.6); }
      if (dmg) { const r = U.rng(dmg * 7); for (let i = 0; i < dmg * 6; i++) { x.fillStyle = 'rgba(0,0,0,.45)'; ell(x, 6 + r() * 52, 6 + r() * 60, 2 + r() * 5, 1.5 + r() * 4); } x.strokeStyle = 'rgba(10,10,10,.8)'; x.lineWidth = 1.4; for (let i = 0; i < dmg * 3; i++) { let px = 8 + r() * 48, py = 6 + r() * 56; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (r() - 0.5) * 18; py += r() * 14; x.lineTo(px, py); } x.stroke(); } x.fillStyle = 'rgba(120,52,20,.4)'; for (let i = 0; i < dmg * 5; i++) ell(x, 4 + r() * 56, 4 + r() * 62, 1 + r() * 4, 1 + r() * 3); }
    });
  }
  function antenna() {
    return spr(60, 200, 30, 198, x => {
      x.strokeStyle = OUT; x.lineWidth = 3.4; ln(x, 30, 198, 30, 10); x.strokeStyle = '#7a8084'; x.lineWidth = 2; ln(x, 30, 198, 30, 10);
      x.strokeStyle = '#5a6064'; x.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const y = 24 + i * 24, w = 22 - i * 2.4; ln(x, 30 - w, y, 30 + w, y); }
      x.strokeStyle = 'rgba(60,60,60,.7)'; x.lineWidth = 0.8; ln(x, 30, 60, 4, 198); ln(x, 30, 60, 56, 198);
    });
  }

  /* ---------- Отсеки убежища ---------- */
  const CW = D.CW, CH = D.CH, FY = CH - D.FLOOR;
  const WALL = {
    hatch: ['#5c5d58', '#3c3d3a'], stairs: ['#4c4d4a', '#2e2f2d'], living: ['#6a6052', '#4a4238'], power: ['#5c5a50', '#3a3832'], water: ['#4f5a5e', '#323c40'],
    garden: ['#4e584a', '#323a2e'], storage: ['#5e584c', '#3e3a32'], infirmary: ['#7a7c76', '#56584f'], workshop: ['#585650', '#383632'], radio: ['#4c5058', '#30323a']
  };
  function roomBase(x, k, r) {
    const wc = WALL[k];
    x.fillStyle = lg(x, 0, 10, 0, FY, wc); x.fillRect(0, 0, CW, FY);
    if (k === 'water' || k === 'infirmary') { x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1; for (let y = 28; y < FY; y += 14) ln(x, 0, y, CW, y); for (let y = 28, j = 0; y < FY; y += 14, j++) for (let px = (j % 2) * 7; px < CW; px += 14) ln(x, px, y, px, y + 14); }
    else { x.fillStyle = 'rgba(0,0,0,.22)'; for (let px = 0; px < CW; px += 55) x.fillRect(px, 14, 1.2, FY - 14); x.fillRect(0, 70, CW, 1.2); x.fillStyle = 'rgba(255,255,255,.04)'; for (let px = 1.2; px < CW; px += 55) x.fillRect(px, 14, 1, FY - 14); x.fillRect(0, 71.2, CW, 1); x.fillStyle = 'rgba(0,0,0,.35)'; for (let px = 6; px < CW; px += 55) for (const y of [20, 64, 78, FY - 8]) { x.fillRect(px, y, 2, 2); x.fillRect(px + 44, y, 2, 2); } }
    streaks(x, r, 4, 14, CW - 8, FY - 14, 14, 'rgba(70,46,26,.3)');
    blots(x, r, 0, 14, CW, FY - 14, 10, ['rgba(0,0,0,.08)', 'rgba(60,40,20,.1)']);
    // пол
    R(x, 0, FY, CW, D.FLOOR, '#222426'); R(x, 0, FY, CW, 2, '#6a6e70'); R(x, 0, FY + 2, CW, 1, '#111');
    x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 22; i++) x.fillRect(i * 10 + 4, FY + 4, 1.2, D.FLOOR - 5);
    R(x, 0, FY - 6, CW, 6, 'rgba(0,0,0,.22)');
    // потолок и трубы
    R(x, 0, 0, CW, 14, '#18191a'); R(x, 0, 13, CW, 1.4, '#3e4240');
    box(x, -2, 16, CW + 4, 5, U.lg(x, 0, 16, 0, 21, ['#7a6a52', '#4a3e2e']), 2); box(x, -2, 23, CW + 4, 3.4, U.lg(x, 0, 23, 0, 26.4, ['#6a7074', '#3e4448']), 1.5);
    for (const px of [30, 110, 190]) R(x, px, 14, 3, 13, '#2a2c2e');
    // проёмы в боковых стенах
    for (const px of [0, CW - 7]) { R(x, px, 0, 7, FY - 66, '#2a2b29'); R(x, px, FY - 66, 7, 3, '#4a4c4a'); }
    // провода под потолком и затенение у пола
    x.strokeStyle = '#141414'; x.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const a = 14 + r() * 90, b = a + 50 + r() * 60; x.beginPath(); x.moveTo(a, 27); x.quadraticCurveTo((a + b) / 2, 36 + r() * 8, b, 27); x.stroke(); }
    x.fillStyle = lg(x, 0, FY - 26, 0, FY, ['rgba(0,0,0,0)', 'rgba(0,0,0,.32)']); x.fillRect(0, FY - 26, CW, 26);
    x.fillStyle = lg(x, 0, 14, 0, 40, ['rgba(0,0,0,.4)', 'rgba(0,0,0,0)']); x.fillRect(0, 14, CW, 26);
    // мягкая тень по углам
    x.fillStyle = 'rgba(0,0,0,.5)';
    for (let gy = 16; gy < FY; gy += 5) for (let gx = (gy % 10 ? 2.5 : 0); gx < CW; gx += 5) { const e = Math.min(gx, CW - gx, (gy - 14) * 1.6, (FY - gy) * 2.2), s = 1 - e / 46; if (s > 0) { x.beginPath(); x.arc(gx, gy, Math.min(2.4, s * 2.6), 0, TAU); x.fill(); } }
  }
  function lampFix(x, px) { R(x, px - 1, 14, 2, 8, '#1a1a1a'); x.fillStyle = OUT; poly(x, [px - 11, 30, px + 11, 30, px + 6, 22, px - 6, 22]); x.fillStyle = '#3a3e3a'; poly(x, [px - 10, 29, px + 10, 29, px + 5.4, 23, px - 5.4, 23]); x.fillStyle = '#fff1c8'; ell(x, px, 30, 7, 2.6); }
  const FURN = {
    hatch(x, r) {
      for (let i = 0; i < 3; i++) box(x, 18 + i * 22, FY - 70, 20, 70, U.lg(x, 0, 0, 20, 0, ['#4a5a5e', '#5e7074']), 1);
      for (let i = 0; i < 3; i++) { R(x, 27 + i * 22, FY - 40, 1.6, 6, '#c0c4c4'); for (let k = 0; k < 4; k++) R(x, 22 + i * 22, FY - 64 + k * 3, 12, 1, '#1e2628'); }
      box(x, 150, FY - 22, 56, 22, '#6a5c40', 3); box(x, 156, FY - 38, 44, 18, '#7a6a4a', 3);
      box(x, 162, 40, 36, 26, '#c9a23a', 1); x.fillStyle = '#1a1a1a'; poly(x, [180, 44, 192, 62, 168, 62]); x.fillStyle = '#c9a23a'; x.fillRect(178.6, 50, 2.8, 7);
      x.fillStyle = '#2a2a28'; for (let i = 0; i < 8; i++) R(x, 4 + i * 27, FY - 1, 14, 2, i % 2 ? '#c9a23a' : '#1b1b1b');
    },
    stairs() {},
    living(x) {
      for (const bx of [14, 128]) {
        R(x, bx, 44, 3, FY - 44, '#25282b'); R(x, bx + 66, 44, 3, FY - 44, '#25282b');
        for (const by of [70, 104]) { box(x, bx, by, 69, 4, '#34383c', 1); box(x, bx + 3, by - 9, 63, 8, U.lg(x, 0, by - 9, 0, by, ['#6a7052', '#4a5038']), 2); box(x, bx + 4, by - 13, 15, 6, '#c8c0a8', 2.5); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(bx + 22, by - 9, 1, 8); x.fillRect(bx + 40, by - 9, 1, 8); }
      }
      box(x, 92, FY - 30, 28, 30, '#5a4a36', 1); R(x, 94, FY - 22, 24, 1, 'rgba(0,0,0,.4)'); box(x, 100, FY - 42, 6, 12, '#3a3e40', 1); x.fillStyle = '#ffe6a8'; circ(x, 103, FY - 44, 3);
      box(x, 84, 36, 26, 30, '#c8bc98', 1); x.fillStyle = '#4a5a48'; x.fillRect(87, 39, 20, 15); x.fillStyle = '#a82a22'; x.font = '800 5px sans-serif'; x.fillText('ДОМ', 90, 61);
      x.fillStyle = 'rgba(140,60,40,.35)'; ell(x, 110, FY + 1, 34, 3);
    },
    power(x, r) {
      box(x, 14, FY - 52, 110, 52, U.lg(x, 0, FY - 52, 0, FY, ['#5a6254', '#3a4036']), 3);
      for (let i = 0; i < 11; i++) R(x, 20 + i * 9.6, FY - 44, 4.4, 30, '#232821');
      box(x, 26, FY - 70, 48, 18, '#4a5248', 2); box(x, 36, 20, 8, FY - 90, '#4a4038', 1);
      for (let i = 0; i < 12; i++) R(x, 14 + i * 9.2, FY - 4, 4.6, 4, i % 2 ? '#c9a23a' : '#141414');
      x.fillStyle = OUT; circ(x, 150, FY - 34, 26); x.fillStyle = '#2b3134'; circ(x, 150, FY - 34, 24); x.fillStyle = '#1a1e20'; circ(x, 150, FY - 34, 17);
      box(x, 182, 40, 30, 40, '#2b3033', 1); box(x, 186, 46, 22, 12, '#121416', 1);
      for (let i = 0; i < 2; i++) { x.fillStyle = '#d8d2bc'; circ(x, 191 + i * 12, 68, 4); x.strokeStyle = '#a82a22'; x.lineWidth = 1; ln(x, 191 + i * 12, 68, 193 + i * 12, 65); }
      x.strokeStyle = '#141414'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(197, 80); x.quadraticCurveTo(190, FY - 6, 176, FY - 2); x.stroke();
      box(x, 128, 34, 14, 22, '#6a4a2a', 1);
    },
    water(x) {
      for (const tx of [16, 104]) {
        box(x, tx, 34, 44, FY - 34, U.lg(x, tx, 0, tx + 44, 0, ['#6f8a94', '#4a6470', '#26363d']), 9);
        R(x, tx + 6, 42, 3, FY - 54, 'rgba(255,255,255,.18)'); R(x, tx, 58, 44, 2, 'rgba(0,0,0,.35)'); R(x, tx, 92, 44, 2, 'rgba(0,0,0,.35)');
        x.fillStyle = OUT; circ(x, tx + 22, 74, 7.6); x.fillStyle = '#d8d2bc'; circ(x, tx + 22, 74, 6.4); x.strokeStyle = '#a32a2a'; x.lineWidth = 1.3; ln(x, tx + 22, 74, tx + 26, 70);
        R(x, tx + 4, 70, 4, 12, '#3a8aa8');
      }
      box(x, 60, 46, 44, 5, '#5a6a70', 1); box(x, 158, 52, 5, 44, '#5a6a70', 1); box(x, 150, 96, 60, FY - 96, '#34464d', 2); R(x, 150, 96, 60, 3, '#55707a');
      box(x, 174, 82, 7, 14, '#2b3a40', 1);
    },
    garden(x, r) {
      for (const ty of [52, 86, 120]) {
        R(x, 12, ty - 30, 196, 2, '#d88ad0'); R(x, 12, ty - 28, 196, 3, '#3a2e3a');
        box(x, 10, ty, 200, 6, '#4a4438', 1);
        for (let i = 0; i < 15; i++) {
          const px = 18 + i * 12.6, h = 6 + ((i * 7 + ty) % 7);
          x.fillStyle = OUT; ell(x, px, ty - h / 2, 5.6, h / 2 + 1.6);
          x.fillStyle = ['#3f7a38', '#58963f', '#2f6130'][i % 3]; ell(x, px, ty - h / 2, 4.6, h / 2 + 0.6); ell(x, px + 4, ty - h / 3, 3, h / 3 + 1, 0.5);
          if (i % 4 === 1) { x.fillStyle = '#c0392b'; circ(x, px + 1, ty - 3, 2); }
        }
      }
      R(x, 10, 20, 3, FY - 20, '#33302a'); R(x, 207, 20, 3, FY - 20, '#33302a');
    },
    storage(x, r) {
      R(x, 12, 30, 3, FY - 30, '#2a2d2f'); R(x, 118, 30, 3, FY - 30, '#2a2d2f');
      for (const sy of [58, 88, FY - 2]) box(x, 12, sy, 109, 3, '#3d4144', 0.5);
      const cols = ['#6e5a3a', '#55643f', '#5a4a44', '#7a6a46', '#465660'];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const w = 18 + ((i * 5 + j * 3) % 8), h = 14 + ((i + j * 2) % 3) * 5, px = 17 + i * 25, py = [58, 88, FY - 2][j] - h; box(x, px, py, w, h, cols[(i + j * 2) % 5], 1); R(x, px, py, w, 2, 'rgba(255,255,255,.12)'); R(x, px + w / 2 - 1, py, 2, h, 'rgba(0,0,0,.25)'); }
      for (const bx of [132, 158]) { box(x, bx, FY - 44, 22, 44, U.lg(x, bx, 0, bx + 22, 0, ['#3e2014', '#8f4a2c', '#6e3a26']), 3); R(x, bx, FY - 32, 22, 1.5, 'rgba(0,0,0,.4)'); R(x, bx, FY - 18, 22, 1.5, 'rgba(0,0,0,.4)'); }
      box(x, 184, FY - 32, 26, 32, '#5c6644', 1); box(x, 188, FY - 50, 18, 18, '#6e5a3a', 1);
      box(x, 140, 40, 60, 14, '#4a4e50', 1); x.fillStyle = '#c9c2a0'; x.font = '800 7px sans-serif'; x.fillText('ЗАПАСЫ', 152, 50);
    },
    infirmary(x) {
      box(x, 18, FY - 34, 84, 6, '#8a8f92', 1); box(x, 20, FY - 44, 80, 10, '#e4e0d4', 2); box(x, 20, FY - 48, 18, 8, '#fff', 3); R(x, 46, FY - 42, 54, 7, '#7a8a9a');
      R(x, 22, FY - 28, 3, 28, '#555'); R(x, 96, FY - 28, 3, 28, '#555');
      box(x, 108, 34, 2.4, FY - 34, '#9aa0a4', 0.5); box(x, 102, 34, 14, 2.4, '#9aa0a4', 0.5); box(x, 103, 38, 8, 14, '#cfe3ea', 2);
      x.strokeStyle = '#cfe3ea'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(107, 52); x.quadraticCurveTo(100, 70, 92, FY - 42); x.stroke();
      box(x, 150, 34, 56, FY - 34, '#d8d6cc', 2); R(x, 177, 34, 2, FY - 34, '#a8a69c'); R(x, 158, 46, 12, 4, '#b3262b'); R(x, 162, 42, 4, 12, '#b3262b');
      box(x, 118, 44, 26, 20, '#0f1a14', 1); box(x, 122, 64, 18, FY - 64, '#3a3e40', 1);
    },
    workshop(x) {
      box(x, 14, 30, 100, 44, '#4a4032', 1); x.fillStyle = 'rgba(0,0,0,.4)'; for (let j = 0; j < 4; j++) for (let i = 0; i < 9; i++) x.fillRect(20 + i * 11, 36 + j * 10, 1.6, 1.6);
      x.save(); x.translate(30, 52); x.rotate(-PI / 2); RIG.tool(x, 'hammer'); x.restore(); x.save(); x.translate(60, 64); x.rotate(-PI / 2); RIG.tool(x, 'machete'); x.restore(); x.save(); x.translate(92, 66); x.rotate(-PI / 2); RIG.tool(x, 'pipe'); x.restore();
      box(x, 12, FY - 36, 120, 7, '#8a6a44', 1); R(x, 12, FY - 36, 120, 2, '#a98858'); R(x, 18, FY - 29, 6, 29, '#4a3722'); R(x, 120, FY - 29, 6, 29, '#4a3722'); R(x, 18, FY - 14, 108, 3, '#4a3722');
      box(x, 26, FY - 48, 18, 12, '#4b5158', 1); R(x, 26, FY - 48, 18, 2, '#868e96'); box(x, 70, FY - 42, 34, 6, '#b9c2c9', 1); box(x, 100, FY - 48, 8, 12, '#7a3b22', 1);
      box(x, 152, FY - 64, 18, 64, U.lg(x, 152, 0, 170, 0, ['#5a6a3a', '#7a8a4a', '#4a5a2a']), 7); box(x, 176, FY - 58, 16, 58, U.lg(x, 176, 0, 192, 0, ['#8a2a22', '#b03a30', '#6a1a14']), 6);
      x.save(); x.translate(204, 104); x.rotate(-PI / 2 - 0.15); RIG.tool(x, 'axe'); x.restore();
    },
    radio(x) {
      box(x, 116, 26, 72, 44, '#b9ae8c', 1); R(x, 118, 28, 68, 40, '#cfc49e'); x.strokeStyle = 'rgba(90,70,40,.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(122, 58); x.quadraticCurveTo(140, 36, 154, 50); x.quadraticCurveTo(166, 60, 182, 38); x.stroke();
      x.fillStyle = '#b3262b'; circ(x, 154, 50, 2.2); circ(x, 133, 44, 1.6);
      box(x, 22, FY - 36, 150, 7, '#6e5a3e', 1); R(x, 22, FY - 36, 150, 2, '#8f7852'); R(x, 26, FY - 29, 5, 29, '#3d3222'); R(x, 162, FY - 29, 5, 29, '#3d3222');
      box(x, 40, FY - 72, 80, 36, '#2e3438', 2); R(x, 40, FY - 72, 80, 2, '#4f595f'); for (let i = 0; i < 6; i++) R(x, 46, FY - 66 + i * 4.6, 26, 1.6, '#15181a');
      for (const dx of [86, 104]) { x.fillStyle = OUT; circ(x, dx, FY - 56, 6.2); x.fillStyle = '#c9c2ac'; circ(x, dx, FY - 56, 5.2); x.strokeStyle = '#1b1b1b'; x.lineWidth = 1.2; ln(x, dx, FY - 56, dx + 3, FY - 59); }
      box(x, 80, FY - 46, 32, 4, '#15181a', 1); box(x, 128, FY - 52, 30, 16, '#3a3e40', 2); R(x, 132, FY - 49, 22, 10, '#1a3a2a');
      box(x, 196, 20, 3, FY - 20, '#5b6064', 0.5); for (let i = 0; i < 4; i++) R(x, 190, 30 + i * 10, 15, 1.5, '#5b6064');
    }
  };
  function roomSprite(k) {
    const [c, x] = canvas(CW, CH, 2), r = U.rng(k.length * 97 + 5);
    roomBase(x, k, r); FURN[k](x, r);
    if (k !== 'stairs') lampFix(x, k === 'hatch' ? 124 : CW / 2);
    return c;
  }
  function ladderSprite() {
    const [c, x] = canvas(40, CH, 2);
    R(x, 0, 0, 40, CH, 'rgba(10,10,10,.55)');
    for (const px of [6, 31]) { box(x, px, -2, 4, CH + 4, U.lg(x, px, 0, px + 4, 0, ['#8a9196', '#5b6064']), 1); }
    for (let i = 0; i < 12; i++) { R(x, 10, 6 + i * 12, 21, 3, '#4a4f53'); R(x, 10, 6 + i * 12, 21, 1, '#7d858a'); }
    return c;
  }
  function shaftHole() { const [c, x] = canvas(56, 18, 2); R(x, 0, 0, 56, 18, '#0b0c0c'); R(x, 0, 0, 56, 2, '#5a5e60'); R(x, 0, 16, 56, 2, '#2a2c2e'); for (let i = 0; i < 6; i++) R(x, 2 + i * 9.4, 2, 5, 2.4, i % 2 ? '#c9a23a' : '#1b1b1b'); return c; }
  function dirtTile() {
    const [c, x] = canvas(256, 256, 1), r = U.rng(5);
    R(x, 0, 0, 256, 256, '#3a2f24');
    blots(x, r, 0, 0, 256, 256, 600, ['rgba(20,14,8,.25)', 'rgba(90,72,52,.2)', 'rgba(60,46,32,.28)']);
    for (let i = 0; i < 14; i++) { const px = r() * 240, py = r() * 240, s = 3 + r() * 8; x.fillStyle = '#231d17'; ell(x, px, py + 1.5, s, s * 0.7); x.fillStyle = ['#5a554c', '#4a463f', '#625d54'][i % 3]; ell(x, px, py, s, s * 0.7); x.fillStyle = 'rgba(255,255,255,.08)'; ell(x, px - s * 0.3, py - s * 0.3, s * 0.4, s * 0.25); }
    x.strokeStyle = 'rgba(28,20,12,.6)'; x.lineWidth = 1.2; for (let i = 0; i < 5; i++) { let px = r() * 256, py = r() * 256; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 30; py += 6 + r() * 14; x.lineTo(px, py); } x.stroke(); }
    return c;
  }

  /* ---------- Иконки ---------- */
  function icon(fn) { const [c, x] = canvas(64, 64, 1.5); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 3; x.shadowOffsetY = 2; fn(x); return c.toDataURL(); }
  function mkIcons() {
    A.ICON = {
      energy: icon(x => { x.fillStyle = '#ffd24a'; poly(x, [38, 4, 14, 36, 30, 36, 24, 60, 50, 26, 34, 26]); }),
      water: icon(x => { x.fillStyle = lg(x, 0, 8, 0, 56, ['#8fe0ff', '#2b86c9']); x.beginPath(); x.moveTo(32, 6); x.bezierCurveTo(48, 26, 52, 34, 52, 40); x.arc(32, 40, 20, 0, PI); x.bezierCurveTo(12, 34, 16, 26, 32, 6); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; ell(x, 24, 40, 4, 8, 0.3); }),
      food: icon(x => { box(x, 16, 12, 32, 42, '#868f97', 5); x.fillStyle = '#c9d1d7'; ell(x, 32, 14, 16, 5); R(x, 16, 24, 32, 20, '#8a6a2a'); R(x, 22, 30, 20, 8, '#f0e6c8'); R(x, 19, 16, 4, 36, 'rgba(255,255,255,.25)'); }),
      scrap: icon(x => { x.fillStyle = '#9aa2a8'; x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr2 = i % 2 ? 22 : 16; x.lineTo(32 + Math.cos(a) * rr2, 32 + Math.sin(a) * rr2); } x.closePath(); x.fill(); x.fillStyle = '#5a6268'; circ(x, 32, 32, 8); x.fillStyle = '#c9d1d7'; poly(x, [8, 50, 20, 44, 24, 56, 10, 60]); }),
      meds: icon(x => { box(x, 8, 16, 48, 36, '#e8e2d4', 5); R(x, 26, 22, 12, 24, '#c22a30'); R(x, 20, 28, 24, 12, '#c22a30'); R(x, 24, 10, 16, 6, '#8a8a84'); }),
      ppl: icon(x => { x.fillStyle = '#d8d0b8'; circ(x, 32, 20, 11); x.beginPath(); x.moveTo(10, 58); x.quadraticCurveTo(12, 34, 32, 34); x.quadraticCurveTo(52, 34, 54, 58); x.fill(); }),
      skull: icon(x => { x.fillStyle = '#d8d0b8'; circ(x, 32, 28, 18); R(x, 22, 38, 20, 14, '#d8d0b8'); x.fillStyle = '#2a1a14'; circ(x, 25, 28, 5); circ(x, 39, 28, 5); poly(x, [32, 34, 29, 40, 35, 40]); for (let i = 0; i < 3; i++) R(x, 25 + i * 6, 44, 2, 8, '#2a1a14'); })
    };
    for (const w of ['pipe', 'machete', 'bat', 'axe']) A.ICON[w] = icon(x => { x.translate(14, 50); x.rotate(-PI / 4); x.scale(1.2, 1.2); RIG.tool(x, w); });
    A.ICON.fist = icon(x => { x.fillStyle = '#e0c4a0'; x.strokeStyle = '#2a1e14'; x.lineWidth = 2; rr(x, 14, 22, 36, 28, 9); x.fill(); x.stroke(); for (let i = 0; i < 4; i++) { rr(x, 14 + i * 9, 16, 9, 16, 4.5); x.fill(); x.stroke(); } });
    A.ICON.armor = icon(x => { box(x, 14, 10, 36, 46, '#4a5038', 6); R(x, 20, 18, 24, 12, '#3a4028'); R(x, 20, 34, 24, 12, '#3a4028'); R(x, 22, 6, 6, 8, '#4a5038'); R(x, 36, 6, 6, 8, '#4a5038'); });
    A.ICON.pack = icon(x => { box(x, 16, 14, 32, 42, '#5a4a32', 8); R(x, 22, 32, 20, 12, '#4a3a24'); ell(x, 32, 14, 14, 5); x.fillStyle = '#5c6343'; ell(x, 32, 12, 13, 5); });
    A.ICON.door = icon(x => { box(x, 12, 8, 40, 50, '#5a6a5e', 3); x.strokeStyle = '#26302a'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 10, 0, TAU); x.stroke(); });
  }

  /* ---------- Комиксные вставки ---------- */
  A.pop = function (x, p) {
    const age = p.max - p.life, k = age < 0.1 ? age / 0.1 * 1.3 : age < 0.18 ? 1.3 - (age - 0.1) / 0.08 * 0.3 : 1, s = p.size * k;
    x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.globalAlpha = Math.min(1, p.life * 4);
    x.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, r2 = (i % 2 ? 0.6 : 1) * s * (0.86 + ((i * 37) % 7) / 25); x.lineTo(Math.cos(a) * r2 * 1.4, Math.sin(a) * r2); } x.closePath();
    x.fillStyle = p.c; x.fill(); x.lineWidth = 2.6; x.strokeStyle = OUT; x.stroke();
    x.font = 'italic 900 ' + Math.round(s * 0.6) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 3.4; x.lineJoin = 'round'; x.strokeStyle = OUT; x.strokeText(p.t, 0, 1); x.fillStyle = p.tc || '#d42a1e'; x.fillText(p.t, 0, 1);
    x.restore(); x.textBaseline = 'alphabetic';
  };
  A.bubble = function (x, px, py, t, sz, bg) {
    sz = sz || 12; x.font = 'italic 900 ' + sz + 'px sans-serif'; const w = Math.max(sz * 1.2, x.measureText(t).width + sz * 0.9), h = sz * 1.5;
    x.fillStyle = bg || '#fbf3dc'; x.strokeStyle = OUT; x.lineWidth = 2.2; x.lineJoin = 'round';
    x.beginPath(); x.ellipse(px, py - h / 2, w / 2 + 2, h / 2 + 1, 0, 0, TAU); x.moveTo(px - 3, py + 0.5); x.lineTo(px - 6, py + 8); x.lineTo(px + 3, py); x.stroke(); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = OUT; x.fillText(t, px, py - h / 2 + 0.5); x.textBaseline = 'alphabetic';
  };
  A.WORDS = { hit: ['ТУК!', 'БУХ!', 'БАЦ!', 'ШМЯК!'], crit: ['ХРЯСЬ!', 'БА-БАХ!', 'КРАК!'], kill: ['ХРУСТЬ!', 'ШМЯК!'], hurt: ['АЙ!', 'УФ!', 'ОХ!'], door: ['БУМ!', 'БАМ!', 'ДЫЩ!'] };
  A.mkPop = (list, x, y, kind, big) => { if (list.length > 10) list.shift(); const w = A.WORDS[kind]; list.push({ x, y, t: w[(Math.random() * w.length) | 0], size: big ? 22 : 15, c: kind === 'hurt' ? '#fbf3dc' : kind === 'door' ? '#ffb02e' : big ? '#ffd43a' : '#fbf3dc', tc: kind === 'hurt' ? '#c0201c' : '#d42a1e', rot: (Math.random() - 0.5) * 0.4, life: 0.75, max: 0.75 }); };
  A.drawPops = (x, list) => { for (const p of list) A.pop(x, p); x.globalAlpha = 1; };
  A.stepPops = (list, dt) => { for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; list[i].y -= dt * 10; if (list[i].life <= 0) list.splice(i, 1); } };

  A.init = function () {
    A.glow = U.radial(128, [0, 'rgba(255,220,170,.9)', 0.3, 'rgba(255,190,120,.35)', 1, 'rgba(255,170,90,0)']);
    A.lampGlow = U.radial(128, [0, 'rgba(255,226,170,.55)', 0.45, 'rgba(255,210,150,.16)', 1, 'rgba(255,200,140,0)']);
    A.purpleGlow = U.radial(128, [0, 'rgba(230,110,220,.4)', 0.5, 'rgba(200,90,210,.12)', 1, 'rgba(200,90,210,0)']);
    A.redGlow = U.radial(128, [0, 'rgba(255,40,30,.6)', 0.5, 'rgba(255,40,30,.15)', 1, 'rgba(255,40,30,0)']);
    A.fireGlow = U.radial(128, [0, 'rgba(255,160,60,.75)', 0.4, 'rgba(255,110,30,.25)', 1, 'rgba(255,90,20,0)']);
    A.soft = U.radial(64, [0, 'rgba(0,0,0,1)', 0.5, 'rgba(0,0,0,.7)', 1, 'rgba(0,0,0,0)']);
    A.dust = U.radial(32, [0, 'rgba(170,155,125,.8)', 0.6, 'rgba(170,155,125,.3)', 1, 'rgba(170,155,125,0)']);
    A.smoke = U.radial(32, [0, 'rgba(110,108,104,.6)', 0.6, 'rgba(100,98,94,.25)', 1, 'rgba(100,98,94,0)']);
    { const [c, x] = canvas(128, 128, 1), g = x.createRadialGradient(0, 64, 0, 0, 64, 128); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 64); x.arc(0, 64, 126, -0.42, 0.42); x.closePath(); x.fill(); A.cone = c; }
    { const [c, x] = canvas(1024, 150, 2), r = U.rng(9);
      for (let i = 0; i < 6; i++) {
        const cx = 80 + i * 170 + r() * 40, cy = 50 + r() * 40, bl = []; for (let k = 0; k < 7; k++) bl.push([cx + (r() - 0.5) * 110, cy + (r() - 0.5) * 14 - Math.abs(k - 3) * -2, 14 + r() * 16]);
        x.fillStyle = OUT; for (const b of bl) circ(x, b[0], b[1], b[2] + 2.4); ell(x, cx, cy + 10, 74, 13);
        x.fillStyle = '#e9dfcf'; for (const b of bl) circ(x, b[0], b[1], b[2]); ell(x, cx, cy + 10, 71.6, 10.6);
        x.fillStyle = '#c9bdb0'; ell(x, cx, cy + 14, 66, 6.4);
      } clouds = c; }
    { const [c, x] = canvas(600, 260, 1), r = U.rng(31); for (let i = 0; i < 200; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.7) + ')'; x.fillRect(r() * 600, r() * 260, r() < 0.9 ? 1 : 2, 1); } stars = c; }
    // луч лампы, солнечный луч, туман, бетон
    { const [c, x] = canvas(220, 130, 1);
      for (const [k, a] of [[1, 0.1], [0.75, 0.12], [0.5, 0.14]]) { x.fillStyle = lg(x, 0, 0, 0, 130, ['rgba(255,232,180,' + a + ')', 'rgba(255,232,180,0)']); x.beginPath(); x.moveTo(110 - 12 * k, 0); x.lineTo(110 + 12 * k, 0); x.lineTo(110 + 105 * k, 130); x.lineTo(110 - 105 * k, 130); x.closePath(); x.fill(); }
      A.beam = c; }
    { const [c, x] = canvas(64, 512, 1); const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 512); x.globalCompositeOperation = 'destination-in'; x.fillStyle = lg(x, 0, 0, 0, 512, ['rgba(0,0,0,1)', 'rgba(0,0,0,0)']); x.fillRect(0, 0, 64, 512); A.ray = c; }
    A.mist = U.radial(256, [0, 'rgba(196,202,200,.55)', 0.5, 'rgba(196,202,200,.22)', 1, 'rgba(196,202,200,0)'], 0.3);
    { const [c, x] = canvas(64, 64, 1), r = U.rng(41); R(x, 0, 0, 64, 64, '#55544d'); blots(x, r, 0, 0, 64, 64, 60, ['rgba(0,0,0,.14)', 'rgba(255,255,255,.05)', 'rgba(60,40,20,.1)']); x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 4; i++) x.fillRect(4 + i * 16, 30, 2, 2); A.conc = c; }
    // передний план для вылазок (тайлится по горизонтали)
    A.fg = {};
    for (const kind of ['forest', 'gas', 'city', 'home']) {
      const [c, x] = canvas(800, 100, 1.5), r = U.rng(kind.length * 13 + 3), P = 6.2832 / 800;
      x.fillStyle = '#0a0c09'; x.beginPath(); x.moveTo(0, 100); for (let px = 0; px <= 800; px += 10) x.lineTo(px, 78 + Math.sin(px * P * 3) * 6 + Math.sin(px * P * 7 + 1) * 4); x.lineTo(800, 100); x.closePath(); x.fill();
      x.strokeStyle = '#0a0c09'; x.lineCap = 'round';
      const blades = kind === 'city' ? 70 : 240;
      for (let i = 0; i < blades; i++) { const px = 6 + r() * 788, h = 12 + r() * (kind === 'forest' ? 44 : 30), b = (r() - 0.5) * 18; x.lineWidth = 1.4 + r() * 1.6; x.beginPath(); x.moveTo(px, 84); x.quadraticCurveTo(px + b * 0.3, 84 - h * 0.6, px + b, 84 - h); x.stroke(); }
      if (kind === 'forest' || kind === 'home') for (let i = 0; i < 8; i++) { const px = 40 + r() * 720; x.lineWidth = 1.6; for (let k = 0; k < 7; k++) { const a = -2.6 + k * 0.33, l = 26 + r() * 12; x.beginPath(); x.moveTo(px, 84); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5, 84 + Math.sin(a) * l * 0.8, px + Math.cos(a) * l, 84 + Math.sin(a) * l * 0.55); x.stroke(); } }
      if (kind === 'city' || kind === 'gas') for (let i = 0; i < 16; i++) { const px = 20 + r() * 760, w = 14 + r() * 30, h = 8 + r() * 20; x.fillStyle = '#0a0c09'; x.beginPath(); x.moveTo(px, 86); x.lineTo(px + w * 0.2, 86 - h); x.lineTo(px + w * 0.7, 86 - h * (0.6 + r() * 0.5)); x.lineTo(px + w, 86); x.fill(); if (kind === 'city' && r() < 0.5) { x.lineWidth = 1.4; ln(x, px + w * 0.4, 86 - h, px + w * 0.4 + (r() - 0.5) * 20, 86 - h - 14 - r() * 14); } }
      A.fg[kind] = c;
    }
    mkLayers();
    for (const k of ['home', 'forest', 'gas', 'city']) A.ground[k] = groundTile(k);
    const r = U.rng(77);
    A.P = {
      car: [car(['#8a9296', '#5a6064', '#2e3236'], r), car(['#8a5a43', '#5e3e2b', '#2e1f18'], r), car(['#5b6950', '#3e4a38', '#20281d'], r)],
      van: van(), barrel: [barrel(['#8f4a2c', '#6e3a26', '#3e2014']), barrel(['#3f5a56', '#56736c', '#22302e']), barrel(['#6e6a3a', '#8a8548', '#35331c'])],
      fireb: barrel(['#4a4a46', '#5a5a54', '#2a2a26'], true), crate: [crate(false), crate(true)], dumpster: dumpster(), fridge: fridge(), locker: locker(), pump: pump(),
      canopy: canopy(), shop: shop(), facade: [facade(1), facade(2), facade(3)], pine: [pine(1), pine(2), pine(3)], dead: [deadTree(4), deadTree(5)],
      bush: bush(true), bush0: bush(false), corpse: corpse(), rock: rock(), sign: sign(), lamp: lamp(), fence: fence(), tires: tires(), sandbags: sandbags(), bench: bench(),
      hatch: hatch(), hdoor: [hatchDoor(0), hatchDoor(1), hatchDoor(2), hatchDoor(3)], antenna: antenna()
    };
    A.room = {}; for (const k in FURN) A.room[k] = roomSprite(k);
    A.ladder = ladderSprite(); A.hole = shaftHole(); A.dirt = dirtTile();
    mkIcons();
  };
})();
