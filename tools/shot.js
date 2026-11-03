// Скриншот страницы движка в headless Chromium: node tools/shot.js <url> <out.png> [ms] [WxH]
const { chromium } = require('playwright');
(async () => {
  const [url, out, ms = '1500', wh = '1280x720'] = process.argv.slice(2);
  const [w, h] = wh.split('x').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const logs = [];
  p.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  p.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  await p.goto(url);
  await p.waitForTimeout(+ms);
  await p.screenshot({ path: out });
  console.log(logs.slice(0, 40).join('\n'));
  await b.close();
})();
