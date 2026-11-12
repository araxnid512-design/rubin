'use strict';
/* Процедурная графика: все спрайты и иконки рисуются один раз при запуске */
(function () {
  const SS = 2, T = G.TILE, PI2 = 6.2831853;

  function mk(w, h, ax, ay, fn) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * SS); c.height = Math.ceil(h * SS);
    const x = c.getContext('2d'); x.scale(SS, SS); fn(x);
    return { c, w, h, ax, ay };
  }
  function shadow(x, cx, cy, rx, ry, a) {
    x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
    const g = x.createRadialGradient(0, 0, rx * 0.25, 0, 0, rx);
    g.addColorStop(0, 'rgba(8,18,10,' + a + ')'); g.addColorStop(1, 'rgba(8,18,10,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, rx, 0, PI2); x.fill(); x.restore();
  }
  function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, PI2); x.fill(); }
  function poly(x, pts) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); }
  function rr(x, px, py, w, h, r) {
    x.beginPath(); x.moveTo(px + r, py); x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r);
    x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r);
    x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py); x.closePath();
  }
  function line(x, a, b, c, d) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
  function lg(x, x0, y0, x1, y1, stops) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  }
  G.rr = rr;

  /* ---------- Деревья ---------- */
  function tier(x, cx, yb, hw, th, rng, pal) {
    const pts = [[cx, yb - th]], n = 9;
    for (let i = 1; i <= 4; i++) { const k = i / 4; pts.push([cx + hw * k * (0.88 + rng() * 0.2) + (i % 2 ? 4 : -3), yb - th + th * k * 0.9 + (i % 2 ? 0 : 4)]); }
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push([cx + hw - 2 * hw * k, yb + (i % 2 ? 9 + rng() * 6 : -3 + rng() * 3) + Math.sin(k * Math.PI) * 7]); }
    for (let i = 4; i >= 1; i--) { const k = i / 4; pts.push([cx - hw * k * (0.88 + rng() * 0.2) - (i % 2 ? 4 : -3), yb - th + th * k * 0.9 + (i % 2 ? 0 : 4)]); }
    poly(x, pts);
    x.fillStyle = lg(x, cx - hw, 0, cx + hw, 0, [0, pal[1], 0.5, pal[2], 1, '#0b1712']); x.fill();
    x.save(); x.clip(); x.lineCap = 'round';
    // хвоя: короткие мазки, расходящиеся от ствола
    for (let i = 0; i < 230; i++) {
      const py = yb + 12 - rng() * (th + 10), k = Math.max(0.05, (py - (yb - th)) / th), px = cx + (rng() * 2 - 1) * hw * Math.min(1.05, k + 0.1);
      const dx = (px - cx) / hw * 0.9, l = 6 + rng() * 7, lit = 0.52 - (px - cx) / hw * 0.5 + (rng() - 0.5) * 0.6 - (py > yb - 4 ? 0.3 : 0);
      x.strokeStyle = lit > 0.72 ? pal[0] : lit > 0.4 ? pal[1] : lit > 0.12 ? pal[2] : '#0d1a14';
      x.globalAlpha = 0.9; x.lineWidth = 1.5 + rng() * 1.1; line(x, px, py, px + dx * l, py + l * 0.8);
    }
    x.globalAlpha = 1;
    x.fillStyle = lg(x, 0, yb - th, 0, yb + 16, [0, 'rgba(225,235,200,.06)', 0.45, 'rgba(0,0,0,0)', 1, 'rgba(0,8,5,.6)']);
    x.fillRect(cx - hw - 8, yb - th - 6, hw * 2 + 16, th + 36);
    x.restore();
  }
  function pine(rng, pal) {
    return mk(140, 204, 70, 180, x => {
      shadow(x, 84, 182, 54, 18, 0.42);
      x.fillStyle = lg(x, 62, 0, 79, 0, [0, '#5a4028', 1, '#261a0f']);
      poly(x, [[62, 182], [65, 120], [75, 120], [79, 182], [70, 185]]); x.fill();
      const n = 4 + (rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) { const k = i / (n - 1); tier(x, 70, 160 - k * 104, 58 - k * 34, 60 - k * 12, rng, pal); }
    });
  }
  function leafy(rng, pal, birch) {
    return mk(156, 196, 78, 172, x => {
      shadow(x, 92, 174, 60, 20, 0.5);
      if (birch) {
        x.fillStyle = lg(x, 71, 0, 85, 0, [0, '#cfcabb', 1, '#8c8778']);
        poly(x, [[71, 174], [74, 90], [82, 90], [85, 174], [78, 177]]); x.fill();
        x.fillStyle = '#25211d';
        for (let i = 0; i < 11; i++) x.fillRect(72 + rng() * 8, 100 + rng() * 68, 3 + rng() * 4, 1.6);
      } else {
        x.fillStyle = lg(x, 68, 0, 90, 0, [0, '#5e4631', 1, '#291b10']);
        poly(x, [[66, 174], [72, 132], [70, 96], [86, 96], [85, 132], [91, 174], [78, 178]]); x.fill();
        x.strokeStyle = 'rgba(15,9,4,.5)'; x.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) { const px = 71 + rng() * 14; line(x, px, 120 + rng() * 20, px + 1, 150 + rng() * 20); }
      }
      const bl = [[78, 70, 34]];
      for (let i = 0; i < 10; i++) { const a = rng() * PI2, d = 14 + rng() * 24; bl.push([78 + Math.cos(a) * d * 1.3, 70 + Math.sin(a) * d * 0.85, 17 + rng() * 12]); }
      x.fillStyle = pal[3]; for (const b of bl) circ(x, b[0] + 2, b[1] + 6, b[2]);
      // фактура листвы: сотни мелких мазков, освещение сверху-слева
      for (let i = 0; i < 700; i++) {
        const b = bl[(rng() * bl.length) | 0], a = rng() * PI2, d = Math.sqrt(rng()) * b[2];
        const px = b[0] + Math.cos(a) * d, py = b[1] + Math.sin(a) * d;
        const lit = Math.max(0, Math.min(0.999, 0.5 - ((px - 78) / 90 + (py - 70) / 70) * 0.9 + (rng() - 0.5) * 0.55));
        x.fillStyle = pal[2 - Math.floor(lit * 3)]; x.globalAlpha = 0.86;
        x.beginPath(); x.ellipse(px, py, 2.4 + rng() * 3.4, 1.7 + rng() * 2.4, rng() * 3, 0, PI2); x.fill();
      }
      x.globalAlpha = 1;
    });
  }
  function deadTree(rng) {
    return mk(156, 196, 78, 172, x => {
      shadow(x, 88, 174, 40, 13, 0.42);
      x.lineCap = 'round';
      const br = (px, py, a, l, w, c) => {
        if (l < 9) return;
        const ex = px + Math.cos(a) * l, ey = py + Math.sin(a) * l;
        x.strokeStyle = c; x.lineWidth = w; line(x, px, py, ex, ey);
        br(ex, ey, a - 0.3 - rng() * 0.45, l * 0.68, w * 0.62, c); br(ex, ey, a + 0.25 + rng() * 0.45, l * 0.7, w * 0.62, c);
      };
      br(78, 174, -1.57, 60, 11, '#2c241c');
      x.strokeStyle = 'rgba(150,135,110,.35)'; x.lineWidth = 2; line(x, 75, 170, 75, 120);
    });
  }
  function car(rng, col) {
    return mk(150, 100, 75, 70, x => {
      shadow(x, 80, 76, 74, 20, 0.55);
      x.fillStyle = '#131416'; for (const wx of [34, 114]) { rr(x, wx - 10, 62, 20, 17, 5); x.fill(); }
      x.fillStyle = lg(x, 0, 46, 0, 76, [0, col[1], 1, col[2]]); rr(x, 10, 46, 130, 28, 7); x.fill();
      x.fillStyle = lg(x, 10, 20, 140, 54, [0, col[0], 1, col[1]]); rr(x, 10, 22, 130, 32, 9); x.fill();
      x.fillStyle = '#14191c'; rr(x, 44, 15, 62, 36, 7); x.fill();
      x.fillStyle = lg(x, 52, 18, 98, 42, [0, col[0], 1, col[1]]); rr(x, 52, 19, 46, 23, 4); x.fill();
      x.strokeStyle = 'rgba(190,210,220,.3)'; x.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) line(x, 102, 30, 100 + rng() * 6, 18 + rng() * 30);
      for (let i = 0; i < 22; i++) {
        x.fillStyle = 'rgba(' + (95 + rng() * 40 | 0) + ',' + (44 + rng() * 16 | 0) + ',18,' + (0.3 + rng() * 0.4) + ')';
        x.beginPath(); x.ellipse(12 + rng() * 126, 24 + rng() * 48, 2 + rng() * 7, 1.5 + rng() * 4, rng() * 3, 0, PI2); x.fill();
      }
      x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1; line(x, 60, 52, 60, 72); line(x, 94, 52, 94, 72); line(x, 10, 54, 140, 54);
      x.fillStyle = '#b9b394'; x.fillRect(135, 56, 5, 6); x.fillStyle = '#4a1612'; x.fillRect(10, 56, 4, 6);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(14, 70, 122, 4);
    });
  }
  function stump() {
    return mk(60, 44, 30, 30, x => {
      shadow(x, 34, 32, 24, 9, 0.35);
      x.fillStyle = lg(x, 18, 0, 42, 0, [0, '#76502f', 1, '#3d2716']);
      poly(x, [[17, 32], [19, 20], [41, 20], [43, 32], [30, 37]]); x.fill();
      x.fillStyle = '#c9a36b'; x.beginPath(); x.ellipse(30, 20, 11, 5, 0, 0, PI2); x.fill();
      x.strokeStyle = '#9a7646'; x.lineWidth = 1; x.beginPath(); x.ellipse(30, 20, 7, 3, 0, 0, PI2); x.stroke();
      x.beginPath(); x.ellipse(30, 20, 3, 1.3, 0, 0, PI2); x.stroke();
    });
  }

  /* ---------- Камни ---------- */
  function rock(rng, ore) {
    return mk(96, 84, 48, 62, x => {
      shadow(x, 54, 64, 44, 14, 0.4);
      const n = 9, base = [], top = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * PI2 + 0.2, rx = 28 + rng() * 9, ry = 13 + rng() * 5;
        base.push([48 + Math.cos(a) * rx, 52 + Math.sin(a) * ry]);
        top.push([48 + Math.cos(a) * rx * 0.66 + (rng() - 0.5) * 5, 27 + Math.sin(a) * ry * 0.72 + (rng() - 0.5) * 4]);
      }
      poly(x, base); x.fillStyle = '#4a4f57'; x.fill();
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, mx = (base[i][0] + base[j][0]) / 2 - 48;
        const sh = 0.5 - mx / 80 + (rng() - 0.5) * 0.12;
        const v = Math.round(70 + sh * 95);
        x.fillStyle = 'rgb(' + v + ',' + (v + 5) + ',' + (v + 12) + ')';
        poly(x, [base[i], base[j], top[j], top[i]]); x.fill();
      }
      poly(x, top); x.fillStyle = lg(x, 28, 14, 68, 40, [0, '#c9ced4', 1, '#8e959e']); x.fill();
      x.strokeStyle = 'rgba(30,34,40,.5)'; x.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const p = top[(rng() * n) | 0]; line(x, p[0], p[1], 48 + (rng() - 0.5) * 14, 27 + (rng() - 0.5) * 8); }
      x.fillStyle = 'rgba(96,140,70,.5)'; for (let i = 0; i < 5; i++) circ(x, 28 + rng() * 40, 54 + rng() * 6, 2 + rng() * 2.5);
      if (ore) {
        for (let i = 0; i < 9; i++) {
          const px = 26 + rng() * 44, py = 22 + rng() * 30, s = 3 + rng() * 4;
          x.fillStyle = i % 3 ? '#b4622a' : '#7c3d1c';
          poly(x, [[px, py - s], [px + s, py], [px + s * 0.3, py + s * 0.8], [px - s, py + s * 0.2]]); x.fill();
          x.fillStyle = '#ffd9a0'; x.fillRect(px - 0.5, py - s * 0.5, 1.6, 1.6);
        }
      }
    });
  }

  /* ---------- Растения и подбираемое ---------- */
  function bush(rng, berries) {
    return mk(72, 60, 36, 46, x => {
      shadow(x, 40, 48, 30, 10, 0.36);
      const bl = [];
      for (let i = 0; i < 7; i++) bl.push([36 + (rng() - 0.5) * 30, 32 + (rng() - 0.5) * 14, 11 + rng() * 6]);
      bl.sort((a, b) => a[1] - b[1]);
      x.fillStyle = '#18261a'; for (const b of bl) circ(x, b[0] + 2, b[1] + 5, b[2]);
      x.fillStyle = '#2f4429'; for (const b of bl) circ(x, b[0], b[1], b[2]);
      for (let i = 0; i < 120; i++) { const b = bl[(rng() * bl.length) | 0], a = rng() * PI2, d = Math.sqrt(rng()) * b[2]; x.fillStyle = ['#3d5631', '#4f6a3a', '#26381f'][(rng() * 3) | 0]; x.beginPath(); x.ellipse(b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d, 3, 1.8, rng() * 3, 0, PI2); x.fill(); }
      if (berries) for (let i = 0; i < 11; i++) {
        const px = 18 + rng() * 36, py = 24 + rng() * 20;
        x.fillStyle = '#4a0a12'; circ(x, px, py + 0.8, 2.9);
        x.fillStyle = '#a81c2c'; circ(x, px, py, 2.6);
        x.fillStyle = '#e08a94'; circ(x, px - 0.8, py - 0.8, 0.7);
      }
    });
  }
  function fiberPlant(rng) {
    return mk(56, 60, 28, 50, x => {
      shadow(x, 30, 51, 20, 7, 0.3);
      x.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const a = (rng() - 0.5) * 1.5, l = 24 + rng() * 20, bx = 28 + (rng() - 0.5) * 12;
        x.strokeStyle = ['#4a5a32', '#6b7741', '#8a8c55', '#33402a'][i & 3]; x.lineWidth = 2.6 - rng();
        x.beginPath(); x.moveTo(bx, 50); x.quadraticCurveTo(bx + Math.sin(a) * l * 0.4, 50 - l * 0.6, bx + Math.sin(a) * l, 50 - Math.cos(a) * l); x.stroke();
      }
      x.fillStyle = '#b5a97c'; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(16 + rng() * 24, 12 + rng() * 14, 2, 4.5, rng() - 0.5, 0, PI2); x.fill(); }
    });
  }
  function grassTuft(rng) {
    return mk(44, 40, 22, 34, x => {
      x.lineCap = 'round';
      for (let i = 0; i < 13; i++) {
        const a = (rng() - 0.5) * 1.7, l = 14 + rng() * 17, bx = 22 + (rng() - 0.5) * 12;
        x.strokeStyle = ['#2c3a22', '#465430', '#5f6a3a', '#7d7e48', '#232e1c'][(rng() * 5) | 0]; x.lineWidth = 2 - rng() * 0.8;
        x.beginPath(); x.moveTo(bx, 34); x.quadraticCurveTo(bx + Math.sin(a) * l * 0.35, 34 - l * 0.6, bx + Math.sin(a) * l, 34 - Math.cos(a) * l); x.stroke();
      }
    });
  }
  function sticks(rng) {
    return mk(56, 40, 28, 24, x => {
      shadow(x, 29, 26, 24, 8, 0.28);
      x.lineCap = 'round';
      const L = [[8, 28, 46, 16], [12, 14, 44, 30], [20, 30, 36, 10]];
      for (const l of L) {
        x.strokeStyle = '#4a321d'; x.lineWidth = 5; line(x, l[0], l[1] + 1, l[2], l[3] + 1);
        x.strokeStyle = '#96703f'; x.lineWidth = 3.4; line(x, l[0], l[1], l[2], l[3]);
        x.strokeStyle = '#c29a5f'; x.lineWidth = 1; line(x, l[0], l[1] - 1, l[2], l[3] - 1);
      }
    });
  }
  function pebbles(rng) {
    return mk(52, 38, 26, 24, x => {
      shadow(x, 27, 26, 22, 7, 0.3);
      for (const p of [[16, 24, 9, 6], [32, 26, 10, 6.5], [24, 16, 8, 5.5]]) {
        x.fillStyle = '#565c64'; x.beginPath(); x.ellipse(p[0], p[1] + 1.5, p[2], p[3], 0, 0, PI2); x.fill();
        x.fillStyle = lg(x, p[0] - p[2], p[1] - p[3], p[0] + p[2], p[1] + p[3], [0, '#cfd4d9', 1, '#7f868f']);
        x.beginPath(); x.ellipse(p[0], p[1], p[2], p[3], 0, 0, PI2); x.fill();
      }
    });
  }

  /* ---------- Коробки (ящик, сундук, верстак, кровать) ---------- */
  function box(x, x0, y0, w, d, h, top, front) {
    x.fillStyle = front; x.fillRect(x0, y0 + d - h, w, h);
    x.fillStyle = top; x.fillRect(x0, y0 - h, w, d);
  }
  function crate() {
    return mk(64, 64, 32, 46, x => {
      shadow(x, 35, 48, 30, 10, 0.4);
      box(x, 12, 26, 40, 24, 18, lg(x, 12, 8, 52, 32, [0, '#5c6644', 1, '#434b30']), lg(x, 0, 32, 0, 50, [0, '#363d27', 1, '#22271a']));
      x.strokeStyle = 'rgba(20,26,12,.55)'; x.lineWidth = 1.2; x.strokeRect(12.5, 8.5, 39, 23); x.strokeRect(12.5, 32.5, 39, 17);
      x.fillStyle = '#2a2f1c'; x.fillRect(20, 8, 4, 42); x.fillRect(40, 8, 4, 42);
      x.fillStyle = '#e8e2c8'; x.font = 'bold 8px sans-serif'; x.fillText('★', 28, 23);
      x.fillStyle = '#c9b458'; x.fillRect(30, 36, 4, 5);
    });
  }
  function chest() {
    return mk(T, 72, 0, 8, x => {
      shadow(x, 34, 60, 30, 9, 0.35);
      box(x, 9, 34, 46, 24, 22, lg(x, 9, 12, 55, 36, [0, '#a8743f', 1, '#7c5229']), lg(x, 0, 36, 0, 58, [0, '#6e4623', 1, '#4a2e16']));
      x.strokeStyle = 'rgba(30,16,6,.5)'; x.lineWidth = 1;
      for (let i = 1; i < 4; i++) line(x, 9, 12 + i * 6, 55, 12 + i * 6);
      x.fillStyle = '#3c4046'; x.fillRect(15, 12, 5, 46); x.fillRect(44, 12, 5, 46);
      x.fillStyle = '#8b939b'; x.fillRect(15, 12, 5, 2); x.fillRect(44, 12, 5, 2);
      x.fillStyle = '#d7b44a'; x.fillRect(29, 37, 6, 8); x.fillStyle = '#3a2a10'; x.fillRect(31, 40, 2, 3);
    });
  }
  function workbench() {
    return mk(T, 76, 0, 12, x => {
      shadow(x, 34, 64, 32, 9, 0.35);
      x.fillStyle = '#3d2a18'; x.fillRect(8, 44, 5, 20); x.fillRect(51, 44, 5, 20); x.fillRect(8, 54, 48, 4);
      box(x, 4, 40, 56, 30, 8, lg(x, 4, 32, 60, 62, [0, '#c59a62', 1, '#96703f']), '#6b4a27');
      x.strokeStyle = 'rgba(50,30,10,.4)'; x.lineWidth = 1; for (let i = 1; i < 4; i++) line(x, 4, 32 + i * 7.5, 60, 32 + i * 7.5);
      // пила
      x.fillStyle = '#b9c2c9'; poly(x, [[12, 36], [34, 38], [34, 44], [12, 42]]); x.fill();
      x.fillStyle = '#7a3b22'; x.fillRect(33, 36, 8, 10);
      // молоток
      x.strokeStyle = '#6e4b2a'; x.lineWidth = 2.5; line(x, 44, 56, 54, 42);
      x.fillStyle = '#5a6068'; x.fillRect(49, 37, 9, 6);
      // тиски
      x.fillStyle = '#4b5158'; x.fillRect(8, 48, 12, 8); x.fillStyle = '#868e96'; x.fillRect(8, 48, 12, 2);
    });
  }
  function bed() {
    return mk(T, 72, 0, 8, x => {
      box(x, 6, 26, 52, 44, 8, '#8a6238', '#573a1e');
      x.fillStyle = lg(x, 0, 30, 0, 62, [0, '#5d634a', 1, '#3c4130']); rr(x, 8, 30, 48, 31, 4); x.fill();
      x.strokeStyle = 'rgba(255,200,200,.25)'; x.lineWidth = 1; line(x, 8, 40, 56, 40); line(x, 8, 50, 56, 50);
      x.fillStyle = '#a8a290'; rr(x, 12, 19, 40, 12, 4); x.fill();
      x.fillStyle = 'rgba(0,0,0,.12)'; rr(x, 12, 27, 40, 4, 2); x.fill();
    });
  }
  function campfire() {
    return mk(T, T, 0, 0, x => {
      const g = x.createRadialGradient(32, 34, 4, 32, 34, 26);
      g.addColorStop(0, 'rgba(25,18,12,.9)'); g.addColorStop(0.7, 'rgba(40,30,20,.55)'); g.addColorStop(1, 'rgba(40,30,20,0)');
      x.fillStyle = g; circ(x, 32, 34, 26);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * PI2, px = 32 + Math.cos(a) * 20, py = 36 + Math.sin(a) * 13;
        x.fillStyle = '#4f545b'; x.beginPath(); x.ellipse(px, py + 2, 6.5, 4.5, 0, 0, PI2); x.fill();
        x.fillStyle = lg(x, px - 6, py - 5, px + 6, py + 4, [0, '#c5cad0', 1, '#7b828b']);
        x.beginPath(); x.ellipse(px, py, 6.5, 4.5, 0, 0, PI2); x.fill();
      }
      x.lineCap = 'round';
      for (const l of [[20, 40, 42, 30], [22, 30, 43, 40], [32, 42, 31, 27]]) {
        x.strokeStyle = '#2b1b10'; x.lineWidth = 6; line(x, l[0], l[1], l[2], l[3]);
        x.strokeStyle = '#6b4526'; x.lineWidth = 3.4; line(x, l[0], l[1] - 1, l[2], l[3] - 1);
      }
    });
  }

  /* ---------- Дом: пол, стена, дверь ---------- */
  const WH = 26;  // видимая высота стены
  G.WALL_H = WH;
  function floor(v) {
    return mk(T, T, 0, 0, x => {
      const rng = G.rng(77 + v * 13);
      for (let i = 0; i < 4; i++) {
        const b = 108 + rng() * 26;
        x.fillStyle = 'rgb(' + (b | 0) + ',' + ((b * 0.8) | 0) + ',' + ((b * 0.6) | 0) + ')';
        x.fillRect(0, i * 16, T, 16);
        x.fillStyle = 'rgba(60,35,12,.35)'; x.fillRect(0, i * 16 + 15, T, 1);
        const sx = ((i + v) % 2) ? 20 : 44; x.fillRect(sx, i * 16, 1, 16);
        x.fillStyle = 'rgba(255,235,190,.08)'; x.fillRect(0, i * 16, T, 1);
        x.fillStyle = 'rgba(70,40,15,.25)';
        for (let k = 0; k < 3; k++) x.fillRect(rng() * 56, i * 16 + 3 + rng() * 9, 5 + rng() * 9, 1);
        x.fillStyle = '#4c3018'; x.fillRect(sx - 4, i * 16 + 7, 2, 2); x.fillRect(sx + 3, i * 16 + 7, 2, 2);
      }
    });
  }
  function wall() {
    return mk(T, T + WH, 0, WH, x => {
      // фронт: два бревна
      for (let i = 0; i < 2; i++) {
        const y = T + i * (WH / 2);
        x.fillStyle = lg(x, 0, y, 0, y + WH / 2, [0, '#5e4326', 0.45, '#49321b', 1, '#22150a']); x.fillRect(0, y, T, WH / 2);
      }
      x.fillStyle = 'rgba(25,14,5,.5)'; for (let i = 0; i < 4; i++) x.fillRect(6 + i * 17, T + (i % 2) * 13 + 4, 9, 1);
      // верх: уложенные брёвна
      for (let i = 0; i < 4; i++) {
        const y = i * 16;
        x.fillStyle = lg(x, 0, y, 0, y + 16, [0, '#3a2816', 0.3, '#7a5a38', 0.55, '#62462a', 1, '#24170b']); x.fillRect(0, y, T, 16);
        x.fillStyle = 'rgba(30,16,6,.35)'; x.fillRect(((i * 29) % 40) + 6, y + 9, 12, 1); x.fillRect(((i * 17) % 30) + 30, y + 5, 8, 1);
      }
      x.fillStyle = 'rgba(255,225,170,.22)'; x.fillRect(0, 0, T, 1.5);
      x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, T - 2, T, 2);
    });
  }
  function door(open) {
    return mk(T, T + WH, 0, WH, x => {
      // косяки
      x.fillStyle = '#3a2614'; x.fillRect(0, 0, 8, T + WH); x.fillRect(T - 8, 0, 8, T + WH);
      x.fillStyle = '#62462a'; x.fillRect(0, 0, 8, T); x.fillRect(T - 8, 0, 8, T);
      x.fillStyle = 'rgba(255,230,180,.2)'; x.fillRect(0, 0, 8, 2); x.fillRect(T - 8, 0, 8, 2);
      if (!open) {
        x.fillStyle = lg(x, 0, 30, 0, T + WH, [0, '#7f6240', 1, '#553d24']); x.fillRect(8, 30, T - 16, T + WH - 30);
        x.fillStyle = 'rgba(50,28,10,.45)'; for (let i = 1; i < 4; i++) x.fillRect(8 + i * 12, 30, 1.2, T + WH - 30);
        x.fillStyle = '#3c4046'; x.fillRect(8, 40, T - 16, 4); x.fillRect(8, T + WH - 12, T - 16, 4);
        x.fillStyle = '#d7b44a'; circ(x, T - 15, 62, 2.6);
        x.fillStyle = '#8f6a3c'; x.fillRect(8, 24, T - 16, 6);
      } else {
        x.fillStyle = 'rgba(20,12,6,.35)'; x.fillRect(8, 0, T - 16, T);
        x.fillStyle = '#7e5a30'; x.fillRect(8, 4, 5, T + WH - 8);
      }
    });
  }

  /* ---------- Инструмент в руке (локальные координаты, +X — от кисти) ---------- */
  G.drawTool = function (x, id) {
    const iron = id.indexOf('iron') === 0 || id === 'machete';
    const metal = iron ? '#d3dbe1' : '#9aa0a7', metalD = iron ? '#7f8c96' : '#5f656d';
    x.lineCap = 'round';
    if (id === 'spear') {
      x.strokeStyle = '#6e4b2a'; x.lineWidth = 3.2; line(x, -14, 0, 31, 0);
      x.fillStyle = metal; poly(x, [[30, -4.5], [44, 0], [30, 4.5]]); x.fill();
      x.fillStyle = metalD; poly(x, [[30, 0], [44, 0], [30, 4.5]]); x.fill();
      x.strokeStyle = '#e0d2a8'; x.lineWidth = 1.6; line(x, 27, -2.5, 27, 2.5); line(x, 24.5, -2.5, 24.5, 2.5);
    } else if (id === 'machete') {
      x.strokeStyle = '#33241a'; x.lineWidth = 5; line(x, -3, 0, 6, 0);
      x.fillStyle = metal; poly(x, [[7, -3.5], [31, -5.5], [38, -1], [34, 3.5], [7, 3]]); x.fill();
      x.fillStyle = metalD; poly(x, [[7, 0.8], [36, 0.8], [34, 3.5], [7, 3]]); x.fill();
    } else {
      x.strokeStyle = '#3d2814'; x.lineWidth = 4.6; line(x, -6, 0, 22, 0);
      x.strokeStyle = '#8f6238'; x.lineWidth = 3; line(x, -6, 0, 22, 0);
      if (id.indexOf('hatchet') >= 0) {
        x.fillStyle = metal; poly(x, [[14, 2.5], [24, 2.5], [28, -13], [11, -11]]); x.fill();
        x.fillStyle = metalD; poly(x, [[14, 2.5], [24, 2.5], [25, -3], [13, -3]]); x.fill();
        x.strokeStyle = '#fff'; x.globalAlpha = 0.5; x.lineWidth = 1; line(x, 12, -11.5, 27.5, -13.5); x.globalAlpha = 1;
      } else {
        x.strokeStyle = metalD; x.lineWidth = 5.2; x.beginPath(); x.moveTo(15, -16); x.quadraticCurveTo(25, 0, 15, 16); x.stroke();
        x.strokeStyle = metal; x.lineWidth = 2.6; x.beginPath(); x.moveTo(15.5, -15); x.quadraticCurveTo(25, 0, 15.5, 15); x.stroke();
      }
    }
  };

  /* ---------- Иконки предметов (64x64) ---------- */
  function toolIcon(id) { return x => { x.translate(14, 50); x.rotate(-0.785); x.scale(1.45, 1.45); x.translate(2, 0); G.drawTool(x, id); }; }
  function logShape(x, cx, cy, len, r, c1, c2, end) {
    x.fillStyle = lg(x, 0, cy - r, 0, cy + r, [0, c1, 1, c2]); rr(x, cx - len / 2, cy - r, len, r * 2, r); x.fill();
    x.fillStyle = end; x.beginPath(); x.ellipse(cx + len / 2 - r * 0.7, cy, r * 0.7, r, 0, 0, PI2); x.fill();
    x.strokeStyle = 'rgba(90,60,25,.6)'; x.lineWidth = 1; x.beginPath(); x.ellipse(cx + len / 2 - r * 0.7, cy, r * 0.35, r * 0.5, 0, 0, PI2); x.stroke();
  }
  const ICON = {
    wood(x) { logShape(x, 30, 42, 48, 9, '#9a6c3d', '#55361b', '#d9b47c'); logShape(x, 34, 24, 48, 9, '#a87845', '#5e3d1f', '#e2bf88'); },
    stone(x) {
      for (const p of [[22, 40, 15, 11], [43, 42, 13, 10], [33, 24, 14, 11]]) {
        x.fillStyle = '#50565e'; x.beginPath(); x.ellipse(p[0], p[1] + 2, p[2], p[3], 0, 0, PI2); x.fill();
        x.fillStyle = lg(x, p[0] - p[2], p[1] - p[3], p[0] + p[2], p[1] + p[3], [0, '#d5dadf', 1, '#7a818a']);
        x.beginPath(); x.ellipse(p[0], p[1], p[2], p[3], 0, 0, PI2); x.fill();
      }
    },
    fiber(x) {
      x.lineCap = 'round';
      for (let i = 0; i < 9; i++) { x.strokeStyle = ['#5c9a44', '#86bd57', '#3f7a38'][i % 3]; x.lineWidth = 3; x.beginPath(); x.moveTo(32 + (i - 4) * 1.5, 54); x.quadraticCurveTo(32, 34, 14 + i * 4.5, 8 + (i % 3) * 3); x.stroke(); }
      x.fillStyle = '#c8a86a'; rr(x, 23, 36, 18, 7, 3); x.fill();
    },
    stick(x) {
      x.lineCap = 'round';
      for (const l of [[10, 50, 52, 14], [14, 16, 54, 46]]) { x.strokeStyle = '#4a321d'; x.lineWidth = 7; line(x, l[0], l[1], l[2], l[3]); x.strokeStyle = '#a57b47'; x.lineWidth = 4.4; line(x, l[0], l[1] - 1, l[2], l[3] - 1); }
    },
    ore(x) {
      x.fillStyle = '#4d535b'; poly(x, [[10, 44], [16, 22], [34, 12], [52, 24], [56, 44], [38, 54], [18, 52]]); x.fill();
      x.fillStyle = '#8d949c'; poly(x, [[16, 22], [34, 12], [52, 24], [36, 32]]); x.fill();
      x.fillStyle = '#6d747c'; poly(x, [[16, 22], [36, 32], [38, 54], [18, 52], [10, 44]]); x.fill();
      for (const p of [[24, 40], [40, 24], [44, 42], [28, 24]]) { x.fillStyle = '#c06a2c'; poly(x, [[p[0], p[1] - 5], [p[0] + 5, p[1]], [p[0], p[1] + 4], [p[0] - 5, p[1]]]); x.fill(); x.fillStyle = '#ffe0a8'; x.fillRect(p[0] - 1, p[1] - 2, 2, 2); }
    },
    bar(x) {
      x.fillStyle = '#6c7780'; poly(x, [[8, 44], [50, 44], [56, 34], [14, 34]]); x.fill();
      x.fillStyle = lg(x, 0, 22, 0, 36, [0, '#eef3f6', 1, '#aab5bd']); poly(x, [[14, 34], [56, 34], [50, 22], [20, 22]]); x.fill();
      x.fillStyle = '#8a959e'; poly(x, [[8, 44], [14, 34], [20, 22], [14, 30]]); x.fill();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(24, 25, 14, 2);
    },
    plank(x) {
      for (const p of [[8, 34], [12, 18]]) {
        x.fillStyle = lg(x, 0, p[1], 0, p[1] + 13, [0, '#d2a56a', 1, '#9c7341']); x.fillRect(p[0], p[1], 46, 13);
        x.fillStyle = '#6a4824'; x.fillRect(p[0], p[1] + 13, 46, 3);
        x.fillStyle = 'rgba(80,50,20,.4)'; x.fillRect(p[0] + 6, p[1] + 4, 18, 1); x.fillRect(p[0] + 22, p[1] + 8, 16, 1);
      }
    },
    rope(x) {
      for (let i = 0; i < 4; i++) { x.strokeStyle = i % 2 ? '#c9a769' : '#a58349'; x.lineWidth = 5; x.beginPath(); x.ellipse(32, 34, 20 - i * 4.4, 14 - i * 3, 0, 0, PI2); x.stroke(); }
      x.strokeStyle = '#a58349'; x.lineWidth = 4.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(50, 30); x.quadraticCurveTo(58, 16, 46, 10); x.stroke();
    },
    cloth(x) {
      x.fillStyle = '#b9ae96'; poly(x, [[10, 20], [50, 14], [56, 44], [16, 52]]); x.fill();
      x.fillStyle = '#d9cfb8'; poly(x, [[10, 20], [50, 14], [52, 28], [12, 34]]); x.fill();
      x.strokeStyle = 'rgba(90,80,60,.5)'; x.lineWidth = 1; for (let i = 0; i < 4; i++) line(x, 16 + i * 10, 22 - i, 20 + i * 10, 48 - i);
    },
    hide(x) {
      x.fillStyle = '#7a5230'; poly(x, [[14, 10], [26, 14], [38, 14], [50, 10], [48, 24], [56, 36], [46, 40], [48, 56], [36, 50], [28, 50], [16, 56], [18, 40], [8, 36], [16, 24]]); x.fill();
      x.fillStyle = '#9b6d42'; x.beginPath(); x.ellipse(32, 32, 12, 15, 0, 0, PI2); x.fill();
    },
    berries(x) {
      x.strokeStyle = '#3f7a38'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(32, 8); x.quadraticCurveTo(30, 20, 22, 28); x.moveTo(32, 8); x.quadraticCurveTo(36, 20, 42, 28); x.stroke();
      x.fillStyle = '#4e9a44'; x.beginPath(); x.ellipse(40, 12, 9, 4.5, -0.4, 0, PI2); x.fill();
      for (const p of [[22, 36], [42, 36], [32, 46]]) { x.fillStyle = '#7d0f1f'; circ(x, p[0], p[1] + 1.5, 10); x.fillStyle = '#e0263c'; circ(x, p[0], p[1], 9.5); x.fillStyle = '#ffb3bd'; circ(x, p[0] - 3, p[1] - 3, 2.6); }
    },
    meat_raw(x) { meat(x, '#d9475c', '#f08a98', '#a52a3e'); },
    meat_cooked(x) { meat(x, '#8a4b22', '#b5713a', '#5a2d12'); },
    canned(x) {
      x.fillStyle = '#868f97'; rr(x, 16, 12, 32, 42, 5); x.fill();
      x.fillStyle = '#c9d1d7'; x.beginPath(); x.ellipse(32, 14, 16, 5, 0, 0, PI2); x.fill();
      x.fillStyle = '#b3272f'; x.fillRect(16, 24, 32, 20); x.fillStyle = '#f0e6c8'; x.fillRect(22, 30, 20, 8);
      x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(19, 16, 4, 36);
    },
    flask_empty(x) { flask(x, false); },
    flask_full(x) { flask(x, true); },
    bandage(x) {
      x.fillStyle = '#cfc9b8'; rr(x, 10, 20, 44, 26, 12); x.fill();
      x.fillStyle = '#f4f0e4'; rr(x, 10, 18, 44, 24, 12); x.fill();
      x.fillStyle = '#ddd6c4'; x.beginPath(); x.ellipse(44, 30, 8, 11, 0, 0, PI2); x.fill();
      x.fillStyle = '#d22c3a'; x.fillRect(22, 27, 12, 4); x.fillRect(26, 23, 4, 12);
    },
    jacket(x) {
      x.fillStyle = '#6e4a2b'; poly(x, [[22, 10], [42, 10], [58, 22], [52, 34], [46, 30], [46, 56], [18, 56], [18, 30], [12, 34], [6, 22]]); x.fill();
      x.fillStyle = '#8f6540'; poly(x, [[22, 10], [32, 22], [42, 10], [46, 30], [46, 56], [32, 56], [32, 22]]); x.fill();
      x.fillStyle = '#d9c9a4'; poly(x, [[24, 10], [32, 20], [40, 10], [36, 8], [28, 8]]); x.fill();
      x.fillStyle = '#3b2716'; for (let i = 0; i < 3; i++) circ(x, 32, 30 + i * 9, 1.6);
    },
    ui_hand(x) {
      x.fillStyle = '#f0d9b5'; x.strokeStyle = '#3a2a1a'; x.lineWidth = 2;
      for (let i = 0; i < 4; i++) { rr(x, 16 + i * 8.5, 10 + Math.abs(i - 1.5) * 4, 7, 26, 3.5); x.fill(); x.stroke(); }
      rr(x, 15, 30, 34, 24, 8); x.fill(); x.stroke();
      x.save(); x.translate(15, 38); x.rotate(-0.7); rr(x, -8, -4, 14, 8, 4); x.fill(); x.stroke(); x.restore();
      x.fillRect(17, 31, 30, 6);
    },
    ui_drink(x) {
      x.fillStyle = lg(x, 0, 8, 0, 56, [0, '#8fe0ff', 1, '#2b86c9']);
      x.beginPath(); x.moveTo(32, 6); x.bezierCurveTo(48, 26, 52, 34, 52, 40); x.arc(32, 40, 20, 0, Math.PI); x.bezierCurveTo(12, 34, 16, 26, 32, 6); x.fill();
      x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(24, 40, 4, 8, 0.3, 0, PI2); x.fill();
    },
    ui_fist(x) {
      x.fillStyle = '#f0d9b5'; x.strokeStyle = '#3a2a1a'; x.lineWidth = 2;
      rr(x, 14, 22, 36, 28, 9); x.fill(); x.stroke();
      for (let i = 0; i < 4; i++) { rr(x, 14 + i * 9, 16, 9, 16, 4.5); x.fill(); x.stroke(); }
      rr(x, 10, 30, 16, 10, 5); x.fill(); x.stroke();
    }
  };
  function meat(x, c1, c2, c3) {
    x.strokeStyle = '#efe6d2'; x.lineWidth = 6; x.lineCap = 'round'; line(x, 40, 40, 54, 54);
    x.fillStyle = '#efe6d2'; circ(x, 52, 57, 4); circ(x, 57, 52, 4);
    x.fillStyle = c3; x.beginPath(); x.ellipse(28, 30, 22, 17, -0.6, 0, PI2); x.fill();
    x.fillStyle = c1; x.beginPath(); x.ellipse(27, 28, 21, 16, -0.6, 0, PI2); x.fill();
    x.fillStyle = c2; x.beginPath(); x.ellipse(24, 24, 10, 6, -0.6, 0, PI2); x.fill();
  }
  function flask(x, full) {
    x.fillStyle = '#5c3d22'; rr(x, 16, 18, 32, 38, 12); x.fill();
    x.fillStyle = lg(x, 16, 0, 48, 0, [0, '#a47444', 1, '#6e4a28']); rr(x, 16, 16, 32, 36, 12); x.fill();
    x.fillStyle = '#8a939b'; x.fillRect(26, 6, 12, 11); x.fillStyle = '#4b5158'; x.fillRect(24, 4, 16, 5);
    x.strokeStyle = '#3b2716'; x.lineWidth = 2; line(x, 16, 28, 48, 28); line(x, 16, 40, 48, 40);
    if (full) { x.fillStyle = '#58c1f2'; x.beginPath(); x.moveTo(32, 26); x.quadraticCurveTo(40, 36, 32, 42); x.quadraticCurveTo(24, 36, 32, 26); x.fill(); }
  }
  for (const id of ['hatchet', 'pickaxe', 'spear', 'iron_hatchet', 'iron_pickaxe', 'machete']) ICON[id] = toolIcon(id);

  function iconURL(fn) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d'); x.scale(1.5, 1.5);
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 3; x.shadowOffsetY = 2;
    fn(x); return c.toDataURL();
  }
  function spriteIcon(s, crop) {
    return x => {
      const k = Math.min(56 / s.w, 56 / (crop || s.h));
      x.drawImage(s.c, 32 - s.w * k / 2, 32 - (crop || s.h) * k / 2, s.w * k, s.h * k);
    };
  }

  /* ---------- Сборка атласа ---------- */
  G.initArt = function () {
    const r = G.rng(4242), S = G.SPR = {};
    const PINE = [['#3f5a44', '#2a4334', '#132620'], ['#47604a', '#2d4636', '#152a21'], ['#35504a', '#243d3a', '#10221f']];
    const OAK = [['#74874f', '#506537', '#33472a', '#17241a'], ['#687a48', '#465a33', '#2c3f27', '#141f17']];
    const BIRCH = [['#a39d55', '#7b7b3d', '#51582c', '#252b18'], ['#a8803f', '#80592a', '#573a1c', '#2a1c0e']];
    S.pine = PINE.map(p => pine(r, p));
    S.oak = [leafy(r, OAK[0]), leafy(r, OAK[1]), deadTree(r)];
    S.birch = [leafy(r, BIRCH[0], true), leafy(r, BIRCH[1], true), deadTree(r)];
    // силуэты для длинных теней от солнца
    for (const k of ['pine', 'oak', 'birch']) for (const sp of S[k]) {
      const c = document.createElement('canvas'); c.width = sp.c.width >> 1; c.height = sp.c.height >> 1;
      const x = c.getContext('2d'); x.drawImage(sp.c, 0, 0, c.width, c.height);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = '#060a06'; x.fillRect(0, 0, c.width, c.height);
      sp.sh = c;
    }
    S.stump = stump();
    S.rock = [rock(r), rock(r), rock(r)];
    S.ore = [rock(r, true), rock(r, true), rock(r, true)];
    S.bush = [bush(r, true), bush(r, true), bush(r, true)];
    S.bush0 = bush(r, false);
    S.fiber = [fiberPlant(r), fiberPlant(r), fiberPlant(r)];
    S.grass = [grassTuft(r), grassTuft(r), grassTuft(r)];
    S.stick = [sticks(r), sticks(r), sticks(r)];
    S.pebble = [pebbles(r), pebbles(r), pebbles(r)];
    S.crate = [crate(), crate(), crate()];
    S.car = [car(r, ['#7a8388', '#535b60', '#2e3336']), car(r, ['#7a5843', '#583b2b', '#2e1f18']), car(r, ['#5b6950', '#3e4a38', '#20281d'])];
    S.floor = [floor(0), floor(1)];
    S.wall = wall(); S.door = door(false); S.doorOpen = door(true);
    S.chest = chest(); S.workbench = workbench(); S.bed = bed(); S.campfire = campfire();

    const I = G.ICON = {};
    for (const id in ICON) I[id] = iconURL(ICON[id]);
    I.floor = iconURL(spriteIcon(S.floor[0]));
    I.wall = iconURL(spriteIcon(S.wall));
    I.door = iconURL(spriteIcon(S.door));
    I.chest = iconURL(spriteIcon(S.chest));
    I.workbench = iconURL(spriteIcon(S.workbench));
    I.campfire = iconURL(x => { spriteIcon(S.campfire)(x); x.fillStyle = '#ff8a1e'; x.beginPath(); x.moveTo(32, 8); x.quadraticCurveTo(46, 28, 32, 38); x.quadraticCurveTo(18, 28, 32, 8); x.fill(); x.fillStyle = '#ffe07a'; x.beginPath(); x.moveTo(32, 20); x.quadraticCurveTo(39, 30, 32, 36); x.quadraticCurveTo(25, 30, 32, 20); x.fill(); });
  };

  /* ---------- Персонажи (рисуются вектором каждый кадр) ---------- */
  /* Модель в рост: скелет из суставов (вперёд, вбок, высота) поворачивается по направлению взгляда
     и проецируется в тот же ракурс 3/4, что деревья и стены. Конечности — капсулы с обводкой. */
  const STYLE = {
    p: { skin: '#c9a27f', body: '#4a513b', body2: '#636b4f', arm: '#3f4533', leg: '#2b2e33', pack: '#33302a', hair: '#262019', boot: '#15130f', w: 1 },
    z: { skin: '#8a9482', body: '#3a3833', body2: '#4f4c45', arm: '#7d8776', leg: '#2a2a27', pack: null, hair: '#20221c', boot: '#171613', w: 1 },
    r: { skin: '#9c988c', body: '#522624', body2: '#6c3630', arm: '#8e8b7f', leg: '#25272a', pack: null, hair: '#1b1815', boot: '#171613', w: 0.92 },
    b: { skin: '#7f8a75', body: '#3e372d', body2: '#585040', arm: '#747e6b', leg: '#2a2824', pack: null, hair: '#272b21', boot: '#171613', w: 1.38 }
  };
  const OUT = 'rgba(0,0,0,.62)', DEPTH = 0.5;
  let fx = 1, fy = 0, rx = 0, ry = 1;
  const PX_ = (f, s) => f * fx + s * rx, PY_ = (f, s, z) => (f * fy + s * ry) * DEPTH - z;
  function limb(x, ax, ay, bx, by, mx, my, w, col, two) {
    x.strokeStyle = OUT; x.lineWidth = w + 2.2; x.beginPath(); x.moveTo(ax, ay); if (two) x.lineTo(mx, my); x.lineTo(bx, by); x.stroke();
    x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(ax, ay); if (two) x.lineTo(mx, my); x.lineTo(bx, by); x.stroke();
  }
  G.drawHuman = function (x, e, kind, tool, moving) {
    const st = STYLE[kind], zomb = kind !== 'p', W = st.w, p = e.walk, s = moving ? Math.sin(p) : 0, c = moving ? Math.cos(p) : 0;
    fx = Math.cos(e.face); fy = Math.sin(e.face); rx = -fy; ry = fx;
    const atk = e.atk > 0 ? Math.min(1, e.atk) : 0;
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.fillStyle = 'rgba(4,8,5,.42)'; x.beginPath(); x.ellipse(2, 1, 15 * W, 7.5 * W, 0, 0, PI2); x.fill();
    const bob = moving ? Math.abs(c) * 1.3 : Math.sin(G.time * 2.2 + e.x * 0.01) * 0.45;
    // наклон корпуса: зомби сутулятся, игрок подаётся вперёд при ударе и наклоняется при подборе
    let lean = zomb ? (kind === 'r' ? 7 : 4) : 0, drop = zomb ? 2 : 0, grab = 0, sw = 0;
    if (!zomb && atk) { if (tool) { sw = atk < 0.5 ? atk * 2 : 1; lean = sw * 3.5; } else { grab = Math.sin(atk * Math.PI); lean = grab * 7; drop = grab * 6; } }
    if (zomb && atk) lean += Math.sin(atk * Math.PI) * 5;
    const hipZ = 27 + bob - drop * 0.4, shZ = 44 + bob - drop, hw = 4.6 * W, sww = 8.6 * W;
    // --- ноги ---
    const leg = k => {  // k = -1 левая, 1 правая
      const ss = s * k, lift = Math.max(0, c * k) * 3.6, hx = PX_(0, k * hw), hy = PY_(0, k * hw, hipZ);
      const kx = PX_(ss * 4 + 2.2, k * hw), ky = PY_(ss * 4 + 2.2, k * hw, 14 + lift * 0.7), tx = PX_(ss * 8.5, k * hw * 1.05), ty = PY_(ss * 8.5, k * hw * 1.05, lift + 1.6);
      limb(x, hx, hy, tx, ty, kx, ky, 6 * W, st.leg, true);
      limb(x, tx, ty, tx + fx * 3.4, ty + fy * 3.4 * DEPTH, 0, 0, 5.4 * W, st.boot, false);
    };
    if (ry > 0) { leg(-1); leg(1); } else { leg(1); leg(-1); }
    // --- руки ---
    let rhx = 0, rhy = 0, ta = 0;
    const arm = k => {
      const sx = PX_(lean, k * sww), sy = PY_(lean, k * sww, shZ);
      let hf, hz, ef, ez, hs = k * (sww + 1.6);
      if (zomb) { const wv = Math.sin(p * 0.7 + k) * 2.2, lu = atk ? Math.sin(atk * Math.PI) * 8 : 0; hf = lean + 13 + wv + lu; hz = shZ - 5 + wv * k; ef = lean + 7; ez = shZ - 6; hs = k * sww * 0.8; }
      else if (k > 0 && sw) { const a = 2.25 - (sw * sw * (3 - 2 * sw)) * 2.7; ta = a; hf = lean + 4 + Math.cos(a) * 10.5; hz = shZ - 2 + Math.sin(a) * 12; ef = lean + 3 + Math.cos(a) * 5; ez = shZ - 3 + Math.sin(a) * 5; }
      else if (k > 0 && grab) { hf = lean + 4 + grab * 8; hz = shZ - 17 - grab * 12; ef = lean + 2 + grab * 3; ez = shZ - 9 - grab * 3; }
      else if (k > 0 && tool) { ta = 0.75 + s * 0.08; hf = 6; hz = shZ - 14; ef = 1.5; ez = shZ - 9; }
      else { hf = -s * k * 7 + 1; hz = shZ - 17 + Math.abs(s) * 1.5; ef = -s * k * 3 - 1; ez = shZ - 9; }
      const ex = PX_(ef, hs), ey = PY_(ef, hs, ez), hx = PX_(hf, hs), hy = PY_(hf, hs, hz);
      limb(x, sx, sy, hx, hy, ex, ey, 5.2 * W, st.arm, true);
      x.fillStyle = st.skin; x.strokeStyle = OUT; x.lineWidth = 1; circ(x, hx, hy, 2.9 * W); x.stroke();
      if (k > 0) { rhx = hx; rhy = hy; }
      if (k > 0 && tool) {
        const dx = fx * Math.cos(ta), dy = fy * DEPTH * Math.cos(ta) - Math.sin(ta);
        x.save(); x.translate(hx, hy); x.rotate(Math.atan2(dy, dx)); if (fx < -0.15) x.scale(1, -1); x.scale(0.9, 0.9); G.drawTool(x, tool); x.restore();
        x.lineCap = 'round';
      }
    };
    const torso = () => {
      const hx = PX_(0, 0), hy = PY_(0, 0, hipZ), nx = PX_(lean, 0), ny = PY_(lean, 0, shZ);
      limb(x, PX_(0, -hw), PY_(0, -hw, hipZ), PX_(0, hw), PY_(0, hw, hipZ), 0, 0, 8 * W, st.leg, false);
      limb(x, hx, hy - 4, nx, ny, 0, 0, 13.5 * W, st.body, false);
      limb(x, PX_(lean, -sww * 0.72), PY_(lean, -sww * 0.72, shZ), PX_(lean, sww * 0.72), PY_(lean, sww * 0.72, shZ), 0, 0, 8.5 * W, st.body, false);
      x.strokeStyle = st.body; x.lineWidth = 13.5 * W; x.beginPath(); x.moveTo(hx, hy - 4); x.lineTo(nx, ny); x.stroke();
      if (fy > -0.35) {  // грудь видна
        x.strokeStyle = st.body2; x.lineWidth = 6.5 * W; x.beginPath(); x.moveTo(hx + fx * 2.4, hy - 6 + fy * 1.2); x.lineTo(nx + fx * 2.4, ny + 2 + fy * 1.2); x.stroke();
        if (zomb) { x.fillStyle = 'rgba(100,14,12,.85)'; x.beginPath(); x.ellipse(hx + fx * 3 + rx * 2, (hy + ny) / 2 + fy * 1.5, 3.2 * W, 4 * W, 0.4, 0, PI2); x.fill(); }
        else { x.strokeStyle = 'rgba(14,15,11,.75)'; x.lineWidth = 1.8; line(x, hx + fx * 3 - rx * 3.4, hy - 6 + fy * 1.5 - ry * 1.7, nx + fx * 2 - rx * 4.6, ny + 1 + fy - ry * 2.3); line(x, hx + fx * 3 + rx * 3.4, hy - 6 + fy * 1.5 + ry * 1.7, nx + fx * 2 + rx * 4.6, ny + 1 + fy + ry * 2.3); }
      } else if (zomb) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(hx - 3, (hy + ny) / 2 - 2, 6, 2); }
      x.strokeStyle = 'rgba(12,12,10,.8)'; x.lineWidth = 2.2; line(x, PX_(0, -hw - 1.5), PY_(0, -hw - 1.5, hipZ + 3.5), PX_(0, hw + 1.5), PY_(0, hw + 1.5, hipZ + 3.5));
    };
    const pack = () => {
      if (!st.pack) return;
      const bf = lean * 0.6 - 6.5;
      limb(x, PX_(bf, 0), PY_(bf, 0, hipZ + 5), PX_(bf, 0), PY_(bf, 0, shZ - 2), 0, 0, 11.5, st.pack, false);
      x.strokeStyle = '#77715f'; x.lineWidth = 1.6; line(x, PX_(bf, -3), PY_(bf, -3, hipZ + 9), PX_(bf, 3), PY_(bf, 3, hipZ + 9));
      limb(x, PX_(bf, -6), PY_(bf, -6, shZ + 2.5), PX_(bf, 6), PY_(bf, 6, shZ + 2.5), 0, 0, 5, '#565c43', false);
    };
    const near = ry > 0 ? 1 : -1;
    if (fy < 0) { arm(-near); torso(); pack(); arm(near); }
    else { pack(); arm(-near); torso(); arm(near); }
    // --- голова ---
    const hl = lean + (zomb ? 4.5 : 1.2), cxh = PX_(hl, 0), cyh = PY_(hl, 0, shZ + 9.2 - (zomb ? 1.5 : 0)), hr = 6.3 * (W > 1.2 ? 1.12 : 1);
    limb(x, PX_(lean, 0), PY_(lean, 0, shZ + 1), cxh, cyh, 0, 0, 4.5, st.skin, false);
    x.strokeStyle = OUT; x.lineWidth = 1.2; x.fillStyle = st.hair; circ(x, cxh, cyh, hr + 0.5); x.stroke();
    const vis = Math.max(0, Math.min(1, (fy + 0.95) / 0.6));
    if (vis > 0.05) {
      const ox = fx * 2.7, oy = fy * 1.5 + 1.3;
      x.save(); x.beginPath(); x.arc(cxh, cyh, hr + 0.1, 0, PI2); x.clip();
      x.fillStyle = st.skin; circ(x, cxh + ox, cyh + oy, hr * 0.86 * (0.55 + vis * 0.45));
      if (fy > -0.25) {
        x.fillStyle = zomb ? '#e2dfc2' : '#1a1410';
        circ(x, cxh + ox * 1.25 - rx * 2.3, cyh + oy * 0.9 - ry * 1.1 - 0.6, zomb ? 1.15 : 0.85); circ(x, cxh + ox * 1.25 + rx * 2.3, cyh + oy * 0.9 + ry * 1.1 - 0.6, zomb ? 1.15 : 0.85);
        if (zomb) { x.fillStyle = 'rgba(100,14,12,.9)'; x.beginPath(); x.ellipse(cxh + ox * 1.3, cyh + oy + 2.8, 2, 1.5, 0, 0, PI2); x.fill(); }
        else { x.fillStyle = 'rgba(60,40,28,.55)'; x.fillRect(cxh + ox * 1.3 - 1.6, cyh + oy + 2.4, 3.2, 0.9); }
      }
      x.restore();
    }
    if (e.hurt > 0) { x.globalAlpha = Math.min(1, e.hurt * 4) * 0.5; x.strokeStyle = '#fff'; x.lineWidth = 14 * W; line(x, PX_(0, 0), PY_(0, 0, hipZ), cxh, cyh); x.globalAlpha = 1; }
    // след удара
    if (!zomb && tool && e.atk > 0.2 && e.atk < 0.78) {
      const al = 0.55 * (1 - Math.abs(e.atk - 0.5) * 3); if (al > 0) {
        const tip = a => [rhx + (fx * Math.cos(a)) * 30, rhy + (fy * DEPTH * Math.cos(a) - Math.sin(a)) * 30];
        const t0 = tip(ta + 1.5), t1 = tip(ta + 0.75), t2 = tip(ta);
        x.globalAlpha = al; x.strokeStyle = '#f2ede0'; x.lineWidth = 5; x.beginPath(); x.moveTo(t0[0], t0[1]); x.quadraticCurveTo(t1[0] * 2 - (t0[0] + t2[0]) / 2, t1[1] * 2 - (t0[1] + t2[1]) / 2, t2[0], t2[1]); x.stroke(); x.globalAlpha = 1;
      }
    }
  };
  G.drawDeer = function (x, e, moving) {
    const s = moving ? Math.sin(e.walk) : 0;
    fx = Math.cos(e.face); fy = Math.sin(e.face); rx = -fy; ry = fx;
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.fillStyle = 'rgba(4,8,5,.36)'; x.beginPath(); x.ellipse(2, 1, 20, 9, 0, 0, PI2); x.fill();
    const legd = (f, k, ph) => limb(x, PX_(f, k * 3.6), PY_(f, k * 3.6, 18), PX_(f + s * 6 * ph, k * 3.6), PY_(f + s * 6 * ph, k * 3.6, 0), PX_(f + s * 2 * ph + 1, k * 3.6), PY_(f + s * 2 * ph + 1, k * 3.6, 9), 3, '#4a3320', true);
    const far = ry > 0 ? -1 : 1;
    legd(9, far, 1); legd(-9, far, -1);
    const body = () => { limb(x, PX_(-10, 0), PY_(-10, 0, 21), PX_(10, 0), PY_(10, 0, 23), 0, 0, 13, '#7d5636', false); x.strokeStyle = '#9a7048'; x.lineWidth = 6; line(x, PX_(-8, 0), PY_(-8, 0, 24), PX_(8, 0), PY_(8, 0, 26)); x.fillStyle = '#ece4d0'; circ(x, PX_(-15, 0), PY_(-15, 0, 24), 2.6); };
    const head = () => {
      limb(x, PX_(11, 0), PY_(11, 0, 25), PX_(17, 0), PY_(17, 0, 35), 0, 0, 6, '#7d5636', false);
      limb(x, PX_(17, 0), PY_(17, 0, 36.5), PX_(23, 0), PY_(23, 0, 35), 0, 0, 6.2, '#8b6240', false);
      x.fillStyle = '#20150c'; circ(x, PX_(25.5, 0), PY_(25.5, 0, 34.6), 1.5);
      x.strokeStyle = '#ddd0b0'; x.lineWidth = 1.7;
      for (const k of [-1, 1]) { x.beginPath(); x.moveTo(PX_(17, k * 2), PY_(17, k * 2, 39)); x.lineTo(PX_(15, k * 6), PY_(15, k * 6, 49)); x.lineTo(PX_(19, k * 8), PY_(19, k * 8, 54)); x.moveTo(PX_(15, k * 6), PY_(15, k * 6, 49)); x.lineTo(PX_(11, k * 8), PY_(11, k * 8, 52)); x.stroke(); }
    };
    if (fy < 0) { head(); body(); } else { body(); head(); }
    legd(9, -far, -1); legd(-9, -far, 1);
    if (e.hurt > 0) { x.globalAlpha = Math.min(1, e.hurt * 4) * 0.5; x.strokeStyle = '#fff'; x.lineWidth = 13; line(x, PX_(-10, 0), PY_(-10, 0, 21), PX_(10, 0), PY_(10, 0, 23)); x.globalAlpha = 1; }
  };
})();
