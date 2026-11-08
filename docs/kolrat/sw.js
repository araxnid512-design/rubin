/*
 * Service worker: игра работает офлайн после первой загрузки (по https или localhost).
 * При изменении файлов игры увеличьте VERSION — телефоны получат обновление.
 */
'use strict';
const VERSION = 'kolrat-v13';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
  'js/config.js',
  'js/core/util.js',
  'js/core/rng.js',
  'js/content/names.ru.js',
  'js/content/regions.ru.js',
  'js/content/texts.ru.js',
  'js/content/codex.ru.js',
  'js/content/terminal.ru.js',
  'js/core/units.js',
  'js/core/state.js',
  'js/core/base.js',
  'js/core/regions.js',
  'js/core/trade.js',
  'js/core/combat.js',
  'js/core/actions.js',
  'js/core/day.js',
  'js/core/game.js',
  'js/core/events.js',
  'js/content/events.ru.js',
  'js/content/events.factions.ru.js',
  'js/battle/map.js',
  'js/battle/text.ru.js',
  'js/battle/engine.js',
  'js/core/battleflow.js',
  'js/core/progress.js',
  'js/core/goals.js',
  'js/core/camp.js',
  'js/core/factions.js',
  'js/core/medals.js',
  'js/core/terminal.js',
  'js/core/save.js',
  'js/ui/dom.js',
  'js/ui/audio.js',
  'js/ui/avatars.js',
  'js/ui/hq.js',
  'js/ui/roster.js',
  'js/ui/map.js',
  'js/ui/base.js',
  'js/ui/chronicle.js',
  'js/ui/modals.js',
  'js/ui/sprites.js',
  'js/ui/campview.js',
  'js/ui/titlescene.js',
  'js/ui/battle.js',
  'js/ui/codex.js',
  'js/ui/terminal.js',
  'js/ui/menu.js',
  'js/ui/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Сначала сеть (чтобы получать обновления), при её отсутствии — кэш
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      if (res.ok && new URL(e.request.url).origin === location.origin) caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
