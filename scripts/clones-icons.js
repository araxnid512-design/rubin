// Иконка и заставка «Клонов против дроидов» для Android: рисуются кодом на холсте и сохраняются в PNG.
// Запуск (нужен Playwright с Chromium): node scripts/clones-icons.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const res = path.join(__dirname, '..', 'clones', 'android', 'app', 'src', 'main', 'res');
const font = fs.readFileSync(path.join(__dirname, '..', 'clones', 'www', 'fonts', 'russo-one-cyrillic.woff2')).toString('base64');
const DPI = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };
const BG = '#0b1a2a';

// рисование внутри страницы: фон, шлем клона (белый купол, Т-образный визор, синяя полоса), подпись
const page = `<!doctype html><style>@font-face{font-family:R;src:url(data:font/woff2;base64,${font})}</style><body><script>
function bg(g, w, h) {
  const gr = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  gr.addColorStop(0, '#1b4a72'); gr.addColorStop(0.55, '#0c2238'); gr.addColorStop(1, '#050b13');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function helmet(g, cx, cy, s) {
  const P = (x, y) => [cx + (x - 0.5) * s, cy + (y - 0.5) * s];
  const path = pts => { g.beginPath(); pts.forEach((p, i) => { const q = P(...p); i ? g.lineTo(...q) : g.moveTo(...q); }); g.closePath(); };
  // купол
  g.save(); g.shadowColor = 'rgba(111,208,255,.55)'; g.shadowBlur = s * 0.08;
  g.beginPath(); g.moveTo(...P(0.5, 0.1));
  g.bezierCurveTo(...P(0.8, 0.1), ...P(0.84, 0.32), ...P(0.82, 0.5));
  g.lineTo(...P(0.82, 0.68)); g.lineTo(...P(0.88, 0.84)); g.lineTo(...P(0.82, 0.9)); g.lineTo(...P(0.62, 0.9)); g.lineTo(...P(0.6, 0.8));
  g.lineTo(...P(0.4, 0.8)); g.lineTo(...P(0.38, 0.9)); g.lineTo(...P(0.18, 0.9)); g.lineTo(...P(0.12, 0.84)); g.lineTo(...P(0.18, 0.68)); g.lineTo(...P(0.18, 0.5));
  g.bezierCurveTo(...P(0.16, 0.32), ...P(0.2, 0.1), ...P(0.5, 0.1)); g.closePath();
  const wg = g.createLinearGradient(...P(0.2, 0.1), ...P(0.8, 0.9)); wg.addColorStop(0, '#ffffff'); wg.addColorStop(0.6, '#e4e9ee'); wg.addColorStop(1, '#aeb8c2');
  g.fillStyle = wg; g.fill(); g.restore();
  // синяя полоса по центру купола
  path([[0.47, 0.105], [0.53, 0.105], [0.535, 0.4], [0.465, 0.4]]); const sg = g.createLinearGradient(...P(0.5, 0.1), ...P(0.5, 0.4)); sg.addColorStop(0, '#5aa0ff'); sg.addColorStop(1, '#2f6fdc'); g.fillStyle = sg; g.fill();
  // Т-образный визор
  path([[0.24, 0.42], [0.76, 0.42], [0.74, 0.53], [0.56, 0.53], [0.54, 0.76], [0.46, 0.76], [0.44, 0.53], [0.26, 0.53]]);
  const vg = g.createLinearGradient(...P(0.3, 0.42), ...P(0.6, 0.76)); vg.addColorStop(0, '#1d3550'); vg.addColorStop(0.35, '#07090d'); vg.addColorStop(1, '#020305');
  g.fillStyle = vg; g.fill();
  g.strokeStyle = 'rgba(140,200,255,.55)'; g.lineWidth = s * 0.012; g.beginPath(); g.moveTo(...P(0.3, 0.445)); g.lineTo(...P(0.5, 0.445)); g.stroke();
  // «уши» и решётка дыхания
  g.fillStyle = '#8f9aa6'; for (const x of [0.2, 0.8]) { g.beginPath(); g.arc(...P(x, 0.6), s * 0.04, 0, 7); g.fill(); }
  for (const x of [0.36, 0.64]) { path([[x - 0.05, 0.66], [x + 0.05, 0.66], [x + 0.04, 0.7], [x - 0.04, 0.7]]); g.fill(); }
}
function draw(w, h, mode) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (mode === 'fg') helmet(g, w / 2, h / 2 + w * 0.01, w * 0.6);
  else if (mode === 'splash') {
    bg(g, w, h); const s = Math.min(w, h);
    helmet(g, w / 2, h * 0.4, s * 0.42);
    g.textAlign = 'center'; g.fillStyle = '#e9f3fb'; g.font = (s * 0.075) + 'px R'; g.fillText('КЛОНЫ ПРОТИВ ДРОИДОВ', w / 2, h * 0.8);
    g.fillStyle = '#6fd0ff'; g.font = (s * 0.032) + 'px R'; g.fillText('ЗАГРУЗКА', w / 2, h * 0.88);
  } else {
    g.save(); g.beginPath(); if (mode === 'round') g.arc(w / 2, h / 2, w / 2, 0, 7); else g.roundRect(0, 0, w, h, w * 0.18); g.clip();
    bg(g, w, h); helmet(g, w / 2, h / 2 + w * 0.02, w * 0.84); g.restore();
  }
  return c.toDataURL('image/png').split(',')[1];
}
</script>`;

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent(page); await p.evaluate(() => document.fonts.load('40px R'));
  const save = async (file, w, h, mode) => { fs.writeFileSync(path.join(res, file), Buffer.from(await p.evaluate(([w, h, m]) => draw(w, h, m), [w, h, mode]), 'base64')); };
  for (const [d, k] of Object.entries(DPI)) {
    await save(`mipmap-${d}/ic_launcher.png`, 48 * k, 48 * k, 'square');
    await save(`mipmap-${d}/ic_launcher_round.png`, 48 * k, 48 * k, 'round');
    await save(`mipmap-${d}/ic_launcher_foreground.png`, 108 * k, 108 * k, 'fg');
    const [w, h] = SPLASH[d];
    await save(`drawable-land-${d}/splash.png`, w, h, 'splash');
    await save(`drawable-port-${d}/splash.png`, h, w, 'splash');
  }
  await save('drawable/splash.png', 480, 320, 'splash');
  fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  await b.close();
  console.log('иконки и заставки записаны в', path.relative(process.cwd(), res));
})();
