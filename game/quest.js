// Задание «Возрождение Долга»: последовательность этапов с целями, диалоги, маркеры, журнал.
import { V3 } from '../engine/math.js';
import { audio } from '../engine/audio.js';
import { Game, events, msg, MSG } from './state.js';
import * as L from './layout.js';

const v = (x, y, z) => new V3(x, y, z);
export const STAGES = [
  { id: 'arrive', title: 'Прибытие', objs: [{ id: 'reach_rally', text: 'Встретиться с бойцами у штаба', kind: 'area', pos: v(0, 0, -12), r: 7 }] },
  { id: 'hq', title: 'Штаб', objs: [{ id: 'inside_hq', text: 'Осмотреть штаб командования', kind: 'event', event: 'inside_hq', pos: v(0, 0, -36) }] },
  { id: 'damage', title: 'Осмотр повреждений', objs: [
    { id: 'inspect_generator', text: 'Осмотреть генераторную', kind: 'flag', flag: 'inspect_generator', pos: v(-20, 0, -64.5) },
    { id: 'inspect_radio', text: 'Осмотреть радиоцентр', kind: 'flag', flag: 'inspect_radio', pos: v(18, 0, -64.5) },
    { id: 'inspect_armory', text: 'Осмотреть оружейную', kind: 'flag', flag: 'inspect_armory', pos: v(-53.5, 0, 2) }] },
  { id: 'officer', title: 'Доклад офицера', objs: [{ id: 'talk_officer', text: 'Поговорить с капитаном Рябовым', kind: 'flag', flag: 'talked_officer', soldier: 's_officer' }] },
  { id: 'parts', title: 'Инструменты и детали', objs: [
    { id: 'get_tools', text: 'Найти инструменты', kind: 'count', item: 'tools', n: 1, pos: v(68, 0, -3) },
    { id: 'get_elec', text: 'Найти электронные компоненты', kind: 'count', item: 'electronics', n: 3 },
    { id: 'get_scrap', text: 'Собрать металлолом', kind: 'count', item: 'scrap', n: 8 }] },
  { id: 'deliver', title: 'Склад', objs: [{ id: 'deliver_wh', text: 'Сдать материалы на основной склад (панель склада)', kind: 'flag', flag: 'deposited', pos: v(55.5, 0, -44) }] },
  { id: 'power', title: 'Электроснабжение', objs: [
    { id: 'gen_repair', text: 'Восстановить генераторную (панель → ремонт)', kind: 'building', b: 'generator', lvl: 1, pos: v(-20, 0, -64.5) },
    { id: 'gen_fuel', text: 'Найти топливо и запустить генератор', kind: 'power', pos: v(-24.6, 0, -69.5) }] },
  { id: 'armory', title: 'Оружейная', objs: [
    { id: 'armory_rubble', text: 'Разобрать завал у входа в оружейную', kind: 'rubble', b: 'armory', pos: v(-54.7, 0, 2) },
    { id: 'armory_cache', text: 'Обследовать оружейную: найти тайник', kind: 'event', event: 'open_armory_cache', pos: v(-68, 0, 4) }] },
  { id: 'kpp', title: 'Охрана КПП', objs: [{ id: 'arm_guards', text: 'Вооружить охрану КПП: 2 бойца (панель оружейной)', kind: 'kpp', n: 2, pos: v(0, 0, 76) }] },
  { id: 'radio', title: 'Радиоцентр', objs: [{ id: 'radio_repair', text: 'Восстановить радиоцентр', kind: 'building', b: 'radio', lvl: 1, pos: v(18, 0, -64.5) }] },
  { id: 'signal', title: 'Сигнал', objs: [{ id: 'radio_signal', text: 'Поймать сигнал выживших (панель радиоцентра)', kind: 'flag', flag: 'signal_received', pos: v(16.5, 0, -74.6) }] },
  { id: 'expedition', title: 'Подготовка экспедиции', objs: [{ id: 'exp_prep', text: 'Подготовить экспедицию в штабе (панель штаба)', kind: 'flag', flag: 'expedition_ready', pos: v(0, 0, -43.2) }] },
];

const DIALOGS = {
  intro: [{ who: '', text: 'Зона отчуждения. Район Ростока.\n\nПосле внезапного нападения группировка «Долг» почти уничтожена: бойцы погибли или пропали, техника потеряна, склады разграблены.\n\nГенерал возвращается на разрушенную базу с небольшой группой выживших.' }],
  arrival: [
    { who: 'Сержант Захаров «Гром»', text: 'Товарищ генерал! Живой… Мы уж и не надеялись. Здесь все, кто остался — шесть человек.' },
    { who: 'Генерал', text: 'Вольно, бойцы. Сначала осмотрюсь в штабе. Потом — доклад.' }],
  officer: [
    { who: 'Капитан Рябов', text: 'Товарищ генерал, докладываю. База разрушена примерно на семьдесят процентов. Генераторная разбита, радиоцентр без питания, вход в оружейную завалило при обстреле.', options: [{ text: 'Что с личным составом?', next: 1 }, { text: 'С чего начинаем?', next: 2 }] },
    { who: 'Капитан Рябов', text: 'Шесть человек вместе со мной. Кравец ранен, но держится. Остальные погибли или пропали без вести. Связи ни с кем нет.', options: [{ text: 'С чего начинаем?', next: 2 }] },
    { who: 'Капитан Рябов', text: 'Свет и связь. Без генератора не поднять радиоцентр, а без радио своих не найти. Нужны инструменты, электроника и металл. Ищите в мастерской, в разбитой технике и за периметром — но там слепые псы, зомбированные и мародёры. Найденное сдавайте на склад.', options: [{ text: 'Приступаем. Выполнять!', action: 'talked_officer' }] }],
  signal: [
    { who: 'Радиоэфир', text: '…ш-ш-ш… говорит сержант Ковалёв… отряд «Долга»… нас пятеро, двое ранены… держимся у старого депо на Свалке… мародёры прижали… боеприпасы на исходе… кто слышит — приём…' },
    { who: 'Генерал', text: 'Ковалёв, слышу тебя. Это база. Держитесь — готовим выход к вам.', options: [{ text: 'Конец связи.', action: 'signal_received' }] }],
  finale: [
    { who: 'Капитан Рябов', text: 'Экспедиция готова к выходу, товарищ генерал. Маршрут — через южные ворота, на Свалку, к старому депо.' },
    { who: '', text: 'Первый этап завершён: база частично восстановлена, электроснабжение и связь работают, найден выживший отряд.\n\nСледующая локация («Свалка») будет создана после подтверждения.' }],
};

export class Quest {
  constructor() { this.reset(); this.t = 0; this.world = null; events.on('visited', (id) => { this.seen[id] = true; }); }
  reset() { this.stage = 0; this.done = {}; this.seen = {}; this.finished = false; this.log = []; }
  current() { return STAGES[Math.min(this.stage, STAGES.length - 1)]; }
  currentTitle() { return this.finished ? 'Задание выполнено' : '«Возрождение Долга»: ' + this.current().title; }
  wantsInspect(id) { return this.stage >= 2 && !Game.flags[id]; }
  objDone(o) {
    if (this.done[o.id]) return true;
    const pl = this.world && this.world.player;
    switch (o.kind) {
      case 'area': return !!pl && pl.pos.dist(o.pos) < o.r;
      case 'event': return !!this.seen[o.event];
      case 'flag': return !!Game.flags[o.flag];
      case 'count': return Game.total(o.item) >= o.n || !!Game.flags['parts_ok_' + o.item];
      case 'building': return Game.level(o.b) >= o.lvl;
      case 'power': return Game.powerOn;
      case 'rubble': return !!Game.worldState.rubble[o.b];
      case 'kpp': return this.kppGuards() >= o.n;
    }
    return false;
  }
  kppGuards() {
    if (!this.world) return 0;
    const [x, z, w, h] = L.KPP_ZONE;
    return this.world.soldiers.filter((s) => s.alive && s.supplied && (s.order === 'guard' || s.order === 'defend') && s.orderTarget instanceof V3
      && s.orderTarget.x >= x && s.orderTarget.x <= x + w && s.orderTarget.z >= z && s.orderTarget.z <= z + h).length;
  }
  objProgress(o) {
    if (o.kind === 'count') return ` (${Math.min(Game.total(o.item), o.n)}/${o.n})`;
    if (o.kind === 'kpp') return ` (${this.kppGuards()}/${o.n})`;
    if (o.kind === 'building' && Game.job(o.b)) return ` — идёт ремонт ${Math.floor(Game.progress(o.b) / Game.workNeeded(o.b) * 100)}%`;
    return '';
  }
  objectives() { return this.finished ? [] : this.current().objs.map((o) => ({ text: o.text + this.objProgress(o), done: this.objDone(o), pos: o.pos, soldier: o.soldier || '' })); }
  // позиция ближайшей невыполненной цели (стрелка трекера и карта)
  marker() {
    if (this.finished || !this.world) return null;
    for (const o of this.current().objs) {
      if (this.objDone(o)) continue;
      if (o.soldier && this.world.soldierMap[o.soldier]) return this.world.soldierMap[o.soldier].pos;
      if (o.pos) return o.pos;
      if (o.kind === 'count') return this.nearestWith(o.item);
    }
    return null;
  }
  nearestWith(item) {
    const pl = this.world.player; if (!pl) return null;
    let best = null, bd = Infinity;
    for (const c of this.world.interactables) {
      const has = (c.items && c.items[item]) || (c.res === item && c.sid);
      if (!has || !c.can()) continue;
      const d = c.p.dist(pl.pos); if (d < bd) { bd = d; best = c.p; }
    }
    return best;
  }
  update(dt) {
    if (!this.world || this.finished) return;
    this.t -= dt; if (this.t > 0) return; this.t = 0.4;
    let all = true;
    for (const o of this.current().objs) {
      if (this.objDone(o)) { if (!this.done[o.id]) { this.done[o.id] = true; msg('Выполнено: ' + o.text, MSG.GOOD); audio.play('ui_ok'); events.emit('objective_done', o.text); } }
      else all = false;
    }
    if (all) this.advance();
  }
  advance() {
    const fin = this.current().id;
    this.stage++;
    this.onComplete(fin);
    if (this.stage >= STAGES.length) { this.finished = true; this.stage = STAGES.length - 1; msg('Задание «Возрождение Долга» выполнено!', MSG.GOOD); }
    else { msg('Новая цель: ' + this.current().title); this.onStart(this.current().id); }
    events.emit('quest');
    events.emit('autosave');
  }
  onComplete(id) {
    if (id === 'arrive') events.emit('ui', 'dialog', 'arrival');
    if (id === 'parts') for (const it of ['tools', 'electronics', 'scrap']) Game.flags['parts_ok_' + it] = true;
    if (id === 'signal') Game.setFlag('expedition_unlocked');
    if (id === 'expedition') events.emit('ui', 'dialog', 'finale');
  }
  onStart(id) {
    if (id === 'officer') { const o = this.world.soldierMap.s_officer; if (o && o.alive) o.giveOrder('idle'); }
    if (id === 'power') msg('Подсказка: откройте панель генераторной и начните ремонт. Работать можно самому (удерживать «Действие» у входа) или назначить техника.');
    if (id === 'kpp') msg('Подсказка: в панели оружейной выдайте бойцам патроны и назначьте их на охрану КПП.');
  }
  addLog(text) { this.log.push({ day: Game.day, time: Game.timeStr(), text }); }
  dialog(id) { return DIALOGS[id] || []; }
  dialogAction(a) {
    if (!a) return;
    Game.setFlag(a);
    if (a === 'signal_received') this.addLog('Сигнал отряда сержанта Ковалёва: Свалка, старое депо. Пятеро, двое ранены.');
    if (a === 'talked_officer') this.addLog('Доклад капитана Рябова: нужны свет и связь — генераторная и радиоцентр.');
  }
  saveData() { return { stage: this.stage, done: this.done, seen: this.seen, finished: this.finished, log: this.log }; }
  loadData(d) { this.reset(); if (!d) return; this.stage = d.stage || 0; this.done = d.done || {}; this.seen = d.seen || {}; this.finished = !!d.finished; this.log = d.log || []; }
}
