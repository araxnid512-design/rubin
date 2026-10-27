// Браузерный тест просмотрщика: открывает страницу, проигрывает все 5 анимаций,
// проверяет отсутствие ошибок и сохраняет скриншоты в test-output/.
// Требуется Playwright (npm i -D playwright && npx playwright install chromium).
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'test-output');
await mkdir(OUT, { recursive: true });

const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// Three.js берём из node_modules вместо CDN — тест работает офлайн.
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
	const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
	route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
});

let failed = false;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed = true; };

try {
	await page.goto(url);
	await page.waitForFunction(() => window.__zombie?.current === 'Idle', null, { timeout: 15000 });
	for (const source of ['procedural', 'glb']) {
		if (source === 'glb') {
			await page.selectOption('#source', 'glb');
			await page.waitForFunction(() => window.__zombie.source === 'glb' && window.__zombie.clips.length === 5 && window.__zombie.current === 'Idle', null, { timeout: 15000 });
		}
		const names = await page.evaluate(() => window.__zombie.clips.map((c) => c.name));
		check(names.join() === 'Idle,Walk,Run,Attack,Death', `[${source}] 5 анимаций: ${names.join(', ')}`);
		for (const name of names) {
			await page.click(`#anims button[data-name="${name}"]`);
			await page.waitForTimeout(name === 'Death' ? 2600 : 900);
			const s = await page.evaluate(() => ({ cur: window.__zombie.current, t: window.__zombie.actions[window.__zombie.current].time }));
			check(s.cur === name && s.t > 0, `[${source}] ${name} играет (t=${s.t.toFixed(2)})`);
			if (source === 'procedural') await page.screenshot({ path: join(OUT, `${name}.png`) });
		}
	}
	check(errors.length === 0, `нет ошибок в консоли${errors.length ? ': ' + errors.join(' | ') : ''}`);
} catch (e) {
	check(false, e.message);
} finally {
	await browser.close();
	server.close();
}
console.log(failed ? 'E2E: FAIL' : `E2E: OK, скриншоты в ${OUT}`);
process.exit(failed ? 1 : 0);
