// Отрисовка заезда: небо, параллакс-фон кластера, земля, машина.
// Мир рисуется в метрах с осью y вверх: трансформация холста переворачивает ось.
(function () {
  let ctx, width = 0, height = 0, dpr = 1;
  const cam = { x: 0, y: 0, ppm: 40, vx: 0 };

  function init(canvas) { ctx = canvas.getContext('2d'); }

  function resize(w, h, ratio) { width = w; height = h; dpr = ratio; }

  // Экранная точка, где стоит центр камеры (машина левее центра — видно, что впереди).
  const anchor = () => ({ x: width * 0.38, y: height * 0.58 });

  function worldTransform() {
    const k = cam.ppm * dpr, a = anchor();
    ctx.setTransform(k, 0, 0, -k, dpr * a.x - k * cam.x, dpr * a.y + k * cam.y);
  }
  function screenTransform() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  function toScreen(x, y) {
    const a = anchor();
    return { x: a.x + (x - cam.x) * cam.ppm, y: a.y - (y - cam.y) * cam.ppm };
  }

  function updateCamera(car, dt) {
    const C = window.CONFIG.CAMERA;
    const p = car.chassis.getPosition();
    const v = car.chassis.getLinearVelocity();
    cam.vx += (v.x - cam.vx) * Math.min(1, dt * 2);
    const tx = p.x + cam.vx * C.lookAhead;
    const ty = p.y + 1.5;
    const k = Math.min(1, dt * C.smoothing);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k * 1.5;
    const fast = Math.min(1, Math.abs(cam.vx) / C.fastSpeed);
    const viewH = C.viewHeight + (C.viewHeightFast - C.viewHeight) * fast;
    const target = height / viewH;
    cam.ppm += (target - cam.ppm) * Math.min(1, dt * 1.5);
  }

  function snapCamera(car) {
    const p = car.chassis.getPosition();
    cam.x = p.x; cam.y = p.y + 1.5; cam.vx = 0;
    cam.ppm = height / window.CONFIG.CAMERA.viewHeight;
  }

  // --- Фон: город-призрак с облаками, всё процедурно и с параллаксом ---
  let bgCache = null;
  function buildBackground(seed) {
    const rand = rng(seed);
    const layers = [];
    // Дальние многоэтажки.
    const far = [];
    for (let x = -50; x < 3000; x += 6 + rand() * 10) far.push({ x, w: 5 + rand() * 9, h: 8 + rand() * 22, broken: rand() < 0.35 });
    layers.push({ k: 0.15, items: far, color: '#5a6068', windows: '#6c7278' });
    const mid = [];
    for (let x = -50; x < 3000; x += 10 + rand() * 18) mid.push({ x, w: 6 + rand() * 10, h: 5 + rand() * 12, broken: rand() < 0.5 });
    layers.push({ k: 0.35, items: mid, color: '#3e434a', windows: '#4c5158' });
    return layers;
  }

  function drawSky(t) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#6f7a80');
    g.addColorStop(0.55, '#a8a49a');
    g.addColorStop(1, '#b8ab94');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    // Мутное солнце сквозь дымку.
    const sx = width * 0.78, sy = height * 0.22;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, height * 0.35);
    sg.addColorStop(0, 'rgba(255,240,200,0.55)');
    sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, width, height);
  }

  function drawParallax() {
    if (!bgCache) bgCache = buildBackground(77);
    const horizon = height * 0.66;
    for (const L of bgCache) {
      const ox = cam.x * L.k;
      const scale = cam.ppm * (L.k < 0.2 ? 0.35 : 0.5);
      for (const b of L.items) {
        const x = (b.x - ox) * scale + width * 0.38;
        const w = b.w * scale;
        if (x + w < 0 || x > width) continue;
        const h = b.h * scale;
        const y = horizon - h + (cam.y * L.k * 2);
        ctx.fillStyle = L.color;
        if (b.broken) {
          ctx.beginPath();
          ctx.moveTo(x, y + h * 0.15);
          ctx.lineTo(x + w * 0.35, y);
          ctx.lineTo(x + w * 0.55, y + h * 0.2);
          ctx.lineTo(x + w * 0.8, y + h * 0.08);
          ctx.lineTo(x + w, y + h * 0.3);
          ctx.lineTo(x + w, horizon + height);
          ctx.lineTo(x, horizon + height);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, horizon + height - y);
        }
        ctx.fillStyle = L.windows;
        const cols = Math.max(1, Math.floor(b.w / 1.6)), rows = Math.floor(b.h / 1.8);
        for (let i = 0; i < cols; i++) for (let j = 1; j < rows; j++) {
          if ((i * 7 + j * 3 + Math.floor(b.x)) % 5 === 0) continue;
          ctx.fillRect(x + (i + 0.3) * w / cols, y + j * h / rows, w / cols * 0.4, h / rows * 0.4);
        }
      }
    }
    // Дымка у горизонта.
    const g = ctx.createLinearGradient(0, horizon - height * 0.2, 0, horizon + 20);
    g.addColorStop(0, 'rgba(184,171,148,0)');
    g.addColorStop(1, 'rgba(184,171,148,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon - height * 0.2, width, height * 0.2 + 20);
  }

  // Земля: заливка до низа экрана, верхний слой асфальта/грунта.
  function drawGround(terrain) {
    const left = cam.x - (width * 0.38) / cam.ppm - 2;
    const right = cam.x + (width * 0.62) / cam.ppm + 2;
    const bottom = cam.y - height / cam.ppm * 1.2 - 10;
    const pts = terrain.points.filter((p) => p[0] >= left - 2 && p[0] <= right + 2);
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(pts[pts.length - 1][0], bottom);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, cam.y, 0, bottom);
    g.addColorStop(0, '#5a4a3a');
    g.addColorStop(1, '#2a221c');
    ctx.fillStyle = g;
    ctx.fill();
    // Верхний слой.
    ctx.strokeStyle = '#3c3a36';
    ctx.lineWidth = 0.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - 0.2) : ctx.moveTo(p[0], p[1] - 0.2)));
    ctx.stroke();
    ctx.strokeStyle = '#6a6458';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    // Камни и мусор в грунте.
    ctx.fillStyle = 'rgba(30,24,18,0.5)';
    for (const p of pts) {
      const h = Math.abs(Math.sin(p[0] * 12.9898) * 43758.5453) % 1;
      if (h < 0.3) ctx.fillRect(p[0], p[1] - 0.6 - h * 3, 0.25 + h, 0.15);
    }
  }

  function draw(scene, t) {
    screenTransform();
    drawSky(t);
    drawParallax();
    worldTransform();
    drawGround(scene.terrain);
    window.CarDraw.draw(ctx, scene.car, t);
    screenTransform();
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  window.Render = { init, resize, draw, updateCamera, snapCamera, toScreen, cam, rng };
})();
