// Люди и существа: скелетная анимация → кадры в изометрии (подключается из baker.js).
// Клипы берутся из файла-источника (герой «Стикса», скелет Mixamo, 45 клипов с винтовкой) и переносятся на
// любое тело со скелетом (Mixamo или Tripo) по смыслу костей с поправкой позы покоя.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* Кости по смыслу: имя Mixamo → варианты в других скелетах */
const MAP = {
  Hips: ['mixamorigHips', 'Hip', 'Hips', 'Pelvis'],
  Spine: ['mixamorigSpine', 'Waist', 'Spine'],
  Spine1: ['mixamorigSpine1', 'Spine01', 'Spine1'],
  Spine2: ['mixamorigSpine2', 'Spine02', 'Spine2', 'Chest'],
  Neck: ['mixamorigNeck', 'NeckTwist01', 'Neck'],
  Head: ['mixamorigHead', 'Head'],
  LeftShoulder: ['mixamorigLeftShoulder', 'L_Clavicle', 'LeftShoulder'],
  LeftArm: ['mixamorigLeftArm', 'L_Upperarm', 'LeftArm', 'LeftUpperArm'],
  LeftForeArm: ['mixamorigLeftForeArm', 'L_Forearm', 'LeftForeArm', 'LeftLowerArm'],
  LeftHand: ['mixamorigLeftHand', 'L_Hand', 'LeftHand'],
  RightShoulder: ['mixamorigRightShoulder', 'R_Clavicle', 'RightShoulder'],
  RightArm: ['mixamorigRightArm', 'R_Upperarm', 'RightArm', 'RightUpperArm'],
  RightForeArm: ['mixamorigRightForeArm', 'R_Forearm', 'RightForeArm', 'RightLowerArm'],
  RightHand: ['mixamorigRightHand', 'R_Hand', 'RightHand'],
  LeftUpLeg: ['mixamorigLeftUpLeg', 'L_Thigh', 'LeftUpLeg', 'LeftUpperLeg'],
  LeftLeg: ['mixamorigLeftLeg', 'L_Calf', 'LeftLeg', 'LeftLowerLeg'],
  LeftFoot: ['mixamorigLeftFoot', 'L_Foot', 'LeftFoot'],
  LeftToeBase: ['mixamorigLeftToeBase', 'L_ToeBase', 'LeftToeBase', 'LeftToes'],
  RightUpLeg: ['mixamorigRightUpLeg', 'R_Thigh', 'RightUpLeg', 'RightUpperLeg'],
  RightLeg: ['mixamorigRightLeg', 'R_Calf', 'RightLeg', 'RightLowerLeg'],
  RightFoot: ['mixamorigRightFoot', 'R_Foot', 'RightFoot'],
  RightToeBase: ['mixamorigRightToeBase', 'R_ToeBase', 'RightToeBase', 'RightToes']
};
const CHILD = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' };
const ORDER = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];

function findBones(root) {
  const all = {};
  root.traverse((o) => { if (o.isBone) all[o.name] = o; });
  const out = {};
  for (const k in MAP) for (const n of MAP[k]) if (all[n]) { out[k] = all[n]; break; }
  return out;
}

/* Тело: копия сцены с костями, приведённая к росту h (м), стопы на земле, лицом к +Z */
export function makeBody(gltf, h) {
  const root = SkeletonUtils.clone(gltf.scene);
  root.traverse((m) => {
    if (m.isMesh) {
      m.frustumCulled = false;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => { if (mt.map) mt.map.anisotropy = 8; if ('metalness' in mt) mt.metalness = Math.min(mt.metalness, 0.3); if ('roughness' in mt) mt.roughness = Math.max(mt.roughness, 0.6); });
    }
  });
  const holder = new THREE.Group(); const fix = new THREE.Group();
  fix.add(root); holder.add(fix);
  holder.updateMatrixWorld(true);
  // покой — поза привязки скелета (у файлов с движениями Tripo сцена сохранена в первом кадре движения)
  const seen = new Set();
  root.traverse((m) => { if (m.isSkinnedMesh && m.skeleton && !seen.has(m.skeleton)) { seen.add(m.skeleton); m.skeleton.pose(); } });
  holder.updateMatrixWorld(true);
  const B = findBones(root);
  let up, fwd;
  const human = !!(B.LeftUpLeg && B.RightUpLeg && B.Head && B.Hips);
  if (human) {
    // человек: «вперёд» по костям — вверх × (правое бедро − левое)
    const pl = B.LeftUpLeg.getWorldPosition(V()), pr = B.RightUpLeg.getWorldPosition(V());
    const head = B.Head.getWorldPosition(V()), hip = B.Hips.getWorldPosition(V());
    up = head.clone().sub(hip).normalize();
    const right = pr.clone().sub(pl); right.addScaledVector(up, -right.dot(up)).normalize();
    fwd = V().crossVectors(up, right).normalize();
  } else {
    // четвероногие и прочие (скелет Tripo: tripoRoot, tripoHead…): вверх — +Y, вперёд — к голове
    let head = null, rb = null;
    root.traverse((o) => { if (o.isBone) { if (!rb) rb = o; if (!head && /head/i.test(o.name)) head = o; } });
    up = V(0, 1, 0);
    fwd = head && rb ? head.getWorldPosition(V()).sub(rb.getWorldPosition(V())) : V(0, 0, 1);
    fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1); fwd.normalize();
    B.Hips = B.Hips || rb; B.Head = B.Head || head || rb;
  }
  // поворот: up → +Y, fwd → +Z
  const m = new THREE.Matrix4().makeBasis(V().crossVectors(up, fwd).normalize(), up, fwd);
  const q = new THREE.Quaternion().setFromRotationMatrix(m).invert();
  fix.quaternion.copy(q);
  holder.updateMatrixWorld(true);
  // рост и стопы
  const box = new THREE.Box3().setFromObject(fix, true);
  const headTop = B.Head.getWorldPosition(V()).y;
  const tall = (headTop - box.min.y) * 1.1; // макушка выше кости головы
  // у людей рост — до макушки (руки в Т-позе не мешают), у существ — по габаритам модели
  const k = human ? h / Math.max(tall, box.max.y - box.min.y > tall * 1.4 ? tall : box.max.y - box.min.y) : h / Math.max(0.01, box.max.y - box.min.y);
  fix.scale.setScalar(k);
  holder.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(fix, true);
  const c = box2.getCenter(V());
  const hp = B.Hips.getWorldPosition(V());
  fix.position.set(-hp.x, -box2.min.y, -hp.z);
  holder.updateMatrixWorld(true);
  return { holder, fix, root, B, k, rest: snapshot(B) };
}

function snapshot(B) {
  const s = {};
  for (const k in B) {
    const b = B[k];
    s[k] = { q: b.quaternion.clone(), p: b.position.clone(), wq: b.getWorldQuaternion(new THREE.Quaternion()), wp: b.getWorldPosition(V()) };
  }
  return s;
}

/* Перенос позы источника на тело: для каждой кости — поворот «от покоя» в мировых осях с поправкой
   направления кости (Т/А-поза), корень — смещение бёдер в масштабе роста */
export function makeRetarget(src, dst) {
  const align = {};
  for (const k of ORDER) {
    if (!src.B[k] || !dst.B[k]) continue;
    const ch = CHILD[k];
    let a = new THREE.Quaternion();
    if (ch && src.B[ch] && dst.B[ch]) {
      const ds = src.rest[ch].wp.clone().sub(src.rest[k].wp).normalize();
      const dd = dst.rest[ch].wp.clone().sub(dst.rest[k].wp).normalize();
      a.setFromUnitVectors(dd, ds); // повернуть кость тела к направлению источника
    }
    align[k] = a;
  }
  const hipK = (dst.rest.Hips.wp.y) / Math.max(0.01, src.rest.Hips.wp.y);
  const tmpQ = new THREE.Quaternion(), pw = new THREE.Quaternion();
  return function apply(opts) {
    src.holder.updateMatrixWorld(true);
    for (const k of ORDER) {
      const sb = src.B[k], db = dst.B[k];
      if (!sb || !db) continue;
      // мировой поворот источника относительно его покоя
      const sw = sb.getWorldQuaternion(new THREE.Quaternion());
      const delta = sw.multiply(src.rest[k].wq.clone().invert());
      const target = delta.multiply(align[k]).multiply(dst.rest[k].wq);
      db.parent.getWorldQuaternion(pw);
      db.quaternion.copy(pw.invert().multiply(target));
      db.updateMatrixWorld(true);
      if (k === 'Hips') {
        const sp = sb.getWorldPosition(V());
        const off = sp.sub(src.rest.Hips.wp).multiplyScalar(hipK);
        if (!opts || !opts.rootMotion) { off.x = 0; off.z = 0; }
        const want = dst.rest.Hips.wp.clone().add(off);
        const loc = db.parent.worldToLocal(want);
        db.position.copy(loc);
        db.updateMatrixWorld(true);
      }
    }
  };
}

/* Двухзвенный IK: кость a (плечо) → b (локоть) → c (кисть) к точке target, колено/локоть — к pole */
export function ik2(a, b, c, target, pole) {
  const pa = a.getWorldPosition(V()), pb = b.getWorldPosition(V()), pc = c.getWorldPosition(V());
  const la = pa.distanceTo(pb), lb = pb.distanceTo(pc);
  const t = target.clone(); const d = Math.min(t.distanceTo(pa), la + lb - 1e-4);
  const dir = t.clone().sub(pa).normalize();
  // угол в плече по теореме косинусов
  const cosA = THREE.MathUtils.clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1);
  const ang = Math.acos(cosA);
  const pl = pole.clone().sub(pa); pl.addScaledVector(dir, -pl.dot(dir)); if (pl.lengthSq() < 1e-8) pl.set(0, -1, 0); pl.normalize();
  const elbow = pa.clone().addScaledVector(dir, Math.cos(ang) * la).addScaledVector(pl, Math.sin(ang) * la);
  aimBone(a, pb, elbow);
  b.updateMatrixWorld(true);
  aimBone(b, c.getWorldPosition(V()), pa.clone().addScaledVector(dir, d));
}
function aimBone(bone, childNow, want) {
  const p = bone.getWorldPosition(V());
  const from = childNow.clone().sub(p).normalize(), to = want.clone().sub(p).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(from, to);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion());
  const nq = q.multiply(wq);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(nq));
  bone.updateMatrixWorld(true);
}

/* Оружие: модель (ствол к −Z, длина 1) → группа с точками хвата.
   grip — доля длины от приклада до пистолетной рукояти, fore — до цевья; len — длина в метрах */
export function makeWeapon(gltf, w) {
  const obj = gltf.scene.clone(true);
  if (w.flip) { obj.rotation.y = Math.PI; obj.updateMatrixWorld(true); } // модель лежит дулом к +Z
  obj.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach((mt) => { if (mt.map) mt.map.anisotropy = 8; if ('metalness' in mt) mt.metalness = Math.min(mt.metalness, 0.4); }); } });
  const box = new THREE.Box3().setFromObject(obj, true);
  const size = box.getSize(V());
  const L = size.z; const k = w.len / L;
  const inner = new THREE.Group(); inner.add(obj);
  obj.scale.setScalar(k);
  // точка хвата — в начало координат группы: z от приклада (box.max.z) к дулу (box.min.z)
  const zg = box.max.z - w.grip * L, yg = box.min.y + (w.gy !== undefined ? w.gy : 0.3) * size.y;
  const cx = (box.min.x + box.max.x) / 2;
  obj.position.set(-cx * k, -yg * k, -zg * k);
  const g = new THREE.Group(); g.add(inner);
  const fore = V(0, (box.min.y + (w.fy !== undefined ? w.fy : 0.55) * size.y - yg) * k, -(w.fore - w.grip) * L * k);
  const muzzle = V(0, (box.min.y + (w.my !== undefined ? w.my : 0.75) * size.y - yg) * k, -(1 - w.grip) * L * k);
  // приклад: от точки хвата назад по оси (+Z) и чуть выше (середина затыльника)
  const buttZ = w.grip * L * k, buttY = (box.min.y + (w.by !== undefined ? w.by : 0.62) * size.y - yg) * k;
  return { g, fore, muzzle, len: w.len, buttZ, buttY, hipAim: !!w.hip, free: !!w.free };
}

/* Ладонь: середина между запястьем и основанием среднего пальца (или чуть дальше кости кисти) */
export function palm(B, side, root) {
  const hand = B[side + 'Hand'];
  let mid = null;
  hand.traverse((o) => { if (!mid && o !== hand && o.isBone && /Mid|Middle/.test(o.name)) mid = o; });
  const p = hand.getWorldPosition(V());
  if (mid) return p.lerp(mid.getWorldPosition(V()), 0.75);
  const fa = B[side + 'ForeArm'].getWorldPosition(V());
  return p.clone().add(p.clone().sub(fa).multiplyScalar(0.3));
}
