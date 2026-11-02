// Иконка игры для Godot-версии: рендер из моделей игры (tools/icon.html) → godot/icons/
// (icon_512.png — иконка проекта, icon_192.png — обычная, fg/bg/mono_432.png — адаптивная иконка Android).
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'godot', 'icons');
await mkdir(OUT, { recursive: true });
const server = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
	const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
	route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
});
await page.goto(`http://localhost:${server.address().port}/tools/icon.html`);
await page.waitForFunction(() => window.ready || window.onerror, null, { timeout: 120000 });
const icons = await page.evaluate(() => window.icons());
const names = { icon512: 'icon_512.png', icon192: 'icon_192.png', fg432: 'fg_432.png', bg432: 'bg_432.png', mono432: 'mono_432.png' };
for (const [k, file] of Object.entries(names)) await writeFile(join(OUT, file), Buffer.from(icons[k].split(',')[1], 'base64'));
console.log('иконки:', Object.values(names).join(', '));
if (errors.length) { console.error(errors.join(' | ')); process.exitCode = 1; }
await browser.close();
server.close();
