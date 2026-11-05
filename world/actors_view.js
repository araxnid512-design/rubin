// Отображение людей и машин загруженного сектора. Состояние берётся из кампании (sim/army.js) — здесь только картинка:
// скелетная анимация движка (ходьба, бег, прицел, отдача, перезарядка, удары молотком, гибель), оружие и инструменты в руках,
// машины с наклоном по рельефу и поворотной башней.
import { RenderObject } from '../engine/renderer.js';
import { V3, M3, Xf, clamp, lerpAngle } from '../engine/math.js';
import { HumanRig, B } from '../engine/rig_human.js';
import { VISUAL_WEAPON, SIDX } from '../sim/army.js';
import { vehicleModel } from './vehicles.js';
import { VEH } from '../sim/vehicle_data.js';
const VEH_LEN = Object.fromEntries(Object.entries(VEH).map(([k, d]) => [k, d.len]));
import * as M from './models.js';
import { HandItem, syncGlbWeapon } from './assets.js';

const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
// облики по листам референсов characters_npcs / characters_enemy
export const LOOKS = {
  friendly: {
    npc_scrap_worker: { head: 'helmet', helmetColor: [0.92, 0.46, 0.1], suit: [0.52, 0.47, 0.37], armor: [0.34, 0.4, 0.22], pants: [0.34, 0.4, 0.22], vest: [0.9, 0.48, 0.12], vestOn: true, gloves: [0.6, 0.45, 0.2] },
    npc_mechanic: { head: 'helmet', helmetColor: [0.3, 0.22, 0.15], goggles: true, suit: [0.2, 0.23, 0.34], armor: [0.42, 0.28, 0.17], pants: [0.2, 0.23, 0.34], toolbag: true },
    npc_infantry: { head: 'helmet', helmetColor: [0.34, 0.38, 0.25], suit: [0.33, 0.37, 0.24], armor: [0.3, 0.33, 0.21], pants: [0.33, 0.37, 0.24], vest: [0.3, 0.33, 0.22], vestOn: true, backpack: true, packColor: [0.3, 0.32, 0.22] },
  },
  enemy: {
    npc_scrap_worker: { head: 'helmet', helmetColor: [0.24, 0.24, 0.25], suit: [0.28, 0.28, 0.29], armor: [0.5, 0.22, 0.16], pants: [0.28, 0.28, 0.29], gloves: [0.4, 0.32, 0.2] },
    npc_mechanic: { head: 'helmet', helmetColor: [0.25, 0.2, 0.17], goggles: true, suit: [0.27, 0.27, 0.29], armor: [0.48, 0.22, 0.16], pants: [0.27, 0.27, 0.29], toolbag: true },
    npc_infantry: { head: 'helmet', helmetColor: [0.46, 0.21, 0.16], goggles: true, suit: [0.27, 0.27, 0.29], armor: [0.48, 0.21, 0.16], pants: [0.27, 0.27, 0.29], vest: [0.3, 0.28, 0.25], vestOn: true },
  },
};

export class UnitsView {
  constructor(app) {
    this.app = app; this.r = app.r; this.map = new Map(); this.dead = new Set();
    this.tools = { hammer: this.r.createMesh(M.hammerMesh().data()), wrench: this.r.createMesh(M.wrenchMesh().data()) };
  }
  _create(u) {
    const A = this.app.assets, glb = A && ((u.side === 'enemy' && A.character('enemy_' + u.role)) || A.character(u.role));
    const rig = glb || new HumanRig(this.r, (LOOKS[u.side] || LOOKS.friendly)[u.role] || {}); rig.setShadow(true); rig.holdState = 'idle'; rig.resetFeet();
    const e = { rig, px: u.x, pz: u.z, vel: v(), w: undefined, tool: null, toolId: '', yaw: u.yaw };
    this.map.set(u.uid, e);
    return e;
  }
  onDeath(uid) { this.dead.add(uid); }
  get(uid) { return this.map.get(uid); }
  sync(dt, units, sectorIdx, cam) {
    const S = this.app.sector, seen = new Set();
    for (const u of units) {
      if (SIDX[u.sector] !== sectorIdx || !(u.hp > 0)) continue;
      seen.add(u.uid);
      let e = this.map.get(u.uid); if (!e) e = this._create(u);
      if (e.dying != null) continue;
      const y = S.h(u.x, u.z), rig = e.rig;
      if (dt > 0) { let vx = (u.x - e.px) / dt, vz = (u.z - e.pz) / dt; if (Math.hypot(vx, vz) > 12) { vx = 0; vz = 0; } const k = clamp(dt * 10, 0, 1); e.vel.x += (vx - e.vel.x) * k; e.vel.z += (vz - e.vel.z) * k; }
      e.px = u.x; e.pz = u.z;
      if (e.w !== (u.weapon || '')) { e.w = u.weapon || ''; rig.setWeapon(VISUAL_WEAPON[u.weapon] || ''); rig.setShadow(true); }
      const aim = !!u.tgt && !!u.weapon && !u.reloadT;
      rig.aiming = aim; rig.holdState = aim ? 'aim' : u.weapon ? 'low' : 'idle';
      if (aim && u._tg) rig.aimDir = v(u._tg.x - u.x, 0, u._tg.z - u.z).norm();
      if (u.reloadT > 0 && rig.action !== 'reload') rig.play('reload', Math.max(0.6, u.reloadT));
      if (u.st === 'work' && !rig.action) rig.play('repair', 0.9);
      // инструмент в руке у рабочего (молоток) и механика (ключ), если нет оружия
      const toolId = u.weapon ? '' : u.role === 'npc_scrap_worker' ? 'hammer' : u.role === 'npc_mechanic' ? 'wrench' : '';
      if (toolId !== e.toolId) { if (e.tool) e.tool.destroy(); e.tool = toolId ? new HandItem(this.r, this.app.assets, toolId === 'hammer' ? 'tool_hammer' : 'tool_wrench', this.tools[toolId]) : null; e.toolId = toolId; }
      e.yaw = lerpAngle(e.yaw, u.yaw, clamp(dt * 10, 0, 1));
      const xf = new Xf(M3.ry(e.yaw), v(u.x, y, u.z));
      const d = cam ? cam.pos.dist(xf.origin) : 0; rig.lodSkip = d < 45 ? 0 : d < 75 ? 1 : 3;
      rig.velocity = v(e.vel.x, 0, e.vel.z);
      rig.update(dt, xf);
      if (e.tool) e.tool.setXf(rig.handXf().mul(new Xf(M3.rx(-1.25), v(0, -0.07, -0.02))));
      syncGlbWeapon(e, this.app.assets, u.weapon, rig, VISUAL_WEAPON[u.weapon]);
    }
    for (const [uid, e] of this.map) {
      if (seen.has(uid) && e.dying == null) continue;
      if (e.dying == null && this.dead.has(uid)) { e.dying = 8; e.rig.die(); if (e.tool) { e.tool.destroy(); e.tool = null; } this.dead.delete(uid); }
      if (e.dying != null) { e.dying -= dt; e.rig.update(dt, e.rig.xf); if (e.dying > 0) continue; }
      this._remove(uid, e);
    }
  }
  _remove(uid, e) { e.rig.destroy(); if (e.tool) e.tool.destroy(); if (e.wglb) e.wglb.destroy(); this.map.delete(uid); }
  dispose() { for (const [uid, e] of this.map) this._remove(uid, e); this.dead.clear(); }
  muzzle(uid) { const e = this.map.get(uid); if (!e || e.dying != null) return null; e.rig.onFire(); return { pos: e.rig.muzzleWorld(), dir: e.rig.muzzleDir() }; }
  hit(uid) { const e = this.map.get(uid); if (e) { e.rig.hitReact(); e.hitK = 1; } }
}

// ---------------------------------------------------------------- машины
export class VehiclesView {
  constructor(app) { this.app = app; this.r = app.r; this.map = new Map(); }
  _create(veh) {
    const A = this.app.assets, glb = A && A.instance(veh.id, 'world', { length: VEH_LEN[veh.id] || 4 });
    if (glb) { const e = { glb, body: null, turret: null, xf: new Xf(), tyaw: 0, muzzle: null }; this.map.set(veh.uid, e); return e; }
    const m = vehicleModel(veh.id, veh.enemy ? 'enemy' : 'friendly');
    const body = this.r.add(new RenderObject(this.r.createMesh(m.body.data()), 'world')); body.cutout = false;
    const turret = m.turret ? this.r.add(new RenderObject(this.r.createMesh(m.turret.data()), 'world')) : null;
    const e = { body, turret, turretAt: m.turretAt, muzzle: m.muzzle, xf: new Xf(), tyaw: 0 };
    this.map.set(veh.uid, e);
    return e;
  }
  get(uid) { return this.map.get(uid); }
  orient(veh) {
    const S = this.app.sector, f = v(-Math.sin(veh.yaw), 0, -Math.cos(veh.yaw)), r = v(-f.z, 0, f.x), L = 1.6, W = 0.9;
    const hf = S.h(veh.x + f.x * L, veh.z + f.z * L), hb = S.h(veh.x - f.x * L, veh.z - f.z * L), hr = S.h(veh.x + r.x * W, veh.z + r.z * W), hl = S.h(veh.x - r.x * W, veh.z - r.z * W);
    const fwd = v(f.x * 2 * L, hf - hb, f.z * 2 * L).norm(), right = v(r.x * 2 * W, hr - hl, r.z * 2 * W).norm();
    const up = right.cross(fwd).norm(), y = (hf + hb + hr + hl) / 4;
    return new Xf(M3.yFwd(up.y > 0 ? up : up.neg(), fwd), v(veh.x, y + 0.02, veh.z));
  }
  sync(dt, vehicles, sectorIdx) {
    const seen = new Set();
    for (const veh of vehicles) {
      if (SIDX[veh.sector] !== sectorIdx) continue;
      seen.add(veh.uid);
      const e = this.map.get(veh.uid) || this._create(veh);
      e.xf = this.orient(veh);
      if (e.glb) { e.glb.setXf(e.xf); e.glb.update(0); continue; }
      e.body.setXf(e.xf);
      if (e.turret) {
        const want = veh._aimYaw != null ? veh._aimYaw - veh.yaw : 0;
        e.tyaw = lerpAngle(e.tyaw, want, clamp(dt * 4, 0, 1));
        e.turret.setXf(e.xf.mul(new Xf(M3.ry(e.tyaw), e.turretAt)));
      }
      const dmg = 1 - veh.hp / veh.maxHp; e.body.hit = dmg > 0.6 ? 0.25 : 0;
    }
    for (const [uid, e] of this.map) if (!seen.has(uid)) { this._drop(e); this.map.delete(uid); }
  }
  _drop(e) { if (e.glb) e.glb.destroy(); if (e.body) this.r.remove(e.body); if (e.turret) this.r.remove(e.turret); }
  muzzle(uid) {
    const e = this.map.get(uid); if (!e) return null;
    if (!e.turret) return { pos: e.xf.mulV(v(0, 2.2, -1.5)), dir: e.xf.basis.mulV(v(0, 0, -1)).norm() };
    const txf = e.xf.mul(new Xf(M3.ry(e.tyaw), e.turretAt));
    return { pos: txf.mulV(e.muzzle), dir: txf.basis.mulV(v(0, 0, -1)).norm() };
  }
  dispose() { for (const [uid, e] of this.map) { this._drop(e); this.map.delete(uid); } }
}
