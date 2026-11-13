// Иконки оружия и брони — снимки 3D-моделей игры (как в бою): node tools/wicons/build.js
// Результат: game/js/wicons.js (DW.WICON: w_<оружие>, a_<броня> — картинки внутри файла, без «чужого» холста под file://)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('http://game.local/**', (route) => { const f = path.join(ROOT, 'game', decodeURIComponent(new URL(route.request().url()).pathname)); if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' }); route.fulfill({ status: 200, body: fs.readFileSync(f) }); });
  await page.goto('http://game.local/index.html?nosplash');
  await page.waitForFunction(() => window.DW && DW.R3 && DW.R3.preview && DW.M3, null, { timeout: 60000 });
  const out = await page.evaluate(async () => {
    // обрезать прозрачные края, вписать в w×h с полями, webp
    const fit = (url, w, h, pad) => new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const og = o.getContext('2d');
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
        og.shadowColor = 'rgba(0,0,0,0.55)'; og.shadowBlur = 8; og.shadowOffsetY = 4;
        og.imageSmoothingQuality = 'high';
        og.drawImage(c, x0, y0, bw, bh, (w - bw * k) / 2, (h - bh * k) / 2, bw * k, bh * k);
        res(o.toDataURL('image/webp', 0.9));
      };
      im.src = url;
    });
    const PV = DW.R3.preview, res = {};
    for (const id of Object.keys(DW.M3.weapons)) {
      const u = await PV.snap({ view: 'weapon', weapon: id, w: 720, h: 260 });
      if (u) res['w_' + id] = await fit(u, 360, 120, 6);
    }
    const ARM = { robe: 'krut', vest: 'vest', heavy: 'heavy', exo: 'exo' };
    for (const a in ARM) {
      if (!DW.M3.bodies[ARM[a]]) continue;
      const u = await PV.snap({ body: ARM[a], weapon: 'ak', view: 'torso', yaw: 0.3, w: 400, h: 400 });
      if (u) res['a_' + a] = await fit(u, 192, 192, 6);
    }
    return res;
  });
  const keys = Object.keys(out);
  const js = "'use strict';\n/* Иконки оружия и брони — снимки 3D-моделей; сгенерировано tools/wicons/build.js — не править руками */\nwindow.DW = window.DW || {};\nDW.WICON = {\n" +
    keys.map((k) => '  ' + k + ": '" + out[k] + "'").join(',\n') + '\n};\n';
  fs.writeFileSync(path.join(ROOT, 'game/js/wicons.js'), js);
  console.log(keys.join(' '), Math.round(js.length / 1024) + ' КБ', errs.slice(0, 3).join(' | '));
  await b.close();
})();
