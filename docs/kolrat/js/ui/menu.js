/* Вкладка «Меню»: сохранения, файл, новая игра, правила. */
(function (G) {
  'use strict';
  const { h, paragraphs } = G.Dom;
  const U = G.U;
  const UI = G.UI = G.UI || {};
  UI.views = UI.views || {};

  function slotRow(s, k) {
    const m = G.Save.meta(k);
    const when = m ? new Date(m.time).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return h('div', { class: 'row between', style: 'padding:6px 0;border-bottom:1px solid #23262c' },
      h('div', null, h('b', null, 'Ячейка ' + k), h('div', { class: 'small muted' }, m ? 'день ' + m.day + ', ' + U.pl(m.people, U.FORMS.fighter) + ' · ' + when : 'пусто')),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => {
          const doSave = () => { UI.flash(G.Save.write(k, s) ? 'Сохранено в ячейку ' + k + '.' : 'Не удалось сохранить.'); UI.render(); };
          if (m) UI.confirm('Перезаписать?', 'В ячейке ' + k + ' уже есть сохранение (день ' + m.day + ').', doSave); else doSave();
        } }, 'Сохранить'),
        m ? h('button', { class: 'btn small', onclick: () => UI.confirm('Загрузить?', 'Текущий прогресс останется в автосохранении только до следующего хода.', () => {
          const x = G.Save.read(k);
          if (x) { UI.overSeen = false; UI.start(x); UI.flash('Загружено.'); } else UI.flash('Сохранение повреждено.');
        }) }, 'Загрузить') : null)
    );
  }

  // Звук и музыка: громкость ползунками, выключить одним касанием
  function soundCard() {
    const A = G.Audio, P = A.prefs;
    const slider = (key, label) => h('label', { class: 'snd-row', for: 'snd-' + key },
      h('span', null, label),
      h('input', { id: 'snd-' + key, type: 'range', min: 0, max: 100, step: 5, value: Math.round(P[key] * 100),
        oninput: (e) => { A.set(key, Number(e.target.value) / 100); if (key === 'sfx') A.sfx('blaster', { side: 0 }); } }));
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, 'Звук и музыка'),
        h('button', { class: 'btn small' + (P.mute ? '' : ' sel'), onclick: () => { A.set('mute', !P.mute); UI.render(); } }, P.mute ? '🔇 выключен' : '🔊 включён')),
      slider('music', 'Музыка'),
      slider('sfx', 'Звуки'),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' }, 'Музыка и звуки свои, в духе космической оперы. Звук включается после первого касания экрана.'));
  }

  UI.views.menu = function (s) {
    return h('div', { class: 'cols' },
      h('div', null,
        h('div', { class: 'card' },
          h('h2', null, 'Сохранения'),
          h('p', { class: 'small muted' }, 'Игра сохраняется автоматически после каждого действия. Ячейки — для ручных сохранений.'),
          ['1', '2', '3'].map((k) => slotRow(s, k)),
          h('div', { class: 'row', style: 'margin-top:12px' },
            UI.isNativeApp() ? null : h('button', { class: 'btn', onclick: () => UI.exportSave(s) }, '⇩ Скачать файл'),
            UI.canGetApk() ? h('button', { class: 'btn', onclick: () => UI.getApk() }, '📱 Приложение для Android') : null,
            h('button', { class: 'btn', onclick: () => UI.importSave() }, '⇧ Загрузить файл'),
            h('button', { class: 'btn', onclick: () => UI.copySave(s) }, '⧉ Копировать сохранение'),
            globalThis.KolratAndroid ? h('button', { class: 'btn', onclick: () => UI.shareSave(s) }, '⇪ Отправить сохранение') : null,
            h('button', { class: 'btn', onclick: () => UI.pasteSave() }, '⎘ Вставить сохранение')),
          h('p', { class: 'small muted', style: 'margin-top:8px' }, 'Сохранение можно перенести на другой компьютер или телефон — файлом или текстом через буфер обмена (например, переслать себе в мессенджере).')
        ),
        G.Audio && G.Audio.available() ? soundCard() : null,
        UI.canFullscreen() ? h('div', { class: 'card' },
          h('h2', null, 'Экран'),
          h('button', { class: 'btn', onclick: () => (document.fullscreenElement ? document.exitFullscreen().then(() => UI.render()) : UI.fullscreen()) },
            document.fullscreenElement ? 'Выйти из полноэкранного режима' : '⛶ Во весь экран (горизонтально)'),
          h('p', { class: 'small muted', style: 'margin-top:8px' }, 'На Android игру можно установить как приложение: меню браузера → «Добавить на главный экран». Она будет запускаться во весь экран и горизонтально.')) : null,
        h('div', { class: 'card' },
          h('h2', null, 'Кампания'),
          h('p', { class: 'small' }, 'Сложность: ' + { easy: 'лёгкая', normal: 'обычная', hard: 'тяжёлая' }[s.difficulty] + ' · зерно мира: ' + s.seed),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: () => { UI.s = null; UI.titleState.mode = 'main'; UI.render(); } }, 'В главное меню'),
            h('button', { class: 'btn danger', onclick: () => UI.confirm('Начать заново?', 'Текущая кампания будет потеряна, если она не сохранена в ячейку или файл.', () => {
              UI.s = null; UI.titleState.mode = 'new'; UI.render();
            }) }, 'Новая кампания'))
        )
      ),
      h('div', { class: 'card' },
        h('h2', null, 'Как играть'),
        paragraphs(G.TEXT.rules)
      )
    );
  };
})(globalThis.G = globalThis.G || {});
