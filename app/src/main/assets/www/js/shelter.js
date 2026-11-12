'use strict';
/* Убежище: состояние, симуляция жильцов, набеги, отрисовка разреза */
(function () {
  const SH = window.SH = {};
  const { CW, CH, COLS, ROWS, SHAFT, TOP, DAY, SX } = D, clamp = U.clamp;
  const WALK = 82, CLIMB = 62;

  /* ---------- Создание ---------- */
  const TOPS = [['#4b5340', '#5f6850'], ['#3e4a5a', '#52647a'], ['#5a4632', '#755c42'], ['#5a3a3a', '#734e4e'], ['#4a4a46', '#62625c'], ['#3b5550', '#507068'], ['#6a5a3a', '#867450']];
  const SKIN = ['#d8b08c', '#c99d78', '#a87a56', '#8a5f42'], HAIR = ['#2a2119', '#4a3220', '#7a5a36', '#1b1b1b', '#8a8478', '#a8743a'];
  function styleFor(p) {
    const r = U.rng(p.seedv), t = U.pick(TOPS, r);
    return RIG.style({ skin: U.pick(SKIN, r), hair: U.pick(HAIR, r), top: t[0], top2: t[1], pants: U.pick(['#2e3238', '#33302a', '#2a3038', '#3a3a34'], r),
      hairStyle: p.male ? (r() < 0.3 ? 2 : 0) : 1, beard: p.male && r() < 0.35, cap: r() < 0.3 ? U.pick(['#3a4030', '#5a2a24', '#2a3240'], r) : null, scarf: r() < 0.25 ? U.pick(['#7a2a26', '#a8986a', '#3a4a5a'], r) : null });
  }
  SH.styleOf = p => styleFor(p);
  SH.person = function (x, y, row) {
    const s = SH.s, r = Math.random, male = r() < 0.55, list = male ? D.NAMES_M : D.NAMES_F, used = s.ppl.map(p => p.name);
    const free = list.filter(n => used.indexOf(n) < 0);
    const p = { id: s.nid++, name: free.length ? U.pick(free, r) : 'Выживший', male, S: 2 + (r() * 6 | 0), A: 2 + (r() * 6 | 0), I: 2 + (r() * 6 | 0), lvl: 1, xp: 0, hp: 100, seedv: (r() * 1e6) | 0 };
    initP(p, x, y, row); s.ppl.push(p); return p;
  };
  function initP(p, x, y, row) {
    Object.assign(p, { x, y, row, tx: x, trow: row, job: null, st: 'move', climb: y < TOP, face: 1, mv: 0, ph: 0, act: null, at: 0, wt: 1, seed: Math.random() * 9, hurt: 0, fl: 0, cd: 0 });
    p.style = styleFor(p);
  }
  SH.room = function (c, r, k, lvl) { const rm = { c, r, k, lvl: lvl || 1, acc: 0, w: [], on: false }; SH.grid[r][c] = rm; SH.s.rooms.push(rm); return rm; };
  SH.newGame = function () {
    SH.s = { t: DAY * 0.12, res: { energy: 70, water: 70, food: 70, scrap: 60, meds: 1 }, rooms: [], ppl: [], gear: { weapon: 1, armor: 0, pack: 0, door: 0 }, door: D.GEAR.door.val[0],
      raidT: DAY * 1.55, radioT: 70, raids: 0, raidsWon: 0, trips: 0, goal: 0, nid: 1, kills: 0, alarm: false };
    SH.grid = []; for (let r = 0; r < ROWS; r++) SH.grid.push(new Array(COLS).fill(null));
    SH.room(SHAFT, 0, 'hatch'); SH.room(1, 0, 'garden'); SH.room(2, 0, 'living'); SH.room(4, 0, 'power'); SH.room(5, 0, 'water');
    for (let i = 0; i < 3; i++) { const p = SH.person(2 * CW + 50 + i * 55, D.floorY(0), 0); p.st = 'idle'; p.climb = false; }
    SH.zs = []; SH.fx = []; SH.fl = []; SH.pops = []; SH.decals = []; SH.sel = null; SH.raid = false; SH.cam = null;
  };

  /* ---------- Справочные ---------- */
  SH.caps = function () {
    let st = 0, beds = 0, med = 0;
    for (const r of SH.s.rooms) { if (r.k === 'storage') st += r.lvl; else if (r.k === 'living') beds += r.lvl * 4; else if (r.k === 'infirmary') med += r.lvl; }
    return { max: 100 + st * 80, beds, meds: 3 + med * 3 };
  };
  SH.has = k => SH.s.rooms.some(r => r.k === k);
  SH.byId = id => SH.s.ppl.find(p => p.id === id);
  SH.canBuild = function (c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS || SH.grid[r][c]) return null;
    if (c === SHAFT) return r > 0 && SH.grid[r - 1][SHAFT] ? ['stairs'] : null;
    // строим только вплотную к соседнему отсеку того же уровня
    return (c > 0 && SH.grid[r][c - 1]) || (c < COLS - 1 && SH.grid[r][c + 1]) ? D.BUILD : null;
  };
  SH.upCost = rm => Math.round((D.ROOMS[rm.k].cost || 60) * rm.lvl * 1.6);
  SH.float = (x, y, t, c) => SH.fl.push({ x, y, t, c: c || '#fff', life: 1.8 });
  SH.weapon = () => D.WEAPONS[SH.s.gear.weapon];
  SH.statMul = v => 0.55 + v * 0.09;

  /* ---------- Назначения ---------- */
  function unjob(p) { if (p.job) { const w = p.job.w, i = w.indexOf(p.id); if (i >= 0) w.splice(i, 1); reslot(p.job); p.job = null; } }
  function reslot(rm) { const xs = D.SLOTX[rm.k]; rm.w.forEach((id, i) => { const p = SH.byId(id); if (p && p.st !== 'out') { p.tx = rm.c * CW + xs[i]; p.trow = rm.r; if (p.st !== 'down' && p.st !== 'fight') p.st = 'move'; } }); }
  SH.assign = function (p, rm) {
    if (p.st === 'out' || p.st === 'down') return false;
    const def = D.ROOMS[rm.k];
    if (def.slots) { if (p.job === rm) return true; if (rm.w.length >= def.slots) return false; unjob(p); rm.w.push(p.id); p.job = rm; reslot(rm); }
    else { unjob(p); p.tx = rm.c * CW + (rm.k === 'stairs' || rm.k === 'hatch' ? CW / 2 + (Math.random() < 0.5 ? -50 : 50) : 34 + Math.random() * (CW - 68)); p.trow = rm.r; p.st = 'move'; }
    return true;
  };
  SH.rest = function (p) { const lv = SH.s.rooms.find(r => r.k === 'living'); unjob(p); if (lv) SH.assign(p, lv); };
  SH.takeOut = function (p) { p.lastJob = p.job; p.guard = false; unjob(p); p.st = 'out'; if (SH.sel === p) SH.sel = null; };
  // возвращение на поверхности у люка
  SH.comeBack = function (p, hp) {
    p.x = SX + 70; p.y = 0; p.row = 0; p.climb = false; p.hp = hp; p.st = 'move'; p.trow = 0; p.tx = 2 * CW + 60 + Math.random() * 100; p.surf = true;
    if (hp <= 15) { p.st = 'down'; p.dt = 30; p.x = SX - 40; p.y = D.floorY(0); p.surf = false; return; }
    const j = p.lastJob; p.lastJob = null;
    if (j && SH.s.rooms.indexOf(j) >= 0 && j.w.length < D.ROOMS[j.k].slots) SH.assign(p, j);
  };

  /* ---------- Набег ---------- */
  SH.startRaid = function () {
    const s = SH.s, n = Math.min(9, 3 + Math.floor(s.raids * 0.8)); s.raids++; SH.raid = true;
    for (let i = 0; i < n; i++) {
      const q = Math.random(), t = i > 2 && q < 0.22 ? 'brute' : q < 0.35 ? 'runner' : 'walker';
      SH.zs.push({ t, M: D.MOB[t], x: D.WORLD_W + 160 + i * 60 + Math.random() * 40, y: 0, row: -1, st: 'approach', hp: D.MOB[t].hp, face: -1, mv: 0, ph: Math.random() * 6, act: null, at: 0, cd: Math.random(), hurt: 0, dead: 0, kb: 0, life: 40, lootT: 3,
        seed: Math.random() * 9, style: zStyle(t) });
    }
    U.sfx('alarm'); if (SH.onEvent) SH.onEvent('raid');
  };
  const ZT = [['#3a3833', '#4f4c45', '#2a2a27'], ['#2c3940', '#41525b', '#33302a'], ['#4b412f', '#655a41', '#23262b'], ['#522624', '#6c3630', '#25272a']];
  function zStyle(t) {
    const v = U.pick(ZT, Math.random);
    return RIG.style({ skin: U.pick(['#8a9482', '#9c988c', '#7f8a75'], Math.random), top: v[0], top2: v[1], pants: v[2], hair: '#20221c', zombie: true, short: Math.random() < 0.5, hairStyle: Math.random() < 0.3 ? 2 : 0 });
  }
  SH.zStyle = zStyle;
  SH.alarm = function (on) {
    const s = SH.s; s.alarm = on;
    for (const p of s.ppl) {
      if (p.st === 'out' || p.st === 'down') continue;
      if (on && p.hp > 25) { p.guard = true; p.tx = SX + (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60); p.trow = 0; p.st = 'move'; }
      else if (!on && p.guard) { p.guard = false; if (p.job) reslot(p.job); else SH.rest(p); }
    }
    if (on) U.sfx('alarm');
  };

  /* ---------- Симуляция жильца ---------- */
  function hurtP(p, dmg) {
    dmg *= 1 - D.GEAR.armor.val[SH.s.gear.armor] * 0.6;
    p.hp -= dmg; p.hurt = 0.3; p.act = 'hurt'; p.at = 0; U.sfx('hurt'); ART.mkPop(SH.pops, p.x, p.y - 64, 'hurt'); blood(p.x, p.y - 34, 7, p.face);
    if (p.hp <= 0) { p.hp = 0; p.st = 'down'; p.dt = 40; p.guard = false; SH.float(p.x, p.y - 80, p.name + (p.male ? ' ранен' : ' ранена'), '#ff7a6a'); if (SH.sel === p) SH.sel = null; }
  }
  function blood(x, y, n, dir) {
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2 + dir * 0.6; SH.fx.push({ x, y, vx: Math.cos(a) * (60 + Math.random() * 120), vy: Math.sin(a) * (60 + Math.random() * 120), life: 0.8, c: Math.random() < 0.5 ? '#7a1010' : '#4a0808', s: 2 + Math.random() * 2, g: 520, blood: 1 }); }
  }
  SH.blood = blood;
  function walkTo(p, dt, sp) {
    // поверхность → люк → вниз по лестнице → к цели
    if (p.surf) { const dx = SX - p.x; if (Math.abs(dx) > 2) { p.x += Math.sign(dx) * Math.min(sp * dt, Math.abs(dx)); p.face = Math.sign(dx); return 1; } p.surf = false; p.climb = true; }
    const ty = D.floorY(p.trow);
    if (p.climb || Math.abs(p.y - ty) > 1) {
      if (!p.climb) { const dx = SX - p.x; if (Math.abs(dx) > 2) { p.x += Math.sign(dx) * Math.min(sp * dt, Math.abs(dx)); p.face = Math.sign(dx); return 1; } p.x = SX; p.climb = true; }
      const dy = ty - p.y;
      if (Math.abs(dy) > 1) { p.y += Math.sign(dy) * Math.min(CLIMB * dt, Math.abs(dy)); p.act = 'climb'; p.ph += dt * 7; if (Math.random() < dt * 2) U.sfx('ladder'); return 2; }
      p.y = ty; p.row = p.trow; p.climb = false; p.act = null;
    }
    p.row = p.trow;
    const dx = p.tx - p.x;
    if (Math.abs(dx) > 2) { p.x += Math.sign(dx) * Math.min(sp * dt, Math.abs(dx)); p.face = Math.sign(dx); return 1; }
    return 0;
  }
  function updP(p, dt) {
    const s = SH.s;
    if (p.st === 'out') return;
    if (p.hurt > 0) p.hurt -= dt;
    if (p.fl > 0) p.fl -= dt;
    if (p.act === 'hurt') { p.at += dt / 0.35; if (p.at >= 1) p.act = null; }
    if (p.st === 'down') {
      p.act = 'dead'; p.mv = 0; p.dt -= dt * (SH.has('infirmary') ? 1.6 : 1);
      if (p.dt < 34 && s.res.meds >= 1) { s.res.meds--; p.dt = 0; p.hp = 55; SH.float(p.x, p.y - 60, 'Аптечка', '#9dff9a'); }
      if (p.dt <= 0) { p.hp = Math.max(p.hp, 35); p.act = null; p.st = 'move'; if (p.job) reslot(p.job); else SH.rest(p); }
      return;
    }
    let moving = 0;
    // драка: на этом же этаже рядом мертвец
    let z = null, zd = p.guard ? 520 : 240;
    if (!p.climb && !p.surf) for (const q of SH.zs) if (q.st === 'in' && !q.dead && Math.abs(q.y - p.y) < 4 && Math.abs(q.x - p.x) < zd) { z = q; zd = Math.abs(q.x - p.x); }
    if (z && p.hp > 15) {
      p.st = 'fight'; const dx = z.x - p.x, W = SH.weapon(); p.face = Math.sign(dx) || 1;
      if (p.act === 'swing' || p.act === 'punch') {
        p.at += dt / W.dur;
        if (!p.hit && p.at >= 0.48) { p.hit = true; if (Math.abs(z.x - p.x) < W.reach + 16) hurtZ(z, Math.round(W.dmg * SH.statMul(p.S)), p); else U.sfx('swing'); }
        if (p.at >= 1) { p.act = null; p.cd = 0.25; }
      } else if (Math.abs(dx) > W.reach - 4) { p.x += Math.sign(dx) * WALK * 1.3 * dt; moving = 1.2; p.act = null; }
      else if ((p.cd -= dt) <= 0) { p.act = W.act; p.at = 0; p.hit = false; p.alt = !p.alt; U.sfx('swing'); }
    } else {
      if (p.st === 'fight') { p.st = 'move'; p.act = null; if (!p.guard) { if (p.job) reslot(p.job); else SH.rest(p); } }
      if (p.st === 'move') {
        const m = walkTo(p, dt, WALK);
        if (m === 1) moving = 1; else if (m === 0) { p.st = p.job ? 'work' : 'idle'; p.wt = 2 + Math.random() * 4; p.act = null; }
      } else if (p.st === 'work') {
        const def = D.ROOMS[p.job.k]; p.act = def.act; p.face = p.job.k === 'radio' || p.job.k === 'infirmary' ? -1 : (p.tx - p.job.c * CW < CW / 2 ? 1 : -1);
        if (p.job.k === 'power') p.face = p.tx - p.job.c * CW < 100 ? 1 : -1;
        if (!p.job.on && s.res.energy <= 0) p.act = null;
      } else if (p.st === 'idle') {
        const night = SH.dark > 0.5, rm = SH.grid[p.row] && SH.grid[p.row][clamp((p.x / CW) | 0, 0, COLS - 1)];
        if (night && rm && rm.k === 'living' && !p.guard) {
          const slot = p.id % 4, bx = rm.c * CW + (slot % 2 ? 155 : 41);
          if (Math.abs(p.x - bx) > 3) { p.tx = bx; p.trow = p.row; p.st = 'move'; } else { p.act = 'sleep'; p.face = 1; p.bunk = slot < 2 ? 31 : 65; }
        }
        else {
          p.act = null; p.wt -= dt;
          if (p.wt <= 0) { p.wt = 3 + Math.random() * 6; if (rm && rm.k !== 'stairs' && rm.k !== 'hatch' || p.guard) { p.tx = clamp(p.x + (Math.random() - 0.5) * 120, (p.x / CW | 0) * CW + 26, (p.x / CW | 0) * CW + CW - 26); p.trow = p.row; p.st = 'move'; } }
        }
      }
    }
    const tm = moving ? 1 : 0; p.mv += (tm * (moving || 1) - p.mv) * Math.min(1, dt * 9);
    if (moving) { p.ph += dt * WALK * 0.12 * moving; if (p.act === 'sleep' || p.act === 'climb') p.act = null; }
    // восстановление
    if (p.hp < 100 && s.res.food > 0 && s.res.water > 0) p.hp = Math.min(100, p.hp + dt * (p.act === 'sleep' ? 1.6 : 0.5));
    if (s.res.food <= 0 || s.res.water <= 0) { p.hp -= dt * 0.35; if (p.hp <= 0) { p.hp = 1; p.st = 'down'; p.dt = 60; } }
  }
  function hurtZ(q, dmg, p) {
    q.hp -= dmg; q.hurt = 0.3; q.kb = Math.sign(q.x - p.x) * (q.t === 'brute' ? 90 : 220); q.act = 'hurt'; q.at = 0;
    U.sfx(dmg > 25 ? 'crit' : 'hit'); blood(q.x, q.y - 36, 9, Math.sign(q.x - p.x)); SH.float(q.x + 14, q.y - 70, '-' + dmg, '#e8d8d0'); if (dmg > 25 || Math.random() < 0.5) ART.mkPop(SH.pops, q.x, q.y - 60, q.hp - 0 <= 0 ? 'kill' : dmg > 25 ? 'crit' : 'hit', dmg > 25);
    if (SH.onHit) SH.onHit(dmg > 25 ? 0.3 : 0.16);
    if (q.hp <= 0) { q.dead = 0.001; q.act = 'dead'; SH.s.kills++; SH.s.res.scrap += 3; SH.float(q.x, q.y - 100, '+3 материалы', '#ffe9a8'); p.xp += q.M.xp; levelUp(p); SH.decals.push({ x: q.x, y: q.y, w: 18 + Math.random() * 10 }); }
  }
  function levelUp(p) {
    const need = 30 + p.lvl * 25;
    if (p.xp >= need) { p.xp -= need; p.lvl++; const k = U.pick(['S', 'A', 'I'], Math.random); if (p[k] < 10) p[k]++; SH.float(p.x, p.y - 96, p.name + ': ' + D.STAT[k] + ' +1', '#9dff9a'); U.sfx('good'); }
  }
  SH.levelUp = levelUp;

  /* ---------- Мертвецы в набеге ---------- */
  function updZ(q, dt) {
    const s = SH.s, M = q.M;
    if (q.dead) { q.dead += dt; return q.dead < 6; }
    if (q.hurt > 0) q.hurt -= dt;
    q.x += q.kb * dt; q.kb *= Math.pow(0.003, dt);
    let sp = 0;
    if (q.act === 'hurt') { q.at += dt / 0.3; if (q.at >= 1) q.act = null; }
    if (q.st === 'approach') {
      const dx = SX + 52 - q.x; q.face = Math.sign(dx) || -1;
      if (Math.abs(dx) > 4 + (q.seed % 1) * 26) sp = M.sp; else q.st = 'door';
    } else if (q.st === 'door') {
      q.face = -1;
      if (q.act === 'lunge') { const b = q.at; q.at += dt / (M.wind + 0.3); if (b < 0.5 && q.at >= 0.5) { s.door -= M.dmg * 0.7; U.sfx('door'); SH.doorHit = 0.25; if (Math.random() < 0.45) ART.mkPop(SH.pops, SX + 30 + Math.random() * 20, -60 - Math.random() * 20, 'door', true); for (let i = 0; i < 4; i++) SH.fx.push({ x: SX + 32, y: -30 - Math.random() * 30, vx: 40 + Math.random() * 80, vy: -60 - Math.random() * 80, life: 0.6, c: '#8a8a7c', s: 2.4, g: 500 }); } if (q.at >= 1) { q.act = null; q.cd = 0.4 + Math.random() * 0.6; } }
      else if ((q.cd -= dt) <= 0) { q.act = 'lunge'; q.at = 0; }
      if (s.door <= 0) { s.door = 0; if (SH.onEvent) SH.onEvent('breach'); }
      if (s.door <= 0 && !q.act) { q.st = 'climbIn'; q.x = SX; }
    } else if (q.st === 'climbIn') {
      q.act = 'climb'; q.ph += dt * 7; q.y += 55 * dt;
      if (q.y >= D.floorY(0)) { q.y = D.floorY(0); q.st = 'in'; q.act = null; q.row = 0; }
    } else if (q.st === 'in') {
      let p = null, pd = 1e9;
      for (const w of s.ppl) if (w.st !== 'out' && w.st !== 'down' && !w.climb && !w.surf && Math.abs(w.y - q.y) < 4 && Math.abs(w.x - q.x) < pd) { p = w; pd = Math.abs(w.x - q.x); }
      if (q.cd > 0) q.cd -= dt;
      if (p && pd < 700) {
        const dx = p.x - q.x; if (q.act !== 'lunge') q.face = Math.sign(dx) || 1;
        if (q.act === 'lunge') { const b = q.at; q.at += dt / (M.wind + 0.35); if (b < 0.5 && q.at >= 0.5 && Math.abs(dx) < M.reach) hurtP(p, M.dmg); if (q.at >= 1) { q.act = null; q.cd = 0.5; } }
        else if (q.act !== 'hurt') { if (Math.abs(dx) > M.reach - 10) sp = M.run; else if (q.cd <= 0) { q.act = 'lunge'; q.at = 0; if (Math.random() < 0.5) U.sfx('growl'); } }
      } else {
        q.life -= dt; q.lootT -= dt;
        if (q.lootT <= 0) { q.lootT = 3; const k = U.pick(['food', 'water', 'scrap'], Math.random), n = Math.min(5, s.res[k]); if (n > 0) { s.res[k] -= n; SH.float(q.x, q.y - 84, '−' + Math.round(n) + ' ' + D.RES[k].toLowerCase(), '#ff7a6a'); } }
        if (q.gx === undefined || Math.abs(q.gx - q.x) < 6) q.gx = rowSpan(0, q.x);
        q.face = Math.sign(q.gx - q.x) || 1; sp = M.sp;
        if (q.life <= 0) return false;
      }
      const [a, b] = rowBounds(0); q.x = clamp(q.x, a + 16, b - 16);
    }
    if (q.act === 'hurt' || q.act === 'lunge') sp *= 0.15;
    q.x += q.face * sp * dt * (q.st === 'in' || q.st === 'approach' ? 1 : 0);
    q.mv += ((sp > 1 ? 1 : 0) - q.mv) * Math.min(1, dt * 8); if (sp > 1) q.ph += dt * sp * 0.13;
    return true;
  }
  function rowBounds(r) { let a = SHAFT, b = SHAFT; while (a > 0 && SH.grid[r][a - 1]) a--; while (b < COLS - 1 && SH.grid[r][b + 1]) b++; return [a * CW, (b + 1) * CW]; }
  function rowSpan(r, x) { const [a, b] = rowBounds(r); return a + 30 + Math.random() * (b - a - 60); }

  /* ---------- Главный шаг ---------- */
  SH.update = function (dt, away) {
    const s = SH.s, res = s.res, cap = SH.caps();
    s.t += dt; SH.ph = (s.t % DAY) / DAY; SH.dark = ART.sky(SH.ph).dark;
    const home = s.ppl.filter(p => p.st !== 'out').length;
    res.food = Math.max(0, res.food - home * 0.012 * dt); res.water = Math.max(0, res.water - home * 0.012 * dt);
    let drain = 0; for (const r of s.rooms) if (r.k !== 'stairs') drain += 0.016 * r.lvl;
    res.energy = Math.max(0, res.energy - drain * dt);
    for (const r of s.rooms) {
      const def = D.ROOMS[r.k]; if (!def.slots) { r.on = res.energy > 0; continue; }
      let skill = 0; for (const id of r.w) { const p = SH.byId(id); if (p && p.st === 'work') skill += SH.statMul(p[def.stat]); }
      r.on = skill > 0 && (r.k === 'power' || res.energy > 0);
      if (!r.on) continue;
      if (def.out) {
        r.acc += def.rate * skill * (1 + (r.lvl - 1) * 0.6) * dt; const step = r.k === 'infirmary' ? 1 : 5;
        if (r.acc >= step) {
          r.acc -= step; const max = r.k === 'infirmary' ? cap.meds : cap.max;
          if (res[def.out] < max) { res[def.out] = Math.min(max, res[def.out] + step); SH.float(r.c * CW + CW / 2, TOP + r.r * CH + 46, '+' + step + ' ' + D.RES[def.out].toLowerCase(), '#b9e89a'); for (const id of r.w) { const p = SH.byId(id); if (p) { p.xp += 1; levelUp(p); } } }
        }
      } else if (r.k === 'radio') {
        s.radioT -= dt * skill * r.lvl;
        if (s.radioT <= 0) {
          s.radioT = 100 + Math.random() * 60;
          if (s.ppl.length < cap.beds) { const p = SH.person(D.WORLD_W + 80, 0, 0); p.surf = true; p.climb = false; p.x = D.WORLD_W + 60; p.y = 0; p.trow = 0; p.tx = 2 * CW + 80; SH.float(SX, -70, p.name + (p.male ? ' пришёл' : ' пришла') + ' на сигнал', '#9dff9a'); U.sfx('good'); if (SH.onEvent) SH.onEvent('arrive', p); }
          else SH.float(r.c * CW + CW / 2, TOP + r.r * CH + 46, 'Нет свободных коек', '#ff8a7a');
        }
      }
    }
    for (const p of s.ppl) updP(p, dt);
    for (let i = SH.zs.length - 1; i >= 0; i--) if (!updZ(SH.zs[i], dt)) SH.zs.splice(i, 1);
    if (SH.raid && !SH.zs.some(q => !q.dead)) { SH.raid = false; s.raidsWon++; if (s.alarm) SH.alarm(false); if (SH.onEvent) SH.onEvent('won'); }
    if (!SH.raid) { s.door = Math.min(D.GEAR.door.val[s.gear.door], s.door + dt * (SH.has('workshop') ? 3 : 1.2)); s.raidT -= dt; if (s.raidT <= 0 && SH.dark > 0.6 && !away) { s.raidT = DAY * (1.3 + Math.random() * 0.8); SH.startRaid(); } }
    if (SH.doorHit > 0) SH.doorHit -= dt;
    // частицы и надписи
    for (let i = SH.fx.length - 1; i >= 0; i--) { const q = SH.fx[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g || 0) * dt; if (q.life <= 0) { SH.fx[i] = SH.fx[SH.fx.length - 1]; SH.fx.pop(); } }
    ART.stepPops(SH.pops, dt);
    for (let i = SH.fl.length - 1; i >= 0; i--) { const f = SH.fl[i]; f.life -= dt; f.y -= dt * 18; if (f.life <= 0) SH.fl.splice(i, 1); }
    if (SH.decals.length > 30) SH.decals.shift();
    for (const g of D.GOALS.slice(s.goal, s.goal + 1)) if (g.c(s)) { s.goal++; U.sfx('good'); if (SH.onEvent) SH.onEvent('goal'); }
  };

  /* ---------- Отрисовка ---------- */
  const SURF = [['dead', 0, -380], ['bush0', 0, -250], ['fence', 0, -130], ['sandbags', 0, 520], ['car', 0, 760], ['dead', 1, 1000], ['sign', 0, 1150], ['tires', 0, 1260], ['pine', 0, 1420], ['barrel', 0, 1560], ['dead', 0, 1700]];
  SH.render = function (x, V, dt) {
    const s = SH.s, cam = SH.cam, z = cam.z, ox = V.w / 2 - cam.x * z, oy = V.h / 2 - cam.y * z;
    const left = cam.x - V.w / 2 / z, right = cam.x + V.w / 2 / z, top = cam.y - V.h / 2 / z, bot = cam.y + V.h / 2 / z, tm = s.t;
    const sk = ART.sky(SH.ph);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    const hz = Math.round(oy);
    if (hz > 0) { ART.drawSky(x, V.w, hz, cam.x, sk); ART.drawLayers(x, 'home', V.w, hz, cam.x, z, sk); }
    x.setTransform(z, 0, 0, z, ox, oy);
    // поверхность
    if (top < 0) {
      for (const o of SURF) { const sp = ART.P[o[0]], im = Array.isArray(sp) ? sp[o[1]] : sp; if (o[2] > left - 200 && o[2] < right + 200) ART.put(x, im, o[2], 4); }
      if (SH.has('radio')) ART.put(x, ART.P.antenna, SX - 70, -84);
      ART.put(x, ART.P.hatch, SX, 2);
      const dmg = Math.min(3, Math.floor((1 - s.door / D.GEAR.door.val[s.gear.door]) * 4));
      if (s.door > 0) { const sh = SH.doorHit > 0 ? (Math.random() - 0.5) * 3 : 0; ART.put(x, ART.P.hdoor[dmg], SX + sh, 2); }
      else { x.fillStyle = '#060707'; x.fillRect(SX - 32, -68, 64, 70); }
      if (SH.has('power') && s.res.energy > 0 && Math.random() < dt * 3) SH.fx.push({ x: SX - 66, y: -112, vx: 6 + Math.random() * 6, vy: -18, life: 2.5, max: 2.5, s: 9, smoke: 1 });
      // лампа над входом
      if (sk.dark > 0.3 && s.res.energy > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = sk.dark * 0.6; x.drawImage(ART.lampGlow, SX - 90, -150, 180, 150); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.fillStyle = '#ffe9b0'; x.fillRect(SX - 4, -86, 8, 3); }
      // полоска прочности двери
      x.globalAlpha = 0.35 + sk.dark * 0.2; for (let i = 0; i < 4; i++) { const mx = ((i * 577 + tm * 6) % (D.WORLD_W + 900)) - 450; x.drawImage(ART.mist, mx - 260, -60, 520, 90); } x.globalAlpha = 1;
      if (SH.raid || s.door < D.GEAR.door.val[s.gear.door]) { const w = 70, k = s.door / D.GEAR.door.val[s.gear.door]; x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(SX - w / 2, -100, w, 7); x.fillStyle = k > 0.35 ? '#d39a3a' : '#c23a30'; x.fillRect(SX - w / 2 + 1, -99, (w - 2) * k, 5); }
    }
    // грунт
    const gx0 = Math.floor(left / 256) * 256;
    x.fillStyle = x.createPattern(ART.dirt, 'repeat'); x.fillRect(left - 2, 10, right - left + 4, Math.max(0, bot - 8));
    for (let gx = gx0; gx < right; gx += 256) x.drawImage(ART.ground.home, gx, -10, 257, 140);
    x.fillStyle = lg(x, 0, 60, 0, TOP + ROWS * CH + 100, ['rgba(0,0,0,0)', 'rgba(0,0,0,.55)']); x.fillRect(left - 2, 60, right - left + 4, TOP + ROWS * CH + 100);
    // пласты грунта
    for (const [by, bh, bc] of [[TOP + 100, 26, 'rgba(18,12,6,.32)'], [TOP + 300, 44, 'rgba(120,64,30,.14)'], [TOP + 520, 34, 'rgba(120,120,120,.12)'], [TOP + 700, 70, 'rgba(0,0,0,.22)']]) {
      if (by > bot || by + bh < top) continue; x.fillStyle = bc; x.beginPath(); x.moveTo(left - 2, by + Math.sin(left / 170) * 8);
      for (let px = Math.floor(left / 40) * 40; px <= right + 40; px += 40) x.lineTo(px, by + Math.sin(px / 170) * 8 + Math.sin(px / 61) * 3);
      for (let px = Math.ceil((right + 40) / 40) * 40; px >= left - 40; px -= 40) x.lineTo(px, by + bh + Math.sin(px / 140 + 2) * 7);
      x.closePath(); x.fill();
    }
    // старая труба и кабель в земле
    if (top < 80) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(-300, 46, 900, 13); x.fillStyle = lg(x, 0, 46, 0, 58, ['#7a5a3a', '#4a3220', '#2a1c10']); x.fillRect(-300, 47, 900, 10); for (let px = -260; px < 600; px += 120) { x.fillStyle = '#2a1c10'; x.fillRect(px, 45, 6, 15); } x.strokeStyle = '#111'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(D.WORLD_W + 200, 70); x.quadraticCurveTo(1100, 90, SX + 24, 62); x.stroke(); }
    // бетонная шахта к поверхности
    if (top < TOP) { x.fillStyle = x.createPattern(ART.conc, 'repeat'); x.fillRect(SX - 34, 0, 68, TOP); x.fillStyle = '#0b0c0c'; x.fillRect(SX - 25, 0, 50, TOP); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(SX - 34, 0, 2, TOP); x.fillRect(SX + 32, 0, 2, TOP); }
    // отсеки
    const bm = SH.buildMode;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x0 = c * CW, y0 = TOP + r * CH; if (x0 > right || x0 + CW < left || y0 > bot || y0 + CH < top) continue;
      const rm = SH.grid[r][c];
      if (!rm) {
        if (bm && SH.canBuild(c, r)) {
          x.fillStyle = 'rgba(211,154,58,' + (0.12 + 0.06 * Math.sin(tm * 4)) + ')'; x.fillRect(x0 + 6, y0 + 6, CW - 12, CH - 12);
          x.strokeStyle = 'rgba(232,196,106,.9)'; x.lineWidth = 2; x.setLineDash([9, 6]); x.strokeRect(x0 + 7, y0 + 7, CW - 14, CH - 14); x.setLineDash([]);
          x.fillStyle = 'rgba(232,196,106,.95)'; x.fillRect(x0 + CW / 2 - 15, y0 + CH / 2 - 2.5, 30, 5); x.fillRect(x0 + CW / 2 - 2.5, y0 + CH / 2 - 15, 5, 30);
        }
        continue;
      }
      x.drawImage(ART.room[rm.k], x0, y0, CW, CH);
      if (c === SHAFT) { x.drawImage(ART.ladder, SX - 20, y0 - (r === 0 ? TOP : 0), 40, CH + (r === 0 ? TOP : 0)); if (r < ROWS - 1 && SH.grid[r + 1][SHAFT]) x.drawImage(ART.hole, SX - 28, y0 + CH - 16, 56, 18); }
      roomAnim(x, rm, x0, y0, tm, s);
      if (rm.lvl > 1) { x.fillStyle = '#d39a3a'; for (let i = 0; i < rm.lvl; i++) { x.beginPath(); x.moveTo(x0 + 14 + i * 9, y0 + 18); x.lineTo(x0 + 18 + i * 9, y0 + 24); x.lineTo(x0 + 10 + i * 9, y0 + 24); x.fill(); } }
      const def = D.ROOMS[rm.k];
      if (def.slots && !rm.w.length && !bm) {
        x.fillStyle = 'rgba(0,0,0,.6)'; U.rr(x, x0 + CW / 2 - 40, y0 + 36, 80, 15, 3); x.fill();
        x.fillStyle = '#ff9a6a'; x.font = '800 9px sans-serif'; x.textAlign = 'center'; x.fillText('нет работников', x0 + CW / 2, y0 + 47);
      }
    }
    // бетонная оболочка вокруг отсеков
    x.fillStyle = x.createPattern(ART.conc, 'repeat');
    const B = 9, has = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && !!SH.grid[r][c];
    for (const rm of s.rooms) {
      const c = rm.c, r = rm.r, x0 = c * CW, y0 = TOP + r * CH; if (x0 > right + 10 || x0 + CW < left - 10 || y0 > bot + 10 || y0 + CH < top - 10) continue;
      if (!has(c - 1, r)) x.fillRect(x0 - B, y0 - B, B, CH + 2 * B);
      if (!has(c + 1, r)) x.fillRect(x0 + CW, y0 - B, B, CH + 2 * B);
      if (!has(c, r - 1)) { if (c === SHAFT && r === 0) { x.fillRect(x0 - B, y0 - B, CW / 2 - 25 + B, B); x.fillRect(SX + 25, y0 - B, CW / 2 - 25 + B, B); } else x.fillRect(x0 - B, y0 - B, CW + 2 * B, B); }
      if (!has(c, r + 1)) x.fillRect(x0 - B, y0 + CH, CW + 2 * B, B);
    }
    x.fillStyle = 'rgba(0,0,0,.35)';
    for (const rm of s.rooms) { const x0 = rm.c * CW, y0 = TOP + rm.r * CH; if (!has(rm.c, rm.r + 1)) x.fillRect(x0 - B, y0 + CH + B, CW + 2 * B, 4); }
    // кровь на полу
    for (const d of SH.decals) { x.fillStyle = 'rgba(70,8,6,.75)'; x.beginPath(); x.ellipse(d.x, d.y + 1, d.w, 2.6, 0, 0, 6.283); x.fill(); }
    // люди и мертвецы
    const ents = [];
    for (const p of s.ppl) if (p.st !== 'out' && p.x > left - 60 && p.x < right + 60 && p.y > top - 20 && p.y < bot + 100) ents.push(p);
    for (const q of SH.zs) if (q.x > left - 60 && q.x < right + 60) ents.push(q);
    for (const e of ents) {
      if (e.act !== 'climb' && e.act !== 'sleep' && !(e.climb)) { x.fillStyle = 'rgba(0,0,0,.32)'; x.beginPath(); x.ellipse(e.x, e.y + 0.5, 15 * (e.M ? e.M.scale : 1), 3.2, 0, 0, 6.283); x.fill(); }
      const isZ = !!e.M, P = RIG.pose({ mv: e.mv, ph: e.ph, act: e.act, t: e.at, time: tm, seed: e.seed, zombie: isZ, two: !isZ && SH.weapon().two, alt: e.alt });
      const tool = isZ ? null : e.act === 'swing' || e.st === 'fight' ? SH.weapon().tool : e.act === 'hammer' ? 'hammer' : e.act === 'plant' ? 'can' : null;
      const k = isZ ? e.M.scale : 1, yy = e.act === 'sleep' ? e.y - bunkY(e) : e.y;
      x.save(); x.translate(e.x, yy); x.scale(k, k);
      if (e.dead) x.globalAlpha = Math.max(0, Math.min(1, (6 - e.dead) / 2));
      if (SH.sel === e) { x.strokeStyle = '#ffd24a'; x.lineWidth = 2; x.beginPath(); x.ellipse(0, 1, 17, 4.5, 0, 0, 6.283); x.stroke(); }
      RIG.draw(x, e.style, P, e.act === 'climb' ? 1 : e.face, tool);
      if (e.hurt > 0) { x.globalAlpha = Math.min(0.7, e.hurt * 2.4); RIG.draw(x, RIG.white, P, e.act === 'climb' ? 1 : e.face, null); }
      x.restore(); x.globalAlpha = 1;
      if (!isZ && (e.hp < 99 || SH.sel === e) && e.st !== 'down') { x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(e.x - 15, yy - 78, 30, 4.6); x.fillStyle = e.hp > 40 ? '#5bd07a' : '#e0453a'; x.fillRect(e.x - 14, yy - 77, 28 * e.hp / 100, 2.6); }
      if (!isZ && SH.sel === e) { x.font = '800 10px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffe9a8'; x.fillText(e.name, e.x, yy - 83); }
      if (isZ && !e.dead && e.hp < e.M.hp) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(e.x - 16, yy - 82 * k, 32, 4.6); x.fillStyle = '#b01e22'; x.fillRect(e.x - 15, yy - 81 * k, 30 * e.hp / e.M.hp, 2.6); }
      if (isZ && e.act === 'lunge' && e.at < 0.45) ART.bubble(x, e.x + 8, yy - 76 * k, '!', 13, Math.sin(tm * 30) > 0 ? '#ffd43a' : '#ff6a4a');
      if (e.act === 'sleep') { const ph = (tm * 0.4 + e.seed) % 1; x.globalAlpha = Math.min(1, (1 - ph) * 3); ART.bubble(x, e.x + 30 + ph * 8, yy - 18 - ph * 14, 'z' + (ph > 0.4 ? 'z' : ''), 9); x.globalAlpha = 1; }
    }
    // частицы
    for (const q of SH.fx) {
      if (q.smoke) { const k = q.s * (2 - q.life / q.max); x.globalAlpha = Math.min(1, q.life / q.max) * 0.55; x.drawImage(ART.smoke, q.x - k, q.y - k, k * 2, k * 2); }
      else { x.globalAlpha = Math.min(1, q.life * 2.5); x.fillStyle = q.c; x.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
    }
    x.globalAlpha = 1;
    // ночь на поверхности
    if (sk.dark > 0.02 && top < 0) { x.fillStyle = 'rgba(6,10,24,' + sk.dark * 0.55 + ')'; x.fillRect(left - 2, top - 2, right - left + 4, -top + 12); }
    // надписи
    ART.drawPops(x, SH.pops);
    x.font = 'italic 900 11px sans-serif'; x.textAlign = 'center'; x.lineWidth = 4; x.lineJoin = 'round'; x.strokeStyle = '#0a0806';
    for (const f of SH.fl) { x.globalAlpha = Math.min(1, f.life * 2); x.strokeText(f.t, f.x, f.y); x.fillStyle = f.c; x.fillText(f.t, f.x, f.y); }
    x.globalAlpha = 1;
  };
  const lg = U.lg;
  function bunkY(p) { return p.bunk || 0; }
  function roomAnim(x, rm, x0, y0, tm, s) {
    const off = s.res.energy <= 0 && rm.k !== 'power', FY = CH - D.FLOOR, fl = off ? 0 : 1 - (s.res.energy < 10 ? (Math.random() < 0.08 ? 0.6 : 0) : 0);
    if (rm.k === 'power') {
      const a = rm.on ? tm * 6 : 0; x.strokeStyle = '#8a949a'; x.lineWidth = 3.4;
      for (let i = 0; i < 4; i++) { const b = a + i * 1.571; x.beginPath(); x.moveTo(x0 + 150, y0 + FY - 34); x.lineTo(x0 + 150 + Math.cos(b) * 16, y0 + FY - 34 + Math.sin(b) * 16); x.stroke(); }
      x.fillStyle = rm.on ? '#5be07a' : '#a32a2a'; x.fillRect(x0 + 188, y0 + 49, 4, 4); if (rm.on && Math.sin(tm * 7) > 0) { x.fillStyle = '#ffd24a'; x.fillRect(x0 + 196, y0 + 49, 4, 4); }
    } else if (rm.k === 'water' && rm.on) { x.fillStyle = 'rgba(170,220,240,.75)'; for (let i = 0; i < 3; i++) { const t = (tm * 0.5 + i * 0.33) % 1; x.fillRect(x0 + 176, y0 + 98 + t * 18, 2, 3); } }
    else if (rm.k === 'infirmary') { x.strokeStyle = rm.on || !off ? '#5be07a' : '#2a3a2a'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= 22; i++) { const px = x0 + 120 + i, ph = ((tm * 1.4 + i / 22) % 1), y = ph > 0.45 && ph < 0.55 ? (ph < 0.5 ? -7 : 5) : 0; i ? x.lineTo(px, y0 + 54 + y) : x.moveTo(px, y0 + 54 + y); } x.stroke(); }
    else if (rm.k === 'radio' && rm.on) { if (Math.sin(tm * 5) > 0) { x.fillStyle = '#ff4a3a'; x.beginPath(); x.arc(x0 + 197.5, y0 + 20, 2.6, 0, 6.283); x.fill(); } x.fillStyle = 'rgba(120,255,170,' + (0.5 + 0.4 * Math.sin(tm * 9)) + ')'; x.fillRect(x0 + 133, y0 + FY - 48, 6 + Math.sin(tm * 3) * 5 + 6, 3); }
    // свет
    x.globalCompositeOperation = 'lighter';
    if (!off) {
      x.globalAlpha = 0.5 * fl; const lx = rm.k === 'hatch' ? 124 : CW / 2;
      if (rm.k !== 'stairs') {
        x.drawImage(ART.lampGlow, x0 + lx - 120, y0 + 10, 240, 150);
        x.globalAlpha = 0.85 * fl; x.drawImage(ART.beam, x0 + lx - 110, y0 + 30, 220, CH - 44);
        x.fillStyle = 'rgba(255,236,190,.55)';
        for (let i = 0; i < 6; i++) { const ph = (tm * 0.05 + i * 0.167 + rm.c * 0.13) % 1, yy = y0 + 36 + ph * (CH - 56), sp = 8 + ph * 80; x.fillRect(x0 + lx + Math.sin(tm * 0.4 + i * 2.1) * sp, yy, 1.4, 1.4); }
      }
      if (rm.k === 'garden') { x.globalAlpha = 0.55; x.drawImage(ART.purpleGlow, x0 - 20, y0 + 6, CW + 40, CH); }
      if (rm.k === 'power' && rm.on) { x.globalAlpha = 0.25 + 0.1 * Math.sin(tm * 13); x.drawImage(ART.fireGlow, x0 + 10, y0 + 40, 130, 90); }
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    if (off) { x.fillStyle = 'rgba(0,0,0,.62)'; x.fillRect(x0, y0, CW, CH); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.25 + 0.25 * Math.max(0, Math.sin(tm * 3)); x.drawImage(ART.redGlow, x0 + CW / 2 - 70, y0 - 10, 140, 90); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  }
  SH.toWorld = function (sx, sy, V) { const c = SH.cam; return [c.x + (sx - V.w / 2) / c.z, c.y + (sy - V.h / 2) / c.z]; };
})();
