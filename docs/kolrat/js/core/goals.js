/*
 * Цели и финал: дальняя связь и вызов флота, шаттл, концовки, итоговый счёт.
 * Путь 1: узел дальней связи до уровня 3 → приказ «Вызвать флот» → продержаться N дней → последний бой.
 * Путь 2: ангар → ремонт шаттла (детали гипердвигателя и топливо) → приказ «Старт шаттла».
 */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;

  const Goals = {};
  const FC = () => G.CONFIG.final;

  Goals.commsReady = (s) => s.sections.comms.level >= G.Base.maxLevel('comms');
  Goals.daysToFleet = (s) => (s.signal ? Math.max(0, s.signal.eta - s.day) : null);

  // Модулей связи ещё нужно для всех оставшихся уровней узла
  Goals.modulesNeeded = function (s) {
    const lv = s.sections.comms.level;
    const levels = G.CONFIG.sections.comms.levels;
    let need = 0;
    for (let i = lv + 1; i < levels.length; i++) if (levels[i].items && levels[i].items.commModule) need += levels[i].items.commModule;
    if (s.sections.comms.paid) {
      const cur = levels[lv + 1];
      if (cur && cur.items && cur.items.commModule) need -= cur.items.commModule;
    }
    return Math.max(0, need);
  };

  Goals.end = function (s, reason) {
    if (s.over) return;
    const type = reason === 'abandon' || reason === 'dead' || reason === 'mutiny' ? 'defeat' : 'victory';
    s.over = { type: type, reason: reason, day: s.day };
    G.Game.chron(s, s.day, G.TEXT.endings[reason].title, type === 'victory' ? 'good' : 'bad');
  };

  Goals.score = function (s) {
    const S = G.CONFIG.score;
    if (!s.over) return 0;
    const alive = G.Units.people(s).length;
    let v = (S.base[s.over.reason] || 0) + alive * S.survivor + s.stats.kills * S.kill + s.stats.deaths * S.death + s.day * S.day;
    if (s.over.type !== 'victory') v = Math.min(v, alive * 5 + s.day * 2);
    return Math.max(0, Math.round(v * (S.diffMult[s.difficulty] || 1)));
  };

  Goals.endingVars = function (s) {
    return {
      day: s.day,
      alive: U.pl(G.Units.people(s).length, F.man),
      aliveN: G.Units.people(s).length,
      dead: s.stats.deaths,
      capacity: FC().shuttleCapacity,
      left: Math.max(0, G.Units.people(s).length - FC().shuttleCapacity),
    };
  };

  // Вызывается при планировании дня: прибытие флота
  Goals.planDay = function (s) {
    if (s.signal && s.day >= s.signal.eta && !s.flags.fleetEvent) {
      s.flags.fleetEvent = true;
      s.queue.push({ step: 'event', id: 'fleet_arrival', ctx: {} });
    }
  };

  // Ночью после сигнала — шанс удара повстанцев
  Goals.night = function (s, rng) {
    if (!s.signal || s.flags.fleetEvent) return false;
    if (!rng.chance(FC().strikeChance)) return false;
    G.Events.queueNow(s, 'rebel_strike', { strength: FC().strikeStrength });
    return true;
  };

  // ---------- Приказы ----------
  const defs = G.Actions.defs;
  defs.signal = {
    noSquad: true,
    targets: null,
    hidden: (s) => !Goals.commsReady(s) || !!s.signal,
    validate(s) {
      if (!Goals.commsReady(s)) return 'Узел дальней связи ещё не восстановлен.';
      if (s.signal) return 'Сигнал уже отправлен.';
      if (s.orders.some((o) => o.type === 'signal')) return 'Приказ уже отдан.';
      return null;
    },
    preview(s) {
      const d = FC().fleetDays - (s.flags.fleetSector ? FC().sectorBonusDays : 0);
      return 'Флот прибудет примерно через ' + U.pl(d, F.day) + '. Сигнал услышат все в округе — налёты участятся.';
    },
    resolve(s) {
      const d = FC().fleetDays - (s.flags.fleetSector ? FC().sectorBonusDays : 0);
      s.signal = { day: s.day, eta: s.day + d };
      G.Res.discipline(s, 10);
      G.Game.say(s, 'В эфир ушёл сигнал бедствия на частоте флота. Через несколько часов пришёл ответ: «Принято. Ждите. ' + U.pl(d, F.day) + '». ' +
        'Лагерь взорвался криками — а генерал приказал удвоить посты: теперь о нас знает не только флот.', 'good');
    },
  };
  defs.launch = {
    noSquad: true,
    targets: null,
    hidden: (s) => !s.shuttleReady,
    validate(s) {
      if (!s.shuttleReady) return 'Шаттл не готов.';
      if (s.orders.some((o) => o.type === 'launch')) return 'Приказ уже отдан.';
      return null;
    },
    preview(s) {
      const n = G.Units.people(s).length;
      const cap = FC().shuttleCapacity;
      return n <= cap ? 'На борт поместятся все ' + U.pl(n, F.man) + '.' : 'Мест на борту: ' + cap + '. Людей: ' + n + '. Кому-то придётся остаться.';
    },
    resolve(s) { G.Events.queueNow(s, 'shuttle_launch', {}); },
  };
  G.Actions.list.push('signal', 'launch');

  G.Goals = Goals;
})(globalThis.G = globalThis.G || {});
