// Проверка загрузчика GLB движка на тестовых моделях (tools/make_test_glb.py): текстура, скелет, клипы, подмена моделей в игре.
// Запуск: python3 tools/make_test_glb.py <папка> && node tools/fl_glb_test.js <папка> <папка-скриншотов>
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const fix = process.argv[2], out = process.argv[3] || '.';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; const results = [];
  p.on('pageerror', (e) => { console.log('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]); errors.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { console.log(m.type() + ': ' + m.text()); if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const manifest = { models: {
    military_barracks: { file: 'models/test_box.glb' }, veh_utility_car: { file: 'models/test_box.glb' }, scrap_metal: { file: 'models/test_box.glb' },
    tool_hammer: { file: 'models/test_box.glb' }, wp_rifle_v7: { file: 'models/test_box.glb' }, npc_infantry: { file: 'models/test_character.glb', height: 1.8 }, avatar_player: { file: 'models/test_character.glb', height: 1.8 },
  } };
  await p.route('**/frontline/assets/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(manifest) }));
  await p.route('**/frontline/assets/models/*.glb', (r) => { const n = r.request().url().split('/').pop(); r.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync(fix + '/' + n) }); });
  const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'ок      ' : 'ОШИБКА  ') + name + (info ? ' — ' + info : '')); };
  await p.goto('http://127.0.0.1:8765/frontline/index.html');
  await p.waitForFunction(() => window.__fl && document.querySelector('#menu-actions button'), null, { timeout: 60000 });
  await p.evaluate(() => localStorage.clear());
  const ld = await p.evaluate(() => { const A = window.__fl.assets; return { n: A.models.size, failed: A.failed, box: A.get('military_barracks') && { prims: A.get('military_barracks').prims.length, tex: !!A.get('military_barracks').prims[0].tex }, ch: A.get('npc_infantry') && { clips: A.get('npc_infantry').clips.map((c) => c.name), skins: A.get('npc_infantry').skins.length } }; });
  check('GLB загружены: 7 моделей, без ошибок', ld.n === 7 && !ld.failed.length, JSON.stringify(ld));
  check('текстура из GLB и скелет с клипами разобраны', ld.box && ld.box.tex && ld.ch && ld.ch.skins === 1 && ld.ch.clips.join(',') === 'idle,walk,shoot,fall');
  await p.evaluate(() => window.__fl.start(false));
  await p.waitForFunction(() => window.__fl.playing, null, { timeout: 60000 });
  const r = await p.evaluate(() => {
    const a = window.__fl, c = a.c; c.scrap = 999;
    const res = c.build('military_barracks', -50, 60, 0, true); const ent = a.sector.addBuilding(res.rec);
    const gl = ent.glb, size = gl && [gl.scale, gl.height];
    c.hire(res.rec.uid, 'npc_infantry'); c.advance(41);
    a.player.pos.x = -50; a.player.pos.z = 75; a.cam.snap();
    return { glb: !!gl, objs: gl ? gl.objs.length : 0, procHidden: !ent.shell.visible, size, piles: !!a.sector.piles[0].o.glb, playerGlb: a.player.rig.constructor.name, tool: !!a.player.tools.tool_hammer.glb };
  });
  check('здание из GLB подогнано под пятно 16×12 (ящик 10×4×8 → ×1,46), процедурное скрыто', r.glb && r.objs === 1 && r.procHidden && Math.abs(r.size[0] - 11.7 / 8) < 0.01 && Math.abs(r.size[1] - 4 * 11.7 / 8) < 0.05, JSON.stringify(r));
  check('кучи металлолома, молоток и игрок — из GLB', r.piles && r.tool && r.playerGlb === 'GlbCharacter');
  await p.waitForTimeout(1200);
  const an = await p.evaluate(async () => {
    const a = window.__fl, u = a.c.recruits[0], e = a.unitsView.get(u.uid); if (!e) return { none: true };
    const rig = e.rig, bt = rig.inst.objs[0].boneTex, before = Array.from(bt.data.slice(16, 32));
    const out = { cls: rig.constructor.name, clip0: rig.inst.clipA && rig.inst.clipA.name };
    a.army.setOrder(u.uid, 'move', { sector: 'friendly_home', x: u.x + 20, z: u.z });
    await new Promise((r) => setTimeout(r, 1500)); out.clipMove = rig.inst.clipA && rig.inst.clipA.name;
    const after = Array.from(bt.data.slice(16, 32)); out.bonesChanged = after.some((x, i) => Math.abs(x - before[i]) > 1e-4);
    a.c.storage.wp_rifle_v7 = 1; a.c.storage.ammo_762x54 = 20; u.sector = 'friendly_home'; a.army.equip(u);
    await new Promise((r) => setTimeout(r, 300)); out.weapon = !!rig.weaponObj && !!e.wglb && e.wglbId === 'wp_rifle_v7' && !rig.weaponObj.visible;
    rig.aiming = true; rig.update(0.016, rig.xf); out.clipAim = rig.inst.clipA && rig.inst.clipA.name;
    rig.die(); await new Promise((r) => setTimeout(r, 400)); out.clipDead = rig.inst.clipA && rig.inst.clipA.name;
    return out;
  });
  check('персонаж GLB: клипы idle → walk → shoot → fall, кости двигаются, оружие в руке', an.cls === 'GlbCharacter' && an.clip0 === 'idle' && an.clipMove === 'walk' && an.clipAim === 'shoot' && an.clipDead === 'fall' && an.bonesChanged && an.weapon, JSON.stringify(an));
  await p.screenshot({ path: out + '/glb_test.jpg', type: 'jpeg', quality: 80 });
  console.log(`ИТОГ: проверок ${results.length}, не прошло ${results.filter((x) => !x).length}, ошибок в консоли ${errors.length}`);
  await b.close();
})();
