// Слепой пёс: скелет из 15 костей + процедурная четырёхногая походка (шаг/рысь/галоп) с фиксацией лап в мире.
import { V3, M3, Xf, clamp, lerp, smoothstep, fmod, TAU, FORWARD } from '../engine/math.js';
import { MeshBuilder, MAT, withMat } from '../engine/mesh.js';
import { RenderObject } from '../engine/renderer.js';

const D = { HIPS: 0, CHEST: 1, NECK: 2, HEAD: 3, JAW: 4, TAIL1: 5, TAIL2: 6, FL_U: 7, FL_L: 8, FR_U: 9, FR_L: 10, HL_U: 11, HL_L: 12, HR_U: 13, HR_L: 14 };
const PARENT = [-1, 0, 1, 2, 3, 0, 5, 1, 7, 1, 9, 0, 11, 0, 13];
const NB = 15, BODY_H = 0.54, UP_L = 0.25, LO_L = 0.24, PAW_H = 0.03, PI = Math.PI;
const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const BP = [v(0, BODY_H, 0.26), v(0, 0.02, -0.48), v(0, 0.05, -0.12), v(0, 0.12, -0.14), v(0, -0.04, -0.04), v(0, 0.03, 0.1), v(0, 0, 0.16),
  v(-0.08, -0.05, -0.02), v(0, -UP_L, 0), v(0.08, -0.05, -0.02), v(0, -UP_L, 0), v(-0.08, -0.04, 0), v(0, -UP_L, 0), v(0.08, -0.04, 0), v(0, -UP_L, 0)];
const REST = [];
for (let i = 0; i < NB; i++) REST.push(PARENT[i] < 0 ? BP[i].clone() : REST[PARENT[i]].add(BP[i]));

const bw = (b) => [[b, 0, 0, 0], [1, 0, 0, 0]];
const bw2 = (a, b, w) => [[a, b, 0, 0], [1 - w, w, 0, 0]];
const meshCache = new Map();
function dogMesh(r, app) {
  const key = JSON.stringify(app);
  if (meshCache.has(key)) return meshCache.get(key);
  const mb = new MeshBuilder(); mb.skinned = true;
  const skin = withMat(app.skin || [0.55, 0.42, 0.38], MAT.SKIN), dark = withMat(app.dark || [0.32, 0.22, 0.2], MAT.SKIN);
  const mouth = [0.35, 0.08, 0.08, MAT.SKIN], teeth = [0.85, 0.82, 0.7, MAT.SKIN], up = v(0, 1, 0), hy = BODY_H;
  const L = (p0, p1, rx0, rz0, rx1, rz1, s, c, f, w0, w1, c0 = false, c1 = false) => mb.addLimb(p0, p1, rx0, rz0, rx1, rz1, s, c, f, w0[0], w0[1], w1[0], w1[1], c0, c1);
  // туловище: таз → грудь (поджарое)
  L(v(0, hy + 0.02, 0.36), v(0, hy, 0.1), 0.085, 0.1, 0.1, 0.12, 8, dark, up, bw(D.HIPS), bw2(D.HIPS, D.CHEST, 0.3), true);
  L(v(0, hy, 0.1), v(0, hy + 0.02, -0.12), 0.1, 0.12, 0.12, 0.16, 8, skin, up, bw2(D.HIPS, D.CHEST, 0.3), bw2(D.HIPS, D.CHEST, 0.8));
  L(v(0, hy + 0.02, -0.12), v(0, hy + 0.04, -0.3), 0.12, 0.16, 0.11, 0.15, 8, skin, up, bw2(D.HIPS, D.CHEST, 0.8), bw(D.CHEST));
  // шея и голова
  const neckM = v(0, hy + 0.07, -0.34), headM = neckM.add(v(0, 0.12, -0.14));
  L(v(0, hy + 0.04, -0.3), neckM.add(v(0, 0.1, -0.12)), 0.11, 0.14, 0.065, 0.07, 8, skin, up, bw(D.CHEST), bw2(D.NECK, D.HEAD, 0.4));
  L(headM.add(v(0, 0, 0.06)), headM.add(v(0, -0.01, -0.08)), 0.07, 0.075, 0.06, 0.055, 8, skin, up, bw(D.HEAD), bw(D.HEAD), true);
  L(headM.add(v(0, -0.005, -0.08)), headM.add(v(0, -0.02, -0.2)), 0.045, 0.035, 0.03, 0.025, 6, skin, up, bw(D.HEAD), bw(D.HEAD), false, true);
  mb.setBone(D.HEAD);
  mb.addBox(new Xf(new M3(), headM.add(v(0, 0, -0.205))), v(0.035, 0.025, 0.02), [0.12, 0.08, 0.08, MAT.SKIN]);
  for (const s of [-1, 1]) { // слепые бельма вместо глаз, уши, клыки
    mb.addBox(new Xf(new M3(), headM.add(v(s * 0.045, 0.03, -0.07))), v(0.02, 0.012, 0.03), dark);
    mb.addBox(new Xf(M3.rz(s * 0.5), headM.add(v(s * 0.05, 0.08, 0.02))), v(0.025, 0.07, 0.05), dark);
    mb.addBox(new Xf(new M3(), headM.add(v(s * 0.025, -0.045, -0.17))), v(0.008, 0.02, 0.008), teeth);
  }
  mb.setBone(D.JAW); mb.addBox(new Xf(M3.rx(0.08), headM.add(v(0, -0.055, -0.11))), v(0.06, 0.025, 0.15), mouth);
  // хвост
  L(v(0, hy + 0.05, 0.36), v(0, hy + 0.05, 0.52), 0.025, 0.025, 0.018, 0.018, 6, dark, up, bw(D.TAIL1), bw2(D.TAIL1, D.TAIL2, 0.5));
  L(v(0, hy + 0.05, 0.52), v(0, hy + 0.04, 0.72), 0.018, 0.018, 0.006, 0.006, 6, dark, up, bw2(D.TAIL1, D.TAIL2, 0.5), bw(D.TAIL2), false, true);
  // лапы
  const chestM = v(0, hy + 0.02, -0.22), hipsM = v(0, hy, 0.26);
  for (const [bu, bl, m, par] of [[D.FL_U, D.FL_L, chestM.add(v(-0.08, -0.05, -0.02)), D.CHEST], [D.FR_U, D.FR_L, chestM.add(v(0.08, -0.05, -0.02)), D.CHEST],
    [D.HL_U, D.HL_L, hipsM.add(v(-0.08, -0.04, 0)), D.HIPS], [D.HR_U, D.HR_L, hipsM.add(v(0.08, -0.04, 0)), D.HIPS]]) {
    const knee = m.add(v(0, -UP_L, 0)), paw = knee.add(v(0, -LO_L, 0)), th = bu >= D.HL_U ? 0.055 : 0.045;
    L(m.add(v(0, 0.08, 0)), knee, th, th * 1.3, 0.028, 0.03, 6, skin, FORWARD, bw2(par, bu, 0.7), bw2(bu, bl, 0.5));
    L(knee, paw.add(v(0, 0.02, 0)), 0.028, 0.03, 0.022, 0.024, 6, skin, FORWARD, bw2(bu, bl, 0.5), bw(bl));
    mb.setBone(bl); mb.addBox(new Xf(new M3(), paw.add(v(0, 0, -0.025))), v(0.05, 0.035, 0.08), dark);
  }
  const mesh = r.createMesh(mb.data());
  meshCache.set(key, mesh);
  return mesh;
}

function ik(root, target, a, b, pole) {
  const d = target.sub(root), dist = clamp(d.len(), 0.01, (a + b) * 0.999), dir = d.lenSq() > 1e-8 ? d.norm() : v(0, -1, 0);
  const ang = Math.acos(clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1));
  let p = pole.sub(dir.mul(pole.dot(dir))); if (p.lenSq() < 1e-8) p = FORWARD.sub(dir.mul(FORWARD.dot(dir))); p = p.norm();
  return root.add(dir.mul(Math.cos(ang) * a)).add(p.mul(Math.sin(ang) * a));
}

export class DogRig {
  constructor(r, app = {}) {
    this.r = r; this.seed = Math.random() * 50;
    this.body = r.add(new RenderObject(dogMesh(r, app), 'char'));
    this.body.bones = new Float32Array(20 * 16);
    this.velocity = v(); this.action = ''; this.actionT = 0; this.actionDur = 0; this.dead = false; this.deathT = 0; this.alert = 0;
    this.lodSkip = 0; this._lodC = 0; this._acc = 0; this.phase = 0; this.gaitW = 0; this.t = 0; this.first = true; this.hit = 0;
    this.g = Array.from({ length: NB }, () => new M3()); this.O = Array.from({ length: NB }, () => v());
    this.xf = new Xf(); this.hipsP = BP[0].clone(); this.visible = true;
    const chestM = BP[D.HIPS].add(BP[D.CHEST]), hipsM = BP[D.HIPS];
    this.legs = [[D.FL_U, chestM.add(BP[D.FL_U]), true, 0], [D.FR_U, chestM.add(BP[D.FR_U]), true, 0.5], [D.HL_U, hipsM.add(BP[D.HL_U]), false, 0.5], [D.HR_U, hipsM.add(BP[D.HR_U]), false, 0]]
      .map(([bu, mount, front, offset]) => ({ bu, mount, front, offset, neutral: v(mount.x * 1.1, PAW_H, mount.z + (front ? 0 : 0.04)), pos: v(), cur: v(), swing: false, t: 0, dur: 0.2, from: v(), to: v(), lift: 0.08 }));
  }
  play(act, dur) { if (this.dead) return; this.action = act; this.actionT = 0; this.actionDur = dur; }
  hitReact() { this.hit = 1; }
  resetFeet() { this.first = true; }
  setShadow(on) { this.body.shadow = on; }
  setVisible(on) { this.visible = on; this.body.visible = on; }
  setHit(k) { this.body.hit = k; }
  destroy() { this.r.remove(this.body); }
  headWorld() { return this.xf.mulV(this.O[D.HEAD]); }
  die() {
    if (this.dead) return;
    this.dead = true; this.deathT = 0;
    this.deathFrom = this.g.map((b, i) => (PARENT[i] < 0 ? b.ortho().toQuat() : this.g[PARENT[i]].T().mul(b).ortho().toQuat()));
    this.deathTo = this.g.map((_, i) => (i === D.HIPS ? M3.rz(PI / 2) : [D.FL_U, D.FR_U, D.HL_U, D.HR_U].includes(i) ? M3.rx(0.2) : i === D.JAW ? M3.rx(-0.4) : new M3()).toQuat());
  }

  update(dt, xf) {
    this.xf = xf;
    if (this.lodSkip > 0) { this._lodC++; this._acc += dt; if (this._lodC <= this.lodSkip) { this._write(); return; } this._lodC = 0; dt = this._acc; this._acc = 0; }
    dt = Math.min(dt, 0.1); this.t += dt;
    if (this.dead) { this._death(dt); this._write(); return; }
    if (this.action) { this.actionT += dt; if (this.actionT >= this.actionDur) this.action = ''; }
    this.hit = Math.max(0, this.hit - dt * 4);
    const inv = xf.inv(), lv = xf.basis.T().mulV(this.velocity); lv.y = 0;
    const speed = lv.len(), gallop = smoothstep(4, 6.5, speed);
    const duty = lerp(0.55, 0.32, smoothstep(1, 6, speed)), stanceHalf = lerp(0.12, 0.3, smoothstep(0.5, 7, speed)), cycle = 2 * stanceHalf / duty;
    const moving = speed > 0.1;
    this.gaitW = Math.abs((moving ? 1 : 0) - this.gaitW) <= dt * 4 ? (moving ? 1 : 0) : this.gaitW + Math.sign((moving ? 1 : 0) - this.gaitW) * dt * 4;
    if (moving) this.phase = fmod(this.phase + speed * dt / cycle, 1);
    const floorY = xf.origin.y;
    if (this.first) { this.first = false; for (const l of this.legs) { l.pos = xf.mulV(l.neutral); l.cur = l.pos.clone(); l.swing = false; } }
    const vdir = speed > 0.01 ? lv.norm() : v(), swingTime = (1 - duty) * cycle / Math.max(speed, 0.5);
    this.legs.forEach((l, i) => {
      const off = gallop > 0.5 ? [0, 0.12, 0.55, 0.65][i] : l.offset, fp = fmod(this.phase + off, 1);
      if (l.swing) {
        l.t += dt / l.dur;
        const rem = (1 - l.t) * l.dur;
        const tgt = xf.mulV(l.neutral.add(vdir.mul(moving ? stanceHalf : 0))).add(this.velocity.mul(rem)); tgt.y = floorY + PAW_H; l.to = tgt;
        if (l.t >= 1) { l.swing = false; l.pos = l.to.clone(); l.cur = l.pos.clone(); }
        else { const e = l.t * l.t * (3 - 2 * l.t); l.cur = l.from.lerp(l.to, e); l.cur.y = floorY + PAW_H + Math.sin(l.t * PI) * l.lift; }
      } else {
        l.cur = l.pos.clone();
        const rel = inv.mulV(l.pos);
        let go = moving && fp >= duty;
        if (rel.sub(l.mount).len() > (UP_L + LO_L) * 1.05) go = true;
        if (!moving && Math.hypot(rel.x - l.neutral.x, rel.z - l.neutral.z) > 0.12) go = true;
        if (go) { l.swing = true; l.t = 0; l.dur = moving ? clamp(swingTime, 0.1, 0.3) : 0.18; l.from = l.pos.clone(); l.lift = lerp(0.06, 0.13, smoothstep(0.5, 5, speed)); }
      }
    });
    // корпус
    const bob = Math.sin(this.phase * TAU * 2) * 0.015 * this.gaitW + Math.sin(this.phase * TAU) * 0.05 * gallop;
    let crouch = 0, headDrop = 0, jaw = 0, lunge = 0;
    if (this.action === 'attack') { const k = this.actionT / this.actionDur; lunge = Math.sin(clamp(k, 0, 1) * PI); jaw = Math.sin(clamp(k * 1.3, 0, 1) * PI) * 0.7; crouch = -lunge * 0.05; }
    else if (this.action === 'sniff' || (!moving && this.alert < 0.5)) headDrop = 0.35 + Math.sin(this.t * 2 + this.seed) * 0.1;
    if (this.alert > 0.5 && !moving) { crouch = 0.08; jaw = 0.15 + Math.sin(this.t * 9) * 0.08; }
    const pitch = Math.sin(this.phase * TAU + 0.6) * 0.12 * gallop;
    const hipsB = M3.rx(pitch + lunge * 0.15).mul(M3.rz(this.hit * 0.3));
    this.hipsP = v(0, BODY_H - crouch + bob - this.hit * 0.05, 0.26 - lunge * 0.15);
    const chestB = hipsB.mul(M3.rx(-pitch * 1.6 - lunge * 0.2)).mul(M3.ry(Math.sin(this.phase * TAU) * 0.06 * this.gaitW));
    const neckB = chestB.mul(M3.rx(-headDrop * 0.6 + lunge * 0.3 - pitch));
    const headB = neckB.mul(M3.rx(-headDrop * 0.5 + lunge * 0.25 + Math.sin(this.phase * TAU * 2) * 0.05)).mul(M3.ry(Math.sin(this.t * 1.3 + this.seed) * 0.3 * (1 - this.gaitW)));
    const wag = Math.sin(this.t * (this.alert < 0.5 ? 8 : 3)) * (this.alert < 0.5 ? 0.5 : 0.1);
    const t1 = hipsB.mul(M3.rx(-0.5 + gallop * 0.4)).mul(M3.ry(wag));
    const g = this.g;
    g[D.HIPS] = hipsB; g[D.CHEST] = chestB; g[D.NECK] = neckB; g[D.HEAD] = headB; g[D.JAW] = headB.mul(M3.rx(-jaw));
    g[D.TAIL1] = t1; g[D.TAIL2] = t1.mul(M3.rx(-0.3)).mul(M3.ry(wag * 0.6));
    const hipsT = new Xf(hipsB, this.hipsP), chestT = new Xf(chestB, hipsT.mulV(BP[D.CHEST]));
    for (const l of this.legs) {
      const mount = (l.front ? chestT : hipsT).mulV(BP[l.bu]), paw = inv.mulV(l.cur);
      const knee = ik(mount, paw, UP_L, LO_L, v(0, 0, l.front ? 1 : -1));
      g[l.bu] = M3.yFwd(mount.sub(knee).norm(), FORWARD); g[l.bu + 1] = M3.yFwd(knee.sub(paw).norm(), FORWARD);
    }
    this._fk(this.hipsP); this._write();
  }
  _death(dt) {
    if (this.deathT >= 1) return;
    this.deathT = Math.min(1, this.deathT + dt / 0.6);
    const k = this.deathT * this.deathT;
    for (let i = 0; i < NB; i++) {
      const lq = M3.fromQuat(slerp(this.deathFrom[i], this.deathTo[i], k));
      this.g[i] = PARENT[i] < 0 ? lq : this.g[PARENT[i]].mul(lq);
    }
    this._fk(v(0, lerp(BODY_H, 0.1, k), 0.26));
  }
  _fk(hp) {
    const g = this.g, O = this.O, out = this.body.bones;
    O[0] = hp.clone();
    for (let i = 1; i < NB; i++) O[i] = O[PARENT[i]].add(g[PARENT[i]].mulV(BP[i]));
    for (let i = 0; i < NB; i++) {
      const b = g[i], o = O[i].sub(b.mulV(REST[i])), k = i * 16;
      out[k] = b.x.x; out[k + 1] = b.x.y; out[k + 2] = b.x.z; out[k + 3] = 0; out[k + 4] = b.y.x; out[k + 5] = b.y.y; out[k + 6] = b.y.z; out[k + 7] = 0;
      out[k + 8] = b.z.x; out[k + 9] = b.z.y; out[k + 10] = b.z.z; out[k + 11] = 0; out[k + 12] = o.x; out[k + 13] = o.y; out[k + 14] = o.z; out[k + 15] = 1;
    }
  }
  _write() { this.xf.toMat4(this.body.model); this.body.wc = this.xf.origin.add(v(0, 0.5, 0)); this.body.wr = 1.1; }
}

function slerp(a, b, t) {
  let [ax, ay, az, aw] = a; let [bx, by, bz, bw_] = b; let d = ax * bx + ay * by + az * bz + aw * bw_;
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw_ = -bw_; }
  let k0, k1; if (d > 0.9995) { k0 = 1 - t; k1 = t; } else { const th = Math.acos(d), s = Math.sin(th); k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s; }
  const q = [ax * k0 + bx * k1, ay * k0 + by * k1, az * k0 + bz * k1, aw * k0 + bw_ * k1], l = Math.hypot(...q); return q.map((x) => x / l);
}
