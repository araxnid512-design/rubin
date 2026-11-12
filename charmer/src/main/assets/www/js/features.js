'use strict';
/* Связующая логика второй волны: время и погода, обиды, подарки, усадьба, турнир и реванши, концовки, альбом, голоса */
(function () {
  const FX = window.FX = {};
  const S = () => G.S;
  const all = () => S().party.concat(S().box);

  /* ---------- Время суток и погода ---------- */
  FX.PH = { morn: 'Утро', day: 'День', eve: 'Вечер', night: 'Ночь' };
  FX.WX = { sun: '☀', rain: '☂', snow: '❄', fog: '≋' };
  FX.phase = () => { const c = (S().clock === undefined ? 0.3 : S().clock) % 1; return c < 0.2 ? 'morn' : c < 0.6 ? 'day' : c < 0.78 ? 'eve' : 'night'; };
  FX.tick = dt => { S().clock = ((S().clock === undefined ? 0.3 : S().clock) + dt / 300) % 1; };
  const WXP = { village: [['sun', 0.8], ['rain', 0.2]], meadow: [['sun', 0.7], ['rain', 0.3]], forest: [['sun', 0.55], ['rain', 0.45]], mountain: [['snow', 0.7], ['sun', 0.3]], beach: [['sun', 0.85], ['rain', 0.15]], swamp: [['fog', 0.6], ['rain', 0.4]] };
  FX.rollWeather = function (id) { const p = WXP[id]; if (!p) { S().wx = 'sun'; return; } let r = Math.random(); for (const [k, w] of p) if ((r -= w) <= 0) { S().wx = k; return; } S().wx = p[0][0]; };
  const RAIN = []; for (let i = 0; i < 90; i++) RAIN.push([Math.random(), Math.random(), 0.7 + Math.random() * 0.6]);
  FX.screenFx = function (x, V, m, tm) {
    if (m.def.indoor || m.def.cave) return;
    const ph = FX.phase(), w = V.w, h = V.h, wx = S().wx;
    const tint = { night: 'rgba(14,12,60,.42)', eve: 'rgba(255,110,60,.14)', morn: 'rgba(255,190,220,.08)' }[ph];
    if (tint) { x.fillStyle = tint; x.fillRect(0, 0, w, h); }
    if (ph === 'night') { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.5; x.drawImage(ART.glow, w / 2 - h * 0.45, h / 2 - h * 0.45, h * 0.9, h * 0.9); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    if (wx === 'rain') { x.fillStyle = 'rgba(40,60,110,.12)'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(200,220,255,.55)'; x.lineWidth = Math.max(1, h / 400); x.beginPath(); for (const r of RAIN) { const px = (r[0] * w + tm * 120 * r[2]) % w, py = (r[1] * h + tm * 700 * r[2]) % h; x.moveTo(px, py); x.lineTo(px - h * 0.01, py + h * 0.04); } x.stroke(); }
    if (wx === 'fog') { x.globalAlpha = 0.22; for (let i = 0; i < 4; i++) { const px = ((i * 0.31 + tm * 0.01) % 1.4 - 0.2) * w; x.drawImage(ART.glow, px - h * 0.6, h * (0.2 + i * 0.2) - h * 0.3, h * 1.2, h * 0.6); } x.globalAlpha = 1; }
    if (wx === 'snow' && m.id === 'mountain') { x.fillStyle = 'rgba(230,240,255,.12)'; x.fillRect(0, 0, w, h); }
  };

  /* ---------- Обиды ---------- */
  FX.sulky = g => (g.sulk || 0) >= 30;
  FX.sulkChange = function (g, d) {
    if (d < 0) g.sulk = Math.min(100, (g.sulk || 0) - d * 5);
    else g.sulk = Math.max(0, (g.sulk || 0) - d * 2);
    if (d >= 10) for (const o of S().party) if (o !== g && o.aff >= 40) { o.sulk = Math.min(100, (o.sulk || 0) + 5); }
  };

  /* ---------- Подарки ---------- */
  FX.gift = function (g, it) {
    const s = S(), Tt = D.TASTE[g.id] || [], love = Tt[0] === it, hate = Tt[1] === it, d = love ? D.ITEMS[it].gift * 2 + 4 : hate ? -5 : D.ITEMS[it].gift;
    s.bag[it]--; s.know = s.know || {};
    if (love) s.know[g.id + '+'] = it; if (hate) s.know[g.id + '-'] = it;
    const L = [];
    if (love) L.push({ girl: g.id, expr: 'happy', t: Tt[2] });
    else if (hate) L.push({ girl: g.id, expr: 'angry', t: Tt[3] });
    else L.push({ girl: g.id, expr: 'happy', t: it === 'candy' ? 'Леденец-сердечко?! Это… это намёк? *хрустит и краснеет*' : it === 'pie' ? 'Пирожок! Мне?! *ест, жмурясь от счастья*' : U.pick(['Ой, это мне? Спасибо! *прячет подарок поближе к сердцу*', 'Подарок! Просто так? Ты… ты милый.', 'Хм. Неожиданно. Приятно неожиданно.'], Math.random) });
    const fox = s.party.find(q => q.id === 'fox' && q !== g);
    if (fox && it === 'pie' && Math.random() < 0.3) L.push({ girl: 'fox', expr: 'smug', t: 'А мне? Ладно, я половину уже откусила, пока ты не смотрел.' });
    L.push({ fn: () => { ST.aff({ [g.id]: d }); if (!hate) g.sulk = Math.max(0, (g.sulk || 0) - 20); } });
    if (love) L.push({ t: 'Ты узнал: ' + D.GIRLS[g.id].name + ' обожает «' + D.ITEMS[it].n + '»!' });
    if (hate) L.push({ t: 'Запомни: ' + D.GIRLS[g.id].name + ' терпеть не может «' + D.ITEMS[it].n + '».' });
    return L;
  };

  /* ---------- Бой: соперницы, подруги ---------- */
  const pk = (a, b) => [a, b].sort().join('+');
  FX.rel = function (g) {
    const out = [];
    for (const p of ST.PAIRS || []) if (p.includes(g.id)) { const o = p[0] === g.id ? p[1] : p[0], og = S().party.find(q => q.id === o && q.hp > 0); if (og) out.push({ g: og, friend: !!S().flags['ok_' + pk(g.id, o)] }); }
    return out;
  };
  FX.battleIntro = function (g) {
    const r = FX.rel(g)[0]; if (!r) return null; const a = D.GIRLS[g.id].name, b = D.GIRLS[r.g.id].name;
    return r.friend ? a + ' и ' + b + ' подмигивают друг другу: «Покажем им!» Подруги бьют сильнее.' : b + ' из-за спины: «Ну-ну, посмотрим, как ты справишься». ' + a + ' злится.';
  };
  FX.boost = g => FX.rel(g).some(r => r.friend) ? 1.12 : 1;
  FX.distract = g => FX.rel(g).some(r => !r.friend) && Math.random() < 0.08;
  FX.duetPartner = function (g) { if (g.aff < 50) return null; return S().party.find(o => o !== g && o.hp > 0 && o.aff >= 50 && (FX.rel(g).some(r => r.g === o && r.friend) || o.aff >= 75)) || null; };

  /* ---------- Усадьба ---------- */
  const SPOTS = [[4, 4], [8, 3], [10, 4], [4, 6], [9, 6], [3, 8], [10, 8], [5, 8], [9, 8], [12, 4], [12, 8], [7, 6], [5, 3], [11, 7]];
  FX.manorDef = function (def) {
    const lead = S().party[0], res = all().filter(g => g !== lead);
    def.npcs = res.slice(0, SPOTS.length).map((g, i) => ({ id: 'res_' + g.id, x: SPOTS[i][0], y: SPOTS[i][1], face: 'down', look: 'girl', girl: g.id }));
    def.props = Object.keys(S().furn || {}).filter(k => D.FURN_SPOT[k]).map(k => [k, D.FURN_SPOT[k][0], D.FURN_SPOT[k][1]]);
  };
  FX.resident = function (n) { const g = all().find(q => q.id === n.girl); if (g) UI.cardOf(g); };
  FX.onManor = function () {
    const res = all(); if (res.length < 2 || S().flags.homeEv || Math.random() > 0.65) return;
    S().flags.homeEv = true;
    setTimeout(() => {
      if (UI.dialogOpen() || G.mode !== 'world') return;
      const ev = U.pick(D.HOME, Math.random), a = U.pick(res, Math.random).id, b = U.pick(res.filter(g => g.id !== a), Math.random).id;
      UI.say([{ music: 'quarrel' }].concat(ST.norm(ev.l.concat([{ t: 'Что скажешь?', ask: ev.q }]), { a, b, A: ST.name(a), B: ST.name(b) })), () => G.save());
    }, 500);
  };
  FX.buyFurn = function (k) {
    const f = D.FURN[k]; S().furn = S().furn || {}; S().furn[k] = 1;
    const fans = f.love.filter(id => ST.find(id)), m = {}; for (const id of fans) m[id] = 6;
    const L = [{ t: '«' + f.n + '» доставлен в усадьбу!' }];
    if (fans.length) L.push({ girl: fans[0], expr: 'happy', t: U.pick(['Это для меня? Ну, для нас… но больше для меня, да?', 'Ура! Я буду тут жить! То есть я и так тут живу. Но теперь — красиво!', 'Ты помнишь, что мне нравится… *краснеет*'], Math.random) }, { fn: () => ST.aff(m) });
    return L;
  };

  /* ---------- Реванши и турнир ---------- */
  FX.rematch = function (n) {
    const key = n.trainer, tr = D.TRAINERS[key], lv = D.REMATCH[key];
    if (S().flags['r_' + key]) return UI.say([{ who: tr.n, t: 'Хватит на сегодня! Приходи после отдыха — устроим ещё.' }]);
    D.TRAINERS['r_' + key] = { n: tr.n, team: tr.team.map((p, i) => [p[0], lv + i]), prize: tr.prize * 2 + 400, before: ['Реванш!'], lose: U.pick(['Опять?! Ну ты силён, Чаровник…', 'Я тренировалась! Ну… почти.', 'В следующий раз точно!'], Math.random), after: tr.after };
    UI.say([{ who: tr.n, t: 'Чаровник! Я стала сильнее. Реванш? Мои девицы теперь ' + lv + '+ уровня.' }, { ask: [{ t: 'Давай!', a: null, r: [{ fn: () => setTimeout(() => BT.start({ trainer: 'r_' + key, zone: WD.m.id, npc: n }), 30) }] }, { t: 'В другой раз', a: null, r: [{ who: tr.n, t: 'Струсил? Ладно, жду.' }] }] }]);
  };
  const TN = ['Лиловая Луиза', 'Барыня Брунгильда', 'Чемпионка Чара'];
  FX.tourney = function () {
    const p = S().party, avg = Math.round(p.reduce((s, g) => s + g.lvl, 0) / p.length), pool = D.ALL.slice();
    for (let i = 1; i <= 3; i++) {
      const lv = Math.max(16, avg - 3 + i * 2), team = []; for (let k = 0; k < (i === 3 ? 3 : 2); k++) team.push([pool.splice((Math.random() * pool.length) | 0, 1)[0], lv + k]);
      D.TRAINERS['tour' + i] = { n: TN[i - 1], team, prize: 300 * i, before: ['Бой ' + i + ' из 3!'], lose: ['Ах! Проходи дальше.', 'Ты силён… Финал ждёт!', 'Невероятно! Ты чемпион!'][i - 1], after: '' };
      S().flags['tour' + i] = false;
    }
    S().flags.tourDay = true;
    UI.say([{ who: 'Тётка Дуня', t: 'Турнир Пьяного Гуся! Три боя подряд, без отдыха. Победителю — 2000 монет и кубок!' }, { fn: () => setTimeout(() => BT.start({ trainer: 'tour1', zone: 'meadow' }), 30) }]);
  };
  FX.after = function (key) {
    if (key === 'tour1' || key === 'tour2') { const n = key === 'tour1' ? 2 : 3; for (const g of S().party) { const mx = G.stats(g).hp; g.hp = Math.min(mx, Math.max(g.hp, 0) + Math.ceil(mx * 0.5)); } return [{ who: 'Тётка Дуня', t: (n === 3 ? 'Финал! Держись, Чаровник!' : 'Второй бой! Девицы, не расслабляемся!') + ' Пирожки между боями — полздоровья всем.' }, { fn: () => setTimeout(() => BT.start({ trainer: 'tour' + n, zone: n === 3 ? 'tower' : 'forest' }), 30) }]; }
    if (key === 'tour3') { return [{ who: 'Тётка Дуня', t: 'ЧЕМПИОН! Держи 2000 монет и кубок. Девицы твои сияют от гордости!' }, { fn: () => { S().money += 2000; S().cups = (S().cups || 0) + 1; const m = {}; for (const g of S().party) m[g.id] = 5; ST.aff(m); G.save(); } }]; }
    if (key && key.startsWith('r_')) return [];
    if (key === 'dragon') return [];
    return null;
  };

  /* ---------- Драконица ---------- */
  FX.dragon = function () {
    if (!G.alive()) return UI.say([{ t: 'Твои девицы без сил. С драконом так не шутят.' }]);
    UI.say(ST.norm(D.DRAGON_TALK).concat([{ fn: () => setTimeout(() => BT.start({ wild: { id: 'dragon', lvl: 35 }, zone: 'dungeon' }), 30) }]));
  };

  /* ---------- Концовки ---------- */
  FX.canEnd = g => (g.dates || 0) >= 3 && g.aff >= 90;
  FX.ending = function (g, replay) {
    const id = g.id;
    return [{ bg: D.ENDBG[id] || 'sunset', music: 'date' }].concat(ST.norm(D.ENDINGS[id], { id }), [{ fn: () => { if (replay) return; S().endings = S().endings || {}; const first = !S().endings[id]; S().endings[id] = 1; FX.rec('e_' + id); if (first) { UI.toast('★ Открыта концовка: ' + D.GIRLS[id].name, 'up'); S().money += 500; } G.save(); } }]);
  };

  /* ---------- Альбом ---------- */
  FX.rec = k => { S().album = S().album || {}; S().album[k] = 1; };
  FX.album = function () {
    const a = S().album || {}, out = [];
    const story = [['s_boss', 'Признание ведьмы'], ['s_party', 'Праздник в таверне'], ['s_ten', 'Все десять']];
    for (const [k, n] of story) out.push({ k, n, sec: 'Сюжет', open: !!a[k] });
    for (const id of D.ALL) for (let i = 0; i < 3; i++) out.push({ k: 'd_' + id + '_' + i, n: D.GIRLS[id].name + ': свидание ' + (i + 1), sec: 'Свидания', open: !!a['d_' + id + '_' + i], id });
    for (const id of D.ALL) out.push({ k: 'e_' + id, n: D.GIRLS[id].name + ': концовка', sec: 'Концовки', open: !!a['e_' + id], id });
    for (const p of ST.PAIRS) { const k = 'b_' + p.slice().sort().join('+'); out.push({ k, n: D.GIRLS[p[0]].name + ' vs ' + D.GIRLS[p[1]].name, sec: 'Перепалки', open: !!(a[k] || S().flags[k]) }); }
    return out;
  };
  FX.replay = function (k) {
    let L = null; const m = /^d_(\w+)_(\d)$/.exec(k), e = /^e_(\w+)$/.exec(k);
    if (m) { const g = G.mkGirl(m[1], 10); g.dates = +m[2]; L = ST.date(g, true); }
    else if (e) L = FX.ending(G.mkGirl(e[1], 10), true);
    else if (k.startsWith('b_')) L = ST.banterByKey(k.slice(2));
    else if (k === 's_party') L = ST.party(); else if (k === 's_ten') L = ST.allTen(); else if (k === 's_boss') L = ST.after('boss');
    if (L) UI.say(L, null, { replay: true });
  };

  /* ---------- Мини-игры ---------- */
  FX.playMG = function (g) {
    const kind = MG.forGirl(g.id); if (!kind) return;
    UI.close();
    MG.start(kind, res => {
      const s = S(), sc = res.score, good = sc >= res.max * 0.6;
      if (kind === 'fish') s.bag.fish = (s.bag.fish || 0) + sc; if (kind === 'pancake') s.bag.pie = (s.bag.pie || 0) + sc;
      if (kind === 'song') s.money += sc * 15; if (kind === 'hide' && sc >= 2) s.bag.candy = (s.bag.candy || 0) + 1;
      const rew = { fish: 'рыбы: ' + sc, pancake: 'пирожков: ' + sc, song: 'монет: ' + sc * 15, hide: sc >= 2 ? 'леденец' : 'ничего' }[kind];
      const line = good ? U.pick(['Это было здорово! Давай ещё как-нибудь!', 'Мы отличная команда! Прямо как парочка… ой.', 'Ты лучший напарник для игр!'], Math.random) : U.pick(['Ничего, в следующий раз получится!', 'Хи-хи, ты старался. Это главное.', 'Я поддавалась! …Нет.'], Math.random);
      const L = [{ girl: g.id, expr: good ? 'happy' : 'smug', t: line }, { t: 'Награда — ' + rew + '.' }];
      if (!g.mgDone) { g.mgDone = true; L.push({ fn: () => ST.aff({ [g.id]: 3 + sc }) }); }
      U.music(WD.m.id === 'village' || WD.m.id === 'manor' ? 'tavern' : 'world');
      UI.say(L, () => G.save());
    });
  };

  FX.mapMusic = () => !WD.m ? 'world' : (WD.m.id === 'village' || WD.m.id === 'manor') ? 'tavern' : 'world';

  /* ---------- Голоса героинь ---------- */
  FX.VOICE = { fox: [1050, 'square'], slime: [620, 'sine'], harpy: [1400, 'square'], lamia: [700, 'triangle'], dryad: [520, 'sine'], minotaur: [380, 'triangle'], vampire: [860, 'triangle'],
    valkyrie: [760, 'square'], neko: [1200, 'triangle'], snow: [1320, 'sine'], witch: [950, 'sawtooth'], mermaid: [1100, 'sine'], frog: [300, 'square'], ghost: [1500, 'sine'], dragon: [260, 'sawtooth'], me: [700, 'square'], npc: [880, 'square'] };
})();
