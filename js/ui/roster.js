/* Вкладка «Отряд»: список бойцов, звания, опыт, ранения, павшие. */
(function (G) {
  'use strict';
  const { h, bar } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};

  UI.rosterFilter = 'all';
  UI.rosterOpen = null;

  const FILTERS = [
    ['all', 'Все'],
    ['fit', 'В строю'],
    ['wounded', 'Ранены'],
    ['specs', 'Специалисты'],
    ['droids', 'Дроиды'],
    ['fallen', 'Павшие'],
  ];

  function matches(s, u, f) {
    const alive = G.Units.isAlive(u);
    switch (f) {
      case 'all': return alive;
      case 'fit': return alive && u.kind !== 'droid' && G.Units.woundLevel(u) === 0;
      case 'wounded': return alive && u.kind !== 'droid' && G.Units.woundLevel(u) > 0;
      case 'droids': return alive && u.kind === 'droid';
      case 'specs': return alive && (!!u.spec || u.status === 'training');
      case 'fallen': return !alive;
    }
    return true;
  }

  function nextRankXp(u) {
    const R = G.CONFIG.ranks;
    const i = G.Units.rankIndex(u);
    return i + 1 < R.length ? R[i + 1].xp : null;
  }

  function healthBar(u) {
    const cls = u.health >= 80 ? '' : u.health >= 40 ? 'amber' : 'red';
    return bar(u.health, 100, cls);
  }

  function unitRow(s, u) {
    const open = UI.rosterOpen === u.id;
    const alive = G.Units.isAlive(u);
    const row = h('div', { class: 'unit' + (alive ? '' : ' dead'), onclick: () => { UI.rosterOpen = open ? null : u.id; UI.render(); } },
      G.Avatar.img(u, 36),
      h('div', { class: 'rk' }, G.Units.rankShort(u)),
      h('div', { class: 'nm' }, h('span', { class: 'num' }, u.num), u.name,
        u.spec ? h('span', { class: 'spec' }, G.TEXT.specs ? G.TEXT.specs[u.spec].short : u.spec) : null),
      h('div', { class: 'st' },
        alive ? h('div', null, healthBar(u), h('div', { class: u.health < 40 ? 'bad' : u.health < 80 ? 'warn' : 'muted' }, G.Units.healthLabel(u)))
          : h('span', { class: 'bad' }, G.Units.healthLabel(u)))
    );
    if (!open) return row;
    const nx = nextRankXp(u);
    const det = h('div', { class: 'unit-detail' },
      h('div', { class: 'ud-head' }, G.Avatar.img(u, 84, 'ava-big'),
        h('div', null, h('b', null, U.cap(G.Units.fullTitle(u))), h('div', { class: 'muted' }, G.Units.healthLabel(u)))),
      u.kind === 'trooper' ? h('div', null, 'Опыт: ' + u.xp + (nx ? ' (до следующего звания ' + (nx - u.xp) + ')' : ' — высшее доступное звание')) : null,
      h('div', null, (u.kind === 'droid' ? 'Техсостояние: ' : 'Здоровье: ') + u.health + '%'),
      h('div', null, 'Вылазок: ' + u.missions + ' · боёв: ' + u.battles + ' · уничтожено врагов: ' + u.kills),
      h('div', { class: 'muted' }, G.TEXT.origins[u.origin] + (u.joined > 1 ? ' (день ' + u.joined + ')' : '')),
      !alive ? h('div', { class: 'bad' }, (u.status === 'deserted' ? 'Дезертировал' : 'Погиб') + ' на ' + u.diedDay + '-й день' + (u.cause ? ': ' + u.cause : '') + '.') : null,
      UI.unitExtra ? UI.unitExtra(s, u) : null
    );
    return [row, det];
  }

  // Специализация в карточке бойца
  UI.unitExtra = function (s, u) {
    if (u.kind !== 'trooper' || !G.Units.isAlive(u)) return null;
    const box = h('div', { class: 'spec-box' });
    if (u.status === 'training') {
      box.appendChild(h('div', { class: 'warn' }, 'На подготовке: «' + G.TEXT.specs[u.trainSpec].name + '», вернётся в строй на ' + (u.trainUntil + 1) + '-й день.'));
      return box;
    }
    box.appendChild(h('div', null, 'Специализация: ', h('b', null, u.spec ? G.TEXT.specs[u.spec].name : 'нет'),
      u.spec ? h('span', { class: 'muted' }, ' — ' + G.TEXT.specs[u.spec].desc) : null));
    const row = h('div', { class: 'spec-row' });
    for (const id of G.Progress.specIds()) {
      if (u.spec === id) continue;
      const why = G.Progress.specReq(s, u, id);
      const c = G.CONFIG.specs[id];
      row.appendChild(h('button', { class: 'btn small', disabled: !!why, title: why || G.TEXT.specs[id].desc,
        onclick: (e) => {
          e.stopPropagation();
          UI.confirm('Подготовка: ' + G.TEXT.specs[id].name, G.TEXT.specs[id].desc + '\n\nСтоимость: ' + (G.Res.costText(c.cost) || 'бесплатно') + '. Боец выбудет на ' + U.pl(c.days, U.FORMS.day) + '.' + (u.spec ? ' Прежняя специализация будет утрачена.' : ''), () => {
            const err = G.Progress.train(s, u, id);
            if (err) UI.flash(err);
            UI.commit();
          });
        } }, G.TEXT.specs[id].name + (why ? ' 🔒' : '')));
    }
    box.appendChild(row);
    const reasons = G.Progress.specIds().filter((id) => id !== u.spec).map((id) => {
      const why = G.Progress.specReq(s, u, id);
      return why ? G.TEXT.specs[id].name + ': ' + why : null;
    }).filter(Boolean);
    if (reasons.length) box.appendChild(h('div', { class: 'small muted', style: 'margin-top:4px' }, reasons.join(' · ')));
    return box;
  };

  UI.views.roster = function (s) {
    const all = s.units;
    const people = G.Units.people(s);
    const counts = {
      all: G.Units.alive(s).length,
      fit: people.filter((u) => G.Units.woundLevel(u) === 0).length,
      wounded: people.filter((u) => G.Units.woundLevel(u) > 0).length,
      droids: G.Units.droids(s).length,
      specs: people.filter((u) => u.spec || u.status === 'training').length,
      fallen: all.filter((u) => !G.Units.isAlive(u)).length,
    };
    const list = all.filter((u) => matches(s, u, UI.rosterFilter)).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'trooper' ? -1 : b.kind === 'trooper' ? 1 : a.kind === 'merc' ? -1 : 1;
      return b.xp - a.xp || a.id - b.id;
    });
    const ranks = {};
    for (const u of G.Units.troopers(s)) {
      const r = G.TEXT.ranks[G.Units.rank(u).id].name;
      ranks[r] = (ranks[r] || 0) + 1;
    }
    return h('div', null,
      h('div', { class: 'card' },
        h('h2', null, 'Гарнизон «Железного Предела»'),
        h('p', { class: 'small muted' }, Object.keys(ranks).map((r) => r + ': ' + ranks[r]).join(' · ')),
        h('p', { class: 'small muted' }, 'Штурмовики — конечный ресурс: погибших не вернуть. Пополнение — выжившие из спасательных капсул, наёмники, собранные дроиды.'),
        h('div', { class: 'filters' }, FILTERS.map(([id, name]) =>
          h('button', { class: 'btn small' + (UI.rosterFilter === id ? ' sel' : ''), onclick: () => { UI.rosterFilter = id; UI.render(); } }, name + ' · ' + counts[id])))
      ),
      h('div', { class: 'card', style: 'padding:4px 0' },
        list.length ? list.map((u) => unitRow(s, u)) : h('p', { class: 'muted', style: 'padding:12px' }, 'Никого.'))
    );
  };
})(globalThis.G = globalThis.G || {});
