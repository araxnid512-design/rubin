// Окна интерфейса: инвентарь, обыск, карта, отряд, боец, восстановление базы, панели зданий, журнал,
// пауза, сохранения, настройки, диалоги, смерть, выход с локации, радиопоиск, экспедиция.
import { V3 } from '../../engine/math.js';
import { audio } from '../../engine/audio.js';
import { Game, events, msg, MSG, SLOTS } from '../state.js';
import { item, itemName, weapon, isWeapon, weaponSlot, CAT, RESOURCES } from '../items.js';
import * as L from '../layout.js';
import { ORDER_NAMES } from '../actors.js';
import { STAGES } from '../quest.js';
import { PRESETS } from '../settings.js';
import { h, btn, bar, costText, clear, short } from './dom.js';
import { MapView } from './mapview.js';

const STATE_NAMES = ['Разрушено', 'Работает', 'Улучшено'];
const STATE_CLS = ['bad', '', 'good'];

function frame(app, title, size = 'l', closable = true) {
  const body = h('div.win-body');
  const head = h('div.win-head', {}, h('h2', {}, title), closable ? btn('✕', () => app.close(), 'close') : null);
  const win = h('div.panel.win.' + size, {}, head, body);
  const root = h('div.win-wrap', { onpointerdown: (e) => e.stopPropagation() }, win);
  return { root, body, win };
}
const lab = (text, cls = '') => h('div' + (cls ? '.' + cls.split(' ').join('.') : ''), {}, text);
const whSummary = () => RESOURCES.map((id) => `${itemName(id)} ${Game.wh(id)}`).join(', ') + `  (${Game.whTotal()}/${Game.whCapacity()})`;

export function createWindow(app, kind, data) {
  switch (kind) {
    case 'inventory': return inventory(app);
    case 'loot': return loot(app, data);
    case 'map': return mapWindow(app);
    case 'squad': return squad(app);
    case 'soldier': return soldier(app, data);
    case 'build': return buildMenu(app);
    case 'building': return building(app, data);
    case 'journal': return journal(app);
    case 'pause': return pause(app);
    case 'saveload': return saveload(app, data);
    case 'settings': return settings(app, data);
    case 'dialog': return dialog(app, data);
    case 'death': return death(app);
    case 'exit': return exitWindow(app, data);
    case 'radio': return radio(app);
    case 'expedition': return expedition(app);
  }
  return null;
}

// ===================================================================== инвентарь
function inventory(app) {
  const f = frame(app, 'Инвентарь генерала'); const st = { sel: -1 };
  const left = h('div.col'), right = h('div.col.detail');
  f.body.append(h('div.split', {}, left, right));
  const pl = app.world.player;
  const refresh = () => {
    clear(left); clear(right);
    left.append(lab('Снаряжение', 'sec'));
    const eq = h('div.row.wrap');
    for (const s of ['primary', 'pistol']) {
      const e = Game.equip[s];
      eq.append(btn((s === 'primary' ? 'Основное: ' : 'Пистолет: ') + (e ? `${weapon(e.id).name} (${e.ammo || 0})` : '—'), () => {
        if (!e) return;
        if (Game.inv.add(e.id, 1, { ammo: e.ammo || 0 }) === 0) { Game.equip[s] = null; pl.syncWeapon(); events.emit('equipment'); }
        else msg('Нет места в рюкзаке.', MSG.ALERT);
        refresh();
      }, 'wide'));
    }
    left.append(eq, lab(`Броня: ${itemName(Game.playerState.armor || 'armor_duty')} · разгрузка (4 быстрых слота) · рюкзак (16 ячеек)`, 'dim'));
    left.append(lab(`Рюкзак (${Game.inv.capacity - Game.inv.freeSlots()}/${Game.inv.capacity})`, 'sec'));
    const grid = h('div.grid4');
    Game.inv.slots.forEach((s, i) => {
      const b = btn(s ? `${short(itemName(s.id))}\n×${s.n}` : '', () => { st.sel = i; refresh(); }, 'cell' + (i === st.sel ? ' sel' : ''));
      if (s) { const c = item(s.id).color || [0.5, 0.5, 0.5]; b.style.background = `rgba(${c.map((x) => Math.round(x * 90)).join(',')},.95)`; }
      grid.append(b);
    });
    left.append(grid);
    const sel = st.sel >= 0 ? Game.inv.slots[st.sel] : null;
    if (!sel) {
      right.append(lab('Выберите предмет.', 'dim big'), lab('Быстрые слоты: ' + Game.quick.map((q) => (q ? itemName(q) : '—')).join(', ')),
        lab('Ресурсы сдаются на склад через панель основного склада. Ремонт тратит материалы со склада и из рюкзака.', 'dim'));
      return;
    }
    const id = sel.id, it = item(id);
    right.append(lab(it.name, 'big'), lab(it.desc || '', 'dim'), lab(`Количество: ${sel.n} · вес ${((it.weight || 0) * sel.n).toFixed(2)} кг`));
    if (it.cat === CAT.MED || it.cat === CAT.FOOD) {
      right.append(btn('Использовать', () => { pl.useItem(id); app.close(); }, 'primary'));
      right.append(h('div.row.wrap', {}, [0, 1, 2, 3].map((q) => btn(`В слот ${q + 1}`, () => { Game.quick[q] = id; events.emit('inventory'); refresh(); }))));
    }
    if (isWeapon(id)) {
      right.append(btn('Взять в руки', () => {
        const slot = weaponSlot(id) === 1 ? 'pistol' : 'primary', cur = Game.equip[slot], ammo = sel.ammo || 0;
        Game.inv.take(st.sel);
        if (cur) Game.inv.add(cur.id, 1, { ammo: cur.ammo || 0 });
        Game.equip[slot] = { id, ammo }; pl.activeSlot = slot === 'primary' ? 0 : 1; pl.syncWeapon(); events.emit('equipment');
        st.sel = -1; refresh();
      }, 'primary'));
    }
    right.append(btn('Выбросить', () => { Game.inv.take(st.sel); st.sel = -1; refresh(); }));
  };
  refresh();
  return f;
}

// ===================================================================== обыск
function loot(app, lc) {
  const f = frame(app, lc.title, 'm'); const list = h('div.col');
  const refresh = () => {
    clear(list);
    const keys = Object.keys(lc.items);
    if (!keys.length) list.append(lab('Пусто.', 'dim big'));
    for (const id of keys) list.append(h('div.row', {}, h('span.grow.big', {}, `${itemName(id)} ×${lc.items[id]}`), btn('Взять', () => {
      if (lc.take(id, lc.items[id] || 0) <= 0) msg('Нет места в рюкзаке.', MSG.ALERT); else audio.play('pickup');
      refresh();
    })));
    list.append(lab(`Свободно ячеек в рюкзаке: ${Game.inv.freeSlots()}`, 'dim'));
  };
  f.body.append(list, btn('Взять всё', () => { if (lc.takeAll() > 0) audio.play('pickup'); refresh(); if (!Object.keys(lc.items).length) app.close(); }, 'primary'));
  refresh();
  return f;
}

// ===================================================================== карта
function mapWindow(app) {
  const f = frame(app, 'Карта: база «Долга» (300 × 300 м)', 'xl');
  const cv = h('canvas.bigmap'), mv = new MapView(cv, { follow: false, meters: 300, labels: true });
  mv.world = app.world; mv.quest = app.quest;
  const info = lab('Нажмите на здание, чтобы увидеть сведения.', 'dim'), openBtn = btn('Открыть панель здания', () => {}, 'primary'); openBtn.hidden = true;
  const legend = [['■ разрушено', '#c45a48'], ['■ идут работы', '#e0b04a'], ['■ работает', '#a9b3aa'], ['■ улучшено', '#6fc06f'], ['▲ генерал', '#fff'], ['● бойцы «Долга»', '#4fe37a'],
    ['● противник рядом', '#f0402f'], ['◆ цель задания', '#ffd23a'], ['● выход с локации', '#6aa8ff'], ['○ аномалии и радиация', '#9cc8ff'], ['▬ проломы в стене', '#cc4b33']];
  f.body.append(h('div.split.map', {}, h('div.mapbox', {}, cv), h('div.col', {}, lab('Обозначения', 'sec'), legend.map(([t, c]) => h('div', { style: { color: c } }, t)), info, openBtn)));
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), dpr = cv.width / r.width, w = mv.m2w((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
    for (const d of L.BUILDINGS) {
      if (Math.abs(w.x - d.pos[0]) < d.size[0] / 2 + 2 && Math.abs(w.z - d.pos[1]) < d.size[1] / 2 + 2) {
        mv.selected = d.id; const lvl = Game.level(d.id);
        info.textContent = `${d.name}\nСостояние: ${STATE_NAMES[lvl].toLowerCase()}${Game.job(d.id) ? ' (идут работы)' : ''}\n${d.desc}\n${d.effect}`;
        openBtn.hidden = false; openBtn.onclick = () => app.open('building', d.id); mv.draw(); return;
      }
    }
  });
  const tick = () => mv.draw();
  requestAnimationFrame(tick);
  return { ...f, tick };
}

// ===================================================================== отряд
function squad(app) {
  const f = frame(app, 'Управление бойцами', 'xl'); const sel = {}; const list = h('div.col');
  const refresh = () => {
    clear(list);
    for (const so of app.world.soldiers) {
      const w = weapon(so.weaponId) || { name: '—' };
      const cb = btn(sel[so.sid] ? '☑' : '☐', () => { sel[so.sid] = !sel[so.sid]; refresh(); }, 'check', !so.alive);
      const hb = bar(so.hp / so.maxHp * 100, 'var(--hp)');
      list.append(h('div.squad-row' + (so.alive ? '' : '.dead'), {}, cb,
        h('div.info', {}, h('b', {}, `${so.def.name} «${so.def.call}»`), h('small.dim', {}, `${so.roleName()} · ${so.def.duty}`)),
        h('div.hpc', {}, hb, h('small', {}, so.alive ? `Здоровье ${Math.round(so.hp)}` : 'ПОГИБ')),
        h('div.wpn', {}, w.name, h('br'), h('small', {}, `${so.mag} / ${so.reserve} патр.`)),
        h('div.ord.warn', {}, so.orderName(), h('br'), h('small', {}, so.statusText())),
        btn('Подробнее', () => app.open('soldier', so), 'sm')));
    }
  };
  const orders = h('div.row.wrap.orders', {}, btn('Все', () => { for (const s of app.world.soldiers) sel[s.sid] = s.alive; refresh(); }));
  for (const o of ['follow', 'guard', 'patrol', 'repair', 'heal', 'defend', 'barracks', 'idle']) {
    orders.append(btn(ORDER_NAMES[o], () => {
      let n = 0;
      for (const so of app.world.soldiers) { if (!sel[so.sid] || !so.alive || (o === 'heal' && so.role !== 'medic')) continue; so.giveOrder(o); n++; }
      if (!n) msg('Не выбраны бойцы' + (o === 'heal' ? ' (лечить может только медик)' : '') + '.', MSG.ALERT);
      refresh();
    }, 'order'));
  }
  f.body.append(list, lab('Отметьте бойцов и выберите приказ. Формирование боевых отрядов — на следующих этапах.', 'dim'), orders);
  refresh();
  return f;
}
const LINES = {
  officer: '«Периметр дырявый, товарищ генерал. Без охраны на КПП долго не продержимся.»',
  rifleman: '«Патронов бы побольше. С тридцатью в магазине много не навоюешь.»',
  gunner: '«Плечо зацепило, но ПКМ держу. Ленты пустые — нужны 7,62.»',
  sniper: '«С вышки обзор лучше. Если починить — буду держать северный сектор.»',
  medic: '«Медикаменты на исходе. Восстановим медпункт — подниму раненых быстрее.»',
  tech: '«Генератор живой, проводку перекинуть — и будет свет. Дайте инструменты.»',
};
function soldier(app, so) {
  const f = frame(app, `${so.def.name} «${so.def.call}»`, 'l'); const w = weapon(so.weaponId) || { name: '—' };
  f.body.append(lab(`${so.roleName()}. ${so.def.duty}`, 'dim'),
    lab(`Здоровье: ${Math.round(so.hp)}/${so.maxHp} · Оружие: ${w.name} · Патроны: ${so.mag} в магазине, ${so.reserve} в запасе · Подготовка: ${so.skill.toFixed(1)}`),
    lab(`Текущий приказ: ${so.orderName()} (${so.statusText()})`, 'warn'), lab(LINES[so.role] || '', 'quote'),
    h('div.grid4', {}, ['follow', 'guard', 'patrol', 'repair', 'heal', 'defend', 'barracks', 'idle'].map((o) => btn(ORDER_NAMES[o], () => { so.giveOrder(o); app.close(); }, 'order', !so.alive || (o === 'heal' && so.role !== 'medic')))));
  return f;
}

// ===================================================================== восстановление базы
function buildMenu(app) {
  const f = frame(app, 'Восстановление базы', 'xl'); const list = h('div.col');
  for (const d of L.BUILDINGS) {
    const lvl = Game.level(d.id), job = Game.job(d.id);
    let st = STATE_NAMES[lvl], cls = STATE_CLS[lvl];
    if (job) { st = `${job === 'repair' ? 'Ремонт' : 'Улучшение'} ${Math.floor(Game.progress(d.id) / Game.workNeeded(d.id) * 100)}%`; cls = 'warn'; }
    const cost = Game.nextCost(d.id);
    list.append(h('div.build-row', {}, h('b', {}, d.name), h('span.' + (cls || 'fg'), {}, st),
      h('div.grow', {}, Object.keys(cost).length && !job ? [h('small.dim', {}, lvl === 0 ? 'Ремонт: ' : 'Улучшение: '), costText(cost)] : ''),
      btn('Панель', () => app.open('building', d.id), 'sm')));
  }
  f.body.append(list, lab('Ресурсы на складе: ' + whSummary(), 'dim'));
  return f;
}

function assignRepair(app, id, onlyTech) {
  let n = 0;
  for (const so of app.world.soldiers) {
    if (!so.alive || (onlyTech && so.role !== 'tech') || (!onlyTech && !['idle', 'follow', 'barracks'].includes(so.order))) continue;
    so.giveOrder('repair', id); n++;
  }
  if (n) msg(`Назначено на ремонт: ${n}`); else if (onlyTech) msg('Техник недоступен.', MSG.ALERT);
}

// ===================================================================== панель здания
function building(app, id) {
  const d = Game.def(id); const f = frame(app, 'Панель: ' + d.name, 'xl'); const content = h('div.split');
  f.body.append(content);
  const refresh = () => {
    clear(content);
    const lvl = Game.level(id), job = Game.job(id), left = h('div.col'), right = h('div.col');
    content.append(left, right);
    left.append(lab(d.desc), lab('Состояние: ' + ['Разрушено (≈70% повреждений)', 'Работает', 'Улучшено'][lvl], 'big ' + STATE_CLS[lvl]), lab('Даёт: ' + d.effect, 'dim'));
    if (job) {
      const pct = Game.progress(id) / Game.workNeeded(id) * 100;
      left.append(lab(`${job === 'repair' ? 'Идёт ремонт' : 'Идёт улучшение'}: ${Math.floor(pct)}%`, 'warn big'), bar(pct, 'var(--warn)'),
        lab('Работы ведут назначенные бойцы. Генерал может помогать: удерживать «Действие» у входа в здание.', 'dim'),
        h('div.row.wrap', {}, btn('Назначить техника', () => { assignRepair(app, id, true); refresh(); }), btn('Назначить всех свободных', () => { assignRepair(app, id, false); refresh(); })));
    } else if (lvl < 2) {
      const cost = Game.nextCost(id), why = Game.canStart(id);
      left.append(lab((lvl === 0 ? 'Восстановление' : 'Улучшение') + ' — нужно:', 'warn'), costText(cost),
        lab(`Работа: ${Math.round(lvl === 0 ? d.repair_work || 30 : d.upgrade_work || 30)} чел.-сек.`, 'dim'),
        btn(lvl === 0 ? 'Начать восстановление' : 'Начать улучшение', () => { if (Game.startJob(id)) assignRepair(app, id, true); refresh(); }, 'primary', !!why));
      if (why) left.append(lab(why, 'bad'));
    }
    specific(app, id, lvl, right, refresh);
  };
  refresh();
  const unsub = events.on('building', (bid) => { if (bid === id) refresh(); });
  return { ...f, onClose: unsub };
}

function specific(app, id, lvl, box, refresh) {
  const d = Game.def(id), W = app.world;
  const sec = (t) => box.append(lab(t, 'sec'));
  switch (d.kind) {
    case 'hq': {
      const alive = Object.values(Game.soldiers).filter((s) => s.alive !== false).length;
      sec('Сводка по базе');
      box.append(lab(`Личный состав: ${alive + 1} (вместимость ${Game.soldierCap()})\nЭлектропитание: ${Game.powerOn ? 'есть' : 'нет'} (топливо ${Math.round(Game.fuel)} ч)\nСклад: ${Game.whTotal()}/${Game.whCapacity()}\n${Game.timeStr()}`));
      const unlocked = !!Game.flags.expedition_unlocked;
      box.append(btn('Подготовка экспедиции', () => app.open('expedition'), 'primary', !unlocked));
      if (!unlocked) box.append(lab('Станет доступно после получения сигнала выживших (радиоцентр).', 'dim'));
      break;
    }
    case 'warehouse': {
      sec(`Запасы базы (${Game.whTotal()}/${Game.whCapacity()})`);
      box.append(btn('Сдать все ресурсы на склад', () => {
        const moved = Game.depositResources(), keys = Object.keys(moved);
        if (!keys.length) msg('В рюкзаке нет ресурсов.');
        else { Game.setFlag('deposited'); msg('Сдано на склад: ' + keys.map((k) => `${itemName(k)} ×${moved[k]}`).join(', '), MSG.GOOD); }
        refresh();
      }, 'primary'));
      for (const k of Object.keys(Game.warehouse)) box.append(h('div.row', {}, h('span.grow', {}, `${itemName(k)}: ${Game.wh(k)}`), btn('Взять 1', () => {
        if (Game.whRemove(k, 1) > 0) { const left = Game.give(k, 1); if (left > 0) Game.whAdd(k, left); }
        refresh();
      }, 'sm')));
      break;
    }
    case 'generator': {
      sec('Генератор');
      box.append(lab(`Топливо: ${Math.round(Game.fuel)} ч работы · Питание: ${Game.powerOn ? 'ВКЛ' : 'ВЫКЛ'}`, 'big'));
      box.append(btn('Заправить (1 канистра = 8 ч)', () => { if (Game.refuel(1) === 0) msg('Нет топлива. Ищите канистры: гараж, грузовики у дороги, лагерь мародёров.', MSG.ALERT); refresh(); }, 'primary', lvl < 1));
      box.append(btn(Game.flags.gen_switch !== false ? 'Выключить генератор' : 'Включить генератор', () => { Game.flags.gen_switch = Game.flags.gen_switch === false; Game.updatePower(); refresh(); }, '', lvl < 1));
      if (lvl < 1) box.append(lab('Сначала восстановите генераторную.', 'bad'));
      break;
    }
    case 'radio': {
      sec('Радиостанция');
      const ok = lvl >= 1 && Game.powerOn;
      box.append(lab(`Требуется: восстановленный радиоцентр и электропитание.\nПитание: ${Game.powerOn ? 'есть' : 'нет'}`, ok ? '' : 'bad'));
      box.append(btn('Поиск сигнала выживших', () => app.open('radio'), 'primary', !ok));
      for (const e of app.quest.log) box.append(lab(`${e.time}: ${e.text}`, 'radio'));
      break;
    }
    case 'armory': armory(app, box, refresh); break;
    case 'medpoint': {
      sec('Медицинская помощь');
      box.append(btn('Лечение генерала (1 медикамент)', () => { if (Game.consume({ medicine: 1 })) { W.player.heal(lvl >= 1 ? 100 : 40); msg('Генерал получил медицинскую помощь.', MSG.GOOD); } else msg('Нет медикаментов.', MSG.ALERT); refresh(); }, 'primary'));
      box.append(btn('Изготовить бинты (1 медикамент → 3 бинта)', () => { if (Game.consume({ medicine: 1 })) { Game.give('bandage', 3); msg('+3 бинта', MSG.GOOD); } refresh(); }, '', lvl < 1));
      break;
    }
    case 'workshop': {
      sec('Мастерская');
      box.append(btn('Оружейные детали (металлолом ×6)', () => { if (Game.consume({ scrap: 6 })) { Game.whAdd('weapon_parts', 1); msg('+1 оружейная деталь (на склад)', MSG.GOOD); } refresh(); }, '', lvl < 1));
      for (const [am, n] of [['ammo_545', 30], ['ammo_9x18', 30], ['ammo_762r', 20]]) {
        box.append(btn(`Снарядить: ${itemName(am)} ×${n} (деталь + металлолом ×2)`, () => { if (Game.consume({ weapon_parts: 1, scrap: 2 })) { Game.whAdd(am, n); msg(`+${n} ${itemName(am)} (на склад)`, MSG.GOOD); } refresh(); }, '', lvl < 1));
      }
      if (lvl < 1) box.append(lab('Станки не работают — нужен ремонт мастерской.', 'bad'));
      break;
    }
    case 'barracks': {
      sec('Личный состав');
      box.append(lab(`Вместимость: ${Game.soldierCap()}. Бойцы в казарме восстанавливают здоровье${lvl >= 1 ? ' быстрее' : ''}.`));
      box.append(btn('Отправить раненых отдыхать', () => { for (const so of W.soldiers) if (so.alive && so.hp < so.maxHp * 0.8) so.giveOrder('barracks'); refresh(); }));
      box.append(lab('Набор новых бойцов откроется после связи с выжившими отрядами.', 'dim'));
      break;
    }
    case 'training': {
      sec('Подготовка бойцов');
      for (const so of W.soldiers) if (so.alive) box.append(btn(`Тренировать: ${so.def.call} (провизия ×2) — меткость ${so.skill.toFixed(2)}`, () => {
        if (Game.consume({ provisions: 2 })) { so.skill = Math.min(2, so.skill + 0.15); so.accuracy = 1.3 / so.skill; so.writeState(); msg(`${so.def.call}: подготовка повышена.`, MSG.GOOD); }
        refresh();
      }, '', lvl < 1));
      break;
    }
    case 'kpp': sec('Оборона КПП'); box.append(lab(`Вооружённая охрана на постах: ${app.quest.kppGuards()}`, 'big'), lab('Назначение охраны и выдача патронов — в панели оружейной.', 'dim')); break;
    case 'garage': sec('Гараж'); box.append(lab('Вся техника потеряна при нападении. Восстановление машин — на следующих этапах.', 'dim')); break;
    case 'tower': sec('Пост наблюдения'); box.append(btn('Назначить снайпера на пост', () => { const s = W.soldierMap.s_sniper; if (s) s.giveOrder('guard', W.buildings[id].workPoint()); refresh(); })); break;
  }
}

function armory(app, box, refresh) {
  box.append(lab('Снабжение бойцов', 'sec'));
  if (!Game.worldState.rubble.armory) { box.append(lab('Вход завален. Разберите завал, чтобы получить доступ.', 'bad')); return; }
  box.append(lab('Патроны берутся со склада и из рюкзака генерала. Оружие из рюкзака можно выдать бойцу.', 'dim'));
  for (const so of app.world.soldiers) {
    if (!so.alive) continue;
    const w = weapon(so.weaponId) || { name: '—', ammo: '', mag: 30 };
    box.append(h('div.col.card', {}, lab(`${so.def.call} — ${w.name}, ${so.mag}/${so.reserve} патр.${so.supplied ? ' · снабжён' : ''}`, so.supplied ? 'good' : ''),
      h('div.row.wrap', {},
        btn('Выдать патроны', () => {
          const need = w.mag * 3 - so.reserve, give = Math.min(need, Game.total(w.ammo));
          if (give > 0 && Game.consume({ [w.ammo]: give })) { so.reserve += give; so.supplied = true; so.writeState(); msg(`${so.def.call} получил ${give} патр. (${itemName(w.ammo)})`, MSG.GOOD); }
          else if (need <= 0) { so.supplied = true; msg(`${so.def.call}: боезапас полный.`); }
          else msg(`Нет патронов: ${itemName(w.ammo)}.`, MSG.ALERT);
          refresh();
        }, 'sm'),
        btn('Выдать оружие из рюкзака', () => {
          for (let i = 0; i < Game.inv.capacity; i++) {
            const sl = Game.inv.slots[i];
            if (sl && isWeapon(sl.id) && weapon(sl.id).hold !== 'pistol') {
              Game.inv.take(i); const old = so.weaponId;
              so.weaponId = sl.id; so.mag = sl.ammo || 0; so.reserve = 0; so.rig.setWeapon(so.weaponId);
              if (old) Game.inv.add(old, 1, { ammo: 0 });
              so.writeState(); msg(`${so.def.call} получил ${weapon(so.weaponId).name}.`, MSG.GOOD); break;
            }
          }
          refresh();
        }, 'sm'),
        btn('На охрану КПП', () => {
          so.giveOrder('defend', new V3(0, 0, 76));
          const t = so.orderTarget, [x, z, ww, hh] = L.KPP_ZONE;
          if (!(t.x >= x && t.x <= x + ww && t.z >= z && t.z <= z + hh)) so.giveOrder('guard', new V3(Math.random() * 6 - 3, 0, 75));
          msg(`${so.def.call} назначен на охрану КПП${so.supplied ? '' : ' (без пополнения патронов!)'}.`);
          refresh();
        }, 'sm'))));
  }
}

// ===================================================================== журнал
function journal(app) {
  const f = frame(app, 'Журнал заданий', 'l'); const q = app.quest;
  f.body.append(lab('«Возрождение Долга»', 'sec'), lab('Генерал прибывает на разрушенную базу, встречает оставшихся бойцов и восстанавливает свет и связь, чтобы найти выживших.', 'dim'));
  for (let i = 0; i < STAGES.length; i++) {
    if (i > q.stage && !q.finished) { f.body.append(lab('•  …', 'dim')); break; }
    const done = i < q.stage || q.finished;
    f.body.append(lab((done ? '✓ ' : '▶ ') + STAGES[i].title, done ? 'good big' : 'big'));
    if (!done) for (const o of q.objectives()) f.body.append(lab('    ' + (o.done ? '✓ ' : '• ') + o.text, o.done ? 'good' : ''));
  }
  if (q.log.length) { f.body.append(lab('Записи', 'sec')); for (const e of q.log) f.body.append(lab(`${e.time} — ${e.text}`, 'radio')); }
  f.body.append(lab('Управление на ПК: WASD — движение, Shift — бег, ЛКМ — огонь, ПКМ — прицел, R — перезарядка, E — действие (удерживать для разбора и ремонта), 1/2 — оружие, 3–6 — быстрые слоты, V — осмотр оружия, I — инвентарь, M — карта, O — отряд, B — стройка, J — журнал, колесо мыши — масштаб, T — тактический обзор, F3 — счётчик кадров, F5/F9 — быстрое сохранение/загрузка, Esc — пауза.', 'dim'));
  f.body.append(lab('На телефоне: джойстик слева, кнопки «Огонь», «R», «✋» и «»» справа. Огонь автоматически наводится на ближайшего видимого противника.', 'dim'));
  return f;
}

// ===================================================================== пауза, сохранения, настройки
function pause(app) {
  const f = frame(app, 'Пауза', 's');
  f.body.append(btn('Продолжить', () => app.close(), 'primary big'), btn('Сохранить игру', () => app.open('saveload', 'save'), 'big'), btn('Загрузить игру', () => app.open('saveload', 'load'), 'big'),
    btn('Настройки', () => app.open('settings', 'pause'), 'big'), btn('Главное меню', () => { app.saveGame(0); app.close(); app.toMenu(); }, 'big'),
    lab('Автосохранение — при выполнении целей задания и при выходе в меню. Сохранения хранятся в этом браузере.', 'dim'));
  return f;
}
function saveload(app, mode) {
  const saving = mode === 'save'; const f = frame(app, saving ? 'Сохранить игру' : 'Загрузить игру', 'm');
  for (let i = saving ? 1 : 0; i <= SLOTS; i++) {
    f.body.append(btn(`${i === 0 ? 'Автосохранение' : 'Слот ' + i}: ${Game.slotInfo(i)}`, () => { if (saving) { app.saveGame(i); app.close(); } else { app.close(); app.loadSlot(i); } }, 'big left', !saving && !Game.hasSave(i)));
  }
  f.body.append(btn('Назад', () => (app.playing ? app.open('pause') : app.close())));
  return f;
}
function settings(app, back) {
  const f = frame(app, 'Настройки', 'l'); const s = app.settings; const list = h('div.col');
  const slider = (title, mn, mx, val, step, cb) => {
    const out = h('b', {}, fmt(val)), inp = h('input', { type: 'range', min: mn, max: mx, step, value: val, id: 'set-' + title.replace(/\W+/g, '') });
    inp.addEventListener('input', () => { const x = +inp.value; out.textContent = fmt(x); cb(x); });
    return h('label.slider', {}, h('span', {}, title + ': ', out), inp);
  };
  const build = () => {
    clear(list);
    list.append(lab('Качество графики', 'sec'), h('div.row.wrap', {}, PRESETS.map((p, q) => btn(p.name, () => { s.applyPreset(q); app.applySettings(); build(); }, q === s.quality ? 'active' : ''))));
    list.append(slider('Дальность прорисовки, м', 50, 160, s.drawDistance, 5, (x) => { s.drawDistance = x; app.applySettings(); }),
      slider('Плотность травы', 0, 1, s.grassDensity, 0.05, (x) => { s.grassDensity = x; app.applySettings(); }),
      slider('Разрешение 3D', 0.5, 1, s.renderScale, 0.05, (x) => { s.renderScale = x; app.applySettings(); }),
      slider('Громкость', 0, 1, s.volume, 0.05, (x) => { s.volume = x; app.applySettings(); }),
      slider('Размер джойстика', 0.7, 1.4, s.joystickSize, 0.05, (x) => { s.joystickSize = x; app.applySettings(); }),
      slider('Длина суток, мин', 8, 60, s.dayLength, 1, (x) => { s.dayLength = x; app.applySettings(); }),
      slider('Масштаб камеры', 0.55, 1.7, s.cameraZoom || 1, 0.05, (x) => { app.cam.setZoom(x); app.applySettings(); }));
    list.append(h('div.row.wrap', {},
      btn(`Лимит FPS: ${s.fpsLimit}`, () => { s.fpsLimit = s.fpsLimit === 30 ? 60 : 30; app.applySettings(); build(); }),
      btn(`Тени: ${s.shadows ? 'вкл' : 'выкл'}`, () => { s.shadows = !s.shadows; app.applySettings(); build(); }),
      btn(`Свет фонарей: ${s.lights ? 'вкл' : 'выкл'}`, () => { s.lights = !s.lights; app.applySettings(); build(); }),
      btn(`Счётчик FPS: ${s.showFps ? 'вкл' : 'выкл'}`, () => { s.showFps = !s.showFps; app.applySettings(); build(); }),
      btn(`Сенсорное управление: ${['авто', 'выкл', 'вкл'][s.touch + 1]}`, () => { s.touch = ((s.touch + 2) % 3) - 1; app.applySettings(); build(); })));
  };
  build();
  f.body.append(list, btn('Назад', () => (back === 'pause' ? app.open('pause') : app.close())));
  return f;
}
const fmt = (v) => (v > 3 ? String(Math.round(v)) : (+v).toFixed(2));

// ===================================================================== диалог
function dialog(app, id) {
  const lines = app.quest.dialog(id); const f = frame(app, id === 'intro' ? 'Долг: Возрождение' : 'Разговор', 'l', false);
  const who = lab('', 'warn big'), txt = lab('', 'dialog-text'), opts = h('div.col');
  f.body.append(who, txt, opts);
  const show = (i) => {
    if (i >= lines.length) { app.close(); return; }
    const ln = lines[i]; who.textContent = ln.who || ''; txt.textContent = ln.text; clear(opts);
    if (ln.options) for (const o of ln.options) opts.append(btn(o.text, () => { if (o.action) { app.quest.dialogAction(o.action); app.close(); } else show(o.next); }, 'primary big left'));
    else opts.append(btn('Далее ▶', () => show(i + 1), 'primary big'));
  };
  show(0);
  return { ...f, dialog: true };
}
function death(app) {
  const f = frame(app, 'Генерал погиб', 's', false); const last = Game.latestSlot();
  f.body.append(lab('Без командира «Долг» не возродится. Попробуйте снова.', 'big'),
    btn('Загрузить последнее сохранение', () => { app.close(); app.loadSlot(last); }, 'primary big', last < 0), btn('Главное меню', () => { app.close(); app.toMenu(); }, 'big'));
  return f;
}
function exitWindow(app, d) {
  const f = frame(app, 'Выход: ' + d.name, 'm');
  f.body.append(lab(`Переход на локацию «${d.name}».\n\nЭта локация ещё не создана: первый этап посвящён базе «Долга». Следующая локация будет разработана после подтверждения.`, 'big'));
  if (d.id === 'exit_south' && Game.flags.expedition_unlocked) f.body.append(btn('Подготовка экспедиции', () => app.open('expedition'), 'primary'));
  f.body.append(btn('Вернуться на базу', () => app.close(), 'big'));
  return f;
}

// ===================================================================== радиопоиск
function radio(app) {
  const f = frame(app, 'Радиостанция Р-159: поиск сигнала', 'l'); const target = 147.3; const st = { lock: 0, done: !!Game.flags.signal_received };
  const freq = lab('', 'freq'), lvl = bar(0, 'var(--good)', 'thick'), status = lab('', 'warn big');
  const s = h('input.tuner', { type: 'range', min: 120, max: 175, step: 0.1, value: 128, id: 'radio-tuner' });
  f.body.append(lab('Медленно вращайте ручку настройки. Удерживайте частоту, когда уровень сигнала максимален.', 'dim'), freq, lvl, status, s);
  audio.setAmbient('amb_radio');
  const tick = () => {
    const x = +s.value; freq.textContent = x.toFixed(1) + ' МГц';
    let k = Math.max(0, Math.min(1, 1 - Math.abs(x - target) / 6)); k *= k; lvl.set(k * 100);
    if (st.done) { status.textContent = 'Сигнал получен. Отряд сержанта Ковалёва — Свалка, старое депо.'; return; }
    if (k > 0.92) { st.lock += 0.1; status.textContent = `Сигнал… держите частоту (${Math.floor(st.lock / 2 * 100)}%)`; if (st.lock >= 2) { st.done = true; audio.setAmbient('amb_wind'); app.open('dialog', 'signal'); } }
    else { st.lock = Math.max(0, st.lock - 0.2); status.textContent = k < 0.3 ? 'Шум эфира…' : 'Что-то есть рядом…'; }
  };
  const iv = setInterval(tick, 100); tick();
  f.tuner = s; f.radioTarget = target;
  return { ...f, onClose: () => { clearInterval(iv); audio.setAmbient('amb_wind'); } };
}

// ===================================================================== экспедиция
function expedition(app) {
  const f = frame(app, 'Подготовка экспедиции', 'l'); const sel = {};
  f.body.append(lab('Цель: Свалка, старое депо — отряд сержанта Ковалёва (5 человек, двое ранены).', 'warn'), lab('Выберите бойцов (база не должна остаться без охраны):'));
  for (const so of app.world.soldiers) {
    const b = btn(`☐ ${so.def.name} «${so.def.call}» — ${so.roleName()}, здоровье ${Math.round(so.hp)}`, () => { sel[so.sid] = !sel[so.sid]; b.textContent = `${sel[so.sid] ? '☑' : '☐'} ${so.def.name} «${so.def.call}» — ${so.roleName()}, здоровье ${Math.round(so.hp)}`; }, 'left', !so.alive);
    f.body.append(b);
  }
  f.body.append(lab('Снаряжение: патроны и медикаменты берутся со склада базы. Склад: ' + whSummary(), 'dim'),
    btn('Утвердить состав экспедиции', () => {
      const team = Object.keys(sel).filter((k) => sel[k]);
      if (!team.length) { msg('Выберите хотя бы одного бойца.', MSG.ALERT); return; }
      Game.setFlag('expedition_ready'); Game.flags.expedition_team = team;
      msg(`Экспедиция подготовлена (${team.length} бойцов). Выход — южные ворота → «Свалка» (локация в разработке).`, MSG.GOOD);
      app.close();
    }, 'primary big'));
  return f;
}
