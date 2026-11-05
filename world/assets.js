// Внешние 3D-модели (GLB из Tripo AI) по манифесту assets/manifest.json.
// Если файла для id нет — используется процедурная модель движка, игра от этого не зависит.
// Здания: подгонка под пятно застройки, «крыша» цельной модели срезается плоскостью, когда игрок внутри.
// Машины: подгонка по длине. Персонажи: скелет Tripo + клипы (idle/walk/run/shoot/slash/fall), оружие — в правой кисти.
import { V3, M3, Xf } from '../engine/math.js';
import { RenderObject } from '../engine/renderer.js';
import { GltfAsset, GltfInstance } from '../engine/gltf.js';
import { weaponModel } from '../engine/weapons.js';

const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const xfFromM4 = (m) => new Xf(new M3(v(m[0], m[1], m[2]), v(m[4], m[5], m[6]), v(m[8], m[9], m[10])), v(m[12], m[13], m[14]));

export class Assets {
  constructor(r) { this.r = r; this.manifest = { models: {} }; this.models = new Map(); this.failed = []; this.progress = { done: 0, total: 0 }; }
  async load(onProgress = null) {
    try { const res = await fetch(new URL('../assets/manifest.json', import.meta.url)); if (res.ok) this.manifest = await res.json(); } catch (e) { /* манифеста нет — процедурные модели */ }
    const list = Object.entries(this.manifest.models || {});
    this.progress.total = list.length;
    await Promise.all(list.map(async ([id, e]) => {
      try { const a = await GltfAsset.load(this.r, new URL('../assets/' + e.file, import.meta.url).href); a.entry = e; this.models.set(id, a); }
      catch (err) { this.failed.push(id + ': ' + err.message); console.warn('[модели] не загружена', id, err.message); }
      this.progress.done++; if (onProgress) onProgress(this.progress);
    }));
    return this;
  }
  has(id) { return this.models.has(id); }
  get(id) { return this.models.get(id) || null; }
  entry(id) { const a = this.get(id); return a ? a.entry || {} : {}; }
  // статичная модель (здание, машина, куча, инструмент, оружие)
  instance(id, kind, fit) { const a = this.get(id); if (!a) return null; const e = a.entry || {}; return new GltfInstance(a, kind, { ...fit, yaw: (fit.yaw || 0) + (e.yaw || 0) }); }
  // персонаж: модель роли (для врага — «enemy_…», иначе общая)
  character(id) { const a = this.get(id); return a ? new GlbCharacter(this.r, a) : null; }
}

const CLIP_RE = { idle: /idle|stand/i, walk: /walk/i, run: /run|jog/i, shoot: /shoot|fire|aim/i, slash: /slash|attack|hit|swing/i, fall: /fall|death|die/i, hurt: /hurt|damage/i };
const WEAPON_LEN = { pm: 0.2, bizon: 0.66, mosin: 1.23, an94: 0.94, akm: 0.88, ak74: 0.94, pkm: 1.19, rg6: 0.69 };

// Персонаж на скелете GLB с тем же интерфейсом, что процедурный HumanRig (для отображения людей и игрока)
export class GlbCharacter {
  constructor(r, asset) {
    this.r = r; this.a = asset; const e = asset.entry || {};
    this.inst = new GltfInstance(asset, 'char', { height: e.height || 1.78, yaw: e.yaw ?? Math.PI });
    this.clips = {};
    for (const [k, re] of Object.entries(CLIP_RE)) {
      const named = e.clips && e.clips[k]; let c = named != null ? (typeof named === 'number' ? asset.clips[named] : asset.clip(named)) : null;
      if (!c) c = asset.clips.find((x) => re.test(x.name)) || null;
      if (c) this.clips[k] = c;
    }
    if (!this.clips.idle && asset.clips.length) this.clips.idle = asset.clips[0];
    this.hand = asset.findNode(/right.?hand|hand.?r(ight)?$|r.?hand|hand_r/i);
    this.velocity = v(); this.aiming = false; this.aimDir = v(0, 0, -1); this.holdState = 'idle'; this.lodSkip = 0; this.xf = new Xf();
    this.action = ''; this.actionT = 0; this.actionDur = 0; this.dead = false; this.visible = true;
    this.weaponObj = null; this.weaponId = ''; this.weaponLen = 0.9; this.kick = 0;
    this.inst.play(this.clips.idle || null, 0);
  }
  play(act, dur) { if (this.dead) return; this.action = act; this.actionT = 0; this.actionDur = Math.max(dur, 0.05); }
  stopAction() { this.action = ''; }
  hitReact() { this.inst.hit = 0.6; this._hitT = 0.2; }
  onFire() { this.kick = 1; }
  resetFeet() {}
  setShadow(on) { this.inst.shadow = on; if (this.weaponObj) this.weaponObj.shadow = on; }
  setVisible(on) { this.visible = on; this.inst.setVisible(on); if (this.weaponObj) this.weaponObj.visible = on; }
  setHit(k) { this.inst.hit = k; }
  setWeapon(id) {
    if (this.weaponObj) { this.r.remove(this.weaponObj); this.weaponObj = null; }
    this.weaponId = id || ''; if (!id) return;
    const info = weaponModel(this.r, id); this.winfo = info; this.weaponLen = WEAPON_LEN[id] || 0.9;
    this.weaponObj = this.r.add(new RenderObject(info.mesh.body, 'char'));
  }
  die() { this.dead = true; this.action = ''; if (this.clips.fall) this.inst.play(this.clips.fall, 0.12, 1); this._deadT = 0; }
  handXf() { if (this.hand < 0 || !this.inst.G) return new Xf(this.xf.basis, this.xf.mulV(v(0.25, 1.0, -0.25))); return xfFromM4(this.inst.nodeMatrix(this.hand)); }
  update(dt, xf) {
    this.xf = xf;
    if (this._hitT > 0) { this._hitT -= dt; if (this._hitT <= 0) this.inst.hit = 0; }
    if (this.action) { this.actionT += dt; if (this.actionT >= this.actionDur) this.action = ''; }
    const C = this.clips;
    if (this.dead) {
      this._deadT += dt; if (C.fall && this.inst.time >= C.fall.dur - 0.02) this.inst.speed = 0;
    } else {
      const sp = Math.hypot(this.velocity.x, this.velocity.z);
      let clip = C.idle, speed = 1;
      if (this.action === 'repair' && C.slash) clip = C.slash;
      else if (this.aiming && C.shoot) clip = C.shoot;
      else if (sp > 3.9 && C.run) { clip = C.run; speed = sp / 5; }
      else if (sp > 0.35 && C.walk) { clip = C.walk; speed = Math.max(0.6, sp / 1.6); }
      this.inst.play(clip || null, 0.22, speed);
    }
    this.inst.setXf(xf); this.inst.update(dt);
    if (this.weaponObj) {
      // оружие в правой кисти, ствол — по направлению взгляда персонажа
      const h = this.handXf(), yawB = xf.basis, kick = this.kick; this.kick = Math.max(0, this.kick - dt * 12);
      const s = this.weaponLen / 0.9;
      this.wxf = new Xf(yawB, h.origin.add(yawB.mulV(v(0, 0.02, 0.18 * s + 0.05 * kick))));
      this.weaponObj.setXf(this.wxf);
    }
  }
  muzzleWorld() { if (this.wxf && this.winfo) return this.wxf.mulV(this.winfo.muzzle); return this.xf.mulV(v(0, 1.4, -0.4)); }
  muzzleDir() { return this.xf.basis.mulV(v(0, 0, -1)).norm(); }
  destroy() { this.inst.destroy(); if (this.weaponObj) this.r.remove(this.weaponObj); }
}

// оружие из GLB в руках (если модель есть): процедурные части скрываются, модель ставится по трансформации оружия
export function syncGlbWeapon(holder, assets, gameId, rig, visId) {
  const want = gameId && assets && assets.has(gameId) ? gameId : '';
  if (holder.wglbId !== want) { if (holder.wglb) holder.wglb.destroy(); holder.wglb = want ? assets.instance(want, 'char', { length: WEAPON_LEN[visId] || 0.9, alignLong: true }) : null; holder.wglbId = want; }
  if (!holder.wglb) return;
  if (rig.wparts) for (const k in rig.wparts) if (rig.wparts[k]) rig.wparts[k].visible = false;
  if (rig.weaponObj) rig.weaponObj.visible = false;
  const base = rig.wxf || (rig.weaponXf ? rig.xf.mul(rig.weaponXf) : null); if (!base) { holder.wglb.setVisible(false); return; }
  const L = WEAPON_LEN[visId] || 0.9;
  holder.wglb.setVisible(rig.visible !== false && !rig.dead);
  holder.wglb.setXf(base.mul(new Xf(new M3(), v(0, -0.06, -L * 0.28)))); holder.wglb.update(0);
}

// предмет в руке (молоток/ключ): процедурный меш или модель GLB
export class HandItem {
  constructor(r, assets, id, procMesh) {
    this.r = r; this.glb = assets && assets.instance(id, 'char', { length: id === 'tool_hammer' ? 0.42 : 0.3 }) || null;
    this.obj = this.glb ? null : r.add(new RenderObject(procMesh, 'char'));
  }
  set visible(on) { if (this.glb) this.glb.setVisible(on); else this.obj.visible = on; }
  get visible() { return this.glb ? this.glb.objs.every((o) => o.visible) : this.obj.visible; }
  setXf(xf) { if (this.glb) { this.glb.setXf(xf.mul(new Xf(M3.rx(Math.PI / 2), v(0, 0, 0)))); this.glb.update(0); } else this.obj.setXf(xf); }
  destroy() { if (this.glb) this.glb.destroy(); else this.r.remove(this.obj); }
}
