'use strict';
// ---------- Запуск, экраны, настройки, сохранения ----------

const SETTINGS_KEY = 'rubezh.settings.v1', SAVE_KEY = 'rubezh.save.v1', HELP_KEY = 'rubezh.help.v1';
const DEF_CFG = { ui: 1, lefty: false, confirmMove: true, speed: 1, sound: true, vol: 0.7, vibro: true, shake: true, follow: true, hq: true, autoRotate: true };
let CFG = Object.assign({}, DEF_CFG, store.get(SETTINGS_KEY) || {});
let S = null;
const APP = { rot: false, vw: 0 };

// Координаты экрана -> координаты интерфейса (учитывает принудительный поворот)
function toApp(cx, cy) { return APP.rot ? { x: cy, y: APP.vw - cx } : { x: cx, y: cy }; }

// ----- Сохранение -----
function u8ToB64(a) { let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
function b64ToU8(b) { const s = atob(b), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function serMission(m) {
  const o = {};
  for (const k in m) {
    if (k === 'vis' || k === 'zocc' || k === 'uocc') continue;
    const v = m[k];
    if (v instanceof Uint8Array) o[k] = { b64: u8ToB64(v) };
    else if (k === 'units' || k === 'zombies') o[k] = v.map(e => { const c = Object.assign({}, e); delete c.anim; return c; });
    else o[k] = v;
  }
  return o;
}
function deMission(o) {
  const m = {};
  for (const k in o) m[k] = o[k] && o[k].b64 != null ? b64ToU8(o[k].b64) : o[k];
  m.vis = new Uint8Array(m.n);
  return m;
}
function serialize() { const o = Object.assign({}, S); if (S.mission) o.mission = serMission(S.mission); return o; }
function restore(o) {
  if (!o || o.v !== 1 || !Array.isArray(o.survivors)) return null;
  try { if (o.mission) o.mission = deMission(o.mission); } catch (e) { o.mission = null; }
  return o;
}
function saveGame() { if (S) store.set(SAVE_KEY, serialize()); }

// ----- Ориентация и размеры -----
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  let coarse = false;
  try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { /* нет поддержки */ }
  const portrait = h > w * 1.05;
  const rot = portrait && coarse && CFG.autoRotate;
  const app = $('#app');
  APP.rot = rot; APP.vw = w;
  document.body.classList.toggle('rot', rot);
  if (rot) { app.style.width = h + 'px'; app.style.height = w + 'px'; app.style.transform = `translateX(${w}px) rotate(90deg)`; }
  else { app.style.width = ''; app.style.height = ''; app.style.transform = ''; }
  $('#rot-hint').hidden = !(portrait && coarse && !CFG.autoRotate);
  HUD.hidePop();
  R.resize();
}
function applySettings() {
  document.documentElement.style.fontSize = (15 * CFG.ui).toFixed(2) + 'px';
  document.body.classList.toggle('lefty', !!CFG.lefty);
  Sfx.setVol();
  layout();
  if (TAC.m) HUD.refresh();
}
function saveSettings() { store.set(SETTINGS_KEY, CFG); applySettings(); }

const Game = {
  init(data) {
    R.init($('#cv'));
    HUD.build();
    applySettings();
    window.addEventListener('resize', () => layout());
    window.addEventListener('orientationchange', () => setTimeout(layout, 150));
    document.addEventListener('visibilitychange', () => { if (document.hidden && S && (!TAC.m || TAC.m.phase === 'player')) saveGame(); });
    document.addEventListener('keydown', e => this.key(e));
    document.addEventListener('pointerdown', () => Sfx.init(), { once: true });
    const hot = data && data.save ? restore(data.save) : null;
    S = hot || restore(store.get(SAVE_KEY));
    if (hot && !S.over) { if (S.mission) resumeMission(S.mission); else this.showBase(); }
    else this.showMenu();
  },
  show(id) {
    for (const s of $$('.screen')) s.hidden = s.id !== id;
    HUD.hidePop();
  },
  showMenu() {
    this.show('scr-menu');
    R.mode = 'menu';
    if (!R.menu) R.setMenuMap();
    R.dirty = true;
    const can = S && !S.over;
    $('#scr-menu').innerHTML = `
      <div class="menu-in">
        <h1 class="logo">Рубеж</h1>
        <p class="tagline">Небольшая группа, насосная станция на окраине и город, полный мёртвых. Каждый выстрел слышно за квартал.</p>
        <div class="mbtns">
          ${can ? `<button class="btn hazard big" id="mCont">${icon('play')}Продолжить · день ${S.day}</button>` : ''}
          <button class="btn ${can ? '' : 'hazard big'}" id="mNew">Новая игра</button>
          <button class="btn" id="mHelp">Как играть</button>
          <button class="btn" id="mSet">${icon('gear')}Настройки</button>
        </div>
        <p class="ver">Пошаговая тактика · карты до 64×64 клеток · сохранение в этом браузере</p>
      </div>`;
    if (can) $('#mCont').onclick = () => { Sfx.init(); if (S.mission) resumeMission(S.mission); else this.showBase(); };
    $('#mNew').onclick = () => {
      Sfx.init();
      if (can) this.modal({ title: 'Начать заново?', html: `<p>Текущая игра (день ${S.day}) будет удалена.</p>`, buttons: [{ label: 'Отмена' }, { label: 'Новая игра', cls: 'danger', fn: () => this.newGame() }] });
      else this.newGame();
    };
    $('#mHelp').onclick = () => this.help();
    $('#mSet').onclick = () => this.openSettings();
  },
  showBase() {
    TAC.m = null;
    R.mode = null;
    this.show('scr-base');
    Base.render();
  },
  showTac(center) {
    this.show('scr-tac');
    R.mode = 'tac';
    R.resize();
    if (center) {
      R.cam.ts = clamp(Math.round(R.H / 10), 30, 56);
      const u = curUnit();
      if (u) R.centerOn(u.x, u.y - 2, true);
    }
    refreshReach();
    HUD.refresh();
    if (!store.get(HELP_KEY)) { store.set(HELP_KEY, 1); this.help(); }
  },
  afterMission(rep) {
    this.showBase();
    saveGame();
    Base.missionReport(rep);
  },
  newGame() {
    store.del(SAVE_KEY);
    newGameState();
    Base.tab = 'sortie'; Base.loc = 'farm';
    saveGame();
    this.showBase();
  },
  key(e) {
    if (e.key === 'Escape') {
      const md = $$('#modals .modal-bg');
      if (md.length) { md[md.length - 1].remove(); return; }
      if (!$('#tLootBg').hidden) { HUD.closeLoot(); return; }
      if (!$('#tMapBg').hidden) { HUD.closeMap(); return; }
      HUD.hidePop(); TAC.pend = null; TAC.mode = null; R.dirty = true;
      return;
    }
    if (R.mode !== 'tac' || $$('#modals .modal-bg').length || !$('#tLootBg').hidden) return;
    if (e.key === 'Tab') { e.preventDefault(); nextUnit(); }
    else if (e.key === 'Enter' && !e.target.closest('button')) endTurn();
  },
  modal({ title, html, buttons = [{ label: 'Понятно', cls: 'primary' }], noClose = false }) {
    const bg = el(`<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="mb">${html}</div><div class="mf"></div></div></div>`);
    const close = () => bg.remove();
    for (const b of buttons) {
      const btn = el(`<button class="btn ${b.cls || ''}">${esc(b.label)}</button>`);
      btn.onclick = () => { Sfx.play('click'); close(); if (b.fn) b.fn(); };
      $('.mf', bg).appendChild(btn);
    }
    if (!noClose) bg.addEventListener('click', e => { if (e.target === bg) close(); });
    $('#modals').appendChild(bg);
    const last = $('.mf .btn:last-child', bg);
    if (last) try { last.focus({ preventScroll: true }); } catch (e) { /* ок */ }
    return { el: bg, close };
  },
  toastT: 0,
  toast(text) {
    const t = $('#toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { t.hidden = true; }, 1900);
  },
  help() {
    this.modal({
      title: 'Как играть',
      html: `<ul class="help">
        <li><b>Касание бойца</b> выбирает его. <b>Касание клетки</b> показывает путь и цену в очках действий (ОД), второе касание — идти.</li>
        <li><b>Касание зомби</b> открывает атаку: удар вплотную или выстрел с шансом попадания.</li>
        <li><b>Шум решает всё.</b> Выстрел слышно за 13–20 клеток, и все зомби в этом кольце пойдут на звук. Нож по зомби без значка над головой убивает бесшумно.</li>
        <li>Значок <b>?</b> — зомби идёт на шум, <b>!</b> — видит вас. В посевах и кустах вас видно только вплотную.</li>
        <li><b>Засада</b> тратит все ОД: боец выстрелит в первого, кто покажется в ход зомби.</li>
        <li>Каждые 7 ходов или от сильного шума растёт <b>угроза</b>, с краёв карты приходят новые зомби. С 15-го хода сумерки, с 25-го ночь.</li>
        <li><b>Жёлтые ромбы</b> — несобранная добыча. Обыск стоит 2 ОД, унести можно сколько позволяет вес.</li>
        <li>Чтобы уехать, дойдите до <b>зелёной зоны у машины</b> и нажмите «В машину».</li>
        <li><b>Укус</b> — три дня до обращения. Лечится медикаментами в лазарете.</li>
        <li>Карта: перетаскивание — сдвиг, два пальца — масштаб, кнопка карты — обзор всей местности.</li>
      </ul>`,
    });
  },
  openSettings() {
    const tg = (id, label, sub) => `<label for="${id}">${label}${sub ? `<small>${sub}</small>` : ''}</label><input type="checkbox" class="tgl" id="${id}" ${CFG[id.slice(2)] ? 'checked' : ''}>`;
    const speeds = ['Медленно', 'Обычно', 'Быстро', 'Сразу'];
    const fsOk = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    const md = this.modal({
      title: 'Настройки',
      html: `<div class="set">
        <label for="s-ui">Размер интерфейса<small id="s-ui-v">${Math.round(CFG.ui * 100)}%</small></label><input type="range" id="s-ui" min="0.8" max="1.4" step="0.05" value="${CFG.ui}">
        ${tg('s-lefty', 'Для левой руки', 'кнопки действий слева, отряд справа')}
        ${tg('s-confirmMove', 'Ход вторым касанием', 'защищает от случайных шагов')}
        <label>Скорость анимации</label><div class="seg" id="s-speed">${speeds.map((s, i) => `<button data-v="${i}" class="${CFG.speed === i ? 'on' : ''}">${s}</button>`).join('')}</div>
        ${tg('s-sound', 'Звук')}
        <label for="s-vol">Громкость</label><input type="range" id="s-vol" min="0" max="1" step="0.05" value="${CFG.vol}">
        ${tg('s-vibro', 'Вибрация', 'при ранениях и укусах')}
        ${tg('s-shake', 'Тряска экрана')}
        ${tg('s-follow', 'Камера к атакам', 'показывать, кого атакуют')}
        ${tg('s-hq', 'Чёткая графика', 'выключите, если телефон греется')}
        ${tg('s-autoRotate', 'Поворачивать интерфейс', 'если телефон держат вертикально')}
      </div>
      ${fsOk ? '<button class="btn" id="s-fs">' + icon('full') + 'Во весь экран</button>' : ''}
      <button class="btn danger sm" id="s-reset">Стереть сохранение</button>`,
      buttons: [{ label: 'Готово', cls: 'primary' }],
    });
    const root = md.el;
    $('#s-ui', root).oninput = e => { CFG.ui = +e.target.value; $('#s-ui-v', root).textContent = Math.round(CFG.ui * 100) + '%'; saveSettings(); };
    $('#s-vol', root).oninput = e => { CFG.vol = +e.target.value; saveSettings(); };
    $('#s-vol', root).onchange = () => { Sfx.init(); Sfx.play('shot'); };
    for (const k of ['lefty', 'confirmMove', 'sound', 'vibro', 'shake', 'follow', 'hq', 'autoRotate']) {
      $('#s-' + k, root).onchange = e => { CFG[k] = e.target.checked; saveSettings(); if (k === 'vibro' && CFG.vibro) vibrate(40); };
    }
    $$('#s-speed button', root).forEach(b => { b.onclick = () => { CFG.speed = +b.dataset.v; $$('#s-speed button', root).forEach(x => x.classList.toggle('on', x === b)); saveSettings(); }; });
    const fs = $('#s-fs', root);
    if (fs) fs.onclick = () => {
      const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
      try {
        const p = req.call(d, { navigationUI: 'hide' });
        const lock = () => { try { const q = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (q && q.catch) q.catch(() => {}); } catch (e) { /* нет блокировки */ } };
        if (p && p.then) p.then(lock).catch(() => this.toast('Здесь полноэкранный режим недоступен')); else lock();
      } catch (e) { this.toast('Здесь полноэкранный режим недоступен'); }
    };
    $('#s-reset', root).onclick = () => {
      md.close();
      this.modal({
        title: 'Стереть сохранение?', html: '<p>Прогресс пропадёт. Настройки останутся.</p>',
        buttons: [{ label: 'Отмена' }, { label: 'Стереть', cls: 'danger', fn: () => { store.del(SAVE_KEY); S = null; TAC.m = null; this.showMenu(); } }],
      });
    };
  },
};

// ----- Старт (с поддержкой живого обновления страницы) -----
(function boot() {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) { try { hot.snapshot(() => ({ save: S ? serialize() : null })); } catch (e) { /* нет поддержки */ } }
  const start = data => Game.init(data || {});
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
