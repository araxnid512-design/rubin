// Отрисовка заезда: небо, параллакс-фон кластера, земля, объекты, машина.
// Мир рисуется в метрах с осью y вверх: трансформация холста переворачивает ось.
(function () {
  let ctx, width = 0, height = 0, dpr = 1;
  const cam = { x: 0, y: 0, ppm: 40, vx: 0, shake: 0, sx: 0, sy: 0 };
  let theme = null, style = null;
  let bgCache = null, vignette = null, darkLayer = null, lastT = 0;

  // Вид кластера: покрытие дороги, трава, цвета пыли, частиц в воздухе, облаков; ночь — звёзды.
  const STYLES = {
    city: { road: 'asphalt', marks: 'rgba(200,184,120,0.45)', dust: 'rgba(150,140,125,0.5)', motes: 'rgba(230,220,200,0.5)', clouds: 'rgba(205,205,200,0.35)', rays: true },
    forest: { road: 'dirt', grass: '#3e5a32', dust: 'rgba(120,100,70,0.5)', motes: 'rgba(235,245,225,0.55)', clouds: 'rgba(215,220,210,0.35)', rays: true },
    industrial: { road: 'asphalt', marks: 'rgba(190,160,90,0.4)', dust: 'rgba(130,120,110,0.5)', motes: 'rgba(210,190,160,0.5)', clouds: 'rgba(160,140,120,0.4)', rays: true },
    village: { road: 'dirt', grass: '#6a6a30', dust: 'rgba(170,140,100,0.5)', motes: 'rgba(255,220,170,0.6)', clouds: 'rgba(245,185,140,0.35)', rays: true },
    river: { road: 'asphalt', marks: 'rgba(160,150,100,0.35)', grass: '#26342c', dust: 'rgba(110,110,105,0.5)', motes: 'rgba(180,200,230,0.45)', stars: true },
    dead: { road: 'dirt', grass: '#4a2a24', dust: 'rgba(100,70,65,0.5)', motes: 'rgba(255,120,90,0.65)', stars: true },
  };

  function init(canvas) { ctx = canvas.getContext('2d'); }
  function resize(w, h, ratio) { width = w; height = h; dpr = ratio; vignette = null; }
  function setTheme(t) { theme = t; style = STYLES[t.bg] || STYLES.city; bgCache = null; }

  // Тряска камеры: удар, жёсткое приземление, взрыв. a — амплитуда в метрах.
  function shake(a) { cam.shake = Math.min(window.CONFIG.FX.shakeMax, Math.max(cam.shake, a)); }

  // Экранная точка, где стоит центр камеры (машина левее центра — видно, что впереди).
  const anchor = () => ({ x: width * 0.38, y: height * 0.58 });

  function worldTransform() {
    const k = cam.ppm * dpr, a = anchor();
    ctx.setTransform(k, 0, 0, -k, dpr * a.x - k * (cam.x + cam.sx), dpr * a.y + k * (cam.y + cam.sy));
  }
  function screenTransform() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  function toScreen(x, y) {
    const a = anchor();
    return { x: a.x + (x - cam.x) * cam.ppm, y: a.y - (y - cam.y) * cam.ppm };
  }

  // Видимый диапазон мира по x.
  function viewX() {
    return { l: cam.x - (width * 0.38) / cam.ppm - 3, r: cam.x + (width * 0.62) / cam.ppm + 3 };
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
    cam.ppm += (height / viewH - cam.ppm) * Math.min(1, dt * 1.5);
  }

  function snapCamera(car) {
    const p = car.chassis.getPosition();
    cam.x = p.x; cam.y = p.y + 1.5; cam.vx = 0;
    cam.ppm = height / window.CONFIG.CAMERA.viewHeight;
  }

  // --- Фон кластера, процедурно и с параллаксом ---
  // Слои фона по кластеру: k — параллакс, scale — масштаб, shape — чем рисовать.
  function buildBackground(kind) {
    const rand = rng(kind.length * 97 + 7);
    const L = (k, scale, color, step, gen, extra) => {
      const items = [];
      for (let x = -50; x < 5000; x += step[0] + rand() * step[1]) items.push(Object.assign({ x }, gen()));
      return Object.assign({ k, scale, color, items }, extra || {});
    };
    if (kind === 'city') return [
      L(0.15, 0.35, '#5a6068', [6, 10], () => ({ w: 5 + rand() * 9, h: 8 + rand() * 22, broken: rand() < 0.35, shape: 'block' }), { windows: '#6c7278' }),
      L(0.35, 0.5, '#3e434a', [10, 18], () => ({ w: 6 + rand() * 10, h: 5 + rand() * 12, broken: rand() < 0.5, shape: 'block' }), { windows: '#4c5158' }),
    ];
    if (kind === 'forest') return [
      L(0.12, 0.35, '#6a7a72', [2, 3], () => ({ w: 3 + rand() * 3, h: 12 + rand() * 12, shape: 'pine' })),
      L(0.3, 0.5, '#46564a', [3, 4], () => ({ w: 3 + rand() * 3, h: 8 + rand() * 10, shape: 'pine' })),
      L(0.55, 0.7, '#2c3a2e', [5, 8], () => ({ w: 3 + rand() * 3, h: 7 + rand() * 6, shape: 'pine' })),
    ];
    if (kind === 'industrial') return [
      L(0.12, 0.35, '#7a6e64', [14, 20], () => ({ w: 3, h: 26 + rand() * 18, shape: 'chimney', smoke: rand() < 0.6 })),
      L(0.25, 0.45, '#5a504a', [10, 14], () => ({ w: 10 + rand() * 14, h: 6 + rand() * 9, shape: rand() < 0.3 ? 'crane' : 'factory' })),
      L(0.45, 0.6, '#3a3430', [16, 20], () => ({ w: 8 + rand() * 6, h: 3 + rand() * 4, shape: 'tank' })),
    ];
    if (kind === 'village') return [
      L(0.1, 0.35, '#8a6a6a', [30, 40], () => ({ w: 40, h: 6 + rand() * 6, shape: 'hill' })),
      L(0.3, 0.5, '#4a3a34', [12, 20], () => ({ w: 6 + rand() * 4, h: 4 + rand() * 2, shape: rand() < 0.12 ? 'mill' : 'house' })),
      L(0.5, 0.65, '#2e2420', [4, 6], () => ({ w: 3, h: 1.4, shape: 'fence' })),
    ];
    if (kind === 'river') return [
      L(0.08, 0.3, '#1e2838', [8, 14], () => ({ w: 6 + rand() * 8, h: 10 + rand() * 20, shape: 'block', lit: true }), { windows: '#c8a860' }),
      L(0.3, 0.5, '#182030', [40, 30], () => ({ w: 3, h: 22, shape: 'pylon' })),
    ];
    if (kind === 'dead') return [
      L(0.1, 0.35, '#4a2028', [12, 18], () => ({ w: 6 + rand() * 8, h: 14 + rand() * 24, broken: true, shape: 'block' }), { windows: '#5a2830' }),
      L(0.35, 0.55, '#24141a', [5, 9], () => ({ w: 4, h: 6 + rand() * 8, shape: 'deadtree', seed: rand() })),
    ];
    return [];
  }

  function drawShape(L, b, x, y, w, h, base) {
    const c = ctx;
    c.fillStyle = L.color;
    if (b.shape === 'block') {
      if (b.broken) {
        c.beginPath();
        c.moveTo(x, y + h * 0.15); c.lineTo(x + w * 0.35, y); c.lineTo(x + w * 0.55, y + h * 0.2);
        c.lineTo(x + w * 0.8, y + h * 0.08); c.lineTo(x + w, y + h * 0.3); c.lineTo(x + w, base); c.lineTo(x, base);
        c.closePath(); c.fill();
      } else c.fillRect(x, y, w, base - y);
      c.fillStyle = L.windows;
      const cols = Math.max(1, Math.floor(b.w / 1.6)), rows = Math.floor(b.h / 1.8);
      for (let i = 0; i < cols; i++) for (let j = 1; j < rows; j++) {
        if ((i * 7 + j * 3 + Math.floor(b.x)) % (b.lit ? 3 : 5) === 0) continue;
        if (b.lit && (i * 5 + j * 11 + Math.floor(b.x)) % 4) continue;
        c.fillRect(x + (i + 0.3) * w / cols, y + j * h / rows, w / cols * 0.4, h / rows * 0.4);
      }
    } else if (b.shape === 'pine') {
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.moveTo(x + w / 2, y + h * k * 0.22);
        c.lineTo(x + w * (0.05 - k * 0.05), y + h * (0.45 + k * 0.22));
        c.lineTo(x + w * (0.95 + k * 0.05), y + h * (0.45 + k * 0.22));
        c.closePath(); c.fill();
      }
      c.fillRect(x + w * 0.45, y + h * 0.8, w * 0.1, base - y - h * 0.8);
    } else if (b.shape === 'chimney') {
      c.fillRect(x, y, w, base - y);
      c.fillStyle = 'rgba(160,40,30,0.5)';
      c.fillRect(x, y + h * 0.1, w, h * 0.05);
      if (b.smoke) {
        c.fillStyle = 'rgba(120,110,100,0.25)';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + w / 2 + i * w * 1.2, y - i * w * 1.2, w * (0.8 + i * 0.5), 0, Math.PI * 2); c.fill(); }
      }
    } else if (b.shape === 'factory') {
      c.fillRect(x, y, w, base - y);
      c.beginPath();
      for (let i = 0; i < 4; i++) { c.moveTo(x + i * w / 4, y); c.lineTo(x + (i + 0.5) * w / 4, y - h * 0.3); c.lineTo(x + (i + 1) * w / 4, y); }
      c.fill();
    } else if (b.shape === 'crane') {
      c.fillRect(x + w * 0.2, y - h, w * 0.06, base - y + h);
      c.fillRect(x - w * 0.2, y - h, w * 1.2, w * 0.05);
      c.fillRect(x + w * 0.9, y - h, 1, h * 0.8);
    } else if (b.shape === 'tank') {
      c.beginPath(); c.ellipse(x + w / 2, y + h * 0.3, w / 2, h * 0.3, 0, Math.PI, 0); c.fill();
      c.fillRect(x, y + h * 0.3, w, base - y);
    } else if (b.shape === 'hill') {
      c.beginPath(); c.moveTo(x - w * 0.2, base); c.quadraticCurveTo(x + w / 2, y - h, x + w * 1.2, base); c.fill();
    } else if (b.shape === 'house' || b.shape === 'mill') {
      c.fillRect(x, y + h * 0.4, w, base - y - h * 0.4);
      c.beginPath(); c.moveTo(x - w * 0.1, y + h * 0.4); c.lineTo(x + w / 2, y); c.lineTo(x + w * 1.1, y + h * 0.4); c.fill();
      c.fillStyle = 'rgba(255,190,110,0.35)';
      c.fillRect(x + w * 0.3, y + h * 0.55, w * 0.15, h * 0.15);
      if (b.shape === 'mill') {
        c.strokeStyle = L.color; c.lineWidth = Math.max(1, w * 0.04);
        const cx = x + w / 2, cy = y + h * 0.2, r = w * 0.8, a = performance.now() / 3000;
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a + i * Math.PI / 2) * r, cy + Math.sin(a + i * Math.PI / 2) * r); c.stroke(); }
      }
    } else if (b.shape === 'fence') {
      for (let i = 0; i < 4; i++) c.fillRect(x + i * w / 4, y, w * 0.06, base - y);
      c.fillRect(x, y + h * 0.3, w, h * 0.08);
    } else if (b.shape === 'pylon') {
      c.fillRect(x, y, w, base - y);
      c.strokeStyle = L.color; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x - w * 12, y + h * 0.6); c.moveTo(x + w / 2, y); c.lineTo(x + w * 13, y + h * 0.6); c.stroke();
    } else if (b.shape === 'deadtree') {
      c.strokeStyle = L.color; c.lineWidth = Math.max(1, w * 0.12);
      c.beginPath();
      c.moveTo(x + w / 2, base); c.lineTo(x + w / 2, y + h * 0.2);
      c.moveTo(x + w / 2, y + h * 0.5); c.lineTo(x + w * (0.1 + b.seed * 0.2), y + h * 0.2);
      c.moveTo(x + w / 2, y + h * 0.35); c.lineTo(x + w * 0.95, y + h * (0.05 + b.seed * 0.1));
      c.stroke();
    }
  }

  function drawSky(t) {
    const s = theme.sky;
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, s[0]);
    g.addColorStop(0.55, s[1]);
    g.addColorStop(1, s[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    const sx = width * 0.78, sy = height * 0.22;
    if (style.stars) {
      // Ночь: звёзды мерцают, луна с ореолом.
      const r = rng(11);
      ctx.fillStyle = '#e8ecff';
      for (let i = 0; i < 70; i++) {
        const x = ((r() * width * 1.5 - cam.x * cam.ppm * 0.01) % width + width) % width, y = r() * height * 0.55;
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * (0.5 + r()) + i));
        ctx.fillRect(x, y, r() < 0.15 ? 2 : 1.2, r() < 0.15 ? 2 : 1.2);
      }
      ctx.globalAlpha = 1;
      const mr = height * 0.045;
      ctx.drawImage(window.FX.puff(theme.bg === 'dead' ? 'rgba(255,120,90,0.35)' : 'rgba(200,215,255,0.3)'), sx - mr * 5, sy - mr * 5, mr * 10, mr * 10);
      ctx.fillStyle = theme.bg === 'dead' ? '#d8806a' : '#e6e8f0';
      ctx.beginPath(); ctx.arc(sx, sy, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.arc(sx - mr * 0.3, sy - mr * 0.2, mr * 0.25, 0, Math.PI * 2); ctx.arc(sx + mr * 0.35, sy + mr * 0.3, mr * 0.18, 0, Math.PI * 2); ctx.fill();
    } else {
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, height * 0.35);
      sg.addColorStop(0, 'rgba(255,240,200,0.55)');
      sg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, width, height);
    }
    // Облака: медленно плывут, сдвигаются с камерой чуть-чуть.
    if (style.clouds) {
      const r = rng(5), img = window.FX.puff(style.clouds);
      for (let i = 0; i < 9; i++) {
        const w = width * (0.25 + r() * 0.35), h = w * (0.25 + r() * 0.15);
        const span = width + w * 2;
        const x = ((r() * span - cam.x * cam.ppm * 0.03 + t * (4 + r() * 6)) % span + span) % span - w;
        const y = height * (0.04 + r() * 0.32);
        ctx.drawImage(img, x, y, w, h);
        ctx.drawImage(img, x + w * 0.25, y - h * 0.25, w * 0.6, h * 0.9);
      }
    }
    // Лучи солнца сквозь пыль.
    if (style.rays) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = 1.9 + i * 0.26 + Math.sin(t * 0.15 + i * 2) * 0.04;
        const len = height * 1.3, w = 0.09 + (i % 2) * 0.05;
        const rg = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        rg.addColorStop(0, 'rgba(255,235,190,0)');
        rg.addColorStop(0.15, 'rgba(255,235,190,0.06)');
        rg.addColorStop(1, 'rgba(255,235,190,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len);
        ctx.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Пылинки, споры и пепел в воздухе (экранные координаты, без состояния).
  function drawMotes(t) {
    const r = rng(3), img = window.FX.puff(style.motes);
    const span = width + 40;
    for (let i = 0; i < 36; i++) {
      const depth = 0.4 + r();
      const x = ((r() * span - cam.x * cam.ppm * depth * 0.6 - t * 12 * depth) % span + span) % span - 20;
      const y = (r() * height + Math.sin(t * 0.7 + i) * 14 + t * 6 * depth) % height;
      const s = 2 + depth * 3;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t + i * 1.7) ** 2;
      ctx.drawImage(img, x - s, y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }

  // Затемнение по краям кадра — один раз на размер экрана.
  function drawVignette() {
    if (!vignette) {
      vignette = document.createElement('canvas');
      vignette.width = Math.max(1, Math.round(width / 2));
      vignette.height = Math.max(1, Math.round(height / 2));
      const v = vignette.getContext('2d'), w = vignette.width, h = vignette.height;
      const g = v.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.5)');
      v.fillStyle = g;
      v.fillRect(0, 0, w, h);
    }
    ctx.drawImage(vignette, 0, 0, width, height);
  }

  function drawParallax() {
    if (!bgCache) bgCache = buildBackground(theme.bg);
    const horizon = height * 0.66;
    for (const L of bgCache) {
      const ox = cam.x * L.k;
      const scale = cam.ppm * L.scale;
      for (const b of L.items) {
        const x = (b.x - ox) * scale + width * 0.38;
        const w = b.w * scale;
        if (x + w * 1.3 < 0 || x - w * 0.3 > width) continue;
        const h = b.h * scale;
        const y = horizon - h + cam.y * L.k * 2;
        drawShape(L, b, x, y, w, h, horizon + height);
      }
    }
    const g = ctx.createLinearGradient(0, horizon - height * 0.2, 0, horizon + 20);
    g.addColorStop(0, 'rgba(184,171,148,0)');
    g.addColorStop(1, theme.sky[2] + 'aa');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon - height * 0.2, width, height * 0.2 + 20);
  }

  // --- Мир ---
  function drawGround(terrain) {
    const v = viewX();
    const bottom = cam.y - height / cam.ppm * 1.2 - 12;
    const pts = terrain.points.filter((p) => p[0] >= v.l - 2 && p[0] <= v.r + 2);
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(pts[pts.length - 1][0], bottom);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, cam.y, 0, bottom);
    g.addColorStop(0, theme.ground[0]);
    g.addColorStop(1, theme.ground[1]);
    ctx.fillStyle = g;
    ctx.fill();
    const line = (dy) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + dy) : ctx.moveTo(p[0], p[1] + dy))); };
    const hash = (x, k) => Math.abs(Math.sin(x * 12.9898 + k * 78.233) * 43758.5453) % 1;
    ctx.lineJoin = 'round';
    // Пласты грунта под дорогой.
    ctx.strokeStyle = shade(theme.ground[0], -18);
    ctx.lineWidth = 0.9;
    line(-0.95); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.18;
    line(-2.3); ctx.stroke();
    line(-3.6); ctx.stroke();
    // Камни в толще земли.
    for (const p of pts) {
      for (let k = 0; k < 2; k++) {
        const h = hash(p[0], k);
        if (h > 0.45) continue;
        const d = 0.8 + hash(p[0], k + 5) * 4.5, r = 0.06 + h * 0.3;
        ctx.fillStyle = h < 0.2 ? 'rgba(0,0,0,0.28)' : 'rgba(255,240,220,0.07)';
        ctx.beginPath(); ctx.ellipse(p[0] + hash(p[0], k + 9), p[1] - d, r * 1.4, r, h * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Полотно дороги: тёмная полоса, светлая кромка, тень под кромкой.
    ctx.strokeStyle = theme.road;
    ctx.lineWidth = 0.5;
    line(-0.22); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.08;
    line(-0.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,210,190,0.38)';
    ctx.lineWidth = 0.07;
    line(0); ctx.stroke();
    if (style.road === 'asphalt') {
      // Разметка и трещины на асфальте.
      ctx.strokeStyle = style.marks;
      ctx.lineWidth = 0.07;
      ctx.setLineDash([1.4, 1.8]);
      line(-0.2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      for (const p of pts) {
        const h = hash(p[0], 3);
        if (h > 0.18) continue;
        ctx.moveTo(p[0], p[1] - 0.02); ctx.lineTo(p[0] + 0.15, p[1] - 0.18); ctx.lineTo(p[0] + 0.05, p[1] - 0.4);
      }
      ctx.stroke();
    } else {
      // Колея на грунтовке.
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.06;
      ctx.setLineDash([0.5, 0.35]);
      line(-0.14); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Трава и сухие стебли по кромке, качаются на ветру.
    if (style.grass) {
      const t = lastT;
      ctx.strokeStyle = style.grass;
      ctx.lineWidth = 0.045;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const p of pts) {
        for (let k = 0; k < 3; k++) {
          const h = hash(p[0], k + 20);
          if (h > 0.6) continue;
          const x = p[0] + k * 0.33, len = 0.12 + h * 0.35, sway = Math.sin(t * 2 + x) * 0.06;
          ctx.moveTo(x, p[1] - 0.02);
          ctx.quadraticCurveTo(x + sway * 0.5, p[1] + len * 0.6, x + sway + (h - 0.3) * 0.2, p[1] + len);
        }
      }
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  function drawWater(m, t) {
    const v = viewX();
    if (m.x > v.r || m.x + m.w < v.l) return;
    ctx.fillStyle = 'rgba(40,70,80,0.9)';
    ctx.fillRect(m.x, m.y - 12, m.w, 12);
    ctx.strokeStyle = 'rgba(160,200,210,0.5)';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    for (let x = m.x; x <= m.x + m.w; x += 0.5) {
      const y = m.y + Math.sin(x * 2 + t * 2) * 0.08;
      if (x === m.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawFord(m, t) {
    ctx.fillStyle = 'rgba(50,80,90,0.75)';
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    for (let x = m.x; x <= m.x + m.w; x += 0.5) ctx.lineTo(x, m.y + Math.sin(x * 2 + t * 2) * 0.05);
    ctx.lineTo(m.x + m.w, m.y - m.depth - 0.2);
    ctx.lineTo(m.x, m.y - m.depth - 0.2);
    ctx.closePath();
    ctx.fill();
  }

  // Туман и ночь: видно только вокруг машины; прожектор раздвигает темноту.
  function drawVisibility(scene) {
    const th = theme;
    if (!th.fog && !th.night) return;
    const car = scene.car, light = car.stats.light || 0;
    const p = toScreen(car.pos.x, car.pos.y + 0.5);
    const f = car.forward();
    if (th.fog) {
      const r = (th.fog + light * 12) * cam.ppm;
      const g = ctx.createRadialGradient(p.x + 2 * cam.ppm, p.y, r * 0.25, p.x + 2 * cam.ppm, p.y, r);
      g.addColorStop(0, 'rgba(190,195,190,0)');
      g.addColorStop(1, th.night ? 'rgba(40,30,34,0.92)' : 'rgba(190,195,190,0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    if (th.night) {
      // Темнота — отдельным слоем, из которого мягко «вытерт» свет: ореол вокруг
      // машины и луч фар с размытыми краями. Длина луча — от прожектора.
      const len = (14 + light * 9) * cam.ppm, spread = 0.38 + light * 0.06;
      const a = Math.atan2(-f.y, f.x);
      if (!darkLayer) darkLayer = document.createElement('canvas');
      const s = 0.5;                                  // слой в половину разрешения — мягче и быстрее
      const dw = Math.max(1, Math.round(width * s)), dh = Math.max(1, Math.round(height * s));
      if (darkLayer.width !== dw || darkLayer.height !== dh) { darkLayer.width = dw; darkLayer.height = dh; }
      const d = darkLayer.getContext('2d');
      d.setTransform(1, 0, 0, 1, 0, 0);
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, dw, dh);
      d.fillStyle = 'rgba(4,6,14,0.8)';
      d.fillRect(0, 0, dw, dh);
      d.setTransform(s, 0, 0, s, 0, 0);
      d.globalCompositeOperation = 'destination-out';
      const halo = 4.2 * cam.ppm;
      d.drawImage(window.FX.puff('rgba(0,0,0,1)'), p.x - halo, p.y - halo, halo * 2, halo * 2);
      for (const [k, al] of [[1.25, 0.35], [1, 0.45], [0.7, 0.6]]) {
        const cone = d.createRadialGradient(p.x, p.y, 0, p.x, p.y, len);
        cone.addColorStop(0, `rgba(0,0,0,${al})`);
        cone.addColorStop(0.7, `rgba(0,0,0,${al * 0.8})`);
        cone.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = cone;
        d.beginPath(); d.moveTo(p.x, p.y); d.arc(p.x, p.y, len, a - spread * k, a + spread * k); d.closePath(); d.fill();
      }
      ctx.drawImage(darkLayer, 0, 0, width, height);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, len);
      g.addColorStop(0, 'rgba(255,240,190,0.12)');
      g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, len, a - spread, a + spread); ctx.closePath(); ctx.fill();
    }
  }

  function drawBridge(m) {
    // Перила и опоры моста.
    ctx.strokeStyle = '#5a5a56';
    ctx.lineWidth = 0.08;
    for (const [a, b] of [[m.x, m.gapX - 0.5], [m.gapX + m.gapW + 0.5, m.x + m.w]]) {
      ctx.beginPath(); ctx.moveTo(a, m.y + 1.1); ctx.lineTo(b, m.y + 1.1); ctx.stroke();
      for (let x = a; x <= b; x += 1.5) { ctx.beginPath(); ctx.moveTo(x, m.y); ctx.lineTo(x, m.y + 1.1); ctx.stroke(); }
    }
    ctx.fillStyle = '#4a4a46';
    for (const x of [m.x + 5, m.gapX - 3, m.gapX + m.gapW + 3, m.x + m.w - 5]) ctx.fillRect(x - 0.6, m.y - m.depth - 2, 1.2, m.depth + 2 - 0.4);
    // Торчащая арматура на обломках.
    ctx.strokeStyle = '#6a4a3a';
    ctx.lineWidth = 0.05;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(m.gapX, m.y - 0.2 - i * 0.15); ctx.lineTo(m.gapX + 0.6 + i * 0.2, m.y - 0.6 - i * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.gapX + m.gapW, m.y - 0.2 - i * 0.15); ctx.lineTo(m.gapX + m.gapW - 0.5 - i * 0.2, m.y - 0.7 - i * 0.25); ctx.stroke();
    }
  }

  function drawPlatform(p) {
    // Эстакада: бетонный настил на опорах (опоры — только картинка).
    ctx.fillStyle = '#56544e';
    for (let x = p.x + 4; x < p.x + p.w - 2; x += 18) {
      ctx.fillRect(x, p.y - 30, 0.9, 30 - p.h);
    }
    ctx.fillStyle = '#6a6862';
    ctx.fillRect(p.x, p.y - p.h, p.w, p.h);
    ctx.fillStyle = '#3c3a36';
    ctx.fillRect(p.x, p.y - 0.15, p.w, 0.15);
    ctx.strokeStyle = '#7a7872';
    ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(p.x, p.y + 0.9); ctx.lineTo(p.x + p.w, p.y + 0.9); ctx.stroke();
  }

  function drawCheckpoint(m, reached) {
    ctx.fillStyle = '#4a4a46';
    ctx.fillRect(m.x - 0.08, m.y, 0.16, 4.5);
    ctx.fillStyle = reached ? '#8fd06a' : '#d0a640';
    ctx.beginPath();
    ctx.moveTo(m.x + 0.08, m.y + 4.5);
    ctx.lineTo(m.x + 1.8, m.y + 4.0);
    ctx.lineTo(m.x + 0.08, m.y + 3.5);
    ctx.closePath();
    ctx.fill();
  }

  // Стаб: стена из бетонных блоков, ворота, вышка.
  function drawStab(m, sideLeft) {
    const x = m.x;
    const wx = sideLeft ? x - 14 : x + 2, ww = sideLeft ? 12 : 40;
    ctx.fillStyle = '#5a5850';
    ctx.fillRect(wx, m.y, ww, 4);
    // Бетонные блоки и колючка по гребню.
    ctx.strokeStyle = 'rgba(30,28,24,0.5)';
    ctx.lineWidth = 0.06;
    for (let bx = wx; bx < wx + ww; bx += 2) for (let by = m.y; by < m.y + 4; by += 1) {
      ctx.strokeRect(bx + ((by - m.y) % 2 ? 1 : 0), by, 2, 1);
    }
    ctx.strokeStyle = '#8a8a80';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let bx = wx; bx < wx + ww; bx += 0.4) ctx.lineTo(bx, m.y + 4.3 + ((bx * 5) % 2 > 1 ? 0.15 : 0));
    ctx.stroke();
    // Ворота.
    ctx.fillStyle = '#3a4a2a';
    ctx.fillRect(x - 1.5, m.y, 0.4, 6);
    ctx.fillRect(x + 1.1, m.y, 0.4, 6);
    ctx.fillStyle = '#8a2a20';
    ctx.fillRect(x - 1.5, m.y + 5.6, 3, 0.4);
    // Вышка.
    const tx = sideLeft ? x - 8 : x + 8;
    ctx.fillStyle = '#4a3e30';
    ctx.fillRect(tx - 0.1, m.y + 5, 0.2, 4);
    ctx.fillRect(tx + 1.9, m.y + 5, 0.2, 4);
    ctx.fillStyle = '#5a4a38';
    ctx.fillRect(tx - 0.3, m.y + 9, 2.6, 1.4);
  }

  function drawObstacle(b) {
    const u = b.getUserData();
    const p = b.getPosition();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(b.getAngle());
    if (u.type === 'crate') {
      ctx.fillStyle = u.shade > 5 ? '#7a5a34' : '#8a6a3c';
      ctx.fillRect(-u.w / 2, -u.h / 2, u.w, u.h);
      ctx.strokeStyle = '#4a3420';
      ctx.lineWidth = 0.06;
      ctx.strokeRect(-u.w / 2 + 0.04, -u.h / 2 + 0.04, u.w - 0.08, u.h - 0.08);
      ctx.beginPath(); ctx.moveTo(-u.w / 2, -u.h / 2); ctx.lineTo(u.w / 2, u.h / 2); ctx.stroke();
    } else if (u.type === 'sandbag') {
      ctx.fillStyle = '#8a7a5a';
      ctx.beginPath(); ctx.ellipse(0, 0, u.w / 2, u.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6a5a3e';
      ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(-u.w * 0.3, 0); ctx.lineTo(u.w * 0.3, 0); ctx.stroke();
    } else if (u.type === 'plank') {
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-u.w / 2, -u.h / 2, u.w, u.h);
    } else if (u.type === 'barrel') {
      ctx.fillStyle = ['#4a5a3a', '#7a3a2a', '#3a4a5a'][u.rust];
      ctx.beginPath(); ctx.arc(0, 0, u.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(0, 0, u.r * 0.65, 0, Math.PI * 2); ctx.stroke();
    } else if (u.type === 'log') {
      // Торец бревна с годичными кольцами или торец трубы.
      const r = u.r;
      ctx.rotate(u.turn);
      ctx.fillStyle = u.pipe ? '#5e6266' : '#4a3220';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = u.pipe ? '#1e2022' : '#b08a5a';
      ctx.beginPath(); ctx.arc(0, 0, r * (u.pipe ? 0.72 : 0.82), 0, Math.PI * 2); ctx.fill();
      if (!u.pipe) {
        ctx.strokeStyle = '#8a6a40';
        ctx.lineWidth = 0.025;
        for (const k of [0.25, 0.45, 0.65]) { ctx.beginPath(); ctx.arc(0.02, 0.01, r * k, 0, Math.PI * 2); ctx.stroke(); }
        ctx.strokeStyle = '#5a3e26';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.7, r * 0.2); ctx.stroke();
      }
    } else if (u.type === 'wreck') {
      const sh = u.shape, h = u.h / 2;
      ctx.fillStyle = u.color;
      ctx.beginPath();
      sh.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      // Стекло кабины, ржавчина, полоса порога, колёса.
      ctx.fillStyle = '#1a2024';
      ctx.beginPath();
      ctx.moveTo(sh[4][0] - 0.1, h - 0.12); ctx.lineTo(sh[3][0] - 0.05, h - 0.12);
      ctx.lineTo(sh[3][0] + 0.45, h * 0.35); ctx.lineTo(sh[4][0] - 0.55, h * 0.35);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(100,50,25,0.55)';
      ctx.fillRect(-u.w * 0.35, -h * 0.7, u.w * 0.25, h * 0.45);
      ctx.fillRect(u.w * 0.15, -h * 0.6, u.w * 0.12, h * 0.35);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-u.w / 2 + 0.3, -h, u.w - 0.6, 0.1);
      ctx.fillStyle = '#121212';
      ctx.beginPath(); ctx.arc(-u.w * 0.3, -h, 0.32, 0, Math.PI); ctx.arc(u.w * 0.3, -h, 0.32, 0, Math.PI); ctx.fill();
    }
    ctx.restore();
  }

  // --- Заражённые: силуэт по виду, ноги шагают, мёртвые лежат/летят ---
  function drawZombie(z, p, angle, t) {
    const d = z.def, h = d.h, w = d.w;
    const alive = z.alive && !z.clingAt;
    const swing = alive ? Math.sin(z.phase * (z.kind === 'runner' || z.kind === 'ruber' ? 2.2 : 1.2)) : 0.4;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.scale(z.facing || -1, 1);
    if (z.stomped) ctx.translate(0, -z.stomped * 0.4);
    const flash = z.hitFlash > 0;
    const dead = !z.alive && !z.clingAt;
    const torso = flash ? '#e05040' : dead ? shade(d.color, -30) : d.color;
    const skin = flash ? '#f08070' : dead ? shade(d.skin, -40) : d.skin;
    const lw = Math.max(0.12, w * (z.kind === 'stomper' || z.kind === 'elite' ? 0.32 : 0.24));
    ctx.lineCap = 'round';
    // Ноги.
    ctx.strokeStyle = shade(d.color, -25);
    ctx.lineWidth = lw;
    const hip = -h * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, hip); ctx.lineTo(swing * w * 0.6, -h / 2 + 0.05);
    ctx.moveTo(0, hip); ctx.lineTo(-swing * w * 0.6, -h / 2 + 0.05);
    ctx.stroke();
    // Туловище, сгорбленное вперёд.
    const lean = z.kind === 'runner' || z.kind === 'ruber' ? 0.35 : 0.18;
    ctx.fillStyle = torso;
    ctx.beginPath();
    ctx.moveTo(-w / 2, hip);
    ctx.lineTo(w / 2, hip);
    ctx.lineTo(w / 2 + lean * w, h * 0.32);
    ctx.lineTo(-w / 2 + lean * w, h * 0.34);
    ctx.closePath();
    ctx.fill();
    // Рваньё одежды.
    ctx.fillStyle = shade(d.color, -40);
    ctx.fillRect(-w / 2, hip, w * 0.3, h * 0.08);
    // Руки тянутся вперёд.
    ctx.strokeStyle = skin;
    ctx.lineWidth = lw * 0.85;
    const shoulder = h * 0.28;
    const reach = z.kind === 'stomper' || z.kind === 'elite' ? 0.9 : 0.75;
    ctx.beginPath();
    ctx.moveTo(lean * w, shoulder); ctx.lineTo(w * 0.5 + h * 0.28 * reach, shoulder - 0.15 + swing * 0.1);
    ctx.moveTo(lean * w, shoulder - 0.05); ctx.lineTo(w * 0.45 + h * 0.25 * reach, shoulder - 0.3 - swing * 0.1);
    ctx.stroke();
    // Голова.
    const hr = Math.max(0.16, Math.min(w * 0.42, z.kind === 'elite' ? 0.62 : z.kind === 'stomper' ? 0.4 : 0.32));
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(lean * w + 0.08, shoulder + hr * 1.1, hr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c03020';
    ctx.fillRect(lean * w + 0.08 + hr * 0.3, shoulder + hr * 1.2, hr * 0.35, hr * 0.25);
    // Особенности вида.
    if (z.kind === 'lottery' || z.kind === 'stomper' || z.kind === 'elite') {
      ctx.fillStyle = shade(d.color, -30);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(-w * 0.25 + i * w * 0.18, hip + h * (0.1 + (i % 2) * 0.12), w * 0.14, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (d.plates) {
      ctx.fillStyle = d.plates;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.3 + i * w * 0.25, h * 0.05 + i * h * 0.08);
        ctx.lineTo(-w * 0.1 + i * w * 0.25, h * 0.15 + i * h * 0.08);
        ctx.lineTo(-w * 0.3 + i * w * 0.25, h * 0.22 + i * h * 0.08);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(lean * w + 0.08, shoulder + hr * 1.4, hr * 0.9, Math.PI * 0.1, Math.PI * 0.9); ctx.fill();
    }
    ctx.restore();
  }

  function drawZombieHp(z, p) {
    if (!z.alive || z.hp >= z.def.hp || z.def.hp < 50) return;
    const w = Math.max(1, z.def.w * 1.4);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - w / 2, p.y + z.def.h / 2 + 0.3, w, 0.12);
    ctx.fillStyle = '#d84a3a';
    ctx.fillRect(p.x - w / 2, p.y + z.def.h / 2 + 0.3, w * Math.max(0, z.hp) / z.def.hp, 0.12);
  }

  // Частицы и эффекты — в fx.js; здесь — для совместимости вызовов.
  function particles(scene, dt) { window.FX.update(scene, dt); }
  function blood(scene, x, y, n, vx) { window.FX.blood(scene, x, y, n, vx); }
  const dustColor = () => (style ? style.dust : 'rgba(150,140,125,0.5)');

  function shade(hex, amt) { return window.CarDraw.shade(hex, amt); }

  function draw(scene, t) {
    if (!theme) setTheme(scene.level.theme);
    const dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    // Тряска затухает; смещение камеры случайное в пределах амплитуды.
    cam.shake = Math.max(0, cam.shake - dt * window.CONFIG.FX.shakeDecay);
    cam.sx = (Math.random() - 0.5) * 2 * cam.shake;
    cam.sy = (Math.random() - 0.5) * 2 * cam.shake;
    screenTransform();
    drawSky(t);
    drawParallax();
    worldTransform();
    const v = viewX();
    const terr = scene.terrain;
    for (const m of terr.marks) if (m.type === 'water') drawWater(m, t);
    for (const m of terr.marks) if (m.type === 'bridge' && m.x < v.r && m.x + m.w > v.l) drawBridge(m);
    for (const p of terr.platforms) if (p.x < v.r && p.x + p.w > v.l) drawPlatform(p);
    drawGround(terr);
    window.FX.drawDecals(ctx, scene, v);
    for (const m of terr.marks) if (m.type === 'ford' && m.x < v.r && m.x + m.w > v.l) drawFord(m, t);
    drawStab({ x: -6, y: terr.heightAt(-6) }, true);
    if (terr.stab && terr.stab.x - 50 < v.r) drawStab(terr.stab, false);
    for (const m of terr.marks) {
      if (m.type === 'checkpoint' && m.x > v.l && m.x < v.r) drawCheckpoint(m, scene.checkpoint >= m.index);
    }
    for (const b of scene.obstacles) {
      const p = b.getPosition();
      if (p.x > v.l - 3 && p.x < v.r + 3) drawObstacle(b);
    }
    scene.pickups.draw(ctx, t);
    // Тени: под заражёнными и под машиной (на земле под ней, бледнее в прыжке).
    scene.horde.each((z, p) => {
      if (p.x < v.l - 3 || p.x > v.r + 3) return;
      const gy = terr.heightAt(p.x);
      window.FX.shadow(ctx, p.x, gy, p.y - z.def.h / 2 - gy, z.def.w * 2.4);
    });
    const car = scene.car, cp = car.pos, cgy = terr.heightAt(cp.x);
    window.FX.shadow(ctx, cp.x, cgy, cp.y - cgy - 0.6, (car.def.anchors.front - car.def.anchors.rear) * 1.25);
    scene.horde.each((z, p, a) => { if (p.x > v.l - 3 && p.x < v.r + 3) { drawZombie(z, p, a, t); drawZombieHp(z, p); } });
    window.CarDraw.draw(ctx, scene.car, t);
    if (scene.weapons) scene.weapons.drawWorld(ctx);
    // Бегуны, вцепившиеся в машину.
    for (const z of scene.horde.clinging) {
      const p = scene.car.chassis.getWorldPoint(window.planck.Vec2(z.clingAt.x, z.clingAt.y + z.def.h * 0.35));
      drawZombie(Object.assign({}, z, { facing: 1, stomped: 0 }), p, scene.car.angle - 0.5 + Math.sin(z.phase) * 0.25, t);
    }
    window.FX.draw(ctx, scene);
    if (scene.mines) for (const m of scene.mines) drawMine(m, t);
    screenTransform();
    drawMotes(t);
    drawVisibility(scene);
    drawVignette();
  }

  function drawMine(m, t) {
    if (m.boom != null) {
      const r = (0.4 - m.boom) * 12 + 1;
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
      g.addColorStop(0, 'rgba(255,230,140,0.9)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(m.x - r, m.y - r, r * 2, r * 2);
      return;
    }
    ctx.fillStyle = '#3a3c34';
    ctx.fillRect(m.x - 0.25, m.y, 0.5, 0.12);
    ctx.fillStyle = m.armed > 0 || Math.sin(t * 8) > 0 ? '#e03020' : '#601010';
    ctx.fillRect(m.x - 0.05, m.y + 0.12, 0.1, 0.06);
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  window.Render = { init, resize, draw, updateCamera, snapCamera, toScreen, setTheme, particles, blood, shake, dustColor, cam, rng };
})();
