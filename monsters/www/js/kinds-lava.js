// =====================================================================
//  Остров «Вулкан»: 8 огненно-каменных монстров (6 обычных и 2 элитных).
//  Рисуются теми же общими частями, что и в monsters.js (silhouette, eye, mouth, arm…);
//  свои помощники — внутри замыкания: все скрипты игры делят одну глобальную область.
// =====================================================================
(() => {
  const TAU = Math.PI * 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  // гладкий замкнутый контур через точки (Катмулл — Ром); k < 1 — грани острее
  function smooth(p, P, k = 1) {
    const n = P.length; p.moveTo(P[0][0], P[0][1]);
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
      p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6 * k, b[1] + (c[1] - a[1]) / 6 * k, c[0] - (d[0] - b[0]) / 6 * k, c[1] - (d[1] - b[1]) / 6 * k, c[0], c[1]);
    }
    p.closePath();
  }
  function poly(p, P) { P.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); }
  // точки фигуры, сдвинутые, повёрнутые и растянутые (для частей силуэта)
  const xf = (P, x, y, sx, sy, a) => P.map(([px, py]) => [x + (px * sx) * Math.cos(a) - (py * sy) * Math.sin(a), y + (px * sx) * Math.sin(a) + (py * sy) * Math.cos(a)]);
  function circ(p, x, y, r) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); }
  // мягкое свечение (градиент дешевле shadowBlur на телефоне)
  function glow(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // раскалённая трещина: свечение, тёмный край, огонь и жёлтая сердцевина; k — накал 0…1
  // трещина сужается к концу: каждый отрезок тоньше предыдущего
  function ember(g, pts, k, w = 3) {
    const n = pts.length - 1, layer = (col, f, add = 0) => {
      g.strokeStyle = col;
      for (let i = 0; i < n; i++) { g.lineWidth = w * (1 - 0.5 * i / Math.max(1, n - 1)) * f + add; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke(); }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    layer(`rgba(255,120,30,${0.15 + 0.3 * k})`, 3.2); layer('#3a140c', 1, 1.8);
    layer(`rgb(255,${100 + 60 * k | 0},30)`, 1); layer(`rgba(255,240,150,${0.35 + 0.65 * k})`, 0.4);
  }
  // искорка-звёздочка
  function spark(g, x, y, r, col = '#ffe680') {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.32 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  // клуб дыма из трёх кружков
  function puff(g, x, y, r, a, col = '#b4aab8') {
    if (a <= 0.01) return;
    g.fillStyle = rgba(col, a); g.beginPath(); circ(g, x, y, r); circ(g, x - r * 0.75, y + r * 0.35, r * 0.62); circ(g, x + r * 0.72, y + r * 0.4, r * 0.58); g.fill();
    g.fillStyle = `rgba(255,255,255,${a * 0.45})`; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.42, 0, TAU); g.fill();
  }
  // рука от плеча к точке
  function reach(g, x1, y1, x2, y2, col, wd) { arm(g, x1, y1, Math.atan2(y2 - y1, x2 - x1), Math.hypot(x2 - x1, y2 - y1), col, wd); }
  // язычок пламени с основанием в (x, y)
  function flame(g, x, y, sc, ang, t, ph, k = 1) {
    const f = (1 + Math.sin(t * 13 + ph) * 0.1 + Math.sin(t * 7.3 + ph * 2) * 0.06) * k, wob = Math.sin(t * 9 + ph) * 3;
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc * f);
    const L = (r, top, col) => { g.beginPath(); g.moveTo(wob * top / 30, -top); g.bezierCurveTo(r * 0.5 + wob * 0.5, -top * 0.6, r * 1.1, -top * 0.35, r, 0); g.quadraticCurveTo(r * 0.8, r * 0.75, 0, r * 0.75); g.quadraticCurveTo(-r * 0.8, r * 0.75, -r, 0); g.bezierCurveTo(-r * 1.1, -top * 0.35, -r * 0.5 + wob * 0.5, -top * 0.6, wob * top / 30, -top); g.fillStyle = col; g.fill(); };
    L(11, 30, '#ff6a1a'); g.strokeStyle = '#8a2a0a'; g.lineWidth = 2.2 / sc; g.stroke();
    L(7.5, 20, '#ffb02a'); L(4, 11, '#fff2a0');
    g.restore();
  }
  // рот с раскалённым нутром (у угольков и вулканов там огонь, а не язык)
  function hotMouth(g, x, y, w, open, teeth) {
    const o = Math.max(0.16, Math.min(1, open)), hh = w * 0.62 * o, ww = w * 0.5;
    const path = () => { g.beginPath(); g.moveTo(x - ww, y - hh * 0.15); g.quadraticCurveTo(x, y - hh * 0.35, x + ww, y - hh * 0.15); g.quadraticCurveTo(x + ww * 0.9, y + hh, x, y + hh); g.quadraticCurveTo(x - ww * 0.9, y + hh, x - ww, y - hh * 0.15); };
    path(); const gr = g.createRadialGradient(x, y + hh * 0.7, 0, x, y + hh * 0.4, ww * 1.1);
    gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.45, '#ff9a2a'); gr.addColorStop(1, '#b02a14'); g.fillStyle = gr; g.fill();
    if (teeth) {
      g.save(); g.clip(); g.fillStyle = '#fff8ea';
      for (const k of [-1, 1]) { g.beginPath(); g.moveTo(x + k * ww * 0.66, y - hh * 0.4); g.lineTo(x + k * ww * 0.26, y - hh * 0.4); g.lineTo(x + k * ww * 0.46, y + hh * 0.18 + 2.5); g.closePath(); g.fill(); }
      g.restore();
    }
    path(); g.strokeStyle = '#2a1a22'; g.lineWidth = 2.6; g.lineJoin = 'round'; g.stroke();
  }
  const blush = (g, x, y, dx, r, a) => { g.fillStyle = rgba('#ff7a2a', a); for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x + k * dx, y, r, r * 0.6, 0, 0, TAU); g.fill(); } };

  Object.assign(KINDS, {
    ugolek: {
      name: 'Уголёк', el: ['fire'], part: 'rockkick', price: 300, rate: 20, need: 3,
      desc: 'Тлеющий уголёк на каменной бочке. Топает так, что дрожит вулкан.', col: '#4b4452',
      draw(g, st) {
        const c = this.col, s = st.sing, hot = clamp01(0.4 + 0.6 * s + Math.sin(st.t * 5) * 0.08), hop = 4 * s * (1 - s) * 5; // между ударами подпрыгивает, на ударе — бух вниз
        // дымок с макушки
        for (let i = 0; i < 3; i++) { const ph = (st.t * 0.45 + i / 3) % 1; puff(g, 8 + Math.sin(ph * 5 + st.t) * 4, -104 - ph * 13, 3 + ph * 4, (1 - ph) * 0.6, '#8a8090'); }
        // каменная бочка, на которой он стоит
        const dc = '#9a6a52', DH = 24, RX = 37, bar = g.createLinearGradient(-RX, 0, RX, 0);
        bar.addColorStop(0, shade(dc, -0.38)); bar.addColorStop(0.35, shade(dc, 0.18)); bar.addColorStop(1, shade(dc, -0.42));
        g.fillStyle = bar; g.strokeStyle = shade(dc, -0.62); g.lineWidth = 2.8; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-RX, -DH); g.quadraticCurveTo(-RX - 5, -DH / 2, -RX + 3, -3); g.ellipse(0, -3, RX - 3, 6, 0, Math.PI, 0, true); g.quadraticCurveTo(RX + 5, -DH / 2, RX, -DH); g.closePath(); g.fill(); g.stroke();
        const band = []; for (let i = 0; i <= 14; i++) { const a = Math.PI - i / 14 * Math.PI; band.push([Math.cos(a) * (RX + 2), -DH / 2 + 1 + Math.sin(a) * 6 + (i % 2 ? 1.6 : -1.2)]); }
        ember(g, band, hot, 2.4);
        g.fillStyle = shade(dc, -0.55); for (let i = 0; i < 9; i++) { const a = Math.PI * (0.08 + i * 0.105); g.beginPath(); g.arc(Math.cos(a) * (RX - 3), -DH + 4 + Math.sin(a) * 7, 1.8, 0, TAU); g.fill(); }
        g.fillStyle = '#f2dcb0'; g.strokeStyle = shade(dc, -0.62); g.beginPath(); g.ellipse(0, -DH, RX, 8, 0, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(120,70,40,.35)'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(0, -DH, RX - 9, 5.5, 0, 0, TAU); g.stroke();
        if (s > 0.05) { g.fillStyle = `rgba(255,150,40,${s * 0.6})`; g.beginPath(); g.ellipse(0, -DH, RX - 1, 7.5, 0, 0, TAU); g.fill(); }
        // сам уголёк — стоит на бочке и топает
        g.save(); g.translate(0, -DH - hop); g.scale(1 + s * 0.05, 1 - s * 0.08);
        arm(g, -38, -36, lerp(Math.PI * 0.72, Math.PI * 1.2, s), 18, c, 10); arm(g, 38, -36, lerp(Math.PI * 0.28, -Math.PI * 0.2, s), 18, c, 10);
        for (const k of [-1, 1]) { g.fillStyle = shade(c, -0.3); g.strokeStyle = shade(c, -0.62); g.lineWidth = 2.6; g.beginPath(); g.ellipse(k * 19, -2, 13, 6, 0, 0, TAU); g.fill(); g.stroke(); }
        const P = [[-44, -12], [-46, -40], [-36, -64], [-16, -79], [10, -80], [32, -68], [45, -44], [44, -14], [28, -1], [-28, -1]];
        const body = new Path2D(); smooth(body, P, 0.85);
        silhouette(g, [{ path: p => smooth(p, P, 0.85), fill: blobFill(g, c, 90, 80) }], c, shade(c, -0.62));
        g.save(); g.clip(body);
        ember(g, [[-54, -44], [-43, -39], [-40, -31], [-44, -23], [-39, -15]], hot, 3.2);
        ember(g, [[54, -60], [43, -55], [40, -47], [43, -42]], hot);
        ember(g, [[18, -86], [16, -77], [11, -72]], hot, 2.6); ember(g, [[30, 4], [24, -5], [26, -11]], hot, 2.4);
        g.restore();
        shine(g, -20, -62, 6, 9);
        spark(g, -28, -50, 3.2, 'rgba(255,255,255,.85)'); spark(g, 26, -64, 2.4, 'rgba(255,255,255,.7)'); spark(g, 30, -22, 2, 'rgba(255,255,255,.6)');
        eye(g, -16, -50, 10, st, { iris: '#ff7a1a' }); eye(g, 16, -50, 10, st, { iris: '#ff7a1a' });
        hotMouth(g, 0, -33, 24, s); blush(g, 0, -37, 27, 6.5, 0.35 + 0.25 * s);
        g.restore();
        // искры из-под ног на сильной доле
        if (s > 0.35) { const a = clamp01((s - 0.35) * 1.8), u = 1 - s; for (const [x, y] of [[-42, -22], [-50, -34], [44, -24], [52, -36]]) spark(g, x + Math.sign(x) * u * 10, y - u * 16, 3.6 * a + 1, rgba('#ffd040', a)); }
      },
    },
    magmus: {
      name: 'Магмус', el: ['stone'], part: 'fuzzbass', price: 400, rate: 22, need: 3,
      desc: 'Жидкая магма в панцире из каменных плит. Его бас гудит, как земля перед извержением.', col: '#ff8a2a',
      draw(g, st) {
        const w = 108, h = 84, c = this.col, s = st.sing, stone = '#6c605c', pluck = Math.sin(st.t * 20) * s;
        feet(g, w, stone);
        const body = new Path2D(); SHAPES.gum(body, w, h);
        const mg = g.createRadialGradient(0, -48, 4, 0, -44, 62); mg.addColorStop(0, '#fff07a'); mg.addColorStop(0.45, '#ffa22a'); mg.addColorStop(1, '#e0401a');
        silhouette(g, [{ path: p => SHAPES.gum(p, w, h), fill: mg }], c, shade(stone, -0.62));
        g.save(); g.clip(body);
        // пузырьки в магме
        g.fillStyle = 'rgba(255,250,190,.55)'; for (const [x, y, r] of [[-28, -28, 3.2], [26, -24, 2.4], [-6, -62, 2], [30, -52, 1.8]]) { g.beginPath(); g.arc(x, y + Math.sin(st.t * 2 + x) * 1.5, r, 0, TAU); g.fill(); }
        // каменные плиты; щели между ними светятся
        const plates = [];
        for (const k of [-1, 1]) plates.push(
          [[k * 2.5, -96], [k * 2.5, -72], [k * 18, -69], [k * 34, -64], [k * 60, -70], [k * 60, -96]],
          [[k * 37, -57], [k * 62, -62], [k * 62, -27], [k * 43, -29], [k * 35, -42]],
          [[k * 39, -23], [k * 62, -21], [k * 62, 4], [k * 30, 4], [k * 31, -12]]);
        plates.push([[-24, -7], [24, -7], [27, 4], [-27, 4]]);
        g.lineJoin = 'round';
        for (const P of plates) { g.beginPath(); poly(g, P); g.strokeStyle = `rgba(255,230,120,${0.45 + 0.4 * s})`; g.lineWidth = 7; g.stroke(); }
        const pf = g.createLinearGradient(0, -90, 0, 0); pf.addColorStop(0, shade(stone, 0.25)); pf.addColorStop(1, shade(stone, -0.3));
        for (const P of plates) {
          g.beginPath(); poly(g, P); g.fillStyle = pf; g.fill(); g.strokeStyle = shade(stone, -0.55); g.lineWidth = 2.2; g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(P[0][0] * 0.96, P[0][1] + 3); g.lineTo(P[1][0], P[1][1] + 3); g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.18)'; for (const [x, y] of [[-30, -84], [20, -80], [-50, -46], [48, -10]]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
        g.fillStyle = LIGHT(g); g.fillRect(-90, -160, 180, 170); g.fillStyle = AO(g); g.fillRect(-90, -36, 180, 40);
        g.restore();
        glow(g, 0, -42, 30, '#fff0a0', 0.15 + 0.25 * s);
        eye(g, -18, -51, 9.5, st, { iris: '#7a2a10', lid: 1 }); eye(g, 18, -51, 9.5, st, { iris: '#7a2a10', lid: 1 });
        mouth(g, 0, -36, 22, s * 0.85, 'teeth'); cheeks(g, 0, -40, 30, 6);
        // бас-гитара из обсидиана
        g.save(); g.translate(-16, -12); g.rotate(-0.4); g.scale(1.12, 1.12);
        const bs = new Path2D(); bs.moveTo(9, -4); bs.bezierCurveTo(13, -14, 2, -16, -4, -10); bs.bezierCurveTo(-11, -14, -23, -12, -23, 0); bs.bezierCurveTo(-23, 12, -11, 15, -4, 10); bs.bezierCurveTo(3, 16, 14, 12, 9, 4); bs.closePath();
        const bg = g.createLinearGradient(0, -14, 0, 14); bg.addColorStop(0, '#5a5274'); bg.addColorStop(1, '#22202e');
        g.fillStyle = bg; g.strokeStyle = '#120e18'; g.lineWidth = 2.6; g.fill(bs); g.stroke(bs);
        g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(-18, 4); g.quadraticCurveTo(-14, -6, -10, -9); g.quadraticCurveTo(-11, -2, -6, 2); g.quadraticCurveTo(-11, 8, -18, 4); g.fill(); // огонёк-наклейка
        g.fillStyle = '#9a6a3a'; g.strokeStyle = '#3a2210'; g.lineWidth = 2; g.beginPath(); g.roundRect(7, -3, 42, 6, 2); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,230,180,.5)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(14 + i * 6, -3); g.lineTo(14 + i * 6, 3); g.stroke(); }
        g.fillStyle = '#22202e'; g.strokeStyle = '#120e18'; g.lineWidth = 2; g.beginPath(); g.roundRect(47, -5, 13, 10, 3); g.fill(); g.stroke();
        g.fillStyle = '#e8e0d0'; for (const [x, y] of [[50, -6.5], [56, -6.5], [50, 6.5], [56, 6.5]]) { g.beginPath(); g.arc(x, y, 1.9, 0, TAU); g.fill(); g.stroke(); }
        g.fillStyle = '#e8e0d0'; g.fillRect(-9, -6, 5, 12); g.fillRect(-18, -5, 2.5, 10);
        g.strokeStyle = '#fff2d0'; g.lineWidth = 0.9; for (let i = 0; i < 4; i++) { const y = -2.2 + i * 1.5, v = Math.sin(st.t * 70 + i) * s * 0.7; g.beginPath(); g.moveTo(-17, y); g.quadraticCurveTo(15, y + v, 48, y); g.stroke(); }
        g.restore();
        arm(g, -50, -30, 0.5 + pluck * 0.2, 20, stone, 10);
        arm(g, 51, -38, Math.PI * 0.88 + Math.sin(st.t * 4) * 0.05, 16, stone, 10);
      },
    },
    iskra: {
      name: 'Искра', el: ['fire'], part: 'riff', price: 500, rate: 24, need: 4,
      desc: 'Шипучая искорка с молниями вместо волос. Режет рифы на крошечной электрогитаре.', col: '#ffcf3a',
      draw(g, st) {
        const w = 72, h = 86, c = this.col, s = st.sing, strum = Math.sin(st.t * 18) * s;
        // искорки вокруг головы
        if (s > 0.08) for (let i = 0; i < 4; i++) { const a = st.t * 2.4 + i * TAU / 4; spark(g, Math.cos(a) * 50, -58 + Math.sin(a) * 36, 2.5 + s * 3.5, rgba('#fff4a0', 0.3 + 0.7 * s)); }
        feet(g, w, '#ff9a2a');
        const B = [[-6, 2], [6, 2], [3, -8], [9, -8], [-1, -28], [0, -14], [-6, -14]];
        const fl = i => 1 + Math.sin(st.t * 23 + i * 2) * 0.06 + s * 0.14;
        const bolts = [[0, -78, 1.05, 1, 0.04], [-15, -73, 0.8, -1, -0.5], [15, -73, 0.8, 1, 0.5]].map(([x, y, sc, m, a], i) => ({ path: p => poly(p, xf(B, x, y, sc * m, sc * fl(i), a)), fill: '#fff4b0' }));
        const spikes = []; for (const k of [-1, 1]) for (const [y, a] of [[-30, 0.35], [-54, -0.25]]) {
          const x = k * 29, ang = k > 0 ? -a : Math.PI + a, px = -Math.sin(ang) * 7, py = Math.cos(ang) * 7;
          spikes.push({ path: p => { p.moveTo(x - k * 6 + px, y + py); p.lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16); p.lineTo(x - k * 6 - px, y - py); p.closePath(); }, fill: '#ffb02a' });
        }
        const bf = g.createLinearGradient(0, -86, 0, 0); bf.addColorStop(0, '#fff6c0'); bf.addColorStop(0.5, c); bf.addColorStop(1, '#ff8a2a');
        silhouette(g, [...bolts, ...spikes, { path: p => SHAPES.pear(p, w, h), fill: bf }], c, '#8a4a10');
        shine(g, -13, -70, 6, 9);
        eye(g, -12, -56, 9, st, { iris: '#2a6aff' }); eye(g, 12, -56, 9, st, { iris: '#2a6aff' });
        g.strokeStyle = '#2a1a22'; g.lineWidth = 2.8; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 5, -67 - s * 2); g.lineTo(k * 19, -71 - s * 3); g.stroke(); }
        mouth(g, 0, -41, 18, s, 'teeth'); cheeks(g, 0, -45, 20, 5);
        reach(g, -30, -40, -21, -30 + Math.sin(st.t * 5) * s, c, 8);
        // крошечная электрогитара
        g.save(); g.translate(8, -20); g.scale(-1.1, 1.1); g.rotate(-0.3);
        const gb = new Path2D(); gb.moveTo(8, -3); gb.lineTo(13, -10); gb.quadraticCurveTo(3, -11, -2, -8); gb.quadraticCurveTo(-14, -11, -15, 0); gb.quadraticCurveTo(-14, 11, -2, 8); gb.quadraticCurveTo(3, 11, 13, 10); gb.lineTo(8, 3); gb.closePath();
        g.fillStyle = '#2f7cff'; g.strokeStyle = '#0e2a6a'; g.lineWidth = 2.4; g.fill(gb); g.stroke(gb);
        g.fillStyle = '#f4f4ff'; g.beginPath(); g.moveTo(-10, 6); g.quadraticCurveTo(-4, 9, 4, 5); g.lineTo(2, 0); g.lineTo(-6, 2); g.closePath(); g.fill();
        g.fillStyle = '#fff04a'; g.beginPath(); g.moveTo(-9, -6); g.lineTo(-3, -6); g.lineTo(-6, -2); g.lineTo(-1, -2); g.lineTo(-9, 4); g.lineTo(-6, -1); g.lineTo(-10, -1); g.closePath(); g.fill(); // молния-наклейка
        g.fillStyle = '#2a2a3a'; g.fillRect(-5, -4, 3, 8); g.fillRect(1, -4, 3, 8);
        g.fillStyle = '#d8a060'; g.strokeStyle = '#5a3210'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(7, -2.2, 27, 4.4, 1.5); g.fill(); g.stroke();
        g.fillStyle = '#2f7cff'; g.strokeStyle = '#0e2a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, -3); g.lineTo(43, -6); g.lineTo(42, 2); g.lineTo(32, 3); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.8; for (let i = 0; i < 3; i++) { const y = -1.2 + i * 1.2, v = Math.sin(st.t * 80 + i) * s * 0.8; g.beginPath(); g.moveTo(-11, y); g.quadraticCurveTo(10, y + v, 33, y); g.stroke(); }
        g.restore();
        arm(g, 28, -36, Math.PI * 0.72 + strum * 0.45, 13, c, 8);
      },
    },
    dymok: {
      name: 'Дымок', el: ['wind'], part: 'organ', price: 600, rate: 26, need: 4,
      desc: 'Кудрявый клуб дыма из жерла вулкана. Играет на органчике и мечтательно жмурится.', col: '#b7aacd',
      draw(g, st) {
        const c = this.col, s = st.sing, ol = '#5a4e76';
        // кудряшки дыма на макушке
        const curl = (x0, y0, cx, cy, R, k) => { const pts = [[x0, y0]]; for (let i = 0; i <= 18; i++) { const u = i / 18, a = (k > 0 ? Math.PI : 0) + k * u * 4.6, r = R * (1 - u * 0.75); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return pts; };
        for (const [x0, y0, cx, cy, R, k] of [[2, -94, 13, -109, 8, 1], [-10, -88, -19, -100, 5.5, -1]]) {
          const sw = Math.sin(st.t * 1.6 + k) * 2, pts = curl(x0, y0, cx + sw, cy, R, k);
          const line = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } };
          g.lineCap = 'round'; g.lineJoin = 'round';
          line(); g.strokeStyle = ol; g.lineWidth = 9; g.stroke();
          line(); g.strokeStyle = '#e4dcf0'; g.lineWidth = 4.2; g.stroke();
        }
        feet(g, 76, '#8f82aa');
        const puffs = [[0, -30, 40, 27], [-30, -44, 19, 19], [30, -44, 19, 19], [0, -62, 31, 27], [-18, -84, 16, 14], [16, -84, 17, 15], [0, -90, 12, 10]];
        const cf = g.createLinearGradient(0, -100, 0, 0); cf.addColorStop(0, '#f2edf8'); cf.addColorStop(0.55, '#c6bada'); cf.addColorStop(1, '#8f82aa');
        silhouette(g, puffs.map(([x, y, rx, ry], i) => { const b = 1 + Math.sin(st.t * 2 + i * 1.7) * 0.03; return { path: p => p.ellipse(x, y, rx * b, ry * b, 0, 0, TAU), fill: cf }; }), c, ol);
        // завитки дыма на боках
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2.2; g.lineCap = 'round';
        for (const [x, y, k] of [[-32, -48, 1], [33, -50, -1]]) { g.beginPath(); for (let i = 0; i <= 14; i++) { const u = i / 14, a = k * u * 4.4, r = 7 * (1 - u * 0.8); (i ? g.lineTo : g.moveTo).call(g, x + Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke(); }
        shine(g, -14, -82, 7, 5);
        eye(g, -12, -64, 8.5, st, { lid: 1, iris: '#6a4aa8' }); eye(g, 12, -64, 8.5, st, { lid: 1, iris: '#6a4aa8' });
        mouth(g, 0, -49, 14, 0.15 + s * 0.6, 'o'); cheeks(g, 0, -53, 21, 5);
        // органчик: трубы, корпус, клавиши
        for (const k of [-1, 1]) [[29, -46], [35, -52]].forEach(([x, top], i) => {
          const px = k * x; g.fillStyle = '#ffd060'; g.strokeStyle = '#7a5410'; g.lineWidth = 2; g.beginPath(); g.roundRect(px - 2.6, top, 5.2, -28 - top, 1.5); g.fill(); g.stroke();
          g.fillStyle = '#5a3a08'; g.beginPath(); g.ellipse(px, top + 6, 1.5, 2.1, 0, 0, TAU); g.fill();
          const ph = (st.t * 0.8 + i * 0.33 + (k > 0 ? 0.5 : 0)) % 1; puff(g, px + Math.sin(ph * 4) * 2, top - 4 - ph * 10, 2.2 + ph * 3, s * (1 - ph) * 0.8, '#c8bedc');
        });
        const wood = g.createLinearGradient(0, -30, 0, -8); wood.addColorStop(0, '#b06a3e'); wood.addColorStop(1, '#6e3820');
        g.fillStyle = '#5a2e18'; g.fillRect(-29, -12, 5, 12); g.fillRect(24, -12, 5, 12);
        g.fillStyle = wood; g.strokeStyle = '#3a1a0c'; g.lineWidth = 2.4; g.beginPath(); g.roundRect(-35, -30, 70, 20, 4); g.fill(); g.stroke();
        g.strokeStyle = '#ffd060'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(-30, -26, 60, 12, 3); g.stroke();
        g.fillStyle = '#ffd060'; for (const k of [-1, 1]) { g.beginPath(); g.arc(k * 22, -20, 2.4, 0, TAU); g.fill(); }
        g.fillStyle = '#fff4c8'; g.beginPath(); g.ellipse(0, -20, 6, 3.4, 0, 0, TAU); g.fill(); g.fillStyle = '#7a4a2a'; g.font = '700 7px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 0, -19.6);
        const kb = [[-31, -37], [31, -37], [34, -30], [-34, -30]];
        g.fillStyle = '#fbf6ee'; g.strokeStyle = '#3a1a0c'; g.lineWidth = 2.2; g.beginPath(); poly(g, kb); g.fill(); g.stroke();
        const n = 10, kx = (u, v) => lerp(lerp(-31, -34, v), lerp(31, 34, v), u), ky = v => lerp(-37, -30, v);
        const on = s > 0.25 ? [Math.floor(st.t * 5) % n, (Math.floor(st.t * 5) + 4) % n] : [];
        g.fillStyle = 'rgba(255,170,90,.75)'; for (const i of on) { g.beginPath(); poly(g, [[kx(i / n, 0), ky(0)], [kx((i + 1) / n, 0), ky(0)], [kx((i + 1) / n, 1), ky(1)], [kx(i / n, 1), ky(1)]]); g.fill(); }
        g.strokeStyle = 'rgba(58,26,12,.55)'; g.lineWidth = 1; for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(kx(i / n, 0), ky(0)); g.lineTo(kx(i / n, 1), ky(1)); g.stroke(); }
        g.fillStyle = '#2a1a22'; for (const i of [1, 2, 4, 5, 6, 8, 9]) { const u = i / n; g.beginPath(); poly(g, [[kx(u - 0.025, 0), ky(0)], [kx(u + 0.025, 0), ky(0)], [kx(u + 0.025, 0.55), ky(0.55)], [kx(u - 0.025, 0.55), ky(0.55)]]); g.fill(); }
        for (const k of [-1, 1]) {
          const pr = Math.sin(st.t * 10 + (k > 0 ? Math.PI : 0)) * s * 2, hx = k * 14, hy = -37 + pr;
          g.fillStyle = '#d6cce6'; g.strokeStyle = ol; g.lineWidth = 2.4;
          g.beginPath(); circ(g, hx + k * 7, hy - 4, 5.5); g.fill(); g.stroke();
          g.beginPath(); g.ellipse(hx, hy, 8, 6, 0, 0, TAU); g.fill(); g.stroke();
          g.fillStyle = '#d6cce6'; g.beginPath(); g.arc(hx + k * 7, hy - 4, 4.2, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(hx - 2, hy - 2.5, 3, 1.6, -0.3, 0, TAU); g.fill();
        }
      },
    },
    perchik: {
      name: 'Перчик', el: ['fire'], part: 'cowbell', price: 700, rate: 28, need: 5,
      desc: 'Острый перчик в зелёной шапочке. Звонко стучит по боталу — от этого «донг!» всем жарко.', col: '#e8342a',
      draw(g, st) {
        const c = this.col, s = st.sing;
        // пар из-под шапочки — острый же!
        if (s > 0.2) for (const k of [-1, 1]) { const ph = (st.t * 0.9 + (k > 0 ? 0.5 : 0)) % 1; puff(g, k * (30 + ph * 8), -92 - ph * 16, 3 + ph * 4, (s - 0.2) * (1 - ph) * 0.9, '#ffffff'); }
        feet(g, 60, '#b8221c');
        const P = [[0, -95], [20, -93], [32, -81], [33, -60], [28, -38], [22, -21], [26, -11], [35, -9], [41, -15], [39, -5], [26, 1], [6, 0], [-10, -1], [-22, -10], [-29, -30], [-33, -56], [-32, -80], [-20, -93]];
        silhouette(g, [{ path: p => smooth(p, P), fill: blobFill(g, c, 66, 96) }], c, shade(c, -0.6));
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-22, -78); g.quadraticCurveTo(-29, -58, -23, -40); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-22, -34, 2.2, 0, TAU); g.fill();
        // хвостик-шапочка
        const sw = Math.sin(st.t * 2.2) * 2;
        g.lineCap = 'round'; for (const [col, lw] of [['#1f5a1a', 10], ['#5cbf3e', 5.5]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, -98); g.quadraticCurveTo(-2, -111, 8 + sw, -114); g.quadraticCurveTo(15 + sw, -116, 17 + sw * 1.2, -109); g.stroke(); }
        g.fillStyle = '#4caf3a'; g.strokeStyle = '#1f5a1a'; g.lineWidth = 2.6; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-26, -88); g.quadraticCurveTo(-28, -76, -19, -79); g.quadraticCurveTo(-14, -73, -8, -81); g.quadraticCurveTo(-1, -74, 5, -81); g.quadraticCurveTo(12, -74, 17, -80); g.quadraticCurveTo(27, -77, 26, -88); g.quadraticCurveTo(14, -104, 0, -103); g.quadraticCurveTo(-16, -103, -26, -88); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-16, -94); g.quadraticCurveTo(-6, -100, 6, -99); g.stroke();
        eye(g, -12, -62, 9, st); eye(g, 12, -62, 9, st);
        mouth(g, 0, -46, 20, s, 'teeth'); blush(g, 0, -50, 21, 5.5, 0.45);
        // ботало в левой руке, палочка в правой
        reach(g, -29, -34, -20, -13, c, 9);
        g.save(); g.translate(-6, -17); g.rotate(-0.3 + Math.sin(st.t * 30) * s * 0.04);
        g.fillStyle = '#6a6e80'; g.strokeStyle = '#2a2c38'; g.lineWidth = 2; g.beginPath(); g.roundRect(-17, -2.5, 7, 5, 1.5); g.fill(); g.stroke();
        const bell = g.createLinearGradient(0, -9, 0, 9); bell.addColorStop(0, '#f6f8ff'); bell.addColorStop(0.5, '#c4cad8'); bell.addColorStop(1, '#868ea2');
        g.fillStyle = bell; g.strokeStyle = '#2a2c38'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-11, -5); g.lineTo(10, -9); g.lineTo(10, 9); g.lineTo(-11, 5); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#3a3c4a'; g.beginPath(); g.ellipse(10, 0, 2.6, 9, 0, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-7, -2.5); g.lineTo(5, -5); g.stroke();
        g.restore();
        const hx = 22, hy = -24, ang = Math.PI + 0.12 + (1 - s) * 0.42;
        g.strokeStyle = '#4a2a10'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(hx - Math.cos(ang) * 3, hy - Math.sin(ang) * 3); g.lineTo(hx + Math.cos(ang) * 24, hy + Math.sin(ang) * 24); g.stroke();
        g.strokeStyle = '#c8884a'; g.lineWidth = 2.6; g.stroke();
        reach(g, 28, -36, hx, hy, c, 9);
        if (s > 0.5) { g.strokeStyle = rgba('#fff8d0', (s - 0.5) * 1.9); g.lineWidth = 2.4; for (const a of [2.5, 2.95, 3.4]) { g.beginPath(); g.moveTo(-8 + Math.cos(a) * 17, -19 + Math.sin(a) * 15); g.lineTo(-8 + Math.cos(a) * 24, -19 + Math.sin(a) * 21); g.stroke(); } }
      },
    },
    kremen: {
      name: 'Кремень', el: ['stone'], part: 'anvil', price: 800, rate: 30, need: 6,
      desc: 'Кузнец из чёрного кремня. Бьёт молотом по наковальне — искры летят точно в такт.', col: '#59627a',
      draw(g, st) {
        const c = this.col, s = st.sing;
        arm(g, -40, -42, Math.PI * 0.68 + Math.sin(st.t * 2) * 0.05, 16, c, 11);
        feet(g, 84, c);
        const P = [[-40, -6], [-46, -46], [-40, -80], [-16, -95], [16, -95], [40, -80], [46, -46], [40, -6], [24, 0], [-24, 0]];
        const body = new Path2D(); smooth(body, P, 0.75);
        silhouette(g, [{ path: p => smooth(p, P, 0.75), fill: blobFill(g, c, 92, 95) }], c, shade(c, -0.62));
        // раковистые сколы кремня
        g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2;
        for (const [x, y, rs, a0] of [[-26, -70, [6, 11, 16], 3.6], [30, -36, [5, 9], 4.4], [-32, -22, [5, 9], 5.2]]) for (const r of rs) { g.beginPath(); g.arc(x, y, r, a0, a0 + 1.6); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.38)'; g.beginPath(); poly(g, [[-32, -78], [-20, -88], [-24, -74]]); g.fill();
        // очки-консервы на лбу
        g.save(); g.clip(body); g.strokeStyle = '#4a3020'; g.lineWidth = 6; g.beginPath(); g.moveTo(-50, -79); g.quadraticCurveTo(0, -86, 50, -79); g.stroke(); g.restore();
        for (const k of [-1, 1]) {
          const lg = g.createLinearGradient(0, -90, 0, -74); lg.addColorStop(0, '#c8f2ff'); lg.addColorStop(1, '#3a8ab8');
          g.fillStyle = lg; g.strokeStyle = '#a8701a'; g.lineWidth = 3.4; g.beginPath(); g.arc(k * 12, -82, 7, 0, TAU); g.fill(); g.stroke();
          g.strokeStyle = '#3a2410'; g.lineWidth = 1.4; g.beginPath(); g.arc(k * 12, -82, 8.8, 0, TAU); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(k * 12 - 2.5, -84.5, 2.4, 1.4, -0.5, 0, TAU); g.fill();
        }
        eye(g, -15, -59, 9, st); eye(g, 15, -59, 9, st);
        g.fillStyle = 'rgba(20,20,30,.28)'; g.beginPath(); g.ellipse(27, -46, 6, 3.5, 0.3, 0, TAU); g.fill(); // сажа на щеке
        mouth(g, 0, -45, 22, s * 0.8); cheeks(g, 0, -48, 24, 5);
        // фартук
        g.strokeStyle = '#4a2a14'; g.lineWidth = 3; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 15, -31); g.lineTo(k * 34, -56); g.stroke(); }
        g.fillStyle = '#9a6238'; g.strokeStyle = '#3e2210'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(-17, -32); g.lineTo(17, -32); g.quadraticCurveTo(22, -18, 30, -9); g.quadraticCurveTo(31, -3, 23, -3); g.lineTo(-23, -3); g.quadraticCurveTo(-31, -3, -30, -9); g.quadraticCurveTo(-22, -18, -17, -32); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,220,170,.45)'; g.lineWidth = 1.2; g.setLineDash([2.5, 2.5]); g.beginPath(); g.roundRect(-18, -24, 13, 10, 2); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#b8bcc8'; g.strokeStyle = '#3a3c4a'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(-15, -31, 3.2, 9, 1); g.fill(); g.stroke(); g.beginPath(); g.roundRect(-10.5, -30, 3.2, 8, 1); g.fill(); g.stroke();
        // наковальня
        const an = g.createLinearGradient(0, -22, 0, 0); an.addColorStop(0, '#b4bccc'); an.addColorStop(1, '#4e5566');
        g.fillStyle = an; g.strokeStyle = '#1e2028'; g.lineWidth = 2.6; g.lineJoin = 'round';
        g.beginPath(); poly(g, [[0, -19], [12, -22], [48, -22], [48, -15], [40, -14], [37, -8], [46, -6], [48, 0], [14, 0], [16, -6], [25, -8], [22, -14], [12, -15]]); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(13, -20); g.lineTo(46, -20); g.stroke();
        // раскалённая заготовка
        glow(g, 34, -23, 12 + s * 6, '#ff9a2a', 0.35 + 0.35 * s);
        g.fillStyle = s > 0.5 ? '#ffe070' : '#ff9a2a'; g.strokeStyle = '#8a2a0a'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(25, -25.5, 18, 4, 2); g.fill(); g.stroke();
        // молот: поднят над плечом и падает на наковальню на каждой ноте
        const sh = [34, -52], H = [lerp(42, 38, s), lerp(-66, -44, s)], A = lerp(-1.75, 1.75, s), L = 17;
        g.save(); g.translate(H[0], H[1]); g.rotate(A);
        g.lineCap = 'round'; g.strokeStyle = '#3a2210'; g.lineWidth = 6.5; g.beginPath(); g.moveTo(-3, 0); g.lineTo(L, 0); g.stroke();
        g.strokeStyle = '#b07a44'; g.lineWidth = 3.4; g.stroke();
        const hg = g.createLinearGradient(0, -9, 0, 9); hg.addColorStop(0, '#b4bccc'); hg.addColorStop(1, '#5a6274');
        g.fillStyle = hg; g.strokeStyle = '#1e2028'; g.lineWidth = 2.4; g.beginPath(); g.roundRect(L - 5, -9.5, 10, 19, 2.5); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(L - 3, -7.5, 2, 15); g.restore();
        reach(g, sh[0], sh[1], H[0], H[1], c, 10);
        // искры от удара
        if (s > 0.35) { const a = clamp01((s - 0.35) / 0.5), d = 7 + (1 - s) * 30; for (let i = 0; i < 7; i++) { const an2 = -0.25 - i * 0.44, x = 35 + Math.cos(an2) * d, y = -24 + Math.sin(an2) * d * 0.9 + (1 - s) * (1 - s) * 18; g.strokeStyle = rgba('#ffd040', a); g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(an2) * 5, y - Math.sin(an2) * 5); g.stroke(); spark(g, x, y, 2.6 * a + 0.6, rgba('#fff4b0', a)); } }
      },
    },
    drakosha: {
      name: 'Дракоша', el: ['fire', 'wind'], part: 'rockvox', rate: 56,
      desc: 'Маленький дракон — солист вулканической рок-группы. Машет крыльями и рычит в микрофон.', col: '#f2643a',
      draw(g, st) {
        const w = 76, h = 98, c = this.col, s = st.sing, flap = Math.sin(st.t * (5 + s * 8)) * (0.1 + s * 0.22);
        glow(g, 0, -58, 74, '#ffb040', 0.18 + s * 0.16);
        // хвост с огоньком
        g.lineCap = 'round'; const tw = Math.sin(st.t * 2.4) * 3;
        for (const [col, lw] of [[shade(c, -0.6), 14], [shade(c, -0.08), 8.5]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(10, -12); g.quadraticCurveTo(46, -2, 50 + tw, -30); g.stroke(); }
        flame(g, 50 + tw, -32, 0.55, 0.25, st.t, 0, 1 + s * 0.3);
        // крылья летучей мыши
        for (const k of [-1, 1]) {
          g.save(); g.translate(k * 24, -66); g.scale(k * 0.86, 0.86); g.rotate(-0.2 - flap);
          const wp = new Path2D(); wp.moveTo(0, 6); wp.lineTo(22, -26); wp.quadraticCurveTo(34, -34, 42, -30); wp.quadraticCurveTo(35, -18, 44, -8); wp.quadraticCurveTo(33, -1, 36, 12); wp.quadraticCurveTo(20, 4, 0, 14); wp.closePath();
          const wg = g.createRadialGradient(10, -4, 2, 14, -8, 40); wg.addColorStop(0, '#ffd27a'); wg.addColorStop(1, '#ff8a5a');
          g.fillStyle = wg; g.strokeStyle = shade(c, -0.6); g.lineWidth = 2.6; g.fill(wp); g.stroke(wp);
          g.strokeStyle = shade(c, -0.45); g.lineWidth = 2.2; for (const [x, y] of [[42, -30], [44, -8], [36, 12]]) { g.beginPath(); g.moveTo(22, -26); g.lineTo(x, y); g.stroke(); }
          g.strokeStyle = shade(c, -0.6); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 6); g.lineTo(22, -26); g.stroke();
          g.strokeStyle = c; g.lineWidth = 2.4; g.stroke();
          g.restore();
        }
        feet(g, w, c);
        const horns = [-1, 1].map(k => ({ path: p => { p.moveTo(k * 10, -90); p.quadraticCurveTo(k * 11, -105, k * 28, -109); p.quadraticCurveTo(k * 19, -100, k * 18, -87); p.closePath(); }, fill: '#f6e0b0' }));
        silhouette(g, [...horns, { path: p => SHAPES.pear(p, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
        g.strokeStyle = 'rgba(150,90,40,.55)'; g.lineWidth = 1.6; for (const k of [-1, 1]) for (const [x1, y1, x2, y2] of [[11, -96, 18, -95], [13, -101, 20, -102]]) { g.beginPath(); g.moveTo(k * x1, y1); g.lineTo(k * x2, y2); g.stroke(); }
        // огненный чубчик
        glow(g, 0, -100, 18, '#ffd040', 0.35 + 0.3 * s); flame(g, -2, -95, 0.46, -0.25, st.t, 1.5, 1 + s * 0.25); flame(g, 3, -96, 0.56, 0.1, st.t, 0.4, 1 + s * 0.25);
        // пузико в чешуйках
        g.fillStyle = '#ffe2a8'; g.beginPath(); g.ellipse(0, -27, 22, 22, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(170,80,30,.35)'; g.lineWidth = 1.8; for (const y of [-38, -28, -18]) { g.beginPath(); g.moveTo(-18 + Math.abs(y + 27) * 0.3, y); g.quadraticCurveTo(0, y + 5, 18 - Math.abs(y + 27) * 0.3, y); g.stroke(); }
        shine(g, -16, -80, 6, 10);
        eye(g, -13, -68, 9.5, st, { iris: '#ffa21a', lid: 1, pupil: 0.5 }); eye(g, 13, -68, 9.5, st, { iris: '#ffa21a', lid: 1, pupil: 0.5 });
        g.strokeStyle = '#2a1a22'; g.lineWidth = 3; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 6, -79 + s * 1.5); g.lineTo(k * 20, -82); g.stroke(); }
        g.fillStyle = shade(c, -0.55); for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * 4.5, -57, 1.8, 1.2, 0, 0, TAU); g.fill(); }
        mouth(g, 0, -50, 26, 0.08 + s * 0.92, 'teeth'); cheeks(g, 0, -56, 25, 5);
        if (s > 0.6) for (const k of [-1, 1]) puff(g, k * (8 + (1 - s) * 20), -58 - (1 - s) * 18, 2.5 + (1 - s) * 5, (s - 0.6) * 1.6, '#ffffff');
        // левый кулак вверх на громких нотах
        arm(g, -30, -50, lerp(Math.PI * 0.74, Math.PI * 1.22, s), 18, c, 10);
        // микрофон
        g.strokeStyle = '#1a1a24'; g.lineWidth = 6.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(28, -22); g.lineTo(22, -40); g.stroke();
        g.strokeStyle = '#3a3a4a'; g.lineWidth = 3.6; g.stroke();
        reach(g, 33, -42, 25, -30, c, 10);
        g.fillStyle = '#e8304a'; g.strokeStyle = '#1a1a24'; g.lineWidth = 2; g.beginPath(); g.ellipse(21.4, -41.5, 4.6, 2.4, -0.32, 0, TAU); g.fill(); g.stroke();
        const mg = g.createRadialGradient(18, -48, 1, 20, -46, 8); mg.addColorStop(0, '#ffffff'); mg.addColorStop(1, '#8a92a4');
        g.fillStyle = mg; g.strokeStyle = '#1a1a24'; g.lineWidth = 2.2; g.beginPath(); g.arc(20, -46.5, 6.4, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(40,40,60,.45)'; g.lineWidth = 0.9; for (const d of [-3, 0, 3]) { g.beginPath(); g.moveTo(14.5, -46.5 + d); g.lineTo(25.5, -46.5 + d); g.stroke(); g.beginPath(); g.moveTo(20 + d, -52.5); g.lineTo(20 + d, -40.5); g.stroke(); }
        if (s > 0.5) { const a = (s - 0.5) * 2; spark(g, 34, -56, 3 + a * 2, rgba('#fff4a0', a)); spark(g, 30, -66, 2 + a * 1.5, rgba('#ffd040', a)); }
      },
    },
    vulkanya: {
      name: 'Вулканя', el: ['fire', 'stone'], part: 'growl', rate: 56,
      desc: 'Маленький вулкан с характером. Рычит низким голосом — и из кратера валит дым.', col: '#8e5a48',
      draw(g, st) {
        const c = this.col, s = st.sing, hot = clamp01(0.5 + 0.5 * s + Math.sin(st.t * 3) * 0.06);
        g.translate(Math.sin(st.t * 47) * s * 0.9, 0); // рык: мелкая дрожь
        glow(g, 0, -92, 36, '#ff8a2a', 0.22 + 0.3 * s);
        // кулаки-камни
        arm(g, -45, -30, lerp(Math.PI * 0.82, Math.PI * 1.08, s), 13, c, 12); arm(g, 45, -30, lerp(Math.PI * 0.18, -Math.PI * 0.08, s), 13, c, 12);
        feet(g, 100, c);
        const vol = p => { p.moveTo(-23, -94); p.bezierCurveTo(-34, -74, -54, -52, -54, -22); p.quadraticCurveTo(-54, 0, -36, 0); p.lineTo(36, 0); p.quadraticCurveTo(54, 0, 54, -22); p.bezierCurveTo(54, -52, 34, -74, 23, -94); p.quadraticCurveTo(0, -99, -23, -94); p.closePath(); };
        const body = new Path2D(); vol(body);
        silhouette(g, [{ path: p => circ(p, -44, -12, 13), fill: shade(c, -0.12) }, { path: p => circ(p, 46, -10, 11), fill: shade(c, -0.12) }, { path: vol, fill: blobFill(g, c, 100, 96) }], c, shade(c, -0.62));
        // лавовые жилы
        g.save(); g.clip(body);
        ember(g, [[-62, -46], [-51, -40], [-48, -31], [-52, -22], [-46, -13]], hot, 3.4);
        ember(g, [[62, -30], [52, -27], [49, -18], [53, -10]], hot);
        g.fillStyle = 'rgba(255,255,255,.12)'; for (const [x, y, r] of [[-26, -74, 3], [30, -58, 2.5], [-36, -46, 2.2], [24, -18, 2.6]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        g.restore();
        // кратер с лавой
        const lv = g.createRadialGradient(0, -94, 1, 0, -94, 20); lv.addColorStop(0, '#fff6b0'); lv.addColorStop(0.5, '#ffa02a'); lv.addColorStop(1, '#c8301a');
        g.fillStyle = lv; g.strokeStyle = shade(c, -0.62); g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, -94, 19, 5.2, 0, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = shade(c, 0.3); g.lineWidth = 3; g.beginPath(); g.ellipse(0, -94, 21, 6.4, 0, 0.15, Math.PI - 0.15); g.stroke();
        // капли лавы стекают по склонам
        for (const [x, L, ph] of [[-11, 13, 0], [3, 8, 1.7], [13, 17, 3.1]]) {
          const len = L + Math.sin(st.t * 0.9 + ph) * 2.5 + s * 3, y0 = -91, r = 3.3;
          g.beginPath(); g.moveTo(x - 4.2, y0); g.quadraticCurveTo(x - 3, y0 + len * 0.5, x - r, y0 + len); g.arc(x, y0 + len, r, Math.PI, 0, true); g.quadraticCurveTo(x + 3, y0 + len * 0.5, x + 4.2, y0);
          const dg = g.createLinearGradient(0, y0, 0, y0 + len + r); dg.addColorStop(0, '#ffe070'); dg.addColorStop(1, '#ff6a1a');
          g.fillStyle = dg; g.fill(); g.strokeStyle = '#8a2a10'; g.lineWidth = 1.8; g.stroke();
          g.fillStyle = 'rgba(255,255,220,.8)'; g.beginPath(); g.arc(x - 1, y0 + len - 0.8, 1.1, 0, TAU); g.fill();
        }
        // дым из кратера и брызги лавы на громких нотах
        for (let i = 0; i < 4; i++) { const ph = (st.t * (0.35 + s * 0.25) + i / 4) % 1; puff(g, Math.sin(ph * 5 + i) * 6 + ph * 6, -98 - ph * 18, 4.5 + ph * 6, (1 - ph) * (0.6 + 0.3 * s), '#7e7078'); }
        if (s > 0.45) { const a = clamp01((s - 0.45) * 2.2); for (const [k, v] of [[-1, 1], [1, 0.8]]) { const u = 1 - s; glow(g, k * (6 + u * 16), -100 - u * 18 * v, 6, '#ff8a2a', a * 0.6); g.fillStyle = rgba('#ffd040', a); g.beginPath(); g.arc(k * (6 + u * 16), -100 - u * 18 * v, 2.6, 0, TAU); g.fill(); } }
        // лицо: брови-уступы и огненная пасть
        eye(g, -17, -57, 9.5, st, { iris: '#ff8a1a' }); eye(g, 17, -57, 9.5, st, { iris: '#ff8a1a' });
        g.strokeStyle = shade(c, -0.62); g.lineWidth = 4.2; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 7, -68 + s * 2.5); g.lineTo(k * 27, -73); g.stroke(); }
        hotMouth(g, 0, -38, 30, 0.12 + s * 0.88, true); blush(g, 0, -44, 32, 6.5, 0.32 + 0.2 * s);
      },
    },
  });
})();
