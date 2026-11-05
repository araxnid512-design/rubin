/* Вкладка «Лагерь»: живая сцена со стройкой, палитра построек, отсеки, техника. */
(function (G) {
  'use strict';
  const { h, bar } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};
  UI.campSel = null; // { t: тип постройки } — ставим; { id } — выбрана построенная

  function costChips(cost) {
    const out = [];
    if (cost.scrap) out.push(h('span', { class: 'cost' }, h('i', { class: 'ico ico-scrap' }), cost.scrap));
    if (cost.energy) out.push(h('span', { class: 'cost' }, h('i', { class: 'ico ico-energy' }), cost.energy));
    return out;
  }

  function onCell(s, x, y) {
    const sel = UI.campSel;
    const at = G.Camp.at(s, x, y);
    if (sel && sel.t) {
      if (at) { UI.campSel = { id: at.id }; UI.render(); return; }
      const err = G.Camp.build(s, sel.t, x, y);
      if (err) { UI.flash(err); return; }
      G.CampView.puff(x, y);
      if (G.Audio) G.Audio.sfx('build');
      UI.commit();
      return;
    }
    UI.campSel = at ? { id: at.id } : null;
    UI.render();
  }

  function palette(s) {
    const C = G.CONFIG.camp.items;
    const sel = UI.campSel;
    const box = h('div', { class: 'palette' });
    for (const t of Object.keys(C)) {
      const T = G.TEXT.camp[t];
      const why = G.Camp.canBuild(s, t);
      const n = G.Camp.count(s, t);
      const kit = C[t].kit ? ' · комплектов ' + (G.Camp.ensure(s).kits[t] || 0) : '';
      box.appendChild(h('button', { class: 'pal' + (sel && sel.t === t ? ' sel' : '') + (why ? ' dim' : ''), title: why || T.desc,
        onclick: () => { UI.campSel = sel && sel.t === t ? null : { t: t }; UI.render(); } },
        h('span', { class: 'pal-ico' }, T.icon),
        h('span', { class: 'pal-name' }, T.name),
        h('span', { class: 'pal-meta' }, costChips(C[t].cost), h('span', { class: 'mono muted' }, n + '/' + C[t].max + kit))));
    }
    return box;
  }

  function selectionInfo(s) {
    const sel = UI.campSel;
    if (!sel) return h('p', { class: 'small muted' }, 'Выберите постройку и нажмите на клетку перед корпусом.');
    if (sel.t) {
      const T = G.TEXT.camp[sel.t];
      const why = G.Camp.canBuild(s, sel.t);
      return h('p', { class: 'small' }, h('b', null, T.icon + ' ' + T.name), ' — ' + T.desc + (why ? ' ' : ''), why ? h('span', { class: 'bad' }, why) : null);
    }
    const it = G.Camp.ensure(s).items.find((i) => i.id === sel.id);
    if (!it) return null;
    const T = G.TEXT.camp[it.t];
    const c = G.CONFIG.camp.items[it.t];
    return h('div', { class: 'row between small' },
      h('span', null, h('b', null, T.icon + ' ' + T.name), ' — ' + T.desc),
      h('button', { class: 'btn small danger', onclick: () => { G.Camp.demolish(s, it.id); UI.campSel = null; UI.commit(); } },
        'Снести (+' + Math.floor((c.cost.scrap || 0) * G.CONFIG.camp.refund) + ' металла)'));
  }

  function sectionRow(s, id) {
    const sec = s.sections[id];
    const T = G.TEXT.sections[id];
    const max = G.Base.maxLevel(id);
    const cost = G.Base.nextCost(s, id);
    const can = s.phase === 'orders' && G.Game.ordersLeft(s) > 0;
    const check = cost ? G.Base.canRepair(s, id) : null;
    const pips = [];
    for (let k = 1; k <= max; k++) pips.push(h('i', { class: 'pip' + (k <= sec.level ? ' on' : '') }));
    return h('div', { class: 'sec-row', title: T.desc + (UI.sectionEffect ? ' ' + UI.sectionEffect(s, id) : '') },
      h('div', { class: 'sec-name' }, h('b', null, T.name), h('span', { class: 'pips' }, pips)),
      cost ? h('div', { class: 'sec-bar' }, bar(sec.progress, cost.work, 'sand'),
        h('span', { class: 'small ' + (check.ok ? 'muted' : 'warn') }, sec.paid ? 'идёт ремонт' : costChips(cost), cost.items ? ' + ' + G.Res.costText({ items: cost.items }) : ''))
        : h('div', { class: 'sec-bar good small' }, 'восстановлен'),
      cost ? h('button', { class: 'btn small', disabled: !can || !check.ok, title: check.ok ? '' : check.reason, onclick: () => UI.openBuilder('repair', id) }, '⚙') : null);
  }

  UI.sectionEffect = function (s, id) {
    const C = G.CONFIG.sections[id];
    const lv = s.sections[id].level;
    switch (id) {
      case 'reactor': return 'Сейчас +' + C.energy[lv] + ' энергии в сутки.';
      case 'vapor': return lv ? 'Сейчас +' + C.water[lv] + ' л воды в сутки.' : '';
      case 'medbay': return 'Открывает медиков и медпакеты в бою.';
      case 'sensors': return 'Реже налёты и засады.';
      case 'armory': return 'Тяжёлые штурмовики, снайперы, термодетонаторы; на 2-м уровне — точность.';
      case 'workshop': return 'Дроиды чинятся сами; на 2-м уровне — сборка новых.';
      case 'hangar': return 'Ремонт спидеров, шагохода и шаттла.';
      default: return '';
    }
  };

  function techCard(s) {
    const can = s.phase === 'orders' && G.Game.ordersLeft(s) > 0;
    const projBtn = (key, label) => {
      const lock = G.Progress.projectLock(s, key);
      return h('button', { class: 'btn small', disabled: !can || !!lock, title: lock || '', onclick: () => UI.openBuilder('engineer', key) }, label);
    };
    const vehicles = s.vehicles || [];
    const droids = G.Units.droids(s);
    return h('div', { class: 'card' },
      h('h2', null, 'Техника'),
      vehicles.length ? vehicles.map((v) => h('div', { class: 'row between small', style: 'margin:4px 0' },
        h('span', null, G.Progress.vehicleName(v) + ' — ', h('span', { class: v.ok ? 'good' : 'warn' }, v.ok ? 'на ходу' : 'сломан')),
        v.ok ? null : projBtn('fix:' + v.id, '⚒ Чинить')))
        : h('p', { class: 'small muted' }, 'Найдите при разборе обломков или купите у джав.'),
      h('div', { class: 'row between small', style: 'margin-top:6px' },
        h('span', null, '🤖 Дроиды: ' + droids.map((d) => d.health + '%').join(' · ')),
        h('span', { class: 'row' }, projBtn('droid_repair', '⚒ Чинить'), projBtn('droid_build', '⚒ Новый'))));
  }

  UI.views.base = function (s) {
    const eNet = G.Base.energyProduction(s) - G.Base.energyUse(s);
    const items = Object.keys(G.TEXT.items).filter((k) => s.items[k] > 0);
    const view = G.CampView(s, { cols: [0, 15], rows: [0, 15], build: true, maxCell: 42,
      maxHeight: () => (UI.isLandscapePhone() ? (globalThis.innerHeight || 360) - 60 : (globalThis.innerHeight || 800) * 0.72),
      onCell: (x, y) => onCell(s, x, y) });
    return h('div', { class: 'cols base-cols' },
      h('div', null,
        h('div', { class: 'card camp-card' }, view.el,
          h('div', { class: 'eco' },
            h('span', { class: 'chip' }, h('i', { class: 'ico ico-water' }), '+' + G.Base.waterProduction(s) + ' л/сут'),
            h('span', { class: 'chip' + (eNet < 0 ? ' alert' : '') }, h('i', { class: 'ico ico-energy' }), (eNet >= 0 ? '+' : '') + eNet + '/сут'),
            h('span', { class: 'chip' }, h('i', { class: 'ico ico-scrap' }), '~' + s.regions.crash.scrap + ' в обломках'),
            items.map((k) => h('span', { class: 'chip' }, G.TEXT.items[k].name + ' ×' + s.items[k]))))),
      h('div', null,
        h('div', { class: 'card' }, h('h2', null, 'Стройка'), palette(s), selectionInfo(s)),
        h('div', { class: 'card' }, h('h2', null, 'Отсеки корабля'), Object.keys(G.CONFIG.sections).map((id) => sectionRow(s, id))),
        techCard(s)));
  };
})(globalThis.G = globalThis.G || {});
