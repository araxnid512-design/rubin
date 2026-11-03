// Персонажи: генерал (игрок), бойцы «Долга» (приказы и ИИ), противники (слепые псы, зомбированные, мародёры),
// группы противников со «сном» вдали и возрождением, стрельба (hitscan, дробь, взрывы), шум, укрытия.
// Ближнего боя у людей нет: только огнестрельное оружие. Собаки кусают (это животное).
import { V3, M3, Xf, clamp, lerp, smoothstep, lerpAngle, fmod, RNG, hashStr, TAU } from '../engine/math.js';
import { audio } from '../engine/audio.js';
import { HumanRig } from './rig_human.js';
import { DogRig } from './rig_dog.js';
import { Game, events, msg, MSG } from './state.js';
import { weapon, item, CAT } from './items.js';
import * as L from './layout.js';
import { LootContainer } from './objects.js';

const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const UP = v(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const FACTION = { DUTY: 0, MUTANT: 1, ZOMBIE: 2, BANDIT: 3 };
export const LAYER = { STATIC: 1, PLAYER: 2, SOLDIER: 4, ENEMY: 8, DOOR: 128 };
const SIGHT_MASK = LAYER.STATIC | LAYER.DOOR;
const P3 = (a) => v(a[0], a[1], a[2]);
const ipos = (n) => (typeof n.pos === 'function' ? n.pos() : n.pos);
export const insideBase = (p) => p.x > -98 && p.x < 98 && p.z > -103 && p.z < 80;

function onScreen(cam, p) {
  const s = cam.project(p, 1, 1);
  return !!s && s.x > -0.12 && s.x < 1.12 && s.y > -0.2 && s.y < 1.2;
}

// ===================================================================== стрельба
export function shoot(world, shooter, origin, muzzle, dir, w, spreadMul) {
  const pellets = w.pellets || 1, spread = (w.spread * Math.PI / 180) * spreadMul, range = w.range;
  for (let i = 0; i < pellets; i++) {
    let d = dir;
    if (spread > 0) {
      const b = M3.look(dir, Math.abs(dir.y) < 0.99 ? UP : v(1, 0, 0)), a = Math.random() * TAU, r = Math.sqrt(Math.random()) * spread;
      d = b.mulV(v(Math.cos(a) * Math.sin(r), Math.sin(a) * Math.sin(r), -Math.cos(r))).norm();
    }
    const hit = world.phys.raycast(origin, d, range, SIGHT_MASK, shooter.body, true);
    let end = origin.add(d.mul(range));
    if (hit) {
      end = hit.point;
      const falloff = clamp(1.2 - origin.dist(end) / range * 0.6, 0.5, 1);
      const a = hit.body && hit.body.owner;
      if (a && a.alive) a.takeDamage(w.dmg * falloff, shooter, end, d);
      else if (hit.collider) world.fx.impact(end, hit.normal);
      if (w.explosive) explode(world, shooter, end, w.explosive, w.dmg);
    }
    if (i === 0 || Math.random() < 0.4) world.fx.tracer(muzzle, end);
  }
  world.fx.muzzleFlash(muzzle, dir, (w.noise || 40) < 20);
  audio.playAt(w.sound || 'shot_rifle', muzzle, shooter === world.player ? 0 : -3);
  world.noise(shooter.pos, w.noise || 40, shooter);
}
export function explode(world, source, pos, radius, dmg) {
  for (const a of world.actors) {
    if (!a.alive) continue;
    const d = a.centerPos().dist(pos);
    if (d < radius) a.takeDamage(dmg * (1 - d / radius) * 0.9, source, a.centerPos(), a.centerPos().sub(pos).norm());
  }
  world.fx.explosion(pos); audio.playAt('explosion', pos, 4);
  if (world.player && world.player.pos.dist(pos) < 30) events.emit('shake', 0.6 * (1 - world.player.pos.dist(pos) / 30));
  world.noise(pos, 80, source);
}
// Не стрелять, если на линии огня союзник
export function allyInLine(world, shooter, targetPos) {
  const o = shooter.centerPos().add(v(0, 0.25, 0)), d = targetPos.sub(o), l = d.len();
  if (l < 0.1) return false;
  const hit = world.phys.raycast(o, d, l, 0, shooter.body, true);
  const a = hit && hit.body && hit.body.owner;
  return !!a && a !== shooter && !shooter.isHostile(a);
}

// ===================================================================== базовый персонаж
export class Actor {
  constructor(world, pos, yaw = 0) {
    this.world = world; this.pos = V3.from(pos); this.yaw = yaw; this.vel = v(); this.faction = FACTION.DUTY; this.displayName = '';
    this.maxHp = 100; this.hp = 100; this.armor = 0; this.alive = true; this.rig = null; this.isDog = false; this.turnSpeed = 8;
    this.aimTarget = null; this.weaponId = ''; this.mag = 0; this.reserve = 0; this.reloading = false; this.reloadT = 0; this.fireCd = 0; this.cycleT = 0;
    this.accuracy = 1; this.sightRange = 38; this.hearing = 1; this.hitFlash = 0;
    this.path = []; this.pathI = 0; this.navTarget = null; this.needPath = false;
    this.body = { pos: this.pos, radius: 0.32, height: 1.8, layer: LAYER.SOLDIER, mask: LAYER.STATIC | LAYER.DOOR | LAYER.PLAYER | LAYER.SOLDIER | LAYER.ENEMY, owner: this, solid: true, hittable: true };
    world.phys.bodies.push(this.body); world.actors.push(this);
    this._onScreen = true;
  }
  xf() { return new Xf(M3.ry(this.yaw), this.pos.clone()); }
  fwd() { return v(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  eyePos() { return this.pos.add(v(0, this.isDog ? 0.6 : 1.6, 0)); }
  centerPos() { return this.pos.add(v(0, this.isDog ? 0.45 : 1.15, 0)); }
  // ---------------- здоровье
  takeDamage(amount, source, hitPos = null, dir = null) {
    if (!this.alive) return;
    const dmg = amount * (1 - this.armor);
    this.hp -= dmg; this.hitFlash = 1;
    if (this.rig) this.rig.hitReact();
    this.onDamaged(dmg, source);
    if (hitPos) this.world.fx.blood(hitPos, dir ? dir.neg() : UP, this.isDog);
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  onDamaged() {}
  heal(a) { if (this.alive) this.hp = Math.min(this.maxHp, this.hp + a); }
  die() {
    if (!this.alive) return;
    this.alive = false; this.vel = v(); this.body.solid = false; this.body.hittable = false; this.navTarget = null;
    if (this.rig) { this.rig.die(); this.rig.setVisible(true); this._onScreen = true; }
    events.emit('actor_died', this);
  }
  isHostile(o) { return !!o && o !== this && o.alive && o.faction !== this.faction; }
  canSee(o) { return this.world.phys.lineClear(this.eyePos(), o.centerPos(), SIGHT_MASK); }
  // ---------------- оружие
  wdef() { return weapon(this.weaponId); }
  canFire() { return !!this.weaponId && !this.reloading && this.fireCd <= 0 && this.mag > 0 && this.cycleT <= 0; }
  fireAt(target, spreadMul = 1) {
    if (!this.canFire()) return false;
    const w = this.wdef(); this.fireCd = w.rof; this.mag--;
    const origin = this.centerPos().add(v(0, 0.25, 0));
    const muzzle = this.rig && this.rig.muzzleWorld ? this.rig.muzzleWorld() : origin;
    shoot(this.world, this, origin, muzzle, target.sub(origin).norm(), w, this.accuracy * spreadMul);
    if (this.rig) this.rig.onFire();
    if ((this.weaponId === 'mosin' || this.weaponId === 'ks23') && this.mag > 0) { this.cycleT = 0.7; this.rig.play('cycle', 0.6); }
    return true;
  }
  startReload() {
    if (this.reloading || !this.weaponId) return false;
    const w = this.wdef();
    if (this.mag >= w.mag || this.availableReserve() <= 0) return false;
    this.reloading = true; this.reloadT = w.reload_time;
    if (this.rig instanceof HumanRig) this.rig.play('reload', this.reloadT);
    audio.playAt('reload', this.pos.add(v(0, 1, 0)), -6);
    return true;
  }
  availableReserve() { return this.reserve; }
  takeReserve(n) { const t = Math.min(n, this.reserve); this.reserve -= t; return t; }
  finishReload() { this.reloading = false; this.mag += this.takeReserve(this.wdef().mag - this.mag); }
  updateWeapon(dt) {
    this.fireCd -= dt; this.cycleT -= dt;
    if (this.reloading) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(); }
  }
  // ---------------- перемещение по навигационной сетке
  moveTo(t, repath = 1.2) { if (!this.navTarget || t.dist2(this.navTarget) > repath) { this.navTarget = V3.from(t); this.needPath = true; } }
  stopMove() { this.navTarget = null; this.path = []; this.pathI = 0; this.needPath = false; }
  navDone() { return !this.navTarget || (!this.needPath && this.pathI >= this.path.length); }
  steer(speed, dt, accel = 10) {
    let want = v();
    if (speed > 0 && this.navTarget) {
      if (this.needPath && this.world.pathBudget > 0) {
        this.world.pathBudget--; this.needPath = false;
        this.path = this.world.nav.findPath(this.pos, this.navTarget); this.pathI = 0;
      }
      while (this.pathI < this.path.length && this.pos.dist2(this.path[this.pathI]) < (this.pathI === this.path.length - 1 ? 0.3 : 0.55)) this.pathI++;
      if (!this.needPath && this.pathI < this.path.length) {
        const nxt = this.path[this.pathI], d = v(nxt.x - this.pos.x, 0, nxt.z - this.pos.z), l = d.len();
        if (l > 0.05) {
          want = d.mul(speed / l);
          if (!this.aimTarget) want = want.mul(clamp(0.35 + this.fwd().dot(d.mul(1 / l)) * 0.65, 0.25, 1)); // не бежим боком при резком повороте
          if (this.pathI === this.path.length - 1 && l < 1.2) want = want.mul(Math.max(0.35, l / 1.2));
        }
      }
    }
    const dv = want.sub(this.vel), md = accel * dt;
    const nv = dv.len() > md ? this.vel.add(dv.norm().mul(md)) : want;
    const x0 = this.pos.x, z0 = this.pos.z;
    if (nv.lenSq() > 1e-6) this.world.phys.move(this.body, nv.x * dt, nv.z * dt);
    // фактическая скорость (после упора в стены) — для анимации шага без «скольжения»
    this.vel = dt > 0 ? v((this.pos.x - x0) / dt, 0, (this.pos.z - z0) / dt) : nv;
    if (this.vel.len() > nv.len() + 0.5) this.vel = this.vel.norm().mul(nv.len() + 0.5);
  }
  turnTowards(dir, dt) {
    if (dir.x * dir.x + dir.z * dir.z < 1e-4) return;
    this.yaw = lerpAngle(this.yaw, Math.atan2(-dir.x, -dir.z), clamp(this.turnSpeed * dt, 0, 1));
  }
  faceTo(p) { const d = p.sub(this.pos); if (d.x * d.x + d.z * d.z > 0.01) this.yaw = Math.atan2(-d.x, -d.z); }
  updateFacing(dt) {
    if (this.aimTarget) this.turnTowards(this.aimTarget.sub(this.pos), dt);
    else if (this.vel.len() > 0.3) this.turnTowards(this.vel, dt);
  }
  near(p, r) { return !p || Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < r; }
  // ---------------- анимация (только на экране; дальние — с пропуском кадров)
  updateVisual(dt, cam) {
    if (!this.rig) return;
    if (this.hitFlash > 0) { this.hitFlash = Math.max(0, this.hitFlash - dt * 5); this.rig.setHit(this.hitFlash); }
    const on = onScreen(cam, this.pos.add(v(0, 1, 0))) || onScreen(cam, this.pos);
    if (!on) { if (this.alive && this._onScreen) { this._onScreen = false; this.rig.setVisible(false); } return; }
    if (!this._onScreen) { this._onScreen = true; this.rig.setVisible(true); this.rig.resetFeet(); }
    const dist = cam.pos.dist(this.pos);
    this.rig.lodSkip = dist < 40 ? 0 : dist < 65 ? 1 : 3;
    this.rig.velocity = v(this.vel.x, 0, this.vel.z);
    if (this.aimTarget && this.rig.aimDir) this.rig.aimDir = this.aimTarget.sub(this.centerPos()).norm();
    this.rig.update(dt, this.xf());
  }
  remove() {
    if (this.rig) this.rig.destroy();
    const b = this.world.phys.bodies, i = b.indexOf(this.body); if (i >= 0) b.splice(i, 1);
    const a = this.world.actors, j = a.indexOf(this); if (j >= 0) a.splice(j, 1);
    this.removed = true;
  }
  onNoise() {}
}

// ===================================================================== генерал
const WALK = 1.7, RUN = 3.7, SPRINT = 5.0;
export class Player extends Actor {
  constructor(world) {
    const ps = Game.playerState;
    super(world, P3(ps.pos), ps.yaw || 0);
    this.displayName = 'Генерал'; this.body.layer = LAYER.PLAYER; this.body.mask = LAYER.STATIC | LAYER.DOOR | LAYER.SOLDIER | LAYER.ENEMY; this.turnSpeed = 12;
    this.stamina = 100; this.radiation = 0; this.focus = null; this.holdProgress = 0; this.holding = false; this.holdTarget = null; this.focusT = 0;
    this.useItemId = ''; this.useT = 0; this.switchT = 0; this.target = null; this.retargetT = 0; this.noiseT = 0; this.semiReady = true;
    this.activeSlot = 1; this.godMode = false; this.autoWalk = null; this.prevInteract = false; this.touchHoldInteract = false;
    this.rig = new HumanRig(world.r, { head: 'bare', hair: [0.32, 0.3, 0.28], headset: true, armband: true, backpack: true, suit: [0.16, 0.16, 0.17], armor: [0.5, 0.08, 0.07], collar: true });
    this.rig.onFootstep = (p, s) => { if (s > 0.6) audio.playAt('step', p, s > 4 ? -10 : -16); };
    this.flashlight = { pos: v(0, -50, 0), range: 11, color: [1, 0.95, 0.85], energy: 0, on: false };
    world.r.lights.push(this.flashlight);
    world.player = this; Game.player = this;
    this.readState();
    events.on('equipment', () => this.syncWeapon());
  }
  readState() {
    const ps = Game.playerState;
    this.hp = ps.hp ?? 100; this.stamina = ps.stamina ?? 100; this.radiation = ps.rad || 0;
    this.pos.copy(P3(ps.pos)); this.yaw = ps.yaw || 0;
    this.armor = item(ps.armor || 'armor_duty').armor || 0;
    this.activeSlot = Game.equip.active ?? 1;
    this.syncWeapon(); this.rig.resetFeet();
  }
  writeState() {
    const ps = Game.playerState;
    ps.hp = this.hp; ps.stamina = this.stamina; ps.rad = this.radiation; ps.pos = this.pos.toArray(); ps.yaw = this.yaw;
    this.storeMag();
  }
  slotKey(s) { return s === 0 ? 'primary' : 'pistol'; }
  storeMag() { const e = Game.equip[this.slotKey(this.activeSlot)]; if (e && e.id === this.weaponId) e.ammo = this.mag; }
  syncWeapon() {
    let e = Game.equip[this.slotKey(this.activeSlot)];
    if (!e) { const o = Game.equip[this.slotKey(1 - this.activeSlot)]; if (o) { this.activeSlot = 1 - this.activeSlot; e = o; } }
    if (!e) { this.weaponId = ''; this.mag = 0; this.rig.setWeapon(''); return; }
    if (e.id !== this.weaponId) { this.weaponId = e.id; this.rig.setWeapon(e.id); this.reloading = false; }
    this.mag = e.ammo || 0; Game.equip.active = this.activeSlot;
  }
  switchSlot(s) {
    if (s === this.activeSlot || !Game.equip[this.slotKey(s)] || this.useItemId) return;
    this.storeMag(); this.activeSlot = s; this.reloading = false; this.rig.stopAction(); this.switchT = 0.45;
    this.syncWeapon(); audio.play('reload', -8, 1.4); events.emit('equipment');
  }
  availableReserve() { return this.weaponId ? Game.inv.count(this.wdef().ammo) : 0; }
  takeReserve(n) { return Game.inv.remove(this.wdef().ammo, n); }
  finishReload() { super.finishReload(); this.storeMag(); }
  takeDamage(amount, source, hitPos, dir) {
    if (this.godMode || !this.alive) return;
    super.takeDamage(amount, source, hitPos, dir);
    events.emit('player_hit', amount); events.emit('shake', Math.min(0.5, amount * 0.02));
    if (this.useItemId && amount > 5) this.cancelUse();
  }
  die() { super.die(); msg('Генерал погиб.', MSG.ALERT); events.emit('ui', 'death'); }
  addRadiation(x) { this.radiation = clamp(this.radiation + x, 0, 100); }

  update(dt) {
    if (!this.alive) { this.vel = v(); return; }
    const inp = this.world.input, cam = this.world.cam, settings = this.world.settings;
    this.updateWeapon(dt); this.switchT -= dt;
    // ---- движение
    let mv = inp.touch.move;
    const kb = inp.keyMove();
    if (Math.hypot(kb[0], kb[1]) > 0.05) mv = kb;
    if (this.autoWalk) { const d = this.autoWalk.sub(this.pos); const l = Math.hypot(d.x, d.z); mv = l > 0.5 ? [d.x / l, d.z / l] : [0, 0]; }
    const magIn = clamp(Math.hypot(mv[0], mv[1]), 0, 1);
    let sprint = (inp.held('sprint') || inp.touch.sprint) && this.stamina > 3 && magIn > 0.5;
    let speed = 0;
    if (magIn > 0.05) {
      speed = Math.hypot(kb[0], kb[1]) > 0.05 || this.autoWalk ? RUN : lerp(WALK * 0.6, RUN, smoothstep(0.15, 0.85, magIn));
      if (sprint) speed = SPRINT;
    }
    const busy = this.holding || !!this.useItemId;
    if (this.useItemId) { speed = Math.min(speed, WALK); sprint = false; }
    if (this.holding) speed = 0;
    const want = magIn > 0.05 ? v(mv[0], 0, mv[1]).norm().mul(speed) : v();
    // ---- прицеливание и стрельба
    const desktop = !settings.useTouch() || inp.lastDevice === 'kb';
    const uiBlock = inp.uiBlocks();
    const fireHeld = inp.touch.fire || (desktop && inp.mouse.left && !uiBlock);
    const aimHeld = desktop && inp.mouse.right && !uiBlock;
    this.aimTarget = null;
    let mousePt = null;
    if ((aimHeld || (inp.mouse.left && !inp.touch.fire)) && desktop) mousePt = cam.groundAt(inp.mouse.x, inp.mouse.y, innerWidth, innerHeight, 1.1);
    this.retargetT -= dt;
    if (fireHeld || aimHeld) {
      if (mousePt) { const as = this.enemyNear(mousePt, 1.8); this.aimTarget = as ? as.centerPos() : mousePt; }
      else {
        if (this.retargetT <= 0 || !this.target || !this.target.alive) { this.retargetT = 0.3; this.target = this.findTarget(); }
        this.aimTarget = this.target ? this.target.centerPos() : this.centerPos().add(this.fwd().mul(10));
      }
    }
    if (this.weaponId && !busy && this.switchT <= 0) {
      if (fireHeld && this.aimTarget) {
        const to = this.aimTarget.sub(this.pos); to.y = 0;
        const aligned = this.fwd().dot(to.norm()) > 0.85 || to.len() < 1.5;
        if (this.mag <= 0 && !this.reloading) {
          if (this.availableReserve() > 0) this.startReload();
          else if (this.semiReady) { audio.play('click'); msg('Нет патронов!', MSG.ALERT); this.semiReady = false; }
        } else if (aligned) {
          // удержание огня: автомат — очередью, самозарядное — в своём темпе
          if (this.fireAt(this.aimTarget, 1 + (speed > WALK + 0.1 ? 0.6 : 0))) { this.semiReady = false; this.storeMag(); }
        }
      }
      if (!fireHeld) this.semiReady = true;
      if (inp.pressed('reload')) this.startReload();
    }
    // ---- выносливость и радиация
    if (sprint && want.len() > 0.1) this.stamina = Math.max(0, this.stamina - 16 * dt); else this.stamina = Math.min(100, this.stamina + 11 * dt);
    if (this.radiation > 0) {
      this.radiation = Math.max(0, this.radiation - 0.15 * dt);
      if (this.radiation > 50 && !this.godMode) { this.hp -= (this.radiation < 80 ? 0.4 : 1.6) * dt; if (this.hp <= 0) { this.hp = 0; this.die(); return; } }
    }
    // ---- физика
    const dv = want.sub(this.vel), md = 22 * dt;
    const nv = dv.len() > md ? this.vel.add(dv.norm().mul(md)) : want;
    const x0 = this.pos.x, z0 = this.pos.z;
    if (nv.lenSq() > 1e-6) this.world.phys.move(this.body, nv.x * dt, nv.z * dt);
    this.vel = v((this.pos.x - x0) / Math.max(dt, 1e-4), 0, (this.pos.z - z0) / Math.max(dt, 1e-4));
    if (this.vel.len() > nv.len() + 0.3) this.vel = this.vel.norm().mul(nv.len());
    this.updateFacing(dt);
    // ---- шум шагов
    this.noiseT -= dt;
    const hs = this.vel.len();
    if (this.noiseT <= 0 && hs > 0.5) { this.noiseT = 0.5; this.world.noise(this.pos, hs < 2 ? 3 : hs < 4.5 ? 9 : 15, this); }
    this.updateInteraction(dt);
    if (this.useItemId) { this.useT -= dt; if (this.useT <= 0) { this.applyItem(this.useItemId); this.useItemId = ''; } }
    for (let i = 0; i < 4; i++) if (inp.pressed('quick' + (i + 1))) this.useQuick(i);
    if (inp.pressed('slot1')) this.switchSlot(0);
    if (inp.pressed('slot2')) this.switchSlot(1);
    if (inp.pressed('inspect') && this.weaponId && !this.reloading) this.rig.play('inspect', 2.2);
    // фонарь ночью (точечный свет впереди генерала)
    const night = Game.time < 6 || Game.time > 20.3;
    this.flashlight.on = night; this.flashlight.energy = night ? 2.2 : 0;
    this.flashlight.pos = this.pos.add(this.fwd().mul(3.2)).add(v(0, 1.6, 0));
    this.world.r.uniforms.playerPos = this.pos;
  }
  updateVisual(dt, cam) {
    const hr = this.rig;
    hr.aiming = !!this.aimTarget && !!this.weaponId && !this.useItemId && !this.holding;
    hr.holdState = this.vel.len() < 4 ? 'low' : 'carry';
    if (Game.flags.relaxed) hr.holdState = 'idle';
    super.updateVisual(dt, cam);
  }
  findTarget() {
    let best = null, bd = Infinity; const rng = this.weaponId ? this.wdef().range : 30, f = this.fwd();
    for (const e of this.world.enemies) {
      if (!e.alive || e.dormant) continue;
      const d = this.pos.dist(e.pos); if (d > rng) continue;
      let score = d * (f.dot(e.pos.sub(this.pos).norm()) > 0.3 ? 1 : 1.6);
      if (e === this.target) score *= 0.7;
      if (score < bd && this.canSee(e)) { bd = score; best = e; }
    }
    return best;
  }
  enemyNear(p, r) { for (const e of this.world.enemies) if (e.alive && !e.dormant && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < r) return e; return null; }
  // ---------------- взаимодействие (нажать / удерживать / непрерывная работа)
  updateInteraction(dt) {
    const inp = this.world.input;
    this.focusT -= dt;
    if (this.focusT <= 0 && !this.holding) { this.focusT = 0.12; this.focus = this.findFocus(); }
    const pressed = inp.held('interact') || inp.touch.interact, just = pressed && !this.prevInteract;
    this.prevInteract = pressed;
    if (this.holding) {
      const t = this.holdTarget;
      if (!pressed || !t || !t.can(this)) { this.endHold(); return; }
      const ht = t.hold();
      if (ht < 0) { t.work(this, dt); this.holdProgress = fmod(this.holdProgress + dt, 1); this.keepAnim(t.anim); }
      else {
        this.holdProgress += dt / ht; this.keepAnim(t.anim);
        if (this.holdProgress >= 1) { this.endHold(); t.interact(this); return; }
      }
      events.emit('hold_progress', ht >= 0 ? this.holdProgress : -1, t.prompt());
      return;
    }
    if (just && this.focus && !this.useItemId) this.startInteraction(this.focus);
  }
  startInteraction(f) {
    const ht = f.hold();
    this.faceTo(ipos(f));
    if (ht === 0) { this.rig.play(f.anim === 'pickup' ? 'pickup' : 'use', 0.6); f.interact(this); }
    else { this.holding = true; this.holdTarget = f; this.holdProgress = 0; this.rig.play(f.anim, 999); }
  }
  keepAnim(a) { if (this.rig.action !== a) this.rig.play(a, 999); }
  endHold() { this.holding = false; this.holdTarget = null; this.holdProgress = 0; this.rig.stopAction(); events.emit('hold_progress', -2, ''); }
  findFocus() {
    let best = null, bd = Infinity;
    for (const n of this.world.interactables) {
      if (n === this || !n.can(this)) continue;
      const p = ipos(n), d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (d < (n.radius || 2.2) && Math.abs(p.y - this.pos.y) < 2.5 && d < bd) { bd = d; best = n; }
    }
    return best;
  }
  // ---------------- предметы
  useQuick(i) { const id = Game.quick[i]; if (id) this.useItem(id); }
  useItem(id) {
    if (this.useItemId || Game.inv.count(id) <= 0) return;
    const it = item(id);
    if (it.cat !== CAT.MED && it.cat !== CAT.FOOD) return;
    if (it.heal && this.hp >= this.maxHp && !it.stamina && !it.rad) { msg('Здоровье в норме.'); return; }
    this.useItemId = id; this.useT = it.use_time || 2; this.reloading = false; this.rig.play('bandage', this.useT);
  }
  cancelUse() { this.useItemId = ''; this.rig.stopAction(); }
  applyItem(id) {
    if (Game.inv.remove(id, 1) <= 0) return;
    const it = item(id);
    if (it.heal) this.heal(it.heal);
    if (it.rad) this.radiation = Math.max(0, this.radiation + it.rad);
    if (it.stamina) this.stamina = Math.min(100, this.stamina + it.stamina);
    msg('Использовано: ' + it.name);
  }
}

// ===================================================================== бойцы «Долга»
export const ORDER_NAMES = { follow: 'Следовать за мной', guard: 'Охранять позицию', patrol: 'Патрулировать', repair: 'Ремонтировать постройку', heal: 'Лечить раненых', defend: 'Занять оборону', barracks: 'Вернуться в казарму', idle: 'Вольно' };
const FOLLOW_OFFS = [v(-1.6, 0, 2), v(1.6, 0, 2), v(-2.6, 0, 3.8), v(2.6, 0, 3.8), v(0, 0, 5), v(-3.6, 0, 5.6)];

export class Soldier extends Actor {
  constructor(world, def) {
    const st = Game.soldiers[def.id];
    super(world, P3(st.pos), st.yaw || 0);
    this.def = def; this.sid = def.id; this.role = def.role; this.displayName = `${def.name} «${def.call}»`;
    this.order = st.order || 'idle'; this.orderTarget = st.target ? (Array.isArray(st.target) ? P3(st.target) : st.target) : null;
    this.state = 'idle'; this.targetEnemy = null; this.lastSeen = v(); this.aiT = Math.random() * 0.3; this.burstLeft = 0; this.burstPause = 0; this.patrolI = 0;
    this.healTarget = null; this.healT = 0; this.greetCd = 10; this.alertPos = null; this.alertT = 0; this.noAmmoWarned = false; this.talkT = 0; this.stuckT = 0;
    this.lastPos = this.pos.clone(); this.speed = 0; this.repairB = ''; this.cover = null; this.coverT = 0;
    this.hp = st.hp; this.maxHp = st.max_hp || 100; this.armor = 0.2; this.weaponId = st.weapon; this.mag = st.ammo; this.reserve = st.reserve;
    this.supplied = !!st.supplied; this.skill = st.skill || 1; this.accuracy = 1.3 / this.skill; this.sightRange = this.role === 'sniper' ? 70 : 40;
    const look = { ...(def.look || {}), suit: [0.19, 0.19, 0.2], armor: [0.52, 0.09, 0.07] };
    this.rig = new HumanRig(world.r, look); this.rig.setWeapon(this.weaponId);
    if (this.order === 'repair' && typeof this.orderTarget === 'string') this.repairB = this.orderTarget;
    // интерфейс интерактивного объекта (разговор с бойцом)
    this.radius = 2.2; this.anim = 'use';
    world.interactables.push(this);
    if (st.alive === false) { this.alive = false; this.hp = 0; this.body.solid = false; this.body.hittable = false; this.rig.die(); }
  }
  writeState() {
    const st = Game.soldiers[this.sid];
    Object.assign(st, { hp: this.hp, weapon: this.weaponId, ammo: this.mag, reserve: this.reserve, order: this.order, target: this.orderTarget instanceof V3 ? this.orderTarget.toArray() : this.orderTarget, pos: this.pos.toArray(), yaw: this.yaw, supplied: this.supplied, skill: this.skill, alive: this.alive });
  }
  roleName() { return this.def.role_name || this.role; }
  orderName() { return ORDER_NAMES[this.order] || this.order; }
  statusText() { return { combat: 'Бой', retreat: 'Отступает (ранен)', heal: 'Лечит', repair: 'Ремонт', rest: 'Отдыхает', move: 'В пути', alert: 'Проверяет шум' }[this.state] || 'На месте'; }
  // ---------------- приказы
  giveOrder(o, tgt = null) {
    this.order = o; this.orderTarget = tgt; this.targetEnemy = null; this.healTarget = null; this.patrolI = 0; this.rig.stopAction(); this.cover = null;
    if (o === 'guard' && !tgt) this.orderTarget = (this.world.player ? this.world.player.pos : this.pos).clone();
    if (o === 'defend') this.orderTarget = this.pickDefensePoint(tgt);
    if (o === 'repair') this.repairB = typeof tgt === 'string' ? tgt : '';
    this.writeState(); events.emit('soldier', this.sid);
    this.rig.play('salute', 1.2); audio.playAt('ui_ok', this.pos, -12);
  }
  pickDefensePoint(near) {
    const origin = near instanceof V3 ? near : (this.world.player ? this.world.player.pos : this.pos);
    const taken = this.world.soldiers.filter((s) => s !== this && (s.order === 'defend' || s.order === 'guard') && s.orderTarget instanceof V3).map((s) => s.orderTarget);
    let best = origin.clone(), bd = Infinity;
    for (const pa of L.DEFENSE_POINTS) { const p = P3(pa); if (taken.some((t) => t.dist(p) < 1)) continue; const d = p.dist(origin); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  // ---------------- взаимодействие (интерфейс Interactable)
  prompt() { return 'Боец: ' + this.def.call; }
  hold() { return 0; }
  can() { return this.alive; }
  interact(actor) {
    this.talkT = 3; this.faceTo(actor.pos); this.rig.play('talk', 2);
    if (this.sid === 's_officer' && this.world.quest && this.world.quest.current().id === 'officer' && !Game.flags.talked_officer) events.emit('ui', 'dialog', 'officer');
    else events.emit('ui', 'soldier', this);
    events.emit('visited', 'talk_' + this.sid);
  }
  // ---------------- ИИ
  update(dt) {
    if (!this.alive) return;
    this.updateWeapon(dt);
    this.greetCd -= dt; this.talkT -= dt; this.burstPause -= dt; this.alertT -= dt; this.aiT -= dt;
    const far = !this.world.player || this.pos.dist(this.world.player.pos) > 90;
    if (this.aiT <= 0) { this.aiT = far ? 1 : 0.25; this.think(); }
    this.act(dt);
    let regen = 0.05;
    if (this.state === 'rest') regen = Game.level('barracks') >= 1 ? 1 : 0.5;
    this.hp = Math.min(this.maxHp, this.hp + regen * dt);
  }
  enemies() { return this.world.enemies.filter((e) => e.alive && !e.dormant); }
  think() {
    const te = this.targetEnemy;
    if (te && (!te.alive || te.pos.dist(this.pos) > this.sightRange * 1.3)) this.targetEnemy = null;
    if (!this.targetEnemy || Math.random() < 0.3) {
      let best = null, bd = this.sightRange;
      for (const e of this.enemies()) { const d = this.pos.dist(e.pos); if (d < bd && this.canSee(e)) { bd = d; best = e; } }
      if (best) {
        if (!this.targetEnemy) msg(`${this.def.call}: «Контакт! Противник!»`, MSG.ALERT);
        this.targetEnemy = best; this.lastSeen = best.pos.clone();
      }
    } else if (this.targetEnemy && this.canSee(this.targetEnemy)) this.lastSeen = this.targetEnemy.pos.clone();
    if (this.hp < this.maxHp * 0.3 && this.state !== 'retreat' && this.role !== 'medic') { this.state = 'retreat'; msg(`${this.def.call} ранен и отходит к медпункту!`, MSG.ALERT); }
    if (this.state === 'retreat') { if (this.hp > this.maxHp * 0.6) this.state = 'idle'; return; }
    if (this.targetEnemy) { this.state = 'combat'; return; }
    if (this.alertPos && this.alertT > 0 && ['guard', 'defend', 'patrol', 'idle'].includes(this.order)) { this.state = 'alert'; return; }
    if (this.role === 'medic' && ['heal', 'follow', 'idle', 'guard'].includes(this.order)) { const w = this.findWounded(); if (w) { this.healTarget = w; this.state = 'heal'; return; } }
    if (this.state === 'heal' && (!this.healTarget || !this.healTarget.alive)) this.state = 'idle';
    if (this.order === 'repair') this.state = 'repair';
    else if (this.order === 'barracks') this.state = this.near(this.barracksSpot(), 1.5) ? 'rest' : 'move';
    else this.state = 'order';
  }
  act(dt) {
    const hr = this.rig; this.aimTarget = null; let speed = 0; hr.holdState = 'low'; hr.lookAt = null;
    switch (this.state) {
      case 'combat': speed = this.combat(dt); break;
      case 'retreat': { const dest = this.retreatPoint(); this.moveTo(dest); speed = 3.6; hr.holdState = 'carry'; if (this.near(dest, 2)) { speed = 0; this.hp = Math.min(this.maxHp, this.hp + 0.6 * dt); } break; }
      case 'alert': this.moveTo(this.alertPos); speed = 1.6; this.aimTarget = this.alertPos.add(v(0, 1, 0)); if (this.near(this.alertPos, 3)) { speed = 0; if (this.alertT <= 0) this.alertPos = null; } break;
      case 'heal': speed = this.healAct(dt); break;
      case 'repair': speed = this.repairAct(dt); break;
      case 'rest': case 'move': { const spot = this.barracksSpot(); this.moveTo(spot); speed = this.near(spot, 1) ? 0 : 2; hr.holdState = 'carry'; break; }
      default: speed = this.followOrder(dt);
    }
    const pl = this.world.player;
    if (this.talkT > 0 && pl) { speed = 0; hr.lookAt = pl.pos.add(v(0, 1.6, 0)); }
    // приветствие генерала
    if (pl && pl.alive && this.greetCd <= 0 && this.state === 'order' && speed < 0.1 && this.pos.dist(pl.pos) < 4) { this.greetCd = 90; this.faceTo(pl.pos); hr.play('salute', 1.6); }
    this.speed = speed;
    if (speed <= 0) this.stopMove();
    this.steer(speed, dt);
    this.updateFacing(dt);
    // защита от застревания
    if (speed > 0.5) {
      if (this.pos.dist2(this.lastPos) < 0.05 * dt * 30) { this.stuckT += dt; if (this.stuckT > 2) { this.stuckT = 0; this.needPath = true; this.vel = this.vel.add(v(rnd(-1, 1), 0, rnd(-1, 1)).mul(2)); } }
      else this.stuckT = 0;
    }
    this.lastPos = this.pos.clone();
  }
  followOrder(dt) {
    const hr = this.rig, pl = this.world.player;
    switch (this.order) {
      case 'follow': {
        if (!pl) return 0;
        let dest = pl.pos.add(M3.ry(pl.yaw).mulV(FOLLOW_OFFS[this.followIndex() % FOLLOW_OFFS.length]));
        // точка построения за стеной/препятствием — ближе к генералу (иначе путь уйдёт в обход через пролом)
        const nav = this.world.nav;
        if (!nav.walkableAt(dest) || !nav.los(pl.pos.x, pl.pos.z, dest.x, dest.z)) {
          const back = pl.pos.sub(pl.fwd().mul(1.4));
          dest = nav.walkableAt(back) && nav.los(pl.pos.x, pl.pos.z, back.x, back.z) ? back : pl.pos.clone();
        }
        const d = this.pos.dist(dest);
        if (d < 1.2) return 0;
        this.moveTo(dest, 1.5);
        return d > 6 ? 4.2 : d > 2.5 ? 2.2 : 1.4;
      }
      case 'guard': case 'defend': {
        const p = this.orderTarget instanceof V3 ? this.orderTarget : this.pos;
        if (!this.near(p, 0.8)) { this.moveTo(p); return this.near(p, 6) ? 1.6 : 3.4; }
        if (Math.random() < 0.01) hr.lookBias = rnd(-0.8, 0.8);
        let face = p.sub(P3(L.RALLY_POINT));
        if (Math.abs(p.z - 76) < 10) face = v(0, 0, 1);
        this.turnTowards(face, dt);
        return 0;
      }
      case 'patrol': {
        hr.holdState = 'carry';
        const wp = P3(L.PATROL_ROUTE[this.patrolI % L.PATROL_ROUTE.length]);
        if (this.near(wp, 1.5)) this.patrolI++;
        this.moveTo(P3(L.PATROL_ROUTE[this.patrolI % L.PATROL_ROUTE.length]));
        return 1.6;
      }
      case 'heal': {
        const mp = this.world.buildings.medpoint;
        if (this.role === 'medic' && mp && !this.near(mp.entrance(), 3)) { this.moveTo(mp.entrance()); return 2; }
        return 0;
      }
      default: hr.holdState = 'idle'; return 0;
    }
  }
  followIndex() { let i = 0; for (const s of this.world.soldiers) { if (s === this) return i; if (s.order === 'follow' && s.alive) i++; } return i; }
  combat(dt) {
    const te = this.targetEnemy;
    if (!te || !te.alive) { this.state = 'idle'; return 0; }
    const dist = this.pos.dist(te.pos), w = this.wdef(), rng = this.weaponId ? w.range : 0, visible = this.canSee(te);
    let speed = 0, anchor = null;
    if ((this.order === 'guard' || this.order === 'defend') && this.orderTarget instanceof V3) anchor = this.orderTarget;
    else if (this.order === 'follow' && this.world.player) anchor = this.world.player.pos;
    if (!visible || dist > rng * 0.9) {
      let chase = this.lastSeen;
      if (anchor && anchor.dist(chase) > 14) chase = anchor.add(chase.sub(anchor).norm().mul(10));
      this.moveTo(chase); speed = 3.4;
      if (visible) this.aimTarget = te.centerPos();
      return speed;
    }
    this.aimTarget = te.centerPos();
    if (anchor && !this.near(anchor, 10)) { this.moveTo(anchor); speed = 1.6; }
    // укрытие при перезарядке или ранении
    this.coverT -= dt;
    if (this.reloading || this.hp < this.maxHp * 0.5) {
      if (!this.cover && this.coverT <= 0) { this.coverT = 1.5; this.cover = this.world.findCover(this.pos, te.pos, 10); }
      if (this.cover) { if (!this.near(this.cover, 0.8)) { this.moveTo(this.cover); return 3.8; } this.aimTarget = null; return 0; }
    } else if (this.cover && !this.reloading) this.cover = null;
    if (this.mag <= 0) {
      if (!this.startReload() && this.reserve <= 0 && !this.noAmmoWarned) { this.noAmmoWarned = true; msg(`${this.def.call}: «Нет патронов!»`, MSG.ALERT); }
      return speed;
    }
    const to = te.pos.sub(this.pos); to.y = 0;
    if (this.fwd().dot(to.norm()) < 0.9 || this.burstPause > 0) return speed;
    if (allyInLine(this.world, this, te.centerPos())) return speed;
    if (this.fireAt(te.centerPos(), 1 + dist / Math.max(rng, 1) * 0.5)) {
      this.burstLeft--;
      if (this.burstLeft <= 0) { this.burstLeft = w.auto ? rndi(3, 6) : 1; this.burstPause = w.auto ? rnd(0.35, 0.9) : rnd(0.2, 0.5); }
    }
    return speed;
  }
  findWounded() {
    let best = null, bd = 45;
    for (const a of [this.world.player, ...this.world.soldiers]) {
      if (!a || a === this || !a.alive || a.hp >= a.maxHp * 0.65) continue;
      const d = this.pos.dist(a.pos); if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  healAct(dt) {
    const hr = this.rig, t = this.healTarget;
    if (!t || !t.alive || t.hp >= t.maxHp * 0.95) { this.healTarget = null; this.state = 'idle'; hr.stopAction(); return 0; }
    if (!this.near(t.pos, 1.5)) { this.moveTo(t.pos); this.healT = 0; return 3.6; }
    this.faceTo(t.pos);
    if (hr.action !== 'heal_other') hr.play('heal_other', 3);
    this.healT += dt;
    if (this.healT >= 3) {
      this.healT = 0; let amount = 22;
      if (Game.total('medicine') > 0) { Game.consume({ medicine: 1 }); amount = 40; }
      if (Game.level('medpoint') >= 1) amount *= 1.3;
      t.heal(amount); msg(`${this.def.call} оказал помощь: ${t.displayName} (+${Math.round(amount)})`, MSG.GOOD);
    }
    return 0;
  }
  repairAct(dt) {
    const hr = this.rig, b = this.repairBuilding();
    if (!b) { hr.stopAction(); const rp = P3(L.RALLY_POINT); this.moveTo(rp); return this.near(rp, 2) ? 0 : 1.6; }
    const wp = b.workPoint();
    if (!this.near(wp, 1.6)) { this.moveTo(wp); return 3; }
    this.faceTo(b.origin);
    if (hr.action !== 'repair') hr.play('repair', 999);
    Game.addWork(b.id, (this.role === 'tech' ? 1.5 : 0.7) * dt);
    if (Math.random() < dt * 1.5) audio.playAt('hammer', this.pos.add(v(0, 1, 0)), -8);
    return 0;
  }
  repairBuilding() {
    const B = this.world.buildings;
    if (this.repairB && Game.job(this.repairB)) return B[this.repairB];
    let best = null, bd = Infinity;
    for (const id in B) if (Game.job(id)) { const d = B[id].origin.dist(this.pos); if (d < bd) { bd = d; best = B[id]; } }
    return best;
  }
  barracksSpot() { const idx = L.SOLDIERS.findIndex((s) => s.id === this.sid); return P3(L.BARRACKS_SPOTS[Math.max(0, idx) % L.BARRACKS_SPOTS.length]); }
  retreatPoint() { const mp = this.world.buildings.medpoint; return mp ? mp.entrance() : P3(L.RALLY_POINT); }
  onNoise(pos, radius, source) {
    if (source && source.faction !== undefined && this.isHostile(source) && this.pos.dist(pos) < radius * this.hearing && !this.targetEnemy) { this.alertPos = pos.clone(); this.alertT = 8; }
  }
  onDamaged(d, source) { if (source && source.faction !== undefined && this.isHostile(source) && !this.targetEnemy) { this.targetEnemy = source; this.lastSeen = source.pos.clone(); } }
  die() { super.die(); Game.soldiers[this.sid].alive = false; msg('Погиб боец: ' + this.displayName, MSG.ALERT); }
}

// ===================================================================== противники
export class Enemy extends Actor {
  constructor(world, kind, idx, group, home, pos) {
    super(world, pos, Math.random() * TAU);
    this.kind = kind; this.memberIdx = idx; this.group = group; this.home = home; this.leash = group.def.leash; this.wanderR = group.def.r;
    this.state = 'idle'; this.targetEnemy = null; this.lastSeen = v(); this.aiT = Math.random() * 0.5; this.wanderT = 0; this.wanderPt = home.clone();
    this.attackCd = 0; this.alertPos = null; this.alertT = 0; this.fleeT = -10; this.burstLeft = 0; this.burstPause = 0; this.soundCd = 0; this.biteDmg = 11; this.dormant = false;
    this.loot = {}; this.cover = null; this.coverT = 0;
    this.body.layer = LAYER.ENEMY;
    if (kind === 'dog') {
      this.faction = FACTION.MUTANT; this.displayName = 'Слепой пёс'; this.isDog = true; this.maxHp = this.hp = 45; this.turnSpeed = 9; this.sightRange = 7; this.hearing = 1.6;
      this.body.radius = 0.3; this.body.height = 0.9;
      const k = 1 - Math.random() * 0.15;
      this.rig = new DogRig(world.r, { skin: [0.6 * k, 0.47 * k, 0.42 * k] });
    } else if (kind === 'zombie') {
      this.faction = FACTION.ZOMBIE; this.displayName = 'Зомбированный'; this.maxHp = this.hp = 90; this.armor = 0.1; this.turnSpeed = 4; this.sightRange = 20; this.hearing = 0.6; this.accuracy = 3;
      this.rig = new HumanRig(world.r, { head: ['hood', 'gasmask', 'bare'][idx % 3], suit: [0.3, 0.31, 0.22], armor: [0.32, 0.3, 0.22], skin: [0.55, 0.55, 0.47], vestOn: false, pants: [0.25, 0.25, 0.2], hair: [0.2, 0.18, 0.15], hoodColor: [0.28, 0.3, 0.22] });
      this.rig.shamble = 1; this.weaponId = ['pm', 'toz34', 'ak74', 'pm'][idx % 4]; this.rig.setWeapon(this.weaponId);
      this.loot = idx % 2 === 0 ? { ammo_9x18: 6, canned: 1 } : { bandage: 1, electronics: 1 };
    } else {
      this.faction = FACTION.BANDIT; this.displayName = 'Мародёр'; this.maxHp = this.hp = 85; this.armor = 0.1; this.turnSpeed = 7; this.sightRange = 34; this.accuracy = 1.7;
      this.rig = new HumanRig(world.r, { head: ['hood', 'cap', 'bare', 'hood', 'cap'][idx % 5], suit: [0.12, 0.11, 0.1], armor: [0.2, 0.17, 0.14], pants: [0.24, 0.27, 0.32], vestOn: idx % 2 === 0, hoodColor: [0.1, 0.1, 0.1], capColor: [0.08, 0.08, 0.08], collar: false });
      this.weaponId = ['akm', 'toz34', 'aks74u', 'pm', 'saiga'][idx % 5]; this.rig.setWeapon(this.weaponId);
      this.loot = [{ ammo_762x39: 20, bandage: 1 }, { ammo_12: 8, canned: 1 }, { ammo_545: 25, medkit: 1 }, { ammo_9x18: 12, electronics: 1 }, { ammo_12: 10, weapon_parts: 1 }][idx % 5];
      this.loot[this.weaponId] = 1;
    }
    if (this.weaponId) { this.mag = this.wdef().mag; this.reserve = this.mag * 3; }
    if (kind === 'dog') this.rig.onFootstep = null;
    world.enemies.push(this);
  }
  setDormant(d) {
    if (this.dormant === d) return;
    this.dormant = d; this.rig.setVisible(!d && this._onScreen); this.body.solid = !d && this.alive; this.body.hittable = !d && this.alive;
    if (!d) this.rig.resetFeet();
  }
  update(dt) {
    if (!this.alive || this.dormant) return;
    this.updateWeapon(dt);
    this.attackCd -= dt; this.alertT -= dt; this.fleeT -= dt; this.burstPause -= dt; this.soundCd -= dt; this.aiT -= dt;
    if (this.aiT <= 0) { this.aiT = 0.25; this.think(); }
    this.act(dt);
  }
  updateVisual(dt, cam) {
    if (this.dormant) return;
    if (this.kind === 'dog') this.rig.alert = this.state === 'chase' ? 1 : 0;
    super.updateVisual(dt, cam);
  }
  hostiles() { return this.world.actors.filter((a) => a !== this && a.alive && this.isHostile(a) && !a.dormant); }
  think() {
    const te = this.targetEnemy;
    if (te && (!te.alive || te.pos.dist(this.home) > this.leash + 10 || insideBase(te.pos))) { this.targetEnemy = null; this.state = 'return'; }
    if (!this.targetEnemy) {
      let best = null, bd = this.sightRange;
      for (const e of this.hostiles()) { const d = this.pos.dist(e.pos); if (d < bd && (this.kind === 'dog' || this.canSee(e))) { bd = d; best = e; } }
      if (best && !insideBase(best.pos)) this.setTarget(best);
    } else if (this.kind === 'dog' || this.canSee(this.targetEnemy)) this.lastSeen = this.targetEnemy.pos.clone();
    if (this.kind === 'dog' && this.hp < this.maxHp * 0.25 && this.fleeT < -5) this.fleeT = 3;
    if (this.fleeT > 0) { this.state = 'flee'; return; }
    if (this.pos.dist(this.home) > this.leash) { this.targetEnemy = null; this.state = 'return'; }
    if (this.targetEnemy) this.state = this.kind === 'dog' ? 'chase' : 'combat';
    else if (this.alertPos && this.alertT > 0) this.state = 'investigate';
    else if (this.state !== 'return' || this.pos.dist(this.home) < this.wanderR) this.state = 'idle';
  }
  setTarget(e) {
    const was = this.targetEnemy; this.targetEnemy = e; this.lastSeen = e.pos.clone();
    if (!was) {
      if (this.kind === 'dog' && this.soundCd <= 0) { this.soundCd = 3; audio.playAt('bark', this.pos, 0); }
      else if (this.kind === 'zombie' && this.soundCd <= 0) { this.soundCd = 5; audio.playAt('groan', this.pos, 0); }
      this.group.alertAll(e);
    }
  }
  alertTo(e) { if (!this.targetEnemy && this.alive && !this.dormant) { this.targetEnemy = e; this.lastSeen = e.pos.clone(); } }
  act(dt) {
    this.aimTarget = null; let speed = 0;
    switch (this.state) {
      case 'idle':
        this.wanderT -= dt;
        if (this.wanderT <= 0 || this.near(this.wanderPt, 1.2)) {
          this.wanderT = rnd(4, 9);
          this.wanderPt = this.home.add(v(rnd(-this.wanderR, this.wanderR), 0, rnd(-this.wanderR, this.wanderR)));
          if (this.kind === 'dog' && Math.random() < 0.3) this.rig.play('sniff', 2);
        }
        this.moveTo(this.wanderPt); speed = this.kind === 'zombie' ? 0.7 : 1.2;
        if (Math.random() < 0.004 && this.soundCd <= 0) { this.soundCd = 6; audio.playAt(this.kind === 'dog' ? 'growl' : this.kind === 'zombie' ? 'groan' : 'radio', this.pos, -6); }
        break;
      case 'return': this.moveTo(this.home); speed = this.kind === 'zombie' ? 1 : 2.5; break;
      case 'investigate': this.moveTo(this.alertPos); speed = this.kind === 'dog' ? 2.6 : this.kind === 'zombie' ? 1 : 2; if (this.near(this.alertPos, 2)) this.alertPos = null; break;
      case 'flee': { const away = this.pos.sub(this.lastSeen).norm(); this.moveTo(this.pos.add(away.mul(8))); speed = 6; break; }
      case 'chase': speed = this.dogAttack(dt); break;
      case 'combat': speed = this.gunCombat(dt); break;
    }
    if (speed <= 0) this.stopMove();
    this.steer(speed, dt, this.kind === 'dog' ? 14 : 9);
    this.updateFacing(dt);
  }
  dogAttack(dt) {
    const t = this.targetEnemy; if (!t) return 0;
    const d = this.pos.dist(t.pos);
    if (d > 1.6) { this.moveTo(t.pos, 0.8); return d > 4 ? 6.8 : 4; }
    this.turnTowards(t.pos.sub(this.pos), dt * 2);
    if (this.attackCd <= 0) {
      this.attackCd = 1; this.rig.play('attack', 0.5); audio.playAt('growl', this.pos, -2, 1.3);
      this.world.later(0.2, () => { if (this.alive && t.alive && this.pos.dist(t.pos) < 2) t.takeDamage(this.biteDmg, this, t.centerPos(), t.pos.sub(this.pos).norm()); });
    }
    return 0;
  }
  gunCombat(dt) {
    const t = this.targetEnemy; if (!t) return 0;
    const w = this.wdef(), d = this.pos.dist(t.pos), rng = w.range * (this.kind === 'zombie' ? 0.7 : 0.85), vis = this.canSee(t);
    if (!vis || d > rng) { this.moveTo(this.lastSeen); if (vis) this.aimTarget = t.centerPos(); return this.kind === 'bandit' ? 3.2 : 1.6; }
    this.aimTarget = t.centerPos();
    let speed = 0;
    if (this.kind === 'bandit' && d < 8) { const away = this.pos.sub(t.pos).norm(); this.moveTo(this.pos.add(away.mul(4)).add(away.cross(UP).mul(2))); speed = 2.4; }
    if (this.mag <= 0) this.startReload();
    this.coverT -= dt;
    if (this.reloading && this.kind === 'bandit') {
      if (!this.cover && this.coverT <= 0) { this.coverT = 1.5; this.cover = this.world.findCover(this.pos, t.pos, 10); }
      if (this.cover && !this.near(this.cover, 0.8)) { this.moveTo(this.cover); return 3.6; }
      return 0;
    }
    this.cover = null;
    if (this.mag <= 0) return speed;
    const to = t.pos.sub(this.pos); to.y = 0;
    if (this.fwd().dot(to.norm()) < 0.85 || this.burstPause > 0) return speed;
    if (this.fireAt(t.centerPos(), 1 + d / rng)) {
      this.burstLeft--;
      if (this.burstLeft <= 0) { this.burstLeft = w.auto ? rndi(2, 5) : 1; this.burstPause = rnd(0.6, 1.4) * (this.kind === 'zombie' ? 1.6 : 1); }
    }
    return speed;
  }
  onNoise(pos, radius, source) {
    if (!this.alive || this.dormant || !source || source.faction === undefined || !this.isHostile(source) || insideBase(pos)) return;
    const d = this.pos.dist(pos);
    if (d < radius * this.hearing) {
      if (this.kind === 'dog' && d < radius * this.hearing * 0.6) this.setTarget(source);
      else if (!this.targetEnemy) { this.alertPos = pos.clone(); this.alertT = 10; }
    }
  }
  onDamaged(d, source) { if (source && source.faction !== undefined && this.isHostile(source)) this.setTarget(source); }
  die() {
    super.die();
    this.group.onMemberDied(this);
    if (Object.keys(this.loot).length) {
      const lc = new LootContainer(this.world, `body_${this.group.def.id}_${this.memberIdx}_${Game.day}`, `Тело (${this.displayName})`, 'corpse', { ...this.loot }, this.pos.clone());
      lc.radius = 1.8; this.corpse = lc;
    }
    this.deadT = 0;
  }
}

export class EnemyGroup {
  constructor(world, def) { this.world = world; this.def = def; this.members = []; this.t = 0; this.spawn(); }
  deadList() { const ws = Game.worldState.dead; if (!ws[this.def.id]) ws[this.def.id] = {}; return ws[this.def.id]; }
  spawn() {
    const dead = this.deadList(), center = P3(this.def.pos), rng = new RNG(hashStr(this.def.id)), nav = this.world.nav;
    for (let i = 0; i < this.def.count; i++) {
      let p = center.add(v(rng.range(-this.def.r, this.def.r) * 0.6, 0, rng.range(-this.def.r, this.def.r) * 0.6));
      if (dead[String(i)] !== undefined) continue;
      const c = nav.nearestWalkable(p, 6); if (c) p = v(nav.toWorld(c[0]), 0, nav.toWorld(c[1]));
      this.members.push(new Enemy(this.world, this.def.kind, i, this, center, p));
    }
  }
  alertAll(t) { for (const m of this.members) if (m.alive) m.alertTo(t); }
  onMemberDied(e) { this.deadList()[String(e.memberIdx)] = Game.day * 24 + Game.time; events.emit('visited', 'killed_' + this.def.kind); }
  aliveCount() { return this.members.filter((m) => m.alive).length; }
  update(dt) {
    for (const m of this.members) if (!m.alive && m.corpse !== undefined) {
      m.deadT += dt;
      // тело убирается через 4 минуты, если генерал далеко
      if (m.deadT > 240 && this.world.player && this.world.player.pos.dist(m.pos) > 40) { if (m.corpse) m.corpse.remove(); m.corpse = undefined; m.remove(); }
    }
    this.t -= dt; if (this.t > 0) return; this.t = 1;
    const pl = this.world.player; if (!pl) return;
    const d = pl.pos.dist(P3(this.def.pos)), wake = d < 85;
    for (const m of this.members) if (m.alive) m.setDormant(!wake);
    // возрождение через двое суток игрового времени, если генерал далеко
    if (d > 120) {
      const dead = this.deadList(), now = Game.day * 24 + Game.time, revive = Object.keys(dead).filter((k) => now - dead[k] > 48);
      if (revive.length) {
        for (const k of revive) delete dead[k];
        for (const m of this.members) { if (m.corpse) m.corpse.remove(); if (!m.removed) m.remove(); const i = this.world.enemies.indexOf(m); if (i >= 0) this.world.enemies.splice(i, 1); }
        this.members = []; this.spawn();
      }
    }
  }
}

// ===================================================================== аномалии
export function updateAnomalies(world, dt) {
  for (const an of world.anomalies) {
    an.cool -= dt; an.burst = Math.max(0, an.burst - dt * 3); an.t = (an.t || 0) + dt;
    if (an.light) an.light.energy = 0.4 + an.burst * 4 + (an.kind === 'electro' ? Math.sin(an.t * 23) * 0.2 : Math.sin(an.t * 3) * 0.15);
    for (const a of world.actors) {
      if (!a.alive || a.dormant) continue;
      const d = Math.hypot(a.pos.x - an.pos.x, a.pos.z - an.pos.z);
      if (an.kind === 'rad') { if (a === world.player && d < an.r) a.addRadiation(dt * 6 * (1 - d / an.r) + dt * 1.5); continue; }
      if (d < an.r && an.cool <= 0) {
        an.cool = 1.2; an.burst = 1;
        a.takeDamage(an.kind === 'electro' ? 18 : 22, null, a.pos.add(v(0, 1, 0)), UP);
        audio.playAt(an.kind === 'electro' ? 'zap' : 'fire', an.pos, 0);
        if (an.kind === 'electro') world.fx.spark(an.pos.add(v(0, 0.8, 0))); else world.fx.flame(an.pos.add(v(0, 0.2, 0)));
      }
    }
    // видимое «дыхание» аномалии
    if (an.kind !== 'rad' && world.player && world.player.pos.dist(an.pos) < 45) {
      if (an.kind === 'electro' && Math.random() < dt * 3) world.fx.spark(an.pos.add(v(rnd(-an.r, an.r) * 0.5, rnd(0.2, 1.6), rnd(-an.r, an.r) * 0.5)), [0.45, 0.7, 1, 2.5]);
      if (an.kind === 'fire' && Math.random() < dt * 2) world.fx._burst(an.pos.add(v(rnd(-0.5, 0.5), 0.1, rnd(-0.5, 0.5))), UP, [1, 0.45, 0.1, 1.2], 2, 1.5, 0.5, 0.2, false, -2);
    }
  }
}

export function spawnActors(world) {
  new Player(world);
  for (const d of L.SOLDIERS) { const s = new Soldier(world, d); world.soldiers.push(s); world.soldierMap[d.id] = s; }
  for (const g of L.ENEMY_GROUPS) world.groups.push(new EnemyGroup(world, g));
}
