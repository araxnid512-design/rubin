// Скриншот тестовой страницы: node tools/shot_page.js <url-path> <out.png> [width height wait_ms]
const { chromium } = require('playwright');
(async () => {
  const [path, out, w = 1600, h = 900, wait = 1500] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', (m) => { if (m.type() !== 'log' || process.env.VERBOSE) console.log(m.type() + ': ' + m.text().slice(0, 400)); });
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  await p.goto('http://127.0.0.1:8765/' + path);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.waitForTimeout(+wait);
  await p.screenshot(out.endsWith('.jpg') ? { path: out, type: 'jpeg', quality: 82 } : { path: out });
  await b.close();
})();
