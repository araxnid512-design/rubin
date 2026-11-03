// Замер производительности по пресетам качества: node tools/bench.js [w h]
// Внимание: в этой среде нет GPU — рендер идёт программно (SwiftShader на CPU), поэтому FPS — нижняя оценка.
const { chromium } = require('playwright');
(async () => {
  const [w = 1280, h = 720] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__app && document.querySelector('#menu-actions button'));
  await p.evaluate(() => window.__app.start(null));
  await p.waitForFunction(() => window.__app.playing, null, { timeout: 120000 });
  console.log('load ms', await p.evaluate(() => window.__app.loadMs));
  await p.evaluate(() => { const a = window.__app; a.close(); });
  for (const [name, x, z] of [['plac (base center, 6 soldiers)', 0, -8], ['KPP', 0, 70], ['forest edge', -110, 40]]) {
    for (const q of [0, 1, 2]) {
      const r = await p.evaluate(async ([q, x, z]) => {
        const a = window.__app; a.settings.applyPreset(q); a.settings.fpsLimit = 60; a.applySettings();
        const pl = a.world.player; pl.pos.x = x; pl.pos.z = z; a.cam.snap();
        await new Promise((res) => setTimeout(res, 1200));
        const t0 = performance.now(); let n = 0, logic = 0, ms = 0;
        await new Promise((res) => { const f = () => { n++; logic += a.stats.logic; ms += a.stats.ms; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        const sec = (performance.now() - t0) / 1000;
        return { fps: +(n / sec).toFixed(1), logicMs: +(logic / n).toFixed(2), cpuFrameMs: +(ms / n).toFixed(2), dc: a.stats.dc, tris: a.stats.tris, res: a.stats.w + 'x' + a.stats.h };
      }, [q, x, z]);
      console.log(name.padEnd(32), ['low', 'medium', 'high'][q].padEnd(7), JSON.stringify(r));
    }
  }
  await b.close();
})();
