'use strict';
// ===== Предметы =====
// r — редкость (0 обычный … 3 эпический), s — стопка, eat — эффект, w — оружие, tool/pw — инструмент и его сила
const ITEMS = {
  wood:   {n:'Древесина', i:'🪵'},
  stone:  {n:'Камень', i:'🪨'},
  fiber:  {n:'Волокно', i:'🌿'},
  scrap:  {n:'Металлолом', i:'🔩'},
  ore:    {n:'Железная руда', i:'🟫'},
  iron:   {n:'Железо', i:'⚙️', r:1},
  coal:   {n:'Уголь', i:'⚫', d:'Основа любого фильтра'},
  cloth:  {n:'Ткань', i:'🧵'},
  rope:   {n:'Верёвка', i:'🪢'},
  rubber: {n:'Резина', i:'🛞', r:1},
  fuel:   {n:'Топливо', i:'⛽', r:1},
  elec:   {n:'Электроника', i:'🔌', r:2, d:'Редкий ресурс из руин и армейских ящиков'},
  chem:   {n:'Химикаты', i:'🧪', r:2, d:'Редкий ресурс'},
  parts:  {n:'Оружейные детали', i:'🔧', r:2, d:'Редкий ресурс с военной базы'},
  powder: {n:'Порох', i:'🧨', r:1},
  gland:  {n:'Железа мутанта', i:'🫀', r:2, d:'Выпадает из мутантов и плевунов'},
  ruby:   {n:'Рубиновый кристалл', i:'♦️', r:3, d:'Редчайший ресурс из Эпицентра. Нужен для реактора'},
  ammo:   {n:'Патроны', i:'🔶', s:60, r:1},
  arrow:  {n:'Стрелы', i:'➶', s:40},

  berries:{n:'Ягоды', i:'🫐', s:10, eat:{hunger:8, thirst:4}},
  canned: {n:'Консервы', i:'🥫', s:10, eat:{hunger:40}},
  stew:   {n:'Похлёбка', i:'🍲', s:10, r:1, eat:{hunger:65, thirst:20, hp:10}},
  dwater: {n:'Грязная вода', i:'🥤', s:10, eat:{thirst:18, hp:-8}, d:'Пить можно, но вредно. Очистите на кухне'},
  water:  {n:'Чистая вода', i:'💧', s:10, eat:{thirst:45}},
  bandage:{n:'Бинт', i:'🩹', s:10, eat:{hp:25}, d:'Останавливает кровотечение'},
  medkit: {n:'Аптечка', i:'💊', s:5, r:2, eat:{hp:75}, d:'Останавливает кровотечение'},

  filter0:{n:'Самодельный фильтр', i:'🍃', s:5, filt:35, d:'Хватает ненадолго'},
  filter: {n:'Фильтр', i:'🫁', s:5, r:1, filt:100},
  filter2:{n:'Биофильтр', i:'🧬', s:5, r:2, filt:220, d:'Усиленный фильтр из железы мутанта'},

  axe:    {n:'Каменный топор', i:'🪓', dur:40, tool:'axe', pw:1, w:{dmg:12, cd:.6, rg:1}},
  pick:   {n:'Каменная кирка', i:'⛏️', dur:40, tool:'pick', pw:1, w:{dmg:10, cd:.65, rg:1}},
  saxe:   {n:'Стальной топор', i:'🪓', r:1, dur:130, tool:'axe', pw:2, w:{dmg:20, cd:.55, rg:1}, d:'Рубит вдвое быстрее'},
  spick:  {n:'Стальная кирка', i:'⛏️', r:1, dur:130, tool:'pick', pw:2, w:{dmg:17, cd:.6, rg:1}, d:'Добывает вдвое быстрее'},
  spear:  {n:'Копьё', i:'🔱', dur:45, w:{dmg:15, cd:.65, rg:1.4}},
  bat:    {n:'Бита с гвоздями', i:'🏏', dur:60, w:{dmg:23, cd:.75, rg:1.05}},
  machete:{n:'Мачете', i:'🔪', r:1, dur:100, w:{dmg:32, cd:.48, rg:1.05}},
  bow:    {n:'Лук', i:'🏹', r:1, dur:70, w:{dmg:27, cd:.75, rg:7.5, ranged:1, ammo:'arrow', noise:0}, d:'Бесшумный. Идеален для ударов из тени'},
  pistol: {n:'Пистолет', i:'🔫', r:2, dur:150, w:{dmg:38, cd:.4, rg:7, ranged:1, ammo:'ammo', noise:30}, d:'Громкий: шум привлекает орду'},
  shotgun:{n:'Дробовик', i:'💥', r:3, dur:100, w:{dmg:85, cd:.95, rg:5, ranged:1, ammo:'ammo', noise:50, splash:1}, d:'Очень громкий. Бьёт по площади'},

  jacket: {n:'Плотная куртка', i:'🧥', armor:.15},
  plate:  {n:'Броня из металлолома', i:'🛡️', r:1, armor:.35},
  hazmat: {n:'Костюм химзащиты', i:'🥼', r:2, armor:.22, save:.4, d:'Фильтр расходуется на 40% медленнее'},
};
const FISTS = {dmg:7, cd:.42, rg:.95};
const RARITY = ['#5a6248', '#4f8a5a', '#4a7fc0', '#c04a70'];

// ===== Объекты на локациях =====
// hp — сколько ударов нужно, loot: [предмет, мин, макс, шанс], c — цвет осколков
const NODES = {
  sticks: {n:'Ветки', v:'Собрать', hp:1, c:'#7a5a3a', loot:[['wood',2,3]]},
  stones: {n:'Камни', v:'Собрать', hp:1, c:'#8c8e92', loot:[['stone',2,3]]},
  bush:   {n:'Куст', v:'Обобрать', hp:2, solid:1, c:'#4a6d38', loot:[['fiber',2,4],['berries',1,2,.35]]},
  berry:  {n:'Ягодный куст', v:'Обобрать', hp:2, solid:1, c:'#7a50d0', loot:[['berries',2,4],['fiber',1,1,.5]]},
  tree:   {n:'Дерево', v:'Рубить', hp:4, tool:'axe', solid:1, c:'#8a6a44', loot:[['wood',5,7],['fiber',1,2,.3]]},
  rock:   {n:'Валун', v:'Дробить', hp:4, tool:'pick', solid:1, c:'#9a9da2', loot:[['stone',5,7],['ore',1,2,.3]]},
  orev:   {n:'Железная жила', v:'Добывать', hp:5, tool:'pick', solid:1, c:'#d08a45', loot:[['ore',4,6],['stone',1,2]]},
  coal:   {n:'Угольный пласт', v:'Добывать', hp:4, tool:'pick', solid:1, c:'#222228', loot:[['coal',4,6]]},
  ruby:   {n:'Рубиновый кристалл', v:'Добывать', hp:7, tool:'pick', solid:1, c:'#ff5070', loot:[['ruby',1,1]]},
  puddle: {n:'Лужа', v:'Набрать воды', hp:1, c:'#5a9a8a', loot:[['dwater',2,3]]},
  scrapp: {n:'Куча хлама', v:'Обыскать', hp:2, solid:1, c:'#8a8a8a', loot:[['scrap',2,4],['rubber',1,1,.3],['cloth',1,2,.35]]},
  car:    {n:'Остов машины', v:'Разобрать', hp:4, solid:1, c:'#9a7a5a', loot:[['scrap',4,6],['rubber',1,3],['fuel',1,1,.4],['elec',1,1,.25]]},
  barrel: {n:'Бочка с химикатами', v:'Слить', hp:2, solid:1, c:'#b0e040', loot:[['chem',1,3],['fuel',1,1,.3]]},
  crate:  {n:'Ящик', v:'Вскрыть', hp:2, solid:1, c:'#a58a5a', table:'crate'},
  milcrate:{n:'Армейский ящик', v:'Вскрыть', hp:3, solid:1, c:'#6a7a4a', table:'mil'},
  cache:  {n:'Тайник', v:'Взломать', hp:4, solid:1, c:'#e0c060', table:'mil'},
  bag:    {n:'Добыча', v:'Подобрать', hp:1, c:'#a58a5a'},
};
// таблицы лута: [предмет, вес, мин, макс]
const TABLES = {
  crate: [['canned',3,1,2],['water',3,1,2],['cloth',3,1,3],['bandage',2,1,1],['scrap',2,1,3],['rope',1,1,1],['ammo',1,2,5],['elec',1,1,1],['coal',1,1,2],['arrow',1,3,6]],
  mil:   [['ammo',4,4,8],['parts',3,1,2],['medkit',1,1,1],['elec',3,1,2],['chem',2,1,2],['canned',2,1,2],['iron',2,1,3],['powder',2,1,2]],
};

// ===== Враги =====
// drop: [предмет, шанс, мин, макс]; ag — радиус обнаружения; bl — шанс вызвать кровотечение
const ENEMIES = {
  zombie: {n:'Заражённый', hp:40, dmg:7, sp:1.4, cd:1.4, rg:.9, ag:5, sz:1, xp:6, body:'#5d6b4a', skin:'#8fa878',
           drop:[['cloth',.35,1,2],['scrap',.15,1,1]]},
  runner: {n:'Бегун', hp:26, dmg:6, sp:3.0, cd:.8, rg:.9, ag:7.5, sz:.9, xp:8, bl:.2, body:'#6b5a4a', skin:'#c8c8a8',
           drop:[['cloth',.3,1,1],['fiber',.2,1,2]]},
  screamer:{n:'Крикун', hp:34, dmg:5, sp:1.9, cd:1.2, rg:.9, ag:8, sz:.95, xp:10, scream:1, body:'#8a8a94', skin:'#e0d8d0',
           drop:[['cloth',.5,1,2],['elec',.15,1,1]]},
  bloater:{n:'Толстяк', hp:120, dmg:16, sp:1.0, cd:1.5, rg:1, ag:5.5, sz:1.25, wide:1.5, xp:16, cloud:1, body:'#7a7a3a', skin:'#a8b060',
           drop:[['chem',.6,1,2],['cloth',.4,1,2]]},
  spitter:{n:'Плевун', hp:45, dmg:11, sp:1.7, cd:2.2, rg:6.5, ag:8, sz:1, xp:14, spit:1, body:'#5a3f6b', skin:'#a080b8',
           drop:[['gland',.5,1,1],['chem',.25,1,1]]},
  stalker:{n:'Ночной охотник', hp:60, dmg:14, sp:3.3, cd:1, rg:1, ag:9, sz:1.05, xp:18, bl:.35, dark:1, body:'#1c2030', skin:'#3a4460',
           drop:[['gland',.4,1,1],['cloth',.3,1,2]]},
  mutant: {n:'Мутант', hp:230, dmg:24, sp:2.4, cd:1.3, rg:1.15, ag:7.5, sz:1.5, xp:35, bl:.4, spikes:1, body:'#6b2d2d', skin:'#a04a4a',
           drop:[['gland',.9,1,2],['elec',.2,1,1]]},
  boss:   {n:'Альфа-мутант', hp:950, dmg:38, sp:2.1, cd:1.4, rg:1.5, ag:9, sz:2.2, xp:250, bl:.5, spikes:1, boss:1, body:'#3a1020', skin:'#c02040',
           drop:[['ruby',1,2,3],['gland',1,3,4],['parts',1,2,3]]},
};

// ===== Локации ===== (mx,my — положение на карте в процентах)
const LOCS = {
  yard: {n:'Окрестности бункера', d:'Относительно тихо. Ветки, камни, кусты — всё для первых инструментов.', size:26, tox:.6, danger:1, ground:'grass', fog:[150,170,90], bg:'#12170f', mx:34, my:80,
    loot:'🪵🪨🌿🫐', nodes:{sticks:10,stones:9,bush:9,berry:3,tree:8,rock:4,puddle:3,crate:1,scrapp:2}, en:{zombie:3}},
  forest: {n:'Мёртвый лес', d:'Много древесины, волокна и ягод. Бродят заражённые. В тайнике — чертёж лука.', size:34, tox:1, danger:2, ground:'grass', fog:[130,160,100], bg:'#0f140d', mx:13, my:46,
    loot:'🪵🌿🫐🥤', bps:['bow'], nodes:{tree:70,sticks:8,bush:16,berry:9,rock:5,puddle:5,crate:2}, en:{zombie:7,runner:3}},
  quarry: {n:'Заброшенный карьер', d:'Камень, железная руда и уголь для фильтров. В тайнике — чертежи стальных инструментов.', size:34, tox:1, danger:2, ground:'dirt', fog:[180,160,110], bg:'#15120d', mx:68, my:80,
    loot:'🪨🟫⚫🔩', bps:['steel','plate'], nodes:{rock:30,orev:13,coal:10,stones:8,tree:6,crate:2,scrapp:5,puddle:2}, en:{zombie:7,runner:3,bloater:1,spitter:2}},
  city: {n:'Руины города', d:'Металлолом, ткань, еда и электроника. Крикуны поднимают шум — берегитесь орды.', size:40, tox:1.3, danger:3, ground:'asph', fog:[160,170,130], bg:'#101210', buildings:8, bcrate:'crate', roads:1, mx:36, my:22,
    loot:'🔩🧵🥫🔌🛞', bps:['machete','hazmat'], nodes:{car:10,scrapp:14,crate:8,bush:4,puddle:3,barrel:2}, en:{zombie:11,runner:4,screamer:2,bloater:2,spitter:2,mutant:1}},
  base: {n:'Военная база', d:'Оружейные детали, патроны, химикаты. Территорию держат мутанты.', size:38, tox:1.6, danger:4, ground:'conc', fog:[170,180,110], bg:'#111210', buildings:6, bcrate:'milcrate', roads:1, mx:70, my:38,
    loot:'🔧🔶🧪🔌💊', bps:['pistol','shotgun','filter2'], nodes:{milcrate:6,crate:4,barrel:6,car:5,scrapp:8}, en:{zombie:7,runner:4,screamer:2,spitter:4,mutant:3,bloater:2}},
  zone: {n:'Эпицентр', d:'Источник заражения. Только здесь растут рубиновые кристаллы. Фильтры сгорают мгновенно.', size:36, tox:2.5, danger:5, ground:'sludge', fog:[170,230,60], bg:'#0c1206', mx:88, my:20,
    loot:'♦️🧪🫀', nodes:{ruby:5,barrel:8,milcrate:3,rock:8,coal:4}, en:{mutant:5,spitter:4,bloater:3,runner:4,boss:1}},
};

// ===== Модули бункера ===== lv — стоимость каждого уровня, fx — что даёт уровень
const MODS = {
  hatch:  {n:'Выход на поверхность', i:'🪜', x:11, y:9, base:1, col:'#4a5560', h:6},
  bed:    {n:'Койка', i:'🛏️', x:1, y:3, base:1, col:'#5a4a6a', h:8, d:'Сон восстанавливает здоровье и проматывает ночь'},
  storage:{n:'Склад', i:'📦', x:2, y:1, base:1, col:'#7a5f38', h:22, d:'Хранилище добычи',
           lv:[{}, {wood:20,scrap:10,iron:4}, {iron:12,cloth:10,elec:2}], fx:['30 ячеек','50 ячеек','70 ячеек']},
  bench:  {n:'Верстак', i:'🔨', x:4, y:1, col:'#6a5a40', h:16, d:'Оружие, броня, рюкзак',
           lv:[{wood:10,stone:5}, {wood:15,iron:6,scrap:10}, {iron:15,elec:4,parts:2}], fx:['бита, куртка, стрелы','сталь, мачете, броня, лук','армейский рюкзак']},
  furnace:{n:'Плавильня', i:'🔥', x:6, y:1, col:'#6a4a3a', h:26, d:'Железо из руды, уголь из древесины',
           lv:[{stone:15,scrap:5}, {stone:20,iron:8,coal:6}], fx:['плавка','двойной выход']},
  kitchen:{n:'Кухня', i:'🍳', x:8, y:1, col:'#5a6a6a', h:16, d:'Очистка воды и готовка', lv:[{stone:8,scrap:4,wood:4}], fx:['вода и похлёбка']},
  filt:   {n:'Станция фильтров', i:'🫁', x:10, y:1, col:'#4a6a4a', h:20, d:'Фильтры для противогаза',
           lv:[{scrap:8,cloth:4,iron:2}, {iron:8,chem:3,elec:2}], fx:['обычные фильтры','биофильтры и химзащита']},
  water:  {n:'Сборщик воды', i:'🚰', x:11, y:4, col:'#3a5a7a', h:20, d:'Копит грязную воду на складе',
           lv:[{scrap:6,cloth:3,rubber:2}, {iron:6,rubber:4,elec:1}], fx:['~7 воды в сутки','~14 воды в сутки']},
  garden: {n:'Гидропоника', i:'🌱', x:11, y:6, col:'#3a6a3a', h:10, d:'Выращивает ягоды',
           lv:[{wood:8,fiber:6,dwater:2}, {iron:4,chem:2,dwater:6}], fx:['~8 ягод в сутки','~16 ягод в сутки']},
  med:    {n:'Медблок', i:'⚕️', x:1, y:5, col:'#7a7a7a', h:18, d:'Аптечки. Сон лечит полностью', lv:[{cloth:8,iron:3,chem:2}], fx:['аптечки']},
  radio:  {n:'Радиостанция', i:'📻', x:5, y:9, col:'#4a5a6a', h:16, d:'Задания от других выживших — награды редкими ресурсами', lv:[{scrap:10,iron:3,elec:2}], fx:['3 задания в сутки']},
  gen:    {n:'Генератор', i:'⚡', x:1, y:7, col:'#7a6a2a', h:18, d:'Свет в бункере. Нужен для оружейной и реактора', lv:[{iron:8,elec:3,rubber:3,fuel:2}], fx:['электричество']},
  armory: {n:'Оружейная', i:'🔫', x:1, y:9, col:'#4a4a4a', h:20, req:'gen', d:'Огнестрел и патроны',
           lv:[{iron:10,scrap:10,elec:2}, {iron:15,parts:4,elec:4}], fx:['патроны, пистолет','дробовик']},
  reactor:{n:'Реактор «Рубин»', i:'♦️', x:6, y:5, col:'#5a2030', h:34, req:'gen', d:'Очищает воздух вокруг бункера. Главная цель!', lv:[{ruby:8,elec:8,iron:15,chem:5}], fx:['победа']},
};

// ===== Рецепты ===== lv — уровень станции, bp — нужен чертёж
const STATIONS = {hand:'Руки', bench:'Верстак', furnace:'Плавильня', kitchen:'Кухня', filt:'Фильтры', med:'Медблок', armory:'Оружейная'};
const BPS = {bow:'Лук', steel:'Стальные инструменты', plate:'Броня из металлолома', machete:'Мачете', hazmat:'Химзащита', pistol:'Пистолет', shotgun:'Дробовик', filter2:'Биофильтр'};
const RECIPES = [
  {out:'axe', st:'hand', c:{wood:3,stone:2,fiber:1}},
  {out:'pick', st:'hand', c:{wood:3,stone:3,fiber:1}},
  {out:'spear', st:'hand', c:{wood:5,fiber:2}},
  {out:'rope', st:'hand', c:{fiber:3}},
  {out:'bandage', st:'hand', c:{cloth:2}},
  {out:'filter0', st:'hand', c:{fiber:5}},

  {out:'bat', st:'bench', c:{wood:6,scrap:4}},
  {out:'jacket', st:'bench', c:{cloth:8,rope:2}},
  {out:'arrow', k:6, st:'bench', c:{wood:2,stone:1}},
  {up:'pack1', n:'Вместительный рюкзак', i:'🎒', d:'+6 ячеек рюкзака', st:'bench', c:{cloth:10,rope:3}},
  {out:'bow', st:'bench', lv:2, bp:'bow', c:{wood:6,rope:2,fiber:3}},
  {out:'saxe', st:'bench', lv:2, bp:'steel', c:{iron:4,wood:3,rope:1}},
  {out:'spick', st:'bench', lv:2, bp:'steel', c:{iron:5,wood:3,rope:1}},
  {out:'machete', st:'bench', lv:2, bp:'machete', c:{iron:4,wood:2,rope:1}},
  {out:'plate', st:'bench', lv:2, bp:'plate', c:{scrap:12,iron:4,rope:3}},
  {up:'pack2', n:'Армейский рюкзак', i:'🎒', d:'+6 ячеек рюкзака', st:'bench', lv:3, req:'pack1', c:{cloth:12,rubber:4,iron:3}},

  {out:'iron', st:'furnace', c:{ore:2,coal:1}},
  {out:'iron', st:'furnace', c:{scrap:4,coal:1}},
  {out:'coal', k:2, st:'furnace', c:{wood:3}},

  {out:'water', st:'kitchen', c:{dwater:1}},
  {out:'stew', st:'kitchen', c:{canned:1,berries:2,water:1}},
  {out:'stew', st:'kitchen', c:{berries:6,water:1}},

  {out:'filter', st:'filt', c:{coal:3,cloth:2,scrap:1}},
  {out:'filter2', st:'filt', lv:2, bp:'filter2', c:{coal:4,cloth:2,gland:1,chem:1}},
  {out:'hazmat', st:'filt', lv:2, bp:'hazmat', c:{rubber:8,cloth:8,chem:3}},

  {out:'medkit', st:'med', c:{bandage:2,chem:1}},

  {out:'powder', k:2, st:'armory', c:{coal:2,chem:1}},
  {out:'ammo', k:8, st:'armory', c:{iron:1,powder:1}},
  {out:'pistol', st:'armory', bp:'pistol', c:{iron:5,parts:2}},
  {out:'shotgun', st:'armory', lv:2, bp:'shotgun', c:{iron:8,parts:4,wood:3}},
];

// ===== Навыки ===== (до 3 рангов)
const PERKS = {
  tough: {n:'Закалка', i:'❤️', d:'+20 к максимуму здоровья'},
  lungs: {n:'Ровное дыхание', i:'🫁', d:'Фильтр расходуется на 12% медленнее'},
  brute: {n:'Тяжёлая рука', i:'💪', d:'+15% урона в ближнем бою'},
  marks: {n:'Меткий глаз', i:'🎯', d:'+15% урона луком и огнестрелом'},
  swift: {n:'Лёгкие ноги', i:'👟', d:'+6% к скорости, рывок дешевле'},
  mule:  {n:'Вьючный мул', i:'🎒', d:'+3 ячейки рюкзака'},
  scav:  {n:'Мародёр', i:'🧲', d:'+15% шанс получить лишний ресурс при добыче'},
  ghost: {n:'Тень', i:'👣', d:'Вас хуже замечают; удар из тени сильнее'},
  camel: {n:'Неприхотливость', i:'🥫', d:'Голод и жажда наступают на 15% медленнее'},
  smith: {n:'Бережливость', i:'🛠️', d:'20% шанс не потратить прочность'},
};

// ===== Задания рации =====
const Q_BRING = [['wood',15],['stone',15],['fiber',12],['scrap',10],['cloth',8],['coal',8],['iron',5],['berries',10],['gland',2],['chem',3],['rubber',4]];
const Q_KILL = [['zombie',8],['runner',5],['screamer',2],['bloater',2],['spitter',3],['mutant',2]];
const Q_REWARD = [['ammo',12],['elec',2],['chem',2],['parts',1],['medkit',1],['filter',2],['canned',3],['iron',4],['powder',3],['arrow',12]];
