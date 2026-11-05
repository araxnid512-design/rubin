// Люди на картах — единая модель для обеих сторон (этапы 6, 7, 7а).
// Наши: рабочий добывает те же конечные кучи и носит до 60, механик чинит 10 HP за 5 с и 2 металла, солдат берёт
// только изготовленное оружие и патроны со склада. Враг: волны из реально нанятых солдат с зарезервированным оружием
// со склада противника; входят на поле боя с севера, отступают и возвращают остатки, погибших нанимают заново.
// Логика не зависит от рендера: когда сектор загружен — пути по навигационной сетке и проверка видимости,
// когда выгружен — честная дискретная симуляция по прямой (без «бесплатных» ресурсов и двойного сбора).
export const SECT = ['friendly_home', 'battlefield', 'enemy_home'];
export const SIDX = { friendly_home: 0, battlefield: 1, enemy_home: 2 };
// Боевые параметры классов оружия (в JSON их нет: «боевые механики будут разработаны позднее»)
export const WSTAT = {
  pistol: { dmg: 16, range: 24, rate: 0.45, burst: 2, acc: 0.55, reload: 1.6, sound: 'shot_pistol' },
  rifle: { dmg: 46, range: 50, rate: 1.6, burst: 1, acc: 0.78, reload: 3.0, sound: 'shot_sniper' },
  smg: { dmg: 12, range: 24, rate: 0.09, burst: 5, acc: 0.42, reload: 2.2, sound: 'shot_smg' },
  assault_rifle: { dmg: 20, range: 36, rate: 0.12, burst: 3, acc: 0.52, reload: 2.4, sound: 'shot_rifle' },
  machine_gun: { dmg: 22, range: 42, rate: 0.1, burst: 7, acc: 0.4, reload: 5.0, sound: 'shot_mg' },
  grenade_launcher: { dmg: 75, splash: 4.5, range: 40, rate: 2.6, burst: 1, acc: 0.65, reload: 2.4, sound: 'shot_launcher' },
  vehicle_mg: { dmg: 22, range: 46, rate: 0.1, burst: 8, acc: 0.45, reload: 0, sound: 'shot_mg' },
  tank_gun: { dmg: 130, splash: 3.2, range: 58, rate: 2.8, burst: 1, acc: 0.7, reload: 0, sound: 'shot_launcher' },
};
export const KIT_ORDER = ['machine_gun', 'assault_rifle', 'rifle', 'smg', 'grenade_launcher', 'pistol'];
// модель оружия в руках (набор моделей движка)
export const VISUAL_WEAPON = { wp_pistol_p9: 'pm', wp_rifle_v7: 'mosin', wp_smg_pp9: 'bizon', wp_assault_a39: 'an94', wp_assault_a47: 'akm', wp_assault_a56: 'ak74', wp_lmg_r7: 'pkm', wp_launcher_g40: 'rg6' };
export const ORDER_NAMES = {
  follow: 'Следовать за мной', hold_position: 'Стоять здесь', move: 'Идти в точку', mine_scrap: 'Добывать металлолом', haul_scrap: 'Отнести металл на склад',
  repair: 'Ремонтировать', patrol: 'Патрулировать', defend: 'Держать оборону', attack_target: 'Атаковать', garrison_bunker: 'Занять бункер',
};
const SPEED = { npc_scrap_worker: 3.0, npc_mechanic: 3.0, npc_infantry: 3.4 };
const GRENADE = { dmg: 80, splash: 5, range: 18 };
const STEP = 0.25;

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export class Army {
  constructor(c) { this.c = c; this.w = null; this.events = []; this.pathBudget = 2; this._scanT = 0; }
  get st() { return this.c.army; }
  static initialState() { return { seed: 20250911, waveT: 5, frontZ: -40, quietT: 0, deployed: [], foeHp: {}, losses: { friendly: 0, enemy: 0 }, kills: { friendly: 0, enemy: 0 }, shots: { friendly: 0, enemy: 0 }, hits: { friendly: 0, enemy: 0 }, waves: 0 }; }
  rand() { const s = this.st; let t = (s.seed = (s.seed + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  emit(e) { if (this.events.length < 400) this.events.push(e); }
  // ------------------------------------------------------------------ данные
  wdef(id) { return this.c.items.weapons.find((w) => w.id === id); }
  ammoIds(w) { return w.ammo_id ? [w.ammo_id] : (w.compatible_ammo_ids || []).filter((a) => !a.includes('smoke')); }
  role(id) { return this.c.npcs.roles.find((r) => r.id === id); }
  roadEdgeX(sector, north) { const r = this.c.sectorDef(SIDX[sector]).road_centerline_xz; const p = north ? r[r.length - 1] : r[0]; return p[0]; }
  alive(u) { return u && u.hp > 0; }
  // ------------------------------------------------------------------ найм: новый человек у двери казармы
  spawnRecruit(rec, roleId, hiredAt) {
    const c = this.c, door = c.doorPoint(rec, 2.5 + (c.recruits.length % 4) * 0.6);
    const role = this.role(roleId) || { max_health: 100 };
    const u = {
      uid: c.uid++, side: 'friendly', role: roleId, hiredAt, order: 'hold_position', op: { sector: 'friendly_home', x: door[0], z: door[1] },
      sector: 'friendly_home', x: door[0] + ((c.recruits.length % 4) - 1.5) * 1.1, z: door[1], yaw: 0, hp: role.max_health || 100, maxHp: role.max_health || 100,
      carry: 0, weapon: null, ammoId: null, mag: 0, ammo: 0, nades: 0, st: 'idle', note: 'ожидает приказа', t: 0, node: -1, inBunker: 0,
    };
    c.recruits.push(u);
    return u;
  }
  // ------------------------------------------------------------------ приказы из штаба
  canOrder(u, order) { const r = this.role(u.role); return !!r && r.allowed_orders.includes(order); }
  setOrder(uid, order, op = {}) {
    const c = this.c, u = c.recruits.find((x) => x.uid === uid); if (!u || !this.alive(u)) return { ok: false, reason: 'Нет такого человека.' };
    if (!this.canOrder(u, order)) return { ok: false, reason: `${this.role(u.role).name_ru} не выполняет приказ «${ORDER_NAMES[order] || order}».` };
    if (order === 'hold_position' && op.x == null) op = { ...op, sector: u.sector, x: u.x, z: u.z };
    const sector = op.sector || { attack_target: 'battlefield', mine_scrap: 'friendly_home' }[order] || u.sector;
    if (sector === 'enemy_home') return { ok: false, reason: 'НЕТ ДОСТУПА: ЧУЖАЯ БАЗА.' };
    if (sector === 'battlefield' && !c.prepDone()) return { ok: false, reason: 'Поле боя закрыто до конца подготовки.' };
    if (order === 'mine_scrap' && !c.nodes.length) return { ok: false, reason: 'Нет металлолома.' };
    if (order === 'garrison_bunker') {
      const b = op.uid ? c.buildings.find((x) => x.uid === op.uid && x.id === 'military_bunker') : this.nearestBunker(u);
      if (!b) return { ok: false, reason: 'Нет построенного бункера.' };
      if (b.sector === 'battlefield' && !c.prepDone()) return { ok: false, reason: 'Бункер на поле боя недоступен до конца подготовки.' };
      op = { uid: b.uid, sector: b.sector };
    }
    this.releaseNode(u);
    u.order = order; u.op = { sector, x: op.x ?? u.x, z: op.z ?? u.z, uid: op.uid || 0, x2: op.x2, z2: op.z2 };
    if (order === 'patrol' && u.op.x2 == null) { u.op.x2 = u.op.x + 16; u.op.z2 = u.op.z; }
    u._path = null; u.t = 0; u.inBunker = 0; u.note = ''; u._leg = 0; u._stuck = 0;
    c.emit('orders', u.uid);
    return { ok: true };
  }
  nearestBunker(u) {
    let best = null, bd = Infinity;
    for (const b of this.c.buildings) if (b.id === 'military_bunker' && (b.sector === 'friendly_home' || this.c.prepDone())) { const d = (b.sector === u.sector ? 0 : 400) + dist(b.x, b.z, u.x, u.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  // ------------------------------------------------------------------ шаг симуляции
  tick(sec) {
    let left = sec;
    while (left > 1e-6) { const dt = Math.min(STEP, left); left -= dt; this._step(dt); }
  }
  _step(dt) {
    const c = this.c;
    this.pathBudget = Math.min(3, this.pathBudget + dt * 8);
    this._scanT -= dt;
    for (const u of c.recruits) if (this.alive(u)) this._friendly(u, dt);
    for (const u of c.foes) if (this.alive(u)) this._foe(u, dt);
    this._waves(dt);
    this.advanceFront(dt);
    // погибшие убираются из списков (их не воскрешают без нового найма)
    if (c.recruits.some((u) => u.hp <= 0)) c.recruits = c.recruits.filter((u) => u.hp > 0);
    if (c.foes.some((u) => u.hp <= 0)) c.foes = c.foes.filter((u) => u.hp > 0);
    // отдых на своей базе
    for (const u of c.recruits) if (u.sector === 'friendly_home' && u.hp < u.maxHp && !u.tgt) u.hp = Math.min(u.maxHp, u.hp + dt);
    if (c.playerHp < 100 && (this._playerCalm = (this._playerCalm || 0) + dt) > 6) c.playerHp = Math.min(100, c.playerHp + dt * 2);
  }
  // ------------------------------------------------------------------ наши
  _friendly(u, dt) {
    if (u.role === 'npc_infantry') return this._soldier(u, dt);
    if (u.role === 'npc_scrap_worker' && u.order === 'mine_scrap') return this._mine(u, dt);
    if (u.role === 'npc_mechanic' && u.order === 'repair') return this._repair(u, dt);
    if (u.order === 'haul_scrap') { if (u.carry > 0) return this._deliver(u, dt); u.st = 'idle'; u.note = 'металл сдан'; return; }
    if (u.carry > 0 && u.order !== 'follow' && u.order !== 'move') { this._deliver(u, dt); return; }
    this._common(u, dt);
  }
  // следовать / стоять / идти в точку — для всех ролей
  _common(u, dt, tgt = null) {
    const c = this.c;
    if (u.order === 'follow') {
      const ps = SECT[c.sector_index], P = this.playerPos();
      if (ps !== u.sector) { if (!this._goSector(u, ps, dt)) { u.st = 'idle'; } return; }
      const d = dist(u.x, u.z, P.x, P.z);
      if (tgt && d < 9) { u.moving = false; return; }
      if (d > 3.5) { u.st = 'move'; u.note = 'следует'; this._moveTo(u, P.x + Math.sin(u.uid) * 1.6, P.z + Math.cos(u.uid) * 1.6, dt, d > 10 ? 4.8 : SPEED[u.role]); } else { u.st = 'idle'; u.moving = false; }
      return;
    }
    const op = u.op || {};
    if (op.sector && op.sector !== u.sector) { this._goSector(u, op.sector, dt); return; }
    if (tgt && u.order !== 'move') { u.moving = false; return; }
    if (this._moveTo(u, op.x, op.z, dt)) { u.st = tgt ? 'fight' : 'idle'; u.note = u.order === 'move' ? 'на месте' : u.note || 'ожидает приказа'; }
    else { u.st = 'move'; u.note = 'идёт'; }
  }
  // ------------------------------------------------------------------ рабочий: куча → 4 с → +5 в руки (до 60) → склад
  _mine(u, dt) {
    const c = this.c, cap = this.role(u.role).mining.inventory_capacity;
    if (u.sector !== 'friendly_home') { this._goSector(u, 'friendly_home', dt); return; }
    const per = this.role(u.role).mining.scrap_gained_per_action;
    if (u.carry + per > cap) { this.releaseNode(u); this._deliver(u, dt); return; }
    if (u.node < 0 || c.nodeState(u.node) !== 'available') {
      this.releaseNode(u);
      const i = this.pickNode(u);
      if (i < 0) { if (u.carry > 0) { this._deliver(u, dt); return; } u.st = 'idle'; u.note = 'все кучи разобраны — ждёт'; return; }
      u.node = i; u.t = 0;
    }
    const [nx, nz] = c.nodeXZ(0, u.node), a = Math.atan2(u.x - nx, u.z - nz) || 0, sx = nx + Math.sin(a) * 1.7, sz = nz + Math.cos(a) * 1.7;
    if (dist(u.x, u.z, nx, nz) > 2.1 && !this._moveTo(u, sx, sz, dt)) { u.st = 'move'; u.note = 'идёт к куче'; u.t = 0; return; }
    u.moving = false; u.st = 'work'; u.note = `добывает (${u.carry}/${cap})`; this.face(u, nx, nz);
    u.t += dt;
    if (u.t >= this.role(u.role).mining.action_seconds - 1e-6) {
      u.t -= this.role(u.role).mining.action_seconds;
      const g = c.npcMine(u.node, per);
      if (g > 0) { u.carry += g; this.emit({ type: 'mine', uid: u.uid, sector: 0, x: nx, z: nz, g }); }
      if (c.nodeState(u.node) !== 'available') this.releaseNode(u);
    }
  }
  pickNode(u) {
    const c = this.c, taken = new Set(c.recruits.filter((r) => r !== u && r.node >= 0).map((r) => r.node));
    let best = -1, bd = Infinity;
    for (let i = 0; i < c.nodes.length; i++) {
      if (taken.has(i) || c.nodeState(i) !== 'available') continue;
      const [x, z] = c.nodeXZ(0, i), d = dist(x, z, u.x, u.z); if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  releaseNode(u) { u.node = -1; }
  dropPoint(u) {
    let best = null, bd = Infinity;
    for (const b of this.c.buildings) if (b.sector === 'friendly_home' && b.id !== 'military_bunker') { const p = this.c.doorPoint(b, 2), d = dist(p[0], p[1], u.x, u.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  _deliver(u, dt) {
    const c = this.c;
    if (u.sector !== 'friendly_home') { this._goSector(u, 'friendly_home', dt); return; }
    const p = this.dropPoint(u); if (!p) { u.st = 'idle'; u.note = 'нет здания-склада'; return; }
    if (!this._moveTo(u, p[0], p[1], dt)) { u.st = 'move'; u.note = `несёт ${u.carry} на склад`; return; }
    const room = (c.items.resource.maximum_stack || 999) - c.scrap, d = Math.min(room, u.carry);
    if (d <= 0) { u.st = 'idle'; u.note = 'склад полон (999)'; return; }
    c.scrap += d; c.totals.harvested += d; c.totals.npcDelivered += d; u.carry -= d;
    c.emit('scrap', c.scrap); this.emit({ type: 'deliver', uid: u.uid, sector: 0, x: u.x, z: u.z, g: d });
  }
  // ------------------------------------------------------------------ механик: 10 HP за 5 с, 2 металла со склада
  repairTargets(sectorFilter = null) {
    const c = this.c, out = [];
    for (const b of c.buildings) if (b.hp < 100 && (!sectorFilter || b.sector === sectorFilter)) out.push({ kind: 'building', o: b, sector: b.sector, x: b.x, z: b.z, max: 100 });
    for (const v of c.vehicles) if (v.hp < v.maxHp && v.hp > 0 && (!sectorFilter || v.sector === sectorFilter)) out.push({ kind: 'vehicle', o: v, sector: v.sector, x: v.x, z: v.z, max: v.maxHp });
    return out.filter((t) => t.sector === 'friendly_home' || (t.sector === 'battlefield' && c.prepDone()));
  }
  _repair(u, dt) {
    const c = this.c, R = this.role(u.role).repair;
    let t = null;
    if (u.op.uid) t = this.repairTargets().find((x) => x.o.uid === u.op.uid) || null;
    if (!t) { let bd = Infinity; for (const x of this.repairTargets()) { const d = (x.sector === u.sector ? 0 : 300) + dist(x.x, x.z, u.x, u.z) + (x.o.hp / x.max) * 30; if (d < bd) { bd = d; t = x; } } }
    if (!t) { u.st = 'idle'; u.note = 'нечего ремонтировать'; u.moving = false; return; }
    if (t.sector !== u.sector) { this._goSector(u, t.sector, dt); return; }
    if (u._rt !== t.o.uid) { u._rt = t.o.uid; u.t = 0; } // прогресс ремонта сбрасывается только при смене объекта
    const p = t.kind === 'building' ? c.doorPoint(t.o, 1.6) : [t.x + 2.4, t.z];
    const near = t.kind === 'building' ? c.distToFootprint(t.o, u.x, u.z) < 3.2 : dist(u.x, u.z, t.x, t.z) < 3.6;
    if (!near && !this._moveTo(u, p[0], p[1], dt)) { u.st = 'move'; u.note = 'идёт чинить'; return; }
    u.moving = false; this.face(u, t.x, t.z);
    if (c.scrap < R.scrap_cost_per_action) { u.st = 'idle'; u.note = 'нет металла для ремонта'; u.t = 0; return; }
    u.st = 'work'; u.note = `ремонт ${Math.round(t.o.hp)}/${t.max}`; u.t += dt;
    if (u.t >= R.action_seconds - 1e-6) {
      u.t -= R.action_seconds;
      if (t.o.hp >= t.max || c.scrap < R.scrap_cost_per_action) return;
      c.scrap -= R.scrap_cost_per_action; c.totals.spent += R.scrap_cost_per_action; c.totals.repairSpent += R.scrap_cost_per_action;
      t.o.hp = Math.min(t.max, t.o.hp + R.health_restored_per_action);
      c.emit('scrap', c.scrap); this.emit({ type: 'repair', uid: u.uid, sector: SIDX[t.sector], x: t.x, z: t.z });
    }
  }
  // ------------------------------------------------------------------ солдат: снаряжение со склада, приказы, бой
  equip(u) {
    const c = this.c, S = c.storage;
    if (u.sector !== 'friendly_home') return false;
    let changed = false;
    if (!u.weapon) {
      outer: for (const cls of KIT_ORDER) for (const w of c.items.weapons) {
        if (w.class !== cls || !(S[w.id] > 0)) continue;
        const am = this.ammoIds(w).find((a) => S[a] > 0); if (!am) continue;
        S[w.id]--; const n = Math.min(S[am], w.magazine * 4); S[am] -= n;
        u.weapon = w.id; u.ammoId = am; u.mag = Math.min(n, w.magazine); u.ammo = n - u.mag; changed = true;
        c.emit('equip', u.uid); break outer;
      }
    } else {
      const w = this.wdef(u.weapon), need = w.magazine * 4 - u.mag - u.ammo;
      if (need > 0 && (S[u.ammoId] || 0) > 0 && u.mag + u.ammo < w.magazine * 2) { const n = Math.min(need, S[u.ammoId]); S[u.ammoId] -= n; u.ammo += n; changed = true; c.emit('equip', u.uid); }
    }
    if (u.nades < 2 && (S.wp_hand_grenade || 0) > 0) { const n = Math.min(2 - u.nades, S.wp_hand_grenade); S.wp_hand_grenade -= n; u.nades += n; changed = true; }
    return changed;
  }
  _soldier(u, dt) {
    if (u.sector === 'friendly_home' && ((u._eqT = (u._eqT || 0) - dt) <= 0)) { u._eqT = 2; this.equip(u); }
    const tgt = this._combat(u, dt);
    const c = this.c, op = u.op || {};
    switch (u.order) {
      case 'patrol': {
        if (op.sector !== u.sector) { this._goSector(u, op.sector, dt); return; }
        if (tgt) { u.moving = false; u.st = 'fight'; return; }
        const [tx, tz] = u._leg ? [op.x2, op.z2] : [op.x, op.z];
        if (this._moveTo(u, tx, tz, dt, 2.6)) u._leg = u._leg ? 0 : 1;
        u.st = 'move'; u.note = 'патрулирует'; return;
      }
      case 'defend': {
        if (op.sector !== u.sector) { this._goSector(u, op.sector, dt); return; }
        if (tgt) { const d = dist(u.x, u.z, tgt.x, tgt.z), ws = WSTAT[this.wdef(u.weapon).class]; if (d > ws.range * 0.85 && dist(tgt.x, tgt.z, op.x, op.z) < 22) this._moveTo(u, tgt.x, tgt.z, dt); else u.moving = false; u.st = 'fight'; u.note = 'держит оборону'; return; }
        if (this._moveTo(u, op.x, op.z, dt)) { u.st = 'idle'; u.note = 'держит оборону'; } else u.st = 'move';
        return;
      }
      case 'attack_target': {
        if (u.sector !== 'battlefield') { if (!c.prepDone()) { u.note = 'поле боя закрыто'; u.st = 'idle'; return; } this._goSector(u, 'battlefield', dt); return; }
        if (!u.weapon) { u.note = 'нет оружия — ждёт'; }
        const foe = this.nearestHostile(u, 1e9);
        if (foe) {
          const d = dist(u.x, u.z, foe.x, foe.z), rng = u.weapon ? WSTAT[this.wdef(u.weapon).class].range * 0.8 : 6;
          if (!tgt || d > rng) { this._moveTo(u, foe.x, foe.z, dt); u.st = 'move'; u.note = 'атакует'; } else { u.moving = false; u.st = 'fight'; }
        } else { if (this._moveTo(u, op.x ?? 0, op.z ?? -40, dt)) { u.st = 'idle'; u.note = 'противника не видно'; } else { u.st = 'move'; u.note = 'наступает'; } }
        return;
      }
      case 'garrison_bunker': {
        const b = c.buildings.find((x) => x.uid === op.uid);
        if (!b) { u.inBunker = 0; u.order = 'hold_position'; u.op = { sector: u.sector, x: u.x, z: u.z }; u.note = 'бункер разрушен'; return; }
        if (b.sector !== u.sector) { this._goSector(u, b.sector, dt); return; }
        const slot = this.bunkerSlot(b, u), inside = c.insideFootprint(b, u.x, u.z, 0.9);
        if (!inside) { u.inBunker = 0; this._moveTo(u, slot[0], slot[1], dt); u.st = 'move'; u.note = 'идёт в бункер'; return; }
        u.inBunker = b.uid;
        if (!tgt) { if (this._moveTo(u, slot[0], slot[1], dt, 2)) { u.st = 'idle'; u.note = 'в бункере'; } } else { u.moving = false; u.st = 'fight'; u.note = 'ведёт огонь из бункера'; }
        return;
      }
      default: this._common(u, dt, tgt);
    }
  }
  bunkerSlot(b, u) {
    const c = this.c, garrison = c.recruits.filter((r) => r.order === 'garrison_bunker' && r.op && r.op.uid === b.uid), k = Math.max(0, garrison.indexOf(u));
    const slots = [[-3, -3.4], [2.2, -3.4], [-3.5, 1.6], [-1.2, 2.2], [1.4, 2.2], [3.4, 2.4], [-4.6, -0.8], [3.6, -1.2]];
    const [lx, lz] = slots[k % slots.length];
    return c.fromLocal(b, lx, lz);
  }
  // ------------------------------------------------------------------ бой
  hostilesOf(u) {
    const c = this.c, out = [];
    if (u.side === 'friendly') { for (const f of c.foes) if (f.hp > 0 && f.sector === u.sector) out.push(f); }
    else {
      for (const r of c.recruits) if (r.hp > 0 && r.sector === u.sector) out.push(r);
      const P = this.playerUnit(); if (P && P.sector === u.sector) out.push(P);
    }
    return out;
  }
  playerPos() { const p = this.c.player; return { x: p.x, z: p.z }; }
  playerUnit() {
    const c = this.c; if (c.playerHp <= 0 || c.recon) return null;
    if (!this._pu) this._pu = { uid: 'player', side: 'friendly', isPlayer: true, maxHp: 100, moving: false, get x() { return c.player.x; }, get z() { return c.player.z; }, get sector() { return SECT[c.sector_index]; }, get hp() { return c.playerHp; }, set hp(v) { c.playerHp = v; }, get inBunker() { return c.playerInBunker || 0; } };
    return this._pu;
  }
  nearestHostile(u, range) {
    let best = null, bd = range;
    for (const h of this.hostilesOf(u)) { const d = dist(u.x, u.z, h.x, h.z); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  visible(a, b) {
    const w = this.w; if (!w || w.index !== SIDX[a.sector]) return true;
    if (a.inBunker || b.inBunker) return true; // бойницы
    return w.lineClear(a.x, a.z, b.x, b.z);
  }
  _combat(u, dt) {
    u.fireT = Math.max(0, (u.fireT || 0) - dt);
    if (!u.weapon) { u.tgt = null; return null; }
    const w = this.wdef(u.weapon), ws = WSTAT[w.class];
    if (u.reloadT > 0) { u.reloadT -= dt; if (u.reloadT <= 0) { const n = Math.min(w.magazine - u.mag, u.ammo); u.mag += n; u.ammo -= n; } }
    // поиск цели не каждый шаг
    u._scan = (u._scan || 0) - dt;
    let tgt = u._tg && u._tg.hp > 0 && u._tg.sector === u.sector && dist(u.x, u.z, u._tg.x, u._tg.z) <= ws.range ? u._tg : null;
    if (!tgt && u._scan <= 0) {
      u._scan = 0.5 + this.rand() * 0.3;
      let bd = ws.range;
      for (const h of this.hostilesOf(u)) { const d = dist(u.x, u.z, h.x, h.z); if (d < bd && this.visible(u, h)) { bd = d; tgt = h; } }
    }
    if (tgt && tgt !== u._tg) u.fireT = Math.max(u.fireT, 0.5 + this.rand() * 0.7); // реакция на новую цель
    u._tg = tgt; u.tgt = tgt ? tgt.uid : null;
    if (!tgt) { u.burst = 0; return null; }
    this.face(u, tgt.x, tgt.z);
    if (u.reloadT > 0) return tgt;
    if (u.mag <= 0) { if (u.ammo > 0) { u.reloadT = ws.reload; this.emit({ type: 'reload', uid: u.uid, sector: SIDX[u.sector] }); } return tgt; }
    const d = dist(u.x, u.z, tgt.x, tgt.z);
    // граната — по цели в укрытии или группе
    if (u.nades > 0 && d > 7 && d < GRENADE.range && u.fireT <= 0 && this.rand() < 0.08) { u.nades--; u.fireT = 1.4; this.blast(u, tgt.x + (this.rand() - 0.5) * 3, tgt.z + (this.rand() - 0.5) * 3, GRENADE.dmg, GRENADE.splash, 'grenade'); return tgt; }
    if (u.fireT > 0) return tgt;
    u.mag--; u.burst = (u.burst || 0) + 1;
    u.fireT = u.burst >= ws.burst ? (u.burst = 0, ws.rate + 0.5 + this.rand() * 0.6) : ws.rate;
    this.shoot(u, tgt, ws);
    return tgt;
  }
  hitChance(shooter, tgt, ws) {
    const d = dist(shooter.x, shooter.z, tgt.x, tgt.z);
    let p = ws.acc * (1 - 0.55 * Math.min(1, d / ws.range));
    if (tgt.inBunker) p *= 0.35;
    if (shooter.moving) p *= 0.7;
    if (tgt.moving) p *= 0.8;
    if (tgt.isVehicle) p = Math.min(0.95, p * 1.8);
    return p;
  }
  // один выстрел: попадание по шансу, урон, событие для отрисовки
  shoot(shooter, tgt, ws) {
    const hit = this.rand() < this.hitChance(shooter, tgt, ws), st = this.st, side = shooter.side === 'enemy' ? 'enemy' : 'friendly';
    st.shots = st.shots || { friendly: 0, enemy: 0 }; st.hits = st.hits || { friendly: 0, enemy: 0 };
    st.shots[side]++; if (hit) st.hits[side]++;
    const sx = shooter.x, sz = shooter.z;
    if (ws.splash) {
      const miss = hit ? 0 : 2 + this.rand() * 4, a = this.rand() * 6.283;
      this.emit({ type: 'shot', sector: SIDX[shooter.sector], uid: shooter.uid, sound: ws.sound, x: sx, z: sz, tx: tgt.x, tz: tgt.z, hit: false, launcher: true });
      this.blast(shooter, tgt.x + Math.cos(a) * miss, tgt.z + Math.sin(a) * miss, ws.dmg, ws.splash, 'shell');
      return hit;
    }
    this.emit({ type: 'shot', sector: SIDX[shooter.sector], uid: shooter.uid, sound: ws.sound, x: sx, z: sz, tx: tgt.x + (hit ? 0 : (this.rand() - 0.5) * 3), tz: tgt.z + (hit ? 0 : (this.rand() - 0.5) * 3), hit });
    if (hit) this.damage(tgt, ws.dmg * (0.8 + this.rand() * 0.4), shooter);
    return hit;
  }
  blast(src, x, z, dmg, radius, kind) {
    const sector = src.sector;
    this.emit({ type: 'explosion', sector: SIDX[sector], x, z, kind });
    const victims = [...this.c.recruits, ...this.c.foes]; const P = this.playerUnit(); if (P) victims.push(P);
    for (const v of victims) {
      if (v.hp <= 0 || v.sector !== sector) continue;
      const d = dist(v.x, v.z, x, z); if (d > radius) continue;
      this.damage(v, dmg * (1 - d / radius) * (v.inBunker ? 0.3 : 1), src);
    }
    for (const v of this.c.vehicles) if (v.sector === sector && v.hp > 0) { const d = dist(v.x, v.z, x, z); if (d < radius + 2) this.damageVehicle(v, dmg * 0.6 * (1 - d / (radius + 2)), src); }
    for (const b of this.c.buildings) if (b.sector === sector && this.c.distToFootprint(b, x, z) < radius * 0.6) this.damageBuilding(b, 12, src);
  }
  damage(v, amount, src) {
    if (v.hp <= 0) return;
    if (v.isPlayer && this.c.driving) { const veh = this.c.vehicles.find((x) => x.uid === this.c.driving); if (veh) { this.damageVehicle(veh, amount, src); return; } }
    if (v.isPlayer) { amount *= 0.5; this._playerCalm = 0; } // бронежилет генерала
    v.hp = Math.max(0, v.hp - amount);
    this.emit({ type: 'hit', sector: SIDX[v.sector], uid: v.uid, x: v.x, z: v.z, player: !!v.isPlayer });
    if (v.side === 'enemy' && !v.retreat && v.hp < 30) v.retreat = true;
    if (v.hp > 0) return;
    if (v.isPlayer) { this.emit({ type: 'player_down' }); return; }
    const st = this.st;
    if (v.side === 'friendly') { st.losses.friendly++; if (src && src.side === 'enemy') st.kills.enemy++; this.releaseNode(v); this.c.emit('npc_dead', v); }
    else { st.losses.enemy++; if (src && src.side === 'friendly') st.kills.friendly++; this._enemyDied(v); }
    this.emit({ type: 'death', sector: SIDX[v.sector], uid: v.uid, side: v.side, x: v.x, z: v.z });
  }
  damageVehicle(veh, amount, src) {
    const arm = { armored_car: 0.3, light_tank: 0.12, apc: 0.25 }[this.c.vehDef(veh.id).class] ?? 1;
    veh.hp = Math.max(0, veh.hp - amount * arm);
    this.emit({ type: 'hit', sector: SIDX[veh.sector], uid: veh.uid, x: veh.x, z: veh.z, vehicle: true, player: this.c.driving === veh.uid });
    if (veh.hp <= 0) { this.c.vehicleDestroyed(veh); this.emit({ type: 'explosion', sector: SIDX[veh.sector], x: veh.x, z: veh.z, kind: 'vehicle' }); }
  }
  damageBuilding(b, amount) {
    b.hp = Math.max(0, b.hp - amount);
    if (b.hp <= 0) { this.c.buildingDestroyed(b); this.emit({ type: 'explosion', sector: SIDX[b.sector], x: b.x, z: b.z, kind: 'building' }); }
  }
  // ------------------------------------------------------------------ враг на поле боя
  // комплект: оружие + совместимые патроны со склада противника (резервируются, иначе выдача удвоится)
  enemyKit() {
    const M = this.c.enemy.manufactured;
    for (const cls of KIT_ORDER) for (const w of this.c.items.weapons) {
      if (w.class !== cls || !(M[w.id] > 0)) continue;
      const am = this.ammoIds(w).find((a) => (M[a] || 0) >= Math.min(5, w.magazine)); if (am) return { w, am };
    }
    return null;
  }
  _waves(dt) {
    const c = this.c, st = this.st, E = c.enemy;
    if (!c.prepDone() || !E.canDeployToBattlefield(c.campaign_seconds)) return;
    // лечение отступивших дома
    for (const k in st.foeHp) st.foeHp[k] = Math.min(100, st.foeHp[k] + dt);
    st.waveT -= dt; if (st.waveT > 0) return;
    st.waveT = 20;
    const cfg = E.config.battlefield_deployment || {}, maxWave = cfg.max_soldiers_per_wave || 6;
    const onField = c.foes.length; if (onField >= maxWave) return;
    const deployed = new Set(st.deployed), ready = E.recruits.filter((r) => r.role_id === 'npc_infantry' && !deployed.has(r.id) && (st.foeHp[r.id] ?? 100) >= 70);
    const kits = [];
    for (const r of ready) { if (kits.length >= maxWave - onField) break; const k = this.enemyKit(); if (!k) break; this._reserve(k); kits.push([r, k]); }
    const totalInf = E.recruits.filter((r) => r.role_id === 'npc_infantry').length;
    if (kits.length < Math.min(2, totalInf - onField)) { for (const [, k] of kits) this._unreserve(k, k.n); return; } // неполную волну не отправляем
    if (!kits.length) return;
    st.waves++; st.quietT = 0;
    kits.forEach(([r, k], i) => {
      const x = this.roadEdgeX('battlefield', true) + (i - kits.length / 2) * 3;
      const u = { uid: 'e' + r.id, rid: r.id, side: 'enemy', role: 'npc_infantry', sector: 'battlefield', x, z: -141 - (i % 2), yaw: Math.PI, hp: st.foeHp[r.id] ?? 100, maxHp: 100,
        weapon: k.w.id, ammoId: k.am, mag: Math.min(k.n, k.w.magazine), ammo: k.n - Math.min(k.n, k.w.magazine), nades: 0, st: 'move', retreat: false, slot: c.foes.length };
      c.foes.push(u); st.deployed.push(r.id);
    });
    this.emit({ type: 'wave', n: kits.length });
    c.emit('wave', kits.length);
  }
  _reserve(k) { const M = this.c.enemy.manufactured; M[k.w.id]--; k.n = Math.min(M[k.am], k.w.magazine * 4); M[k.am] -= k.n; }
  _unreserve(k, n) { const M = this.c.enemy.manufactured; M[k.w.id] = (M[k.w.id] || 0) + 1; M[k.am] = (M[k.am] || 0) + n; }
  _foe(u, dt) {
    const st = this.st;
    const tgt = this._combat(u, dt);
    if (tgt) st.quietT = 0;
    if (u.retreat || (u.mag + u.ammo <= 0 && !u.reloadT)) {
      u.retreat = true; u.st = 'retreat';
      if (this._moveTo(u, u.x, -147.5, dt, 4.2) || u.z <= -146.5) this._returnHome(u);
      return;
    }
    const k = this.c.foes.indexOf(u), rx = -25 + (k % 6) * 10 + Math.sin(u.rid * 7) * 3, rz = st.frontZ - Math.floor(k / 6) * 6;
    if (tgt) { const d = dist(u.x, u.z, tgt.x, tgt.z); if (d > WSTAT[this.wdef(u.weapon).class].range * 0.8) this._moveTo(u, tgt.x, tgt.z, dt, 3); else u.moving = false; u.st = 'fight'; return; }
    if (this._moveTo(u, rx, rz, dt, 3.3)) { u.st = 'idle'; } else u.st = 'move';
  }
  // наступление: если на поле тихо — линия фронта врага сдвигается к югу (не дальше 1/3 карты от нашей границы)
  advanceFront(dt) { const st = this.st; if (!this.c.foes.length) return; st.quietT += dt; if (st.quietT > 75) { st.quietT = 0; st.frontZ = Math.min(60, st.frontZ + 20); } }
  _returnHome(u) {
    const c = this.c, M = c.enemy.manufactured, st = this.st;
    M[u.weapon] = (M[u.weapon] || 0) + 1; M[u.ammoId] = (M[u.ammoId] || 0) + u.mag + u.ammo;
    st.foeHp[u.rid] = u.hp; st.deployed = st.deployed.filter((x) => x !== u.rid);
    c.foes = c.foes.filter((x) => x !== u); u.hp = -1; // снят с поля (жив, дома)
    this.emit({ type: 'retreat', uid: u.uid });
  }
  _enemyDied(u) {
    const c = this.c, E = c.enemy, st = this.st;
    E.recruits = E.recruits.filter((r) => r.id !== u.rid); E.replacements_needed = (E.replacements_needed || 0) + 1;
    st.deployed = st.deployed.filter((x) => x !== u.rid); delete st.foeHp[u.rid];
  }
  // ------------------------------------------------------------------ перемещение
  face(u, x, z) { const dx = x - u.x, dz = z - u.z; if (dx * dx + dz * dz > 0.01) u.yaw = Math.atan2(-dx, -dz); }
  canUnitEnter(u, dest) {
    if (dest === u.sector) return true;
    if (u.side === 'friendly') return dest !== 'enemy_home' && this.c.prepDone();
    return dest !== 'friendly_home';
  }
  // переход между секторами только через общую границу и только разрешённый
  _goSector(u, dest, dt) {
    if (!this.canUnitEnter(u, dest)) { u.st = 'idle'; u.moving = false; u.note = dest === 'enemy_home' || dest === 'friendly_home' && u.side === 'enemy' ? 'НЕТ ДОСТУПА: ЧУЖАЯ БАЗА' : 'поле боя закрыто'; return false; }
    if (dest === 'enemy_home' && u.side === 'friendly') return false;
    const north = SIDX[dest] > SIDX[u.sector], ex = this.roadEdgeX(u.sector, !north) + Math.sin(String(u.uid).length + (+u.uid || 0)) * 2;
    const ez = north ? -147.5 : 147.5;
    u.st = 'move'; u.note = dest === 'battlefield' ? 'идёт на поле боя' : 'возвращается на базу';
    const arrived = this._moveTo(u, ex, ez, dt, SPEED[u.role] * 1.15);
    if (arrived || (north ? u.z <= -146.5 : u.z >= 146.5)) {
      u.sector = dest; u.z = north ? 141 : -141; u.x = this.roadEdgeX(dest, !north) + (u.x - ex);
      u._path = null; u.inBunker = 0; this.emit({ type: 'transfer', uid: u.uid, sector: SIDX[dest] });
      this.c.emit('unit_sector', u);
    }
    return true;
  }
  _moveTo(u, tx, tz, dt, speed = SPEED[u.role] || 3.2) {
    const d = dist(u.x, u.z, tx, tz);
    if (d < 0.7) { u.moving = false; u._path = null; return true; }
    u.moving = true;
    const w = this.w;
    let gx = tx, gz = tz;
    if (w && w.index === SIDX[u.sector]) {
      if (!u._path || !u._pt || dist(u._pt[0], u._pt[1], tx, tz) > 1.5) {
        if (this.pathBudget < 1) return false;
        this.pathBudget--;
        u._pt = [tx, tz]; u._path = w.findPath(u.x, u.z, tx, tz); u._pi = 0; u._unreach = !u._path.reached; u._prog = d; u._stuckT = 0;
      }
      const p = u._path[u._pi];
      if (!p) { if (u._unreach || d < 2.5) { u.moving = false; return true; } u._path = null; return false; }
      gx = p.x; gz = p.z;
      if (dist(u.x, u.z, gx, gz) < 0.35) { u._pi++; return false; }
      // застревание: нет продвижения 3 с — новый путь; после трёх попыток — «не может пройти»
      u._stuckT += dt; if (d < u._prog - 0.5) { u._prog = d; u._stuckT = 0; }
      if (u._stuckT > 3) { u._path = null; u._stuck = (u._stuck || 0) + 1; if (u._stuck > 3) { u._stuck = 0; u.note = 'не может пройти'; u.moving = false; return true; } }
    }
    const dx = gx - u.x, dz = gz - u.z, l = Math.hypot(dx, dz) || 1, s = Math.min(l, speed * dt);
    u.x += dx / l * s; u.z += dz / l * s;
    u.x = Math.max(-149, Math.min(149, u.x)); u.z = Math.max(-149, Math.min(149, u.z));
    if (!u._tg) u.yaw = Math.atan2(-dx, -dz);
    return false;
  }
  // разведение людей, чтобы не стояли друг в друге (только в загруженном секторе)
  separate(units) {
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j]; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.65) { const k = (0.65 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
  }
  // ------------------------------------------------------------------ сводка
  summary() {
    const c = this.c, st = this.st;
    const by = (arr, s) => arr.filter((u) => u.sector === s).length;
    return { friendlyOnField: by(c.recruits, 'battlefield'), enemyOnField: c.foes.length, losses: { ...st.losses }, kills: { ...st.kills }, shots: { ...(st.shots || {}) }, hits: { ...(st.hits || {}) }, waves: st.waves, frontZ: st.frontZ };
  }
}

export function cloneUnits(list) { return list.map((u) => { const o = {}; for (const k in u) if (k[0] !== '_') o[k] = u[k]; return o; }); }
