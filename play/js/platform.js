// Особенности Android: полноэкранный режим, горизонтальная ориентация,
// кнопка «Назад» закрывает открытое окно или ставит игру на паузу. В браузере всё это мягко пропускается.
(function () {
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const listeners = { pause: [], resume: [] };

  const Platform = {
    isNative,
    paused: false,
    onBack: null, // () => true, если «Назад» обработан (например, закрыто окно)
    on(event, fn) { listeners[event].push(fn); },
    pause() {
      if (this.paused) return;
      this.paused = true;
      document.getElementById('pause').classList.remove('hidden');
      listeners.pause.forEach((fn) => fn());
    },
    resume() {
      if (!this.paused) return;
      this.paused = false;
      document.getElementById('pause').classList.add('hidden');
      listeners.resume.forEach((fn) => fn());
    },
    exit() {
      if (isNative) window.capacitorApp.App.exitApp();
    },
  };

  async function setupNative() {
    const { App } = window.capacitorApp;
    const { StatusBar } = window.capacitorStatusBar;
    const { ScreenOrientation } = window.capacitorScreenOrientation;

    // Полный экран: строку состояния прячем и здесь, а immersive-режим
    // (скрытие навигационной панели) включается в MainActivity.java.
    try { await StatusBar.hide(); } catch (e) { console.warn(e); }
    try { await ScreenOrientation.lock({ orientation: 'landscape' }); } catch (e) { console.warn(e); }

    // «Назад»: игра → пауза; на экране паузы — продолжить. Приложение не закрывается.
    App.addListener('backButton', () => {
      if (Platform.onBack && Platform.onBack()) return;
      if (Platform.paused) Platform.resume();
      else Platform.pause();
    });

    // Сворачивание приложения тоже ставит на паузу.
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) Platform.pause();
    });
  }

  function setupRotateHint() {
    const el = document.getElementById('rotate');
    const check = () => el.classList.toggle('hidden', window.innerWidth >= window.innerHeight);
    window.addEventListener('resize', check);
    check();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Platform.pause();
  });

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-resume').addEventListener('click', () => Platform.resume());
    const exitBtn = document.getElementById('btn-exit');
    if (isNative) exitBtn.addEventListener('click', () => Platform.exit());
    else exitBtn.style.display = 'none';
    setupRotateHint();
    if (isNative) setupNative();
  });

  window.Platform = Platform;
})();
