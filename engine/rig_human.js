// Скелетная модель человека (17 костей, скиннинг на GPU) и процедурная анимация.
// Персонаж и оружие — отдельные объекты: оружие (WeaponView + свои меши частей) только
// позиционируется скелетом, а руки ставятся на его рукоять/цевьё/магазин через IK.
//  — походка со стопами, зафиксированными в мире (ноги не скользят);
//  — только стоячие позы: без приседаний, без колена, без ближнего боя;
//  — состояния хвата из HOLD: idle, low, carry, aim, inspect;
//  — перезарядки по типу: магазин, пистолет, короб ПКМ, обойма, переломка, патроны по одному, барабан;
//  — действия: перевязка, лечение другого, ремонт стоя, подбор, использование, приветствие, разговор, попадание, смерть.
import { V3, M3, Xf, clamp, lerp, smoothstep, angleDiff, lerpAngle, fmod, TAU, UP, FORWARD } from './math.js';
import { MeshBuilder, MAT, darken, withMat } from './mesh.js';
import { RenderObject } from './renderer.js';
import { HOLD, WeaponView } from './weapons.js';

export const B = { HIPS: 0, SPINE: 1, CHEST: 2, NECK: 3, HEAD: 4, UA_L: 5, FA_L: 6, HAND_L: 7, UA_R: 8, FA_R: 9, HAND_R: 10, TH_L: 11, SH_L: 12, FOOT_L: 13, TH_R: 14, SH_R: 15, FOOT_R: 16 };
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];
const NB = 17;

const HIP_Y = 0.95, SPINE_L = 0.12, CHEST_L = 0.2, NECK_L = 0.26, HEAD_L = 0.09, SH_X = 0.19, SH_Y = 0.22;
const UPPER = 0.3, FORE = 0.27, HIP_X = 0.1, HIP_DY = -0.04, THIGH = 0.44, SHIN = 0.4, ANKLE_H = 0.075, LEG = THIGH + SHIN;
// расстояние «тазобедренный сустав — голеностоп» при сгибе колена 25° (предел для опорной ноги: только стоячие позы)
const KNEE25 = Math.sqrt(THIGH * THIGH + SHIN * SHIN + 2 * THIGH * SHIN * Math.cos(25 * Math.PI / 180));

const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const PI = Math.PI;
const seg = (k, a, b) => smoothstep(a, b, k);

// Локальные смещения костей относительно родителя и положения покоя в пространстве модели
const BP = [v(0, HIP_Y, 0), v(0, SPINE_L, 0), v(0, CHEST_L, 0), v(0, NECK_L, 0), v(0, HEAD_L, 0),
  v(-SH_X, SH_Y, 0), v(0, -UPPER, 0), v(0, -FORE, 0), v(SH_X, SH_Y, 0), v(0, -UPPER, 0), v(0, -FORE, 0),
  v(-HIP_X, HIP_DY, 0), v(0, -THIGH, 0), v(0, -SHIN, 0), v(HIP_X, HIP_DY, 0), v(0, -THIGH, 0), v(0, -SHIN, 0)];
const REST = [];
for (let i = 0; i < NB; i++) REST.push(PARENT[i] < 0 ? BP[i].clone() : REST[PARENT[i]].add(BP[i]));

// ===================================================================== меш тела
const bw = (b) => [[b, 0, 0, 0], [1, 0, 0, 0]];
const bw2 = (b0, b1, w1) => [[b0, b1, 0, 0], [1 - w1, w1, 0, 0]];
function limb(mb, p0, p1, r0, r1, col, w0, w1, sides = 8, cap0 = false, cap1 = false) {
  mb.addLimb(p0, p1, r0[0], r0[1], r1[0], r1[1], sides, col, FORWARD, w0[0], w0[1], w1[0], w1[1], cap0, cap1);
}
const m = (c, mat) => withMat(c, mat);
const sc = (a, k) => [a[0] * k, a[1] * k];
const bxR = (mb, axis, ang, c, s, col) => mb.addBox(new Xf(ang ? M3.axis(axis, ang) : new M3(), c), s, col);
const meshCache = new Map();

const camel = (o) => { const out = {}; for (const [k, val] of Object.entries(o || {})) out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = val; return out; };
export function bodyMesh(r, app0) {
  const app = camel(app0);
  const key = JSON.stringify(app);
  if (meshCache.has(key)) return meshCache.get(key);
  const mb = new MeshBuilder(); mb.skinned = true;
  const suit = app.suit || [0.2, 0.2, 0.21], armor = app.armor || [0.55, 0.1, 0.08], pants = app.pants || suit;
  const skin = app.skin || [0.66, 0.53, 0.46], boots = app.boots || [0.12, 0.11, 0.1], gloves = app.gloves || [0.13, 0.13, 0.13];
  const vest = app.vest || [0.25, 0.25, 0.22], w = app.build || 1, head = app.head || 'helmet';
  const cSuit = m(suit, MAT.CLOTH), cPants = m(pants, MAT.CLOTH), cArmor = m(armor, MAT.PAINT), cSkin = m(skin, MAT.SKIN);
  const cBoot = m(boots, MAT.RUBBER), cGlove = m(gloves, MAT.RUBBER), cVest = m(vest, MAT.CLOTH);
  const hip = HIP_Y, spineY = hip + SPINE_L, chestY = spineY + CHEST_L, neckY = chestY + NECK_L, headY = neckY + HEAD_L, shY = chestY + SH_Y;
  const RIGHT = v(1, 0, 0);
  // --- ноги
  for (const s of [-1, 1]) {
    const th = s < 0 ? B.TH_L : B.TH_R, sh = s < 0 ? B.SH_L : B.SH_R, ft = s < 0 ? B.FOOT_L : B.FOOT_R;
    const hx = s * HIP_X, hy = hip + HIP_DY, ky = hy - THIGH, ay = ky - SHIN;
    limb(mb, v(hx * 1.05, hy + 0.06, 0), v(hx, ky, 0), sc([0.092, 0.1], w), sc([0.064, 0.068], w), cPants, bw2(B.HIPS, th, 0.6), bw2(th, sh, 0.5));
    mb.setBone(sh); mb.addBox(new Xf(new M3(), v(hx, ky - 0.02, -0.065)), v(0.085, 0.1, 0.03), cArmor); // наколенник
    limb(mb, v(hx, ky, 0), v(hx, ay + 0.2, 0), sc([0.064, 0.068], w), sc([0.05, 0.055], w), cPants, bw2(th, sh, 0.5), bw(sh));
    limb(mb, v(hx, ay + 0.21, 0), v(hx, ay - 0.01, 0), sc([0.06, 0.064], w), sc([0.056, 0.06], w), cBoot, bw(sh), bw2(sh, ft, 0.5), 8, true, false);
    mb.setBone(ft);
    mb.addBox(new Xf(new M3(), v(hx, ay - 0.035, -0.055)), v(0.11, 0.08, 0.27), cBoot);
    mb.addBox(new Xf(new M3(), v(hx, ay - 0.07, -0.055)), v(0.115, 0.02, 0.28), m([0.04, 0.04, 0.04], MAT.RUBBER));
  }
  // --- таз и корпус
  limb(mb, v(0, hip - 0.13, 0), v(0, hip + 0.05, 0), sc([0.165, 0.11], w), sc([0.16, 0.105], w), cPants, bw(B.HIPS), bw(B.HIPS), 8, true, false);
  limb(mb, v(0, hip + 0.05, 0), v(0, spineY + 0.1, 0), sc([0.16, 0.105], w), sc([0.158, 0.105], w), cSuit, bw2(B.HIPS, B.SPINE, 0.5), bw2(B.SPINE, B.CHEST, 0.4));
  limb(mb, v(0, spineY + 0.1, 0), v(0, shY + 0.02, 0), sc([0.158, 0.105], w), sc([0.2, 0.115], w), cSuit, bw2(B.SPINE, B.CHEST, 0.4), bw(B.CHEST), 8, false, true);
  mb.setBone(B.HIPS); mb.addBox(new Xf(new M3(), v(0, hip + 0.03, 0)), v(0.34 * w, 0.05, 0.23 * w), m([0.1, 0.09, 0.07], MAT.RUBBER)); // ремень
  mb.setBone(B.CHEST);
  bxR(mb, RIGHT, 0.05, v(0, chestY + 0.08, -0.105 * w), v(0.3 * w, 0.3, 0.05), cArmor);
  mb.addBox(new Xf(new M3(), v(0, chestY + 0.09, 0.11 * w)), v(0.32 * w, 0.32, 0.05), darken(cArmor, 0.15));
  if (app.vestOn !== false) {
    mb.setBone(B.SPINE);
    for (const px of [-0.09, 0, 0.09]) mb.addBox(new Xf(new M3(), v(px * w, spineY + 0.06, -0.125 * w)), v(0.075, 0.1, 0.05), cVest);
    mb.setBone(B.CHEST); mb.addBox(new Xf(new M3(), v(0, chestY + 0.25, -0.02)), v(0.36 * w, 0.05, 0.22 * w), cVest);
  }
  for (const s of [-1, 1]) { mb.setBone(s < 0 ? B.UA_L : B.UA_R); bxR(mb, FORWARD, -s * 0.25, v(s * (SH_X + 0.02), shY, 0), v(0.12, 0.1, 0.14), cArmor); } // наплечники
  if (app.backpack) {
    mb.setBone(B.CHEST); const bc = app.packColor || [0.18, 0.17, 0.13];
    mb.addBox(new Xf(new M3(), v(0, chestY + 0.06, 0.2 * w)), v(0.28, 0.36, 0.16), m(bc, MAT.CLOTH));
    mb.addBox(new Xf(new M3(), v(0, chestY + 0.27, 0.19 * w)), v(0.24, 0.08, 0.13), m(darken(bc, 0.2), MAT.CLOTH));
  }
  if (app.medbag) {
    mb.setBone(B.HIPS);
    mb.addBox(new Xf(new M3(), v(-0.19 * w, hip - 0.02, 0.04)), v(0.08, 0.16, 0.2), m([0.75, 0.75, 0.7], MAT.CLOTH));
    mb.addBox(new Xf(new M3(), v(-0.235 * w, hip, 0.04)), v(0.005, 0.06, 0.06), m([0.8, 0.1, 0.1], MAT.PAINT));
  }
  if (app.toolbag) { mb.setBone(B.HIPS); mb.addBox(new Xf(new M3(), v(0.19 * w, hip - 0.03, 0.03)), v(0.08, 0.14, 0.18), m([0.35, 0.25, 0.12], MAT.CLOTH)); }
  mb.setBone(B.HIPS); mb.addBox(new Xf(new M3(), v(0.18 * w, hip - 0.06, -0.02)), v(0.05, 0.13, 0.09), m([0.12, 0.1, 0.08], MAT.RUBBER)); // кобура
  // --- руки
  for (const s of [-1, 1]) {
    const ua = s < 0 ? B.UA_L : B.UA_R, fa = s < 0 ? B.FA_L : B.FA_R, hd = s < 0 ? B.HAND_L : B.HAND_R;
    const x = s * SH_X, ey = shY - UPPER, wy = ey - FORE;
    limb(mb, v(x, shY + 0.04, 0), v(x, ey, 0), sc([0.062, 0.066], w), sc([0.05, 0.052], w), cSuit, bw2(B.CHEST, ua, 0.75), bw2(ua, fa, 0.5));
    limb(mb, v(x, ey, 0), v(x, wy + 0.02, 0), sc([0.05, 0.052], w), sc([0.038, 0.042], w), cSuit, bw2(ua, fa, 0.5), bw(fa));
    if (app.armband && s < 0) { mb.setBone(ua); mb.addBox(new Xf(new M3(), v(x, shY - 0.12, 0)), v(0.115, 0.05, 0.12), m(app.armbandColor || [0.8, 0.1, 0.08], MAT.CLOTH)); }
    limb(mb, v(x, wy + 0.03, 0), v(x, wy - 0.015, 0), [0.042, 0.045], [0.04, 0.045], cGlove, bw(fa), bw(hd));
    mb.setBone(hd);
    mb.addBox(new Xf(new M3(), v(x, wy - 0.065, -0.005)), v(0.04, 0.1, 0.085), cGlove);
    bxR(mb, RIGHT, 0.4, v(x - s * 0.01, wy - 0.05, -0.055), v(0.025, 0.06, 0.025), cGlove);
  }
  // --- шея и голова
  limb(mb, v(0, chestY + 0.2, 0), v(0, headY + 0.02, 0), [0.06, 0.06], [0.055, 0.058], head !== 'gasmask' ? cSkin : cSuit, bw2(B.CHEST, B.NECK, 0.5), bw2(B.NECK, B.HEAD, 0.5));
  if (app.collar !== false) limb(mb, v(0, shY - 0.01, 0), v(0, shY + 0.06, 0), [0.09, 0.085], [0.075, 0.075], cSuit, bw(B.CHEST), bw2(B.CHEST, B.NECK, 0.5));
  const hy = headY, H = bw(B.HEAD);
  limb(mb, v(0, hy - 0.02, -0.01), v(0, hy + 0.08, -0.005), [0.07, 0.08], [0.088, 0.1], cSkin, H, H, 8, true, false);
  limb(mb, v(0, hy + 0.08, -0.005), v(0, hy + 0.2, 0), [0.088, 0.1], [0.06, 0.07], cSkin, H, H, 8, false, true);
  mb.setBone(B.HEAD);
  mb.addBox(new Xf(new M3(), v(0, hy + 0.07, -0.1)), v(0.025, 0.04, 0.03), darken(cSkin, 0.08));
  const eye = m([0.05, 0.05, 0.05], MAT.SKIN);
  if (head !== 'gasmask') for (const s of [-1, 1]) mb.addBox(new Xf(new M3(), v(s * 0.035, hy + 0.105, -0.088)), v(0.025, 0.012, 0.01), eye);
  const hair = m(app.hair || [0.15, 0.12, 0.1], MAT.CLOTH);
  const helmet = (c, y0, z0) => {
    limb(mb, v(0, hy + y0, z0), v(0, hy + y0 + 0.1, z0 + 0.003), [0.122, 0.135], [0.115, 0.125], c, H, H, 10, true, false);
    limb(mb, v(0, hy + y0 + 0.1, z0 + 0.003), v(0, hy + y0 + 0.16, z0 + 0.005), [0.115, 0.125], [0.05, 0.055], c, H, H, 10, false, true);
  };
  switch (head) {
    case 'helmet': {
      helmet(m(app.helmetColor || [0.14, 0.15, 0.13], MAT.PAINT), 0.09, 0.005);
      if (app.goggles) mb.addBox(new Xf(new M3(), v(0, hy + 0.2, -0.1)), v(0.14, 0.035, 0.04), m([0.2, 0.25, 0.25], MAT.GLASS));
      break;
    }
    case 'gasmask': {
      const gm = m([0.12, 0.13, 0.12], MAT.RUBBER);
      limb(mb, v(0, hy - 0.03, 0), v(0, hy + 0.22, 0), [0.095, 0.105], [0.075, 0.085], gm, H, H, 8, true, true);
      mb.addCyl(new Xf(M3.rx(-PI / 2 - 0.3), v(0, hy + 0.03, -0.09)), 0.035, 0.03, 0.08, 8, m([0.2, 0.2, 0.18], MAT.PAINT));
      for (const s of [-1, 1]) mb.addCyl(new Xf(M3.rx(-PI / 2), v(s * 0.04, hy + 0.11, -0.085)), 0.025, 0.025, 0.02, 8, m([0.3, 0.35, 0.3], MAT.GLASS));
      helmet(m(app.helmetColor || [0.14, 0.15, 0.13], MAT.PAINT), 0.12, 0.01);
      break;
    }
    case 'beret': {
      limb(mb, v(0, hy + 0.12, 0), v(0, hy + 0.2, 0), [0.092, 0.104], [0.075, 0.085], hair, H, H, 8, false, true);
      bxR(mb, FORWARD, 0.25, v(0.02, hy + 0.205, 0), v(0.21, 0.05, 0.22), m(app.beretColor || [0.45, 0.06, 0.06], MAT.CLOTH));
      mb.addBox(new Xf(new M3(), v(-0.05, hy + 0.2, -0.105)), v(0.025, 0.03, 0.01), m([0.9, 0.75, 0.2], MAT.PAINT));
      break;
    }
    case 'cap': {
      const cc = m(app.capColor || [0.14, 0.14, 0.13], MAT.CLOTH);
      limb(mb, v(0, hy + 0.12, 0), v(0, hy + 0.23, 0), [0.098, 0.11], [0.085, 0.095], cc, H, H, 8, false, true);
      bxR(mb, RIGHT, -0.15, v(0, hy + 0.14, -0.13), v(0.15, 0.015, 0.08), cc);
      break;
    }
    case 'hood': {
      limb(mb, v(0, hy - 0.02, 0.03), v(0, hy + 0.24, 0.02), [0.12, 0.13], [0.07, 0.08], m(app.hoodColor || suit, MAT.CLOTH), H, H, 8, false, true);
      mb.addBox(new Xf(new M3(), v(0, hy + 0.04, -0.09)), v(0.12, 0.08, 0.02), m([0.08, 0.08, 0.08], MAT.CLOTH));
      break;
    }
    case 'bald': break;
    default: limb(mb, v(0, hy + 0.12, 0), v(0, hy + 0.215, 0.01), [0.094, 0.106], [0.07, 0.08], hair, H, H, 8, false, true);
  }
  if (app.headset) {
    mb.setBone(B.HEAD); const hs = m([0.1, 0.1, 0.1], MAT.RUBBER);
    for (const s of [-1, 1]) mb.addBox(new Xf(new M3(), v(s * 0.098, hy + 0.1, 0)), v(0.025, 0.06, 0.05), hs);
    mb.addBox(new Xf(new M3(), v(-0.07, hy + 0.04, -0.07)), v(0.01, 0.01, 0.07), hs);
  }
  const mesh = r.createMesh(mb.data());
  meshCache.set(key, mesh);
  return mesh;
}

// ===================================================================== вспомогательная математика
function ik(root, target, a, b, pole) {
  const d = target.sub(root);
  const dist = clamp(d.len(), 0.01, (a + b) * 0.999);
  const dir = d.lenSq() > 1e-8 ? d.norm() : v(0, -1, 0);
  const ang = Math.acos(clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1));
  let p = pole.sub(dir.mul(pole.dot(dir)));
  if (p.lenSq() < 1e-8) p = FORWARD.sub(dir.mul(FORWARD.dot(dir)));
  p = p.norm();
  return root.add(dir.mul(Math.cos(ang) * a)).add(p.mul(Math.sin(ang) * a));
}
const IDQ = [0, 0, 0, 1];

class Foot {
  constructor(side) {
    this.side = side; this.pos = v(); this.yaw = 0; this.swing = false; this.t = 0; this.dur = 0.3;
    this.from = v(); this.to = v(); this.fromYaw = 0; this.toYaw = 0; this.lift = 0.12; this.cur = v(); this.curYaw = 0; this.pitch = 0;
  }
}

// ===================================================================== риг
export class HumanRig {
  constructor(r, app = {}) {
    this.r = r; this.app = app; this.seed = Math.random() * 100;
    this.body = r.add(new RenderObject(bodyMesh(r, app), 'char'));
    this.body.bones = new Float32Array(20 * 16);
    for (let k = 0; k < 20; k++) this.body.bones.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], k * 16);
    this.wparts = {}; this.weapon = null; this.weaponId = ''; this.holdClass = 'none';
    // входные параметры (задаёт актёр)
    this.velocity = v(); this.aiming = false; this.holdState = 'low'; this.aimDir = FORWARD.clone(); this.lookAt = null; this.lookBias = 0;
    this.shamble = 0; this.holster = false; this.fireKick = 0;
    // действие
    this.action = ''; this.actionT = 0; this.actionDur = 0; this.dead = false; this.deathT = 0;
    // внутреннее
    this.phase = 0; this.gaitW = 0; this.feet = [new Foot(-1), new Foot(1)]; this.first = true;
    this.hipsPos = v(); this.hipSmooth = -1; this.smoothTwist = 0; this.smoothPitch = 0; this.smoothLean = [0, 0];
    this.prevVel = v(); this.headYaw = 0; this.idleT = 0; this.hitK = 0;
    this.wRel = new Xf(); this.wInit = false; this.weaponXf = null;
    this.g = Array.from({ length: NB }, () => new M3()); this.O = Array.from({ length: NB }, () => v());
    this.lodSkip = 0; this._lodC = 0; this._accDt = 0;
    this.xf = new Xf(); this.visible = true; this.onFootstep = null;
  }

  setWeapon(id) {
    for (const o of Object.values(this.wparts)) if (o) this.r.remove(o);
    this.wparts = {}; this.weaponId = id || ''; this.wInit = false;
    if (!id) { this.weapon = null; this.holdClass = 'none'; return; }
    this.weapon = new WeaponView(this.r, id); this.holdClass = this.weapon.hold;
    for (const part of ['body', 'mag', 'bolt', 'barrel']) {
      const mesh = this.weapon.info.mesh[part];
      this.wparts[part] = mesh ? this.r.add(new RenderObject(mesh, 'char')) : null;
    }
  }
  play(act, dur) { if (this.dead) return; this.action = act; this.actionT = 0; this.actionDur = Math.max(dur, 0.05); }
  stopAction() { this.action = ''; this._resetParts(); }
  _resetParts() { if (this.weapon) { this.weapon.magState = 0; this.weapon.boltT = 0; this.weapon.openT = 0; } }
  hitReact() { this.hitK = 1; }
  onFire() { this.fireKick = 1; if (this.weapon) this.weapon.onFire(); }
  resetFeet() { this.first = true; }
  setShadow(on) { this.body.shadow = on; for (const o of Object.values(this.wparts)) if (o) o.shadow = on; }
  setVisible(on) { this.visible = on; this.body.visible = on; for (const o of Object.values(this.wparts)) if (o) o.visible = on && o._partVis !== false; }
  setHit(k) { this.body.hit = k; }
  destroy() { this.r.remove(this.body); for (const o of Object.values(this.wparts)) if (o) this.r.remove(o); }

  // мировые точки
  boneWorld(i) { return this.xf.mulV(this.O[i]); }
  muzzleWorld() {
    if (!this.weapon || !this.weaponXf) return this.xf.mulV(v(0, 1.3, 0));
    return this.xf.mul(this.weaponXf).mulV(this.weapon.info.muzzle);
  }
  muzzleDir() {
    if (!this.weapon || !this.weaponXf) return this.xf.basis.mulV(FORWARD);
    return this.xf.basis.mul(this.weaponXf.basis).mulV(FORWARD).norm();
  }
  handXf() { return this.xf.mul(new Xf(this.g[B.HAND_R], this.O[B.HAND_R])); }
  headWorld() { return this.xf.mulV(this.O[B.HEAD].add(this.g[B.HEAD].mulV(v(0, 0.12, 0)))); }

  _neutral(f) { return v(f.side * 0.11, ANKLE_H, 0); }
  _footOff(f, inv, bodyYaw) {
    const rel = inv.mulV(f.pos), n = this._neutral(f);
    return Math.hypot(rel.x - n.x, rel.z - n.z) > 0.16 || Math.abs(angleDiff(f.yaw, bodyYaw)) > 0.6;
  }

  // xf — мировая трансформация персонажа (позиция + рыскание)
  update(dt, xf) {
    this.xf = xf;
    if (this.lodSkip > 0) {
      this._lodC++; this._accDt += dt;
      if (this._lodC <= this.lodSkip) { this._writeObjects(); return; }
      this._lodC = 0; dt = this._accDt; this._accDt = 0;
    } else this._accDt = 0;
    dt = Math.min(dt, 0.25); // дальние персонажи обновляются реже — ноги не должны отставать от тела
    if (this.dead) { this._updateDeath(dt); this._writeObjects(); return; }
    this._pose(dt, xf);
    this._writeObjects();
  }

  _pose(dt, xf) {
    if (this.action) { this.actionT += dt; if (this.actionT >= this.actionDur) { this.action = ''; this._resetParts(); } }
    this.hitK = Math.max(0, this.hitK - dt * 4); this.fireKick = Math.max(0, this.fireKick - dt * 9); this.idleT += dt;
    const inv = xf.inv(), binv = xf.basis.T();
    const lv = binv.mulV(this.velocity); lv.y = 0;
    const speed = lv.len(), runK = smoothstep(2.1, 3.8, speed);
    const act = this.action, ap = act ? clamp(this.actionT / this.actionDur, 0, 1) : 0;
    const prof = HOLD[this.holdClass] || HOLD.rifle;
    const shamble = this.shamble, W = this.weapon;
    // наклон корпуса стоя: подбор, ремонт, помощь раненому
    let bend = 0;
    if (act === 'pickup') bend = Math.sin(ap * PI); // наклон корпусом, ноги прямые — без приседания
    else if (act === 'repair' || act === 'heal_other') bend = 0.35 * seg(this.actionT, 0, 0.3) * (1 - seg(this.actionT, this.actionDur - 0.3, this.actionDur));
    // ---------------- шаги ----------------
    const accel = this.velocity.sub(this.prevVel).mul(1 / Math.max(dt, 0.001)); this.prevVel = this.velocity.clone();
    const duty = lerp(0.6, 0.4, runK);
    // короткий шаг при беге: опорная нога остаётся почти прямой (никакого бега «на полусогнутых»)
    let stanceHalf = lerp(0.3, 0.34, runK) * clamp(speed / 1.5, 0.4, 1) * lerp(1, 0.55, shamble);
    const lateral = Math.abs(lv.x) / Math.max(speed, 0.01);
    stanceHalf *= lerp(1, 0.4, smoothstep(0.3, 0.9, lateral)); // вбок — короче шаг, ноги не перекрещиваются
    const cycleLen = 2 * stanceHalf / duty;
    const moving = speed > 0.12;
    this.gaitW = moveToward(this.gaitW, moving ? 1 : 0, dt * 4);
    const fwdW = xf.basis.mulV(FORWARD), bodyYaw = Math.atan2(-fwdW.x, -fwdW.z), floorY = xf.origin.y;
    if (this.first) {
      this.first = false;
      for (const f of this.feet) { const p = xf.mulV(this._neutral(f)); p.y = floorY + ANKLE_H; f.pos = p; f.cur = p.clone(); f.yaw = f.curYaw = bodyYaw; f.swing = false; }
      this.phase = 0;
    }
    if (moving) this.phase = fmod(this.phase + speed * dt / cycleLen, 1);
    const velDirL = speed > 0.01 ? lv.norm() : v();
    const swingTime = (1 - duty) * cycleLen / Math.max(speed, 0.5);
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], other = this.feet[1 - i];
      const fp = fmod(this.phase + (i === 0 ? 0 : 0.5), 1), nl = this._neutral(f);
      if (f.swing) {
        f.t += dt / f.dur;
        const remaining = (1 - f.t) * f.dur;
        const land = nl.add(velDirL.mul(moving ? stanceHalf : 0));
        if (f.side * land.x < 0.05) land.x = f.side * 0.05;
        const tgt = xf.mulV(land).add(this.velocity.mul(remaining)); tgt.y = floorY + nl.y;
        f.to = tgt; f.toYaw = bodyYaw;
        if (f.t >= 1) {
          f.swing = false; f.pos = f.to.clone(); f.yaw = f.toYaw; f.cur = f.pos.clone(); f.curYaw = f.yaw; f.pitch = 0;
          if (this.onFootstep) this.onFootstep(f.pos, speed);
        } else {
          const k = f.t, e = k * k * (3 - 2 * k);
          f.cur = f.from.lerp(f.to, e); f.cur.y = lerp(f.from.y, f.to.y, e) + Math.sin(k * PI) * f.lift;
          f.curYaw = lerpAngle(f.fromYaw, f.toYaw, e);
          f.pitch = Math.sin(k * PI) * 0.25 - (1 - k) * 0.35 * runK;
        }
      } else {
        f.cur = f.pos.clone(); f.curYaw = f.yaw; f.pitch = 0;
        let want = moving && fp >= duty && !other.swing;
        const rel = inv.mulV(f.pos);
        const hipL = v(f.side * HIP_X, (this.hipsPos.y > 0.1 ? this.hipsPos.y : 0.9) + HIP_DY, 0);
        if (rel.sub(hipL).len() > LEG * 1.02) want = true;
        if (!moving && !other.swing) {
          const dev = Math.hypot(rel.x - nl.x, rel.z - nl.z), ydev = Math.abs(angleDiff(f.yaw, bodyYaw));
          if ((dev > 0.16 || ydev > 0.6) && (i === 0 || !this._footOff(this.feet[0], inv, bodyYaw))) want = true;
        }
        if (want) {
          f.swing = true; f.t = 0; f.dur = moving ? clamp(swingTime, 0.16, 0.42) : 0.3;
          f.from = f.pos.clone(); f.fromYaw = f.yaw; f.lift = moving ? lerp(0.07, 0.09, runK) * (1 - shamble * 0.5) : 0.06;
        }
      }
    }
    // ---------------- таз ----------------
    const bob = -Math.cos((this.phase - duty * 0.5) * TAU * 2) * 0.018 * runK * this.gaitW;
    const armed = this.holdClass !== 'none' && !this.holster;
    const heavy = armed ? (prof.heavy || 0) : 0;
    const hipBase = lerp(0.952, 0.935, this.gaitW) - shamble * 0.01 - bend * 0.02;
    let hipH = hipBase + bob;
    for (const f of this.feet) {
      if (!f.swing || f.t > 0.85) {
        const rel = inv.mulV(f.cur), hx = f.side * HIP_X + this.hipsPos.x;
        const dxz = Math.hypot(rel.x - hx, rel.z - this.hipsPos.z), reach = LEG * 0.985;
        if (dxz < reach) hipH = Math.min(hipH, rel.y + Math.sqrt(reach * reach - dxz * dxz) - HIP_DY);
      }
    }
    this.hipSmooth = this.hipSmooth < 0 ? hipH : lerp(this.hipSmooth, hipH, clamp(dt * 18, 0, 1));
    // нижняя граница таза: только стоячие позы. Если стопа не достаётся — нога выпрямляется и делает шаг,
    // а таз не опускается (иначе получается приседание)
    const hipFloor = lerp(0.95, 0.885, this.gaitW) - runK * 0.01 - shamble * 0.01;
    // опорное колено сгибается не больше чем на 25°: таз поднимается над стоящей стопой
    let kneeLimit = 0;
    for (const f of this.feet) {
      if (f.swing) continue;
      const rel = inv.mulV(f.cur), dxz = Math.hypot(rel.x - (f.side * HIP_X + this.hipsPos.x), rel.z - this.hipsPos.z);
      if (dxz < KNEE25) kneeLimit = Math.max(kneeLimit, rel.y + Math.sqrt(KNEE25 * KNEE25 - dxz * dxz) - HIP_DY);
    }
    hipH = Math.max(Math.min(this.hipSmooth, hipH + 0.01), hipFloor, Math.min(kneeLimit, hipBase));
    const sway = -Math.sin((this.phase - 0.05) * TAU) * lerp(0.022, 0.01, runK) * this.gaitW;
    const idleShift = Math.sin(this.idleT * 0.4 + this.seed) * 0.015 * (1 - this.gaitW);
    const la = binv.mulV(accel);
    const lt = [clamp(la.z * -0.012, -0.12, 0.12), clamp(la.x * 0.01, -0.1, 0.1)], lk = clamp(dt * 5, 0, 1);
    this.smoothLean = [lerp(this.smoothLean[0], lt[0], lk), lerp(this.smoothLean[1], lt[1], lk)];
    const lean = 0.03 * speed + runK * 0.04 + this.smoothLean[0] + shamble * 0.25 + bend * 0.75 - heavy * (1 - runK);
    const pelvisYaw = Math.sin(this.phase * TAU) * 0.09 * this.gaitW * (1 - runK * 0.3);
    this.hipsPos = v(sway + idleShift, hipH, bend * 0.05);
    const hipsB = M3.ry(pelvisYaw).mul(M3.rx(-lean * 0.4)).mul(M3.rz(this.smoothLean[1] * 0.5 + (sway + idleShift) * 1.5));
    // ---------------- прицеливание и корпус ----------------
    let state = this.holdState;
    if (this.aiming) state = 'aim';
    if (act === 'reload' || act === 'cycle') { state = state !== 'aim' || this.holdClass === 'pistol' ? 'low' : 'aim'; if (act === 'reload') state = 'low'; }
    if (act === 'inspect') state = 'inspect';
    const aimL = binv.mulV(this.aimDir);
    const aimYaw = Math.atan2(-aimL.x, -aimL.z);
    const aimPitch = aimL.lenSq() > 0.001 ? Math.asin(clamp(aimL.norm().y, -0.8, 0.8)) : 0;
    const isAim = state === 'aim' && armed;
    let twistT = 0;
    if (isAim) twistT = (prof.twist ?? -0.5) + clamp(aimYaw, -0.9, 0.9);
    else if (armed && state === 'inspect') twistT = -0.2;
    this.smoothTwist = lerp(this.smoothTwist, twistT, clamp(dt * 10, 0, 1));
    this.smoothPitch = lerp(this.smoothPitch, isAim ? aimPitch : 0, clamp(dt * 10, 0, 1));
    const counter = -pelvisYaw * 1.4, breathe = Math.sin(this.idleT * 1.7 + this.seed) * 0.012;
    const spineB = hipsB.mul(M3.ry(this.smoothTwist * 0.45 + counter * 0.5)).mul(M3.rx(-lean * 0.45 + this.hitK * 0.2));
    const chestB = spineB.mul(M3.ry(this.smoothTwist * 0.55 + counter * 0.5)).mul(M3.rx(-lean * 0.2 + breathe + this.hitK * 0.25 + this.smoothPitch * 0.35 + shamble * 0.15));
    const hipsT = new Xf(hipsB, this.hipsPos);
    const spineT = new Xf(spineB, hipsT.mulV(BP[B.SPINE]));
    const chestT = new Xf(chestB, spineT.mulV(BP[B.CHEST]));
    // ---------------- голова ----------------
    let lookYaw = 0, lookPitch = -0.05 + shamble * 0.35;
    if (this.lookAt) {
      const lp = inv.mulV(this.lookAt), dh = lp.sub(chestT.mulV(v(0, 0.4, 0)));
      lookYaw = clamp(Math.atan2(-dh.x, -dh.z) - this.smoothTwist, -1.1, 1.1);
      lookPitch = clamp(Math.asin(clamp(dh.norm().y, -1, 1)), -0.5, 0.4);
    } else if (isAim) { lookYaw = clamp(aimYaw - this.smoothTwist, -1, 1); lookPitch = this.smoothPitch * 0.5; }
    else if (state === 'inspect') { lookYaw = 0.25; lookPitch = -0.45; }
    else lookYaw = Math.sin(this.idleT * 0.35 + this.seed) * 0.35 * (1 - this.gaitW);
    lookYaw += this.lookBias;
    if (act === 'reload') { lookPitch = -0.4; lookYaw += 0.15; }
    this.headYaw = lerp(this.headYaw, clamp(lookYaw, -1.2, 1.2), clamp(dt * 6, 0, 1));
    const neckB = chestB.mul(M3.ry(this.headYaw * 0.4)).mul(M3.rx(lookPitch * 0.3 - lean * 0.2));
    const headB = neckB.mul(M3.ry(this.headYaw * 0.6)).mul(M3.rx(lookPitch * 0.7 + bob * 1.5 + shamble * 0.2)).mul(M3.rz(shamble * 0.35));
    const neckT = new Xf(neckB, chestT.mulV(BP[B.NECK]));
    const headT = new Xf(headB, neckT.mulV(BP[B.HEAD]));
    // ---------------- ноги (IK) ----------------
    const legs = [];
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], hipJ = hipsT.mulV(BP[i === 0 ? B.TH_L : B.TH_R]), ank = inv.mulV(f.cur);
      const fyaw = angleDiff(bodyYaw, f.curYaw), footDir = v(-Math.sin(fyaw), 0, -Math.cos(fyaw));
      const pole = footDir.add(v(f.side * 0.15, 0, 0)).norm();
      const knee = ik(hipJ, ank, THIGH, SHIN, pole);
      const thB = M3.yFwd(hipJ.sub(knee).norm(), pole);
      const ankReal = knee.add(ank.sub(knee).norm().mul(SHIN));
      const shB = M3.yFwd(knee.sub(ankReal).norm(), footDir);
      legs.push([thB, shB, M3.ry(fyaw).mul(M3.rx(f.pitch))]);
    }
    // ---------------- оружие ----------------
    const shL = chestT.mulV(BP[B.UA_L]), shR = chestT.mulV(BP[B.UA_R]);
    let handL = null, handR = null, handRB = null, poleL = v(-0.3, -1, 0.2), poleR = v(0.9, -0.5, 0.4), wxf = null, oneHand = false;
    const stowed = ['bandage', 'heal_other', 'repair', 'salute', 'throw'].includes(act);
    if (armed && !stowed && W) {
      let target = this._weaponTarget(state, prof, chestT, chestB, aimYaw);
      oneHand = state === 'carry' && !!(prof.carry && prof.carry.oneHand);
      if (act === 'reload') target = target.mul(this._reloadTilt(ap));
      const relT = chestT.inv().mul(target);
      if (!this.wInit) { this.wRel = relT; this.wInit = true; }
      else {
        const k = clamp(dt * (isAim ? 16 : 9), 0, 1);
        this.wRel = new Xf(this.wRel.basis.ortho().slerp(relT.basis.ortho(), k), this.wRel.origin.lerp(relT.origin, k));
      }
      let wx = chestT.mul(this.wRel);
      if (this.fireKick > 0) {
        const pistol = this.holdClass === 'pistol';
        const kick = wx.basis.z.mul(0.05 * this.fireKick * (pistol ? 0.4 : 1));
        wx = new Xf(wx.basis.mul(M3.rx(this.fireKick * (pistol ? 0.3 : 0.12))), wx.origin.add(kick));
      }
      wxf = wx; handR = wx.origin; handRB = wx.basis; handL = wx.mulV(W.pt('fore'));
      if (this.holdClass === 'pistol') { poleL = v(-0.5, -1, 0.1); poleR = v(0.6, -1, 0.1); }
      else if (this.holdClass === 'mg' && isAim) poleL = v(-0.6, -1, 0);
      W.magState = 0; W.boltT = 0; W.openT = 0;
      if (act === 'reload') handL = this._reloadHand(ap, wx, chestT);
      else if (act === 'cycle') handL = this._cycleHand(ap, wx);
      else if (act === 'inspect') {
        const bp = wx.mulV(W.pt('boltPt'));
        handL = wx.mulV(W.pt('fore')).lerp(bp, seg(ap, 0.15, 0.35) * (1 - seg(ap, 0.75, 0.95)));
        W.boltT = seg(ap, 0.4, 0.5) * (1 - seg(ap, 0.6, 0.7)) * 0.5;
      }
      if (oneHand) { handL = null; handR = null; wxf = null; }
    }
    // ---------------- действия без оружия в руках ----------------
    if (act === 'bandage' || act === 'heal_other') {
      const k = this.actionT;
      const base = act === 'heal_other' ? chestT.mulV(v(0, -0.3, -0.45)) : chestT.mulV(v(-0.02, -0.12, -0.34));
      handL = base.add(v(-0.05, 0, 0));
      handR = base.add(v(Math.cos(k * 9) * 0.07 + 0.06, Math.sin(k * 9) * 0.06, Math.sin(k * 9 + 1) * 0.05)); handRB = null;
      poleL = v(-0.8, -0.6, 0.3); poleR = v(0.8, -0.6, 0.3);
    } else if (act === 'repair') {
      const k = this.actionT; // работа стоя: руки на уровне пояса у объекта перед собой
      handL = chestT.mulV(v(-0.14, -0.28 + Math.sin(k * 3) * 0.03, -0.42));
      handR = chestT.mulV(v(0.12, -0.24 + Math.abs(Math.sin(k * 6)) * 0.16, -0.4)); handRB = null;
      poleL = v(-0.8, -0.2, 0.4); poleR = v(0.8, 0, 0.5);
    } else if (act === 'throw') {
      // бросок гранаты стоя: замах из-за головы и выброс руки вперёд
      const back = chestT.mulV(v(0.24, 0.34, 0.2)), start = chestT.mulV(v(0.2, -0.18, -0.16)), out = chestT.mulV(v(0.1, 0.26, -0.64));
      handR = ap < 0.45 ? start.lerp(back, seg(ap, 0, 0.45)) : back.lerp(out, seg(ap, 0.45, 0.62)); handRB = null; poleR = v(1, 0.3, 0.4);
      handL = chestT.mulV(v(-0.16, 0.08, -0.42)).lerp(chestT.mulV(v(-0.2, -0.32, -0.08)), seg(ap, 0.45, 0.75)); poleL = v(-0.8, -0.3, 0.3);
    } else if (act === 'salute') {
      const k = seg(ap, 0, 0.2) * (1 - seg(ap, 0.8, 1));
      handR = chestT.mulV(v(0.22, -0.55, 0)).lerp(headT.mulV(v(0.1, 0.12, -0.08)), k); handRB = null; poleR = v(1, 0.2, 0);
    } else if (act === 'pickup' || act === 'use') {
      const k = Math.sin(ap * PI);
      const reach = act === 'pickup' ? v(-0.18, 0.7, -0.55) : chestT.mulV(v(-0.1, 0.05 + k * 0.05, -0.45));
      handL = chestT.mulV(v(-0.1, -0.35, -0.3)).lerp(reach, act === 'pickup' ? k : 1); poleL = v(-0.8, -0.5, 0.4);
    } else if (act === 'talk' && !handL) handL = chestT.mulV(v(-0.2, -0.3 + Math.sin(this.actionT * 3) * 0.05, -0.28));
    // ---------------- руки ----------------
    const arms = {};
    for (const side of [-1, 1]) {
      const shP = side < 0 ? shL : shR, tgt = side < 0 ? handL : handR, pole = side < 0 ? poleL : poleR;
      if (!tgt) {
        const opp = this.feet[side < 0 ? 1 : 0], oppRel = inv.mulV(opp.cur);
        let swingAmt = clamp(-oppRel.z * 1.35, -0.75, 0.75) * this.gaitW, elbow = lerp(0.25, 1.35, runK);
        if (shamble > 0) { swingAmt = swingAmt * 0.3 + shamble * 0.9; elbow = 0.5; }
        const uaB = chestB.mul(M3.rz(side * (0.12 + runK * 0.1))).mul(M3.rx(swingAmt * lerp(0.55, 0.9, runK) + 0.02 + breathe));
        const faB = uaB.mul(M3.rx(elbow + Math.max(0, swingAmt) * 0.5));
        arms[side] = [uaB, faB, faB];
      } else {
        const handUp = side > 0 && handRB ? handRB.mulV(UP) : UP;
        const wrist = tgt.add(handUp.mul(0.065));
        const elbowP = ik(shP, wrist, UPPER, FORE, pole);
        const uaB = M3.yFwd(shP.sub(elbowP).norm(), wrist.sub(elbowP));
        const wr = elbowP.add(wrist.sub(elbowP).norm().mul(FORE));
        const faB = M3.yFwd(elbowP.sub(wr).norm(), shP.sub(elbowP));
        arms[side] = [uaB, faB, side > 0 && handRB ? handRB : faB];
      }
    }
    // ---------------- положение оружия ----------------
    this.weaponXf = null;
    if (W) {
      if (!armed || stowed) {
        this.weaponXf = this.holdClass === 'pistol'
          ? hipsT.mul(new Xf(M3.rx(-PI / 2), v(0.2, -0.04, -0.02)))
          : chestT.mul(new Xf(M3.rz(0.9).mul(M3.ry(PI)), v(0, 0, 0.2)));
        W.magState = 0; W.boltT = 0; W.openT = 0;
      } else if (!wxf) {
        const [uaB, faB, hb] = arms[1];
        const wrist = shR.add(uaB.mulV(v(0, -UPPER, 0))).add(faB.mulV(v(0, -FORE, 0)));
        this.weaponXf = new Xf(hb, wrist.add(hb.mulV(v(0, -0.065, 0))));
      } else this.weaponXf = wxf;
      W.update(dt);
    }
    // ---------------- запись в скелет ----------------
    const g = this.g;
    g[B.HIPS] = hipsB; g[B.SPINE] = spineB; g[B.CHEST] = chestB; g[B.NECK] = neckB; g[B.HEAD] = headB;
    [g[B.UA_L], g[B.FA_L], g[B.HAND_L]] = arms[-1];
    [g[B.UA_R], g[B.FA_R], g[B.HAND_R]] = arms[1];
    [g[B.TH_L], g[B.SH_L], g[B.FOOT_L]] = legs[0];
    [g[B.TH_R], g[B.SH_R], g[B.FOOT_R]] = legs[1];
    this._fk(this.hipsPos);
  }

  // Прямая кинематика: глобальные базисы g[] уже известны, позиции — от родителя по длинам костей
  _fk(hipsPos) {
    const g = this.g, O = this.O;
    O[0] = hipsPos.clone();
    for (let i = 1; i < NB; i++) { const p = PARENT[i]; O[i] = O[p].add(g[p].mulV(BP[i])); }
    const out = this.body.bones;
    for (let i = 0; i < NB; i++) {
      const b = g[i], o = O[i].sub(b.mulV(REST[i])), k = i * 16;
      out[k] = b.x.x; out[k + 1] = b.x.y; out[k + 2] = b.x.z; out[k + 3] = 0;
      out[k + 4] = b.y.x; out[k + 5] = b.y.y; out[k + 6] = b.y.z; out[k + 7] = 0;
      out[k + 8] = b.z.x; out[k + 9] = b.z.y; out[k + 10] = b.z.z; out[k + 11] = 0;
      out[k + 12] = o.x; out[k + 13] = o.y; out[k + 14] = o.z; out[k + 15] = 1;
    }
  }

  _weaponTarget(state, prof, chestT, chestB, aimYaw) {
    if (state === 'aim') {
      const a = prof.aim;
      let wdir = v(-Math.sin(aimYaw), 0, -Math.cos(aimYaw));
      wdir = wdir.mul(Math.cos(this.smoothPitch)).add(UP.mul(Math.sin(this.smoothPitch))).norm();
      const wb = M3.look(wdir, UP, 0);
      if (a.mode === 'extended') return new Xf(wb, chestT.mulV(v(0, 0.12, 0)).add(wdir.mul(a.reach ?? 0.48)).add(v(0, -0.02, 0)));
      if (a.mode === 'hip') return new Xf(wb, chestT.mulV(a.anchor));
      const anchor = chestT.mulV(a.anchor), st = this.weapon.pt('stock');
      return new Xf(wb, anchor.sub(wb.mulV(st)).add(v(0, -(prof.eyeDrop || 0), 0)));
    }
    const d = prof[state] || prof.low;
    const fwd = chestB.mulV(d.f.norm()), up = chestB.mulV(v(0.1, 1, 0.15));
    return new Xf(M3.look(fwd, up, d.r || 0), chestT.mulV(d.g));
  }

  _reloadTilt(ap) {
    const k = seg(ap, 0, 0.12) * (1 - seg(ap, 0.88, 1));
    switch (this.weapon.reloadKind) {
      case 'break': return new Xf(M3.rx(-0.5 * k), v(0, 0.05 * k, 0));
      case 'pistol': return new Xf(M3.rz(0.4 * k).mul(M3.rx(0.5 * k)), v(-0.05 * k, 0.12 * k, 0.05 * k));
      case 'box': return new Xf(M3.rz(-0.3 * k), v(0, 0.06 * k, 0.04 * k));
      case 'drum': return new Xf(M3.rz(0.6 * k), v(0, 0.05 * k, 0.05 * k));
      case 'clip': case 'shells': return new Xf(M3.rz(-0.5 * k), v(0, 0.08 * k, 0.05 * k));
      default: return new Xf(M3.rz(0.55 * k).mul(M3.rx(0.2 * k)), v(0, 0.06 * k, 0.03 * k));
    }
  }

  // Магазин в руке: его точка хвата совпадает с ладонью
  _magFollow(hand, wx) {
    const W = this.weapon, lh = wx.inv().mulV(hand);
    W.magHand = new Xf(new M3(), lh.sub(W.pt('magPt').sub(W.pt('magOrigin'))));
    W.magState = 1;
  }

  // Траектория левой руки и состояние частей оружия во время перезарядки
  _reloadHand(k, wx, chestT) {
    const W = this.weapon;
    const fore = wx.mulV(W.pt('fore')), magp = wx.mulV(W.pt('magPt')), boltp = wx.mulV(W.pt('boltPt'));
    const pouch = chestT.mulV(v(-0.06, -0.24, -0.16));
    const boltAx = wx.basis.mulV(W.pt('boltAxis'));
    let h = fore;
    switch (W.reloadKind) {
      case 'mag': case 'pistol': {
        const out = magp.add(magp.sub(wx.mulV(W.pt('magOrigin'))).mul(0.3));
        if (k < 0.12) h = fore.lerp(magp, seg(k, 0, 0.12));
        else if (k < 0.32) { h = magp.lerp(pouch, seg(k, 0.12, 0.32)); this._magFollow(h, wx); }
        else if (k < 0.4) { h = pouch.add(v(0, Math.sin(k * 60) * 0.01, 0)); this._magFollow(h, wx); }
        else if (k < 0.62) { h = pouch.lerp(out, seg(k, 0.4, 0.62)); this._magFollow(h, wx); }
        else if (k < 0.7) { h = out.lerp(magp, seg(k, 0.62, 0.68)); if (k < 0.67) this._magFollow(h, wx); }
        else if (k < 0.88) {
          h = magp.lerp(boltp, seg(k, 0.7, 0.78));
          W.boltT = seg(k, 0.78, 0.83) * (1 - seg(k, 0.84, 0.87));
          h = h.add(boltAx.mul(W.boltT));
        } else h = boltp.lerp(fore, seg(k, 0.88, 1));
        break;
      }
      case 'box': {
        if (k < 0.18) { h = fore.lerp(boltp, seg(k, 0, 0.1)); W.openT = seg(k, 0.1, 0.18); }
        else if (k < 0.35) { W.openT = 1; h = boltp.lerp(magp, seg(k, 0.18, 0.24)).lerp(pouch, seg(k, 0.24, 0.35)); if (k > 0.24) this._magFollow(h, wx); }
        else if (k < 0.6) { W.openT = 1; h = pouch.lerp(magp, seg(k, 0.4, 0.58)); this._magFollow(h, wx); }
        else if (k < 0.85) { W.openT = 1 - seg(k, 0.74, 0.82); h = magp.lerp(boltp, seg(k, 0.62, 0.72)); }
        else h = boltp.lerp(fore, seg(k, 0.85, 1));
        break;
      }
      case 'clip': {
        if (k < 0.2) { h = fore.lerp(boltp, seg(k, 0, 0.12)); W.boltT = seg(k, 0.12, 0.2); h = h.add(boltAx.mul(W.boltT)); }
        else if (k < 0.7) {
          W.boltT = 1;
          if (k < 0.35) h = boltp.lerp(pouch, seg(k, 0.2, 0.35));
          else if (k < 0.48) { h = pouch.lerp(magp.add(v(0, 0.05, 0)), seg(k, 0.35, 0.48)); this._magFollow(h, wx); }
          else { h = magp.add(v(0, 0.05 - Math.abs(Math.sin((k - 0.48) * 40)) * 0.05, 0)); W.magState = k < 0.66 ? 0 : 2; }
        } else if (k < 0.86) { h = magp.lerp(boltp.add(boltAx), seg(k, 0.7, 0.78)); W.boltT = 1 - seg(k, 0.78, 0.86); W.magState = 2; }
        else { W.magState = 2; h = boltp.lerp(fore, seg(k, 0.86, 1)); }
        break;
      }
      case 'break': {
        W.openT = seg(k, 0.05, 0.18) * (1 - seg(k, 0.82, 0.92));
        if (k < 0.2) h = fore;
        else if (k < 0.8) h = pouch.lerp(magp, Math.sin(fmod((k - 0.2) / 0.3, 1) * PI));
        else h = magp.lerp(fore, seg(k, 0.8, 0.9));
        break;
      }
      case 'shells': {
        if (k < 0.8) h = pouch.lerp(magp, Math.sin(fmod(k / 0.27, 1) * PI));
        else { h = magp.lerp(boltp, seg(k, 0.8, 0.85)); W.boltT = seg(k, 0.86, 0.92) * (1 - seg(k, 0.93, 0.99)); h = h.add(boltAx.mul(W.boltT)); }
        break;
      }
      case 'drum': {
        W.openT = seg(k, 0.05, 0.15) * (1 - seg(k, 0.85, 0.93));
        if (k < 0.15) h = fore.lerp(magp, seg(k, 0, 0.15));
        else if (k < 0.85) h = pouch.lerp(magp.add(v(0.09, 0, 0)), Math.sin(fmod((k - 0.15) / 0.233, 1) * PI));
        else h = magp.lerp(fore, seg(k, 0.85, 1));
        break;
      }
    }
    return h;
  }

  // Передёргивание помпы/затвора после выстрела (КС-23, винтовка Мосина)
  _cycleHand(k, wx) {
    const W = this.weapon, fore = wx.mulV(W.pt('fore')), boltp = wx.mulV(W.pt('boltPt')), ax = wx.basis.mulV(W.pt('boltAxis'));
    W.boltT = Math.sin(k * PI);
    if (W.reloadKind === 'shells') return fore.add(ax.mul(W.boltT));
    return fore.lerp(boltp, Math.sin(k * PI)).add(ax.mul(W.boltT * 0.5));
  }

  // ---------------- смерть ----------------
  die() {
    if (this.dead) return;
    this.dead = true; this.deathT = 0; this.action = '';
    const g = this.g;
    this.deathFrom = g.map((b, i) => (PARENT[i] < 0 ? b.ortho().toQuat() : g[PARENT[i]].T().mul(b).ortho().toQuat()));
    this.deathHipsFrom = this.hipsPos.clone();
    const rr = (a, b) => a + Math.random() * (b - a), back = Math.random() < 0.6, yaw = rr(-0.4, 0.4);
    const to = Array.from({ length: NB }, () => IDQ.slice());
    to[B.HIPS] = M3.ry(yaw).mul(M3.rx(back ? PI / 2 : -PI / 2)).toQuat();
    this.deathHipsTo = v(0, 0.14, back ? 0.82 : -0.82);
    to[B.SPINE] = M3.rx(rr(-0.1, 0.1)).toQuat(); to[B.CHEST] = M3.rz(rr(-0.15, 0.15)).toQuat();
    to[B.NECK] = M3.ry(rr(-0.6, 0.6)).toQuat(); to[B.HEAD] = M3.ry(rr(-0.5, 0.5)).toQuat();
    to[B.UA_L] = M3.rz(rr(0.5, 1.4)).toQuat(); to[B.FA_L] = M3.rx(rr(0.1, 0.9)).toQuat();
    to[B.UA_R] = M3.rz(-rr(0.5, 1.4)).toQuat(); to[B.FA_R] = M3.rx(rr(0.1, 0.9)).toQuat();
    to[B.TH_L] = M3.rz(rr(-0.25, 0)).mul(M3.rx(rr(0, 0.5))).toQuat(); to[B.SH_L] = M3.rx(-rr(0, 0.8)).toQuat();
    to[B.TH_R] = M3.rz(rr(0, 0.25)).mul(M3.rx(rr(0, 0.3))).toQuat(); to[B.SH_R] = M3.rx(-rr(0, 0.5)).toQuat();
    to[B.FOOT_L] = M3.rx(0.6).toQuat(); to[B.FOOT_R] = M3.rx(0.6).toQuat();
    this.deathTo = to;
  }
  _updateDeath(dt) {
    if (this.deathT >= 1) return;
    this.deathT = Math.min(1, this.deathT + dt / 0.75);
    const k = this.deathT * this.deathT, kb = 1 - Math.pow(1 - this.deathT, 3);
    for (let i = 0; i < NB; i++) {
      const lq = M3.fromQuat(qslerpLocal(this.deathFrom[i], this.deathTo[i], i === B.HIPS ? k : kb));
      this.g[i] = PARENT[i] < 0 ? lq : this.g[PARENT[i]].mul(lq);
    }
    this._fk(this.deathHipsFrom.lerp(this.deathHipsTo, k));
    if (this.weapon && this.deathT > 0.3) { this.weaponXf = new Xf(M3.ry(0.7).mul(M3.rz(PI / 2)), v(0.5, 0.03, 0.35)); this.weapon.magState = 0; }
  }

  // Передача трансформаций в объекты рендера
  _writeObjects() {
    const xf = this.xf;
    xf.toMat4(this.body.model);
    this.body.wc = xf.origin.add(v(0, 0.8, 0)); this.body.wr = 1.7;
    const W = this.weapon;
    if (!W) return;
    const base = this.weaponXf ? xf.mul(this.weaponXf) : null;
    for (const part of ['body', 'mag', 'bolt', 'barrel']) {
      const o = this.wparts[part]; if (!o) continue;
      const px = part === 'body' ? new Xf() : W.partXf(part);
      o._partVis = !!(base && px);
      o.visible = this.visible && o._partVis;
      if (o._partVis) o.setXf(base.mul(px));
    }
  }
}

function moveToward(a, b, d) { return Math.abs(b - a) <= d ? b : a + Math.sign(b - a) * d; }
function qslerpLocal(a, b, t) {
  let [ax, ay, az, aw] = a; let [bx, by, bz, bw] = b;
  let d = ax * bx + ay * by + az * bz + aw * bw;
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0, k1;
  if (d > 0.9995) { k0 = 1 - t; k1 = t; } else { const th = Math.acos(d), s = Math.sin(th); k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s; }
  const q = [ax * k0 + bx * k1, ay * k0 + by * k1, az * k0 + bz * k1, aw * k0 + bw * k1], l = Math.hypot(...q);
  return q.map((x) => x / l);
}
