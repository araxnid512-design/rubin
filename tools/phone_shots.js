// Снимки «Линии снабжения» на телефоне (915×412, касания): node tools/phone_shots.js <папка>
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__fl && document.querySelector('#menu-actions button'));
  await p.screenshot({ path: `${out}/phone_menu.jpg`, type: 'jpeg', quality: 82 });
  await p.evaluate(() => { localStorage.clear(); window.__fl.start(false); });
  await p.waitForFunction(() => window.__fl.playing);
  await p.evaluate(() => { const a = window.__fl, pile = a.sector.piles[5]; a.player.pos.x = pile.x - 2.4; a.player.pos.z = pile.z + 0.6; a.player.pos.y = a.sector.h(a.player.pos.x, a.player.pos.z); a.cam.snap(); a.c.scrap = 410; });
  await p.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(p);
  const r = await p.evaluate(() => { const e = document.querySelector('.act').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  for (let i = 0; i < 2; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1], id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500); }
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/phone_mining.jpg`, type: 'jpeg', quality: 82 });
  await p.evaluate(() => { const a = window.__fl; a.player.pos.x = -50; a.player.pos.z = 55; a.player.pos.y = a.sector.h(-50, 55); a.cam.snap(); a.c.select(1); a.ui.refreshTool(); a.ui.open('build'); [...document.querySelectorAll('.tabs .btn')][3].click(); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/phone_build_menu.jpg`, type: 'jpeg', quality: 82 });
  await p.evaluate(() => { const a = window.__fl; [...document.querySelectorAll('.cards .card')][0].click(); a.placing.x = -50; a.placing.z = 40; a.updateGhost(); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/phone_placement.jpg`, type: 'jpeg', quality: 82 });
  console.log('ok', await p.evaluate(() => window.__fl.placing && window.__fl.placing.why));
  // штаб: тактический стол; бой на №2 с оружием со склада
  await p.evaluate(() => {
    const a = window.__fl, c = a.c; a.cancelPlacement(); c.scrap = 999;
    const put = (id, x, z) => { for (let r = 0; r < 50; r += 2) for (let k = 0; k < 12; k++) { const px = Math.round(x + Math.cos(k) * r), pz = Math.round(z + Math.sin(k) * r); if (!a.sector.validate(id, px, pz, 0)) { const res = c.build(id, px, pz, 0, true); if (res.ok) { a.sector.addBuilding(res.rec); return res.rec; } } } };
    const bar = put('military_barracks', -60, 60); put('military_headquarters', -95, 25); c.scrap = 999;
    for (const role of ['npc_scrap_worker', 'npc_mechanic', 'npc_infantry', 'npc_infantry']) c.hire(bar.uid, role); c.advance(160);
    a.ui.open('command'); a.ui.cmdSel = a.ui.cmdSel || new Set(); for (const u of c.recruits) if (u.role === 'npc_infantry') a.ui.cmdSel.add(u.uid); a.ui.open('command');
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/phone_command.jpg`, type: 'jpeg', quality: 82 });
  await p.evaluate(() => {
    const a = window.__fl, c = a.c; a.ui.close();
    c.storage.wp_assault_a47 = 3; c.storage.ammo_762x39 = 300; const t = c.takeWeapon('wp_assault_a47'); c.select(t.slot); a.ui.refreshTool();
    c.advance(Math.max(0, 1800 - c.campaign_seconds) + 1); c.army.waveT = 0; a.army._waves(0);
    const f = c.foes[0]; a.transitionTo(1, [f ? f.x : 0, 141]); a.player.pos.x = (f ? f.x : 0) + 3; a.player.pos.z = (f ? f.z : -100) + 24; c.playerHp = 74; a.cam.snap();
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/phone_battle.jpg`, type: 'jpeg', quality: 82 });
  await b.close();
})();
