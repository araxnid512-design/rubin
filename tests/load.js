/* Загрузка игрового ядра в Node для тестов (без интерфейса). */
'use strict';
const path = require('path');

const CORE_FILES = [
  'js/config.js',
  'js/core/util.js',
  'js/core/rng.js',
  'js/content/names.ru.js',
  'js/content/regions.ru.js',
  'js/content/texts.ru.js',
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
  'js/core/save.js',
];

function load() {
  for (const f of CORE_FILES) require(path.join(__dirname, '..', f));
  return globalThis.G;
}

module.exports = { load, CORE_FILES };
