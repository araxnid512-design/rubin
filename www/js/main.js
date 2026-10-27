// Главный цикл и экраны. Этап 1: тест-заезд на пробной трассе.
(function () {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const canvas = $('view');

  let scene = null;
  let acc = 0;
  let last = performance.now();
  let width = 0, height = 0;

  function newRun() {
    const world = window.Physics.createWorld();
    const terrain = new window.Terrain(world, C.TEST_TRACK, 0);
    const def = C.CARS.sedan;
    const stats = window.Physics.carStats(def);
    const car = new window.Physics.Car(world, def, stats, 6, terrain.heightAt(6) + 1.2);
    scene = { world, terrain, car, time: 0, maxX: 0 };
    window.Render.snapCamera(car);
    acc = 0;
  }

  function step(dt) {
    const P = C.PHYSICS;
    scene.car.control(window.Input, dt);
    scene.world.step(dt, P.velocityIterations, P.positionIterations);
    scene.time += dt;
    scene.maxX = Math.max(scene.maxX, scene.car.pos.x);
  }

  function hud() {
    const car = scene.car;
    $('h-speed').textContent = Math.round(Math.abs(car.speed) * 3.6);
    $('h-dist').textContent = Math.max(0, Math.round(car.pos.x - 6));
    $('h-nitro').style.width = (car.nitro / car.stats.nitroCapacity * 100) + '%';
    $('h-flip').classList.toggle('hidden', car.flipTimer < 0.5);
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
      if (car.flipped) newRun();
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
  $('btn-restart').addEventListener('click', () => { window.Platform.resume(); newRun(); });
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
