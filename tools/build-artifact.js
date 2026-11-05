#!/usr/bin/env node
/*
 * Страница игры для claude.ai (Artifact): тот же единый файл, но без внешних тегов документа —
 * обёртку <!doctype>/<head>/<body> добавляет сама площадка. Офлайн-кэш (service worker) там не нужен.
 * Запуск: node tools/build-artifact.js [файл]  (по умолчанию dist/kolrat-artifact.html)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'build-single.js')], { stdio: 'inherit' });
let html = fs.readFileSync(path.join(ROOT, 'dist', 'kolrat.html'), 'utf8');
const title = (html.match(/<title>[^<]*<\/title>/) || ['<title>Колрат: Песок Татуина</title>'])[0];
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '').replace(/\s*<\/html>\s*$/i, '\n')
  .replace(/<head>\s*/i, '').replace(/\s*<\/head>\s*/i, '\n')
  .replace(/<body[^>]*>\s*/i, '').replace(/\s*<\/body>\s*/i, '\n')
  .replace(/\s*<meta charset="[^"]*">/i, '')
  .replace(/\s*<meta name="viewport"[^>]*>/i, '')
  .replace(/\s*<meta name="(mobile-web-app-capable|apple-mobile-web-app-capable|apple-mobile-web-app-status-bar-style)"[^>]*>/gi, '')
  .replace(title, '');
// название — в самом начале файла, отключение офлайн-кэша — до скриптов игры
html = title + '\n<script>globalThis.KOLRAT_NO_SW = true;</script>\n' + html.trim() + '\n';
const out = process.argv[2] || path.join(ROOT, 'dist', 'kolrat-artifact.html');
fs.writeFileSync(out, html);
console.log(path.relative(ROOT, out) + ': ' + Math.round(html.length / 1024) + ' КБ');
