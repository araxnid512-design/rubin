// =====================================================================
//  Остров «Льдинка»: 8 зимних монстров (6 обычных и 2 элитных).
//  Песня острова — тихий снежный вальс. Рисуются так же, как в monsters.js:
//  ступни в (0, 0), рост около 100 единиц вверх.
// =====================================================================
(() => {
  const TAU = Math.PI * 2;
  // волнистый контур вокруг эллипса: amp > 0 — облачные бугорки, amp < 0 — острые пучки шерсти; низ срезан по flat
  function bumpy(p, cx, cy, rx, ry, n, amp, flat = Infinity, rot = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; pts.push([cx + Math.cos(a) * rx, Math.min(flat, cy + Math.sin(a) * ry)]); }
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
      if (y0 >= flat && y1 >= flat) { p.lineTo(x1, y1); continue; }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = mx - cx, dy = my - cy, L = Math.hypot(dx, dy) || 1;
      p.quadraticCurveTo(mx + dx / L * amp, my + dy / L * amp, x1, y1);
    }
    p.closePath();
  }
  // рука со своим цветом контура (у белых монстров контур синий, а не серый)
  function limb(g, x, y, ang, len, fill, line, wd = 10) {
    g.save(); g.translate(x, y); g.rotate(ang); g.lineCap = 'round';
    g.strokeStyle = line; g.lineWidth = wd + 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
    g.strokeStyle = fill; g.lineWidth = wd; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
    g.restore();
  }
  // рука от плеча к точке
  const reach = (g, x, y, tx, ty, fill, line, wd) => limb(g, x, y, Math.atan2(ty - y, tx - x), Math.hypot(tx - x, ty - y), fill, line, wd);
  // искорка-звёздочка: цветная, с белой серединкой — видна и на снегу
  function sparkle(g, x, y, r, a = 1, col = '#5cc8ff') {
    if (r < 0.4 || a < 0.03) return;
    g.save(); g.globalAlpha *= Math.min(1, a); g.translate(x, y);
    const star = k => { const q = r * k, e = q * 0.18; g.beginPath(); g.moveTo(0, -q); g.quadraticCurveTo(e, -e, q, 0); g.quadraticCurveTo(e, e, 0, q); g.quadraticCurveTo(-e, e, -q, 0); g.quadraticCurveTo(-e, -e, 0, -q); g.fill(); };
    g.fillStyle = col; star(1); g.fillStyle = '#fff'; star(0.55);
    g.restore();
  }
  function glow(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.55, rgba(col, a * 0.45)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // снежинка: шесть лучей с веточками (в текущих координатах)
  function flakePath(g, r) {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU - Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
      g.moveTo(0, 0); g.lineTo(c * r, s * r);
      for (const [k, b] of [[0.45, 0.3], [0.72, 0.22]]) { const bx = c * r * k, by = s * r * k; for (const d of [-1, 1]) { const a2 = a + d * 0.9; g.moveTo(bx, by); g.lineTo(bx + Math.cos(a2) * r * b, by + Math.sin(a2) * r * b); } }
    }
  }
  function flake(g, x, y, r, rot, line, fill, lw = 2) {
    g.save(); g.translate(x, y); g.rotate(rot); g.lineCap = 'round'; g.lineJoin = 'round';
    flakePath(g, r); g.strokeStyle = line; g.lineWidth = lw + 2.6; g.stroke(); g.strokeStyle = fill; g.lineWidth = lw; g.stroke();
    g.restore();
  }
  const ball = (g, x, y, r, col, line) => {
    g.fillStyle = col; g.strokeStyle = line; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU); g.fill();
  };

  Object.assign(KINDS, {
    // ---------- обычные
    snezhok: {
      name: 'Снежок', el: ['water'], part: 'celesta', price: 500, rate: 26, need: 5,
      desc: 'Снежный комочек в вязаном шарфике звенит на крошечной челесте — будто падают снежинки.', col: '#eaf5ff',
      draw(g, st) {
        const c = this.col, s = st.sing, OL = '#3d6b96', w = 88, h = 86, tap = Math.sin(st.t * 12), hl = Math.max(0, tap) * s, hr = Math.max(0, -tap) * s;
        const SC = '#e4474f', SD = '#7a1a26', CR = '#fff1dc';
        // хвостик шарфа развевается за спиной
        g.save(); g.translate(30, -33); g.rotate(-0.2 + Math.sin(st.t * 2.4) * 0.12);
        g.fillStyle = SC; g.strokeStyle = SD; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -5); g.quadraticCurveTo(14, -9 + Math.sin(st.t * 4) * 2, 28, -4); g.lineTo(27, 7); g.quadraticCurveTo(14, 3 + Math.sin(st.t * 4) * 2, 0, 6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = CR; g.beginPath(); g.moveTo(12, -6); g.lineTo(16, -6.4); g.lineTo(16, 4.6); g.lineTo(12, 4.4); g.closePath(); g.fill();
        g.strokeStyle = SC; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(27.5, -2 + i * 3.6); g.lineTo(32, -3 + i * 4.2); g.stroke(); }
        g.restore();
        feet(g, w, '#9fc6e8');
        const snow = g.createLinearGradient(0, -h, 0, 0); snow.addColorStop(0, '#ffffff'); snow.addColorStop(0.55, '#e7f3ff'); snow.addColorStop(1, '#a6cbee');
        const ears = [[-22, -80, 10], [21, -82, 9]].map(([x, y, r]) => ({ path: p => p.arc(x, y, r, 0, TAU), fill: '#f6fbff' }));
        silhouette(g, [...ears, { path: p => bumpy(p, 0, -h / 2, w / 2, h / 2, 18, 2, -1), fill: snow }], c, OL);
        g.fillStyle = 'rgba(70,130,200,.18)'; for (const [x, y, r] of [[-31, -50, 3], [30, -62, 2.5], [-25, -70, 2], [-34, -16, 2.2], [-12, -77, 1.8], [33, -14, 2]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        shine(g, -18, -70, 8, 5);
        eye(g, -14, -60, 9.5, st, { iris: '#3d7fd0' }); eye(g, 14, -60, 9.5, st, { iris: '#3d7fd0' });
        cheeks(g, 0, -49, 25, 5.5); mouth(g, 0, -47, 15, s * 0.8);
        // вязаный шарфик
        g.fillStyle = SC; g.strokeStyle = SD; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(-43, -38); g.quadraticCurveTo(0, -27, 43, -38); g.lineTo(41, -28); g.quadraticCurveTo(0, -16, -41, -28); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = CR; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-42, -33); g.quadraticCurveTo(0, -21.5, 42, -33); g.stroke();
        g.strokeStyle = rgba('#7a1a26', 0.45); g.lineWidth = 1.3; for (let i = -3; i <= 3; i++) { const x = i * 10, y = -30 + Math.abs(i) * 0.9 - 2; g.beginPath(); g.moveTo(x - 2.5, y - 2.5); g.lineTo(x, y); g.lineTo(x + 2.5, y - 2.5); g.stroke(); }
        g.fillStyle = SC; g.strokeStyle = SD; g.lineWidth = 2.4; g.beginPath(); g.ellipse(27, -30, 7, 6.5, 0.3, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = rgba('#7a1a26', 0.5); g.lineWidth = 1.3; g.beginPath(); g.moveTo(24, -33); g.lineTo(30, -27); g.stroke();
        // челеста-игрушка
        g.fillStyle = '#9a4f2c'; g.strokeStyle = '#4a2412'; g.lineWidth = 2.2;
        g.beginPath(); g.roundRect(-21, -5, 5, 6, 2); g.roundRect(16, -5, 5, 6, 2); g.fill(); g.stroke();
        g.fillStyle = '#c0683c'; g.beginPath(); g.roundRect(-26, -16, 52, 12, 4); g.fill(); g.stroke();
        g.fillStyle = '#e09a62'; g.beginPath(); g.moveTo(-26, -15); g.lineTo(-21.5, -23); g.lineTo(21.5, -23); g.lineTo(26, -15); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(-22.5, -16.3); g.lineTo(-19.8, -21.4); g.lineTo(19.8, -21.4); g.lineTo(22.5, -16.3); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(74,36,18,.55)'; g.lineWidth = 1; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 4.5, -16.3); g.lineTo(i * 4, -21.4); g.stroke(); }
        g.fillStyle = '#3a2016'; for (const i of [-4, -3, -1, 0, 2, 3]) { g.beginPath(); g.roundRect(i * 4.2 + 1.2, -21.4, 2.2, 2.8, 0.8); g.fill(); }
        g.strokeStyle = '#ffd36a'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(-20, -13.5, 40, 6.5, 2.5); g.stroke();
        sparkle(g, 0, -10.2, 3.2, 1, '#ffd36a');
        // «динь»: искорки над клавишами от удара
        sparkle(g, -19, -27 - hl * 8, 5 * hl, hl); sparkle(g, 19, -27 - hr * 8, 5 * hr, hr);
        limb(g, -39, -27, 0.5 - hl * 0.6, 16, '#f2f8ff', OL, 9); limb(g, 39, -27, Math.PI - 0.5 + hr * 0.6, 16, '#f2f8ff', OL, 9);
      },
    },
    sosulka: {
      name: 'Сосулька', el: ['water'], part: 'glass', price: 600, rate: 28, need: 5,
      desc: 'Звонкая сосулька водит пальчиками по краям бокалов, и воздух поёт хрусталём.', col: '#bdeefc',
      draw(g, st) {
        const c = this.col, s = st.sing, OL = '#28698f', circ = st.t * 7;
        feet(g, 64, '#86cbe6');
        const body = p => { p.moveTo(4, -114); p.bezierCurveTo(10, -96, 32, -84, 32, -56); p.bezierCurveTo(33, -22, 32, 0, 0, 0); p.bezierCurveTo(-32, 0, -33, -22, -32, -56); p.bezierCurveTo(-31, -84, -5, -94, 4, -114); p.closePath(); };
        const ice = g.createLinearGradient(-30, -118, 26, 0); ice.addColorStop(0, '#f6feff'); ice.addColorStop(0.45, '#c2effc'); ice.addColorStop(1, '#78c6e6');
        silhouette(g, [{ path: body, fill: ice }], c, OL);
        // грани льда, кольца-наплывы и пузырьки внутри
        const bp = new Path2D(); body(bp); g.save(); g.clip(bp);
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(-3, -104); g.lineTo(5, -101); g.lineTo(-12, -6); g.lineTo(-24, -6); g.closePath(); g.fill();
        g.fillStyle = 'rgba(30,120,170,.13)'; g.beginPath(); g.moveTo(12, -96); g.lineTo(40, -70); g.lineTo(40, 0); g.lineTo(16, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; for (const y of [-88, -28]) { g.beginPath(); g.moveTo(-30, y); g.quadraticCurveTo(0, y + 7, 30, y); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4; for (const [x, y, r] of [[18, -78, 2.6], [22, -70, 1.6], [-20, -24, 2.2], [14, -16, 1.8]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
        g.restore();
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-18, -62, 3.2, 17, 0.1, 0, TAU); g.fill(); g.beginPath(); g.ellipse(-10, -91, 2, 5, 0.4, 0, TAU); g.fill();
        eye(g, -12, -66, 9, st, { iris: '#2a8fc4', lid: 1 }); eye(g, 12, -66, 9, st, { iris: '#2a8fc4', lid: 1 });
        cheeks(g, 0, -54, 20, 4.5); mouth(g, 0, -50, 14, s, 'o');
        // ледяная полочка и бокалы с водой: стеклянная гармоника
        g.fillStyle = '#e2f8ff'; g.strokeStyle = OL; g.lineWidth = 2.2;
        g.beginPath(); g.roundRect(-30, -9, 6, 10, 2); g.roundRect(24, -9, 6, 10, 2); g.fill(); g.stroke();
        g.beginPath(); g.roundRect(-38, -15, 76, 7, 3); g.fill(); g.stroke();
        const GL = [[-25, 1, '#ff9ad0'], [-8, 0.86, '#b6a6ff'], [8, 0.78, '#8fe6ff'], [24, 0.94, '#9ff0b0']], rims = [];
        for (const [x, k, wc] of GL) {
          const rw = 7.2 * k, top = -15 - 9 * k - 15 * k, bot = -15 - 9 * k; rims.push([x, top, rw]);
          g.strokeStyle = OL; g.lineWidth = 1.8; g.fillStyle = 'rgba(255,255,255,.55)';
          g.beginPath(); g.ellipse(x, -15.5, rw * 0.7, 1.8, 0, 0, TAU); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(x, -15); g.lineTo(x, bot); g.stroke();
          const cup = p => { p.moveTo(x - rw, top); p.bezierCurveTo(x - rw, top + 12 * k, x - rw * 0.5, bot, x, bot); p.bezierCurveTo(x + rw * 0.5, bot, x + rw, top + 12 * k, x + rw, top); p.closePath(); };
          const cp = new Path2D(); cup(cp); g.fillStyle = 'rgba(235,252,255,.6)'; g.fill(cp);
          g.save(); g.clip(cp); g.fillStyle = rgba(wc, 0.8); g.fillRect(x - rw - 1, top + 7 * k + Math.sin(st.t * 3 + x) * 0.6 * s, rw * 2 + 2, 20); g.restore();
          g.stroke(cp); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - rw * 0.55, top + 3); g.quadraticCurveTo(x - rw * 0.6, top + 9 * k, x - rw * 0.2, bot - 2); g.stroke();
          g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath(); g.ellipse(x, top, rw, 2, 0, 0, TAU); g.stroke();
          if (s > 0.05) { g.strokeStyle = `rgba(160,235,255,${s * 0.8})`; g.lineWidth = 2.4; g.beginPath(); g.ellipse(x, top, rw + 2 + s * 2, 3 + s, 0, 0, TAU); g.stroke(); }
        }
        // пальчики кружат по краям крайних бокалов
        const [l, r] = [rims[0], rims[3]], fl = [l[0] + Math.cos(circ) * l[2] * 0.7, l[1] + Math.sin(circ) * 1.4], fr = [r[0] - Math.cos(circ) * r[2] * 0.7, r[1] + Math.sin(circ + 1) * 1.4];
        reach(g, -27, -44, fl[0], fl[1] - 2, '#d4f5ff', OL, 8); reach(g, 27, -44, fr[0], fr[1] - 2, '#d4f5ff', OL, 8);
        // поёт — звенят искры инея
        for (let i = 0; i < 5; i++) { const ph = st.t * 2.2 + i * 1.7, k = (Math.sin(ph) + 1) / 2, [x, y] = i < 4 ? [rims[i][0] + Math.sin(ph * 1.3) * 4, rims[i][1] - 8 - k * 10] : [4, -116]; sparkle(g, x, y, (3 + k * 3) * s, s * (0.5 + k * 0.5)); }
        sparkle(g, 22, -96, 4.5 * s, s); sparkle(g, -26, -84, 3.5 * s, s * 0.8);
      },
    },
    pingvi: {
      name: 'Пингви', el: ['wind'], part: 'oompah', price: 700, rate: 30, need: 6,
      desc: 'Круглый трубач в оркестровой фуражке дует в тубу «умпа-па-па» — раз-два-три, как в вальсе.', col: '#4a6fb3',
      draw(g, st) {
        const w = 90, h = 92, c = this.col, s = st.sing, O = shade(c, -0.6), B = '#ffc83a', BD = '#8a5a10', puff = 1 + s * 0.4;
        feet(g, w, '#f39a3a');
        silhouette(g, [{ path: p => SHAPES.gum(p, w, h), fill: blobFill(g, c, w, h) }], c, O);
        // белая «манишка» и маска
        g.fillStyle = '#f6f3ea'; g.beginPath(); g.ellipse(0, -31, 31, 28, 0, 0, TAU); g.moveTo(28, -62); g.ellipse(13, -62, 15, 14, 0, 0, TAU); g.moveTo(13, -62); g.ellipse(-13, -62, 15, 14, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(0, -48, 22, 14, 0, 0, TAU); g.fill();
        shine(g, -26, -76, 5, 8);
        // фуражка духового оркестра
        g.save(); g.translate(2, -90); g.rotate(-0.13);
        g.fillStyle = '#d8344a'; g.strokeStyle = '#5a0e1c'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(-17, -1); g.lineTo(-19, -18); g.quadraticCurveTo(0, -24, 19, -18); g.lineTo(17, -1); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ffd34a'; g.beginPath(); g.roundRect(-17.5, -6, 35, 4.5, 1.5); g.fill(); g.stroke();
        g.fillStyle = '#ff6a7a'; g.beginPath(); g.ellipse(0, -19.5, 19, 4, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#2a2a3a'; g.beginPath(); g.moveTo(-15, 0); g.quadraticCurveTo(0, 7, 15, 0); g.quadraticCurveTo(0, 2, -15, 0); g.fill(); g.stroke();
        g.fillStyle = '#ffe680'; g.strokeStyle = BD; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -12, 4, 0, TAU); g.fill(); g.stroke();
        g.restore();
        eye(g, -13, -64, 8.5, st, { lid: 1 }); eye(g, 13, -64, 8.5, st, { lid: 1 });
        cheeks(g, 0, -52, 24, 5 + s * 3);
        // туба: кольцо, раструб растёт на ноте, мундштук у клюва
        g.lineCap = 'round';
        const tube = (fn, wd) => { g.beginPath(); fn(); g.strokeStyle = BD; g.lineWidth = wd + 5; g.stroke(); g.strokeStyle = B; g.lineWidth = wd; g.stroke(); };
        tube(() => g.arc(8, -27, 14, 0, TAU), 7.5);
        tube(() => { g.moveTo(20, -34); g.quadraticCurveTo(31, -48, 30, -66); }, 7.5);
        tube(() => { g.moveTo(-5, -32); g.quadraticCurveTo(-8, -42, 0, -47); }, 3.5);
        g.fillStyle = BD; g.beginPath(); g.arc(8, -27, 5, 0, TAU); g.fill();
        for (let i = 0; i < 3; i++) { g.fillStyle = '#ffe28a'; g.strokeStyle = BD; g.lineWidth = 1.6; g.beginPath(); g.roundRect(13 + i * 5, -50 + i * 2.4, 3.6, 9, 1.2); g.fill(); g.stroke(); }
        g.save(); g.translate(30, -68); g.rotate(0.18); g.scale(puff, puff);
        g.fillStyle = B; g.strokeStyle = BD; g.lineWidth = 2.4 / puff; g.beginPath(); g.moveTo(-4, 6); g.quadraticCurveTo(-4, -4, -14, -12); g.lineTo(14, -12); g.quadraticCurveTo(4, -4, 4, 6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#7a4a08'; g.beginPath(); g.ellipse(0, -12, 14, 4, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-6, -5, 1.6, 4, 0.5, 0, TAU); g.fill();
        g.restore();
        g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.ellipse(-1, -36, 3, 1.6, -0.6, 0, TAU); g.fill();
        // клюв на мундштуке
        g.fillStyle = '#ffa53a'; g.strokeStyle = '#7a3a10'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-7, -53); g.quadraticCurveTo(0, -57, 7, -53); g.lineTo(0, -45 + s); g.closePath(); g.fill(); g.stroke();
        // ласты обнимают тубу
        for (const k of [-1, 1]) { g.save(); g.translate(k * 38, -42); g.rotate(k * (0.65 - s * 0.12)); g.fillStyle = shade(c, -0.12); g.strokeStyle = O; g.lineWidth = 2.6; g.beginPath(); g.ellipse(-k * 4, 9, 8, 17, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
      },
    },
    elochka: {
      name: 'Ёлочка', el: ['leaf'], part: 'sleigh', price: 800, rate: 32, need: 6,
      desc: 'Ёлочка-непоседа в снежной шапке трясёт бубенцами, и всем сразу хочется кружиться.', col: '#3ea35a',
      draw(g, st) {
        const c = this.col, s = st.sing, O = shade(c, -0.6), sh = Math.sin(st.t * 24) * s;
        // бубенцы в руках (позади тела — только ручки и связки)
        const bells = (k, a) => {
          g.save(); g.translate(k * 40, -34); g.rotate(a);
          g.strokeStyle = '#5a2e14'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(k * 18, -6); g.stroke();
          g.strokeStyle = '#c0302c'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(k * 16, -6); g.quadraticCurveTo(k * 22, -26, k * 6, -24); g.stroke();
          for (const [bx, by] of [[k * 18, -12], [k * 18, -21], [k * 10, -26]]) { ball(g, bx + sh * 1.2, by, 4.6, '#ffcc3a', '#8a5a10'); g.strokeStyle = '#6a4208'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(bx + sh * 1.2 - 2.4, by + 1.4); g.lineTo(bx + sh * 1.2 + 2.4, by + 1.4); g.stroke(); }
          g.restore();
        };
        bells(-1, -0.25 - sh * 0.25); bells(1, 0.25 + sh * 0.25);
        arm(g, -30, -30, Math.PI + 0.25 - sh * 0.25, 12, c, 9); arm(g, 30, -30, -0.25 + sh * 0.25, 12, c, 9);
        feet(g, 76, '#9a6a3a');
        const tree = p => {
          p.moveTo(0, -113);
          p.quadraticCurveTo(8, -103, 22, -93); p.quadraticCurveTo(35, -83, 20, -83);
          p.quadraticCurveTo(28, -62, 40, -51); p.quadraticCurveTo(53, -41, 33, -41);
          p.quadraticCurveTo(39, -24, 46, -13); p.quadraticCurveTo(54, 0, 32, 0);
          p.lineTo(-32, 0);
          p.quadraticCurveTo(-54, 0, -46, -13); p.quadraticCurveTo(-39, -24, -33, -41);
          p.quadraticCurveTo(-53, -41, -40, -51); p.quadraticCurveTo(-28, -62, -20, -83);
          p.quadraticCurveTo(-35, -83, -22, -93); p.quadraticCurveTo(-8, -103, 0, -113);
          p.closePath();
        };
        silhouette(g, [{ path: tree, fill: blobFill(g, c, 92, 113) }], c, O);
        const tp = new Path2D(); tree(tp); g.save(); g.clip(tp);
        // иголочки-штрихи и снег: шапка на макушке и снежные кромки ярусов
        g.strokeStyle = rgba('#1f5a2a', 0.35); g.lineWidth = 1.6; for (const [x, y] of [[-30, -30], [-20, -18], [30, -26], [36, -14], [-30, -60], [30, -64], [-10, -96], [10, -94]]) { g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x, y); g.lineTo(x + 4, y - 4); g.stroke(); }
        const snowLine = (y, x0, x1, n) => { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x0, y - 7); g.lineTo(x1, y - 7); g.lineTo(x1, y); for (let i = n; i >= 0; i--) { const x = x0 + (x1 - x0) * i / n; g.lineTo(x, y + (i % 2 ? 4 : 0)); } g.closePath(); g.fill(); };
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-14, -101); g.quadraticCurveTo(-8, -98, -5, -102); g.quadraticCurveTo(-1, -95, 3, -101); g.quadraticCurveTo(8, -97, 14, -101); g.lineTo(0, -120); g.closePath(); g.fill();
        for (const [y, hw] of [[-83, 34], [-41, 54]]) { g.save(); g.translate(0, y); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-hw, -1); for (let i = 0; i <= 12; i++) { const x = -hw + hw * 2 * i / 12; g.quadraticCurveTo(x - hw / 12, 5 + (i % 2) * 2, x, 0); } g.lineTo(hw, -5); g.quadraticCurveTo(0, -1, -hw, -5); g.closePath(); g.fill(); g.restore(); }
        g.fillStyle = 'rgba(120,180,230,.35)'; for (const [y, hw] of [[-83, 34], [-41, 54]]) { g.beginPath(); g.ellipse(0, y + 2.5, hw * 0.8, 1.6, 0, 0, TAU); g.fill(); }
        g.restore();
        // шарики
        for (const [x, y, r, col] of [[-26, -24, 5.5, '#ff4a5a'], [22, -18, 5, '#ffcc3a'], [-4, -11, 4.6, '#4aa8ff'], [28, -34, 3.8, '#c070ff'], [-25, -60, 4, '#ffcc3a'], [26, -58, 4, '#ff4a5a'], [7, -92, 3.4, '#4aa8ff']]) {
          g.strokeStyle = '#8a8a9a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - r - 3); g.lineTo(x, y - r); g.stroke();
          ball(g, x, y + Math.sin(st.t * 3 + x) * s * 0.8, r, col, shade(col, -0.55));
        }
        shine(g, -9, -94, 2.6, 5);
        eye(g, -12, -67, 8.5, st, { happy: true }); eye(g, 12, -67, 8.5, st, { happy: true });
        cheeks(g, 0, -57, 21, 5); mouth(g, 0, -55, 16, s * 0.9);
      },
    },
    morozik: {
      name: 'Морозик', el: ['wind'], part: 'strings', price: 900, rate: 34, need: 7,
      desc: 'Морозное облачко с кудрявой ледяной бородой играет на скрипочке — и на окнах расцветают узоры.', col: '#c4b8ff',
      draw(g, st) {
        const c = this.col, s = st.sing, OL = '#4b3d9c', off = Math.sin(st.t * 4.2) * s * 10, VA = 0.45, VX = -27, VY = -21;
        // три льдинки на макушке
        for (const [x, y, a, l] of [[-11, -95, -0.4, 10], [1, -99, 0.05, 13], [12, -95, 0.45, 9]]) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#d8f6ff'; g.strokeStyle = OL; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-4.5, 4); g.quadraticCurveTo(-3, -l * 0.5, 0, -l); g.quadraticCurveTo(3, -l * 0.5, 4.5, 4); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-1.2, -l * 0.35, 1, l * 0.3, 0, 0, TAU); g.fill(); g.restore(); }
        feet(g, 76, '#9e92e6');
        const puffs = [[0, -54, 38, 34], [-31, -44, 19, 19], [31, -44, 19, 19], [-19, -80, 18, 16], [18, -82, 19, 17], [0, -90, 17, 14], [0, -24, 34, 21], [-36, -64, 11, 11], [36, -66, 11, 11]];
        const cf = g.createLinearGradient(0, -104, 0, 0); cf.addColorStop(0, '#ffffff'); cf.addColorStop(0.5, '#e6e0ff'); cf.addColorStop(1, '#a99cf0');
        silhouette(g, puffs.map(([x, y, rx, ry]) => ({ path: p => p.ellipse(x, y, rx, ry, 0, 0, TAU), fill: cf })), c, OL);
        // морозные узоры
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5; g.lineCap = 'round';
        for (const [x, y, r] of [[-34, -60, 6], [35, -58, 5], [-30, -88, 4]]) { g.save(); g.translate(x, y); g.rotate(0.3); flakePath(g, r); g.stroke(); g.restore(); }
        shine(g, -16, -86, 7, 4.5);
        eye(g, -13, -68, 8.5, st, { iris: '#5a4ad0', lid: 1 }); eye(g, 13, -68, 8.5, st, { iris: '#5a4ad0', lid: 1 });
        // пушистые брови
        for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 5, -83 - s * 1.5); g.quadraticCurveTo(k * 13, -90 - s * 2.5, k * 21, -84); g.strokeStyle = OL; g.lineWidth = 6.5; g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 3.6; g.stroke(); }
        cheeks(g, 0, -56, 25, 5);
        // кудрявая ледяная борода
        const curls = [[-18, -41, 8], [18, -41, 8], [-8, -37, 8.5], [8, -37, 8.5], [0, -30, 9], [-13, -27, 7.5], [13, -27, 7.5], [0, -19, 7]];
        const bf = g.createLinearGradient(0, -48, 0, -10); bf.addColorStop(0, '#f6feff'); bf.addColorStop(1, '#a8e2fa');
        const sway = i => Math.sin(st.t * 2 + i) * 0.7;
        silhouette(g, curls.map(([x, y, r], i) => ({ path: p => p.arc(x + sway(i), y, r, 0, TAU), fill: bf })), c, '#2f6f9a', 2.4);
        // в каждом колечке — завиток-спираль
        g.strokeStyle = rgba('#2f6f9a', 0.6); g.lineWidth = 1.5; curls.forEach(([x, y, r], i) => { g.beginPath(); for (let j = 0; j <= 16; j++) { const q = j / 16, a = (i % 2 ? -1 : 1) * q * TAU * 1.15, rr = r * (0.12 + 0.5 * q); g.lineTo(x + sway(i) + 0.5 + Math.cos(a) * rr, y + 0.5 + Math.sin(a) * rr); } g.stroke(); });
        sparkle(g, 15, -31, 2.6, 0.9);
        mouth(g, 0, -52, 15, s * 0.8, s > 0.1 ? 'o' : 'smile');
        // скрипочка у левого бока
        g.save(); g.translate(VX, VY); g.rotate(VA);
        g.fillStyle = '#3a1a0c'; g.beginPath(); g.roundRect(-36, -2.2, 26, 4.4, 2); g.fill(); g.beginPath(); g.arc(-37, 0, 3.6, 0, TAU); g.fill();
        g.fillStyle = '#c4622a'; g.strokeStyle = '#4a1e0c'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(-12, 0); g.bezierCurveTo(-12, -9, -3, -9, -2, -5); g.bezierCurveTo(-1, -3, 1, -3, 2, -5); g.bezierCurveTo(4, -11, 14, -10, 14, 0); g.bezierCurveTo(14, 10, 4, 11, 2, 5); g.bezierCurveTo(1, 3, -1, 3, -2, 5); g.bezierCurveTo(-3, 9, -12, 9, -12, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,220,170,.5)'; g.beginPath(); g.ellipse(-6, -3, 3, 1.8, 0, 0, TAU); g.fill();
        g.strokeStyle = '#2a1006'; g.lineWidth = 1.2; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(3, d * 5); g.quadraticCurveTo(5, d * 3, 3, d * 1.5); g.stroke(); }
        g.fillStyle = '#2a1006'; g.beginPath(); g.roundRect(8, -2.5, 6, 5, 1.5); g.fill();
        g.strokeStyle = 'rgba(255,240,200,.9)'; g.lineWidth = 0.8; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(-34, d * 0.9); g.lineTo(9, d * 0.9); g.stroke(); }
        g.restore();
        const nx = VX - Math.cos(VA) * 28, ny = VY - Math.sin(VA) * 28;
        reach(g, -38, -40, nx + 1, ny - 2, '#ece8ff', OL, 8);
        // смычок ходит туда-обратно
        const bx = VX + Math.cos(VA) * 3, by = VY + Math.sin(VA) * 3, dx = Math.cos(-0.12), dy = Math.sin(-0.12);
        const a0 = [bx + dx * (-12 + off), by + dy * (-12 + off)], a1 = [bx + dx * (44 + off), by + dy * (44 + off)];
        g.lineCap = 'round'; g.strokeStyle = '#2a1006'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(...a0); g.lineTo(...a1); g.stroke();
        g.strokeStyle = '#a0602a'; g.lineWidth = 2.2; g.stroke();
        g.strokeStyle = '#fffbe8'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(a0[0] - dy * 3, a0[1] + dx * 3); g.lineTo(a1[0] - dy * 3 - dx * 4, a1[1] + dx * 3 - dy * 4); g.stroke();
        reach(g, 36, -36, a1[0] - dx * 4, a1[1] - dy * 4, '#ece8ff', OL, 8);
      },
    },
    shishka: {
      name: 'Шишка', el: ['leaf'], part: 'woodblock', price: 1000, rate: 36, need: 7,
      desc: 'Сосновая шишка с хвойным чубчиком стучит палочкой по деревянной коробочке: тук-тук-тук!', col: '#b0703c',
      draw(g, st) {
        const w = 84, h = 104, c = this.col, s = st.sing, O = shade(c, -0.6), ph = Math.sin(st.t * 13), up = Math.max(0, ph) * s, knock = Math.max(0, -ph) * s, AC = '#dba068';
        // хвойный чубчик
        g.lineCap = 'round';
        for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.28 + Math.sin(st.t * 2.5 + i) * 0.05, L = 15 - Math.abs(i) * 1.5; g.strokeStyle = '#1f5a2a'; g.lineWidth = 4.6; g.beginPath(); g.moveTo(2, -100); g.lineTo(2 + Math.cos(a) * L, -100 + Math.sin(a) * L); g.stroke(); g.strokeStyle = i % 2 ? '#4fae4a' : '#6ccc5a'; g.lineWidth = 2.4; g.stroke(); }
        feet(g, w, c);
        const cone = p => { p.moveTo(0, -h); p.bezierCurveTo(20, -h + 2, 42, -74, 42, -42); p.bezierCurveTo(42, -10, 28, 0, 0, 0); p.bezierCurveTo(-28, 0, -42, -10, -42, -42); p.bezierCurveTo(-42, -74, -20, -h + 2, 0, -h); p.closePath(); };
        silhouette(g, [{ path: cone, fill: blobFill(g, c, w, h) }], c, O);
        // чешуйки внахлёст: нижние ряды первыми
        const cp = new Path2D(); cone(cp); g.save(); g.clip(cp);
        for (let r = 8; r >= 0; r--) {
          const y = -96 + r * 11, odd = r % 2 ? 7 : 0, sc = g.createLinearGradient(0, y - 6, 0, y + 9); sc.addColorStop(0, shade(c, -0.12)); sc.addColorStop(1, shade(c, 0.22));
          g.fillStyle = sc; g.strokeStyle = rgba('#3a1a08', 0.55); g.lineWidth = 1.8;
          for (let x = -49 + odd; x < 52; x += 14) {
            g.beginPath(); g.moveTo(x - 7.5, y - 8); g.lineTo(x - 7.5, y); g.quadraticCurveTo(x - 7, y + 9, x, y + 10); g.quadraticCurveTo(x + 7, y + 9, x + 7.5, y); g.lineTo(x + 7.5, y - 8); g.closePath(); g.fill();
            g.beginPath(); g.moveTo(x - 7.5, y); g.quadraticCurveTo(x - 7, y + 9, x, y + 10); g.quadraticCurveTo(x + 7, y + 9, x + 7.5, y); g.stroke();
          }
        }
        g.restore();
        // светлая мордочка
        g.fillStyle = '#f0c48a'; g.strokeStyle = rgba('#5a2e10', 0.6); g.lineWidth = 2.2; g.beginPath(); g.ellipse(0, -54, 27, 23, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-8, -67, 12, 5, -0.2, 0, TAU); g.fill();
        shine(g, -16, -88, 4, 7);
        eye(g, -11, -59, 8.5, st, { iris: '#6a3a14' }); eye(g, 11, -59, 8.5, st, { iris: '#6a3a14' });
        cheeks(g, 0, -47, 18, 4.5); mouth(g, 0, -45, 15, s * 0.8, s > 0.5 ? 'teeth' : 'smile');
        // деревянная коробочка в лапке
        g.save(); g.translate(-4, -16); g.rotate(-0.05); g.scale(1, 1 - knock * 0.06);
        g.fillStyle = '#e6aa60'; g.strokeStyle = '#5a3212'; g.lineWidth = 2.4; g.beginPath(); g.roundRect(-20, -8, 40, 16, 7); g.fill(); g.stroke();
        g.fillStyle = '#5a3212'; g.beginPath(); g.roundRect(-14, -1.4, 28, 3.2, 1.6); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.roundRect(-15, -5.6, 20, 2.6, 1.3); g.fill();
        g.strokeStyle = 'rgba(90,50,18,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-16, 4.5); g.quadraticCurveTo(0, 6.5, 16, 4.5); g.stroke();
        g.restore();
        if (knock > 0.35) { g.strokeStyle = `rgba(110,60,20,${knock})`; g.lineWidth = 2.2; for (const a of [-2.9, -2.4, -0.4]) { g.beginPath(); g.moveTo(13 + Math.cos(a) * 9, -23 + Math.sin(a) * 7); g.lineTo(13 + Math.cos(a) * 15, -23 + Math.sin(a) * 11); g.stroke(); } }
        // левая лапка придерживает коробочку, правая стучит палочкой
        arm(g, -38, -30, 0.5, 17, AC, 9);
        g.save(); g.translate(31, -26); g.rotate(Math.PI - 0.24 + up * 0.45); g.strokeStyle = '#4a2a10'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(18, 0); g.stroke(); g.strokeStyle = '#d89a50'; g.lineWidth = 2.4; g.stroke(); g.fillStyle = '#7a4218'; g.strokeStyle = '#3a1a08'; g.lineWidth = 1.6; g.beginPath(); g.arc(18, 0, 3.8, 0, TAU); g.fill(); g.stroke(); g.restore();
        reach(g, 40, -37, 31 + up * 1.5, -26 - up * 2, shade(AC, -0.05), shade(AC, -0.55), 9);
      },
    },
    // ---------- элитные
    snezhinka: {
      name: 'Снежинка', el: ['water', 'wind'], part: 'icesoprano', rate: 60, hover: true,
      desc: 'Снежная фея в хрустальной короне поёт сопрано так тонко, что вокруг вспыхивают искры инея.', col: '#e4eeff',
      draw(g, st) {
        const c = this.col, s = st.sing, OL = '#4a62c0', fl = Math.sin(st.t * 9) * (0.18 + s * 0.15);
        glow(g, 0, -54, 62, '#8fdcff', 0.4 + s * 0.3);
        // хрустальный ореол-снежинка за спиной
        g.save(); g.translate(0, -54); g.rotate(st.t * 0.3); g.lineCap = 'round'; g.lineJoin = 'round';
        flakePath(g, 43); g.strokeStyle = rgba('#5a7ad8', 0.7); g.lineWidth = 6.5; g.stroke(); g.strokeStyle = '#e2faff'; g.lineWidth = 3.6; g.stroke();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2; g.save(); g.translate(Math.cos(a) * 43, Math.sin(a) * 43); g.rotate(a + Math.PI / 2); g.fillStyle = '#ffffff'; g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, -5); g.lineTo(3.2, 0); g.lineTo(0, 5); g.lineTo(-3.2, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); }
        g.restore();
        // крошечные крылышки-льдинки
        for (const k of [-1, 1]) {
          g.save(); g.translate(k * 20, -62); g.rotate(k * (-0.25 + fl));
          g.fillStyle = 'rgba(255,224,246,.95)'; g.strokeStyle = '#8a4aa8'; g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(0, 3); g.lineTo(k * 17, -14); g.lineTo(k * 23, -4); g.lineTo(k * 15, 4); g.lineTo(k * 19, 11); g.lineTo(k * 7, 10); g.closePath(); g.fill(); g.stroke();
          g.strokeStyle = '#ffffff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(k * 3, 2); g.lineTo(k * 16, -9); g.moveTo(k * 3, 5); g.lineTo(k * 15, 8); g.stroke();
          g.restore();
        }
        // ножки в сапожках
        for (const k of [-1, 1]) { g.fillStyle = '#b48aee'; g.strokeStyle = '#4a3290'; g.lineWidth = 2; g.beginPath(); g.ellipse(k * 7, -6 + Math.sin(st.t * 3 + k) * 1.5, 4.2, 5, 0, 0, TAU); g.fill(); g.stroke(); }
        // юбочка-лепестки и тело
        const dressF = g.createLinearGradient(0, -36, 0, -8); dressF.addColorStop(0, '#f2e2ff'); dressF.addColorStop(1, '#c8a6f6');
        const dress = p => { p.moveTo(-15, -34); p.lineTo(15, -34); p.quadraticCurveTo(22, -24, 26, -15); for (let i = 0; i < 5; i++) { const x0 = 26 - i * 10.4, x1 = x0 - 10.4; p.quadraticCurveTo((x0 + x1) / 2, -3, x1, -15); } p.quadraticCurveTo(-22, -24, -15, -34); p.closePath(); };
        const bodyF = g.createLinearGradient(0, -80, 0, -26); bodyF.addColorStop(0, '#ffffff'); bodyF.addColorStop(0.6, '#eef4ff'); bodyF.addColorStop(1, '#bccdf6');
        silhouette(g, [{ path: dress, fill: dressF }, { path: p => p.ellipse(0, -52, 27, 26, 0, 0, TAU), fill: bodyF }], c, OL);
        for (const [x, y] of [[-14, -18], [0, -15], [14, -18], [-7, -25], [7, -25]]) sparkle(g, x, y, 2.6, 0.9, '#9a7ae8');
        // хрустальная корона
        g.save(); g.translate(0, -76);
        for (const [x, y, l] of [[-13, -3, 7], [-6.5, -6, 10], [0, -7, 15], [6.5, -6, 10], [13, -3, 7]]) { g.fillStyle = '#c6f2ff'; g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x - 3.4, y + 3); g.lineTo(x, y - l); g.lineTo(x + 3.4, y + 3); g.closePath(); g.fill(); g.stroke(); }
        g.fillStyle = '#e8f8ff'; g.beginPath(); g.roundRect(-16, -3, 32, 5, 2.5); g.fill(); g.stroke();
        g.fillStyle = '#ff7ac8'; g.beginPath(); g.arc(0, -1, 2.6, 0, TAU); g.fill();
        g.restore();
        sparkle(g, 0, -93, 3.5 + s * 2.5, 0.6 + s * 0.4, '#ff9ade');
        shine(g, -12, -66, 6, 4);
        for (const k of [-1, 1]) {
          eye(g, k * 11, -53, 9, st, { iris: '#5b6ee8', lid: 1 });
          if (!(st.blink > 0.5)) { g.strokeStyle = '#2a1a22'; g.lineWidth = 1.8; g.lineCap = 'round'; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(k * (17 + i * 2), -60 + i * 3); g.lineTo(k * (21 + i * 2.5), -63 + i * 3.5); g.stroke(); } }
        }
        cheeks(g, 0, -42, 18, 4.2); mouth(g, 0, -38, 12, s, 'o');
        // ручки: на высокой ноте раскрывает их в стороны
        const aa = Math.PI * 0.7 + s * 1.1;
        limb(g, -17, -34, aa, 12, '#eef4ff', OL, 7); limb(g, 17, -34, Math.PI - aa, 12, '#eef4ff', OL, 7);
        // искры инея: кружат всегда, на ноте вспыхивают
        for (let i = 0; i < 7; i++) { const a = st.t * 0.7 + i * TAU / 7, rr = 52 + Math.sin(st.t * 1.3 + i) * 5, tw = (Math.sin(st.t * 5 + i * 2.1) + 1) / 2; sparkle(g, Math.cos(a) * rr, -54 + Math.sin(a) * rr * 0.75, 2 + tw * 2 + s * 3, 0.3 + 0.25 * tw + s * 0.6 * tw, i % 2 ? '#5cc8ff' : '#b08aff'); }
      },
    },
    yetik: {
      name: 'Йетик', el: ['leaf', 'water'], part: 'baritone', rate: 60,
      desc: 'Пушистый йети-малыш в полосатой шапке и меховых наушниках согревает весь остров бархатным баритоном.', col: '#e2eefb',
      draw(g, st) {
        const c = this.col, s = st.sing, OL = '#365e8c', w = 104, h = 97, FUR = '#d2e3f7';
        // мохнатая лапа: пушистая «колбаска» от плеча до кисти
        const furArm = (x0, y0, x1, y1, wd) => { g.save(); g.translate((x0 + x1) / 2, (y0 + y1) / 2); g.rotate(Math.atan2(y1 - y0, x1 - x0)); const L = Math.hypot(x1 - x0, y1 - y0) / 2 + wd * 0.4; g.beginPath(); bumpy(g, 0, 0, L, wd / 2, 14, -1.5); g.fillStyle = FUR; g.strokeStyle = OL; g.lineWidth = 2.6; g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(0, -wd * 0.16, L * 0.7, wd * 0.16, 0, 0, TAU); g.fill(); g.restore(); };
        const paw = (x, y, r, palm) => { g.beginPath(); bumpy(g, x, y, r, r * 0.92, 10, -1.2); g.fillStyle = FUR; g.strokeStyle = OL; g.lineWidth = 2.4; g.fill(); g.stroke(); g.fillStyle = '#8fb2dc'; if (palm) { g.beginPath(); g.ellipse(x, y + 1.5, r * 0.42, r * 0.34, 0, 0, TAU); g.fill(); for (const d of [-1, 0, 1]) { g.beginPath(); g.arc(x + d * r * 0.42, y - r * 0.42 + Math.abs(d) * 1.2, r * 0.16, 0, TAU); g.fill(); } } else { g.strokeStyle = rgba('#365e8c', 0.6); g.lineWidth = 1.5; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + d * r * 0.3, y - r * 0.2); g.lineTo(x + d * r * 0.3, y + r * 0.5); g.stroke(); } } };
        glow(g, 0, -56, 66, '#ffd27a', 0.16 + s * 0.3);
        // снежинки кружат позади
        for (let i = 0; i < 3; i++) { const a = st.t * 0.5 + i * TAU / 3; flake(g, Math.cos(a) * 53, -70 + Math.sin(a) * 26, 6, st.t + i, OL, '#e8faff', 1.6); }
        // большие пушистые ступни
        for (const k of [-1, 1]) { g.fillStyle = '#a8c4e6'; g.strokeStyle = OL; g.lineWidth = 2.6; g.beginPath(); g.ellipse(k * 24, -3, 17, 7.5, 0, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = rgba('#365e8c', 0.6); g.lineWidth = 1.6; for (const d of [-5, 0, 5]) { g.beginPath(); g.moveTo(k * 24 + d, -8); g.lineTo(k * 24 + d, -4); g.stroke(); } }
        const fur = g.createLinearGradient(0, -h, 0, 0); fur.addColorStop(0, '#ffffff'); fur.addColorStop(0.55, '#e4effb'); fur.addColorStop(1, '#b0cbec');
        silhouette(g, [{ path: p => bumpy(p, 0, -h / 2, w / 2, h / 2, 30, -3.4, -2), fill: fur }], c, OL);
        // шерсть-штрихи и светлое пузо
        g.strokeStyle = rgba('#4a7ab0', 0.3); g.lineWidth = 1.6; g.lineCap = 'round';
        for (const [x, y] of [[-38, -26], [-30, -14], [38, -24], [30, -12], [-42, -58], [42, -56]]) { g.beginPath(); g.moveTo(x - 3, y - 4); g.lineTo(x, y); g.lineTo(x + 3, y - 4); g.stroke(); }
        g.fillStyle = '#f6faff'; g.beginPath(); bumpy(g, 0, -22, 25, 16, 14, -1.6); g.fill();
        // наушники: ободок и меховые подушечки
        g.strokeStyle = OL; g.lineWidth = 7; g.beginPath(); g.moveTo(-44, -76); g.quadraticCurveTo(-40, -89, -27, -90); g.moveTo(44, -76); g.quadraticCurveTo(40, -89, 27, -90); g.stroke();
        g.strokeStyle = '#ff7aa0'; g.lineWidth = 3.6; g.stroke();
        for (const k of [-1, 1]) { g.fillStyle = '#ff9ab8'; g.strokeStyle = '#8a2a50'; g.lineWidth = 2.4; g.beginPath(); bumpy(g, k * 47, -68, 11, 12, 12, 1.8); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(k * 47 - 3, -72, 4, 3, -0.4, 0, TAU); g.fill(); }
        // мордочка
        g.fillStyle = '#bcd5f0'; g.strokeStyle = rgba('#365e8c', 0.55); g.lineWidth = 2; g.beginPath(); bumpy(g, 0, -60, 31, 24, 18, -1.8); g.fill(); g.stroke();
        eye(g, -13, -66, 9, st, { iris: '#3a78c0', lid: 1 }); eye(g, 13, -66, 9, st, { iris: '#3a78c0', lid: 1 });
        g.strokeStyle = OL; g.lineWidth = 2.6; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 7, -79 - s * 1.5); g.quadraticCurveTo(k * 14, -82 - s * 2, k * 21, -79); g.stroke(); }
        g.fillStyle = '#2f4a78'; g.beginPath(); g.ellipse(0, -55, 5.5, 3.8, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-1.8, -56.2, 1.8, 1, 0, 0, TAU); g.fill();
        cheeks(g, 0, -52, 24, 5.5); mouth(g, 0, -44, 20, 0.12 + s * 0.88, 'o');
        // полосатая шапка с помпоном и снежинкой
        g.save(); g.translate(0, -88); g.rotate(-0.07);
        const dome = p => { p.moveTo(-32, 0); p.bezierCurveTo(-32, -29, 32, -29, 32, 0); p.closePath(); };
        const dp = new Path2D(); dome(dp); g.fillStyle = '#e8485a'; g.strokeStyle = '#6a1424'; g.lineWidth = 2.6; g.fill(dp);
        g.save(); g.clip(dp); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#2fb6c8' : '#fff4e6'; g.fillRect(-34, -19 + i * 5, 68, 2.8); } g.restore();
        g.stroke(dp);
        g.fillStyle = '#fff4e6'; g.beginPath(); g.roundRect(-34, -4, 68, 11, 5); g.fill(); g.stroke();
        g.strokeStyle = rgba('#6a1424', 0.35); g.lineWidth = 1.4; for (let x = -28; x <= 28; x += 5) { g.beginPath(); g.moveTo(x, -2); g.lineTo(x, 5); g.stroke(); }
        flake(g, 18, 1.5, 5, 0.2, '#2a4a8a', '#7fe0ff', 1.3);
        g.fillStyle = '#ffffff'; g.strokeStyle = OL; g.lineWidth = 2.4; g.beginPath(); bumpy(g, 2, -20, 7.5, 7, 10, 1.5); g.fill(); g.stroke();
        g.restore();
        // лапа на груди, другая раскрывается на долгой ноте
        furArm(-45, -42, -20, -33, 15); paw(-17, -32, 9, false);
        const ang = 0.8 - s * 1.75, hx = 41 + Math.cos(ang) * 14, hy = -45 + Math.sin(ang) * 14;
        furArm(41, -45, hx, hy, 15); paw(hx, hy, 9, true);
      },
    },
  });
})();
