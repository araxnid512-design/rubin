/* Вкладка «Штаб»: доклад, состояние лагеря, приказы на день. */
(function (G) {
  'use strict';
  const { h, paragraphs, bar } = G.Dom;
  const U = G.U;
  const F = U.FORMS;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};

  // ---------- Доклад ----------
  function reportCard(s) {
    const r = s.lastReport;
    if (!r) return null;
    const card = h('div', { class: 'card report' });
    if (r.day === 0) {
      card.appendChild(h('h2', null, 'Крушение'));
      card.appendChild(h('div', { class: 'morning' }, paragraphs(r.morning)));
      card.appendChild(h('p', { class: 'muted small' }, G.TEXT.firstDayHint));
      return card;
    }
    card.appendChild(h('h2', null, r.title));
    if (r.lines.length) {
      card.appendChild(h('ul', { class: 'lines' }, r.lines.map((l) => h('li', { class: 'k-' + l.k }, l.t))));
    } else {
      card.appendChild(h('p', { class: 'muted' }, 'День прошёл спокойно.'));
    }
    if (r.delta) {
      const d = r.delta;
      const items = [['water', 'Вода'], ['scrap', 'Металл'], ['energy', 'Энергия'], ['credits', 'Кредиты'], ['discipline', 'Дисциплина'], ['people', 'Люди'], ['droids', 'Дроиды']];
      card.appendChild(h('div', { class: 'deltas' }, items.filter(([k]) => d[k]).map(([k, n]) =>
        h('span', { class: 'delta ' + (d[k] > 0 ? 'pos' : 'neg') }, n + ' ' + U.signed(d[k])))));
    }
    if (r.morning && !s.over) {
      card.appendChild(h('hr', { class: 'sep' }));
      card.appendChild(h('h3', null, 'Утро дня ' + s.day));
      card.appendChild(h('div', { class: 'morning' }, r.morning));
    }
    return card;
  }

  // ---------- Состояние ----------
  function statusCard(s) {
    const people = G.Units.people(s);
    const fit = people.filter((u) => G.Units.isFit(s, u));
    const light = people.filter((u) => G.Units.woundLevel(u) === 1).length;
    const heavy = people.filter((u) => G.Units.woundLevel(u) === 2).length;
    const droids = G.Units.droids(s);
    const need = G.Day.waterNeed(s, s.orders);
    const prod = G.Base.waterProduction(s);
    const days = G.Day.waterDaysLeft(s);
    const eNet = G.Base.energyProduction(s) - G.Base.energyUse(s);
    const raid = G.Day.raidChance(s, s.guards + U.sum(s.orders.filter((o) => o.type === 'guard'), (o) => o.unitIds.length));
    const kv = (k, v, cls) => [h('span', { class: 'k' }, k), h('span', { class: cls || '' }, v)];
    return h('div', { class: 'card' },
      h('h2', null, 'Обстановка'),
      h('div', { class: 'kv' },
        kv('В строю', fit.length + ' из ' + people.length + (light ? ' · легкораненых ' + light : '')),
        heavy ? kv('Тяжелораненые', String(heavy), 'warn') : null,
        kv('Дроиды', droids.length ? droids.length + (s.droidsOffline ? ' — без питания!' : '') : 'нет', s.droidsOffline ? 'bad' : ''),
        kv('Вода', 'расход ~' + need + ' л/сут' + (prod ? ', сбор +' + prod : '') + ' · ' + (days >= 99 ? 'запас не убывает' : 'хватит на ' + days.toFixed(1) + ' дн.'), days < 2 ? 'bad' : days < 4 ? 'warn' : ''),
        kv('Энергия', (eNet >= 0 ? '+' : '') + eNet + ' в сутки', eNet < 0 ? 'bad' : ''),
        kv('Бакта', String(s.items.bacta || 0)),
        kv('Угроза налёта', G.Actions.riskWord(raid), raid > 0.2 ? 'warn' : '')
      ),
      h('hr', { class: 'sep' }),
      h('div', { class: 'small muted', style: 'margin-bottom:6px' }, 'Паёк: ' + G.TEXT.rations[s.rations].desc),
      h('div', { class: 'seg' }, ['full', 'reduced', 'minimal'].map((r) =>
        h('button', { class: 'btn small' + (s.rations === r ? ' sel' : ''), disabled: s.phase !== 'orders',
          onclick: () => { G.Game.setRations(s, r); UI.commit(); } }, G.TEXT.rations[r].name)))
    );
  }

  // ---------- Приказы ----------
  function orderRow(s, o, idx) {
    const T = G.TEXT.actions[o.type];
    const target = G.Actions.targetName(o.type, o.target);
    const nPeople = o.unitIds.filter((id) => G.Units.byId(s, id).kind !== 'droid').length;
    const nDroids = o.unitIds.length - nPeople;
    const squad = o.unitIds.length ? U.pl(nPeople, F.fighter) + (nDroids ? ' + ' + U.pl(nDroids, F.droid) : '') : '';
    return h('div', { class: 'order' },
      h('div', { class: 'oi' }, T.icon),
      h('div', { class: 'ob' },
        h('div', { class: 'ot' }, T.name + (target ? ' — ' + target : '')),
        squad ? h('div', { class: 'small muted' }, squad) : null,
        h('div', { class: 'small' }, G.Game.preview(s, o))
      ),
      h('button', { class: 'btn small ghost', title: 'Отменить приказ', onclick: () => { G.Game.removeOrder(s, idx); UI.commit(); } }, '✕')
    );
  }

  function ordersCard(s) {
    const left = G.Game.ordersLeft(s);
    const free = G.Game.freeCounts(s);
    const card = h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('h2', null, 'Приказы на день'),
        h('span', { class: 'mono muted' }, s.orders.length + '/' + G.CONFIG.orders.perDay)
      ));
    s.orders.forEach((o, i) => card.appendChild(orderRow(s, o, i)));
    if (UI.builder) card.appendChild(UI.builderView(s));
    else if (left > 0 && s.phase === 'orders') {
      card.appendChild(h('button', { class: 'btn', style: 'width:100%', onclick: () => { UI.builder = { step: 'type' }; UI.render(); } },
        '+ Отдать приказ (осталось ' + left + ')'));
    }
    card.appendChild(h('p', { class: 'small muted', style: 'margin-top:10px' },
      'Свободны и останутся в лагере: ' + U.pl(free.people, F.fighter) + (free.droids ? ', ' + U.pl(free.droids, F.droid) : '') + '.'));
    card.appendChild(h('button', { class: 'btn primary big', disabled: s.phase !== 'orders' || !!s.pending || !!s.over, onclick: () => {
      UI.builder = null;
      G.Game.endDay(s);
      UI.commit();
      window.scrollTo(0, 0);
    } }, s.orders.length ? 'Завершить день ▸' : 'Завершить день без приказов ▸'));
    return card;
  }

  // ---------- Конструктор приказа ----------
  UI.openBuilder = function (type, target) {
    const s = UI.s;
    const def = G.Actions.defs[type];
    UI.builder = { step: def.noSquad ? 'squad' : (target || !def.targets ? 'squad' : 'target'), type: type, target: target || null };
    initSquad(s, UI.builder);
    UI.tab = 'hq';
    UI.render();
    window.scrollTo(0, document.body.scrollHeight);
  };

  function initSquad(s, b) {
    const cfg = G.CONFIG.actions[b.type];
    const free = G.Game.freeCounts(s);
    if (!cfg || G.Actions.defs[b.type].noSquad) { b.troopers = 0; b.droids = 0; return; }
    b.troopers = U.clamp(cfg.suggest || cfg.min, Math.min(cfg.min, free.people), Math.min(cfg.max, free.people));
    b.droids = cfg.droids ? Math.min(free.droids, cfg.suggestDroids || 0) : 0;
  }

  function actionAvailability(s, type) {
    const def = G.Actions.defs[type];
    const cfg = G.CONFIG.actions[type];
    const free = G.Game.freeCounts(s);
    if (def.targets && !def.targets(s).length) return G.TEXT.noTargets[type] || 'Нет доступных целей.';
    if (!def.noSquad && free.people + (cfg.droids ? free.droids : 0) < cfg.min) return 'Не хватает свободных бойцов.';
    if (def.noSquad && def.validate) return def.validate(s, { type: type });
    return null;
  }

  function targetInfo(s, type, id) {
    if (type === 'engineer') return G.Progress.projectInfo(s, id);
    if (type === 'repair') {
      const sec = s.sections[id];
      const cost = G.Base.nextCost(s, id);
      const T = G.TEXT.sections[id];
      return T.levels[sec.level] + ' → ' + T.levels[sec.level + 1] + ' · ' +
        (sec.paid ? 'материалы заложены, ' : 'нужно: ' + G.Res.costText(cost) + ', ') + 'работы ' + Math.floor(sec.progress) + '/' + cost.work;
    }
    if (type === 'diplomacy') return 'Отношения: ' + s.relations[id] + ' · дар: ' + G.Res.costText(G.CONFIG.diplomacy[id].cost);
    if (id === 'jawa') return 'Краулер простоит рядом ещё ' + U.pl(s.visitors.jawa, F.day) + '.';
    const c = G.CONFIG.regions[id];
    const r = s.regions[id];
    const parts = [];
    if (c.kind === 'hostile') parts.push('вражеский лагерь');
    if (c.water) parts.push('вода: ' + G.Regions.richLabel(c.water) + (r.explored >= 20 ? ' (~' + r.water + ' л)' : ''));
    if (c.scrap && (type === 'salvage' || id !== 'crash')) parts.push('металл: ~' + r.scrap);
    if (c.danger) parts.push('опасность: ' + G.Regions.dangerLabel(c.danger));
    parts.push('путь: ' + (c.dist || 0));
    if (id !== 'crash') parts.push('разведано ' + r.explored + '%');
    return parts.join(' · ');
  }

  UI.builderView = function (s) {
    const b = UI.builder;
    const box = h('div', { class: 'card flat', style: 'margin:8px 0 0' });
    const back = (step) => h('button', { class: 'btn small ghost', onclick: () => { b.step = step; b.err = null; UI.render(); } }, '◂ Назад');
    const cancel = h('button', { class: 'btn small ghost', onclick: () => { UI.builder = null; UI.render(); } }, 'Отмена');

    if (b.step === 'type') {
      box.appendChild(h('div', { class: 'row between', style: 'margin-bottom:8px' }, h('h3', null, 'Выберите приказ'), cancel));
      box.appendChild(h('div', { class: 'actions-grid' }, G.Actions.list.map((type) => {
        const T = G.TEXT.actions[type];
        const why = actionAvailability(s, type);
        return h('button', { class: 'act', disabled: !!why, title: why || '', onclick: () => {
          const def = G.Actions.defs[type];
          b.type = type; b.target = null; b.err = null;
          b.step = def.targets ? 'target' : 'squad';
          initSquad(s, b);
          UI.render();
        } }, h('div', { class: 'an' }, h('span', { class: 'ai' }, T.icon), T.name), h('div', { class: 'ad' }, why || T.desc));
      })));
      return box;
    }

    const T = G.TEXT.actions[b.type];
    const def = G.Actions.defs[b.type];

    if (b.step === 'target') {
      box.appendChild(h('div', { class: 'row between', style: 'margin-bottom:8px' }, h('h3', null, T.icon + ' ' + T.name + ': цель'), h('div', { class: 'row' }, back('type'), cancel)));
      const list = def.targets(s);
      box.appendChild(h('div', { class: 'targets' }, list.map((id) => {
        const dup = s.orders.some((o) => o.type === b.type && o.target === id);
        let why = dup ? 'Уже назначено.' : null;
        if (!why && def.validate) why = def.validate(s, { type: b.type, target: id, unitIds: [] });
        return h('button', { class: 'target', disabled: !!why, onclick: () => { b.target = id; b.step = 'squad'; b.err = null; UI.render(); } },
          h('div', { class: 'tn' }, G.Actions.targetName(b.type, id)),
          h('div', { class: 'td' }, why || targetInfo(s, b.type, id)));
      })));
      return box;
    }

    // Отряд и подтверждение
    const cfg = G.CONFIG.actions[b.type] || {};
    const free = G.Game.freeCounts(s);
    box.appendChild(h('div', { class: 'row between', style: 'margin-bottom:8px' },
      h('h3', null, T.icon + ' ' + T.name + (b.target ? ' — ' + G.Actions.targetName(b.type, b.target) : '')),
      h('div', { class: 'row' }, def.targets ? back('target') : back('type'), cancel)));

    if (!def.noSquad) {
      const maxT = Math.min(cfg.max, free.people);
      const maxD = cfg.droids ? Math.min(free.droids, Math.max(0, cfg.max - b.troopers)) : 0;
      b.troopers = U.clamp(b.troopers, 0, maxT);
      b.droids = U.clamp(b.droids, 0, maxD);
      const stepper = (label, key, max) => h('div', { class: 'row', style: 'margin-bottom:8px' },
        h('span', { style: 'min-width:110px' }, label),
        h('div', { class: 'stepper' },
          h('button', { class: 'btn', disabled: b[key] <= 0, onclick: () => { b[key] = Math.max(0, b[key] - 1); UI.render(); } }, '−'),
          h('span', { class: 'val' }, String(b[key])),
          h('button', { class: 'btn', disabled: b[key] >= max, onclick: () => { b[key] = Math.min(max, b[key] + 1); UI.render(); } }, '+')),
        h('div', { class: 'row' }, [1, 5, 10].filter((n) => n <= max).map((n) =>
          h('button', { class: 'btn small ghost', onclick: () => { b[key] = Math.min(max, b[key] + n); UI.render(); } }, '+' + n)),
          h('button', { class: 'btn small ghost', onclick: () => { b[key] = max; UI.render(); } }, 'все'))
      );
      box.appendChild(stepper('Бойцы (' + maxT + ')', 'troopers', maxT));
      if (cfg.droids && free.droids) box.appendChild(stepper('Дроиды (' + free.droids + ')', 'droids', maxD));
      box.appendChild(h('div', { class: 'small muted' }, 'Нужно от ' + cfg.min + ' до ' + cfg.max + '. Состав подбирается автоматически: ' + G.TEXT.preferHint[def.prefer] + '.'));
    }

    const o = G.Game.makeOrder(s, b.type, b.target, b.troopers, b.droids);
    const err = G.Game.validateOrder(s, o);
    const prev = G.Game.preview(s, o);
    if (prev) box.appendChild(h('div', { class: 'preview' }, prev));
    if (err) box.appendChild(h('div', { class: 'err' }, err));
    box.appendChild(h('button', { class: 'btn primary', style: 'width:100%;margin-top:6px', disabled: !!err, onclick: () => {
      const e = G.Game.addOrder(s, o);
      if (e) { b.err = e; UI.render(); return; }
      UI.builder = null;
      UI.commit();
    } }, 'Отдать приказ'));
    return box;
  };

  UI.views.hq = function (s) {
    return h('div', { class: 'cols' },
      h('div', null, reportCard(s)),
      h('div', null, statusCard(s), ordersCard(s))
    );
  };
})(globalThis.G = globalThis.G || {});
