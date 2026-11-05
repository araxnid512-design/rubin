'use strict';
/* Простой бот для тестов: отдаёт приказы и закрывает все окна. */
const G = require('./load.js').load();

// Простой «бот»: каждый день добывает воду, разведывает и разбирает/ремонтирует
function botDay(s) {
  const water = G.Actions.defs.water.targets(s);
  if (water.length) G.Game.addOrder(s, G.Game.makeOrder(s, 'water', water[0], 12, 0));
  const recon = G.Actions.defs.recon.targets(s).filter((id) => s.regions[id].explored < 100);
  if (recon.length) G.Game.addOrder(s, G.Game.makeOrder(s, 'recon', recon[0], 5, 0));
  const rep = G.Actions.defs.repair.targets(s).filter((id) => G.Base.canRepair(s, id).ok);
  if (rep.length) G.Game.addOrder(s, G.Game.makeOrder(s, 'repair', rep[0], 12, 2));
  else G.Game.addOrder(s, G.Game.makeOrder(s, 'salvage', 'crash', 12, 2));
  G.Game.endDay(s);
  resolvePending(s);
}

// Закрыть все окна: торговля, события (первый доступный вариант), бои (быстрый расчёт)
function resolvePending(s) {
  let guard = 0;
  while (s.pending && guard++ < 50) {
    const p = s.pending;
    if (p.kind === 'trade') G.Game.act(s, { action: 'close' });
    else if (p.kind === 'event') {
      if (p.result != null) G.Game.act(s, { choice: 'continue' });
      else {
        const o = G.Events.options(s, p).find((x) => !x.blocked);
        G.Game.act(s, { choice: o.id });
      }
    } else if (p.kind === 'battle') G.Game.act(s, { action: 'quick' });
    else if (p.kind === 'battleResult') G.Game.act(s, { action: 'close' });
    else break;
  }
}

module.exports = { botDay, resolvePending };
