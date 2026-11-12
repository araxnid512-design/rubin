'use strict';
/* Состояние кампании: отряд, ресурсы, дни, портал, база, события */
(function (DW) {
  const U = DW.U, D = DW.D;
  const G = {};
  const SAVE_KEY = 'deadworld_save_v1';
  G.state = null;

  /* ---------- Бойцы ---------- */
  G.newSoldier = function (tpl) {
    return {
      id: U.uid(), name: tpl.name, cls: tpl.cls,
      hpBase: tpl.hp, aimBase: tpl.aim, mobBase: tpl.mob,
      wounds: 0, xp: tpl.xp || 0, kills: 0, missions: 0,
      weapon: tpl.weapon || 'ppsh', armor: tpl.armor || 'robe', trait: tpl.trait || U.pick(D.TRAIT_POOL), perks: [],
      look: DW.ART.makeLook(U.rand(1, 1e9), tpl.look || null)
    };
  };
  G.rank = function (s) {
    let r = 0;
    for (let i = 0; i < D.RANKS.length; i++) if (s.xp >= D.RANKS[i].xp) r = i;
    return r;
  };
  G.has = function (s, p) { return !!(s.perks && s.perks.indexOf(p) >= 0); };
  G.maxHp = function (s) { return s.hpBase + D.ARMORS[s.armor].hp + G.rank(s) + (s.trait === 'tough' ? 2 : 0) + (G.has(s, 'hp') ? 2 : 0); };
  G.hp = function (s) { return Math.max(0, G.maxHp(s) - s.wounds); };
  G.aim = function (s) { return s.aimBase + G.rank(s) * 4 + (s.trait === 'sharp' ? 5 : 0) + (G.has(s, 'aim') ? 5 : 0); };
  G.mob = function (s) { return s.mobBase + D.ARMORS[s.armor].mob + (s.trait === 'quick' ? 1 : 0) + (G.has(s, 'mob') ? 1 : 0); };
  G.smoker = function (s) { return !!s && (s.trait === 'calm' || s.name === 'Мальборо'); };
  /* Два навыка на выбор при повышении */
  G.perkOffer = function (s) {
    const all = Object.keys(D.PERKS).filter(function (k) { return !G.has(s, k); });
    const r = U.srng(ART_HASH(s.id) + (s.perks ? s.perks.length : 0) * 101);
    const a = all.splice(Math.floor(r() * all.length), 1)[0];
    const b = all.length ? all[Math.floor(r() * all.length)] : null;
    return [a, b].filter(Boolean);
  };
  function ART_HASH(x) { return DW.ART.hashStr(String(x)); }

  G.makeRecruit = function (level) {
    const st = G.state;
    const used = {};
    st.roster.forEach(function (s) { used[s.name] = 1; });
    st.memorial.forEach(function (s) { used[s.name] = 1; });
    let pool = D.NAMES.filter(function (n) { return !used[n]; });
    if (!pool.length) pool = D.NAMES;
    const name = U.pick(pool);
    const cls = U.pick(['assault', 'rifleman', 'sniper', 'medic', 'heavy', 'assault', 'rifleman']);
    const s = G.newSoldier({
      name: name, cls: cls, hp: U.rand(8, 10), aim: U.rand(58, 68) + (level ? 3 : 0),
      mob: cls === 'heavy' ? 5 : 6, xp: level ? D.RANKS[Math.min(level, D.RANKS.length - 1)].xp : 0
    });
    return s;
  };

  /* ---------- Новая игра / сохранение ---------- */
  G.newGame = function () {
    const st = {
      version: 1, day: 1,
      res: { gems: 0, food: 40, ammo: 300, meds: 3, grenades: 3, rockets: 0, materials: 5 },
      delivered: 0, roster: [], stock: { weapons: { ak: 1 }, armors: {} },
      world: null, squadAt: 0, prevNode: null, baseNode: null, baseDay: 0,
      buildings: {}, orders: [], raid: null, hungry: false,
      log: [], memorial: [], stats: { kills: 0, missions: 0, won: 0, lairs: 0, camps: 0 },
      battle: null, flags: {}, over: null
    };
    G.state = st;
    D.START_SQUAD.forEach(function (t) { st.roster.push(G.newSoldier(t)); });
    st.world = DW.World.generate();
    st.squadAt = st.world.landing;
    const ln = G.node(st.squadAt);
    ln.known = true; ln.visited = true;
    G.revealAround(st.squadAt);
    G.log('Отряд из шести заключённых прошёл через Портал. Институт выдал старые ППШ и припасы на несколько дней.');
    return st;
  };
  G.save = function () {
    if (!G.state) return false;
    try { return DW.store.set(SAVE_KEY, JSON.stringify(G.state)); } catch (e) { return false; }
  };
  G.hasSave = function () {
    const s = DW.store.get(SAVE_KEY);
    if (!s) return false;
    try { const o = JSON.parse(s); return !!(o && o.roster && !o.over); } catch (e) { return false; }
  };
  G.load = function () {
    const s = DW.store.get(SAVE_KEY);
    if (!s) return false;
    try {
      const o = JSON.parse(s);
      if (!o || !o.world) return false;
      G.state = o;
      const TR0 = { 'Курт': 'authority', 'Крут': 'authority', 'Мальборо': 'calm', 'Сыч': 'sharp', 'Док': 'lucky', 'Бугай': 'tough', 'Тихий': 'quick' };
      o.roster.forEach(function (s) { DW.ART.ensureLook(s); if (s.name === 'Курт') s.name = 'Крут'; if (!s.trait) s.trait = TR0[s.name] || D.TRAIT_POOL[DW.ART.hashStr(s.id) % D.TRAIT_POOL.length]; if (!s.perks) s.perks = []; });
      (o.memorial || []).forEach(function (m) { if (m.name === 'Курт') m.name = 'Крут'; });
      if (o.battle && o.battle.units) o.battle.units.forEach(function (u) { if (u.name === 'Курт') u.name = 'Крут'; });
      if (o.baseNode !== null && o.baseNode !== undefined) { const bn = o.world.nodes[o.baseNode]; if (bn && !bn.fort) { bn.oldName = bn.name; bn.name = 'Форт Крут'; bn.fort = true; } }
      return true;
    } catch (e) { return false; }
  };
  G.deleteSave = function () { DW.store.del(SAVE_KEY); };

  G.log = function (text) {
    const st = G.state;
    st.log.unshift({ day: st.day, text: text });
    if (st.log.length > 120) st.log.length = 120;
  };

  /* ---------- Карта мира ---------- */
  G.node = function (id) { return G.state.world.nodes[id]; };
  G.neighbors = function (id) {
    const res = [];
    G.state.world.edges.forEach(function (e) {
      if (e[0] === id) res.push(e[1]);
      else if (e[1] === id) res.push(e[0]);
    });
    return res;
  };
  G.revealAround = function (id, radius) {
    const r = radius || 1;
    let front = [id];
    const seen = {}; seen[id] = 1;
    G.node(id).known = true;
    for (let i = 0; i < r; i++) {
      const next = [];
      front.forEach(function (n) {
        G.neighbors(n).forEach(function (m) {
          if (seen[m]) return;
          seen[m] = 1; next.push(m);
          G.node(m).known = true;
        });
      });
      front = next;
    }
  };
  /* Путь по известным локациям; промежуточные узлы должны быть зачищены */
  G.findPath = function (from, to) {
    if (from === to) return [];
    const prev = {}; prev[from] = -1;
    const q = [from];
    while (q.length) {
      const c = q.shift();
      if (c === to) break;
      if (c !== from && !G.node(c).cleared) continue;
      G.neighbors(c).forEach(function (n) {
        if (prev[n] !== undefined) return;
        if (!G.node(n).known) return;
        prev[n] = c; q.push(n);
      });
    }
    if (prev[to] === undefined) return null;
    const path = [];
    let c = to;
    while (c !== from) { path.unshift(c); c = prev[c]; }
    return path;
  };

  /* ---------- Ресурсы ---------- */
  G.canAfford = function (cost) {
    const r = G.state.res;
    for (const k in cost) if ((r[k] || 0) < cost[k]) return false;
    return true;
  };
  G.pay = function (cost) {
    if (!G.canAfford(cost)) return false;
    for (const k in cost) G.state.res[k] -= cost[k];
    return true;
  };
  G.costText = function (cost) {
    const parts = [];
    for (const k in cost) parts.push(cost[k] + ' ' + D.icon(k));
    return parts.join(' ');
  };
  G.blv = function (id) { return G.state.buildings[id] || 0; };
  G.tier = function () {
    let t = 0;
    for (let i = 0; i < D.TIERS.length; i++) if (G.state.delivered >= D.TIERS[i].need) t = i;
    return t;
  };

  G.catalogItem = function (id) {
    for (let i = 0; i < D.CATALOG.length; i++) if (D.CATALOG[i].id === id) return D.CATALOG[i];
    return null;
  };
  /* Выдать содержимое груза. Возвращает текстовое описание */
  G.giveAll = function (ids) {
    const st = G.state;
    const sum = {};
    const extra = [];
    ids.forEach(function (id) {
      const c = G.catalogItem(id);
      if (!c) return;
      const g = c.give;
      for (const k in g) {
        if (k === 'weapon') { st.stock.weapons[g.weapon] = (st.stock.weapons[g.weapon] || 0) + 1; extra.push(D.WEAPONS[g.weapon].n); }
        else if (k === 'armor') { st.stock.armors[g.armor] = (st.stock.armors[g.armor] || 0) + 1; extra.push(D.ARMORS[g.armor].n); }
        else if (k === 'recruit') {
          const s = G.makeRecruit(g.recruit);
          st.roster.push(s);
          extra.push('боец «' + s.name + '» (' + D.CLASSES[s.cls].n.toLowerCase() + ')');
        } else { st.res[k] = (st.res[k] || 0) + g[k]; sum[k] = (sum[k] || 0) + g[k]; }
      }
    });
    const parts = [];
    for (const k in sum) parts.push('+' + sum[k] + ' ' + D.icon(k));
    return parts.concat(extra).join(', ');
  };

  G.placeOrder = function (cart, drop) {
    const st = G.state;
    let total = 0;
    const items = [];
    for (const id in cart) {
      const c = G.catalogItem(id);
      if (!c || !cart[id]) continue;
      total += c.price * cart[id];
      for (let i = 0; i < cart[id]; i++) items.push(id);
    }
    if (!items.length || st.res.gems < total) return null;
    const t0 = G.tier();
    st.res.gems -= total;
    st.delivered += total;
    st.orders.push({ day: st.day + 1, drop: drop, items: items });
    G.log('Через Портал отправлено ' + total + ' драгоценностей. Груз придёт завтра в «' + G.node(drop).name + '».');
    return { total: total, tierUp: G.tier() > t0 };
  };
  G.donate = function (n) {
    const st = G.state;
    n = Math.min(n, st.res.gems);
    if (n <= 0) return null;
    const t0 = G.tier();
    st.res.gems -= n; st.delivered += n;
    G.log('Сдано Институту без заказа: ' + n + ' драгоценностей.');
    return { total: n, tierUp: G.tier() > t0 };
  };
  G.checkGoal = function () {
    const st = G.state;
    if (!st.over && st.delivered >= D.GOAL) st.over = 'win_gems';
    return st.over;
  };

  G.collectCargo = function (id) {
    const n = G.node(id);
    if (!n.cargo || !n.cargo.length) return null;
    const txt = G.giveAll(n.cargo);
    n.cargo = null;
    G.log('Груз забран в «' + n.name + '».');
    return { title: 'Груз забран', text: 'Отряд забрал груз: ' + txt, kind: 'portal' };
  };

  G.build = function (id) {
    const st = G.state;
    const b = D.BUILDINGS[id];
    const lv = G.blv(id);
    if (lv >= b.max) return false;
    if (b.tier && G.tier() < b.tier) return false;
    const cost = b.cost[Math.min(lv, b.cost.length - 1)];
    if (!G.pay(cost)) return false;
    st.buildings[id] = lv + 1;
    if (id === 'beacon') G.node(st.baseNode).beacon = true;
    if (id === 'tower') G.revealAround(st.baseNode, 2);
    G.log('На базе построено: ' + (b.levels ? b.levels[lv] : b.n) + '.');
    return true;
  };
  G.foundBase = function (id) {
    const st = G.state;
    st.baseNode = id; st.baseDay = st.day;
    const n = G.node(id);
    n.base = true;
    if (n.beacon) st.buildings.beacon = 1;
    n.oldName = n.name; n.name = 'Форт Крут'; n.fort = true;
    G.log('Отряд основал базу в «' + n.oldName + '» и назвал её «Форт Крут». Здесь можно строиться и отдыхать.');
  };

  G.raidChance = function () {
    const st = G.state;
    const cl = st.stats.lairs + st.stats.camps;
    return U.clamp(0.05 + st.day * 0.004 - cl * 0.03, 0.03, 0.3);
  };
  G.defenseScore = function () { return G.blv('walls') * 3 + G.blv('turret') * 3 + G.blv('tower'); };

  G.raidLoss = function (who) {
    const st = G.state, res = st.res;
    const lost = [];
    ['food', 'ammo', 'materials', 'gems'].forEach(function (k) {
      const v = Math.floor(res[k] * (k === 'gems' ? 0.2 : 0.3));
      if (v > 0) { res[k] -= v; lost.push('−' + v + ' ' + D.icon(k)); }
    });
    const built = Object.keys(st.buildings).filter(function (k) { return st.buildings[k] > 0; });
    let bt = '';
    if (built.length && Math.random() < 0.6) {
      const b = U.pick(built);
      const lv = st.buildings[b];
      st.buildings[b] = lv - 1;
      if (b === 'beacon') G.node(st.baseNode).beacon = false;
      const bd = D.BUILDINGS[b];
      bt = ' Разрушено: ' + (bd.levels ? bd.levels[lv - 1] : bd.n) + '.';
    }
    G.log('База разграблена (' + who + ').');
    return 'Потери: ' + (lost.join(', ') || 'нет') + '.' + bt;
  };
  G.autoResolveRaid = function (raid) {
    const def = G.defenseScore();
    const atk = raid.strength + U.rand(-1, 2);
    const who = raid.kind === 'beast' ? 'мутанты' : 'бандиты';
    if (def >= atk) {
      G.log('Укрепления базы отбили набег (' + who + ').');
      return { title: 'Набег отбит', text: 'Пока отряд отсутствовал, ' + who + ' напали на базу, но укрепления выдержали.', kind: 'good' };
    }
    return { title: 'База разграблена', text: 'Пока отряд отсутствовал, ' + who + ' ворвались на базу. ' + G.raidLoss(who), kind: 'bad' };
  };

  /* ---------- Смена дня ---------- */
  G.advanceDay = function () {
    const st = G.state, res = st.res, notes = [];
    st.day++;
    const hasBase = st.baseNode !== null;
    const atBase = hasBase && st.squadAt === st.baseNode;

    // питание
    const need = st.roster.length;
    if (res.food >= need) { res.food -= need; st.hungry = false; }
    else {
      res.food = 0; st.hungry = true;
      st.roster.forEach(function (s) { if (G.hp(s) > 1) s.wounds += 1; });
      notes.push({ title: 'Голод', text: 'Провизия закончилась. Бойцы слабеют: −1 ОЗ в день и −10 к меткости, пока нет еды. Закажите провизию через Портал.', kind: 'bad' });
    }
    // лечение
    if (!st.hungry) {
      const heal = atBase ? (G.blv('infirmary') ? 4 : 2) : 1;
      st.roster.forEach(function (s) { s.wounds = Math.max(0, s.wounds - heal); });
    }
    // производство
    if (hasBase) {
      if (G.blv('farm')) res.food += 5;
      if (G.blv('workshop') && res.materials >= 1) { res.materials -= 1; res.ammo += 15; }
    }
    let og = 0;
    st.world.nodes.forEach(function (n) { if (n.outpost) og += 3; });
    if (og) res.gems += og;

    // доставка заказов
    const arrived = st.orders.filter(function (o) { return o.day <= st.day; });
    st.orders = st.orders.filter(function (o) { return o.day > st.day; });
    arrived.forEach(function (o) {
      const node = G.node(o.drop);
      if (o.drop === st.squadAt || o.drop === st.baseNode) {
        const txt = G.giveAll(o.items);
        notes.push({ title: 'Груз Института', text: 'Портал открылся на рассвете. ' + (o.drop === st.squadAt ? 'Груз упал прямо рядом с отрядом' : 'Груз доставлен на базу') + ': ' + txt, kind: 'portal' });
      } else {
        node.cargo = (node.cargo || []).concat(o.items);
        notes.push({ title: 'Груз Института', text: 'Груз доставлен в «' + node.name + '». Заберите его, пока не растащили.', kind: 'portal' });
      }
    });
    // кражи грузов
    st.world.nodes.forEach(function (n) {
      if (n.cargo && n.cargo.length && n.id !== st.squadAt && n.id !== st.baseNode && Math.random() < 0.08) {
        n.cargo = null;
        notes.push({ title: 'Груз пропал', text: 'Груз в «' + n.name + '» растащили мародёры.', kind: 'bad' });
        G.log('Груз в «' + n.name + '» украден.');
      }
    });
    // твари возвращаются
    st.world.nodes.forEach(function (n) {
      if (!n.cleared || n.id === st.squadAt || n.id === st.baseNode || n.beacon) return;
      if (n.outpost) {
        if (Math.random() < 0.03) {
          n.outpost = false; n.cleared = false;
          notes.push({ title: 'Бур потерян', text: 'Мутанты захватили бур в «' + n.name + '». Отбейте жилу снова.', kind: 'bad' });
          G.log('Потерян бур в «' + n.name + '».');
        }
        return;
      }
      if ((n.type === 'vein' || n.type === 'ruins') && Math.random() < 0.025) {
        n.cleared = false;
        notes.push({ title: 'Угроза', text: 'Разведка докладывает: мутанты снова заняли «' + n.name + '».', kind: 'bad' });
      }
    });

    // набеги
    let defense = null, raidNew = false;
    if (st.raid && st.raid.day <= st.day) {
      const raid = st.raid;
      st.raid = null;
      if (atBase) defense = raid;
      else notes.push(G.autoResolveRaid(raid));
    } else if (!st.raid && hasBase && st.day - st.baseDay >= 3 && Math.random() < G.raidChance()) {
      const warn = G.blv('tower') ? 2 : 1;
      let lairs = 0, camps = 0;
      st.world.nodes.forEach(function (n) {
        if (n.type === 'lair' && !n.cleared) lairs++;
        if (n.type === 'camp' && !n.cleared) camps++;
      });
      const kind = (lairs + camps === 0) ? 'beast' : (Math.random() < lairs / (lairs + camps) ? 'beast' : 'raider');
      st.raid = { day: st.day + warn, kind: kind, strength: 3 + Math.floor(st.day / 5), start: st.day, from: G.raidSource(kind) };
      raidNew = true;
      notes.push({
        title: 'Тревога!',
        text: 'Дозорные заметили ' + (kind === 'beast' ? 'стаю мутантов' : 'банду') + ', идущую к базе. Нападение через ' + warn + ' ' + U.plural(warn, 'день', 'дня', 'дней') +
          '. Если отряд будет на базе — примете бой. Иначе база будет полагаться на укрепления (защита ' + G.defenseScore() + ').',
        kind: 'bad'
      });
      G.log('Замечен ' + (kind === 'beast' ? 'набег мутантов' : 'набег банды') + ' на базу.');
    }

    let event = null;
    if (!defense && st.day > 2 && Math.random() < 0.14) event = G.rollEvent();
    return { notes: notes, event: event, defense: defense, drops: arrived.map(function (o) { return o.drop; }), raidNew: raidNew };
  };
  /* Откуда идёт набег: ближайшее логово/лагерь нужного вида, иначе дальний край карты */
  G.raidSource = function (kind) {
    const st = G.state;
    const hops = G.hopsFrom(st.baseNode);
    let best = null, bd = 1e9;
    st.world.nodes.forEach(function (n) {
      if (n.cleared || n.id === st.baseNode) return;
      const ok = kind === 'beast' ? (n.type === 'lair' || n.type === 'nest') : n.type === 'camp';
      if (ok && hops[n.id] >= 2 && hops[n.id] < bd) { bd = hops[n.id]; best = n.id; }
    });
    if (best === null) {
      st.world.nodes.forEach(function (n) { if (hops[n.id] >= 2 && hops[n.id] <= 4 && (best === null || hops[n.id] > hops[best])) best = n.id; });
    }
    return best === null ? st.baseNode : best;
  };
  /* Число переходов по любым дорогам (без учёта зачистки) */
  G.hopsFrom = function (id) {
    const st = G.state, n = st.world.nodes.length;
    const hops = []; for (let i = 0; i < n; i++) hops.push(1e9);
    hops[id] = 0;
    const q = [id];
    while (q.length) {
      const c = q.shift();
      st.world.edges.forEach(function (e) {
        const o = e[0] === c ? e[1] : (e[1] === c ? e[0] : -1);
        if (o >= 0 && hops[o] > hops[c] + 1) { hops[o] = hops[c] + 1; q.push(o); }
      });
    }
    return hops;
  };
  G.roadPath = function (from, to) {
    const hops = G.hopsFrom(to);
    if (hops[from] >= 1e9) return [from];
    const path = [from];
    let c = from;
    while (c !== to) {
      let nx = -1;
      G.state.world.edges.forEach(function (e) {
        const o = e[0] === c ? e[1] : (e[1] === c ? e[0] : -1);
        if (o >= 0 && hops[o] === hops[c] - 1 && nx < 0) nx = o;
      });
      if (nx < 0) break;
      path.push(nx); c = nx;
    }
    return path;
  };

  /* ---------- Случайные события ---------- */
  G.EVENTS = [
    {
      id: 'runaway', title: 'Беглец',
      text: 'К стоянке вышел измождённый заключённый из другой партии. Говорит, его банду сожрали мутанты. Просит принять в отряд.',
      choices: [
        { t: 'Принять (−5 провизии)', cond: function (st) { return st.res.food >= 5; }, run: function (st) {
          st.res.food -= 5; const s = G.makeRecruit(0); s.wounds = Math.floor(G.maxHp(s) / 2); st.roster.push(s);
          G.log('В отряд принят беглец «' + s.name + '».');
          return '«' + s.name + '» (' + D.CLASSES[s.cls].n.toLowerCase() + ') теперь с вами. Он ранен, но оклемается.';
        } },
        { t: 'Прогнать', run: function () { return 'Беглец молча ушёл в пустошь.'; } }
      ]
    },
    {
      id: 'cache', title: 'Тайник',
      text: 'Разведчики наткнулись на старый тайник под плитой: ржавые цинки и доски.',
      choices: [{ t: 'Забрать всё', run: function (st) {
        const a = U.rand(20, 40), m = U.rand(2, 5); st.res.ammo += a; st.res.materials += m;
        return 'Добыто: +' + a + ' ' + D.icon('ammo') + ', +' + m + ' ' + D.icon('materials') + '.';
      } }]
    },
    {
      id: 'sick', title: 'Лихорадка',
      text: null,
      make: function (st) { const s = U.pick(st.roster); return { sid: s.id, text: '«' + s.name + '» свалился с местной лихорадкой. Без лекарств он проваляется пластом.' }; },
      choices: [
        { t: 'Дать аптечку', cond: function (st) { return st.res.meds >= 1; }, run: function (st) { st.res.meds -= 1; return 'Лекарства помогли — боец на ногах.'; } },
        { t: 'Пусть отлежится', run: function (st, ctx) {
          const s = st.roster.find(function (x) { return x.id === ctx.sid; });
          if (s) s.wounds = Math.min(G.maxHp(s) - 1, s.wounds + 4);
          return 'Боец ослаб (−4 ОЗ).';
        } }
      ]
    },
    {
      id: 'traders', title: 'Вольные старатели',
      text: 'Группа вольных старателей предлагает обмен. Им нужны драгоценности.',
      choices: [
        { t: '10 💎 → 15 провизии', cond: function (st) { return st.res.gems >= 10; }, run: function (st) { st.res.gems -= 10; st.res.food += 15; return 'Обмен состоялся.'; } },
        { t: '10 💎 → 50 патронов', cond: function (st) { return st.res.gems >= 10; }, run: function (st) { st.res.gems -= 10; st.res.ammo += 50; return 'Обмен состоялся.'; } },
        { t: 'Отказаться', run: function () { return 'Старатели ушли.'; } }
      ]
    },
    {
      id: 'storm', title: 'Пыльная буря',
      text: 'Чёрная буря накрыла пустошь. Пришлось зарыться и переждать, часть провизии засыпало.',
      choices: [{ t: 'Переждать', run: function (st) { const f = Math.min(st.res.food, 3); st.res.food -= f; return 'Потеряно ' + f + ' ' + D.icon('food') + '.'; } }]
    },
    {
      id: 'night', title: 'Ночная вылазка',
      text: 'Ночью к стоянке подобрались мутанты.',
      choices: [{ t: 'Отбиваться', run: function (st) {
        if (st.squadAt === st.baseNode && G.blv('walls') > 0) { st.res.gems += 3; return 'Частокол сдержал мутантов, а дозорные их перестреляли. +3 ' + D.icon('gems'); }
        const s = U.pick(st.roster); s.wounds = Math.min(G.maxHp(s) - 1, s.wounds + 2); st.res.gems += 2;
        return 'Мутантов отогнали, но «' + s.name + '» ранен (−2 ОЗ). Из туш выковыряли +2 ' + D.icon('gems') + '.';
      } }]
    },
    {
      id: 'portalgift', title: 'Сбой портала',
      text: 'Портал у точки высадки внезапно замерцал и выплюнул чей-то чужой ящик.',
      choices: [{ t: 'Отметить на карте', run: function (st) {
        const n = G.node(st.world.landing);
        const it = U.pick(['gren', 'meds', 'ammo', 'food']);
        n.cargo = (n.cargo || []).concat([it]);
        return 'Ящик лежит у точки высадки. Заберите, пока не растащили.';
      } }]
    },
    {
      id: 'deserter', title: 'Перебежчик',
      text: 'Бандит из соседнего лагеря предлагает за долю рассказать, где стоят все лагеря банд.',
      choices: [
        { t: 'Заплатить 15 💎', cond: function (st) { return st.res.gems >= 15; }, run: function (st) {
          st.res.gems -= 15;
          st.world.nodes.forEach(function (n) { if (n.type === 'camp') { n.known = true; if (!n.cleared) n.diff = Math.max(1, n.diff - 1); } });
          return 'Лагеря банд отмечены на карте, а их охрана ослаблена (−1 к сложности).';
        } },
        { t: 'Прогнать', run: function () { return 'Перебежчик сплюнул и ушёл.'; } }
      ]
    }
  ];
  G.rollEvent = function () {
    const st = G.state;
    const ev = U.pick(G.EVENTS);
    const ctx = ev.make ? ev.make(st) : {};
    return { ev: ev, ctx: ctx, text: ctx.text || ev.text };
  };

  /* ---------- Итоги боя ---------- */
  G.applyBattle = function (B) {
    const st = G.state, res = st.res, out = B.over;
    const node = B.nodeId !== null && B.nodeId !== undefined ? G.node(B.nodeId) : null;
    const sum = { result: out, kind: B.kind, loot: {}, soldiers: [], dead: [], items: [], promoted: [], text: '', node: node ? node.name : '' };
    function add(k, v) {
      if (!v) return;
      res[k] = (res[k] || 0) + v;
      sum.loot[k] = (sum.loot[k] || 0) + v;
    }
    let k;
    if (out === 'victory' || out === 'evac') for (k in B.loot) add(k, B.loot[k]);
    if (out === 'victory') {
      for (k in B.field) add(k, B.field[k]);
      B.items.forEach(function (it) { add(it.kind, it.amt); });
      (B.drops || []).forEach(function (w) {
        st.stock.weapons[w] = (st.stock.weapons[w] || 0) + 1;
        sum.items.push(D.WEAPONS[w].n);
      });
    }
    let kills = 0;
    B.units.forEach(function (u) {
      if (u.kind !== 'soldier') return;
      const idx = st.roster.findIndex(function (x) { return x.id === u.sid; });
      if (idx < 0) return;
      const s = st.roster[idx];
      kills += u.kills;
      if (!u.alive && (u.stable || (u.down > 0 && out === 'victory'))) {
        s.wounds = Math.max(0, G.maxHp(s) - 1);
        if ((s.look.bscars || 0) < 3) { s.look.bscars = (s.look.bscars || 0) + 1; (sum.scarred = sum.scarred || []).push(s.name); }
        s.kills += u.kills; s.missions++;
        s.xp += (u.xpGain || 0) + 1;
        sum.soldiers.push({ name: s.name, hp: G.hp(s), maxHp: G.maxHp(s), kills: u.kills, xp: (u.xpGain || 0) + 1, evac: false, ref: s, promo: null, saved: true });
        G.log('«' + s.name + '» выжил после тяжёлого ранения.');
        return;
      }
      if (!u.alive) {
        st.roster.splice(idx, 1);
        st.memorial.push({ id: s.id, name: s.name, day: st.day, kills: s.kills + u.kills, cls: s.cls, armor: s.armor, look: s.look, rank: G.rank(s) });
        sum.dead.push(s.name);
        (sum.deadRefs = sum.deadRefs || []).push({ id: s.id, name: s.name, cls: s.cls, armor: s.armor, look: s.look, rank: G.rank(s) });
        G.log('Погиб «' + s.name + '».');
        if (out === 'victory') {
          st.stock.weapons[s.weapon] = (st.stock.weapons[s.weapon] || 0) + 1;
          if (s.armor !== 'robe') st.stock.armors[s.armor] = (st.stock.armors[s.armor] || 0) + 1;
        }
        return;
      }
      const r0 = G.rank(s);
      if (u.hp <= Math.max(1, Math.floor(u.maxHp * 0.34)) && (s.look.bscars || 0) < 3) {
        s.look.bscars = (s.look.bscars || 0) + 1;
        (sum.scarred = sum.scarred || []).push(s.name);
      }
      s.wounds = Math.max(0, G.maxHp(s) - u.hp);
      s.kills += u.kills;
      s.missions++;
      const gain = (u.xpGain || 0) + (out === 'victory' ? 2 : (out === 'evac' ? 1 : 0));
      s.xp += gain;
      const r1 = G.rank(s);
      if (r1 > r0) {
        s.wounds = Math.max(0, s.wounds - 1);
        sum.promoted.push(s.name + ' — ' + D.RANKS[r1].n);
        (sum.perkChoices = sum.perkChoices || []).push({ s: s, opts: G.perkOffer(s) });
      }
      sum.soldiers.push({ name: s.name, hp: G.hp(s), maxHp: G.maxHp(s), kills: u.kills, xp: gain, evac: u.evac, ref: s, promo: r1 > r0 ? D.RANKS[r1].n : null });
    });

    if (B.kind === 'defense') {
      if (out === 'victory') { sum.text = 'Нападение на базу отбито!'; G.log('Отряд отбил нападение на базу.'); }
      else sum.text = 'Базу не удалось удержать. ' + G.raidLoss(B.raidKind === 'beast' ? 'мутанты' : 'бандиты');
    } else if (node) {
      if (out === 'victory') {
        if (!node.cleared) {
          node.cleared = true;
          if (node.type === 'lair') st.stats.lairs++;
          if (node.type === 'camp') st.stats.camps++;
          if (node.type === 'nest') st.over = 'win_nest';
        }
        node.visited = true;
        sum.text = '«' + node.name + '» зачищено.';
        G.log('Зачищено: «' + node.name + '».');
      } else {
        sum.text = out === 'evac' ? 'Отряд отступил.' : 'Отряд разбит.';
        if (B.kind === 'ambush' && node.cleared) { node.cleared = false; sum.text += ' Мутанты заняли «' + node.name + '».'; }
        if (st.squadAt === B.nodeId && st.prevNode !== null && st.prevNode !== undefined && st.prevNode !== B.nodeId) {
          st.squadAt = st.prevNode;
          sum.text += ' Выжившие вернулись в «' + G.node(st.squadAt).name + '».';
        }
        G.log('Неудача в «' + node.name + '».');
      }
    }
    st.stats.missions++;
    st.stats.kills += kills;
    if (out === 'victory') st.stats.won++;
    st.battle = null;
    if (st.roster.length === 0) st.over = 'lose';
    G.save();
    return sum;
  };

  DW.G = G;
})(window.DW);
