// Ужать исходники Tripo: node tools/art3d/shrink.js art3d/src/dw/*.glb (заменяет файлы, если стало меньше)
const fs = require('fs'), path = require('path');
const { open, ROOT } = require('./run.js');
(async () => {
  const files = process.argv.slice(2);
  const { browser, page } = await open();
  for (const f of files) {
    const abs = path.resolve(f); const before = fs.statSync(abs).size;
    if (before < 1.6e6) { console.log('мал', f); continue; }
    try {
      const b64 = await page.evaluate((u) => BK.shrink(u, 1024), '/' + path.relative(ROOT, abs));
      const buf = Buffer.from(b64, 'base64');
      if (buf.length < before) { fs.writeFileSync(abs, buf); console.log(f, (before / 1e6).toFixed(1) + ' → ' + (buf.length / 1e6).toFixed(1) + ' МБ'); }
      else console.log(f, 'без выигрыша');
    } catch (e) { console.log('ОШИБКА', f, String(e).slice(0, 200)); }
  }
  await browser.close();
})();
