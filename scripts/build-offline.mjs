// Скачиваемая версия игры: один HTML-файл, который открывается двойным щелчком — без сервера, без интернета
// и без установки. Внутри: весь код игры и three.js одним модулем (esbuild), модели (base64-модули
// models/game/*-glb.js), звуки и превью локаций (data:-ссылки в window.__ASSETS, см. game/assets.js).
//
//   node scripts/build-offline.mjs   → download/ulei-cluster17.html

import { build } from 'esbuild';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'download', 'ulei-cluster17.html');
const LIMIT = 16 * 1024 * 1024; // больше не опубликовать одним файлом

// модели — свежие base64-модули из .glb (их подхватывает запасной путь загрузки в game/main.js)
for (const name of ['player', 'runner', 'stomper', 'ruber']) {
	const glb = await readFile(join(ROOT, 'models/game', `${name}.glb`));
	await writeFile(join(ROOT, 'models/game', `${name}-glb.js`), `export default "${glb.toString('base64')}";\n`);
}

// код: game/main.js, three.js и модели — одним модулем
const { outputFiles } = await build({
	entryPoints: [join(ROOT, 'game/main.js')],
	bundle: true, format: 'esm', target: 'es2020', minify: true, write: false, legalComments: 'none', logLevel: 'warning',
});
const code = outputFiles[0].text.replaceAll('</script', '<\\/script');

// звуки и превью — data:-ссылки по тем же путям, что в обычной версии
const assets = {};
const embed = async (dir, type) => {
	for (const f of (await readdir(join(ROOT, dir))).filter((x) => x.endsWith(type === 'audio/mpeg' ? '.mp3' : '.jpg'))) {
		assets[`${dir}/${f}`] = `data:${type};base64,${(await readFile(join(ROOT, dir, f))).toString('base64')}`;
	}
};
await embed('assets/sounds', 'audio/mpeg');
await embed('assets/previews', 'image/jpeg');
const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

// страница: та же разметка и стили, вместо карты импорта и внешнего модуля — всё внутри
let html = await readFile(join(ROOT, 'game.html'), 'utf8');
html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
const inline = `<script>window.__ASSETS = ${JSON.stringify(assets)}; window.__BUILD = ${JSON.stringify({ date })};</script>\n\t<script type="module">${code}</script>`;
if (!html.includes('<script type="module" src="./game/main.js"></script>')) throw new Error('в game.html нет подключения game/main.js');
html = html.replace('<script type="module" src="./game/main.js"></script>', () => inline);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html);
const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`${OUT}: ${mb(html.length)} МБ (код ${mb(code.length)} МБ, звуки и картинки ${mb(JSON.stringify(assets).length)} МБ), сборка от ${date}`);
if (html.length > LIMIT) { console.error(`больше ${mb(LIMIT)} МБ — не опубликовать одним файлом`); process.exit(1); }
