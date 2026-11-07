'use strict';
// =====================================================================
//  МОНСТРОХОР: остров поющих монстриков.
//  Мир — большой летающий остров (2240×500 единиц), камера двигается пальцем и приближается двумя.
//  Небо и море рисуются в координатах экрана, остров и всё на нём — в координатах мира.
//  Кнопки и окна — обычный HTML поверх.
// =====================================================================
const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------- остров: суперэллипс, постройки, препятствия
const ISL = { x: 1200, y: 560, rx: 1120, ry: 250 };
const BX = { x: 40, y: 290, w: 2320, h: 830 }; // рамка слоя острова: трава и скала под ней
const sk = x => Math.pow(1 - Math.pow(Math.min(1, Math.abs(x - ISL.x) / ISL.rx), 4), 0.25);
const islandEdge = x => ISL.y + ISL.ry * sk(x); // передний край травы
const islandBack = x => ISL.y - ISL.ry * sk(x); // задний край
const ARCH = { x: 2060, y: 505 }, NEST = { x: 330, y: 505 };
const POND = { x: 1560, y: 700, rx: 125, ry: 42 };
const BUSH_POS = [[540, 735], [1880, 745], [250, 625], [2150, 630]];
const TREES = [[180, 440, 1.05, 0.2], [2220, 450, 1.0, 1.3], [760, 352, 0.72, 2.1], [1660, 350, 0.78, 3.4], [1180, 334, 0.6, 4.2]];
const MUSH = [[2300, 600], [100, 590], [1300, 784], [880, 772]];
// ---------- острова: свой вид, свои монстры, своя песня
const ISLES = {
  green: { name: 'Певучий остров', about: 'Весёлая песня в до мажоре. 10 обычных и 10 элитных певцов', base: BASE_IDS, elite: ELITE_IDS, need: 1, price: 0 },
  lava: { name: 'Вулкан', about: 'Огненный рок: гитара, орган, наковальня и рык вулкана', base: ['ugolek', 'magmus', 'iskra', 'dymok', 'perchik', 'kremen'], elite: ['drakosha', 'vulkanya'], need: 3, price: 1500, gift: 'ugolek' },
  ice: { name: 'Льдинка', about: 'Снежный вальс на три четверти: челеста, туба и бубенцы', base: ['snezhok', 'sosulka', 'pingvi', 'elochka', 'morozik', 'shishka'], elite: ['snezhinka', 'yetik'], need: 5, price: 4000, gift: 'snezhok' },
  sea: { name: 'Лагуна', about: 'Солнечное калипсо: стальной барабан, укулеле и бонги', base: ['krabik', 'meduza', 'kokos', 'kitenok', 'rakushka', 'popugaika'], elite: ['delfa', 'pancyr'], need: 7, price: 8000, gift: 'krabik' },
};
const ISLE_IDS = Object.keys(ISLES);
for (const id of ISLE_IDS) {
  const I = ISLES[id]; I.base = I.base.filter(k => KINDS[k]); I.elite = I.elite.filter(k => KINDS[k]); I.kinds = [...I.base, ...I.elite];
  I.pair = Object.fromEntries(I.elite.map(k => [KINDS[k].el.slice().sort().join('+'), k]));
  I.byEl = {}; for (const k of I.base) (I.byEl[KINDS[k].el[0]] = I.byEl[KINDS[k].el[0]] || []).push(k);
}
const ALL_KINDS = ISLE_IDS.flatMap(id => ISLES[id].kinds);
const isle = () => ISLES[S.isl];
const newIsle = () => ({ mons: [], bushes: [{ n: 6 }, { n: 6 }], breed: null, nest: [] });
// вид острова: небо, море, скалы, трава, деревья, пруд, водопады, украшения, летающие огоньки
const THEMES = {
  green: {
    sky: ['#4fb4f4', '#9fdcff', '#ffe9c8'], haze: 'rgba(255,255,255,.55)', sea: ['#7fd3f2', '#3fa8e0', '#1f6fb8'], wave: 'rgba(255,255,255,.5)', glint: '#fff', cloud: '#fff',
    cliff: ['#b07a46', '#8a5a32', '#5a3a22'], cliffLine: '#4a2e18', rocks: ['#9a6a3e', '#6e4628'], hang: 'roots', hangCol: '#6a4a22', soil: '#6e4a26',
    grass: ['#a6e870', '#7fd552', '#5bb83a'], grassLine: '#3f8a24', blades: ['#4ea830', '#9ae064'], nBlades: 1500, patch: ['rgba(255,255,200,.13)', 'rgba(40,110,20,.12)'],
    flower: 'flower', flowers: ['#ff6a8a', '#ffd84a', '#ffffff', '#b07aff', '#ff9a3a'], path: ['rgba(214,180,120,.75)', 'rgba(160,120,70,.35)'], stone: ['#b8a898', '#5a4a3a'],
    pond: 'water', fall: 'water', tree: 'leafy', deco: 'mush', bush: ['#3f9a2a', '#1f5a14', '#e8304a'], flies: 'butterfly', drift: 'petal', driftCol: ['#ffc0d8', '#fff2b8'],
    glow: 'rgba(220,255,120,A)', decoGlow: 'rgba(255,120,90,A)', far: ['#7ecb6a', '#8fd47a', '#a0dc8c', '#86ce70'], farTree: '#6fb85a', shadow: 'rgba(20,70,30,.1)', vig: '10,30,70',
  },
  lava: {
    cloudShade: 'rgba(110,80,90,.9)', sky: ['#3a1f45', '#b4505a', '#ffb878'], haze: 'rgba(255,170,110,.45)', sea: ['#ffc04a', '#ff6a1a', '#8a1a0a'], wave: 'rgba(255,240,150,.6)', glint: '#fff2a0', cloud: '#b8a4a8', lavaSea: true,
    cliff: ['#5e4c50', '#3e3236', '#221a1e'], cliffLine: '#1a1214', rocks: ['#4a3c40', '#2e2428'], hang: 'drips', hangCol: '#ff7a2a', soil: '#2e2226',
    grass: ['#8e7e76', '#706258', '#54463f'], grassLine: '#2e2420', blades: ['#3e322c', '#9a7a5a'], nBlades: 700, patch: ['rgba(255,140,60,.12)', 'rgba(20,10,10,.16)'],
    flower: 'ember', flowers: ['#ff6a2a', '#ffb02a', '#ff3a1a'], path: ['rgba(40,28,30,.7)', 'rgba(255,120,40,.4)'], stone: ['#4a3e42', '#1e1618'],
    pond: 'lava', fall: 'lava', tree: 'ember', sunGlow: 'rgba(255,150,70,.26)', deco: 'crystalRed', bush: ['#4a6a2a', '#22340e', '#ff3a1a'], flies: 'ember', drift: 'ash', driftCol: ['#9a9090', '#c8b8b0'],
    glow: 'rgba(255,150,60,A)', decoGlow: 'rgba(255,80,40,A)', far: ['#5a4448', '#6a5054', '#4e3a3e', '#62484c'], farTree: '#ff6a2a', shadow: 'rgba(40,10,10,.16)', vig: '60,10,10',
  },
  ice: {
    sky: ['#6a9ee0', '#c4e2ff', '#f6faff'], haze: 'rgba(255,255,255,.6)', sea: ['#cfeefa', '#74b8de', '#2a6aa0'], wave: 'rgba(255,255,255,.6)', glint: '#fff', cloud: '#fff', aurora: true,
    cliff: ['#b4d2ea', '#7fa2c6', '#4a6a92'], cliffLine: '#3a5478', rocks: ['#d0e2f4', '#94b4d4'], hang: 'icicles', hangCol: '#dff2ff', soil: '#8fb0d4',
    grass: ['#ffffff', '#eef6ff', '#d2e4f6'], grassLine: '#8aa8c8', blades: ['#c4d8ee', '#ffffff'], nBlades: 500, patch: ['rgba(255,255,255,.4)', 'rgba(120,160,210,.1)'],
    flower: 'sparkle', flowers: ['#8fd0ff', '#ffffff', '#c8b8ff'], path: ['rgba(170,210,240,.7)', 'rgba(255,255,255,.6)'], stone: ['#c8dcf0', '#5a7a9a'],
    pond: 'ice', fall: 'ice', tree: 'pine', sunGlow: 'rgba(255,250,235,.3)', deco: 'crystalBlue', bush: ['#2f6a5a', '#173a30', '#e8304a'], flies: 'none', drift: 'snow', driftCol: ['#ffffff', '#e8f4ff'],
    glow: 'rgba(160,220,255,A)', decoGlow: 'rgba(120,200,255,A)', far: ['#e8f2fc', '#d8e8f8', '#f4f8ff', '#dcecfa'], farTree: '#2f6a5a', shadow: 'rgba(40,70,120,.08)', vig: '20,40,90',
  },
  sea: {
    sky: ['#2fa8f0', '#8ee2ff', '#fff4c8'], haze: 'rgba(255,255,255,.5)', sea: ['#86f0e4', '#22c2cc', '#137ab0'], wave: 'rgba(255,255,255,.6)', glint: '#fff', cloud: '#fff',
    cliff: ['#e8c890', '#c8a060', '#8a6a3a'], cliffLine: '#6a4a24', rocks: ['#d8b880', '#a8824a'], hang: 'vines', hangCol: '#3f9a3a', soil: '#c09050',
    grass: ['#fff0b8', '#f6dc94', '#e6c474'], grassLine: '#c8a050', blades: ['#6ac048', '#a6e070'], nBlades: 520, patch: ['rgba(255,255,255,.2)', 'rgba(190,140,60,.12)'],
    flower: 'shell', flowers: ['#ff8a7a', '#ffd0a0', '#ffffff', '#ff6a9a', '#ffb04a'], path: ['rgba(150,100,55,.75)', 'rgba(90,60,30,.5)'], stone: ['#e0c8a0', '#8a6a44'],
    pond: 'lagoon', fall: 'water', tree: 'palm', sunGlow: 'rgba(255,240,170,.3)', deco: 'starfish', bush: ['#2f9a4a', '#145a26', '#e8304a'], flies: 'butterfly', drift: 'petal', driftCol: ['#ff8ac0', '#ffe080'],
    glow: 'rgba(120,255,220,A)', decoGlow: 'rgba(255,170,120,A)', far: ['#7ed86a', '#f4dc94', '#8fe07a', '#f0d088'], farTree: '#3fa83a', shadow: 'rgba(120,90,20,.1)', vig: '10,50,80',
  },
};
let TH = THEMES.green;
// куда нельзя ставить монстров: постройки, пруд, кусты (и места под будущие), деревья
const OBST = [
  { x: ARCH.x, y: ARCH.y, rx: 100, ry: 45 }, { x: NEST.x, y: NEST.y, rx: 82, ry: 36 }, { x: POND.x, y: POND.y, rx: POND.rx + 42, ry: POND.ry + 24 },
  ...BUSH_POS.map(([x, y]) => ({ x, y, rx: 62, ry: 28 })), ...TREES.map(([x, y, s]) => ({ x, y, rx: 58 * s, ry: 26 * s })),
];
const inEll = (o, x, y) => ((x - o.x) / o.rx) ** 2 + ((y - o.y) / o.ry) ** 2 < 1;
const LEVEL_XP = [0, 30, 80, 150, 250, 380, 550, 760, 1020, 1350, 1750, 2250, 2850];
const maxMons = () => Math.min(26, 4 + S.lvl * 2);
const MAX_LVL = 10, FEEDS = 4;
const feedCost = m => 3 + m.lvl * 2;
const rateOf = m => KINDS[m.kind].rate * (1 + 0.35 * (m.lvl - 1));
const capOf = m => Math.round(rateOf(m) * 15);
const sellPrice = k => (KINDS[k].price ? Math.round(KINDS[k].price * 0.5) : 150);
const BREED_SEC = k => (KINDS[k].el.length > 1 ? 60 : 20);
const BERRY_SEC = 7, BERRY_CAP = 12, BUSH_PRICE = 300;

// свободное место для монстра: на траве, не у самого края, не на постройках и не вплотную к другим
function canPlace(x, y, id) {
  const k = Math.abs(x - ISL.x) / (ISL.rx - 70); if (k >= 1) return false;
  const s = Math.pow(1 - Math.pow(k, 4), 0.25);
  if (y < ISL.y - (ISL.ry - 55) * s || y > ISL.y + (ISL.ry - 30) * s) return false;
  if (OBST.some(o => inEll(o, x, y))) return false;
  return !S.mons.some(m => m.id !== id && Math.hypot(m.x - x, (m.y - y) * 1.7) < 96);
}
function findSpot(x0, y0, id) {
  for (let r = 0; r < 1500; r += 28) {
    const n = Math.max(1, Math.floor(r / 18));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r * 0.013, x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r * 0.42; if (canPlace(x, y, id)) return [x, y]; }
  }
  return null;
}

// ---------- сохранение (вторая версия: монстры стоят где угодно, у каждого свои координаты)
const SAVE = 'monstrohor-v3', SAVE2 = 'monstrohor-v2', SAVE1 = 'monstrohor-v1';
let S = null;
function newState() {
  return { v: 3, coins: 250, berries: 25, xp: 0, lvl: 1, nid: 3, isl: 'green',
    isles: { green: { mons: [{ id: 1, kind: 'bumbo', x: 1090, y: 600, lvl: 1, feed: 0, stored: 0 }, { id: 2, kind: 'fyuti', x: 1310, y: 590, lvl: 1, feed: 0, stored: 0 }], bushes: [{ n: 6 }, { n: 6 }], breed: null, nest: [] } },
    found: { bumbo: 1, fyuti: 1 }, music: true, sfx: true, tips: {}, t: Date.now() };
}
function load(json) {
  let s = null;
  try { s = JSON.parse(json !== undefined ? json : localStorage.getItem(SAVE)); } catch (e) {}
  if (!(s && s.v === 3)) {
    try { s = JSON.parse(localStorage.getItem(SAVE2)); } catch (e) { s = null; }
    if (!(s && s.v === 2)) { try { s = JSON.parse(localStorage.getItem(SAVE1)); } catch (e) { s = null; } s = s && s.v === 1 ? migrate(s) : null; }
    s = s ? toV3(s) : newState();
  }
  for (const id in s.isles) { if (!ISLES[id]) { delete s.isles[id]; continue; } const I = s.isles[id]; I.mons = (I.mons || []).filter(m => KINDS[m.kind]); I.nest = (I.nest || []).filter(k => KINDS[k]); if (I.breed && !KINDS[I.breed.kind]) I.breed = null; I.bushes = I.bushes || [{ n: 6 }]; }
  if (!s.isles.green) s.isles.green = newIsle();
  if (!s.isles[s.isl]) s.isl = 'green';
  return bindIsle(s);
}
// вторая версия (один остров) → третья (острова)
function toV3(s) {
  s.v = 3; s.isl = 'green'; s.isles = { green: { mons: s.mons || [], bushes: s.bushes || [{ n: 6 }, { n: 6 }], breed: s.breed || null, nest: s.nest || [] } };
  delete s.mons; delete s.bushes; delete s.breed; delete s.nest; return s;
}
// S.mons, S.bushes, S.breed, S.nest — всегда того острова, где ты сейчас (в сохранение не попадают)
function bindIsle(s) {
  for (const k of ['mons', 'bushes', 'breed', 'nest']) Object.defineProperty(s, k, { get() { return this.isles[this.isl][k]; }, set(v) { this.isles[this.isl][k] = v; }, enumerable: false, configurable: true });
  return s;
}
// сохранение первой версии: клетки маленького острова → координаты на большом
function migrate(s) {
  const OLD = [[340, 398], [480, 398], [620, 398], [760, 398], [900, 398], [270, 478], [410, 478], [550, 478], [690, 478], [830, 478], [970, 478], [470, 566], [640, 566], [810, 566]];
  s.v = 2; for (const m of s.mons) { const [ox, oy] = OLD[m.slot] || [640, 480]; m.x = ISL.x + (ox - 640) * 1.7; m.y = ISL.y + (oy - 478) * 1.6; delete m.slot; }
  return s;
}
function fixPositions() { const cur = S.isl; for (const id in S.isles) { S.isl = id; for (const m of S.mons) if (!(m.x > 0) || !canPlace(m.x, m.y, m.id)) { const p = findSpot(m.x || ISL.x, m.y || ISL.y, m.id); if (p) [m.x, m.y] = p; } } S.isl = cur; }
function save() { S.t = Date.now(); try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} cloudSave(false); }
// есть ли что продолжать: прогресс сверх самого начала
const hasProgress = s => !!s && (s.lvl > 1 || s.xp > 0 || Object.keys(s.isles).length > 1 || Object.values(s.isles).some(I => I.mons.length !== 2) || Math.floor(s.coins) !== 250);
// онлайн-версия: сохранение ещё и в облаке (у каждого игрока своё), чтобы прогресс не терялся
let cloud = null, cloudJson = '', cloudT = 0, cloudBusy = false;
function cloudSave(force) {
  if (!cloud || cloudBusy) return; const now = Date.now(); if (!force && now - cloudT < 20000) return;
  const json = JSON.stringify(S); if (json === cloudJson) return;
  cloudT = now; cloudBusy = true;
  cloud.set({ json, t: S.t }).then(() => { cloudJson = json; }, () => {}).finally(() => { cloudBusy = false; });
}
async function cloudInit() {
  try {
    if (location.protocol === 'file:' || !window.claude || !window.claude.use) return;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); if (!db || !user) return;
    const uid = await user.id(); if (!uid) return;
    const ref = db.doc('data/users/' + uid + '/save');
    const snap = await Promise.race([ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
    const d = snap.exists ? snap.data() : null;
    if (d && typeof d.json === 'string') {
      cloudJson = d.json;
      // в облаке свежее, чем здесь (другое устройство или очищенный браузер) — берём его, пока игра не началась
      if (!started && (d.t || 0) > (S.t || 0) + 1000) { const s2 = load(d.json); if (s2 && s2.isles) { S = s2; try { localStorage.setItem(SAVE, d.json); } catch (e) {} TH = THEMES[S.isl]; applyTheme(); fixPositions(); hud(); menu(); } }
    }
    cloud = ref; if (started) cloudSave(true);
  } catch (e) {}
}
// пока игры не было: монеты копятся до предела, кусты растят ягоды (не больше 12 часов)
function offline() {
  const dt = clamp((Date.now() - (S.t || Date.now())) / 1000, 0, 12 * 3600); if (dt < 5) return 0;
  let got = 0;
  for (const id in S.isles) {
    const I = S.isles[id];
    for (const m of I.mons) { const add = Math.min(capOf(m) - m.stored, rateOf(m) * dt / 60); if (add > 0) { m.stored += add; if (id === S.isl) got += add; } }
    for (const b of I.bushes) b.n = Math.min(BERRY_CAP, b.n + dt / BERRY_SEC);
  }
  return Math.round(got);
}
// монстры других островов тоже поют и копят монеты, кусты растят ягоды
function growOther(dt) {
  for (const id in S.isles) {
    if (id === S.isl) continue; const I = S.isles[id];
    for (const m of I.mons) if (m.stored < capOf(m)) m.stored = Math.min(capOf(m), m.stored + rateOf(m) * dt / 60);
    for (const b of I.bushes) b.n = Math.min(BERRY_CAP, b.n + dt / BERRY_SEC);
  }
}

// ---------- камера: центр (x, y) в мире и масштаб z (точек экрана на единицу мира)
const cam = { x: ISL.x, y: 520, z: 0 };
let camGoal = null;
const zDef = () => H / 760, zMin = () => Math.min(zDef(), Math.max(W / 2650, H / 1250)), zMax = () => H / 400;
function clampCam() {
  cam.z = clamp(cam.z, zMin(), zMax());
  const hw = W / 2 / cam.z, hh = H / 2 / cam.z, x0 = ISL.x - ISL.rx - 120, x1 = ISL.x + ISL.rx + 120, y0 = 140, y1 = 930;
  cam.x = 2 * hw >= x1 - x0 ? ISL.x : clamp(cam.x, x0 + hw, x1 - hw);
  cam.y = 2 * hh >= y1 - y0 ? (y0 + y1) / 2 : clamp(cam.y, y0 + hh, y1 - hh);
}
const worldT = c => { const z = cam.z * (1 + (typeof ZP === 'number' ? ZP : 0)); c.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z)); };
const screenT = c => c.setTransform(DPR, 0, 0, DPR, 0, 0);
const toWorld = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
const viewL = () => cam.x - W / 2 / cam.z, viewR = () => cam.x + W / 2 / cam.z;
function zoomAt(sx, sy, z) { const [wx, wy] = toWorld(sx, sy); cam.z = clamp(z, zMin(), zMax()); cam.x = wx - (sx - W / 2) / cam.z; cam.y = wy - (sy - H / 2) / cam.z; clampCam(); }

// ---------- экран
let HZ = 0; // линия горизонта на экране
// слабый телефон: если кадров мало, рисуем чуть менее чётко, зато плавно
let DPR_CAP = 2, qT = -4, qN = 0;
function quality(dt) {
  if (!started || document.hidden) return; qT += dt; if (qT < 0) return; qN++;
  if (qT < 2.5) return; const fps = qN / qT; qT = qN = 0;
  if (fps < 40 && DPR_CAP > 1 && (window.devicePixelRatio || 1) > 1) { DPR_CAP = Math.max(1, Math.min(DPR, DPR_CAP) - 0.25); resize(); }
}
function resize() {
  DPR = Math.min(DPR_CAP, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  if (!cam.z || !started) cam.z = zDef(); clampCam();
  HZ = Math.round(H * 0.6); raysG = null; vig = null;
  buildBg(); buildIsland();
  for (const c of clouds) if (c.x > W + 300) c.x = rand(-100, W);
}
// небо и море — один раз на размер экрана
let bgLayer = null, islC = null, islRes = 0, islTheme = null, ISL_PATH = null, GLINTS = [];
function buildBg() {
  bgLayer = document.createElement('canvas'); bgLayer.width = cv.width; bgLayer.height = cv.height;
  const x = bgLayer.getContext('2d'); screenT(x);
  const sky = x.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, TH.sky[0]); sky.addColorStop(0.55, TH.sky[1]); sky.addColorStop(1, TH.sky[2]);
  x.fillStyle = sky; x.fillRect(0, 0, W, HZ + 1);
  x.fillStyle = TH.haze; for (let i = 0; i < 9; i++) { const cx = (i + 0.5) * W / 9; x.beginPath(); x.ellipse(cx, HZ - 4, W / 11, H * (0.05 + (i % 3) * 0.015), 0, Math.PI, 0); x.fill(); }
  const sea = x.createLinearGradient(0, HZ, 0, H); sea.addColorStop(0, TH.sea[0]); sea.addColorStop(0.3, TH.sea[1]); sea.addColorStop(1, TH.sea[2]);
  x.fillStyle = sea; x.fillRect(0, HZ, W, H - HZ);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, HZ, W, 2);
  const R = mulberry(3); GLINTS = Array.from({ length: 36 }, () => [R() * W, HZ + 6 + Math.pow(R(), 1.5) * (H - HZ), R() * 6]);
}
// остров — один раз в собственный холст в координатах мира (рисуется камерой с масштабом)
function buildIsland() {
  const res = clamp(DPR * zDef() * 1.75, 0.8, 1.9);
  if (islC && Math.abs(res - islRes) < 0.05 && islTheme === TH) return;
  islRes = res; islTheme = TH; islC = document.createElement('canvas'); islC.width = Math.round(BX.w * res); islC.height = Math.round(BX.h * res);
  const x = islC.getContext('2d'); x.setTransform(res, 0, 0, res, -BX.x * res, -BX.y * res);
  drawIsland(x);
  ISL_PATH = new Path2D(); islandPath(ISL_PATH);
}
function islandPath(x, dy = 0, sx = 1) {
  if (x.beginPath) x.beginPath(); // годится и для холста, и для Path2D
  for (let i = 0; i <= 180; i++) {
    const a = i / 180 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const px = ISL.x + ISL.rx * sx * Math.sign(c) * Math.pow(Math.abs(c), 0.5), py = ISL.y + dy + ISL.ry * Math.sign(s) * Math.pow(Math.abs(s), 0.5);
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
}
function drawIsland(x) {
  const R = mulberry(7), rnd = (a, b) => a + R() * (b - a), L = ISL.x - ISL.rx, Rr = ISL.x + ISL.rx;
  const onTop = (px, py, m = 4) => py < islandEdge(px) - m && py > islandBack(px) + m && !inEll({ x: POND.x, y: POND.y, rx: POND.rx + 14, ry: POND.ry + 10 }, px, py);
  // нижняя часть: скалистый конус, сужается вниз
  x.save();
  const cliff = x.createLinearGradient(0, ISL.y, 0, ISL.y + 520); cliff.addColorStop(0, TH.cliff[0]); cliff.addColorStop(0.45, TH.cliff[1]); cliff.addColorStop(1, TH.cliff[2]);
  x.fillStyle = cliff; x.strokeStyle = TH.cliffLine; x.lineWidth = 5;
  x.beginPath(); x.moveTo(L + 8, ISL.y + 8);
  x.bezierCurveTo(L + 120, ISL.y + 260, ISL.x - 520, ISL.y + 430, ISL.x - 80, ISL.y + 515);
  x.lineTo(ISL.x + 60, ISL.y + 522);
  x.bezierCurveTo(ISL.x + 560, ISL.y + 430, Rr - 110, ISL.y + 260, Rr - 8, ISL.y + 8);
  x.closePath(); x.fill(); x.stroke(); x.clip();
  for (let i = 0; i < 9; i++) { x.strokeStyle = `rgba(0,0,0,${0.08 + i * 0.015})`; x.lineWidth = 4; x.beginPath(); const yy = ISL.y + 70 + i * 50; x.moveTo(L, yy); for (let xx = L; xx <= Rr; xx += 40) x.lineTo(xx, yy + Math.sin(xx * 0.013 + i) * 12); x.stroke(); }
  for (let i = 0; i < 120; i++) { const px = rnd(L + 60, Rr - 60), py = ISL.y + rnd(60, 480); x.fillStyle = R() < 0.5 ? TH.rocks[0] : TH.rocks[1]; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2.5; x.beginPath(); x.ellipse(px, py, rnd(12, 34), rnd(8, 18), rnd(-0.4, 0.4), 0, Math.PI * 2); x.fill(); x.stroke(); }
  // светящиеся трещины в скалах вулкана
  if (TH.hang === 'drips') { x.strokeStyle = 'rgba(255,120,40,.75)'; x.lineWidth = 3; for (let i = 0; i < 14; i++) { let px = rnd(L + 150, Rr - 150), py = ISL.y + rnd(40, 300); x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += rnd(-24, 24); py += rnd(16, 34); x.lineTo(px, py); } x.stroke(); } }
  x.restore();
  // что свисает с края: корни, лава, сосульки, лианы
  x.lineCap = 'round';
  for (let i = 0; i < 36; i++) {
    const px = L + 90 + i * 60 + rnd(-12, 12), py = islandEdge(px) + 20;
    if (TH.hang === 'icicles') { const len = rnd(26, 70); x.fillStyle = 'rgba(225,245,255,.92)'; x.strokeStyle = '#8ab4d8'; x.lineWidth = 2; x.beginPath(); x.moveTo(px - 7, py - 6); x.lineTo(px, py + len); x.lineTo(px + 7, py - 6); x.closePath(); x.fill(); x.stroke(); continue; }
    if (TH.hang === 'drips') { const len = rnd(20, 60); x.strokeStyle = '#ff6a1a'; x.lineWidth = 6; x.beginPath(); x.moveTo(px, py - 4); x.lineTo(px, py + len); x.stroke(); x.fillStyle = '#ffc04a'; x.beginPath(); x.arc(px, py + len, 5, 0, Math.PI * 2); x.fill(); continue; }
    x.strokeStyle = TH.hangCol; x.lineWidth = 3.5; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + rnd(-14, 14), py + 30, px + rnd(-14, 14), py + 55, px + rnd(-10, 10), py + rnd(55, 110)); x.stroke();
    if (TH.hang === 'vines') for (let k = 1; k < 4; k++) leafShape(x, px + rnd(-8, 8), py + k * 22, 12, rnd(0.3, 2.8), '#5cc040');
  }
  // кромка земли и верх острова
  x.fillStyle = TH.soil; islandPath(x, 26, 0.997); x.fill();
  const grass = x.createLinearGradient(0, ISL.y - ISL.ry, 0, ISL.y + ISL.ry); grass.addColorStop(0, TH.grass[0]); grass.addColorStop(0.5, TH.grass[1]); grass.addColorStop(1, TH.grass[2]);
  x.fillStyle = grass; x.strokeStyle = TH.grassLine; x.lineWidth = 5; islandPath(x); x.fill(); x.stroke();
  x.save(); x.beginPath(); x.rect(L - 20, ISL.y - ISL.ry - 20, Rr - L + 40, ISL.ry * 0.9); x.clip(); x.strokeStyle = 'rgba(255,255,240,.45)'; x.lineWidth = 3; islandPath(x, 4, 0.994); x.stroke(); x.restore();
  x.fillStyle = TH.grass[2];
  for (let px = L + 30; px < Rr - 30; px += 14) { const py = islandEdge(px) - 2; x.beginPath(); x.moveTo(px - 8, py); x.lineTo(px, py + rnd(10, 24)); x.lineTo(px + 8, py); x.fill(); }
  x.save(); islandPath(x); x.clip();
  for (let i = 0; i < 90; i++) { const px = rnd(L + 60, Rr - 60), py = rnd(ISL.y - ISL.ry + 20, ISL.y + ISL.ry - 10); x.fillStyle = R() < 0.5 ? TH.patch[0] : TH.patch[1]; x.beginPath(); x.ellipse(px, py, rnd(50, 150), rnd(16, 36), 0, 0, Math.PI * 2); x.fill(); }
  const depth = x.createLinearGradient(0, ISL.y - ISL.ry, 0, ISL.y + ISL.ry); depth.addColorStop(0, 'rgba(255,255,235,.16)'); depth.addColorStop(0.55, 'rgba(255,255,235,0)'); depth.addColorStop(1, 'rgba(0,30,10,.14)');
  x.fillStyle = depth; x.fillRect(L, ISL.y - ISL.ry, Rr - L, ISL.ry * 2);
  const sun = x.createRadialGradient(ISL.x + 650, ISL.y - 260, 40, ISL.x + 650, ISL.y - 260, 1100); sun.addColorStop(0, TH.sunGlow || 'rgba(255,246,190,.28)'); sun.addColorStop(1, 'rgba(255,246,190,0)');
  x.fillStyle = sun; x.fillRect(L, ISL.y - ISL.ry, Rr - L, ISL.ry * 2);
  // кустики травы и полянки цветов — не ровной россыпью, а островками
  if (TH.flower !== 'sparkle') for (let i = 0; i < 280; i++) {
    const px = rnd(L + 40, Rr - 40), py = rnd(ISL.y - ISL.ry + 6, ISL.y + ISL.ry); if (!onTop(px, py, 6)) continue;
    const n = 4 + (R() * 4 | 0), h = rnd(9, 17) * (0.75 + 0.5 * (py - ISL.y + ISL.ry) / (2 * ISL.ry));
    for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.32 + rnd(-0.1, 0.1); x.strokeStyle = k % 2 ? TH.blades[0] : TH.blades[1]; x.lineWidth = 2.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(px + (k - n / 2) * 1.5, py); x.quadraticCurveTo(px + Math.cos(a) * h * 0.5, py + Math.sin(a) * h * 0.6, px + Math.cos(a) * h, py + Math.sin(a) * h); x.stroke(); }
  }
  else for (let i = 0; i < 160; i++) { const px = rnd(L + 40, Rr - 40), py = rnd(ISL.y - ISL.ry + 6, ISL.y + ISL.ry); if (!onTop(px, py, 6)) continue; x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(px, py, rnd(10, 26), rnd(4, 8), 0, Math.PI, 0); x.fill(); x.fillStyle = 'rgba(150,185,225,.35)'; x.beginPath(); x.ellipse(px, py + 1, rnd(10, 22), 2.5, 0, 0, Math.PI); x.fill(); }
  // тропинка к арке
  x.strokeStyle = TH.path[0]; x.lineWidth = 30; x.lineCap = 'round'; x.beginPath(); x.moveTo(1880, 800); x.quadraticCurveTo(1990, 690, 2060, 530); x.stroke();
  x.strokeStyle = TH.path[1]; x.lineWidth = 2; x.setLineDash([6, 10]); x.beginPath(); x.moveTo(1880, 800); x.quadraticCurveTo(1990, 690, 2060, 530); x.stroke(); x.setLineDash([]);
  pondBase(x);
  // травинки и мелочи: цветы, угольки, искорки инея, ракушки
  for (let i = 0; i < TH.nBlades; i++) {
    const px = rnd(L + 30, Rr - 30), py = rnd(ISL.y - ISL.ry, ISL.y + ISL.ry); if (!onTop(px, py)) continue;
    x.strokeStyle = R() < 0.5 ? TH.blades[0] : TH.blades[1]; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-3, 3), py - rnd(5, 11)); x.stroke();
  }
  const FL = TH.flowers, beds = Array.from({ length: 26 }, () => [rnd(L + 120, Rr - 120), rnd(ISL.y - ISL.ry + 40, ISL.y + ISL.ry - 30)]);
  for (let i = 0; i < 330; i++) {
    const bed = i % 3 ? beds[i % beds.length] : null, px = bed ? bed[0] + rnd(-46, 46) : rnd(L + 40, Rr - 40), py = bed ? bed[1] + rnd(-16, 16) : rnd(ISL.y - ISL.ry + 10, ISL.y + ISL.ry); if (!onTop(px, py, 8)) continue;
    const col = FL[i % FL.length];
    if (TH.flower === 'flower') { x.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; x.beginPath(); x.arc(px + Math.cos(a) * 3, py + Math.sin(a) * 2, 2.4, 0, Math.PI * 2); x.fill(); } x.fillStyle = '#ffb02a'; x.beginPath(); x.arc(px, py, 1.6, 0, Math.PI * 2); x.fill(); }
    else if (TH.flower === 'ember') { x.fillStyle = '#2a2024'; x.beginPath(); x.ellipse(px, py, 5, 3, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(px, py - 0.5, 2.2, 0, Math.PI * 2); x.fill(); }
    else if (TH.flower === 'sparkle') { x.fillStyle = col; x.beginPath(); x.moveTo(px, py - 5); x.lineTo(px + 1.2, py - 1.2); x.lineTo(px + 5, py); x.lineTo(px + 1.2, py + 1.2); x.lineTo(px, py + 5); x.lineTo(px - 1.2, py + 1.2); x.lineTo(px - 5, py); x.lineTo(px - 1.2, py - 1.2); x.closePath(); x.fill(); }
    else { x.fillStyle = col; x.strokeStyle = 'rgba(120,70,40,.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py + 2); x.arc(px, py + 2, 5, Math.PI * 1.1, Math.PI * 1.9); x.closePath(); x.fill(); x.stroke(); }
  }
  x.restore();
  // камни и украшения
  for (const [px, py, s] of [[150, 520, 1], [2260, 520, 0.85], [700, 790, 0.7], [1760, 798, 0.75], [2000, 610, 0.6], [440, 570, 0.6]]) {
    x.fillStyle = TH.stone[0]; x.strokeStyle = TH.stone[1]; x.lineWidth = 3; x.beginPath(); x.ellipse(px, py, 24 * s, 15 * s, 0, Math.PI, 0); x.lineTo(px + 24 * s, py); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = TH.deco === 'crystalBlue' ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(px - 6 * s, py - 9 * s, 8 * s, 4 * s, -0.3, 0, Math.PI * 2); x.fill();
  }
  for (const [px, py] of MUSH) drawDeco(x, px, py);
}
// украшения на траве: грибы, кристаллы, морские звёзды
function drawDeco(x, px, py) {
  if (TH.deco === 'mush') {
    x.fillStyle = '#f4ead6'; x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.4; x.beginPath(); x.roundRect(px - 4, py - 14, 8, 14, 3); x.fill(); x.stroke();
    x.fillStyle = '#e8483a'; x.beginPath(); x.ellipse(px, py - 14, 13, 9, 0, Math.PI, 0); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#fff'; for (const d of [-6, 1, 6]) { x.beginPath(); x.arc(px + d, py - 18 + Math.abs(d) * 0.4, 1.8, 0, Math.PI * 2); x.fill(); }
  } else if (TH.deco === 'starfish') {
    x.fillStyle = '#ff8a5a'; x.strokeStyle = '#a0402a'; x.lineWidth = 2; x.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 5 : 13; x.lineTo(px + Math.cos(a) * r, py - 6 + Math.sin(a) * r * 0.7); } x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#ffd0b0'; x.beginPath(); x.arc(px, py - 6, 2, 0, Math.PI * 2); x.fill();
  } else {
    const red = TH.deco === 'crystalRed', c1 = red ? '#ff5a3a' : '#9fe0ff', c2 = red ? '#a0201a' : '#3a7ab8';
    for (const [dx, h, a] of [[-7, 26, -0.25], [4, 34, 0.08], [12, 20, 0.35]]) { x.save(); x.translate(px + dx, py); x.rotate(a); x.fillStyle = c1; x.strokeStyle = c2; x.lineWidth = 2; x.beginPath(); x.moveTo(-5, 0); x.lineTo(-5, -h * 0.75); x.lineTo(0, -h); x.lineTo(5, -h * 0.75); x.lineTo(5, 0); x.closePath(); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(-3, -h * 0.7, 2, h * 0.55); x.restore(); }
  }
}
// дно пруда: вода, лава, лёд или лагуна
function pondBase(x) {
  const t = TH.pond, rim = { water: '#d8c08a', lava: '#2a1e20', ice: '#e8f4ff', lagoon: '#fff0c0' }[t];
  x.fillStyle = rim; x.beginPath(); x.ellipse(POND.x, POND.y + 3, POND.rx + 14, POND.ry + 10, 0, 0, Math.PI * 2); x.fill();
  const C = { water: ['#2f8fd0', '#5fc8f0', '#2a6a9a'], lava: ['#ff7a1a', '#ffd04a', '#5a1a0a'], ice: ['#a8d8f4', '#e4f6ff', '#6aa0c8'], lagoon: ['#18b8c8', '#7ff0e0', '#1a8a9a'] }[t];
  const w = x.createLinearGradient(0, POND.y - POND.ry, 0, POND.y + POND.ry); w.addColorStop(0, C[0]); w.addColorStop(1, C[1]);
  x.fillStyle = w; x.strokeStyle = C[2]; x.lineWidth = 3; x.beginPath(); x.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(POND.x - 40, POND.y - 14, 46, 8, -0.1, 0, Math.PI * 2); x.fill();
  if (t === 'water') {
    for (const [dx, dy, r] of [[-60, 8, 16], [48, -6, 13], [78, 14, 11]]) { x.fillStyle = '#4fae32'; x.strokeStyle = '#2f6a1f'; x.lineWidth = 2; x.beginPath(); x.ellipse(POND.x + dx, POND.y + dy, r, r * 0.45, 0, 0.3, Math.PI * 2 - 0.1); x.lineTo(POND.x + dx, POND.y + dy); x.closePath(); x.fill(); x.stroke(); }
    x.fillStyle = '#ff9ad0'; x.beginPath(); x.arc(POND.x - 60, POND.y + 4, 5, 0, Math.PI * 2); x.fill();
  } else if (t === 'lava') {
    for (const [dx, dy, r] of [[-62, 6, 18], [40, -8, 14], [84, 12, 10], [-10, 14, 9]]) { x.fillStyle = '#3a2a2c'; x.strokeStyle = '#1a1012'; x.lineWidth = 2; x.beginPath(); x.ellipse(POND.x + dx, POND.y + dy, r, r * 0.45, 0.2, 0, Math.PI * 2); x.fill(); x.stroke(); }
  } else if (t === 'ice') {
    x.strokeStyle = 'rgba(80,130,180,.5)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(POND.x - 70, POND.y - 4); x.lineTo(POND.x - 20, POND.y + 8); x.lineTo(POND.x + 10, POND.y - 6); x.lineTo(POND.x + 60, POND.y + 10); x.moveTo(POND.x - 20, POND.y + 8); x.lineTo(POND.x - 30, POND.y + 26); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(POND.x + 20, POND.y + 4, 60, 14, 0.1, 3.4, 5.6); x.stroke(); x.beginPath(); x.ellipse(POND.x - 10, POND.y, 40, 10, -0.1, 0.2, 2.6); x.stroke();
  } else {
    x.fillStyle = '#c8b8a0'; x.strokeStyle = '#6a5a4a'; x.lineWidth = 2.5; x.beginPath(); x.ellipse(POND.x + 70, POND.y + 6, 18, 10, 0, Math.PI, 0); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.5)'; for (const [dx, dy] of [[-50, 10], [10, -10], [40, 16]]) { x.beginPath(); x.ellipse(POND.x + dx, POND.y + dy, 14, 3, 0, 0, Math.PI * 2); x.fill(); }
  }
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- живые части мира
const clouds = Array.from({ length: 7 }, () => ({ x: rand(-100, 1000), y: rand(0.04, 0.4), s: rand(0.6, 1.3), v: rand(5, 12), a: rand(0.55, 0.9) }));
const parts = []; // частицы: ноты, монеты, искры, сердечки
let T = 0, last = performance.now(), sel = null;
const rt = new Map(); // id монстра → живое состояние для рисования

// небо (в координатах экрана; облака двигаются чуть-чуть вслед за камерой — глубина)
const SKS = () => H / 412;
function drawCloud(c) {
  const k = SKS() * c.s, cx = c.x - (cam.x - ISL.x) * cam.z * 0.08, cy = c.y * H;
  const P = [[0, 0, 22], [21, -8, 18], [40, 1, 19], [18, 7, 19], [-19, 4, 15]], blob = (oy, sc) => { g.beginPath(); for (const [dx, dy, r] of P) { g.moveTo(cx + dx * k + r * k * sc, cy + (dy + oy) * k); g.arc(cx + dx * k, cy + (dy + oy) * k, r * k * sc, 0, Math.PI * 2); } g.fill(); };
  g.globalAlpha = c.a; g.fillStyle = TH.cloudShade || 'rgba(176,200,232,.9)'; blob(5, 1);
  g.fillStyle = TH.cloud; blob(0, 0.96);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(cx + 12 * k, cy - 12 * k, 14 * k, 6 * k, -0.2, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
}
function drawSea() {
  g.strokeStyle = TH.wave; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 30; i++) {
    const row = i % 6, y = HZ + 6 + Math.pow(row / 5, 1.5) * (H - HZ - 10), sp = 10 + row * 5, x = ((i * 197 + T * sp) % (W + 160)) - 80, w = (10 + row * 5) * SKS();
    g.globalAlpha = 0.35 + 0.4 * Math.sin(T * 1.5 + i); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke();
  }
  g.globalAlpha = 1;
}
const FAR = [[0.04, 0.54, 0.55, 0], [0.93, 0.5, 0.7, 1], [0.38, 0.46, 0.32, 2], [0.66, 0.55, 0.4, 3]];
function drawFar() {
  const px = -(cam.x - ISL.x) * cam.z * 0.04;
  for (const [fx, fy, s, ci] of FAR) {
    const col = TH.far[ci];
    const k = s * SKS() * 0.55; g.save(); g.translate(fx * W + px, fy * H); g.scale(k, k);
    g.fillStyle = 'rgba(120,110,150,.35)'; g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(-60, 170, 0, 230); g.quadraticCurveTo(60, 170, 150, 0); g.fill();
    g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 160, 34, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(-20, -8, 100, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a4a3a'; g.fillRect(40, -70, 10, 60); g.fillStyle = TH.farTree;
    if (TH.tree === 'pine') { g.beginPath(); g.moveTo(10, -40); g.lineTo(45, -150); g.lineTo(80, -40); g.closePath(); g.fill(); } else { g.beginPath(); g.arc(45, -80, 34, 0, Math.PI * 2); g.arc(20, -64, 22, 0, Math.PI * 2); g.arc(70, -62, 24, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
}
// водопады с краёв острова (в мире)
function drawWaterfall(x0) {
  const f = TH.fall, y0 = islandEdge(x0) - 6, y1 = y0 + (f === 'ice' ? 300 : 520);
  const C = f === 'lava' ? ['rgba(255,210,90,.98)', 'rgba(255,80,20,0)', 'rgba(255,250,190,.8)'] : f === 'ice' ? ['rgba(235,250,255,.96)', 'rgba(200,230,250,0)', 'rgba(255,255,255,.9)'] : ['rgba(160,225,255,.95)', 'rgba(120,200,255,0)', 'rgba(255,255,255,.7)'];
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, C[0]); gr.addColorStop(1, C[1]);
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 16, y0); g.quadraticCurveTo(x0 + 6, y0 + 50, x0 + 6, y1); g.lineTo(x0 + 38, y1); g.quadraticCurveTo(x0 + 38, y0 + 50, x0 + 20, y0); g.closePath(); g.fill();
  g.strokeStyle = C[2]; g.lineWidth = 2;
  if (f === 'ice') { for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x0 + 6 + i * 7, y0 + 20); g.lineTo(x0 + 8 + i * 7, y0 + 140 + i * 30); g.stroke(); } const k = (T * 0.3) % 1; g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x0 + 18, y0 + 30 + k * 200, 3, 0, Math.PI * 2); g.fill(); return; }
  for (let i = 0; i < 6; i++) { const yy = y0 + ((T * (f === 'lava' ? 60 : 130) + i * 60) % 420); g.beginPath(); g.moveTo(x0 + 4 + i * 5, yy); g.lineTo(x0 + 6 + i * 5, yy + 24); g.stroke(); }
  g.fillStyle = f === 'lava' ? 'rgba(255,160,60,.8)' : 'rgba(255,255,255,.8)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x0 + 4, y0 + 2, 20 + Math.sin(T * 5 + i) * 3, 6, 0, 0, Math.PI * 2); g.fill(); }
}
// пруд: круги на воде
function drawPond() {
  g.save(); g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx - 4, POND.ry - 3, 0, 0, Math.PI * 2); g.clip();
  if (TH.pond === 'lava') {
    for (let i = 0; i < 5; i++) { const k = (T * 0.5 + i / 5) % 1, cx = POND.x + [-70, -20, 25, 60, 90][i] * 0.9, cy = POND.y + [4, -8, 10, -4, 6][i]; g.fillStyle = `rgba(255,240,150,${0.8 * (1 - k)})`; g.beginPath(); g.arc(cx, cy - k * 6, 3 + k * 7, 0, Math.PI * 2); g.fill(); }
  } else if (TH.pond === 'ice') {
    const k = (T * 0.15) % 1.6; g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(POND.x - POND.rx + k * POND.rx * 1.6, POND.y - 4, 14, 34, 0.6, 0, Math.PI * 2); g.fill();
  } else {
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const k = ((T * 0.4 + i / 3) % 1), cx = POND.x + [-20, 30, 70][i], cy = POND.y + [0, 6, -10][i]; g.globalAlpha = 1 - k; g.beginPath(); g.ellipse(cx, cy, 8 + k * 36, 3 + k * 12, 0, 0, Math.PI * 2); g.stroke(); }
  }
  g.globalAlpha = 1; g.restore();
}
function drawTree([x, y, s, ph]) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const sh = g.createRadialGradient(0, 0, 4, 0, 0, 70); sh.addColorStop(0, 'rgba(20,40,10,.35)'); sh.addColorStop(1, 'rgba(20,40,10,0)');
  g.save(); g.scale(1, 0.25); g.fillStyle = sh; g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.fill(); g.restore();
  const sway = Math.sin(T * 0.7 + ph) * 0.025;
  if (TH.tree === 'pine') {
    g.fillStyle = '#7a5030'; g.strokeStyle = '#3a2410'; g.lineWidth = 4; g.beginPath(); g.roundRect(-10, -40, 20, 40, 4); g.fill(); g.stroke();
    g.rotate(sway);
    for (let i = 0; i < 4; i++) {
      const b = -30 - i * 44, t = b - 86 + i * 6, w = 82 - i * 17;
      g.fillStyle = '#2f6a4a'; g.strokeStyle = '#173a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-w, b); g.lineTo(0, t); g.lineTo(w, b); g.quadraticCurveTo(0, b + 10, -w, b); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-w * 0.55, t + (b - t) * 0.55); g.lineTo(0, t); g.lineTo(w * 0.55, t + (b - t) * 0.55); for (let k = 4; k >= -4; k--) g.lineTo(k * w * 0.137, t + (b - t) * (0.55 + (k % 2 ? 0.12 : 0))); g.closePath(); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, -2, 40, 8, 0, 0, Math.PI * 2); g.fill();
  } else if (TH.tree === 'palm') {
    g.rotate(sway * 0.6);
    g.lineCap = 'round'; g.strokeStyle = '#6a4a24'; g.lineWidth = 26; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-6, -110, 26, -210); g.stroke();
    g.strokeStyle = '#b08850'; g.lineWidth = 20; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-6, -110, 26, -210); g.stroke();
    g.strokeStyle = 'rgba(90,60,30,.5)'; g.lineWidth = 2.5; for (let i = 1; i < 10; i++) { const k = i / 10, px = (1 - k) * (1 - k) * 0 + 2 * (1 - k) * k * -6 + k * k * 26, py = 2 * (1 - k) * k * -110 + k * k * -210; g.beginPath(); g.moveTo(px - 9, py + 2); g.lineTo(px + 9, py - 2); g.stroke(); }
    g.translate(26, -212); const w = Math.sin(T * 1.1 + ph) * 0.06;
    for (const a of [-2.95, -2.45, -1.95, -1.25, -0.7, -0.2]) leafShape(g, 0, 0, 92, a + w + (a < -1.6 ? 0.25 : -0.25) * Math.abs(Math.cos(a)), '#3fa83a');
    for (const [dx, dy] of [[-8, 6], [6, 8], [0, 14]]) { g.fillStyle = '#6a4220'; g.strokeStyle = '#3a2410'; g.lineWidth = 2; g.beginPath(); g.arc(dx, dy, 8, 0, Math.PI * 2); g.fill(); g.stroke(); }
  } else {
    const fire = TH.tree === 'ember';
    g.fillStyle = fire ? '#3a2c2e' : '#8a5a32'; g.strokeStyle = fire ? '#140c0e' : '#4a2e18'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(-8, -70, -10, -130); g.lineTo(10, -130); g.quadraticCurveTo(8, -70, 16, 0); g.closePath(); g.fill(); g.stroke();
    if (fire) { g.strokeStyle = 'rgba(255,120,40,.85)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-4, -10); g.lineTo(2, -40); g.lineTo(-3, -70); g.lineTo(3, -100); g.stroke(); }
    g.rotate(sway);
    const leaves = [[-40, -140, 46], [36, -150, 44], [0, -185, 54], [-10, -128, 40], [28, -118, 34]];
    g.fillStyle = fire ? '#5a1a0a' : '#2f7a1f'; g.beginPath(); for (const [dx, dy, r] of leaves) { g.moveTo(dx + r + 4, dy); g.arc(dx, dy, r + 4, 0, Math.PI * 2); } g.fill();
    const lg = g.createLinearGradient(0, -240, 0, -90); lg.addColorStop(0, fire ? '#ffd04a' : '#8ad860'); lg.addColorStop(1, fire ? '#e8401a' : '#3f9a2a');
    g.fillStyle = lg; g.beginPath(); for (const [dx, dy, r] of leaves) { g.moveTo(dx + r, dy); g.arc(dx, dy, r, 0, Math.PI * 2); } g.fill();
    g.fillStyle = 'rgba(255,255,220,.25)'; for (const [dx, dy, r] of leaves.slice(0, 3)) { g.beginPath(); g.ellipse(dx - r * 0.3, dy - r * 0.35, r * 0.4, r * 0.22, -0.4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = fire ? '#fff2a0' : '#ff6a8a'; for (const [dx, dy] of [[-30, -160], [20, -172], [44, -136], [-6, -200]]) { g.beginPath(); g.arc(dx, dy, fire ? 3.5 + Math.sin(T * 6 + dx) * 1.5 : 5, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}
function drawArch() {
  const { x, y } = ARCH, b = S.breed;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(30,40,20,.25)'; g.beginPath(); g.ellipse(0, 0, 70, 12, 0, 0, Math.PI * 2); g.fill();
  g.lineJoin = 'round';
  for (const s of [-1, 1]) { g.fillStyle = '#c8b8a0'; g.strokeStyle = '#5a4a3a'; g.lineWidth = 4; g.beginPath(); g.roundRect(s * 48 - 15, -112, 30, 112, 8); g.fill(); g.stroke(); g.strokeStyle = 'rgba(90,74,58,.4)'; g.lineWidth = 2; for (const yy of [-80, -50, -22]) { g.beginPath(); g.moveTo(s * 48 - 13, yy); g.lineTo(s * 48 + 13, yy); g.stroke(); } }
  g.strokeStyle = '#5a4a3a'; g.lineWidth = 34 + 8; g.beginPath(); g.arc(0, -110, 48, Math.PI, 0); g.stroke();
  g.strokeStyle = '#c8b8a0'; g.lineWidth = 32; g.beginPath(); g.arc(0, -110, 48, Math.PI, 0); g.stroke();
  // знаки пяти стихий на своде
  const glow = b ? 0.6 + 0.4 * Math.sin(T * 5) : 0.4;
  ['stone', 'water', 'wind', 'leaf', 'fire'].forEach((e, i) => { const a = Math.PI + (i + 0.5) / 5 * Math.PI; g.fillStyle = ELEMENTS[e].col; g.globalAlpha = glow; g.beginPath(); g.arc(Math.cos(a) * 48, -110 + Math.sin(a) * 48, 6.5, 0, Math.PI * 2); g.fill(); });
  g.globalAlpha = 1;
  g.strokeStyle = '#3f9a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-60, -10); g.bezierCurveTo(-70, -60, -40, -120, -10, -152); g.stroke();
  for (let i = 0; i < 6; i++) leafShape(g, -62 + i * 9, -20 - i * 22, 12, -0.6 - i * 0.2, '#5cc040');
  if (b) {
    const left = (b.end - Date.now()) / 1000, k = 1 - left / b.dur;
    if (left > 0) {
      g.strokeStyle = 'rgba(255,140,200,.7)'; g.lineWidth = 4; g.beginPath(); g.arc(0, -60, 26, T * 3, T * 3 + Math.PI * 2 * clamp(k, 0.02, 1)); g.stroke();
      g.fillStyle = '#fff'; g.font = '800 17px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(fmtTime(left), 0, -54);
      if (Math.random() < 0.05) parts.push({ kind: 'heart', x: x + rand(-30, 30), y: y - 70, vx: rand(-10, 10), vy: -30, life: 1.6, t: 0 });
    } else {
      // готово: яйцо в арке; при нажатии качается, трескается и лопается
      const h = hatching, bob = h ? 0 : Math.sin(T * 4) * 3, gw = h ? 0.5 + h.t * 0.4 : 0.5;
      const gl = g.createRadialGradient(0, -46, 4, 0, -46, 54 + (h ? h.t * 30 : 0)); gl.addColorStop(0, `rgba(255,246,170,${gw})`); gl.addColorStop(1, 'rgba(255,240,150,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(0, -46, 90, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(0, -20 + bob);
      if (h) g.rotate(Math.sin(h.t * 34) * 0.16 * Math.min(1, h.t * 3));
      drawEgg(g, 0, 0, 1 + (h ? Math.max(0, h.t - 0.9) * 0.6 : 0), b.kind);
      if (h) { g.strokeStyle = '#5a4a3a'; g.lineWidth = 2.6; g.lineJoin = 'round';
        const CR = [[[-14, -30], [-6, -24], [-10, -16], [-2, -12]], [[12, -34], [4, -28], [9, -20], [2, -16]], [[-16, -12], [-6, -8], [2, -12], [12, -8], [18, -12]]];
        CR.slice(0, h.cracks).forEach(cr => { g.beginPath(); cr.forEach(([cx, cy], i) => (i ? g.lineTo(cx, cy) : g.moveTo(cx, cy))); g.stroke(); }); }
      g.restore();
      if (!h) bubble(0, -130 + bob, '!', '#ff5a8a');
    }
  }
  g.restore();
}
function drawEgg(c, x, y, s, kind) {
  const K = KINDS[kind], col = K ? K.col : '#fff', elite = K && K.el.length > 1;
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = elite ? '#fff2c8' : '#fff8e8'; c.strokeStyle = elite ? '#b08a20' : '#6a5a4a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -46); c.bezierCurveTo(26, -46, 30, 0, 0, 0); c.bezierCurveTo(-30, 0, -26, -46, 0, -46); c.fill(); c.stroke();
  c.fillStyle = col; c.globalAlpha = 0.7; for (const [dx, dy, r] of [[-8, -30, 5], [9, -20, 6], [-5, -10, 4], [6, -36, 3]]) { c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1;
  c.restore();
}
function drawNest() {
  const { x, y } = NEST; g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(30,40,20,.25)'; g.beginPath(); g.ellipse(0, 0, 58, 11, 0, 0, Math.PI * 2); g.fill();
  if (S.nest.length) { S.nest.slice(0, 3).forEach((k, i) => drawEgg(g, (i - (Math.min(3, S.nest.length) - 1) / 2) * 24, -18 - (i % 2) * 4 + Math.sin(T * 3 + i) * 1.5, 0.62, k)); }
  g.fillStyle = '#a07040'; g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -14, 54, 18, 0, 0, Math.PI); g.lineTo(-54, -18); g.quadraticCurveTo(0, -30, 54, -18); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#7a5028'; g.lineWidth = 2.4; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(-50 + i * 12, -20 + (i % 2) * 6); g.lineTo(-40 + i * 12, -4 - (i % 3) * 3); g.stroke(); }
  if (S.nest.length) bubble(0, -64, String(S.nest.length), '#3aa6ff');
  g.restore();
}
function drawBush(i) {
  const [x, y] = BUSH_POS[i], b = S.bushes[i]; g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(30,40,20,.25)'; g.beginPath(); g.ellipse(0, 0, 44, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = TH.bush[0]; g.strokeStyle = TH.bush[1]; g.lineWidth = 3;
  g.beginPath(); for (const [dx, dy, r] of [[-22, -20, 20], [20, -20, 20], [0, -36, 24], [0, -14, 24]]) { g.moveTo(dx + r, dy); g.arc(dx, dy, r, 0, Math.PI * 2); } g.stroke(); g.fill();
  if (TH.drift === 'snow') { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -52, 22, 9, 0, Math.PI, 0); g.ellipse(-24, -34, 14, 6, 0, Math.PI, 0); g.ellipse(24, -34, 14, 6, 0, Math.PI, 0); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.ellipse(-8, -44, 12, 6, -0.4, 0, Math.PI * 2); g.fill();
  const n = Math.floor(b.n), spots = [[-24, -26], [14, -40], [26, -18], [-6, -22], [2, -46], [-18, -40], [10, -12], [-30, -12], [32, -32], [-10, -8], [20, -28], [-2, -34]];
  for (let k = 0; k < Math.min(n, spots.length); k++) { const [dx, dy] = spots[k]; g.fillStyle = TH.bush[2]; g.strokeStyle = '#7a1020'; g.lineWidth = 1.6; g.beginPath(); g.arc(dx, dy, 5, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(dx - 1.6, dy - 1.6, 1.4, 0, Math.PI * 2); g.fill(); }
  if (n >= 6) bubble(0, -76, '+' + n, '#e8304a', 'berry');
  g.restore();
}
// пузырь над головой: монеты, ягоды, «!»
function bubble(x, y, text, col, icon) {
  const bob = Math.sin(T * 3 + x) * 3; y += bob;
  g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 3.5;
  g.beginPath(); g.ellipse(x, y, 30, 22, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 7, y + 19); g.lineTo(x, y + 30); g.lineTo(x + 7, y + 19); g.fillStyle = '#fff'; g.fill();
  if (icon === 'coin') { coinIcon(g, x - 12, y, 9); g.fillStyle = '#7a5a10'; g.font = '800 15px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(text, x - 1, y + 5); }
  else if (icon === 'berry') { g.fillStyle = '#e8304a'; g.beginPath(); g.arc(x - 12, y, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7a1020'; g.font = '800 15px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(text, x - 2, y + 5); }
  else { g.fillStyle = col; g.font = '900 24px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(text, x, y + 8); }
}
function coinIcon(c, x, y, r) {
  c.fillStyle = '#ffcc2a'; c.strokeStyle = '#a07010'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#ffe680'; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, Math.PI * 2); c.fill();
}
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : s + ' с'; };

// ---------- монстры на острове (стоят где угодно: у каждого x, y)
function monSize(m) { const f = clamp((m.y - (ISL.y - ISL.ry)) / (2 * ISL.ry), 0, 1); return 110 * (0.88 + 0.22 * f) * (1 + 0.04 * (m.lvl - 1)); }
function stateOf(m) {
  let r = rt.get(m.id);
  if (!r) { r = { phase: Math.random() * 6, blinkT: rand(1, 4), blinkP: 1, blink: 0, look: 0, lookY: 0, lookT: rand(1, 3), lastOn: 0, sp: 0, sv: 0, jy: 0, jv: 0, actT: rand(4, 12), wig: 0, tilt: 0, bob: 0, lift: 0 }; rt.set(m.id, r); }
  return r;
}
// сила «желе» на каждую ноту: барабаны трясут сильнее, долгие ноты — мягко
const JELLY = { kick: 1.5, snare: 1.0, tom: 0.9, shaker: 0.16, bass: 0.75, marimba: 0.45, flute: 0.35, pluck: 0.5, brass: 0.85, frog: 0.8, lead: 0.45, whistle: 0.3, pad: 0.35, opera: 0.55, bassvox: 0.6, beatbox: 0.9, chant: 1.0, soprano: 0.4, yodel: 0.5, scat: 0.55,
  rockkick: 1.5, fuzzbass: 0.7, riff: 0.6, organ: 0.3, cowbell: 0.4, anvil: 1.0, rockvox: 0.5, growl: 0.8, celesta: 0.35, glass: 0.25, oompah: 0.9, sleigh: 0.4,
  strings: 0.35, woodblock: 0.5, icesoprano: 0.4, baritone: 0.45, claves: 0.5, steel: 0.45, bongo: 0.7, subbass: 0.7, ukulele: 0.5, panflute: 0.35, calypsovox: 0.5, reggaevox: 0.55 };
const DENSE = new Set(['shaker', 'cowbell', 'woodblock', 'bongo', 'claves', 'sleigh']);
let lookAt = null; // куда все смотрят после нажатия
function spinMon(m) { const r = stateOf(m); if (!r.turn && !r.lift) r.turn = 0.001; }
function jumpMon(m, v) { const r = stateOf(m); if (r.jy > 0) return; r.jv = v; r.jy = 0.01; r.sv -= 0.9; }
function updateMon(m, dt) {
  const r = stateOf(m), K = KINDS[m.kind], x = m.x, y = m.y, sz = monSize(m);
  r.blinkT -= dt; if (r.blinkT < 0) { r.blinkP = 0; r.blinkT = Math.random() < 0.2 ? 0.3 : rand(2.2, 5.5); }
  if (r.blinkP < 1) { r.blinkP = Math.min(1, r.blinkP + dt / 0.2); r.blink = Math.sin(r.blinkP * Math.PI); } else r.blink = 0;
  if (lookAt && T < lookAt.until) { r.lookTo = clamp((lookAt.x - x) / 220, -1, 1); r.lookYTo = clamp((lookAt.y - (y - sz * 0.6)) / 220, -1, 1); }
  else {
    r.lookT -= dt;
    if (r.lookT < 0) {
      r.lookT = rand(1.2, 3.5);
      // чаще всего смотрит на того, кто сейчас громко поёт рядом, — как в настоящем хоре
      const near = S.mons.filter(o => o !== m && Math.abs(o.x - x) < 700 && (rt.get(o.id) || {}).sing > 0.3);
      if (near.length && Math.random() < 0.65) { const o = pick(near), os = monSize(o); r.lookTo = clamp((o.x - x) / 160, -1, 1); r.lookYTo = clamp((o.y - os * 0.6 - (y - sz * 0.6)) / 200, -0.6, 0.4); }
      else { r.lookTo = rand(-1, 1); r.lookYTo = rand(-0.5, 0.3); }
    }
  }
  const ek = 1 - Math.exp(-dt * 12); r.look = lerp(r.look, r.lookTo || 0, ek); r.lookY = lerp(r.lookY, r.lookYTo || 0, ek);
  r.sing = Sound.ready && !m.mute ? Sound.singing(m.id) : 0;
  r.vowel = r.sing > 0.05 ? Sound.vowel(m.id) : null;
  r.hit = Math.max(0, (r.hit || 0) - dt * 7);
  const on = Sound.ready && S.music && !m.mute;
  r.dance = lerp(r.dance || 0, on ? (0.35 + 0.65 * Math.min(1, r.sing * 1.5 + CROWD * 0.5)) * (0.7 + 0.65 * SECE) : 0, 1 - Math.exp(-dt * 2.5)); // в припеве — бурнее
  if (r.turn > 0) { r.turn += dt / 0.7; if (r.turn >= 1) r.turn = 0; else if (Math.random() < dt * 30) parts.push({ kind: 'spark', x: x + rand(-sz * 0.4, sz * 0.4), y: y - rand(10, sz), vx: rand(-40, 40), vy: rand(-90, -30), life: rand(0.4, 0.8), t: 0, col: ELEMENTS[pick(K.el)].col }); }
  const now = Sound.now(), n = Sound.onsets(m.id, r.lastOn); r.lastOn = now;
  if (n && !m.mute) {
    r.sv -= JELLY[K.part] || 0.4; r.hit = 1;
    if (rings.length < 50 && (!DENSE.has(K.part) || Math.random() < 0.25)) rings.push({ x, y, t: 0, col: ELEMENTS[K.el[(r.ringN = (r.ringN || 0) + 1) % K.el.length]].col });
    if (Math.random() < 0.55) parts.push({ kind: 'note', x: x + rand(-20, 20), y: y - sz * 0.95 - r.jy, vx: rand(-14, 14), vy: rand(-55, -35), life: 1.5, t: 0, col: ELEMENTS[K.el[n % K.el.length]].col, ch: Math.random() < 0.5 ? '♪' : '♫' });
  }
  const acc = -260 * r.sp - 10 * r.sv; r.sv += acc * dt; r.sp = clamp(r.sp + r.sv * dt, -0.24, 0.24);
  if (r.jy > 0) {
    r.jv -= 1800 * dt; r.jy += r.jv * dt;
    if (r.jy <= 0) {
      r.jy = 0; const hit = -r.jv;
      if (hit > 180) { r.sv -= Math.min(2.6, hit / 380); dust(x, y, Math.min(1.6, hit / 500)); if (hit > 420) { r.jv = hit * 0.28; r.jy = 0.01; } }
      if (r.jy === 0) r.jv = 0;
    }
  }
  r.actT -= dt;
  if (r.actT < 0 && !r.lift) { r.actT = rand(6, 15); const k = Math.random(); if (k < 0.3) jumpMon(m, rand(260, 380)); else if (k < 0.55) r.wig = 1; else if (k < 0.75) spinMon(m); else r.lookT = 0; }
  r.wig = Math.max(0, r.wig - dt * 1.1); r.tilt = Math.sin(r.wig * 16) * 0.13 * r.wig + (r.lift ? Math.sin(T * 9) * 0.08 : 0);
  if (Sound.ready && S.music && !m.mute) { const b = Sound.beat(), f = b - Math.floor(b); r.bob = Math.pow(1 - f, 5) * 3.2; } else r.bob = 0;
  if (m.stored < capOf(m)) m.stored = Math.min(capOf(m), m.stored + rateOf(m) * dt / 60);
}
function dust(x, y, k = 1) {
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; parts.push({ kind: 'dust', x: x + Math.cos(a) * 20 * k, y: y - 2 + Math.sin(a) * 4, vx: Math.cos(a) * rand(40, 90) * k, vy: Math.sin(a) * 10 - 12, life: rand(0.45, 0.7), t: 0, r: rand(7, 12) * k }); }
}
function drawMon(m) {
  const r = stateOf(m), sz = monSize(m);
  // поднятый пальцем: подсвеченный круг — можно ли сюда поставить
  const dg = drag && drag.m === m ? drag : place && place.m === m ? place : null;
  if (dg) { g.strokeStyle = dg.ok ? 'rgba(120,255,140,.95)' : 'rgba(255,90,90,.95)'; g.fillStyle = dg.ok ? 'rgba(120,255,140,.2)' : 'rgba(255,90,90,.2)'; g.lineWidth = 4; g.beginPath(); g.ellipse(m.x, m.y, 50, 16, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  drawMonster(g, m.kind, m.x, m.y, sz, { t: T, sing: r.sing, blink: r.blink, look: r.look, lookY: r.lookY, phase: r.phase, sq: r.sp, jump: r.jy + (r.lift ? 26 : 0), bob: r.bob, tilt: r.tilt,
    beat: BEAT, bpb: BPB, dance: r.lift ? 0 : r.dance, hit: r.hit, turn: r.turn, vowel: r.vowel });
  if (m.mute) { const mx = m.x + sz * 0.32, my = m.y - sz * 0.9; g.fillStyle = 'rgba(40,40,60,.75)'; g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(mx - 6, my - 6); g.lineTo(mx + 6, my + 6); g.stroke(); }
}
const bubbleY = m => m.y - monSize(m) * (KINDS[m.kind].hover ? 1.35 : 1.18) - 12;
const hasBubble = m => Math.floor(m.stored) >= Math.max(5, rateOf(m) * 0.75);
function monBubble(m) { if (hasBubble(m) && !(drag && drag.m === m)) bubble(m.x, bubbleY(m), String(Math.floor(m.stored)), '#e8b020', 'coin'); }
const panOf = m => clamp((m.x - ISL.x) / ISL.rx * 0.8, -0.8, 0.8);
function hitMon(x, y) {
  return S.mons.slice().sort((a, b) => b.y - a.y).find(m => { const sz = monSize(m), r = stateOf(m), top = m.y - sz * (KINDS[m.kind].hover ? 1.2 : 1) - r.jy; return Math.abs(x - m.x) < sz * 0.45 && y > top && y < m.y + 14; });
}

// ---------- частицы
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.kind === 'fly') { const k = clamp(p.t / p.life, 0, 1), e = k * k, [tx, ty] = toWorld(p.sx, p.sy); p.x = lerp(p.x0, tx, e) + Math.sin(k * Math.PI) * p.arc; p.y = lerp(p.y0, ty, e) - Math.sin(k * Math.PI) * 60; if (k >= 1) { parts.splice(i, 1); if (p.done) p.done(); } continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'spark') p.vy += 120 * dt;
    if (p.kind === 'confetti') { p.vy += 420 * dt; p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.2; p.rot += p.vr * dt; }
    if (p.kind === 'dust') { p.vx *= 1 - dt * 5; p.vy *= 1 - dt * 3; }
    if (p.kind === 'mist') { p.vx *= 1 - dt * 2; }
    if (p.kind === 'petal') { p.y += Math.sin(p.t * 2.2) * 22 * dt; p.rot += p.vr * dt; if (p.x > viewR() + 40) p.t = p.life + 1; }
    if (p.kind === 'snow') { p.x += Math.sin(p.t * 1.7 + p.ph) * 14 * dt; if (p.y > cam.y + H / 2 / cam.z + 30) p.t = p.life + 1; }
    if (p.t > p.life) parts.splice(i, 1);
  }
}
function drawParts() {
  for (const p of parts) {
    const a = p.kind === 'fly' ? 1 : clamp(1 - p.t / p.life, 0, 1);
    g.globalAlpha = a;
    if (p.kind === 'note') { g.font = '900 30px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeText(p.ch, p.x + Math.sin(p.t * 4) * 6, p.y); g.fillStyle = shade(p.col, -0.25); g.fillText(p.ch, p.x + Math.sin(p.t * 4) * 6, p.y); }
    else if (p.kind === 'heart') { g.fillStyle = '#ff5a9a'; g.font = '900 22px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('♥', p.x, p.y); }
    else if (p.kind === 'spark') { g.fillStyle = p.col || '#ffe680'; g.beginPath(); g.arc(p.x, p.y, 4 * a + 1, 0, Math.PI * 2); g.fill(); }
    else if (p.kind === 'fly') { const k = 1 / Math.max(0.4, cam.z * 1.6); if (p.icon === 'coin') coinIcon(g, p.x, p.y, 11 * k); else { g.fillStyle = '#e8304a'; g.strokeStyle = '#7a1020'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 8 * k, 0, Math.PI * 2); g.fill(); g.stroke(); } }
    else if (p.kind === 'dust') { const k = p.t / p.life; g.fillStyle = `rgba(250,240,220,${0.75 * a})`; g.beginPath(); g.arc(p.x, p.y, p.r * (0.6 + k), 0, Math.PI * 2); g.fill(); }
    else if (p.kind === 'mist') { g.fillStyle = p.dark ? `rgba(110,90,90,${0.35 * a})` : `rgba(255,255,255,${0.35 * a})`; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + p.t), 0, Math.PI * 2); g.fill(); }
    else if (p.kind === 'petal') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(p.rot * 1.3))); g.fillStyle = p.col; g.beginPath(); g.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    else if (p.kind === 'snow') { g.fillStyle = `rgba(255,255,255,${Math.min(1, p.t * 2) * 0.9})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
    else if (p.kind === 'confetti') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.rot * 1.7)); g.fillStyle = p.col; g.fillRect(-5, -3, 10, 6); g.restore(); }
    else if (p.kind === 'text') { g.font = '900 26px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(p.text, p.x, p.y); g.fillStyle = p.col || '#fff'; g.fillText(p.text, p.x, p.y); }
  }
  g.globalAlpha = 1;
}
const CONF = ['#ff5a8a', '#ffd84a', '#5ad0ff', '#7ee05a', '#b07aff', '#ff9a3a'];
function confetti(x, y, n = 40, spread = 1) { for (let i = 0; i < n; i++) { const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), v = rand(180, 460) * spread; parts.push({ kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, 6), vr: rand(-12, 12), life: rand(1.4, 2.2), t: 0, col: CONF[i % CONF.length] }); } }
function burst(x, y, col, n = 14) { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(60, 200); parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rand(0.5, 1), t: 0, col }); } }
function floatText(x, y, text, col) { parts.push({ kind: 'text', x, y, vx: 0, vy: -40, life: 1.3, t: 0, text, col }); }
// иконка летит в счётчик наверху (цель — точка экрана, камера может двигаться)
function flyTo(x, y, el, icon, n, done) {
  const r = $(el).getBoundingClientRect(), sx = r.left + r.width * 0.3, sy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) parts.push({ kind: 'fly', icon, x0: x + rand(-14, 14), y0: y + rand(-10, 10), x, y, sx, sy, arc: rand(-60, 60), life: 0.6 + i * 0.05, t: 0, done: i === n - 1 ? done : null });
}

// ---------- живая природа вокруг острова
const birds = [], flies = Array.from({ length: 5 }, (_, i) => ({ x: rand(300, 2100), y: rand(400, 720), tx: 0, ty: 0, t: rand(0, 5), col: ['#ff9ad0', '#ffd84a', '#9fe3ff', '#ffb07a', '#c8a0ff'][i] }));
const ISLETS = [[-100, 700, 0.45, 0], [2500, 720, 0.4, 2], [-270, 520, 0.32, 4], [2690, 540, 0.3, 1]];
const SHADOWS = Array.from({ length: 6 }, () => ({ x: rand(0, 2400), y: rand(380, 760), s: rand(0.8, 1.5) }));
let birdT = 3, mistT = 0, petalT = 2, raysG = null, vig = null;
function ambient(dt) {
  birdT -= dt;
  if (birdT < 0) {
    birdT = rand(14, 26); const dir = Math.random() < 0.5 ? 1 : -1, y0 = rand(0.1, 0.35) * H, x0 = dir > 0 ? -60 : W + 60;
    for (let i = 0, n = 3 + (Math.random() * 3 | 0); i < n; i++) birds.push({ x: x0 - dir * i * rand(18, 30), y: y0 + rand(-12, 12) + Math.abs(i - 1) * 7, v: dir * rand(40, 55) * SKS(), ph: rand(0, 6), s: rand(0.6, 0.9) * SKS() });
  }
  for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; b.x += b.v * dt; b.y += Math.sin(T * 1.5 + b.ph) * 4 * dt; if (b.x < -250 || b.x > W + 250) birds.splice(i, 1); }
  for (const f of flies) {
    f.t += dt; if (!f.tx || Math.hypot(f.tx - f.x, f.ty - f.y) < 12) { f.tx = rand(300, 2100); f.ty = rand(400, 740); }
    const a = Math.atan2(f.ty - f.y, f.tx - f.x); f.x += Math.cos(a) * 46 * dt + Math.sin(f.t * 5) * 22 * dt; f.y += Math.sin(a) * 46 * dt + Math.cos(f.t * 7) * 26 * dt;
  }
  for (const s of SHADOWS) { s.x += 16 * dt; if (s.x > 2500) { s.x = -150; s.y = rand(380, 760); } }
  mistT -= dt; if (mistT < 0 && TH.fall !== 'ice') { mistT = 0.12; const x0 = Math.random() < 0.5 ? 2250 : 160; parts.push({ kind: 'mist', x: x0 + 10 + rand(-16, 16), y: islandEdge(x0) + rand(10, 60), vx: rand(-30, 30), vy: TH.fall === 'lava' ? rand(-30, -10) : rand(10, 40), life: rand(0.8, 1.4), t: 0, r: rand(6, 12), dark: TH.fall === 'lava' }); }
  petalT -= dt;
  if (petalT < 0 && TH.drift === 'snow') { petalT = 0.09; const top = cam.y - H / 2 / cam.z; parts.push({ kind: 'snow', x: rand(viewL() - 40, viewR()), y: top - 20, vx: rand(8, 26), vy: rand(36, 70), life: 30, t: 0, r: rand(2, 4.2), ph: rand(0, 6) }); }
  else if (petalT < 0) { petalT = TH.drift === 'ash' ? rand(0.5, 1.2) : rand(1.5, 3.5); parts.push({ kind: 'petal', x: viewL() - 20, y: rand(300, 760), vx: rand(45, 85), vy: TH.drift === 'ash' ? rand(-12, 4) : 0, life: 60, t: 0, rot: rand(0, 6), vr: rand(-2.5, 2.5), col: pick(TH.driftCol) }); }
}

// ---------- день и ночь: круг 5 минут — день, закат, ночь со звёздами и гирляндой, рассвет
const DAY_LEN = 300; let NIGHT = 0, DUSK = 0;
const STARS = Array.from({ length: 120 }, () => [Math.random(), Math.pow(Math.random(), 1.3) * 0.52, rand(0, 6), rand(0.6, 1.6)]);
const FIREFLIES = Array.from({ length: 22 }, () => ({ x: rand(250, 2150), y: rand(360, 780), ph: rand(0, 6), vx: rand(-14, 14), vy: rand(-8, 8) }));
// гирлянда над задним краем острова: провисы между столбиками
const GPOSTS = [300, 600, 900, 1200, 1500, 1800, 2100].map(x => [x, islandBack(x) + 50]);
const GARLAND = []; for (let i = 0; i < GPOSTS.length - 1; i++) { const [x0, y0] = GPOSTS[i], [x1, y1] = GPOSTS[i + 1]; for (let k = 0; k < 10; k++) { const t = k / 10; GARLAND.push([lerp(x0, x1, t), lerp(y0, y1, t) - 52 + Math.sin(t * Math.PI) * 22]); } }
const GCOL = ['#ff5a6a', '#ffd84a', '#5ad0ff', '#7ee05a', '#ff9ad0'];
function dayCycle() {
  const p = ((T + 25) / DAY_LEN) % 1, step = (a, b, x) => clamp((x - a) / (b - a), 0, 1), tri = (c, w) => Math.max(0, 1 - Math.abs(p - c) / w);
  NIGHT = step(0.6, 0.67, p) * (1 - step(0.88, 0.95, p));
  DUSK = Math.max(tri(0.6, 0.065), tri(0.925, 0.05) * 0.8);
}
const sunPos = () => [W * 0.8, H * (0.17 + DUSK * 0.14 + NIGHT * 0.5)];
function drawSun() {
  const a = 1 - NIGHT; if (a <= 0.01) return;
  const [sx, sy] = sunPos(), r = H * 0.42, sun = g.createRadialGradient(sx, sy, 4, sx, sy, r);
  sun.addColorStop(0, `rgba(255,${255 - DUSK * 60 | 0},${230 - DUSK * 120 | 0},${a})`); sun.addColorStop(0.25, `rgba(255,${246 - DUSK * 80 | 0},${190 - DUSK * 120 | 0},${0.9 * a})`); sun.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = sun; g.fillRect(sx - r, sy - r, r * 2, r * 2);
}
function drawRays() {
  if (NIGHT > 0.98) return; g.globalAlpha = (1 - NIGHT) * (1 - DUSK * 0.4);
  const [sx, sy] = sunPos(), L = Math.max(W, H) * 1.3;
  if (!raysG) { raysG = g.createRadialGradient(sx, sy, 10, sx, sy, L * 0.85); raysG.addColorStop(0, 'rgba(255,250,215,.24)'); raysG.addColorStop(1, 'rgba(255,250,215,0)'); }
  g.fillStyle = raysG; g.beginPath();
  for (let i = 0; i < 9; i++) { const a = T * 0.02 + i * Math.PI * 2 / 9, w = 0.08 + 0.04 * Math.sin(T * 0.6 + i * 1.7); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - w) * L, sy + Math.sin(a - w) * L); g.lineTo(sx + Math.cos(a + w) * L, sy + Math.sin(a + w) * L); g.closePath(); }
  g.fill(); g.globalAlpha = 1;
}
function drawGarland() {
  g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 2; g.beginPath(); GARLAND.forEach(([x, y], i) => (i % 10 === 0 ? g.moveTo(x, y) : g.lineTo(x, y))); g.stroke();
  for (const [x, y] of GPOSTS) { g.fillStyle = '#7a5030'; g.fillRect(x - 3, y - 54, 6, 54); g.fillStyle = '#a07040'; g.beginPath(); g.arc(x, y - 54, 5, 0, Math.PI * 2); g.fill(); }
  GARLAND.forEach(([x, y], i) => { if (i % 2) return; g.fillStyle = GCOL[(i / 2) % GCOL.length]; g.beginPath(); g.arc(x, y + 5, 4.2, 0, Math.PI * 2); g.fill(); });
}
// затемнение вечером и ночью — на весь экран; звёзды и луна — на небе (координаты экрана)
function drawNightSky() {
  screenT(g);
  if (DUSK > 0.01) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(255,160,110,${DUSK * 0.5})`; g.fillRect(0, 0, W, H); }
  if (NIGHT >= 0.01) {
    g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(66,84,168,${NIGHT * 0.78})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const [fx, fy, ph, r] of STARS) {
      const x = fx * W, y = fy * H; if (y > HZ - 10) continue;
      const k = SKS(); if (clouds.some(c => Math.abs(x - (c.x - (cam.x - ISL.x) * cam.z * 0.08) - 20 * k * c.s) < 46 * k * c.s && Math.abs(y - c.y * H) < 24 * k * c.s)) continue;
      g.fillStyle = `rgba(255,255,230,${NIGHT * (0.55 + 0.45 * Math.sin(T * 2 + ph))})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    if (TH.aurora) for (let i = 0; i < 3; i++) {
      const y0 = H * (0.1 + i * 0.07), c = i === 1 ? '130,170,255' : '80,255,170', gr = g.createLinearGradient(0, y0 - 50, 0, y0 + 40);
      gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.5, `rgba(${c},${0.2 * NIGHT})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath();
      for (let x = 0; x <= W; x += 24) g.lineTo(x, y0 - 34 + Math.sin(x * 0.007 + T * 0.35 + i * 2) * 22);
      for (let x = W; x >= 0; x -= 24) g.lineTo(x, y0 + 30 + Math.sin(x * 0.007 + T * 0.35 + i * 2) * 22); g.fill();
    }
    if (TH.lavaSea) { g.fillStyle = `rgba(255,90,20,${0.32 * NIGHT})`; g.fillRect(0, HZ, W, H - HZ); }
    const mx = W * 0.2, my = H * 0.2, mr = H * 0.07, mg = g.createRadialGradient(mx, my, 4, mx, my, mr * 3.5);
    mg.addColorStop(0, `rgba(220,230,255,${0.5 * NIGHT})`); mg.addColorStop(1, 'rgba(220,230,255,0)'); g.fillStyle = mg; g.fillRect(mx - mr * 3.5, my - mr * 3.5, mr * 7, mr * 7);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = NIGHT;
    g.fillStyle = '#f4f2e0'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(180,180,160,.5)'; for (const [dx, dy, r] of [[-0.3, -0.24, 0.2], [0.35, 0.18, 0.15], [-0.12, 0.4, 0.12], [0.4, -0.4, 0.09]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
  worldT(g);
}
// ночные огни на острове: гирлянда, грибы, светлячки, прожекторы на поющих
function drawNightGlow() {
  if (NIGHT < 0.01) return;
  g.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  GARLAND.forEach(([x, y], i) => { if (i % 2) return; const c = GCOL[(i / 2) % GCOL.length], n = parseInt(c.slice(1), 16); glow(x, y + 5, 16, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},A)`, NIGHT * (0.75 + 0.25 * Math.sin(T * 3 + i))); });
  for (const [x, y] of MUSH) glow(x, y - 10, 36, TH.decoGlow, NIGHT * 0.55);
  for (const f of FIREFLIES) glow(f.x, f.y, 9, TH.glow, NIGHT * Math.max(0, Math.sin(T * 2.4 + f.ph)));
  if (TH.pond === 'lava') glow(POND.x, POND.y, 170, 'rgba(255,120,40,A)', NIGHT * 0.5);
  for (const m of S.mons) {
    const r = stateOf(m); if (r.sing < 0.05) continue; const x = m.x, y = m.y, sz = monSize(m), a = NIGHT * r.sing;
    const col = g.createLinearGradient(0, y - sz * 2.2, 0, y); col.addColorStop(0, 'rgba(255,240,200,0)'); col.addColorStop(1, `rgba(255,240,200,${0.12 * a})`);
    g.fillStyle = col; g.beginPath(); g.moveTo(x - sz * 0.18, y - sz * 2.2); g.lineTo(x + sz * 0.18, y - sz * 2.2); g.lineTo(x + sz * 0.5, y); g.lineTo(x - sz * 0.5, y); g.closePath(); g.fill();
    glow(x, y - sz * 0.45, sz * 0.7, 'rgba(255,235,190,A)', 0.22 * a);
  }
  g.globalCompositeOperation = 'source-over';
}
// круги от нот у ног монстра — звук видно
const rings = [];
function drawRings(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; const k = Math.max(0, r.t / 0.7); if (k >= 1) { rings.splice(i, 1); continue; }
    g.strokeStyle = r.col; g.globalAlpha = (1 - k) * 0.55; g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.ellipse(r.x, r.y, 30 + k * 46, 9 + k * 13, 0, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
}
function drawBirds() {
  g.strokeStyle = 'rgba(40,50,80,.7)'; g.lineWidth = 2; g.lineCap = 'round';
  for (const b of birds) { const f = Math.sin(T * 9 + b.ph) * 6 * b.s, w = 9 * b.s; g.beginPath(); g.moveTo(b.x - w, b.y - f); g.quadraticCurveTo(b.x - w / 2, b.y - 3 * b.s, b.x, b.y); g.quadraticCurveTo(b.x + w / 2, b.y - 3 * b.s, b.x + w, b.y - f); g.stroke(); }
}
function drawGlints() {
  g.fillStyle = TH.glint;
  for (const [x, y, ph] of GLINTS) { const a = Math.sin(T * 2.6 + ph); if (a < 0.3) continue; const r = (1.5 + a * 2.5) * SKS(); g.globalAlpha = a * 0.9; g.beginPath(); g.moveTo(x - r * 2, y); g.lineTo(x, y - r * 0.5); g.lineTo(x + r * 2, y); g.lineTo(x, y + r * 0.5); g.closePath(); g.fill(); }
  g.globalAlpha = 1;
}
function drawIslets() {
  for (const [x, y, s, ph] of ISLETS) {
    if (x < viewL() - 80 || x > viewR() + 80) continue;
    g.save(); g.translate(x, y + Math.sin(T * 0.9 + ph) * 6); g.scale(s, s);
    g.fillStyle = TH.cliff[0]; g.strokeStyle = TH.cliffLine; g.lineWidth = 5; g.beginPath(); g.moveTo(-110, 0); g.quadraticCurveTo(-60, 110, 0, 170); g.quadraticCurveTo(50, 110, 110, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = TH.grass[1]; g.strokeStyle = TH.grassLine; g.beginPath(); g.ellipse(0, 0, 118, 30, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,220,.28)'; g.beginPath(); g.ellipse(-22, -8, 70, 12, 0, 0, Math.PI * 2); g.fill();
    if (ph % 2 === 0) { g.fillStyle = TH.bush[0]; g.strokeStyle = TH.bush[1]; g.lineWidth = 4; g.beginPath(); g.arc(24, -22, 26, 0, Math.PI * 2); g.arc(-6, -14, 20, 0, Math.PI * 2); g.stroke(); g.fill(); }
    else { g.fillStyle = TH.stone[0]; g.strokeStyle = TH.stone[1]; g.lineWidth = 4; g.beginPath(); g.ellipse(26, -6, 24, 18, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
}
function drawCloudShadows() {
  g.save(); g.clip(ISL_PATH); g.fillStyle = TH.shadow;
  for (const s of SHADOWS) { g.beginPath(); g.ellipse(s.x, s.y, 150 * s.s, 40 * s.s, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function drawFlies() {
  if (TH.flies === 'none') return;
  if (TH.flies === 'ember') { for (const f of flies) { const a = 0.6 + 0.4 * Math.sin(f.t * 7); g.fillStyle = `rgba(255,${150 + a * 80 | 0},60,${a})`; g.beginPath(); g.arc(f.x, f.y, 3.5, 0, Math.PI * 2); g.fill(); g.fillStyle = `rgba(255,120,40,${0.25 * a})`; g.beginPath(); g.arc(f.x, f.y, 9, 0, Math.PI * 2); g.fill(); } return; }
  for (const f of flies) {
    const k = 0.25 + 0.75 * Math.abs(Math.sin(f.t * 16)); g.save(); g.translate(f.x, f.y);
    g.fillStyle = f.col; g.strokeStyle = 'rgba(70,30,70,.7)'; g.lineWidth = 1.2;
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 6 * k, -3, 6.5 * k + 0.5, 5, sd * 0.4, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.ellipse(sd * 4.5 * k, 3.5, 4.5 * k + 0.5, 3.5, -sd * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.strokeStyle = '#3a2a3a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke(); g.restore();
  }
}
function drawVignette() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!vig) { const w = cv.width, h = cv.height; vig = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.5, w / 2, h * 0.55, Math.max(w, h) * 0.78); vig.addColorStop(0, `rgba(${TH.vig},0)`); vig.addColorStop(1, `rgba(${TH.vig},.3)`); }
  g.fillStyle = vig; g.fillRect(0, 0, cv.width, cv.height);
}

// ---------- кадр
let BEAT = 0, BPB = 4, CROWD = 0, lastBar = -1, lastBeat = -1, SECE = 0.5, lastSec = '', ZP = 0, FLASH = 0;
// как бурно звучит раздел песни: припев — во всю силу, затишье — тихо
const SEC_E = { chorus: 1, final: 1, pre: 0.75, verse: 0.6, bridge: 0.4, riff: 0.75, solo: 0.9, a: 0.5, a2: 0.75, b: 0.6, b2: 0.9 };
function groove(dt) {
  const on = Sound.ready && S.music;
  BEAT = on ? Sound.beat() : BEAT; BPB = Sound.bpb ? Sound.bpb() : 4;
  let sum = 0; for (const m of S.mons) sum += (rt.get(m.id) || {}).sing || 0;
  CROWD = lerp(CROWD, on && S.mons.length ? Math.min(1, sum / Math.max(3, S.mons.length * 0.6)) : 0, 1 - Math.exp(-dt * 1.5));
  const cur = on && Sound.section ? Sound.section() : null, sec = cur ? cur.sec : '';
  SECE = lerp(SECE, on ? (SEC_E[sec] !== undefined ? SEC_E[sec] : 0.6) : 0.3, 1 - Math.exp(-dt * 2));
  // начался припев — праздник: конфетти, вспышка, все подпрыгивают
  if (on && sec !== lastSec) { if ((sec === 'chorus' || sec === 'final') && S.mons.length) hype(); lastSec = sec; }
  // каждые четыре такта, когда хор поёт дружно, несколько монстров кружатся вместе
  const bar = Math.floor(BEAT / BPB);
  if (on && bar !== lastBar) { if (bar % 4 === 0 && CROWD > 0.35) for (const m of S.mons) if (Math.random() < 0.3) spinMon(m); lastBar = bar; }
  // в припеве на каждую долю кто-нибудь подпрыгивает, а весь остров чуть «толкается» в такт
  const bt = Math.floor(BEAT);
  if (on && bt !== lastBeat) { lastBeat = bt; if (SECE > 0.85) for (const m of S.mons) if (Math.random() < 0.1) jumpMon(m, rand(170, 240)); }
  const f = BEAT - Math.floor(BEAT); ZP = on ? Math.max(0, SECE - 0.7) / 0.3 * 0.006 * Math.exp(-f * 7) : 0;
  FLASH = Math.max(0, FLASH - dt * 1.6);
}
function hype() {
  FLASH = 1;
  for (let i = 0; i < 4; i++) { const [x, y] = toWorld(W * (0.15 + i * 0.23), H * 0.12); confetti(x, y, 26, 0.8); }
  for (const m of S.mons) if (Math.random() < 0.6) jumpMon(m, rand(260, 340));
}
// прожекторы над сценой, когда звучит припев (ярче вечером и ночью)
function drawStageLights() {
  const k = clamp((SECE - 0.72) / 0.28, 0, 1); if (k <= 0.01) return;
  screenT(g); g.globalCompositeOperation = 'lighter';
  const a0 = k * (0.22 + 0.2 * NIGHT);
  for (let i = 0; i < 4; i++) {
    const x0 = W * (0.12 + i * 0.25), ang = Math.sin(T * 0.8 + i * 1.7) * 0.45 + (i < 2 ? 0.2 : -0.2), len = H * 1.2, w = W * 0.11;
    const ex = x0 + Math.sin(ang) * len, ey = Math.cos(ang) * len, col = GCOL[(i + Math.floor(BEAT / BPB)) % GCOL.length], n = parseInt(col.slice(1), 16);
    const gr = g.createLinearGradient(x0, 0, ex, ey); gr.addColorStop(0, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a0})`); gr.addColorStop(1, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 6, -4); g.lineTo(x0 + 6, -4); g.lineTo(ex + w * Math.cos(ang), ey - w * Math.sin(ang)); g.lineTo(ex - w * Math.cos(ang), ey + w * Math.sin(ang)); g.closePath(); g.fill();
  }
  if (FLASH > 0) { g.fillStyle = `rgba(255,250,220,${FLASH * 0.18})`; g.fillRect(0, 0, W, H); }
  g.globalCompositeOperation = 'source-over'; worldT(g);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05); last = Math.max(last, now); T += dt;
  if (!S) return;
  quality(dt);
  // камера: плавный перелёт (вступление) и подкрутка к краю, пока тащим монстра
  if (camGoal) { const k = 1 - Math.exp(-dt * 2.5); cam.x = lerp(cam.x, camGoal.x, k); cam.y = lerp(cam.y, camGoal.y, k); cam.z = lerp(cam.z, camGoal.z, k); clampCam(); if (Math.abs(cam.z - camGoal.z) < 0.002) camGoal = null; }
  if (place && place.dragging && place.sx !== undefined) { const e = Math.max(40, W * 0.08), v = 520 / cam.z * dt; if (place.sx < e) cam.x -= v; else if (place.sx > W - e) cam.x += v; clampCam(); const [wx, wy] = toWorld(place.sx, place.sy); movePlace(wx + place.gx, wy + place.gy); }
  if (drag && drag.sx !== undefined) { const e = Math.max(40, W * 0.08), v = 520 / cam.z * dt; if (drag.sx < e) cam.x -= v; else if (drag.sx > W - e) cam.x += v; clampCam(); moveDrag(drag.sx, drag.sy); }
  for (const c of clouds) { c.x += c.v * SKS() * dt; if (c.x > W + 260) { c.x = -200; c.y = rand(0.04, 0.4); } }
  groove(dt);
  for (const m of S.mons) updateMon(m, dt);
  for (const b of S.bushes) b.n = Math.min(BERRY_CAP, b.n + dt / BERRY_SEC);
  updateParts(dt); tick(dt); hatchStep(dt); ambient(dt); dayCycle(); growOther(dt);
  for (const f of FIREFLIES) { f.x += (f.vx + Math.sin(T + f.ph) * 10) * dt; f.y += (f.vy + Math.cos(T * 1.3 + f.ph) * 8) * dt; if (f.x < 220 || f.x > 2180) f.vx *= -1; if (f.y < 360 || f.y > 790) f.vy *= -1; }
  // небо и море — в координатах экрана
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bgLayer, 0, 0);
  screenT(g);
  drawSun(); drawRays();
  for (const c of clouds) drawCloud(c);
  if (NIGHT < 0.9) drawBirds(); drawFar(); drawSea(); drawGlints();
  // остров и всё на нём — в координатах мира
  worldT(g);
  drawIslets();
  g.drawImage(islC, BX.x, BX.y, BX.w, BX.h);
  drawCloudShadows(); drawPond(); drawWaterfall(2250); drawWaterfall(160); drawGarland(); drawRings(dt);
  if (sel) { const m = S.mons.find(q => q.id === sel); if (m) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.ellipse(m.x, m.y, 50 + Math.sin(T * 5) * 3, 15, 0, 0, Math.PI * 2); g.stroke(); } }
  const ents = [{ y: ARCH.y, d: drawArch }, { y: NEST.y, d: drawNest }];
  S.bushes.forEach((b, i) => ents.push({ y: BUSH_POS[i][1], d: () => drawBush(i) }));
  for (const t of TREES) ents.push({ y: t[1], d: () => drawTree(t) });
  // за краем экрана монстров не рисуем
  const vl = viewL() - 90, vr = viewR() + 90, vt = cam.y - H / 2 / cam.z - 20, vb = cam.y + H / 2 / cam.z + 220;
  const vis = S.mons.filter(m => (m.x > vl && m.x < vr && m.y > vt && m.y < vb) || (drag && drag.m === m));
  for (const m of vis) ents.push({ y: m.y + ((drag && drag.m === m) || (place && place.m === m) ? 1000 : 0), d: () => drawMon(m) });
  if (place && place.mode !== 'move') ents.push({ y: place.m.y + 1000, d: drawPlace });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
  if (NIGHT < 0.7) drawFlies();
  drawNightSky(); drawNightGlow(); drawStageLights();
  for (const m of vis) monBubble(m);
  drawParts();
  drawVignette();
}

// ---------- игровые таймеры и подсказки
let saveT = 0, uiT = 0;
function tick(dt) {
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  uiT += dt; if (uiT > 0.25) { uiT = 0; hud(); tips(); }
}
function addXP(n) {
  S.xp += n;
  while (S.lvl < LEVEL_XP.length && S.xp >= LEVEL_XP[S.lvl]) {
    S.lvl++; Sound.sfx('level'); const nu = ISLE_IDS.find(id => ISLES[id].need === S.lvl && id !== 'green' && !S.isles[id]);
    banner(`Уровень ${S.lvl}!`, nu ? `Можно открыть остров «${ISLES[nu].name}» — нажми на карту` : `Можно поселить ${maxMons()} монстров`);
    for (let i = 0; i < 5; i++) { const [x, y] = toWorld(W * (0.2 + i * 0.15), H * 0.35); confetti(x, y, 22); }
  }
  hud();
}
let lastCoins = -1, lastBerries = -1;
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function hud() {
  const c = Math.floor(S.coins), b0 = Math.floor(S.berries);
  if (lastCoins >= 0 && c > lastCoins) bump($('coins').parentElement); if (lastBerries >= 0 && b0 > lastBerries) bump($('berries').parentElement); lastCoins = c; lastBerries = b0;
  $('coins').textContent = c.toLocaleString('ru-RU'); $('berries').textContent = b0;
  $('lvl').textContent = S.lvl;
  const a = LEVEL_XP[S.lvl - 1], b = LEVEL_XP[S.lvl] || a + 1; $('xpbar').style.width = (S.lvl >= LEVEL_XP.length ? 100 : clamp((S.xp - a) / (b - a) * 100, 0, 100)) + '%';
  $('monN').textContent = `${S.mons.length}/${maxMons()}`;
  const ready = S.mons.reduce((s, m) => s + (m.stored >= 5 ? Math.floor(m.stored) : 0), 0);
  $('bCollect').classList.toggle('hot', ready >= 20); $('collectN').textContent = ready ? '+' + ready : '';
  $('bBreed').classList.toggle('hot', !!(S.breed && Date.now() >= S.breed.end));
  $('bMap').classList.toggle('hot', ISLE_IDS.some(id => !S.isles[id] && S.lvl >= ISLES[id].need && S.coins >= ISLES[id].price));
  $('bSound').classList.toggle('off', !S.music);
}

// ---------- действия
function collect(m, quiet) {
  const amt = Math.floor(m.stored); if (amt < 1) return 0;
  m.stored -= amt; const by = bubbleY(m);
  flyTo(m.x, by, 'coins', 'coin', Math.min(6, 1 + Math.floor(amt / 15)), () => { S.coins += amt; hud(); });
  if (!quiet) { Sound.sfx('coin'); floatText(m.x, by - 10, '+' + amt, '#ffe680'); }
  if (amt >= 40) addXP(1);
  return amt;
}
function collectAll() {
  let t = 0; for (const m of S.mons) if (m.stored >= 5) t += collect(m, true);
  for (let i = 0; i < S.bushes.length; i++) if (S.bushes[i].n >= 1) harvest(i, true);
  if (t) { Sound.sfx('coin'); toast(`Собрано ${t} монет`); } else toast('Пока нечего собирать — монеты копятся, пока монстры поют');
}
function harvest(i, quiet) {
  const b = S.bushes[i], n = Math.floor(b.n); if (n < 1) return; b.n -= n;
  const [x, y] = BUSH_POS[i]; flyTo(x, y - 30, 'berries', 'berry', Math.min(5, n), () => { S.berries += n; hud(); });
  if (!quiet) { Sound.sfx('pop'); floatText(x, y - 60, '+' + n, '#ff8a9a'); }
}
const full = () => S.mons.length >= maxMons();
// новый монстр: падает в указанное место (или в свободное рядом с центром экрана)
function addMon(kind, at) {
  const p = at || findSpot(cam.x, clamp(cam.y + 60, ISL.y - 140, ISL.y + 170)); if (!p) return null;
  const m = { id: S.nid++, kind, x: p[0], y: p[1], lvl: 1, feed: 0, stored: 0 }; S.mons.push(m);
  const fresh = !S.found[kind]; S.found[kind] = 1; if (fresh) addXP(25);
  Sound.add(m.id, KINDS[kind].part, panOf(m)); Sound.sfx('hatch');
  const r = stateOf(m); r.jy = 420; r.jv = -150; burst(m.x, m.y - 50, KINDS[kind].col, 24); confetti(m.x, m.y - 60, 26, 0.7);
  save(); hud(); return m;
}
function buy(kind) {
  const K = KINDS[kind];
  if (S.lvl < (K.need || 1)) { Sound.sfx('deny'); toast(`Откроется на ${K.need} уровне острова`); return; }
  if (S.coins < K.price) { Sound.sfx('deny'); toast('Не хватает монет — собери их у монстров'); return; }
  if (full()) { Sound.sfx('deny'); toast(`Остров полон (${S.mons.length} из ${maxMons()}): подними уровень острова или продай монстра`); return; }
  startPlace({ kind, mode: 'buy' });
}
// ---------- расстановка: монстр-призрак, его можно тащить или нажать на место; «Поставить» — здесь
let place = null;
function startPlace(o) {
  closeSheet(); sel = null; if (drag) dropDrag(true);
  let x, y;
  if (o.mode === 'move') { x = o.m.x; y = o.m.y; } else { const p = findSpot(cam.x, clamp(cam.y + 40, ISL.y - 140, ISL.y + 170)) || [cam.x, clamp(cam.y, ISL.y - 150, ISL.y + 180)]; [x, y] = p; }
  const m = o.mode === 'move' ? o.m : { id: -1, kind: o.kind, x, y, lvl: 1, feed: 0, stored: 0 };
  place = { ...o, m, ox: x, oy: y, ok: canPlace(x, y, m.id), dragging: false };
  if (o.mode === 'move') stateOf(m).lift = 1;
  document.body.classList.add('placing'); $('placeName').textContent = KINDS[m.kind].name;
  hint('Нажми на свободное место или перетащи монстра — и «Поставить»');
  Sound.sfx('pop'); placeCheck();
}
function placeCheck() { $('bPlaceOk').classList.toggle('off', !place.ok); }
function movePlace(wx, wy) { place.m.x = wx; place.m.y = wy; place.ok = canPlace(wx, wy, place.m.id); placeCheck(); }
function endPlace() { place = null; document.body.classList.remove('placing'); hint(''); }
function placeOk() {
  const P = place; if (!P) return;
  if (!P.ok) { Sound.sfx('deny'); toast('Сюда нельзя: занято или край острова. Выбери другое место'); return; }
  if (P.mode === 'move') { endPlace(); const r = stateOf(P.m); r.lift = 0; r.jy = 26; r.jv = 0; r.turn = 0.001; Sound.setPan(P.m.id, panOf(P.m)); Sound.sfx('pop'); save(); return; }
  const K = KINDS[P.kind];
  if (full()) { Sound.sfx('deny'); toast(`Остров полон (${S.mons.length} из ${maxMons()})`); return; }
  if (P.mode === 'buy' && S.coins < K.price) { Sound.sfx('deny'); endPlace(); toast('Не хватает монет — собери их у монстров'); return; }
  endPlace();
  if (P.mode === 'buy') { S.coins -= K.price; addXP(8); }
  if (P.mode === 'nest') { const i = S.nest.indexOf(P.kind); if (i >= 0) S.nest.splice(i, 1); }
  const m = addMon(P.kind, [P.m.x, P.m.y]); stateOf(m).turn = 0.001;
  hud(); save(); toast(`${K.name} поёт в хоре!`);
}
function placeCancel() {
  const P = place; if (!P) return; endPlace();
  if (P.mode === 'move') { P.m.x = P.ox; P.m.y = P.oy; stateOf(P.m).lift = 0; }
  else if (P.mode === 'nest') toast('Малыш ждёт в гнезде');
}
function drawPlace() {
  const m = place.m; if (place.mode === 'move') return;
  const r = stateOf(m), sz = monSize(m), ok = place.ok;
  g.strokeStyle = ok ? 'rgba(120,255,140,.95)' : 'rgba(255,90,90,.95)'; g.fillStyle = ok ? 'rgba(120,255,140,.22)' : 'rgba(255,90,90,.22)'; g.lineWidth = 4;
  g.setLineDash([10, 8]); g.lineDashOffset = -T * 30; g.beginPath(); g.ellipse(m.x, m.y, 54, 17, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.setLineDash([]);
  g.globalAlpha = 0.9;
  drawMonster(g, m.kind, m.x, m.y, sz, { t: T, sing: 0.25 + 0.25 * Math.sin(T * 3), blink: r.blink, look: Math.sin(T * 0.8) * 0.6, lookY: 0, phase: 0, sq: 0, jump: 22 + Math.sin(T * 4) * 6, bob: 0, tilt: Math.sin(T * 2.2) * 0.06, beat: BEAT, bpb: BPB, dance: 0, hit: 0, turn: 0 });
  g.globalAlpha = 1;
}
function feed(m) {
  if (m.lvl >= MAX_LVL) { toast('Монстр уже самый большой'); return; }
  const c = feedCost(m); if (S.berries < c) { Sound.sfx('deny'); toast('Не хватает ягод — собери их с кустов'); return; }
  S.berries -= c; m.feed++; Sound.sfx('eat'); addXP(2);
  const sz = monSize(m); for (let i = 0; i < 5; i++) parts.push({ kind: 'heart', x: m.x + rand(-25, 25), y: m.y - sz * 0.6, vx: rand(-20, 20), vy: rand(-60, -30), life: 1, t: 0 });
  stateOf(m).sv -= 1.2;
  if (m.feed >= FEEDS) { m.feed = 0; m.lvl++; Sound.sfx('level'); burst(m.x, m.y - sz * 0.5, '#ffe680', 30); floatText(m.x, m.y - sz * 1.2, `Уровень ${m.lvl}!`, '#ffe680'); addXP(5); }
  save(); showInfo(m);
}
function sell(m) {
  confirmBox(`Продать ${KINDS[m.kind].name} за ${sellPrice(m.kind)} монет? Его партия исчезнет из песни.`, () => {
    collect(m, true); S.coins += sellPrice(m.kind); S.mons = S.mons.filter(q => q !== m); Sound.remove(m.id); rt.delete(m.id);
    sel = null; closeSheet(); save(); hud(); Sound.sfx('coin');
  });
}
function toggleMute(m) { m.mute = !m.mute; Sound.mute(m.id, !!m.mute); save(); showInfo(m); }

// ---------- скрещивание: от каждого родителя по стихии; разные — элитный этой пары, одинаковые — обычный этой стихии
const pairKind = (ea, eb) => isle().pair[[ea, eb].sort().join('+')];
const baseOf = e => isle().byEl[e] || [];
function breedOutcomes(a, b) {
  const out = new Set();
  for (const ea of KINDS[a].el) for (const eb of KINDS[b].el) { if (ea === eb) baseOf(ea).forEach(k => out.add(k)); else { const p = pairKind(ea, eb); if (p) out.add(p); else [...baseOf(ea), ...baseOf(eb)].forEach(k => out.add(k)); } }
  if (!out.size) out.add(a);
  return [...out];
}
function breedResult(a, b) {
  if (a !== b && Math.random() < 0.15) return Math.random() < 0.5 ? a : b; // бывает, что вылупляется копия родителя
  const ea = pick(KINDS[a].el), eb = pick(KINDS[b].el);
  const out = ea === eb ? baseOf(ea) : pairKind(ea, eb) ? [pairKind(ea, eb)] : [...baseOf(ea), ...baseOf(eb)];
  return out.length ? pick(out) : a;
}
function startBreed(a, b) {
  const A = S.mons.find(m => m.id === a), B = S.mons.find(m => m.id === b); if (!A || !B) return;
  const kind = breedResult(A.kind, B.kind), dur = BREED_SEC(kind);
  S.breed = { a, b, kind, end: Date.now() + dur * 1000, dur };
  closeSheet(); save(); Sound.sfx('pop'); toast(`${KINDS[A.kind].name} и ${KINDS[B.kind].name} поют дуэтом у Арки…`);
  addXP(4);
}
let hatching = null;
function hatch() {
  const b = S.breed; if (!b || Date.now() < b.end || hatching) return;
  hatching = { t: 0, cracks: 0 }; closeSheet(); Sound.sfx('tap');
  camGoal = { x: ARCH.x - W * 0.15 / cam.z, y: cam.y, z: cam.z };
}
function hatchStep(dt) {
  if (!hatching) return; hatching.t += dt;
  const c = Math.floor(hatching.t / 0.32); if (c > hatching.cracks && c <= 3) { hatching.cracks = c; Sound.sfx('tap'); }
  if (hatching.t > 1.25) { hatching = null; finishHatch(); }
}
function finishHatch() {
  const b = S.breed; if (!b) return; S.breed = null;
  confetti(ARCH.x, ARCH.y - 50, 60); burst(ARCH.x, ARCH.y - 40, '#fff8c0', 20);
  const fresh = !S.found[b.kind]; S.found[b.kind] = 1; if (fresh) addXP(KINDS[b.kind].el.length > 1 ? 40 : 25);
  Sound.sfx('hatch'); burst(ARCH.x, ARCH.y - 40, KINDS[b.kind].col, 30);
  S.nest.push(b.kind); // пока не поставили — ждёт в гнезде (не пропадёт, если закрыть игру)
  showNew(b.kind, fresh);
  save();
}

// ---------- ввод: нажатие, перетаскивание монстра (зажать), сдвиг острова, приближение двумя пальцами
const ptrs = new Map(); let gest = null, drag = null;
function cancelHold() { if (gest && gest.hold) { clearTimeout(gest.hold); gest.hold = 0; } }
function startDrag(m) {
  if (!gest) return;
  gest.type = 'drag'; drag = { m, ox: m.x, oy: m.y, ok: true, sx: gest.lx, sy: gest.ly };
  stateOf(m).lift = 1; closeSheet(); sel = null; Sound.sfx('pop');
  hint('Перетащи и отпусти, где хочешь');
  try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
}
function moveDrag(sx, sy) {
  drag.sx = sx; drag.sy = sy; const [wx, wy] = toWorld(sx, sy);
  drag.m.x = wx; drag.m.y = wy; drag.ok = canPlace(wx, wy, drag.m.id);
}
function dropDrag(cancel) {
  const { m, ox, oy, ok } = drag; drag = null; hint(''); const r = stateOf(m); r.lift = 0;
  if (cancel || !ok) {
    m.x = ox; m.y = oy; r.jy = 30; r.jv = 0;
    if (!cancel) { Sound.sfx('deny'); toast('Сюда нельзя: занято или край острова'); }
  } else { r.jy = 26; r.jv = 0; r.turn = 0.001; Sound.setPan(m.id, panOf(m)); Sound.sfx('pop'); save(); }
}
cv.addEventListener('pointerdown', e => {
  if (!started) return;
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); camGoal = null;
  if (ptrs.size === 2) {
    cancelHold(); if (drag) dropDrag(true);
    const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    gest = { type: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: cam.z, w0: toWorld(mx, my) };
    return;
  }
  if (ptrs.size > 2) return;
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  if (place) {
    const pm = place.m, sz = monSize(pm);
    if (Math.abs(wx - pm.x) < sz * 0.55 && wy > pm.y - sz * 1.25 && wy < pm.y + 24) { gest = { type: 'pdrag', id: e.pointerId }; place.dragging = true; place.gx = pm.x - wx; place.gy = pm.y - wy; place.sx = e.clientX; place.sy = e.clientY; return; }
    gest = { type: 'tap', id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, cx: cam.x, cy: cam.y, mon: null };
    return;
  }
  const m = hitMon(wx, wy);
  gest = { type: 'tap', id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, cx: cam.x, cy: cam.y, mon: m };
  if (m) gest.hold = setTimeout(() => { if (gest && gest.type === 'tap' && gest.mon === m) startDrag(m); }, 300);
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
  if (!gest) return;
  if (gest.type === 'pinch') {
    if (ptrs.size < 2) return; const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    cam.z = clamp(gest.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gest.d0, zMin(), zMax());
    cam.x = gest.w0[0] - (mx - W / 2) / cam.z; cam.y = gest.w0[1] - (my - H / 2) / cam.z; clampCam(); return;
  }
  if (e.pointerId !== gest.id) return;
  gest.lx = e.clientX; gest.ly = e.clientY;
  if (gest.type === 'drag') { moveDrag(e.clientX, e.clientY); return; }
  if (gest.type === 'pdrag') { place.sx = e.clientX; place.sy = e.clientY; const [wx, wy] = toWorld(e.clientX, e.clientY); movePlace(wx + place.gx, wy + place.gy); return; }
  if (gest.type === 'tap' && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 10) { cancelHold(); gest.type = 'pan'; }
  if (gest.type === 'pan') { cam.x = gest.cx - (e.clientX - gest.sx) / cam.z; cam.y = gest.cy - (e.clientY - gest.sy) / cam.z; clampCam(); }
});
function pointerUp(e) {
  if (!ptrs.delete(e.pointerId) || !gest) return;
  if (gest.type === 'pinch') { if (!ptrs.size) gest = null; return; }
  if (e.pointerId !== gest.id) return;
  cancelHold();
  if (gest.type === 'tap' && place) { const [wx, wy] = toWorld(e.clientX, e.clientY); movePlace(wx, wy + 20); Sound.sfx('tap'); }
  else if (gest.type === 'tap') onTap(e.clientX, e.clientY);
  else if (gest.type === 'drag') dropDrag(e.type === 'pointercancel');
  else if (gest.type === 'pdrag' && place) place.dragging = false;
  gest = null;
}
cv.addEventListener('pointerup', pointerUp); cv.addEventListener('pointercancel', pointerUp);
cv.addEventListener('wheel', e => { if (!started) return; e.preventDefault(); camGoal = null; zoomAt(e.clientX, e.clientY, cam.z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
function onTap(sx, sy) {
  const [x, y] = toWorld(sx, sy), rr = Math.max(40, 26 / cam.z);
  Sound.sfx('tap');
  for (const m of S.mons) { if (hasBubble(m) && Math.hypot(x - m.x, y - bubbleY(m)) < rr) { collect(m); return; } }
  if (hatching) return;
  if (Math.abs(x - ARCH.x) < 75 && y > ARCH.y - 170 && y < ARCH.y + 15) { if (S.breed && Date.now() >= S.breed.end) hatch(); else openBreed(); return; }
  if (Math.abs(x - NEST.x) < 62 && y > NEST.y - 80 && y < NEST.y + 15) { openNest(); return; }
  for (let i = 0; i < S.bushes.length; i++) { const [bx, by] = BUSH_POS[i]; if (Math.abs(x - bx) < 50 && y > by - 90 && y < by + 10) { if (S.bushes[i].n >= 1) harvest(i); else toast('Ягоды ещё растут'); return; } }
  const hit = hitMon(x, y);
  lookAt = { x, y, until: T + 1.6 };
  if (hit) { sel = hit.id; jumpMon(hit, 300); spinMon(hit); Sound.sfx('pop'); for (let i = 0; i < 3; i++) parts.push({ kind: 'heart', x: hit.x + rand(-20, 20), y: hit.y - monSize(hit) * 0.9, vx: rand(-25, 25), vy: rand(-70, -40), life: 1, t: 0 }); showInfo(hit); return; }
  sel = null; closeSheet();
}

// ---------- окна (HTML)
const sheet = $('sheet');
let sheetKind = null;
// малыш из Арки, которого не поставили на остров, уходит в гнездо
function dropNew() { if (sheetKind === 'new') sheet.dataset.kind = ''; } // малыш уже в гнезде (кладётся туда при вылуплении)
function openSheet(kind, html, cls = '') {
  if (place) placeCancel();
  dropNew(); $('toast').classList.remove('show'); sheetKind = kind; sheet.className = 'sheet show ' + cls; sheet.innerHTML = `<button class="x" data-a="close">✕</button>${html}`;
}
function closeSheet() { dropNew(); sheet.className = 'sheet'; sheetKind = null; }
const PORTRAIT = {};
function portrait(kind, dark) {
  const key = kind + (dark ? 'd' : ''); if (PORTRAIT[key]) return PORTRAIT[key];
  const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d');
  drawMonster(x, kind, 80, 146, 120, { t: 1, sing: 0.35, blink: 0, look: 0.3, phase: 0 });
  if (dark) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#2a3a5a'; x.fillRect(0, 0, 160, 160); }
  return (PORTRAIT[key] = c.toDataURL());
}
const ICON = {};
function iconURL(kind) {
  if (ICON[kind]) return ICON[kind];
  const c = document.createElement('canvas'); c.width = c.height = 120; const x = c.getContext('2d');
  const berry = (bx, by, r) => { x.fillStyle = '#e8304a'; x.strokeStyle = '#7a1020'; x.lineWidth = 2.5; x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(bx - r * 0.35, by - r * 0.35, r * 0.28, 0, Math.PI * 2); x.fill(); };
  if (kind === 'basket' || kind === 'box') {
    const big = kind === 'box';
    [[42, 52], [60, 44], [78, 52], [52, 60], [70, 60], ...(big ? [[34, 44], [86, 44], [60, 36]] : [])].forEach(([bx, by]) => berry(bx, by, 11));
    x.fillStyle = big ? '#c8884a' : '#e0a860'; x.strokeStyle = '#6a3e18'; x.lineWidth = 3.5;
    x.beginPath(); x.moveTo(22, 62); x.lineTo(98, 62); x.lineTo(88, 102); x.lineTo(32, 102); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = 'rgba(106,62,24,.45)'; x.lineWidth = 2.5; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(26 + i * 2, 74 + i * 10); x.lineTo(94 - i * 2, 74 + i * 10); x.stroke(); }
    if (!big) { x.strokeStyle = '#6a3e18'; x.lineWidth = 4; x.beginPath(); x.arc(60, 62, 30, Math.PI, 0); x.stroke(); }
  } else {
    x.fillStyle = 'rgba(30,40,20,.25)'; x.beginPath(); x.ellipse(60, 104, 42, 8, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#3f9a2a'; x.strokeStyle = '#1f5a14'; x.lineWidth = 3.5; x.beginPath(); for (const [dx, dy, r] of [[38, 76, 24], [82, 76, 24], [60, 56, 28], [60, 84, 26]]) { x.moveTo(dx + r, dy); x.arc(dx, dy, r, 0, Math.PI * 2); } x.stroke(); x.fill();
    [[40, 70], [72, 54], [84, 80], [56, 86], [62, 64]].forEach(([bx, by]) => berry(bx, by, 6.5));
  }
  return (ICON[kind] = c.toDataURL());
}
const elBadge = e => `<i class="el" style="background:${ELEMENTS[e].col}" title="${ELEMENTS[e].name}">${ELEMENTS[e].icon}</i>`;
const elBadges = k => KINDS[k].el.map(elBadge).join('');
function showInfo(m) {
  const K = KINDS[m.kind], c = feedCost(m), pips = Array.from({ length: FEEDS }, (_, i) => `<i class="${i < m.feed ? 'on' : ''}"></i>`).join('');
  openSheet('info', `
    <div class="info">
      <img class="port" src="${portrait(m.kind)}" alt="">
      <div class="col">
        <div class="ttl">${K.name} <small>ур. ${m.lvl}</small></div>
        <div class="els">${elBadges(m.kind)} <span class="dim">${RARITY(K.el.length)}</span></div>
        <div class="dsc">${K.desc}</div>
        <div class="stats"><span class="ic coin"></span> ${Math.round(rateOf(m))} в минуту · копилка ${Math.floor(m.stored)}/${capOf(m)}</div>
        ${m.lvl < MAX_LVL ? `<div class="feedrow">Сытость <span class="pips">${pips}</span></div>` : '<div class="feedrow">Максимальный уровень</div>'}
      </div>
    </div>
    <div class="acts">
      ${m.lvl < MAX_LVL ? `<button class="btn green" data-a="feed">Покормить · ${c} <span class="ic berry"></span></button>` : ''}
      <button class="btn" data-a="mute">${m.mute ? 'Петь снова' : 'Тише'}</button>
      <button class="btn" data-a="move">Переставить</button>
      <button class="btn red" data-a="sell">Продать · ${sellPrice(m.kind)}</button>
    </div>`, 'low');
  sheet.dataset.id = m.id;
}
function openShop() {
  sel = null;
  const mons = isle().base.map(k => { const K = KINDS[k], lock = S.lvl < (K.need || 1);
    return `<button class="card${lock ? ' lock' : ''}" data-a="buy" data-k="${k}"><img src="${portrait(k)}" alt=""><b>${K.name}</b><span class="els">${elBadges(k)}</span><span class="dim">${lock ? `с ${K.need} уровня` : `+${K.rate} <span class="ic coin sm"></span>/мин`}</span><em><span class="ic coin sm"></span> ${K.price}</em><span class="play" data-a="listen" data-k="${k}">▶</span></button>`; }).join('');
  const nb = S.bushes.length < BUSH_POS.length;
  openSheet('shop', `<h2>Магазин · ${isle().name} <small>монстров здесь ${S.mons.length} из ${maxMons()}</small></h2>
    <div class="sec">Обычные монстры <span class="dim">— каждый играет свою партию и подпевает. Элитных выводят на Арке скрещивания</span></div><div class="cards">${mons}</div>
    <div class="sec">Еда</div><div class="cards">
      <button class="card wide" data-a="berries" data-n="30" data-p="60"><img src="${iconURL('basket')}" alt=""><b>Корзинка ягод</b><span class="dim">30 ягод</span><em><span class="ic coin sm"></span> 60</em></button>
      <button class="card wide" data-a="berries" data-n="100" data-p="180"><img src="${iconURL('box')}" alt=""><b>Ящик ягод</b><span class="dim">100 ягод</span><em><span class="ic coin sm"></span> 180</em></button>
      <button class="card wide${nb ? '' : ' lock'}" data-a="bush"><img src="${iconURL('bush')}" alt=""><b>Ягодный куст</b><span class="dim">${nb ? 'растит ягоды сам' : 'все места заняты'}</span><em><span class="ic coin sm"></span> ${BUSH_PRICE}</em></button>
    </div>`);
}
function openBreed() {
  sel = null;
  if (S.breed) { const left = (S.breed.end - Date.now()) / 1000; toast(left > 0 ? `Арка занята: ещё ${fmtTime(left)}` : 'Яйцо готово — нажми на Арку'); return; }
  if (S.mons.length < 2) { toast('Нужно хотя бы два монстра на острове'); return; }
  const list = S.mons.map(m => `<button class="card pick" data-a="pick" data-id="${m.id}"><img src="${portrait(m.kind)}" alt=""><b>${KINDS[m.kind].name}</b><span class="els">${elBadges(m.kind)}</span></button>`).join('');
  openSheet('breed', `<h2>Арка скрещивания</h2><div class="dim center">Выбери двух монстров. От каждого берётся по стихии: подходящая пара разных стихий даёт элитного певца этого острова, одинаковые — обычного монстра. Иногда рождается копия родителя.</div>
    <div class="cards">${list}</div><div class="breedbar"><span id="bres">Выбрано: 0 из 2</span><button class="btn green" data-a="breed" id="bgo" disabled>Скрестить</button></div>`);
  sheet.dataset.pick = '';
}
function updateBreedPick() {
  const ids = sheet.dataset.pick ? sheet.dataset.pick.split(',').map(Number) : [];
  for (const b of sheet.querySelectorAll('[data-a="pick"]')) b.classList.toggle('on', ids.includes(+b.dataset.id));
  const go = $('bgo'), res = $('bres');
  if (ids.length === 2) {
    const [A, B] = ids.map(id => S.mons.find(m => m.id === id)), outs = breedOutcomes(A.kind, B.kind);
    const names = outs.map(k => S.found[k] ? KINDS[k].name : `??? ${elBadges(k)}`).join(', '), longest = Math.max(...outs.map(BREED_SEC));
    res.innerHTML = `Может родиться: ${names} · до ${fmtTime(longest)}`;
    go.disabled = false;
  } else { res.textContent = `Выбрано: ${ids.length} из 2`; go.disabled = true; }
}
function openNest() {
  sel = null;
  if (!S.nest.length) { toast('Гнездо пустое. Сюда попадают малыши, если на острове нет места'); return; }
  const list = S.nest.map((k, i) => `<button class="card" data-a="nestplace" data-i="${i}"><img src="${portrait(k)}" alt=""><b>${KINDS[k].name}</b><span class="els">${elBadges(k)}</span><em>Поставить</em></button>`).join('');
  openSheet('nest', `<h2>Гнездо</h2><div class="dim center">Малыши ждут свободного места на острове (сейчас ${S.mons.length} из ${maxMons()})</div><div class="cards">${list}</div>`);
}
function openBook() {
  sel = null; const n = ALL_KINDS.filter(k => S.found[k]).length;
  const card = k => { const K = KINDS[k], f = S.found[k];
    return `<button class="card${f ? '' : ' unknown'}" data-a="${f ? 'listen' : ''}" data-k="${k}"><img src="${portrait(k, !f)}" alt=""><b>${f ? K.name : '???'}</b><span class="els">${elBadges(k)}</span><span class="dim">${f ? RARITY(K.el.length) : K.el.map(e => ELEMENTS[e].name).join(' + ')}</span>${f ? '<span class="play">▶</span>' : ''}</button>`; };
  const order = [S.isl, ...ISLE_IDS.filter(id => id !== S.isl)];
  openSheet('book', `<h2>Книга монстров <small>${n} из ${ALL_KINDS.length}</small></h2><div class="dim center">Нажми на открытого монстра, чтобы послушать его партию. Элитных певцов выводят на Арке скрещивания на их острове.</div>
    ${order.map(id => `<div class="sec">${ISLES[id].name} <span class="dim">— ${ISLES[id].about}</span></div><div class="cards">${ISLES[id].kinds.map(card).join('')}</div>`).join('')}`);
}
function showNew(kind, fresh) {
  const K = KINDS[kind], room = !full();
  openSheet('new', `<div class="newmon"><div class="rays"></div><img class="port big" src="${portrait(kind)}" alt="">
    <h2>${fresh ? 'Новый вид! ' : ''}${K.name}</h2><div class="els">${elBadges(kind)} <span class="dim">${RARITY(K.el.length)}</span></div><div class="dsc">${K.desc}</div>
    <div class="acts">${room ? '<button class="btn green" data-a="newplace">Поставить на остров</button>' : ''}<button class="btn" data-a="newnest">${room ? 'В гнездо' : 'В гнездо (остров полон)'}</button></div></div>`, 'center');
  sheet.dataset.kind = kind;
  Sound.preview(K.part);
}
// острова: перелёт, открытие нового
const THUMB = {};
function isleThumb(id) {
  if (THUMB[id]) return THUMB[id];
  const Q = THEMES[id], c = document.createElement('canvas'); c.width = 220; c.height = 140; const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 92); sky.addColorStop(0, Q.sky[0]); sky.addColorStop(1, Q.sky[2]); x.fillStyle = sky; x.fillRect(0, 0, 220, 92);
  const sea = x.createLinearGradient(0, 92, 0, 140); sea.addColorStop(0, Q.sea[0]); sea.addColorStop(1, Q.sea[2]); x.fillStyle = sea; x.fillRect(0, 92, 220, 48);
  x.fillStyle = Q.cliff[1]; x.strokeStyle = Q.cliffLine; x.lineWidth = 3; x.beginPath(); x.moveTo(28, 98); x.quadraticCurveTo(70, 134, 110, 138); x.quadraticCurveTo(150, 134, 192, 98); x.closePath(); x.fill(); x.stroke();
  const gr = x.createLinearGradient(0, 80, 0, 112); gr.addColorStop(0, Q.grass[0]); gr.addColorStop(1, Q.grass[2]); x.fillStyle = gr; x.strokeStyle = Q.grassLine; x.beginPath(); x.ellipse(110, 96, 86, 17, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  const I = ISLES[id], a = I.gift || I.base[0], b = I.elite[0];
  if (a && KINDS[a]) drawMonster(x, a, 78, 102, 62, { t: 1, sing: 0.4, blink: 0, look: 0.3, phase: 0 });
  if (b && KINDS[b]) drawMonster(x, b, 142, 102, 68, { t: 1, sing: 0.6, blink: 0, look: -0.3, phase: 0 });
  return (THUMB[id] = c.toDataURL());
}
function openIsles() {
  sel = null;
  const cards = ISLE_IDS.map(id => {
    const I = ISLES[id], own = S.isles[id], here = id === S.isl, lockLvl = S.lvl < I.need;
    const bank = own && !here ? Math.floor(own.mons.reduce((s, m) => s + m.stored, 0)) : 0;
    const st = here ? '<em class="here">Ты здесь</em>' : own ? '<em>Перелететь</em>' : lockLvl ? `<em class="gray">с ${I.need} уровня</em>` : `<em><span class="ic coin sm"></span> ${I.price}</em>`;
    const info = own ? `монстров: ${own.mons.length}${bank >= 5 ? ` · копилка ${bank}` : ''}` : `${I.kinds.length} новых монстров`;
    return `<button class="card isle${here ? ' on' : ''}${!own && lockLvl ? ' lock' : ''}" data-a="isle" data-k="${id}"><img src="${isleThumb(id)}" alt=""><b>${I.name}</b><span class="dim">${I.about}</span><span class="dim">${info}</span>${st}</button>`;
  }).join('');
  openSheet('isles', `<h2>Острова <small>у каждого свои монстры и своя песня</small></h2><div class="cards isles">${cards}</div>`);
}
function applyTheme() { TH = THEMES[S.isl]; vig = null; raysG = null; buildBg(); buildIsland(); }
function travel(id) {
  if (id === S.isl || !S.isles[id] || hatching || drag) return;
  save(); for (const m of S.mons) Sound.remove(m.id);
  rt.clear(); sel = null; parts.length = 0; rings.length = 0; lookAt = null;
  S.isl = id; applyTheme(); Sound.setSong(id);
  for (const m of S.mons) { Sound.add(m.id, KINDS[m.kind].part, panOf(m)); if (m.mute) Sound.mute(m.id, true); }
  cam.z = zMin(); cam.x = ISL.x; cam.y = 520; clampCam(); camGoal = { x: ISL.x, y: 520, z: zDef() };
  banner(ISLES[id].name, Sound.SONGS[id] ? `«${Sound.SONGS[id].name}»` : ''); Sound.sfx('level');
  hud(); save();
}
function unlockIsle(id) {
  const I = ISLES[id]; if (S.isles[id] || S.lvl < I.need || S.coins < I.price) return;
  S.coins -= I.price; S.isles[id] = newIsle(); addXP(20); travel(id);
  if (I.gift && KINDS[I.gift]) setTimeout(() => { if (S.isl === id && addMon(I.gift)) toast(`${KINDS[I.gift].name} встречает тебя на новом острове!`); }, 1400);
}
let confirmCb = null;
function confirmBox(text, cb) { confirmCb = cb; openSheet('confirm', `<div class="dsc center big">${text}</div><div class="acts"><button class="btn red" data-a="yes">Да</button><button class="btn" data-a="close">Нет</button></div>`, 'center small'); }

sheet.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; e.stopPropagation();
  const a = b.dataset.a; Sound.sfx('tap');
  const m = sheetKind === 'info' ? S.mons.find(q => q.id === +sheet.dataset.id) : null;
  if (a === 'close') { closeSheet(); sel = null; }
  else if (a === 'feed' && m) feed(m);
  else if (a === 'mute' && m) toggleMute(m);
  else if (a === 'move' && m) startPlace({ mode: 'move', m });
  else if (a === 'sell' && m) sell(m);
  else if (a === 'listen') { e.preventDefault(); Sound.preview(KINDS[b.dataset.k].part); }
  else if (a === 'buy') { if (e.target.closest('.play')) { Sound.preview(KINDS[b.dataset.k].part); return; } buy(b.dataset.k); }
  else if (a === 'berries') { const n = +b.dataset.n, p = +b.dataset.p; if (S.coins < p) { Sound.sfx('deny'); toast('Не хватает монет'); return; } S.coins -= p; S.berries += n; Sound.sfx('coin'); hud(); save(); toast(`+${n} ягод`); }
  else if (a === 'bush') { if (S.bushes.length >= BUSH_POS.length) return; if (S.coins < BUSH_PRICE) { Sound.sfx('deny'); toast('Не хватает монет'); return; } S.coins -= BUSH_PRICE; S.bushes.push({ n: 0 }); addXP(6); closeSheet(); save(); toast('Новый ягодный куст посажен!'); }
  else if (a === 'pick') {
    let ids = sheet.dataset.pick ? sheet.dataset.pick.split(',').map(Number) : []; const id = +b.dataset.id;
    ids = ids.includes(id) ? ids.filter(q => q !== id) : ids.concat(id).slice(-2); sheet.dataset.pick = ids.join(','); updateBreedPick();
  }
  else if (a === 'breed') { const ids = sheet.dataset.pick.split(',').map(Number); if (ids.length === 2) startBreed(ids[0], ids[1]); }
  else if (a === 'nestplace') {
    if (full()) { Sound.sfx('deny'); toast(`Остров полон (${S.mons.length} из ${maxMons()})`); return; }
    const k = S.nest[+b.dataset.i]; startPlace({ kind: k, mode: 'nest' });
  }
  else if (a === 'newplace') { const k = sheet.dataset.kind; sheet.dataset.kind = ''; if (full()) { Sound.sfx('deny'); toast(`Остров полон (${S.mons.length} из ${maxMons()}) — малыш ждёт в гнезде`); closeSheet(); return; } startPlace({ kind: k, mode: 'nest' }); }
  else if (a === 'newnest') { closeSheet(); toast('Малыш ждёт в гнезде'); }
  else if (a === 'yes') { const cb = confirmCb; confirmCb = null; closeSheet(); if (cb) cb(); }
  else if (a === 'isle') {
    const id = b.dataset.k, I = ISLES[id];
    if (id === S.isl) { closeSheet(); return; }
    if (S.isles[id]) { closeSheet(); travel(id); return; }
    if (S.lvl < I.need) { Sound.sfx('deny'); toast(`Остров «${I.name}» откроется на ${I.need} уровне`); return; }
    if (S.coins < I.price) { Sound.sfx('deny'); toast(`Нужно ${I.price} монет, чтобы открыть остров`); return; }
    confirmBox(`Открыть остров «${I.name}» за ${I.price} монет? Там свои монстры и своя песня.`, () => unlockIsle(id));
  }
});

function hint(t) { $('hintbar').textContent = t; $('hintbar').classList.toggle('show', !!t); }
function banner(t, sub) { const el = $('banner'); el.innerHTML = `${t}<small>${sub || ''}</small>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
let toastT = 0;
function toast(t) { if (!t) return; const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }

// ---------- подсказки новичку
const TIPS = [
  { id: 'coins', when: () => S.mons.some(m => m.stored >= 5), text: 'Монстры поют и копят монеты. Нажми на пузырь с монеткой над монстром!' },
  { id: 'move', when: () => T > 25, text: 'Остров большой: двигай его пальцем, приближай двумя. Зажми монстра — и перетащи, куда хочешь.' },
  { id: 'shop', when: () => S.coins >= 150 && S.mons.length < 4, text: 'Купи ещё монстра в Магазине — у каждого своя партия, и песня станет богаче.' },
  { id: 'feed', when: () => S.berries >= 7 && S.mons.length >= 3 && S.mons.every(m => m.lvl === 1 && !m.feed), text: 'Нажми на монстра и покорми его ягодами — он подрастёт и будет приносить больше монет.' },
  { id: 'breed', when: () => new Set(S.mons.flatMap(m => KINDS[m.kind].el)).size >= 2 && S.mons.length >= 3 && !S.breed && !isle().elite.some(k => S.found[k]), text: 'Скрести на Арке двух монстров разных стихий — родится элитный певец!' },
  { id: 'isles', when: () => S.lvl >= 3 && Object.keys(S.isles).length < 2, text: 'Можно открыть новый остров со своими монстрами и своей песней! Нажми на карту вверху справа.' },
];
let tipT = 0;
function tips() {
  if (tipT && Date.now() > tipT) { $('tip').classList.remove('show'); tipT = 0; }
  if (!started || drag || sheetKind || $('tip').classList.contains('show')) return;
  const t = TIPS.find(t => !S.tips[t.id] && t.when()); if (!t) return;
  S.tips[t.id] = 1; $('tipText').textContent = t.text; $('tip').classList.add('show'); tipT = Date.now() + 12000;
}
$('tip').addEventListener('click', () => $('tip').classList.remove('show'));

// ---------- кнопки интерфейса
$('bShop').addEventListener('click', () => { Sound.sfx('tap'); sheetKind === 'shop' ? closeSheet() : openShop(); });
$('bBreed').addEventListener('click', () => { Sound.sfx('tap'); if (S.breed && Date.now() >= S.breed.end) { hatch(); return; } sheetKind === 'breed' ? closeSheet() : openBreed(); });
$('bBook').addEventListener('click', () => { Sound.sfx('tap'); sheetKind === 'book' ? closeSheet() : openBook(); });
$('bMap').addEventListener('click', () => { Sound.sfx('tap'); sheetKind === 'isles' ? closeSheet() : openIsles(); });
$('bCollect').addEventListener('click', () => collectAll());
$('bSound').addEventListener('click', () => { S.music = !S.music; Sound.setOn(S.music); hud(); save(); });

// ---------- запуск
let started = false;
function startGame() {
  if (started) return; started = true;
  Sound.setSong(S.isl); Sound.start(); Sound.setOn(S.music !== false);
  for (const m of S.mons) { Sound.add(m.id, KINDS[m.kind].part, panOf(m)); if (m.mute) Sound.mute(m.id, true); }
  $('start').classList.add('gone'); $('hud').classList.add('show');
  try { const d = document.documentElement; if (d.requestFullscreen && !document.fullscreenElement && /Android|Mobi/i.test(navigator.userAgent)) d.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  // вступление: весь остров, потом приближение к монстрам
  cam.z = zMin(); clampCam(); camGoal = { x: ISL.x, y: 520, z: zDef() };
  const got = offline(); if (got > 0) setTimeout(() => toast(`Пока тебя не было, монстры напели ${got} монет — собери их!`), 600);
  hud();
}
// меню: «Продолжить» с итогом прогресса или «Играть»; «Начать заново» — с подтверждением
function menu() {
  const go = hasProgress(S), n = Object.values(S.isles).reduce((a, I) => a + I.mons.length, 0), k = Object.keys(S.isles).length;
  $('bPlay').textContent = go ? '▶ Продолжить' : '▶ Играть';
  $('saveInfo').hidden = !go; $('bNew').hidden = !go;
  if (go) $('saveInfo').textContent = `Уровень ${S.lvl} · ${Math.floor(S.coins).toLocaleString('ru-RU')} монет · монстров: ${n} · ${k === 1 ? '1 остров' : k + (k < 5 ? ' острова' : ' островов')}`;
}
$('bPlay').addEventListener('click', () => startGame());
$('bPlaceOk').addEventListener('click', () => { Sound.sfx('tap'); placeOk(); });
$('bPlaceNo').addEventListener('click', () => { Sound.sfx('tap'); placeCancel(); });
$('bNew').addEventListener('click', () => { $('newAsk').hidden = false; });
$('bNewNo').addEventListener('click', () => { $('newAsk').hidden = true; });
$('bNewYes').addEventListener('click', () => {
  for (const k of [SAVE, SAVE2, SAVE1]) try { localStorage.removeItem(k); } catch (e) {}
  S = bindIsle(newState()); rt.clear(); parts.length = 0; TH = THEMES[S.isl]; applyTheme(); fixPositions();
  $('newAsk').hidden = true; menu(); save(); cloudSave(true); startGame();
});
// онлайн-версия (не установленная игра): подсказка, как поставить APK через Chrome
if (location.protocol !== 'file:') {
  $('bInstall').hidden = false;
  $('bInstall').addEventListener('click', () => { $('install').hidden = false; });
  $('bInstClose').addEventListener('click', () => { $('install').hidden = true; });
  $('bCopy').addEventListener('click', () => {
    const t = $('instLink').value, ok = () => { $('bCopy').textContent = 'Ссылка скопирована'; };
    const selText = () => { $('instLink').focus(); $('instLink').select(); try { if (document.execCommand('copy')) ok(); } catch (e) {} };
    try { navigator.clipboard.writeText(t).then(ok, selText); } catch (e) { selText(); }
  });
}
document.addEventListener('visibilitychange', () => { if (!S) return; if (document.hidden) { save(); Sound.suspend(); } else { Sound.resume(); } });
window.appPause = () => { if (S) save(); Sound.suspend(); };
window.appResume = () => Sound.resume();
// кнопка «Назад» в Android: закрыть окно или подсказку; false — свернуть игру
window.appBack = () => {
  if (place) { placeCancel(); return true; }
  if (sheetKind) { closeSheet(); sel = null; return true; }
  if ($('tip').classList.contains('show')) { $('tip').classList.remove('show'); return true; }
  return false;
};
window.addEventListener('resize', resize);

S = load();
TH = THEMES[S.isl];
fixPositions();
resize();
hud();
menu();
cloudInit();
requestAnimationFrame(frame);
