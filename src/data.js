'use strict';
// ---------- Игровые данные ----------

// Тайлы. ground — пол/земля под объектом, tiles — то, что стоит на клетке.
const T = {
  GRASS: 0, DIRT: 1, ASPHALT: 2, CONCRETE: 3, WOOD: 4, TILE: 5, SIDEWALK: 6, WATER: 7, RUBBLE: 8,
  WALL: 10, BRICK: 11, WWALL: 12, FENCE: 13, DOOR: 14, DOOR_OPEN: 15, DOOR_BROKEN: 16, WINDOW: 17,
  CROP: 20, TREE: 21, BUSH: 22, HAY: 23,
  CRATE: 30, SHELF: 31, LOCKER: 32, FRIDGE: 33, DESK: 34, DRUM: 35, WELL: 36, MEDCAB: 37, FURN: 38, BENCH: 39,
  BLOCK: 40, BLOCKH: 41,
};
const TP = [];
function defT(id, o) {
  TP[id] = Object.assign({ walk: true, cost: 1, block: false, dens: 0, floor: false, wall: false, hide: false, door: false, furn: false, map: '#444' }, o);
}
defT(T.GRASS, { floor: true, map: '#3d4a2c', name: 'Трава' });
defT(T.DIRT, { floor: true, map: '#5b4a33', name: 'Грунт' });
defT(T.ASPHALT, { floor: true, map: '#3b3a37', name: 'Асфальт' });
defT(T.CONCRETE, { floor: true, map: '#5e5c55', name: 'Бетон' });
defT(T.WOOD, { floor: true, map: '#6b4f33', name: 'Доски' });
defT(T.TILE, { floor: true, map: '#7c807a', name: 'Плитка' });
defT(T.SIDEWALK, { floor: true, map: '#686760', name: 'Тротуар' });
defT(T.WATER, { floor: true, cost: 2, map: '#2c3a40', name: 'Лужа' });
defT(T.RUBBLE, { floor: true, cost: 2, map: '#5a554b', name: 'Завал' });
defT(T.WALL, { walk: false, block: true, wall: true, map: '#8b887e' });
defT(T.BRICK, { walk: false, block: true, wall: true, map: '#7e4b37' });
defT(T.WWALL, { walk: false, block: true, wall: true, map: '#6d4c2e' });
defT(T.FENCE, { walk: false, map: '#55503f' });
defT(T.DOOR, { cost: 2, block: true, door: true, map: '#a0763c', name: 'Дверь' });
defT(T.DOOR_OPEN, { door: true, map: '#8a6a3c', name: 'Открытая дверь' });
defT(T.DOOR_BROKEN, { map: '#6a5a40', name: 'Выбитая дверь' });
defT(T.WINDOW, { walk: false, wall: true, map: '#6e8090' });
defT(T.CROP, { dens: 1, hide: true, map: '#8a8a3a', name: 'Посевы' });
defT(T.TREE, { walk: false, block: true, map: '#1f2d18' });
defT(T.BUSH, { cost: 2, dens: 2, hide: true, map: '#2c3d22', name: 'Кусты' });
defT(T.HAY, { walk: false, dens: 2, map: '#b39a52' });
defT(T.CRATE, { walk: false, furn: true, map: '#7a5a34' });
defT(T.SHELF, { walk: false, furn: true, map: '#6b6f74' });
defT(T.LOCKER, { walk: false, furn: true, map: '#58697a' });
defT(T.FRIDGE, { walk: false, furn: true, map: '#c9c8bd' });
defT(T.DESK, { walk: false, furn: true, map: '#7a5b3a' });
defT(T.DRUM, { walk: false, furn: true, map: '#8c3f2a' });
defT(T.WELL, { walk: false, furn: true, map: '#77756c' });
defT(T.MEDCAB, { walk: false, furn: true, map: '#d9d6cc' });
defT(T.FURN, { walk: false, furn: true, map: '#6a5440' });
defT(T.BENCH, { walk: false, furn: true, map: '#6f6a5c' });
defT(T.BLOCK, { walk: false, map: '#575551' });
defT(T.BLOCKH, { walk: false, block: true, map: '#55585a' });

// Ресурсы
const RES = {
  food: { name: 'Еда', w: 1, color: '#d9a441' },
  water: { name: 'Вода', w: 1, color: '#6fa3c8' },
  parts: { name: 'Детали', w: 1.5, color: '#b0a790' },
  meds: { name: 'Медикаменты', w: 0.5, color: '#d8574a' },
  ammo: { name: 'Патроны', w: 0.1, color: '#d6b25e' },
  fuel: { name: 'Топливо', w: 3, color: '#c9733a' },
  tools: { name: 'Инструменты', w: 4, color: '#8fa0ad' },
  seeds: { name: 'Семена', w: 0.3, color: '#8db35a' },
};
const RES_ORDER = ['food', 'water', 'parts', 'meds', 'ammo', 'fuel', 'tools', 'seeds'];

// Оружие
const WEAP = {
  knife: { name: 'Нож', melee: true, ap: 3, dmg: [3, 5], assassin: true, noise: 1 },
  bat: { name: 'Бита', melee: true, ap: 3, dmg: [4, 7], noise: 2 },
  crowbar: { name: 'Монтировка', melee: true, ap: 3, dmg: [4, 6], noise: 2 },
  axe: { name: 'Топор', melee: true, ap: 4, dmg: [6, 9], noise: 2 },
  pistol: { name: 'Пистолет', ap: 4, dmg: [4, 7], range: 10, opt: 4, fall: 0.05, acc: 0.75, noise: 13, snd: 'shot', silenceable: true },
  shotgun: { name: 'Двустволка', ap: 5, dmg: [8, 13], range: 6, opt: 2, fall: 0.08, acc: 0.85, noise: 18, snd: 'shotgun', close: true },
  rifle: { name: 'Карабин', ap: 5, dmg: [7, 10], range: 16, opt: 9, fall: 0.03, acc: 0.82, noise: 20, snd: 'rifle' },
};

// Черты характера
const TRAITS = {
  medic: { name: 'Медик', desc: '3 перевязки на вылазку, лечит соседа, в лазарете лечит вдвое быстрее' },
  strong: { name: 'Силач', desc: '+5 кг к переноске, +1 урон в ближнем бою' },
  marksman: { name: 'Меткий', desc: '+15% к точности стрельбы' },
  quick: { name: 'Шустрый', desc: '+2 очка действий за ход' },
  quiet: { name: 'Тихоня', desc: 'Зомби замечают на 2 клетки позже' },
  mechanic: { name: 'Механик', desc: 'Находит больше деталей, крафт дешевле' },
  hunter: { name: 'Охотник', desc: '+2 клетки обзора' },
  tough: { name: 'Крепкий', desc: '+4 здоровья, вдвое меньше шанс заразиться при укусе' },
};

// Зомби
const ZT = {
  walker: { name: 'Ходок', hp: 7, ap: 4, dmg: [2, 4], acc: 0.6, sight: 6, bite: 0.12, r: 0.36, body: '#6d7a58', skin: '#8d9a72' },
  runner: { name: 'Бегун', hp: 5, ap: 7, dmg: [2, 3], acc: 0.65, sight: 7, bite: 0.1, r: 0.31, body: '#7d6c4c', skin: '#a3906a' },
  screamer: { name: 'Крикун', hp: 5, ap: 4, dmg: [1, 2], acc: 0.5, sight: 8, bite: 0.08, r: 0.33, body: '#7b5a66', skin: '#a07f8a', scream: true },
  brute: { name: 'Громила', hp: 16, ap: 3, dmg: [4, 7], acc: 0.62, sight: 5, bite: 0.08, r: 0.45, body: '#4f5642', skin: '#6c7559' },
};
function pickZType(day, threat) {
  const w = [['walker', 10]];
  if (day >= 3 || threat >= 2) w.push(['runner', 2 + day / 3 + threat]);
  if (day >= 4 || threat >= 3) w.push(['screamer', 1.2 + threat * 0.3]);
  if (day >= 5 || threat >= 4) w.push(['brute', 0.8 + day / 6]);
  let tot = w.reduce((a, b) => a + b[1], 0), v = rnd() * tot;
  for (const [k, p] of w) { if ((v -= p) < 0) return k; }
  return 'walker';
}

// Контейнеры: loot = { ресурс: [шанс, мин, макс] }
const CONT = {
  crate: { name: 'Ящик', tile: T.CRATE, loot: { parts: [0.6, 1, 3], food: [0.2, 1, 2], tools: [0.07, 1, 1] } },
  pallet: { name: 'Поддон', tile: T.CRATE, loot: { parts: [0.55, 1, 2], fuel: [0.08, 1, 1] } },
  shelf: { name: 'Стеллаж', tile: T.SHELF, loot: { food: [0.4, 1, 2], parts: [0.4, 1, 2], water: [0.3, 1, 2] } },
  wshelf: { name: 'Стеллаж склада', tile: T.SHELF, loot: { parts: [0.35, 1, 2], food: [0.12, 1, 2], tools: [0.04, 1, 1] } },
  pantry: { name: 'Кладовка', tile: T.SHELF, loot: { food: [0.9, 2, 4], water: [0.4, 1, 2], seeds: [0.25, 1, 1] } },
  locker: { name: 'Шкафчик', tile: T.LOCKER, loot: { food: [0.3, 1, 1], meds: [0.22, 1, 1], ammo: [0.3, 3, 8], parts: [0.3, 1, 1] } },
  toolbox: { name: 'Верстак', tile: T.BENCH, loot: { parts: [0.85, 1, 3], tools: [0.3, 1, 1] } },
  fridge: { name: 'Холодильник', tile: T.FRIDGE, loot: { food: [0.6, 1, 3], water: [0.6, 1, 3] } },
  desk: { name: 'Стол', tile: T.DESK, loot: { meds: [0.2, 1, 1], ammo: [0.15, 2, 6], parts: [0.25, 1, 1], food: [0.2, 1, 1] } },
  drum: { name: 'Бочка', tile: T.DRUM, loot: { fuel: [0.65, 1, 2] } },
  well: { name: 'Колодец', tile: T.WELL, loot: { water: [1, 3, 5] } },
  medcab: { name: 'Аптечка', tile: T.MEDCAB, loot: { meds: [0.8, 1, 3] } },
  gun: { name: 'Оружейный шкаф', tile: T.LOCKER, loot: { ammo: [1, 6, 14], meds: [0.2, 1, 1] } },
  seeds: { name: 'Мешки', tile: T.CRATE, loot: { seeds: [0.8, 1, 2], food: [0.5, 1, 2] } },
  ambtrunk: { name: 'Укладка скорой', tile: null, loot: { meds: [0.75, 1, 3], water: [0.3, 1, 1] } },
  trunk: { name: 'Багажник', tile: null, loot: { fuel: [0.35, 1, 1], parts: [0.4, 1, 2], food: [0.3, 1, 2], water: [0.3, 1, 1], ammo: [0.1, 2, 6] } },
};

// Постройки убежища
const BUILD = {
  walls: {
    name: 'Укрепления', max: 3,
    cost: [{ parts: 4 }, { parts: 8, tools: 1 }, { parts: 14, tools: 1 }],
    eff: ['Нет защиты: ночные набеги бьют больно', 'Баррикады: меньше набегов', 'Стены с колючкой: набеги реже, потерь меньше', 'Крепость: набеги почти не страшны'],
  },
  infirmary: {
    name: 'Лазарет', max: 3,
    cost: [{ parts: 3, meds: 1 }, { parts: 6, meds: 2 }, { parts: 10, tools: 1 }],
    eff: ['+1 здоровья за ночь', '+3 здоровья за ночь, лечение укуса за 3 медикамента', '+5 здоровья за ночь, лечение укуса за 2', '+7 здоровья за ночь, лечение укуса за 1'],
  },
  garden: {
    name: 'Огород', max: 3,
    cost: [{ parts: 2, seeds: 1 }, { parts: 5, water: 3, seeds: 1 }, { parts: 10, tools: 1 }],
    eff: ['Нет еды из убежища', '+1 еды в день', '+2 еды в день', '+4 еды в день (теплица)'],
  },
  water: {
    name: 'Сбор воды', max: 3,
    cost: [{ parts: 3 }, { parts: 6 }, { parts: 10, tools: 1 }],
    eff: ['Бочка под водостоком: +1 воды', '+2 воды в день', '+3 воды в день', '+5 воды в день (фильтр)'],
  },
  workshop: {
    name: 'Мастерская', max: 3,
    cost: [{ parts: 3 }, { parts: 7, tools: 1 }, { parts: 12, tools: 1 }],
    eff: ['Нет крафта', 'Патроны из деталей, +1 приманка на вылазку', 'Глушители: пистолет почти не шумит; аптечки', 'Оружейник: +1 урон всем'],
  },
  radio: {
    name: 'Радиоточка', max: 2,
    cost: [{ parts: 5, fuel: 1 }, { parts: 10, tools: 1 }],
    eff: ['Тишина в эфире', 'Сигналы выживших (25% в ночь), открыта больница', 'Мощная антенна: выжившие приходят чаще (40%)'],
  },
};
const BUILD_ORDER = ['walls', 'water', 'garden', 'infirmary', 'workshop', 'radio'];

// Локации для вылазок
const LOCS = {
  farm: {
    name: 'Ферма «Рассвет»', short: 'Ферма', w: 64, h: 64, fuel: 0, danger: 1, zombies: 11,
    desc: 'Кукурузные поля, дом фермера, амбар. В посевах легко спрятаться и так же легко нарваться на ползуна.',
    loot: ['food', 'water', 'seeds', 'fuel'],
  },
  suburb: {
    name: 'Посёлок Сосновый', short: 'Посёлок', w: 64, h: 64, fuel: 1, danger: 2, zombies: 17,
    desc: 'Частный сектор, гаражи, брошенные машины. Всего понемногу, улицы простреливаются.',
    loot: ['food', 'meds', 'ammo', 'parts'],
  },
  factory: {
    name: 'Завод «Металлист»', short: 'Завод', w: 60, h: 64, fuel: 2, danger: 3, zombies: 19,
    desc: 'Цех, склад, заводоуправление. Детали, инструменты и топливо. Станки закрывают обзор.',
    loot: ['parts', 'tools', 'fuel', 'ammo'],
  },
  hospital: {
    name: 'Горбольница №2', short: 'Больница', w: 64, h: 60, fuel: 2, danger: 4, zombies: 25, needRadio: 1,
    desc: 'Палаты и длинные коридоры. Больше всего медикаментов в округе и больше всего заражённых.',
    loot: ['meds', 'food', 'water', 'ammo'],
  },
};
const LOC_ORDER = ['farm', 'suburb', 'factory', 'hospital'];

const NAMES = [
  ['Марина', 'f'], ['Гоша', 'm'], ['Лёха', 'm'], ['Семёныч', 'm'], ['Оля', 'f'], ['Тимур', 'm'], ['Вика', 'f'],
  ['Костя', 'm'], ['Нина', 'f'], ['Рустам', 'm'], ['Аня', 'f'], ['Борис', 'm'], ['Света', 'f'], ['Дима', 'm'],
  ['Катя', 'f'], ['Миша', 'm'], ['Зоя', 'f'], ['Павел', 'm'], ['Ира', 'f'], ['Артём', 'm'], ['Галя', 'f'], ['Жека', 'm'],
];
const UNIT_COLORS = ['#e8a62b', '#5fb3c9', '#d9644a', '#a7c957', '#c58fd6', '#e7d27c', '#7fa7e0', '#e08fa0'];

const VICTORY_DAY = 30;
