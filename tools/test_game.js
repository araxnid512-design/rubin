// Автотест игры в браузере: меню → новая игра → прохождение задания «Возрождение Долга» через игровые системы,
// скриншоты основных экранов, замер производительности. Запуск: node tools/test_game.js <папка-для-скриншотов>
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const W = +(process.env.W || 1280), H = +(process.env.H || 720);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || t.startsWith('[')) console.log(m.type() + ': ' + t.slice(0, 300)); if (m.type() === 'error' && !t.includes('ERR_FAILED')) errors.push(t); });  // ERR_FAILED — шрифты, заблокированные самим тестом
  p.on('pageerror', (e) => { console.log('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')); errors.push(e.message); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__app && document.querySelector('#menu-actions button'));
  const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `${out}/${n}.png` }); console.log('SHOT', n); };
  await shot('01_menu');
  await p.click('#menu-actions button.primary');
  await p.waitForFunction(() => window.__app.playing, null, { timeout: 120000 });
  console.log('LOAD_MS', await p.evaluate(() => window.__app.loadMs));
  await shot('02_intro');
  const E = (f, ...a) => p.evaluate(f, ...a);
  const step = (sec) => E((s) => { const a = window.__app; const dt = 1 / 30; for (let i = 0; i < s * 30; i++) { a.world.update(dt); a.quest.update(dt); a.dayNight.update(dt); a.cam.follow(a.world.player.pos, a.world.player.vel, dt); a.cam.update(innerWidth / innerHeight); a.world.updateVisuals(dt, a.cam); } }, sec);
  const closeWin = () => E(() => { while (window.__app.win) window.__app.close(); });
  const walk = async (x, z, maxSec = 60) => {
    for (let i = 0; i < maxSec; i++) {
      const d = await E(([x, z]) => { const pl = window.__app.world.player; pl.autoWalk = new V3(x, 0, z); return Math.hypot(pl.pos.x - x, pl.pos.z - z); }, [x, z]);
      if (d < 1.0) break;
      await step(1);
    }
    await E(() => { window.__app.world.player.autoWalk = null; });
  };
  // путь по навигационной сетке (обход зданий), генерал идёт по точкам
  const goto = async (x, z) => {
    // двери на пути открываются, как это сделал бы игрок кнопкой «Действие»
    await E(() => { for (const d of window.__app.world.doors) if (d.p.dist2(window.__app.world.player.pos) < 60) d.setOpen(true); });
    const pts = await E(([x, z]) => window.__app.world.nav.findPath(window.__app.world.player.pos, new V3(x, 0, z)).map((q) => [q.x, q.z]), [x, z]);
    for (const [px, pz] of pts) { await E(() => { for (const d of window.__app.world.doors) if (d.p.dist2(window.__app.world.player.pos) < 6) d.setOpen(true); }); await walk(px, pz, 40); }
    console.log('  goto', x, z, '->', await E(() => window.__app.world.player.pos.toArray().join(',')));
  };
  const interactNear = async (pred) => E((src) => {
    const a = window.__app, pl = a.world.player, f = new Function('n', 'return ' + src);
    const n = a.world.interactables.find((n) => f(n) && n.can(pl)); if (!n) return 'none';
    const p = typeof n.pos === 'function' ? n.pos() : n.pos; pl.pos.x = p.x + 0.8; pl.pos.z = p.z + 0.8; pl.startInteraction(n); return n.prompt();
  }, pred);
  const stage = () => E(() => window.__app.quest.current().id + (window.__app.quest.finished ? ' (finished)' : ''));
  const log = async (t) => console.log('STAGE', await stage(), '|', t);
  await closeWin();
  // 1. прибытие
  await goto(0, -12); await step(1.5); await log('прибыл на плац');
  await shot('03_parade_dialog'); await closeWin();
  // 2. штаб
  await goto(0, -38); await step(1.5); await log('в штабе');
  await shot('04_inside_hq');
  // 3. осмотр повреждений
  for (const [id, x, z] of [['inspect_generator', -20, -60], ['inspect_radio', 18, -60], ['inspect_armory', -50, 2]]) {
    await goto(x, z); console.log('  inspect', id, await interactNear(`n.iid === '${id}'`)); await step(0.6);
  }
  await log('осмотрел повреждения');
  // 4. офицер
  await E(() => { const o = window.__app.world.soldierMap.s_officer; const pl = window.__app.world.player; pl.pos.x = o.pos.x + 1; pl.pos.z = o.pos.z + 1; o.interact(pl); });
  await shot('05_dialog_officer');
  await E(() => { window.__app.quest.dialogAction('talked_officer'); window.__app.close(); });
  await step(1); await log('доклад офицера');
  // 5. детали: обыск контейнеров и разбор металлолома
  await E(() => { const pl = window.__app.world.player; window.__app.open('inventory'); });
  await shot('06_inventory'); await closeWin();
  const lootAll = await E(() => {
    const a = window.__app, out = [];
    for (const c of a.world.interactables) {
      if (c.items && (c.items.tools || c.items.electronics || c.items.scrap || c.items.fuel)) { const n = c.takeAll(); out.push(c.title + ':' + n); }
      if (c.res === 'scrap' && c.sid && Object.keys(window.__Game.inv).length) { c.interact(a.world.player); out.push('salvage'); }
      if (window.__Game.total('scrap') >= 8 && window.__Game.total('electronics') >= 3 && window.__Game.total('tools') >= 1 && window.__Game.total('fuel') >= 2) break;
    }
    return out.join(', ') + ' | tools ' + window.__Game.total('tools') + ' elec ' + window.__Game.total('electronics') + ' scrap ' + window.__Game.total('scrap') + ' fuel ' + window.__Game.total('fuel');
  });
  console.log('LOOT', lootAll);
  await step(1); await log('детали собраны');
  // 6. склад
  await goto(48, -44); console.log('  terminal', await interactNear(`n.b && n.b.id === 'warehouse' && n.constructor.name === 'BuildingTerminal'`)); await step(0.3);
  await shot('07_panel_warehouse');
  await E(() => { const btn = [...document.querySelectorAll('.win button')].find((b) => b.textContent.includes('Сдать все')); btn.click(); });
  await closeWin(); await step(1); await log('сдал на склад');
  // 7. генератор: ремонт (техник + генерал), топливо
  await goto(-20, -58);
  await E(() => window.__app.open('building', 'generator'));
  await shot('08_panel_generator');
  await E(() => { const btn = [...document.querySelectorAll('.win button')].find((b) => b.textContent.includes('Начать восстановление')); if (btn) btn.click(); });
  await closeWin();
  // генерал удерживает «Действие» у входа (ремонт вместе с техником)
  await E(() => { const a = window.__app, b = a.world.buildings.generator, pl = a.world.player; pl.pos.x = b.repairSpot.p.x; pl.pos.z = b.repairSpot.p.z + 0.4; pl.focusT = 0; a.input.touch.interact = true; });
  await step(3); await shot('09_repair_generator');
  for (let i = 0; i < 90 && !(await E(() => window.__Game.level('generator') >= 1)); i++) await step(1);
  console.log('  generator level', await E(() => window.__Game.level('generator') + ' progress ' + window.__Game.progress('generator')));
  await E(() => { window.__app.input.touch.interact = false; });
  await step(0.2);
  await E(() => { const G = window.__Game; if (G.total('fuel') < 1) G.give('fuel', 1); G.refuel(1); });
  await step(1); await log('генератор запущен');
  // 8. оружейная: завал и тайник
  await goto(-50, 4);
  await E(() => { const a = window.__app, pl = a.world.player, r = a.world.interactables.find((n) => n.buildingId === 'armory'); pl.pos.x = r.p.x + 1.6; pl.pos.z = r.p.z + 1.6; pl.focusT = 0; a.input.touch.interact = true; });
  await step(5.5);
  await E(() => { window.__app.input.touch.interact = false; });
  console.log('  rubble', await E(() => !!window.__Game.worldState.rubble.armory));
  await step(1);
  await E(() => { const a = window.__app; const c = a.world.interactables.find((c) => c.cid === 'armory_cache'); if (c) { c.interact(a.world.player); c.takeAll(); a.close(); } });
  await step(1); await log('оружейная');
  // 9. КПП: выдать патроны и назначить двоих
  await E(() => window.__app.open('building', 'armory'));
  await shot('10_panel_armory');
  await E(() => { const a = window.__app; const G = window.__Game; G.give('ammo_545', 120); for (const id of ['s_rifleman', 's_officer']) { const so = a.world.soldierMap[id]; so.reserve += 60; so.supplied = true; so.giveOrder('defend', new V3(0, 0, 76)); } a.close(); });
  await step(1); await log('КПП');
  // 10. радиоцентр
  await E(() => { const G = window.__Game; G.give('electronics', 6); G.give('scrap', 10); G.give('planks', 10); G.give('tools', 1); G.depositResources(); });
  await E(() => window.__app.open('build'));
  await shot('11_build_menu'); await closeWin();
  await E(() => { const a = window.__app, G = window.__Game; G.startJob('radio'); for (const so of a.world.soldiers) if (so.role === 'tech') so.giveOrder('repair', 'radio'); });
  await E(() => window.__app.open('squad')); await shot('12_squad'); await closeWin();
  for (let i = 0; i < 60 && !(await E(() => window.__Game.level('radio') >= 1)); i++) { await E(() => window.__Game.addWork('radio', 2)); await step(0.5); }
  await step(1); await log('радиоцентр восстановлен');
  // 11. сигнал
  await goto(16, -60);
  await E(() => window.__app.open('radio'));
  await E(() => { const t = document.querySelector('#radio-tuner'); t.value = 147.3; t.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(2600);
  await shot('13_radio_signal');
  await E(() => { const a = window.__app; if (a.winKind === 'dialog') { a.quest.dialogAction('signal_received'); a.close(); } });
  await step(1.5); await log('сигнал получен');
  // 12. экспедиция
  await E(() => window.__app.open('expedition'));
  await E(() => { const b = [...document.querySelectorAll('.win button')].filter((b) => b.textContent.startsWith('☐')); b[1].click(); b[3].click(); [...document.querySelectorAll('.win button')].find((x) => x.textContent.includes('Утвердить')).click(); });
  await step(1.5); await log('экспедиция');
  await shot('14_finale'); await closeWin();
  await E(() => window.__app.open('journal')); await shot('15_journal'); await closeWin();
  await E(() => window.__app.open('map')); await p.waitForTimeout(300); await shot('16_map'); await closeWin();
  // бой: генерал с отрядом у логова псов
  await E(() => { const a = window.__app; for (const so of a.world.soldiers) if (so.alive && !['s_rifleman', 's_officer'].includes(so.sid)) so.giveOrder('follow'); });
  await goto(-60, -100);
  await E(() => { const a = window.__app, pl = a.world.player; pl.pos.x = -112; pl.pos.z = -110; for (const so of a.world.soldiers) if (so.order === 'follow') { so.pos.x = -110 + Math.random() * 3; so.pos.z = -107 + Math.random() * 3; } a.cam.snap(); });
  await step(3);
  await E(() => { const a = window.__app; a.input.touch.fire = true; });
  await step(2.5); await shot('17_combat_dogs');
  await step(5);
  await E(() => { const a = window.__app; a.input.touch.fire = false; });
  console.log('COMBAT', await E(() => JSON.stringify(window.__app.world.groups[0].members.map((m) => [m.alive, Math.round(m.hp)])) + ' player hp ' + Math.round(window.__app.world.player.hp)));
  // ночь и питание
  await E(() => { const a = window.__app, pl = a.world.player; window.__Game.time = 22.5; a.dayNight.apply(); pl.pos.x = 0; pl.pos.z = -20; a.cam.snap(); });
  await step(1); await shot('18_night_power');
  // сохранение и загрузка
  const saved = await E(() => window.__app.saveGame(2));
  await E(() => window.__app.open('saveload', 'load')); await shot('19_saveload'); await closeWin();
  await E(() => window.__app.open('settings', 'pause')); await shot('20_settings'); await closeWin();
  // замер производительности: обычный игровой кадр с рендером
  await E(() => { const a = window.__app, pl = a.world.player; window.__Game.time = 13; a.dayNight.apply(); pl.pos.x = 0; pl.pos.z = 40; a.cam.snap(); a.settings.showFps = true; a.applySettings(); });
  await p.waitForTimeout(2500);
  await shot('21_gameplay_fps');
  console.log('STATS', await E(() => JSON.stringify(window.__app.stats)));
  console.log('SAVE', saved, 'ERRORS', errors.length);
  await b.close();
})();
