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
    sand: { body: 'armor', armor: '#ebe3d2', trim: '#3a3226', head: 'helmet', cape: '#c8a46a', pad: '#d9822b', pack: true, weapon: 'rifle' },
    heavy: { body: 'armor', armor: '#e8eaec', trim: '#2a2e35', head: 'helmet', bulky: 1.25, pad: '#2a2e35', weapon: 'heavy' },
    sniper: { body: 'armor', armor: '#c3c8cc', trim: '#2a2e35', head: 'helmet', cape: '#5b6150', camo: true, weapon: 'sniper' },
    scout: { body: 'armor', armor: '#eef0f2', trim: '#2a2e35', head: 'helmet', visorLong: true, weapon: 'pistol', bike: '#e6e8ea' },
    medic: { body: 'armor', armor: '#eef0f2', trim: '#2a2e35', head: 'helmet', cross: true, weapon: 'pistol' },
    merc: { body: 'jacket', cloth: '#6c6a3c', trim: '#2b2a1a', head: 'cap', cap: '#4e5a33', weapon: 'rifle' },
    droid: { body: 'droid', metal: '#454b54', trim: '#1c1f24', head: 'droid', eye: '#ff5a4a', weapon: 'rifle', tall: 1.12 },
    tusken: { body: 'robe', cloth: '#cdb48a', band: '#8b6f47', head: 'wrap', weapon: 'staff' },
    tusken_rifle: { body: 'robe', cloth: '#bea47a', band: '#6e5536', head: 'wrap', weapon: 'longrifle' },
    tusken_chief: { body: 'robe', cloth: '#d9bf93', band: '#9c2f24', head: 'wrap', horn: true, weapon: 'staff', scale: 1.15 },
    jawa: { body: 'robe', cloth: '#6b4a2b', band: '#4a3220', head: 'hood', weapon: 'ion', scale: 0.72 },
    bandit: { body: 'jacket', cloth: '#6b3b2a', trim: '#2a1610', head: 'bare', bandana: '#c0392b', weapon: 'pistol' },
    swoop: { body: 'jacket', cloth: '#7a2f22', trim: '#2a1610', head: 'goggles', weapon: 'pistol', bike: '#c4432f' },
    bandit_boss: { body: 'coat', cloth: '#3b2a24', trim: '#1a100c', head: 'horns', weapon: 'rifle', scale: 1.12 },
    rebel: { body: 'vest', cloth: '#6f7a4a', shirt: '#c9b48a', trim: '#2f3420', head: 'rhelmet', weapon: 'rifle' },
    rebel_heavy: { body: 'vest', cloth: '#5f6a3e', shirt: '#b8a27a', trim: '#2f3420', head: 'rhelmet', bulky: 1.2, weapon: 'heavy' },
    rebel_officer: { body: 'vest', cloth: '#7d6a48', shirt: '#d8c6a0', trim: '#2f3420', head: 'beret', sash: '#c0392b', weapon: 'pistol' },
    smuggler: { body: 'vest', cloth: '#22252b', shirt: '#e9e4d8', trim: '#111', head: 'bare', weapon: 'pistol' },
    gamorrean: { body: 'brute', skin: '#7e9a4e', cloth: '#5a3d26', trim: '#2a1b10', head: 'pig', weapon: 'axe', scale: 1.28 },
    hutt_guard: { body: 'armor', armor: '#7a54b0', trim: '#2a1a3c', head: 'slit', weapon: 'rifle' },
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
  // Рисуется в системе руки: начало — кисть, ось +X — ствол
  function weapon(ctx, kind, st, side) {
    const flash = st.recoil > 0.55;
    const back = -st.recoil * 2.2;
    ctx.translate(back, 0);
    ctx.lineCap = 'round';
    let tip = 0;
    switch (kind) {
      case 'pistol':
        ctx.fillStyle = '#23262b'; rr(ctx, -1, -1.6, 9, 3.2, 1); ctx.fill();
        ctx.fillRect(-1, 0, 2.4, 4); tip = 8; break;
      case 'heavy':
        ctx.fillStyle = '#23262b'; rr(ctx, -4, -3, 20, 6, 1.5); ctx.fill();
        ctx.fillStyle = '#3d424a'; circle(ctx, 2, 2.5, 3.2); ctx.fill();
        ctx.fillStyle = '#23262b'; ctx.fillRect(15, -1.6, 4, 3.2); tip = 19; break;
      case 'sniper':
        ctx.fillStyle = '#23262b'; rr(ctx, -4, -1.4, 26, 2.8, 1); ctx.fill();
        ctx.fillRect(2, -4.6, 7, 2.4); tip = 22; break;
      case 'longrifle':
        ctx.fillStyle = '#4a3a28'; rr(ctx, -5, -1.5, 12, 3.2, 1); ctx.fill();
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(6, -1, 17, 2); tip = 23; break;
      case 'staff':
        ctx.strokeStyle = '#6a5233'; ctx.lineWidth = 2.2; line(ctx, -10, 0, 18, 0);
        ctx.fillStyle = '#9aa1a8';
        ctx.beginPath(); ctx.moveTo(18, -3.5); ctx.lineTo(25, 0); ctx.lineTo(18, 3.5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-10, -2.5); ctx.lineTo(-14, 0); ctx.lineTo(-10, 2.5); ctx.closePath(); ctx.fill();
        tip = 25; break;
      case 'axe':
        ctx.strokeStyle = '#5a3d26'; ctx.lineWidth = 2.6; line(ctx, -4, 0, 16, 0);
        ctx.fillStyle = '#a7adb3';
        ctx.beginPath(); ctx.moveTo(12, -1); ctx.quadraticCurveTo(18, -9, 22, -7); ctx.lineTo(19, 0); ctx.closePath(); ctx.fill();
        tip = 20; break;
      case 'ion':
        ctx.fillStyle = '#3a2c1c'; rr(ctx, -2, -1.6, 11, 3.2, 1); ctx.fill();
        ctx.fillStyle = '#7cc0ff'; circle(ctx, 9.5, 0, 1.8); ctx.fill(); tip = 10; break;
      default: // rifle
        ctx.fillStyle = '#23262b'; rr(ctx, -3, -1.8, 15, 3.6, 1); ctx.fill();
        ctx.fillRect(1, 1.2, 2.4, 3.5); ctx.fillRect(12, -1, 3, 2); tip = 15;
    }
    if (flash && kind !== 'staff' && kind !== 'axe') {
      const col = side === 0 ? '255,90,70' : kind === 'ion' ? '124,192,255' : '255,230,140';
      ctx.fillStyle = 'rgba(' + col + ',0.95)';
      circle(ctx, tip + 1.5, 0, 2.8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      circle(ctx, tip + 1.2, 0, 1.3); ctx.fill();
    }
  }

  // ================= ГОЛОВЫ =================
  function head(ctx, L, st) {
    const hx = 1, hy = -41;
    ctx.lineWidth = 1.2;
    switch (L.head) {
      case 'helmet': {
        // Округлый шлем с тёмным визором (оригинальный стилизованный дизайн)
        ctx.fillStyle = L.armor; ctx.strokeStyle = L.trim;
        ctx.beginPath(); ctx.arc(hx, hy, 9, Math.PI * 0.95, Math.PI * 0.05, false);
        ctx.quadraticCurveTo(hx + 9.5, hy + 8, hx + 4, hy + 9);
        ctx.lineTo(hx - 6, hy + 9); ctx.quadraticCurveTo(hx - 9.5, hy + 6, hx - 9, hy - 1); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1d2228';
        rr(ctx, hx - 1, hy - 2, L.visorLong ? 11 : 10, 4.2, 2); ctx.fill();
        ctx.fillStyle = 'rgba(140,190,255,0.35)'; ctx.fillRect(hx + 3, hy - 1.4, 4, 1.2);
        ctx.strokeStyle = 'rgba(40,45,52,0.55)';
        line(ctx, hx + 2, hy + 5, hx + 7, hy + 5);
        if (L.cape) { ctx.fillStyle = L.cape; ctx.beginPath(); ctx.moveTo(hx - 8, hy + 1); ctx.quadraticCurveTo(hx - 13, hy + 9, hx - 10, hy + 15); ctx.lineTo(hx - 5, hy + 8); ctx.closePath(); ctx.fill(); }
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
        ctx.fillStyle = '#1a1410'; circle(ctx, hx + 4.5, hy - 1.5, 1.2); ctx.fill();
        ctx.strokeStyle = 'rgba(60,30,20,0.7)'; line(ctx, hx + 3, hy + 4, hx + 6.5, hy + 4);
        const hair = ['#1e1a17', '#4a3020', '#8a5a2b', '#c9a15a', '#6b6b6b'][Math.floor(hash(st.seed + 3) * 5)];
        if (L.head === 'bare' || L.head === 'goggles') {
          ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hx - 1, hy - 2, 8.3, Math.PI, Math.PI * 1.95); ctx.closePath(); ctx.fill();
        }
        if (L.bandana) { ctx.fillStyle = L.bandana; ctx.fillRect(hx - 8, hy - 5, 16, 3); }
        if (L.head === 'goggles') { ctx.fillStyle = '#ffb23d'; rr(ctx, hx, hy - 4, 8, 3.4, 1.5); ctx.fill(); ctx.strokeStyle = '#222'; ctx.stroke(); }
        if (L.head === 'cap') { ctx.fillStyle = L.cap; ctx.beginPath(); ctx.arc(hx, hy - 2, 8.6, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.fillRect(hx + 2, hy - 3, 9, 2); }
        if (L.head === 'rhelmet') { ctx.fillStyle = '#5d6640'; ctx.strokeStyle = '#2f3420'; ctx.beginPath(); ctx.arc(hx, hy - 1, 9.2, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
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

  // ================= ГУМАНОИД =================
  function humanoid(ctx, L, st) {
    const moving = st.moving && !st.dead;
    const ph = st.t * 9 + (st.seed % 7);
    const swing = moving ? Math.sin(ph) * 0.6 : 0;
    const bob = moving ? Math.abs(Math.sin(ph)) * 1.6 : Math.sin(st.t * 2.2 + st.seed) * 0.4;
    const bulky = L.bulky || 1;
    ctx.save();
    ctx.translate(0, -bob);
    ctx.lineCap = 'round';

    const legCol = L.body === 'armor' || L.body === 'droid' ? (L.armor || L.metal) : L.body === 'brute' ? L.cloth : '#3b3428';
    const bootCol = L.body === 'droid' ? '#1c1f24' : '#24211d';

    if (L.body === 'robe') {
      // Ноги едва видны из-под робы
      ctx.fillStyle = '#4a3a28';
      ctx.fillRect(-5 + swing * 4, -4, 4, 4);
      ctx.fillRect(1 - swing * 4, -4, 4, 4);
      ctx.fillStyle = L.cloth; ctx.strokeStyle = L.band; ctx.lineWidth = 1.2;
      const sway = swing * 2;
      ctx.beginPath();
      ctx.moveTo(-6, -34); ctx.lineTo(6, -34);
      ctx.lineTo(10 + sway, -3); ctx.quadraticCurveTo(0, -1, -10 + sway, -3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = L.band; ctx.lineWidth = 2.2;
      line(ctx, -7, -20, 7, -22);
      ctx.lineWidth = 1;
    } else {
      // Задняя нога, затем передняя
      const hipY = -17;
      const leg = (ang, shade) => {
        const lx = Math.sin(ang) * 15, ly = Math.cos(ang) * 15;
        ctx.strokeStyle = shade; ctx.lineWidth = L.body === 'droid' ? 3 : 5 * Math.min(1.2, bulky);
        line(ctx, 0, hipY, lx, hipY + ly);
        ctx.fillStyle = bootCol; rr(ctx, lx - 3, hipY + ly - 2, 7, 3.6, 1.2); ctx.fill();
      };
      if (st.seated) {
        ctx.strokeStyle = legCol; ctx.lineWidth = 5;
        line(ctx, 0, hipY, 8, hipY + 2); line(ctx, 8, hipY + 2, 9, hipY + 9);
        ctx.fillStyle = bootCol; rr(ctx, 6, hipY + 8, 7, 3.6, 1.2); ctx.fill();
      } else {
        leg(-swing, shade(legCol, -0.25));
        leg(swing, legCol);
      }

      // Торс
      const w = (L.body === 'droid' ? 12 : 16) * bulky;
      const top = L.body === 'droid' ? -36 : -34;
      if (L.body === 'brute') {
        ctx.fillStyle = L.skin; ctx.strokeStyle = '#3e4f22'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(1, -24, 11, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = L.cloth; ctx.fillRect(-10, -20, 21, 5);
      } else {
        ctx.fillStyle = L.body === 'armor' ? L.armor : L.body === 'droid' ? L.metal : L.cloth;
        ctx.strokeStyle = L.trim; ctx.lineWidth = 1.2;
        rr(ctx, -w / 2, top, w, -14 - top + 0, 3.5); ctx.fill(); ctx.stroke();
        if (L.body === 'armor') {
          ctx.strokeStyle = 'rgba(40,45,52,0.45)';
          line(ctx, -w / 2 + 2, -27, w / 2 - 2, -27);
          ctx.fillStyle = L.trim; ctx.fillRect(-w / 2, -19.5, w, 2.6);
          if (L.camo) { ctx.fillStyle = 'rgba(80,90,70,0.55)'; circle(ctx, -3, -30, 2.5); ctx.fill(); circle(ctx, 3, -23, 2); ctx.fill(); }
          if (L.cross) { ctx.fillStyle = '#c0392b'; ctx.fillRect(-1.2, -32, 2.4, 8); ctx.fillRect(-4, -29.2, 8, 2.4); }
        }
        if (L.body === 'vest' || L.body === 'jacket' || L.body === 'coat') {
          if (L.shirt) { ctx.fillStyle = L.shirt; ctx.fillRect(-2, -33, 5, 14); }
          ctx.fillStyle = L.trim; ctx.fillRect(-w / 2, -19.5, w, 2.4);
          if (L.body === 'coat') { ctx.fillStyle = L.cloth; ctx.beginPath(); ctx.moveTo(-w / 2, -18); ctx.lineTo(-w / 2 - 2, -6); ctx.lineTo(w / 2 + 2, -6); ctx.lineTo(w / 2, -18); ctx.closePath(); ctx.fill(); }
          if (L.sash) { ctx.strokeStyle = L.sash; ctx.lineWidth = 2.4; line(ctx, -w / 2 + 1, -33, w / 2 - 1, -20); ctx.lineWidth = 1; }
        }
        if (L.body === 'droid') { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-3, -33, 6, 10); }
      }
      if (L.pack) { ctx.fillStyle = '#9a8662'; rr(ctx, -w / 2 - 5, -33, 6, 13, 2); ctx.fill(); }
      // Наплечник: у сержантов чёрный, у офицеров — красный
      const pad = L.pad || (st.side === 0 && L.body === 'armor' ? (st.rank >= 4 ? '#b8322a' : st.rank >= 2 ? '#2a2e35' : null) : null);
      if (pad) { ctx.fillStyle = pad; rr(ctx, -2, -35, 9 * bulky, 5, 2); ctx.fill(); }
    }

    // Задняя рука
    ctx.strokeStyle = shade(L.body === 'armor' ? L.armor : L.body === 'droid' ? L.metal : L.body === 'brute' ? L.skin : L.cloth, -0.2);
    ctx.lineWidth = 3.4;
    line(ctx, -2, -31, -5 - swing * 3, -21);

    head(ctx, L, st);

    // Передняя рука с оружием
    ctx.save();
    ctx.translate(3, -29);
    let ang = Math.max(-0.9, Math.min(0.9, st.aim || 0));
    if (st.melee > 0) ang = -1.5 + st.melee * 2.2;
    if (st.broken) ang = -1.2;
    ctx.rotate(ang);
    ctx.strokeStyle = L.body === 'armor' ? L.armor : L.body === 'droid' ? L.metal : L.body === 'brute' ? L.skin : L.cloth;
    ctx.lineWidth = 3.4;
    line(ctx, 0, 0, 7, 3);
    ctx.translate(7, 3);
    weapon(ctx, L.weapon, st, st.side);
    ctx.restore();

    ctx.restore();
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

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
  S.draw = function (ctx, type, x, y, cell, st) {
    const L = LOOKS[type];
    const k = cell / 40;
    ctx.save();
    ctx.translate(x, y);
    // тень и метка стороны
    const big = type === 'krayt' ? 2.2 : type === 'walker' ? 1.3 : (L && L.scale) || 1;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.36 * big, cell * 0.12 * big, 0, 0, TAU); ctx.fill();
    if (!st.dead) {
      ctx.strokeStyle = st.side === 0 ? 'rgba(150,210,255,0.85)' : 'rgba(255,110,90,0.85)';
      ctx.lineWidth = Math.max(1, cell * 0.05);
      ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.33 * big, cell * 0.11 * big, 0, 0, TAU); ctx.stroke();
    }
    ctx.scale(k * (st.facing || 1), k);
    if (st.dead) {
      ctx.globalAlpha = 0.8;
      ctx.rotate(-Math.min(1, st.dead) * Math.PI / 2);
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
    if (type === 'krayt') return 0.75;
    if (type === 'walker') return 1.55;
    if (type === 'turret') return 0.65;
    const L = LOOKS[type] || {};
    return 1.25 * (L.scale || 1) * (L.tall || 1) + (L.bike ? 0.35 : 0);
  };

  G.Sprites = S;
})(globalThis.G = globalThis.G || {});
