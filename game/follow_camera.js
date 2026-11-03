// Камера сверху под наклоном (как в выживалках с видом сверху), плавно следует за генералом.
// Режимы: 'follow' (сейчас) и заготовка 'tactical' (дальний тактический обзор для следующих этапов).
import { V3, clamp } from '../engine/math.js';
import { Camera } from '../engine/camera.js';

export class FollowCamera extends Camera {
  constructor(settings) {
    super(); this.settings = settings; this.pitchDeg = 54; this.baseDist = 20; this.zoom = settings.cameraZoom || 1; this.mode = 'follow';
    this.fov = 42 * Math.PI / 180; this.near = 0.5; this.f = null; this.shakeK = 0;
  }
  setZoom(z) { this.zoom = clamp(z, 0.55, 1.7); this.settings.cameraZoom = this.zoom; }
  shake(k) { this.shakeK = Math.min(1, this.shakeK + k); }
  snap() { this.f = null; }
  follow(target, vel, dt) {
    this.far = (this.settings.drawDistance || 140) + 50;
    let look = vel ? new V3(vel.x, 0, vel.z).mul(0.35) : new V3();
    if (look.len() > 2.5) look = look.norm().mul(2.5);
    const want = target.add(look).add(new V3(0, 0.8, 0));
    if (!this.f) this.f = want.clone();
    this.f = this.f.lerp(want, 1 - Math.exp(-5 * dt));
    const mz = this.mode === 'tactical' ? 1.8 : 1;
    const d = this.baseDist * clamp(this.zoom, 0.55, 1.7) * mz, p = (this.pitchDeg + (this.zoom - 1) * 6) * Math.PI / 180;
    let sh = new V3();
    if (this.shakeK > 0) { this.shakeK = Math.max(0, this.shakeK - dt * 2.5); sh = new V3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).mul(this.shakeK * 0.25); }
    this.pos = this.f.add(new V3(0, Math.sin(p), Math.cos(p)).mul(d)).add(sh);
    this.target = this.f.add(sh.mul(0.5)); this.focus = this.f.clone();
  }
  // точка на горизонтальной плоскости высоты y под экранной точкой
  groundAt(sx, sy, w, h, y = 1.1) {
    const r = this.ray(sx, sy, w, h); if (Math.abs(r.d.y) < 1e-4) return null;
    const t = (y - r.o.y) / r.d.y; return t > 0 ? r.o.add(r.d.mul(t)) : null;
  }
}
