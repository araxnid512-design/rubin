'use strict';
/* Портреты бойцов и врагов, иконки снаряжения, изометрические блоки, диорамы локаций */
(function (DW) {
  const U = DW.U, D = DW.D, ART = DW.ART;
  const sh = ART.sh, ell = ART.ell, circ = ART.circ, poly = ART.poly, line = ART.line;
  const cache = {};

  function grunge(g, w, h, n, seed) {
    const r = U.srng(seed);
    for (let i = 0; i < n; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,' + (0.05 + r() * 0.08) + ')' : 'rgba(255,230,200,' + (0.02 + r() * 0.04) + ')';
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
  }

  /* ---------- Бюст человека (координаты 128×128) ---------- */
  function bust(g, L, o) {
    const skin = L.skin, hc = L.hair;
    const jaw = L.jaw || 1;
    const style = o.helmet ? 'helmet' : (o.hood ? 'hood' : L.style);
    // волосы за головой
    if (style === 'long') { g.fillStyle = sh(hc, -0.15); g.beginPath(); g.moveTo(36, 44); g.quadraticCurveTo(28, 90, 34, 104); g.lineTo(94, 104); g.quadraticCurveTo(100, 90, 92, 44); g.closePath(); g.fill(); }
    if (style === 'hood') { g.fillStyle = sh(o.hood, -0.2); g.beginPath(); g.moveTo(26, 120); g.quadraticCurveTo(20, 30, 64, 16); g.quadraticCurveTo(108, 30, 102, 120); g.closePath(); g.fill(); }
    // плечи
    const cloth = o.cloth || '#c8691c';
    let gr = g.createLinearGradient(0, 90, 128, 128);
    gr.addColorStop(0, sh(cloth, 0.12)); gr.addColorStop(1, sh(cloth, -0.35));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(4, 128); g.bezierCurveTo(8, 104, 28, 94, 50, 90); g.lineTo(78, 90); g.bezierCurveTo(100, 94, 120, 104, 124, 128); g.closePath(); g.fill();
    if (o.armor === 'robe' || !o.armor) {
      if (o.robe) {
        g.fillStyle = sh(cloth, -0.45); poly(g, [[52, 90], [76, 90], [64, 110]]);
        g.fillStyle = '#e6dcc6'; g.fillRect(76, 104, 30, 14);
        g.fillStyle = '#2a2420'; g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.fillText(String(L.num || 4721), 91, 115);
        line(g, 30, 100, 36, 128, 1.5, sh(cloth, -0.3));
      }
      if (o.collar) { g.fillStyle = o.collar; g.beginPath(); g.ellipse(64, 96, 40, 12, 0, 0, Math.PI * 2); g.fill(); grunge(g, 128, 128, 0, 1); }
    } else {
      const ac = { vest: '#5d6440', heavy: '#454b50', exo: '#2f4552' }[o.armor];
      g.fillStyle = ac;
      g.beginPath(); g.moveTo(22, 128); g.lineTo(28, 100); g.quadraticCurveTo(64, 92, 100, 100); g.lineTo(106, 128); g.closePath(); g.fill();
      g.fillStyle = sh(ac, -0.3);
      [[34, 112], [52, 114], [74, 114], [92, 112]].forEach(function (p) { g.fillRect(p[0] - 7, p[1], 14, 12); });
      line(g, 40, 98, 44, 128, 3, sh(ac, -0.35)); line(g, 88, 98, 84, 128, 3, sh(ac, -0.35));
      if (o.armor !== 'vest') {
        gr = g.createRadialGradient(20, 100, 2, 22, 104, 22);
        gr.addColorStop(0, sh(ac, 0.3)); gr.addColorStop(1, sh(ac, -0.2));
        g.fillStyle = gr; ell(g, 20, 106, 20, 14, -0.3); ell(g, 108, 106, 20, 14, 0.3);
        g.fillStyle = sh(ac, 0.1); g.beginPath(); g.ellipse(64, 94, 22, 7, 0, 0, Math.PI * 2); g.fill();
        if (o.armor === 'exo') { g.fillStyle = '#6fd8ff'; g.fillRect(60, 104, 8, 3); g.fillRect(14, 104, 10, 2); g.fillRect(104, 104, 10, 2); }
      }
    }
    const rank = o.rank || 0;
    if (rank >= 2) {
      line(g, 26, 96, 100, 128, 7, '#4a3620', 'butt');
      g.fillStyle = '#c9a14a';
      for (let i = 1; i < 9; i++) { const k = i / 9, x = 26 + 74 * k, y = 96 + 32 * k; g.save(); g.translate(x, y); g.rotate(0.41 - 1.57); g.fillRect(-1.6, -4, 3.2, 6); g.restore(); }
    }
    if (rank >= 3) {
      R2(g, 94, 100, 12, 18, '#3a3a34'); R2(g, 96, 103, 8, 4, '#55554c');
      line(g, 103, 100, 108, 74, 1.6, '#222'); g.fillStyle = '#ff5a3a'; circ(g, 108, 74, 1.6);
    }
    if (rank >= 4) { g.fillStyle = '#b02a24'; poly(g, [[6, 116], [26, 108], [29, 116], [9, 125]]); }
    if (rank >= 1) {
      g.strokeStyle = '#e3b04a'; g.lineWidth = 2.4; g.lineJoin = 'miter';
      for (let i = 0; i < Math.min(rank, 4); i++) { const y = 104 + i * 5; g.beginPath(); g.moveTo(10, y + 3 + 2); g.lineTo(18, y - 1 + 2); g.lineTo(26, y + 2 + 2); g.stroke(); }
    }
    // шея
    gr = g.createLinearGradient(0, 70, 0, 95);
    gr.addColorStop(0, sh(skin, -0.35)); gr.addColorStop(1, sh(skin, -0.12));
    g.fillStyle = gr; g.fillRect(51, 70, 26, 24);
    // уши
    g.fillStyle = sh(skin, -0.1); ell(g, 39, 58, 5, 8.5); ell(g, 89, 58, 5, 8.5);
    g.fillStyle = sh(skin, -0.3); ell(g, 39.5, 58, 2, 4.5); ell(g, 88.5, 58, 2, 4.5);
    // голова
    gr = g.createRadialGradient(56, 44, 4, 64, 56, 36);
    gr.addColorStop(0, sh(skin, 0.14)); gr.addColorStop(0.7, skin); gr.addColorStop(1, sh(skin, -0.25));
    g.fillStyle = gr;
    const jw = 24 * jaw;
    g.beginPath(); g.moveTo(40, 52); g.bezierCurveTo(39, 22, 89, 22, 88, 52);
    g.bezierCurveTo(88, 70, 64 + jw * 0.75, 86, 64, 88); g.bezierCurveTo(64 - jw * 0.75, 86, 40, 70, 40, 52); g.closePath(); g.fill();
    g.fillStyle = 'rgba(80,40,30,0.12)'; ell(g, 48, 66, 6, 4); ell(g, 80, 66, 6, 4);
    // щетина / борода
    if (L.beard === 'stubble' || L.beard === 'beard' || L.beard === 'mustache') {
      const r = U.srng(L.num || 7);
      g.fillStyle = U.rgba(hc.length === 7 ? hc : '#2b2118', 0.35);
      for (let i = 0; i < (L.beard === 'stubble' ? 240 : 120); i++) {
        const a = r() * Math.PI, rr = 14 + r() * 12;
        const x = 64 + Math.cos(a) * rr * 0.95, y = 68 + Math.sin(a) * rr * 0.75;
        g.fillRect(x, y, 1, 1);
      }
    }
    if (L.beard === 'beard') {
      g.fillStyle = sh(hc, -0.05);
      g.beginPath(); g.moveTo(41, 60); g.bezierCurveTo(42, 84, 56, 94, 64, 95); g.bezierCurveTo(72, 94, 86, 84, 87, 60);
      g.bezierCurveTo(83, 74, 74, 80, 64, 80); g.bezierCurveTo(54, 80, 45, 74, 41, 60); g.closePath(); g.fill();
    }
    if (L.beard === 'beard' || L.beard === 'mustache') {
      g.fillStyle = sh(hc, -0.1);
      g.beginPath(); g.moveTo(52, 73); g.quadraticCurveTo(64, 65, 76, 73); g.quadraticCurveTo(70, 70, 64, 71); g.quadraticCurveTo(58, 70, 52, 73); g.fill();
    }
    // маска
    if (o.mask) {
      g.fillStyle = o.mask;
      g.beginPath(); g.moveTo(40, 60); g.lineTo(88, 60); g.lineTo(84, 84); g.quadraticCurveTo(64, 96, 44, 84); g.closePath(); g.fill();
      line(g, 46, 70, 82, 70, 1, sh(o.mask, -0.3)); line(g, 48, 78, 80, 78, 1, sh(o.mask, -0.3));
    } else {
      // нос и рот
      g.strokeStyle = sh(skin, -0.32); g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(64, 54); g.lineTo(61, 66); g.quadraticCurveTo(64, 69, 68, 66); g.stroke();
      g.strokeStyle = sh(skin, -0.42); g.lineWidth = 2;
      g.beginPath(); g.moveTo(56, 76); g.quadraticCurveTo(64, 78, 72, 75.5); g.stroke();
    }
    // глаза
    const ey = 53, br = L.brow || 0;
    [[53, -1], [75, 1]].forEach(function (e) {
      g.fillStyle = sh(skin, -0.22); ell(g, e[0], ey + 3, 6, 2.4);
      g.fillStyle = o.eyeGlow || '#efe8dc'; ell(g, e[0], ey, 5, 2.8);
      if (!o.eyeGlow) {
        g.fillStyle = L.eyes || '#4a3426'; circ(g, e[0] + 0.6, ey, 2.4);
        g.fillStyle = '#111'; circ(g, e[0] + 0.6, ey, 1.1);
        g.fillStyle = '#fff'; circ(g, e[0] + 1.4, ey - 0.8, 0.6);
      }
      line(g, e[0] - 5.5, ey - 2.2, e[0] + 5.5, ey - 2.6, 1.6, sh(skin, -0.45));
      g.strokeStyle = sh(hc, -0.2); g.lineWidth = 3.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(e[0] - 6, ey - 6.5 + (e[1] < 0 ? br * 0.5 : 0)); g.lineTo(e[0] + 6, ey - 7.5 + (e[1] > 0 ? br * 0.5 : 0) + (e[1] < 0 ? br : 0) * 0); g.stroke();
    });
    if (L.scar) {
      const x0 = L.scar === 1 ? 72 : 50;
      line(g, x0, 42, x0 + 6, 66, 2, '#c47c78');
      for (let i = 0; i < 4; i++) line(g, x0 + i * 1.5 - 2, 46 + i * 5, x0 + i * 1.5 + 2.5, 47 + i * 5, 1, '#a85a58');
    }
    if (L.bscars) {
      const scar = function (x0, y0, x1, y1) {
        line(g, x0, y0, x1, y1, 2.6, '#b8706c');
        line(g, x0 + 0.6, y0 + 0.6, x1 + 0.6, y1 + 0.6, 0.8, 'rgba(255,220,210,0.45)');
        const n = 3;
        for (let i = 1; i <= n; i++) { const k = i / (n + 1), x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; line(g, x - 2.4, y + 1.2, x + 2.4, y - 1.2, 1, '#8e4a46'); }
      };
      scar(46, 64, 57, 76);
      if (L.bscars > 1) { scar(72, 41, 78, 51); g.fillStyle = sh(skin, 0.05); g.fillRect(73, 44, 4, 4); }
      if (L.bscars > 2) scar(54, 28, 70, 35);
    }
    if (L.glasses) {
      g.strokeStyle = '#1d1d1d'; g.lineWidth = 2;
      g.strokeRect(45, 48, 16, 11); g.strokeRect(67, 48, 16, 11);
      line(g, 61, 52, 67, 52, 2, '#1d1d1d');
      g.fillStyle = 'rgba(200,230,255,0.18)'; g.fillRect(45, 48, 16, 11); g.fillRect(67, 48, 16, 11);
    }
    // причёска
    g.fillStyle = hc;
    switch (style) {
      case 'helmet':
        gr = g.createLinearGradient(0, 14, 0, 50);
        gr.addColorStop(0, sh(o.helmetColor || '#4a5258', 0.2)); gr.addColorStop(1, sh(o.helmetColor || '#4a5258', -0.25));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(33, 50); g.bezierCurveTo(30, 12, 98, 12, 95, 50); g.lineTo(95, 54); g.lineTo(33, 54); g.closePath(); g.fill();
        g.fillStyle = sh(o.helmetColor || '#4a5258', -0.35); g.fillRect(33, 48, 62, 5);
        line(g, 38, 54, 44, 80, 2, '#222'); line(g, 90, 54, 84, 80, 2, '#222');
        break;
      case 'hood':
        g.fillStyle = o.hood;
        g.beginPath(); g.moveTo(32, 64); g.bezierCurveTo(26, 14, 102, 14, 96, 64); g.bezierCurveTo(92, 40, 80, 32, 64, 32); g.bezierCurveTo(48, 32, 36, 40, 32, 64); g.closePath(); g.fill();
        break;
      case 'bald':
        g.fillStyle = 'rgba(255,255,255,0.16)'; ell(g, 56, 32, 12, 5, -0.3);
        break;
      case 'buzz':
        g.fillStyle = U.rgba(hc, 0.7);
        g.beginPath(); g.moveTo(40, 48); g.bezierCurveTo(38, 20, 90, 20, 88, 48); g.bezierCurveTo(84, 36, 74, 32, 64, 32); g.bezierCurveTo(54, 32, 44, 36, 40, 48); g.closePath(); g.fill();
        break;
      case 'long':
      case 'short':
        g.beginPath(); g.moveTo(38, 54); g.bezierCurveTo(34, 18, 70, 12, 82, 22); g.bezierCurveTo(92, 30, 92, 42, 89, 54);
        g.bezierCurveTo(86, 40, 78, 34, 70, 36); g.bezierCurveTo(62, 40, 52, 34, 46, 40); g.bezierCurveTo(42, 44, 40, 48, 38, 54); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; ell(g, 62, 24, 12, 4, -0.2);
        if (style === 'long') { g.fillStyle = hc; g.fillRect(36, 50, 6, 30); g.fillRect(86, 50, 6, 30); }
        break;
      case 'mohawk':
        g.fillStyle = U.rgba(hc, 0.35);
        g.beginPath(); g.moveTo(40, 48); g.bezierCurveTo(38, 20, 90, 20, 88, 48); g.bezierCurveTo(84, 36, 74, 32, 64, 32); g.bezierCurveTo(54, 32, 44, 36, 40, 48); g.closePath(); g.fill();
        g.fillStyle = hc; poly(g, [[56, 34], [58, 8], [70, 6], [72, 34]]);
        break;
      case 'cap':
        g.fillStyle = L.cap;
        g.beginPath(); g.moveTo(37, 46); g.bezierCurveTo(36, 16, 92, 16, 91, 46); g.closePath(); g.fill();
        g.fillStyle = sh(L.cap, -0.3);
        g.beginPath(); g.moveTo(34, 46); g.quadraticCurveTo(64, 38, 94, 46); g.quadraticCurveTo(64, 58, 34, 46); g.fill();
        g.fillStyle = sh(L.cap, 0.2); circ(g, 64, 30, 4);
        break;
      case 'beanie':
        g.fillStyle = L.cap;
        g.beginPath(); g.moveTo(36, 46); g.bezierCurveTo(34, 10, 94, 10, 92, 46); g.closePath(); g.fill();
        g.fillStyle = sh(L.cap, -0.2); g.fillRect(35, 38, 58, 10);
        g.strokeStyle = sh(L.cap, -0.35); g.lineWidth = 1;
        for (let x = 38; x < 92; x += 4) { g.beginPath(); g.moveTo(x, 38); g.lineTo(x, 48); g.stroke(); }
        break;
      case 'bandana':
        g.fillStyle = U.rgba(hc, 0.8);
        g.beginPath(); g.moveTo(40, 48); g.bezierCurveTo(38, 20, 90, 20, 88, 48); g.closePath(); g.fill();
        g.fillStyle = L.cap;
        g.beginPath(); g.moveTo(38, 40); g.quadraticCurveTo(64, 28, 90, 40); g.lineTo(90, 47); g.quadraticCurveTo(64, 36, 38, 47); g.closePath(); g.fill();
        poly(g, [[88, 40], [102, 44], [98, 52], [88, 46]], sh(L.cap, -0.2));
        break;
      default: break;
    }
    if (o.cig) {
      line(g, 70, 77, 90, 84, 3.4, '#eee', 'butt');
      g.fillStyle = '#c8a070'; g.save(); g.translate(70, 77); g.rotate(0.34); g.fillRect(0, -1.7, 5, 3.4); g.restore();
      g.fillStyle = '#ff7a2a'; circ(g, 90.5, 84.2, 2);
      g.fillStyle = 'rgba(220,220,220,0.35)'; circ(g, 94, 74, 4); circ(g, 98, 62, 6); circ(g, 96, 48, 7);
    }
    // общее освещение
    gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, 'rgba(255,240,210,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }

  function frameBg(g, color, seed) {
    const gr = g.createRadialGradient(64, 46, 6, 64, 64, 92);
    gr.addColorStop(0, sh(color, -0.25)); gr.addColorStop(0.6, sh(color, -0.62)); gr.addColorStop(1, '#0b0907');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 6;
    for (let x = -128; x < 128; x += 18) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 128, 0); g.stroke(); }
    grunge(g, 128, 128, 140, seed);
  }

  function R2(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  ART.portrait = function (s, hurtLv) {
    ART.ensureLook(s);
    const rank = s.xp !== undefined && DW.G ? DW.G.rank(s) : (s.rank || 0);
    if (hurtLv === undefined && s.xp !== undefined && DW.G && s.hpBase) { const mh = DW.G.maxHp(s), hp = DW.G.hp(s); hurtLv = hp <= mh * 0.35 ? 2 : (hp < mh * 0.75 ? 1 : 0); }
    hurtLv = hurtLv || 0;
    // 3D-портрет (снимок головы модели бойца), если его атлас загружен
    const head = DW.S3 && DW.S3.head ? DW.S3.head(s) : null;
    const key = 'p|' + s.id + '|' + s.armor + '|' + s.look.style + '|' + s.cls + '|' + rank + '|' + (s.look.bscars || 0) + '|' + hurtLv + (head ? '|3d' : '');
    if (cache[key]) return cache[key];
    const c = ART.canvas(128, 128);
    const g = c.getContext('2d');
    frameBg(g, D.CLASSES[s.cls] ? D.CLASSES[s.cls].color : '#888', ART.hashStr(s.id));
    if (head) {
      g.drawImage(head, 0, 0, 128, 128);
      const vg = g.createRadialGradient(64, 60, 30, 64, 64, 92); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = vg; g.fillRect(0, 0, 128, 128);
      if (DW.G.smoker(s)) { g.fillStyle = 'rgba(220,220,220,0.35)'; g.beginPath(); g.ellipse(92, 40, 10, 6, -0.4, 0, 7); g.fill(); }
      for (let r = 0; r < rank; r++) { g.fillStyle = '#e3a33b'; g.beginPath(); g.moveTo(8, 112 - r * 7); g.lineTo(14, 108 - r * 7); g.lineTo(20, 112 - r * 7); g.lineTo(20, 115 - r * 7); g.lineTo(14, 111 - r * 7); g.lineTo(8, 115 - r * 7); g.closePath(); g.fill(); }
    } else bust(g, s.look, {
      cloth: '#c8691c', robe: true, armor: s.armor,
      helmet: s.armor === 'heavy' || s.armor === 'exo', helmetColor: s.armor === 'exo' ? '#2f4552' : '#4a5258',
      cig: DW.G.smoker(s), rank: rank
    });
    if (hurtLv) {
      // повязка, кровь и синяки
      g.save();
      g.fillStyle = 'rgba(120,20,20,0.55)'; g.beginPath(); g.ellipse(52, 70, 5, 3, 0.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(90,40,60,0.35)'; g.beginPath(); g.ellipse(76, 58, 7, 4, 0, 0, 7); g.fill();
      g.strokeStyle = '#e8e0d0'; g.lineWidth = 6; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(38, 40); g.quadraticCurveTo(64, 30, 92, 42); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; g.beginPath(); g.moveTo(40, 38); g.quadraticCurveTo(64, 28, 90, 40); g.stroke();
      g.fillStyle = 'rgba(170,20,20,0.75)'; g.beginPath(); g.ellipse(80, 38, 4, 3, 0, 0, 7); g.fill();
      if (hurtLv >= 2) {
        g.strokeStyle = 'rgba(140,15,15,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(80, 41); g.quadraticCurveTo(82, 50, 79, 60); g.stroke();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 128, 128);
        g.fillStyle = 'rgba(180,30,20,0.35)'; g.fillRect(0, 116, 128, 12);
      }
      g.restore();
    }
    // холст с 3D-снимком может быть «чужим» для браузера на file:// — тогда остаётся рисованный портрет
    try { cache[key] = c.toDataURL('image/png'); }
    catch (e) { if (head) { DW.S3.noHeads = true; return ART.portrait(s, hurtLv); } throw e; }
    return cache[key];
  };

  /* ---------- Портреты врагов ---------- */
  ART.enemyPortrait = function (type) {
    // 3D-кадр врага (стойка лицом к камере), если его атлас уже загружен (в бою)
    const f3 = DW.S3 && !DW.S3.noHeads && DW.S3.enemyShot ? DW.S3.enemyShot(type) : null;
    const key = 'e|' + type + (f3 ? '|3d' : '');
    if (cache[key]) return cache[key];
    const c = ART.canvas(128, 128);
    const g = c.getContext('2d');
    const T = D.ENEMIES[type];
    if (f3) {
      frameBg(g, T && T.beast ? '#7a3a2a' : (T && T.mech ? '#3a6a8a' : '#6a2a2a'), ART.hashStr(type));
      // голова и корпус крупно: верх фигуры у края рамки, 60 % роста — на всю высоту портрета
      const k = 128 / (f3.h * 0.6);
      g.drawImage(f3.c, 64 - f3.ox * k, 8, f3.w * k, f3.h * k);
      const vg = g.createRadialGradient(64, 60, 30, 64, 64, 92); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = vg; g.fillRect(0, 0, 128, 128);
      try { cache[key] = c.toDataURL('image/png'); return cache[key]; } catch (e) { DW.S3.noHeads = true; return ART.enemyPortrait(type); }
    }
    if (type === 'alpha') return ART.enemyPortrait('scav');
    const human = ART.ENEMY_LOOKS[type];
    frameBg(g, T && T.beast ? '#7a3a2a' : (T && T.mech ? '#3a6a8a' : '#6a2a2a'), ART.hashStr(type));
    let gr;
    if (human) {
      const L = ART.makeLook(ART.hashStr(type), human.look);
      bust(g, L, { cloth: human.body, mask: human.mask, hood: human.hood, collar: human.collar, armor: null });
      if (type === 'marksman') { g.fillStyle = '#1d1d1d'; g.fillRect(44, 46, 40, 12); g.fillStyle = 'rgba(255,190,80,0.45)'; g.fillRect(46, 48, 15, 8); g.fillRect(67, 48, 15, 8); }
    } else if (type === 'scav') {
      g.fillStyle = '#4e3f35'; for (let i = 0; i < 6; i++) poly(g, [[20 + i * 14, 50], [26 + i * 14, 18 - (i % 2) * 8], [32 + i * 14, 50]]);
      gr = g.createLinearGradient(0, 30, 0, 110); gr.addColorStop(0, '#8a7462'); gr.addColorStop(1, '#3e3129');
      g.fillStyle = gr; g.beginPath(); g.moveTo(10, 128); g.quadraticCurveTo(14, 46, 64, 40); g.quadraticCurveTo(116, 46, 118, 128); g.closePath(); g.fill();
      g.fillStyle = '#6a574a'; g.beginPath(); g.moveTo(30, 60); g.quadraticCurveTo(64, 30, 98, 60); g.lineTo(84, 100); g.lineTo(44, 100); g.closePath(); g.fill();
      g.fillStyle = '#1e120e'; g.beginPath(); g.moveTo(42, 84); g.quadraticCurveTo(64, 126, 86, 84); g.quadraticCurveTo(64, 96, 42, 84); g.fill();
      g.fillStyle = '#efe4d0'; for (let i = 0; i < 7; i++) { poly(g, [[46 + i * 6, 86], [49 + i * 6, 97], [52 + i * 6, 86]]); poly(g, [[48 + i * 5, 108], [50.5 + i * 5, 99], [53 + i * 5, 108]]); }
      [[48, 66], [80, 66]].forEach(function (e) {
        gr = g.createRadialGradient(e[0], e[1], 0, e[0], e[1], 12); gr.addColorStop(0, 'rgba(255,70,40,1)'); gr.addColorStop(1, 'rgba(255,70,40,0)');
        g.fillStyle = gr; circ(g, e[0], e[1], 12); g.fillStyle = '#ffe0c0'; circ(g, e[0], e[1], 2.5);
      });
    } else if (type === 'brute') {
      gr = g.createLinearGradient(0, 20, 0, 128); gr.addColorStop(0, '#7a665c'); gr.addColorStop(1, '#2e2420');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 128); g.quadraticCurveTo(0, 60, 30, 50); g.quadraticCurveTo(64, 20, 98, 50); g.quadraticCurveTo(128, 60, 128, 128); g.closePath(); g.fill();
      g.fillStyle = '#b8a48e'; ell(g, 18, 70, 18, 12, -0.4); ell(g, 110, 70, 18, 12, 0.4);
      g.fillStyle = '#5a4a43'; ell(g, 64, 64, 26, 24);
      g.fillStyle = '#3e302b'; g.fillRect(40, 52, 48, 10);
      g.fillStyle = '#ffcc33'; ell(g, 54, 64, 4, 2.6); ell(g, 74, 64, 4, 2.6);
      g.fillStyle = '#1e1410'; ell(g, 64, 80, 12, 5);
      g.fillStyle = '#e8dcc8'; poly(g, [[52, 80], [48, 66], [56, 79]]); poly(g, [[76, 80], [80, 66], [72, 79]]);
      g.fillStyle = '#9a8676'; for (let i = 0; i < 3; i++) ell(g, 64, 100 + i * 10, 22 - i * 3, 5);
    } else if (type === 'spitter') {
      gr = g.createRadialGradient(56, 56, 6, 64, 64, 56); gr.addColorStop(0, '#d8ff70'); gr.addColorStop(0.5, '#8aa83a'); gr.addColorStop(1, '#2c3810');
      g.fillStyle = gr; circ(g, 64, 62, 52);
      g.strokeStyle = 'rgba(40,60,10,0.6)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(16, 50 + i * 8); g.quadraticCurveTo(64, 20 + i * 14, 112, 50 + i * 6); g.stroke(); }
      g.fillStyle = '#1e2608'; ell(g, 64, 88, 12, 14);
      g.fillStyle = '#c8ff40'; circ(g, 64, 106, 4); circ(g, 60, 116, 2.5);
      g.fillStyle = '#ffe23a'; circ(g, 46, 54, 5); circ(g, 82, 54, 5); circ(g, 64, 40, 3.5);
      g.fillStyle = 'rgba(255,255,255,0.35)'; ell(g, 44, 34, 12, 6, -0.5);
    } else if (type === 'guardian') {
      gr = g.createLinearGradient(20, 20, 108, 110); gr.addColorStop(0, '#9aa6ae'); gr.addColorStop(1, '#2a3238');
      g.fillStyle = gr;
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.52; const x = 64 + Math.cos(a) * 46, y = 66 + Math.sin(a) * 42; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); g.fill();
      g.fillStyle = '#1e2428'; g.fillRect(30, 50, 68, 22);
      gr = g.createLinearGradient(30, 0, 98, 0); gr.addColorStop(0, 'rgba(111,216,255,0.2)'); gr.addColorStop(0.5, 'rgba(180,245,255,1)'); gr.addColorStop(1, 'rgba(111,216,255,0.2)');
      g.fillStyle = gr; g.fillRect(34, 57, 60, 7);
      g.fillStyle = '#55606a'; for (let i = 0; i < 5; i++) circ(g, 38 + i * 13, 90, 3);
    } else if (type === 'queen') {
      gr = g.createLinearGradient(0, 10, 0, 128); gr.addColorStop(0, '#9a4a76'); gr.addColorStop(1, '#2a0e1c');
      g.fillStyle = gr; g.beginPath(); g.moveTo(8, 128); g.quadraticCurveTo(10, 40, 64, 34); g.quadraticCurveTo(118, 40, 120, 128); g.closePath(); g.fill();
      g.fillStyle = '#b05a8a'; for (let i = 0; i < 7; i++) poly(g, [[22 + i * 12, 44], [26 + i * 12, 4 + (i % 2) * 14], [32 + i * 12, 44]]);
      [[44, 66], [64, 60], [84, 66], [54, 80], [74, 80]].forEach(function (e, i) {
        gr = g.createRadialGradient(e[0], e[1], 0, e[0], e[1], 9); gr.addColorStop(0, 'rgba(255,60,110,1)'); gr.addColorStop(1, 'rgba(255,60,110,0)');
        g.fillStyle = gr; circ(g, e[0], e[1], 9); g.fillStyle = '#ffe0ea'; circ(g, e[0], e[1], i < 3 ? 2.6 : 1.8);
      });
      line(g, 50, 96, 36, 122, 5, '#e8c8d8'); line(g, 78, 96, 92, 122, 5, '#e8c8d8');
    }
    gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, 'rgba(255,240,210,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    cache[key] = c.toDataURL('image/png');
    return cache[key];
  };

  /* ---------- Иконки снаряжения ---------- */
  ART.weaponIcon = function (id) {
    const key = 'w|' + id;
    if (cache[key]) return cache[key];
    const c = ART.canvas(180, 60);
    const g = c.getContext('2d');
    const len = ART.WLEN[id] || 36;
    const sc = Math.min(3.2, 160 / len);
    g.translate(90 - (len / 2 - 12) * sc, 28);
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
    ART.weapon(g, id, sc);
    cache[key] = c.toDataURL('image/png');
    return cache[key];
  };
  /* Фигура бойца в полный рост (оружие, броня, снаряжение по званию) */
  ART.figureURL = function (s) {
    ART.ensureLook(s);
    const rank = s.xp !== undefined && DW.G ? DW.G.rank(s) : 0;
    const key = 'f|' + s.id + '|' + s.weapon + '|' + s.armor + '|' + rank + '|' + (s.look.bscars || 0);
    if (cache[key]) return cache[key];
    const c = ART.canvas(200, 230);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(100, 200, 4, 100, 200, 90);
    gr.addColorStop(0, 'rgba(255,200,140,0.18)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 200, 230);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(96, 206, 44, 11, 0, 0, 7); g.fill();
    g.save(); g.translate(92, 204);
    ART.human(g, { look: s.look, body: '#c8691c', armor: s.armor, weapon: s.weapon, dir: 1, aim: 0.05, scale: 3.4, seed: 3, cig: DW.G.smoker(s), rank: rank, band: rank >= 4 ? '#c0302a' : null, helmet: s.armor === 'heavy' || s.armor === 'exo', helmetColor: s.armor === 'exo' ? '#2f4552' : '#4a5258', noShadow: true }, 0);
    g.restore();
    cache[key] = c.toDataURL('image/png');
    return cache[key];
  };
  ART.armorIcon = function (id) {
    const key = 'a|' + id;
    if (cache[key]) return cache[key];
    const c = ART.canvas(96, 96);
    const g = c.getContext('2d');
    const col = D.ARMORS[id] ? D.ARMORS[id].color : '#888';
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
    const gr = g.createLinearGradient(20, 10, 76, 90);
    gr.addColorStop(0, sh(col, 0.25)); gr.addColorStop(1, sh(col, -0.3));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(26, 12); g.lineTo(40, 18); g.quadraticCurveTo(48, 28, 56, 18); g.lineTo(70, 12); g.lineTo(84, 30); g.lineTo(74, 38); g.lineTo(74, 86); g.lineTo(22, 86); g.lineTo(22, 38); g.lineTo(12, 30); g.closePath(); g.fill();
    g.shadowColor = 'transparent';
    if (id === 'robe') { g.fillStyle = '#e6dcc6'; g.fillRect(52, 50, 16, 9); line(g, 48, 22, 48, 86, 2, sh(col, -0.35)); }
    else {
      g.fillStyle = sh(col, -0.3);
      [[26, 64], [40, 64], [56, 64]].forEach(function (p) { g.fillRect(p[0], p[1], 13, 14); });
      if (id !== 'vest') { g.fillStyle = sh(col, 0.15); ell(g, 22, 30, 14, 9, -0.4); ell(g, 74, 30, 14, 9, 0.4); }
      if (id === 'exo') { g.fillStyle = '#6fd8ff'; g.fillRect(44, 44, 8, 3); }
    }
    cache[key] = c.toDataURL('image/png');
    return cache[key];
  };

  /* ---------- Изометрические блоки ---------- */
  ART.HW = 32; ART.HH = 16;
  ART.P = function (u, v, h, hw, hh) { return [(u - v) * (hw || ART.HW), (u + v) * (hh || ART.HH) - (h || 0)]; };
  ART.box = function (g, u0, v0, u1, v1, h0, h1, top, left, right, o) {
    o = o || {};
    const hw = o.hw || ART.HW, hh = o.hh || ART.HH;
    const P = function (u, v, h) { return [(u - v) * hw, (u + v) * hh - h]; };
    poly(g, [P(u0, v1, h0), P(u1, v1, h0), P(u1, v1, h1), P(u0, v1, h1)], left);
    poly(g, [P(u1, v0, h0), P(u1, v1, h0), P(u1, v1, h1), P(u1, v0, h1)], right);
    poly(g, [P(u0, v0, h1), P(u1, v0, h1), P(u1, v1, h1), P(u0, v1, h1)], top);
    if (o.edge !== false) {
      g.strokeStyle = 'rgba(255,240,220,0.12)'; g.lineWidth = 1;
      g.beginPath(); const a = P(u0, v1, h1), b = P(u1, v1, h1), c = P(u1, v0, h1); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); const d = P(u1, v1, h0), e = P(u1, v1, h1); g.moveTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.stroke();
    }
  };
  /* Трансформации для рисования текстур на гранях: s — вдоль грани (в клетках), t — вверх (px) */
  ART.faceL = function (g, u0, v1, h0, o) { const hw = (o && o.hw) || ART.HW, hh = (o && o.hh) || ART.HH; g.transform(hw, hh, 0, -1, (u0 - v1) * hw, (u0 + v1) * hh - h0); };
  ART.faceR = function (g, u1, v0, h0, o) { const hw = (o && o.hw) || ART.HW, hh = (o && o.hh) || ART.HH; g.transform(-hw, hh, 0, -1, (u1 - v0) * hw, (u1 + v0) * hh - h0); };
  ART.faceT = function (g, u0, v0, h, o) { const hw = (o && o.hw) || ART.HW, hh = (o && o.hh) || ART.HH; g.transform(hw, hh, -hw, hh, (u0 - v0) * hw, (u0 + v0) * hh - h); };
  /* Экструдированный «валун» */
  ART.blob = function (g, cu, cv, rad, h, col, seed, o) {
    const hw = (o && o.hw) || ART.HW, hh = (o && o.hh) || ART.HH;
    const r = U.srng(seed);
    const pts = [];
    const n = 10;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = 0.72 + r() * 0.32; pts.push([cu + Math.cos(a) * rad * k, cv + Math.sin(a) * rad * k]); }
    const ring = function (z, k) {
      g.beginPath();
      pts.forEach(function (p, i) {
        const u = cu + (p[0] - cu) * k, v = cv + (p[1] - cv) * k;
        const x = (u - v) * hw, y = (u + v) * hh - z;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.closePath();
    };
    const kz = function (z) { const q = z / (h || 1); return 1 - 0.38 * Math.pow(q, 1.6); };
    for (let z = 0; z <= h; z += 1.2) {
      const tt = z / (h || 1);
      g.fillStyle = sh(col, -0.55 + tt * 0.45);
      ring(z, kz(z)); g.fill();
    }
    const tg = g.createLinearGradient(-rad * hw, -h - rad * hh, rad * hw * 0.6, -h + rad * hh);
    tg.addColorStop(0, sh(col, 0.28)); tg.addColorStop(1, sh(col, -0.05));
    g.fillStyle = tg; ring(h + 0.5, kz(h) * 0.92); g.fill();
    return pts;
  };

  /* ---------- Диорамы локаций (для карты мира и брифинга) ---------- */
  ART.landmark = function (type, opt) {
    opt = opt || {};
    const key = 'l|' + type + '|' + (opt.key || '');
    if (cache[key]) return cache[key];
    const S = 2, W = 128, H = 104;
    const c = ART.canvas(W * S, H * S);
    const g = c.getContext('2d');
    g.scale(S, S);
    g.translate(64, 70);
    const o = { hw: 26, hh: 13 };
    const r = U.srng(ART.hashStr(type + (opt.key || '')));
    // плита основания
    const P = function (u, v, h) { return ART.P(u, v, h, o.hw, o.hh); };
    const base = { landing: '#4b4642', ruins: '#5f4d39', vein: '#3e3a3a', camp: '#6e5b44', lair: '#3e352d', site: '#5f4d39', vault: '#4a4f52', nest: '#4b3034', base: '#5f5340' }[type] || '#5a5040';
    ART.box(g, -1, -1, 1, 1, -9, 0, base, sh(base, -0.35), sh(base, -0.5), o);
    g.save(); ART.faceT(g, -1, -1, 0, o);
    for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,240,210,0.08)'; g.fillRect(r() * 2, r() * 2, 0.05, 0.05); }
    g.restore();
    let i, gr;
    switch (type) {
      case 'landing': {
        ART.box(g, -0.45, -0.25, 0.45, 0.25, 0, 5, '#6a7078', '#4a5058', '#3a4048', o);
        const gl = 'rgba(140,240,255,0.55)';
        gr = g.createRadialGradient(0, -24, 2, 0, -24, 26); gr.addColorStop(0, gl); gr.addColorStop(1, 'rgba(95,212,230,0)');
        g.fillStyle = gr; circ(g, 0, -24, 26);
        g.strokeStyle = '#2a3238'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, -24, 13, 20, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#9fefff'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(0, -24, 13, 20, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(160,240,255,0.35)'; g.beginPath(); g.ellipse(0, -24, 9, 16, 0, 0, Math.PI * 2); g.fill();
        ART.box(g, 0.5, 0.3, 0.8, 0.6, 0, 7, '#9a7444', '#76552f', '#5e4424', o);
        ART.box(g, -0.8, 0.4, -0.5, 0.7, 0, 6, '#9a7444', '#76552f', '#5e4424', o);
        break;
      }
      case 'ruins':
        [[-0.7, -0.6, -0.1, 0, 30], [0.1, -0.7, 0.7, -0.2, 22], [-0.3, 0.2, 0.3, 0.7, 16]].forEach(function (b, k) {
          ART.box(g, b[0], b[1], b[2], b[3], 0, b[4], '#8a7f72', '#6e6052', '#564a3e', o);
          g.save(); ART.faceL(g, b[0], b[3], 0, o);
          g.fillStyle = '#1e1814';
          for (let w = 0; w < 3; w++) for (let hgt = 6; hgt < b[4] - 4; hgt += 9) if (r() < 0.7) g.fillRect(0.06 + w * 0.18, hgt, 0.09, 5);
          g.restore();
          g.fillStyle = '#5a4a3e'; poly(g, [P(b[0], b[1], b[4]), P(b[0] + 0.2, b[1], b[4] + 6 + k * 2), P(b[0] + 0.35, b[1], b[4])]);
        });
        for (i = 0; i < 5; i++) ART.blob(g, -0.8 + r() * 1.6, 0.4 + r() * 0.5, 0.12, 3, '#77706a', 10 + i, o);
        break;
      case 'vein':
        ART.blob(g, -0.4, -0.3, 0.45, 10, '#5a5452', 3, o);
        ART.blob(g, 0.5, 0.2, 0.35, 8, '#5a5452', 4, o);
        [[-0.2, 0, 30, 0.2], [0.1, -0.2, 22, -0.3], [0.3, 0.3, 18, 0.4], [-0.5, 0.4, 14, -0.2], [0.6, -0.4, 16, 0.1]].forEach(function (cr) {
          const p = P(cr[0], cr[1], 0);
          gr = g.createRadialGradient(p[0], p[1] - cr[2] * 0.5, 1, p[0], p[1] - cr[2] * 0.5, cr[2]);
          gr.addColorStop(0, 'rgba(120,230,250,0.45)'); gr.addColorStop(1, 'rgba(95,212,230,0)');
          g.fillStyle = gr; circ(g, p[0], p[1] - cr[2] * 0.5, cr[2]);
          g.save(); g.translate(p[0], p[1]); g.rotate(cr[3]);
          poly(g, [[-4, 0], [-3, -cr[2] * 0.8], [0, -cr[2]], [3, -cr[2] * 0.8], [4, 0]], '#5fd4e6');
          poly(g, [[0, 0], [0, -cr[2]], [3, -cr[2] * 0.8], [4, 0]], '#2a8a9a');
          poly(g, [[-3, -cr[2] * 0.8], [0, -cr[2]], [-1, -cr[2] * 0.5]], 'rgba(255,255,255,0.7)');
          g.restore();
        });
        break;
      case 'camp': {
        const tent = function (u, v, col) {
          const a = P(u - 0.25, v + 0.2, 0), b = P(u + 0.25, v + 0.2, 0), t1 = P(u - 0.25, v, 16), t2 = P(u + 0.25, v, 16), c1 = P(u + 0.25, v - 0.2, 0);
          poly(g, [t1, t2, c1, P(u - 0.25, v - 0.2, 0)], sh(col, -0.2));
          poly(g, [a, b, t2, t1], col);
          poly(g, [b, c1, t2], sh(col, -0.4));
        };
        tent(-0.45, -0.35, '#7a7650'); tent(0.4, -0.45, '#6d6a48'); tent(-0.2, 0.45, '#7a6a4a');
        const f = P(0.15, 0.1, 0);
        g.fillStyle = '#3a2a1a'; ell(g, f[0], f[1], 6, 3);
        gr = g.createRadialGradient(f[0], f[1] - 5, 1, f[0], f[1] - 5, 12); gr.addColorStop(0, 'rgba(255,170,60,0.8)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
        g.fillStyle = gr; circ(g, f[0], f[1] - 5, 12);
        poly(g, [[f[0] - 3, f[1]], [f[0], f[1] - 10], [f[0] + 3, f[1]]], '#ffb347');
        const fp = P(0.75, 0.6, 0);
        line(g, fp[0], fp[1], fp[0], fp[1] - 34, 1.6, '#3a2a1a');
        poly(g, [[fp[0], fp[1] - 34], [fp[0] + 14, fp[1] - 30], [fp[0], fp[1] - 25]], '#a02a22');
        circ(g, fp[0] + 5, fp[1] - 30, 0);
        for (i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const p = P(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0); g.fillStyle = '#a89468'; ell(g, p[0], p[1] - 2, 5, 3); }
        break;
      }
      case 'lair':
        ART.blob(g, 0, -0.1, 0.8, 26, '#4e463e', 21, o);
        g.fillStyle = '#0e0a08'; g.beginPath(); g.ellipse(4, -8, 13, 10, 0.2, Math.PI, 0); g.lineTo(17, -6); g.lineTo(-9, -6); g.fill();
        gr = g.createRadialGradient(4, -10, 1, 4, -10, 16); gr.addColorStop(0, 'rgba(140,200,40,0.5)'); gr.addColorStop(1, 'rgba(140,200,40,0)');
        g.fillStyle = gr; circ(g, 4, -10, 16);
        g.fillStyle = '#ff3a2a'; circ(g, 0, -12, 1.2); circ(g, 4, -12.5, 1.2);
        for (i = 0; i < 6; i++) { const p = P(-0.8 + r() * 1.6, 0.5 + r() * 0.4, 0); line(g, p[0] - 4, p[1], p[0] + 4, p[1] - 2, 1.6, '#e8dcc8'); }
        break;
      case 'site':
        [[-0.8, -0.8, 0.8, -0.6], [-0.8, -0.6, -0.6, 0.8], [-0.6, 0.6, 0.8, 0.8], [0.6, -0.6, 0.8, 0.6]].forEach(function (w) {
          ART.box(g, w[0], w[1], w[2], w[3], 0, 14, '#8a8478', '#6e685e', '#57524a', o);
        });
        ART.box(g, 0.3, -0.7, 0.75, -0.25, 0, 32, '#8a8478', '#6e685e', '#57524a', o);
        for (i = 0; i < 3; i++) ART.box(g, 0.3 + i * 0.16, -0.7, 0.38 + i * 0.16, -0.62, 32, 37, '#9a9488', '#6e685e', '#57524a', o);
        break;
      case 'vault':
        ART.box(g, -0.7, -0.6, 0.7, 0.4, 0, 12, '#6b767e', '#4a545b', '#3a4248', o);
        g.fillStyle = '#5a646b'; const tp = P(0, -0.1, 12); ell(g, tp[0], tp[1], 26, 12);
        gr = g.createRadialGradient(tp[0] - 6, tp[1] - 6, 2, tp[0], tp[1], 26); gr.addColorStop(0, '#8a969e'); gr.addColorStop(1, '#3a4248');
        g.fillStyle = gr; g.beginPath(); g.ellipse(tp[0], tp[1], 24, 22, 0, Math.PI, 0); g.fill();
        const dp = P(0, 0.4, 0);
        g.fillStyle = '#2a3034'; g.fillRect(dp[0] - 9, dp[1] - 14, 14, 12);
        g.strokeStyle = '#e3a33b'; g.lineWidth = 1.5; g.strokeRect(dp[0] - 9, dp[1] - 14, 14, 12);
        line(g, tp[0] + 10, tp[1] - 18, tp[0] + 10, tp[1] - 36, 1.4, '#55606a');
        g.fillStyle = '#6fd8ff'; circ(g, tp[0] + 10, tp[1] - 37, 2);
        break;
      case 'nest': {
        gr = g.createLinearGradient(0, -70, 0, 0); gr.addColorStop(0, '#9a4a76'); gr.addColorStop(1, '#3a1428');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-14, -30, -6, -66); g.quadraticCurveTo(0, -74, 6, -66); g.quadraticCurveTo(14, -30, 26, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,120,170,0.4)'; g.lineWidth = 1.4;
        for (i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-20 + i * 8, 0); g.quadraticCurveTo(-4 + i * 2, -30, 0, -62); g.stroke(); }
        for (i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; line(g, 0, -4, Math.cos(a) * 44, Math.sin(a) * 18, 3, '#4a2238'); }
        gr = g.createRadialGradient(0, -40, 2, 0, -40, 18); gr.addColorStop(0, 'rgba(255,60,110,0.7)'); gr.addColorStop(1, 'rgba(255,60,110,0)');
        g.fillStyle = gr; circ(g, 0, -40, 18);
        break;
      }
      case 'base': {
        const b = opt.b || {};
        const wc = b.walls >= 2 ? ['#8a8478', '#6e685e', '#57524a'] : ['#8a6a46', '#6a4c2e', '#563c22'];
        const wh = b.walls ? (b.walls >= 2 ? 12 : 9) : 0;
        if (wh) [[-0.85, -0.85, 0.85, -0.7], [-0.85, -0.7, -0.7, 0.85], [-0.7, 0.7, 0.85, 0.85], [0.7, -0.7, 0.85, 0.7]].forEach(function (w) { ART.box(g, w[0], w[1], w[2], w[3], 0, wh, wc[0], wc[1], wc[2], o); });
        ART.box(g, -0.5, -0.5, 0.05, 0.05, 0, 20, '#7a6a55', '#5e4c3a', '#4a3a2c', o);
        ART.box(g, 0.15, -0.55, 0.55, -0.15, 0, 14, '#7a6a55', '#5e4c3a', '#4a3a2c', o);
        if (b.farm) { ART.box(g, -0.55, 0.2, -0.1, 0.55, 0, 9, 'rgba(160,220,180,0.7)', 'rgba(120,180,140,0.6)', 'rgba(90,150,110,0.6)', o); }
        if (b.tower) { ART.box(g, 0.45, 0.3, 0.6, 0.45, 0, 34, '#6a4c2e', '#563c22', '#46301a', o); ART.box(g, 0.35, 0.2, 0.7, 0.55, 34, 38, '#8a6a46', '#6a4c2e', '#563c22', o); }
        if (b.beacon) { const p = P(-0.2, -0.2, 20); line(g, p[0], p[1], p[0], p[1] - 22, 1.5, '#55606a'); g.fillStyle = '#6fd8ff'; circ(g, p[0], p[1] - 23, 2.4); }
        const fp = P(0.1, 0.25, 0);
        line(g, fp[0], fp[1], fp[0], fp[1] - 40, 1.6, '#3a2a1a');
        poly(g, [[fp[0], fp[1] - 40], [fp[0] + 15, fp[1] - 36], [fp[0], fp[1] - 31]], '#e3a33b');
        break;
      }
      default: break;
    }
    cache[key] = c;
    return c;
  };
  ART.landmarkURL = function (type, opt) {
    const key = 'lu|' + type + '|' + ((opt && opt.key) || '');
    if (!cache[key]) cache[key] = ART.landmark(type, opt).toDataURL('image/png');
    return cache[key];
  };

  /* ---------- Постройки базы ---------- */
  ART.buildingIcon = function (id) {
    const key = 'b|' + id;
    if (cache[key]) return cache[key];
    const S = 2, W = 96, H = 80;
    const c = ART.canvas(W * S, H * S);
    const g = c.getContext('2d');
    g.scale(S, S); g.translate(48, 56);
    const o = { hw: 20, hh: 10 };
    const P = function (u, v, h) { return ART.P(u, v, h, o.hw, o.hh); };
    ART.box(g, -1, -1, 1, 1, -6, 0, '#5f4d39', '#3e3226', '#30261c', o);
    let gr;
    switch (id) {
      case 'walls':
        for (let i = 0; i < 9; i++) {
          const p = P(-0.9 + i * 0.22, 0.1, 0);
          gr = g.createLinearGradient(p[0] - 3, 0, p[0] + 3, 0); gr.addColorStop(0, '#9a7a52'); gr.addColorStop(1, '#5a3c22');
          g.fillStyle = gr; g.fillRect(p[0] - 3, p[1] - 26 - (i % 2) * 3, 6, 26 + (i % 2) * 3);
          poly(g, [[p[0] - 3, p[1] - 26 - (i % 2) * 3], [p[0], p[1] - 32 - (i % 2) * 3], [p[0] + 3, p[1] - 26 - (i % 2) * 3]], '#8a6a46');
        }
        break;
      case 'tower':
        [[-0.5, -0.5], [0.3, -0.5], [-0.5, 0.3], [0.3, 0.3]].forEach(function (l) { ART.box(g, l[0], l[1], l[0] + 0.15, l[1] + 0.15, 0, 40, '#6a4c2e', '#563c22', '#46301a', o); });
        ART.box(g, -0.65, -0.65, 0.6, 0.6, 40, 44, '#8a6a46', '#6a4c2e', '#563c22', o);
        ART.box(g, -0.65, 0.45, 0.6, 0.6, 44, 52, '#7a5a38', '#6a4c2e', '#563c22', o);
        poly(g, [P(-0.7, -0.7, 60), P(0.65, -0.7, 60), P(0.65, 0.65, 60), P(-0.7, 0.65, 60)], '#5a3c22');
        poly(g, [P(-0.7, 0.65, 60), P(0.65, 0.65, 60), P(0, 0, 72)], '#7a5a38');
        poly(g, [P(0.65, -0.7, 60), P(0.65, 0.65, 60), P(0, 0, 72)], '#5a3c22');
        break;
      case 'infirmary':
        ART.box(g, -0.7, -0.5, 0.7, 0.5, 0, 22, '#d8d0c0', '#b8b0a0', '#988f80', o);
        g.save(); ART.faceL(g, -0.7, 0.5, 0, o);
        g.fillStyle = '#d9534f'; g.fillRect(0.55, 7, 0.3, 10); g.fillRect(0.45, 10, 0.5, 4);
        g.restore();
        break;
      case 'workshop':
        ART.box(g, -0.7, -0.6, 0.7, 0.5, 0, 24, '#7a7e82', '#5a5e62', '#46494c', o);
        g.save(); ART.faceL(g, -0.7, 0.5, 0, o); g.fillStyle = '#2a2420'; g.fillRect(0.3, 0, 0.6, 16); g.fillStyle = 'rgba(255,170,60,0.5)'; g.fillRect(0.35, 0, 0.5, 6); g.restore();
        { const p = P(0.5, -0.4, 24); g.fillStyle = '#4a4e52'; g.fillRect(p[0] - 3, p[1] - 14, 6, 14); g.fillStyle = 'rgba(160,160,160,0.4)'; circ(g, p[0] + 2, p[1] - 20, 5); circ(g, p[0] + 6, p[1] - 28, 7); }
        break;
      case 'farm':
        ART.box(g, -0.75, -0.55, 0.75, 0.55, 0, 16, 'rgba(170,230,190,0.75)', 'rgba(130,190,150,0.7)', 'rgba(100,160,120,0.7)', o);
        for (let i = 0; i < 5; i++) { const p = P(-0.6 + i * 0.3, 0.3, 0); g.fillStyle = '#4a8a3a'; ell(g, p[0], p[1] - 5, 4, 5); }
        break;
      case 'beacon': {
        ART.box(g, -0.3, -0.3, 0.3, 0.3, 0, 8, '#6b767e', '#4a545b', '#3a4248', o);
        const p = P(0, 0, 8);
        line(g, p[0] - 8, p[1], p[0], p[1] - 46, 2, '#55606a'); line(g, p[0] + 8, p[1], p[0], p[1] - 46, 2, '#55606a');
        for (let k = 1; k < 5; k++) line(g, p[0] - 8 + k * 1.6, p[1] - k * 9, p[0] + 8 - k * 1.6, p[1] - k * 9, 1, '#55606a');
        gr = g.createRadialGradient(p[0], p[1] - 48, 1, p[0], p[1] - 48, 16); gr.addColorStop(0, 'rgba(160,240,255,1)'); gr.addColorStop(1, 'rgba(95,212,230,0)');
        g.fillStyle = gr; circ(g, p[0], p[1] - 48, 16);
        break;
      }
      case 'turret':
        ART.box(g, -0.5, -0.5, 0.5, 0.5, 0, 6, '#8a8478', '#6e685e', '#57524a', o);
        g.save(); g.translate(0, -6); g.scale(1.5, 1.5); ART.creature(g, 'turret', { dir: 1, aim: -0.2 }, 0); g.restore();
        break;
      default: break;
    }
    cache[key] = c.toDataURL('image/png');
    return cache[key];
  };
})(window.DW);
