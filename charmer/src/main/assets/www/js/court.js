'use strict';
/* Знакомство: дикие девы не ловятся в бою — их надо очаровать разговором и подарками,
   а когда интерес созреет, позвать с собой (нужна печать-сердечко). */
(function () {
  const S = () => G.S;
  D.STYLES = { sweet: 'Нежно', bold: 'Дерзко', joke: 'Со смехом', polite: 'Почтительно' };
  D.PICKUP = {
    sweet: ['У тебя глаза, в которых хочется остаться. Можно я посмотрю ещё?', 'Ты как тёплое утро. Даже если ты чудище.', 'Я шёл мимо и понял, что дальше идти не хочу.', 'С тобой рядом тихо и хорошо. Не уходи.', 'Можно я буду звать тебя своим солнышком?'],
    bold: ['С такой фигурой по долине ходить опасно. Для окружающих.', 'Я бы приручил тебя и без печати. Руками.', 'Красавица, у тебя есть планы на эту ночь? Теперь есть.', 'Ты смотришь так, будто уже решила меня съесть. Я не против.', 'Спорим, ты покраснеешь раньше, чем я договорю?'],
    joke: ['Ты случайно не печать-сердечко? А то я попался.', 'Мама говорила не разговаривать с чудищами. Мама ошибалась.', 'У меня есть пирожок и нет стыда. Выбирай.', 'Я заблудился. В твоих глазах. Третий день хожу.', 'Давай так: ты меня не ешь, а я веду тебя в таверну.'],
    polite: ['Позвольте выразить восхищение. Вы — украшение этой долины.', 'Для меня честь говорить с вами, госпожа.', 'Я слышал о вас легенды. Они не врут — вы ещё прекраснее.', 'Разрешите сопровождать вас. Хотя бы до заката.', 'Ваша сила и красота достойны песен. Я не пою, но попробую.']
  };
  // что нравится и что бесит
  D.LIKES = { fox: ['bold', 'joke'], slime: ['sweet', 'joke'], harpy: ['joke', 'bold'], lamia: ['bold', 'sweet'], dryad: ['sweet', 'polite'], minotaur: ['sweet', 'polite'], vampire: ['polite', 'bold'], valkyrie: ['polite', 'sweet'],
    neko: ['bold', 'joke'], snow: ['sweet', 'polite'], mermaid: ['polite', 'bold'], frog: ['sweet', 'joke'], ghost: ['sweet', 'joke'] };
  D.HATES = { fox: 'polite', harpy: 'polite', lamia: 'joke', dryad: 'bold', minotaur: 'bold', vampire: 'joke', valkyrie: 'bold', neko: 'polite', snow: 'bold', mermaid: 'joke', frog: 'polite', ghost: 'bold' };
  D.MEET = {
    fox: 'smug|О, человек. Один. Без охраны. И пахнет пирожками… Ты хоть понимаешь, как рискуешь, красавчик?',
    slime: 'happy|Ой, человек! Тёплый! Можно я тебя потрогаю? Везде? Я только попробую!',
    harpy: 'happy|Чик! Новенький! Хорошенький! Я уже придумала про нас три сплетни. Хочешь, сделаем их правдой?',
    lamia: 'smug|Ссс… Какой аппетитный путник. Подойди ближе. Я не кусаюсь. Я обвиваю.',
    dryad: 'sleepy|Ммм… ты меня разбудил. За это положено обнимать. Час. Или пока не усну снова.',
    minotaur: 'blush|Ой! Ч-человек! Не смотри так… я большая, знаю. Но я нежная. Честно. Хочешь проверить?',
    vampire: 'smug|Смертный. В моих владениях. С такой шеей. Графиня заинтригована… и немного голодна.',
    valkyrie: 'normal|Стой! Назовись. Хм. Плечи широкие. Взгляд дерзкий. Устав велит тебя допросить. Лично. Наедине.',
    neko: 'smug|Мрр. Человек. Тёплые колени есть? Тогда у тебя есть шанс. Маленький. Мурлыкай, я слушаю.',
    snow: 'blush|Ой… живой… тёплый… Не подходи, я растаю. Или подойди. Чуть-чуть. Хочу узнать, как это.',
    mermaid: 'smug|Ещё один моряк? Нет? Сухопутный. Тем интереснее. Знаешь, что русалки делают с теми, кто им понравился?',
    frog: 'happy|Ква! Принц?! Ты принц? Нет? А целоваться умеешь? Мне для проверки! Срочно!',
    ghost: 'surprised|Ты… меня видишь? Я триста лет ни с кем… А ты красивый. Можно я постою рядом? Совсем близко?'
  };
  const AGAIN = ['smug|Опять ты? Ну… я не против.', 'blush|Я тебя ждала. Только никому не говори.', 'love|Ну наконец-то. Я уже соскучилась. Иди сюда.'];
  const BYE = ['smug|Мне пора. Приходи ещё — может, я и соглашусь.', 'wink|На сегодня хватит. А то привыкну к тебе.'];
  const MEH = ['smug|Хм. Неплохо. Но я слышала и получше.', 'normal|Ну… допустим. Продолжай.'];
  const NOPE = 'smug|Пойти с тобой? Рано. Удиви меня ещё.';
  const JLVL = { meadow: 5, forest: 9, mountain: 13, beach: 20, swamp: 24, dungeon: 28 };
  const BG = { meadow: 'meadow', forest: 'glade', mountain: 'snow', beach: 'beach', swamp: 'pond', dungeon: 'cave' };
  FX.courtNeed = id => Math.round(60 + (0.55 - D.GIRLS[id].rate) * 100);

  FX.court = function (w) {
    const s = S(), id = w.id, d = D.GIRLS[id], need = FX.courtNeed(id), zone = WD.HOME[id];
    s.court = s.court || {}; const first = !(id in s.court); if (first) s.court[id] = 0; s.seen[id] = true;
    let left = 3;
    const it = () => s.court[id], add = v => { s.court[id] = Math.max(0, Math.min(need + 20, it() + v)); UI.toast((v > 0 ? '♥ интерес +' : '♡ интерес ') + v + ' (' + it() + '/' + need + ')', v > 0 ? 'up' : 'down'); };
    const G1 = (e, t) => ({ girl: id, expr: e, t }), P = str => { const i = str.indexOf('|'); return G1(str.slice(0, i), str.slice(i + 1)); };
    const bye = () => [P(U.pick(BYE, Math.random)), { fn: () => { WD.relocate(w); G.save(); } }];
    const after = () => (--left <= 0 ? bye() : menu());
    const gifts = () => D.GIFTS.filter(k => s.bag[k]);
    function menu() {
      const o = [{ t: 'Сделать комплимент', a: null, r: [{ next: compl }] }];
      if (gifts().length) o.push({ t: 'Подарить что-нибудь', a: null, r: [{ next: gift }] });
      o.push({ t: 'Позвать с собой ♥ ' + it() + '/' + need, a: null, r: [{ next: join }] }, { t: 'Попрощаться', a: null, r: bye() });
      return [{ t: d.name + ' · интерес ' + it() + '/' + need + ' · осталось действий: ' + left, ask: o }];
    }
    function compl() {
      const keys = Object.keys(D.STYLES).sort(() => Math.random() - 0.5).slice(0, 3);
      return [{ t: 'Как сказать?', ask: keys.map(k => { const line = U.pick(D.PICKUP[k], Math.random), like = (D.LIKES[id] || []).includes(k), hate = D.HATES[id] === k;
        return { t: D.STYLES[k] + ': «' + line + '»', a: null, r: [like ? G1(it() > need * 0.5 ? 'love' : 'blush', U.pick(d.ok, Math.random)) : hate ? G1('angry', U.pick(d.bad, Math.random)) : P(U.pick(MEH, Math.random)), { fn: () => add(like ? 22 : hate ? -8 : 10) }, { next: after }] }; }) }];
    }
    function gift() {
      const o = gifts().slice(0, 5).map(k => { const Tt = D.TASTE[id] || [], love = Tt[0] === k, hate = Tt[1] === k;
        return { t: D.ITEMS[k].n + ' ×' + s.bag[k], a: null, r: [love ? G1('happy', Tt[2]) : hate ? G1('angry', Tt[3]) : G1('happy', 'Подарок! Просто так? Ты… ты милый.'), { fn: () => { s.bag[k]--; s.know = s.know || {}; if (love) s.know[id + '+'] = k; if (hate) s.know[id + '-'] = k; add(love ? 40 : hate ? -15 : 14); } }, { next: after }] }; });
      o.push({ t: '← Назад', a: null, r: [{ next: menu }] });
      return [{ t: 'Что подарить?', ask: o }];
    }
    function join() {
      if (it() < need) return [P(NOPE), { next: after }];
      if (!s.bag.seal) return [{ t: 'У тебя кончились печати-сердечки. Загляни в лавку — без печати союз не скрепить.' }, { next: menu }];
      const jl = ST.caught(id);
      return [G1('love', d.tame), { fn: () => { s.bag.seal--; const g = G.addGirl(id, JLVL[zone] || 5); g.aff = 15; WD.removeWild(id); U.sfx('caught'); U.fanfare && U.fanfare(); UI.toast('♥ ' + d.name + ' теперь с тобой!', 'up'); s.money += 60; G.save(); } }].concat(jl);
    }
    const intro = first ? [{ t: 'Перед тобой — ' + d.kind.toLowerCase() + ' ' + d.name + '. ' + d.bio }, P(D.MEET[id])] : [P(AGAIN[it() >= need * 0.7 ? 2 : it() >= need * 0.3 ? 1 : 0])];
    UI.say([{ bg: BG[zone] || 'meadow', music: 'date' }].concat(intro, [{ next: menu }]), () => G.save());
  };
  D.COURT_ANY = AGAIN.concat(BYE, MEH, [NOPE]);
})();
