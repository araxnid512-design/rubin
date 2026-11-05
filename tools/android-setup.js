#!/usr/bin/env node
/*
 * Настраивает сгенерированный Capacitor-проект android/:
 * горизонтальная ориентация, полный экран, иконки игры.
 * Запускать после `npx cap add android`.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'android', 'app', 'src', 'main');
if (!fs.existsSync(APP)) { console.error('Нет папки android/ — сначала выполните: npx cap add android'); process.exit(1); }

// 1. Горизонтальная ориентация (с поворотом по датчику) для главной активности
const manifestPath = path.join(APP, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!/android:screenOrientation=/.test(manifest)) {
  manifest = manifest.replace(/(<activity\b[^>]*?android:name="[^"]*MainActivity"[^>]*?)(\s*>)/s, '$1\n            android:screenOrientation="sensorLandscape"$2');
}
if (!/android:screenOrientation="sensorLandscape"/.test(manifest)) { console.error('Не удалось задать ориентацию в AndroidManifest.xml'); process.exit(1); }
fs.writeFileSync(manifestPath, manifest);

// 2. Полный экран без строки состояния, с заходом под вырез камеры
const stylesPath = path.join(APP, 'res', 'values', 'styles.xml');
let styles = fs.readFileSync(stylesPath, 'utf8');
const FULL = '\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>\n    ';
styles = styles.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)([\s\S]*?)(<\/style>)/, (m, a, body, c) => (body.includes('windowFullscreen') ? m : a + body.trimEnd() + FULL + c));
styles = styles.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)([\s\S]*?)(<\/style>)/, (m, a, body, c) => (body.includes('windowFullscreen') ? m : a + body.trimEnd() + FULL + c));
fs.writeFileSync(stylesPath, styles);

// 3. Иконки: копируем готовые PNG по плотностям, фон адаптивной иконки — тёмный
const RES = path.join(ROOT, 'android-res');
for (const dir of fs.readdirSync(RES)) {
  const dst = path.join(APP, 'res', dir);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(path.join(RES, dir))) fs.copyFileSync(path.join(RES, dir, f), path.join(dst, f));
}
const bgPath = path.join(APP, 'res', 'values', 'ic_launcher_background.xml');
fs.writeFileSync(bgPath, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#16181C</color>\n</resources>\n');

console.log('Android-проект настроен: горизонтально, во весь экран, иконки игры.');
