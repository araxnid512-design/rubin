/* Вкладка «Лагерь»: отсеки корабля, производство, запасы, отношения. */
(function (G) {
  'use strict';
  const { h, bar } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};

  function sectionRow(s, id) {
    const sec = s.sections[id];
    const T = G.TEXT.sections[id];
    const max = G.Base.maxLevel(id);
    const cost = G.Base.nextCost(s, id);
    const can = s.phase === 'orders' && G.Game.ordersLeft(s) > 0;
    const check = cost ? G.Base.canRepair(s, id) : null;
    return h('div', { class: 'section' },
      h('div', { class: 'row between' },
        h('div', null, h('b', null, T.name), ' ', h('span', { class: 'lvl' }, sec.level + '/' + max), ' — ', h('span', { class: sec.level ? 'good' : 'muted' }, T.levels[sec.level])),
        cost ? h('button', { class: 'btn small', disabled: !can || !check.ok, title: check.ok ? '' : check.reason, onclick: () => UI.openBuilder('repair', id) }, '⚙ Ремонт') : h('span', { class: 'good small' }, 'восстановлен')
      ),
      h('div', { class: 'small muted' }, T.desc + (UI.sectionEffect ? ' ' + UI.sectionEffect(s, id) : '')),
      cost ? h('div', { style: 'margin-top:6px' },
        bar(sec.progress, cost.work, 'sand'),
        h('div', { class: 'small' + (check.ok ? '' : ' warn') }, 'Следующий уровень «' + T.levels[sec.level + 1] + '»: ' +
          (sec.paid ? 'материалы заложены' : G.Res.costText(cost)) + ' · работы ' + Math.floor(sec.progress) + '/' + cost.work + ' чел.-дней')) : null
    );
  }

  UI.sectionEffect = function (s, id) {
    const C = G.CONFIG.sections[id];
    const lv = s.sections[id].level;
    switch (id) {
      case 'reactor': return 'Даёт ' + C.energy[lv] + ' энергии в сутки.';
      case 'vapor': return lv ? 'Даёт ' + C.water[lv] + ' л воды в сутки.' : '';
      case 'medbay': return lv ? 'Лечение +' + C.heal[lv] + ' в сутки.' : '';
      case 'sensors': return lv ? 'Налёты реже на ' + Math.round(C.raidReduce[lv] * 100) + '%.' : '';
      default: return '';
    }
  };

  UI.views.base = function (s) {
    const eProd = G.Base.energyProduction(s);
    const eUse = G.Base.energyUse(s);
    const kv = (k, v) => [h('span', { class: 'k' }, k), h('span', null, v)];
    const items = Object.keys(G.TEXT.items).filter((k) => s.items[k] > 0);
    return h('div', { class: 'cols' },
      h('div', null,
        h('div', { class: 'card' },
          h('h2', null, 'Отсеки «Железного Предела»'),
          h('p', { class: 'small muted' }, 'Ремонт — это приказ: выделите бойцов, и каждый день работ приближает восстановление. Материалы списываются в первый день.'),
          Object.keys(G.CONFIG.sections).map((id) => sectionRow(s, id))
        )
      ),
      h('div', null,
        h('div', { class: 'card' },
          h('h2', null, 'Хозяйство'),
          h('div', { class: 'kv' },
            kv('Реактор', '+' + eProd + ' энергии в сутки'),
            kv('Потребление', '−' + eUse + ' (лагерь ' + G.CONFIG.upkeep.baseEnergy + ', дроиды ' + (eUse - G.CONFIG.upkeep.baseEnergy) + ')'),
            kv('Ёмкость батарей', G.Res.energyCap(s) + ''),
            kv('Влагоуловители', '+' + G.Base.waterProduction(s) + ' л в сутки'),
            kv('Металл в обломках', '~' + s.regions.crash.scrap + ' ед.')
          )
        ),
        h('div', { class: 'card' },
          h('h2', null, 'Особые запасы'),
          items.length ? h('div', { class: 'kv' }, items.map((k) => kv(G.TEXT.items[k].name, '×' + s.items[k]))) : h('p', { class: 'muted' }, 'Пусто.'),
          h('p', { class: 'small muted', style: 'margin-top:8px' }, 'Бакта тратится сама на тяжелораненых. Модули связи нужны для восстановления узла дальней связи.')
        ),
        h('div', { class: 'card' },
          h('h2', null, 'Отношения'),
          ['jawa', 'hutt', 'tusken'].map((f) => {
            const v = s.relations[f];
            return h('div', { style: 'margin-bottom:8px' },
              h('div', { class: 'row between' }, h('span', null, G.TEXT.factions[f].name), h('span', { class: 'mono ' + (v > 10 ? 'good' : v < -10 ? 'bad' : '') }, (v > 0 ? '+' : '') + v)),
              bar(v + 100, 200, v >= 0 ? '' : 'red'),
              h('div', { class: 'small muted' }, G.TEXT.factions[f].desc));
          })
        )
      )
    );
  };
})(globalThis.G = globalThis.G || {});
