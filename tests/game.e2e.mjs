// Браузерный тест игры: загрузка, бой, патроны и обыск домов, рюкзак, выходы и карта мира, стаб с торговцем,
// новое оружие, второй кластер, перезагрузка кластера, сохранение.
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

async function open(viewport, mobile, sim = 30, storage = null) {
	const page = await browser.newPage({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
	// у каждой страницы своё хранилище: сохранение переносим вручную
	if (storage) await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, storage);
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
	await G(page, () => localStorage.clear());
	// счётчик FPS включается галочкой в меню
	await page.click('#opt-fps');
	check(await G(page, () => !document.getElementById('perf').classList.contains('hidden')), 'в меню включается счётчик FPS');
	await page.click('#btn-new');
	await page.waitForFunction(() => window.__game?.state === 'play' && window.__game.enemies.length > 0, null, { timeout: 60000 });
	const s = await G(page, () => ({ loc: window.__game.loc, n: window.__game.enemies.length, idle: window.__game.enemies.every((e) => e.state === 'idle'), types: [...new Set(window.__game.enemies.map((e) => e.type))].sort().join(), timer: document.getElementById('loc-timer').textContent }));
	check(s.loc === 'zarechny' && s.n >= 20 && s.idle, `новая игра в Заречном: ${s.n} заражённых, все ждут (без волн)`);
	check(s.types === 'runner,stomper', `есть бегуны и топтуны (${s.types})`);
	check(/^[5-6]:\d\d$/.test(s.timer), `таймер перезагрузки кластера на экране: ${s.timer}`);
	await page.waitForTimeout(1500);
	const perf = await G(page, () => ({ calls: window.__game.perf.calls, tris: window.__game.perf.tris, logic: window.__game.perf.logic, text: document.getElementById('perf').textContent }));
	check(perf.calls > 0 && perf.calls < 160 && perf.tris < 350000 && /FPS/.test(perf.text), `нагрузка в кадре: ${perf.calls} вызовов отрисовки, ${Math.round(perf.tris / 1000)}k треугольников, логика ${perf.logic.toFixed(1)} мс`);
	// игрок двигается
	await page.keyboard.down('KeyA');
	await page.waitForTimeout(2500);
	await page.keyboard.up('KeyA');
	const px = await G(page, () => window.__game.player.pos.x);
	check(px < 41, `игрок идёт по клавишам (x=${px.toFixed(1)})`);
	// подходим к заражённым — замечают и нападают, отбиваемся топором
	await G(page, () => { const g = window.__game; g.player.pos.set(-10, 0, 9); g.player.hp = 1e6; g.player.maxHp = 1e6; g.noise(g.player.pos, 22); });
	await page.waitForTimeout(2500);
	const chasing = await G(page, () => window.__game.enemies.filter((e) => e.state !== 'idle').length);
	check(chasing > 0, `заражённые заметили игрока (${chasing} в погоне)`);
	await page.keyboard.down('Space');
	await page.waitForTimeout(6000);
	await page.keyboard.up('Space');
	await page.screenshot({ path: join(OUT, 'game-fight.png') });
	const k = await G(page, () => ({ kills: window.__game.kills, pickups: window.__game.pickups.length + window.__game.bag.spore, ammo: window.__game.pickups.filter((p) => /^ammo/.test(p.kind)).length }));
	check(k.kills > 0, `убито заражённых топором: ${k.kills}`);
	check(k.pickups > 0, 'после убийства выпадают спораны');
	check(k.ammo === 0, 'патроны из заражённых не выпадают');
	// у топора не патроны, а прочность: тупится от ударов и ломается
	const wear = await G(page, () => ({ wear: window.__game.kit.wear.axe, hud: document.getElementById('ammo').textContent }));
	check(wear.wear < 60 && /прочность/.test(wear.hud), `топор тупится от ударов: прочность ${wear.wear}/60, на экране «${wear.hud.trim()}»`);
	await G(page, () => {
		const g = window.__game, p = g.player;
		g.kit.wear.axe = 1;
		const e = g.enemies.find((x) => x.alive);
		e.pos.set(p.pos.x + 1.2, 0, p.pos.z); e.stagger = 5;
		p.cooldown = 0; p.attack();
	});
	await page.waitForFunction(() => window.__game.kit.gear.melee === 'fists', null, { timeout: 30000 }).catch(() => {});
	const broke = await G(page, () => ({ melee: window.__game.kit.gear.melee, owned: window.__game.kit.owned.join(), hud: document.getElementById('ammo').textContent }));
	check(broke.melee === 'fists' && !broke.owned.includes('axe') && /без оружия/.test(broke.hud), `топор сломался на последнем ударе — в руках кулаки (${broke.hud})`);
	// пистолет: выстрел тратит патрон и поднимает шум
	await page.keyboard.press('KeyQ');
	await page.waitForFunction(() => window.__game.player.weapon === 'pistol' && !window.__game.player.equipping, null, { timeout: 20000 });
	const before = await G(page, () => window.__game.player.ammo);
	await page.keyboard.press('Space');
	await page.waitForFunction((b) => window.__game.player.ammo < b || window.__game.player.reloading > 0, before, { timeout: 20000 }).catch(() => {});
	await page.waitForTimeout(500);
	const after = await G(page, () => ({ ammo: window.__game.player.ammo, w: window.__game.player.weapon, casings: (window.__game.casings ?? []).filter((c) => c.life > 0).length }));
	check(after.w === 'pistol' && after.ammo < before, `пистолет стреляет (${before} → ${after.ammo})`);
	check(after.casings > 0, `из ПМ вылетают гильзы (${after.casings})`);
	// патроны конечные: перезарядка берёт из запаса, без патронов пистолет только щёлкает
	// (выпавшее с убитых рядом убираем, чтобы оно не подобралось посреди проверки)
	await G(page, () => { for (const p of window.__game.pickups) if (!p.ground) { p.taken = true; p.mesh.visible = false; } });
	const r0 = await G(page, () => { const g = window.__game; g.player.ammo = 2; g.bag.ammo9 = 3; g.player.reload(); return g.bag.ammo9; });
	await page.waitForFunction(() => window.__game.player.reloading <= 0 && window.__game.player.ammo === 5, null, { timeout: 20000 }).catch(() => {});
	const r1 = await G(page, () => ({ ammo: window.__game.player.ammo, bag: window.__game.bag.ammo9, hud: document.getElementById('ammo').textContent }));
	check(r0 === 3 && r1.ammo === 5 && r1.bag === 0 && r1.hud.replace(/\s/g, '') === '5/0', `перезарядка берёт из запаса: в магазине ${r1.ammo}, в запасе ${r1.bag}, на экране «${r1.hud}»`);
	const dry = await G(page, () => { const g = window.__game, p = g.player; p.ammo = 0; g.bag.ammo9 = 0; p.cooldown = 0; p.attack(); return { ammo: p.ammo, hud: document.getElementById('ammo').textContent }; });
	check(dry.ammo === 0 && /нет патронов/.test(dry.hud), `без патронов не стреляет, на экране «${dry.hud}»`);
	// патроны — в домах: заходим, крыша исчезает, обыскиваем шкаф
	const homes = await G(page, () => { const L = window.__game.level; return { houses: L.buildings.length, containers: L.containers.length }; });
	check(homes.houses >= 4 && homes.containers >= 20, `в дома и магазин можно зайти: зданий ${homes.houses}, тайников ${homes.containers}`);
	await G(page, () => {
		const g = window.__game;
		for (const e of g.enemies) if (e.alive) e.pos.set(40, 0, -40); // чтобы не мешали обыску
		const c = g.level.containers.find((x) => x.building === 'House1' && x.name === 'Шкаф');
		c.items = [['ammo9', 7]];
		g.player.pos.set(c.ax, 0, c.az);
	});
	await page.waitForFunction(() => !document.getElementById('search').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => {});
	const prompt = await G(page, () => document.getElementById('search-name').textContent);
	await page.keyboard.press('KeyE');
	await page.waitForFunction(() => window.__game.bag.ammo9 >= 7, null, { timeout: 20000 }).catch(() => {});
	const found = await G(page, () => ({ ammo: window.__game.bag.ammo9, roof: window.__game.level.buildings[0].fader.value, searched: window.__game.level.containers.find((x) => x.building === 'House1' && x.name === 'Шкаф').searched }));
	check(prompt === 'Шкаф' && found.ammo >= 7 && found.searched, `обыск шкафа в доме: подсказка «${prompt}», в запасе ${found.ammo} патронов`);
	check(found.roof < 0.1, `в доме крыша и верх стен убраны (видимость ${found.roof.toFixed(2)})`);
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

	// все тайники кластеров достижимы от входа, заражённые могут зайти в дома
	const reach = async () => G(page, () => {
		const g = window.__game, L = g.level, { N } = L.nav;
		g.updateFlow();
		// до мебели дотягиваемся с 1.25 м: достаточно, чтобы рядом с точкой обыска была достижимая клетка
		const near = (x0, z0, r) => { const [cx, cz] = L.nav.cell(x0, z0), k = Math.ceil(r / L.nav.CELL); for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue; if (Math.hypot(L.nav.center(x) - x0, L.nav.center(z) - z0) <= r && g.flow[z * N + x] >= 0) return true; } return false; };
		const bad = L.containers.filter((c) => !near(c.ax, c.az, 1.2)).map((c) => `${c.building}/${c.name}`);
		const exits = L.exits.filter((e) => { const [x, z] = L.nav.cell(e.spawn.x, e.spawn.z); return !(g.flow[z * N + x] >= 0); }).length;
		return { n: L.containers.length, bad, exits };
	});
	await G(page, () => window.__game.player.pos.set(0, 0, 6));
	const rz = await reach();
	check(rz.bad.length === 0 && rz.exits === 0, `Заречный: все ${rz.n} тайников и выходы достижимы${rz.bad.length ? ': нет пути к ' + rz.bad.join(', ') : ''}`);

	// зачистка ничего не решает: убили всех — игра продолжается, победы нет
	await G(page, () => { for (const e of window.__game.enemies) if (e.alive) e.damage(1e4, e.pos.clone().add({ x: 1, y: 0, z: 0 }), 0); });
	await page.waitForTimeout(1500);
	check(await G(page, () => window.__game.state === 'play' && document.getElementById('gameover').classList.contains('hidden')), 'после зачистки нет экрана победы — кластер просто ждёт перезагрузки');

	// миникарта в углу: план локации вокруг героя и стрелки к выходам
	const mm = await G(page, () => ({ bg: getComputedStyle(document.getElementById('mm-map')).backgroundImage.startsWith('url("data:image/png'), pointers: document.querySelectorAll('#mm-pointers .mm-pointer').length, shown: document.getElementById('minimap').offsetWidth > 0 }));
	check(mm.bg && mm.shown && mm.pointers === 2, `миникарта: план локации и ${mm.pointers} стрелки к выходам`);
	// карта локации по M: где герой, тайники, выходы; оттуда — на карту Улья
	await page.keyboard.press('KeyM');
	await page.waitForSelector('#locmap:not(.hidden)', { timeout: 20000 }).catch(() => {});
	const lm = await G(page, () => ({ paused: window.__game.paused, boxes: document.querySelectorAll('#lm-svg .lm-box').length, done: document.querySelectorAll('#lm-svg .lm-box.done').length, exits: document.querySelectorAll('#lm-svg .lm-exit').length, you: !!document.querySelector('#lm-svg .lm-you'), info: document.getElementById('lm-info').textContent }));
	check(lm.paused && lm.boxes >= 20 && lm.done >= 1 && lm.exits === 2 && lm.you && /Полис/.test(lm.info), `карта локации: герой, тайников ${lm.boxes} (обыскано ${lm.done}), выходов ${lm.exits}`);
	await page.screenshot({ path: join(OUT, 'game-locmap.png') });
	await page.click('#lm-world');
	check(await G(page, () => window.__game.worldMap.isOpen && document.getElementById('locmap').classList.contains('hidden')), 'с карты локации — на карту Улья');
	await page.click('#wm-stay');
	// уйти можно в любом месте края кластера — в муть
	await G(page, () => window.__game.player.pos.set(10, 0, -40));
	await page.waitForFunction(() => window.__game.exitArmed, null, { timeout: 20000 }).catch(() => {});
	await G(page, () => window.__game.player.pos.set(10, 0, -46.3));
	await page.waitForSelector('#worldmap:not(.hidden)', { timeout: 20000 }).catch(() => {});
	const edge = await G(page, () => ({ open: window.__game.worldMap.isOpen, routes: document.querySelectorAll('#wm-list [data-go]').length }));
	check(edge.open && edge.routes === 2, 'дошёл до края кластера (муть) — открылась карта Улья');
	await page.click('#wm-stay');

	// выход у края кластера открывает карту; уходим в стаб
	await G(page, () => { const g = window.__game; g.player.pos.set(40, 0, 6); });
	await page.waitForFunction(() => window.__game.exitArmed, null, { timeout: 20000 }).catch(() => {});
	await G(page, () => window.__game.player.pos.set(46, 0, 6));
	await page.waitForSelector('#worldmap:not(.hidden)', { timeout: 20000 }).catch(() => {});
	const map = await G(page, () => ({ open: window.__game.worldMap.isOpen, paused: window.__game.paused, routes: [...document.querySelectorAll('#wm-list [data-go]')].map((b) => b.dataset.go) }));
	check(map.open && map.paused && map.routes[0] === 'stab' && map.routes.includes('dachi'), `у выхода открылась карта Улья: ${map.routes.join(', ')}`);
	check(await G(page, () => !!document.querySelector('#wm-svg .wm-hero image') && !!document.querySelector('#wm-svg .wm-road.active')), 'на карте портрет героя и бегущий пунктир дорог');
	await page.screenshot({ path: join(OUT, 'game-map.png') });
	const t0 = await G(page, () => window.__game.world.time);
	await page.click('#wm-list [data-go="stab"]');
	await page.waitForSelector('#travel:not(.hidden)', { timeout: 20000 }).catch(() => {});
	check(await G(page, () => !!document.querySelector('#travel-svg .wm-hero')), 'в дороге портрет героя едет по карте');
	await page.waitForFunction(() => window.__game.loc === 'stab' && window.__game.state === 'play', null, { timeout: 60000 });
	const st = await G(page, () => ({ t: window.__game.world.time, npcs: window.__game.npcs.length, enemies: window.__game.enemies.length, timer: document.getElementById('loc-timer').textContent, saved: !!window.__game.world.clusters.zarechny.saved }));
	check(st.t - t0 >= 60, `дорога заняла время мира: ${Math.round(st.t - t0)} с`);
	check(st.npcs >= 5 && st.enemies === 0 && st.timer === 'безопасно', `стаб: жителей ${st.npcs}, заражённых нет, «${st.timer}»`);
	check(st.saved, 'состояние Заречного запомнено до его перезагрузки');
	// торговец: покупка автомата и патронов, обмен гороха
	await G(page, () => { const g = window.__game; g.bag.spore = 120; g.bag.peas = 2; g.player.pos.set(-11, 0, 0.1); });
	await page.waitForFunction(() => document.getElementById('search-verb').textContent === 'Торговать' && !document.getElementById('search').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => {});
	await page.keyboard.press('KeyE');
	await page.waitForSelector('#trade:not(.hidden)', { timeout: 20000 }).catch(() => {});
	await page.screenshot({ path: join(OUT, 'game-trade.png') });
	check(await G(page, () => document.getElementById('trade-avatar').src.startsWith('data:image/png')), 'у торговца свой портрет');
	await page.click('#trade-peas-all');
	const buyAks = await G(page, () => {
		const buy = (name) => [...document.querySelectorAll('[data-buy]')].find((x) => x.closest('.offer').querySelector('b').textContent === name).click();
		buy('АКС-74У'); buy('Патроны 5,45×39 ×30'); buy('Топор');
		const g = window.__game;
		return { spore: g.bag.spore, gear: g.kit.gear.gun, mag: g.kit.mags.aks, spare: g.bag.ammo545, melee: g.kit.gear.melee, wear: g.kit.wear.axe };
	});
	check(buyAks.spore === 120 + 10 - 80 - 15 - 8 && buyAks.gear === 'aks' && buyAks.mag === 30 && buyAks.spare === 30, `купили АКС-74У и 30 патронов 5,45 (горох обменян): осталось ${buyAks.spore} споранов`);
	check(buyAks.melee === 'axe' && buyAks.wear === 60, `новый топор вместо сломанного: прочность ${buyAks.wear}/60`);
	await page.click('#trade-close');
	// автомат: очередь при зажатой кнопке
	await G(page, () => { const g = window.__game; g.player.hp = g.player.maxHp = 1e6; });
	// купленный ствол сразу в слоте огнестрела; берём его в руки (Q — смена между слотами)
	if ((await G(page, () => window.__game.player.hold)) !== 'gun') await page.keyboard.press('KeyQ');
	await page.waitForFunction(() => window.__game.player.weapon === 'aks' && !window.__game.player.equipping, null, { timeout: 30000 });
	await page.waitForTimeout(600);
	const clipR = await G(page, () => window.__game.player.current);
	await page.keyboard.down('Space');
	await page.waitForFunction(() => window.__game.kit.mags.aks <= 25 || window.__game.player.reloading > 0, null, { timeout: 30000 }).catch(() => {});
	await page.keyboard.up('Space');
	const burst = await G(page, () => ({ ammo: window.__game.kit.mags.aks, w: window.__game.player.weapon, clip: window.__game.player.current }));
	check(burst.w === 'aks' && burst.ammo <= 25 && /Rifle/.test(clipR), `АКС: очередь при зажатой атаке (${30 - burst.ammo} выстрелов), анимации автомата (${clipR}, ${burst.clip})`);
	await page.screenshot({ path: join(OUT, 'game-rifle.png') });
	// лекарь: отдых двигает время мира
	const rest = await G(page, () => { const g = window.__game, t = g.world.time; g.player.hp = 30; g.player.maxHp = 100; g.rest(); const r = { dt: g.world.time - t, hp: g.player.hp }; g.player.hp = g.player.maxHp = 1e6; return r; });
	check(rest.dt >= 100 && rest.hp === 100, `отдых у лекаря: здоровье ${rest.hp}, прошло ${rest.dt} с`);
	// сохранение и «Продолжить»
	const saved = await G(page, () => JSON.parse(localStorage.getItem('ulei-cluster17-save') ?? 'null'));
	check(saved?.world?.at === 'stab' && saved.kit.owned.includes('aks'), 'игра сохранена в стабе (с купленным автоматом)');

	// второй кластер — Дачи: заражённые, тайники, всё достижимо
	await G(page, () => window.__game.travel('dachi'));
	await page.waitForFunction(() => window.__game.loc === 'dachi' && window.__game.state === 'play', null, { timeout: 300000 });
	const d = await G(page, () => ({ n: window.__game.enemies.length, c: window.__game.level.containers.length, b: window.__game.level.buildings.length }));
	check(d.n >= 15 && d.c >= 20 && d.b >= 8, `Дачи: ${d.n} заражённых, домиков ${d.b}, тайников ${d.c}`);
	await G(page, () => window.__game.player.pos.set(0, 0, 4));
	const rd = await reach();
	check(rd.bad.length === 0 && rd.exits === 0, `Дачи: все ${rd.n} тайников и выходы достижимы${rd.bad.length ? ': нет пути к ' + rd.bad.join(', ') : ''}`);
	await G(page, () => { const g = window.__game; g.player.pos.set(8, 0, 6.5); });
	await page.waitForTimeout(1500);
	await page.screenshot({ path: join(OUT, 'game-dachi.png') });
	// обрез: картечь задевает нескольких
	const shot = await G(page, () => {
		const g = window.__game, p = g.player;
		p.pos.set(-26, 0, 4); // на дороге, вокруг пусто
		g.kit.owned.push('obrez'); g.kit.mags.obrez = 2; p.hold = 'gun'; g.equipGear('obrez');
		const es = g.enemies.filter((e) => e.alive && e.type === 'runner' && e.hp >= 60).slice(0, 3);
		// остальных отводим подальше, чтобы ближайшей целью были эти трое
		for (const e of g.enemies) if (!es.includes(e)) { e.pos.set(40, 0, -40); e.stagger = 5; }
		es.forEach((e, i) => { e.pos.set(p.pos.x - 2.5, 0, p.pos.z + (i - 1) * 0.35); e.stagger = 5; });
		window.__targets = es;
		p.root.rotation.y = -Math.PI / 2; p.cooldown = 0; p.attack();
		return es.map((e) => e.hp);
	});
	// кадр программного рендера бывает дольше секунды — ждём, пока дробь долетит
	await page.waitForFunction(() => window.__targets.filter((e) => e.hp < 60).length >= 2, null, { timeout: 30000 }).catch(() => {});
	const hurt = await G(page, () => window.__targets.filter((e) => e.hp < 60).length);
	check(shot.length === 3 && hurt >= 2, `обрез: картечь задела ${hurt} бегунов`);

	// возвращение в кластер до перезагрузки: всё как было
	const before2 = await G(page, () => { const g = window.__game; for (const e of g.enemies.slice(0, 5)) e.damage(1e4, e.pos.clone().add({ x: 1, y: 0, z: 0 }), 0); g.world.clusters.dachi.next = g.world.time + 400; return g.enemies.filter((e) => e.alive).length; });
	await G(page, () => window.__game.travel('zarechny'));
	await page.waitForFunction(() => window.__game.loc === 'zarechny' && window.__game.state === 'play', null, { timeout: 300000 });
	await G(page, () => window.__game.travel('dachi'));
	await page.waitForFunction(() => window.__game.loc === 'dachi' && window.__game.state === 'play', null, { timeout: 300000 });
	const back = await G(page, () => window.__game.enemies.filter((e) => e.alive).length);
	check(back === before2, `вернулись в Дачи до перезагрузки — убитые не ожили (${before2} → ${back})`);

	// перезагрузка кластера, пока герой внутри: кислый запах, муть, смерть; очнулся в стабе без рюкзака
	await G(page, () => { const g = window.__game; g.bag.spore = 7; g.bag.ammo545 = 11; g.world.clusters.dachi.next = g.world.time + 20; });
	await page.waitForFunction(() => window.__game.warnStage >= 1, null, { timeout: 60000 }).catch(() => {});
	const sour = await G(page, () => ({ fog: window.__game.level && document.getElementById('sour').style.opacity, stage: window.__game.warnStage }));
	await page.screenshot({ path: join(OUT, 'game-sour.png') });
	check(sour.stage >= 1 && +sour.fog > 0.2, `перед перезагрузкой: кислый запах и муть (дымка ${sour.fog})`);
	await page.waitForSelector('#gameover:not(.hidden)', { timeout: 90000 }).catch(() => {});
	const dead = await G(page, () => ({ title: document.getElementById('go-title').textContent, stats: document.getElementById('go-stats').textContent }));
	check(dead.title === 'Кластер перезагрузился' && /споран ×7/.test(dead.stats), `не успел уйти: «${dead.title}», ${dead.stats}`);
	await page.click('#btn-respawn');
	await page.waitForFunction(() => window.__game.loc === 'stab' && window.__game.state === 'play', null, { timeout: 60000 });
	const re = await G(page, () => { const g = window.__game; return { spore: g.bag.spore, ammo: g.bag.ammo545, owned: g.kit.owned.join(), hp: g.player.hp, fresh: !g.world.clusters.dachi.saved }; });
	check(re.spore === 0 && re.ammo === 0 && re.owned.includes('aks') && re.hp === 100 && re.fresh, `очнулся в стабе: рюкзак пуст, оружие при себе (${re.owned}), Дачи перезагрузились`);
	const storage = await G(page, () => ({ ...localStorage }));
	await page.close();

	// «Продолжить» после перезагрузки страницы
	const p2 = await open({ width: 1000, height: 600 }, false, 30, storage);
	const cont = await G(p2, () => !document.getElementById('btn-continue').classList.contains('hidden'));
	await p2.click('#btn-continue');
	await p2.waitForFunction(() => window.__game?.state === 'play', null, { timeout: 60000 });
	const c2 = await G(p2, () => ({ loc: window.__game.loc, owned: window.__game.kit.owned.join() }));
	check(cont && c2.loc === 'stab' && c2.owned.includes('aks'), `«Продолжить»: снова в стабе, оружие сохранено (${c2.owned})`);
	await G(p2, () => localStorage.clear());
	await p2.close();

	// телефон в вертикальном положении: игра всё равно горизонтальная; кнопки атаки — тап/удержание/отпускание.
	// Логика здесь в реальном времени (без ?sim), чтобы проверить темп стрельбы.
	const m = await open({ width: 390, height: 844 }, true, 0);
	await m.tap('#btn-new');
	await m.waitForTimeout(1000);
	// собственный размер холста (до CSS-поворота) — горизонтальный
	const land = await G(m, () => { const c = document.querySelector('#game canvas'); return { rotated: document.body.classList.contains('rotated'), w: c.clientWidth, h: c.clientHeight }; });
	check(land.rotated && land.w > land.h * 1.5, `на вертикальном телефоне игра идёт горизонтально (${land.w}×${land.h})`);
	const box = await m.locator('#btn-attack').boundingBox();
	check(box && box.width >= 80, 'на телефоне есть крупная кнопка атаки');
	await G(m, () => { const p = window.__game.player; p.hold = 'gun'; p.attachGear(); p.hp = p.maxHp = 1e6; });
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
