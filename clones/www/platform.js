'use strict';
// Особенности Android: полный экран, горизонтальная ориентация, «Назад» и сворачивание.
// «Назад» не закрывает игру: закрывает открытое окно или ставит бой на паузу.
// В браузере (и в артефакте) этот файл ничего не делает.
(function () {
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!isNative) return;
  const shown = id => { const el = $(id); return !!el && el.classList.contains('show'); };
  const close = id => $(id).classList.remove('show');

  function onBack() {
    if (shown('confirmScr')) { $('cNo').click(); return; }
    if (shown('howScr')) { close('howScr'); return; }
    if (shown('menuScr')) { $('bResume').click(); return; }
    if (document.body.classList.contains('playing')) { if (phase !== 'over') openMenu(); return; }
    if (shown('briefScr')) { $('bBack').click(); return; }
    if (shown('prologScr')) { $('bProlog').click(); return; }
    if (shown('endScr')) { $('bAgain').click(); return; }
    if (shown('hubScr')) { $('hExit').click(); return; } // с корабля — на титульный экран
    // на титульном экране «Назад» ничего не делает
  }

  async function setup() {
    const { App } = window.capacitorApp, { StatusBar } = window.capacitorStatusBar, { ScreenOrientation } = window.capacitorScreenOrientation;
    // строка состояния прячется здесь, навигационная панель — в MainActivity.java (immersive)
    try { await StatusBar.hide(); } catch (e) { console.warn(e); }
    try { await ScreenOrientation.lock({ orientation: 'landscape' }); } catch (e) { console.warn(e); }
    App.addListener('backButton', onBack);
    // свернули приложение — бой на паузу, музыку стоп (вернётся сама при возврате, см. visibilitychange в game.js)
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) return;
      Music.stop();
      if (document.body.classList.contains('playing') && phase !== 'over' && !shown('menuScr')) openMenu();
    });
  }
  setup();
})();
