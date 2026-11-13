'use strict';
/* Искусственный интеллект противника */
(function (DW) {
  const U = DW.U, D = DW.D;
  const AI = {};

  function meleeAdj(BT, ax, ay, t) {
    const dx = t.x - ax, dy = t.y - ay;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
    if (dx && dy && !BT.walkTile(ax + dx, ay) && !BT.walkTile(ax, ay + dy)) return false;
    return true;
  }

  AI.enemyTurn = async function () {
    const BT = DW.BT, B = BT.get();
    B.units.forEach(function (e) {
      if (e.side === 'e' && e.alive) { e.overwatch = false; e.hunker = false; e.ap = e.active ? (e.fresh ? 1 : 2) : 0; e.fresh = false; }
    });
    BT.spawnWaves(false);
    BT.updateVision();
    const actors = B.units.filter(function (e) { return e.side === 'e' && e.alive && e.active; });
    for (let k = 0; k < actors.length; k++) {
      const e = actors[k];
      if (!e.alive || B.over) continue;
      await AI.act(e);
      if (BT.checkEnd()) return;
    }
    await AI.patrol();
    B.units.forEach(function (e) { if (e.side === 'e') e.suppressed = false; });
    BT.updateObjective();
    BT.checkEnd();
  };

  AI.act = async function (e) {
    const BT = DW.BT, B = BT.get();
    const T = D.ENEMIES[e.type];
    if (T.spawner) await AI.brood(e);
    let guard = 0;
    while (e.alive && e.ap > 0 && !B.over && guard++ < 4) {
      const ok = T.melee ? await AI.melee(e) : await AI.ranged(e);
      if (!ok) break;
    }
    e.ap = 0;
  };

  AI.brood = async function (e) {
    const BT = DW.BT, B = BT.get();
    if (B.turn % 2 !== 0 || BT.enemies().length >= 12) return;
    const spots = [];
    BT.DIR8.forEach(function (d) {
      const x = e.x + d[0], y = e.y + d[1];
      if (BT.walkTile(x, y) && !BT.unitAt(x, y)) spots.push([x, y]);
    });
    U.shuffle(spots);
    let n = 0;
    for (let i = 0; i < 2 && i < spots.length; i++) {
      const T = D.ENEMIES.scav;
      const u = {
        id: B.nextId++, side: 'e', kind: 'enemy', type: 'scav', name: T.n, x: spots[i][0], y: spots[i][1],
        hp: T.hp, maxHp: T.hp, aim: T.aim, mob: T.mob, def: T.def, armor: 0, weapon: null, clip: 0, ap: 0,
        sight: Math.max(5, T.sight + (B.sightMod || 0)), pod: e.pod, active: true, seen: false, overwatch: false, hunker: false, suppressed: false,
        alive: true, evac: false, face: Math.PI, cd: {}, kills: 0
      };
      B.units.push(u);
      n++;
    }
    if (n) {
      BT.updateVision();
      if (e.seen) {
        await DW.TR.focusOn(e.x, e.y, true);
        DW.UI.toast('Матка исторгает новых мутантов!', 'alert');
        DW.SFX.play('growl');
        await U.sleep(400);
      }
    }
  };

  AI.melee = async function (e) {
    const BT = DW.BT, B = BT.get();
    const ts = BT.players();
    if (!ts.length) { e.ap = 0; return false; }
    const adj = ts.filter(function (t) { return meleeAdj(BT, e.x, e.y, t); });
    if (adj.length) {
      adj.sort(function (a, b) { return a.hp - b.hp; });
      await BT.melee(e, adj[0]);
      e.ap = 0;
      return true;
    }
    const R = BT.reach(e, e.mob * e.ap);
    let best = null;
    ts.forEach(function (t) {
      BT.DIR8.forEach(function (d) {
        const x = t.x + d[0], y = t.y + d[1];
        if (!BT.canEnd(R, x, y) || !meleeAdj(BT, x, y, t)) return;
        const c = R.cost[BT.idx(x, y)];
        const score = c + t.hp * 0.25 + (t.kind === 'turret' ? 3 : 0) + Math.random();
        if (!best || score < best.score) best = { x: x, y: y, c: c, t: t, score: score };
      });
    });
    if (best) {
      const apUsed = best.c <= e.mob + 0.01 ? 1 : 2;
      await BT.move(e, BT.pathTo(R, best.x, best.y));
      e.ap -= apUsed;
      if (!e.alive || B.over) return false;
      if (e.ap >= 1 && best.t.alive && !best.t.evac && meleeAdj(BT, e.x, e.y, best.t)) await BT.melee(e, best.t);
      e.ap = 0;
      return true;
    }
    const F = BT.distField(ts.map(function (t) { return [t.x, t.y]; }));
    const here = F[BT.idx(e.x, e.y)];
    let bt = null;
    for (let i = 0; i < R.cost.length; i++) {
      if (R.cost[i] === Infinity) continue;
      const x = i % B.w, y = (i / B.w) | 0;
      if (!BT.canEnd(R, x, y)) continue;
      if (F[i] >= here) continue;
      if (!bt || F[i] < bt.f || (F[i] === bt.f && R.cost[i] < bt.c)) bt = { x: x, y: y, f: F[i], c: R.cost[i] };
    }
    if (!bt) { e.ap = 0; return false; }
    const apUsed = bt.c <= e.mob + 0.01 ? 1 : 2;
    await BT.move(e, BT.pathTo(R, bt.x, bt.y));
    e.ap -= apUsed;
    return e.alive && e.ap > 0;
  };

  AI.ranged = async function (e) {
    const BT = DW.BT, B = BT.get();
    const W = D.WEAPONS[e.weapon];
    if (e.clip <= 0) {
      e.clip = W.clip; e.ap -= 1;
      if (e.seen) { DW.TR.anim(e, 'reload', 700); DW.TR.float(e.x, e.y, 'Перезарядка', 'info'); if (DW.SFX.reload && DW.WT) DW.SFX.reload(DW.WT.RK[e.weapon]); else DW.SFX.play('reload'); await U.sleep(450); }
      return true;
    }
    const ts = BT.players();
    if (!ts.length) { e.ap = 0; return false; }
    // граната по скоплению или по засевшему в полном укрытии
    if (e.gren > 0 && e.ap >= 1) {
      let gb = null;
      ts.forEach(function (t) {
        if (U.dist(e.x, e.y, t.x, t.y) > 7.5 || !BT.canSeeFrom(e.x, e.y, t.x, t.y, e.sight)) return;
        const around = ts.filter(function (o) { return Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) <= 1; }).length;
        const full = BT.coverAt(t.x, t.y, e.x, e.y).cover === 2;
        const v = around * 10 + (full ? 8 : 0) + (t.hp <= 4 ? 5 : 0);
        if (!gb || v > gb.v) gb = { t: t, v: v };
      });
      if (gb && gb.v >= 18) {
        e.gren--; e.ap = 0;
        e.face = Math.atan2(gb.t.y - e.y, gb.t.x - e.x);
        if (e.seen) { DW.TR.float(e.x, e.y, 'Граната!', 'bad'); await DW.TR.focusOn(gb.t.x, gb.t.y, false); }
        DW.TR.anim(e, 'throw', 560); await U.sleep(330);
        await DW.TR.projectileFx(e.x, e.y, gb.t.x, gb.t.y, 'grenade');
        await BT.explode(gb.t.x, gb.t.y, 1.5, [3, 5], 4, e);
        return true;
      }
    }
    const canMove = e.ap >= 2;
    const hurt = !D.ENEMIES[e.type].beast && e.hp <= e.maxHp * 0.35;
    const R = BT.reach(e, canMove ? e.mob : 0);
    const start = BT.idx(e.x, e.y);
    let best = null;
    for (let i = 0; i < R.cost.length; i++) {
      if (R.cost[i] === Infinity) continue;
      const x = i % B.w, y = (i / B.w) | 0;
      if (i !== start && !BT.canEnd(R, x, y)) continue;
      let shot = 0, st = null;
      for (let k = 0; k < ts.length; k++) {
        const t = ts[k];
        if (!BT.canSeeFrom(x, y, t.x, t.y, e.sight)) continue;
        const info = BT.shotInfo(e, t, { fromX: x, fromY: y });
        const v = info.hit + (t.hp <= W.dmg[1] ? 15 : 0) - (t.kind === 'turret' ? 10 : 0);
        if (v > shot) { shot = v; st = t; }
      }
      let safety = 0, n = 0;
      for (let k = 0; k < ts.length; k++) {
        const t = ts[k];
        if (U.dist(x, y, t.x, t.y) > 15) continue;
        n++;
        const cv = BT.coverAt(x, y, t.x, t.y).cover;
        safety += cv === 2 ? 16 : (cv === 1 ? 9 : -10);
      }
      if (n) safety /= n;
      let score = (hurt ? shot * 0.45 + safety * 2.6 : shot + safety * 1.2) - R.cost[i] * 0.3 + Math.random() * 5;
      if (st && e.type === 'marksman') score += Math.min(U.dist(x, y, st.x, st.y), 10);
      if (st && e.type === 'thug') score -= U.dist(x, y, st.x, st.y) * 1.5;
      if (!st) score -= 80;
      if (!best || score > best.score) best = { x: x, y: y, st: st, score: score };
    }
    if (best && best.st) {
      if (best.x !== e.x || best.y !== e.y) {
        await BT.move(e, BT.pathTo(R, best.x, best.y));
        e.ap -= 1;
        if (!e.alive || B.over) return false;
      }
      let tgt = best.st;
      if (!tgt.alive || tgt.evac || !BT.canSee(e, tgt)) {
        const alt = BT.players().filter(function (t) { return BT.canSee(e, t); });
        tgt = alt.length ? alt[0] : null;
      }
      if (tgt) { await BT.fire(e, tgt); e.ap = 0; return true; }
      return e.ap > 0;
    }
    // целей нет — сближаемся
    const F = BT.distField(ts.map(function (t) { return [t.x, t.y]; }));
    const here = F[start];
    if (canMove && here > 14) {
      const R2 = BT.reach(e, e.mob * 2);
      let bt = null;
      for (let i = 0; i < R2.cost.length; i++) {
        if (R2.cost[i] === Infinity || F[i] === Infinity) continue;
        const x = i % B.w, y = (i / B.w) | 0;
        if (!BT.canEnd(R2, x, y)) continue;
        const v = F[i] + Math.random();
        if (!bt || v < bt.v) bt = { x: x, y: y, v: v };
      }
      if (bt) { await BT.move(e, BT.pathTo(R2, bt.x, bt.y)); e.ap = 0; return true; }
    }
    if (canMove) {
      let near = ts[0], nd = 1e9;
      ts.forEach(function (t) { const d = U.dist(e.x, e.y, t.x, t.y); if (d < nd) { nd = d; near = t; } });
      let bt = null;
      for (let i = 0; i < R.cost.length; i++) {
        if (R.cost[i] === Infinity || F[i] === Infinity) continue;
        const x = i % B.w, y = (i / B.w) | 0;
        if (i !== start && !BT.canEnd(R, x, y)) continue;
        const cv = BT.coverAt(x, y, near.x, near.y).cover;
        const v = F[i] - cv * 2.5 + Math.random() * 0.8;
        if (!bt || v < bt.v) bt = { x: x, y: y, v: v };
      }
      if (bt && (bt.x !== e.x || bt.y !== e.y)) {
        await BT.move(e, BT.pathTo(R, bt.x, bt.y));
        e.ap -= 1;
        if (!e.alive || B.over) return false;
        // после шага цель могла появиться
        const vis = BT.players().filter(function (t) { return BT.canSee(e, t); });
        if (vis.length && e.ap > 0) {
          vis.sort(function (a, b) { return BT.shotInfo(e, b).hit - BT.shotInfo(e, a).hit; });
          await BT.fire(e, vis[0]);
          e.ap = 0;
          return true;
        }
      }
    }
    if (e.ap > 0 && e.clip > 0) {
      e.overwatch = true;
      if (e.seen) DW.TR.float(e.x, e.y, 'Дозор', 'info');
    }
    e.ap = 0;
    return true;
  };

  AI.scamper = async function (m) {
    const BT = DW.BT, B = BT.get();
    const T = D.ENEMIES[m.type];
    const ts = BT.players();
    if (!ts.length) return;
    const R = BT.reach(m, m.mob);
    const start = BT.idx(m.x, m.y);
    let best = null;
    for (let i = 0; i < R.cost.length; i++) {
      if (R.cost[i] === Infinity) continue;
      const x = i % B.w, y = (i / B.w) | 0;
      if (i !== start && !BT.canEnd(R, x, y)) continue;
      let s = 0;
      if (T.melee) {
        let dmin = 1e9;
        ts.forEach(function (t) { dmin = Math.min(dmin, U.dist(x, y, t.x, t.y)); });
        s = -dmin * 0.6 - R.cost[i] * 0.1;
        if (dmin < 2) s -= 6;
      } else {
        ts.forEach(function (t) {
          if (U.dist(x, y, t.x, t.y) > 16) return;
          const cv = BT.coverAt(x, y, t.x, t.y).cover;
          s += cv === 2 ? 3 : (cv === 1 ? 1.6 : -2);
        });
        s -= R.cost[i] * 0.06;
      }
      s += Math.random() * 0.6;
      if (!best || s > best.s) best = { x: x, y: y, s: s };
    }
    if (best && (best.x !== m.x || best.y !== m.y)) {
      await BT.move(m, BT.pathTo(R, best.x, best.y), { noReact: true });
    }
  };

  AI.patrol = async function () {
    const BT = DW.BT, B = BT.get();
    const ps = BT.players();
    if (!ps.length) return;
    let cx = 0, cy = 0;
    ps.forEach(function (p) { cx += p.x; cy += p.y; });
    cx /= ps.length; cy /= ps.length;
    const pods = {};
    BT.enemies().forEach(function (e) {
      if (e.active) return;
      (pods[e.pod] = pods[e.pod] || []).push(e);
    });
    const ids = Object.keys(pods);
    for (let p = 0; p < ids.length; p++) {
      if (B.over) return;
      if (Math.random() < 0.5) continue;
      const mem = pods[ids[p]];
      const lead = mem[0];
      let tx, ty;
      if (Math.random() < 0.55) { tx = cx; ty = cy; } else { tx = lead.x + U.rand(-5, 5); ty = lead.y + U.rand(-4, 4); }
      for (let k = 0; k < mem.length; k++) {
        const m = mem[k];
        if (!m.alive || m.active) continue;
        const R = BT.reach(m, Math.max(2, m.mob - 2));
        let best = null;
        for (let i = 0; i < R.cost.length; i++) {
          if (R.cost[i] === Infinity) continue;
          const x = i % B.w, y = (i / B.w) | 0;
          if (!BT.canEnd(R, x, y)) continue;
          const d = U.dist(x, y, tx, ty) + Math.random() * 1.5;
          if (!best || d < best.d) best = { x: x, y: y, d: d };
        }
        if (best) await BT.move(m, BT.pathTo(R, best.x, best.y), { noReact: true });
        // при скрытности отряд замечают только вблизи (зона обнаружения)
        const spotted = B.concealed ? BT.detects(m) : (m.seen || ps.some(function (s) { return s.alive && BT.canSee(m, s); }));
        if (spotted && !m.active) {
          const rv = B.concealed;
          if (rv) BT.reveal('Патруль заметил отряд!');
          await BT.activatePods([m]);
          if (rv) await BT.wakeSeen();
          break;
        }
      }
    }
  };

  DW.AI = AI;
})(window.DW);
