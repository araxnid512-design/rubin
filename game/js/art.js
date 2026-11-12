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
  ART.weapon = function (g, id, s) {
    g.save(); g.scale(s, s);
    const M = '#26272a', M2 = '#3d3f43', M3 = '#55585d', W = '#7a4a24', W2 = '#5a3416';
    switch (id) {
      case 'ak':
        poly(g, [[-12, -1.6], [-2, -2.6], [-2, 1.6], [-12, 3.8]], W);
        R(g, -12, -1.6, 1.5, 5.4, W2);
        R(g, -2, -2.6, 12, 4.2, M); R(g, -1, -3.4, 10, 1, M2);
        R(g, 10, -2.1, 6, 3.6, W); R(g, 10, -3.5, 6, 1.1, M2);
        R(g, 16, -1.3, 9, 1.6, M); R(g, 23, -3.2, 1.2, 2, M);
        poly(g, [[4, 1.6], [7.6, 1.6], [9.4, 8.6], [6, 9.4]], '#3e2a18');
        poly(g, [[0, 1.6], [2.8, 1.6], [2, 6.4], [-0.8, 6.4]], W2);
        break;
      case 'ak2':
        poly(g, [[-12, -2], [-2, -2.4], [-2, 1.6], [-12, 3.2]], M2);
        R(g, -12, -2, 2, 5.2, M);
        R(g, -2, -2.6, 13, 4.2, M); R(g, -1, -4, 12, 1.4, M3);
        R(g, 3, -7.6, 5, 3.6, '#1a1b1d'); circ(g, 6.8, -5.8, 0.9); g.fillStyle = '#ff3a2a'; circ(g, 6.8, -5.8, 0.6);
        R(g, 11, -2.4, 7, 4, '#2f3134');
        R(g, 18, -1.3, 8, 1.6, M); R(g, 25, -2, 2.4, 3, M2);
        poly(g, [[4, 1.6], [7.6, 1.6], [8.4, 8.4], [5, 8.6]], M);
        poly(g, [[0, 1.6], [2.8, 1.6], [2, 6.4], [-0.8, 6.4]], '#1a1b1d');
        break;
      case 'shotgun':
        poly(g, [[-12, -1.2], [-1, -2.6], [-1, 2], [-12, 4.2]], W);
        R(g, -1, -2.6, 10, 4, M);
        R(g, 9, -2.6, 16, 2.2, M2); R(g, 9, -0.2, 14, 2, M);
        R(g, 11, -0.6, 7, 3.2, W2);
        R(g, 24, -3.4, 1, 1.2, M3);
        poly(g, [[0, 1.4], [2.8, 1.4], [2, 6], [-0.8, 6]], W2);
        break;
      case 'sniper':
        poly(g, [[-14, -1.6], [-2, -2.4], [-2, 1.6], [-6, 1.6], [-8, 4], [-14, 4.4]], W);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(-11, 0.2, 3, 2.2);
        R(g, -2, -2.4, 13, 3.8, M);
        R(g, 11, -2, 8, 3.2, W);
        R(g, 19, -1.2, 15, 1.4, M); R(g, 32, -1.8, 3, 2.6, M2);
        R(g, 0, -6.6, 12, 2.8, '#1c1d20'); R(g, -1, -7.2, 3, 4, M2); R(g, 10, -7.4, 3, 4.2, M2);
        g.fillStyle = '#6fd8ff'; g.fillRect(12.6, -6.4, 0.6, 2.2);
        poly(g, [[4, 1.4], [7, 1.4], [7.5, 5.4], [4.4, 5.6]], M);
        poly(g, [[-1, 1.4], [1.6, 1.4], [1, 6], [-1.6, 6]], W2);
        break;
      case 'hsniper':
        poly(g, [[-15, -2], [-2, -3], [-2, 2], [-15, 4.4]], '#2c2e31');
        R(g, -15, -2, 2.4, 6.4, M);
        R(g, -2, -3, 15, 5, M);
        R(g, 13, -2.4, 9, 4, M2);
        R(g, 22, -1.6, 17, 2.2, M); R(g, 38, -3, 4, 5, M3);
        R(g, 0, -8, 13, 3.4, '#1a1b1d'); R(g, -1, -8.8, 3, 5, M2); R(g, 11, -9, 3.4, 5.2, M2);
        line(g, 26, 0.8, 22, 9, 1.2, M2); line(g, 26, 0.8, 30, 9, 1.2, M2);
        poly(g, [[4, 2], [8, 2], [8.4, 7], [4.4, 7.2]], M);
        poly(g, [[-1, 2], [1.8, 2], [1.2, 6.6], [-1.6, 6.6]], '#1a1b1d');
        break;
      case 'lmg':
        poly(g, [[-13, -1.6], [-2, -2.4], [-2, 1.6], [-5, 1.6], [-8, 3.6], [-13, 4]], W);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(-10, 0.4, 2.6, 2);
        R(g, -2, -3, 14, 4.8, M); R(g, 2, -5, 6, 2, M2);
        R(g, 12, -1.6, 18, 2, M); R(g, 29, -2.4, 3, 3.4, M2);
        line(g, 24, 0.6, 21, 5.5, 1.1, M2); line(g, 24, 0.6, 27, 5.5, 1.1, M2);
        R(g, 2, 1.8, 7, 7, '#3e4a2a'); R(g, 2, 1.8, 7, 1.4, '#55623a');
        poly(g, [[-1, 1.6], [1.6, 1.6], [1, 6.4], [-1.6, 6.4]], W2);
        break;
      case 'hlmg':
        R(g, -12, -2.4, 10, 5.6, M2); R(g, -14, -3.4, 2.6, 7.6, M);
        R(g, -2, -3.6, 16, 6, M); R(g, 3, -6, 7, 2.6, M3);
        R(g, 14, -2.4, 20, 3, M); R(g, 22, -3.4, 2, 5, M2); R(g, 33, -3.2, 4, 4.6, M3);
        line(g, 28, 1, 24, 8, 1.4, M2); line(g, 28, 1, 32, 8, 1.4, M2);
        R(g, 1, 2.4, 9, 8, '#2e3a22');
        poly(g, [[-1, 2.4], [2, 2.4], [1.4, 7], [-1.6, 7]], '#1a1b1d');
        break;
      case 'turret':
        R(g, -4, -3, 14, 6, M2); R(g, 10, -1.4, 14, 2.4, M); R(g, 22, -2.2, 3, 4, M3);
        break;
      default:
        R(g, -6, -2, 20, 4, M);
    }
    g.restore();
  };

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
    hairShapeSmall(g, L, hx, hy, o);
    if (o.cig) {
      line(g, hx + 5, hy + 2.6, hx + 9.4, hy + 3, 1.2, '#eee', 'butt');
      g.fillStyle = Math.sin(t / 250) > 0 ? '#ff7a2a' : '#c9581a'; g.fillRect(hx + 9, hy + 2.3, 1.4, 1.4);
      const k = (t / 1600) % 1;
      g.fillStyle = 'rgba(210,210,210,' + (0.5 * (1 - k)) + ')';
      circ(g, hx + 10 + k * 3 + Math.sin(k * 9) * 1.2, hy + 2 - k * 12, 1 + k * 2);
    }
  }

  /* ---------- Человек целиком (профиль, смотрит вправо; ноги в 0,0) ---------- */
  const ARMORC = { vest: '#5d6440', heavy: '#454b50', exo: '#2f4552' };
  ART.human = function (g, o, t) {
    const L = o.look || ART.makeLook(1);
    const s = o.scale || 1;
    g.save();
    g.scale(s * (o.dir || 1), s);
    const walking = o.walk !== null && o.walk !== undefined;
    const ph = walking ? o.walk : 0;
    const sw = walking ? Math.sin(ph) * 3.2 : 0;
    const bob = walking ? -Math.abs(Math.cos(ph)) * 1.2 : Math.sin(t / 650 + (o.seed || 0)) * 0.45;
    const pants = o.pants || '#3a3128';
    const body = o.body || '#c8691c';
    const tY = -19 + bob;
    // тень
    g.fillStyle = 'rgba(0,0,0,0.38)'; ell(g, 0, 0, 12, 5);
    // ноги
    const leg = function (x, off, c) {
      g.strokeStyle = c; g.lineWidth = 4.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, tY + 1); g.lineTo(x + off * 0.4 + 0.8, -9); g.lineTo(x + off, -2.2); g.stroke();
      g.fillStyle = '#211a14'; g.beginPath(); g.moveTo(x + off - 2.4, -3.8); g.lineTo(x + off + 4, -3.4); g.quadraticCurveTo(x + off + 5.2, -0.2, x + off + 4, 0); g.lineTo(x + off - 2.4, 0); g.closePath(); g.fill();
    };
    leg(-2.2, -sw, sh(pants, -0.25));
    // задняя рука
    const aim = U.clamp(o.aim || 0, -0.7, 0.7);
    const gx = 1.5, gy = tY - 9.5;
    const ca = Math.cos(aim), sa = Math.sin(aim);
    const sleeve = o.armor && ARMORC[o.armor] && o.armor !== 'vest' ? ARMORC[o.armor] : body;
    line(g, -3.5, tY - 14, gx + ca * 1 - sa * 2, gy + sa * 1 + ca * 2, 3.6, sh(sleeve, -0.3));
    leg(2.2, sw, pants);
    // торс
    const tg = g.createLinearGradient(-7, 0, 7, 0);
    tg.addColorStop(0, sh(body, 0.12)); tg.addColorStop(1, sh(body, -0.28));
    g.fillStyle = tg;
    g.beginPath(); g.moveTo(-6.2, tY - 15.5); g.quadraticCurveTo(0, tY - 17.5, 6, tY - 15.5); g.lineTo(5.2, tY + 0.6); g.lineTo(-5.4, tY + 0.6); g.closePath(); g.fill();
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
      g.fillStyle = sh(ac, -0.3); R(g, -5, tY - 6, 3, 3, sh(ac, -0.25)); R(g, -1.4, tY - 6, 3, 3, sh(ac, -0.25)); R(g, 2.2, tY - 6, 2.6, 3, sh(ac, -0.25));
      if (o.armor !== 'vest') {
        g.fillStyle = sh(ac, 0.12); ell(g, -5, tY - 14.5, 3.4, 2.6); ell(g, 5, tY - 14.5, 3.2, 2.5);
        R(g, -3, tY - 13, 6, 5, sh(ac, 0.08));
        if (o.armor === 'exo') { g.fillStyle = '#6fd8ff'; g.fillRect(-0.5, tY - 11, 1, 3); line(g, -2.2, tY + 1, 0, -9, 1, '#6fd8ff'); }
      }
    }
    R(g, -5.5, tY - 1.6, 10.8, 2.2, '#2e2116'); R(g, -0.6, tY - 1.6, 1.8, 2.2, '#b8913a');
    // оружие
    g.save(); g.translate(gx, gy); g.rotate(aim);
    if (o.weapon) ART.weapon(g, o.weapon, 0.82);
    g.restore();
    // передняя рука
    const fx = gx + ca * 10 - sa * 1.6, fy = gy + sa * 10 + ca * 1.6;
    line(g, 4, tY - 14, fx - 1, fy - 0.5, 3.6, sh(sleeve, -0.05));
    g.fillStyle = sh(L.skin, -0.05); circ(g, fx, fy, 1.8); circ(g, gx + ca * 0.5 - sa * 2.2, gy + sa * 0.5 + ca * 2.2, 1.7);
    // голова
    headSmall(g, L, 0.6, tY - 22.5, o, t);
    g.restore();
  };

  /* ---------- Твари и машины (смотрят вправо; лапы в 0,0) ---------- */
  ART.creature = function (g, type, o, t) {
    const s = o.scale || 1;
    const walking = o.walk !== null && o.walk !== undefined;
    const ph = walking ? o.walk : t / 400;
    const br = Math.sin(t / 380 + (o.seed || 0)) * 0.8;
    g.save(); g.scale(s * (o.dir || 1), s);
    let i, gr;
    switch (type) {
      case 'scav': {
        g.fillStyle = 'rgba(0,0,0,0.38)'; ell(g, 0, 0, 15, 5.5);
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
        g.fillStyle = '#6a574a'; ell(g, 12, -15 + br, 7.6, 4.8, 0.25);
        g.fillStyle = '#2a1a14'; poly(g, [[13, -12.5 + br], [20.5, -11 + br], [14, -10 + br]]);
        g.fillStyle = '#e8dcc8'; for (i = 0; i < 3; i++) poly(g, [[14.5 + i * 2, -12.2 + br], [15.3 + i * 2, -10.8 + br], [16 + i * 2, -12 + br]]);
        gr = g.createRadialGradient(14, -17 + br, 0.2, 14, -17 + br, 4);
        gr.addColorStop(0, 'rgba(255,60,40,0.9)'); gr.addColorStop(1, 'rgba(255,60,40,0)');
        g.fillStyle = gr; circ(g, 14, -17 + br, 4);
        g.fillStyle = '#ffd0b0'; circ(g, 14, -17 + br, 0.9); circ(g, 16.6, -16.4 + br, 0.8);
        break;
      }
      case 'brute': {
        g.fillStyle = 'rgba(0,0,0,0.42)'; ell(g, 0, 0, 19, 7);
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
        line(g, 14, -40 + br, 20, -8 + br, 7, '#5a4a43');
        g.fillStyle = '#2a201c'; ell(g, 20, -6 + br, 5, 3.6);
        break;
      }
      case 'spitter': {
        g.fillStyle = 'rgba(0,0,0,0.36)'; ell(g, 0, 0, 14, 5);
        for (i = 0; i < 6; i++) {
          const lx = -9 + i * 3.6, sw = walking ? Math.sin(ph + i) * 2 : 0;
          g.strokeStyle = '#3a4418'; g.lineWidth = 1.7; g.lineCap = 'round';
          g.beginPath(); g.moveTo(lx, -9); g.lineTo(lx + (i < 3 ? -4 : 4), -12); g.lineTo(lx + (i < 3 ? -6 : 6) + sw, -0.5); g.stroke();
        }
        gr = g.createRadialGradient(-2, -19 + br, 2, 0, -17 + br, 14);
        gr.addColorStop(0, '#d8ff70'); gr.addColorStop(0.45, '#8aa83a'); gr.addColorStop(1, '#3c4a16');
        g.fillStyle = gr; ell(g, -1, -17 + br, 12 + br * 0.4, 11 + br * 0.4);
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
        g.fillStyle = 'rgba(0,0,0,0.42)'; ell(g, 0, 0, 16, 6);
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
        g.fillStyle = 'rgba(0,0,0,0.5)'; ell(g, 0, 0, 30, 10);
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
        g.fillStyle = 'rgba(0,0,0,0.38)'; ell(g, 0, 0, 13, 5);
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
