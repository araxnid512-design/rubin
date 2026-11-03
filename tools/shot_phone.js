// Снимок игры на «телефоне» в альбомной ориентации с сенсорным управлением: node tools/shot_phone.js <out.jpg> [w h]
const { chromium } = require('playwright');
(async () => {
  const [out, w = 915, h = 412] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__app && document.querySelector('#menu-actions button'));
  await p.screenshot({ path: out.replace('.jpg', '_menu.jpg'), type: 'jpeg', quality: 80 });
  await p.evaluate(() => window.__app.start(null));
  await p.waitForFunction(() => window.__app.playing, null, { timeout: 120000 });
  await p.evaluate(() => { const a = window.__app; a.close(); a.world.player.autoWalk = new V3(0, 0, 60); });
  await p.waitForTimeout(6000);
  await p.evaluate(() => { const a = window.__app; a.world.player.autoWalk = null; a.input.touch.move = [0.4, -0.8]; });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out, type: 'jpeg', quality: 82 });
  await b.close();
})();
