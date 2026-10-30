// Скачиваемая версия (download/ulei-cluster17.html, собирает scripts/build-offline.mjs): открывается с диска
// (file://) при выключенной сети — меню, новая игра, звуки, переход в другой кластер, сохранение.
// Запуск: npm run test:offline

import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'download', 'ulei-cluster17.html');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };
if (!existsSync(FILE)) { console.error(`нет ${FILE} — сначала npm run build:offline`); process.exit(1); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
	const ctx = await browser.newContext({ viewport: { width: 1000, height: 560 }, offline: true });
	const page = await ctx.newPage();
	const errors = [], net = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	// единственный запрос наружу — проверка обновления на GitHub: отвечаем «в релизе файл новее на день»
	const RELEASE = 'https://api.github.com/repos/araxnid512-design/rubin/releases/tags/game';
	let asked = 0;
	await page.route(/^https?:/, (r) => {
		if (r.request().url() === RELEASE) { asked++; return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ assets: [{ name: 'ulei-cluster17.html', updated_at: new Date(Date.now() + 864e5).toISOString() }] }) }); }
		net.push(r.request().url()); r.abort();
	});
	await page.goto(pathToFileURL(FILE).href);
	await page.waitForSelector('#menu:not(.hidden)', { timeout: 300000 });
	const menu = await page.evaluate(() => ({ note: document.getElementById('offline-note').textContent, download: !document.getElementById('download').classList.contains('hidden') }));
	check(/Скачанная версия, сборка от .*\d:\d\d · [0-9a-f]{7}/.test(menu.note) && !menu.download, `меню скачанной версии: «${menu.note.slice(0, 64)}…», кнопки «скачать» нет`);
	await page.waitForSelector('#update:not(.hidden)', { timeout: 20000 }).catch(() => {});
	const upd = await page.evaluate(() => ({ shown: !document.getElementById('update').classList.contains('hidden'), href: document.getElementById('update').href, text: document.getElementById('update').textContent }));
	check(asked === 1 && upd.shown && upd.href.endsWith('/releases/download/game/ulei-cluster17.html'), `на GitHub файл новее — в меню «${upd.text.trim().slice(0, 60)}…»`);
	await page.click('#btn-new');
	await page.waitForFunction(() => window.__game?.state === 'play' && window.__game.enemies.length > 0, null, { timeout: 120000 }).catch(() => {});
	await page.waitForFunction(() => window.__game.sounds()[0] === window.__game.sounds()[1], null, { timeout: 60000 }).catch(() => {});
	const g = await page.evaluate(() => ({ loc: window.__game.loc, n: window.__game.enemies.length, sounds: window.__game.sounds() }));
	check(g.loc === 'zarechny' && g.n >= 20, `новая игра без сети: Заречный, заражённых ${g.n} (модели встроены)`);
	check(g.sounds[0] === g.sounds[1] && g.sounds[1] >= 40, `звуки встроены: ${g.sounds[0]}/${g.sounds[1]}`);
	await page.evaluate(() => window.__game.travel('dachi'));
	await page.waitForFunction(() => window.__game.loc === 'dachi' && window.__game.state === 'play', null, { timeout: 300000 }).catch(() => {});
	const saved = await page.evaluate(() => ({ loc: window.__game.loc, save: !!localStorage.getItem('ulei-cluster17-save') }));
	check(saved.loc === 'dachi' && saved.save, `переход в Дачи и сохранение в браузере (${saved.loc})`);
	check(net.length === 0, `без запросов в сеть${net.length ? `: ${net.slice(0, 3).join(', ')}` : ''}`);
	check(errors.length === 0, `нет ошибок в консоли${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
} finally {
	await browser.close();
}
console.log(failed ? 'OFFLINE E2E: FAIL' : 'OFFLINE E2E: OK');
process.exit(failed ? 1 : 0);
