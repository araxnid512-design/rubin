/* Вкладка «Карта»: условная схема окрестностей и сведения о районах. */
(function (G) {
  'use strict';
  const { h, svg } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};
  UI.mapSel = 'crash';

  const Y = (y) => 4 + y * 0.68;
  const XLINK = 'http://www.w3.org/1999/xlink';
  function hr(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function image(url, x, y, w, hgt, extra) {
    const el = svg('image', Object.assign({ x: x, y: y, width: w, height: hgt, preserveAspectRatio: 'none' }, extra || {}));
    el.setAttribute('href', url);
    el.setAttributeNS(XLINK, 'xlink:href', url);
    return el;
  }

  // Рисованная подложка карты: песок, гряды дюн, скалы у скальных мест, соль, вода оазиса. Рисуется один раз.
  let bgUrl = null;
  function background() {
    if (bgUrl) return bgUrl;
    if (typeof document === 'undefined') return '';
    const K = 10, W = 100 * K, H = 75 * K;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const T = G.TEXT.regions, C = G.CONFIG.regions;
    const P = (id) => [T[id].x * K, Y(T[id].y) * K];
    const g = c.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#6a4a2c'); g.addColorStop(0.5, '#8a6238'); g.addColorStop(1, '#5e4026');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // крапинки песка
    for (let k = 0; k < 2600; k++) {
      c.fillStyle = hr(k) > 0.5 ? 'rgba(255,220,160,0.08)' : 'rgba(40,24,10,0.1)';
      c.fillRect(hr(k + 11) * W, hr(k + 23) * H, 2, 2);
    }
    // гряды дюн: светлый гребень и тень
    for (let k = 0; k < 34; k++) {
      const x0 = hr(k + 300) * W - 80, y0 = hr(k + 400) * H, len = 120 + hr(k + 500) * 220, bend = (hr(k + 600) - 0.5) * 60;
      c.strokeStyle = 'rgba(40,22,8,0.28)'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(x0, y0 + 5); c.quadraticCurveTo(x0 + len / 2, y0 + bend + 5, x0 + len, y0 + 5); c.stroke();
      c.strokeStyle = 'rgba(255,214,150,0.22)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + len / 2, y0 + bend, x0 + len, y0); c.stroke();
    }
    // скалы около скалистых и каньонных мест
    const rocky = Object.keys(C).filter((id) => ['rocks', 'canyon', 'fort'].indexOf(C[id].terrain) >= 0 && T[id]);
    rocky.forEach((id, j) => {
      const [cx, cy] = P(id);
      for (let k = 0; k < 6; k++) {
        const a = hr(j * 50 + k) * Math.PI * 2, d = 50 + hr(j * 50 + k + 7) * 60;
        const gx = cx + Math.cos(a) * d, gy = cy + Math.sin(a) * d * 0.7;
        for (let q = 0; q < 4; q++) {
          const x = gx + (hr(j * 90 + k * 7 + q) - 0.5) * 30, y = gy + (hr(j * 90 + k * 7 + q + 3) - 0.5) * 18, r = 5 + hr(j * 90 + k * 7 + q + 5) * 8;
          const pts = [];
          for (let e = 0; e < 6; e++) { const b = e / 6 * Math.PI * 2, rr = r * (0.7 + hr(k * 13 + q * 5 + e) * 0.5); pts.push([x + Math.cos(b) * rr, y + Math.sin(b) * rr * 0.7]); }
          const poly = (dx, dy) => { c.beginPath(); pts.forEach(([px, py], e) => (e ? c.lineTo(px + dx, py + dy) : c.moveTo(px + dx, py + dy))); c.closePath(); };
          c.fillStyle = 'rgba(30,18,10,0.4)'; poly(3, 4); c.fill();
          c.fillStyle = '#6e5038'; poly(0, 0); c.fill();
          c.fillStyle = 'rgba(200,160,110,0.35)'; c.beginPath(); c.moveTo(pts[3][0], pts[3][1]); c.lineTo(pts[4][0], pts[4][1]); c.lineTo(pts[5][0], pts[5][1]); c.lineTo(x, y); c.closePath(); c.fill();
        }
      }
    });
    // трещина ущелья: от каньона к пещерам
    if (T.canyon && T.windcaves) {
      const [x1, y1] = P('canyon'), [x2, y2] = P('windcaves');
      c.strokeStyle = 'rgba(20,10,4,0.55)'; c.lineWidth = 14; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x1 + 40, y1 - 60); c.quadraticCurveTo(x1 - 30, (y1 + y2) / 2, x2, y2 + 30); c.stroke();
      c.strokeStyle = 'rgba(160,110,70,0.3)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x1 + 46, y1 - 60); c.quadraticCurveTo(x1 - 24, (y1 + y2) / 2, x2 + 6, y2 + 30); c.stroke();
    }
    // соляная чаша
    if (T.saltflat) {
      const [x, y] = P('saltflat');
      const sg = c.createRadialGradient(x, y, 10, x, y, 110);
      sg.addColorStop(0, 'rgba(245,245,240,0.75)'); sg.addColorStop(0.7, 'rgba(230,228,220,0.35)'); sg.addColorStop(1, 'rgba(230,228,220,0)');
      c.fillStyle = sg; c.beginPath(); c.ellipse(x, y, 120, 70, 0.2, 0, 7); c.fill();
      c.strokeStyle = 'rgba(150,150,150,0.35)'; c.lineWidth = 1.2;
      for (let k = 0; k < 14; k++) { const a = hr(k + 900) * 7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 80, y + Math.sin(a) * 45); c.stroke(); }
    }
    // вода оазиса и зелень
    if (T.oasis) {
      const [x, y] = P('oasis');
      c.fillStyle = 'rgba(70,110,50,0.55)'; c.beginPath(); c.ellipse(x + 10, y + 4, 70, 40, 0, 0, 7); c.fill();
      const wg = c.createRadialGradient(x + 10, y, 4, x + 10, y, 46);
      wg.addColorStop(0, '#2c6f7c'); wg.addColorStop(1, '#4f9aa0');
      c.fillStyle = wg; c.beginPath(); c.ellipse(x + 12, y + 2, 46, 24, 0.1, 0, 7); c.fill();
    }
    // обломки кораблей: кладбище, грузовик, свалка, место крушения
    ['graveyard', 'freighter', 'junkyard', 'crash'].forEach((id, j) => {
      if (!T[id]) return;
      const [cx, cy] = P(id);
      for (let k = 0; k < 7; k++) {
        const x = cx + (hr(j * 70 + k) - 0.5) * 150, y = cy + (hr(j * 70 + k + 3) - 0.5) * 90;
        c.save(); c.translate(x, y); c.rotate(hr(k + j) * 3);
        c.fillStyle = 'rgba(40,36,34,0.45)'; c.fillRect(-12 + 3, -4 + 3, 24, 8);
        c.fillStyle = 'rgba(120,112,104,0.75)'; c.fillRect(-12, -4, 24, 8);
        c.restore();
      }
    });
    // след падения корабля
    if (T.crash) {
      const [x, y] = P('crash');
      const tg = c.createLinearGradient(x - 260, y - 160, x, y);
      tg.addColorStop(0, 'rgba(30,20,12,0)'); tg.addColorStop(1, 'rgba(30,20,12,0.45)');
      c.strokeStyle = tg; c.lineWidth = 26; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 260, y - 160); c.lineTo(x - 10, y - 4); c.stroke();
    }
    // сетка голокарты и виньетка
    c.strokeStyle = 'rgba(255,210,140,0.06)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    try { bgUrl = cv.toDataURL('image/jpeg', 0.82); } catch (e) { bgUrl = ''; }
    return bgUrl;
  }

  // Подписи без наложений: для каждой метки пробуем места вокруг значка и берём свободное
  function placeLabels(items) {
    const boxes = items.map((it) => ({ x0: it.x - it.r, y0: it.y - it.r, x1: it.x + it.r, y1: it.y + it.r }));
    const over = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const out = [];
    for (const it of items) {
      const w = it.text.length * it.size * 0.6 + 0.8, hh = it.size;
      const cands = [
        [it.x, it.y + it.r + hh * 0.95, 'middle'], [it.x, it.y - it.r - hh * 0.3, 'middle'],
        [it.x + it.r + 0.8, it.y + hh * 0.35, 'start'], [it.x - it.r - 0.8, it.y + hh * 0.35, 'end'],
        [it.x + it.r * 0.6, it.y + it.r + hh * 0.95, 'start'], [it.x - it.r * 0.6, it.y + it.r + hh * 0.95, 'end'],
        [it.x + it.r * 0.6, it.y - it.r - hh * 0.3, 'start'], [it.x - it.r * 0.6, it.y - it.r - hh * 0.3, 'end'],
      ];
      let best = null;
      cands.forEach(([lx, ly, anchor], k) => {
        let x0 = anchor === 'middle' ? lx - w / 2 : anchor === 'start' ? lx : lx - w;
        const shift = Math.max(0.6 - x0, 0) - Math.max(x0 + w - 99.4, 0);
        x0 += shift;
        const box = { x0: x0, y0: ly - hh * 0.8, x1: x0 + w, y1: ly + hh * 0.2 };
        let cost = k * 0.4 + Math.abs(shift) * 0.3;
        if (box.y0 < 0.5 || box.y1 > 74.5) cost += 1000;
        for (const b of boxes) cost += over(box, b) * 10;
        for (const b of out) cost += over(box, b.box) * 10;
        if (!best || cost < best.cost) best = { cost: cost, box: box, x: lx + shift, y: ly, anchor: anchor };
      });
      out.push(best);
      it.label = best;
    }
    return items;
  }

  function drawMap(s) {
    const C = G.CONFIG.regions;
    const T = G.TEXT.regions;
    const A = G.Avatar;
    const root = svg('svg', { viewBox: '0 0 100 75', preserveAspectRatio: 'xMidYMid meet', class: 'map-svg' });
    const defs = svg('defs');
    root.appendChild(defs);
    root.appendChild(svg('rect', { x: 0, y: 0, width: 100, height: 75, fill: '#3a2a1a' }));
    const bg = background();
    if (bg) root.appendChild(image(bg, 0, 0, 100, 75));
    const known = (id) => s.regions[id] && s.regions[id].known;
    // туман: всё, кроме окрестностей разведанных мест, притушено
    const mask = svg('mask', { id: 'mapfog', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 100, height: 75 });
    // дыра в тумане: чёрное в центре плавно уходит в прозрачное — соседние дыры не перекрывают друг друга
    const hole = svg('radialGradient', { id: 'maphole' }, svg('stop', { offset: '0.4', 'stop-color': '#000', 'stop-opacity': 1 }), svg('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': 0 }));
    defs.appendChild(hole);
    mask.appendChild(svg('rect', { x: 0, y: 0, width: 100, height: 75, fill: '#fff' }));
    for (const id in C) if (known(id)) mask.appendChild(svg('circle', { cx: T[id].x, cy: Y(T[id].y), r: 18, fill: 'url(#maphole)' }));
    defs.appendChild(mask);
    root.appendChild(svg('rect', { x: 0, y: 0, width: 100, height: 75, fill: 'rgba(14,10,8,0.62)', mask: 'url(#mapfog)' }));
    // Тропы
    const hints = new Set();
    for (const id in C) {
      if (!known(id)) continue;
      for (const [link] of C[id].links || []) {
        if (C[link].hidden && !known(link)) continue;
        const a = T[id], b = T[link];
        const both = known(link);
        if (!both) hints.add(link);
        const mx = (a.x + b.x) / 2 + (Y(a.y) - Y(b.y)) * 0.08, my = (Y(a.y) + Y(b.y)) / 2 + (b.x - a.x) * 0.08;
        const d = 'M' + a.x + ' ' + Y(a.y) + ' Q' + mx + ' ' + my + ' ' + b.x + ' ' + Y(b.y);
        root.appendChild(svg('path', { d: d, fill: 'none', stroke: 'rgba(20,12,6,0.55)', 'stroke-width': both ? 1.3 : 0.9 }));
        root.appendChild(svg('path', { d: d, fill: 'none', stroke: both ? '#f0d6a0' : '#a08a66', 'stroke-width': both ? 0.45 : 0.35, 'stroke-dasharray': both ? '1.6 0.9' : '0.6 1', opacity: both ? 0.85 : 0.6 }));
      }
    }
    const items = [];
    // Неизвестные места
    for (const id of hints) {
      const t = T[id];
      items.push({ id: id, x: t.x, y: Y(t.y), r: 2.4, hint: true, text: '?', size: 2.6 });
    }
    // Известные места
    const order = { base: 0, town: 1, hostile: 2, point: 3, wild: 4 };
    const ids = Object.keys(C).filter(known).sort((a, b) => order[C[a].kind] - order[C[b].kind]);
    for (const id of ids) {
      const t = T[id];
      items.push({ id: id, x: t.x, y: Y(t.y), r: C[id].kind === 'base' ? 5 : 4.2, text: t.short || t.name, size: 2.5 });
    }
    placeLabels(items.filter((it) => !it.hint).concat([]));
    for (const it of items) {
      if (it.hint) {
        root.appendChild(svg('g', { class: 'map-hint' },
          svg('circle', { cx: it.x, cy: it.y, r: 2.4, fill: 'rgba(20,14,8,0.85)', stroke: '#8a7a5a', 'stroke-width': 0.35, 'stroke-dasharray': '0.8 0.6' }),
          txt(it.x, it.y + 0.95, '?', '#d8c49a', 2.6)));
        continue;
      }
      const id = it.id, sel = UI.mapSel === id, r = it.r;
      const cleared = s.regions[id].cleared;
      const g = svg('g', { class: 'map-node' + (sel ? ' sel' : '') + (cleared ? ' cleared' : ''), onclick: () => { UI.mapSel = id; UI.render(); } });
      g.appendChild(svg('circle', { cx: it.x, cy: it.y, r: r + 2, fill: 'transparent' }));
      g.appendChild(svg('ellipse', { cx: it.x + 0.6, cy: it.y + r * 0.9, rx: r * 0.9, ry: r * 0.3, fill: 'rgba(0,0,0,0.45)' }));
      if (sel) g.appendChild(svg('circle', { class: 'map-pulse', cx: it.x, cy: it.y, r: r + 0.9, fill: 'none', stroke: '#ffd98a', 'stroke-width': 0.6 }));
      g.appendChild(image(A.placeUrl(id), it.x - r, it.y - r, r * 2, r * 2, cleared ? { opacity: 0.55 } : null));
      if (cleared) g.appendChild(svg('path', { d: 'M' + (it.x - r * 0.6) + ' ' + (it.y - r * 0.6) + ' L' + (it.x + r * 0.6) + ' ' + (it.y + r * 0.6) + ' M' + (it.x + r * 0.6) + ' ' + (it.y - r * 0.6) + ' L' + (it.x - r * 0.6) + ' ' + (it.y + r * 0.6), stroke: '#e2574c', 'stroke-width': 0.9, 'stroke-linecap': 'round' }));
      if (G.Territory && G.Territory.owned(s, id)) { // наш флаг над значком
        const fx = it.x + r * 0.55, fy = it.y - r * 0.55;
        g.appendChild(svg('path', { d: 'M' + fx + ' ' + (fy + 0.2) + ' V' + (fy - 4.2), stroke: '#2a2016', 'stroke-width': 0.45, 'stroke-linecap': 'round' }));
        g.appendChild(svg('path', { d: 'M' + (fx + 0.1) + ' ' + (fy - 4.2) + ' L' + (fx + 3) + ' ' + (fy - 3.4) + ' L' + (fx + 0.1) + ' ' + (fy - 2.5) + ' Z', fill: '#f3cd8c', stroke: '#6a4a1c', 'stroke-width': 0.25 }));
      }
      const L = it.label;
      g.appendChild(txt(L.x, L.y, it.text, sel ? '#ffd98a' : '#f3ead8', it.size, L.anchor, true));
      root.appendChild(g);
    }
    return root;
  }

  function txt(x, y, str, fill, size, anchor, halo) {
    const el = svg('text', { x: x, y: y, 'text-anchor': anchor || 'middle', fill: fill, style: 'font-size:' + size + 'px', 'font-family': 'system-ui, sans-serif', 'font-weight': halo ? 600 : null,
      stroke: halo ? 'rgba(12,8,4,0.85)' : null, 'stroke-width': halo ? 0.55 : null, 'paint-order': halo ? 'stroke' : null, 'stroke-linejoin': 'round' });
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
    const kindName = { base: 'Наш лагерь', wild: 'Пустошь', town: 'Поселение', hostile: 'Вражеский лагерь', point: 'Стратегическая точка' }[c.kind];
    const card = h('div', { class: 'card region-card' },
      h('div', { class: 'region-head' },
        G.Avatar.place(id, 76, 'ava-big'),
        h('div', null,
          h('h2', null, T.name),
          h('div', { class: 'muted small' }, kindName + (r.cleared ? ' · разгромлен' : '') + (c.terrain && G.TEXT.terrain[c.terrain] ? ' · местность: ' + G.TEXT.terrain[c.terrain] : '')))),
      h('p', null, r.visits || id === 'crash' || r.explored > 0 ? T.desc : 'Сведений почти нет. Нужна разведка.'),
      whoHere(s, id),
      c.point && G.TEXT.points ? h('div', { class: 'point-box' + (G.Territory.owned(s, id) ? ' on' : '') }, h('b', null, G.Territory.owned(s, id) ? '◆ Бонус действует' : '◇ Если захватить'), h('div', { class: 'small' }, G.TEXT.points[c.point])) : null,
      G.Territory && G.Territory.siege(s, id) && !G.Territory.owned(s, id) ? h('div', { class: 'siege-box' },
        h('b', null, '⚔ Штурм идёт'), h('div', { class: 'small' }, 'Взято этапов: ' + (G.Territory.siege(s, id).stage - 1) + ' из ' + G.Territory.stages(s, id) +
          '. Следующий — «' + G.Territory.stageName(s, id, G.Territory.siege(s, id).stage) + '». Позиции держим до дня ' + G.Territory.siege(s, id).until + '.')) : null,
      G.Territory && G.Territory.owned(s, id) ? h('div', { class: 'territory-box' },
        h('b', null, '⚑ Наша территория'), h('span', { class: 'small muted' }, ' с дня ' + (r.heldSince || 1)),
        h('div', { class: 'small' }, 'Доход в сутки: ' + (G.Territory.incomeText(G.Territory.income(s, id)) || 'нет') + '. Засад здесь почти нет.'),
        G.Territory.counterChance(s, id) > 0 ? h('div', { class: 'small muted' }, 'Враги могут попытаться отбить это место.') : null) : null,
      h('div', { class: 'region-stats' },
        id !== 'crash' ? h('div', null, h('span', { class: 'muted' }, 'Разведано: '), r.explored + '%') : null,
        c.water ? h('div', null, h('span', { class: 'muted' }, 'Провизия: '), h('span', { class: 'dots' }, dots(c.water, 4)), r.explored >= 20 ? ' ~' + r.water : '') : null,
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
      let label = G.TEXT.actions[type].icon + ' ' + G.TEXT.actions[type].name;
      if (type === 'attack' && G.Territory) {
        const k = G.Territory.attackSpec(s, id).kind, n = G.Territory.stages(s, id), st = G.Territory.stageOf(s, id);
        label = k === 'wild' ? '⚑ Зачистка' : k === 'town' || k === 'point' ? '⚑ Захват' : '✕ Штурм';
        if (n > 1) label += ' · этап ' + st + '/' + n;
      }
      btns.push(h('button', { class: 'btn small' + (type === 'attack' ? ' danger' : ''), disabled: !can, onclick: () => UI.openBuilder(type, id) }, label));
    }
    if (btns.length) card.appendChild(h('div', { class: 'row' }, btns));
    return card;
  }

  // Кто здесь: торговец, хозяева места или кого можно встретить в пути
  function whoHere(s, id) {
    const c = G.CONFIG.regions[id];
    const r = s.regions[id];
    if (id === 'crash') return null;
    const BTn = G.BattleText ? G.BattleText.nom : (t) => t;
    const figs = (army, label) => {
      const a = G.CONFIG.battle.armies[army];
      if (!a) return null;
      const types = a.units.map((u) => u[0]).concat(a.leader ? [a.leader] : []);
      return h('div', { class: 'who' }, h('span', { class: 'small muted' }, label),
        h('div', { class: 'ava-row' }, types.map((t) => h('div', { class: 'ava-chip' }, G.Avatar.enemy(t, 40, null, U.cap(BTn(t))), U.cap(BTn(t)).split(' ')[0]))));
    };
    if (c.trade) {
      return h('div', { class: 'who' }, h('div', { class: 'row', style: 'align-items:center;gap:10px' }, G.Avatar.trader(c.trade, 44),
        h('span', { class: 'small' }, 'Здесь торгуют: ' + (G.TEXT.tradePartners[c.trade] || ''))));
    }
    if (c.kind === 'hostile' && !r.cleared && r.explored > 0) return figs(c.enemy, 'Гарнизон:');
    if (c.ambush && r.explored > 0) return figs(c.ambush, 'В пути можно встретить:');
    return null;
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
        met ? G.Avatar.faction(f, 38, 'fac-ava') : h('span', { class: 'fac-icon' }, '?'),
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
        h('div', { class: 'map-legend small muted' },
          h('span', null, h('i', { class: 'lg base' }), 'лагерь'), h('span', null, h('i', { class: 'lg wild' }), 'пустошь'),
          h('span', null, h('i', { class: 'lg town' }), 'поселение'), h('span', null, h('i', { class: 'lg hostile' }), 'враг'),
          h('span', null, h('i', { class: 'lg point' }), 'точка'),
          h('span', null, '? — неразведанное место'),
          G.Territory ? h('span', { class: 'terr-count' }, '⚑ наших мест: ' + G.Territory.count(s) + ' из ' + G.Territory.total()) : null)
      ),
      h('div', null, regionCard(s, UI.mapSel), factionsCard(s))
    );
  };
})(globalThis.G = globalThis.G || {});
