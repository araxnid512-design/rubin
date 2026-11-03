// Проверка «без приседаний»: высота таза и сгиб колена у людей во всех режимах движения и действиях,
// а также в настоящей игре (генерал и бойцы). Запуск: node tools/test_crouch.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8765/tools/test_engine.html');
  const res = await p.evaluate(async () => {
    const { HumanRig, B } = await import('/game/rig_human.js');
    const { V3, M3, Xf } = await import('/engine/math.js');
    const r = window.__r || (await import('/engine/renderer.js')).Renderer;
    const c = document.createElement('canvas'); document.body.appendChild(c);
    const R = new (await import('/engine/renderer.js')).Renderer(c);
    const knee = (rig, i) => { const [t, s] = i === 0 ? [B.TH_L, B.SH_L] : [B.TH_R, B.SH_R]; return Math.acos(Math.max(-1, Math.min(1, rig.g[t].y.dot(rig.g[s].y)))) * 180 / Math.PI; };
    const out = [];
    const run = (name, wid, setup, dur, fps = 30, lod = 0) => {
      const rig = new HumanRig(R, {}); rig.setWeapon(wid); rig.lodSkip = lod; let pos = new V3(), yaw = 0;
      const ctl = { rig, t: 0 }; setup(ctl);
      let minHip = 9, maxFlex = 0, maxSwing = 0, maxSlip = 0; const dt = 1 / fps;
      for (let i = 0; i < dur * fps; i++) {
        ctl.t = i * dt; if (ctl.tick) ctl.tick(ctl);
        if (ctl.yawRate) yaw += ctl.yawRate * dt;
        pos = pos.add(rig.velocity.mul(dt));
        rig.update(dt, new Xf(M3.ry(yaw), pos.clone()));
        if (i > fps * 0.5 && rig._lodC === 0) {
          minHip = Math.min(minHip, rig.hipsPos.y);
          for (let k = 0; k < 2; k++) {
            const a = knee(rig, k); if (rig.feet[k].swing) { maxSwing = Math.max(maxSwing, a); continue; }
            maxFlex = Math.max(maxFlex, a);
            maxSlip = Math.max(maxSlip, rig.boneWorld(k === 0 ? B.FOOT_L : B.FOOT_R).dist(rig.feet[k].cur)); // стопа не достаёт до точки опоры
          }
        }
      }
      rig.destroy();
      out.push({ name, wid, minHip: +minHip.toFixed(3), maxKneeFlex: Math.round(maxFlex), maxSwing: Math.round(maxSwing), slip: Math.round(maxSlip * 100) });
    };
    const fwd = (s) => (c) => { c.rig.velocity = new V3(0, 0, -s); };
    for (const wid of ['ak74', 'pm', 'pkm', 'rg6']) {
      run('стоит', wid, () => {}, 3);
      run('шаг 1.7', wid, fwd(1.7), 4);
      run('бег 3.7', wid, fwd(3.7), 4);
      run('спринт 5.0', wid, fwd(5.0), 4);
      run('рывок с места 0→5', wid, (c) => { c.tick = (c) => { c.rig.velocity = new V3(0, 0, -Math.min(5, c.t * 22)); }; }, 3);
      run('резкая остановка', wid, (c) => { c.tick = (c) => { c.rig.velocity = new V3(0, 0, c.t < 2 ? -5 : 0); }; }, 3.5);
      run('прицел вбок 1.3', wid, (c) => { c.rig.aiming = true; c.rig.velocity = new V3(-1.3, 0, 0); }, 4);
      run('прицел назад 1.2', wid, (c) => { c.rig.aiming = true; c.rig.velocity = new V3(0, 0, 1.2); }, 4);
      run('разворот на месте', wid, (c) => { c.yawRate = 6; }, 3);
      run('бег по кругу', wid, (c) => { c.tick = (c) => { const a = c.t * 1.5; c.rig.velocity = new V3(Math.cos(a) * 3.7, 0, Math.sin(a) * 3.7); }; }, 5);
      run('подбор', wid, (c) => { c.tick = (c) => { if (Math.abs(c.t - 1) < 0.02) c.rig.play('pickup', 0.6); }; }, 2.5);
      run('ремонт', wid, (c) => { c.rig.play('repair', 999); }, 4);
      run('лечение другого', wid, (c) => { c.rig.play('heal_other', 999); }, 4);
      run('перезарядка на ходу', wid, (c) => { c.rig.velocity = new V3(0, 0, -1.7); c.tick = (c) => { if (Math.abs(c.t - 1) < 0.02) c.rig.play('reload', 2.3); }; }, 4);
      run('дальний (LOD 3), бег', wid, fwd(3.7), 5, 30, 3);
      run('дальний (LOD 1), спринт', wid, fwd(5), 5, 30, 1);
    }
    run('зомби, шаркает', 'pm', (c) => { c.rig.shamble = 1; c.rig.velocity = new V3(0, 0, -0.7); }, 4);
    return out;
  });
  // приседание: таз ниже 0,87 м или опорное колено согнуто больше 35°; переносимая нога — не больше 75°
  const bad = res.filter((r) => r.minHip < 0.87 || r.maxKneeFlex > 35 || r.maxSwing > 75);
  for (const r of res) console.log((bad.includes(r) ? 'ПРИСЕД ' : 'ок     ') + r.wid.padEnd(5) + ' ' + r.name.padEnd(26) + ' таз мин ' + r.minHip + ' м, опорное колено ' + r.maxKneeFlex + '°, переносимая нога ' + r.maxSwing + '°, недотяг стопы ' + r.slip + ' см');
  console.log('ИТОГ: сценариев', res.length, ', с приседанием', bad.length);
  // ---- настоящая игра: генерал бежит через базу, отряд следует, бой у логова псов
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__app && document.querySelector('#menu-actions button'));
  await p.evaluate(() => window.__app.start(null));
  await p.waitForFunction(() => window.__app.playing, null, { timeout: 120000 });
  const game = await p.evaluate(async () => {
    const { B } = await import('/game/rig_human.js');
    const { HumanRig } = await import('/game/rig_human.js');
    const a = window.__app, w = a.world; a.close();
    for (const so of w.soldiers) so.giveOrder('follow');
    let minHip = 9, maxFlex = 0, n = 0;
    const knee = (rig, i) => { const [t, s] = i === 0 ? [B.TH_L, B.SH_L] : [B.TH_R, B.SH_R]; return Math.acos(Math.max(-1, Math.min(1, rig.g[t].y.dot(rig.g[s].y)))) * 180 / Math.PI; };
    const route = [[0, 40], [0, -10], [-34, -10], [-34, -86], [-60, -100]];
    const dt = 1 / 30;
    for (const [x, z] of route) {
      for (let i = 0; i < 30 * 25; i++) {
        const pl = w.player; pl.autoWalk = new V3(x, 0, z); a.input.touch.sprint = i % 200 < 100;
        w.update(dt); a.cam.follow(pl.pos, pl.vel, dt); a.cam.update(16 / 9); w.updateVisuals(dt, a.cam);
        for (const act of w.actors) {
          const r = act.rig; if (!(r instanceof HumanRig) || !act.alive || !act._onScreen || r._lodC !== 0) continue;
          minHip = Math.min(minHip, r.hipsPos.y); n++;
          for (let k = 0; k < 2; k++) if (!r.feet[k].swing) maxFlex = Math.max(maxFlex, knee(r, k));
        }
        if (Math.hypot(pl.pos.x - x, pl.pos.z - z) < 1) break;
      }
    }
    return { samples: n, minHip: +minHip.toFixed(3), maxStanceKnee: Math.round(maxFlex), player: w.player.pos.toArray() };
  });
  console.log('ИГРА: проверено поз персонажей', game.samples, ', таз мин', game.minHip, 'м, опорное колено макс', game.maxStanceKnee + '°', game.minHip >= 0.87 && game.maxStanceKnee <= 35 ? '— без приседаний' : '— ЕСТЬ ПРИСЕДАНИЕ');
  await b.close();
})();
