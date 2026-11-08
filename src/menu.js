'use strict';
// ---------- Главное меню: живая сцена, справочник, статистика ----------

const CAREER_KEY = 'rubezh.career.v1';

// ----- сцена за меню: сумеречная улица, костры, бредущие мертвецы -----
const MenuScene = {
  timer: 0,
  build() {
    const { m } = genMap('suburb', 4242);
    m.seen = new Uint8Array(m.n).fill(1); m.vis = new Uint8Array(m.n).fill(1);
    m.units = []; m.zombies = []; m.turn = 1; m.tod = 1; m.fires = [];
    const b = m.buildings[Math.min(2, m.buildings.length - 1)] || { x: 30, y: 30, w: 4, h: 4 };
    const cx = b.x + b.w * 0.2, cy = b.y + b.h * 0.6;
    const r = makeRng(77);
    const walk = (x, y) => inb(m, x, y) && TP[m.tiles[MI(m, x, y)]].walk && m.tiles[MI(m, x, y)] !== T.DOOR;
    // горящие бочки и костры поблизости от камеры
    for (let k = 0, made = 0; k < 400 && made < 4; k++) {
      const x = Math.round(cx + r.int(-12, 12)), y = Math.round(cy + r.int(-10, 10));
      if (!walk(x, y) || m.ground[MI(m, x, y)] !== T.ASPHALT && m.ground[MI(m, x, y)] !== T.SIDEWALK) continue;
      if (m.fires.some(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y) < 6)) continue;
      m.props.push({ k: 'campfire', x, y, w: 1, h: 1 }); m.tiles[MI(m, x, y)] = T.BLOCK; m.fires.push([x, y]);
      made++;
    }
    const ents = [];
    for (let k = 0, made = 0; k < 600 && made < 7; k++) {
      const x = Math.round(cx + r.int(-14, 14)), y = Math.round(cy + r.int(-12, 12));
      if (!walk(x, y) || ents.some(it => it.e.x === x && it.e.y === y)) continue;
      const type = ['walker', 'walker', 'walker', 'runner', 'brute', 'screamer', 'walker'][made];
      ents.push({ e: { type, id: made, x, y, f: r.int(0, 7), goal: null }, z: true });
      made++;
    }
    R.menu = { m, ents, cam: { cx, cy, k: clamp(R.H / 9, 30, 70), rot: 1 }, base: { cx, cy }, t0: performance.now() };
    for (const it of ents) Spr.warm(Spr.look(it.e, 'z'), ['i0', 'i1', 'w0', 'w1', 'w2', 'w3', 'w4', 'w5']);
  },
  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.step(), 900);
  },
  stop() { clearInterval(this.timer); this.timer = 0; },
  step() {
    const M = R.menu;
    if (R.mode !== 'menu' || !M || document.hidden) return;
    const m = M.m, now = performance.now();
    const walk = (x, y) => inb(m, x, y) && TP[m.tiles[MI(m, x, y)]].walk && m.tiles[MI(m, x, y)] !== T.DOOR;
    for (const it of M.ents) {
      const e = it.e;
      if (e.anim && now - e.anim.t0 < e.anim.d) continue;
      if (Math.random() < 0.35) continue;
      if (!e.goal || (e.goal[0] === e.x && e.goal[1] === e.y) || Math.random() < 0.05) e.goal = [Math.round(M.base.cx + rint(-14, 14)), Math.round(M.base.cy + rint(-12, 12))];
      let best = null, bd = edist(e.x, e.y, e.goal[0], e.goal[1]);
      for (const [dx, dy] of DIR8) {
        const nx = e.x + dx, ny = e.y + dy;
        if (!walk(nx, ny) || (dx && dy && (!walk(e.x + dx, e.y) || !walk(e.x, e.y + dy)))) continue;
        if (M.ents.some(o => o !== it && o.e.x === nx && o.e.y === ny)) continue;
        const d = edist(nx, ny, e.goal[0], e.goal[1]) + Math.random() * 0.8;
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      if (best) animTo(e, best[0], best[1], e.type === 'runner' ? 900 : 1700);
      else e.goal = null;
    }
  },
};

// ----- статистика -----
function ensureStats() {
  S.stats = Object.assign({ missions: 0, sieges: 0, siegesWon: 0, zk: 0, hk: 0, rescued: 0, lost: 0, weapons: 0, recruits: 0, locs: [] }, S.stats || {});
}
function career() { return Object.assign({ runs: 0, wins: 0, bestDay: 0, missions: 0, zk: 0, hk: 0, rescued: 0, lost: 0 }, store.get(CAREER_KEY) || {}); }
function careerAdd(o) { const c = career(); for (const k in o) c[k] = k === 'bestDay' ? Math.max(c[k], o[k]) : c[k] + o[k]; store.set(CAREER_KEY, c); }
// Итоги вылазки или обороны — в статистику
function statMission(rep, m) {
  ensureStats();
  const st = S.stats, hk = Object.values(rep.hkills || {}).reduce((a, b) => a + b, 0), zk = Math.max(0, rep.kills - hk);
  const lost = m.units.filter(u => u.dead).length, rescued = rep.rescued || 0;
  if (rep.siege) { st.sieges++; if (rep.siege.won) st.siegesWon++; } else { st.missions++; if (!st.locs.includes(rep.loc)) st.locs.push(rep.loc); }
  st.zk += zk; st.hk += hk; st.lost += lost; st.rescued += rescued; st.weapons += (rep.wpn || []).length;
  careerAdd({ missions: rep.siege ? 0 : 1, zk, hk, lost, rescued });
}

// ----- справочник -----
const ZDESC = {
  walker: 'Медленный и упрямый. Идёт на шум, ломится в двери, кусает, если подпустить.',
  runner: 'Свежий, быстрый, почти не устаёт. Догоняет того, кто решил убежать.',
  screamer: 'Увидев живых, кричит — и сюда идёт всё, что слышало.',
  brute: 'Огромный, в рабочем жилете. Держит много попаданий и выбивает двери за пару ударов.',
};
const Codex = {
  tab: 'z',
  open() {
    const md = Game.modal({ title: 'Справочник', html: '<div class="cx"><nav class="cx-t" role="tablist"></nav><div class="cx-b"></div></div>', buttons: [{ label: 'Закрыть', cls: 'primary' }] });
    md.el.querySelector('.modal').classList.add('wide');
    this.md = md;
    this.render();
  },
  render() {
    const root = this.md.el, tabs = [['z', 'Мертвецы'], ['h', 'Группировки'], ['w', 'Оружие'], ['t', 'Черты'], ['x', 'Погода']];
    $('.cx-t', root).innerHTML = tabs.map(([k, l]) => `<button role="tab" aria-selected="${this.tab === k}" class="${this.tab === k ? 'on' : ''}" data-cx="${k}">${l}</button>`).join('');
    $$('[data-cx]', root).forEach(b => { b.onclick = () => { Sfx.play('click'); this.tab = b.dataset.cx; this.render(); }; });
    let html = '';
    if (this.tab === 'z') html = ['walker', 'runner', 'screamer', 'brute'].map(k => {
      const z = ZT[k];
      return this.card(`z:${k}`, z.name, `${z.hp} здоровья · ${z.ap} ОД · урон ${z.dmg[0]}–${z.dmg[1]} · видит на ${z.sight} · укус ${Math.round(z.bite * 100)}%`, ZDESC[k]);
    }).join('');
    else if (this.tab === 'h') html = Object.keys(FACTIONS).map(f => {
      const F = FACTIONS[f], st = S && S.fac ? S.fac[f] : null, known = !S || !st || st.met || st.beaten;
      const types = [...new Set(F.types)].map(t => ZT[t]);
      return this.card(`x:${F.types[F.types.length - 1]}`, known ? F.name : '???', types.map(t => `${t.name}: ${t.hp} здоровья, ${t.ranged ? WEAP[t.ranged].name.toLowerCase() : WEAP[t.melee].name.toLowerCase()}`).join(' · '), known ? F.desc : 'О них пока ничего не известно.', F.color);
    }).join('');
    else if (this.tab === 'w') html = Object.keys(WEAP).map(k => {
      const W = WEAP[k];
      const s = W.melee ? `ближний бой · ${W.ap} ОД · урон ${W.dmg[0]}–${W.dmg[1]} · шум ${W.noise}` : `${W.ap} ОД · урон ${W.dmg[0]}–${W.dmg[1]} · дальность ${W.range} · точность ${Math.round(W.acc * 100)}% · шум ${W.noise}`;
      const d = { knife: 'Тихо убивает тех, кто вас не видит.', bat: 'Надёжная и громкая.', crowbar: 'Удобна, вскрывает что угодно.', axe: 'Самый сильный удар, но дольше замах.', pistol: 'С глушителем из мастерской почти не слышен.', shotgun: 'Страшен вплотную, бесполезен издалека.', rifle: 'Бьёт далеко и точно. Слышно на полкарты.' }[k];
      return this.card(null, W.name, s, `${d} Вес ${WKG[k]} кг.`);
    }).join('');
    else if (this.tab === 't') html = Object.keys(TRAITS).map(k => this.card(null, TRAITS[k].name, '', TRAITS[k].desc)).join('');
    else html = Object.keys(WEATHER).map(k => this.card(null, WEATHER[k].name, '', WEATHER[k].desc, null, WEATHER[k].icon)).join('');
    $('.cx-b', root).innerHTML = html;
    $$('canvas[data-fig]', root).forEach(cv => { try { drawFigure(cv, cv.dataset.fig); } catch (e) { console.error(e); } });
  },
  card(fig, name, stats, desc, col, ic) {
    return `<div class="cx-c" ${col ? `style="--fc:${col}"` : ''}>
      ${fig ? `<canvas class="cx-f" data-fig="${fig}" aria-hidden="true"></canvas>` : ic ? `<span class="cx-i">${icon(ic)}</span>` : ''}
      <div><b>${esc(name)}</b>${stats ? `<small>${esc(stats)}</small>` : ''}<p>${esc(desc)}</p></div></div>`;
  },
};
// Фигура для справочника: «z:тип» — мертвец, «x:тип» — человек группировки
function drawFigure(cv, spec) {
  const [kind, type] = spec.split(':');
  const dpr = Math.min(3, window.devicePixelRatio || 1), W = cv.clientWidth || 56, H = cv.clientHeight || 72;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L = Spr.look({ type, id: kind === 'x' ? 1 : 0 }, 'z'), ts = H * 1.2;
  const save = R.dpr; R.dpr = dpr;
  Spr.draw(c, L, 'i0', 3, W * 0.5, H * 0.97, ts, 8);
  R.dpr = save;
}

// ----- окно статистики -----
function openStats() {
  const c = career(), st = S && !S.over ? (ensureStats(), S.stats) : null;
  const tile = (n, l) => `<div class="st-t"><b>${n}</b><span>${l}</span></div>`;
  const run = st ? `<h3>Эта игра · день ${S.day}</h3><div class="st-g">
      ${tile(S.survivors.length, 'в группе')}${tile(st.missions, 'вылазок')}${tile(st.locs.length + ' из ' + LOC_ORDER.length, 'мест посетили')}
      ${tile(st.zk, 'мертвецов упокоено')}${tile(st.hk, 'людей убито')}${tile(`${st.siegesWon}/${st.sieges}`, 'атак на базу отбито')}
      ${tile(st.rescued, 'пленных спасено')}${tile(st.lost, 'погибло своих')}${tile(st.weapons, 'стволов найдено')}
    </div>` : '<p class="dim">Сейчас нет начатой игры.</p>';
  Game.modal({
    title: 'Статистика',
    html: `<div class="stats">${run}<h3>За всё время</h3><div class="st-g">
      ${tile(c.runs, 'игр сыграно')}${tile(c.wins, 'раз дождались колонны')}${tile(c.bestDay, 'лучший день')}
      ${tile(c.missions, 'вылазок')}${tile(c.zk, 'мертвецов')}${tile(c.hk, 'людей')}
    </div></div>`,
    buttons: [{ label: 'Закрыть', cls: 'primary' }],
  });
}
