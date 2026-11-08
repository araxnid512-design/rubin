/* Клык — Сказитель, небольшой ИИ-рассказчик.
   Не нейросеть: набор правил, весов и памяти, который работает в браузере за доли миллисекунды.
   1. Понимает свободный ход: разбирает фразу игрока на стиль действия (сила, хитрость, слово, знание)
      и цель (кого касается).
   2. Отвечает на выбор: бросок к20 с бонусом стиля, исход, реакция героя по его характеру,
      мысли Глеба, изменение отношений, запись в память.
   3. Ведёт сюжет: у каждой главы есть цель. Сказитель следит, насколько история продвинулась,
      и подбирает сцены так, чтобы она шла к кульминации. Если игрок буксует, он подкидывает
      сцены-толчки. Если стиль игрока ясен, чаще даёт возможность им воспользоваться, а иногда
      проверяет слабую сторону. */
(function () {
  'use strict';
  const R = window.R, K = R.KLYK;
  const STY = ['sila', 'hitr', 'slovo', 'znan'];

  /* ---------- 1. Понимание свободного хода ---------- */
  const LEX = {
    sila: ['удар', 'бью', 'бить', 'побь', 'избит', 'напад', 'напасть', 'атак', 'драт', 'дерус', 'дерёмс', 'подерус', 'рыч', 'зарыч', 'убить', 'убью', 'убива', 'зареж', 'заруб', 'руби', 'топор', 'кулак', 'слома', 'ломаю', 'разорв', 'задуш', 'прыга', 'прыгн', 'бросаю', 'бросит', 'брошусь', 'толкн', 'вызыва', 'вызов', 'вызвать', 'поедин', 'угрож', 'пугн', 'напуга', 'рявк', 'силой', 'схват', 'хвата', 'отобра', 'выбить', 'выбью', 'вырва', 'поднять', 'подниму', 'тащ', 'сражат', 'сражаюс', 'биться', 'бой', 'драку', 'отбива', 'отбить', 'раскида', 'ворваться', 'врываюс', 'съесть', 'съем', 'жрать', 'сожр', 'загрыз', 'охот'],
    hitr: ['обман', 'обману', 'обмануть', 'хитр', 'украд', 'украсть', 'укра', 'краду', 'ворова', 'спрят', 'пряч', 'тайк', 'тайно', 'тихо', 'подслуш', 'следит', 'слежу', 'выслед', 'подкрад', 'ловуш', 'подстав', 'солга', 'совра', 'вру', 'лгу', 'притвор', 'отвлек', 'отвлечь', 'подкуп', 'отрав', 'сбеж', 'убеж', 'ускольз', 'обойт', 'обойду', 'незамет', 'подмен', 'шантаж', 'выманить', 'заманить', 'заманю', 'перехитр', 'засад', 'подсыпа', 'бежать', 'бегу', 'сбегу', 'улизн', 'проскольз', 'прокрад'],
    slovo: ['говор', 'поговор', 'сказа', 'скажу', 'убед', 'уговор', 'договор', 'переговор', 'прошу', 'проси', 'попрос', 'обещ', 'извин', 'похвал', 'льст', 'торгу', 'поторг', 'шуч', 'пошут', 'рассказ', 'спрос', 'спрашива', 'объясн', 'мир', 'дружб', 'подруж', 'клян', 'речь', 'предлож', 'позва', 'позову', 'крикн', 'ответ', 'утеш', 'успоко', 'благодар', 'помир', 'спеть', 'спою', 'песн', 'призн', 'признаюс', 'правду', 'поприветств', 'здорова', 'познаком', 'обня', 'обним', 'поцел', 'помоч', 'помогу', 'пригласи', 'простить', 'прощу', 'спасиб'],
    znan: ['постро', 'строю', 'сдела', 'изобрет', 'придума', 'чертеж', 'чертёж', 'вспомн', 'леч', 'вылеч', 'перевяз', 'трав', 'огонь', 'костёр', 'костер', 'развест', 'разведу', 'разжечь', 'рычаг', 'колес', 'стрем', 'изуч', 'исслед', 'наблюд', 'осмотр', 'осмотрю', 'план', 'карт', 'счита', 'посчит', 'подсчит', 'наук', 'физик', 'хими', 'истори', 'научи', 'учить', 'мастер', 'собрат', 'соберу', 'почин', 'копа', 'вырою', 'вода', 'воду', 'кипят', 'следы', 'прочита', 'изготов', 'механизм', 'инструмент', 'формул', 'кузн', 'выков', 'посмотр', 'смотр', 'разгляд', 'изготов', 'выясн', 'понять', 'пойму', 'проверить', 'проверю'],
  };
  const PASSIVE = ['жду', 'подожд', 'ждать', 'ничего', 'отдых', 'отдохн', 'сплю', 'спать', 'посплю', 'лягу', 'уйти', 'ухожу', 'уйду', 'пропуст', 'молч', 'выжида', 'сижу', 'сидеть', 'медит'];
  const NPC_RE = { nisa: /^нис/, yrga: /^(ырг|шаман)/, gharr: /^(гхарр|вожд)/, brak: /^брак/, shnyr: /^(шныр|гоблин)/, agnia: /^(агни|лекарк)/, savva: /^(савв|купц|купец)/, khan: /^(хан(а|у|ом|е)?$|кхараз)/ };

  function tokens(text) { return String(text || '').toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z0-9-]+/).filter(Boolean); }
  const norm = (s) => s.replace(/ё/g, 'е');

  function dominant(S) {
    let best = null, v = 0;
    for (const s of STY) if (S.style[s] > v) { v = S.style[s]; best = s; }
    return best;
  }
  function weakest(S) {
    let best = STY[0], v = Infinity;
    for (const s of STY) if (S.style[s] < v) { v = S.style[s]; best = s; }
    return best;
  }

  function classify(text, S) {
    const toks = tokens(text);
    const score = { sila: 0, hitr: 0, slovo: 0, znan: 0 }, hits = [];
    let passive = 0, npc = null;
    toks.forEach((tk, i) => {
      if (i > 0 && toks[i - 1] === 'не') return;
      for (const s of STY) if (LEX[s].some((st) => tk.indexOf(norm(st)) === 0)) { score[s]++; hits.push(tk); }
      if (PASSIVE.some((st) => tk.indexOf(st) === 0)) passive++;
      if (!npc) for (const k of Object.keys(NPC_RE)) if (NPC_RE[k].test(tk)) { npc = k; break; }
    });
    let style = null, best = 0;
    const dom = S ? dominant(S) : null;
    for (const s of STY) if (score[s] > best || (score[s] === best && best > 0 && s === dom)) { best = score[s]; style = s; }
    if (!style && passive) style = 'wait';
    if (!style && npc) style = 'slovo'; // назван герой, а действие неясно: считаем это разговором
    return { style, npc, score, hits, passive };
  }

  /* ---------- 2. Ответ на выбор ---------- */
  const STYLE_FX = {
    sila: { ok: { auth: 3, blood: 5 }, bad: { hp: -4, blood: 3 } },
    hitr: { ok: { auth: 2, blood: -1 }, bad: { auth: -3 } },
    slovo: { ok: { auth: 3, blood: -3 }, bad: { auth: -2 } },
    znan: { ok: { blood: -3 }, bad: {} },
  };

  function styleBonus(S, s) {
    let b = Math.min(5, Math.floor((S.style[s] || 0) / 2));
    if (s === 'sila') b += Math.floor(S.st.blood / 30);
    if ((s === 'znan' || s === 'slovo') && S.st.blood >= 70) b -= 2;
    return b;
  }
  const chance = (b, dc) => Math.max(0, Math.min(1, (21 - dc + b) / 20));

  function mergeFx(a, b) {
    const out = {};
    for (const src of [a || {}, b || {}]) for (const k of Object.keys(src)) {
      if (k === 'rel') { out.rel = out.rel || {}; for (const r of Object.keys(src.rel)) out.rel[r] = (out.rel[r] || 0) + src.rel[r]; }
      else if (k === 'flags') out.flags = (out.flags || []).concat(src.flags);
      else if (typeof src[k] === 'number') out[k] = (out[k] || 0) + src[k];
      else out[k] = src[k];
    }
    return out;
  }

  function applyFx(S, fx) {
    const chips = [];
    const stat = (k, n, inv) => {
      if (!fx[k]) return;
      const before = S.st[k];
      S.st[k] = R.clamp(S.st[k] + fx[k], k === 'auth' ? -100 : 0, 100);
      const d = S.st[k] - before;
      if (d) chips.push({ t: `${n} ${d > 0 ? '+' : '−'}${Math.abs(d)}`, good: inv ? d < 0 : d > 0 });
    };
    stat('hp', 'Здоровье'); stat('auth', 'Авторитет'); stat('blood', 'Зов крови', true);
    if (fx.rel) for (const r of Object.keys(fx.rel)) {
      const d = fx.rel[r];
      if (!d) continue;
      S.rel[r] = R.clamp((S.rel[r] || 0) + d, -100, 100);
      S.met[r] = 1;
      chips.push({ t: `${K.REL_NAME[r]} ${d > 0 ? '+' : '−'}${Math.abs(d)}`, good: d > 0 });
    }
    if (fx.flag) S.flags[fx.flag] = 1;
    if (fx.flags) fx.flags.forEach((f) => { S.flags[f] = 1; });
    if (fx.mem) { S.mem.push({ turn: S.turn, t: fx.mem }); chips.push({ t: 'Запомнено', good: true, mem: true }); }
    return chips;
  }

  function reaction(npcId, s, ok, rng) {
    const n = K.NPC[npcId];
    if (!n) return null;
    const like = n.likes[s] || 0;
    const list = like > 0 ? n.like : like < 0 ? n.dislike : n.neutral;
    return { npc: npcId, line: rng.pick(list), d: like * 3 + (ok ? 1 : -1) };
  }

  function thought(S, s, ok, rng) {
    if (S.st.blood >= 60 && rng.chance(0.5)) return rng.pick(K.BLOOD_MONO);
    if (!rng.chance(0.55)) return null;
    return rng.pick(K.MONO[s][ok ? 'ok' : 'bad']);
  }

  // Вводная фраза к свободному ходу: стиль и цель своими словами, без повтора фразы игрока.
  function lead(s, npcId) {
    const n = npcId && K.NPC[npcId];
    if (s === 'sila') return n ? `Вы идёте на ${n.acc} напролом.` : 'Вы решаете действовать силой.';
    if (s === 'hitr') return n ? `Вы решаете перехитрить ${n.acc}.` : 'Вы решаете действовать хитростью.';
    if (s === 'slovo') return n ? `Вы обращаетесь к ${n.dat}.` : 'Вы решаете договориться словами.';
    return n ? `Вы решаете удивить ${n.acc} тем, чего здесь никто не знает.` : 'Вы решаете подойти к делу с умом.';
  }

  // Общий разрешатель: и для готовых вариантов, и для свободного хода.
  function resolve(S, card, def, rng, opt) {
    opt = opt || {};
    const t0 = performance.now();
    if (def.plain) return { plain: true, then: def.then, ms: performance.now() - t0, text: '', chips: [] };
    if (def.end) return { end: def.end, ms: performance.now() - t0, text: '', chips: [] };
    const s = def.s;
    const dc = typeof def.dc === 'function' ? def.dc(S) : def.dc === undefined ? 12 : def.dc;
    const b = styleBonus(S, s);
    let ok = true, roll = null;
    if (!def.auto) { const d = rng.int(1, 20); ok = d + b >= dc; roll = { d, b, dc, ok, s }; }
    const res = (ok ? def.ok : def.bad) || {};
    const fx = mergeFx(STYLE_FX[s][ok ? 'ok' : 'bad'], res.fx);
    const npcId = opt.npc || def.npc || card.npc;
    const react = npcId ? reaction(npcId, s, ok, rng) : null;
    if (react) fx.rel = Object.assign({}, fx.rel, { [npcId]: ((fx.rel || {})[npcId] || 0) + react.d });
    const chips = applyFx(S, fx);
    S.style[s] = (S.style[s] || 0) + 1;
    let adv = 0;
    if (!card.climax && !card.prologue) {
      const base = def.adv || card.adv || 18;
      adv = ok ? base : Math.round(base * 0.5);
      if (opt.free) adv = ok ? 14 : 7;
      S.progress = Math.min(100, S.progress + adv);
    }
    let text = res.r || '';
    if (opt.free) text = lead(s, npcId) + ' ' + rng.pick(K.FREE[s][ok ? 'ok' : 'bad']);
    return {
      roll, ok, s, text, chips, adv, then: res.then || def.then, end: res.end || def.end,
      react: react ? { name: K.NPC[npcId].nom, line: react.line } : null,
      thought: thought(S, s, ok, rng),
      ms: performance.now() - t0,
    };
  }

  function resolveFree(S, card, input, rng) {
    const t0 = performance.now();
    const c = classify(input, S);
    if (!c.style) return { notUnderstood: true, ms: performance.now() - t0, c };
    if (c.style === 'wait') {
      const chips = applyFx(S, { hp: 6, blood: -2 });
      S.progress = Math.min(100, S.progress + 5);
      return { wait: true, text: rng.pick(K.FREE.wait), chips, adv: 5, c, ms: performance.now() - t0 };
    }
    const def = { s: c.style, dc: (card.dc || 12) + 1 };
    const r = resolve(S, card, def, rng, { free: true, input, npc: c.npc && (S.met[c.npc] || card.npc === c.npc) ? c.npc : null });
    r.c = c;
    r.ms = performance.now() - t0;
    return r;
  }

  /* ---------- 3. Режиссёр: следующая сцена ---------- */
  function pick(S, rng) {
    const t0 = performance.now();
    const chap = K.CHAPTERS[S.chapter];
    const why = [];
    if (S.progress >= 100) return { climax: true, ms: performance.now() - t0, why: ['Цель главы достигнута: время кульминации.'] };
    if (S.chTurns >= chap.max) return { climax: true, ms: performance.now() - t0, why: ['Глава затянулась. Сказитель ведёт историю к кульминации.'] };
    const n = chap.n;
    const pool = K.SCENES.filter((t) => t.chap.indexOf(n) >= 0 && (!t.cond || t.cond(S)) && !(t.once && S.used[t.id]) && S.recent.indexOf(t.id) < 0);
    if (!pool.length) return { climax: true, ms: performance.now() - t0, why: ['Все сцены главы сыграны: время кульминации.'] };
    const expected = 100 / Math.max(3, chap.max - 2);
    const behind = S.chTurns >= 2 && S.progress < S.chTurns * expected * 0.8;
    const dom = dominant(S), weak = weakest(S);
    const challenge = !!dom && S.turn % 4 === 3;
    const visibleOpts = (t) => t.opts.filter((o) => !o.show || o.show(S));
    const weight = (t) => {
      let w = 1;
      if (behind) w *= 1 + (t.adv || 18) / 18 + (t.pressure ? 1 : 0);
      else if (t.pressure && S.chTurns < 2) w *= 0.4;
      if (dom && visibleOpts(t).some((o) => o.s === dom)) w *= 1.3;
      if (challenge && visibleOpts(t).some((o) => o.s === weak)) w *= 1.7;
      if (t.npc && S.lastNpc.indexOf(t.npc) >= 0) w *= 0.45;
      if (t.npc && Math.abs(S.rel[t.npc] || 0) >= 30) w *= 1.25;
      if (t.cond) w *= 1.6;
      if (t.kind === 'threat') w *= 0.4 + S.tension * 0.2;
      if (t.kind === 'calm') w *= Math.max(0.2, 1.4 - S.tension * 0.15);
      w *= t.chap.length >= 5 ? 0.55 : t.chap.length === 1 ? 1.3 : 1;
      return w;
    };
    const scored = pool.map((t) => ({ t, w: weight(t) }));
    const tot = scored.reduce((a, x) => a + x.w, 0) || 1;
    scored.sort((a, b) => b.w - a.w);
    const choice = rng.weighted(scored, (x) => x.w).t;
    if (behind) why.push(`История отстаёт от цели (${S.progress}% за ${S.chTurns} ${R.plural(S.chTurns, ['ход', 'хода', 'ходов'])}): выбрана сцена, которая двигает сюжет.`);
    else why.push(`Сюжет идёт по плану: ${S.progress}% цели главы.`);
    if (choice.cond) why.push('Сцена выросла из ваших прошлых решений.');
    if (dom && visibleOpts(choice).some((o) => o.s === dom)) why.push(`Ваш стиль — ${K.STYLE[dom].n}: в сцене есть где его применить.`);
    if (challenge && visibleOpts(choice).some((o) => o.s === weak)) why.push(`Проверка слабой стороны: ${K.STYLE[weak].n}.`);
    if (choice.kind === 'threat' && S.tension >= 4) why.push(`Напряжение ${S.tension}/10: давно было тихо.`);
    if (choice.kind === 'calm') why.push('Передышка после тяжёлых сцен.');
    return {
      t: choice, why, cands: pool.length,
      top: scored.slice(0, 3).map((x) => ({ title: x.t.title, p: Math.round((x.w / tot) * 100) })),
      ms: performance.now() - t0,
    };
  }

  function sceneText(S, t, rng) {
    const raw = rng.pick(t.tx);
    let text = typeof raw === 'function' ? raw(S) : raw;
    text = R.expand(text, {}, rng);
    if (rng.chance(0.35)) text = rng.pick(K.OPENERS) + ' ' + text;
    if (t.npc && K.NPC[t.npc]) {
      const v = S.rel[t.npc] || 0, nm = K.NPC[t.npc].nom;
      if (v >= 35) text += `\n\n${nm} относится к вам как к своему. Это чувствуется.`;
      else if (v <= -40 && t.npc !== 'brak') text += `\n\n${nm} смотрит на вас холодно: прошлое не забыто.`;
    }
    return text;
  }

  function afterTurn(S, kind) {
    S.tension = kind === 'threat' ? Math.max(0, S.tension - 5) : Math.min(10, S.tension + 1);
  }

  R.Skaz = { classify, resolve, resolveFree, pick, sceneText, afterTurn, styleBonus, chance, dominant, STY, LEX };
})();
