// Запекание 3D-моделей в изометрические спрайты «Мёртвого мира» (запускается в Chromium из bake.js).
// Камера — ортографическая, 30° над землёй и 45° по азимуту, как ромб клетки 64×32 в игре:
// ось X модели → клетка +x (вправо-вниз), ось Z → клетка +y (влево-вниз), Y — вверх.
// Масштаб: человек 1,8 м = 55 точек при увеличении 1 (как процедурные фигуры), клетка ≈ 1,283 м.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const PPM = 55 / (1.8 * Math.cos(Math.PI / 6)); // точек на метр в плоскости камеры (увеличение 1)
const TILE_M = 32 / (Math.SQRT1_2 * PPM);        // метров в клетке вдоль оси
const EL = Math.PI / 6;
const CAMDIR = new THREE.Vector3(Math.cos(EL) * Math.SQRT1_2, Math.sin(EL), Math.cos(EL) * Math.SQRT1_2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xe4e8f2, 0x5e5040, 1.25);
scene.add(hemi);
// солнце игры: тени ложатся к +x (вправо-вниз) — свет слева-сверху
const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
key.position.set(-0.95, 1.25, 0.25).multiplyScalar(10);
scene.add(key);
const fill = new THREE.DirectionalLight(0xa8bcdc, 0.55);
fill.position.set(0.9, 0.5, 0.7).multiplyScalar(10);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffe2c0, 0.9);
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
  const t = trim(c);
  const size = b.getSize(new THREE.Vector3());
  return { png: t.c.toDataURL('image/png'), w: t.w, h: t.h, ax: s.ax - t.x, ay: s.ay - t.y, ss, size: [size.x / TILE_M, size.z / TILE_M, size.y] };
}

/* Список узлов файла (для подбора) */
async function nodes(src) {
  const gl = await load(src);
  return gl.scene.children.map((n) => n.name);
}

window.BK = { prop, nodes, load, THREE, SkeletonUtils, scene, cam, renderer, shoot, frameFor, outline, trim, camSpace, PPM, TILE_M, ready: true };
