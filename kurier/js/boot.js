/* Курьер миров — страховка запуска. Подключается первым: если игра не стартует или падает,
   на экране появится понятное сообщение с текстом ошибки, которое можно сфотографировать. */
(function () {
  'use strict';
  var shown = false;
  function show(msg) {
    if (shown) return;
    shown = true;
    var box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#2a0612;color:#fff;border:2px solid #ff4f8b;border-radius:6px;padding:10px 12px;font:14px/1.4 sans-serif;';
    box.innerHTML = '<b>Игра столкнулась с ошибкой.</b> Сделайте скриншот и пришлите его — так проще всего починить.<br><code style="display:block;margin-top:6px;white-space:pre-wrap;word-break:break-word;color:#ffd56b"></code>';
    box.querySelector('code').textContent = String(msg).slice(0, 600) + '\n' + navigator.userAgent;
    (document.body || document.documentElement).appendChild(box);
  }
  window.addEventListener('error', function (e) { show((e.message || 'ошибка') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function (e) { show('promise: ' + (e.reason && e.reason.message || e.reason)); });
  // Если через 4 секунды игра так и не запустилась — значит, её скрипты не загрузились.
  setTimeout(function () {
    if (!window.K || !window.K.debug) show('Игра не запустилась: скрипты не загрузились. Возможно, устарел Android System WebView — обновите его в Play Маркете.');
  }, 4000);
})();
