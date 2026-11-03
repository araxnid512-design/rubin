// Сценарий проверки актёров: генерал идёт к бойцам, бойцы следуют, бой с собаками.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', (m) => console.log(m.type() + ': ' + m.text().slice(0, 300)));
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.goto('http://127.0.0.1:8765/tools/test_actors.html');
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.evaluate(() => { window.__paused = true; });
  const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${n}.png` }); console.log('SHOT', n, await p.evaluate(() => JSON.stringify({ pos: __world.player.pos.toArray(), dc: window.__dc }))); };
  await p.evaluate(() => __step(10));
  await shot('a_start');
  // идём к плацу, где стоят бойцы
  await p.evaluate(() => { __world.player.autoWalk = new V3(0, 0, -6); });
  const t0 = Date.now();
  await p.evaluate(() => __step(30 * 34));
  console.log('walk sim ms', Date.now() - t0);
  await p.evaluate(() => { __world.player.autoWalk = null; __step(30); });
  await shot('b_parade');
  // приказ: следовать
  await p.evaluate(() => { for (const s of __world.soldiers) s.giveOrder('follow'); __world.player.autoWalk = new V3(-60, 0, -130); __step(30 * 30); });
  await shot('c_follow_out');
  await p.evaluate(() => { __step(30 * 20); });
  await shot('d_dogs');
  console.log(await p.evaluate(() => JSON.stringify({ hp: __world.player.hp, sold: __world.soldiers.map(s => [s.def.call, s.state, Math.round(s.hp), s.pos.toArray().map(Math.round)]), dogs: __world.groups[0].members.map(m => [m.alive, m.state, Math.round(m.hp)]) })));
  await b.close();
})();
