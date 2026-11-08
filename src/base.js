'use strict';
// ---------- Убежище: отряд, постройки, мастерская, ночь ----------

const RECIPES = [
  { id: 'ammo', name: 'Патроны ×6', need: 1, cost: { parts: 2 }, give: { ammo: 6 }, desc: 'Переснаряжённые гильзы, порох из старых запасов.' },
  { id: 'seeds', name: 'Семена', need: 1, cost: { food: 3 }, give: { seeds: 1 }, desc: 'Отобрать зерно и картофель на посадку.' },
  { id: 'meds', name: 'Аптечка', need: 2, cost: { parts: 2, water: 2 }, give: { meds: 1 }, desc: 'Кипячёные бинты, спирт, шина.' },
  { id: 'fuel', name: 'Канистра спирта', need: 2, cost: { parts: 2, food: 3 }, give: { fuel: 1 }, desc: 'Перегонка из остатков еды. Машина заводится.' },
];
const WORKSHOP_PERKS = ['', '+1 приманка каждому на вылазке', 'Глушители: пистолет слышно на 4 клетки вместо 13', 'Оружейник: +1 урон всем'];

function addLog(t, c = '') { S.log.unshift({ d: S.day, t, c }); if (S.log.length > 80) S.log.length = 80; }
function hasMechanic() { return S.survivors.some(s => s.trait === 'mechanic'); }
function recipeCost(r) {
  const c = Object.assign({}, r.cost);
  if (hasMechanic() && c.parts) c.parts = Math.max(1, c.parts - 1);
  return c;
}
function canPay(cost) { return Object.keys(cost).every(k => (S.res[k] || 0) >= cost[k]); }
function pay(cost) { for (const k in cost) S.res[k] -= cost[k]; }
function costChips(cost) {
  return Object.keys(cost).map(k => `<span class="cc ${(S.res[k] || 0) >= cost[k] ? '' : 'miss'}" title="${RES[k].name}">${icon(k)}${cost[k]}</span>`).join('');
}
function cureCost() { return [0, 3, 2, 1][S.build.infirmary]; }

function newSurvivor() {
  const used = new Set(S.survivors.map(s => s.name));
  const pool = NAMES.filter(n => !used.has(n[0]));
  const [name, g] = pick(pool.length ? pool : NAMES);
  const trait = pick(Object.keys(TRAITS));
  const usedC = new Set(S.survivors.map(s => s.color));
  const color = UNIT_COLORS.find(c => !usedC.has(c)) || pick(UNIT_COLORS);
  const v = rnd();
  const ranged = v < 0.3 ? 'pistol' : v < 0.45 ? 'shotgun' : v < 0.55 ? 'rifle' : null;
  const hp = rint(11, 14) + (trait === 'tough' ? 4 : 0);
  return { id: S.nid++, name, g, trait, melee: pick(['knife', 'bat', 'crowbar', 'axe']), ranged, hp, maxhp: hp, color, kills: 0, level: 1, infected: 0 };
}

function newGameState() {
  S = {
    v: 1, day: 1, nid: 1, mission: null, log: [], squad: [], over: false,
    res: { food: 10, water: 10, parts: 6, meds: 2, ammo: 24, fuel: 3, tools: 0, seeds: 0 },
    build: { walls: 0, infirmary: 0, garden: 0, water: 0, workshop: 0, radio: 0 },
    survivors: [],
  };
  const mk = (name, g, trait, melee, ranged, hp, color) => ({ id: S.nid++, name, g, trait, melee, ranged, hp: hp + (trait === 'tough' ? 4 : 0), maxhp: hp + (trait === 'tough' ? 4 : 0), color, kills: 0, level: 1, infected: 0 });
  S.survivors.push(
    mk('Марина', 'f', 'medic', 'knife', 'pistol', 13, UNIT_COLORS[1]),
    mk('Гоша', 'm', 'strong', 'bat', null, 15, UNIT_COLORS[2]),
    mk('Лёха', 'm', 'marksman', 'crowbar', 'pistol', 13, UNIT_COLORS[0]),
    mk('Семёныч', 'm', 'hunter', 'axe', 'shotgun', 12, UNIT_COLORS[3]),
  );
  S.squad = [1, 2, 3];
  ensureWorld();
  addLog('Мы заняли старую насосную станцию на окраине. Стены крепкие, но еды и воды хватит дня на два.');
  addLog('Первую вылазку лучше сделать на ферму: туда можно дойти пешком. Все места — на карте округи.');
}

// Зоны карты базы: касание открывает нужную постройку
const BASE_ZONES = [
  ['radio', 26, 4, 28, 6], ['garden', 5, 6, 13, 15], ['water', 28, 5, 34, 13], ['infirmary', 5, 18, 12, 24],
  ['workshop', 26, 16, 34, 27], ['walls', 0, 0, 39, 4], ['walls', 0, 29, 39, 35], ['walls', 0, 0, 5, 35], ['walls', 34, 0, 39, 35],
];
const DOCK = { build: ['Постройки', 'home'], craft: ['Мастерская', 'hammer'], fac: ['Группировки', 'shield'], log: ['Журнал', 'log'] };

const Base = {
  tab: null, hl: null, life: null,
  // ----- сцена: карта базы с людьми у костра -----
  scene() {
    const { m } = genBase(S);
    m.seen = new Uint8Array(m.n).fill(1); m.vis = new Uint8Array(m.n).fill(1);
    m.units = []; m.zombies = []; m.turn = 1; m.tod = 0;
    m.uocc = new Uint8Array(m.n); m.zocc = new Uint8Array(m.n);
    const ents = [], spots = m.idle.slice(), sick = [[7, 22], [9, 22], [11, 22]];
    for (const s of S.survivors) {
      const hurt = S.build.infirmary && (s.infected || s.hp < s.maxhp * 0.5) && sick.length;
      const [x, y] = hurt ? sick.shift() : spots.shift() || [20 + rint(-3, 3), 17];
      const e = { id: s.id, name: s.name, g: s.g, color: s.color, melee: s.melee, ranged: s.ranged, trait: s.trait, x, y, hp: s.hp, maxhp: s.maxhp };
      e.f = dirIdx(20 - x, 20 - y);
      ents.push({ e });
      m.uocc[MI(m, x, y)] = 1;
    }
    R.base = { m, ents };
  },
  startLife() {
    clearInterval(this.life);
    this.life = setInterval(() => this.lifeTick(), 2600);
  },
  stopLife() { clearInterval(this.life); this.life = null; },
  async lifeTick() {
    const B = R.base;
    if (R.mode !== 'base' || !B || document.hidden) return;
    const free = B.ents.filter(it => !it.busy);
    if (!free.length || chance(0.35)) return;
    const it = pick(free), e = it.e, m = B.m;
    const spot = pick(m.idle.filter(([x, y]) => !m.uocc[MI(m, x, y)]));
    if (!spot) return;
    const path = zPath(m, e, spot[0], spot[1]);
    if (!path || !path.length || path.length > 14) return;
    it.busy = true;
    m.uocc[MI(m, e.x, e.y)] = 0;
    for (const j of path) { if (R.mode !== 'base' || R.base !== B) break; await animTo(e, j % m.w, (j / m.w) | 0, 330); }
    m.uocc[MI(m, e.x, e.y)] = 1;
    e.f = dirIdx(20 - e.x, 20 - e.y);
    it.busy = false; R.dirty = true;
  },
  frame() {
    const root = $('#scr-base');
    const lw = $('.survs', root) ? $('.survs', root).offsetWidth : 0, rw = $('.dock', root) ? $('.dock', root).offsetWidth : 0;
    R.cam.k = clamp(Math.round(R.H / 15.5), 22, 36);
    R.cam.cx = 20; R.cam.cy = 16.5; R.camAnim = null;
    R.panStart(0, 0); R.panTo((lw - rw) / 2, R.H * 0.03); R.pan = null;
    R.dirty = true;
  },
  tapMap(x, y) {
    const e = R.pick(x, y);
    if (e && e.name) {
      const s = S.survivors.find(o => o.id === e.id);
      if (s) { Sfx.play('click'); Game.toast(`${s.name}: ${TRAITS[s.trait].name.toLowerCase()}, ${s.hp}/${s.maxhp}${s.infected ? ', укус' : ''}`); }
      return;
    }
    const t = R.toTile(x, y);
    const z = BASE_ZONES.find(([, x0, y0, x1, y1]) => t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1);
    if (z) { Sfx.play('click'); this.tab = 'build'; this.hl = z[0]; this.render(); }
  },
  // ----- интерфейс -----
  render() {
    const root = $('#scr-base');
    ensureWorld();
    const n = S.survivors.length, tr = S.fac.collectors.tribute;
    const due = tr && !tr.paid && !S.fac.collectors.beaten ? tr.due - S.day : null;
    root.innerHTML = `
      <header class="bbar">
        <div class="brand">Рубеж</div>
        <div class="day"><span>День</span><b>${S.day}</b><small>из ${VICTORY_DAY}</small></div>
        ${due != null ? `<button class="chip-tr ${due <= 0 ? 'now' : ''}" id="bTr">${icon('shield')}<span>Доля Сборщикам ${due <= 0 ? 'сегодня' : `через ${due} ${plural(due, 'день', 'дня', 'дней')}`}</span></button>` : ''}
        <div class="resrow">${RES_ORDER.map(k => `<span class="res ${(k === 'food' || k === 'water') && S.res[k] < n ? 'low' : ''}" title="${RES[k].name}" style="--rc:${RES[k].color}">${icon(k)}<b>${S.res[k]}</b></span>`).join('')}</div>
        <button class="hbtn" id="bSet" aria-label="Настройки">${icon('gear')}</button>
      </header>
      <div class="bmain">
        <section class="survs">
          <h2>Группа <span>${n}</span><small>за ночь: ${n} еды и ${n} воды</small></h2>
          <div class="slist">${S.survivors.map(s => this.card(s)).join('')}</div>
          <div class="bact">
            <button class="btn hazard big" id="bWorld">${icon('map')}<span>Карта округи</span></button>
            <button class="btn" id="bRest">${icon('moon')}<span>Отдыхать</span></button>
          </div>
        </section>
        <div class="bview"></div>
        <section class="dock ${this.tab ? 'open' : ''}">
          ${this.tab ? `<div class="dock-p">
            <header><h2>${DOCK[this.tab][0]}</h2><button class="hbtn" id="bClose" aria-label="Закрыть">${icon('close')}</button></header>
            <div class="tabc">${this['tab_' + this.tab]()}</div>
          </div>` : ''}
          <nav class="rail" role="tablist">${Object.keys(DOCK).map(k => `<button role="tab" aria-selected="${this.tab === k}" class="${this.tab === k ? 'on' : ''}" data-tab="${k}" title="${DOCK[k][0]}">${icon(DOCK[k][1])}<span>${DOCK[k][0]}</span></button>`).join('')}</nav>
        </section>
      </div>`;
    $('#bSet').onclick = () => { Sfx.play('click'); Game.openSettings(); };
    $('#bWorld').onclick = () => { Sfx.init(); Sfx.play('click'); Game.showWorld(); };
    $('#bRest').onclick = () => this.rest();
    const tb = $('#bTr'); if (tb) tb.onclick = () => { Sfx.play('click'); this.tab = 'fac'; this.render(); };
    const cl = $('#bClose'); if (cl) cl.onclick = () => { Sfx.play('click'); this.tab = null; this.hl = null; this.render(); this.frame(); };
    $$('.rail button', root).forEach(b => { b.onclick = () => { Sfx.play('click'); const k = b.dataset.tab; this.tab = this.tab === k ? null : k; this.hl = null; this.render(); this.frame(); }; });
    $$('canvas[data-pt]', root).forEach(cv => { const s = S.survivors.find(o => o.id === +cv.dataset.pt); if (s) try { drawPortrait(cv, s); } catch (e) { console.error(e); } });
    $$('[data-cure]', root).forEach(b => { b.onclick = () => this.cure(+b.dataset.cure); });
    $$('[data-build]', root).forEach(b => { b.onclick = () => this.build(b.dataset.build); });
    $$('[data-craft]', root).forEach(b => { b.onclick = () => this.craft(b.dataset.craft); });
    const pt = $('#bPay'); if (pt) pt.onclick = () => { payTribute(); this.render(); };
    if (this.hl) { const el = $(`[data-bk="${this.hl}"]`, root); if (el) el.scrollIntoView({ block: 'nearest' }); }
  },
  card(s) {
    const hp = (s.hp / s.maxhp) * 100;
    return `<div class="sw">
      <div class="sc ${s.infected ? 'inf' : ''}" style="--uc:${s.color}">
        <canvas class="pt" data-pt="${s.id}" aria-hidden="true"></canvas>
        <span class="sc-top"><b>${esc(s.name)}</b><i class="trait" title="${esc(TRAITS[s.trait].desc)}">${TRAITS[s.trait].name}</i>${s.level > 1 ? `<i class="lvl">${icon('star')}${s.level}</i>` : ''}</span>
        <span class="bar ${hp < 40 ? 'lowhp' : ''}"><i style="width:${hp}%"></i></span>
        <span class="sc-meta">${s.hp}/${s.maxhp} · ${WEAP[s.melee].name}${s.ranged ? ' и ' + WEAP[s.ranged].name.toLowerCase() : ''}</span>
        ${s.infected ? `<span class="sc-inf">${icon('bite')}Укус: ${s.infected === 1 ? 'обратится этой ночью' : `обратится через ${s.infected} ${plural(s.infected, 'день', 'дня', 'дней')}`}</span>` : ''}
      </div>
      ${s.infected ? (S.build.infirmary >= 1 ? `<button class="btn sm cure" data-cure="${s.id}" ${S.res.meds >= cureCost() ? '' : 'disabled'}>Лечить: ${cureCost()} мед.</button>` : '<span class="cure-hint">Лечить укус можно только в лазарете</span>') : ''}
    </div>`;
  },
  tab_build() {
    return `<div class="blds">${BUILD_ORDER.map(k => {
      const B = BUILD[k], lv = S.build[k];
      let pips = '';
      for (let i = 0; i < B.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
      const cost = lv < B.max ? B.cost[lv] : null;
      return `<div class="bld ${this.hl === k ? 'hl' : ''}" data-bk="${k}">
        <div class="bld-h"><b>${B.name}</b><span class="lv" title="Уровень ${lv} из ${B.max}">${pips}</span></div>
        <p class="now">${B.eff[lv]}</p>
        ${cost ? `<p class="next">Дальше: ${B.eff[lv + 1]}</p><div class="bld-f"><span class="cost">${costChips(cost)}</span><button class="btn sm" data-build="${k}" ${canPay(cost) ? '' : 'disabled'}>${lv ? 'Улучшить' : 'Построить'}</button></div>` : '<p class="max">Готово полностью</p>'}
      </div>`;
    }).join('')}</div>`;
  },
  tab_craft() {
    const lv = S.build.workshop;
    const perks = WORKSHOP_PERKS.slice(1).map((p, i) => `<li class="${lv > i ? 'on' : ''}">${i + 1}. ${p}</li>`).join('');
    return `<div class="crafts">${RECIPES.map(r => {
      const cost = recipeCost(r), ok = lv >= r.need;
      return `<div class="rc">
        <div class="rc-t"><b>${r.name}</b><span>${r.desc}</span></div>
        <span class="cost">${costChips(cost)}</span>
        <button class="btn sm" data-craft="${r.id}" ${ok && canPay(cost) ? '' : 'disabled'}>${ok ? 'Сделать' : `Мастерская ${r.need}`}</button>
      </div>`;
    }).join('')}</div>
    <div class="perks"><h3>Мастерская, уровень ${lv}</h3><ul>${perks}</ul>${hasMechanic() ? '<p>Механик в группе: крафт на 1 деталь дешевле.</p>' : ''}</div>`;
  },
  tab_fac() {
    return `<div class="facs">${Object.keys(FACTIONS).map(f => {
      const F = FACTIONS[f], st = S.fac[f], camp = LOCS[F.camp];
      const status = st.beaten ? 'разгромлены' : !st.met ? 'неизвестны' : f === 'collectors' && st.tribute ? 'требуют долю' : 'враждебны';
      let extra = '';
      if (f === 'collectors' && st.tribute && !st.beaten) {
        const tr = st.tribute, d = tr.due - S.day;
        extra = tr.paid ? `<p class="ok">Доля отложена. Приедут ${d <= 0 ? 'этой ночью' : `через ${d} ${plural(d, 'день', 'дня', 'дней')}`}.</p>` :
          `<p class="warn">Приедут за долей ${d <= 0 ? 'этой ночью' : `через ${d} ${plural(d, 'день', 'дня', 'дней')}`}. Не отдадите — будет налёт.</p>
           <div class="bld-f"><span class="cost">${costChips(tr.cost)}</span><button class="btn sm" id="bPay" ${canPay(tr.cost) ? '' : 'disabled'}>Отложить долю</button></div>`;
      }
      return `<div class="fac ${st.beaten ? 'off' : ''}" style="--fc:${F.color}">
        <div class="bld-h"><b>${st.met || st.beaten ? F.name : '???'}</b><span class="fst">${status}</span></div>
        <p>${st.met || st.beaten ? F.desc : 'О них пока ничего не известно. Слухи доходят с дорог.'}</p>
        <p class="fmeta">${st.kills ? `Убито: ${st.kills}. ` : ''}Лагерь: ${isKnown(F.camp) ? `${camp.name}, на карте` : 'неизвестно где'}.</p>
        ${extra}
      </div>`;
    }).join('')}</div>`;
  },
  tab_log() {
    return `<ol class="journal">${S.log.map(e => `<li class="${e.c || ''}"><span>День ${e.d}</span>${esc(e.t)}</li>`).join('')}</ol>`;
  },
  cure(id) {
    const s = S.survivors.find(o => o.id === id), c = cureCost();
    if (!s || S.res.meds < c) return;
    S.res.meds -= c; s.infected = 0;
    addLog(`${s.name}: укус обработан, заражение остановлено.`, 'good');
    Sfx.play('heal');
    this.render(); saveGame();
  },
  build(k) {
    const B = BUILD[k], lv = S.build[k];
    if (lv >= B.max || !canPay(B.cost[lv])) return;
    pay(B.cost[lv]);
    S.build[k]++;
    addLog(`${B.name}: уровень ${S.build[k]}. ${B.eff[S.build[k]]}.`, 'good');
    if (k === 'radio') for (const l of LOC_ORDER) if (LOCS[l].needRadio === S.build.radio && !LOCS[l].camp && reveal(l)) addLog(`В эфире нашлось место: ${LOCS[l].name}. Теперь туда можно съездить.`, 'good');
    Sfx.play('build');
    Game.toast(`${B.name}: уровень ${S.build[k]}`);
    this.hl = k;
    this.scene();
    this.render(); saveGame();
  },
  craft(id) {
    const r = RECIPES.find(x => x.id === id), cost = recipeCost(r);
    if (S.build.workshop < r.need || !canPay(cost)) return;
    pay(cost);
    for (const k in r.give) S.res[k] += r.give[k];
    Sfx.play('search');
    Game.toast(`Готово: ${r.name}`);
    this.render(); saveGame();
  },
  rest() {
    Sfx.init();
    Game.modal({
      title: 'Пропустить день?',
      html: '<p>Группа останется в убежище: раны подлечатся, но еда и вода всё равно уйдут.</p>',
      buttons: [{ label: 'Отмена' }, { label: 'Отдыхать до утра', cls: 'primary', fn: () => this.night([]) }],
    });
  },
  missionReport(rep) {
    if (rep.siege) return this.siegeReport(rep);
    const L = LOCS[rep.loc];
    const got = RES_ORDER.filter(k => rep.got[k]).map(k => `<span class="cc" style="--rc:${RES[k].color}">${icon(k)}${RES[k].name} +${rep.got[k]}</span>`).join('');
    const hk = Object.values(rep.hkills || {}).reduce((a, b) => a + b, 0);
    addLog(`${L.short}: вернулись за ${rep.turns} ${plural(rep.turns, 'ход', 'хода', 'ходов')}, убито: ${rep.kills}.`);
    for (const l of rep.lines) addLog(l.t, l.c);
    Game.modal({
      title: `${L.short}: итоги`,
      html: `<div class="rep">${got || '<p>Ничего не привезли.</p>'}</div>
        <p>Убито: <b>${rep.kills}</b>${hk ? `, из них людей: ${hk}` : ''}. Ходов: ${rep.turns}.</p>
        ${rep.lines.length ? `<ul class="lines">${rep.lines.map(l => `<li class="${l.c || ''}">${esc(l.t)}</li>`).join('')}</ul>` : ''}`,
      buttons: [{ label: 'Наступает ночь', cls: 'primary', fn: () => this.night([]) }],
      noClose: true,
    });
  },
  siegeReport(rep) {
    const pn = S.pendingNight || { lines: [] };
    const lines = siegeLines(rep).concat(rep.lines);
    S.pendingNight = null;
    const all = pn.lines.concat(lines);
    const got = RES_ORDER.filter(k => rep.got[k]).map(k => `<span class="cc" style="--rc:${RES[k].color}">${icon(k)}${RES[k].name} +${rep.got[k]}</span>`).join('');
    Game.modal({
      title: rep.siege.won ? 'Отбились' : rep.siege.fled ? 'Пересидели' : 'Ночь кончилась',
      html: `${got ? `<div class="rep">${got}</div>` : ''}<ul class="lines">${lines.map(l => `<li class="${l.c || ''}">${esc(l.t)}</li>`).join('')}</ul>`,
      buttons: [{ label: 'Дождаться утра', cls: 'primary', fn: () => this.nightEnd(all) }],
      noClose: true,
    });
  },
  // ----- ночь -----
  night(lines) {
    const ppl = S.survivors, n = ppl.length;
    const wProd = [1, 2, 3, 5][S.build.water], fProd = [0, 1, 2, 4][S.build.garden];
    S.res.water += wProd; S.res.food += fProd;
    lines.push({ t: `Убежище дало: ${[fProd ? `еда +${fProd}` : '', `вода +${wProd}`].filter(Boolean).join(', ')}.` });
    let hungry = 0, thirsty = 0;
    for (let k = 0; k < n; k++) {
      if (S.res.food > 0) S.res.food--; else hungry++;
      if (S.res.water > 0) S.res.water--; else thirsty++;
    }
    lines.push({ t: `Съедено ${n - hungry} еды, выпито ${n - thirsty} воды.` });
    if (hungry || thirsty) {
      for (let k = 0; k < hungry; k++) { const s = pick(ppl); s.hp -= 2; }
      for (let k = 0; k < thirsty; k++) { const s = pick(ppl); s.hp -= 3; }
      lines.push({ t: `Не хватило: ${[hungry ? `еды на ${hungry}` : '', thirsty ? `воды на ${thirsty}` : ''].filter(Boolean).join(', ')}. Люди слабеют.`, c: 'bad' });
    }
    const heal = [1, 3, 5, 7][S.build.infirmary] + (S.build.infirmary && ppl.some(s => s.trait === 'medic') ? 2 : 0);
    for (const s of ppl) if (s.hp > 0 && !s.infected) s.hp = Math.min(s.maxhp, s.hp + heal);
    for (const s of ppl.slice()) {
      if (!s.infected || s.hp <= 0) continue;
      s.infected--;
      if (s.infected <= 0) {
        S.survivors = S.survivors.filter(o => o !== s);
        const other = S.survivors.length ? pick(S.survivors) : null;
        lines.push({ t: `Ночью ${s.name} ${gv(s, 'обратился', 'обратилась')}.${other ? ` ${other.name} ${gv(other, 'ранен', 'ранена')}, пока всё не кончилось.` : ''}`, c: 'bad' });
        if (other) other.hp -= 3;
      } else lines.push({ t: `${s.name}: жар. ${s.infected === 1 ? 'Без лечения — последняя ночь.' : `Осталось ${s.infected} ${plural(s.infected, 'день', 'дня', 'дней')}.`}`, c: 'bad' });
    }
    const atk = S.survivors.length ? rollAttack(lines) : null;
    if (atk) { this.alarm(atk, lines); return; }
    this.nightEnd(lines);
  },
  alarm(atk, lines) {
    S.pendingNight = { lines, atk };
    saveGame();
    Sfx.play('alarm');
    const fighters = S.survivors.filter(s => s.hp > 0).slice(0, 6);
    Game.modal({
      title: 'Ночь. Тревога!',
      html: `<p>${attackText(atk)}</p><p>Можно встретить их у стен — бой на карте базы, ${fighters.length} ${plural(fighters.length, 'боец', 'бойца', 'бойцов')} против ${atk.waves} ${plural(atk.waves, 'волны', 'волн', 'волн')}. Или запереться в насосной и надеяться на укрепления (уровень ${S.build.walls}).</p>`,
      buttons: [
        { label: 'Запереться', fn: () => { const pn = S.pendingNight; S.pendingNight = null; resolveAuto(pn.atk, pn.lines); this.nightEnd(pn.lines); } },
        { label: 'К оружию!', cls: 'hazard', fn: () => { addLog(`Ночью на базу напали: ${SIEGE_NAME[atk.kind](atk)}. Приняли бой.`, 'bad'); startMission('base', fighters.map(s => s.id), { siege: atk }); } },
      ],
      noClose: true,
    });
  },
  nightEnd(lines) {
    for (const s of S.survivors.slice()) if (s.hp <= 0) {
      S.survivors = S.survivors.filter(o => o !== s);
      lines.push({ t: `${s.name} не ${gv(s, 'пережил', 'пережила')} ночь.`, c: 'bad' });
    }
    const chanceRecruit = [0.06, 0.25, 0.4][S.build.radio];
    if (S.survivors.length && S.survivors.length < 8 && rnd() < chanceRecruit) {
      const s = newSurvivor();
      S.survivors.push(s);
      lines.push({ t: `${S.build.radio ? 'На позывной ответили.' : 'Под утро в ворота постучали.'} ${s.name} (${TRAITS[s.trait].name.toLowerCase()}) теперь с нами.`, c: 'good' });
    }
    S.day++;
    if (S.survivors.length) morningNews(lines);
    for (const l of lines) addLog(l.t, l.c);
    saveGame();
    if (!S.survivors.length) return this.gameOver();
    if (S.day > VICTORY_DAY) return this.victory();
    Game.showBase();
    Game.modal({
      title: `Утро. День ${S.day}`,
      html: `<ul class="lines">${lines.map(l => `<li class="${l.c || ''}">${esc(l.t)}</li>`).join('')}</ul>`,
      buttons: [{ label: 'В убежище', cls: 'primary', fn: () => { Game.showBase(); } }],
      noClose: true,
    });
  },
  gameOver() {
    S.over = true; saveGame();
    Game.modal({
      title: 'Убежище опустело',
      html: `<p>Группа продержалась ${S.day - 1} ${plural(S.day - 1, 'день', 'дня', 'дней')}. Ворота насосной станции так и остались открытыми.</p>`,
      buttons: [{ label: 'Начать заново', cls: 'primary', fn: () => Game.newGame() }],
      noClose: true,
    });
  },
  victory() {
    S.over = true; saveGame();
    Game.modal({
      title: 'Колонна пришла',
      html: `<p>На ${VICTORY_DAY}-й день по радио назвали точку сбора. Выжили: <b>${S.survivors.map(s => esc(s.name)).join(', ')}</b>.</p><p>Вы продержались. Можно начать заново и попробовать сохранить всех.</p>`,
      buttons: [{ label: 'Новая игра', cls: 'primary', fn: () => Game.newGame() }],
      noClose: true,
    });
  },
};
