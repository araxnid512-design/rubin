'use strict';
/* Игровые данные: размеры убежища, отсеки, снаряжение, места для вылазок */
(function () {
  const D = window.D = {};
  D.CW = 220; D.CH = 140; D.COLS = 7; D.ROWS = 6; D.SHAFT = 3; D.TOP = 96; D.FLOOR = 14; D.DAY = 240;
  D.SX = D.SHAFT * D.CW + D.CW / 2;
  D.floorY = r => D.TOP + r * D.CH + D.CH - D.FLOOR;
  D.WORLD_W = D.COLS * D.CW;

  D.RES = { energy: 'Энергия', water: 'Вода', food: 'Еда', scrap: 'Материалы', meds: 'Аптечки' };
  D.STAT = { S: 'Сила', A: 'Ловкость', I: 'Ум' };

  // rate — выработка одного работника со средним навыком в секунду
  D.ROOMS = {
    hatch:     { n: 'Шлюз', d: 'Вход в убежище. Гермодверь сдерживает мертвецов, пока её не выломают.', fixed: true },
    stairs:    { n: 'Лестница', d: 'Спуск на следующий уровень.', cost: 30 },
    living:    { n: 'Жилой отсек', d: 'Койки: +4 места для жильцов за уровень. Здесь отдыхают те, кто без работы.', cost: 45, beds: 4 },
    power:     { n: 'Генератор', d: 'Энергия для всех отсеков. Без неё встаёт работа.', cost: 60, slots: 2, stat: 'S', out: 'energy', rate: 0.1, act: 'valve' },
    water:     { n: 'Водоочистка', d: 'Фильтрует грунтовую воду.', cost: 60, slots: 2, stat: 'A', out: 'water', rate: 0.05, act: 'valve' },
    garden:    { n: 'Теплица', d: 'Грядки под фитолампами дают еду.', cost: 60, slots: 2, stat: 'I', out: 'food', rate: 0.05, act: 'plant' },
    storage:   { n: 'Склад', d: '+80 к запасу энергии, воды и еды за уровень.', cost: 50, cap: 80 },
    infirmary: { n: 'Медпункт', d: 'Делает аптечки и быстрее ставит раненых на ноги.', cost: 90, slots: 1, stat: 'I', out: 'meds', rate: 0.016, act: 'type' },
    workshop:  { n: 'Мастерская', d: 'Оружие, броня и рюкзаки для вылазок, укрепление гермодвери.', cost: 90, slots: 1, stat: 'S', act: 'hammer' },
    radio:     { n: 'Радиоточка', d: 'Созывает выживших и открывает дорогу в руины города.', cost: 120, slots: 1, stat: 'I', act: 'type' }
  };
  D.BUILD = ['living', 'power', 'water', 'garden', 'storage', 'infirmary', 'workshop', 'radio'];
  D.SLOTX = { power: [52, 150], water: [70, 158], garden: [58, 150], infirmary: [128], workshop: [82], radio: [92] };

  D.WEAPONS = [
    { n: 'Кулаки', tool: null, dmg: 7, reach: 34, dur: 0.34, act: 'punch' },
    { n: 'Труба', tool: 'pipe', dmg: 13, reach: 48, dur: 0.44, act: 'swing', cost: 0 },
    { n: 'Мачете', tool: 'machete', dmg: 21, reach: 48, dur: 0.4, act: 'swing', cost: 90 },
    { n: 'Бита с гвоздями', tool: 'bat', dmg: 29, reach: 54, dur: 0.5, act: 'swing', two: true, cost: 150 },
    { n: 'Пожарный топор', tool: 'axe', dmg: 42, reach: 56, dur: 0.58, act: 'swing', two: true, cost: 240 }
  ];
  D.GEAR = {
    weapon: { n: 'Оружие', max: 4, cost: [0, 0, 90, 150, 240], info: l => D.WEAPONS[l].n + ' · урон ' + D.WEAPONS[l].dmg },
    armor:  { n: 'Броня', max: 3, cost: [60, 130, 220], val: [0, 0.15, 0.3, 0.45], info: l => l ? ['', 'Кожанка', 'Бронежилет', 'Тактический'][l] + ' · защита ' + Math.round(D.GEAR.armor.val[l] * 100) + '%' : 'Нет брони' },
    pack:   { n: 'Рюкзак', max: 3, cost: [50, 110, 190], val: [30, 50, 75, 100], info: l => 'Вместимость ' + D.GEAR.pack.val[l] },
    door:   { n: 'Гермодверь', max: 3, cost: [70, 150, 260], val: [150, 280, 450, 650], info: l => 'Прочность ' + D.GEAR.door.val[l] }
  };

  D.MOB = {
    walker: { hp: 38, sp: 42, run: 70, dmg: 11, wind: 0.55, reach: 46, xp: 6, scale: 1 },
    runner: { hp: 24, sp: 70, run: 150, dmg: 8, wind: 0.38, reach: 44, xp: 8, scale: 0.96 },
    brute:  { hp: 120, sp: 32, run: 56, dmg: 26, wind: 0.85, reach: 56, xp: 20, scale: 1.3 }
  };
  // таблица добычи: [ресурс, мин, макс, шанс]
  D.LOOT = {
    car:      [['scrap', 6, 12, 1], ['water', 2, 5, 0.3]],
    crate:    [['scrap', 4, 8, 0.8], ['food', 3, 7, 0.6], ['meds', 1, 1, 0.15]],
    barrel:   [['water', 6, 12, 0.7], ['scrap', 3, 5, 0.4]],
    dumpster: [['scrap', 5, 10, 0.9], ['food', 2, 4, 0.4]],
    locker:   [['meds', 1, 2, 0.4], ['scrap', 3, 6, 0.7], ['food', 3, 5, 0.3]],
    fridge:   [['food', 5, 10, 0.9], ['water', 3, 6, 0.6]],
    corpse:   [['food', 2, 5, 0.6], ['meds', 1, 1, 0.35], ['scrap', 3, 6, 0.6]],
    bush:     [['food', 4, 8, 1]],
    pump:     [['scrap', 4, 8, 0.8]],
    door:     [['scrap', 6, 12, 0.9], ['food', 4, 8, 0.6], ['meds', 1, 2, 0.45], ['water', 3, 7, 0.4]]
  };
  D.LOCS = [
    { id: 'forest', n: 'Лесополоса', d: 'Лес у старой трассы. Ягоды, вода в бочках и немного мертвецов.', len: 2400, danger: 1, time: 110, mobs: 6, mix: [0.85, 0.15, 0] },
    { id: 'gas', n: 'Заправка', d: 'Брошенная АЗС и стоянка машин. Материалы и консервы.', len: 3000, danger: 2, time: 120, mobs: 10, mix: [0.6, 0.3, 0.1] },
    { id: 'city', n: 'Руины города', d: 'Аптеки, склады, шанс найти выживших. Очень опасно.', len: 3600, danger: 3, time: 130, mobs: 15, mix: [0.45, 0.35, 0.2], req: 'radio' }
  ];
  D.NAMES_M = ['Артём', 'Глеб', 'Егор', 'Захар', 'Костя', 'Макс', 'Олег', 'Рома', 'Тимур', 'Фёдор', 'Илья', 'Савва', 'Степан', 'Лёва', 'Миша', 'Дима'];
  D.NAMES_F = ['Вера', 'Дина', 'Жанна', 'Ира', 'Лена', 'Нина', 'Поля', 'Соня', 'Уля', 'Яна', 'Ася', 'Майя', 'Тоня', 'Варя', 'Катя', 'Лида'];

  // цели обучения и развития
  D.GOALS = [
    { t: 'Нажми на жильца, затем на отсек. Займи генератор, воду и теплицу', c: s => ['power', 'water', 'garden'].every(k => s.rooms.some(r => r.k === k && r.w.length)) },
    { t: 'Материалы есть только наверху. Нажми «Вылазка»', c: s => s.trips > 0 },
    { t: 'Нажми «Строить» и возведи новый отсек', c: s => s.rooms.length > 5 },
    { t: 'Построй лестницу вниз и мастерскую', c: s => s.rooms.some(r => r.k === 'workshop') },
    { t: 'Улучши снаряжение в мастерской', c: s => s.gear.weapon > 1 || s.gear.armor > 0 || s.gear.pack > 0 || s.gear.door > 0 },
    { t: 'Построй радиоточку — она откроет руины города', c: s => s.rooms.some(r => r.k === 'radio') },
    { t: 'Отбей набег: жми «Тревога», когда мертвецы ломятся в дверь', c: s => s.raidsWon > 0 },
    { t: 'Доведи число жильцов до 8', c: s => s.ppl.length >= 8 }
  ];
})();
