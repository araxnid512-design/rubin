'use strict';
/* Графика «Чаровника»: героини в аниме-стиле, герой и жители, клетки мира, иконки */
(function () {
  const A = window.ART = {};
  const PI = Math.PI, TAU = PI * 2, OUT = '#21121c', sin = Math.sin, cos = Math.cos;
  const { canvas, rr, lg } = U;
  A.OUT = OUT;
  const circ = (x, a, b, r) => { x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); };
  const ell = (x, a, b, rx, ry, rot) => { x.beginPath(); x.ellipse(a, b, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); x.fill(); };
  const ink = (x, fill, lw) => { if (fill) { x.fillStyle = fill; x.fill(); } x.lineWidth = lw || 2.2; x.strokeStyle = OUT; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); };
  const P = (x, pts) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); };
  const seg = (x, a, b, c, d, w, col) => { x.lineCap = 'round'; x.strokeStyle = OUT; x.lineWidth = w + 2.6; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); x.strokeStyle = col; x.lineWidth = w; x.stroke(); };
  function shade(c, k) { const n = parseInt(c.slice(1), 16); return 'rgb(' + Math.min(255, ((n >> 16) & 255) * k | 0) + ',' + Math.min(255, ((n >> 8) & 255) * k | 0) + ',' + Math.min(255, (n & 255) * k | 0) + ')'; }
  A.shade = shade;

  /* ================= Героини ================= */
  // o: { t, expr, pose, chibi, walk, bloom }
  A.girl = function (x, id, o) {
    o = o || {}; const g = D.GIRLS[id], L = o.outfit && o.outfit !== 'base' && A.dress ? A.dress(id, o.outfit) : g.look, t = o.t || 0, sd = id.length * 1.37;
    const br = sin(t * 2.3 + sd) * 1.2, sw = sin(t * 1.7 + sd), pose = o.pose || 'idle', CH = !!o.chibi, by = CH ? 0.6 : 1, hs = CH ? 1.36 : 1.13;
    let expr = o.expr || 'normal';
    const blink = ((t * 0.31 + sd) % 1) < 0.035 && expr !== 'hurt' && expr !== 'happy';
    x.save();
    if (L.tall) x.scale(L.tall, L.tall);
    if (L.ghost) x.globalAlpha *= 0.82 + sin(t * 2) * 0.06;
    x.fillStyle = 'rgba(30,14,30,.25)'; ell(x, 0, 0, L.lower === 'slime' ? 44 : L.lower === 'snake' ? 46 : L.lower === 'fishtail' ? 34 : 26, 6);
    const lean = pose === 'attack' ? 0.1 : pose === 'hurt' ? -0.09 : 0;
    const jump = pose === 'happy' ? -Math.abs(sin(t * 7)) * 6 : 0;
    x.translate(0, jump); x.rotate(lean + sin(t * 0.9 + sd) * 0.012);
    const W = o.walk ? sin(o.walk) : 0;
    const head = fn => { x.save(); x.translate(0, (-128 + br) * by); x.scale(hs, hs); x.rotate(sin(t * 1.1 + sd) * 0.025 + (pose === 'hurt' ? -0.12 : 0)); fn(); x.restore(); };
    const body = fn => { x.save(); x.scale(1, by); fn(); x.restore(); };
    // крылья и хвосты — сзади
    body(() => { backWings(x, L, t, sd); tails(x, L, t, sd, o.bloom); });
    head(() => backHair(x, L, sw));
    body(() => { lower(x, L, t, W, br); torso(x, L, br); arms(x, L, pose, t, br, sd); });
    head(() => { face(x, L, expr, blink, t); frontHair(x, L, sw); headAcc(x, L, t, o.bloom); if (o.bloom) sparkles(x, t); });
    x.restore();
  };

  function backWings(x, L, t, sd) {
    const f = sin(t * 3 + sd) * 0.08;
    if (L.batwings) for (const s of [-1, 1]) {
      x.save(); x.translate(s * 10, -116); x.rotate(s * (0.35 + f)); x.scale(s, 1);
      x.beginPath(); x.moveTo(0, 0); x.lineTo(40, -26); x.lineTo(54, -10); x.quadraticCurveTo(46, -4, 46, 4); x.quadraticCurveTo(38, 0, 34, 8); x.quadraticCurveTo(26, 4, 20, 12); x.quadraticCurveTo(10, 6, 0, 10); x.closePath();
      ink(x, L.wingc || '#3a2050', 2.2); x.strokeStyle = L.wingc ? shade(L.wingc, 1.4) : '#6a3a8a'; x.lineWidth = 1; x.beginPath(); x.moveTo(2, 2); x.lineTo(46, -8); x.moveTo(2, 4); x.lineTo(34, 6); x.moveTo(2, 6); x.lineTo(20, 10); x.stroke();
      x.restore();
    }
    if (L.featherwings) for (const s of [-1, 1]) {
      x.save(); x.translate(s * 9, -114); x.rotate(s * (0.5 + f * 1.4)); x.scale(s, 1);
      for (let i = 4; i >= 0; i--) { x.beginPath(); x.ellipse(18 + i * 6, -6 + i * 7, 30 - i * 3, 7, -0.5 + i * 0.12, 0, TAU); ink(x, i % 2 ? '#ffffff' : '#eef2fb', 1.8); }
      x.restore();
    }
  }
  function tails(x, L, t, sd, bloom) {
    if (L.tails) {
      const n = bloom ? 9 : L.tails;
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 0 : i / (n - 1) - 0.5, a = k * 2.2 + sin(t * 1.8 + i + sd) * 0.12;
        x.save(); x.translate(0, -82); x.rotate(a);
        x.beginPath(); x.moveTo(-5, 0); x.bezierCurveTo(-16, -20, -22, -50, -6, -72); x.bezierCurveTo(4, -80, 20, -60, 12, -36); x.bezierCurveTo(8, -18, 6, -8, 5, 0); x.closePath();
        ink(x, L.hair, 2.2);
        x.save(); x.clip(); x.fillStyle = '#fff4e6'; ell(x, -2, -70, 13, 12); x.fillStyle = L.hair2; ell(x, -6, -40, 4, 18, 0.2); x.restore();
        x.restore();
      }
    }
    if (L.tail === 'cat') { x.save(); x.translate(8, -80); x.rotate(sin(t * 2.2 + sd) * 0.2); x.strokeStyle = OUT; x.lineWidth = 8.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(26, -6, 30, -40, 20, -56); x.stroke(); x.strokeStyle = L.hair; x.lineWidth = 6; x.stroke(); x.strokeStyle = shade(L.hair, 0.78); x.lineWidth = 6; x.setLineDash([4, 6]); x.stroke(); x.setLineDash([]); x.restore(); }
    if (L.tail === 'dragon') { x.save(); x.translate(6, -78); x.rotate(sin(t * 1.4 + sd) * 0.15); x.beginPath(); x.moveTo(-6, -4); x.bezierCurveTo(30, 0, 44, 30, 58, 22); x.lineTo(66, 30); x.lineTo(52, 32); x.bezierCurveTo(36, 40, 20, 14, -4, 8); x.closePath(); ink(x, L.scale || L.hair, 2.4); x.fillStyle = L.belly || '#ffd08a'; for (let i = 0; i < 4; i++) { const k = i / 4; P(x, [8 + k * 46, -2 + k * 20, 13 + k * 46, -10 + k * 22, 16 + k * 46, 0 + k * 20]); x.fill(); } x.restore(); }
    if (L.tail === 'cow') { x.save(); x.translate(7, -80); x.rotate(sin(t * 1.6 + sd) * 0.25); x.strokeStyle = OUT; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(22, 10, 24, 36); x.stroke(); x.strokeStyle = L.fur; x.lineWidth = 2.8; x.stroke(); x.beginPath(); x.ellipse(24, 40, 4.4, 7, 0, 0, TAU); ink(x, '#3a2a2a', 1.8); x.restore(); }
  }
  function backHair(x, L, sw) {
    const c = lg(x, 0, -56, 0, 50, [L.hair, shade(L.hair, 0.82), shade(L.hair, 0.66)]), s2 = sw * 2.2;
    x.beginPath();
    if (L.style === 'long' || L.style === 'wavy') {
      const wv = L.style === 'wavy' ? 4 : 0;
      x.moveTo(-23, -38); x.quadraticCurveTo(-30, 0, -27 + s2, 46);
      for (let i = 0; i <= 6; i++) { const px = -27 + i * 9 + s2, py = 46 + (i % 2 ? 8 : 0) + (wv && i % 2 ? 4 : 0); x.lineTo(px, py); }
      x.quadraticCurveTo(30, 0, 23, -38); x.arc(0, -31, 23.5, -0.3, PI + 0.3, true);
      ink(x, c, 2.4);
      x.strokeStyle = L.hair2; x.lineWidth = 1.4; x.globalAlpha = 0.5; for (const px of [-16, -6, 8, 18]) { x.beginPath(); x.moveTo(px, -10); x.quadraticCurveTo(px + 2, 16, px + s2 * 0.6, 40); x.stroke(); } x.globalAlpha = 1;
    } else if (L.style === 'twin') {
      x.arc(0, -31, 23, 0, TAU); ink(x, c, 2.4);
      for (const s of [-1, 1]) {
        x.beginPath(); x.moveTo(s * 18, -46); x.bezierCurveTo(s * 40, -40, s * 44 + s2, 0, s * 30 + s2, 34); x.bezierCurveTo(s * 40 + s2, 20, s * 30, -24, s * 16, -38); x.closePath(); ink(x, c, 2.4);
        x.strokeStyle = L.hair2; x.lineWidth = 1.4; x.beginPath(); x.moveTo(s * 26, -36); x.quadraticCurveTo(s * 36, -6, s * 32 + s2, 22); x.stroke();
      }
    } else if (L.style === 'braid') {
      x.arc(0, -31, 23, 0, TAU); ink(x, c, 2.4);
      for (let i = 0; i < 7; i++) { x.beginPath(); x.ellipse(16 + i * 0.8 + s2 * i / 7, -10 + i * 9, 6.4 - i * 0.4, 6, 0.4 * (i % 2 ? 1 : -1), 0, TAU); ink(x, i % 2 ? c : L.hair2, 1.8); }
    } else {
      const d = L.style === 'bob' ? 8 : L.style === 'messy' ? 2 : -2;
      x.moveTo(-23, -36); x.quadraticCurveTo(-27, -12, -22 + s2 * 0.4, d); for (let i = 1; i <= 5; i++) x.lineTo(-22 + i * 8.8 + s2 * 0.4, d + (i % 2 ? 5 : 0)); x.quadraticCurveTo(27, -12, 23, -36); x.arc(0, -31, 23.5, -0.3, PI + 0.3, true); ink(x, c, 2.4);
    }
  }
  /* --- низ тела --- */
  function leg(x, s, L, lift, col, sock, shoe, hoof) {
    x.save(); x.translate(0, -lift);
    x.beginPath(); x.moveTo(s * 15.5, -80); x.quadraticCurveTo(s * 15, -58, s * 11.5, -40); x.quadraticCurveTo(s * 10, -20, s * 9.4, -5); x.lineTo(s * 3.6, -5); x.quadraticCurveTo(s * 3.4, -24, s * 3.8, -40); x.quadraticCurveTo(s * 2, -60, s * 1, -74); x.closePath();
    ink(x, col, 2.3);
    if (sock) { x.save(); x.clip(); x.fillStyle = sock; x.fillRect(-30, -54, 60, 60); if (L.stripes) { x.fillStyle = shade(sock, 1.7); for (let y = -50; y < -6; y += 7) x.fillRect(-30, y, 60, 3); } x.fillStyle = shade(sock, 0.75); x.fillRect(-30, -54, 60, 2.4); x.restore(); }
    if (hoof) { x.beginPath(); x.moveTo(s * 10.5, -10); x.lineTo(s * 2.6, -10); x.lineTo(s * 2, 0); x.lineTo(s * 11.5, 0); x.closePath(); ink(x, '#3a3236', 2); x.fillStyle = '#5a5054'; x.fillRect(s > 0 ? 3 : -10.5, -9, 7.5, 2); }
    else if (shoe) { x.beginPath(); x.ellipse(s * 6.6, -3, 6.2, 4.2, 0, 0, TAU); ink(x, shoe, 2); x.fillStyle = 'rgba(255,255,255,.3)'; ell(x, s * 5.4, -5, 2.4, 1.2); }
    x.restore();
  }
  function lower(x, L, t, W, br) {
    const lw = L.lower;
    if (lw === 'legs' || lw === 'hooves') {
      for (const s of [-1, 1]) leg(x, s, L, Math.max(0, W * s) * 4, lw === 'hooves' ? L.fur : L.skin, lw === 'hooves' ? null : L.socks, L.shoes || '#4a2c2a', lw === 'hooves');
      if (L.spots) { x.fillStyle = '#3a3034'; ell(x, -11, -56, 3.4, 4.6, 0.3); ell(x, 9, -30, 3, 4, -0.2); ell(x, -7, -22, 2.4, 3); }
      bottoms(x, L);
    } else if (lw === 'talons') {
      for (const s of [-1, 1]) {
        const lf = Math.max(0, W * s) * 4;
        x.strokeStyle = OUT; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(s * 8, -42 - lf); x.lineTo(s * 7, -6 - lf); x.stroke(); x.strokeStyle = '#ecab34'; x.lineWidth = 3.6; x.stroke();
        for (const a of [-0.6, 0, 0.6]) { x.strokeStyle = OUT; x.lineWidth = 4.4; x.beginPath(); x.moveTo(s * 7, -6 - lf); x.lineTo(s * 7 + sin(a) * 9, -1 - lf + cos(a) * 1); x.stroke(); x.strokeStyle = '#ecab34'; x.lineWidth = 2.2; x.stroke(); }
        x.beginPath(); x.moveTo(s * 16, -82); x.quadraticCurveTo(s * 19, -60, s * 12, -40); x.lineTo(s * 9, -36); x.lineTo(s * 6, -42); x.lineTo(s * 3, -38); x.quadraticCurveTo(s * 0, -60, s * 1, -76); x.closePath(); ink(x, L.hair, 2.3);
      }
      bottoms(x, L);
    } else if (lw === 'snake') {
      const pts = [], N = 30, B = (a, b, c, d, k) => { const m = 1 - k; return m * m * m * a + 3 * m * m * k * b + 3 * m * k * k * c + k * k * k * d; };
      for (let i = 0; i <= N; i++) { const k = i / N; pts.push([B(0, 2, -44, -12, k) + sin(t * 1.5 + k * 4) * 1.5, B(-80, -36, -12, -6, k), 17 - k * 6]); }
      for (let i = 1; i <= N; i++) { const k = i / N; pts.push([B(-12, 20, 46, 36, k), B(-6, -2, -4, -28 + sin(t * 2) * 4, k), 11 - k * 8]); }
      x.fillStyle = OUT; for (const p of pts) circ(x, p[0], p[1], p[2] + 1.3);
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; x.fillStyle = i % 2 ? L.scale : shade(L.scale, 1.12); circ(x, p[0], p[1], p[2]); }
      x.fillStyle = L.belly; for (let i = 0; i < 16; i++) { const p = pts[i]; ell(x, p[0] + 2, p[1], p[2] * 0.55, p[2] * 0.6); }
      x.strokeStyle = shade(L.belly, 0.75); x.lineWidth = 1; for (let i = 1; i < 16; i += 2) { const p = pts[i]; x.beginPath(); x.moveTo(p[0] - 5, p[1]); x.lineTo(p[0] + 8, p[1]); x.stroke(); }
    } else if (lw === 'slime') {
      const wob = sin(t * 3) * 2;
      x.save(); x.globalAlpha = 0.9;
      x.beginPath(); x.moveTo(-13, -98); x.quadraticCurveTo(-22 - wob, -50, -44, -4); x.quadraticCurveTo(-46, 4, -30, 3); x.quadraticCurveTo(0, 8 + wob, 30, 3); x.quadraticCurveTo(46, 4, 44, -4); x.quadraticCurveTo(22 + wob, -50, 13, -98); x.closePath();
      ink(x, lg(x, 0, -98, 0, 6, [L.top2, L.skin, L.bottom]), 2.4);
      x.fillStyle = 'rgba(255,255,255,.45)'; ell(x, -18, -40, 4, 12, 0.3); ell(x, 22, -12, 6, 2.4);
      x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 4; i++) circ(x, -8 + i * 6, -60 + ((t * 14 + i * 13) % 50), 1.6 + (i % 2));
      x.restore();
    } else if (lw === 'fishtail') {
      const sw2 = sin(t * 2.2) * 6;
      x.beginPath(); x.moveTo(-17, -96); x.bezierCurveTo(-24, -60, -16, -30, -6 + sw2 * 0.4, -14); x.lineTo(6 + sw2 * 0.4, -14); x.bezierCurveTo(16, -30, 24, -60, 17, -96); x.closePath();
      ink(x, lg(x, 0, -96, 0, -14, [shade(L.scale, 1.15), L.scale, shade(L.scale, 0.8)]), 2.4);
      x.strokeStyle = shade(L.scale, 0.7); x.lineWidth = 1; for (let y = -88; y < -20; y += 9) for (let k = -2; k <= 2; k++) { x.beginPath(); x.arc(k * 6 + (y % 18 ? 3 : 0), y, 3.2, 0.2, PI - 0.2); x.stroke(); }
      x.save(); x.translate(sw2 * 0.4, -14); x.rotate(sw2 * 0.02); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-18, 2, -28, 12); x.quadraticCurveTo(-12, 10, 0, 6); x.quadraticCurveTo(12, 10, 28, 12); x.quadraticCurveTo(18, 2, 0, 0); x.closePath(); ink(x, L.fin || shade(L.scale, 1.3), 2.2); x.restore();
      x.fillStyle = L.top2; for (let i = 0; i < 7; i++) circ(x, -15 + i * 5, -95, 1.8);
    } else if (lw === 'dress') {
      x.beginPath(); x.moveTo(-12, -98); x.quadraticCurveTo(-20, -50, -32, -8); for (let i = 0; i <= 8; i++) x.lineTo(-32 + i * 8, -6 + (i % 2 ? 4 : -1)); x.quadraticCurveTo(20, -50, 12, -98); x.closePath();
      ink(x, lg(x, 0, -98, 0, -4, [L.bottom, shade(L.bottom, 0.82)]), 2.4);
      if (L.ghost) { x.fillStyle = 'rgba(200,230,255,.5)'; for (let i = 0; i < 4; i++) ell(x, -20 + i * 13, -4 + sin(t * 3 + i) * 3, 7, 5); }
      x.strokeStyle = shade(L.bottom, 0.65); x.lineWidth = 1.2; for (const px of [-14, -4, 6, 16]) { x.beginPath(); x.moveTo(px * 0.5, -88); x.quadraticCurveTo(px, -40, px * 1.5, -8); x.stroke(); }
      x.fillStyle = L.top2; x.beginPath(); for (let i = 0; i <= 16; i++) x.lineTo(-32 + i * 4, -6 + (i % 2 ? 3 : -2)); x.lineTo(32, -10); x.lineTo(-32, -10); x.closePath(); x.fill();
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 7, -2, 6, 3.6, 0, 0, TAU); ink(x, '#2a1a24', 1.8); }
    }
  }
  function bottoms(x, L) {
    const o = L.outfit;
    if (o === 'kimono' || o === 'leaf' || o === 'armor') {
      x.beginPath(); x.moveTo(-17, -88); x.lineTo(17, -88); x.lineTo(25, -58);
      if (o === 'leaf') { for (let i = 0; i <= 6; i++) x.quadraticCurveTo(25 - i * 8.3 - 4, -50, 25 - (i + 1) * 8.3, -58); }
      else x.quadraticCurveTo(0, -54, -25, -58);
      x.closePath(); ink(x, L.bottom, 2.3);
      x.strokeStyle = shade(L.bottom, 0.72); x.lineWidth = 1.2; for (const px of [-12, -4, 4, 12]) { x.beginPath(); x.moveTo(px * 0.8, -86); x.lineTo(px * 1.25, -58); x.stroke(); }
      if (o === 'armor') { x.fillStyle = '#e8b830'; x.fillRect(-17, -88, 34, 3); }
    } else {
      x.beginPath(); x.moveTo(-17, -88); x.lineTo(17, -88); x.lineTo(18, -66); x.lineTo(3, -66); x.lineTo(0, -72); x.lineTo(-3, -66); x.lineTo(-18, -66); x.closePath(); ink(x, L.bottom, 2.3);
      if (o === 'overalls') { x.fillStyle = shade(L.bottom, 1.2); x.fillRect(-15, -84, 6, 3); }
    }
  }
  /* --- торс --- */
  function torsoPath(x) {
    x.beginPath(); x.moveTo(-13, -130); x.quadraticCurveTo(0, -132, 13, -130); x.lineTo(17, -123); x.bezierCurveTo(19.5, -114, 16.5, -105, 11.6, -98);
    x.quadraticCurveTo(10, -92, 17, -84); x.lineTo(16.5, -72); x.lineTo(-16.5, -72); x.lineTo(-17, -84); x.quadraticCurveTo(-10, -92, -11.6, -98); x.bezierCurveTo(-16.5, -105, -19.5, -114, -17, -123); x.closePath();
  }
  function torso(x, L, br) {
    if (L.lower === 'slime') { x.save(); x.globalAlpha = 0.92; }
    x.save(); x.translate(0, br * 0.4);
    torsoPath(x); x.fillStyle = L.skin; x.fill();
    x.save(); torsoPath(x); x.clip();
    const o = L.outfit, T = L.top, T2 = L.top2;
    const band = (y0, y1, c) => { x.fillStyle = c; x.fillRect(-25, y0, 50, y1 - y0); };
    if (o === 'kimono') { band(-132, -72, T); x.fillStyle = T2; P(x, [-9, -132, 0, -108, 9, -132, 5, -132, 0, -116, -5, -132]); x.fill(); band(-100, -90, L.belt); x.fillStyle = shade(L.belt, 0.7); x.fillRect(-25, -95.6, 50, 1.4); }
    else if (o === 'goo') { band(-132, -72, T); x.fillStyle = 'rgba(255,255,255,.35)'; ell(x, -8, -116, 4, 6); }
    else if (o === 'crop') { band(-132, -104, T); x.fillStyle = T2; for (let i = 0; i < 6; i++) ell(x, -15 + i * 6, -104, 3.4, 2.4); }
    else if (o === 'wrap') { band(-128, -106, T); x.fillStyle = T2; x.fillRect(-25, -92, 50, 2.4); for (let i = 0; i < 5; i++) circ(x, -10 + i * 5, -89, 1.6); }
    else if (o === 'leaf') { band(-130, -72, T); x.fillStyle = T2; for (let i = 0; i < 9; i++) ell(x, -18 + (i % 5) * 9, -126 + (i / 5 | 0) * 22 + (i % 2) * 6, 5, 3, 0.6); }
    else if (o === 'overalls') { band(-132, -72, T); x.fillStyle = '#3a3034'; ell(x, -10, -122, 3, 2.4); ell(x, 9, -112, 2.6, 3); x.fillStyle = T2; x.fillRect(-12, -108, 24, 36); x.fillRect(-14, -132, 4, 26); x.fillRect(10, -132, 4, 26); x.fillStyle = '#ffd04a'; circ(x, -9, -106, 1.6); circ(x, 9, -106, 1.6); }
    else if (o === 'gothic') { band(-132, -72, T); x.fillStyle = T2; for (let y = -124; y < -98; y += 5) { x.fillRect(-6, y, 12, 1.4); } x.fillStyle = '#fff2f6'; P(x, [-14, -132, 0, -120, 14, -132, 10, -126, 0, -116, -10, -126]); x.fill(); }
    else if (o === 'armor') { band(-132, -72, '#3a62c4'); x.fillStyle = lg(x, -18, 0, 18, 0, ['#9aa0b4', T, '#ffffff', T, '#9aa0b4']); x.beginPath(); x.moveTo(-18, -128); x.quadraticCurveTo(0, -136, 18, -128); x.lineTo(14, -98); x.quadraticCurveTo(0, -92, -14, -98); x.closePath(); x.fill(); x.strokeStyle = T2; x.lineWidth = 2; x.stroke(); x.fillStyle = T2; circ(x, 0, -112, 2.6); }
    else if (o === 'hoodie') { band(-132, -72, T); x.fillStyle = T2; P(x, [2, -118, -5, -106, 0, -106, -3, -96, 5, -110, 0, -110]); x.fill(); x.fillStyle = shade(T, 0.75); x.fillRect(-25, -78, 50, 6); }
    else if (o === 'snowdress') { band(-132, -72, T); x.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 6; i++) { const px = -12 + (i % 3) * 12, py = -116 + (i / 3 | 0) * 18; x.fillRect(px - 0.6, py - 3, 1.2, 6); x.fillRect(px - 3, py - 0.6, 6, 1.2); } }
    else if (o === 'swim') { band(-128, -72, T); x.fillStyle = T2; x.fillRect(-25, -110, 50, 4); x.fillStyle = shade(T, 0.8); x.fillRect(-25, -78, 50, 6); }
    else if (o === 'pajama') { band(-132, -72, T); x.fillStyle = T2; for (let i = 0; i < 12; i++) circ(x, -15 + (i % 4) * 10 + ((i / 4 | 0) % 2) * 5, -124 + (i / 4 | 0) * 16, 2.2); x.fillStyle = '#fff'; for (let y = -124; y < -80; y += 10) circ(x, 0, y, 1.4); }
    else if (o === 'gala') { band(-132, -72, T); x.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 10; i++) circ(x, -15 + (i * 37 % 30), -126 + (i * 13 % 44), 1.2); x.fillStyle = T2; x.fillRect(-25, -100, 50, 4); }
    // мягкая тень по бокам
    x.fillStyle = 'rgba(40,10,40,.14)'; x.fillRect(10, -132, 12, 62); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(-16, -128, 4, 50);
    x.restore();
    torsoPath(x); ink(x, null, 2.4);
    if (o !== 'goo' && o !== 'armor') { x.strokeStyle = shade(L.skin, 0.7); x.lineWidth = 1; x.beginPath(); x.moveTo(-9, -110); x.quadraticCurveTo(-4, -106, 0, -110); x.moveTo(9, -110); x.quadraticCurveTo(4, -106, 0, -110); x.stroke(); }
    if (o === 'snowdress') { x.fillStyle = '#ffffff'; for (let i = 0; i < 9; i++) circ(x, -16 + i * 4, -129 + Math.abs(i - 4) * 0.6, 3.6); x.strokeStyle = OUT; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-19, -127); x.quadraticCurveTo(0, -122, 19, -127); x.stroke(); }
    if (o === 'swim') { x.strokeStyle = OUT; x.lineWidth = 1.4; x.beginPath(); x.moveTo(-17, -128); x.quadraticCurveTo(0, -122, 17, -128); x.stroke(); }
    if (o === 'gala') { x.fillStyle = '#ffe8a0'; for (let i = 0; i < 7; i++) circ(x, -9 + i * 3, -123 + Math.abs(i - 3) * -0.8 + 3, 1.7); }
    if (o === 'gothic') { x.fillStyle = '#fff2f6'; for (let i = 0; i < 7; i++) circ(x, -12 + i * 4, -131, 2.4); }
    if (o === 'hoodie') { x.beginPath(); x.moveTo(-16, -132); x.quadraticCurveTo(0, -122, 16, -132); x.quadraticCurveTo(0, -140, -16, -132); ink(x, shade(L.top, 1.2), 1.8); }
    if (o === 'armor') { for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 18, -125, 8, 5.4, s * 0.3, 0, TAU); ink(x, L.top, 2); } }
    x.restore();
    if (L.lower === 'slime') x.restore();
  }
  /* --- руки --- */
  function arms(x, L, pose, t, br, sd) {
    for (const s of [-1, 1]) {
      let a = s * 0.16, b = s * -0.18;
      if (pose === 'happy') { a = s * 2.5 + sin(t * 8) * 0.1; b = s * 0.3; }
      else if (pose === 'attack') { if (s > 0) { a = 1.75; b = 0.1; } }
      else if (pose === 'cast') { a = s * 0.9; b = s * -1.2; }
      else if (pose === 'hurt') { a = s * 0.45; b = s * -1.9; }
      else { a += sin(t * 2 + sd + s) * 0.03; }
      const sx = s * 16.5, sy = -124 + br * 0.4;
      if (L.wings === 'arms') {
        x.save(); x.translate(sx, sy); x.rotate(a * 0.8); x.scale(s, 1);
        x.beginPath(); x.moveTo(0, -4); x.quadraticCurveTo(26, 6, 22, 50); for (let i = 0; i < 5; i++) x.lineTo(22 - i * 5.2 - 2.6, 46 + (i % 2 ? 10 : 0)); x.quadraticCurveTo(-4, 30, -4, 4); x.closePath();
        ink(x, L.hair, 2.3); x.save(); x.clip(); x.fillStyle = shade(L.hair, 0.65); x.fillRect(-10, 34, 40, 30); x.fillStyle = L.hair2; for (let i = 0; i < 4; i++) ell(x, 6 + i * 4, 8 + i * 8, 2, 8, -0.4); x.restore();
        x.restore(); continue;
      }
      const ex = sx + sin(a) * 23, ey = sy + cos(a) * 23, a2 = a + b, hx = ex + sin(a2) * 21, hy = ey + cos(a2) * 21;
      const sleeve = { kimono: L.top, hoodie: L.top, gothic: L.top, armor: '#c8ccd8', snowdress: L.top, goo: L.skin }[L.outfit];
      const uc = sleeve || L.skin, fc = L.outfit === 'kimono' || L.outfit === 'goo' ? L.skin : uc;
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.strokeStyle = OUT; x.lineWidth = 9.6; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.lineTo(hx, hy); x.stroke();
      x.strokeStyle = fc; x.lineWidth = 6.2; x.beginPath(); x.moveTo(ex, ey); x.lineTo(hx, hy); x.stroke();
      x.strokeStyle = uc; x.lineWidth = 7.2; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.stroke();
      x.strokeStyle = 'rgba(70,20,60,.16)'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(sx + s * 2, sy + 1); x.lineTo(ex + s * 2, ey); x.lineTo(hx + s * 1.4, hy); x.stroke();
      if (L.outfit === 'kimono') { x.save(); x.translate(ex, ey); x.rotate(-a); x.beginPath(); x.moveTo(-6 * s, -10); x.lineTo(6 * s, -10); x.lineTo(10 * s, 8); x.lineTo(-8 * s, 10); x.closePath(); ink(x, L.top, 2); x.fillStyle = L.top2; x.fillRect(-9, 6, 18, 2.4); x.restore(); }
      if (L.outfit === 'snowdress') { x.fillStyle = '#ffffff'; circ(x, ex + (hx - ex) * 0.75, ey + (hy - ey) * 0.75, 4.2); }
      if (L.outfit === 'armor') { x.fillStyle = L.top2; circ(x, ex, ey, 2.4); }
      x.save(); x.translate(hx, hy); x.rotate(-a2); x.beginPath(); x.ellipse(0, 2.2, 3.7, 4.8, 0, 0, TAU); ink(x, L.skin, 2); x.beginPath(); x.ellipse(-s * 3, 0.5, 1.6, 2.6, s * 0.5, 0, TAU); ink(x, L.skin, 1.4); x.restore();
    }
  }
  /* --- лицо --- */
  function face(x, L, expr, blink, t) {
    // шея и голова
    x.beginPath(); x.moveTo(-5.4, 2); x.lineTo(-5, -10); x.lineTo(5, -10); x.lineTo(5.4, 2); x.closePath(); ink(x, L.skin, 2);
    x.fillStyle = shade(L.skin, 0.82); x.fillRect(-5, -10, 10, 4);
    x.beginPath(); x.arc(0, -31, 20.4, PI * 0.92, PI * 2.08); x.lineTo(19.5, -21); x.quadraticCurveTo(14, -6, 0, -3.6); x.quadraticCurveTo(-14, -6, -19.5, -21); x.closePath();
    ink(x, L.skin, 2.4);
    x.save(); x.clip(); x.fillStyle = shade(L.skin, 0.86); ell(x, 0, -41, 23, 10); ell(x, 21, -24, 5, 16); x.fillStyle = 'rgba(255,255,255,.28)'; ell(x, -10, -13.5, 4, 2); ell(x, -14, -30, 2.4, 6, 0.3); x.restore();
    // глаза
    for (const s of [-1, 1]) eye(x, s * 9, -21.6, s, L, expr, blink);
    // брови
    x.strokeStyle = shade(L.hair, 0.6); x.lineWidth = 1.7; x.lineCap = 'round';
    for (const s of [-1, 1]) { const ang = expr === 'angry' ? 0.35 : expr === 'surprised' || expr === 'blush' ? -0.18 : expr === 'hurt' ? -0.3 : 0.06; x.beginPath(); x.moveTo(s * 4, -34.6 + (expr === 'angry' ? 2 : 0)); x.lineTo(s * 13, -35.4 + (expr === 'angry' ? -1 : 0) - s * s * ang * 4 * (expr === 'angry' ? -1 : 1)); x.stroke(); }
    // нос и рот
    x.strokeStyle = shade(L.skin, 0.62); x.lineWidth = 1.1; x.beginPath(); x.moveTo(0.8, -17.5); x.lineTo(0, -15.6); x.stroke();
    x.strokeStyle = OUT; x.lineWidth = 1.6;
    if (expr === 'happy') { x.beginPath(); x.moveTo(-5, -11); x.quadraticCurveTo(0, -3.5, 5, -11); x.closePath(); x.fillStyle = '#b8343e'; x.fill(); x.stroke(); x.fillStyle = '#ff8a9a'; ell(x, 0, -7.6, 2.4, 1.3); }
    else if (expr === 'surprised') { x.beginPath(); x.ellipse(0, -9.5, 2.4, 3, 0, 0, TAU); x.fillStyle = '#8a2a34'; x.fill(); x.stroke(); }
    else if (expr === 'angry') { x.beginPath(); x.moveTo(-4, -8.6); x.quadraticCurveTo(0, -11.5, 4, -8.6); x.stroke(); }
    else if (expr === 'hurt' || expr === 'blush') { x.beginPath(); x.moveTo(-4.5, -9.5); for (let i = 1; i <= 4; i++) x.lineTo(-4.5 + i * 2.25, -9.5 + (i % 2 ? -1.4 : 0)); x.stroke(); }
    else if (expr === 'smug') { x.beginPath(); x.moveTo(-4, -10); x.quadraticCurveTo(1, -8, 5, -12); x.stroke(); }
    else if (expr === 'sleepy') { x.beginPath(); x.ellipse(0, -9.5, 1.6, 1.2, 0, 0, TAU); x.stroke(); }
    else { x.beginPath(); x.moveTo(-3.4, -10.4); x.quadraticCurveTo(0, -8.4, 3.4, -10.4); x.stroke(); }
    if (L.fangs && (expr === 'happy' || expr === 'smug' || expr === 'normal' || expr === 'angry')) { x.fillStyle = '#fff'; P(x, [-3, -9.6, -1.6, -9.6, -2.3, -6.4]); x.fill(); x.lineWidth = 0.8; x.stroke(); P(x, [1.6, -9.6, 3, -9.6, 2.3, -6.4]); x.fill(); x.stroke(); }
    // румянец
    const bl = expr === 'blush' || expr === 'happy' ? 0.7 : 0.28;
    x.fillStyle = 'rgba(255,110,140,' + bl + ')'; ell(x, -12, -15.5, 4.6, 2.2); ell(x, 12, -15.5, 4.6, 2.2);
    if (expr === 'blush') { x.strokeStyle = 'rgba(220,60,90,.8)'; x.lineWidth = 1; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(s * (9 + i * 2.4), -14); x.lineTo(s * (10.5 + i * 2.4), -17.5); x.stroke(); } }
    if (expr === 'hurt') { x.fillStyle = '#9ad8ff'; x.beginPath(); x.moveTo(17, -40); x.quadraticCurveTo(21, -33, 17, -31); x.quadraticCurveTo(13, -33, 17, -40); x.fill(); x.lineWidth = 1; x.strokeStyle = OUT; x.stroke(); }
  }
  function eye(x, cx, cy, s, L, expr, blink) {
    x.save();
    x.strokeStyle = OUT; x.lineCap = 'round';
    if (blink || expr === 'happy') { x.lineWidth = 2.4; x.beginPath(); if (expr === 'happy') { x.moveTo(cx - 5.6, cy + 1); x.quadraticCurveTo(cx, cy - 6, cx + 5.6, cy + 1); } else { x.moveTo(cx - 6, cy); x.quadraticCurveTo(cx, cy + 3, cx + 6, cy); } x.stroke(); x.restore(); return; }
    if (expr === 'hurt') { x.lineWidth = 2.4; x.beginPath(); x.moveTo(cx - 5 * s, cy - 4); x.lineTo(cx + 4 * s, cy); x.lineTo(cx - 5 * s, cy + 4); x.stroke(); x.restore(); return; }
    const half = expr === 'sleepy' || expr === 'smug' ? 0.5 : expr === 'angry' ? 0.3 : 0, rx = 6.9, ry = expr === 'surprised' ? 9.2 : 8.6;
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.fillStyle = '#ffffff'; x.fill();
    x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.clip();
    const ir = expr === 'surprised' ? 0.75 : 1;
    x.fillStyle = lg(x, 0, cy - 7, 0, cy + 7, [shade(L.eyes, 0.55), L.eyes, shade(L.eyes, 1.35)]); ell(x, cx + s * 0.4, cy + 0.8, 5.7 * ir, 7.6 * ir);
    x.fillStyle = '#1a0a14'; if (L.slit) ell(x, cx + s * 0.4, cy + 0.6, 1.2, 4.8 * ir); else ell(x, cx + s * 0.4, cy + 0.8, 2.4 * ir, 3.4 * ir);
    x.fillStyle = '#fff'; circ(x, cx - 2.1, cy - 3.4, 2.5); circ(x, cx + 2.4, cy + 3.6, 1.2); x.fillStyle = 'rgba(255,255,255,.35)'; ell(x, cx, cy + 4.6, 3.6, 1.6);
    if (half) { x.fillStyle = L.skin; x.fillRect(cx - 8, cy - 9, 16, 16 * half); }
    x.restore();
    x.lineWidth = 3.2; x.beginPath(); const top = cy - ry + 16 * half * 0.9; x.moveTo(cx - 7.4, top + 3.4); x.quadraticCurveTo(cx, top - 2.8, cx + 7.4, top + 2.6); x.stroke();
    x.lineWidth = 2.2; x.beginPath(); x.moveTo(cx + s * 7, top + 2.6); x.lineTo(cx + s * 10, top - 0.8); x.stroke();
    x.lineWidth = 0.9; x.beginPath(); x.moveTo(cx - 4.5, cy + ry - 0.6); x.quadraticCurveTo(cx, cy + ry + 0.8, cx + 4.5, cy + ry - 0.6); x.stroke();
    x.restore();
  }
  function frontHair(x, L, sw) {
    const c = lg(x, 0, -56, 0, -16, [L.hair2, L.hair, L.hair, shade(L.hair, 0.85)]), s = sw * 0.8;
    x.beginPath(); x.moveTo(-21.5, -20); x.lineTo(-23, -36); x.arc(0, -31, 23.4, PI * 1.03, PI * 1.97); x.lineTo(21.5, -24);
    const st = L.style === 'messy' ? [[17, -22], [12, -37], [8, -28], [3, -39], [-1, -27], [-6, -38], [-9, -29], [-13, -37], [-17, -22]]
      : [[17, -23], [13, -37], [8, -29], [4, -39], [-1, -28], [-6, -39], [-10, -29], [-14, -37], [-17, -23]];
    let px0 = 21.5, py0 = -24;
    for (const [px, py] of st) { const tip = py > -33; x.quadraticCurveTo(tip ? px + 4 : (px0 + px) / 2, tip ? py - 9 : py + 8, px + (tip ? s * 0.3 : 0), py); px0 = px; py0 = py; }
    x.quadraticCurveTo(-20, -30, -21.5, -24);
    x.closePath(); ink(x, c, 2.4);
    for (const sg of [-1, 1]) {
      const len = L.style === 'bob' || L.style === 'short' || L.style === 'messy' ? -12 : -2;
      x.beginPath(); x.moveTo(sg * 19, -40); x.quadraticCurveTo(sg * 26, -20, sg * 21.5 + s * 0.4, len); x.quadraticCurveTo(sg * 19.5, -18, sg * 17, -32); x.closePath(); ink(x, c, 2.2);
    }
    x.strokeStyle = L.hair2; x.lineWidth = 3; x.lineCap = 'round'; x.globalAlpha = 0.8; x.beginPath(); x.arc(0, -33, 17, PI * 1.18, PI * 1.42); x.stroke(); x.beginPath(); x.arc(0, -33, 17, PI * 1.52, PI * 1.62); x.stroke(); x.globalAlpha = 1;
    if (L.slime) { x.fillStyle = c; for (const p of [[-14, -18], [10, -20]]) { x.beginPath(); x.moveTo(p[0] - 2.4, p[1] - 4); x.quadraticCurveTo(p[0], p[1] + 6, p[0] + 2.4, p[1] - 4); x.fill(); } }
  }
  function headAcc(x, L, t, bloom) {
    const ear = (s, w, h, col, inner, tilt) => { x.save(); x.translate(s * 13, -49); x.rotate(s * tilt + sin(t * 2.6) * 0.04 * s); x.beginPath(); x.moveTo(-w, 4); x.lineTo(0, -h); x.lineTo(w, 4); x.closePath(); ink(x, col, 2.2); x.fillStyle = inner; P(x, [-w * 0.5, 2, 0, -h * 0.6, w * 0.5, 2]); x.fill(); x.restore(); };
    if (L.ears === 'fox') for (const s of [-1, 1]) ear(s, 8, 18, L.hair, '#fff1e2', 0.35);
    if (L.ears === 'cat') for (const s of [-1, 1]) ear(s, 7, 13, L.hair, '#ffc8c8', 0.3);
    if (L.horns) for (const s of [-1, 1]) { x.save(); x.translate(s * 12, -50); x.scale(s, 1); x.beginPath(); x.moveTo(-3, 2); x.quadraticCurveTo(10, -2, 16, -14); x.quadraticCurveTo(12, -2, 4, 5); x.closePath(); ink(x, bloom ? '#ffd04a' : '#f2e2b8', 2); x.restore(); }
    if (L.ears === 'cow') for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 25, -36, 8, 4, s * 0.4, 0, TAU); ink(x, L.fur, 2); x.fillStyle = '#ffc8c8'; ell(x, s * 25, -36, 4.4, 1.8, s * 0.4); }
    if (L.crest) { for (let i = 0; i < 3; i++) { x.save(); x.translate(-4 + i * 4, -52); x.rotate(-0.4 + i * 0.4); x.beginPath(); x.ellipse(0, -8, 3, 9, 0, 0, TAU); ink(x, i === 1 ? L.hair2 : L.hair, 1.8); x.restore(); } }
    if (L.leaves) { for (const p of [[-17, -44, -0.6], [-8, -53, -0.2], [16, -46, 0.7]]) { x.save(); x.translate(p[0], p[1]); x.rotate(p[2]); x.beginPath(); x.ellipse(0, 0, 7, 3.4, 0, 0, TAU); ink(x, '#7ccc4c', 1.6); x.restore(); } x.fillStyle = '#ff9ac8'; for (let i = 0; i < 5; i++) circ(x, 18 + cos(i * 1.257) * 3.6, -40 + sin(i * 1.257) * 3.6, 2.6); x.fillStyle = '#ffe04a'; circ(x, 18, -40, 2); }
    if (L.helmet) { x.beginPath(); x.arc(0, -36, 22, PI * 1.08, PI * 1.92); x.lineTo(19, -40); x.quadraticCurveTo(0, -46, -19, -40); x.closePath(); ink(x, '#dfe3ee', 2.2); x.fillStyle = '#e8b830'; x.fillRect(-2, -58, 4, 16); for (const s of [-1, 1]) { x.save(); x.translate(s * 19, -46); x.scale(s, 1); x.beginPath(); x.moveTo(0, 2); x.quadraticCurveTo(10, -14, 22, -16); x.quadraticCurveTo(16, -8, 18, -4); x.quadraticCurveTo(10, -4, 4, 6); x.closePath(); ink(x, '#ffffff', 1.8); x.restore(); } }
    if (L.tiara) { x.fillStyle = '#e8f8ff'; for (const p of [[-10, 8], [0, 14], [10, 8]]) { x.beginPath(); x.moveTo(p[0] - 3.4, -50); x.lineTo(p[0], -50 - p[1]); x.lineTo(p[0] + 3.4, -50); x.closePath(); ink(x, '#c8eeff', 1.6); } }
    if (L.bow) { x.save(); x.translate(15, -50); for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, 0); x.lineTo(s * 12, -8); x.lineTo(s * 12, 8); x.closePath(); ink(x, L.bow, 1.8); } x.beginPath(); x.arc(0, 0, 3.4, 0, TAU); ink(x, shade(L.bow, 0.7), 1.6); x.restore(); }
    if (L.ears === 'fin') for (const s of [-1, 1]) { x.save(); x.translate(s * 22, -30); x.scale(s, 1); x.beginPath(); x.moveTo(0, 6); x.lineTo(12, -12); x.lineTo(10, 0); x.lineTo(16, -2); x.lineTo(6, 10); x.closePath(); ink(x, L.fin || '#8ae0f0', 1.8); x.restore(); }
    if (L.frog) for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 11, -54, 8, 0, TAU); ink(x, L.hair, 2.2); x.beginPath(); x.arc(s * 11, -55, 5, 0, TAU); ink(x, '#fff', 1.4); x.fillStyle = OUT; circ(x, s * 11 + 1, -55, 2.4); }
    if (L.wisp) { const f = sin(t * 5) * 2; x.save(); x.translate(26, -62 + sin(t * 2) * 4); x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(120,200,255,.6)'; x.beginPath(); x.moveTo(0, -12 - f); x.quadraticCurveTo(8, 0, 0, 6); x.quadraticCurveTo(-8, 0, 0, -12 - f); x.fill(); x.restore(); }
    if (L.nightcap) { x.beginPath(); x.moveTo(-22, -42); x.quadraticCurveTo(0, -66, 22, -42); x.quadraticCurveTo(30, -36, 34, -24); x.lineTo(28, -26); x.quadraticCurveTo(14, -44, -22, -42); x.closePath(); ink(x, L.nightcap, 2); x.fillStyle = '#fff'; circ(x, 32, -22, 4); x.strokeStyle = OUT; x.lineWidth = 1.4; x.beginPath(); x.arc(32, -22, 4, 0, TAU); x.stroke(); }
    if (L.flowerpin) { x.fillStyle = L.flowerpin; for (let i = 0; i < 5; i++) circ(x, -19 + cos(i * 1.257) * 2.8, -36 + sin(i * 1.257) * 2.8, 2.2); x.fillStyle = '#fff4a0'; circ(x, -19, -36, 1.6); }
    if (L.hat) { x.beginPath(); x.ellipse(0, -46, 36, 8, -0.06, 0, TAU); ink(x, '#3a1a4a', 2.4); x.beginPath(); x.moveTo(-18, -48); x.quadraticCurveTo(-8, -76, 12, -96); x.quadraticCurveTo(6, -86, 20, -70); x.quadraticCurveTo(16, -60, 18, -48); x.closePath(); ink(x, '#4a2260', 2.4); x.fillStyle = '#ffb0d8'; x.fillRect(-17, -54, 35, 5); }
  }
  function sparkles(x, t) {
    x.fillStyle = '#fff2a8';
    for (let i = 0; i < 5; i++) { const a = t * 0.8 + i * 1.26, r = 40 + sin(t * 2 + i) * 6, px = cos(a) * r, py = -40 + sin(a) * r * 0.6, k = 2 + sin(t * 5 + i) * 1.4; P(x, [px, py - k * 2, px + k * 0.6, py - k * 0.6, px + k * 2, py, px + k * 0.6, py + k * 0.6, px, py + k * 2, px - k * 0.6, py + k * 0.6, px - k * 2, py, px - k * 0.6, py - k * 0.6]); x.fill(); }
  }

  /* ================= Герой и жители (вид сверху, чиби) ================= */
  const LOOKS = {
    hero: { hair: '#5a3a24', skin: '#f2d2b0', shirt: '#f4ecd8', cloak: '#3c7a4a', pants: '#5a4430', shoes: '#3a2418' },
    old: { hair: '#e8e4dc', skin: '#e8c8a8', shirt: '#8a7a5a', pants: '#4a4034', shoes: '#2a2018', bald: true, beard: '#f0ece4' },
    kid: { hair: '#c8642a', skin: '#ffd8b8', shirt: '#4a8ad8', pants: '#3a3a5a', shoes: '#2a2a3a', cap: '#d83a3a', small: true },
    elder: { hair: '#bfb8b0', skin: '#e8c8a8', shirt: '#7a4a6a', pants: '#7a4a6a', shoes: '#2a2018', scarf: '#d84a5a', skirt: true },
    shop: { hair: '#2a1e18', skin: '#e8b890', shirt: '#e8dcc0', pants: '#4a3a2a', shoes: '#2a2018', apron: '#a87a4a', mustache: true },
    tavern: { hair: '#8a4a2a', skin: '#f6cca8', shirt: '#c84a4a', pants: '#c84a4a', shoes: '#2a2018', apron: '#f4ecdc', skirt: true, bun: true },
    gena: { hair: '#e8442a', skin: '#f2c8a0', shirt: '#3a3a3a', pants: '#2a4a8a', shoes: '#1a1a1a', spiky: true },
    nun: { hair: '#1a1a1a', skin: '#f6dcc4', shirt: '#1e1e24', pants: '#1e1e24', shoes: '#1a1a1a', skirt: true, veil: true },
    baron: { hair: '#4a4a52', skin: '#f2d2b8', shirt: '#2a2a4a', pants: '#2a2a3a', shoes: '#111', tophat: true, mustache: true, monocle: true }
  };
  A.LOOKS = LOOKS;
  A.person = function (x, look, dir, walk, t) {
    const L = LOOKS[look] || LOOKS.hero, side = dir === 'left' || dir === 'right', up = dir === 'up', k = L.small ? 0.82 : 1;
    x.save(); if (dir === 'left') x.scale(-1, 1); x.scale(k, k);
    x.fillStyle = 'rgba(30,20,30,.28)'; ell(x, 0, 0, 13, 4);
    const w = walk ? sin(walk) : 0, bob = walk ? Math.abs(w) * 1.5 : sin(t * 2) * 0.4;
    // ноги
    if (L.skirt) { x.beginPath(); x.moveTo(-9, -22); x.lineTo(9, -22); x.lineTo(12, -4); x.lineTo(-12, -4); x.closePath(); ink(x, L.pants, 2); for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 5 + (side ? w * 3 * s : 0), -2.5, 4.4, 3, 0, 0, TAU); ink(x, L.shoes, 1.8); } }
    else for (const s of [-1, 1]) { const lf = side ? w * 4 * s : Math.max(0, w * s) * 3; x.beginPath(); U.rr(x, s * 5.2 - 3.4 + (side ? lf : 0), -18 - (side ? 0 : lf), 6.8, 14, 2); ink(x, L.pants, 2); x.beginPath(); x.ellipse(s * 5.2 + (side ? lf + 1.5 : 0), -3.5 - (side ? 0 : lf), 4.4, 3.2, 0, 0, TAU); ink(x, L.shoes, 1.8); }
    x.translate(0, -bob);
    // плащ сзади
    if (look === 'hero' && !up) { x.beginPath(); x.moveTo(-11, -34); x.lineTo(11, -34); x.lineTo(14, -12); x.lineTo(-14, -12); x.closePath(); ink(x, shade(L.cloak, 0.8), 2); }
    // тело
    x.beginPath(); U.rr(x, -10, -36, 20, 20, 6); ink(x, L.shirt, 2.2);
    if (L.apron && !up) { x.fillStyle = L.apron; x.fillRect(-7, -30, 14, 14); }
    if (look === 'hero') { if (up) { x.beginPath(); x.moveTo(-12, -36); x.lineTo(12, -36); x.lineTo(14, -12); x.lineTo(-14, -12); x.closePath(); ink(x, L.cloak, 2.2); } else { x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(-9, -35); x.lineTo(8, -18); x.stroke(); x.beginPath(); U.rr(x, 4, -22, 8, 7, 2); ink(x, '#8a5a32', 1.6); } }
    if (L.veil && !up) { x.fillStyle = '#ffffff'; x.fillRect(-6, -36, 12, 5); }
    // руки
    for (const s of [-1, 1]) { const sw2 = side ? -w * 4 * s : w * 2 * s; x.beginPath(); U.rr(x, s * 11 - 3, -34 + sw2 * 0.3, 6, 13, 3); ink(x, L.shirt, 1.8); x.beginPath(); x.arc(s * 11, -20 + sw2 * 0.3, 2.8, 0, TAU); ink(x, L.skin, 1.4); }
    // голова
    const hy = -48;
    if (L.veil) { x.beginPath(); x.ellipse(0, hy + 2, 15, 16, 0, 0, TAU); ink(x, '#1e1e24', 2.2); }
    x.beginPath(); x.ellipse(0, hy, 13, 12.5, 0, 0, TAU); ink(x, up ? L.hair : L.skin, 2.2);
    if (!up) {
      if (side) { x.fillStyle = OUT; ell(x, 7, hy + 1, 1.8, 2.6); x.fillStyle = '#fff'; circ(x, 7.6, hy, 0.7); x.fillStyle = 'rgba(255,120,140,.4)'; ell(x, 5, hy + 5, 3, 1.4); }
      else { for (const s of [-1, 1]) { x.fillStyle = OUT; ell(x, s * 5, hy + 1, 2, 2.8); x.fillStyle = '#fff'; circ(x, s * 5 - 0.6, hy, 0.8); } x.fillStyle = 'rgba(255,120,140,.4)'; ell(x, -8, hy + 5, 2.6, 1.3); ell(x, 8, hy + 5, 2.6, 1.3); }
      if (L.mustache) { x.fillStyle = L.hair; ell(x, side ? 6 : -3, hy + 6, 3.4, 1.4, 0.3); if (!side) ell(x, 3, hy + 6, 3.4, 1.4, -0.3); }
      if (L.beard) { x.beginPath(); x.moveTo(-9, hy + 3); x.quadraticCurveTo(0, hy + 18, 9, hy + 3); x.closePath(); ink(x, L.beard, 1.6); }
      if (L.monocle) { x.strokeStyle = '#c8a040'; x.lineWidth = 1.2; x.beginPath(); x.arc(side ? 7 : 5, hy + 1, 3.6, 0, TAU); x.stroke(); }
      if (!L.bald && !L.veil) { x.beginPath(); x.arc(0, hy - 1, 13.6, PI * 1.02, PI * 1.98); if (L.spiky) { for (let i = 0; i < 6; i++) x.lineTo(12 - i * 4.8, hy - 4 - (i % 2 ? 8 : 0)); } else x.quadraticCurveTo(side ? 4 : 0, hy - 4, -13, hy - 2); x.closePath(); ink(x, L.hair, 2); if (side) { x.beginPath(); x.moveTo(-13, hy - 3); x.quadraticCurveTo(-15, hy + 6, -9, hy + 8); x.lineTo(-6, hy - 4); x.closePath(); ink(x, L.hair, 1.8); } }
      if (L.scarf) { x.beginPath(); x.arc(0, hy - 1, 14.6, PI * 0.95, PI * 2.05); x.quadraticCurveTo(0, hy - 12, -14, hy + 4); x.closePath(); ink(x, L.scarf, 2); }
    } else if (L.bun) { x.beginPath(); x.arc(0, hy - 12, 5, 0, TAU); ink(x, L.hair, 1.8); }
    if (L.bun && !up) { x.beginPath(); x.arc(0, hy - 13, 5, 0, TAU); ink(x, L.hair, 1.8); }
    if (L.cap) { x.beginPath(); x.arc(0, hy - 2, 13.4, PI, TAU); ink(x, L.cap, 2); if (!up) { x.beginPath(); x.ellipse(side ? 10 : 0, hy - 2, side ? 7 : 11, 2.4, 0, 0, TAU); ink(x, shade(L.cap, 0.8), 1.6); } }
    if (L.tophat) { x.beginPath(); x.ellipse(0, hy - 10, 15, 3.4, 0, 0, TAU); ink(x, '#1a1a22', 2); x.beginPath(); U.rr(x, -9, hy - 30, 18, 20, 2); ink(x, '#1a1a22', 2); x.fillStyle = '#8a2a3a'; x.fillRect(-9, hy - 15, 18, 3); }
    x.restore();
  };

  /* ================= Клетки мира ================= */
  const T = D.T;
  function tileCanvas(fn, seed) { const [c, x] = canvas(T, T, 1.5); fn(x, U.rng(seed || 1)); return c; }
  const GR = { grass: ['#7ccc5a', '#6cbc4c'], forest: ['#5aa846', '#4c983c'], rock: ['#a8a090', '#988f80'], tower: ['#6a5a7a', '#5a4c6a'] };
  function grassTile(x, r, base, blades) {
    x.fillStyle = base[0]; x.fillRect(0, 0, T, T);
    x.fillStyle = base[1]; for (let i = 0; i < 6; i++) ell(x, r() * T, r() * T, 4 + r() * 6, 2 + r() * 3);
    x.fillStyle = 'rgba(255,255,220,.18)'; for (let i = 0; i < 5; i++) ell(x, r() * T, r() * T, 3 + r() * 4, 1.4 + r() * 2);
    if (blades && r() < 0.35) { const px = 8 + r() * 30, py = 8 + r() * 30; x.fillStyle = shade(base[0], 0.8); for (let k = 0; k < 3; k++) circ(x, px + cos(k * 2.1) * 2.6, py + sin(k * 2.1) * 2.6, 2.4); }
    if (blades) { x.strokeStyle = shade(base[1], 0.8); x.lineWidth = 1.4; x.lineCap = 'round'; for (let i = 0; i < 7; i++) { const px = 4 + r() * 40, py = 6 + r() * 38; x.beginPath(); x.moveTo(px - 2, py); x.lineTo(px, py - 4); x.lineTo(px + 2, py); x.stroke(); } }
  }
  A.tiles = {};
  A.tile = {
    grass: s => tileCanvas((x, r) => grassTile(x, r, GR.grass, true), s),
    forest: s => tileCanvas((x, r) => grassTile(x, r, GR.forest, true), s),
    rock: s => tileCanvas((x, r) => { grassTile(x, r, GR.rock, false); x.strokeStyle = 'rgba(60,50,40,.35)'; x.lineWidth = 1; for (let i = 0; i < 3; i++) { let px = r() * T, py = r() * T; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 3; k++) { px += (r() - 0.5) * 14; py += (r() - 0.5) * 14; x.lineTo(px, py); } x.stroke(); } if (r() < 0.5) { x.fillStyle = '#f4f8fc'; ell(x, r() * T, r() * T, 8 + r() * 6, 4 + r() * 3); } }, s),
    tower: s => tileCanvas((x, r) => { x.fillStyle = GR.tower[0]; x.fillRect(0, 0, T, T); x.strokeStyle = 'rgba(30,20,40,.5)'; x.lineWidth = 1.4; x.strokeRect(1, 1, T / 2 - 2, T / 2 - 2); x.strokeRect(T / 2 + 1, 1, T / 2 - 2, T / 2 - 2); x.strokeRect(1, T / 2 + 1, T / 2 - 2, T / 2 - 2); x.strokeRect(T / 2 + 1, T / 2 + 1, T / 2 - 2, T / 2 - 2); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(2, 2, T / 2 - 4, 3); }, s),
    path: s => tileCanvas((x, r) => { x.fillStyle = '#e2c48a'; x.fillRect(0, 0, T, T); x.fillStyle = '#d4b47a'; for (let i = 0; i < 5; i++) ell(x, r() * T, r() * T, 4 + r() * 6, 2 + r() * 3); x.fillStyle = '#b89a68'; for (let i = 0; i < 4; i++) ell(x, r() * T, r() * T, 1.6, 1.2); }, s),
    water: s => tileCanvas((x, r) => { x.fillStyle = '#4ab0e8'; x.fillRect(0, 0, T, T); x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const px = r() * 36, py = 8 + r() * 32; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 5, py - 3, px + 10, py); x.stroke(); } }, s),
    flower: s => tileCanvas((x, r) => { grassTile(x, r, GR.grass, true); for (let i = 0; i < 3; i++) { const px = 8 + r() * 32, py = 8 + r() * 32, c = ['#ff6a9a', '#ffe04a', '#ffffff', '#b07aff'][(r() * 4) | 0]; x.fillStyle = c; for (let k = 0; k < 5; k++) circ(x, px + cos(k * 1.257) * 2.6, py + sin(k * 1.257) * 2.6, 2); x.fillStyle = '#ffb02a'; circ(x, px, py, 1.4); } }, s),
    tall: s => tileCanvas((x, r) => { x.fillStyle = '#4c9a3a'; x.fillRect(0, 0, T, T); x.fillStyle = '#3e8a30'; for (let i = 0; i < 8; i++) ell(x, r() * T, r() * T, 5, 3); }, s),
    wall: s => tileCanvas((x, r) => { x.fillStyle = '#3a2c4a'; x.fillRect(0, 0, T, T); x.fillStyle = '#4a3a5c'; for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) { x.fillRect(i * 24 + (j % 2) * 12 + 1, j * 12 + 1, 22, 10); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 40, T, 8); }, s)
  };
  // высокая трава — передние стебли, рисуются поверх персонажа
  A.tallFront = (() => { const [c, x] = canvas(T, T, 1.5), r = U.rng(4); x.lineCap = 'round'; for (let i = 0; i < 16; i++) { const px = 2 + r() * 44, h = 14 + r() * 14, b = (r() - 0.5) * 8; x.strokeStyle = OUT; x.lineWidth = 4.4; x.beginPath(); x.moveTo(px, T); x.quadraticCurveTo(px + b * 0.3, T - h * 0.6, px + b, T - h); x.stroke(); x.strokeStyle = ['#4cb03a', '#5cc04a', '#3e9a30'][i % 3]; x.lineWidth = 2.6; x.stroke(); } return c; })();
  A.objs = {};
  function treeSprite(kind, seed) {
    const [c, x] = canvas(72, 96, 1.5), r = U.rng(seed);
    x.fillStyle = 'rgba(30,20,40,.28)'; ell(x, 38, 90, 24, 7);
    x.beginPath(); x.moveTo(31, 90); x.quadraticCurveTo(34, 70, 32, 56); x.lineTo(41, 56); x.quadraticCurveTo(39, 70, 42, 90); x.closePath(); ink(x, lg(x, 31, 0, 42, 0, ['#9a6a3e', '#7a5030', '#5a3820']), 2.2);
    x.strokeStyle = 'rgba(40,20,10,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(35, 84); x.lineTo(36, 66); x.moveTo(38, 80); x.lineTo(38.6, 70); x.stroke();
    if (kind === 'pine' || kind === 'snowpine') {
      for (let i = 0; i < 4; i++) {
        const y = 6 + i * 15, w = 12 + i * 7.4; x.beginPath(); x.moveTo(36, y); x.quadraticCurveTo(36 + w * 0.6, y + 14, 36 + w, y + 24); x.quadraticCurveTo(36, y + 19, 36 - w, y + 24); x.quadraticCurveTo(36 - w * 0.6, y + 14, 36, y); x.closePath();
        ink(x, lg(x, 36 - w, 0, 36 + w, 0, ['#4aa064', '#2e7a4a', '#1e5a38']), 2.2);
        x.fillStyle = 'rgba(0,30,10,.25)'; P(x, [36, y + 4, 36 + w, y + 24, 36 + w * 0.2, y + 20]); x.fill();
        if (kind === 'snowpine') { x.fillStyle = '#f6faff'; x.beginPath(); x.moveTo(36, y + 1); x.quadraticCurveTo(36 + w * 0.5, y + 9, 36 + w * 0.62, y + 13); x.quadraticCurveTo(36, y + 9, 36 - w * 0.62, y + 13); x.quadraticCurveTo(36 - w * 0.5, y + 9, 36, y + 1); x.fill(); }
      }
    } else {
      const col = kind === 'dark' ? ['#5aac48', '#3a8a3a', '#2a6a2e', '#1e5226'] : ['#8ad86a', '#5cb84a', '#45a03a', '#2e7a30'];
      const bl = [[36, 40, 25], [20, 46, 15], [52, 46, 15], [28, 26, 15], [46, 26, 14], [36, 16, 12]];
      x.fillStyle = OUT; for (const b of bl) circ(x, b[0], b[1], b[2] + 2.2);
      for (const b of bl) { x.fillStyle = lg(x, b[0] - b[2], b[1] - b[2], b[0] + b[2], b[1] + b[2], [col[0], col[1], col[2], col[3]]); circ(x, b[0], b[1], b[2]); }
      x.fillStyle = col[0]; for (const b of bl) { x.globalAlpha = 0.7; ell(x, b[0] - b[2] * 0.35, b[1] - b[2] * 0.4, b[2] * 0.4, b[2] * 0.28, -0.5); } x.globalAlpha = 1;
      x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 10; i++) circ(x, 16 + r() * 34, 10 + r() * 30, 1.2);
      x.fillStyle = 'rgba(0,40,10,.22)'; for (let i = 0; i < 14; i++) ell(x, 14 + r() * 44, 30 + r() * 28, 3, 1.8, r());
      if (r() < 0.45) { for (let i = 0; i < 5; i++) { const px = 16 + r() * 40, py = 22 + r() * 30; x.fillStyle = OUT; circ(x, px, py, 3); x.fillStyle = r() < 0.5 ? '#ff5a6a' : '#ffd04a'; circ(x, px, py, 2.2); x.fillStyle = '#fff'; circ(x, px - 0.8, py - 0.8, 0.7); } }
    }
    return c;
  }
  function prop(k) {
    const [c, x] = canvas(T, T * 1.5, 1.5), Y = T * 1.5;
    x.fillStyle = 'rgba(30,20,40,.25)'; ell(x, 24, Y - 5, 18, 5);
    if (k === 'well') { x.beginPath(); U.rr(x, 6, Y - 26, 36, 22, 6); ink(x, lg(x, 0, Y - 26, 0, Y, ['#b8b0a8', '#8a8078']), 2.2); x.strokeStyle = 'rgba(60,50,40,.4)'; x.lineWidth = 1; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(8, Y - 20 + i * 6); x.lineTo(40, Y - 20 + i * 6); x.stroke(); } x.fillStyle = '#2a4a6a'; ell(x, 24, Y - 25, 15, 4); for (const px of [9, 37]) { x.beginPath(); U.rr(x, px - 2, Y - 56, 4, 32, 1); ink(x, '#7a5030', 1.8); } x.beginPath(); x.moveTo(2, Y - 52); x.lineTo(24, Y - 66); x.lineTo(46, Y - 52); x.closePath(); ink(x, '#c84a3a', 2.2); x.strokeStyle = '#5a3a20'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(24, Y - 52); x.lineTo(24, Y - 34); x.stroke(); x.beginPath(); U.rr(x, 20, Y - 36, 8, 7, 1.5); ink(x, '#8a6a40', 1.6); }
    if (k === 'barrel') { x.beginPath(); x.ellipse(24, Y - 22, 13, 17, 0, 0, TAU); ink(x, lg(x, 11, 0, 37, 0, ['#9a6a3a', '#c08a50', '#7a5028']), 2.2); x.fillStyle = '#4a4a50'; x.fillRect(11, Y - 32, 26, 2.4); x.fillRect(11, Y - 14, 26, 2.4); x.fillStyle = '#6a4424'; ell(x, 24, Y - 37, 10, 3); }
    if (k === 'lamp') { x.strokeStyle = OUT; x.lineWidth = 5; x.beginPath(); x.moveTo(24, Y - 4); x.lineTo(24, Y - 58); x.stroke(); x.strokeStyle = '#3a3a48'; x.lineWidth = 3; x.stroke(); x.beginPath(); U.rr(x, 16, Y - 70, 16, 16, 3); ink(x, '#ffe08a', 2); x.fillStyle = '#3a3a48'; P(x, [14, Y - 70, 24, Y - 78, 34, Y - 70]); x.fill(); }
    if (k === 'cart') { x.beginPath(); U.rr(x, 4, Y - 34, 40, 16, 3); ink(x, '#a8784a', 2.2); x.fillStyle = '#ffb02a'; for (let i = 0; i < 5; i++) circ(x, 10 + i * 7, Y - 36, 4); x.fillStyle = '#ff6a3a'; circ(x, 16, Y - 39, 3.4); circ(x, 30, Y - 39, 3.4); for (const px of [12, 36]) { x.beginPath(); x.arc(px, Y - 14, 8, 0, TAU); ink(x, '#6a4428', 2); x.fillStyle = '#3a2418'; circ(x, px, Y - 14, 2); } }
    if (k === 'flowers') { x.beginPath(); U.rr(x, 4, Y - 18, 40, 14, 4); ink(x, '#8a5a3a', 2); for (let i = 0; i < 6; i++) { const px = 8 + i * 6.4, py = Y - 22 - (i % 2) * 4; x.strokeStyle = '#3a8a3a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, Y - 16); x.lineTo(px, py); x.stroke(); x.fillStyle = ['#ff6a9a', '#ffe04a', '#b07aff'][i % 3]; for (let q = 0; q < 5; q++) circ(x, px + cos(q * 1.257) * 2.6, py + sin(q * 1.257) * 2.6, 1.9); x.fillStyle = '#fff4c0'; circ(x, px, py, 1.3); } }
    if (k === 'fence') { for (const px of [6, 24, 42]) { x.beginPath(); U.rr(x, px - 3, Y - 30, 6, 26, 2); ink(x, '#c89a5a', 1.8); } x.beginPath(); U.rr(x, 0, Y - 24, T, 4, 1); ink(x, '#b0844a', 1.6); x.beginPath(); U.rr(x, 0, Y - 14, T, 4, 1); ink(x, '#b0844a', 1.6); }
    return c;
  }
  function house(kind) {
    const [c, x] = canvas(4 * T, 4 * T, 1.5), W = 4 * T, H = 4 * T;
    const roof = { elder: '#d4523a', tavern: '#8a5a3a', shop: '#3a7ad8' }[kind], wall = { elder: '#f4e4c8', tavern: '#e8d4b0', shop: '#f8ecd8' }[kind];
    x.fillStyle = 'rgba(30,20,30,.25)'; x.fillRect(10, H - 10, W - 14, 10);
    x.beginPath(); U.rr(x, 12, H - 104, W - 24, 96, 4); ink(x, wall, 2.6);
    x.fillStyle = 'rgba(120,80,40,.25)'; for (let y = H - 96; y < H - 10; y += 14) x.fillRect(14, y, W - 28, 1.4);
    x.beginPath(); U.rr(x, W - 62, H - 178, 16, 40, 2); ink(x, '#a8706a', 2.2); x.fillStyle = '#5a3a3a'; x.fillRect(W - 64, H - 180, 20, 6);
    x.beginPath(); x.moveTo(2, H - 100); x.lineTo(W / 2, H - 186); x.lineTo(W - 2, H - 100); x.closePath(); ink(x, lg(x, 0, H - 186, 0, H - 100, [shade(roof, 1.2), roof, shade(roof, 0.8)]), 2.8);
    x.strokeStyle = shade(roof, 0.75); x.lineWidth = 1.6; for (let i = 1; i < 6; i++) { const y = H - 100 - i * 14; const hw = (y - (H - 186)) / 86 * (W / 2 - 2); x.beginPath(); x.moveTo(W / 2 - hw, y); x.lineTo(W / 2 + hw, y); x.stroke(); }
    // дверь по центру снизу (клетка x+1..x+2)
    x.beginPath(); U.rr(x, W / 2 - 15, H - 50, 30, 44, 12); ink(x, '#8a5a32', 2.4); x.fillStyle = '#ffd04a'; circ(x, W / 2 + 8, H - 26, 2.2);
    for (const px of [34, W - 64]) { x.beginPath(); U.rr(x, px, H - 82, 30, 26, 3); ink(x, '#9ad4f4', 2.2); x.strokeStyle = OUT; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px + 15, H - 82); x.lineTo(px + 15, H - 56); x.moveTo(px, H - 69); x.lineTo(px + 30, H - 69); x.stroke(); x.fillStyle = '#ff8a9a'; x.fillRect(px - 2, H - 56, 34, 5); }
    x.font = 'italic 900 15px sans-serif'; x.textAlign = 'center';
    const sign = { elder: 'Баба Нюра', tavern: 'ПЬЯНЫЙ ГУСЬ', shop: 'ЛАВКА' }[kind];
    x.beginPath(); U.rr(x, W / 2 - 52, H - 124, 104, 22, 4); ink(x, '#fff4d8', 2.2); x.fillStyle = OUT; x.fillText(sign, W / 2, H - 108);
    if (kind === 'tavern') { x.fillStyle = '#fff'; ell(x, W - 30, H - 142, 9, 6); x.fillStyle = '#ffb02a'; P(x, [W - 22, H - 142, W - 14, H - 140, W - 22, H - 138]); x.fill(); }
    return c;
  }
  function rock() { const [c, x] = canvas(T, T, 1.5); x.fillStyle = 'rgba(30,20,30,.25)'; ell(x, 24, 42, 18, 5); P(x, [6, 42, 10, 22, 22, 12, 36, 16, 42, 30, 42, 42]); ink(x, '#a8a4a0', 2.2); x.fillStyle = '#c8c4bc'; P(x, [12, 24, 22, 15, 32, 18, 22, 26]); x.fill(); return c; }
  function sign() { const [c, x] = canvas(T, T, 1.5); x.beginPath(); U.rr(x, 21, 22, 6, 24, 2); ink(x, '#7a5432', 2); x.beginPath(); U.rr(x, 6, 8, 36, 20, 3); ink(x, '#c89a5a', 2.2); x.strokeStyle = 'rgba(60,30,10,.6)'; x.lineWidth = 1.4; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(11, 14 + i * 5); x.lineTo(37, 14 + i * 5); x.stroke(); } return c; }

  /* ================= Фоны боя ================= */
  A.battleBg = function (zone, w, h) {
    const [c, x] = canvas(w, h, 1), hz = h * 0.5;
    const Z = { meadow: [['#8ad8ff', '#d8f4ff'], '#7ccc5a', '#5cac44', '#4a9a3a'], forest: [['#5ab0a0', '#bfe8c8'], '#4a9a40', '#3a8a34', '#2c6e2a'], mountain: [['#8ab8e8', '#e8f2ff'], '#c8ccd4', '#a8acb8', '#f4f8ff'], tower: [['#3a1e5a', '#c86aa8'], '#6a5a7a', '#5a4a6a', '#4a3a5a'], beach: [['#5ac8ff', '#fff0d8'], '#f2d89a', '#3aa8e8', '#e0c07a'], swamp: [['#6a8a6a', '#c8d8a8'], '#5a7a4a', '#4a6a3a', '#3e5a34'], dungeon: [['#14101e', '#4a3060'], '#4a4458', '#3a3448', '#2a2638'] }[zone] || [['#8ad8ff', '#d8f4ff'], '#7ccc5a', '#5cac44', '#4a9a3a'];
    for (let i = 0; i < 6; i++) { x.fillStyle = U.rgb(U.mixRGB(hex(Z[0][0]), hex(Z[0][1]), i / 5)); x.fillRect(0, hz * i / 6, w, hz / 6 + 1); }
    const r = U.rng(zone.length * 7);
    if (zone !== 'tower' && zone !== 'dungeon') { x.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) { const cx = r() * w, cy = r() * hz * 0.6; for (let k = 0; k < 4; k++) circ(x, cx + k * 22 - 30, cy + (k % 2) * 6, 18 + r() * 8); } }
    else { x.fillStyle = '#ffe0f0'; circ(x, w * 0.8, hz * 0.3, h * 0.07); }
    x.fillStyle = Z[2]; x.beginPath(); x.moveTo(0, hz); for (let px = 0; px <= w; px += w / 12) x.lineTo(px, hz - 20 - r() * h * 0.12); x.lineTo(w, hz); x.closePath(); x.fill(); x.strokeStyle = OUT; x.lineWidth = 2; x.stroke();
    if (zone === 'forest' || zone === 'meadow') { for (let i = 0; i < 14; i++) { const px = r() * w, s = 0.5 + r() * 0.4; x.save(); x.translate(px, hz + 4); x.scale(s, s); x.drawImage(A.objs[zone === 'forest' ? 'dark' : 'tree'][0], -36, -92, 72, 96); x.restore(); } }
    if (zone === 'mountain') { for (let i = 0; i < 5; i++) { const px = r() * w; x.fillStyle = '#9aa0b0'; P(x, [px - 80, hz, px, hz - 140 - r() * 60, px + 90, hz]); x.fill(); x.strokeStyle = OUT; x.stroke(); x.fillStyle = '#f4f8ff'; P(x, [px - 28, hz - 90, px, hz - 150, px + 30, hz - 90]); x.fill(); } }
    if (zone === 'swamp') { for (let i = 0; i < 12; i++) { const px = r() * w, s = 0.5 + r() * 0.4; x.save(); x.translate(px, hz + 4); x.scale(s, s); x.drawImage(A.objs.dark[1], -36, -92, 72, 96); x.restore(); } }
    if (zone === 'dungeon') { x.fillStyle = '#ffd890'; for (let i = 0; i < 5; i++) { const px = w * (i + 0.5) / 5; x.fillRect(px - 2, hz - 90, 4, 18); x.globalAlpha = 0.3; circ(x, px, hz - 94, 16); x.globalAlpha = 1; } }
    if (zone === 'tower') { x.fillStyle = '#2a1a3a'; for (let i = 0; i < 6; i++) { x.fillRect(i * w / 6 + 20, hz - 160, 30, 160); } }
    x.fillStyle = Z[1]; x.fillRect(0, hz, w, h - hz);
    x.fillStyle = Z[3]; for (let i = 0; i < 40; i++) ell(x, r() * w, hz + r() * (h - hz), 10 + r() * 30, 3 + r() * 6);
    // площадки
    for (const [px, py, rw] of [[w * 0.72, h * 0.47, w * 0.15], [w * 0.27, h * 0.66, w * 0.17]]) { x.beginPath(); x.ellipse(px, py, rw, rw * 0.22, 0, 0, TAU); ink(x, Z[3], 3); x.fillStyle = 'rgba(255,255,255,.25)'; ell(x, px - rw * 0.2, py - rw * 0.05, rw * 0.55, rw * 0.08); }
    return c;
  };
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  /* ================= Иконки ================= */
  function icon(fn) { const [c, x] = canvas(64, 64, 1.5); fn(x); return c.toDataURL(); }
  function heart(x, cx, cy, s, col) { x.beginPath(); x.moveTo(cx, cy + s * 0.9); x.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.9, cy - s * 1.3, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.9, cy - s * 1.3, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9); x.closePath(); ink(x, col, 2.6); }
  A.heart = heart;
  A.init = function () {
    for (const k in A.tile) { A.tiles[k] = [A.tile[k](1), A.tile[k](2), A.tile[k](3)]; }
    A.objs.tree = [treeSprite('tree', 1), treeSprite('tree', 2)]; A.objs.dark = [treeSprite('dark', 3), treeSprite('dark', 4)]; A.objs.pine = [treeSprite('pine', 5), treeSprite('pine', 6)]; A.objs.snowpine = [treeSprite('snowpine', 7), treeSprite('snowpine', 8)];
    A.objs.rock = rock(); A.objs.sign = sign(); A.objs.prop = {}; for (const k of ['well', 'barrel', 'lamp', 'cart', 'flowers', 'fence']) A.objs.prop[k] = prop(k);
    A.soft = U.radial(64, [0, 'rgba(0,0,0,1)', 0.6, 'rgba(0,0,0,.45)', 1, 'rgba(0,0,0,0)']);
    A.glow = U.radial(64, [0, 'rgba(255,255,255,1)', 0.35, 'rgba(255,255,255,.45)', 1, 'rgba(255,255,255,0)']);
    { const [c, x] = canvas(256, 160, 1); const g = x.createRadialGradient(128, 80, 40, 128, 80, 150); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,10,40,.55)'); x.fillStyle = g; x.fillRect(0, 0, 256, 160); A.vign = c; } A.objs.house = { elder: house('elder'), tavern: house('tavern'), shop: house('shop') };
    A.ICON = {
      seal: icon(x => { heart(x, 32, 34, 20, '#ff4f7b'); x.fillStyle = '#fff'; ell(x, 24, 24, 5, 3, -0.6); x.strokeStyle = '#ffd04a'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 26, 0, TAU); x.stroke(); }),
      potion: icon(x => { x.beginPath(); x.arc(32, 40, 16, 0, TAU); ink(x, '#ff5a6a', 2.6); x.beginPath(); U.rr(x, 26, 12, 12, 16, 2); ink(x, '#ff5a6a', 2.4); x.beginPath(); U.rr(x, 24, 8, 16, 6, 2); ink(x, '#a86a3a', 2); x.fillStyle = 'rgba(255,255,255,.6)'; ell(x, 25, 34, 4, 6, 0.4); }),
      elixir: icon(x => { x.beginPath(); x.arc(32, 40, 16, 0, TAU); ink(x, '#ffd04a', 2.6); x.beginPath(); U.rr(x, 26, 12, 12, 16, 2); ink(x, '#ffd04a', 2.4); x.beginPath(); U.rr(x, 24, 8, 16, 6, 2); ink(x, '#a86a3a', 2); x.fillStyle = '#fff'; ell(x, 25, 34, 4, 6, 0.4); heart(x, 36, 42, 5, '#ff4f7b'); }),
      revive: icon(x => { x.beginPath(); x.ellipse(32, 34, 10, 24, 0.6, 0, TAU); ink(x, '#fff4d8', 2.4); x.strokeStyle = '#c8a040'; x.lineWidth = 2; x.beginPath(); x.moveTo(18, 52); x.lineTo(46, 14); x.stroke(); }),
      pie: icon(x => { x.beginPath(); x.ellipse(32, 38, 22, 14, 0, 0, TAU); ink(x, '#e8a85a', 2.6); x.fillStyle = '#c8783a'; for (let i = 0; i < 3; i++) x.fillRect(20 + i * 9, 32, 5, 2.4); }),
      candy: icon(x => { x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.moveTo(32, 40); x.lineTo(32, 60); x.stroke(); heart(x, 32, 28, 16, '#ff7ab0'); x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(32, 26, 7, 0, 4); x.stroke(); }),
      coin: icon(x => { x.beginPath(); x.arc(32, 32, 20, 0, TAU); ink(x, '#ffd04a', 2.6); x.fillStyle = '#e0a020'; x.font = '900 22px sans-serif'; x.textAlign = 'center'; x.fillText('₽', 32, 40); }),
      heart: icon(x => heart(x, 32, 34, 20, '#ff4f7b'))
    };
    for (const k in D.EL) A.ICON['el_' + k] = icon(x => { x.beginPath(); x.arc(32, 32, 24, 0, TAU); ink(x, D.EL[k].c, 3); x.fillStyle = '#fff'; x.font = '900 22px sans-serif'; x.textAlign = 'center'; x.fillText(D.EL[k].n[0], 32, 40); });
    // портреты-миниатюры героинь для меню
    A.thumb = {};
    for (const id in D.GIRLS) { const [c, x] = canvas(96, 96, 1.5); x.translate(48, 176); x.scale(0.85, 0.85); A.girl(x, id, { t: 0.4, expr: 'normal' }); A.thumb[id] = c.toDataURL(); }
  };
})();
