/* Вкладка «Хроника»: всё, что случилось, по дням. */
(function (G) {
  'use strict';
  const { h } = G.Dom;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};
  UI.chronDays = 15;

  UI.views.chron = function (s) {
    const byDay = new Map();
    for (const e of s.chronicle) {
      if (!byDay.has(e.d)) byDay.set(e.d, []);
      byDay.get(e.d).push(e);
    }
    const days = Array.from(byDay.keys()).sort((a, b) => b - a);
    const shown = days.slice(0, UI.chronDays);
    const st = s.stats;
    return h('div', { class: 'cols' },
      h('div', { class: 'card' },
        h('h2', null, 'Хроника гарнизона'),
        shown.map((d) => h('div', { class: 'chron-day' },
          h('h3', null, d === 0 ? 'Крушение' : 'День ' + d),
          h('ul', { class: 'lines' }, byDay.get(d).map((e) => h('li', { class: 'k-' + e.k }, e.t))))),
        days.length > shown.length ? h('button', { class: 'btn', onclick: () => { UI.chronDays += 15; UI.render(); } }, 'Показать ещё') : null
      ),
      h('div', null, UI.replaysCard ? UI.replaysCard(s) : null, h('div', { class: 'card' },
        h('h2', null, 'Итоги'),
        h('div', { class: 'kv' }, [
          ['Дней на Татуине', s.day],
          ['Добыто сухарей', st.waterFound],
          ['Добыто металла', st.scrapFound + ' ед.'],
          ['Боёв', st.battles + ' (побед ' + st.victories + ')'],
          ['Уничтожено врагов', st.kills],
          ['Ночных налётов', st.raids],
          ['Погибло бойцов', st.deaths],
          ['Дезертировало', st.deserted]
        ].map(([k, v]) => [h('span', { class: 'k' }, k), h('span', null, String(v))]))
      ))
    );
  };
})(globalThis.G = globalThis.G || {});
