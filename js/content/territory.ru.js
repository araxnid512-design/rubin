/* Территории: контратака врага на наше место. Тексты свои. */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;
  const Ev = G.Events;
  const K = () => G.CONFIG.territory;
  const fitPeople = (s) => G.Units.people(s).filter((u) => G.Units.isFit(s, u));
  const GROUP = { tusken: 'Таскены', tusken_camp: 'Таскены', bandits: 'Бандиты', scavengers: 'Падальщики', deserters: 'Дезертиры', rebels: 'Повстанцы',
    hutt_guard: 'Люди хатта', militia: 'Ополчение фермеров', guild: 'Охотники за головами', jawa: 'Джавы', smugglers: 'Контрабандисты' };

  Ev.def('counterattack', {
    title: 'Контратака',
    valid: (s, ctx) => G.Territory.owned(s, ctx.region),
    portrait: (s, ctx) => ({ tusken: 'tusken', tusken_camp: 'tusken', bandits: 'bandit', scavengers: 'scavenger', deserters: 'deserter', hutt_guard: 'rodian', militia: 'farmer', rebels: 'rebel' }[ctx.army] || 'trooper'),
    text: (s, ctx) => (GROUP[ctx.army] || 'Враги') + ' пытаются отбить «' + G.Regions.name(ctx.region) + '». Патруль на позиции держится, но долго не продержится. ' +
      'Если отправить подкрепление сейчас — место останется за нами.',
    choices: [
      { id: 'hold', label: (s) => 'Держать позицию (' + U.pl(K().counter.squad, F.fighter) + ')', hint: 'Бой на месте',
        req: (s) => (fitPeople(s).length < 4 ? 'Некого отправить' : null),
        run(s, ctx, rng, E) {
          return 'Подкрепление ушло к «' + G.Regions.name(ctx.region) + '». ' +
            E.fight(s, rng, { enemy: ctx.army, strength: ctx.strength, squad: K().counter.squad, title: 'бой за «' + G.Regions.name(ctx.region) + '»', after: 'hold_region', ctx: ctx });
        } },
      { id: 'leave', label: 'Отступить и оставить место', hint: 'Без боя, но без дохода',
        run(s, ctx) {
          G.Territory.lose(s, ctx.region, 'отступили без боя');
          return 'Патруль отошёл к лагерю. «' + G.Regions.name(ctx.region) + '» больше не наше.';
        } },
    ],
  });
  Ev.after.hold_region = function (s, rng, won, ctx, E) {
    if (won) { G.Res.discipline(s, K().holdDiscipline); return 'Позиция удержана — «' + G.Regions.name(ctx.region) + '» остаётся за нами.'; }
    G.Territory.lose(s, ctx.region, 'враг отбил позицию');
    return 'Удержать не вышло: «' + G.Regions.name(ctx.region) + '» потеряно.';
  };

  G.TEXT.medals.territory = { name: 'Хозяин пустоши', desc: 'Держать под контролем шесть мест.' };
  G.TEXT.rules += '\n\n' +
    'Территории. Приказом «Атака» можно напасть на любое известное место: пустошь — зачистить от тех, кто устраивает засады; поселение — захватить ' +
    '(его фракция станет врагом); вражеский лагерь — разгромить. Взятое место становится нашим: каждый день даёт сухари, металл или дань кредитами, ' +
    'засад там почти нет. Но враги будут пытаться его отбить — тогда решайте, держать позицию или отступить.';
})(globalThis.G = globalThis.G || {});

/* Штурм в несколько этапов и стратегические точки. */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;
  const Ev = G.Events;

  G.TEXT.siege = {
    base: ['внешние посты', 'прорыв за укрепления', 'последний рубеж'],
    base2: ['завалы и засеки', 'логово вожака'],
    town: ['окраины', 'центр поселения'],
    point: ['подступы', 'захват объекта'],
  };

  const alive = (s, ids) => (ids || []).filter((id) => { const u = G.Units.byId(s, id); return u && G.Units.isAlive(u) && G.Units.isFit(s, u); });
  const reserve = (s, ids) => G.Game.freeUnits(s).filter((u) => ids.indexOf(u.id) < 0).slice(0, 8).map((u) => u.id);

  Ev.def('siege_next', {
    title: 'Штурм продолжается',
    valid: (s, ctx) => !!ctx.region && !G.Territory.owned(s, ctx.region),
    portrait: () => 'general',
    text: (s, ctx) => {
      const prev = G.Territory.stageName(s, ctx.region, ctx.stage - 1);
      const next = G.Territory.stageName(s, ctx.region, ctx.stage);
      return 'Этап «' + prev + '» взят — защитники «' + G.Regions.name(ctx.region) + '» дрогнули. Впереди: ' + next + ' (этап ' + ctx.stage + ' из ' + ctx.stages + '). ' +
        'В строю ' + U.pl(alive(s, ctx.ids).length, F.fighter) + ', тяжелораненых унесли к лагерю. Враг подтягивает резервы: если отойти, позиции удержим ' +
        U.pl(G.CONFIG.territory.siegeDays, ['день', 'дня', 'дней']) + '.';
    },
    choices: [
      { id: 'push', label: (s, ctx) => 'Продолжить штурм (' + U.pl(alive(s, ctx.ids).length, F.fighter) + ')', hint: 'Сразу, пока враг не опомнился',
        req: (s, ctx) => (alive(s, ctx.ids).length < 3 ? 'Слишком мало бойцов в строю' : null),
        run(s, ctx, rng, E) {
          E.next(G.BattleFlow.siegeBattle(s, rng, ctx.region, ctx.stage, alive(s, ctx.ids)));
          return 'Генерал махнул рукой вперёд — отряд пошёл на ' + G.Territory.stageName(s, ctx.region, ctx.stage) + '.';
        } },
      { id: 'reserve', label: (s, ctx) => 'Ввести резерв из лагеря (+' + reserve(s, alive(s, ctx.ids)).length + ')', hint: 'Свежие бойцы присоединятся к штурму',
        show: (s, ctx) => reserve(s, alive(s, ctx.ids)).length > 0,
        run(s, ctx, rng, E) {
          const ids = alive(s, ctx.ids);
          const all = ids.concat(reserve(s, ids));
          E.next(G.BattleFlow.siegeBattle(s, rng, ctx.region, ctx.stage, all));
          return 'Из лагеря подошёл резерв. Объединённый отряд идёт на ' + G.Territory.stageName(s, ctx.region, ctx.stage) + '.';
        } },
      { id: 'dig', label: 'Закрепиться и отойти', hint: 'Следующая атака начнётся с этого этапа',
        run(s, ctx) {
          return 'Отряд закрепился на взятых позициях и отошёл на перевязку. Следующая атака на «' + G.Regions.name(ctx.region) + '» начнётся с этапа ' + ctx.stage + '.';
        } },
    ],
  });

  G.TEXT.points = {
    relay: 'Ретранслятор: шаттлы перехватывают вдвое реже, терминал дешевле на 10%, на доске заказов больше предложений.',
    sensor: 'Сенсорная вышка: ночных налётов меньше на 30%, засад — на 20% по всей округе.',
    depot: 'Продовольственный склад: +16 сухарей в сутки.',
    battery: 'Турбобатарея: перед каждым боем её залп ослабляет врагов (−15% здоровья).',
    power: 'Солнечная ферма: +12 энергии в сутки.',
  };
  G.TEXT.rules += '\n\n' +
    'Штурм. Вражеские лагеря берутся в три этапа, поселения и стратегические точки — в два. После каждого взятого этапа можно сразу идти дальше, ' +
    'ввести резерв из лагеря или закрепиться и отойти: прогресс держится несколько дней.\n\n' +
    'Стратегические точки (фиолетовые на карте): ретранслятор, сенсорная вышка, продовольственный склад, турбобатарея, солнечная ферма. ' +
    'Пока точка наша, её бонус действует на весь лагерь.';
})(globalThis.G = globalThis.G || {});
