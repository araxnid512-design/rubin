// «Линия снабжения» — одиночная мобильная военная экономика на трёх секторах 300×300 м. Собственный WebGL2-движок.
// Этапы 1–4 постановки: три карты, 30-минутная подготовка, запрет перехода на чужую базу, автономная экономика врага,
// добыча металлолома молотком, стройка гаечным ключом (меню 4×3, призрак, поворот, подтверждение), производство по рецептам.
import { Renderer, RenderObject } from '../engine/renderer.js';
import { V3, M3, Xf, clamp, lerpAngle } from '../engine/math.js';
import { noiseTexture } from '../engine/noise.js';
import { audio } from '../engine/audio.js';
import { Input } from '../game/input.js';
import { FollowCamera } from '../game/follow_camera.js';
import { FX } from '../game/fx.js';
import { HumanRig, B } from '../game/rig_human.js';
import { Campaign, SECTORS } from './sim/campaign.js';
import { Sector } from './world/sector.js';
import * as M from './world/models.js';
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
    this.app = app; this.pos = v(); this.yaw = 0; this.vel = v();
    this.look = { head: 'cap', capColor: [0.24, 0.27, 0.18], suit: [0.3, 0.33, 0.23], armor: [0.36, 0.38, 0.27], pants: [0.27, 0.29, 0.21], backpack: true, packColor: [0.3, 0.29, 0.2], vestOn: true, headset: false };
    this.tools = { tool_hammer: app.r.createMesh(M.hammerMesh().data()), tool_wrench: app.r.createMesh(M.wrenchMesh().data()) };
    this.body = { pos: this.pos, radius: 0.32, height: 1.8, layer: 2, mask: 1 | 128, owner: this, solid: true, hittable: false };
  }
  attach(sector) { // новый сектор: новый мир физики и объекты рендера
    this.rig = new HumanRig(this.app.r, this.look); this.rig.setShadow(true);
    this.toolObj = this.app.r.add(new RenderObject(this.tools[this.app.c.selectedTool()] || this.tools.tool_hammer, 'char'));
    sector.phys.bodies.push(this.body); this.rig.resetFeet();
  }
  setTool(id) { this.toolObj.mesh = this.tools[id] || this.tools.tool_hammer; }
  update(dt, move, run) {
    const s = this.app.sector, T = s.terrain;
    const speed = move.len() > 0.05 ? (run ? 5.2 : 3.6) * Math.min(1, move.len()) : 0;
    const want = speed > 0 ? move.norm().mul(speed) : v();
    const dv = want.sub(this.vel), md = 20 * dt; this.vel = dv.len() > md ? this.vel.add(dv.norm().mul(md)) : want;
    const x0 = this.pos.x, z0 = this.pos.z, h0 = T.height(x0, z0);
    if (this.vel.lenSq() > 1e-6) s.phys.move(this.body, this.vel.x * dt, this.vel.z * dt);
    // крутой подъём (> ~40°) непроходим
    const dist = Math.hypot(this.pos.x - x0, this.pos.z - z0), h1 = T.height(this.pos.x, this.pos.z);
    if (dist > 1e-4 && (h1 - h0) / dist > 0.85) { this.pos.x = x0; this.pos.z = z0; }
    this.pos.y = T.height(this.pos.x, this.pos.z);
    this.vel = dt > 0 ? v((this.pos.x - x0) / dt, 0, (this.pos.z - z0) / dt) : this.vel;
    if (want.lenSq() > 0.01) this.yaw = lerpAngle(this.yaw, Math.atan2(-want.x, -want.z), clamp(12 * dt, 0, 1));
  }
  face(p) { const d = p.sub(this.pos); if (d.x * d.x + d.z * d.z > 0.01) this.yaw = Math.atan2(-d.x, -d.z); }
  updateVisual(dt) {
    this.rig.velocity = v(this.vel.x, 0, this.vel.z); this.rig.holdState = 'idle';
    const xf = new Xf(M3.ry(this.yaw), this.pos.clone());
    this.rig.update(dt, xf);
    const g = this.rig.g[B.HAND_R], o = this.rig.O[B.HAND_R];
    this.toolObj.setXf(xf.mul(new Xf(g, o)).mul(new Xf(M3.rx(-1.25), v(0, -0.07, -0.02))));
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
    this.ui = new UI(this);
    this.ui.showMenu(!!Campaign.readSave());
    window.__fl = this;
  }
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
    this.c.reset();
    if (fromSave) { const d = Campaign.readSave(); if (!d || !this.c.load(d)) this.ui.toast('Сохранение повреждено или устарело — начата новая кампания.'); }
    else Campaign.clearSave();
    this.c.listeners = [];
    this.c.on((t, d) => this.onCampaign(t, d));
    this.loadSector(this.c.sector_index, [this.c.player.x, this.c.player.z]);
    this.player.yaw = this.c.player.yaw || 0;
    this.playing = true; this.paused = false; this.lastT = performance.now();
    this.ui.showGame();
    if (!fromSave) this.ui.toast('Добудьте металлолом молотком на поле справа (восток), затем стройте ключом. Поле боя откроется через 30:00.', 'info', 9);
    audio.setAmbient('amb_wind');
  }
  loadSector(index, xz) {
    const t0 = performance.now();
    if (this.sector) this.sector.dispose();
    this.fx = null;
    this.sector = new Sector(this.r, this.data.world.sectors[index], this.c).build();
    if (!this.player) this.player = new Player(this);
    this.player.attach(this.sector);
    this.player.pos.set(xz[0], this.sector.h(xz[0], xz[1]), xz[1]); this.player.vel = v();
    this.fx = new FX(this.r);
    this.npcs = [];
    this.spawnRecruits();
    this.cam.snap();
    this.loadMs = Math.round(performance.now() - t0);
    console.log('[Линия снабжения] сектор', SECTORS[index], 'за', this.loadMs, 'мс', JSON.stringify(this.sector.timings));
    if (this.ui) this.ui.onSector();
  }
  // Переход между секторами по правилам кампании (аналог _transition_to из стартового проекта)
  transitionTo(dest, spawnXZ) {
    if (!this.c.canEnterSector(dest)) return false;
    this.cancelPlacement();
    if (!this.c.transitionTo(dest, spawnXZ)) return false;
    this.loadSector(dest, spawnXZ);
    this.player.yaw = dest === 1 && spawnXZ[1] > 0 ? 0 : Math.PI;
    this.save();
    return true;
  }
  onCampaign(type, d) {
    if (!this.ui) return;
    if (type === 'node' && this.sector) this.sector.refreshPiles();
    if (type === 'produced') { this.ui.toast(`Готово: ${this.itemName(d.id)}${d.qty > 1 ? ' ×' + d.qty : ''} — на складе базы.`, 'good'); audio.play('build_done', -8); }
    if (type === 'hired') { this.ui.toast(`Нанят: ${this.roleName(d.role)}.`, 'good'); audio.play('ui_ok'); this.spawnRecruits(); }
  }
  itemName(id) { const it = this.data.items; for (const k of ['weapons', 'ammunition', 'vehicles', 'tools']) { const f = (it[k] || []).find((x) => x.id === id); if (f) return f.name_ru; } return id === 'scrap_metal' ? 'Металлолом' : id; }
  roleName(id) { return (this.data.npcs.roles.find((r) => r.id === id) || { name_ru: id }).name_ru; }
  // нанятые NPC стоят у казармы (их работа — следующий этап)
  spawnRecruits() {
    for (const n of this.npcs || []) n.rig.destroy();
    this.npcs = [];
    if (this.c.sector_index !== 0) return;
    const bar = [...this.sector.buildings.values()].find((e) => e.rec.id === 'military_barracks');
    if (!bar) return;
    const looks = { npc_scrap_worker: { head: 'hood', hoodColor: [0.75, 0.42, 0.12], suit: [0.42, 0.36, 0.26], armor: [0.8, 0.45, 0.1] }, npc_mechanic: { head: 'cap', capColor: [0.2, 0.28, 0.45], suit: [0.22, 0.3, 0.45], armor: [0.3, 0.35, 0.42], toolbag: true }, npc_infantry: { head: 'helmet', suit: [0.3, 0.33, 0.23], armor: [0.34, 0.37, 0.26], backpack: true } };
    this.c.recruits.forEach((r, i) => {
      const lx = -3.5 + (i % 4) * 2.3, lz = bar.fd / 2 + 3 + Math.floor(i / 4) * 2.2, p = bar.xf.mulV(v(lx, 0, lz));
      const rig = new HumanRig(this.r, looks[r.role] || {}); rig.setShadow(true); rig.holdState = 'idle';
      this.npcs.push({ rig, pos: v(p.x, this.sector.h(p.x, p.z), p.z), yaw: Math.PI - bar.yaw, role: r.role });
    });
  }
  save() { if (this.playing && this.c) { this.c.player = { x: +this.player.pos.x.toFixed(2), z: +this.player.pos.z.toFixed(2), yaw: +this.player.yaw.toFixed(3) }; return this.c.save(); } return false; }
  // ---------------------------------------------------------------- действия игрока
  nearestPile() {
    let best = null, bd = Infinity; const p = this.player.pos;
    for (const pile of this.sector.piles) { if (!pile.o.visible) continue; const d = Math.max(0, Math.hypot(pile.x - p.x, pile.z - p.z) - pile.radius); if (d < bd) { bd = d; best = pile; } }
    return best ? { pile: best, d: bd } : null;
  }
  nearestBuilding() {
    let best = null, bd = Infinity;
    for (const [, e] of this.sector.buildings) { const d = this.sector.distToFootprint(e, this.player.pos); if (d < bd) { bd = d; best = e; } }
    return best && bd <= 3 ? best : null;
  }
  mine() {
    const np = this.nearestPile(); if (!np) return { ok: false, reason: 'Рядом нет металлолома.' };
    const res = this.c.mine(np.pile.i, np.d);
    if (res.ok) {
      this.player.face(v(np.pile.x, 0, np.pile.z)); this.player.rig.play('repair', 0.42);
      audio.playAt('hammer', v(np.pile.x, np.pile.y + 1, np.pile.z), -2); this.fx.spark(v(np.pile.x, np.pile.y + 0.8, np.pile.z), [1, 0.7, 0.35, 2.5]);
      this.ui.floatText(`+${res.gained}`, v(np.pile.x, np.pile.y + 1.6, np.pile.z));
      if (res.depleted) { this.ui.toast('Куча разобрана. Восстановится через 2 минуты.'); this.sector.refreshPiles(); } else this.sector.refreshPiles();
    } else if (res.reason) { this.ui.toast(res.reason, 'alert'); audio.play('click'); }
    return res;
  }
  // ---------------------------------------------------------------- размещение здания
  startPlacement(id) {
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
    const yaw = -p.angle * Math.PI / 180, [fw, fd] = this.c.bdefs[p.id].footprint_m;
    const hs = this.sector.cornerSamples(p.x, p.z, fw, fd, yaw).map(([x, z]) => this.sector.h(x, z)), y = hs.reduce((a, b) => a + b, 0) / hs.length;
    for (const o of p.objs) { o.setXf(new Xf(M3.ry(yaw), v(p.x, y + 0.05, p.z))); o.tint = p.why ? [0.95, 0.18, 0.12] : [0.25, 0.95, 0.35]; }
    this.ui.onPlacement(true);
  }
  confirmPlacement() {
    const p = this.placing; if (!p || p.busy) return null;
    p.busy = true; // защита от двойного нажатия
    const why = this.sector.validate(p.id, p.x, p.z, p.angle);
    const res = this.c.build(p.id, p.x, p.z, p.angle, !why);
    if (!res.ok) { p.busy = false; this.ui.toast(why || res.reason, 'alert'); audio.play('click'); return res; }
    this.cancelPlacement();
    this.sector.addBuilding(res.rec);
    this.player.rig.play('repair', 1.2); audio.play('build_done');
    this.ui.toast(`Построено: ${this.c.bdefs[res.rec.id].name_ru}. Подойдите и нажмите «ИСПОЛЬЗОВАТЬ».`, 'good');
    if (res.rec.id === 'military_barracks') this.spawnRecruits();
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
    this.player.updateVisual(this.paused ? 0 : dt);
    for (const n of this.npcs) { n.rig.update(this.paused ? 0 : dt, new Xf(M3.ry(n.yaw), n.pos)); }
    if (this.fx) this.fx.update(dt);
    audio.setListener(this.player.pos, this.cam.right);
    this.r.render(this.cam);
    this.ui.update(dt);
    this.input.endFrame();
    this._fa += dt; this._fn++; if (this._fa >= 0.5) { this.stats.fps = this._fn / this._fa; this._fa = 0; this._fn = 0; }
    this.stats.ms = performance.now() - t0; this.stats.dc = this.r.stats.drawCalls; this.stats.tris = this.r.stats.tris;
  }
  step(dt) {
    this.c.advance(dt);
    const inp = this.input, km = inp.keyMove(), tm = inp.touch.move;
    let mx = km[0], mz = km[1];
    if (Math.hypot(tm[0], tm[1]) > Math.hypot(mx, mz)) { mx = tm[0]; mz = tm[1]; }
    const auto = this.autoWalk ? this.autoWalk.sub(this.player.pos) : null;
    if (auto) { const l = Math.hypot(auto.x, auto.z); if (l > 0.6) { mx = auto.x / l; mz = auto.z / l; } else { mx = 0; mz = 0; } }
    const run = inp.held('sprint') || Math.hypot(tm[0], tm[1]) > 0.93;
    this.player.update(dt, v(mx, 0, mz), run);
    this.checkEdges(mz);
    this.sector.updateRoofs(this.player.pos);
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 10; this.save(); }
    this.edgeMsgT -= dt;
  }
  // Границы сектора: переходы только по правилам; запертый край отталкивает назад
  checkEdges(mz) {
    const p = this.player.pos, i = this.c.sector_index, b = this.data.world.boundary_trigger_m;
    if (p.z <= -b) {
      if (i === 0 && this.c.canEnterSector(1)) { this.transitionTo(1, [p.x, 141]); return; }
      p.z = -b + 2.5; this.player.vel.z = 0;
      if (this.edgeMsgT <= 0) { this.edgeMsgT = 2.5; this.ui.toast(i === 0 ? `Поле боя закрыто: подготовка ещё ${UI.mmss(this.c.prepLeft())}.` : 'Вражеская территория — проход запрещён.', 'alert'); audio.play('click'); }
    } else if (p.z >= b) {
      if (i === 1) { this.transitionTo(0, [p.x, -141]); return; }
      p.z = b - 2.5; this.player.vel.z = 0;
      if (this.edgeMsgT <= 0) { this.edgeMsgT = 2.5; this.ui.toast('Тыл: дальше дороги нет.'); }
    }
  }
}

const app = new App();
window.__flApp = app; window.V3 = V3;
