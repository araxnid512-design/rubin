'use strict';
/* Пошаговый тактический бой в стиле XCOM: правила и действия */
(function (DW) {
  const U = DW.U, D = DW.D;
  const BT = {};
  let B = null;
  let vis = null;
  BT.visVersion = 0;

  const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  BT.DIR4 = DIR4; BT.DIR8 = DIR8;
  BT.LOOT_SHORT = { gems: 'драг.', ammo: 'патр.', food: 'еды', meds: 'апт.', materials: 'мат.', grenades: 'гран.' };

  BT.get = function () { return B; };
  BT.vis = function () { return vis; };
  BT.idx = function (x, y) { return y * B.w + x; };
  BT.inb = function (x, y) { return x >= 0 && y >= 0 && x < B.w && y < B.h; };
  BT.objAt = function (x, y) { return BT.inb(x, y) ? B.obj[y * B.w + x] : 0; };
  /* лестницы на крыши: переход между клеткой у стены и краем крыши разрешён при любом перепаде */
  let ladderSet = {}, stairSet = {};
  BT.indexLadders = function () {
    ladderSet = {}; stairSet = {};
    (B.ladders || []).forEach(function (l) {
      const a = l.y * B.w + l.x, b = l.ry * B.w + l.rx;
      ladderSet[a + '>' + b] = 1; ladderSet[b + '>' + a] = 1;
      // лестница-ступени: клетка a — сам марш (заход только спереди и сверху, по прямой)
      if (l.st) stairSet[a] = { hi: b, front: (2 * l.y - l.ry) * B.w + (2 * l.x - l.rx), lo: a };
    });
  };
  BT.ladderEdge = function (i, j) { return !!ladderSet[i + '>' + j]; };
  BT.stairAt = function (i) { return stairSet[i] || null; };
  /* можно ли шагнуть i → j по правилам лестниц (высоты — отдельно) */
  BT.stairOk = function (i, j) {
    const a = stairSet[i], b = stairSet[j];
    if (a && j !== a.hi && j !== a.front) return false;
    if (b && i !== b.hi && i !== b.front) return false;
    return true;
  };
  /* видимая высота клетки (в уровнях): на марше лестницы — середина подъёма */
  BT.visLevel = function (x, y) {
    if (!B || !B.hgt) return 0;
    x = Math.max(0, Math.min(B.w - 1, x)); y = Math.max(0, Math.min(B.h - 1, y));
    const i = y * B.w + x, st = stairSet[i];
    return B.hgt[i] + (st ? (B.hgt[st.hi] - B.hgt[i]) * 0.5 : 0);
  };
  /* клетки машины: длина вдоль d, ширина (1–2) поперёк */
  BT.vehTiles = function (v) {
    const out = [], wd = v.wd || 1;
    for (let j = 0; j < v.len; j++) for (let s = 0; s < wd; s++) out.push(v.d === 0 ? [v.x + j, v.y + s] : [v.x + s, v.y + j]);
    return out;
  };
  BT.walkTile = function (x, y) {
    if (!BT.inb(x, y)) return false;
    const i = y * B.w + x;
    if (B.goal && B.goal.kind === 'rescue' && !B.goal.done && B.goal.x === x && B.goal.y === y) return false;
    return !B.obj[i] && D.GROUND[B.ground[i]].walk;
  };
  BT.blocksLos = function (x, y) {
    if (!BT.inb(x, y)) return false;
    const o = B.obj[y * B.w + x];
    return !!(o && D.OBJ[o].los);
  };
  BT.unitAt = function (x, y) {
    for (let i = 0; i < B.units.length; i++) {
      const u = B.units[i];
      if (u.alive && !u.evac && u.x === x && u.y === y) return u;
    }
    return null;
  };
  BT.players = function () { return B.units.filter(function (u) { return u.side === 'p' && u.alive && !u.evac; }); };
  BT.soldiers = function () { return B.units.filter(function (u) { return u.kind === 'soldier' && u.alive && !u.evac; }); };
  BT.enemies = function () { return B.units.filter(function (u) { return u.side === 'e' && u.alive; }); };
  BT.isEvacTile = function (x, y) { return B.evac.some(function (e) { return e[0] === x && e[1] === y; }); };

  /* ---------- Создание боя ---------- */
  function wavePool(fam) {
    const day = DW.G.state.day;
    if (fam === 'beast') return day < 10 ? ['scav', 'scav', 'spitter'] : ['scav', 'spitter', 'brute', 'scav'];
    return day < 10 ? ['raider', 'raider', 'thug'] : ['raider', 'thug', 'marksman', 'raider'];
  }
  BT.composePods = function (o) {
    const st = DW.G.state;
    const type = o.type, diff = o.diff;
    let n = 2 + diff + Math.floor((st.day - 1) / 7);
    if (o.kind === 'ambush') n = Math.max(2, n - 2);
    n = U.clamp(n, 2, 12);
    function poolFor(f) {
      if (f === 'beast') {
        if (diff >= 4) return ['scav', 'spitter', 'brute', 'spitter', 'brute'];
        if (diff >= 3) return ['scav', 'scav', 'spitter', 'brute', 'spitter'];
        if (diff >= 2) return ['scav', 'scav', 'spitter', 'spitter'];
        return ['scav', 'scav', 'scav', 'spitter'];
      }
      if (f === 'raider') {
        if (diff >= 3) return ['raider', 'raider', 'thug', 'marksman'];
        return diff >= 2 ? ['raider', 'raider', 'thug', 'thug'] : ['raider', 'raider', 'thug'];
      }
      return ['guardian', 'guardian', 'scav'];
    }
    const famMap = { landing: 'beast', vein: 'beast', lair: 'beast', nest: 'beast', camp: 'raider', vault: 'guard' };
    const fam = famMap[type] || null;
    const pods = [];
    if (o.kind !== 'ambush') {
      if (type === 'camp' && diff >= 3) { pods.push({ types: ['boss', 'raider'], anchor: true }); n -= 2; }
      // в логове — Вожак со стаей (с третьей сложности)
      if (type === 'lair') { pods.push({ types: diff >= 3 ? ['alpha', 'scav', 'scav'] : ['spitter', 'scav', 'spitter'], anchor: true }); n -= 3; }
      if (type === 'nest') { pods.push({ types: ['queen', 'brute', 'spitter'], anchor: true }); n = Math.max(n, 10) - 3; }
      if (type === 'vault') { pods.push({ types: ['guardian', 'guardian'], anchor: false }); n -= 2; }
    }
    while (n > 0) {
      const size = Math.min(n, U.rand(2, diff >= 3 ? 4 : 3));
      const f = fam || (Math.random() < 0.5 ? 'beast' : 'raider');
      const pool = poolFor(f);
      const types = [];
      for (let i = 0; i < size; i++) types.push(U.pick(pool));
      pods.push({ types: types });
      n -= size;
    }
    return pods;
  };

  function mkSoldier(s, x, y) {
    const G = DW.G;
    const W = D.WEAPONS[s.weapon];
    const mods = (s.mods || []).filter(function (m) { return D.MODS && D.MODS[m]; });
    const modSum = function (k) { return mods.reduce(function (a, m) { return a + (D.MODS[m][k] || 0); }, 0); };
    const u = mkSoldierBase(s, x, y, G, W);
    u.mods = mods; u.aim += modSum('aim'); u.clip += modSum('clip'); u.owMod = modSum('ow');
    if (u.perks.indexOf('medic2') >= 0) u.charges.heal += 2;
    return u;
  }
  function mkSoldierBase(s, x, y, G, W) {
    return {
      id: B.nextId++, side: 'p', kind: 'soldier', sid: s.id, name: s.name, cls: s.cls, x: x, y: y,
      hp: Math.max(1, G.hp(s)), maxHp: G.maxHp(s), aim: G.aim(s) - (G.state.hungry ? 10 : 0), mob: G.mob(s),
      def: 0, armor: D.ARMORS[s.armor].armor, armorId: s.armor, weapon: s.weapon, clip: W.clip + (G.has(s, 'clip') ? 1 : 0), ap: 2,
      trait: s.trait, perks: (s.perks || []).slice(), bonds: s.bonds || null,
      sight0: Math.max(5, 10 + (W.sight || 0) + (B.sightMod || 0)), sight: Math.max(5, 10 + (W.sight || 0) + (B.sightMod || 0)) + (B.dark && B.lights ? 2 : 0), cd: {}, charges: { heal: 3 }, overwatch: false, hunker: false, suppressed: false,
      alive: true, evac: false, kills: 0, xpGain: 0, face: 0, look: s.look, rank: G.rank(s)
    };
  }
  function mkEnemy(type, x, y, pod) {
    const T = D.ENEMIES[type];
    const st = DW.G.state;
    const bonus = Math.max(0, B.diff - 3) + Math.floor(st.day / 15);
    const wid = T.weapons ? U.pick(T.weapons) : T.weapon;
    const gren = type === 'boss' ? 2 : (type === 'thug' ? (Math.random() < 0.5 ? 1 : 0) : (type === 'raider' ? (Math.random() < 0.3 ? 1 : 0) : 0));
    const W = wid ? D.WEAPONS[wid] : null;
    return {
      id: B.nextId++, side: 'e', kind: 'enemy', type: type, name: T.n, x: x, y: y,
      hp: T.hp + bonus, maxHp: T.hp + bonus, aim: T.aim + bonus * 2, mob: T.mob, def: T.def || 0, armor: T.armor || 0,
      weapon: wid || null, clip: W ? W.clip : 0, ap: 0, sight: Math.max(5, (T.sight || 9) + (B.sightMod || 0)), pod: pod,
      active: false, seen: false, overwatch: false, hunker: false, suppressed: false, alive: true, evac: false,
      face: Math.PI, cd: {}, kills: 0, gren: gren
    };
  }
  function mkTurret(x, y) {
    return {
      id: B.nextId++, side: 'p', kind: 'turret', name: 'Автотурель', x: x, y: y, hp: 10, maxHp: 10, aim: 65, mob: 0,
      def: 0, armor: 1, weapon: 'turret', clip: 99, ap: 0, sight: Math.max(5, 9 + (B.sightMod || 0)), cd: {}, charges: {}, overwatch: false, hunker: false,
      suppressed: false, alive: true, evac: false, kills: 0, xpGain: 0, face: 0
    };
  }

  BT.create = function (o) {
    const st = DW.G.state;
    const pods = o.kind === 'defense' ? [] : BT.composePods(o);
    const nd = o.nodeId !== null && o.nodeId !== undefined && st.world ? st.world.nodes[o.nodeId] : null;
    const mapType = o.kind === 'defense' ? 'defense' : ((nd && nd.map) || D.NODE_TYPES[o.type].map);
    const m = DW.MapGen.generate(mapType, { diff: o.diff, kind: o.kind, pods: pods, buildings: st.buildings });
    B = {
      v: 1, nodeId: o.nodeId, type: o.type, kind: o.kind, diff: o.diff, raidKind: o.raid ? o.raid.kind : null,
      w: m.w, h: m.h, ground: m.ground, obj: m.obj, objHp: m.objHp, hgt: m.hgt, decor: m.decor, props: m.props || [], items: m.items, evac: m.evac, map: mapType,
      units: [], turn: 1, phase: 'player', explored: new Array(m.w * m.h).fill(0),
      loot: {}, field: {}, drops: [], corpses: [], waves: [], spawn: m.spawn || [], nextId: 1, over: null,
      queenDead: false, seed: U.rand(1, 1e9), waveNo: 0, objective: '', decals: [], vehicles: m.vehicles || [], ladders: m.ladders || [], rooms: m.rooms || []
    };
    BT.indexLadders();
    BT.rollConditions(B, mapType);
    // ночью и в пещерах — фонари: бойцы видят дальше, но их замечают издалека
    B.dark = B.tod === 'night' || B.tod === 'cave'; B.lights = B.dark;
    // скрытное начало (как в XCOM 2): враги не знают об отряде, пока не заметят его вблизи
    B.concealed = o.kind !== 'defense' && o.kind !== 'ambush';
    const squad = o.squad.map(function (id) { return st.roster.find(function (s) { return s.id === id; }); }).filter(Boolean);
    squad.forEach(function (s, i) {
      const d = m.deploy[i];
      if (d) B.units.push(mkSoldier(s, d[0], d[1]));
    });
    (m.turrets || []).forEach(function (t) { B.units.push(mkTurret(t[0], t[1])); });
    m.pods.forEach(function (p, pi) {
      p.members.forEach(function (mm) { B.units.push(mkEnemy(mm.type, mm.x, mm.y, pi)); });
    });
    if (o.kind === 'defense') {
      const s = o.raid.strength;
      const w1 = Math.ceil(s * 0.4), w2 = Math.ceil(s * 0.35), w3 = Math.max(1, s - w1 - w2);
      B.waves = [
        { turn: 0, n: w1, fam: o.raid.kind, spawned: false },
        { turn: 3, n: w2, fam: o.raid.kind, spawned: false },
        { turn: 5, n: w3, fam: o.raid.kind, spawned: false }
      ];
      BT.spawnWaves(true);
    }
    // задание боя: освободить пленника, убить вожака стаи или забрать груз Института
    B.goal = null;
    if (o.kind === 'normal' && B.type !== 'nest' && B.type !== 'vein') {
      const en = B.units.filter(function (e) { return e.side === 'e'; });
      const raid = en.some(function (e) { return e.type === 'raider' || e.type === 'thug' || e.type === 'boss' || e.type === 'marksman'; });
      const beast = en.some(function (e) { return D.ENEMIES[e.type] && D.ENEMIES[e.type].beast; });
      const r = Math.random();
      if (raid && r < 0.4) BT.setupRescue();
      else if (beast && o.diff >= 2 && r < 0.65) BT.setupHunt();
      else if (r < 0.85) BT.setupCargo();
    }
    BT.updateObjective();
    BT.updateVision();
    return B;
  };
  /* ---------- Задания боя ---------- */
  function freeTileNear(cx, cy, rmax, avoidDeploy) {
    for (let r = 1; r <= rmax; r++) {
      const c = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !BT.walkTile(x, y) || BT.unitAt(x, y)) continue;
        if (B.items.some(function (it) { return it.x === x && it.y === y; })) continue;
        if (avoidDeploy && x < 6) continue;
        c.push([x, y]);
      }
      if (c.length) return U.pick(c);
    }
    return null;
  }
  // пленник у бандитов: рядом с самой дальней группой бандитов
  BT.setupRescue = function () {
    const en = B.units.filter(function (e) { return e.side === 'e' && (e.type === 'raider' || e.type === 'thug' || e.type === 'boss' || e.type === 'marksman'); });
    en.sort(function (a, b) { return b.x - a.x; });
    const t = en.length ? freeTileNear(en[0].x, en[0].y, 4, true) : null;
    if (!t) return;
    B.goal = { kind: 'rescue', x: t[0], y: t[1], done: false };
  };
  BT.freeCaptive = function (u) {
    const g = B.goal; if (!g || g.done) return;
    g.done = true;
    const st = DW.G.state;
    const s = DW.G.makeRecruit(0);
    s.wounds = Math.floor(DW.G.maxHp(s) / 3);
    st.roster.push(s);
    const nu = mkSoldier(s, g.x, g.y); nu.ap = 0; nu.face = Math.atan2(u.y - g.y, u.x - g.x);
    B.units.push(nu);
    DW.TR.float(g.x, g.y, 'Свободен!', 'good');
    DW.UI.toast('Пленник освобождён: «' + s.name + '» (' + D.CLASSES[s.cls].n.toLowerCase() + ') вступает в отряд!', 'good');
    DW.SFX.play('pickup');
    BT.updateObjective(); BT.updateVision();
    if (DW.BS && DW.BS.refresh) DW.BS.refresh();
  };
  // вожак стаи: убить — стая в смятении, с вожака — кристаллы
  BT.setupHunt = function () {
    const pods = {};
    B.units.forEach(function (e) { if (e.side === 'e' && D.ENEMIES[e.type] && D.ENEMIES[e.type].beast && e.type !== 'queen') (pods[e.pod] = pods[e.pod] || []).push(e); });
    const ids = Object.keys(pods).sort(function (a, b) { return pods[b].length - pods[a].length; });
    if (!ids.length) return;
    const lead = pods[ids[0]][0];
    const a = mkEnemy('alpha', lead.x, lead.y, lead.pod);
    B.units[B.units.indexOf(lead)] = a;
    B.goal = { kind: 'hunt', id: a.id, done: false };
  };
  // груз Института: контейнер посреди карты (и сброс груза по ходу боя)
  BT.setupCargo = function () {
    const t = freeTileNear(Math.floor(B.w * 0.55), Math.floor(B.h / 2), 6, true);
    if (!t) return;
    B.items.push({ x: t[0], y: t[1], kind: 'cargo', amt: 1 });
    B.goal = { kind: 'cargo', x: t[0], y: t[1], done: false };
  };
  BT.cargoDrop = function () {
    if (B.kind !== 'normal' || B.dropDone || B.turn < 3 || B.items.some(function (it) { return it.kind === 'cargo'; })) return;
    if (Math.random() > (DW.G.blv('radio') ? 0.5 : 0.3)) return;   // радиовышка ловит сигнал сброса
    const ps = BT.soldiers(); if (!ps.length) return;
    const cx = Math.round(ps.reduce(function (a, u) { return a + u.x; }, 0) / ps.length) + U.rand(3, 6), cy = Math.round(ps.reduce(function (a, u) { return a + u.y; }, 0) / ps.length) + U.rand(-3, 3);
    const t = freeTileNear(U.clamp(cx, 2, B.w - 3), U.clamp(cy, 2, B.h - 3), 5, false);
    if (!t) return;
    B.dropDone = true;
    B.items.push({ x: t[0], y: t[1], kind: 'cargo', amt: 1, drop: true });
    DW.TR.cargoFx(t[0], t[1]);
    DW.SFX.play('portal');
    DW.UI.toast('Институт сбросил груз! Заберите контейнер, пока его не растащили.', 'good');
  };
  /* ---------- Время суток и погода ---------- */
  BT.rollConditions = function (b, mapType) {
    let tod;
    if (mapType === 'vault') tod = 'interior';
    else if (mapType === 'lair' || mapType === 'crystalcave') tod = 'cave';
    else { const r = Math.random(); tod = r < 0.4 ? 'day' : (r < 0.58 ? 'dawn' : (r < 0.8 ? 'dusk' : 'night')); }
    let weather = 'clear';
    if (tod !== 'interior' && tod !== 'cave') { const r = Math.random(); weather = r < 0.55 ? 'clear' : (r < 0.7 ? 'dust' : (r < 0.85 ? 'ash' : 'rain')); }
    b.tod = tod; b.weather = weather;
    b.sightMod = (tod === 'night' ? -2 : 0) + (tod === 'cave' ? -1 : 0) + (weather === 'dust' ? -3 : 0);
  };
  BT.condText = function (b) {
    const t = { day: 'День', dawn: 'Рассвет', dusk: 'Закат', night: 'Ночь', interior: 'Внутри бункера', cave: 'В пещерах' }[b.tod || 'day'];
    const w = { clear: '', dust: 'пыльная буря', ash: 'пеплопад', rain: 'кислотный дождь' }[b.weather || 'clear'];
    const m = b.sightMod ? ' (обзор ' + b.sightMod + ')' : '';
    return t + (w ? ', ' + w : '') + m;
  };
  BT.restore = function (data) {
    B = data;
    BT.indexLadders();
    BT.updateVision();
    return B;
  };
  BT.clear = function () { B = null; vis = null; };

  BT.updateObjective = function () {
    if (!B) return;
    const en = BT.enemies().length;
    if (B.kind === 'defense') {
      const left = B.waves.filter(function (w) { return !w.spawned; }).length;
      B.objective = 'Оборона базы: волна ' + B.waveNo + '/3' + (left ? '' : ' (последняя)') + ' · врагов: ' + en;
    } else if (B.type === 'nest' && B.kind !== 'ambush') {
      B.objective = B.queenDead ? 'Матка мертва! Добейте остальных' : 'Убейте Матку';
    } else if (B.type === 'vein') {
      B.objective = 'Перебейте мутантов и соберите кристаллы (' + B.items.filter(function (i) { return i.kind === 'gems'; }).length + ' осталось)';
    } else {
      const g = B.goal;
      if (g && !g.done && g.kind === 'rescue') B.objective = 'Освободите пленника и уничтожьте врагов';
      else if (g && !g.done && g.kind === 'hunt') B.objective = 'Убейте вожака стаи и уничтожьте врагов';
      else if (g && !g.done && g.kind === 'cargo') B.objective = 'Заберите груз Института и уничтожьте врагов';
      else B.objective = 'Уничтожьте всех врагов';
    }
  };

  /* ---------- Обзор ---------- */
  BT.peek = function (x, y) {
    const res = [[x, y]];
    let adj = false;
    for (let k = 0; k < 4; k++) if (BT.blocksLos(x + DIR4[k][0], y + DIR4[k][1])) { adj = true; break; }
    if (adj) {
      for (let k = 0; k < 4; k++) {
        const nx = x + DIR4[k][0], ny = y + DIR4[k][1];
        if (BT.walkTile(nx, ny)) res.push([nx, ny]);
      }
    }
    return res;
  };
  BT.hAt = function (x, y) { return B.hgt && x >= 0 && y >= 0 && x < B.w && y < B.h ? B.hgt[y * B.w + x] : 0; };
  BT.rayClear = function (ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 3);
    if (n === 0) return true;
    const hm = B.hgt ? Math.max(B.hgt[ay * B.w + ax] || 0, B.hgt[by * B.w + bx] || 0) : 0;
    let px = ax, py = ay;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = Math.floor(ax + 0.5 + dx * t), y = Math.floor(ay + 0.5 + dy * t);
      if (x === px && y === py) continue;
      if (!(x === bx && y === by) && !(x === ax && y === ay) && (BT.blocksLos(x, y) || (B.hgt && B.hgt[y * B.w + x] > hm))) return false;
      if (x !== px && y !== py && BT.blocksLos(x, py) && BT.blocksLos(px, y)) return false;
      px = x; py = y;
    }
    if (bx !== px && by !== py && BT.blocksLos(bx, py) && BT.blocksLos(px, by)) return false;
    return true;
  };
  BT.canSeeFrom = function (x, y, tx, ty, range) {
    if (U.dist(x, y, tx, ty) > range + 0.01) return false;
    const pa = BT.peek(x, y), pb = BT.peek(tx, ty);
    for (let i = 0; i < pa.length; i++) for (let j = 0; j < pb.length; j++) {
      if (BT.rayClear(pa[i][0], pa[i][1], pb[j][0], pb[j][1])) return true;
    }
    return false;
  };
  /* страж бункера прикрывает силовым щитом себя и союзников в 2 клетках */
  BT.shielded = function (u) {
    return u.side === 'e' && B.units.some(function (g) { return g.alive && g.type === 'guardian' && g.active && U.dist(g.x, g.y, u.x, u.y) <= 2; });
  };
  BT.canSee = function (a, b) { return BT.canSeeFrom(a.x, a.y, b.x, b.y, a.sight); };

  BT.updateVision = function () {
    if (!B) return [];
    const w = B.w, h = B.h;
    vis = new Uint8Array(w * h);
    const ps = BT.players();
    ps.forEach(function (u) {
      const r = u.sight;
      const pk = BT.peek(u.x, u.y);
      const x0 = Math.max(0, u.x - r), x1 = Math.min(w - 1, u.x + r);
      const y0 = Math.max(0, u.y - r), y1 = Math.min(h - 1, u.y + r);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * w + x;
          if (vis[i]) continue;
          if ((x - u.x) * (x - u.x) + (y - u.y) * (y - u.y) > r * r) continue;
          for (let k = 0; k < pk.length; k++) {
            if (BT.rayClear(pk[k][0], pk[k][1], x, y)) { vis[i] = 1; break; }
          }
        }
      }
    });
    const newly = [];
    B.units.forEach(function (e) {
      if (e.side !== 'e' || !e.alive) return;
      let seen = !!vis[e.y * w + e.x];
      if (!seen) for (let k = 0; k < ps.length; k++) if (BT.canSee(ps[k], e)) { seen = true; break; }
      if (seen) vis[e.y * w + e.x] = 1;
      if (seen && !e.seen) newly.push(e);
      e.seen = seen;
    });
    for (let i = 0; i < vis.length; i++) if (vis[i]) B.explored[i] = 1;
    BT.visVersion++;
    return newly;
  };

  /* ---------- Укрытия и попадания ---------- */
  BT.coverAt = function (x, y, fx, fy) {
    let best = 0, any = 0, tile = null;
    const dx = fx - x, dy = fy - y;
    const L = Math.hypot(dx, dy) || 1;
    const h0 = BT.hAt(x, y), hf = BT.inb(fx, fy) ? BT.hAt(fx, fy) : h0;
    for (let k = 0; k < 4; k++) {
      const d = DIR4[k];
      const o = BT.objAt(x + d[0], y + d[1]);
      const cliff = hf <= h0 && BT.hAt(x + d[0], y + d[1]) > h0 && BT.inb(x + d[0], y + d[1]);
      if (!o && !cliff) continue;
      const c = Math.max(o ? D.OBJ[o].cover : 0, cliff ? 2 : 0);
      if (!c) continue;
      if (c > any) any = c;
      if ((dx * d[0] + dy * d[1]) / L > 0.25 && c > best) { best = c; tile = [x + d[0], y + d[1]]; }
    }
    return { cover: best, flanked: any > 0 && best === 0, tile: tile };
  };
  BT.shotInfo = function (att, tgt, o) {
    o = o || {};
    const ax = o.fromX !== undefined ? o.fromX : att.x, ay = o.fromY !== undefined ? o.fromY : att.y;
    const W = D.WEAPONS[att.weapon];
    const d = U.dist(ax, ay, tgt.x, tgt.y);
    const parts = [];
    let hit = att.aim;
    parts.push(['Меткость', att.aim]);
    if (W.aimMod) { hit += W.aimMod; parts.push(['Оружие', W.aimMod]); }
    const rm = D.rangeMod(W.range, d);
    if (rm) { hit += rm; parts.push(['Дистанция', rm]); }
    const cv = BT.coverAt(tgt.x, tgt.y, ax, ay);
    if (cv.cover) { const c = cv.cover === 2 ? -40 : -20; hit += c; parts.push([cv.cover === 2 ? 'Полное укрытие' : 'Укрытие', c]); }
    if (tgt.def) { hit -= tgt.def; parts.push(['Уклонение', -tgt.def]); }
    if (tgt.hunker) { hit -= 20; parts.push(['Залёг', -20]); }
    else if (tgt.crouch) { hit -= 10; parts.push(['Присел', -10]); }
    if (BT.inb(ax, ay) && (D.GROUND[B.ground[BT.idx(ax, ay)]].high || BT.hAt(ax, ay) > BT.hAt(tgt.x, tgt.y))) { hit += 15; parts.push(['Высота', 15]); }
    const hasP = function (u, p) { return u.perks && u.perks.indexOf(p) >= 0; };
    if (o.reaction && !hasP(att, 'ow')) { hit -= 10; parts.push(['Реакция', -10]); }
    if (o.reaction && att.trait === 'cold') { hit += 15; parts.push(['Хладнокровие', 15]); }
    if (o.reaction && hasP(att, 'ow')) { hit += 10; parts.push(['Глаз дозорного', 10]); }
    if (att.suppressed) { const sp = att.trait === 'calm' ? -20 : -40; hit += sp; parts.push(['Подавлен', sp]); }
    if (att.kind === 'soldier' && att.trait !== 'authority' && B.units.some(function (a) { return a.alive && a.trait === 'authority' && a !== att && U.dist(a.x, a.y, ax, ay) <= 5; })) { hit += 5; parts.push(['Крут рядом', 5]); }
    if (cv.cover && hasP(tgt, 'dig')) { hit -= 10; parts.push(['Окопник', -10]); }
    if (tgt.side === 'e' && BT.shielded(tgt)) { hit -= 15; parts.push(['Щит стража', -15]); }
    if (att.side === 'e' && att.type !== 'alpha' && D.ENEMIES[att.type] && D.ENEMIES[att.type].beast && B.units.some(function (a) { return a.alive && a.type === 'alpha' && U.dist(a.x, a.y, att.x, att.y) <= 4; })) { hit += 10; parts.push(['Вожак рядом', 10]); }
    if (B.concealed && att.side === 'p' && !o.reaction) { hit += 15; parts.push(['Из засады', 15]); }
    if (att.kind === 'soldier' && att.bonds && B.units.some(function (a) { return a.alive && a.kind === 'soldier' && a !== att && (att.bonds[a.sid] || 0) >= 3 && U.dist(a.x, a.y, ax, ay) <= 1.5; })) { hit += 5; parts.push(['Товарищ рядом', 5]); }
    if (o.aimBonus) { hit += o.aimBonus; parts.push([o.aimLabel || 'Бонус', o.aimBonus]); }
    if (hasP(att, 'steady') && !att.moved && !o.reaction) { hit += 10; parts.push(['Твёрдая рука', 10]); }
    if (hasP(att, 'close') && d <= 4) { hit += 15; parts.push(['В упор', 15]); }
    if (hasP(att, 'sharp') && d >= 8) { hit += 10; parts.push(['Дальнобой', 10]); }
    if (o.reaction && att.owMod) { hit += att.owMod; parts.push(['Приклад', att.owMod]); }
    hit = U.clamp(Math.round(hit), 1, 100);
    let crit = W.crit || 0;
    if (!cv.cover) crit += cv.flanked ? 40 : 25;
    if (o.critBonus) crit += o.critBonus;
    if (att.trait === 'lucky') crit += 10;
    if (B.concealed && att.side === 'p') crit += 10;
    if (hasP(att, 'crit')) crit += 12;
    if (hasP(att, 'flank') && (!cv.cover || cv.flanked)) crit += 20;
    if (tgt.hunker) crit = 0;
    crit = U.clamp(crit, 0, 100);
    return { hit: hit, crit: crit, cover: cv.cover, flanked: cv.flanked, coverTile: cv.tile, d: d, parts: parts, dmg: W.dmg };
  };
  BT.meleeInfo = function (att, tgt) {
    let hit = att.aim - (tgt.def || 0) - (tgt.hunker ? 20 : 0);
    hit = U.clamp(Math.round(hit), 5, 95);
    return { hit: hit, crit: 10 };
  };
  BT.rollDamage = function (dmg, crit, armor, pierce) {
    let d = U.rand(dmg[0], dmg[1]);
    if (crit) d += Math.ceil(d * 0.5);
    if (!pierce) d = Math.max(1, d - (armor || 0));
    return d;
  };
  BT.targetsFor = function (u) {
    return BT.enemies().filter(function (e) { return e.seen && BT.canSee(u, e); });
  };

  /* ---------- Урон, смерть, разрушения ---------- */
  BT.damage = async function (u, dmg, src, crit) {
    if (!u.alive) return false;
    if (u.perks && u.perks.indexOf('tough') >= 0 && dmg > 1) dmg -= 1;
    if (src && src.perks && src.perks.indexOf('shred') >= 0 && u.armor > 0) { u.armor -= 1; DW.TR.float(u.x, u.y, 'Броня −1', 'info'); }
    u.hp -= dmg;
    DW.TR.float(u.x, u.y, (crit ? 'КРИТ −' : '−') + dmg, crit ? 'crit' : (u.side === 'p' ? 'hurt' : 'dmg'));
    DW.TR.blood(u);
    DW.TR.hitFx(u);
    DW.SFX.play('hit');
    if (u.hp > 0 && u.kind === 'soldier') DW.TR.bark(u, u.hp <= u.maxHp * 0.35 ? 'lowhp' : 'hurt');
    else if (u.hp > 0 && src && src.side === 'e' && src.seen && Math.random() < 0.35) DW.TR.bark(src, 'enemyhit');
    if (u.hp <= 0) {
      const over = -u.hp;
      u.hp = 0;
      BT.kill(u, src, over);
      await U.sleep(420);
      return true;
    }
    await U.sleep(220);
    return false;
  };
  /* Паника: товарищи рядом с павшим могут потерять самообладание на ход (спокойные и опытные — реже,
     близкие товарищи павшего — чаще) */
  BT.panicNear = function (fallen) {
    B.units.forEach(function (a) {
      if (!a.alive || a.kind !== 'soldier' || a === fallen || a.panic || (a.perks && a.perks.indexOf('cool') >= 0)) return;
      if (U.dist(a.x, a.y, fallen.x, fallen.y) > 6) return;
      let ch = 0.22 - (a.rank || 0) * 0.03 - (a.trait === 'calm' ? 0.12 : 0) - (a.trait === 'authority' ? 0.1 : 0);
      if (a.bonds && (a.bonds[fallen.sid] || 0) >= 3) ch += 0.1;
      if (Math.random() < ch) { a.panic = true; DW.TR.float(a.x, a.y, 'Паника!', 'bad'); DW.TR.bark(a, 'hurt'); }
    });
  };
  /* Скрытность: зона обнаружения врага и раскрытие отряда */
  BT.DETECT = 4;
  BT.detectR = function () {
    if (B.dark) return BT.DETECT + (B.lights ? 2 : -1);
    return B.weather === 'dust' ? BT.DETECT - 1 : BT.DETECT;
  };
  BT.toggleLights = function () {
    if (!B.dark) return;
    B.lights = !B.lights;
    B.units.forEach(function (u) { if (u.kind === 'soldier' && u.sight0) u.sight = u.sight0 + (B.lights ? 2 : 0); });
    BT.updateVision();
    DW.TR.float(BT.soldiers()[0] ? BT.soldiers()[0].x : 0, BT.soldiers()[0] ? BT.soldiers()[0].y : 0, B.lights ? 'Фонари включены' : 'Фонари выключены', 'info');
    DW.SFX.play('click');
  };
  BT.detects = function (e) {
    if (!e.alive || e.side !== 'e' || e.active) return false;
    const R = BT.detectR();
    return B.units.some(function (s) { return s.alive && s.side === 'p' && s.kind === 'soldier' && U.dist(s.x, s.y, e.x, e.y) <= (s.crouch ? R - 2 : R) + 0.01 && BT.canSee(e, s); });
  };
  BT.detectZone = function () {
    if (!B.concealed) return null;
    const z = new Uint8Array(B.w * B.h); let any = false;
    B.units.forEach(function (e) {
      if (!e.alive || e.side !== 'e' || e.active || !e.seen) return;
      const R = BT.detectR();
      for (let y = Math.max(0, e.y - R); y <= Math.min(B.h - 1, e.y + R); y++) for (let x = Math.max(0, e.x - R); x <= Math.min(B.w - 1, e.x + R); x++) {
        if (U.dist(x, y, e.x, e.y) > R + 0.01) continue;
        if (BT.canSeeFrom(e.x, e.y, x, y, e.sight || 9)) { z[y * B.w + x] = 1; any = true; }
      }
    });
    return any ? z : null;
  };
  /* после раскрытия — в бой вступают все группы, которых видит отряд */
  BT.wakeSeen = async function () {
    if (B.concealed) return;
    const l = B.units.filter(function (e) { return e.alive && e.side === 'e' && !e.active && e.seen; });
    if (l.length) await BT.activatePods(l);
  };
  BT.reveal = function (msg) {
    if (!B.concealed) return;
    B.concealed = false;
    DW.UI.toast(msg || 'Отряд обнаружен!', 'alert');
    const sp = BT.soldiers()[0]; if (sp) DW.TR.bark(sp, 'contact');
    if (DW.Music) { DW.Music.sting('contact'); DW.Music.intensity(1); }
    if (DW.BS && DW.BS.refresh) DW.BS.refresh();
  };
  function alphaDown(u) {
    if (u.type !== 'alpha') return;
    if (B.goal && B.goal.kind === 'hunt' && B.goal.id === u.id) { B.goal.done = true; B.loot.gems = (B.loot.gems || 0) + 6; }
    let n = 0;
    B.units.forEach(function (e) { if (e.alive && e.side === 'e' && e.pod === u.pod && e !== u) { e.stun = 1; n++; } });
    DW.UI.toast('Вожак убит!' + (n ? ' Стая в смятении — ход пропустят.' : '') + (B.goal && B.goal.kind === 'hunt' ? ' +6 драг.' : ''), 'good');
  }
  BT.kill = function (u, src, over) {
    if (u.side === 'e') alphaDown(u);
    u.alive = false; u.overwatch = false; u.hunker = false; u.crouch = false;
    if (u.kind === 'soldier' && (over || 0) <= 4 && Math.random() < Math.min(0.9, 0.55 + (u.rank || 0) * 0.08)) {
      u.down = 4; u.stable = false;
    }
    B.corpses.push({ x: u.x, y: u.y, side: u.side, type: u.type || u.kind, face: u.face, uid: u.id });
    DW.TR.dieFx(u);
    if (u.side === 'e') {
      const T = D.ENEMIES[u.type];
      DW.SFX.play(T.beast ? 'growl' : 'death');
      if (src && src.side === 'p') { src.kills = (src.kills || 0) + 1; src.xpGain = (src.xpGain || 0) + T.xp; if (src.alive) DW.TR.bark(src, 'kill'); }
      for (const k in T.loot) {
        const r = T.loot[k];
        B.field[k] = (B.field[k] || 0) + U.rand(r[0], r[1]);
      }
      if (T.drop && Math.random() < 0.5) B.drops.push(T.drop);
      if (T.boss) { B.queenDead = true; DW.UI.toast('Матка убита!', 'good'); }
    } else {
      DW.SFX.play('death');
      if (u.down) DW.UI.toast(u.name + ' тяжело ранен и истекает кровью! Помогите за 3 хода.', 'alert');
      if (u.kind === 'soldier') BT.panicNear(u);
      const mate = B.units.find(function (a) { return a.kind === 'soldier' && a.alive && a !== u; });
      if (mate) DW.TR.bark(mate, u.down ? 'downed' : 'died', u.name);
      else DW.UI.toast(u.name + (u.kind === 'turret' ? ' уничтожена' : ' погиб!'), 'bad');
    }
    BT.updateObjective();
  };
  /* Раненые, которых можно спасти */
  BT.downedNear = function (u) {
    return B.units.filter(function (a) { return a.kind === 'soldier' && !a.alive && a.down > 0 && !a.stable && Math.max(Math.abs(a.x - u.x), Math.abs(a.y - u.y)) <= 1; });
  };
  BT.doStabilize = function (u, t) {
    const st = DW.G.state;
    if (u.cls === 'medic' && u.charges && u.charges.heal > 0) u.charges.heal -= 1;
    else st.res.meds -= 1;
    u.ap -= 1;
    t.stable = true;
    u.face = Math.atan2(t.y - u.y, t.x - u.x);
    DW.TR.anim(u, 'heal', 900);
    DW.TR.bark(u, 'save');
    DW.TR.float(t.x, t.y, 'Стабилизирован', 'good');
    DW.SFX.play('pickup');
    DW.UI.toast(t.name + ' спасён — выживет, если отряд победит или уйдёт.', 'good');
  };
  /* Удар прикладом по соседнему врагу */
  BT.meleeTargets = function (u) {
    return B.units.filter(function (e) { return e.side === 'e' && e.alive && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1 && Math.abs(BT.hAt(e.x, e.y) - BT.hAt(u.x, u.y)) <= 1; });
  };
  BT.doButt = async function (u, t) {
    u.ap = 0;
    const amb = B.concealed;
    if (amb) BT.reveal('Засада!');
    u.face = Math.atan2(t.y - u.y, t.x - u.x);
    DW.SFX.play('melee');
    await DW.TR.lungeFx(u, t);
    const hit = Math.random() * 100 < U.clamp(85 - (t.def || 0), 30, 95);
    if (hit) {
      const crit = Math.random() < 0.15;
      DW.TR.float(u.x, u.y, 'Приклад!', 'info');
      await BT.damage(t, BT.rollDamage([3, 5], crit, t.armor, false), u, crit);
    } else { DW.TR.float(t.x, t.y, 'Промах', 'miss'); await U.sleep(220); }
    if (t.alive && t.side === 'e' && !t.active) await BT.activatePods([t]);
    if (amb && !B.over) await BT.wakeSeen();
  };
  /* Клетки зоны хода, которые простреливает вражеский дозор */
  BT.owZone = function (R) {
    const n = B.w * B.h, z = new Uint8Array(n);
    const ows = B.units.filter(function (e) { return e.side === 'e' && e.alive && e.overwatch && e.seen; });
    if (!ows.length || !R) return null;
    let any = false;
    for (let i = 0; i < n; i++) {
      if (R.cost[i] === Infinity) continue;
      const x = i % B.w, y = (i / B.w) | 0;
      for (let k = 0; k < ows.length; k++) { if (BT.canSeeFrom(ows[k].x, ows[k].y, x, y, ows[k].sight)) { z[i] = 1; any = true; break; } }
    }
    return any ? z : null;
  };
  BT.damageObj = function (x, y, dmg) {
    if (!BT.inb(x, y)) return;
    const i = BT.idx(x, y);
    const o = B.obj[i];
    if (!o) return;
    B.objHp[i] -= dmg;
    DW.TR.chips(x, y, D.OBJ[o].c, o);
    if (o === 23 && B.objHp[i] <= 0) {
      // подбитая машина горит целиком: все её клетки — обломки, пожар
      const v = (B.vehicles || []).find(function (vv) { return !vv.dead && BT.vehTiles(vv).some(function (q) { return q[0] === x && q[1] === y; }); });
      if (v) {
        v.dead = true;
        BT.vehTiles(v).forEach(function (q) {
          const X = q[0], Y = q[1], k = BT.idx(X, Y);
          B.obj[k] = 0; B.objHp[k] = 0;
          if (D.GROUND[B.ground[k]].walk) B.ground[k] = 8;
          DW.TR.tileChanged(X, Y); DW.TR.debris(X, Y, D.OBJ[23].c, 23); DW.TR.decal(X, Y, 'scorch', 1);
          B.decor.push({ x: X + 0.5, y: Y + 0.5, t: 'fire', r: 0.6 });
        });
        DW.TR.refreshFires();
        return;
      }
    }
    if (B.objHp[i] <= 0) {
      B.obj[i] = 0; B.objHp[i] = 0;
      if (D.GROUND[B.ground[i]].walk) B.ground[i] = 8;
      DW.TR.tileChanged(x, y);
      DW.TR.debris(x, y, D.OBJ[o].c, o);
      DW.TR.decal(x, y, 'rubble', 1);
      if (o === 9) { (B.blasts = B.blasts || []).push([x, y]); B.decor.push({ x: x + 0.5, y: y + 0.5, t: 'fire', r: 0.5 }); DW.TR.refreshFires(); }
    }
  };
  /* Взрывы бочек (цепная реакция) */
  BT.processBlasts = async function (src) {
    let guard = 0;
    while (B && B.blasts && B.blasts.length && guard++ < 12) {
      const b = B.blasts.shift();
      DW.UI.toast('Бочка взорвалась!', 'alert');
      await BT.explode(b[0], b[1], 1.5, [2, 4], 4, src, true);
    }
  };
  BT.explode = async function (cx, cy, radius, dmg, objDmg, src, nested) {
    await DW.TR.focusOn(cx, cy, true);
    DW.TR.explosionFx(cx, cy, radius);
    DW.TR.decal(cx, cy, 'scorch', radius);
    DW.SFX.play('explosion');
    await U.sleep(260);
    const r = Math.ceil(radius);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!BT.inb(x, y) || U.dist(x, y, cx, cy) > radius + 0.01) continue;
      const ob = B.obj[BT.idx(x, y)];
      if (ob) {
        // взрыв проламывает кладку: кирпичная стена — с одной гранаты, каменная — с двух
        const wall = ob === 1 || ob === 2 || ob === 13 || ob === 14;
        BT.damageObj(x, y, wall ? objDmg * 2 : objDmg);
        if (wall && !B.obj[BT.idx(x, y)]) DW.TR.float(x, y, 'Пролом!', 'info');
      }
    }
    const hits = B.units.filter(function (u) { return u.alive && !u.evac && U.dist(u.x, u.y, cx, cy) <= radius + 0.01; });
    for (let k = 0; k < hits.length; k++) {
      const u = hits[k];
      const d = U.rand(dmg[0], dmg[1]);
      await BT.damage(u, Math.max(1, d - Math.floor((u.armor || 0) / 2)), src, false);
    }
    BT.updateVision();
    if (!nested) await BT.processBlasts(src);
    const near = B.units.filter(function (u) { return u.side === 'e' && u.alive && !u.active && U.dist(u.x, u.y, cx, cy) <= 9; });
    if (near.length) await BT.activatePods(near);
    BT.checkEnd();
    await U.sleep(200);
  };

  /* ---------- Перемещение ---------- */
  BT.reach = function (u, maxCost) {
    const n = B.w * B.h;
    const cost = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const occ = new Int8Array(n);
    B.units.forEach(function (o) {
      if (o.alive && !o.evac && o !== u) occ[o.y * B.w + o.x] = o.side === u.side ? 1 : 2;
    });
    const s = u.y * B.w + u.x;
    cost[s] = 0;
    const heap = new U.Heap();
    heap.push(0, s);
    while (heap.size()) {
      const top = heap.pop();
      const c = top[0], i = top[1];
      if (c > cost[i]) continue;
      const x = i % B.w, y = (i / B.w) | 0;
      for (let k = 0; k < 8; k++) {
        const d = DIR8[k];
        const nx = x + d[0], ny = y + d[1];
        if (!BT.walkTile(nx, ny)) continue;
        const ni = ny * B.w + nx;
        if (occ[ni] === 2) continue;
        let step = 1;
        const dh = B.hgt ? B.hgt[ni] - B.hgt[i] : 0;
        // на другой уровень — только по лестнице; на марш лестницы — только спереди или сверху, по прямой
        const lad = dh !== 0 && BT.ladderEdge(i, ni);
        if (dh !== 0 && !lad) continue;
        if (!BT.stairOk(i, ni)) continue;
        if (d[0] && d[1]) {
          if (dh || stairSet[i] || stairSet[ni] || !BT.walkTile(x + d[0], y) || !BT.walkTile(x, y + d[1])) continue;
          step = 1.5;
        }
        if (dh) step += Math.abs(dh) > 1 ? 1 : 0.3;
        const nc = c + step;
        if (nc > maxCost + 0.01 || nc >= cost[ni]) continue;
        cost[ni] = nc; prev[ni] = i;
        heap.push(nc, ni);
      }
    }
    return { cost: cost, prev: prev, occ: occ, sx: u.x, sy: u.y };
  };
  BT.canEnd = function (R, x, y) {
    if (!BT.inb(x, y)) return false;
    const i = y * B.w + x;
    return R.cost[i] < Infinity && R.occ[i] === 0 && BT.walkTile(x, y);
  };
  BT.pathTo = function (R, x, y) {
    const path = [];
    let i = y * B.w + x;
    while (R.prev[i] >= 0) { path.unshift([i % B.w, (i / B.w) | 0]); i = R.prev[i]; }
    return path;
  };
  /* Поле расстояний до набора точек (без учёта юнитов) */
  BT.distField = function (points) {
    const n = B.w * B.h;
    const f = new Float32Array(n).fill(Infinity);
    const q = [];
    points.forEach(function (p) { const i = p[1] * B.w + p[0]; f[i] = 0; q.push(i); });
    let h = 0;
    while (h < q.length) {
      const i = q[h++];
      const x = i % B.w, y = (i / B.w) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + DIR8[k][0], ny = y + DIR8[k][1];
        if (!BT.inb(nx, ny)) continue;
        const ni = ny * B.w + nx;
        if (f[ni] !== Infinity) continue;
        if (!BT.walkTile(nx, ny)) continue;
        if (B.hgt && B.hgt[ni] !== B.hgt[i] && !BT.ladderEdge(i, ni)) continue;
        if (!BT.stairOk(i, ni)) continue;
        f[ni] = f[i] + 1;
        q.push(ni);
      }
    }
    return f;
  };

  BT.pickup = function (u) {
    if (B.goal && B.goal.kind === 'rescue' && !B.goal.done && U.dist(u.x, u.y, B.goal.x, B.goal.y) <= 1.5) BT.freeCaptive(u);
    for (let i = B.items.length - 1; i >= 0; i--) {
      const it = B.items[i];
      if (it.x === u.x && it.y === u.y && it.kind === 'cargo') {
        // контейнер Института: несколько видов припасов сразу
        B.items.splice(i, 1);
        const got = [['ammo', U.rand(30, 60)], ['meds', U.rand(1, 2)], ['grenades', 1], ['gems', U.rand(4, 8)]].filter(function () { return Math.random() < 0.8; });
        if (!got.length) got.push(['ammo', 40]);
        got.forEach(function (gk) { B.loot[gk[0]] = (B.loot[gk[0]] || 0) + gk[1]; });
        // иногда в контейнере — модуль на оружие
        if (Math.random() < 0.35 && D.MODS) {
          const st = DW.G.state, mk = U.pick(Object.keys(D.MODS));
          st.stock.mods = st.stock.mods || {}; st.stock.mods[mk] = (st.stock.mods[mk] || 0) + 1;
          DW.UI.toast('В грузе — модуль «' + D.MODS[mk].n + '»! Поставить можно в экране отряда.', 'good');
        }
        DW.TR.float(u.x, u.y, 'Груз Института!', 'gem');
        DW.UI.toast('Груз Института: ' + got.map(function (gk) { return '+' + gk[1] + ' ' + BT.LOOT_SHORT[gk[0]]; }).join(', '), 'good');
        DW.SFX.play('pickup');
        if (B.goal && B.goal.kind === 'cargo' && B.goal.x === it.x && B.goal.y === it.y) B.goal.done = true;
        BT.updateObjective();
        continue;
      }
      if (it.x === u.x && it.y === u.y) {
        B.loot[it.kind] = (B.loot[it.kind] || 0) + it.amt;
        B.items.splice(i, 1);
        DW.TR.float(u.x, u.y, '+' + it.amt + ' ' + BT.LOOT_SHORT[it.kind], it.kind === 'gems' ? 'gem' : 'info');
        DW.SFX.play('pickup');
        BT.updateObjective();
      }
    }
  };

  BT.move = async function (u, path, opts) {
    opts = opts || {};
    const newly = [];
    u._run = path.length > Math.max(3, (u.mob || 5) - 1);
    if (path.length) { u.moved = true; u.crouch = false; }
    if (u.kind === 'soldier' && Math.random() < 0.35) DW.TR.bark(u, u._run ? 'run' : 'move');
    DW.TR.pathBegin(u, path);
    for (let k = 0; k < path.length; k++) {
      const nx = path[k][0], ny = path[k][1];
      const show = u.side === 'p' || u.seen || (vis && vis[ny * B.w + nx]);
      u.face = Math.atan2(ny - u.y, nx - u.x);
      if (show) await DW.TR.stepFx(u, nx, ny); else DW.TR.pathSkip(u, nx, ny);
      u.x = nx; u.y = ny;
      if (u.side === 'p') {
        BT.pickup(u);
        BT.updateVision().forEach(function (e) { if (!e.active && newly.indexOf(e) < 0) newly.push(e); });
      } else {
        BT.updateVision();
      }
      if (!opts.noReact) await BT.reactions(u);
      if (!u.alive || B.over) break;
      if (BT.checkEnd()) break;
    }
    DW.TR.pathEnd(u);
    // скольжение в укрытие — только с разбега
    if (u.kind === 'soldier' && u.alive && u._run && path.length >= 3 && BT.DIR4.some(function (q) { const o = BT.objAt(u.x + q[0], u.y + q[1]); return o && D.OBJ[o].cover > 0; })) {
      DW.TR.anim(u, 'slide', 480); await U.sleep(200);
    }
    u._run = false;
    if (u.side === 'p' && B.concealed && !B.over) {
      const det = B.units.find(function (e) { return BT.detects(e); });
      if (det) { BT.reveal('Отряд обнаружен!'); await BT.activatePods([det]); await BT.wakeSeen(); }
      return newly;
    }
    if (u.side === 'p' && newly.length && !B.over) await BT.activatePods(newly);
    return newly;
  };
  BT.reactions = async function (mover) {
    const watchers = B.units.slice();
    for (let k = 0; k < watchers.length; k++) {
      const w = watchers[k];
      if (!mover.alive || B.over) return;
      if (!w.alive || w.evac || !w.overwatch || w.side === mover.side || w.clip <= 0) continue;
      if (!BT.canSee(w, mover)) continue;
      w.overwatch = false;
      DW.TR.float(w.x, w.y, 'Дозор!', 'info');
      await BT.fire(w, mover, { reaction: true });
    }
  };

  BT.activatePods = async function (list) {
    if (list && list.length && DW.Music) { if (!B.units.some(function (u) { return u.side === 'e' && u.alive && u.active; })) DW.Music.sting('contact'); DW.Music.intensity(1); }
    if (list && list.length) { const sp = BT.soldiers()[0]; const beast = list.some(function (e) { return D.ENEMIES[e.type] && D.ENEMIES[e.type].beast; }); if (sp) DW.TR.bark(sp, beast ? 'contactBeast' : 'contact'); }
    const pods = [];
    list.forEach(function (e) { if (!e.active && pods.indexOf(e.pod) < 0) pods.push(e.pod); });
    for (let p = 0; p < pods.length; p++) {
      const pid = pods[p];
      const mem = B.units.filter(function (u) { return u.side === 'e' && u.alive && u.pod === pid && !u.active; });
      if (!mem.length) continue;
      mem.forEach(function (m) { m.active = true; });
      const cnt = {};
      mem.forEach(function (m) { cnt[m.name] = (cnt[m.name] || 0) + 1; });
      const names = Object.keys(cnt).map(function (n) { return cnt[n] > 1 ? n + ' ×' + cnt[n] : n; }).join(', ');
      DW.UI.toast('Контакт! ' + names, 'alert');
      DW.SFX.play(D.ENEMIES[mem[0].type].beast ? 'growl' : 'alert');
      await DW.TR.focusOn(mem[0].x, mem[0].y, true);
      await U.sleep(250);
      for (let k = 0; k < mem.length; k++) {
        if (mem[k].alive && !B.over) await DW.AI.scamper(mem[k]);
      }
      BT.updateVision();
    }
  };

  /* ---------- Стрельба ---------- */
  BT.fire = async function (att, tgt, o) {
    o = o || {};
    const W = D.WEAPONS[att.weapon];
    const st = DW.G.state;
    if (att.kind === 'soldier') {
      if (st.res.ammo <= 0) { DW.TR.float(att.x, att.y, 'Нет патронов!', 'bad'); return null; }
      st.res.ammo = Math.max(0, st.res.ammo - W.ammo * (o.ammoMult || 1));
    }
    if (W.clip < 99) att.clip = Math.max(0, att.clip - 1);
    const info = BT.shotInfo(att, tgt, o);
    let amb = att.side === 'p' && B.concealed;
    const quiet = amb && att.mods && att.mods.indexOf('supp') >= 0;
    if (amb && !quiet) BT.reveal('Засада! Отряд открыл огонь.');
    const hit = Math.random() * 100 < info.hit;
    const crit = hit && Math.random() * 100 < info.crit;
    const dmg = hit && !o.suppress ? BT.rollDamage(W.dmg, crit, tgt.armor, W.pierce) : 0;
    const lethal = dmg >= tgt.hp && dmg > 0;
    att.face = Math.atan2(tgt.y - att.y, tgt.x - att.x);
    const show = att.side === 'p' || att.seen || tgt.side === 'p';
    const cine = show && DW.settings.cine !== false && !o.reaction && (att.side === 'p' || tgt.side === 'p');
    if (cine) await DW.TR.actionCam(att, tgt);
    else if (show) await DW.TR.focusOn((att.x + tgt.x) / 2, (att.y + tgt.y) / 2, false);
    if (cine && lethal) DW.TR.slowmo(true);
    await DW.TR.shotFx(att, tgt, hit, W, show, !!o.suppress, { coverTile: !hit ? info.coverTile : null });
    let killed = false;
    if (o.suppress) {
      tgt.suppressed = true;
      DW.TR.float(tgt.x, tgt.y, 'Подавлен', 'info');
      await U.sleep(250);
    } else if (hit) {
      DW.TR.decal(tgt.x, tgt.y, DW.TR.bloodKind(tgt), 0.6);
      killed = await BT.damage(tgt, dmg, att, crit);
      if (killed) DW.TR.decal(tgt.x, tgt.y, DW.TR.bloodKind(tgt), 1.3);
    } else {
      DW.TR.float(tgt.x, tgt.y, 'Промах', 'miss');
      if (info.coverTile && Math.random() < 0.35) BT.damageObj(info.coverTile[0], info.coverTile[1], 1);
      else if (!info.coverTile) DW.TR.decal(tgt.x, tgt.y, 'hole', 0.5);
      await U.sleep(240);
    }
    if (cine && lethal) { await U.sleep(380); DW.TR.slowmo(false); }
    if (cine) DW.TR.actionCamEnd();
    await BT.processBlasts(att);
    if (quiet) {
      // глушитель: если цель убита и стрелка никто не видел — отряд остаётся скрытым
      const witness = tgt.alive || B.units.some(function (e) { return e.alive && e.side === 'e' && BT.canSee(e, att); });
      if (witness) BT.reveal('Отряд обнаружен!'); else { DW.TR.float(att.x, att.y, 'Тихо…', 'info'); amb = false; }
    }
    if (tgt.alive && tgt.side === 'e' && !tgt.active && !B.concealed) await BT.activatePods([tgt]);
    if (amb && !B.over) await BT.wakeSeen();
    return { hit: hit, crit: crit, killed: killed };
  };
  BT.melee = async function (att, tgt) {
    const T = D.ENEMIES[att.type];
    const info = BT.meleeInfo(att, tgt);
    att.face = Math.atan2(tgt.y - att.y, tgt.x - att.x);
    if (att.seen || tgt.side === 'p') await DW.TR.focusOn(tgt.x, tgt.y, false);
    DW.SFX.play('melee');
    await DW.TR.lungeFx(att, tgt);
    const hit = Math.random() * 100 < info.hit;
    if (hit) {
      const crit = Math.random() * 100 < info.crit;
      await BT.damage(tgt, BT.rollDamage(T.dmg, crit, tgt.armor, false), att, crit);
    } else {
      DW.TR.float(tgt.x, tgt.y, 'Промах', 'miss');
      await U.sleep(220);
    }
  };

  /* ---------- Действия игрока ---------- */
  BT.doReload = function (u) {
    u.clip = D.WEAPONS[u.weapon].clip; u.ap -= 1;
    DW.TR.anim(u, 'reload', { ppsh: 1100, lmg: 1200, hlmg: 1300, shotgun: 1000, sniper: 900, hsniper: 1000 }[u.weapon] || 850);
    if (DW.SFX.reload && DW.WT) DW.SFX.reload(DW.WT.RK[u.weapon]); else DW.SFX.play('reload'); DW.TR.float(u.x, u.y, 'Перезарядка', 'info');
    DW.TR.bark(u, 'reload');
  };
  BT.doOverwatch = function (u) { u.overwatch = true; u.ap = 0; DW.TR.float(u.x, u.y, 'Дозор', 'info'); DW.SFX.play('reload'); DW.TR.bark(u, 'overwatch'); };
  /* присесть / встать: без затрат ОД; присевшего хуже видно (замечают на 2 клетки ближе) и в него труднее попасть (−10);
     если присевшего отправить в путь — встаёт и идёт обычным шагом (крадучись не ходят) */
  BT.doCrouch = function (u) {
    if (!u || !u.alive || u.kind !== 'soldier') return;
    u.crouch = !u.crouch;
    DW.TR.float(u.x, u.y, u.crouch ? 'Присел' : 'Встал', 'info');
    DW.SFX.play('click');
  };
  BT.doHunker = function (u) { u.hunker = true; u.ap = 0; DW.TR.float(u.x, u.y, 'Залёг', 'info'); DW.TR.bark(u, 'hunker'); };
  BT.doEvac = function (u) {
    u.evac = true; u.ap = 0; u.overwatch = false;
    DW.TR.float(u.x, u.y, 'Эвакуирован', 'good');
    DW.SFX.play('portal');
    BT.updateVision();
    BT.checkEnd();
  };
  BT.heal = function (t, amt) {
    const v = Math.min(amt, t.maxHp - t.hp);
    t.hp += v;
    DW.TR.float(t.x, t.y, '+' + v + ' ОЗ', 'good');
    DW.SFX.play('pickup');
  };
  const medBonus = function (u) { return u.perks && u.perks.indexOf('medic') >= 0 ? 2 : 0; };
  BT.doMedkit = function (u, t) { DW.G.state.res.meds -= 1; BT.heal(t, 4 + medBonus(u)); u.ap -= 1; DW.TR.anim(u, 'heal', 700); DW.TR.bark(u, 'heal'); };
  BT.doFieldHeal = function (u, t) { u.charges.heal -= 1; BT.heal(t, 5 + medBonus(u)); u.ap -= 1; DW.TR.anim(u, 'heal', 700); DW.TR.bark(u, 'heal'); };
  BT.doOrder = function (u, t) {
    t.ap = Math.min(3, t.ap + 1); u.ap -= 1; u.cd.order = D.ABIL.order.cd - (u.perks && u.perks.indexOf('leader2') >= 0 ? 1 : 0);
    u.face = Math.atan2(t.y - u.y, t.x - u.x);
    DW.TR.anim(u, 'signal', 700);
    DW.TR.float(t.x, t.y, '+1 ОД', 'good'); DW.SFX.play('alert');
  };
  BT.doRush = function (u) { u.ap += 1; u.cd.rush = D.ABIL.rush.cd; DW.TR.float(u.x, u.y, 'Рывок! +1 ОД', 'good'); };
  BT.doSuppress = async function (u, t) {
    u.cd.suppress = D.ABIL.suppress.cd;
    u.ap = 0;
    await BT.fire(u, t, { suppress: true, ammoMult: 2 });
  };
  BT.doThrow = async function (u, x, y, kind) {
    const st = DW.G.state;
    if (B.concealed) BT.reveal('Засада! Отряд открыл огонь.');
    u.ap = 0;
    u.face = Math.atan2(y - u.y, x - u.x);
    DW.TR.bark(u, kind === 'rocket' ? 'rocket' : 'grenade');
    if (kind !== 'rocket') { DW.TR.anim(u, 'throw', 560); await U.sleep(330); }
    else { DW.TR.anim(u, 'shoot', 650, { cnt: 1, rpg: true }); }
    if (kind === 'rocket') {
      st.res.rockets -= 1;
      await DW.TR.projectileFx(u.x, u.y, x, y, 'rocket', u);
      await BT.explode(x, y, 2.2, [5, 8], 8, u);
    } else {
      st.res.grenades -= 1;
      await DW.TR.projectileFx(u.x, u.y, x, y, 'grenade');
      const gr = u.perks && u.perks.indexOf('grenadier') >= 0;
      await BT.explode(x, y, gr ? 2 : 1.5, gr ? [4, 6] : [3, 5], 4, u);
    }
    if (!B.over) await BT.wakeSeen();
  };
  BT.doShoot = async function (u, t, mode) {
    const W = D.WEAPONS[u.weapon];
    u.ap = 0;
    if (mode === 'aimed') {
      u.cd.aimed = D.ABIL.aimed.cd;
      await BT.fire(u, t, { aimBonus: 20, critBonus: 25, aimLabel: 'Прицел' });
    } else if (mode === 'double') {
      u.cd.double = D.ABIL.double.cd;
      await BT.fire(u, t, { aimBonus: -15, aimLabel: 'Двойной' });
      if (t.alive && u.alive && u.clip > 0 && DW.G.state.res.ammo > 0 && !B.over) {
        await U.sleep(150);
        await BT.fire(u, t, { aimBonus: -15, aimLabel: 'Двойной' });
      }
    } else {
      await BT.fire(u, t);
    }
    void W;
  };

  /* ---------- Ходы ---------- */
  BT.startPlayerTurn = function () {
    B.phase = 'player';
    if (!B.concealed) BT.cargoDrop();
    // паника: один ход боец прячется (1 ОД, залёг)
    B.units.forEach(function (u) {
      if (u.kind === 'soldier' && u.alive && u.panic) { u.panic = false; u.panicNow = true; }
    });
    B.units.forEach(function (u) {
      if (u.kind !== 'soldier' || u.alive || !u.down || u.stable) return;
      u.down--;
      if (u.down <= 0) { u.down = 0; DW.UI.toast(u.name + ' умер от потери крови.', 'bad'); DW.TR.float(u.x, u.y, 'Умер', 'bad'); }
      else DW.TR.float(u.x, u.y, 'Истекает кровью: ' + (u.down - 1 > 0 ? u.down - 1 + ' х.' : 'последний ход!'), 'bad');
    });
    B.units.forEach(function (u) {
      if (u.side !== 'p' || !u.alive || u.evac) return;
      u.ap = u.kind === 'turret' ? 0 : 2;
      u.overwatch = false; u.hunker = false;
      u.panicked = false; u.moved = false;
      if (u.panicNow) { u.panicNow = false; u.ap = 1; u.hunker = true; u.panicked = true; DW.TR.float(u.x, u.y, 'Паника: 1 ОД', 'bad'); }
      for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--;
    });
    BT.updateObjective();
    BT.updateVision();
    if (DW.Music) DW.Music.intensity(B.units.some(function (u) { return u.side === 'e' && u.alive && u.active; }) ? 1 : 0.2);
  };
  BT.endPlayerTurn = async function () {
    B.phase = 'enemy';
    B.units.forEach(function (u) { if (u.side === 'p') u.ap = 0; });
    const turrets = B.units.filter(function (t) { return t.kind === 'turret' && t.alive; });
    for (let k = 0; k < turrets.length; k++) {
      if (B.over) break;
      const t = turrets[k];
      const tg = BT.enemies().filter(function (e) { return e.seen && BT.canSee(t, e); });
      if (!tg.length) continue;
      tg.sort(function (a, b) { return BT.shotInfo(t, b).hit - BT.shotInfo(t, a).hit; });
      await BT.fire(t, tg[0]);
    }
    if (!BT.checkEnd()) await BT.reinforcements();
    if (!BT.checkEnd()) await DW.AI.enemyTurn();
    if (B.over) return;
    B.turn++;
    BT.startPlayerTurn();
  };
  /* Подкрепления врага: на высокой сложности после 4-го хода — сигнальная ракета, через ход подходит подмога */
  BT.reinforcements = async function () {
    if (B.kind !== 'normal' || B.concealed) return;
    if (B.reinf && B.turn >= B.reinf.turn) {
      const r = B.reinf; B.reinf = null; B.reinfDone = true;
      const types = r.fam === 'raider' ? ['raider', 'raider', 'thug'] : ['scav', 'scav', 'spitter'];
      const pod = 900 + B.turn;
      let k = 0;
      for (let rr = 0; rr < 3 && k < types.length; rr++) for (let dy = -rr; dy <= rr && k < types.length; dy++) for (let dx = -rr; dx <= rr && k < types.length; dx++) {
        const x = r.x + dx, y = r.y + dy;
        if (!BT.inb(x, y) || B.obj[BT.idx(x, y)] || !D.GROUND[B.ground[BT.idx(x, y)]].walk || BT.unitAt(x, y)) continue;
        const e = mkEnemy(types[k++], x, y, pod); e.active = true; e.fresh = true; B.units.push(e);
      }
      BT.updateVision();
      if (k) { await DW.TR.focusOn(r.x, r.y, true); await U.sleep(350); }
      DW.UI.toast('Подкрепление врага: ' + k + '!', 'alert'); DW.SFX.play('alert');
      return;
    }
    if (B.diff >= 3 && !B.reinf && !B.reinfDone && B.turn >= 4 && Math.random() < 0.45) {
      const ps = BT.soldiers();
      let best = null;
      for (let t = 0; t < 40; t++) {
        const x = U.rand(B.w - 6, B.w - 1), y = U.rand(1, B.h - 2);
        if (!BT.inb(x, y) || B.obj[BT.idx(x, y)] || !D.GROUND[B.ground[BT.idx(x, y)]].walk) continue;
        const d = ps.reduce(function (m, p) { return Math.min(m, U.dist(p.x, p.y, x, y)); }, 99);
        if (d >= 7 && (!best || d > best.d)) best = { x: x, y: y, d: d };
      }
      if (best) {
        const fam = B.map === 'camp' || B.units.some(function (e) { return e.side === 'e' && (e.type === 'raider' || e.type === 'thug'); }) ? 'raider' : 'beast';
        B.reinf = { x: best.x, y: best.y, turn: B.turn + 1, fam: fam };
        DW.UI.toast('Враг пустил сигнальную ракету — через ход подойдёт подкрепление!', 'alert');
      }
    }
  };
  BT.spawnWaves = function (silent) {
    let cnt = 0;
    B.waves.forEach(function (w) {
      if (w.spawned || B.turn < w.turn) return;
      w.spawned = true;
      B.waveNo++;
      const pool = wavePool(w.fam);
      const freeT = B.spawn.filter(function (s) { return BT.walkTile(s[0], s[1]) && !BT.unitAt(s[0], s[1]); });
      U.shuffle(freeT);
      for (let i = 0; i < w.n && i < freeT.length; i++) {
        const e = mkEnemy(U.pick(pool), freeT[i][0], freeT[i][1], 100 + B.waveNo);
        e.active = true; e.ap = 2;
        B.units.push(e);
        cnt++;
      }
    });
    if (cnt) {
      BT.updateObjective();
      if (!silent) { DW.UI.toast('Волна ' + B.waveNo + ' из 3: к базе идут ещё ' + cnt + '!', 'alert'); DW.SFX.play('alert'); }
    }
    return cnt;
  };
  BT.checkEnd = function () {
    if (!B) return null;
    if (B.over) return B.over;
    const sol = B.units.filter(function (u) { return u.kind === 'soldier'; });
    const on = sol.filter(function (u) { return u.alive && !u.evac; });
    const ev = sol.filter(function (u) { return u.alive && u.evac; });
    if (!on.length) { B.over = ev.length ? 'evac' : 'defeat'; return B.over; }
    const pending = B.waves.some(function (w) { return !w.spawned; });
    if (B.type === 'nest' && B.kind !== 'ambush' && B.queenDead && B.kind !== 'defense') { B.over = 'victory'; return B.over; }
    if (!BT.enemies().length && !pending) { B.over = 'victory'; return B.over; }
    return null;
  };
  BT.retreatAll = function () {
    BT.soldiers().forEach(function (u) {
      if (!BT.isEvacTile(u.x, u.y) || B.kind === 'defense') {
        const d = U.rand(1, 4);
        u.hp = Math.max(1, u.hp - d);
      }
      u.evac = true;
    });
    B.over = 'evac';
  };

  DW.BT = BT;
})(window.DW);
