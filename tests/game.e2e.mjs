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

async function open(viewport, mobile, sim = 30) {
	const page = await browser.newPage({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
		const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
		route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
	});
	await page.goto(`http://localhost:${server.address().port}/game.html?sim=${sim}`);
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
	const k = await G(page, () => ({ kills: window.__game.kills, pickups: window.__game.pickups.length + window.__game.bag.spore, ammo: window.__game.pickups.filter((p) => p.kind === 'ammo').length }));
	check(k.kills > 0, `убито заражённых топором: ${k.kills}`);
	check(k.pickups > 0, 'после убийства выпадают спораны');
	check(k.ammo === 0, 'патроны из заражённых не выпадают'); 
	// пистолет: выстрел тратит патрон и поднимает шум
	await page.keyboard.press('KeyQ');
	await page.waitForFunction(() => window.__game.player.weapon === 'pistol', null, { timeout: 20000 });
	const before = await G(page, () => window.__game.player.ammo);
	await page.keyboard.press('Space');
	await page.waitForFunction((b) => window.__game.player.ammo < b || window.__game.player.reloading > 0, before, { timeout: 20000 }).catch(() => {});
	const after = await G(page, () => ({ ammo: window.__game.player.ammo, w: window.__game.player.weapon }));
	check(after.w === 'pistol' && after.ammo < before, `пистолет стреляет (${before} → ${after.ammo})`);
	// патроны конечные: перезарядка берёт из запаса, без патронов пистолет только щёлкает
	// (выпавшее с убитых рядом убираем, чтобы оно не подобралось посреди проверки)
	await G(page, () => { for (const p of window.__game.pickups) if (!p.ground) { p.taken = true; p.mesh.visible = false; } });
	const r0 = await G(page, () => { const g = window.__game; g.player.ammo = 2; g.bag.ammo = 3; g.player.reload(); return g.bag.ammo; });
	await page.waitForFunction(() => window.__game.player.reloading <= 0 && window.__game.player.ammo === 5, null, { timeout: 20000 }).catch(() => {});
	const r1 = await G(page, () => ({ ammo: window.__game.player.ammo, bag: window.__game.bag.ammo, hud: document.getElementById('ammo').textContent }));
	check(r0 === 3 && r1.ammo === 5 && r1.bag === 0 && r1.hud.replace(/\s/g, '') === '5/0', `перезарядка берёт из запаса: в магазине ${r1.ammo}, в запасе ${r1.bag}, на экране «${r1.hud}»`);
	const dry = await G(page, () => { const g = window.__game, p = g.player; p.ammo = 0; g.bag.ammo = 0; p.cooldown = 0; p.attack(); return { ammo: p.ammo, hud: document.getElementById('ammo').textContent }; });
	check(dry.ammo === 0 && /нет патронов/.test(dry.hud), `без патронов не стреляет, на экране «${dry.hud}»`);
	// патроны — в домах: заходим, крыша исчезает, обыскиваем шкаф
	const homes = await G(page, () => { const L = window.__game.level; return { houses: L.buildings.length, containers: L.containers.length }; });
	check(homes.houses >= 4 && homes.containers >= 20, `в дома и магазин можно зайти: зданий ${homes.houses}, тайников ${homes.containers}`);
	await G(page, () => {
		const g = window.__game;
		for (const e of g.enemies) if (e.alive) e.pos.set(40, 0, -40); // чтобы не мешали обыску
		const c = g.level.containers.find((x) => x.building === 'House1' && x.name === 'Шкаф');
		c.items = [['ammo', 7]];
		g.player.pos.set(c.ax, 0, c.az);
	});
	await page.waitForFunction(() => !document.getElementById('search').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => {});
	const prompt = await G(page, () => document.getElementById('search-name').textContent);
	await page.keyboard.press('KeyE');
	await page.waitForFunction(() => window.__game.bag.ammo >= 7, null, { timeout: 20000 }).catch(() => {});
	const found = await G(page, () => ({ ammo: window.__game.bag.ammo, roof: window.__game.level.buildings[0].fader.value, searched: window.__game.level.containers.find((x) => x.building === 'House1' && x.name === 'Шкаф').searched }));
	check(prompt === 'Шкаф' && found.ammo >= 7 && found.searched, `обыск шкафа в доме: подсказка «${prompt}», в запасе ${found.ammo} патронов`);
	check(found.roof < 0.1, `в доме крыша и верх стен убраны (видимость ${found.roof.toFixed(2)})`);
	const path = await G(page, () => { const g = window.__game, L = g.level; g.updateFlow(); const [gx, gz] = L.nav.cell(-30, -22); return g.flow[gz * L.nav.N + gx]; });
	check(path > 0, `заражённые могут зайти в дом за героем (путь ${path} клеток)`);
	// рюкзак: открывается по I, ставит игру на паузу, живчик из рюкзака лечит
	await page.keyboard.press('KeyI');
	await page.waitForSelector('#inventory:not(.hidden)', { timeout: 20000 }).catch(() => {});
	const inv = await G(page, () => { const g = window.__game; g.player.hp = 40; g.player.maxHp = 100; g.bag.zhivchik = 2; g.inventory.select('zhivchik'); return { paused: g.paused, slots: document.querySelectorAll('#inv-grid [data-item]').length, icon: document.querySelector('#inv-grid img')?.src.startsWith('data:image/png') }; });
	check(inv.paused && inv.slots >= 2 && inv.icon, `рюкзак открыт, игра на паузе, ячеек с предметами: ${inv.slots}, иконки из 3D-моделей`);
	await page.click('#inv-action');
	const healed = await G(page, () => ({ hp: window.__game.player.hp, zh: window.__game.bag.zhivchik }));
	check(healed.hp === 85 && healed.zh === 1, `живчик из рюкзака: здоровье ${healed.hp}, осталось ${healed.zh}`);
	await page.keyboard.press('KeyI');
	await page.waitForSelector('#inventory.hidden', { timeout: 20000 }).catch(() => {});
	check(!(await G(page, () => window.__game.paused)), 'рюкзак закрывается, игра продолжается');
	await G(page, () => { const p = window.__game.player; p.hp = p.maxHp = 1e6; });
	check(await G(page, () => document.getElementById('avatar').src.startsWith('data:image/png')), 'портрет героя в углу экрана');
	// победа: добиваем всех
	await G(page, () => { for (const e of window.__game.enemies) if (e.alive) e.damage(1e4, e.pos.clone().add({ x: 1, y: 0, z: 0 }), 0); });
	await page.waitForSelector('#gameover:not(.hidden)', { timeout: 30000 });
	check((await page.textContent('#go-title')) === 'Кластер зачищен', 'экран победы после зачистки кластера');
	await page.close();

	// телефон в вертикальном положении: игра всё равно горизонтальная; кнопки атаки — тап/удержание/отпускание.
	// Логика здесь в реальном времени (без ?sim), чтобы проверить темп стрельбы.
	const m = await open({ width: 390, height: 844 }, true, 0);
	await m.tap('#btn-start');
	await m.waitForTimeout(1000);
	// собственный размер холста (до CSS-поворота) — горизонтальный
	const land = await G(m, () => { const c = document.querySelector('#game canvas'); return { rotated: document.body.classList.contains('rotated'), w: c.clientWidth, h: c.clientHeight }; });
	check(land.rotated && land.w > land.h * 1.5, `на вертикальном телефоне игра идёт горизонтально (${land.w}×${land.h})`);
	const box = await m.locator('#btn-attack').boundingBox();
	check(box && box.width >= 80, 'на телефоне есть крупная кнопка атаки');
	await G(m, () => { const p = window.__game.player; p.setWeapon('pistol'); p.hp = p.maxHp = 1e6; });
	const ammo = () => G(m, () => window.__game.player.ammo);
	const settle = async () => { await m.waitForFunction(() => window.__game.player.cooldown <= 0 && window.__game.player.trigger <= 0, null, { timeout: 20000 }); await m.waitForTimeout(400); };
	await settle();
	const a0 = await ammo();
	await m.tap('#btn-attack');
	await m.waitForFunction((a) => window.__game.player.ammo < a, a0, { timeout: 20000 }).catch(() => {});
	await m.waitForTimeout(1500);
	const a1 = await ammo();
	check(a0 - a1 === 1, `тап по кнопке — ровно один выстрел (${a0} → ${a1})`);
	// удержание: серия выстрелов; отпустили — стрельба прекращается
	const btn = await m.locator('#btn-attack').boundingBox();
	const cx = btn.x + btn.width / 2, cy = btn.y + btn.height / 2;
	const cdp = await m.context().newCDPSession(m);
	await settle();
	const b0 = await ammo();
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
	await m.waitForFunction((a) => window.__game.player.ammo <= a - 3 || window.__game.player.reloading > 0, b0, { timeout: 30000 }).catch(() => {});
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	const b1 = await ammo();
	await m.waitForTimeout(2500);
	const b2 = await ammo();
	check(b0 - b1 >= 3, `зажатая кнопка — серия выстрелов (${b0} → ${b1})`);
	check(b2 === b1 && !(await G(m, () => window.__game.input.held('attack'))), `отпустили палец — стрельба прекратилась (${b1} → ${b2})`);
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
