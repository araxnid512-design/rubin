#!/usr/bin/env node
/* Собирает папку www/ для Android-приложения (android-app/ берёт её как assets): копирует файлы игры. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const ITEMS = ['index.html', 'css', 'js', 'icons'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const item of ITEMS) fs.cpSync(path.join(ROOT, item), path.join(OUT, item), { recursive: true });
console.log('www/ собрана: ' + ITEMS.join(', '));
