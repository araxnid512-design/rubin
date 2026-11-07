#!/usr/bin/env node
/*
 * Сайт игры для GitHub Pages: папка docs/
 *   docs/index.html  — страница игры: установить на телефон, играть в браузере, скачать APK
 *   docs/kolrat/     — сама игра (устанавливается как приложение, работает офлайн)
 * Запуск: node tools/build-site.js — после изменений игры, перед коммитом.
 * Включается один раз: GitHub → Settings → Pages → Deploy from a branch → эта ветка, папка /docs.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const GAME = path.join(OUT, 'kolrat');

function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f));
  } else fs.copyFileSync(src, dst);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(GAME, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons']) copy(path.join(ROOT, f), path.join(GAME, f));
copy(path.join(ROOT, 'tools', 'site', 'index.html'), path.join(OUT, 'index.html'));
copy(path.join(ROOT, 'js', 'ui', 'titlescene.js'), path.join(OUT, 'titlescene.js'));
copy(path.join(ROOT, 'icons', 'favicon-64.png'), path.join(OUT, 'favicon.png'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
let n = 0;
(function count(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) count(p); else n++; } })(OUT);
console.log('docs/: ' + n + ' файлов');
