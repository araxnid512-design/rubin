// Запекание 3D-моделей в изометрические спрайты «Мёртвого мира» (запускается в Chromium из bake.js).
// Камера — ортографическая, 30° над землёй и 45° по азимуту, как ромб клетки 64×32 в игре:
// ось X модели → клетка +x (вправо-вниз), ось Z → клетка +y (влево-вниз), Y — вверх.
// Масштаб: человек 1,8 м = 55 точек при увеличении 1 (как процедурные фигуры), клетка ≈ 1,283 м.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as C from './chars.js';

const PPM = 55 / (1.8 * Math.cos(Math.PI / 6)); // точек на метр в плоскости камеры (увеличение 1)
const TILE_M = 32 / (Math.SQRT1_2 * PPM);        // метров в клетке вдоль оси
const EL = Math.PI / 6;
const CAMDIR = new THREE.Vector3(Math.cos(EL) * Math.SQRT1_2, Math.sin(EL), Math.cos(EL) * Math.SQRT1_2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xe4e8f2, 0x6a5a48, 1.5);
scene.add(hemi);
// солнце игры: тени ложатся к +x (вправо-вниз) — свет слева-сверху
const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
key.position.set(-0.95, 1.25, 0.25).multiplyScalar(10);
scene.add(key);
const fill = new THREE.DirectionalLight(0xa8bcdc, 0.55);
fill.position.set(0.9, 0.5, 0.7).multiplyScalar(10);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffe2c0, 1.3);
rim.position.set(-0.4, 0.8, -1).multiplyScalar(10);
scene.add(rim);

const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
cam.position.copy(CAMDIR).multiplyScalar(30);
cam.up.set(0, 1, 0);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = {};
function load(url) {
  if (!cache[url]) cache[url] = new Promise((res, rej) => loader.load(url, res, undefined, rej));
  return cache[url];
}

/* Проекция точки мира в плоскость камеры (единицы — метры) */
const camInv = new THREE.Matrix4();
function camSpace(v) { camInv.copy(cam.matrixWorld).invert(); return v.clone().applyMatrix4(camInv); }

function boxCorners(b) {
  const out = [];
  for (let i = 0; i < 8; i++) out.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
  return out;
}

/* Рамка кадра в плоскости камеры по коробке (метры), с запасом */
function frameFor(box, pad) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  boxCorners(box).forEach((c) => { const p = camSpace(c); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
  return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
}

/* Снимок сцены в рамке fr при масштабе ss; якорь — точка (0,0,0) мира в точках кадра */
function shoot(fr, ss) {
  const w = Math.max(2, Math.ceil((fr.x1 - fr.x0) * PPM * ss)), h = Math.max(2, Math.ceil((fr.y1 - fr.y0) * PPM * ss));
  cam.left = fr.x0; cam.right = fr.x0 + w / (PPM * ss); cam.top = fr.y1; cam.bottom = fr.y1 - h / (PPM * ss);
  cam.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.render(scene, cam);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  const o = camSpace(new THREE.Vector3(0, 0, 0));
  return { c, w, h, ax: (o.x - fr.x0) * PPM * ss, ay: (fr.y1 - o.y) * PPM * ss };
}

/* Тёмный контур в 1 точку (на масштабе 1) — как у процедурных фигур игры */
function outline(c, ss, a) {
  const w = c.width, h = c.height;
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  const g = t.getContext('2d');
  const r = Math.max(1, ss * 0.75);
  for (let k = 0; k < 8; k++) { const an = k / 8 * Math.PI * 2; g.drawImage(c, Math.cos(an) * r, Math.sin(an) * r); }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(22,15,10,' + (a || 0.85) + ')'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over'; g.drawImage(c, 0, 0);
  return t;
}

/* Обрезка по непрозрачному */
function trim(c) {
  const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { c, x: 0, y: 0, w: 1, h: 1 };
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const o = document.createElement('canvas'); o.width = w; o.height = h;
  o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return { c: o, x: x0, y: y0, w, h };
}

function prepStatic(root) {
  root.traverse((m) => {
    if (m.isMesh) {
      m.frustumCulled = false;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => { if (mt.map) mt.map.anisotropy = 8; mt.side = THREE.FrontSide; if ('metalness' in mt) mt.metalness = Math.min(mt.metalness, 0.35); if ('roughness' in mt) mt.roughness = Math.max(mt.roughness, 0.55); });
    }
  });
}

/* ---------- Реквизит: одна модель → спрайт ----------
   spec: { src, node?, yaw (градусы), len (клеток по большей стороне), hMax (м), ss, mirror } */
async function prop(spec) {
  const gl = await load(spec.src);
  let src = gl.scene;
  if (spec.node) { src = gl.scene.getObjectByName(spec.node); if (!src) throw new Error('нет узла ' + spec.node); }
  const obj = src.clone(true);
  obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.scale.set(1, 1, 1);
  prepStatic(obj);
  const holder = new THREE.Group(); holder.add(obj);
  obj.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(obj, true);
  const sz = b.getSize(new THREE.Vector3());
  let k = 1;
  if (spec.len) k = spec.len * TILE_M / Math.max(sz.x, sz.z);
  if (spec.h) k = spec.h / sz.y;
  if (spec.hMax && sz.y * k > spec.hMax) k = spec.hMax / sz.y;
  if (spec.k) k *= spec.k;
  obj.scale.setScalar(k);
  const ctr = b.getCenter(new THREE.Vector3());
  obj.position.set(-ctr.x * k, -b.min.y * k, -ctr.z * k);
  holder.rotation.y = (spec.yaw || 0) * Math.PI / 180;
  if (spec.sx || spec.sy || spec.sz) holder.scale.set(spec.sx || 1, spec.sy || 1, spec.sz || 1);
  scene.add(holder);
  holder.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(holder, true);
  const ss = spec.ss || 2;
  const fr = frameFor(b, 0.15);
  const s = shoot(fr, ss);
  scene.remove(holder);
  let c = outline(s.c, ss, 0.7);
  if (spec.raw) return { c, ax: s.ax, ay: s.ay };
  const t = trim(c);
  const size = b.getSize(new THREE.Vector3());
  return { png: t.c.toDataURL('image/png'), w: t.w, h: t.h, ax: s.ax - t.x, ay: s.ay - t.y, ss, size: [size.x / TILE_M, size.z / TILE_M, size.y] };
}

/* Список узлов файла (для подбора) */
async function nodes(src) {
  const gl = await load(src);
  return gl.scene.children.map((n) => n.name);
}

window.BK = { prop, nodes, load, C, CAMDIR, THREE, SkeletonUtils, scene, cam, renderer, shoot, frameFor, outline, trim, camSpace, PPM, TILE_M, ready: true };

/* ---------- Люди и существа: кадры анимаций по 8 направлениям ----------
   Тела людей двигаются клипами героя «Стикса» (скелет Mixamo, клипы с винтовкой), перенесёнными на их скелет;
   существа — своими клипами Tripo. Оружие — отдельный слой: та же поза, тело пишет только глубину (прячет
   ствол за собой), контур оружия не заходит на тело. */
const bodies = {};
async function getRig(url, h) {
  const key = url + '|' + h;
  if (bodies[key]) return bodies[key];
  const gl = await load(url);
  const b = C.makeBody(gl, h);
  b.gl = gl;
  b.mixer = new THREE.AnimationMixer(b.root);
  b.meshes = []; b.root.traverse((m) => { if (m.isMesh) b.meshes.push(m); });
  b.restPos = new Map(); b.root.traverse((o) => { if (o.isBone) b.restPos.set(o, o.position.clone()); });
  bodies[key] = b;
  return b;
}
function findClip(rig, name) {
  if (name === '*') return rig.gl.animations[0];
  const lc = name.toLowerCase();
  return rig.gl.animations.find((a) => a.name === name) || rig.gl.animations.find((a) => a.name.toLowerCase() === lc) ||
    rig.gl.animations.find((a) => a.name.toLowerCase().indexOf(lc) >= 0);
}
function poseRig(rig, clipName, t, keepRoot) {
  const clip = findClip(rig, clipName);
  if (!clip) throw new Error('нет клипа ' + clipName + ' (' + rig.gl.animations.map((a) => a.name).join(',') + ')');
  rig.mixer.stopAllAction();
  const act = rig.mixer.clipAction(clip);
  act.reset(); act.play();
  rig.mixer.setTime(Math.min(Math.max(0, t), clip.duration - 1e-3));
  if (!keepRoot) {
    // без хода корня по земле: бёдра и все кости-предки (у Tripo — BoneRoot) остаются над точкой стоп
    for (let b = rig.B.Hips; b && b.isBone; b = b.parent) {
      const r = rig.restPos.get(b);
      if (r) { b.position.x = r.x; b.position.z = r.z; }
    }
  }
  rig.holder.updateMatrixWorld(true);
  return clip;
}
/* присед: бёдра ниже на drop метров, стопы остаются на месте (IK ног), колени — вперёд */
function crouch(rig, drop) {
  const B = rig.B;
  const feet = ['Left', 'Right'].map((s) => B[s + 'Foot'].getWorldPosition(new THREE.Vector3()));
  const hp = B.Hips.getWorldPosition(new THREE.Vector3()); hp.y -= drop;
  B.Hips.position.copy(B.Hips.parent.worldToLocal(hp));
  // наклон корпуса вперёд
  const sp = B.Spine;
  if (sp) { sp.rotateX(drop * 0.55); }
  rig.holder.updateMatrixWorld(true);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.holder.getWorldQuaternion(new THREE.Quaternion()));
  ['Left', 'Right'].forEach((s, i) => {
    const knee = B[s + 'Leg'].getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 0.6);
    C.ik2(B[s + 'UpLeg'], B[s + 'Leg'], B[s + 'Foot'], feet[i], knee);
  });
}
const WCAL = {};
function weaponOff(dst, src, rt, wpn, calib) {
  dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
  poseRig(src, calib || 'IdleRifle', 0);
  if (rt) rt();
  const R = C.palm(dst.B, 'Right'), L = C.palm(dst.B, 'Left');
  const zAx = R.clone().sub(L).normalize();
  const yAx = new THREE.Vector3(0, 1, 0); yAx.addScaledVector(zAx, -yAx.dot(zAx)).normalize();
  const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
  const W = new THREE.Matrix4().makeBasis(xAx, yAx, zAx).setPosition(R);
  const hand = dst.B.RightHand;
  const HM = new THREE.Matrix4().compose(hand.getWorldPosition(new THREE.Vector3()), hand.getWorldQuaternion(new THREE.Quaternion()), new THREE.Vector3(1, 1, 1));
  return HM.invert().multiply(W);
}
/* ---------- Хват от корпуса ----------
   Оружие ставится относительно корпуса (а не кисти): «прицел» — приклад в правом плече, ствол вперёд;
   «переноска» — приклад у правой стороны груди, ствол вперёд-вниз и чуть к середине. Затем руки тянутся
   к рукояти (правая) и цевью (левая) двухзвенным IK. Так хват верен на любом скелете и при любом переносе движений. */
const GRIP = {
  // butt: смещение приклада от правого плеча в осях корпуса (м: x — вправо, y — вверх, z — вперёд);
  // pitch: ствол вверх(+)/вниз(−), yaw: к середине тела(+), roll: завал (°)
  // level — ствол по горизонту (pitch от горизонта, а не от наклона корпуса): из-за угла, с колена, пригнувшись
  // боец целится вперёд, а не в землю; minEl — ниже этого угла ствол не опускается; ground — дуло не уходит в землю
  aim: { butt: [-0.06, -0.01, -0.03], pitch: 2, yaw: 4, roll: 0, level: true },
  carry: { butt: [-0.04, -0.13, 0.03], pitch: -30, yaw: 20, roll: -10, minEl: -32, ground: true },
  hip: { butt: [0.0, -0.34, 0.0], pitch: 0, yaw: 6, roll: 0, level: true },
  // за спиной: приклад у правого бедра сзади, ствол вверх над левым плечом
  sling: { butt: [-0.12, -0.6, -0.17], pitch: 60, yaw: 30, roll: 0, back: true }
};
function torso(dst) {
  const B = dst.B;
  const R = B.RightArm.getWorldPosition(new THREE.Vector3()), L = B.LeftArm.getWorldPosition(new THREE.Vector3());
  const top = (B.Neck || B.Head).getWorldPosition(new THREE.Vector3()), hip = B.Hips.getWorldPosition(new THREE.Vector3());
  const X = R.clone().sub(L).normalize();
  const Y = top.clone().sub(hip); Y.addScaledVector(X, -Y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(Y, X).normalize();
  return { R, L, X, Y, Z };
}
/* матрица оружия по корпусу: g — настройки группы, adj — поправка {p:[x,y,z], r:[pitch,yaw,roll]} */
function gunMatrix(dst, wpn, g, adj) {
  const T = torso(dst);
  const p = adj && adj.p ? adj.p : [0, 0, 0], r = adj && adj.r ? adj.r : [0, 0, 0];
  const bx = g.butt[0] + p[0], by = g.butt[1] + p[1], bz = g.butt[2] + p[2];
  const butt = T.R.clone().addScaledVector(T.X, bx).addScaledVector(T.Y, by).addScaledVector(T.Z, bz);
  const pitch = (g.pitch + r[0]) * Math.PI / 180, yaw = (g.yaw + r[1]) * Math.PI / 180, roll = (g.roll + r[2]) * Math.PI / 180;
  // направление ствола: вперёд (за спиной — назад), поворот к середине (к −X корпуса) и вверх/вниз
  const UP = new THREE.Vector3(0, 1, 0);
  let dir;
  if (g.level) {
    // по горизонту: курс — от корпуса, наклон — от горизонта
    const zh = T.Z.clone(); zh.y = 0; zh.normalize();
    const xh = T.X.clone(); xh.y = 0; xh.normalize();
    dir = zh.multiplyScalar(Math.cos(pitch) * Math.cos(yaw)).addScaledVector(xh, -Math.cos(pitch) * Math.sin(yaw)).addScaledVector(UP, Math.sin(pitch)).normalize();
  } else {
    dir = T.Z.clone().multiplyScalar((g.back ? -1 : 1) * Math.cos(pitch) * Math.cos(yaw)).addScaledVector(T.X, -Math.cos(pitch) * Math.sin(yaw)).addScaledVector(T.Y, Math.sin(pitch)).normalize();
  }
  let el = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  let elMin = g.minEl !== undefined ? g.minEl * Math.PI / 180 : -Math.PI / 2;
  // дуло не в землю: точка в 1,45 м от приклада по стволу не ниже 8 см (одинаково для всех стволов — руки тел совпадают)
  if (g.ground) elMin = Math.max(elMin, Math.asin(Math.max(-1, Math.min(1, (0.08 - butt.y) / 1.45))));
  if (el < elMin) {
    const h = dir.clone(); h.y = 0;
    if (h.lengthSq() < 1e-6) h.copy(T.Z).setY(0);
    h.normalize();
    dir = h.multiplyScalar(Math.cos(elMin)).addScaledVector(UP, Math.sin(elMin)).normalize();
  }
  const zW = dir.clone().negate();                       // ось +Z оружия смотрит к прикладу
  const upRef = g.level ? UP : T.Y;
  let yW = upRef.clone().addScaledVector(zW, -upRef.dot(zW)).normalize();
  yW.applyAxisAngle(dir, roll);
  const xW = new THREE.Vector3().crossVectors(yW, zW).normalize();
  yW = new THREE.Vector3().crossVectors(zW, xW).normalize();
  const M = new THREE.Matrix4().makeBasis(xW, yW, zW);
  // начало группы — точка хвата: приклад в (0, by0, +buttZ) локально
  const buttL = new THREE.Vector3(0, wpn.buttY || 0.03, wpn.buttZ);
  const origin = butt.clone().sub(buttL.applyMatrix4(new THREE.Matrix4().extractRotation(M)));
  M.setPosition(origin);
  return M;
}
function reach(dst, side, target, pole) {
  const B = dst.B, P = C.palm(B, side);
  const wrist = B[side + 'Hand'].getWorldPosition(new THREE.Vector3()).add(target.clone().sub(P));
  C.ik2(B[side + 'Arm'], B[side + 'ForeArm'], B[side + 'Hand'], wrist, pole);
}
function handsToGun(dst, wpn, freeL, pts) {
  const T = torso(dst), B = dst.B;
  // точки для рук: свои у оружия или общие «как у автомата» (тогда руки тел и слой оружия совпадают)
  const grip = pts ? pts.grip : new THREE.Vector3().applyMatrix4(wpn.g.matrixWorld);
  const fore = pts ? pts.fore : wpn.fore.clone().applyMatrix4(wpn.g.matrixWorld);
  for (let k = 0; k < 2; k++) {
    reach(dst, 'Right', grip, B.RightForeArm.getWorldPosition(new THREE.Vector3()).addScaledVector(T.Y, -0.4).addScaledVector(T.X, 0.25));
    if (!freeL) reach(dst, 'Left', fore, B.LeftForeArm.getWorldPosition(new THREE.Vector3()).addScaledVector(T.Y, -0.4).addScaledVector(T.X, -0.12));
    dst.holder.updateMatrixWorld(true);
  }
}
/* хват для движения: режим из описания движения (carry / aim / hip / sling / hand / left).
   wpn.anchor — точка привязки слоя оружия к телу (рукоять АК в этой позе): по ней игра подгоняет ствол под руку
   любого тела. У длинных стволов приклад длиннее, чем у АК, — ствол сдвигается вперёд, чтобы затыльник был у плеча,
   а не торчал за спиной; привязка остаётся на рукояти АК. */
function rearShift(wpn, cal) {
  return cal && cal.ref && cal.ref !== wpn && !wpn.free ? Math.max(0, (wpn.buttZ || 0) - (cal.ref.buttZ || 0)) : 0;
}
function handMatrix(dst, wpn, mode, cal) {
  const hand = mode === 'left' ? dst.B.LeftHand : dst.B.RightHand;
  const HM = new THREE.Matrix4().compose(hand.getWorldPosition(new THREE.Vector3()), hand.getWorldQuaternion(new THREE.Quaternion()), new THREE.Vector3(1, 1, 1));
  return HM.multiply(mode === 'left' ? cal.offL : cal.offR);
}
/* куда ложится выпавший ствол: на землю у кисти, на бок, ствол по горизонтали (в осях держателя) */
function dropTarget(dst, wpn, an, cal) {
  const Mh = handMatrix(dst, wpn, an.mode, cal);
  const pos = new THREE.Vector3().setFromMatrixPosition(Mh);
  const dir = new THREE.Vector3(0, 0, -1).transformDirection(Mh); dir.y = 0;
  if (dir.lengthSq() < 0.04) { const T = torso(dst); dir.copy(T.X).setY(0); }
  dir.normalize();
  const zW = dir.clone().negate(), xW = new THREE.Vector3(0, 1, 0), yW = new THREE.Vector3().crossVectors(zW, xW).normalize();
  const M = new THREE.Matrix4().makeBasis(xW, yW, zW);
  M.setPosition(pos.x, 0, pos.z);
  return dst.holder.matrixWorld.clone().invert().multiply(M);
}
function holdWeapon(dst, wpn, an, cal, adjAll) {
  const mode = an.mode || 'carry';
  if (mode === 'hand' || mode === 'left') {
    const Mh = handMatrix(dst, wpn, mode, cal);
    if (an._drop && an._drop.w > 0) {
      // гибель: ствол выпадает из руки и ложится на землю
      const T = dst.holder.matrixWorld.clone().multiply(an._drop.T);
      const p1 = new THREE.Vector3().setFromMatrixPosition(T); p1.y = 0.035;
      const q1 = new THREE.Quaternion().setFromRotationMatrix(T);
      const p0 = new THREE.Vector3().setFromMatrixPosition(Mh), q0 = new THREE.Quaternion().setFromRotationMatrix(Mh);
      const w = an._drop.w;
      p0.lerp(p1, w); q0.slerp(q1, w);
      Mh.compose(p0, q0, new THREE.Vector3(1, 1, 1));
    }
    Mh.decompose(wpn.g.position, wpn.g.quaternion, wpn.g.scale);
    wpn.g.updateMatrixWorld(true);
    wpn.anchor = cal.aLocal ? cal.aLocal.clone().applyMatrix4(wpn.g.matrixWorld) : null;
    return;
  }
  const grp = (wpn.hipAim && mode === 'aim') ? 'hip' : mode;
  const G = GRIP[grp] || GRIP.carry;
  const adj = adjAll && adjAll[mode === 'hip' ? 'aim' : mode];
  const M = gunMatrix(dst, wpn, G, adj);
  // хват по автомату: рукоять — где правая рука держит АК, левая — где цевьё АК; направление ствола своё
  let pts = null;
  wpn.anchor = null;
  if (cal && cal.ref) {
    const MA = gunMatrix(dst, cal.ref, G, null);
    const g0 = new THREE.Vector3().setFromMatrixPosition(MA);
    wpn.anchor = g0.clone();
    if (!wpn.free) {
      pts = mode === 'sling' ? null : { grip: g0, fore: cal.ref.fore.clone().applyMatrix4(MA) };
      const sh = mode === 'sling' ? 0 : rearShift(wpn, cal);
      const fwd = new THREE.Vector3(0, 0, -1).transformDirection(M);
      M.setPosition(g0.clone().addScaledVector(fwd, sh));
    }
  }
  if (an.recoil) {
    // отдача на первом кадре выстрела: назад по стволу и стволом вверх
    const back = new THREE.Vector3(0, 0, an.recoil[0]).applyMatrix4(new THREE.Matrix4().extractRotation(M));
    M.multiply(new THREE.Matrix4().makeRotationX(an.recoil[1] * Math.PI / 180));
    M.setPosition(new THREE.Vector3().setFromMatrixPosition(M).add(back));
    if (wpn.anchor) wpn.anchor.add(back);
  }
  M.decompose(wpn.g.position, wpn.g.quaternion, wpn.g.scale);
  wpn.g.updateMatrixWorld(true);
  if (mode !== 'sling') handsToGun(dst, wpn, an.freeL, pts);
}
/* калибровка для движений «в кисти»: оружие в переноске, руки на нём — запомнить положение относительно кистей */
function calibrate(dst, src, rt, wpn, adjAll, ref) {
  dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
  poseRig(src, 'IdleRifle', 0.3);
  if (rt) rt();
  dst.holder.updateMatrixWorld(true);
  holdWeapon(dst, wpn, { mode: 'carry' }, { ref }, adjAll);
  const rel = (bone) => new THREE.Matrix4().compose(bone.getWorldPosition(new THREE.Vector3()), bone.getWorldQuaternion(new THREE.Quaternion()), new THREE.Vector3(1, 1, 1)).invert().multiply(wpn.g.matrixWorld);
  // привязка (рукоять АК) в осях оружия — для движений «в кисти»
  const aLocal = wpn.anchor ? wpn.anchor.clone().applyMatrix4(wpn.g.matrixWorld.clone().invert()) : null;
  return { offR: rel(dst.B.RightHand), offL: rel(dst.B.LeftHand), ref, aLocal };
}
/* поправка хвата в осях оружия: p — сдвиг (м: x вправо, y вверх, z к прикладу), r — повороты (°: x — ствол вверх/вниз,
   y — влево/вправо, z — завал), вокруг точки хвата */
function adjMatrix(adj) {
  if (!adj) return null;
  const p = adj.p || [0, 0, 0], r = adj.r || [0, 0, 0];
  if (!p[0] && !p[1] && !p[2] && !r[0] && !r[1] && !r[2]) return null;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(1, 1, 1));
}
function placeWeapon(dst, wpn, off, an, adj) {
  const hand = dst.B.RightHand;
  const HM = new THREE.Matrix4().compose(hand.getWorldPosition(new THREE.Vector3()), hand.getWorldQuaternion(new THREE.Quaternion()), new THREE.Vector3(1, 1, 1));
  HM.multiply(off);
  const A = adjMatrix(adj);
  if (A) HM.multiply(A);
  HM.decompose(wpn.g.position, wpn.g.quaternion, wpn.g.scale);
  wpn.g.updateMatrixWorld(true);
  if (!an.noIK) {
    const fore = wpn.fore.clone().applyMatrix4(wpn.g.matrixWorld);
    const L = C.palm(dst.B, 'Left');
    if (L.distanceTo(fore) < (an.ikR || 0.3)) {
      const B = dst.B; const wrist = B.LeftHand.getWorldPosition(new THREE.Vector3()).add(fore.clone().sub(L));
      const pole = B.LeftForeArm.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.35, 0));
      C.ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, wrist, pole);
    }
  }
}
function setColor(rig, on) { rig.meshes.forEach((m) => { (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => { mt.colorWrite = on; }); }); }

/* spec: { kind:'human'|'creature', clipSrc, body, height, weapon, layer:'body'|'weapon', anims:[{key,clip,n,t0,t1,loop,crouch,noIK}], ss, box } */
/* Движения из позы ходьбы (у четвероногих Tripo нет клипов атаки, попадания, гибели): p — доля движения 0…1.
   rx — наклон вперёд (+ носом вниз), rz — крен на бок, fw — сдвиг вперёд (м), sy — вдох (растяжение по высоте) */
function fxAt(fx, p, h) {
  const e = (x) => x * x * (3 - 2 * x);
  const D = Math.PI / 180;
  if (fx === 'lunge') {
    // присел назад → бросок вперёд с укусом → назад
    const k = [[-6, -0.08], [10, 0.12], [16, 0.22], [4, 0.06]];
    const a = k[Math.min(k.length - 1, Math.round(p * (k.length - 1)))];
    return { rx: a[0] * D, rz: 0, fw: a[1] * h / 0.42, sy: 1 };
  }
  if (fx === 'recoil') return { rx: (p < 0.5 ? -12 : -5) * D, rz: (p < 0.5 ? 6 : 2) * D, fw: (p < 0.5 ? -0.08 : -0.03) * h / 0.42, sy: 1 };
  if (fx === 'fall') { const q = e(Math.min(1, p * 1.15)); return { rx: 6 * q * D, rz: 86 * q * D, fw: 0, sy: 1 }; }
  if (fx === 'roar') return { rx: (p < 0.5 ? -14 : -8) * D, rz: 0, fw: -0.04, sy: 1.03 };
  if (fx === 'breathe') return { rx: 0, rz: 0, fw: 0, sy: 1 + 0.02 * Math.sin(p * Math.PI * 2) };
  return null;
}
async function frames(spec) {
  const ss = spec.ss || 2;
  const H = spec.height || 1.8;
  const dst = await getRig(spec.body, H);
  if (spec.more) {
    // клипы из второго файла того же скелета (движения Tripo приходят двумя файлами)
    const g2 = await load(spec.more);
    const have = new Set(dst.gl.animations.map((a) => a.name));
    g2.animations.forEach((a) => { if (!have.has(a.name)) dst.gl.animations.push(a); });
  }
  const src = spec.clipSrc && spec.clipSrc !== spec.body ? await getRig(spec.clipSrc, 1.8) : dst;
  const rt = src === dst ? null : C.makeRetarget(src, dst);
  // у отдельных движений — свой источник клипа (движения по тексту Tripo на скелете Крута)
  const srcs = {};
  const srcFor = async (url) => {
    if (!url) return { s: src, rt };
    if (!srcs[url]) { const r = await getRig(url, 1.8); srcs[url] = { s: r, rt: r === dst ? null : C.makeRetarget(r, dst) }; }
    return srcs[url];
  };
  let wpn = null, cal = null;
  if (spec.weapon) {
    wpn = C.makeWeapon(await load(spec.weapon.src), spec.weapon);
    const ref = spec.ref ? C.makeWeapon(await load(spec.ref.src), spec.ref) : wpn;
    cal = calibrate(dst, src, rt, wpn, spec.weapon.adj, ref);
  }
  const out = [];
  const snap = {};
  const R = spec.box || [1.1, 2.05];
  const box = new THREE.Box3(new THREE.Vector3(-R[0] * H / 1.8, -0.05, -R[0] * H / 1.8), new THREE.Vector3(R[0] * H / 1.8, R[1] * H / 1.8, R[0] * H / 1.8));
  scene.add(dst.holder);
  const showW = wpn && spec.layer !== 'body';
  if (showW) scene.add(wpn.g);
  setColor(dst, spec.layer !== 'weapon');
  const fxH = H * 0.42;   // середина тела — ось наклонов в движениях fx
  for (const an of spec.anims) {
    const SR = await srcFor(an.src);
    const clip = findClip(SR.s, an.clip);
    if (!clip) throw new Error('нет клипа ' + an.clip);
    const t0 = an.t0 || 0, t1 = an.t1 !== undefined ? Math.min(an.t1, clip.duration) : clip.duration;
    const tAt = (i) => an.n === 1 ? t0 : t0 + (t1 - t0) * (an.loop ? i / an.n : i / (an.n - 1));
    // центровка над клеткой: у движений по тексту Tripo тело уезжает от точки стояния — ставим середину между
    // стопами в центр клетки (для циклов — среднее по кадрам, иначе — по первому кадру, откуда боец начинает)
    let cOff = null, cOffs = null;
    if (spec.kind === 'creature' && !an.noCenter) {
      // существа: середина тела (по коробке с учётом скиннинга), для циклов — среднее по кадрам
      let sx = 0, sz = 0, cnt = 0;
      // у существ кость хода не та, что у людей: центр тела считаем в каждом кадре (cOffs), без «качелей» в беге
      cOffs = [];
      let cBone = null;
      dst.root.traverse((o) => { if (!cBone && o.isBone && /^(hips?|pelvis)$/i.test(o.name)) cBone = o; });
      cBone = cBone || dst.B.Hips || null;
      for (let k = 0; k < an.n; k++) {
        dst.holder.position.set(0, 0, 0); dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
        poseRig(SR.s, an.clip === '*' ? clip.name : an.clip, tAt(k));
        if (SR.rt) SR.rt();
        dst.holder.updateMatrixWorld(true);
        // по тазу (кость Hips / Hip / Pelvis — в ней движение «вперёд» у клипов с ходом): махи лап не двигают тело
        const hp = cBone ? cBone.getWorldPosition(new THREE.Vector3()) : null;
        if (hp) cOffs.push([hp.x, hp.z]);
        else { const bb = new THREE.Box3(); dst.meshes.forEach((mesh) => bb.expandByObject(mesh, true)); const cc = bb.getCenter(new THREE.Vector3()); cOffs.push([cc.x, cc.z]); }
      }
      if (an.key === 'die' && !an.fx) {
        // падает почти на месте: сдвиг тела к последнему кадру — не больше 0,25 м (клип уводил тело на 1,5–2 клетки)
        const c0 = cOffs[0], cl = cOffs[cOffs.length - 1], dl = Math.hypot(cl[0] - c0[0], cl[1] - c0[1]);
        const kk = dl > 0.25 ? 1 - 0.25 / dl : 0;
        cOffs = cOffs.map((c) => [c0[0] + (c[0] - c0[0]) * kk, c0[1] + (c[1] - c0[1]) * kk]);
      } else if (an.loop && cOffs.length > 1) {
        // цикл: таз пригвождён к клетке (оставляем 15% покачивания) — без «качелей» вперёд-назад
        const mx = cOffs.reduce((a2, c) => a2 + c[0], 0) / cOffs.length, mz = cOffs.reduce((a2, c) => a2 + c[1], 0) / cOffs.length;
        cOffs = cOffs.map((c) => [c[0] - (c[0] - mx) * 0.15, c[1] - (c[1] - mz) * 0.15]);
      } else if (an.fx) cOffs = cOffs.map(() => cOffs[0]);
      const idx = [];
      for (const k of idx) {
        const b = new THREE.Box3();
        const c = b.getCenter(new THREE.Vector3());
        sx += c.x; sz += c.z; cnt++;
      }
      cOff = cnt ? [sx / cnt, sz / cnt] : null;
    } else if (an.src && !an.noCenter) {
      let sx = 0, sz = 0, cnt = 0;
      const idx = an.loop ? Array.from({ length: an.n }, (_, k) => k) : [0];
      for (const k of idx) {
        dst.holder.position.set(0, 0, 0); dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
        poseRig(SR.s, an.clip === '*' ? clip.name : an.clip, tAt(k));
        if (SR.rt) SR.rt();
        dst.holder.updateMatrixWorld(true);
        const L = dst.B.LeftFoot.getWorldPosition(new THREE.Vector3()), R = dst.B.RightFoot.getWorldPosition(new THREE.Vector3());
        sx += (L.x + R.x) / 2; sz += (L.z + R.z) / 2; cnt++;
      }
      cOff = [sx / cnt, sz / cnt];
    }
    // гибель: куда ляжет выпавший ствол (по последнему кадру), в осях держателя
    let dropT = null;
    if (wpn && an.drop) {
      dst.holder.position.set(0, 0, 0); dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
      poseRig(SR.s, an.clip === '*' ? clip.name : an.clip, tAt(an.n - 1));
      if (SR.rt) SR.rt();
      dst.holder.updateMatrixWorld(true);
      dropT = dropTarget(dst, wpn, an, cal);
    }
    for (let i = 0; i < an.n; i++) {
      const t = tAt(i);
      let anI = i === 0 && an.recoilFirst ? Object.assign({}, an, { recoil: an.recoilFirst }) : an;
      if (dropT) {
        const pr = an.n > 1 ? i / (an.n - 1) : 1, x = Math.max(0, Math.min(1, (pr - an.drop[0]) / (an.drop[1] - an.drop[0])));
        anI = Object.assign({}, an, { _drop: { T: dropT, w: x * x * (3 - 2 * x) } });
      }
      for (const d of (spec.dirs || [0, 1, 2, 3, 4, 5, 6, 7])) {
        // держатель — в начале координат: перенос движения ставит таз в мировую точку
        dst.holder.position.set(0, 0, 0); dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
        poseRig(SR.s, an.clip === '*' ? clip.name : an.clip, t);
        if (SR.rt) SR.rt();
        if (an.crouch) crouch(dst, an.crouch * H / 1.8);
        // ноги на земле: нижняя точка тела в этом кадре — ровно на уровне земли (поворот вокруг вертикали её не меняет,
        // поэтому считается один раз на кадр). Движения по тексту Tripo «висели» над землёй на 0,2–0,6 м.
        // движения, которых нет в клипах (у четвероногих Tripo — только ход): наклон/крен/сдвиг всего тела
        const FX = an.fx ? fxAt(an.fx, an.n > 1 ? i / (an.n - 1) : 0, fxH) : null;
        dst.holder.rotation.order = 'YXZ';
        dst.holder.rotation.x = FX ? FX.rx : 0; dst.holder.rotation.z = FX ? FX.rz : 0;
        dst.holder.scale.set(1, FX ? FX.sy : 1, 1);
        const sk = an.key + ':' + i;
        if (snap[sk] === undefined) { dst.holder.position.y = 0; dst.holder.updateMatrixWorld(true); snap[sk] = an.air ? 0 : lowestY(dst); }
        dst.holder.position.y = -snap[sk];
        const ang = d * Math.PI / 4;
        dst.holder.rotation.y = Math.atan2(Math.cos(ang), Math.sin(ang)) + ((an.yaw || 0) + (spec.yaw || 0)) * Math.PI / 180;
        const co = cOffs ? cOffs[i] : cOff;
        const yr = dst.holder.rotation.y, cr = Math.cos(yr), sr = Math.sin(yr);
        if (co) {
          dst.holder.position.x = -(co[0] * cr + co[1] * sr); dst.holder.position.z = -(-co[0] * sr + co[1] * cr);
        } else { dst.holder.position.x = 0; dst.holder.position.z = 0; }
        if (FX) {
          // сдвиг вперёд (по взгляду) и поворот вокруг середины тела, а не вокруг точки на земле
          const P = new THREE.Vector3(0, fxH, 0), Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(FX.rx, 0, FX.rz, 'YXZ'));
          const piv = P.clone().sub(P.clone().applyQuaternion(Q));
          const lx = piv.x, lz = piv.z + FX.fw;
          dst.holder.position.x += lx * cr + lz * sr; dst.holder.position.z += -lx * sr + lz * cr;
        }
        dst.holder.updateMatrixWorld(true);
        if (wpn) holdWeapon(dst, wpn, anI, cal, spec.weapon.adj);
        let fb = box;
        if (an.key === 'die' || an.wide) { const k = H / 1.8 * 2.1; fb = new THREE.Box3(new THREE.Vector3(-k, -0.05, -k), new THREE.Vector3(k, box.max.y, k)); }
        else if (an.mode === 'sling' && spec.kind === 'human') fb = new THREE.Box3(box.min.clone(), new THREE.Vector3(box.max.x, 2.45 * H / 1.8, box.max.z));   // ствол за спиной выше головы
        const fr = frameFor(fb, 0.05);
        const s = shoot(fr, ss);
        let c;
        if (spec.layer === 'weapon') {
          // контур оружия — только вне силуэта тела
          setColor(dst, true); scene.remove(wpn.g);
          const sb = shoot(fr, ss).c;
          setColor(dst, false); scene.add(wpn.g);
          const o = outline(s.c, ss, 0.8);
          const g = o.getContext('2d');
          g.globalCompositeOperation = 'destination-out'; g.drawImage(sb, 0, 0);
          g.globalCompositeOperation = 'source-over'; g.drawImage(s.c, 0, 0);
          c = o;
        } else c = outline(s.c, ss, 0.85);
        let mz = null;
        if (wpn) {
          const m = camSpace(wpn.muzzle.clone().applyMatrix4(wpn.g.matrixWorld));
          const o = camSpace(new THREE.Vector3(0, 0, 0));
          mz = [Math.round((m.x - o.x) * PPM * ss * 10) / 10, Math.round(-(m.y - o.y) * PPM * ss * 10) / 10];
          // точка хвата (рукоять) — центр поворота при правке в игре
          const gq = camSpace(wpn.anchor ? wpn.anchor.clone() : new THREE.Vector3().setFromMatrixPosition(wpn.g.matrixWorld));
          mz.push(Math.round((gq.x - o.x) * PPM * ss * 10) / 10, Math.round(-(gq.y - o.y) * PPM * ss * 10) / 10);
        }
        out.push({ k: an.key, i, d, c, ax: s.ax, ay: s.ay, mz });
      }
    }
  }
  setColor(dst, true);
  dst.holder.position.set(0, 0, 0); dst.holder.rotation.set(0, 0, 0); dst.holder.scale.set(1, 1, 1); dst.holder.updateMatrixWorld(true);
  scene.remove(dst.holder);
  if (showW) scene.remove(wpn.g);
  return out;
}
/* самая нижняя точка тела в текущей позе (с учётом скиннинга), метры */
function lowestY(dst) {
  let m = Infinity;
  const b = new THREE.Box3();
  dst.meshes.forEach((mesh) => { if (!mesh.visible) return; b.makeEmpty(); b.expandByObject(mesh, true); if (b.min.y < m) m = b.min.y; });
  return m === Infinity ? 0 : m;
}

/* Упаковка кадров в страницы атласа (полками), обрезка по непрозрачному */
function pack(list, page) {
  page = page || 2048;
  const items = list.map((f) => { const t = trim(f.c); return Object.assign({}, f, { t }); });
  const order = items.slice().sort((a, b) => b.t.h - a.t.h);
  const pages = []; let pg = null, x = 0, y = 0, rowH = 0;
  function newPage() { pg = document.createElement('canvas'); pg.width = page; pg.height = page; pages.push(pg); x = 0; y = 0; rowH = 0; }
  newPage();
  for (const it of order) {
    const w = it.t.w + 2, h = it.t.h + 2;
    if (x + w > page) { x = 0; y += rowH; rowH = 0; }
    if (y + h > page) newPage();
    pg.getContext('2d').drawImage(it.t.c, x + 1, y + 1);
    it.rect = [pages.length - 1, x + 1, y + 1, it.t.w, it.t.h, Math.round((it.ax - it.t.x) * 10) / 10, Math.round((it.ay - it.t.y) * 10) / 10];
    if (it.mz) it.rect.push.apply(it.rect, it.mz);
    x += w; rowH = Math.max(rowH, h);
  }
  // последняя страница — по высоте занятого
  const last = pages[pages.length - 1];
  const usedH = Math.min(page, y + rowH);
  if (usedH < page) { const c = document.createElement('canvas'); c.width = page; c.height = Math.max(4, usedH); c.getContext('2d').drawImage(last, 0, 0); pages[pages.length - 1] = c; }
  return { pages, items };
}

/* Портрет: голова и плечи модели вполоборота, перспективная камера (для рамки портрета в игре) */
async function headShot(spec) {
  const H = spec.height || 1.8;
  const dst = await getRig(spec.body, H);
  const src = spec.clipSrc && spec.clipSrc !== spec.body ? await getRig(spec.clipSrc, 1.8) : dst;
  const rt = src === dst ? null : C.makeRetarget(src, dst);
  dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
  if (spec.clip) { poseRig(src, spec.clip, spec.t || 0.4); if (rt) rt(); }
  dst.holder.rotation.y = spec.turn !== undefined ? spec.turn : -0.42;
  dst.holder.updateMatrixWorld(true);
  setColor(dst, true);
  scene.add(dst.holder);
  const head = dst.B.Head.getWorldPosition(new THREE.Vector3());
  const lift = spec.lift !== undefined ? spec.lift : 0.07;
  const pc = new THREE.PerspectiveCamera(spec.fov || 21, 1, 0.05, 30);
  pc.position.set(head.x + 0.18, head.y + lift + 0.06, head.z + 1.7);
  pc.lookAt(head.x, head.y + lift - 0.05, head.z);
  const N = spec.size || 256;
  renderer.setSize(N, N, false);
  renderer.render(scene, pc);
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  scene.remove(dst.holder);
  return c;
}

/* Набор: кадры → атлас (webp) + описание */
async function bakeSet(spec) {
  let list;
  if (spec.kind === 'head') {
    const c = await headShot(spec);
    list = [{ k: 'v', i: 0, d: 0, c, ax: 0, ay: 0 }];
  } else if (spec.kind === 'prop') {
    list = [];
    for (let v = 0; v < spec.variants.length; v++) {
      const r = await propCanvas(spec.variants[v]);
      list.push({ k: 'v', i: v, d: 0, c: r.c, ax: r.ax, ay: r.ay });
    }
  } else list = await frames(spec);
  const p = pack(list, spec.page || 2048);
  const anims = {};
  (spec.kind === 'head' ? [{ key: 'v', n: 1 }] : (spec.anims || [{ key: 'v', n: spec.variants ? spec.variants.length : 1 }])).forEach((a) => { anims[a.key] = { n: a.n, loop: !!a.loop, fps: a.fps || 0 }; });
  const F = {};
  p.items.forEach((it) => { (F[it.k] = F[it.k] || []); F[it.k][it.i * (spec.kind === 'prop' || spec.kind === 'head' ? 1 : 8) + it.d] = it.rect; });
  // половинные копии страниц — для низкой графики (вчетверо меньше памяти)
  const lo = spec.kind === 'prop' || spec.kind === 'head' || (spec.ss || 2) > 2 ? null : p.pages.map((c) => {
    const h = document.createElement('canvas'); h.width = Math.ceil(c.width / 2); h.height = Math.ceil(c.height / 2);
    const g = h.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, h.width, h.height);
    return h.toDataURL('image/webp', 0.88);
  });
  return { ss: spec.ss || 2, dirs: spec.kind === 'prop' || spec.kind === 'head' ? 1 : 8, anims, frames: F, pages: p.pages.map((c) => c.toDataURL('image/webp', spec.q || 0.9)), lo };
}
async function propCanvas(spec) {
  const r = await prop(Object.assign({ raw: true }, spec));
  return r;
}
/* Отладка хвата: поза тела с оружием с нескольких сторон (сбоку, спереди, сверху, игровая камера) */
async function poseView(spec) {
  const H = spec.height || 1.8;
  const dst = await getRig(spec.body, H);
  const src = spec.clipSrc && spec.clipSrc !== spec.body ? await getRig(spec.clipSrc, 1.8) : dst;
  const rt = src === dst ? null : C.makeRetarget(src, dst);
  let SR = { s: src, rt };
  if (spec.an.src) { const r = await getRig(spec.an.src, 1.8); SR = { s: r, rt: r === dst ? null : C.makeRetarget(r, dst) }; }
  const wpn = C.makeWeapon(await load(spec.weapon.src), spec.weapon);
  const adjAll = spec.adj || spec.weapon.adj;
  const ref = spec.ref ? C.makeWeapon(await load(spec.ref.src), spec.ref) : wpn;
  const cal = calibrate(dst, src, rt, wpn, adjAll, ref);
  dst.holder.rotation.y = 0; dst.holder.updateMatrixWorld(true);
  const clip = findClip(SR.s, spec.an.clip);
  poseRig(SR.s, spec.an.clip === '*' ? clip.name : spec.an.clip, spec.t || 0);
  if (SR.rt) SR.rt();
  if (spec.an.crouch) crouch(dst, spec.an.crouch * H / 1.8);
  dst.holder.rotation.y = spec.yaw || 0; dst.holder.updateMatrixWorld(true);
  holdWeapon(dst, wpn, spec.an, cal, adjAll);
  scene.add(dst.holder); scene.add(wpn.g);
  const out = [];
  const views = spec.views || [[1, 0, 0], [0, 0, 1], [0.001, 1, 0], null];
  const save = cam.position.clone();
  for (const v of views) {
    if (v) cam.position.set(v[0], v[1], v[2]).normalize().multiplyScalar(30); else cam.position.copy(CAMDIR).multiplyScalar(30);
    cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    const fr = frameFor(new THREE.Box3(new THREE.Vector3(-1.1, -0.05, -1.1), new THREE.Vector3(1.1, 2.1, 1.1)), 0.05);
    out.push(shoot(fr, spec.ss || 2).c.toDataURL('image/png'));
  }
  cam.position.copy(save); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  scene.remove(dst.holder); scene.remove(wpn.g);
  return out;
}
window.BK.poseView = poseView;
window.BK.frames = frames; window.BK.bakeSet = bakeSet; window.BK.getRig = getRig; window.BK.pack = pack;

/* Ужать GLB для хранения: текстуры не больше max (цвет — JPEG), кости и движения сохраняются */
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
async function shrink(url, max) {
  const gl = await new Promise((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url + '?x=' + Math.random(), res, undefined, rej));
  gl.scene.traverse((m) => {
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => {
      if (mt.map) mt.map.userData.mimeType = 'image/jpeg';
      if (mt.emissiveMap) mt.emissiveMap.userData.mimeType = 'image/jpeg';
      // карты нормалей и металл/шероховатость на спрайте в 60–120 точек не видны — не храним
      mt.normalMap = null; mt.metalnessMap = null; mt.roughnessMap = null; mt.metalness = 0.1; mt.roughness = 0.8;
    });
  });
  const ex = new GLTFExporter();
  const buf = await ex.parseAsync(gl.scene, { binary: true, maxTextureSize: max || 1024, animations: gl.animations, onlyVisible: false });
  let s = ''; const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
window.BK.shrink = shrink;
