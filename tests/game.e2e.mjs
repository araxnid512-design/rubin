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

// основной прогон — на среднем качестве: программный рендер теста (без видеокарты) тянет цепочку пост-обработки
// высокого качества по секунде на кадр; высокое проверяется отдельной страницей в конце
async function open(viewport, mobile, sim = 30, storage = null, q = 'medium') {
	const page = await browser.newPage({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
	// у каждой страницы своё хранилище: сохранение переносим вручную
	if (storage) await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, storage);
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => {
		const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.170.0/', '');
		route.fulfill({ path: join(ROOT, 'node_modules/three', rel), contentType: 'text/javascript' });
	});
	await page.goto(`http://localhost:${server.address().port}/game.html?sim=${sim}${q ? `&q=${q}` : ''}`);
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
	// проверки идут дольше шести игровых минут: чтобы кластеры не перезагрузились посреди теста, отодвигаем сроки
	// (перезагрузку проверяем отдельно ниже); героя, пока идут проверки, не загрызут (живчик и лекаря — отдельно)
	await G(page, () => { for (const c of Object.values(window.__game.world.clusters)) c.next = window.__game.world.time + 1e6; const p = window.__game.player; p.hp = p.maxHp = 1e6; });
	await page.waitForTimeout(1500);
	const perf = await G(page, () => ({ calls: window.__game.perf.calls, tris: window.__game.perf.tris, logic: window.__game.perf.logic, text: document.getElementById('perf').textContent, post: Object.keys(window.__game.post.passes) }));
	// на высоком качестве (компьютер) кадр идёт через пост-обработку: AO рисует сцену второй раз (нормали), без теней
	const budget = perf.post.includes('ao') ? 280 : 160;
	check(perf.calls > 0 && perf.calls < budget && perf.tris < 400000 && /FPS/.test(perf.text), `нагрузка в кадре: ${perf.calls} вызовов отрисовки, ${Math.round(perf.tris / 1000)}k треугольников, логика ${perf.logic.toFixed(1)} мс`);
	// игрок двигается
	await page.keyboard.down('KeyA');
	await page.waitForTimeout(2500);
	await page.keyboard.up('KeyA');
	const px = await G(page, () => window.__game.player.pos.x);
	check(px < 41, `игрок идёт по клавишам (x=${px.toFixed(1)})`);
	// ноги не скользят: пока стопа на земле, она почти стоит (скорость анимации = скорость героя)
	await G(page, () => {
		const g = window.__game, p = g.player;
		const bones = ['mixamorigLeftToeBase', 'mixamorigRightToeBase'].map((n) => p.model.getObjectByName(n));
		const rec = window.__feet = [];
		const orig = p.update.bind(p);
		p.update = (dt, input) => { orig(dt, input); p.root.updateMatrixWorld(true); rec.push({ dt, f: bones.map((b) => b.getWorldPosition(p.pos.clone())) }); };
		p.pos.set(-30, 0, 6);
		g.input.stick = { x: 0.4, y: 0 }; g.input.sync();
	});
	await page.waitForFunction(() => window.__feet.length > 90, null, { timeout: 60000 }).catch(() => {});
	const slide = await G(page, () => {
		const g = window.__game, rec = window.__feet.slice(10), sp = [];
		g.input.stick = { x: 0, y: 0 }; g.input.sync();
		delete g.player.update; // снова метод класса
		for (let k = 0; k < 2; k++) for (let i = 1; i < rec.length; i++) {
			const a = rec[i - 1].f[k], b = rec[i].f[k];
			if (a.y < 0.07 && b.y < 0.07) sp.push(Math.hypot(b.x - a.x, b.z - a.z) / rec[i].dt);
		}
		sp.sort((x, y) => x - y);
		return { median: sp[Math.floor(sp.length / 2)] ?? 9, clip: g.player.current };
	});
	check(slide.median < 0.35, `шаг без скольжения: стопа на земле движется ${slide.median.toFixed(2)} м/с (${slide.clip})`);
	// подходим к заражённым — замечают и нападают, отбиваемся топором
	await G(page, () => { const g = window.__game; g.player.pos.set(-10, 0, 9); g.player.hp = 1e6; g.player.maxHp = 1e6; g.noise(g.player.pos, 22); });
	await page.waitForTimeout(2500);
	const chasing = await G(page, () => window.__game.enemies.filter((e) => e.state !== 'idle').length);
	check(chasing > 0, `заражённые заметили игрока (${chasing} в погоне)`);
	// топтун в погоне идёт своим тяжёлым шагом
	const stomp = await G(page, () => { const g = window.__game, e = g.enemies.find((x) => x.type === 'stomper' && x.alive); e.pos.set(g.player.pos.x - 8, 0, g.player.pos.z); e.alert(); e.state = 'chase'; return !!e.actions.Stomp; });
	await page.waitForFunction(() => window.__game.enemies.some((x) => x.type === 'stomper' && x.current === 'Stomp'), null, { timeout: 20000 }).catch(() => {});
	check(stomp && await G(page, () => window.__game.enemies.some((x) => x.type === 'stomper' && x.current === 'Stomp')), 'топтун в погоне идёт тяжёлым шагом (клип Stomp)');
	await G(page, () => { for (const e of window.__game.enemies) if (e.type === 'stomper') { e.pos.set(40, 0, -44); e.state = 'idle'; } }); // не мешает драке с бегунами
	// двое бегунов прямо перед героем: один удар топором достаётся только одному
	await G(page, () => {
		const g = window.__game, p = g.player;
		window.__pair = g.enemies.filter((e) => e.alive && e.type === 'runner').slice(0, 2);
		window.__pair.forEach((e, i) => { e.pos.set(p.pos.x + 1.3, 0, p.pos.z + (i ? 0.45 : -0.45)); e.stagger = 3; });
		for (const e of g.enemies) if (e.alive && !window.__pair.includes(e)) e.pos.set(40, 0, -44);
		p.root.rotation.y = Math.PI / 2; p.cooldown = 0; p.attack();
	});
	await page.waitForFunction(() => window.__pair.some((e) => e.hp < 60), null, { timeout: 20000 }).catch(() => {});
	const one = await G(page, () => window.__pair.filter((e) => e.hp < 60).length);
	check(one === 1, `топор за удар бьёт одного заражённого (задет ${one} из 2)`);
	await page.keyboard.down('Space');
	await page.waitForFunction(() => window.__game.kills >= 2, null, { timeout: 30000 }).catch(() => {});
	await page.keyboard.up('Space');
	await page.screenshot({ path: join(OUT, 'game-fight.png') });
	const k = await G(page, () => ({ kills: window.__game.kills, pickups: window.__game.pickups.length + window.__game.bag.spore, ammo: window.__game.pickups.filter((p) => /^ammo/.test(p.kind)).length, zhiv: window.__game.pickups.filter((p) => p.kind === 'zhivchik').length }));
	check(k.kills > 0, `убито заражённых топором: ${k.kills}`);
	check(k.pickups > 0, 'после убийства выпадают спораны');
	check(k.ammo === 0 && k.zhiv === 0, 'патроны и живчики из заражённых не выпадают');
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
	// здоровье снова «бесконечное» ещё на паузе: рядом погоня, а 85 заражённые снимут за пару игровых секунд
	const healed = await G(page, () => { const p = window.__game.player, r = { hp: p.hp, zh: window.__game.bag.zhivchik }; p.hp = p.maxHp = 1e6; return r; });
	check(healed.hp === 85 && healed.zh === 1, `живчик из рюкзака: здоровье ${healed.hp}, осталось ${healed.zh}`);
	await page.keyboard.press('KeyI');
	await page.waitForSelector('#inventory.hidden', { timeout: 20000 }).catch(() => {});
	check(!(await G(page, () => window.__game.paused)), 'рюкзак закрывается, игра продолжается');
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
	const clear = await G(page, () => ({ state: window.__game.state, loc: window.__game.loc, paused: window.__game.paused, over: !document.getElementById('gameover').classList.contains('hidden'), hp: window.__game.player.hp }));
	check(clear.state === 'play' && !clear.over, `после зачистки нет экрана победы — кластер просто ждёт перезагрузки${clear.state === 'play' && !clear.over ? '' : ` [${JSON.stringify(clear)} ${errors.slice(0, 3).join(' | ')}]`}`);

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
	await page.waitForFunction(() => [...document.querySelectorAll('#wm-list .route-img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 }).catch(() => {});
	const prev = await G(page, () => ({ cards: [...document.querySelectorAll('#wm-list .route-img')].filter((i) => i.naturalWidth >= 320).length, nodes: document.querySelectorAll('#wm-svg .wm-node image').length }));
	check(prev.cards === 3 && prev.nodes === 3, `у локаций превью: ${prev.cards} снимка в карточках, ${prev.nodes} — в точках карты`);
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
	// новое оружие у торговца: МР-133, «Вектор», АК-74, АК-47, СВД, патроны к ним и гранаты
	await G(page, () => { const g = window.__game; g.bag.spore = 3000; g.player.pos.set(-11, 0, 0.1); });
	await page.waitForFunction(() => document.getElementById('search-verb').textContent === 'Торговать' && !document.getElementById('search').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => {});
	await page.keyboard.press('KeyE');
	await page.waitForSelector('#trade:not(.hidden)', { timeout: 20000 }).catch(() => {});
	const arsenal = await G(page, () => {
		const buy = (name) => [...document.querySelectorAll('[data-buy]')].find((x) => x.closest('.offer').querySelector('b').textContent === name)?.click();
		for (const n of ['МР-133', 'Вектор', 'АК-74', 'АК-47', 'СВД', 'Патроны 12 кал. ×6', 'Патроны 9×19 ×30', 'Патроны 5,45×39 ×30', 'Патроны 7,62×39 ×30', 'Патроны 7,62×54R ×10', 'Граната Ф-1', 'Граната Ф-1', 'Граната Ф-1']) buy(n);
		const g = window.__game;
		return { owned: g.kit.owned, grenades: g.bag.grenade, secs: [...document.querySelectorAll('#trade-list .trade-sec')].map((x) => x.textContent) };
	});
	check(['shotgun', 'vector', 'ak74', 'ak47', 'svd'].every((w) => arsenal.owned.includes(w)) && arsenal.grenades === 3 && arsenal.secs.length === 3, `у торговца куплены МР-133, Вектор, АК-74, АК-47, СВД и 3 гранаты (разделы: ${arsenal.secs.join(', ')})`);
	await page.click('#trade-close');
	const shots = await G(page, () => {
		const g = window.__game, p = g.player, out = {};
		p.hold = 'gun';
		for (const id of ['shotgun', 'vector', 'ak74', 'ak47', 'svd']) {
			g.equipGear(id); p.equipping = false; p.cooldown = 0; p.reloading = 0;
			const before = p.ammo; p.attack(); out[id] = `${before}→${p.ammo}`;
		}
		return out;
	});
	check(Object.values(shots).every((v) => { const [a, b] = v.split('→').map(Number); return b === a - 1; }), `из каждого нового ствола выстрел тратит патрон: ${Object.entries(shots).map(([k, v]) => `${k} ${v}`).join(', ')}`);
	// наёмники у костра: нанятые идут в комнату героя и ждут у своих коек
	await G(page, () => window.__game.player.pos.set(-2.6, 0, 7.2));
	await page.waitForFunction(() => document.getElementById('search-verb').textContent === 'Нанять' && !document.getElementById('search').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => {});
	await page.keyboard.press('KeyE');
	await page.waitForSelector('#party:not(.hidden)', { timeout: 20000 }).catch(() => {});
	await page.click('[data-act="hire"][data-id="shram"]');
	await page.click('[data-act="hire"][data-id="ded"]');
	const hired = await G(page, () => ({ roster: window.__game.roster.map((m) => `${m.id}:${m.out ? 'с тобой' : 'в комнате'}`), actors: window.__game.mercs.length, bar: document.querySelectorAll('#party-bar .pm').length, home: document.querySelectorAll('[data-act="take"]').length }));
	check(hired.roster.join() === 'shram:в комнате,ded:в комнате' && hired.actors === 2 && hired.bar === 0 && hired.home === 2, `наняты наёмники: ${hired.roster.join(', ')} — ждут в твоей комнате`);
	await page.screenshot({ path: join(OUT, 'game-party.png') });
	await page.click('#party-close');
	// бойцы сами дошли до своих коек в комнате
	await page.waitForFunction(() => window.__game.mercs.every((m) => Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z) < 0.5), null, { timeout: 60000 }).catch(() => {});
	const atHome = await G(page, () => ({ ok: window.__game.mercs.filter((m) => Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z) < 0.5 && window.__game.level.room.contains(m.pos)).length, n: window.__game.level.buildings.length }));
	check(atHome.ok === 2, `наёмники дошли до своих коек в комнате (${atHome.ok} из 2)`);
	// подходишь к бойцу у койки — «Взять с собой»
	const takeOne = async (id) => {
		await page.evaluate((mid) => { const g = window.__game, m = g.mercs.find((x) => x.state.id === mid); g.player.pos.set(m.home.x, 0, m.home.z + 1.0); g.player.root.rotation.y = Math.PI; }, id);
		await page.waitForFunction((mid) => { const s = window.__game.nearStation(); return s?.id === 'take' && s.merc.state.id === mid && document.getElementById('search-verb').textContent === 'Взять с собой'; }, id, { timeout: 20000 }).catch(() => {});
		await page.keyboard.press('KeyE');
		await page.waitForFunction((mid) => window.__game.party.some((m) => m.id === mid), id, { timeout: 20000 }).catch(() => {});
	};
	await takeOne('shram');
	await takeOne('ded');
	const took = await G(page, () => ({ party: window.__game.party.map((m) => m.id), bar: document.querySelectorAll('#party-bar .pm').length }));
	check(took.party.join() === 'shram,ded' && took.bar === 2, `подошёл к бойцам в комнате — взял с собой: ${took.party.join(', ')}; в шапке их портреты`);
	await page.screenshot({ path: join(OUT, 'game-room.png') });
	// в комнате к бойцу из отряда — «Оставить в комнате»: уходит к своей койке
	await page.waitForFunction(() => window.__game.nearStation()?.id === 'leave' && document.getElementById('search-verb').textContent === 'Оставить в комнате', null, { timeout: 20000 }).catch(() => {});
	await page.keyboard.press('KeyE');
	await page.waitForFunction(() => window.__game.mercs.some((m) => !m.state.out && Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z) < 0.5), null, { timeout: 30000 }).catch(() => {});
	const left = await G(page, () => ({ party: window.__game.party.map((m) => m.id), back: window.__game.mercs.find((m) => !m.state.out && Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z) < 0.5)?.state.id ?? null }));
	const leaving = left.back;
	check(leaving && left.party.length === 1, `оставил ${leaving} в комнате — вернулся к своей койке, с тобой: ${left.party.join(', ')}`);
	if (leaving) await takeOne(leaving);
	check(await G(page, () => window.__game.party.length === 2), 'снова взял его с собой — в отряде двое');
	await G(page, () => window.__game.equipGear('aks'));
	// сохранение и «Продолжить»
	const saved = await G(page, () => JSON.parse(localStorage.getItem('ulei-cluster17-save') ?? 'null'));
	check(saved?.world?.at === 'stab' && saved.kit.owned.includes('aks') && saved.roster?.length === 2 && saved.roster.every((m) => m.out), 'игра сохранена в стабе (с купленным автоматом и наёмниками в отряде)');

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
	// наёмники пришли с героем и сами стреляют по заражённым, тратя свои патроны
	const mercFight = await G(page, () => {
		const g = window.__game, p = g.player;
		p.pos.set(-26, 0, 4);
		for (const m of g.mercs) m.place();
		window.__mercAmmo = g.party.map((m) => m.mag + m.ammo);
		window.__k0 = g.kills;
		g.enemies.filter((e) => e.alive && e.type === 'runner').slice(0, 3).forEach((e, i) => { e.pos.set(p.pos.x - 9, 0, p.pos.z - 1 + i); e.state = 'idle'; });
		return g.mercs.length;
	});
	await page.waitForFunction(() => window.__game.kills > window.__k0 && window.__game.party.some((m, i) => m.mag + m.ammo < window.__mercAmmo[i]), null, { timeout: 60000 }).catch(() => {});
	const mf = await G(page, () => ({ kills: window.__game.kills - window.__k0, spent: window.__game.party.map((m, i) => window.__mercAmmo[i] - (m.mag + m.ammo)) }));
	check(mercFight === 2 && mf.kills > 0 && mf.spent.some((n) => n > 0), `наёмники в бою: убили ${mf.kills}, потратили патронов ${mf.spent.join(' и ')}`);
	await page.screenshot({ path: join(OUT, 'game-mercs.png') });
	// патроны и живчик наёмнику — из рюкзака героя
	await G(page, () => { const g = window.__game; g.bag.ammo545 = 45; g.bag.zhivchik = 2; g.party[0].hp = 40; g.partyWindow.open(); });
	const supply0 = await G(page, () => ({ id: window.__game.party[0].id, ammo: window.__game.party[0].ammo, hp: window.__game.party[0].hp }));
	await page.click(`[data-act="ammo"][data-id="${supply0.id}"]`);
	await page.click(`[data-act="heal"][data-id="${supply0.id}"]`);
	const supply = await G(page, () => ({ ammo: window.__game.party[0].ammo, hp: window.__game.party[0].hp, bag: window.__game.bag.ammo545, zh: window.__game.bag.zhivchik }));
	check(supply.ammo === supply0.ammo + 30 && supply.bag === 15 && supply.hp === 100 && supply.zh === 1, `Шраму выданы патроны (+30, в запасе ${supply.ammo}) и живчик (здоровье ${supply.hp})`);
	await page.click('#party-close');
	// граната: бросок к кучке свежих бегунов (наёмники к этому времени могли перебить кластер), взрыв через 2 с
	await G(page, () => {
		const g = window.__game, p = g.player;
		for (const st of g.party) st.mag = st.ammo = 0; // наёмники больше не стреляют — проверяем только героя
		// остальных — подальше: граната летит к ближайшим заражённым
		for (const e of g.enemies) if (e.alive) { e.pos.set(40, 0, -44); e.state = 'idle'; }
		window.__blast = [0, 1, 2].map((i) => g.spawnEnemy('runner', p.pos.clone().set(p.pos.x + 7, 0, p.pos.z - 0.6 + i * 0.6)));
		window.__blast.forEach((e) => { e.stagger = 6; });
		window.__blast0 = window.__blast.map((e) => e.pos.clone());
		for (const m of g.mercs) m.pos.set(p.pos.x - 2, 0, p.pos.z);
		p.busy = 0; p.equipping = false;
		g.throwGrenade();
	});
	await page.waitForFunction(() => window.__blast.filter((e) => !e.alive).length >= 2, null, { timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(1500);
	const boom = await G(page, () => ({ dead: window.__blast.filter((e) => !e.alive).length, left: window.__game.bag.grenade, moved: Math.max(...window.__blast.map((e, i) => e.pos.distanceTo(window.__blast0[i]))) }));
	check(boom.dead >= 2 && boom.left === 2, `граната Ф-1: взрывом убито ${boom.dead} из 3, гранат осталось ${boom.left}`);
	check(boom.moved > 0.8, `тела отбросило взрывом (до ${boom.moved.toFixed(1)} м)`);

	// обрез: картечь задевает нескольких
	const shot = await G(page, () => {
		const g = window.__game, p = g.player;
		g.worldMap.close(); g.locationMap.close();
		p.pos.set(-26, 0, 4); // на дороге, вокруг пусто
		g.kit.owned.push('obrez'); g.kit.mags.obrez = 2; p.hold = 'gun'; g.equipGear('obrez');
		// остальных отводим подальше, чтобы ближайшей целью были трое свежих бегунов
		for (const e of g.enemies) if (e.alive) { e.pos.set(40, 0, -40); e.stagger = 5; }
		const es = [0, 1, 2].map((i) => g.spawnEnemy('runner', p.pos.clone().set(p.pos.x - 2.5, 0, p.pos.z + (i - 1) * 0.35)));
		es.forEach((e) => { e.stagger = 5; });
		window.__targets = es;
		p.root.rotation.y = -Math.PI / 2; p.cooldown = 0;
		window.__diag = { can: p.canAttack, w: p.weapon, ammo: p.ammo, eq: p.equipping, rl: p.reloading, paused: g.paused, state: g.state, alive: p.alive, q: p.queuedSwitch ?? null };
		p.attack();
		window.__diag.after = p.ammo;
		return es.map((e) => e.hp);
	});
	// кадр программного рендера бывает дольше секунды — ждём, пока дробь долетит
	await page.waitForFunction(() => window.__targets.filter((e) => e.hp < 60).length >= 2, null, { timeout: 30000 }).catch(() => {});
	const hurt = await G(page, () => window.__targets.filter((e) => e.hp < 60).length);
	const diag = hurt >= 2 ? '' : ` [${JSON.stringify(await G(page, () => ({ ...window.__diag, now: { paused: window.__game.paused, state: window.__game.state, pend: window.__game.player.pending.length, hp: window.__targets.map((e) => Math.round(e.hp)), pos: window.__targets.map((e) => e.pos.x.toFixed(1)), p: window.__game.player.pos.x.toFixed(1) } })))}]`;
	check(shot.length === 3 && hurt >= 2, `обрез: картечь задела ${hurt} бегунов${diag}`);

	// возвращение в кластер до перезагрузки: всё как было
	await G(page, () => { const g = window.__game; for (const e of g.enemies.slice(0, 5)) e.damage(1e4, e.pos.clone().add({ x: 1, y: 0, z: 0 }), 0); g.world.clusters.dachi.next = g.world.time + 2000; });
	await G(page, () => window.__game.travel('zarechny'));
	await page.waitForFunction(() => window.__game.loc === 'zarechny' && window.__game.state === 'play', null, { timeout: 300000 });
	const before2 = await G(page, () => window.__game.world.clusters.dachi.saved.enemies.length);
	await G(page, () => window.__game.travel('dachi'));
	await page.waitForFunction(() => window.__game.loc === 'dachi' && window.__game.state === 'play', null, { timeout: 300000 });
	const back = await G(page, () => window.__game.enemies.length); // все заселённые при приходе
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
	check(await G(page, () => window.__game.party.length === 0 && window.__game.mercs.length === 0), 'наёмники пропали вместе с перезагрузившимся кластером');
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

	// высокое качество (компьютер): затенение в углах, свечение, цвет Улья, сглаживание
	const h = await open({ width: 900, height: 520 }, false, 30, null, null);
	await h.click('#btn-new');
	await h.waitForFunction(() => window.__game?.state === 'play' && window.__game.enemies.length > 0, null, { timeout: 120000 });
	await h.waitForFunction(() => window.__game.perf.calls > 0, null, { timeout: 120000 });
	const hq = await G(h, () => ({ post: Object.keys(window.__game.post.passes), calls: window.__game.perf.calls }));
	check(['ao', 'bloom', 'final'].every((k) => hq.post.includes(k)) && hq.calls < 280, `высокое качество: затенение в углах, свечение и цвет Улья (${hq.post.join(', ')}), ${hq.calls} вызовов отрисовки`);
	await h.screenshot({ path: join(OUT, 'game-high.png'), timeout: 120000 });
	await h.close();
	check(errors.length === 0, `нет ошибок в консоли${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
	check(false, e.message);
} finally {
	await browser.close();
	server.close();
}
console.log(failed ? 'GAME E2E: FAIL' : 'GAME E2E: OK');
process.exit(failed ? 1 : 0);
