// Автотест «Линии снабжения» (свой WebGL2-движок). Запуск: node tools/test_stages_1_5.js <папка-для-скриншотов>
// A — перенос tests/smoke.gd стартового пакета; B — этапы 1–4 через интерфейс (добыча, стройка 4×3, производство,
// казарма, бункер, сохранение/перезагрузка, переходы после 30:00).
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const W = +(process.env.W || 1280), H = +(process.env.H || 720);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => { console.log('PAGEERROR: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')); errors.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) { console.log('console.error: ' + m.text()); errors.push(m.text()); } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const results = [];
  const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'ок      ' : 'ОШИБКА  ') + name + (info ? ' — ' + info : '')); };
  const E = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 80 }); };
  const open = async () => {
    await p.goto('http://127.0.0.1:8765/index.html');
    await p.waitForFunction(() => window.__fl && document.querySelector('#menu-actions button'), null, { timeout: 60000 });
  };
  await open();
  await E(() => localStorage.clear());
  await shot('01_menu');
  await E(() => window.__fl.start(false));
  await p.waitForFunction(() => window.__fl.playing, null, { timeout: 60000 });
  // ===================== A. smoke.gd
  const A = await E(async () => {
    const a = window.__fl, c = a.c, r = {};
    r.player = !!a.player;
    r.before = a.transitionTo(1, [0, 141]);
    c.advance(1799); r.at1799 = c.canEnterSector(1);
    c.advance(1); r.at1800 = c.canEnterSector(1);
    r.report = c.enemy.report();
    r.conserve = r.report.total_harvested === r.report.scrap_metal + r.report.total_spent;
    const { EnemyDirector } = await import('/sim/enemy_director.js');
    const saved = c.enemy.serialize(), re = new EnemyDirector(a.data.enemy_ai, a.data.buildings); re.loadState(saved);
    r.roundtrip = JSON.stringify(re.serialize()) === JSON.stringify(saved);
    r.enter1 = a.transitionTo(1, [0, 141]);
    r.invade = a.transitionTo(2, [0, 141]); r.sectorAfter = c.sector_index;
    r.back = a.transitionTo(0, [0, -141]);
    r.invade2 = a.transitionTo(2, [0, 141]);
    r.piles = [];
    for (const i of [0, 1, 2]) { a.loadSector(i, a.data.world.sectors[i].player_spawn_xz); r.piles.push([!!a.sector.terrain, a.sector.piles.length, a.sector.objects.length]); }
    return r;
  });
  check('игрок создан', A.player);
  check('до подготовки поле боя закрыто', A.before === false);
  check('при 1799 с ещё закрыто, при 1800 с открыто', A.at1799 === false && A.at1800 === true);
  check('враг за 30 минут развил экономику и нанял войска', A.report.buildings >= 3 && A.report.soldiers >= 1, `зданий ${A.report.buildings}, рабочих ${A.report.workers}, механиков ${A.report.mechanics}, солдат ${A.report.soldiers}`);
  check('экономика врага не создаёт и не теряет металл', A.conserve, `добыто ${A.report.total_harvested} = ${A.report.scrap_metal} осталось + ${A.report.total_spent} потрачено`);
  check('сохранение/загрузка ИИ врага без изменений', A.roundtrip);
  check('после 30:00 вход на поле боя', A.enter1 === true);
  check('вторжение №2→№3 запрещено, игрок остался на №2', A.invade === false && A.sectorAfter === 1);
  check('возврат с поля боя домой', A.back === true);
  check('прямой переход №1→№3 запрещён', A.invade2 === false);
  check('3 карты: рельеф есть, кучи металлолома 12/0/12', A.piles.map((x) => x[0]).every(Boolean) && A.piles.map((x) => x[1]).join('/') === '12/0/12', A.piles.map((x) => x[1]).join('/'));
  // обзор трёх карт сверху и с игровой камеры
  for (const [i, name] of [[0, 'map1_friendly'], [1, 'map2_battlefield'], [2, 'map3_enemy']]) {
    await E((i) => { const a = window.__fl; a.loadSector(i, a.data.world.sectors[i].player_spawn_xz); a.debugView = { pos: new V3(0, 250, 205), target: new V3(0, 0, -12) }; a.r.fogStart = 2000; a.r.fogEnd = 3000; for (const o of a.sector.objects) o.maxDist = 5000; document.getElementById('hud').hidden = true; }, i);
    await shot(`02_${name}_overview`);
    await E((i) => { const a = window.__fl, sp = { 0: [88, -40], 1: [12, 30], 2: [90, -6] }[i]; document.getElementById('hud').hidden = false; a.r.fogStart = 70; a.r.fogEnd = 230; a.debugView = null; a.player.pos.x = sp[0]; a.player.pos.z = sp[1]; a.player.pos.y = a.sector.h(sp[0], sp[1]); a.cam.snap(); }, i);
    await shot(`03_${name}_ground`);
  }
  // ===================== B. новая кампания через интерфейс
  await E(() => { localStorage.clear(); window.__fl.start(false); });
  await p.waitForFunction(() => window.__fl.playing && window.__fl.c.campaign_seconds < 1, null, { timeout: 60000 });
  await E(() => { window.V3 = window.V3 || window.__fl.player.pos.constructor; });
  // helper: шаги симуляции без отрисовки
  await E(() => {
    const a = window.__fl;
    window.__sim = (sec) => { for (let i = 0; i < sec * 30; i++) a.step(1 / 30); a.cam.follow(a.player.pos, a.player.vel, 0.1); a.cam.update(innerWidth / innerHeight); a.player.updateVisual(1 / 30); };
    window.__walk = (x, z, maxSec = 120) => { const V = a.player.pos.constructor; a.autoWalk = new V(x, 0, z); let t = 0; while (t < maxSec && Math.hypot(a.player.pos.x - x, a.player.pos.z - z) > 0.8) { a.step(1 / 30); t += 1 / 30; } a.autoWalk = null; a.cam.snap(); return Math.hypot(a.player.pos.x - x, a.player.pos.z - z); };
    window.__mineAll = () => { let hits = 0; for (const pile of a.sector.piles) { if (!pile.o.visible) continue; window.__walk(pile.x - 2.6, pile.z + 0.5, 30); for (let k = 0; k < 8 && pile.o.visible; k++) { a.ui.doAction(); hits++; for (let s = 0; s < 15; s++) a.step(1 / 30); } } return hits; };
  });
  // переход до таймера заблокирован у северной границы
  const blocked = await E(() => { const a = window.__fl; window.__walk(0, -152, 90); return { sector: a.c.sector_index, z: a.player.pos.z }; });
  check('до 30:00 северная граница не пускает на поле боя', blocked.sector === 0 && blocked.z > -149, `z ${blocked.z.toFixed(1)}`);
  // к полю металлолома
  const far = await E(() => window.__walk(98, -50, 120));
  await shot('04_scrap_field');
  const mine = await E(() => {
    const a = window.__fl, c = a.c, pile = a.sector.piles[0], r = {};
    window.__walk(pile.x - 2.6, pile.z + 0.5, 20);
    c.select(1); r.wrong = a.mine(); r.scrapW = c.scrap; c.select(0); a.ui.refreshTool();
    r.gains = [];
    for (let k = 0; k < 6; k++) { const s0 = c.scrap; a.ui.doAction(); r.gains.push(c.scrap - s0); for (let s = 0; s < 15; s++) a.step(1 / 30); }
    r.visible = pile.o.visible; r.state = c.nodeState(0);
    const s1 = c.scrap; a.ui.doAction(); r.after = c.scrap - s1;
    r.spam = (() => { const p2 = a.sector.piles[1]; window.__walk(p2.x - 2.6, p2.z + 0.5, 20); const s0 = c.scrap; a.ui.doAction(); a.ui.doAction(); a.ui.doAction(); return c.scrap - s0; })();
    return r;
  });
  check('путь к полю металлолома проходим', far < 1, `осталось ${far.toFixed(1)} м`);
  check('гаечным ключом добыть нельзя', mine.wrong.ok === false && mine.scrapW === 0, mine.wrong.reason);
  check('6 ударов молотком: +5 каждый, итого 30', mine.gains.join(',') === '5,5,5,5,5,5', mine.gains.join(','));
  check('разобранная куча исчезает и не даёт металла', !mine.visible && mine.state === 'recovering' && mine.after === 0);
  check('защита от частых нажатий (0,45 с)', mine.spam === 5, `за 3 быстрых нажатия +${mine.spam}`);
  await shot('05_mining');
  // восстановление через 120 с и добыча на постройки
  const regen = await E(() => { const a = window.__fl; a.c.advance(121); a.c.nodeState(0); a.sector.refreshPiles(); return [a.sector.piles[0].o.visible, a.c.nodes[0].d]; });
  check('куча восстанавливается через 120 с', regen[0] && regen[1] === 6);
  const farm = await E(() => { const a = window.__fl; let cycles = 0; while (a.c.scrap < 660 && cycles < 6) { window.__mineAll(); cycles++; if (a.c.scrap < 660) { a.c.advance(121); for (let i = 0; i < 12; i++) a.c.nodeState(i); a.sector.refreshPiles(); } } return { scrap: a.c.scrap, cycles, harvested: a.c.totals.harvested }; });
  check('металлолом добыт для построек', farm.scrap >= 660, `${farm.scrap} за ${farm.cycles} цикла`);
  // меню стройки 4×3
  await E(() => { const a = window.__fl; window.__walk(-45, 45, 120); a.c.select(1); a.ui.refreshTool(); a.ui.open('build'); });
  const menu = await E(() => { const tabs = [...document.querySelectorAll('.tabs .btn')].map((b) => b.textContent); const per = []; for (const t of document.querySelectorAll('.tabs .btn')) { t.click(); per.push([...document.querySelectorAll('.cards .card b')].map((x) => x.textContent)); } return { tabs, per }; });
  check('4 раздела по 3 здания = 12', menu.tabs.join('|') === 'ТЕХНИКА|ОРУЖИЕ|БОЕПРИПАСЫ|ВОЕННОЕ' && menu.per.every((x) => x.length === 3), menu.per.map((x) => x.join(', ')).join(' | '));
  await E(() => [...document.querySelectorAll('.tabs .btn')][1].click());
  await p.waitForTimeout(400);
  await shot('06_build_menu_weapons');
  // размещение: призрак, проверка площадки, поворот, подтверждение
  const scrap0 = await E(() => window.__fl.c.scrap);
  await E(() => [...document.querySelectorAll('.cards .card')][0].click());
  const place = await E(() => {
    const a = window.__fl, r = {};
    r.placing = !!a.placing; r.ghosts = a.placing.objs.length;
    a.placing.x = -8; a.placing.z = 15; a.updateGhost(); r.road = a.placing.why;
    a.placing.x = 105; a.placing.z = -55; a.updateGhost(); r.field = a.placing.why;
    a.placing.x = 0; a.placing.z = -149; a.updateGhost(); r.edge = a.placing.why;
    a.placing.x = -45; a.placing.z = 30; a.updateGhost(); r.ok = a.placing.why; r.scrapNoCharge = a.c.scrap;
    a.rotate(90); r.angle = a.placing.angle;
    return r;
  });
  check('режим размещения: полупрозрачный призрак', place.placing && place.ghosts >= 1);
  check('нельзя на дороге / на поле металлолома / у границы', /дорог/.test(place.road) && /металлолом/.test(place.field) && /границ/.test(place.edge), [place.road, place.field, place.edge].join(' · '));
  check('свободная площадка — зелёная, без списания до подтверждения', place.ok === '' && place.scrapNoCharge === scrap0);
  // мышью: призрак следует за курсором
  const mouseOk = await E(() => { const a = window.__fl, s = a.cam.project(new V3(-40, a.sector.h(-40, 38), 38), innerWidth, innerHeight); return s ? [s.x, s.y] : null; });
  if (mouseOk) { await p.mouse.move(mouseOk[0] - 30, mouseOk[1] - 20); await p.mouse.move(mouseOk[0], mouseOk[1]); }
  await p.waitForTimeout(300);
  const mpos = await E(() => [window.__fl.placing.x, window.__fl.placing.z]);
  check('призрак следует за курсором/пальцем по земле', Math.abs(mpos[0] + 40) < 1.5 && Math.abs(mpos[1] - 38) < 1.5, mpos.join(', '));
  await shot('07_placement_valid');
  await E(() => { const a = window.__fl; a.placing.x = 0; a.placing.z = 20; a.updateGhost(); });
  await shot('08_placement_invalid');
  const built = await E(() => {
    const a = window.__fl, c = a.c; a.placing.x = -40; a.placing.z = 28; a.updateGhost();
    const s0 = c.scrap; const btn = [...document.querySelectorAll('.place-btns .btn')].find((b) => b.textContent.includes('ПОСТРОИТЬ')); btn.click(); btn.click(); a.confirmPlacement();
    return { n: c.buildings.length, spent: s0 - c.scrap, rec: c.buildings[0], ents: a.sector.buildings.size, placing: !!a.placing };
  });
  check('ПОСТРОИТЬ списывает цену ровно один раз (без дублей)', built.n === 1 && built.spent === 80 && built.ents === 1 && !built.placing, `зданий ${built.n}, списано ${built.spent}`);
  check('координаты и угол сохранены', built.rec.x === -40 && built.rec.z === 28 && built.rec.angle === 90, JSON.stringify(built.rec));
  // ОТМЕНА без затрат
  const cancel = await E(() => { const a = window.__fl, s0 = a.c.scrap; a.startPlacement('ammo_bench'); [...document.querySelectorAll('.place-btns .btn')].find((b) => b.textContent.includes('ОТМЕНА')).click(); return { s: a.c.scrap - s0, n: a.c.buildings.length, placing: !!a.placing }; });
  check('ОТМЕНА не тратит металл', cancel.s === 0 && cancel.n === 1 && !cancel.placing);
  // ещё здания: патронный верстак, казарма, бункер
  const more = await E(() => {
    const a = window.__fl, c = a.c, put = (id, x, z, ang = 0) => { a.startPlacement(id); a.placing.x = x; a.placing.z = z; a.placing.angle = ang; a.updateGhost(); const why = a.placing.why; const r = a.confirmPlacement(); return why || (r && r.ok ? 'ok' : r && r.reason); };
    return [put('ammo_bench', -40, 45), put('military_barracks', -75, 30), put('military_bunker', -70, 75)];
  });
  check('построены патронный верстак, казарма, бункер', more.every((x) => x === 'ok'), more.join(' | '));
  // производство: подойти к верстаку, ИСПОЛЬЗОВАТЬ, СОЗДАТЬ
  const prod = await E(() => {
    const a = window.__fl, c = a.c, ent = [...a.sector.buildings.values()].find((e) => e.rec.id === 'weapon_bench');
    const front = ent.xf.mulV(new V3(0, 0, ent.fd / 2 + 1.6)); a.player.pos.x = front.x; a.player.pos.z = front.z; a.step(1 / 30);
    const ctx = a.ui.context(); a.ui.doAction();
    const win = a.ui.winKind, s0 = c.scrap;
    const btns = [...document.querySelectorAll('.win .recipe .btn')]; btns[1].click(); // винтовка В-7
    const spent = s0 - c.scrap, q = c.queue(ent.rec.uid).length;
    return { ctx: ctx && ctx.label + ' ' + ctx.sub, win, spent, q, uid: ent.rec.uid };
  });
  check('у здания кнопка ИСПОЛЬЗОВАТЬ открывает производство', prod.ctx === 'ИСПОЛЬЗОВАТЬ Оружейный верстак' && prod.win === 'building', prod.ctx);
  check('заказ винтовки: −25 металла, в очереди', prod.spent === 25 && prod.q === 1);
  await shot('09_production');
  const prod2 = await E((uid) => { const a = window.__fl, c = a.c; a.ui.close(); c.advance(7.2); const ammo = [...a.sector.buildings.values()].find((e) => e.rec.id === 'ammo_bench'); c.produce(ammo.rec.uid, 'ammo_762x54'); c.advance(5.5); const q = c.queue(uid); for (let i = 0; i < 6; i++) c.produce(uid, 'wp_pistol_p9'); return { st: { ...c.storage }, qlen: c.queue(uid).length }; }, prod.uid);
  check('через 7 с винтовка и патроны на складе', prod2.st.wp_rifle_v7 === 1 && prod2.st.ammo_762x54 === 20, JSON.stringify(prod2.st));
  check('очередь ограничена 5 заказами', prod2.qlen === 5);
  await E(() => window.__fl.ui.open('storage'));
  const ready = await E(() => document.querySelector('.win').textContent.includes('готово к бою'));
  check('склад: винтовка с патронами «готово к бою»', ready);
  await shot('10_storage');
  await E(() => window.__fl.ui.close());
  // казарма: найм рабочего
  const hire = await E(() => { const a = window.__fl, c = a.c, ent = [...a.sector.buildings.values()].find((e) => e.rec.id === 'military_barracks'); const s0 = c.scrap; const r = c.hire(ent.rec.uid, 'npc_scrap_worker'); c.advance(25.5); return { ok: r.ok, spent: s0 - c.scrap, recruits: c.recruits.length, npcs: c.recruits.filter((u) => u.sector === 'friendly_home' && c.distToFootprint(ent.rec, u.x, u.z) < 8).length }; });
  check('казарма: найм рабочего за 55 металла, 25 с', hire.ok && hire.spent === 55 && hire.recruits === 1 && hire.npcs === 1, JSON.stringify(hire));
  await E(() => { const a = window.__fl, ent = [...a.sector.buildings.values()].find((e) => e.rec.id === 'military_barracks'); window.__walk(ent.rec.x, ent.rec.z + 11, 30); });
  await shot('11_barracks_recruit');
  // бункер: вход пешком — крыша скрывается, выход — видна
  const bunker = await E(() => {
    const a = window.__fl, ent = [...a.sector.buildings.values()].find((e) => e.rec.id === 'military_bunker');
    const door = ent.xf.mulV(new V3(0, 0, ent.fd / 2 + 6)); a.player.pos.x = door.x; a.player.pos.z = door.z; a.step(1 / 30); const outside = ent.roof.visible;
    const inPt = ent.xf.mulV(new V3(0, 0, 1.5));
    window.__walk(inPt.x, inPt.z, 30); const inside = ent.roof.visible, pz = a.player.pos.z - ent.rec.z;
    return { outside, inside, pz, ent: ent.rec.z };
  });
  await shot('12_bunker_inside');
  const bunkerOut = await E(() => { const a = window.__fl, ent = [...a.sector.buildings.values()].find((e) => e.rec.id === 'military_bunker'), o = ent.xf.mulV(new V3(0, 0, ent.fd / 2 + 6)); window.__walk(o.x, o.z, 30); return ent.roof.visible; });
  check('бункер: внутри крыша скрыта, снаружи видна', bunker.outside && !bunker.inside && bunkerOut, `игрок внутри на ${bunker.pz.toFixed(1)} м от центра`);
  // сохранение и перезагрузка страницы
  const before = await E(() => { const a = window.__fl; a.save(); const d = a.c.serialize(); delete d.saved_at; return JSON.stringify(d); });
  await open();
  await E(() => window.__fl.start(true));
  await p.waitForFunction(() => window.__fl.playing, null, { timeout: 60000 });
  const after = await E(() => { const a = window.__fl, d = a.c.serialize(); delete d.saved_at; return { s: JSON.stringify(d), ents: a.sector.buildings.size, roof: [...a.sector.buildings.values()].every((e) => !e.roof || e.roof.visible || e.inside) }; });
  const bd = JSON.parse(before), ad = JSON.parse(after.s);
  // после загрузки игра сразу продолжает идти: допускаем несколько секунд активного времени
  const es = (d) => JSON.stringify([d.enemy_state.structures, d.enemy_state.recruits, d.enemy_state.total_harvested]);
  if (!(JSON.stringify(bd.buildings) === JSON.stringify(ad.buildings) && bd.scrap === ad.scrap && es(bd) === es(ad) && JSON.stringify(bd.storage) === JSON.stringify(ad.storage))) console.log('DIFF', JSON.stringify(bd.buildings) === JSON.stringify(ad.buildings), bd.scrap, ad.scrap, es(bd) === es(ad), JSON.stringify(bd.storage), JSON.stringify(ad.storage), JSON.stringify(bd.player), JSON.stringify(ad.player));
  check('после перезагрузки: здания, металл, склад, таймер, ИИ врага сохранены', ad.campaign_seconds - bd.campaign_seconds >= 0 && ad.campaign_seconds - bd.campaign_seconds < 6 && JSON.stringify(bd.buildings) === JSON.stringify(ad.buildings) && bd.scrap === ad.scrap && es(bd) === es(ad) && JSON.stringify(bd.storage) === JSON.stringify(ad.storage) && after.ents === 4 && Math.abs(bd.player.x - ad.player.x) < 3,
    `зданий ${after.ents}, металл ${ad.scrap}, время ${bd.campaign_seconds.toFixed(1)} → ${ad.campaign_seconds.toFixed(1)} с`);
  // 30:00 → переход на поле боя пешком и обратно
  const trip = await E(() => {
    const a = window.__fl, c = a.c; window.__sim = window.__sim || null;
    const walk = (x, z, m = 120) => { const V = a.player.pos.constructor; a.autoWalk = new V(x, 0, z); let t = 0; while (t < m && Math.hypot(a.player.pos.x - x, a.player.pos.z - z) > 0.8 && c.sector_index === a.__s) { a.step(1 / 30); t += 1 / 30; } a.autoWalk = null; };
    c.army.waveT = 1e9; // здесь проверяются только правила переходов — без волн врага
    c.advance(Math.max(0, 1800 - c.campaign_seconds + 1));
    a.__s = 0; walk(0, -160, 200); const s1 = c.sector_index, z1 = a.player.pos.z;
    a.__s = 1; walk(0, -160, 200); const s2 = c.sector_index;
    const bunkerOk = c.canBuildHere('military_bunker'), benchNo = c.canBuildHere('weapon_bench');
    a.__s = 1; walk(0, 160, 200); const s3 = c.sector_index;
    return { s1, z1, s2, s3, bunkerOk, benchNo };
  });
  check('после 30:00 пешком на поле боя (№1→№2)', trip.s1 === 1 && trip.z1 > 130, `z ${trip.z1.toFixed(1)}`);
  check('с поля боя на вражескую базу не пускает', trip.s2 === 1);
  check('на поле боя можно строить только бункер', trip.bunkerOk === '' && /только бункер/.test(trip.benchNo));
  check('обратно на свою базу (№2→№1)', trip.s3 === 0);
  await E(() => { const a = window.__fl; a.transitionTo(1, [0, 141]); a.player.pos.z = 120; a.cam.snap(); });
  await shot('13_battlefield_open');
  const perf = await E(async () => { const a = window.__fl; a.transitionTo(0, [0, -141]); a.player.pos.x = -40; a.player.pos.z = 40; a.cam.snap(); await new Promise((r) => setTimeout(r, 3000)); return a.stats; });
  console.log('PERF', JSON.stringify(perf));
  console.log(`ИТОГ: проверок ${results.length}, не прошло ${results.filter((x) => !x).length}, ошибок в консоли ${errors.length}`);
  await b.close();
})();
