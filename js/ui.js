'use strict';
// ===== Интерфейс: HUD, окна, ввод, главный цикл =====
let promptNode = null, hudT = 0, miniT = 0, demo = false;
const toasts = $('#toasts'), panel = $('#panel');
function toast(s, cls = '') {
  if (demo) return;
  const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = s; toasts.appendChild(d);
  while (toasts.children.length > 4) toasts.firstChild.remove();
  setTimeout(() => d.remove(), 4200);
}
const spares = () => count(G.p.inv, 'filter') + count(G.p.inv, 'filter2') + count(G.p.inv, 'filter0');
function goalText() {
  const m = modLv;
  if (G.won) return '♦️ Реактор запущен — воздух очищается. Вы победили!';
  if (!m('bench') && !haveAll('axe') && !haveAll('pick')) return loc.bunker ? 'Выйдите через люк 🪜 и соберите ветки, камни, волокно' : 'Соберите ветки, камни, волокно — создайте топор и кирку (🔨)';
  if (!m('bench')) return 'Постройте верстак в бункере (10 🪵, 5 🪨)';
  if (!m('furnace')) return 'Постройте плавильню — железо и уголь';
  if (!m('filt')) return 'Постройте станцию фильтров для дальних вылазок';
  if (!m('kitchen')) return 'Постройте кухню — чистая вода и горячая еда';
  if (!m('radio')) return 'Соберите радиостанцию — задания дают редкие ресурсы';
  if (m('bench') < 2) return 'Улучшите верстак и ищите чертежи в тайниках';
  if (!m('gen')) return 'Соберите генератор (электроника и топливо — в руинах города)';
  if (!m('armory')) return 'Постройте оружейную — на базе и в Эпицентре без стволов тяжело';
  return `Добудьте рубины в Эпицентре (${haveAll('ruby')}/8) и постройте реактор «Рубин»`;
}
function hud() {
  if (!G || !loc || demo) return;
  const p = G.p, mh = maxHp(), el = id => $('#' + id);
  el('b-hp').style.width = clamp(p.hp / mh * 100, 0, 100) + '%'; el('t-hp').textContent = `${Math.ceil(p.hp)} / ${mh}`;
  el('b-hp').parentNode.classList.toggle('low', p.hp / mh < .3);
  el('b-st').style.width = P.st + '%';
  const g = (id, v) => { const e = el(id); e.style.setProperty('--v', clamp(v, 0, 100)); e.classList.toggle('low', v < 20); };
  g('g-hu', p.hunger); g('g-th', p.thirst); g('g-fi', p.filter / p.fcap * 100);
  const sp = spares();
  el('t-fi').textContent = `${Math.ceil(p.filter / p.fcap * 100)}% +${sp}`;
  el('status').innerHTML = (p.bleed > 0 ? '<span class="bad">🩸 кровотечение</span>' : '') + (P.sneak ? '<span class="sn">👣 скрытно</span>' : '');
  el('ava').style.setProperty('--xp', G.xp / xpNeed() * 100); el('lvl').textContent = G.lvl; el('pts').classList.toggle('hidden', !G.pts);
  el('locname').textContent = loc.name;
  const dk = darkness();
  el('clock').textContent = `${dk > .6 ? '🌙' : dk > 0 ? '🌅' : '☀️'} ${clockStr()} · День ${G.day}`;
  el('noise').classList.toggle('hidden', !!loc.bunker || loc.noise < 1); el('b-no').style.width = loc.noise + '%';
  el('goal').textContent = goalText();
  el('m-build').classList.toggle('hidden', !loc.bunker); el('mini').classList.toggle('hidden', !!loc.bunker);
  el('btns').classList.toggle('bunk', !!loc.bunker); el('bSneak').classList.toggle('on', P.sneak);
  const w = p.eq.weapon, wi = w && ITEMS[w.id];
  el('h-wi').textContent = wi ? wi.i : '👊'; el('h-wa').textContent = wi && wi.w.ranged ? count(p.inv, wi.w.ammo) : '';
  el('h-wd').style.setProperty('--d', (wi ? w.d / wi.dur * 100 : 0) + '%'); el('h-wd').style.display = wi ? '' : 'none';
  const q = {eat: 0, drink: 0, heal: 0, filter: sp};
  for (const s of p.inv) if (s && ITEMS[s.id].eat) { const e = ITEMS[s.id].eat; if (e.hunger) q.eat += s.n; if (e.thirst >= 15) q.drink += s.n; if (!e.hunger && !e.thirst) q.heal += s.n; }
  for (const k in q) { el('q-' + k).textContent = q[k] || ''; el('q-' + k).parentNode.classList.toggle('none', !q[k]); }
  // подсказка действия
  const pr = el('prompt'); let txt = '', bad = false;
  promptNode = null;
  if (!ui.panel) {
    if (inExit()) txt = '<kbd>E</kbd>Покинуть локацию';
    else {
      const n = nearestNode(1.7); promptNode = n;
      if (n && !P.gather) {
        if (n.k === 'mod') txt = `<kbd>E</kbd>${modLv(n.mod) ? MODS[n.mod].n : 'Построить: ' + MODS[n.mod].n}`;
        else { const d = NODES[n.k]; bad = d.tool && !findTool(d.tool); txt = `<kbd>E</kbd>${d.v}: ${d.n}` + (bad ? (d.tool === 'axe' ? ' — нужен топор' : ' — нужна кирка') : ''); }
      }
    }
  }
  if (txt) pr.innerHTML = txt;
  pr.classList.toggle('on', !!txt); pr.classList.toggle('bad', !!bad);
}

// ---------- окна ----------
function openPanel(t, tab, arg) {
  ui.panel = t; ui.sel = null; ui.arg = arg;
  if (tab) ui.tab = tab;
  if (t === 'main' && tab === 'craft') ui.cst = arg || 'all';
  if (t === 'map') ui.mapSel = loc.bunker ? (G.last || 'yard') : 'bunker';
  if (P) { P.auto = null; P.gather = null; }
  for (const k in keys) keys[k] = 0; atkHeld = false; joy.id = null; joy.x = joy.y = 0;
  panel.classList.remove('hidden'); panel.classList.toggle('clear', t === 'title'); panel.classList.add('pop'); setTimeout(() => panel.classList.remove('pop'), 220); drawPanel();
}
function closePanel(silent) { ui.panel = null; panel.classList.add('hidden'); panel.innerHTML = ''; if (!silent && loc && loc.bunker) save(); }
const chips = c => '<div class="chips">' + Object.keys(c).map(id => `<span class="chip ${have(id) < c[id] ? 'no' : ''}">${ITEMS[id].i} ${have(id)}/${c[id]}</span>`).join('') + '</div>';
function itemDesc(id) {
  const it = ITEMS[id], a = [];
  if (it.w) a.push(`урон ${it.w.dmg}, дальность ${it.w.rg}` + (it.w.ranged ? `, тратит ${ITEMS[it.w.ammo].n.toLowerCase()}` : ''));
  if (it.tool) a.push(it.tool === 'axe' ? 'рубит деревья' : 'дробит камень и руду');
  if (it.dur) a.push(`прочность ${it.dur}`);
  if (it.armor) a.push(`защита ${Math.round(it.armor * 100)}%`);
  if (it.filt) a.push(`ресурс ${it.filt}`);
  if (it.eat) { const e = it.eat; if (e.hunger) a.push(`сытость +${e.hunger}`); if (e.thirst) a.push(`вода +${e.thirst}`); if (e.hp) a.push(`здоровье ${e.hp > 0 ? '+' : ''}${e.hp}`); }
  if (it.d) a.push(it.d);
  return a.join(' · ');
}
function slotHtml(s, w, i, ph) {
  const sel = ui.sel && ui.sel.w === w && ui.sel.i === i ? ' sel' : '';
  if (!s) return `<div class="slot${ph ? ' ph' : ''}${sel}" data-a="sel" data-w="${w}" data-i="${i}">${ph ? `<span>${ph}</span>` : ''}</div>`;
  const it = ITEMS[s.id];
  return `<div class="slot r${it.r || 0}${sel}" data-a="sel" data-w="${w}" data-i="${i}" title="${it.n}">${it.i}${s.n > 1 ? `<b>${s.n}</b>` : ''}${s.d != null ? `<span class="dur"><i style="width:${s.d / it.dur * 100}%"></i></span>` : ''}</div>`;
}
function selSlot() {
  const s = ui.sel; if (!s) return null;
  return s.w === 'inv' ? G.p.inv[s.i] : s.w === 'st' ? G.storage[s.i] : s.w === 'eqw' ? G.p.eq.weapon : G.p.eq.armor;
}
const pips = (n, max) => max > 1 ? '<span class="pips">' + Array.from({length: max}, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('') + '</span>' : '';
const questReady = c => !c.done && (c.type === 'bring' ? have(c.id) >= c.n : c.prog >= c.n);

function tabInv() {
  const p = G.p, b = loc.bunker, s = selSlot(); let det = '<span style="color:var(--mut)">Выберите предмет</span>';
  if (s) {
    const it = ITEMS[s.id], w = ui.sel.w, acts = [];
    if (w === 'inv') {
      if (it.eat) acts.push('<button class="btn" data-a="use">Использовать</button>');
      if (it.filt) acts.push('<button class="btn" data-a="use">Установить в противогаз</button>');
      if (it.w || it.armor) acts.push('<button class="btn" data-a="use">Экипировать</button>');
      if (b) acts.push('<button class="btn" data-a="tost">На склад</button>');
      acts.push('<button class="btn red" data-a="drop">Выбросить</button>');
    } else if (w === 'st') acts.push('<button class="btn" data-a="toinv">В рюкзак</button>');
    else acts.push('<button class="btn" data-a="uneq">Снять</button>');
    det = `<b style="color:${['#e9e5d4', '#8fd09a', '#8ab8f0', '#f08aa8'][it.r || 0]}">${it.i} ${it.n}</b>${s.n > 1 ? ' ×' + s.n : ''}${s.d != null ? ` (${s.d}/${it.dur})` : ''}<br><span style="color:var(--mut)">${itemDesc(s.id)}</span><div class="acts">${acts.join('')}</div>`;
  }
  const wd = weapon(), a = p.eq.armor;
  return `<div class="row">
    <div class="col" style="flex:0 0 132px;min-width:132px"><h4>Экипировка</h4><div class="grid" style="grid-template-columns:1fr 1fr">${slotHtml(p.eq.weapon, 'eqw', 0, '⚔️')}${slotHtml(p.eq.armor, 'eqa', 0, '🛡️')}</div>
      <div class="stats">Урон <b>${wd.dmg}</b><br>Защита <b>${a ? Math.round(ITEMS[a.id].armor * 100) : 0}%</b><br>Здоровье <b>${maxHp()}</b><br>Убито <b>${G.kills}</b></div></div>
    <div class="col"><h4>Рюкзак ${p.inv.filter(x => x).length}/${p.inv.length} ${b ? '<button class="btn sm" data-a="allst">Ресурсы на склад</button>' : ''}</h4><div class="grid">${p.inv.map((s, i) => slotHtml(s, 'inv', i)).join('')}</div></div>
    ${b ? `<div class="col"><h4>Склад ${G.storage.filter(x => x).length}/${G.storage.length}</h4><div class="grid">${G.storage.map((s, i) => slotHtml(s, 'st', i)).join('')}</div></div>` : ''}
    </div><div class="detail">${det}</div>`;
}
function recState(r) {
  if (r.st !== 'hand') {
    if (!modLv(r.st)) return `Постройте: ${MODS[r.st].n}`;
    if (modLv(r.st) < (r.lv || 1)) return `Нужен ${MODS[r.st].n.toLowerCase()} ур. ${r.lv}`;
    if (!loc.bunker) return 'Только в бункере';
  }
  if (r.bp && !G.bp[r.bp]) { const l = Object.values(LOCS).find(l => l.bps && l.bps.includes(r.bp)); return `Нужен чертёж — тайник: ${l.n}`; }
  if (r.req && !G.ups[r.req]) return 'Сначала нужен обычный рюкзак';
  return '';
}
const recOut = r => (r.k || 1) * (r.st === 'furnace' && modLv('furnace') >= 2 ? 2 : 1);
function tabCraft() {
  const cst = ui.cst || 'all';
  let h = '<div class="chipsel">' + ['all', ...Object.keys(STATIONS)].map(s => `<button class="${cst === s ? 'on' : ''} ${s !== 'all' && s !== 'hand' && !modLv(s) ? 'lock' : ''}" data-a="cst" data-id="${s}">${s === 'all' ? 'Всё' : (s === 'hand' ? '✋ ' : MODS[s].i + ' ') + STATIONS[s]}</button>`).join('') + '</div><div class="cards">';
  const list = RECIPES.map((r, i) => [r, i]).filter(([r]) => (cst === 'all' || r.st === cst) && !(r.up && G.ups[r.up]));
  const rank = r => recState(r) ? 2 : canPay(r.c) ? 0 : 1;
  list.sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]);
  for (const [r, i] of list) {
    const it = r.out ? ITEMS[r.out] : r, lock = recState(r), can = !lock && canPay(r.c), k = recOut(r);
    h += `<div class="rec ${lock ? 'off' : can ? 'can' : ''}"><div class="ic" style="--rc:${RARITY[it.r || 0]}">${it.i}</div><div class="inf"><div class="nm">${it.n}${k > 1 ? ' ×' + k : ''}</div><div class="ds">${r.out ? itemDesc(r.out) : r.d}</div>${lock ? `<div class="lockmsg">🔒 ${lock}</div>` : chips(r.c)}</div><button class="btn" data-a="craft" data-i="${i}" ${can ? '' : 'disabled'}>Создать</button></div>`;
  }
  return h + '</div>';
}
function tabBuild() {
  let h = '<div class="cards">';
  const ids = Object.keys(MODS).filter(id => MODS[id].lv).sort((a, b) => (a === ui.arg ? -1 : b === ui.arg ? 1 : 0));
  for (const id of ids) {
    const m = MODS[id], lv = modLv(id), max = m.lv.length, done = lv >= max, rq = m.req && !modLv(m.req), cost = done ? null : m.lv[lv], can = !done && !rq && loc.bunker && canPay(cost);
    h += `<div class="rec ${can ? 'can' : ''}"><div class="ic">${m.i}</div><div class="inf"><div class="nm">${m.n}${pips(lv, max)}</div><div class="ds">${m.d}${lv ? ` · сейчас: ${m.fx[lv - 1]}` : ''}</div>
      ${done ? '' : `<div class="ds" style="color:#d8c98a">${lv ? 'Улучшение' : 'Даёт'}: ${m.fx[lv]}</div>` + (rq ? `<div class="lockmsg">🔒 Требуется: ${MODS[m.req].n}</div>` : chips(cost))}</div>
      ${done ? '<span style="color:var(--grn);font-weight:800">✓</span>' : `<button class="btn ${lv ? 'gold' : ''}" data-a="build" data-id="${id}" ${can ? '' : 'disabled'}>${lv ? 'Улучшить' : 'Построить'}</button>`}</div>`;
  }
  return h + '</div>' + (loc.bunker ? '' : '<p class="warn">Строить можно только находясь в бункере.</p>');
}
function tabPerks() {
  let h = `<div class="sect">Уровень ${G.lvl} · опыт ${Math.floor(G.xp)} / ${xpNeed()}</div><div class="xpbar"><i style="width:${G.xp / xpNeed() * 100}%"></i></div>`;
  if (G.pts > 0 && G.offer && G.offer.length) {
    h += `<div class="sect" style="color:var(--acc)">Выберите навык · очков: ${G.pts}</div><div class="offer">` + G.offer.map(id => `<button data-a="perk" data-id="${id}"><span>${PERKS[id].i}</span><b>${PERKS[id].n}${pips(pk(id), 3)}</b><small>${PERKS[id].d}</small></button>`).join('') + '</div>';
  } else h += '<p>Опыт даётся за убийства, добычу, крафт и задания. Каждый уровень — новый навык на выбор.</p>';
  h += '<div class="sect">Изученные навыки</div><div class="cards">';
  for (const id in PERKS) h += `<div class="rec ${pk(id) ? '' : 'off'}"><div class="ic">${PERKS[id].i}</div><div class="inf"><div class="nm">${PERKS[id].n}${pips(pk(id), 3)}</div><div class="ds">${PERKS[id].d}</div></div></div>`;
  return h + '</div>';
}
function tabQuests() {
  let h = '<div class="sect">Задания по рации</div>';
  if (!modLv('radio')) h += '<p>Постройте радиостанцию в бункере — другие выжившие будут присылать задания с наградой редкими ресурсами.</p>';
  else if (!G.contracts.length) h += '<p>Новые задания придут в начале следующего дня.</p>';
  else {
    h += '<div class="cards">';
    G.contracts.forEach((c, i) => {
      const br = c.type === 'bring', nm = br ? `Принести: ${ITEMS[c.id].n} ×${c.n}` : `Уничтожить: ${ENEMIES[c.id].n} ×${c.n}`, cur = br ? Math.min(c.n, have(c.id)) : c.prog;
      h += `<div class="rec ${c.done ? 'off' : questReady(c) ? 'can' : ''}"><div class="ic">${br ? ITEMS[c.id].i : '💀'}</div><div class="inf"><div class="nm">${nm}</div><div class="ds">${c.done ? 'Выполнено' : `Прогресс: ${cur}/${c.n}`}${br && !loc.bunker ? ' (сдаётся в бункере)' : ''}</div>
        <div class="chips">${c.rw.map(r => `<span class="chip">${ITEMS[r[0]].i} +${r[1]}</span>`).join('')}<span class="chip">⭐ +${c.xp} опыта</span></div></div>
        ${c.done ? '<span style="color:var(--grn);font-weight:800">✓</span>' : `<button class="btn gold" data-a="turnin" data-i="${i}" ${questReady(c) && (!br || loc.bunker) ? '' : 'disabled'}>Сдать</button>`}</div>`;
    });
    h += '</div>';
  }
  h += '<div class="sect">Чертежи</div><div class="cards">';
  for (const b in BPS) { const l = Object.values(LOCS).find(l => l.bps && l.bps.includes(b)); h += `<div class="rec ${G.bp[b] ? 'can' : 'off'}"><div class="ic">${G.bp[b] ? '📜' : '❔'}</div><div class="inf"><div class="nm">${BPS[b]}</div><div class="ds">${G.bp[b] ? 'Изучен' : 'Тайник: ' + l.n}</div></div></div>`; }
  return h + '</div>';
}
function mapHtml() {
  const p = G.p, sel = ui.mapSel, here = loc.bunker ? 'bunker' : loc.id, B = {mx: 50, my: 56};
  const col = d => ['#7a8a4a', '#9aa845', '#d0a840', '#d07030', '#d03030'][d - 1];
  let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">', pins = '';
  for (const id in LOCS) { const l = LOCS[id]; svg += `<line x1="${B.mx}" y1="${B.my}" x2="${l.mx}" y2="${l.my}" stroke="${sel === id ? '#e0b84a' : '#ffffff30'}" stroke-width="${sel === id ? 2 : 1.2}" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>`; }
  svg += '</svg>';
  pins += `<button class="pin ${sel === 'bunker' ? 'on' : ''} ${here === 'bunker' ? 'here' : ''}" style="left:${B.mx}%;top:${B.my}%;--pc:#e0b84a" data-a="mappick" data-id="bunker"><i>🏠</i><span>Бункер</span></button>`;
  for (const id in LOCS) { const l = LOCS[id]; pins += `<button class="pin ${sel === id ? 'on' : ''} ${here === id ? 'here' : ''}" style="left:${l.mx}%;top:${l.my}%;--pc:${col(l.danger)}" data-a="mappick" data-id="${id}"><i>${'☠️'}</i><span>${l.n}</span></button>`; }
  const sp = spares(); let info;
  const kit = `<div class="mt">😷 Фильтр <b>${Math.ceil(p.filter / p.fcap * 100)}%</b>, запасных <b>${sp}</b>${sp === 0 && p.filter < 50 ? ' <span class="warn">— мало!</span>' : ''}<br>🎒 Свободно ячеек: <b>${p.inv.filter(x => !x).length}</b></div>`;
  if (sel === 'bunker') info = `<h3>🏠 Бункер «Рубин»</h3><div class="ds">Безопасное убежище: склад, мастерские и койка. Прогресс сохраняется при возвращении.</div>${kit}<button class="btn big" data-a="go" data-id="bunker" ${here === 'bunker' ? 'disabled' : ''}>${here === 'bunker' ? 'Вы здесь' : 'Вернуться домой'}</button>`;
  else {
    const l = LOCS[sel], bp = l.bps ? l.bps.filter(b => !G.bp[b]).length : 0;
    info = `<h3>${l.n}</h3><div class="ds">${l.d}</div><div class="mt">Опасность: ${'☠️'.repeat(l.danger)}<br>Токсичность: <b>×${l.tox}</b> — фильтра хватит на ~${Math.round(160 / l.tox / 60 * 10) / 10} мин<br>Добыча: ${l.loot}${l.bps ? `<br>📜 Чертежей в тайнике: <b>${bp}</b>` : ''}${darkness() > .5 ? '<br><span class="warn">🌙 Сейчас ночь — намного опаснее</span>' : ''}</div>${kit}
      <button class="btn big gold" data-a="go" data-id="${sel}" ${here === sel ? 'disabled' : ''}>${here === sel ? 'Вы здесь' : 'В путь'}</button>`;
  }
  return `<div class="win"><div class="main"><div class="ptitle"><span>Карта вылазок<small>${clockStr()} · День ${G.day}</small></span><button data-a="close">✕</button></div>
    <div class="pbody" style="display:flex"><div class="mapwrap"><div class="map">${svg}${pins}</div><div class="mapinfo">${info}</div></div></div></div></div>`;
}
const TABS = {inv: ['🎒', 'Рюкзак'], craft: ['🔨', 'Крафт'], build: ['🏗️', 'Бункер'], perks: ['⭐', 'Навыки'], quests: ['📻', 'Задания']};
function drawPanel() {
  const t = ui.panel; let h = '';
  const head = s => `<div class="win narrow"><div class="ptitle"><span>${s}</span><button data-a="close">✕</button></div><div class="pbody">`;
  if (t === 'title') {
    h = `<div class="win narrow"><div class="title"><h1>БУНКЕР «РУБИН»</h1><h2>Мир наверху отравлен. У вас есть убежище, противогаз и последний фильтр.</h2>
      ${load() ? '<button class="btn big gold" data-a="continue">Продолжить</button>' : ''}<button class="btn big ${load() ? 'red' : 'gold'}" data-a="new">Новая игра</button>
      <div class="keys"><kbd>WASD</kbd> движение · <kbd>E</kbd> действие · <kbd>Пробел</kbd> атака · <kbd>Shift</kbd> рывок · <kbd>Q</kbd> красться<br>
      <kbd>I</kbd> рюкзак · <kbd>C</kbd> крафт · <kbd>B</kbd> бункер · <kbd>K</kbd> навыки · <kbd>J</kbd> задания · <kbd>1</kbd>–<kbd>4</kbd> быстрые предметы<br>На телефоне: джойстик слева, кнопки справа</div></div></div>`;
  } else if (t === 'help') {
    h = head('Как выжить') + `<p>😷 <b>Фильтр.</b> Наверху противогаз расходует фильтр — тем быстрее, чем токсичнее место. Без фильтра вы задыхаетесь. Запасные ставятся сами.</p>
      <p>🪓 <b>Добыча.</b> Подойдите к объекту и жмите <kbd>E</kbd> — персонаж бьёт, пока не разберёт его. Деревьям нужен топор, камню и руде — кирка.</p>
      <p>👣 <b>Скрытность.</b> <kbd>Q</kbd> — красться. Враги хуже видят, особенно со спины, а удар по ничего не подозревающему врагу наносит тройной урон.</p>
      <p>💨 <b>Рывок.</b> <kbd>Shift</kbd> — быстрый перекат с неуязвимостью. Тратит выносливость (жёлтая полоса).</p>
      <p>🔊 <b>Шум.</b> Выстрелы и крикуны поднимают шум. Заполнится шкала — придёт орда. Лук и ближний бой бесшумны.</p>
      <p>🌙 <b>Ночь.</b> В темноте враги быстрее и зорче, появляются ночные охотники. Ночь можно проспать в бункере.</p>
      <p>📜 <b>Чертежи.</b> Лучшее снаряжение открывают тайники на локациях — их сторожит элитный враг.</p>
      <p>🏠 Чтобы уйти с локации, дойдите до пунктирной границы по краю карты. При гибели рюкзак теряется.</p>
      <p>♦️ <b>Цель</b> — 8 рубиновых кристаллов из Эпицентра и реактор «Рубин».</p></div></div>`;
  } else if (t === 'main') {
    const dot = k => (k === 'perks' && G.pts > 0) || (k === 'quests' && G.contracts.some(questReady)) ? '<i class="dot"></i>' : '';
    const body = {inv: tabInv, craft: tabCraft, build: tabBuild, perks: tabPerks, quests: tabQuests}[ui.tab]();
    h = `<div class="win"><div class="rail">${Object.keys(TABS).map(k => `<button class="${ui.tab === k ? 'on' : ''}" data-a="tab" data-id="${k}">${TABS[k][0]}<small>${TABS[k][1]}</small>${dot(k)}</button>`).join('')}<button class="x" data-a="close">✕<small>Закрыть</small></button></div>
      <div class="main"><div class="pbody">${body}</div></div></div>`;
  } else if (t === 'map') h = mapHtml();
  else if (t === 'dead') {
    h = `<div class="win narrow"><div class="title"><h1>ВЫ ПОГИБЛИ</h1><h2>${ui.arg}.<br>День ${G.day} · уровень ${G.lvl} · убито заражённых: ${G.kills}</h2><p style="font-size:13px;color:#a8ab98;margin-bottom:14px">Содержимое рюкзака потеряно. Экипировка, навыки и склад сохранены.</p><button class="btn big gold" data-a="respawn">Очнуться в бункере</button></div></div>`;
  } else if (t === 'win') {
    h = `<div class="win narrow"><div class="title"><h1>♦️ РЕАКТОР ЗАПУЩЕН</h1><h2>Рубиновое ядро очищает воздух вокруг бункера.<br>Вы справились за ${G.day} дн., уничтожив ${G.kills} заражённых.</h2><button class="btn big gold" data-a="close">Продолжить выживание</button></div></div>`;
  }
  const sc = panel.querySelector('.pbody'), top = sc ? sc.scrollTop : 0;
  panel.innerHTML = h;
  const ns = panel.querySelector('.pbody'); if (ns && panel.dataset.k === t + ui.tab) ns.scrollTop = top;
  panel.dataset.k = t + ui.tab;
}
panel.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) { if (e.target === panel && !['title', 'dead'].includes(ui.panel)) closePanel(); return; }
  const a = el.dataset.a, p = G && G.p, id = el.dataset.id;
  if (a === 'close') return closePanel();
  if (a === 'new') { demo = false; newGame(); closePanel(true); $('#hud').classList.remove('hidden'); enterBunker(); toast('Вы в бункере «Рубин». Наверху — отравленный мир.'); return openPanel('help'); }
  if (a === 'continue') { demo = false; G = load(); closePanel(true); $('#hud').classList.remove('hidden'); return enterBunker(); }
  if (a === 'respawn') return respawn();
  if (a === 'go') { if (loc.bunker) save(); closePanel(true); if (id === 'bunker') enterBunker(); else { G.last = id; enterLoc(id); } return; }
  if (a === 'tab') { ui.tab = id; ui.sel = null; ui.arg = null; }
  else if (a === 'cst') ui.cst = id;
  else if (a === 'mappick') ui.mapSel = id;
  else if (a === 'sel') { ui.sel = {w: el.dataset.w, i: +el.dataset.i}; if (!selSlot()) ui.sel = null; }
  else if (a === 'use') { useItem(ui.sel.i); if (!selSlot()) ui.sel = null; }
  else if (a === 'drop') { const s = selSlot(); p.inv[ui.sel.i] = null; if (!loc.bunker) dropBag([[s.id, s.n, s.d]], P.x, P.y); ui.sel = null; }
  else if (a === 'tost' || a === 'toinv') {
    const from = a === 'tost' ? p.inv : G.storage, to = a === 'tost' ? G.storage : p.inv, s = from[ui.sel.i];
    const r = add(to, s.id, s.n, s.d); if (r) { s.n = r; toast('Нет места', 'bad'); } else { from[ui.sel.i] = null; ui.sel = null; }
  } else if (a === 'allst') {
    p.inv.forEach((s, i) => { if (!s) return; const it = ITEMS[s.id]; if (it.eat || it.dur || it.armor || it.filt || s.id === 'ammo' || s.id === 'arrow') return; const r = add(G.storage, s.id, s.n); if (r) s.n = r; else p.inv[i] = null; });
    ui.sel = null;
  } else if (a === 'uneq') {
    const k = ui.sel.w === 'eqw' ? 'weapon' : 'armor', i = p.inv.indexOf(null);
    if (i < 0) toast('Рюкзак полон', 'bad'); else { p.inv[i] = p.eq[k]; p.eq[k] = null; ui.sel = null; }
  } else if (a === 'craft') {
    const r = RECIPES[+el.dataset.i]; if (recState(r) || !canPay(r.c)) return;
    pay(r.c); sfx(600, .1, 'triangle', .05, 300); addXp(3);
    if (r.up) { G.ups[r.up] = 1; for (let i = 0; i < 6; i++) p.inv.push(null); toast(`${r.n}: +6 ячеек`, 'gold'); }
    else {
      const it = ITEMS[r.out], k = it.w && !it.tool ? 'weapon' : it.armor ? 'armor' : null, n = recOut(r);
      if (k && !p.eq[k]) p.eq[k] = it.dur ? {id: r.out, n: 1, d: it.dur} : {id: r.out, n: 1}; else give(r.out, n);
      toast(`Создано: ${it.n}${n > 1 ? ' ×' + n : ''}`);
    }
  } else if (a === 'build') {
    const m = MODS[id], lv = modLv(id), cost = m.lv[lv]; if (!cost || !canPay(cost) || !loc.bunker) return;
    pay(cost); G.mods[id] = lv + 1; sfx(300, .3, 'triangle', .06, 500); addXp(15);
    toast(lv ? `${m.n}: уровень ${lv + 1}` : `Построено: ${m.n}`, 'gold');
    if (id === 'storage') for (let i = 0; i < 20; i++) G.storage.push(null);
    if (id === 'radio') newContracts();
    save();
    if (id === 'reactor') { G.won = true; save(); return openPanel('win'); }
  } else if (a === 'perk') {
    if (G.pts < 1 || pk(id) >= 3) return;
    G.perks[id] = pk(id) + 1; G.pts--; sfx(700, .2, 'triangle', .06, 400);
    if (id === 'mule') for (let i = 0; i < 3; i++) p.inv.push(null);
    if (id === 'tough') p.hp += 20;
    if (G.pts > 0) rollOffer(); else G.offer = null;
    toast(`Навык: ${PERKS[id].n}`, 'gold');
  } else if (a === 'turnin') {
    const c = G.contracts[+el.dataset.i]; if (!c || !questReady(c)) return;
    if (c.type === 'bring') pay({[c.id]: c.n});
    c.done = true; for (const [rid, n] of c.rw) give(rid, n);
    addXp(c.xp); sfx(660, .3, 'triangle', .06, 500); toast('Задание сдано. Награда получена!', 'gold');
  }
  hud(); if (ui.panel) drawPanel();
});

// ---------- ввод ----------
function tap(cx, cy) {
  if (ui.panel || !loc || demo) return;
  const px = (cx - W / 2) / zoom + camX, py = (cy - H / 2) / zoom + camY;
  for (const e of loc.en) { const [ex, ey] = iso(e.x, e.y), s = e.def.sz; if (Math.abs(px - ex) < 15 * s && py > ey - 40 * s && py < ey + 8) { P.auto = {t: 'enemy', e}; P.af = null; return; } }
  const w = (qx, qy) => [(qx / 32 + qy / 16) / 2, (qy / 16 - qx / 32) / 2];
  for (const off of [0, 16, 32]) {
    const [wx, wy] = w(px, py + off), n = loc.nmap.get((wy | 0) * loc.N + (wx | 0));
    if (n && wx >= 0 && wy >= 0 && (off === 0 || n.k === 'mod' || NODES[n.k].solid)) { P.auto = {t: 'node', n}; P.af = null; return; }
  }
  const [wx, wy] = w(px, py);
  P.auto = {t: 'move', x: wx, y: wy}; P.af = null; P.gather = null;
}
cv.addEventListener('pointerdown', e => {
  if (ui.panel) return;
  if (e.pointerType === 'touch' && e.clientX < W * .45 && e.clientY > H * .3 && joy.id == null) { joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.moved = false; joy.t = performance.now(); return; }
  tap(e.clientX, e.clientY);
});
addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.sx, dy = e.clientY - joy.sy, l = Math.hypot(dx, dy);
  if (l > 8) joy.moved = true;
  const k = l > 48 ? 48 / l : 1; joy.x = dx * k / 48; joy.y = dy * k / 48;
});
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; if (!joy.moved && performance.now() - joy.t < 300) tap(joy.sx, joy.sy); };
addEventListener('pointerup', joyEnd); addEventListener('pointercancel', joyEnd);
addEventListener('contextmenu', e => e.preventDefault());

const TABKEY = {KeyI: 'inv', Tab: 'inv', KeyC: 'craft', KeyB: 'build', KeyK: 'perks', KeyJ: 'quests'};
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!G || !loc || demo) return;
  if (ui.panel) {
    if (['title', 'dead'].includes(ui.panel)) return;
    if (e.code === 'Escape' || e.code === 'KeyE') return closePanel();
    if (ui.panel === 'main' && TABKEY[e.code]) { if (ui.tab === TABKEY[e.code]) closePanel(); else { ui.tab = TABKEY[e.code]; ui.sel = null; drawPanel(); } }
    return;
  }
  keys[e.code] = 1;
  if (e.repeat) return;
  if (e.code === 'KeyE') doUse();
  else if (TABKEY[e.code]) openPanel('main', TABKEY[e.code]);
  else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') doDash();
  else if (e.code === 'KeyQ') toggleSneak();
  else if (e.code === 'Digit1') quick('eat'); else if (e.code === 'Digit2') quick('drink'); else if (e.code === 'Digit3') quick('heal'); else if (e.code === 'Digit4') quick('filter');
});
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; atkHeld = false; });
$('#hud').addEventListener('click', e => {
  if (ui.panel) return;
  const m = e.target.closest('[data-m]'), q = e.target.closest('[data-q]');
  if (m) { if (m.dataset.m === 'help') openPanel('help'); else openPanel('main', m.dataset.m); }
  else if (q) { quick(q.dataset.q); hud(); }
});
$('#bUse').addEventListener('click', () => doUse());
$('#bDash').addEventListener('pointerdown', e => { e.preventDefault(); doDash(); });
$('#bSneak').addEventListener('click', () => { toggleSneak(); hud(); });
const bAtk = $('#bAtk');
bAtk.addEventListener('pointerdown', e => { atkHeld = true; e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bAtk.addEventListener(ev, () => { atkHeld = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && loc && loc.bunker && !ui.panel && !demo) save(); });

// ---------- Android: полный экран и альбомная ориентация ----------
const coarse = matchMedia('(pointer:coarse)'), portrait = matchMedia('(orientation:portrait)');
function goLandscape() {
  if (!coarse.matches) return;
  try {
    const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    const p = document.fullscreenElement || !fs ? Promise.resolve() : fs.call(el, {navigationUI: 'hide'});
    Promise.resolve(p).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  } catch (e) {}
}
addEventListener('pointerup', goLandscape);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- цикл ----------
let last = 0;
function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  if (demo) { // живой фон главного меню
    time += dt; P.x = loc.N / 2 + Math.sin(time * .07) * 9; P.y = loc.N / 2 + Math.cos(time * .09) * 7;
    for (const f of loc.fog) { f.x += f.vx * dt; f.y += f.vy * dt; }
    render(dt);
  } else if (G && loc) {
    if (!ui.panel && !(coarse.matches && portrait.matches)) { if (hitstop > 0) hitstop -= dt; else update(dt); }
    render(dt);
    if ((hudT -= dt) <= 0) { hud(); hudT = .1; }
    if (!loc.bunker && (miniT -= dt) <= 0) { drawMini(); miniT = .3; }
  }
  requestAnimationFrame(frame);
}
function startDemo() {
  demo = true; newGame(); G.clock = 17.6; loc = genLoc('city'); mkFogSprite(loc.def.fog); mkPlayer(loc.N / 2, loc.N / 2);
  for (const e of loc.en) e.walk = R() * 6;
}
startDemo();
openPanel('title');
requestAnimationFrame(frame);

// отладочный доступ для тестов
window._dbg = {get G() { return G; }, get loc() { return loc; }, get P() { return P; }, enterLoc, enterBunker, give, update, tap, addXp, advanceClock, spawnEnemy};
