// Модели для 3D-боя: исходные GLB (art3d/src) → лёгкие копии для телефона (game/models/*.glb) и список
// game/models/models.js (DW.M3). Текстуры — WebP не больше 512 (предметы) / 1024 (персонажи), геометрия упрощается
// до предела треугольников и сжимается (EXT_meshopt_compression, распаковка — MeshoptDecoder в three.min.js).
//   node tools/three3d/models.mjs [фильтр]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt, resample, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const OUT = path.join(ROOT, 'game', 'models');
const M = require(path.join(ROOT, 'tools', 'art3d', 'manifest.js'));
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const abs = (u) => path.join(ROOT, u.replace(/^\//, ''));
const nameOf = (u) => path.basename(u, '.glb');

function tris(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); n += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
  return n;
}
/* оптимизировать файл: tex — предел текстур, maxTris — предел треугольников (0 — не упрощать), keepAnim — оставить движения */
async function opt(src, dst, { tex = 512, maxTris = 4000, keepAnim = false, skin = false, animOnly = false } = {}) {
  const doc = await io.read(src);
  if (!keepAnim) for (const a of doc.getRoot().listAnimations()) a.dispose();
  // только движения (дополнительные файлы мутантов): сетки, скины и текстуры не нужны — кости остаются узлами
  if (animOnly) {
    for (const n of doc.getRoot().listNodes()) { if (n.getMesh()) n.setMesh(null); if (n.getSkin()) n.setSkin(null); }
    for (const m of doc.getRoot().listMeshes()) m.dispose();
    for (const k of doc.getRoot().listSkins()) k.dispose();
    for (const t of doc.getRoot().listTextures()) t.dispose();
    for (const m of doc.getRoot().listMaterials()) m.dispose();
  }
  const t0 = tris(doc);
  const ops = [dedup(), prune(), unpartition()];
  if (!skin) ops.push(weld());
  if (maxTris && t0 > maxTris) ops.push(simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.05, maxTris / t0), error: 0.002, lockBorder: skin }));
  ops.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 82 }));
  if (keepAnim) ops.push(resample());
  ops.push(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...ops);
  await io.write(dst, doc);
  const t1 = tris(doc);
  return { t0: Math.round(t0), t1: Math.round(t1), kb: Math.round(fs.statSync(dst).size / 1024) };
}

const done = {};
async function one(src, o) {
  const n = nameOf(src) + (o && o.suffix ? o.suffix : '');
  if (done[n]) return n;
  if (ONLY && !ONLY.some((f) => n.indexOf(f) >= 0)) { done[n] = 1; return n; }
  const s = abs(src);
  if (!fs.existsSync(s)) { console.log('нет файла', src); return null; }
  const r = await opt(s, path.join(OUT, n + '.glb'), o);
  console.log(n, r.t0 + '→' + r.t1 + ' тр.', r.kb + ' КБ');
  done[n] = 1;
  return n;
}

// предметы карты (типы клеток), техника, турель, проёмы, улица, база
const out = { props: {}, veh: [], turret: null, open: [], street: [], decor: [] };
const S = '/art3d/src/', DWP = '/art3d/src/dw/';
for (const p of M.PROPS) {
  if (p.id === 'base') continue;
  if (p.id === 'veh') {
    // варианты: модель × (вдоль x: 0° / 180°, вдоль y: −90° / 90°) — как в 2D (v.m·4 + v.d·2 + v.o)
    for (const v of p.variants) { const f = await one(v.src, { tex: 512, maxTris: 6000 }); if (f) out.veh.push({ f, len: v.len, hMax: v.hMax, yaw: v.yaw || 0 }); }
    continue;
  }
  const list = [];
  for (const v of p.variants) {
    const f = await one(v.src, { tex: 512, maxTris: p.id === 'obj15' ? 8000 : 3500 });
    if (!f) continue;
    list.push({ f, len: v.len, h: v.h, hMax: v.hMax, yaw: v.yaw || 0, k: v.k, sx: v.sx, sy: v.sy, sz: v.sz });
  }
  if (p.type) out.props[p.type] = list;
  else if (p.id === 'turret') out.turret = list[0];
  else out[p.id] = list;
}
// оружие (в руке персонажа): привязка к кисти считается в игре по точке хвата
out.weapons = {};
for (const w of M.WEAPONS) {
  let src = w.src;
  if (!fs.existsSync(abs(src)) && M.WEAPON_FALLBACK[w.id]) src = M.WEAPON_FALLBACK[w.id];
  const f = await one(src, { tex: 512, maxTris: 3000 });
  if (f) out.weapons[w.id] = { f, len: w.len, grip: w.grip, fore: w.fore, gy: w.gy, fy: w.fy, my: w.my, flip: !!w.flip, free: !!w.free };
}
// тела людей (скелет сохраняется, движения — общая библиотека anim_human.js)
out.bodies = {};
// новые модели этапа «3D-бой» (Tripo p8, art3d/src/h — из ветки tripo-status): если есть — вместо старых
const HNEW = { mur1: 'raider', mur2: 'thug' };
for (const b of M.BODIES) {
  let src = b.src;
  const hn = '/art3d/src/h/h_' + (HNEW[b.id] || b.id) + '_a.glb';
  if (fs.existsSync(abs(hn))) src = hn;
  else if (!fs.existsSync(abs(src)) && M.BODY_FALLBACK[b.id]) src = M.BODY_FALLBACK[b.id];
  const f = await one(src, { tex: 1024, maxTris: 0, skin: true, suffix: '' });
  // облегчённая копия для слабых телефонов: ~7 тыс. треугольников, текстуры 512
  const lo = await one(src, { tex: 512, maxTris: 7000, skin: true, suffix: '_lo' });
  if (f) out.bodies[b.id] = { f, lo: lo || f, h: b.h || 1.8 };
}
// мутанты: свои движения из файлов Tripo
out.creatures = {};
for (const c of M.CREATURES) {
  // новые модели этапа «3D-бой» (hm_<id>_a / _b) — вместо старых; движения по тексту прежних файлов подходят
  // (тот же скелет Tripo — кости по именам)
  const hA = '/art3d/src/h/hm_' + c.id + '_a.glb', hB = '/art3d/src/h/hm_' + c.id + '_b.glb';
  const isNew = fs.existsSync(abs(hA));
  const f = await one(isNew ? hA : c.src, { tex: 1024, maxTris: 0, skin: true, keepAnim: true });
  if (!f) continue;
  const more = [];
  if (isNew && fs.existsSync(abs(hB))) { const m = await one(hB, { tex: 64, maxTris: 0, skin: true, keepAnim: true, animOnly: true }); if (m) more.push(m); }
  else if (!isNew && c.more) { const m = await one(c.more, { tex: 256, maxTris: 0, skin: true, keepAnim: true }); if (m) more.push(m); }
  for (const a of c.anims) if (a.src) { const m = await one(a.src, { tex: 64, maxTris: 0, skin: true, keepAnim: true, animOnly: true }); if (m && more.indexOf(m) < 0) more.push(m); }
  out.creatures[c.id] = { f, more, h: c.h, quad: !!c.quad, yaw: isNew ? (c.yawNew || 0) : (c.yaw || 0), anims: c.anims.map((a) => ({ key: a.key, clip: a.clip, src: a.src ? nameOf(a.src) : null, n: a.n, t0: a.t0, t1: a.t1, loop: !!a.loop, fx: a.fx || null })) };
}
fs.writeFileSync(path.join(OUT, 'models.js'), '/* Сгенерировано tools/three3d/models.mjs — модели 3D-боя */\nwindow.DW = window.DW || {};\nDW.M3 = ' + JSON.stringify(out) + ';\n');
// лишние файлы (заменённые модели) — убрать, чтобы не раздувать APK (только при полной сборке)
if (!ONLY) {
  const used = new Set();
  const add = (f) => { if (f) used.add(f + '.glb'); };
  for (const k in out.props) out.props[k].forEach((v) => add(v.f));
  out.veh.forEach((v) => add(v.f)); add(out.turret && out.turret.f);
  ['open', 'street', 'decor'].forEach((k) => (out[k] || []).forEach((v) => add(v.f)));
  for (const k in out.weapons) add(out.weapons[k].f);
  for (const k in out.bodies) { add(out.bodies[k].f); add(out.bodies[k].lo); }
  for (const k in out.creatures) { add(out.creatures[k].f); out.creatures[k].more.forEach(add); }
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.glb') && !used.has(f)) { fs.unlinkSync(path.join(OUT, f)); console.log('удалён лишний', f); }
}
console.log('готово:', Object.keys(done).length, 'файлов');
