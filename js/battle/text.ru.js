/* Тексты для лога боя: имена в падежах, описания места, фразы. */
(function (G) {
  'use strict';
  const T = () => G.BattleMap.T;

  // nom — именительный, acc — винительный падеж
  const NAMES = {
    tusken: ['таскен-налётчик', 'таскена-налётчика'],
    tusken_rifle: ['таскен-стрелок', 'таскена-стрелка'],
    tusken_chief: ['вожак таскенов', 'вожака таскенов'],
    jawa: ['джава', 'джаву'],
    bandit: ['бандит', 'бандита'],
    swoop: ['свупер', 'свупера'],
    bandit_boss: ['главарь банды', 'главаря банды'],
    rebel: ['повстанец', 'повстанца'],
    rebel_heavy: ['пулемётчик повстанцев', 'пулемётчика повстанцев'],
    rebel_officer: ['офицер повстанцев', 'офицера повстанцев'],
    smuggler: ['контрабандист', 'контрабандиста'],
    gamorrean: ['гаморреанец-стражник', 'гаморреанца-стражника'],
    hutt_guard: ['наёмник хатта', 'наёмника хатта'],
    krayt: ['крайт-дракон', 'крайт-дракона'],
    bounty_hunter: ['охотник за головами', 'охотника за головами'],
    assassin_droid: ['дроид-убийца', 'дроида-убийцу'],
    scavenger: ['падальщик', 'падальщика'],
    scav_droid: ['ржавый дроид', 'ржавого дроида'],
    scav_boss: ['вожак падальщиков', 'вожака падальщиков'],
    deserter: ['дезертир', 'дезертира'],
    deserter_heavy: ['пулемётчик-дезертир', 'пулемётчика-дезертира'],
    deserter_captain: ['капитан дезертиров', 'капитана дезертиров'],
    farmer: ['фермер-ополченец', 'фермера-ополченца'],
    trooper: ['штурмовик', 'штурмовика'],
    droid: ['дроид', 'дроида'],
    turret: ['турель', 'турель'],
    walker: ['шагоход', 'шагоход'],
  };
  // Родительный падеж множественного числа — для «позиция таскенов»
  const GROUP = {
    tusken: 'таскенов', tusken_camp: 'таскенов', jawa: 'джав', bandits: 'бандитов', rebels: 'повстанцев',
    smugglers: 'контрабандистов', hutt_guard: 'стражи хатта', krayt: 'дракона',
    guild: 'охотников', scavengers: 'падальщиков', deserters: 'дезертиров',
  };

  const BT = {};
  BT.nom = (type) => (NAMES[type] || [type])[0];
  BT.acc = (type) => (NAMES[type] || [type, type])[1];
  BT.group = (army) => GROUP[army] || 'противника';

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function pick(B, arr) { return arr[(B.t * 7 + B.log.length * 3) % arr.length]; }

  // Где находится клетка: «у скалы», «за обломками», «на дюне»…
  BT.place = function (B, x, y) {
    const t = T();
    let rock = false, wreck = false, wall = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const c = G.BattleMap.get(B.map, x + dx, y + dy);
      if (x + dx < 0 || y + dy < 0 || x + dx >= B.W || y + dy >= B.H) continue;
      if (c === t.ROCK) rock = true;
      if (c === t.WRECK) wreck = true;
      if (c === t.WALL) wall = true;
    }
    if (wall) return 'за баррикадой';
    if (wreck) return 'за обломками';
    if (rock) return 'у скалы';
    if (G.BattleMap.get(B.map, x, y) === t.DUNE) return 'на дюне';
    return 'на открытом песке';
  };

  const ownName = (u) => (u.side === 0 ? u.label : BT.nom(u.type));
  const ownAcc = (u) => (u.side === 0 ? u.label : BT.acc(u.type));

  BT.start = function (B) {
    const tac = { assault: 'штурм', defense: 'оборона', flank: 'обход с флангов' }[B.sides[0].tactic] || 'штурм';
    return 'Бой начался. Тактика: ' + tac + '.';
  };

  BT.down = function (B, e, src) {
    const place = BT.place(B, e.x, e.y);
    if (e.side === 1) {
      if (!src) return cap(BT.nom(e.type)) + ' погиб ' + place + '.';
      return pick(B, [
        cap(src.label) + ' снял ' + BT.acc(e.type) + ' ' + place + '.',
        cap(src.label) + ' точным выстрелом уложил ' + BT.acc(e.type) + ' ' + place + '.',
        cap(src.label) + ' добил ' + BT.acc(e.type) + ' ' + place + '.',
        cap(BT.nom(e.type)) + ' ' + place + ' падает под огнём: стрелял ' + src.label + '.',
      ]);
    }
    const what = e.type === 'droid' || e.type === 'turret' || e.type === 'walker' ? 'выведен из строя' : 'ранен и выбыл из боя';
    return cap(e.label) + ' ' + what + ' ' + place + (src ? ' — его достал ' + BT.nom(src.type) : '') + '.';
  };

  BT.leaderDown = function (B, e) {
    return e.side === 1 ? 'Вожак противника пал — враг дрогнул!' : 'Командир отделения выбыл — бойцы растеряны.';
  };

  BT.suppress = function (B, u, e) {
    const place = BT.place(B, e.x, e.y);
    if (u.side === 0) return cap(u.label) + ' подавил огнём позицию ' + BT.group(B.setup.army) + ' ' + place + '.';
    return cap(BT.nom(u.type)) + ' прижал огнём наших бойцов ' + place + '.';
  };

  BT.order = function (id, B, target) {
    switch (id) {
      case 'focus': return 'Приказ генерала: «Сосредоточить огонь!» Цель — ' + BT.nom(target.type) + ' ' + BT.place(B, target.x, target.y) + '.';
      case 'hold': return 'Приказ генерала: «Держать строй!» Бойцы сжимают зубы и остаются на позициях.';
      case 'smoke': return 'Приказ генерала: «Дымы!» Завеса закрывает отряд от вражеских стрелков.';
      case 'rush': return 'Приказ генерала: «Рывком — вперёд!»';
      case 'grenade': return 'Приказ генерала: «Гранаты!» Залп термодетонаторов накрывает ' + BT.group(B.setup.army) + ' ' + BT.place(B, target.x, target.y) + '.';
      case 'medkit': return 'Приказ генерала: «Медпакеты!» Раненые получают бакту прямо на позициях.';
    }
    return '';
  };

  BT.broken = function (B, u) {
    if (u.side === 0) return cap(u.label) + ' дрогнул и бежит с позиции.';
    return cap(BT.nom(u.type)) + ' бросает позицию и бежит.';
  };

  BT.retreat = function (B, side) {
    return side === 0 ? 'Потери слишком велики — отряд отходит.' : 'Противник отступает!';
  };

  BT.end = function (B) {
    const r = B.reason;
    if (B.winner === 0) return r === 'enemyRetreat' ? 'Противник бежал. Поле боя за нами.' : r === 'timeout' ? 'Позиция удержана.' : 'Победа! Противник уничтожен.';
    return r === 'retreat' ? 'Отряд отступил.' : r === 'timeout' ? 'Взять позицию не удалось.' : 'Поражение.';
  };

  G.BattleText = BT;
})(globalThis.G = globalThis.G || {});
