// Выгрузка для Godot-версии игры (godot/): локации и оружие из браузерной игры — в GLB, данные локаций — в JSON,
// модели персонажей — как есть. Запуск: node scripts/export-godot.mjs (нужен Playwright с Chromium).
// Результат: godot/assets/levels/<id>.glb|json, godot/assets/weapons/<id>.glb + weapons.json,
// godot/assets/characters/<имя>.glb. Эти файлы не хранятся в git — их собирает CI перед сборкой APK.
import { createRequire } from 'node:module';
import { mkdir, writeFile, copyFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'godot', 'assets');
for (const d of ['levels', 'weapons', 'characters', 'textures']) await mkdir(join(OUT, d), { recursive: true });

const server = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
	const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
	route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
});
await page.goto(`http://localhost:${server.address().port}/tools/godot-export.html`);
await page.waitForFunction(() => window.ready, null, { timeout: 120000 });

const only = process.argv.slice(2);
for (const id of await page.evaluate(() => window.levelIds())) {
	if (only.length && !only.includes(id)) continue;
	const { gltf, meta } = await page.evaluate((id) => window.exportLevel(id), id);
	// картинки — общие для всех локаций файлы по содержимому (одна текстура — один файл), буфер — рядом
	const doc = JSON.parse(gltf);
	for (const img of doc.images ?? []) {
		const [, mime, data] = img.uri.match(/^data:([^;]+);base64,(.*)$/);
		const bytes = Buffer.from(data, 'base64');
		const name = `${createHash('sha1').update(bytes).digest('hex').slice(0, 16)}.${mime.includes('jpeg') ? 'jpg' : 'png'}`;
		const file = join(OUT, 'textures', name);
		if (!(await access(file).then(() => true, () => false))) await writeFile(file, bytes);
		img.uri = `../textures/${name}`;
	}
	let bin = 0;
	for (const [i, b] of (doc.buffers ?? []).entries()) {
		const bytes = Buffer.from(b.uri.split(',')[1], 'base64');
		bin += bytes.length;
		await writeFile(join(OUT, 'levels', `${id}${i ? i : ''}.bin`), bytes);
		b.uri = `${id}${i ? i : ''}.bin`;
	}
	await writeFile(join(OUT, 'levels', `${id}.gltf`), JSON.stringify(doc));
	await writeFile(join(OUT, 'levels', `${id}.json`), JSON.stringify(meta));
	console.log(`${id}: геометрия ${(bin / 1048576).toFixed(1)} МБ, картинок ${doc.images?.length ?? 0}, деревьев и травы — ${meta.multimesh.length} пачек, стен ${meta.colliders.length}, тайников ${meta.containers.length}, выходов ${meta.exits.length}`);
}
const stats = {};
for (const id of await page.evaluate(() => window.weaponIds())) {
	const { glb, stats: s } = await page.evaluate((id) => window.exportWeapon(id), id);
	await writeFile(join(OUT, 'weapons', `${id}.glb`), Buffer.from(glb, 'base64'));
	stats[id] = s;
}
await writeFile(join(OUT, 'weapons', 'weapons.json'), JSON.stringify(stats, null, 1));
console.log(`оружие: ${Object.keys(stats).join(', ')}`);
for (const f of await readdir(join(ROOT, 'models', 'game'))) if (f.endsWith('.glb')) await copyFile(join(ROOT, 'models', 'game', f), join(OUT, 'characters', f));
console.log('персонажи скопированы');
if (errors.length) { console.error('ошибки страницы:', errors.slice(0, 5).join(' | ')); process.exitCode = 1; }
await browser.close();
server.close();
