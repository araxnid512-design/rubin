// Собирает сайт игры в _site/: страница из site/, игра для браузера (play/ = копия www/) и APK.
// Запуск: node scripts/build-site.js <версия> [путь к apk]
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, '_site');
const version = process.argv[2] || 'dev';
const apk = process.argv[3] ? path.resolve(process.argv[3]) : null;

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'site'), out, { recursive: true });
fs.cpSync(path.join(root, 'www'), path.join(out, 'play'), { recursive: true });

let size = '—';
if (apk && fs.existsSync(apk)) {
  fs.copyFileSync(apk, path.join(out, 'styx-road.apk'));
  size = (fs.statSync(apk).size / 1048576).toFixed(1).replace('.', ',');
}

const d = new Date();
const date = [d.getUTCDate(), d.getUTCMonth() + 1].map((n) => String(n).padStart(2, '0')).join('.') + '.' + d.getUTCFullYear();
const page = path.join(out, 'index.html');
fs.writeFileSync(page, fs.readFileSync(page, 'utf8')
  .replace(/__VERSION__/g, version)
  .replace(/__SIZE__/g, size)
  .replace(/__DATE__/g, date));

// Без Jekyll: GitHub Pages отдаёт файлы как есть.
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`site: _site/ собран, версия ${version}, APK ${size} МБ`);
