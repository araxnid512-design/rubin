/*
 * События новых фракций: влагофермеры, гильдия охотников, падальщики, дезертиры.
 * Числа — в CONFIG.events.list и CONFIG.factions. Все персонажи оригинальные.
 */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;
  const Ev = G.Events;
  const def = Ev.def;
  const C = (id) => G.CONFIG.events.list[id];
  const FC = () => G.CONFIG.factions;
  const R = (rng, r) => U.rollRange(rng, r);
  const rel = (s, f) => s.relations[f] || 0;
  const fitPeople = (s) => G.Units.people(s).filter((u) => G.Units.isFit(s, u));
  const needCredits = (n) => (s) => (s.res.credits < n ? 'Нужно ' + n + ' кр.' : null);
  const needRes = (k, n) => (s) => (s.res[k] < n ? 'Нужно: ' + n + ' ' + G.TEXT.res[k].gen : null);
  const needPeople = (n) => (s) => (fitPeople(s).length < n ? 'Нужно ' + U.pl(n, F.fighter) + ' в строю' : null);

  function recruit(s, rng, n, xp, origin) {
    const list = [];
    for (let i = 0; i < n; i++) list.push(G.Units.createTrooper(s, rng, { xp: R(rng, xp), health: rng.int(70, 100), origin: origin }));
    return list;
  }

  // ================= ВЛАГОФЕРМЕРЫ =================
  def('farm_plea', {
    title: 'Гонец с влагофермы',
    cond: (s) => s.regions.anchorhead.known && !s.flags.hostile_farmers,
    text: () => 'На закате в лагерь влетел мальчишка на дребезжащем спидере: таскены окружили влагоферму у Анкорхеда. Фермеры отстреливаются, но патроны на исходе. «Говорят, имперцы умеют воевать. Помогите — не забудем».',
    choices: [
      { id: 'help', label: (s) => 'Выслать отряд на помощь (' + U.pl(C('farm_plea').squad, F.fighter) + ')', hint: 'Фермеры будут сражаться рядом',
        req: needPeople(C('farm_plea').squad),
        run(s, ctx, rng, E) {
          const c = C('farm_plea');
          s.flags.contact_farmers = true;
          const allies = [];
          for (let i = 0; i < c.allies; i++) allies.push({ type: 'farmer' });
          return 'Отряд ушёл в ночь вслед за мальчишкой. ' + E.fight(s, rng, { enemy: 'tusken', strength: c.strength, squad: c.squad, title: 'бой у влагофермы', after: 'farm_help', allies: allies });
        } },
      { id: 'supply', label: (s) => 'Отправить оружие и бакту (' + C('farm_plea').supplyCredits + ' кр.)', req: needCredits(C('farm_plea').supplyCredits),
        run(s, ctx, rng, E) {
          const c = C('farm_plea');
          E.res(s, { credits: -c.supplyCredits });
          s.flags.contact_farmers = true;
          return 'Мальчишка увёз ящик с батареями и бактой. ' + U.cap(E.rel(s, 'farmers', c.supplyRelation)) + '.';
        } },
      { id: 'refuse', label: 'Не наше дело',
        run(s, ctx, rng, E) { return 'Мальчишка уехал, не оглядываясь. ' + U.cap(E.rel(s, 'farmers', C('farm_plea').refuseRelation)) + '.'; } },
    ],
  });
  Ev.after.farm_help = function (s, rng, won, ctx, E) {
    const c = C('farm_plea');
    if (!won) return 'Ферму отстоять не удалось, но фермеры видели, что имперцы пришли на помощь. ' + U.cap(E.rel(s, 'farmers', 4)) + '.';
    const r = E.res(s, { water: c.water });
    return 'Таскены отброшены! Хозяин фермы выкатил бочки: ' + r + '. ' + U.cap(E.rel(s, 'farmers', c.relation)) + '.';
  };

  def('farm_fair', {
    title: 'Ярмарка в Анкорхеде',
    cond: (s) => rel(s, 'farmers') >= C('farm_fair').minRelation && !s.flags.hostile_farmers,
    text: () => 'Фермеры зовут гарнизон на ярмарку урожая: печёные корни, музыка, гонки на старых спидерах. Впервые за долгое время — не бой и не работа.',
    choices: [
      { id: 'go', label: (s) => 'Отпустить бойцов на праздник (' + C('farm_fair').credits + ' кр.)', req: needCredits(C('farm_fair').credits),
        run(s, ctx, rng, E) {
          const c = C('farm_fair');
          const r = E.res(s, { credits: -c.credits, discipline: c.discipline });
          E.rel(s, 'farmers', c.relation);
          return 'Солдаты вернулись к полуночи — уставшие, сытые и с новыми друзьями: ' + r + '.';
        } },
      { id: 'no', label: 'Не до праздников', run: () => 'Ярмарка прошла без имперцев.' },
    ],
  });

  // ================= ГИЛЬДИЯ ОХОТНИКОВ =================
  def('bounty_posted', {
    title: 'Награда за голову генерала',
    cond: (s) => !s.flags.bounty,
    text: () => 'Связисты перехватили открытую передачу гильдии охотников за головами: за генерала Колрата назначена награда — живым или мёртвым. Заказчик не назван. Догадаться нетрудно.',
    choices: [
      { id: 'guard', label: 'Удвоить караулы у рубки', hint: 'Теперь по ночам возможны покушения',
        run(s, ctx, rng, E) {
          s.flags.bounty = true;
          s.flags.contact_guild = true;
          return 'Караулы удвоены. Солдаты переглядываются: генерал теперь мишень — значит, и все рядом с ним. ' + U.cap(E.disc(s, 2)) + '.';
        } },
      { id: 'rumor', label: 'Пустить слух о гибели генерала', hint: 'Может, охотники поверят',
        run(s, ctx, rng, E) {
          const c = C('bounty_posted');
          s.flags.contact_guild = true;
          if (rng.chance(c.rumorChance)) return 'Слух разошёлся по кантинам Мос-Эспы: генерал погиб при крушении. Гильдия сняла заказ.';
          s.flags.bounty = true;
          return 'Слуху не поверили — охотники видели генерала в бинокль. ' + U.cap(E.disc(s, c.rumorDisc)) + '.';
        } },
    ],
  });

  def('assassin_night', {
    title: 'Охотники в лагере',
    cond: (s) => G.Factions.bounty(s),
    text: () => 'Тень у кормового шлюза. Часовой успел крикнуть «Тревога!» — и упал. В лагере охотники за головами, и они пришли за генералом.',
    choices: [
      { id: 'fight', label: 'Взять их!',
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'guild', strength: C('assassin_night').strength, squad: 'camp', title: 'ночь охотников', after: 'assassin', night: true });
        } },
      { id: 'hide', label: 'Укрыть генерала в рубке и задраить шлюзы', hint: 'Охотники уйдут, но разграбят склад',
        run(s, ctx, rng, E) {
          const c = C('assassin_night');
          const r = E.res(s, { scrap: -c.hideScrap, energy: -c.hideEnergy, discipline: -2 });
          return 'Шлюзы задраены. До рассвета охотники хозяйничали на складе: ' + r + '.';
        } },
    ],
  });
  Ev.after.assassin = function (s, rng, won, ctx, E) {
    if (won) { E.rel(s, 'guild', -5); return 'Охотники ушли с пустыми руками. Гильдия запомнит этот провал.'; }
    E.disc(s, -5);
    return 'Охотники прорвались к рубке. Генерал отстреливался из личного бластера и остался жив, но лагерь потрясён.';
  };

  def('guild_offer', {
    title: 'Агент гильдии',
    cond: (s) => (s.flags.contact_guild || G.Factions.contact(s, 'guild')) && !s.flags.hostile_guild,
    text: () => 'Агент гильдии — пожилой забрак с аккуратной бородкой — пришёл в лагерь один и без оружия. «Гильдия не воюет. Гильдия работает. Давайте поговорим о работе».',
    choices: [
      { id: 'hire', label: (s) => 'Нанять охотника за головами (' + C('guild_offer').hirePrice + ' кр.)', hint: 'Опытный боец-наёмник',
        req: needCredits(C('guild_offer').hirePrice),
        run(s, ctx, rng, E) {
          E.res(s, { credits: -C('guild_offer').hirePrice });
          const u = G.Units.createMerc(s, rng, { xp: 320 });
          u.num = 'охотник за головами';
          u.origin = 'hunter';
          u.name = rng.pick(['Кайро Вейн', 'Тасса Дрейг', 'Ормак', 'Вел-Зарр', 'Ниш Корта']);
          E.rel(s, 'guild', 5);
          return 'Контракт подписан. В лагере новый боец: ' + u.name + ' — охотник за головами с тремя десятками заказов за плечами.';
        } },
      { id: 'payoff', label: (s) => 'Выкупить снятие награды (' + C('guild_offer').payoff + ' кр.)', show: (s) => G.Factions.bounty(s),
        req: needCredits(C('guild_offer').payoff),
        run(s, ctx, rng, E) {
          const c = C('guild_offer');
          E.res(s, { credits: -c.payoff });
          s.flags.bounty = false;
          return 'Агент спрятал кредиты: «Заказ закрыт по просьбе цели. Бывает». ' + U.cap(E.rel(s, 'guild', c.payoffRelation)) + '.';
        } },
      { id: 'no', label: 'Отказаться', run: () => 'Агент вежливо поклонился и ушёл. Гильдия умеет ждать.' },
    ],
  });

  // ================= ПАДАЛЬЩИКИ ДЮН =================
  def('scav_theft', {
    title: 'Падальщики на обломках',
    cond: (s) => !s.flags.hostile_scavengers && rel(s, 'scavengers') < FC().scavengersPeace,
    text: () => 'Ночью часовые услышали лязг: на дальнем конце обломков кто-то режет обшивку плазменным резаком. Падальщики Дюн пришли за нашим металлом.',
    choices: [
      { id: 'fight', label: 'Отогнать огнём',
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'scavengers', strength: C('scav_theft').strength, squad: 'camp', title: 'стычка с падальщиками', after: 'scav_fight', night: true });
        } },
      { id: 'deal', label: 'Предложить сделку: часть металла за кредиты', hint: 'Падальщики станут дружелюбнее',
        req: needRes('scrap', C('scav_theft').dealScrap),
        run(s, ctx, rng, E) {
          const c = C('scav_theft');
          const r = E.res(s, { scrap: -c.dealScrap, credits: c.dealCredits });
          E.rel(s, 'scavengers', c.dealRelation);
          s.flags.contact_scavengers = true;
          const rv = E.reveal(s, 'junkyard');
          return 'Вожак падальщиков согласился: металл в обмен на кредиты и мир: ' + r + '.' + (rv ? ' Он оставил координаты свалки — ' + rv + '.' : '');
        } },
      { id: 'ignore', label: 'Сделать вид, что не заметили',
        run(s, ctx, rng, E) {
          const c = C('scav_theft');
          const r = E.res(s, { scrap: -c.ignoreScrap });
          E.rel(s, 'scavengers', c.ignoreRelation);
          return 'К утру от одной из секций обшивки остались только крепления: ' + r + '.';
        } },
    ],
  });
  Ev.after.scav_fight = function (s, rng, won, ctx, E) {
    if (won) {
      E.rel(s, 'scavengers', -10);
      const r = E.res(s, { scrap: rng.int(15, 35) });
      return 'Падальщики бежали, бросив резаки и тележки: ' + r + '.';
    }
    const r = E.res(s, { scrap: -rng.int(40, 80) });
    return 'Падальщики ушли, утащив добычу: ' + r + '.';
  };

  def('scav_caravan', {
    title: 'Тягач падальщиков',
    cond: (s) => !s.flags.hostile_scavengers && rel(s, 'scavengers') >= C('scav_caravan').minRelation,
    text: () => 'К лагерю подполз гусеничный тягач падальщиков с прицепом, доверху набитым металлом. Вожак свистнул с кабины: «Генерал! Есть товар для хороших соседей».',
    choices: [
      { id: 'speeder', label: (s) => 'Купить спидер-байк (' + C('scav_caravan').speederPrice + ' кр.)', req: needCredits(C('scav_caravan').speederPrice),
        run(s, ctx, rng, E) {
          E.res(s, { credits: -C('scav_caravan').speederPrice });
          const v = G.Progress.addVehicle(s, rng, 'speeder', true);
          v.health = 75;
          return 'Спидер собран из трёх разных машин, но летает. ' + G.Progress.vehicleName(v) + ' — наш.';
        } },
      { id: 'kit', label: (s) => 'Купить турель (' + C('scav_caravan').kitPrice + ' кр.)', req: needCredits(C('scav_caravan').kitPrice),
        run(s, ctx, rng, E) {
          E.res(s, { credits: -C('scav_caravan').kitPrice });
          G.Camp.ensure(s).kits.turret = (s.camp.kits.turret || 0) + 1;
          return 'Турель сгрузили у шлюза — её можно поставить в лагере.';
        } },
      { id: 'trade', label: 'Поторговать', hint: 'Падальщики хорошо платят за металл',
        run(s, ctx, rng, E) { E.next(G.Trade.make(s, 'junkyard')); return 'Вожак спрыгнул с кабины и раскрыл прицеп.'; } },
      { id: 'no', label: 'Ничего не нужно', run: () => 'Тягач уполз обратно в дюны.' },
    ],
  });

  // ================= ДЕЗЕРТИРЫ АВАНПОСТА =================
  def('deserter_signal', {
    title: 'Чужие позывные',
    text: () => 'Связисты поймали позывной на старой имперской частоте: аванпост связи в Юндландских скалах. На запрос ответили не по уставу: «Здесь никто никому не служит. Не подходите».',
    choices: [
      { id: 'envoy', label: (s) => 'Отправить парламентёров с водой (' + C('deserter_signal').envoyWater + ' л)', req: needRes('water', C('deserter_signal').envoyWater),
        run(s, ctx, rng, E) {
          const c = C('deserter_signal');
          const rv = E.reveal(s, 'outpost');
          s.flags.contact_deserters = true;
          E.res(s, { water: -c.envoyWater });
          return 'Парламентёров не пустили за ворота, но воду взяли. ' + U.cap(E.rel(s, 'deserters', c.envoyRelation)) + '.' + (rv ? ' ' + U.cap(rv) + '.' : '');
        } },
      { id: 'note', label: 'Принять к сведению',
        run(s, ctx, rng, E) {
          s.flags.contact_deserters = true;
          const rv = E.reveal(s, 'outpost');
          return 'Координаты аванпоста записаны.' + (rv ? ' ' + U.cap(rv) + '.' : '');
        } },
    ],
  });

  def('deserter_defectors', {
    title: 'Перебежчики',
    cond: (s) => s.regions.outpost.known && !s.regions.outpost.cleared && rel(s, 'deserters') >= C('deserter_defectors').minRelation,
    prepare(s, ctx, rng) { ctx.n = R(rng, C('deserter_defectors').count); },
    text: (s, ctx) => 'У периметра стоят ' + U.pl(ctx.n, F.man) + ' в серой броне с красными повязками. Оружие опущено, шлемы сняты. «Мы с аванпоста. Надоело прятаться. Возьмёте обратно?»',
    choices: [
      { id: 'accept', label: 'Принять в строй', hint: 'Опытные бойцы. Старые солдаты будут ворчать',
        run(s, ctx, rng, E) {
          const c = C('deserter_defectors');
          const list = recruit(s, rng, ctx.n, c.xp, 'defector');
          E.disc(s, c.disc);
          E.rel(s, 'deserters', 3);
          return 'Красные повязки сорваны, броню перекрасят. В строю: ' + E.names(list) + '.';
        } },
      { id: 'refuse', label: 'Отказать',
        run(s, ctx, rng, E) { return 'Перебежчики молча ушли обратно в скалы. ' + U.cap(E.rel(s, 'deserters', C('deserter_defectors').refuseRelation)) + '.'; } },
    ],
  });

  def('deserter_raid', {
    title: 'Налёт дезертиров',
    cond: (s) => s.regions.outpost.known && !s.regions.outpost.cleared && rel(s, 'deserters') <= C('deserter_raid').maxRelation,
    text: () => 'Ночью из темноты ударили бластеры — точно, по-уставному, короткими очередями. Дезертиры с аванпоста пришли за водой и металлом.',
    choices: [
      { id: 'fight', label: 'Занять оборону',
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'deserters', strength: C('deserter_raid').strength, squad: 'camp', title: 'ночной бой с дезертирами', after: 'deserter_raid', night: true });
        } },
      { id: 'pay', label: 'Отдать воду и не стрелять (60 л)', req: needRes('water', 60),
        run(s, ctx, rng, E) {
          const r = E.res(s, { water: -60, discipline: -3 });
          E.rel(s, 'deserters', 2);
          return 'Канистры выкатили за периметр. Дезертиры забрали их и ушли: ' + r + '.';
        } },
    ],
  });
  Ev.after.deserter_raid = function (s, rng, won, ctx, E) {
    if (won) { E.rel(s, 'deserters', -5); return 'Дезертиры отступили к скалам.'; }
    const r = E.res(s, { water: -rng.int(50, 100), scrap: -rng.int(30, 60) });
    return 'Дезертиры прорвались к складу: ' + r + '.';
  };

  def('deserter_return', {
    title: 'Возвращение под знамёна',
    cond: (s) => rel(s, 'deserters') >= FC().desertersJoin && !s.regions.outpost.cleared,
    prepare(s, ctx, rng) { ctx.n = R(rng, C('deserter_return').count); },
    text: (s, ctx) => 'Капитан аванпоста пришёл в лагерь сам — в полной форме, с вычищенной бронёй. «Мой гарнизон — ' + U.pl(ctx.n, F.man) + ' — готов вернуться под знамёна. Если вы примете нас, генерал».',
    choices: [
      { id: 'accept', label: 'Принять весь гарнизон', hint: 'Ветераны и всё, что осталось на аванпосте',
        run(s, ctx, rng, E) {
          const c = C('deserter_return');
          const list = recruit(s, rng, ctx.n, c.xp, 'defector');
          s.regions.outpost.cleared = true;
          s.flags.deserters_joined = true;
          const r = E.res(s, { discipline: c.disc, scrap: 60, water: 80 });
          return 'Над аванпостом снова поднят флаг. В лагерь пришли ' + U.pl(list.length, F.fighter) + ' и привезли запасы: ' + r + '.';
        } },
      { id: 'refuse', label: 'Предатели не нужны',
        run(s, ctx, rng, E) { return 'Капитан отдал честь и ушёл. ' + U.cap(E.rel(s, 'deserters', -15)) + '.'; } },
    ],
  });
})(globalThis.G = globalThis.G || {});
