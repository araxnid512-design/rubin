// Страница игры на сайте araxnid512-design.github.io/rubin/ulei/ (рядом со «Стиксом» и «Клонами»): собирает _site_ulei/
//   index.html — страница из site/ulei/ (версия, дата, размер подставляются), img/ — кадры из игры;
//   ulei-cluster17.apk и ulei-cluster17-apk.zip — приложение для Android; play/ — игра в браузере (тот же файл,
//   что download/ulei-cluster17.html). Публикует .github/workflows/offline-release.yml в ветку gh-pages, в папку ulei/.
//   node scripts/build-ulei-site.mjs <версия>

import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site_ulei');
const version = process.argv[2] ?? 'dev';

rmSync(OUT, { recursive: true, force: true });
cpSync(join(ROOT, 'site/ulei'), OUT, { recursive: true });
mkdirSync(join(OUT, 'play'), { recursive: true });
copyFileSync(join(ROOT, 'download/ulei-cluster17.html'), join(OUT, 'play/index.html'));
for (const f of ['ulei-cluster17.apk', 'ulei-cluster17-apk.zip']) {
	if (existsSync(join(ROOT, 'download', f))) copyFileSync(join(ROOT, 'download', f), join(OUT, f));
}
const apk = join(OUT, 'ulei-cluster17.apk');
const size = existsSync(apk) ? (statSync(apk).size / 1048576).toFixed(1).replace('.', ',') : '—';
const d = new Date();
const date = [d.getUTCDate(), d.getUTCMonth() + 1].map((n) => String(n).padStart(2, '0')).join('.') + '.' + d.getUTCFullYear();
const page = join(OUT, 'index.html');
writeFileSync(page, readFileSync(page, 'utf8').replace(/__VERSION__/g, version).replace(/__SIZE__/g, size).replace(/__DATE__/g, date));
console.log(`_site_ulei/: версия ${version}, APK ${size} МБ, ${date}`);
