/*
 * Разделы меню: Справочник (противники, наши бойцы, места, фракции, черты), Награды, Статистика.
 * Плюс всплывающее окно новой награды.
 */
(function (G) {
  'use strict';
  const { h } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  const A = () => G.Avatar;

  UI.menuTab = 'settings';
  UI.codexTab = 'enemies';

  UI.MENU_TABS = [
    { id: 'settings', name: 'Настройки', icon: '⚙' },
    { id: 'codex', name: 'Справочник', icon: '❖' },
    { id: 'medals', name: 'Награды', icon: '✪' },
    { id: 'stats', name: 'Статистика', icon: '▤' },
  ];

  UI.menuTabs = function () {
    return h('div', { class: 'subtabs' }, UI.MENU_TABS.map((t) =>
      h('button', { class: 'subtab' + (UI.menuTab === t.id ? ' sel' : ''), onclick: () => { UI.menuTab = t.id; UI.render(); } },
        h('span', { class: 'ti' }, t.icon), t.name,
        t.id === 'medals' && UI.s ? h('span', { class: 'badge' }, G.Medals.count(UI.s) + '/' + G.Medals.list.length) : null)));
  };

  // ---------- СПРАВОЧНИК ----------
  const ENEMY_ORDER = ['tusken', 'tusken_rifle', 'tusken_chief', 'bandit', 'swoop', 'bandit_boss', 'scavenger', 'scav_droid', 'scav_boss',
    'deserter', 'deserter_heavy', 'deserter_captain', 'rebel', 'rebel_heavy', 'rebel_officer', 'jawa', 'smuggler', 'farmer',
    'hutt_guard', 'gamorrean', 'bounty_hunter', 'assassin_droid', 'krayt'];
  const OURS = ['trooper', 'sand', 'heavy', 'sniper', 'scout', 'medic', 'droid', 'merc', 'walker', 'turret'];

  function statLine(t) {
    const c = G.CONFIG.battle.types[t];
    if (!c) return null;
    const bar = (label, v, max, cls) => h('div', { class: 'cx-stat' }, h('span', null, label),
      h('i', { class: 'cx-bar ' + (cls || '') }, h('b', { style: 'width:' + Math.min(100, Math.round(v / max * 100)) + '%' })));
    return h('div', { class: 'cx-stats' },
      bar('Здоровье', Math.min(c.hp, 200), 200, 'hp'),
      bar('Броня', c.armor, 8),
      bar('Меткость', c.acc, 80, 'acc'),
      bar('Дальность', c.range, 12, 'rng'),
      bar('Урон', (c.dmg[0] + c.dmg[1]) / 2, 50, 'dmg'));
  }

  function enemyCard(s, t) {
    const seen = s.seen && s.seen[t] != null;
    const name = U.cap(G.BattleText.nom(t));
    if (!seen) {
      return h('div', { class: 'cx-card unknown' },
        A().enemy(t, 64, 'cx-shadow'),
        h('div', { class: 'cx-body' }, h('b', null, '???'), h('div', { class: 'small muted' }, 'Ещё не встречались в бою.')));
    }
    const c = G.CONFIG.battle.types[t] || {};
    const tags = [];
    if (c.leader) tags.push('вожак');
    if (c.abil && c.abil.kind === 'nade') tags.push('гранаты');
    if (c.abil && c.abil.kind === 'cry') tags.push('боевой клич');
    if (c.abil && c.abil.kind === 'roar') tags.push('рёв');
    if (c.range <= 1) tags.push('рукопашная');
    if (c.burst) tags.push('очереди');
    if (c.blast) tags.push('взрывается');
    if (c.ion) tags.push('ион');
    if (c.morale == null) tags.push('без страха');
    return h('div', { class: 'cx-card' },
      A().enemy(t, 64),
      h('div', { class: 'cx-body' },
        h('div', { class: 'row between' }, h('b', null, name), h('span', { class: 'small good' }, 'сражено: ' + s.seen[t])),
        h('div', { class: 'small' }, (G.TEXT.codex.enemies[t] || '')),
        tags.length ? h('div', { class: 'cx-tags' }, tags.map((x) => h('span', null, x))) : null,
        statLine(t)));
  }

  function oursCard(t) {
    return h('div', { class: 'cx-card' },
      A().figure(t, 64),
      h('div', { class: 'cx-body' },
        h('b', null, U.cap(G.BattleText.nom(t))),
        h('div', { class: 'small' }, G.TEXT.codex.ours[t] || ''),
        statLine(t)));
  }

  function placeCard(s, id) {
    const r = s.regions[id], c = G.CONFIG.regions[id], T = G.TEXT.regions[id];
    if (!r || !r.known) {
      return h('div', { class: 'cx-card unknown' }, h('span', { class: 'cx-q' }, '?'), h('div', { class: 'cx-body' }, h('b', null, '???'), h('div', { class: 'small muted' }, 'Место ещё не найдено.')));
    }
    const kind = { base: 'наш лагерь', wild: 'пустошь', town: 'поселение', hostile: 'вражеский лагерь' }[c.kind];
    return h('div', { class: 'cx-card click', onclick: () => { UI.mapSel = id; UI.go('map'); } },
      A().place(id, 64),
      h('div', { class: 'cx-body' },
        h('div', { class: 'row between' }, h('b', null, T.name), r.cleared ? h('span', { class: 'small good' }, 'разгромлен') : null),
        h('div', { class: 'small muted' }, kind + (G.TEXT.terrain[c.terrain] ? ' · ' + G.TEXT.terrain[c.terrain] : '') + (id !== 'crash' ? ' · разведано ' + r.explored + '%' : '')),
        h('div', { class: 'small' }, G.TEXT.codex.terrain[c.terrain] || '')));
  }

  function factionCard(s, f) {
    const T = G.TEXT.factions[f], F = G.Factions;
    const v = F.rel(s, f), st = F.status(v);
    const met = F.contact(s, f) || s.flags['hostile_' + f] || v !== (G.CONFIG.start.relations[f] || 0);
    return h('div', { class: 'cx-card' + (met ? '' : ' unknown') },
      met ? A().faction(f, 64) : h('span', { class: 'cx-q' }, '?'),
      h('div', { class: 'cx-body' },
        h('div', { class: 'row between' }, h('b', null, T.name), met ? h('span', { class: 'small ' + st.cls }, st.word) : null),
        h('div', { class: 'small' }, met ? T.desc : 'Связи пока нет.')));
  }

  function traitCard(id) {
    const T = G.TEXT.traits[id];
    return h('div', { class: 'cx-card' },
      h('span', { class: 'cx-q trait-ico' }, T.icon || '•'),
      h('div', { class: 'cx-body' }, h('b', null, T.name), h('div', { class: 'small' }, T.desc)));
  }

  const CODEX_TABS = [['enemies', 'Противники'], ['ours', 'Наши'], ['places', 'Места'], ['factions', 'Фракции'], ['traits', 'Черты']];
  function codexView(s) {
    let list;
    const t = UI.codexTab;
    if (t === 'ours') list = OURS.map(oursCard);
    else if (t === 'places') list = Object.keys(G.CONFIG.regions).filter((id) => !G.CONFIG.regions[id].hidden || s.regions[id].known).map((id) => placeCard(s, id));
    else if (t === 'factions') list = G.Factions.list.map((f) => factionCard(s, f));
    else if (t === 'traits') list = Object.keys(G.TEXT.traits).map(traitCard);
    else list = ENEMY_ORDER.filter((x) => G.CONFIG.battle.types[x]).map((x) => enemyCard(s, x));
    const seenN = ENEMY_ORDER.filter((x) => s.seen && s.seen[x] != null).length;
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, 'Справочник'),
        t === 'enemies' ? h('span', { class: 'small muted' }, 'встречено ' + seenN + ' из ' + ENEMY_ORDER.length) : null),
      h('div', { class: 'chips-row' }, CODEX_TABS.map(([id, name]) =>
        h('button', { class: 'btn small' + (t === id ? ' sel' : ''), onclick: () => { UI.codexTab = id; UI.render(); } }, name))),
      h('div', { class: 'cx-grid' }, list));
  }

  // ---------- НАГРАДЫ ----------
  function medalsView(s) {
    const M = G.Medals;
    const cards = M.list.map((m) => {
      const T = G.TEXT.medals[m.id];
      const got = M.has(s, m.id);
      const pr = !got ? M.progress(s, m) : null;
      return h('div', { class: 'medal-card' + (got ? ' got' : '') },
        A().medal(m, got, 60),
        h('div', { class: 'cx-body' },
          h('b', null, T.name),
          h('div', { class: 'small' }, T.desc),
          got ? h('div', { class: 'small good' }, 'получена в день ' + s.medals[m.id])
            : pr ? h('div', { class: 'medal-prog' }, h('i', null, h('b', { style: 'width:' + Math.round(pr[0] / pr[1] * 100) + '%' })), h('span', { class: 'small muted' }, pr[0] + ' / ' + pr[1]))
              : h('div', { class: 'small muted' }, 'не получена')));
    });
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, 'Награды'), h('span', { class: 'small muted' }, M.count(s) + ' из ' + M.list.length)),
      h('div', { class: 'medal-grid' }, cards));
  }

  // ---------- СТАТИСТИКА ----------
  function statsView(s) {
    const S = s.stats;
    const ppl = G.Units.people(s), dr = G.Units.droids(s);
    const winPct = S.battles ? Math.round(S.victories / S.battles * 100) : 0;
    const knownN = Object.keys(s.regions).filter((id) => s.regions[id].known).length;
    const clearedN = Object.keys(s.regions).filter((id) => s.regions[id].cleared).length;
    const tile = (ico, v, label, cls) => h('div', { class: 'stat-tile ' + (cls || '') }, h('span', { class: 'st-ico' }, ico), h('b', null, String(v)), h('span', null, label));
    const best = s.units.filter((u) => u.kills > 0).sort((a, b) => b.kills - a.kills || b.xp - a.xp).slice(0, 5);
    const fallen = s.units.filter((u) => !G.Units.isAlive(u) && u.kind !== 'droid').slice(-6).reverse();
    return h('div', null,
      h('div', { class: 'card' },
        h('h2', null, 'Кампания'),
        h('div', { class: 'small muted', style: 'margin-bottom:8px' }, 'День ' + s.day + ' · сложность: ' + { easy: 'лёгкая', normal: 'обычная', hard: 'тяжёлая' }[s.difficulty]),
        h('div', { class: 'stat-grid' },
          tile('⚔', S.battles, 'боёв'), tile('✪', S.victories, 'побед', 'good'), tile('✕', S.defeats, 'поражений', 'bad'),
          tile('%', winPct + '%', 'побед из боёв'), tile('⌖', S.kills, 'врагов сражено'), tile('✝', S.deaths, 'погибло наших', 'bad'),
          tile('⛊', S.flawless || 0, 'побед без потерь', 'good'), tile('⚡', S.bestStreak || 0, 'лучшая серия'),
          tile('💧', S.waterFound, 'воды добыто, л'), tile('⚙', S.scrapFound, 'металла собрано'), tile('¤', S.trades || 0, 'сделок'),
          tile('◎', knownN + '/' + Object.keys(s.regions).length, 'мест открыто'), tile('⚑', clearedN, 'логов разгромлено'),
          tile('☺', ppl.length, 'людей в строю'), tile('▣', dr.length, 'дроидов'), tile('↯', S.deserted || 0, 'дезертировало', 'bad'))),
      h('div', { class: 'grid2' },
        h('div', { class: 'card' }, h('h2', null, 'Лучшие стрелки'),
          best.length ? best.map((u, i) => h('div', { class: 'top-row' + (G.Units.isAlive(u) ? '' : ' dead') },
            h('span', { class: 'place-n' }, String(i + 1)), A().img(u, 38),
            h('div', { class: 'grow' }, h('b', null, G.Units.fullTitle(u)), h('div', { class: 'small muted' }, U.pl(u.battles || 0, ['бой', 'боя', 'боёв']) + (G.Units.isAlive(u) ? '' : ' · погиб'))),
            h('span', { class: 'kills' }, '⌖ ' + u.kills)))
            : h('p', { class: 'small muted' }, 'Пока никто не отличился.')),
        h('div', { class: 'card' }, h('h2', null, 'Память павших'),
          fallen.length ? fallen.map((u) => h('div', { class: 'top-row dead' }, A().img(u, 34),
            h('div', { class: 'grow' }, h('b', null, G.Units.fullTitle(u)), h('div', { class: 'small muted' }, (u.diedDay ? 'день ' + u.diedDay + ' · ' : '') + (u.cause || 'погиб')))))
            : h('p', { class: 'small muted' }, 'Никто не погиб. Так держать.'))));
  }

  UI.menuSection = function (s, tab) {
    if (tab === 'codex') return codexView(s);
    if (tab === 'medals') return medalsView(s);
    if (tab === 'stats') return statsView(s);
    return null;
  };

  // ---------- новая награда: проверка после каждого действия ----------
  UI.checkMedals = function (s) {
    if (!s || !G.Medals) return;
    const fresh = G.Medals.update(s);
    if (!fresh.length) return;
    // много наград сразу (например, у старого сохранения) — одним сообщением
    UI.medalQueue = (UI.medalQueue || []).concat(fresh.length > 2 ? [{ batch: fresh }] : fresh);
    showMedal();
  };
  function showMedal() {
    if (UI._medalShown || !UI.medalQueue || !UI.medalQueue.length) return;
    const q = UI.medalQueue.shift();
    const m = q.batch ? q.batch.slice().sort((a, b) => b.tier - a.tier)[0] : q;
    const T = q.batch ? { name: 'Получено наград: ' + q.batch.length, desc: q.batch.map((x) => G.TEXT.medals[x.id].name).slice(0, 4).join(', ') + (q.batch.length > 4 ? '…' : '') } : G.TEXT.medals[m.id];
    UI._medalShown = true;
    if (G.Audio) G.Audio.sfx('order');
    const el = h('div', { class: 'medal-toast' }, A().medal(m, true, 56), h('div', null, h('div', { class: 'small' }, 'Новая награда'), h('b', null, T.name), h('div', { class: 'small muted' }, T.desc)));
    document.body.appendChild(el);
    el.onclick = () => { UI.menuTab = 'medals'; UI.go('menu'); };
    setTimeout(() => { el.classList.add('out'); }, 3400);
    setTimeout(() => { el.remove(); UI._medalShown = false; showMedal(); }, 3900);
  }
})(globalThis.G = globalThis.G || {});
