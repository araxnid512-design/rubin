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
  addLog('Мы заняли старую насосную станцию на окраине. Стены крепкие, но еды и воды хватит дня на два.');
  addLog('Первую вылазку лучше сделать на ферму: туда можно дойти пешком.');
}

const Base = {
  tab: 'sortie', loc: 'farm',
  render() {
    const root = $('#scr-base');
    S.squad = S.squad.filter(id => S.survivors.some(s => s.id === id));
    const n = S.survivors.length;
    const tabs = [['sortie', 'Вылазка', 'walk'], ['build', 'Убежище', 'home'], ['craft', 'Мастерская', 'hammer'], ['log', 'Журнал', 'log']];
    root.innerHTML = `
      <header class="bbar">
        <div class="brand">Рубеж</div>
        <div class="day"><span>День</span><b>${S.day}</b><small>из ${VICTORY_DAY}</small></div>
        <div class="resrow">${RES_ORDER.map(k => `<span class="res ${(k === 'food' || k === 'water') && S.res[k] < n ? 'low' : ''}" title="${RES[k].name}" style="--rc:${RES[k].color}">${icon(k)}<b>${S.res[k]}</b></span>`).join('')}</div>
        <button class="hbtn" id="bSet" aria-label="Настройки">${icon('gear')}</button>
      </header>
      <main class="bmain">
        <section class="survs">
          <h2>Группа <span>${n}</span></h2>
          <p class="need">За ночь уйдёт ${n} еды и ${n} воды</p>
          <div class="slist">${S.survivors.map(s => this.card(s)).join('')}</div>
        </section>
        <section class="bpanel">
          <nav class="tabs" role="tablist">${tabs.map(([k, l, ic]) => `<button role="tab" aria-selected="${this.tab === k}" class="${this.tab === k ? 'on' : ''}" data-tab="${k}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>
          <div class="tabc">${this['tab_' + this.tab]()}</div>
          ${this.tab === 'sortie' ? this.sortieBar() : ''}
        </section>
      </main>`;
    $('#bSet').onclick = () => { Sfx.play('click'); Game.openSettings(); };
    $$('.tabs button', root).forEach(b => { b.onclick = () => { Sfx.play('click'); this.tab = b.dataset.tab; this.render(); }; });
    $$('.sc', root).forEach(b => { b.onclick = () => this.toggle(+b.dataset.id); });
    $$('[data-cure]', root).forEach(b => { b.onclick = () => this.cure(+b.dataset.cure); });
    $$('[data-loc]', root).forEach(b => { b.onclick = () => { Sfx.play('click'); this.loc = b.dataset.loc; this.render(); }; });
    $$('[data-build]', root).forEach(b => { b.onclick = () => this.build(b.dataset.build); });
    $$('[data-craft]', root).forEach(b => { b.onclick = () => this.craft(b.dataset.craft); });
    const go = $('#bGo'); if (go) go.onclick = () => this.go();
    const rest = $('#bRest'); if (rest) rest.onclick = () => this.rest();
  },
  card(s) {
    const sel = S.squad.includes(s.id), hp = (s.hp / s.maxhp) * 100;
    return `<div class="sw">
      <button class="sc ${sel ? 'sel' : ''} ${s.infected ? 'inf' : ''}" data-id="${s.id}" style="--uc:${s.color}" aria-pressed="${sel}">
        <span class="sc-top"><b>${esc(s.name)}</b><i class="trait" title="${esc(TRAITS[s.trait].desc)}">${TRAITS[s.trait].name}</i>${s.level > 1 ? `<i class="lvl">${icon('star')}${s.level}</i>` : ''}${sel ? '<i class="sq">в отряде</i>' : ''}</span>
        <span class="bar ${hp < 40 ? 'lowhp' : ''}"><i style="width:${hp}%"></i></span>
        <span class="sc-meta">${s.hp}/${s.maxhp} · ${WEAP[s.melee].name}${s.ranged ? ' и ' + WEAP[s.ranged].name.toLowerCase() : ''}</span>
        ${s.infected ? `<span class="sc-inf">${icon('bite')}Укус: ${s.infected === 1 ? 'обратится этой ночью' : `обратится через ${s.infected} ${plural(s.infected, 'день', 'дня', 'дней')}`}</span>` : ''}
      </button>
      ${s.infected ? (S.build.infirmary >= 1 ? `<button class="btn sm cure" data-cure="${s.id}" ${S.res.meds >= cureCost() ? '' : 'disabled'}>Лечить: ${cureCost()} мед.</button>` : '<span class="cure-hint">Лечить укус можно только в лазарете</span>') : ''}
    </div>`;
  },
  tab_sortie() {
    const L = LOCS[this.loc];
    return `<div class="locs">${LOC_ORDER.map(k => {
      const l = LOCS[k], locked = l.needRadio && S.build.radio < l.needRadio;
      let dng = '';
      for (let d = 0; d < 4; d++) dng += `<i class="${d < l.danger ? 'on' : ''}"></i>`;
      return `<button class="loc ${this.loc === k ? 'sel' : ''} ${locked ? 'locked' : ''}" data-loc="${k}" ${locked ? 'disabled' : ''}>
        <span class="loc-h"><b>${l.short}</b><span class="dng" title="Опасность">${dng}</span></span>
        <span class="loc-n">${l.name}</span>
        <span class="loc-m">${l.w}×${l.h} · ${l.fuel ? `топливо ${l.fuel}` : 'пешком'}</span>
        <span class="loc-l">${l.loot.map(r => `<i style="--rc:${RES[r].color}" title="${RES[r].name}">${icon(r)}</i>`).join('')}</span>
        ${locked ? '<span class="lock">Нужна радиоточка</span>' : ''}
      </button>`;
    }).join('')}</div>
    <p class="loc-d">${L.desc}</p>`;
  },
  sortieBar() {
    const L = LOCS[this.loc], sq = S.squad.map(id => S.survivors.find(s => s.id === id)).filter(Boolean);
    const fuelOk = S.res.fuel >= L.fuel;
    return `<div class="sortie-f">
      <div class="sq-list">${sq.length ? `<span>Отряд ${sq.length}/4 · ${L.short}</span><b>${sq.map(s => esc(s.name)).join(', ')}</b>` : '<span class="warn">Выберите бойцов слева, до четырёх</span>'}${!fuelOk ? '<span class="warn">Не хватает топлива</span>' : ''}</div>
      <button class="btn" id="bRest">Отдохнуть</button>
      <button class="btn hazard" id="bGo" ${sq.length && fuelOk ? '' : 'disabled'}>Выдвигаться</button>
    </div>`;
  },
  tab_build() {
    return `<div class="blds">${BUILD_ORDER.map(k => {
      const B = BUILD[k], lv = S.build[k];
      let pips = '';
      for (let i = 0; i < B.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
      const cost = lv < B.max ? B.cost[lv] : null;
      return `<div class="bld">
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
  tab_log() {
    return `<ol class="journal">${S.log.map(e => `<li class="${e.c || ''}"><span>День ${e.d}</span>${esc(e.t)}</li>`).join('')}</ol>`;
  },
  toggle(id) {
    Sfx.init(); Sfx.play('click');
    const k = S.squad.indexOf(id);
    if (k >= 0) S.squad.splice(k, 1);
    else if (S.squad.length < 4) S.squad.push(id);
    else { Game.toast('В отряде уже четверо'); return; }
    this.tab = 'sortie';
    this.render();
    saveGame();
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
    if (k === 'radio' && S.build.radio === 1) addLog('В эфире нашлась больница на юге города. Теперь туда можно съездить.', 'good');
    Sfx.play('bash');
    Game.toast(`${B.name}: уровень ${S.build[k]}`);
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
  go() {
    Sfx.init();
    const L = LOCS[this.loc];
    if (!S.squad.length || S.res.fuel < L.fuel) return;
    addLog(`Вылазка: ${L.name}. Отряд: ${S.squad.map(id => S.survivors.find(s => s.id === id).name).join(', ')}.`);
    startMission(this.loc, S.squad.slice());
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
    const L = LOCS[rep.loc];
    const got = RES_ORDER.filter(k => rep.got[k]).map(k => `<span class="cc" style="--rc:${RES[k].color}">${icon(k)}${RES[k].name} +${rep.got[k]}</span>`).join('');
    addLog(`${L.short}: вернулись за ${rep.turns} ${plural(rep.turns, 'ход', 'хода', 'ходов')}, убито зомби: ${rep.kills}.`);
    for (const l of rep.lines) addLog(l.t, l.c);
    Game.modal({
      title: `${L.short}: итоги`,
      html: `<div class="rep">${got || '<p>Ничего не привезли.</p>'}</div>
        <p>Убито зомби: <b>${rep.kills}</b>. Ходов: ${rep.turns}.</p>
        ${rep.lines.length ? `<ul class="lines">${rep.lines.map(l => `<li class="${l.c || ''}">${esc(l.t)}</li>`).join('')}</ul>` : ''}`,
      buttons: [{ label: 'Наступает ночь', cls: 'primary', fn: () => this.night([]) }],
      noClose: true,
    });
  },
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
    const p = clamp(0.12 + S.day * 0.012 - S.build.walls * 0.06, 0.03, 0.45);
    if (S.survivors.length && rnd() < p) {
      const w = S.build.walls;
      if (w >= 1 && chance(0.35 + w * 0.15)) lines.push({ t: 'Ночью у ворот бродила стая. Укрепления выдержали.', c: 'good' });
      else {
        const v = pick(S.survivors), d = Math.max(1, rint(2, 6) - w * 2);
        const lf = Math.min(S.res.food, rint(1, 3)), lp = Math.min(S.res.parts, rint(0, 2));
        v.hp -= d; S.res.food -= lf; S.res.parts -= lp;
        lines.push({ t: `Ночной набег. ${v.name} ${gv(v, 'ранен', 'ранена')} (−${d}). Пропало: еда ${lf}${lp ? `, детали ${lp}` : ''}.`, c: 'bad' });
      }
    }
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
    for (const l of lines) addLog(l.t, l.c);
    saveGame();
    if (!S.survivors.length) return this.gameOver();
    if (S.day > VICTORY_DAY) return this.victory();
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
