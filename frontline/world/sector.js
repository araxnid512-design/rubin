// Загруженный сектор: рельеф, дороги, растительность, камни, 12 куч металлолома, построенные здания, проверка площадки.
// Одновременно активен только один сектор; при переходе прежний выгружается.
import { V3, M3, Xf, RNG, clamp } from '../../engine/math.js';
import { MeshBuilder } from '../../engine/mesh.js';
import { RenderObject } from '../../engine/renderer.js';
import { Physics } from '../../engine/physics.js';
import { Terrain, fbm } from './terrain.js';
import * as M from './models.js';
import { FrontNav } from './nav.js';

const v = (x, y, z) => new V3(x, y, z);

export class Sector {
  constructor(r, def, campaign, assets = null) {
    this.r = r; this.def = def; this.c = campaign; this.index = def.index; this.assets = assets;
    this.phys = new Physics(150); this.objects = []; this.piles = []; this.buildings = new Map(); this.obstacles = [];
  }
  build() {
    const t0 = performance.now(), r = this.r, def = this.def;
    this.terrain = new Terrain(def);
    for (const mb of this.terrain.buildChunks()) { const o = r.add(new RenderObject(r.createMesh(mb.data()), 'terrain')); o.cutout = false; this.objects.push(o); }
    this.timings = { terrain: performance.now() - t0 };
    this.roads();
    this.vegetation();
    this.scrapField();
    for (const b of this.c.buildingsIn(this.index)) this.addBuilding(b);
    if (this.index === 2) this.enemyStructures();
    const tn = performance.now(); this.nav = new FrontNav(this).buildAll(this.phys); this.timings.nav = performance.now() - tn;
    this.timings.total = performance.now() - t0;
    const st = this.terrain.style, e = r.env;
    e.sky = st.sky; e.ground = st.ground; e.fog = st.fog; e.clear = st.fog; e.sunCol = st.sun; e.sunDir = new V3(0.42, 0.78, 0.46).norm();
    r.fogStart = 70; r.fogEnd = 230;
    return this;
  }
  dispose() { this.r.clear(); }
  h(x, z) { return this.terrain.height(x, z); }
  // ---------------------------------------------------------------- грунтовые дороги: лента по рельефу с колеями
  roads() {
    const T = this.terrain, mb = new MeshBuilder();
    const ribbon = (pl, half, col, lift, offset = 0) => {
      const base = mb.vcount();
      for (let i = 0; i < pl.length; i++) {
        const a = pl[Math.max(0, i - 1)], b = pl[Math.min(pl.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        for (const sd of [-1, 1]) {
          const x = pl[i][0] + nx * (offset + sd * half), z = pl[i][1] + nz * (offset + sd * half), y = T.height(x, z) + lift, n = T.normal(x, z);
          const k = 0.92 + 0.16 * fbm(x * 0.3, z * 0.3, 77);
          mb.p.push(x, y, z); mb.n.push(n.x, n.y, n.z); mb.c.push(col[0] * k, col[1] * k, col[2] * k, 0);
        }
        if (i > 0) { const q = base + (i - 1) * 2; mb.i.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
    };
    const all = [T.road, ...T.branches], dirt = this.def.terrain_style.startsWith('cold') ? [0.56, 0.5, 0.4] : [0.55, 0.43, 0.29];
    all.forEach((pl, k) => {
      const w = k === 0 ? 2.6 : 1.6;
      ribbon(pl, w + 0.6, dirt.map((c) => c * 1.06), 0.04);
      ribbon(pl, w, dirt, 0.06);
      for (const o of [-1.0, 1.0]) ribbon(pl, 0.24, dirt.map((c) => c * 0.74), 0.075, k === 0 ? o : o * 0.7);
    });
    // трава и полевые цветы: низкие пучки, слитые в один меш на чанк
    const rng = new RNG(T.seed + 5), st = this.def.terrain_style, chunks = new Map();
    const n = st.startsWith('summer') ? 3200 : st.startsWith('worn') ? 1600 : 1400;
    const gcol = st.startsWith('summer') ? [0.32, 0.5, 0.18] : st.startsWith('worn') ? [0.45, 0.45, 0.26] : [0.56, 0.52, 0.34];
    for (let i = 0; i < n; i++) {
      const x = rng.range(-146, 146), z = rng.range(-146, 146);
      if (T.roadDist(x, z) < 4.5 || T.inScrapField(x, z, 1) || T.normal(x, z).y < 0.85) continue;
      const k = Math.floor((x + 150) / 50) + Math.floor((z + 150) / 50) * 6; if (!chunks.has(k)) chunks.set(k, new MeshBuilder());
      const g = chunks.get(k), y = T.height(x, z), hh = rng.range(0.25, 0.55), a = rng.range(0, 3.14), w = rng.range(0.25, 0.45);
      const c = rng.f() < 0.06 && st.startsWith('summer') ? [[0.9, 0.85, 0.3], [0.85, 0.85, 0.9], [0.75, 0.45, 0.7]][i % 3] : gcol.map((q) => q * rng.range(0.8, 1.15));
      for (const da of [0, 1.57]) { // две стороны с нормалью вверх — пучок освещён одинаково с любой стороны
        const cx = Math.cos(a + da) * w, cz = Math.sin(a + da) * w, b0 = g.vcount();
        for (const [px, py, pz] of [[x - cx, y, z - cz], [x + cx, y, z + cz], [x + cx * 0.6, y + hh, z + cz * 0.6], [x - cx * 0.6, y + hh, z - cz * 0.6]]) { g.p.push(px, py, pz); g.n.push(0, 1, 0); g.c.push(c[0], c[1], c[2], 0.6); }
        g.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
      }
    }
    const ro = this.r.add(new RenderObject(this.r.createMesh(mb.data()), 'terrain')); ro.cutout = false; ro.shadow = false; this.objects.push(ro);
    for (const [, g] of chunks) { const o = this.r.add(new RenderObject(this.r.createMesh(g.data()), 'world')); o.maxDist = 80; o.shadow = false; this.objects.push(o); }
  }
  // ---------------------------------------------------------------- растительность и камни, слитые в чанки 50 м
  vegetation() {
    const def = this.def, T = this.terrain, st = def.terrain_style, rng = new RNG(T.seed * 7 + 3);
    const chunks = new Map(), chunk = (x, z) => { const k = Math.floor((x + 150) / 50) + Math.floor((z + 150) / 50) * 6; if (!chunks.has(k)) chunks.set(k, new MeshBuilder()); return chunks.get(k); };
    const sp = def.player_spawn_xz, zc = def.buildable_zone_center_xz;
    const free = (x, z, r) => T.roadDist(x, z) > 5 + r && !T.inScrapField(x, z, 6 + r) && Math.hypot(x - sp[0], z - sp[1]) > 10 && Math.abs(x) < 147 && Math.abs(z) < 147;
    const addObs = (x, z, s, hgt) => { this.phys.add(new Xf(new M3(), v(x, this.h(x, z) + hgt / 2, z)), v(s, hgt, s), 1); this.obstacles.push([x, z, s * 0.5]); };
    const place = (n, fn, rule) => { for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) { const x = rng.range(-148, 148), z = rng.range(-148, 148); const ok = rule(x, z); if (!ok || !free(x, z, ok)) continue; fn(x, z); i++; } };
    if (st.startsWith('summer')) {
      const inZone = (x, z) => Math.hypot(x - zc[0], z - zc[1]) < def.buildable_zone_radius_m * 0.85;
      place(560, (x, z) => { const y = this.h(x, z), hh = rng.range(7, 13); if (rng.f() < 0.6) M.pine(chunk(x, z), x, y, z, hh, rng); else M.birch(chunk(x, z), x, y, z, hh * 0.85, rng); addObs(x, z, 0.6, 3); },
        (x, z) => (Math.abs(x) > 108 + fbm(z * 0.03, 0, 3) * 14 || (x < -90 && z < 10 && fbm(x * 0.05, z * 0.05, 4) > 0.45)) ? 1.5 : 0);
      place(60, (x, z) => { const y = this.h(x, z); if (rng.f() < 0.5) M.birch(chunk(x, z), x, y, z, rng.range(6, 9), rng); else M.pine(chunk(x, z), x, y, z, rng.range(6, 10), rng); addObs(x, z, 0.6, 3); },
        (x, z) => (!inZone(x, z) || rng.f() < 0.12) ? 2 : 0);
      place(140, (x, z) => { M.bush(chunk(x, z), x, this.h(x, z), z, rng.range(0.6, 1.3), rng); }, () => 1);
      place(40, (x, z) => { const s = rng.range(0.6, 1.6); M.rock(chunk(x, z), x, this.h(x, z), z, s, rng); if (s > 1.1) addObs(x, z, s * 1.4, s); }, (x, z) => (x < -60 ? 1 : rng.f() < 0.3 ? 1 : 0));
    } else if (st.startsWith('worn')) {
      place(55, (x, z) => { M.deadTree(chunk(x, z), x, this.h(x, z), z, rng.range(4, 8), rng); addObs(x, z, 0.5, 3); }, (x, z) => (Math.abs(x) > 60 || rng.f() < 0.25 ? 1 : 0));
      place(110, (x, z) => { const s = rng.range(0.6, 2.2); M.rock(chunk(x, z), x, this.h(x, z), z, s, rng, [0.46, 0.44, 0.4, 0]); if (s > 1.1) addObs(x, z, s * 1.4, s); }, (x, z) => (Math.abs(x) > 75 ? 1 : rng.f() < 0.25 ? 1 : 0));
      place(160, (x, z) => { M.bush(chunk(x, z), x, this.h(x, z), z, rng.range(0.4, 0.9), rng, [0.38, 0.38, 0.2, 0.6]); }, () => 1);
      place(40, (x, z) => { const y = this.h(x, z), hh = rng.range(6, 10); M.pine(chunk(x, z), x, y, z, hh, rng, true); addObs(x, z, 0.6, 3); }, (x) => (Math.abs(x) > 115 ? 1 : 0));
    } else {
      place(90, (x, z) => { const y = this.h(x, z); M.pine(chunk(x, z), x, y, z, rng.range(6, 11), rng, true); addObs(x, z, 0.6, 3); }, (x, z) => (Math.abs(x) > 95 || z < -100 ? 1.5 : 0));
      place(260, (x, z) => { const s = rng.range(0.6, 2.6); M.rock(chunk(x, z), x, this.h(x, z), z, s, rng, [0.5, 0.49, 0.47, 0]); if (s > 1.1) addObs(x, z, s * 1.4, s); }, (x, z) => (Math.abs(x) > 80 || z < -95 || rng.f() < 0.12 ? 1 : 0));
      place(120, (x, z) => { M.bush(chunk(x, z), x, this.h(x, z), z, rng.range(0.3, 0.7), rng, [0.5, 0.47, 0.3, 0.6]); }, () => 1);
    }
    let tris = 0;
    for (const [, mb] of chunks) { if (mb.isEmpty()) continue; const o = this.r.add(new RenderObject(this.r.createMesh(mb.data()), 'world')); o.maxDist = 170; this.objects.push(o); tris += mb.i.length / 3; }
    this.vegTris = tris;
  }
  // ---------------------------------------------------------------- поле металлолома: 12 отдельных куч (сетка 4×3)
  scrapField() {
    const f = this.def.scrap_field; if (!f) return;
    const [cx, cz] = f.center_xz, n = f.nodes || 12;
    for (let i = 0; i < n; i++) {
      const col = i % 4, row = Math.floor(i / 4), x = cx - f.width_m / 2 + 6 + col * (f.width_m - 12) / 3, z = cz - f.depth_m / 2 + 7 + row * (f.depth_m - 14) / 2;
      const y = this.h(x, z), glb = this.assets && this.assets.instance('scrap_metal', 'world', { size: [3.2, 1.6, 3.2] });
      let o;
      if (glb) o = { glb, objs: glb.objs, set visible(on) { glb.setVisible(on); }, get visible() { return glb.objs.length ? glb.objs[0].visible : false; }, setXf(xf) { glb.setXf(xf); glb.update(0); } };
      else o = this.r.add(new RenderObject(this.r.createMesh(M.scrapPile(i + this.index * 20).data()), 'world'));
      o.setXf(new Xf(M3.ry(i * 1.7), v(x, y, z)));
      const pile = { i, x, z, y, o, radius: 1.5 };
      this.piles.push(pile); this.objects.push(o);
    }
    this.refreshPiles();
  }
  // видимость куч: на №1 — по состоянию игрока, на №3 — по логике ИИ врага
  refreshPiles() {
    for (const p of this.piles) {
      const avail = this.index === 0 ? this.c.nodeState(p.i) === 'available' : (this.c.enemy.scrap_durability[p.i] || 0) > 0;
      p.o.visible = avail;
      if (this.index === 0) { const d = this.c.nodes[p.i].d, k = 0.55 + 0.45 * d / this.c.node.durability_units; p.o.setXf(new Xf(M3.ry(p.i * 1.7).scaled(v(k, k, k)), v(p.x, p.y, p.z))); }
    }
  }
  // ---------------------------------------------------------------- здания
  footprint(id) { const b = this.c.bdefs[id]; return b.footprint_m; }
  // вражеские постройки на №3 — реальные 3D-здания из сохранённого состояния ИИ (экономика при этом не пересчитывается)
  enemyStructures() {
    const E = this.c.enemy; this.enemyLots = [];
    E.structures.forEach((s, k) => {
      const [fw, fd] = this.footprint(s.id); let [x, z] = s.position_xz, ang = s.angle_degrees || 0;
      // точка из плана ИИ может попасть на дорогу/поле этой карты — ищем ближайшую допустимую площадку
      if (this.validate(s.id, x, z, ang)) {
        let found = false;
        for (let r = 4; r <= 40 && !found; r += 4) for (let a = 0; a < 16 && !found; a++) { const nx = x + Math.cos(a / 16 * 6.283) * r, nz = z + Math.sin(a / 16 * 6.283) * r; for (const an of [0, 90]) if (!this.validate(s.id, nx, nz, an)) { x = nx; z = nz; ang = an; found = true; break; } }
      }
      const rec = { uid: 'E' + k, id: s.id, sector: 'enemy_home', x, z, angle: ang, hp: 100, enemy: true };
      this.enemyLots.push(rec); this.addBuilding(rec, 'enemy');
    });
  }
  removeBuilding(uid) {
    const e = this.buildings.get(uid); if (!e) return;
    for (const o of [e.shell, e.roof]) if (o) this.r.remove(o);
    if (e.glb) e.glb.destroy();
    for (const c of e.cols) this.phys.remove(c);
    this.buildings.delete(uid);
    if (this.nav) this.nav.rebuildRegion(e.rec.x, e.rec.z, Math.hypot(e.fw, e.fd) / 2 + 2, this.phys);
  }
  addBuilding(rec, faction = 'friendly') {
    const [fw, fd] = this.footprint(rec.id), m = M.buildingModel(rec.id, fw, fd), yaw = -rec.angle * Math.PI / 180;
    if (faction === 'enemy') { M.enemyTint(m.shell); if (m.roof) M.enemyTint(m.roof); }
    const pts = this.cornerSamples(rec.x, rec.z, fw, fd, yaw); const hs = pts.map(([x, z]) => this.h(x, z));
    const y = hs.reduce((a, b) => a + b, 0) / hs.length, ymin = Math.min(...hs);
    const xf = new Xf(M3.ry(yaw), v(rec.x, y, rec.z));
    const plinth = new MeshBuilder(); plinth.addBox(new Xf(new M3(), v(0, (ymin - y - 0.3) / 2, 0)), v(fw + 0.4, Math.max(0.3, y - ymin + 0.3), fd + 0.4), [0.42, 0.41, 0.38, 0]);
    plinth.append(m.shell);
    const shell = this.r.add(new RenderObject(this.r.createMesh(plinth.data()), 'world')); shell.setXf(xf);
    let roof = null; if (m.roof) { roof = this.r.add(new RenderObject(this.r.createMesh(m.roof.data()), 'world')); roof.setXf(xf); }
    // модель GLB (Tripo), если есть: снаружи видна она; внутри входного здания — процедурные стены и интерьер без крыши
    const gid = faction === 'enemy' && this.assets && this.assets.has('enemy_' + rec.id) ? 'enemy_' + rec.id : rec.id;
    const glb = this.assets && this.assets.instance(gid, 'world', { size: [fw - 0.3, null, fd - 0.3] });
    if (glb) { glb.setXf(xf); glb.update(0); shell.visible = false; if (roof) roof.visible = false; }
    const cols = m.cols.map(([cx, size]) => this.phys.add(xf.mul(cx), size, 1, rec));
    const ent = { rec, xf, y, shell, roof, cols, enterable: m.enterable, fw, fd, yaw, inside: false, glb };
    this.buildings.set(rec.uid, ent);
    if (this.nav) this.nav.rebuildRegion(rec.x, rec.z, Math.hypot(fw, fd) / 2 + 2, this.phys);
    return ent;
  }
  cornerSamples(x, z, fw, fd, yaw, step = 2.5) {
    const out = [], c = Math.cos(yaw), s = Math.sin(yaw);
    for (let a = -fw / 2; a <= fw / 2 + 0.01; a += Math.min(step, fw / 2)) for (let b = -fd / 2; b <= fd / 2 + 0.01; b += Math.min(step, fd / 2)) out.push([x + a * c + b * s, z - a * s + b * c]);
    return out;
  }
  // точка в пятне застройки (локальные координаты здания)
  local(ent, p) { const dx = p.x - ent.rec.x, dz = p.z - ent.rec.z, c = Math.cos(ent.yaw), s = Math.sin(ent.yaw); return [dx * c - dz * s, dx * s + dz * c]; }
  distToFootprint(ent, p) { const [lx, lz] = this.local(ent, p); const ex = Math.max(0, Math.abs(lx) - ent.fw / 2), ez = Math.max(0, Math.abs(lz) - ent.fd / 2); return Math.hypot(ex, ez); }
  // скрытие крыши, когда генерал внутри бункера/штаба (RoofVisual)
  updateRoofs(p) {
    let insideAny = null;
    for (const [, e] of this.buildings) {
      if (!e.enterable || !e.roof) continue;
      const [lx, lz] = this.local(e, p), ins = Math.abs(lx) < e.fw / 2 - 0.9 && Math.abs(lz) < e.fd / 2 - 0.9;
      if (ins !== e.inside) { e.inside = ins; if (e.glb) { e.glb.setVisible(!ins); e.shell.visible = ins; e.roof.visible = false; } else e.roof.visible = !ins; }
      if (ins) insideAny = e;
    }
    return insideAny;
  }
  // ---------------------------------------------------------------- проверка площадки: границы, уклон, дорога, месторождение, пересечения, препятствия
  validate(id, x, z, angleDeg) {
    const [fw, fd] = this.footprint(id), yaw = -angleDeg * Math.PI / 180, T = this.terrain;
    const half = Math.hypot(fw, fd) / 2;
    if (Math.abs(x) + half > 144 || Math.abs(z) + half > 144) return 'Слишком близко к границе сектора.';
    const pts = this.cornerSamples(x, z, fw, fd, yaw, 2);
    let hmin = Infinity, hmax = -Infinity;
    for (const [px, pz] of pts) {
      const hh = this.h(px, pz); hmin = Math.min(hmin, hh); hmax = Math.max(hmax, hh);
      if (T.roadDist(px, pz) < 4.2) return 'Нельзя строить на дороге.';
      if (T.inScrapField(px, pz, 2)) return 'Нельзя строить на поле металлолома.';
    }
    if (hmax - hmin > Math.max(1.8, Math.max(fw, fd) * 0.09)) return 'Слишком крутой склон.';
    for (const [ox, oz, orad] of this.obstacles) {
      const dx = ox - x, dz = oz - z, c = Math.cos(yaw), s = Math.sin(yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < fw / 2 + orad && Math.abs(lz) < fd / 2 + orad) return 'Мешают деревья или камни.';
    }
    for (const [, e] of this.buildings) if (rectOverlap(x, z, fw + 2, fd + 2, yaw, e.rec.x, e.rec.z, e.fw, e.fd, e.yaw)) return 'Пересекается с другим зданием.';
    return '';
  }
}

// пересечение двух повёрнутых прямоугольников (теорема о разделяющей оси)
function rectOverlap(x1, z1, w1, d1, a1, x2, z2, w2, d2, a2) {
  const axes = [[Math.cos(a1), -Math.sin(a1)], [Math.sin(a1), Math.cos(a1)], [Math.cos(a2), -Math.sin(a2)], [Math.sin(a2), Math.cos(a2)]];
  const corners = (x, z, w, d, a) => { const c = Math.cos(a), s = Math.sin(a), o = []; for (const [u, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = u * w / 2, lz = t * d / 2; o.push([x + lx * c + lz * s, z - lx * s + lz * c]); } return o; };
  const A = corners(x1, z1, w1, d1, a1), Bc = corners(x2, z2, w2, d2, a2);
  for (const [ax, az] of axes) {
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const [px, pz] of A) { const p = px * ax + pz * az; amin = Math.min(amin, p); amax = Math.max(amax, p); }
    for (const [px, pz] of Bc) { const p = px * ax + pz * az; bmin = Math.min(bmin, p); bmax = Math.max(bmax, p); }
    if (amax < bmin || bmax < amin) return false;
  }
  return true;
}
export { rectOverlap };
