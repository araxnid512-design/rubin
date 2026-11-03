// Автотест сенсорного управления (настоящие касания через CDP, телефон 915×412) и новых механик:
// джойстик и автобег, стик прицела на кнопке огня, щипок-масштаб, контекстная кнопка, быстрые приказы, левша,
// гранаты, кровотечение, сытость и жажда, артефакты и детектор, износ и заклинивание, набег на базу, отдых.
// Запуск: node tools/test_mechanics.js <папка-для-скриншотов>
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => { console.log('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')); errors.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) { console.log('console.error: ' + m.text()); errors.push(m.text()); } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__app && document.querySelector('#menu-actions button'));
  await p.evaluate(() => { localStorage.clear(); window.__app.settings.fpsLimit = 60; window.__app.start(null); });
  await p.waitForFunction(() => window.__app.playing, null, { timeout: 120000 });
  const E = (f, a) => p.evaluate(f, a);
  await E(() => window.__app.close());
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const center = (sel) => E((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; }, sel);
  const wait = (ms) => p.waitForTimeout(ms);
  const results = [];
  const check = (name, ok, info = '') => { results.push([name, ok]); console.log((ok ? 'ок      ' : 'ОШИБКА  ') + name + (info ? ' — ' + info : '')); };
  const step = (sec) => E((s) => { const a = window.__app, dt = 1 / 30; for (let i = 0; i < s * 30; i++) { a.world.update(dt); a.quest.update(dt); a.cam.follow(a.world.player.pos, a.world.player.vel, dt); a.cam.update(innerWidth / innerHeight); a.world.updateVisuals(dt, a.cam); } }, sec);
  const pl = (f) => E(f);
  const closeWin = () => E(() => { let n = 0; while (window.__app.win && n++ < 10) window.__app.close(); });

  // ---------------- 1. джойстик и автобег
  await E(() => { const a = window.__app, pl = a.world.player; pl.pos.x = 0; pl.pos.z = 60; a.cam.snap(); });
  const z0 = await pl(() => window.__app.world.player.pos.toArray());
  await touch('touchStart', [[150, 300, 1]]);
  await touch('touchMove', [[150, 260, 1]]); // половина хода — шаг
  await wait(1200);
  const mid = await pl(() => ({ pos: window.__app.world.player.pos.toArray(), v: window.__app.world.player.vel.len(), st: window.__app.world.player.stamina }));
  await touch('touchMove', [[150, 180, 1]]); // до упора — бег
  await wait(1500);
  const full = await pl(() => ({ pos: window.__app.world.player.pos.toArray(), v: window.__app.world.player.vel.len(), st: window.__app.world.player.stamina, run: document.querySelector('.joy-base').classList.contains('run') }));
  await touch('touchEnd', []);
  check('джойстик двигает генерала', mid.pos[2] < z0[2] - 0.5, `z ${z0[2]} → ${mid.pos[2].toFixed(1)}, скорость ${mid.v.toFixed(1)}`);
  check('джойстик до упора — бег без кнопки', full.v > 4.5 && full.st < 100 && full.run, `скорость ${full.v.toFixed(1)} м/с, выносливость ${full.st.toFixed(0)}`);

  // ---------------- 2. щипок двумя пальцами — масштаб
  const zoomA = await pl(() => window.__app.cam.zoom);
  await touch('touchStart', [[500, 200, 2], [620, 200, 3]]);
  await touch('touchMove', [[450, 200, 2], [700, 200, 3]]);
  await touch('touchEnd', []);
  const zoomB = await pl(() => window.__app.cam.zoom);
  check('щипок меняет масштаб камеры', zoomB < zoomA - 0.05, `${zoomA.toFixed(2)} → ${zoomB.toFixed(2)}`);
  await E(() => window.__app.cam.setZoom(0.8));

  // ---------------- 3. огонь-стик: ручной прицел и автонаведение на цель
  // генерал неуязвим на время боевых проверок; псы стоят на месте, чтобы граната была проверяемой
  await E(() => { const a = window.__app, pl = a.world.player; pl.godMode = true; pl.pos.x = -126; pl.pos.z = -106; pl.yaw = 0; a.cam.snap(); for (const g of a.world.groups) g.t = 0; });
  await step(1.5);
  await E(() => { const a = window.__app; for (const m of a.world.groups[0].members) if (m.alive) { m.update = () => {}; m.pos.x = -128 + Math.random() * 3; m.pos.z = -117 + Math.random() * 3; } });
  await step(0.5);
  const [fx, fy, fw] = await center('.tbtn.fire');
  await touch('touchStart', [[fx, fy, 4]]);
  await touch('touchMove', [[fx - fw * 0.6, fy, 4]]); // влево
  await wait(500);
  const aim = await pl(() => { const m = window.__app.world.player.manualAim; return m ? m.toArray() : null; });
  await p.screenshot({ path: `${out}/m01_aim_stick.jpg`, type: 'jpeg', quality: 80 });
  await touch('touchEnd', []);
  check('сдвиг кнопки огня — ручной прицел', !!aim && aim[0] < -0.5, aim ? `направление ${aim.map((x) => x.toFixed(2))}` : 'нет');
  await step(0.6); await wait(300);
  const pre = await pl(() => !!window.__app.world.player.previewTarget);
  const diag = pre ? '' : await E(() => { const a = window.__app, pl = a.world.player; return JSON.stringify(a.world.groups[0].members.map((m) => [m.alive, m.dormant, +pl.pos.dist(m.pos).toFixed(1), pl.canSee(m)])) + ' wpn ' + pl.weaponId + ' pos ' + pl.pos.toArray(); });
  check('цель автонаведения подсвечивается до выстрела', pre, diag);

  // ---------------- 4. граната: дуга при сдвиге, бросок по стае
  await E(() => { const G = window.__Game; G.give('grenade_f1', 3); });
  const dogs0 = await pl(() => window.__app.world.groups[0].members.filter((m) => m.alive).length);
  const [nx, ny, nw] = await center('.tbtn.nade');
  await touch('touchStart', [[nx, ny, 5]]);
  await touch('touchMove', [[nx - nw * 0.3, ny - nw * 0.5, 5]]);
  await wait(400);
  const arc = await pl(() => !!window.__app.world.player.grenadeAim);
  await p.screenshot({ path: `${out}/m02_grenade_arc.jpg`, type: 'jpeg', quality: 80 });
  await E(() => { const a = window.__app, pl = a.world.player; pl.grenadeAim = new V3(-126.5, 0, -115.5); });
  await touch('touchEnd', []);
  await step(5);
  const nades = await pl(() => window.__Game.inv.count('grenade_f1') + window.__Game.inv.count('grenade_rgd5'));
  const dogs1 = await pl(() => window.__app.world.groups[0].members.filter((m) => m.alive).length);
  check('сдвиг кнопки гранаты показывает дугу броска', arc);
  check('граната брошена и взорвалась (урон по стае)', nades < 3 && dogs1 < dogs0, `гранат ${nades}, псов живо ${dogs0} → ${dogs1}`);
  await E(() => { const a = window.__app; for (const m of a.world.groups[0].members) delete m.update; a.world.player.godMode = false; const pl = a.world.player; pl.pos.x = 0; pl.pos.z = 40; a.cam.snap(); });

  // ---------------- 5. кровотечение и быстрое лечение
  await E(() => { const a = window.__app, pl = a.world.player; pl.hp = 100; for (let i = 0; i < 6 && !pl.bleed; i++) pl.takeDamage(20, a.world.enemies[0]); window.__Game.give('bandage', 2); });
  const bl = await pl(() => ({ bleed: window.__app.world.player.bleed, hp: window.__app.world.player.hp }));
  await step(3);
  const bl2 = await pl(() => window.__app.world.player.hp);
  const [hx, hy] = await center('.tbtn.heal');
  await touch('touchStart', [[hx, hy, 6]]); await touch('touchEnd', []);
  await step(3);
  const bl3 = await pl(() => ({ bleed: window.__app.world.player.bleed, using: window.__app.world.player.useItemId }));
  check('ранение открывает кровотечение, здоровье убывает', bl.bleed > 0 && bl2 < bl.hp - 0.5, `кровотечение ${bl.bleed.toFixed(2)}/с, здоровье ${bl.hp.toFixed(0)} → ${bl2.toFixed(0)}`);
  check('кнопка «+» — бинт останавливает кровотечение', bl3.bleed === 0);

  // ---------------- 6. сытость и жажда
  const n0 = await pl(() => ({ h: window.__app.world.player.hunger, t: window.__app.world.player.thirst }));
  await step(60);
  const n1 = await pl(() => ({ h: window.__app.world.player.hunger, t: window.__app.world.player.thirst }));
  await E(() => { const pl = window.__app.world.player; window.__Game.give('water', 1); pl.useItem('water'); });
  await step(2);
  const n2 = await pl(() => window.__app.world.player.thirst);
  check('сытость и жажда снижаются со временем', n1.h < n0.h && n1.t < n0.t, `сытость ${n0.h.toFixed(1)} → ${n1.h.toFixed(1)}, жажда ${n0.t.toFixed(1)} → ${n1.t.toFixed(1)} за 1 мин`);
  check('вода утоляет жажду', n2 >= Math.min(100, n1.t + 40) - 1, `жажда ${n1.t.toFixed(0)} → ${n2.toFixed(0)}`);

  // ---------------- 7. артефакты, детектор, пояс
  const art = await E(() => { const a = window.__app, f = a.world.artifacts; const it = f.items[0]; if (!it) return null; const pl = a.world.player; pl.pos.x = it.p.x + 8; pl.pos.z = it.p.z; a.cam.snap(); return { n: f.items.length, id: it.aid }; });
  await step(1);
  const det = await pl(() => window.__app.world.artifacts.nearest ? window.__app.world.artifacts.nearest.d : -1);
  await p.screenshot({ path: `${out}/m03_detector.jpg`, type: 'jpeg', quality: 80 });
  await E(() => { const a = window.__app, it = a.world.artifacts.items[0], pl = a.world.player; pl.godMode = true; it.interact(pl); });
  const got = await pl((/* */) => window.__Game.inv.slots.some((s) => s && s.id.startsWith('art_')));
  await E(() => { const a = window.__app, pl = a.world.player; a.open('inventory'); const i = window.__Game.inv.slots.findIndex((s) => s && s.id.startsWith('art_')); [...document.querySelectorAll('.win .cell')][i].click(); });
  await E(() => { [...document.querySelectorAll('.win button')].find((b) => b.textContent.includes('Надеть на пояс')).click(); });
  await p.screenshot({ path: `${out}/m04_inventory_belt.jpg`, type: 'jpeg', quality: 80 });
  await E(() => window.__app.close());
  const belt = await pl(() => window.__app.world.player.belt.slice());
  check('артефакты лежат у аномалий', !!art && art.n >= 4, art ? `${art.n} шт.` : '');
  check('детектор чует артефакт', det > 0 && det < 30, `${det.toFixed(1)} м`);
  check('артефакт подобран и надет на пояс', got && belt.length === 1, belt.join(','));
  await E(() => { window.__app.world.player.godMode = false; });

  // ---------------- 8. износ и заклинивание
  await E(() => { const a = window.__app, pl = a.world.player, e = window.__Game.equip.pistol; e.cond = 5; pl.mag = 8; window.__Game.give('ammo_9x18', 40); pl.pos.x = 0; pl.pos.z = 40; a.cam.snap(); });
  const jam = await E(() => { const a = window.__app, pl = a.world.player; let shots = 0; for (let i = 0; i < 300 && !pl.jammed; i++) { pl.fireCd = 0; pl.cycleT = 0; if (pl.mag <= 0) pl.mag = 8; if (pl.fireAt(pl.centerPos().add(new V3(0, 0, -10)))) shots++; } return { jammed: pl.jammed, shots, cond: window.__Game.equip.pistol.cond }; });
  const [rx, ry] = await center('.tbtn.reload');
  await touch('touchStart', [[rx, ry, 7]]); await touch('touchEnd', []);
  await step(1.2);
  const jam2 = await pl(() => window.__app.world.player.jammed);
  check('изношенное оружие заклинивает', jam.jammed, `после ${jam.shots} выстрелов, состояние ${jam.cond.toFixed(1)}%`);
  check('кнопка «R» устраняет задержку', jam.jammed && !jam2);

  // ---------------- 9. контекстная кнопка действия
  const ctxBtn = await E(() => { const a = window.__app, pl = a.world.player, n = a.world.interactables.find((n) => n.constructor.name === 'LootContainer' && n.can()); pl.pos.x = n.p.x + 1; pl.pos.z = n.p.z + 1; a.cam.snap(); return n.prompt(); });
  await step(0.5); await closeWin(); await wait(500);
  const label = await E(() => document.querySelector('.tbtn.use small').textContent + '|' + document.querySelector('.tbtn.use').className);
  const [ux, uy] = await center('.tbtn.use');
  await touch('touchStart', [[ux, uy, 8]]); await wait(150); await touch('touchEnd', []);
  await wait(300);
  const opened = await pl(() => window.__app.winKind);
  check('кнопка действия подписана тем, что произойдёт', label.startsWith('Обыскать') && label.includes('ready'), label);
  check('касание кнопки действия открывает обыск', opened === 'loot', opened);
  await E(() => window.__app.close());

  // ---------------- 10. быстрые приказы отряду
  await E(() => { const a = window.__app, pl = a.world.player; pl.pos.x = 0; pl.pos.z = -8; a.cam.snap(); });
  await step(1); await closeWin(); await wait(400);
  const [ox, oy] = await center('.tbtn.orders');
  await touch('touchStart', [[ox, oy, 9]]); await touch('touchEnd', []);
  await wait(200);
  await p.screenshot({ path: `${out}/m05_orders_bar.jpg`, type: 'jpeg', quality: 80 });
  const fb = await center('.orders-bar .btn');
  await touch('touchStart', [[fb[0], fb[1], 10]]); await touch('touchEnd', []);
  await wait(200);
  const orders = await pl(() => window.__app.world.soldiers.filter((s) => s.order === 'follow').length);
  check('быстрый приказ «За мной» без открытия окна', orders >= 4, `следуют ${orders}`);

  // ---------------- 11. режим левши
  const rightX = (await center('.tbtn.fire'))[0];
  await E(() => { const a = window.__app; a.settings.lefty = true; a.applySettings(); });
  await wait(200);
  const leftX = (await center('.tbtn.fire'))[0];
  await p.screenshot({ path: `${out}/m06_lefty.jpg`, type: 'jpeg', quality: 80 });
  await E(() => { const a = window.__app; a.settings.lefty = false; a.applySettings(); });
  check('режим левши переносит кнопки влево', rightX > 600 && leftX < 300, `x ${rightX.toFixed(0)} → ${leftX.toFixed(0)}`);

  // ---------------- 12. набег на базу
  await E(() => { const a = window.__app, G = window.__Game; G.buildings.generator.level = 1; a.world.raids.schedule(G.hours()); });
  const sched = await pl(() => window.__Game.nextRaid - window.__Game.hours());
  await E(() => { const a = window.__app, pl = a.world.player; pl.godMode = true; pl.pos.x = 0; pl.pos.z = 66; a.cam.snap(); for (const s of a.world.soldiers) if (s.alive) { s.giveOrder('defend', new V3(0, 0, 76)); s.pos.x = s.orderTarget.x; s.pos.z = s.orderTarget.z; s.reserve = 200; } a.world.raids.start(0); });
  const raid0 = await pl(() => ({ n: window.__app.world.raids.alive(), kind: window.__app.world.raids.members[0].kind }));
  let raidLeft = raid0.n, t = 0;
  for (; t < 120 && raidLeft > 0; t += 5) { await step(5); raidLeft = await pl(() => window.__app.world.raids.alive()); if (t === 10) await p.screenshot({ path: `${out}/m07_raid.jpg`, type: 'jpeg', quality: 80 }); }
  await step(1);
  const rep = await pl(() => ({ r: window.__Game.raidsRepelled, inside: window.__app.world.raids.members.filter((m) => m.pos.z < 80).length }));
  check('набег назначается на ночь после запуска генератора', sched > 0 && sched < 48, `через ${sched.toFixed(1)} ч`);
  check('набег отбит бойцами в обороне', raidLeft === 0 && rep.r === 1, `${raid0.n} × ${raid0.kind}, за ${t} с; отбито ${rep.r}`);
  await E(() => { window.__app.world.player.godMode = false; });

  // ---------------- 13. отдых до утра
  await E(() => { const G = window.__Game; G.time = 23; G.nextRaid = G.hours() + 30; window.__app.open('building', 'barracks'); });
  await E(() => { [...document.querySelectorAll('.win button')].find((b) => b.textContent.includes('Отдохнуть до утра')).click(); });
  const morning = await pl(() => window.__Game.time);
  check('отдых в казарме до 07:00', Math.abs(morning - 7) < 0.05, `время ${morning.toFixed(2)}`);

  // ---------------- 14. HUD телефона
  await E(() => { const a = window.__app, pl = a.world.player; window.__Game.time = 13; a.dayNight.apply(); pl.pos.x = -40; pl.pos.z = -100; pl.bleed = 0.4; a.cam.snap(); });
  await wait(800);
  await p.screenshot({ path: `${out}/m08_phone_hud.jpg`, type: 'jpeg', quality: 82 });
  await E(() => window.__app.open('settings', 'pause'));
  await E(() => { document.querySelector('.win-body').scrollTop = 10000; });
  await wait(200);
  await p.screenshot({ path: `${out}/m09_settings_controls.jpg`, type: 'jpeg', quality: 80 });
  await E(() => window.__app.close());

  const bad = results.filter((r) => !r[1]).length;
  console.log(`ИТОГ: проверок ${results.length}, не прошло ${bad}, ошибок в консоли ${errors.length}`);
  await b.close();
})();
