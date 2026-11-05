#!/usr/bin/env node
/*
 * Страница игры для claude.ai (Artifact): тот же единый файл, но без внешних тегов документа —
 * обёртку <!doctype>/<head>/<body> добавляет сама площадка. Офлайн-кэш (service worker) там не нужен.
 * Запуск: node tools/build-artifact.js [файл] [kolrat-apk.zip]
 *   файл — куда записать страницу (по умолчанию dist/kolrat-artifact.html);
 *   kolrat-apk.zip — если указан, APK в ZIP встраивается в страницу: кнопка «Скачать приложение для Android»
 *   сохраняет его через площадку (сам .apk она сохранять не даёт, а ZIP — можно).
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
let flags = 'globalThis.KOLRAT_ARTIFACT = true;';
if (process.argv[3]) flags += '\nglobalThis.KOLRAT_APK_ZIP = "' + fs.readFileSync(process.argv[3]).toString('base64') + '";';
html = title + '\n<script>' + flags + '</script>\n' + html.trim() + '\n';
const out = process.argv[2] || path.join(ROOT, 'dist', 'kolrat-artifact.html');
fs.writeFileSync(out, html);
console.log(path.relative(ROOT, out) + ': ' + Math.round(html.length / 1024) + ' КБ');
