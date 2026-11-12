'use strict';
/* Отрисовка тактического боя в изометрии: объёмные укрытия, фигуры, эффекты */
(function (DW) {
  const U = DW.U, D = DW.D, ART = DW.ART;
  const TR = {};
  const HW = 32, HH = 16;   // половина ширины/высоты клетки-ромба
  const ZH = 52;            // высота объекта при lift = 1
  const P = 64;             // пикселей на клетку в плоской текстуре земли
  const GS = 1.5;           // масштаб изометрического слоя земли
  const EDGE = 30;          // толщина «среза» диорамы

  let ground = null, groundCtx = null;   // плоская текстура
  let gIso = null, gIsoCtx = null;        // изометрическая проекция
  let sprites = {};
  let fogC = null, fogV = -1;
  const tweens = {};
  let fx = { floats: [], tracers: [], parts: [], projs: [], flashes: [] };
  let camWaiters = [];
  let props = {};
  let fires = {};
  TR.cam = { x: 0, y: 0, z: 1, tx: null, ty: null };
  TR.view = { w: 800, h: 400 };
  TR.overlay = null;

  function canvas(w, h) { return ART.canvas(w, h); }
  let clockT = performance.now();
  function now() { return clockT; }
  function spd() { return (DW.settings && DW.settings.speed) || 1; }
  function rt(ms) { return ms / (DW.timeScale || 1); }
  function iso(x, y) { return [(x - y) * HW, (x + y) * HH]; }
  function isoC(x, y) { return [(x - y) * HW, (x + y + 1) * HH]; }
  TR.iso = iso; TR.isoC = isoC;

  /* ---------- Земля ---------- */
  function drawGroundTile(g, x, y, gid, rnd) {
    const base = D.GROUND[gid].c;
    const hv = U.hash2(x, y, 7);
    const X = x * P, Y = y * P;
    g.fillStyle = U.shade(base, (hv - 0.5) * 0.14);
    g.fillRect(X, Y, P, P);
    let i;
    switch (gid) {
      case 3: // бетон
        g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2;
        g.strokeRect(X + 1, Y + 1, P - 2, P - 2);
        for (i = 0; i < 3; i++) { g.fillStyle = 'rgba(30,25,20,' + (0.08 + rnd() * 0.1) + ')'; g.beginPath(); g.arc(X + rnd() * P, Y + rnd() * P, 3 + rnd() * 9, 0, 7); g.fill(); }
        if (rnd() < 0.4) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; g.beginPath(); let cx = X + rnd() * P, cy = Y + rnd() * P; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (rnd() - 0.5) * 20; cy += (rnd() - 0.5) * 20; g.lineTo(cx, cy); } g.stroke(); }
        break;
      case 4: // металл
        g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2; g.strokeRect(X + 2, Y + 2, P - 4, P - 4);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(X, Y, P, P);
        g.fillStyle = 'rgba(200,210,220,0.25)';
        [[6, 6], [P - 6, 6], [6, P - 6], [P - 6, P - 6]].forEach(function (p) { g.beginPath(); g.arc(X + p[0], Y + p[1], 2, 0, 7); g.fill(); });
        if (rnd() < 0.3) { g.fillStyle = 'rgba(90,50,30,0.25)'; g.beginPath(); g.arc(X + rnd() * P, Y + rnd() * P, 6 + rnd() * 10, 0, 7); g.fill(); }
        break;
      case 6: // плоть
        g.strokeStyle = 'rgba(120,30,50,0.5)'; g.lineWidth = 2;
        for (i = 0; i < 2; i++) { g.beginPath(); g.moveTo(X + rnd() * P, Y + rnd() * P); g.quadraticCurveTo(X + rnd() * P, Y + rnd() * P, X + rnd() * P, Y + rnd() * P); g.stroke(); }
        for (i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,10,20,0.3)'; g.beginPath(); g.arc(X + rnd() * P, Y + rnd() * P, 2 + rnd() * 6, 0, 7); g.fill(); }
        break;
      case 7: // кислота
        g.fillStyle = '#3e6a18'; g.fillRect(X, Y, P, P);
        for (i = 0; i < 5; i++) { g.fillStyle = 'rgba(160,230,60,' + (0.15 + rnd() * 0.25) + ')'; g.beginPath(); g.arc(X + rnd() * P, Y + rnd() * P, 3 + rnd() * 10, 0, 7); g.fill(); }
        for (i = 0; i < 4; i++) { g.strokeStyle = 'rgba(220,255,140,0.4)'; g.lineWidth = 1; g.beginPath(); g.arc(X + rnd() * P, Y + rnd() * P, 1.5 + rnd() * 3, 0, 7); g.stroke(); }
        break;
      case 9: // вышка / помост
        g.fillStyle = '#6b4b2b'; g.fillRect(X, Y, P, P);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
        for (i = 1; i < 6; i++) { g.beginPath(); g.moveTo(X, Y + i * P / 6); g.lineTo(X + P, Y + i * P / 6); g.stroke(); }
        g.strokeStyle = '#3e2a16'; g.lineWidth = 5; g.strokeRect(X + 3, Y + 3, P - 6, P - 6);
        break;
      case 10:
        g.fillStyle = '#0a0808'; g.fillRect(X, Y, P, P);
        break;
      default:
        for (i = 0; i < 12; i++) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + (0.08 + rnd() * 0.12) + ')' : 'rgba(255,240,210,' + (0.04 + rnd() * 0.07) + ')';
          const s = 1 + rnd() * 3;
          g.fillRect(X + rnd() * P, Y + rnd() * P, s, s);
        }
        if (gid === 8) {
          for (i = 0; i < 6; i++) { g.fillStyle = U.shade('#7a746c', (rnd() - 0.5) * 0.4); g.beginPath(); const cx = X + rnd() * P, cy = Y + rnd() * P, r = 2 + rnd() * 5; g.moveTo(cx - r, cy); g.lineTo(cx, cy - r); g.lineTo(cx + r, cy + r * 0.3); g.closePath(); g.fill(); }
        }
        if (gid === 2 && rnd() < 0.6) {
          g.strokeStyle = 'rgba(25,18,10,0.45)'; g.lineWidth = 1.5; g.beginPath();
          let cx = X + rnd() * P, cy = Y + rnd() * P; g.moveTo(cx, cy);
          for (let k = 0; k < 5; k++) { cx += (rnd() - 0.5) * 22; cy += (rnd() - 0.5) * 22; g.lineTo(cx, cy); }
          g.stroke();
        }
        if (gid === 5) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(X, Y, P, P); }
    }
  }
  function drawDecor(g, d, rnd) {
    const X = d.x * P, Y = d.y * P;
    let i;
    switch (d.t) {
      case 'crack':
        g.strokeStyle = 'rgba(20,14,8,0.4)'; g.lineWidth = 1.6; g.beginPath();
        let cx = X, cy = Y; g.moveTo(cx, cy);
        for (i = 0; i < 6; i++) { cx += (rnd() - 0.3) * 26; cy += (rnd() - 0.5) * 26; g.lineTo(cx, cy); }
        g.stroke();
        break;
      case 'scorch': {
        const gr = g.createRadialGradient(X, Y, 2, X, Y, 40 + rnd() * 30);
        gr.addColorStop(0, 'rgba(10,8,6,0.55)'); gr.addColorStop(1, 'rgba(10,8,6,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(X, Y, 70, 0, 7); g.fill();
        break;
      }
      case 'bones':
        g.strokeStyle = 'rgba(220,210,190,0.75)'; g.lineWidth = 3; g.lineCap = 'round';
        for (i = 0; i < 3; i++) { const a = rnd() * 6.28, l = 6 + rnd() * 10; const bx = X + (rnd() - 0.5) * 16, by = Y + (rnd() - 0.5) * 16; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * l, by + Math.sin(a) * l); g.stroke(); }
        if (rnd() < 0.5) { g.fillStyle = 'rgba(225,215,195,0.8)'; g.beginPath(); g.arc(X, Y, 5, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(X - 3, Y - 1, 2, 2); g.fillRect(X + 1, Y - 1, 2, 2); }
        g.lineCap = 'butt';
        break;
      case 'grass':
        g.strokeStyle = 'rgba(150,130,70,0.6)'; g.lineWidth = 1.3;
        for (i = 0; i < 7; i++) { const bx = X + (rnd() - 0.5) * 14; g.beginPath(); g.moveTo(bx, Y); g.lineTo(bx + (rnd() - 0.5) * 8, Y - 5 - rnd() * 8); g.stroke(); }
        break;
      case 'crystal':
        for (i = 0; i < 3; i++) {
          const bx = X + (rnd() - 0.5) * 18, by = Y + (rnd() - 0.5) * 18, s = 3 + rnd() * 4;
          g.fillStyle = 'rgba(95,212,230,' + (0.35 + rnd() * 0.4) + ')';
          g.beginPath(); g.moveTo(bx, by - s * 1.6); g.lineTo(bx + s * 0.6, by); g.lineTo(bx, by + s * 0.4); g.lineTo(bx - s * 0.6, by); g.closePath(); g.fill();
        }
        break;
      case 'blood':
        g.fillStyle = 'rgba(90,15,15,0.45)';
        for (i = 0; i < 5; i++) { g.beginPath(); g.arc(X + (rnd() - 0.5) * 20, Y + (rnd() - 0.5) * 20, 2 + rnd() * 7, 0, 7); g.fill(); }
        break;
      case 'veins':
        g.strokeStyle = 'rgba(160,50,90,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X, Y);
        g.bezierCurveTo(X + (rnd() - 0.5) * 80, Y + (rnd() - 0.5) * 80, X + (rnd() - 0.5) * 80, Y + (rnd() - 0.5) * 80, X + (rnd() - 0.5) * 120, Y + (rnd() - 0.5) * 120);
        g.stroke();
        break;
      case 'road': {
        const Y0 = d.y * P, Wd = (d.w || 40) * P;
        g.fillStyle = 'rgba(42,40,38,0.88)'; g.fillRect(0, Y0, Wd, P * 2);
        g.fillStyle = 'rgba(90,85,80,0.5)'; g.fillRect(0, Y0, Wd, 3); g.fillRect(0, Y0 + P * 2 - 3, Wd, 3);
        for (i = 0; i < Wd / 40; i++) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0,0.25' : '120,115,105,0.18') + ')'; g.beginPath(); g.arc(rnd() * Wd, Y0 + rnd() * P * 2, 3 + rnd() * 12, 0, 7); g.fill(); }
        for (let x = 10; x < Wd; x += 52) { if (rnd() < 0.8) { g.fillStyle = 'rgba(214,176,74,0.75)'; g.fillRect(x, Y0 + P - 3, 28, 6); } }
        g.strokeStyle = 'rgba(15,12,10,0.6)'; g.lineWidth = 1.5;
        for (i = 0; i < Wd / 90; i++) { let cx = rnd() * Wd, cy = Y0 + rnd() * P * 2; g.beginPath(); g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (rnd() - 0.5) * 30; cy += (rnd() - 0.5) * 20; g.lineTo(cx, cy); } g.stroke(); }
        break;
      }
      case 'fire':
        g.fillStyle = 'rgba(20,15,10,0.7)'; g.beginPath(); g.arc(X, Y, 16, 0, 7); g.fill();
        g.fillStyle = '#6a625a';
        for (i = 0; i < 8; i++) { const a = i / 8 * 6.28; g.beginPath(); g.arc(X + Math.cos(a) * 16, Y + Math.sin(a) * 12, 4, 0, 7); g.fill(); }
        break;
      default: break;
    }
  }
  function buildGround(B) {
    ground = canvas(B.w * P, B.h * P);
    groundCtx = ground.getContext('2d');
    const g = groundCtx;
    const rnd = U.srng(B.seed);
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) drawGroundTile(g, x, y, B.ground[y * B.w + x], rnd);
    const nw = B.w * 4, nh = B.h * 4;
    const nc = canvas(nw, nh);
    const ng = nc.getContext('2d');
    const img = ng.createImageData(nw, nh);
    const sd = B.seed % 9973;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const v = U.fbm(x * 0.09, y * 0.09, sd, 3);
      const k = (y * nw + x) * 4;
      const c = v > 0.5 ? 255 : 0;
      img.data[k] = c; img.data[k + 1] = c * 0.92; img.data[k + 2] = c * 0.8;
      img.data[k + 3] = Math.min(255, Math.abs(v - 0.5) * 2 * 90);
    }
    ng.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(nc, 0, 0, ground.width, ground.height);
    B.decor.forEach(function (d) { drawDecor(g, d, rnd); });
    // сетка
    g.strokeStyle = 'rgba(255,240,200,0.045)'; g.lineWidth = 1;
    for (let x = 0; x <= B.w; x++) { g.beginPath(); g.moveTo(x * P, 0); g.lineTo(x * P, B.h * P); g.stroke(); }
    for (let y = 0; y <= B.h; y++) { g.beginPath(); g.moveTo(0, y * P); g.lineTo(B.w * P, y * P); g.stroke(); }
  }
  TR.tileChanged = function (x, y) {
    const B = DW.BT.get();
    if (!B || !groundCtx) return;
    const rnd = U.srng(x * 31 + y * 17);
    drawGroundTile(groundCtx, x, y, B.ground[y * B.w + x], rnd);
    for (let i = 0; i < 5; i++) {
      groundCtx.fillStyle = U.shade('#7a746c', (rnd() - 0.5) * 0.5);
      groundCtx.beginPath();
      const cx = x * P + rnd() * P, cy = y * P + rnd() * P, r = 3 + rnd() * 6;
      groundCtx.moveTo(cx - r, cy); groundCtx.lineTo(cx, cy - r); groundCtx.lineTo(cx + r, cy + r * 0.4); groundCtx.closePath(); groundCtx.fill();
    }
    projectTile(x, y);
  };

  /* ---------- Изометрическая проекция земли и срез диорамы ---------- */
  function buildIso(B) {
    const W = (B.w + B.h) * HW, H = (B.w + B.h) * HH;
    gIso = canvas(W * GS, (H + EDGE + 4) * GS);
    gIsoCtx = gIso.getContext('2d');
    const g = gIsoCtx;
    g.imageSmoothingEnabled = true;
    g.setTransform(HW * GS / P, HH * GS / P, -HW * GS / P, HH * GS / P, B.h * HW * GS, 0);
    g.drawImage(ground, 0, 0);
    g.setTransform(GS, 0, 0, GS, B.h * HW * GS, 0);
    const a = iso(0, B.h), b = iso(B.w, B.h), c = iso(B.w, 0);
    let gr = g.createLinearGradient(0, a[1], 0, b[1] + EDGE);
    gr.addColorStop(0, '#5a4632'); gr.addColorStop(1, '#1c140e');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0], b[1] + EDGE); g.lineTo(a[0], a[1] + EDGE); g.closePath(); g.fill();
    gr = g.createLinearGradient(0, c[1], 0, b[1] + EDGE);
    gr.addColorStop(0, '#3e3022'); gr.addColorStop(1, '#120c08');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0], b[1] + EDGE); g.lineTo(c[0], c[1] + EDGE); g.closePath(); g.fill();
    // пласты породы
    const rnd = U.srng(B.seed + 5);
    for (let k = 1; k < 4; k++) {
      const dy = k * EDGE / 4 + (rnd() - 0.5) * 3;
      g.strokeStyle = 'rgba(0,0,0,' + (0.18 + k * 0.05) + ')'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(a[0], a[1] + dy); g.lineTo(b[0], b[1] + dy); g.lineTo(c[0], c[1] + dy); g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const t = rnd(), dy = 4 + rnd() * (EDGE - 6);
      const onLeft = rnd() < 0.5;
      const p0 = onLeft ? a : c;
      g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0,0.25' : '160,130,100,0.18') + ')';
      g.fillRect(p0[0] + (b[0] - p0[0]) * t, p0[1] + (b[1] - p0[1]) * t + dy, 2 + rnd() * 4, 1.5 + rnd() * 2);
    }
    g.strokeStyle = 'rgba(255,230,190,0.25)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
  }
  function projectTile(x, y) {
    const B = DW.BT.get();
    if (!gIsoCtx || !B) return;
    const g = gIsoCtx;
    g.save();
    g.setTransform(GS, 0, 0, GS, B.h * HW * GS, 0);
    const n = iso(x, y - 0.02), e = iso(x + 1.02, y), s = iso(x + 1, y + 1.02), w = iso(x - 0.02, y + 1);
    g.beginPath(); g.moveTo(n[0], n[1]); g.lineTo(e[0], e[1]); g.lineTo(s[0], s[1]); g.lineTo(w[0], w[1]); g.closePath(); g.clip();
    g.setTransform(HW * GS / P, HH * GS / P, -HW * GS / P, HH * GS / P, B.h * HW * GS, 0);
    g.drawImage(ground, x * P, y * P, P, P, x * P, y * P, P, P);
    g.restore();
  }

  /* ---------- Следы на земле (кровь, пули, воронки) ---------- */
  TR.bloodKind = function (u) {
    const T = u.side === 'e' ? D.ENEMIES[u.type] : null;
    if ((T && T.mech) || u.kind === 'turret') return 'oil';
    return T && T.beast ? 'acid' : 'blood';
  };
  function paintDecal(g, d) {
    const r = U.srng(((d.ox * 1e6) | 0) + 7);
    const cx = (d.x + 0.25 + d.ox * 0.5) * P, cy = (d.y + 0.25 + d.oy * 0.5) * P;
    let i;
    switch (d.k) {
      case 'blood': case 'acid': case 'oil': {
        const col = d.k === 'blood' ? '95,10,10' : (d.k === 'acid' ? '110,140,20' : '25,22,20');
        const a = d.k === 'acid' ? 0.5 : 0.62;
        g.fillStyle = 'rgba(' + col + ',' + a + ')';
        g.beginPath(); g.ellipse(cx, cy, 9 * d.s + 3, 6 * d.s + 2, r() * 3, 0, 7); g.fill();
        for (i = 0; i < 6 + d.s * 4; i++) { const ang = r() * 6.28, rr = (8 + r() * 18) * d.s; g.beginPath(); g.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 1 + r() * 3.5, 0, 7); g.fill(); }
        break;
      }
      case 'hole':
        for (i = 0; i < 3; i++) { const x = cx + (r() - 0.5) * 22, y = cy + (r() - 0.5) * 22; g.fillStyle = 'rgba(200,180,150,0.3)'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); g.fillStyle = 'rgba(15,10,8,0.7)'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
        break;
      case 'scorch': {
        const R = (d.s + 0.7) * P;
        const X = (d.x + 0.5) * P, Y = (d.y + 0.5) * P;
        const gr = g.createRadialGradient(X, Y, 4, X, Y, R);
        gr.addColorStop(0, 'rgba(12,9,7,0.85)'); gr.addColorStop(0.55, 'rgba(25,18,12,0.5)'); gr.addColorStop(1, 'rgba(25,18,12,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, 7); g.fill();
        g.strokeStyle = 'rgba(150,130,100,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(X, Y, P * 0.45, 0, 7); g.stroke();
        g.strokeStyle = 'rgba(10,8,6,0.6)'; g.lineWidth = 1.5;
        for (i = 0; i < 10; i++) { const a = r() * 6.28; g.beginPath(); g.moveTo(X + Math.cos(a) * P * 0.3, Y + Math.sin(a) * P * 0.3); g.lineTo(X + Math.cos(a) * R * (0.6 + r() * 0.4), Y + Math.sin(a) * R * (0.6 + r() * 0.4)); g.stroke(); }
        break;
      }
      case 'rubble':
        for (i = 0; i < 9; i++) { g.fillStyle = U.shade('#7a746c', (r() - 0.5) * 0.5); const x = cx + (r() - 0.5) * 40, y = cy + (r() - 0.5) * 40, rr = 2 + r() * 6; g.beginPath(); g.moveTo(x - rr, y); g.lineTo(x, y - rr); g.lineTo(x + rr, y + rr * 0.4); g.closePath(); g.fill(); }
        break;
      default: break;
    }
  }
  TR.decal = function (x, y, kind, size) {
    const B = DW.BT.get();
    if (!B || !groundCtx) return;
    const d = { x: x, y: y, k: kind, s: size || 1, ox: Math.random(), oy: Math.random() };
    B.decals = B.decals || [];
    B.decals.push(d);
    if (B.decals.length > 160) B.decals.shift();
    paintDecal(groundCtx, d);
    const rr = kind === 'scorch' ? Math.ceil(size) + 1 : 1;
    for (let yy = y - rr; yy <= y + rr; yy++) for (let xx = x - rr; xx <= x + rr; xx++) if (xx >= 0 && yy >= 0 && xx < B.w && yy < B.h) projectTile(xx, yy);
  };
  TR.refreshFires = function () {
    const B = DW.BT.get();
    fires = {};
    if (B) B.decor.forEach(function (d) { if (d.t === 'fire') { const k = Math.floor(d.y) * B.w + Math.floor(d.x); (fires[k] = fires[k] || []).push(d); } });
  };

  /* ---------- Спрайты объектов ---------- */
  const box = function (g, u0, v0, u1, v1, h0, h1, c) { ART.box(g, u0, v0, u1, v1, h0, h1, c[0], c[1], c[2]); };
  const Pp = function (u, v, h) { return [(u - v) * HW, (u + v) * HH - (h || 0)]; };
  function spans(mask, t) {
    const N = mask & 1, E = mask & 2, S = mask & 4, Wm = mask & 8;
    if (!mask) return [[-0.5, -t, 0.5, t]];
    if (!E && !Wm) return [[-t, N ? -0.5 : -t, t, S ? 0.5 : t]];
    const r = [];
    if (N) r.push([-t, -0.5, t, -t]);
    r.push([Wm ? -0.5 : -t, -t, E ? 0.5 : t, t]);
    if (S) r.push([-t, t, t, 0.5]);
    return r;
  }
  function texWall(g, type, len, h, rnd) {
    if (type === 2) {
      for (let y = 3; y < h; y += 5) {
        g.fillStyle = 'rgba(30,22,16,0.35)'; g.fillRect(0, y, len, 0.7);
        const off = (Math.floor(y / 5) % 2) * 0.09;
        for (let s = off; s < len; s += 0.18) g.fillRect(s, y, 0.02, 5);
      }
      for (let i = 0; i < 3; i++) {
        g.fillStyle = 'rgba(205,190,170,' + (0.25 + rnd() * 0.2) + ')';
        g.fillRect(rnd() * len * 0.7, h * (0.2 + rnd() * 0.5), 0.15 + rnd() * 0.25, 6 + rnd() * 10);
      }
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(20,14,10,0.55)'; g.fillRect(rnd() * len, 6 + rnd() * (h - 10), 0.035, 1.6); }
      const gr = g.createLinearGradient(0, 0, 0, 12); gr.addColorStop(0, 'rgba(20,15,10,0.45)'); gr.addColorStop(1, 'rgba(20,15,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, len, 12);
    } else if (type === 11) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let s = 0.24; s < len; s += 0.25) g.fillRect(s, 0, 0.02, h);
      g.fillRect(0, h * 0.55, len, 0.8);
      g.fillStyle = 'rgba(220,230,240,0.35)';
      for (let s = 0.04; s < len; s += 0.25) { g.fillRect(s, h - 4, 0.03, 1.4); g.fillRect(s, 6, 0.03, 1.4); }
      for (let s = 0, k = 0; s < len; s += 0.1, k++) {
        g.fillStyle = k % 2 ? '#e3a33b' : '#1d1d1d';
        g.beginPath(); g.moveTo(s, 0); g.lineTo(s + 0.1, 0); g.lineTo(s + 0.16, 5); g.lineTo(s + 0.06, 5); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(111,216,255,0.6)'; g.fillRect(0, h - 2.2, len, 1);
    } else if (type === 14) {
      for (let y = 0; y < h; y += 8) {
        let s = (Math.floor(y / 8) % 2) * 0.1;
        while (s < len) {
          const w = 0.14 + rnd() * 0.1;
          g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,250,240,' : '0,0,0,') + (0.05 + rnd() * 0.08) + ')';
          g.fillRect(s, y, Math.min(w, len - s), 8);
          g.fillStyle = 'rgba(30,26,22,0.45)'; g.fillRect(s, y, 0.02, 8);
          s += w;
        }
        g.fillStyle = 'rgba(30,26,22,0.45)'; g.fillRect(0, y, len, 0.8);
      }
      const gr = g.createLinearGradient(0, 0, 0, 10); gr.addColorStop(0, 'rgba(40,50,20,0.35)'); gr.addColorStop(1, 'rgba(40,50,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, len, 10);
    } else if (type === 17) {
      for (let s = 0; s < len; s += 0.08) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0,' : '255,240,220,') + (0.05 + rnd() * 0.08) + ')'; g.fillRect(s, 0, 0.08, h); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(s, 0, 0.012, h); }
    } else if (type === 1) {
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,35,30,' + (0.1 + rnd() * 0.15) + ')'; g.fillRect(rnd() * len, 0, 0.05 + rnd() * 0.1, 3 + rnd() * h); }
      g.fillStyle = 'rgba(227,163,59,0.55)'; g.fillRect(0, h * 0.62, len, 1.6);
    }
  }
  function wallBox(g, type, sp, h, col, rnd) {
    box(g, sp[0], sp[1], sp[2], sp[3], 0, h, col);
    g.save(); ART.faceL(g, sp[0], sp[3], 0); texWall(g, type, sp[2] - sp[0], h, rnd); g.restore();
    g.save(); ART.faceR(g, sp[2], sp[1], 0); texWall(g, type, sp[3] - sp[1], h, rnd); g.restore();
  }
  function drawObj(g, type, mask, variant, H, rnd) {
    let i, gr;
    switch (type) {
      case 2: case 11: case 14: {
        const t = type === 2 ? 0.27 : 0.3;
        const col = { 2: ['#968b7d', '#7e7163', '#615549'], 11: ['#7d8a92', '#5a656c', '#454f56'], 14: ['#9c968a', '#807a70', '#646058'] }[type];
        spans(mask, t).forEach(function (sp) {
          const h = type === 2 ? H - rnd() * 12 : H;
          wallBox(g, type, sp, h, col, rnd);
          if (type === 14) {
            const hor = sp[2] - sp[0] > sp[3] - sp[1];
            for (let k = 0; k < 3; k++) {
              if (hor) { const u = sp[0] + 0.05 + k * (sp[2] - sp[0]) / 3; box(g, u, sp[1], u + 0.12, sp[3], h, h + 6, col); }
              else { const v = sp[1] + 0.05 + k * (sp[3] - sp[1]) / 3; box(g, sp[0], v, sp[2], v + 0.12, h, h + 6, col); }
            }
          }
          if (type === 2) for (let k = 0; k < 3; k++) ART.blob(g, sp[0] + (sp[2] - sp[0]) * rnd(), sp[1] + (sp[3] - sp[1]) * rnd(), 0.06, 0, '#7e7163', ((rnd() * 1e6) | 0));
        });
        break;
      }
      case 1: {
        const c1 = ['#a39d94', '#86807a', '#6a655f'];
        spans(mask, 0.22).forEach(function (sp) {
          wallBox(g, 1, sp, H * 0.42, c1, rnd);
          const k = 0.08;
          const s2 = [sp[0] + (sp[0] > -0.5 ? k : 0), sp[1] + (sp[1] > -0.5 ? k : 0) * 0, sp[2] - (sp[2] < 0.5 ? k : 0), sp[3]];
          const inset = [sp[0], sp[1] + 0.06, sp[2], sp[3] - 0.06];
          if (sp[3] - sp[1] > sp[2] - sp[0]) { inset[0] = sp[0] + 0.06; inset[2] = sp[2] - 0.06; inset[1] = sp[1]; inset[3] = sp[3]; }
          void s2;
          wallBox(g, 1, inset, H, c1, rnd);
        });
        break;
      }
      case 6: {
        const bags = [];
        spans(mask, 0.25).forEach(function (sp) {
          const hor = sp[2] - sp[0] >= sp[3] - sp[1];
          const len = hor ? sp[2] - sp[0] : sp[3] - sp[1];
          const n = Math.max(1, Math.round(len / 0.25));
          for (let layer = 0; layer < 2; layer++) {
            for (let row = 0; row < 2; row++) {
              for (let k = 0; k < n - layer; k++) {
                const a = (k + 0.5 + layer * 0.5) / n;
                const u = hor ? sp[0] + len * a : (sp[0] + sp[2]) / 2 + (row - 0.5) * 0.2;
                const v = hor ? (sp[1] + sp[3]) / 2 + (row - 0.5) * 0.2 : sp[1] + len * a;
                if (layer === 1 && row === 0) continue;
                bags.push({ u: u, v: v, h: layer * 8, hor: hor });
              }
            }
          }
        });
        bags.sort(function (a, b) { return (a.u + a.v) - (b.u + b.v) || a.h - b.h; });
        bags.forEach(function (b) {
          const p = Pp(b.u, b.v, b.h + 4);
          const rot = b.hor ? 0.46 : -0.46;
          g.fillStyle = '#6e5e40'; ell2(g, p[0], p[1] + 2.5, 9, 5, rot);
          gr = g.createLinearGradient(p[0], p[1] - 5, p[0], p[1] + 5);
          gr.addColorStop(0, '#c8b48a'); gr.addColorStop(1, '#8a7652');
          g.fillStyle = gr; ell2(g, p[0], p[1], 9, 5, rot);
          g.strokeStyle = 'rgba(70,55,30,0.6)'; g.lineWidth = 0.8;
          g.beginPath(); g.ellipse(p[0], p[1], 9, 5, rot, 0, Math.PI * 2); g.stroke();
        });
        break;
      }
      case 13: {
        const logs = [];
        spans(mask, 0.15).forEach(function (sp) {
          const hor = sp[2] - sp[0] >= sp[3] - sp[1];
          const len = hor ? sp[2] - sp[0] : sp[3] - sp[1];
          const n = Math.max(1, Math.round(len / 0.17));
          for (let k = 0; k < n; k++) {
            const a = (k + 0.5) / n;
            logs.push({ u: hor ? sp[0] + len * a : 0, v: hor ? 0 : sp[1] + len * a, h: H * (0.85 + rnd() * 0.3) });
          }
        });
        logs.sort(function (a, b) { return (a.u + a.v) - (b.u + b.v); });
        logs.forEach(function (l) {
          const p = Pp(l.u, l.v, 0);
          gr = g.createLinearGradient(p[0] - 3.5, 0, p[0] + 3.5, 0);
          gr.addColorStop(0, '#a07c52'); gr.addColorStop(1, '#4e341c');
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(p[0] - 3.5, p[1]); g.lineTo(p[0] - 3.5, p[1] - l.h); g.lineTo(p[0], p[1] - l.h - 6); g.lineTo(p[0] + 3.5, p[1] - l.h); g.lineTo(p[0] + 3.5, p[1]); g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(p[0] - 1, p[1] - l.h * 0.7, 0.8, 4);
        });
        if (logs.length > 1) {
          const a = logs[0], b = logs[logs.length - 1];
          const p1 = Pp(a.u, a.v, H * 0.55), p2 = Pp(b.u, b.v, H * 0.55);
          ART.line(g, p1[0], p1[1], p2[0], p2[1], 2.2, '#3a2a18');
        }
        break;
      }
      case 17: {
        const c = ['#7a6a55', '#6a5642', '#544332'];
        box(g, -0.5, -0.5, 0.5, 0.5, 0, H, c);
        g.save(); ART.faceL(g, -0.5, 0.5, 0); texWall(g, 17, 1, H, rnd);
        if (!(mask & 4)) {
          g.fillStyle = '#1a140e'; g.fillRect(0.32, H * 0.38, 0.28, 12);
          g.fillStyle = 'rgba(255,180,80,0.55)'; g.fillRect(0.35, H * 0.4, 0.22, 9);
          g.fillStyle = '#3a2a1c'; g.fillRect(0.32, H * 0.38 + 5.5, 0.28, 1);
        }
        g.restore();
        g.save(); ART.faceR(g, 0.5, -0.5, 0); texWall(g, 17, 1, H, rnd);
        if (!(mask & 2) && variant === 0) { g.fillStyle = '#2a1e14'; g.fillRect(0.35, 0, 0.3, 24); g.fillStyle = '#c9a14a'; g.fillRect(0.58, 11, 0.03, 2); }
        g.restore();
        g.save(); ART.faceT(g, -0.5, -0.5, H);
        g.fillStyle = 'rgba(0,0,0,0.22)'; for (let s = 0.06; s < 1; s += 0.08) g.fillRect(s, 0, 0.015, 1);
        g.fillStyle = 'rgba(140,70,40,0.3)'; g.fillRect(rnd() * 0.6, rnd() * 0.6, 0.3, 0.3);
        g.restore();
        break;
      }
      case 3: {
        const base = ['#6e655c', '#62605a', '#75685a'][variant];
        ART.blob(g, 0, 0, 0.44, H, base, 300 + variant * 17 + mask);
        g.strokeStyle = 'rgba(20,16,12,0.45)'; g.lineWidth = 1;
        for (i = 0; i < 3; i++) { const x0 = (rnd() - 0.5) * 30, y0 = -H * (0.3 + rnd() * 0.6); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (rnd() - 0.5) * 10, y0 + 6 + rnd() * 6); g.stroke(); }
        g.fillStyle = 'rgba(120,130,70,0.35)'; for (i = 0; i < 5; i++) ART.ell(g, (rnd() - 0.5) * 24, -H - 2 + rnd() * 10, 3 + rnd() * 3, 1.6);
        break;
      }
      case 4: {
        const col = ['#a07a48', '#86643a', '#5e4424'];
        const crate = function (u0, v0, u1, v1, h0, h1) {
          box(g, u0, v0, u1, v1, h0, h1, col);
          const a = Pp(u0, v1, h0 + 1), b = Pp(u1, v1, h1 - 1), c = Pp(u1, v1, h0 + 1), d = Pp(u0, v1, h1 - 1);
          ART.line(g, a[0], a[1], b[0], b[1], 1.6, '#5a3e20'); ART.line(g, c[0], c[1], d[0], d[1], 1.6, '#5a3e20');
          const e = Pp(u1, v0, h0 + 1), f = Pp(u1, v1, h1 - 1), q = Pp(u1, v1, h0 + 1), r2 = Pp(u1, v0, h1 - 1);
          ART.line(g, e[0], e[1], f[0], f[1], 1.6, '#4a3218'); ART.line(g, q[0], q[1], r2[0], r2[1], 1.6, '#4a3218');
          g.strokeStyle = 'rgba(40,25,10,0.6)'; g.lineWidth = 1;
          const t1 = Pp(u0, v0, h1), t2 = Pp(u1, v0, h1), t3 = Pp(u1, v1, h1), t4 = Pp(u0, v1, h1);
          g.beginPath(); g.moveTo((t1[0] + t4[0]) / 2, (t1[1] + t4[1]) / 2); g.lineTo((t2[0] + t3[0]) / 2, (t2[1] + t3[1]) / 2); g.stroke();
        };
        if (variant === 0) crate(-0.32, -0.32, 0.32, 0.32, 0, H);
        else if (variant === 1) { crate(-0.4, -0.38, 0.02, 0.02, 0, H * 0.8); crate(0.05, -0.15, 0.4, 0.38, 0, H * 0.8); }
        else { crate(-0.34, -0.34, 0.34, 0.34, 0, H * 0.75); crate(-0.2, -0.2, 0.18, 0.18, H * 0.75, H * 1.35); }
        break;
      }
      case 5: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, 0, 0, 12, 6);
        const tw = function (x0, y0, x1, y1, w) { ART.line(g, x0, y0, x1, y1, w, '#3a2c22'); ART.line(g, x0 - w * 0.25, y0, x1 - w * 0.25, y1, w * 0.35, '#5a4636'); };
        const bend = (rnd() - 0.5) * 10;
        tw(0, 0, bend * 0.4, -28, 7); tw(bend * 0.4, -28, bend, -54, 5);
        for (i = 0; i < 5; i++) {
          const y = -20 - i * 7, dir = i % 2 ? 1 : -1, x = bend * (0.4 + i * 0.12);
          tw(x, y, x + dir * (10 + rnd() * 9), y - 10 - rnd() * 8, 2.6);
          tw(x + dir * 8, y - 6, x + dir * (14 + rnd() * 6), y - 2 - rnd() * 6, 1.4);
        }
        tw(-2, 0, -9, 3, 3); tw(2, 0, 9, 2, 3);
        break;
      }
      case 7: {
        const alongU = variant !== 2;
        const sw = function (a) { return alongU ? a : [a[1], a[0], a[3], a[2]]; };
        const c1 = [['#8a5a3a', '#6e4428', '#56341e'], ['#5a6a6e', '#46545a', '#36424a'], ['#7a7a52', '#5e5e3e', '#4a4a30']][variant];
        let bb = sw([-0.47, -0.3, 0.47, 0.3]);
        box(g, bb[0], bb[1], bb[2], bb[3], 3, H * 0.55, c1);
        bb = sw([-0.22, -0.26, 0.24, 0.26]);
        box(g, bb[0], bb[1], bb[2], bb[3], H * 0.55, H, ['#2a2622', c1[1], c1[2]]);
        g.save(); if (alongU) ART.faceL(g, -0.22, 0.26, H * 0.55); else ART.faceR(g, 0.26, -0.22, H * 0.55);
        g.fillStyle = 'rgba(110,130,140,0.45)'; g.fillRect(0.05, 2, 0.36, H * 0.45 - 4); g.restore();
        const wheels = alongU ? [[-0.3, 0.3], [0.3, 0.3]] : [[0.3, -0.3], [0.3, 0.3]];
        wheels.forEach(function (w) { const p = Pp(w[0], w[1], 4); g.fillStyle = '#141210'; ART.ell(g, p[0], p[1], 5, 5); g.fillStyle = '#3a3632'; ART.ell(g, p[0], p[1], 2, 2); });
        for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(150,70,25,0.45)'; ART.ell(g, (rnd() - 0.5) * 40, -H * 0.3 - rnd() * H * 0.5, 2 + rnd() * 4, 1.5 + rnd() * 2); }
        break;
      }
      case 8:
        for (i = 0; i < 4; i++) ART.blob(g, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, 0.18 + rnd() * 0.08, H * (0.4 + rnd() * 0.6), ['#7a736c', '#8a7f72', '#6e665e'][i % 3], 50 + variant * 9 + i);
        for (i = 0; i < 3; i++) ART.line(g, (rnd() - 0.5) * 20, -H * 0.5, (rnd() - 0.5) * 30, -H - 8 * rnd(), 1.2, '#6a3a20');
        break;
      case 9: {
        const barrel = function (u, v, col) {
          const p = Pp(u, v, 0);
          const r = 8, h = H;
          gr = g.createLinearGradient(p[0] - r, 0, p[0] + r, 0);
          gr.addColorStop(0, U.shade(col, 0.2)); gr.addColorStop(1, U.shade(col, -0.45));
          g.fillStyle = gr; g.fillRect(p[0] - r, p[1] - h, 2 * r, h);
          ART.ell(g, p[0], p[1], r, 4);
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(p[0] - r, p[1] - h * 0.7, 2 * r, 1.6); g.fillRect(p[0] - r, p[1] - h * 0.3, 2 * r, 1.6);
          g.fillStyle = U.shade(col, 0.1); ART.ell(g, p[0], p[1] - h, r, 4);
          g.fillStyle = U.shade(col, -0.35); ART.ell(g, p[0] + 2, p[1] - h, 2, 1);
        };
        const cols = ['#7a3a26', '#3e5a6a', '#5a6a2e'];
        if (variant === 1) { barrel(-0.18, -0.12, cols[0]); barrel(0.16, 0.14, cols[1]); }
        else barrel(0, 0, cols[variant]);
        break;
      }
      case 10: {
        const col = ['#7a7650', '#6d6a48', '#7a6a4a'][variant];
        const h = H;
        const a = Pp(-0.45, 0.42, 0), b = Pp(0.45, 0.42, 0), c = Pp(0.45, -0.42, 0), d = Pp(-0.45, -0.42, 0);
        const r1 = Pp(-0.45, 0, h), r2 = Pp(0.45, 0, h);
        ART.poly(g, [d, c, r2, r1], U.shade(col, -0.25));
        ART.poly(g, [r1, r2, b, a], col);
        ART.poly(g, [c, b, r2], U.shade(col, -0.42));
        const m1 = Pp(0.45, -0.15, 0), m2 = Pp(0.45, 0.15, 0), m3 = Pp(0.45, 0, h * 0.6);
        ART.poly(g, [m1, m2, m3], '#1a1810');
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
        for (i = 1; i < 4; i++) { const x = -0.45 + i * 0.225; const p1 = Pp(x, 0, h), p2 = Pp(x, 0.42, 0); g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke(); }
        ART.line(g, r1[0], r1[1], r2[0], r2[1], 1.4, U.shade(col, -0.5));
        break;
      }
      case 12: {
        box(g, -0.35, -0.3, 0.35, 0.3, 0, H, ['#5e6c74', '#46525a', '#38424a']);
        const s1 = Pp(-0.3, 0.25, H), s2 = Pp(0.3, 0.25, H), s3 = Pp(0.3, -0.1, H + 9), s4 = Pp(-0.3, -0.1, H + 9);
        ART.poly(g, [s1, s2, s3, s4], '#2a3238');
        g.globalAlpha = 0.85;
        ART.poly(g, [[s1[0] + 2, s1[1] - 1.5], [s2[0] - 2, s2[1] - 1.5], [s3[0] - 2, s3[1] + 1.5], [s4[0] + 2, s4[1] + 1.5]], variant === 1 ? '#5aa9e6' : '#3fd0a0');
        g.globalAlpha = 1;
        g.save(); ART.faceL(g, -0.35, 0.3, 0); g.fillStyle = 'rgba(0,0,0,0.4)'; for (i = 0; i < 4; i++) g.fillRect(0.08 + i * 0.14, 5, 0.08, 2); g.fillStyle = '#ff5a3a'; g.fillRect(0.6, 12, 0.04, 2); g.restore();
        break;
      }
      case 15: {
        box(g, -0.48, -0.48, 0.48, 0.48, 0, 8, ['#5a646b', '#454f56', '#363e44']);
        g.save(); ART.faceL(g, -0.48, 0.48, 0); g.fillStyle = 'rgba(111,216,255,0.6)'; for (i = 0; i < 5; i++) g.fillRect(0.1 + i * 0.17, 3, 0.07, 2); g.restore();
        g.strokeStyle = '#22292e'; g.lineWidth = 9;
        g.beginPath(); g.ellipse(0, -40, 20, 32, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#5a6a76'; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(0, -40, 20, 32, 0, 0, Math.PI * 2); g.stroke();
        for (i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.fillStyle = '#e3a33b'; ART.circ(g, Math.cos(a) * 20, -40 + Math.sin(a) * 32, 1.8); }
        break;
      }
      case 16: {
        ART.blob(g, 0, 0, 0.36, H, '#6a3a46', 77 + variant);
        g.fillStyle = '#d88a9a';
        for (i = 0; i < 6; i++) { const x = (rnd() - 0.5) * 26, y = -H + rnd() * 10; ART.poly(g, [[x - 2.5, y], [x + (rnd() - 0.5) * 4, y - 10 - rnd() * 8], [x + 2.5, y]]); }
        g.fillStyle = 'rgba(255,170,190,0.4)'; ART.ell(g, -6, -H + 2, 6, 3);
        g.fillStyle = 'rgba(255,90,140,0.5)'; ART.circ(g, 4, -H * 0.5, 2.5);
        break;
      }
      default:
        box(g, -0.4, -0.4, 0.4, 0.4, 0, H, ['#888', '#666', '#555']);
    }
  }
  function ell2(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); }
  const AUTOTILE = { 1: 1, 2: 1, 6: 1, 11: 1, 13: 1, 14: 1, 17: 1 };
  function maskAt(B, x, y, type) {
    if (!AUTOTILE[type]) return 0;
    const same = function (xx, yy) {
      if (xx < 0 || yy < 0 || xx >= B.w || yy >= B.h) return false;
      const o = B.obj[yy * B.w + xx];
      return o === type || (type === 2 && o === 14) || (type === 14 && o === 2);
    };
    return (same(x, y - 1) ? 1 : 0) | (same(x + 1, y) ? 2 : 0) | (same(x, y + 1) ? 4 : 0) | (same(x - 1, y) ? 8 : 0);
  }
  function objSprite(type, mask, variant, dark, damaged) {
    const key = type + '_' + mask + '_' + variant + (damaged ? '_d' : '');
    let s = sprites[key];
    if (!s) {
      const SS = 2, MX = 16;
      const H = D.OBJ[type].lift * ZH;
      const top = Math.ceil(H) + (type === 5 ? 34 : (type === 15 ? 40 : 20));
      const w = 2 * HW + 2 * MX, h = top + 2 * HH + 8;
      const c = canvas(w * SS, h * SS);
      const g = c.getContext('2d');
      g.scale(SS, SS); g.translate(HW + MX, top + HH);
      drawObj(g, type, mask, variant, H, U.srng(type * 1013 + mask * 37 + variant * 7 + 3));
      if (damaged) {
        const r = U.srng(type * 77 + variant * 13 + mask);
        g.globalCompositeOperation = 'source-atop';
        g.strokeStyle = 'rgba(20,14,10,0.75)'; g.lineWidth = 1.2;
        for (let k = 0; k < 5; k++) {
          let x = (r() - 0.5) * 40, y = -r() * H;
          g.beginPath(); g.moveTo(x, y);
          for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 10; y += r() * 8; g.lineTo(x, y); }
          g.stroke();
        }
        for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(15,10,8,0.6)'; ART.ell(g, (r() - 0.5) * 36, -r() * H, 2 + r() * 4, 1.5 + r() * 3); }
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-HW - MX, -top - HH, w, h);
        g.globalCompositeOperation = 'source-over';
      }
      s = sprites[key] = { c: c, w: w, h: h, ox: HW + MX, oy: top + HH, dark: null };
    }
    if (dark) {
      if (!s.dark) {
        const d = canvas(s.c.width, s.c.height);
        const g = d.getContext('2d');
        g.drawImage(s.c, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(12,10,8,0.58)'; g.fillRect(0, 0, d.width, d.height);
        s.dark = d;
      }
      return { c: s.dark, w: s.w, h: s.h, ox: s.ox, oy: s.oy };
    }
    return s;
  }

  /* ---------- Атмосфера: освещение, погода, окружение ---------- */
  const AMB = { dawn: [255, 200, 172], dusk: [236, 152, 108], night: [50, 60, 100], interior: [104, 106, 124], cave: [78, 68, 62] };
  let lightC = null, lightG = null;
  let weatherP = [], crows = [], motes = [], acidTiles = [], smokeT = 0;
  function initAtmos(B) {
    weatherP = []; crows = []; motes = []; acidTiles = [];
    for (let i = 0; i < B.w * B.h; i++) if (B.ground[i] === 7) acidTiles.push(i);
    const n = { rain: 160, dust: 120, ash: 100 }[B.weather] || 0;
    for (let k = 0; k < n; k++) weatherP.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random(), s: Math.random() });
    const outdoor = B.tod !== 'interior' && B.tod !== 'cave' && B.tod !== 'night';
    if (outdoor) for (let k = 0; k < 3; k++) { const c = isoC(Math.random() * B.w, Math.random() * B.h); crows.push({ cx: c[0], cy: c[1], r: 80 + Math.random() * 120, a: Math.random() * 6.28, sp: (0.3 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 6 }); }
    const anchors = [];
    (B.props || []).forEach(function (p) { if (p.t === 'shroom' || p.t === 'shards') anchors.push(isoC(p.x - 0.5, p.y - 0.5)); });
    acidTiles.slice(0, 10).forEach(function (i) { anchors.push(isoC(i % B.w, (i / B.w) | 0)); });
    if (B.type === 'nest') for (let k = 0; k < 8; k++) anchors.push(isoC(Math.random() * B.w, Math.random() * B.h));
    U.shuffle(anchors).slice(0, 22).forEach(function (a) { motes.push({ ax: a[0], ay: a[1] - 14, ph: Math.random() * 6.28, r: 10 + Math.random() * 16, col: Math.random() < 0.5 ? '170,255,150' : '255,230,140' }); });
  }
  function emitAmbient(B, dt) {
    smokeT += dt;
    if (smokeT < 0.2) return;
    smokeT = 0;
    for (const k in fires) {
      const i = +k;
      if (!B.explored[i]) continue;
      fires[k].forEach(function (d) {
        const c = isoC(d.x - 0.5, d.y - 0.5);
        fx.parts.push({ x: c[0] + (Math.random() - 0.5) * 6, y: c[1], z: 14, vx: 4 + Math.random() * 6, vy: (Math.random() - 0.5) * 3, vz: 16 + Math.random() * 8, t0: now(), life: 2400, color: 'rgba(80,74,68,0.28)', size: 7 + Math.random() * 7, grav: -4 });
      });
    }
  }
  function collectLights(B, t, vis) {
    const L = [];
    const night = B.tod === 'night' || B.tod === 'interior' || B.tod === 'cave';
    B.units.forEach(function (u) {
      if (!u.alive || u.evac) return;
      if (u.side === 'e' && !u.seen) return;
      const p = rp(u); const c = isoC(p[0], p[1]);
      if (u.side === 'p') {
        L.push([c[0], c[1] - 18, night ? 46 : 0, '255,236,200', 0.55]);
        if (night && u.kind === 'soldier') {
          const f = u.face || 0;
          const sx = (Math.cos(f) - Math.sin(f)) * HW, sy = (Math.cos(f) + Math.sin(f)) * HH;
          const L2 = Math.hypot(sx, sy) || 1;
          L.push([c[0] + sx / L2 * 70, c[1] + sy / L2 * 40, 78, '255,244,214', 0.75]);
        }
      } else {
        const col = u.type === 'spitter' ? '180,255,80' : (u.type === 'guardian' ? '120,220,255' : (u.type === 'queen' ? '255,90,140' : '255,200,160'));
        L.push([c[0], c[1] - 20, u.type === 'queen' ? 60 : 30, col, 0.4]);
      }
    });
    for (const k in fires) if (B.explored[+k]) fires[k].forEach(function (d) { const c = isoC(d.x - 0.5, d.y - 0.5); L.push([c[0], c[1] - 8, 120 + Math.sin(t / 90) * 8, '255,168,80', 0.95]); });
    B.items.forEach(function (it) { if (it.kind === 'gems' && B.explored[it.y * B.w + it.x]) { const c = isoC(it.x, it.y); L.push([c[0], c[1] - 8, 40, '120,230,255', 0.7]); } });
    for (let i = 0; i < B.obj.length; i++) {
      const o = B.obj[i];
      if ((o !== 15 && o !== 12) || !B.explored[i]) continue;
      const c = isoC(i % B.w, (i / B.w) | 0);
      L.push(o === 15 ? [c[0], c[1] - 40, 150, '140,240,255', 0.9] : [c[0], c[1] - 14, 44, '120,230,210', 0.55]);
    }
    for (let k = 0; k < acidTiles.length; k++) { const i = acidTiles[k]; if (!B.explored[i]) continue; const c = isoC(i % B.w, (i / B.w) | 0); L.push([c[0], c[1], 34, '150,220,60', 0.35]); }
    (B.props || []).forEach(function (p) { if (p.t === 'shroom' || p.t === 'shards') { const c = isoC(p.x - 0.5, p.y - 0.5); L.push([c[0], c[1] - 6, 32, p.t === 'shroom' ? '140,255,180' : '120,230,255', 0.5]); } });
    fx.flashes.forEach(function (f) {
      const k = (t - f.t0) / f.life; if (k < 0 || k > 1) return;
      L.push(f.muzzle ? [f.x, f.y, 80, '255,214,150', 1 - k] : [f.x, f.y - 10, 220, '255,150,60', 1 - k]);
    });
    void vis;
    return L;
  }
  function applyLighting(g, W, H, dpr, B, t, vis) {
    const amb = AMB[B.tod];
    if (!amb) return;
    const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
    if (!lightC || lightC.width !== w || lightC.height !== h) { lightC = canvas(w, h); lightG = lightC.getContext('2d'); }
    const lg = lightG;
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = 'rgb(' + amb[0] + ',' + amb[1] + ',' + amb[2] + ')';
    lg.fillRect(0, 0, w, h);
    lg.globalCompositeOperation = 'lighter';
    const z = TR.cam.z;
    collectLights(B, t, vis).forEach(function (l) {
      if (!l[2]) return;
      const s = TR.worldToScreen(l[0], l[1]);
      const x = s[0] / 2, y = s[1] / 2, r = l[2] * z / 2;
      if (x < -r || y < -r || x > w + r || y > h + r) return;
      const gr = lg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + l[3] + ',' + l[4] + ')'); gr.addColorStop(1, 'rgba(' + l[3] + ',0)');
      lg.fillStyle = gr; lg.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
    });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(lightC, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
  function drawWeather(g, W, H, dpr, B, t) {
    if (!weatherP.length) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ts = t / 1000;
    if (B.weather === 'rain') {
      g.fillStyle = 'rgba(40,60,30,0.12)'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(190,230,140,0.38)'; g.lineWidth = 1.2;
      g.beginPath();
      weatherP.forEach(function (p) {
        const y = ((p.y + ts * 1.1 * p.v) % 1) * (H + 30) - 15;
        const x = ((p.x + ts * 0.12) % 1) * (W + 30) - 15;
        g.moveTo(x, y); g.lineTo(x - 4 * p.v, y + 13 * p.v);
      });
      g.stroke();
      g.fillStyle = 'rgba(200,240,150,0.35)';
      for (let k = 0; k < 12; k++) { const r = U.hash2(k, Math.floor(ts * 6), 3), q = U.hash2(k, Math.floor(ts * 6), 9); g.fillRect(r * W, q * H, 3, 1); }
    } else if (B.weather === 'dust') {
      g.fillStyle = 'rgba(150,104,60,0.24)'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 3; k++) {
        const x = ((ts * 0.05 * (1 + k * 0.4) + k * 0.37) % 1.6 - 0.3) * W, y = H * (0.25 + k * 0.25);
        const gr = g.createRadialGradient(x, y, 10, x, y, W * 0.35);
        gr.addColorStop(0, 'rgba(170,125,75,0.22)'); gr.addColorStop(1, 'rgba(170,125,75,0)');
        g.fillStyle = gr; g.fillRect(x - W * 0.35, y - W * 0.35, W * 0.7, W * 0.7);
      }
      g.strokeStyle = 'rgba(205,165,115,0.35)'; g.lineWidth = 1;
      g.beginPath();
      weatherP.forEach(function (p) {
        const x = ((p.x + ts * 0.35 * p.v) % 1) * (W + 40) - 20, y = p.y * H + Math.sin(ts * 1.4 + p.s * 10) * 12;
        g.moveTo(x, y); g.lineTo(x + 16 * p.v, y + 1);
      });
      g.stroke();
    } else if (B.weather === 'ash') {
      g.fillStyle = 'rgba(80,78,76,0.12)'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(215,210,205,0.6)';
      weatherP.forEach(function (p) {
        const y = ((p.y + ts * 0.06 * p.v) % 1) * H;
        const x = ((p.x + Math.sin(ts * 0.7 + p.s * 6) * 0.02 + ts * 0.015 + 1) % 1) * W;
        g.fillRect(x, y, 1.6 + p.s * 1.4, 1.6 + p.s * 1.4);
      });
    }
  }
  function drawCrows(g, t, shadows) {
    crows.forEach(function (c) {
      const a = c.a + (t / 1000) * c.sp;
      const x = c.cx + Math.cos(a) * c.r, y = c.cy + Math.sin(a) * c.r * 0.5;
      if (shadows) { g.fillStyle = 'rgba(0,0,0,0.2)'; ART.ell(g, x + 30, y + 10, 6, 2.5); return; }
      const Y = y - 130, f = Math.sin(t / 110 + c.ph) * 6;
      const d = c.sp > 0 ? 1 : -1;
      g.strokeStyle = '#141210'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 8, Y - f); g.quadraticCurveTo(x - 3, Y - 2, x, Y); g.quadraticCurveTo(x + 3, Y - 2, x + 8, Y - f); g.stroke();
      g.fillStyle = '#141210'; ART.ell(g, x + d * 1.5, Y + 0.5, 3, 1.6);
    });
  }
  function drawMotes(g, t) {
    if (!motes.length) return;
    g.globalCompositeOperation = 'lighter';
    motes.forEach(function (m) {
      const a = t / 1400 + m.ph;
      const x = m.ax + Math.cos(a * 1.3) * m.r, y = m.ay + Math.sin(a) * m.r * 0.6 - Math.abs(Math.sin(a * 0.7)) * 10;
      const k = 0.5 + Math.sin(t / 300 + m.ph * 3) * 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, 6);
      gr.addColorStop(0, 'rgba(' + m.col + ',' + (0.8 * k) + ')'); gr.addColorStop(1, 'rgba(' + m.col + ',0)');
      g.fillStyle = gr; g.fillRect(x - 6, y - 6, 12, 12);
    });
    g.globalCompositeOperation = 'source-over';
  }
  function drawAcid(g, B, t, tx0, tx1, ty0, ty1) {
    g.strokeStyle = 'rgba(220,255,140,0.6)'; g.lineWidth = 1;
    for (let k = 0; k < acidTiles.length; k++) {
      const i = acidTiles[k];
      const x = i % B.w, y = (i / B.w) | 0;
      if (x < tx0 || x > tx1 || y < ty0 || y > ty1 || !B.explored[i]) continue;
      const c = isoC(x, y);
      for (let j = 0; j < 2; j++) {
        const ph = (t / 1500 + U.hash2(x, y, j)) % 1;
        const ox = (U.hash2(x, y, j + 5) - 0.5) * 30, oy = (U.hash2(x, y, j + 9) - 0.5) * 12;
        g.beginPath(); g.arc(c[0] + ox, c[1] + oy, 0.8 + ph * 3.2, 0, 6.28); g.stroke();
      }
    }
  }

  /* ---------- Инициализация ---------- */
  TR.init = function (B) {
    sprites = {};
    unitCache = {};
    for (const k in anims) delete anims[k];
    for (const k in nextFidget) delete nextFidget[k];
    for (const k in deadAt) delete deadAt[k];
    fx = { floats: [], tracers: [], parts: [], projs: [], flashes: [] };
    for (const k in tweens) delete tweens[k];
    camWaiters = [];
    buildGround(B);
    (B.decals || []).forEach(function (d) { paintDecal(groundCtx, d); });
    buildIso(B);
    cineOn = false; cineK = 0; cineZ = null; DW.timeScale = 1; TR.cam.tz = null;
    fogC = canvas(B.w, B.h);
    fogV = -1;
    initAtmos(B);
    props = {};
    (B.props || []).forEach(function (p) { const k = Math.floor(p.y) * B.w + Math.floor(p.x); (props[k] = props[k] || []).push(p); });
    fires = {};
    B.decor.forEach(function (d) { if (d.t === 'fire') { const k = Math.floor(d.y) * B.w + Math.floor(d.x); (fires[k] = fires[k] || []).push(d); } });
    TR.cam.z = U.clamp(TR.view.h / 360, 0.7, 1.7);
    const sol = DW.BT.soldiers();
    if (sol.length) {
      let cx = 0, cy = 0;
      sol.forEach(function (s) { cx += s.x; cy += s.y; });
      const c = isoC(cx / sol.length, cy / sol.length);
      TR.cam.x = c[0] + 60; TR.cam.y = c[1] - 10;
    } else { const c = isoC(B.w / 2, B.h / 2); TR.cam.x = c[0]; TR.cam.y = c[1]; }
    TR.cam.tx = null; TR.cam.ty = null;
    clampCam();
  };
  TR.resize = function (w, h) { TR.view.w = w; TR.view.h = h; clampCam(); };
  function clampCam() {
    const B = DW.BT.get();
    if (!B) return;
    const z = TR.cam.z;
    const hw = TR.view.w / 2 / z, hh = TR.view.h / 2 / z;
    const x0 = -B.h * HW - 60, x1 = B.w * HW + 60;
    const y0 = -90, y1 = (B.w + B.h) * HH + EDGE + 70;
    TR.cam.x = x1 - x0 < hw * 2 ? (x0 + x1) / 2 : U.clamp(TR.cam.x, x0 + hw, x1 - hw);
    TR.cam.y = y1 - y0 < hh * 2 ? (y0 + y1) / 2 : U.clamp(TR.cam.y, y0 + hh, y1 - hh);
  }
  TR.pan = function (dx, dy) { TR.cam.x -= dx / TR.cam.z; TR.cam.y -= dy / TR.cam.z; TR.cam.tx = null; TR.cam.ty = null; clampCam(); };
  TR.zoomAt = function (f, sx, sy) {
    const b = TR.screenToWorld(sx, sy);
    TR.cam.z = U.clamp(TR.cam.z * f, 0.5, 2.4);
    const a = TR.screenToWorld(sx, sy);
    TR.cam.x += b[0] - a[0]; TR.cam.y += b[1] - a[1];
    clampCam();
  };
  TR.screenToWorld = function (sx, sy) { return [(sx - TR.view.w / 2) / TR.cam.z + TR.cam.x, (sy - TR.view.h / 2) / TR.cam.z + TR.cam.y]; };
  function worldToPlane(X, Y) { return [(X / HW + Y / HH) / 2, (Y / HH - X / HW) / 2]; }
  TR.screenToTile = function (sx, sy) {
    const w = TR.screenToWorld(sx, sy);
    const p = worldToPlane(w[0], w[1]);
    return [Math.floor(p[0]), Math.floor(p[1])];
  };
  TR.worldToScreen = function (X, Y) { return [(X - TR.cam.x) * TR.cam.z + TR.view.w / 2, (Y - TR.cam.y) * TR.cam.z + TR.view.h / 2]; };
  TR.tileToScreen = function (x, y) { const c = isoC(x, y); return TR.worldToScreen(c[0], c[1] - 18); };
  TR.focusOn = function (tx, ty, force) {
    const s = TR.tileToScreen(tx, ty);
    const mx = TR.view.w * 0.2, myT = TR.view.h * 0.24, myB = TR.view.h * 0.26;
    if (!force && s[0] > mx && s[0] < TR.view.w - mx && s[1] > myT && s[1] < TR.view.h - myB) return Promise.resolve();
    const c = isoC(tx, ty);
    TR.cam.tx = c[0]; TR.cam.ty = c[1] - 20;
    return new Promise(function (res) { camWaiters.push(res); setTimeout(res, 650); });
  };
  TR.pickUnit = function (sx, sy) {
    const B = DW.BT.get();
    if (!B) return null;
    const w = TR.screenToWorld(sx, sy);
    let best = null, bd = -1;
    B.units.forEach(function (u) {
      if (!u.alive || u.evac || (u.side === 'e' && !u.seen)) return;
      const p = rp(u);
      const c = isoC(p[0], p[1]);
      const k = unitScale(u);
      if (w[0] < c[0] - 15 * k || w[0] > c[0] + 15 * k || w[1] < c[1] - 50 * k || w[1] > c[1] + 8) return;
      const d = p[0] + p[1];
      if (d > bd) { bd = d; best = u; }
    });
    return best;
  };

  /* ---------- Анимации и эффекты ---------- */
  function unitScale(u) {
    if (u.type === 'queen') return 1.6;
    if (u.type === 'brute' || u.type === 'boss') return 1.3;
    return 1.13;
  }
  function rp(u) {
    const tw = tweens[u.id];
    if (!tw) return [u.x, u.y];
    const t = U.clamp((now() - tw.t0) / tw.dur, 0, 1);
    if (tw.kind === 'lunge') {
      const k = Math.sin(t * Math.PI) * 0.45;
      return [tw.fx + (tw.tx - tw.fx) * k, tw.fy + (tw.ty - tw.fy) * k];
    }
    return [U.lerp(tw.fx, tw.tx, t), U.lerp(tw.fy, tw.ty, t)];
  }
  TR.renderPos = rp;
  function leanPos(u) {
    const p = rp(u);
    if (tweens[u.id]) return p;
    let ox = 0, oy = 0;
    DW.BT.DIR4.forEach(function (d) {
      const o = DW.BT.objAt(u.x + d[0], u.y + d[1]);
      if (o && D.OBJ[o].cover) { ox += d[0] * 0.2; oy += d[1] * 0.2; }
    });
    return [p[0] + U.clamp(ox, -0.22, 0.22), p[1] + U.clamp(oy, -0.22, 0.22)];
  }
  TR.stepFx = function (u, nx, ny) {
    const c0 = isoC(u.x, u.y);
    if (Math.random() < 0.7) for (let k = 0; k < 3; k++) fx.parts.push({ x: c0[0] + (Math.random() - 0.5) * 10, y: c0[1] + (Math.random() - 0.5) * 4, z: 1, vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.5) * 6, vz: 8 + Math.random() * 8, t0: now(), life: 600, color: 'rgba(170,150,120,0.35)', size: 4 + Math.random() * 4, grav: 4 });
    return new Promise(function (res) {
      tweens[u.id] = { fx: u.x, fy: u.y, tx: nx, ty: ny, t0: now(), dur: 135 / spd(), res: res, kind: 'step' };
      if (u.side === 'p') {
        const s = TR.tileToScreen(nx, ny);
        if (s[0] < TR.view.w * 0.14 || s[0] > TR.view.w * 0.86 || s[1] < TR.view.h * 0.18 || s[1] > TR.view.h * 0.76) {
          const c = isoC(nx, ny); TR.cam.tx = c[0]; TR.cam.ty = c[1] - 20;
        }
      }
    });
  };
  TR.lungeFx = function (att, tgt) {
    TR.anim(att, 'atk', 300);
    return new Promise(function (res) {
      tweens[att.id] = { fx: att.x, fy: att.y, tx: tgt.x, ty: tgt.y, t0: now(), dur: 300 / spd(), res: res, kind: 'lunge' };
    });
  };
  TR.float = function (x, y, text, kind) {
    const col = { dmg: '#ffdf6b', crit: '#ff7b3b', hurt: '#ff5a4f', miss: '#cfc7b8', gem: '#7fe6f5', info: '#e8dcc8', good: '#8fd16b', bad: '#ff6b5b' }[kind] || '#fff';
    const off = fx.floats.filter(function (f) { return f.tx === x && f.ty === y && now() - f.t0 < 600; }).length;
    const c = isoC(x, y);
    fx.floats.push({ x: c[0], y: c[1] - 58 - off * 15, tx: x, ty: y, text: text, color: col, t0: now(), life: 1450, big: kind === 'crit' });
  };
  function parts(x, y, z, n, color, speed, life, size, grav, up) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      fx.parts.push({ x: x, y: y, z: z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, vz: (up || 0) * (0.5 + Math.random()), t0: now(), life: life * (0.6 + Math.random() * 0.6), color: color, size: size * (0.5 + Math.random()), grav: grav === undefined ? 300 : grav });
    }
  }
  TR.blood = function (u) {
    const T = u.side === 'e' ? D.ENEMIES[u.type] : null;
    const col = (T && T.mech) || u.kind === 'turret' ? '#ffd27a' : (T && T.beast ? '#8aaa2a' : '#a01c1c');
    const c = isoC(u.x, u.y);
    parts(c[0], c[1], 24, 14, col, 90, 600, 3, 320, 90);
  };
  TR.debris = function (x, y, color) {
    const c = isoC(x, y);
    parts(c[0], c[1], 14, 18, color || '#888', 110, 900, 4, 380, 150);
    parts(c[0], c[1], 10, 10, 'rgba(160,150,140,0.45)', 40, 1300, 12, -15, 20);
  };
  TR.explosionFx = function (x, y, r) {
    const c = isoC(x, y);
    fx.flashes.push({ x: c[0], y: c[1], r: (r + 0.6), t0: now(), life: 420, ground: true });
    fx.rings = fx.rings || [];
    fx.rings.push({ x: c[0], y: c[1], r: r + 1.4, t0: now(), life: 420 });
    parts(c[0], c[1], 10, 40, '#ffb347', 170 * r, 550, 5, 200, 120);
    parts(c[0], c[1], 10, 26, '#ff5a1f', 120 * r, 700, 6, 200, 160);
    parts(c[0], c[1], 8, 18, '#3a3028', 140 * r, 1400, 4, 420, 260);
    for (let k = 0; k < 16; k++) fx.parts.push({ x: c[0] + (Math.random() - 0.5) * 30 * r, y: c[1] + (Math.random() - 0.5) * 14 * r, z: 6 + Math.random() * 20, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 6, vz: 18 + Math.random() * 26, t0: now(), life: 2600 + Math.random() * 1600, color: 'rgba(60,54,48,0.42)', size: 14 + Math.random() * 16, grav: -6 });
    TR.shake = 12;
    flashScr = now();
  };
  let flashScr = -1e9;
  TR.chips = function (x, y, color) {
    const c = isoC(x, y);
    parts(c[0], c[1], 18, 6, color || '#888', 70, 600, 2.5, 380, 90);
  };
  function muzzle(u) {
    const p = rp(u);
    const c = isoC(p[0], p[1]);
    const f = u.face || 0;
    const sx = (Math.cos(f) - Math.sin(f)) * HW;
    const dir = sx >= 0 ? 1 : -1;
    return [c[0] + dir * 20 * unitScale(u), c[1] - 27 * unitScale(u)];
  }
  TR.shotFx = function (att, tgt, hit, W, show, suppress) {
    const s = spd();
    const m = muzzle(att);
    const tc = isoC(tgt.x, tgt.y);
    const ty0 = tc[1] - 24 * unitScale(tgt);
    const cnt = { rifle: 3, lmg: 5, shotgun: 1, sniper: 1, spit: 1, beam: 1 }[W.snd] || 1;
    const gap = (W.snd === 'lmg' ? 70 : 90) / s;
    const pre = W.snd === 'spit' ? 300 / s : 120 / s;
    if (W.snd === 'spit') TR.anim(att, 'charge', 300);
    const t0 = now() + pre;
    const fdir = (Math.cos(att.face || 0) - Math.sin(att.face || 0)) >= 0 ? 1 : -1;
    const cover = arguments[6] && arguments[6].coverTile;
    setTimeout(function () {
      TR.anim(att, 'shoot', (cnt - 1) * gap * s + 260, { cnt: cnt });
      if (W.snd !== 'spit' && W.snd !== 'beam') {
        for (let i = 0; i < cnt; i++) {
          setTimeout(function () {
            fx.parts.push({ x: m[0] - fdir * 12, y: m[1] + 22, z: 26, vx: -fdir * (30 + Math.random() * 40), vy: (Math.random() - 0.3) * 30, vz: 70 + Math.random() * 50, t0: now(), life: 2600, color: W.snd === 'shotgun' ? '#b8302a' : '#e0b848', size: 2.4, grav: 420, cas: true, late: true });
          }, rt(i * gap));
        }
        for (let k = 0; k < 4; k++) fx.parts.push({ x: m[0] + fdir * 4, y: m[1] + 22, z: 22, vx: fdir * (8 + Math.random() * 14), vy: (Math.random() - 0.5) * 6, vz: 14 + Math.random() * 10, t0: now() + (cnt - 1) * gap, life: 1300, color: 'rgba(200,196,188,0.32)', size: 6 + Math.random() * 6, grav: -8 });
      }
    }, rt(pre));
    const col = W.snd === 'spit' ? '#a8e03a' : (W.snd === 'beam' ? '#6fd8ff' : '#ffe08a');
    for (let i = 0; i < cnt; i++) {
      let ex = tc[0], ey = ty0;
      if (cover && !suppress) { const cc = isoC(cover[0], cover[1]); ex = cc[0] + (Math.random() - 0.5) * 14; ey = cc[1] - 16 - Math.random() * 14; }
      else if (!hit || suppress) { const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 26; ex += Math.cos(a) * d; ey += Math.sin(a) * d * 0.6; }
      else { ex += (Math.random() - 0.5) * 8; ey += (Math.random() - 0.5) * 8; }
      fx.tracers.push({ x1: m[0], y1: m[1], x2: ex, y2: ey, t0: t0 + i * gap, life: W.snd === 'spit' ? 280 : 115, color: col, w: W.snd === 'sniper' || W.snd === 'beam' ? 3 : (W.snd === 'spit' ? 6 : 2), spit: W.snd === 'spit' });
      if (W.snd === 'shotgun') for (let k = 0; k < 5; k++) fx.tracers.push({ x1: m[0], y1: m[1], x2: ex + (Math.random() - 0.5) * 30, y2: ey + (Math.random() - 0.5) * 20, t0: t0, life: 110, color: col, w: 1.2 });
      if (!hit && !suppress) {
        setTimeout(function () {
          if (cover) { parts(ex, ey + 18, 18, 7, '#fff2b0', 120, 260, 2, 300, 60); parts(ex, ey + 18, 18, 5, 'rgba(170,160,150,0.8)', 50, 600, 3, 300, 40); }
          else parts(ex, ey + 20, 6, 5, 'rgba(200,180,150,0.7)', 40, 400, 3, 200, 40);
        }, rt(pre + i * gap + 100 / s));
      }
    }
    if (show || att.side === 'p') setTimeout(function () { DW.SFX.play(W.snd); }, rt(pre));
    fx.flashes.push({ x: m[0], y: m[1], r: 14, t0: t0, life: 90 + cnt * gap, muzzle: true });
    const dur = pre + (cnt - 1) * gap + 190 / s;
    return new Promise(function (res) { setTimeout(res, rt(dur)); });
  };
  TR.projectileFx = function (x0, y0, x1, y1, kind) {
    return new Promise(function (res) {
      const a = isoC(x0, y0), b = isoC(x1, y1);
      fx.projs.push({ x0: a[0], y0: a[1] - 30, x1: b[0], y1: b[1] - 4, t0: now(), dur: (kind === 'rocket' ? 400 : 560) / spd(), kind: kind, res: res });
    });
  };

  TR.update = function (dt) {
    clockT += dt * 1000 * (DW.timeScale || 1);
    const Bq = DW.BT.get();
    if (Bq) emitAmbient(Bq, dt * (DW.timeScale || 1));
    const c = TR.cam;
    if (c.tz !== null && c.tz !== undefined) {
      const kz = Math.min(1, dt * 4.5);
      c.z += (c.tz - c.z) * kz;
      if (Math.abs(c.tz - c.z) < 0.004) { c.z = c.tz; c.tz = null; }
      clampCam();
    }
    cineK += ((cineOn ? 1 : 0) - cineK) * Math.min(1, dt * 5);
    if (c.tx !== null) {
      const k = Math.min(1, dt * 7);
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
      clampCam();
      if (Math.abs(c.tx - c.x) < 3 && Math.abs(c.ty - c.y) < 3) {
        c.tx = null; c.ty = null;
        const w = camWaiters; camWaiters = []; w.forEach(function (r) { r(); });
      }
    } else if (camWaiters.length) { const w = camWaiters; camWaiters = []; w.forEach(function (r) { r(); }); }
    const t = now();
    for (const id in tweens) { const tw = tweens[id]; if (t - tw.t0 >= tw.dur) { delete tweens[id]; tw.res(); } }
    for (let i = fx.projs.length - 1; i >= 0; i--) { const p = fx.projs[i]; if (t - p.t0 >= p.dur) { fx.projs.splice(i, 1); p.res(); } }
    fx.parts.forEach(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt;
      if (p.z < 0 && p.grav > 0) { p.z = 0; p.vz = -p.vz * 0.3; p.vx *= 0.5; p.vy *= 0.5; }
      p.vx *= 0.97; p.vy *= 0.97;
    });
    fx.parts = fx.parts.filter(function (p) { return t - p.t0 < p.life; });
    fx.floats = fx.floats.filter(function (f) { return t - f.t0 < f.life; });
    fx.tracers = fx.tracers.filter(function (f) { return t - f.t0 < f.life; });
    fx.flashes = fx.flashes.filter(function (f) { return t - f.t0 < f.life; });
    if (fx.rings) fx.rings = fx.rings.filter(function (f) { return t - f.t0 < f.life; });
    if (TR.shake) TR.shake = Math.max(0, TR.shake - dt * 40);
  };

  /* ---------- Юниты, предметы, реквизит ---------- */
  function faceInfo(u) {
    const f = u.face === undefined ? Math.PI : u.face;
    const sx = (Math.cos(f) - Math.sin(f)) * HW, sy = (Math.cos(f) + Math.sin(f)) * HH;
    const dir = sx >= 0 ? 1 : -1;
    return { dir: dir, aim: U.clamp(Math.atan2(sy, Math.abs(sx)) * 0.55, -0.5, 0.5) };
  }
  let unitCache = {};
  /* ---------- Анимации юнитов ---------- */
  const anims = {};
  const nextFidget = {};
  const deadAt = {};
  TR.anim = function (u, kind, dur, data) {
    if (!u) return;
    anims[u.id] = { kind: kind, t0: now(), dur: dur / spd(), data: data || {} };
  };
  TR.hitFx = function (u) { if (!anims[u.id] || anims[u.id].kind !== 'die') TR.anim(u, 'hit', 340); };
  TR.dieFx = function (u) { TR.anim(u, 'die', 820); deadAt[u.id] = now(); };
  function curAnim(u, t) {
    const a = anims[u.id];
    if (!a) return null;
    const p = (t - a.t0) / a.dur;
    if (p >= 1) { if (a.kind !== 'die') delete anims[u.id]; return a.kind === 'die' ? { kind: 'die', p: 1, a: a } : null; }
    return { kind: a.kind, p: Math.max(0, p), a: a };
  }
  function poseFor(u, an) {
    const P = {};
    if (u.hunker) { P.crouch = 1; P.low = 0.5; }
    else if (u.overwatch) { P.raise = 1; P.crouch = 0.3; }
    if (!an) return P;
    const p = an.p;
    switch (an.kind) {
      case 'shoot': {
        const n = an.a.data.cnt || 1;
        const q = (p * n) % 1;
        P.raise = 1; P.crouch = Math.max(P.crouch || 0, 0.15);
        P.recoil = q < 0.35 ? q / 0.35 : Math.max(0, 1 - (q - 0.35) / 0.65);
        P.atk = Math.sin(Math.min(1, p) * Math.PI);
        break;
      }
      case 'charge': P.charge = p; break;
      case 'reload': P.reload = p; P.crouch = Math.max(P.crouch || 0, 0.2); break;
      case 'throw': P.throwP = p; break;
      case 'hit': P.hit = Math.sin(p * Math.PI); break;
      case 'atk': P.atk = Math.sin(p * Math.PI); break;
      case 'look': P.look = p > 0.25 && p < 0.75 ? -1 : 0; break;
      case 'check': P.low = Math.sin(p * Math.PI) * 0.9; break;
      case 'sniff': P.atk = Math.sin(p * Math.PI * 3) * 0.25; break;
      case 'signal': P.raise = 0.4; P.lean = -0.08; break;
      default: break;
    }
    return P;
  }
  function paintUnit(g, u, fi, walk, sc, t, pose) {
    if (u.kind === 'soldier') {
      ART.human(g, { look: u.look, body: '#c8691c', armor: u.armorId || 'robe', weapon: u.weapon, dir: fi.dir, aim: fi.aim, walk: walk, cig: u.name === 'Мальборо', helmet: u.armorId === 'heavy' || u.armorId === 'exo', helmetColor: u.armorId === 'exo' ? '#2f4552' : '#4a5258', seed: u.id, scale: sc, pose: pose, band: u.rank >= 4 ? '#c0302a' : null }, t);
    } else if (u.kind === 'turret') {
      ART.creature(g, 'turret', { dir: fi.dir, aim: fi.aim, seed: u.id, scale: sc, pose: pose }, t);
    } else if (ART.ENEMY_LOOKS[u.type]) {
      const E = ART.ENEMY_LOOKS[u.type];
      if (!E._look) E._look = ART.makeLook(ART.hashStr(u.type), E.look);
      ART.human(g, { look: E._look, body: E.body, pants: E.pants, mask: E.mask, hood: E.hood, coat: E.coat, collar: E.collar, robe: false, weapon: D.ENEMIES[u.type].weapon, dir: fi.dir, aim: fi.aim, walk: walk, scale: sc, seed: u.id, pose: pose }, t);
    } else {
      ART.creature(g, u.type, { dir: fi.dir, aim: fi.aim, walk: walk, scale: sc, seed: u.id, pose: pose }, t);
    }
  }
  function stanceKey(u) { return u.hunker ? 'h' : (u.overwatch ? 'o' : 'n'); }
  function unitSprite(u, fi, sc, dead) {
    const aimQ = Math.round(fi.aim * 4) / 4;
    const key = u.id + '|' + fi.dir + '|' + aimQ + '|' + (u.armorId || '') + '|' + (u.weapon || '') + '|' + (u.type || u.kind) + '|' + (dead ? 'X' : stanceKey(u));
    let s = unitCache[key];
    if (!s) {
      const big = u.type === 'queen' ? 2.2 : (u.type === 'brute' ? 1.4 : 1);
      const LW = 130 * big, LH = 100 * big, ox = LW / 2, oy = LH - 16 * big, SS = 2;
      const c = canvas(LW * SS, LH * SS);
      const g = c.getContext('2d');
      g.scale(SS, SS); g.translate(ox, oy);
      if (dead) fallTransform(g, u, fi, 1);
      paintUnit(g, u, { dir: fi.dir, aim: dead ? 0.3 : aimQ }, null, sc, 0, dead ? {} : poseFor(u, null));
      s = unitCache[key] = { c: c, w: LW, h: LH, ox: ox, oy: oy };
    }
    return s;
  }
  function fallTransform(g, u, fi, f) {
    const beast = u.side === 'e' && D.ENEMIES[u.type] && !ART.ENEMY_LOOKS[u.type];
    const e = U.ease(U.clamp(f, 0, 1));
    if (beast) { g.rotate(-fi.dir * e * 0.35); g.scale(1, 1 - e * 0.45); }
    else { g.translate(-fi.dir * e * 4, 0); g.rotate(-fi.dir * e * 1.42); g.scale(1, 1 - e * 0.2); }
  }
  function drawUnit(g, u, t, sel, alpha) {
    const p = leanPos(u);
    const c = isoC(p[0], p[1]);
    const fi = faceInfo(u);
    const tw = tweens[u.id];
    const walk = tw && tw.kind === 'step' ? t / 70 : null;
    const sc = unitScale(u);
    let an = curAnim(u, t);
    // случайные движения в покое
    if (!an && !tw && alpha === undefined && u.alive) {
      if (!nextFidget[u.id]) nextFidget[u.id] = t + 2000 + Math.random() * 9000;
      else if (t > nextFidget[u.id]) {
        nextFidget[u.id] = t + 6000 + Math.random() * 10000;
        const human = u.kind === 'soldier' || ART.ENEMY_LOOKS[u.type];
        if (u.kind !== 'turret' && !u.hunker) TR.anim(u, human ? (Math.random() < 0.6 ? 'look' : 'check') : 'sniff', human ? 1500 : 1100);
        an = curAnim(u, t);
      }
    }
    if (alpha !== undefined) g.globalAlpha = alpha;
    if (sel && alpha === undefined) {
      const pulse = 0.55 + Math.sin(t / 200) * 0.3;
      g.fillStyle = 'rgba(90,170,255,0.18)'; ART.ell(g, c[0], c[1], 21, 10.5);
      g.strokeStyle = 'rgba(130,200,255,' + pulse + ')'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(c[0], c[1], 21, 10.5, 0, 0, Math.PI * 2); g.stroke();
    }
    if (!tw && !an) {
      const sp = unitSprite(u, fi, sc, false);
      const bob = Math.sin(t / 650 + u.id) * 0.5;
      g.drawImage(sp.c, c[0] - sp.ox, c[1] - sp.oy + bob * 0.5, sp.w, sp.h);
      if (u.name === 'Мальборо' && u.kind === 'soldier') {
        const k = (t / 1600) % 1;
        g.fillStyle = 'rgba(210,210,210,' + (0.45 * (1 - k)) + ')';
        ART.circ(g, c[0] + fi.dir * (11 + k * 4) * sc, c[1] - 42 * sc - k * 14 + (u.hunker ? 7 : 0), 1.2 + k * 2.4);
      }
      if (alpha !== undefined) g.globalAlpha = 1;
      return;
    }
    const pose = poseFor(u, an);
    g.save(); g.translate(c[0], c[1]);
    if (an && an.kind === 'hit') {
      g.translate(-fi.dir * Math.sin(an.p * Math.PI) * 3, 0);
    }
    paintUnit(g, u, fi, walk, sc, t, pose);
    g.restore();
    if (an && an.kind === 'hit' && an.p < 0.6) {
      const k = 1 - an.p / 0.6;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(c[0], c[1] - 26 * sc, 2, c[0], c[1] - 26 * sc, 22 * sc);
      gr.addColorStop(0, 'rgba(255,60,40,' + (0.55 * k) + ')'); gr.addColorStop(1, 'rgba(255,60,40,0)');
      g.fillStyle = gr; ART.ell(g, c[0], c[1] - 26 * sc, 22 * sc, 28 * sc);
      g.globalCompositeOperation = 'source-over';
    }
    if (alpha !== undefined) g.globalAlpha = 1;
  }
  function poolColor(u) {
    const T = u.side === 'e' ? D.ENEMIES[u.type] : null;
    if ((T && T.mech) || u.kind === 'turret') return [40, 36, 30];
    if (T && T.beast) return [70, 90, 20];
    return [110, 14, 12];
  }
  function drawCorpse(g, cp, t) {
    const B = DW.BT.get();
    const u = cp.uid ? B.units.find(function (x) { return x.id === cp.uid; }) : null;
    if (!u) {
      const c = isoC(cp.x, cp.y);
      g.fillStyle = cp.side === 'e' ? 'rgba(70,80,20,0.5)' : 'rgba(100,12,12,0.55)';
      ART.ell(g, c[0], c[1], 16, 7);
      g.fillStyle = cp.side === 'p' ? '#7a4a20' : (cp.type === 'guardian' || cp.type === 'turret' ? '#3a4248' : '#3e3430');
      g.beginPath(); g.ellipse(c[0] - 2, c[1] - 2, 11, 4.5, (cp.face || 0) * 0.15, 0, Math.PI * 2); g.fill();
      return;
    }
    const c = isoC(u.x, u.y);
    const fi = faceInfo(u);
    const sc = unitScale(u);
    const da = deadAt[u.id];
    const age = da ? (t - da) / 1000 : 99;
    const pc = poolColor(u);
    const pool = U.clamp((age - 0.5) / 2.5, 0, 1);
    if (pool > 0) {
      g.fillStyle = 'rgba(' + pc[0] + ',' + pc[1] + ',' + pc[2] + ',' + (0.6 * pool) + ')';
      ART.ell(g, c[0] - fi.dir * 10 * sc, c[1] + 1, 6 + 14 * pool * sc, 3 + 6 * pool * sc);
    }
    const an = curAnim(u, t);
    if (an && an.kind === 'die' && an.p < 1) {
      g.save(); g.translate(c[0], c[1]);
      fallTransform(g, u, fi, an.p);
      paintUnit(g, u, fi, null, sc, t, { hit: an.p < 0.3 ? an.p / 0.3 : 1 });
      g.restore();
      return;
    }
    const sp = unitSprite(u, fi, sc, true);
    g.drawImage(sp.c, c[0] - sp.ox, c[1] - sp.oy, sp.w, sp.h);
  }
  function drawItem(g, it, t) {
    const c = isoC(it.x, it.y);
    if (it.kind === 'gems') {
      const glow = 0.35 + Math.sin(t / 300 + it.x) * 0.15;
      const gr = g.createRadialGradient(c[0], c[1] - 8, 2, c[0], c[1] - 8, 24);
      gr.addColorStop(0, 'rgba(110,225,245,' + glow + ')'); gr.addColorStop(1, 'rgba(95,212,230,0)');
      g.fillStyle = gr; ART.ell(g, c[0], c[1] - 6, 24, 18);
      [[-7, 2, 9, -0.25], [2, -1, 14, 0.1], [9, 4, 8, 0.35], [-1, 5, 7, -0.1]].forEach(function (s) {
        g.save(); g.translate(c[0] + s[0], c[1] + s[1]); g.rotate(s[3]);
        ART.poly(g, [[-3, 0], [-2.4, -s[2] * 0.75], [0, -s[2]], [2.4, -s[2] * 0.75], [3, 0]], '#5fd4e6');
        ART.poly(g, [[0, 0], [0, -s[2]], [2.4, -s[2] * 0.75], [3, 0]], '#2a8a9a');
        ART.poly(g, [[-2.4, -s[2] * 0.75], [0, -s[2]], [-0.6, -s[2] * 0.4]], 'rgba(255,255,255,0.75)');
        g.restore();
      });
      if (Math.sin(t / 150 + it.y * 3) > 0.9) { g.fillStyle = '#fff'; ART.circ(g, c[0] + 3, c[1] - 14, 1.6); }
    } else {
      const col = { ammo: '#d6b04a', food: '#b98a4a', meds: '#d9534f', materials: '#8a6a46', grenades: '#5f6b3a' }[it.kind] || '#aaa';
      g.save(); g.translate(c[0], c[1]);
      ART.box(g, -0.22, -0.16, 0.22, 0.16, 0, 11, '#6f6046', '#54472f', '#433824');
      ART.box(g, -0.23, -0.17, 0.23, 0.17, 11, 13, '#7a6a4c', '#5e5038', '#4a3e2a');
      const p = Pp(0, 0.16, 7);
      g.fillStyle = col; g.fillRect(p[0] - 3, p[1] - 3, 6, 6);
      g.restore();
      const pulse = 0.3 + Math.sin(t / 350 + it.x) * 0.25;
      g.strokeStyle = 'rgba(255,230,160,' + pulse + ')'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(c[0], c[1], 18, 9, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  let propCache = {};
  function drawProp(g0, pr, t) {
    const c0 = isoC(pr.x - 0.5, pr.y - 0.5);
    const v = ((pr.x * 1000) | 0) % 3;
    const key = pr.t + v;
    let sp = propCache[key];
    if (!sp) {
      const cc = canvas(64 * 2, 64 * 2);
      const gg = cc.getContext('2d');
      gg.scale(2, 2);
      paintProp(gg, { t: pr.t, x: v + 0.5, y: 0.5 }, 32, 52);
      sp = propCache[key] = cc;
    }
    g0.drawImage(sp, c0[0] - 32, c0[1] - 52, 64, 64);
    void t;
  }
  function paintProp(g, pr, x, y) {
    const t = 0;
    const r = U.srng(((pr.x * 1000) | 0) + ((pr.y * 77) | 0));
    let i;
    switch (pr.t) {
      case 'tuft':
        g.strokeStyle = '#9a8a52'; g.lineWidth = 1.2;
        for (i = 0; i < 6; i++) { const ox = (r() - 0.5) * 9; g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + (r() - 0.5) * 6, y - 5 - r() * 7); g.stroke(); }
        break;
      case 'bush':
        g.fillStyle = 'rgba(0,0,0,0.25)'; ART.ell(g, x, y, 9, 4);
        g.strokeStyle = '#4a3a2a'; g.lineWidth = 1.4;
        for (i = 0; i < 7; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (8 + r() * 6), y + Math.sin(a) * (8 + r() * 8)); g.stroke(); }
        break;
      case 'skull':
        g.fillStyle = '#e0d6c2'; ART.ell(g, x, y - 3, 4, 3.4); g.fillRect(x - 2.4, y - 1, 4.8, 2.4);
        g.fillStyle = '#2a2420'; ART.circ(g, x - 1.5, y - 3, 1); ART.circ(g, x + 1.5, y - 3, 1);
        ART.line(g, x + 6, y, x + 13, y - 2, 1.6, '#d8ccb6');
        break;
      case 'shards':
        g.fillStyle = 'rgba(95,212,230,0.25)'; ART.ell(g, x, y - 3, 10, 6);
        for (i = 0; i < 3; i++) { const ox = (r() - 0.5) * 12, h = 4 + r() * 6; ART.poly(g, [[x + ox - 1.6, y], [x + ox, y - h], [x + ox + 1.6, y]], i % 2 ? '#5fd4e6' : '#2a8a9a'); }
        break;
      case 'shroom': {
        const gl = 0.4 + Math.sin(t / 500 + pr.x) * 0.2;
        const gr = g.createRadialGradient(x, y - 5, 1, x, y - 5, 14); gr.addColorStop(0, 'rgba(150,255,190,' + gl + ')'); gr.addColorStop(1, 'rgba(150,255,190,0)');
        g.fillStyle = gr; ART.circ(g, x, y - 5, 14);
        for (i = 0; i < 3; i++) { const ox = (r() - 0.5) * 10, h = 3 + r() * 5; ART.line(g, x + ox, y, x + ox, y - h, 1.2, '#c8d8c0'); g.fillStyle = '#7affb0'; ART.ell(g, x + ox, y - h, 3, 1.6); }
        break;
      }
      case 'sign':
        ART.line(g, x, y, x, y - 22, 1.6, '#5a4a3a');
        g.save(); g.translate(x, y - 22); g.rotate(-0.15);
        g.fillStyle = '#7a3a26'; g.fillRect(-7, -6, 14, 9); g.fillStyle = '#e3a33b'; g.fillRect(-5, -3, 10, 1.5);
        g.restore();
        break;
      case 'pipe':
        g.save(); g.translate(x, y); g.rotate(0.46);
        g.fillStyle = '#5a4e46'; g.fillRect(-12, -5, 24, 5); g.fillStyle = '#7a4a30'; g.fillRect(-12, -5, 24, 1.6);
        g.fillStyle = '#2a2420'; ART.ell(g, 12, -2.5, 1.6, 2.6);
        g.restore();
        break;
      case 'bones':
        ART.line(g, x - 6, y, x + 4, y - 3, 2.2, '#d8ccb6'); ART.line(g, x - 2, y + 2, x + 7, y + 1, 2, '#cfc2aa');
        g.fillStyle = '#e0d6c2'; ART.circ(g, x + 6, y - 4, 2.6);
        break;
      default: break;
    }
  }
  function hpBar(g, u, px, py) {
    const n = u.maxHp;
    const big = n > 16;
    const pw = big ? Math.max(1.6, 60 / n) : 4.2, gap = big ? 0.6 : 1.2;
    const w = n * (pw + gap) - gap;
    const x0 = px - w / 2;
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x0 - 2, py - 2, w + 4, 8);
    for (let i = 0; i < n; i++) {
      g.fillStyle = i < u.hp ? (u.side === 'p' ? (u.hp <= u.maxHp * 0.34 ? '#e3a33b' : '#7fd06a') : '#e0473f') : 'rgba(255,255,255,0.12)';
      g.fillRect(x0 + i * (pw + gap), py, pw, 4);
    }
    if (u.armor) {
      g.fillStyle = '#b0c4d4'; g.font = 'bold 9px sans-serif'; g.textAlign = 'right';
      g.fillText('◆' + u.armor, x0 - 4, py + 5);
    }
  }
  function statusIcons(g, u, px, py) {
    let x = px - 10;
    g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
    if (u.overwatch) { g.fillStyle = '#ffd25a'; ART.ell(g, x, py, 7, 4); g.fillStyle = '#222'; ART.circ(g, x, py, 2); x += 16; }
    if (u.hunker) { g.fillStyle = '#6fa8dc'; ART.poly(g, [[x - 5, py - 5], [x + 5, py - 5], [x + 5, py], [x, py + 5], [x - 5, py]]); x += 16; }
    if (u.suppressed) { g.fillStyle = '#ff7b3b'; g.fillText('▼', x, py + 4); }
  }
  function shield(g, x, y, full, color) {
    g.save(); g.translate(x, y);
    g.beginPath(); g.moveTo(-7, -8); g.lineTo(7, -8); g.lineTo(7, 0); g.quadraticCurveTo(7, 6, 0, 9); g.quadraticCurveTo(-7, 6, -7, 0); g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill();
    g.strokeStyle = color; g.lineWidth = 2; g.stroke();
    if (full) { g.fillStyle = color; g.fill(); }
    else { g.save(); g.clip(); g.fillStyle = color; g.fillRect(-8, 0, 16, 10); g.restore(); }
    g.restore();
  }
  function diamond(g, x, y, inset) {
    const k = inset || 0;
    const a = iso(x + k, y + k), b = iso(x + 1 - k, y + k), c = iso(x + 1 - k, y + 1 - k), d = iso(x + k, y + 1 - k);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
  }

  /* ---------- Главный рендер ---------- */
  TR.render = function (g, W, H, dpr) {
    const B = DW.BT.get();
    if (!B || !gIso) return;
    const t = now();
    const z = TR.cam.z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#16110d'); bg.addColorStop(1, '#070605');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (TR.shake) { sx = (Math.random() - 0.5) * TR.shake; sy = (Math.random() - 0.5) * TR.shake; }
    const ox = dpr * (W / 2 - TR.cam.x * z + sx), oy = dpr * (H / 2 - TR.cam.y * z + sy);
    const screenT = function () { g.setTransform(dpr * z, 0, 0, dpr * z, ox, oy); };
    const planeT = function () { g.setTransform(dpr * z * HW, dpr * z * HH, -dpr * z * HW, dpr * z * HH, ox, oy); };
    screenT();
    g.imageSmoothingEnabled = true;
    g.drawImage(gIso, -B.h * HW, 0, (B.w + B.h) * HW, (B.w + B.h) * HH + EDGE + 4);

    // видимая область в клетках
    const corners = [[0, 0], [W, 0], [0, H + 140 * z], [W, H + 140 * z]].map(function (s) { const w = TR.screenToWorld(s[0], s[1]); return worldToPlane(w[0], w[1]); });
    let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
    corners.forEach(function (p) { px0 = Math.min(px0, p[0]); px1 = Math.max(px1, p[0]); py0 = Math.min(py0, p[1]); py1 = Math.max(py1, p[1]); });
    const tx0 = Math.max(0, Math.floor(px0) - 1), tx1 = Math.min(B.w - 1, Math.ceil(px1) + 1);
    const ty0 = Math.max(0, Math.floor(py0) - 1), ty1 = Math.min(B.h - 1, Math.ceil(py1) + 1);
    const ov = TR.overlay || {};
    const vis = DW.BT.vis();

    // плоские слои
    planeT();
    g.fillStyle = 'rgba(0,0,0,0.24)';
    g.beginPath();
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const o = B.obj[y * B.w + x];
      if (!o || !B.explored[y * B.w + x] || o === 13 || o === 6) continue;
      const L = D.OBJ[o].lift;
      g.rect(x + 0.12, y + 0.08, 0.9 + L * 0.9, 0.86);
    }
    g.fill();
    if (B.evac.length) {
      g.fillStyle = 'rgba(90,210,120,' + (0.16 + Math.sin(t / 500) * 0.05) + ')';
      B.evac.forEach(function (e) { g.fillRect(e[0] + 0.05, e[1] + 0.05, 0.9, 0.9); });
    }
    if (ov.reach) {
      const R = ov.reach;
      const pb = new Path2D(), py = new Path2D();
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const i = y * B.w + x, c = R.cost[i];
        if (c === Infinity || c === 0 || R.occ[i]) continue;
        if (c <= ov.m1 + 0.01) pb.rect(x + 0.05, y + 0.05, 0.9, 0.9);
        else if (c <= ov.m2 + 0.01) py.rect(x + 0.05, y + 0.05, 0.9, 0.9);
      }
      g.fillStyle = 'rgba(80,170,255,0.2)'; g.fill(pb);
      g.fillStyle = 'rgba(255,200,60,0.16)'; g.fill(py);
    }
    if (BT_visVersion() !== fogV) {
      fogV = BT_visVersion();
      const fg = fogC.getContext('2d');
      const img = fg.createImageData(B.w, B.h);
      for (let i = 0; i < B.w * B.h; i++) {
        const a = vis && vis[i] ? 0 : (B.explored[i] ? 125 : 235);
        img.data[i * 4] = 9; img.data[i * 4 + 1] = 8; img.data[i * 4 + 2] = 7; img.data[i * 4 + 3] = a;
      }
      fg.putImageData(img, 0, 0);
    }
    g.drawImage(fogC, 0, 0, B.w, B.h);

    // объёмный проход по глубине
    screenT();
    drawAcid(g, B, t, tx0, tx1, ty0, ty1);
    drawCrows(g, t, true);
    if (B.evac.length) {
      g.strokeStyle = 'rgba(140,240,160,0.75)'; g.lineWidth = 1.6;
      B.evac.forEach(function (e) {
        const c = isoC(e[0], e[1]); const k = (t / 900 + (e[0] + e[1]) * 0.15) % 1;
        g.globalAlpha = 1 - k;
        g.beginPath(); g.moveTo(c[0] - 5, c[1] - 2 - k * 10); g.lineTo(c[0], c[1] - 7 - k * 10); g.lineTo(c[0] + 5, c[1] - 2 - k * 10); g.stroke();
        g.globalAlpha = 1;
      });
    }
    const unitsAt = {};
    B.units.forEach(function (u) {
      if (!u.alive || u.evac) return;
      if (u.side === 'e' && !u.seen) return;
      const p = rp(u);
      const k = Math.round(p[1]) * B.w + Math.round(p[0]);
      (unitsAt[k] = unitsAt[k] || []).push(u);
    });
    const corpsesAt = {};
    B.corpses.forEach(function (c) { (corpsesAt[c.y * B.w + c.x] = corpsesAt[c.y * B.w + c.x] || []).push(c); });
    const itemsAt = {};
    B.items.forEach(function (it) { itemsAt[it.y * B.w + it.x] = it; });
    const ghosts = [];
    for (let d = tx0 + ty0; d <= tx1 + ty1; d++) {
      const xa = Math.max(tx0, d - ty1), xb = Math.min(tx1, d - ty0);
      for (let x = xa; x <= xb; x++) {
        const y = d - x;
        const i = y * B.w + x;
        const ex = B.explored[i];
        if (ex) {
          if (corpsesAt[i]) corpsesAt[i].forEach(function (c) { drawCorpse(g, c, t); });
          if (props[i]) props[i].forEach(function (p) { drawProp(g, p, t); });
          if (itemsAt[i]) drawItem(g, itemsAt[i], t);
          const o = B.obj[i];
          if (o) {
            const sp = objSprite(o, maskAt(B, x, y, o), Math.floor(U.hash2(x, y, o) * 3), !(vis && vis[i]), B.objHp[i] < D.OBJ[o].hp * 0.5);
            const sway = o === 5 ? Math.sin(t / 900 + x * 1.3 + y) * 0.035 : 0;
            if (o === 16) { const c0 = isoC(x, y); const k = 1 + Math.sin(t / 420 + x * 2 + y) * 0.05; g.save(); g.translate(c0[0], c0[1]); g.scale(1 + (k - 1) * 0.5, k); g.translate(-c0[0], -c0[1]); }
            if (sway) { const c0 = isoC(x, y); g.save(); g.translate(c0[0], c0[1]); g.transform(1, 0, sway, 1, 0, 0); g.translate(-c0[0], -c0[1]); }
            const c = isoC(x, y);
            g.drawImage(sp.c, c[0] - sp.ox, c[1] - sp.oy, sp.w, sp.h);
            if (sway) g.restore();
            if (o === 16) g.restore();
            if (o === 15) {
              const gl = 0.45 + Math.sin(t / 380) * 0.15;
              const gr = g.createRadialGradient(c[0], c[1] - 40, 2, c[0], c[1] - 40, 30);
              gr.addColorStop(0, 'rgba(170,245,255,' + gl + ')'); gr.addColorStop(1, 'rgba(95,212,230,0)');
              g.fillStyle = gr; ART.ell(g, c[0], c[1] - 40, 17, 29);
              g.strokeStyle = 'rgba(180,250,255,' + (gl * 0.8) + ')'; g.lineWidth = 1.2;
              for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(c[0], c[1] - 40, 6 + k * 4 + Math.sin(t / 300 + k) * 2, 12 + k * 6, 0, t / 700 + k, t / 700 + k + 2); g.stroke(); }
            }
          }
          if (fires[i]) fires[i].forEach(function (dc) {
            const c = isoC(dc.x - 0.5, dc.y - 0.5);
            const gr = g.createRadialGradient(c[0], c[1] - 6, 1, c[0], c[1] - 6, 30);
            gr.addColorStop(0, 'rgba(255,170,60,0.35)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
            g.fillStyle = gr; ART.ell(g, c[0], c[1] - 4, 30, 18);
            for (let k = 0; k < 3; k++) {
              const h = 12 + Math.sin(t / 90 + k * 2) * 4;
              g.fillStyle = k === 0 ? 'rgba(255,120,30,0.9)' : (k === 1 ? 'rgba(255,190,60,0.85)' : 'rgba(255,240,150,0.75)');
              g.beginPath(); g.moveTo(c[0] - 6 + k * 3, c[1]); g.quadraticCurveTo(c[0] - 3 + k * 2, c[1] - h, c[0] + Math.sin(t / 120 + k) * 2, c[1] - h - 6 + k * 3);
              g.quadraticCurveTo(c[0] + 5 - k, c[1] - h * 0.5, c[0] + 6 - k * 3, c[1]); g.closePath(); g.fill();
            }
          });
        }
        const us = unitsAt[i];
        if (us) us.forEach(function (u) {
          drawUnit(g, u, t, ov.sel === u);
          if (u.side === 'p') {
            const o1 = BT_obj(B, x + 1, y), o2 = BT_obj(B, x, y + 1), o3 = BT_obj(B, x + 1, y + 1);
            if ((o1 && D.OBJ[o1].lift > 0.45) || (o2 && D.OBJ[o2].lift > 0.45) || (o3 && D.OBJ[o3].lift > 0.55)) ghosts.push(u);
          }
        });
      }
    }
    ghosts.forEach(function (u) { drawUnit(g, u, t, false, 0.32); });
    drawCrows(g, t, false);
    applyLighting(g, W, H, dpr, B, t, vis);
    drawWeather(g, W, H, dpr, B, t);
    screenT();
    drawMotes(g, t);

    // контуры зон перемещения
    if (ov.reach) {
      const R = ov.reach;
      const cat = function (x, y) {
        if (!DW.BT.inb(x, y)) return 0;
        const c = R.cost[y * B.w + x];
        if (c === Infinity) return 0;
        return c <= ov.m1 + 0.01 ? 2 : (c <= ov.m2 + 0.01 ? 1 : 0);
      };
      g.lineWidth = 2;
      const lb = new Path2D(), ly = new Path2D();
      const NB = [[0, -1, 0, 0, 1, 0], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 1]];
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const c = cat(x, y);
        if (!c) continue;
        for (let k = 0; k < 4; k++) {
          const n = NB[k];
          if (cat(x + n[0], y + n[1]) >= c) continue;
          const a = iso(x + n[2], y + n[3]), b = iso(x + n[4], y + n[5]);
          const pth = c === 2 ? lb : ly;
          pth.moveTo(a[0], a[1]); pth.lineTo(b[0], b[1]);
        }
      }
      g.strokeStyle = 'rgba(120,200,255,0.9)'; g.stroke(lb);
      g.strokeStyle = 'rgba(255,210,90,0.85)'; g.stroke(ly);
    }
    // путь и предпросмотр
    if (ov.path && ov.sel) {
      const pts = [[ov.sel.x, ov.sel.y]].concat(ov.path);
      g.strokeStyle = ov.pathDash ? 'rgba(255,210,90,0.95)' : 'rgba(150,215,255,0.95)'; g.lineWidth = 3; g.setLineDash([7, 5]);
      g.beginPath();
      pts.forEach(function (p, i) { const c = isoC(p[0], p[1]); if (i) g.lineTo(c[0], c[1]); else g.moveTo(c[0], c[1]); });
      g.stroke(); g.setLineDash([]);
      const dd = ov.path[ov.path.length - 1];
      if (dd) {
        g.strokeStyle = '#fff'; g.lineWidth = 2.4; diamond(g, dd[0], dd[1], 0.12); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
        (ov.shields || []).forEach(function (s) {
          const c = isoC(dd[0] + s.dx * 0.42, dd[1] + s.dy * 0.42);
          shield(g, c[0], c[1] - 16, s.c === 2, s.c === 2 ? '#5ab4ff' : '#9fd3ff');
        });
      }
    }
    (ov.seeMarks || []).forEach(function (m) {
      const p = rp(m.u); const c = isoC(p[0], p[1]);
      const Y = c[1] - 62 * unitScale(m.u);
      g.fillStyle = m.flank ? '#ffd25a' : '#ff6b5b';
      ART.poly(g, [[c[0] - 6, Y - 8], [c[0] + 6, Y - 8], [c[0], Y]]);
    });
    if (ov.targets && ov.sel) {
      ov.targets.forEach(function (tg) {
        const p = rp(tg.u); const c = isoC(p[0], p[1]);
        const k = unitScale(tg.u);
        const cur = ov.target === tg.u;
        const cy = c[1] - 22 * k;
        g.strokeStyle = cur ? '#ff4a3a' : 'rgba(255,110,90,0.7)'; g.lineWidth = cur ? 3 : 2;
        g.beginPath(); g.ellipse(c[0], c[1], 20 * k, 10 * k, 0, 0, Math.PI * 2); g.stroke();
        if (cur) {
          const r = 13 + Math.sin(t / 150) * 2;
          g.beginPath(); g.arc(c[0], cy, r, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.moveTo(c[0] - r - 6, cy); g.lineTo(c[0] - r + 4, cy); g.moveTo(c[0] + r - 4, cy); g.lineTo(c[0] + r + 6, cy); g.moveTo(c[0], cy - r - 6); g.lineTo(c[0], cy - r + 4); g.moveTo(c[0], cy + r - 4); g.lineTo(c[0], cy + r + 6); g.stroke();
          const m = muzzle(ov.sel);
          g.strokeStyle = 'rgba(255,80,60,0.6)'; g.lineWidth = 2; g.setLineDash([6, 6]);
          g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(c[0], cy); g.stroke(); g.setLineDash([]);
        }
        if (tg.hit !== undefined) {
          const Y = c[1] - 70 * k;
          g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
          g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(c[0] - 19, Y - 12, 38, 16);
          g.fillStyle = cur ? '#ffd25a' : '#fff'; g.fillText(tg.hit + '%', c[0], Y + 1);
        }
      });
    }
    (ov.allies || []).forEach(function (a) {
      const p = rp(a); const c = isoC(p[0], p[1]);
      g.strokeStyle = 'rgba(127,208,106,' + (0.6 + Math.sin(t / 180) * 0.3) + ')'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(c[0], c[1], 22, 11, 0, 0, Math.PI * 2); g.stroke();
    });
    if (ov.aoe && ov.sel) {
      const sp = rp(ov.sel); const c = isoC(sp[0], sp[1]);
      const k = Math.SQRT2;
      g.strokeStyle = 'rgba(255,200,80,0.4)'; g.lineWidth = 2; g.setLineDash([8, 6]);
      g.beginPath(); g.ellipse(c[0], c[1], ov.aoe.range * HW * k, ov.aoe.range * HH * k, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      if (ov.aoe.x !== undefined) {
        const a = isoC(ov.aoe.x, ov.aoe.y);
        g.fillStyle = 'rgba(255,90,40,0.25)'; g.strokeStyle = 'rgba(255,120,60,0.95)'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(a[0], a[1], (ov.aoe.r + 0.5) * HW * k, (ov.aoe.r + 0.5) * HH * k, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    }
    // полосы здоровья
    B.units.forEach(function (u) {
      if (!u.alive || u.evac) return;
      if (u.side === 'e' && !u.seen) return;
      const p = leanPos(u); const c = isoC(p[0], p[1]);
      const k = unitScale(u);
      const Y = c[1] - (u.type === 'queen' ? 92 : 62 * k);
      const showBar = u.side === 'e' || u.kind === 'turret' || ov.sel === u || u.hp < u.maxHp || (ov.allies && ov.allies.indexOf(u) >= 0);
      if (showBar) hpBar(g, u, c[0], Y);
      statusIcons(g, u, c[0], Y - 10);
      if (u.side === 'e' && !u.active) { g.fillStyle = '#cfc7b8'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('?', c[0] + 24, Y + 5); }
    });

    // эффекты
    fx.flashes.forEach(function (f) {
      const kk = (t - f.t0) / f.life;
      if (kk < 0) return;
      if (f.ground) {
        const rx = f.r * HW * Math.SQRT2 * (0.6 + kk * 0.6), ry = f.r * HH * Math.SQRT2 * (0.6 + kk * 0.6);
        const gr = g.createRadialGradient(f.x, f.y, 1, f.x, f.y, rx);
        gr.addColorStop(0, 'rgba(255,240,180,' + (1 - kk) + ')'); gr.addColorStop(0.4, 'rgba(255,130,40,' + (0.8 * (1 - kk)) + ')'); gr.addColorStop(1, 'rgba(255,80,0,0)');
        g.fillStyle = gr; ART.ell(g, f.x, f.y - 6, rx, ry + 10 * (1 - kk));
      } else {
        const gr = g.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r);
        gr.addColorStop(0, 'rgba(255,240,180,' + (1 - kk) + ')'); gr.addColorStop(0.4, 'rgba(255,170,60,' + (0.6 * (1 - kk)) + ')'); gr.addColorStop(1, 'rgba(255,80,0,0)');
        g.fillStyle = gr; ART.circ(g, f.x, f.y, f.r);
      }
    });
    fx.tracers.forEach(function (tr) {
      const kk = (t - tr.t0) / tr.life;
      if (kk < 0 || kk > 1) return;
      if (tr.spit) {
        const X = U.lerp(tr.x1, tr.x2, kk), Y = U.lerp(tr.y1, tr.y2, kk) - Math.sin(kk * Math.PI) * 24;
        g.fillStyle = tr.color; ART.circ(g, X, Y, 4.5);
        g.fillStyle = 'rgba(200,255,90,0.4)'; ART.circ(g, X, Y, 8);
        return;
      }
      const a = U.clamp(kk * 1.6, 0, 1), b = U.clamp(kk * 1.6 - 0.6, 0, 1);
      g.strokeStyle = tr.color; g.lineWidth = tr.w; g.globalAlpha = 0.95;
      g.beginPath(); g.moveTo(U.lerp(tr.x1, tr.x2, b), U.lerp(tr.y1, tr.y2, b)); g.lineTo(U.lerp(tr.x1, tr.x2, a), U.lerp(tr.y1, tr.y2, a)); g.stroke();
      g.globalAlpha = 1;
    });
    fx.projs.forEach(function (p) {
      const kk = U.clamp((t - p.t0) / p.dur, 0, 1);
      const X = U.lerp(p.x0, p.x1, kk), Y = U.lerp(p.y0, p.y1, kk) - Math.sin(kk * Math.PI) * (p.kind === 'rocket' ? 14 : 70);
      if (p.kind === 'rocket') {
        g.fillStyle = '#ddd'; ART.circ(g, X, Y, 3.5);
        fx.parts.push({ x: X, y: Y, z: 0, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, vz: 0, t0: t, life: 520, color: 'rgba(200,200,200,0.5)', size: 7, grav: 0 });
      } else { g.fillStyle = '#4a5530'; ART.circ(g, X, Y, 4); g.fillStyle = '#7a8a50'; ART.circ(g, X - 1, Y - 1, 1.5); }
    });
    fx.parts.forEach(function (p) {
      const kk = (t - p.t0) / p.life;
      if (kk < 0) return;
      g.globalAlpha = p.late ? (kk < 0.75 ? 1 : Math.max(0, (1 - kk) / 0.25)) : Math.max(0, 1 - kk);
      g.fillStyle = p.color;
      if (p.cas) g.fillRect(p.x - 1.5, p.y - p.z - 0.6, 3, 1.3);
      else if (p.size >= 4.5) { g.beginPath(); g.arc(p.x, p.y - p.z, p.size / 2, 0, 6.2832); g.fill(); }
      else g.fillRect(p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
    });
    (fx.rings || []).forEach(function (r) {
      const kk = (t - r.t0) / r.life;
      if (kk < 0 || kk > 1) return;
      g.strokeStyle = 'rgba(255,230,190,' + (0.6 * (1 - kk)) + ')'; g.lineWidth = 3 * (1 - kk) + 1;
      g.beginPath(); g.ellipse(r.x, r.y, r.r * HW * Math.SQRT2 * kk, r.r * HH * Math.SQRT2 * kk, 0, 0, Math.PI * 2); g.stroke();
    });
    g.globalAlpha = 1;
    fx.floats.forEach(function (f) {
      const kk = (t - f.t0) / f.life;
      g.globalAlpha = kk > 0.7 ? (1 - kk) / 0.3 : 1;
      g.font = (f.big ? 'bold 18px' : 'bold 14px') + ' sans-serif'; g.textAlign = 'center';
      const Y = f.y - kk * 34;
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(f.text, f.x, Y);
      g.fillStyle = f.color; g.fillText(f.text, f.x, Y);
    });
    g.globalAlpha = 1;
    // атмосфера: виньетка
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(TR.vignette(W, H, 0.5), 0, 0, W, H);
    const fk = (t - flashScr) / 260;
    if (fk >= 0 && fk < 1) { g.fillStyle = 'rgba(255,190,110,' + (0.32 * (1 - fk)) + ')'; g.fillRect(0, 0, W, H); }
    if ((DW.timeScale || 1) < 1) { g.fillStyle = 'rgba(30,10,5,0.18)'; g.fillRect(0, 0, W, H); }
    if (cineK > 0.01) {
      const bh = H * 0.085 * cineK;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh);
    }
  };
  /* ---------- Кинокамера ---------- */
  let cineOn = false, cineK = 0, cineZ = null;
  TR.actionCam = function (att, tgt) {
    if (cineZ === null) cineZ = TR.cam.z;
    cineOn = true;
    TR.cam.tz = U.clamp(Math.max(cineZ * 1.35, 1.25), 0.8, 2.1);
    const a = isoC(att.x, att.y), b = isoC(tgt.x, tgt.y);
    TR.cam.tx = a[0] * 0.55 + b[0] * 0.45; TR.cam.ty = (a[1] + b[1]) / 2 - 24;
    return new Promise(function (res) { camWaiters.push(res); setTimeout(res, rt(520 / spd())); });
  };
  TR.actionCamEnd = function () {
    cineOn = false;
    if (cineZ !== null) { TR.cam.tz = cineZ; cineZ = null; }
  };
  TR.slowmo = function (on) { DW.timeScale = on ? 0.3 : 1; };
  let vigC = null, vigK = '';
  TR.vignette = function (W, H, a) {
    const k = W + 'x' + H + 'x' + a;
    if (vigC && vigK === k) return vigC;
    vigK = k;
    vigC = canvas(Math.ceil(W / 4), Math.ceil(H / 4));
    const g = vigC.getContext('2d');
    const w = vigC.width, h = vigC.height;
    const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + a + ')');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    return vigC;
  };
  TR.isAnimating = function () {
    const t = now();
    if (cineK > 0.01 || TR.cam.tz !== null && TR.cam.tz !== undefined) return true;
    const Bb = DW.BT.get();
    if (Bb && (Bb.weather === 'rain' || Bb.weather === 'dust')) return true;
    for (const k in anims) if (anims[k].kind !== 'die' && t - anims[k].t0 < anims[k].dur) return true;
    for (const k in deadAt) if (t - deadAt[k] < 3000) return true;
    return Object.keys(tweens).length > 0 || fx.parts.length > 0 || fx.tracers.length > 0 || fx.floats.length > 0 || fx.flashes.length > 0 || fx.projs.length > 0 || TR.cam.tx !== null || TR.shake > 0;
  };
  function BT_visVersion() { return DW.BT.visVersion; }
  function BT_obj(B, x, y) { return x >= 0 && y >= 0 && x < B.w && y < B.h ? B.obj[y * B.w + x] : 0; }

  DW.TR = TR;
})(window.DW);
