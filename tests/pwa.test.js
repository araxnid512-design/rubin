'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('офлайн-кэш содержит все файлы, подключённые в index.html', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length > 20);
  for (const f of scripts.concat(['css/style.css', 'manifest.webmanifest'])) {
    assert.ok(sw.includes("'" + f + "'"), 'нет в sw.js: ' + f);
    assert.ok(fs.existsSync(path.join(ROOT, f)), 'файл не найден: ' + f);
  }
});

test('манифест: горизонтально, во весь экран, иконки на месте', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.strictEqual(m.orientation, 'landscape');
  assert.strictEqual(m.display, 'fullscreen');
  for (const ic of m.icons) assert.ok(fs.existsSync(path.join(ROOT, ic.src)), ic.src);
});

test('Android: ресурсы иконок и заставок для всех плотностей', () => {
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      assert.ok(fs.existsSync(path.join(ROOT, 'android-res', 'mipmap-' + d, f)), d + '/' + f);
    }
    assert.ok(fs.existsSync(path.join(ROOT, 'android-res', 'drawable-land-' + d, 'splash.png')));
  }
  const cap = JSON.parse(read('capacitor.config.json'));
  assert.strictEqual(cap.webDir, 'www');
});
