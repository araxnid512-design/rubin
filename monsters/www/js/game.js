'use strict';
// =====================================================================
//  МОНСТРОХОР: остров поющих монстриков.
//  Мир рисуется на холсте в виртуальных координатах 1280×720 (подгоняется под экран),
//  кнопки и окна — обычный HTML поверх.
// =====================================================================
const VW = 1280, VH = 720;
const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, SC = 1, OX = 0, OY = 0;
const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;

// ---------- остров: суперэллипс, места для монстров, постройки
const ISL = { x: 640, y: 470, rx: 565, ry: 150 };
const islandEdge = x => { const k = Math.abs(x - ISL.x) / ISL.rx; return k >= 1 ? ISL.y : ISL.y + ISL.ry * Math.pow(1 - Math.pow(k, 4), 0.25); };
const SLOTS = [
  [340, 398], [480, 398], [620, 398], [760, 398], [900, 398],
  [270, 478], [410, 478], [550, 478], [690, 478], [830, 478], [970, 478],
  [470, 566], [640, 566], [810, 566],
];
const SLOT_ORDER = [7, 8, 12, 2, 6, 9, 1, 3, 11, 13, 5, 10, 0, 4];
const ROW_SCALE = y => (y < 420 ? 0.92 : y > 540 ? 1.06 : 1);
const ARCH = { x: 1098, y: 452 }, NEST = { x: 172, y: 458 };
const BUSH_POS = [[232, 584], [1056, 586], [138, 520], [1150, 516]];
const LEVEL_XP = [0, 30, 80, 150, 250, 380, 550, 760, 1020, 1350, 1750, 2250, 2850];
const slotsOpen = () => Math.min(SLOTS.length, 4 + S.lvl);
const MAX_LVL = 10, FEEDS = 4;
const feedCost = m => 3 + m.lvl * 2;
const rateOf = m => KINDS[m.kind].rate * (1 + 0.35 * (m.lvl - 1));
const capOf = m => Math.round(rateOf(m) * 15);
const sellPrice = k => KINDS[k].price ? Math.round(KINDS[k].price * 0.5) : 40 * KINDS[k].el.length;
const BREED_SEC = n => [0, 20, 40, 75, 150][n];
const BERRY_SEC = 7, BERRY_CAP = 12, BUSH_PRICE = 300;

// ---------- сохранение
const SAVE = 'monstrohor-v1';
let S = null;
function newState() {
  return { v: 1, coins: 250, berries: 25, xp: 0, lvl: 1, nid: 3,
    mons: [{ id: 1, kind: 'bumbo', slot: SLOT_ORDER[0], lvl: 1, feed: 0, stored: 0 }, { id: 2, kind: 'fyuti', slot: SLOT_ORDER[1], lvl: 1, feed: 0, stored: 0 }],
    bushes: [{ n: 6 }, { n: 6 }], breed: null, nest: [], found: { bumbo: 1, fyuti: 1 }, music: true, sfx: true, tips: {}, t: Date.now() };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.v === 1) return s; } catch (e) {}
  return newState();
}
function save() { S.t = Date.now(); try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} }
// пока игры не было: монеты копятся до предела, кусты растят ягоды (не больше 12 часов)
function offline() {
  const dt = clamp((Date.now() - (S.t || Date.now())) / 1000, 0, 12 * 3600); if (dt < 5) return 0;
  let got = 0;
  for (const m of S.mons) { const add = Math.min(capOf(m) - m.stored, rateOf(m) * dt / 60); if (add > 0) { m.stored += add; got += add; } }
  for (const b of S.bushes) b.n = Math.min(BERRY_CAP, b.n + dt / BERRY_SEC);
  return Math.round(got);
}

// ---------- экран
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  SC = Math.min(W / VW, H / VH); OX = (W - VW * SC) / 2; OY = (H - VH * SC) / 2;
  buildStatic();
}
const vx0 = () => -OX / SC, vx1 = () => (W - OX) / SC, vy0 = () => -OY / SC, vy1 = () => (H - OY) / SC;
const toWorld = (cx, cy) => [(cx - OX) / SC, (cy - OY) / SC];
const toScreen = (x, y) => [x * SC + OX, y * SC + OY];
const worldT = c => c.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * OX, DPR * OY);

// ---------- неподвижные слои: небо, дальние острова, сам остров (рисуются один раз на размер экрана)
let bgLayer = null, islLayer = null;
function layer() { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); worldT(x); return [c, x]; }
function buildStatic() {
  let x; [bgLayer, x] = layer();
  const X0 = vx0(), X1 = vx1(), Y0 = vy0(), Y1 = vy1(), HZ = 432;
  const sky = x.createLinearGradient(0, Y0, 0, HZ); sky.addColorStop(0, '#4fb4f4'); sky.addColorStop(0.55, '#9fdcff'); sky.addColorStop(1, '#ffe9c8');
  x.fillStyle = sky; x.fillRect(X0, Y0, X1 - X0, HZ - Y0 + 1);
  // дальние горы-облака у горизонта
  x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 9; i++) { const cx = X0 + (i + 0.5) * (X1 - X0) / 9; x.beginPath(); x.ellipse(cx, HZ - 6, 110, 34 + (i % 3) * 10, 0, Math.PI, 0); x.fill(); }
  // море
  const sea = x.createLinearGradient(0, HZ, 0, Y1); sea.addColorStop(0, '#7fd3f2'); sea.addColorStop(0.3, '#3fa8e0'); sea.addColorStop(1, '#1f6fb8');
  x.fillStyle = sea; x.fillRect(X0, HZ, X1 - X0, Y1 - HZ);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(X0, HZ, X1 - X0, 2);
  // дальние островки
  farIsland(x, 70, 360, 0.55, '#7ecb6a'); farIsland(x, 1235, 330, 0.7, '#8fd47a'); farIsland(x, 470, 300, 0.32, '#a0dc8c');
  if (X1 > 1400) farIsland(x, 1420, 380, 0.45, '#86ce70'); if (X0 < -120) farIsland(x, -150, 350, 0.5, '#7ecb6a');
  [islLayer, x] = layer();
  drawIsland(x);
  ISL_PATH = new Path2D(); islandPath(ISL_PATH); vig = null;
  const R = mulberry(3); GLINTS = [];
  for (let i = 0; i < 60 && GLINTS.length < 34; i++) { const gx = X0 + R() * (X1 - X0), gy = 440 + Math.pow(R(), 1.6) * (Y1 - 440); if (Math.abs(gx - ISL.x) < ISL.rx - 40 && gy < ISL.y + 220) continue; GLINTS.push([gx, gy, R() * 6]); }
}
function farIsland(x, cx, cy, s, col) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = 'rgba(120,110,150,.35)'; x.beginPath(); x.moveTo(-150, 0); x.quadraticCurveTo(-60, 170, 0, 230); x.quadraticCurveTo(60, 170, 150, 0); x.fill();
  x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, 160, 34, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(-20, -8, 100, 14, 0, 0, Math.PI * 2); x.fill();
  // деревце
  x.fillStyle = '#8a6a4a'; x.fillRect(40, -70, 10, 60); x.fillStyle = shade(col.slice(0, 7), -0.15); x.beginPath(); x.arc(45, -80, 34, 0, Math.PI * 2); x.arc(20, -64, 22, 0, Math.PI * 2); x.arc(70, -62, 24, 0, Math.PI * 2); x.fill();
  x.restore();
}
function islandPath(x, dy = 0, sx = 1) {
  if (x.beginPath) x.beginPath(); // годится и для холста, и для Path2D
  for (let i = 0; i <= 120; i++) {
    const a = i / 120 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const px = ISL.x + ISL.rx * sx * Math.sign(c) * Math.pow(Math.abs(c), 0.5), py = ISL.y + dy + ISL.ry * Math.sign(s) * Math.pow(Math.abs(s), 0.5);
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
}
function drawIsland(x) {
  const R = mulberry(7), rand = (a, b) => a + R() * (b - a);
  // нижняя часть: скалистый конус, сужается вниз
  x.save();
  const cliff = x.createLinearGradient(0, 470, 0, 900); cliff.addColorStop(0, '#b07a46'); cliff.addColorStop(0.45, '#8a5a32'); cliff.addColorStop(1, '#5a3a22');
  x.fillStyle = cliff; x.strokeStyle = '#4a2e18'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(ISL.x - ISL.rx + 6, ISL.y + 8);
  x.bezierCurveTo(ISL.x - ISL.rx + 60, ISL.y + 230, ISL.x - 260, ISL.y + 380, ISL.x - 40, ISL.y + 470);
  x.lineTo(ISL.x + 30, ISL.y + 480);
  x.bezierCurveTo(ISL.x + 270, ISL.y + 380, ISL.x + ISL.rx - 50, ISL.y + 230, ISL.x + ISL.rx - 6, ISL.y + 8);
  x.closePath(); x.fill(); x.stroke();
  // слои породы и камни
  x.clip();
  for (let i = 0; i < 6; i++) { x.strokeStyle = `rgba(60,30,10,${0.12 + i * 0.02})`; x.lineWidth = 3; x.beginPath(); const yy = ISL.y + 70 + i * 48; x.moveTo(0, yy); for (let xx = 0; xx <= VW; xx += 40) x.lineTo(xx, yy + Math.sin(xx * 0.02 + i) * 10); x.stroke(); }
  for (let i = 0; i < 40; i++) { const px = rand(ISL.x - 500, ISL.x + 500), py = ISL.y + rand(60, 420); x.fillStyle = R() < 0.5 ? '#9a6a3e' : '#6e4628'; x.strokeStyle = 'rgba(40,20,8,.5)'; x.lineWidth = 2; x.beginPath(); x.ellipse(px, py, rand(10, 26), rand(7, 15), rand(-0.4, 0.4), 0, Math.PI * 2); x.fill(); x.stroke(); }
  x.restore();
  // висящие корни
  x.strokeStyle = '#6a4a22'; x.lineWidth = 3; x.lineCap = 'round';
  for (let i = 0; i < 16; i++) { const px = ISL.x - 470 + i * 62 + rand(-10, 10), py = islandEdge(px) + 18; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + rand(-14, 14), py + 30, px + rand(-14, 14), py + 50, px + rand(-10, 10), py + rand(50, 95)); x.stroke(); }
  // кромка земли под травой
  x.fillStyle = '#6e4a26'; islandPath(x, 22, 0.995); x.fill();
  // трава сверху
  const grass = x.createLinearGradient(0, ISL.y - ISL.ry, 0, ISL.y + ISL.ry); grass.addColorStop(0, '#a6e870'); grass.addColorStop(0.5, '#7fd552'); grass.addColorStop(1, '#5bb83a');
  x.fillStyle = grass; x.strokeStyle = '#3f8a24'; x.lineWidth = 4; islandPath(x); x.fill(); x.stroke();
  // бахрома травы по переднему краю
  x.fillStyle = '#5bb83a';
  for (let px = ISL.x - ISL.rx + 20; px < ISL.x + ISL.rx - 20; px += 14) { const py = islandEdge(px) - 2; x.beginPath(); x.moveTo(px - 8, py); x.lineTo(px, py + rand(10, 22)); x.lineTo(px + 8, py); x.fill(); }
  x.save(); islandPath(x); x.clip();
  // пятна света и тени на траве
  for (let i = 0; i < 26; i++) { const px = rand(120, 1160), py = rand(330, 610); x.fillStyle = R() < 0.5 ? 'rgba(255,255,200,.13)' : 'rgba(40,110,20,.12)'; x.beginPath(); x.ellipse(px, py, rand(40, 110), rand(14, 30), 0, 0, Math.PI * 2); x.fill(); }
  // тропинка к арке
  x.strokeStyle = 'rgba(214,180,120,.75)'; x.lineWidth = 26; x.lineCap = 'round'; x.beginPath(); x.moveTo(980, 600); x.quadraticCurveTo(1060, 540, 1098, 470); x.stroke();
  x.strokeStyle = 'rgba(160,120,70,.35)'; x.lineWidth = 2; x.setLineDash([6, 10]); x.beginPath(); x.moveTo(980, 600); x.quadraticCurveTo(1060, 540, 1098, 470); x.stroke(); x.setLineDash([]);
  // травинки
  for (let i = 0; i < 420; i++) {
    const px = rand(90, 1190), py = rand(325, 615); if (py > islandEdge(px) - 4) continue;
    x.strokeStyle = R() < 0.5 ? '#4ea830' : '#9ae064'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rand(-3, 3), py - rand(5, 10)); x.stroke();
  }
  // цветочки
  const FL = ['#ff6a8a', '#ffd84a', '#ffffff', '#b07aff', '#ff9a3a'];
  for (let i = 0; i < 60; i++) { const px = rand(100, 1180), py = rand(335, 610); if (py > islandEdge(px) - 8) continue; x.fillStyle = FL[i % FL.length]; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; x.beginPath(); x.arc(px + Math.cos(a) * 3, py + Math.sin(a) * 2, 2.4, 0, Math.PI * 2); x.fill(); } x.fillStyle = '#ffb02a'; x.beginPath(); x.arc(px, py, 1.6, 0, Math.PI * 2); x.fill(); }
  x.restore();
  // камни и грибы по краям (вне мест для монстров)
  for (const [px, py, s] of [[118, 470, 1], [1196, 462, 0.8], [300, 600, 0.7], [985, 612, 0.75]]) {
    x.fillStyle = '#b8a898'; x.strokeStyle = '#5a4a3a'; x.lineWidth = 3; x.beginPath(); x.ellipse(px, py, 24 * s, 15 * s, 0, Math.PI, 0); x.lineTo(px + 24 * s, py); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(px - 6 * s, py - 9 * s, 8 * s, 4 * s, -0.3, 0, Math.PI * 2); x.fill();
  }
  for (const [px, py] of [[1180, 560], [96, 548], [700, 612]]) {
    x.fillStyle = '#f4ead6'; x.strokeStyle = '#6a4a2a'; x.lineWidth = 2.4; x.beginPath(); x.roundRect(px - 4, py - 14, 8, 14, 3); x.fill(); x.stroke();
    x.fillStyle = '#e8483a'; x.beginPath(); x.ellipse(px, py - 14, 13, 9, 0, Math.PI, 0); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#fff'; for (const d of [-6, 1, 6]) { x.beginPath(); x.arc(px + d, py - 18 + Math.abs(d) * 0.4, 1.8, 0, Math.PI * 2); x.fill(); }
  }
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- живые части мира
const clouds = Array.from({ length: 7 }, (_, i) => ({ x: rand(-200, 1400), y: rand(40, 260), s: rand(0.6, 1.3), v: rand(4, 10), a: rand(0.55, 0.9) }));
const parts = []; // частицы: ноты, монеты, искры, сердечки
let T = 0, last = performance.now(), sel = null, mode = null; // mode: {type:'place', kind, from} | {type:'move', id}
const rt = new Map(); // id монстра → живое состояние для рисования

function drawCloud(c) {
  g.globalAlpha = c.a; g.fillStyle = '#fff';
  g.beginPath(); for (const [dx, dy, r] of [[0, 0, 34], [32, -12, 28], [62, 2, 30], [28, 10, 30], [-30, 6, 24]]) { g.moveTo(c.x + dx * c.s + r * c.s, c.y + dy * c.s); g.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2); } g.fill();
  g.globalAlpha = 1;
}
function drawSea() {
  const X0 = vx0(), X1 = vx1();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2.5; g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const row = i % 6, y = 452 + row * row * 9 + row * 8, sp = 18 + row * 6, x = X0 + ((i * 197 + T * sp) % (X1 - X0 + 200)) - 100, w = 16 + row * 6;
    g.globalAlpha = 0.35 + 0.4 * Math.sin(T * 1.5 + i); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke();
  }
  g.globalAlpha = 1;
}
function drawWaterfall() {
  const x0 = 1150, y0 = islandEdge(1150) - 6;
  const gr = g.createLinearGradient(0, y0, 0, VH + 40); gr.addColorStop(0, 'rgba(160,225,255,.95)'); gr.addColorStop(1, 'rgba(120,200,255,.25)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 14, y0); g.quadraticCurveTo(x0 + 6, y0 + 40, x0 + 6, VH + 40); g.lineTo(x0 + 34, VH + 40); g.quadraticCurveTo(x0 + 34, y0 + 40, x0 + 18, y0); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const yy = y0 + ((T * 120 + i * 50) % 260); g.beginPath(); g.moveTo(x0 + 4 + i * 5, yy); g.lineTo(x0 + 6 + i * 5, yy + 22); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x0 + 4, y0 + 2, 18 + Math.sin(T * 5 + i) * 3, 6, 0, 0, Math.PI * 2); g.fill(); }
}
function drawArch() {
  const { x, y } = ARCH, b = S.breed;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(30,40,20,.25)'; g.beginPath(); g.ellipse(0, 0, 70, 12, 0, 0, Math.PI * 2); g.fill();
  // столбы и свод из камней
  g.lineJoin = 'round';
  for (const s of [-1, 1]) { g.fillStyle = '#c8b8a0'; g.strokeStyle = '#5a4a3a'; g.lineWidth = 4; g.beginPath(); g.roundRect(s * 48 - 15, -112, 30, 112, 8); g.fill(); g.stroke(); g.strokeStyle = 'rgba(90,74,58,.4)'; g.lineWidth = 2; for (const yy of [-80, -50, -22]) { g.beginPath(); g.moveTo(s * 48 - 13, yy); g.lineTo(s * 48 + 13, yy); g.stroke(); } }
  g.strokeStyle = '#5a4a3a'; g.lineWidth = 34 + 8; g.beginPath(); g.arc(0, -110, 48, Math.PI, 0); g.stroke();
  g.strokeStyle = '#c8b8a0'; g.lineWidth = 32; g.beginPath(); g.arc(0, -110, 48, Math.PI, 0); g.stroke();
  // светящиеся знаки стихий на своде
  const glow = b ? 0.6 + 0.4 * Math.sin(T * 5) : 0.35;
  ['stone', 'water', 'wind', 'leaf'].forEach((e, i) => { const a = Math.PI + (i + 0.5) / 4 * Math.PI; g.fillStyle = ELEMENTS[e].col; g.globalAlpha = glow; g.beginPath(); g.arc(Math.cos(a) * 48, -110 + Math.sin(a) * 48, 7, 0, Math.PI * 2); g.fill(); });
  g.globalAlpha = 1;
  // вьюн
  g.strokeStyle = '#3f9a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-60, -10); g.bezierCurveTo(-70, -60, -40, -120, -10, -152); g.stroke();
  for (let i = 0; i < 6; i++) leafShape(g, -62 + i * 9, -20 - i * 22, 12, -0.6 - i * 0.2, '#5cc040');
  if (b) {
    const left = (b.end - Date.now()) / 1000, k = 1 - left / b.dur;
    if (left > 0) {
      // вихрь и сердечки между родителями
      g.strokeStyle = 'rgba(255,140,200,.7)'; g.lineWidth = 4; g.beginPath(); g.arc(0, -60, 26, T * 3, T * 3 + Math.PI * 2 * clamp(k, 0.02, 1)); g.stroke();
      g.fillStyle = '#fff'; g.font = '800 17px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(fmtTime(left), 0, -54);
      if (Math.random() < 0.05) parts.push({ kind: 'heart', x: x + rand(-30, 30), y: y - 70, vx: rand(-10, 10), vy: -30, life: 1.6, t: 0 });
    } else {
      // готово: яйцо в арке; при нажатии качается, трескается и лопается
      const h = hatching, bob = h ? 0 : Math.sin(T * 4) * 3, glow = h ? 0.5 + h.t * 0.4 : 0.5;
      const gl = g.createRadialGradient(0, -46, 4, 0, -46, 54 + (h ? h.t * 30 : 0)); gl.addColorStop(0, `rgba(255,246,170,${glow})`); gl.addColorStop(1, 'rgba(255,240,150,0)');
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
  const K = KINDS[kind], col = K ? K.col : '#fff';
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#fff8e8'; c.strokeStyle = '#6a5a4a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -46); c.bezierCurveTo(26, -46, 30, 0, 0, 0); c.bezierCurveTo(-30, 0, -26, -46, 0, -46); c.fill(); c.stroke();
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
  g.fillStyle = '#3f9a2a'; g.strokeStyle = '#1f5a14'; g.lineWidth = 3;
  g.beginPath(); for (const [dx, dy, r] of [[-22, -20, 20], [20, -20, 20], [0, -36, 24], [0, -14, 24]]) { g.moveTo(dx + r, dy); g.arc(dx, dy, r, 0, Math.PI * 2); } g.stroke(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.ellipse(-8, -44, 12, 6, -0.4, 0, Math.PI * 2); g.fill();
  const n = Math.floor(b.n); const spots = [[-24, -26], [14, -40], [26, -18], [-6, -22], [2, -46], [-18, -40], [10, -12], [-30, -12], [32, -32], [-10, -8], [20, -28], [-2, -34]];
  for (let k = 0; k < Math.min(n, spots.length); k++) { const [dx, dy] = spots[k]; g.fillStyle = '#e8304a'; g.strokeStyle = '#7a1020'; g.lineWidth = 1.6; g.beginPath(); g.arc(dx, dy, 5, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(dx - 1.6, dy - 1.6, 1.4, 0, Math.PI * 2); g.fill(); }
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

// ---------- монстры на острове
function monSize(m) { const [, y] = SLOTS[m.slot]; return 108 * ROW_SCALE(y) * (1 + 0.04 * (m.lvl - 1)); }
function stateOf(m) {
  let r = rt.get(m.id);
  if (!r) { r = { phase: Math.random() * 6, blinkT: rand(1, 4), blinkP: 1, blink: 0, look: 0, lookY: 0, lookT: rand(1, 3), lastOn: 0, pop: 0, sp: 0, sv: 0, jy: 0, jv: 0, actT: rand(4, 12), wig: 0, tilt: 0, bob: 0 }; rt.set(m.id, r); }
  return r;
}
// сила «желе» на каждую ноту: барабаны трясут сильнее, долгие ноты — мягко
const JELLY = { kick: 1.5, snare: 1.0, tom: 0.9, shaker: 0.16, bass: 0.75, marimba: 0.45, glock: 0.4, flute: 0.35, pluck: 0.5, brass: 0.85, frog: 0.8, lead: 0.45, whistle: 0.3, pad: 0.35, opera: 0.55 };
let lookAt = null; // куда все смотрят после нажатия
function jumpMon(m, v) { const r = stateOf(m); if (r.jy > 0) return; r.jv = v; r.jy = 0.01; r.sv -= 0.9; }
function updateMon(m, dt) {
  const r = stateOf(m), K = KINDS[m.kind], [x, y] = SLOTS[m.slot], sz = monSize(m);
  // моргание: веко опускается и поднимается за 0,2 с, иногда дважды
  r.blinkT -= dt; if (r.blinkT < 0) { r.blinkP = 0; r.blinkT = Math.random() < 0.2 ? 0.3 : rand(2.2, 5.5); }
  if (r.blinkP < 1) { r.blinkP = Math.min(1, r.blinkP + dt / 0.2); r.blink = Math.sin(r.blinkP * Math.PI); } else r.blink = 0;
  // взгляд: на нажатие, иначе по сторонам
  if (lookAt && T < lookAt.until) { r.lookTo = clamp((lookAt.x - x) / 220, -1, 1); r.lookYTo = clamp((lookAt.y - (y - sz * 0.6)) / 220, -1, 1); }
  else { r.lookT -= dt; if (r.lookT < 0) { r.lookT = rand(1.5, 4); r.lookTo = rand(-1, 1); r.lookYTo = rand(-0.5, 0.3); } }
  const ek = 1 - Math.exp(-dt * 12); r.look = lerp(r.look, r.lookTo || 0, ek); r.lookY = lerp(r.lookY, r.lookYTo || 0, ek);
  r.sing = Sound.ready && !m.mute ? Sound.singing(m.id) : 0;
  r.pop = Math.max(0, r.pop - dt * 2.5);
  // новая нота: толчок «желе» и нота-частица
  const now = Sound.now(), n = Sound.onsets(m.id, r.lastOn); r.lastOn = now;
  if (n && !m.mute) {
    r.sv -= JELLY[K.part] || 0.4;
    if (rings.length < 40 && (K.part !== 'shaker' || Math.random() < 0.25)) rings.push({ x, y, t: 0, col: ELEMENTS[K.el[(r.ringN = (r.ringN || 0) + 1) % K.el.length]].col });
    if (Math.random() < 0.55) parts.push({ kind: 'note', x: x + rand(-20, 20), y: y - sz * 0.95 - r.jy, vx: rand(-14, 14), vy: rand(-55, -35), life: 1.5, t: 0, col: ELEMENTS[K.el[n % K.el.length]].col, ch: Math.random() < 0.5 ? '♪' : '♫' });
  }
  // пружина: сплющился — вытянулся — успокоился
  const acc = -260 * r.sp - 10 * r.sv; r.sv += acc * dt; r.sp = clamp(r.sp + r.sv * dt, -0.24, 0.24);
  // прыжок с отскоком и пылью при приземлении
  if (r.jy > 0) {
    r.jv -= 1800 * dt; r.jy += r.jv * dt;
    if (r.jy <= 0) {
      r.jy = 0; const hit = -r.jv;
      if (hit > 180) { r.sv -= Math.min(2.6, hit / 380); dust(x, y, Math.min(1.6, hit / 500)); if (hit > 420) { r.jv = hit * 0.28; r.jy = 0.01; } }
      if (r.jy === 0) r.jv = 0;
    }
  }
  // сам по себе: подпрыгнуть или покачаться
  r.actT -= dt;
  if (r.actT < 0) { r.actT = rand(6, 15); const k = Math.random(); if (k < 0.4) jumpMon(m, rand(260, 380)); else if (k < 0.75) r.wig = 1; else r.lookT = 0; }
  r.wig = Math.max(0, r.wig - dt * 1.1); r.tilt = Math.sin(r.wig * 16) * 0.13 * r.wig;
  // кивок в такт: короткий наклон на каждую долю
  if (Sound.ready && S.music && !m.mute) { const b = Sound.beat(), f = b - Math.floor(b); r.bob = Math.pow(1 - f, 5) * 3.2; } else r.bob = 0;
  // монеты копятся
  if (m.stored < capOf(m)) m.stored = Math.min(capOf(m), m.stored + rateOf(m) * dt / 60);
}
function dust(x, y, k = 1) {
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; parts.push({ kind: 'dust', x: x + Math.cos(a) * 20 * k, y: y - 2 + Math.sin(a) * 4, vx: Math.cos(a) * rand(40, 90) * k, vy: Math.sin(a) * 10 - 12, life: rand(0.45, 0.7), t: 0, r: rand(7, 12) * k }); }
}
function drawMon(m) {
  const r = stateOf(m), [x, y] = SLOTS[m.slot], sz = monSize(m) * (1 + r.pop * 0.15);
  if (mode && mode.type === 'move' && mode.id === m.id) g.globalAlpha = 0.45 + 0.25 * Math.sin(T * 8);
  drawMonster(g, m.kind, x, y, sz, { t: T, sing: r.sing, blink: r.blink, look: r.look, lookY: r.lookY, phase: r.phase, sq: r.sp, jump: r.jy, bob: r.bob, tilt: r.tilt });
  g.globalAlpha = 1;
  if (m.mute) { g.fillStyle = 'rgba(40,40,60,.75)'; g.beginPath(); g.arc(x + sz * 0.32, y - sz * 0.9, 13, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + sz * 0.32 - 6, y - sz * 0.9 - 6); g.lineTo(x + sz * 0.32 + 6, y - sz * 0.9 + 6); g.stroke(); }
}
function monBubble(m) {
  const amt = Math.floor(m.stored); if (amt < Math.max(5, rateOf(m) * 0.75)) return;
  const [x, y] = SLOTS[m.slot], sz = monSize(m); bubble(x, y - sz * (KINDS[m.kind].hover ? 1.35 : 1.18) - 12, String(amt), '#e8b020', 'coin');
}
const panOf = m => clamp((SLOTS[m.slot][0] - ISL.x) / ISL.x * 0.8, -0.8, 0.8);
const monAt = slot => S.mons.find(m => m.slot === slot);
const freeSlots = () => SLOT_ORDER.slice(0, slotsOpen()).filter(i => !monAt(i));

// ---------- частицы
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    if (p.kind === 'fly') { const k = clamp(p.t / p.life, 0, 1), e = k * k; p.x = lerp(p.x0, p.tx, e) + Math.sin(k * Math.PI) * p.arc; p.y = lerp(p.y0, p.ty, e) - Math.sin(k * Math.PI) * 60; if (k >= 1) { parts.splice(i, 1); if (p.done) p.done(); } continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'spark') p.vy += 120 * dt;
    if (p.kind === 'confetti') { p.vy += 420 * dt; p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.2; p.rot += p.vr * dt; }
    if (p.kind === 'dust') { p.vx *= 1 - dt * 5; p.vy *= 1 - dt * 3; }
    if (p.kind === 'mist') { p.vx *= 1 - dt * 2; }
    if (p.kind === 'petal') { p.y += Math.sin(p.t * 2.2) * 22 * dt; p.rot += p.vr * dt; if (p.x > vx1() + 40) p.t = p.life + 1; }
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
    else if (p.kind === 'fly') { if (p.icon === 'coin') coinIcon(g, p.x, p.y, 11); else { g.fillStyle = '#e8304a'; g.strokeStyle = '#7a1020'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 8, 0, Math.PI * 2); g.fill(); g.stroke(); } }
    else if (p.kind === 'dust') { const k = p.t / p.life; g.fillStyle = `rgba(250,240,220,${0.75 * a})`; g.beginPath(); g.arc(p.x, p.y, p.r * (0.6 + k), 0, Math.PI * 2); g.fill(); }
    else if (p.kind === 'mist') { g.fillStyle = `rgba(255,255,255,${0.35 * a})`; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + p.t), 0, Math.PI * 2); g.fill(); }
    else if (p.kind === 'petal') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(p.rot * 1.3))); g.fillStyle = p.col; g.beginPath(); g.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    else if (p.kind === 'confetti') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.rot * 1.7)); g.fillStyle = p.col; g.fillRect(-5, -3, 10, 6); g.restore(); }
    else if (p.kind === 'text') { g.font = '900 26px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(p.text, p.x, p.y); g.fillStyle = p.col || '#fff'; g.fillText(p.text, p.x, p.y); }
  }
  g.globalAlpha = 1;
}
const CONF = ['#ff5a8a', '#ffd84a', '#5ad0ff', '#7ee05a', '#b07aff', '#ff9a3a'];
function confetti(x, y, n = 40, spread = 1) { for (let i = 0; i < n; i++) { const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), v = rand(180, 460) * spread; parts.push({ kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, 6), vr: rand(-12, 12), life: rand(1.4, 2.2), t: 0, col: CONF[i % CONF.length] }); } }
function burst(x, y, col, n = 14) { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(60, 200); parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rand(0.5, 1), t: 0, col }); } }
function floatText(x, y, text, col) { parts.push({ kind: 'text', x, y, vx: 0, vy: -40, life: 1.3, t: 0, text, col }); }
// иконка летит в счётчик наверху
function flyTo(x, y, el, icon, n, done) {
  const r = $(el).getBoundingClientRect(), [tx, ty] = toWorld(r.left + r.width * 0.3, r.top + r.height / 2);
  for (let i = 0; i < n; i++) parts.push({ kind: 'fly', icon, x0: x + rand(-14, 14), y0: y + rand(-10, 10), x, y, tx, ty, arc: rand(-60, 60), life: 0.6 + i * 0.05, t: 0, done: i === n - 1 ? done : null });
}

// ---------- живая природа вокруг острова
const birds = [], flies = Array.from({ length: 3 }, (_, i) => ({ x: rand(250, 1030), y: rand(330, 520), tx: 0, ty: 0, t: rand(0, 5), col: ['#ff9ad0', '#ffd84a', '#9fe3ff'][i] }));
const ISLETS = [[18, 604, 0.42, 0], [1264, 620, 0.36, 2], [-120, 520, 0.3, 4], [1420, 470, 0.28, 1]];
let birdT = 3, mistT = 0, petalT = 2, raysG = null, vig = null, ISL_PATH = null, GLINTS = [];
function ambient(dt) {
  birdT -= dt;
  if (birdT < 0) {
    birdT = rand(14, 26); const dir = Math.random() < 0.5 ? 1 : -1, y0 = rand(90, 220), x0 = dir > 0 ? vx0() - 60 : vx1() + 60;
    for (let i = 0, n = 3 + (Math.random() * 3 | 0); i < n; i++) birds.push({ x: x0 - dir * i * rand(30, 50), y: y0 + rand(-20, 20) + Math.abs(i - 1) * 12, v: dir * rand(70, 90), ph: rand(0, 6), s: rand(0.7, 1) });
  }
  for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; b.x += b.v * dt; b.y += Math.sin(T * 1.5 + b.ph) * 6 * dt; if (b.x < vx0() - 250 || b.x > vx1() + 250) birds.splice(i, 1); }
  for (const f of flies) {
    f.t += dt; if (!f.tx || Math.hypot(f.tx - f.x, f.ty - f.y) < 12) { f.tx = rand(220, 1060); f.ty = rand(330, 560); }
    const a = Math.atan2(f.ty - f.y, f.tx - f.x); f.x += Math.cos(a) * 42 * dt + Math.sin(f.t * 5) * 22 * dt; f.y += Math.sin(a) * 42 * dt + Math.cos(f.t * 7) * 26 * dt;
  }
  mistT -= dt; if (mistT < 0) { mistT = 0.08; parts.push({ kind: 'mist', x: 1168 + rand(-16, 16), y: VH - rand(0, 12), vx: rand(-30, 30), vy: rand(-45, -15), life: rand(0.8, 1.4), t: 0, r: rand(6, 12) }); }
  petalT -= dt; if (petalT < 0) { petalT = rand(1.8, 4.5); parts.push({ kind: 'petal', x: vx0() - 20, y: rand(240, 560), vx: rand(45, 85), vy: 0, life: 40, t: 0, rot: rand(0, 6), vr: rand(-2.5, 2.5), col: Math.random() < 0.5 ? '#ffc0d8' : '#fff2b8' }); }
}
// ---------- день и ночь: круг 5 минут — день, закат, ночь со звёздами и фонариками, рассвет
const DAY_LEN = 300; let NIGHT = 0, DUSK = 0;
const STARS = Array.from({ length: 110 }, () => [rand(-300, 1580), Math.pow(Math.random(), 1.3) * 300, rand(0, 6), rand(0.6, 1.6)]);
const FIREFLIES = Array.from({ length: 14 }, () => ({ x: rand(200, 1080), y: rand(340, 600), ph: rand(0, 6), vx: rand(-14, 14), vy: rand(-8, 8) }));
// гирлянда: четыре провиса между пятью столбиками
const GARLAND = Array.from({ length: 45 }, (_, i) => { const k = i / 44; return [215 + k * 860, 348 + 18 * (1 - Math.abs(Math.cos(k * Math.PI * 4)))]; });
const GCOL = ['#ff5a6a', '#ffd84a', '#5ad0ff', '#7ee05a', '#ff9ad0'];
function dayCycle() {
  const p = ((T + 25) / DAY_LEN) % 1, step = (a, b, x) => clamp((x - a) / (b - a), 0, 1), tri = (c, w) => Math.max(0, 1 - Math.abs(p - c) / w);
  NIGHT = step(0.6, 0.67, p) * (1 - step(0.88, 0.95, p));
  DUSK = Math.max(tri(0.6, 0.065), tri(0.925, 0.05) * 0.8);
}
function drawSun() {
  const a = 1 - NIGHT; if (a <= 0.01) return;
  const y = 130 + DUSK * 90 + NIGHT * 260, sun = g.createRadialGradient(1010, y, 10, 1010, y, 170);
  sun.addColorStop(0, `rgba(255,${255 - DUSK * 60 | 0},${230 - DUSK * 120 | 0},${a})`); sun.addColorStop(0.25, `rgba(255,${246 - DUSK * 80 | 0},${190 - DUSK * 120 | 0},${0.9 * a})`); sun.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = sun; g.fillRect(820, y - 190, 380, 380);
}
// гирлянда над задним краем острова: днём цветные шарики, ночью светятся
function drawGarland() {
  g.strokeStyle = 'rgba(60,50,40,.55)'; g.lineWidth = 2; g.beginPath(); GARLAND.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  for (let i = 0; i <= 4; i++) { const x = 215 + i * 215; g.fillStyle = '#7a5030'; g.fillRect(x - 3, 344, 6, 54); g.fillStyle = '#a07040'; g.beginPath(); g.arc(x, 344, 5, 0, Math.PI * 2); g.fill(); }
  GARLAND.forEach(([x, y], i) => { if (i % 2) return; g.fillStyle = GCOL[(i / 2) % GCOL.length]; g.beginPath(); g.arc(x, y + 5, 4.2, 0, Math.PI * 2); g.fill(); });
}
// ночной свет поверх затемнения: звёзды, луна, гирлянда, грибы, светлячки, прожекторы на поющих
function drawNight() {
  if (DUSK > 0.01) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(255,160,110,${DUSK * 0.5})`; g.fillRect(vx0(), vy0(), vx1() - vx0(), vy1() - vy0()); }
  if (NIGHT < 0.01) { g.globalCompositeOperation = 'source-over'; return; }
  g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(66,84,168,${NIGHT * 0.78})`; g.fillRect(vx0(), vy0(), vx1() - vx0(), vy1() - vy0());
  g.globalCompositeOperation = 'lighter';
  // звёзды (не поверх облаков)
  for (const [x, y, ph, r] of STARS) {
    if (x < vx0() || x > vx1() || clouds.some(c => Math.abs(x - c.x - 20 * c.s) < 70 * c.s && Math.abs(y - c.y) < 34 * c.s)) continue;
    const a = NIGHT * (0.55 + 0.45 * Math.sin(T * 2 + ph)); g.fillStyle = `rgba(255,255,230,${a})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // луна
  const mg = g.createRadialGradient(250, 115, 10, 250, 115, 120); mg.addColorStop(0, `rgba(220,230,255,${0.5 * NIGHT})`); mg.addColorStop(1, 'rgba(220,230,255,0)'); g.fillStyle = mg; g.fillRect(130, -5, 240, 240);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = NIGHT;
  g.fillStyle = '#f4f2e0'; g.beginPath(); g.arc(250, 115, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(180,180,160,.5)'; for (const [dx, dy, r] of [[-10, -8, 7], [12, 6, 5], [-4, 14, 4], [14, -14, 3]]) { g.beginPath(); g.arc(250 + dx, 115 + dy, r, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  // гирлянда
  GARLAND.forEach(([x, y], i) => { if (i % 2) return; const c = GCOL[(i / 2) % GCOL.length], n = parseInt(c.slice(1), 16); glow(x, y + 5, 16, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},A)`, NIGHT * (0.75 + 0.25 * Math.sin(T * 3 + i))); });
  // светящиеся грибы
  for (const [x, y] of [[1180, 546], [96, 534], [700, 598]]) glow(x, y, 34, 'rgba(255,120,90,A)', NIGHT * 0.55);
  // светлячки
  for (const f of FIREFLIES) glow(f.x, f.y, 9, 'rgba(220,255,120,A)', NIGHT * Math.max(0, Math.sin(T * 2.4 + f.ph)));
  // прожекторы: поющие монстры в столбе света
  for (const m of S.mons) {
    const r = stateOf(m); if (r.sing < 0.05) continue; const [x, y] = SLOTS[m.slot], sz = monSize(m), a = NIGHT * r.sing;
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
    const r = rings[i]; r.t += dt; const k = r.t / 0.7; if (k >= 1) { rings.splice(i, 1); continue; }
    g.strokeStyle = r.col; g.globalAlpha = (1 - k) * 0.55; g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.ellipse(r.x, r.y, 30 + k * 46, 9 + k * 13, 0, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
}
function drawRays() {
  if (NIGHT > 0.98) return; g.globalAlpha = (1 - NIGHT) * (1 - DUSK * 0.4);
  if (!raysG) { raysG = g.createRadialGradient(1010, 130, 20, 1010, 130, 780); raysG.addColorStop(0, 'rgba(255,250,215,.24)'); raysG.addColorStop(1, 'rgba(255,250,215,0)'); }
  g.fillStyle = raysG; g.beginPath();
  for (let i = 0; i < 9; i++) { const a = T * 0.02 + i * Math.PI * 2 / 9, w = 0.08 + 0.04 * Math.sin(T * 0.6 + i * 1.7); g.moveTo(1010, 130); g.lineTo(1010 + Math.cos(a - w) * 900, 130 + Math.sin(a - w) * 900); g.lineTo(1010 + Math.cos(a + w) * 900, 130 + Math.sin(a + w) * 900); g.closePath(); }
  g.fill(); g.globalAlpha = 1;
}
function drawBirds() {
  g.strokeStyle = 'rgba(40,50,80,.7)'; g.lineWidth = 2.4; g.lineCap = 'round';
  for (const b of birds) { const f = Math.sin(T * 9 + b.ph) * 7 * b.s, w = 11 * b.s; g.beginPath(); g.moveTo(b.x - w, b.y - f); g.quadraticCurveTo(b.x - w / 2, b.y - 4 * b.s, b.x, b.y); g.quadraticCurveTo(b.x + w / 2, b.y - 4 * b.s, b.x + w, b.y - f); g.stroke(); }
}
function drawGlints() {
  g.fillStyle = '#fff';
  for (const [x, y, ph] of GLINTS) { const a = Math.sin(T * 2.6 + ph); if (a < 0.3) continue; const r = 2 + a * 3; g.globalAlpha = a * 0.9; g.beginPath(); g.moveTo(x - r * 2, y); g.lineTo(x, y - r * 0.5); g.lineTo(x + r * 2, y); g.lineTo(x, y + r * 0.5); g.closePath(); g.fill(); }
  g.globalAlpha = 1;
}
function drawIslets() {
  for (const [x, y, s, ph] of ISLETS) {
    if (x < vx0() - 80 || x > vx1() + 80) continue;
    g.save(); g.translate(x, y + Math.sin(T * 0.9 + ph) * 6); g.scale(s, s);
    g.fillStyle = '#9a6a3e'; g.strokeStyle = '#4a2e18'; g.lineWidth = 5; g.beginPath(); g.moveTo(-110, 0); g.quadraticCurveTo(-60, 110, 0, 170); g.quadraticCurveTo(50, 110, 110, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#7fd552'; g.strokeStyle = '#3f8a24'; g.beginPath(); g.ellipse(0, 0, 118, 30, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,220,.28)'; g.beginPath(); g.ellipse(-22, -8, 70, 12, 0, 0, Math.PI * 2); g.fill();
    if (ph % 2 === 0) { g.fillStyle = '#3f9a2a'; g.strokeStyle = '#1f5a14'; g.lineWidth = 4; g.beginPath(); g.arc(24, -22, 26, 0, Math.PI * 2); g.arc(-6, -14, 20, 0, Math.PI * 2); g.stroke(); g.fill(); }
    else { g.fillStyle = '#c8b8a0'; g.strokeStyle = '#5a4a3a'; g.lineWidth = 4; g.beginPath(); g.ellipse(26, -6, 24, 18, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
}
function drawCloudShadows() {
  g.save(); g.clip(ISL_PATH); g.fillStyle = 'rgba(20,70,30,.1)';
  for (const c of clouds) { const sx = c.x + 40 * c.s, sy = 360 + c.y * 0.85; g.beginPath(); g.ellipse(sx, sy, 125 * c.s, 34 * c.s, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function drawFlies() {
  for (const f of flies) {
    const k = 0.25 + 0.75 * Math.abs(Math.sin(f.t * 16)); g.save(); g.translate(f.x, f.y);
    g.fillStyle = f.col; g.strokeStyle = 'rgba(70,30,70,.7)'; g.lineWidth = 1.2;
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 6 * k, -3, 6.5 * k + 0.5, 5, sd * 0.4, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.ellipse(sd * 4.5 * k, 3.5, 4.5 * k + 0.5, 3.5, -sd * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.strokeStyle = '#3a2a3a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke(); g.restore();
  }
}
function drawVignette() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!vig) { const w = cv.width, h = cv.height; vig = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.5, w / 2, h * 0.55, Math.max(w, h) * 0.78); vig.addColorStop(0, 'rgba(10,30,70,0)'); vig.addColorStop(1, 'rgba(10,30,70,.3)'); }
  g.fillStyle = vig; g.fillRect(0, 0, cv.width, cv.height); worldT(g);
}

// ---------- кадр
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  if (!S) return;
  for (const c of clouds) { c.x += c.v * dt; if (c.x > vx1() + 150) { c.x = vx0() - 200; c.y = rand(40, 260); } }
  for (const m of S.mons) updateMon(m, dt);
  for (const b of S.bushes) b.n = Math.min(BERRY_CAP, b.n + dt / BERRY_SEC);
  updateParts(dt); tick(dt); hatchStep(dt); ambient(dt); dayCycle();
  for (const f of FIREFLIES) { f.x += (f.vx + Math.sin(T + f.ph) * 10) * dt; f.y += (f.vy + Math.cos(T * 1.3 + f.ph) * 8) * dt; if (f.x < 180 || f.x > 1100) f.vx *= -1; if (f.y < 330 || f.y > 610) f.vy *= -1; }
  // рисование
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bgLayer, 0, 0);
  worldT(g);
  drawSun(); drawRays();
  for (const c of clouds) drawCloud(c);
  if (NIGHT < 0.9) drawBirds(); drawSea(); drawGlints(); drawIslets();
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(islLayer, 0, 0); worldT(g);
  drawCloudShadows(); drawWaterfall(); drawGarland(); drawRings(dt);
  // подсветка мест при расстановке
  if (mode) {
    const free = new Set(freeSlots());
    SLOT_ORDER.slice(0, slotsOpen()).forEach(i => {
      const [x, y] = SLOTS[i], ok = free.has(i) || (mode.type === 'move' && monAt(i) && monAt(i).id === mode.id);
      g.strokeStyle = ok ? `rgba(255,255,255,${0.6 + 0.3 * Math.sin(T * 6)})` : 'rgba(255,255,255,.18)'; g.lineWidth = 4; g.setLineDash([10, 8]);
      g.beginPath(); g.ellipse(x, y, 52, 16, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      if (ok && free.has(i)) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fill(); }
    });
  }
  if (sel) { const m = S.mons.find(q => q.id === sel); if (m) { const [x, y] = SLOTS[m.slot]; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y, 50 + Math.sin(T * 5) * 3, 15, 0, 0, Math.PI * 2); g.stroke(); } }
  // всё, что стоит на острове, — по глубине
  const ents = [{ y: ARCH.y, d: drawArch }, { y: NEST.y, d: drawNest }];
  S.bushes.forEach((b, i) => ents.push({ y: BUSH_POS[i][1], d: () => drawBush(i) }));
  for (const m of S.mons) ents.push({ y: SLOTS[m.slot][1], d: () => drawMon(m) });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
  if (NIGHT < 0.7) drawFlies();
  drawNight();
  for (const m of S.mons) monBubble(m);
  drawParts();
  drawVignette();
}

// ---------- игровые таймеры и подсказки (раз в кадр, дёшево)
let saveT = 0, uiT = 0;
function tick(dt) {
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  uiT += dt; if (uiT > 0.25) { uiT = 0; hud(); tips(); }
}
function addXP(n) {
  S.xp += n;
  while (S.lvl < LEVEL_XP.length && S.xp >= LEVEL_XP[S.lvl]) {
    S.lvl++; Sound.sfx('level'); banner(`Уровень острова ${S.lvl}!`, 'Открыто новое место для монстра');
    for (let i = 0; i < 5; i++) confetti(rand(300, 980), rand(280, 380), 22);
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
  const ready = S.mons.reduce((s, m) => s + (m.stored >= 5 ? Math.floor(m.stored) : 0), 0);
  $('bCollect').classList.toggle('hot', ready >= 20); $('collectN').textContent = ready ? '+' + ready : '';
  $('bBreed').classList.toggle('hot', !!(S.breed && Date.now() >= S.breed.end));
  $('bSound').classList.toggle('off', !S.music);
}

// ---------- действия
function collect(m, quiet) {
  const amt = Math.floor(m.stored); if (amt < 1) return 0;
  m.stored -= amt; const [x, y] = SLOTS[m.slot], sz = monSize(m);
  flyTo(x, y - sz * 1.15, 'coins', 'coin', Math.min(6, 1 + Math.floor(amt / 15)), () => { S.coins += amt; hud(); });
  if (!quiet) { Sound.sfx('coin'); floatText(x, y - sz * 1.2, '+' + amt, '#ffe680'); }
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
function buy(kind) {
  const K = KINDS[kind];
  if (S.lvl < (K.need || 1)) { Sound.sfx('deny'); toast(`Откроется на ${K.need} уровне острова`); return; }
  if (S.coins < K.price) { Sound.sfx('deny'); toast('Не хватает монет — собери их у монстров'); return; }
  if (!freeSlots().length) { Sound.sfx('deny'); toast('На острове нет места: подними уровень острова или продай монстра'); return; }
  closeSheet(); mode = { type: 'place', kind, cost: K.price }; hint(`Куда поставить ${K.name}? Нажми на светлый круг`);
}
function place(slot) {
  const kind = mode.kind;
  if (mode.cost) { if (S.coins < mode.cost) { Sound.sfx('deny'); return; } S.coins -= mode.cost; addXP(8); }
  if (mode.from === 'nest') S.nest.splice(mode.idx, 1);
  const m = { id: S.nid++, kind, slot, lvl: 1, feed: 0, stored: 0 }; S.mons.push(m);
  const fresh = !S.found[kind]; S.found[kind] = 1; if (fresh) addXP(25);
  Sound.add(m.id, KINDS[kind].part, panOf(m)); Sound.sfx('hatch');
  const r = stateOf(m), [x, y] = SLOTS[slot]; r.jy = 420; r.jv = -150; burst(x, y - 50, KINDS[kind].col, 24); confetti(x, y - 60, 26, 0.7);
  mode = null; hint(''); save(); hud();
  toast(`${KINDS[kind].name} поёт в хоре!`);
}
function moveTo(slot) {
  const m = S.mons.find(q => q.id === mode.id); mode = null; hint('');
  if (!m || monAt(slot)) return; m.slot = slot; Sound.setPan(m.id, panOf(m)); Sound.sfx('pop'); const r = stateOf(m); r.jy = 160; r.jv = 120; save();
}
function feed(m) {
  if (m.lvl >= MAX_LVL) { toast('Монстр уже самый большой'); return; }
  const c = feedCost(m); if (S.berries < c) { Sound.sfx('deny'); toast('Не хватает ягод — собери их с кустов'); return; }
  S.berries -= c; m.feed++; Sound.sfx('eat'); addXP(2);
  const [x, y] = SLOTS[m.slot], sz = monSize(m); for (let i = 0; i < 5; i++) parts.push({ kind: 'heart', x: x + rand(-25, 25), y: y - sz * 0.6, vx: rand(-20, 20), vy: rand(-60, -30), life: 1, t: 0 });
  stateOf(m).pop = 0.6;
  if (m.feed >= FEEDS) { m.feed = 0; m.lvl++; Sound.sfx('level'); burst(x, y - sz * 0.5, '#ffe680', 30); floatText(x, y - sz * 1.2, `Уровень ${m.lvl}!`, '#ffe680'); addXP(5); }
  save(); showInfo(m);
}
function sell(m) {
  confirmBox(`Продать ${KINDS[m.kind].name} за ${sellPrice(m.kind)} монет? Его партия исчезнет из песни.`, () => {
    collect(m, true); S.coins += sellPrice(m.kind); S.mons = S.mons.filter(q => q !== m); Sound.remove(m.id); rt.delete(m.id);
    if (S.breed && (S.breed.a === m.id || S.breed.b === m.id)) { /* скрещивание идёт и без родителя */ }
    sel = null; closeSheet(); save(); hud(); Sound.sfx('coin');
  });
}
function toggleMute(m) { m.mute = !m.mute; Sound.mute(m.id, !!m.mute); save(); showInfo(m); }

// ---------- скрещивание
const elSet = k => KINDS[k].el.slice().sort().join('+');
function breedResult(a, b) {
  const els = [...new Set([...KINDS[a].el, ...KINDS[b].el])].sort();
  if (a !== b && Math.random() < 0.18) return Math.random() < 0.5 ? a : b; // бывает, что вылупляется копия родителя
  if (els.length === 4) {
    if (Math.random() < 0.3) return 'maestro';
    const tri = KIND_IDS.filter(k => KINDS[k].el.length === 3); return tri[Math.floor(Math.random() * tri.length)];
  }
  const key = els.join('+'), exact = KIND_IDS.filter(k => elSet(k) === key);
  return exact[Math.floor(Math.random() * exact.length)] || a;
}
function startBreed(a, b) {
  const A = S.mons.find(m => m.id === a), B = S.mons.find(m => m.id === b); if (!A || !B) return;
  const kind = breedResult(A.kind, B.kind), dur = BREED_SEC[KINDS[kind].el.length];
  S.breed = { a, b, kind, end: Date.now() + dur * 1000, dur };
  closeSheet(); save(); Sound.sfx('pop'); toast(`${KINDS[A.kind].name} и ${KINDS[B.kind].name} поют дуэтом у Арки…`);
  addXP(4);
}
let hatching = null;
function hatch() {
  const b = S.breed; if (!b || Date.now() < b.end || hatching) return;
  hatching = { t: 0, cracks: 0 }; closeSheet(); Sound.sfx('tap');
}
function hatchStep(dt) {
  if (!hatching) return; hatching.t += dt;
  const c = Math.floor(hatching.t / 0.32); if (c > hatching.cracks && c <= 3) { hatching.cracks = c; Sound.sfx('tap'); }
  if (hatching.t > 1.25) { hatching = null; finishHatch(); }
}
function finishHatch() {
  const b = S.breed; if (!b) return; S.breed = null;
  confetti(ARCH.x, ARCH.y - 50, 60); burst(ARCH.x, ARCH.y - 40, '#fff8c0', 20);
  const fresh = !S.found[b.kind]; S.found[b.kind] = 1; if (fresh) addXP(25);
  Sound.sfx('hatch'); burst(ARCH.x, ARCH.y - 40, KINDS[b.kind].col, 30);
  showNew(b.kind, fresh);
  save();
}

// ---------- ввод
function onTap(cx, cy) {
  const [x, y] = toWorld(cx, cy);
  Sound.sfx('tap');
  if (mode) {
    let best = -1, bd = 1e9; SLOT_ORDER.slice(0, slotsOpen()).forEach(i => { const d = Math.hypot((SLOTS[i][0] - x) / 1.6, SLOTS[i][1] - 20 - y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd < 70) {
      if (mode.type === 'move') { const o = monAt(best); if (!o) moveTo(best); else if (o.id === mode.id) { mode = null; hint(''); } else Sound.sfx('deny'); }
      else if (!monAt(best)) place(best); else Sound.sfx('deny');
      return;
    }
    return;
  }
  // пузыри с монетами
  for (const m of S.mons) { if (Math.floor(m.stored) < Math.max(5, rateOf(m) * 0.75)) continue; const [mx, my] = SLOTS[m.slot], sz = monSize(m), by = my - sz * (KINDS[m.kind].hover ? 1.35 : 1.18) - 12; if (Math.hypot(x - mx, y - by) < 40) { collect(m); return; } }
  // арка, гнездо, кусты
  if (hatching) return;
  if (Math.abs(x - ARCH.x) < 75 && y > ARCH.y - 170 && y < ARCH.y + 15) { if (S.breed && Date.now() >= S.breed.end) hatch(); else openBreed(); return; }
  if (Math.abs(x - NEST.x) < 62 && y > NEST.y - 80 && y < NEST.y + 15) { openNest(); return; }
  for (let i = 0; i < S.bushes.length; i++) { const [bx, by] = BUSH_POS[i]; if (Math.abs(x - bx) < 50 && y > by - 90 && y < by + 10) { if (S.bushes[i].n >= 1) harvest(i); else toast('Ягоды ещё растут'); return; } }
  // монстры (сначала передние)
  const hit = S.mons.slice().sort((a, b) => SLOTS[b.slot][1] - SLOTS[a.slot][1]).find(m => { const [mx, my] = SLOTS[m.slot], sz = monSize(m), top = my - sz * (KINDS[m.kind].hover ? 1.2 : 1); return Math.abs(x - mx) < sz * 0.45 && y > top && y < my + 12; });
  lookAt = { x, y, until: T + 1.6 };
  if (hit) { sel = hit.id; jumpMon(hit, 300); Sound.sfx('pop'); const [hx, hy] = SLOTS[hit.slot]; for (let i = 0; i < 3; i++) parts.push({ kind: 'heart', x: hx + rand(-20, 20), y: hy - monSize(hit) * 0.9, vx: rand(-25, 25), vy: rand(-70, -40), life: 1, t: 0 }); showInfo(hit); return; }
  sel = null; closeSheet();
}
cv.addEventListener('pointerdown', e => { if (!started) return; onTap(e.clientX, e.clientY); });

// ---------- окна (HTML)
const sheet = $('sheet');
let sheetKind = null;
// малыш из Арки, которого не поставили на остров, уходит в гнездо
function dropNew() { if (sheetKind === 'new' && sheet.dataset.kind) { S.nest.push(sheet.dataset.kind); sheet.dataset.kind = ''; save(); } }
function openSheet(kind, html, cls = '') {
  dropNew(); sheetKind = kind; sheet.className = 'sheet show ' + cls; sheet.innerHTML = `<button class="x" data-a="close">✕</button>${html}`;
}
function closeSheet() { dropNew(); sheet.className = 'sheet'; sheetKind = null; }
const PORTRAIT = {};
function portrait(kind, dark) {
  const key = kind + (dark ? 'd' : ''); if (PORTRAIT[key]) return PORTRAIT[key];
  const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d');
  const sv = g; drawMonster(x, kind, 80, 146, 120, { t: 1, sing: 0.35, blink: 0, look: 0.3, phase: 0 });
  if (dark) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#2a3a5a'; x.fillRect(0, 0, 160, 160); }
  void sv; return (PORTRAIT[key] = c.toDataURL());
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
const elBadges = k => KINDS[k].el.map(e => `<i class="el" style="background:${ELEMENTS[e].col}" title="${ELEMENTS[e].name}">${ELEMENTS[e].icon}</i>`).join('');
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
  const mons = BASE_IDS.map(k => { const K = KINDS[k], lock = S.lvl < (K.need || 1);
    return `<button class="card${lock ? ' lock' : ''}" data-a="buy" data-k="${k}"><img src="${portrait(k)}" alt=""><b>${K.name}</b><span class="els">${elBadges(k)}</span><span class="dim">${lock ? `с ${K.need} уровня` : `+${K.rate} <span class="ic coin sm"></span>/мин`}</span><em><span class="ic coin sm"></span> ${K.price}</em><span class="play" data-a="listen" data-k="${k}">▶</span></button>`; }).join('');
  const nb = S.bushes.length < BUSH_POS.length;
  openSheet('shop', `<h2>Магазин</h2>
    <div class="sec">Монстры <span class="dim">— каждый добавляет в песню свою партию</span></div><div class="cards">${mons}</div>
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
  openSheet('breed', `<h2>Арка скрещивания</h2><div class="dim center">Выбери двух монстров. Стихии родителей смешаются — получится новый вид. Иногда рождается копия родителя.</div>
    <div class="cards">${list}</div><div class="breedbar"><span id="bres">Выбрано: 0 из 2</span><button class="btn green" data-a="breed" id="bgo" disabled>Скрестить</button></div>`);
  sheet.dataset.pick = '';
}
function updateBreedPick() {
  const ids = sheet.dataset.pick ? sheet.dataset.pick.split(',').map(Number) : [];
  for (const b of sheet.querySelectorAll('[data-a="pick"]')) b.classList.toggle('on', ids.includes(+b.dataset.id));
  const go = $('bgo'), res = $('bres');
  if (ids.length === 2) {
    const [A, B] = ids.map(id => S.mons.find(m => m.id === id)), els = [...new Set([...KINDS[A.kind].el, ...KINDS[B.kind].el])];
    const guess = els.length === 4 ? 'легендарный или очень редкий' : RARITY(els.length).toLowerCase();
    res.innerHTML = `${els.map(e => `<i class="el" style="background:${ELEMENTS[e].col}">${ELEMENTS[e].icon}</i>`).join('')} → ${guess} монстр · ${fmtTime(BREED_SEC(Math.min(4, els.length)))}`;
    go.disabled = false;
  } else { res.textContent = `Выбрано: ${ids.length} из 2`; go.disabled = true; }
}
function openNest() {
  sel = null;
  if (!S.nest.length) { toast('Гнездо пустое. Сюда попадают малыши, если на острове нет места'); return; }
  const list = S.nest.map((k, i) => `<button class="card" data-a="nestplace" data-i="${i}"><img src="${portrait(k)}" alt=""><b>${KINDS[k].name}</b><span class="els">${elBadges(k)}</span><em>Поставить</em></button>`).join('');
  openSheet('nest', `<h2>Гнездо</h2><div class="dim center">Малыши ждут свободного места на острове</div><div class="cards">${list}</div>`);
}
function openBook() {
  sel = null; const n = KIND_IDS.filter(k => S.found[k]).length;
  const list = KIND_IDS.map(k => { const K = KINDS[k], f = S.found[k];
    return `<button class="card${f ? '' : ' unknown'}" data-a="${f ? 'listen' : ''}" data-k="${k}"><img src="${portrait(k, !f)}" alt=""><b>${f ? K.name : '???'}</b><span class="els">${elBadges(k)}</span><span class="dim">${f ? RARITY(K.el.length) : K.el.map(e => ELEMENTS[e].name).join(' + ')}</span>${f ? '<span class="play">▶</span>' : ''}</button>`; }).join('');
  openSheet('book', `<h2>Книга монстров <small>${n} из ${KIND_IDS.length}</small></h2><div class="dim center">Нажми на открытого монстра, чтобы послушать его партию. Неизвестных выводи на Арке скрещивания.</div><div class="cards">${list}</div>`);
}
function showNew(kind, fresh) {
  const K = KINDS[kind], room = freeSlots().length > 0;
  openSheet('new', `<div class="newmon"><div class="rays"></div><img class="port big" src="${portrait(kind)}" alt="">
    <h2>${fresh ? 'Новый вид! ' : ''}${K.name}</h2><div class="els">${elBadges(kind)} <span class="dim">${RARITY(K.el.length)}</span></div><div class="dsc">${K.desc}</div>
    <div class="acts">${room ? '<button class="btn green" data-a="newplace">Поставить на остров</button>' : ''}<button class="btn" data-a="newnest">${room ? 'В гнездо' : 'В гнездо (нет места)'}</button></div></div>`, 'center');
  sheet.dataset.kind = kind;
  Sound.preview(K.part);
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
  else if (a === 'move' && m) { closeSheet(); sel = null; mode = { type: 'move', id: m.id }; hint('Нажми на свободное место, куда переставить'); }
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
  else if (a === 'nestplace') { if (!freeSlots().length) { Sound.sfx('deny'); toast('На острове нет места'); return; } const i = +b.dataset.i; closeSheet(); mode = { type: 'place', kind: S.nest[i], from: 'nest', idx: i }; hint(`Куда поставить ${KINDS[S.nest[i]].name}?`); }
  else if (a === 'newplace') { const k = sheet.dataset.kind; sheet.dataset.kind = ''; closeSheet(); mode = { type: 'place', kind: k, from: 'new' }; hint(`Куда поставить ${KINDS[k].name}?`); }
  else if (a === 'newnest') { closeSheet(); toast('Малыш ждёт в гнезде'); }
  else if (a === 'yes') { const cb = confirmCb; confirmCb = null; closeSheet(); if (cb) cb(); }
});

// отмена расстановки
$('bCancel').addEventListener('click', () => { if (mode && mode.from === 'new') S.nest.push(mode.kind); mode = null; hint(''); save(); });
function hint(t) { $('hintbar').textContent = t; $('hintbar').classList.toggle('show', !!t); document.body.classList.toggle('placing', !!mode); }
function banner(t, sub) { const el = $('banner'); el.innerHTML = `${t}<small>${sub || ''}</small>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }

// ---------- подсказки новичку
const TIPS = [
  { id: 'coins', when: () => S.mons.some(m => m.stored >= 5), text: 'Монстры поют и копят монеты. Нажми на пузырь с монеткой над монстром!' },
  { id: 'shop', when: () => S.coins >= 150 && S.mons.length < 4, text: 'Купи ещё монстра в Магазине — у каждого своя партия, и песня станет богаче.' },
  { id: 'feed', when: () => S.berries >= 7 && S.mons.length >= 3 && S.mons.every(m => m.lvl === 1 && !m.feed), text: 'Нажми на монстра и покорми его ягодами — он подрастёт и будет приносить больше монет.' },
  { id: 'breed', when: () => new Set(S.mons.flatMap(m => KINDS[m.kind].el)).size >= 2 && S.mons.length >= 3 && !S.breed && Object.keys(S.found).length <= 4, text: 'Отведи двух монстров разных стихий к Арке скрещивания — так появляются новые виды!' },
];
let tipT = 0;
function tips() {
  if (tipT && Date.now() > tipT) { $('tip').classList.remove('show'); tipT = 0; }
  if (!started || mode || sheetKind || $('tip').classList.contains('show')) return;
  const t = TIPS.find(t => !S.tips[t.id] && t.when()); if (!t) return;
  S.tips[t.id] = 1; $('tipText').textContent = t.text; $('tip').classList.add('show'); tipT = Date.now() + 12000;
}
$('tip').addEventListener('click', () => $('tip').classList.remove('show'));

// ---------- кнопки интерфейса
$('bShop').addEventListener('click', () => { Sound.sfx('tap'); sheetKind === 'shop' ? closeSheet() : openShop(); });
$('bBreed').addEventListener('click', () => { Sound.sfx('tap'); if (S.breed && Date.now() >= S.breed.end) { hatch(); return; } sheetKind === 'breed' ? closeSheet() : openBreed(); });
$('bBook').addEventListener('click', () => { Sound.sfx('tap'); sheetKind === 'book' ? closeSheet() : openBook(); });
$('bCollect').addEventListener('click', () => collectAll());
$('bSound').addEventListener('click', () => { S.music = !S.music; Sound.setOn(S.music); hud(); save(); });

// ---------- запуск
let started = false;
function startGame() {
  if (started) return; started = true;
  Sound.start(); Sound.setOn(S.music !== false);
  for (const m of S.mons) { Sound.add(m.id, KINDS[m.kind].part, panOf(m)); if (m.mute) Sound.mute(m.id, true); }
  $('start').classList.add('gone'); $('hud').classList.add('show');
  try { const d = document.documentElement; if (d.requestFullscreen && !document.fullscreenElement && /Android|Mobi/i.test(navigator.userAgent)) d.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  const got = offline(); if (got > 0) setTimeout(() => toast(`Пока тебя не было, монстры напели ${got} монет — собери их!`), 600);
  hud();
}
$('start').addEventListener('click', startGame);
document.addEventListener('visibilitychange', () => { if (!S) return; if (document.hidden) { save(); Sound.suspend(); } else { Sound.resume(); } });
window.appPause = () => { if (S) save(); Sound.suspend(); };
window.appResume = () => Sound.resume();
// кнопка «Назад» в Android: закрыть окно или отменить расстановку; false — свернуть игру
window.appBack = () => {
  if (sheetKind) { closeSheet(); sel = null; return true; }
  if (mode) { $('bCancel').click(); return true; }
  if ($('tip').classList.contains('show')) { $('tip').classList.remove('show'); return true; }
  return false;
};
window.addEventListener('resize', resize);

S = load();
resize();
hud();
requestAnimationFrame(frame);
