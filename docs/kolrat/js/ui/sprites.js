/*
 * Анимированные фигурки для автобоя. Всё рисуется кодом на Canvas — без картинок.
 * Дизайны оригинальные и стилизованные (крупная голова, простые формы):
 * это не копии персонажей и техники из фильмов.
 *
 * Sprites.draw(ctx, type, x, y, cell, st)
 *   x, y — точка у ног фигурки (пиксели), cell — размер клетки,
 *   st = { t: время (с), facing: 1|-1, moving, aim (рад), recoil 0..1, melee 0..1,
 *          hit 0..1, dead 0..1 (падение), broken, side, rank, seed }
 * Рисуем в «дизайн-пространстве» 40×40 на клетку, ноги в (0,0), лицом вправо.
 */
(function (G) {
  'use strict';

  const S = {};
  const TAU = Math.PI * 2;

  // ---------- палитры ----------
  const SKIN = ['#f1c9a5', '#e0ac85', '#c68b62', '#a8704a', '#7d4f33', '#5c3a26'];
  const LOOKS = {
    trooper: { body: 'armor', armor: '#eef0f2', trim: '#2a2e35', head: 'helmet', weapon: 'rifle' },
    sand: { body: 'armor', armor: '#ebe3d2', trim: '#3a3226', head: 'helmet', cape: '#c8a46a', pad: '#d9822b', pack: true, packCol: '#a08860', dirt: true, weapon: 'rifle' },
    heavy: { body: 'armor', armor: '#e8eaec', trim: '#2a2e35', head: 'helmet', bulky: 1.25, pad: '#2a2e35', weapon: 'heavy' },
    sniper: { body: 'armor', armor: '#c3c8cc', trim: '#2a2e35', head: 'helmet', cape: '#5b6150', camo: true, weapon: 'sniper' },
    scout: { body: 'armor', armor: '#eef0f2', trim: '#2a2e35', head: 'helmet', visorLong: true, weapon: 'pistol', bike: '#e6e8ea' },
    medic: { body: 'armor', armor: '#eef0f2', trim: '#2a2e35', head: 'helmet', cross: true, weapon: 'pistol' },
    merc: { body: 'jacket', cloth: '#6c6a3c', trim: '#2b2a1a', head: 'cap', cap: '#4e5a33', pack: true, packCol: '#55502e', weapon: 'rifle' },
    droid: { body: 'droid', metal: '#454b54', trim: '#1c1f24', head: 'droid', eye: '#ff5a4a', weapon: 'rifle', tall: 1.12 },
    tusken: { body: 'robe', cloth: '#cdb48a', band: '#8b6f47', head: 'wrap', weapon: 'staff', glove: '#8b6f47' },
    tusken_rifle: { body: 'robe', cloth: '#bea47a', band: '#6e5536', head: 'wrap', weapon: 'longrifle', glove: '#6e5536' },
    tusken_chief: { body: 'robe', cloth: '#d9bf93', band: '#9c2f24', head: 'wrap', horn: true, weapon: 'staff', scale: 1.15, glove: '#8b6f47' },
    jawa: { body: 'robe', cloth: '#6b4a2b', band: '#4a3220', head: 'hood', weapon: 'ion', scale: 0.72, glove: '#3a2a1a' },
    bandit: { body: 'jacket', cloth: '#6b3b2a', trim: '#2a1610', head: 'bare', bandana: '#c0392b', weapon: 'pistol' },
    swoop: { body: 'jacket', cloth: '#7a2f22', trim: '#2a1610', head: 'goggles', weapon: 'pistol', bike: '#c4432f' },
    bandit_boss: { body: 'coat', cloth: '#3b2a24', trim: '#1a100c', head: 'horns', weapon: 'rifle', scale: 1.12 },
    rebel: { body: 'vest', cloth: '#6f7a4a', shirt: '#c9b48a', trim: '#2f3420', head: 'rhelmet', weapon: 'rifle' },
    rebel_heavy: { body: 'vest', cloth: '#5f6a3e', shirt: '#b8a27a', trim: '#2f3420', head: 'rhelmet', bulky: 1.2, weapon: 'heavy' },
    rebel_officer: { body: 'vest', cloth: '#7d6a48', shirt: '#d8c6a0', trim: '#2f3420', head: 'beret', sash: '#c0392b', weapon: 'pistol' },
    smuggler: { body: 'vest', cloth: '#22252b', shirt: '#e9e4d8', trim: '#111', head: 'bare', weapon: 'pistol' },
    gamorrean: { body: 'brute', skin: '#7e9a4e', cloth: '#5a3d26', trim: '#2a1b10', head: 'pig', weapon: 'axe', scale: 1.28 },
    hutt_guard: { body: 'armor', armor: '#7a54b0', trim: '#2a1a3c', head: 'slit', weapon: 'rifle' },
    bounty_hunter: { body: 'coat', cloth: '#4e4438', trim: '#1e1914', head: 'hunter', helm: '#7d8a8f', weapon: 'rifle' },
    assassin_droid: { body: 'droid', metal: '#2b2e33', trim: '#0e0f11', head: 'probe', eye: '#ff3b2f', weapon: 'rifle', tall: 1.22 },
    scavenger: { body: 'jacket', cloth: '#8a6d45', trim: '#3d2e1c', head: 'goggles', mask: '#a8916a', pack: true, packCol: '#6d737b', weapon: 'pistol' },
    scav_droid: { body: 'droid', metal: '#8a5a33', trim: '#3b2414', head: 'droid', eye: '#ffc04a', weapon: 'rifle', scale: 0.95 },
    scav_boss: { body: 'coat', cloth: '#6b5236', trim: '#2b1f12', head: 'goggles', mask: '#7a2e22', weapon: 'heavy', scale: 1.12 },
    deserter: { body: 'armor', armor: '#9ea4aa', trim: '#33363b', head: 'helmet', pad: '#b03028', dirt: true, weapon: 'rifle' },
    deserter_heavy: { body: 'armor', armor: '#949aa0', trim: '#33363b', head: 'helmet', pad: '#b03028', bulky: 1.25, weapon: 'heavy' },
    deserter_captain: { body: 'armor', armor: '#aab0b6', trim: '#33363b', head: 'helmet', pad: '#b03028', cape: '#7a2620', weapon: 'pistol', scale: 1.08 },
    farmer: { body: 'vest', cloth: '#cdbb94', shirt: '#efe6d0', trim: '#6b5a3c', head: 'hat', hat: '#8a6d45', pants: '#6b5a3c', weapon: 'longrifle' },
  };
  S.LOOKS = LOOKS;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; return (n >>> 0) / 4294967296; }

  // ================= ОРУЖИЕ =================
  // Рисуется в системе рук: начало — рукоять (ближняя кисть), ось +X — ствол
  function weapon(ctx, kind, st, side) {
    const flash = st.recoil > 0.55;
    ctx.translate(-st.recoil * 2.2, 0);
    ctx.lineCap = 'round';
    const D = '#1f2227', M = '#3a3f47', HL = 'rgba(255,255,255,0.22)';
    let tip = 0;
    switch (kind) {
      case 'pistol':
        ctx.fillStyle = D; rr(ctx, -1.5, -1.8, 9.5, 3.4, 1.2); ctx.fill();
        ctx.fillStyle = M; ctx.fillRect(-1, 0.4, 2.6, 4.2);
        ctx.fillStyle = HL; ctx.fillRect(0, -1.6, 7, 0.7);
        ctx.fillStyle = D; ctx.fillRect(7.5, -1.1, 2, 2.2);
        tip = 9.5; break;
      case 'heavy':
        ctx.fillStyle = D; rr(ctx, -6, -3.2, 21, 6.4, 1.6); ctx.fill();
        ctx.fillStyle = M; circle(ctx, 3, 3.4, 3.4); ctx.fill();
        ctx.fillStyle = HL; ctx.fillRect(-4, -2.8, 17, 1);
        ctx.fillStyle = D; ctx.fillRect(15, -1.8, 6, 3.6); ctx.fillStyle = M; ctx.fillRect(17, -2.4, 1.4, 4.8);
        ctx.strokeStyle = M; ctx.lineWidth = 1; line(ctx, -6, 2.6, -8, 6);
        tip = 21; break;
      case 'sniper':
        ctx.fillStyle = M; rr(ctx, -7, -1.2, 7, 3.4, 1); ctx.fill();
        ctx.fillStyle = D; rr(ctx, -1, -1.6, 13, 3.2, 1); ctx.fill(); ctx.fillRect(11, -0.8, 13, 1.6);
        ctx.fillStyle = D; rr(ctx, 1, -5.4, 9, 2.6, 1); ctx.fill();
        ctx.fillStyle = 'rgba(140,200,255,0.7)'; ctx.fillRect(9.4, -5, 0.8, 1.8);
        ctx.fillStyle = HL; ctx.fillRect(0, -1.4, 11, 0.6);
        tip = 24; break;
      case 'longrifle':
        ctx.fillStyle = '#5a4630'; rr(ctx, -7, -1.6, 13, 3.4, 1.2); ctx.fill();
        ctx.fillStyle = '#3e3022'; ctx.fillRect(-7, 0.6, 5, 2.4);
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(5, -1.1, 19, 2.2);
        ctx.fillStyle = '#8a8f96'; ctx.fillRect(9, -1.6, 1.2, 3.2); ctx.fillRect(16, -1.6, 1.2, 3.2);
        tip = 24; break;
      case 'staff':
        ctx.strokeStyle = '#5a4329'; ctx.lineWidth = 2.4; line(ctx, -12, 0, 18, 0);
        ctx.strokeStyle = '#8b6f47'; ctx.lineWidth = 0.8; line(ctx, -12, -0.6, 18, -0.6);
        ctx.fillStyle = '#9aa1a8';
        ctx.beginPath(); ctx.moveTo(18, -4); ctx.quadraticCurveTo(24, -3, 26, 0); ctx.quadraticCurveTo(24, 3, 18, 4); ctx.lineTo(20, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-12, -2.6); ctx.lineTo(-16, 0); ctx.lineTo(-12, 2.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6e5536'; ctx.fillRect(-2, -1.6, 4, 3.2);
        tip = 26; break;
      case 'axe':
        ctx.strokeStyle = '#5a3d26'; ctx.lineWidth = 2.8; line(ctx, -5, 0, 17, 0);
        ctx.fillStyle = '#a7adb3'; ctx.strokeStyle = '#4b5056'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(12, -1); ctx.quadraticCurveTo(18, -11, 24, -8); ctx.quadraticCurveTo(21, -3, 20, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
        tip = 21; break;
      case 'ion':
        ctx.fillStyle = '#3a2c1c'; rr(ctx, -3, -1.8, 12, 3.6, 1); ctx.fill();
        ctx.fillStyle = '#5c4630'; ctx.fillRect(2, -3, 4, 1.4);
        ctx.fillStyle = '#7cc0ff'; circle(ctx, 9.5, 0, 2); ctx.fill();
        tip = 11; break;
      default: // rifle — бластерная винтовка
        ctx.fillStyle = M; rr(ctx, -6, -1, 6, 3, 1); ctx.fill();
        ctx.fillStyle = D; rr(ctx, -1, -2, 13, 4, 1.2); ctx.fill();
        ctx.fillRect(11, -1, 5, 2);
        ctx.fillStyle = M; ctx.fillRect(1, 1.6, 2.4, 3.6);
        ctx.fillStyle = D; rr(ctx, 2, -4.2, 6, 2.2, 0.8); ctx.fill();
        ctx.fillStyle = HL; ctx.fillRect(0, -1.8, 11, 0.7);
        for (let k = 0; k < 3; k++) { ctx.fillStyle = M; ctx.fillRect(5 + k * 2, -0.3, 1, 1.6); }
        tip = 16;
    }
    if (flash && kind !== 'staff' && kind !== 'axe') {
      const col = side === 0 ? '255,90,70' : kind === 'ion' ? '124,192,255' : '255,230,140';
      ctx.fillStyle = 'rgba(' + col + ',0.95)';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 1.6 : 4.4; ctx.lineTo(tip + 2 + Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      circle(ctx, tip + 1.6, 0, 1.4); ctx.fill();
    }
  }

  // ================= ГОЛОВЫ =================
  function head(ctx, L, st) {
    const hx = 1, hy = -41;
    ctx.lineWidth = 1.2;
    switch (L.head) {
      case 'helmet': {
        // Шлем: купол, козырёк, тёмный визор, выступающая челюсть с фильтром (оригинальный стилизованный дизайн)
        const col = L.armor, dark = L.trim;
        ctx.fillStyle = col; ctx.strokeStyle = dark; ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(hx - 7.6, hy + 2);
        ctx.quadraticCurveTo(hx - 8.6, hy - 9.2, hx + 0.4, hy - 9.2);
        ctx.quadraticCurveTo(hx + 8.6, hy - 8.8, hx + 8.2, hy + 0.6);
        ctx.lineTo(hx + 8, hy + 6.2);
        ctx.quadraticCurveTo(hx + 3.4, hy + 9.4, hx - 1.2, hy + 8.2);
        ctx.lineTo(hx - 6.8, hy + 6.2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.beginPath(); ctx.moveTo(hx - 7.6, hy + 2); ctx.quadraticCurveTo(hx - 8.6, hy - 9.2, hx - 1.5, hy - 9); ctx.quadraticCurveTo(hx - 5.2, hy - 2, hx - 3.8, hy + 7.4); ctx.lineTo(hx - 6.8, hy + 6.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(hx + 2.4, hy - 6.4, 3.2, 1.2, -0.25, 0, TAU); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(hx - 2.5, hy - 3.6); ctx.quadraticCurveTo(hx + 3, hy - 4.6, hx + 8.5, hy - 3.2); ctx.stroke();
        ctx.fillStyle = '#14181d'; rr(ctx, hx - 0.4, hy - 2.8, L.visorLong ? 9.6 : 8.8, 3.8, 1.6); ctx.fill();
        ctx.fillStyle = 'rgba(140,190,255,0.5)'; ctx.fillRect(hx + 3.8, hy - 2, 3.2, 1);
        ctx.fillStyle = dark; rr(ctx, hx + 3.4, hy + 2.8, 4, 3.2, 1.1); ctx.fill();
        ctx.strokeStyle = 'rgba(210,214,220,0.85)'; ctx.lineWidth = 0.5;
        for (let k = 0; k < 3; k++) line(ctx, hx + 4.3 + k * 1.05, hy + 3.4, hx + 4.3 + k * 1.05, hy + 5.4);
        ctx.fillStyle = shade(col, -0.15); ctx.strokeStyle = dark; ctx.lineWidth = 0.8;
        circle(ctx, hx - 3.2, hy + 1.6, 2.1); ctx.fill(); ctx.stroke();
        if (L.stripe) { ctx.fillStyle = L.stripe; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6.5); ctx.quadraticCurveTo(hx, hy - 10.2, hx + 6, hy - 7.4); ctx.lineTo(hx + 5.6, hy - 6); ctx.quadraticCurveTo(hx, hy - 8.6, hx - 5.6, hy - 5.2); ctx.closePath(); ctx.fill(); }
        if (L.cape) { ctx.fillStyle = L.cape; ctx.beginPath(); ctx.moveTo(hx - 7.6, hy + 1); ctx.quadraticCurveTo(hx - 12.5, hy + 8, hx - 9.5, hy + 14); ctx.lineTo(hx - 4.5, hy + 8); ctx.closePath(); ctx.fill(); }
        break;
      }
      case 'droid':
        ctx.fillStyle = L.metal; ctx.strokeStyle = L.trim;
        rr(ctx, hx - 6, hy - 6, 12, 12, 2.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = L.eye; circle(ctx, hx + 2.5, hy - 1, 1.6); ctx.fill(); circle(ctx, hx + 5.5, hy - 1, 1.6); ctx.fill();
        ctx.strokeStyle = L.trim; line(ctx, hx - 2, hy - 6, hx - 2, hy - 10);
        break;
      case 'wrap':
        ctx.fillStyle = '#c9b183'; ctx.strokeStyle = '#6e5536';
        circle(ctx, hx, hy, 8.5); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(110,85,54,0.6)';
        for (let k = -2; k <= 2; k++) line(ctx, hx - 7, hy + k * 3, hx + 7, hy + k * 3 - 1.5);
        ctx.fillStyle = '#1a1612'; circle(ctx, hx + 3, hy - 2, 2.3); ctx.fill(); circle(ctx, hx + 7, hy - 2, 1.9); ctx.fill();
        ctx.fillStyle = '#8a8f96'; ctx.fillRect(hx + 3, hy + 3, 5, 2.4);
        if (L.horn) { ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.moveTo(hx - 3, hy - 7); ctx.lineTo(hx - 7, hy - 16); ctx.lineTo(hx, hy - 8); ctx.closePath(); ctx.fill(); }
        break;
      case 'hood':
        ctx.fillStyle = L.cloth; ctx.strokeStyle = L.band;
        ctx.beginPath(); ctx.moveTo(hx - 9, hy + 8); ctx.quadraticCurveTo(hx - 7, hy - 12, hx + 3, hy - 11); ctx.quadraticCurveTo(hx + 10, hy - 4, hx + 9, hy + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#120d08'; circle(ctx, hx + 2.5, hy + 1, 5.5); ctx.fill();
        ctx.fillStyle = '#ffd34d'; circle(ctx, hx + 1, hy + 0.5, 1.5); ctx.fill(); circle(ctx, hx + 5, hy + 0.5, 1.5); ctx.fill();
        break;
      case 'pig':
        ctx.fillStyle = L.skin; ctx.strokeStyle = '#3e4f22';
        circle(ctx, hx, hy, 9.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9fb86a'; rr(ctx, hx + 4, hy - 1, 7, 6, 2.5); ctx.fill();
        ctx.fillStyle = '#2b2b1a'; circle(ctx, hx + 7, hy + 2, 0.9); ctx.fill(); circle(ctx, hx + 9.5, hy + 2, 0.9); ctx.fill();
        circle(ctx, hx + 3, hy - 4, 1.2); ctx.fill();
        ctx.fillStyle = '#f2ead2'; ctx.beginPath(); ctx.moveTo(hx + 4, hy + 5); ctx.lineTo(hx + 6, hy + 1); ctx.lineTo(hx + 6.5, hy + 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L.skin; ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx - 9, hy - 12); ctx.lineTo(hx - 2, hy - 8); ctx.closePath(); ctx.fill();
        break;
      case 'hunter':
        // Гладкий шлем с узкой янтарной прорезью и боковой антенной (оригинальный дизайн)
        ctx.fillStyle = L.helm; ctx.strokeStyle = L.trim;
        ctx.beginPath(); ctx.arc(hx, hy, 8.8, Math.PI, 0); ctx.lineTo(hx + 8.8, hy + 7);
        ctx.quadraticCurveTo(hx, hy + 10, hx - 8.8, hy + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffb23d'; ctx.fillRect(hx - 1, hy - 2, 9, 2);
        ctx.strokeStyle = L.trim; line(ctx, hx - 6, hy - 5, hx - 8, hy - 15);
        ctx.fillStyle = '#ff5a4a'; circle(ctx, hx - 8, hy - 15, 1.3); ctx.fill();
        break;
      case 'probe':
        ctx.fillStyle = L.metal; ctx.strokeStyle = L.trim;
        rr(ctx, hx - 4.5, hy - 11, 9, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = L.eye; circle(ctx, hx + 2, hy - 4, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,60,40,0.25)'; circle(ctx, hx + 2, hy - 4, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; line(ctx, hx - 2, hy - 8, hx - 2, hy + 4);
        break;
      case 'slit':
        ctx.fillStyle = L.armor; ctx.strokeStyle = L.trim;
        rr(ctx, hx - 8, hy - 9, 16, 17, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffb23d'; ctx.fillRect(hx, hy - 2, 8, 1.8);
        break;
      default: {
        // Лица: bare, cap, rhelmet, beret, goggles, horns
        const skin = SKIN[Math.floor(hash(st.seed + 7) * SKIN.length)];
        ctx.fillStyle = skin; ctx.strokeStyle = 'rgba(40,25,15,0.6)';
        circle(ctx, hx, hy, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(hx, hy, 8, Math.PI * 0.6, Math.PI * 1.4); ctx.fill();
        ctx.fillStyle = shade(skin, -0.12); circle(ctx, hx - 2.4, hy + 0.8, 1.9); ctx.fill();
        ctx.fillStyle = shade(skin, 0.1); ctx.beginPath(); ctx.moveTo(hx + 7.6, hy - 0.5); ctx.lineTo(hx + 9.4, hy + 1.6); ctx.lineTo(hx + 7.4, hy + 2.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a1410'; circle(ctx, hx + 4.5, hy - 1.5, 1.2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(ctx, hx + 4.9, hy - 1.9, 0.4); ctx.fill();
        ctx.strokeStyle = 'rgba(40,25,15,0.55)'; ctx.lineWidth = 0.8; line(ctx, hx + 2.5, hy - 3.6, hx + 6.5, hy - 3.9);
        ctx.strokeStyle = 'rgba(60,30,20,0.7)'; ctx.lineWidth = 1; line(ctx, hx + 3.5, hy + 4.2, hx + 6.8, hy + 4);
        const hair = ['#1e1a17', '#4a3020', '#8a5a2b', '#c9a15a', '#6b6b6b'][Math.floor(hash(st.seed + 3) * 5)];
        if (L.head === 'bare' || L.head === 'goggles') {
          ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx - 1, hy - 2, 8.3, Math.PI, Math.PI * 1.95); ctx.closePath(); ctx.fill();
        }
        if (L.mask) { ctx.fillStyle = L.mask; rr(ctx, hx - 8, hy + 1, 16, 6.5, 2); ctx.fill(); }
        if (L.bandana) { ctx.fillStyle = L.bandana; ctx.fillRect(hx - 8, hy - 5, 16, 3); }
        if (L.head === 'goggles') { ctx.fillStyle = '#ffb23d'; rr(ctx, hx, hy - 4, 8, 3.4, 1.5); ctx.fill(); ctx.strokeStyle = '#222'; ctx.stroke(); }
        if (L.head === 'cap') { ctx.fillStyle = L.cap; ctx.beginPath(); ctx.arc(hx, hy - 2, 8.6, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.fillRect(hx + 2, hy - 3, 9, 2); }
        if (L.head === 'rhelmet') { ctx.fillStyle = '#5d6640'; ctx.strokeStyle = '#2f3420'; ctx.beginPath(); ctx.arc(hx, hy - 1, 9.2, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        if (L.head === 'hat') {
          ctx.fillStyle = L.hat || '#8a6d45'; ctx.strokeStyle = 'rgba(40,25,15,0.7)'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.ellipse(hx, hy - 4, 12, 2.4, -0.05, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(hx - 6, hy - 4.5); ctx.quadraticCurveTo(hx - 5, hy - 11, hx + 1, hy - 11); ctx.quadraticCurveTo(hx + 6.5, hy - 11, hx + 6.5, hy - 4.5); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(hx - 6, hy - 6.4, 12.5, 1.6);
        }
        if (L.head === 'beret') { ctx.fillStyle = '#7b2a22'; ctx.beginPath(); ctx.ellipse(hx - 1, hy - 7, 9, 3.5, -0.15, 0, TAU); ctx.fill(); }
        if (L.head === 'horns') {
          ctx.fillStyle = '#c84a32'; circle(ctx, hx, hy, 8); ctx.fill();
          ctx.fillStyle = '#1a1410'; circle(ctx, hx + 4.5, hy - 1.5, 1.2); ctx.fill();
          ctx.fillStyle = '#efe0c4';
          for (const [a, b] of [[-5, -6], [0, -8], [5, -6]]) { ctx.beginPath(); ctx.moveTo(hx + a - 1.5, hy + b + 2); ctx.lineTo(hx + a, hy + b - 4); ctx.lineTo(hx + a + 1.5, hy + b + 2); ctx.closePath(); ctx.fill(); }
        }
      }
    }
  }


  // ================= ГУМАНОИД: суставы, походка, светотень =================
  const THIGH = 9, SHIN = 9, UPPER = 7, FORE = 7;
  const LONG = { rifle: 8, sniper: 10, longrifle: 9, heavy: 9, ion: 6 };   // где лежит вторая рука (цевьё)

  // Два звена: от сустава к цели, сгиб в нужную сторону
  function ik(sx, sy, tx, ty, l1, l2, flip) {
    let dx = tx - sx, dy = ty - sy;
    let d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.05;
    if (d > max) { tx = sx + (dx / d) * max; ty = sy + (dy / d) * max; dx = tx - sx; dy = ty - sy; d = max; }
    d = Math.max(0.05, d);
    const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const ang = Math.atan2(dy, dx) + (flip ? a : -a);
    return [sx + Math.cos(ang) * l1, sy + Math.sin(ang) * l1, tx, ty];
  }

  // Конечность: контур, основа и (для брони) пластины поверх тёмного комбинезона
  function limb(ctx, x1, y1, j, w, col, out, plate) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = out; ctx.lineWidth = w + 1.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(j[0], j[1]); ctx.lineTo(j[2], j[3]); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(j[0], j[1]); ctx.lineTo(j[2], j[3]); ctx.stroke();
    if (plate) {
      ctx.strokeStyle = plate; ctx.lineWidth = w + 0.6;
      const seg = (ax, ay, bx, by) => { ctx.beginPath(); ctx.moveTo(ax + (bx - ax) * 0.18, ay + (by - ay) * 0.18); ctx.lineTo(ax + (bx - ax) * 0.78, ay + (by - ay) * 0.78); ctx.stroke(); };
      seg(x1, y1, j[0], j[1]); seg(j[0], j[1], j[2], j[3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.9;
      const hl = (ax, ay, bx, by) => { ctx.beginPath(); ctx.moveTo(ax + (bx - ax) * 0.25 + 1, ay + (by - ay) * 0.25 - 0.6); ctx.lineTo(ax + (bx - ax) * 0.7 + 1, ay + (by - ay) * 0.7 - 0.6); ctx.stroke(); };
      hl(x1, y1, j[0], j[1]); hl(j[0], j[1], j[2], j[3]);
    }
  }
  function boot(ctx, x, y, col, big) {
    ctx.fillStyle = col; rr(ctx, x - 2.4, y - 2.6, 6.6 * big, 3.4, 1.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - 1.6, y - 2.4, 4, 0.8);
  }
  function hand(ctx, x, y, col) { ctx.fillStyle = col; circle(ctx, x, y, 1.6); ctx.fill(); }

  function humanoid(ctx, L, st) {
    const dead = st.dead > 0;
    const moving = st.moving && !dead;
    const ph = st.t * 9 + (st.seed % 7);
    const bul = L.bulky || 1;
    const robe = L.body === 'robe';
    const armor = L.body === 'armor';
    const droid = L.body === 'droid';
    const brute = L.body === 'brute';
    const out = 'rgba(20,18,16,0.85)';
    const bodyCol = armor ? L.armor : droid ? L.metal : brute ? L.skin : L.cloth;
    const legCol = armor ? (L.under || '#1f2226') : droid ? L.metal : brute ? (L.pants || '#4a3a28') : (L.pants || shade(L.cloth, -0.4));
    const bootCol = L.boots || (droid ? '#1c1f24' : armor ? L.armor : '#2a241e');
    const glove = L.glove || (armor ? '#1f2226' : droid ? L.metal : brute ? L.skin : '#c99a74');
    const plate = armor ? L.armor : null;
    const bob = moving ? Math.abs(Math.sin(ph)) * 1.4 : dead ? 0 : Math.sin(st.t * 2.2 + st.seed) * 0.35;

    ctx.save();
    // вздрагивание от попадания
    if (st.hit > 0 && !dead) { ctx.translate(-1.5 * st.hit, 0); ctx.rotate(-0.12 * st.hit); }
    ctx.translate(0, -bob);
    // присел за укрытием или под огнём: бёдра ниже, колени согнуты, корпус опущен
    const crouch = !dead && !moving && !st.seated && !robe ? (st.crouch || 0) : 0;
    const drop = crouch * 6;
    const hipY = -18 + drop;
    const lw = (droid ? 2.8 : 4.4) * Math.min(1.25, bul);

    // ---- ноги ----
    const legs = [];
    for (const [side, off] of [[-1, Math.PI], [1, 0]]) {
      const hx = side * 1.6;
      let fx, fy;
      if (dead) { fx = hx + side * 1.2; fy = 0; }
      else if (st.seated) { fx = hx + 8; fy = hipY + 9; }
      else if (moving) { const s = Math.sin(ph + off); fx = hx + s * 6.5; fy = -Math.max(0, Math.cos(ph + off)) * 4; }
      else if (crouch) { fx = hx + (side > 0 ? 4.5 : -5.5); fy = 0; }
      else { fx = hx + side * 2.6; fy = 0; }
      legs.push({ hx: hx, fx: fx, fy: fy + bob, j: ik(hx, hipY, fx, fy + bob, THIGH, SHIN, false) });
    }
    const drawLeg = (g, far) => {
      const c = far ? shade(legCol, -0.25) : legCol;
      limb(ctx, g.hx, hipY, g.j, lw, c, out, plate ? (far ? shade(plate, -0.22) : plate) : null);
      if (armor && !far) { ctx.fillStyle = plate; circle(ctx, g.j[0], g.j[1], 1.9); ctx.fill(); }
      boot(ctx, g.j[2] - 0.6, g.j[3], far ? shade(bootCol, -0.25) : bootCol, droid ? 0.8 : 1);
    };

    // ---- руки и оружие: куда смотрят кисти ----
    const kind = L.weapon;
    const isLong = LONG[kind] != null;
    const aiming = !!st.aiming || st.recoil > 0;
    let ang = st.broken ? 0.95 : aiming ? Math.max(-0.9, Math.min(0.9, st.aim || 0)) : (isLong ? 0.38 : 0.6);
    let piv, nearHand, farHand;
    const shN = [2.5, -32], shF = [-1.2, -32.5];
    if (dead) {
      nearHand = [shN[0] - 1, -19]; farHand = [shF[0] - 1.5, -19];
    } else if (isLong) {
      piv = kind === 'heavy' ? [3.5, -24.5] : kind === 'ion' ? [4, -26] : [5, -29.5];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const at = (px, py) => [piv[0] + px * ca - py * sa, piv[1] + px * sa + py * ca];
      nearHand = at(0, 1.6); farHand = at(LONG[kind], 1.2);
    } else if (kind === 'pistol') {
      piv = [shN[0] + Math.cos(ang) * 12.5, shN[1] + Math.sin(ang) * 12.5];
      nearHand = piv;
      const sw = moving ? Math.sin(ph) * 2.5 : 0;
      farHand = [shF[0] - 1 + sw, -21];
    } else { // ближний бой: посох, топор
      if (st.melee > 0) ang = -1.6 + st.melee * 2.4;
      else ang = moving ? 0.5 : 0.25;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      piv = [shN[0] + 6 + ca * 2, shN[1] + 6 + sa * 2];
      nearHand = piv;
      farHand = kind === 'staff' ? [piv[0] - ca * 7, piv[1] - sa * 7] : [shF[0] - 1, -21];
    }

    // ---- порядок: задний план → передний ----
    ctx.save(); ctx.translate(0, drop);
    if (L.cape) { // плащ
      const sw = moving ? Math.sin(ph) * 2 : Math.sin(st.t * 1.5 + st.seed) * 0.8;
      ctx.fillStyle = shade(L.cape, -0.15); ctx.strokeStyle = out; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-5.5 * bul, -33); ctx.quadraticCurveTo(-9 - sw, -22, -8.5 - sw * 1.5, -8); ctx.lineTo(-2, -12); ctx.lineTo(1, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (L.pack) { ctx.fillStyle = L.packCol || '#7d6a4a'; ctx.strokeStyle = out; ctx.lineWidth = 1; rr(ctx, -7.5 * bul - 3.5, -33.5, 6, 13, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-7.5 * bul - 3.5, -27, 6, 1.2); }
    ctx.restore();

    if (!robe) drawLeg(legs[0], true);
    // дальняя рука — за туловищем
    const armW = droid ? 2.6 : 3.6 * Math.min(1.2, bul);
    const farJ = ik(shF[0], shF[1], farHand[0], farHand[1], UPPER, FORE, true);
    ctx.save(); ctx.translate(0, drop);
    limb(ctx, shF[0], shF[1], farJ, armW, shade(armor ? (L.under || '#1f2226') : bodyCol, -0.25), out, armor ? shade(plate, -0.25) : null);
    hand(ctx, farJ[2], farJ[3], shade(glove, -0.2));
    ctx.restore();
    if (!robe) drawLeg(legs[1], false);
    ctx.translate(0, drop); // всё, что выше пояса, — ниже на величину приседа

    // ---- туловище ----
    const W = (droid ? 11 : brute ? 17 : 13.5) * bul;
    const top = -34, waist = droid ? -20 : -19;
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(-W / 2, top + 1.5);
      ctx.quadraticCurveTo(0, top - 1.8, W / 2 + 0.8, top + 0.6);
      ctx.quadraticCurveTo(W / 2 + 1.6, (top + waist) / 2, W * 0.4 + 0.8, waist + 1);
      ctx.lineTo(-W * 0.4, waist + 1);
      ctx.quadraticCurveTo(-W / 2 - 0.8, (top + waist) / 2, -W / 2, top + 1.5);
      ctx.closePath();
    };
    if (robe) {
      // роба до земли, колышется на ходу
      const sw = moving ? Math.sin(ph) * 2.2 : Math.sin(st.t * 1.2 + st.seed) * 0.5;
      ctx.fillStyle = '#3e3022';
      if (moving) { ctx.fillRect(-4 + Math.sin(ph) * 3, -3.5, 4, 3.5); ctx.fillRect(1 - Math.sin(ph) * 3, -3.5, 4, 3.5); }
      else { ctx.fillRect(-4.5, -3, 4, 3); ctx.fillRect(1, -3, 4, 3); }
      ctx.fillStyle = L.cloth; ctx.strokeStyle = out; ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-6.5, -34); ctx.quadraticCurveTo(0, -36, 6.5, -34);
      ctx.quadraticCurveTo(8.5, -18, 10.5 + sw, -2.5);
      ctx.quadraticCurveTo(0, -0.5, -10.5 + sw, -2.5);
      ctx.quadraticCurveTo(-8.5, -18, -6.5, -34);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(-12, -36, 8, 36);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.8;
      for (const fxx of [-3, 2, 6]) { ctx.beginPath(); ctx.moveTo(fxx * 0.6, -26); ctx.quadraticCurveTo(fxx, -14, fxx + sw * 0.6, -2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(4, -34, 2, 30);
      ctx.restore();
      // пояс и перевязь
      ctx.strokeStyle = L.band; ctx.lineWidth = 2.2; line(ctx, -7.5, -20, 8, -21.5);
      if (L.bandolier !== false) {
        ctx.strokeStyle = shade(L.band, -0.2); ctx.lineWidth = 1.8; line(ctx, -5.5, -33, 6.5, -21);
        ctx.fillStyle = '#8a8f96'; for (let k = 0; k < 4; k++) ctx.fillRect(-4.4 + k * 2.8, -31.5 + k * 2.8, 1.4, 1.6);
      }
    } else {
      ctx.fillStyle = bodyCol; ctx.strokeStyle = out; ctx.lineWidth = 1.1;
      torso(); ctx.fill(); ctx.stroke();
      ctx.save(); torso(); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.17)'; ctx.fillRect(-W, top - 3, W * 0.62, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(W / 2 - 2.4, top, 2, 14);
      if (armor) {
        ctx.strokeStyle = 'rgba(30,34,40,0.55)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-W / 2 + 1.5, -29.5); ctx.quadraticCurveTo(0, -27.8, W / 2, -29.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-W * 0.32, -25.2); ctx.lineTo(W * 0.38, -25.6); ctx.moveTo(-W * 0.3, -22.8); ctx.lineTo(W * 0.36, -23); ctx.stroke();
        ctx.fillStyle = L.under || '#1f2226'; ctx.fillRect(-W / 2, -27.6, W + 2, 1.1);
        if (L.camo) { ctx.fillStyle = 'rgba(80,90,70,0.55)'; circle(ctx, -2, -30, 2.5); ctx.fill(); circle(ctx, 3, -24, 2); ctx.fill(); }
        if (L.cross) { ctx.fillStyle = '#c0392b'; ctx.fillRect(0.8, -32.5, 2.2, 7); ctx.fillRect(-1.6, -30.1, 7, 2.2); }
        if (L.dirt) { ctx.fillStyle = 'rgba(120,90,50,0.3)'; circle(ctx, -3, -22, 3); ctx.fill(); circle(ctx, 4, -31, 2); ctx.fill(); }
      } else if (droid) {
        ctx.strokeStyle = shade(L.metal, -0.4); ctx.lineWidth = 0.9;
        for (let k = 0; k < 4; k++) line(ctx, -W / 2 + 1, -31 + k * 2.6, W / 2, -31 + k * 2.6);
        ctx.fillStyle = L.eye; ctx.globalAlpha = 0.55; ctx.fillRect(1, -33, 2, 2); ctx.globalAlpha = 1;
      } else if (brute) {
        ctx.fillStyle = shade(L.skin, 0.15); ctx.beginPath(); ctx.ellipse(2, -24, 7, 6, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = L.cloth; ctx.lineWidth = 2.4; line(ctx, -W / 2, -33, W / 2, -22);
      } else {
        // куртка/жилет/плащ: рубашка в вороте, застёжка
        if (L.shirt) { ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.moveTo(-1, -34); ctx.lineTo(3.5, -34); ctx.lineTo(1.5, -27); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; line(ctx, 2, -27, 2.2, -20);
        if (L.body === 'vest') { ctx.fillStyle = shade(L.cloth, -0.15); ctx.fillRect(-3, -31, 2.6, 3); ctx.fillRect(3.6, -31, 2.6, 3); }
        if (L.sash) { ctx.strokeStyle = L.sash; ctx.lineWidth = 2.4; line(ctx, -W / 2 + 1, -33, W / 2 - 1, -21); }
        if (L.bandana && L.head !== 'bare') { /* — */ }
      }
      ctx.restore();
      // пояс с подсумками
      if (!droid) {
        const belt = armor ? (L.trim || '#2a2e35') : brute ? L.cloth : (L.belt || shade(L.cloth, -0.5));
        ctx.fillStyle = belt; ctx.fillRect(-W * 0.45, -21, W * 0.9 + 1, 2.8);
        ctx.fillStyle = armor ? '#b9bec5' : '#c9a15a'; ctx.fillRect(1.2, -21, 2.4, 2.8);
        ctx.fillStyle = shade(belt, 0.12); ctx.fillRect(-W * 0.4, -20.6, 2.4, 3.2); ctx.fillRect(W * 0.32, -20.6, 2.2, 3);
      }
      if (L.body === 'coat') { // полы плаща
        const sw = moving ? Math.sin(ph) * 1.6 : 0;
        ctx.fillStyle = shade(L.cloth, -0.1); ctx.strokeStyle = out; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-W * 0.45, -18.5); ctx.lineTo(-W * 0.55 - sw, -8); ctx.lineTo(-1, -10); ctx.lineTo(W * 0.45, -18.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }

    head(ctx, L, st);

    // ---- оружие и ближняя рука ----
    if (!dead) {
      ctx.save();
      ctx.translate(piv[0], piv[1]);
      ctx.rotate(ang);
      if (!isLong && kind !== 'pistol' && kind !== 'ion') ctx.translate(0, 0);
      weapon(ctx, kind, st, st.side);
      ctx.restore();
    }
    const nearJ = ik(shN[0], shN[1], nearHand[0], nearHand[1], UPPER, FORE, true);
    limb(ctx, shN[0], shN[1], nearJ, armW, armor ? (L.under || '#1f2226') : bodyCol, out, plate);
    hand(ctx, nearJ[2], nearJ[3], glove);
    // наплечник: у сержантов чёрный, у офицеров — красный
    const pad = L.pad || (st.side === 0 && armor ? (st.rank >= 4 ? '#b8322a' : st.rank >= 2 ? '#2a2e35' : null) : null);
    if (armor || pad || brute) {
      ctx.fillStyle = pad || (brute ? shade(L.cloth, 0.1) : plate); ctx.strokeStyle = out; ctx.lineWidth = 0.9;
      const a = Math.atan2(nearJ[1] - shN[1], nearJ[0] - shN[0]);
      ctx.beginPath(); ctx.ellipse(shN[0] - 0.6 + Math.cos(a) * 1.1, shN[1] - 0.4 + Math.sin(a) * 1.1, 3.2 * bul, 2.3, a, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(shN[0] - 0.4, shN[1] - 1.2, 1.8, 0.7, a, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function shade(hex, k) {
    if (hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  // Оружие, выпавшее из рук павшего
  S.dropped = function (ctx, type, x, y, cell, facing) {
    const L = LOOKS[type];
    if (!L || !L.weapon) return;
    const k = cell / 40;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k * (facing || 1), k);
    ctx.rotate(0.12);
    weapon(ctx, L.weapon, { recoil: 0 }, 0);
    ctx.restore();
  };

  // ================= ТЕХНИКА И ЧУДОВИЩА =================
  function bike(ctx, col, st) {
    const hover = Math.sin(st.t * 6 + st.seed) * 1.2;
    ctx.save();
    ctx.translate(0, -6 + hover);
    if (st.moving) { ctx.fillStyle = 'rgba(200,170,120,0.35)'; circle(ctx, -18, 6, 4); ctx.fill(); circle(ctx, -24, 5, 3); ctx.fill(); }
    ctx.fillStyle = col; ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(10, -4); ctx.lineTo(18, 0); ctx.lineTo(10, 3); ctx.lineTo(-14, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = 1.6; line(ctx, 10, -3, 22, -5); line(ctx, 10, 2, 22, 3);
    ctx.fillStyle = '#ffb23d'; circle(ctx, -14, 0.5, 1.6); ctx.fill();
    ctx.restore();
  }

  function walker(ctx, st) {
    const ph = st.t * 5 + st.seed;
    const sw = st.moving ? Math.sin(ph) : 0;
    const bob = st.moving ? Math.abs(Math.sin(ph)) * 2 : 0;
    ctx.save();
    ctx.lineCap = 'round';
    const leg = (s, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 3.4;
      const kx = 4 + s * 6, ky = -22;
      const fx = s * 9, fy = 0;
      line(ctx, 0, -38 + bob, kx, ky); line(ctx, kx, ky, fx, fy);
      ctx.fillStyle = '#3a3f46'; rr(ctx, fx - 5, fy - 3, 11, 3.5, 1); ctx.fill();
    };
    leg(-sw, '#7d838b');
    leg(sw, '#a3a9b1');
    ctx.translate(0, bob);
    ctx.fillStyle = '#c9ccd1'; ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-12, -54); ctx.lineTo(10, -56); ctx.lineTo(16, -47); ctx.lineTo(10, -38); ctx.lineTo(-12, -38); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1d2228'; ctx.fillRect(2, -51, 11, 3.4);
    ctx.save(); ctx.translate(8, -42); ctx.rotate(Math.max(-0.5, Math.min(0.5, st.aim || 0)));
    weapon(ctx, 'heavy', st, st.side); ctx.restore();
    ctx.restore();
  }

  function turret(ctx, st) {
    ctx.fillStyle = '#6d737b'; ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-10, -12); ctx.lineTo(10, -12); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9aa3ad'; circle(ctx, 0, -15, 7); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(2, -16); ctx.rotate(st.aim || 0);
    weapon(ctx, 'heavy', st, st.side); ctx.restore();
  }

  // Крайт-дракон: массивное змеевидное тело с гребнем, тяжёлая рогатая голова
  function krayt(ctx, st) {
    const ph = st.t * (st.moving ? 4 : 1.4) + st.seed;
    const lunge = st.melee > 0 ? Math.sin(st.melee * Math.PI) * 10 : 0;
    ctx.save();
    ctx.translate(14, 0);
    const segs = 7;
    // тело — от хвоста к шее
    for (let k = segs; k >= 1; k--) {
      const x = -k * 9;
      const r = 13 - k * 1.15;
      const y = -r - 1 + Math.sin(ph - k * 0.8) * 2.5;
      ctx.fillStyle = k % 2 ? '#b0975e' : '#c2a86c'; ctx.strokeStyle = '#4e3f22'; ctx.lineWidth = 1.3;
      circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,200,0.18)'; circle(ctx, x - r * 0.2, y + r * 0.35, r * 0.5); ctx.fill();
      ctx.fillStyle = '#eadfbf';
      ctx.beginPath(); ctx.moveTo(x - 3, y - r + 2); ctx.lineTo(x - 1, y - r - 6); ctx.lineTo(x + 3, y - r + 2); ctx.closePath(); ctx.fill();
    }
    // лапы
    ctx.strokeStyle = '#6f5c34'; ctx.lineWidth = 4;
    for (const lx of [-12, -40]) {
      const s = st.moving ? Math.sin(ph * 1.5 + lx) * 4 : 0;
      line(ctx, lx, -8, lx + 5 + s, 0);
      ctx.fillStyle = '#4e3f22'; circle(ctx, lx + 5 + s, 0, 2.2); ctx.fill();
    }
    // голова
    ctx.translate(6 + lunge, -16);
    ctx.fillStyle = '#c8ae72'; ctx.strokeStyle = '#4e3f22'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -11); ctx.quadraticCurveTo(8, -14, 22, -6); ctx.lineTo(26, -1);
    ctx.lineTo(22, 2); ctx.quadraticCurveTo(8, 6, -8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    const jaw = st.melee > 0 ? 7 : 1.5;
    ctx.fillStyle = '#5a1f14';
    ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(25, 0); ctx.lineTo(19, 2 + jaw); ctx.lineTo(4, 4 + jaw * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2ead2';
    for (let k = 0; k < 4; k++) { const x = 8 + k * 4; ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x + 1, 3); ctx.lineTo(x + 2, 1); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#ffd34d'; circle(ctx, 9, -5, 2.4); ctx.fill();
    ctx.fillStyle = '#1a1410'; ctx.fillRect(8.4, -7, 1.2, 4);
    ctx.fillStyle = '#eadfbf';
    ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(-14, -18, -18, -26); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(0, -21); ctx.lineTo(9, -12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ================= ГЛАВНАЯ ФУНКЦИЯ =================
  const SC = 1.12; // фигуры чуть крупнее клетки — лучше видно детали
  S.draw = function (ctx, type, x, y, cell, st) {
    const L = LOOKS[type];
    const k = cell / 40 * SC;
    ctx.save();
    ctx.translate(x, y);
    // тень и метка стороны
    const big = type === 'krayt' ? 2.2 : type === 'walker' ? 1.3 : (L && L.scale) || 1;
    if (st.night || st.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.36 * big, cell * 0.12 * big, 0, 0, TAU); ctx.fill();
    } else { // два солнца — две тени под разными углами
      ctx.fillStyle = 'rgba(40,20,0,0.2)';
      ctx.beginPath(); ctx.ellipse(cell * 0.16 * big, cell * 0.03, cell * 0.42 * big, cell * 0.11 * big, 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(40,20,0,0.14)';
      ctx.beginPath(); ctx.ellipse(cell * 0.1 * big, cell * 0.09, cell * 0.36 * big, cell * 0.1 * big, 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.24 * big, cell * 0.08 * big, 0, 0, TAU); ctx.fill();
    }
    if (!st.dead) {
      ctx.strokeStyle = st.side === 0 ? 'rgba(150,210,255,0.85)' : 'rgba(255,110,90,0.85)';
      ctx.lineWidth = Math.max(1, cell * 0.05);
      ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.33 * big, cell * 0.11 * big, 0, 0, TAU); ctx.stroke();
    }
    ctx.scale(k * (st.facing || 1), k);
    const human = L && type !== 'krayt' && type !== 'walker' && type !== 'turret';
    if (st.dead) {
      // оружие отлетает в сторону, фигура падает навзничь
      if (human && L.weapon && st.dead > 0.4) {
        ctx.save(); ctx.globalAlpha = Math.min(1, (st.dead - 0.4) * 2.5);
        ctx.translate(-14 - (st.seed % 5), -2); ctx.rotate(0.15 + (st.seed % 3) * 0.2);
        weapon(ctx, L.weapon, { recoil: 0 }, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 0.88;
      if (human) {
        ctx.translate(0, -2.5 * Math.min(1, st.dead));
        ctx.rotate(-Math.min(1, st.dead) * Math.PI / 2);
      } else if (type === 'krayt') { ctx.scale(1, 0.75); ctx.globalAlpha = 0.75; }
      else ctx.rotate(-Math.min(1, st.dead) * 0.35);
    }
    const sc = (L && L.scale) || 1;
    if (sc !== 1) ctx.scale(sc, sc);
    if (L && L.tall) ctx.scale(1, L.tall);
    if (type === 'krayt') krayt(ctx, st);
    else if (type === 'walker') walker(ctx, st);
    else if (type === 'turret') turret(ctx, st);
    else if (L) {
      if (L.bike) {
        bike(ctx, L.bike, st);
        ctx.translate(-2, -1 + Math.sin(st.t * 6 + st.seed) * 1.2);
        humanoid(ctx, L, Object.assign({}, st, { moving: false, seated: true }));
      } else humanoid(ctx, L, st);
    }
    // вспышка попадания
    if (st.hit > 0 && !st.dead) {
      ctx.globalAlpha = st.hit;
      ctx.fillStyle = '#fff6d0';
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU + st.seed;
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(Math.cos(a) * 8, -26 + Math.sin(a) * 8); ctx.lineTo(Math.cos(a + 0.3) * 3, -26 + Math.sin(a + 0.3) * 3); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  };

  // Высота фигурки над точкой ног (в клетках) — для полоски здоровья и линий выстрелов
  S.height = function (type) {
    if (type === 'krayt') return 0.75 * SC;
    if (type === 'walker') return 1.55 * SC;
    if (type === 'turret') return 0.65 * SC;
    const L = LOOKS[type] || {};
    return (1.25 * (L.scale || 1) * (L.tall || 1) + (L.bike ? 0.35 : 0)) * SC;
  };

  G.Sprites = S;
})(globalThis.G = globalThis.G || {});
