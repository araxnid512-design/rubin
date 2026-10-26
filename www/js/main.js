// Гарнизон: экраны, игровой цикл, камера и управление касаниями.
(function () {
  const D = window.GameData;
  const C = window.Campaign;
  const UI = window.UI;
  const $ = UI.$;
  const canvas = $('view');

  let c = null;          // кампания
  let scene = null;      // текущая сцена (база, вылазка, оборона)
  let plan = null;       // план текущей вылазки
  let screen = 'menu';
  let speed = 1;
  let last = performance.now();
  let width = 0, height = 0;
  const view = { x: 0, y: 0, zoom: 1, follow: true };

  // --- Камера ---
  function basePpm() {
    if (!scene) return 20;
    if (scene.mode === 'sortie') return Math.max(18, width / 30);
    // База целиком на экране; ближе — щипком или кнопками.
    return Math.max(8, Math.min(width / 58, (height - 50) / 38));
  }
  const ppm = () => basePpm() * view.zoom;

  function centerOn(x, y) {
    view.x = x - width / ppm() / 2;
    view.y = y - height / ppm() / 2;
    clampView();
  }

  function clampView() {
    if (!scene) return;
    const vw = width / ppm(), vh = height / ppm(), m = scene.map;
    const pad = 4;
    view.x = Math.max(-pad, Math.min(m.w - vw + pad, view.x));
    view.y = Math.max(-pad - 3, Math.min(m.h - vh + pad, view.y));
    if (vw > m.w + pad * 2) view.x = (m.w - vw) / 2;
    if (vh > m.h + pad * 2) view.y = (m.h - vh) / 2;
  }

  function zoomBy(k, px, py) {
    const before = window.Render.toWorld(px == null ? width / 2 : px, py == null ? height / 2 : py);
    view.zoom = Math.max(0.5, Math.min(2.5, view.zoom * k));
    view.x = before.x - (px == null ? width / 2 : px) / ppm();
    view.y = before.y - (py == null ? height / 2 : py) / ppm();
    clampView();
  }

  // --- Экраны ---
  function toMenu() {
    screen = 'menu';
    UI.setScreen('menu');
    UI.hint('');
    if (!scene || scene.mode !== 'base') {
      // На фоне меню — живая база.
      const bg = c || C.create();
      scene = new window.Battle(window.Maps.base(bg), 'base', { soldiers: Math.min(bg.soldiers, 60) });
      view.zoom = 1;
      centerOn(scene.map.center.x, scene.map.center.y);
    }
    UI.show('m-continue', C.hasSave());
    UI.soundLabel();
    UI.show('menu', true);
  }

  function startCampaign(fresh) {
    c = fresh ? null : C.load();
    if (!c) { c = C.create(); C.clear(); }
    UI.show('menu', false);
    toBase();
    if (fresh || c.day === 1) {
      UI.report('Приказ', [
        'Вы — командир воинской части. Город Заречный охвачен заражением.',
        `В подчинении ${c.soldiers} бойцов с АК-74. Патроны, автоматы и еда — ваш предел.`,
        '«Вылазка»: выберите район, ползунками задайте число бойцов и патронов (по 300 на человека).',
        'В бою: коснитесь карты — отряд идёт туда и сам стреляет. Перетаскивайте карту пальцем.',
        'Найденные выжившие пойдут с отрядом. На базе им можно выдать автоматы.',
        'Стрельба шумит — угроза орды растёт. Готовьте стены и вышки.',
      ], 'К делу');
    }
  }

  function toBase() {
    screen = 'base';
    scene = new window.Battle(window.Maps.base(c), 'base', { soldiers: Math.min(c.soldiers, 60) });
    view.zoom = 1;
    centerOn(scene.map.center.x, scene.map.center.y + 2);
    UI.setScreen('base');
    UI.hint('');
    UI.topbar(c);
    C.save(c);
  }

  function startSortie(districtId, count, ammoPer) {
    const p = C.planSortie(c, districtId, count, ammoPer);
    if (p.error) { UI.toast(p.error, 'bad'); return; }
    plan = p;
    UI.show('planner', false);
    const map = window.Maps.district(p.def, p.visit);
    scene = new window.Battle(map, 'sortie', p.battle);
    screen = 'sortie';
    speed = 1;
    $('a-speed').textContent = '×1';
    view.zoom = 1;
    view.follow = true;
    const cen = scene.centroid();
    centerOn(cen.x, cen.y);
    UI.setScreen('sortie');
    UI.hint('Коснитесь карты — отряд пойдёт туда');
    setTimeout(() => UI.hint(''), 4000);
    C.save(c);
  }

  function finishSortie() {
    const res = scene.finish(scene.result ? scene.result.outcome : 'extracted');
    const rep = C.applySortie(c, plan, res);
    plan = null;
    C.save(c);
    const { title, lines } = UI.sortieLines(rep);
    UI.report(title, lines, 'На базу', () => { if (c.over) gameOver(); else toBase(); });
  }

  function startDefense(size) {
    const map = window.Maps.base(c);
    scene = new window.Battle(map, 'defense', {
      soldiers: c.soldiers, ammoPool: c, hordeSize: size, hordeMix: C.hordeMix(c), waves: 2 + Math.floor(c.day / 6),
    });
    screen = 'defense';
    speed = 1;
    $('a-speed').textContent = '×1';
    view.zoom = 1.3;
    centerOn(map.center.x, map.wallRect.y1 - 6);
    UI.setScreen('defense');
    window.Sound.alarm();
    UI.toast('Тревога! Орда у стен части', 'bad', 4);
  }

  function finishDefense() {
    const rep = C.applyDefense(c, scene.result);
    C.save(c);
    const { title, lines } = UI.defenseLines(rep);
    UI.report(title, lines, 'Ясно', () => { if (c.over) gameOver(); else toBase(); });
  }

  function endDay() {
    const r = C.endDay(c);
    C.save(c);
    UI.topbar(c);
    const lines = r.lines.map((l) => [l, /Голод|ушли|орда/i.test(l) ? 'bad' : '']);
    lines.push(`Угроза орды: ${Math.min(100, r.threat)}%`);
    if (c.over) { UI.report(`День ${r.day} окончен`, lines, 'Дальше', gameOver); return; }
    if (r.horde) UI.report(`Ночь ${r.day}`, lines, 'К обороне!', () => startDefense(r.horde));
    else UI.report(`День ${r.day} окончен`, lines, `Начать день ${c.day}`, toBase);
  }

  function gameOver() {
    screen = 'over';
    C.clear();
    $('go-text').textContent = `Продержались дней: ${c.day}. Уничтожено заражённых: ${c.stats.kills}. ` +
      `Спасено людей: ${c.stats.rescued}. Потеряно бойцов: ${c.stats.lost}.`;
    UI.show('gameover', true);
  }

  // --- Цикл ---
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const blocked = window.Platform.paused || !$('report').classList.contains('hidden');
    if (scene && !(blocked && screen !== 'base' && screen !== 'menu')) {
      for (let i = 0; i < speed; i++) scene.update(dt);
    }
    if (scene) {
      for (const e of scene.events.splice(0)) UI.toast(e.text, e.kind);
      if (screen === 'sortie') {
        if (view.follow) {
          const cen = scene.centroid();
          const tx = cen.x - width / ppm() / 2, ty = cen.y - height / ppm() / 2;
          view.x += (tx - view.x) * Math.min(1, dt * 3);
          view.y += (ty - view.y) * Math.min(1, dt * 3);
          clampView();
        }
        UI.battleHud(scene, plan ? plan.def.name : '');
        UI.show('a-return', scene.cleared && !scene.result);
        UI.show('a-retreat', !scene.cleared && !scene.result);
        if (scene.result && $('report').classList.contains('hidden') && plan) finishSortie();
      } else if (screen === 'defense') {
        UI.battleHud(scene, `Оборона части · ночь ${c.day - 1}`);
        if (scene.result && $('report').classList.contains('hidden') && !scene.reported) {
          scene.reported = true;
          finishDefense();
        }
      } else if (screen === 'base') {
        UI.topbar(c);
      }
      window.Render.draw(scene, now / 1000, {
        camX: view.x, camY: view.y, ppm: ppm(),
        night: screen === 'defense' ? 0.55 : 0,
      });
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
    clampView();
  }

  // --- Касания: тап — приказ, перетаскивание — сдвиг, щипок — масштаб ---
  const pointers = new Map();
  let gesture = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) gesture = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom, moved: true };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !gesture) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (gesture.pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = Math.max(0.5, Math.min(2.5, gesture.zoom * d / gesture.pinch));
      zoomBy(target / view.zoom, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (!gesture.moved && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 10) gesture.moved = true;
    if (gesture.moved) {
      view.x -= dx / ppm();
      view.y -= dy / ppm();
      view.follow = false;
      clampView();
    }
  });
  function up(e) {
    pointers.delete(e.pointerId);
    if (gesture && !gesture.moved && !gesture.pinch && performance.now() - gesture.t < 400) tap(e.clientX, e.clientY);
    if (pointers.size === 0) gesture = null;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); gesture = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });

  function tap(px, py) {
    if (screen !== 'sortie' || !scene || scene.result) return;
    const w = window.Render.toWorld(px, py);
    scene.retreating = false;
    scene.orderMove(w.x, w.y);
    window.Sound.pickup();
  }

  // --- Кнопки ---
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('m-new', () => startCampaign(true));
  on('m-continue', () => startCampaign(false));
  on('m-sound', () => { window.Sound.toggle(); UI.soundLabel(); });
  on('btn-sound', () => { window.Sound.toggle(); UI.soundLabel(); });
  on('btn-menu', () => { if (c && screen === 'base') C.save(c); window.Platform.resume(); toMenu(); });
  on('b-sortie', () => UI.openPlanner(c, startSortie));
  on('p-close', () => UI.show('planner', false));
  on('b-personnel', () => UI.openPersonnel(c, (n) => {
    const done = C.armCivilians(c, n);
    if (done) UI.toast(`Выдано автоматов: ${done}. Бойцов стало ${c.soldiers}`, 'good');
    C.save(c);
    UI.show('personnel', false);
    toBase();
  }));
  on('pers-close', () => UI.show('personnel', false));
  on('b-build', () => openBuild());
  on('build-close', () => UI.show('build', false));
  on('b-endday', endDay);
  on('a-zoomin', () => zoomBy(1.2));
  on('a-zoomout', () => zoomBy(1 / 1.2));
  on('a-center', () => { view.follow = true; });
  on('a-speed', () => { speed = speed === 1 ? 2 : 1; $('a-speed').textContent = '×' + speed; });
  on('a-retreat', () => { if (scene && scene.mode === 'sortie') { scene.retreat(); view.follow = true; } });
  on('a-return', () => { if (scene && scene.cleared && !scene.result) scene.finish('extracted'); });
  on('go-restart', () => { UI.show('gameover', false); startCampaign(true); });

  function openBuild() {
    UI.openBuild(c, (key) => {
      if (C.build(c, key)) {
        UI.toast(`${D.BUILDINGS[key].name}: уровень ${c.buildings[key]}`, 'good');
        C.save(c);
        toBase();
        openBuild();
      }
    }, () => {
      if (C.repairWalls(c)) { UI.toast('Стены отремонтированы', 'good'); C.save(c); toBase(); openBuild(); }
    });
  }

  // «Назад»: закрыть окно; в бою — пауза. Отчёт закрывается только кнопкой.
  window.Platform.onBack = () => {
    for (const id of ['planner', 'personnel', 'build']) {
      if (!$(id).classList.contains('hidden')) { UI.show(id, false); return true; }
    }
    if (!$('report').classList.contains('hidden') || !$('menu').classList.contains('hidden')) return true;
    return false;
  };
  window.Platform.on('pause', () => { if (c && screen === 'base') C.save(c); });
  window.Platform.on('resume', () => { last = performance.now(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (window.Platform.onBack()) return;
      window.Platform.paused ? window.Platform.resume() : window.Platform.pause();
    }
  });

  window.Game = {
    get campaign() { return c; }, get scene() { return scene; }, get screen() { return screen; },
    startSortie, endDay, startDefense, view,
  };

  window.Render.init(canvas);
  window.addEventListener('resize', resize);
  resize();
  toMenu();
  requestAnimationFrame(frame);
})();
