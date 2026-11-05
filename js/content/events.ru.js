/*
 * События Татуина: тексты и варианты выбора. Все числа — в CONFIG.events.list.
 * Тексты написаны специально для этой игры.
 */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;
  const Ev = G.Events;
  const def = Ev.def;
  const C = (id) => G.CONFIG.events.list[id];
  const R = (rng, r) => U.rollRange(rng, r);
  const fitPeople = (s) => G.Units.people(s).filter((u) => G.Units.isFit(s, u));
  const fitDroids = (s) => G.Units.droids(s).filter((u) => G.Units.isFit(s, u));
  const needCredits = (n) => (s) => (s.res.credits < n ? 'Нужно ' + n + ' кр.' : null);
  const needRes = (k, n) => (s) => (s.res[k] < n ? 'Нужно: ' + n + ' ' + G.TEXT.res[k].gen : null);
  const needPeople = (n) => (s) => (fitPeople(s).length < n ? 'Нужно ' + U.pl(n, F.fighter) + ' в строю' : null);

  function desert(s, rng, n) {
    const cands = rng.shuffle(G.Units.troopers(s).filter((u) => u.status === 'ok' && u.health >= 40));
    const gone = cands.slice(0, n);
    for (const u of gone) { u.status = 'deserted'; u.diedDay = s.day; s.stats.deserted++; }
    return gone;
  }

  // ---------------------------------------------------------------- Песчаная буря
  def('sandstorm', {
    title: 'Песчаная буря',
    text: (s, ctx, rng) => rng.pick([
      'К полудню горизонт на юге потемнел, а потом начал расти. Стена песка высотой с корабельную надстройку идёт прямо на лагерь. У вас меньше часа.',
      'Ветер сменился резко, без всякого предупреждения. Через несколько минут небо стало бурым, и первые порывы ударили по обшивке, как шрапнель.',
    ]),
    choices: [
      { id: 'wait', label: 'Задраить отсеки и переждать', hint: 'Часть запасов под открытым небом пропадёт',
        run(s, ctx, rng, E) {
          const c = C('sandstorm');
          const r = E.res(s, { water: -R(rng, c.waterLoss), scrap: -R(rng, c.scrapLoss), discipline: c.waitDisc });
          return 'Буря выла до глубокой ночи. Утром откопали шлюзы; то, что лежало снаружи, пропало: ' + r + '.';
        } },
      { id: 'droids', label: 'Выслать дроидов укрыть склад и влагоуловители', hint: 'Дроиды не дышат пылью, но износятся',
        show: (s) => fitDroids(s).length > 0, req: needRes('energy', C('sandstorm').droidEnergy),
        run(s, ctx, rng, E) {
          const c = C('sandstorm');
          E.res(s, { energy: -c.droidEnergy });
          for (const d of fitDroids(s)) G.Units.damage(s, d, R(rng, c.droidDamage), 'занесён песком');
          return 'Дроиды несколько часов стояли в самом пекле бури, прикрывая брезентом склад. Запасы целы, но песок забился в сервоприводы.';
        } },
      { id: 'work', label: 'Продолжать работы, несмотря на бурю', hint: 'Ветер вскрывает засыпанные обломки, но люди рискуют',
        run(s, ctx, rng, E) {
          const c = C('sandstorm');
          const hurt = E.hurt(s, rng, R(rng, c.workHurt), c.workHurtHp, 'погиб во время бури');
          const r = E.res(s, { scrap: R(rng, c.workScrap), discipline: c.workDisc });
          return 'Ветер сдувал песок с засыпанных секций корпуса, и бойцы снимали всё, что открывалось. Пострадали: ' + (E.names(hurt) || 'никто') + '. Итог: ' + r + '.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Пекло
  def('heatwave', {
    title: 'Пекло',
    text: () => 'Термометр у шлюза показывает плюс пятьдесят восемь — и это в тени, которой нет. Металл раскалён, броня превращается в печь. К обеду двое бойцов падают в обморок прямо на разборе.',
    choices: [
      { id: 'water', label: (s) => 'Выдать дополнительную воду (' + G.Units.people(s).length * C('heatwave').extraWaterPer + ' л)',
        req: (s) => needRes('water', G.Units.people(s).length * C('heatwave').extraWaterPer)(s),
        run(s, ctx, rng, E) {
          const c = C('heatwave');
          const r = E.res(s, { water: -G.Units.people(s).length * c.extraWaterPer, discipline: c.extraDisc });
          return 'Каждый получил лишнюю флягу. Солдаты оценили заботу: ' + r + '.';
        } },
      { id: 'tents', label: 'Натянуть навесы из листов обшивки', hint: 'Металл пригодится и потом, но тень нужна сейчас',
        req: needRes('scrap', C('heatwave').tentScrap),
        run(s, ctx, rng, E) {
          const r = E.res(s, { scrap: -C('heatwave').tentScrap });
          return 'Над рабочими площадками растянули навесы из снятых листов. Под ними можно дышать: ' + r + '.';
        } },
      { id: 'endure', label: 'Терпеть: устав есть устав', hint: 'Тепловые удары и недовольство',
        run(s, ctx, rng, E) {
          const c = C('heatwave');
          const hurt = E.hurt(s, rng, R(rng, c.endureHurt), c.endureHp, 'умер от теплового удара');
          E.res(s, { discipline: c.endureDisc });
          return 'Работы не остановили. Тепловой удар получили ' + U.pl(hurt.length, F.fighter) + ', в строю ворчат.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Краулер джав
  def('jawa_caravan', {
    title: 'Краулер джав',
    cond: (s) => !s.flags.jawaHostile && !(s.visitors.jawa > 0),
    text: () => 'На горизонте выросла ржавая громада песчаного краулера. Машина остановилась в полукилометре, опустила рампу, и наружу высыпали маленькие фигурки в бурых балахонах. Светящиеся глаза под капюшонами внимательно разглядывают обломки «Железного Предела».',
    choices: [
      { id: 'trade', label: 'Выйти навстречу и торговать', hint: 'Краулер простоит рядом несколько дней',
        run(s, ctx, rng, E) {
          s.visitors.jawa = C('jawa_caravan').stay;
          E.next(G.Trade.make(s, 'jawa'));
          return 'Джавы оживлённо запищали: имперцы — это много металла. Краулер встал лагерем неподалёку.';
        } },
      { id: 'droid', label: (s) => 'Купить у джав боевого дроида (' + C('jawa_caravan').droidPrice + ' кр.)', hint: 'Подержанный, но рабочий',
        req: needCredits(C('jawa_caravan').droidPrice),
        run(s, ctx, rng, E) {
          const c = C('jawa_caravan');
          E.res(s, { credits: -c.droidPrice });
          const d = G.Units.createDroid(s, rng, { health: R(rng, c.droidHealth), origin: 'bought' });
          s.visitors.jawa = c.stay;
          return 'Из недр краулера выкатили побитого охранного дроида. После пары ударов гаечным ключом он ожил и доложил о готовности. В отряде новый боец: ' + d.num + ' ' + d.name + '.';
        } },
      { id: 'rob', label: 'Захватить краулер', hint: 'Добыча будет богатой, но джавы больше никогда не придут торговать',
        run(s, ctx, rng, E) {
          const c = C('jawa_caravan');
          return 'Генерал приказал окружить краулер. ' + E.fight(s, rng, { enemy: 'jawa', strength: c.raidStrength, squad: 12, title: 'захват краулера', after: 'jawa_rob' });
        } },
      { id: 'ignore', label: 'Не подпускать их к лагерю',
        run() { return 'Часовые дали предупредительный выстрел. Джавы обиженно запищали и укатили на север.'; } },
    ],
  });
  Ev.after.jawa_rob = function (s, rng, won, ctx, E) {
    const c = C('jawa_caravan');
    s.flags.jawaHostile = true;
    s.visitors.jawa = 0;
    E.rel(s, 'jawa', c.raidRelation);
    if (!won) return 'Краулер ушёл, отстреливаясь из ионных бластеров. Джавы этого не забудут.';
    const r = E.res(s, { scrap: R(rng, c.raidScrap), credits: R(rng, c.raidCredits) });
    return 'Краулер захвачен и выпотрошен: ' + r + '. Джавы этого не забудут.';
  };

  // ---------------------------------------------------------------- Посланник хатта
  def('hutt_envoy', {
    title: 'Посланник хатта',
    text: () => 'К лагерю подкатил открытый спидер. Родианец в расшитом жилете в сопровождении двух гаморреанцев с виброосями. Он кланяется — слишком низко, чтобы это было искренне. «Великий Мургала Хатт приветствует гостей своей пустыни. Гости должны понимать: в пустыне всё кому-нибудь принадлежит».',
    choices: [
      { id: 'job', label: (s) => 'Отдать хатту ' + C('hutt_envoy').jobSquad + ' бойцов в охрану каравана на ' + U.pl(C('hutt_envoy').jobDays, F.day),
        hint: (s) => 'Обещают ' + C('hutt_envoy').jobPay + ' кр. по возвращении',
        req: (s) => needPeople(C('hutt_envoy').jobSquad + 10)(s),
        run(s, ctx, rng, E) {
          const c = C('hutt_envoy');
          const ids = G.Units.pickSquad(s, fitPeople(s), c.jobSquad, 0, 'fighters');
          for (const id of ids) G.Units.byId(s, id).status = 'away';
          E.schedule(s, 'hutt_job_return', c.jobDays, { ids: ids });
          return 'Родианец довольно щёлкнул пальцами. ' + U.pl(ids.length, F.fighter) + ' ушли с караваном. Хатт обещал щедро заплатить — если груз дойдёт.';
        } },
      { id: 'tribute', label: (s) => 'Заплатить «за спокойствие» (' + C('hutt_envoy').tribute + ' кр.)', hint: 'Бандиты на землях хатта станут тише',
        req: needCredits(C('hutt_envoy').tribute),
        run(s, ctx, rng, E) {
          const c = C('hutt_envoy');
          E.res(s, { credits: -c.tribute });
          E.rel(s, 'hutt', c.tributeRelation);
          s.flags.huttProtection = s.day + 20;
          return 'Кредиты исчезли в рукаве жилета. «Великий Мургала ценит понимание». Отношения с хаттами улучшились.';
        } },
      { id: 'scrap', label: (s) => 'Продать хатту металлолом (' + C('hutt_envoy').scrapSell + ' → ' + C('hutt_envoy').scrapPrice + ' кр.)',
        req: needRes('scrap', C('hutt_envoy').scrapSell),
        run(s, ctx, rng, E) {
          const c = C('hutt_envoy');
          const r = E.res(s, { scrap: -c.scrapSell, credits: c.scrapPrice });
          E.rel(s, 'hutt', 3);
          return 'Гаморреанцы грузили металл до темноты, хрюкая от натуги. Сделка: ' + r + '.';
        } },
      { id: 'refuse', label: 'Выставить посланника вон', hint: 'Солдатам понравится. Хатту — нет',
        run(s, ctx, rng, E) {
          const c = C('hutt_envoy');
          E.rel(s, 'hutt', c.refuseRelation);
          E.res(s, { discipline: c.refuseDisc });
          return '«Имперская армия не платит дань слизнякам». Родианец побледнел до зелени и уехал. Строй проводил его смехом.';
        } },
    ],
  });

  def('hutt_job_return', {
    title: 'Возвращение каравана',
    valid: (s, ctx) => (ctx.ids || []).some((id) => G.Units.byId(s, id)),
    prepare(s, ctx, rng) {
      const c = C('hutt_envoy');
      ctx.dead = [];
      ctx.back = [];
      for (const id of ctx.ids || []) {
        const u = G.Units.byId(s, id);
        if (!u || u.status !== 'away') continue;
        if (rng.chance(c.jobLossChance)) {
          u.status = 'ok';
          G.Units.kill(s, u, 'погиб в охране каравана хатта');
          ctx.dead.push(G.Units.title(u));
        } else {
          u.status = 'ok';
          G.Units.addXp(s, u, 25);
          ctx.back.push(u.id);
        }
      }
      ctx.pay = ctx.back.length ? c.jobPay : 0;
      if (ctx.pay) G.Res.add(s, 'credits', ctx.pay);
      s.relations.hutt = U.clamp(s.relations.hutt + c.jobRelation, -100, 100);
    },
    text: (s, ctx) => 'Бойцы, отданные в охрану каравана Мургалы Хатта, вернулись в лагерь — запылённые, обветренные, с новыми историями. ' +
      (ctx.dead.length ? 'Вернулись не все: ' + ctx.dead.join(', ') + ' погибли в стычке с налётчиками. ' : 'Все живы. ') +
      (ctx.pay ? 'Хатт заплатил обещанные ' + ctx.pay + ' кр.' : ''),
    choices: [{ id: 'ok', label: 'Принять доклад', run: () => 'Отряд снова в строю.' }],
  });

  // ---------------------------------------------------------------- Капсула
  def('capsule_signal', {
    title: 'Сигнал спасательной капсулы',
    text: (s, ctx, rng) => 'Связисты поймали слабый, прерывистый сигнал на аварийной частоте флота. Это спасательная капсула «Железного Предела» — где-то ' +
      rng.pick(['за грядой на востоке', 'в дюнах к югу', 'у старого русла на севере', 'среди скал на западе']) +
      '. Если в ней живые, воды у них — на день, от силы на два.',
    choices: [
      { id: 'rescue', label: (s) => 'Немедленно выслать спасателей (' + U.pl(C('capsule_signal').squad, F.fighter) + ')',
        hint: (s) => 'Расход: ' + C('capsule_signal').waterCost + ' л воды',
        req: (s) => needPeople(C('capsule_signal').squad)(s) || needRes('water', C('capsule_signal').waterCost)(s),
        run(s, ctx, rng, E) {
          const c = C('capsule_signal');
          E.res(s, { water: -c.waterCost });
          const n = R(rng, c.survivors);
          const roll = rng.float();
          if (roll < c.foundChance) {
            const list = E.recruit(s, rng, n, { hp: c.survivorHp, origin: 'capsule', xp: [0, 120] });
            return 'Капсулу нашли к закату: обшивка оплавлена, но люк цел. Внутри — ' + U.pl(n, F.man) + ', живые! Обезвоженные, обожжённые, но живые. Пополнение: ' + E.names(list) + '.';
          }
          if (roll < c.foundChance + c.jawaChance && !s.flags.jawaHostile) {
            E.chain('capsule_jawas', { n: n });
            return 'На месте падения — следы гусениц краулера. Капсулу уже вскрыли джавы и увезли всё, что смогли. Похоже, и людей тоже.';
          }
          return 'У капсулы спасателей ждали таскены. ' + E.fight(s, rng, { enemy: 'tusken', strength: c.tuskenStrength, squad: c.squad, title: 'бой у капсулы', after: 'capsule_tuskens', ctx: { n: n } });
        } },
      { id: 'ignore', label: 'Не рисковать людьми', hint: 'Солдаты это запомнят',
        run(s, ctx, rng, E) {
          E.res(s, { discipline: C('capsule_signal').ignoreDisc });
          return 'Сигнал затих через два часа. В казарме об этом говорили всю ночь — вполголоса, чтобы не услышали офицеры.';
        } },
    ],
  });
  Ev.after.capsule_tuskens = function (s, rng, won, ctx, E) {
    if (!won) return 'Капсулу пришлось оставить таскенам.';
    const c = C('capsule_signal');
    const list = E.recruit(s, rng, ctx.n || 2, { hp: c.survivorHp, origin: 'capsule', xp: [0, 120] });
    return 'Таскены отброшены, капсула вскрыта: в отряде пополнение — ' + E.names(list) + '.';
  };

  def('capsule_jawas', {
    title: 'Выжившие у джав',
    text: (s, ctx) => 'Спасатели догнали краулер у соляной впадины. Джавы не прячут добычу: ' + U.pl(ctx.n, F.man) +
      ' в имперской форме сидят у гусеницы, связанные проводом. Для джав это такой же трофей, как любой металл. Старший джава, не моргая, показывает три пальца — торгуемся.',
    choices: [
      { id: 'pay', label: (s) => 'Выкупить за ' + C('capsule_jawas').ransomCredits + ' кр.', req: needCredits(C('capsule_jawas').ransomCredits),
        run(s, ctx, rng, E) {
          E.res(s, { credits: -C('capsule_jawas').ransomCredits });
          const list = E.recruit(s, rng, ctx.n, { hp: C('capsule_signal').survivorHp, origin: 'rescued', xp: [0, 120] });
          E.rel(s, 'jawa', 3);
          return 'Сделка состоялась. Освобождены: ' + E.names(list) + '.';
        } },
      { id: 'scrap', label: (s) => 'Обменять на металлолом (' + C('capsule_jawas').ransomScrap + ')', req: needRes('scrap', C('capsule_jawas').ransomScrap),
        run(s, ctx, rng, E) {
          E.res(s, { scrap: -C('capsule_jawas').ransomScrap });
          const list = E.recruit(s, rng, ctx.n, { hp: C('capsule_signal').survivorHp, origin: 'rescued', xp: [0, 120] });
          E.rel(s, 'jawa', 5);
          return 'Джавы радостно пересчитали металл. Освобождены: ' + E.names(list) + '.';
        } },
      { id: 'force', label: 'Отбить силой', hint: 'Отношения с джавами испортятся',
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'jawa', strength: C('capsule_jawas').forceStrength, squad: 8, title: 'бой у краулера', after: 'capsule_force', ctx: ctx });
        } },
    ],
  });
  Ev.after.capsule_force = function (s, rng, won, ctx, E) {
    E.rel(s, 'jawa', C('capsule_jawas').forceRelation);
    if (!won) return 'Краулер ушёл вместе с пленными.';
    const list = E.recruit(s, rng, ctx.n || 2, { hp: C('capsule_signal').survivorHp, origin: 'rescued', xp: [0, 120] });
    return 'Пленные свободны: ' + E.names(list) + '.';
  };

  // ---------------------------------------------------------------- Повстанцы
  def('rebel_tracks', {
    title: 'Следы повстанцев',
    cond: (s) => !s.regions.rebel_post.cleared,
    text: () => 'Разведчики принесли находку: обрывок маскировочной сетки и гильзу от бластерного карабина не имперского образца. Рядом — свежие следы ботинок, уходящие на север. Повстанцы. Здесь, совсем рядом с местом крушения. Случайно ли «Железный Предел» нарвался на засаду?',
    choices: [
      { id: 'ambush', label: 'Устроить засаду на тропе', hint: 'Если повезёт — возьмём пленного',
        req: needPeople(10),
        run(s, ctx, rng, E) {
          return 'Десять бойцов залегли у тропы на сутки. ' + E.fight(s, rng, { enemy: 'rebels', strength: C('rebel_tracks').ambushStrength, squad: 10, title: 'засада на повстанцев', after: 'rebel_ambush' });
        } },
      { id: 'track', label: 'Проследить, куда ведут следы', hint: 'Можно найти их базу — или нарваться на огонь',
        show: (s) => !s.regions.rebel_post.known,
        run(s, ctx, rng, E) {
          const c = C('rebel_tracks');
          let text = '';
          if (rng.chance(c.trackRisk)) {
            text = 'Повстанцы заметили хвост. ' + E.fight(s, rng, { enemy: 'rebels', strength: c.trackStrength, squad: 6, title: 'перестрелка с повстанцами' }) + ' ';
          }
          if (rng.chance(c.trackChance)) return text + 'Следы привели к старой шахте, замаскированной под осыпь: ' + E.reveal(s, 'rebel_post') + '.';
          return text + 'В скалах следы потерялись.';
        } },
      { id: 'ignore', label: 'Не связываться: у нас другие заботы', run: () => 'Находку приобщили к журналу и забыли. Почти.' },
    ],
  });
  Ev.after.rebel_ambush = function (s, rng, won, ctx, E) {
    if (!won) return 'Повстанцы прорвались и ушли.';
    E.chain('rebel_prisoner', {});
    return 'Одного повстанца взяли живым.';
  };

  def('rebel_prisoner', {
    title: 'Пленный повстанец',
    text: () => 'Пленный — молодой, злой, в выцветшей лётной куртке. На вопросы не отвечает. Но в его планшете нашлась карта с пометками, а на запястье — дешёвый комлинк, настроенный на чужую частоту.',
    choices: [
      { id: 'map', label: 'Изучить карту и комлинк', hint: 'Возможно, там их база',
        run(s, ctx, rng, E) {
          const r = E.reveal(s, 'rebel_post');
          return r ? 'Пометки на карте указывают на заброшенную шахту — ' + r + '. Пленного заперли в кормовом отсеке.' : 'Карта подтвердила то, что мы уже знали о тайнике повстанцев.';
        } },
      { id: 'sell', label: (s) => 'Передать хатту за вознаграждение (' + C('rebel_prisoner').huttCredits + ' кр.)', show: (s) => s.regions.mos_espa.known,
        run(s, ctx, rng, E) {
          const c = C('rebel_prisoner');
          E.res(s, { credits: c.huttCredits });
          E.rel(s, 'hutt', c.huttRelation);
          return 'Люди Мургалы забрали пленного и оставили мешочек кредитов. Хатт ценит полезные знакомства.';
        } },
      { id: 'release', label: 'Отпустить его', hint: 'Пусть передаст своим: мы воюем с пустыней, а не с ними',
        run(s, ctx, rng, E) {
          s.flags.rebelMercy = true;
          E.res(s, { discipline: C('rebel_prisoner').releaseDisc });
          return 'Пленному дали флягу и указали на север. Он долго смотрел на генерала, прежде чем уйти. Солдаты не поняли этого решения.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Крайт-дракон
  def('krayt_roar', {
    title: 'Рёв в дюнах',
    text: () => 'Земля вздрогнула. Потом из темноты донёсся низкий, раскатистый рёв — такой, что у часовых заложило уши. Сенсоры показывают нечто огромное в километре от лагеря, и оно движется. Старые колонисты называют таких крайт-драконами.',
    choices: [
      { id: 'hide', label: 'Погасить огни и затаиться', hint: 'Может пройти мимо. А может и нет',
        run(s, ctx, rng, E) {
          const c = C('krayt_roar');
          const lair = E.reveal(s, 'krayt_lair');
          if (rng.chance(c.hideRisk)) {
            const dead = E.kill(s, rng, R(rng, c.hideKills), 'унесён крайт-драконом');
            return 'Чудовище прошло по краю лагеря. Утром на месте восточного поста — только борозда в песке. Пропали: ' + (E.names(dead) || 'никто') + '.' + (lair ? ' Следы ведут на юг: ' + lair + '.' : '');
          }
          return 'Рёв удалялся до самого рассвета. Обошлось.' + (lair ? ' Следы ведут на юг: ' + lair + '.' : '');
        } },
      { id: 'bait', label: (s) => 'Выкатить за периметр бочку воды как приманку (' + C('krayt_roar').baitWater + ' л)',
        req: needRes('water', C('krayt_roar').baitWater),
        run(s, ctx, rng, E) {
          E.res(s, { water: -C('krayt_roar').baitWater });
          const lair = E.reveal(s, 'krayt_lair');
          return 'Дракон раздавил бочку одним ударом, долго принюхивался и ушёл на юг.' + (lair ? ' ' + U.cap(lair) + '.' : '');
        } },
      { id: 'fight', label: 'Открыть огонь из всего, что есть', hint: 'Безумие. Но жемчужина крайт-дракона стоит целое состояние',
        run(s, ctx, rng, E) {
          E.reveal(s, 'krayt_lair');
          return E.fight(s, rng, { enemy: 'krayt', strength: C('krayt_roar').fightStrength, squad: 'camp', title: 'бой с крайт-драконом', after: 'krayt_fight' });
        } },
    ],
  });
  Ev.after.krayt_fight = function (s, rng, won, ctx, E) {
    if (!won) return 'Дракон ушёл в дюны, унося в шкуре десятки ожогов от бластеров.';
    s.regions.krayt_lair.cleared = true;
    E.item(s, 'kraytPearl', 1);
    return 'Невероятно: чудовище повержено! В его желудке нашли жемчужину крайт-дракона — за неё в Мос-Эспе дадут целое состояние.';
  };

  // ---------------------------------------------------------------- Заговор дезертиров
  def('desertion_plot', {
    title: 'Шёпот в казарме',
    cond: (s) => s.res.discipline < C('desertion_plot').below,
    weightMod: (s) => (s.res.discipline < 25 ? 2 : 1),
    text: () => 'Квартирмейстер докладывает вполголоса: несколько бойцов копят воду и собираются ночью уйти в Анкорхед. «Империя нас уже похоронила, — говорят они. — Зачем умирать за обломки?»',
    choices: [
      { id: 'arrest', label: 'Арестовать зачинщиков', hint: 'Жёстко, но действенно',
        run(s, ctx, rng, E) {
          const r = E.res(s, { discipline: C('desertion_plot').arrestDisc });
          return 'Двоих зачинщиков взяли на рассвете, у тайника с флягами. Остальные притихли: ' + r + '.';
        } },
      { id: 'talk', label: 'Поговорить с ними лично', hint: 'Может сработать — а может и нет',
        run(s, ctx, rng, E) {
          const c = C('desertion_plot');
          if (rng.chance(c.talkChance)) {
            const r = E.res(s, { discipline: c.talkDisc });
            return 'Генерал пришёл в казарму без охраны и говорил до полуночи. Утром фляги вернулись на склад: ' + r + '.';
          }
          const gone = desert(s, rng, R(rng, c.talkFail));
          return 'Разговор не помог. Ночью ушли ' + (E.names(gone) || 'никто') + '.';
        } },
      { id: 'letgo', label: 'Отпустить всех желающих', hint: 'Кто останется — останется по своей воле',
        run(s, ctx, rng, E) {
          const c = C('desertion_plot');
          const gone = desert(s, rng, R(rng, c.letGo));
          const r = E.res(s, { water: -gone.length * c.letGoWater, discipline: c.letGoDisc });
          return 'На построении генерал разрешил уйти всем, кто хочет. Вышли из строя ' + U.pl(gone.length, F.man) + ': ' + E.names(gone) + '. Каждому дали воды на дорогу. Оставшиеся смотрят на командира иначе: ' + r + '.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Выстрел в ночи
  def('sentry_shot', {
    title: 'Выстрел в темноте',
    prepare(s, ctx, rng) {
      const c = C('sentry_shot');
      if (rng.chance(c.revealChance)) {
        const target = s.regions.jundland.known ? 'tusken_camp' : 'jundland';
        ctx.reveal = s.regions[target].known ? null : target;
        ctx.what = 'scout';
      } else ctx.what = rng.pick(['rat', 'shadow']);
    },
    text: (s, ctx) => 'Ночью на северном посту хлопнул выстрел, за ним ещё два. Лагерь поднят по тревоге. ' + {
      scout: 'Утром у периметра нашли следы и брошенную обмотку: здесь был разведчик таскенов.',
      rat: 'Утром у периметра нашли подстреленную вомп-крысу размером с собаку.',
      shadow: 'Утром у периметра не нашли ничего, кроме следов самого часового.',
    }[ctx.what],
    choices: [
      { id: 'scold', label: 'Наказать часового за панику',
        run(s, ctx, rng, E) {
          const r = E.res(s, { discipline: C('sentry_shot').scoldDisc });
          return 'Часовой получил наряд вне очереди. Порядок есть порядок: ' + r + '.' + (ctx.reveal ? ' Следы разведчика ведут в сторону: ' + E.reveal(s, ctx.reveal) + '.' : '');
        } },
      { id: 'praise', label: 'Похвалить за бдительность',
        run(s, ctx, rng, E) {
          E.res(s, { discipline: C('sentry_shot').praiseDisc });
          const g = fitPeople(s)[0];
          if (g) G.Units.addXp(s, g, 10);
          return 'Генерал отметил бдительность часового. Кто-то в строю усмехнулся.' + (ctx.reveal ? ' Следы разведчика ведут в сторону: ' + E.reveal(s, ctx.reveal) + '.' : '');
        } },
    ],
  });

  // ---------------------------------------------------------------- Тайник
  def('cache_found', {
    title: 'Запечатанный отсек',
    text: () => 'Разбирая завал у офицерской палубы, бойцы наткнулись на герметичную дверь с личной печатью капитана третьего ранга. Внутри может быть что угодно — от сейфа с жалованьем до растяжки, оставленной на случай абордажа.',
    choices: [
      { id: 'quick', label: 'Вскрыть резаком', hint: 'Быстро, но рискованно',
        run(s, ctx, rng, E) {
          const c = C('cache_found');
          if (rng.chance(c.trapChance)) {
            const hurt = E.hurt(s, rng, rng.int(1, 2), [20, 40], 'погиб при вскрытии отсека');
            return 'Внутри сработала растяжка. Ранены: ' + E.names(hurt) + '. В отсеке — только обгоревшие бумаги.';
          }
          const r = E.res(s, { credits: R(rng, c.quickCredits) });
          const b = R(rng, c.quickBacta);
          E.item(s, 'bacta', b);
          return 'Сейф офицера и личная аптечка: ' + r + ', бакта +' + b + '.';
        } },
      { id: 'safe', label: 'Действовать по инструкции', hint: (s) => 'Сапёры, датчики, медленно. ' + C('cache_found').safeEnergy + ' энергии',
        req: needRes('energy', C('cache_found').safeEnergy),
        run(s, ctx, rng, E) {
          const c = C('cache_found');
          E.res(s, { energy: -c.safeEnergy });
          const r = E.res(s, { credits: R(rng, c.safeCredits) });
          return 'Сапёры сняли растяжку и вскрыли дверь по всем правилам. Внутри — сейф: ' + r + '.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Реактор
  def('reactor_leak', {
    title: 'Скачок в реакторе',
    cond: (s) => s.sections.reactor.level >= 1,
    text: () => 'Взвыла сирена реакторного отсека. Течь в контуре охлаждения: давление растёт, датчики мигают красным. Старший техник просит решения — немедленно.',
    choices: [
      { id: 'fix', label: (s) => 'Заглушить реактор и чинить (' + C('reactor_leak').fixEnergy + ' энергии, ' + C('reactor_leak').fixScrap + ' металла)',
        req: needRes('scrap', C('reactor_leak').fixScrap),
        run(s, ctx, rng, E) {
          const c = C('reactor_leak');
          const r = E.res(s, { energy: -c.fixEnergy, scrap: -c.fixScrap });
          return 'Реактор заглушили на шесть часов. Течь заварили, контур перебрали: ' + r + '.';
        } },
      { id: 'push', label: 'Работать на износ — починим потом', hint: 'Может обойтись. Может — нет',
        run(s, ctx, rng, E) {
          const c = C('reactor_leak');
          if (rng.chance(c.pushFailChance)) {
            const hurt = E.hurt(s, rng, 2, [20, 40], 'погиб при аварии реактора');
            const r = E.res(s, { energy: -c.pushEnergyLoss });
            return 'Не обошлось: выброс пара обжёг техников (' + E.names(hurt) + '), аварийная защита сбросила заряд батарей: ' + r + '.';
          }
          return 'Давление удалось стабилизировать вручную. Реактор работает, техники молятся.';
        } },
      { id: 'droid', label: 'Отправить дроида в реакторный отсек', show: (s) => fitDroids(s).length > 0, hint: 'Дроиду жар не страшен — почти',
        run(s, ctx, rng, E) {
          const d = fitDroids(s)[0];
          G.Units.damage(s, d, C('reactor_leak').droidDamage, 'уничтожен при аварии реактора');
          return 'Дроид ' + d.name + ' зашёл в раскалённый отсек и перекрыл вентиль. Его корпус почернел, но течь остановлена.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Лихорадка
  def('fever', {
    title: 'Пустынная лихорадка',
    text: () => 'Медик докладывает: у нескольких бойцов жар, озноб и сыпь на руках. Местная лихорадка — её разносят песчаные мухи. В имперской аптечке от неё нет ничего, кроме бакты.',
    choices: [
      { id: 'bacta', label: (s) => 'Потратить бакту на больных (' + C('fever').bacta + ' медпакета)',
        req: (s) => ((s.items.bacta || 0) < C('fever').bacta ? 'Нужно ' + C('fever').bacta + ' медпакета бакты' : null),
        run(s, ctx, rng, E) {
          E.item(s, 'bacta', -C('fever').bacta);
          return 'Бакта сбила жар за сутки. Эпидемии не будет.';
        } },
      { id: 'isolate', label: 'Изолировать больных', hint: 'Болезнь не распространится, но больные ослабнут',
        run(s, ctx, rng, E) {
          const c = C('fever');
          const hurt = E.hurt(s, rng, R(rng, c.isolateSick), c.isolateHp, 'умер от лихорадки');
          return 'Больных (' + U.pl(hurt.length, F.man) + ') перевели в отдельный отсек. Неделю им будет тяжело.';
        } },
      { id: 'work', label: 'Не время болеть — работать дальше', hint: 'Заразятся многие',
        run(s, ctx, rng, E) {
          const c = C('fever');
          const hurt = E.hurt(s, rng, R(rng, c.workSick), c.workHp, 'умер от лихорадки');
          E.res(s, { discipline: c.workDisc });
          return 'Лихорадка прошла по лагерю волной: переболели ' + U.pl(hurt.length, F.man) + '.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Наёмники
  def('merc_offer', {
    title: 'Наёмники ищут работу',
    cond: (s) => s.res.credits >= C('merc_offer').minCredits,
    prepare(s, ctx, rng) {
      const N = G.TEXT.names;
      ctx.a = { name: rng.pick(N.mercFirst), race: rng.pick(N.mercRace) };
      ctx.b = { name: rng.pick(N.mercFirst), race: rng.pick(N.mercRace) };
    },
    text: (s, ctx) => 'К периметру подошли двое с оружием за спиной — ' + ctx.a.race + ' по имени ' + ctx.a.name + ' и ' + ctx.b.race + ' по имени ' + ctx.b.name +
      '. Слышали, что имперцы платят. Готовы драться за кредиты и не спрашивают, против кого.',
    choices: [
      { id: 'two', label: (s) => 'Нанять обоих (' + 2 * C('merc_offer').price + ' кр.)', req: needCredits(2 * C('merc_offer').price),
        run(s, ctx, rng, E) {
          E.res(s, { credits: -2 * C('merc_offer').price });
          for (const m of [ctx.a, ctx.b]) { const u = G.Units.createMerc(s, rng); u.name = m.name; u.num = m.race; }
          return 'Контракт подписан. ' + ctx.a.name + ' и ' + ctx.b.name + ' получили паёк и место у реактора.';
        } },
      { id: 'one', label: (s) => 'Нанять одного (' + C('merc_offer').price + ' кр.)', req: needCredits(C('merc_offer').price),
        run(s, ctx, rng, E) {
          E.res(s, { credits: -C('merc_offer').price });
          const u = G.Units.createMerc(s, rng); u.name = ctx.a.name; u.num = ctx.a.race;
          return ctx.a.name + ' остаётся с отрядом. Второй сплюнул и ушёл в пустыню.';
        } },
      { id: 'no', label: 'Отказать', run: () => 'Наёмники пожали плечами и ушли. В пустыне всегда найдётся, кому продать бластер.' },
    ],
  });

  // ---------------------------------------------------------------- Дьюбэк
  def('dewback', {
    title: 'Дьюбэк у периметра',
    cond: (s) => !s.flags.dewback,
    text: () => 'К лагерю вышел дьюбэк — крупный песчаный ящер, ещё молодой, отбившийся от стада. Он спокойно лижет конденсат с обшивки. Ветераны вспоминают: в гарнизонах Татуина на таких ездили верхом.',
    choices: [
      { id: 'tame', label: 'Попробовать приручить', hint: 'Верховой ящер ускорит разведку',
        run(s, ctx, rng, E) {
          const c = C('dewback');
          if (rng.chance(c.tameChance)) {
            s.flags.dewback = true;
            return 'После трёх часов уговоров и двух фляг воды ящер позволил себя оседлать. Разведка теперь пойдёт быстрее.';
          }
          const hurt = E.hurt(s, rng, 1, c.tameHurtHp, 'погиб от удара хвостом дьюбэка');
          return 'Ящер махнул хвостом — и ' + E.names(hurt) + ' отлетел на три метра. Дьюбэк ушёл в дюны.';
        } },
      { id: 'feast', label: 'Пустить на мясо', hint: 'Свежее мясо — праздник для отряда',
        run(s, ctx, rng, E) {
          const r = E.res(s, { discipline: C('dewback').feastDisc });
          return 'Вечером над лагерем пахло жареным мясом. Впервые за долгое время солдаты смеялись: ' + r + '.';
        } },
      { id: 'shoo', label: 'Отогнать', run: () => 'Ящер обиженно зашипел и неторопливо ушёл.' },
    ],
  });

  // ---------------------------------------------------------------- Знак таскенов
  def('tusken_sign', {
    title: 'Знак на камне',
    cond: (s) => s.regions.jundland.known && s.relations.tusken >= C('tusken_sign').minRelation,
    text: () => 'У межевого камня на краю пустоши часовые нашли свежий знак: круг, пересечённый тремя линиями, и рядом — пустой бурдюк. Старики в Анкорхеде объяснили бы: так песчаный народ просит дань. Или предупреждает в последний раз.',
    choices: [
      { id: 'give', label: (s) => 'Наполнить бурдюк водой (' + C('tusken_sign').water + ' л)', req: needRes('water', C('tusken_sign').water),
        run(s, ctx, rng, E) {
          const c = C('tusken_sign');
          E.res(s, { water: -c.water });
          return 'Утром бурдюка не было, а на камне появился новый знак — две параллельные линии. ' + U.cap(E.rel(s, 'tusken', c.relation)) + '.';
        } },
      { id: 'ignore', label: 'Оставить без ответа',
        run(s, ctx, rng, E) { return 'Знак стёрли. ' + U.cap(E.rel(s, 'tusken', C('tusken_sign').ignoreRelation)) + '.'; } },
    ],
  });

  // ---------------------------------------------------------------- Пропавший патруль
  const patrolCond = (s) => s.orders.some((o) => (o.type === 'recon' || o.type === 'water') && o.unitIds.filter((id) => { const u = G.Units.byId(s, id); return u && u.status === 'ok' && u.kind !== 'droid'; }).length >= 3);
  def('missing_patrol', {
    title: 'Пропавший патруль',
    valid: (s) => patrolCond(s),
    cond: (s) => s.orders.some((o) => (o.type === 'recon' || o.type === 'water') && o.unitIds.filter((id) => { const u = G.Units.byId(s, id); return u && u.status === 'ok' && u.kind !== 'droid'; }).length >= 3),
    prepare(s, ctx, rng) {
      const o = rng.pick(s.orders.filter((x) => (x.type === 'recon' || x.type === 'water') && x.unitIds.some((id) => { const u = G.Units.byId(s, id); return u && u.status === 'ok' && u.kind !== 'droid'; })));
      ctx.region = o.target;
      const pool = o.unitIds.map((id) => G.Units.byId(s, id)).filter((u) => u && u.status === 'ok' && u.kind !== 'droid');
      ctx.lost = rng.shuffle(pool).slice(0, R(rng, C('missing_patrol').lost)).map((u) => u.id);
      for (const id of ctx.lost) G.Units.byId(s, id).status = 'missing';
    },
    text: (s, ctx) => 'К закату не вернулись: ' + ctx.lost.map((id) => G.Units.title(G.Units.byId(s, id))).join(', ') +
      '. Последний сигнал комлинка пришёл из района «' + G.Regions.name(ctx.region) + '» — и оборвался на полуслове.',
    choices: [
      { id: 'search', label: (s) => 'Выслать поисковый отряд (' + U.pl(C('missing_patrol').searchSquad, F.fighter) + ')',
        req: needPeople(C('missing_patrol').searchSquad),
        run(s, ctx, rng, E) {
          return 'Поисковая группа вышла в ночь по следам. ' + E.fight(s, rng, { enemy: 'tusken', strength: C('missing_patrol').searchStrength, squad: C('missing_patrol').searchSquad, title: 'бой за пропавший патруль', after: 'patrol_search', ctx: ctx });
        } },
      { id: 'wait', label: 'Ждать до утра', hint: 'Может, сами выйдут',
        run(s, ctx, rng, E) {
          if (rng.chance(C('missing_patrol').waitChance)) {
            for (const id of ctx.lost) { const u = G.Units.byId(s, id); u.status = 'ok'; G.Units.damage(s, u, rng.int(10, 30), 'погиб в пустыне'); }
            return 'На рассвете часовые увидели в мареве фигуры. Патруль вернулся — израненный, без половины снаряжения, но живой.';
          }
          for (const id of ctx.lost) { const u = G.Units.byId(s, id); u.status = 'ok'; G.Units.kill(s, u, 'пропал без вести в пустыне'); }
          E.res(s, { discipline: -3 });
          return 'Они не вернулись. Ни утром, ни через день.';
        } },
      { id: 'writeoff', label: 'Списать как погибших', hint: 'Холодный расчёт. Солдатам это не понравится',
        run(s, ctx, rng, E) {
          for (const id of ctx.lost) { const u = G.Units.byId(s, id); u.status = 'ok'; G.Units.kill(s, u, 'списан как пропавший без вести'); }
          E.res(s, { discipline: C('missing_patrol').writeOffDisc });
          return 'В журнале появилась короткая запись: «пропали без вести». Строй молчал.';
        } },
    ],
  });
  Ev.after.patrol_search = function (s, rng, won, ctx, E) {
    for (const id of ctx.lost) {
      const u = G.Units.byId(s, id);
      if (!u || u.status !== 'missing') continue;
      u.status = 'ok';
      if (won) G.Units.damage(s, u, rng.int(15, 35), 'погиб от ран');
      else G.Units.kill(s, u, 'погиб в плену у таскенов');
    }
    return won ? 'Пропавших нашли в лагере таскенов — живыми.' : 'Пропавших спасти не удалось.';
  };

  // ---------------------------------------------------------------- Контрабандисты
  def('smugglers', {
    title: 'Корабль контрабандистов',
    text: () => 'Над дюнами прошёл потрёпанный кореллианский грузовик и сел в паре километров к востоку. Через час к лагерю пришли двое: человек со шрамом через бровь и молчаливый дурос. Торговать готовы, лишних вопросов не задают. Цены — соответствующие.',
    choices: [
      { id: 'parts', label: (s) => 'Купить детали гипердвигателя (' + C('smugglers').partsPrice + ' кр.)', req: needCredits(C('smugglers').partsPrice),
        run(s, ctx, rng, E) {
          E.res(s, { credits: -C('smugglers').partsPrice });
          E.item(s, 'hyperParts', 1);
          return 'Ящик с деталями сгрузили у шлюза. Дурос пересчитал кредиты дважды.';
        } },
      { id: 'fuel', label: (s) => 'Купить топливные элементы: ' + C('smugglers').fuelQty + ' × ' + C('smugglers').fuelPrice + ' кр.',
        req: needCredits(C('smugglers').fuelQty * C('smugglers').fuelPrice),
        run(s, ctx, rng, E) {
          const c = C('smugglers');
          E.res(s, { credits: -c.fuelQty * c.fuelPrice });
          E.item(s, 'fuel', c.fuelQty);
          return 'Топливные элементы перекатили в ангар. «Приятно иметь дело с Империей», — без тени улыбки сказал человек со шрамом.';
        } },
      { id: 'seize', label: 'Захватить их корабль', hint: 'У них наверняка есть всё, что нужно для шаттла',
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'smugglers', strength: C('smugglers').raidStrength, squad: 14, title: 'захват грузовика', after: 'smuggler_seize' });
        } },
      { id: 'leave', label: 'Отпустить их с миром', run: () => 'Через час грузовик поднялся в небо и исчез в белёсой дымке.' },
    ],
  });
  Ev.after.smuggler_seize = function (s, rng, won, ctx, E) {
    if (!won) return 'Грузовик взлетел, поливая песок огнём из турели.';
    E.item(s, 'hyperParts', 1);
    E.item(s, 'fuel', 2);
    const r = E.res(s, { credits: rng.int(80, 200) });
    return 'Грузовик повреждён в бою и уже не взлетит, но трюм наш: детали гипердвигателя, два топливных элемента, ' + r + '.';
  };

  // ---------------------------------------------------------------- Охранный дроид
  def('security_droid', {
    title: 'Дроид в грузовом трюме',
    text: () => 'В засыпанном песком трюме нашли охранного дроида. Он стоял в транспортной стойке, словно ждал приказа все эти дни. Корпус цел, но блок питания выгорел.',
    choices: [
      { id: 'repair', label: (s) => 'Починить (' + C('security_droid').repairScrap + ' металла, ' + C('security_droid').repairEnergy + ' энергии)',
        req: (s) => needRes('scrap', C('security_droid').repairScrap)(s) || needRes('energy', C('security_droid').repairEnergy)(s),
        run(s, ctx, rng, E) {
          const c = C('security_droid');
          E.res(s, { scrap: -c.repairScrap, energy: -c.repairEnergy });
          const d = G.Units.createDroid(s, rng, { health: R(rng, c.droidHealth), origin: 'built' });
          return 'Техники сутки возились с блоком питания. Наконец оптика дроида вспыхнула: «Охранная единица ' + d.num + ' готова к службе». В отряде новый дроид ' + d.name + '.';
        } },
      { id: 'scrap', label: 'Разобрать на запчасти',
        run(s, ctx, rng, E) {
          const c = C('security_droid');
          const r = E.res(s, { scrap: c.scrapGain, energy: c.energyGain });
          return 'Дроида разобрали до винтика: ' + r + '.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Обрывок передачи
  def('broadcast', {
    title: 'Обрывок передачи',
    cond: (s) => s.sections.comms.level >= C('broadcast').needComms && !s.flags.fleetSector,
    text: () => 'Антенная мачта поймала обрывок имперской передачи: сводку флота, позывные, координаты сектора. Нас не ищут — о «Железном Пределе» в сводке ни слова. Но флот где-то рядом, в этом секторе.',
    choices: [
      { id: 'read', label: 'Зачитать перед строем', hint: 'Солдатам нужна надежда',
        run(s, ctx, rng, E) {
          s.flags.fleetSector = true;
          const r = E.res(s, { discipline: C('broadcast').readDisc });
          return 'Солдаты слушали молча, а потом кто-то крикнул «Служу Империи!» — и строй подхватил: ' + r + '. Координаты сектора записаны.';
        } },
      { id: 'secret', label: 'Оставить сведения при себе', hint: 'Если флот не придёт, разочарование будет страшным',
        run(s) {
          s.flags.fleetSector = true;
          return 'Генерал спрятал запись в личный сейф. Координаты сектора пригодятся, когда заработает передатчик.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Свуп-банда
  def('bandit_toll', {
    title: 'Пошлина «Ржавых Клыков»',
    cond: (s) => s.regions.canyon.known && !s.regions.bandit_den.cleared && !(s.flags.huttProtection > s.day),
    text: () => 'К лагерю с рёвом подлетели три свупа, подняв тучу пыли. Главарь — забрак с выкрашенными в ржавый цвет рогами — даже не слез с сиденья: «Это наша пустыня, солдатики. За проезд платят все. Водой или железом — выбирайте».',
    choices: [
      { id: 'water', label: (s) => 'Заплатить водой (' + C('bandit_toll').water + ' л)', req: needRes('water', C('bandit_toll').water),
        run(s, ctx, rng, E) { const r = E.res(s, { water: -C('bandit_toll').water, discipline: -2 }); return 'Банда укатила, увозя канистры: ' + r + '.'; } },
      { id: 'scrap', label: (s) => 'Заплатить металлом (' + C('bandit_toll').scrap + ')', req: needRes('scrap', C('bandit_toll').scrap),
        run(s, ctx, rng, E) { const r = E.res(s, { scrap: -C('bandit_toll').scrap, discipline: -2 }); return 'Металл погрузили на свупы: ' + r + '.'; } },
      { id: 'refuse', label: 'Ответить отказом', hint: 'Они вернутся — и не одни',
        run(s, ctx, rng, E) {
          E.schedule(s, 'bandit_raid', 1, {});
          const r = E.reveal(s, 'bandit_den');
          return 'Забрак сплюнул в песок: «Тогда до встречи, солдатики». Банда умчалась к каньону' + (r ? ' — ' + r : '') + '.';
        } },
    ],
  });

  def('bandit_raid', {
    title: 'Налёт свуп-банды',
    valid: (s) => !s.regions.bandit_den.cleared,
    text: () => 'Сначала — далёкий вой двигателей. Потом из марева вылетели свупы, полтора десятка, и пошли по кругу вокруг лагеря, поливая обломки огнём. «Ржавые Клыки» сдержали слово.',
    choices: [
      { id: 'fight', label: 'Занять оборону',
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'bandits', strength: C('bandit_raid').strength, squad: 'camp', title: 'налёт свуп-банды', after: 'bandit_raid' });
        } },
      { id: 'pay', label: (s) => 'Откупиться (' + C('bandit_raid').payWater + ' л воды и ' + C('bandit_raid').payScrap + ' металла)',
        run(s, ctx, rng, E) {
          const c = C('bandit_raid');
          const r = E.res(s, { water: -c.payWater, scrap: -c.payScrap, discipline: -5 });
          return 'Генерал выслал парламентёра с белой тряпкой. Банда забрала дань и ушла: ' + r + '.';
        } },
    ],
  });
  Ev.after.bandit_raid = function (s, rng, won, ctx, E) {
    const c = C('bandit_raid');
    if (won) return 'Свупы ушли, оставив на песке три разбитые машины — отличный металл.' + ' ' + E.res(s, { scrap: rng.int(20, 45) }) + '.';
    const r = E.res(s, { water: -R(rng, c.lootWater), scrap: -R(rng, c.lootScrap) });
    return 'Бандиты прорвались к складу: ' + r + '.';
  };

  // ---------------------------------------------------------------- День Империи
  def('empire_day', {
    title: 'День Империи',
    text: () => 'По календарю флота сегодня — годовщина провозглашения Империи. На корабле это значило парад в ангаре, двойной паёк и речь адмирала по всем каналам. Здесь — только песок, жара и сорок с лишним человек, которые ждут, что скажет генерал.',
    choices: [
      { id: 'feast', label: (s) => 'Праздничный паёк (' + C('empire_day').feastWater + ' л воды)', req: needRes('water', C('empire_day').feastWater),
        run(s, ctx, rng, E) {
          const r = E.res(s, { water: -C('empire_day').feastWater, discipline: C('empire_day').feastDisc });
          return 'Вечером был праздник — скромный, но настоящий: ' + r + '.';
        } },
      { id: 'plain', label: 'Построение и минута молчания по погибшим',
        run(s, ctx, rng, E) {
          const r = E.res(s, { discipline: C('empire_day').plainDisc });
          return 'Генерал зачитал имена всех погибших с начала крушения. Строй стоял неподвижно: ' + r + '.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Крысы
  def('womp_rats', {
    title: 'Вомп-крысы',
    prepare(s, ctx, rng) {
      ctx.loss = Math.min(s.res.water, R(rng, C('womp_rats').waterLoss));
      G.Res.add(s, 'water', -ctx.loss);
    },
    text: (s, ctx) => 'Ночью на склад пробрались вомп-крысы — здоровенные, с локоть длиной. Прогрызли две канистры: потеряно ' + ctx.loss + ' л воды.',
    choices: [
      { id: 'hunt', label: 'Устроить облаву',
        run(s, ctx, rng, E) {
          const r = E.res(s, { discipline: C('womp_rats').huntDisc });
          return 'Охота на крыс стала лучшим развлечением недели: ' + r + '.';
        } },
      { id: 'trap', label: (s) => 'Поставить ловушки под током (' + C('womp_rats').trapEnergy + ' энергии)',
        run(s, ctx, rng, E) {
          E.res(s, { energy: -C('womp_rats').trapEnergy });
          const back = Math.round(ctx.loss / 2);
          E.res(s, { water: back });
          return 'Ловушки сработали, часть воды удалось спасти: +' + back + ' л.';
        } },
    ],
  });

  // ---------------------------------------------------------------- Налёт таскенов
  def('tusken_raid', {
    title: 'Налёт таскенов',
    text: (s, ctx) => ctx.surprised
      ? 'Они пришли без звука. Первым крикнул часовой у кормового шлюза — и тут же замолчал. Таскены уже внутри периметра!'
      : 'Часовые засекли движение: фигуры в обмотках крадутся к периметру со стороны скал. За гребнем фыркают банты. Таскены идут на лагерь.',
    choices: [
      { id: 'fight', label: (s, ctx) => (ctx && ctx.surprised ? 'К оружию!' : 'Встретить огнём'),
        run(s, ctx, rng, E) {
          return E.fight(s, rng, { enemy: 'tusken', strength: ctx.strength, squad: 'camp', title: 'ночной налёт таскенов', after: 'raid', ctx: ctx });
        } },
      { id: 'flare', label: (s) => 'Осветительные ракеты — отпугнуть (' + C('tusken_raid').flareEnergy + ' энергии)',
        show: (s, ctx) => !ctx.surprised, req: needRes('energy', C('tusken_raid').flareEnergy),
        run(s, ctx, rng, E) {
          const c = C('tusken_raid');
          E.res(s, { energy: -c.flareEnergy });
          if (rng.chance(c.flareChance)) return 'Белый свет залил пустыню. Таскены замерли — и растворились за гребнем.';
          ctx.strength *= 1.15;
          return 'Ракеты не напугали налётчиков. ' + E.fight(s, rng, { enemy: 'tusken', strength: ctx.strength, squad: 'camp', title: 'ночной налёт таскенов', after: 'raid', ctx: ctx });
        } },
      { id: 'tribute', label: (s) => 'Оставить за периметром воду (' + C('tusken_raid').tributeWater + ' л) и не стрелять',
        show: (s, ctx) => !ctx.surprised, req: needRes('water', C('tusken_raid').tributeWater),
        run(s, ctx, rng, E) {
          const c = C('tusken_raid');
          E.res(s, { water: -c.tributeWater, discipline: -2 });
          E.rel(s, 'tusken', c.tributeRelation);
          return 'Канистры выкатили за периметр. Таскены забрали воду и ушли, не сделав ни выстрела.';
        } },
    ],
  });
  Ev.after.raid = function (s, rng, won, ctx, E) {
    const R2 = G.CONFIG.raids;
    s.stats.raids++;
    if (won) {
      E.rel(s, 'tusken', -2);
      return 'Налёт отбит.';
    }
    const w = Math.min(s.res.water, Math.round(ctx.strength * R2.lootWaterPerStrength));
    const m = Math.min(s.res.scrap, Math.round(ctx.strength * R2.lootScrapPerStrength));
    G.Res.add(s, 'water', -w);
    G.Res.add(s, 'scrap', -m);
    return 'Налётчики прорвались к складам и унесли ' + w + ' л воды и ' + m + ' ед. металла.';
  };
})(globalThis.G = globalThis.G || {});
