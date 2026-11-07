/* Корневой контроллер интерфейса: титульный экран, панель ресурсов, вкладки, модальные окна. */
(function (G) {
  'use strict';
  const { h, svg, clear } = G.Dom;
  const U = G.U;

  const UI = G.UI = G.UI || {};
  UI.s = null;
  UI.tab = 'hq';
  UI.builder = null;
  UI.views = UI.views || {};
  UI.modals = UI.modals || {};
  UI.toast = null;

  UI.TABS = [
    { id: 'hq', name: 'Штаб', icon: '◉' },
    { id: 'roster', name: 'Отряд', icon: '☰' },
    { id: 'map', name: 'Карта', icon: '⌖' },
    { id: 'base', name: 'Лагерь', icon: '⌂' },
    { id: 'chron', name: 'Хроника', icon: '✎' },
    { id: 'menu', name: 'Меню', icon: '⚙' },
  ];

  // Сохранить и перерисовать
  UI.commit = function () {
    if (UI.s && UI.checkMedals) UI.checkMedals(UI.s);
    if (UI.s) G.Save.write('auto', UI.s);
    UI.render();
  };

  UI.start = function (s) {
    UI.s = s;
    UI.tab = 'hq';
    UI.builder = null;
    UI.commit();
    window.scrollTo(0, 0);
  };

  UI.go = function (tab) {
    UI.tab = tab;
    UI.render();
    window.scrollTo(0, 0);
  };

  UI.render = function () {
    const top = document.getElementById('topbar');
    const tabs = document.getElementById('tabs');
    const view = document.getElementById('view');
    clear(top); clear(tabs); clear(view);
    if (!UI.s) {
      top.classList.add('hidden');
      tabs.classList.add('hidden');
      view.appendChild(UI.titleScreen());
      renderModal();
      return;
    }
    top.classList.remove('hidden');
    tabs.classList.remove('hidden');
    top.appendChild(UI.topBar(UI.s));
    for (const t of UI.TABS) {
      tabs.appendChild(h('button', { class: 'tab' + (UI.tab === t.id ? ' active' : ''), onclick: () => UI.go(t.id) },
        h('span', { class: 'ti' }, t.icon), h('span', null, t.name)));
    }
    const fn = UI.views[UI.tab] || UI.views.hq;
    // карточки «выезжают» только при смене вкладки, а не при каждом нажатии
    const tabKey = UI.tab + ':' + (UI.tab === 'menu' ? UI.menuTab : '');
    view.classList.toggle('anim', tabKey !== UI._lastTabKey);
    UI._lastTabKey = tabKey;
    view.appendChild(fn(UI.s));
    renderModal();
  };
  // Музыка: в бою — боевая тема, в остальное время — пустынная
  function syncMusic() { if (G.Audio) G.Audio.music(UI._bv ? 'battle' : 'desert'); }

  function renderModal() {
    const root = document.getElementById('modal-root');
    clear(root);
    const s = UI.s;
    let content = null;
    if (UI.overlay) content = UI.overlay();
    else if (s && s.pending && UI.modals[s.pending.kind]) content = UI.modals[s.pending.kind](s);
    else if (s && s.over && !UI.overSeen) content = UI.modals.over(s);
    syncMusic();
    // вызов по связи — когда открывается новое событие или тревога
    const key = s && s.pending && (s.pending.kind === 'event' || s.pending.kind === 'battle') ? s.pending.kind + ':' + s.day + ':' + (s.pending.id || '') + ':' + (s.pending.result != null) : null;
    if (key && key !== UI._lastAlert && !(s.pending.result != null)) { UI._lastAlert = key; if (G.Audio) G.Audio.sfx('alert'); }
    if (content) {
      // окно выезжает только когда открывается новое, а не при каждом нажатии внутри
      const mkey = UI.overlay ? 'overlay' : s && s.pending ? s.pending.kind + ':' + (s.pending.id || '') + ':' + s.day : 'over';
      if (mkey !== UI._lastModal && content.classList) content.classList.add('enter');
      UI._lastModal = mkey;
      root.appendChild(h('div', { class: 'overlay' }, content));
      document.body.style.overflow = 'hidden';
    } else {
      UI._lastModal = null;
      document.body.style.overflow = '';
    }
  }
  UI.renderModal = renderModal;

  // ---------- Панель ресурсов ----------
  UI.topBar = function (s) {
    const days = G.Day.waterDaysLeft(s);
    const fit = G.Units.people(s).filter((u) => G.Units.isFit(s, u)).length;
    const ppl = G.Units.people(s).length;
    const dr = G.Units.droids(s).length;
    // Всплывающие изменения: +87 / −108 над ресурсом, если он изменился с прошлого кадра
    const prev = UI._prevRes && UI._prevSeed === s.seed ? UI._prevRes : null;
    const cur = { water: s.res.water, scrap: s.res.scrap, energy: s.res.energy, credits: s.res.credits, discipline: s.res.discipline, troops: fit, droid: dr };
    UI._prevRes = cur;
    UI._prevSeed = s.seed;
    const chip = (ico, label, value, cls, title) => {
      const el = h('span', { class: 'chip ' + (cls || ''), title: title || label }, h('i', { class: 'ico ico-' + ico }), h('span', { class: 'lbl' }, label), value);
      const key = ico === 'troops' || ico === 'droid' ? ico : ico;
      if (prev && prev[key] != null && cur[key] !== prev[key]) {
        const d = cur[key] - prev[key];
        el.classList.add('bump');
        el.appendChild(h('span', { class: 'float ' + (d > 0 ? 'pos' : 'neg') }, U.signed(d)));
      }
      return el;
    };
    return h('div', { class: 'top-row' },
      h('span', { class: 'top-day' }, 'День ' + s.day),
      h('div', { class: 'chips' },
        chip('water', 'Вода', s.res.water + (days < 99 ? ' · ' + days.toFixed(1) + ' дн' : ''), days < 2 ? 'alert' : days < 4 ? 'caution' : '', 'Вода (запас в днях при нынешнем расходе)'),
        chip('scrap', 'Металл', s.res.scrap),
        chip('energy', 'Энергия', s.res.energy + '/' + G.Res.energyCap(s), s.droidsOffline ? 'alert' : ''),
        chip('credits', 'Кредиты', s.res.credits),
        chip('discipline', 'Дисциплина', s.res.discipline, s.res.discipline < G.CONFIG.discipline.lowThreshold ? 'alert' : s.res.discipline < 50 ? 'caution' : ''),
        chip('troops', 'Бойцы', fit + '/' + ppl, '', 'В строю / всего людей'),
        chip('droid', 'Дроиды', dr)
      ),
      G.Audio && G.Audio.available() ? h('button', { class: 'snd-btn', title: G.Audio.prefs.mute ? 'Включить звук' : 'Выключить звук',
        onclick: () => { G.Audio.set('mute', !G.Audio.prefs.mute); UI.render(); } }, G.Audio.prefs.mute ? '🔇' : '🔊') : null
    );
  };

  // ---------- Титульный экран ----------
  function emblem() {
    // Условная эмблема: два солнца над дюнами
    return svg('svg', { viewBox: '0 0 100 100', class: 'title-emblem' },
      svg('circle', { cx: 50, cy: 50, r: 47, fill: '#16181c', stroke: '#d9a85b', 'stroke-width': 2 }),
      svg('circle', { cx: 40, cy: 40, r: 11, fill: '#f3cd8c' }),
      svg('circle', { cx: 62, cy: 33, r: 7, fill: '#e2874c' }),
      svg('path', { d: 'M8 66 Q 28 54 46 64 T 92 60 L 92 80 Q 50 100 8 80 Z', fill: '#b9884a' }),
      svg('path', { d: 'M8 74 Q 30 66 52 74 T 92 70 L 92 84 Q 50 102 8 84 Z', fill: '#8a6334' })
    );
  }

  UI.titleState = { mode: 'main', difficulty: 'normal', seed: '' };

  UI.titleScreen = function () {
    const st = UI.titleState;
    const meta = G.Save.meta('auto');
    const wrap = h('div', { class: 'title-screen' },
      G.TitleScene ? G.TitleScene() : emblem(),
      h('h1', null, 'КОЛРАТ'),
      h('div', { class: 'sub' }, 'Песок Татуина · выживание после крушения')
    );
    if (st.mode === 'main') {
      if (meta && !meta.over) {
        wrap.appendChild(h('button', { class: 'btn primary big', onclick: () => {
          const s = G.Save.read('auto');
          if (s) UI.start(s); else UI.flash('Сохранение повреждено.');
        } }, 'Продолжить — день ' + meta.day + ', ' + U.pl(meta.people, U.FORMS.fighter)));
      }
      wrap.appendChild(h('button', { class: 'btn big' + (meta && !meta.over ? '' : ' primary'), onclick: () => { st.mode = 'new'; UI.render(); } }, 'Новая кампания'));
      wrap.appendChild(h('button', { class: 'btn big', onclick: () => UI.importSave() }, 'Загрузить из файла'));
      wrap.appendChild(h('button', { class: 'btn big ghost', onclick: () => UI.pasteSave() }, 'Вставить сохранение текстом'));
      if (UI.canFullscreen() && !document.fullscreenElement) wrap.appendChild(h('button', { class: 'btn big ghost', onclick: () => UI.fullscreen() }, '⛶ Во весь экран (горизонтально)'));
      if (UI.inClaude()) wrap.appendChild(UI.downloadCard());
      if (UI.canInstall()) wrap.insertBefore(h('button', { class: 'btn big primary install-btn', onclick: () => UI.installApp() }, '📲 Установить на телефон'), wrap.querySelector('.btn'));
      const slots = ['1', '2', '3'].map((k) => [k, G.Save.meta(k)]).filter((x) => x[1]);
      if (slots.length) {
        wrap.appendChild(h('div', { class: 'card' }, h('h3', null, 'Сохранения'),
          slots.map(([k, m]) => h('div', { class: 'row between', style: 'margin-bottom:6px' },
            h('span', null, 'Ячейка ' + k + ': день ' + m.day + ', ' + U.pl(m.people, U.FORMS.fighter)),
            h('button', { class: 'btn small', onclick: () => { const s = G.Save.read(k); if (s) UI.start(s); } }, 'Загрузить')))));
      }
      wrap.appendChild(h('div', { class: 'card blurb' }, G.Avatar.npc('general', 88, 'ava-float'), G.Dom.paragraphs(G.TEXT.titleBlurb)));
      const recs = UI.records ? UI.records() : [];
      if (recs.length) {
        const dn = { easy: 'лёгк.', normal: 'обычн.', hard: 'тяж.' };
        wrap.appendChild(h('div', { class: 'card' }, h('h3', null, 'Рекорды генерала'),
          recs.slice(0, 5).map((r, i) => h('div', { class: 'row between small', style: 'padding:3px 0' },
            h('span', null, (i + 1) + '. ' + (G.TEXT.endings[r.reason] ? G.TEXT.endings[r.reason].title : r.reason) + ' · день ' + r.day + ' · выжило ' + r.alive + ' · ' + dn[r.difficulty]),
            h('b', { class: 'mono' }, String(r.score))))));
      }
    } else {
      const diffs = [['easy', 'Лёгкая'], ['normal', 'Обычная'], ['hard', 'Тяжёлая']];
      wrap.appendChild(h('div', { class: 'card' },
        h('h3', null, 'Новая кампания'),
        h('p', { class: 'muted small' }, G.TEXT.difficultyHint),
        h('div', { class: 'seg', style: 'margin-bottom:12px' },
          diffs.map(([id, name]) => h('button', { class: 'btn' + (st.difficulty === id ? ' sel' : ''), onclick: () => { st.difficulty = id; UI.render(); } }, name))),
        h('div', { class: 'row', style: 'margin-bottom:12px' },
          h('label', { class: 'muted small', for: 'seed' }, 'Зерно мира (необязательно):'),
          h('input', { id: 'seed', value: st.seed, placeholder: 'случайное', style: 'background:#1d2025;border:1px solid #2b2f37;color:#e7e2d6;border-radius:6px;padding:6px 8px;width:140px',
            oninput: (e) => { st.seed = e.target.value; } })),
        h('button', { class: 'btn primary big', onclick: () => {
          const seed = st.seed.trim() ? (/^\d+$/.test(st.seed.trim()) ? Number(st.seed.trim()) : G.Rng.hashString(st.seed.trim())) : null;
          st.mode = 'main';
          UI.overSeen = false;
          UI.start(G.Game.newGame({ difficulty: st.difficulty, seed: seed }));
        } }, 'Начать'),
        h('button', { class: 'btn big ghost', onclick: () => { st.mode = 'main'; UI.render(); } }, 'Назад')
      ));
    }
    if (!G.Save.available()) wrap.appendChild(h('p', { class: 'warn small' }, 'Браузер не даёт доступа к локальному хранилищу — сохраняйтесь в файл через меню.'));
    wrap.appendChild(h('div', { class: 'footer-note' }, 'Некоммерческий фанатский проект по мотивам вселенной «Звёздных войн». Все персонажи и тексты оригинальные.'));
    return wrap;
  };

  // ---------- Файлы на claude.ai ----------
  // Страница на claude.ai не может скачивать файлы сама: сохраняет площадка, спросив игрока
  UI.inClaude = () => !!globalThis.KOLRAT_ARTIFACT;
  UI.claudeSave = async function (filename, data, okText) {
    let dl = null;
    try { dl = globalThis.claude && globalThis.claude.use ? await globalThis.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (!dl) { UI.flash('Здесь сохранить файл нельзя. Перенесите сохранение текстом: «Копировать сохранение».'); return; }
    try {
      await dl.save({ filename: filename, data: data });
      UI.flash(okText || 'Файл сохранён: ' + filename);
    } catch (e) {
      UI.flash(e && e.code === 'declined' ? 'Скачивание отменено.' : 'Не удалось сохранить файл' + (e && e.message ? ': ' + e.message : '.'));
    }
  };
  UI.exportSave = function (s) {
    if (UI.inClaude()) UI.claudeSave('kolrat-den-' + s.day + '.json', G.Save.serialize(s));
    else G.Save.exportFile(s);
  };
  // Приложение для Android внутри страницы: ZIP с APK (сам .apk площадка сохранять не даёт)
  UI.canGetApk = () => UI.inClaude() && typeof globalThis.KOLRAT_APK_ZIP === 'string';
  UI.getApk = function () {
    const bin = atob(globalThis.KOLRAT_APK_ZIP);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    UI.claudeSave('kolrat-apk.zip', new Blob([bytes]), 'Сохранено. Откройте «Файли» → Завантаження → kolrat-apk.zip → kolrat.apk → «Встановити».');
  };

  // ---------- Установка как приложения (с сайта, без APK) ----------
  UI.installEvt = null;
  UI.standalone = () => !!(globalThis.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  UI.canInstall = () => !UI.isNativeApp() && !UI.inClaude() && !UI.standalone() && (!!UI.installEvt || /install/.test(location.hash || ''));
  if (globalThis.addEventListener) {
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); UI.installEvt = e; if (!UI.s) UI.render(); });
    addEventListener('appinstalled', () => { UI.installEvt = null; UI.flash('Готово: «Колрат» на главном экране — запускайте оттуда.'); UI.render(); });
  }
  UI.installApp = async function () {
    const e = UI.installEvt;
    if (!e) { UI.flash('Chrome: ⋮ → «Встановити додаток» (или «Додати на головний екран»).'); return; }
    e.prompt();
    try { await e.userChoice; } catch (err) { /* окно закрыто */ }
    UI.installEvt = null;
    UI.render();
  };

  // ---------- Страница игры на claude.ai: играть онлайн и скачать ----------
  UI.APK_URL = 'https://github.com/araxnid512-design/rubin/releases/download/kolrat/kolrat.apk';
  UI.downloadCard = function () {
    const copy = () => {
      const done = () => UI.flash('Ссылка скопирована — вставьте её в адресную строку Chrome.');
      try {
        navigator.clipboard.writeText(UI.APK_URL).then(done, () => { box.querySelector('code').classList.add('sel-me'); UI.flash('Выделите ссылку и скопируйте её вручную.'); });
      } catch (e) { UI.flash('Выделите ссылку и скопируйте её вручную.'); }
    };
    const box = h('div', { class: 'card dl-card' },
      h('h2', null, 'Скачать игру на Android'),
      UI.canGetApk() ? h('button', { class: 'btn big primary', onclick: () => UI.getApk() }, '📱 Скачать (ZIP с APK)') : null,
      UI.canGetApk() ? h('p', { class: 'small muted' }, 'Сохранится kolrat-apk.zip → откройте его в «Файли» → нажмите kolrat.apk → «Встановити».') : null,
      h('button', { class: 'btn big', onclick: copy }, '⧉ Скопировать ссылку на APK'),
      h('p', { class: 'small muted' }, 'Вставьте ссылку в Chrome — APK скачается, нажмите на него → «Встановити» → «Відкрити».'),
      h('code', { class: 'small apk-url' }, UI.APK_URL));
    return box;
  };

  // ---------- Импорт сохранения из файла ----------
  UI.importSave = function () {
    const inp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const s = G.Save.parse(String(r.result));
          UI.overSeen = false;
          UI.start(s);
          UI.flash('Сохранение загружено: день ' + s.day + '.');
        } catch (e) {
          UI.flash('Не удалось загрузить: ' + e.message);
        }
      };
      r.readAsText(f);
    });
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => inp.remove(), 60000);
  };

  // ---------- Перенос сохранения текстом ----------
  UI.copySave = function (s) {
    const text = G.Save.serialize(s);
    const done = () => UI.flash('Сохранение скопировано в буфер обмена (' + Math.round(text.length / 1024) + ' КБ).');
    if (globalThis.KolratAndroid) { KolratAndroid.copy(text); done(); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => UI.showSaveText(text));
    else UI.showSaveText(text);
  };
  // Отправить сохранение в мессенджер или почту (в Android-приложении)
  UI.shareSave = function (s) {
    if (globalThis.KolratAndroid) KolratAndroid.share(G.Save.serialize(s));
  };
  UI.showSaveText = function (text) {
    UI.overlay = () => h('div', { class: 'modal' },
      h('h2', null, 'Текст сохранения'),
      h('p', { class: 'small muted' }, 'Выделите весь текст и скопируйте его вручную.'),
      h('textarea', { class: 'save-text', readonly: true }, text),
      h('button', { class: 'btn primary', onclick: () => { UI.overlay = null; UI.render(); } }, 'Готово'));
    UI.render();
  };
  UI.pasteSave = function () {
    const ta = h('textarea', { class: 'save-text', placeholder: 'Вставьте сюда текст сохранения' });
    const load = () => {
      try {
        const s = G.Save.parse(ta.value.trim());
        UI.overlay = null;
        UI.overSeen = false;
        UI.start(s);
        UI.flash('Сохранение загружено: день ' + s.day + '.');
      } catch (e) { UI.flash('Не удалось загрузить: ' + e.message); }
    };
    UI.overlay = () => h('div', { class: 'modal' },
      h('h2', null, 'Вставить сохранение'),
      ta,
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn', onclick: () => { UI.overlay = null; UI.render(); } }, 'Отмена'),
        globalThis.KolratAndroid ? h('button', { class: 'btn', onclick: () => { ta.value = KolratAndroid.paste(); } }, 'Из буфера')
          : navigator.clipboard && navigator.clipboard.readText ? h('button', { class: 'btn', onclick: () => navigator.clipboard.readText().then((t) => { ta.value = t; }, () => UI.flash('Нет доступа к буферу — вставьте вручную.')) }, 'Из буфера') : null,
        h('button', { class: 'btn primary', onclick: load }, 'Загрузить')));
    UI.render();
  };

  // Всплывающее сообщение
  UI.flash = function (text) {
    let el = document.getElementById('flash');
    if (!el) {
      el = h('div', { id: 'flash', style: 'position:fixed;left:50%;transform:translateX(-50%);bottom:90px;z-index:99;background:#2a2216;border:1px solid #d9a85b;color:#f3cd8c;padding:10px 16px;border-radius:8px;max-width:90vw;box-shadow:0 8px 30px rgba(0,0,0,.5)' });
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(UI._flashT);
    UI._flashT = setTimeout(() => { el.style.display = 'none'; }, 3200);
  };

  // ---------- Смена суток: закат, ночь, восход ----------
  UI.dayTransition = function (s) {
    const old = document.querySelector('.day-fx');
    if (old) old.remove();
    const done = s.phase === 'orders';
    const stars = [];
    for (let k = 0; k < 40; k++) stars.push(h('i', { class: 'star', style: 'left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 60).toFixed(1) + '%;animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's' }));
    const el = h('div', { class: 'day-fx' + (done ? '' : ' short') },
      h('div', { class: 'fx-sky' }), h('div', { class: 'fx-stars' }, stars),
      h('div', { class: 'fx-sun s1' }), h('div', { class: 'fx-sun s2' }),
      h('div', { class: 'fx-dunes' }),
      h('div', { class: 'fx-text' }, h('div', { class: 't-night' }, 'Ночь над лагерем'), done ? h('div', { class: 't-day' }, 'День ' + s.day) : null));
    el.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    if (G.Audio) G.Audio.sfx('day');
    setTimeout(() => el.remove(), done ? 2300 : 1300);
  };

  // ---------- Телефон, ориентация, полный экран ----------
  UI.isLandscapePhone = () => !!(globalThis.matchMedia && matchMedia('(orientation: landscape) and (max-height: 540px)').matches);
  UI.canFullscreen = () => !!(document.fullscreenEnabled && !UI.isNativeApp());
  UI.isNativeApp = () => !!(globalThis.KolratAndroid || /KolratApp/.test(navigator.userAgent || ''));
  UI.fullscreen = function () {
    const el = document.documentElement;
    const p = document.fullscreenElement ? Promise.resolve() : (el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : Promise.reject());
    p.then(() => { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape'); })
      .catch(() => {})
      .then(() => setTimeout(() => UI.render(), 300));
  };
  function rotateHint() {
    if (document.querySelector('.rotate-hint')) return;
    const box = h('div', { class: 'rotate-hint' },
      h('div', { class: 'phone' }),
      h('h2', null, 'Поверните телефон горизонтально'),
      h('p', { class: 'muted' }, 'Игра рассчитана на горизонтальный экран: так помещаются и поле боя, и лог.'),
      UI.canFullscreen() ? h('button', { class: 'btn primary', onclick: () => UI.fullscreen() }, '⛶ Во весь экран') : null,
      h('button', { class: 'btn ghost', onclick: () => { document.body.classList.add('allow-portrait'); } }, 'Играть вертикально'));
    document.body.appendChild(box);
  }
  let resizeT = null;
  globalThis.addEventListener && globalThis.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const ae = document.activeElement;
      if (UI._bv || (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'))) return;
      UI.render();
    }, 250);
  });

  // ---------- Android-приложение: кнопка «Назад» и сворачивание ----------
  // true — игра обработала «Назад» сама; false — приложение свернётся
  globalThis.appBack = function () {
    if (UI.overlay) { UI.overlay = null; UI.render(); return true; }
    const s = UI.s;
    if (!s) {
      if (UI.titleState.mode !== 'main') { UI.titleState.mode = 'main'; UI.render(); return true; }
      return false;
    }
    if (s.pending || (s.over && !UI.overSeen)) return true; // окна событий и боёв закрываются только выбором
    if (UI.builder) { UI.builder = null; UI.render(); return true; }
    if (UI.tab !== 'hq') { UI.go('hq'); return true; }
    return false;
  };
  globalThis.appPause = function () { if (UI.s) G.Save.write('auto', UI.s); };

  // ---------- Запуск ----------
  function boot() {
    rotateHint();
    // тихий щелчок на кнопках
    document.addEventListener('click', (e) => { if (G.Audio && e.target.closest && e.target.closest('button, .choice')) G.Audio.sfx('click', { max: 2 }); }, true);
    UI.render();
    // Офлайн-режим и установка на телефон (только по https или localhost)
    if ('serviceWorker' in navigator && !globalThis.KOLRAT_ARTIFACT && (location.protocol === 'https:' || location.hostname === 'localhost') && !UI.isNativeApp()) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(globalThis.G = globalThis.G || {});
