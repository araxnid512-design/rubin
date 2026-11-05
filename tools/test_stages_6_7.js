// Автотест «Линии снабжения», этапы 6–7а и техника. Запуск: node tools/test_stages_6_7.js <папка-для-скриншотов>
// Рабочие/механики/солдаты, штаб и приказы, гарнизон бункера, техника (выкатить, вождение, сборщик ×2, бронемашина),
// волны врага и бой на №2, аэроразведка №3, сохранение людей и машин.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => { console.log('PAGEERROR: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')); errors.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) { console.log('console.error: ' + m.text()); errors.push(m.text()); } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const results = [];
  const check = (name, ok, info = '') => { results.push(ok); console.log((ok ? 'ок      ' : 'ОШИБКА  ') + name + (info ? ' — ' + info : '')); };
  const E = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 82 }); };
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__fl && document.querySelector('#menu-actions button'), null, { timeout: 60000 });
  await E(() => localStorage.clear());
  await E(() => window.__fl.start(false));
  await p.waitForFunction(() => window.__fl.playing, null, { timeout: 60000 });
  // помощники в странице: поиск площадки, шаги симуляции
  await E(() => {
    const a = window.__fl;
    window.__place = (id, x0, z0, ang = 0) => {
      const c = a.c; c.scrap = 999;
      for (let r = 0; r < 60; r += 2) for (let k = 0; k < 16; k++) {
        const x = Math.round(x0 + Math.cos(k / 16 * 6.283) * r), z = Math.round(z0 + Math.sin(k / 16 * 6.283) * r);
        if (a.sector.validate(id, x, z, ang)) continue;
        const res = c.build(id, x, z, ang, true); if (res.ok) { a.sector.addBuilding(res.rec); return res.rec; }
      }
      return null;
    };
    window.__run = (sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) a.step(dt); };
    window.__V = a.player.pos.constructor;
  });
  // ===================== этап 6: найм и работа
  const S6 = await E(() => {
    const a = window.__fl, c = a.c, r = {};
    r.bar = window.__place('military_barracks', -60, 60); r.hq = window.__place('military_headquarters', -95, 25); r.bunker = window.__place('military_bunker', -30, 95, 0);
    r.wb = window.__place('weapon_bench', -20, 40); r.ab = window.__place('ammo_bench', -5, 55); r.gar = window.__place('vehicle_light_garage', 30, 60);
    r.ok = [r.bar, r.hq, r.bunker, r.wb, r.ab, r.gar].every(Boolean);
    c.scrap = 999;
    for (const role of ['npc_scrap_worker', 'npc_scrap_worker', 'npc_mechanic', 'npc_infantry', 'npc_infantry']) c.hire(r.bar.uid, role);
    c.advance(200);
    r.n = c.recruits.length; r.roles = c.recruits.map((u) => u.role);
    r.atDoor = c.recruits.every((u) => c.distToFootprint(r.bar, u.x, u.z) < 8);
    return { ok: r.ok, n: r.n, roles: r.roles, atDoor: r.atDoor, bunker: r.bunker && r.bunker.uid, bar: r.bar && r.bar.uid };
  });
  check('штаб, казарма, бункер, верстаки, гараж построены', S6.ok);
  check('найм: 2 рабочих, механик, 2 солдата появились у входа казармы', S6.n === 5 && S6.atDoor, S6.roles.join(','));
  const mine = await E(() => {
    const a = window.__fl, c = a.c, A = a.army, ws = c.recruits.filter((u) => u.role === 'npc_scrap_worker');
    for (const w of ws) A.setOrder(w.uid, 'mine_scrap');
    const dur0 = c.nodes.reduce((s, n) => s + n.d, 0), scrap0 = c.scrap, mined0 = c.totals.npcMined;
    let maxCarry = 0, insideB = 0, samples = 0;
    for (let t = 0; t < 260; t += 0.1) {
      a.step(0.1);
      for (const w of ws) { maxCarry = Math.max(maxCarry, w.carry); for (const [, e] of a.sector.buildings) for (const col of e.cols) { const [qx, qz] = col.closest(w.x, w.z); if (Math.hypot(qx - w.x, qz - w.z) < 0.02) insideB++; } samples++; }
    }
    a.player.pos.x = ws[0].x + 4; a.player.pos.z = ws[0].z + 6; a.cam.snap();
    const minedNow = c.totals.npcMined - mined0, carry = ws.reduce((s, w) => s + w.carry, 0);
    return { minedNow, delivered: c.totals.npcDelivered, carry, maxCarry, scrapGain: c.scrap - scrap0, insideB, samples, notes: ws.map((w) => w.note), respawned: c.nodes.some((n) => n.respawnAt > 0) };
  });
  check('рабочие добывают те же кучи: добыто = сдано + в руках', mine.minedNow > 0 && mine.minedNow === mine.delivered + mine.carry, `добыто ${mine.minedNow}, сдано ${mine.delivered}, в руках ${mine.carry}`);
  check('рабочий носит не больше 60', mine.maxCarry <= 60 && mine.maxCarry >= 40, `максимум ${mine.maxCarry}`);
  check('металл на складе вырос ровно на сданное', mine.scrapGain === mine.delivered, `+${mine.scrapGain}`);
  check('рабочие не проходят сквозь здания (путь по навигационной сетке)', mine.insideB === 0, `${mine.insideB} из ${mine.samples} проб внутри зданий`);
  await shot('14_workers_mining');
  const rep = await E((buid) => {
    const a = window.__fl, c = a.c, A = a.army, m = c.recruits.find((u) => u.role === 'npc_mechanic'), b = c.buildings.find((x) => x.uid === buid);
    b.hp = 40; c.scrap = Math.max(c.scrap, 100); A.setOrder(m.uid, 'repair', { uid: b.uid });
    let arrive = 0; for (let t = 0; t < 90 && m.st !== 'work'; t += 0.1) { a.step(0.1); arrive = t; }
    const s0 = c.scrap - 0, hp0 = b.hp, spent0 = c.totals.repairSpent;
    window.__run(25.05);
    return { hp0, hp: b.hp, spent: c.totals.repairSpent - spent0, arrive: arrive.toFixed(1), note: m.note };
  }, S6.bunker);
  check('механик чинит: +10 HP за 5 с, 2 металла за действие', rep.hp - rep.hp0 === 50 && rep.spent === 10, `HP ${rep.hp0} → ${rep.hp}, металла ${rep.spent}, дошёл за ${rep.arrive} с`);
  const eq = await E(() => {
    const a = window.__fl, c = a.c, ss = c.recruits.filter((u) => u.role === 'npc_infantry');
    const before = ss.map((u) => u.weapon);
    const wb = c.buildings.find((x) => x.id === 'weapon_bench'), ab = c.buildings.find((x) => x.id === 'ammo_bench');
    c.scrap = 999; c.produce(wb.uid, 'wp_rifle_v7'); c.produce(ab.uid, 'ammo_762x54'); c.produce(ab.uid, 'ammo_762x54');
    window.__run(20);
    return { before, after: ss.map((u) => [u.weapon, u.mag, u.ammo]), st: { r: c.storage.wp_rifle_v7 || 0, a: c.storage.ammo_762x54 || 0 } };
  });
  check('солдат без изготовленного оружия — безоружен', eq.before.every((w) => !w));
  check('солдат берёт только изготовленное: 1 винтовка на двоих', eq.after.filter((x) => x[0]).length === 1 && eq.st.r === 0, JSON.stringify(eq.after) + ' склад ' + JSON.stringify(eq.st));
  // ===================== этап 7: штаб, приказы, бункер
  const hq = await E(() => {
    const a = window.__fl, c = a.c, e = [...a.sector.buildings.values()].find((x) => x.rec.id === 'military_headquarters');
    const door = c.fromLocal(e.rec, 0, e.fd / 2 + 3); a.player.pos.x = door[0]; a.player.pos.z = door[1]; a.step(0.05);
    const outside = a.ui.context();
    const [tx, tz] = c.fromLocal(e.rec, 0, 1.4); a.autoWalk = new window.__V(tx, 0, tz);
    for (let t = 0; t < 20 && Math.hypot(a.player.pos.x - tx, a.player.pos.z - tz) > 0.7; t += 1 / 30) a.step(1 / 30);
    a.autoWalk = null; a.step(0.05);
    const ctx = a.ui.context();
    return { outside: outside && outside.label, label: ctx && ctx.label, roof: e.roof && e.roof.visible };
  });
  check('штаб: снаружи — «ИСПОЛЬЗОВАТЬ», у стола внутри — «УПРАВЛЕНИЕ», крыша скрыта', hq.outside === 'ИСПОЛЬЗОВАТЬ' && hq.label === 'УПРАВЛЕНИЕ' && hq.roof === false, JSON.stringify(hq));
  await E(() => { const a = window.__fl; a.ui.doAction(); const u = a.c.recruits.filter((x) => x.role === 'npc_infantry'); for (const x of u) a.ui.cmdSel.add(x.uid); a.ui.close(); a.ui.open('command'); });
  await shot('15_hq_command');
  const orders = await E((buid) => {
    const a = window.__fl, c = a.c, A = a.army, ss = c.recruits.filter((u) => u.role === 'npc_infantry'), w = c.recruits.find((u) => u.role === 'npc_scrap_worker');
    a.ui.close();
    const r = {};
    r.bfBefore = A.setOrder(ss[0].uid, 'move', { sector: 'battlefield', x: 0, z: 100 });
    r.enemy = A.setOrder(ss[0].uid, 'move', { sector: 'enemy_home', x: 0, z: 0 });
    r.workerAttack = A.setOrder(w.uid, 'attack_target');
    r.g = ss.map((u) => A.setOrder(u.uid, 'garrison_bunker', { uid: buid }).ok);
    window.__run(60);
    const b = c.buildings.find((x) => x.uid === buid);
    r.inside = ss.map((u) => [c.insideFootprint(b, u.x, u.z, 0.6), u.inBunker === buid, u.note]);
    r.saved = JSON.parse(JSON.stringify(c.serialize().recruits)).filter((u) => u.order === 'garrison_bunker').length;
    const e = a.sector.buildings.get(buid), [ix, iz] = c.fromLocal(b, 0, 1.5); a.player.pos.x = ix; a.player.pos.z = iz; a.step(0.05); a.cam.snap();
    r.roof = e.roof.visible;
    return r;
  }, S6.bunker);
  check('до 30:00 приказ на поле боя отклонён', !orders.bfBefore.ok, orders.bfBefore.reason);
  check('приказ на вражескую базу — «НЕТ ДОСТУПА: ЧУЖАЯ БАЗА»', !orders.enemy.ok && /ЧУЖАЯ БАЗА/.test(orders.enemy.reason));
  check('рабочему нельзя приказ «Атаковать»', !orders.workerAttack.ok);
  check('солдаты заняли бункер (внутри, укрытие), приказ сохраняется', orders.g.every(Boolean) && orders.inside.every((x) => x[0] && x[1]) && orders.saved === 2, JSON.stringify(orders.inside));
  await shot('16_garrison_bunker');
  // ===================== техника
  const veh = await E(() => {
    const a = window.__fl, c = a.c, gar = c.buildings.find((x) => x.id === 'vehicle_light_garage');
    c.scrap = 999; c.produce(gar.uid, 'veh_utility_car'); window.__run(33);
    const r = { st: c.storage.veh_utility_car };
    const ro = c.rollOut(gar.uid, 'veh_utility_car'); r.ro = ro.ok; const v = ro.veh;
    a.player.pos.x = v.x + 2.5; a.player.pos.z = v.z; a.step(0.05);
    const ctx = a.ui.context(); r.ctx = ctx && ctx.label;
    a.ui.doAction(); r.driving = c.driving === v.uid;
    const x0 = v.x, z0 = v.z; a.input.touch.move = [-Math.sin(v.yaw), -Math.cos(v.yaw)];
    for (let t = 0; t < 6; t += 1 / 30) a.step(1 / 30);
    a.input.touch.move = [0, 0]; for (let t = 0; t < 2; t += 1 / 30) a.step(1 / 30);
    r.moved = Math.hypot(v.x - x0, v.z - z0); a.cam.snap();
    return r;
  });
  check('гараж: машина на складе, «ВЫКАТИТЬ», у машины — «СЕСТЬ»', veh.st === 1 && veh.ro && veh.ctx === 'СЕСТЬ', JSON.stringify(veh));
  check('вождение: машина едет от джойстика', veh.driving && veh.moved > 15, `проехала ${veh.moved.toFixed(1)} м`);
  await shot('17_vehicle_drive');
  const exitV = await E(() => { const a = window.__fl; const ok = a.exitVehicle(); return { ok, driving: a.c.driving, hidden: a.player.hidden }; });
  check('выход из машины: игрок снова пешком', exitV.ok && !exitV.driving && !exitV.hidden);
  const harv = await E(() => {
    const a = window.__fl, c = a.c, gar = c.buildings.find((x) => x.id === 'vehicle_light_garage');
    c.storage.veh_scrap_harvester = 1; const v = c.rollOut(gar.uid, 'veh_scrap_harvester').veh;
    c.nodes.forEach((n) => { n.d = 6; n.respawnAt = 0; }); a.sector.refreshPiles();
    const [nx, nz] = c.nodeXZ(0, 5); v.x = nx - 5; v.z = nz; v.yaw = -Math.PI / 2;
    a.player.pos.x = v.x + 3; a.player.pos.z = v.z; a.step(0.05); a.enterVehicle(v); a.step(0.05);
    const s0 = c.scrap = 100, d0 = c.nodes[5].d; c.lastHarvestAt = -10; const r1 = a.harvest(); a.step(0.9); const r2 = a.harvest();
    a.cam.snap();
    return { r1: r1.gained, r2: r2.gained, scrap: c.scrap - s0, dur: d0 - c.nodes[5].d, ctx: a.ui.context() && a.ui.context().label };
  });
  check('сборщик металлолома: 20 металла за 2 прочности (×2 к молотку)', harv.r1 === 20 && harv.scrap === 40 && harv.dur === 4, JSON.stringify(harv));
  await shot('20_harvester');
  await E(() => window.__fl.exitVehicle());
  // ===================== этап 7а: волны врага и бой на №2
  const wave = await E(() => {
    const a = window.__fl, c = a.c, A = a.army;
    c.army.waveT = 1e9; c.advance(Math.max(0, 1800 - c.campaign_seconds) + 0.5);
    const M0 = JSON.parse(JSON.stringify(c.enemy.manufactured));
    c.army.waveT = 0; A._waves(0); // ровно один шаг формирования волны, без тика производства врага
    const foes = c.foes.map((f) => ({ w: f.weapon, a: f.ammoId, n: f.mag + f.ammo, z: f.z }));
    const M1 = JSON.parse(JSON.stringify(c.enemy.manufactured));
    const issuedA = {}; for (const f of foes) issuedA[f.a] = (issuedA[f.a] || 0) + f.n;
    var ammoOk = Object.entries(issuedA).every(([k, n]) => (M0[k] || 0) - (M1[k] || 0) === n);
    // сохранение ресурсов врага: всё выданное солдатам списано со склада врага
    const issuedW = {}; for (const f of foes) issuedW[f.w] = (issuedW[f.w] || 0) + 1;
    window.__run(20, 0.25);
    return { n: foes.length, foes, issuedW, ammoOk, M0, M1, deployed: c.army.deployed.length, inf: c.enemy.recruits.filter((r) => r.role_id === 'npc_infantry').length };
  });
  const wOk = Object.entries(wave.issuedW).every(([k, n]) => (wave.M0[k] || 0) - (wave.M1[k] || 0) === n) && wave.ammoOk;
  check('после 30:00 враг выводит на №2 волну из реально нанятых солдат', wave.n >= 2 && wave.n <= Math.min(6, wave.inf) && wave.foes.every((f) => f.z < -100), `на поле ${wave.n} из ${wave.inf}, у северного края`);
  check('оружие и патроны волны списаны со склада врага (без удвоения)', wOk && wave.foes.every((f) => f.n > 0), JSON.stringify(wave.issuedW));
  const battle = await E(() => {
    const a = window.__fl, c = a.c, A = a.army, ss = c.recruits.filter((u) => u.role === 'npc_infantry');
    // вооружаем второго солдата и даём технику
    c.storage.wp_assault_a47 = 2; c.storage.ammo_762x39 = 240; c.storage.wp_lmg_r7 = 1; c.storage.ammo_762x54_belt = 300; c.storage.wp_hand_grenade = 4;
    for (const u of ss) A.setOrder(u.uid, 'hold_position');
    const bar = c.buildings.find((x) => x.id === 'military_barracks'); for (const u of ss) { const [x, z] = c.doorPoint(bar, 3); u.x = x; u.z = z; u.sector = 'friendly_home'; }
    window.__run(4);
    const kits = ss.map((u) => u.weapon);
    for (const u of ss) A.setOrder(u.uid, 'attack_target');
    const shots0 = { f: c.foes.reduce((s, f) => s + f.mag + f.ammo, 0) };
    // игрок с автоматом идёт следом
    const take = c.takeWeapon('wp_assault_a47'); if (take.ok) { c.select(take.slot); a.ui.refreshTool(); }
    let sawField = false;
    for (let t = 0; t < 220; t += 0.25) { a.step(0.25); if (ss.some((u) => u.sector === 'battlefield')) sawField = true; }
    a.transitionTo(1, [0, 120]);
    const foesAlive = c.foes.length, sm = A.summary();
    const ammoNow = c.foes.reduce((s, f) => s + f.mag + f.ammo, 0);
    return { kits, take: take.ok, sawField, sm, foesAlive, ammoUsed: shots0.f - ammoNow, ss: ss.map((u) => [u.sector, Math.round(u.hp), u.mag + u.ammo, u.note]), repl: c.enemy.replacements_needed, enemyInf: c.enemy.recruits.filter((r) => r.role_id === 'npc_infantry').length };
  });
  check('наши солдаты по приказу «Атаковать» ушли на поле боя (№1→№2)', battle.sawField, JSON.stringify(battle.ss));
  check('бой: обе стороны стреляют (патроны тратятся), есть попадания и потери', battle.sm.shots.friendly > 0 && battle.sm.shots.enemy > 0 && battle.sm.hits.enemy + battle.sm.hits.friendly > 0 && (battle.sm.losses.friendly + battle.sm.losses.enemy) > 0, `выстрелов наши/враг ${battle.sm.shots.friendly}/${battle.sm.shots.enemy}, попаданий ${battle.sm.hits.friendly}/${battle.sm.hits.enemy}, потери ${battle.sm.losses.friendly}/${battle.sm.losses.enemy}`);
  const fate = await E(() => {
    const a = window.__fl, c = a.c, A = a.army, E2 = c.enemy;
    if (c.foes.length < 2) { c.army.waveT = 0; A._waves(0); }
    const f1 = c.foes[0], f2 = c.foes[1]; if (!f1 || !f2) return { none: true };
    const r = { rid1: f1.rid, rid2: f2.rid, repl0: E2.replacements_needed || 0 };
    A.damage(f1, 999, { side: 'friendly' }); a.step(0.05);
    r.dead = !E2.recruits.some((x) => x.id === r.rid1) && !c.foes.includes(f1) && (E2.replacements_needed || 0) === r.repl0 + 1 && !c.army.deployed.includes(r.rid1);
    const w = f2.weapon, am = f2.ammoId, wN0 = E2.manufactured[w] || 0, aN0 = E2.manufactured[am] || 0, carried = f2.mag + f2.ammo;
    f2.hp = 20; f2.retreat = true; f2.x = 0; f2.z = -140; f2._tg = null;
    for (let t = 0; t < 20 && c.foes.includes(f2); t += 0.1) { A._foe(f2, 0.1); }
    r.home = !c.foes.includes(f2) && E2.recruits.some((x) => x.id === r.rid2) && (E2.manufactured[w] || 0) === wN0 + 1 && (E2.manufactured[am] || 0) === aN0 + carried;
    return r;
  });
  check('погибший враг убран из найма врага и будет нанят заново', fate.none || fate.dead, JSON.stringify(fate));
  check('раненый враг отступает домой и возвращает оружие и патроны', fate.none || fate.home);
  // кадр боя (постановка): наш отряд с игроком против волны врага на №2 — в реальном времени, с трассерами
  await E(() => {
    const a = window.__fl, c = a.c, A = a.army, bar = c.buildings.find((x) => x.id === 'military_barracks');
    c.scrap = 999; for (let i = 0; i < 4; i++) c.hire(bar.uid, 'npc_infantry'); c.advance(170);
    c.storage.wp_assault_a47 = (c.storage.wp_assault_a47 || 0) + 4; c.storage.ammo_762x39 = (c.storage.ammo_762x39 || 0) + 400; c.storage.wp_hand_grenade = 6;
    const ss = c.recruits.filter((u) => u.role === 'npc_infantry'); for (const u of ss) { u.sector = 'friendly_home'; A.equip(u); }
    const fz = c.foes.length ? c.foes[0].z : -40, fx = c.foes.length ? c.foes[0].x : 0;
    ss.forEach((u, i) => { u.sector = 'battlefield'; u.x = fx - 8 + i * 4; u.z = fz + 26 + (i % 2) * 2; A.setOrder(u.uid, 'defend', { sector: 'battlefield', x: u.x, z: u.z }); u._path = null; });
    if (c.sector_index !== 1) a.transitionTo(1, [fx, 141]);
    a.player.pos.x = fx + 2; a.player.pos.z = fz + 30; c.playerHp = 100; a.cam.snap();
  });
  await p.waitForTimeout(3500);
  await shot('18_battle');
  const pf = await E(() => {
    const a = window.__fl, c = a.c, slot = a.playerSlot(); if (!slot) return { none: true };
    const f = c.foes[0]; if (!f) return { nofoe: true };
    a.player.pos.x = f.x; a.player.pos.z = f.z + 12; const m0 = slot.mag + slot.ammo, s0 = a.pShots || 0;
    a.input.touch.fire = true; for (let t = 0; t < 1.5; t += 1 / 30) a.step(1 / 30); a.input.touch.fire = false;
    return { used: m0 - (slot.mag + slot.ammo), shots: (a.pShots || 0) - s0 };
  });
  check('игрок стреляет из взятого со склада автомата: патрон за выстрел', !pf.none && (pf.nofoe || (pf.used > 0 && pf.used === pf.shots)), JSON.stringify(pf));
  // ===================== аэроразведка №3
  const rec = await E(() => {
    const a = window.__fl, c = a.c; a.transitionTo(0, [0, -141]);
    const sec0 = c.sector_index, ok = a.enterRecon();
    const r = { ok, idx: a.sector.index, csec: c.sector_index, sec0, structs: c.enemy.structures.length, shown: [...a.sector.buildings.values()].filter((e) => e.rec.enemy).length, units: a.reconUnits.length };
    window.__run(3, 0.1);
    const bar = (a.sector.enemyLots || []).find((s) => s.id === 'military_barracks'); if (bar) { a.player.pos.x = bar.x + 10; a.player.pos.z = bar.z + 18; }
    a.cam.snap();
    return r;
  });
  check('аэроразведка: №3 показан по сохранённому состоянию ИИ, игрок остаётся на своём секторе', rec.ok && rec.idx === 2 && rec.csec === rec.sec0 && rec.shown === rec.structs && rec.units >= 2, JSON.stringify(rec));
  await p.waitForTimeout(1500);
  await shot('19_recon_enemy_base');
  const back = await E(() => { const a = window.__fl; a.exitRecon(); return { idx: a.sector.index, csec: a.c.sector_index, recon: !!a.recon }; });
  check('выход из разведки — обратно в штаб', back.idx === back.csec && !back.recon);
  // ===================== сохранение людей и машин
  const sv = await E(() => { const a = window.__fl; a.save(); const d = a.c.serialize(); return { r: d.recruits.length, v: d.vehicles.length, f: d.foes.length, hp: d.player_hp }; });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__fl && document.querySelector('#menu-actions button'), null, { timeout: 60000 });
  await E(() => window.__fl.start(true));
  await p.waitForFunction(() => window.__fl.playing, null, { timeout: 60000 });
  const lv = await E(() => { const c = window.__fl.c; return { r: c.recruits.length, v: c.vehicles.length, f: c.foes.length, orders: c.recruits.map((u) => u.order) }; });
  check('после перезагрузки люди, приказы, машины и враги на поле сохранены', lv.r === sv.r && lv.v === sv.v && lv.f === sv.f, JSON.stringify(lv));
  const perf = await E(async () => { const a = window.__fl; await new Promise((r) => setTimeout(r, 3000)); return a.stats; });
  console.log('PERF', JSON.stringify(perf));
  console.log(`ИТОГ: проверок ${results.length}, не прошло ${results.filter((x) => !x).length}, ошибок в консоли ${errors.length}`);
  await b.close();
})();
