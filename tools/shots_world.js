const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', (m) => console.log(m.type() + ': ' + m.text().slice(0, 400)));
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  await p.goto('http://127.0.0.1:8765/tools/test_world.html');
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const views = [['base_center', [0, 22, 4, 0, 0, -16]], ['kpp', [0, 20, 104, 0, 0, 84]], ['hq', [-6, 24, -12, 0, 0, -36]], ['warehouse', [40, 26, -24, 62, 0, -40]], ['aerial', [-60, 130, 170, 0, 0, -20, 600]], ['bandits', [110, 26, -40, 124, 0, -62]]];
  for (const [name, v] of views) {
    await p.evaluate((v) => window.view(...v), v);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/${name}.png` });
    console.log('SHOT', name, await p.evaluate(() => [window.__drawCalls, window.__tris]));
  }
  await b.close();
})();
