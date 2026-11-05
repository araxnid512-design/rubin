// Снимки «Линии снабжения» на телефоне (915×412, касания): node tools/fl_phone.js <папка>
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8765/frontline/index.html');
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
  await b.close();
})();
