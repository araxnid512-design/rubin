// Лист снимков кистей без окна (Playwright + Chromium):
// node tools/three3d/griplab/sheet.js out.png "bodies=krut,heavy&weapons=ak,ppsh&poses=idle,aim,reload@0.9&views=game,front,rclose,lclose&grip=1"
// poses: движение[@доля времени][:режим][~поворот°]; views: front side sidel back top game gameb gamef rclose rin lclose lup;
// grip=0 — без grip.js (как было), hook=1 — grip.apply и в режиме «в кисти», dbg=1 — оси и точки, cell — размер клетки.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
(async () => {
  const out = process.argv[2] || 'sheet.png', q = process.argv[3] || '';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('http://lab.local/**', (route) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, body: fs.readFileSync(f) });
  });
  await page.goto('http://lab.local/tools/three3d/griplab/index.html?sheet=1&' + q);
  await page.waitForFunction(() => window.__sheet || window.__sheetErr, null, { timeout: 600000 });
  const r = await page.evaluate(() => window.__sheetErr || window.__sheet);
  if (!/^data:image\/png/.test(r)) { console.error(r); process.exitCode = 1; }
  else fs.writeFileSync(out, Buffer.from(r.split(',')[1], 'base64'));
  const jt = await page.evaluate(() => window.__joints || null);
  if (jt) console.log(jt.join('\n'));
  const ck = await page.evaluate(() => window.__checks || null);
  if (ck) console.log(ck.join('\n'));
  const tr = await page.evaluate(() => window.__trace || null);
  if (tr) console.log(tr.join('\n'));
  if (errs.length) console.error('ошибки страницы:', errs.slice(0, 5).join(' | '));
  await b.close();
})();
