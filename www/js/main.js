// Главный цикл и экраны. Этап 3: заезд по уровню 1 с препятствиями и заражёнными.
(function () {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const canvas = $('view');

  let scene = null;
  let acc = 0;
  let last = performance.now();
  let width = 0, height = 0;

  // startCp — номер чекпоинта, с которого начинаем (0 — от стаба).
  function newRun(levelIndex, startCp) {
    const level = C.LEVELS[levelIndex || 0];
    const world = window.Physics.createWorld();
    const terrain = new window.Terrain(world, level);
    const obstacles = window.Obstacles.place(world, terrain);
    const def = C.CARS.sedan;
    const stats = window.Physics.carStats(def);
    const cp = startCp || 0;
    const x0 = cp ? terrain.checkpoints[cp - 1] : 6;
    const car = new window.Physics.Car(world, def, stats, x0, terrain.heightAt(x0) + 1.2);
    scene = {
      world, terrain, obstacles, car, level, levelIndex: levelIndex || 0, time: 0, maxX: x0, startX: x0,
      checkpoint: cp, finished: false, particles: [], loot: { sporan: 0, peas: 0, pearl: 0 }, kills: 0,
    };
    scene.pickups = new window.Pickups(terrain, {
      onCollect(kind, n) { scene.loot[kind] += n; window.Sound.pickup(); },
    });
    scene.horde = new window.Horde(world, terrain, level, {
      onKill(z, p) {
        scene.kills++;
        const d = z.def.drops;
        if (Math.random() < d.sporanChance) {
          const n = d.sporans[0] + Math.floor(Math.random() * (d.sporans[1] - d.sporans[0] + 1));
          if (n) scene.pickups.drop('sporan', n, p.x, p.y);
        }
        if (Math.random() < d.peas) scene.pickups.drop('peas', 1, p.x, p.y);
        if (Math.random() < d.pearl) scene.pickups.drop('pearl', 1, p.x, p.y);
        window.Render.blood(scene, p.x, p.y, 14, scene.car.speed);
        window.Sound.crunch(Math.min(1, z.def.mass / 200 + 0.4));
      },
      onCarHit(dmg) {
        scene.car.hp = Math.max(0, scene.car.hp - dmg);
        scene.hurt = 0.25;
      },
    });
    world.on('begin-contact', (c) => scene.horde.contact(c));
    window.Render.setTheme(level.theme);
    window.Render.snapCamera(car);
    buildProgress();
    acc = 0;
  }

  function step(dt) {
    const P = C.PHYSICS;
    scene.car.control(window.Input, dt);
    scene.world.step(dt, P.velocityIterations, P.positionIterations);
    scene.horde.afterStep(scene.car, dt);
    scene.pickups.update(scene.car, dt);
    window.Render.particles(scene, dt);
    scene.time += dt;
    scene.hurt = Math.max(0, (scene.hurt || 0) - dt);
    const x = scene.car.pos.x;
    scene.maxX = Math.max(scene.maxX, x);
    const cps = scene.terrain.checkpoints;
    while (scene.checkpoint < cps.length && x >= cps[scene.checkpoint]) {
      scene.checkpoint++;
      toast(`Чекпоинт ${scene.checkpoint} из ${cps.length}`);
    }
    if (!scene.finished && scene.terrain.stab && x >= scene.terrain.stab.x) {
      scene.finished = true;
      toast(`Доехали: ${scene.terrain.stab.name}!`);
    }
  }

  // Полоса прогресса уровня с отметками чекпоинтов.
  function buildProgress() {
    const bar = $('progress');
    bar.querySelectorAll('.cp').forEach((e) => e.remove());
    const total = scene.terrain.stab.x;
    for (const x of scene.terrain.checkpoints) {
      const m = document.createElement('span');
      m.className = 'cp';
      m.style.left = (x / total * 100) + '%';
      bar.appendChild(m);
    }
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function hud() {
    const car = scene.car;
    const total = scene.terrain.stab.x;
    $('h-speed').textContent = Math.round(Math.abs(car.speed) * 3.6);
    $('h-dist').textContent = Math.max(0, Math.round(total - car.pos.x));
    $('h-nitro').style.width = (car.nitro / car.stats.nitroCapacity * 100) + '%';
    $('h-flip').classList.toggle('hidden', car.flipTimer < 0.5);
    $('h-hp').style.width = (car.hp / car.stats.hp * 100) + '%';
    $('h-sporan').textContent = scene.loot.sporan;
    $('h-peas').textContent = scene.loot.peas;
    $('h-pearl').textContent = scene.loot.pearl;
    $('h-kills').textContent = scene.kills;
    $('hurt').style.opacity = scene.hurt > 0 ? Math.min(0.5, scene.hurt * 2) : 0;
    $('p-car').style.left = Math.max(0, Math.min(100, car.pos.x / total * 100)) + '%';
    $('p-best').style.width = Math.max(0, Math.min(100, scene.maxX / total * 100)) + '%';
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const menuOpen = !$('menu').classList.contains('hidden');
    if (scene && !window.Platform.paused && !menuOpen) {
      const P = C.PHYSICS;
      acc += dt;
      let n = 0;
      while (acc >= P.step && n < P.maxSubSteps) { step(P.step); acc -= P.step; n++; }
      if (n === P.maxSubSteps) acc = 0;
      window.Render.updateCamera(scene.car, dt);
      const car = scene.car;
      window.Sound.engine(Math.min(1, Math.abs(car.rear.body.getAngularVelocity()) * car.def.wheels.radius / car.stats.maxSpeed), Math.abs(car.throttle));
      if (car.flipped || car.hp <= 0) newRun(scene.levelIndex, scene.checkpoint);
    }
    if (scene) {
      window.Render.draw(scene, now / 1000);
      hud();
    }
    requestAnimationFrame(frame);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    window.Render.resize(width, height, dpr);
  }

  $('m-start').addEventListener('click', () => { $('menu').classList.add('hidden'); newRun(); });
  $('btn-restart').addEventListener('click', () => { window.Platform.resume(); newRun(scene.levelIndex, 0); });
  window.Platform.on('pause', () => window.Sound.engineOff());
  window.Platform.on('resume', () => { last = performance.now(); });
  window.Platform.onBack = () => !$('menu').classList.contains('hidden');
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') window.Platform.paused ? window.Platform.resume() : window.Platform.pause();
  });

  window.Game = { get scene() { return scene; }, newRun, step };

  window.Render.init(canvas);
  window.addEventListener('resize', resize);
  resize();
  newRun();
  requestAnimationFrame(frame);
})();
