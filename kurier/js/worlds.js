/* Курьер миров — миры, палитры, враги, боссы и сюжет. */
(function () {
  'use strict';
  const K = (window.K = window.K || {});

  // Способности открываются после побед над боссами.
  K.ABILITY_NAMES = { dash: 'Рывок', double: 'Двойной прыжок', fire: 'Огненный шар', wall: 'Прыжок от стены' };

  K.WORLDS = [
    {
      id: 1, name: 'Ночной город', sub: 'Наш мир. Казань, 23:47', levels: 2, len: [150, 175], boss: 'pigeon', bossName: 'Голубиный король',
      enemies: { walk: 'dog', fly: 'pigeon', shoot: 'drone', jump: 'cat' }, hazard: 'spikes', music: 'city',
      seg: { flat: 3, gap: 3, step: 2, platforms: 2, spikes: 2, enemies: 3, pillars: 2, moving: 1, shooter: 1 },
      pal: { sky: ['#070a22', '#1d1745', '#4a2d66'], far: '#1a1840', mid: '#121033', near: '#0b0a22', ground: '#3e4252', groundDark: '#2c2f3c', top: '#8a90a3', topHi: '#b9bfd0', block: '#6e3f34', blockDark: '#4d2b24', plat: '#c2a15a', hazard: '#9aa3b8', accent: '#ff4f8b', light: '#ffd56b', fog: 'rgba(120,90,200,0.10)' },
      gives: null,
    },
    {
      id: 2, name: 'Степь орков', sub: 'Ковыль, юрты, волчьи тропы', levels: 3, len: [180, 200, 220], boss: 'wolf', bossName: 'Вожак Волколак',
      enemies: { walk: 'wolf', fly: 'vulture', shoot: 'goblin', jump: 'goblinJ' }, hazard: 'spikes', music: 'steppe',
      seg: { flat: 2, gap: 3, step: 3, platforms: 2, spikes: 2, enemies: 3, pillars: 2, moving: 1, crumble: 1, shooter: 2, charger: 1 },
      pal: { sky: ['#2a1a3d', '#a3485a', '#f0a05a'], far: '#7a4a5e', mid: '#4f3045', near: '#2a1b26', ground: '#7a5532', groundDark: '#58391f', top: '#b0a84c', topHi: '#d6cf6a', block: '#8a6a4a', blockDark: '#5c4430', plat: '#a07a4a', hazard: '#c9c2b0', accent: '#e8553b', light: '#ffcf7a', fog: 'rgba(240,160,90,0.08)' },
      gives: 'dash',
      chase: { kind: 'stampede', name: 'Табун!', note: 'За Мишей мчится табун диких коней. Беги!', speed: 2.9 },
    },
    {
      id: 3, name: 'Королевство', sub: 'Стены, флаги и рыцари', levels: 3, len: [200, 220, 240], boss: 'knight', bossName: 'Чёрный рыцарь',
      enemies: { walk: 'knight', fly: 'bat', shoot: 'archer', jump: 'jester' }, hazard: 'spikes', music: 'kingdom',
      seg: { flat: 2, gap: 2, step: 2, platforms: 3, spikes: 3, enemies: 3, pillars: 3, moving: 2, crumble: 2, shooter: 2, dashgap: 2 },
      pal: { sky: ['#3d7cc4', '#86bde6', '#dff0fa'], far: '#9fb6c9', mid: '#7a8fa3', near: '#4f5f6e', ground: '#7c828d', groundDark: '#5a5f69', top: '#5f9a4a', topHi: '#86c060', block: '#9a9fa8', blockDark: '#6c717b', plat: '#9a6f45', hazard: '#d8dde5', accent: '#c23a3a', light: '#ffe08a', fog: 'rgba(255,255,255,0.06)' },
      gives: 'double',
      chase: { kind: 'rubble', name: 'Обвал!', note: 'Стена замка рушится следом. Беги!', speed: 3.0 },
    },
    {
      id: 4, name: 'Колдовской лес', sub: 'Грибы с дом и болотные огни', levels: 3, len: [210, 230, 250], boss: 'treant', bossName: 'Древень',
      enemies: { walk: 'slime', fly: 'wisp', shoot: 'plant', jump: 'frog' }, hazard: 'water', music: 'forest',
      seg: { flat: 2, gap: 2, step: 2, platforms: 3, spikes: 1, enemies: 3, pillars: 2, moving: 2, bounce: 3, djwall: 2, dashgap: 2, hazardpit: 2, shooter: 1 },
      pal: { sky: ['#06140f', '#123a2c', '#2e6a4c'], far: '#1c4a38', mid: '#123326', near: '#0a1f17', ground: '#4a3a2a', groundDark: '#33281c', top: '#4f9a3a', topHi: '#7fcf5a', block: '#5a4a6a', blockDark: '#3d3249', plat: '#7a5a3a', hazard: '#3f8a6a', accent: '#c06cff', light: '#c9ff8a', fog: 'rgba(120,255,180,0.07)' },
      gives: 'fire',
      chase: { kind: 'swamp', name: 'Болотная волна!', note: 'Древень поднял болото. Волна идёт следом. Беги!', speed: 3.0 },
    },
    {
      id: 5, name: 'Ледяные пики', sub: 'Скользкий лёд и падающие сосульки', levels: 3, len: [220, 240, 260], boss: 'serpent', bossName: 'Снежный змей',
      enemies: { walk: 'yeti', fly: 'owl', shoot: 'iceturret', jump: 'penguin' }, hazard: 'spikes', music: 'ice',
      seg: { flat: 1, gap: 2, step: 2, platforms: 3, spikes: 2, enemies: 3, pillars: 2, moving: 2, ice: 4, icicles: 3, breakable: 2, djwall: 2, dashgap: 2, shooter: 2 },
      pal: { sky: ['#5e86b0', '#a9c9e3', '#eef6fc'], far: '#c2d6e8', mid: '#8fb0cc', near: '#5f7f9c', ground: '#8fa9c2', groundDark: '#6c87a2', top: '#f4f8fc', topHi: '#ffffff', block: '#a8d8ef', blockDark: '#76b4d6', plat: '#8a9fb4', hazard: '#dff3ff', accent: '#3a7fd0', light: '#fff4c2', fog: 'rgba(255,255,255,0.12)' },
      gives: 'wall',
      chase: { kind: 'avalanche', name: 'Лавина!', note: 'Сверху сходит лавина. Беги!', speed: 3.1 },
    },
    {
      id: 6, name: 'Подземные кузни', sub: 'Лава, конвейеры, гномьи машины', levels: 3, len: [230, 250, 270], boss: 'golem', bossName: 'Кузнечный голем',
      enemies: { walk: 'imp', fly: 'firebat', shoot: 'turret', jump: 'imp' }, hazard: 'lava', music: 'forge',
      chase: { kind: 'lava', name: 'Лава!', note: 'Голем прорвал плотину. Лава течёт следом. Беги!', speed: 3.1 },
      seg: { flat: 1, gap: 2, step: 2, platforms: 2, enemies: 3, pillars: 2, moving: 3, conveyor: 3, firejet: 3, hazardpit: 3, walljump: 3, breakable: 1, dashgap: 2, djwall: 1, shooter: 2 },
      pal: { sky: ['#0d0402', '#2b0b05', '#5a1a08'], far: '#3a140a', mid: '#260c06', near: '#140603', ground: '#3a2a26', groundDark: '#241916', top: '#6a4a3e', topHi: '#8f6a58', block: '#4a3a36', blockDark: '#2f2421', plat: '#7a6a5a', hazard: '#ff6a1a', accent: '#ffb02a', light: '#ffd06a', fog: 'rgba(255,90,20,0.10)' },
      gives: null,
    },
    {
      id: 7, name: 'Разлом', sub: 'Пустота между мирами', levels: 2, len: [260, 290], boss: 'keeper', bossName: 'Хранитель Разлома',
      enemies: { walk: 'shade', fly: 'wisp', shoot: 'eye', jump: 'shadeJ' }, hazard: 'void', music: 'rift',
      chase: { kind: 'void', name: 'Пустота!', note: 'Пустота пожирает мир позади. Беги!', speed: 3.2 },
      seg: { flat: 1, gap: 3, step: 2, platforms: 3, spikes: 2, enemies: 3, moving: 3, crumble: 2, bounce: 1, djwall: 2, dashgap: 2, walljump: 2, hazardpit: 2, ice: 1, conveyor: 1, shooter: 2, breakable: 1 },
      pal: { sky: ['#05020f', '#1c0a3a', '#4a1a7a'], far: '#2a1050', mid: '#1a0838', near: '#0d0420', ground: '#3a2a5a', groundDark: '#261a40', top: '#8a6aff', topHi: '#c0a8ff', block: '#4a3a7a', blockDark: '#30245a', plat: '#7a6ab0', hazard: '#b06aff', accent: '#ff6ad8', light: '#e8d8ff', fog: 'rgba(180,120,255,0.10)' },
      gives: null,
    },
  ];

  K.worldById = (id) => K.WORLDS[id - 1];
  K.stageCount = (w) => w.levels + 1; // последняя ступень — босс
  K.stageId = (w, s) => `${w}-${s}`;
  K.isBoss = (w, s) => s === K.worldById(w).levels + 1;
  // Последний обычный уровень мира с погоней.
  K.isChase = (w, s) => !!K.worldById(w).chase && s === K.worldById(w).levels;
  // Какие способности уже есть у героя в мире w (получены у боссов прошлых миров).
  K.abilitiesFor = (w) => {
    const a = {};
    for (const wd of K.WORLDS) if (wd.id < w && wd.gives) a[wd.gives] = true;
    return a;
  };

  /* ---------- Сюжет ---------- */
  K.STORY = {
    intro: [
      'Казань, 23:47. Миша Котов, курьер службы «Мигом», везёт последний заказ за смену: шаурму с двойным сыром для бабушки Зины с девятого этажа.',
      'Навигатор ведёт короткой дорогой: через крыши и стройку. До конца смены тринадцать минут. Рейтинг курьера: 4,98. Терять нельзя.',
    ],
    worldIntro: {
      1: ['Ночные крыши, краны, неон. Где-то впереди девятый этаж и бабушка Зина.', 'Стрелки или A/D — бег. Пробел, W или стрелка вверх — прыжок. Прыгай врагам на голову.'],
      2: ['Голубиный король уронил термосумку в светящийся люк. Миша прыгнул следом и вывалился в степь: ковыль до горизонта, юрты, дым костров.', 'Орчиха-шаманка Ырна нюхает воздух: «Пахнет вкусно. Хочешь домой, курьер? Собери осколки Разлома. Один у Вожака Волколака»'],
      3: ['Портал выносит Мишу к каменным стенам. Флаги, трубы, стража в латах. Здесь не знают курьеров, зато уважают гонцов.', 'Король обещает помочь, если Миша одолеет Чёрного рыцаря, который держит в страхе весь тракт.'],
      4: ['Грибы ростом с дом, болото, огоньки среди корней. Ведьма Агафья предлагает чай и предупреждает: «Древень не любит гостей. Особенно с шаурмой».', 'В этом лесу много грибов-батутов. Прыгай на шляпку, чтобы взлететь.'],
      5: ['Ледяные пики. Ветер, тишина, лёд скользкий, как пол в торговом центре после уборки. Сверху свисают сосульки.', 'Монахи горы говорят, что проснулся Снежный змей. Огненный шар здесь пригодится: им можно растопить ледяные стены.'],
      6: ['Подземные кузни гномов. Жар, грохот, конвейеры, лава в желобах. Гномы просят: их голем сошёл с ума и громит мастерские.', 'Прыгай от стен, чтобы забираться в шахты. Лава убивает сразу.'],
      7: ['Пустота между мирами. В фиолетовом тумане висят обломки всех миров, где побывал Миша: крыши, юрты, башни, льдины.', 'Навигатор пищит: «До клиента один мир». Впереди ждёт Хранитель Разлома.'],
    },
    bossWin: {
      1: ['Голубиный король повержен, но успевает швырнуть термосумку в люк, светящийся фиолетовым. Миша не раздумывая прыгает следом.'],
      2: ['Волколак убегает в степь, поджав хвост. Ырна дарит Мише пояс ветра.', 'Новое умение: РЫВОК. Shift или X. В рывке Миша неуязвим и сбивает врагов.'],
      3: ['Чёрный рыцарь сдаётся. Под шлемом оказывается усталый дед, которому надоело служить. Король жалует Мише сапоги-скороходы.', 'Новое умение: ДВОЙНОЙ ПРЫЖОК. Нажми прыжок ещё раз в воздухе.'],
      4: ['Древень засыпает, ворча. Ведьма Агафья учит Мишу простому заклинанию, «чтобы шаурму греть».', 'Новое умение: ОГНЕННЫЙ ШАР. C или F. Сжигает врагов и ломает ледяные стены.'],
      5: ['Снежный змей тает и уползает в расщелину. Монахи учат Мишу отталкиваться от стен.', 'Новое умение: ПРЫЖОК ОТ СТЕНЫ. Прижмись к стене в прыжке и нажми прыжок.'],
      6: ['Голем остывает и садится на пол. Гномы чинят Мише разбитый телефон. Навигатор оживает: «Маршрут перестроен. До клиента один мир».'],
      7: ['Хранитель опускает руки. Под капюшоном оказывается курьер в выцветшей куртке. «Я триста лет назад не довёз заказ, — говорит он. — Довези хотя бы ты». И открывает дверь.'],
    },
    ending: [
      'Девятый этаж. Миша звонит в дверь. Открывает бабушка Зина в халате и бигуди.',
      '«Ты где был, милок? Три месяца жду». Она берёт шаурму, нюхает и вздыхает: «Остыла».',
      'Потом улыбается: «Ну ничего. Заходи, разогреем. Расскажешь, где тебя носило». Рейтинг курьера: 5,0.',
    ],
  };

  // Таблички с подсказками в первом уровне.
  K.TUTORIAL = [
    'Стрелки или A/D — бег',
    'Пробел или W — прыжок. Держи дольше, чтобы прыгнуть выше',
    'Прыгай врагам на голову',
    'Флажок сохраняет место',
    'Большие кристаллы — осколки Разлома. На каждом уровне их три',
  ];
})();
