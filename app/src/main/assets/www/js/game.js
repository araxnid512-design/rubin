'use strict';
/* Игровая логика и отрисовка мира */
(function () {
  const T = G.TILE, WT = G.WT, W = G.WORLD, GC = G.GC, GN = G.GN, clamp = G.clamp;
  const HX = (G.HOME.tx + 0.5) * T, HY = (G.HOME.ty + 0.5) * T;
  const SPEED = 215, REACH = 30, DAYLEN = 480, PR = 14, EDGE = 2.6 * T;
  G.DAYLEN = DAYLEN;
  G.input = { mx: 0, my: 0, act: false, actPressed: false };
  G.tgt = { ref: null, type: '', d: 0, x: 0, y: 0, ir: 0 };
  G.view = { w: 1, h: 1, zoom: 1, css: 1 };
  G.cam = { x: HX, y: HY, left: 0, top: 0 };
  G.shake = 0; G.night = 0; G.rain = 0; G.uiDirty = true; G.hitstop = 0; G.decals = [];

  G.QUESTS = [
    { t: 'Собери 3 палки и 3 камня', c: () => cnt('stick') >= 3 && cnt('stone') >= 3, xp: 15 },
    { t: 'Создай каменный топор', c: () => cnt('hatchet') + cnt('iron_hatchet') > 0, xp: 20 },
    { t: 'Добудь 10 древесины', c: () => cnt('wood') >= 10, xp: 20 },
    { t: 'Создай каменную кирку', c: () => cnt('pickaxe') + cnt('iron_pickaxe') > 0, xp: 20 },
    { t: 'Построй верстак', c: () => G.stats.workbench > 0, xp: 30 },
    { t: 'Расширь дом: поставь 3 стены или пола', c: () => G.stats.built >= 3, xp: 30 },
    { t: 'Добудь железную руду', c: () => cnt('ore') > 0, xp: 40 },
    { t: 'Переживи первую ночь', c: () => G.day >= 2, xp: 60 }
  ];
  function cnt(id) { return G.Inv.count(G.p.inv, id); }
  let nightAnn = false;
  function decal(x, y, r) { if (G.decals.length > 48) G.decals.shift(); G.decals.push({ x, y, r, t: G.time, a: Math.random() * 3 }); }

  G.newGame = function () {
    G.genWorld(1337); G.buildHome();
    const s = G.spawnPoint();
    G.p = { dk: 2, x: s.x, y: s.y, sy: s.y, face: Math.PI / 2, walk: 0, atk: 0, atkDur: 0.4, hitDone: true, hurt: 0, moving: false,
      hp: 100, maxhp: 100, food: 85, water: 85, xp: 0, lvl: 1, inv: new Array(G.INV_SIZE).fill(null), armor: null, hand: null, toolSlot: -1, act: null, dead: false };
    G.mobs = []; G.parts = []; G.floaters = []; G.decals = []; nightAnn = false;
    G.time = DAYLEN * 0.1; G.day = 1; G.quest = 0;
    G.stats = { built: 0, workbench: 0, kills: 0 };
    G.build = null; G.cam.x = s.x; G.cam.y = s.y;
  };

  /* ---------- Столкновения ---------- */
  function collide(e, r, player) {
    const grid = G.grid, objs = G.objs, cx = (e.x / GC) | 0, cy = (e.y / GC) | 0;
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      if (i < 0 || j < 0 || i >= GN || j >= GN) continue;
      const l = grid[j * GN + i];
      for (let k = 0; k < l.length; k++) {
        const o = objs[l[k]]; if (!(o.a || o.K.keep) || !o.K.r) continue;
        const dx = e.x - o.x, dy = e.y - o.y, rr = r + o.K.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.01; e.x = o.x + dx / d * rr; e.y = o.y + dy / d * rr; }
      }
    }
    const tx0 = ((e.x - r) / T) | 0, tx1 = ((e.x + r) / T) | 0, ty0 = ((e.y - r) / T) | 0, ty1 = ((e.y + r + 10) / T) | 0;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const s = G.cells[ty * WT + tx]; if (!s || !s.solid) continue;
      if (s.k === 'door' && player) continue;
      let x0, y0, x1, y1;
      if (s.k === 'wall' || s.k === 'door') { x0 = tx * T; x1 = x0 + T; y0 = ty * T - 10; y1 = ty * T + T; }
      else if (s.k === 'campfire') { x0 = tx * T + 18; x1 = x0 + 28; y0 = ty * T + 24; y1 = y0 + 22; }
      else { x0 = tx * T + 8; x1 = x0 + 48; y0 = ty * T + 6; y1 = y0 + 50; }
      const nx = clamp(e.x, x0, x1), ny = clamp(e.y, y0, y1), dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) { const d = Math.sqrt(d2); e.x = nx + dx / d * r; e.y = ny + dy / d * r; }
        else {
          const a = e.x - x0, b = x1 - e.x, c = e.y - y0, d = y1 - e.y, m = Math.min(a, b, c, d);
          if (m === a) e.x = x0 - r; else if (m === b) e.x = x1 + r; else if (m === c) e.y = y0 - r; else e.y = y1 + r;
        }
      }
    }
    e.x = clamp(e.x, EDGE, W - EDGE); e.y = clamp(e.y, EDGE, W - EDGE);
  }
  function move(e, dx, dy, r, player) {
    const nx = e.x + dx; if (!G.isWater(nx + Math.sign(dx) * r * 0.6, e.y)) e.x = nx;
    const ny = e.y + dy; if (!G.isWater(e.x, ny + Math.sign(dy) * r * 0.6)) e.y = ny;
    collide(e, r, player);
  }

  /* ---------- Эффекты ---------- */
  function part(x, y, vx, vy, life, s, c, g) {
    if (G.parts.length > 260) return;
    G.parts.push({ x, y, vx, vy, life, max: life, s, c, g: g || 0 });
  }
  function burst(x, y, n, cols, sp, g) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.4 + Math.random() * 0.6); part(x, y, Math.cos(a) * v, Math.sin(a) * v - sp * 0.4, 0.35 + Math.random() * 0.35, 2 + Math.random() * 2.5, cols[(Math.random() * cols.length) | 0], g); }
  }
  G.floater = function (x, y, txt, col) {
    const n = G.floaters.length;
    G.floaters.push({ x, y: y - 30 - (n % 4) * 15, txt, col: col || '#fff', life: 1.3 });
  };
  function give(id, n, x, y) {
    const left = G.Inv.add(G.p.inv, id, n), got = n - left;
    if (got > 0) G.floater(x, y, '+' + got + ' ' + G.ITEMS[id].n, '#ffe9a8');
    if (left > 0) { G.floater(x, y, 'Рюкзак полон', '#ff8a7a'); G.sfx('deny'); }
    G.uiDirty = true;
    return left;
  }
  G.give = give;
  function addXp(n) {
    const p = G.p; p.xp += n;
    while (p.xp >= G.xpNeed(p.lvl)) {
      p.xp -= G.xpNeed(p.lvl); p.lvl++; p.maxhp += 5; p.hp = p.maxhp;
      G.floater(p.x, p.y - 20, 'Уровень ' + p.lvl + '!', '#ff5a6e'); G.sfx('lvl');
      burst(p.x, p.y, 18, ['#ff5a6e', '#ffd36e', '#fff'], 150, 0);
    }
    G.uiDirty = true;
  }
  G.addXp = addXp;
  G.xpNeed = l => 40 + l * 30;

  /* ---------- Инструменты ---------- */
  function bestTool(kind) {
    const inv = G.p.inv; let b = -1, bv = 0;
    for (let i = 0; i < inv.length; i++) {
      const s = inv[i]; if (!s) continue; const it = G.ITEMS[s.id]; if (!it.tool) continue;
      const v = kind === 'weapon' ? it.dmg : (it.tool === kind ? it.pow : 0);
      if (v > bv) { bv = v; b = i; }
    }
    return b;
  }
  G.bestTool = bestTool;
  function useTool() {
    const p = G.p, s = p.toolSlot >= 0 ? p.inv[p.toolSlot] : null; if (!s) return;
    if (--s.d <= 0) { G.floater(p.x, p.y, 'Сломалось: ' + G.ITEMS[s.id].n, '#ff8a7a'); p.inv[p.toolSlot] = null; p.hand = null; p.toolSlot = -1; G.sfx('deny'); }
    G.uiDirty = true;
  }

  /* ---------- Поиск цели ---------- */
  function scanTarget() {
    const p = G.p, t = G.tgt, R = 300; let bs = 1e9;
    t.ref = null;
    const test = (ref, type, x, y, ir, bonus) => {
      const dx = x - p.x, dy = y - p.y, d = Math.sqrt(dx * dx + dy * dy) - ir; if (d > R) return;
      const s = d - Math.cos(Math.atan2(dy, dx) - p.face) * 16 - bonus;
      if (s < bs) { bs = s; t.ref = ref; t.type = type; t.d = d; t.x = x; t.y = y; t.ir = ir; }
    };
    for (const m of G.mobs) if (!m.dead) test(m, 'mob', m.x, m.y, m.t === 'b' ? 20 : 14, m.t === 'd' ? 0 : 45);
    const c0 = Math.max(0, ((p.x - R) / GC) | 0), c1 = Math.min(GN - 1, ((p.x + R) / GC) | 0), r0 = Math.max(0, ((p.y - R) / GC) | 0), r1 = Math.min(GN - 1, ((p.y + R) / GC) | 0);
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
      const l = G.grid[j * GN + i];
      for (let k = 0; k < l.length; k++) { const o = G.objs[l[k]]; if (o.a && !o.K.deco) test(o, 'res', o.x, o.y, o.K.ir, 0); }
    }
    // станки и сундуки — цель только вблизи и только по новому нажатию (удержание их не «залипает»)
    const stOk = !G.input.act || G.input.actPressed;
    const tx = (p.x / T) | 0, ty = (p.y / T) | 0;
    for (let j = ty - 3; j <= ty + 3; j++) for (let i = tx - 3; i <= tx + 3; i++) {
      const s = G.cells[j * WT + i];
      if (s && stOk && (s.k === 'chest' || s.k === 'workbench' || s.k === 'campfire') && Math.hypot(s.x - p.x, s.y - p.y) < 76) test(s, 'st', s.x, s.y, 26, 0);
    }
  }
  function nearWater() {
    const p = G.p, c = Math.cos(p.face), s = Math.sin(p.face);
    return G.isWater(p.x + c * 34, p.y + s * 34) || G.isWater(p.x + 30, p.y) || G.isWater(p.x - 30, p.y) || G.isWater(p.x, p.y + 30) || G.isWater(p.x, p.y - 30);
  }
  // иконка для кнопки действия
  G.actIcon = function () {
    const p = G.p, t = G.tgt;
    if (t.ref && t.d <= 120) {
      if (t.type === 'mob') { const s = bestTool('weapon'); return s >= 0 ? p.inv[s].id : 'ui_fist'; }
      if (t.type === 'res' && t.ref.K.tool) { const s = bestTool(t.ref.K.tool); return s >= 0 ? p.inv[s].id : 'ui_fist'; }
      return 'ui_hand';
    }
    return nearWater() ? 'ui_drink' : 'ui_hand';
  };

  /* ---------- Действия игрока ---------- */
  function startAction(pressed) {
    const p = G.p, t = G.tgt;
    if (t.type === 'st') {
      if (!pressed) return;
      G.input.act = false;
      if (t.ref.k === 'chest') G.ui.openChest(t.ref); else G.ui.openCraft();
      return;
    }
    p.face = Math.atan2(t.y - p.y, t.x - p.x);
    p.act = { type: t.type, ref: t.ref };
    if (t.type === 'res' && !t.ref.K.tool) { p.atkDur = 0.26; p.toolSlot = -1; }
    else {
      p.toolSlot = bestTool(t.type === 'mob' ? 'weapon' : t.ref.K.tool);
      p.hand = p.toolSlot >= 0 ? p.inv[p.toolSlot].id : null;
      p.atkDur = 0.34;
    }
    p.atk = 0.001; p.hitDone = false;
  }
  const LOOT = [['canned', 1, 2], ['cloth', 1, 3], ['rope', 1, 2], ['bandage', 1, 2], ['bar', 1, 2], ['plank', 2, 4], ['flask_full', 1, 1]];
  function applyAction() {
    const p = G.p, a = p.act; if (!a) return;
    const o = a.ref, tool = p.toolSlot >= 0 && p.inv[p.toolSlot] ? G.ITEMS[p.inv[p.toolSlot].id] : null;
    if (a.type === 'mob') {
      if (o.dead || Math.hypot(o.x - p.x, o.y - p.y) > REACH + 60) return;
      const crit = Math.random() < 0.15; hurtMob(o, (tool ? tool.dmg : 5) * (crit ? 2 : 1), crit); useTool(); return;
    }
    if (!o.a) return;
    const K = o.K;
    if (K.pick) {
      const n = K.pick[1] + ((Math.random() * (K.pick[2] - K.pick[1] + 1)) | 0);
      if (give(K.pick[0], n, o.x, o.y) === n) return;
      o.a = false; o.t = G.time + K.re; G.sfx('pick'); addXp(K.xp);
      burst(o.x, o.y - 8, 6, ['#8cc35a', '#d9c98a'], 70, 0);
    } else if (K.loot) {
      for (let i = 0; i < 3; i++) { const l = LOOT[(Math.random() * LOOT.length) | 0]; give(l[0], l[1] + ((Math.random() * (l[2] - l[1] + 1)) | 0), o.x, o.y); }
      o.a = false; o.t = G.time + K.re; G.sfx('craft'); addXp(K.xp);
      burst(o.x, o.y - 10, 14, ['#7b8a52', '#4c5a32', '#d9c98a'], 130, 300);
    } else {
      if (K.need && !tool) { G.floater(o.x, o.y, 'Нужна кирка', '#ff8a7a'); G.sfx('deny'); return; }
      if (G.Inv.room(p.inv, K.drop) <= 0) { G.floater(o.x, o.y, 'Рюкзак полон', '#ff8a7a'); G.sfx('deny'); return; }
      const n = Math.min(tool ? tool.pow : 1, o.hp);
      o.hp -= n; o.hit = 0.3; let got = n;
      if (K.tree) {
        G.sfx('chop'); burst(o.x, o.y - 14, 7, ['#c9a36b', '#8a5e36', '#e8cf9a'], 120, 320);
        for (let i = 0; i < 4; i++) part(o.x + (Math.random() - 0.5) * 70, o.y - 70 - Math.random() * 70, (Math.random() - 0.5) * 30, 40 + Math.random() * 40, 1 + Math.random() * 0.6, 3.5, o.k === 'birch' ? '#d9c653' : '#4d8a3c', 0);
      } else { G.sfx('mine'); burst(o.x, o.y - 20, 8, ['#c9ced4', '#8e959e', K.need ? '#c06a2c' : '#6d747c'], 140, 380); }
      G.shake = Math.max(G.shake, 0.12);
      if (o.hp <= 0) { got += K.bonus; o.a = false; o.t = G.time + K.re; o.fall = 0; addXp(K.xp); }
      give(K.drop, got, o.x, o.y); useTool();
    }
  }
  function drink() {
    const p = G.p; let filled = 0;
    for (let i = 0; i < p.inv.length; i++) if (p.inv[i] && p.inv[i].id === 'flask_empty') { p.inv[i] = { id: 'flask_full', n: 1 }; filled++; }
    if (p.water >= 99 && !filled) return;
    p.water = Math.min(100, p.water + 30); p.atk = 0.001; p.atkDur = 0.7; p.hitDone = true; p.act = null;
    G.sfx('eat'); G.floater(p.x, p.y, filled ? 'Фляга наполнена' : '+30 воды', '#8fd8ff');
    burst(p.x + Math.cos(p.face) * 26, p.y + Math.sin(p.face) * 26, 8, ['#bfeaff', '#6cc0ea'], 80, 200);
    G.uiDirty = true;
  }
  G.useItem = function (i) {
    const p = G.p, s = p.inv[i]; if (!s) return;
    const it = G.ITEMS[s.id];
    if (it.armor) { const old = p.armor; p.armor = s.id; p.inv[i] = old ? { id: old, n: 1 } : null; G.sfx('craft'); }
    else if (it.food || it.water || it.hp) {
      if (it.food) p.food = Math.min(100, p.food + it.food);
      if (it.water) p.water = Math.min(100, p.water + it.water);
      if (it.hp) p.hp = clamp(p.hp + it.hp, 1, p.maxhp);
      if (--s.n <= 0) p.inv[i] = null;
      if (it.becomes) G.Inv.add(p.inv, it.becomes, 1);
      G.sfx('eat');
    }
    G.uiDirty = true;
  };
  function hurtPlayer(d) {
    const p = G.p; if (p.dead) return;
    if (p.armor) d *= 1 - G.ITEMS[p.armor].armor;
    p.hp -= d; p.hurt = 0.4; G.shake = Math.max(G.shake, 0.4); G.hitstop = 0.06; G.sfx('hurt'); G.uiDirty = true;
    burst(p.x, p.y, 10, ['#8a1414', '#5a0c0c', '#a01c1c'], 150, 0); decal(p.x + (Math.random() - 0.5) * 20, p.y + (Math.random() - 0.5) * 20, 7 + Math.random() * 6);
    if (p.hp <= 0) { p.hp = 0; p.dead = true; G.input.act = false; G.ui.showDeath(); }
  }
  G.respawn = function () {
    const p = G.p, s = G.spawnPoint();
    p.x = s.x; p.y = s.y; p.hp = Math.round(p.maxhp * 0.6); p.food = Math.max(p.food, 50); p.water = Math.max(p.water, 50);
    p.dead = false; p.atk = 0; p.hurt = 0; G.mobs.length = 0; G.cam.x = p.x; G.cam.y = p.y; G.uiDirty = true;
  };

  function updPlayer(dt) {
    const p = G.p, I = G.input;
    if (p.dead) return;
    scanTarget();
    const t = G.tgt, ws = bestTool('weapon');
    const reach = REACH + (t.type === 'mob' && ws >= 0 ? (G.ITEMS[p.inv[ws].id].reach || 0) : 0);
    const inReach = t.ref && t.d <= reach;
    let mx = I.mx, my = I.my; const ml = Math.hypot(mx, my);
    if (ml < 0.15) {
      mx = my = 0;
      if (I.act && !G.build && t.ref && !inReach && p.atk <= 0) { const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1; mx = dx / l; my = dy / l; }
    } else if (ml > 1) { mx /= ml; my /= ml; }
    if (mx || my) {
      const sp = SPEED * (p.atk > 0 ? 0.3 : 1) * (p.food <= 0 || p.water <= 0 ? 0.75 : 1);
      move(p, mx * sp * dt, my * sp * dt, PR, true);
      p.walk += dt * 12 * Math.hypot(mx, my);
      if (p.atk <= 0) p.face = G.angLerp(p.face, Math.atan2(my, mx), Math.min(1, dt * 14));
      p.moving = true;
      if (Math.random() < dt * 6) part(p.x, p.y + 8, (Math.random() - 0.5) * 20, -8, 0.4, 3, 'rgba(190,170,130,.5)', 0);
    } else p.moving = false;
    p.sy = p.y;
    if (p.atk > 0) {
      p.atk += dt / p.atkDur;
      if (!p.hitDone && p.atk >= 0.5) { p.hitDone = true; applyAction(); }
      if (p.atk >= 1) p.atk = 0;
    } else if (I.act && !G.build) {
      if (inReach) startAction(I.actPressed);
      else if ((!t.ref || t.d > 110) && nearWater() && I.actPressed) drink();
    }
    I.actPressed = false;
    // потребности
    p.food = Math.max(0, p.food - dt * 100 / 620); p.water = Math.max(0, p.water - dt * 100 / 460);
    if (p.food <= 0 || p.water <= 0) { p.hp -= dt * 1.6; if (p.hp <= 0) hurtPlayer(1); }
    else if (p.food > 35 && p.water > 35 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + dt * 0.9);
    if (p.hurt > 0) p.hurt -= dt;
  }

  /* ---------- Мобы ---------- */
  const MOB = { z: { hp: 36, sp: 96, dmg: 11, xp: 12 }, r: { hp: 24, sp: 168, dmg: 8, xp: 16 }, b: { hp: 120, sp: 66, dmg: 22, xp: 40 }, d: { hp: 22, sp: 178, dmg: 0, xp: 8 } };
  function newMob(t, x, y) {
    return { dk: 3, t, x, y, sy: y, face: Math.random() * 6.28, walk: 0, hp: MOB[t].hp, st: 'idle', tt: Math.random() * 3, gx: x, gy: y, atk: 0, cd: 0, hurt: 0, dead: 0, kx: 0, ky: 0, moving: false, hunt: false };
  }
  G.newMob = newMob;
  function hurtMob(m, d, crit) {
    const p = G.p; m.hp -= d; m.hurt = 0.25; G.sfx('hit'); G.shake = Math.max(G.shake, crit ? 0.3 : 0.16); G.hitstop = crit ? 0.07 : 0.04;
    const a = Math.atan2(m.y - p.y, m.x - p.x), kb = m.t === 'b' ? 110 : 280; m.kx = Math.cos(a) * kb; m.ky = Math.sin(a) * kb;
    for (let i = 0; i < 9; i++) { const v = 90 + Math.random() * 170, aa = a + (Math.random() - 0.5) * 1.1; part(m.x, m.y, Math.cos(aa) * v, Math.sin(aa) * v, 0.3 + Math.random() * 0.3, 2 + Math.random() * 2.5, ['#7a1010', '#4a0808', '#961818'][i % 3], 0); }
    if (Math.random() < 0.6) decal(m.x + Math.cos(a) * 18, m.y + Math.sin(a) * 18, 5 + Math.random() * 6);
    G.floater(m.x, m.y, (crit ? 'КРИТ -' : '-') + d, crit ? '#ffb347' : '#e8d8d0');
    if (m.t === 'd') { m.st = 'flee'; m.tt = 3; } else m.st = 'chase';
    if (m.hp <= 0) {
      m.dead = 0.001; m.sy = m.y - 4000; G.stats.kills++; addXp(MOB[m.t].xp); decal(m.x, m.y, 18 + Math.random() * 8);
      if (m.t === 'd') { give('meat_raw', 2, m.x, m.y); give('hide', 1, m.x, m.y); }
      else {
        if (Math.random() < 0.6) give('cloth', 1, m.x, m.y); if (Math.random() < 0.18) give('canned', 1, m.x, m.y); if (Math.random() < 0.2) give('rope', 1, m.x, m.y);
        if (m.t === 'b') { give('bar', 1, m.x, m.y); give('bandage', 1, m.x, m.y); }
      }
    }
  }
  let spawnT = 0;
  function trySpawn(t, night) {
    const p = G.p, a = Math.random() * 6.283, r = 900 + Math.random() * 380, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (x < EDGE + 40 || y < EDGE + 40 || x > W - EDGE - 40 || y > W - EDGE - 40 || G.isWater(x, y)) return;
    if (t !== 'd' && Math.hypot(x - HX, y - HY) < (night ? 6 : 11) * T) return;
    const m = newMob(t, x, y);
    if (night && t !== 'd' && Math.random() < 0.5) { m.hunt = true; m.st = 'chase'; }
    G.mobs.push(m);
  }
  function updMobs(dt) {
    const p = G.p, mobs = G.mobs, night = G.night > 0.5;
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = night ? 0.7 : 1.2; let z = 0, d = 0;
      for (const m of mobs) if (m.t === 'd') d++; else if (!m.dead) z++;
      if (z < (night ? 16 : 8)) { const q = Math.random(); trySpawn(q < 0.28 ? 'r' : q < (night ? 0.4 : 0.33) ? 'b' : 'z', night); }
      if (d < 4) trySpawn('d');
    }
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i], M = MOB[m.t];
      if (m.dead) { m.dead += dt; if (m.dead > 6) mobs.splice(i, 1); continue; }
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > 1900) { mobs.splice(i, 1); continue; }
      let vx = 0, vy = 0, sp = 0;
      if (m.t === 'd') {
        if (m.st !== 'flee' && d < 210 && !p.dead) { m.st = 'flee'; m.tt = 2.2; }
        if (m.st === 'flee') { vx = -dx / d; vy = -dy / d; sp = M.sp; m.tt -= dt; if (m.tt <= 0) { m.st = 'idle'; m.tt = 1; } }
      } else {
        const ag = night ? 470 : 330;
        if (!night) m.hunt = false;
        if (m.st !== 'chase' && d < ag && !p.dead) { m.st = 'chase'; if (d < 520) G.sfx('growl'); }
        if (m.st === 'chase') {
          vx = dx / d; vy = dy / d;
          if (p.dead || (!m.hunt && d > ag * 1.7)) { m.st = 'idle'; m.tt = 1; }
          else if (d > 30) sp = M.sp;
          if (m.cd > 0) m.cd -= dt;
          // атака: замах, затем резкий рывок к цели — от него можно увернуться
          if (d < 78 && m.cd <= 0 && m.atk <= 0) m.atk = 0.001;
          if (m.atk > 0) {
            const before = m.atk; m.atk += dt / (m.t === 'b' ? 0.75 : 0.5);
            sp = m.atk > 0.25 && m.atk < 0.5 && d > 26 ? M.sp * 2.2 + 150 : 0;
            if (before < 0.5 && m.atk >= 0.5 && d < 50) hurtPlayer(M.dmg);
            if (m.atk >= 1) { m.atk = 0; m.cd = m.t === 'r' ? 0.35 : 0.6; }
          }
        }
      }
      if (m.st === 'idle') {
        m.tt -= dt;
        if (m.tt <= 0) { m.tt = 2 + Math.random() * 4; const a = Math.random() * 6.283, r = Math.random() < 0.3 ? 0 : 60 + Math.random() * 160; m.gx = m.x + Math.cos(a) * r; m.gy = m.y + Math.sin(a) * r; }
        const gx = m.gx - m.x, gy = m.gy - m.y, gd = Math.hypot(gx, gy);
        if (gd > 6) { vx = gx / gd; vy = gy / gd; sp = m.t === 'd' ? 42 : 30; }
      }
      m.moving = sp > 1;
      if (m.moving || m.st === 'chase') m.face = G.angLerp(m.face, Math.atan2(vy, vx), Math.min(1, dt * 9));
      if (m.moving) m.walk += dt * (sp > 110 ? 16 : 9);
      move(m, (vx * sp + m.kx) * dt, (vy * sp + m.ky) * dt, m.t === 'b' ? 17 : 13, false);
      const kd = Math.pow(0.002, dt); m.kx *= kd; m.ky *= kd;
      if (m.hurt > 0) m.hurt -= dt;
      m.sy = m.y;
    }
  }

  /* ---------- Обновление мира ---------- */
  let rainT = 0, resI = 0, fireT = 0, questT = 0;
  G.nightAt = function (ph) {
    if (ph < 0.56) return 0; if (ph < 0.68) return G.sstep(0.56, 0.68, ph);
    if (ph < 0.92) return 1; return 1 - G.sstep(0.92, 1, ph);
  };
  G.update = function (dt) {
    G.time += dt;
    const ph = (G.time % DAYLEN) / DAYLEN;
    G.phase = ph; G.night = G.nightAt(ph);
    const day = Math.floor(G.time / DAYLEN) + 1;
    if (day !== G.day) { G.day = day; G.floater(G.p.x, G.p.y - 30, 'День ' + day, '#ffe9a8'); }
    if (G.night > 0.5 && !nightAnn) { nightAnn = true; G.floater(G.p.x, G.p.y - 50, 'Наступает ночь. Они идут…', '#ff6a5a'); G.sfx('growl'); }
    else if (G.night < 0.1) nightAnn = false;
    // погода: время от времени идёт дождь
    const wr = G.noise(G.time / 75, 9.3) > 0.6 ? 1 : 0;
    G.rain += (wr - G.rain) * Math.min(1, dt * 0.3); if (G.rain < 0.01 && !wr) G.rain = 0;
    rainT -= dt; if (rainT <= 0) { rainT = 0.5; G.setRain(G.rain); }
    updPlayer(dt); updMobs(dt);
    // камера
    const p = G.p, k = Math.min(1, dt * 6);
    G.cam.x += (p.x + Math.cos(p.face) * 30 * (p.moving ? 1 : 0) - G.cam.x) * k; G.cam.y += (p.y - G.cam.y) * k;
    if (G.shake > 0) G.shake -= dt;
    // возобновление ресурсов (по кусочку за кадр)
    const objs = G.objs;
    for (let i = 0; i < 40; i++) {
      resI = (resI + 1) % objs.length; const o = objs[resI];
      if (!o.a && G.time >= o.t && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) > 900) { o.a = true; o.hp = o.K.hp || 1; o.fall = 1; }
    }
    // частицы
    const ps = G.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i]; q.life -= dt;
      if (q.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.vx *= 0.98;
    }
    const fl = G.floaters;
    for (let i = fl.length - 1; i >= 0; i--) { fl[i].life -= dt; fl[i].y -= dt * 26; if (fl[i].life <= 0) fl.splice(i, 1); }
    // костры
    fireT -= dt;
    if (fireT <= 0) {
      fireT = 0.07;
      for (const f of G.fires) {
        if (Math.abs(f.x - p.x) > 900 || Math.abs(f.y - p.y) > 600) continue;
        if (Math.random() < 0.5) part(f.x + (Math.random() - 0.5) * 12, f.y - 12, (Math.random() - 0.5) * 22, -50 - Math.random() * 50, 0.7 + Math.random() * 0.5, 2, Math.random() < 0.5 ? '#ffd36e' : '#ff8a2a', -20);
        if (Math.random() < 0.3) part(f.x + (Math.random() - 0.5) * 8, f.y - 26, (Math.random() - 0.5) * 12, -34, 1.6, 7, 'rgba(120,120,120,.22)', -6);
      }
    }
    // анимация ударов по ресурсам / падение деревьев обновляется при отрисовке видимых
    // задания
    questT -= dt;
    if (questT <= 0) {
      questT = 0.5; const q = G.QUESTS[G.quest];
      if (q && q.c()) { G.quest++; addXp(q.xp); G.floater(p.x, p.y - 44, 'Задание выполнено!', '#9dff9a'); G.sfx('lvl'); G.uiDirty = true; }
    }
    // фоновая подготовка чанков земли
    pregen();
  };
  let pgT = 0;
  function pregen() {
    if (++pgT % 3) return;
    const V = G.view, CH = G.CH, hw = V.w / 2 / V.zoom + CH * 0.8, hh = V.h / 2 / V.zoom + CH * 0.8, mx = Math.ceil(W / CH) - 1;
    const c0 = Math.max(0, Math.floor((G.cam.x - hw) / CH)), c1 = Math.min(mx, Math.floor((G.cam.x + hw) / CH));
    const r0 = Math.max(0, Math.floor((G.cam.y - hh) / CH)), r1 = Math.min(mx, Math.floor((G.cam.y + hh) / CH));
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) if (!G.getChunk(i, j, false)) { G.getChunk(i, j, true); return; }
  }

  /* ---------- Строительство ---------- */
  G.buildAt = function (wx, wy) {
    const b = G.build, p = G.p; if (!b) return;
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T), cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
    b.hx = tx; b.hy = ty; b.ht = 0.5; b.ok = false;
    if (Math.hypot(cx - p.x, cy - p.y) > 7.5 * T) { G.floater(p.x, p.y, 'Слишком далеко', '#ff8a7a'); G.sfx('deny'); return; }
    if (b.demolish) {
      const s = G.cells[ty * WT + tx];
      if (s && s.k === 'bed') { G.sfx('deny'); return; }
      if (s && s.k === 'chest' && s.inv.some(v => v)) { G.floater(cx, cy, 'Сундук не пуст', '#ff8a7a'); G.sfx('deny'); return; }
      const k = G.removeStruct(tx, ty);
      if (!k) { G.sfx('deny'); return; }
      const def = G.BUILD.find(d => d.k === k);
      for (const id in def.cost) { const n = Math.floor(def.cost[id] / 2); if (n) give(id, n, cx, cy); }
      burst(cx, cy, 12, ['#c9a36b', '#8a5e36'], 140, 300); G.sfx('build'); b.ok = true; return;
    }
    const def = b.def;
    if (!G.Inv.has(p.inv, def.cost)) { G.floater(p.x, p.y, 'Не хватает ресурсов', '#ff8a7a'); G.sfx('deny'); return; }
    if (def.k !== 'floor' && Math.abs(cx - p.x) < 32 + PR && Math.abs(cy - p.y) < 32 + PR) { G.floater(p.x, p.y, 'Отойди с клетки', '#ff8a7a'); G.sfx('deny'); return; }
    if (!G.canBuild(def.k, tx, ty)) { G.floater(cx, cy, 'Здесь нельзя', '#ff8a7a'); G.sfx('deny'); return; }
    G.Inv.pay(p.inv, def.cost); G.addStruct(def.k, tx, ty);
    G.stats.built++; if (def.k === 'workbench') G.stats.workbench++;
    burst(cx, cy, 12, ['#e8cf9a', '#c9a36b', '#fff'], 120, 260); G.sfx('build'); addXp(4);
    b.ok = true; G.uiDirty = true;
  };
  G.stationNear = function (k) {
    const p = G.p, tx = (p.x / T) | 0, ty = (p.y / T) | 0;
    for (let j = ty - 3; j <= ty + 3; j++) for (let i = tx - 3; i <= tx + 3; i++) { const s = G.cells[j * WT + i]; if (s && s.k === k && Math.hypot(s.x - p.x, s.y - p.y) < 170) return true; }
    return false;
  };

  /* ---------- Отрисовка ---------- */
  const list = [];
  let lightSpr, glowSpr, coneSpr, cloudSpr, mistSpr, caust, wc, wctx, aoV, aoH, lc, lctx;
  function radial(n, stops) {
    const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
    const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    x.fillStyle = g; x.fillRect(0, 0, n, n); return c;
  }
  G.initRender = function () {
    lightSpr = radial(128, [0, 'rgba(0,0,0,1)', 0.45, 'rgba(0,0,0,.75)', 1, 'rgba(0,0,0,0)']);
    glowSpr = radial(128, [0, 'rgba(255,150,50,.55)', 0.5, 'rgba(255,110,30,.18)', 1, 'rgba(255,90,20,0)']);
    mistSpr = radial(128, [0, 'rgba(176,186,184,.5)', 0.5, 'rgba(176,186,184,.24)', 1, 'rgba(176,186,184,0)']);
    // бесшовная текстура бликов на воде
    caust = document.createElement('canvas'); caust.width = caust.height = 128;
    { const x = caust.getContext('2d'), r = G.rng(7); x.strokeStyle = 'rgba(170,205,210,.55)'; x.lineCap = 'round';
      for (let i = 0; i < 34; i++) {
        const px = r() * 128, py = r() * 128, l = 6 + r() * 12, cv = (r() - 0.5) * 5; x.lineWidth = 0.6 + r() * 0.7;
        for (let ox = -128; ox <= 128; ox += 128) for (let oy = -128; oy <= 128; oy += 128) { x.beginPath(); x.moveTo(px + ox - l, py + oy); x.quadraticCurveTo(px + ox, py + oy + cv, px + ox + l, py + oy); x.stroke(); }
      } }
    wc = document.createElement('canvas'); wc.width = wc.height = 128; wctx = wc.getContext('2d');
    const grad = (w, h, x1, y1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), q = x.createLinearGradient(0, 0, x1, y1); q.addColorStop(0, 'rgba(0,0,0,.5)'); q.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = q; x.fillRect(0, 0, w, h); return c; };
    aoV = grad(2, 16, 0, 16); aoH = grad(16, 2, 16, 0);
    cloudSpr = radial(128, [0, 'rgba(6,10,8,.5)', 0.5, 'rgba(6,10,8,.3)', 1, 'rgba(6,10,8,0)']);
    coneSpr = document.createElement('canvas'); coneSpr.width = coneSpr.height = 128;
    { const x = coneSpr.getContext('2d'), gr = x.createRadialGradient(0, 64, 0, 0, 64, 128);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.filter = 'blur(5px)'; x.beginPath(); x.moveTo(0, 64); x.arc(0, 64, 124, -0.5, 0.5); x.closePath(); x.fill(); }
    lc = document.createElement('canvas'); lctx = lc.getContext('2d');
  };
  function flame(x, w, h, sw, col) {
    x.fillStyle = col; x.beginPath(); x.moveTo(-w, 0); x.quadraticCurveTo(-w * 1.15, -h * 0.5, sw, -h);
    x.quadraticCurveTo(w * 1.15, -h * 0.5, w, 0); x.quadraticCurveTo(0, w * 0.8, -w, 0); x.fill();
  }
  const motes = [];
  G.render = function (dt) {
    const ctx = G.ctx, V = G.view, z = V.zoom, p = G.p, S = G.SPR, CH = G.CH;
    const hw = V.w / 2 / z, hh = V.h / 2 / z;
    let cx = clamp(G.cam.x, hw, W - hw), cy = clamp(G.cam.y, hh, W - hh);
    if (G.shake > 0) { cx += (Math.random() - 0.5) * G.shake * 30; cy += (Math.random() - 0.5) * G.shake * 30; }
    const left = cx - hw, top = cy - hh, right = cx + hw, bot = cy + hh;
    G.cam.left = left; G.cam.top = top;
    const SX = x => Math.round((x - left) * z), SY = y => Math.round((y - top) * z);
    // земля
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    const mc = Math.ceil(W / CH) - 1;
    for (let j = Math.max(0, Math.floor(top / CH)); j <= Math.min(mc, Math.floor(bot / CH)); j++)
      for (let i = Math.max(0, Math.floor(left / CH)); i <= Math.min(mc, Math.floor(right / CH)); i++) {
        const x0 = SX(i * CH), y0 = SY(j * CH), ch = G.getChunk(i, j, true), cw = SX((i + 1) * CH) - x0, chh = SY((j + 1) * CH) - y0;
        ctx.drawImage(ch, x0, y0, cw, chh);
        if (ch.wm) {  // живая вода: два слоя бликов, обрезанных по маске озера
          const tmw = G.time, a1 = (tmw * 5) % 128, b1 = (tmw * 2.2) % 128, a2 = 128 - (tmw * 3.4) % 128, b2 = (tmw * 4.1) % 128;
          wctx.globalCompositeOperation = 'source-over'; wctx.clearRect(0, 0, 128, 128);
          for (let u = -128; u <= 0; u += 128) for (let v = -128; v <= 0; v += 128) { wctx.drawImage(caust, a1 + u, b1 + v); wctx.drawImage(caust, a2 + u, b2 + v); }
          wctx.globalCompositeOperation = 'destination-in'; wctx.drawImage(ch.wm, 0, 0);
          ctx.globalAlpha = 0.55 * (1 - G.night * 0.7); ctx.drawImage(wc, x0, y0, cw, chh); ctx.globalAlpha = 1;
        }
      }
    // блики на воде
    const tm = G.time;
    // полы и тени стен
    const tx0 = Math.max(0, Math.floor(left / T)), tx1 = Math.min(WT - 1, Math.floor(right / T)), ty0 = Math.max(0, Math.floor(top / T) - 1), ty1 = Math.min(WT - 1, Math.floor(bot / T) + 1);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (G.floors[ty * WT + tx]) {
        const x0 = SX(tx * T), y0 = SY(ty * T), fw = SX(tx * T + T) - x0, fh = SY(ty * T + T) - y0;
        ctx.drawImage(S.floor[(tx + ty) & 1].c, x0, y0, fw, fh);
        // затенение пола у стен
        const up = G.cells[(ty - 1) * WT + tx], lf = G.cells[ty * WT + tx - 1], me = G.cells[ty * WT + tx];
        if (!(me && (me.k === 'wall' || me.k === 'door'))) {
          if (up && (up.k === 'wall' || up.k === 'door')) ctx.drawImage(aoV, x0, y0, fw, Math.round(22 * z));
          if (lf && (lf.k === 'wall' || lf.k === 'door')) ctx.drawImage(aoH, x0, y0, Math.round(16 * z), fh);
        }
      }
    }
    ctx.fillStyle = 'rgba(8,14,8,.26)';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const s = G.cells[ty * WT + tx];
      if (s && (s.k === 'wall' || s.k === 'door')) {
        const b = G.cells[(ty + 1) * WT + tx], r = G.cells[ty * WT + tx + 1];
        if (!(b && (b.k === 'wall' || b.k === 'door'))) { const x0 = SX(tx * T), y0 = SY(ty * T + T); ctx.fillRect(x0, y0, SX(tx * T + T + 10) - x0, Math.round(12 * z)); }
        if (!(r && (r.k === 'wall' || r.k === 'door'))) { const x0 = SX(tx * T + T), y0 = SY(ty * T - 8); ctx.fillRect(x0, y0, Math.round(10 * z), SY(ty * T + T) - y0); }
      }
    }
    // кровь на земле
    const dc = G.decals;
    for (let i = 0; i < dc.length; i++) {
      const q = dc[i], age = tm - q.t; if (age > 45) { dc.splice(i--, 1); continue; }
      if (q.x < left - 40 || q.x > right + 40 || q.y < top - 40 || q.y > bot + 40) continue;
      ctx.setTransform(z, 0, 0, z, SX(q.x), SY(q.y)); ctx.globalAlpha = Math.min(0.7, (45 - age) / 12);
      ctx.fillStyle = '#4a0909'; ctx.beginPath(); ctx.ellipse(0, 0, q.r, q.r * 0.62, q.a, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(q.r * 0.8, q.r * 0.3, q.r * 0.35, q.r * 0.25, q.a, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(255,255,255,.1)';
    // сетка строительства
    const b = G.build;
    if (b) {
      const ptx = Math.floor(p.x / T), pty = Math.floor(p.y / T);
      for (let i = ptx - 7; i <= ptx + 8; i++) ctx.fillRect(SX(i * T), SY((pty - 5) * T), 1, Math.round(11 * T * z));
      for (let j = pty - 5; j <= pty + 6; j++) ctx.fillRect(SX((ptx - 7) * T), SY(j * T), Math.round(15 * T * z), 1);
      if (b.ht > 0) { b.ht -= dt; ctx.fillStyle = b.ok ? 'rgba(120,255,140,' + b.ht * 0.8 + ')' : 'rgba(255,90,80,' + b.ht * 0.8 + ')'; const x0 = SX(b.hx * T), y0 = SY(b.hy * T); ctx.fillRect(x0, y0, SX(b.hx * T + T) - x0, SY(b.hy * T + T) - y0); }
    }
    // кольцо цели
    const t = G.tgt;
    if (!b && t.ref && t.d < 70 && !p.dead) {
      ctx.setTransform(z, 0, 0, z, SX(t.x), SY(t.y));
      ctx.strokeStyle = 'rgba(255,226,130,' + (0.55 + Math.sin(tm * 6) * 0.25) + ')'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, t.type === 'res' && t.ref.K.r ? 2 : 0, t.ir + 9, (t.ir + 9) * 0.62, 0, 0, 6.283); ctx.stroke();
    }
    // сбор объектов
    list.length = 0;
    const g0 = Math.max(0, ((left - 90) / GC) | 0), g1 = Math.min(GN - 1, ((right + 90) / GC) | 0), h0 = Math.max(0, ((top - 40) / GC) | 0), h1 = Math.min(GN - 1, ((bot + 200) / GC) | 0);
    for (let j = h0; j <= h1; j++) for (let i = g0; i <= g1; i++) {
      const l = G.grid[j * GN + i];
      for (let k = 0; k < l.length; k++) { const o = G.objs[l[k]]; if (o.a || o.K.tree || o.K.keep || o.k === 'bush') list.push(o); }
    }
    for (let ty = ty0; ty <= Math.min(WT - 1, ty1 + 1); ty++) for (let tx = tx0; tx <= tx1; tx++) { const s = G.cells[ty * WT + tx]; if (s) list.push(s); }
    for (const m of G.mobs) if (m.x > left - 40 && m.x < right + 40 && m.y > top - 40 && m.y < bot + 40) list.push(m);
    if (!p.dead) list.push(p);
    list.sort((a, c) => a.sy - c.sy);
    // длинные тени деревьев, направление зависит от времени суток
    const nt0 = G.night, sunA = (1 - nt0) * (1 - G.rain * 0.6) * 0.34;
    if (sunA > 0.03) {
      const dp = clamp(G.phase / 0.6, 0, 1), sc = (0.95 - dp * 1.9) * z, sd = -(0.26 + Math.abs(dp - 0.5) * 0.36) * z;
      ctx.globalAlpha = sunA;
      for (let n = 0; n < list.length; n++) {
        const o = list[n]; if (o.dk !== 0 || !o.K.tree || !o.a) continue;
        const sp = S[o.k][o.v];
        ctx.setTransform(z, 0, sc, sd, SX(o.x), SY(o.y)); ctx.drawImage(sp.sh, -sp.ax, -sp.ay, sp.w, sp.h);
      }
      ctx.globalAlpha = 1;
    }
    for (let n = 0; n < list.length; n++) {
      const o = list[n];
      if (o.dk === 0) {
        const sx = SX(o.x), sy = SY(o.y);
        if (o.K.tree) {
          if (!o.a) {
            const st = S.stump; ctx.setTransform(z, 0, 0, z, sx, sy); ctx.drawImage(st.c, -st.ax, -st.ay, st.w, st.h);
            if (o.fall < 1) {
              o.fall += dt * 1.6; const f = Math.min(1, o.fall), sp = S[o.k][o.v], a = f * f * 1.45, c = Math.cos(a), s = Math.sin(a);
              ctx.globalAlpha = 1 - f * f; ctx.setTransform(c * z, s * z, -s * z, c * z, sx, sy); ctx.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h); ctx.globalAlpha = 1;
            }
            continue;
          }
          const sp = S[o.k][o.v];
          let sw = Math.sin(tm * 1.3 + o.x * 0.011 + o.y * 0.017) * 0.016;
          if (o.hit > 0) { o.hit -= dt; sw += Math.sin(o.hit * 45) * o.hit * 0.22; }
          const fade = p.y < o.y + 6 && p.y > o.y - 150 && Math.abs(p.x - o.x) < 54;
          if (fade) ctx.globalAlpha = 0.42;
          ctx.setTransform(z, 0, -sw * z, z, sx, sy); ctx.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h);
          if (fade) ctx.globalAlpha = 1;
        } else {
          const sp = o.a || o.K.keep ? S[o.k][o.v] : S.bush0;
          let ox = 0;
          if (o.hit > 0) { o.hit -= dt; ox = Math.sin(o.hit * 60) * o.hit * 9; }
          if (o.k === 'fiber' || o.k === 'bush' || o.K.deco) { const sw = Math.sin(tm * 1.6 + o.x * 0.02) * 0.03; ctx.setTransform(z, 0, -sw * z, z, sx, sy); }
          else ctx.setTransform(z, 0, 0, z, sx + ox * z, sy);
          ctx.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h);
        }
      } else if (o.dk === 1) {
        let sp = S[o.k];
        if (o.k === 'door' && Math.abs(p.x - o.x) < 62 && Math.abs(p.y - o.y) < 74) sp = S.doorOpen;
        const fade = (o.k === 'wall' || o.k === 'door') && p.y < o.ty * T + 6 && p.y > o.ty * T - 64 && Math.abs(p.x - o.x) < 62;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (fade) ctx.globalAlpha = 0.5;
        const x0 = SX(o.tx * T), y0 = SY(o.ty * T - sp.ay);
        ctx.drawImage(sp.c, x0, y0, SX(o.tx * T + sp.w) - x0, SY(o.ty * T - sp.ay + sp.h) - y0);
        if (fade) ctx.globalAlpha = 1;
        if (o.k === 'campfire') {
          const f = tm * 9 + o.tx * 3, h = 30 + Math.sin(f) * 4 + Math.sin(f * 2.3) * 3, sw = Math.sin(f * 0.7) * 3;
          ctx.setTransform(z, 0, 0, z, SX(o.x), SY(o.y + 6));
          flame(ctx, 12, h, sw, '#ff6a12'); flame(ctx, 8.5, h * 0.72, sw * 0.7, '#ffb02e'); flame(ctx, 4.5, h * 0.42, sw * 0.4, '#fff2b0');
        }
      } else if (o.dk === 2) {
        ctx.setTransform(z * 1.3, 0, 0, z * 1.3, SX(o.x), SY(o.y));
        G.drawHuman(ctx, o, 'p', o.hand, o.moving);
      } else {
        if (o.dead) ctx.globalAlpha = Math.max(0, Math.min(0.85, (6 - o.dead) / 2));
        const ms = z * (o.t === 'b' ? 1.8 : 1.3);
        ctx.setTransform(ms, 0, 0, ms, SX(o.x), SY(o.y));
        if (o.t === 'd') G.drawDeer(ctx, o, o.moving); else G.drawHuman(ctx, o, o.t, null, o.moving);
        ctx.globalAlpha = 1;
      }
    }
    // частицы и надписи
    ctx.setTransform(z, 0, 0, z, -left * z, -top * z);
    const ps = G.parts;
    for (let i = 0; i < ps.length; i++) { const q = ps[i]; ctx.globalAlpha = Math.min(1, q.life / q.max * 1.6); ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
    // полоски здоровья мобов
    ctx.globalAlpha = 1;
    for (const m of G.mobs) {
      const M = MOB[m.t]; if (m.dead || m.hp >= M.hp) continue;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(m.x - 17, m.y - 30, 34, 5);
      ctx.fillStyle = '#b01e22'; ctx.fillRect(m.x - 16, m.y - 29, 32 * m.hp / M.hp, 3);
    }
    // тени облаков
    const nt = G.night;
    if (nt < 0.9) {
      ctx.globalAlpha = (1 - nt) * 0.5;
      for (let i = 0; i < 4; i++) {
        const r = 520 + i * 90, px = ((i * 1370 + tm * 26) % (W + 1600)) - 800, py = (i * 1130 + 300 + Math.sin(tm * 0.03 + i) * 200) % W;
        if (px + r > left && px - r < right && py + r > top && py - r < bot) ctx.drawImage(cloudSpr, px - r, py - r * 0.7, r * 2, r * 1.4);
      }
      ctx.globalAlpha = 1;
    }
    // стелющийся туман: на рассвете, в сумерках и в дождь
    const mist = Math.max(G.rain * 0.8, G.phase < 0.16 ? 1 - G.phase / 0.16 : 0, nt > 0 && nt < 1 ? Math.sin(nt * Math.PI) : 0, nt * 0.45);
    if (mist > 0.04) {
      ctx.globalAlpha = mist * 0.5;
      for (let i = 0; i < 6; i++) {
        const r = 380 + i * 60, sx = W + 1400, px = ((i * 911 + tm * (9 + i * 2)) % sx) - 700, py = (i * 787 + 500 + Math.sin(tm * 0.05 + i * 2) * 260) % W;
        if (px + r > left && px - r < right && py + r * 0.5 > top && py - r * 0.5 < bot) ctx.drawImage(mistSpr, px - r, py - r * 0.5, r * 2, r);
      }
      ctx.globalAlpha = 1;
    }
    // пепел и пыль в воздухе
    while (motes.length < 26) motes.push({ x: left + Math.random() * hw * 2, y: top + Math.random() * hh * 2, ph: Math.random() * 6, s: 1.2 + Math.random() * 1.8 });
    ctx.fillStyle = '#cfc8b8';
    for (const m of motes) {
      if (m.x < left - 30) m.x += hw * 2 + 50; else if (m.x > right + 30) m.x -= hw * 2 + 50;
      if (m.y < top - 30) m.y += hh * 2 + 50; else if (m.y > bot + 30) m.y -= hh * 2 + 50;
      m.ph += dt; m.x += (16 + Math.sin(m.ph * 0.9) * 10) * dt; m.y += (9 + Math.cos(m.ph * 1.3) * 8) * dt;
      ctx.globalAlpha = 0.16 + 0.14 * Math.sin(m.ph * 2); ctx.fillRect(m.x, m.y, m.s, m.s);
    }
    ctx.globalAlpha = 1;
    // свет и ночь
    if (nt > 0.02) {
      const lw = Math.ceil(V.w / 4), lh = Math.ceil(V.h / 4);
      if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
      lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, lw, lh);
      const k = nt;
      lctx.fillStyle = 'rgba(' + Math.round(70 - 62 * k) + ',' + Math.round(38 - 26 * k) + ',' + Math.round(58 - 18 * k) + ',' + (k * 0.86) + ')';
      lctx.fillRect(0, 0, lw, lh);
      lctx.globalCompositeOperation = 'destination-out';
      const q = z / 4;
      const hole = (x, y, r, a) => { lctx.globalAlpha = a; lctx.drawImage(lightSpr, (x - left - r) * q, (y - top - r) * q, r * 2 * q, r * 2 * q); };
      hole(p.x, p.y, 150, 0.45);
      if (!p.dead) {  // луч фонаря
        lctx.save(); lctx.translate((p.x - left) * q, (p.y - top) * q); lctx.rotate(p.face);
        lctx.globalAlpha = 0.85; lctx.drawImage(coneSpr, 0, -210 * q, 420 * q, 420 * q); lctx.restore();
      }
      for (const f of G.fires) { const r = 330 + Math.sin(tm * 11 + f.tx) * 14; if (f.x > left - r && f.x < right + r && f.y > top - r && f.y < bot + r) hole(f.x, f.y, r, 0.95); }
      lctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lc, 0, 0, V.w, V.h);
    }
    // тёплое свечение костров
    ctx.setTransform(z, 0, 0, z, -left * z, -top * z);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of G.fires) {
      if (f.x < left - 200 || f.x > right + 200 || f.y < top - 200 || f.y > bot + 200) continue;
      const r = 150 + nt * 110 + Math.sin(tm * 13 + f.tx) * 8; ctx.globalAlpha = 0.35 + nt * 0.3;
      ctx.drawImage(glowSpr, f.x - r, f.y - r * 0.8, r * 2, r * 1.6);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // дождь
    const rn = G.rain;
    if (rn > 0.02) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(14,22,30,' + rn * 0.22 + ')'; ctx.fillRect(0, 0, V.w, V.h);
      ctx.strokeStyle = 'rgba(190,205,220,' + (0.16 + rn * 0.2) + ')'; ctx.lineWidth = Math.max(1, z * 0.9); ctx.beginPath();
      const nd = Math.round(90 * rn), L = 30 * z;
      for (let i = 0; i < nd; i++) {
        const rx = (i * 197.3 + tm * 260 + cx * z * -1) % (V.w + 80), ry = (i * 113.7 + tm * (1500 + (i % 7) * 60) - cy * z) % (V.h + 60);
        const ax = (rx + V.w + 80) % (V.w + 80) - 40, ay = (ry + V.h + 60) % (V.h + 60) - 30;
        ctx.moveTo(ax, ay); ctx.lineTo(ax - L * 0.22, ay + L);
      }
      ctx.stroke();
      if (dt > 0 && Math.random() < rn * 0.8) part(left + Math.random() * hw * 2, top + Math.random() * hh * 2, 0, 0, 0.25, 3, 'rgba(200,215,230,.5)', 0);
      ctx.setTransform(z, 0, 0, z, -left * z, -top * z);
    }
    // всплывающий текст
    const fl = G.floaters;
    if (fl.length) {
      ctx.font = '800 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(15,18,12,.85)';
      for (const f of fl) { ctx.globalAlpha = Math.min(1, f.life * 2.2); ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
      ctx.globalAlpha = 1;
    }
  };
})();
