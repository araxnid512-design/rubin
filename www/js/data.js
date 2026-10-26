// Игровые данные. Ссылки «LORE: …» ведут на разделы LORE.md.
// Числа (здоровье, урон, скорость, шансы) — баланс, в каноне их нет.
// Единицы: метры, секунды.
(function () {
  // kind: food | water | heal | material | weapon | drink
  const ITEMS = {
    canned: { name: 'Тушёнка', short: 'Туш', kind: 'food', food: 35, stack: 5, color: '#9a8f7a' },
    rusk: { name: 'Сухари', short: 'Сух', kind: 'food', food: 15, stack: 10, color: '#c2a061' },
    water: { name: 'Вода', short: 'Вода', kind: 'water', water: 40, stack: 5, color: '#5b8fb0' },
    bandage: { name: 'Бинт', short: 'Бинт', kind: 'heal', heal: 15, stack: 10, color: '#e8e2d0' },
    medkit: { name: 'Аптечка', short: 'Апт', kind: 'heal', heal: 50, stack: 5, color: '#c8433a' },
    // LORE: Споран — содержимое спорового мешка заражённых.
    sporan: { name: 'Споран', short: 'Спор', kind: 'material', stack: 20, color: '#7fd36b' },
    // LORE: Живчик — напиток из спорана, разведённого в воде. Эффект в игре условный.
    zhivchik: { name: 'Живчик', short: 'Жив', kind: 'drink', heal: 30, water: 15, stack: 5, color: '#a4e08a' },
    scrap: { name: 'Металлолом', short: 'Мет', kind: 'material', stack: 20, color: '#8a8a8a' },
    tape: { name: 'Изолента', short: 'Изол', kind: 'material', stack: 20, color: '#3a5fa0' },
    parts: { name: 'Оруж. запчасти', short: 'Зап', kind: 'material', stack: 20, color: '#b08850' },

    knife: { name: 'Нож', short: 'Нож', kind: 'weapon', stack: 1, color: '#c0c0c0' },
    crowbar: { name: 'Монтировка', short: 'Монт', kind: 'weapon', stack: 1, color: '#b03030' },
    pm: { name: 'ПМ', short: 'ПМ', kind: 'weapon', stack: 1, color: '#555' },
    akm: { name: 'АКМ', short: 'АКМ', kind: 'weapon', stack: 1, color: '#7a5030' },
  };

  // Оружие без патронов: каждый удар/выстрел тратит 1 единицу прочности.
  // LORE.md → Отступления от канона.
  const WEAPONS = {
    fists: { name: 'Кулаки', type: 'melee', damage: 8, range: 1.0, interval: 0.6, durability: Infinity, noise: 0 },
    knife: { name: 'Нож', type: 'melee', damage: 18, range: 1.2, interval: 0.45, durability: 60, noise: 0,
      repair: { scrap: 1, tape: 1 } },
    crowbar: { name: 'Монтировка', type: 'melee', damage: 28, range: 1.5, interval: 0.75, durability: 80, noise: 3,
      repair: { scrap: 2, tape: 1 } },
    pm: { name: 'ПМ', type: 'ranged', damage: 22, range: 11, interval: 0.45, durability: 40, noise: 18,
      repair: { parts: 1, tape: 1 } },
    akm: { name: 'АКМ', type: 'ranged', damage: 30, range: 16, interval: 0.13, durability: 120, noise: 26,
      repair: { parts: 3, tape: 2, scrap: 2 } },
  };

  // LORE: Заражённые → стадии. Пустыш — по концепту игры, нужен источник.
  // sporans: true — у жёлтой стадии есть споровый мешок (LORE: Споран).
  const ENEMIES = {
    empty: { name: 'Пустыш', hp: 40, speed: 1.6, radius: 0.35, damage: 8, attackInterval: 1.2,
      detect: 7, color: '#8f9488', sporans: false },
    runner: { name: 'Бегун', hp: 55, speed: 4.1, radius: 0.35, damage: 10, attackInterval: 0.9,
      detect: 10, color: '#a39a78', sporans: true },
    lottery: { name: 'Лотерейщик', hp: 110, speed: 3.6, radius: 0.45, damage: 16, attackInterval: 1.0,
      detect: 11, color: '#8a6f55', sporans: true },
    stomper: { name: 'Топтун', hp: 260, speed: 3.0, radius: 0.65, damage: 28, attackInterval: 1.3,
      detect: 12, color: '#6e4a3a', sporans: true },
  };

  // LORE: Споран — обычно 1–2, реже 3, бывает пустой.
  const SPORAN_ROLL = [
    { count: 0, weight: 15 },
    { count: 1, weight: 50 },
    { count: 2, weight: 25 },
    { count: 3, weight: 10 },
  ];

  // Таблицы добычи: [id, шанс 0..1, мин, макс].
  const LOOT = {
    cupboard: [['canned', 0.5, 1, 1], ['rusk', 0.5, 1, 2], ['water', 0.4, 1, 1], ['bandage', 0.4, 1, 2],
      ['tape', 0.3, 1, 1], ['scrap', 0.3, 1, 2], ['knife', 0.08, 1, 1]],
    fridge: [['canned', 0.9, 1, 3], ['water', 0.9, 1, 3], ['rusk', 0.6, 1, 2]],
    counter: [['rusk', 0.7, 1, 3], ['medkit', 0.5, 1, 1], ['tape', 0.4, 1, 2]],
    glovebox: [['tape', 0.5, 1, 2], ['parts', 0.4, 1, 1], ['bandage', 0.3, 1, 1], ['pm', 0.12, 1, 1]],
    bus: [['scrap', 0.8, 1, 3], ['water', 0.7, 1, 2], ['medkit', 0.6, 1, 1], ['crowbar', 1, 1, 1]],
    toolbox: [['scrap', 0.9, 1, 3], ['parts', 0.6, 1, 2], ['tape', 0.7, 1, 2]],
    military: [['akm', 1, 1, 1], ['parts', 1, 2, 3], ['medkit', 0.8, 1, 1]],
  };

  const PLAYER = {
    hp: 100,
    speed: 4.5,
    radius: 0.35,
    foodDecay: 1 / 20,   // единиц сытости в секунду
    waterDecay: 1 / 14,
    starveDamage: 1 / 3, // урон в секунду при нуле сытости или воды
  };

  const INVENTORY_SLOTS = 16;
  const DAY_SECONDS = 360;   // реальных секунд в игровых сутках
  const START_HOUR = 9;

  window.GameData = {
    ITEMS, WEAPONS, ENEMIES, SPORAN_ROLL, LOOT, PLAYER, INVENTORY_SLOTS, DAY_SECONDS, START_HOUR,
  };
})();
