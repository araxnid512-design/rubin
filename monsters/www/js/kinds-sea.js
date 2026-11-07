// =====================================================================
//  ОСТРОВ «ЛАГУНА»: 8 тропических певцов — 6 обычных и 2 элитных.
//  Песня острова — солнечное калипсо со стальными барабанами.
//  Рисуются так же, как монстры из monsters.js: ступни в (0, 0), рост около 100 единиц вверх.
// =====================================================================
(() => {
  const TAU = Math.PI * 2;
  // эллипс отдельным подпутём — без соединительной линии от предыдущей точки
  const ell = (p, x, y, rx, ry, rot = 0) => { p.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); p.ellipse(x, y, rx, ry, rot, 0, TAU); };
  const path = f => { const p = new Path2D(); f(p); return p; };
  // фигура из SHAPES, приподнятая над землёй на dy (для тех, кто стоит на хвосте)
  const lifted = (name, w, h, dy) => p => { const q = new Path2D(); SHAPES[name](q, w, h); p.addPath(q, new DOMMatrix().translate(0, -dy)); };
  // мелкие детали с общим контуром: сначала толстая обводка всех, потом заливка
  function parts(g, ps, fills, line, lw = 2.4) {
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = line; g.lineWidth = lw * 2;
    for (const p of ps) g.stroke(p);
    ps.forEach((p, i) => { g.fillStyle = Array.isArray(fills) ? fills[i] : fills; g.fill(p); });
  }
  // мягкая линия с контуром: щупальца, ножки, руки, пряди водорослей
  function rope(g, pts, col, out, w, sharp = false, ow = 5) {
    const tr = () => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i], [nx, ny] = pts[i + 1];
        if (sharp) g.lineTo(x, y); else g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
      }
      const L = pts[pts.length - 1]; g.lineTo(L[0], L[1]);
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    tr(); g.strokeStyle = out; g.lineWidth = w + ow; g.stroke();
    tr(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  // сияние элитных
  function glow(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.6, rgba(col, a * 0.45)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // четырёхлучевая искорка
  function sparkle(g, x, y, r, col) {
    g.fillStyle = col; g.strokeStyle = 'rgba(150,100,20,.55)'; g.lineWidth = 1.2; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x, y - r);
    g.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y); g.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
    g.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y); g.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
    g.fill(); g.stroke();
  }
  // цветок из n лепестков (гирлянда, украшения)
  function flower(g, x, y, r, col, rot = 0, n = 5, mid = '#ffb02a') {
    const p = new Path2D();
    for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; ell(p, x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52, r * 0.52, r * 0.4, a); }
    g.lineJoin = 'round'; g.strokeStyle = shade(col === '#ffffff' ? '#d8c8b0' : col, -0.5); g.lineWidth = Math.max(1.6, r * 0.34); g.stroke(p);
    g.fillStyle = col; g.fill(p);
    g.fillStyle = mid; g.beginPath(); g.arc(x, y, r * 0.26, 0, TAU); g.fill();
  }
  // гибискус: широкие лепестки, тёмная серединка и тычинка
  function hibiscus(g, x, y, r, col, rot = 0) {
    flower(g, x, y, r * 1.12, col, rot, 5, shade(col, -0.35));
    g.strokeStyle = '#ffe24a'; g.lineWidth = 2; g.lineCap = 'round';
    const a = rot - 0.9, ex = x + Math.cos(a) * r * 0.85, ey = y + Math.sin(a) * r * 0.85;
    g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    g.fillStyle = '#ffe24a'; for (const d of [-0.5, 0.5]) { g.beginPath(); g.arc(ex + Math.cos(a + d * 2) * 2.2, ey + Math.sin(a + d * 2) * 2.2, 1.7, 0, TAU); g.fill(); }
  }
  // пальмовый лист: изогнутая жилка и узкие свисающие листочки
  function frond(g, x, y, len, ang, droop, col) {
    const P = u => [x + Math.cos(ang) * len * u, y + Math.sin(ang) * len * u + droop * len * u * u];
    const dark = shade(col, -0.55), leaves = [];
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
      const u = 0.16 + i * 0.12, [px, py] = P(u), [qx, qy] = P(u + 0.02), m = Math.hypot(qx - px, qy - py) || 1, tx = (qx - px) / m, ty = (qy - py) / m;
      const nx = -ty * side, ny = tx * side, l = len * 0.44 * (1 - u * 0.55), ex = px + (nx * 0.8 + tx * 0.55) * l, ey = py + (ny * 0.8 + ty * 0.55) * l + l * 0.3;
      const mx = (px + ex) / 2, my = (py + ey) / 2, dx = (ey - py) * 0.2, dy = -(ex - px) * 0.2;
      leaves.push(path(q => { q.moveTo(px, py); q.quadraticCurveTo(mx + dx, my + dy, ex, ey); q.quadraticCurveTo(mx - dx, my - dy, px, py); q.closePath(); }));
    }
    const rib = path(q => { q.moveTo(x, y); for (let i = 1; i <= 10; i++) { const [a, b] = P(i / 10); q.lineTo(a, b); } });
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = dark;
    g.lineWidth = 6; g.stroke(rib); g.lineWidth = 4; for (const q of leaves) g.stroke(q);
    leaves.forEach((q, i) => { g.fillStyle = i % 2 ? col : shade(col, 0.1); g.fill(q); });
    g.strokeStyle = shade(col, -0.2); g.lineWidth = 2.4; g.stroke(rib);
  }

  Object.assign(KINDS, {
    // ---------- обычные (покупаются в магазине)
    krabik: {
      name: 'Крабик', el: ['stone'], part: 'claves', price: 800, rate: 34, need: 7,
      desc: 'Пляжный крабик на коротких ножках. Щёлкает клешнями, как деревянными клавесами.', col: '#f2683a',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6);
        const snap = Math.pow(Math.abs(Math.sin(t * 12)), 4) * s; // 1 — клешни сомкнулись: «клак!»
        const cl = [-1, 1].map(k => [k * 42, -60 - s * 6 + Math.sin(t * 2.4 + k) * 1.5]);
        // ножки и плечи клешней — за телом
        for (const k of [-1, 1]) for (let i = 0; i < 3; i++) {
          const sh = Math.sin(t * 9 + i * 2.1 + k) * s * 2.5;
          rope(g, [[k * (14 + i * 9), -20], [k * (30 + i * 8), -22 + i * 3], [k * (33 + i * 9) + sh, -1]], shade(c, -0.12), o, 5, true);
        }
        cl.forEach(([cx, cy], i) => { const k = i ? 1 : -1; rope(g, [[k * 30, -40], [k * 50, -44], [cx, cy + 6]], shade(c, -0.05), o, 7); });
        // панцирь и глаза на стебельках
        const stalks = [-1, 1].map(k => ({ path: p => p.roundRect(k * 15 - 3.5, -92, 7, 26, 3.5), fill: shade(c, 0.1) }));
        const body = p => { p.moveTo(-46, -32); p.bezierCurveTo(-48, -64, -24, -74, 0, -74); p.bezierCurveTo(24, -74, 48, -64, 46, -32); p.bezierCurveTo(45, -14, 26, -9, 0, -9); p.bezierCurveTo(-26, -9, -45, -14, -46, -32); p.closePath(); };
        silhouette(g, [...stalks, { path: body, fill: blobFill(g, c, 92, 66, -74) }], c, o);
        g.fillStyle = 'rgba(255,255,255,.25)'; for (const [x, y, r] of [[-26, -58, 5], [-14, -66, 3], [24, -60, 4.5], [33, -48, 3]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, TAU); g.fill(); }
        g.fillStyle = shade(c, 0.32); g.beginPath(); g.ellipse(0, -20, 26, 8, 0, 0, TAU); g.fill();
        eye(g, -15, -94, 10.5, st); eye(g, 15, -94, 10.5, st);
        mouth(g, 0, -46, 22, s * 0.6); cheeks(g, 0, -50, 26, 5.5);
        // клешни: щёлкают в такт
        cl.forEach(([cx, cy], i) => {
          const k = i ? 1 : -1, open = s > 0.05 ? 0.05 + 0.38 * (1 - snap) : 0.3;
          g.save(); g.translate(cx, cy); g.rotate(k * 0.22); g.scale(0.92, 0.92);
          const fing = side => { const q = new Path2D(); q.moveTo(side * 1.5, -4); q.lineTo(side * 14, -4); q.bezierCurveTo(side * 16.5, -18, side * 11.5, -31, side * 2.5, -31); q.quadraticCurveTo(side * 4.5, -16, side * 1.5, -4); q.closePath(); const p = new Path2D(); p.addPath(q, new DOMMatrix().translate(side * 7, -6).rotate(side * open * 57.3).translate(-side * 7, 6)); return p; };
          parts(g, [fing(-1), fing(1), path(p => ell(p, 0, 0, 16, 14))], [shade(c, 0.15), shade(c, 0.15), shade(c, 0.04)], o, 2.6);
          shine(g, -5, -4, 4, 3);
          if (snap > 0.55) { g.strokeStyle = o; g.lineWidth = 2.2; g.lineCap = 'round'; for (const a of [-2.4, -1.57, -0.74]) { g.beginPath(); g.moveTo(Math.cos(a) * 9, -32 + Math.sin(a) * 9); g.lineTo(Math.cos(a) * 15, -32 + Math.sin(a) * 15); g.stroke(); } }
          g.restore();
        });
      },
    },
    meduza: {
      name: 'Медуза', el: ['water'], part: 'steel', price: 900, rate: 36, need: 7, hover: true,
      desc: 'Прозрачная медуза из тёплой лагуны. Звенит на маленьком стальном барабане — дин-дилинь!', col: '#e486d8',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6), sw = Math.sin(t * 11);
        const hit = [Math.max(0, sw) * s, Math.max(0, -sw) * s];
        // щупальца
        for (let i = 0; i < 5; i++) {
          const x0 = -26 + i * 13, len = 36 + (i % 2) * 6, pts = [];
          for (let j = 0; j <= 6; j++) { const u = j / 6; pts.push([x0 * (1 + u * 0.15) + Math.sin(t * 2.6 + i * 1.3 + u * 4.5) * 4.5 * u, -44 + len * u]); }
          rope(g, pts, '#ffc8f0', o, 3.4, false, 4);
        }
        // купол: полупрозрачный, с волнистым краем
        const bell = new Path2D(); bell.moveTo(-44, -46); bell.bezierCurveTo(-50, -114, 50, -114, 44, -46);
        for (let i = 0; i < 6; i++) { const xa = 44 - i * 88 / 6, xb = xa - 88 / 6; bell.quadraticCurveTo((xa + xb) / 2, -37 + Math.sin(t * 3 + i) * 1.2, xb, -46); }
        bell.closePath();
        const bg = g.createRadialGradient(-14, -84, 3, 0, -66, 58);
        bg.addColorStop(0, 'rgba(255,255,255,.95)'); bg.addColorStop(0.3, 'rgba(255,205,242,.88)'); bg.addColorStop(0.75, rgba(c, 0.82)); bg.addColorStop(1, 'rgba(160,80,200,.9)');
        g.fillStyle = bg; g.fill(bell);
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-36, -50); g.quadraticCurveTo(0, -58, 36, -50); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(44 - (i + 0.5) * 88 / 6, -43, 1.8, 0, TAU); g.fill(); }
        g.strokeStyle = o; g.lineWidth = 3.2; g.lineJoin = 'round'; g.stroke(bell);
        shine(g, -22, -82, 9, 5);
        eye(g, -14, -68, 9, st); eye(g, 14, -68, 9, st);
        mouth(g, 0, -53, 16, s * 0.8, s > 0.1 ? 'o' : 'smile'); cheeks(g, 0, -58, 25, 5);
        // щупальца держат барабанчик
        for (const k of [-1, 1]) rope(g, [[k * 36, -46], [k * 42, -32], [k * 24, -21]], '#ffc8f0', o, 3.6);
        const py = -20;
        const skirt = g.createLinearGradient(-24, 0, 24, 0);
        skirt.addColorStop(0, '#6f7c8e'); skirt.addColorStop(0.35, '#f2f6fb'); skirt.addColorStop(0.65, '#b4bfcc'); skirt.addColorStop(1, '#5a6676');
        g.fillStyle = skirt; g.strokeStyle = '#3a4250'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(-24, py); g.lineTo(-22, py + 9); g.ellipse(0, py + 9, 22, 6.5, 0, Math.PI, 0, true); g.lineTo(24, py); g.closePath(); g.fill(); g.stroke();
        const top = g.createRadialGradient(-6, py - 3, 2, 0, py, 26);
        top.addColorStop(0, '#ffffff'); top.addColorStop(0.55, '#cdd6e2'); top.addColorStop(1, '#8a96a8');
        g.fillStyle = top; g.beginPath(); g.ellipse(0, py, 24, 7.5, 0, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(60,70,90,.55)'; g.lineWidth = 1.2;
        [[0, py + 1.5, 8, 2.8], [-14, py, 5.5, 2.2], [14, py, 5.5, 2.2], [0, py - 4.2, 6, 1.5]].forEach(([x, y, rx, ry], i) => {
          const lit = (i === 1 && hit[0] > 0.6) || (i === 2 && hit[1] > 0.6);
          g.fillStyle = lit ? '#fff6c0' : 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); g.stroke();
        });
        // палочки с резиновыми наконечниками
        [-1, 1].forEach((k, i) => {
          const h = hit[i], tx = k * 13, ty = -31 + h * 9, hx = k * 20, hy = -36 + h * 4;
          rope(g, [[k * 14, -46], [k * 24, -42], [hx, hy]], '#ffc8f0', o, 3.2);
          g.strokeStyle = '#4a2a12'; g.lineWidth = 4.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
          g.strokeStyle = '#d8a060'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke();
          g.fillStyle = '#ff5a7a'; g.strokeStyle = '#6a1a2a'; g.lineWidth = 1.8; g.beginPath(); g.arc(tx, ty, 3.6, 0, TAU); g.fill(); g.stroke();
          if (h > 0.6) { g.strokeStyle = 'rgba(90,110,150,.8)'; g.lineWidth = 2; for (const d of [0, 6]) { g.beginPath(); g.arc(k * 22, py + 2, 8 + d, k > 0 ? -0.6 : Math.PI - 0.6, k > 0 ? 0.6 : Math.PI + 0.6); g.stroke(); } }
        });
      },
    },
    kokos: {
      name: 'Кокос', el: ['leaf'], part: 'bongo', price: 1000, rate: 38, need: 8,
      desc: 'Лохматый кокос с пальмовой чёлкой. Шлёпает ладошками по бонгам: тики-тук, тики-тук!', col: '#8f5d38',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6), ph = Math.sin(t * 12);
        const up = [s * (1 - Math.max(0, ph)), s * (1 - Math.max(0, -ph))]; // насколько поднята ладошка
        // пальмовые листья вместо чёлки
        const wob = i => Math.sin(t * 2 + i) * 0.04 + Math.sin(t * 12) * s * 0.04;
        frond(g, -4, -82, 50, -2.45 + wob(0), 0.75, '#3f9a2c');
        frond(g, 4, -82, 50, -0.69 + wob(1), 0.75, '#3f9a2c');
        frond(g, -2, -84, 38, -1.95 + wob(2), 0.55, '#58ba3c');
        frond(g, 2, -84, 38, -1.19 + wob(3), 0.55, '#58ba3c');
        feet(g, 80, c);
        // мохнатый шар
        const fur = p => { const N = 44; for (let i = 0; i < N; i++) { const a = i / N * TAU, r = i % 2 ? 44 : 41; const x = Math.cos(a) * r * 1.02, y = -45 + Math.sin(a) * r; i ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); };
        silhouette(g, [{ path: fur, fill: blobFill(g, c, 88, 88, -89) }], c, o);
        g.lineCap = 'round'; g.lineWidth = 1.8;
        for (let i = 0; i < 26; i++) { const a = i / 26 * TAU + 0.1, r = 31 + (i % 3) * 3.5, x = Math.cos(a) * r, y = -45 + Math.sin(a) * r * 0.95; g.strokeStyle = i % 2 ? 'rgba(40,18,6,.35)' : 'rgba(255,220,180,.3)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + 0.4) * 6, y + Math.sin(a + 0.4) * 6); g.stroke(); }
        // светлая «мякоть» — мордочка
        const face = g.createRadialGradient(-6, -54, 3, 0, -44, 32); face.addColorStop(0, '#fffaf0'); face.addColorStop(1, '#ead2ae');
        g.fillStyle = face; g.strokeStyle = shade(c, -0.45); g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, -45, 29, 25, 0, 0, TAU); g.fill(); g.stroke();
        eye(g, -12, -51, 9.5, st, { happy: true }); eye(g, 12, -51, 9.5, st, { happy: true });
        mouth(g, 0, -33, 20, s * 0.8); cheeks(g, 0, -38, 21, 5);
        // бонги: пара барабанчиков на перемычке
        g.fillStyle = '#6a3a18'; g.strokeStyle = '#3a1e0a'; g.lineWidth = 2.2; g.beginPath(); g.roundRect(-6, -19, 12, 8, 2); g.fill(); g.stroke();
        const drum = (x, top, rx, hgt) => {
          const bot = top + hgt, rb = rx * 0.72, body = new Path2D();
          body.moveTo(x - rx, top); body.lineTo(x - rb, bot); body.quadraticCurveTo(x, bot + 4, x + rb, bot); body.lineTo(x + rx, top); body.closePath();
          g.fillStyle = '#c87c3e'; g.strokeStyle = '#4a2810'; g.lineWidth = 2.4; g.fill(body);
          g.save(); g.clip(body); g.fillStyle = 'rgba(255,230,190,.35)'; g.fillRect(x - rx * 0.55, top, rx * 0.35, hgt + 5);
          g.fillStyle = '#7a3e18'; g.fillRect(x - rx, top + 4, rx * 2, 3.5); g.fillRect(x - rx, bot - 5, rx * 2, 3); g.restore();
          g.stroke(body);
          g.fillStyle = '#f6e8cc'; g.beginPath(); g.ellipse(x, top, rx, rx * 0.32, 0, 0, TAU); g.fill(); g.stroke();
        };
        drum(-17, -22, 15, 20); drum(17, -20, 12, 18);
        // ручки-ладошки
        [-1, 1].forEach((k, i) => {
          const hx = k * (17 + up[i] * 7), hy = -24 - up[i] * 11;
          rope(g, [[k * 37, -42], [k * 36, -30 - up[i] * 8], [hx + k * 5, hy]], c, o, 8);
          g.fillStyle = '#f2d8b2'; g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.ellipse(hx, hy, 7.5, 5.5, k * 0.2, 0, TAU); g.fill(); g.stroke();
          if (s > 0.3 && up[i] < 0.12) { g.strokeStyle = '#5a3418'; g.lineWidth = 2; for (const a of [-2.3, -1.57, -0.84]) { g.beginPath(); g.moveTo(hx + Math.cos(a) * 10, hy + Math.sin(a) * 10); g.lineTo(hx + Math.cos(a) * 15, hy + Math.sin(a) * 15); g.stroke(); } }
        });
      },
    },
    kitenok: {
      name: 'Китёнок', el: ['water'], part: 'subbass', price: 1200, rate: 40, need: 8,
      desc: 'Круглый китёнок стоит на хвосте и гудит самым низким басом, а фонтанчик на макушке подпрыгивает в такт.', col: '#4c8ee0',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6);
        // фонтанчик растёт, когда китёнок поёт
        const hgt = 5 + s * 22 + Math.sin(t * 9) * 1.5 * (0.3 + s), top = -88 - hgt, WL = '#d4f0ff', WO = '#3a7cc8';
        if (s > 0.06) for (const k of [-1, 1]) rope(g, [[0, top + 3], [k * (6 + s * 6), top - 3], [k * (10 + s * 9), top + 6 + s * 6]], WL, WO, 4, false, 3);
        g.fillStyle = WL; g.strokeStyle = WO; g.lineWidth = 1.8; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-5, -86); g.quadraticCurveTo(-2, -88 - hgt * 0.5, -3.5, top + 2); g.arc(0, top + 2, 3.5, Math.PI, 0); g.quadraticCurveTo(2, -88 - hgt * 0.5, 5, -86); g.closePath(); g.fill(); g.stroke();
        for (let i = 0; i < 4; i++) {
          const u = (t * 1.3 + i / 4) % 1, k = i % 2 ? 1 : -1, sp = 0.35 + s, x = k * (5 + u * 18 * sp), y = top + 2 - Math.sin(u * Math.PI) * 6 * sp + u * u * 14 * sp;
          g.beginPath(); g.arc(x, y, 2.4 * (1 - u * 0.4), 0, TAU); g.fill(); g.stroke();
        }
        // плавнички
        for (const k of [-1, 1]) {
          g.save(); g.translate(k * 40, -44); g.rotate(k * (0.55 + s * 0.35 * Math.sin(t * 6)));
          g.fillStyle = shade(c, -0.1); g.strokeStyle = o; g.lineWidth = 2.6; g.beginPath(); g.ellipse(k * 11, 4, 14, 7, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
        }
        // тело на хвосте
        const flukes = [-1, 1].map(k => ({ path: p => { p.moveTo(0, -15); p.bezierCurveTo(k * 12, -6, k * 34, -10, k * 50, -20); p.quadraticCurveTo(k * 42, -1, k * 14, -1); p.quadraticCurveTo(k * 4, -1, 0, -6); p.closePath(); }, fill: shade(c, 0.08) }));
        silhouette(g, [...flukes, { path: p => p.ellipse(0, -52, 45, 38, 0, 0, TAU), fill: blobFill(g, c, 90, 76, -90) }], c, o);
        g.fillStyle = '#1c3a6a'; g.beginPath(); g.ellipse(0, -87, 5, 1.8, 0, 0, TAU); g.fill();
        // светлое брюшко с полосками
        g.save(); g.beginPath(); g.ellipse(0, -52, 45, 38, 0, 0, TAU); g.clip();
        g.fillStyle = '#d9eeff'; g.beginPath(); g.ellipse(0, -30, 32, 20, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(40,90,160,.28)'; g.lineWidth = 1.8; for (const y of [-38, -31, -24]) { g.beginPath(); g.moveTo(-24, y); g.quadraticCurveTo(0, y + 5, 24, y); g.stroke(); }
        g.restore();
        shine(g, -20, -76, 9, 6);
        eye(g, -17, -60, 9.5, st, { iris: '#2a5aa8', lid: 1 }); eye(g, 17, -60, 9.5, st, { iris: '#2a5aa8', lid: 1 });
        mouth(g, 0, -44, 28, s * 0.9, s > 0.1 ? 'o' : 'smile'); cheeks(g, 0, -48, 29, 6);
      },
    },
    rakushka: {
      name: 'Ракушка', el: ['stone'], part: 'ukulele', price: 1300, rate: 42, need: 9,
      desc: 'Стеснительный жилец полосатой ракушки. Выглядывает наружу и бренчит на укулеле.', col: '#7fd6c2',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6), strum = Math.sin(t * 15) * s;
        const SH = '#ffe7c6', ST = '#f0835a', SO = '#7a3a22';
        // раковина-башенка: витки снизу вверх; нижние витки заслоняют верхние
        const W = [[0, -42, 48, 40], [3, -80, 32, 16], [-2, -95, 20, 10], [1, -105, 10, 7]];
        const ps = W.map(([x, y, rx, ry]) => path(p => p.ellipse(x, y, rx, ry, 0, 0, TAU)));
        g.lineJoin = 'round'; g.strokeStyle = SO; g.lineWidth = 6.4; for (const p of ps) g.stroke(p);
        for (let i = W.length - 1; i >= 0; i--) {
          const [x, y, rx, ry] = W[i], p = ps[i];
          g.fillStyle = SH; g.fill(p);
          g.save(); g.clip(p);
          g.strokeStyle = ST; g.lineWidth = Math.max(3, ry * 0.32);
          for (let xx = x - rx - ry; xx < x + rx + ry; xx += Math.max(9, ry * 0.75)) { g.beginPath(); g.moveTo(xx, y + ry); g.quadraticCurveTo(xx + ry * 0.2, y, xx + ry * 0.9, y - ry); g.stroke(); }
          const lg = g.createLinearGradient(0, y - ry, 0, y + ry); lg.addColorStop(0, 'rgba(255,255,255,.4)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(90,30,10,.25)');
          g.fillStyle = lg; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
          g.restore();
          if (i < W.length - 1) { g.strokeStyle = SO; g.lineWidth = 2.8; g.beginPath(); g.ellipse(x, y, rx, ry, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke(); }
        }
        shine(g, -30, -58, 6, 10);
        feet(g, 62, c);
        // устье: перламутровая губа и тёмная глубина
        const lip = g.createRadialGradient(-8, -46, 4, 0, -34, 34); lip.addColorStop(0, '#fff4f0'); lip.addColorStop(1, '#ffb0bc');
        g.fillStyle = lip; g.strokeStyle = SO; g.lineWidth = 2.8; g.beginPath(); g.ellipse(0, -34, 32, 28, 0, 0, TAU); g.fill(); g.stroke();
        const deep = g.createLinearGradient(0, -58, 0, -10); deep.addColorStop(0, '#4a1e2e'); deep.addColorStop(1, '#8a4a5a');
        g.fillStyle = deep; g.beginPath(); g.ellipse(0, -33, 25, 22, 0, 0, TAU); g.fill();
        // жилец выглядывает: усики, голова
        const lean = Math.sin(t * 2) * 1.2 - s * 2;
        for (const k of [-1, 1]) rope(g, [[k * 7, -44 + lean], [k * 10, -54 + lean], [k * 13 + Math.sin(t * 3 + k) * 2, -60 + lean]], c, o, 3);
        g.fillStyle = '#ffd84a'; g.strokeStyle = o; g.lineWidth = 2; for (const k of [-1, 1]) { g.beginPath(); g.arc(k * 13 + Math.sin(t * 3 + k) * 2, -61 + lean, 3.4, 0, TAU); g.fill(); g.stroke(); }
        g.save(); g.translate(0, lean);
        silhouette(g, [{ path: p => p.ellipse(0, -30, 24, 22, 0, 0, TAU), fill: blobFill(g, c, 48, 44, -52) }], c, o);
        eye(g, -10, -34, 8.5, st, { lid: 1 }); eye(g, 10, -34, 8.5, st, { lid: 1 });
        mouth(g, 0, -20, 14, s * 0.6); cheeks(g, 0, -24, 17, 4);
        g.restore();
        // укулеле
        g.save(); g.translate(-10, -13); g.rotate(-0.42);
        const uk = path(p => { ell(p, -6, 0, 12, 10); ell(p, 8, 0, 9, 8); });
        g.lineJoin = 'round'; g.strokeStyle = '#4a2410'; g.lineWidth = 4.4; g.stroke(uk); g.fillStyle = '#e8a450'; g.fill(uk);
        g.fillStyle = '#8a4a1e'; g.strokeStyle = '#4a2410'; g.lineWidth = 2; g.beginPath(); g.roundRect(14, -2.6, 26, 5.2, 1.5); g.fill(); g.stroke();
        g.beginPath(); g.roundRect(38, -4.2, 10, 8.4, 2.5); g.fill(); g.stroke();
        g.fillStyle = '#3a1a0a'; g.beginPath(); g.arc(6, 0, 3.6, 0, TAU); g.fill();
        g.fillRect(-11, -3.5, 3, 7);
        g.strokeStyle = 'rgba(255,250,230,.85)'; g.lineWidth = 0.8; for (const d of [-1.5, 0, 1.5]) { g.beginPath(); g.moveTo(-10, d); g.lineTo(40, d * 0.8); g.stroke(); }
        g.restore();
        arm(g, 26, -17, -2.05, 10, c, 8);
        arm(g, -22, -22, 0.85 + strum * 0.35, 14, c, 8);
      },
    },
    popugaika: {
      name: 'Попугайка', el: ['leaf'], part: 'panflute', price: 1500, rate: 44, need: 9,
      desc: 'Яркая попугайка с хохолком. Дует в бамбуковую флейту Пана и пересвистывается с волнами.', col: '#5ccc3c',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6), sl = Math.sin(t * 3.2) * s * 5;
        // длинный хвост
        ['#3a8ae8', '#ff5a3a', '#ffd23a'].forEach((col, i) => {
          g.save(); g.translate(14, -26); g.rotate(0.15 + i * 0.25 + Math.sin(t * 2 + i) * 0.05);
          g.fillStyle = col; g.strokeStyle = shade(col, -0.55); g.lineWidth = 2.4; g.beginPath(); g.ellipse(24, 0, 25, 6.5, 0, 0, TAU); g.fill(); g.stroke();
          g.strokeStyle = shade(col, -0.25); g.lineWidth = 1.4; g.beginPath(); g.moveTo(4, 0); g.lineTo(44, 0); g.stroke(); g.restore();
        });
        // хохолок
        ['#ffd23a', '#ff9a2a', '#ff5a3a', '#ffd23a'].forEach((col, i) => {
          const k = 1 + Math.sin(t * 3 + i) * 0.05 + s * 0.08;
          g.save(); g.translate(-4 + i * 3, -92); g.rotate(-0.6 + i * 0.36 + Math.sin(t * 2.5 + i) * 0.05); g.scale(1, k);
          g.fillStyle = col; g.strokeStyle = shade(col, -0.55); g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(7, -12, 0, -24); g.quadraticCurveTo(-7, -12, 0, 2); g.fill(); g.stroke(); g.restore();
        });
        feet(g, 72, '#e8a03a');
        silhouette(g, [{ path: g2 => SHAPES.pear(g2, 76, 96), fill: blobFill(g, c, 76, 96) }], c, o);
        g.fillStyle = '#ffe24a'; g.beginPath(); g.ellipse(0, -26, 22, 22, 0, 0, TAU); g.fill();
        g.fillStyle = '#d8f25a'; g.beginPath(); g.ellipse(0, -62, 28, 18, 0, 0, TAU); g.fill();
        shine(g, -14, -82, 6, 9);
        eye(g, -13, -66, 9.5, st, { iris: '#ff8a1a', pupil: 0.5 }); eye(g, 13, -66, 9.5, st, { iris: '#ff8a1a', pupil: 0.5 });
        cheeks(g, 0, -55, 23, 5);
        // флейта Пана
        const L = [24, 21, 18, 15.5, 13, 11];
        L.forEach((len, i) => {
          const x = sl - 21 + i * 7;
          const bam = g.createLinearGradient(x, 0, x + 7, 0); bam.addColorStop(0, '#f6d880'); bam.addColorStop(1, '#c8962e');
          g.fillStyle = bam; g.strokeStyle = '#6a4a1a'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(x, -42, 7, len, 2.5); g.fill(); g.stroke();
          g.strokeStyle = 'rgba(106,74,26,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 1, -42 + len * 0.62); g.lineTo(x + 6, -42 + len * 0.62); g.stroke();
          g.fillStyle = '#4a3010'; g.beginPath(); g.ellipse(x + 3.5, -42, 2.2, 1.1, 0, 0, TAU); g.fill();
        });
        g.strokeStyle = '#c83a3a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(sl - 22, -35); g.lineTo(sl + 21, -35); g.stroke();
        // клюв дует в трубочку
        const bk = s * 2;
        g.fillStyle = '#ffb43a'; g.strokeStyle = '#7a4a10'; g.lineWidth = 2.4; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-9, -56); g.quadraticCurveTo(0, -63, 9, -56); g.quadraticCurveTo(8, -45 + bk, 1, -41 + bk); g.quadraticCurveTo(-3, -47, -9, -56); g.closePath(); g.fill(); g.stroke();
        shine(g, -3, -57, 2.4, 1.6);
        // крылья придерживают флейту
        for (const k of [-1, 1]) {
          g.save(); g.translate(k * 32, -50); g.rotate(k * -0.55);
          g.fillStyle = shade(c, -0.12); g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, 10, 10, 20, 0, 0, TAU); g.fill(); g.stroke();
          g.save(); g.beginPath(); g.ellipse(0, 10, 10, 20, 0, 0, TAU); g.clip(); g.fillStyle = '#3a8ae8'; g.fillRect(-12, 18, 24, 16); g.strokeStyle = shade('#3a8ae8', -0.4); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3, 18); g.lineTo(-3, 30); g.moveTo(3, 18); g.lineTo(3, 30); g.stroke(); g.restore();
          g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, 10, 10, 20, 0, 0, TAU); g.stroke();
          g.restore();
        }
      },
    },
    // ---------- элитные (только скрещиванием)
    delfa: {
      name: 'Дельфа', el: ['water', 'stone'], part: 'calypsovox', rate: 64,
      desc: 'Солистка лагуны в цветочной гирлянде. Стоит на хвосте и звонко ведёт главную мелодию калипсо.', col: '#56b4ec',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6);
        glow(g, 0, -58, 66, '#9ff0ff', 0.35 + s * 0.3);
        for (let i = 0; i < 5; i++) { const a = t * 0.7 + i * TAU / 5; sparkle(g, Math.cos(a) * 52, -60 + Math.sin(a) * 40, 2.5 + (1 + Math.sin(t * 4 + i * 2)) * (1.2 + s * 1.8), i % 2 ? '#ffffff' : '#fff2a0'); }
        // спинной плавник, хвост и тело
        const fin = { path: p => { p.moveTo(4, -92); p.quadraticCurveTo(18, -104, 30, -109); p.quadraticCurveTo(22, -98, 25, -82); p.closePath(); }, fill: shade(c, -0.12) };
        const flukes = [-1, 1].map(k => ({ path: p => { p.moveTo(0, -14); p.bezierCurveTo(k * 8, -8, k * 22, -18, k * 34, -21); p.quadraticCurveTo(k * 28, -4, k * 8, -2); p.quadraticCurveTo(k * 2, -2, 0, -6); p.closePath(); }, fill: shade(c, -0.1) }));
        silhouette(g, [fin, ...flukes, { path: lifted('pear', 72, 90, 10), fill: blobFill(g, c, 72, 90, -100) }], c, o);
        g.save(); g.clip(path(lifted('pear', 72, 90, 10)));
        g.fillStyle = '#eef9ff'; g.beginPath(); g.ellipse(0, -34, 22, 26, 0, 0, TAU); g.fill(); g.restore();
        shine(g, -14, -88, 5, 8);
        // гибискус за ушком
        hibiscus(g, -22, -92, 12, '#ff4a86', Math.sin(t * 1.5) * 0.15);
        // мордочка с носиком
        for (const k of [-1, 1]) {
          eye(g, k * 15, -78, 9, st, { iris: '#2a5ab0', happy: true, lid: 1 });
          if (!(st.blink > 0.5) && !(s > 0.55)) { g.strokeStyle = '#2a1a22'; g.lineWidth = 2; g.lineCap = 'round'; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(k * 15 + k * (5 + i * 3), -86 + i * 1.5); g.lineTo(k * 15 + k * (8 + i * 4), -91 + i * 2); g.stroke(); } }
        }
        if (s > 0.08) mouth(g, 0, -53, 20, s, 'o');
        g.fillStyle = '#c8ecfe'; g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, -61, 15, 8, 0, 0, TAU); g.fill(); g.stroke();
        shine(g, -5, -64, 4, 2);
        if (s <= 0.08) { g.strokeStyle = '#2a1a22'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-19, -61); g.quadraticCurveTo(0, -45, 19, -61); g.stroke(); }
        cheeks(g, 0, -64, 24, 4.5);
        // плавники-руки: на высокой ноте поднимает
        for (const k of [-1, 1]) {
          g.save(); g.translate(k * 30, -46); g.scale(k, 1); g.rotate(0.6 - s * 1.2 + Math.sin(t * 2 + k) * 0.08);
          g.fillStyle = shade(c, -0.08); g.strokeStyle = o; g.lineWidth = 2.6; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(14, -10, 24, 2); g.quadraticCurveTo(12, 5, 0, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
        }
        // цветочная гирлянда
        const lei = ['#ff5a9a', '#ffd23a', '#ffffff', '#ff8a3a'];
        for (let i = 0; i <= 8; i++) { const u = i / 8; flower(g, -28 + 56 * u, -48 + Math.sin(Math.PI * u) * 11, 6, lei[i % 4], t * 0.4 + i); }
      },
    },
    pancyr: {
      name: 'Панцирь', el: ['leaf', 'stone'], part: 'reggaevox', rate: 64,
      desc: 'Неспешная черепаха в тёмных очках и с косичками из водорослей. Басит на подпевках «йо-о».', col: '#8acb6c',
      draw(g, st) {
        const c = this.col, s = st.sing, t = st.t, o = shade(c, -0.6), sway = Math.sin(t * 1.6) * 0.06;
        glow(g, 0, -56, 66, '#e0ff8a', 0.32 + s * 0.3);
        for (let i = 0; i < 4; i++) { const a = -t * 0.6 + i * TAU / 4; sparkle(g, Math.cos(a) * 54, -58 + Math.sin(a) * 38, 2.5 + (1 + Math.sin(t * 3.5 + i * 2)) * (1.2 + s * 1.8), '#fff2a0'); }
        // панцирь за спиной
        const SHc = '#6b8a3a', SHo = '#2e3e18';
        feet(g, 84, c);
        g.lineJoin = 'round'; g.strokeStyle = SHo; g.lineWidth = 6.4; g.beginPath(); g.ellipse(0, -50, 50, 40, 0, 0, TAU); g.stroke();
        g.fillStyle = blobFill(g, SHc, 100, 80, -90); g.fill();
        g.save(); g.beginPath(); g.ellipse(0, -50, 50, 40, 0, 0, TAU); g.clip();
        g.strokeStyle = 'rgba(30,45,15,.55)'; g.lineWidth = 2.2; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.95 + i * 0.137); g.beginPath(); g.moveTo(Math.cos(a) * 34, -50 + Math.sin(a) * 28); g.lineTo(Math.cos(a) * 52, -50 + Math.sin(a) * 42); g.stroke(); }
        g.beginPath(); g.ellipse(0, -50, 38, 30, 0, 0, TAU); g.stroke();
        g.fillStyle = '#86c24a'; for (const [x, y, rx] of [[-34, -80, 12], [-14, -90, 10], [30, -82, 13], [44, -64, 6], [-46, -60, 6]]) { g.beginPath(); g.ellipse(x, y, rx, rx * 0.55, x * 0.012, 0, TAU); g.fill(); }
        g.fillStyle = '#a8dc5a'; for (const [x, y] of [[-36, -83], [28, -85], [-15, -92]]) { g.beginPath(); g.ellipse(x, y, 5, 2.4, 0, 0, TAU); g.fill(); }
        g.restore();
        // правая рука лениво машет
        arm(g, 38, -48, -0.75 + Math.sin(t * 2) * 0.18 - s * 0.35, 16, c, 10);
        // тело с пластроном
        silhouette(g, [{ path: g2 => SHAPES.gum(g2, 70, 70), fill: blobFill(g, c, 70, 70) }], c, o);
        const pl = new Path2D(); pl.moveTo(-26, -62); pl.quadraticCurveTo(0, -68, 26, -62); pl.quadraticCurveTo(30, -28, 0, -8); pl.quadraticCurveTo(-30, -28, -26, -62); pl.closePath();
        const plg = g.createLinearGradient(0, -66, 0, -8); plg.addColorStop(0, '#fbeab0'); plg.addColorStop(1, '#d8bc70');
        g.fillStyle = plg; g.strokeStyle = '#8a6a2a'; g.lineWidth = 2.4; g.fill(pl); g.stroke(pl);
        g.save(); g.clip(pl); g.strokeStyle = 'rgba(138,106,42,.6)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, -66); g.lineTo(0, -8); for (const y of [-48, -32]) { g.moveTo(-30, y); g.quadraticCurveTo(0, y + 4, 30, y); } g.stroke(); g.restore();
        arm(g, -31, -44, 0.95 + s * 0.15, 11, c, 10); // левая лежит на пузе
        // ожерелье из ракушек
        for (let i = 0; i <= 6; i++) { const u = i / 6, x = -18 + 36 * u, y = -60 + Math.sin(Math.PI * u) * 6; g.fillStyle = i === 3 ? '#ffd0e0' : '#fffaf0'; g.strokeStyle = '#8a6a5a'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, i === 3 ? 3.6 : 2.4, 0, TAU); g.fill(); g.stroke(); }
        // голова слегка покачивается
        g.save(); g.translate(0, -62); g.rotate(sway); g.translate(0, 62);
        silhouette(g, [{ path: p => p.ellipse(0, -80, 27, 23, 0, 0, TAU), fill: blobFill(g, c, 54, 46, -103) }], c, o);
        // сонные глаза поверх очков
        const sleepy = { ...st, blink: Math.max(st.blink, 0.42) };
        eye(g, -11, -89, 6.5, sleepy); eye(g, 11, -89, 6.5, sleepy);
        g.strokeStyle = '#ffc23a'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-26, -79); g.lineTo(-19, -77); g.moveTo(26, -79); g.lineTo(19, -77); g.moveTo(-3, -76); g.quadraticCurveTo(0, -79, 3, -76); g.stroke();
        for (const k of [-1, 1]) {
          const lens = g.createLinearGradient(0, -84, 0, -68); lens.addColorStop(0, '#3a2a5a'); lens.addColorStop(1, '#a04a7a');
          g.fillStyle = lens; g.strokeStyle = '#8a5a10'; g.lineWidth = 2.4; g.beginPath(); g.arc(k * 11, -76, 8.5, 0, TAU); g.fill(); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(k * 11 - 4, -79); g.lineTo(k * 11 - 1, -82); g.stroke();
        }
        g.strokeStyle = '#ffc23a'; g.lineWidth = 1.4; for (const k of [-1, 1]) { g.beginPath(); g.arc(k * 11, -76, 7.6, 0, TAU); g.stroke(); }
        mouth(g, 0, -64, 18, s * 0.85, s > 0.1 ? 'o' : 'smile');
        // пряди из водорослей
        const LK = [[-16, -1], [-21, -1], [-25, -1], [16, 1], [21, 1], [25, 1]];
        LK.forEach(([x0, k], i) => {
          const y0 = -80 - 23 * Math.sqrt(Math.max(0, 1 - (x0 / 27) ** 2)) + 2, pts = [[x0, y0]];
          for (let j = 1; j <= 6; j++) { const u = j / 6; pts.push([x0 + k * (10 + (i % 3) * 3) * Math.sin(u * 1.6) + Math.sin(u * 7 + i * 1.7) * 2.6 + Math.sin(t * 2.4 + i + u * 3) * 1.6 * u, y0 + u * (30 + (i % 3) * 5)]); }
          rope(g, pts, i % 2 ? '#7a8a2a' : '#94a234', '#2e3a10', 3.8, false, 4.4);
          const e = pts[pts.length - 1]; g.fillStyle = ['#fff6e0', '#ffd23a', '#ff8ab0'][i % 3]; g.strokeStyle = '#5a4a3a'; g.lineWidth = 1.4; g.beginPath(); g.arc(e[0], e[1], 2.6, 0, TAU); g.fill(); g.stroke();
        });
        // морская звёздочка-заколка
        g.save(); g.translate(15, -98); g.rotate(0.3 + Math.sin(t) * 0.05); g.fillStyle = '#ff9a4a'; g.strokeStyle = '#8a3a10'; g.lineWidth = 1.8; g.lineJoin = 'round'; g.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.4 : 8.5; (i ? g.lineTo : g.moveTo).call(g, Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ffd0a0'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; g.beginPath(); g.arc(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0.9, 0, TAU); g.fill(); } g.restore();
        g.restore();
      },
    },
  });
})();
