// Данные игры «Гарнизон». Единицы: метры, секунды, патроны — штуки.
// Числа — баланс; правятся здесь, а не в логике.
(function () {
  const START = {
    soldiers: 48,
    civilians: 0,
    spareRifles: 6,      // АК-74 в оружейке сверх выданных
    ammo: 24000,         // 5,45×39
    food: 300,           // суточные пайки
    meds: 20,
    materials: 60,
  };

  const RIFLE = {
    name: 'АК-74',
    burst: 3,            // патронов в очереди
    interval: 0.9,       // с между очередями (прицеливание)
    range: 18,
    nightRange: 9,       // ночью видно только ближних
    nightAccuracy: 0.7,
    towerBonus: 10,      // часовой на вышке с прожектором
    damage: 25,
    accuracyNear: 0.65,  // шанс попасть вплотную
    accuracyFar: 0.25,   // на предельной дальности
    noise: 55,           // радиус, на котором стрельба слышна заражённым
  };

  const SOLDIER = { hp: 100, speed: 3.2, radius: 0.35, sight: 18 };
  const NIGHT_WATCH = 0.3; // доля бойцов на стенах ночью, остальные спят
  const SURVIVOR = { hp: 50, speed: 3.0, radius: 0.33 };

  const ZOMBIES = {
    walker: { name: 'Ходок', hp: 60, speed: 1.3, radius: 0.36, damage: 12, interval: 1.2, sight: 11, wallDamage: 6, color: '#7d8a6a' },
    runner: { name: 'Бегун', hp: 45, speed: 3.6, radius: 0.34, damage: 10, interval: 0.9, sight: 14, wallDamage: 4, color: '#9a8f6a' },
    brute: { name: 'Громила', hp: 220, speed: 1.0, radius: 0.6, damage: 30, interval: 1.6, sight: 10, wallDamage: 25, color: '#6a5a4a' },
  };

  const MARAUDER = {
    name: 'Мародёр', hp: 80, speed: 2.6, radius: 0.35, sight: 16,
    burst: 3, interval: 0.7, range: 15, damage: 18, accuracyNear: 0.55, accuracyFar: 0.2,
    loot: { rifles: 1, ammo: 120 },
  };

  // Районы города. threat — 1..5, zombies — сколько заражённых при первом визите,
  // mix — доли типов, loot — сколько точек добычи и что в них чаще.
  const DISTRICTS = [
    { id: 'outskirts', name: 'Частный сектор', x: 8, y: 62, w: 26, h: 28, threat: 1, zombies: 60,
      mix: { walker: 0.85, runner: 0.15 }, marauders: 0, survivors: [1, 3],
      loot: { points: 7, food: 3, materials: 3, meds: 1 }, about: 'Огороды и дома. Еда, стройматериалы, могут прятаться люди.' },
    { id: 'market', name: 'Рынок', x: 36, y: 60, w: 22, h: 20, threat: 2, zombies: 100,
      mix: { walker: 0.75, runner: 0.25 }, marauders: 4, survivors: [0, 2],
      loot: { points: 8, food: 5, materials: 2, ammo: 1 }, about: 'Много еды. Здесь видели мародёров.' },
    { id: 'school', name: 'Школа №3', x: 8, y: 30, w: 22, h: 26, threat: 2, zombies: 110,
      mix: { walker: 0.8, runner: 0.2 }, marauders: 0, survivors: [2, 5],
      loot: { points: 6, food: 2, meds: 2, materials: 2 }, about: 'Пункт эвакуации. Высокий шанс найти выживших.' },
    { id: 'industrial', name: 'Промзона', x: 62, y: 62, w: 30, h: 28, threat: 2, zombies: 90,
      mix: { walker: 0.7, runner: 0.2, brute: 0.1 }, marauders: 3, survivors: [0, 2],
      loot: { points: 8, materials: 6, ammo: 1, food: 1 }, about: 'Склады и цеха. Много стройматериалов.' },
    { id: 'hospital', name: 'Больница', x: 34, y: 32, w: 24, h: 24, threat: 3, zombies: 170,
      mix: { walker: 0.65, runner: 0.2, brute: 0.15 }, marauders: 0, survivors: [1, 3],
      loot: { points: 8, meds: 6, food: 1, materials: 1 }, about: 'Медикаменты. Заражённых очень много.' },
    { id: 'police', name: 'Отдел полиции', x: 62, y: 34, w: 20, h: 22, threat: 3, zombies: 140,
      mix: { walker: 0.6, runner: 0.3, brute: 0.1 }, marauders: 5, survivors: [0, 2],
      loot: { points: 7, ammo: 4, rifles: 2, meds: 1 }, about: 'Оружейная комната: патроны и автоматы. Мародёры тоже знают.' },
    { id: 'military', name: 'Военкомат', x: 84, y: 30, w: 14, h: 26, threat: 4, zombies: 200,
      mix: { walker: 0.55, runner: 0.3, brute: 0.15 }, marauders: 7, survivors: [0, 2],
      loot: { points: 8, rifles: 4, ammo: 4 }, about: 'Склад вооружения. Опасно: орды и банды.' },
    { id: 'center', name: 'Центр', x: 30, y: 6, w: 44, h: 22, threat: 5, zombies: 320,
      mix: { walker: 0.5, runner: 0.3, brute: 0.2 }, marauders: 6, survivors: [2, 6],
      loot: { points: 12, food: 3, meds: 3, ammo: 3, rifles: 2, materials: 1 }, about: 'Сердце города. Всего много — и заражённых тоже.' },
  ];

  // Что даёт одна точка добычи данного вида: [мин, макс].
  const LOOT_AMOUNT = {
    food: [15, 40],
    meds: [3, 8],
    materials: [8, 20],
    ammo: [300, 900],
    rifles: [1, 2],
  };

  const LOOT_NAMES = { food: 'Еда', meds: 'Медикаменты', materials: 'Материалы', ammo: 'Патроны', rifles: 'АК-74' };

  // Постройки базы. level 0 — нет постройки. cost[i] — материалы на переход на уровень i+1.
  const BUILDINGS = {
    walls: { name: 'Стены', max: 3, start: 1, cost: [40, 80, 160], about: (l) => `Прочность секции: ${wallHp(l)}` },
    towers: { name: 'Вышки', max: 4, start: 2, cost: [30, 30, 50, 70], about: (l) => `Вышек: ${l}. Часовой на вышке стреляет дальше и точнее.` },
    barracks: { name: 'Казарма', max: 4, start: 1, cost: [60, 100, 160, 240], about: (l) => `Мест: ${capacity(l)}` },
    medbay: { name: 'Медпункт', max: 3, start: 1, cost: [40, 80, 140], about: (l) => `Раненые лечатся быстрее: ×${(1 + 0.5 * (l - 1)).toFixed(1)}` },
    garden: { name: 'Огород', max: 3, start: 0, cost: [30, 60, 120], about: (l) => l ? `Каждый гражданский даёт ${gardenYield(l)} пайка в день` : 'Гражданские смогут выращивать еду' },
  };

  function wallHp(level) { return [0, 300, 600, 1000][level]; }
  function capacity(level) { return 40 + level * 12; }
  function gardenYield(level) { return [0, 0.5, 0.8, 1.2][level]; }

  // Орда: угроза растёт каждый день и от шума стрельбы в городе.
  const HORDE = {
    dailyThreat: 9,
    threatPer1000Rounds: 3,
    warnAt: 70,
    attackAt: 100,
    baseSize: 100,
    sizePerDay: 15,
    hpMult: 1.5,
    speedMult: 1.3,
  };

  window.GameData = {
    START, RIFLE, SOLDIER, NIGHT_WATCH, SURVIVOR, ZOMBIES, MARAUDER, DISTRICTS, LOOT_AMOUNT, LOOT_NAMES,
    BUILDINGS, HORDE, wallHp, capacity, gardenYield,
  };
})();
