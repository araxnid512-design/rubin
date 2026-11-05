/* Модальные окна: торговля, конец игры. События и бои добавляются в своих модулях. */
(function (G) {
  'use strict';
  const { h, paragraphs } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.modals = UI.modals || {};

  const isRes = (k) => k === 'water' || k === 'scrap' || k === 'energy' || k === 'credits';
  const goodName = (k) => (isRes(k) ? G.TEXT.res[k].name : G.TEXT.items[k].name);
  const have = (s, k) => (isRes(k) ? s.res[k] : s.items[k] || 0);

  // ---------- Торговля ----------
  UI.modals.trade = function (s) {
    const p = s.pending;
    const cfg = G.CONFIG.trade[p.partner];
    const act = (payload) => { G.Game.act(s, payload); UI.commit(); };
    const rowsBuy = Object.keys(cfg.buy).map((k) => {
      const price = G.Trade.buyPrice(s, p.partner, k);
      const lock = G.Trade.locked(s, p.partner, k);
      const stock = p.stock[k] || 0;
      const steps = isRes(k) ? [10, 50] : [1];
      return h('div', { class: 'trade-row' },
        h('div', null,
          h('div', null, h('b', null, goodName(k)), ' — ', h('span', { class: 'mono' }, price + ' кр.'), isRes(k) ? ' за ед.' : ''),
          h('div', { class: 'small muted' }, lock || ('в наличии: ' + stock + ' · у нас: ' + have(s, k)))),
        h('div', { class: 'tb' }, steps.map((n) =>
          h('button', { class: 'btn small', disabled: !!lock || stock <= 0 || s.res.credits < price, onclick: () => act({ action: 'buy', good: k, n: n }) }, 'Купить ' + n)))
      );
    });
    const rowsSell = Object.keys(cfg.sell).map((k) => {
      const price = G.Trade.sellPrice(s, p.partner, k);
      const n = have(s, k);
      const steps = isRes(k) ? [10, 50] : [1];
      return h('div', { class: 'trade-row' },
        h('div', null,
          h('div', null, h('b', null, goodName(k)), ' — ', h('span', { class: 'mono' }, price + ' кр.'), isRes(k) ? ' за ед.' : ''),
          h('div', { class: 'small muted' }, 'у нас: ' + n)),
        h('div', { class: 'tb' }, steps.map((m) =>
          h('button', { class: 'btn small', disabled: n <= 0, onclick: () => act({ action: 'sell', good: k, n: m }) }, 'Продать ' + m)))
      );
    });
    return h('div', { class: 'modal' },
      h('h2', null, G.TEXT.tradePartners[p.partner]),
      h('p', { class: 'lead' }, G.TEXT.tradeFlavor[p.partner]),
      h('div', { class: 'row', style: 'gap:14px;margin-bottom:8px' },
        h('span', { class: 'chip' }, h('i', { class: 'ico ico-credits' }), s.res.credits + ' кр.'),
        h('span', { class: 'chip' }, h('i', { class: 'ico ico-water' }), s.res.water + ' л'),
        h('span', { class: 'chip' }, h('i', { class: 'ico ico-scrap' }), s.res.scrap)),
      h('h3', null, 'Купить'), rowsBuy,
      h('h3', { style: 'margin-top:12px' }, 'Продать'), rowsSell,
      h('button', { class: 'btn primary big', style: 'margin-top:14px', onclick: () => act({ action: 'close' }) }, 'Завершить торговлю')
    );
  };

  // ---------- Событие ----------
  UI.modals.event = function (s) {
    const p = s.pending;
    const act = (choice) => { G.Game.act(s, { choice: choice }); UI.commit(); };
    const box = h('div', { class: 'modal' },
      h('div', { class: 'small muted' }, 'День ' + s.day),
      h('h2', null, p.title),
      h('div', { class: 'lead' }, paragraphs(p.text)));
    if (p.result == null) {
      box.appendChild(h('div', { class: 'choices' }, G.Events.options(s, p).map((o) =>
        h('button', { class: 'choice', disabled: !!o.blocked, onclick: () => act(o.id) },
          h('div', { class: 'cn' }, o.label),
          o.blocked || o.hint ? h('div', { class: 'ch' + (o.blocked ? ' bad' : '') }, o.blocked || o.hint) : null))));
    } else {
      box.appendChild(h('div', { class: 'card flat' },
        h('div', { class: 'small muted', style: 'margin-bottom:6px' }, 'Решение: ' + p.choice),
        h('p', { style: 'margin:0' }, p.result)));
      box.appendChild(h('button', { class: 'btn primary big', onclick: () => act('continue') }, 'Продолжить'));
    }
    return box;
  };

  // ---------- Конец игры ----------
  UI.modals.over = function (s) {
    const E = G.TEXT.endings[s.over.reason] || { title: 'Конец', text: '' };
    const st = s.stats;
    const alive = G.Units.people(s).length;
    return h('div', { class: 'modal' },
      h('h2', { class: s.over.type === 'victory' ? 'good' : 'bad' }, E.title),
      h('div', { class: 'lead' }, paragraphs(E.text)),
      h('div', { class: 'kv', style: 'margin:10px 0' }, [
        ['Дней на Татуине', s.day],
        ['Выжило', U.pl(alive, U.FORMS.man)],
        ['Погибло', st.deaths],
        ['Побед в боях', st.victories + ' из ' + st.battles],
        ['Сложность', { easy: 'лёгкая', normal: 'обычная', hard: 'тяжёлая' }[s.difficulty]],
      ].map(([k, v]) => [h('span', { class: 'k' }, k), h('span', null, String(v))])),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { UI.overSeen = true; UI.go('chron'); } }, 'Посмотреть хронику'),
        h('button', { class: 'btn primary', onclick: () => { UI.s = null; UI.overSeen = false; UI.titleState.mode = 'main'; UI.render(); } }, 'В главное меню'))
    );
  };

  // ---------- Подтверждение ----------
  UI.confirm = function (title, text, onYes) {
    UI.overlay = () => h('div', { class: 'modal' },
      h('h2', null, title),
      h('p', { class: 'lead' }, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { UI.overlay = null; UI.render(); } }, 'Отмена'),
        h('button', { class: 'btn primary', onclick: () => { UI.overlay = null; onYes(); } }, 'Да')));
    UI.render();
  };
})(globalThis.G = globalThis.G || {});
