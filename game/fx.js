// Визуальные эффекты: трассеры, дульные вспышки (с кратким светом), попадания, кровь (+ пятна на земле),
// взрывы, разряды аномалий. Частицы считаются на CPU и рисуются одним пакетом рендера.
import { V3 } from '../engine/math.js';
import { audio } from '../engine/audio.js';

const v = (x, y, z) => new V3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(r) {
    this.r = r; this.parts = []; this.tracers = []; this.flashes = []; this.decals = []; this.maxParts = 600;
    this.light = { pos: v(0, -50, 0), range: 7, color: [1, 0.75, 0.4], energy: 0, on: true }; this.lightT = 0; this.lightMax = 0.06;
    r.lights.push(this.light);
    this.lightsOn = true;
  }
  _burst(pos, normal, col, n, vel, life, size, alpha = false, grav = 9) {
    const nn = normal && normal.lenSq() > 0.01 ? normal : v(0, 1, 0);
    for (let i = 0; i < n && this.parts.length < this.maxParts; i++) {
      const d = nn.add(v(rnd(-0.7, 0.7), rnd(-0.7, 0.7), rnd(-0.7, 0.7))).norm();
      const s = rnd(vel * 0.4, vel);
      this.parts.push({ p: pos.clone(), v: d.mul(s), life: rnd(life * 0.6, life), max: life, size: rnd(size * 0.5, size), col, alpha, grav });
    }
  }
  tracer(a, b) { if (a.dist(b) > 0.3) this.tracers.push({ a, b, t: 0.06 }); }
  muzzleFlash(pos, dir, silenced = false) {
    if (silenced) return;
    this.flashes.push({ p: pos.add(dir.mul(0.1)), s: rnd(0.35, 0.6), t: 0.05 });
    if (this.lightsOn) { this.light.pos = pos.add(v(0, 0.2, 0)); this.lightT = 0.06; this.lightMax = 0.06; this.light.range = 7; }
  }
  impact(pos, normal) {
    this._burst(pos, normal, [0.55, 0.5, 0.42, 0.9], 8, 3, 0.4, 0.09, true);
    if (Math.random() < 0.35) this._burst(pos, normal, [1, 0.8, 0.4, 2.5], 5, 5, 0.15, 0.04);
    audio.playAt('impact', pos, -12);
  }
  blood(pos, normal, mutant = false) {
    const c = mutant ? [0.32, 0.05, 0.04, 1] : [0.42, 0.04, 0.03, 1];
    this._burst(pos, normal, c, 12, 2.5, 0.45, 0.08, true);
    if (this.decals.length > 40) this.decals.shift();
    this.decals.push({ p: v(pos.x + rnd(-0.3, 0.3), 0.02, pos.z + rnd(-0.3, 0.3)), s: rnd(0.4, 0.8), t: 25, col: c });
    audio.playAt('hit', pos, -6);
  }
  explosion(pos) {
    this._burst(pos, v(0, 1, 0), [1, 0.55, 0.15, 3], 30, 9, 0.6, 0.35);
    this._burst(pos, v(0, 1, 0), [0.22, 0.2, 0.18, 0.85], 24, 5, 1.4, 0.7, true, -0.5);
    this.light.pos = pos.add(v(0, 1, 0)); this.lightT = 0.25; this.lightMax = 0.25; this.light.range = 14;
    if (this.decals.length > 40) this.decals.shift();
    this.decals.push({ p: v(pos.x, 0.02, pos.z), s: 3, t: 40, col: [0.08, 0.07, 0.06, 1] });
  }
  spark(pos, color = [0.5, 0.75, 1, 3]) { this._burst(pos, v(0, 1, 0), color, 10, 4, 0.25, 0.06); }
  flame(pos) { this._burst(pos, v(0, 1, 0), [1, 0.5, 0.12, 2.2], 16, 3, 0.6, 0.3, false, -3); }
  update(dt) {
    const r = this.r;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.v.y -= p.grav * dt; p.p.addSelf(p.v.mul(dt));
      if (p.p.y < 0.02) { p.p.y = 0.02; p.v.scaleSelf(0.3); }
      const k = p.life / p.max, c = p.col;
      if (p.alpha) r.fxBillboard(p.p, p.size * (p.grav < 0 ? 2 - k : 1), [c[0], c[1], c[2], -c[3] * Math.min(1, k * 2)]);
      else r.fxBillboard(p.p, p.size, [c[0], c[1], c[2], c[3] * k]);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.t -= dt; if (t.t <= 0) { this.tracers.splice(i, 1); continue; } r.fxLine(t.a, t.b, 0.035, [1, 0.82, 0.45, 2.2]); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.t -= dt; if (f.t <= 0) { this.flashes.splice(i, 1); continue; } r.fxBillboard(f.p, f.s, [1, 0.7, 0.3, 4]); }
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.t -= dt; if (d.t <= 0) { this.decals.splice(i, 1); continue; } r.fxGround(d.p, d.s, [d.col[0], d.col[1], d.col[2], -0.85 * Math.min(1, d.t / 3)]); }
    if (this.lightT > 0) { this.lightT -= dt; this.light.energy = Math.max(0, this.lightT / this.lightMax) * 3; } else this.light.energy = 0;
  }
}
