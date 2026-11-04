// Прогресс игрока в localStorage. Хранилище может быть недоступно —
// тогда игра идёт без сохранения (все обращения в try/catch).
(function () {
  const KEY = 'styx-road-save-v1';

  function fresh() {
    return {
      v: 1,
      sporans: 0,
      peas: 0,
      pearls: 0,
      level: 0,                    // текущий (самый дальний открытый) уровень
      levels: {},                  // id → { best, checkpoint, done }
      car: 'sedan',
      cars: { sedan: { owned: true, upgrades: {}, fuel: null, hp: null, weapons: {} } },
      stats: { runs: 0, kills: 0, distance: 0 },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      const data = JSON.parse(raw);
      return Object.assign(fresh(), data);
    } catch (e) {
      return fresh();
    }
  }

  function write(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* нет хранилища */ }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* нет хранилища */ }
    return fresh();
  }

  function levelState(state, id) {
    if (!state.levels[id]) state.levels[id] = { best: 0, checkpoint: 0, done: false };
    return state.levels[id];
  }

  window.Save = { load, write, reset, levelState, fresh };
})();
