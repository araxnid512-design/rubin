/*
 * Сюжеты и повороты: шифровки командования, дроид с секретом, странник с клинком.
 * Идеи и термины — из далёкой-далёкой галактики, тексты и персонажи — свои.
 */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;
  const Ev = G.Events;
  const def = Ev.def;
  const C = (id) => G.CONFIG.events.list[id];
  const fitPeople = (s) => G.Units.people(s).filter((u) => G.Units.isFit(s, u));
  const needCredits = (n) => (s) => (s.res.credits < n ? 'Нужно ' + n + ' кр.' : null);
  const needPeople = (n) => (s) => (fitPeople(s).length < n ? 'Нужно ' + U.pl(n, F.fighter) + ' в строю' : null);

  // ================= ДИРЕКТИВЫ КОМАНДОВАНИЯ =================
  G.TEXT.directives = {
    types: {
      points: 'Держать под контролем {n} стратегических точек',
      territory: 'Держать под контролем {n} мест округи',
      destroy: 'Уничтожить «{place}»',
      stock: 'Создать запас: {n} сухарей на складе',
      recon: 'Разведать округу: знать {n} мест на карте',
    },
    rewards: { veterans: 'шаттл с двумя ветеранами', credits: G.CONFIG.directives.credits + ' кредитов из фондов сектора', bacta: 'ящик бакты' },
    flavor: [
      'Штаб сектора вышел на связь сквозь помехи. Голос офицера связи сух и деловит: гарнизон «Железного Предела» числится в строю — и от него ждут работы.',
      'Шифровка с печатью разведки флота: аналитики изучили наши донесения и считают, что округу можно взять под руку Империи.',
      'Короткий импульс с орбитального буя. Командование не обещает спасения, но обещает поддержку — тем, кто приносит результат.',
    ],
  };

  def('directive', {
    title: 'Шифровка командования',
    valid: (s, ctx) => !!ctx.d && !s.directive,
    portrait: () => 'fleet',
    text: (s, ctx) => {
      const d = ctx.d;
      return G.TEXT.directives.flavor[(s.day + s.seed) % G.TEXT.directives.flavor.length] + '\n\nДиректива: ' + G.Directives.title(d) +
        '. Срок — до дня ' + d.deadline + '. Награда: ' + G.Directives.rewardText(d) + '.';
    },
    choices: [
      { id: 'accept', label: 'Принять к исполнению', hint: 'За провал срока — удар по дисциплине',
        run(s, ctx) { G.Directives.accept(s, ctx.d); return 'Генерал подписал квитанцию о приёме. Офицеры разошлись по постам — задача ясна.'; } },
      { id: 'decline', label: 'Сослаться на тяжёлое положение', hint: 'Дисциплина −2',
        run(s) { G.Directives.decline(s); G.Res.discipline(s, -2); return 'Ответ ушёл в эфир: «Гарнизон истощён, задача невыполнима». Солдаты слышали, что генерал отказался. Дисциплина −2.'; } },
    ],
  });

  // ================= ДРОИД С СЕКРЕТОМ =================
  def('droid_secret', {
    title: 'Дроид с секретом',
    text: () => 'Джавы притащили к лагерю помятого дроида-астромеханика с остатками имперской маркировки. Он пищит, вертит куполом и наотрез отказывается ' +
      'отдавать содержимое памяти — там зашифрованный пакет высшего допуска. Джавы, почуяв интерес, просят за «умную машинку» ' + C('droid_secret').price + ' кр.',
    choices: [
      { id: 'buy', label: (s) => 'Купить дроида (' + C('droid_secret').price + ' кр.)', req: needCredits(C('droid_secret').price),
        run(s, ctx, rng, E) {
          const c = C('droid_secret');
          E.res(s, { credits: -c.price });
          Ev.schedule(s, 'droid_decoded', c.decodeDays, {});
          return 'Дроида закатили в рубку связи. Связисты обещают вскрыть шифр за пару ночей — если дроид не сожжёт себе память от упрямства.';
        } },
      { id: 'force', label: 'Забрать силой', hint: 'Джавы обидятся надолго', req: needPeople(6),
        run(s, ctx, rng, E) {
          const c = C('droid_secret');
          return U.cap(E.rel(s, 'jawa', c.forceRelation)) + '. ' +
            E.fight(s, rng, { enemy: 'jawa', strength: c.forceStrength, squad: 6, title: 'стычка у краулера', after: 'droid_force' });
        } },
      { id: 'pass', label: 'Не связываться', hint: 'Пакет может попасть не в те руки',
        run(s, ctx) {
          s.flags.droidLost = true;
          Ev.schedule(s, 'beacon_strike', C('droid_secret').ignoreDays, { strength: C('droid_secret').strikeStrength });
          return 'Краулер уполз на юг. Через день дозор заметил его у троп, по которым ходят повстанцы. Нехорошее предчувствие.';
        } },
    ],
  });
  Ev.after.droid_force = function (s, rng, won) {
    if (!won) return 'Джавы отбились и уползли вместе с дроидом.';
    Ev.schedule(s, 'droid_decoded', C('droid_secret').decodeDays, {});
    return 'Дроида унесли в лагерь на руках. Он обиженно свистит, но связисты уже подключают его к пульту.';
  };

  def('droid_decoded', {
    title: 'Пакет расшифрован',
    text: () => 'Двое суток связисты спорили с упрямой машиной — и победили. В пакете карта патрульных маршрутов повстанцев, координаты их тайника ' +
      'и позывные ретрансляционной мачты. Но в коде нашёлся и чужой маячок: кто-то очень хотел, чтобы дроид попал именно к нам.',
    choices: [
      { id: 'jam', label: 'Заглушить маячок и отметить цели', hint: 'Энергия −30',
        run(s, ctx, rng, E) {
          E.res(s, { energy: -30 });
          return revealTargets(s) + ' Маячок замолчал навсегда.';
        } },
      { id: 'trap', label: 'Оставить маячок — пусть придут', hint: 'Ночной бой у лагеря, зато враг будет ослаблен',
        run(s, ctx) {
          Ev.schedule(s, 'beacon_strike', 2, { strength: Math.round(C('droid_secret').strikeStrength * 0.75), trap: true });
          return revealTargets(s) + ' Маячок продолжает пищать. Генерал приказал готовить засаду у северного периметра.';
        } },
    ],
  });
  function revealTargets(s) {
    const out = [];
    for (const id of ['rebel_post', 'relay']) {
      const r = s.regions[id];
      if (!r) continue;
      if (!r.known) out.push('«' + G.Regions.name(id) + '»');
      r.known = true; r.explored = Math.max(r.explored, 40);
    }
    return out.length ? 'На карте появились: ' + out.join(', ') + '.' : 'Цели уже были на карте — теперь о них известно больше.';
  }

  def('beacon_strike', {
    title: 'Ночные гости по маячку',
    text: (s, ctx) => ctx.trap
      ? 'Ровно по графику маячка из темноты вынырнули повстанцы — и угодили в нашу засаду. Бойцы ждали их за мешками с песком.'
      : 'Ночью повстанцы вышли прямо к лагерю: кто-то сообщил им, где стоят наши посты. Пакет из дроида достался не тем.',
    choices: [
      { id: 'fight', label: 'К оружию!',
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'rebels', strength: ctx.strength || 10, squad: 'camp', title: 'ночной бой у периметра', after: 'beacon', ctx: ctx, night: true });
        } },
    ],
  });
  Ev.after.beacon = function (s, rng, won, ctx, E) {
    if (!won) return 'Повстанцы ушли, прихватив часть припасов. ' + E.res(s, { water: -40, scrap: -30 }) + '.';
    G.Res.discipline(s, 3);
    return ctx.trap ? 'Засада сработала как по учебнику. У павших нашли модуль связи. ' + E.item(s, 'commModule', 1) + '.' : 'Атаку отбили. Дисциплина +3.';
  };

  // ================= СТРАННИК С КЛИНКОМ =================
  def('hermit_rumor', {
    title: 'Странник в пещерах',
    cond: (s) => s.regions.windcaves && s.regions.windcaves.known,
    portrait: () => 'hermit',
    text: () => 'Пастухи бант рассказывают у костра: в Пещерах Поющего Ветра живёт странник в плаще. Однажды на него напала банда — он отбил выстрелы ' +
      'светящимся клинком и ушёл, не оглянувшись. Таких, шепчутся офицеры, Империя ищет давно — и платит за них щедро.',
    choices: [
      { id: 'hunt', label: (s) => 'Схватить его (' + U.pl(C('hermit_rumor').squad, F.fighter) + ')', hint: 'Бой с очень опасным противником',
        req: needPeople(C('hermit_rumor').squad),
        run(s, ctx, rng, E) {
          return 'Отряд ушёл к пещерам на закате. ' + E.fight(s, rng, { enemy: 'hermit', strength: 30, squad: C('hermit_rumor').squad, title: 'бой в Поющих пещерах', after: 'hermit_hunt' });
        } },
      { id: 'talk', label: 'Пойти к нему одному, без оружия', hint: 'Странный поступок для генерала',
        run(s) {
          s.flags.hermitAlly = true;
          s.flags.hermitWarn = s.day + 6;
          G.Res.discipline(s, C('hermit_rumor').warnDisc);
          return 'Генерал вернулся под утро и долго молчал. Потом сказал только: «Он предупредил: пустыня собирает бурю — и людей в этой буре. ' +
            'Удвоить посты». А ещё — что странник обещал прийти, «когда небо загорится». Ночные налёты ближайшие дни будут реже. Дисциплина +' + C('hermit_rumor').warnDisc + '.';
        } },
      { id: 'report', label: 'Доложить командованию', hint: '+150 кр., но солдатам это не по душе',
        run(s, ctx, rng, E) {
          s.flags.hermitReported = true;
          return 'Командование ответило мгновенно: «Наблюдать. Не вступать в контакт. Ждать специалистов». На счёт гарнизона пришла премия. ' +
            E.res(s, { credits: 150, discipline: -2 }) + '.';
        } },
      { id: 'leave', label: 'Не трогать', run() { return 'Странник остался легендой у пастушьих костров.'; } },
    ],
  });
  Ev.after.hermit_hunt = function (s, rng, won) {
    if (won) {
      s.flags.hermitBeaten = true;
      G.Res.discipline(s, C('hermit_rumor').discipline);
      return 'Странник упал на колени — и исчез в пыльном вихре. Утром на камнях нашли только оплавленную рукоять. Солдаты будут рассказывать об этом бое годами. Дисциплина +' + C('hermit_rumor').discipline + '.';
    }
    return 'Клинок прошёл сквозь строй, как сквозь сухую траву. Странник ушёл в глубину пещер — живой.';
  };

  // поворот: обещание странника в финальном бою
  const fleet = Ev.defs.fleet_arrival;
  if (fleet) {
    const hold = fleet.choices.find((c) => c.id === 'hold');
    const orig = hold.run;
    hold.run = function (s, ctx, rng, E) {
      if (!s.flags.hermitAlly) return orig(s, ctx, rng, E);
      const FC = G.CONFIG.final;
      const str = FC.finalStrength * (s.flags.rebelMercy ? FC.mercyStrengthMult : 1);
      return 'Генерал вышел к строю: «Ещё один бой. Последний». А из пыльной бури за периметром вышла фигура в плаще — странник сдержал слово. ' +
        E.fight(s, rng, { enemy: FC.finalArmy, strength: str, squad: 'camp', title: 'последний рубеж', after: 'final', allies: [{ type: 'hermit' }] });
    };
  }

  G.TEXT.medals.directives = { name: 'Верный присяге', desc: 'Выполнить три директивы командования.' };
  G.TEXT.medals.hermit = { name: 'Охотник за тенью', desc: 'Одолеть странника с клинком.' };
  G.TEXT.rules += '\n\n' +
    'Директивы. Время от времени штаб сектора присылает шифровку с заданием на срок. Выполните — получите награду (ветеранов шаттлом, кредиты, бакту); ' +
    'провалите — упадёт дисциплина. Текущая директива видна в штабе.\n\n' +
    'Сюжеты. В пустыне случается разное: дроиды с чужими секретами, странники со светящимися клинками. Решения имеют последствия — иногда через много дней.';
})(globalThis.G = globalThis.G || {});
