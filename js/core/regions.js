/* Регионы Татуина: открытие, разведка, запасы провизии и металла. */
(function (G) {
  'use strict';

  const Regions = {};

  Regions.cfg = (id) => G.CONFIG.regions[id];
  Regions.name = (id) => G.TEXT.regions[id].name;
  Regions.known = (s) => Object.keys(s.regions).filter((id) => s.regions[id].known);

  Regions.reveal = function (s, id, silent) {
    const r = s.regions[id];
    if (!r || r.known) return false;
    r.known = true;
    if (!silent) G.Game.say(s, 'На карте отмечено новое место: ' + Regions.name(id) + '.', 'good');
    return true;
  };

  // Увеличить разведанность; открыть связанные регионы
  Regions.explore = function (s, id, amount) {
    const r = s.regions[id];
    const cfg = Regions.cfg(id);
    const before = r.explored;
    r.explored = Math.min(100, r.explored + Math.round(amount));
    for (const [link, threshold] of cfg.links || []) {
      const lc = Regions.cfg(link);
      if (lc.hidden) continue;
      if (r.explored >= threshold && !s.regions[link].known) Regions.reveal(s, link);
    }
    return r.explored - before;
  };

  // Ежедневное восстановление запасов провизии
  Regions.regen = function (s) {
    for (const id in s.regions) {
      const cfg = Regions.cfg(id);
      if (cfg.waterRegen) s.regions[id].water = Math.min(cfg.waterPool, s.regions[id].water + cfg.waterRegen);
    }
  };

  Regions.canTrade = function (s, id) {
    const cfg = Regions.cfg(id);
    if (!cfg.trade || !s.regions[id].known || s.regions[id].cleared) return false;
    const t = G.CONFIG.trade[cfg.trade];
    if (t && t.minRelation != null && (s.relations[t.faction] || 0) < t.minRelation) return false;
    return s.regions[id].explored >= G.CONFIG.actions.trade.needExplored;
  };

  // Оценка богатства для интерфейса: 0..4 → «нет / мало / есть / много / очень много»
  Regions.richLabel = function (v) {
    return ['нет', 'мало', 'есть', 'много', 'очень много'][v || 0];
  };
  Regions.dangerLabel = function (v) {
    return ['нет', 'низкая', 'средняя', 'высокая', 'смертельная'][v || 0];
  };

  G.Regions = Regions;
})(globalThis.G = globalThis.G || {});
