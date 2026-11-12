'use strict';
/* Отрисовка тактического боя в изометрии: объёмные укрытия, фигуры, эффекты */
(function (DW) {
  const U = DW.U, D = DW.D, ART = DW.ART;
  const TR = {};
  const HW = 32, HH = 16;   // половина ширины/высоты клетки-ромба
  const ZH = 52;            // высота объекта при lift = 1
  const P = 64;             // пикселей на клетку в плоской текстуре земли
  let GS = 2;               // масштаб изометрического слоя земли (зависит от качества)
  let QL = 2;               // уровень качества графики
  let OSS = 2.5, USS = 2.5;   // разрешение спрайтов объектов и бойцов
  const EDGE = 40;          // толщина «среза» диорамы

  let ground = null, groundCtx = null;   // плоская текстура
  let gIso = null, gIsoCtx = null;        // изометрическая проекция
  let sprites = {};
  let fogC = null, fogV = -1;
  const tweens = {};
  let fx = { floats: [], tracers: [], parts: [], projs: [], flashes: [], barks: [] };
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
  const LH = 18;             // высота одного уровня террасы
  let HG = null, HGW = 0, HGH = 0;
  function hT(x, y) {
    if (!HG) return 0;
    x = x < 0 ? 0 : (x >= HGW ? HGW - 1 : x); y = y < 0 ? 0 : (y >= HGH ? HGH - 1 : y);
    return HG[y * HGW + x];
  }
  function iso(x, y) { return [(x - y) * HW, (x + y) * HH]; }
  function isoC(x, y) { return [(x - y) * HW, (x + y + 1) * HH - hT(Math.round(x), Math.round(y)) * LH]; }
  function isoF(x, y) { return [(x - y) * HW, (x + y + 1) * HH]; }
  TR.iso = iso; TR.isoC = isoC;
  TR.matTex = function (k) { return matTex(k); };
  TR.rockFace = function (g, a, b, depth, rnd, tone, grass) { return rockFace(g, a, b, depth, rnd, tone, grass); };

  /* ---------- Земля ---------- */
  function drawGroundTile(g, x, y, gid, rnd) {
    const base = D.GROUND[gid].c;
    const hv = U.hash2(x, y, 7);
    const X = x * P, Y = y * P;
    if (!NATURAL[gid]) { g.fillStyle = U.shade(base, (hv - 0.5) * 0.07); g.fillRect(X, Y, P, P); }
    let i;
    switch (gid) {
      case 3: // бетон: плиты 2×2, швы с фаской
        g.fillStyle = 'rgba(0,0,0,0.3)';
        if (x % 2 === 0) g.fillRect(X, Y, 1.5, P);
        if (y % 2 === 0) g.fillRect(X, Y, P, 1.5);
        g.fillStyle = 'rgba(255,245,225,0.08)';
        if (x % 2 === 0) g.fillRect(X + 1.5, Y, 1.2, P);
        if (y % 2 === 0) g.fillRect(X, Y + 1.5, P, 1.2);
        if (rnd() < 0.3) { g.fillStyle = 'rgba(0,0,0,0.25)'; const cx2 = X + (x % 2 ? P : 0), cy2 = Y + (y % 2 ? P : 0); g.beginPath(); g.moveTo(cx2, cy2); g.lineTo(cx2 + (x % 2 ? -1 : 1) * (4 + rnd() * 6), cy2); g.lineTo(cx2, cy2 + (y % 2 ? -1 : 1) * (4 + rnd() * 6)); g.fill(); }
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
        for (i = 0; i < 4; i++) {
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
      case 'puddle': {
        const rx = 14 + rnd() * 22, ry = 9 + rnd() * 14, rot = rnd() * 3;
        g.save(); g.translate(X, Y); g.rotate(rot);
        g.fillStyle = 'rgba(20,16,12,0.35)'; g.beginPath(); g.ellipse(0, 0, rx + 4, ry + 3, 0, 0, 7); g.fill();
        const pg = g.createLinearGradient(-rx, -ry, rx, ry);
        pg.addColorStop(0, 'rgba(150,165,175,0.75)'); pg.addColorStop(0.5, 'rgba(60,70,78,0.85)'); pg.addColorStop(1, 'rgba(30,34,38,0.9)');
        g.fillStyle = pg; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(230,240,250,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, rx - 1, ry - 1, 0, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
        g.fillStyle = 'rgba(240,248,255,0.25)'; g.beginPath(); g.ellipse(-rx * 0.35, -ry * 0.3, rx * 0.3, ry * 0.12, -0.4, 0, 7); g.fill();
        g.restore();
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
  /* ---------- Рельефные фактуры (тайлящиеся, с освещением сверху-слева) ---------- */
  const LIGHT = (function () { const v = [-0.7, -0.12, 0.7], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();
  const texCache = {};
  function pnoise(x, y, per, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    const a = U.hash2(x0, y0, seed), b = U.hash2(x1, y0, seed), c = U.hash2(x0, y1, seed), d = U.hash2(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const TEXCFG = {
    grain: { oct: [[16, 0.5], [32, 0.3], [96, 0.22]], amp: 1.5, peb: 30, pebR: [1, 2.4], pebA: 0.75 },
    ash: { oct: [[12, 0.6], [48, 0.3], [128, 0.2]], amp: 1.2, peb: 14, pebR: [0.8, 2], pebA: 0.8 },
    earth: { oct: [[16, 0.5], [64, 0.25]], amp: 1.4, peb: 24, pebR: [1, 2.2], pebA: 1, cracks: 15 },
    concrete: { oct: [[32, 0.3], [128, 0.28]], amp: 0.7, pits: 520, ccracks: 7 },
    rubble: { oct: [[16, 0.6], [32, 0.4]], amp: 1.8, peb: 230, pebR: [1.8, 5.5], pebA: 2, angular: true },
    cave: { oct: [[8, 0.8], [16, 0.5], [32, 0.32], [64, 0.2]], amp: 3.6, peb: 80, pebR: [2, 5.5], pebA: 2 },
    flesh: { oct: [[8, 0.7], [16, 0.5], [64, 0.2]], amp: 3, veins: 20 },
    metal: { oct: [[128, 0.1]], amp: 0.4, brushed: true },
    wood: { oct: [[128, 0.1]], amp: 0.5, woodgrain: true }
  };
  function matTex(kind) {
    if (texCache[kind]) return texCache[kind];
    const N = 256, cfg = TEXCFG[kind];
    const h = new Float32Array(N * N), alb = new Float32Array(N * N);
    const r = U.srng(ART.hashStr(kind) + 11);
    let x, y, i, k;
    const oct = cfg.oct;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      let v = 0;
      for (k = 0; k < oct.length; k++) v += (pnoise(x / N * oct[k][0], y / N * oct[k][0], oct[k][0], 91 + k * 17) - 0.5) * oct[k][1];
      i = y * N + x;
      h[i] = v * cfg.amp * 2;
      alb[i] = (pnoise(x / N * 16, y / N * 16, 16, 501) - 0.5) * 0.2;
      if (cfg.brushed) alb[i] += (pnoise(x / N * 4, y / N * 192, 192, 77) - 0.5) * 0.3;
      if (cfg.woodgrain) alb[i] += Math.sin(y * 0.55 + pnoise(x / N * 8, y / N * 32, 32, 9) * 9) * 0.07;
    }
    const wrap = function (v) { return ((Math.floor(v) % N) + N) % N; };
    // камешки
    for (let n = 0; n < (cfg.peb || 0); n++) {
      const cx = r() * N, cy = r() * N, R = cfg.pebR[0] + r() * (cfg.pebR[1] - cfg.pebR[0]);
      const el = 0.65 + r() * 0.5, rot = r() * 3.14, co = Math.cos(rot), si = Math.sin(rot), ab = (r() - 0.45) * 0.5;
      const RR = Math.ceil(R / Math.min(1, el)) + 1;
      for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
        const ux = (dx * co + dy * si) / el, uy = -dx * si + dy * co;
        let d = Math.hypot(ux, uy) / R;
        if (cfg.angular) d = Math.max(Math.abs(ux) * 0.9 + Math.abs(uy) * 0.35, Math.abs(uy) * 0.9 + Math.abs(ux) * 0.35) / R;
        if (d >= 1) continue;
        i = wrap(cy + dy) * N + wrap(cx + dx);
        h[i] += Math.sqrt(1 - d * d) * cfg.pebA * (0.6 + R / 6);
        alb[i] += ab;
      }
    }
    // трещины сухой земли (ячейки Вороного)
    if (cfg.cracks) {
      const pts = [];
      for (let n = 0; n < cfg.cracks; n++) pts.push([r() * N, r() * N]);
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
        let f1 = 1e9, f2 = 1e9;
        for (k = 0; k < pts.length; k++) {
          let dx = Math.abs(x - pts[k][0]), dy = Math.abs(y - pts[k][1]);
          dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy);
          const d = Math.hypot(dx, dy);
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
        const e = f2 - f1;
        if (e < 1.8) { i = y * N + x; const q = 1 - e / 1.8; h[i] -= q * 2; alb[i] -= q * 0.26; }
      }
    }
    // поры и трещины бетона
    for (let n = 0; n < (cfg.pits || 0); n++) { i = wrap(r() * N) * N + wrap(r() * N); h[i] -= 1.4; alb[i] -= 0.22; }
    for (let n = 0; n < (cfg.ccracks || 0); n++) {
      let cx = r() * N, cy = r() * N, a = r() * 6.28;
      for (let st = 0; st < 60; st++) { a += (r() - 0.5) * 0.9; cx += Math.cos(a); cy += Math.sin(a); i = wrap(cy) * N + wrap(cx); h[i] -= 1.8; alb[i] -= 0.3; }
    }
    // прожилки плоти
    for (let n = 0; n < (cfg.veins || 0); n++) {
      let cx = r() * N, cy = r() * N, a = r() * 6.28;
      for (let st = 0; st < 90; st++) {
        a += (r() - 0.5) * 0.5; cx += Math.cos(a); cy += Math.sin(a);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { i = wrap(cy + dy) * N + wrap(cx + dx); h[i] += dx === 0 && dy === 0 ? 1.2 : 0.6; alb[i] += 0.05; }
      }
    }
    const c = canvas(N, N), g = c.getContext('2d');
    const img = g.createImageData(N, N), d = img.data;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      i = y * N + x;
      const hx = h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N];
      const hy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
      const nx = -hx * 0.5, ny = -hy * 0.5, nl = Math.sqrt(nx * nx + ny * ny + 1);
      const dot = (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / nl;
      let v = 128 + (dot - LIGHT[2]) * 120 + alb[i] * 110 + h[i] * 1.6;
      v = v < 50 ? 50 : (v > 210 ? 210 : v);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    texCache[kind] = c;
    return c;
  }
  const MAT = { 0: 'grain', 1: 'ash', 2: 'earth', 3: 'concrete', 4: 'metal', 5: 'cave', 6: 'flesh', 8: 'rubble', 9: 'wood' };
  const NATURAL = { 0: 1, 1: 1, 2: 1, 5: 1, 6: 1, 8: 1 };
  const PRIO = { 10: 0, 4: 1, 9: 2, 3: 3, 7: 4, 1: 5, 5: 6, 2: 7, 0: 8, 6: 9, 8: 10 };
  function patFor(g, gid) { const k = MAT[gid]; return k ? g.createPattern(matTex(k), 'repeat') : null; }
  function detailTile(g, x, y, gid) {
    const pat = patFor(g, gid);
    if (!pat) return;
    g.save(); g.globalCompositeOperation = 'overlay'; g.fillStyle = pat; g.fillRect(x * P, y * P, P, P); g.restore();
  }
  function stone3d(g, x, y, R, base, rnd) {
    const sun = TR.sun || { dx: 1, dy: -0.1 };
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.beginPath(); g.ellipse(x + sun.dx * R * 0.55, y + sun.dy * R * 0.55 + R * 0.15, R * 1.05, R * 0.8, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - R * 0.4, y - R * 0.35, R * 0.1, x, y, R * 1.1);
    gr.addColorStop(0, U.shade(base, 0.32)); gr.addColorStop(0.6, U.shade(base, -0.05)); gr.addColorStop(1, U.shade(base, -0.45));
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, R, R * (0.7 + rnd() * 0.25), rnd() * 3, 0, 7); g.fill();
  }
  function buildGround(B) {
    ground = canvas(B.w * P, B.h * P);
    groundCtx = ground.getContext('2d');
    const g = groundCtx;
    const rnd = U.srng(B.seed);
    TR.sun = sunFor(B);
    // области материалов + природные «наплывы» через границы клеток
    const paths = {};
    const pth = function (gid) { return paths[gid] || (paths[gid] = new Path2D()); };
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) pth(B.ground[y * B.w + x]).rect(x * P, y * P, P, P);
    const er = U.srng(B.seed + 3);
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const a = B.ground[y * B.w + x];
      if (!NATURAL[a]) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
        const nx = x + dd[0], ny = y + dd[1];
        if (nx < 0 || ny < 0 || nx >= B.w || ny >= B.h) return;
        const b = B.ground[ny * B.w + nx];
        if (b === a) return;
        if (NATURAL[b] ? PRIO[a] <= PRIO[b] : !(b === 3 && (a === 0 || a === 2 || a === 8))) return;
        const p2 = pth(a);
        const n = 3 + Math.floor(er() * 3);
        for (let k = 0; k < n; k++) {
          const t = er() - 0.5;
          const ex = (x + 0.5 + dd[0] * 0.5 + (dd[0] === 0 ? t : 0)) * P, ey = (y + 0.5 + dd[1] * 0.5 + (dd[1] === 0 ? t : 0)) * P;
          const rr = P * (0.08 + er() * 0.16), rot = er() * 3;
          const cx = ex + dd[0] * rr * 0.3, cy = ey + dd[1] * rr * 0.3;
          p2.moveTo(cx + rr * Math.cos(rot), cy + rr * Math.sin(rot));
          p2.ellipse(cx, cy, rr, rr * (0.5 + er() * 0.4), rot, 0, Math.PI * 2);
        }
      });
    }
    const order = Object.keys(paths).map(Number).sort(function (a, b) { return (PRIO[a] || 0) - (PRIO[b] || 0); });
    order.forEach(function (gid) {
      g.fillStyle = D.GROUND[gid].c; g.fill(paths[gid]);
      if (!NATURAL[gid]) for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) if (B.ground[y * B.w + x] === gid) drawGroundTile(g, x, y, gid, rnd);
      const pat = patFor(g, gid);
      if (pat) { g.save(); g.globalCompositeOperation = 'overlay'; g.fillStyle = pat; g.fill(paths[gid]); g.restore(); }
    });
    // крупные пятна света и тени
    const nw = B.w * 4, nh = B.h * 4;
    const nc = canvas(nw, nh);
    const ng = nc.getContext('2d');
    const img = ng.createImageData(nw, nh);
    const sd = B.seed % 9973;
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const v = U.fbm(x * 0.07, y * 0.07, sd, 3);
      const k = (y * nw + x) * 4;
      const c = v > 0.5 ? 255 : 0;
      img.data[k] = c; img.data[k + 1] = c * 0.92; img.data[k + 2] = c * 0.8;
      img.data[k + 3] = Math.min(255, Math.abs(v - 0.5) * 2 * 80);
    }
    ng.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(nc, 0, 0, ground.width, ground.height);
    // объёмные камни на природном грунте
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const gid = B.ground[y * B.w + x];
      if (!NATURAL[gid] || gid === 6) continue;
      const n = gid === 8 ? 4 : (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0);
      for (let k = 0; k < n; k++) stone3d(g, (x + 0.1 + rnd() * 0.8) * P, (y + 0.1 + rnd() * 0.8) * P, 2 + rnd() * (gid === 8 ? 5 : 3.5), gid === 5 ? '#5a5048' : ['#7a7068', '#6e665c', '#857a6c'][Math.floor(rnd() * 3)], rnd);
    }
    B.decor.forEach(function (d) { drawDecor(g, d, rnd); });
    // едва заметная сетка
    g.strokeStyle = 'rgba(255,240,200,0.03)'; g.lineWidth = 1;
    for (let x = 0; x <= B.w; x++) { g.beginPath(); g.moveTo(x * P, 0); g.lineTo(x * P, B.h * P); g.stroke(); }
    for (let y = 0; y <= B.h; y++) { g.beginPath(); g.moveTo(0, y * P); g.lineTo(B.w * P, y * P); g.stroke(); }
    buildShade(B);
  }

  /* ---------- Тени от солнца и затенение у основания (низкое разрешение, мягкие края) ---------- */
  const SR = 16, AR = 8;
  let shadeC = null, aoC = null;
  function sunFor(B) {
    const t = B.tod;
    if (t === 'dawn' || t === 'dusk') return { dx: 0.82, dy: -0.57, len: 1.45, a: 0.44, ao: 0.5 };
    if (t === 'night') return { dx: 0.92, dy: -0.38, len: 0.8, a: 0.24, ao: 0.45 };
    if (t === 'interior' || t === 'cave') return { dx: 0.95, dy: -0.3, len: 0.3, a: 0.28, ao: 0.62 };
    return { dx: 0.99, dy: -0.12, len: 0.62, a: 0.4, ao: 0.5 };
  }
  const FOOT = { 3: [0.42, 0.36], 4: [0.33, 0.33], 7: [0.47, 0.3], 8: [0.36, 0.36], 9: [0.2, 0.2], 10: [0.46, 0.42], 12: [0.35, 0.3], 15: [0.48, 0.48], 16: [0.36, 0.36], 18: [0.5, 0.36], 19: [0.48, 0.12], 20: [0.3, 0.3] };
  const WALLT = { 1: 0.22, 2: 0.27, 6: 0.25, 11: 0.3, 13: 0.15, 14: 0.3 };
  function footprints(B, x, y, o) {
    const cx = x + 0.5, cy = y + 0.5;
    if (o === 17) return [[x, y, x + 1, y + 1]];
    if (WALLT[o]) return spans(maskAt(B, x, y, o), WALLT[o]).map(function (sp) { return [cx + sp[0], cy + sp[1], cx + sp[2], cy + sp[3]]; });
    const f = FOOT[o] || [0.35, 0.35];
    const variant = Math.floor(U.hash2(x, y, o) * 3);
    let fx = f[0], fy = f[1];
    if ((o === 18 && variant === 2) || (o === 19 && variant === 1) || (o === 7 && variant === 2)) { fx = f[1]; fy = f[0]; }
    return [[cx - fx, cy - fy, cx + fx, cy + fy]];
  }
  function buildShade(B) {
    const sun = TR.sun || sunFor(B);
    const W = B.w, H = B.h;
    const ac = canvas(W * AR, H * AR), ag = ac.getContext('2d');
    shadeC = canvas(W * SR, H * SR);
    const sg = shadeC.getContext('2d');
    ag.fillStyle = '#000'; sg.fillStyle = '#000';
    const sweep = function (r, len) {
      const steps = Math.max(1, Math.ceil(len * SR / 1.5));
      for (let k = 0; k <= steps; k++) {
        const f = k / steps * len;
        sg.fillRect((r[0] + sun.dx * f) * SR, (r[1] + sun.dy * f) * SR, (r[2] - r[0]) * SR, (r[3] - r[1]) * SR);
      }
    };
    // террасы: тень с уступа и тёмная полоса у подножия
    if (HG) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const hh = HG[y * W + x]; if (hh > 0) sweep([x, y, x + 1, y + 1], hh * LH / ZH * sun.len * 1.4); }
      sg.globalCompositeOperation = 'destination-out';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (HG[y * W + x] > 0) sg.fillRect(x * SR, y * SR, SR, SR);
      sg.globalCompositeOperation = 'source-over';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const hh = HG[y * W + x];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const nx = x + d[0], ny = y + d[1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || HG[ny * W + nx] <= hh) return;
          const t = 0.22;
          if (d[0] === 1) ag.fillRect((x + 1 - t) * AR, y * AR, t * AR, AR);
          if (d[0] === -1) ag.fillRect(x * AR, y * AR, t * AR, AR);
          if (d[1] === 1) ag.fillRect(x * AR, (y + 1 - t) * AR, AR, t * AR);
          if (d[1] === -1) ag.fillRect(x * AR, y * AR, AR, t * AR);
        });
      }
    }
    // объекты
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = B.obj[y * W + x];
      if (!o) continue;
      const L = D.OBJ[o].lift;
      footprints(B, x, y, o).forEach(function (r) {
        ag.fillRect((r[0] - 0.08) * AR, (r[1] - 0.08) * AR, (r[2] - r[0] + 0.16) * AR, (r[3] - r[1] + 0.16) * AR);
        if (o === 5) {
          sweep([x + 0.45, y + 0.45, x + 0.55, y + 0.55], L * sun.len);
          const rr = U.srng(x * 7 + y * 131);
          for (let k = 0; k < 7; k++) {
            const f = L * sun.len * (0.45 + rr() * 0.55);
            const bx = x + 0.5 + sun.dx * f + (rr() - 0.5) * 0.5, by = y + 0.5 + sun.dy * f + (rr() - 0.5) * 0.5;
            sg.beginPath(); sg.ellipse(bx * SR, by * SR, (0.05 + rr() * 0.1) * SR, (0.03 + rr() * 0.05) * SR, rr() * 3, 0, 7); sg.fill();
          }
        } else if (o !== 13 || true) sweep(r, L * sun.len);
      });
    }
    aoC = canvas(W * AR, H * AR);
    const a2 = aoC.getContext('2d');
    try { a2.filter = 'blur(1.5px)'; } catch (e) { /* ignore */ }
    a2.drawImage(ac, 0, 0);
    try { a2.filter = 'none'; } catch (e) { /* ignore */ }
  }
  function shadeRegion(g, x0, y0, x1, y1) {
    const sun = TR.sun;
    if (!aoC || !sun) return;
    g.globalAlpha = sun.ao; g.drawImage(aoC, x0 * AR, y0 * AR, (x1 - x0) * AR, (y1 - y0) * AR, x0 * P, y0 * P, (x1 - x0) * P, (y1 - y0) * P);
    g.globalAlpha = sun.a; g.drawImage(shadeC, x0 * SR, y0 * SR, (x1 - x0) * SR, (y1 - y0) * SR, x0 * P, y0 * P, (x1 - x0) * P, (y1 - y0) * P);
    g.globalAlpha = 1;
  }
  TR.tileChanged = function (x, y) {
    const B = DW.BT.get();
    if (!B || !groundCtx) return;
    const rnd = U.srng(x * 31 + y * 17);
    const gid = B.ground[y * B.w + x];
    groundCtx.fillStyle = D.GROUND[gid].c; groundCtx.fillRect(x * P, y * P, P, P);
    drawGroundTile(groundCtx, x, y, gid, rnd);
    detailTile(groundCtx, x, y, gid);
    for (let i = 0; i < 6; i++) stone3d(groundCtx, (x + 0.1 + rnd() * 0.8) * P, (y + 0.1 + rnd() * 0.8) * P, 2 + rnd() * 4, ['#7a746c', '#6a645c', '#8a8478'][Math.floor(rnd() * 3)], rnd);
    buildShade(B);
    const L = Math.ceil((TR.sun ? TR.sun.len : 1) + 1);
    for (let yy = y - L - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + L + 1; xx++) if (xx >= 0 && yy >= 0 && xx < B.w && yy < B.h) projectTile(xx, yy);
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
    shadeRegion(g, 0, 0, B.w, B.h);
    g.setTransform(GS, 0, 0, GS, B.h * HW * GS, 0);
    const a = iso(0, B.h), b = iso(B.w, B.h), c = iso(B.w, 0);
    const rnd = U.srng(B.seed + 5);
    const cave = B.tod === 'cave' || B.tod === 'interior';
    rockFace(g, a, b, EDGE, rnd, 1, !cave);
    rockFace(g, b, c, EDGE, rnd, 0.62, !cave);
    g.strokeStyle = 'rgba(255,230,190,0.28)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
  }
  /* Срез породы: пласты, камни, корни; a→b — верхняя кромка, depth — высота среза */
  const STRATA = [[0, 0.16, '#3e2e20'], [0.16, 0.42, '#7a5e42'], [0.42, 0.7, '#64503e'], [0.7, 1.01, '#463c34']];
  function rockFace(g, a, b, depth, rnd, tone, grass) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(4, Math.ceil(len / 7));
    const at = function (t, dy) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + dy]; };
    const ph = rnd() * 10;
    const wav = function (t, k) { return Math.sin(t * len * 0.05 + ph + k * 2.1) * depth * 0.035 + Math.sin(t * len * 0.13 + k) * depth * 0.02; };
    STRATA.forEach(function (L, k) {
      g.fillStyle = U.shade(L[2], (tone - 1) * 0.9 + (rnd() - 0.5) * 0.06);
      g.beginPath();
      for (let i = 0; i <= n; i++) { const t = i / n, p = at(t, depth * L[0] + (k ? wav(t, k) : 0)); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
      for (let i = n; i >= 0; i--) { const t = i / n, p = at(t, Math.min(depth, depth * L[1] + (k < 3 ? wav(t, k + 1) : 0))); g.lineTo(p[0], p[1]); }
      g.closePath(); g.fill();
      if (k) { g.strokeStyle = 'rgba(255,235,200,' + (0.1 * tone) + ')'; g.lineWidth = 0.8; g.beginPath(); for (let i = 0; i <= n; i++) { const t = i / n, p = at(t, depth * L[0] + wav(t, k) + 0.6); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } g.stroke(); }
    });
    // камни в породе
    const ns = Math.ceil(len / 11);
    for (let i = 0; i < ns; i++) {
      const t = rnd(), dy = depth * (0.22 + rnd() * 0.72), R = 1.2 + rnd() * Math.min(4.5, depth * 0.12);
      const p = at(t, dy);
      const base = ['#8a8076', '#6e655c', '#9a8a74'][i % 3], tv = (tone - 1) * 0.8;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(p[0] + R * 0.3, p[1] + R * 0.35, R * 1.1, R * 0.8, 0, 0, 7); g.fill();
      const gr = g.createRadialGradient(p[0] - R * 0.4, p[1] - R * 0.4, R * 0.1, p[0], p[1], R * 1.1);
      gr.addColorStop(0, U.shade(base, U.clamp(0.3 + tv, -0.9, 0.9))); gr.addColorStop(1, U.shade(base, U.clamp(-0.4 + tv, -0.9, 0.9)));
      g.fillStyle = gr; g.beginPath(); g.ellipse(p[0], p[1], R * 1.15, R * 0.85, rnd(), 0, 7); g.fill();
    }
    // трещины и корни
    g.strokeStyle = 'rgba(15,10,6,0.45)'; g.lineWidth = 0.9;
    for (let i = 0; i < Math.ceil(len / 40); i++) {
      let p = at(rnd(), depth * (0.1 + rnd() * 0.3));
      g.beginPath(); g.moveTo(p[0], p[1]);
      for (let k = 0; k < 4; k++) { p = [p[0] + (rnd() - 0.5) * 5, p[1] + 2 + rnd() * depth * 0.15]; g.lineTo(p[0], p[1]); }
      g.stroke();
    }
    if (grass) {
      g.strokeStyle = 'rgba(40,26,14,0.7)'; g.lineWidth = 0.8;
      for (let i = 0; i < Math.ceil(len / 18); i++) {
        const p = at(rnd(), 0.5);
        g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + (rnd() - 0.5) * 4, p[1] + depth * 0.2, p[0] + (rnd() - 0.5) * 6, p[1] + depth * (0.15 + rnd() * 0.25)); g.stroke();
      }
      g.strokeStyle = 'rgba(150,130,70,0.55)'; g.lineWidth = 1;
      for (let i = 0; i < Math.ceil(len / 14); i++) {
        const p = at(rnd(), 0);
        g.beginPath(); g.moveTo(p[0], p[1] + 0.5); g.lineTo(p[0] + (rnd() - 0.5) * 3, p[1] - 2 - rnd() * 3); g.stroke();
      }
    }
    // затенение книзу
    const top = Math.min(a[1], b[1]), bot = Math.max(a[1], b[1]) + depth;
    const gr = g.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + (0.25 + (1 - tone) * 0.3) + ')');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0], b[1] + depth); g.lineTo(a[0], a[1] + depth); g.closePath(); g.fill();
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
    shadeRegion(g, Math.max(0, x - 1), Math.max(0, y - 1), Math.min(B.w, x + 2), Math.min(B.h, y + 2));
    g.restore();
    delete elev[y * B.w + x];
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
  const box = function (g, u0, v0, u1, v1, h0, h1, c) {
    ART.box(g, u0, v0, u1, v1, h0, h1, c[0], c[1], c[2]);
    if (h1 - h0 < 2.5) return;
    const ln = function (pts, col, w) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke(); };
    g.lineCap = 'round';
    const a = Pp(u0, v1, h1), b = Pp(u1, v1, h1), cc = Pp(u1, v0, h1);
    ln([[a[0], a[1] + 0.5], [b[0], b[1] + 0.5]], 'rgba(255,244,225,0.34)', 1);
    ln([[b[0], b[1] + 0.5], [cc[0], cc[1] + 0.5]], 'rgba(255,244,225,0.18)', 0.9);
    const bk1 = Pp(u0, v0, h1), bk2 = Pp(u1, v0, h1), bk3 = Pp(u0, v1, h1);
    ln([bk3, bk1, bk2], 'rgba(255,244,225,0.12)', 0.8);
    if (u1 < 0.499 && v1 < 0.499) ln([Pp(u1, v1, h0 + 1), Pp(u1, v1, h1 - 0.5)], 'rgba(255,244,225,0.16)', 0.9);
    ln([Pp(u0, v1, h0), Pp(u1, v1, h0), Pp(u1, v0, h0)], 'rgba(0,0,0,0.32)', 1.3);
  };
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
        g.fillStyle = 'rgba(255,240,220,0.1)'; g.fillRect(0, y - 0.7, len, 0.6);
        const off = (Math.floor(y / 5) % 2) * 0.09;
        g.fillStyle = 'rgba(30,22,16,0.35)';
        for (let s = off; s < len; s += 0.18) g.fillRect(s, y, 0.02, 5);
        for (let s = off; s < len; s += 0.18) { if (rnd() < 0.25) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0,0.12' : '255,235,210,0.1') + ')'; g.fillRect(s + 0.02, y - 4.3, 0.16, 4.3); } }
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
  /* Детали на гранях стен: окна, граффити, плакаты, следы пуль, знаки, трубы */
  const GRAF = ['ЖИВЫ', 'ВЫХОДА НЕТ', 'КРУТ', 'НЕ ВХОДИ', 'МУТАНТЫ!', 'Р-6', 'ФОРТ', '←ВОДА'];
  function wallDecor(g, type, len, h, rnd, right) {
    if (len < 0.3 || h < 10) return;
    const textAt = function (str, s0, y0, px, col) {
      g.save();
      g.font = 'bold ' + px + 'px sans-serif';
      const tw = g.measureText(str).width / HW;
      if (tw > len - 0.05) { g.restore(); return; }
      s0 = Math.min(s0, len - tw - 0.03);
      if (right) { g.translate(s0 + tw, y0); g.scale(-1 / HW, -1); } else { g.translate(s0, y0); g.scale(1 / HW, -1); }
      g.fillStyle = col; g.fillText(str, 0, 0);
      g.restore();
    };
    const holes = function (n) {
      for (let i = 0; i < n; i++) {
        const s0 = 0.05 + rnd() * (len - 0.1), y0 = 4 + rnd() * (h - 8);
        g.fillStyle = 'rgba(230,220,200,0.35)'; g.fillRect(s0 - 0.012, y0 - 0.9, 0.05, 2.2);
        g.fillStyle = '#16110d'; g.fillRect(s0, y0 - 0.5, 0.024, 1.2);
      }
    };
    const k = rnd();
    if (type === 2 || type === 1 || type === 14) {
      if (type === 2 && k < 0.28 && len > 0.6) {
        // пролом-окно с битым стеклом
        const s0 = 0.18 + rnd() * (len - 0.55), y0 = h * 0.38, ww = 0.26, wh = h * 0.36;
        g.fillStyle = '#0e0b09'; g.fillRect(s0, y0, ww, wh);
        g.fillStyle = 'rgba(80,60,40,0.9)'; g.fillRect(s0 - 0.02, y0 - 1.5, ww + 0.04, 1.6);
        g.fillStyle = 'rgba(255,230,190,0.18)'; g.fillRect(s0, y0 + wh - 1, ww, 1);
        g.fillStyle = 'rgba(170,200,215,0.55)';
        g.beginPath(); g.moveTo(s0, y0 + wh); g.lineTo(s0 + 0.07, y0 + wh); g.lineTo(s0, y0 + wh * 0.55); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(s0 + ww, y0); g.lineTo(s0 + ww - 0.06, y0); g.lineTo(s0 + ww, y0 + wh * 0.4); g.closePath(); g.fill();
        g.strokeStyle = '#3a2a1c'; g.lineWidth = 0.025; g.beginPath(); g.moveTo(s0 + ww / 2, y0); g.lineTo(s0 + ww / 2, y0 + wh); g.stroke();
      } else if (k < 0.52) {
        const str = GRAF[Math.floor(rnd() * GRAF.length)];
        const col = ['rgba(170,40,30,0.85)', 'rgba(220,214,200,0.8)', 'rgba(230,180,60,0.8)'][Math.floor(rnd() * 3)];
        textAt(str, 0.06 + rnd() * Math.max(0.01, len - 0.5), h * (0.25 + rnd() * 0.35), Math.max(5, Math.min(9, h * 0.22)), col);
        if (rnd() < 0.5) { g.strokeStyle = col; g.lineWidth = 0.02; g.beginPath(); const s0 = rnd() * len * 0.6, y0 = h * 0.7; g.moveTo(s0, y0); for (let i = 0; i < 4; i++) g.lineTo(s0 + (i + 1) * 0.05, y0 + (i % 2 ? 3 : -3)); g.stroke(); }
      } else if (k < 0.68 && type !== 1) {
        // плакат
        const s0 = 0.1 + rnd() * Math.max(0.01, len - 0.4), y0 = h * 0.35, pw = 0.2, ph = h * 0.32;
        g.fillStyle = '#c8bea4'; g.fillRect(s0, y0, pw, ph);
        g.fillStyle = 'rgba(120,40,30,0.75)'; g.fillRect(s0 + 0.02, y0 + ph * 0.55, pw - 0.04, ph * 0.3);
        g.fillStyle = 'rgba(40,30,20,0.55)'; for (let i = 0; i < 3; i++) g.fillRect(s0 + 0.025, y0 + ph * (0.12 + i * 0.13), pw - 0.05, 0.8);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(s0 + pw, y0); g.lineTo(s0 + pw - 0.06, y0); g.lineTo(s0 + pw, y0 + ph * 0.25); g.closePath(); g.fill();
      }
      holes(type === 1 ? 2 : 4 + Math.floor(rnd() * 4));
      if (type === 14) { g.fillStyle = 'rgba(70,90,40,0.45)'; for (let i = 0; i < 4; i++) g.fillRect(rnd() * len, 0, 0.08 + rnd() * 0.12, 2 + rnd() * 6); }
    } else if (type === 11) {
      // переборка: трубы, решётка вентиляции, знак опасности, ржавые потёки
      const py = h * 0.72;
      g.fillStyle = '#3a4248'; g.fillRect(0, py, len, 3.2); g.fillStyle = 'rgba(200,215,225,0.3)'; g.fillRect(0, py + 2.4, len, 0.7);
      for (let s0 = 0.12; s0 < len; s0 += 0.35) { g.fillStyle = '#2a3036'; g.fillRect(s0, py - 0.6, 0.05, 4.4); }
      if (k < 0.5) {
        const s0 = 0.15 + rnd() * Math.max(0.01, len - 0.4), y0 = h * 0.3;
        g.fillStyle = '#e3b23b'; g.beginPath(); g.moveTo(s0, y0); g.lineTo(s0 + 0.18, y0); g.lineTo(s0 + 0.09, y0 + 8); g.closePath(); g.fill();
        g.fillStyle = '#1a1a1a'; g.fillRect(s0 + 0.085, y0 + 2.6, 0.012, 3); g.fillRect(s0 + 0.085, y0 + 1.2, 0.012, 0.8);
      } else {
        const s0 = 0.15 + rnd() * Math.max(0.01, len - 0.4), y0 = h * 0.28;
        g.fillStyle = '#1a1e22'; g.fillRect(s0, y0, 0.22, 7);
        g.fillStyle = 'rgba(160,175,185,0.4)'; for (let i = 0; i < 4; i++) g.fillRect(s0 + 0.01, y0 + 1 + i * 1.6, 0.2, 0.5);
      }
      g.fillStyle = 'rgba(130,60,25,0.4)'; for (let i = 0; i < 3; i++) { const s0 = rnd() * len; g.fillRect(s0, h * 0.2, 0.02, h * (0.2 + rnd() * 0.4)); }
    }
  }
  function wallBox(g, type, sp, h, col, rnd) {
    box(g, sp[0], sp[1], sp[2], sp[3], 0, h, col);
    g.save(); ART.faceL(g, sp[0], sp[3], 0); texWall(g, type, sp[2] - sp[0], h, rnd); wallDecor(g, type, sp[2] - sp[0], h, rnd, false); g.restore();
    g.save(); ART.faceR(g, sp[2], sp[1], 0); texWall(g, type, sp[3] - sp[1], h, rnd); wallDecor(g, type, sp[3] - sp[1], h, rnd, true); g.restore();
    // грязь и сырость у основания
    g.save(); ART.faceL(g, sp[0], sp[3], 0); g.fillStyle = 'rgba(40,30,20,0.25)'; for (let s2 = 0; s2 < sp[2] - sp[0]; s2 += 0.06) g.fillRect(s2, 0, 0.06, 2 + rnd() * 5); g.restore();
    g.save(); ART.faceR(g, sp[2], sp[1], 0); g.fillStyle = 'rgba(30,22,15,0.28)'; for (let s2 = 0; s2 < sp[3] - sp[1]; s2 += 0.06) g.fillRect(s2, 0, 0.06, 2 + rnd() * 5); g.restore();
    if (type === 2) {
      // обломки кирпича на верху стены
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const u = sp[0] + 0.04 + rnd() * Math.max(0.01, sp[2] - sp[0] - 0.16), v = sp[1] + 0.03 + rnd() * Math.max(0.01, sp[3] - sp[1] - 0.12);
        const hh = 2 + rnd() * 3;
        box(g, u, v, u + 0.08 + rnd() * 0.06, v + 0.06 + rnd() * 0.04, h, h + hh, ['#a09484', '#86796a', '#6a5e52']);
      }
    }
    if (type === 1 && rnd() < 0.5) {
      const u = sp[0] + 0.1 + rnd() * Math.max(0.01, sp[2] - sp[0] - 0.2), v = (sp[1] + sp[3]) / 2;
      for (let k = 0; k < 3; k++) {
        const p0 = Pp(u + k * 0.05, v, h), p1 = Pp(u + k * 0.05 + (rnd() - 0.5) * 0.1, v, h + 5 + rnd() * 7);
        ART.line(g, p0[0], p0[1], p1[0], p1[1], 1.1, '#6a3a22'); ART.line(g, p0[0] - 0.3, p0[1], p1[0] - 0.3, p1[1], 0.4, 'rgba(255,200,160,0.35)');
      }
    }
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
        g.fillStyle = 'rgba(110,130,140,0.45)'; g.fillRect(0.05, 2, 0.36, H * 0.45 - 4);
        g.fillStyle = 'rgba(220,235,245,0.35)'; g.beginPath(); g.moveTo(0.1, H * 0.45 - 4); g.lineTo(0.18, H * 0.45 - 4); g.lineTo(0.28, 2); g.lineTo(0.2, 2); g.closePath(); g.fill();
        g.restore();
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
          const sg = g.createLinearGradient(p[0] - r, 0, p[0] + r, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.28, 'rgba(255,250,235,0.32)'); sg.addColorStop(0.42, 'rgba(255,255,255,0)');
          g.fillStyle = sg; g.fillRect(p[0] - r, p[1] - h, 2 * r, h);
          g.fillStyle = 'rgba(120,55,25,0.45)'; for (let k = 0; k < 3; k++) { const xx = p[0] - r * 0.6 + k * r * 0.55; g.fillRect(xx, p[1] - h * 0.62, 1, h * (0.15 + ((k * 7) % 5) * 0.06)); }
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
      case 18: {
        const alongU = variant !== 2;
        const cc = [['#8a3e2a', '#6e2e1e', '#552216'], ['#2e5a7a', '#22465e', '#1a3648'], ['#5e6a3a', '#4a542c', '#3a4222']][variant];
        const bb = alongU ? [-0.5, -0.36, 0.5, 0.36] : [-0.36, -0.5, 0.36, 0.5];
        box(g, bb[0], bb[1], bb[2], bb[3], 0, H, cc);
        g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1;
        const ribs = function (u0, v0, u1, v1, n) {
          for (let k = 1; k < n; k++) {
            const a = k / n, u = u0 + (u1 - u0) * a, v = v0 + (v1 - v0) * a;
            const p1 = Pp(u, v, 2), p2 = Pp(u, v, H - 2);
            g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
          }
        };
        ribs(bb[0], bb[3], bb[2], bb[3], alongU ? 12 : 8);
        ribs(bb[2], bb[1], bb[2], bb[3], alongU ? 8 : 12);
        g.strokeStyle = 'rgba(255,255,255,0.12)';
        const e1 = Pp(bb[0], bb[3], H), e2 = Pp(bb[2], bb[3], H), e3 = Pp(bb[2], bb[1], H);
        g.beginPath(); g.moveTo(e1[0], e1[1]); g.lineTo(e2[0], e2[1]); g.lineTo(e3[0], e3[1]); g.stroke();
        // двери на торце
        if (alongU) {
          const d1 = Pp(bb[2], bb[1] + 0.06, 3), d2 = Pp(bb[2], bb[3] - 0.06, H - 3);
          ART.line(g, (d1[0] + d2[0]) / 2, Pp(bb[2], 0, 3)[1], (d1[0] + d2[0]) / 2, Pp(bb[2], 0, H - 3)[1], 1.4, 'rgba(20,10,6,0.6)');
          for (let k = 0; k < 4; k++) { const q = Pp(bb[2], bb[1] + 0.12 + k * 0.16, H * 0.5); g.fillStyle = '#c9b48a'; g.fillRect(q[0] - 0.6, q[1] - 6, 1.2, 12); }
        }
        for (i = 0; i < 7; i++) { g.fillStyle = 'rgba(140,70,25,0.4)'; ART.ell(g, (rnd() - 0.5) * 50, -H * 0.2 - rnd() * H * 0.6, 2 + rnd() * 5, 1.2 + rnd() * 2); }
        g.save(); ART.faceL(g, bb[0], bb[3], 0);
        g.fillStyle = 'rgba(230,220,200,0.35)'; g.fillRect(0.12, H * 0.55, 0.22, 4); g.fillRect(0.12, H * 0.55 + 6, 0.14, 2);
        g.restore();
        break;
      }
      case 19: {
        const alongU = variant !== 1;
        const r = H * 0.5;
        const a = alongU ? Pp(-0.48, -0.08, r) : Pp(-0.08, -0.48, r), b = alongU ? Pp(0.48, 0.1, r) : Pp(0.1, 0.48, r);
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
        const sg = ny < 0 ? -1 : 1;
        gr = g.createLinearGradient(a[0] - nx * r * sg, a[1] - ny * r * sg, a[0] + nx * r * sg, a[1] + ny * r * sg);
        gr.addColorStop(0, '#8a6a4a'); gr.addColorStop(0.5, '#5e4630'); gr.addColorStop(1, '#2e2216');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(a[0] + nx * r, a[1] + ny * r); g.lineTo(b[0] + nx * r, b[1] + ny * r); g.lineTo(b[0] - nx * r, b[1] - ny * r); g.lineTo(a[0] - nx * r, a[1] - ny * r); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(25,16,8,0.55)'; g.lineWidth = 1;
        for (i = 0; i < 9; i++) {
          const t0 = rnd(), o0 = (rnd() - 0.5) * 1.6 * r;
          const px = a[0] + dx * t0 + nx * o0, py = a[1] + dy * t0 + ny * o0;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx / L * (6 + rnd() * 10), py + dy / L * (6 + rnd() * 10)); g.stroke();
        }
        for (i = 0; i < 2; i++) { const t0 = 0.25 + i * 0.4; const px = a[0] + dx * t0, py = a[1] + dy * t0 - r * 0.8; ART.line(g, px, py, px + (i ? 6 : -5), py - 7, 2, '#4a3624'); }
        const cap = function (p) {
          g.fillStyle = '#a88a62'; g.beginPath(); g.ellipse(p[0], p[1], r * 0.55, r, Math.atan2(dy, dx), 0, Math.PI * 2); g.fill();
          g.strokeStyle = 'rgba(80,55,30,0.7)'; g.lineWidth = 0.8;
          g.beginPath(); g.ellipse(p[0], p[1], r * 0.3, r * 0.55, Math.atan2(dy, dx), 0, Math.PI * 2); g.stroke();
        };
        cap(b);
        g.fillStyle = 'rgba(110,130,60,0.45)'; for (i = 0; i < 4; i++) ART.ell(g, a[0] + dx * rnd(), a[1] + dy * rnd() - r * 0.7, 3 + rnd() * 3, 1.5);
        break;
      }
      case 20: {
        const gl = g.createRadialGradient(0, -H * 0.4, 2, 0, -H * 0.4, 30);
        gl.addColorStop(0, 'rgba(120,235,255,0.35)'); gl.addColorStop(1, 'rgba(120,235,255,0)');
        g.fillStyle = gl; ART.ell(g, 0, -H * 0.3, 30, 22);
        ART.blob(g, 0, 0, 0.3, 6, '#4a5258', 900 + variant);
        const xs = [];
        for (i = 0; i < 6; i++) xs.push({ x: (rnd() - 0.5) * 30, y: (rnd() - 0.5) * 8, h: H * (0.45 + rnd() * 0.6), w: 3 + rnd() * 3.5, lean: (rnd() - 0.5) * 0.5 });
        xs.sort(function (p, q) { return p.y - q.y; });
        xs.forEach(function (c) {
          const bx = c.x, by = c.y, tx = bx + c.lean * c.h, ty = by - c.h;
          ART.poly(g, [[bx - c.w, by], [tx - c.w * 0.6, ty + c.w], [tx, ty], [bx, by + 2]], '#2f9fb4');
          ART.poly(g, [[bx, by + 2], [tx, ty], [tx + c.w * 0.6, ty + c.w], [bx + c.w, by]], '#1d6878');
          g.strokeStyle = 'rgba(210,255,255,0.7)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(bx - c.w * 0.5, by - 1); g.lineTo(tx - c.w * 0.3, ty + c.w * 0.8); g.stroke();
        });
        g.fillStyle = 'rgba(230,255,255,0.85)'; for (i = 0; i < 4; i++) ART.circ(g, (rnd() - 0.5) * 26, -rnd() * H, 0.9);
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
  let ovTmp = null, ovTmp2 = null;
  function objVolume(c, oy, SS, tiled, type) {
    const w = c.width, h = c.height, g = c.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    // затемнение у земли
    const gr = g.createLinearGradient(0, oy - 16 * SS, 0, oy + HH * SS);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,4,0.42)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    if (tiled || type === 15 || type === 20) { g.restore(); return; }
    if (!ovTmp || ovTmp.width !== w || ovTmp.height !== h) { ovTmp = canvas(w, h); ovTmp2 = canvas(w, h); }
    const src = ovTmp2.getContext('2d');
    src.globalCompositeOperation = 'source-over'; src.clearRect(0, 0, w, h); src.drawImage(c, 0, 0);
    const tg = ovTmp.getContext('2d');
    const rim = function (dx, dy, col, a) {
      tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, w, h); tg.drawImage(ovTmp2, 0, 0);
      tg.globalCompositeOperation = 'destination-out'; tg.drawImage(ovTmp2, dx, dy);
      tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, w, h);
      g.globalAlpha = a; g.globalCompositeOperation = 'source-atop'; g.drawImage(ovTmp, 0, 0);
    };
    const kk = SS / 2;
    rim(2.4 * kk, 2 * kk, 'rgb(255,238,210)', 0.32);
    rim(-2.8 * kk, -2.2 * kk, 'rgb(0,0,0)', 0.26);
    // мягкий контур
    g.globalAlpha = 0.5; g.globalCompositeOperation = 'destination-over';
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, w, h);
    const r = 1.6 * kk, q = r * 0.71;
    [[r, 0], [-r, 0], [0, r], [0, -r], [q, q], [-q, q], [q, -q], [-q, -q]].forEach(function (o) { tg.drawImage(ovTmp2, o[0], o[1]); });
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = 'rgb(20,13,9)'; tg.fillRect(0, 0, w, h);
    g.drawImage(ovTmp, 0, 0);
    g.restore();
  }
  function objSprite(type, mask, variant, dark, damaged) {
    const key = type + '_' + mask + '_' + variant + (damaged ? '_d' : '');
    let s = sprites[key];
    if (!s) {
      const SS = OSS, MX = 16;
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
      objVolume(c, (top + HH) * SS, SS, !!AUTOTILE[type], type);
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
    const n = Math.round(({ rain: 160, dust: 120, ash: 100 }[B.weather] || 0) * [0.45, 0.75, 1][DW.gfxLevel ? DW.gfxLevel() : 2]);
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
      const c = uPos(u);
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
      if ((o !== 15 && o !== 12 && o !== 20) || !B.explored[i]) continue;
      const c = isoC(i % B.w, (i / B.w) | 0);
      L.push(o === 15 ? [c[0], c[1] - 40, 150, '140,240,255', 0.9] : (o === 20 ? [c[0], c[1] - 18, 80, '120,230,255', 0.75] : [c[0], c[1] - 14, 44, '120,230,210', 0.55]));
    }
    for (let k = 0; k < acidTiles.length; k++) { const i = acidTiles[k]; if (!B.explored[i]) continue; const c = isoC(i % B.w, (i / B.w) | 0); L.push([c[0], c[1], 34, '150,220,60', 0.35]); }
    (B.props || []).forEach(function (p) {
      if (p.t === 'shroom' || p.t === 'shards') { const c = isoC(p.x - 0.5, p.y - 0.5); L.push([c[0], c[1] - 6, 32, p.t === 'shroom' ? '140,255,180' : '120,230,255', 0.5]); }
      else if (p.t === 'lamp' && B.explored[Math.floor(p.y) * B.w + Math.floor(p.x)]) { const c = isoC(p.x - 0.5, p.y - 0.5); L.push([c[0] + 6, c[1] - 20, 120, '255,205,140', 0.85 * lampFlicker(p, t)]); }
    });
    fx.flashes.forEach(function (f) {
      const k = (t - f.t0) / f.life; if (k < 0 || k > 1) return;
      L.push(f.muzzle ? [f.x, f.y, 40 + f.r * 4, '255,214,150', 1 - k] : [f.x, f.y - 10, 220, '255,150,60', 1 - k]);
    });
    void vis;
    return L;
  }
  let lightFrame = 0;
  function applyLighting(g, W, H, dpr, B, t, vis) {
    const amb = AMB[B.tod];
    if (!amb) return;
    const ls = QL === 0 ? 4 : 2;
    const w = Math.ceil(W / ls), h = Math.ceil(H / ls);
    let fresh = false;
    if (!lightC || lightC.width !== w || lightC.height !== h) { lightC = canvas(w, h); lightG = lightC.getContext('2d'); fresh = true; }
    lightFrame++;
    if (QL < 2 && !fresh && lightFrame % 2 === 1) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(lightC, 0, 0, W, H); g.globalCompositeOperation = 'source-over'; return; }
    const lg = lightG;
    lg.globalCompositeOperation = 'source-over';
    const ambC = 'rgb(' + amb[0] + ',' + amb[1] + ',' + amb[2] + ')';
    // фон за диорамой (небо, горизонт) не затемняем — у него свои цвета
    lg.fillStyle = '#ffffff'; lg.fillRect(0, 0, w, h);
    const scp = function (pt, dy) { const q2 = TR.worldToScreen(pt[0], pt[1] + dy); return [q2[0] / ls, q2[1] / ls]; };
    const pL = iso(0, B.h), pT = iso(0, 0), pR = iso(B.w, 0), pB = iso(B.w, B.h);
    lg.save(); lg.shadowColor = ambC; lg.shadowBlur = 18; lg.fillStyle = ambC;
    lg.beginPath();
    [scp(pL, -50), scp(pT, -90), scp(pR, -50), scp(pR, EDGE), scp(pB, EDGE + 4), scp(pL, EDGE)].forEach(function (q, i) { if (i) lg.lineTo(q[0], q[1]); else lg.moveTo(q[0], q[1]); });
    lg.closePath(); lg.fill(); lg.restore();
    lg.globalCompositeOperation = 'lighter';
    const z = TR.cam.z;
    collectLights(B, t, vis).forEach(function (l) {
      if (!l[2]) return;
      const s = TR.worldToScreen(l[0], l[1]);
      const x = s[0] / ls, y = s[1] / ls, r = l[2] * z / ls;
      if (x < -r || y < -r || x > w + r || y > h + r) return;
      const gr = lg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + l[3] + ',' + l[4] + ')'); gr.addColorStop(1, 'rgba(' + l[3] + ',0)');
      lg.fillStyle = gr; lg.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
    });
    lg.globalCompositeOperation = 'source-over';
    lg.drawImage(TR.vignette(w, h, 0.5), 0, 0, w, h);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(lightC, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    litVign = true;
  }
  let litVign = false;
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
      g.strokeStyle = 'rgba(200,235,170,0.4)'; g.lineWidth = 1;
      for (let k = 0; k < 26; k++) {
        const sl = Math.floor(ts * 5 + k * 0.37), ph = (ts * 5 + k * 0.37) - sl;
        const r = U.hash2(k, sl, 3), q = U.hash2(k, sl, 9);
        const x = r * W, y = H * 0.15 + q * H * 0.85, rr = 1 + ph * 6;
        g.globalAlpha = 1 - ph;
        g.beginPath(); g.ellipse(x, y, rr, rr * 0.4, 0, 0, Math.PI * 2); g.stroke();
        if (ph < 0.3) { g.fillStyle = 'rgba(210,240,180,0.6)'; g.fillRect(x - 1, y - 2 - ph * 10, 1, 2); g.fillRect(x + 1.5, y - 1.5 - ph * 8, 1, 2); }
      }
      g.globalAlpha = 1;
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
  TR.applyQuality = function (atInit) {
    QL = DW.gfxLevel ? DW.gfxLevel() : 2;
    OSS = QL === 0 ? 2 : 2.5; USS = QL === 0 ? 2 : 2.5;
    if (atInit) GS = [1.25, 1.75, 2][QL];   // разрешение земли меняется только при новом бое
  };
  TR.quality = function () { return QL; };
  TR.init = function (B) {
    TR.applyQuality(true);
    frameCache.clear();
    sprites = {};
    unitCache = {};
    for (const k in live) delete live[k];
    for (const k in turnS) delete turnS[k];
    for (const k in anims) delete anims[k];
    for (const k in nextFidget) delete nextFidget[k];
    for (const k in deadAt) delete deadAt[k];
    fx = { floats: [], tracers: [], parts: [], projs: [], flashes: [], barks: [] };
    for (const k in tweens) delete tweens[k];
    camWaiters = [];
    HG = B.hgt || null; HGW = B.w; HGH = B.h; elev = {};
    buildGround(B);
    (B.decals || []).forEach(function (d) { paintDecal(groundCtx, d); });
    buildIso(B);
    cineOn = false; cineK = 0; cineZ = null; DW.timeScale = 1; TR.cam.tz = null;
    fogC = canvas(B.w * FOGR, B.h * FOGR);
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
    if (DW.settings.cine !== false && !B.flown) {
      B.flown = true;
      const ex = TR.cam.x, ey = TR.cam.y, ez = TR.cam.z;
      const mc = isoC(B.w * 0.62, B.h * 0.5);
      TR.cam.z = Math.max(0.5, ez * 0.62); TR.cam.x = mc[0]; TR.cam.y = mc[1] - 40;
      clampCam();
      TR.cam.fly = 1; TR.cam.flyT0 = performance.now();
      TR.cam.tx = ex; TR.cam.ty = ey; TR.cam.tz = ez;
    }
  };
  TR.resize = function (w, h) { TR.view.w = w; TR.view.h = h; clampCam(); };
  function clampCam() {
    const B = DW.BT.get();
    if (!B) return;
    const z = TR.cam.z;
    const hw = TR.view.w / 2 / z, hh = TR.view.h / 2 / z;
    const x0 = -B.h * HW - 60, x1 = B.w * HW + 60;
    const y0 = -90 - 2 * LH, y1 = (B.w + B.h) * HH + EDGE + 70;
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
    for (let h = 2; h >= 1; h--) {
      const q = worldToPlane(w[0], w[1] + h * LH);
      const tx = Math.floor(q[0]), ty = Math.floor(q[1]);
      if (HG && tx >= 0 && ty >= 0 && tx < HGW && ty < HGH && HG[ty * HGW + tx] === h) return [tx, ty];
    }
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
      const c = uPos(u);
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
  function uPos(u, lean) {
    const p = lean ? leanPos(u) : rp(u);
    const tw = tweens[u.id];
    let h;
    if (tw) {
      const k = U.clamp((now() - tw.t0) / tw.dur, 0, 1);
      h = tw.kind === 'lunge' ? hT(tw.fx, tw.fy) : U.lerp(hT(tw.fx, tw.fy), hT(tw.tx, tw.ty), k);
    } else h = hT(u.x, u.y);
    return [(p[0] - p[1]) * HW, (p[0] + p[1] + 1) * HH - h * LH];
  }
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
    const heavy = u.type === 'brute' || u.type === 'queen';
    if (heavy) {
      TR.shake = Math.max(TR.shake || 0, u.type === 'queen' ? 4 : 2.6);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; fx.parts.push({ x: c0[0] + Math.cos(a) * 8, y: c0[1] + Math.sin(a) * 4, z: 1, vx: Math.cos(a) * 30, vy: Math.sin(a) * 10, vz: 10 + Math.random() * 8, t0: now(), life: 700, color: 'rgba(170,150,120,0.4)', size: 5 + Math.random() * 4, grav: 6 }); }
    }
    if (Math.random() < 0.7) for (let k = 0; k < 3; k++) fx.parts.push({ x: c0[0] + (Math.random() - 0.5) * 10, y: c0[1] + (Math.random() - 0.5) * 4, z: 1, vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.5) * 6, vz: 8 + Math.random() * 8, t0: now(), life: 600, color: 'rgba(170,150,120,0.35)', size: 4 + Math.random() * 4, grav: 4 });
    return new Promise(function (res) {
      tweens[u.id] = { fx: u.x, fy: u.y, tx: nx, ty: ny, t0: now(), dur: (u._run ? 112 : 135) / spd(), res: res, kind: 'step', run: !!u._run };
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
  /* Реплики бойцов */
  const BARKS = {
    move: ['Иду.', 'Двигаюсь.', 'Есть.', 'Понял.'], run: ['Прикройте!', 'Бегу!', 'Рывок!'],
    reload: ['Перезаряжаюсь!', 'Меняю магазин!', 'Пустой!'], overwatch: ['Держу сектор.', 'Смотрю.', 'Пусть только высунутся.'],
    hunker: ['Пригнулся!', 'Головы не поднять!'], grenade: ['Граната!', 'Лови подарок!'], rocket: ['Выстрел!', 'Сзади чисто? Огонь!'],
    kill: ['Минус один!', 'Готов.', 'Лёг.', 'Есть!'], hurt: ['Зацепило!', 'А-а-а!', 'Ранен!'], lowhp: ['Мне нужна помощь!', 'Долго не протяну…'],
    contact: ['Контакт!', 'Бандиты!', 'Вижу их!'], contactBeast: ['Мутанты!', 'Твари… то есть мутанты!', 'Вижу мутантов!'],
    heal: ['Держись.', 'Сейчас перевяжу.'], save: ['Держись, брат!', 'Не умирай мне тут!'],
    downed: ['{} ранен!', '{} упал!', 'Медика к {}!'], died: ['{}… нет!', 'Потеряли {}.'],
    enemyhit: ['Вали их!', 'Получи!', 'Ха!']
  };
  const BARKS_P = {
    'Крут': { move: ['За мной.', 'Держимся вместе.'], kill: ['Чисто.', 'Следующий.'], contact: ['Все в укрытия!', 'Гости.'], save: ['Мы своих не бросаем.'] },
    'Мальборо': { move: ['Иду, иду…', 'Покурить бы.'], reload: ['Диск пуст!', 'Секунду, перекур… шучу.'], kill: ['Отбегался.', 'Затяжка за тебя.'], hurt: ['Сигарету помял, гад!'], overwatch: ['Посижу, покурю.'] }
  };
  const barkCd = {};
  TR.bark = function (u, kind, arg) {
    if (!u || !BARKS[kind]) return;
    const t = now();
    if (barkCd[u.id] && t - barkCd[u.id] < 2600) return;
    const live = fx.barks ? fx.barks.filter(function (b) { return t - b.t0 < b.life; }).length : 0;
    if (live >= 2 && kind !== 'downed' && kind !== 'died') return;
    const own = BARKS_P[u.name] && BARKS_P[u.name][kind];
    const pool = own && Math.random() < 0.65 ? own : BARKS[kind];
    const text = pool[Math.floor(Math.random() * pool.length)].replace('{}', arg || '');
    barkCd[u.id] = t;
    (fx.barks = fx.barks || []).push({ u: u, text: text, t0: t, life: 1900, bad: u.side === 'e' });
  };
  function drawBarks(g, t) {
    if (!fx.barks || !fx.barks.length) return;
    fx.barks = fx.barks.filter(function (b) { return t - b.t0 < b.life; });
    g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
    const placed = [];
    fx.barks.forEach(function (b) {
      const u = b.u;
      if (u.side === 'e' && !u.seen) return;
      const c = uPos(u, true), k = (t - b.t0) / b.life;
      const a = k < 0.1 ? k / 0.1 : (k > 0.85 ? (1 - k) / 0.15 : 1);
      let Y = c[1] - 78 * unitScale(u) - (k < 0.1 ? (1 - k / 0.1) * 6 : 0);
      const w = g.measureText(b.text).width + 14;
      /* пузыри не наползают друг на друга — поднимаем выше */
      for (let tries = 0; tries < 4; tries++) {
        let hit = false;
        for (let i = 0; i < placed.length; i++) {
          const p = placed[i];
          if (Math.abs(p.x - c[0]) < (p.w + w) / 2 + 2 && Math.abs(p.y - Y) < 21) { Y = p.y - 22; hit = true; }
        }
        if (!hit) break;
      }
      placed.push({ x: c[0], y: Y, w: w });
      g.globalAlpha = a;
      g.fillStyle = b.bad ? 'rgba(60,14,10,0.9)' : 'rgba(250,244,228,0.95)';
      const x0 = c[0] - w / 2, y0 = Y - 16;
      g.beginPath(); g.moveTo(x0 + 6, y0); g.lineTo(x0 + w - 6, y0); g.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + 6); g.lineTo(x0 + w, y0 + 12); g.quadraticCurveTo(x0 + w, y0 + 18, x0 + w - 6, y0 + 18);
      g.lineTo(c[0] + 5, y0 + 18); g.lineTo(c[0], y0 + 24); g.lineTo(c[0] - 3, y0 + 18); g.lineTo(x0 + 6, y0 + 18); g.quadraticCurveTo(x0, y0 + 18, x0, y0 + 12); g.lineTo(x0, y0 + 6); g.quadraticCurveTo(x0, y0, x0 + 6, y0); g.closePath(); g.fill();
      g.strokeStyle = b.bad ? 'rgba(255,120,90,0.7)' : 'rgba(60,40,20,0.6)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = b.bad ? '#ffd0c0' : '#2a1e12'; g.fillText(b.text, c[0], y0 + 13);
    });
    g.globalAlpha = 1;
  }
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
  const OMAT = { 7: 'metal', 9: 'metal', 11: 'metal', 12: 'metal', 15: 'metal', 18: 'metal', 4: 'wood', 5: 'wood', 10: 'cloth', 13: 'wood', 19: 'wood', 1: 'stone', 2: 'brick', 3: 'stone', 8: 'stone', 14: 'stone', 17: 'wood', 6: 'sand', 16: 'flesh', 20: 'crystal' };
  /* Попадание по материалу: искры по металлу, щепа по дереву, крошка по камню, песок из мешков */
  function impact(X, Y, mat, big) {
    const k = big ? 1.8 : 1;
    switch (mat) {
      case 'metal':
        parts(X, Y, 16, Math.round(9 * k), '#fff2b0', 150, 260, 1.8, 420, 80);
        parts(X, Y, 16, Math.round(4 * k), '#ffb040', 90, 420, 2.2, 420, 60);
        fx.flashes.push({ x: X, y: Y - 16, r: 7 * k, t0: now(), life: 80 });
        break;
      case 'wood':
        parts(X, Y, 16, Math.round(7 * k), '#9a6a3a', 90, 700, 2.6, 380, 90);
        parts(X, Y, 16, Math.round(4 * k), 'rgba(150,120,90,0.45)', 30, 700, 5, -10, 15);
        break;
      case 'sand':
        parts(X, Y, 14, Math.round(10 * k), 'rgba(200,180,130,0.75)', 60, 650, 2.4, 300, 70);
        parts(X, Y, 14, Math.round(5 * k), 'rgba(200,180,140,0.45)', 25, 1000, 7, -10, 15);
        break;
      case 'crystal':
        parts(X, Y, 16, Math.round(9 * k), '#9af0ff', 120, 600, 2.2, 340, 90);
        fx.flashes.push({ x: X, y: Y - 16, r: 9 * k, t0: now(), life: 120 });
        break;
      case 'flesh':
        parts(X, Y, 16, Math.round(8 * k), '#8a3a50', 80, 600, 2.6, 360, 70);
        break;
      default:
        parts(X, Y, 16, Math.round(7 * k), mat === 'brick' ? '#a0583e' : '#9a948a', 100, 600, 2.4, 380, 90);
        parts(X, Y, 16, Math.round(5 * k), 'rgba(175,165,150,0.5)', 35, 900, 6, -12, 18);
        parts(X, Y, 16, 3, '#fff2b0', 120, 200, 1.4, 300, 60);
    }
  }
  function groundKick(X, Y) {
    parts(X, Y, 2, 5, 'rgba(120,96,70,0.85)', 40, 600, 2.2, 260, 70);
    parts(X, Y, 2, 4, 'rgba(190,170,140,0.5)', 18, 900, 6, -6, 22);
  }
  TR.debris = function (x, y, color, o) {
    const c = isoC(x, y);
    const mat = OMAT[o] || 'stone';
    const cols = mat === 'brick' ? ['#a0583e', '#8a7f72', '#6e3e2a'] : (mat === 'metal' ? ['#4a5258', '#7a3a26', '#2a2e32'] : (mat === 'wood' ? ['#8a6539', '#5e4424', '#a07a48'] : [color || '#888', '#7a746c', '#5a554e']));
    for (let k = 0; k < 3; k++) parts(c[0], c[1], 18, 7, cols[k], 130, 1100, 5.5, 420, 190);
    parts(c[0], c[1], 10, 14, 'rgba(160,150,140,0.5)', 50, 2200, 14, -10, 22);
    if (mat === 'metal') { parts(c[0], c[1], 20, 14, '#fff2b0', 170, 380, 1.8, 420, 120); for (let k = 0; k < 5; k++) fx.parts.push({ x: c[0] + (Math.random() - 0.5) * 20, y: c[1], z: 14, vx: (Math.random() - 0.5) * 8, vy: 0, vz: 16 + Math.random() * 10, t0: now(), life: 3200, color: 'rgba(40,36,34,0.45)', size: 12 + Math.random() * 10, grav: -6 }); }
    TR.shake = Math.max(TR.shake || 0, 5);
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
    for (let k = 0; k < 10; k++) fx.parts.push({ x: c[0] + (Math.random() - 0.5) * 50 * r, y: c[1] + (Math.random() - 0.5) * 24 * r, z: 4 + Math.random() * 10, vx: 5 + Math.random() * 8, vy: (Math.random() - 0.5) * 3, vz: 2 + Math.random() * 4, t0: now() + 300, life: 6500 + Math.random() * 3000, color: 'rgba(120,112,104,0.42)', size: 24 + Math.random() * 20, grav: -1 });
    TR.shake = 12;
    flashScr = now();
  };
  let flashScr = -1e9;
  TR.chips = function (x, y, color, o) {
    const c = isoC(x, y);
    if (o) impact(c[0], c[1] - 2, OMAT[o] || 'stone', true);
    else parts(c[0], c[1], 18, 6, color || '#888', 70, 600, 2.5, 380, 90);
  };
  function muzzle(u) {
    const c = uPos(u);
    const f = u.face || 0;
    const sx = (Math.cos(f) - Math.sin(f)) * HW;
    const dir = sx >= 0 ? 1 : -1;
    return [c[0] + dir * 20 * unitScale(u), c[1] - 27 * unitScale(u)];
  }
  /* Особенности стрельбы каждого ствола */
  const FXW = {
    ppsh: { n: 7, gap: 46, w: 1.5, life: 90, flash: 11, flife: 45, tr: '#ffd27a', cas: '#c89a40', casS: 2, snd: 'smg', fk: 'smg', smoke: 3 },
    ak: { n: 3, gap: 95, w: 2, flash: 15, flife: 65, snd: 'rifle' },
    ak2: { n: 3, gap: 80, w: 2, flash: 14, flife: 60, tr: '#fff0b0', snd: 'ak2' },
    shotgun: { n: 1, w: 1.6, flash: 22, flife: 110, fk: 'wide', smoke: 6, snd: 'shotgun' },
    sniper: { n: 1, w: 3, life: 160, flash: 22, flife: 110, tr: '#fff6d8', smoke: 5, ring: true, fk: 'long', snd: 'sniper' },
    hsniper: { n: 1, w: 4, life: 190, flash: 30, flife: 130, tr: '#fffbe8', smoke: 7, ring: true, fk: 'long', casS: 3.2, snd: 'hsniper' },
    lmg: { n: 6, gap: 68, w: 2.2, flash: 17, flife: 60, tr: '#ffcf6a', snd: 'lmg', fk: 'smg' },
    hlmg: { n: 5, gap: 85, w: 3, flash: 24, flife: 80, tr: '#ffc050', casS: 3, snd: 'hlmg', smoke: 6 }
  };
  TR.shotFx = function (att, tgt, hit, W, show, suppress) {
    const s = spd();
    const m = muzzle(att);
    const tc = isoC(tgt.x, tgt.y);
    const ty0 = tc[1] - 24 * unitScale(tgt);
    const FW = FXW[W.id] || {};
    const cnt = FW.n || ({ rifle: 3, lmg: 5, shotgun: 1, sniper: 1, spit: 1, beam: 1 }[W.snd] || 1);
    const gap = (FW.gap || (W.snd === 'lmg' ? 70 : 90)) / s;
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
            fx.parts.push({ x: m[0] - fdir * 12, y: m[1] + 22, z: 26, vx: -fdir * (30 + Math.random() * 40), vy: (Math.random() - 0.3) * 30, vz: 70 + Math.random() * 50, t0: now(), life: 2600, color: FW.cas || (W.snd === 'shotgun' ? '#b8302a' : '#e0b848'), size: FW.casS || 2.4, grav: 420, cas: true, late: true });
          }, rt(i * gap));
        }
        for (let k = 0; k < (FW.smoke || 4); k++) fx.parts.push({ x: m[0] + fdir * 4, y: m[1] + 22, z: 22, vx: fdir * (8 + Math.random() * 14), vy: (Math.random() - 0.5) * 6, vz: 14 + Math.random() * 10, t0: now() + (cnt - 1) * gap, life: 1300, color: 'rgba(200,196,188,0.32)', size: 6 + Math.random() * 6, grav: -8 });
        if (FW.ring) for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; fx.parts.push({ x: m[0] + fdir * 6, y: m[1] + 22, z: 22, vx: Math.cos(a) * 26 + fdir * 30, vy: Math.sin(a) * 8, vz: Math.sin(a) * 18 + 6, t0: now(), life: 900, color: 'rgba(215,210,200,0.35)', size: 5, grav: -4 }); }
      }
    }, rt(pre));
    const col = FW.tr || (W.snd === 'spit' ? '#a8e03a' : (W.snd === 'beam' ? '#6fd8ff' : '#ffe08a'));
    for (let i = 0; i < cnt; i++) {
      let ex = tc[0], ey = ty0;
      if (cover && !suppress) { const cc = isoC(cover[0], cover[1]); ex = cc[0] + (Math.random() - 0.5) * 14; ey = cc[1] - 16 - Math.random() * 14; }
      else if (!hit || suppress) { const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 26; ex += Math.cos(a) * d; ey += Math.sin(a) * d * 0.6; }
      else { ex += (Math.random() - 0.5) * 8; ey += (Math.random() - 0.5) * 8; }
      fx.tracers.push({ x1: m[0], y1: m[1], x2: ex, y2: ey, t0: t0 + i * gap, life: W.snd === 'spit' ? 280 : (FW.life || 115), color: col, w: FW.w || (W.snd === 'sniper' || W.snd === 'beam' ? 3 : (W.snd === 'spit' ? 6 : 2)), spit: W.snd === 'spit' });
      if (W.snd === 'shotgun') for (let k = 0; k < 7; k++) fx.tracers.push({ x1: m[0], y1: m[1], x2: ex + (Math.random() - 0.5) * 30, y2: ey + (Math.random() - 0.5) * 20, t0: t0, life: 110, color: col, w: 1.2 });
      if (!hit && !suppress) {
        setTimeout(function () {
          const Bb = DW.BT.get();
          if (cover && Bb) impact(ex, ey + 18, OMAT[Bb.obj[cover[1] * Bb.w + cover[0]]] || 'stone', false);
          else groundKick(ex, ey + 20);
        }, rt(pre + i * gap + 100 / s));
      }
    }
    if (show || att.side === 'p') setTimeout(function () { DW.SFX.play(FW.snd || W.snd); }, rt(pre));
    for (let i = 0; i < cnt; i++) fx.flashes.push({ x: m[0], y: m[1], r: (FW.flash || 14) * (0.85 + Math.random() * 0.3), t0: t0 + i * gap, life: FW.flife || 70, muzzle: true, dir: fdir, kind: FW.fk || 'std' });
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
    if (c.fly && performance.now() - (c.flyT0 || 0) > 2300) c.fly = 0;
    if (c.tz !== null && c.tz !== undefined) {
      const kz = Math.min(1, dt * (c.fly ? 1.4 : 4.5));
      c.z += (c.tz - c.z) * kz;
      if (Math.abs(c.tz - c.z) < 0.004) { c.z = c.tz; c.tz = null; }
      clampCam();
    }
    cineK += ((cineOn ? 1 : 0) - cineK) * Math.min(1, dt * 5);
    if (c.tx !== null) {
      const k = Math.min(1, dt * (c.fly ? 1.6 : 7));
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
      clampCam();
      if (Math.abs(c.tx - c.x) < 3 && Math.abs(c.ty - c.y) < 3) {
        c.tx = null; c.ty = null; c.fly = 0;
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
    const pcap = [140, 260, 420][QL];
    if (fx.parts.length > pcap) fx.parts.splice(0, fx.parts.length - pcap);
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
  const turnS = {};
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
  const RK = { ppsh: 'drum', ak: 'mag', ak2: 'mag', lmg: 'box', hlmg: 'box', sniper: 'bolt', hsniper: 'bolt', shotgun: 'pump' };
  const KICK = { ppsh: 0.55, ak: 1, ak2: 0.85, lmg: 0.8, hlmg: 1.1, sniper: 1.7, hsniper: 2.1, shotgun: 1.6 };
  function coverLevel(u) {
    if (u.kind === 'turret' || (u.side === 'e' && !ART.ENEMY_LOOKS[u.type])) return 0;
    let c = 0;
    DW.BT.DIR4.forEach(function (d) { const o = DW.BT.objAt(u.x + d[0], u.y + d[1]); if (o && D.OBJ[o].cover > c) c = D.OBJ[o].cover; });
    return c;
  }
  function poseFor(u, an) {
    const P = {};
    P.rk = RK[u.weapon] || 'mag'; P.kick = KICK[u.weapon] || 1;
    if (u.hunker) { P.crouch = 1; P.low = 0.5; }
    else if (u.overwatch) { P.raise = 1; P.crouch = 0.3; }
    else if (u.alive) {
      const cv = coverLevel(u);
      if (cv === 1) { P.crouch = 0.62; P.low = 0.15; }
      else if (cv === 2) { P.crouch = 0.12; P.lean = -0.05; P.low = 0.25; }
    }
    if (!an) return P;
    const p = an.p;
    switch (an.kind) {
      case 'shoot': {
        const n = an.a.data.cnt || 1;
        const q = (p * n) % 1;
        P.raise = 1; P.crouch = Math.min(P.crouch || 0, 0.5); P.low = 0;
        P.recoil = q < 0.3 ? q / 0.3 : Math.max(0, 1 - (q - 0.3) / 0.7);
        if (P.rk === 'drum' || P.rk === 'box') P.recoil *= 0.75 + Math.random() * 0.35;
        P.atk = Math.sin(Math.min(1, p) * Math.PI);
        if (P.rk === 'bolt' && p > 0.55) { P.reload = (p - 0.55) / 0.45; P.recoil = 0; }
        break;
      }
      case 'charge': P.charge = p; break;
      case 'reload': P.reload = p; P.crouch = Math.max(P.crouch || 0, 0.2); P.low = 0; break;
      case 'scan': P.raise = Math.sin(p * Math.PI) * 0.8; P.look = p > 0.4 && p < 0.7 ? -1 : 0; break;
      case 'shift': P.lean = Math.sin(p * Math.PI) * 0.09; P.crouch = (P.crouch || 0) + Math.sin(p * Math.PI) * 0.12; break;
      case 'smoke': P.smoke = Math.sin(Math.min(1, p * 1.3) * Math.PI); break;
      case 'shake': P.atk = Math.sin(p * Math.PI * 6) * 0.3; P.hit = Math.sin(p * Math.PI) * 0.2; break;
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
      ART.human(g, { look: u.look, body: '#c8691c', armor: u.armorId || 'robe', weapon: u.weapon, dir: fi.dir, aim: fi.aim, walk: walk, cig: DW.G.smoker(u), helmet: u.armorId === 'heavy' || u.armorId === 'exo', helmetColor: u.armorId === 'exo' ? '#2f4552' : '#4a5258', seed: u.id, scale: sc, pose: pose, band: u.rank >= 4 ? '#c0302a' : null, rank: u.rank, noShadow: true }, t);
    } else if (u.kind === 'turret') {
      ART.creature(g, 'turret', { dir: fi.dir, aim: fi.aim, seed: u.id, scale: sc, pose: pose, noShadow: true }, t);
    } else if (ART.ENEMY_LOOKS[u.type]) {
      const E = ART.ENEMY_LOOKS[u.type];
      if (!E._look) E._look = ART.makeLook(ART.hashStr(u.type), E.look);
      ART.human(g, { look: E._look, body: E.body, pants: E.pants, mask: E.mask, hood: E.hood, coat: E.coat, collar: E.collar, robe: false, weapon: u.weapon || D.ENEMIES[u.type].weapon, dir: fi.dir, aim: fi.aim, walk: walk, scale: sc, seed: u.id, pose: pose, noShadow: true }, t);
    } else {
      ART.creature(g, u.type, { dir: fi.dir, aim: fi.aim, walk: walk, scale: sc, seed: u.id, pose: pose, noShadow: true }, t);
    }
  }
  function stanceKey(u) { return u.hunker ? 'h' : (u.overwatch ? 'o' : 'n' + coverLevel(u)); }
  /* Объём фигуры: тёмный контур, подсветка со стороны света, затенение с теневой, темнее к ногам */
  let volTmp = null;
  function volumize(src, dst, feetY, k) {
    k = k || 1;
    const w = src.width, h = src.height;
    const g = dst.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    if (!volTmp || volTmp.width < w || volTmp.height < h) volTmp = canvas(Math.max(w, volTmp ? volTmp.width : 0), Math.max(h, volTmp ? volTmp.height : 0));
    const tg = volTmp.getContext('2d');
    const r = 2.1 * k, q = r * 0.71;
    [[r, 0], [-r, 0], [0, r], [0, -r], [q, q], [-q, q], [q, -q], [-q, -q]].forEach(function (o) { g.drawImage(src, o[0], o[1]); });
    g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(20,13,9,0.8)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
    const rim = function (dx, dy, col, a) {
      tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, w, h); tg.drawImage(src, 0, 0);
      tg.globalCompositeOperation = 'destination-out'; tg.drawImage(src, dx, dy);
      tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, w, h);
      g.globalAlpha = a; g.globalCompositeOperation = 'source-atop'; g.drawImage(volTmp, 0, 0, w, h, 0, 0, w, h);
    };
    rim(2.6 * k, 2.2 * k, 'rgb(255,236,206)', 0.5);
    rim(-3.4 * k, -2.6 * k, 'rgb(0,0,0)', 0.3);
    g.globalAlpha = 1;
    const gr = g.createLinearGradient(0, feetY - 120 * k, 0, feetY);
    gr.addColorStop(0, 'rgba(255,240,215,0.07)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    tg.globalCompositeOperation = 'source-over';
  }
  function shadowMask(src, dst) {
    const g = dst.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, dst.width, dst.height);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, dst.width, dst.height);
    g.globalCompositeOperation = 'source-over';
  }
  function spriteDims(u) {
    const big = u.type === 'queen' ? 2.2 : (u.type === 'brute' ? 1.4 : 1);
    const LW = 130 * big, LH = 100 * big;
    return { big: big, LW: LW, LH: LH, ox: LW / 2, oy: LH - 16 * big, SS: USS };
  }
  /* Кадр анимации: рисуем во временный холст, затем та же объёмная обработка.
     Готовые кадры кэшируются по квантованной позе — повторные циклы ходьбы, стрельбы и перезарядки
     берутся из кэша, а не рисуются заново. */
  const live = {};
  const frameCache = new Map();
  const framePool = [];
  const FCAP = 90;
  function q(v, st) { return v ? Math.round(v / st) : 0; }
  function poseKey(P) {
    return [q(P.crouch, 0.1), q(P.hit, 0.1), q(P.recoil, 0.15), q(P.raise, 0.1), q(P.reload, 0.07), q(P.throwP, 0.08), q(P.low, 0.1), q(P.lean, 0.02),
      P.look ? (P.look < 0 ? 1 : 2) : 0, q(P.smoke, 0.1), q(P.atk, 0.1), q(P.charge, 0.1), P.run ? 1 : 0, P.rk || ''].join(',');
  }
  function liveSprite(u, fi, walk, sc, t, pose, pre, preKey) {
    let wq = null;
    if (walk !== null && walk !== undefined) { const st = Math.PI * 2 / 12; wq = Math.round(walk / st) % 12; if (wq < 0) wq += 12; walk = wq * st; }
    const key = u.id + '|' + fi.dir + '|' + Math.round(fi.aim * 8) + '|' + (u.weapon || '') + '|' + (u.armorId || '') + '|' + (wq === null ? '-' : wq) + '|' + poseKey(pose) + '|' + (preKey || '');
    const hit = frameCache.get(key);
    if (hit) { frameCache.delete(key); frameCache.set(key, hit); return hit; }
    const fr = liveSpriteRaw(u, fi, walk, sc, t, pose, pre);
    let ent = framePool.pop();
    if (!ent || ent.c.width !== fr.c.width || ent.c.height !== fr.c.height) ent = { c: canvas(fr.c.width, fr.c.height), sh: canvas(fr.sh.width, fr.sh.height) };
    const cg = ent.c.getContext('2d'); cg.clearRect(0, 0, ent.c.width, ent.c.height); cg.drawImage(fr.c, 0, 0);
    const sg = ent.sh.getContext('2d'); sg.clearRect(0, 0, ent.sh.width, ent.sh.height); sg.drawImage(fr.sh, 0, 0);
    const out = { c: ent.c, sh: ent.sh, w: fr.w, h: fr.h, ox: fr.ox, oy: fr.oy };
    frameCache.set(key, out);
    if (frameCache.size > FCAP) { const k0 = frameCache.keys().next().value; const old = frameCache.get(k0); frameCache.delete(k0); if (old && framePool.length < 12) framePool.push({ c: old.c, sh: old.sh }); }
    return out;
  }
  function liveSpriteRaw(u, fi, walk, sc, t, pose, pre) {
    const D2 = spriteDims(u);
    D2.SS = QL === 0 ? 1.5 : 1.75;
    const cw = Math.ceil(D2.LW * D2.SS), chh = Math.ceil(D2.LH * D2.SS);
    let L = live[u.id];
    if (!L || L.raw.width !== cw) {
      L = live[u.id] = { raw: canvas(cw, chh), c: canvas(cw, chh), sh: canvas(cw, chh) };
    }
    const g = L.raw.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L.raw.width, L.raw.height);
    g.setTransform(D2.SS, 0, 0, D2.SS, D2.ox * D2.SS, D2.oy * D2.SS);
    if (pre) pre(g);
    paintUnit(g, u, fi, walk, sc, t, pose);
    g.setTransform(1, 0, 0, 1, 0, 0);
    volumize(L.raw, L.c, D2.oy * D2.SS, D2.SS / 2);
    shadowMask(L.raw, L.sh);
    return { c: L.c, sh: L.sh, w: D2.LW, h: D2.LH, ox: D2.ox, oy: D2.oy };
  }
  let contactSpr = null;
  function contact() {
    if (contactSpr) return contactSpr;
    contactSpr = canvas(64, 32);
    const g = contactSpr.getContext('2d');
    const gr = g.createRadialGradient(32, 16, 2, 32, 16, 30);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.setTransform(1, 0, 0, 0.5, 0, 8); g.fillStyle = gr; g.beginPath(); g.arc(32, 16, 30, 0, 7); g.fill();
    return contactSpr;
  }
  function castShadow(g, c, fr, k, lying) {
    const sun = TR.sun;
    const cw = (lying ? 34 : 17) * k, ch = (lying ? 12 : 8) * k;
    g.drawImage(contact(), c[0] - cw, c[1] - ch, cw * 2, ch * 2);
    if (!sun || lying || !fr.sh || QL === 0) return;
    const sx = (sun.dx - sun.dy) * HW, sy = (sun.dx + sun.dy) * HH;
    const kx = Math.min(0.95, sun.len * sx / ZH), ky = Math.max(0.17, sun.len * sy / ZH);
    g.save();
    g.globalAlpha = sun.a * 0.8;
    g.transform(1, 0, -kx, -ky, c[0], c[1] + 1);
    g.drawImage(fr.sh, -fr.ox, -fr.oy, fr.w, fr.h);
    g.restore();
  }
  function baseRing(g, u, c, k, t) {
    const pl = u.side === 'p';
    const rx = 17 * k, ry = 8.5 * k;
    g.strokeStyle = pl ? 'rgba(120,190,255,0.42)' : 'rgba(255,96,72,0.42)'; g.lineWidth = 1.3;
    g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = pl ? 'rgba(170,220,255,0.55)' : 'rgba(255,150,120,0.55)'; g.lineWidth = 1.6;
    const a0 = Math.PI * 0.62, a1 = Math.PI * 0.38;
    g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, a1, a0); g.stroke();
  }
  function unitSprite(u, fi, sc, dead) {
    const aimQ = Math.round(fi.aim * 4) / 4;
    const key = u.id + '|' + fi.dir + '|' + aimQ + '|' + (u.armorId || '') + '|' + (u.weapon || '') + '|' + (u.type || u.kind) + '|' + (dead ? 'X' : stanceKey(u));
    let s = unitCache[key];
    if (!s) {
      const D2 = spriteDims(u);
      const LW = D2.LW, LH = D2.LH, ox = D2.ox, oy = D2.oy, SS = D2.SS;
      const raw = canvas(LW * SS, LH * SS);
      const g = raw.getContext('2d');
      g.scale(SS, SS); g.translate(ox, oy);
      if (dead) fallTransform(g, u, fi, 1);
      paintUnit(g, u, { dir: fi.dir, aim: dead ? 0.3 : aimQ }, null, sc, 0, dead ? {} : poseFor(u, null));
      const c = canvas(LW * SS, LH * SS);
      volumize(raw, c, oy * SS, SS / 2);
      let shc = null;
      if (!dead) { shc = canvas(LW * SS, LH * SS); shadowMask(raw, shc); }
      s = unitCache[key] = { c: c, sh: shc, w: LW, h: LH, ox: ox, oy: oy };
    }
    return s;
  }
  function fallTransform(g, u, fi, f) {
    const beast = u.side === 'e' && D.ENEMIES[u.type] && !ART.ENEMY_LOOKS[u.type];
    const e = U.ease(U.clamp(f, 0, 1));
    if (beast) { g.rotate(-fi.dir * e * 0.35); g.scale(1, 1 - e * 0.45); return; }
    const v = (u.id * 7 + 3) % 3;
    if (v === 0) { g.translate(-fi.dir * e * 4, 0); g.rotate(-fi.dir * e * 1.42); g.scale(1, 1 - e * 0.2); }
    else if (v === 1) { g.translate(fi.dir * e * 6, 0); g.rotate(fi.dir * e * 1.48); g.scale(1, 1 - e * 0.15); }
    else {
      const a = U.clamp(f / 0.45, 0, 1), b = U.ease(U.clamp((f - 0.4) / 0.6, 0, 1));
      g.scale(1, 1 - a * 0.28);
      g.translate(-fi.dir * b * 2, 0); g.rotate(-fi.dir * b * 1.5);
    }
  }
  function drawUnit(g, u, t, sel, alpha) {
    const c = uPos(u, true);
    const fi = faceInfo(u);
    const tw = tweens[u.id];
    const running = tw && tw.kind === 'step' && tw.run;
    const walk = tw && tw.kind === 'step' ? t / (running ? 52 : 70) : null;
    const sc = unitScale(u);
    let an = curAnim(u, t);
    // случайные движения в покое
    if (!an && !tw && alpha === undefined && u.alive) {
      if (!nextFidget[u.id]) nextFidget[u.id] = t + 2000 + Math.random() * 9000;
      else if (t > nextFidget[u.id]) {
        nextFidget[u.id] = t + 6000 + Math.random() * 10000;
        const human = u.kind === 'soldier' || ART.ENEMY_LOOKS[u.type];
        const pool = u.kind === 'soldier' && DW.G.smoker(u) ? ['smoke', 'smoke', 'look', 'shift'] : ['look', 'look', 'check', 'scan', 'shift'];
        if (u.kind !== 'turret' && !u.hunker) {
          const k = human ? pool[Math.floor(Math.random() * pool.length)] : (Math.random() < 0.6 ? 'sniff' : 'shake');
          TR.anim(u, k, human ? (k === 'smoke' ? 2600 : 1500) : 1100);
        }
        an = curAnim(u, t);
      }
    }
    const ghost = alpha !== undefined;
    if (!ghost && u.alive && (u.side === 'p' || u.seen !== false)) {
      if (sel) {
        const pulse = 0.55 + Math.sin(t / 200) * 0.3;
        g.fillStyle = 'rgba(90,170,255,0.16)'; ART.ell(g, c[0], c[1], 21, 10.5);
        g.strokeStyle = 'rgba(130,200,255,' + pulse + ')'; g.lineWidth = 2.2;
        g.beginPath(); g.ellipse(c[0], c[1], 21, 10.5, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(200,235,255,' + (pulse * 0.8) + ')'; g.lineWidth = 1.4;
        const a = t / 600;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(c[0], c[1], 25, 12.5, 0, a + k * 2.09, a + k * 2.09 + 0.7); g.stroke(); }
      } else baseRing(g, u, c, sc / 1.13, t);
    }
    let fr;
    if (!tw && !an) fr = unitSprite(u, fi, sc, false);
    else {
      const pose = poseFor(u, an);
      if (running) pose.run = 1;
      if (tw && tw.kind === 'step') { pose.crouch = running ? 0.1 : 0; pose.low = 0; pose.lean = 0; }
      const hitDx = an && an.kind === 'hit' ? -fi.dir * Math.sin(an.p * Math.PI) * 3 : 0;
      fr = liveSprite(u, fi, walk, sc, t, pose, hitDx ? function (gg) { gg.translate(hitDx, 0); } : null, hitDx ? 'h' + Math.round(hitDx * 2) : '');
    }
    if (!ghost) castShadow(g, c, fr, sc / 1.13, false);
    else g.globalAlpha = alpha;
    const bob = !tw && !an ? Math.sin(t / 650 + u.id) * 0.25 : 0;
    // плавный разворот: фигура «поворачивается ребром»
    let ts = turnS[u.id];
    if (!ts) ts = turnS[u.id] = { dir: fi.dir, t0: -1e9 };
    if (ts.dir !== fi.dir) { ts.dir = fi.dir; ts.t0 = t; }
    const tk = U.clamp((t - ts.t0) / (170 / spd()), 0, 1);
    const sx = tk < 1 ? 0.18 + 0.82 * U.ease(tk) : 1;
    g.drawImage(fr.c, c[0] - fr.ox * sx, c[1] - fr.oy + bob, fr.w * sx, fr.h);
    if (!tw && !an && u.kind === 'soldier' && DW.G.smoker(u)) {
      const k = (t / 1600) % 1;
      g.fillStyle = 'rgba(210,210,210,' + (0.45 * (1 - k)) + ')';
      ART.circ(g, c[0] + fi.dir * (11 + k * 4) * sc, c[1] - 42 * sc - k * 14 + (u.hunker ? 7 : 0), 1.2 + k * 2.4);
    }
    if (an && an.kind === 'hit' && an.p < 0.6) {
      const k = 1 - an.p / 0.6;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(c[0], c[1] - 26 * sc, 2, c[0], c[1] - 26 * sc, 22 * sc);
      gr.addColorStop(0, 'rgba(255,60,40,' + (0.55 * k) + ')'); gr.addColorStop(1, 'rgba(255,60,40,0)');
      g.fillStyle = gr; ART.ell(g, c[0], c[1] - 26 * sc, 22 * sc, 28 * sc);
      g.globalCompositeOperation = 'source-over';
    }
    if (ghost) g.globalAlpha = 1;
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
      const fp = Math.round(an.p * 14) / 14;
      const fr = liveSprite(u, fi, null, sc, t, { hit: fp < 0.3 ? fp / 0.3 : 1 }, function (gg) { fallTransform(gg, u, fi, fp); }, 'f' + Math.round(fp * 14));
      castShadow(g, c, fr, sc / 1.13, an.p > 0.5);
      g.drawImage(fr.c, c[0] - fr.ox, c[1] - fr.oy, fr.w, fr.h);
      return;
    }
    const sp = unitSprite(u, fi, sc, true);
    castShadow(g, c, sp, sc / 1.13, true);
    g.drawImage(sp.c, c[0] - sp.ox, c[1] - sp.oy, sp.w, sp.h);
    if (u.kind === 'soldier' && (u.down > 0 || u.stable)) {
      // раненый: пульсирующий крест над телом
      const pl = 0.6 + Math.sin(t / 220) * 0.4;
      const col = u.stable ? '127,208,106' : '255,80,60';
      g.fillStyle = 'rgba(' + col + ',' + (0.25 * pl) + ')'; ART.ell(g, c[0], c[1] - 4, 22, 10);
      const Y = c[1] - 30;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(c[0] - 8, Y - 8, 16, 16);
      g.fillStyle = 'rgb(' + col + ')'; g.fillRect(c[0] - 2, Y - 6, 4, 12); g.fillRect(c[0] - 6, Y - 2, 12, 4);
      if (!u.stable) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; const txt = (u.down - 1) + ' х.'; g.strokeText(txt, c[0], Y - 12); g.fillStyle = '#ffb0a0'; g.fillText(txt, c[0], Y - 12); }
    }
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
    const B = DW.BT.get();
    if (SWAY[pr.t] && QL > 0) {
      const wind = B && (B.weather === 'rain' || B.weather === 'dust') ? 1.8 : 1;
      const sw = (Math.sin(t / 900 + pr.x * 2.1 + pr.y) * 0.06 + Math.sin(t / 370 + pr.x * 5) * 0.025) * wind * SWAY[pr.t];
      g0.save(); g0.translate(c0[0], c0[1]); g0.transform(1, 0, sw, 1, 0, 0); g0.translate(-c0[0], -c0[1]);
      g0.drawImage(sp, c0[0] - 32, c0[1] - 52, 64, 64);
      g0.restore();
    } else g0.drawImage(sp, c0[0] - 32, c0[1] - 52, 64, 64);
    if (pr.t === 'lamp' && B && B.tod !== 'day') {
      const fl = lampFlicker(pr, t);
      g0.globalCompositeOperation = 'lighter'; g0.globalAlpha = 0.7 * fl;
      g0.drawImage(softSpr('rgb(255,200,120)'), c0[0] + 2, c0[1] - 52, 22, 18);
      g0.globalAlpha = 0.25 * fl; g0.drawImage(softSpr('rgb(255,190,110)'), c0[0] - 22, c0[1] - 14, 60, 30);
      g0.globalAlpha = 1; g0.globalCompositeOperation = 'source-over';
    }
  }
  const SWAY = { tuft: 1, reeds: 1.3, bush: 0.6, shroom: 0.3 };
  function lampFlicker(pr, t) { const h = U.hash2(Math.floor(t / 90), (pr.x * 100) | 0, 5); return h < 0.06 ? 0.25 : 0.85 + Math.sin(t / 130 + pr.x) * 0.15; }
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
      case 'reeds':
        g.fillStyle = 'rgba(0,0,0,0.2)'; ART.ell(g, x, y, 10, 4);
        for (i = 0; i < 9; i++) {
          const ox = (r() - 0.5) * 16, h = 10 + r() * 14, bend = (r() - 0.3) * 6;
          g.strokeStyle = i % 3 ? '#6a7a3a' : '#8a8a4a'; g.lineWidth = 1.3;
          g.beginPath(); g.moveTo(x + ox, y + (r() - 0.5) * 3); g.quadraticCurveTo(x + ox + bend * 0.3, y - h * 0.6, x + ox + bend, y - h); g.stroke();
          if (r() < 0.45) { g.fillStyle = '#5a3a22'; ART.ell(g, x + ox + bend * 0.85, y - h * 0.86, 1.5, 3.4); }
        }
        break;
      case 'tire': {
        const st = r() < 0.35 ? 2 : 1;
        g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x + 2, y + 1, 12, 5.5);
        for (let k = 0; k < st; k++) {
          const yy = y - k * 4.5, dx = k ? (r() - 0.5) * 3 : 0;
          g.fillStyle = '#16130f'; ART.ell(g, x + dx, yy + 1.2, 10, 5);
          const tg = g.createLinearGradient(x - 10, yy - 4, x + 10, yy + 4);
          tg.addColorStop(0, '#3e3a34'); tg.addColorStop(1, '#16130f');
          g.fillStyle = tg; ART.ell(g, x + dx, yy, 10, 5);
          g.fillStyle = '#0a0806'; ART.ell(g, x + dx, yy + 0.4, 5, 2.4);
          g.strokeStyle = 'rgba(255,240,220,0.18)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x + dx, yy, 8.5, 4.1, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
        }
        break;
      }
      case 'bricks': {
        g.fillStyle = 'rgba(0,0,0,0.28)'; ART.ell(g, x + 2, y + 1, 13, 5);
        const bc = [['#a05a3e', '#7e4430', '#643424'], ['#9a6a4e', '#7a523a', '#5e3e2c'], ['#8a8278', '#6e665c', '#58524a']][Math.floor(r() * 3)];
        const o = { hw: 12, hh: 6 };
        g.save(); g.translate(x, y);
        for (let k = 0; k < 6; k++) {
          const u = (r() - 0.5) * 0.9, v = (r() - 0.5) * 0.9, z = k > 3 ? 3 : 0;
          ART.box(g, u, v, u + 0.4, v + 0.2, z, z + 3, bc[0], bc[1], bc[2], o);
        }
        g.restore();
        break;
      }
      case 'can':
        g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x + 1.5, y + 1, 6, 2.6);
        g.save(); g.translate(x, y - 2.4); g.rotate(0.35 + r() * 0.3);
        { const cg = g.createLinearGradient(0, -2.6, 0, 2.6); cg.addColorStop(0, '#b0704a'); cg.addColorStop(0.4, '#d8a070'); cg.addColorStop(1, '#5a3220'); g.fillStyle = cg; }
        g.fillRect(-5, -2.6, 10, 5.2);
        g.fillStyle = '#4a2a18'; ART.ell(g, 5, 0, 1.3, 2.6); g.fillStyle = '#c89068'; ART.ell(g, -5, 0, 1.3, 2.6);
        g.fillStyle = 'rgba(80,140,160,0.6)'; g.fillRect(-2, -2.6, 3, 5.2);
        g.restore();
        break;
      case 'papers':
        for (i = 0; i < 4; i++) {
          const px = x + (r() - 0.5) * 18, py = y + (r() - 0.5) * 7, a = (r() - 0.5) * 1.2;
          g.save(); g.translate(px, py); g.transform(1, 0.5 * Math.cos(a), -1 * Math.sin(a), 0.5, 0, 0);
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-2.2, -3.2, 6, 7);
          g.fillStyle = i % 2 ? '#d8d0bc' : '#c8bea4'; g.fillRect(-3, -4, 6, 7);
          g.fillStyle = 'rgba(60,50,40,0.35)'; g.fillRect(-2, -2.5, 4, 0.6); g.fillRect(-2, -1, 3.4, 0.6); g.fillRect(-2, 0.5, 4, 0.6);
          g.restore();
        }
        break;
      case 'rebar': {
        g.fillStyle = 'rgba(0,0,0,0.28)'; ART.ell(g, x + 2, y + 1, 10, 4);
        g.save(); g.translate(x, y);
        ART.box(g, -0.3, -0.3, 0.35, 0.3, 0, 5, '#8a867e', '#6e6a62', '#56524c', { hw: 12, hh: 6 });
        g.restore();
        for (let k = 0; k < 4; k++) {
          const bx = x - 4 + k * 2.6, by = y - 4 - (k % 2), tx = bx + (r() - 0.5) * 10, ty = by - 8 - r() * 9;
          g.strokeStyle = '#5a2e1a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + (r() - 0.5) * 6, (by + ty) / 2, tx, ty); g.stroke();
          g.strokeStyle = 'rgba(255,190,150,0.3)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(bx - 0.4, by); g.lineTo(tx - 0.4, ty); g.stroke();
        }
        break;
      }
      case 'stump': {
        g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x + 2, y + 1, 11, 4.5);
        g.strokeStyle = '#3a2a1c'; g.lineWidth = 2.4;
        for (i = 0; i < 4; i++) { const a = i / 4 * 6.28 + r(); g.beginPath(); g.moveTo(x + Math.cos(a) * 4, y - 1 + Math.sin(a) * 2); g.quadraticCurveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 3.5, x + Math.cos(a) * 11, y + 1 + Math.sin(a) * 4.5); g.stroke(); }
        const sg = g.createLinearGradient(x - 6, 0, x + 6, 0); sg.addColorStop(0, '#7a5a3c'); sg.addColorStop(1, '#2e2016');
        g.fillStyle = sg; g.fillRect(x - 6, y - 10, 12, 10); ART.ell(g, x, y, 6, 2.8);
        g.fillStyle = '#b08a5c'; ART.ell(g, x, y - 10, 6, 2.8);
        g.strokeStyle = 'rgba(90,60,30,0.7)'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(x, y - 10, 3.6, 1.6, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(x, y - 10, 1.6, 0.7, 0, 0, 7); g.stroke();
        break;
      }
      case 'stalag': {
        g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x + 2, y + 1, 9, 3.6);
        const hh = 12 + r() * 12;
        for (let k = 0; k < 2; k++) {
          const ox = k ? 6 : 0, h2 = k ? hh * 0.55 : hh;
          const cg = g.createLinearGradient(x + ox - 5, 0, x + ox + 5, 0); cg.addColorStop(0, '#8a8074'); cg.addColorStop(1, '#3a342e');
          g.fillStyle = cg; g.beginPath(); g.moveTo(x + ox - 5, y + (k ? 1 : 0)); g.quadraticCurveTo(x + ox - 2, y - h2 * 0.5, x + ox, y - h2); g.quadraticCurveTo(x + ox + 2, y - h2 * 0.5, x + ox + 5, y + (k ? 1 : 0)); g.closePath(); g.fill();
        }
        break;
      }
      case 'lamp': {
        g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x + 2, y + 1, 7, 3);
        g.fillStyle = '#3a3a3c'; g.fillRect(x - 3, y - 3, 6, 3);
        const lg = g.createLinearGradient(x - 1.5, 0, x + 1.5, 0); lg.addColorStop(0, '#6a6c70'); lg.addColorStop(1, '#2a2b2e');
        g.fillStyle = lg; g.fillRect(x - 1.3, y - 46, 2.6, 44);
        ART.line(g, x, y - 45, x + 9, y - 47, 1.6, '#4a4b4e');
        g.fillStyle = '#2a2b2e'; g.beginPath(); g.moveTo(x + 5, y - 47); g.lineTo(x + 15, y - 47); g.lineTo(x + 13, y - 43); g.lineTo(x + 7, y - 43); g.closePath(); g.fill();
        g.fillStyle = '#ffe0a0'; g.fillRect(x + 8, y - 43, 4, 1.2);
        ART.line(g, x - 0.6, y - 40, x - 0.6, y - 6, 0.5, 'rgba(255,255,255,0.25)');
        break;
      }
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
    const k = inset || 0, hh = hT(x, y) * LH;
    const a = iso(x + k, y + k), b = iso(x + 1 - k, y + k), c = iso(x + 1 - k, y + 1 - k), d = iso(x + k, y + 1 - k);
    g.beginPath(); g.moveTo(a[0], a[1] - hh); g.lineTo(b[0], b[1] - hh); g.lineTo(c[0], c[1] - hh); g.lineTo(d[0], d[1] - hh); g.closePath();
  }
  /* Спрайт поднятой клетки: верх из текстуры земли и обрывы */
  let elev = {};
  function elevSprite(x, y, h) {
    const B = DW.BT.get();
    const key = y * B.w + x;
    if (elev[key]) return elev[key];
    const hp = h * LH;
    const c = canvas(2 * HW * GS, (2 * HH + hp) * GS);
    const g = c.getContext('2d');
    g.scale(GS, GS);
    const W = [0, HH], N = [HW, 0], E = [2 * HW, HH], S = [HW, 2 * HH];
    const r = U.srng(key * 13 + 1);
    rockFace(g, W, S, hp, r, 1, true);
    rockFace(g, S, E, hp, r, 0.62, true);
    g.save();
    g.beginPath(); g.moveTo(N[0], N[1]); g.lineTo(E[0], E[1]); g.lineTo(S[0], S[1]); g.lineTo(W[0], W[1]); g.closePath(); g.clip();
    g.drawImage(gIso, ((x - y) * HW - HW + B.h * HW) * GS, (x + y) * HH * GS, 2 * HW * GS, 2 * HH * GS, 0, 0, 2 * HW, 2 * HH);
    g.fillStyle = 'rgba(255,240,210,' + (0.05 * h) + ')'; g.fillRect(0, 0, 2 * HW, 2 * HH);
    g.restore();
    g.strokeStyle = 'rgba(255,230,190,0.3)'; g.lineWidth = 1.2;
    g.beginPath();
    if (hT(x, y + 1) < h) { g.moveTo(W[0], W[1]); g.lineTo(S[0], S[1]); }
    if (hT(x + 1, y) < h) { g.moveTo(S[0], S[1]); g.lineTo(E[0], E[1]); }
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    if (hT(x - 1, y) < h) { g.moveTo(W[0], W[1]); g.lineTo(N[0], N[1]); }
    if (hT(x, y - 1) < h) { g.moveTo(N[0], N[1]); g.lineTo(E[0], E[1]); }
    g.stroke();
    elev[key] = c;
    return c;
  }
  function elevBlockPath(g, x, y, h) {
    const hp = h * LH;
    const n = iso(x, y), e = iso(x + 1, y), s2 = iso(x + 1, y + 1), w = iso(x, y + 1);
    g.beginPath(); g.moveTo(w[0], w[1] - hp); g.lineTo(n[0], n[1] - hp); g.lineTo(e[0], e[1] - hp); g.lineTo(e[0], e[1]); g.lineTo(s2[0], s2[1]); g.lineTo(w[0], w[1]); g.closePath();
  }

  let reachC = null, reachSrc = null, reachM = '';
  /* Мягкая круглая частица заданного цвета (кэш) */
  const softCache = {}; let softN = 0;
  function softSpr(col) {
    let c = softCache[col];
    if (c) return c;
    if (softN > 220) { for (const k in softCache) delete softCache[k]; softN = 0; }
    c = canvas(32, 32);
    const g = c.getContext('2d');
    const m = /rgba?\(([^)]+)\)/.exec(col);
    let base = col, a = 1;
    if (m) { const pp = m[1].split(','); base = 'rgb(' + pp[0] + ',' + pp[1] + ',' + pp[2] + ')'; a = pp.length > 3 ? parseFloat(pp[3]) : 1; }
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.globalAlpha = a;
    gr.addColorStop(0, base); gr.addColorStop(0.45, base); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    if (!m) { g.globalCompositeOperation = 'destination-in'; const g2 = g.createRadialGradient(16, 16, 0, 16, 16, 16); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0.9)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = g2; g.fillRect(0, 0, 32, 32); }
    softCache[col] = c; softN++;
    return c;
  }
  /* ---------- Мир вокруг поля боя: небо, горизонт, дальние горы и руины ---------- */
  const SKYC = {
    day: ['#8a9aa6', '#b8b0a0', '#d8c4a0'], dawn: ['#3a3a5a', '#9a6a7a', '#f0a080'], dusk: ['#2a1a2a', '#8a3a30', '#f08a40'],
    night: ['#05070f', '#0e1424', '#22283a'], cave: ['#0a0807', '#14100d', '#1e1814'], interior: ['#0c0d10', '#16181c', '#20232a']
  };
  const PLAIN = { day: ['#9a8a70', '#4a3e30'], dawn: ['#8a6a60', '#2e2420'], dusk: ['#8a5a3a', '#241812'], night: ['#1e2230', '#07080c'], cave: ['#14100c', '#050403'], interior: ['#16181c', '#060708'] };
  let silh = null, silhSeed = -1;
  function buildSilh(seed) {
    const r = U.srng(seed * 7 + 3);
    const mk = function (period, n, h0, h1, ruins) {
      const pts = [];
      let x = 0;
      while (x < period) {
        if (ruins && r() < 0.42) {
          const bw = 18 + r() * 46, bh = h0 + r() * (h1 - h0) * 1.6;
          pts.push([x, 0]); pts.push([x, bh]);
          const k = r();
          if (k < 0.3) { pts.push([x + bw * 0.3, bh + 6 + r() * 10]); pts.push([x + bw * 0.45, bh - 4]); }
          else if (k < 0.5) { pts.push([x + bw * 0.5, bh]); pts.push([x + bw * 0.5, bh + 26 + r() * 30]); pts.push([x + bw * 0.55, bh + 26]); pts.push([x + bw * 0.55, bh]); }
          pts.push([x + bw, bh * (0.55 + r() * 0.4)]); pts.push([x + bw, 0]);
          x += bw + 4 + r() * 20;
        } else {
          pts.push([x, h0 + r() * (h1 - h0)]);
          x += period / n * (0.5 + r());
        }
      }
      pts.push([period, pts[0][1]]);
      return pts;
    };
    return {
      far: { pts: mk(1800, 26, 30, 95, false), par: 0.12, sc: 1 },
      city: { pts: mk(1500, 30, 10, 38, true), par: 0.22, sc: 1 },
      near: { pts: mk(1300, 22, 6, 26, false), par: 0.34, sc: 1 },
      stars: (function () { const a = []; for (let i = 0; i < 90; i++) a.push([r(), r(), 0.3 + r() * 0.7, r() * 6]); return a; })()
    };
  }
  let backC = null, backKey = '', backT = -1e9;
  function backdropCached(g, W, H, B, t) {
    const sc = 0.5, bw = Math.ceil(W * sc), bh = Math.ceil(H * sc);
    const key = Math.round(TR.cam.x) + '|' + Math.round(TR.cam.y) + '|' + TR.cam.z.toFixed(3) + '|' + W + 'x' + H + '|' + B.tod + B.weather + B.seed;
    if (!backC || backC.width !== bw || backC.height !== bh) { backC = canvas(bw, bh); backKey = ''; }
    if (key !== backKey || t - backT > (QL === 0 ? 1500 : 450) || t < backT) {
      const bg = backC.getContext('2d');
      bg.setTransform(sc, 0, 0, sc, 0, 0);
      drawBackdrop(bg, W, H, B, t);
      backKey = key; backT = t;
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(backC, 0, 0, W, H);
  }
  function drawBackdrop(g, W, H, B, t) {
    const tod = B.tod || 'day';
    if (silhSeed !== B.seed) { silh = buildSilh(B.seed || 1); silhSeed = B.seed; }
    const z = TR.cam.z;
    const hy = H / 2 + (-40 - TR.cam.y) * z * 0.35;
    const sk = SKYC[tod] || SKYC.day, pl = PLAIN[tod] || PLAIN.day;
    const indoor = tod === 'cave' || tod === 'interior';
    // небо
    let gr = g.createLinearGradient(0, Math.min(0, hy - H), 0, Math.max(1, hy));
    gr.addColorStop(0, sk[0]); gr.addColorStop(0.7, sk[1]); gr.addColorStop(1, sk[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, Math.max(0, hy) + 2);
    if (B.weather === 'dust') { g.fillStyle = 'rgba(150,104,60,0.35)'; g.fillRect(0, 0, W, Math.max(0, hy)); }
    if (B.weather === 'rain' || B.weather === 'ash') { g.fillStyle = 'rgba(40,44,50,0.35)'; g.fillRect(0, 0, W, Math.max(0, hy)); }
    if (tod === 'night') silh.stars.forEach(function (s2) { g.fillStyle = 'rgba(230,235,255,' + (s2[2] * (0.6 + 0.4 * Math.sin(t / 700 + s2[3]))) + ')'; g.fillRect(s2[0] * W, s2[1] * Math.max(0, hy) * 0.95, 1.5, 1.5); });
    // светило
    if (!indoor && hy > 0) {
      const sx2 = W * ({ dawn: 0.2, dusk: 0.78, day: 0.62, night: 0.3 }[tod] || 0.6) - TR.cam.x * z * 0.05;
      const sy2 = hy - ({ dawn: 18, dusk: 22, day: H * 0.35, night: H * 0.28 }[tod] || 30);
      const sr = Math.min(W, H) * (tod === 'night' ? 0.035 : 0.05);
      gr = g.createRadialGradient(sx2, sy2, sr * 0.5, sx2, sy2, sr * 9);
      const gc = tod === 'night' ? '190,205,255' : (tod === 'day' ? '255,245,220' : '255,170,100');
      gr.addColorStop(0, 'rgba(' + gc + ',0.55)'); gr.addColorStop(1, 'rgba(' + gc + ',0)');
      g.fillStyle = gr; g.fillRect(sx2 - sr * 9, sy2 - sr * 9, sr * 18, sr * 18);
      g.fillStyle = tod === 'night' ? '#e8ecf8' : (tod === 'day' ? 'rgba(255,250,235,0.9)' : '#ffd0a0');
      g.beginPath(); g.arc(sx2, sy2, sr, 0, 7); g.fill();
      if (tod === 'night') { g.fillStyle = 'rgba(160,170,200,0.4)'; g.beginPath(); g.arc(sx2 - sr * 0.3, sy2 - sr * 0.2, sr * 0.3, 0, 7); g.fill(); }
    }
    // облака
    if (!indoor && hy > 0 && QL > 0) {
      for (let i = 0; i < 5; i++) {
        const rr = U.srng(i * 17 + (B.seed || 1));
        const cx = ((rr() * 1.6 * W + t / 1000 * (4 + rr() * 6) - TR.cam.x * z * 0.08) % (W * 1.6)) - W * 0.3, cy = hy * (0.2 + rr() * 0.55);
        const cw = W * (0.12 + rr() * 0.16);
        gr = g.createRadialGradient(cx, cy, 2, cx, cy, cw);
        const cc = tod === 'night' ? '40,46,70' : (tod === 'dusk' ? '120,60,50' : (tod === 'dawn' ? '170,120,130' : '210,205,195'));
        gr.addColorStop(0, 'rgba(' + cc + ',0.35)'); gr.addColorStop(1, 'rgba(' + cc + ',0)');
        g.fillStyle = gr; g.save(); g.translate(cx, cy); g.scale(1, 0.32); g.translate(-cx, -cy); g.fillRect(cx - cw, cy - cw, cw * 2, cw * 2); g.restore();
      }
    }
    // равнина под горизонтом
    gr = g.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, pl[0]); gr.addColorStop(0.35, pl[1]); gr.addColorStop(1, '#050403');
    g.fillStyle = gr; g.fillRect(0, Math.max(0, hy), W, H - Math.max(0, hy));
    // силуэты: дальние горы, руины города, ближние холмы
    if (hy > -60) {
      const layer = function (L, col, k) {
        const scy = Math.pow(z, 0.4) * k;
        const ox = -TR.cam.x * z * L.par;
        const per = 1800 * scy;
        let start = (ox % per); if (start > 0) start -= per;
        g.fillStyle = col;
        for (let x0 = start; x0 < W; x0 += L.pts[L.pts.length - 1][0] * scy) {
          g.beginPath(); g.moveTo(x0, hy + 2);
          L.pts.forEach(function (p) { g.lineTo(x0 + p[0] * scy, hy - p[1] * scy); });
          g.lineTo(x0 + L.pts[L.pts.length - 1][0] * scy, hy + 2); g.closePath(); g.fill();
        }
      };
      const mix = indoor ? ['#080706', '#0c0a09', '#100d0b'] : (tod === 'night' ? ['#141a2a', '#0e121e', '#0a0d16'] : (tod === 'day' ? ['rgba(120,118,112,0.75)', 'rgba(90,84,76,0.85)', '#5a4e40'] : (tod === 'dawn' ? ['rgba(110,80,100,0.8)', 'rgba(70,50,62,0.9)', '#3a2a2e'] : ['rgba(110,60,50,0.8)', 'rgba(70,36,30,0.9)', '#2e1a14'])));
      layer(silh.far, mix[0], 1);
      layer(silh.city, mix[1], 1);
      layer(silh.near, mix[2], 1);
      // дымка у горизонта
      gr = g.createLinearGradient(0, hy - H * 0.12, 0, hy + H * 0.1);
      const hz2 = indoor ? '20,16,12' : (tod === 'night' ? '40,50,80' : (tod === 'day' ? '220,205,180' : (tod === 'dawn' ? '230,160,150' : '230,130,80')));
      gr.addColorStop(0, 'rgba(' + hz2 + ',0)'); gr.addColorStop(0.55, 'rgba(' + hz2 + ',' + (indoor ? 0.3 : 0.4) + ')'); gr.addColorStop(1, 'rgba(' + hz2 + ',0)');
      g.fillStyle = gr; g.fillRect(0, hy - H * 0.12, W, H * 0.22);
    }
    // пещера: своды со сталактитами
    if (indoor && hy > 0) {
      g.fillStyle = tod === 'cave' ? '#0a0806' : '#0e0f12';
      const r = U.srng(B.seed || 3);
      g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= W + 30; x += 18 + r() * 26) { const d = hy * (0.15 + r() * 0.35); g.lineTo(x, d * 0.5); g.lineTo(x + 6, d); g.lineTo(x + 12, d * 0.4); }
      g.lineTo(W, 0); g.closePath(); g.fill();
      if (tod === 'cave') for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * hy * 0.8, a = 0.3 + 0.3 * Math.sin(t / 900 + i); g.fillStyle = 'rgba(110,220,240,' + a + ')'; g.fillRect(x, y, 2, 2); }
    }
  }
  const FOGR = 4;
  let fogIso = null, reachIso = null, reachIsoSrc = null, reachIsoM = '';
  function isoLayer(c, B, sc) {
    const w = Math.ceil((B.w + B.h) * HW * sc), h = Math.ceil((B.w + B.h) * HH * sc);
    if (!c || c.width !== w || c.height !== h) c = canvas(w, h);
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
    g.setTransform(HW * sc, HH * sc, -HW * sc, HH * sc, B.h * HW * sc, 0);
    return c;
  }
  function projectFog(B) {
    fogIso = isoLayer(fogIso, B, 0.5);
    const g = fogIso.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(fogC, 0, 0, B.w, B.h);
  }
  function projectReach(B) {
    reachIso = isoLayer(reachIso, B, 1);
    const g = reachIso.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(reachC, 0, 0, B.w, B.h);
    reachIsoSrc = reachC; reachIsoM = reachM;
  }
  function buildFog(B, vis) {
    const W = B.w * FOGR, H = B.h * FOGR;
    const fg = fogC.getContext('2d');
    const img = fg.createImageData(W, H), d = img.data;
    const val = function (x, y) {
      x = x < 0 ? 0 : (x >= B.w ? B.w - 1 : x); y = y < 0 ? 0 : (y >= B.h ? B.h - 1 : y);
      const i = y * B.w + x;
      return vis && vis[i] ? 0 : (B.explored[i] ? 0.5 : 1);
    };
    const sd = (B.seed || 1) % 997;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = U.hash2(x, y, sd) - 0.5, ny = U.hash2(x, y, sd + 7) - 0.5;
      const fx = (x + 0.5) / FOGR - 0.5 + nx * 0.5, fy = (y + 0.5) / FOGR - 0.5 + ny * 0.5;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const v = (val(x0, y0) * (1 - tx) + val(x0 + 1, y0) * tx) * (1 - ty) + (val(x0, y0 + 1) * (1 - tx) + val(x0 + 1, y0 + 1) * tx) * ty;
      const k = (y * W + x) * 4;
      const mem = v > 0 && v <= 0.75;
      d[k] = mem ? 12 : 8; d[k + 1] = mem ? 14 : 7; d[k + 2] = mem ? 22 : 7;
      d[k + 3] = v <= 0.5 ? v * 2 * 128 : 128 + (v - 0.5) * 2 * 112;
    }
    fg.putImageData(img, 0, 0);
  }
  /* Атмосфера: цветокоррекция, дымка вдали, лучи света */
  const GRADE = { day: 'rgba(255,232,196,0.22)', dawn: 'rgba(255,176,150,0.26)', dusk: 'rgba(255,150,80,0.28)', night: 'rgba(70,100,200,0.3)', cave: 'rgba(80,150,160,0.2)', interior: 'rgba(150,165,200,0.18)' };
  const HAZE = { day: '235,215,185', dawn: '255,190,170', dusk: '255,170,110', night: '30,40,70', cave: '20,30,34', interior: '40,44,56' };
  function atmosphere(g, W, H, dpr, B, t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tod = B.tod;
    if (GRADE[tod] && tod === 'day') { g.globalCompositeOperation = 'soft-light'; g.fillStyle = GRADE[tod]; g.fillRect(0, 0, W, H); }
    const hz = HAZE[tod];
    if (hz) {
      const light = tod === 'day' || tod === 'dawn' || tod === 'dusk';
      g.globalCompositeOperation = light ? 'screen' : 'source-over';
      const gr = g.createLinearGradient(0, 0, 0, H * 0.4);
      gr.addColorStop(0, 'rgba(' + hz + ',' + (light ? 0.2 : 0.35) + ')'); gr.addColorStop(1, 'rgba(' + hz + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.4);
      if (light && QL >= 2 && B.weather !== 'rain' && B.weather !== 'dust') {
        g.globalCompositeOperation = 'lighter';
        const col = tod === 'day' ? '255,240,210' : (tod === 'dawn' ? '255,200,170' : '255,180,110');
        for (let k = 0; k < 4; k++) {
          const ph = t / 9000 + k * 1.7;
          const x0 = W * (-0.2 + k * 0.32 + Math.sin(ph) * 0.04), wd = W * (0.05 + (k % 2) * 0.05);
          const a = 0.05 + Math.sin(ph * 1.3) * 0.02;
          const bg = g.createLinearGradient(x0, 0, x0 + H * 0.6, H);
          bg.addColorStop(0, 'rgba(' + col + ',' + a + ')'); bg.addColorStop(1, 'rgba(' + col + ',0)');
          g.fillStyle = bg;
          g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + wd, 0); g.lineTo(x0 + wd + H * 0.7, H); g.lineTo(x0 + H * 0.7, H); g.closePath(); g.fill();
        }
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
  /* ---------- Главный рендер ---------- */
  TR.render = function (g, W, H, dpr) {
    const B = DW.BT.get();
    if (!B || !gIso) return;
    const t = now();
    const z = TR.cam.z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (QL === 0) { g.fillStyle = B.tod === 'night' || B.tod === 'cave' || B.tod === 'interior' ? '#0a0b10' : '#2a221c'; g.fillRect(0, 0, W, H); }
    else backdropCached(g, W, H, B, t);
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
    if (B.evac.length) {
      g.fillStyle = 'rgba(90,210,120,' + (0.16 + Math.sin(t / 500) * 0.05) + ')';
      B.evac.forEach(function (e) { g.fillRect(e[0] + 0.05, e[1] + 0.05, 0.9, 0.9); });
    }
    if (ov.reach) {
      const R = ov.reach;
      if (reachSrc !== R || reachM !== ov.m1 + '_' + ov.m2) {
        reachSrc = R; reachM = ov.m1 + '_' + ov.m2;
        reachC = reachC && reachC.width === B.w && reachC.height === B.h ? reachC : canvas(B.w, B.h);
        const rg = reachC.getContext('2d');
        const img = rg.createImageData(B.w, B.h), d = img.data;
        for (let i = 0; i < B.w * B.h; i++) {
          const c = R.cost[i];
          if (c === Infinity || R.occ[i] === 2 || (HG && HG[i] > 0)) continue;
          if (c <= ov.m1 + 0.01) { d[i * 4] = 80; d[i * 4 + 1] = 170; d[i * 4 + 2] = 255; d[i * 4 + 3] = 40; }
          else if (c <= ov.m2 + 0.01) { d[i * 4] = 255; d[i * 4 + 1] = 200; d[i * 4 + 2] = 60; d[i * 4 + 3] = 26; }
        }
        rg.putImageData(img, 0, 0);
        reachIsoSrc = null;
      }
      if (reachIsoSrc !== reachC || reachIsoM !== reachM) projectReach(B);
      screenT();
      g.drawImage(reachIso, -B.h * HW, 0, (B.w + B.h) * HW, (B.w + B.h) * HH);
      planeT();
    }
    if (BT_visVersion() !== fogV) {
      fogV = BT_visVersion();
      buildFog(B, vis);
      projectFog(B);
    }
    screenT();
    g.drawImage(fogIso, -B.h * HW, 0, (B.w + B.h) * HW, (B.w + B.h) * HH);

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
        const hh = HG ? HG[i] : 0;
        if (hh > 0) {
          const fc = isoF(x, y);
          g.drawImage(elevSprite(x, y, hh), fc[0] - HW, fc[1] - HH - hh * LH, 2 * HW, 2 * HH + hh * LH);
          if (ov.reach) {
            const cst = ov.reach.cost[i];
            if (cst !== Infinity && ov.reach.occ[i] !== 2 && cst <= ov.m2 + 0.01) {
              g.fillStyle = cst <= ov.m1 + 0.01 ? 'rgba(80,170,255,0.16)' : 'rgba(255,200,60,0.1)';
              diamond(g, x, y, 0); g.fill();
            }
          }
          const fa = vis && vis[i] ? 0 : (ex ? 0.49 : 0.92);
          if (fa) { g.fillStyle = 'rgba(9,8,7,' + fa + ')'; elevBlockPath(g, x, y, hh); g.fill(); }
        }
        if (ex) {
          if (corpsesAt[i]) corpsesAt[i].forEach(function (c) { drawCorpse(g, c, t); });
          if (props[i]) props[i].forEach(function (p) { drawProp(g, p, t); });
          if (itemsAt[i]) drawItem(g, itemsAt[i], t);
          const o = B.obj[i];
          if (o) {
            const sp = objSprite(o, maskAt(B, x, y, o), Math.floor(U.hash2(x, y, o) * 3), !(vis && vis[i]), B.objHp[i] < D.OBJ[o].hp * 0.5);
            let cut = false;
            if (D.OBJ[o].lift > 0.45 && o !== 15) {
              const behind = function (xx, yy) { const us2 = xx >= 0 && yy >= 0 ? unitsAt[yy * B.w + xx] : null; return us2 && us2.some(function (uu) { return uu.side === 'p' || uu === ov.target; }); };
              cut = behind(x - 1, y) || behind(x, y - 1) || behind(x - 1, y - 1);
            }
            if (cut) g.globalAlpha = 0.42;
            const sway = o === 5 ? Math.sin(t / 900 + x * 1.3 + y) * 0.035 : 0;
            if (o === 16) { const c0 = isoC(x, y); const k = 1 + Math.sin(t / 420 + x * 2 + y) * 0.05; g.save(); g.translate(c0[0], c0[1]); g.scale(1 + (k - 1) * 0.5, k); g.translate(-c0[0], -c0[1]); }
            if (sway) { const c0 = isoC(x, y); g.save(); g.translate(c0[0], c0[1]); g.transform(1, 0, sway, 1, 0, 0); g.translate(-c0[0], -c0[1]); }
            const c = isoC(x, y);
            g.drawImage(sp.c, c[0] - sp.ox, c[1] - sp.oy, sp.w, sp.h);
            if (cut) g.globalAlpha = 1;
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
            const fl = 0.85 + Math.sin(t / 70) * 0.08 + Math.sin(t / 37) * 0.07;
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha = 0.55 * fl; g.drawImage(softSpr('rgb(255,140,50)'), c[0] - 34, c[1] - 30, 68, 40);
            g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
            const tongues = [[-7, 0.75, 0], [-3.5, 1, 1.3], [0, 1.25, 2.1], [3.5, 0.95, 3.4], [6.5, 0.7, 4.6]];
            for (let pass = 0; pass < 3; pass++) {
              g.fillStyle = ['rgba(230,80,20,0.92)', 'rgba(255,170,50,0.9)', 'rgba(255,240,170,0.85)'][pass];
              const shrink = 1 - pass * 0.3;
              tongues.forEach(function (tg) {
                const h = (14 + Math.sin(t / 85 + tg[2]) * 4 + Math.sin(t / 53 + tg[2] * 2) * 2) * tg[1] * shrink;
                const x0 = c[0] + tg[0] * shrink, w = 3.6 * shrink;
                const sway = Math.sin(t / 110 + tg[2]) * 2.2;
                g.beginPath(); g.moveTo(x0 - w, c[1]); g.quadraticCurveTo(x0 - w * 0.6 + sway * 0.4, c[1] - h * 0.6, x0 + sway, c[1] - h);
                g.quadraticCurveTo(x0 + w * 0.6 + sway * 0.4, c[1] - h * 0.5, x0 + w, c[1]); g.closePath(); g.fill();
              });
            }
            if (Math.random() < 0.25) fx.parts.push({ x: c[0] + (Math.random() - 0.5) * 10, y: c[1], z: 8, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 4, vz: 30 + Math.random() * 30, t0: t, life: 1100 + Math.random() * 700, color: Math.random() < 0.5 ? '#ffc060' : '#ff8a30', size: 1.6, grav: -6 });
            if (Math.random() < 0.08) fx.parts.push({ x: c[0] + (Math.random() - 0.5) * 6, y: c[1], z: 22, vx: 6 + Math.random() * 6, vy: 0, vz: 12 + Math.random() * 8, t0: t, life: 2600, color: 'rgba(70,64,58,0.35)', size: 10 + Math.random() * 8, grav: -3 });
          });
        }
        const us = unitsAt[i];
        if (us) us.forEach(function (u) {
          drawUnit(g, u, t, ov.sel === u);
          if (u.side === 'p') {
            const o1 = BT_obj(B, x + 1, y), o2 = BT_obj(B, x, y + 1), o3 = BT_obj(B, x + 1, y + 1);
            const hu = hT(x, y);
            if ((o1 && D.OBJ[o1].lift > 0.45) || (o2 && D.OBJ[o2].lift > 0.45) || (o3 && D.OBJ[o3].lift > 0.55) || hT(x + 1, y) > hu || hT(x, y + 1) > hu || hT(x + 1, y + 1) > hu + 1) ghosts.push(u);
          }
        });
      }
    }
    ghosts.forEach(function (u) { drawUnit(g, u, t, false, 0.32); });
    drawCrows(g, t, false);
    applyLighting(g, W, H, dpr, B, t, vis);
    if (QL > 0 && !(TR.dbg && TR.dbg.noAtm)) atmosphere(g, W, H, dpr, B, t);
    drawWeather(g, W, H, dpr, B, t);
    screenT();
    if (QL > 0) drawMotes(g, t);

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
          const a = iso(x + n[2], y + n[3]), b = iso(x + n[4], y + n[5]), hh = hT(x, y) * LH;
          const pth = c === 2 ? lb : ly;
          pth.moveTo(a[0], a[1] - hh); pth.lineTo(b[0], b[1] - hh);
        }
      }
      // сетка внутри зоны
      const gb = new Path2D(), gy = new Path2D();
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const c = cat(x, y);
        if (!c) continue;
        const hh = hT(x, y) * LH;
        if (cat(x + 1, y) && hT(x + 1, y) === hT(x, y)) { const a = iso(x + 1, y), b = iso(x + 1, y + 1); const pth = c === 2 && cat(x + 1, y) === 2 ? gb : gy; pth.moveTo(a[0], a[1] - hh); pth.lineTo(b[0], b[1] - hh); }
        if (cat(x, y + 1) && hT(x, y + 1) === hT(x, y)) { const a = iso(x, y + 1), b = iso(x + 1, y + 1); const pth = c === 2 && cat(x, y + 1) === 2 ? gb : gy; pth.moveTo(a[0], a[1] - hh); pth.lineTo(b[0], b[1] - hh); }
      }
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(150,210,255,0.13)'; g.stroke(gb);
      g.strokeStyle = 'rgba(255,215,120,0.055)'; g.stroke(gy);
      g.lineCap = 'round';
      g.lineWidth = 7; g.strokeStyle = 'rgba(90,170,255,0.16)'; g.stroke(lb);
      g.strokeStyle = 'rgba(255,190,70,0.13)'; g.stroke(ly);
      g.lineWidth = 2; g.strokeStyle = 'rgba(130,205,255,0.95)'; g.stroke(lb);
      g.strokeStyle = 'rgba(255,212,95,0.9)'; g.stroke(ly);
      g.lineWidth = 1.2; g.setLineDash([3, 14]); g.lineDashOffset = -t / 45;
      g.strokeStyle = 'rgba(235,248,255,0.8)'; g.stroke(lb);
      g.strokeStyle = 'rgba(255,245,215,0.7)'; g.stroke(ly);
      g.setLineDash([]); g.lineDashOffset = 0;
    }
    // зоны вражеского дозора внутри зоны хода
    if (ov.owz) {
      const pz = new Path2D();
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        if (!ov.owz[y * B.w + x]) continue;
        const hh = hT(x, y) * LH;
        const a = iso(x + 0.08, y + 0.08), b = iso(x + 0.92, y + 0.08), c = iso(x + 0.92, y + 0.92), d = iso(x + 0.08, y + 0.92);
        pz.moveTo(a[0], a[1] - hh); pz.lineTo(b[0], b[1] - hh); pz.lineTo(c[0], c[1] - hh); pz.lineTo(d[0], d[1] - hh); pz.closePath();
      }
      g.fillStyle = 'rgba(255,70,50,' + (0.13 + Math.sin(t / 300) * 0.04) + ')'; g.fill(pz);
      g.strokeStyle = 'rgba(255,110,90,0.35)'; g.lineWidth = 1; g.stroke(pz);
    }
    // путь и предпросмотр
    if (ov.path && ov.sel) {
      const pts = [[ov.sel.x, ov.sel.y]].concat(ov.path);
      const pc = ov.pathDash ? '255,210,90' : '150,215,255';
      const pathP = function () { g.beginPath(); pts.forEach(function (p, i) { const c = isoC(p[0], p[1]); if (i) g.lineTo(c[0], c[1]); else g.moveTo(c[0], c[1]); }); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      pathP(); g.strokeStyle = 'rgba(' + pc + ',0.25)'; g.lineWidth = 8; g.stroke();
      pathP(); g.strokeStyle = 'rgba(' + pc + ',0.95)'; g.lineWidth = 2.6; g.setLineDash([7, 5]); g.lineDashOffset = -t / 40; g.stroke();
      g.setLineDash([]); g.lineDashOffset = 0;
      const dd = ov.path[ov.path.length - 1];
      if (dd) {
        const dc = isoC(dd[0], dd[1]);
        const pulse = 0.5 + Math.sin(t / 220) * 0.5;
        const bm = g.createLinearGradient(0, dc[1] - 60, 0, dc[1]);
        bm.addColorStop(0, 'rgba(' + pc + ',0)'); bm.addColorStop(1, 'rgba(' + pc + ',' + (0.22 + pulse * 0.1) + ')');
        g.fillStyle = bm; g.beginPath(); g.moveTo(dc[0] - 14, dc[1]); g.lineTo(dc[0] - 9, dc[1] - 60); g.lineTo(dc[0] + 9, dc[1] - 60); g.lineTo(dc[0] + 14, dc[1]); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(' + pc + ',' + (0.35 + pulse * 0.4) + ')'; g.lineWidth = 1.4; diamond(g, dd[0], dd[1], 0.02 - pulse * 0.06); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 2.4; diamond(g, dd[0], dd[1], 0.12); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill();
        (ov.shields || []).forEach(function (s) {
          const c = isoC(dd[0] + s.dx * 0.42, dd[1] + s.dy * 0.42);
          shield(g, c[0], c[1] - 16, s.c === 2, s.c === 2 ? '#5ab4ff' : '#9fd3ff');
        });
      }
    }
    (ov.seeMarks || []).forEach(function (m) {
      const c = uPos(m.u);
      const Y = c[1] - 62 * unitScale(m.u);
      g.fillStyle = m.flank ? '#ffd25a' : '#ff6b5b';
      ART.poly(g, [[c[0] - 6, Y - 8], [c[0] + 6, Y - 8], [c[0], Y]]);
    });
    if (ov.targets && ov.sel) {
      ov.targets.forEach(function (tg) {
        const c = uPos(tg.u);
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
      const c = uPos(a);
      g.strokeStyle = 'rgba(127,208,106,' + (0.6 + Math.sin(t / 180) * 0.3) + ')'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(c[0], c[1], 22, 11, 0, 0, Math.PI * 2); g.stroke();
    });
    if (ov.aoe && ov.sel) {
      const c = uPos(ov.sel);
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
      const c = uPos(u, true);
      const k = unitScale(u);
      const Y = c[1] - (u.type === 'queen' ? 92 : 62 * k);
      const showBar = u.side === 'e' || u.kind === 'turret' || ov.sel === u || u.hp < u.maxHp || (ov.allies && ov.allies.indexOf(u) >= 0);
      if (showBar) hpBar(g, u, c[0], Y);
      statusIcons(g, u, c[0], Y - 10);
      const cvl = coverLevel(u);
      if (cvl && !u.hunker) {
        const bw = showBar ? Math.min(70, u.maxHp * 5.4) / 2 + 12 : 0;
        shield(g, c[0] - bw - (showBar ? 2 : 0), showBar ? Y + 2 : Y + 2, cvl === 2, u.side === 'p' ? (cvl === 2 ? '#5ab4ff' : '#9fd3ff') : (cvl === 2 ? '#ff7a5a' : '#ffb09a'));
      }
      if (u.side === 'e' && !u.active) { g.fillStyle = '#cfc7b8'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('?', c[0] + 24, Y + 5); }
    });

    drawBarks(g, t);
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
        const a = 1 - kk;
        const gr = g.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r);
        gr.addColorStop(0, 'rgba(255,240,180,' + a + ')'); gr.addColorStop(0.4, 'rgba(255,170,60,' + (0.6 * a) + ')'); gr.addColorStop(1, 'rgba(255,80,0,0)');
        g.fillStyle = gr; ART.circ(g, f.x, f.y, f.r);
        if (f.muzzle && kk < 0.7) {
          // языки пламени по направлению ствола
          const d = f.dir || 1, L = f.r * (f.kind === 'long' ? 1.6 : (f.kind === 'wide' ? 1.1 : (f.kind === 'smg' ? 0.9 : 1.2)));
          const spread = f.kind === 'wide' ? 0.55 : (f.kind === 'long' ? 0.18 : 0.3);
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = 'rgba(255,215,130,' + (0.85 * a) + ')';
          for (let k = -1; k <= 1; k++) {
            const ang = (d > 0 ? 0 : Math.PI) + k * spread, ln = L * (k ? 0.6 : 1) * (0.8 + Math.random() * 0.4);
            g.beginPath(); g.moveTo(f.x + Math.cos(ang + 1.57) * 2.2, f.y + Math.sin(ang + 1.57) * 2.2);
            g.lineTo(f.x + Math.cos(ang) * ln, f.y + Math.sin(ang) * ln * 0.6);
            g.lineTo(f.x + Math.cos(ang - 1.57) * 2.2, f.y + Math.sin(ang - 1.57) * 2.2); g.closePath(); g.fill();
          }
          if (f.kind !== 'smg') { g.fillStyle = 'rgba(255,240,200,' + (0.6 * a) + ')'; for (let k = 0; k < 2; k++) { const ang = (d > 0 ? 0 : Math.PI) + (k ? 1.4 : -1.4); g.beginPath(); g.moveTo(f.x, f.y - 1); g.lineTo(f.x + Math.cos(ang) * L * 0.4, f.y + Math.sin(ang) * L * 0.3); g.lineTo(f.x, f.y + 1); g.fill(); } }
          g.globalCompositeOperation = 'source-over';
        }
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
      if (p.cas) { g.fillRect(p.x - 1.5, p.y - p.z - 0.6, 3, 1.3); g.fillStyle = 'rgba(255,250,220,0.6)'; g.fillRect(p.x - 1.2, p.y - p.z - 0.6, 1.4, 0.5); }
      else if (p.size >= 4.5) {
        const sz = p.size * (p.grav <= 0 ? 1.4 + kk * 1.1 : 1.25);
        g.drawImage(softSpr(p.color), p.x - sz / 2, p.y - p.z - sz / 2, sz, sz);
      }
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
      const pop = kk < 0.1 ? 1.7 - kk / 0.1 * 0.7 : 1;
      const Y = f.y - (kk < 0.1 ? 0 : (kk - 0.1) * 38);
      g.save(); g.translate(f.x, Y); g.scale(pop, pop);
      g.font = (f.big ? '900 19px' : 'bold 14px') + ' sans-serif'; g.textAlign = 'center';
      g.lineJoin = 'round'; g.lineWidth = f.big ? 5 : 3.8; g.strokeStyle = f.big ? 'rgba(70,10,0,0.95)' : 'rgba(0,0,0,0.85)'; g.strokeText(f.text, 0, 0);
      g.fillStyle = f.color; g.fillText(f.text, 0, 0);
      if (f.big) { g.fillStyle = 'rgba(255,255,220,0.55)'; g.fillText(f.text, 0, -1); }
      g.restore();
    });
    g.globalAlpha = 1;
    // атмосфера: виньетка
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!litVign && QL > 0) g.drawImage(TR.vignette(W, H, 0.5), 0, 0, W, H);
    litVign = false;
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
