/* Вкладка «Штаб»: доклад, состояние лагеря, приказы на день. */
(function (G) {
  'use strict';
  const { h, paragraphs, bar } = G.Dom;
  const U = G.U;
  const F = U.FORMS;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};

  // ---------- Доклад: коротко, значками ----------
  const TONE_ICON = { good: '✓', bad: '✕', battle: '⚔', event: '✦', info: '•' };
  UI.reportOpen = false;

  function reportCard(s) {
    const r = s.lastReport;
    if (!r) return null;
    const card = h('div', { class: 'card report' });
    if (r.day === 0) {
      const paras = String(r.morning).split(/\n\n+/);
      card.appendChild(h('div', { class: 'ev-head' }, G.Avatar.npc('general', 44), h('h2', null, 'Крушение')));
      card.appendChild(h('div', { class: 'morning' }, UI.reportOpen ? paragraphs(r.morning) : h('p', null, paras[paras.length - 1])));
      if (!UI.reportOpen) card.appendChild(h('button', { class: 'btn small ghost', onclick: () => { UI.reportOpen = true; UI.render(); } }, 'Что случилось ▾'));
      return card;
    }
    card.appendChild(h('div', { class: 'ev-head' }, G.Avatar.npc('general', 40),
      h('div', null, h('h2', { style: 'margin:0' }, r.title), r.morning && !s.over ? h('div', { class: 'small muted morning-line' }, r.morning) : null)));
    if (r.delta) {
      const d = r.delta;
      const items = [['water', 'ico-water'], ['scrap', 'ico-scrap'], ['energy', 'ico-energy'], ['credits', 'ico-credits'], ['discipline', 'ico-discipline'], ['people', 'ico-troops'], ['droids', 'ico-droid']];
      card.appendChild(h('div', { class: 'deltas' }, items.filter(([k]) => d[k]).map(([k, ic]) =>
        h('span', { class: 'delta ' + (d[k] > 0 ? 'pos' : 'neg') }, h('i', { class: 'ico ' + ic }), U.signed(d[k])))));
    }
    if (!r.lines.length) { card.appendChild(h('p', { class: 'muted small' }, 'День прошёл спокойно.')); return card; }
    const limit = UI.reportOpen ? r.lines.length : 5;
    card.appendChild(h('ul', { class: 'lines compact' }, r.lines.slice(0, limit).map((l, k) =>
      h('li', { class: 'k-' + l.k, style: 'animation-delay:' + (k * 0.06).toFixed(2) + 's' }, h('span', { class: 'li-ico' }, TONE_ICON[l.k] || '•'), h('span', { class: 'li-t' }, l.t)))));
    if (r.lines.length > 5) card.appendChild(h('button', { class: 'btn small ghost', onclick: () => { UI.reportOpen = !UI.reportOpen; UI.render(); } },
      UI.reportOpen ? 'Свернуть ▴' : 'Ещё ' + (r.lines.length - 5) + ' ▾'));
    return card;
  }

  // ---------- Живая сцена лагеря ----------
  function campScene(s) {
    const v = G.CampView(s, { cols: [0, 23], rows: [1, 14], fill: [0, 15], maxCell: 30,
      maxHeight: () => (UI.isLandscapePhone() ? Math.max(150, ((globalThis.innerHeight || 360) - 60) * 0.62) : 330) });
    return h('div', { class: 'card camp-card hq-scene', onclick: () => UI.go('base'), title: 'Лагерь — нажмите, чтобы строить' }, v.el);
  }

  // ---------- Обстановка: плитки ----------
  function tile(ico, val, label, cls) {
    return h('div', { class: 'tile ' + (cls || '') }, h('div', { class: 'tile-v' }, h('i', { class: 'ico ' + ico }), val), h('div', { class: 'tile-l' }, label));
  }
  function statusCard(s) {
    const people = G.Units.people(s);
    const fit = people.filter((u) => G.Units.isFit(s, u)).length;
    const wounded = people.filter((u) => G.Units.woundLevel(u) > 0).length;
    const days = G.Day.waterDaysLeft(s);
    const eNet = G.Base.energyProduction(s) - G.Base.energyUse(s);
    const raid = G.Day.raidChance(s, s.guards + U.sum(s.orders.filter((o) => o.type === 'guard'), (o) => o.unitIds.length));
    return h('div', { class: 'card' },
      h('div', { class: 'tiles' },
        tile('ico-troops', fit + '/' + people.length, wounded ? 'в строю, 🩹' + wounded : 'в строю'),
        tile('ico-water', days >= 99 ? '∞' : days.toFixed(1), 'дней воды', days < 2 ? 'alert' : days < 4 ? 'caution' : ''),
        tile('ico-energy', (eNet >= 0 ? '+' : '') + eNet, 'энергии/сут', eNet < 0 ? 'alert' : ''),
        tile('ico-discipline', String(s.res.discipline), 'дисциплина', s.res.discipline < 35 ? 'alert' : s.res.discipline < 50 ? 'caution' : ''),
        tile('ico-bacta', String(s.items.bacta || 0), 'бакта'),
        tile('ico-alert', G.Actions.riskWord(raid), 'угроза налёта', raid > 0.2 ? 'caution' : '')),
      h('div', { class: 'seg rations' }, ['full', 'reduced', 'minimal'].map((r) =>
        h('button', { class: 'btn small' + (s.rations === r ? ' sel' : ''), title: G.TEXT.rations[r].desc, disabled: s.phase !== 'orders',
          onclick: () => { G.Game.setRations(s, r); UI.commit(); } }, G.TEXT.rations[r].name))));
  }

  // Картинка цели приказа: место на карте или портрет фракции
  function targetPic(id, size) {
    if (id == null) return null;
    if (G.CONFIG.regions[id] && G.TEXT.regions[id]) return G.Avatar.place(id, size);
    if (G.Factions && G.Factions.list.indexOf(id) >= 0) return G.Avatar.faction(id, size);
    return null;
  }

  // ---------- Приказы: одна строка на приказ ----------
  function orderRow(s, o, idx) {
    const T = G.TEXT.actions[o.type];
    const target = G.Actions.targetName(o.type, o.target);
    const nPeople = o.unitIds.filter((id) => G.Units.byId(s, id).kind !== 'droid').length;
    const nDroids = o.unitIds.length - nPeople;
    return h('div', { class: 'order' },
      targetPic(o.target, 36) || h('div', { class: 'oi' }, T.icon),
      h('div', { class: 'ob' },
        h('div', { class: 'ot' }, T.name + (target ? ' → ' + target : ''),
          o.unitIds.length ? h('span', { class: 'chip mini' }, '👤' + nPeople + (nDroids ? ' 🤖' + nDroids : '')) : null),
        h('div', { class: 'small muted clamp1' }, G.Game.preview(s, o))),
      h('button', { class: 'btn small ghost', title: 'Отменить приказ', onclick: () => { G.Game.removeOrder(s, idx); UI.commit(); } }, '✕'));
  }

  function ordersCard(s) {
    const left = G.Game.ordersLeft(s);
    const free = G.Game.freeCounts(s);
    const card = h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, 'Приказы'), h('span', { class: 'mono muted' }, s.orders.length + '/' + G.CONFIG.orders.perDay + ' · в лагере 👤' + free.people + (free.droids ? ' 🤖' + free.droids : ''))));
    s.orders.forEach((o, i) => card.appendChild(orderRow(s, o, i)));
    if (UI.builder) card.appendChild(UI.builderView(s));
    else if (left > 0 && s.phase === 'orders') {
      card.appendChild(h('button', { class: 'btn add-order', onclick: () => { UI.builder = { step: 'type' }; UI.render(); } }, '+ Приказ'));
    }
    card.appendChild(h('button', { class: 'btn primary big end-day', disabled: s.phase !== 'orders' || !!s.pending || !!s.over, onclick: () => {
      UI.builder = null;
      UI.reportOpen = false;
      G.Game.endDay(s);
      UI.dayTransition(s);
      UI.commit();
      window.scrollTo(0, 0);
    } }, '☀ Завершить день ▸'));
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
      box.appendChild(h('div', { class: 'actions-grid' }, G.Actions.list.filter((type) => !(G.Actions.defs[type].hidden && G.Actions.defs[type].hidden(s))).map((type) => {
        const T = G.TEXT.actions[type];
        const why = actionAvailability(s, type);
        return h('button', { class: 'act', disabled: !!why, title: why || T.desc, onclick: () => {
          const def = G.Actions.defs[type];
          b.type = type; b.target = null; b.err = null;
          b.step = def.targets ? 'target' : 'squad';
          initSquad(s, b);
          UI.render();
        } }, h('div', { class: 'an' }, h('span', { class: 'ai' }, T.icon), T.name), why ? h('div', { class: 'ad' }, why) : null);
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
          targetPic(id, 40),
          h('div', { class: 'tb' },
            h('div', { class: 'tn' }, G.Actions.targetName(b.type, id)),
            h('div', { class: 'td' }, why || targetInfo(s, b.type, id))));
      })));
      return box;
    }

    // Отряд и подтверждение
    const cfg = G.CONFIG.actions[b.type] || {};
    const free = G.Game.freeCounts(s);
    box.appendChild(h('div', { class: 'row between', style: 'margin-bottom:8px' },
      h('h3', null, T.icon + ' ' + T.name + (b.target ? ' — ' + G.Actions.targetName(b.type, b.target) : '')),
      h('div', { class: 'row' }, def.targets ? back('target') : back('type'), cancel)));

    // Ползунки: состав отряда меняется на лету, без перерисовки всего экрана
    const faces = h('div', { class: 'squad-faces' });
    const prevBox = h('div', { class: 'preview' });
    const errBox = h('div', { class: 'err' });
    const okBtn = h('button', { class: 'btn primary', style: 'width:100%;margin-top:6px' }, 'Отдать приказ');
    let current = null;
    const refresh = () => {
      current = G.Game.makeOrder(s, b.type, b.target, b.troopers, b.droids);
      const err = G.Game.validateOrder(s, current);
      const prev = G.Game.preview(s, current);
      prevBox.textContent = prev || '';
      prevBox.style.display = prev ? '' : 'none';
      errBox.textContent = err || '';
      okBtn.disabled = !!err;
      G.Dom.clear(faces);
      const ids = current.unitIds || [];
      for (const id of ids.slice(0, 16)) { const u = G.Units.byId(s, id); if (u) faces.appendChild(G.Avatar.img(u, 30)); }
      if (ids.length > 16) faces.appendChild(h('span', { class: 'more' }, '+' + (ids.length - 16)));
    };
    if (!def.noSquad) {
      const maxT = Math.min(cfg.max, free.people);
      const maxD = cfg.droids ? Math.min(free.droids, cfg.max) : 0;
      b.troopers = U.clamp(b.troopers, 0, maxT);
      b.droids = U.clamp(b.droids, 0, maxD);
      const slider = (icon, key, max) => {
        const val = h('span', { class: 'slider-val mono' }, String(b[key]));
        const input = h('input', { type: 'range', min: 0, max: max, step: 1, value: b[key], class: 'slider', 'aria-label': key });
        input.addEventListener('input', () => { b[key] = Number(input.value); val.textContent = b[key]; refresh(); });
        return h('div', { class: 'slider-row' }, h('span', { class: 'slider-ico' }, icon), input, val, h('span', { class: 'muted small mono' }, '/' + max));
      };
      box.appendChild(slider('👤', 'troopers', maxT));
      if (cfg.droids && free.droids) box.appendChild(slider('🤖', 'droids', maxD));
      box.appendChild(faces);
    }
    box.appendChild(prevBox);
    box.appendChild(errBox);
    okBtn.addEventListener('click', () => {
      const e = G.Game.addOrder(s, current);
      if (e) { errBox.textContent = e; return; }
      UI.builder = null;
      UI.commit();
    });
    box.appendChild(okBtn);
    refresh();
    return box;
  };

  // ---------- Пути домой ----------
  function goalsCard(s) {
    const T = G.TEXT.goals;
    const card = h('div', { class: 'card goals' }, h('h2', null, T.title));
    if (s.signal) {
      const d = G.Goals.daysToFleet(s);
      card.appendChild(h('div', { class: 'countdown' }, d > 0 ? 'Флот прибудет через ' + U.pl(d, F.day) + '. Держитесь!' : 'Флот на подходе — сегодня!'));
    }
    const comms = s.sections.comms;
    const cmax = G.Base.maxLevel('comms');
    const modNeed = G.Goals.modulesNeeded(s);
    card.appendChild(h('div', { class: 'goal' },
      h('div', { class: 'row between' }, h('b', null, '✆ ' + T.comms), h('span', { class: 'mono' }, comms.level + '/' + cmax)),
      bar(comms.level, cmax, 'blue'),
      h('div', { class: 'small muted' }, G.Goals.commsReady(s)
        ? (s.signal ? 'Сигнал отправлен.' : 'Узел восстановлен — отдайте приказ «Вызвать флот».')
        : 'Ремонт узла на вкладке «Лагерь». Модулей связи: ' + (s.items.commModule || 0) + ' из ' + modNeed + ' нужных.')));
    const hp = s.items.hyperParts || 0, fuel = s.items.fuel || 0;
    const sc = G.CONFIG.projects.shuttle.cost.items;
    card.appendChild(h('div', { class: 'goal' },
      h('div', { class: 'row between' }, h('b', null, '➶ ' + T.shuttle), h('span', { class: 'mono' }, s.shuttleReady ? 'готов' : '')),
      s.shuttleReady ? null : bar(Math.min(hp, sc.hyperParts) + Math.min(fuel, sc.fuel), sc.hyperParts + sc.fuel, 'sand'),
      h('div', { class: 'small muted' }, s.shuttleReady ? 'Отдайте приказ «Старт шаттла», когда будете готовы.'
        : s.sections.hangar.level < 1 ? T.noHangar + ' Детали гипердвигателя: ' + hp + '/' + sc.hyperParts + ', топливо: ' + fuel + '/' + sc.fuel + '.'
          : 'Детали гипердвигателя: ' + hp + '/' + sc.hyperParts + ', топливо: ' + fuel + '/' + sc.fuel + '. Ремонт — приказ «Инженерные работы».')));
    return card;
  }

  UI.views.hq = function (s) {
    return h('div', { class: 'cols hq' },
      h('div', null, campScene(s), reportCard(s)),
      h('div', null, statusCard(s), ordersCard(s), UI.terminalBrief ? UI.terminalBrief(s) : null, goalsCard(s))
    );
  };
})(globalThis.G = globalThis.G || {});
