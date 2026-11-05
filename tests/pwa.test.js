'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

test('Android-проект: горизонтально, иконки всех плотностей, ключ подписи', () => {
  const app = path.join(ROOT, 'android-app', 'app');
  const manifest = fs.readFileSync(path.join(app, 'src/main/AndroidManifest.xml'), 'utf8');
  assert.ok(/android:screenOrientation="sensorLandscape"/.test(manifest));
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      assert.ok(fs.existsSync(path.join(app, 'src/main/res/mipmap-' + d, f)), d + '/' + f);
    }
  }
  assert.ok(fs.existsSync(path.join(app, 'debug.keystore')));
  assert.ok(fs.existsSync(path.join(ROOT, 'android-app', 'gradle/wrapper/gradle-wrapper.jar')));
  const gradle = fs.readFileSync(path.join(app, 'build.gradle'), 'utf8');
  assert.ok(gradle.includes("assets.srcDirs = ['../../www']"));
});

test('игра одним файлом: всё внутри, внешних файлов нет', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-single.js')], { stdio: 'pipe' });
  const html = read('dist/kolrat.html');
  assert.ok(!/<script src=/.test(html));
  assert.ok(!/<link rel="stylesheet"/.test(html));
  const scripts = [...read('index.html').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  for (const f of scripts) assert.ok(html.includes('/* ' + f + ' */'), 'нет внутри: ' + f);
});
