// Отрисовка заезда: небо, параллакс-фон кластера, земля, объекты, машина.
// Мир рисуется в метрах с осью y вверх: трансформация холста переворачивает ось.
(function () {
  let ctx, width = 0, height = 0, dpr = 1;
  const cam = { x: 0, y: 0, ppm: 40, vx: 0 };
  let theme = null;
  let bgCache = null;

  function init(canvas) { ctx = canvas.getContext('2d'); }
  function resize(w, h, ratio) { width = w; height = h; dpr = ratio; }
  function setTheme(t) { theme = t; bgCache = null; }

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
  function buildBackground(kind) {
    const rand = rng(kind.length * 97 + 7);
    const layers = [];
    if (kind === 'city') {
      const far = [], mid = [];
      for (let x = -50; x < 4000; x += 6 + rand() * 10) far.push({ x, w: 5 + rand() * 9, h: 8 + rand() * 22, broken: rand() < 0.35 });
      for (let x = -50; x < 4000; x += 10 + rand() * 18) mid.push({ x, w: 6 + rand() * 10, h: 5 + rand() * 12, broken: rand() < 0.5 });
      layers.push({ k: 0.15, scale: 0.35, items: far, color: '#5a6068', windows: '#6c7278' });
      layers.push({ k: 0.35, scale: 0.5, items: mid, color: '#3e434a', windows: '#4c5158' });
    }
    return layers;
  }

  function drawSky() {
    const s = theme.sky;
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, s[0]);
    g.addColorStop(0.55, s[1]);
    g.addColorStop(1, s[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    const sx = width * 0.78, sy = height * 0.22;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, height * 0.35);
    sg.addColorStop(0, 'rgba(255,240,200,0.5)');
    sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, width, height);
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
        if (x + w < 0 || x > width) continue;
        const h = b.h * scale;
        const y = horizon - h + cam.y * L.k * 2;
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
    ctx.strokeStyle = theme.road;
    ctx.lineWidth = 0.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - 0.2) : ctx.moveTo(p[0], p[1] - 0.2)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,190,170,0.35)';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,16,12,0.45)';
    for (const p of pts) {
      const h = Math.abs(Math.sin(p[0] * 12.9898) * 43758.5453) % 1;
      if (h < 0.3) ctx.fillRect(p[0], p[1] - 0.6 - h * 3, 0.25 + h, 0.15);
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
    } else if (u.type === 'wreck') {
      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.moveTo(-u.w / 2, -u.h / 2);
      ctx.lineTo(u.w / 2, -u.h / 2);
      ctx.lineTo(u.w / 2, 0);
      ctx.lineTo(u.w * 0.2, u.h * 0.1);
      ctx.lineTo(0, u.h / 2);
      ctx.lineTo(-u.w * 0.35, u.h / 2);
      ctx.lineTo(-u.w / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a2024';
      ctx.fillRect(-u.w * 0.3, 0.05, u.w * 0.25, u.h * 0.32);
      ctx.fillStyle = 'rgba(100,50,25,0.55)';
      ctx.fillRect(-u.w * 0.45, -u.h * 0.4, u.w * 0.3, u.h * 0.25);
      ctx.fillStyle = '#121212';
      ctx.beginPath(); ctx.arc(-u.w * 0.3, -u.h / 2, 0.35, 0, Math.PI * 2); ctx.arc(u.w * 0.3, -u.h / 2, 0.35, 0, Math.PI * 2); ctx.fill();
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

  // Частицы (кровь, искры): в метрах, с гравитацией.
  function particles(scene, dt) {
    for (const q of scene.particles) {
      q.vy -= 14 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.t -= dt;
      const g = scene.terrain.heightAt(q.x);
      if (q.y < g) { q.y = g; q.vx *= 0.3; q.vy = 0; }
    }
    scene.particles = scene.particles.filter((q) => q.t > 0);
  }

  function blood(scene, x, y, n, vx) {
    for (let i = 0; i < n && scene.particles.length < 300; i++) {
      scene.particles.push({ x, y, vx: (vx || 0) * 0.4 + (Math.random() - 0.3) * 6, vy: Math.random() * 6, t: 0.8 + Math.random() * 1.2, r: 0.05 + Math.random() * 0.09, c: Math.random() < 0.7 ? '#7a1010' : '#4a8a3a' });
    }
  }

  function shade(hex, amt) { return window.CarDraw.shade(hex, amt); }

  function draw(scene, t) {
    if (!theme) setTheme(scene.level.theme);
    screenTransform();
    drawSky();
    drawParallax();
    worldTransform();
    const v = viewX();
    const terr = scene.terrain;
    for (const m of terr.marks) if (m.type === 'water') drawWater(m, t);
    for (const m of terr.marks) if (m.type === 'bridge' && m.x < v.r && m.x + m.w > v.l) drawBridge(m);
    for (const p of terr.platforms) if (p.x < v.r && p.x + p.w > v.l) drawPlatform(p);
    drawGround(terr);
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
    scene.horde.each((z, p, a) => { if (p.x > v.l - 3 && p.x < v.r + 3) { drawZombie(z, p, a, t); drawZombieHp(z, p); } });
    window.CarDraw.draw(ctx, scene.car, t);
    // Бегуны, вцепившиеся в машину.
    for (const z of scene.horde.clinging) {
      const p = scene.car.chassis.getWorldPoint(window.planck.Vec2(z.clingAt.x, z.clingAt.y + z.def.h * 0.35));
      drawZombie(Object.assign({}, z, { facing: 1, stomped: 0 }), p, scene.car.angle - 0.5 + Math.sin(z.phase) * 0.25, t);
    }
    for (const q of scene.particles) { ctx.fillStyle = q.c; ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2); }
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

  window.Render = { init, resize, draw, updateCamera, snapCamera, toScreen, setTheme, particles, blood, cam, rng };
})();
