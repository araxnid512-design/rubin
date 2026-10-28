// Браузерный тест игры: загрузка уровня и юнитов, заражённые на местах, бой, подбор споранов, смерть/победа.
// Логика ускорена (?sim=30), потому что программный рендер в CI медленный.
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed = true; };
const errors = [];

async function open(viewport, mobile) {
	const page = await browser.newPage({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
		const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
		route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
	});
	await page.goto(`http://localhost:${server.address().port}/game.html?sim=30`);
	await page.waitForSelector('#menu:not(.hidden)', { timeout: 120000 });
	return page;
}
const G = (page, fn) => page.evaluate(fn);

try {
	const page = await open({ width: 1100, height: 700 });
	check(true, 'уровень и модели загрузились, меню показано');
	await page.screenshot({ path: join(OUT, 'game-menu.png') });
	await page.click('#btn-start');
	await page.waitForTimeout(1500);
	const s = await G(page, () => ({ n: window.__game.enemies.length, idle: window.__game.enemies.every((e) => e.state === 'idle'), types: [...new Set(window.__game.enemies.map((e) => e.type))].sort().join() }));
	check(s.n >= 20 && s.idle, `в кластере уже ${s.n} заражённых, все ждут (без волн)`);
	check(s.types === 'runner,stomper', `есть бегуны и топтуны (${s.types})`);
	// игрок двигается
	await page.keyboard.down('KeyA');
	await page.waitForTimeout(2500);
	await page.keyboard.up('KeyA');
	const px = await G(page, () => window.__game.player.pos.x);
	check(px < 38, `игрок идёт по клавишам (x=${px.toFixed(1)})`);
	// подходим к заражённым — замечают и нападают, отбиваемся топором
	await G(page, () => { const g = window.__game; g.player.pos.set(-10, 0, 9); g.player.hp = 1e6; g.player.maxHp = 1e6; g.noise(g.player.pos, 22); });
	await page.waitForTimeout(2500);
	const chasing = await G(page, () => window.__game.enemies.filter((e) => e.state !== 'idle').length);
	check(chasing > 0, `заражённые заметили игрока (${chasing} в погоне)`);
	await page.keyboard.down('Space');
	await page.waitForTimeout(6000);
	await page.keyboard.up('Space');
	await page.screenshot({ path: join(OUT, 'game-fight.png') });
	const k = await G(page, () => ({ kills: window.__game.kills, pickups: window.__game.pickups.length + window.__game.spores }));
	check(k.kills > 0, `убито заражённых топором: ${k.kills}`);
	check(k.pickups > 0, 'после убийства выпадают спораны');
	// пистолет: выстрел тратит патрон и поднимает шум
	await page.keyboard.press('KeyQ');
	await page.waitForFunction(() => window.__game.player.weapon === 'pistol', null, { timeout: 20000 });
	const before = await G(page, () => window.__game.player.ammo);
	await page.keyboard.press('Space');
	await page.waitForFunction((b) => window.__game.player.ammo < b || window.__game.player.reloading > 0, before, { timeout: 20000 }).catch(() => {});
	const after = await G(page, () => ({ ammo: window.__game.player.ammo, w: window.__game.player.weapon }));
	check(after.w === 'pistol' && after.ammo < before, `пистолет стреляет (${before} → ${after.ammo})`);
	// победа: добиваем всех
	await G(page, () => { for (const e of window.__game.enemies) if (e.alive) e.damage(1e4, e.pos.clone().add({ x: 1, y: 0, z: 0 }), 0); });
	await page.waitForSelector('#gameover:not(.hidden)', { timeout: 30000 });
	check((await page.textContent('#go-title')) === 'Кластер зачищен', 'экран победы после зачистки кластера');
	await page.close();

	// телефон: джойстик и кнопки
	const m = await open({ width: 390, height: 844 }, true);
	await m.click('#btn-start');
	await m.waitForTimeout(1000);
	const box = await m.locator('#btn-attack').boundingBox();
	check(box && box.width >= 80, 'на телефоне есть крупная кнопка атаки');
	await m.screenshot({ path: join(OUT, 'game-phone.png') });
	await m.close();
	check(errors.length === 0, `нет ошибок в консоли${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
	check(false, e.message);
} finally {
	await browser.close();
	server.close();
}
console.log(failed ? 'GAME E2E: FAIL' : 'GAME E2E: OK');
process.exit(failed ? 1 : 0);
