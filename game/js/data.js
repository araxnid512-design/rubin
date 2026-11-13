'use strict';
/* Игровые данные: оружие, враги, постройки, каталог портала и т.д. */
(function (DW) {
  const D = {};

  /* ---------- Тактическая карта ---------- */
  D.T = 48; // размер клетки в мировых единицах

  D.GROUND = [
    { n: 'Пыль', c: '#6e5b44', walk: true },
    { n: 'Пепел', c: '#4b4642', walk: true },
    { n: 'Сухая земля', c: '#5f4d39', walk: true },
    { n: 'Бетон', c: '#5b5957', walk: true },
    { n: 'Металл', c: '#3d4348', walk: true },
    { n: 'Пещера', c: '#3e352d', walk: true },
    { n: 'Плоть', c: '#4b3034', walk: true },
    { n: 'Кислота', c: '#4f7d22', walk: false },
    { n: 'Щебень', c: '#58524b', walk: true },
    { n: 'Вышка', c: '#7b5a35', walk: true, high: true },
    { n: 'Провал', c: '#121010', walk: false },
    { n: 'Дощатый пол', c: '#6a5038', walk: true }
  ];

  D.OBJ = {
    1: { n: 'Низкая стена', cover: 1, los: false, hp: 5, lift: 0.32, c: '#7d7770' },
    2: { n: 'Стена', cover: 2, los: true, hp: 7, lift: 0.85, c: '#8a7f72' },
    3: { n: 'Валун', cover: 2, los: true, hp: 16, lift: 0.6, c: '#6b625a' },
    4: { n: 'Ящик', cover: 1, los: false, hp: 3, lift: 0.38, c: '#8a6539' },
    5: { n: 'Сухое дерево', cover: 1, los: false, hp: 3, lift: 0.9, c: '#4a3a2c' },
    6: { n: 'Мешки с песком', cover: 1, los: false, hp: 6, lift: 0.32, c: '#a08b62' },
    7: { n: 'Остов машины', cover: 2, los: true, hp: 12, lift: 0.5, c: '#6a4b35' },
    8: { n: 'Обломки', cover: 2, los: true, hp: 8, lift: 0.7, c: '#77706a' },
    9: { n: 'Бочка', cover: 1, los: false, hp: 2, lift: 0.42, c: '#6b3d2a' },
    10: { n: 'Палатка', cover: 2, los: true, hp: 5, lift: 0.6, c: '#6d6a48' },
    11: { n: 'Переборка', cover: 2, los: true, hp: 18, lift: 0.85, c: '#5a646b' },
    12: { n: 'Агрегат', cover: 1, los: false, hp: 6, lift: 0.42, c: '#4c5a62' },
    13: { n: 'Частокол', cover: 1, los: false, hp: 7, lift: 0.5, c: '#7a5a38' },
    14: { n: 'Каменная стена', cover: 2, los: true, hp: 12, lift: 0.75, c: '#7e786e' },
    15: { n: 'Портал', cover: 2, los: true, hp: 99999, lift: 1.1, c: '#3a4a55' },
    16: { n: 'Хитиновый нарост', cover: 1, los: false, hp: 5, lift: 0.5, c: '#5d3a40' },
    17: { n: 'Постройка', cover: 2, los: true, hp: 20, lift: 0.85, c: '#6e5a44' },
    18: { n: 'Контейнер', cover: 2, los: true, hp: 14, lift: 0.62, c: '#7a3a26' },
    19: { n: 'Поваленный ствол', cover: 1, los: false, hp: 4, lift: 0.26, c: '#4a3a2c' },
    20: { n: 'Кристальный нарост', cover: 1, los: false, hp: 5, lift: 0.7, c: '#5fd4e6' },
    21: { n: 'Мебель', cover: 1, los: false, hp: 4, lift: 0.4, c: '#7a5a3a' },
    22: { n: 'Шкаф', cover: 2, los: true, hp: 7, lift: 0.85, c: '#6a4a2e' },
    23: { n: 'Техника', cover: 2, los: true, hp: 30, lift: 0.75, c: '#5a5040' }
  };
  /* Техника на 2–3 клетки (модели — tools/art3d/manifest.js, набор p_veh): [имя, длина в клетках] */
  D.VEHICLES = [['Сгоревший ВАЗ', 2], ['«Волга»', 2], ['«Нива»', 2], ['УАЗ', 2], ['Автобус ПАЗ', 3], ['«Урал»', 3], ['БТР-80', 3]];

  /* ---------- Оружие ---------- */
  D.WEAPONS = {
    ppsh: { n: 'Пистолет-пулемёт ППШ', s: 'ППШ', dmg: [3, 5], clip: 5, ammo: 4, crit: 10, aimMod: 0, range: 'smg', snd: 'smg', tier: 0, desc: 'Старый ППШ с диском на 71 патрон. Злой вблизи, на дальней дистанции мажет. Тратит много патронов.' },
    ak: { n: 'Автомат АК', s: 'АК', dmg: [3, 5], clip: 4, ammo: 3, crit: 10, aimMod: 0, range: 'rifle', snd: 'rifle', tier: 0, desc: 'Надёжный автомат с армейских складов Института. Точнее и экономнее ППШ, хорош на средней дистанции.' },
    shotgun: { n: 'Дробовик', s: 'Дробовик', dmg: [4, 7], clip: 3, ammo: 2, crit: 20, aimMod: 0, range: 'shotgun', snd: 'shotgun', tier: 1, desc: 'Страшен вблизи, бесполезен издалека.' },
    sniper: { n: 'Снайперская винтовка', s: 'СВД', dmg: [5, 7], clip: 3, ammo: 1, crit: 25, aimMod: 0, range: 'sniper', snd: 'sniper', tier: 1, sight: 2, desc: 'Точна вдали, неудобна вблизи. +2 к обзору.' },
    lmg: { n: 'Пулемёт ПКМ', s: 'ПКМ', dmg: [4, 6], clip: 3, ammo: 6, crit: 5, aimMod: -5, range: 'rifle', snd: 'lmg', tier: 1, desc: 'Высокий урон, но жрёт патроны.' },
    ak2: { n: 'Штурмовая винтовка', s: 'Штурм.', dmg: [4, 6], clip: 4, ammo: 3, crit: 15, aimMod: 5, range: 'rifle', snd: 'rifle', tier: 2, desc: 'Улучшенный автомат с коллиматором.' },
    hsniper: { n: 'Крупнокалиберная винтовка', s: 'КСВК', dmg: [7, 10], clip: 2, ammo: 1, crit: 30, aimMod: 0, range: 'sniper', snd: 'sniper', tier: 3, sight: 3, desc: 'Пробивает любого мутанта. +3 к обзору.' },
    hlmg: { n: 'Тяжёлый пулемёт', s: 'Корд', dmg: [6, 8], clip: 3, ammo: 6, crit: 10, aimMod: -5, range: 'rifle', snd: 'lmg', tier: 3, desc: 'Огневая мощь взвода в одних руках.' },
    /* только у врагов/турелей */
    spit: { n: 'Кислотный плевок', dmg: [2, 4], clip: 99, ammo: 0, crit: 5, aimMod: 0, range: 'spit', snd: 'spit', pierce: true, enemy: true },
    beam: { n: 'Луч стража', dmg: [4, 6], clip: 3, ammo: 0, crit: 10, aimMod: 0, range: 'rifle', snd: 'beam', enemy: true },
    turret: { n: 'Турель', dmg: [3, 5], clip: 99, ammo: 0, crit: 10, aimMod: 0, range: 'rifle', snd: 'rifle', enemy: true }
  };
  D.PLAYER_WEAPONS = ['ppsh', 'ak', 'shotgun', 'sniper', 'lmg', 'ak2', 'hsniper', 'hlmg'];
  for (const k in D.WEAPONS) D.WEAPONS[k].id = k;

  D.rangeMod = function (r, d) {
    switch (r) {
      case 'rifle': return d <= 2.5 ? 10 : (d <= 9 ? 0 : -Math.round((d - 9) * 4));
      case 'smg': return d <= 2.5 ? 20 : (d <= 5.5 ? 10 : (d <= 8 ? 0 : -Math.round((d - 8) * 7)));
      case 'shotgun': return d <= 2.5 ? 30 : (d <= 4.5 ? 15 : (d <= 6.5 ? 0 : -Math.round((d - 6.5) * 10)));
      case 'sniper': return d <= 2.5 ? -30 : (d <= 5.5 ? -10 : 10);
      case 'spit': return d <= 4.5 ? 10 : (d <= 7.5 ? 0 : -Math.round((d - 7.5) * 10));
      default: return 0;
    }
  };

  /* ---------- Броня ---------- */
  D.ARMORS = {
    robe: { n: 'Тюремная роба', armor: 0, hp: 0, mob: 0, tier: 0, color: '#c8691c', desc: 'Оранжевая роба. Не защищает.' },
    vest: { n: 'Бронежилет', armor: 1, hp: 2, mob: 0, tier: 1, color: '#5d6440', desc: '+1 броня, +2 ОЗ.' },
    heavy: { n: 'Тяжёлый бронекостюм', armor: 2, hp: 4, mob: -1, tier: 2, color: '#454b50', desc: '+2 броня, +4 ОЗ, −1 подвижность.' },
    exo: { n: 'Трофейный экзоскелет', armor: 2, hp: 6, mob: 1, tier: 3, color: '#2f4552', desc: '+2 броня, +6 ОЗ, +1 подвижность.' }
  };
  D.PLAYER_ARMORS = ['robe', 'vest', 'heavy', 'exo'];

  /* ---------- Классы и способности ---------- */
  D.CLASSES = {
    leader: { n: 'Лидер', ab: 'order', color: '#e3a33b' },
    heavy: { n: 'Пулемётчик', ab: 'suppress', color: '#c0504d' },
    assault: { n: 'Штурмовик', ab: 'rush', color: '#d9824a' },
    sniper: { n: 'Снайпер', ab: 'aimed', color: '#6fa8dc' },
    medic: { n: 'Медик', ab: 'heal', color: '#7fb069' },
    rifleman: { n: 'Стрелок', ab: 'double', color: '#b4a7d6' }
  };
  D.ABIL = {
    order: { n: 'Приказ', desc: 'Боец в поле зрения получает +1 ОД. Стоит 1 ОД. Перезарядка 3 хода.', cd: 3, ap: 1 },
    suppress: { n: 'Подавление', desc: 'Враг получает −40 к меткости в свой ход. Тратит два выстрела патронов. Завершает ход. Перезарядка 2.', cd: 2, ap: 1 },
    rush: { n: 'Рывок', desc: '+1 ОД в этом ходу (можно пробежать и выстрелить). Перезарядка 3.', cd: 3, ap: 0 },
    aimed: { n: 'Прицельный выстрел', desc: '+20 к меткости и +25 к шансу крита. Нужны 2 ОД. Перезарядка 2.', cd: 2, ap: 2 },
    heal: { n: 'Полевая медицина', desc: 'Лечит себя или соседнего бойца на 5 ОЗ без аптечки. 3 заряда за бой.', charges: 3, ap: 1 },
    double: { n: 'Двойной выстрел', desc: 'Два выстрела по цели с −15 к меткости. Нужны 2 ОД. Перезарядка 3.', cd: 3, ap: 2 }
  };

  D.RANKS = [
    { n: 'Новичок', xp: 0 },
    { n: 'Боец', xp: 5 },
    { n: 'Бывалый', xp: 12 },
    { n: 'Ветеран', xp: 22 },
    { n: 'Легенда', xp: 36 }
  ];

  /* Стартовый отряд. Крут и Мальборо — из книги «Мёртвый мир. Форт Крут»; остальные клички можно поменять здесь. */
  D.START_SQUAD = [
    { name: 'Крут', trait: 'authority', cls: 'leader', hp: 10, aim: 72, mob: 6, look: { glasses: false, style: 'buzz', hair: '#2b2118', beard: 'stubble', scar: 1, eyes: '#2f4a6a', skin: '#d4a582', brow: -2, jaw: 1.05 } },
    { name: 'Мальборо', trait: 'calm', cls: 'heavy', hp: 11, aim: 64, mob: 5, look: { glasses: false, style: 'short', hair: '#8a7a6a', beard: 'mustache', scar: 0, skin: '#e0b896', eyes: '#5a6a7a', jaw: 1.1 } },
    { name: 'Сыч', trait: 'sharp', cls: 'sniper', hp: 8, aim: 76, mob: 6, look: { glasses: false, style: 'beanie', cap: '#3a3a3a', hair: '#1a1a1a', beard: 'none', scar: 0, skin: '#c99a74', eyes: '#3a5a3a', brow: 3, jaw: 0.92 } },
    { name: 'Док', trait: 'lucky', cls: 'medic', hp: 9, aim: 62, mob: 6, look: { style: 'bald', glasses: true, beard: 'beard', hair: '#c9c2b5', skin: '#e0b896', scar: 0, jaw: 1 } },
    { name: 'Бугай', trait: 'tough', cls: 'assault', hp: 11, aim: 63, mob: 6, look: { glasses: false, style: 'bald', beard: 'beard', hair: '#5a4030', skin: '#a87754', jaw: 1.15, scar: 2, eyes: '#4a3426' } },
    { name: 'Тихий', trait: 'quick', cls: 'rifleman', hp: 9, aim: 68, mob: 6, look: { glasses: false, style: 'long', hair: '#2b2118', beard: 'none', skin: '#d4a582', scar: 0, eyes: '#4a3426', jaw: 0.95 } }
  ];
  D.NAMES = ['Гвоздь', 'Кастет', 'Сиплый', 'Ржавый', 'Хмурый', 'Цыган', 'Штырь', 'Монах', 'Борзый', 'Седой',
    'Филин', 'Грек', 'Лом', 'Клык', 'Барон', 'Рябой', 'Валет', 'Кот', 'Шило', 'Пепел', 'Сапёр', 'Жила',
    'Гриф', 'Карась', 'Дрозд', 'Малой', 'Спица', 'Тунгус', 'Ворон', 'Шмель', 'Батя', 'Крот', 'Фикса', 'Дьяк'];
  D.SKINS = ['#e0b896', '#c99a74', '#a87754', '#d4a582', '#8a5c3c'];
  D.HAIRS = ['#2b2118', '#5a4030', '#8a7a6a', '#1a1a1a', '#a0522d', '#c9c2b5'];

  /* ---------- Враги ---------- */
  D.ENEMIES = {
    scav: { n: 'Падальщик', hp: 5, aim: 72, mob: 7, def: 10, armor: 0, melee: true, dmg: [2, 4], xp: 1, loot: { gems: [0, 2] }, sight: 9, beast: true },
    brute: { n: 'Костолом', hp: 12, aim: 75, mob: 5, def: 0, armor: 1, melee: true, dmg: [4, 7], xp: 3, loot: { gems: [1, 4] }, sight: 8, beast: true },
    spitter: { n: 'Плевун', hp: 6, aim: 65, mob: 5, def: 10, armor: 0, weapon: 'spit', xp: 2, loot: { gems: [1, 3] }, sight: 9, beast: true },
    raider: { n: 'Бандит', hp: 6, aim: 60, mob: 5, def: 0, armor: 0, weapon: 'ak', weapons: ['ak', 'ak', 'ppsh', 'shotgun'], xp: 2, loot: { ammo: [6, 15], gems: [0, 3] }, sight: 9 },
    thug: { n: 'Головорез', hp: 7, aim: 58, mob: 6, def: 0, armor: 0, weapon: 'shotgun', xp: 2, loot: { ammo: [4, 10], gems: [0, 2], food: [0, 2] }, sight: 9 },
    marksman: { n: 'Стрелок банды', hp: 5, aim: 72, mob: 5, def: 0, armor: 0, weapon: 'sniper', weapons: ['sniper', 'sniper', 'lmg'], xp: 3, loot: { ammo: [4, 10], gems: [1, 4] }, sight: 11 },
    boss: { n: 'Главарь', hp: 14, aim: 68, mob: 5, def: 0, armor: 1, weapon: 'ak2', weapons: ['ak2', 'lmg'], xp: 6, loot: { gems: [10, 18], ammo: [20, 35] }, sight: 10, drop: 'ak2' },
    guardian: { n: 'Страж бункера', hp: 10, aim: 68, mob: 4, def: 0, armor: 2, weapon: 'beam', xp: 4, loot: { gems: [3, 6], materials: [1, 3] }, sight: 10, mech: true },
    alpha: { n: 'Вожак', hp: 18, aim: 78, mob: 7, def: 5, armor: 1, melee: true, dmg: [5, 8], xp: 6, loot: { gems: [6, 12] }, sight: 10, beast: true },
    queen: { n: 'Матка', hp: 36, aim: 80, mob: 4, def: 0, armor: 2, melee: true, dmg: [6, 9], xp: 15, loot: { gems: [40, 60] }, sight: 10, beast: true, boss: true, spawner: true }
  };

  /* ---------- Глобальная карта ---------- */
  D.NODE_TYPES = {
    landing: { n: 'Точка высадки', color: '#5fd4e6', map: 'landing', desc: 'Место, куда Портал выбросил отряд. Сюда приходят грузы Института, если нет другого маяка.' },
    ruins: { n: 'Руины', color: '#b8a58a', map: 'ruins', desc: 'Развалины прежней цивилизации. Стройматериалы, припасы и немного кристаллов.' },
    vein: { n: 'Кристальная жила', color: '#5fd4e6', map: 'vein', desc: 'Выход драгоценных кристаллов. Богатая добыча — но мутанты тоже их чуют.' },
    camp: { n: 'Лагерь банды', color: '#d9824a', map: 'camp', desc: 'Лагерь другой банды заключённых. Оружие, патроны и драгоценности — если отобрать.' },
    lair: { n: 'Логово мутантов', color: '#c0504d', map: 'lair', desc: 'Логово мутантов. Уничтожение снижает угрозу набегов и открывает путь к Гнезду.' },
    site: { n: 'Укрытие', color: '#7fb069', map: 'site', desc: 'Удобное для обороны место. После зачистки здесь можно основать базу.' },
    vault: { n: 'Древний бункер', color: '#6fa8dc', map: 'vault', desc: 'Запечатанное убежище древних. Охраняется механическими стражами. Внутри — ценности.' },
    nest: { n: 'Гнездо', color: '#a33a5a', map: 'nest', desc: 'Сердце мёртвого мира, откуда приходят мутанты. Убейте Матку — и мир станет вашим.' }
  };
  D.MAP_NAMES = { factory: 'Заброшенный завод', forest: 'Мёртвый лес', crystalcave: 'Кристальные пещеры', swamp: 'Кислотное болото' };
  D.NODE_NAMES = {
    ruins: ['Мёртвый город', 'Ржавый мост', 'Руины станции', 'Обвалившийся завод', 'Пустой квартал', 'Старая насосная',
      'Разбитая трасса', 'Сгоревший посёлок', 'Каменный лабиринт', 'Заброшенная шахта', 'Серые склады', 'Кладбище машин'],
    vein: ['Синяя жила', 'Сияющий овраг', 'Кристальный разлом', 'Хрустальная балка', 'Голубые копи', 'Звонкий склон', 'Жила Отчаяния'],
    camp: ['Лагерь «Шакалов»', 'Стоянка Крюка', 'Логово «Черепов»', 'Форт «Беспредел»', 'Табор Хромого'],
    lair: ['Костяная яма', 'Гнилая балка', 'Нора Падальщиков', 'Чёрные пещеры', 'Вонючий распадок'],
    site: ['Старый форт', 'Скала Отшельника', 'Водонапорная башня', 'Бетонный бастион', 'Холм Висельника'],
    vault: ['Древний бункер'],
    nest: ['Гнездо'],
    landing: ['Точка высадки']
  };

  /* ---------- База ---------- */
  D.BUILDINGS = {
    walls: { n: 'Укрепления', levels: ['Частокол', 'Каменная стена'], max: 2, cost: [{ materials: 10 }, { materials: 22 }], desc: 'Укрытия по периметру базы в обороне. Защищают базу в ваше отсутствие.' },
    tower: { n: 'Сторожевая вышка', max: 1, cost: [{ materials: 12 }], desc: 'Предупреждает о набеге за 2 дня и открывает окрестности. В обороне — позиция с +15 к меткости.' },
    infirmary: { n: 'Лазарет', max: 1, cost: [{ materials: 14, meds: 2 }], desc: 'Бойцы на базе восстанавливают 4 ОЗ в день вместо 2.' },
    workshop: { n: 'Мастерская', max: 1, cost: [{ materials: 15 }], desc: 'Каждый день превращает 1 стройматериал в 15 патронов.' },
    farm: { n: 'Теплица', max: 1, cost: [{ materials: 10, food: 5 }], desc: '+5 провизии каждый день.' },
    beacon: { n: 'Маяк портала', max: 1, cost: [{ materials: 8, gems: 10 }], desc: 'Грузы Института можно заказывать прямо на базу.' },
    turret: { n: 'Автотурель', max: 2, cost: [{ materials: 14, gems: 25 }, { materials: 14, gems: 25 }], tier: 2, desc: 'Стреляет по врагам при обороне базы и укрепляет её защиту.' }
  };

  /* ---------- Каталог портала ---------- */
  D.CATALOG = [
    { id: 'ammo', n: 'Патроны', q: '×60', give: { ammo: 60 }, price: 10, tier: 0, icon: 'ammo' },
    { id: 'food', n: 'Провизия', q: '×12', give: { food: 12 }, price: 10, tier: 0, icon: 'food' },
    { id: 'meds', n: 'Аптечки', q: '×2', give: { meds: 2 }, price: 12, tier: 0, icon: 'meds' },
    { id: 'gren', n: 'Гранаты', q: '×2', give: { grenades: 2 }, price: 15, tier: 0, icon: 'grenade' },
    { id: 'mat', n: 'Стройматериалы', q: '×10', give: { materials: 10 }, price: 15, tier: 0, icon: 'materials' },
    { id: 'ppsh', n: 'ППШ', q: '', give: { weapon: 'ppsh' }, price: 8, tier: 0, icon: 'gun' },
    { id: 'ak', n: 'Автомат АК', q: '', give: { weapon: 'ak' }, price: 15, tier: 0, icon: 'gun' },
    { id: 'recruit', n: 'Заключённый', q: 'новобранец', give: { recruit: 0 }, price: 35, tier: 0, icon: 'man' },
    { id: 'shotgun', n: 'Дробовик', q: '', give: { weapon: 'shotgun' }, price: 25, tier: 1, icon: 'gun' },
    { id: 'sniper', n: 'Снайперская винтовка', q: '', give: { weapon: 'sniper' }, price: 40, tier: 1, icon: 'gun' },
    { id: 'lmg', n: 'Пулемёт ПКМ', q: '', give: { weapon: 'lmg' }, price: 45, tier: 1, icon: 'gun' },
    { id: 'vest', n: 'Бронежилет', q: '', give: { armor: 'vest' }, price: 30, tier: 1, icon: 'armor' },
    { id: 'ak2', n: 'Штурмовая винтовка', q: '', give: { weapon: 'ak2' }, price: 55, tier: 2, icon: 'gun' },
    { id: 'heavy', n: 'Тяжёлый бронекостюм', q: '', give: { armor: 'heavy' }, price: 65, tier: 2, icon: 'armor' },
    { id: 'rockets', n: 'Ракеты РПГ', q: '×2', give: { rockets: 2 }, price: 35, tier: 2, icon: 'rocket' },
    { id: 'veteran', n: 'Опытный боец', q: 'бывалый', give: { recruit: 2 }, price: 90, tier: 2, icon: 'man' },
    { id: 'hsniper', n: 'Крупнокалиберная винтовка', q: '', give: { weapon: 'hsniper' }, price: 90, tier: 3, icon: 'gun' },
    { id: 'hlmg', n: 'Тяжёлый пулемёт', q: '', give: { weapon: 'hlmg' }, price: 95, tier: 3, icon: 'gun' },
    { id: 'exo', n: 'Экзоскелет', q: '', give: { armor: 'exo' }, price: 120, tier: 3, icon: 'armor' }
  ];
  D.TIERS = [
    { need: 0, n: 'Испытательный срок' },
    { need: 60, n: 'Сотрудничество' },
    { need: 200, n: 'Доверие' },
    { need: 450, n: 'Особый статус' }
  ];
  D.GOAL = 1000; // драгоценностей сдать для «вольной»

  D.RES_NAMES = { gems: 'Драгоценности', food: 'Провизия', ammo: 'Патроны', meds: 'Аптечки', grenades: 'Гранаты', rockets: 'Ракеты', materials: 'Стройматериалы' };

  /* ---------- SVG-иконки ---------- */
  const I = {};
  I.gems = '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#5fd4e6"/><path d="M2 9h20M12 21L8 9l4-6 4 6z" stroke="#1f6f7d" stroke-width="1.3" fill="none"/></svg>';
  I.food = '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" fill="#b98a4a"/><rect x="5" y="8" width="14" height="7" fill="#8a3b2a"/><rect x="5" y="3" width="14" height="2" fill="#d8c3a0"/></svg>';
  I.ammo = '<svg viewBox="0 0 24 24"><path d="M4 21V10l2.5-6L9 10v11zM10.5 21V10L13 4l2.5 6v11zM17 21V10l2.5-6L22 10v11z" fill="#d6b04a"/><path d="M4 17h5M10.5 17h5M17 17h5" stroke="#8a6a20" stroke-width="1.5"/></svg>';
  I.meds = '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="3" fill="#ece6dc"/><path d="M9.5 7h5v3.5H18v5h-3.5V19h-5v-3.5H6v-5h3.5z" fill="#d9534f"/></svg>';
  I.grenades = '<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="7.5" fill="#5f6b3a"/><path d="M5 12h12M5 16h12M11 7v14" stroke="#3f4a24" stroke-width="1.2"/><rect x="9" y="2.5" width="5" height="4.5" fill="#9a9a9a"/><path d="M14 4h5v3" stroke="#bbb" stroke-width="1.5" fill="none"/></svg>';
  I.grenade = I.grenades;
  I.materials = '<svg viewBox="0 0 24 24"><rect x="2" y="14" width="9.5" height="7" fill="#8a6a46"/><rect x="12.5" y="14" width="9.5" height="7" fill="#7a5c3c"/><rect x="7" y="6" width="10" height="7" fill="#a07b50"/><path d="M2 17.5h9.5M12.5 17.5H22M7 9.5h10" stroke="#5a4028" stroke-width="1"/></svg>';
  I.rockets = '<svg viewBox="0 0 24 24"><path d="M3 21l3-1 11-11 3-6-6 3L3 17z" fill="#8a4a3a"/><path d="M14 4l6-1-1 6z" fill="#cfcfcf"/><path d="M3 21l2-5 3 3z" fill="#e3a33b"/></svg>';
  I.rocket = I.rockets;
  I.day = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#e3a33b"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8L7 17M17 7l2.8-2.8" stroke="#e3a33b" stroke-width="2"/></svg>';
  I.portal = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="10" fill="none" stroke="#5fd4e6" stroke-width="2.5"/><ellipse cx="12" cy="12" rx="4" ry="6" fill="#5fd4e6" opacity=".45"/></svg>';
  I.man = '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" fill="#e0b896"/><path d="M4 22c0-6 3.5-9 8-9s8 3 8 9z" fill="#c8691c"/></svg>';
  I.gun = '<svg viewBox="0 0 24 24"><path d="M2 10h15l2-2h3v4h-4l-1 2h-4l-2 5H7l1-5H2z" fill="#9aa0a6"/></svg>';
  I.armor = '<svg viewBox="0 0 24 24"><path d="M7 3l5 2 5-2 4 4-2 4v10H5V11L3 7z" fill="#5d6440"/><path d="M9 9h6v6H9z" fill="#3f4428"/></svg>';
  I.skull = '<svg viewBox="0 0 24 24"><path d="M12 2C7 2 3 5.5 3 10.5c0 3 1.5 5 3.5 6V20h2v2h2v-2h3v2h2v-2h2v-3.5c2-1 3.5-3 3.5-6C21 5.5 17 2 12 2z" fill="#d9534f"/><circle cx="8.5" cy="11" r="2.3" fill="#1a1412"/><circle cx="15.5" cy="11" r="2.3" fill="#1a1412"/></svg>';
  /* иконки действий — цвет через currentColor */
  I.shoot = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1v7M12 16v7M1 12h7M16 12h7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>';
  I.overwatch = '<svg viewBox="0 0 24 24"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.3" fill="currentColor"/></svg>';
  I.reload = '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5v5h-5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
  I.hunker = '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  I.medkit = '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8.5v8M8 12.5h8" stroke="currentColor" stroke-width="2.6"/></svg>';
  I.throwg = '<svg viewBox="0 0 24 24"><circle cx="10" cy="14" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 7.5V4h4v3.5M12 5h6l2 3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  I.rpg = '<svg viewBox="0 0 24 24"><path d="M2 14h13l3-2.5h4v5h-4L15 14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 14v4M10 14v3" stroke="currentColor" stroke-width="2"/></svg>';
  I.evac = '<svg viewBox="0 0 24 24"><path d="M12 21V5M5 11l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4 22h16" stroke="currentColor" stroke-width="2"/></svg>';
  I.endturn = '<svg viewBox="0 0 24 24"><path d="M4 4l11 8-11 8z" fill="currentColor"/><rect x="17" y="4" width="3" height="16" fill="currentColor"/></svg>';
  I.next = '<svg viewBox="0 0 24 24"><path d="M3 12h15M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
  I.menu = '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2.4"/></svg>';
  I.order = '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.5 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.7z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  I.suppress = '<svg viewBox="0 0 24 24"><path d="M2 7h14M2 12h18M2 17h14" stroke="currentColor" stroke-width="2.2"/><path d="M17 4l4 3-4 3M17 14l4 3-4 3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  I.rush = '<svg viewBox="0 0 24 24"><path d="M3 5l7 7-7 7M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
  I.aimed = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6" stroke="currentColor" stroke-width="1.8"/></svg>';
  I.heal = '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v6M9 12h6" stroke="currentColor" stroke-width="2"/></svg>';
  I.double = '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  I.close = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6"/></svg>';
  I.squad = '<svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="3.2" fill="currentColor"/><circle cx="16" cy="7" r="3.2" fill="currentColor"/><path d="M2 20c0-5 2.5-7.5 6-7.5s6 2.5 6 7.5zM12.5 20c.3-3-.6-5.4-2-7 1.6-.8 3.3-.5 5.5-.5 3.5 0 6 2.5 6 7.5z" fill="currentColor"/></svg>';
  I.base = '<svg viewBox="0 0 24 24"><path d="M2 21V10l10-7 10 7v11h-7v-6H9v6z" fill="currentColor"/></svg>';
  I.journal = '<svg viewBox="0 0 24 24"><path d="M5 2h13a2 2 0 0 1 2 2v18H7a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 7h7M9 11h7M9 15h5" stroke="currentColor" stroke-width="2"/></svg>';
  I.wait = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
  I.portalbtn = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="7.5" ry="10" fill="none" stroke="currentColor" stroke-width="2.2"/><ellipse cx="12" cy="12" rx="3" ry="5" fill="currentColor" opacity=".6"/></svg>';
  I.butt = '<svg viewBox="0 0 24 24"><path d="M3 15l9-9 3 3-9 9z" fill="#8a5a2a"/><path d="M12 6l2-2 6 6-2 2z" fill="#5a5c60"/><path d="M15 16l3 3M17 14l3 3M13 18l3 3" stroke="#e3a33b" stroke-width="2" stroke-linecap="round"/></svg>';
  D.ICONS = I;

  /* Черты характера (у каждого бойца одна) */
  D.TRAITS = {
    authority: { n: 'Авторитет', d: 'Бойцы в 5 клетках от него стреляют с +5 к меткости.' },
    calm: { n: 'Курильщик', d: 'Спокоен под огнём: подавление снижает меткость вдвое слабее.' },
    sharp: { n: 'Меткий', d: '+5 к меткости.' },
    tough: { n: 'Живучий', d: '+2 ОЗ.' },
    quick: { n: 'Шустрый', d: '+1 к подвижности.' },
    cold: { n: 'Хладнокровный', d: '+15 к меткости при стрельбе из дозора.' },
    lucky: { n: 'Везучий', d: '+10% к шансу крита.' }
  };
  D.TRAIT_POOL = ['sharp', 'tough', 'quick', 'cold', 'lucky'];
  /* Навыки, выбираемые при повышении */
  D.PERKS = {
    hp: { n: 'Закалка', d: '+2 ОЗ.' },
    aim: { n: 'Глаз-алмаз', d: '+5 к меткости.' },
    mob: { n: 'Длинные ноги', d: '+1 к подвижности.' },
    crit: { n: 'Слабые места', d: '+12% к шансу крита.' },
    dig: { n: 'Окопник', d: '+10 к уклонению, когда боец в укрытии.' },
    clip: { n: 'Запасной диск', d: '+1 выстрел в магазине.' },
    medic: { n: 'Фельдшер', d: 'Аптечки и помощь лечат на 2 ОЗ больше.' },
    ow: { n: 'Глаз дозорного', d: '+10 к меткости в дозоре, нет штрафа реакции.' }
  };
  D.icon = function (name, cls) {
    return '<span class="ico' + (cls ? ' ' + cls : '') + '">' + (I[name] || '') + '</span>';
  };

  DW.D = D;
})(window.DW);
