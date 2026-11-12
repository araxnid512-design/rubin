'use strict';
/* Процедурная графика: внешность, оружие, фигуры людей и тварей */
(function (DW) {
  const U = DW.U, D = DW.D;
  const ART = {};

  ART.canvas = function (w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  ART.hashStr = function (s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const sh = function (c, a) { return U.shade(c, a); };
  ART.sh = sh;
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); g.fill(); }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function poly(g, pts, c) { if (c) g.fillStyle = c; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fill(); }
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function line(g, x0, y0, x1, y1, w, c, cap) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = cap || 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  ART.ell = ell; ART.circ = circ; ART.poly = poly; ART.line = line;

  /* ---------- Внешность ---------- */
  ART.STYLES = ['short', 'buzz', 'bald', 'long', 'mohawk', 'cap', 'beanie', 'bandana', 'short', 'buzz'];
  ART.EYES = ['#4a3426', '#2f4a6a', '#3a5a3a', '#5a4a30', '#2a2a2a', '#5a6a7a'];
  ART.CAPS = ['#3a4a3a', '#5a3a2a', '#2a2f3a', '#6a5a40', '#7a2a22', '#3a3a3a'];
  ART.makeLook = function (seed, over) {
    const r = U.srng(seed);
    const pick = function (a) { return a[Math.floor(r() * a.length)]; };
    const L = {
      skin: pick(D.SKINS), hair: pick(D.HAIRS), style: pick(ART.STYLES),
      beard: pick(['none', 'none', 'stubble', 'stubble', 'beard', 'mustache']),
      scar: r() < 0.25 ? (r() < 0.5 ? 1 : 2) : 0, eyes: pick(ART.EYES), glasses: r() < 0.07,
      cap: pick(ART.CAPS), brow: (r() - 0.5) * 4, jaw: 0.9 + r() * 0.22, num: 1000 + Math.floor(r() * 9000)
    };
    if (over) for (const k in over) if (over[k] !== undefined) L[k] = over[k];
    return L;
  };
  ART.ensureLook = function (s) {
    if (s.look && s.look.style) return s.look;
    s.look = ART.makeLook(ART.hashStr(s.id || s.name), s.look || {});
    return s.look;
  };

  /* ---------- Оружие (вид сбоку, ствол вправо, начало — у рукояти) ---------- */
  const MAGPOS = { ppsh: [5, 6], ak: [6.5, 5], ak2: [6, 5], lmg: [5.5, 5], hlmg: [5.5, 6], sniper: [5.5, 3.5], hsniper: [6, 4.5] };
  ART.weapon = function (g, id, s, opt) {
    g.save(); g.scale(s, s);
    const MO = (opt && opt.mag) || 0;
    const magIn = function () { g.save(); g.translate(0, MO * 7); g.globalAlpha *= 1 - U.clamp((MO - 0.7) / 0.3, 0, 1); };
    const magOut = function () { g.restore(); };
    const M = '#26272a', M2 = '#3d3f43', M3 = '#55585d', W = '#7a4a24', W2 = '#5a3416';
    // металл: вертикальный градиент с бликом сверху
    const met = function (x, y, w, h, c) {
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, sh(c || M, 0.32)); gr.addColorStop(0.35, c || M); gr.addColorStop(1, sh(c || M, -0.45));
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y + 0.2, w, Math.min(0.5, h * 0.2));
    };
    // дерево: многоугольник с градиентом и волокнами
    const wood = function (pts, c) {
      let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
      pts.forEach(function (p) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); });
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, sh(c || W, 0.28)); gr.addColorStop(0.5, c || W); gr.addColorStop(1, sh(c || W, -0.4));
      poly(g, pts, gr);
      g.save(); g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.clip();
      g.strokeStyle = 'rgba(40,20,8,0.35)'; g.lineWidth = 0.35;
      for (let k = 0; k < 4; k++) { const yy = y0 + (y1 - y0) * (0.2 + k * 0.2); g.beginPath(); g.moveTo(x0, yy); g.quadraticCurveTo((x0 + x1) / 2, yy + (k % 2 ? 0.8 : -0.8), x1, yy + 0.3); g.stroke(); }
      g.restore();
    };
    const grip = function (pts, c) { const gr = g.createLinearGradient(pts[0][0], 0, pts[1][0] + 2, 0); gr.addColorStop(0, sh(c, 0.2)); gr.addColorStop(1, sh(c, -0.35)); poly(g, pts, gr); };
    switch (id) {
      case 'ppsh': {
        // приклад и ложа одним куском дерева
        wood([[-13, -1.2], [-6, -2.2], [-1, -2.2], [-1, 2.2], [-3, 2.4], [-5.5, 4.2], [-13, 4.8]], '#7e4c26');
        R(g, -13.4, -1.2, 1.2, 6, '#3a2414');
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-5.2, 1.6, 2.4, 1);
        // ствольная коробка
        met(-1, -2.8, 11, 4.4, '#2a2b2e');
        R(g, 0, -3.6, 6, 0.9, M3);
        R(g, 7, -4.2, 1.2, 1.4, M2);
        // кожух ствола с отверстиями
        met(10, -2.3, 13, 3.2, '#2e2f32');
        g.fillStyle = '#0c0c0d';
        for (let k = 0; k < 5; k++) { ell(g, 11.6 + k * 2.3, -0.7, 0.7, 0.9); }
        g.fillStyle = 'rgba(255,255,255,0.12)';
        for (let k = 0; k < 5; k++) g.fillRect(11.1 + k * 2.3, -1.8, 1, 0.3);
        // дульный тормоз со скосом
        poly(g, [[23, -2.3], [25.6, -2.9], [25.6, 0.9], [23, 0.9]], '#1e1f22');
        R(g, 23.4, -3.4, 0.9, 1.1, M2);
        // спуск и скоба
        g.strokeStyle = '#1a1a1c'; g.lineWidth = 0.7; g.beginPath(); g.arc(1.6, 2.6, 1.5, 0, Math.PI); g.stroke();
        // дисковый магазин
        magIn();
        let gr = g.createRadialGradient(4.2, 4.6, 0.6, 5, 6, 5);
        gr.addColorStop(0, '#5a5c60'); gr.addColorStop(0.6, '#2c2d30'); gr.addColorStop(1, '#141416');
        g.fillStyle = gr; circ(g, 5, 6, 4.7);
        g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.5; g.beginPath(); g.arc(5, 6, 3.6, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(5, 6, 2.2, 0, 7); g.stroke();
        g.fillStyle = '#6a6c70'; circ(g, 5, 6, 0.8);
        magOut();
        break;
      }
      case 'ak':
        wood([[-12, -1.6], [-2, -2.6], [-2, 1.6], [-12, 3.8]], W);
        R(g, -12, -1.6, 1.5, 5.4, W2);
        met(-2, -2.6, 12, 4.2, M); R(g, -1, -3.4, 10, 1, M2);
        wood([[10, -2.1], [16, -2.1], [16, 1.5], [10, 1.5]], W); met(10, -3.5, 6, 1.1, M2);
        met(16, -1.3, 9, 1.6, M); R(g, 23, -3.2, 1.2, 2, M);
        magIn();
        { const mg = g.createLinearGradient(4, 0, 9.4, 0); mg.addColorStop(0, '#5a3e24'); mg.addColorStop(1, '#2e1e10'); poly(g, [[4, 1.6], [7.6, 1.6], [9.4, 8.6], [6, 9.4]], mg); }
        g.strokeStyle = 'rgba(255,220,180,0.2)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(4.3, 2); g.lineTo(6.3, 9); g.stroke();
        magOut();
        grip([[0, 1.6], [2.8, 1.6], [2, 6.4], [-0.8, 6.4]], W2);
        break;
      case 'ak2':
        poly(g, [[-12, -2], [-2, -2.4], [-2, 1.6], [-12, 3.2]], M2);
        met(-12, -2, 2, 5.2, M);
        met(-2, -2.6, 13, 4.2, M); met(-1, -4, 12, 1.4, M3);
        R(g, 3, -7.6, 5, 3.6, '#1a1b1d'); R(g, 3.3, -7.3, 4.4, 0.6, 'rgba(255,255,255,0.15)');
        g.fillStyle = '#ff3a2a'; circ(g, 6.8, -5.8, 0.6);
        met(11, -2.4, 7, 4, '#2f3134');
        g.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 3; k++) g.fillRect(11.8 + k * 2, -1.6, 1.1, 2.4);
        met(18, -1.3, 8, 1.6, M); met(25, -2, 2.4, 3, M2);
        magIn();
        { const mg = g.createLinearGradient(4, 0, 8.4, 0); mg.addColorStop(0, '#3a3c40'); mg.addColorStop(1, '#141416'); poly(g, [[4, 1.6], [7.6, 1.6], [8.4, 8.4], [5, 8.6]], mg); }
        magOut();
        grip([[0, 1.6], [2.8, 1.6], [2, 6.4], [-0.8, 6.4]], '#2a2b2e');
        break;
      case 'shotgun':
        wood([[-12, -1.2], [-1, -2.6], [-1, 2], [-12, 4.2]], W);
        met(-1, -2.6, 10, 4, M);
        met(9, -2.6, 16, 2.2, M2); met(9, -0.2, 14, 2, M);
        { const px = -((opt && opt.pump) || 0) * 3.5;
          wood([[11 + px, -0.6], [18 + px, -0.6], [18 + px, 2.6], [11 + px, 2.6]], W2);
          g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.4; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(12 + px + k * 1.3, -0.4); g.lineTo(12 + px + k * 1.3, 2.4); g.stroke(); } }
        R(g, 24, -3.4, 1, 1.2, M3);
        grip([[0, 1.4], [2.8, 1.4], [2, 6], [-0.8, 6]], W2);
        break;
      case 'sniper':
        wood([[-14, -1.6], [-2, -2.4], [-2, 1.6], [-6, 1.6], [-8, 4], [-14, 4.4]], W);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(-11, 0.2, 3, 2.2);
        met(-2, -2.4, 13, 3.8, M);
        wood([[11, -2], [19, -2], [19, 1.2], [11, 1.2]], W);
        met(19, -1.2, 15, 1.4, M); met(32, -1.8, 3, 2.6, M2);
        met(0, -6.6, 12, 2.8, '#1c1d20'); met(-1, -7.2, 3, 4, M2); met(10, -7.4, 3, 4.2, M2);
        g.fillStyle = '#6fd8ff'; g.fillRect(12.6, -6.4, 0.6, 2.2);
        g.fillStyle = 'rgba(180,240,255,0.6)'; g.fillRect(12.7, -6.3, 0.3, 0.8);
        { const bx = 1.5 - ((opt && opt.bolt) || 0) * 3.5; line(g, bx, -1.8, bx - 0.6, 1.4, 0.8, M3); g.fillStyle = M3; circ(g, bx - 0.6, 1.6, 0.8); }
        magIn(); poly(g, [[4, 1.4], [7, 1.4], [7.5, 5.4], [4.4, 5.6]], M); magOut();
        grip([[-1, 1.4], [1.6, 1.4], [1, 6], [-1.6, 6]], W2);
        break;
      case 'hsniper':
        poly(g, [[-15, -2], [-2, -3], [-2, 2], [-15, 4.4]], '#2c2e31');
        met(-15, -2, 2.4, 6.4, M);
        met(-2, -3, 15, 5, M);
        met(13, -2.4, 9, 4, M2);
        met(22, -1.6, 17, 2.2, M); met(38, -3, 4, 5, M3);
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(38.6, -2.4, 0.7, 3.8); g.fillRect(40.2, -2.4, 0.7, 3.8);
        met(0, -8, 13, 3.4, '#1a1b1d'); met(-1, -8.8, 3, 5, M2); met(11, -9, 3.4, 5.2, M2);
        g.fillStyle = '#6fd8ff'; g.fillRect(14.2, -7.6, 0.6, 2.4);
        line(g, 26, 0.8, 22, 9, 1.2, M2); line(g, 26, 0.8, 30, 9, 1.2, M2);
        magIn(); poly(g, [[4, 2], [8, 2], [8.4, 7], [4.4, 7.2]], M); magOut();
        grip([[-1, 2], [1.8, 2], [1.2, 6.6], [-1.6, 6.6]], '#1a1b1d');
        break;
      case 'lmg':
        wood([[-13, -1.6], [-2, -2.4], [-2, 1.6], [-5, 1.6], [-8, 3.6], [-13, 4]], W);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(-10, 0.4, 2.6, 2);
        met(-2, -3, 14, 4.8, M); met(2, -5, 6, 2, M2);
        met(12, -1.6, 18, 2, M); met(29, -2.4, 3, 3.4, M2);
        g.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < 4; k++) g.fillRect(13 + k * 3.4, -1.2, 1.6, 1.2);
        line(g, 24, 0.6, 21, 5.5, 1.1, M2); line(g, 24, 0.6, 27, 5.5, 1.1, M2);
        magIn(); met(2, 1.8, 7, 7, '#3e4a2a'); R(g, 2, 1.8, 7, 1.4, '#55623a');
        g.fillStyle = '#c9a14a'; for (let k = 0; k < 3; k++) g.fillRect(-0.6 - k * 1.2, 2.6 + k * 1.4, 1, 0.8); magOut();
        grip([[-1, 1.6], [1.6, 1.6], [1, 6.4], [-1.6, 6.4]], W2);
        break;
      case 'hlmg':
        met(-12, -2.4, 10, 5.6, M2); met(-14, -3.4, 2.6, 7.6, M);
        met(-2, -3.6, 16, 6, M); met(3, -6, 7, 2.6, M3);
        met(14, -2.4, 20, 3, M); met(22, -3.4, 2, 5, M2); met(33, -3.2, 4, 4.6, M3);
        g.fillStyle = 'rgba(0,0,0,0.55)'; for (let k = 0; k < 3; k++) g.fillRect(33.6 + k * 1.1, -2.6, 0.5, 3.4);
        line(g, 28, 1, 24, 8, 1.4, M2); line(g, 28, 1, 32, 8, 1.4, M2);
        magIn(); met(1, 2.4, 9, 8, '#2e3a22');
        g.fillStyle = '#d0a848'; for (let k = 0; k < 4; k++) g.fillRect(-1 - k * 1.1, 3.6 + k * 1.3, 1.2, 0.9); magOut();
        grip([[-1, 2.4], [2, 2.4], [1.4, 7], [-1.6, 7]], '#1a1b1d');
        break;
      case 'turret':
        met(-4, -3, 14, 6, M2); met(10, -1.4, 14, 2.4, M); met(22, -2.2, 3, 4, M3);
        break;
      default:
        met(-6, -2, 20, 4, M);
    }
    g.restore();
  };
  ART.WLEN = { ppsh: 39, ak: 36, ak2: 39, shotgun: 37, sniper: 49, hsniper: 57, lmg: 45, hlmg: 51 };

  /* ---------- Головы ---------- */
  function hairShapeSmall(g, L, hx, hy, o) {
    const hc = L.hair;
    const style = o.helmet ? 'helmet' : (o.hood ? 'hood' : L.style);
    switch (style) {
      case 'helmet':
        g.fillStyle = o.helmetColor || '#3e4448';
        g.beginPath(); g.arc(hx, hy - 1, 6.6, Math.PI * 1.02, Math.PI * 2.02); g.lineTo(hx + 7, hy + 0.6); g.lineTo(hx - 6.8, hy + 0.6); g.closePath(); g.fill();
        R(g, hx - 6.8, hy - 0.6, 14, 1.4, sh(o.helmetColor || '#3e4448', -0.3));
        if (o.visor) { g.fillStyle = o.visor; g.fillRect(hx + 1, hy - 1.6, 5.6, 2); }
        break;
      case 'hood':
        g.fillStyle = o.hood;
        g.beginPath(); g.arc(hx - 0.5, hy - 0.5, 7.4, Math.PI * 0.75, Math.PI * 2.1); g.lineTo(hx + 4, hy + 6); g.lineTo(hx - 6, hy + 6); g.closePath(); g.fill();
        break;
      case 'bald': break;
      case 'buzz':
        g.fillStyle = U.rgba(hc, 0.75);
        g.beginPath(); g.arc(hx, hy - 0.6, 5.9, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
        break;
      case 'long':
        g.fillStyle = hc;
        g.beginPath(); g.arc(hx, hy - 0.8, 6.3, Math.PI * 1.0, Math.PI * 1.98); g.lineTo(hx + 2, hy - 2); g.lineTo(hx - 3, hy + 6); g.lineTo(hx - 6.6, hy + 5); g.closePath(); g.fill();
        break;
      case 'mohawk':
        g.fillStyle = U.rgba(hc, 0.4);
        g.beginPath(); g.arc(hx, hy - 0.6, 5.8, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
        g.fillStyle = hc; poly(g, [[hx - 3, hy - 5.2], [hx - 1, hy - 9.5], [hx + 3, hy - 9], [hx + 3, hy - 5]]);
        break;
      case 'cap':
        g.fillStyle = L.cap;
        g.beginPath(); g.arc(hx, hy - 1.2, 6.2, Math.PI, Math.PI * 2); g.closePath(); g.fill();
        g.fillStyle = sh(L.cap, -0.3); poly(g, [[hx + 3, hy - 1.6], [hx + 10, hy - 1], [hx + 9.4, hy + 0.2], [hx + 3, hy - 0.3]]);
        break;
      case 'beanie':
        g.fillStyle = L.cap;
        g.beginPath(); g.arc(hx, hy - 1.5, 6.6, Math.PI * 0.98, Math.PI * 2.02); g.closePath(); g.fill();
        R(g, hx - 6.6, hy - 2.6, 13.2, 2.2, sh(L.cap, -0.25));
        break;
      case 'bandana':
        g.fillStyle = U.rgba(hc, 0.85);
        g.beginPath(); g.arc(hx, hy - 0.8, 6, Math.PI * 1.03, Math.PI * 1.97); g.closePath(); g.fill();
        R(g, hx - 6.2, hy - 3.6, 12.6, 2.6, L.cap);
        poly(g, [[hx - 6, hy - 3], [hx - 10, hy - 1], [hx - 9, hy + 1.5], [hx - 5.6, hy - 1.2]], sh(L.cap, -0.2));
        break;
      default: // short
        g.fillStyle = hc;
        g.beginPath(); g.arc(hx, hy - 0.8, 6.1, Math.PI * 1.0, Math.PI * 1.98); g.lineTo(hx + 4.5, hy - 2.2); g.lineTo(hx - 1, hy - 3.6); g.lineTo(hx - 6, hy + 0.5); g.closePath(); g.fill();
    }
  }
  function headSmall(g, L, hx, hy, o, t) {
    const skin = L.skin;
    if (L.style === 'long' && !o.helmet && !o.hood) { g.fillStyle = sh(L.hair, -0.15); poly(g, [[hx - 6, hy - 2], [hx - 2, hy - 2], [hx - 1, hy + 7], [hx - 7, hy + 6]]); }
    R(g, hx - 2, hy + 4, 4, 3.6, sh(skin, -0.2));
    const gr = g.createRadialGradient(hx + 1.5, hy - 2, 1, hx, hy, 7.5);
    gr.addColorStop(0, sh(skin, 0.15)); gr.addColorStop(1, sh(skin, -0.2));
    g.fillStyle = gr; ell(g, hx, hy, 5.7, 6.5);
    g.fillStyle = sh(skin, -0.12); ell(g, hx - 2.4, hy + 0.6, 1.4, 2);
    g.fillStyle = sh(skin, 0.05); ell(g, hx + 5.6, hy + 0.8, 1.3, 1.1);
    if (L.beard === 'stubble') { g.fillStyle = 'rgba(30,20,15,0.32)'; ell(g, hx + 1.5, hy + 3.4, 4.3, 2.6); }
    if (L.beard === 'beard') { g.fillStyle = L.hair; poly(g, [[hx - 2.6, hy + 1], [hx + 5.6, hy + 2], [hx + 4, hy + 6.6], [hx - 0.6, hy + 7]]); }
    if (L.beard === 'mustache') { g.fillStyle = L.hair; ell(g, hx + 4, hy + 2.4, 2.2, 0.9); }
    if (o.mask) { g.fillStyle = o.mask; poly(g, [[hx - 2.5, hy + 0.6], [hx + 6.4, hy + 0.6], [hx + 5.4, hy + 6], [hx - 1.6, hy + 6]]); }
    g.fillStyle = '#16110e'; g.fillRect(hx + 2.8, hy - 1.2, 1.5, 1.6);
    if (o.eyeGlow) { g.fillStyle = o.eyeGlow; g.fillRect(hx + 2.8, hy - 1.2, 1.5, 1.4); }
    line(g, hx + 1.8, hy - 2.6, hx + 5, hy - 2.8 + (L.brow || 0) * 0.2, 1.1, sh(L.hair, -0.3), 'butt');
    if (L.glasses) { g.strokeStyle = '#222'; g.lineWidth = 0.8; g.strokeRect(hx + 2, hy - 1.9, 3.2, 2.4); }
    if (L.scar) line(g, hx + 0.5, hy - 3, hx + 2.2, hy + 2.4, 0.7, '#c97a7a');
    if (L.bscars) {
      line(g, hx + 2.6, hy + 1.2, hx + 4.8, hy + 3.4, 0.8, '#b86a66');
      if (L.bscars > 1) line(g, hx + 3.2, hy - 3.4, hx + 4.2, hy - 1.6, 0.8, '#b86a66');
      if (L.bscars > 2) line(g, hx - 1, hy - 4.6, hx + 2.6, hy - 3.6, 0.7, '#b86a66');
    }
    hairShapeSmall(g, L, hx, hy, o);
    if (o.cig) {
      line(g, hx + 5, hy + 2.6, hx + 9.4, hy + 3, 1.2, '#eee', 'butt');
      g.fillStyle = Math.sin(t / 250) > 0 ? '#ff7a2a' : '#c9581a'; g.fillRect(hx + 9, hy + 2.3, 1.4, 1.4);
      const k = (t / 1600) % 1;
      g.fillStyle = 'rgba(210,210,210,' + (0.5 * (1 - k)) + ')';
      circ(g, hx + 10 + k * 3 + Math.sin(k * 9) * 1.2, hy + 2 - k * 12, 1 + k * 2);
    }
  }

  function limbHL(g, x0, y0, x1, y1, w, k) {
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,238,215,' + (0.14 + k * 0.4) + ')'; g.lineWidth = w * 0.34;
    g.beginPath(); g.moveTo(x0, y0 - w * 0.26); g.lineTo(x1, y1 - w * 0.26); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = w * 0.3;
    g.beginPath(); g.moveTo(x0, y0 + w * 0.3); g.lineTo(x1, y1 + w * 0.3); g.stroke();
  }
  /* ---------- Человек целиком (профиль, смотрит вправо; ноги в 0,0) ----------
     o.pose: crouch, lean, recoil, raise, reload, throwP, hit, look, low (0..1 / рад) */
  const ARMORC = { vest: '#5d6440', heavy: '#454b50', exo: '#2f4552' };
  ART.human = function (g, o, t) {
    const L = o.look || ART.makeLook(1);
    const s = o.scale || 1;
    const P = o.pose || {};
    const crouch = P.crouch || 0, hit = P.hit || 0, recoil = P.recoil || 0, raise = P.raise || 0;
    const reload = P.reload || 0, thr = P.throwP || 0, low = P.low || 0;
    const run = P.run || 0, kick = P.kick || 1, smoke = P.smoke || 0;
    const rk = P.rk || 'mag';
    g.save();
    g.scale(s * (o.dir || 1), s);
    const walking = o.walk !== null && o.walk !== undefined;
    const ph = walking ? o.walk : 0;
    const sw = walking ? Math.sin(ph) * (3.4 + run * 1.6) : 0;
    const bob = walking ? -Math.abs(Math.cos(ph)) * (1.3 + run * 0.9) : Math.sin(t / 650 + (o.seed || 0)) * 0.45;
    const pants = o.pants || '#3a3128';
    const body = o.body || '#c8691c';
    const hipY = -18 + bob + crouch * 6.5;
    const tY = hipY - 1;
    const lean = (P.lean || 0) + (walking ? 0.12 + run * 0.14 : 0) + crouch * 0.18 - hit * 0.32 + raise * 0.05;
    const backStep = -hit * 2.5;
    // тень
    if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.38)'; ell(g, backStep * 0.5, 0, 12 + crouch * 2, 5); }
    // ноги
    const leg = function (x, off, c, front) {
      const fx = x + off + backStep, lift = walking ? Math.max(0, front ? Math.sin(ph) : -Math.sin(ph)) * (2.6 + run * 1.8) : 0;
      const fy = -2.2 - lift;
      const hx = x + backStep * 0.6, hy = hipY + 1;
      const kx = (hx + fx) / 2 + 1 + crouch * 4.5, ky = (hy + fy) / 2 + crouch * 1.5;
      g.strokeStyle = c; g.lineWidth = 4.6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(hx + 1.4, hy); g.lineTo(kx + 1.4, ky); g.lineTo(fx + 1.2, fy - 1); g.stroke();
      g.strokeStyle = 'rgba(255,238,215,0.16)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(hx - 1.3, hy + 1); g.lineTo(kx - 1.2, ky); g.lineTo(fx - 1.2, fy - 1.5); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.25)'; circ(g, kx + 0.3, ky + 0.2, 1.4);
      g.fillStyle = '#211a14'; g.beginPath(); g.moveTo(fx - 2.4, fy - 1.6); g.lineTo(fx + 4, fy - 1.2); g.quadraticCurveTo(fx + 5.2, fy + 2, fx + 4, fy + 2.2); g.lineTo(fx - 2.4, fy + 2.2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,235,210,0.18)'; g.fillRect(fx - 1.8, fy - 1.4, 4.6, 0.9);
      g.fillStyle = '#0e0b08'; g.fillRect(fx - 2.4, fy + 1.4, 6.6, 0.9);
    };
    leg(-2.2, -sw - crouch * 2, sh(pants, -0.25), false);
    leg(2.2, sw + crouch * 1.5, pants, true);
    // верх тела вращается вокруг таза
    g.save();
    g.translate(backStep * 0.6, hipY); g.rotate(lean); g.translate(0, -hipY);
    // перезарядка: наклон ствола, смещение магазина, работа затвором или цевьём
    let rTilt = 0, mag = 0, boltX = 0, pumpX = 0;
    if (reload > 0) {
      const sm = function (a, b, x) { const q = U.clamp((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
      if (rk === 'bolt') { rTilt = Math.sin(reload * Math.PI) * 0.18; boltX = sm(0.25, 0.45, reload) - sm(0.55, 0.75, reload); }
      else if (rk === 'pump') { rTilt = Math.sin(reload * Math.PI) * 0.25; pumpX = Math.abs(Math.sin(reload * Math.PI * 3)); }
      else { rTilt = Math.sin(reload * Math.PI) * (rk === 'box' ? 0.35 : 0.55); mag = reload < 0.5 ? sm(0.12, 0.42, reload) : 1 - sm(0.55, 0.88, reload); }
    }
    const swayW = walking ? Math.sin(ph * 2) * 0.7 : 0;
    let aim = U.clamp(o.aim || 0, -0.7, 0.7) + low * 0.45 - recoil * 0.22 * kick + rTilt + thr * 0.5 + run * 0.32 + smoke * 0.5;
    const gx = 1.5 - recoil * 2.2 * kick + raise * 0.8 - thr * 1.5 - run * 0.8, gy = tY - 9.5 - raise * 1.6 + thr * 2 + swayW + run * 1.2;
    const ca = Math.cos(aim), sa = Math.sin(aim);
    const sleeve = o.armor && ARMORC[o.armor] && o.armor !== 'vest' ? ARMORC[o.armor] : body;
    const shB = [-3.5, tY - 14], shF = [4, tY - 14];
    // задняя рука
    let bh;
    if (thr > 0) {
      const k = thr < 0.6 ? thr / 0.6 : 1 - (thr - 0.6) / 0.4;
      const ang = thr < 0.6 ? -1.2 - k * 1.2 : -2.4 + (thr - 0.6) / 0.4 * 3.4;
      bh = [shB[0] + Math.cos(ang) * 9, shB[1] + Math.sin(ang) * 9];
    } else if (smoke > 0) {
      const k = Math.sin(smoke * Math.PI);
      const g0 = [gx + ca * 1 - sa * 2, gy + sa * 1 + ca * 2];
      bh = [U.lerp(g0[0], 4.6, k), U.lerp(g0[1], tY - 20, k)];
    } else if (reload > 0) {
      const mp = (MAGPOS[o.weapon] || [6, 5]);
      const grip = [gx + ca * 1 - sa * 2, gy + sa * 1 + ca * 2];
      let tx, ty;
      if (rk === 'bolt') { const lx = 1 - boltX * 3.5, ly = -3.5; tx = gx + ca * lx - sa * ly; ty = gy + sa * lx + ca * ly; }
      else if (rk === 'pump') { tx = grip[0]; ty = grip[1]; }
      else { const lx = mp[0], ly = mp[1] + mag * 7 + 1.5; tx = gx + ca * lx - sa * ly; ty = gy + sa * lx + ca * ly; }
      const hb = U.clamp(Math.min(reload / 0.14, (1 - reload) / 0.12), 0, 1);
      bh = [U.lerp(grip[0], tx, hb), U.lerp(grip[1], ty, hb)];
    } else bh = [gx + ca * 1 - sa * 2, gy + sa * 1 + ca * 2];
    line(g, shB[0], shB[1], (shB[0] + bh[0]) / 2 - 1, (shB[1] + bh[1]) / 2 + 1.5, 3.6, sh(sleeve, -0.3));
    line(g, (shB[0] + bh[0]) / 2 - 1, (shB[1] + bh[1]) / 2 + 1.5, bh[0], bh[1], 3.3, sh(sleeve, -0.3));
    limbHL(g, shB[0], shB[1], (shB[0] + bh[0]) / 2 - 1, (shB[1] + bh[1]) / 2 + 1.5, 3.6, 0.1);
    const rank = o.rank || 0;
    if (rank >= 3) {
      line(g, -8, tY - 14, -10.5, tY - 30, 0.8, '#2a2a2a');
      g.fillStyle = '#ff5a3a'; circ(g, -10.5, tY - 30, 0.8);
      R(g, -10.2, tY - 15.5, 5, 11, '#4e4632'); R(g, -10.2, tY - 15.5, 5, 2, '#5e553e'); R(g, -9.6, tY - 9, 3.8, 3, '#3e3828');
    }
    // торс
    const tg = g.createLinearGradient(-7, 0, 7, 0);
    tg.addColorStop(0, sh(body, 0.12)); tg.addColorStop(1, sh(body, -0.28));
    g.fillStyle = tg;
    g.beginPath(); g.moveTo(-6.2, tY - 15.5); g.quadraticCurveTo(0, tY - 17.5, 6, tY - 15.5); g.lineTo(5.2, tY + 0.6); g.lineTo(-5.4, tY + 0.6); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,238,215,0.16)'; ell(g, -1, tY - 14.6, 4.6, 1.6);
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(-3.5, tY - 9); g.quadraticCurveTo(-1, tY - 7.4, 2, tY - 8.6); g.moveTo(-4, tY - 4.5); g.quadraticCurveTo(-0.5, tY - 3.2, 3.4, tY - 4.4); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(3.6, tY - 15); g.lineTo(6, tY - 15.5); g.lineTo(5.2, tY + 0.6); g.lineTo(3, tY + 0.6); g.closePath(); g.fill();
    if (!o.armor || o.armor === 'robe') {
      if (o.robe !== false && body === '#c8691c') {
        line(g, -0.5, tY - 16, 1.5, tY - 11, 0.9, sh(body, -0.4));
        R(g, 1.4, tY - 12.5, 3.6, 2.6, '#e8e0cc'); R(g, 1.9, tY - 11.6, 2.6, 0.6, '#333');
      }
      if (o.coat) { g.fillStyle = o.coat; poly(g, [[-6.2, tY - 15], [-1, tY - 16], [-2, tY + 4], [-6.6, tY + 3]]); }
      if (o.collar) { g.fillStyle = o.collar; ell(g, 0, tY - 15.5, 6.6, 2.4); }
    } else {
      const ac = ARMORC[o.armor];
      g.fillStyle = ac;
      g.beginPath(); g.moveTo(-6, tY - 15); g.lineTo(5.8, tY - 15); g.lineTo(5.2, tY - 3); g.lineTo(-5.4, tY - 3); g.closePath(); g.fill();
      R(g, -5, tY - 6, 3, 3, sh(ac, -0.25)); R(g, -1.4, tY - 6, 3, 3, sh(ac, -0.25)); R(g, 2.2, tY - 6, 2.6, 3, sh(ac, -0.25));
      if (o.armor !== 'vest') {
        g.fillStyle = sh(ac, 0.12); ell(g, -5, tY - 14.5, 3.4, 2.6); ell(g, 5, tY - 14.5, 3.2, 2.5);
        R(g, -3, tY - 13, 6, 5, sh(ac, 0.08));
        if (o.armor === 'exo') { g.fillStyle = '#6fd8ff'; g.fillRect(-0.5, tY - 11, 1, 3); }
      }
    }
    if (o.band) { R(g, -6.2, tY - 13, 3, 3.2, o.band); }
    if (rank >= 2) {
      line(g, -5, tY - 15.2, 4.6, tY - 2.4, 1.7, '#4a3620', 'butt');
      g.fillStyle = '#c9a14a';
      for (let k = 1; k < 6; k++) { const q = k / 6; g.fillRect(-5 + 9.6 * q - 0.4, tY - 15.2 + 12.8 * q - 1.2, 0.8, 1.4); }
    }
    R(g, -5.5, tY - 1.6, 10.8, 2.2, '#2e2116'); R(g, -0.6, tY - 1.6, 1.8, 2.2, '#b8913a');
    if (rank >= 1) { R(g, -5, tY - 3.4, 2.6, 3, '#4a4230'); R(g, 2.4, tY - 3.4, 2.6, 3, '#4a4230'); }
    // граната в руке
    if (thr > 0 && thr < 0.75) { g.fillStyle = '#4a5530'; circ(g, bh[0], bh[1] - 1, 2.2); g.fillStyle = '#9a9a9a'; g.fillRect(bh[0] - 0.8, bh[1] - 4, 1.6, 1.4); }
    // оружие
    g.save(); g.translate(gx, gy); g.rotate(aim);
    if (o.weapon) ART.weapon(g, o.weapon, 0.82, { mag: mag, bolt: boltX, pump: pumpX });
    g.restore();
    // передняя рука
    const fl = 10 - pumpX * 3.5;
    const fx = gx + ca * fl - sa * 1.6, fy = gy + sa * fl + ca * 1.6;
    line(g, shF[0], shF[1], fx - 1, fy - 0.5, 3.6, sh(sleeve, -0.05));
    limbHL(g, shF[0], shF[1], fx - 1, fy - 0.5, 3.6, 0.2);
    g.fillStyle = sh(L.skin, -0.05); circ(g, fx, fy, 1.8); circ(g, bh[0], bh[1], 1.7);
    // голова
    const hx = 0.6 + raise * 0.6, hy = tY - 22.5 + raise * 0.8;
    if ((P.look || 0) < -0.4) {
      g.save(); g.translate(hx, 0); g.scale(-1, 1); g.translate(-hx, 0);
      headSmall(g, L, hx, hy, o, t);
      g.restore();
    } else headSmall(g, L, hx, hy, o, t);
    g.restore();
    g.restore();
  };

  /* ---------- Твари и машины (смотрят вправо; лапы в 0,0) ---------- */
  ART.creature = function (g, type, o, t) {
    const s = o.scale || 1;
    const walking = o.walk !== null && o.walk !== undefined;
    const ph = walking ? o.walk : t / 400;
    const br = Math.sin(t / 380 + (o.seed || 0)) * 0.8;
    const P = o.pose || {};
    const atk = P.atk || 0, hitP = P.hit || 0, charge = P.charge || 0;
    g.save(); g.scale(s * (o.dir || 1), s);
    g.translate(-hitP * 3.5 + atk * (type === 'scav' ? 7 : 3), 0);
    let i, gr;
    switch (type) {
      case 'scav': {
        if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.38)'; ell(g, 0, 0, 15, 5.5); }
        const legs = [[-8, 0.5], [-4, 0], [6, 0.5], [10, 0]];
        legs.forEach(function (l, k) {
          const sw = walking ? Math.sin(ph + k * 1.6) * 3 : 0;
          const c = k % 2 ? '#3a2e26' : '#2c221c';
          g.strokeStyle = c; g.lineWidth = 2.6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(l[0], -11); g.lineTo(l[0] - 2.5 + sw * 0.3, -6); g.lineTo(l[0] + sw, -0.6); g.stroke();
        });
        line(g, -12, -13 + br, -19, -8 + br, 2.2, '#4e3f35');
        gr = g.createLinearGradient(0, -22, 0, -7);
        gr.addColorStop(0, '#8a7462'); gr.addColorStop(1, '#3e3129');
        g.fillStyle = gr; ell(g, -1, -13.5 + br, 13, 7.4, -0.08);
        g.fillStyle = 'rgba(40,28,20,0.5)'; circ(g, -5, -15 + br, 2); circ(g, 2, -12 + br, 1.6); circ(g, -8, -11 + br, 1.4);
        g.fillStyle = '#5a463a';
        for (i = 0; i < 5; i++) poly(g, [[-10 + i * 4, -19 + br], [-8 + i * 4, -26 + br - (i % 2) * 2], [-6 + i * 4, -19 + br]]);
        g.fillStyle = '#6a574a'; ell(g, 12, -15 + br - atk * 2, 7.6, 4.8, 0.25 - atk * 0.3);
        g.fillStyle = '#2a1a14'; poly(g, [[13, -12.5 + br], [20.5 + atk * 2, -11 + br - atk * 4], [14, -10 + br + atk * 4]]);
        g.fillStyle = '#e8dcc8'; for (i = 0; i < 3; i++) poly(g, [[14.5 + i * 2, -12.2 + br], [15.3 + i * 2, -10.8 + br], [16 + i * 2, -12 + br]]);
        gr = g.createRadialGradient(14, -17 + br, 0.2, 14, -17 + br, 4);
        gr.addColorStop(0, 'rgba(255,60,40,0.9)'); gr.addColorStop(1, 'rgba(255,60,40,0)');
        g.fillStyle = gr; circ(g, 14, -17 + br, 4);
        g.fillStyle = '#ffd0b0'; circ(g, 14, -17 + br, 0.9); circ(g, 16.6, -16.4 + br, 0.8);
        break;
      }
      case 'brute': {
        if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.42)'; ell(g, 0, 0, 19, 7); }
        const sw = walking ? Math.sin(ph) * 2.5 : 0;
        line(g, -5, -16, -6 - sw, -1, 7, '#3a2c28', 'round');
        line(g, -11, -40 + br, -15, -6 + br, 6.6, '#3e302b');
        g.fillStyle = '#2a201c'; ell(g, -15, -4 + br, 4.6, 3.4);
        line(g, 5, -16, 6 + sw, -1, 7, '#4a3a35', 'round');
        gr = g.createLinearGradient(-14, 0, 16, 0);
        gr.addColorStop(0, '#7a665c'); gr.addColorStop(1, '#3e302b');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-14, -42 + br); g.quadraticCurveTo(2, -54 + br, 16, -40 + br); g.lineTo(11, -14); g.quadraticCurveTo(0, -10, -10, -14); g.closePath(); g.fill();
        g.fillStyle = '#9a8676';
        for (i = 0; i < 3; i++) { g.beginPath(); g.ellipse(2, -38 + i * 8 + br, 8 - i, 3, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#b8a48e'; ell(g, -10, -42 + br, 6, 4, -0.4); ell(g, 12, -42 + br, 6, 4, 0.4);
        g.fillStyle = '#4e3e38'; ell(g, 8, -46 + br, 6, 5.4);
        g.fillStyle = '#ffcc33'; circ(g, 11, -47.5 + br, 1.3); circ(g, 7.6, -47.8 + br, 1.2);
        g.fillStyle = '#e8dcc8'; poly(g, [[10, -43 + br], [12.6, -40 + br], [11.6, -43 + br]]);
        const ax = 20 + atk * 4, ay = -8 + br - atk * 46;
        line(g, 14, -40 + br, ax, ay, 7, '#5a4a43');
        g.fillStyle = '#2a201c'; ell(g, ax, ay + 2, 5, 3.6);
        break;
      }
      case 'spitter': {
        if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.36)'; ell(g, 0, 0, 14, 5); }
        for (i = 0; i < 6; i++) {
          const lx = -9 + i * 3.6, sw = walking ? Math.sin(ph + i) * 2 : 0;
          g.strokeStyle = '#3a4418'; g.lineWidth = 1.7; g.lineCap = 'round';
          g.beginPath(); g.moveTo(lx, -9); g.lineTo(lx + (i < 3 ? -4 : 4), -12); g.lineTo(lx + (i < 3 ? -6 : 6) + sw, -0.5); g.stroke();
        }
        const ch = 1 + charge * 0.32;
        gr = g.createRadialGradient(-2, -19 + br, 2, 0, -17 + br, 14 * ch);
        gr.addColorStop(0, charge > 0.5 ? '#f0ffb0' : '#d8ff70'); gr.addColorStop(0.45, '#8aa83a'); gr.addColorStop(1, '#3c4a16');
        g.fillStyle = gr; ell(g, -1, -17 + br - charge * 3, (12 + br * 0.4) * ch, (11 + br * 0.4) * ch);
        g.strokeStyle = 'rgba(40,60,10,0.6)'; g.lineWidth = 0.9;
        for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-10, -18 + i * 3); g.quadraticCurveTo(-1, -26 + i * 5 + br, 8, -18 + i * 2); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.35)'; ell(g, -5, -23 + br, 3.4, 2);
        g.fillStyle = '#4a5520'; ell(g, 11, -14 + br, 4.6, 3.6);
        g.fillStyle = '#1e2608'; ell(g, 15, -13.5 + br, 2.2, 2.6);
        g.fillStyle = '#c8ff40'; circ(g, 15.4, -10 + br + ((t / 200) % 3), 1.1);
        g.fillStyle = '#ffe23a'; circ(g, 11, -16.6 + br, 1.2);
        break;
      }
      case 'guardian': {
        if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.42)'; ell(g, 0, 0, 16, 6); }
        g.strokeStyle = '#30373c'; g.lineWidth = 3; g.lineCap = 'round';
        [[-10, 2], [10, 2], [2, 4]].forEach(function (l) { g.beginPath(); g.moveTo(0, -14); g.lineTo(l[0] * 0.8, -8); g.lineTo(l[0], 0); g.stroke(); });
        gr = g.createLinearGradient(-12, -36, 12, -10);
        gr.addColorStop(0, '#8a969e'); gr.addColorStop(1, '#3a4248');
        g.fillStyle = gr;
        g.beginPath();
        for (i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.52; const x = Math.cos(a) * 12, y = -24 + Math.sin(a) * 11 + br; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.stroke();
        R(g, -6, -31 + br, 14, 7, '#2a3034');
        gr = g.createRadialGradient(4, -27.5 + br, 0.5, 4, -27.5 + br, 6);
        gr.addColorStop(0, 'rgba(160,240,255,1)'); gr.addColorStop(1, 'rgba(111,216,255,0)');
        g.fillStyle = gr; circ(g, 4, -27.5 + br, 6);
        g.fillStyle = '#e8fbff'; g.fillRect(0, -28.5 + br, 7, 2);
        g.save(); g.translate(2, -18 + br); g.rotate(U.clamp(o.aim || 0, -0.6, 0.6));
        R(g, 0, -2, 16, 3.6, '#2a3034'); R(g, 14, -2.6, 3, 4.8, '#55606a');
        g.restore();
        break;
      }
      case 'queen': {
        if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.5)'; ell(g, 0, 0, 30, 10); }
        g.translate(0, 0); g.rotate(atk * 0.12);
        for (i = 0; i < 6; i++) {
          const lx = -20 + i * 8, sw = Math.sin(ph + i) * 2;
          g.strokeStyle = i % 2 ? '#2a1420' : '#3a1c2c'; g.lineWidth = 3.6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(lx, -14); g.quadraticCurveTo(lx - 8, -24, lx - 10 + sw, -1); g.stroke();
        }
        gr = g.createRadialGradient(-14, -28 + br, 3, -12, -24, 22);
        gr.addColorStop(0, '#a04a7a'); gr.addColorStop(1, '#3a1428');
        g.fillStyle = gr; ell(g, -12, -24 + br, 20, 15 + br * 0.6);
        g.strokeStyle = 'rgba(255,120,170,0.35)'; g.lineWidth = 1.4;
        for (i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-12, -24 + br, 18 - i * 4, 13 - i * 3, 0, 0.3, 2.8); g.stroke(); }
        gr = g.createLinearGradient(0, -48, 0, -10);
        gr.addColorStop(0, '#7a3a5e'); gr.addColorStop(1, '#2e1222');
        g.fillStyle = gr; ell(g, 10, -28 + br, 13, 15);
        g.fillStyle = '#9a4a76';
        for (i = 0; i < 5; i++) poly(g, [[2 + i * 4, -40 + br], [3 + i * 4.4, -56 + br - (i % 2) * 6], [6 + i * 4, -40 + br]]);
        g.fillStyle = '#2a0e1c'; ell(g, 24, -30 + br, 8, 7);
        gr = g.createRadialGradient(26, -33 + br, 0, 26, -33 + br, 8);
        gr.addColorStop(0, 'rgba(255,60,110,0.9)'); gr.addColorStop(1, 'rgba(255,60,110,0)');
        g.fillStyle = gr; circ(g, 26, -33 + br, 8);
        g.fillStyle = '#ffd0e0'; circ(g, 27, -33.5 + br, 1.5); circ(g, 23.5, -34.5 + br, 1.4); circ(g, 25.6, -29.5 + br, 1.1);
        line(g, 28, -26 + br, 34, -20 + br + Math.sin(t / 150) * 2, 2, '#e8c8d8');
        line(g, 27, -24 + br, 31, -16 + br - Math.sin(t / 150) * 2, 2, '#e8c8d8');
        break;
      }
      case 'turret': {
        if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.38)'; ell(g, 0, 0, 13, 5); }
        g.strokeStyle = '#2f3438'; g.lineWidth = 2.6; g.lineCap = 'round';
        [[-10, 1], [10, 1], [0, 3]].forEach(function (l) { g.beginPath(); g.moveTo(0, -10); g.lineTo(l[0], l[1]); g.stroke(); });
        gr = g.createLinearGradient(-8, -24, 8, -10);
        gr.addColorStop(0, '#7a868e'); gr.addColorStop(1, '#3a4248');
        g.fillStyle = gr; g.fillRect(-8, -22, 15, 11);
        R(g, -8, -22, 15, 2, '#9aa6ae');
        g.save(); g.translate(4, -17); g.rotate(U.clamp(o.aim || 0, -0.6, 0.6));
        ART.weapon(g, 'turret', 0.9);
        g.restore();
        g.fillStyle = Math.sin(t / 300) > 0 ? '#6fd8ff' : '#2a8aa8'; circ(g, -4, -19, 1.6);
        break;
      }
      default:
        g.fillStyle = '#a33'; circ(g, 0, -12, 10);
    }
    g.restore();
  };

  /* Наборы внешности для людей-врагов */
  ART.ENEMY_LOOKS = {
    raider: { body: '#4a3b2e', pants: '#2a2520', mask: '#8a2222', coat: '#3a2e24', look: { skin: '#c99a74', hair: '#1a1a1a', style: 'buzz', beard: 'none', glasses: false } },
    thug: { body: '#6a4228', pants: '#2a2520', look: { skin: '#b8865e', hair: '#2b2118', style: 'bald', beard: 'beard', scar: 1, glasses: false } },
    marksman: { body: '#3a4530', pants: '#262a20', hood: '#2f3a2a', look: { skin: '#c99a74', hair: '#3a2a20', style: 'short', beard: 'stubble', glasses: false } },
    boss: { body: '#1f1b18', pants: '#151210', collar: '#6a5a48', look: { skin: '#c99a74', hair: '#5a4a40', style: 'short', beard: 'beard', scar: 2, glasses: false } }
  };

  DW.ART = ART;
})(window.DW);
