/* Бойцы: создание, звания, опыт, ранения, гибель, подбор отряда. */
(function (G) {
  'use strict';
  const U = G.U;

  const Units = {};

  function uniqueNum(s, rng, prefix) {
    for (let i = 0; i < 1000; i++) {
      const num = prefix + '-' + rng.int(100, 9999);
      if (!s.usedNums[num]) { s.usedNums[num] = 1; return num; }
    }
    const num = prefix + '-' + (10000 + s.nextUnitId);
    s.usedNums[num] = 1;
    return num;
  }

  // ---------- черты характера и прозвища ----------
  function mix(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  }
  // Черта выбирается по зерну кампании и номеру бойца — без расхода случайных чисел игры
  Units.assignTrait = function (s, u, forced) {
    if (u.kind === 'droid') { u.trait = null; return; }
    const T = G.CONFIG.traits;
    if (forced !== undefined) { u.trait = forced; return; }
    if (mix(s.seed, u.id * 7 + 1) >= T.chance) { u.trait = null; return; }
    const ids = Object.keys(T.list);
    const total = ids.reduce((a, id) => a + T.list[id].weight, 0);
    let r = mix(s.seed, u.id * 13 + 5) * total;
    for (const id of ids) { r -= T.list[id].weight; if (r < 0) { u.trait = id; return; } }
    u.trait = ids[ids.length - 1];
  };
  Units.trait = (u) => (u && u.trait ? G.CONFIG.traits.list[u.trait] || null : null);
  Units.traitVal = (u, key, def) => { const t = Units.trait(u); return t && t[key] != null ? t[key] : def; };

  // Прозвище за боевые заслуги; возвращает его, если появилось только что
  Units.checkNickname = function (s, u) {
    if (u.nick || u.kind === 'droid' || u.kills < G.CONFIG.traits.nicknameKills) return null;
    const N = G.TEXT.nicknames;
    const own = (u.trait && N[u.trait]) || [];
    const pool = own.concat(N.any);
    const taken = new Set(s.units.filter((x) => x.nick).map((x) => x.nick));
    const free = pool.filter((n) => !taken.has(n));
    const list = free.length ? free : pool;
    const pickOwn = own.length && mix(s.seed, u.id * 3) < 0.6 ? own.filter((n) => !taken.has(n)) : [];
    const from = pickOwn.length ? pickOwn : list;
    u.nick = from[Math.floor(mix(s.seed, u.id + u.kills * 31) * from.length)];
    G.Game.say(s, u.num + ' ' + u.name + ' получает прозвище «' + u.nick + '».', 'good');
    return u.nick;
  };

  Units.createTrooper = function (s, rng, opts) {
    opts = opts || {};
    const N = G.TEXT.names;
    const u = {
      id: s.nextUnitId++,
      kind: 'trooper',
      num: uniqueNum(s, rng, 'ТК'),
      name: rng.pick(N.first) + ' ' + rng.pick(N.last),
      xp: opts.xp || 0,
      health: opts.health || 100,
      spec: opts.spec || null,
      status: 'ok',          // ok | dead | deserted | training
      kills: 0,
      battles: 0,
      missions: 0,
      joined: s.day,
      origin: opts.origin || 'crash',
    };
    Units.assignTrait(s, u, opts.trait);
    s.units.push(u);
    return u;
  };

  Units.createDroid = function (s, rng, opts) {
    opts = opts || {};
    const name = opts.name || rng.pick(G.TEXT.names.droids);
    const u = {
      id: s.nextUnitId++,
      kind: 'droid',
      num: uniqueNum(s, rng, 'КД'),
      name: '«' + name + '»',
      trait: null,
      xp: 0,
      health: opts.health || 100,   // у дроидов — техническое состояние
      spec: null,
      status: 'ok',
      kills: 0, battles: 0, missions: 0,
      joined: s.day,
      origin: opts.origin || 'crash',
    };
    s.units.push(u);
    return u;
  };

  Units.createMerc = function (s, rng, opts) {
    opts = opts || {};
    const N = G.TEXT.names;
    const u = {
      id: s.nextUnitId++,
      kind: 'merc',
      num: rng.pick(N.mercRace),
      name: rng.pick(N.mercFirst),
      xp: opts.xp || 60,
      health: 100,
      spec: null,
      status: 'ok',
      kills: 0, battles: 0, missions: 0,
      joined: s.day,
      origin: 'merc',
    };
    Units.assignTrait(s, u, opts.trait);
    s.units.push(u);
    return u;
  };

  // ---------- звания ----------
  Units.rankIndex = function (u) {
    if (u.kind === 'droid') return 0;
    const R = G.CONFIG.ranks;
    let idx = 0;
    for (let i = 0; i < R.length; i++) if (u.xp >= R[i].xp) idx = i;
    return idx;
  };
  Units.rank = (u) => G.CONFIG.ranks[Units.rankIndex(u)];
  Units.rankName = (u) => (u.kind === 'trooper' ? G.TEXT.ranks[Units.rank(u).id].name : u.kind === 'droid' ? 'Дроид' : 'Наёмник');
  Units.rankShort = (u) => (u.kind === 'trooper' ? G.TEXT.ranks[Units.rank(u).id].short : u.kind === 'droid' ? 'Др.' : 'Нм.');

  // «сержант ТК-412» (со строчной — для середины фразы; в начале фразы — U.cap)
  Units.title = function (u) {
    if (u.kind === 'trooper') return Units.rankName(u).toLowerCase() + ' ' + u.num + (u.nick ? ' «' + u.nick + '»' : '');
    if (u.kind === 'droid') return 'дроид ' + u.num + ' ' + u.name;
    return 'наёмник ' + u.name + ' (' + u.num + ')';
  };
  // «сержант ТК-412 Кейл Маррен»
  Units.fullTitle = function (u) {
    if (u.kind === 'trooper') return Units.rankName(u).toLowerCase() + ' ' + u.num + ' ' + u.name + (u.nick ? ' «' + u.nick + '»' : '');
    return Units.title(u);
  };

  // Начисление опыта с проверкой повышения
  Units.addXp = function (s, u, xp) {
    if (u.kind === 'droid' || u.status === 'dead') return;
    const before = Units.rankIndex(u);
    u.xp += Math.round(xp);
    const after = Units.rankIndex(u);
    if (after > before && u.kind === 'trooper') {
      G.Game.say(s, U.fill('{who} получает звание «{rank}».', { who: u.num + ' ' + u.name, rank: G.TEXT.ranks[G.CONFIG.ranks[after].id].name }), 'good');
    }
  };

  // ---------- здоровье ----------
  Units.isAlive = (u) => u.status !== 'dead' && u.status !== 'deserted';
  Units.woundLevel = function (u) {
    const H = G.CONFIG.health;
    if (u.health < H.heavyBelow) return 2;
    if (u.health < H.lightBelow) return 1;
    return 0;
  };
  Units.healthLabel = function (u) {
    if (u.status === 'dead') return 'погиб';
    if (u.status === 'deserted') return 'дезертировал';
    if (u.status === 'away') return 'в отлучке';
    if (u.status === 'training') return 'на подготовке';
    if (u.status === 'missing') return 'пропал без вести';
    if (u.kind === 'droid') {
      if (u.health <= 0) return 'отключён';
      return u.health < 40 ? 'сильно повреждён' : u.health < 80 ? 'повреждён' : 'исправен';
    }
    const w = Units.woundLevel(u);
    return w === 2 ? 'тяжело ранен' : w === 1 ? 'легко ранен' : 'в строю';
  };
  // Годен к выходу в поле
  Units.isFit = function (s, u) {
    if (!Units.isAlive(u) || u.status !== 'ok') return false;
    if (u.kind === 'droid') return u.health >= 25 && !s.droidsOffline;
    return u.health >= G.CONFIG.health.heavyBelow;
  };

  Units.kill = function (s, u, cause) {
    if (!Units.isAlive(u)) return;
    u.status = 'dead';
    u.health = 0;
    u.diedDay = s.day;
    u.cause = cause || '';
    if (u.kind !== 'droid') {
      s.stats.deaths++;
      G.Res.discipline(s, G.CONFIG.discipline.trooperDeath);
    } else {
      s.stats.droidsLost = (s.stats.droidsLost || 0) + 1;
    }
  };

  // Нанести урон здоровью (в процентах). Возвращает true, если боец погиб.
  Units.damage = function (s, u, amount, cause) {
    if (!Units.isAlive(u)) return false;
    u.health = Math.round(u.health - amount);
    if (u.health <= 0) {
      if (u.kind === 'droid') { u.health = 0; Units.kill(s, u, cause); return true; }
      Units.kill(s, u, cause);
      return true;
    }
    return false;
  };

  // ---------- списки ----------
  Units.alive = (s) => s.units.filter(Units.isAlive);
  Units.troopers = (s) => s.units.filter((u) => u.kind === 'trooper' && Units.isAlive(u));
  Units.droids = (s) => s.units.filter((u) => u.kind === 'droid' && Units.isAlive(u));
  Units.people = (s) => s.units.filter((u) => u.kind !== 'droid' && Units.isAlive(u));
  Units.byId = (s, id) => s.units.find((u) => u.id === id);

  // Эффективность бойца в работах и вылазках (0..~1.2)
  Units.efficiency = function (s, u) {
    const H = G.CONFIG.health;
    let e;
    if (u.kind === 'droid') e = u.health >= 80 ? 1 : u.health >= 40 ? 0.75 : 0.5;
    else e = u.health >= H.lightBelow ? 1 : u.health >= H.heavyBelow ? H.lightEff : 0;
    if (u.kind !== 'droid') e *= 1 + Units.rank(u).eff + Units.traitVal(u, 'work', 0);
    return e;
  };

  // Боевая ценность для упрощённого расчёта стычек
  Units.combatValue = function (s, u) {
    if (u.kind === 'droid') return 2.2 * (u.health / 100);
    let v = 1 + Units.rankIndex(u) * 0.15;
    if (u.kind === 'merc') v = 1.3;
    v *= u.health >= G.CONFIG.health.lightBelow ? 1 : 0.7;
    return v;
  };

  // Подбор отряда: count штурмовиков и droids дроидов из свободных.
  // prefer: 'fighters' — лучшие бойцы, 'workers' — сначала рядовые, 'scouts' — опытные
  Units.pickSquad = function (s, freeUnits, count, droids, prefer) {
    const people = freeUnits.filter((u) => u.kind !== 'droid' && Units.isFit(s, u));
    const dr = freeUnits.filter((u) => u.kind === 'droid' && Units.isFit(s, u));
    const healthy = (u) => (u.health >= G.CONFIG.health.lightBelow ? 1 : 0);
    people.sort((a, b) => {
      if (healthy(b) !== healthy(a)) return healthy(b) - healthy(a);
      if (prefer === 'workers') return a.xp - b.xp;
      return b.xp - a.xp;
    });
    dr.sort((a, b) => b.health - a.health);
    return people.slice(0, count).map((u) => u.id).concat(dr.slice(0, droids).map((u) => u.id));
  };

  G.Units = Units;
})(globalThis.G = globalThis.G || {});
