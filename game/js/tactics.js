'use strict';
/* Тактика противника: мутанты обходят с флангов и устраивают засады, бандиты и клан берут раненых бойцов
   в заложники, СОБР ставит дымовую завесу и отходит перевязаться.
   Крючки — в battle.js (обзор сквозь дым, меткость, выстрел, гибель, отброс, помощь раненому), ai.js (начало хода
   врага, ход бойца, патруль), render_battle.js (дым и заложник в 2D), r3d/tr3.js (дым и метка в 3D),
   r3d/units.js (утащенного не рисовать).
   Состояние — простой JSON в бою B (переживает сохранение посреди боя):
     B.smoke = { индекс клетки: ходов осталось }, B.smokeV — счётчик изменений (для кэша маски дыма);
     B.amb = { pod: сколько ходов ещё сидеть в засаде (> 0) или −1 — засады нет };
     боец: u.hostageOf = id захватчика, u.captured = true — утащили с поля (кампания сделает из этого спасение);
     враг: e.holding = id заложника, e.fled — ушёл с заложником за край карты, e.smk — брошено дымовых,
           e.bandaged — уже перевязывался, e.shotAt — ход, когда по нему стреляли, e.tacHp — ОЗ в начале прошлого хода,
           e.ambNow — выскочил из засады в этот ход. */
(function (DW) {
  const U = DW.U, D = DW.D;
  const TAC = {};
  const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  const cheb = function (a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); };
  function unitById(B, id) {
    if (!id) return null;
    for (let i = 0; i < B.units.length; i++) if (B.units[i].id === id) return B.units[i];
    return null;
  }
  const isBeast = function (e) { const T = D.ENEMIES[e.type]; return !!T && !!T.beast; };
  const isSobr = function (e) { const T = D.ENEMIES[e.type]; return !!T && T.fac === 'sobr'; };
  // заложников берут люди: банда и клан (СОБР — нет)
  const HOST_TYPES = { raider: 1, thug: 1, marksman: 1, boss: 1 };
  const takesHostages = function (e) { const T = D.ENEMIES[e.type]; return !!T && (!!HOST_TYPES[e.type] || T.fac === 'clan'); };
  function meleeAdj(BT, ax, ay, t) {
    const dx = t.x - ax, dy = t.y - ay;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
    if (dx && dy && !BT.walkTile(ax + dx, ay) && !BT.walkTile(ax, ay + dy)) return false;
    return true;
  }
  function seenAt(BT, x, y) { const v = BT.vis(); return !!(v && v[BT.idx(x, y)]); }

  /* ================= Дым ================= */
  let mB = null, mV = -1, mask = null;
  const mList = [];   // клетки дыма по глубине (x + y) — для отрисовки
  /* маска дыма (Uint8Array, ходов осталось) — кэш по бою и версии; null — дыма нет */
  TAC.smokeMask = function () {
    const B = DW.BT.get();
    if (!B || !B.smoke) return null;
    const n = B.w * B.h;
    if (mB !== B || mV !== (B.smokeV || 0) || !mask || mask.length !== n) {
      mB = B; mV = B.smokeV || 0;
      if (!mask || mask.length !== n) mask = new Uint8Array(n); else mask.fill(0);
      mList.length = 0;
      for (const k in B.smoke) { const i = +k; if (B.smoke[k] > 0 && i >= 0 && i < n) { mask[i] = Math.min(255, B.smoke[k]); mList.push(i); } }
      mList.sort(function (a, b) { return (a % B.w + ((a / B.w) | 0)) - (b % B.w + ((b / B.w) | 0)); });
    }
    return mask;
  };
  TAC.inSmoke = function (x, y) {
    const B = DW.BT.get();
    if (!B || !B.smoke || x < 0 || y < 0 || x >= B.w || y >= B.h) return false;
    const m = TAC.smokeMask();
    return !!(m && m[y * B.w + x]);
  };
  /* дымовая завеса: клетки в радиусе r от точки на turns пар ходов (враг + отряд) */
  TAC.addSmoke = function (cx, cy, r, turns) {
    const BT = DW.BT, B = BT.get();
    B.smoke = B.smoke || {};
    const R = Math.ceil(r);
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (!BT.inb(x, y) || U.dist(x, y, cx, cy) > r + 0.01) continue;
      const i = BT.idx(x, y);
      B.smoke[i] = Math.max(B.smoke[i] || 0, turns);
    }
    B.smokeV = (B.smokeV || 0) + 1;
    BT.updateVision();
  };
  /* начало хода врага: дым редеет, через две пары ходов рассеивается */
  function smokeTick(B) {
    if (!B.smoke) return;
    let n = 0;
    for (const k in B.smoke) { B.smoke[k]--; if (B.smoke[k] <= 0) delete B.smoke[k]; else n++; }
    if (!n) delete B.smoke;
    B.smokeV = (B.smokeV || 0) + 1;
    DW.BT.updateVision();
  }

  /* ================= Меткость и выстрелы (крючки battle.js) ================= */
  /* живой ли ещё заложник у захватчика e (раненый, не умер) */
  function heldBy(e) {
    if (!e || !e.holding) return null;
    const B = DW.BT.get(), h = unitById(B, e.holding);
    return h && h.hostageOf === e.id && !h.alive && !h.captured && (h.down > 0 || h.stable) ? h : null;
  }
  TAC.hitMod = function (att, tgt, parts) {
    const B = DW.BT.get();
    let m = 0;
    if (B && B.smoke && TAC.inSmoke(tgt.x, tgt.y)) { m -= 20; parts.push(['Дым', -20]); }
    if (tgt.holding && att.side !== tgt.side && heldBy(tgt)) { m -= 20; parts.push(['Живой щит', -20]); }
    return m;
  };
  /* после выстрела: «под огнём» (для СОБР); промах по захватчику может задеть заложника */
  TAC.afterShot = async function (att, tgt, hit, o) {
    const B = DW.BT.get();
    if (!B || !tgt) return;
    if (tgt.side === 'e') tgt.shotAt = B.turn;
    if (hit || (o && o.suppress) || !tgt.holding || att.side === tgt.side) return;
    const h = heldBy(tgt);
    if (!h || Math.random() >= 0.25) return;
    DW.TR.float(h.x, h.y, 'Попали в заложника!', 'bad');
    DW.TR.decal(h.x, h.y, 'red', 0.6);
    DW.SFX.play('hit');
    if (h.stable) { h.stable = false; DW.UI.toast('Пуля задела «' + h.name + '» — рана снова кровит!', 'alert'); }
    else h.down = Math.max(0, h.down - 1);
    if (h.down <= 0) {
      h.down = 0;
      DW.UI.toast('«' + h.name + '» погиб от шальной пули.', 'bad');
      TAC.release(tgt, true);
    }
    await U.sleep(260);
  };
  /* захватчик убит или отброшен — заложник свободен (и по-прежнему ранен) */
  TAC.release = function (e, quiet) {
    const B = DW.BT.get();
    const h = B ? unitById(B, e.holding) : null;
    delete e.holding;
    if (!h || h.hostageOf !== e.id) return;
    delete h.hostageOf;
    if (!quiet && (h.down > 0 || h.stable)) {
      DW.TR.float(h.x, h.y, 'Заложник освобождён', 'good');
      DW.UI.toast('«' + h.name + '» освобождён — помогите ему, пока не истёк кровью.', 'good');
    }
  };
  TAC.onKill = function (u) { if (u && u.holding) TAC.release(u); };
  TAC.onKnock = function (u) { if (u && u.holding) TAC.release(u); };

  /* ================= Начало хода врага (крючок ai.js) ================= */
  let hurtNow = {}, smokeTurn = -1, smokeB = null, ambRevealed = false;
  TAC.turnStart = async function () {
    const BT = DW.BT, B = BT.get();
    if (!B) return;
    ambRevealed = false;
    smokeTick(B);
    hurtNow = {};
    for (let k = 0; k < B.units.length; k++) {
      const e = B.units[k];
      if (e.side !== 'e') continue;
      // захватчик погиб / ушёл / оказался не рядом с телом — заложник свободен
      if (e.holding) { const h = heldBy(e); if (!e.alive || !h || cheb(e, h) > 1) TAC.release(e, !e.alive || !h); }
      if (e.alive && isSobr(e)) { if (e.tacHp !== undefined && e.hp < e.tacHp) hurtNow[e.id] = 1; e.tacHp = e.hp; }
    }
    ambushTick(B);
  };
  /* патруль: группа в засаде сидит тихо (крючок AI.patrol) */
  TAC.holdPod = function (mem) {
    const B = DW.BT.get();
    return !!(B && B.amb && mem && mem.length && B.amb[mem[0].pod] > 0);
  };

  /* ================= Засада мутантов ================= */
  function ambushTick(B) {
    const BT = DW.BT;
    if (B.kind === 'defense') return;
    const sol = BT.soldiers();
    if (!sol.length) return;
    const pods = {};
    B.units.forEach(function (e) { if (e.side === 'e' && e.alive && !e.active) (pods[e.pod] = pods[e.pod] || []).push(e); });
    const sprung = [];
    for (const pid in pods) {
      const mem = pods[pid];
      // засаду устраивают стаи мутантов (Матка не прячется)
      if (!mem.every(isBeast) || mem.some(function (m) { return D.ENEMIES[m.type].boss; })) continue;
      const near = function (r) { return mem.some(function (m) { return sol.some(function (s) { return U.dist(s.x, s.y, m.x, m.y) <= r + 0.01; }); }); };
      B.amb = B.amb || {};
      let st = B.amb[pid];
      if (st === undefined) {
        // отряд подходит, а стаю ещё не заметили — затаиться (или бродить, как обычно)
        if (!near(12) || mem.some(function (m) { return m.seen; })) continue;
        st = B.amb[pid] = Math.random() < 0.6 ? 6 : -1;
      }
      if (st <= 0) continue;
      if (near(4.5)) { B.amb[pid] = -1; sprung.push(mem); continue; }
      // долго никто не идёт — засада снимается, стая снова бродит
      B.amb[pid] = st - 1 > 0 ? st - 1 : -1;
    }
    if (!sprung.length) return;
    sprung.forEach(function (mem) { mem.forEach(function (m) { m.active = true; m.ambNow = 1; }); });
    if (B.concealed) { BT.reveal('Засада!'); ambRevealed = true; }
  }
  /* выскочивший из засады стал виден — «Засада!» (один раз на стаю) */
  function announce(e) {
    if (!e.ambNow || !e.alive || !e.seen) return;
    const B = DW.BT.get();
    B.units.forEach(function (m) { if (m.pod === e.pod) delete m.ambNow; });
    DW.TR.float(e.x, e.y, 'Засада!', 'bad');
    DW.SFX.play('growl');
    if (!ambRevealed) DW.UI.toast('Засада! Мутанты выскочили из укрытия!', 'alert');
    if (DW.Music) { DW.Music.sting('contact'); DW.Music.intensity(1); }
    const sp = DW.BT.soldiers()[0];
    if (sp) DW.TR.bark(sp, 'contactBeast');
  }

  /* ================= Мутанты: фланг и стая вразброс ================= */
  function crowd(mates, x, y) {
    let n = 0;
    for (let k = 0; k < mates.length; k++) if (Math.max(Math.abs(mates[k].x - x), Math.abs(mates[k].y - y)) <= 1) n++;
    return n;
  }
  async function beastMelee(e) {
    const BT = DW.BT, B = BT.get();
    const ts = BT.players();
    if (!ts.length) { e.ap = 0; return false; }
    const adj = ts.filter(function (t) { return meleeAdj(BT, e.x, e.y, t); });
    if (adj.length) {
      announce(e);
      adj.sort(function (a, b) { return a.hp - b.hp; });
      await BT.melee(e, adj[0]);
      e.ap = 0;
      return true;
    }
    const mates = B.units.filter(function (o) { return o !== e && o.alive && o.side === 'e' && isBeast(o); });
    // стая: рядом ещё двое зверей — бегут быстрее
    const pack = mates.filter(function (o) { return U.dist(o.x, o.y, e.x, e.y) <= 3; }).length >= 2;
    const R = BT.reach(e, (e.mob + (pack ? 1 : 0)) * e.ap);
    let best = null;
    ts.forEach(function (t) {
      let around = 0;
      for (let k = 0; k < mates.length; k++) if (cheb(mates[k], t) <= 1) around++;
      DIR8.forEach(function (d) {
        const x = t.x + d[0], y = t.y + d[1];
        if (!BT.canEnd(R, x, y) || !meleeAdj(BT, x, y, t)) return;
        const c = R.cost[BT.idx(x, y)];
        let score = c + t.hp * 0.25 + (t.kind === 'turret' ? 3 : 0) + Math.random();
        // с фланга: оттуда, где у цели нет укрытия
        const cv = BT.coverAt(t.x, t.y, x, y).cover;
        score += cv === 2 ? 2 : (cv === 1 ? 1 : -1.5);
        // не в кучу: соседей по стае рядом с клеткой и у цели — меньше
        score += crowd(mates, x, y) * 0.8 + around * 0.5;
        if (!best || score < best.score) best = { x: x, y: y, c: c, t: t, score: score };
      });
    });
    if (best) {
      const apUsed = best.c <= e.mob + 0.01 ? 1 : 2;
      await BT.move(e, BT.pathTo(R, best.x, best.y));
      e.ap -= apUsed;
      if (!e.alive || B.over) return false;
      announce(e);
      if (e.ap >= 1 && best.t.alive && !best.t.evac && meleeAdj(BT, e.x, e.y, best.t)) await BT.melee(e, best.t);
      e.ap = 0;
      return true;
    }
    // за ход не достать: ближе к отряду — с той стороны, где цель без укрытия, и не гуськом за своими
    const F = BT.distField(ts.map(function (t) { return [t.x, t.y]; }));
    const here = F[BT.idx(e.x, e.y)];
    let t0 = ts[0], d0 = 1e9;
    ts.forEach(function (t) { const d = U.dist(e.x, e.y, t.x, t.y); if (d < d0) { d0 = d; t0 = t; } });
    const ang = [];
    mates.forEach(function (m) { const d = U.dist(m.x, m.y, t0.x, t0.y); if (d <= 10 && d > 0) ang.push({ a: Math.atan2(m.y - t0.y, m.x - t0.x), d: d }); });
    let bt = null;
    for (let i = 0; i < R.cost.length; i++) {
      if (R.cost[i] === Infinity || F[i] >= here) continue;
      const x = i % B.w, y = (i / B.w) | 0;
      if (!BT.canEnd(R, x, y)) continue;
      let v = F[i] + R.cost[i] * 0.02 + Math.random() * 0.4;
      const dT = U.dist(x, y, t0.x, t0.y);
      if (dT <= 10) v += BT.coverAt(t0.x, t0.y, x, y).cover * 1.2;
      const a = Math.atan2(y - t0.y, x - t0.x);
      for (let k = 0; k < ang.length; k++) {
        let da = Math.abs(a - ang[k].a); if (da > Math.PI) da = Math.PI * 2 - da;
        if (da < 0.6) v += (0.6 - da) * 2.5 * Math.max(0, 1 - Math.abs(dT - ang[k].d) / 6);
      }
      v += crowd(mates, x, y) * 0.7;
      if (!bt || v < bt.v) bt = { x: x, y: y, v: v, c: R.cost[i] };
    }
    if (!bt) { e.ap = 0; return false; }
    const apUsed = bt.c <= e.mob + 0.01 ? 1 : 2;
    await BT.move(e, BT.pathTo(R, bt.x, bt.y));
    e.ap -= apUsed;
    if (e.alive) announce(e);
    return e.alive && e.ap > 0 && !B.over;
  }

  /* ================= Заложник (банда, клан) ================= */
  function grabbable(u) {
    return u.kind === 'soldier' && !u.alive && !u.evac && !u.captured && !u.militia && u.down > 0 && !u.hostageOf;
  }
  /* поле расстояний до края карты */
  function edgeField(B) {
    const BT = DW.BT, pts = [];
    for (let x = 0; x < B.w; x++) { pts.push([x, 0]); pts.push([x, B.h - 1]); }
    for (let y = 1; y < B.h - 1; y++) { pts.push([0, y]); pts.push([B.w - 1, y]); }
    return BT.distField(pts.filter(function (p) { return BT.walkTile(p[0], p[1]); }));
  }
  function moveBody(B, h, x, y) {
    h.x = x; h.y = y;
    for (let k = 0; k < B.corpses.length; k++) if (B.corpses[k].uid === h.id) { B.corpses[k].x = x; B.corpses[k].y = y; }
  }
  async function grab(e, h) {
    const BT = DW.BT;
    e.holding = h.id; h.hostageOf = e.id; e.ap -= 1;
    e.face = Math.atan2(h.y - e.y, h.x - e.x);
    if (e.seen || seenAt(BT, h.x, h.y)) {
      await DW.TR.focusOn(h.x, h.y, false);
      DW.TR.anim(e, 'heal', 650);
      DW.TR.float(e.x, e.y, 'Взял заложника!', 'bad');
      DW.SFX.play('melee');
      await U.sleep(420);
    }
    DW.UI.toast(e.name + ' схватил «' + h.name + '» и тащит его к краю карты! Убейте захватчика.', 'alert');
  }
  async function tryGrab(e) {
    const BT = DW.BT, B = BT.get();
    if (e.ap < 1 || e.holding || B.over) return false;
    const downs = B.units.filter(grabbable);
    if (!downs.length) return false;
    const sol = BT.soldiers();
    const guarded = function (u) { return sol.some(function (s) { return cheb(s, u) <= 1; }); };
    // раненый рядом — схватить (вместо атаки) и сразу тащить
    const h = downs.find(function (u) { return cheb(u, e) <= 1 && BT.hAt(u.x, u.y) === BT.hAt(e.x, e.y); });
    if (h) {
      if (Math.random() >= (guarded(h) ? 0.35 : 0.7)) return false;
      await grab(e, h);
      if (e.alive && e.ap > 0 && !B.over) await drag(e, true);
      e.ap = 0;
      return true;
    }
    // раненый в одном перебеге, без охраны — подбежать и схватить
    if (e.ap < 2 || e.pinned || Math.random() >= 0.4) return false;
    const R = BT.reach(e, e.mob);
    let best = null;
    downs.forEach(function (u) {
      if (guarded(u)) return;
      DIR8.forEach(function (d) {
        const x = u.x + d[0], y = u.y + d[1];
        if (!BT.canEnd(R, x, y) || BT.hAt(x, y) !== BT.hAt(u.x, u.y)) return;
        const c = R.cost[BT.idx(x, y)];
        if (!best || c < best.c) best = { x: x, y: y, c: c, u: u };
      });
    });
    if (!best) return false;
    await BT.move(e, BT.pathTo(R, best.x, best.y));
    e.ap -= 1;
    if (!e.alive || B.over) return true;
    if (!grabbable(best.u) || cheb(best.u, e) > 1) return false;
    await grab(e, best.u);
    e.ap = 0;
    return true;
  }
  /* захватчик тащит заложника к ближайшему краю карты вполовину шага; дошёл — бойца утащили */
  async function drag(e, fresh) {
    const BT = DW.BT, B = BT.get();
    const h = heldBy(e);
    if (!h || cheb(e, h) > 1) { TAC.release(e, !h); return false; }
    const F = edgeField(B);
    const s0 = BT.idx(e.x, e.y);
    if (!fresh && F[s0] === 0) { capture(e, h); return true; }
    const budget = e.mob * e.ap / 2;
    if (budget < 1 || F[s0] === Infinity) return holdFire(e, fresh);   // к краю не пройти — держит и отстреливается
    const R = BT.reach(e, budget);
    const sol = BT.soldiers();
    let best = null;
    for (let i = 0; i < R.cost.length; i++) {
      if (R.cost[i] === Infinity || F[i] >= F[s0]) continue;
      const x = i % B.w, y = (i / B.w) | 0;
      if (!BT.canEnd(R, x, y)) continue;
      let v = F[i] + R.cost[i] * 0.05 + Math.random() * 0.3;
      for (let k = 0; k < sol.length; k++) { const d = Math.max(Math.abs(sol[k].x - x), Math.abs(sol[k].y - y)); if (d <= 1) v += 3; else if (d <= 3) v += 0.6; }
      if (!best || v < best.v) best = { x: x, y: y, v: v };
    }
    if (!best) return holdFire(e, fresh);
    e.ap = 0;
    const path = BT.pathTo(R, best.x, best.y);
    if (e.seen) DW.TR.float(e.x, e.y, 'Тащит заложника', 'bad');
    for (let k = 0; k < path.length; k++) {
      const px = e.x, py = e.y;
      await BT.move(e, [path[k]]);
      if (!e.alive || B.over || e.holding !== h.id) return true;   // убит или отпустил
      moveBody(B, h, px, py);
    }
    if (!fresh && F[BT.idx(e.x, e.y)] === 0) capture(e, h);
    return true;
  }
  /* тащить некуда (стены, отряд на пути): стоит, прикрываясь заложником, и стреляет с места */
  async function holdFire(e, fresh) {
    const T = D.ENEMIES[e.type];
    if (!fresh && e.ap > 0 && !T.melee && e.weapon && D.WEAPONS[e.weapon]) { e.ap = 1; await DW.AI.ranged(e); }
    e.ap = 0;
    return true;
  }
  function capture(e, h) {
    const BT = DW.BT, B = BT.get();
    const seen = e.seen || seenAt(BT, h.x, h.y);
    h.captured = true; h.alive = false; h.evac = false;
    h.capFac = (DW.D.ENEMIES[e.type] && DW.D.ENEMIES[e.type].fac) || 'raider';   // чей лагерь (кампания: плен и спасение)
    // кто утащен — не «спасён» и не истекает кровью на поле (итоги боя — по u.captured)
    h.down = 0; h.stable = false;
    delete h.hostageOf;
    B.corpses = B.corpses.filter(function (cp) { return cp.uid !== h.id; });
    // захватчик уходит за край карты вместе с ним
    delete e.holding;
    e.alive = false; e.evac = true; e.fled = true; e.overwatch = false;
    if (seen) DW.TR.float(e.x, e.y, 'Бойца утащили!', 'bad');
    DW.UI.toast('«' + h.name + '» утащили с поля боя!', 'bad');
    DW.SFX.play('death');
    BT.updateVision();
    BT.updateObjective();
  }

  /* ================= СОБР: дым и перевязка ================= */
  function seenBy(BT, x, y, list) {
    for (let k = 0; k < list.length; k++) if (BT.canSeeFrom(list[k].x, list[k].y, x, y, list[k].sight)) return true;
    return false;
  }
  /* ранен (меньше 45 % ОЗ) — уйти из-под обзора отряда и перевязаться (+3 ОЗ, раз за бой) */
  async function tryBandage(e) {
    const BT = DW.BT, B = BT.get();
    if (e.bandaged || e.ap < 1 || e.hp >= e.maxHp * 0.45 || e.hp >= e.maxHp) return false;
    const ps = BT.players();
    if (seenBy(BT, e.x, e.y, ps)) {
      if (e.ap < 2 || e.pinned) return false;
      const R = BT.reach(e, e.mob);
      let best = null;
      for (let i = 0; i < R.cost.length; i++) {
        if (R.cost[i] === Infinity) continue;
        const x = i % B.w, y = (i / B.w) | 0;
        if (!BT.canEnd(R, x, y) || seenBy(BT, x, y, ps)) continue;
        let s = -R.cost[i] * 0.15 + Math.random() * 0.3, dn = 99;
        for (let k = 0; k < ps.length; k++) { dn = Math.min(dn, U.dist(x, y, ps[k].x, ps[k].y)); s += BT.coverAt(x, y, ps[k].x, ps[k].y).cover * 0.5; }
        s += Math.min(dn, 10) * 0.2;
        if (!best || s > best.s) best = { x: x, y: y, s: s };
      }
      if (!best) return false;   // укрыться негде — воюет дальше
      if (e.seen) DW.TR.float(e.x, e.y, 'Перевязывается', 'info');
      await BT.move(e, BT.pathTo(R, best.x, best.y));
      e.ap -= 1;
      if (!e.alive || B.over) return true;
    } else if (e.seen) DW.TR.float(e.x, e.y, 'Перевязывается', 'info');
    const v = Math.min(3, e.maxHp - e.hp);
    e.hp += v; e.bandaged = true; e.tacHp = e.hp; e.ap = 0;
    DW.TR.anim(e, 'heal', 900);
    if (e.seen) { DW.TR.float(e.x, e.y, '+' + v + ' ОЗ', 'info'); await U.sleep(350); }
    return true;
  }
  /* под огнём или с фланга — дымовая (раз за бой, у командира две; не больше одной за ход врага) */
  async function trySmoke(e) {
    const BT = DW.BT, B = BT.get(), T = D.ENEMIES[e.type];
    if (e.ap < 1 || (e.smk || 0) >= (T.leader ? 2 : 1) || (smokeB === B && smokeTurn === B.turn)) return false;
    if (TAC.inSmoke(e.x, e.y)) return false;
    const sol = BT.players().filter(function (p) { return BT.canSee(p, e); });
    if (!sol.length) return false;
    const flanked = sol.some(function (p) { return BT.coverAt(e.x, e.y, p.x, p.y).cover === 0; });
    const under = e.shotAt === B.turn || !!hurtNow[e.id] || e.pinned || e.suppressed;
    if (!flanked && !under) return false;
    if (Math.random() >= (flanked && under ? 0.9 : 0.65)) return false;
    // завеса на шаг к стрелкам: между ним и отрядом, сам — в дыму
    let cx = 0, cy = 0;
    sol.forEach(function (p) { cx += p.x; cy += p.y; });
    cx /= sol.length; cy /= sol.length;
    const dx = cx - e.x, dy = cy - e.y, L = Math.hypot(dx, dy) || 1;
    let tx = e.x + Math.round(dx / L), ty = e.y + Math.round(dy / L);
    if (!BT.inb(tx, ty)) { tx = e.x; ty = e.y; }
    e.smk = (e.smk || 0) + 1; e.ap -= 1;
    smokeB = B; smokeTurn = B.turn;
    e.face = Math.atan2(ty - e.y, tx - e.x);
    if (e.seen) { DW.TR.float(e.x, e.y, 'Дымовая!', 'bad'); await DW.TR.focusOn(tx, ty, false); }
    DW.TR.anim(e, 'throw', 560); await U.sleep(330);
    if (tx !== e.x || ty !== e.y) await DW.TR.projectileFx(e.x, e.y, tx, ty, 'grenade');
    DW.SFX.play('spit');
    TAC.addSmoke(tx, ty, 1.5, 2);
    smokeBurst(B, tx, ty);
    await U.sleep(300);
    return true;
  }

  /* ================= Ход бойца врага (крючок AI.act) ================= */
  /* true — ход сделан здесь; false — дальше обычный ИИ (с оставшимися ОД) */
  TAC.act = async function (e) {
    const BT = DW.BT, B = BT.get();
    if (!B || B.over || !e.alive || e.ap <= 0) return false;
    const T = D.ENEMIES[e.type];
    if (!T) return false;
    // держит заложника — тащит (если заложника уже нет — обычный ход)
    if (e.holding && await drag(e, false)) { e.ap = 0; return true; }
    if (takesHostages(e) && await tryGrab(e)) return true;
    if (T.fac === 'sobr') {
      if (await tryBandage(e)) return true;
      await trySmoke(e);
      return !e.alive || B.over || e.ap <= 0;
    }
    if (T.beast && T.melee) {
      let guard = 0;
      while (e.alive && e.ap > 0 && !B.over && guard++ < 4) { if (!await beastMelee(e)) break; }
      e.ap = 0; delete e.ambNow;
      return true;
    }
    if (T.beast && e.ambNow) {
      // плевун из засады: обычная стрельба, но «Засада!» — как только покажется
      let guard = 0;
      while (e.alive && e.ap > 0 && !B.over && guard++ < 4) { const ok = await DW.AI.ranged(e); announce(e); if (!ok) break; }
      e.ap = 0; delete e.ambNow;
      return true;
    }
    return false;
  };

  /* ================= Отрисовка ================= */
  let puffC = null;
  function puffSpr() {
    if (puffC) return puffC;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(200,196,188,0.95)'); gr.addColorStop(0.45, 'rgba(176,172,164,0.62)'); gr.addColorStop(1, 'rgba(150,146,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (puffC = c);
  }
  /* 2D (крючок render_battle.js, мировые координаты): серые клубы над клетками дыма, верёвка от захватчика к заложнику */
  TAC.draw2d = function (g, B, t, isoC, rp) {
    if (B.smoke && TAC.smokeMask() && mList.length) {
      const spr = puffSpr();
      for (let n = 0; n < mList.length; n++) {
        const i = mList[n];
        if (!B.explored[i]) continue;
        const x = i % B.w, y = (i / B.w) | 0, c = isoC(x, y);
        const a0 = (B.smoke[i] || 1) > 1 ? 0.5 : 0.3;
        for (let k = 0; k < 3; k++) {
          const ph = t / 2600 + k * 2.1 + (x * 7 + y * 13) * 0.37;
          const s = 56 + k * 10 + Math.sin(ph * 0.7) * 6;
          g.globalAlpha = a0 * (k === 2 ? 0.7 : 1);
          g.drawImage(spr, c[0] + Math.sin(ph) * 9 + (k - 1) * 9 - s / 2, c[1] - 8 - k * 10 + Math.cos(ph * 1.3) * 4 - s * 0.32, s, s * 0.64);
        }
      }
      g.globalAlpha = 1;
    }
    for (let k = 0; k < B.units.length; k++) {
      const h = B.units[k];
      if (!h.hostageOf || h.alive || !B.explored[h.y * B.w + h.x]) continue;
      const e = unitById(B, h.hostageOf);
      if (!e || !e.alive) continue;
      const hc = isoC(h.x, h.y);
      if (e.seen && rp) {
        const p = rp(e), ec = isoC(p[0], p[1]);
        g.strokeStyle = 'rgba(60,40,24,0.9)'; g.lineWidth = 2; g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(ec[0], ec[1] - 22); g.quadraticCurveTo((ec[0] + hc[0]) / 2, (ec[1] + hc[1]) / 2 - 2, hc[0], hc[1] - 6); g.stroke();
        g.setLineDash([]);
      }
      tag(g, hc[0], hc[1] - 56);
    }
  };
  function tag(g, x, y) {
    g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText('ЗАЛОЖНИК', x, y);
    g.fillStyle = '#ff9a7a'; g.fillText('ЗАЛОЖНИК', x, y);
  }
  /* 3D (крючок r3d/tr3.js, экранные координаты): метка над заложником */
  TAC.hud3d = function (g) {
    const B = DW.BT.get(), R3 = DW.R3;
    if (!B || !R3 || !R3.ok) return;
    for (let k = 0; k < B.units.length; k++) {
      const h = B.units[k];
      if (!h.hostageOf || h.alive || !B.explored[h.y * B.w + h.x]) continue;
      const s = R3.tileToScreen(h.x, h.y, 1.1);
      if (s[0] > -900) tag(g, s[0], s[1]);
    }
  };
  /* 3D: стойкие мягкие клубы над клетками дыма — частицы общей сетки эффектов (R3.fx.puff), без новых теней.
     Новая клетка дыма (бросок, загрузка боя) сразу получает несколько клубов «разного возраста» — облако
     появляется целиком, дальше его поддерживает редкий выброс по кругу (на клетку — клуб в 0,9–1,6 с). */
  let acc3 = 0, rr3 = 0, P3 = null, seedB = null, seedV = -1, seeded = {};
  const SMK = [
    { sp: 0.22, up: 0.1, upr: 0.16, drag: 0.9, life: 3600, s0: 0.8, s1: 1.7, a: 0.55, c: '#b9b6af', fadeIn: 0.3, r: 0.3, delay: 0 },
    { sp: 0.22, up: 0.1, upr: 0.16, drag: 0.9, life: 3200, s0: 0.7, s1: 1.5, a: 0.34, c: '#b9b6af', fadeIn: 0.3, r: 0.3, delay: 0 }
  ];
  function smokeAt(R3, B, i, o) {
    const x = i % B.w, y = (i / B.w) | 0;
    P3.set((x + 0.2 + Math.random() * 0.6) * R3.T, R3.hAt(x, y) + 0.2 + Math.random() * 0.5, (y + 0.2 + Math.random() * 0.6) * R3.T);
    R3.fx.puff(P3, 1, o);
  }
  TAC.tick3d = function (dt) {
    const R3 = DW.R3, B = DW.BT.get();
    if (!B || !B.smoke || !R3 || !R3.ok || !R3.fx || !R3.fx.puff || !TAC.smokeMask() || !mList.length) return;
    if (!P3) P3 = new R3.THREE.Vector3();
    const n = mList.length, q = R3.q ? R3.q() : 2;
    if (seedB !== B) { seedB = B; seeded = {}; }
    if (seedV !== mV) {
      seedV = mV;
      for (const k in seeded) if (!mask[k]) delete seeded[k];
      for (let j = 0; j < n; j++) {
        const i = mList[j];
        if (seeded[i]) continue;
        seeded[i] = 1;
        if (!B.explored[i]) continue;
        const o = SMK[(B.smoke[i] || 1) > 1 ? 0 : 1];
        for (let c = 0; c < (q >= 1 ? 3 : 2); c++) { o.delay = -Math.random() * o.life * 0.7; smokeAt(R3, B, i, o); }
        o.delay = 0;
      }
    }
    const per = q >= 2 ? 0.9 : (q === 1 ? 1.2 : 1.6);   // секунд между клубами на клетку
    acc3 = Math.min(n, acc3 + dt * n / per);
    while (acc3 >= 1) {
      acc3 -= 1;
      const i = mList[rr3++ % n];
      if (B.explored[i]) smokeAt(R3, B, i, SMK[(B.smoke[i] || 1) > 1 ? 0 : 1]);
    }
  };
  /* хлопок дымовой: в 3D — сразу облако (дальше его держит tick3d) */
  function smokeBurst(B, x, y) {
    const R3 = DW.R3;
    if (!DW.TR.is3d || !R3 || !R3.ok || !R3.fx || !R3.fx.puff) return;
    const p = new R3.THREE.Vector3((x + 0.5) * R3.T, R3.hAt(x, y) + 0.3, (y + 0.5) * R3.T);
    R3.fx.puff(p, 14, { sp: 2.2, up: 0.4, upr: 0.5, drag: 1.4, life: 3200, s0: 0.4, s1: 1.8, a: 0.4, c: '#b4b1aa', fadeIn: 0.05, r: 1.6 });
  }

  DW.TAC = TAC;
})(window.DW);
