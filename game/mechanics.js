// Дополнительные механики: гранаты (бросок по дуге, отскок, запал), артефакты у аномалий + детектор,
// набеги противников на базу (предупреждение по рации, прорыв через ворота/проломы), отдых до утра.
import { V3, M3, Xf, RNG, clamp, lerp, TAU } from '../engine/math.js';
import { MeshBuilder } from '../engine/mesh.js';
import { RenderObject } from '../engine/renderer.js';
import { audio } from '../engine/audio.js';
import { Game, events, msg, MSG } from './state.js';
import { item, itemName, ARTIFACTS } from './items.js';
import * as L from './layout.js';
import { Interactable } from './objects.js';
import { Enemy, explode } from './actors.js';

const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const G = 9.8;
const rnd = (a, b) => a + Math.random() * (b - a);

// ===================================================================== гранаты
let grenadeMesh = null;
function gMesh(r) {
  if (grenadeMesh) return grenadeMesh;
  const mb = new MeshBuilder();
  mb.addBlob(v(), v(0.055, 0.07, 0.055), [0.3, 0.34, 0.2, 0.2], new RNG(7), 0.12);
  mb.addBox(new Xf(new M3(), v(0, 0.08, 0)), v(0.025, 0.04, 0.025), [0.5, 0.5, 0.45, 0.2]);
  return (grenadeMesh = r.createMesh(mb.data()));
}
// Начальная скорость броска, чтобы граната упала в точку to (за время, растущее с дальностью)
export function throwVelocity(from, to) {
  const d = Math.hypot(to.x - from.x, to.z - from.z), t = clamp(0.45 + d / 16, 0.5, 1.5);
  return v((to.x - from.x) / t, (to.y - from.y + 0.5 * G * t * t) / t, (to.z - from.z) / t);
}
// Точки траектории (для прицельной дуги на экране)
export function trajectory(from, vel, phys, n = 28, dt = 0.06) {
  const pts = [from.clone()]; let p = from.clone(), u = vel.clone();
  for (let i = 0; i < n; i++) {
    u = u.add(v(0, -G * dt, 0)); const np = p.add(u.mul(dt));
    if (np.y <= 0.05) { const k = (p.y - 0.05) / Math.max(1e-4, p.y - np.y); pts.push(p.lerp(np, k)); break; }
    if (phys && !phys.lineClear(p, np, 1)) { pts.push(np); break; }
    pts.push(np); p = np;
  }
  return pts;
}
export const MAX_THROW = 22;

export class Grenade {
  constructor(world, owner, from, vel, id) {
    this.world = world; this.owner = owner; this.pos = from.clone(); this.vel = vel; this.def = item(id); this.fuse = this.def.fuse || 3.2; this.dead = false;
    this.obj = world.r.add(new RenderObject(gMesh(world.r), 'char')); this.spin = 0;
    world.projectiles.push(this);
  }
  update(dt) {
    this.fuse -= dt; this.spin += dt * 12;
    const sub = 3;
    for (let s = 0; s < sub; s++) {
      const h = dt / sub;
      this.vel.y -= G * h;
      const np = this.pos.add(this.vel.mul(h)), d = np.sub(this.pos), l = d.len();
      if (l > 1e-5) {
        const hit = this.world.phys.raycast(this.pos, d, l + 0.06, 1 | 128, null, false);
        if (hit) { const n = hit.normal; const vn = n.mul(this.vel.dot(n)); this.vel = this.vel.sub(vn.mul(1.45)).mul(0.6); audio.playAt('impact', this.pos, -10, 1.6); continue; }
      }
      this.pos = np;
      if (this.pos.y < 0.06) { this.pos.y = 0.06; if (this.vel.y < -1) audio.playAt('impact', this.pos, -14, 1.8); this.vel = v(this.vel.x * 0.55, Math.abs(this.vel.y) * 0.3, this.vel.z * 0.55); if (Math.abs(this.vel.y) < 0.4) this.vel.y = 0; }
    }
    this.obj.setXf(new Xf(M3.ry(this.spin).mul(M3.rx(this.spin * 0.7)), this.pos));
    if (this.fuse <= 0) this.explode();
  }
  explode() {
    if (this.dead) return; this.dead = true; this.world.r.remove(this.obj);
    explode(this.world, this.owner, this.pos.add(v(0, 0.3, 0)), this.def.radius || 6, this.def.dmg || 120);
  }
}

// ===================================================================== артефакты
class Artifact extends Interactable {
  constructor(world, spawner, key, id, pos) {
    super(world, pos, ''); this.spawner = spawner; this.key = key; this.aid = id; this.radius = 1.6; this.anim = 'pickup'; this.t = Math.random() * 6;
    const mb = new MeshBuilder(), c = item(id).color;
    mb.addBlob(pos.add(v(0, 0.16, 0)), v(0.13, 0.11, 0.13), [c[0], c[1], c[2], 0.7], new RNG(key.length * 31), 0.3);
    this.meshAt(mb, 'char');
    world.markers.push(this);
  }
  prompt() { return 'Подобрать артефакт: ' + itemName(this.aid); }
  interact() {
    const left = Game.give(this.aid, 1);
    if (left > 0) { msg('Нет места в рюкзаке.', MSG.ALERT); return; }
    audio.play('pickup'); msg(`Найден артефакт «${itemName(this.aid)}». Наденьте на пояс в рюкзаке.`, MSG.GOOD);
    events.emit('visited', 'artifact');
    this.spawner.taken(this);
  }
}

export class ArtifactField {
  constructor(world) {
    this.world = world; this.items = []; this.beepT = 0; this.checkT = 0; this.nearest = null;
    const st = Game.worldState.artifacts || (Game.worldState.artifacts = {});
    this.sites = L.ANOMALIES.map((a, i) => ({ key: 'an' + i, a, pool: a.kind === 'electro' ? ['art_flash', 'art_medusa'] : a.kind === 'fire' ? ['art_fireball', 'art_stoneblood'] : ['art_medusa', 'art_stoneblood'] }))
      .filter((s) => s.a.kind !== 'rad' || s.a.r >= 7);
    for (const s of this.sites) {
      const rec = st[s.key];
      if (!rec) this.spawn(s); else if (rec.id) this.place(s, rec.id, v(rec.x, 0, rec.z));
    }
  }
  spawn(s) {
    const ang = Math.random() * TAU, rr = s.a.r * rnd(0.3, 1.1), id = s.pool[Math.floor(Math.random() * s.pool.length)];
    const p = v(s.a.pos[0] + Math.cos(ang) * rr, 0, s.a.pos[2] + Math.sin(ang) * rr);
    Game.worldState.artifacts[s.key] = { id, x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
    this.place(s, id, p);
  }
  place(s, id, p) { this.items.push(new Artifact(this.world, this, s.key, id, p)); }
  taken(a) {
    Game.worldState.artifacts[a.key] = { respawnAt: Game.hours() + 36 };
    a.remove(); this.items.splice(this.items.indexOf(a), 1);
    const m = this.world.markers.indexOf(a); if (m >= 0) this.world.markers.splice(m, 1);
  }
  update(dt) {
    const r = this.world.r, pl = this.world.player, t = this.world.time;
    for (const a of this.items) { // свечение артефакта
      const c = item(a.aid).color, k = 0.6 + Math.sin(t * 3 + a.t) * 0.25;
      if (pl && a.p.dist(pl.pos) < 40) r.fxBillboard(a.p.add(v(0, 0.2, 0)), 0.9, [c[0], c[1], c[2], 1.1 * k]);
    }
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 2;
      const st = Game.worldState.artifacts;
      for (const s of this.sites) { const rec = st[s.key]; if (rec && rec.respawnAt && Game.hours() >= rec.respawnAt) this.spawn(s); }
    }
    // детектор «Отклик»: писк чаще ближе к артефакту
    this.nearest = null;
    if (!pl) return;
    let bd = 30;
    for (const a of this.items) { const d = a.p.dist2(pl.pos); if (d < bd) { bd = d; this.nearest = { d, a }; } }
    if (this.nearest) {
      this.beepT -= dt;
      if (this.beepT <= 0) { this.beepT = lerp(0.12, 1.3, this.nearest.d / 30); audio.play('click', -14, 1.4 + (1 - this.nearest.d / 30) * 0.8); }
    }
  }
}

// ===================================================================== набеги на базу
export class Raids {
  constructor(world) { this.world = world; this.members = []; this.warned = false; this.route = null; this.n = 0; this.active = false; this.t = 0; }
  schedule(fromHours) {
    // ближайшая ночь: 21:00–02:00
    const day = Math.floor(fromHours / 24), h = fromHours - day * 24;
    let at = day * 24 + 21 + Math.random() * 5;
    if (at < fromHours + 3) at += 24 + rnd(6, 18);
    Game.nextRaid = at; this.warned = false;
  }
  update(dt) {
    this.t -= dt;
    // тела убираются через 4 минуты, если генерал далеко
    for (const m of this.members) if (!m.alive && m.corpse !== undefined) { m.deadT += dt; if (m.deadT > 240 && this.world.player && this.world.player.pos.dist(m.pos) > 40) { if (m.corpse) m.corpse.remove(); m.corpse = undefined; m.remove(); const i = this.world.enemies.indexOf(m); if (i >= 0) this.world.enemies.splice(i, 1); } }
    if (this.t > 0) return; this.t = 0.5;
    const now = Game.hours();
    if (Game.nextRaid < 0) { if (Game.level('generator') >= 1) this.schedule(now); return; }
    if (this.active) {
      if (this.members.every((m) => !m.alive)) {
        this.active = false; Game.raidsRepelled++;
        msg(`Набег отбит! Обыщите тела нападавших. Отбито набегов: ${Game.raidsRepelled}.`, MSG.GOOD);
        events.emit('visited', 'raid_repelled'); events.emit('autosave');
      }
      return;
    }
    if (!this.warned && now >= Game.nextRaid - 1) {
      this.route = L.RAID_ROUTES[Math.floor(Math.random() * L.RAID_ROUTES.length)]; this.warned = true;
      msg(`Наблюдатель: «Движение у ${this.route.name}! Готовьтесь к бою.»`, MSG.RADIO); audio.play('radio', -6);
      events.emit('raid_warning', this.route);
    }
    if (now >= Game.nextRaid) this.start();
  }
  start(routeIdx = -1) {
    if (routeIdx >= 0) this.route = L.RAID_ROUTES[routeIdx];
    if (!this.route) this.route = L.RAID_ROUTES[Math.floor(Math.random() * L.RAID_ROUTES.length)];
    const day = Game.day, kinds = day <= 2 ? ['dog'] : ['dog', 'bandit', 'zombie'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const count = Math.min(7, (kind === 'dog' ? 4 : 3) + Math.floor(day / 2));
    const id = 'raid_' + Game.day + '_' + (++this.n);
    const group = { def: { id, kind, leash: 999, r: 4, count }, alertAll: (e) => { for (const m of this.members) if (m.alive && m.raidId === id) m.alertTo(e); }, onMemberDied: () => {} };
    const sp = this.route.spawn, wps = [this.route.entry, this.route.inside, L.RALLY_POINT].map((a) => v(a[0], 0, a[2]));
    for (let i = 0; i < count; i++) {
      const e = new Enemy(this.world, kind, i, group, wps[0], v(sp[0] + rnd(-4, 4), 0, sp[2] + rnd(-4, 4)));
      e.raid = true; e.raidId = id; e.raidWps = wps; e.raidI = 0; e.sightRange = Math.max(e.sightRange, kind === 'dog' ? 14 : 34); e.state = 'raid'; e.deadT = 0;
      this.members.push(e);
    }
    this.active = true; this.warned = false;
    Game.nextRaid = Game.hours() + rnd(30, 44);
    msg(`Набег у ${this.route.name}: ${count} × ${kind === 'dog' ? 'слепые псы' : kind === 'bandit' ? 'мародёры' : 'зомбированные'}!`, MSG.ALERT);
    events.emit('raid_start', this.route);
  }
  alive() { return this.members.filter((m) => m.alive).length; }
}

// ===================================================================== отдых до утра
export function restUntilMorning(world) {
  const pl = world.player;
  if (world.enemies.some((e) => e.alive && !e.dormant && e.pos.dist(pl.pos) < 45)) { msg('Нельзя отдыхать: рядом противник.', MSG.ALERT); return false; }
  const now = Game.hours(), day = Math.floor(now / 24);
  let until = day * 24 + 7; if (until <= now + 0.5) until += 24;
  let interrupted = false;
  if (Game.nextRaid > 0 && Game.nextRaid - 1 < until) { until = Math.max(now, Game.nextRaid - 1); interrupted = true; }
  const h = until - now;
  if (h < 0.25) { msg('Скоро тревога — отдыхать некогда.', MSG.ALERT); return false; }
  Game.advance(h);
  const good = Game.level('barracks') >= 1;
  pl.stamina = 100; pl.heal(h * (good ? 6 : 3)); pl.hunger = Math.max(0, pl.hunger - h * 1.6); pl.thirst = Math.max(0, pl.thirst - h * 2.4);
  for (const s of world.soldiers) if (s.alive) s.heal(h * (good ? 8 : 4));
  world.dayNight && world.dayNight.apply();
  msg(interrupted ? `Отдых прерван через ${h.toFixed(1)} ч: тревога!` : `Генерал отдохнул ${h.toFixed(1)} ч. ${Game.timeStr()}.`, interrupted ? MSG.ALERT : MSG.GOOD);
  return true;
}
