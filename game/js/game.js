/* Пришлый — движок: состояние, недели, проверки, интерфейс, сохранения. */
(function () {
  'use strict';
  const R = window.R, B = R.BOOK, D = R.Director, ART = R.ART;
  const KEY = 'prishly.save.v1', SEEN = 'prishly.seen.v1', ENDS = 'prishly.endings.v1';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* хранилище недоступно */ } },
  };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const GEN = { hp: 'здоровья', gold: 'золота', food: 'еды', people: 'людей', rep: 'славы', sus: 'подозрения', know: 'знаний', guard: 'дружины' };
  const REL = { marta: 'Марта', gunnar: 'Гуннар', ilva: 'Ильва', benedikt: 'Бенедикт', korvin: 'Корвин' };
  const NEED = { gold: ['золотой', 'золотых', 'золотых'], food: ['мера еды', 'меры еды', 'мер еды'], know: ['знание', 'знания', 'знаний'], people: ['человек', 'человека', 'человек'], guard: ['копьё', 'копья', 'копий'] };

  let S = null, rng = null, seen = store.get(SEEN) || {}, endsGot = store.get(ENDS) || {};
  let prevStats = null, sheetMode = null;

  /* ---------- помощники для книги и Летописца ---------- */
  const h = {
    season: () => Math.floor((S.week - 1) / 10) % 4,
    actFull: () => { let a = 1; for (const x of B.ACTS) if (S.week >= x.from) a = x.n; return a; },
    act: () => Math.min(4, h.actFull()),
    invCount: () => Object.keys(S.inv).length,
    power,
    nextBeat() {
      for (const e of B.SCHEDULE) if (e.week && !S.beatsDone[e.id] && e.week > S.week) return { title: B.CARDS[e.id].title, weeks: e.week - S.week };
      return null;
    },
  };

  function power() {
    let p = S.st.guard + Math.floor(S.st.people / 8);
    for (const inv of B.INV) if (S.inv[inv.id] && inv.power) p += inv.power;
    const F = S.flags;
    for (const [f, v] of [['fortified', 4], ['waldo_ally', 3], ['scouts', 2], ['drill', 2], ['intel', 2], ['bluff', 2], ['neighbor_ally', 2]]) if (F[f]) p += v;
    return p;
  }

  function bonus(stat) {
    if (stat === 'know') return { v: Math.min(8, Math.floor(S.st.know / 8)), n: 'Знания' };
    if (stat === 'rep') return { v: R.clamp(Math.floor(S.st.rep / 10), -5, 8), n: 'Слава' };
    if (stat === 'hp') return { v: Math.floor(S.st.hp / 20), n: 'Здоровье' };
    if (stat === 'power') return { v: power(), n: 'Оборона' };
    if (stat === 'magic') return { v: (S.flags.mage_path ? 4 : 0) + Math.floor((S.rel.ilva || 0) / 20) + (S.flags.ritual ? 2 : 0), n: 'Магия' };
    if (stat.indexOf('rel.') === 0) { const k = stat.slice(4); return { v: Math.floor((S.rel[k] || 0) / 15), n: REL[k] }; }
    return { v: 0, n: 'Удача' };
  }
  const chance = (b, dc) => Math.max(0, Math.min(1, (21 - dc + b) / 20));

  function newState() {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    return {
      v: 1, seed, rngState: seed, week: 1,
      st: { hp: 85, gold: 20, food: 36, people: 24, rep: 0, sus: 10, know: 6, guard: 3 },
      debt: 120, debtDue: 20, inv: {}, rel: { marta: 40, gunnar: 30, ilva: 0, benedikt: 25, korvin: 0 },
      flags: {}, queue: [], recent: [], used: {}, tension: 3, log: [], beatsDone: {},
      card: null, outcome: null, artRecent: [], seenArt: {}, lastWeek: null, stats: { events: 0, ms: 0 }, ended: null,
    };
  }

  function save() { if (!S) return; S.rngState = rng.state(); store.set(KEY, S); }

  /* ---------- значения, требования, эффекты ---------- */
  function val(v, vars) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return 0;
    const neg = v[0] === '-';
    const k = v.replace(/^[-+]/, '');
    const n = Number(vars && vars[k] !== undefined ? vars[k] : k) || 0;
    return neg ? -n : n;
  }

  function needFail(c, vars) {
    const n = c.need;
    if (!n) return null;
    for (const k of Object.keys(n)) {
      if (k === 'invAny') { if (h.invCount() < n[k]) return `Нужно изобретений: ${n[k]}`; continue; }
      if (k === 'goldDebt') { if (S.st.gold < S.debt) return `Нужно ${S.debt} золотых`; continue; }
      if (k === 'goldHalf') { const half = Math.ceil(S.debt / 2); if (S.st.gold < half) return `Нужно ${half} золотых`; continue; }
      const need = val(n[k], vars);
      if ((S.st[k] || 0) < need) return `Нужно ${need} ${R.plural(need, NEED[k] || ['', '', ''])}`.trim();
    }
    return null;
  }

  function clampStats() {
    const st = S.st;
    st.hp = R.clamp(st.hp, 0, 100); st.sus = R.clamp(st.sus, 0, 100); st.rep = R.clamp(st.rep, -100, 100);
    for (const k of ['gold', 'food', 'people', 'know', 'guard']) st[k] = Math.max(0, st[k]);
  }

  function applyFx(fx, vars) {
    const out = [];
    if (!fx) return out;
    for (const k of Object.keys(fx)) {
      const v = fx[k];
      if (GEN[k]) {
        const before = S.st[k];
        S.st[k] += val(v, vars);
        clampStats();
        const d = S.st[k] - before;
        if (d) out.push({ t: `${d > 0 ? '+' : '−'}${Math.abs(d)} ${GEN[k]}`, good: k === 'sus' ? d < 0 : d > 0 });
      } else if (k === 'debt') {
        S.debt += val(v, vars);
        out.push({ t: `Долг +${val(v, vars)}`, good: false });
      } else if (k === 'rel') {
        for (const r of Object.keys(v)) {
          const d = v[r];
          S.rel[r] = R.clamp((S.rel[r] || 0) + d, -100, 100);
          out.push({ t: `${REL[r]}: ${d > 0 ? '+' : '−'}${Math.abs(d)}`, good: d > 0 });
        }
      } else if (k === 'flag') S.flags[v] = 1;
      else if (k === 'follow') S.queue.push({ id: v.id, week: S.week + v.in, vars: Object.assign({}, vars) });
      else if (k === 'payDebt') { S.st.gold -= S.debt; out.push({ t: `−${S.debt} золота`, good: false }, { t: 'Долг закрыт', good: true }); S.debt = 0; }
      else if (k === 'clearDebt') { S.debt = 0; out.push({ t: 'Долг закрыт', good: true }); }
      else if (k === 'payHalf') { const half = Math.ceil(S.debt / 2); S.st.gold -= half; S.debt -= half; out.push({ t: `−${half} золота`, good: false }, { t: `Долг: ${S.debt}`, good: true }); }
      else if (k === 'extend') { S.debtDue = S.week + v; out.push({ t: `Отсрочка до недели ${S.debtDue}`, good: true }); }
      else if (k === 'burnInv') {
        const ids = Object.keys(S.inv);
        for (let i = 0; i < v && ids.length; i++) {
          const id = ids.splice(rng.int(0, ids.length - 1), 1)[0];
          delete S.inv[id];
          out.push({ t: `Сгорело: ${B.INV.find((x) => x.id === id).name}`, good: false });
        }
      }
    }
    clampStats();
    return out;
  }

  function choiceDef(card, i) {
    if (card.type === 'event') return D.templates[card.tid].ch[i];
    return B.CARDS[card.id].ch[i];
  }
  const visible = (c) => !c.show || c.show(S, h);
  function dcOf(c) { const d = c.chk[1]; return typeof d === 'function' ? d(S) : d; }

  /* ---------- ход игры ---------- */
  function baseVars() { return { gold: S.st.gold, debt: S.debt, power: power(), people: S.st.people, guard: S.st.guard, debtDue: S.debtDue }; }

  function beatCard(id) {
    const c = B.CARDS[id], vars = baseVars();
    const text = typeof c.text === 'function' ? c.text(S, h) : c.text;
    return { type: 'beat', id, label: c.label, title: c.title, art: c.art, vars, text: R.expand(text, vars, rng), ch: c.ch.map((x, i) => ({ i, t: R.expand(x.t, vars, rng) })) };
  }

  function failEnding() {
    if (S.st.hp <= 0) return 'death';
    if (S.st.sus >= 100) return 'pyre';
    if (S.st.people <= 0) return 'empty';
    return null;
  }

  function nextCard() {
    const fail = failEnding();
    if (fail) return showEnding(fail);
    for (const e of B.SCHEDULE) {
      if (!e.repeat && S.beatsDone[e.id]) continue;
      const due = e.week ? S.week >= e.week : e.when(S);
      if (due) { if (!e.repeat) S.beatsDone[e.id] = 1; return showCard(beatCard(e.id)); }
    }
    const card = D.generate(S, rng, h);
    S.stats.events++;
    S.stats.ms += card.dir.ms;
    showCard(card);
  }

  function markArt(id) {
    S.artRecent = [id].concat(S.artRecent.filter((x) => x !== id)).slice(0, 8);
    S.seenArt[id] = 1;
    if (!seen[id]) { seen[id] = 1; store.set(SEEN, seen); }
  }

  function showCard(card) {
    S.card = card;
    S.outcome = null;
    markArt(card.art);
    save();
    render(true);
  }

  function choose(i) {
    if (!S || !S.card || S.outcome || S.card.type === 'ending') return;
    const card = S.card, c = choiceDef(card, i);
    if (!c || !visible(c) || needFail(c, card.vars)) return;
    let res = c, roll = null;
    if (c.chk) {
      const dc = dcOf(c), b = bonus(c.chk[0]), d = rng.int(1, 20);
      roll = { d, b: b.v, n: b.n, dc, ok: d + b.v >= dc };
      res = roll.ok ? c.ok : c.bad;
    }
    const deltas = applyFx(res.fx, card.vars);
    const label = card.ch.find((x) => x.i === i).t;
    const out = { i, label, text: res.r ? R.expand(res.r, card.vars, rng) : '', deltas, roll, then: res.then || c.then || null, end: res.end || c.end || null };
    if (!out.end) {
      const fail = failEnding();
      if (fail) out.end = fail;
    }
    S.log.push({ w: S.week, label: card.label, title: card.title, pick: label, res: deltas.map((d) => d.t).join(', '), ok: roll ? roll.ok : null });
    if (!out.text && !deltas.length && !roll && (out.then || out.end)) { S.outcome = out; return proceed(); }
    S.outcome = out;
    save();
    render(false);
  }

  function proceed() {
    const out = S.outcome;
    if (!out) return;
    if (out.end) return showEnding(out.end);
    if (out.then) return showCard(beatCard(out.then));
    endWeek();
    nextCard();
  }

  function endWeek() {
    const d = {}, notes = [];
    const add = (k, v) => { if (v) d[k] = (d[k] || 0) + v; };
    const season = h.season();
    add('food', [4, 2, 0, 1][season]);
    add('food', -Math.ceil(S.st.people / 6));
    add('gold', Math.floor(S.st.people / 12));
    add('know', 1);
    add('sus', -1);
    for (const inv of B.INV) if (S.inv[inv.id] && inv.week) for (const k of Object.keys(inv.week)) add(k, inv.week[k]);
    if (S.flags.shaye_partner) add('gold', -2);
    if (S.flags.guild_contract) add('gold', 2);
    if (S.flags.korvin_partner) add('gold', 1);
    if (S.st.food + (d.food || 0) > 0) add('hp', 1);
    for (const k of Object.keys(d)) S.st[k] += d[k];
    if (S.st.food < 0) {
      S.st.food = 0; S.st.people -= 2; S.st.rep -= 3; S.st.hp -= 6;
      notes.push('Голод: две семьи ушли из деревни.');
    }
    if (S.week % 6 === 0 && S.st.food > S.st.people) { S.st.people += 1; notes.push('В деревне родился ребёнок.'); }
    clampStats();
    S.lastWeek = { week: S.week, d, notes };
    S.week += 1;
  }

  function showEnding(id) {
    const e = B.ENDINGS[id];
    S.ended = id;
    if (!endsGot[id]) { endsGot[id] = 1; store.set(ENDS, endsGot); }
    S.card = { type: 'ending', id, label: e.bad ? 'Конец книги · поражение' : 'Конец книги первой', title: e.title, art: e.art, text: e.text(S) };
    S.outcome = null;
    markArt(e.art);
    save();
    render(true);
  }

  function build(id) {
    const inv = B.INV.find((x) => x.id === id);
    if (!inv || S.inv[id] || S.ended) return;
    if (S.st.gold < inv.cost.gold || S.st.know < inv.cost.know) return;
    if (inv.req && inv.req.some((r) => !S.inv[r])) return;
    S.st.gold -= inv.cost.gold;
    S.st.sus += inv.sus || 0;
    clampStats();
    S.inv[id] = S.week;
    S.log.push({ w: S.week, label: 'Мастерская', title: inv.name, pick: 'Построено', res: `−${inv.cost.gold} золота${inv.sus ? `, +${inv.sus} подозрения` : ''}` });
    save();
    renderStats();
    openSheet('workshop');
    toast(`Построено: ${inv.name}`);
  }

  function payDebt() {
    if (!S || S.debt <= 0 || S.st.gold < S.debt) return;
    S.st.gold -= S.debt;
    S.log.push({ w: S.week, label: 'Казна', title: 'Долг Шайе', pick: 'Погашен досрочно', res: `−${S.debt} золота` });
    S.debt = 0;
    S.flags.debt_paid = 1;
    save();
    renderStats();
    openSheet('workshop');
    toast('Долг погашен');
  }

  /* ---------- отрисовка ---------- */
  function fmtMs(ms) { return ms < 0.1 ? 'меньше 0,1 мс' : ms.toFixed(2).replace('.', ',') + ' мс'; }
  const paras = (t) => String(t).split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('');

  function render(newArt) {
    renderTop();
    renderStats();
    if (newArt) renderArt(S && S.card ? S.card.art : 'w_two_moons');
    renderPage();
  }

  function renderTop() {
    const w = $('#when');
    if (!S || !S.card) { w.textContent = 'Книга первая · Серый Брод'; return; }
    const act = B.ACTS[h.actFull() - 1];
    w.textContent = S.ended ? `Конец · прожито недель: ${S.week}` : `Неделя ${S.week} из ${B.WEEKS} · ${B.SEASONS[h.season()]} · Акт ${ROMAN[act.n - 1]}: ${act.name}`;
    $('#gal-count').textContent = `${Object.keys(seen).length}/${ART.SCENES.length}`;
  }

  function renderStats() {
    const box = $('#stats');
    $('#gal-count').textContent = `${Object.keys(seen).length}/${ART.SCENES.length}`;
    if (!S || !S.card) { box.hidden = true; $('#btn-workshop').hidden = true; $('#btn-chronicle').hidden = true; return; }
    box.hidden = false; $('#btn-workshop').hidden = false; $('#btn-chronicle').hidden = false;
    const cur = Object.assign({}, S.st, { power: power(), debt: S.debt });
    const cells = [
      ['hp', 'Здоровье', cur.hp, 100], ['gold', 'Золото', cur.gold], ['food', 'Еда', cur.food], ['people', 'Люди', cur.people],
      ['rep', 'Слава', cur.rep], ['sus', 'Подозрение', cur.sus, 100], ['know', 'Знания', cur.know], ['guard', 'Дружина', cur.guard],
      ['power', 'Оборона', cur.power], ['debt', 'Долг', cur.debt],
    ];
    box.innerHTML = cells.map(([k, n, v, max]) => {
      let cls = '';
      if (prevStats && prevStats[k] !== undefined && prevStats[k] !== v) {
        const up = v > prevStats[k];
        cls = (k === 'sus' || k === 'debt' ? !up : up) ? ' up' : ' down';
      }
      const warn = (k === 'sus' && v >= 60) || (k === 'hp' && v <= 30) || (k === 'food' && v < S.st.people / 2) ? ' warn' : '';
      const sub = k === 'debt' ? (v > 0 ? `до нед. ${S.debtDue}` : 'нет') : '';
      const bar = max ? `<span class="bar"><span style="width:${Math.round((v / max) * 100)}%"></span></span>` : '';
      return `<div class="stat${cls}${warn}" data-k="${k}"><span class="sl">${n}</span><span class="sv">${k === 'debt' && v === 0 ? '—' : v}</span>${sub ? `<span class="ss">${sub}</span>` : ''}${bar}</div>`;
    }).join('');
    prevStats = cur;
  }

  function renderArt(id) {
    const sc = ART.byId[id];
    const box = $('#art');
    box.innerHTML = ART.render(id);
    const cat = ART.CATS.find((c) => c.id === sc.cat);
    $('#cap').innerHTML = `<span class="cap-n">Илл. ${String(sc.n).padStart(3, '0')} / ${ART.SCENES.length}</span><span class="cap-t">${esc(sc.title)}</span><span class="cap-c">${esc(cat.name)}</span>`;
  }

  function weekNote() {
    const lw = S.lastWeek;
    if (!lw || lw.week !== S.week - 1 || S.outcome) return '';
    const parts = Object.keys(lw.d).filter((k) => lw.d[k]).map((k) => {
      const v = lw.d[k], good = k === 'sus' ? v < 0 : v > 0;
      return `<span class="${good ? 'g' : 'b'}">${GEN[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}</span>`;
    });
    return `<div class="weeknote"><span class="wn-h">Итоги недели ${lw.week}</span> ${parts.join(' · ')}${lw.notes.map((n) => ` <strong>${esc(n)}</strong>`).join('')}</div>`;
  }

  function choiceMeta(c, vars) {
    const bits = [];
    const fail = needFail(c, vars);
    if (fail) return { fail, html: `<span class="m-need">${esc(fail)}</span>` };
    if (c.fx) for (const k of ['gold', 'food']) if (c.fx[k] !== undefined) { const v = val(c.fx[k], vars); if (v < 0) bits.push(`${v > 0 ? '+' : '−'}${Math.abs(v)} ${GEN[k]}`); }
    if (c.fx && c.fx.payDebt) bits.push(`−${S.debt} золота`);
    if (c.fx && c.fx.payHalf) bits.push(`−${Math.ceil(S.debt / 2)} золота`);
    if (c.chk) {
      const b = bonus(c.chk[0]), dc = dcOf(c), p = Math.round(chance(b.v, dc) * 100);
      bits.push(`бросок к20 ${b.v >= 0 ? '+' : '−'} ${Math.abs(b.v)} (${b.n}) против ${dc} · шанс ${p}%`);
    }
    if (c.end) bits.push('концовка');
    return { fail: null, html: bits.map((b) => `<span>${esc(b)}</span>`).join('') };
  }

  function renderPage() {
    const page = $('#page');
    if (!S || !S.card) return renderTitle(page);
    const card = S.card;
    if (card.type === 'ending') return renderEnding(page, card);
    let html = weekNote();
    html += `<div class="eyebrow">${esc(card.label)}</div><h2 class="title">${esc(card.title)}</h2><div class="text lead">${paras(card.text)}</div>`;
    if (!S.outcome) {
      const list = card.ch.map((x) => ({ x, c: choiceDef(card, x.i) })).filter((o) => visible(o.c));
      html += '<div class="choices" role="list">' + list.map((o, n) => {
        const m = choiceMeta(o.c, card.vars);
        return `<button class="choice" type="button" role="listitem" data-i="${o.x.i}"${m.fail ? ' disabled' : ''}><span class="num">${ROMAN[n]}</span><span class="cbody"><span class="ct">${esc(o.x.t)}</span>${m.html ? `<span class="meta">${m.html}</span>` : ''}</span><kbd>${n + 1}</kbd></button>`;
      }).join('') + '</div>';
    } else {
      const o = S.outcome;
      html += `<div class="outcome"><div class="asterism" aria-hidden="true">⁂</div><div class="chosen">Вы выбрали: <em>${esc(o.label)}</em></div>`;
      if (o.roll) html += `<div class="roll ${o.roll.ok ? 'ok' : 'bad'}">Бросок к20: ${o.roll.d} ${o.roll.b >= 0 ? '+' : '−'} ${Math.abs(o.roll.b)} (${esc(o.roll.n)}) = ${o.roll.d + o.roll.b} против ${o.roll.dc}. ${o.roll.ok ? 'Успех' : 'Неудача'}.</div>`;
      if (o.text) html += `<div class="text">${paras(o.text)}</div>`;
      if (o.deltas.length) html += `<div class="chips">${o.deltas.map((d) => `<span class="chip ${d.good ? 'g' : 'b'}">${esc(d.t)}</span>`).join('')}</div>`;
      const lbl = o.end ? 'Перевернуть последнюю страницу' : o.then ? 'Дальше' : 'Следующая неделя';
      html += `<button class="next" type="button" id="btn-next">${lbl} <span aria-hidden="true">→</span></button></div>`;
    }
    if (card.dir) html += chronicler(card.dir);
    page.innerHTML = html;
    page.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.i))));
    const nb = $('#btn-next');
    if (nb) { nb.addEventListener('click', proceed); nb.focus({ preventScroll: true }); }
  }

  function chronicler(dir) {
    let fc = '';
    if (S.inv.spyglass) { const nb = h.nextBeat(); if (nb) fc = `<li>Подзорная труба: глава «${esc(nb.title)}» через ${nb.weeks} нед.</li>`; }
    const top = dir.top && dir.top.length ? `<div class="chron-alt">Рассматривал ${dir.cands} ${R.plural(dir.cands, ['сюжет', 'сюжета', 'сюжетов'])}: ${dir.top.map((t) => `${esc(t.title)} ${t.p}%`).join(' · ')}</div>` : '';
    return `<details class="chron"><summary><span class="chron-n">Летописец</span><span class="chron-ms">сочинил событие за ${fmtMs(dir.ms)}</span><span class="chron-t" aria-label="Напряжение ${dir.tension} из 10">${'▮'.repeat(Math.round(dir.tension / 2))}${'▯'.repeat(5 - Math.round(dir.tension / 2))}</span></summary><ul>${dir.reason.map((r) => `<li>${esc(r)}</li>`).join('')}${fc}</ul>${top}</details>`;
  }

  function renderTitle(page) {
    const saved = store.get(KEY);
    const cont = saved && saved.card && !saved.ended ? `<button class="btn primary" type="button" id="btn-continue">Продолжить: неделя ${saved.week}</button>` : '';
    page.innerHTML = `<div class="eyebrow">Книга первая</div><h2 class="cover-title">Пришлый</h2><p class="cover-sub">Серый Брод</p>
      <div class="text"><p>Инженер из нашего времени просыпается в теле опального баронского сына. У него сорок недель, долг ростовщику, брат-убийца и знания, за которые здесь сжигают.</p></div>
      <dl class="facts"><div><dt>16</dt><dd>авторских глав</dd></div><div><dt>${ART.SCENES.length}</dt><dd>иллюстраций в 10 темах</dd></div><div><dt>${D.count}</dt><dd>заготовок у Летописца</dd></div><div><dt>11</dt><dd>концовок</dd></div></dl>
      <p class="note">Между главами события сочиняет Летописец, ИИ-рассказчик. Он учитывает сезон, ваши запасы, подозрение и прошлые решения и тратит на это доли миллисекунды.</p>
      <div class="actions">${cont}<button class="btn ${cont ? '' : 'primary'}" type="button" id="btn-new">${cont ? 'Начать заново' : 'Начать книгу'}</button><button class="btn" type="button" id="btn-gal2">Галерея иллюстраций</button></div>`;
    if (cont) $('#btn-continue').addEventListener('click', () => { load(saved); });
    const nb = $('#btn-new');
    nb.addEventListener('click', () => {
      if (cont && !nb.dataset.armed) { nb.dataset.armed = '1'; nb.textContent = 'Точно? Сохранение пропадёт'; setTimeout(() => { if (nb.isConnected) { delete nb.dataset.armed; nb.textContent = 'Начать заново'; } }, 4000); return; }
      startNew();
    });
    $('#btn-gal2').addEventListener('click', () => openSheet('gallery'));
  }

  function renderEnding(page, card) {
    const e = B.ENDINGS[card.id];
    const all = Object.keys(B.ENDINGS);
    const avg = S.stats.events ? S.stats.ms / S.stats.events : 0;
    page.innerHTML = `<div class="eyebrow ${e.bad ? 'bad' : ''}">${esc(card.label)}</div><h2 class="title">${esc(card.title)}</h2><div class="text">${paras(card.text)}</div>
      <dl class="facts"><div><dt>${S.week}</dt><dd>${R.plural(S.week, ['неделя', 'недели', 'недель'])} прожито</dd></div><div><dt>${Object.keys(S.inv).length}</dt><dd>изобретений</dd></div><div><dt>${S.stats.events}</dt><dd>событий от Летописца</dd></div><div><dt>${Object.keys(S.seenArt).length}</dt><dd>иллюстраций увидено</dd></div></dl>
      <p class="note">Летописец тратил на событие в среднем ${fmtMs(avg)}. Открыто концовок: ${Object.keys(endsGot).length} из ${all.length}.</p>
      <ul class="endlist">${all.map((k) => `<li class="${endsGot[k] ? 'got' : ''}">${endsGot[k] ? esc(B.ENDINGS[k].title) : 'не открыта'}</li>`).join('')}</ul>
      <div class="actions"><button class="btn primary" type="button" id="btn-again">Начать книгу заново</button><button class="btn" type="button" id="btn-log2">Летопись этой жизни</button></div>`;
    $('#btn-again').addEventListener('click', startNew);
    $('#btn-log2').addEventListener('click', () => openSheet('chronicle'));
  }

  /* ---------- панели ---------- */
  function openSheet(mode, arg) {
    sheetMode = mode;
    const sh = $('#sheet'), body = $('#sheet-body'), title = $('#sheet-title');
    let html = '';
    if (mode === 'workshop') {
      title.textContent = 'Мастерская Серого Брода';
      html += `<p class="sheet-lede">Золото: <b>${S.st.gold}</b> · Знания: <b>${S.st.know}</b>. Знания не тратятся: это порог, до которого нужно дорасти. Постройка не занимает неделю.</p>`;
      if (S.debt > 0) html += `<div class="debt-row"><span>Долг ростовщику Шайе: <b>${S.debt}</b> золотых, срок — неделя ${S.debtDue}.</span><button class="btn" type="button" id="btn-pay"${S.st.gold < S.debt || S.ended ? ' disabled' : ''}>Погасить долг</button></div>`;
      html += '<div class="inv-grid">' + B.INV.map((inv) => {
        const built = !!S.inv[inv.id];
        const missing = (inv.req || []).filter((r) => !S.inv[r]).map((r) => B.INV.find((x) => x.id === r).name);
        const eff = [];
        if (inv.week) for (const k of Object.keys(inv.week)) eff.push(`+${inv.week[k]} ${GEN[k]} в неделю`);
        if (inv.power) eff.push(`+${inv.power} к обороне`);
        if (inv.sus) eff.push(`+${inv.sus} подозрения при постройке`);
        let btn;
        if (built) btn = '<span class="built">Построено</span>';
        else if (missing.length) btn = `<span class="locked">Сначала: ${esc(missing.join(', '))}</span>`;
        else {
          const ok = S.st.gold >= inv.cost.gold && S.st.know >= inv.cost.know && !S.ended;
          btn = `<button class="btn small" type="button" data-build="${inv.id}"${ok ? '' : ' disabled'}>Построить · ${inv.cost.gold} зол.</button>${S.st.know < inv.cost.know ? `<span class="locked">Нужно знаний: ${inv.cost.know}</span>` : ''}`;
        }
        return `<article class="inv${built ? ' is-built' : ''}"><div class="inv-art">${ART.render(inv.art)}</div><div class="inv-body"><h3>${esc(inv.name)}</h3><p>${esc(inv.desc)}</p><p class="inv-eff">${esc(eff.join(' · '))}</p><p class="inv-cost">Цена: ${inv.cost.gold} золотых · знаний не меньше ${inv.cost.know}</p><div class="inv-act">${btn}</div></div></article>`;
      }).join('') + '</div>';
    } else if (mode === 'chronicle') {
      title.textContent = 'Летопись';
      html += S && S.log.length ? '<ol class="log">' + S.log.slice().reverse().map((e) => `<li><span class="lw">Нед. ${e.w}</span><span class="lt"><b>${esc(e.title)}</b> <span class="ll">${esc(e.label)}</span><br>${esc(e.pick)}${e.ok === true ? ' · <span class="g">успех</span>' : e.ok === false ? ' · <span class="b">неудача</span>' : ''}${e.res ? `<br><span class="lr">${esc(e.res)}</span>` : ''}</span></li>`).join('') + '</ol>' : '<p class="sheet-lede">Летопись пуста. Начните книгу, и здесь появится каждое ваше решение.</p>';
    } else if (mode === 'gallery') {
      title.textContent = `Галерея · ${Object.keys(seen).length} из ${ART.SCENES.length} встречено в игре`;
      html += '<p class="sheet-lede">Все сто иллюстраций нарисованы кодом. Встреченные в игре отмечены точкой. Нажмите на картинку, чтобы открыть её крупно.</p>';
      for (const cat of ART.CATS) {
        const list = ART.SCENES.filter((s) => s.cat === cat.id);
        html += `<h3 class="gal-h">${esc(cat.name)}</h3><div class="gal-grid">` + list.map((s) => `<button class="thumb${seen[s.id] ? ' seen' : ''}" type="button" data-art="${s.id}"><span class="th-art">${ART.render(s.id)}</span><span class="th-cap"><span class="th-n">${String(s.n).padStart(3, '0')}</span> ${esc(s.title)}</span></button>`).join('') + '</div>';
      }
    } else if (mode === 'view') {
      const sc = ART.byId[arg], i = ART.SCENES.indexOf(sc);
      const prev = ART.SCENES[(i + ART.SCENES.length - 1) % ART.SCENES.length].id, next = ART.SCENES[(i + 1) % ART.SCENES.length].id;
      title.textContent = `Илл. ${String(sc.n).padStart(3, '0')} · ${sc.title}`;
      html += `<div class="view-art art-live">${ART.render(arg)}</div><p class="view-tags">${esc(ART.CATS.find((c) => c.id === sc.cat).name)} · теги: ${esc(sc.tags.join(', '))}</p><div class="actions"><button class="btn" type="button" data-art="${prev}">← Предыдущая</button><button class="btn" type="button" id="btn-back">Ко всей галерее</button><button class="btn" type="button" data-art="${next}">Следующая →</button></div>`;
    } else if (mode === 'menu') {
      title.textContent = 'О книге';
      const avg = S && S.stats.events ? fmtMs(S.stats.ms / S.stats.events) : '—';
      html += `<div class="about"><p><b>«Пришлый. Книга первая»</b> — текстовая игра про попаданца. Сюжетный каркас из 16 глав написан заранее. Всё, что происходит между главами, сочиняет Летописец.</p>
        <h3>Как устроен Летописец</h3><p>Это игровой ИИ-режиссёр, а не нейросеть. Каждую неделю он смотрит на ваше положение: акт, сезон, запасы, подозрение, давно ли случалась беда, какие решения вы принимали раньше. По этим признакам он взвешивает ${D.count} сюжетных заготовок, выбирает одну, заполняет её именами, подробностями и числами и подбирает к ней одну из ${ART.SCENES.length} иллюстраций. Если давно было спокойно, растёт напряжение, и Летописец готовит испытание. Если вы голодаете, чаще случаются события про еду. Некоторые решения он запоминает и возвращает через несколько недель.</p>
        <p>Всё работает прямо в браузере, без интернета. ${S ? `В этой игре он сочинил ${S.stats.events} ${R.plural(S.stats.events, ['событие', 'события', 'событий'])}, в среднем за ${avg}.` : ''}</p>
        <div class="bench"><button class="btn" type="button" id="btn-bench">Испытать Летописца: 1000 событий</button><div id="bench-out" class="bench-out"></div></div>
        <h3>Управление</h3><p>Клавиши 1–5 выбирают вариант, Enter или пробел переворачивают страницу, Esc закрывает панели. Игра сохраняется сама после каждого шага.</p></div>
        <div class="actions"><button class="btn" type="button" id="btn-reset">Начать книгу заново</button></div>`;
    }
    body.innerHTML = html;
    sh.hidden = false;
    document.body.classList.add('locked');
    body.scrollTop = mode === 'view' || mode === 'gallery' ? body.scrollTop : 0;
    body.querySelectorAll('[data-build]').forEach((b) => b.addEventListener('click', () => build(b.dataset.build)));
    body.querySelectorAll('[data-art]').forEach((b) => b.addEventListener('click', () => openSheet('view', b.dataset.art)));
    const pay = $('#btn-pay'); if (pay) pay.addEventListener('click', payDebt);
    const back = $('#btn-back'); if (back) back.addEventListener('click', () => openSheet('gallery'));
    const bench = $('#btn-bench'); if (bench) bench.addEventListener('click', runBench);
    const rs = $('#btn-reset');
    if (rs) rs.addEventListener('click', () => {
      if (S && !rs.dataset.armed) { rs.dataset.armed = '1'; rs.textContent = 'Точно? Текущая игра пропадёт'; return; }
      closeSheet(); startNew();
    });
    $('#sheet-close').focus({ preventScroll: true });
  }

  function closeSheet() {
    $('#sheet').hidden = true;
    $('#sheet-body').innerHTML = '';
    document.body.classList.remove('locked');
    sheetMode = null;
  }

  // Прогон Летописца на копии текущего мира: показывает скорость и разнообразие.
  function runBench() {
    const base = S ? JSON.parse(JSON.stringify(S)) : newState();
    if (!S) { base.week = 14; }
    const r2 = R.makeRng((Date.now() >>> 0) ^ 0x9e3779b9);
    const titles = {};
    const samples = [];
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      const st = JSON.parse(JSON.stringify(base));
      st.week = 2 + (i % 37);
      st.recent = [];
      const hh = Object.assign({}, h, {
        season: () => Math.floor((st.week - 1) / 10) % 4,
        act: () => { let a = 1; for (const x of B.ACTS) if (st.week >= x.from) a = x.n; return Math.min(4, a); },
        invCount: () => Object.keys(st.inv).length,
        nextBeat: () => {
          for (const e of B.SCHEDULE) if (e.week && !st.beatsDone[e.id] && e.week > st.week) return { title: B.CARDS[e.id].title, weeks: e.week - st.week };
          return null;
        },
      });
      const c = D.generate(st, r2, hh);
      titles[c.title] = (titles[c.title] || 0) + 1;
      if (i % 333 === 0) samples.push(c);
    }
    const ms = performance.now() - t0;
    const out = $('#bench-out');
    out.innerHTML = `<p><b>1000 событий за ${fmtMs(ms)}</b> (включая копирование мира для каждого). Разных сюжетов: ${Object.keys(titles).length}.</p>` +
      samples.map((c) => `<div class="sample"><span class="eyebrow">${esc(c.label)} · илл. ${esc(ART.byId[c.art].title)}</span><b>${esc(c.title)}</b><p>${esc(c.text.split('\n\n')[0])}</p></div>`).join('');
  }

  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------- запуск ---------- */
  function startNew() {
    S = newState();
    rng = R.makeRng(S.seed);
    prevStats = null;
    nextCard();
  }

  function load(data) {
    S = data;
    rng = R.makeRng(0);
    rng.setState(S.rngState);
    prevStats = null;
    if (S.card) markArt(S.card.art);
    render(true);
  }

  function bind() {
    $('#btn-workshop').addEventListener('click', () => S && openSheet('workshop'));
    $('#btn-chronicle').addEventListener('click', () => openSheet('chronicle'));
    $('#btn-gallery').addEventListener('click', () => openSheet('gallery'));
    $('#btn-menu').addEventListener('click', () => openSheet('menu'));
    $('#btn-home').addEventListener('click', () => { if (S) save(); S = null; closeSheet(); render(true); });
    $('#sheet-close').addEventListener('click', closeSheet);
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sheetMode) { closeSheet(); return; }
      if (sheetMode || !S || !S.card || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/^[1-7]$/.test(e.key) && !S.outcome) {
        const btns = Array.from(document.querySelectorAll('.choice'));
        const b = btns[Number(e.key) - 1];
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
      } else if ((e.key === 'Enter' || e.key === ' ') && S.outcome && tag !== 'BUTTON') {
        e.preventDefault(); proceed();
      }
    });
  }

  function start(data) {
    bind();
    const snap = data && data.S;
    if (snap) { load(snap); return; }
    render(true);
  }

  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ S: S ? Object.assign({}, S, { rngState: rng.state() }) : null })); } catch (e) { /* среда без горячей перезагрузки */ }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
