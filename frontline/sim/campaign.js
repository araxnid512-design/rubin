// Модель кампании — единственный источник истины об экономике. UI только отправляет команды.
// Каждая команда (добыть, построить, произвести, нанять) проверяет предпосылки и меняет состояние ровно один раз.
// Время — активные секунды игры (пауза и закрытое приложение не считаются).
import { EnemyDirector } from './enemy_director.js';

export const SECTORS = ['friendly_home', 'battlefield', 'enemy_home'];
export const SAVE_VERSION = 3;
const SAVE_KEY = 'supply_line_save';

export class Campaign {
  constructor(data) {
    this.data = data; this.world = data.world; this.items = data.items; this.npcs = data.npcs;
    this.bdefs = {}; for (const b of data.buildings.buildings) this.bdefs[b.id] = b;
    this.prep = +this.world.preparation_phase.duration_seconds;
    this.node = this.world.scrap_node;
    this.enemy = new EnemyDirector(data.enemy_ai, data.buildings);
    this.listeners = [];
    this.reset();
  }
  on(fn) { this.listeners.push(fn); }
  emit(type, d) { for (const f of this.listeners) f(type, d); }
  reset() {
    this.campaign_seconds = 0; this.sector_index = 0;
    const sp = this.sectorDef(0).player_spawn_xz;
    this.player = { x: sp[0], z: sp[1], yaw: 0 };
    this.inventory = { slots: [{ id: 'tool_hammer' }, { id: 'tool_wrench' }, null, null, null, null, null, null, null, null], selected: 0 };
    this.scrap = +(this.items.resource.initial_amount || 0);
    this.nodes = Array.from({ length: 12 }, () => ({ d: this.node.durability_units, respawnAt: 0 }));
    this.buildings = []; this.jobs = {}; this.storage = {}; this.recruits = []; this.hiring = {}; this.uid = 1;
    this.totals = { harvested: 0, spent: 0 }; this.lastMineAt = -10;
    this.enemy.reset();
  }
  sectorDef(i) { return this.world.sectors[i]; }
  sectorId(i = this.sector_index) { return SECTORS[i]; }
  // ---------------------------------------------------------------- время и фаза подготовки
  advance(sec) {
    if (sec <= 0) return;
    this.campaign_seconds += sec;
    this.enemy.advance(sec);
    this._processQueues();
  }
  prepLeft() { return Math.max(0, this.prep - this.campaign_seconds); }
  prepDone() { return this.campaign_seconds >= this.prep; }
  // Доступ к секторам: до 30:00 поле боя закрыто; затем только №1↔№2. Вражеская база (№3) недоступна всегда.
  canEnterSector(dest) {
    const cur = this.sector_index;
    if (dest === cur) return true;
    if (dest === 2) return false;
    if (dest === 1) return cur === 0 && this.prepDone();
    if (dest === 0) return cur === 1;
    return false;
  }
  transitionTo(dest, spawnXZ) {
    if (!this.canEnterSector(dest) || dest === this.sector_index) return false;
    this.sector_index = dest; this.player.x = spawnXZ[0]; this.player.z = spawnXZ[1];
    this.emit('sector', dest);
    return true;
  }
  // ---------------------------------------------------------------- инструменты
  selectedTool() { const s = this.inventory.slots[this.inventory.selected]; return s ? s.id : ''; }
  select(i) { if (i >= 0 && i < this.inventory.slots.length && this.inventory.slots[i]) { this.inventory.selected = i; this.emit('tool', this.selectedTool()); return true; } return false; }
  // ---------------------------------------------------------------- металлолом
  nodeState(i) {
    const n = this.nodes[i];
    if (n.d === 0 && n.respawnAt <= this.campaign_seconds) { n.d = this.node.durability_units; n.respawnAt = 0; this.emit('node', i); }
    return n.d > 0 ? 'available' : 'recovering';
  }
  // один удар молотком: проверка → расчёт → применение ровно один раз
  mine(i, distance) {
    if (this.sector_index !== 0) return { ok: false, reason: 'Здесь нет нашего металлолома.' };
    if (this.selectedTool() !== 'tool_hammer') return { ok: false, reason: 'Нужен молоток: выберите его в инвентаре.' };
    if (!(i >= 0 && i < this.nodes.length)) return { ok: false, reason: 'Нет кучи.' };
    if (distance > this.node.interaction_radius_m) return { ok: false, reason: 'Подойдите ближе к куче.' };
    if (this.nodeState(i) !== 'available') return { ok: false, reason: 'Куча разобрана — восстановится позже.' };
    const h = this.node.hammer;
    if (this.campaign_seconds - this.lastMineAt < h.cooldown_seconds) return { ok: false, reason: '', cooldown: true };
    const max = this.items.resource.maximum_stack || 999;
    if (this.scrap >= max) return { ok: false, reason: 'Склад металлолома полон (999).' };
    const gained = Math.min(h.scrap_gained, max - this.scrap);
    const n = this.nodes[i];
    n.d -= h.durability_spent; if (n.d <= 0) { n.d = 0; n.respawnAt = this.campaign_seconds + this.node.respawn_seconds; }
    this.scrap += gained; this.totals.harvested += gained; this.lastMineAt = this.campaign_seconds;
    this.emit('scrap', this.scrap); if (n.d === 0) this.emit('node', i);
    return { ok: true, gained, depleted: n.d === 0, left: n.d };
  }
  // ---------------------------------------------------------------- строительство
  canBuildHere(id, sector = this.sector_index) {
    const b = this.bdefs[id]; if (!b) return 'Неизвестное здание.';
    const sid = SECTORS[sector];
    if (sid === 'enemy_home') return 'Строить на вражеской территории нельзя.';
    if (sid === 'battlefield') {
      if (id !== 'military_bunker') return 'На поле боя можно строить только бункер.';
      if (!this.prepDone()) return 'Поле боя закрыто до конца подготовки.';
    }
    if (b.allowed_sector_ids && !b.allowed_sector_ids.includes(sid)) return 'В этом секторе это здание недоступно.';
    return '';
  }
  build(id, x, z, angle, placementOk) {
    const why = this.canBuildHere(id); if (why) return { ok: false, reason: why };
    if (!placementOk) return { ok: false, reason: 'Площадка не подходит.' };
    const cost = this.bdefs[id].build_scrap_cost;
    if (this.scrap < cost) return { ok: false, reason: `Нужно ${cost} металлолома, есть ${this.scrap}.` };
    this.scrap -= cost; this.totals.spent += cost;
    const rec = { uid: this.uid++, id, sector: this.sectorId(), x: +x.toFixed(2), z: +z.toFixed(2), angle: ((angle % 360) + 360) % 360, builtAt: +this.campaign_seconds.toFixed(2), hp: 100 };
    this.buildings.push(rec);
    this.emit('scrap', this.scrap); this.emit('built', rec);
    return { ok: true, rec };
  }
  buildingsIn(sector = this.sector_index) { const sid = SECTORS[sector]; return this.buildings.filter((b) => b.sector === sid); }
  // ---------------------------------------------------------------- производство (очередь до 5 заказов на здание)
  queue(uid) { return this.jobs[uid] || (this.jobs[uid] = []); }
  produce(uid, outputId) {
    const b = this.buildings.find((x) => x.uid === uid); if (!b) return { ok: false, reason: 'Нет здания.' };
    const rec = (this.bdefs[b.id].recipes || []).find((r) => r.output_item_id === outputId);
    if (!rec) return { ok: false, reason: 'Здание это не производит.' };
    const q = this.queue(uid);
    if (q.length >= 5) return { ok: false, reason: 'Очередь заполнена (5 заказов).' };
    if (this.scrap < rec.scrap_cost) return { ok: false, reason: `Нужно ${rec.scrap_cost} металлолома.` };
    this.scrap -= rec.scrap_cost; this.totals.spent += rec.scrap_cost;
    const start = Math.max(this.campaign_seconds, q.length ? q[q.length - 1].finishAt : 0);
    q.push({ out: outputId, qty: rec.quantity, seconds: rec.seconds, startAt: +start.toFixed(2), finishAt: +(start + rec.seconds).toFixed(2), kind: 'item' });
    this.emit('scrap', this.scrap); this.emit('queue', uid);
    return { ok: true };
  }
  // ---------------------------------------------------------------- казарма: найм (вместимость 8 на казарму)
  barracksCapacity() { return this.buildings.filter((b) => b.id === 'military_barracks' && b.sector === 'friendly_home').length * (this.bdefs.military_barracks.npc_capacity || 8); }
  pendingHires() { let n = 0; for (const uid in this.jobs) for (const j of this.jobs[uid]) if (j.kind === 'npc') n++; return n; }
  hire(uid, roleId) {
    const b = this.buildings.find((x) => x.uid === uid && x.id === 'military_barracks'); if (!b) return { ok: false, reason: 'Нужна казарма.' };
    const r = this.bdefs.military_barracks.recruitment.find((x) => x.npc_role_id === roleId); if (!r) return { ok: false, reason: 'Нет такой роли.' };
    if (this.recruits.length + this.pendingHires() >= this.barracksCapacity()) return { ok: false, reason: 'Казарма заполнена (8 человек).' };
    const q = this.queue(uid);
    if (q.length >= 5) return { ok: false, reason: 'Очередь найма заполнена.' };
    if (this.scrap < r.scrap_cost) return { ok: false, reason: `Нужно ${r.scrap_cost} металлолома.` };
    this.scrap -= r.scrap_cost; this.totals.spent += r.scrap_cost;
    const start = Math.max(this.campaign_seconds, q.length ? q[q.length - 1].finishAt : 0);
    q.push({ out: roleId, qty: 1, seconds: r.seconds, startAt: +start.toFixed(2), finishAt: +(start + r.seconds).toFixed(2), kind: 'npc' });
    this.emit('scrap', this.scrap); this.emit('queue', uid);
    return { ok: true };
  }
  setOrder(rid, order) { const r = this.recruits.find((x) => x.uid === rid); if (!r) return false; r.order = order; this.emit('orders', rid); return true; }
  _processQueues() {
    for (const uid in this.jobs) {
      const q = this.jobs[uid];
      while (q.length && q[0].finishAt <= this.campaign_seconds) {
        const j = q.shift();
        if (j.kind === 'npc') { const r = { uid: this.uid++, role: j.out, hiredAt: j.finishAt, order: 'hold_position', sector: 'friendly_home' }; this.recruits.push(r); this.emit('hired', r); }
        else { this.storage[j.out] = (this.storage[j.out] || 0) + j.qty; this.emit('produced', { id: j.out, qty: j.qty }); }
      }
    }
  }
  count(role) { return this.recruits.filter((r) => r.role === role).length; }
  // ---------------------------------------------------------------- сохранение
  serialize() {
    return JSON.parse(JSON.stringify({
      save_version: SAVE_VERSION, campaign_seconds: this.campaign_seconds, sector_index: this.sector_index, player: this.player, inventory: this.inventory,
      scrap: this.scrap, nodes: this.nodes, buildings: this.buildings, jobs: this.jobs, storage: this.storage, recruits: this.recruits, uid: this.uid,
      totals: this.totals, enemy_state: this.enemy.serialize(), saved_at: new Date().toISOString(),
    }));
  }
  load(d) {
    if (!d || d.save_version !== SAVE_VERSION) return false;
    this.reset();
    this.campaign_seconds = Math.max(0, +d.campaign_seconds || 0);
    this.sector_index = [0, 1].includes(d.sector_index) ? d.sector_index : 0;
    if (this.sector_index === 1 && !this.prepDone()) this.sector_index = 0;
    this.player = { ...this.player, ...d.player };
    if (d.inventory && Array.isArray(d.inventory.slots) && d.inventory.slots.length === 10) this.inventory = d.inventory;
    this.scrap = Math.max(0, Math.min(999, d.scrap | 0));
    if (Array.isArray(d.nodes) && d.nodes.length === 12) this.nodes = d.nodes;
    this.buildings = d.buildings || []; this.jobs = d.jobs || {}; this.storage = d.storage || {}; this.recruits = d.recruits || []; this.uid = d.uid || 1;
    this.totals = d.totals || this.totals;
    this.enemy.loadState(d.enemy_state);
    return true;
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); return true; } catch (e) { return false; } }
  static readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* нет доступа */ } }
}
