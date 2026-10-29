// Превью локаций для карты Улья: снимки из tools/preview.html → assets/previews/<id>.jpg
// Запуск: node scripts/render-previews.mjs [id ...]  (нужен Playwright с Chromium)

import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/previews');
await mkdir(OUT, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['zarechny', 'dachi', 'stab'];
const server = await startServer(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
	for (const id of ids) {
		const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
		page.on('pageerror', (e) => console.log('ERR', e.message));
		// three.js — из node_modules, без сети
		await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
			const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
			route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
		});
		await page.goto(`http://localhost:${server.address().port}/tools/preview.html?id=${id}`);
		await page.waitForFunction(() => window.ready, null, { timeout: 600000 });
		const url = await page.evaluate(() => window.shot());
		const file = join(OUT, `${id}.jpg`);
		await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
		console.log(`${id}.jpg: ${Math.round((url.length * 3) / 4 / 1024)} КБ`);
		await page.close();
	}
} finally {
	await browser.close();
	server.close();
}
