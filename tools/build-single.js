#!/usr/bin/env node
/*
 * Собирает игру в ОДИН HTML-файл (dist/kolrat.html): стили и все скрипты внутри.
 * Такой файл открывается в любом браузере без интернета и без установки.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let html = read('index.html');
// Стили
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, href) => '<style>\n' + read(href) + '\n</style>');
// Иконка — прямо в файл
const icon = fs.readFileSync(path.join(ROOT, 'icons/favicon-64.png')).toString('base64');
html = html.replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/png" href="data:image/png;base64,' + icon + '">');
// Манифест и иконка для iOS одному файлу не нужны
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '').replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '');
// Скрипты
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = read(src).replace(/<\/script/gi, '<\\/script');
  return '<script>/* ' + src + ' */\n' + code + '\n</script>';
});
if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error('Остались внешние файлы в HTML');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'kolrat.html'), html);
console.log('dist/kolrat.html: ' + Math.round(html.length / 1024) + ' КБ');
