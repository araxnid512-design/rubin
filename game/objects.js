// Здания базы и интерактивные объекты.
import { V3, M3, Xf, RNG, hashStr } from '../engine/math.js';
import { MeshBuilder } from '../engine/mesh.js';
import { RenderObject } from '../engine/renderer.js';
import * as BG from './building_gen.js';
import * as P from './props.js';
import { Game, events, msg, MSG } from './state.js';
import { itemName, item, CAT, isWeapon, weapon } from './items.js';

const v = (x, y, z) => new V3(x, y, z);
const I = () => new M3();

// ------------------------------------------------------------------ базовый интерактивный объект
export class Interactable {
  constructor(world, pos, prompt = 'Действие') {
    this.world = world; this.p = pos; this.promptText = prompt; this.holdTime = 0; this.radius = 2.2; this.anim = 'use'; this.enabled = true; this.removed = false;
    world.interactables.push(this);
  }
  pos() { return this.p; }
  prompt() { return this.promptText; }
  hold() { return this.holdTime; }
  can() { return this.enabled && !this.removed; }
  interact() {}
  remove() {
    this.removed = true;
    const i = this.world.interactables.indexOf(this); if (i >= 0) this.world.interactables.splice(i, 1);
    if (this.obj) this.world.r.remove(this.obj);
    if (this.cols) for (const c of this.cols) this.world.phys.remove(c);
  }
  meshAt(mb, kind = 'world') {
    if (mb.isEmpty()) return null;
    this.obj = this.world.r.add(new RenderObject(this.world.r.createMesh(mb.data()), kind));
    return this.obj;
  }
  addCols(list, xf) { this.cols = (this.cols || []).concat(list.map((c) => this.world.phys.add(xf ? xf.mul(c[0]) : c[0], c[1], 1, this))); }
}

export class Door extends Interactable {
  constructor(world, id, pos, yaw, width) {
    super(world, pos, 'Открыть дверь');
    this.id = id; this.width = width; this.yaw = yaw; this.radius = 2.0; this.angle = 0;
    this.open = !!Game.worldState.doors[id];
    this.angle = this.open ? 1 : 0;
    const mb = new MeshBuilder(), c = [0.3, 0.32, 0.28, 0.2];
    mb.addBox(new Xf(I(), v(width / 2 - 0.05, 1.12, 0)), v(width - 0.12, 2.2, 0.06), c);
    mb.addBox(new Xf(I(), v(width - 0.25, 1.05, 0.05)), v(0.12, 0.03, 0.05), [0.6, 0.6, 0.55, 0.2]);
    mb.addBox(new Xf(I(), v(width / 2, 1.8, 0.035)), v(width / 2, 0.4, 0.01), [0.24, 0.26, 0.22, 0.2]);
    this.meshAt(mb);
    this.hinge = v(-width / 2 + 0.05, 0, 0);
    this.col = world.phys.add(new Xf(M3.ry(yaw), pos), v(width - 0.1, 2.2, 0.15), 128, this);
    this._t = 0; this.apply();
  }
  prompt() { return this.open ? 'Закрыть дверь' : 'Открыть дверь'; }
  interact() { this.setOpen(!this.open); }
  setOpen(o) { if (o === this.open) return; this.open = o; Game.worldState.doors[this.id] = o; events.emit('sfx3d', 'door', this.p); }
  apply() {
    const base = new Xf(M3.ry(this.yaw), this.p).mul(new Xf(M3.ry(-this.angle * 1.75), this.hinge));
    this.obj.setXf(base);
    this.col.enabled = this.angle < 0.02;
  }
  update(dt) {
    const target = this.open ? 1 : 0;
    if (Math.abs(this.angle - target) > 0.001) { this.angle += Math.sign(target - this.angle) * Math.min(Math.abs(target - this.angle), dt * 2.5); this.apply(); }
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 0.3;
      if (!this.open) for (const s of this.world.soldiers) if (s.alive && s.pos.dist2(this.p) < 2.2) { this.setOpen(true); break; }
    }
  }
}

export class Rubble extends Interactable {
  constructor(world, buildingId, pos) {
    super(world, pos, 'Разобрать завал');
    this.buildingId = buildingId; this.holdTime = 4; this.radius = 3.2; this.anim = 'repair';
    const rng = new RNG(hashStr(buildingId)), mb = new MeshBuilder();
    P.rubblePile(mb, null, pos, 1.8, rng, 1.5);
    for (let i = 0; i < 3; i++) mb.beam(pos.add(v(rng.range(-1, 1), 0.2, rng.range(-1, 1))), pos.add(v(rng.range(-1.5, 1.5), 1.4, rng.range(-1, 1))), 0.18, 0.18, [0.4, 0.3, 0.2, 0.4]);
    this.meshAt(mb);
    this.cols = [world.phys.add(new Xf(I(), pos.add(v(0, 0.8, 0))), v(3.2, 1.6, 3.2), 1, this)];
  }
  interact() {
    Game.worldState.rubble[this.buildingId] = true;
    Game.give('scrap', 3); Game.give('planks', 1);
    msg('Завал разобран: +3 металлолома, +1 доска.', MSG.GOOD);
    events.emit('visited', 'rubble_' + this.buildingId);
    events.emit('building', this.buildingId);
    const p = this.p; this.remove();
    this.world.nav.rebuildRegion(p.x, p.z, 4, this.world.phys);
  }
}

export class Pickup extends Interactable {
  constructor(world, id, itemId, count, pos) {
    super(world, pos, '');
    this.pid = id; this.itemId = itemId; this.count = count; this.radius = 1.8; this.anim = 'pickup';
    const mb = new MeshBuilder(), it = item(itemId), c = it.color;
    if (it.cat === CAT.AMMO) P.ammoBox(mb, null, new Xf(I().scaled(v(0.45, 0.45, 0.45)), pos));
    else if (itemId === 'planks') for (let i = 0; i < 3; i++) mb.addBox(new Xf(M3.ry(i * 0.2), pos.add(v(0, 0.05 + i * 0.1, 0))), v(1.6, 0.08, 0.2), [0.55, 0.42, 0.26, 0.4]);
    else if (itemId === 'scrap') { const rng = new RNG(hashStr(id)); for (let i = 0; i < 4; i++) mb.addBox(new Xf(M3.ry(rng.f() * 3).mul(M3.rx(rng.f() * 0.5)), pos.add(v(rng.range(-0.2, 0.2), 0.05, rng.range(-0.2, 0.2)))), v(0.5, 0.04, 0.3), [0.42, 0.26, 0.15, 0.3]); }
    else { mb.addBox(new Xf(I(), pos.add(v(0, 0.1, 0))), v(0.32, 0.2, 0.25), [c[0], c[1], c[2], 0.2]); if (it.cat === CAT.MED) mb.addBox(new Xf(I(), pos.add(v(0, 0.205, 0))), v(0.12, 0.01, 0.04), [0.9, 0.1, 0.1, 0.2]); }
    this.meshAt(mb);
    world.markers.push(this);
  }
  prompt() { return `Подобрать: ${itemName(this.itemId)} ×${this.count}`; }
  interact() {
    const left = Game.give(this.itemId, this.count);
    if (left >= this.count) { msg('Нет места в рюкзаке.', MSG.ALERT); return; }
    events.emit('sfx', 'pickup'); msg(`Подобрано: ${itemName(this.itemId)} ×${this.count - left}`);
    if (left > 0) { this.count = left; return; }
    Game.worldState.taken[this.pid] = true; this.remove();
    const i = this.world.markers.indexOf(this); if (i >= 0) this.world.markers.splice(i, 1);
  }
}

export class LootContainer extends Interactable {
  constructor(world, id, title, kind, items, pos, yaw = 0) {
    super(world, pos, '');
    this.cid = id; this.title = title; this.kind = kind; this.radius = 2.3;
    this.items = Game.worldState.containers[id] ? { ...Game.worldState.containers[id] } : { ...items };
    const mb = new MeshBuilder(), col = [], xf = new Xf(M3.ry(yaw), pos);
    switch (kind) {
      case 'crate': P.crate(mb, col, xf.mul(new Xf(M3.ry(0.3), v())), v(1, 0.7, 0.7)); break;
      case 'ammobox': case 'weaponbox': P.ammoBox(mb, col, xf); P.ammoBox(mb, null, xf.mul(new Xf(M3.ry(0.2), v(0, 0.42, 0)))); break;
      case 'locker': P.locker(mb, col, xf); break;
      case 'cabinet': P.cabinet(mb, col, xf); break;
      case 'safe': P.safeBox(mb, col, xf); break;
      case 'desk': P.table(mb, col, xf, [1.4, 0.7]); break;
      case 'toolbox': P.toolbox(mb, xf); break;
      case 'shelf': P.crate(mb, col, xf, v(0.8, 0.6, 0.6)); break;
      case 'bag': mb.addBox(new Xf(M3.rz(0.4), pos.add(v(0, 0.18, 0))), v(0.45, 0.35, 0.3), [0.25, 0.24, 0.17, 0.5]); break;
    }
    this.meshAt(mb);
    if (col.length) this.cols = col.map((c) => world.phys.add(c[0], c[1], 1, this));
  }
  prompt() { return `Обыскать: ${this.title}${Object.keys(this.items).length ? '' : ' (пусто)'}`; }
  interact() { events.emit('sfx3d', 'door', this.p); events.emit('ui', 'loot', this); events.emit('visited', 'open_' + this.cid); }
  take(id, n) {
    const have = this.items[id] || 0; n = Math.min(n, have); if (n <= 0) return 0;
    const left = Game.give(id, n, isWeapon(id) ? { ammo: weapon(id).mag } : {});
    const taken = n - left;
    if (taken > 0) { this.items[id] = have - taken; if (this.items[id] <= 0) delete this.items[id]; Game.worldState.containers[this.cid] = { ...this.items }; events.emit('visited', 'took_' + id); }
    return taken;
  }
  takeAll() { let t = 0; for (const id of Object.keys(this.items)) t += this.take(id, this.items[id]); return t; }
}

export class Salvage extends Interactable {
  constructor(world, id, res, amount, pos) {
    super(world, pos, '');
    this.sid = id; this.res = res; this.amount = amount; this.holdTime = 2.5; this.radius = 2.2; this.anim = 'repair';
    const rng = new RNG(hashStr(id)), mb = new MeshBuilder();
    if (res === 'planks') { P.plankStack(mb, null, pos, rng.f() * Math.PI, rng); P.pallet(mb, new Xf(M3.ry(0.4), pos.add(v(0.6, 0, 1)))); }
    else P.scrapHeap(mb, null, pos, rng);
    this.meshAt(mb);
  }
  prompt() { return `Разобрать: ${itemName(this.res)}`; }
  interact() {
    const left = Game.give(this.res, this.amount);
    if (left >= this.amount) { msg('Нет места в рюкзаке.', MSG.ALERT); return; }
    msg(`Получено: ${itemName(this.res)} ×${this.amount - left}`); events.emit('sfx', 'pickup');
    Game.worldState.salvage[this.sid] = true; this.remove();
  }
}

export class InspectPoint extends Interactable {
  constructor(world, id, text, pos) { super(world, pos, 'Осмотреть'); this.iid = id; this.text = text; this.radius = 3; }
  can() { return super.can() && !!this.world.quest?.wantsInspect(this.iid) && !Game.flags[this.iid]; }
  interact() { Game.setFlag(this.iid); msg(this.text); events.emit('visited', this.iid); }
}

export class ExitZone extends Interactable {
  constructor(world, id, name, pos) { super(world, pos, 'Выход: ' + name); this.eid = id; this.name = name; this.radius = 6; }
  interact() { events.emit('ui', 'exit', { id: this.eid, name: this.name }); }
}

// ------------------------------------------------------------------ здание
export class Building {
  constructor(world, def) {
    this.world = world; this.def = def; this.id = def.id; this.seed = hashStr(def.id);
    this.origin = v(def.pos[0], 0, def.pos[1]); this.xf = new Xf(I(), this.origin);
    this.open = !!def.open || def.kind === 'tower'; this.cache = {}; this.visualKey = ''; this.inside = false; this.height = 3.4;
    const r = world.r;
    let cols, interior;
    if (this.open) { const site = BG.openSite(def, 0, this.seed); cols = site.col; interior = BG.interior(def, false, this.seed + 3); }
    else { const sh = BG.shell(def, 0, this.seed); this.cache.shell_0 = sh; cols = sh.col; this.height = sh.height; interior = BG.interior(def, Game.level(this.id) === 0, this.seed + 3); }
    this.cols = cols.concat(interior.col).map((c) => world.phys.add(this.xf.mul(c[0]), c[1], 1, this));
    this.objs = {};
    for (const k of ['shell', 'roof', 'glass', 'interior', 'upgrades', 'scaffold']) this.objs[k] = null;
    this.lightPts = interior.lights.map((p) => this.xf.mulV(p));
    this.lights = this.lightPts.map((p) => ({ pos: p, range: 9, color: [1, 0.86, 0.62], energy: 1.4, on: false }));
    for (const l of this.lights) world.r.lights.push(l);
    const di = BG.doorInfo(def);
    this.doorLight = { pos: this.xf.mulV(di.pos.add(di.out.mul(1.2)).add(v(0, 3, 0))), range: 8, color: [1, 0.8, 0.55], energy: 1.2, on: false };
    world.r.lights.push(this.doorLight);
    this.terminal = new BuildingTerminal(world, this, this.xf.mulV(interior.terminal));
    this.repairSpot = new RepairSpot(world, this, this.open ? this.xf.mulV(interior.terminal.add(v(0, 0, 1))) : this.xf.mulV(di.pos.add(di.out.mul(2))));
    if (!this.open) this.makeDoors(di);
    this.refresh();
    events.on('building', (id) => { if (id === this.id) this.refresh(); });
  }
  makeDoors(di) {
    const out = di.out, along = v(-out.z, 0, out.x), spots = [];
    if (this.def.hangar) { if (this.def.kind !== 'garage') spots.push(di.pos.add(along.mul(4.2))); }
    else spots.push(di.pos);
    if (this.def.kind === 'barracks') spots.push(di.pos.add(v(0, 0, 12)));
    spots.forEach((p, i) => { const d = new Door(this.world, `${this.id}_${i}`, this.xf.mulV(p), Math.atan2(out.x, out.z), 1.6); this.world.doors.push(d); });
  }
  setObj(key, mb, kind = 'world', shadow = true) {
    const r = this.world.r;
    if (this.objs[key]) { r.remove(this.objs[key]); this.objs[key] = null; }
    if (!mb || mb.isEmpty()) return;
    const o = new RenderObject(r.createMesh(mb.data()), kind); o.shadow = shadow; o.setXf(this.xf);
    this.objs[key] = r.add(o);
  }
  refresh() {
    const lvl = Game.level(this.id), job = Game.job(this.id), key = lvl + '_' + job;
    if (key === this.visualKey) return;
    const ruin = lvl === 0 ? 1 : 0, ck = 'shell_' + (ruin ? 1 : 0);
    if (!this.cache[ck]) this.cache[ck] = this.open ? BG.openSite(this.def, ruin, this.seed) : BG.shell(this.def, ruin, this.seed);
    const sh = this.cache[ck];
    this.setObj('shell', sh.shell); this.setObj('roof', sh.roof); this.setObj('glass', sh.glass, 'world', false);
    if (this.objs.roof) this.objs.roof.visible = !this.inside;
    if (job) { this.cache.scaffold = this.cache.scaffold || BG.scaffold(this.def, this.open ? 3 : this.height); this.setObj('scaffold', this.cache.scaffold); } else this.setObj('scaffold', null);
    if (lvl >= 2 && !this.open) { this.cache.upg = this.cache.upg || BG.upgrades(this.def, this.height, new RNG(this.seed + 9)); this.setObj('upgrades', this.cache.upg); } else this.setObj('upgrades', null);
    if (!this.open && (this.visualKey === '' || (this.visualKey[0] === '0') !== (lvl === 0))) this.setObj('interior', BG.interior(this.def, lvl === 0, this.seed + 3).mb, 'world', false);
    this.visualKey = key;
    this.updateLights();
  }
  updateLights() {
    const on = Game.powerOn && Game.level(this.id) >= 1, night = Game.time < 7 || Game.time > 19;
    for (const l of this.lights) l.on = on;
    this.doorLight.on = on && night;
  }
  contains(p, margin = 0.3) { const [w, d] = this.def.size; return Math.abs(p.x - this.origin.x) < w / 2 - margin && Math.abs(p.z - this.origin.z) < d / 2 - margin; }
  update() {
    if (this.open) return;
    const pl = this.world.player; const ins = !!pl && this.contains(pl.pos);
    if (ins !== this.inside) { this.inside = ins; if (this.objs.roof) this.objs.roof.visible = !ins; if (ins) events.emit('visited', 'inside_' + this.id); }
  }
  workPoint() { return this.repairSpot.p; }
  entrance() { const di = BG.doorInfo(this.def); return this.xf.mulV(di.pos.add(di.out.mul(2))); }
}

export class BuildingTerminal extends Interactable {
  constructor(world, b, pos) {
    super(world, pos, ''); this.b = b; this.radius = 2.4;
    const mb = new MeshBuilder();
    mb.addBox(new Xf(I(), pos.add(v(0, 0.55, 0))), v(0.08, 1.1, 0.08), [0.3, 0.3, 0.3, 0.2]);
    mb.addBox(new Xf(M3.rx(-0.5), pos.add(v(0, 1.15, 0))), v(0.45, 0.32, 0.06), [0.22, 0.25, 0.22, 0.2]);
    mb.addBox(new Xf(M3.rx(-0.5), pos.add(v(0, 1.17, -0.03))), v(0.36, 0.22, 0.01), [0.95, 0.55, 0.15, 0.8]);
    this.meshAt(mb); if (this.obj) this.obj.cutout = false;
  }
  prompt() { return 'Панель: ' + this.b.def.name; }
  interact() { events.emit('ui', 'building', this.b.id); }
}

export class RepairSpot extends Interactable {
  constructor(world, b, pos) { super(world, pos, ''); this.b = b; this.radius = 3; this.anim = 'repair'; this.holdTime = -1; }
  can() { return super.can() && !!Game.job(this.b.id); }
  prompt() { return `Ремонтировать: ${this.b.def.name} (${Math.floor(Game.progress(this.b.id) / Game.workNeeded(this.b.id) * 100)}%)`; }
  work(actor, dt) { Game.addWork(this.b.id, dt); if (Math.random() < dt * 2) events.emit('sfx3d', 'hammer', this.p.add(v(0, 1, 0))); }
}
