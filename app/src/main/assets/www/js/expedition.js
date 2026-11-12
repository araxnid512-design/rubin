'use strict';
/* Вылазка: боковой забег по поверхности */
(function () {
  const EX = window.EX = { in: { l: false, r: false, act: false, actP: false, roll: false } };
  const clamp = U.clamp, P_ = () => ART.P;

  /* ---------- Генерация места ---------- */
  const SETS = {
    forest: [['pine', 0.26], ['dead', 0.14], ['bush', 0.12, 'bush'], ['rock', 0.08], ['barrel', 0.07, 'barrel'], ['crate', 0.08, 'crate'], ['corpse', 0.08, 'corpse'], ['car', 0.06, 'car'], ['fence', 0.05], ['sign', 0.03], ['tires', 0.03]],
    gas: [['car', 0.2, 'car'], ['barrel', 0.09, 'barrel'], ['dumpster', 0.09, 'dumpster'], ['tires', 0.07], ['lamp', 0.1], ['sign', 0.05], ['crate', 0.09, 'crate'], ['corpse', 0.08, 'corpse'], ['fence', 0.06], ['fireb', 0.05], ['pine', 0.07], ['locker', 0.05, 'locker']],
    city: [['car', 0.18, 'car'], ['dumpster', 0.11, 'dumpster'], ['fridge', 0.07, 'fridge'], ['locker', 0.06, 'locker'], ['barrel', 0.07, 'barrel'], ['fireb', 0.08], ['corpse', 0.1, 'corpse'], ['sandbags', 0.06], ['lamp', 0.1], ['crate', 0.08, 'crate'], ['tires', 0.05], ['bench', 0.04]]
  };
  function img(k, r) { const p = P_()[k]; return Array.isArray(p) ? U.pick(p, r) : p; }
  function gen(loc, seed) {
    const r = U.rng(seed), props = [], back = [];
    const add = (k, x, loot, list) => (list || props).push({ k, im: img(k, r), x, loot: loot || null, done: false, flip: r() < 0.5 && !loot });
    if (loc.id === 'gas') {
      const cx = loc.len * 0.35; back.push({ k: 'canopy', im: P_().canopy, x: cx }); for (const dx of [-110, 110]) add('pump', cx + dx, 'pump');
      back.push({ k: 'shop', im: P_().shop, x: cx + 520, door: true, loot: 'door', done: false });
    }
    if (loc.id === 'city') for (let x = 260; x < loc.len - 100; x += 300 + r() * 70) back.push({ k: 'facade', im: U.pick(P_().facade, r), x, door: true, loot: r() < 0.75 ? 'door' : null, done: false });
    const set = SETS[loc.id];
    for (let x = 260; x < loc.len - 80;) {
      let q = r(), it = set[0]; for (const s of set) { q -= s[1]; if (q <= 0) { it = s; break; } }
      if (loc.id === 'gas' && Math.abs(x - loc.len * 0.35) < 320 && it[0] === 'pine') { x += 60; continue; }
      add(it[0], x, it[2]); x += 70 + r() * 120 + (it[0] === 'car' ? 90 : 0);
    }
    return { props, back };
  }
  EX.start = function (p, loc) {
    const s = SH.s, seed = (s.trips * 7919 + (s.t | 0)) | 0, g = gen(loc, seed), r = U.rng(seed + 1);
    SH.takeOut(p);
    const e = EX.e = { loc, p, x: 70, hp: p.hp, st: 100, stT: 0, face: 1, mv: 0, ph: 0, act: null, at: 0, hit: true, alt: false, inv: { scrap: 0, food: 0, water: 0, meds: 0 }, cnt: 0,
      cap: D.GEAR.pack.val[s.gear.pack], time: loc.time, props: g.props, back: g.back, mobs: [], fx: [], fl: [], decals: [], cam: 70, shake: 0, hitstop: 0, search: 0, sobj: null,
      found: 0, pops: [], hordeT: 3, xp: 0, kills: 0, inv0: 0, hurt: 0, roll: 0, stepI: 0, noise: 0, style: RIG.style(Object.assign({}, p.style, { pack: '#4a3c2a' })), seed: p.seed, rain: Math.random() < 0.3 };
    if (s.gear.armor > 0) e.style = RIG.style(Object.assign({}, p.style, { pack: '#4a3c2a', top: ['#5a4230', '#4a5038', '#3a4030'][s.gear.armor - 1], top2: ['#7a5a3e', '#5e6648', '#4a5240'][s.gear.armor - 1] }));
    for (let i = 0; i < loc.mobs; i++) {
      const x = 520 + r() * (loc.len - 620), q = r(), t = q < loc.mix[0] ? 'walker' : q < loc.mix[0] + loc.mix[1] ? 'runner' : 'brute';
      e.mobs.push(mob(t, x, r));
    }
    EX.in.l = EX.in.r = EX.in.act = EX.in.roll = false;
  };
  function mob(t, x, r) {
    return { t, M: D.MOB[t], x, home: x, hp: D.MOB[t].hp, face: r() < 0.5 ? -1 : 1, mv: 0, ph: r() * 6, act: null, at: 0, cd: 0, hurt: 0, dead: 0, kb: 0, st: 'idle', tt: r() * 3, gx: x, seed: r() * 9, style: SH.zStyle(t) };
  }

  /* ---------- Вспомогательные ---------- */
  function fl(x, y, t, c) { EX.e.fl.push({ x, y, t, c: c || '#fff', life: 1.6 }); }
  function parts(x, y, n, cols, sp, g, dir) {
    const F = EX.e.fx; for (let i = 0; i < n && F.length < 200; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4 + (dir || 0) * 0.7, v = sp * (0.4 + Math.random() * 0.6); F.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, c: cols[i % cols.length], s: 2 + Math.random() * 2.2, g: g === undefined ? 600 : g, blood: cols[0] === '#7a1010' }); }
  }
  function dust(x, n) { const F = EX.e.fx; for (let i = 0; i < n; i++) F.push({ x: x + (Math.random() - 0.5) * 20, y: -4, vx: (Math.random() - 0.5) * 50, vy: -10 - Math.random() * 20, life: 0.6, max: 0.6, s: 8 + Math.random() * 6, dust: 1 }); }
  function loot(o) {
    const e = EX.e, tab = D.LOOT[o.loot], k = 1 + e.loc.danger * 0.25, got = [];
    o.done = true; U.sfx('loot');
    for (const it of tab) if (Math.random() < it[3]) {
      const n0 = Math.round((it[1] + Math.random() * (it[2] - it[1])) * k), n = Math.min(n0, e.cap - e.cnt);
      if (n <= 0) { fl(o.x, -96, 'Рюкзак полон', '#ff8a7a'); break; }
      e.inv[it[0]] += n; e.cnt += n; got.push('+' + n + ' ' + D.RES[it[0]].toLowerCase());
    }
    if (o.loot === 'door' && e.loc.id === 'city' && Math.random() < 0.18) { e.found++; got.push('Выживший!'); }
    got.forEach((t, i) => fl(o.x, -92 - i * 15, t, t === 'Выживший!' ? '#9dff9a' : '#ffe9a8'));
    if (!got.length) fl(o.x, -92, 'Пусто', '#b9b39c');
    parts(o.x, -24, 6, ['#9a8a6a', '#6a6a64'], 90, 500);
  }
  function hurtPlayer(dmg, from, heavy) {
    const e = EX.e; if (e.roll > 0 || e.hp <= 0) return;
    dmg = Math.round(dmg * (1 - D.GEAR.armor.val[SH.s.gear.armor]));
    e.hp -= dmg; e.hurt = 0.35; e.act = 'hurt'; e.at = 0; e.search = 0; e.kbv = Math.sign(e.x - from) * (heavy ? 260 : 140);
    e.shake = heavy ? 0.45 : 0.28; e.hitstop = 0.06; U.sfx('hurt'); parts(e.x, -36, 9, ['#7a1010', '#4a0808'], 150, 600, Math.sign(e.x - from));
    fl(e.x, -84, '-' + dmg, '#ff7a6a'); ART.mkPop(e.pops, e.x + (Math.random() - 0.5) * 20, -78, 'hurt', heavy);
  }
  function hurtMob(m, dmg, crit, dir) {
    const e = EX.e; m.hp -= dmg; m.hurt = 0.3;
    if (m.t !== 'brute' || dmg >= 24) { m.act = 'hurt'; m.at = 0; }
    m.kb = dir * (m.t === 'brute' ? 80 : crit ? 300 : 220); if (m.st !== 'chase') { m.st = 'chase'; }
    e.shake = Math.max(e.shake, crit ? 0.3 : 0.15); e.hitstop = crit ? 0.08 : 0.045;
    U.sfx(crit ? 'crit' : 'hit'); parts(m.x, -38 * m.M.scale, crit ? 14 : 9, ['#7a1010', '#4a0808', '#961818'], 170, 600, dir);
    fl(m.x + 14, -70 * m.M.scale, '-' + dmg, crit ? '#ffb347' : '#e8d8d0');
    if (crit || Math.random() < 0.55) ART.mkPop(e.pops, m.x - dir * 6, -62 * m.M.scale, m.hp <= 0 ? 'kill' : crit ? 'crit' : 'hit', crit || m.hp <= 0);
    if (m.hp <= 0) { m.dead = 0.001; m.act = 'dead'; e.kills++; e.xp += m.M.xp; SH.s.kills++; e.decals.push({ x: m.x, w: 20 + Math.random() * 12 }); }
  }
  EX.heal = function () {
    const e = EX.e, s = SH.s; if (!e) return;
    if (s.res.meds < 1 || e.hp >= 100) { U.sfx('deny'); fl(e.x, -90, s.res.meds < 1 ? 'Нет аптечек' : 'Здоров', '#ff8a7a'); return; }
    s.res.meds--; e.hp = Math.min(100, e.hp + 45); fl(e.x, -90, '+45 здоровья', '#9dff9a'); U.sfx('good'); e.act = null;
  };
  EX.finish = function (ok) {
    const e = EX.e, s = SH.s, p = e.p, cap = SH.caps(), got = {};
    if (ok) for (const k in e.inv) { const n = e.inv[k]; if (!n) continue; const max = k === 'scrap' ? 1e9 : k === 'meds' ? cap.meds : cap.max; got[k] = Math.max(0, Math.min(n, max - s.res[k])); s.res[k] += got[k]; got.lost = (got.lost || 0) + n - got[k]; }
    p.xp += e.xp + (ok ? 10 * e.loc.danger : 0); SH.levelUp(p);
    s.trips++;
    SH.comeBack(p, ok ? Math.max(16, Math.round(e.hp)) : 12);
    let who = 0;
    if (ok) for (let i = 0; i < e.found; i++) { if (s.ppl.length >= cap.beds) break; const n = SH.person(D.WORLD_W + 60 + i * 40, 0, 0); n.surf = true; n.climb = false; n.y = 0; n.tx = 2 * D.CW + 70; who++; }
    const res = { ok, p, got, who, kills: e.kills, loc: e.loc, lostAll: !ok && e.cnt > 0 };
    EX.e = null; EX.in.l = EX.in.r = EX.in.act = false;
    if (EX.onEnd) EX.onEnd(res);
  };

  /* ---------- Шаг ---------- */
  EX.update = function (dt) {
    const e = EX.e; if (!e) return;
    if (e.hitstop > 0) { e.hitstop -= dt; return; }
    const I = EX.in, s = SH.s, W = SH.weapon(), p = e.p, night = SH.dark > 0.5;
    if (e.shake > 0) e.shake -= dt; if (e.hurt > 0) e.hurt -= dt;
    e.time -= dt;
    // орда после заката отведённого времени
    if (e.time <= 0) { e.hordeT -= dt; if (e.hordeT <= 0) { e.hordeT = 3.2; const m = mob('runner', Math.min(e.loc.len + 100, e.x + 520), Math.random); m.st = 'chase'; e.mobs.push(m); U.sfx('growl'); } }
    // выносливость
    if (e.stT > 0) e.stT -= dt; else e.st = Math.min(100, e.st + 28 * dt);
    const f = e.face;
    // ближайший враг впереди и тайник рядом
    let near = null, nd = 1e9, obj = null, od = 54;
    for (const m of e.mobs) { if (m.dead) continue; const d = Math.abs(m.x - e.x); if (d < nd) { nd = d; near = m; } }
    for (const o of e.props.concat(e.back)) if (o.loot && !o.done && Math.abs(o.x - e.x) < (o.door ? 44 : od)) { obj = o; od = Math.abs(o.x - e.x); }
    const atExit = e.x < 140, danger = near && nd < 120;
    e.hint = atExit && !danger ? 'Уйти' : obj && !danger ? 'Обыскать' : 'Удар';
    // перекат
    if (I.roll && e.roll <= 0 && e.act !== 'hurt') {
      I.roll = false;
      if (e.st >= 25) { const dir = I.l ? -1 : I.r ? 1 : f; e.face = dir; e.roll = 0.42; e.st -= 25; e.stT = 0.5; e.act = 'roll'; e.at = 0; e.search = 0; U.sfx('roll'); dust(e.x, 4); }
      else { fl(e.x, -90, 'Нет сил', '#ff8a7a'); U.sfx('deny'); }
    }
    I.roll = false;
    let dir = 0;
    if (e.roll > 0) {
      e.roll -= dt; e.at = 1 - e.roll / 0.42; e.x += e.face * (420 * (e.roll / 0.42) + 60) * dt;
      if (e.roll <= 0) { e.act = null; dust(e.x, 3); }
    } else if (e.act === 'hurt') {
      e.at += dt / 0.35; e.x += (e.kbv || 0) * dt; e.kbv *= Math.pow(0.01, dt); if (e.at >= 1) e.act = null;
    } else {
      const searching = I.act && obj && !danger && !(atExit && !danger) && (e.act === null || e.act === 'search');
      if (searching) {
        if (e.sobj !== obj) { e.sobj = obj; e.search = 0; }
        e.act = 'search'; e.face = obj.x > e.x ? 1 : -1; e.search += dt / Math.max(0.7, (obj.door ? 2.4 : 1.6) - p.A * 0.08);
        e.noise += dt; if (Math.random() < dt * 5) U.sfx('search');
        if (e.search >= 1) { loot(obj); e.search = 0; e.act = null; }
      } else {
        if (e.act === 'search') { e.act = null; e.search = 0; }
        dir = (I.r ? 1 : 0) - (I.l ? 1 : 0);
        if (I.act && I.actP && atExit && !danger) { EX.finish(true); return; }
        if (I.act && !e.act && (I.actP || danger)) {
          const cost = W.two ? 16 : 10;
          if (e.st >= cost) { e.act = W.act; e.at = 0; e.hit = false; e.alt = !e.alt; e.st -= cost; e.stT = 0.45; U.sfx('swing'); if (near && nd < 140) e.face = Math.sign(near.x - e.x) || f; }
          else if (I.actP) { fl(e.x, -90, 'Нет сил', '#ff8a7a'); U.sfx('deny'); }
        }
      }
      if (e.act === 'swing' || e.act === 'punch') {
        e.at += dt / W.dur;
        if (!e.hit && e.at >= 0.48) {
          e.hit = true; let n = 0;
          for (const m of e.mobs) {
            if (m.dead) continue; const dx = (m.x - e.x) * e.face;
            if (dx > -10 && dx < W.reach + 14 * m.M.scale) {
              const unaware = m.st !== 'chase' && Math.sign(m.x - e.x) === m.face, base = Math.round(W.dmg * SH.statMul(p.S));
              const crit = unaware || Math.random() < 0.12, dmg = Math.round(base * (unaware ? 2.6 : crit ? 1.6 : 1));
              if (unaware) fl(m.x, -108, 'Тихий удар', '#ffb347');
              hurtMob(m, dmg, crit, e.face); if (++n >= (W.two ? 2 : 1)) break;
            }
          }
          e.noise += 0.6;
        }
        if (e.at >= 1) e.act = null;
      }
      if (dir) {
        const sp = (118 + p.A * 4) * (e.act ? 0.3 : 1) * (e.hp < 25 ? 0.8 : 1);
        e.x += dir * sp * dt; if (!e.act) e.face = dir; e.ph += dt * sp * 0.12;
        const si = Math.floor(e.ph / Math.PI); if (si !== e.stepI) { e.stepI = si; U.sfx('step'); if (Math.random() < 0.5) dust(e.x - e.face * 6, 1); }
      }
    }
    e.x = clamp(e.x, 20, e.loc.len + 60);
    e.mv += ((dir && !e.act ? 1 : dir ? 0.4 : 0) - e.mv) * Math.min(1, dt * 12);
    I.actP = false;
    // шум будит мертвецов
    if (e.noise > 0) { for (const m of e.mobs) if (!m.dead && m.st === 'idle' && Math.abs(m.x - e.x) < 200 + e.noise * 160) { m.st = 'chase'; if (Math.random() < 0.5) U.sfx('growl'); } e.noise = Math.max(0, e.noise - dt * 2); }
    // мертвецы
    for (let i = e.mobs.length - 1; i >= 0; i--) {
      const m = e.mobs[i], M = m.M;
      if (m.dead) { m.dead += dt; if (m.dead > 8) e.mobs.splice(i, 1); continue; }
      if (m.hurt > 0) m.hurt -= dt;
      m.x += m.kb * dt; m.kb *= Math.pow(0.004, dt);
      const dx = e.x - m.x, ad = Math.abs(dx); let sp = 0;
      if (m.act === 'hurt') { m.at += dt / 0.32; if (m.at >= 1) m.act = null; }
      if (m.st === 'idle') {
        const sees = Math.sign(dx) === m.face ? 270 : 110;
        if (ad < sees * (night ? 1.2 : 1) * (e.act === 'search' ? 1.4 : 1)) { m.st = 'chase'; U.sfx('growl'); m.alertT = 1.2; }
        m.tt -= dt; if (m.tt <= 0) { m.tt = 2 + Math.random() * 4; m.gx = m.home + (Math.random() - 0.5) * 200; }
        if (Math.abs(m.gx - m.x) > 6) { m.face = Math.sign(m.gx - m.x); sp = M.sp * 0.5; }
      } else {
        if (m.act !== 'lunge') m.face = Math.sign(dx) || 1;
        if (ad > 760) m.st = 'idle';
        if (m.cd > 0) m.cd -= dt;
        if (m.act === 'lunge') {
          const b = m.at; m.at += dt / (M.wind + 0.4);
          if (m.at > 0.45 && m.at < 0.6 && ad > 20) sp = M.run * 1.6;
          if (b < 0.5 && m.at >= 0.5 && ad < M.reach && Math.sign(dx) === m.face) hurtPlayer(M.dmg * (night ? 1.15 : 1), m.x, m.t === 'brute');
          if (m.at >= 1) { m.act = null; m.cd = m.t === 'runner' ? 0.3 : 0.6; }
        } else if (m.act !== 'hurt') {
          if (ad > M.reach - 8) sp = M.run * (night ? 1.15 : 1);
          else if (m.cd <= 0) { m.act = 'lunge'; m.at = 0; }
        }
      }
      if (m.act === 'hurt') sp = 0;
      m.x += (m.act === 'lunge' ? m.face : Math.sign(sp ? (m.st === 'idle' ? m.gx - m.x : dx) : 0)) * sp * dt;
      // не слипаются
      for (const o of e.mobs) if (o !== m && !o.dead && Math.abs(o.x - m.x) < 20) m.x += Math.sign(m.x - o.x || 1) * 30 * dt;
      m.mv += ((sp > 1 ? Math.min(1.3, sp / 80) : 0) - m.mv) * Math.min(1, dt * 8); if (sp > 1) m.ph += dt * sp * 0.13;
    }
    // частицы
    for (let i = e.fx.length - 1; i >= 0; i--) {
      const q = e.fx[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g || 0) * dt;
      if (q.y > 0 && q.g) { if (q.blood && Math.random() < 0.3 && e.decals.length < 80) e.decals.push({ x: q.x, w: 2 + Math.random() * 4 }); q.y = 0; q.vy = 0; q.vx *= 0.5; q.g = 0; }
      if (q.life <= 0) { e.fx[i] = e.fx[e.fx.length - 1]; e.fx.pop(); }
    }
    ART.stepPops(e.pops, dt); for (const m of e.mobs) if (m.alertT > 0) m.alertT -= dt;
    for (let i = e.fl.length - 1; i >= 0; i--) { const q = e.fl[i]; q.life -= dt; q.y -= dt * 20; if (q.life <= 0) e.fl.splice(i, 1); }
    if (e.hp <= 0) { e.hp = 0; EX.finish(false); }
  };

  /* ---------- Отрисовка ---------- */
  let lc = null, lx = null;
  EX.render = function (x, V, dt) {
    const e = EX.e, A = ART, z = V.h / 300, gy = Math.round(V.h * 0.8), hw = V.w / 2 / z, tm = SH.s.t;
    e.cam += (e.x + e.face * 70 - e.cam) * Math.min(1, dt * 3.5 + 0.01);
    const cx = clamp(e.cam, hw - 220, e.loc.len + 220 - hw) + (e.shake > 0 ? (Math.random() - 0.5) * e.shake * 24 : 0), left = cx - hw, right = cx + hw;
    const sk = ART.sky(SH.ph), kind = e.loc.id;
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    ART.drawSky(x, V.w, gy, cx, sk); ART.drawLayers(x, kind, V.w, gy, cx, z, sk);
    if (e.rain) { x.fillStyle = 'rgba(40,48,58,.35)'; x.fillRect(0, 0, V.w, gy); }
    else if (sk.dark < 0.45) {   // солнечные лучи
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { const rx = ((i * 397 + 120 - cx * 0.15 * z) % (V.w + 400) + V.w + 400) % (V.w + 400) - 200; x.save(); x.translate(rx, -20); x.rotate(-0.38); x.globalAlpha = (0.45 - sk.dark) * (0.12 + 0.06 * Math.sin(tm * 0.3 + i)); x.drawImage(A.ray, -V.w * 0.03, 0, V.w * (0.05 + (i % 3) * 0.03), gy * 1.5); x.restore(); }
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    }
    x.setTransform(z, 0, 0, z, Math.round(-left * z), gy);
    const gt = A.ground[kind]; for (let g0 = Math.floor(left / 256) * 256; g0 < right; g0 += 256) x.drawImage(gt, g0, -10, 257, 140);
    x.fillStyle = '#1a1612'; x.fillRect(left, 128, right - left, (V.h - gy) / z);
    ART.put(x, A.P.van, 60, 2);
    const vis = o => o.x > left - 320 && o.x < right + 320;
    for (const o of e.back) if (vis(o)) { ART.put(x, o.im, o.x, 3); if (o.loot && !o.done) marker(x, o.x, -70, tm); else if (o.door && o.done) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(o.x - 26, -78, 52, 78); } }
    for (const d of e.decals) if (d.x > left && d.x < right) { x.fillStyle = 'rgba(70,8,6,.8)'; x.beginPath(); x.ellipse(d.x, 1, d.w, 2.2, 0, 0, 6.283); x.fill(); }
    for (const o of e.props) if (vis(o)) {
      if (o.done && o.k === 'bush') { ART.put(x, A.P.bush0, o.x, 3); continue; }
      ART.put(x, o.im, o.x, 3, 1, o.flip); if (o.done) { x.globalAlpha = 0.35; x.fillStyle = '#000'; x.fillRect(o.x - 6, -10, 12, 3); x.globalAlpha = 1; }
      if (o.loot && !o.done) marker(x, o.x, -o.im.ay - 12, tm);
      if (o.k === 'fireb') fire(x, o.x, -42, tm);
    }
    // туман у земли
    x.globalAlpha = 0.2 + sk.dark * 0.12 + (e.rain ? 0.12 : 0);
    for (let i = 0; i < 6; i++) { const mx = ((i * 613 + tm * 7) % (e.loc.len + 900)) - 450; if (mx > left - 300 && mx < right + 300) x.drawImage(A.mist, mx - 300, -64, 600, 100); }
    x.globalAlpha = 1;
    // мертвецы и игрок
    for (const m of e.mobs) {
      if (m.x < left - 60 || m.x > right + 60) continue;
      const P = RIG.pose({ mv: m.mv, ph: m.ph, act: m.act, t: m.at, time: tm, seed: m.seed, zombie: true });
      if (!m.dead) { x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(m.x, 1, 16 * m.M.scale, 3.4, 0, 0, 6.283); x.fill(); }
      x.save(); x.translate(m.x, 0); x.scale(m.M.scale, m.M.scale); if (m.dead) x.globalAlpha = Math.max(0, Math.min(1, (8 - m.dead) / 2));
      RIG.draw(x, m.style, P, m.face, null);
      if (m.hurt > 0) { x.globalAlpha = Math.min(0.7, m.hurt * 2.4); RIG.draw(x, RIG.white, P, m.face, null); }
      x.restore(); x.globalAlpha = 1;
      if (!m.dead && m.hp < m.M.hp) { const by = -82 * m.M.scale; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(m.x - 17, by, 34, 5); x.fillStyle = '#b01e22'; x.fillRect(m.x - 16, by + 1, 32 * m.hp / m.M.hp, 3); }
      if (m.act === 'lunge' && m.at < 0.45) ART.bubble(x, m.x + 8, -84 * m.M.scale, '!', 15, Math.sin(tm * 30) > 0 ? '#ffd43a' : '#ff6a4a');
      else if (m.alertT > 0 && !m.dead) ART.bubble(x, m.x + 8, -84 * m.M.scale, '!', 14);
      else if (m.st === 'idle' && !m.dead && Math.abs(m.x - e.x) < 300) ART.bubble(x, m.x + 10, -82 * m.M.scale + Math.sin(tm * 2 + m.seed) * 2, '…', 10);
    }
    const W = SH.weapon(), P = RIG.pose({ mv: e.mv, ph: e.ph, act: e.act, t: e.act === 'search' ? 0 : e.at, time: tm, seed: e.seed, two: W.two, alt: e.alt });
    x.fillStyle = 'rgba(0,0,0,.38)'; x.beginPath(); x.ellipse(e.x, 1, e.act === 'roll' ? 20 : 16, 3.4, 0, 0, 6.283); x.fill();
    x.save(); x.translate(e.x, 0);
    RIG.draw(x, e.style, P, e.face, e.act === 'search' ? null : W.tool);
    if (e.hurt > 0) { x.globalAlpha = Math.min(0.6, e.hurt * 2); RIG.draw(x, RIG.white, P, e.face, null); x.globalAlpha = 1; }
    x.restore();
    if (e.act === 'roll') { x.strokeStyle = 'rgba(10,8,6,.7)'; x.lineWidth = 1.6; for (let i = 0; i < 6; i++) { const yy = -8 - i * 9, l = 26 + ((i * 17) % 30); x.beginPath(); x.moveTo(e.x - e.face * 16, yy); x.lineTo(e.x - e.face * (16 + l), yy); x.stroke(); } }
    // след удара
    if ((e.act === 'swing') && e.at > 0.38 && e.at < 0.62 && W.tool) {
      x.strokeStyle = 'rgba(240,235,220,' + (0.55 * (1 - Math.abs(e.at - 0.48) * 6)) + ')'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath();
      for (let k = 0; k <= 6; k++) { const tt = Math.max(0.3, e.at - 0.14 + k * 0.024), PP = RIG.pose({ act: 'swing', t: tt, two: W.two }), tp = RIG.tip(PP, e.face, 34); k ? x.lineTo(e.x + tp[0], tp[1]) : x.moveTo(e.x + tp[0], tp[1]); }
      x.stroke();
    }
    if (e.search > 0) { x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 6; x.beginPath(); x.arc(e.x, -96, 11, 0, 6.283); x.stroke(); x.strokeStyle = '#ffd24a'; x.lineWidth = 4; x.beginPath(); x.arc(e.x, -96, 11, -1.571, -1.571 + e.search * 6.283); x.stroke(); }
    // частицы
    for (const q of e.fx) {
      if (q.dust) { const k = q.s * (1.8 - q.life / q.max); x.globalAlpha = q.life / q.max * 0.6; x.drawImage(A.dust, q.x - k, q.y - k, k * 2, k * 2); }
      else { x.globalAlpha = Math.min(1, q.life * 3); x.fillStyle = q.c; x.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
    }
    x.globalAlpha = 1;
    // передний план (быстрее камеры)
    { const fg = A.fg[kind], k = 1.3, fw = 800, fo = cx * k; let g0 = Math.floor((fo - hw * k) / fw) * fw;
      for (; g0 < fo + hw * k + fw; g0 += fw) x.drawImage(fg, cx + (g0 - fo), (V.h - gy) / z - 96, fw, 100); }
    // надписи
    ART.drawPops(x, e.pops);
    x.font = 'italic 900 12px sans-serif'; x.textAlign = 'center'; x.lineWidth = 4; x.lineJoin = 'round'; x.strokeStyle = '#0a0806';
    for (const q of e.fl) { x.globalAlpha = Math.min(1, q.life * 2); x.strokeText(q.t, q.x, q.y); x.fillStyle = q.c; x.fillText(q.t, q.x, q.y); }
    x.globalAlpha = 1;
    if (atExitHint(e)) { x.fillStyle = '#e8c46a'; x.font = '900 12px sans-serif'; x.fillText('▼ К машине — уйти', 60, -100 + Math.sin(tm * 4) * 3); }
    // освещение: ночь, фонарь, огонь
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = { forest: 'rgba(40,80,50,.07)', gas: 'rgba(110,80,40,.07)', city: 'rgba(40,55,90,.09)' }[kind]; x.fillRect(0, 0, V.w, V.h);
    if (e.rain) {
      x.fillStyle = 'rgba(20,28,38,.18)'; x.fillRect(0, 0, V.w, V.h);
      x.strokeStyle = 'rgba(190,205,220,.32)'; x.lineWidth = Math.max(1, z * 0.8); x.beginPath();
      const L = 26 * z; for (let i = 0; i < 110; i++) { const rx = ((i * 197.3 + tm * 240 - cx * z) % (V.w + 80) + V.w + 80) % (V.w + 80) - 40, ry = ((i * 113.7 + tm * (1400 + (i % 7) * 70)) % (V.h + 60)) - 30; x.moveTo(rx, ry); x.lineTo(rx - L * 0.2, ry + L); }
      x.stroke();
      x.strokeStyle = 'rgba(200,215,230,.35)'; x.lineWidth = 1; for (let i = 0; i < 14; i++) { const ph = (tm * 1.7 + i * 0.37) % 1, rx = ((i * 271 + Math.floor(tm * 1.7 + i * 0.37) * 131) % V.w), rr2 = ph * 9 * z; x.globalAlpha = 1 - ph; x.beginPath(); x.ellipse(rx, gy + 4 * z, rr2, rr2 * 0.3, 0, 0, 6.283); x.stroke(); } x.globalAlpha = 1;
    }
    const dark = sk.dark;
    if (dark > 0.05) {
      const q = 3, lw = Math.ceil(V.w / q), lh = Math.ceil(V.h / q);
      if (!lc) { [lc, lx] = U.canvas(lw, lh, 1); }
      if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, lw, lh);
      lx.fillStyle = 'rgba(4,7,16,' + dark * 0.9 + ')'; lx.fillRect(0, 0, lw, lh);
      lx.globalCompositeOperation = 'destination-out';
      const sx = (e.x - left) * z / q, sy = (gy - 40 * z) / q;
      lx.globalAlpha = 0.6; lx.drawImage(A.soft, sx - 70 * z / q, sy - 70 * z / q, 140 * z / q, 140 * z / q);
      lx.save(); lx.translate(sx + e.face * 6 * z / q, sy - 12 * z / q); lx.scale(e.face, 1); lx.globalAlpha = 0.9; lx.drawImage(A.cone, 0, -150 * z / q, 300 * z / q, 300 * z / q); lx.restore();
      for (const o of e.props) if (o.k === 'fireb' && vis(o)) { const fx = (o.x - left) * z / q, r = (130 + Math.sin(tm * 9 + o.x) * 8) * z / q; lx.globalAlpha = 0.95; lx.drawImage(A.soft, fx - r, gy / q - 50 * z / q - r, r * 2, r * 2); }
      lx.globalAlpha = 1; x.drawImage(lc, 0, 0, V.w, V.h);
    }
    x.globalCompositeOperation = 'lighter';
    for (const o of e.props) if (o.k === 'fireb' && vis(o)) { const r = (90 + Math.sin(tm * 11 + o.x) * 6) * z; x.globalAlpha = 0.3 + dark * 0.4; x.drawImage(A.fireGlow, (o.x - left) * z - r, gy - 50 * z - r, r * 2, r * 2); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    if (e.time <= 0) { x.fillStyle = 'rgba(140,20,16,' + (0.08 + 0.05 * Math.sin(tm * 5)) + ')'; x.fillRect(0, 0, V.w, V.h); }
  };
  function atExitHint(e) { return e.x < 400 && (e.cnt > 0 || e.time < 30); }
  function marker(x, px, py, tm) {
    const y = py + Math.sin(tm * 4 + px) * 3;
    x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.moveTo(px, y - 9); x.lineTo(px + 8, y); x.lineTo(px, y + 9); x.lineTo(px - 8, y); x.fill();
    x.fillStyle = '#ffd24a'; x.beginPath(); x.moveTo(px, y - 7); x.lineTo(px + 6, y); x.lineTo(px, y + 7); x.lineTo(px - 6, y); x.fill();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(px - 1, y - 4, 2, 4);
  }
  function fire(x, px, py, tm) {
    for (let i = 0; i < 3; i++) {
      const f = tm * 9 + px + i * 2, h = [22, 15, 9][i] + Math.sin(f) * 3, w = [9, 6.5, 3.5][i], sw = Math.sin(f * 0.7) * 2;
      x.fillStyle = ['#ff6a12', '#ffb02e', '#fff2b0'][i]; x.beginPath(); x.moveTo(px - w, py); x.quadraticCurveTo(px - w * 1.1, py - h * 0.5, px + sw, py - h); x.quadraticCurveTo(px + w * 1.1, py - h * 0.5, px + w, py); x.fill();
    }
    if (Math.random() < 0.3 && EX.e.fx.length < 200) EX.e.fx.push({ x: px + (Math.random() - 0.5) * 10, y: py - 10, vx: (Math.random() - 0.5) * 20, vy: -60, life: 0.8, c: '#ffb347', s: 1.6, g: -20 });
  }
})();
