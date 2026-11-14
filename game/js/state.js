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
      look: DW.ART.makeLook(U.rand(1, 1e9), tpl.look || null),
      face: tpl.face !== undefined ? tpl.face : D.FACE_NAMES.indexOf(tpl.name)
    };
  };
  /* лицо бойца (номер фото): своё по имени, иначе — наименее занятое среди лиц новобранцев (сохраняется в бойце) */
  G.faceOf = function (s) {
    if (!s) return -1;
    if (s.face !== undefined && s.face >= 0) return s.face;
    const byName = D.FACE_NAMES.indexOf((s.name || '').split(' ')[0]);
    if (byName >= 0) { s.face = byName; return byName; }
    const st = G.state, cnt = {};
    if (st) st.roster.concat(st.memorial || []).forEach(function (o) { if (o !== s && o.face !== undefined && o.face >= 0) cnt[o.face] = (cnt[o.face] || 0) + 1; });
    let best = 6, bc = 1e9;
    const h = DW.ART && DW.ART.hashStr ? DW.ART.hashStr(String(s.id || s.name)) : 0;
    for (let k = 0; k < D.FACE_NAMES.length - 6; k++) { const f = 6 + (k + h) % (D.FACE_NAMES.length - 6); if ((cnt[f] || 0) < bc) { bc = cnt[f] || 0; best = f; } }
    s.face = best;
    return best;
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
    // ветка класса: пара навыков уровня, равного числу уже взятых
    const tr = D.TREE && D.TREE[s.cls];
    if (tr) {
      const lvl = (s.perks || []).length;
      if (lvl < tr.length) { const pair = tr[lvl].filter(function (k) { return !G.has(s, k); }); if (pair.length) return pair; }
    }
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
    // сначала — лица-персонажи (имя и лицо вместе), пока есть свободные
    const persons = D.FACE_NAMES.slice(6).filter(function (n) { return !used[n]; });
    let pool = D.NAMES.filter(function (n) { return !used[n]; });
    if (!pool.length) pool = D.NAMES;
    const name = persons.length ? U.pick(persons) : U.pick(pool);
    const cls = U.pick(['assault', 'rifleman', 'sniper', 'medic', 'heavy', 'assault', 'rifleman', 'sapper']);
    const s = G.newSoldier({
      name: name, cls: cls, hp: U.rand(8, 10), aim: U.rand(58, 68) + (level ? 3 : 0),
      mob: cls === 'heavy' ? 5 : 6, xp: level ? D.RANKS[Math.min(level, D.RANKS.length - 1)].xp : 0
    });
    s.face = D.FACE_NAMES.indexOf(name);
    if (s.face < 0) { delete s.face; G.faceOf(s); }
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
    try { const o = JSON.parse(s); return !!(o && o.roster && o.over !== 'lose'); } catch (e) { return false; }
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
      // 5.0.7: новые карты боя — для ещё не посещённых локаций
      o.flags = o.flags || {};
      if (!o.flags.maps507) { o.flags.maps507 = 1; o.world.nodes.forEach(function (n) { if (!n.visited && !n.cleared && !n.base && !n.outpost && D.MAP_VARIANTS[n.type] || (n.type === 'camp' && n.fac === 'sobr' && !n.cleared)) n.map = D.mapFor(n.type, n.fac, n.name); }); }
      // 5.1: игра бесконечная — прежние «победные» концы становятся вехами
      if (o.raid) o.raid.night = false;   // ночных набегов больше нет
      if (o.over === 'win_gems') { o.over = null; o.freeDay = o.freeDay || o.day; }
      if (o.over === 'win_nest') { o.over = null; o.queens = o.queens || 1; o.nestBack = o.nestBack || o.day + 10; }
      if (o.baseNode !== null && o.baseNode !== undefined) { const bn = o.world.nodes[o.baseNode]; if (bn && !bn.fort) { bn.oldName = bn.name; bn.name = 'Форт Крут'; bn.fort = true; } }
      return true;
    } catch (e) { return false; }
  };
  G.deleteSave = function () { DW.store.del(SAVE_KEY); };

  /* Погода на карте мира и её действие */
  G.WEATHER = {
    clear: { n: 'Ясно', d: '' },
    storm: { n: 'Пыльная буря', d: 'Поднялась пыльная буря. В пути можно пораниться, в бою обзор −3 у всех (тепловизору не помеха).' },
    acid: { n: 'Кислотный дождь', d: 'Пошёл кислотный дождь. В пути бойцы теряют по 1 ОЗ, в бою — кислотный дождь.' },
    ash: { n: 'Пеплопад', d: 'С неба сыплется пепел. Видно хуже, но идти можно.' }
  };
  G.weather = function () { const w = G.state.weather; return w && G.WEATHER[w.kind] ? w.kind : 'clear'; };
  /* Товары каравана: купить за драгоценности, продать стройматериалы */
  G.caravanGoods = function () {
    return [
      { n: 'Провизия', res: 'food', pic: 'food', amt: 10, price: 6, pay: 'gems', left: U.rand(2, 4) },
      { n: 'Патроны', res: 'ammo', pic: 'ammo', amt: 40, price: 7, pay: 'gems', left: U.rand(2, 4) },
      { n: 'Аптечки', res: 'meds', pic: 'meds', amt: 2, price: 11, pay: 'gems', left: U.rand(1, 2) },
      { n: 'Гранаты', res: 'grenades', pic: 'gren', amt: 2, price: 13, pay: 'gems', left: U.rand(0, 2) },
      { n: 'Стройматериалы', res: 'materials', pic: 'mat', amt: 5, price: 4, pay: 'gems', left: U.rand(1, 3), sell: true }
    ];
  };
  /* Разведка соседней локации: один боец уходит на день, враги становятся известны в лицо */
  G.scout = function (n) {
    const st = G.state;
    const ok = st.roster.filter(function (s) { return !s.injury; }).sort(function (a, b) { return (b.cls === 'sniper' ? 2 : 0) + (b.trait === 'quick' ? 1 : 0) - ((a.cls === 'sniper' ? 2 : 0) + (a.trait === 'quick' ? 1 : 0)); });
    const s = ok[0];
    if (!s) return null;
    n.scouted = true; n.known = true;
    if (DW.BT.planFor && !n.cleared) DW.BT.planFor(n, 'normal', n.diff);
    let hurt = false;
    if (Math.random() < 0.15) { s.wounds = Math.min(G.maxHp(s) - 1, s.wounds + 2); hurt = true; }
    s.xp += 1;
    G.log('«' + s.name + '» разведал «' + n.name + '».');
    return { s: s, hurt: hurt };
  };
  /* Медали за бой: подвиги из боя (u.feats) и итог (убийства, остался в строю раненым) */
  G.awardMedals = function (s, u, out, sum) {
    const got = [];
    const f = Object.assign({}, u.feats || {});
    if ((u.kills || 0) >= 5) f.brave = 1;
    if (u.alive && u.hp <= 2 && out !== 'defeat') f.iron = 1;
    for (const k in f) { if (!D.MEDALS[k]) continue; s.medals = s.medals || {}; s.medals[k] = (s.medals[k] || 0) + 1; got.push(D.MEDALS[k].n); }
    if (got.length) (sum.medals = sum.medals || []).push(s.name + ': ' + got.join(', '));
  };
  G.checkAch = function () {
    const st = G.state, out = [];
    st.ach = st.ach || {};
    (D.ACHIEVE || []).forEach(function (a) { try { if (!st.ach[a.id] && a.ok(st)) { st.ach[a.id] = st.day; out.push(a); G.log('Достижение: «' + a.n + '».'); } } catch (e) { /* нет данных */ } });
    return out;
  };
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
  /* ---------- Отношения с группировками: банды, клан, СОБР ----------
     репутация −5…+5: −3 и ниже — вражда (набегают чаще и злее), перемирие (за кристаллы) — не нападают, через их
     лагерь можно ходить, у них — торговля и наёмники; напасть на них — сорвать перемирие */
  G.FACS = { raider: 'Банды', clan: 'Клан', sobr: 'СОБР' };
  G.FAC_GEN = { raider: 'банд', clan: 'клана', sobr: 'СОБР' };
  G.rep = function (f) { const st = G.state; st.rep = st.rep || { raider: 0, clan: -1, sobr: -1 }; return st.rep[f] || 0; };
  G.truce = function (f) { const st = G.state; return !!(st.truce && st.truce[f] > st.day); };
  G.repAdd = function (f, d, why) {
    if (!G.FACS[f] || !d) return;
    const st = G.state, v0 = G.rep(f);
    st.rep[f] = U.clamp(v0 + d, -5, 5);
    if (d < 0 && G.truce(f)) { st.truce[f] = 0; G.log('Перемирие с ' + G.FAC_GEN[f] + ' сорвано' + (why ? ': ' + why : '') + '.'); }
    if (v0 > -3 && st.rep[f] <= -3) G.log('Вражда: ' + G.FACS[f].toLowerCase() + ' мстят колонии.');
  };
  G.facStatus = function (f) { return G.truce(f) ? 'перемирие' : (G.rep(f) <= -3 ? 'вражда' : (G.rep(f) >= 3 ? 'уважение' : 'нейтралитет')); };
  G.truceCost = function (f) { return ({ raider: 25, clan: 35, sobr: 50 }[f] || 30) + Math.max(0, -G.rep(f)) * 10 + G.threat() * 5; };
  G.truceNode = function (n) { return !!(n && n.type === 'camp' && !n.cleared && G.truce(n.fac || 'raider')); };
  G.makeTruce = function (f) {
    const st = G.state, c = G.truceCost(f);
    if (G.rep(f) < -2 || st.res.gems < c) return false;
    st.res.gems -= c; st.truce = st.truce || {}; st.truce[f] = st.day + 15;
    G.repAdd(f, 1);
    G.log('Перемирие с ' + G.FAC_GEN[f] + ' на 15 дней.');
    return true;
  };
  G.gift = function (f, res, amt) {
    const st = G.state;
    st.giftDay = st.giftDay || {};
    if (st.giftDay[f] === st.day || (st.res[res] || 0) < amt) return false;
    st.res[res] -= amt; st.giftDay[f] = st.day;
    G.repAdd(f, 1);
    return true;
  };
  // наёмник на 10 дней: боец группировки с её оружием
  G.MERC = { raider: { cost: 25, cls: 'rifleman', w: 'ak' }, clan: { cost: 30, cls: 'assault', w: 'obrez' }, sobr: { cost: 45, cls: 'heavy', w: 'pkp' } };
  G.hireMerc = function (f) {
    const st = G.state, M = G.MERC[f];
    if (!G.truce(f) || st.res.gems < M.cost) return null;
    st.res.gems -= M.cost;
    const s = G.makeRecruit(1);
    s.cls = M.cls; if (D.WEAPONS[M.w]) s.weapon = M.w;
    s.merc = { fac: f, until: st.day + 10 };
    st.roster.push(s);
    G.log('Нанят боец ' + G.FAC_GEN[f] + ': «' + s.name + '» (до ' + s.merc.until + '-го дня).');
    return s;
  };
  G.findPath = function (from, to) {
    if (from === to) return [];
    const prev = {}; prev[from] = -1;
    const q = [from];
    while (q.length) {
      const c = q.shift();
      if (c === to) break;
      if (c !== from && !G.node(c).cleared && !G.truceNode(G.node(c))) continue;
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
  /* УАЗ: чинится в гараже; исправный — быстрее по карте и укрытие у высадки в бою */
  G.uazOk = function () {
    const st = G.state;
    // старые сохранения: гараж уже построен — машина на ходу
    if (st.uaz === undefined && G.blv('garage')) st.uaz = { ok: true };
    return !!(st.uaz && st.uaz.ok);
  };
  G.repairUaz = function () {
    const st = G.state;
    if (!G.blv('garage') || G.uazOk() || !G.canAfford(D.UAZ_REPAIR)) return false;
    for (const k in D.UAZ_REPAIR) st.res[k] -= D.UAZ_REPAIR[k];
    st.uaz = Object.assign(st.uaz || {}, { ok: true });   // улучшения остаются
    G.log('УАЗ на ходу.');
    return true;
  };
  // улучшение УАЗа: есть и машина на ходу
  G.uazHas = function (k) { const st = G.state; return G.uazOk() && !!(st.uaz.up && st.uaz.up[k]); };
  G.buyUazUp = function (k) {
    const st = G.state, U2 = D.UAZ_UP[k];
    if (!U2 || !G.blv('garage') || !st.uaz || (st.uaz.up && st.uaz.up[k]) || !G.canAfford(U2.cost)) return false;
    G.pay(U2.cost);
    st.uaz.up = st.uaz.up || {}; st.uaz.up[k] = 1;
    G.log('УАЗ: ' + U2.n.toLowerCase() + '.');
    return true;
  };
  // сколько бойцов берут на задание
  G.squadMax = function () { return 6 + (G.uazHas('seats') ? 1 : 0); };
  /* сюжетные задания: открываются по условиям, привязываются к ближайшей незачищенной локации нужного вида */
  G.checkQuests = function () {
    const st = G.state, out = [];
    st.quests = st.quests || {};
    (D.QUESTS || []).forEach(function (q) {
      if (st.quests[q.id]) return;
      let ok = false; try { ok = q.when(st); } catch (e) { ok = false; }
      if (!ok) return;
      // локация: нужного вида, не зачищена, без другого задания — ближайшая к отряду
      const here = G.node(st.squadAt);
      const cand = st.world.nodes.filter(function (n) { return n.type === q.node && !n.cleared && !n.quest; });
      if (!cand.length) return;
      cand.sort(function (a, b) { return Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y); });
      const n = cand[0];
      n.quest = q.id; n.known = true;
      if (q.goal === 'boss') n.diff = Math.max(n.diff, 3);
      st.quests[q.id] = { node: n.id, done: false };
      G.log('Задание: «' + q.t + '» — ' + n.name + '.');
      out.push({ q: q, node: n });
    });
    return out;
  };
  G.questOf = function (node) { return node && node.quest ? (D.QUESTS || []).find(function (q) { return q.id === node.quest; }) : null; };
  G.questReward = function (q, sum) {
    const st = G.state, r = q.reward || {}, got = [];
    ['gems', 'materials', 'ammo', 'food', 'meds'].forEach(function (k) { if (r[k]) { st.res[k] += r[k]; got.push('+' + r[k] + ' ' + D.icon(k)); } });
    if (r.weapon) { st.stock.weapons[r.weapon] = (st.stock.weapons[r.weapon] || 0) + 1; got.push(D.WEAPONS[r.weapon].n); }
    if (r.trust) { st.trust = (st.trust || 0) + r.trust; got.push('доверие Института +' + r.trust); }
    st.quests[q.id].done = true;
    G.log('Задание «' + q.t + '» выполнено.');
    if (sum) sum.quest = { t: q.t, text: q.done, got: got };
  };
  G.tier = function () {
    let t = 0;
    // доверие Института — сданные драгоценности плюс поступки отряда (события), в счёт «вольной» не идёт
    const v = G.state.delivered + (G.state.trust || 0);
    for (let i = 0; i < D.TIERS.length; i++) if (v >= D.TIERS[i].need) t = i;
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
        else if (k === 'gear') { st.gear = st.gear || {}; st.gear[g.gear] = true; extra.push(c.n.toLowerCase()); }
        else if (k === 'mod') { st.stock.mods = st.stock.mods || {}; st.stock.mods[g.mod] = (st.stock.mods[g.mod] || 0) + 1; extra.push('модуль «' + D.MODS[g.mod].n + '»'); }
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
  // Вольная — веха, а не конец игры: Институт признаёт колонию, из Портала выходят первые поселенцы (ополчение базы)
  G.checkGoal = function () {
    const st = G.state;
    if (!st.freeDay && st.delivered >= D.GOAL) {
      st.freeDay = st.day; st.milestone = 'win_gems';
      st.militia = (st.militia || 0) + 3;
      G.log('Институт дал колонии вольную. Из Портала вышли первые поселенцы.');
    }
    return st.milestone || null;
  };
  // Угроза растёт со временем: каждые 10 дней мир злее — зачищенное занимают быстрее, враги сильнее
  G.threat = function () { return Math.max(0, Math.floor((((G.state && G.state.day) || 1) - 1) / 10)); };
  // рекорд выживания (между прохождениями)
  G.best = function () { try { return JSON.parse(DW.store.get('dw_best') || 'null') || { days: 0, kills: 0 }; } catch (e) { return { days: 0, kills: 0 }; } };
  G.saveBest = function () {
    const st = G.state, b = G.best();
    const nb = { days: Math.max(b.days || 0, st.day), kills: Math.max(b.kills || 0, st.stats.kills || 0) };
    try { DW.store.set('dw_best', JSON.stringify(nb)); } catch (e) { /* ignore */ }
    return { best: nb, newDays: st.day > (b.days || 0) };
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
    if (id === 'garage' && !st.uaz) st.uaz = { ok: false };   // найденный УАЗ ещё надо починить
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
    return U.clamp(0.05 + st.day * 0.004 - Math.min(cl, 5) * 0.03, 0.03, 0.3);
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
  G.DIRN = { e: 'с востока', n: 'с севера', s: 'с юга', w: 'с запада' };
  /* Подготовка к набегу: мины (4 мат.), колючка (2), мешки (2), посты */
  G.prepCost = { mines: 4, wire: 2, bags: 2 };
  G.prepMax = { mines: 6, wire: 8, bags: 6 };
  G.prepAdd = function (k) {
    const st = G.state; st.defPrep = st.defPrep || { mines: 0, wire: 0, bags: 0, posts: false };
    if ((st.defPrep[k] || 0) >= G.prepMax[k] || st.res.materials < G.prepCost[k]) return false;
    st.res.materials -= G.prepCost[k]; st.defPrep[k] = (st.defPrep[k] || 0) + 1; return true;
  };
  G.raidWho = function (kind) { return { beast: 'мутанты', clan: 'клан', sobr: 'СОБР' }[kind] || 'бандиты'; };
  G.autoResolveRaid = function (raid) {
    const def = G.defenseScore();
    const atk = raid.strength + U.rand(-1, 2);
    const who = G.raidWho(raid.kind);
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
    // тяжёлые ранения: −1 день (в лазарете на базе — −2)
    st.roster.forEach(function (s) {
      if (!s.injury) return;
      s.injury = Math.max(0, s.injury - (atBase && G.blv('infirmary') ? 2 : 1));
      if (!s.injury) notes.push({ title: 'Снова в строю', text: '«' + s.name + '» оправился от ранения и может идти на задание.', kind: 'good' });
    });
    // погода на карте мира: буря, кислотный дождь, пеплопад — день-два
    const W0 = st.weather || { kind: 'clear', left: 0 };
    if (W0.left > 1) W0.left--;
    else {
      const r = Math.random();
      const k = st.day < 3 ? 'clear' : (r < 0.68 ? 'clear' : (r < 0.8 ? 'storm' : (r < 0.91 ? 'acid' : 'ash')));
      st.weather = { kind: k, left: k === 'clear' ? U.rand(2, 4) : U.rand(1, 2) };
      if (k !== 'clear' && W0.kind !== k) notes.push({ title: G.WEATHER[k].n, text: G.WEATHER[k].d, kind: 'bad' });
    }
    // караван торговцев идёт по дорогам
    if (st.caravan) {
      const c = st.caravan;
      if (c.path.length) { c.at = c.path.shift(); c.met = false; }
      else { st.caravan = null; }
    } else if (st.day >= 4 && Math.random() < 0.2) {
      const ks = st.world.nodes.filter(function (n) { return n.known && n.id !== st.squadAt; });
      if (ks.length >= 2) {
        const a = U.pick(ks); let b = U.pick(ks), t = 0;
        while ((b === a || G.roadPath(a.id, b.id).length < 4) && t++ < 20) b = U.pick(ks);
        const path = G.roadPath(a.id, b.id);
        if (path.length >= 3) {
          st.caravan = { at: a.id, path: path.slice(1), goods: G.caravanGoods(), met: false, rich: U.rand(0, 1) };
          notes.push({ title: 'Караван', text: 'По дорогам идёт караван торговцев — сейчас у «' + a.name + '». Его видно на карте; встретите — можно поторговать (или ограбить).', kind: 'portal' });
        }
      }
    }
    // буры на жилах: вагонетка — больше добычи; мутанты нападают — отбить за два дня, иначе бур потерян
    st.world.nodes.forEach(function (n) {
      if (!n.outpost) return;
      if (n.drillThreat && st.day >= n.drillThreat) {
        n.drillThreat = null; n.outpost = false; n.cart = false; n.cleared = false;
        notes.push({ title: 'Бур потерян', text: 'Не успели: мутанты разнесли бур в «' + n.name + '». Отбейте жилу снова.', kind: 'bad' });
        G.log('Потерян бур в «' + n.name + '».');
      } else if (!n.drillThreat && n.id !== st.squadAt && Math.random() < 0.05) {
        n.drillThreat = st.day + 2;
        notes.push({ title: 'Нападение на бур', text: 'Охрана бура в «' + n.name + '» шлёт сигнал: идут мутанты! Придите за два дня и отбейте — иначе бур потерян.', kind: 'bad' });
      }
    });
    // ополчение: поселенцы базы, растёт раз в 5 дней (больше построек — больше людей)
    if (hasBase) {
      const cap = Math.min(6, 2 + Math.floor(Object.keys(st.buildings).filter(function (k) { return st.buildings[k] > 0; }).length / 2));
      if (st.militia === undefined) st.militia = 2;
      if (st.day % 5 === 0 && st.militia < cap) { st.militia++; notes.push({ title: 'Поселенцы', text: 'К базе прибились ещё люди. Ополчение: ' + st.militia + ' — встанут на защиту при набеге.', kind: 'good' }); }
    }
    // тир: дни на базе — тренировки
    if (atBase && G.blv('range') && res.ammo >= 10) {
      res.ammo -= 10;
      const up = [];
      st.roster.forEach(function (s) {
        if (s.injury) return;
        s.xp += 1; s.drill = (s.drill || 0) + 1;
        if (s.drill % 4 === 0 && (s.drillAim || 0) < 6) { s.drillAim = (s.drillAim || 0) + 1; s.aimBase += 1; up.push(s.name + ' +1 к меткости'); }
        if (s.drill % 8 === 0 && (s.drillHp || 0) < 2) { s.drillHp = (s.drillHp || 0) + 1; s.hpBase += 1; up.push(s.name + ' +1 ОЗ'); }
      });
      if (up.length) notes.push({ title: 'Тир', text: 'Тренировки дают плоды: ' + up.join(', ') + '.', kind: 'good' });
    }
    // производство
    if (hasBase) {
      if (G.blv('farm')) res.food += 5;
      if (G.blv('workshop') && res.materials >= 1) { res.materials -= 1; res.ammo += 15; }
      if (G.blv('ammo')) { res.ammo += 20; if (st.day % 3 === 0) res.grenades = (res.grenades || 0) + 1; }
      if (G.blv('radio')) G.revealAround(st.baseNode, 3);
    }
    let og = 0;
    st.world.nodes.forEach(function (n) { if (n.outpost && !n.drillThreat) og += 3 + (n.cart ? 2 : 0); });
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
    // мир не кончается: зачищенное снова занимают — твари в руинах и у жил, стаи в логовах, банды в лагерях;
    // чем дольше живёт колония, тем чаще и тем сильнее (угроза растёт каждые 10 дней)
    const thr = G.threat();
    st.world.nodes.forEach(function (n) {
      if (!n.cleared || n.id === st.squadAt || n.id === st.baseNode || n.beacon) return;
      if (n.outpost) return;
      let p = 0;
      if (n.type === 'vein' || n.type === 'ruins') p = 0.025 + thr * 0.004;
      else if (n.type === 'lair') p = st.day > 8 ? 0.02 + thr * 0.006 : 0;
      else if (n.type === 'camp') p = st.day > 10 ? 0.015 + thr * 0.005 : 0;
      if (n.type === 'lair' && st.calmUntil > st.day) p = 0;
      if (!p || Math.random() >= Math.min(0.08, p)) return;
      n.cleared = false; n.plan = null;
      if (n.type === 'lair' || n.type === 'camp') n.diff = Math.min(5, (n.diff || 1) + 1);
      const who = n.type === 'camp' ? ({ clan: 'клан', sobr: 'СОБР' }[n.fac] || 'новая банда') : (n.type === 'lair' ? 'новая стая' : 'мутанты');
      notes.push({ title: 'Угроза', text: 'Разведка докладывает: ' + who + (n.type === 'camp' && n.fac === 'sobr' ? ' снова занял' : ' снова заняли') + ' «' + n.name + '».' + (n.type === 'lair' || n.type === 'camp' ? ' Теперь их там больше.' : ''), kind: 'bad' });
      G.log('Враги снова заняли «' + n.name + '».');
    });
    // наёмники уходят по сроку; перемирие кончается
    st.roster.slice().forEach(function (s) {
      if (s.merc && s.merc.until <= st.day && st.roster.length > 1) {
        st.roster.splice(st.roster.indexOf(s), 1);
        notes.push({ title: 'Наёмник ушёл', text: '«' + s.name + '» отслужил срок и вернулся к своим (' + G.FACS[s.merc.fac].toLowerCase() + ').', kind: 'info' });
      }
    });
    if (st.truce) for (const f in st.truce) if (st.truce[f] === st.day) notes.push({ title: 'Перемирие кончилось', text: 'Срок перемирия с ' + G.FAC_GEN[f] + ' вышел. Можно договориться снова.', kind: 'info' });
    // в Гнезде заводится новая Матка
    if (st.nestBack && st.day >= st.nestBack) {
      st.nestBack = null;
      const ns = st.world.nodes.find(function (n) { return n.type === 'nest'; });
      if (ns && ns.cleared) {
        ns.cleared = false; ns.plan = null;
        notes.push({ title: 'Новая Матка', text: 'Разведка: в Гнезде снова шевелится выводок — там завелась новая Матка. Мутантов в округе станет больше.', kind: 'bad' });
        G.log('В Гнезде завелась новая Матка.');
      }
    }

    // набеги
    let defense = null, raidNew = false;
    if (st.raid && st.raid.day <= st.day) {
      const raid = st.raid;
      st.raid = null;
      if (atBase) defense = raid;
      // УАЗ на ходу и база недалеко — можно примчаться на подмогу (отряд будет с 3-го хода)
      else if (G.uazOk() && (G.hopsFrom(st.squadAt)[st.baseNode] || 99) <= 3) defense = Object.assign({}, raid, { relief: true });
      else notes.push(G.autoResolveRaid(raid));
    } else if (!st.raid && hasBase && st.day - st.baseDay >= 3 && Math.random() < G.raidChance()) {
      const warn = G.blv('tower') ? 2 : 1;
      let lairs = 0, camps = 0; const facs = [];
      st.world.nodes.forEach(function (n) {
        if (n.type === 'lair' && !n.cleared) lairs++;
        // с перемирием не нападают; во вражде — чаще
        if (n.type === 'camp' && !n.cleared && !G.truce(n.fac || 'raider')) { camps++; facs.push(n.fac || 'raider'); if (G.rep(n.fac || 'raider') <= -3) { camps++; facs.push(n.fac || 'raider'); } }
      });
      // набег идёт от того, кто рядом: мутанты из логов или люди из лагерей (банда, клан, СОБР)
      // после гибели Матки мутанты несколько дней не нападают
      if (st.calmUntil > st.day) lairs = 0;
      const kind = (lairs + camps === 0) ? (st.calmUntil > st.day ? null : 'beast') : (Math.random() < lairs / (lairs + camps) ? 'beast' : U.pick(facs));
      if (kind) {
      st.raid = { day: st.day + warn, kind: kind, strength: Math.min(14, 3 + Math.floor(st.day / 5) + (kind !== 'beast' && G.rep(kind) <= -3 ? 2 : 0)), start: st.day, from: G.raidSource(kind), dir: U.pick(['e', 'e', 'n', 's']), night: false };
      raidNew = true;
      notes.push({
        title: 'Тревога!',
        text: 'Дозорные заметили ' + (kind === 'beast' ? 'стаю мутантов' : 'банду') + ', идущую к базе. Нападение через ' + warn + ' ' + U.plural(warn, 'день', 'дня', 'дней') +
          (G.blv('radio') ? '. Радиовышка перехватила: удар будет ' + G.DIRN[st.raid.dir] : '') +
          '. Если отряд будет на базе — примете бой (на базе можно подготовиться: мины, колючка, посты). На УАЗе отряд успеет издалека. Иначе база будет полагаться на укрепления (защита ' + G.defenseScore() + ').',
        kind: 'bad'
      });
      G.log('Замечен ' + (kind === 'beast' ? 'набег мутантов' : 'набег банды') + ' на базу.');
      }
    }

    G.checkAch().forEach(function (a) { notes.push({ title: 'Достижение', text: '«' + a.n + '» — ' + a.d.toLowerCase() + '.', kind: 'good' }); });
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
      const ok = kind === 'beast' ? (n.type === 'lair' || n.type === 'nest') : (n.type === 'camp' && (n.fac || 'raider') === kind);
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
    },
    {
      id: 'tribute', title: 'Дань',
      text: 'Дорогу перегородили люди из чужой банды. Старший требует «плату за проход»: патроны или драгоценности.',
      choices: [
        { t: 'Отдать 25 патронов', cond: function (st) { return st.res.ammo >= 25; }, run: function (st) { st.res.ammo -= 25; return 'Банда расступилась. Отряд прошёл без выстрелов.'; } },
        { t: 'Отдать 8 💎', cond: function (st) { return st.res.gems >= 8; }, run: function (st) { st.res.gems -= 8; return 'Банда забрала камни и ушла.'; } },
        { t: 'Отказать', run: function (st) {
          // короткая перестрелка: кого-то зацепит, зато у бандитов кое-что было
          const s = U.pick(st.roster); s.wounds = Math.min(G.maxHp(s) - 1, s.wounds + 3);
          const a = U.rand(10, 25); st.res.ammo += a;
          return 'Перестрелка вышла короткой. «' + s.name + '» ранен (−3 ОЗ), но с бандитов сняли ' + a + ' ' + D.icon('ammo') + '.';
        } }
      ]
    },
    {
      id: 'stranger', title: 'Раненый старатель',
      text: 'У дороги — вольный старатель с разорванной ногой. Просит о помощи и обещает показать, где прячет добычу.',
      choices: [
        { t: 'Перевязать (−1 аптечка)', cond: function (st) { return st.res.meds >= 1; }, run: function (st) {
          st.res.meds -= 1; const g = U.rand(6, 12), m = U.rand(1, 3); st.res.gems += g; st.res.materials += m;
          G.log('Отряд помог раненому старателю.');
          return 'Старатель сдержал слово: +' + g + ' ' + D.icon('gems') + ', +' + m + ' ' + D.icon('materials') + '.';
        } },
        { t: 'Пройти мимо', run: function () { return 'Его крики ещё долго было слышно позади.'; } }
      ]
    },
    {
      id: 'brood', title: 'Следы выводка',
      text: 'Свежие следы мутантов и обглоданные кости. Рядом — их тропа и, похоже, запас камней в старой норе.',
      choices: [
        { t: 'Обойти (−1 провизии на бойца)', cond: function (st) { return st.res.food >= st.roster.length; }, run: function (st) { st.res.food -= st.roster.length; return 'Крюк вышел долгим, но обошлось без стычки.'; } },
        { t: 'Обыскать нору', run: function (st) {
          const g = U.rand(8, 16); st.res.gems += g;
          if (Math.random() < 0.5) { const s = U.pick(st.roster); s.wounds = Math.min(G.maxHp(s) - 1, s.wounds + 3); return 'Из норы выскочила тварь — «' + s.name + '» ранен (−3 ОЗ). Но камни ваши: +' + g + ' ' + D.icon('gems') + '.'; }
          return 'Нора пуста, если не считать камней: +' + g + ' ' + D.icon('gems') + '.';
        } }
      ]
    },
    {
      id: 'radio', title: 'Сигнал',
      text: 'В развалинах — старая радиостанция, ещё ловит какой-то сигнал. Если починить, можно передать Институту координаты жил.',
      choices: [
        { t: 'Починить (−2 стройматериала)', cond: function (st) { return st.res.materials >= 2; }, run: function (st) {
          st.res.materials -= 2; st.trust = (st.trust || 0) + 25;
          G.log('Отряд передал Институту координаты жил — доверие растёт.');
          return 'Связь есть. Институт благодарит за координаты: доверие +25 (лучше товары через Портал).';
        } },
        { t: 'Разобрать на детали', run: function (st) { const m = U.rand(1, 3); st.res.materials += m; return 'Из радиостанции вышло +' + m + ' ' + D.icon('materials') + '.'; } }
      ]
    },
    {
      id: 'quarrel', title: 'Ссора',
      text: null,
      make: function (st) {
        const l = U.shuffle(st.roster.slice()).slice(0, 2);
        if (l.length < 2) return { text: 'В отряде ворчат из-за пайка, но до драки не дошло.', a: null, b: null };
        return { a: l[0].id, b: l[1].id, text: '«' + l[0].name + '» и «' + l[1].name + '» сцепились из-за пайка. Остальные ждут, что скажет командир.' };
      },
      choices: [
        { t: 'Помирить (−4 провизии на общий ужин)', cond: function (st) { return st.res.food >= 4; }, run: function (st, ctx) {
          st.res.food -= 4;
          const a = st.roster.find(function (x) { return x.id === ctx.a; }), b = st.roster.find(function (x) { return x.id === ctx.b; });
          if (a && b) { a.bonds = a.bonds || {}; b.bonds = b.bonds || {}; a.bonds[b.id] = (a.bonds[b.id] || 0) + 1; b.bonds[a.id] = (b.bonds[a.id] || 0) + 1; }
          return 'За общим котлом помирились. Они стали ближе друг к другу.';
        } },
        { t: 'Наказать обоих', run: function (st, ctx) {
          [ctx.a, ctx.b].forEach(function (id) { const x = st.roster.find(function (q) { return q.id === id; }); if (x) x.xp = Math.max(0, x.xp - 1); });
          const a = st.roster.find(function (x) { return x.id === ctx.a; }), b = st.roster.find(function (x) { return x.id === ctx.b; });
          if (a && b) { a.bonds = a.bonds || {}; b.bonds = b.bonds || {}; a.bonds[b.id] = Math.min(-2, (a.bonds[b.id] || 0) - 3); b.bonds[a.id] = Math.min(-2, (b.bonds[a.id] || 0) - 3); }
          return 'Порядок наведён жёстко. Обиду затаили (−1 опыта каждому). Рядом друг с другом теперь стреляют хуже, пока не помирятся в бою.';
        } }
      ]
    },
    {
      id: 'sample', title: 'Запрос Института',
      text: 'С грузом пришла записка: Институту нужны образцы — камни с жилы, не сданные, а «для исследований». Платят доверием.',
      choices: [
        { t: 'Отправить 10 💎', cond: function (st) { return st.res.gems >= 10; }, run: function (st) { st.res.gems -= 10; st.trust = (st.trust || 0) + 30; return 'Образцы ушли через Портал. Доверие Института +30.'; } },
        { t: 'Отказать', run: function (st) { st.trust = Math.max(-30, (st.trust || 0) - 10); return 'Институт недоволен: доверие −10.'; } }
      ]
    },
    {
      id: 'gunsmith', title: 'Оружейник',
      text: 'Одиночка-оружейник из старых зеков меняет самодельные детали к стволам на камни.',
      choices: [
        { t: '15 💎 → модуль оружия', cond: function (st) { return st.res.gems >= 15; }, run: function (st) {
          st.res.gems -= 15; const m = U.pick(Object.keys(D.MODS)); st.stock.mods = st.stock.mods || {}; st.stock.mods[m] = (st.stock.mods[m] || 0) + 1;
          return 'Получено: «' + D.MODS[m].n + '» — поставить можно в окне отряда.';
        } },
        { t: '8 💎 → 2 гранаты', cond: function (st) { return st.res.gems >= 8; }, run: function (st) { st.res.gems -= 8; st.res.grenades += 2; return 'Две самодельные гранаты — грубо, но взрываются.'; } },
        { t: 'Отказаться', run: function () { return 'Оружейник пожал плечами и ушёл.'; } }
      ]
    },
    {
      id: 'veteran', title: 'Старый вояка',
      text: 'К костру подсел бывалый зек из первых партий. За еду готов поучить молодых, как выживать в бою.',
      choices: [
        { t: 'Накормить (−6 провизии)', cond: function (st) { return st.res.food >= 6; }, run: function (st) {
          st.res.food -= 6;
          const l = st.roster.slice().sort(function (a, b) { return a.xp - b.xp; }).slice(0, 2);
          l.forEach(function (x) { x.xp += 2; });
          return 'До утра он учил новичков: ' + l.map(function (x) { return '«' + x.name + '»'; }).join(' и ') + ' — +2 опыта.';
        } },
        { t: 'Прогнать', run: function () { return 'Старик ушёл, бормоча, что молодые сами всё узнают — если доживут.'; } }
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
    const trunk = G.uazHas('trunk') && out === 'victory';
    if (out === 'victory') {
      for (k in B.field) add(k, B.field[k]);
      // всё, что осталось на карте, собрано после боя (контейнер Института — набором припасов)
      B.items.forEach(function (it) { if (it.kind === 'cargo') { add('ammo', 40); add('meds', 1); add('gems', 5); } else add(it.kind, it.amt); });
      (B.drops || []).forEach(function (w) {
        if (w === 'thermal') { st.gear = st.gear || {}; if (!st.gear.thermal) { st.gear.thermal = true; sum.items.push('тепловизор (ночь и пыль не мешают обзору)'); } return; }
        st.stock.weapons[w] = (st.stock.weapons[w] || 0) + 1;
        sum.items.push(D.WEAPONS[w].n);
      });
      // багажник УАЗа: увезли больше
      if (trunk) ['ammo', 'materials', 'food'].forEach(function (r) { const v = Math.round((sum.loot[r] || 0) * 0.3); if (v > 0) { add(r, v); sum.trunk = true; } });
    }
    let kills = 0;
    // боевые товарищи: кто прошёл бой вместе, сближается (3 совместных боя — «товарищи», +5 к меткости рядом)
    const mates = B.units.filter(function (u) { return u.kind === 'soldier' && !u.militia && (u.alive || u.stable || u.down > 0); }).map(function (u) { return u.sid; });
    const newBonds = [];
    mates.forEach(function (a) {
      const s = st.roster.find(function (x) { return x.id === a; });
      if (!s) return;
      s.bonds = s.bonds || {};
      mates.forEach(function (b) {
        if (a === b) return;
        const v0 = s.bonds[b] || 0;
        s.bonds[b] = Math.min(5, v0 + 1);
        if (v0 < 3 && s.bonds[b] >= 3 && a < b) { const o = st.roster.find(function (x) { return x.id === b; }); if (o) newBonds.push(s.name + ' и ' + o.name); }
      });
    });
    if (newBonds.length) sum.bonds = newBonds;
    B.units.forEach(function (u) {
      if (u.kind !== 'soldier') return;
      const idx = st.roster.findIndex(function (x) { return x.id === u.sid; });
      if (idx < 0) return;
      const s = st.roster[idx];
      kills += u.kills;
      G.awardMedals(s, u, out, sum);
      if (u.bondUp) for (const k in u.bondUp) { s.bonds = s.bonds || {}; s.bonds[k] = Math.min(5, (s.bonds[k] || 0) + u.bondUp[k]); const o = st.roster.find(function (x) { return x.id === k; }); if (o) { o.bonds = o.bonds || {}; o.bonds[s.id] = Math.min(5, (o.bonds[s.id] || 0) + u.bondUp[k]); } }
      if (!u.alive && (u.stable || (u.down > 0 && out === 'victory'))) {
        s.wounds = Math.max(0, G.maxHp(s) - 1);
        // тяжёлое ранение: 3 дня вне строя (в лазарете на базе — быстрее), после — черта характера
        s.injury = Math.max(s.injury || 0, 3);
        if (!s.trait2 && Math.random() < 0.6) { s.trait2 = Math.random() < 0.5 ? 'wary' : 'grim'; (sum.traits = sum.traits || []).push(s.name + ' — ' + D.TRAITS[s.trait2].n); }
        (sum.injured = sum.injured || []).push(s.name + ' (3 дн.)');
        if ((s.look.bscars || 0) < 3) { s.look.bscars = (s.look.bscars || 0) + 1; (sum.scarred = sum.scarred || []).push(s.name); }
        s.kills += u.kills; s.missions++;
        s.xp += (u.xpGain || 0) + 1;
        sum.soldiers.push({ name: s.name, hp: G.hp(s), maxHp: G.maxHp(s), kills: u.kills, xp: (u.xpGain || 0) + 1, evac: false, ref: s, promo: null, saved: true });
        G.log('«' + s.name + '» выжил после тяжёлого ранения.');
        return;
      }
      if (!u.alive) {
        st.roster.splice(idx, 1);
        st.memorial.push({ id: s.id, name: s.name, day: st.day, kills: s.kills + u.kills, cls: s.cls, armor: s.armor, look: s.look, rank: G.rank(s), face: G.faceOf(s) });
        sum.dead.push(s.name);
        (sum.deadRefs = sum.deadRefs || []).push({ id: s.id, name: s.name, cls: s.cls, armor: s.armor, look: s.look, rank: G.rank(s), face: G.faceOf(s) });
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
      // тяжело ранен (треть здоровья и меньше) — 2 дня вне строя
      if (u.hp <= Math.max(1, Math.floor(u.maxHp * 0.34))) { s.injury = Math.max(s.injury || 0, 2); (sum.injured = sum.injured || []).push(s.name + ' (2 дн.)'); }
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
      if (out === 'victory') { sum.text = 'Нападение на базу отбито!'; G.log('Отряд отбил нападение на базу.'); st.stats.raids = (st.stats.raids || 0) + 1; }
      else {
        sum.text = 'Базу не удалось удержать. ' + G.raidLoss(G.raidWho(B.raidKind));
        // люди уводят поселенцев — их держат в лагере, откуда пришёл набег; отбить отдельным боем
        const src = B.raidFrom !== undefined && B.raidFrom !== null ? G.node(B.raidFrom) : null;
        if (B.raidKind && B.raidKind !== 'beast' && src && src.id !== st.baseNode && (st.militia || 0) > 0) {
          const k = Math.min(st.militia, U.rand(1, 2));
          st.militia -= k; src.captives = (src.captives || 0) + k; src.cleared = false; src.known = true;
          sum.text += ' Уведены поселенцы: ' + k + '. Их держат в «' + src.name + '» — можно отбить.';
          G.log('Поселенцы уведены в «' + src.name + '».');
        }
      }
      const mDead = B.units.filter(function (u) { return u.militia && !u.alive; }).length;
      if (mDead) { st.militia = Math.max(0, (st.militia || 0) - mDead); sum.text += ' Погибло ополченцев: ' + mDead + '.'; }
      if (B.relief) st.squadAt = st.baseNode;
      if (out === 'victory' && B.raidKind && G.FACS[B.raidKind]) G.repAdd(B.raidKind, -1);
    } else if (B.kind === 'caravan') {
      G.repAdd('raider', -1, 'ограблен караван');
      if (out === 'victory') { const lt = { food: 20, ammo: 60, gems: 12 + (B.diff || 1) * 3, meds: 2 }; for (const k in lt) add(k, lt[k]); sum.text = 'Караван разграблен. Охрана перебита — Институт об этом не узнает… наверное.'; st.trustHit = (st.trustHit || 0) + 1; G.log('Отряд ограбил караван.'); }
      else sum.text = 'Охрана каравана отбилась.';
      st.caravan = null;
    } else if (node) {
      // бой с группировкой портит отношения, разгром лагеря — тем более
      if (node.type === 'camp' && G.FACS[node.fac || 'raider']) {
        const f = node.fac || 'raider';
        G.repAdd(f, out === 'victory' ? -2 : -1, 'бой в «' + node.name + '»');
        sum.facHit = f;
      }
      if (B.kind === 'ambush' && out === 'victory' && node.drillThreat) { node.drillThreat = null; sum.text = 'Бур отбит.'; }
      if (out === 'victory') {
        if (!node.cleared) {
          node.cleared = true;
          if (node.type === 'lair') st.stats.lairs++;
          if (node.type === 'camp') st.stats.camps++;
          // Матка убита — веха: мутанты на время притихнут, но Гнездо со временем родит новую
          if (node.type === 'nest') {
            st.queenDead = true; st.queens = (st.queens || 0) + 1;
            if (st.queens === 1) st.milestone = 'win_nest';
            st.nestBack = st.day + U.rand(12, 18); st.calmUntil = st.day + 6;
          }
        }
        node.visited = true;
        sum.text = '«' + node.name + '» зачищено.';
        if (node.type === 'nest') sum.text += ' Матка мертва — мутанты притихнут на несколько дней. Но мёртвый мир родит новую.';
        if (node.captives) { st.militia = (st.militia || 0) + node.captives; sum.text += ' Пленные поселенцы освобождены (' + node.captives + ') и вернулись на базу.'; node.captives = 0; }
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
    // сюжетное задание: победа и цель выполнена
    if (node && node.quest && out === 'victory') {
      const q = G.questOf(node);
      const okGoal = !B.goal || B.goal.done || q.goal === 'boss';
      if (q && st.quests && st.quests[q.id] && !st.quests[q.id].done && okGoal) G.questReward(q, sum);
      if (q && st.quests[q.id] && st.quests[q.id].done) node.quest = null;
    }
    if ((B.vehicles || []).some(function (v) { return v.own && v.dead; })) { st.uaz = Object.assign(st.uaz || {}, { ok: false }); sum.uazLost = true; G.log('УАЗ подбит — нужен ремонт в гараже.'); }
    // справочник врагов: сколько каждого вида убито
    st.killsByType = st.killsByType || {};
    B.units.forEach(function (e) { if (e.side === 'e' && !e.alive && e.type) { st.killsByType[e.type] = (st.killsByType[e.type] || 0) + 1; st.metEnemies = st.metEnemies || {}; st.metEnemies[e.type] = 1; } });
    if (out === 'victory') st.stats.won++;
    // серия боёв без потерь, самый дальний смертельный выстрел
    st.stats.cleanRun = sum.dead.length ? 0 : (st.stats.cleanRun || 0) + 1;
    st.stats.deaths = (st.stats.deaths || 0) + sum.dead.length;
    if (B.stat && B.stat.longest > (st.stats.longest || 0)) st.stats.longest = B.stat.longest;
    sum.ach = G.checkAch();
    st.battle = null;
    if (st.roster.length === 0) st.over = 'lose';
    G.save();
    return sum;
  };

  DW.G = G;
})(window.DW);
