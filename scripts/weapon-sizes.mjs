// Лист сравнения размеров оружия: каждый ствол в игровом размере рядом с героем (как в Godot-версии) и он же
// в настоящем размере рядом с человеком ростом 1,80 м. Размеры в игре берутся из godot/scripts/gear.gd
// (LENGTH × SCALE, как Gear.target_length), рост героя — как в Gear.hero (голова — на высоте головы старой модели).
// Просьба пользователя: всегда сравнивать оружие с настоящим по размерам к человеку — гонять после любой правки.
//
//   node scripts/weapon-sizes.mjs [выход.jpg]      (по умолчанию download/weapon-sizes.jpg)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
const { chromium } = require('playwright');
const out = process.argv[2] || join(ROOT, 'download/weapon-sizes.jpg');

// настоящие размеры, м: длина (у складных — с разложенным прикладом, кроме PM-63) и название
const REAL = {
  fireaxe: [0.85, 'Пожарный топор'], 
  spas12: [1.04, 'SPAS-12'], aks: [0.73, 'АКС-74У'],
  ak74: [0.943, 'АК-74'], ak47: [0.88, 'АК-47'], aug: [0.79, 'Steyr AUG'], 
  fnfal: [1.09, 'FN FAL'], svd: [1.225, 'СВД'], 
  glock17: [0.186, 'Glock 17'], deagle: [0.27, 'Desert Eagle'], dbarrel: [1.1, 'Двустволка'], ak107: [0.943, 'АК-107'],
  rpk: [1.04, 'РПК'], pkt: [1.08, 'ПКТ'], awm: [1.2, 'Arctic Warfare'], g36: [1.0, 'HK G36'], mp5: [0.68, 'HK MP5'],
};
const HUMAN = 1.8;

// размеры в игре — из gear.gd: LENGTH (настоящая длина) × SCALE; кого нет в LENGTH — длина старой модели × SCALE
const gear = readFileSync(join(ROOT, 'godot/scripts/gear.gd'), 'utf8');
const scale = parseFloat((gear.match(/const SCALE := ([\d.]+)/) || [0, '1'])[1]);
const lenBlock = (gear.match(/const LENGTH := \{([\s\S]*?)\}/) || [0, ''])[1];
const LENGTH = Object.fromEntries([...lenBlock.matchAll(/"(\w+)":\s*([\d.]+)/g)].map(m => [m[1], parseFloat(m[2])]));
// длина старой модели (для тех, кого нет в LENGTH) — по габаритам assets/weapons/<id>.glb
function oldLength(id) {
  const p = join(ROOT, 'godot/assets/weapons', id + '.glb');
  if (!existsSync(p)) return null;
  const d = readFileSync(p); const ln = d.readUInt32LE(12); const js = JSON.parse(d.slice(20, 20 + ln));
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const m of js.meshes || []) for (const pr of m.primitives) {
    const a = js.accessors[pr.attributes.POSITION];
    if (a && a.min && a.max) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], a.min[i]); mx[i] = Math.max(mx[i], a.max[i]); }
  }
  return Math.max(...mx.map((v, i) => v - mn[i]));
}
const ids = Object.keys(REAL).filter(id => existsSync(join(ROOT, 'godot/assets/tripo', 'w_' + id + '.glb')));
const items = ids.map(id => {
  const base = LENGTH[id] ?? oldLength(id) ?? REAL[id][0];
  return { id, name: REAL[id][1], real: REAL[id][0], game: base * scale };
});

const files = { '/hero.glb': readFileSync(join(ROOT, 'godot/assets/tripo/player.glb')), '/old.glb': readFileSync(join(ROOT, 'godot/assets/characters/player.glb')) };
for (const it of items) files['/w_' + it.id + '.glb'] = readFileSync(join(ROOT, 'godot/assets/tripo', 'w_' + it.id + '.glb'));
const COLS = 4, W = 420, H = 470;
const rows = Math.ceil(items.length / COLS);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#2a2b2e;font:15px sans-serif;color:#eee}
#wrap{position:relative;width:${COLS * W}px;height:${rows * H + 54}px}
canvas{position:absolute;left:0;top:54px}
h1{margin:0;padding:12px 14px;font-size:20px;height:30px}
.lab{position:absolute;width:${W - 16}px;padding:4px 8px;background:rgba(0,0,0,.55);font-size:13px;line-height:1.35}
.lab b{font-size:15px}
</style></head><body><div id="wrap"><h1>Оружие: в игре (слева, рядом с героем) и в жизни (справа, рядом с человеком ${HUMAN.toFixed(2).replace('.', ',')} м)</h1></div>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
const items=${JSON.stringify(items)}; const COLS=${COLS}, W=${W}, H=${H}, HUMAN=${HUMAN};
const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); r.setSize(COLS*W,${rows}*H); r.outputColorSpace=THREE.SRGBColorSpace;
document.getElementById('wrap').appendChild(r.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x8d8f93);
scene.add(new THREE.HemisphereLight(0xffffff,0x555555,2.3)); const dl=new THREE.DirectionalLight(0xffffff,1.8); dl.position.set(2,4,5); scene.add(dl);
const L=new GLTFLoader();
// рост героя в игре: как Gear.hero — голова новой модели на высоте головы старой (в позе покоя)
const old=(await L.loadAsync('/old.glb')).scene; old.updateMatrixWorld(true);
let oldHead=0; old.traverse(o=>{ if(o.isBone && /head$/i.test(o.name) && !oldHead) oldHead=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).y; });
const heroSrc=(await L.loadAsync('/hero.glb')).scene; heroSrc.updateMatrixWorld(true);
let newHead=0; heroSrc.traverse(o=>{ if(o.isBone && /^head$/i.test(o.name) && !newHead) newHead=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).y; });
const box0=new THREE.Box3().setFromObject(heroSrc); const heroH=box0.max.y*(oldHead/newHead);
// в профиль (модель Tripo в файле смотрит по +X, руки — к камере и от неё): видно рост и длину ствола рядом
function hero(height){ const h=SkeletonUtils.clone(heroSrc); const s=height/box0.max.y; h.scale.setScalar(s); return h; }
// ствол стоймя: самая длинная ось — вверх, нижний край — на земле
async function weapon(id,len){ const g=(await L.loadAsync('/w_'+id+'.glb')).scene; const b=new THREE.Box3().setFromObject(g); const sz=b.getSize(new THREE.Vector3());
  // боком к камере: сначала самая длинная ось — на X (поворот вокруг Y), затем X — вверх (поворот вокруг Z)
  const ax=sz.x>=sz.y&&sz.x>=sz.z?'x':(sz.z>=sz.y?'z':'y'); const piv=new THREE.Group(); g.position.sub(b.getCenter(new THREE.Vector3())); piv.add(g);
  if(ax==='z') piv.rotation.y=Math.PI/2;
  const up=new THREE.Group(); up.add(piv); if(ax!=='y') up.rotation.z=Math.PI/2;
  const k=len/Math.max(sz.x,sz.y,sz.z); const outer=new THREE.Group(); outer.add(up); outer.scale.setScalar(k); outer.updateMatrixWorld(true);
  const b2=new THREE.Box3().setFromObject(outer); outer.position.y=-b2.min.y; return outer; }
const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshLambertMaterial({color:0x6c6e70})); ground.rotation.x=-Math.PI/2; scene.add(ground);
const marks=new THREE.Group(); scene.add(marks);
for(let i=0;i<items.length;i++){ const it=items[i]; const cx=i%COLS, cy=Math.floor(i/COLS);
  const g1=new THREE.Group(), g2=new THREE.Group();
  const h1=hero(heroH); const w1=await weapon(it.id,it.game); w1.position.x=0.42; g1.add(h1,w1);
  const h2=hero(HUMAN); const w2=await weapon(it.id,it.real); w2.position.x=0.42; g2.add(h2,w2);
  g1.position.x=-0.62; g2.position.x=0.5; scene.add(g1,g2);
  // рамка кадра — относительно камеры: снизу земля (−0,1 м), сверху 2,65 м (над головой — подпись); ширина — по клетке
  const vh=2.75, vw=vh*W/H; const cam=new THREE.OrthographicCamera(-vw/2,vw/2,2.65,-0.1,0.1,50); cam.position.set(0.05,0,10); cam.lookAt(0.05,0,0);
  r.setScissorTest(true); r.setViewport(cx*W,(${rows}-1-cy)*H,W,H); r.setScissor(cx*W,(${rows}-1-cy)*H,W,H); r.render(scene,cam);
  scene.remove(g1,g2);
  const lab=document.createElement('div'); lab.className='lab'; lab.style.left=(cx*W)+'px'; lab.style.top=(54+cy*H)+'px';
  const f=v=>v.toFixed(2).replace('.',','); const pg=it.game/heroH, pr=it.real/HUMAN;
  lab.innerHTML='<b>'+it.name+'</b> — в игре '+f(it.game)+' м (герой '+f(heroH)+' м), в жизни '+f(it.real)+' м<br>длина к росту: игра '+Math.round(pg*100)+'% · жизнь '+Math.round(pr*100)+'% · игра = '+Math.round(pg/pr*100)+'% от настоящего';
  document.getElementById('wrap').appendChild(lab); }
window.heroH=heroH; window.done=true;
</script></body></html>`;
const srv = createServer((req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html); }
  if (files[req.url]) return res.end(files[req.url]);
  if (req.url.startsWith('/three/')) { try { res.setHeader('Content-Type', 'text/javascript'); return res.end(readFileSync(join(ROOT, 'node_modules/three', req.url.slice(7)))); } catch { /* нет файла */ } }
  res.statusCode = 404; res.end();
}).listen(0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: COLS * W, height: rows * H + 54 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://localhost:${srv.address().port}/`);
await p.waitForFunction(() => window.done, null, { timeout: 180000 });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await p.screenshot({ type: 'jpeg', quality: 86, fullPage: true }));
const heroH = await p.evaluate(() => window.heroH);
await b.close(); srv.close();
console.log(`рост героя в игре ${heroH.toFixed(2)} м, множитель оружия ${scale}`);
for (const it of items) console.log(`${it.name.padEnd(16)} в игре ${it.game.toFixed(2)} м (${(it.game / heroH * 100).toFixed(0)}% роста), в жизни ${it.real.toFixed(2)} м (${(it.real / HUMAN * 100).toFixed(0)}%) → ${(it.game / heroH / (it.real / HUMAN) * 100).toFixed(0)}% от настоящего`);
console.log('→ ' + out);
