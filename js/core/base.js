/* База: отсеки корабля, их ремонт и производство. */
(function (G) {
  'use strict';

  const Base = {};

  Base.cfg = (id) => G.CONFIG.sections[id];
  Base.level = (s, id) => s.sections[id].level;
  Base.maxLevel = (id) => G.CONFIG.sections[id].levels.length - 1;
  Base.nextCost = function (s, id) {
    const sec = s.sections[id];
    const cfg = Base.cfg(id);
    if (sec.level >= Base.maxLevel(id)) return null;
    return cfg.levels[sec.level + 1];
  };

  // Можно ли начать или продолжить ремонт
  Base.canRepair = function (s, id) {
    const sec = s.sections[id];
    const cost = Base.nextCost(s, id);
    if (!cost) return { ok: false, reason: 'Отсек полностью восстановлен.' };
    if (sec.paid) return { ok: true };
    if (!G.Res.canPay(s, cost)) return { ok: false, reason: 'Не хватает материалов: ' + G.Res.costText(cost) + '.' };
    return { ok: true };
  };

  // Вклад работ; возвращает текст для доклада
  Base.work = function (s, id, points) {
    const sec = s.sections[id];
    const cost = Base.nextCost(s, id);
    const T = G.TEXT.sections[id];
    if (!cost) return T.name + ': ремонтировать больше нечего.';
    let pre = '';
    if (!sec.paid) {
      if (!G.Res.pay(s, cost)) return T.name + ': работы сорваны — не хватило материалов.';
      sec.paid = true;
      pre = 'Материалы заложены (' + G.Res.costText(cost) + '). ';
    }
    sec.progress += points;
    if (sec.progress >= cost.work) {
      sec.level++;
      sec.progress = 0;
      sec.paid = false;
      return pre + T.name + ' — ремонт завершён! Новое состояние: «' + T.levels[sec.level] + '».';
    }
    return pre + T.name + ': выполнено ' + Math.floor((sec.progress / cost.work) * 100) + '% работ.';
  };

  Base.energyProduction = (s) => G.CONFIG.sections.reactor.energy[s.sections.reactor.level] || 0;
  Base.waterProduction = (s) => G.CONFIG.sections.vapor.water[s.sections.vapor.level] || 0;
  Base.healBonus = (s) => G.CONFIG.sections.medbay.heal[s.sections.medbay.level] || 0;
  Base.deathMult = (s) => G.CONFIG.sections.medbay.deathMult[s.sections.medbay.level];

  Base.energyUse = function (s) {
    const up = G.CONFIG.upkeep;
    return up.baseEnergy + up.droidEnergy * G.Units.droids(s).length + (G.Progress ? G.Progress.energyUpkeep(s) : 0);
  };

  G.Base = Base;
})(globalThis.G = globalThis.G || {});
