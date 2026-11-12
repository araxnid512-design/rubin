'use strict';
// ===== Предметы =====
// s — размер стопки, eat — эффект употребления, w — боевые характеристики,
// tool — тип инструмента, dur — прочность, armor — защита, filt — ёмкость фильтра
const ITEMS = {
  wood:   {n:'Древесина', i:'🪵'},
  stone:  {n:'Камень', i:'🪨'},
  fiber:  {n:'Волокно', i:'🌿'},
  scrap:  {n:'Металлолом', i:'🔩'},
  ore:    {n:'Железная руда', i:'🟫'},
  iron:   {n:'Железо', i:'⚙️'},
  coal:   {n:'Уголь', i:'⚫', d:'Основа любого фильтра'},
  cloth:  {n:'Ткань', i:'🧵'},
  rope:   {n:'Верёвка', i:'🪢'},
  rubber: {n:'Резина', i:'🛞'},
  fuel:   {n:'Топливо', i:'⛽'},
  elec:   {n:'Электроника', i:'🔌', d:'Редкий ресурс из руин и военных ящиков'},
  chem:   {n:'Химикаты', i:'🧪', d:'Редкий ресурс'},
  parts:  {n:'Оружейные детали', i:'🔧', d:'Редкий ресурс с военной базы'},
  powder: {n:'Порох', i:'🧨'},
  gland:  {n:'Железа мутанта', i:'🫀', d:'Выпадает из мутантов и плевунов'},
  ruby:   {n:'Рубиновый кристалл', i:'♦️', d:'Редчайший ресурс из Эпицентра. Нужен для реактора'},
  ammo:   {n:'Патроны', i:'🔶', s:60},

  berries:{n:'Ягоды', i:'🫐', s:10, eat:{hunger:8, thirst:4}},
  canned: {n:'Консервы', i:'🥫', s:10, eat:{hunger:40}},
  stew:   {n:'Похлёбка', i:'🍲', s:10, eat:{hunger:65, thirst:20, hp:10}},
  dwater: {n:'Грязная вода', i:'🥤', s:10, eat:{thirst:18, hp:-8}, d:'Пить можно, но вредно. Лучше очистить на кухне'},
  water:  {n:'Чистая вода', i:'💧', s:10, eat:{thirst:45}},
  bandage:{n:'Бинт', i:'🩹', s:10, eat:{hp:25}},
  medkit: {n:'Аптечка', i:'💊', s:5, eat:{hp:75}},

  filter0:{n:'Самодельный фильтр', i:'🍃', s:5, filt:35, d:'Хватает ненадолго'},
  filter: {n:'Фильтр', i:'🫁', s:5, filt:100},
  filter2:{n:'Усиленный фильтр', i:'🧬', s:5, filt:220, d:'Биофильтр из железы мутанта'},

  axe:    {n:'Топор', i:'🪓', dur:40, tool:'axe',  w:{dmg:12, cd:.6, rg:1}},
  pick:   {n:'Кирка', i:'⛏️', dur:40, tool:'pick', w:{dmg:10, cd:.65, rg:1}},
  spear:  {n:'Копьё', i:'🔱', dur:40, w:{dmg:15, cd:.65, rg:1.35}},
  bat:    {n:'Бита с гвоздями', i:'🏏', dur:55, w:{dmg:23, cd:.75, rg:1.05}},
  machete:{n:'Мачете', i:'🔪', dur:90, w:{dmg:32, cd:.5, rg:1.05}},
  pistol: {n:'Пистолет', i:'🔫', dur:140, w:{dmg:38, cd:.42, rg:7, ranged:1}},
  shotgun:{n:'Дробовик', i:'💥', dur:90, w:{dmg:85, cd:.95, rg:5, ranged:1, splash:1}},

  jacket: {n:'Плотная куртка', i:'🧥', armor:.15},
  plate:  {n:'Броня из металлолома', i:'🛡️', armor:.35},
  hazmat: {n:'Костюм химзащиты', i:'🥼', armor:.22, save:.4, d:'Фильтр расходуется на 40% медленнее'},
};
const FISTS = {dmg:7, cd:.45, rg:.95};

// ===== Объекты на локациях =====
// loot: [предмет, мин, макс, шанс]
const NODES = {
  sticks: {n:'Ветки', v:'Собрать', t:.8, loot:[['wood',2,3]]},
  stones: {n:'Камни', v:'Собрать', t:.8, loot:[['stone',2,3]]},
  bush:   {n:'Куст', v:'Обобрать', t:1, solid:1, loot:[['fiber',2,4],['berries',1,2,.35]]},
  berry:  {n:'Ягодный куст', v:'Обобрать', t:1, solid:1, loot:[['berries',2,4],['fiber',1,1,.5]]},
  tree:   {n:'Дерево', v:'Срубить', t:2.2, tool:'axe', solid:1, loot:[['wood',4,6],['fiber',1,2,.3]]},
  rock:   {n:'Валун', v:'Разбить', t:2.2, tool:'pick', solid:1, loot:[['stone',4,6],['ore',1,2,.3]]},
  orev:   {n:'Железная жила', v:'Добыть', t:3, tool:'pick', solid:1, loot:[['ore',3,5],['stone',1,2]]},
  coal:   {n:'Угольный пласт', v:'Добыть', t:2.8, tool:'pick', solid:1, loot:[['coal',3,5]]},
  ruby:   {n:'Рубиновый кристалл', v:'Добыть', t:4.5, tool:'pick', solid:1, loot:[['ruby',1,1]]},
  puddle: {n:'Лужа', v:'Набрать воды', t:1.2, loot:[['dwater',2,3]]},
  scrapp: {n:'Куча хлама', v:'Обыскать', t:1.5, solid:1, loot:[['scrap',2,4],['rubber',1,1,.3],['cloth',1,2,.35]]},
  car:    {n:'Остов машины', v:'Разобрать', t:3, solid:1, loot:[['scrap',3,6],['rubber',1,3],['fuel',1,1,.4],['elec',1,1,.25]]},
  barrel: {n:'Бочка с химикатами', v:'Слить', t:2, solid:1, loot:[['chem',1,3],['fuel',1,1,.3]]},
  crate:  {n:'Ящик', v:'Обыскать', t:1.5, solid:1, table:'crate'},
  milcrate:{n:'Армейский ящик', v:'Вскрыть', t:2.2, solid:1, table:'mil'},
  bag:    {n:'Добыча', v:'Подобрать', t:.35},
};
// таблицы лута: [предмет, вес, мин, макс]
const TABLES = {
  crate: [['canned',3,1,2],['water',3,1,2],['cloth',3,1,3],['bandage',2,1,1],['scrap',2,1,3],['rope',1,1,1],['ammo',1,2,5],['elec',1,1,1],['coal',1,1,2]],
  mil:   [['ammo',4,4,8],['parts',3,1,2],['medkit',1,1,1],['elec',3,1,2],['chem',2,1,2],['canned',2,1,2],['iron',2,1,3],['powder',2,1,2]],
};

// ===== Враги =====
// drop: [предмет, шанс, мин, макс]
const ENEMIES = {
  zombie: {n:'Заражённый', hp:40, dmg:7, sp:1.4, cd:1.4, rg:.9, ag:6, sz:1, body:'#5d6b4a', skin:'#8fa878',
           drop:[['cloth',.35,1,2],['scrap',.15,1,1]]},
  runner: {n:'Бегун', hp:26, dmg:6, sp:3.0, cd:.8, rg:.9, ag:8, sz:.9, body:'#6b5a4a', skin:'#b8b89a',
           drop:[['cloth',.3,1,1],['fiber',.2,1,2]]},
  bloater:{n:'Толстяк', hp:120, dmg:16, sp:1.0, cd:1.5, rg:1, ag:5.5, sz:1.25, wide:1.5, body:'#7a7a3a', skin:'#a8b060', cloud:1,
           drop:[['chem',.6,1,2],['cloth',.4,1,2]]},
  spitter:{n:'Плевун', hp:45, dmg:11, sp:1.7, cd:2.2, rg:6.5, ag:8, sz:1, body:'#5a3f6b', skin:'#a080b8', spit:1,
           drop:[['gland',.5,1,1],['chem',.25,1,1]]},
  mutant: {n:'Мутант', hp:230, dmg:24, sp:2.4, cd:1.3, rg:1.15, ag:7.5, sz:1.5, body:'#6b2d2d', skin:'#a04a4a', spikes:1,
           drop:[['gland',.9,1,2],['elec',.2,1,1]]},
  boss:   {n:'Альфа-мутант', hp:950, dmg:38, sp:2.1, cd:1.4, rg:1.5, ag:9, sz:2.2, body:'#3a1020', skin:'#c02040', spikes:1, boss:1,
           drop:[['ruby',1,2,3],['gland',1,3,4],['parts',1,2,3]]},
};

// ===== Локации =====
const LOCS = {
  yard: {n:'Окрестности бункера', d:'Относительно тихо. Ветки, камни, кусты — всё для первых инструментов.', size:26, tox:.6, danger:1, ground:'grass', fog:[110,130,60,.10], bg:'#12170f',
    loot:'🪵🪨🌿🫐', nodes:{sticks:10,stones:9,bush:9,berry:3,tree:8,rock:4,puddle:3,crate:1,scrapp:2}, en:{zombie:3}},
  forest: {n:'Мёртвый лес', d:'Много древесины, волокна и ягод. Бродят заражённые.', size:34, tox:1, danger:2, ground:'grass', fog:[90,120,60,.14], bg:'#0f140d',
    loot:'🪵🌿🫐🥤', nodes:{tree:70,sticks:8,bush:16,berry:9,rock:5,puddle:5,crate:2}, en:{zombie:7,runner:3}},
  quarry: {n:'Заброшенный карьер', d:'Камень, железная руда и уголь для фильтров.', size:34, tox:1, danger:2, ground:'dirt', fog:[140,120,70,.12], bg:'#15120d',
    loot:'🪨🟫⚫🔩', nodes:{rock:30,orev:13,coal:10,stones:8,tree:6,crate:2,scrapp:5,puddle:2}, en:{zombie:7,runner:3,bloater:1,spitter:2}},
  city: {n:'Руины города', d:'Металлолом, ткань, еда и электроника. Опасно: много заражённых.', size:40, tox:1.3, danger:3, ground:'asph', fog:[120,130,90,.14], bg:'#101210', buildings:8, bcrate:'crate',
    loot:'🔩🧵🥫🔌🛞', nodes:{car:10,scrapp:14,crate:8,bush:4,puddle:3,barrel:2}, en:{zombie:12,runner:5,bloater:2,spitter:2,mutant:1}},
  base: {n:'Военная база', d:'Оружейные детали, патроны, химикаты. Территорию держат мутанты.', size:38, tox:1.6, danger:4, ground:'conc', fog:[130,140,70,.16], bg:'#111210', buildings:6, bcrate:'milcrate',
    loot:'🔧🔶🧪🔌💊', nodes:{milcrate:6,crate:4,barrel:6,car:5,scrapp:8}, en:{zombie:8,runner:4,spitter:4,mutant:3,bloater:2}},
  zone: {n:'Эпицентр', d:'Источник заражения. Только здесь растут рубиновые кристаллы. Фильтры сгорают мгновенно.', size:36, tox:2.5, danger:5, ground:'sludge', fog:[150,200,40,.22], bg:'#0c1206',
    loot:'♦️🧪🫀', nodes:{ruby:5,barrel:8,milcrate:3,rock:8,coal:4}, en:{mutant:5,spitter:4,bloater:3,runner:4,boss:1}},
};

// ===== Модули бункера =====
const MODS = {
  hatch:  {n:'Выход на поверхность', i:'🪜', x:11, y:9, base:1, col:'#4a5560', h:6},
  storage:{n:'Склад', i:'📦', x:2, y:1, base:1, col:'#7a5f38', h:22},
  bed:    {n:'Койка', i:'🛏️', x:1, y:3, base:1, col:'#5a4a6a', h:8},
  bench:  {n:'Верстак', i:'🔨', x:4, y:1, col:'#6a5a40', h:16, cost:{wood:10,stone:5}, d:'Оружие, броня, рюкзак'},
  furnace:{n:'Плавильня', i:'🔥', x:6, y:1, col:'#6a4a3a', h:26, cost:{stone:15,scrap:5}, d:'Железо из руды, уголь из древесины'},
  kitchen:{n:'Кухня', i:'🍳', x:8, y:1, col:'#5a6a6a', h:16, cost:{stone:8,scrap:4,wood:4}, d:'Очистка воды и готовка'},
  filt:   {n:'Станция фильтров', i:'🫁', x:10, y:1, col:'#4a6a4a', h:20, cost:{scrap:8,cloth:4,iron:2}, d:'Фильтры для противогаза, химзащита'},
  water:  {n:'Сборщик воды', i:'🚰', x:11, y:4, col:'#3a5a7a', h:20, cost:{scrap:6,cloth:3,rubber:2}, d:'+3 грязной воды после каждой вылазки'},
  garden: {n:'Гидропоника', i:'🌱', x:11, y:6, col:'#3a6a3a', h:10, cost:{wood:8,fiber:6,dwater:2}, d:'+4 ягоды после каждой вылазки'},
  med:    {n:'Медблок', i:'⚕️', x:1, y:5, col:'#7a7a7a', h:18, cost:{cloth:8,iron:3,chem:2}, d:'Аптечки. Сон лечит полностью'},
  gen:    {n:'Генератор', i:'⚡', x:1, y:7, col:'#7a6a2a', h:18, cost:{iron:8,elec:3,rubber:3,fuel:2}, d:'Свет в бункере. Нужен для оружейной и реактора'},
  armory: {n:'Оружейная', i:'🔫', x:1, y:9, col:'#4a4a4a', h:20, cost:{iron:10,scrap:10,elec:2}, req:'gen', d:'Огнестрел и патроны'},
  reactor:{n:'Реактор «Рубин»', i:'♦️', x:6, y:5, col:'#5a2030', h:34, cost:{ruby:8,elec:8,iron:15,chem:5}, req:'gen', d:'Очищает воздух вокруг бункера. Главная цель!'},
};

// ===== Рецепты =====
const STATIONS = {hand:'Своими руками', bench:'Верстак', furnace:'Плавильня', kitchen:'Кухня', filt:'Станция фильтров', med:'Медблок', armory:'Оружейная'};
const RECIPES = [
  {out:'axe', st:'hand', c:{wood:3,stone:2,fiber:1}},
  {out:'pick', st:'hand', c:{wood:3,stone:3,fiber:1}},
  {out:'spear', st:'hand', c:{wood:5,fiber:2}},
  {out:'rope', st:'hand', c:{fiber:3}},
  {out:'bandage', st:'hand', c:{cloth:2}},
  {out:'filter0', st:'hand', c:{fiber:5}},

  {out:'bat', st:'bench', c:{wood:6,scrap:4}},
  {out:'machete', st:'bench', c:{iron:4,wood:2,rope:1}},
  {out:'jacket', st:'bench', c:{cloth:8,rope:2}},
  {out:'plate', st:'bench', c:{scrap:12,iron:4,rope:3}},
  {up:'pack1', n:'Вместительный рюкзак', i:'🎒', d:'+6 ячеек рюкзака', st:'bench', c:{cloth:10,rope:3}},

  {out:'iron', st:'furnace', c:{ore:2,coal:1}},
  {out:'iron', st:'furnace', c:{scrap:4,coal:1}},
  {out:'coal', k:2, st:'furnace', c:{wood:3}},

  {out:'water', st:'kitchen', c:{dwater:1}},
  {out:'stew', st:'kitchen', c:{canned:1,berries:2,water:1}},
  {out:'stew', st:'kitchen', c:{berries:6,water:1}},

  {out:'filter', st:'filt', c:{coal:3,cloth:2,scrap:1}},
  {out:'filter2', st:'filt', c:{coal:4,cloth:2,gland:1,chem:1}},
  {out:'hazmat', st:'filt', c:{rubber:8,cloth:8,chem:3}},

  {out:'medkit', st:'med', c:{bandage:2,chem:1}},

  {out:'powder', k:2, st:'armory', c:{coal:2,chem:1}},
  {out:'ammo', k:8, st:'armory', c:{iron:1,powder:1}},
  {out:'pistol', st:'armory', c:{iron:5,parts:2}},
  {out:'shotgun', st:'armory', c:{iron:8,parts:4,wood:3}},
  {up:'pack2', n:'Армейский рюкзак', i:'🎒', d:'+6 ячеек рюкзака', st:'armory', req:'pack1', c:{cloth:12,rubber:4,iron:3}},
];
