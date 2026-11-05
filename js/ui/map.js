/* Вкладка «Карта»: условная схема окрестностей и сведения о районах. */
(function (G) {
  'use strict';
  const { h, svg } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};
  UI.mapSel = 'crash';

  const Y = (y) => 4 + y * 0.68;

  function nodeShape(kind, x, y, sel) {
    const stroke = sel ? '#f3cd8c' : '#0d0e10';
    const sw = sel ? 0.7 : 0.4;
    if (kind === 'base') return svg('rect', { x: x - 2, y: y - 2, width: 4, height: 4, fill: '#d9a85b', stroke, 'stroke-width': sw });
    if (kind === 'hostile') return svg('polygon', { points: (x) + ',' + (y - 2.8) + ' ' + (x + 2.6) + ',' + (y + 2) + ' ' + (x - 2.6) + ',' + (y + 2), fill: '#e2574c', stroke, 'stroke-width': sw });
    if (kind === 'town') return svg('circle', { cx: x, cy: y, r: 2.4, fill: '#6fb3e0', stroke, 'stroke-width': sw });
    return svg('circle', { cx: x, cy: y, r: 2, fill: '#c9b48c', stroke, 'stroke-width': sw });
  }

  function drawMap(s) {
    const C = G.CONFIG.regions;
    const T = G.TEXT.regions;
    const root = svg('svg', { viewBox: '0 0 100 75', preserveAspectRatio: 'xMidYMid meet' });
    // Фон: условные дюны
    root.appendChild(svg('rect', { x: 0, y: 0, width: 100, height: 75, fill: '#17140e' }));
    for (let i = 0; i < 8; i++) {
      const yy = 8 + i * 9;
      root.appendChild(svg('path', { d: 'M0 ' + yy + ' Q 25 ' + (yy - 3) + ' 50 ' + yy + ' T 100 ' + yy, fill: 'none', stroke: '#2a2316', 'stroke-width': 0.5 }));
    }
    const known = (id) => s.regions[id] && s.regions[id].known;
    // Связи
    const hints = new Set();
    for (const id in C) {
      if (!known(id)) continue;
      for (const [link] of C[id].links || []) {
        if (C[link].hidden && !known(link)) continue;
        const a = T[id], b = T[link];
        const both = known(link);
        if (!both) hints.add(link);
        root.appendChild(svg('line', { x1: a.x, y1: Y(a.y), x2: b.x, y2: Y(b.y), stroke: both ? '#5b4a2e' : '#3a3122', 'stroke-width': both ? 0.5 : 0.4, 'stroke-dasharray': both ? null : '1 1' }));
      }
    }
    // Неизвестные места
    for (const id of hints) {
      const t = T[id];
      root.appendChild(svg('g', null,
        svg('circle', { cx: t.x, cy: Y(t.y), r: 1.8, fill: '#26211a', stroke: '#4a3f2c', 'stroke-width': 0.3 }),
        txt(t.x, Y(t.y) + 0.9, '?', '#8a7a5a', 2.4)));
    }
    // Известные места
    for (const id in C) {
      if (!known(id)) continue;
      const t = T[id];
      const g = svg('g', { class: 'map-node', onclick: () => { UI.mapSel = id; UI.render(); } },
        svg('circle', { cx: t.x, cy: Y(t.y), r: 5, fill: 'transparent' }),
        nodeShape(C[id].kind, t.x, Y(t.y), UI.mapSel === id),
        s.regions[id].cleared ? txt(t.x, Y(t.y) + 0.9, '✕', '#0d0e10', 2.6) : null,
        label(t, UI.mapSel === id));
      root.appendChild(g);
    }
    return root;
  }

  // Подпись места: у краёв карты выравниваем внутрь; labelUp — подпись над значком
  function label(t, sel) {
    const anchor = t.x >= 85 ? 'end' : t.x <= 20 ? 'start' : 'middle';
    const x = anchor === 'end' ? t.x + 2.6 : anchor === 'start' ? t.x - 2.6 : t.x;
    const y = t.labelUp ? Y(t.y) - 3.4 : Y(t.y) + 5;
    return txt(x, y, t.short || t.name, sel ? '#f3cd8c' : '#d8cfbd', 2.2, anchor);
  }

  function txt(x, y, str, fill, size, anchor) {
    const el = svg('text', { x: x, y: y, 'text-anchor': anchor || 'middle', fill: fill, 'font-size': size, 'font-family': 'system-ui, sans-serif' });
    el.textContent = str;
    return el;
  }

  function dots(n, max) {
    let str = '';
    for (let i = 0; i < max; i++) str += i < n ? '●' : '○';
    return str;
  }

  function regionCard(s, id) {
    const c = G.CONFIG.regions[id];
    const r = s.regions[id];
    const T = G.TEXT.regions[id];
    const kindName = { base: 'Наш лагерь', wild: 'Пустошь', town: 'Поселение', hostile: 'Вражеский лагерь' }[c.kind];
    const card = h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, T.name), h('span', { class: 'muted small' }, kindName + (r.cleared ? ' · разгромлен' : ''))),
      h('p', null, r.visits || id === 'crash' || r.explored > 0 ? T.desc : 'Сведений почти нет. Нужна разведка.'),
      h('div', { class: 'region-stats' },
        id !== 'crash' ? h('div', null, h('span', { class: 'muted' }, 'Разведано: '), r.explored + '%') : null,
        c.water ? h('div', null, h('span', { class: 'muted' }, 'Вода: '), h('span', { class: 'dots' }, dots(c.water, 4)), r.explored >= 20 ? ' ~' + r.water + ' л' : '') : null,
        c.scrap ? h('div', null, h('span', { class: 'muted' }, 'Металл: '), h('span', { class: 'dots' }, dots(c.scrap, 3)), ' ~' + r.scrap) : null,
        c.danger ? h('div', null, h('span', { class: 'muted' }, 'Опасность: '), h('span', { class: 'dots bad' }, dots(c.danger, 4))) : null,
        c.dist ? h('div', null, h('span', { class: 'muted' }, 'Путь: '), U.pl(c.dist, ['час', 'часа', 'часов']) + ' по жаре') : null
      )
    );
    const btns = [];
    for (const type of ['recon', 'water', 'salvage', 'trade', 'attack']) {
      const def = G.Actions.defs[type];
      if (!def.targets || def.targets(s).indexOf(id) < 0) continue;
      const can = s.phase === 'orders' && G.Game.ordersLeft(s) > 0;
      btns.push(h('button', { class: 'btn small', disabled: !can, onclick: () => UI.openBuilder(type, id) }, G.TEXT.actions[type].icon + ' ' + G.TEXT.actions[type].name));
    }
    if (btns.length) card.appendChild(h('div', { class: 'row' }, btns));
    return card;
  }

  // Фракции: отношения, статус, что даёт дружба
  function factionsCard(s) {
    const F = G.Factions;
    const dip = G.Actions.defs.diplomacy;
    const canDip = dip.targets ? dip.targets(s) : [];
    const can = s.phase === 'orders' && G.Game.ordersLeft(s) > 0;
    const rows = F.list.map((f) => {
      const T = G.TEXT.factions[f];
      const v = F.rel(s, f);
      const met = F.contact(s, f) || s.flags['hostile_' + f] || v !== (G.CONFIG.start.relations[f] || 0);
      const st = F.status(v);
      const pct = Math.max(0, Math.min(100, (v + 100) / 2));
      return h('div', { class: 'fac-row' + (met ? '' : ' fac-unknown') },
        h('span', { class: 'fac-icon' }, T.icon || '•'),
        h('div', { class: 'fac-main' },
          h('div', { class: 'row between' },
            h('b', null, T.name),
            h('span', { class: 'small ' + st.cls }, met ? st.word + ' ' + (v > 0 ? '+' : '') + v : 'нет связи')),
          h('div', { class: 'fac-bar' }, h('i', { class: v < 0 ? 'neg' : 'pos', style: v < 0 ? 'left:' + pct + '%;width:' + (50 - pct) + '%' : 'left:50%;width:' + (pct - 50) + '%' })),
          met ? h('div', { class: 'small muted' }, F.perks(s, f)) : null),
        canDip.indexOf(f) >= 0 ? h('button', { class: 'btn small', disabled: !can, title: 'Переговоры', onclick: () => UI.openBuilder('diplomacy', f) }, '✉') : null
      );
    });
    return h('div', { class: 'card' }, h('h2', null, 'Фракции'), rows);
  }

  UI.views.map = function (s) {
    if (!s.regions[UI.mapSel] || !s.regions[UI.mapSel].known) UI.mapSel = 'crash';
    return h('div', { class: 'cols' },
      h('div', null,
        h('div', { class: 'mapwrap' }, drawMap(s)),
        h('p', { class: 'small muted', style: 'margin-top:6px' }, '■ лагерь · ● пустошь · ◉ поселение · ▲ враг · ? неразведанное место. Нажмите на место, чтобы увидеть сведения.')
      ),
      h('div', null, regionCard(s, UI.mapSel), factionsCard(s))
    );
  };
})(globalThis.G = globalThis.G || {});
