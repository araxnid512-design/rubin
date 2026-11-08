/*
 * Вкладка «Терминал»: заказ бойцов и припасов с доставкой шаттлом, шаттлы в пути, доска контрактов.
 * Также — рисунок грузового шаттла (оригинальный: короткий корпус, две гондолы, грузовая рампа).
 */
(function (G) {
  'use strict';
  const { h } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};
  const TAU = Math.PI * 2;
  const T = () => G.Terminal;
  const X = () => G.TEXT.terminal;

  // ---------- рисунок шаттла (вид сверху, нос на север); x, y — центр, L — длина в пикселях ----------
  G.drawShuttle = function (c, x, y, L, o) {
    o = o || {};
    const w = L * 0.36;
    c.save();
    c.translate(x, y);
    if (o.scale) c.scale(o.scale, o.scale);
    // крылья: короткие, скошенные назад, жёлтые полосы на законцовках
    const wg = c.createLinearGradient(-L * 0.6, 0, L * 0.6, 0);
    wg.addColorStop(0, '#6f767e'); wg.addColorStop(0.5, '#a7aeb5'); wg.addColorStop(1, '#5d636a');
    c.fillStyle = wg;
    c.beginPath(); c.moveTo(-w * 0.45, -L * 0.05); c.lineTo(-L * 0.58, L * 0.2); c.lineTo(-L * 0.55, L * 0.3); c.lineTo(-w * 0.45, L * 0.22); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(w * 0.45, -L * 0.05); c.lineTo(L * 0.58, L * 0.2); c.lineTo(L * 0.55, L * 0.3); c.lineTo(w * 0.45, L * 0.22); c.closePath(); c.fill();
    c.fillStyle = '#e7c34a';
    c.fillRect(-L * 0.58, L * 0.2, L * 0.05, L * 0.09); c.fillRect(L * 0.53, L * 0.2, L * 0.05, L * 0.09);
    // гондолы двигателей
    for (const sx of [-1, 1]) {
      const ex = sx * w * 0.62;
      const ng = c.createLinearGradient(ex - w * 0.2, 0, ex + w * 0.2, 0);
      ng.addColorStop(0, '#4d5359'); ng.addColorStop(0.45, '#9aa1a8'); ng.addColorStop(1, '#3e4348');
      c.fillStyle = ng;
      c.beginPath(); c.ellipse(ex, L * 0.18, w * 0.2, L * 0.24, 0, 0, TAU); c.fill();
      const glow = o.engines != null ? o.engines : 0.3;
      if (glow > 0) {
        const eg = c.createRadialGradient(ex, L * 0.42, 0, ex, L * 0.42, w * 0.5 * (1 + glow));
        eg.addColorStop(0, 'rgba(255,220,150,' + (0.9 * glow).toFixed(3) + ')'); eg.addColorStop(0.4, 'rgba(255,140,60,' + (0.6 * glow).toFixed(3) + ')'); eg.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = eg; c.beginPath(); c.arc(ex, L * 0.42, w * 0.5 * (1 + glow), 0, TAU); c.fill();
      }
    }
    // корпус: вытянутый восьмиугольник
    const bg = c.createLinearGradient(-w / 2, 0, w / 2, 0);
    bg.addColorStop(0, '#7b828a'); bg.addColorStop(0.35, '#d3d8dc'); bg.addColorStop(0.6, '#a9b0b6'); bg.addColorStop(1, '#5a6066');
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-w * 0.22, -L * 0.5); c.lineTo(w * 0.22, -L * 0.5); c.lineTo(w * 0.5, -L * 0.3); c.lineTo(w * 0.5, L * 0.38);
    c.lineTo(w * 0.32, L * 0.5); c.lineTo(-w * 0.32, L * 0.5); c.lineTo(-w * 0.5, L * 0.38); c.lineTo(-w * 0.5, -L * 0.3); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,34,38,0.7)'; c.lineWidth = Math.max(1, L * 0.012); c.stroke();
    // панели и грузовой люк
    c.strokeStyle = 'rgba(40,44,50,0.45)';
    for (const yy of [-0.18, 0.02, 0.22]) { c.beginPath(); c.moveTo(-w * 0.5, L * yy); c.lineTo(w * 0.5, L * yy); c.stroke(); }
    c.strokeRect(-w * 0.28, L * 0.05, w * 0.56, L * 0.28);
    // кабина
    const cg = c.createLinearGradient(0, -L * 0.48, 0, -L * 0.3);
    cg.addColorStop(0, '#9fd2ff'); cg.addColorStop(1, '#1b3550');
    c.fillStyle = cg;
    c.beginPath(); c.moveTo(-w * 0.18, -L * 0.47); c.lineTo(w * 0.18, -L * 0.47); c.lineTo(w * 0.34, -L * 0.32); c.lineTo(-w * 0.34, -L * 0.32); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-w * 0.12, -L * 0.455, w * 0.12, L * 0.02);
    // рампа сзади
    if (o.ramp) {
      c.fillStyle = '#3a3f45';
      c.beginPath(); c.moveTo(-w * 0.26, L * 0.5); c.lineTo(w * 0.26, L * 0.5); c.lineTo(w * 0.3, L * 0.5 + L * 0.2 * o.ramp); c.lineTo(-w * 0.3, L * 0.5 + L * 0.2 * o.ramp); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,215,140,0.35)'; c.fillRect(-w * 0.2, L * 0.5, w * 0.4, L * 0.04 * o.ramp);
    }
    // огни
    if (o.blink) {
      c.fillStyle = '#ff5a4a'; c.beginPath(); c.arc(-L * 0.55, L * 0.24, L * 0.018, 0, TAU); c.fill();
      c.fillStyle = '#7cff9a'; c.beginPath(); c.arc(L * 0.55, L * 0.24, L * 0.018, 0, TAU); c.fill();
    }
    c.restore();
  };

  let shipIcon = null;
  function shuttleIcon(size) {
    if (!shipIcon) {
      const cv = document.createElement('canvas');
      cv.width = 96; cv.height = 96;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(48, 40, 4, 48, 48, 50);
      g.addColorStop(0, '#2a3a4c'); g.addColorStop(1, '#10161e');
      c.fillStyle = g; c.beginPath(); c.arc(48, 48, 46, 0, TAU); c.fill();
      c.save(); c.translate(48, 50); c.rotate(-0.6);
      G.drawShuttle(c, 0, 0, 70, { engines: 0.9 });
      c.restore();
      c.lineWidth = 3; c.strokeStyle = '#6fb3e0'; c.beginPath(); c.arc(48, 48, 46, 0, TAU); c.stroke();
      try { shipIcon = cv.toDataURL('image/png'); } catch (e) { shipIcon = ''; }
    }
    return h('img', { class: 'ava', src: shipIcon, width: size, height: size, alt: '' });
  }

  function goodPic(id, size) {
    const g = G.CONFIG.terminal.goods[id];
    if (g.unit === 'merc') return G.Avatar.figure('merc', size);
    if (g.unit === 'droid') return G.Avatar.figure('droid', size);
    if (g.unit === 'trooper') return G.Avatar.figure(id === 'veterans' ? 'heavy' : 'trooper', size);
    return G.Avatar.faction(g.rel, size);
  }

  const days = (n) => U.pl(n, ['день', 'дня', 'дней']);

  function goodRow(s, id) {
    const g = G.CONFIG.terminal.goods[id];
    const t = X().goods[id];
    const why = T().why(s, id);
    const price = T().price(s, id);
    const risk = Math.round(T().risk(s, id) * 100);
    return h('div', { class: 'term-row' + (why ? ' off' : '') },
      goodPic(id, 48),
      h('div', { class: 'grow' },
        h('div', { class: 'row between' }, h('b', null, t.name), h('span', { class: 'small muted' }, t.who)),
        h('div', { class: 'small' }, t.desc),
        h('div', { class: 'term-meta' },
          h('span', null, '⏱ ' + days(g.days)),
          g.unit ? h('span', null, '+' + g.n + ' в отряд') : h('span', null, Object.keys(g.give).map((k) => k === 'bacta' ? 'бакта ×' + g.give[k] : G.TEXT.res[k].name.toLowerCase() + ' +' + g.give[k]).join(', ')),
          h('span', { class: risk > 5 ? 'warn' : '' }, 'риск ' + risk + '%')),
        why ? h('div', { class: 'small bad' }, why) : null),
      h('button', { class: 'btn primary term-buy', disabled: !!why, onclick: () => {
        const err = T().order(s, id);
        if (err) UI.flash(err); else { if (G.Audio) G.Audio.sfx('order'); UI.flash('Заказ принят: ' + t.name + '.'); }
        UI.commit();
      } }, h('span', null, 'Заказать'), h('b', null, price + ' кр.')));
  }

  function transitCard(s) {
    const t = T().ensure(s);
    if (!t.orders.length) return null;
    return h('div', { class: 'card' },
      h('h2', null, 'Шаттлы в пути'),
      t.orders.map((o) => {
        const total = Math.max(1, o.eta - o.ordered), left = Math.max(0, o.eta - s.day);
        const pct = Math.round((1 - left / total) * 100);
        return h('div', { class: 'term-row' },
          shuttleIcon(44),
          h('div', { class: 'grow' },
            h('div', { class: 'row between' }, h('b', null, X().goods[o.good].name), h('span', { class: 'small muted' }, left <= 1 ? 'прилетит завтра на рассвете' : 'через ' + days(left))),
            h('div', { class: 'term-bar' }, h('i', { style: 'width:' + pct + '%' })),
            o.delayed ? h('div', { class: 'small warn' }, 'Задержка из-за бури') : null));
      }));
  }

  function contractRow(s, c, active) {
    const pr = T().progress(s, c);
    const left = active ? c.deadline - s.day : c.days;
    const pct = Math.round(Math.min(1, pr[0] / pr[1]) * 100);
    const canHand = active && c.type === 'deliver' && pr[0] >= pr[1];
    return h('div', { class: 'term-row contract' + (active ? ' active' : '') },
      G.Avatar.faction(c.giver, 44),
      h('div', { class: 'grow' },
        h('div', { class: 'row between' }, h('b', null, T().title(c)), h('span', { class: 'reward' }, '+' + c.reward + ' кр.')),
        h('div', { class: 'small muted' }, G.TEXT.factions[c.giver].name + ' · ' + (active ? 'осталось ' + days(Math.max(0, left)) : 'срок ' + days(left))),
        active ? h('div', { class: 'term-bar' + (pct >= 100 ? ' full' : '') }, h('i', { style: 'width:' + pct + '%' })) : null,
        active ? h('div', { class: 'small' }, c.type === 'deliver' ? 'на складе: ' + pr[0] + ' из ' + c.need : 'выполнено: ' + (c.type === 'clear' ? (pr[0] ? 'да' : 'нет') : pr[0] + ' из ' + pr[1])) : null),
      active
        ? (c.type === 'deliver' ? h('button', { class: 'btn small', disabled: !canHand, onclick: () => { const e = T().handIn(s, c.id); UI.flash(e || 'Груз сдан. Получено ' + c.reward + ' кр.'); UI.commit(); } }, 'Сдать') : null)
        : h('button', { class: 'btn small', disabled: !!T().whyAccept(s, c.id), onclick: () => { const e = T().accept(s, c.id); UI.flash(e || 'Контракт принят.'); UI.commit(); } }, 'Взять'));
  }

  function contractsCard(s) {
    const t = T().ensure(s);
    const until = Math.max(0, t.nextRefresh - s.day);
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, 'Доска заказов'), h('span', { class: 'small muted' }, 'выполнено: ' + t.done)),
      h('p', { class: 'small muted' }, 'Местные платят кредиты за работу. Бои, разведка и разгром засчитываются сами, груз сдаётся кнопкой. Сорванный срок портит отношения.'),
      t.active.length ? h('h3', null, 'В работе') : null,
      t.active.map((c) => contractRow(s, c, true)),
      h('h3', null, 'Предложения'),
      t.offers.length ? t.offers.map((c) => contractRow(s, c, false)) : h('p', { class: 'small muted' }, 'Пока пусто.'),
      h('p', { class: 'small muted' }, 'Новые предложения ' + (until <= 1 ? 'завтра' : 'через ' + days(until)) + '.'));
  }

  UI.views.term = function (s) {
    const goods = G.CONFIG.terminal.goods;
    const by = (grp) => Object.keys(goods).filter((id) => goods[id].group === grp);
    return h('div', { class: 'cols' },
      h('div', null,
        h('div', { class: 'card term-card' },
          h('div', { class: 'row between' }, h('h2', null, X().title), h('span', { class: 'chip' }, h('i', { class: 'ico ico-credits' }), s.res.credits + ' кр.')),
          h('p', { class: 'small muted' }, X().lead),
          h('h3', null, X().channels.troops), by('troops').map((id) => goodRow(s, id)),
          h('h3', null, X().channels.supply), by('supply').map((id) => goodRow(s, id))),
        transitCard(s)),
      h('div', null, contractsCard(s)));
  };

  // Сводка для штаба
  UI.terminalBrief = function (s) {
    const t = T() && T().ensure(s);
    if (!t || (!t.orders.length && !t.active.length)) return null;
    return h('div', { class: 'card term-brief', onclick: () => UI.go('term') },
      h('div', { class: 'row between' }, h('h2', null, 'Терминал'), h('span', { class: 'small muted' }, 'открыть ▸')),
      t.orders.map((o) => h('div', { class: 'row small' }, shuttleIcon(26), X().goods[o.good].name + ' — ' + (o.eta - s.day <= 1 ? 'завтра' : 'через ' + days(o.eta - s.day)))),
      t.active.map((c) => { const pr = T().progress(s, c); return h('div', { class: 'row small' }, G.Avatar.faction(c.giver, 26), T().title(c) + ' — ' + pr[0] + '/' + pr[1] + ', до дня ' + c.deadline); }));
  };
})(globalThis.G = globalThis.G || {});
