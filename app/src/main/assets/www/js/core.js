'use strict';
/* Ядро: константы, утилиты, данные предметов и рецептов */
const G = window.G = {};
G.TILE = 64;
G.WT = 72;                    // размер мира в клетках
G.WORLD = G.TILE * G.WT;
G.HOME = { tx: 36, ty: 36 };
G.SAVE_KEY = 'rubin_save_v1';

G.rng = function (a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
function h2(ix, iy) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
G.noise = function (x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.sstep = (a, b, x) => { x = G.clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
G.angLerp = function (a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 6.2831853; while (d < -Math.PI) d += 6.2831853;
  return a + d * t;
};

/* ---------- Предметы ---------- */
G.ITEMS = {
  wood:    { n: 'Древесина', d: 'Основа любого строительства.', st: 50 },
  stone:   { n: 'Камень', d: 'Годится для инструментов и очага.', st: 50 },
  fiber:   { n: 'Волокно', d: 'Растительные волокна. Из них вьют верёвки.', st: 50 },
  stick:   { n: 'Палка', d: 'Сухая ветка — рукоять для инструмента.', st: 50 },
  ore:     { n: 'Железная руда', d: 'Плавится в слитки на костре.', st: 30 },
  bar:     { n: 'Железный слиток', d: 'Материал для прочных инструментов.', st: 30 },
  plank:   { n: 'Доска', d: 'Обработанная древесина.', st: 50 },
  rope:    { n: 'Верёвка', d: 'Крепкая плетёная верёвка.', st: 30 },
  cloth:   { n: 'Ткань', d: 'Обрывки ткани. Пригодятся для одежды.', st: 30 },
  hide:    { n: 'Шкура', d: 'Шкура оленя.', st: 20 },
  berries: { n: 'Ягоды', d: 'Немного утоляют голод и жажду.', st: 30, food: 9, water: 5 },
  meat_raw:    { n: 'Сырое мясо', d: 'Лучше пожарить на костре.', st: 20, food: 12, hp: -6 },
  meat_cooked: { n: 'Жареное мясо', d: 'Сытная горячая еда.', st: 20, food: 38, hp: 6 },
  canned:  { n: 'Консервы', d: 'Тушёнка из старых запасов.', st: 10, food: 50 },
  flask_empty: { n: 'Пустая фляга', d: 'Наполни её у воды.', st: 1 },
  flask_full:  { n: 'Фляга с водой', d: 'Чистая вода.', st: 1, water: 50, becomes: 'flask_empty' },
  bandage: { n: 'Бинт', d: 'Восстанавливает здоровье.', st: 10, hp: 35 },
  hatchet: { n: 'Каменный топор', d: 'Быстрее рубит деревья.', st: 1, tool: 'axe', pow: 2, dmg: 9, dur: 60 },
  pickaxe: { n: 'Каменная кирка', d: 'Дробит камень и руду.', st: 1, tool: 'pick', pow: 2, dmg: 8, dur: 60 },
  spear:   { n: 'Копьё', d: 'Простое оружие с хорошей дистанцией.', st: 1, tool: 'weapon', pow: 1, dmg: 16, dur: 50, reach: 16 },
  iron_hatchet: { n: 'Железный топор', d: 'Валит дерево за пару ударов.', st: 1, tool: 'axe', pow: 4, dmg: 14, dur: 160 },
  iron_pickaxe: { n: 'Железная кирка', d: 'Крошит любую породу.', st: 1, tool: 'pick', pow: 4, dmg: 12, dur: 160 },
  machete: { n: 'Мачете', d: 'Тяжёлый клинок. Опасное оружие.', st: 1, tool: 'weapon', pow: 1, dmg: 28, dur: 130, reach: 6 },
  jacket:  { n: 'Куртка из шкур', d: 'Снижает получаемый урон на 30%.', st: 1, armor: 0.3 }
};

/* ---------- Рецепты ---------- */
G.RECIPES = [
  { out: 'hatchet', n: 1, cost: { stick: 2, stone: 3, fiber: 2 } },
  { out: 'pickaxe', n: 1, cost: { stick: 2, stone: 4, fiber: 2 } },
  { out: 'spear', n: 1, cost: { stick: 3, stone: 2, fiber: 2 } },
  { out: 'rope', n: 1, cost: { fiber: 3 } },
  { out: 'bandage', n: 1, cost: { fiber: 4 } },
  { out: 'flask_empty', n: 1, cost: { hide: 1, rope: 1 } },
  { out: 'meat_cooked', n: 1, cost: { meat_raw: 1 }, st: 'campfire' },
  { out: 'bar', n: 1, cost: { ore: 2, wood: 1 }, st: 'campfire' },
  { out: 'plank', n: 1, cost: { wood: 2 }, st: 'workbench' },
  { out: 'iron_hatchet', n: 1, cost: { bar: 2, plank: 1, rope: 1 }, st: 'workbench' },
  { out: 'iron_pickaxe', n: 1, cost: { bar: 3, plank: 1, rope: 1 }, st: 'workbench' },
  { out: 'machete', n: 1, cost: { bar: 3, plank: 1, cloth: 1 }, st: 'workbench' },
  { out: 'jacket', n: 1, cost: { hide: 3, rope: 2, cloth: 2 }, st: 'workbench' }
];
G.STATION_NAME = { campfire: 'костёр', workbench: 'верстак' };

G.BUILD = [
  { k: 'floor', n: 'Пол', cost: { wood: 3 } },
  { k: 'wall', n: 'Стена', cost: { wood: 5 } },
  { k: 'door', n: 'Дверь', cost: { wood: 4, rope: 1 } },
  { k: 'campfire', n: 'Костёр', cost: { wood: 4, stone: 6 } },
  { k: 'chest', n: 'Сундук', cost: { wood: 10 } },
  { k: 'workbench', n: 'Верстак', cost: { wood: 12, stone: 6 } }
];

/* ---------- Инвентарь ---------- */
G.INV_SIZE = 20;
G.Inv = {
  add(inv, id, n, d) {
    const it = G.ITEMS[id];
    if (it.st > 1) {
      for (let i = 0; i < inv.length && n > 0; i++) {
        const s = inv[i];
        if (s && s.id === id && s.n < it.st) { const k = Math.min(n, it.st - s.n); s.n += k; n -= k; }
      }
    }
    for (let i = 0; i < inv.length && n > 0; i++) {
      if (!inv[i]) {
        const k = Math.min(n, it.st);
        inv[i] = { id, n: k };
        if (it.dur) inv[i].d = d === undefined ? it.dur : d;
        n -= k;
      }
    }
    return n; // сколько не влезло
  },
  count(inv, id) { let c = 0; for (const s of inv) if (s && s.id === id) c += s.n; return c; },
  remove(inv, id, n) {
    for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
      const s = inv[i];
      if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) inv[i] = null; }
    }
  },
  has(inv, cost) { for (const id in cost) if (G.Inv.count(inv, id) < cost[id]) return false; return true; },
  pay(inv, cost) { for (const id in cost) G.Inv.remove(inv, id, cost[id]); },
  room(inv, id) {
    const it = G.ITEMS[id]; let r = 0;
    for (const s of inv) { if (!s) r += it.st; else if (s.id === id && it.st > 1) r += it.st - s.n; }
    return r;
  }
};

/* ---------- Звук (синтез, без файлов) ---------- */
(function () {
  let ac = null, nbuf = null;
  G.soundOn = true;
  G.audioInit = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      nbuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  };
  function tone(f, f2, dur, type, vol, delay) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dur, vol, fc) {
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  const S = {
    chop() { burst(0.09, 0.5, 800); tone(150, 90, 0.08, 'square', 0.07); },
    mine() { burst(0.06, 0.45, 3200); tone(1100, 700, 0.05, 'triangle', 0.08); },
    hit() { burst(0.12, 0.5, 420); },
    pick() { tone(620, 980, 0.09, 'sine', 0.12); },
    craft() { tone(520, 540, 0.08, 'triangle', 0.12); tone(780, 800, 0.14, 'triangle', 0.12, 0.09); },
    hurt() { tone(190, 70, 0.22, 'sawtooth', 0.12); },
    eat() { burst(0.07, 0.3, 1400); tone(300, 420, 0.1, 'sine', 0.08, 0.05); },
    lvl() { tone(523, 523, 0.12, 'triangle', 0.12); tone(659, 659, 0.12, 'triangle', 0.12, 0.1); tone(784, 784, 0.25, 'triangle', 0.12, 0.2); },
    deny() { tone(180, 140, 0.12, 'square', 0.06); },
    build() { burst(0.1, 0.45, 600); tone(240, 200, 0.1, 'square', 0.06, 0.04); },
    growl() { tone(95, 60, 0.35, 'sawtooth', 0.07); },
    thunder() { burst(0.3, 0.7, 180); tone(72, 30, 1.6, 'sawtooth', 0.14, 0.04); tone(48, 28, 2.2, 'sine', 0.2, 0.1); },
    step() { burst(0.035, 0.1, 240); },
    bow() { tone(420, 180, 0.12, 'triangle', 0.1); burst(0.05, 0.2, 2400); },
    ui() { tone(700, 760, 0.04, 'sine', 0.06); }
  };
  let rainG = null;
  G.setRain = function (v) {
    if (!ac || ac.state !== 'running') return;
    if (!rainG) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(); rainG = ac.createGain();
      s.buffer = nbuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 1700; rainG.gain.value = 0;
      s.connect(f); f.connect(rainG); rainG.connect(ac.destination); s.start();
    }
    rainG.gain.value = G.soundOn ? v * 0.1 : 0;
  };
  G.sfx = function (n) { if (ac && G.soundOn && ac.state === 'running') { try { S[n](); } catch (e) { } } };
})();
