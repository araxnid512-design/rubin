#!/usr/bin/env node
/* Шаг 1 генератора голосов: собирает все реплики героинь из игры.
   Запускает игру в безголовом браузере, обходит сюжет, свидания, перепалки, концовки, «вдвоём» и т. д.
   и пишет lines.json: [{ id, text, hash }] — hash совпадает с тем, что игра считает в U.voxHash.
   Запуск: node tools/charmer-voice/extract.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const WWW = path.resolve(__dirname, '../../charmer/src/main/assets/www');

// Реплики, которые может сказать любая героиня (начала строк; полный текст берётся из исходников игры)
const ANY = `Хм. Я с тобой не разговариваю.|Иди к своей любимице, раз|Не смотри на меня так|Ну… ладно. Чуть-чуть простила|Мы же только что болтали|Ещё поговорить?|Отдохни сначала в таверне
Ммм… ты тёплый. Я тут полежу|Спокойной ночи, Чаровник|Если приснюсь|Леденец-сердечко?!|Пирожок! Мне?!|Ой, это мне?|Подарок! Просто так?|Хм. Неожиданно.
Это для меня? Ну, для нас|Ура! Я буду тут жить|Ты помнишь, что мне нравится|Это было здорово!|Мы отличная команда!|Ты лучший напарник|Ничего, в следующий раз|Хи-хи, ты старался|Я поддавалась!
Эй! Это слишком личное|Не-не-не.|За руку? Мы едва|Рано. Сначала поговори|Руки! Рановато|Ой! Куда?!|Что ты там шепчешь|Такое мне пока рано|Поцелуй?! Размечтался|*уворачивается* Не так быстро
Не трогай. Я обижена.|Руки убрал.|Хм! Иди к своей любимице.|…Ладно, гладь.|Хм. Явился.|Наконец-то мы одни|Мы одни? Хорошо.|Ты хотел побыть со мной?|Я всё слышала. Стены|Доброе утро, голубки.|Хм. Значит, вот как.
Ой! Чаровник! А мы тут|Раз уж пришёл|Почему тебе первой|Ммм… вот тут… ниже|Я запомнила. Ночью|Вот так… У тебя сильные руки|Ну и пожалуйста. Буду мыться|Чаровник… у тебя золотые руки|В следующий раз — наша очередь
Ты пришёл… Потрёшь|Ммм… у тебя такие руки|Какой воспитанный|Посмотрим ещё, кто кому|Ой, какие вы все милые|Я… я просто постою|А тебя вообще кто спрашивал
Я всё видела. ВСЁ.|Свидание, значит?|Хм. Хм-хм.|Следующее свидание — со мной|Мы обсуждали тактику.|ВСЮ НОЧЬ?!|Ну и ладно… *уходит|Хм! Ну и пожалуйста. Не очень|Праздник! И место рядом
Это место — моё. Без обсуждений|Ха! Он выбрал меня|Новенькая? Ну-ну.|Слушаться? Хи-хи.|Мы знакомы минуту`.split(/[|\n]/).map(s => s.trim()).filter(Boolean);

(async () => {
  const src = fs.readdirSync(path.join(WWW, 'js')).map(f => fs.readFileSync(path.join(WWW, 'js', f), 'utf8')).join('\n');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const any = [], miss = [];
  for (const p of ANY) { const m = new RegExp("(?:'|\\|)(" + esc(p) + "[^']*)'").exec(src); if (m) any.push(m[1]); else miss.push(p); }
  if (miss.length) console.warn('Не найдены в исходниках (пропущены):', miss);

  const b = await chromium.launch(), pg = await b.newPage();
  pg.on('pageerror', e => console.warn('PAGE', e.message));
  await pg.goto('file://' + WWW + '/index.html'); await pg.waitForTimeout(500);
  const lines = await pg.evaluate((any) => {
    const out = new Map(), S = G.S;
    const add = (id, t) => { if (!D.GIRLS[id] || !t) return; const c = U.voxClean(t); if (!c || /[{§]/.test(c)) return; out.set(id + '|' + c, { id, text: c, hash: U.voxHash(id, c) }); };
    const walk = L => { for (const l of L || []) { if (!l) continue; if (l.girl && l.t) add(l.girl, l.t); if (l.ask) for (const o of l.ask) walk(o.r); } };
    const ex = (id, s) => { if (!s) return; const i = s.indexOf('|'); add(id, i >= 0 && /^[a-z]+$/.test(s.slice(0, i)) ? s.slice(i + 1) : s); };
    const mk = id => { const g = G.mkGirl(id, 20); g.aff = 80; g.dates = 3; return g; };
    const P = ST._priv(), ALL = D.ALL;
    // личные реплики
    for (const id in D.GIRLS) {
      const d = D.GIRLS[id]; if (d.npc) continue;
      add(id, d.tame); (d.ok || []).forEach(t => add(id, t)); (d.bad || []).forEach(t => add(id, t)); (d.talk || []).forEach(t => add(id, t));
      for (const k in D.MOOD[id] || {}) add(id, D.MOOD[id][k]);
      const T = D.TASTE[id]; if (T) { add(id, T[2]); add(id, T[3]); }
      const H = D.TOUCH[id]; if (H) for (const k in H) if (k !== 'sp') [].concat(H[k]).forEach(t => add(id, t));
      for (const tab of [P.CLAIM, P.SEATWIN, P.TEN, P.NIGHT, D.NIGHT2]) ex(id, tab && tab[id]);
      D.SULK.forEach(t => add(id, t)); any.forEach(t => add(id, t));
    }
    add('fox', 'А мне? Ладно, я половину уже откусила, пока ты не смотрел.');
    // свидания, концовки, ночи
    for (const id of ALL) {
      for (let n = 0; n < 3; n++) { const g = mk(id); g.dates = n; S.party = [g]; walk(ST.date(g, true)); }
      walk(FX.ending(mk(id), true)); walk(FX.night(mk(id), true));
    }
    // перепалки пар
    for (const p of ST.PAIRS) walk(ST.banterByKey(p.slice().sort().join('+')));
    // сцены с ролями: ведущая, a/b
    for (const id of ALL) {
      S.party = [mk(id), mk('dryad'), mk('valkyrie')]; S.flags.starter = true;
      const ctx = { l: id, a: id, b: id, n: id, id, A: '§', B: '§', N: '§' };
      for (const k in P.ENTER) walk(ST.norm(P.ENTER[k](), ctx));
      for (const k in P.AFTER) walk(ST.norm(P.AFTER[k](), ctx));
      for (const sc of P.GENERIC.concat(D.HOME)) walk(ST.norm(sc.l.concat([{ ask: sc.q }]), ctx));
      walk(ST.before('boss')); walk(ST.party());
      // ревность к новенькой — с именем каждой
      const j = P.JEAL[id] || D.JEAL2[id];
      if (j) for (const o of ALL) if (o !== id) walk(ST.norm([id + ':' + j], { N: D.GIRLS[o].name }));
    }
    for (const id of D.STARTERS) walk(ST.starter(id));
    S.party = ALL.slice(0, 6).map(mk); walk(ST.allTen()); walk(ST.norm(D.DRAGON_TALK));
    return [...out.values()];
  }, any);
  await b.close();
  fs.writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(lines));
  const by = {}; for (const l of lines) by[l.id] = (by[l.id] || 0) + 1;
  console.log('Реплик:', lines.length, by);
})();
