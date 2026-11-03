// Игровой мир «База Долга»: сборка локации 300×300 м, навигация, объекты, актёры, обновление кадра.
import { V3, M3, Xf, RNG } from '../engine/math.js';
import { MeshBuilder } from '../engine/mesh.js';
import { RenderObject } from '../engine/renderer.js';
import { Physics } from '../engine/physics.js';
import { NavGrid } from '../engine/nav.js';
import { noiseTexture } from '../engine/noise.js';
import { WorldBuilder, SPLAT } from './world_builder.js';
import * as L from './layout.js';
import * as P from './props.js';
import { Game, events } from './state.js';
import { Building, LootContainer, Salvage, Pickup, InspectPoint, ExitZone, Rubble } from './objects.js';
import * as BG from './building_gen.js';
import { FX } from './fx.js';
import { updateAnomalies } from './actors.js';
import { ArtifactField, Raids } from './mechanics.js';

const v = (x, y, z) => new V3(x, y, z);
const frame = () => new Promise((res) => setTimeout(res, 0));

export class GameWorld {
  constructor(renderer, settings) {
    this.r = renderer; this.settings = settings;
    this.phys = new Physics(150); this.nav = new NavGrid(150, 0.5, 0.32);
    this.buildings = {}; this.interactables = []; this.doors = []; this.markers = [];
    this.soldiers = []; this.soldierMap = {}; this.enemies = []; this.groups = []; this.player = null;
    this.lamps = []; this.fires = []; this.anomalies = []; this.labels = [];
    this.stats = {}; this.timings = {}; this.time = 0; this.chunkObjs = []; this.grassObjs = [];
    this.coverPoints = []; this.actors = []; this.timers = []; this.projectiles = []; this.artifacts = null; this.raids = null; this.pathBudget = 6; this.fx = new FX(renderer); this.quest = null; this.input = null; this.cam = null;
  }
  later(t, fn) { this.timers.push({ t, fn }); }
  // шум (выстрел, шаги, взрыв): слышат все персонажи в радиусе
  noise(pos, radius, source) { for (const a of this.actors) if (a !== source && a.alive) a.onNoise(pos, radius, source); }

  async build(progress = () => {}) {
    const t = () => performance.now();
    let t0 = t();
    progress(0.05, 'Шум и материалы…'); await frame();
    if (!this.r.noiseTex) {
      this.r.noiseTex = this.r.texture(noiseTexture(256, 4, 1337), 256, 256, { format: 'r' });
      this.r.detailTex = this.r.texture(noiseTexture(256, 16, 4242, 3), 256, 256, { format: 'r' });
    }
    progress(0.1, 'Планировка территории 300×300 м…'); await frame();
    const wb = this.wb = new WorldBuilder();
    wb.buildSplat();
    this.r.splatTex = this.r.texture(wb.splat, SPLAT, SPLAT, { mip: false, repeat: false });
    this.timings.splat = t() - t0; t0 = t();
    progress(0.2, 'Земля, периметр, дороги…'); await frame();
    for (const g of wb.groundBuilders()) { const o = this.r.add(new RenderObject(this.r.createMesh(g.data()), 'ground')); o.shadow = false; o.cutout = false; }
    wb.buildPerimeter(); wb.buildRoads();
    progress(0.32, 'Разрушенные постройки и техника…'); await frame();
    wb.buildProps(); wb.buildRuins();
    this.timings.props = t() - t0; t0 = t();
    progress(0.45, 'Лес, кусты, трава…'); await frame();
    wb.buildVegetation();
    this.timings.vegetation = t() - t0; t0 = t();
    progress(0.55, 'Сборка чанков…'); await frame();
    let verts = 0, fverts = 0;
    for (const [, mb] of wb.chunks) { if (mb.isEmpty()) continue; const o = this.r.add(new RenderObject(this.r.createMesh(mb.data()), 'world')); o.maxDist = this.settings.drawDistance; this.chunkObjs.push(o); verts += mb.vcount(); }
    for (const [, mb] of wb.fol) { if (mb.isEmpty()) continue; const o = this.r.add(new RenderObject(this.r.createMesh(mb.data()), 'foliage')); o.maxDist = this.settings.drawDistance + 20; this.chunkObjs.push(o); fverts += mb.vcount(); }
    const tuft = P.grassTuft().data();
    for (const inst of wb.grassChunks()) { const g = this.r.createInstanced(tuft, inst, 'foliage'); g.maxDist = 70; this.grassObjs.push(g); }
    this.applyQuality();
    for (const c of wb.col) this.phys.add(c[0], c[1], 1, null);
    this.stats = { verts, fverts, boxes: wb.col.length, grass: wb.grass.length };
    this.timings.chunks = t() - t0; t0 = t();
    progress(0.68, 'Здания базы…'); await frame();
    for (const d of L.BUILDINGS) this.buildings[d.id] = new Building(this, d);
    this.timings.buildings = t() - t0; t0 = t();
    progress(0.76, 'Освещение, аномалии, объекты…'); await frame();
    this._lightsAndObjects();
    progress(0.84, 'Навигационная сетка…'); await frame();
    this.nav.build(this.phys.colliders);
    this._buildCover();
    this.timings.nav = t() - t0; t0 = t();
    this.stats.colliders = this.phys.colliders.length;
    progress(0.92, 'Личный состав…'); await frame();
    if (this.onSpawn) this.onSpawn(this);
    this.artifacts = new ArtifactField(this); this.raids = new Raids(this);
    this.timings.spawn = t() - t0;
    progress(1, 'Готово');
    console.log('[World] timings', JSON.stringify(this.timings), 'stats', JSON.stringify(this.stats));
  }

  _lightsAndObjects() {
    const ws = Game.worldState;
    for (const p of this.wb.lampPoints) { const l = { pos: p, range: 16, color: [1, 0.82, 0.58], energy: 2.2, on: false, lamp: true }; this.r.lights.push(l); this.lamps.push(l); }
    for (const p of this.wb.firePoints) { const l = { pos: p.add(v(0, 1.4, 0)), range: 9, color: [1, 0.55, 0.22], energy: 1.6, on: true, fire: true, base: p }; this.r.lights.push(l); this.fires.push(l); }
    for (const a of L.ANOMALIES) {
      const an = { kind: a.kind, pos: v(...a.pos), r: a.r, cool: 0, burst: 0 };
      if (a.kind !== 'rad') { an.light = { pos: an.pos.add(v(0, 1, 0)), range: a.r * 3, color: a.kind === 'electro' ? [0.4, 0.7, 1] : [1, 0.5, 0.15], energy: 0.4, on: true }; this.r.lights.push(an.light); }
      this.anomalies.push(an);
    }
    for (const s of this.wb.signs) this.labels.push({ pos: s.pos.add(v(0, 3.2, 0)), text: s.text, color: '#f2d980' });
    for (const d of L.BUILDINGS) {
      if (d.kind === 'tower') continue;
      const di = BG.doorInfo(d);
      const p = d.open ? v(d.pos[0], 3.2, d.pos[1]) : v(d.pos[0], 0, d.pos[1]).add(di.pos).add(di.out.mul(0.3)).add(v(0, d.hangar ? 4.1 : 2.75, 0));
      this.labels.push({ pos: p, text: d.name.toUpperCase(), color: '#ece6d4', building: d.id });
    }
    for (const c of L.CONTAINERS) new LootContainer(this, c.id, c.name, c.kind, c.items, v(...c.pos));
    L.SALVAGE.forEach((s, i) => { const id = 'salv_' + i; if (!ws.salvage[id]) new Salvage(this, id, s[1], s[2], v(...s[0])); });
    L.PICKUPS.forEach((s, i) => { const id = 'pick_' + i; if (!ws.taken[id]) new Pickup(this, id, s[1], s[2], v(...s[0])); });
    for (const ip of L.INSPECT) new InspectPoint(this, ip.id, ip.text, v(...ip.pos));
    for (const e of L.EXITS) new ExitZone(this, e.id, e.name, v(...e.pos));
    for (const d of L.BUILDINGS) if (d.rubble && !ws.rubble[d.id]) {
      const di = BG.doorInfo(d); new Rubble(this, d.id, v(d.pos[0], 0, d.pos[1]).add(di.pos).add(di.out.mul(1.3)));
    }
  }

  // Точки укрытия у высоких препятствий (машины, контейнеры, стены)
  _buildCover() {
    for (const c of this.phys.colliders) {
      if (c.y1 - c.y0 < 1.5 || c.y0 > 0.5 || Math.max(c.hx, c.hz) > 8) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ex = dx ? c.hx : c.hz;
        const lx = dx * (ex + 0.8), lz = dz * (ex + 0.8);
        const px = c.cx + lx * c.ux - lz * c.uz, pz = c.cz + lx * c.uz + lz * c.ux;
        if (this.nav.walkable(this.nav.toCell(px), this.nav.toCell(pz))) this.coverPoints.push(v(px, 0, pz));
      }
    }
  }
  findCover(from, threat, maxD = 12) {
    const cand = [];
    for (const p of this.coverPoints) { const d = p.dist2(from); if (d < maxD && d > 0.5) cand.push([d, p]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, p] of cand.slice(0, 8)) if (!this.phys.lineClear(threat.add(v(0, 1.2, 0)), p.add(v(0, 1.2, 0)))) return p;
    return null;
  }

  applyQuality() {
    const s = this.settings;
    for (const o of this.chunkObjs) o.maxDist = o.kind === 'foliage' ? s.drawDistance + 20 : s.drawDistance;
    for (const g of this.grassObjs) g.visibleCount = Math.floor(g.n * s.grassDensity);
  }

  update(dt) {
    this.time += dt; this.pathBudget = 6;
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    if (this.player) this.player.update(dt);
    for (const s of this.soldiers) s.update(dt);
    for (const e of this.enemies) e.update(dt);
    for (const g of this.groups) g.update(dt);
    updateAnomalies(this, dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) { const pr = this.projectiles[i]; pr.update(dt); if (pr.dead) this.projectiles.splice(i, 1); }
    if (this.artifacts) this.artifacts.update(dt);
    if (this.raids) this.raids.update(dt);
    for (const d of this.doors) d.update(dt);
    for (const b of Object.values(this.buildings)) b.update(dt);
    const night = Game.time < 6.5 || Game.time > 19.5, lightsOk = this.settings.lights;
    for (const l of this.lamps) l.on = Game.powerOn && night && lightsOk;
    for (const f of this.fires) f.energy = 1.4 + Math.sin(this.time * 13) * 0.15 + Math.sin(this.time * 7.3) * 0.12;
    for (const b of Object.values(this.buildings)) b.updateLights();
    this.fx.lightsOn = this.settings.lights;
  }
  updateVisuals(dt, cam) {
    for (const a of this.actors) a.updateVisual(dt, cam);
    this.fx.update(dt);
  }

  writeState() {
    for (const s of this.soldiers) s.writeState();
    if (this.player) this.player.writeState();
  }
}
