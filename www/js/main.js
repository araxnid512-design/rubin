// Экраны и главный цикл: заставка → стаб → заезд → итоги → стаб.
(function () {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const canvas = $('view');

  let save = window.Save.load();
  let run = null;
  let screen = 'menu';
  let acc = 0;
  let last = performance.now();
  let width = 0, height = 0;
  let endTimer = 0;

  // --- Заезд ---
  function startRun(levelIndex, startCp, background) {
    const carId = save.car;
    const stats = window.Shop.stats(save, carId);
    const ls = window.Save.levelState(save, C.LEVELS[levelIndex].id);
    run = new window.Run({
      levelIndex, startCp, carId, stats, best: ls.best,
      ups: window.Shop.carSave(save, carId).upgrades,
      fuel: background ? null : window.Shop.fuelOf(save, carId),
      hp: background ? null : window.Shop.hpOf(save, carId),
      weapons: window.Shop.carSave(save, carId).weapons,
    });
    buildWeaponBars();
    window.Render.setTheme(run.level.theme);
    window.Render.snapCamera(run.car);
    buildProgress();
    endTimer = 0;
    acc = 0;
    window.Input.reset();
    if (background) return;
    screen = 'run';
    show('menu', false);
    show('results', false);
    setHud(true);
    show('btn-nitro', stats.hasNitro);
    show('h-nitro-bar', stats.hasNitro);
    show('scanner', stats.scanner > 0);
    show('boss', false);
  }

  function setHud(on) {
    for (const id of ['hud', 'loot', 'progress', 'btn-brake', 'btn-gas', 'btn-nitro']) show(id, on);
    if (!on) { show('scanner', false); show('boss', false); }
  }

  function step(dt) {
    run.step(dt, window.Input);
    for (const m of run.messages.splice(0)) toast(m);
  }

  // Полоса прогресса уровня с отметками чекпоинтов.
  function buildProgress() {
    const bar = $('progress');
    bar.querySelectorAll('.cp').forEach((e) => e.remove());
    const total = run.terrain.stab.x;
    for (const x of run.terrain.checkpoints) {
      const m = document.createElement('span');
      m.className = 'cp';
      m.style.left = (x / total * 100) + '%';
      bar.appendChild(m);
    }
  }

  // Полоски прочности оружия в HUD — по одной на установленное оружие.
  function buildWeaponBars() {
    const box = $('h-weapons');
    box.innerHTML = '';
    for (const id of Object.keys(run.weapons.dur)) {
      box.insertAdjacentHTML('beforeend', `<div class="hud-bar weapon"><i id="hw-${id}"></i><span>${C.WEAPONS[id].name.toLowerCase()}</span></div>`);
    }
  }

  // Сканер: впереди на N метров — мутанты с горохом (жёлтые) и жемчугом (белые).
  function drawScanner() {
    const cv = $('scanner'), ctx = cv.getContext('2d');
    const range = run.car.stats.scanner, x0 = run.car.pos.x;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(0,30,10,0.55)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = 'rgba(143,208,106,0.5)';
    ctx.strokeRect(1, 1, cv.width - 2, cv.height - 2);
    const mark = (x, loot, boss) => {
      const k = (x - x0) / range;
      if (k < 0 || k > 1) return;
      ctx.fillStyle = boss ? '#ff5a40' : loot.pearl ? '#f4f0ff' : '#e0c050';
      ctx.beginPath(); ctx.arc(8 + k * (cv.width - 16), cv.height / 2, boss ? 9 : loot.pearl ? 7 : 5, 0, Math.PI * 2); ctx.fill();
    };
    const h = run.horde;
    for (let i = h.next; i < h.spawns.length; i++) {
      const s = h.spawns[i];
      if (s.x > x0 + range) break;
      if (s.loot && (s.loot.peas || s.loot.pearl) || s.boss) mark(s.x, s.loot || {}, s.boss);
    }
    for (const z of h.active) if (z.alive && (z.loot.peas || z.loot.pearl || z.boss)) mark(z.body.getPosition().x, z.loot, z.boss);
    ctx.fillStyle = '#d0a640';
    ctx.fillRect(4, 6, 4, cv.height - 12);
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function hud() {
    const car = run.car;
    const total = run.terrain.stab.x;
    $('h-speed').textContent = Math.round(Math.abs(car.speed) * 3.6);
    $('h-dist').textContent = Math.max(0, Math.round(total - car.pos.x));
    $('h-nitro').style.width = (car.nitro / car.stats.nitroCapacity * 100) + '%';
    $('h-fuel').style.width = (car.fuel / car.stats.tank * 100) + '%';
    $('h-fuel-v').textContent = car.fuel.toFixed(1) + ' л';
    $('h-fuel-bar').classList.toggle('low', car.fuel < car.stats.tank * 0.2);
    $('h-hp').style.width = (car.hp / car.stats.hp * 100) + '%';
    $('h-flip').classList.toggle('hidden', car.flipTimer < 0.5 || !!run.ended);
    $('p-car').style.left = Math.max(0, Math.min(100, car.pos.x / total * 100)) + '%';
    $('p-best').style.width = Math.max(0, Math.min(100, Math.max(run.maxX, run.prevBest) / total * 100)) + '%';
    $('h-sporan').textContent = run.loot.sporan;
    $('h-peas').textContent = run.loot.peas;
    $('h-pearl').textContent = run.loot.pearl;
    $('h-kills').textContent = run.kills;
    for (const [id, d] of Object.entries(run.weapons.dur)) {
      const el = $('hw-' + id);
      if (el) { el.style.width = d + '%'; el.parentNode.classList.toggle('broken', d <= 0); }
    }
    $('hurt').style.opacity = run.hurt > 0 ? Math.min(0.5, run.hurt * 2) : 0;
    if (car.stats.scanner) drawScanner();
    // Полоса здоровья босса, когда он рядом.
    const boss = run.horde.active.find((z) => z.boss && z.alive && Math.abs(z.body.getPosition().x - car.pos.x) < 60);
    show('boss', !!boss);
    if (boss) $('boss-hp').style.width = Math.max(0, boss.hp / boss.def.hp * 100) + '%';
  }

  // --- Итоги ---
  const REASONS = {
    stab: 'Доехали до стаба!',
    fuel: 'Кончился бензин',
    flip: 'Машина перевернулась',
    wreck: 'Машина разбита',
    quit: 'Заезд прерван',
  };

  function finishRun() {
    const r = run.results();
    window.RunResults.apply(save, r, run.levelIndex);
    const cs = window.Shop.carSave(save, save.car);
    cs.fuel = r.fuelLeft;
    cs.hp = r.hpLeft;
    Object.assign(cs.weapons, r.weapons);
    window.Save.write(save);
    screen = 'results';
    setHud(false);
    show('h-flip', false);
    $('r-title').textContent = REASONS[r.reason];
    $('r-title').className = r.reason === 'stab' ? 'good' : '';
    const kinds = Object.entries(r.byKind).map(([k, n]) => `${C.ZOMBIES[k].name}: ${n}`).join(', ');
    const rows = [
      ['Дистанция', `${r.distance} м` + (r.record ? ' — новый рекорд!' : '')],
      ['Доехали до', `${r.reached} из ${r.total} м`],
      ['Убито заражённых', r.kills + (kinds ? ` (${kinds})` : '')],
      ['Собрано споранов', r.loot.sporan],
      ['За дистанцию', '+' + r.distanceSporans],
    ];
    if (r.recordSporans) rows.push(['За рекорд', '+' + r.recordSporans]);
    if (r.stabBonus) rows.push(['Доехали до стаба', '+' + r.stabBonus]);
    if (r.loot.peas) rows.push(['Горох', '+' + r.loot.peas]);
    if (r.loot.pearl) rows.push(['Жемчуг', '+' + r.loot.pearl]);
    if (r.checkpoint) rows.push(['Чекпоинт', `${r.checkpoint} — следующий заезд можно начать с него`]);
    $('r-table').innerHTML = rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
    $('r-total').textContent = '+' + r.sporans;
    show('results', true);
  }

  // --- Заставка и стаб ---
  function openTitle() {
    screen = 'menu';
    setHud(false);
    show('results', false);
    show('menu', true);
  }

  function openStab() {
    screen = 'stab';
    setHud(false);
    show('results', false);
    show('menu', false);
    window.Stab.open(save, (levelIndex, cp) => startRun(levelIndex, cp));
  }

  // --- Цикл ---
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (run && screen === 'run' && !window.Platform.paused) {
      const P = C.PHYSICS;
      acc += dt;
      let n = 0;
      while (acc >= P.step && n < P.maxSubSteps) { step(P.step); acc -= P.step; n++; }
      if (n === P.maxSubSteps) acc = 0;
      window.Render.updateCamera(run.car, dt);
      const car = run.car;
      if (!run.ended) {
        window.Sound.engine(Math.min(1, Math.abs(car.rear.body.getAngularVelocity()) * car.def.wheels.radius / car.stats.maxSpeed), car.fuel > 0 ? Math.abs(car.throttle) : 0);
      } else {
        // Пауза перед итогами, чтобы было видно, чем кончилось.
        endTimer += dt;
        if (endTimer > 1.6) finishRun();
      }
    }
    if (run) {
      window.Render.draw(run, now / 1000);
      if (screen === 'run') hud();
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

  $('r-ok').addEventListener('click', openStab);
  $('m-play').addEventListener('click', openStab);
  $('btn-quit').addEventListener('click', () => {
    window.Platform.resume();
    if (run && screen === 'run' && !run.ended) { run.end('quit'); endTimer = 10; }
  });
  $('m-reset').addEventListener('click', () => {
    if ($('m-reset').dataset.armed) { save = window.Save.reset(); delete $('m-reset').dataset.armed; $('m-reset').textContent = 'Сбросить прогресс'; openTitle(); }
    else { $('m-reset').dataset.armed = '1'; $('m-reset').textContent = 'Точно сбросить? Нажмите ещё раз'; }
  });
  window.Platform.on('pause', () => window.Sound.engineOff());
  window.Platform.on('resume', () => { last = performance.now(); });
  // «Назад»: в меню и итогах ничего не делает, в заезде — пауза.
  window.Platform.onBack = () => screen !== 'run';
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && screen === 'run') window.Platform.paused ? window.Platform.resume() : window.Platform.pause();
  });

  window.Game = {
    get run() { return run; }, get save() { return save; }, get screen() { return screen; },
    startRun, step: (dt) => step(dt), finishRun, openStab, openTitle,
  };

  window.Render.init(canvas);
  window.addEventListener('resize', resize);
  resize();
  // Фон меню: живой уровень за затемнением.
  startRun(Math.min(save.level, C.LEVELS.length - 1), 0, true);
  openTitle();
  requestAnimationFrame(frame);
})();
