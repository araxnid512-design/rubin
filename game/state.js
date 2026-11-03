// Состояние игры: инвентарь генерала, склад базы, здания, бойцы, флаги, мир, время. Сохранение в localStorage.
import { EventBus } from '../engine/events.js';
import { V3 } from '../engine/math.js';
import * as L from './layout.js';
import { item, stackSize, isWeapon, weapon, weaponSlot, RESOURCES, itemName } from './items.js';

export const events = new EventBus();
export const MSG = { INFO: 0, GOOD: 1, ALERT: 2, RADIO: 3 };
export const msg = (text, kind = MSG.INFO) => events.emit('message', text, kind);

export class Inventory {
  constructor(cap = 16) { this.capacity = cap; this.slots = new Array(cap).fill(null); }
  count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; }
  freeSlots() { return this.slots.filter((s) => !s).length; }
  add(id, n, extra = {}) {
    if (n <= 0) return 0;
    const st = stackSize(id); let left = n;
    if (!isWeapon(id)) for (const s of this.slots) { if (left <= 0) break; if (s && s.id === id && s.n < st) { const put = Math.min(st - s.n, left); s.n += put; left -= put; } }
    for (let i = 0; i < this.slots.length && left > 0; i++) if (!this.slots[i]) { const put = Math.min(st, left); this.slots[i] = { id, n: put, ...extra }; left -= put; }
    if (left !== n) events.emit('inventory');
    return left;
  }
  remove(id, n) {
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) { const s = this.slots[i]; if (s && s.id === id) { const t = Math.min(s.n, left); s.n -= t; left -= t; if (s.n <= 0) this.slots[i] = null; } }
    if (left !== n) events.emit('inventory');
    return n - left;
  }
  take(i) { const s = this.slots[i]; this.slots[i] = null; if (s) events.emit('inventory'); return s; }
  toData() { return this.slots.map((s) => (s ? { ...s } : null)); }
  fromData(d) { this.slots = new Array(this.capacity).fill(null); (d || []).slice(0, this.capacity).forEach((s, i) => { this.slots[i] = s ? { ...s } : null; }); events.emit('inventory'); }
}

const SAVE_KEY = (slot) => 'dolg_save_' + slot;
export const SLOTS = 3;

class GameState {
  constructor() { this.world = null; this.player = null; this.ui = null; this.newGame(); }
  newGame() {
    this.inv = new Inventory(16);
    this.inv.add('bandage', 2); this.inv.add('ammo_9x18', 16);
    this.equip = { primary: null, pistol: { id: 'pm', ammo: 8, cond: 82 }, active: 1 };
    this.quick = ['bandage', 'water', '', ''];
    this.inv.add('water', 1); this.inv.add('bread', 1);
    // hunger/thirst — сытость и жажда (100 — норма), bleed — кровотечение (ед. здоровья в секунду), belt — артефакты на поясе
    this.playerState = { hp: 100, stamina: 100, rad: 0, hunger: 85, thirst: 80, bleed: 0, belt: [], pos: [...L.PLAYER_START], yaw: L.PLAYER_START_YAW, armor: 'armor_duty' };
    this.warehouse = { scrap: 2, planks: 2, provisions: 4 };
    this.buildings = {};
    for (const b of L.BUILDINGS) this.buildings[b.id] = { level: b.level, job: '', progress: 0 };
    this.soldiers = {};
    for (const s of L.SOLDIERS) {
      const w = weapon(s.weapon), mag = w ? w.mag : 0;
      this.soldiers[s.id] = { hp: s.hp, max_hp: 100, weapon: s.weapon, ammo: mag, reserve: s.role === 'gunner' ? 0 : mag, order: 'idle', target: null, pos: [...s.pos], yaw: 0, skill: 1, supplied: false, alive: true };
    }
    this.flags = {};
    this.worldState = { taken: {}, containers: {}, rubble: {}, salvage: {}, dead: {}, doors: {} };
    this.time = 7.5; this.day = 1; this.powerOn = false; this.fuel = 0; this.playTime = 0;
    this.nextRaid = -1; this.raidsRepelled = 0; // абсолютное игровое время следующего набега (часы), -1 — набеги ещё не начались
  }
  hours() { return this.day * 24 + this.time; }
  // ---------------- склад и ресурсы
  wh(id) { return this.warehouse[id] || 0; }
  whTotal() { return Object.values(this.warehouse).reduce((a, b) => a + b, 0); }
  whCapacity() { return [300, 800, 2000][Math.min(2, this.level('warehouse'))]; }
  whAdd(id, n) { const put = Math.min(n, Math.max(0, this.whCapacity() - this.whTotal())); if (put > 0) { this.warehouse[id] = this.wh(id) + put; events.emit('warehouse'); } return put; }
  whRemove(id, n) { const t = Math.min(n, this.wh(id)); if (t > 0) { this.warehouse[id] -= t; if (this.warehouse[id] <= 0) delete this.warehouse[id]; events.emit('warehouse'); } return t; }
  total(id) { return this.wh(id) + this.inv.count(id); }
  canAfford(cost) { return Object.entries(cost).every(([k, n]) => this.total(k) >= n); }
  missing(cost) { const m = {}; for (const [k, n] of Object.entries(cost)) { const h = this.total(k); if (h < n) m[k] = n - h; } return m; }
  consume(cost) {
    if (!this.canAfford(cost)) return false;
    for (const [k, n] of Object.entries(cost)) { let need = n; need -= this.whRemove(k, need); if (need > 0) this.inv.remove(k, need); }
    events.emit('inventory'); return true;
  }
  depositResources() {
    const moved = {};
    for (const id of RESOURCES) { const n = this.inv.count(id); if (n > 0) { const put = this.whAdd(id, n); if (put > 0) { this.inv.remove(id, put); moved[id] = put; } } }
    return moved;
  }
  give(id, n, extra = {}) {
    if (isWeapon(id)) {
      const slot = weaponSlot(id) === 1 ? 'pistol' : 'primary';
      if (!this.equip[slot]) { this.equip[slot] = { id, ammo: extra.ammo || 0 }; events.emit('equipment'); n -= 1; if (n <= 0) return 0; }
    }
    const left = this.inv.add(id, n, extra); events.emit('inventory'); return left;
  }
  // ---------------- здания
  def(id) { return L.BUILDINGS.find((b) => b.id === id) || {}; }
  level(id) { return this.buildings[id]?.level || 0; }
  job(id) { return this.buildings[id]?.job || ''; }
  progress(id) { return this.buildings[id]?.progress || 0; }
  workNeeded(id) { const d = this.def(id); return this.job(id) === 'upgrade' ? d.upgrade_work || 30 : d.repair_work || 30; }
  nextCost(id) { const d = this.def(id), l = this.level(id); return l === 0 ? d.repair || {} : l === 1 ? d.upgrade || {} : {}; }
  canStart(id) {
    const d = this.def(id), l = this.level(id);
    if (this.job(id)) return 'Работы уже ведутся';
    if (l >= 2) return 'Здание полностью улучшено';
    if (d.rubble && !this.worldState.rubble[id]) return 'Вход завален — сначала разберите завал';
    if (l === 0 && d.needs_power && !this.powerOn) return 'Нет электропитания — восстановите генераторную';
    if (!this.canAfford(this.nextCost(id))) return 'Не хватает материалов';
    return '';
  }
  startJob(id) {
    if (this.canStart(id)) return false;
    if (!this.consume(this.nextCost(id))) return false;
    const l = this.level(id); this.buildings[id].job = l === 0 ? 'repair' : 'upgrade'; this.buildings[id].progress = 0;
    events.emit('building', id); msg(`${this.def(id).name}: начаты работы (${l === 0 ? 'ремонт' : 'улучшение'}).`);
    return true;
  }
  addWork(id, amount) {
    if (!this.job(id)) return false;
    const b = this.buildings[id]; b.progress += amount;
    if (b.progress >= this.workNeeded(id)) {
      const job = b.job; b.job = ''; b.progress = 0; b.level += 1;
      msg(`${this.def(id).name}: ${job === 'repair' ? 'восстановлено' : 'улучшено'}!`, MSG.GOOD);
      events.emit('sfx', 'build_done'); events.emit('building', id);
      if (id === 'generator') msg('Генератор исправен. Нужно топливо — заправьте его на панели генераторной.');
      if (id === 'barracks') msg(`Вместимость базы: ${this.soldierCap()} бойцов.`, MSG.GOOD);
      return true;
    }
    return false;
  }
  soldierCap() { return [6, 12, 20][Math.min(2, this.level('barracks'))]; }
  refuel(units) {
    let used = 0;
    for (let i = 0; i < units; i++) { if (this.total('fuel') <= 0) break; this.consume({ fuel: 1 }); this.fuel += 8; used++; }
    if (used) { msg(`Генератор заправлен: +${used * 8} ч работы.`, MSG.GOOD); this.updatePower(); }
    return used;
  }
  updatePower() {
    const on = this.level('generator') >= 1 && this.fuel > 0 && this.flags.gen_switch !== false;
    if (on !== this.powerOn) {
      this.powerOn = on; events.emit('power', on);
      if (on) { msg('Электроснабжение базы восстановлено.', MSG.GOOD); events.emit('sfx', 'power_on'); } else msg('Электропитание отключено.', MSG.ALERT);
    }
  }
  setFlag(f, val = true) { this.flags[f] = val; events.emit('flag', f); }
  // ---------------- время
  advance(hours) {
    this.time += hours;
    if (this.time >= 24) { this.time -= 24; this.day++; }
    if (this.powerOn) { this.fuel = Math.max(0, this.fuel - hours); if (this.fuel <= 0) this.updatePower(); }
  }
  timeStr() { const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60); return `День ${this.day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  isNight() { return this.time < 6 || this.time > 20.5; }
  // ---------------- сохранения
  hasSave(slot) { try { return !!localStorage.getItem(SAVE_KEY(slot)); } catch (e) { return false; } }
  slotInfo(slot) {
    try { const d = JSON.parse(localStorage.getItem(SAVE_KEY(slot)) || 'null'); return d ? `${d.saved_at} · ${d.summary}` : 'Пусто'; } catch (e) { return 'Недоступно'; }
  }
  latestSlot() {
    let best = -1, bt = 0;
    for (let i = 0; i <= SLOTS; i++) { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY(i)) || 'null'); if (d && d.t > bt) { bt = d.t; best = i; } } catch (e) { /* нет доступа */ } }
    return best;
  }
  collect(questData, summary) {
    this.player?.writeState(); this.world?.writeState();
    return {
      version: 1, t: Date.now(), saved_at: new Date().toLocaleString('ru-RU'), summary,
      inv: this.inv.toData(), equip: this.equip, quick: this.quick, player: this.playerState, warehouse: this.warehouse,
      buildings: this.buildings, soldiers: this.soldiers, flags: this.flags, worldState: this.worldState,
      time: this.time, day: this.day, fuel: this.fuel, quest: questData, playTime: this.playTime, nextRaid: this.nextRaid, raidsRepelled: this.raidsRepelled,
    };
  }
  save(slot, questData, summary) {
    try {
      localStorage.setItem(SAVE_KEY(slot), JSON.stringify(this.collect(questData, summary)));
      msg(`Игра сохранена (${slot === 0 ? 'автосохранение' : 'слот ' + slot}).`, MSG.GOOD); return true;
    } catch (e) { msg('Не удалось сохранить игру: ' + e.message, MSG.ALERT); return false; }
  }
  read(slot) { try { return JSON.parse(localStorage.getItem(SAVE_KEY(slot)) || 'null'); } catch (e) { return null; } }
  apply(d) {
    this.newGame();
    this.inv.fromData(d.inv); this.equip = d.equip; this.quick = d.quick; this.playerState = { ...this.playerState, ...d.player }; this.warehouse = d.warehouse || {};
    this.nextRaid = d.nextRaid ?? -1; this.raidsRepelled = d.raidsRepelled || 0;
    for (const k in d.buildings) if (this.buildings[k]) this.buildings[k] = { ...d.buildings[k] };
    for (const k in d.soldiers) if (this.soldiers[k]) this.soldiers[k] = { ...this.soldiers[k], ...d.soldiers[k] };
    this.flags = d.flags || {}; this.worldState = { ...this.worldState, ...(d.worldState || {}) };
    this.time = d.time; this.day = d.day; this.fuel = d.fuel || 0; this.powerOn = false; this.playTime = d.playTime || 0;
  }
}

export const Game = new GameState();
export { V3, itemName, item };
