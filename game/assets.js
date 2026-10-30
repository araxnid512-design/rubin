// Где лежат файлы игры. В скачанной версии (один HTML-файл, scripts/build-offline.mjs) звуки и картинки
// встроены в страницу data:-ссылками (window.__ASSETS), в обычной — лежат рядом со страницей.

/** Игра открыта из скачанного файла. */
export const OFFLINE = typeof window !== 'undefined' && !!window.__ASSETS;

/** Ссылка на файл игры по пути от корня (assets/sounds/pistol.mp3). */
export const asset = (path) => (OFFLINE && window.__ASSETS[path]) || `./${path}`;
