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
const DECK = [['group', 'Группа', 'hp'], ['build', 'Постройки', 'home'], ['arms', 'Оружие', 'target'], ['craft', 'Мастерская', 'hammer'], ['fac', 'Группировки', 'shield'], ['log', 'Журнал', 'log']];
const wStat = w => { const W = WEAP[w]; return W.melee ? `урон ${W.dmg[0]}–${W.dmg[1]}, ${W.ap} ОД${W.assassin ? ', тихо' : ''}` : `урон ${W.dmg[0]}–${W.dmg[1]}, дальность ${W.range}, шум ${W.noise}`; };

const Base = {
  tab: 'group', hl: null, life: null, deckOpen: true, pick: null,
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
    const top = $('.bbar', root) ? $('.bbar', root).offsetHeight : 0, bot = $('.deck', root) ? $('.deck', root).offsetHeight : 0;
    R.cam.k = clamp(Math.round(R.H / 15.5), 22, 36);
    R.cam.cx = 20; R.cam.cy = 16.5; R.camAnim = null;
    R.panStart(0, 0); R.panTo(0, (top - bot) / 2); R.pan = null;
    R.dirty = true;
  },
  tapMap(x, y) {
    const e = R.pick(x, y);
    if (e && e.name) { Sfx.play('click'); this.open('group', e.id); return; }
    const t = R.toTile(x, y);
    const z = BASE_ZONES.find(([, x0, y0, x1, y1]) => t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1);
    if (z) { Sfx.play('click'); this.open('build', z[0]); }
  },
  open(tab, hl) {
    this.tab = tab; this.hl = hl ?? null; this.deckOpen = true;
    this.render(); this.frame();
  },
  // ----- интерфейс: карта базы сверху, внизу вкладки и лента карточек -----
  render() {
    const root = $('#scr-base');
    ensureWorld();
    if (!DECK.some(d => d[0] === this.tab)) this.tab = 'group';
    const n = S.survivors.length, tr = S.fac.collectors.tribute;
    const due = tr && !tr.paid && !S.fac.collectors.beaten ? tr.due - S.day : null;
    const strip = this.deckOpen ? this['deck_' + this.tab]() : '';
    root.innerHTML = `
      <header class="bbar">
        <div class="brand">Рубеж</div>
        <div class="day"><span>День</span><b>${S.day}</b><small>из ${VICTORY_DAY}</small></div>
        ${due != null ? `<button class="chip-tr ${due <= 0 ? 'now' : ''}" id="bTr">${icon('shield')}<span>Доля ${due <= 0 ? 'сегодня' : `через ${due} ${plural(due, 'день', 'дня', 'дней')}`}</span></button>` : ''}
        <div class="resrow">${RES_ORDER.map(k => `<span class="res ${(k === 'food' || k === 'water') && S.res[k] < n ? 'low' : ''}" title="${RES[k].name}" style="--rc:${RES[k].color}">${icon(k)}<b>${S.res[k]}</b></span>`).join('')}</div>
        <button class="hbtn" id="bSet" aria-label="Настройки">${icon('gear')}</button>
      </header>
      <div class="bview"></div>
      <section class="deck ${this.deckOpen ? 'open' : ''}">
        <div class="dtabs">
          <nav class="dt-n" role="tablist">${DECK.map(([k, l, ic]) => `<button role="tab" aria-selected="${this.deckOpen && this.tab === k}" class="${this.deckOpen && this.tab === k ? 'on' : ''}" data-tab="${k}">${icon(ic)}<span>${l}${k === 'group' ? ` <i>${n}/${GROUP_MAX}</i>` : ''}</span></button>`).join('')}</nav>
          <div class="dt-a">
            <button class="btn sq" id="bRest" title="Отдыхать до утра" aria-label="Отдыхать до утра">${icon('moon')}</button>
            <button class="btn hazard" id="bWorld">${icon('map')}<span>Карта округи</span></button>
          </div>
        </div>
        ${this.deckOpen ? `<div class="strip ${this.tab === 'log' ? 'log' : ''}" id="bStrip">${strip}</div>` : ''}
      </section>
      ${this.pick ? this.pickerHtml() : ''}`;
    $('#bSet').onclick = () => { Sfx.play('click'); Game.openSettings(); };
    $('#bWorld').onclick = () => { Sfx.init(); Sfx.play('click'); Game.showWorld(); };
    $('#bRest').onclick = () => this.rest();
    const tb = $('#bTr'); if (tb) tb.onclick = () => { Sfx.play('click'); this.open('fac'); };
    $$('.dt-n button', root).forEach(b => {
      b.onclick = () => {
        Sfx.play('click');
        const k = b.dataset.tab;
        if (this.deckOpen && this.tab === k) this.deckOpen = false; else { this.deckOpen = true; this.tab = k; }
        this.hl = null; this.render(); this.frame();
      };
    });
    $$('[data-cure]', root).forEach(b => { b.onclick = () => this.cure(+b.dataset.cure); });
    $$('[data-build]', root).forEach(b => { b.onclick = () => this.build(b.dataset.build); });
    $$('[data-craft]', root).forEach(b => { b.onclick = () => this.craft(b.dataset.craft); });
    $$('[data-slot]', root).forEach(b => { b.onclick = () => { Sfx.play('click'); this.pick = { sid: +b.dataset.sid, slot: b.dataset.slot }; this.render(); }; });
    $$('[data-scrap]', root).forEach(b => { b.onclick = () => { const w = b.dataset.scrap, k = scrapWeapon(w); if (k) { Sfx.play('build'); Game.toast(`${wName(w)}: разобрано, +${k} деталей`); addLog(`${wName(w)} разобран на детали (+${k}).`); saveGame(); } this.render(); }; });
    const pt = $('#bPay'); if (pt) pt.onclick = () => { payTribute(); this.render(); };
    $$('[data-tab-go]', root).forEach(b => { b.onclick = () => { Sfx.play('click'); this.open(b.dataset.tabGo); }; });
    if (this.pick) {
      const close = () => { this.pick = null; this.render(); };
      $('#pkBg').onclick = e => { if (e.target.id === 'pkBg') close(); };
      $('#pkClose').onclick = close;
      $$('[data-eqw]', root).forEach(b => {
        b.onclick = () => {
          const { sid, slot } = this.pick, w = b.dataset.eqw || null;
          if (equip(sid, slot, w)) { Sfx.play('pickup'); saveGame(); this.scene(); }
          this.pick = null; this.render();
        };
      });
    }
    paintAvatars(root);
    if (this.hl != null) { const el = $(`[data-hl="${this.hl}"]`, root); if (el) try { el.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* старые браузеры */ } }
  },
  // Боец: портрет слева; имя, здоровье и два слота оружия справа
  deck_group() {
    return S.survivors.map(s => {
      const hp = (s.hp / s.maxhp) * 100;
      const slot = (kind, w) => `<button class="slot ${w ? '' : 'none'}" data-slot="${kind}" data-sid="${s.id}" aria-label="${kind === 'melee' ? 'Ближний бой' : 'Огнестрел'}: ${w ? wName(w) : 'нет'}. Сменить">
          ${w ? `<canvas data-wpn="${w}" aria-hidden="true"></canvas><span>${wName(w)}</span>` : `${icon('target')}<span>без ствола</span>`}</button>`;
      return `<article class="cd sv ${this.hl === s.id ? 'hl' : ''} ${s.infected ? 'inf' : ''}" data-hl="${s.id}" style="--uc:${s.color}">
        <div class="cd-l"><canvas class="av" data-pt="${s.id}" aria-hidden="true"></canvas>${s.level > 1 ? `<span class="lvb">${icon('star')}${s.level}</span>` : ''}</div>
        <div class="cd-r">
          <div class="cd-h"><b>${esc(s.name)}</b><span class="tr" title="${esc(TRAITS[s.trait].desc)}">${TRAITS[s.trait].name}</span></div>
          <div class="hpl"><span class="bar ${hp < 40 ? 'lowhp' : ''}"><i style="width:${hp}%"></i></span><small>${s.hp}/${s.maxhp}</small></div>
          <div class="slots">${slot('melee', s.melee)}${slot('ranged', s.ranged)}</div>
          ${s.infected ? `<div class="sv-inf">${icon('bite')}<span>${s.infected === 1 ? 'обратится ночью' : `укус · ${s.infected} ${plural(s.infected, 'день', 'дня', 'дней')}`}</span>${S.build.infirmary >= 1 ? `<button class="btn sm" data-cure="${s.id}" ${S.res.meds >= cureCost() ? '' : 'disabled'}>Лечить ${cureCost()}</button>` : '<em>нужен лазарет</em>'}</div>` : ''}
        </div>
      </article>`;
    }).join('');
  },
  // Постройка: миниатюра слева; уровень, что даёт сейчас, что дальше и цена справа
  deck_build() {
    return BUILD_ORDER.map(k => {
      const B = BUILD[k], lv = S.build[k];
      let pips = '';
      for (let i = 0; i < B.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
      const cost = lv < B.max ? B.cost[lv] : null;
      return `<article class="cd bd ${this.hl === k ? 'hl' : ''}" data-hl="${k}">
        <div class="cd-l"><canvas class="thumb" data-bth="${k}" data-lv="${lv}" aria-hidden="true"></canvas></div>
        <div class="cd-r">
          <div class="cd-h"><b>${B.name}</b><span class="lv" title="Уровень ${lv} из ${B.max}">${pips}</span></div>
          <p class="now">${lv ? B.eff[lv] : 'Не построено'}</p>
          ${cost ? `<p class="next">→ ${B.eff[lv + 1]}</p><div class="cd-f"><span class="cost">${costChips(cost)}</span><button class="btn sm" data-build="${k}" ${canPay(cost) ? '' : 'disabled'}>${lv ? 'Улучшить' : 'Построить'}</button></div>` : '<p class="max">Готово полностью</p>'}
        </div>
      </article>`;
    }).join('');
  },
  // Оружие: картинка слева; сколько в запасе и у кого справа
  deck_arms() {
    ensureArsenal();
    const ars = S.arsenal, mech = hasMechanic() ? 1 : 0;
    const head = `<article class="cd note"><div class="cd-r"><b>Арсенал</b><p>Находки с вылазок лежат здесь. Выдать оружие — нажмите на слот бойца во вкладке «Группа».</p><div class="cd-f"><span></span><button class="btn sm" data-tab-go="group">К группе</button></div></div></article>`;
    return head + MELEE_W.concat(RANGED_W).map(w => {
      const holders = S.survivors.filter(s => s.melee === w || s.ranged === w).map(s => s.name), have = w === 'knife' ? '∞' : ars[w] || 0;
      return `<article class="cd wp ${!have && !holders.length ? 'off' : ''}">
        <div class="cd-l"><canvas class="wpic" data-wpn="${w}" aria-hidden="true"></canvas><span class="cnt">${have === '∞' ? 'всегда' : `запас ${have}`}</span></div>
        <div class="cd-r">
          <div class="cd-h"><b>${wName(w)}</b><small>${WKG[w]} кг</small></div>
          <p class="now">${wStat(w)}</p>
          <p class="next">${holders.length ? 'В руках: ' + holders.map(esc).join(', ') : 'Ни у кого'}</p>
          ${w !== 'knife' && ars[w] ? `<div class="cd-f"><span></span><button class="btn sm" data-scrap="${w}">Разобрать +${WSCRAP[w] + mech}</button></div>` : ''}
        </div>
      </article>`;
    }).join('');
  },
  deck_craft() {
    const lv = S.build.workshop;
    const perks = WORKSHOP_PERKS.slice(1).map((p, i) => `<li class="${lv > i ? 'on' : ''}">${p}</li>`).join('');
    return `<article class="cd note"><div class="cd-r"><b>Мастерская · ур. ${lv}</b><ul class="perks-l">${perks}</ul>${hasMechanic() ? '<p class="ok">Механик: на 1 деталь дешевле.</p>' : ''}</div></article>` + RECIPES.map(r => {
      const cost = recipeCost(r), ok = lv >= r.need, out = Object.keys(r.give)[0];
      return `<article class="cd rc2">
        <div class="cd-l"><div class="ravt" style="--rc:${RES[out].color}">${icon(out)}<b>+${r.give[out]}</b></div></div>
        <div class="cd-r">
          <div class="cd-h"><b>${r.name}</b></div>
          <p class="now">${r.desc}</p>
          <div class="cd-f"><span class="cost">${costChips(cost)}</span><button class="btn sm" data-craft="${r.id}" ${ok && canPay(cost) ? '' : 'disabled'}>${ok ? 'Сделать' : `Ур. ${r.need}`}</button></div>
        </div>
      </article>`;
    }).join('');
  },
  deck_fac() {
    return Object.keys(FACTIONS).map(f => {
      const F = FACTIONS[f], st = S.fac[f], known = st.met || st.beaten;
      const status = st.beaten ? 'разгромлены' : !st.met ? 'неизвестны' : f === 'collectors' && st.tribute ? 'требуют долю' : 'враждебны';
      let extra = '';
      if (f === 'collectors' && st.tribute && !st.beaten) {
        const tr = st.tribute, d = tr.due - S.day, when = d <= 0 ? 'этой ночью' : `через ${d} ${plural(d, 'день', 'дня', 'дней')}`;
        extra = tr.paid ? `<p class="ok">Доля отложена. Приедут ${when}.</p>` :
          `<p class="warn">Приедут ${when}. Не отдадите — налёт.</p><div class="cd-f"><span class="cost">${costChips(tr.cost)}</span><button class="btn sm" id="bPay" ${canPay(tr.cost) ? '' : 'disabled'}>Отдать</button></div>`;
      }
      return `<article class="cd fc ${st.beaten ? 'off' : ''}" data-hl="${f}" style="--fc:${F.color}">
        <div class="cd-l"><canvas class="av" data-fig="x:${F.types[F.types.length - 1]}" aria-hidden="true"></canvas></div>
        <div class="cd-r">
          <div class="cd-h"><b>${known ? F.name : '???'}</b><span class="fst">${status}</span></div>
          <p class="now">${known ? F.desc : 'О них пока ничего не известно. Слухи доходят с дорог.'}</p>
          <small class="fmeta">${st.kills ? `Убито: ${st.kills}. ` : ''}Лагерь ${isKnown(F.camp) ? 'отмечен на карте' : 'не найден'}.</small>
          ${extra}
        </div>
      </article>`;
    }).join('');
  },
  deck_log() {
    return `<ol class="journal">${S.log.map(e => `<li class="${e.c || ''}"><span>День ${e.d}</span>${esc(e.t)}</li>`).join('')}</ol>`;
  },
  // Выбор оружия для слота: карточки того, что есть
  pickerHtml() {
    const { sid, slot } = this.pick, s = S.survivors.find(o => o.id === sid);
    if (!s) { this.pick = null; return ''; }
    ensureArsenal();
    const cur = slot === 'melee' ? s.melee : s.ranged, list = slot === 'melee' ? MELEE_W : RANGED_W;
    const opts = [];
    if (slot === 'ranged') opts.push({ w: '', note: cur ? 'сдать в запас' : 'сейчас' });
    for (const w of list) {
      if (w === cur) opts.push({ w, note: 'сейчас в руках' });
      else if (w === 'knife') opts.push({ w, note: 'всегда есть' });
      else if (S.arsenal[w]) opts.push({ w, note: `в запасе: ${S.arsenal[w]}` });
    }
    const more = list.filter(w => w !== cur && w !== 'knife' && !S.arsenal[w]);
    return `<div class="pick-bg" id="pkBg"><div class="pick" role="dialog" aria-label="Выбор оружия">
      <header><canvas class="av" data-pt="${s.id}" aria-hidden="true"></canvas><div><b>${esc(s.name)}</b><span>${slot === 'melee' ? 'Ближний бой' : 'Огнестрел'}</span></div><button class="hbtn" id="pkClose" aria-label="Закрыть">${icon('close')}</button></header>
      <div class="strip">${opts.map(o => `<button class="cd wp pk ${(o.w || null) === (cur || null) ? 'cur' : ''}" data-eqw="${o.w}">
        ${o.w ? `<canvas class="wpic" data-wpn="${o.w}" aria-hidden="true"></canvas><b>${wName(o.w)}</b><small>${wStat(o.w)}</small>` : `<span class="wnone">${icon('close')}</span><b>Без огнестрела</b><small>руки свободны, рюкзак легче</small>`}
        <em>${o.note}</em></button>`).join('')}</div>
      ${more.length ? `<p class="dim">Нет в запасе: ${more.map(w => wName(w).toLowerCase()).join(', ')}. Ищите на вылазках.</p>` : ''}
    </div></div>`;
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
    if (rep.wpn && rep.wpn.length) rep.lines.unshift({ t: `Привезли оружие: ${wList(rep.wpn)}. Оно в арсенале — выдайте в панели «Оружие».`, c: 'good' });
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
        dropGear(s);
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
    const fighters = S.survivors.filter(s => s.hp > 0).slice(0, SQUAD_MAX);
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
      dropGear(s);
      lines.push({ t: `${s.name} не ${gv(s, 'пережил', 'пережила')} ночь.`, c: 'bad' });
    }
    const chanceRecruit = [0.06, 0.25, 0.4][S.build.radio];
    if (S.survivors.length && S.survivors.length < GROUP_MAX && rnd() < chanceRecruit) {
      const s = newSurvivor();
      S.survivors.push(s);
      S.stats.recruits++;
      lines.push({ t: `${S.build.radio ? 'На позывной ответили.' : 'Под утро в ворота постучали.'} ${s.name} (${TRAITS[s.trait].name.toLowerCase()}) теперь с нами.`, c: 'good' });
    }
    S.day++;
    if (S.survivors.length) { morningNews(lines); careerAdd({ bestDay: S.day }); }
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
    careerAdd({ runs: 1, bestDay: S.day - 1 });
    Game.modal({
      title: 'Убежище опустело',
      html: `<p>Группа продержалась ${S.day - 1} ${plural(S.day - 1, 'день', 'дня', 'дней')}. Ворота насосной станции так и остались открытыми.</p>`,
      buttons: [{ label: 'Начать заново', cls: 'primary', fn: () => Game.newGame() }],
      noClose: true,
    });
  },
  victory() {
    S.over = true; saveGame();
    careerAdd({ runs: 1, wins: 1, bestDay: VICTORY_DAY });
    Game.modal({
      title: 'Колонна пришла',
      html: `<p>На ${VICTORY_DAY}-й день по радио назвали точку сбора. Выжили: <b>${S.survivors.map(s => esc(s.name)).join(', ')}</b>.</p><p>Вы продержались. Можно начать заново и попробовать сохранить всех.</p>`,
      buttons: [{ label: 'Новая игра', cls: 'primary', fn: () => Game.newGame() }],
      noClose: true,
    });
  },
};
