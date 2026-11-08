/* Клык — движок: состояние, летопись-лента, выборы, свободный ход, сохранения. */
(function () {
  'use strict';
  const R = window.R, K = R.KLYK, AI = R.Skaz, ART = R.ORC_ART;
  const KEY = 'klyk.save.v1', ENDS = 'klyk.endings.v1';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } },
  };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  const SCENE = {};
  K.SCENES.forEach((t) => { SCENE[t.id] = t; });
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  let S = null, rng = null, endsGot = store.get(ENDS) || {}, sheetMode = null;

  function newState() {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    return {
      v: 1, seed, rngState: seed,
      st: { hp: 60, auth: -20, blood: 20 },
      style: { sila: 0, hitr: 0, slovo: 0, znan: 0 },
      rel: { nisa: 0, yrga: -10, gharr: -20, brak: -60, shnyr: 0, agnia: 0, savva: 0, khan: 0, humans: -30 },
      met: { nisa: 1, yrga: 1, gharr: 1, brak: 1 },
      flags: {}, used: {}, recent: [], lastNpc: [], tension: 2, mem: [],
      chapter: -1, chTurns: 0, progress: 0, turn: 0,
      log: [], card: null, ended: null, stats: { answers: 0, ms: 0, free: 0 },
    };
  }
  function save() { if (!S) return; S.rngState = rng.state(); store.set(KEY, S); }

  /* ---------- карточки ---------- */
  function cardDef(card) { return card.type === 'beat' ? K.CARDS[card.id] : SCENE[card.id]; }

  function pushBeat(id, why) {
    const d = K.CARDS[id];
    const text = typeof d.tx === 'function' ? d.tx(S) : d.tx;
    S.log.push({ k: 'scene', label: d.label, title: d.title, art: d.art, text, why: why || null });
    S.card = { type: 'beat', id, climax: !!d.climax, finale: !!d.finale, prologue: id[0] === 'p', npc: d.npc || null, kind: 'beat' };
    if (d.npc) S.met[d.npc] = 1;
  }

  function pushChapter() {
    const ch = K.CHAPTERS[S.chapter];
    S.progress = 0;
    S.chTurns = 0;
    S.log.push({ k: 'chapter', n: ch.n, name: ch.name, goal: ch.goal, art: ch.art, text: typeof ch.open === 'function' ? ch.open(S) : ch.open });
  }

  function advance() {
    const p = AI.pick(S, rng);
    if (p.climax) { pushBeat(K.CHAPTERS[S.chapter].climax, { why: p.why, ms: p.ms }); return p.ms; }
    const t = p.t;
    S.used[t.id] = 1;
    S.recent = [t.id].concat(S.recent).slice(0, 6);
    if (t.npc) { S.lastNpc = [t.npc].concat(S.lastNpc).slice(0, 2); S.met[t.npc] = 1; }
    S.log.push({ k: 'scene', label: `Глава ${ROMAN[S.chapter]} · сцена ${S.chTurns + 1}`, title: t.title, text: AI.sceneText(S, t, rng), why: { why: p.why, top: p.top, cands: p.cands, ms: p.ms } });
    S.card = { type: 'scene', id: t.id, npc: t.npc || null, adv: t.adv, kind: t.kind };
    return p.ms;
  }

  function failEnding() {
    if (S.st.hp <= 0) return 'death';
    if (S.st.blood >= 100) return 'beast';
    if (S.st.auth <= -60 && S.chapter >= 1) return 'exile';
    return null;
  }

  function finish(id) {
    S.ended = id;
    S.card = null;
    if (!endsGot[id]) { endsGot[id] = 1; store.set(ENDS, endsGot); }
    const e = K.ENDINGS[id];
    S.log.push({ k: 'end', id, title: e.title, art: e.art, bad: !!e.bad, text: e.text(S) });
  }

  // После любого хода: куда двигать историю дальше.
  function moveOn(r, t0) {
    const card = S.card;
    let pickMs = 0;
    const end = r.end || failEnding();
    if (end) { finish(end); return; }
    if (r.then) { pushBeat(r.then); return; }
    if (card.prologue) { S.chapter = 0; pushChapter(); pickMs = advance(); }
    else if (card.climax) { S.chapter += 1; S.st.hp = Math.min(100, S.st.hp + 10); pushChapter(); pickMs = advance(); }
    else { S.turn += 1; S.chTurns += 1; AI.afterTurn(S, card.kind); pickMs = advance(); }
    const resp = S.log.slice().reverse().find((e) => e.k === 'resp');
    if (resp && resp.ai) resp.ai.total = performance.now() - t0;
    return pickMs;
  }

  function respEntry(r, extra) {
    return Object.assign({ k: 'resp', roll: r.roll, text: r.text, react: r.react, thought: r.thought, chips: r.chips || [], adv: r.adv || 0, ai: { ms: r.ms } }, extra || {});
  }

  function choose(i) {
    if (!S || !S.card || S.ended) return;
    const def = cardDef(S.card), o = def.opts[i];
    if (!o || (o.show && !o.show(S))) return;
    const t0 = performance.now();
    const from = S.log.length;
    const r = AI.resolve(S, S.card, o, rng);
    S.log.push({ k: 'pick', t: o.t, s: o.s || null });
    if (!r.plain && !r.end) {
      const extra = {};
      if (S.card.climax && def.after) extra.after = def.after;
      S.log.push(respEntry(r, extra));
      S.stats.answers++; S.stats.ms += r.ms;
    }
    moveOn(r, t0);
    save();
    render(from);
  }

  function freeMove(input) {
    const box = $('#free-hint');
    input = String(input || '').trim();
    if (!input || !S || !S.card || S.ended) return;
    const t0 = performance.now();
    const r = AI.resolveFree(S, S.card, input, rng);
    if (r.notUnderstood) {
      box.innerHTML = `Сказитель не понял, что вы хотите сделать. Начните с глагола: «ударить Брака», «уговорить Нису», «обмануть стражу», «развести огонь», «подождать». <span class="ms">${fmtMs(r.ms)}</span>`;
      box.hidden = false;
      return;
    }
    const from = S.log.length;
    const style = r.c.style === 'wait' ? null : r.c.style;
    S.log.push({ k: 'pick', t: input, s: style, free: true });
    const understood = { style: r.c.style, npc: r.c.npc ? K.REL_NAME[r.c.npc] : null, hits: r.c.hits.slice(0, 4) };
    const e = respEntry(r, { understood });
    if (S.card.climax && cardDef(S.card).after) e.after = cardDef(S.card).after;
    S.log.push(e);
    S.stats.answers++; S.stats.free++; S.stats.ms += r.ms;
    moveOn(r, t0);
    save();
    render(from);
  }

  /* ---------- отрисовка ---------- */
  function fmtMs(ms) { return ms < 0.1 ? 'меньше 0,1 мс' : ms.toFixed(2).replace('.', ',') + ' мс'; }
  const paras = (t) => String(t).split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('');
  const styleTag = (s) => (s ? `<span class="st st-${s}">${K.STYLE[s].n}</span>` : '');

  function entryHtml(e) {
    if (e.k === 'chapter') {
      return `<section class="e chap"><div class="band">${ART.render(e.art)}</div><div class="chap-n">Глава ${ROMAN[e.n - 1]}</div><h2 class="chap-t">${esc(e.name)}</h2><p class="goal"><span>Цель главы</span> ${esc(e.goal)}</p><div class="prose">${paras(e.text)}</div></section>`;
    }
    if (e.k === 'scene') {
      let why = '';
      if (e.why) {
        const w = e.why;
        why = `<details class="why"><summary>Почему эта сцена</summary><ul>${w.why.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${w.top ? `<p>Рассматривал ${w.cands} ${R.plural(w.cands, ['сцену', 'сцены', 'сцен'])}: ${w.top.map((t) => `${esc(t.title)} ${t.p}%`).join(' · ')}</p>` : ''}<p>Выбор занял ${fmtMs(w.ms)}.</p></details>`;
      }
      return `<article class="e scene">${e.art ? `<div class="band">${ART.render(e.art)}</div>` : ''}<div class="lbl">${esc(e.label)}</div><h3 class="scene-t">${esc(e.title)}</h3><div class="prose">${paras(e.text)}</div>${why}</article>`;
    }
    if (e.k === 'pick') return `<p class="e pick">${styleTag(e.s)}<span class="you">${e.free ? 'Свой ход:' : 'Вы:'}</span> ${esc(e.t)}</p>`;
    if (e.k === 'resp') {
      let h = '<div class="e resp">';
      if (e.roll) h += `<p class="roll ${e.roll.ok ? 'ok' : 'bad'}">к20: ${e.roll.d} ${e.roll.b >= 0 ? '+' : '−'} ${Math.abs(e.roll.b)} (${K.STYLE[e.roll.s].n}) = ${e.roll.d + e.roll.b} против ${e.roll.dc} · ${e.roll.ok ? 'удача' : 'неудача'}</p>`;
      if (e.text) h += `<div class="prose">${paras(e.text)}</div>`;
      if (e.react) h += `<p class="react">${esc(e.react.line)}</p>`;
      if (e.thought) h += `<p class="thought">${esc(e.thought)}</p>`;
      if (e.after) h += `<div class="prose after">${paras(e.after)}</div>`;
      if (e.chips && e.chips.length) h += `<div class="chips">${e.chips.map((c) => `<span class="chip ${c.good ? 'g' : 'b'}">${esc(c.t)}</span>`).join('')}</div>`;
      const u = e.understood;
      const und = u ? (u.style === 'wait' ? 'понял: выжидание' : `понял: ${K.STYLE[u.style].n}${u.npc ? ' → ' + esc(u.npc) : ''}${u.hits.length ? ` (по словам: ${esc(u.hits.join(', '))})` : ''}`) : '';
      h += `<p class="ai">Сказитель · ответ за ${fmtMs(e.ai.ms)}${e.ai.total ? `, со следующей сценой ${fmtMs(e.ai.total)}` : ''}${und ? ' · ' + und : ''}${e.adv ? ` · сюжет +${e.adv}%` : ''}</p>`;
      return h + '</div>';
    }
    if (e.k === 'end') {
      return `<section class="e ending ${e.bad ? 'bad' : ''}"><div class="band">${ART.render(e.art)}</div><div class="chap-n">${e.bad ? 'Конец книги · поражение' : 'Конец книги первой'}</div><h2 class="chap-t">${esc(e.title)}</h2><div class="prose">${paras(e.text)}</div></section>`;
    }
    return '';
  }

  function render(from) {
    renderTop();
    const story = $('#story');
    if (!S) { story.innerHTML = ''; renderTitle(); renderRail(); return; }
    if (from === undefined || from === 0 || story.dataset.len === undefined) {
      story.innerHTML = S.log.map(entryHtml).join('');
    } else {
      const frag = S.log.slice(from).map(entryHtml).join('');
      story.insertAdjacentHTML('beforeend', frag);
      const nodes = story.querySelectorAll('.e');
      const first = nodes[from];
      if (first) {
        for (let i = from; i < nodes.length; i++) nodes[i].classList.add('fresh');
        first.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      }
    }
    story.dataset.len = S.log.length;
    renderTurn();
    renderRail();
  }

  function renderTop() {
    const w = $('#where');
    if (!S || S.chapter < 0) { w.textContent = S ? 'Пролог' : 'Книга первая · Степь'; }
    else if (S.ended) w.textContent = 'Конец книги';
    else { const ch = K.CHAPTERS[S.chapter]; w.textContent = `Глава ${ROMAN[S.chapter]}: ${ch.name}`; }
    const mini = $('#mini');
    if (!S || S.ended) { mini.hidden = true; return; }
    mini.hidden = false;
    const goal = S.chapter >= 0 ? ` · цель ${S.progress}%` : '';
    mini.innerHTML = `<span>Здоровье <b>${S.st.hp}</b></span><span>Авторитет <b>${S.st.auth}</b></span><span class="${S.st.blood >= 70 ? 'warn' : ''}">Зов крови <b>${S.st.blood}</b></span><span>${S.chapter >= 0 ? 'Глава ' + ROMAN[S.chapter] : 'Пролог'}${goal}</span>`;
  }

  function renderTurn() {
    const turn = $('#turn');
    if (!S) { turn.innerHTML = ''; return; }
    if (S.ended) {
      turn.innerHTML = `<div class="turn-end"><p>Открыто концовок: ${Object.keys(endsGot).length} из ${Object.keys(K.ENDINGS).length}. Сказитель ответил ${S.stats.answers} ${R.plural(S.stats.answers, ['раз', 'раза', 'раз'])}, в среднем за ${fmtMs(S.stats.ms / Math.max(1, S.stats.answers))}.</p><div class="actions"><button class="btn primary" type="button" id="btn-again">Начать книгу заново</button><button class="btn" type="button" id="btn-ends">Все концовки</button></div></div>`;
      $('#btn-again').addEventListener('click', startNew);
      $('#btn-ends').addEventListener('click', () => openSheet('about'));
      return;
    }
    const def = cardDef(S.card);
    const opts = def.opts.map((o, i) => ({ o, i })).filter((x) => !x.o.show || x.o.show(S));
    const dom = AI.dominant(S);
    let h = `<div class="turn-h">Что вы делаете?</div><div class="opts">`;
    h += opts.map((x, n) => {
      const o = x.o;
      let meta = '';
      if (o.s && !o.auto) {
        const dc = typeof o.dc === 'function' ? o.dc(S) : o.dc === undefined ? 12 : o.dc;
        const b = AI.styleBonus(S, o.s);
        meta = `шанс ${Math.round(AI.chance(b, dc) * 100)}%`;
      } else if (o.auto) meta = 'наверняка';
      else if (o.end) meta = 'концовка';
      return `<button class="opt${o.s && o.s === dom ? ' mine' : ''}" type="button" data-i="${x.i}"><span class="num">${n + 1}</span><span class="ob"><span class="ot">${esc(o.t)}</span><span class="om">${styleTag(o.s)}${meta ? `<span>${meta}</span>` : ''}</span></span></button>`;
    }).join('');
    h += '</div>';
    const canFree = !S.card.finale && !def.opts.every((o) => o.plain);
    if (canFree) {
      h += `<form class="free" id="free-form" autocomplete="off"><label for="free-in">Или опишите свой поступок словами</label><div class="free-row"><input id="free-in" name="free" type="text" maxlength="160" placeholder="Например: обмануть Брака и увести коня"><button class="btn primary" type="submit">Сделать</button></div><p class="free-hint" id="free-hint" hidden></p></form>`;
    }
    turn.innerHTML = h;
    turn.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.i))));
    const form = $('#free-form');
    if (form) form.addEventListener('submit', (ev) => { ev.preventDefault(); freeMove($('#free-in').value); });
  }

  function bar(v, min, max, cls) {
    const p = Math.round(((v - min) / (max - min)) * 100);
    return `<span class="bar ${cls || ''}"><span style="width:${R.clamp(p, 0, 100)}%"></span></span>`;
  }

  function railHtml() {
    if (!S) return `<div class="rail-sec"><h4>Как играть</h4><p class="rail-p">Читайте и выбирайте. Или пишите свой поступок словами: Сказитель поймёт, что вы задумали, и ответит мгновенно.</p><p class="rail-p">У каждой главы есть цель. Как к ней прийти, решаете вы: силой, хитростью, словом или знаниями из нашего мира.</p></div>`;
    let h = '';
    if (S.chapter >= 0 && !S.ended) {
      const ch = K.CHAPTERS[S.chapter];
      h += `<div class="rail-sec"><h4>Глава ${ROMAN[S.chapter]} · ${esc(ch.name)}</h4><p class="rail-goal">${esc(ch.goal)}</p>${bar(S.progress, 0, 100, 'goal')}<p class="rail-p small">${S.progress >= 100 ? 'Кульминация близко.' : `Сюжет продвинулся на ${S.progress}%.`}</p></div>`;
    }
    h += `<div class="rail-sec"><h4>Тарг</h4>
      <div class="kv"><span>Здоровье</span><b>${S.st.hp}</b></div>${bar(S.st.hp, 0, 100, 'hp')}
      <div class="kv"><span>Авторитет в клане</span><b>${S.st.auth}</b></div>${bar(S.st.auth, -100, 100, 'auth')}
      <div class="kv ${S.st.blood >= 70 ? 'warn' : ''}"><span>Зов крови</span><b>${S.st.blood}</b></div>${bar(S.st.blood, 0, 100, 'blood')}
      <p class="rail-p small">Сила будит зверя, слово и знание его усмиряют. На 100 Глеб исчезнет.</p></div>`;
    const dom = AI.dominant(S);
    h += `<div class="rail-sec"><h4>Стиль${dom ? ': ' + K.STYLE[dom].n : ''}</h4><div class="styles">${AI.STY.map((s) => `<div class="sty${s === dom ? ' on' : ''}"><span class="st st-${s}">${K.STYLE[s].n}</span><b>${S.style[s]}</b><span class="small">+${AI.styleBonus(S, s)} к броску</span></div>`).join('')}</div></div>`;
    const rels = K.REL_SHOW.filter((k) => S.met[k] || k === 'humans' && S.chapter >= 1);
    h += `<div class="rail-sec"><h4>Отношения</h4>${rels.map((k) => `<div class="kv rel"><span>${K.REL_NAME[k]}</span><b class="${S.rel[k] >= 20 ? 'g' : S.rel[k] <= -20 ? 'b' : ''}">${S.rel[k] > 0 ? '+' : ''}${S.rel[k]}</b></div>`).join('')}</div>`;
    if (S.mem.length) h += `<div class="rail-sec"><h4>Память Сказителя</h4><ul class="mem">${S.mem.slice(-4).reverse().map((m) => `<li>${esc(m.t)}</li>`).join('')}</ul></div>`;
    return h;
  }

  function renderRail() { $('#rail').innerHTML = railHtml(); }

  function renderTitle() {
    const saved = store.get(KEY);
    const cont = saved && saved.card && !saved.ended;
    $('#story').innerHTML = `<section class="cover"><div class="band">${ART.render('o_steppe')}</div><div class="chap-n">Книга первая</div><h1 class="cover-t">Клык</h1><p class="cover-s">Степь</p>
      <div class="prose"><p>Охранник торгового центра из Подольска, бывший учитель истории, просыпается на дне степного оврага в теле молодого орка-изгоя. У него сломаны рёбра, есть враг, который хочет его смерти, и шаманка, которая чует в нём чужой дух.</p><p>Пять глав, у каждой своя цель. Как к ней прийти, решаете вы: силой, хитростью, словом или знаниями из нашего мира. А Сказитель, небольшой ИИ-рассказчик, мгновенно отвечает на каждый ваш шаг и ведёт историю дальше.</p></div>
      <div class="actions cover-act">${cont ? `<button class="btn primary" type="button" id="btn-cont">Продолжить: ${saved.chapter >= 0 ? 'глава ' + ROMAN[saved.chapter] : 'пролог'}</button>` : ''}<button class="btn ${cont ? '' : 'primary'}" type="button" id="btn-new">${cont ? 'Начать заново' : 'Начать книгу'}</button></div>
      <dl class="facts"><div><dt>5</dt><dd>глав с кульминациями</dd></div><div><dt>${K.SCENES.length}</dt><dd>сцен у Сказителя</dd></div><div><dt>${Object.keys(K.ENDINGS).length}</dt><dd>концовок</dd></div><div><dt>&lt;1 мс</dt><dd>на ответ</dd></div></dl></section>`;
    $('#turn').innerHTML = '';
    if (cont) $('#btn-cont').addEventListener('click', () => load(saved));
    const nb = $('#btn-new');
    nb.addEventListener('click', () => {
      if (cont && !nb.dataset.armed) { nb.dataset.armed = '1'; nb.textContent = 'Точно? Сохранение пропадёт'; return; }
      startNew();
    });
  }

  /* ---------- панели ---------- */
  function openSheet(mode) {
    sheetMode = mode;
    const body = $('#sheet-body');
    if (mode === 'rail') {
      $('#sheet-title').textContent = 'Герой';
      body.innerHTML = railHtml() + (S && S.mem.length ? `<div class="rail-sec"><h4>Вся память</h4><ul class="mem">${S.mem.slice().reverse().map((m) => `<li>${esc(m.t)}</li>`).join('')}</ul></div>` : '');
    } else {
      $('#sheet-title').textContent = 'О Сказителе';
      const avg = S && S.stats.answers ? fmtMs(S.stats.ms / S.stats.answers) : '—';
      body.innerHTML = `<div class="about">
        <p><b>Сказитель</b> — небольшой ИИ-рассказчик этой книги. Это не нейросеть, а набор правил, весов и памяти. Он работает прямо в браузере, без интернета, и отвечает за доли миллисекунды.</p>
        <h3>Что он делает</h3>
        <ul>
          <li><b>Понимает ваш ход.</b> Если вы пишете поступок словами, он разбирает фразу: какой это стиль (сила, хитрость, слово, знание) и кого это касается.</li>
          <li><b>Отвечает.</b> Бросок к20 с бонусом вашего стиля, исход, реакция героя по его характеру, мысли Глеба, изменение отношений. Ниса уважает хитрость, Гхарр — силу, Ырга — знания, Агния — слово.</li>
          <li><b>Ведёт сюжет.</b> У каждой главы есть цель. Сказитель следит, насколько история продвинулась, и подбирает сцены так, чтобы она шла к кульминации. Если вы буксуете, он подкидывает сцены-толчки.</li>
          <li><b>Запоминает.</b> Ваши решения открывают новые сцены и варианты позже: шкура вожака стаи, дружба с купцом, тайна хана.</li>
        </ul>
        <p>${S ? `В этой игре Сказитель ответил ${S.stats.answers} ${R.plural(S.stats.answers, ['раз', 'раза', 'раз'])} (свободных ходов: ${S.stats.free}), в среднем за ${avg}.` : ''}</p>
        <div class="bench"><button class="btn" type="button" id="btn-bench">Проверить скорость: 1000 ходов</button><div id="bench-out"></div></div>
        <h3>Концовки</h3><ul class="ends">${Object.keys(K.ENDINGS).map((k) => `<li class="${endsGot[k] ? 'got' : ''}">${endsGot[k] ? esc(K.ENDINGS[k].title) : 'не открыта'}</li>`).join('')}</ul>
        <h3>Управление</h3><p>Клавиши 1–7 выбирают вариант. Игра сохраняется сама после каждого хода.</p>
        <div class="actions"><button class="btn" type="button" id="btn-reset">Начать книгу заново</button></div></div>`;
      $('#btn-bench').addEventListener('click', bench);
      const rs = $('#btn-reset');
      rs.addEventListener('click', () => {
        if (S && !rs.dataset.armed) { rs.dataset.armed = '1'; rs.textContent = 'Точно? Текущая игра пропадёт'; return; }
        closeSheet(); startNew();
      });
    }
    $('#sheet').hidden = false;
    document.body.classList.add('locked');
    $('#sheet-close').focus({ preventScroll: true });
  }
  function closeSheet() { $('#sheet').hidden = true; document.body.classList.remove('locked'); sheetMode = null; }

  // Тысяча ходов на копии мира: разбор фразы, ответ и выбор следующей сцены.
  function bench() {
    const phrases = ['ударить Брака топором', 'тихо украсть коня', 'уговорить Нису помочь', 'развести огонь и осмотреть рану', 'подождать до утра', 'обмануть стражу и проскользнуть', 'рассказать Ырге правду', 'построить ловушку на тропе'];
    const base = S ? JSON.parse(JSON.stringify(Object.assign({}, S, { log: [] }))) : newState();
    if (base.chapter < 0) { base.chapter = 1; base.card = { type: 'scene', id: 'koster', kind: 'calm' }; }
    if (!base.card || base.ended) base.card = { type: 'scene', id: 'koster', kind: 'calm' };
    const r2 = R.makeRng((Date.now() >>> 0) ^ 0x51ed);
    const t0 = performance.now();
    let understood = 0, picks = 0;
    for (let i = 0; i < 1000; i++) {
      const st = JSON.parse(JSON.stringify(base));
      st.chapter = i % 5; st.progress = i % 90; st.chTurns = i % 5; st.recent = [];
      const r = AI.resolveFree(st, st.card, phrases[i % phrases.length], r2);
      if (!r.notUnderstood) understood++;
      const p = AI.pick(st, r2);
      if (p.t || p.climax) picks++;
    }
    const ms = performance.now() - t0;
    $('#bench-out').innerHTML = `<p><b>1000 ходов за ${fmtMs(ms)}</b>, около ${fmtMs(ms / 1000)} на ход, включая копирование мира. Понято фраз: ${understood} из 1000. Выбрано сцен: ${picks}.</p>`;
  }

  /* ---------- запуск ---------- */
  function startNew() {
    S = newState();
    rng = R.makeRng(S.seed);
    pushBeat('p1');
    save();
    $('#story').dataset.len = '0';
    render(0);
    window.scrollTo({ top: 0 });
  }
  function load(data) {
    S = data;
    rng = R.makeRng(0);
    rng.setState(S.rngState);
    render(0);
    const last = $('#story').lastElementChild;
    if (last) last.scrollIntoView({ block: 'start' });
  }

  function bind() {
    $('#btn-home').addEventListener('click', () => { if (S) save(); S = null; delete $('#story').dataset.len; render(); window.scrollTo({ top: 0 }); });
    $('#btn-rail').addEventListener('click', () => openSheet('rail'));
    $('#btn-about').addEventListener('click', () => openSheet('about'));
    $('#sheet-close').addEventListener('click', closeSheet);
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sheetMode) { closeSheet(); return; }
      if (sheetMode || !S || S.ended || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (/^[1-7]$/.test(e.key)) {
        const b = document.querySelectorAll('.opt')[Number(e.key) - 1];
        if (b) { e.preventDefault(); b.click(); }
      }
    });
  }

  function start(data) {
    bind();
    if (data && data.S) { load(data.S); return; }
    render();
  }
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ S: S ? Object.assign({}, S, { rngState: rng.state() }) : null })); } catch (e) { /* среда без горячей перезагрузки */ }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
