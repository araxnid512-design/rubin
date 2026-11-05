// «Линия снабжения» — одиночная мобильная военная экономика на трёх секторах 300×300 м. Собственный WebGL2-движок.
// Этапы 1–5: три карты, 30-минутная подготовка, запрет перехода на чужую базу, автономная экономика врага,
// добыча, стройка 4×3, производство. Этапы 6–7а: работа нанятых людей, приказы из штаба, гарнизон бункера,
// волны врага и бой на поле боя, аэроразведка вражеской базы; техника: выкатить из автоцеха, вождение, вооружённые машины.
import { Renderer, RenderObject } from '../engine/renderer.js';
import { V3, M3, Xf, clamp, lerpAngle, angleDiff } from '../engine/math.js';
import { noiseTexture } from '../engine/noise.js';
import { audio } from '../engine/audio.js';
import { Input } from '../game/input.js';
import { FollowCamera } from '../game/follow_camera.js';
import { FX } from '../game/fx.js';
import { HumanRig, B } from '../game/rig_human.js';
import { Campaign, SECTORS } from './sim/campaign.js';
import { WSTAT, SIDX, VISUAL_WEAPON } from './sim/army.js';
import { VEH } from './sim/vehicle_data.js';
import { Sector } from './world/sector.js';
import { UnitsView, VehiclesView } from './world/actors_view.js';
import * as M from './world/models.js';
import { Assets, HandItem, syncGlbWeapon } from './world/assets.js';
import { UI } from './ui.js';

const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const QUALITY = [
  { name: 'Низкое', shadows: false, shadowSize: 1024, shadowDist: 26, scale: 0.65, dpr: 1.25, draw: 110, fps: 30 },
  { name: 'Среднее', shadows: true, shadowSize: 1024, shadowDist: 32, scale: 0.8, dpr: 1.5, draw: 150, fps: 30 },
  { name: 'Высокое', shadows: true, shadowSize: 2048, shadowDist: 44, scale: 1, dpr: 2, draw: 190, fps: 60 },
];
const SKEY = 'supply_line_settings';
const touchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

async function loadData() {
  const get = async (n) => (await fetch(new URL(`./data/${n}.json`, import.meta.url))).json();
  const [world, buildings, items, npcs, enemy_ai] = await Promise.all(['world', 'buildings', 'items', 'npcs', 'enemy_ai'].map(get));
  return { world, buildings, items, npcs, enemy_ai };
}

class Player {
  constructor(app) {
    this.app = app; this.pos = v(); this.yaw = 0; this.vel = v(); this.hidden = false; this.weaponVis = ''; this.aimT = 0;
    this.look = { head: 'cap', capColor: [0.24, 0.27, 0.18], suit: [0.3, 0.33, 0.23], armor: [0.36, 0.38, 0.27], pants: [0.27, 0.29, 0.21], backpack: true, packColor: [0.3, 0.29, 0.2], vestOn: true, headset: true };
    this.toolMeshes = { tool_hammer: app.r.createMesh(M.hammerMesh().data()), tool_wrench: app.r.createMesh(M.wrenchMesh().data()) };
    this.body = { pos: this.pos, radius: 0.32, height: 1.8, layer: 2, mask: 1 | 128, owner: this, solid: true, hittable: false };
  }
  attach(sector) { // новый сектор: новый мир физики и объекты рендера
    this.rig = this.app.assets.character('avatar_player') || new HumanRig(this.app.r, this.look); this.rig.setShadow(true);
    this.tools = {}; for (const id of ['tool_hammer', 'tool_wrench']) this.tools[id] = new HandItem(this.app.r, this.app.assets, id, this.toolMeshes[id]);
    this.toolObj = this.tools.tool_hammer;
    this.weaponVis = ''; this.wglb = null; this.wglbId = '';
    sector.phys.bodies.push(this.body); this.rig.resetFeet();
    this.setTool(this.app.c.selectedTool()); this.setHidden(this.hidden);
  }
  setTool(id) {
    if (!this.rig) return;
    const isTool = !!this.tools[id];
    for (const k in this.tools) this.tools[k].visible = false;
    if (isTool) this.toolObj = this.tools[id];
    this.toolObj.visible = isTool && !this.hidden;
    const wv = VISUAL_WEAPON[id] || '';
    if (wv !== this.weaponVis) { this.weaponVis = wv; this.rig.setWeapon(wv); this.rig.setShadow(true); this.rig.setVisible(!this.hidden); }
  }
  setHidden(on) { this.hidden = on; if (!this.rig) return; this.rig.setVisible(!on); this.toolObj.visible = !on && !!this.tools[this.app.c.selectedTool()]; }
  update(dt, move, run) {
    const s = this.app.sector, T = s.terrain;
    const speed = move.len() > 0.05 ? (run ? 5.2 : 3.6) * Math.min(1, move.len()) * (this.aimT > 0 ? 0.75 : 1) : 0;
    const want = speed > 0 ? move.norm().mul(speed) : v();
    const dv = want.sub(this.vel), md = 20 * dt; this.vel = dv.len() > md ? this.vel.add(dv.norm().mul(md)) : want;
    const x0 = this.pos.x, z0 = this.pos.z, h0 = T.height(x0, z0);
    if (this.vel.lenSq() > 1e-6) s.phys.move(this.body, this.vel.x * dt, this.vel.z * dt);
    // крутой подъём (> ~40°) непроходим
    const dist = Math.hypot(this.pos.x - x0, this.pos.z - z0), h1 = T.height(this.pos.x, this.pos.z);
    if (dist > 1e-4 && (h1 - h0) / dist > 0.85) { this.pos.x = x0; this.pos.z = z0; }
    this.pos.y = T.height(this.pos.x, this.pos.z);
    this.vel = dt > 0 ? v((this.pos.x - x0) / dt, 0, (this.pos.z - z0) / dt) : this.vel;
    if (want.lenSq() > 0.01 && this.aimT <= 0) this.yaw = lerpAngle(this.yaw, Math.atan2(-want.x, -want.z), clamp(12 * dt, 0, 1));
  }
  face(p) { const d = p.sub(this.pos); if (d.x * d.x + d.z * d.z > 0.01) this.yaw = Math.atan2(-d.x, -d.z); }
  updateVisual(dt) {
    if (this.hidden || !this.rig) return;
    this.aimT = Math.max(0, this.aimT - dt);
    this.rig.velocity = v(this.vel.x, 0, this.vel.z);
    this.rig.aiming = this.aimT > 0 && !!this.weaponVis; this.rig.holdState = this.weaponVis ? (this.aimT > 0 ? 'aim' : 'low') : 'idle';
    if (this.aimDir) this.rig.aimDir = this.aimDir;
    const xf = new Xf(M3.ry(this.yaw), this.pos.clone());
    this.rig.update(dt, xf);
    if (this.toolObj.visible) this.toolObj.setXf(this.rig.handXf().mul(new Xf(M3.rx(-1.25), v(0, -0.07, -0.02))));
    const slot = this.app.c.inventory.slots[this.app.c.inventory.selected];
    syncGlbWeapon(this, this.app.assets, slot && slot.id.startsWith('wp_') ? slot.id : '', this.rig, this.weaponVis);
  }
}

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    try { this.r = new Renderer(this.canvas); } catch (e) { document.getElementById('menu-info').textContent = 'Нужен браузер с WebGL2: ' + e.message; return; }
    this.r.noiseTex = this.r.texture(noiseTexture(256, 4, 1337), 256, 256, { format: 'r' });
    this.r.detailTex = this.r.texture(noiseTexture(256, 16, 4242, 3), 256, 256, { format: 'r' });
    this.settings = { quality: touchDevice() ? 1 : 2, showFps: false, volume: 0.8, zoom: touchDevice() ? 0.85 : 1, debugIntel: false };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* без сохранённых настроек */ }
    this.input = new Input(this.canvas); this.cam = new FollowCamera({ drawDistance: 150, cameraZoom: this.settings.zoom }); this.cam.pitchDeg = 55;
    this.playing = false; this.paused = false; this.placing = null; this.stats = { fps: 0, ms: 0 }; this._fa = 0; this._fn = 0; this.saveT = 10; this.edgeMsgT = 0;
    this.recon = null; this.timers = []; this.pFireT = 0; this.pReloadT = 0; this.vehFireT = {}; this.msgT = {};
    this.applySettings();
    addEventListener('pointerdown', () => audio.unlock(), { capture: true });
    addEventListener('keydown', () => audio.unlock(), { capture: true });
    addEventListener('wheel', (e) => { if (!this.playing) return; if (this.placing) { this.rotate(e.deltaY > 0 ? 90 : -90); } else this.cam.setZoom(this.cam.zoom + Math.sign(e.deltaY) * 0.08); }, { passive: true });
    addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    this.ready = this.init();
    requestAnimationFrame((t) => this.frame(t));
  }
  async init() {
    this.data = await loadData();
    this.c = new Campaign(this.data);
    this.assets = new Assets(this.r); await this.assets.load();
    this.ui = new UI(this);
    this.ui.showMenu(!!Campaign.readSave());
    window.__fl = this;
  }
  get army() { return this.c.armySim; }
  applySettings() {
    const q = QUALITY[this.settings.quality], r = this.r;
    r.renderScale = q.scale; r.maxDpr = q.dpr; r.shadowsOn = q.shadows; r.shadowDist = q.shadowDist; r.setShadowSize(q.shadowSize);
    this.cam.settings.drawDistance = q.draw; this.fpsCap = q.fps; audio.setVolume(this.settings.volume);
    try { localStorage.setItem(SKEY, JSON.stringify(this.settings)); } catch (e) { /* приватный режим */ }
    if (this.ui) this.ui.applySettings();
  }
  // ---------------------------------------------------------------- кампания
  async start(fromSave) {
    await this.ready;
    if (this.recon) { this.recon = null; this.c.recon = false; }
    this.c.reset();
    if (fromSave) { const d = Campaign.readSave(); if (!d || !this.c.load(d)) this.ui.toast('Сохранение повреждено или устарело — начата новая кампания.'); }
    else Campaign.clearSave();
    this.c.listeners = [];
    this.c.on((t, d) => this.onCampaign(t, d));
    const veh = this.c.vehicles.find((x) => x.uid === this.c.driving);
    if (veh) { this.c.player.x = veh.x; this.c.player.z = veh.z; }
    this.loadSector(this.c.sector_index, [this.c.player.x, this.c.player.z]);
    this.player.yaw = this.c.player.yaw || 0;
    this.player.setHidden(!!veh);
    this.playing = true; this.paused = false; this.lastT = performance.now();
    this.ui.showGame();
    if (!fromSave) this.ui.toast('Добудьте металлолом молотком на поле справа (восток), затем стройте ключом. Поле боя откроется через 30:00.', 'info', 9);
    audio.setAmbient('amb_wind');
  }
  loadSector(index, xz) {
    const t0 = performance.now();
    if (this.unitsView) this.unitsView.dispose();
    if (this.vehView) this.vehView.dispose();
    if (this.sector) this.sector.dispose();
    this.fx = null;
    this.sector = new Sector(this.r, this.data.world.sectors[index], this.c, this.assets).build();
    if (!this.player) this.player = new Player(this);
    this.player.attach(this.sector);
    this.player.pos.set(xz[0], this.sector.h(xz[0], xz[1]), xz[1]); this.player.vel = v();
    this.fx = new FX(this.r);
    this.unitsView = new UnitsView(this); this.vehView = new VehiclesView(this);
    this.vehBody = { pos: v(), radius: 1, height: 2, layer: 0, mask: 1, owner: null, solid: false, hittable: false };
    const s = this.sector;
    this.army.w = { index, findPath: (ax, az, bx, bz) => s.nav.path(ax, az, bx, bz), lineClear: (ax, az, bx, bz) => s.phys.lineClear(v(ax, s.h(ax, az) + 1.5, az), v(bx, s.h(bx, bz) + 1.3, bz), 1) };
    for (const u of [...this.c.recruits, ...this.c.foes]) u._path = null;
    this.cam.snap();
    this.loadMs = Math.round(performance.now() - t0);
    console.log('[Линия снабжения] сектор', SECTORS[index], 'за', this.loadMs, 'мс', JSON.stringify(Object.fromEntries(Object.entries(s.timings).map(([k, x]) => [k, Math.round(x)]))));
    if (this.ui) this.ui.onSector();
  }
  // Переход между секторами по правилам кампании (аналог _transition_to из стартового проекта)
  transitionTo(dest, spawnXZ) {
    if (this.recon || !this.c.canEnterSector(dest)) return false;
    this.cancelPlacement();
    const veh = this.drivingVeh();
    if (!this.c.transitionTo(dest, spawnXZ)) return false;
    if (veh) { veh.sector = SECTORS[dest]; veh.x = spawnXZ[0]; veh.z = spawnXZ[1]; }
    this.loadSector(dest, spawnXZ);
    this.player.yaw = dest === 1 && spawnXZ[1] > 0 ? 0 : Math.PI;
    if (veh) veh.yaw = this.player.yaw;
    this.save();
    return true;
  }
  onCampaign(type, d) {
    if (!this.ui) return;
    if (type === 'node' && this.sector) this.sector.refreshPiles();
    if (type === 'produced') { this.ui.toast(`Готово: ${this.itemName(d.id)}${d.qty > 1 ? ' ×' + d.qty : ''} — на складе базы.`, 'good'); audio.play('build_done', -8); }
    if (type === 'hired') { this.ui.toast(`Нанят: ${this.roleName(d.role)} №${d.uid}. Приказы — в штабе.`, 'good'); audio.play('ui_ok'); }
    if (type === 'equip' && this.once('equip' + d, 30)) this.ui.toast(`Солдат №${d} получил оружие и патроны со склада.`, 'info', 3);
    if (type === 'destroyed') { if (this.sector) this.sector.removeBuilding(d.uid); this.ui.toast(`Разрушено: ${this.c.bdefs[d.id].name_ru}. Механик может построить заново только вы — ключом.`, 'alert'); }
    if (type === 'veh_destroyed') { this.ui.toast(`Уничтожена машина: ${this.itemName(d.id)}.`, 'alert'); if (!this.c.driving && this.player.hidden) this.player.setHidden(false); }
    if (type === 'wave') { this.ui.toast(`Противник вывел на поле боя отряд: ${d} солд.`, 'alert', 6); audio.play('radio', -10); }
    if (type === 'npc_dead') this.ui.toast(`Погиб: ${this.roleName(d.role)} №${d.uid}.`, 'alert');
  }
  once(key, sec) { const t = performance.now() / 1000; if ((this.msgT[key] || -1e9) + sec > t) return false; this.msgT[key] = t; return true; }
  itemName(id) { const it = this.data.items; for (const k of ['weapons', 'ammunition', 'vehicles', 'tools']) { const f = (it[k] || []).find((x) => x.id === id); if (f) return f.name_ru; } return id === 'scrap_metal' ? 'Металлолом' : id; }
  roleName(id) { return (this.data.npcs.roles.find((r) => r.id === id) || { name_ru: id }).name_ru; }
  save() {
    if (!this.playing || !this.c) return false;
    const p = this.recon ? { x: this.recon.x, z: this.recon.z, yaw: this.recon.yaw } : { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw };
    this.c.player = { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3) };
    return this.c.save();
  }
  // ---------------------------------------------------------------- действия игрока
  nearestPile() {
    let best = null, bd = Infinity; const p = this.player.pos;
    for (const pile of this.sector.piles) { if (!pile.o.visible) continue; const d = Math.max(0, Math.hypot(pile.x - p.x, pile.z - p.z) - pile.radius); if (d < bd) { bd = d; best = pile; } }
    return best ? { pile: best, d: bd } : null;
  }
  nearestBuilding() {
    let best = null, bd = Infinity;
    for (const [, e] of this.sector.buildings) { if (e.rec.enemy) continue; const d = this.sector.distToFootprint(e, this.player.pos); if (d < bd) { bd = d; best = e; } }
    return best && bd <= 3 ? best : null;
  }
  nearestVehicle(maxD = 3.5) {
    let best = null, bd = maxD; const p = this.player.pos;
    for (const veh of this.c.vehicles) { if (veh.sector !== SECTORS[this.c.sector_index]) continue; const d = Math.hypot(veh.x - p.x, veh.z - p.z) - VEH[veh.id].radius; if (d < bd) { bd = d; best = veh; } }
    return best;
  }
  // командный стол штаба: игрок внутри и рядом со столом
  atCommandTable() {
    const e = this.insideEnt; if (!e || e.rec.id !== 'military_headquarters') return false;
    const [x, z] = this.c.fromLocal(e.rec, 0, -1.2);
    return Math.hypot(this.player.pos.x - x, this.player.pos.z - z) < 3.3;
  }
  mine() {
    if (this.c.driving) return this.harvest();
    const np = this.nearestPile(); if (!np) return { ok: false, reason: 'Рядом нет металлолома.' };
    const res = this.c.mine(np.pile.i, np.d);
    if (res.ok) {
      this.player.face(v(np.pile.x, 0, np.pile.z)); this.player.rig.play('repair', 0.42);
      audio.playAt('hammer', v(np.pile.x, np.pile.y + 1, np.pile.z), -2); this.fx.spark(v(np.pile.x, np.pile.y + 0.8, np.pile.z), [1, 0.7, 0.35, 2.5]);
      this.ui.floatText(`+${res.gained}`, v(np.pile.x, np.pile.y + 1.6, np.pile.z));
      if (res.depleted) this.ui.toast('Куча разобрана. Восстановится через 2 минуты.');
      this.sector.refreshPiles();
    } else if (res.reason) { this.ui.toast(res.reason, 'alert'); audio.play('click'); }
    return res;
  }
  harvest() {
    const veh = this.drivingVeh(); if (!veh) return { ok: false };
    let best = null, bd = Infinity;
    for (const pile of this.sector.piles) { if (!pile.o.visible) continue; const d = Math.max(0, Math.hypot(pile.x - veh.x, pile.z - veh.z) - pile.radius - VEH[veh.id].len / 2); if (d < bd) { bd = d; best = pile; } }
    if (!best) return { ok: false, reason: 'Рядом нет металлолома.' };
    const res = this.c.harvest(best.i, bd);
    if (res.ok) { audio.playAt('hammer', v(best.x, best.y + 1, best.z), 0, 0.7); this.fx.spark(v(best.x, best.y + 0.8, best.z), [1, 0.75, 0.3, 3]); this.ui.floatText(`+${res.gained}`, v(best.x, best.y + 2, best.z)); this.sector.refreshPiles(); }
    else if (res.reason) { this.ui.toast(res.reason, 'alert'); audio.play('click'); }
    return res;
  }
  // ---------------------------------------------------------------- техника
  drivingVeh() { return this.c.driving ? this.c.vehicles.find((x) => x.uid === this.c.driving) || null : null; }
  enterVehicle(veh) {
    if (!veh || this.c.driving) return false;
    this.c.driving = veh.uid; veh._spd = 0; this.player.setHidden(true); this.player.pos.set(veh.x, this.sector.h(veh.x, veh.z), veh.z);
    if (veh.sector === 'friendly_home') { const n = this.c.resupplyVehicle(veh); if (n) this.ui.toast(`Боезапас пополнен со склада: ${n}.`, 'info', 3); }
    audio.play('power_on', -6); this.ui.toast(`За рулём: ${this.itemName(veh.id)}. Джойстик — направление движения, «ВЫЙТИ» — выйти.`, 'info', 5);
    this.ui.refreshTool();
    return true;
  }
  exitVehicle() {
    const veh = this.drivingVeh(); if (!veh) return false;
    const d = VEH[veh.id], f = v(-Math.sin(veh.yaw), 0, -Math.cos(veh.yaw)), r = v(-f.z, 0, f.x);
    let spot = null;
    for (const side of [1, -1]) { const p = v(veh.x + r.x * side * (d.wid / 2 + 1.1), 0, veh.z + r.z * side * (d.wid / 2 + 1.1)); if (this.sector.nav.walkableAt(p)) { spot = p; break; } }
    if (!spot) { const back = v(veh.x - f.x * (d.len / 2 + 1.2), 0, veh.z - f.z * (d.len / 2 + 1.2)); spot = this.sector.nav.walkableAt(back) ? back : v(veh.x + r.x * 2.5, 0, veh.z + r.z * 2.5); }
    this.c.driving = 0; veh._spd = 0; veh._aimYaw = null;
    this.player.pos.set(spot.x, this.sector.h(spot.x, spot.z), spot.z); this.player.setHidden(false); this.player.vel = v();
    this.ui.refreshTool();
    return true;
  }
  driveStep(dt, mx, mz, run) {
    const veh = this.drivingVeh(); if (!veh) return;
    const d = VEH[veh.id], S = this.sector, want = Math.min(1, Math.hypot(mx, mz));
    veh._spd = veh._spd || 0;
    if (want > 0.12) {
      // направление джойстика — куда ехать: машина разворачивается дугой и разгоняется
      const ty = Math.atan2(-mx, -mz), diff = angleDiff(veh.yaw, ty);
      const turn = d.turn * clamp(Math.abs(veh._spd) / 4 + 0.35, 0, 1) * dt; veh.yaw += clamp(diff, -turn, turn);
      const target = d.speed * want * (run ? 1 : 0.8) * Math.max(0.25, Math.cos(diff));
      veh._spd += clamp(target - veh._spd, -d.accel * 1.6 * dt, d.accel * dt);
    } else veh._spd += clamp(-veh._spd, -d.accel * 2 * dt, d.accel * 2 * dt);
    const f = v(-Math.sin(veh.yaw), 0, -Math.cos(veh.yaw)), x0 = veh.x, z0 = veh.z, step = veh._spd * dt;
    const body = this.vehBody; body.radius = d.radius; body.pos.set(veh.x, 0, veh.z);
    if (Math.abs(step) > 1e-5) S.phys.move(body, f.x * step, f.z * step);
    const moved = Math.hypot(body.pos.x - x0, body.pos.z - z0), rise = S.h(body.pos.x, body.pos.z) - S.h(x0, z0);
    if (moved > 1e-4 && rise / moved > 0.7) { body.pos.x = x0; body.pos.z = z0; veh._spd *= 0.3; }
    else if (moved < Math.abs(step) * 0.5) veh._spd *= 0.6;
    veh.x = clamp(body.pos.x, -149, 149); veh.z = clamp(body.pos.z, -149, 149);
    this.player.pos.set(veh.x, S.h(veh.x, veh.z), veh.z); this.player.vel = v(f.x * veh._spd, 0, f.z * veh._spd); this.player.yaw = veh.yaw;
    if (veh.sector === 'friendly_home' && Math.abs(veh._spd) < 0.5 && this.nearestBuilding() && this.once('resup' + veh.uid, 8)) { const n = this.c.resupplyVehicle(veh); if (n) this.ui.toast(`Боезапас пополнен: ${n}.`, 'info', 3); }
  }
  // орудие машины: стрелок бьёт по ближайшему врагу в зоне досягаемости, патроны — из боезапаса машины
  vehicleGuns(dt, fireHeld) {
    const veh = this.drivingVeh(); if (!veh) return;
    const guns = VEH[veh.id].guns || []; if (!guns.length) return;
    const P = { uid: veh.uid, side: 'friendly', sector: veh.sector, x: veh.x, z: veh.z, moving: Math.abs(veh._spd || 0) > 1 };
    let best = null, bd = 1e9;
    for (const f of this.c.foes) if (f.sector === veh.sector && f.hp > 0) { const dd = Math.hypot(f.x - veh.x, f.z - veh.z); if (dd < bd && this.army.visible(P, f)) { bd = dd; best = f; } }
    veh._aimYaw = best ? Math.atan2(-(best.x - veh.x), -(best.z - veh.z)) : null;
    guns.forEach((g, k) => {
      const ws = WSTAT[g.kind], key = veh.uid + ':' + k; this.vehFireT[key] = (this.vehFireT[key] || 0) - dt;
      if (!best || bd > ws.range || !(veh.ammo[g.ammo] > 0) || this.vehFireT[key] > 0) return;
      veh.ammo[g.ammo]--; const b = (this.vehFireT['b' + key] || 0) + 1; this.vehFireT['b' + key] = b >= ws.burst ? 0 : b;
      this.vehFireT[key] = b >= ws.burst ? ws.rate + 0.5 : ws.rate;
      this.army.shoot(P, best, ws);
    });
  }
  // ---------------------------------------------------------------- оружие игрока (взято со склада)
  playerSlot() { const s = this.c.inventory.slots[this.c.inventory.selected]; return s && s.id.startsWith('wp_') ? s : null; }
  playerCombat(dt, fireHeld, firePressed) {
    const slot = this.playerSlot(); this.pFireT -= dt;
    if (!slot || this.c.driving) return;
    const w = this.army.wdef(slot.id);
    const P = this.army.playerUnit(); if (!P) return;
    if (w.class === 'throwable') { if (firePressed) this.throwGrenade(slot); return; }
    const ws = WSTAT[w.class];
    if (this.pReloadT > 0) { this.pReloadT -= dt; if (this.pReloadT <= 0) { const n = Math.min(w.magazine - slot.mag, slot.ammo); slot.mag += n; slot.ammo -= n; } return; }
    let tgt = null, bd = ws.range;
    for (const f of this.c.foes) if (f.sector === P.sector && f.hp > 0) { const d = Math.hypot(f.x - P.x, f.z - P.z); if (d < bd && this.army.visible(P, f)) { bd = d; tgt = f; } }
    if (tgt) { this.player.aimDir = v(tgt.x - P.x, 0, tgt.z - P.z).norm(); }
    if (!fireHeld) return;
    if (slot.mag <= 0) { if (slot.ammo > 0) this.reloadPlayer(); else if (this.once('noammo', 3)) this.ui.toast('Нет патронов. Возьмите на складе базы.', 'alert'); return; }
    if (this.pFireT > 0) return;
    slot.mag--; this.pFireT = ws.burst > 1 ? ws.rate : ws.rate * 0.8; this.pShots = (this.pShots || 0) + 1;
    this.player.aimT = 1.2;
    if (tgt) { this.player.face(v(tgt.x, 0, tgt.z)); this.army.shoot(P, tgt, ws); }
    else {
      const f = v(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)), d = ws.range * 0.7;
      this.army.emit({ type: 'shot', sector: this.c.sector_index, uid: 'player', sound: ws.sound, x: P.x, z: P.z, tx: P.x + f.x * d, tz: P.z + f.z * d, hit: false });
      if (this.c.army.shots) this.c.army.shots.friendly++; // выстрел без цели — патрон всё равно потрачен
    }
    this.player.rig.onFire();
  }
  reloadPlayer() {
    const slot = this.playerSlot(); if (!slot || this.pReloadT > 0) return;
    const w = this.army.wdef(slot.id); if (w.class === 'throwable' || slot.mag >= w.magazine || slot.ammo <= 0) return;
    const ws = WSTAT[w.class]; this.pReloadT = ws.reload; this.player.rig.play('reload', ws.reload); audio.play('reload', -4);
  }
  throwGrenade(slot) {
    if (this.pFireT > 0 || !(slot.count > 0)) return;
    const P = this.army.playerUnit(); if (!P) return;
    let tgt = null, bd = 18;
    for (const f of this.c.foes) if (f.sector === P.sector && f.hp > 0) { const d = Math.hypot(f.x - P.x, f.z - P.z); if (d < bd) { bd = d; tgt = f; } }
    const fw = v(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)), tx = tgt ? tgt.x : P.x + fw.x * 14, tz = tgt ? tgt.z : P.z + fw.z * 14;
    if (tgt) this.player.face(v(tx, 0, tz));
    slot.count--; if (slot.count <= 0) { this.c.inventory.slots[this.c.inventory.selected] = null; this.c.select(0); this.ui.refreshTool(); }
    this.pFireT = 1.2; this.player.rig.play('throw', 0.8); audio.play('click');
    this.timers.push({ t: 1.0, fn: () => this.army.blast(P, tx, tz, 80, 5, 'grenade') });
  }
  playerDown() {
    this.ui.toast('Вы тяжело ранены — эвакуация на базу.', 'alert', 6);
    if (this.c.driving) { const veh = this.drivingVeh(); this.c.driving = 0; if (veh) veh._spd = 0; }
    this.c.playerHp = 60;
    const sp = this.data.world.sectors[0].player_spawn_xz;
    if (this.c.sector_index === 1) { this.c.sector_index = 0; this.c.player.x = sp[0]; this.c.player.z = sp[1]; this.loadSector(0, sp); }
    else this.player.pos.set(sp[0], this.sector.h(sp[0], sp[1]), sp[1]);
    this.player.setHidden(false); this.save();
  }
  // ---------------------------------------------------------------- аэроразведка вражеской базы (№3) из штаба
  // Игрок остаётся на своём секторе: показывается только картинка №3 по сохранённому состоянию ИИ врага.
  enterRecon() {
    if (this.recon || !this.c.buildings.some((b) => b.id === 'military_headquarters')) return false;
    this.cancelPlacement(); this.ui.close();
    this.recon = { index: this.c.sector_index, x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw };
    this.save(); this.c.recon = true;
    const E = this.c.enemy, bar = E.structures.find((s) => s.id === 'military_barracks');
    this.loadSector(2, bar ? bar.position_xz : [-60, 40]);
    this.player.setHidden(true); this.player.body.solid = false;
    this.reconUnits = this.makeReconUnits(); this.reconVehicles = this.makeReconVehicles();
    this.cam.setZoom(1.5); this.ui.onRecon(true);
    return true;
  }
  exitRecon() {
    const r = this.recon; if (!r) return;
    this.recon = null; this.c.recon = false; this.reconUnits = []; this.reconVehicles = [];
    this.player.body.solid = true;
    this.loadSector(r.index, [r.x, r.z]); this.player.yaw = r.yaw; this.player.setHidden(!!this.c.driving);
    this.cam.setZoom(this.settings.zoom); this.ui.onRecon(false);
  }
  makeReconUnits() {
    const E = this.c.enemy, lots = this.sector.enemyLots || [], out = [], deployed = new Set(this.c.army.deployed);
    const bar = lots.find((s) => s.id === 'military_barracks'), home = bar ? this.c.doorPoint(bar, 3) : [-60, 40];
    const mk = (role, k, extra = {}) => ({ uid: 'R' + k, side: 'enemy', role, sector: 'enemy_home', x: home[0] + (k % 4) * 1.4 - 2, z: home[1] + Math.floor(k / 4) * 1.4, yaw: 0, hp: 100, st: 'idle', t: 0, node: k % 12, ...extra });
    out.push(mk('npc_scrap_worker', 0, { job: 'mine' })); // инженер-первопроходец
    let k = 1;
    for (const r of E.recruits) {
      if (r.role_id === 'npc_infantry' && deployed.has(r.id)) continue;
      const u = mk(r.role_id, k++, { job: r.role_id === 'npc_scrap_worker' ? 'mine' : r.role_id === 'npc_mechanic' ? 'tend' : 'guard' });
      if (r.role_id === 'npc_infantry') { const M2 = E.manufactured; u.weapon = (M2.wp_assault_a47 > 0 ? 'wp_assault_a47' : M2.wp_rifle_v7 > 0 ? 'wp_rifle_v7' : null); }
      out.push(u);
    }
    return out;
  }
  makeReconVehicles() {
    const lots = this.sector.enemyLots || [], gar = lots.find((s) => s.id === 'vehicle_light_garage'), out = [];
    if (!gar) return out;
    const n = Math.min(6, this.c.enemy.manufactured.veh_utility_car || 0);
    for (let i = 0; i < n; i++) { const [x, z] = this.c.fromLocal(gar, -6 + i * 2.6, 10); out.push({ uid: 'RV' + i, id: 'veh_utility_car', sector: 'enemy_home', x, z, yaw: -gar.angle * Math.PI / 180, hp: 1, maxHp: 1, enemy: true }); }
    return out;
  }
  reconStep(dt) {
    const lots = this.sector.enemyLots || [], A = this.army;
    const bar = lots.find((s) => s.id === 'military_barracks'), home = bar ? this.c.doorPoint(bar, 2.5) : [-60, 40];
    lots.forEach((b, i) => { b._door = b._door || this.c.doorPoint(b, 2.5); });
    for (const u of this.reconUnits) {
      if (u.job === 'mine') {
        const [nx, nz] = this.c.nodeXZ(2, u.node);
        if (u.st !== 'back') { if (A._moveTo(u, nx + 1.6, nz, dt, 3)) { u.st = 'work'; u.t += dt; A.face(u, nx, nz); if (u.t > 4) { u.t = 0; u.cnt = (u.cnt || 0) + 1; if (u.cnt >= 4) { u.cnt = 0; u.st = 'back'; } } } else u.st = 'move'; }
        else if (A._moveTo(u, home[0], home[1], dt, 3)) { u.st = 'move'; u.node = (u.node + 5) % 12; }
      } else if (u.job === 'tend') {
        const b = lots[(u.k = u.k ?? 0) % Math.max(1, lots.length)]; if (!b) continue;
        if (A._moveTo(u, b._door[0], b._door[1], dt, 3)) { u.st = 'work'; u.t += dt; if (u.t > 6) { u.t = 0; u.k++; } } else u.st = 'move';
      } else { u.st = 'idle'; A._moveTo(u, home[0] + Math.sin(+u.uid.slice(1)) * 5, home[1] + 4 + Math.cos(+u.uid.slice(1)) * 3, dt, 2); }
    }
    // камера: свободный обзор (джойстик/WASD), без персонажа
    const inp = this.input, km = inp.keyMove(), tm = inp.touch.move;
    const mx = Math.abs(tm[0]) + Math.abs(tm[1]) > 0 ? tm[0] : km[0], mz = Math.abs(tm[0]) + Math.abs(tm[1]) > 0 ? tm[1] : km[1];
    const p = this.player.pos; p.x = clamp(p.x + mx * 32 * dt, -140, 140); p.z = clamp(p.z + mz * 32 * dt, -140, 140); p.y = this.sector.h(p.x, p.z);
    this.player.vel = v(mx * 32, 0, mz * 32);
  }
  // ---------------------------------------------------------------- размещение здания
  startPlacement(id) {
    if (this.recon) return false;
    const why = this.c.canBuildHere(id); if (why) { this.ui.toast(why, 'alert'); return false; }
    const b = this.c.bdefs[id];
    if (this.c.scrap < b.build_scrap_cost) { this.ui.toast(`Не хватает металлолома: нужно ${b.build_scrap_cost}, есть ${this.c.scrap}.`, 'alert'); return false; }
    const m = M.buildingModel(id, ...b.footprint_m), objs = [];
    for (const mb of [m.shell, m.roof]) if (mb) { const o = this.r.add(new RenderObject(this.r.createMesh(mb.data()), 'ghost')); o.shadow = false; o.cutout = false; objs.push(o); }
    const f = this.player.pos.add(v(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw)).mul(Math.max(...b.footprint_m) * 0.6 + 3));
    this.placing = { id, objs, x: Math.round(f.x * 2) / 2, z: Math.round(f.z * 2) / 2, angle: 0, why: '', busy: false };
    this.updateGhost(); this.ui.onPlacement(true);
    return true;
  }
  moveGhostTo(sx, sy) {
    if (!this.placing) return;
    const ray = this.cam.ray(sx, sy, innerWidth, innerHeight), hit = this.sector.terrain.raycast(ray.o, ray.d);
    if (!hit) return;
    this.placing.x = Math.round(clamp(hit.x, -146, 146) * 2) / 2; this.placing.z = Math.round(clamp(hit.z, -146, 146) * 2) / 2; this.updateGhost();
  }
  rotate(d) { if (!this.placing) return; this.placing.angle = (this.placing.angle + d + 360) % 360; audio.play('ui', -10); this.updateGhost(); }
  updateGhost() {
    const p = this.placing; if (!p) return;
    p.why = this.sector.validate(p.id, p.x, p.z, p.angle) || this.c.canBuildHere(p.id) || (this.c.scrap < this.c.bdefs[p.id].build_scrap_cost ? 'Не хватает металлолома.' : '');
    if (!p.why) { const [fw, fd] = this.c.bdefs[p.id].footprint_m, yaw = -p.angle * Math.PI / 180; for (const u of [...this.c.recruits, ...this.c.foes]) if (u.sector === SECTORS[this.c.sector_index]) { const c = Math.cos(yaw), s = Math.sin(yaw), dx = u.x - p.x, dz = u.z - p.z; if (Math.abs(dx * c - dz * s) < fw / 2 + 0.5 && Math.abs(dx * s + dz * c) < fd / 2 + 0.5) { p.why = 'На площадке стоят люди.'; break; } } }
    const yaw = -p.angle * Math.PI / 180, [fw, fd] = this.c.bdefs[p.id].footprint_m;
    const hs = this.sector.cornerSamples(p.x, p.z, fw, fd, yaw).map(([x, z]) => this.sector.h(x, z)), y = hs.reduce((a, b) => a + b, 0) / hs.length;
    for (const o of p.objs) { o.setXf(new Xf(M3.ry(yaw), v(p.x, y + 0.05, p.z))); o.tint = p.why ? [0.95, 0.18, 0.12] : [0.25, 0.95, 0.35]; }
    this.ui.onPlacement(true);
  }
  confirmPlacement() {
    const p = this.placing; if (!p || p.busy) return null;
    p.busy = true; // защита от двойного нажатия
    this.updateGhost();
    const why = p.why && p.why !== 'Не хватает металлолома.' ? p.why : this.sector.validate(p.id, p.x, p.z, p.angle);
    const res = this.c.build(p.id, p.x, p.z, p.angle, !why);
    if (!res.ok) { p.busy = false; this.ui.toast(why || res.reason, 'alert'); audio.play('click'); return res; }
    this.cancelPlacement();
    this.sector.addBuilding(res.rec);
    for (const u of this.c.recruits) u._path = null;
    this.player.rig.play('repair', 1.2); audio.play('build_done');
    this.ui.toast(`Построено: ${this.c.bdefs[res.rec.id].name_ru}. Подойдите и нажмите «ИСПОЛЬЗОВАТЬ».`, 'good');
    this.save();
    return res;
  }
  cancelPlacement() { if (!this.placing) return; for (const o of this.placing.objs) this.r.remove(o); this.placing = null; if (this.ui) this.ui.onPlacement(false); }
  // ---------------------------------------------------------------- кадр
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    if (!this.playing || !this.sector) { this.input.endFrame(); return; }
    if (this.fpsCap < 60 && t - (this._last || 0) < 1000 / 30 - 4) return;
    const dt = Math.min(0.1, (t - (this.lastT || t)) / 1000); this.lastT = t; this._last = t;
    const t0 = performance.now();
    this.ui.keys();
    if (!this.paused) this.step(dt);
    if (this.debugView) { this.cam.pos = this.debugView.pos; this.cam.target = this.debugView.target; this.cam.focus = this.debugView.target; this.cam.far = 900; }
    else this.cam.follow(this.player.pos, this.player.vel, dt);
    this.cam.update(this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight)); this.r.setCamera(this.cam);
    const vdt = this.paused ? 0 : dt;
    this.player.updateVisual(vdt);
    const idx = this.sector.index;
    this.unitsView.sync(vdt, this.recon ? this.reconUnits : [...this.c.recruits, ...this.c.foes], idx, this.cam);
    this.vehView.sync(vdt, this.recon ? this.reconVehicles : this.c.vehicles, idx);
    if (this.fx) this.fx.update(dt);
    audio.setListener(this.player.pos, this.cam.right);
    this.r.render(this.cam);
    this.ui.update(dt);
    this.input.endFrame();
    this._fa += dt; this._fn++; if (this._fa >= 0.5) { this.stats.fps = this._fn / this._fa; this._fa = 0; this._fn = 0; }
    this.stats.ms = performance.now() - t0; this.stats.dc = this.r.stats.drawCalls; this.stats.tris = this.r.stats.tris;
  }
  step(dt) {
    const c = this.c, inp = this.input;
    if (!this.recon) { c.player.x = this.player.pos.x; c.player.z = this.player.pos.z; c.player.yaw = this.player.yaw; }
    c.advance(dt);
    for (let k = this.timers.length - 1; k >= 0; k--) { const tm = this.timers[k]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(k, 1); tm.fn(); } }
    if (this.recon) { this.reconStep(dt); this.events(); return; }
    const km = inp.keyMove(), tm = inp.touch.move;
    let mx = km[0], mz = km[1];
    if (Math.hypot(tm[0], tm[1]) > Math.hypot(mx, mz)) { mx = tm[0]; mz = tm[1]; }
    const auto = this.autoWalk ? this.autoWalk.sub(this.player.pos) : null;
    if (auto) { const l = Math.hypot(auto.x, auto.z); if (l > 0.6) { mx = auto.x / l; mz = auto.z / l; } else { mx = 0; mz = 0; } }
    const run = inp.held('sprint') || Math.hypot(tm[0], tm[1]) > 0.93;
    const fireHeld = !this.placing && (inp.touch.fire || inp.down.has('Space') || (inp.mouse.left && !this.ui.win && this.playerSlot() && !this.c.driving)), firePressed = !this.placing && (inp.edges.has('Space') || inp.touch.firePressed);
    inp.touch.firePressed = false;
    if (this.c.driving) { this.driveStep(dt, mx, mz, run); this.vehicleGuns(dt, fireHeld); }
    else { this.player.update(dt, v(mx, 0, mz), run); this.playerCombat(dt, fireHeld, firePressed); }
    if (!this.placing && inp.edges.has('KeyR')) this.reloadPlayer();
    this.checkEdges(mz);
    this.insideEnt = this.sector.updateRoofs(this.player.pos);
    c.playerInBunker = this.insideEnt && this.insideEnt.rec.id === 'military_bunker' ? this.insideEnt.rec.uid : 0;
    // люди загруженного сектора не стоят друг в друге
    const here = SECTORS[this.sector.index];
    this.army.separate([...c.recruits, ...c.foes].filter((u) => u.sector === here && !u.inBunker));
    this.events();
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 10; this.save(); }
    this.edgeMsgT -= dt;
  }
  // события симуляции → эффекты, звук, сообщения (только для загруженного сектора)
  events() {
    const A = this.army, idx = this.sector.index, S = this.sector;
    for (const e of A.events) {
      if (e.type === 'player_down') { this.playerDown(); continue; }
      if (e.type === 'death' && e.sector === idx) this.unitsView.onDeath(e.uid);
      if (e.sector !== idx || this.recon) continue;
      const near = !e.x || Math.hypot(e.x - this.player.pos.x, e.z - this.player.pos.z) < 90;
      if (e.type === 'shot' && near) {
        let m = e.uid === 'player' ? (this.player.rig ? { pos: this.player.rig.muzzleWorld(), dir: this.player.rig.muzzleDir() } : null) : this.unitsView.muzzle(e.uid) || this.vehView.muzzle(e.uid);
        const from = m ? m.pos : v(e.x, S.h(e.x, e.z) + 1.4, e.z), to = v(e.tx, S.h(e.tx, e.tz) + 1.15, e.tz);
        if (!e.launcher) this.fx.tracer(from, to);
        this.fx.muzzleFlash(from, m ? m.dir : to.sub(from).norm());
        audio.playAt(e.sound, from, -4);
        if (e.hit) this.fx.blood(to, from.sub(to).norm());
      } else if (e.type === 'explosion') { const p = v(e.x, S.h(e.x, e.z) + 0.3, e.z); this.fx.explosion(p); audio.playAt('explosion', p, 0); }
      else if (e.type === 'hit') { this.unitsView.hit(e.uid); if (e.player) { this.ui.hurt(); if (navigator.vibrate) try { navigator.vibrate(40); } catch (_) { /* нет вибрации */ } } }
      else if ((e.type === 'mine' || e.type === 'repair') && near) { const p = v(e.x, S.h(e.x, e.z) + 0.8, e.z); audio.playAt('hammer', p, -8); this.fx.spark(p, [1, 0.7, 0.35, 2.5]); }
      else if (e.type === 'deliver' && near) this.ui.floatText(`+${e.g}`, v(e.x, S.h(e.x, e.z) + 2, e.z));
      else if (e.type === 'reload' && near) audio.playAt('reload', v(e.x || this.player.pos.x, this.player.pos.y + 1, e.z || this.player.pos.z), -12);
    }
    A.events.length = 0;
  }
  // Границы сектора: переходы только по правилам; запертый край отталкивает назад
  checkEdges(mz) {
    const p = this.player.pos, i = this.c.sector_index, b = this.data.world.boundary_trigger_m, veh = this.drivingVeh();
    const push = (z) => { p.z = z; this.player.vel.z = 0; if (veh) { veh.z = z; veh._spd = 0; } };
    if (p.z <= -b) {
      if (i === 0 && this.c.canEnterSector(1)) { this.transitionTo(1, [p.x, 141]); return; }
      push(-b + 2.5);
      if (this.edgeMsgT <= 0) { this.edgeMsgT = 2.5; this.ui.toast(i === 0 ? `Поле боя закрыто: подготовка ещё ${UI.mmss(this.c.prepLeft())}.` : 'НЕТ ДОСТУПА: вражеская территория.', 'alert'); audio.play('click'); }
    } else if (p.z >= b) {
      if (i === 1) { this.transitionTo(0, [p.x, -141]); return; }
      push(b - 2.5);
      if (this.edgeMsgT <= 0) { this.edgeMsgT = 2.5; this.ui.toast('Тыл: дальше дороги нет.'); }
    }
  }
}

const app = new App();
window.__flApp = app; window.V3 = V3;
