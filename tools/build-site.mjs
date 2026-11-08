// Собирает сайт для установки в _site/: страница с кнопками, игра play.html (с установкой как приложения),
// манифест, сервис-воркер, иконки, снимки и, если переданы, сам APK и ZIP.
//   node tools/build-site.mjs [--apk путь] [--zip путь] [--version 1.0.N]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const out = join(root, '_site');
const REL = 'https://github.com/araxnid512-design/rubin/releases/download/rubezh/';
const ver = arg('version') || 'dev';
const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'icons'), { recursive: true });
mkdirSync(join(out, 'shots'), { recursive: true });
for (const d of ['icons', 'shots']) for (const f of readdirSync(join(root, 'site', d))) copyFileSync(join(root, 'site', d, f), join(out, d, f));

let apkUrl = REL + 'rubezh.apk', zipUrl = REL + 'rubezh-apk.zip', mb = '1,1';
const apk = arg('apk'), zip = arg('zip');
if (apk) { copyFileSync(apk, join(out, 'rubezh.apk')); apkUrl = 'rubezh.apk'; mb = (statSync(apk).size / 1048576).toFixed(1).replace('.', ','); }
if (zip) { copyFileSync(zip, join(out, 'rubezh-apk.zip')); zipUrl = 'rubezh-apk.zip'; }

const fill = s => s.replaceAll('{{VER}}', ver).replaceAll('{{DATE}}', date).replaceAll('{{APK_URL}}', apkUrl).replaceAll('{{ZIP_URL}}', zipUrl).replaceAll('{{APK_MB}}', mb);
writeFileSync(join(out, 'index.html'), fill(readFileSync(join(root, 'site/index.html'), 'utf8')));
writeFileSync(join(out, 'sw.js'), fill(readFileSync(join(root, 'site/sw.js'), 'utf8')));
copyFileSync(join(root, 'site/manifest.webmanifest'), join(out, 'manifest.webmanifest'));

// Игра: собранный dist/index.html плюс манифест, иконки и сервис-воркер
let game = readFileSync(join(root, 'dist/index.html'), 'utf8');
game = game.replace('</head>', `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
</head>`);
game = game.replace('</body>', `<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
</body>`);
writeFileSync(join(out, 'play.html'), game);
writeFileSync(join(out, '.nojekyll'), '');
console.log('_site', readdirSync(out).join(' '));
