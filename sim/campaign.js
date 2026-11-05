// Модель кампании — единственный источник истины об экономике. UI только отправляет команды.
// Каждая команда (добыть, построить, произвести, нанять) проверяет предпосылки и меняет состояние ровно один раз.
// Время — активные секунды игры (пауза и закрытое приложение не считаются).
import { EnemyDirector } from './enemy_director.js';
import { Army, cloneUnits } from './army.js';
import { VEH } from './vehicle_data.js';

export const SECTORS = ['friendly_home', 'battlefield', 'enemy_home'];
export const SAVE_VERSION = 4;
const SAVE_KEY = 'supply_line_save';

export class Campaign {
  constructor(data) {
    this.data = data; this.world = data.world; this.items = data.items; this.npcs = data.npcs;
    this.bdefs = {}; for (const b of data.buildings.buildings) this.bdefs[b.id] = b;
    this.prep = +this.world.preparation_phase.duration_seconds;
    this.node = this.world.scrap_node;
    this.enemy = new EnemyDirector(data.enemy_ai, data.buildings);
    this.armySim = new Army(this);
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
    this.totals = { harvested: 0, spent: 0, npcMined: 0, npcDelivered: 0, repairSpent: 0 }; this.lastMineAt = -10;
    this.foes = []; this.vehicles = []; this.army = Army.initialState(); this.playerHp = 100; this.driving = 0; this.playerInBunker = 0; this.recon = false;
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
    this.armySim.tick(sec);
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
  setOrder(rid, order, op = {}) { return this.armySim.setOrder(rid, order, op).ok; }
  _processQueues() {
    for (const uid in this.jobs) {
      const q = this.jobs[uid];
      while (q.length && q[0].finishAt <= this.campaign_seconds) {
        const j = q.shift();
        if (j.kind === 'npc') {
          const bar = this.buildings.find((b) => b.uid === +uid) || this.buildings.find((b) => b.id === 'military_barracks');
          if (!bar) continue; // казарма разрушена — найм отменён
          const r = this.armySim.spawnRecruit(bar, j.out, j.finishAt); this.emit('hired', r);
        }
        else { this.storage[j.out] = (this.storage[j.out] || 0) + j.qty; this.emit('produced', { id: j.out, qty: j.qty }); }
      }
    }
  }
  count(role) { return this.recruits.filter((r) => r.role === role).length; }
  // ---------------------------------------------------------------- геометрия зданий и куч (без загрузки сектора)
  nodeXZ(sector, i) {
    const f = this.sectorDef(sector).scrap_field, [cx, cz] = f.center_xz, col = i % 4, row = Math.floor(i / 4);
    return [cx - f.width_m / 2 + 6 + col * (f.width_m - 12) / 3, cz - f.depth_m / 2 + 7 + row * (f.depth_m - 14) / 2];
  }
  fromLocal(rec, lx, lz) { const yaw = -rec.angle * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw); return [rec.x + lx * c + lz * s, rec.z - lx * s + lz * c]; }
  localXZ(rec, x, z) { const yaw = -rec.angle * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw), dx = x - rec.x, dz = z - rec.z; return [dx * c - dz * s, dx * s + dz * c]; }
  doorPoint(rec, out = 2) { return this.fromLocal(rec, 0, this.bdefs[rec.id].footprint_m[1] / 2 + out); }
  distToFootprint(rec, x, z) { const [fw, fd] = this.bdefs[rec.id].footprint_m, [lx, lz] = this.localXZ(rec, x, z); return Math.hypot(Math.max(0, Math.abs(lx) - fw / 2), Math.max(0, Math.abs(lz) - fd / 2)); }
  insideFootprint(rec, x, z, margin = 0) { const [fw, fd] = this.bdefs[rec.id].footprint_m, [lx, lz] = this.localXZ(rec, x, z); return Math.abs(lx) < fw / 2 - margin && Math.abs(lz) < fd / 2 - margin; }
  // ---------------------------------------------------------------- добыча наёмным рабочим: та же конечная куча
  npcMine(i, per) {
    if (this.nodeState(i) !== 'available') return 0;
    const n = this.nodes[i]; n.d -= 1;
    if (n.d <= 0) { n.d = 0; n.respawnAt = this.campaign_seconds + this.node.respawn_seconds; }
    this.totals.npcMined += per; this.emit('node', i);
    return per;
  }
  // сборщик металлолома: 2 прочности за действие → 20 металла (×2 к удару молотком)
  harvest(i, distance) {
    const veh = this.vehicles.find((v) => v.uid === this.driving);
    if (!veh || !VEH[veh.id].harvest) return { ok: false, reason: 'Нужен сборщик металлолома.' };
    if (this.sector_index !== 0) return { ok: false, reason: 'Здесь нет нашего металлолома.' };
    if (distance > 4.5) return { ok: false, reason: 'Подъедьте ближе к куче.' };
    if (this.nodeState(i) !== 'available') return { ok: false, reason: 'Куча разобрана — восстановится позже.' };
    const h = this.world.scrap_node.harvester_vehicle;
    if (this.campaign_seconds - (this.lastHarvestAt ?? -10) < h.cooldown_seconds) return { ok: false, reason: '', cooldown: true };
    const max = this.items.resource.maximum_stack || 999; if (this.scrap >= max) return { ok: false, reason: 'Склад металлолома полон (999).' };
    const n = this.nodes[i], spend = Math.min(h.durability_spent, n.d), gained = Math.min(Math.round(h.scrap_gained * spend / h.durability_spent), max - this.scrap);
    n.d -= spend; if (n.d <= 0) { n.d = 0; n.respawnAt = this.campaign_seconds + this.node.respawn_seconds; }
    this.scrap += gained; this.totals.harvested += gained; this.lastHarvestAt = this.campaign_seconds;
    this.emit('scrap', this.scrap); this.emit('node', i);
    return { ok: true, gained, depleted: n.d === 0, left: n.d };
  }
  // ---------------------------------------------------------------- оружие игрока: только изготовленное, со склада базы
  takeWeapon(wid) {
    const w = this.items.weapons.find((x) => x.id === wid); if (!w) return { ok: false, reason: 'Нет такого оружия.' };
    if (this.sector_index !== 0) return { ok: false, reason: 'Склад базы — на нашей территории.' };
    if (!(this.storage[wid] > 0)) return { ok: false, reason: 'На складе нет этого оружия.' };
    const i = this.inventory.slots.findIndex((s) => !s); if (i < 0) return { ok: false, reason: 'Инвентарь полон.' };
    if (w.class === 'throwable') { const n = Math.min(3, this.storage[wid]); this.storage[wid] -= n; this.inventory.slots[i] = { id: wid, count: n }; this.emit('inventory'); return { ok: true, slot: i }; }
    const ids = w.ammo_id ? [w.ammo_id] : (w.compatible_ammo_ids || []).filter((a) => !a.includes('smoke'));
    const am = ids.find((a) => this.storage[a] > 0); if (!am) return { ok: false, reason: 'Нет патронов к этому оружию — сначала произведите их.' };
    this.storage[wid]--; const n = Math.min(this.storage[am], w.magazine * 6); this.storage[am] -= n;
    this.inventory.slots[i] = { id: wid, ammoId: am, mag: Math.min(n, w.magazine), ammo: n - Math.min(n, w.magazine) };
    this.emit('inventory');
    return { ok: true, slot: i };
  }
  returnWeapon(i) {
    const s = this.inventory.slots[i]; if (!s || !s.id.startsWith('wp_')) return { ok: false, reason: 'Это не оружие.' };
    if (this.sector_index !== 0) return { ok: false, reason: 'Сдать можно только на складе базы.' };
    this.storage[s.id] = (this.storage[s.id] || 0) + (s.count != null ? s.count : 1);
    if (s.ammoId) this.storage[s.ammoId] = (this.storage[s.ammoId] || 0) + (s.mag || 0) + (s.ammo || 0);
    this.inventory.slots[i] = null; if (this.inventory.selected === i) this.inventory.selected = 0;
    this.emit('inventory');
    return { ok: true };
  }
  // ---------------------------------------------------------------- техника
  vehDef(id) { return { ...(this.items.vehicles.find((v) => v.id === id) || {}), ...VEH[id] }; }
  rollOut(bUid, vehId) {
    const b = this.buildings.find((x) => x.uid === bUid); if (!b || this.bdefs[b.id].category !== 'vehicles') return { ok: false, reason: 'Выкатить можно только из автоцеха.' };
    if (!(this.storage[vehId] > 0)) return { ok: false, reason: 'На складе нет такой машины.' };
    if (this.vehicles.filter((v) => v.sector === b.sector).length >= 12) return { ok: false, reason: 'Слишком много машин на карте (12).' };
    const d = VEH[vehId], [x, z] = this.doorPoint(b, 3 + d.len / 2);
    this.storage[vehId]--;
    const veh = { uid: this.uid++, id: vehId, sector: b.sector, x: +x.toFixed(2), z: +z.toFixed(2), yaw: Math.PI - b.angle * Math.PI / 180, hp: d.hp, maxHp: d.hp, ammo: {} };
    this.vehicles.push(veh); this.resupplyVehicle(veh);
    this.emit('vehicle', veh);
    return { ok: true, veh };
  }
  // боезапас машины пополняется со склада базы (только на своей территории)
  resupplyVehicle(veh) {
    if (veh.sector !== 'friendly_home') return 0;
    let n = 0;
    for (const g of VEH[veh.id].guns || []) { const have = veh.ammo[g.ammo] || 0, take = Math.min(g.load - have, this.storage[g.ammo] || 0); if (take > 0) { this.storage[g.ammo] -= take; veh.ammo[g.ammo] = have + take; n += take; } }
    return n;
  }
  vehicleDestroyed(veh) {
    this.vehicles = this.vehicles.filter((v) => v !== veh);
    if (this.driving === veh.uid) { this.driving = 0; this.playerHp = Math.max(1, this.playerHp - 25); }
    this.emit('veh_destroyed', veh);
  }
  buildingDestroyed(b) {
    this.buildings = this.buildings.filter((x) => x !== b); delete this.jobs[b.uid];
    this.emit('destroyed', b);
  }
  // ---------------------------------------------------------------- сохранение
  serialize() {
    return JSON.parse(JSON.stringify({
      save_version: SAVE_VERSION, campaign_seconds: this.campaign_seconds, sector_index: this.sector_index, player: this.player, inventory: this.inventory,
      scrap: this.scrap, nodes: this.nodes, buildings: this.buildings, jobs: this.jobs, storage: this.storage, recruits: cloneUnits(this.recruits), uid: this.uid,
      foes: cloneUnits(this.foes), vehicles: this.vehicles, army: this.army, player_hp: this.playerHp,
      totals: this.totals, enemy_state: this.enemy.serialize(), saved_at: new Date().toISOString(),
    }));
  }
  load(d) {
    if (!d || (d.save_version !== SAVE_VERSION && d.save_version !== 3)) return false;
    this.reset();
    this.campaign_seconds = Math.max(0, +d.campaign_seconds || 0);
    this.sector_index = [0, 1].includes(d.sector_index) ? d.sector_index : 0;
    if (this.sector_index === 1 && !this.prepDone()) this.sector_index = 0;
    this.player = { ...this.player, ...d.player };
    if (d.inventory && Array.isArray(d.inventory.slots) && d.inventory.slots.length === 10) this.inventory = d.inventory;
    this.scrap = Math.max(0, Math.min(999, d.scrap | 0));
    if (Array.isArray(d.nodes) && d.nodes.length === 12) this.nodes = d.nodes;
    this.buildings = d.buildings || []; this.jobs = d.jobs || {}; this.storage = d.storage || {}; this.uid = d.uid || 1;
    this.totals = { ...this.totals, ...(d.totals || {}) };
    this.enemy.loadState(d.enemy_state);
    if (d.save_version === 3) { // перенос сохранения версии 3: люди появляются у казармы
      const bar = this.buildings.find((b) => b.id === 'military_barracks');
      for (const r of d.recruits || []) if (bar) { const u = this.armySim.spawnRecruit(bar, r.role, r.hiredAt); u.uid = r.uid; }
    } else {
      this.recruits = (d.recruits || []).map((u) => ({ node: -1, carry: 0, nades: 0, mag: 0, ammo: 0, ...u }));
      this.foes = d.foes || []; this.vehicles = d.vehicles || []; this.army = { ...Army.initialState(), ...(d.army || {}) };
      this.playerHp = Math.max(1, +(d.player_hp ?? 100));
    }
    return true;
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); return true; } catch (e) { return false; } }
  static readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* нет доступа */ } }
}
