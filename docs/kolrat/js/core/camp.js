/*
 * Обустройство лагеря: постройки на поле перед корпусом корабля.
 * Сетка — та же, что поле боя при обороне лагеря: что построил — то и увидишь в бою.
 * s.camp = { items: [{ id, t, x, y }], kits: { turret }, seq }
 */
(function (G) {
  'use strict';

  const Camp = {};
  const CFG = () => G.CONFIG.camp;
  const T = () => G.BattleMap.T;

  Camp.ensure = function (s) {
    if (!s.camp) s.camp = { items: [], kits: { turret: 0 }, seq: 0 };
    s.camp.kits = s.camp.kits || { turret: 0 };
    return s.camp;
  };

  // Местность лагеря неизменна для кампании: обломки, дюны и скалы всегда на тех же местах
  let baseCache = { seed: null, map: null };
  Camp.baseMap = function (s) {
    if (baseCache.seed !== s.seed) {
      baseCache = { seed: s.seed, map: G.BattleMap.generate({ type: 'camp', campSeed: s.seed }, G.Rng.make(s.seed)) };
    }
    return baseCache.map;
  };

  Camp.count = (s, t) => Camp.ensure(s).items.filter((it) => it.t === t).length;
  Camp.at = (s, x, y) => Camp.ensure(s).items.find((it) => it.x === x && it.y === y) || null;
  Camp.inZone = (x, y) => x >= CFG().zone.x0 && x <= CFG().zone.x1 && y >= 0 && y < G.CONFIG.battle.h;

  // Карта лагеря с постройками (для боя и для экрана базы)
  Camp.layout = (s) => Camp.ensure(s).items.map((it) => ({ t: it.t, x: it.x, y: it.y }));

  Camp.applyLayout = function (m, layout) {
    const t = T();
    for (const it of layout || []) {
      const c = CFG().items[it.t];
      if (!c) continue;
      const v = c.cell === 'wall' || c.cell === 'low' ? t.WALL : c.cell === 'block' ? t.WRECK : null;
      if (v != null) m.cells[it.y * m.w + it.x] = v;
    }
  };

  // Проход от правого края до лагеря не должен быть перекрыт целиком
  function connected(m) {
    const BM = G.BattleMap;
    const seen = new Uint8Array(m.w * m.h);
    const q = [];
    for (let y = 0; y < m.h; y++) if (BM.passable(m.cells[y * m.w + m.w - 1])) { seen[y * m.w + m.w - 1] = 1; q.push(y * m.w + m.w - 1); }
    while (q.length) {
      const i = q.shift();
      const x = i % m.w, y = (i / m.w) | 0;
      if (x <= CFG().zone.x0) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        const j = ny * m.w + nx;
        if (!seen[j] && BM.passable(m.cells[j])) { seen[j] = 1; q.push(j); }
      }
    }
    return false;
  }

  // Почему нельзя построить (null — можно)
  Camp.canBuild = function (s, t, x, y) {
    const c = CFG().items[t];
    if (!c) return 'неизвестная постройка';
    if (s.pending || s.over) return 'сейчас нельзя';
    if (c.need && s.sections[c.need[0]].level < c.need[1]) return 'нужен отсек «' + G.TEXT.sections[c.need[0]].name + '»';
    if (Camp.count(s, t) >= c.max) return 'не больше ' + c.max;
    if (c.kit && !(Camp.ensure(s).kits[t] > 0)) return 'нет комплекта — ищите при разборе обломков';
    if (!G.Res.canPay(s, c.cost)) return 'нужно: ' + G.Res.costText(c.cost);
    if (x == null) return null;
    if (!Camp.inZone(x, y)) return 'строить можно только перед корпусом';
    const base = Camp.baseMap(s);
    if (!G.BattleMap.passable(base.cells[y * base.w + x])) return 'место занято обломками или скалой';
    if (Camp.at(s, x, y)) return 'место занято';
    if (c.cell !== 'unit') {
      const m = { w: base.w, h: base.h, cells: base.cells.slice() };
      Camp.applyLayout(m, Camp.layout(s).concat([{ t: t, x: x, y: y }]));
      if (!connected(m)) return 'нельзя перекрывать все проходы к лагерю';
    }
    return null;
  };

  Camp.build = function (s, t, x, y) {
    const err = Camp.canBuild(s, t, x, y);
    if (err) return err;
    const c = CFG().items[t];
    const camp = Camp.ensure(s);
    G.Res.pay(s, c.cost);
    if (c.kit) camp.kits[t]--;
    camp.items.push({ id: ++camp.seq, t: t, x: x, y: y });
    G.Game.chron(s, s.day, 'Построено: ' + G.TEXT.camp[t].name.toLowerCase() + '.', 'good');
    return null;
  };

  Camp.demolish = function (s, id) {
    const camp = Camp.ensure(s);
    const it = camp.items.find((i) => i.id === id);
    if (!it || s.pending || s.over) return;
    const c = CFG().items[it.t];
    for (const k of ['scrap', 'energy']) if (c.cost[k]) G.Res.add(s, k, Math.floor(c.cost[k] * CFG().refund));
    if (c.kit) camp.kits[it.t]++;
    camp.items = camp.items.filter((i) => i !== it);
  };

  // ---------- эффекты построек ----------
  Camp.water = (s) => Camp.count(s, 'vapor') * CFG().items.vapor.water;
  Camp.energy = (s) => Camp.count(s, 'panel') * CFG().items.panel.energy;
  Camp.upkeep = function (s) {
    let e = 0;
    for (const it of Camp.ensure(s).items) e += CFG().items[it.t].upkeep || 0;
    return e;
  };
  Camp.heal = (s) => Camp.count(s, 'tent') * CFG().items.tent.heal;
  Camp.raidMult = (s) => Math.max(0.5, 1 - Camp.count(s, 'mast') * CFG().items.mast.raid);
  Camp.nightBonus = (s) => Camp.count(s, 'lamp') * CFG().items.lamp.night;

  // ---------- переход со старых сохранений ----------
  Camp.migrate = function (s) {
    Camp.ensure(s);
    const walls = (s.fort && s.fort.walls) || 0;
    if (walls && !s.camp.migrated) {
      const rows = [7, 8, 5, 10, 3, 12, 6, 9, 2, 13, 4, 11];
      for (let i = 0; i < Math.min(walls, rows.length); i++) placeNear(s, 'wall', 10, rows[i]);
    }
    for (const v of (s.vehicles || []).filter((x) => x.type === 'turret')) {
      if (v.ok) placeNear(s, 'turret', 11, 4 + (s.camp.items.length % 8)); else s.camp.kits.turret++;
    }
    s.vehicles = (s.vehicles || []).filter((x) => x.type !== 'turret');
    s.camp.migrated = true;
  };
  function placeNear(s, t, x0, y0) {
    const base = Camp.baseMap(s);
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (!Camp.inZone(x, y) || y < 0 || y >= base.h) continue;
        if (!G.BattleMap.passable(base.cells[y * base.w + x]) || Camp.at(s, x, y)) continue;
        s.camp.items.push({ id: ++s.camp.seq, t: t, x: x, y: y });
        return true;
      }
    }
    return false;
  }

  G.Camp = Camp;
})(globalThis.G = globalThis.G || {});
