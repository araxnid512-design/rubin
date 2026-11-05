// Движок: камера (перспектива), проекции экран ↔ мир.
import { V3, mat4 } from './math.js';

export class Camera {
  constructor() {
    this.pos = new V3(0, 20, 15); this.target = new V3(); this.fov = 42 * Math.PI / 180; this.near = 0.5; this.far = 220;
    this.aspect = 16 / 9; this.view = mat4.ident(); this.proj = mat4.ident(); this.focus = new V3();
    this.right = new V3(1, 0, 0); this.up = new V3(0, 1, 0); this.fwd = new V3(0, 0, -1);
  }
  update(aspect) {
    this.aspect = aspect;
    mat4.lookAt(this.pos, this.target, new V3(0, 1, 0), this.view);
    mat4.persp(this.fov, aspect, this.near, this.far, this.proj);
    this.fwd = this.target.sub(this.pos).norm();
    this.right = this.fwd.cross(new V3(0, 1, 0)).norm();
    this.up = this.right.cross(this.fwd).norm();
    this.viewProj = mat4.mul(this.proj, this.view);
    this.invViewProj = mat4.invert(this.viewProj);
  }
  // экранные координаты (пиксели CSS) → луч в мире
  ray(sx, sy, w, h) {
    const nx = (sx / w) * 2 - 1, ny = 1 - (sy / h) * 2;
    const a = mat4.xformPoint(this.invViewProj, new V3(nx, ny, -1)), b = mat4.xformPoint(this.invViewProj, new V3(nx, ny, 1));
    return { o: a, d: b.sub(a).norm() };
  }
  // точка мира → экран (пиксели CSS); null — за камерой
  project(p, w, h) {
    const m = this.viewProj; const x = p.x, y = p.y, z = p.z;
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15]; if (cw <= 0.01) return null;
    const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw, cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
    return { x: (cx * 0.5 + 0.5) * w, y: (1 - (cy * 0.5 + 0.5)) * h, inside: Math.abs(cx) <= 1 && Math.abs(cy) <= 1 };
  }
  inFrustum(p) { const s = this.project(p, 1, 1); return !!s && s.inside; }
}
