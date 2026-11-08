/* Курьер миров — движок: физика, герой, враги, боссы, столкновения, камера, отрисовка кадра. */
(function () {
  'use strict';
  const K = window.K, T = K.T, TS = 32;
  K.VW = 960; K.VH = 544;
  const E = (K.ENGINE = {});
  const GFX = K.GFX, AU = K.AUDIO;

  const PH = { grav: 0.6, maxFall: 13, run: 4.4, accG: 0.75, accA: 0.5, fricG: 0.75, fricA: 0.14, iceAcc: 0.13, iceFric: 0.035, jump: -11.6, djump: -10.4, cut: -3.6, dashV: 10, dashT: 12, bounce: -16.5, wallVy: -10.6, wallVx: 5.4, slide: 2.4, coyote: 7, buffer: 8 };
  E.PH = PH;
  E.input = { left: false, right: false, jump: false, jumpPressed: false, dash: false, dashPressed: false, fire: false, firePressed: false, down: false };

  let L = null, S = null, crumble = new Map();
  E.state = () => S;
  E.level = () => L;

  const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const tAt = (cx, cy) => (cx < 0 || cx >= L.w ? T.BLOCK : cy < 0 || cy >= L.h ? T.EMPTY : L.tiles[cy * L.w + cx]);
  function solidAt(cx, cy) {
    if (cx < 0 || cx >= L.w) return true;
    if (cy < 0 || cy >= L.h) return false;
    const i = cy * L.w + cx, v = L.tiles[i];
    if (v === T.CRUMBLE) { const s = crumble.get(i); return !(s && s.gone); }
    return v === T.GROUND || v === T.BLOCK || v === T.ICE || v === T.BOUNCE || v === T.CONV_L || v === T.CONV_R || v === T.BREAK;
  }
  function moveX(o, dx) {
    o.x += dx;
    const y0 = Math.floor(o.y / TS), y1 = Math.floor((o.y + o.h - 0.01) / TS);
    if (dx > 0) { const cx = Math.floor((o.x + o.w - 0.01) / TS); for (let y = y0; y <= y1; y++) if (solidAt(cx, y)) { o.x = cx * TS - o.w; return 1; } }
    else if (dx < 0) { const cx = Math.floor(o.x / TS); for (let y = y0; y <= y1; y++) if (solidAt(cx, y)) { o.x = (cx + 1) * TS; return -1; } }
    return 0;
  }
  function moveY(o, dy, noOneWay) {
    const prevBottom = o.y + o.h;
    o.y += dy;
    const x0 = Math.floor(o.x / TS), x1 = Math.floor((o.x + o.w - 0.01) / TS);
    if (dy > 0) {
      const cy = Math.floor((o.y + o.h - 0.01) / TS);
      for (let x = x0; x <= x1; x++) if (solidAt(x, cy) || (!noOneWay && tAt(x, cy) === T.PLAT && prevBottom <= cy * TS + 0.5)) { o.y = cy * TS - o.h; return 1; }
    } else if (dy < 0) {
      const cy = Math.floor(o.y / TS);
      for (let x = x0; x <= x1; x++) if (solidAt(x, cy)) { o.y = (cy + 1) * TS; return -1; }
    }
    return 0;
  }

  /* ---------- частицы ---------- */
  function burst(x, y, n, cols, sp, g) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (sp || 3) * (0.4 + Math.random());
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 30 + Math.random() * 20, max: 50, s: 3 + Math.floor(Math.random() * 3), c: cols[i % cols.length], g: g === undefined ? 0.15 : g });
    }
  }
  function dust(x, y) { for (let i = 0; i < 5; i++) S.parts.push({ x: x + Math.random() * 16 - 8, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.2, life: 18, max: 18, s: 3, c: 'rgba(230,230,230,0.7)', g: 0 }); }

  function pop(text, x, y) { S.pops.push({ text, x, y, life: 55 }); }

  /* ---------- погоня ---------- */
  // Преследователь держится позади: если герой бежит, он отстаёт за экран; если стоит — быстро нагоняет.
  function updateChase() {
    const c = S.chase, P = S.P;
    if (!c || S.done) return;
    if (c.wait > 0) { c.wait--; return; }
    const gap = P.x - c.x;
    c.x += c.speed + (gap > 560 ? 1.3 : gap > 380 ? 0.5 : 0);
    if (gap < 260) S.shake = Math.max(S.shake, 2);
    if (S.t % 3 === 0) S.parts.push({ x: c.x - 6, y: Math.random() * K.VH, vx: 1 + Math.random() * 2, vy: (Math.random() - 0.5) * 2, life: 26, max: 26, s: 4, c: GFX.chaseColor(c.kind), g: 0.05 });
    if (P.x + 4 < c.x) die();
  }

  /* ---------- загрузка уровня ---------- */
  const ENEMY_SIZE = { knight: [24, 30], yeti: [24, 26], imp: [24, 24], shade: [24, 24], drone: [24, 18], goblin: [24, 24], archer: [24, 24], plant: [24, 24], iceturret: [24, 24], turret: [24, 24], eye: [24, 24] };
  function spawnEnemy(e) {
    const isFly = e.kind === 'fly';
    const [w, h] = ENEMY_SIZE[e.skin] || (isFly ? [24, 16] : [24, 20]);
    const o = { t: 'enemy', kind: e.kind, skin: e.skin, w, h, x: e.x * TS + (TS - w) / 2, y: (e.y + 1) * TS - h, vx: 0, vy: 0, dir: -1, hp: e.skin === 'yeti' || e.skin === 'knight' ? 2 : 1, timer: 60 + Math.floor(Math.random() * 60), stun: 0, hurt: 0, alive: true, onGround: false, speed: { wolf: 1.6, dog: 1.3, imp: 1.5, shade: 1.2, slime: 0.8, yeti: 0.9, knight: 0.9 }[e.skin] || 1.1, ft: Math.random() * 300 };
    if (isFly) { o.x0 = o.x; o.y0 = e.y * TS; o.y = o.y0; o.range = 60 + Math.random() * 40; }
    S.ents.push(o);
    return o;
  }

  E.load = function (wid, stage, keep) {
    L = K.generate(wid, stage);
    GFX.setWorld(wid);
    crumble = new Map();
    const world = K.worldById(wid);
    S = {
      world: wid, stage, title: L.boss ? world.bossName : `${wid}-${stage} · ${world.name}`, ents: [], shots: [], parts: [], movers: [],
      cam: { x: 0 }, t: 0, time: 0, coins: 0, totalCoins: L.totalCoins, shards: [false, false, false], deaths: keep ? keep.deaths : 0,
      hp: 3, maxHp: 3, cp: null, done: false, boss: null, bossName: world.bossName, shake: 0, abil: L.abilities, sign: null, freeze: 0, banner: null, lava: null, flash: 0,
      chase: L.chase ? { x: -480, wait: 170, speed: L.chase.speed, kind: L.chase.kind } : null, stop: 0, combo: 0, pops: [],
    };
    for (const e of L.ents) {
      const px = e.x * TS, py = e.y * TS;
      switch (e.t) {
        case 'coin': S.ents.push({ t: 'coin', x: px + 6, y: py + 4, w: 20, h: 24 }); break;
        case 'shard': S.ents.push({ t: 'shard', i: e.i, x: px + 4, y: py, w: 24, h: 30 }); break;
        case 'heart': S.ents.push({ t: 'heart', x: px + 6, y: py + 8, w: 22, h: 20 }); break;
        case 'flag': S.ents.push({ t: 'flag', x: px, y: py, w: 28, h: 32, on: false }); break;
        case 'portal': S.ents.push({ t: 'portal', x: px, y: py, w: 32, h: 32 }); break;
        case 'sign': S.ents.push({ t: 'sign', x: px, y: py, w: 30, h: 32, text: e.text }); break;
        case 'icicle': S.ents.push({ t: 'icicle', x: px + 4, y: py, w: 24, h: 30, state: 0, vy: 0, timer: 0, alive: true }); break;
        case 'firejet': S.ents.push({ t: 'firejet', x: px, y: py, w: 32, h: 32, phase: e.phase || 0, state: 0 }); break;
        case 'mover': { const m = { t: 'mover', x: px, y: py, x0: px, y0: py, w: e.w * TS, h: 12, axis: e.axis, range: e.range * TS, speed: e.speed, dir: 1, dx: 0, dy: 0, py: py }; S.movers.push(m); S.ents.push(m); break; }
        case 'enemy': spawnEnemy(e); break;
        case 'boss': S.boss = makeBoss(e.kind, e.x, e.y); break;
      }
    }
    const P = { x: L.start.x * TS + 6, y: (L.start.y + 1) * TS - 30, w: 20, h: 30, vx: 0, vy: 0, onGround: false, coyote: 0, buf: 0, facing: 1, djUsed: false, dashT: 0, dashCd: 0, dashUsed: false, fireCd: 0, inv: 0, wallDir: 0, wallSlide: false, wallLock: 0, surf: 0, on: null, bounced: false };
    S.P = P;
    S.cp = { x: P.x, y: P.y };
    if (S.boss) S.banner = { text: world.bossName, t: 140 };
    else if (L.chase) S.banner = { text: `${wid}-${stage}  ${L.chase.name}`, sub: L.chase.note, t: 150 };
    else S.banner = { text: `${wid}-${stage}  ${world.name}`, t: 110 };
    return S;
  };

  /* ---------- урон и смерть ---------- */
  function hurt(fromX) {
    const P = S.P;
    if (P.inv > 0 || P.dashT > 0 || S.freeze) return;
    S.hp--;
    P.inv = 90;
    P.vy = -6;
    P.vx = (P.x + P.w / 2 < fromX ? -1 : 1) * 4;
    P.wallLock = 12;
    S.shake = 8;
    AU.sfx('hurt');
    if (S.hp <= 0) die();
  }
  function die() {
    if (S.freeze) return;
    AU.sfx('die');
    S.deaths++;
    burst(S.P.x + 10, S.P.y + 15, 18, ['#f2c230', '#2fae5c', '#ffffff'], 4);
    S.freeze = 55;
    S.dead = true;
  }
  function respawn() {
    if (L.boss) { const d = S.deaths; E.load(S.world, S.stage, { deaths: d }); return; }
    const P = S.P;
    P.x = S.cp.x; P.y = S.cp.y; P.vx = 0; P.vy = 0; P.inv = 70; P.dashT = 0;
    S.hp = S.maxHp;
    S.dead = false;
    S.combo = 0;
    if (S.chase) { S.chase.x = Math.min(S.chase.x, S.cp.x - 460); S.chase.wait = 110; }
    for (const e of S.shots) e.life = 0;
  }

  /* ---------- герой ---------- */
  function updatePlayer() {
    const P = S.P, I = E.input, ab = S.abil;
    let want = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    if (P.wallLock > 0) P.wallLock--;
    const ice = P.onGround && P.surf === T.ICE;
    if (P.dashT > 0) {
      P.dashT--;
      P.vx = P.facing * PH.dashV; P.vy = 0;
      if (S.t % 2 === 0) S.parts.push({ x: P.x + 10, y: P.y + 10 + Math.random() * 10, vx: -P.facing, vy: 0, life: 14, max: 14, s: 4, c: 'rgba(255,255,255,0.6)', g: 0 });
    } else {
      const maxRun = PH.run * (ice ? 1.25 : 1);
      const acc = P.onGround ? (ice ? PH.iceAcc : PH.accG) : PH.accA;
      const fric = P.onGround ? (ice ? PH.iceFric : PH.fricG) : PH.fricA;
      if (want && P.wallLock <= 0) {
        P.facing = want;
        if (P.vx * want < maxRun) P.vx = Math.min(maxRun, Math.abs(P.vx + want * acc)) * Math.sign(P.vx + want * acc || want);
      } else if (P.wallLock <= 0) {
        if (Math.abs(P.vx) <= fric) P.vx = 0; else P.vx -= Math.sign(P.vx) * fric;
      }
      if (Math.abs(P.vx) > maxRun && P.wallLock <= 0) P.vx -= Math.sign(P.vx) * 0.25;
      P.vy = Math.min(P.wallSlide ? PH.slide : PH.maxFall, P.vy + PH.grav);
    }
    // прыжки
    if (I.jumpPressed) P.buf = PH.buffer; else if (P.buf > 0) P.buf--;
    if (P.onGround) { P.coyote = PH.coyote; P.djUsed = false; P.dashUsed = false; } else if (P.coyote > 0) P.coyote--;
    if (P.buf > 0 && P.dashT <= 0) {
      if (P.coyote > 0) { P.vy = PH.jump; P.coyote = 0; P.buf = 0; P.onGround = false; P.on = null; AU.sfx('jump'); dust(P.x + 10, P.y + P.h); }
      else if (ab.wall && P.wallDir) { P.vy = PH.wallVy; P.vx = -P.wallDir * PH.wallVx; P.facing = -P.wallDir; P.wallLock = 10; P.buf = 0; P.djUsed = false; AU.sfx('jump'); dust(P.x + (P.wallDir > 0 ? P.w : 0), P.y + 15); }
      else if (ab.double && !P.djUsed) { P.vy = PH.djump; P.djUsed = true; P.buf = 0; AU.sfx('djump'); burst(P.x + 10, P.y + P.h, 8, ['#ffffff', '#bfe8fa'], 2, 0); }
    }
    if (!I.jump && P.vy < PH.cut && !P.bounced) P.vy = PH.cut;
    if (P.vy >= 0) P.bounced = false;
    // рывок
    if (P.dashCd > 0) P.dashCd--;
    if (ab.dash && I.dashPressed && P.dashCd <= 0 && !P.dashUsed && P.dashT <= 0) {
      P.dashT = PH.dashT; P.dashCd = 28; if (!P.onGround) P.dashUsed = true;
      AU.sfx('dash');
    }
    // огненный шар
    if (P.fireCd > 0) P.fireCd--;
    if (ab.fire && I.firePressed && P.fireCd <= 0) {
      S.shots.push({ kind: 'fireball', owner: 'p', x: P.x + (P.facing > 0 ? P.w : -14), y: P.y + 8, w: 14, h: 14, vx: P.facing * 7.5, vy: -1.5, grav: 0.35, bounces: 3, life: 110 });
      P.fireCd = 22;
      AU.sfx('fire');
    }
    // движение по X
    const push = P.onGround ? (P.surf === T.CONV_L ? -1.7 : P.surf === T.CONV_R ? 1.7 : 0) : 0;
    const hx = moveX(P, P.vx + push + (P.on ? P.on.dx : 0));
    if (hx && P.dashT > 0) breakWall(P, hx);
    // стена
    P.wallDir = 0;
    if (!P.onGround && ab.wall && P.dashT <= 0) {
      const my = Math.floor((P.y + P.h / 2) / TS);
      if (want > 0 && solidAt(Math.floor((P.x + P.w + 1) / TS), my)) P.wallDir = 1;
      else if (want < 0 && solidAt(Math.floor((P.x - 1) / TS), my)) P.wallDir = -1;
    }
    P.wallSlide = P.wallDir !== 0 && P.vy > 0;
    // движение по Y
    const prevBottom = P.y + P.h;
    const wasGround = P.onGround;
    P.onGround = false;
    P.on = null;
    const hy = moveY(P, P.vy);
    if (hy > 0) {
      P.onGround = true;
      if (P.vy > 7) dust(P.x + 10, P.y + P.h);
      P.vy = 0;
    } else if (hy < 0) P.vy = 0;
    for (const m of S.movers) {
      if (P.vy >= 0 && P.x + P.w > m.x + 2 && P.x < m.x + m.w - 2 && prevBottom <= m.py + 6 && P.y + P.h >= m.y - 3) {
        P.y = m.y - P.h; P.vy = 0; P.onGround = true; P.on = m;
      }
    }
    // поверхность под ногами
    P.surf = 0;
    if (P.onGround && !P.on) {
      const cy = Math.floor((P.y + P.h + 1) / TS);
      const cxs = [Math.floor((P.x + 2) / TS), Math.floor((P.x + P.w - 2) / TS)];
      for (const cx of cxs) {
        const v = tAt(cx, cy);
        if (v === T.CRUMBLE) { const i = cy * L.w + cx; const s = crumble.get(i) || { t: 0, gone: false, back: 0 }; if (!s.gone && s.t === 0) { s.t = 1; crumble.set(i, s); } }
        if (v && v !== T.PLAT) P.surf = P.surf || v;
      }
      if (cxs.some((cx) => tAt(cx, cy) === T.BOUNCE) && !wasGround) {
        P.vy = I.jump ? PH.bounce - 1.5 : PH.bounce; P.onGround = false; P.bounced = true; P.djUsed = false; P.dashUsed = false;
        AU.sfx('spring');
        burst(P.x + 10, P.y + P.h, 8, [GFX.pal().accent, '#ffffff'], 2.5);
      }
    }
    // опасные тайлы
    const x0 = Math.floor((P.x + 3) / TS), x1 = Math.floor((P.x + P.w - 3) / TS), y0 = Math.floor((P.y + 4) / TS), y1 = Math.floor((P.y + P.h - 1) / TS);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = tAt(x, y);
      if (v === T.HAZARD && P.y + P.h > y * TS + 8) { die(); return; }
      if (v === T.SPIKE && P.y + P.h > y * TS + 12) { hurt(P.x + P.w / 2 + (P.vx > 0 ? 20 : -20)); if (!S.freeze) P.vy = -9; }
    }
    if (P.y > L.h * TS + 40) die();
    if (P.inv > 0) P.inv--;
  }

  function breakWall(o, dir) {
    const cx = dir > 0 ? Math.floor((o.x + o.w + 1) / TS) : Math.floor((o.x - 1) / TS);
    let broke = false;
    for (let y = Math.floor(o.y / TS) - 1; y <= Math.floor((o.y + o.h) / TS); y++) if (tAt(cx, y) === T.BREAK) { L.tiles[y * L.w + cx] = T.EMPTY; broke = true; burst(cx * TS + 16, y * TS + 16, 6, ['#bfe8fa', '#ffffff', '#a07a4a'], 3); }
    if (broke) AU.sfx('break');
    return broke;
  }

  /* ---------- платформы и ловушки ---------- */
  function updateMovers() {
    for (const m of S.movers) {
      m.py = m.y;
      const ox = m.x, oy = m.y;
      if (m.axis === 'x') { m.x += m.speed * m.dir; if (m.x > m.x0 + m.range) { m.x = m.x0 + m.range; m.dir = -1; } if (m.x < m.x0) { m.x = m.x0; m.dir = 1; } }
      else { m.y -= m.speed * m.dir; if (m.y < m.y0 - m.range) { m.y = m.y0 - m.range; m.dir = -1; } if (m.y > m.y0) { m.y = m.y0; m.dir = 1; } }
      m.dx = m.x - ox; m.dy = m.y - oy;
    }
  }
  function updateCrumble() {
    for (const [i, s] of crumble) {
      if (s.gone) { s.back--; if (s.back <= 0) { const cx = i % L.w, cy = Math.floor(i / L.w); const P = S.P; if (!ov(P, { x: cx * TS, y: cy * TS, w: TS, h: TS })) crumble.delete(i); else s.back = 20; } }
      else if (s.t > 0) { s.t++; if (s.t > 28) { s.gone = true; s.back = 220; const cx = i % L.w, cy = Math.floor(i / L.w); burst(cx * TS + 16, cy * TS + 16, 5, [GFX.pal().block, GFX.pal().blockDark], 2); } }
    }
  }

  /* ---------- враги ---------- */
  function shoot(e, P) {
    const cx = e.x + e.w / 2, cy = e.y + 6, px = P.x + P.w / 2, py = P.y + P.h / 2;
    const dx = px - cx, dy = py - cy, dist = Math.hypot(dx, dy) || 1;
    const aim = (sp) => ({ vx: (dx / dist) * sp, vy: (dy / dist) * sp });
    let s;
    switch (e.skin) {
      case 'goblin': s = { kind: 'spear', vx: Math.sign(dx) * 4.5, vy: -6, grav: 0.22, w: 26, h: 10 }; break;
      case 'plant': s = { kind: 'seed', vx: Math.sign(dx) * Math.min(5, Math.abs(dx) / 40), vy: -7, grav: 0.3, w: 12, h: 12 }; break;
      case 'archer': s = { kind: 'arrow', vx: Math.sign(dx) * 5.5, vy: 0, grav: 0, w: 22, h: 10 }; break;
      case 'turret': s = { kind: 'fire', vx: Math.sign(dx) * 5, vy: 0, grav: 0, w: 12, h: 12 }; break;
      case 'drone': s = Object.assign({ kind: 'laser', grav: 0, w: 8, h: 4 }, aim(5)); break;
      case 'iceturret': s = Object.assign({ kind: 'ice', grav: 0, w: 12, h: 12 }, aim(4.2)); break;
      default: s = Object.assign({ kind: 'orb', grav: 0, w: 14, h: 14 }, aim(3.8));
    }
    s.x = cx - s.w / 2; s.y = cy; s.owner = 'e'; s.life = 200;
    S.shots.push(s);
    AU.sfx('shoot');
  }
  function killEnemy(e, dir) {
    e.alive = false;
    burst(e.x + e.w / 2, e.y + e.h / 2, 12, ['#ffffff', '#ffd56b', GFX.pal().accent], 3.5);
    AU.sfx('stomp');
  }
  function updateEnemies() {
    const P = S.P;
    for (const e of S.ents) {
      if (e.t !== 'enemy' || !e.alive) continue;
      e.ft++;
      if (e.hurt > 0) e.hurt--;
      if (Math.abs(e.x - P.x) > K.VW * 1.3) continue; // далёкие враги спят
      switch (e.kind) {
        case 'walk': case 'charge': {
          if (e.stun > 0) { e.stun--; e.vx = 0; }
          else if (e.kind === 'charge' && e.charging) { e.vx = e.dir * 6; }
          else if (e.kind === 'charge' && e.wind > 0) { e.wind--; e.vx = 0; if (e.wind === 0) e.charging = true; }
          else {
            e.vx = e.dir * e.speed;
            if (e.kind === 'charge' && Math.abs(P.x - e.x) < 220 && Math.abs(P.y - e.y) < 40) { e.dir = Math.sign(P.x - e.x) || 1; e.wind = 24; }
          }
          e.vy = Math.min(PH.maxFall, e.vy + PH.grav);
          const hit = moveX(e, e.vx);
          e.onGround = moveY(e, e.vy) > 0;
          if (e.onGround) e.vy = 0;
          const fx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
          const edge = e.onGround && !solidAt(Math.floor(fx / TS), Math.floor((e.y + e.h + 4) / TS)) && tAt(Math.floor(fx / TS), Math.floor((e.y + e.h + 4) / TS)) !== T.PLAT;
          if (hit || edge) { if (e.charging) { e.charging = false; e.stun = 70; S.shake = 4; } e.dir *= -1; }
          if (e.y > L.h * TS) e.alive = false;
          break;
        }
        case 'fly': {
          e.x = e.x0 + Math.sin(e.ft * 0.02) * e.range;
          e.y = e.y0 + Math.sin(e.ft * 0.05) * 18;
          e.dir = Math.cos(e.ft * 0.02) >= 0 ? 1 : -1;
          break;
        }
        case 'jump': {
          e.vy = Math.min(PH.maxFall, e.vy + PH.grav);
          if (e.onGround) { e.vx = 0; e.timer--; if (e.timer <= 0) { e.vy = -9.5; e.dir = Math.sign(P.x - e.x) || 1; e.vx = e.dir * 2.2; e.timer = 70 + Math.floor(Math.random() * 50); } }
          moveX(e, e.vx);
          e.onGround = moveY(e, e.vy) > 0;
          if (e.onGround) e.vy = 0;
          if (e.y > L.h * TS) e.alive = false;
          break;
        }
        case 'shoot': {
          e.dir = P.x < e.x ? -1 : 1;
          e.vy = Math.min(PH.maxFall, e.vy + PH.grav);
          if (e.skin !== 'drone' && e.skin !== 'eye') { if (moveY(e, e.vy) > 0) e.vy = 0; }
          else { e.y = e.y + Math.sin(e.ft * 0.05) * 0.5; e.vy = 0; }
          e.timer--;
          if (e.timer <= 0) { if (Math.abs(P.x - e.x) < 360 && Math.abs(P.y - e.y) < 260) shoot(e, P); e.timer = 120 - S.world * 6 + Math.floor(Math.random() * 30); }
          break;
        }
      }
      // столкновение с героем
      if (!S.freeze && ov(P, e)) {
        if (P.dashT > 0) killEnemy(e);
        else if (P.vy > 0 && P.y + P.h - P.vy <= e.y + 10) {
          e.hp--;
          if (e.hp <= 0) killEnemy(e); else { e.hurt = 24; AU.sfx('stomp'); }
          S.combo++; S.stop = 3;
          if (S.combo >= 2) pop(['', '', 'Дважды!', 'Трижды!', 'Четыре!', 'Пять!'][Math.min(S.combo, 5)] || 'Серия!', e.x + e.w / 2, e.y - 6);
          P.vy = E.input.jump ? -12.5 : -8.5; P.bounced = true; P.djUsed = false; P.dashUsed = false;
        } else hurt(e.x + e.w / 2);
      }
    }
  }

  function updateHazards() {
    const P = S.P;
    for (const e of S.ents) {
      if (e.t === 'icicle' && e.alive) {
        if (e.state === 0 && Math.abs(P.x + P.w / 2 - (e.x + 12)) < 44 && P.y > e.y) { e.state = 1; e.timer = 22; }
        else if (e.state === 1) { if (--e.timer <= 0) e.state = 2; }
        else if (e.state === 2) {
          e.vy = Math.min(14, e.vy + 0.6); e.y += e.vy;
          if (solidAt(Math.floor((e.x + 12) / TS), Math.floor((e.y + e.h) / TS))) { e.alive = false; burst(e.x + 12, e.y + e.h, 8, ['#d8f2ff', '#ffffff'], 2.5); AU.sfx('break'); }
        }
        if (e.alive && ov(P, { x: e.x + 4, y: e.y, w: 16, h: e.h })) { if (P.dashT > 0) { e.alive = false; burst(e.x + 12, e.y + 15, 6, ['#ffffff'], 2); } else hurt(e.x + 12); }
      } else if (e.t === 'firejet') {
        const c = (S.t + e.phase) % 200;
        e.state = c < 100 ? 0 : c < 130 ? 1 : 2;
        if (e.state === 2 && ov(P, { x: e.x + 8, y: e.y - 80, w: 16, h: 96 })) hurt(e.x + 16);
      }
    }
  }

  /* ---------- снаряды ---------- */
  function updateShots() {
    const P = S.P;
    for (const s of S.shots) {
      if (s.life <= 0) continue;
      s.life--;
      if (s.kind === 'warn' || s.kind === 'beam' || s.kind === 'root') {
        if (s.kind === 'warn' && s.life === 0 && s.then) S.shots.push(s.then);
        if ((s.kind === 'beam' || s.kind === 'root') && ov(P, s)) hurt(s.x + s.w / 2);
        continue;
      }
      s.vy += s.grav || 0;
      s.x += s.vx; s.y += s.vy;
      const cx = Math.floor((s.x + s.w / 2) / TS), cy = Math.floor((s.y + s.h / 2) / TS);
      if (s.owner === 'p') {
        if (solidAt(cx, cy)) {
          if (tAt(cx, cy) === T.BREAK) { L.tiles[cy * L.w + cx] = T.EMPTY; burst(cx * TS + 16, cy * TS + 16, 8, ['#bfe8fa', '#ffffff'], 3); AU.sfx('break'); s.life = 0; continue; }
          if (s.vy > 0 && s.bounces > 0) { s.y = cy * TS - s.h; s.vy = -4.6; s.bounces--; }
          else { s.life = 0; burst(s.x, s.y, 5, ['#ffb02a', '#ff6a1a'], 2); continue; }
        }
        for (const e of S.ents) if (e.t === 'enemy' && e.alive && ov(s, e)) { killEnemy(e); s.life = 0; break; }
        if (S.boss && S.boss.hp > 0 && ov(s, S.boss) && s.life > 0) { if (S.boss.fireOk) hitBoss(S.boss); s.life = 0; burst(s.x, s.y, 6, ['#ffb02a'], 2); }
        continue;
      }
      if (s.kind === 'shock') { if (s.x < 0 || s.x > L.w * TS) s.life = 0; }
      else if (solidAt(cx, cy) || s.y > L.h * TS) { s.life = 0; if (s.kind === 'ice') burst(s.x, s.y, 5, ['#ffffff'], 2); continue; }
      if (ov(P, s)) {
        if (P.dashT > 0 && s.kind !== 'shock') { s.life = 0; continue; }
        hurt(s.x + s.w / 2);
        if (s.kind !== 'shock') s.life = 0;
      }
    }
    S.shots = S.shots.filter((s) => s.life > 0);
  }

  /* ---------- предметы ---------- */
  function updatePickups() {
    const P = S.P;
    S.sign = null;
    for (const e of S.ents) {
      if (e.taken) continue;
      if (e.t === 'sign') { if (Math.abs(P.x - e.x) < 70 && Math.abs(P.y - e.y) < 80) S.sign = e; continue; }
      if (!ov(P, e.t === 'portal' ? { x: e.x, y: e.y - 40, w: 32, h: 72 } : e)) continue;
      switch (e.t) {
        case 'coin': e.taken = true; S.coins++; AU.sfx('coin'); burst(e.x + 10, e.y + 10, 4, [GFX.pal().light, '#ffffff'], 1.5); break;
        case 'shard': e.taken = true; S.shards[e.i] = true; AU.sfx('shard'); S.flash = 12; pop(`Осколок ${S.shards.filter(Boolean).length}/3`, e.x + 12, e.y - 8); burst(e.x + 12, e.y + 14, 16, ['#b48aff', '#ffffff', '#ff6ad8'], 3.5); break;
        case 'heart': if (S.hp < S.maxHp) { e.taken = true; S.hp++; AU.sfx('heart'); } break;
        case 'flag': if (!e.on) { e.on = true; S.cp = { x: e.x, y: e.y + 32 - P.h }; AU.sfx('checkpoint'); burst(e.x + 14, e.y - 20, 10, ['#2fae5c', '#ffffff'], 2.5); } break;
        case 'portal': complete(); break;
      }
    }
  }

  /* ---------- боссы ---------- */
  const FLOOR = 14 * TS;
  const BOSS_DEF = { pigeon: [78, 56, 3], wolf: [80, 52, 4], knight: [56, 72, 5], treant: [120, 160, 5], serpent: [94, 34, 6], golem: [96, 120, 7], keeper: [48, 64, 10] };
  function makeBoss(kind, cx, cy) {
    const [w, h, hp] = BOSS_DEF[kind];
    const b = { kind, w, h, hp, maxHp: hp, x: cx * TS - w / 2, y: FLOOR - h, vx: 0, vy: 0, dir: -1, st: 'intro', t: 0, inv: 0, stun: 0, vuln: false, fireOk: false, warn: 0, cycle: 0, open: false };
    if (kind === 'treant') b.x = 28 * TS - w - 8;
    if (kind === 'pigeon' || kind === 'serpent') b.y = 110;
    return b;
  }
  const go = (b, st) => { b.st = st; b.t = 0; };
  function bossGravity(b) {
    b.vy = Math.min(14, b.vy + PH.grav);
    b.x += b.vx;
    b.y += b.vy;
    let landed = false;
    if (b.y + b.h >= FLOOR) { b.y = FLOOR - b.h; b.vy = 0; landed = true; }
    if (b.x < TS) { b.x = TS; b.vx = 0; }
    if (b.x + b.w > 29 * TS) { b.x = 29 * TS - b.w; b.vx = 0; }
    return landed;
  }
  function hitBoss(b) {
    if (b.inv > 0 || b.hp <= 0) return;
    b.hp--;
    b.inv = 50;
    S.shake = 10;
    S.stop = 7;
    AU.sfx('bossHit');
    burst(b.x + b.w / 2, b.y + b.h / 3, 14, ['#ffffff', '#ffd56b', '#ff4f6a'], 4);
    if (b.hp <= 0) {
      AU.sfx('bossDie');
      burst(b.x + b.w / 2, b.y + b.h / 2, 40, ['#ffffff', '#ffd56b', '#ff4f6a', '#b48aff'], 6);
      S.bossDead = true;
      S.freeze = 100;
      for (const s of S.shots) s.life = 0;
      for (const e of S.ents) if (e.t === 'enemy') e.alive = false;
    }
  }
  function enemyShot(kind, x, y, vx, vy, grav, w, h, life) { S.shots.push({ kind, owner: 'e', x, y, vx, vy, grav: grav || 0, w: w || 12, h: h || 12, life: life || 240 }); }

  function updateBoss() {
    const b = S.boss, P = S.P;
    if (!b || b.hp <= 0) return;
    b.t++;
    if (b.inv > 0) b.inv--;
    if (b.warn > 0) b.warn--;
    const toP = Math.sign(P.x + P.w / 2 - (b.x + b.w / 2)) || 1;
    const hard = b.hp <= Math.ceil(b.maxHp / 2);
    b.vuln = false; b.fireOk = S.abil.fire;
    if (b.st === 'intro') { if (b.t > 90) go(b, 'a'); return; }
    switch (b.kind) {
      case 'pigeon': {
        if (b.st === 'a') { b.y += (110 + Math.sin(b.t * 0.05) * 30 - b.y) * 0.1; b.x += b.dir * (hard ? 4 : 3); if (b.x < 60) b.dir = 1; if (b.x + b.w > 900) b.dir = -1; if (b.t % 80 === 40) enemyShot('feather', b.x + b.w / 2, b.y + b.h, 0, 3, 0.05, 14, 6); if (hard && b.t % 160 === 80 && S.ents.filter((e) => e.t === 'enemy' && e.alive).length < 2) spawnEnemy({ kind: 'fly', skin: 'pigeon', x: Math.floor(b.x / TS), y: 6 }); if (b.t > 200) { go(b, 'aim'); b.warn = 30; } }
        else if (b.st === 'aim') { b.x += (P.x - b.w / 2 + 10 - b.x) * 0.08; if (b.t > 30) go(b, 'dive'); }
        else if (b.st === 'dive') { b.y += 10; if (b.y + b.h >= FLOOR) { b.y = FLOOR - b.h; S.shake = 8; AU.sfx('slam'); go(b, 'rest'); } }
        else if (b.st === 'rest') { b.vuln = true; b.stun = 1; if (b.t > (hard ? 80 : 110)) { b.stun = 0; go(b, 'rise'); } }
        else if (b.st === 'rise') { b.y -= 5; if (b.y <= 110) go(b, 'a'); }
        b.dir = b.st === 'a' ? b.dir : toP;
        break;
      }
      case 'wolf': {
        if (b.st === 'a') { b.dir = toP; b.vx = 0; bossGravity(b); if (b.t > (hard ? 30 : 50)) { go(b, 'wind'); b.warn = 26; } }
        else if (b.st === 'wind') { bossGravity(b); if (b.t > 26) { go(b, 'charge'); } }
        else if (b.st === 'charge') { b.vx = b.dir * (hard ? 9 : 7.5); bossGravity(b); if (b.x <= TS + 1 || b.x + b.w >= 29 * TS - 1) { S.shake = 10; AU.sfx('slam'); go(b, 'stun'); } }
        else if (b.st === 'stun') { b.vuln = true; b.stun = 1; b.vx = 0; bossGravity(b); if (b.t > 100) { b.stun = 0; go(b, 'leap'); b.vy = -13; b.vx = (480 - (b.x + b.w / 2)) / 40; } }
        else if (b.st === 'leap') { if (bossGravity(b) && b.t > 5) { b.vx = 0; S.shake = 5; go(b, 'a'); } }
        break;
      }
      case 'knight': {
        if (b.st === 'a') { b.dir = toP; b.vx = b.dir * (hard ? 1.8 : 1.3); bossGravity(b); if (b.t > 110) { go(b, 'crouch'); b.warn = 22; b.vx = 0; } }
        else if (b.st === 'crouch') { bossGravity(b); if (b.t > 22) { b.vy = -14; b.vx = (P.x - b.x) / 50; go(b, 'leap'); } }
        else if (b.st === 'leap') { if (bossGravity(b) && b.t > 5) { S.shake = 12; AU.sfx('slam'); b.vx = 0; for (const d of [-1, 1]) enemyShot('shock', b.x + b.w / 2 + d * 30, FLOOR - 26, d * (hard ? 6 : 5), 0, 0, 24, 26, 200); go(b, 'recover'); } }
        else if (b.st === 'recover') { b.vuln = true; b.stun = 1; bossGravity(b); if (b.t > (hard ? 70 : 95)) { b.stun = 0; go(b, 'a'); } }
        break;
      }
      case 'treant': {
        b.dir = -1;
        if (b.st === 'a') { b.open = false; if (b.t > 50) { b.cycle++; go(b, b.cycle % 2 ? 'seeds' : 'roots'); } }
        else if (b.st === 'seeds') { if (b.t % 22 === 1 && b.t < 70) { const n = hard ? 4 : 3; for (let i = 0; i < n; i++) enemyShot('seed', b.x + 20, b.y + 40, -(2 + i * 1.6), -7 - i * 0.6, 0.28); AU.sfx('shoot'); } if (b.t > 90) go(b, 'open'); }
        else if (b.st === 'roots') { if (b.t % 30 === 1 && b.t < 100) { const rx = P.x - 12; S.shots.push({ kind: 'warn', owner: 'e', x: rx, y: FLOOR - 12, w: 44, h: 12, vx: 0, vy: 0, life: 40, then: { kind: 'root', owner: 'e', x: rx + 10, y: FLOOR - 80, w: 24, h: 80, vx: 0, vy: 0, life: 36 } }); } if (b.t > 130) go(b, 'open'); }
        else if (b.st === 'open') { b.open = true; b.vuln = true; if (b.t > (hard ? 90 : 120)) go(b, 'a'); }
        break;
      }
      case 'serpent': {
        b.fireOk = true;
        if (b.st === 'a') {
          const nx = 480 + Math.sin(b.t * 0.014) * 330 - b.w / 2, ny = 120 + Math.sin(b.t * 0.028) * 50;
          b.dir = nx > b.x ? 1 : -1; b.x = nx; b.y = ny;
          if (b.t % (hard ? 90 : 130) === 60) for (let i = 0; i < 3; i++) enemyShot('ice', 80 + Math.random() * 800, 40, 0, 0, 0.35);
          if (b.t > 420) go(b, 'swoop');
        } else if (b.st === 'swoop') { b.y += 6; b.x += b.dir * 3; if (b.y + b.h >= FLOOR) { b.y = FLOOR - b.h; S.shake = 6; go(b, 'rest'); } }
        else if (b.st === 'rest') { b.vuln = true; b.stun = 1; if (b.t > 110) { b.stun = 0; go(b, 'rise'); } }
        else if (b.st === 'rise') { b.y -= 4; if (b.y < 120) go(b, 'a'); }
        break;
      }
      case 'golem': {
        b.open = false;
        if (b.st === 'a') { b.dir = toP; b.vx = b.dir * (hard ? 1.4 : 1); bossGravity(b); if (b.t > 120) { b.cycle++; b.vx = 0; if (b.cycle % 3 === 0) { go(b, 'lava'); b.warn = 40; } else { go(b, 'punch'); b.warn = 20; } } }
        else if (b.st === 'punch') { bossGravity(b); if (b.t === 20) { AU.sfx('slam'); S.shake = 6; } if (b.t >= 20 && b.t < 40) { const fx = b.dir > 0 ? b.x + b.w : b.x - 80; if (ov(P, { x: fx, y: b.y + 30, w: 80, h: 40 })) hurt(b.x + b.w / 2); } if (b.t > 40) go(b, 'open'); }
        else if (b.st === 'open') { b.open = true; b.vuln = true; bossGravity(b); if (b.t > 85) go(b, 'a'); }
        else if (b.st === 'lava') {
          bossGravity(b);
          const target = b.t < 40 ? 0 : b.t < 220 ? 1 : 0;
          S.lava = S.lava || { y: K.VH };
          S.lava.y += ((target ? FLOOR - 20 : K.VH) - S.lava.y) * 0.05;
          if (b.t > 260) { S.lava = null; go(b, 'open'); }
        }
        break;
      }
      case 'keeper': {
        b.fireOk = true;
        const spots = [[4, 10], [24, 10], [14, 7], [10, 14], [19, 14]];
        if (b.st === 'a') { b.warn = 0; if (b.t === 1) { const s = spots[Math.floor(Math.random() * spots.length)]; b.tx = s[0] * TS; b.ty = s[1] * TS - b.h; } b.x += (b.tx - b.x) * 0.15; b.y += (b.ty - b.y) * 0.15; b.dir = toP; if (b.t > 40) { b.cycle++; const opts = hard ? ['volley', 'summon', 'beams', 'volley', 'slam'] : ['volley', 'summon', 'slam']; go(b, opts[b.cycle % opts.length]); b.warn = 20; } }
        else if (b.st === 'volley') { if (b.t === 20 || (hard && b.t === 45)) { const px = P.x + P.w / 2, py = P.y + P.h / 2, cx = b.x + b.w / 2, cy = b.y + 20; const base = Math.atan2(py - cy, px - cx); for (let i = -2; i <= 2; i++) { const a = base + i * 0.22; enemyShot('orb', cx, cy, Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0, 14, 14); } AU.sfx('shoot'); } if (b.t > 60) go(b, 'tired'); }
        else if (b.st === 'summon') { if (b.t === 20 && S.ents.filter((e) => e.t === 'enemy' && e.alive).length < 3) for (const sx of [6, 22]) spawnEnemy({ kind: 'fly', skin: 'wisp', x: sx, y: 6 }); if (b.t > 40) go(b, 'tired'); }
        else if (b.st === 'slam') { if (b.t < 20) b.y -= 2; else { b.y += 9; if (b.y + b.h >= FLOOR) { b.y = FLOOR - b.h; S.shake = 10; AU.sfx('slam'); for (const d of [-1, 1]) enemyShot('shock', b.x + b.w / 2 + d * 20, FLOOR - 26, d * 6, 0, 0, 24, 26, 200); go(b, 'tired'); } } }
        else if (b.st === 'beams') { if (b.t === 1) { for (let i = 0; i < 3; i++) { const bx = Math.max(40, Math.min(880, P.x - 100 + i * 100 + Math.random() * 30)); S.shots.push({ kind: 'warn', owner: 'e', x: bx, y: 40, w: 40, h: K.VH - 40, vx: 0, vy: 0, life: 50, then: { kind: 'beam', owner: 'e', x: bx + 6, y: 0, w: 28, h: K.VH, vx: 0, vy: 0, life: 30 } }); } } if (b.t > 90) go(b, 'tired'); }
        else if (b.st === 'tired') { b.vuln = true; b.stun = 1; if (b.t > (hard ? 60 : 85)) { b.stun = 0; go(b, 'a'); } }
        break;
      }
    }
    // столкновение с героем
    const hitbox = b.kind === 'treant' ? { x: b.x + 20, y: b.y, w: b.w - 40, h: b.h } : b;
    if (!S.freeze && ov(P, hitbox)) {
      const head = b.kind === 'treant' ? P.y + P.h - P.vy <= b.y + 40 : P.y + P.h - P.vy <= b.y + 14;
      if (P.vy > 0 && head) {
        if (b.vuln) hitBoss(b);
        P.vy = -11; P.bounced = true; P.djUsed = false; P.dashUsed = false;
        AU.sfx('stomp');
      } else if (P.dashT > 0) {
        if (b.vuln) hitBoss(b);
        P.dashT = 0; P.vx = -P.facing * 5; P.vy = -5; P.inv = Math.max(P.inv, 30);
      } else if (!(b.st === 'rest' || b.st === 'stun' || b.st === 'tired' || b.st === 'recover') || b.kind === 'treant') hurt(b.x + b.w / 2);
    }
    if (S.lava && P.y + P.h > S.lava.y + 6) { hurt(P.x + P.w / 2); P.vy = -12; }
  }

  /* ---------- конец уровня ---------- */
  function complete() {
    if (S.done) return;
    S.done = true;
    AU.sfx('portal');
    S.freeze = 999999;
    setTimeout(() => E.onComplete && E.onComplete(results()), 650);
  }
  function results() { return { world: S.world, stage: S.stage, time: S.time / 60, coins: S.coins, totalCoins: S.totalCoins, shards: S.shards.slice(), deaths: S.deaths, boss: L.boss }; }

  /* ---------- главный шаг ---------- */
  E.update = function () {
    if (!S) return;
    S.t++;
    if (S.banner && S.banner.t > 0) S.banner.t--;
    if (S.flash > 0) S.flash--;
    if (S.shake > 0) S.shake--;
    // частицы живут всегда
    for (const p of S.parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; }
    S.parts = S.parts.filter((p) => p.life > 0);
    for (const p of S.pops) { p.y -= 0.7; p.life--; }
    S.pops = S.pops.filter((p) => p.life > 0);
    if (S.freeze) {
      if (S.done) return;
      S.freeze--;
      if (S.freeze === 0) {
        if (S.bossDead) { S.bossDead = false; complete(); return; }
        if (S.dead) respawn();
      }
      return;
    }
    if (S.stop > 0) { S.stop--; return; }
    S.time++;
    updateMovers();
    updatePlayer();
    if (S.freeze) return;
    if (S.P.onGround) S.combo = 0;
    updateChase();
    if (S.freeze) return;
    updateCrumble();
    updateEnemies();
    updateHazards();
    updateShots();
    updateBoss();
    updatePickups();
    // камера
    const P = S.P;
    if (L.boss) S.cam.x = 0;
    else {
      const target = P.x + P.w / 2 - K.VW / 2 + P.facing * 70;
      S.cam.x += (target - S.cam.x) * 0.1;
      S.cam.x = Math.max(0, Math.min(L.w * TS - K.VW, S.cam.x));
    }
    S.ents = S.ents.filter((e) => !(e.t === 'enemy' && !e.alive) && !(e.t === 'icicle' && !e.alive));
  };

  E.render = function (ctx) {
    if (!S) return;
    const camX = Math.round(S.cam.x), t = S.t;
    ctx.save();
    if (S.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * S.shake), Math.round((Math.random() - 0.5) * S.shake));
    GFX.drawBg(ctx, camX, t);
    GFX.drawAmbient(ctx, camX, t);
    GFX.drawTiles(ctx, L, camX, t, crumble);
    for (const e of S.ents) {
      if (e.taken) continue;
      if (e.x - camX < -80 || e.x - camX > K.VW + 80) continue;
      if (e.t === 'enemy') GFX.drawEnemy(ctx, e, camX, t);
      else GFX.drawItem(ctx, e, camX, t);
    }
    if (S.boss && S.boss.hp > 0) GFX.drawBoss(ctx, S.boss, camX, t);
    for (const s of S.shots) GFX.drawShot(ctx, s, camX, t);
    if (!(S.dead && S.freeze)) GFX.drawHero(ctx, S.P, camX, t);
    if (S.lava) { ctx.fillStyle = '#ff6a1a'; ctx.fillRect(0, S.lava.y, K.VW, K.VH - S.lava.y); ctx.fillStyle = '#ffd06a'; for (let x = 0; x < K.VW; x += 16) ctx.fillRect(x, S.lava.y + Math.sin(t * 0.1 + x) * 3, 10, 4); }
    if (S.chase) GFX.drawChase(ctx, S.chase, camX, t);
    GFX.drawParticles(ctx, S.parts, camX);
    for (const p of S.pops) { ctx.globalAlpha = Math.min(1, p.life / 20); ctx.font = GFX.font(18); ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(p.text, p.x - camX + 2, p.y + 2); ctx.fillStyle = '#ffd56b'; ctx.fillText(p.text, p.x - camX, p.y); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
    ctx.restore();
    if (S.chase && !S.done) GFX.drawChaseWarn(ctx, S.P.x - S.chase.x, t);
    if (S.flash > 0) { ctx.fillStyle = `rgba(200,160,255,${S.flash / 30})`; ctx.fillRect(0, 0, K.VW, K.VH); }
    GFX.drawHud(ctx, S);
    if (S.boss && S.boss.hp > 0 && S.boss.st !== 'intro') GFX.drawBossBar(ctx, S.boss, S.bossName);
    if (S.sign) GFX.drawSignText(ctx, S.sign.text, S.sign.x - camX + 15, S.sign.y - 10);
    if (S.banner && S.banner.t > 0) {
      const a = Math.min(1, S.banner.t / 30);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, K.VH / 2 - 50, K.VW, 84);
      ctx.fillStyle = '#ffffff'; ctx.font = GFX.font(34); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.banner.text, K.VW / 2, K.VH / 2 - 10);
      ctx.font = GFX.font(16); ctx.fillStyle = GFX.pal().light;
      ctx.fillText(L.boss ? 'Босс' : S.banner.sub || K.worldById(S.world).sub, K.VW / 2, K.VH / 2 + 20);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
  };

  // Сцена для заставок: фон мира и герой.
  E.renderScene = function (ctx, wid, t) {
    GFX.setWorld(wid);
    GFX.drawBg(ctx, t * 0.6, t);
    GFX.drawAmbient(ctx, t * 0.6, t);
    ctx.fillStyle = GFX.pal().groundDark; ctx.fillRect(0, 448, K.VW, 96);
    ctx.fillStyle = GFX.pal().top; ctx.fillRect(0, 448, K.VW, 8);
    GFX.drawHero(ctx, { x: 460, y: 418, vx: 1, vy: 0, onGround: true, facing: 1, inv: 0, dashT: 0 }, 0, t);
  };
})();
