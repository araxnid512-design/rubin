'use strict';
/* Отрисовка тактического боя: процедурные тайлы, объекты, бойцы, эффекты */
(function (DW) {
  const U = DW.U, D = DW.D;
  const TR = {};
  const T = D.T;      // мировой размер клетки
  const P = 64;       // пикселей на клетку в пререндере

  let ground = null, groundCtx = null;
  let sprites = {};
  let fogC = null, fogV = -1;
  const tweens = {};
  let fx = { floats: [], tracers: [], parts: [], projs: [], flashes: [] };
  let camWaiters = [];
  TR.cam = { x: 0, y: 0, z: 1, tx: null, ty: null };
  TR.view = { w: 800, h: 400 };
  TR.overlay = null;

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function now() { return performance.now(); }
  function spd() { return (DW.settings && DW.settings.speed) || 1; }

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
  };

  /* ---------- Спрайты объектов ---------- */
  function block(g, oy, x0, y0, x1, y1, bh, topC, frontC) {
    g.fillStyle = frontC; g.fillRect(x0, oy + y1 - bh, x1 - x0, bh);
    g.fillStyle = topC; g.fillRect(x0, oy + y0 - bh, x1 - x0, y1 - y0);
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5;
    g.strokeRect(x0 + 0.5, oy + y0 - bh + 0.5, x1 - x0 - 1, y1 - y0 + bh - 1);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.moveTo(x0, oy + y1 - bh); g.lineTo(x1, oy + y1 - bh); g.stroke();
  }
  function speckle(g, x0, y0, w, h, n, rnd, dark) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + (dark || 0.15) + ')' : 'rgba(255,255,255,0.08)';
      g.fillRect(x0 + rnd() * w, y0 + rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
    }
  }
  function blobPoly(rnd, cx, cy, rx, ry, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const k = 0.75 + rnd() * 0.3;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }
  function fillPoly(g, pts, dy) {
    g.beginPath();
    pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1] + (dy || 0)); else g.moveTo(p[0], p[1] + (dy || 0)); });
    g.closePath(); g.fill();
  }
  function extrude(g, pts, bh, dark, mid, top) {
    for (let s = bh; s >= 0; s -= 2) {
      const t = 1 - s / (bh || 1);
      g.fillStyle = U.shade(mid, -0.45 + t * 0.35);
      fillPoly(g, pts, s);
    }
    g.fillStyle = top; fillPoly(g, pts, 0);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
    g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.stroke();
    void dark;
  }
  function makeSprite(type, variant) {
    const O = D.OBJ[type];
    const oy = Math.round(O.lift * P);
    const H = P + oy;
    const c = canvas(P, H);
    const g = c.getContext('2d');
    const rnd = U.srng(type * 977 + variant * 131 + 5);
    const bh = oy;
    let i, pts;
    switch (type) {
      case 1:
        block(g, oy, 3, 22, 61, 46, bh, '#8d877f', '#5f5a54');
        speckle(g, 3, oy + 22 - bh, 58, 24 + bh, 30, rnd);
        g.fillStyle = '#4a4540'; for (i = 0; i < 2; i++) g.fillRect(6 + rnd() * 48, oy + 46 - bh + 2, 6, 3);
        break;
      case 2:
        block(g, oy, 0, 8, 64, 56, bh, '#8a7f72', '#6e5f50');
        g.strokeStyle = 'rgba(40,30,22,0.6)'; g.lineWidth = 1;
        for (let r = 0; r < bh / 9; r++) {
          const yy = oy + 56 - bh + r * 9;
          g.beginPath(); g.moveTo(0, yy); g.lineTo(64, yy); g.stroke();
          for (let k = (r % 2) * 8; k < 64; k += 16) { g.beginPath(); g.moveTo(k, yy); g.lineTo(k, yy + 9); g.stroke(); }
        }
        speckle(g, 0, oy + 8 - bh, 64, 48, 40, rnd);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (i = 0; i < 3; i++) { const nx = rnd() * 56; g.fillRect(nx, oy + 8 - bh, 4 + rnd() * 8, 3 + rnd() * 6); }
        break;
      case 3:
        pts = blobPoly(rnd, 32, oy + 30 - bh * 0.1, 29, 24, 10);
        extrude(g, pts, bh, '#3e3832', '#6b625a', U.shade('#7c736a', (rnd() - 0.5) * 0.15));
        g.fillStyle = 'rgba(255,255,255,0.1)';
        g.beginPath(); g.ellipse(26, oy + 22 - bh * 0.1, 12, 7, -0.4, 0, 7); g.fill();
        speckle(g, 6, oy + 6, 52, 44, 25, rnd, 0.2);
        break;
      case 4:
        block(g, oy, 9, 16, 55, 50, bh, '#9a7444', '#76552f');
        g.strokeStyle = 'rgba(50,30,10,0.55)'; g.lineWidth = 1.5;
        for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(9, oy + 16 - bh + i * 8.5); g.lineTo(55, oy + 16 - bh + i * 8.5); g.stroke(); }
        g.beginPath(); g.moveTo(9, oy + 50 - bh); g.lineTo(55, oy + 50); g.moveTo(55, oy + 50 - bh); g.lineTo(9, oy + 50); g.stroke();
        break;
      case 5: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(32, oy + 44, 12, 5, 0, 0, 7); g.fill();
        g.strokeStyle = '#3e3026'; g.lineCap = 'round';
        g.lineWidth = 8; g.beginPath(); g.moveTo(32, oy + 44); g.quadraticCurveTo(28 + rnd() * 8, oy + 20, 32 + (rnd() - 0.5) * 10, oy - 10); g.stroke();
        g.lineWidth = 3.5;
        for (i = 0; i < 5; i++) {
          const sy = oy + 25 - i * 9, dir = i % 2 ? 1 : -1;
          g.beginPath(); g.moveTo(32, sy); g.quadraticCurveTo(32 + dir * 12, sy - 6, 32 + dir * (16 + rnd() * 10), sy - 14 - rnd() * 8); g.stroke();
        }
        g.lineWidth = 1.8;
        for (i = 0; i < 6; i++) { const sx = 18 + rnd() * 28, sy = oy - 4 + rnd() * 20; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (rnd() - 0.5) * 14, sy - 6 - rnd() * 8); g.stroke(); }
        g.lineCap = 'butt';
        break;
      }
      case 6:
        for (let row = 0; row < 2; row++) {
          for (i = 0; i < 4; i++) {
            const cx = 9 + i * 15 + (row ? 7 : 0), cy = oy + 44 - row * 11;
            if (row && i === 3) continue;
            g.fillStyle = '#7d6c4a'; g.beginPath(); g.ellipse(cx, cy + 4, 9, 6, 0, 0, 7); g.fill();
            g.fillStyle = U.shade('#a89468', (rnd() - 0.5) * 0.15); g.beginPath(); g.ellipse(cx, cy, 9, 6, 0, 0, 7); g.fill();
            g.strokeStyle = 'rgba(60,45,25,0.6)'; g.lineWidth = 1; g.stroke();
          }
        }
        break;
      case 7:
        block(g, oy, 2, 12, 62, 54, bh, '#7a4a30', '#583422');
        g.fillStyle = '#2a2622'; g.fillRect(14, oy + 12 - bh + 7, 36, 26);
        g.fillStyle = 'rgba(120,140,150,0.25)'; g.fillRect(16, oy + 12 - bh + 9, 14, 10);
        g.fillStyle = '#1a1714'; g.beginPath(); g.arc(14, oy + 54, 7, Math.PI, 0); g.fill(); g.beginPath(); g.arc(50, oy + 54, 7, Math.PI, 0); g.fill();
        for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(160,80,30,0.45)'; g.beginPath(); g.arc(4 + rnd() * 56, oy + 12 - bh + rnd() * (42 + bh), 2 + rnd() * 4, 0, 7); g.fill(); }
        break;
      case 8:
        for (i = 0; i < 3; i++) {
          pts = blobPoly(rnd, 16 + i * 16 + (rnd() - 0.5) * 6, oy + 34 - bh * 0.15 + (rnd() - 0.5) * 12, 14, 11, 7);
          extrude(g, pts, bh * (0.6 + rnd() * 0.4), '#3e3832', '#77706a', U.shade('#8a837b', (rnd() - 0.5) * 0.2));
        }
        break;
      case 9: {
        const by = oy + 50;
        g.fillStyle = '#5a3222'; g.fillRect(17, by - bh, 30, bh);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(17, by - bh * 0.7, 30, 3); g.fillRect(17, by - bh * 0.3, 30, 3);
        g.fillStyle = '#7d4a33'; g.beginPath(); g.ellipse(32, by - bh, 15, 7, 0, 0, 7); g.fill();
        g.fillStyle = '#4a2a1a'; g.beginPath(); g.ellipse(32, by - bh, 9, 4, 0, 0, 7); g.fill();
        g.fillStyle = '#e3a33b'; g.fillRect(28, by - bh * 0.6, 8, 6);
        break;
      }
      case 10: {
        const fy = oy + 58, by = oy + 10;
        g.fillStyle = '#7a7650'; g.beginPath(); g.moveTo(4, fy); g.lineTo(32, fy - bh); g.lineTo(32, by - bh); g.lineTo(4, by); g.closePath(); g.fill();
        g.fillStyle = '#5d5a3c'; g.beginPath(); g.moveTo(60, fy); g.lineTo(32, fy - bh); g.lineTo(32, by - bh); g.lineTo(60, by); g.closePath(); g.fill();
        g.fillStyle = '#4a4730'; g.beginPath(); g.moveTo(4, fy); g.lineTo(60, fy); g.lineTo(32, fy - bh); g.closePath(); g.fill();
        g.fillStyle = '#1e1c12'; g.beginPath(); g.moveTo(22, fy); g.lineTo(42, fy); g.lineTo(32, fy - bh * 0.6); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(32, fy - bh); g.lineTo(32, by - bh); g.stroke();
        break;
      }
      case 11:
        block(g, oy, 0, 8, 64, 56, bh, '#6b767e', '#4a545b');
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
        for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 16, oy + 56 - bh); g.lineTo(i * 16, oy + 56); g.stroke(); }
        for (i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e3a33b' : '#1d1d1d'; g.beginPath(); g.moveTo(i * 8, oy + 56); g.lineTo(i * 8 + 8, oy + 56); g.lineTo(i * 8 + 12, oy + 48); g.lineTo(i * 8 + 4, oy + 48); g.closePath(); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, oy + 8 - bh, 64, 3);
        break;
      case 12:
        block(g, oy, 9, 16, 55, 50, bh, '#56646c', '#3c474e');
        g.fillStyle = rnd() < 0.5 ? '#3fd0a0' : '#5aa9e6'; g.globalAlpha = 0.8; g.fillRect(15, oy + 16 - bh + 5, 34, 14); g.globalAlpha = 1;
        g.fillStyle = 'rgba(0,0,0,0.4)'; for (i = 0; i < 4; i++) g.fillRect(14 + i * 9, oy + 50 - bh * 0.6, 6, 2);
        break;
      case 13:
        for (i = 0; i < 8; i++) {
          const x0 = 1 + i * 8, top = oy + 50 - bh - rnd() * 7;
          g.fillStyle = i % 2 ? '#7a5a38' : '#6a4c2e';
          g.fillRect(x0, top, 7, oy + 52 - top);
          g.beginPath(); g.moveTo(x0, top); g.lineTo(x0 + 3.5, top - 7); g.lineTo(x0 + 7, top); g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 + 5, top, 2, oy + 52 - top);
        }
        g.strokeStyle = '#3a2a18'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, oy + 40 - bh * 0.4); g.lineTo(64, oy + 40 - bh * 0.4); g.stroke();
        break;
      case 14:
        block(g, oy, 0, 10, 64, 56, bh, '#8a8478', '#6e685e');
        g.strokeStyle = 'rgba(40,35,30,0.55)'; g.lineWidth = 1.2;
        for (let r = 0; r < bh / 10; r++) {
          const yy = oy + 56 - bh + r * 10;
          g.beginPath(); g.moveTo(0, yy); g.lineTo(64, yy); g.stroke();
          let k = (r % 2) * 10 + rnd() * 4;
          while (k < 64) { g.beginPath(); g.moveTo(k, yy); g.lineTo(k, yy + 10); g.stroke(); k += 14 + rnd() * 8; }
        }
        speckle(g, 0, oy + 10 - bh, 64, 46, 30, rnd);
        break;
      case 15:
        block(g, oy, 2, 38, 62, 60, 12, '#4a5560', '#333c44');
        g.strokeStyle = '#2a3238'; g.lineWidth = 10;
        g.beginPath(); g.ellipse(32, oy + 18, 26, 44, 0, 0, 7); g.stroke();
        g.strokeStyle = '#5a6a76'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(32, oy + 18, 26, 44, 0, 0, 7); g.stroke();
        for (i = 0; i < 8; i++) { const a = i / 8 * 6.28; g.fillStyle = '#8fd8e6'; g.beginPath(); g.arc(32 + Math.cos(a) * 26, oy + 18 + Math.sin(a) * 44, 2.5, 0, 7); g.fill(); }
        break;
      case 16:
        pts = blobPoly(rnd, 32, oy + 32 - bh * 0.2, 20, 16, 9);
        extrude(g, pts, bh, '#2a1a1e', '#5d3a40', '#7a4a54');
        g.fillStyle = '#c87a8a';
        for (i = 0; i < 5; i++) { const sx = 18 + rnd() * 28, sy = oy + 20 - bh * 0.3 + rnd() * 18; g.beginPath(); g.moveTo(sx - 3, sy); g.lineTo(sx, sy - 10 - rnd() * 8); g.lineTo(sx + 3, sy); g.closePath(); g.fill(); }
        g.fillStyle = 'rgba(255,150,170,0.35)'; g.beginPath(); g.ellipse(28, oy + 26 - bh * 0.2, 7, 4, 0, 0, 7); g.fill();
        break;
      case 17:
        block(g, oy, 0, 4, 64, 60, bh, '#7a6a55', '#5e4c3a');
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
        for (i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * 8, oy + 4 - bh); g.lineTo(i * 8, oy + 60 - bh); g.stroke(); }
        g.fillStyle = '#2a2018'; g.fillRect(10, oy + 60 - bh * 0.75, 12, 12);
        g.fillStyle = 'rgba(227,163,59,0.35)'; g.fillRect(12, oy + 60 - bh * 0.75 + 2, 8, 8);
        g.fillStyle = '#3a2a1c'; g.fillRect(36, oy + 60 - bh * 0.6, 14, bh * 0.6);
        break;
      default:
        block(g, oy, 4, 10, 60, 54, bh, '#888', '#555');
    }
    return { c: c, oy: oy };
  }
  function sprite(type, x, y) {
    const v = Math.floor(U.hash2(x, y, type) * 3);
    const key = type + '_' + v;
    if (!sprites[key]) sprites[key] = makeSprite(type, v);
    return sprites[key];
  }

  /* ---------- Инициализация ---------- */
  TR.init = function (B) {
    sprites = {};
    fx = { floats: [], tracers: [], parts: [], projs: [], flashes: [] };
    for (const k in tweens) delete tweens[k];
    camWaiters = [];
    buildGround(B);
    fogC = canvas(B.w, B.h);
    fogV = -1;
    const vh = TR.view.h, vw = TR.view.w;
    TR.cam.z = U.clamp(Math.min(vh / (10.5 * T), vw / (16 * T)), 0.55, 1.6);
    const sol = DW.BT.soldiers();
    if (sol.length) {
      let cx = 0, cy = 0;
      sol.forEach(function (s) { cx += s.x; cy += s.y; });
      TR.cam.x = (cx / sol.length + 0.5) * T + vw * 0.15 / TR.cam.z;
      TR.cam.y = (cy / sol.length + 0.5) * T;
    } else { TR.cam.x = B.w * T / 2; TR.cam.y = B.h * T / 2; }
    TR.cam.tx = null; TR.cam.ty = null;
    clampCam();
  };
  TR.resize = function (w, h) { TR.view.w = w; TR.view.h = h; clampCam(); };

  function clampCam() {
    const B = DW.BT.get();
    if (!B) return;
    const z = TR.cam.z;
    const mw = B.w * T, mh = B.h * T;
    const hw = TR.view.w / 2 / z, hh = TR.view.h / 2 / z;
    const mx = 2.5 * T, my = 3.2 * T;
    TR.cam.x = mw + 2 * mx < hw * 2 ? mw / 2 : U.clamp(TR.cam.x, hw - mx, mw - hw + mx);
    TR.cam.y = mh + 2 * my < hh * 2 ? mh / 2 : U.clamp(TR.cam.y, hh - my, mh - hh + my);
  }
  TR.pan = function (dx, dy) {
    TR.cam.x -= dx / TR.cam.z; TR.cam.y -= dy / TR.cam.z;
    TR.cam.tx = null; TR.cam.ty = null;
    clampCam();
  };
  TR.zoomAt = function (f, sx, sy) {
    const before = TR.screenToWorld(sx, sy);
    TR.cam.z = U.clamp(TR.cam.z * f, 0.45, 2.4);
    const after = TR.screenToWorld(sx, sy);
    TR.cam.x += before[0] - after[0]; TR.cam.y += before[1] - after[1];
    clampCam();
  };
  TR.screenToWorld = function (sx, sy) {
    return [(sx - TR.view.w / 2) / TR.cam.z + TR.cam.x, (sy - TR.view.h / 2) / TR.cam.z + TR.cam.y];
  };
  TR.screenToTile = function (sx, sy) {
    const w = TR.screenToWorld(sx, sy);
    return [Math.floor(w[0] / T), Math.floor(w[1] / T)];
  };
  TR.tileToScreen = function (x, y) {
    return [((x + 0.5) * T - TR.cam.x) * TR.cam.z + TR.view.w / 2, ((y + 0.5) * T - TR.cam.y) * TR.cam.z + TR.view.h / 2];
  };
  TR.focusOn = function (tx, ty, force) {
    const s = TR.tileToScreen(tx, ty);
    const mx = TR.view.w * 0.2, my = TR.view.h * 0.22;
    if (!force && s[0] > mx && s[0] < TR.view.w - mx && s[1] > my && s[1] < TR.view.h - my) return Promise.resolve();
    TR.cam.tx = (tx + 0.5) * T; TR.cam.ty = (ty + 0.5) * T;
    return new Promise(function (res) {
      camWaiters.push(res);
      setTimeout(function () { res(); }, 600);
    });
  };

  /* ---------- Анимации ---------- */
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
  TR.stepFx = function (u, nx, ny) {
    return new Promise(function (res) {
      tweens[u.id] = { fx: u.x, fy: u.y, tx: nx, ty: ny, t0: now(), dur: 115 / spd(), res: res, kind: 'step' };
      if (u.side === 'p') {
        const s = TR.tileToScreen(nx, ny);
        if (s[0] < TR.view.w * 0.12 || s[0] > TR.view.w * 0.88 || s[1] < TR.view.h * 0.15 || s[1] > TR.view.h * 0.8) {
          TR.cam.tx = (nx + 0.5) * T; TR.cam.ty = (ny + 0.5) * T;
        }
      }
    });
  };
  TR.lungeFx = function (att, tgt) {
    return new Promise(function (res) {
      tweens[att.id] = { fx: att.x, fy: att.y, tx: tgt.x, ty: tgt.y, t0: now(), dur: 260 / spd(), res: res, kind: 'lunge' };
    });
  };
  TR.float = function (x, y, text, kind) {
    const col = { dmg: '#ffdf6b', crit: '#ff7b3b', hurt: '#ff5a4f', miss: '#cfc7b8', gem: '#7fe6f5', info: '#e8dcc8', good: '#8fd16b', bad: '#ff6b5b' }[kind] || '#fff';
    const off = fx.floats.filter(function (f) { return f.tx === x && f.ty === y && now() - f.t0 < 600; }).length;
    fx.floats.push({ x: (x + 0.5) * T, y: (y + 0.1) * T - off * 14, tx: x, ty: y, text: text, color: col, t0: now(), life: 1400, big: kind === 'crit' });
  };
  function parts(x, y, n, color, speed, life, size, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      fx.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (grav ? speed * 0.4 : 0), t0: now(), life: life * (0.6 + Math.random() * 0.6), color: color, size: size * (0.5 + Math.random()), grav: grav || 0 });
    }
  }
  TR.blood = function (u) {
    const beast = u.side === 'e' && D.ENEMIES[u.type] && D.ENEMIES[u.type].beast;
    const mech = u.side === 'e' && D.ENEMIES[u.type] && D.ENEMIES[u.type].mech;
    const col = mech || u.kind === 'turret' ? '#ffd27a' : (beast ? '#7a9a2a' : '#9a1a1a');
    parts((u.x + 0.5) * T, (u.y + 0.3) * T, 12, col, 120, 450, 3.5, 300);
  };
  TR.debris = function (x, y, color) {
    parts((x + 0.5) * T, (y + 0.4) * T, 16, color || '#888', 160, 600, 4, 400);
    parts((x + 0.5) * T, (y + 0.4) * T, 8, 'rgba(160,150,140,0.5)', 50, 900, 9, 0);
  };
  TR.explosionFx = function (x, y, r) {
    const cx = (x + 0.5) * T, cy = (y + 0.5) * T;
    fx.flashes.push({ x: cx, y: cy, r: (r + 0.6) * T, t0: now(), life: 380 });
    parts(cx, cy, 40, '#ffb347', 260 * r, 500, 5, 0);
    parts(cx, cy, 24, '#ff5a1f', 180 * r, 650, 6, 0);
    parts(cx, cy, 20, 'rgba(60,55,50,0.6)', 70 * r, 1400, 14, -20);
    TR.shake = 10;
  };
  TR.shotFx = function (att, tgt, hit, W, show, suppress) {
    const s = spd();
    const ax = (att.x + 0.5) * T, ay = (att.y + 0.3) * T;
    let tx = (tgt.x + 0.5) * T, ty = (tgt.y + 0.3) * T;
    const cnt = { rifle: 3, lmg: 5, shotgun: 1, sniper: 1, spit: 1, beam: 1 }[W.snd] || 1;
    const gap = (W.snd === 'lmg' ? 70 : 90) / s;
    const t0 = now();
    const col = W.snd === 'spit' ? '#a8e03a' : (W.snd === 'beam' ? '#6fd8ff' : '#ffe08a');
    for (let i = 0; i < cnt; i++) {
      let ex = tx, ey = ty;
      if (!hit || suppress) {
        const a = Math.random() * Math.PI * 2, d = (0.5 + Math.random() * 0.7) * T;
        ex += Math.cos(a) * d; ey += Math.sin(a) * d;
      } else { ex += (Math.random() - 0.5) * 8; ey += (Math.random() - 0.5) * 8; }
      fx.tracers.push({ x1: ax, y1: ay, x2: ex, y2: ey, t0: t0 + i * gap, life: W.snd === 'spit' ? 260 : 110, color: col, w: W.snd === 'sniper' || W.snd === 'beam' ? 3 : (W.snd === 'spit' ? 6 : 2), spit: W.snd === 'spit' });
      if (W.snd === 'shotgun') {
        for (let k = 0; k < 4; k++) fx.tracers.push({ x1: ax, y1: ay, x2: ex + (Math.random() - 0.5) * 30, y2: ey + (Math.random() - 0.5) * 30, t0: t0, life: 110, color: col, w: 1.2 });
      }
    }
    if (show || att.side === 'p') DW.SFX.play(W.snd);
    fx.flashes.push({ x: ax, y: ay, r: 16, t0: t0, life: 90 + cnt * gap, muzzle: true });
    const dur = (cnt - 1) * gap + 180 / s;
    return new Promise(function (res) { setTimeout(res, dur); });
  };
  TR.projectileFx = function (x0, y0, x1, y1, kind) {
    return new Promise(function (res) {
      fx.projs.push({ x0: (x0 + 0.5) * T, y0: (y0 + 0.4) * T, x1: (x1 + 0.5) * T, y1: (y1 + 0.5) * T, t0: now(), dur: (kind === 'rocket' ? 380 : 520) / spd(), kind: kind, res: res });
    });
  };

  TR.update = function (dt) {
    const c = TR.cam;
    if (c.tx !== null) {
      const k = Math.min(1, dt * 7);
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
      clampCam();
      if (Math.abs(c.tx - c.x) < 3 && Math.abs(c.ty - c.y) < 3) {
        c.tx = null; c.ty = null;
        const w = camWaiters; camWaiters = [];
        w.forEach(function (r) { r(); });
      }
    } else if (camWaiters.length) {
      const w = camWaiters; camWaiters = [];
      w.forEach(function (r) { r(); });
    }
    const t = now();
    for (const id in tweens) {
      const tw = tweens[id];
      if (t - tw.t0 >= tw.dur) { delete tweens[id]; tw.res(); }
    }
    for (let i = fx.projs.length - 1; i >= 0; i--) {
      const p = fx.projs[i];
      if (t - p.t0 >= p.dur) { fx.projs.splice(i, 1); p.res(); }
    }
    fx.parts.forEach(function (p) { p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; });
    fx.parts = fx.parts.filter(function (p) { return t - p.t0 < p.life; });
    fx.floats = fx.floats.filter(function (f) { return t - f.t0 < f.life; });
    fx.tracers = fx.tracers.filter(function (f) { return t - f.t0 < f.life; });
    fx.flashes = fx.flashes.filter(function (f) { return t - f.t0 < f.life; });
    if (TR.shake) TR.shake = Math.max(0, TR.shake - dt * 40);
  };

  /* ---------- Юниты ---------- */
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); g.fill();
  }
  function gun(g, px, py, face, len, thick, color) {
    g.save(); g.translate(px, py); g.rotate(face);
    g.fillStyle = color || '#222';
    g.fillRect(0, -thick / 2, len, thick);
    g.fillRect(2, thick / 2 - 1, 4, 5);
    g.restore();
  }
  function drawHuman(g, u, px, py, t, o) {
    const s = o.scale || 1;
    g.save(); g.translate(px, py); g.scale(s, s);
    const bob = o.moving ? Math.sin(t / 60) * 1.2 : Math.sin(t / 500 + u.id) * 0.5;
    g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, 0, 13, 13, 5);
    g.fillStyle = o.legs || '#3a3128';
    g.fillRect(-6, 1, 5, 12); g.fillRect(1, 1, 5, 12);
    g.translate(0, bob);
    g.fillStyle = o.body; rrect(g, -9, -11, 18, 15, 5);
    if (o.vest) { g.fillStyle = o.vest; rrect(g, -8, -10, 16, 11, 4); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-2, -10, 4, 11); }
    if (o.mark) { g.fillStyle = o.mark; g.fillRect(-9, -10, 4, 4); }
    const f = u.face || 0;
    const wl = o.gunLen || 20;
    gun(g, 0, -4, f, wl, o.gunThick || 4, o.gunColor);
    g.fillStyle = o.skin || '#d4a582';
    circ(g, Math.cos(f) * 7, -4 + Math.sin(f) * 7, 2.6);
    g.fillStyle = o.skin || '#d4a582'; circ(g, 0, -16, 6.5);
    if (o.hair) { g.fillStyle = o.hair; g.beginPath(); g.arc(0, -17, 6.6, Math.PI, 0); g.fill(); }
    if (o.mask) { g.fillStyle = o.mask; g.fillRect(-6.5, -15, 13, 5); }
    if (o.hood) { g.fillStyle = o.hood; g.beginPath(); g.arc(0, -16, 8, Math.PI * 0.95, Math.PI * 0.05); g.lineTo(6, -10); g.lineTo(-6, -10); g.closePath(); g.fill(); }
    const fx2 = Math.cos(f) >= 0 ? 2.5 : -2.5;
    g.fillStyle = '#111'; g.fillRect(fx2 - 1, -17, 2, 2);
    if (o.cig) {
      g.strokeStyle = '#eee'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx2 * 1.4, -13); g.lineTo(fx2 * 1.4 + (fx2 > 0 ? 6 : -6), -12); g.stroke();
      g.fillStyle = (Math.sin(t / 300) > 0) ? '#ff7a2a' : '#d65a1a'; g.fillRect(fx2 * 1.4 + (fx2 > 0 ? 5 : -7), -13, 2, 2);
    }
    g.restore();
  }
  const GUN_LEN = { ak: 20, ak2: 21, shotgun: 17, sniper: 27, hsniper: 30, lmg: 23, hlmg: 26 };
  function drawUnit(g, u, t, sel) {
    const p = rp(u);
    const px = (p[0] + 0.5) * T, py = (p[1] + 0.5) * T;
    const moving = !!tweens[u.id];
    if (sel) {
      g.strokeStyle = 'rgba(120,200,255,' + (0.6 + Math.sin(t / 200) * 0.3) + ')'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(px, py + 12, 19, 8, 0, 0, 7); g.stroke();
    }
    if (u.kind === 'soldier') {
      const ar = D.ARMORS[u.armorId || 'robe'];
      drawHuman(g, u, px, py, t, {
        moving: moving, body: '#c8691c', vest: u.armorId && u.armorId !== 'robe' ? ar.color : null,
        skin: u.look ? u.look.skin : '#d4a582', hair: u.look ? u.look.hair : '#333',
        mark: D.CLASSES[u.cls] ? D.CLASSES[u.cls].color : null, gunLen: GUN_LEN[u.weapon] || 20,
        gunThick: u.weapon === 'lmg' || u.weapon === 'hlmg' ? 5 : 4, cig: u.name === 'Мальборо', legs: '#2f2a24'
      });
      return;
    }
    if (u.kind === 'turret') {
      g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, px, py + 12, 15, 6);
      g.strokeStyle = '#333'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px - 11, py + 12); g.moveTo(px, py); g.lineTo(px + 11, py + 12); g.moveTo(px, py); g.lineTo(px, py + 13); g.stroke();
      g.fillStyle = '#5a646b'; rrect(g, px - 9, py - 12, 18, 13, 3);
      gun(g, px, py - 6, u.face || 0, 22, 4, '#2a2f33');
      g.fillStyle = '#6fd8ff'; circ(g, px, py - 9, 2.2);
      return;
    }
    const f = u.face || Math.PI;
    const dir = Math.cos(f) >= 0 ? 1 : -1;
    const br = Math.sin(t / 300 + u.id) * 1;
    switch (u.type) {
      case 'scav':
        g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, px, py + 12, 15, 5);
        g.strokeStyle = '#3e3028'; g.lineWidth = 3;
        for (let i = 0; i < 4; i++) { const lx = px - 9 + i * 6; g.beginPath(); g.moveTo(lx, py + 2); g.lineTo(lx + (moving ? Math.sin(t / 50 + i) * 3 : 0) - 2, py + 12); g.stroke(); }
        g.fillStyle = '#6d5a4c'; ell(g, px, py + br, 15, 9);
        g.fillStyle = '#4e3f35';
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(px - 8 + i * 5, py - 6 + br); g.lineTo(px - 6 + i * 5, py - 14 + br); g.lineTo(px - 4 + i * 5, py - 6 + br); g.closePath(); g.fill(); }
        g.fillStyle = '#5d4a3e'; ell(g, px + dir * 13, py - 2 + br, 7, 6);
        g.fillStyle = '#ff3a2a'; circ(g, px + dir * 16, py - 4 + br, 1.6); circ(g, px + dir * 13, py - 4 + br, 1.6);
        g.fillStyle = '#e8dcc8'; g.fillRect(px + dir * 17 - 1, py + br, 2, 3);
        break;
      case 'brute':
        g.fillStyle = 'rgba(0,0,0,0.4)'; ell(g, px, py + 14, 20, 7);
        g.fillStyle = '#4a3a36'; ell(g, px - 15, py - 2 + br, 7, 12); ell(g, px + 15, py - 2 + br, 7, 12);
        g.fillStyle = '#5b4a45'; rrect(g, px - 14, py - 20 + br, 28, 32, 9);
        g.fillStyle = '#6e5c55'; rrect(g, px - 10, py - 17 + br, 20, 8, 3); rrect(g, px - 10, py - 7 + br, 20, 8, 3);
        g.fillStyle = '#4a3a36'; circ(g, px + dir * 3, py - 22 + br, 6);
        g.fillStyle = '#ffcc33'; circ(g, px + dir * 5, py - 23 + br, 1.5); circ(g, px + dir * 1, py - 23 + br, 1.5);
        g.fillStyle = '#2a201c'; g.fillRect(px - 12, py + 10, 7, 5); g.fillRect(px + 5, py + 10, 7, 5);
        break;
      case 'spitter':
        g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, px, py + 12, 14, 5);
        g.strokeStyle = '#4a5520'; g.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(px - 6 + i * 6, py + 4); g.lineTo(px - 8 + i * 7, py + 12); g.stroke(); }
        g.fillStyle = '#7a8a3a'; circ(g, px, py - 3 + br, 12 + br * 0.5);
        g.fillStyle = 'rgba(40,60,10,0.5)'; circ(g, px - 4, py - 6 + br, 3); circ(g, px + 3, py + 1 + br, 2.5); circ(g, px - 2, py + 3 + br, 2);
        g.fillStyle = '#2a3010'; ell(g, px + dir * 9, py - 2 + br, 4, 5);
        g.fillStyle = '#b8f040'; circ(g, px + dir * 10, py + 4 + br, 1.6);
        g.fillStyle = '#ffe23a'; circ(g, px + dir * 4, py - 9 + br, 1.8);
        break;
      case 'raider':
        drawHuman(g, u, px, py, t, { moving: moving, body: '#4a3b2e', vest: '#3a2e24', skin: '#c99a74', hair: '#1a1a1a', mask: '#8a2222', gunLen: 20, legs: '#2a2520' });
        break;
      case 'thug':
        drawHuman(g, u, px, py, t, { moving: moving, body: '#6a4228', skin: '#b8865e', gunLen: 16, gunThick: 5, legs: '#2a2520' });
        break;
      case 'marksman':
        drawHuman(g, u, px, py, t, { moving: moving, body: '#3a4530', skin: '#c99a74', hood: '#2f3a2a', gunLen: 28, legs: '#262a20' });
        break;
      case 'boss':
        drawHuman(g, u, px, py, t, { moving: moving, scale: 1.25, body: '#1f1b18', vest: '#2e2622', mark: '#c0302a', skin: '#c99a74', hair: '#555', gunLen: 21, legs: '#151210' });
        break;
      case 'guardian':
        g.fillStyle = 'rgba(0,0,0,0.4)'; ell(g, px, py + 13, 16, 6);
        g.strokeStyle = '#3a4248'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - 12, py + 13); g.moveTo(px, py); g.lineTo(px + 12, py + 13); g.moveTo(px, py); g.lineTo(px + 2, py + 14); g.stroke();
        g.fillStyle = '#5a646b';
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.5; const xx = px + Math.cos(a) * 13, yy = py - 8 + Math.sin(a) * 11 + br; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
        g.closePath(); g.fill();
        g.fillStyle = '#3c454b'; rrect(g, px - 7, py - 13 + br, 14, 8, 2);
        g.fillStyle = '#6fd8ff'; circ(g, px + dir * 3, py - 9 + br, 3 + Math.sin(t / 200) * 0.6);
        gun(g, px, py - 4 + br, f, 18, 5, '#2a3238');
        break;
      case 'queen': {
        g.fillStyle = 'rgba(0,0,0,0.45)'; ell(g, px, py + 16, 32, 10);
        g.strokeStyle = '#2a1420'; g.lineWidth = 4;
        for (let i = 0; i < 6; i++) { const lx = px - 22 + i * 9; g.beginPath(); g.moveTo(lx, py); g.quadraticCurveTo(lx - 6, py + 6, lx - 4 + Math.sin(t / 200 + i) * 2, py + 16); g.stroke(); }
        g.fillStyle = '#4a2238'; ell(g, px, py - 6 + br, 30, 20);
        g.fillStyle = '#5e2c48'; ell(g, px - dir * 10, py - 10 + br, 16, 12);
        g.fillStyle = '#7a3a5e';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(px - 20 + i * 8, py - 20 + br); g.lineTo(px - 17 + i * 8, py - 36 - (i % 2) * 6 + br); g.lineTo(px - 14 + i * 8, py - 20 + br); g.closePath(); g.fill(); }
        g.fillStyle = '#3a1a2c'; ell(g, px + dir * 24, py - 4 + br, 11, 9);
        g.fillStyle = '#ff3a6a'; circ(g, px + dir * 28, py - 7 + br, 2.2); circ(g, px + dir * 23, py - 8 + br, 2.2); circ(g, px + dir * 26, py - 2 + br, 1.6);
        break;
      }
      default:
        g.fillStyle = '#a33'; circ(g, px, py, 12);
    }
  }
  function drawCorpse(g, c) {
    const px = (c.x + 0.5) * T, py = (c.y + 0.6) * T;
    g.fillStyle = c.side === 'e' ? 'rgba(60,70,20,0.55)' : 'rgba(90,10,10,0.55)';
    ell(g, px, py, 17, 8);
    g.save(); g.translate(px, py); g.rotate((c.face || 0) * 0.3);
    g.fillStyle = c.side === 'p' ? '#7a4a20' : (c.type === 'guardian' || c.type === 'turret' ? '#3a4248' : '#3e3430');
    rrect(g, -12, -5, 24, 10, 4);
    g.restore();
  }
  function drawItem(g, it, t) {
    const px = (it.x + 0.5) * T, py = (it.y + 0.5) * T;
    if (it.kind === 'gems') {
      const glow = 0.35 + Math.sin(t / 300 + it.x) * 0.15;
      const gr = g.createRadialGradient(px, py, 2, px, py, 22);
      gr.addColorStop(0, 'rgba(95,212,230,' + glow + ')'); gr.addColorStop(1, 'rgba(95,212,230,0)');
      g.fillStyle = gr; circ(g, px, py, 22);
      const shards = [[-6, 2, 5], [3, -1, 7], [8, 5, 4], [-1, 6, 4]];
      shards.forEach(function (s) {
        g.fillStyle = '#5fd4e6';
        g.beginPath(); g.moveTo(px + s[0], py + s[1] - s[2] * 1.8); g.lineTo(px + s[0] + s[2] * 0.7, py + s[1]); g.lineTo(px + s[0], py + s[1] + s[2] * 0.4); g.lineTo(px + s[0] - s[2] * 0.7, py + s[1]); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath(); g.moveTo(px + s[0], py + s[1] - s[2] * 1.8); g.lineTo(px + s[0] + s[2] * 0.3, py + s[1] - s[2] * 0.4); g.lineTo(px + s[0] - s[2] * 0.2, py + s[1]); g.closePath(); g.fill();
      });
      if (Math.sin(t / 150 + it.y * 3) > 0.92) { g.fillStyle = '#fff'; circ(g, px + 4, py - 8, 1.5); }
    } else {
      const col = { ammo: '#d6b04a', food: '#b98a4a', meds: '#d9534f', materials: '#8a6a46', grenades: '#5f6b3a' }[it.kind] || '#aaa';
      g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, px + 2, py + 10, 13, 5);
      g.fillStyle = '#5a4a32'; rrect(g, px - 11, py - 6, 22, 15, 2);
      g.fillStyle = '#6f5c3e'; rrect(g, px - 11, py - 10, 22, 7, 2);
      g.fillStyle = col; g.fillRect(px - 4, py - 3, 8, 8);
      const pulse = 0.3 + Math.sin(t / 350 + it.x) * 0.2;
      g.strokeStyle = 'rgba(255,230,160,' + pulse + ')'; g.lineWidth = 1.5; g.strokeRect(px - 13, py - 12, 26, 23);
    }
  }
  function hpBar(g, u, px, py) {
    const n = u.maxHp;
    const big = n > 16;
    const pw = big ? Math.max(1.6, 60 / n) : 4.2, gap = big ? 0.6 : 1.2;
    const w = n * (pw + gap) - gap;
    const x0 = px - w / 2;
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(x0 - 2, py - 2, w + 4, 8);
    for (let i = 0; i < n; i++) {
      g.fillStyle = i < u.hp ? (u.side === 'p' ? (u.hp <= u.maxHp * 0.34 ? '#e3a33b' : '#7fd06a') : '#e0473f') : 'rgba(255,255,255,0.12)';
      g.fillRect(x0 + i * (pw + gap), py, pw, 4);
    }
    if (u.armor) {
      g.fillStyle = '#9ab'; g.font = 'bold 9px sans-serif'; g.textAlign = 'right';
      g.fillText('◆' + u.armor, x0 - 4, py + 5);
    }
  }
  function statusIcons(g, u, px, py, t) {
    let x = px - 10;
    g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
    if (u.overwatch) { g.fillStyle = '#ffd25a'; g.beginPath(); g.ellipse(x, py, 7, 4, 0, 0, 7); g.fill(); g.fillStyle = '#222'; circ(g, x, py, 2); x += 16; }
    if (u.hunker) { g.fillStyle = '#6fa8dc'; g.beginPath(); g.moveTo(x - 5, py - 5); g.lineTo(x + 5, py - 5); g.lineTo(x + 5, py); g.lineTo(x, py + 5); g.lineTo(x - 5, py); g.closePath(); g.fill(); x += 16; }
    if (u.suppressed) { g.fillStyle = '#ff7b3b'; g.fillText('▼', x, py + 4); x += 16; }
    void t;
  }
  function shield(g, x, y, full, color) {
    g.save(); g.translate(x, y);
    g.beginPath(); g.moveTo(-7, -8); g.lineTo(7, -8); g.lineTo(7, 0); g.quadraticCurveTo(7, 6, 0, 9); g.quadraticCurveTo(-7, 6, -7, 0); g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill();
    g.strokeStyle = color; g.lineWidth = 2; g.stroke();
    if (full) { g.fillStyle = color; g.fill(); }
    else { g.save(); g.clip(); g.fillStyle = color; g.fillRect(-8, 0, 16, 10); g.restore(); }
    g.restore();
  }

  /* ---------- Главный рендер ---------- */
  TR.render = function (g, W, H, dpr) {
    const B = DW.BT.get();
    if (!B || !ground) return;
    const t = now();
    const z = TR.cam.z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0b0a09'; g.fillRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (TR.shake) { sx = (Math.random() - 0.5) * TR.shake; sy = (Math.random() - 0.5) * TR.shake; }
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - TR.cam.x * z + sx), dpr * (H / 2 - TR.cam.y * z + sy));
    g.imageSmoothingEnabled = true;
    g.drawImage(ground, 0, 0, B.w * T, B.h * T);

    const vw = W / z, vh = H / z;
    const tx0 = Math.max(0, Math.floor((TR.cam.x - vw / 2) / T) - 1), tx1 = Math.min(B.w - 1, Math.ceil((TR.cam.x + vw / 2) / T) + 1);
    const ty0 = Math.max(0, Math.floor((TR.cam.y - vh / 2) / T) - 1), ty1 = Math.min(B.h - 1, Math.ceil((TR.cam.y + vh / 2) / T) + 2);
    const ov = TR.overlay || {};
    const vis = DW.BT.vis();

    // зона эвакуации
    if (B.evac.length) {
      g.fillStyle = 'rgba(90,200,110,' + (0.13 + Math.sin(t / 500) * 0.04) + ')';
      B.evac.forEach(function (e) { g.fillRect(e[0] * T + 1, e[1] * T + 1, T - 2, T - 2); });
      g.strokeStyle = 'rgba(120,230,140,0.5)'; g.lineWidth = 1.5;
      B.evac.forEach(function (e) {
        const cx = (e[0] + 0.5) * T, cy = (e[1] + 0.5) * T;
        g.beginPath(); g.moveTo(cx - 5, cy + 2); g.lineTo(cx, cy - 4); g.lineTo(cx + 5, cy + 2); g.stroke();
      });
    }
    // зона перемещения
    if (ov.reach) {
      const R = ov.reach, m1 = ov.m1, m2 = ov.m2;
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const i = y * B.w + x;
        const c = R.cost[i];
        if (c === Infinity || c === 0 || R.occ[i]) continue;
        if (c <= m1 + 0.01) g.fillStyle = 'rgba(80,170,255,0.17)';
        else if (c <= m2 + 0.01) g.fillStyle = 'rgba(255,200,60,0.13)';
        else continue;
        g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      }
    }
    // трупы, предметы
    B.corpses.forEach(function (c) { if (c.x >= tx0 && c.x <= tx1 && c.y >= ty0 && c.y <= ty1 && B.explored[c.y * B.w + c.x]) drawCorpse(g, c); });
    B.items.forEach(function (it) { if (B.explored[it.y * B.w + it.x]) drawItem(g, it, t); });
    // тени объектов
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const o = B.obj[y * B.w + x];
      if (!o || o === 5 || o === 13) continue;
      g.fillRect(x * T + T * 0.18, y * T + T * 0.25, T * 0.95, T * 0.9);
    }
    // объекты и юниты по рядам
    const rows = {};
    B.units.forEach(function (u) {
      if (!u.alive || u.evac) return;
      if (u.side === 'e' && !u.seen) return;
      const p = rp(u);
      const r = Math.round(p[1]);
      (rows[r] = rows[r] || []).push(u);
    });
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const o = B.obj[y * B.w + x];
        if (!o) continue;
        const sp = sprite(o, x, y);
        g.drawImage(sp.c, x * T, y * T - sp.oy * T / P, T, sp.c.height * T / P);
        if (o === 15) {
          const gl = 0.4 + Math.sin(t / 400) * 0.15;
          const gr = g.createRadialGradient((x + 0.5) * T, (y + 0.1) * T, 2, (x + 0.5) * T, (y + 0.1) * T, T * 0.8);
          gr.addColorStop(0, 'rgba(140,240,255,' + gl + ')'); gr.addColorStop(1, 'rgba(95,212,230,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse((x + 0.5) * T, (y + 0.15) * T - sp.oy * T / P * 0.3, T * 0.35, T * 0.62, 0, 0, 7); g.fill();
        }
      }
      const ru = rows[y];
      if (ru) ru.forEach(function (u) { drawUnit(g, u, t, ov.sel === u); });
    }
    B.decor.forEach(function (d) {
      if (d.t !== 'fire') return;
      const fx0 = d.x * T, fy0 = d.y * T;
      for (let i = 0; i < 3; i++) {
        const h = 10 + Math.sin(t / 90 + i * 2) * 4;
        g.fillStyle = i === 0 ? 'rgba(255,120,30,0.85)' : (i === 1 ? 'rgba(255,190,60,0.8)' : 'rgba(255,240,150,0.7)');
        g.beginPath(); g.moveTo(fx0 - 7 + i * 3, fy0 + 3); g.quadraticCurveTo(fx0 - 3 + i * 2, fy0 - h, fx0 + Math.sin(t / 120 + i) * 2, fy0 - h - 6 + i * 3); g.quadraticCurveTo(fx0 + 5 - i, fy0 - h * 0.5, fx0 + 7 - i * 3, fy0 + 3); g.closePath(); g.fill();
      }
    });

    // туман войны
    if (BT_visVersion() !== fogV) {
      fogV = BT_visVersion();
      const fg = fogC.getContext('2d');
      const img = fg.createImageData(B.w, B.h);
      for (let i = 0; i < B.w * B.h; i++) {
        const a = vis && vis[i] ? 0 : (B.explored[i] ? 120 : 228);
        img.data[i * 4] = 8; img.data[i * 4 + 1] = 7; img.data[i * 4 + 2] = 6; img.data[i * 4 + 3] = a;
      }
      fg.putImageData(img, 0, 0);
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(fogC, 0, 0, B.w * T, B.h * T);
    g.fillStyle = 'rgba(8,7,6,0.92)';
    g.fillRect(-T * 4, -T * 4, B.w * T + T * 8, T * 4); g.fillRect(-T * 4, B.h * T, B.w * T + T * 8, T * 4);
    g.fillRect(-T * 4, 0, T * 4, B.h * T); g.fillRect(B.w * T, 0, T * 4, B.h * T);

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
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const c = cat(x, y);
        if (!c) continue;
        const nb = [[0, -1, x * T, y * T, (x + 1) * T, y * T], [0, 1, x * T, (y + 1) * T, (x + 1) * T, (y + 1) * T], [-1, 0, x * T, y * T, x * T, (y + 1) * T], [1, 0, (x + 1) * T, y * T, (x + 1) * T, (y + 1) * T]];
        nb.forEach(function (n) {
          const c2 = cat(x + n[0], y + n[1]);
          if (c2 >= c) return;
          g.strokeStyle = c === 2 ? 'rgba(110,190,255,0.85)' : 'rgba(255,205,80,0.8)';
          g.beginPath(); g.moveTo(n[2], n[3]); g.lineTo(n[4], n[5]); g.stroke();
        });
      }
    }
    // путь
    if (ov.path && ov.sel) {
      const pts = [[ov.sel.x, ov.sel.y]].concat(ov.path);
      g.strokeStyle = ov.pathDash ? 'rgba(255,205,80,0.95)' : 'rgba(140,210,255,0.95)'; g.lineWidth = 3; g.setLineDash([7, 5]);
      g.beginPath();
      pts.forEach(function (p, i) { const X = (p[0] + 0.5) * T, Y = (p[1] + 0.5) * T; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.stroke(); g.setLineDash([]);
      const d = ov.path[ov.path.length - 1];
      if (d) {
        const X = d[0] * T, Y = d[1] * T;
        g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.strokeRect(X + 4, Y + 4, T - 8, T - 8);
        (ov.shields || []).forEach(function (s) {
          shield(g, (d[0] + 0.5 + s.dx * 0.42) * T, (d[1] + 0.5 + s.dy * 0.42) * T, s.c === 2, s.c === 2 ? '#5ab4ff' : '#9fd3ff');
        });
      }
    }
    // видимые с точки враги
    (ov.seeMarks || []).forEach(function (m) {
      const p = rp(m.u);
      const X = (p[0] + 0.5) * T, Y = (p[1] - 0.45) * T;
      g.fillStyle = m.flank ? '#ffd25a' : '#ff6b5b';
      g.beginPath(); g.moveTo(X - 6, Y - 8); g.lineTo(X + 6, Y - 8); g.lineTo(X, Y); g.closePath(); g.fill();
    });
    // цели
    if (ov.targets && ov.sel) {
      ov.targets.forEach(function (tg) {
        const p = rp(tg.u);
        const X = (p[0] + 0.5) * T, Y = (p[1] + 0.5) * T;
        const cur = ov.target === tg.u;
        g.strokeStyle = cur ? '#ff4a3a' : 'rgba(255,110,90,0.7)'; g.lineWidth = cur ? 3 : 2;
        const r = cur ? 20 + Math.sin(t / 150) * 2 : 16;
        g.beginPath(); g.arc(X, Y, r, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(X - r - 5, Y); g.lineTo(X - r + 5, Y); g.moveTo(X + r - 5, Y); g.lineTo(X + r + 5, Y); g.moveTo(X, Y - r - 5); g.lineTo(X, Y - r + 5); g.moveTo(X, Y + r - 5); g.lineTo(X, Y + r + 5); g.stroke();
        if (tg.hit !== undefined) {
          g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
          g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(X - 19, Y - r - 36, 38, 16);
          g.fillStyle = cur ? '#ffd25a' : '#fff'; g.fillText(tg.hit + '%', X, Y - r - 23);
        }
        if (cur) {
          const sp = rp(ov.sel);
          g.strokeStyle = 'rgba(255,80,60,0.6)'; g.lineWidth = 2; g.setLineDash([6, 6]);
          g.beginPath(); g.moveTo((sp[0] + 0.5) * T, (sp[1] + 0.4) * T); g.lineTo(X, Y); g.stroke(); g.setLineDash([]);
        }
      });
    }
    // союзники-цели
    (ov.allies || []).forEach(function (a) {
      const p = rp(a);
      g.strokeStyle = 'rgba(127,208,106,' + (0.6 + Math.sin(t / 180) * 0.3) + ')'; g.lineWidth = 3;
      g.beginPath(); g.arc((p[0] + 0.5) * T, (p[1] + 0.3) * T, 20, 0, 7); g.stroke();
    });
    // зона броска
    if (ov.aoe && ov.sel) {
      const sp = rp(ov.sel);
      g.strokeStyle = 'rgba(255,200,80,0.35)'; g.lineWidth = 2; g.setLineDash([8, 6]);
      g.beginPath(); g.arc((sp[0] + 0.5) * T, (sp[1] + 0.5) * T, ov.aoe.range * T, 0, 7); g.stroke(); g.setLineDash([]);
      if (ov.aoe.x !== undefined) {
        g.fillStyle = 'rgba(255,90,40,0.25)'; g.strokeStyle = 'rgba(255,120,60,0.9)'; g.lineWidth = 2;
        g.beginPath(); g.arc((ov.aoe.x + 0.5) * T, (ov.aoe.y + 0.5) * T, (ov.aoe.r + 0.5) * T, 0, 7); g.fill(); g.stroke();
      }
    }
    // полосы здоровья
    B.units.forEach(function (u) {
      if (!u.alive || u.evac) return;
      if (u.side === 'e' && !u.seen) return;
      const p = rp(u);
      const big = u.type === 'queen' ? 1.6 : (u.type === 'brute' || u.type === 'boss' ? 1.25 : 1);
      const X = (p[0] + 0.5) * T, Y = (p[1] + 0.5) * T - 30 * big;
      hpBar(g, u, X, Y);
      statusIcons(g, u, X, Y - 10, t);
      if (u.side === 'e' && !u.active) { g.fillStyle = '#cfc7b8'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('?', X + 22, Y + 5); }
    });

    // эффекты
    fx.flashes.forEach(function (f) {
      const k = (t - f.t0) / f.life;
      if (k < 0) return;
      const gr = g.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r * (f.muzzle ? 1 : (0.5 + k)));
      gr.addColorStop(0, f.muzzle ? 'rgba(255,240,180,' + (1 - k) + ')' : 'rgba(255,230,160,' + (1 - k) + ')');
      gr.addColorStop(0.4, f.muzzle ? 'rgba(255,170,60,' + (0.6 * (1 - k)) + ')' : 'rgba(255,120,30,' + (0.8 * (1 - k)) + ')');
      gr.addColorStop(1, 'rgba(255,80,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, f.r * (f.muzzle ? 1 : (0.5 + k)), 0, 7); g.fill();
    });
    fx.tracers.forEach(function (tr) {
      const k = (t - tr.t0) / tr.life;
      if (k < 0 || k > 1) return;
      if (tr.spit) {
        const X = U.lerp(tr.x1, tr.x2, k), Y = U.lerp(tr.y1, tr.y2, k) - Math.sin(k * Math.PI) * 20;
        g.fillStyle = tr.color; circ(g, X, Y, 4);
        return;
      }
      const a = U.clamp(k * 1.6, 0, 1), b = U.clamp(k * 1.6 - 0.6, 0, 1);
      g.strokeStyle = tr.color; g.lineWidth = tr.w; g.globalAlpha = 0.95;
      g.beginPath(); g.moveTo(U.lerp(tr.x1, tr.x2, b), U.lerp(tr.y1, tr.y2, b)); g.lineTo(U.lerp(tr.x1, tr.x2, a), U.lerp(tr.y1, tr.y2, a)); g.stroke();
      g.globalAlpha = 1;
    });
    fx.projs.forEach(function (p) {
      const k = U.clamp((t - p.t0) / p.dur, 0, 1);
      const X = U.lerp(p.x0, p.x1, k), Y = U.lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * (p.kind === 'rocket' ? 10 : 50);
      if (p.kind === 'rocket') {
        g.fillStyle = '#ddd'; circ(g, X, Y, 3.5);
        fx.parts.push({ x: X, y: Y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, t0: t, life: 500, color: 'rgba(200,200,200,0.5)', size: 6, grav: 0 });
      } else { g.fillStyle = '#4a5530'; circ(g, X, Y, 4); }
    });
    fx.parts.forEach(function (p) {
      const k = (t - p.t0) / p.life;
      g.globalAlpha = Math.max(0, 1 - k);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    g.globalAlpha = 1;
    fx.floats.forEach(function (f) {
      const k = (t - f.t0) / f.life;
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.font = (f.big ? 'bold 18px' : 'bold 14px') + ' sans-serif'; g.textAlign = 'center';
      const Y = f.y - k * 34;
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(f.text, f.x, Y);
      g.fillStyle = f.color; g.fillText(f.text, f.x, Y);
    });
    g.globalAlpha = 1;
  };
  function BT_visVersion() { return DW.BT.visVersion; }

  DW.TR = TR;
})(window.DW);
