/*
 * Движок автобоя. Полностью детерминирован: одинаковый setup (включая зерно) —
 * одинаковый бой. Поэтому повтор боя хранит только setup и пересчитывается заново.
 *
 * setup = {
 *   seed, map: { type, walls }, mode: 'field' | 'camp' | 'fort', defender: 0 | 1 | null,
 *   sides: [ { units: [...], tactic, formation, orders, retreatAt, discipline }, { ... } ],
 *   army: ключ армии противника (для текста)
 * }
 * Тик = 0,1 с боевого времени.
 */
(function (G) {
  'use strict';
  const BM = G.BattleMap;
  const T = BM.T;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const FAR = 32767;

  const Engine = {};
  const cfg = () => G.CONFIG.battle;
  const BT = () => G.BattleText;

  // ================= ИНИЦИАЛИЗАЦИЯ =================
  Engine.init = function (setup) {
    const C = cfg();
    const rng = G.Rng.make(setup.seed);
    const map = BM.generate(setup.map || { type: 'desert' }, rng);
    const B = {
      setup: setup, rng: rng, map: map, W: map.w, H: map.h, cells: map.cells,
      occ: new Int16Array(map.w * map.h).fill(-1),
      units: [], t: 0, over: false, winner: -1, reason: '',
      frames: [], shots: [], log: [], smokes: [], booms: [], heals: [],
      sides: [mkSide(setup.sides[0]), mkSide(setup.sides[1])],
      fieldCache: [null, null], fieldAt: [-99, -99],
      retreatField: [null, null],
      suppLogAt: {},
    };
    for (let side = 0; side < 2; side++) {
      for (const e of setup.sides[side].units.slice(0, C.maxPerSide)) B.units.push(mkUnit(B, e, side, B.units.length));
    }
    deploy(B);
    B.retreatField[0] = bfs(B, edgeCells(B, 0), false);
    B.retreatField[1] = bfs(B, edgeCells(B, 1), false);
    for (let side = 0; side < 2; side++) {
      B.sides[side].start = B.units.filter((u) => u.side === side).length;
      if (B.sides[side].tactic === 'flank') setupFlank(B, side);
    }
    say(B, BT().start(B), 'info');
    record(B);
    return B;
  };

  function mkSide(sd) {
    return {
      tactic: sd.tactic || 'assault',
      formation: sd.formation || 'line',
      retreatAt: sd.retreatAt || 0,
      orders: (sd.orders || []).map((id) => ({ id: id, readyAt: 0, uses: 0 })),
      retreating: false,
      start: 0,
      lost: 0,
      buff: { acc: 0, accUntil: 0, armor: 0, armorUntil: 0, speed: 1, speedUntil: 0, focus: -1, focusUntil: 0 },
      discipline: sd.discipline != null ? sd.discipline : 50,
      noTargetT: 0,
    };
  }

  function mkUnit(B, e, side, i) {
    const C = cfg();
    const base = C.types[e.type] || C.types.trooper;
    const R = G.CONFIG.ranks[e.rank || 0] || G.CONFIG.ranks[0];
    const human = e.kind === 'trooper' || e.kind === 'merc';
    const maxHp = base.hp + (human ? R.hp : 0);
    let morale = null;
    if (base.morale != null) {
      morale = base.morale + (human ? R.morale : 0);
      if (side === 0) morale += Math.round(((e.discipline != null ? e.discipline : B.setup.sides[0].discipline || 50) - 50) * C.morale.disciplineFactor);
      if (side === 0 && B.setup.surprise) morale += C.surprise.morale;
    }
    return {
      i: i, side: side, uid: e.uid != null ? e.uid : null, type: e.type, kind: e.kind || 'enemy',
      label: e.label || BT().nom(e.type),
      x: 0, y: 0, nx: -1, ny: -1, moveT: 0, moveTotal: 0,
      hp: Math.max(1, Math.round(maxHp * (e.health != null ? e.health : 100) / 100)), maxHp: maxHp,
      armor: base.armor, acc: base.acc + (human ? R.acc : 0) + (e.accBonus || 0),
      morale: morale, maxMorale: morale, supp: 0,
      state: 'active', broken: false, fireT: 0, target: -1, kills: 0, dealt: 0,
      group: 0, waypoint: null, healT: 0, idleT: 0, hitT: -99,
      leader: !!base.leader, base: base,
    };
  }

  // ================= СЕТКА =================
  const idx = (B, x, y) => y * B.W + x;
  const inside = (B, x, y) => x >= 0 && y >= 0 && x < B.W && y < B.H;
  const cell = (B, x, y) => (inside(B, x, y) ? B.cells[idx(B, x, y)] : T.ROCK);
  const passable = (B, x, y) => inside(B, x, y) && BM.passable(B.cells[idx(B, x, y)]);
  const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  // Поле расстояний (BFS, 8 направлений без срезания углов)
  function bfs(B, sources, forceSources) {
    const dist = new Int16Array(B.W * B.H).fill(FAR);
    const q = new Int32Array(B.W * B.H);
    let qh = 0, qt = 0;
    for (const [x, y] of sources) {
      if (!inside(B, x, y)) continue;
      if (!forceSources && !passable(B, x, y)) continue;
      const j = idx(B, x, y);
      if (dist[j] === 0) continue;
      dist[j] = 0;
      q[qt++] = j;
    }
    while (qh < qt) {
      const j = q[qh++];
      const x = j % B.W, y = (j / B.W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!passable(B, nx, ny)) continue;
        if (dx && dy && (!passable(B, x + dx, y) || !passable(B, x, y + dy))) continue;
        const k = idx(B, nx, ny);
        if (dist[k] !== FAR) continue;
        dist[k] = dist[j] + 1;
        q[qt++] = k;
      }
    }
    return dist;
  }

  // Края для отступления: в каждой строке — крайняя проходимая клетка своей стороны
  function edgeCells(B, side) {
    const out = [];
    for (let y = 0; y < B.H; y++) {
      if (side === 0) { for (let x = 0; x < B.W; x++) if (passable(B, x, y)) { out.push([x, y]); break; } }
      else { for (let x = B.W - 1; x >= 0; x--) if (passable(B, x, y)) { out.push([x, y]); break; } }
    }
    return out;
  }

  function enemyField(B, side) {
    if (B.t - B.fieldAt[side] < 6 && B.fieldCache[side]) return B.fieldCache[side];
    const src = [];
    for (const u of B.units) {
      if (u.side === side || u.state !== 'active') continue;
      src.push([u.x, u.y]);
      if (u.nx >= 0) src.push([u.nx, u.ny]);
    }
    B.fieldCache[side] = bfs(B, src, true);
    B.fieldAt[side] = B.t;
    return B.fieldCache[side];
  }

  // Видимость: линия Брезенхэма, скалы и обломки закрывают обзор, дым — тоже
  function inSmoke(B, x, y) {
    for (const s of B.smokes) {
      if (B.t < s.t0 || B.t >= s.t1) continue;
      const dx = x - s.x, dy = y - s.y;
      if (dx * dx + dy * dy <= s.r2) return true;
    }
    return false;
  }
  function los(B, a, b) {
    let x0 = a.x, y0 = a.y;
    const x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const smoke = B.smokes.length > 0;
    for (;;) {
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
      if (x0 === x1 && y0 === y1) { if (smoke && inSmoke(B, x0, y0)) return false; break; }
      if (BM.blocksLos(cell(B, x0, y0))) return false;
      if (smoke && inSmoke(B, x0, y0)) return false;
    }
    return true;
  }

  // Укрытие цели e от стрелка a (в процентах)
  function coverOf(B, e, a) {
    if (cheb(e, a) <= 1) return 0;
    const C = cfg().cover;
    const sx = Math.sign(a.x - e.x), sy = Math.sign(a.y - e.y);
    let c = 0;
    const check = (x, y) => {
      const t = cell(B, x, y);
      if (t === T.WALL) c = Math.max(c, C.wall);
      else if (t === T.ROCK || t === T.WRECK) c = Math.max(c, C.solid);
    };
    check(e.x + sx, e.y + sy);
    if (sx) check(e.x + sx, e.y);
    if (sy) check(e.x, e.y + sy);
    if (cell(B, e.x, e.y) === T.DUNE) c = Math.max(c, C.dune);
    return c;
  }

  // ================= РАЗВЁРТЫВАНИЕ =================
  function zoneFor(B, side) {
    const Z = cfg().zones;
    const mode = B.setup.mode || 'field';
    const def = B.setup.defender;
    if (mode === 'camp' && side === 0) return { x0: 5, x1: 10 };
    if (B.setup.surprise && side === 1) return { x0: cfg().surprise.enemyZone[0], x1: cfg().surprise.enemyZone[1] };
    if (mode === 'fort' && side === 1) return { x0: 17, x1: 22 };
    const depth = def === side ? Z.defenderDepth : Z.attackerDepth;
    return side === 0 ? { x0: 0, x1: depth - 1 } : { x0: B.W - depth, x1: B.W - 1 };
  }

  const ROLE = { droid: 0, walker: 0, heavy: 0, merc: 0, krayt: 0, gamorrean: 0, tusken: 0, tusken_chief: 1, trooper: 1, sand: 1, scout: 1, bandit: 1, swoop: 0, rebel: 1, smuggler: 1, hutt_guard: 1, jawa: 1, medic: 2, rebel_officer: 2, bandit_boss: 2, sniper: 3, tusken_rifle: 3, rebel_heavy: 1, turret: 0 };

  function deploy(B) {
    for (let side = 0; side < 2; side++) {
      const sd = B.sides[side];
      let zone = zoneFor(B, side);
      const list = B.units.filter((u) => u.side === side);
      list.sort((a, b) => (ROLE[a.type] || 1) - (ROLE[b.type] || 1) || a.i - b.i);
      let cells = candidates(B, side, zone, sd.formation);
      while (cells.length < list.length && (zone.x1 - zone.x0) < B.W / 2) {
        zone = side === 0 ? { x0: zone.x0, x1: zone.x1 + 1 } : { x0: zone.x0 - 1, x1: zone.x1 };
        cells = candidates(B, side, zone, sd.formation);
      }
      for (let k = 0; k < list.length; k++) {
        const u = list[k];
        const c = cells[k];
        if (!c) { u.state = 'exited'; continue; }
        u.x = c.x; u.y = c.y;
        B.occ[idx(B, c.x, c.y)] = u.i;
        u.fireT = B.rng.int(0, Math.max(1, u.base.cd));
      }
    }
  }

  function candidates(B, side, zone, formation) {
    const cells = [];
    for (let x = zone.x0; x <= zone.x1; x++) {
      for (let y = 0; y < B.H; y++) if (passable(B, x, y) && B.occ[idx(B, x, y)] === -1) cells.push({ x: x, y: y, r: B.rng.float() });
    }
    const front = side === 0 ? zone.x1 : zone.x0;
    const cy = (B.H - 1) / 2;
    const depth = (c) => Math.abs(front - c.x);
    const off = (c) => Math.abs(c.y - cy);
    let key;
    if (formation === 'wedge') key = (c) => Math.abs(depth(c) - off(c) * 0.6) * 10 + off(c);
    else if (formation === 'column') key = (c) => off(c) * 3 + depth(c);
    else if (formation === 'spread') key = (c) => c.r * 100;
    else key = (c) => depth(c) * 100 + (c.y % 2 ? 0 : 40) + off(c) * 0.1;
    cells.sort((a, b) => key(a) - key(b) || a.y - b.y || a.x - b.x);
    return cells;
  }

  function nearestPassable(B, x, y) {
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (passable(B, x + dx, y + dy)) return [x + dx, y + dy];
      }
    }
    return [x, y];
  }

  function setupFlank(B, side) {
    const xTarget = side === 0 ? B.W - 7 : 6;
    const top = nearestPassable(B, xTarget, 1);
    const bottom = nearestPassable(B, xTarget, B.H - 2);
    const fTop = bfs(B, [top], false);
    const fBot = bfs(B, [bottom], false);
    const list = B.units.filter((u) => u.side === side && u.state === 'active');
    // Половина — верхом, половина — низом; тяжёлые и снайперы держат центр
    for (const u of list) {
      if (u.base.static || u.type === 'sniper' || u.type === 'heavy') { u.group = 0; continue; }
      u.group = u.y < B.H / 2 ? 1 : 2;
      u.waypoint = u.group === 1 ? fTop : fBot;
    }
  }

  // ================= ДВИЖЕНИЕ =================
  function startMove(B, u, nx, ny) {
    const sd = B.sides[u.side];
    let cost = u.base.speed;
    const t = cell(B, nx, ny);
    if (t === T.DUNE && !(u.base.desert)) cost *= 1.5;
    if (nx !== u.x && ny !== u.y) cost *= 1.4;
    if (sd.buff.speedUntil > B.t) cost /= sd.buff.speed;
    u.nx = nx; u.ny = ny;
    u.moveTotal = u.moveT = Math.max(1, Math.round(cost));
    B.occ[idx(B, nx, ny)] = u.i;
  }
  function finishMove(B, u) {
    B.occ[idx(B, u.x, u.y)] = -1;
    u.x = u.nx; u.y = u.ny;
    u.nx = -1; u.ny = -1;
  }

  // Шаг вниз по полю расстояний; sidestep — можно обойти затор по равной высоте
  function stepAlong(B, u, field, sidestep) {
    const here = field[idx(B, u.x, u.y)];
    let best = null, bestD = here;
    const start = B.rng.int(0, 7);
    for (let k = 0; k < 8; k++) {
      const [dx, dy] = DIRS[(start + k) % 8];
      const nx = u.x + dx, ny = u.y + dy;
      if (!passable(B, nx, ny)) continue;
      if (dx && dy && (!passable(B, u.x + dx, u.y) || !passable(B, u.x, u.y + dy))) continue;
      const j = idx(B, nx, ny);
      if (B.occ[j] !== -1) continue;
      const d = field[j];
      if (d < bestD || (sidestep && !best && d === here)) { best = [nx, ny]; bestD = d; }
    }
    if (!best) return false;
    startMove(B, u, best[0], best[1]);
    return true;
  }

  // Шаг в соседнюю клетку с укрытием от врага, откуда враг виден
  function stepToCover(B, u, enemy) {
    if (coverOf(B, u, enemy) > 0) return false;
    for (const [dx, dy] of DIRS) {
      const nx = u.x + dx, ny = u.y + dy;
      if (!passable(B, nx, ny) || B.occ[idx(B, nx, ny)] !== -1) continue;
      if (dx && dy && (!passable(B, u.x + dx, u.y) || !passable(B, u.x, u.y + dy))) continue;
      const p = { x: nx, y: ny };
      if (coverOf(B, p, enemy) > 0 && los(B, p, enemy)) { startMove(B, u, nx, ny); return true; }
    }
    return false;
  }

  // ================= СТРЕЛЬБА =================
  function canHit(B, u, e) {
    const r = u.base.range;
    const dd = d2(u, e);
    if (r <= 2) return dd <= (r === 1 ? 2 : 8);
    return dd <= r * r && los(B, u, e);
  }

  function pickTarget(B, u) {
    const sd = B.sides[u.side];
    if (sd.buff.focusUntil > B.t && sd.buff.focus >= 0) {
      const f = B.units[sd.buff.focus];
      if (f.state === 'active' && canHit(B, u, f)) return f;
    }
    if (u.target >= 0) {
      const p = B.units[u.target];
      if (p.state === 'active' && canHit(B, u, p)) return p;
    }
    let best = null, bestScore = Infinity;
    for (const e of B.units) {
      if (e.side === u.side || e.state !== 'active') continue;
      const dd = d2(u, e);
      const r = u.base.range;
      if (r > 2 && dd > r * r) continue;
      if (!canHit(B, u, e)) continue;
      let score = dd + (e.hp / e.maxHp) * 20;
      if (e.leader) score -= 15;
      if (u.type === 'sniper' && (e.base.range >= 9 || e.leader)) score -= 40;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    u.target = best ? best.i : -1;
    return best;
  }

  function hitChance(B, u, e, extraPenalty) {
    const C = cfg();
    const sd = B.sides[u.side];
    let ch = u.acc;
    if (sd.buff.accUntil > B.t) ch += sd.buff.acc;
    const melee = u.base.range <= 2;
    if (melee) ch += C.hit.meleeBonus;
    else {
      ch -= Math.max(0, cheb(u, e) - C.hit.distFree) * C.hit.distPenalty;
      let cov = coverOf(B, e, u);
      if (u.base.coverPierce) cov *= u.base.coverPierce;
      ch -= cov;
    }
    if (e.nx >= 0) ch -= C.hit.moving;
    ch -= Math.min(C.supp.max, u.supp) * C.hit.suppFactor;
    if (u.base.desert && B.map.type === 'desert') ch += 6;
    if (B.setup.night) ch += C.night.acc[u.side];
    ch -= extraPenalty || 0;
    return Math.max(C.hit.min, Math.min(C.hit.max, Math.round(ch)));
  }

  function fire(B, u, e) {
    const C = cfg();
    const rng = B.rng;
    const shots = u.base.burst || 1;
    for (let k = 0; k < shots && e.state === 'active'; k++) {
      const ch = hitChance(B, u, e, k > 0 ? C.hit.burstPenalty : 0);
      const hit = rng.int(1, 100) <= ch;
      let crit = false;
      if (hit) {
        let dmg = rng.int(u.base.dmg[0], u.base.dmg[1]);
        if (rng.chance(C.crit.chance)) { dmg = Math.round(dmg * C.crit.mult); crit = true; }
        if (u.base.ion && (e.type === 'droid' || e.type === 'walker' || e.type === 'turret')) dmg = Math.round(dmg * u.base.ion);
        damage(B, e, dmg, u);
        e.supp = Math.min(C.supp.max, e.supp + C.supp.perHit);
        // Удар крайт-дракона задевает всех рядом
        if (u.base.sweep) {
          for (const o of B.units) {
            if (o === e || o.side === u.side || o.state !== 'active') continue;
            if (d2(u, o) <= 2) damage(B, o, Math.round(dmg * u.base.sweep), u);
          }
        }
      } else {
        const before = e.supp;
        e.supp = Math.min(C.supp.max, e.supp + C.supp.perMiss * (u.base.burst ? 1.3 : 1));
        if (before < 30 && e.supp >= 30) logSuppress(B, u, e);
      }
      B.shots.push([B.t, u.i, e.i, hit ? 1 : 0, crit ? 1 : 0]);
    }
    u.fireT = u.base.cd + B.rng.int(0, 2);
  }

  function damage(B, e, dmg, src) {
    const sd = B.sides[e.side];
    let armor = e.armor + (sd.buff.armorUntil > B.t ? sd.buff.armor : 0);
    const real = Math.max(1, dmg - armor);
    e.hp -= real;
    e.hitT = B.t;
    if (src) src.dealt += real;
    if (e.morale != null) e.morale += cfg().morale.hit;
    if (e.hp <= 0) down(B, e, src);
  }

  function down(B, e, src) {
    const C = cfg();
    e.hp = 0;
    e.state = 'down';
    B.occ[idx(B, e.x, e.y)] = -1;
    if (e.nx >= 0) { B.occ[idx(B, e.nx, e.ny)] = -1; e.nx = -1; }
    B.sides[e.side].lost++;
    if (src) src.kills++;
    say(B, BT().down(B, e, src), e.side === 0 ? 'bad' : 'good');
    for (const o of B.units) {
      if (o.side !== e.side || o.state !== 'active' || o.morale == null) continue;
      if (e.leader) o.morale += C.morale.leaderDown;
      else if (d2(o, e) <= C.morale.allyRadius * C.morale.allyRadius) o.morale += C.morale.allyDown;
    }
    if (e.leader) say(B, BT().leaderDown(B, e), e.side === 0 ? 'bad' : 'good');
  }

  function logSuppress(B, u, e) {
    const key = u.side + ':' + Math.floor(e.x / 4) + ':' + Math.floor(e.y / 4);
    if (B.suppLogAt[key] && B.t - B.suppLogAt[key] < 80) return;
    B.suppLogAt[key] = B.t;
    say(B, BT().suppress(B, u, e), 'info');
  }

  // ================= ПРИКАЗЫ ГЕНЕРАЛА =================
  const ORDERS = {
    focus: {
      trigger(B, side) {
        if (B.t < 10) return null;
        let best = null, bestScore = -1;
        for (const e of B.units) {
          if (e.side === side || e.state !== 'active') continue;
          let seen = 0;
          for (const u of B.units) if (u.side === side && u.state === 'active' && u.base.range > 2 && canHit(B, u, e)) seen++;
          if (seen < 3) continue;
          const score = seen * 10 + (e.leader ? 30 : 0) + (1 - e.hp / e.maxHp) * 20 + e.base.dmg[1];
          if (score > bestScore) { bestScore = score; best = e; }
        }
        return best;
      },
      apply(B, side, target, o) {
        const sd = B.sides[side];
        sd.buff.focus = target.i;
        sd.buff.focusUntil = B.t + o.dur;
        sd.buff.acc = o.acc;
        sd.buff.accUntil = B.t + o.dur;
        return BT().order('focus', B, target);
      },
    },
    hold: {
      trigger(B, side) {
        const sd = B.sides[side];
        const o = cfg().orders.hold;
        const act = B.units.filter((u) => u.side === side && u.state === 'active' && u.morale != null);
        if (!act.length) return null;
        const avg = act.reduce((a, u) => a + u.morale, 0) / act.length;
        return sd.lost / Math.max(1, sd.start) >= o.lossTrigger || avg < o.moraleTrigger ? true : null;
      },
      apply(B, side, x, o) {
        const sd = B.sides[side];
        for (const u of B.units) {
          if (u.side !== side || u.state !== 'active') continue;
          if (u.morale != null) { u.morale = Math.min(u.maxMorale + 10, u.morale + o.morale); u.broken = false; }
          u.supp = 0;
        }
        sd.buff.armor = o.armor;
        sd.buff.armorUntil = B.t + o.dur;
        return BT().order('hold', B);
      },
    },
    smoke: {
      trigger(B, side) {
        const sd = B.sides[side];
        if (sd.tactic === 'defense' && !sd.retreating) return null;
        let n = 0;
        for (const u of B.units) if (u.side === side && u.state === 'active' && u.supp >= 25) n++;
        return n >= cfg().orders.smoke.suppTrigger || (sd.retreating && n >= 1) ? true : null;
      },
      apply(B, side, x, o) {
        const mine = B.units.filter((u) => u.side === side && u.state === 'active');
        const foes = B.units.filter((u) => u.side !== side && u.state === 'active');
        if (!mine.length || !foes.length) return null;
        const cx = (arr) => Math.round(arr.reduce((a, u) => a + u.x, 0) / arr.length);
        const cy = (arr) => Math.round(arr.reduce((a, u) => a + u.y, 0) / arr.length);
        const sx = Math.round((cx(mine) * 2 + cx(foes)) / 3), sy = Math.round((cy(mine) * 2 + cy(foes)) / 3);
        B.smokes.push({ x: sx, y: sy - 2, r2: o.radius2, t0: B.t, t1: B.t + o.dur });
        B.smokes.push({ x: sx, y: sy + 2, r2: o.radius2, t0: B.t, t1: B.t + o.dur });
        return BT().order('smoke', B);
      },
    },
    rush: {
      trigger(B, side) {
        const sd = B.sides[side];
        if (sd.tactic === 'defense') return null;
        return B.t < 20 || sd.noTargetT > 25 ? true : null;
      },
      apply(B, side, x, o) {
        const sd = B.sides[side];
        sd.buff.speed = o.speed;
        sd.buff.speedUntil = B.t + o.dur;
        return BT().order('rush', B);
      },
    },
    grenade: {
      trigger(B, side) {
        const o = cfg().orders.grenade;
        for (const e of B.units) {
          if (e.side === side || e.state !== 'active') continue;
          let n = 0, friendly = false;
          for (const f of B.units) {
            if (f.state !== 'active' || d2(e, f) > o.radius2) continue;
            if (f.side === side) friendly = true; else n++;
          }
          if (friendly || n < o.minTargets) continue;
          for (const u of B.units) if (u.side === side && u.state === 'active' && d2(u, e) <= 36 && los(B, u, e)) return e;
        }
        return null;
      },
      apply(B, side, center, o) {
        B.booms.push([B.t, center.x, center.y]);
        const text = BT().order('grenade', B, center);
        for (const e of B.units) {
          if (e.side === side || e.state !== 'active' || d2(e, center) > o.radius2) continue;
          e.supp = Math.min(cfg().supp.max, e.supp + o.supp);
          damage(B, e, B.rng.int(o.dmg[0], o.dmg[1]), null);
        }
        return text;
      },
    },
    medkit: {
      trigger(B, side) {
        const o = cfg().orders.medkit;
        let n = 0;
        for (const u of B.units) if (u.side === side && u.state === 'active' && u.hp < u.maxHp * o.below) n++;
        return n >= o.minWounded ? true : null;
      },
      apply(B, side, x, o) {
        for (const u of B.units) {
          if (u.side !== side || u.state !== 'active' || u.type === 'droid' || u.type === 'walker' || u.type === 'turret') continue;
          u.hp = Math.min(u.maxHp, u.hp + o.heal);
          B.heals.push([B.t, u.i]);
        }
        return BT().order('medkit', B);
      },
    },
  };
  Engine.ORDERS = ORDERS;

  function runOrders(B) {
    for (let side = 0; side < 2; side++) {
      const sd = B.sides[side];
      for (const ord of sd.orders) {
        if (B.t < ord.readyAt) continue;
        const def = ORDERS[ord.id];
        const o = cfg().orders[ord.id];
        if (!def || !o) continue;
        const arg = def.trigger(B, side);
        if (!arg) continue;
        const text = def.apply(B, side, arg, o);
        if (text == null) continue;
        ord.readyAt = B.t + o.cd;
        ord.uses++;
        say(B, text, 'order');
      }
    }
  }

  // ================= ПОВЕДЕНИЕ =================
  function think(B, u) {
    const C = cfg();
    const sd = B.sides[u.side];

    // Отступление (приказ или паника)
    if (sd.retreating || u.broken) {
      if (u.base.static) return;
      const f = B.retreatField[u.side];
      if (f[idx(B, u.x, u.y)] === 0) { exit(B, u); return; }
      if (!stepAlong(B, u, f, true) && f[idx(B, u.x, u.y)] <= 1 && B.rng.chance(0.2)) exit(B, u);
      return;
    }

    // Медик лечит раненого рядом
    if (u.base.heal && u.healT <= B.t) {
      let best = null;
      for (const o of B.units) {
        if (o.side !== u.side || o === u || o.state !== 'active' || o.type === 'droid' || o.type === 'walker' || o.type === 'turret') continue;
        if (d2(u, o) <= 4 && o.hp < o.maxHp * 0.6 && (!best || o.hp / o.maxHp < best.hp / best.maxHp)) best = o;
      }
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + u.base.heal);
        u.healT = B.t + u.base.healCd;
        B.heals.push([B.t, best.i]);
        return;
      }
    }

    const tgt = pickTarget(B, u);
    if (tgt) {
      u.idleT = 0;
      if (u.fireT <= 0) { fire(B, u, tgt); return; }
      // Пока перезаряжается — ищет укрытие, если его прижали или тактика оборонительная
      if (!u.base.static && u.base.range > 2 && (sd.tactic === 'defense' || u.supp >= C.supp.coverAt) && (B.t + u.i) % 5 === 0) stepToCover(B, u, tgt);
      return;
    }
    if (u.base.static) return;
    u.idleT++;

    const field = enemyField(B, u.side);
    if (sd.tactic === 'flank' && u.waypoint && B.t < C.flankMaxTicks) {
      if (u.waypoint[idx(B, u.x, u.y)] > 1) { stepAlong(B, u, u.waypoint, true); return; }
      u.waypoint = null;
    }
    if (sd.tactic === 'defense') {
      if (u.idleT < C.defenseIdleAdvance) {
        if ((B.t + u.i) % 7 === 0) {
          // поиск укрытия против ближайшего врага
          let near = null;
          for (const e of B.units) if (e.side !== u.side && e.state === 'active' && (!near || d2(u, e) < d2(u, near))) near = e;
          if (near) stepToCover(B, u, near);
        }
        return;
      }
    }
    stepAlong(B, u, field, true);
  }

  function exit(B, u) {
    u.state = u.broken ? 'fled' : 'exited';
    B.occ[idx(B, u.x, u.y)] = -1;
    if (u.nx >= 0) { B.occ[idx(B, u.nx, u.ny)] = -1; u.nx = -1; }
  }

  function updateMorale(B, u) {
    const M = cfg().morale;
    if (u.morale == null) return;
    if (B.t - u.hitT > 20) u.morale = Math.min(u.maxMorale, u.morale + M.regen);
    if (!u.broken && u.morale < M.breakAt) {
      u.broken = true;
      say(B, BT().broken(B, u), u.side === 0 ? 'bad' : 'good');
    } else if (u.broken && u.morale > M.rallyAt) {
      u.broken = false;
    }
  }

  // ================= ТИК =================
  Engine.tick = function (B) {
    if (B.over) return;
    const C = cfg();
    B.t++;
    runOrders(B);
    for (let side = 0; side < 2; side++) {
      const sd = B.sides[side];
      if (!sd.retreating && sd.retreatAt > 0 && sd.lost / Math.max(1, sd.start) >= sd.retreatAt) {
        sd.retreating = true;
        say(B, BT().retreat(B, side), side === 0 ? 'bad' : 'good');
      }
    }
    const anyTarget = [false, false];
    for (const u of B.units) {
      if (u.state !== 'active') continue;
      u.supp = Math.max(0, u.supp - C.supp.decay);
      updateMorale(B, u);
      if (u.nx >= 0) {
        u.moveT--;
        if (u.moveT <= 0) finishMove(B, u);
        continue;
      }
      if (u.fireT > 0) u.fireT--;
      think(B, u);
      if (u.target >= 0) anyTarget[u.side] = true;
    }
    for (let side = 0; side < 2; side++) B.sides[side].noTargetT = anyTarget[side] ? 0 : B.sides[side].noTargetT + 1;
    record(B);
    checkEnd(B);
  };

  function checkEnd(B) {
    const act = [0, 0];
    for (const u of B.units) if (u.state === 'active') act[u.side]++;
    if (!act[1]) end(B, 0, B.sides[1].retreating ? 'enemyRetreat' : 'destroyed');
    else if (!act[0]) end(B, 1, B.sides[0].retreating ? 'retreat' : 'lost');
    else if (B.t >= cfg().maxTicks) {
      let w = B.setup.defender;
      if (w == null) {
        const frac = (side) => {
          let hp = 0, max = 0;
          for (const u of B.units) if (u.side === side) { max += u.maxHp; if (u.state === 'active') hp += u.hp; }
          return hp / Math.max(1, max);
        };
        w = frac(0) >= frac(1) ? 0 : 1;
      }
      end(B, w, 'timeout');
    }
  }

  function end(B, winner, reason) {
    B.over = true;
    B.winner = winner;
    B.reason = reason;
    say(B, BT().end(B), winner === 0 ? 'good' : 'bad');
  }

  // Кадр: для каждого юнита x*10, y*10, hp, флаги
  function record(B) {
    const f = new Array(B.units.length * 4);
    for (const u of B.units) {
      let x = u.x, y = u.y, fl = 0;
      if (u.nx >= 0) {
        const p = 1 - u.moveT / u.moveTotal;
        x = u.x + (u.nx - u.x) * p;
        y = u.y + (u.ny - u.y) * p;
        fl |= 16;
      }
      if (u.state === 'down') fl |= 1;
      if (u.state === 'exited' || u.state === 'fled') fl |= 2;
      if (u.broken) fl |= 4;
      if (u.supp >= 25) fl |= 8;
      const k = u.i * 4;
      f[k] = Math.round(x * 10); f[k + 1] = Math.round(y * 10); f[k + 2] = Math.max(0, u.hp); f[k + 3] = fl;
    }
    B.frames.push(f);
  }

  function say(B, text, tone) {
    if (text) B.log.push({ t: B.t, text: text, k: tone || 'info' });
  }

  // ================= ЗАПУСК =================
  Engine.run = function (setup) {
    const B = Engine.init(setup);
    let guard = 0;
    while (!B.over && guard++ < 5000) Engine.tick(B);
    return Engine.result(B);
  };

  Engine.result = function (B) {
    const units = B.units.map((u) => ({
      i: u.i, side: u.side, uid: u.uid, type: u.type, kind: u.kind, label: u.label,
      state: u.state, hp: Math.max(0, u.hp), maxHp: u.maxHp, kills: u.kills,
    }));
    let h = 2166136261 >>> 0;
    const str = B.t + '|' + B.winner + '|' + units.map((u) => u.state[0] + u.hp + ':' + u.kills).join(',');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return {
      winner: B.winner, reason: B.reason, ticks: B.t, units: units,
      log: B.log, frames: B.frames, shots: B.shots, smokes: B.smokes, booms: B.booms, heals: B.heals,
      map: { w: B.W, h: B.H, cells: B.cells, type: B.map.type },
      hash: (h >>> 0).toString(16),
    };
  };

  G.BattleEngine = Engine;
})(globalThis.G = globalThis.G || {});
