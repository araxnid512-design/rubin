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
