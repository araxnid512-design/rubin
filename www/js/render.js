// Отрисовка сцены сверху. Вся графика процедурная (до подключения ассетов из ASSETS.md).
(function () {
  const GPPM = 12; // разрешение кэша земли, пикселей на метр
  const { WALL } = window.Cell;

  let ctx, width = 0, height = 0, dpr = 1;
  let light, lctx;
  const cam = { x: 0, y: 0, ppm: 24 };

  function init(canvas) {
    ctx = canvas.getContext('2d');
    light = document.createElement('canvas');
    lctx = light.getContext('2d');
  }

  function resize(w, h, ratio) {
    width = w; height = h; dpr = ratio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    light.width = Math.ceil(w / 2);
    light.height = Math.ceil(h / 2);
  }

  const sx = (x) => (x - cam.x) * cam.ppm;
  const sy = (y) => (y - cam.y) * cam.ppm;
  const vis = (x, y, pad) => x > cam.x - pad && y > cam.y - pad && x < cam.x + width / cam.ppm + pad && y < cam.y + height / cam.ppm + pad;
  function disc(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx(x), sy(y), r * cam.ppm, 0, 6.2832); ctx.fill(); }
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(sx(x), sy(y), w * cam.ppm, h * cam.ppm); }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // --- Земля (кэш на карту) ---
  function ground(map) {
    if (map.groundCache) return map.groundCache;
    const c = document.createElement('canvas');
    c.width = map.w * GPPM;
    c.height = map.h * GPPM;
    const g = c.getContext('2d');
    const rand = window.rng(map.w * 31 + map.h);
    const s = GPPM;
    const city = map.kind === 'city';
    g.fillStyle = city ? '#4a4e3e' : '#46502f';
    g.fillRect(0, 0, c.width, c.height);
    const tones = city ? ['#53584a', '#43473a', '#4d4a3e', '#3e4436'] : ['#4f5a34', '#3e4a2c', '#56603a', '#424a30'];
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = tones[Math.floor(rand() * tones.length)];
      g.globalAlpha = 0.25;
      g.beginPath(); g.arc(rand() * c.width, rand() * c.height, 3 + rand() * 14, 0, 6.28); g.fill();
    }
    for (let i = 0; i < 30000; i++) {
      g.fillStyle = tones[Math.floor(rand() * tones.length)];
      g.globalAlpha = 0.5;
      g.fillRect(rand() * c.width, rand() * c.height, 1 + rand() * 2, 1 + rand() * 2);
    }
    g.globalAlpha = 1;

    if (map.kind === 'base') {
      // Бетон внутри части, плац с разметкой, огород.
      const n = map.inner;
      g.fillStyle = '#6a6a62';
      g.fillRect(n.x * s, n.y * s, n.w * s, n.h * s);
      for (let i = 0; i < 4000; i++) {
        g.fillStyle = rand() < 0.5 ? '#626259' : '#727269';
        g.fillRect((n.x + rand() * n.w) * s, (n.y + rand() * n.h) * s, 2, 2);
      }
      g.strokeStyle = 'rgba(40,40,36,0.15)';
      for (let x = n.x; x < n.x + n.w; x += 3) { g.beginPath(); g.moveTo(x * s, n.y * s); g.lineTo(x * s, (n.y + n.h) * s); g.stroke(); }
      for (let y = n.y; y < n.y + n.h; y += 3) { g.beginPath(); g.moveTo(n.x * s, y * s); g.lineTo((n.x + n.w) * s, y * s); g.stroke(); }
      const p = map.plac;
      g.fillStyle = '#5a5a54';
      g.fillRect(p.x * s, p.y * s, p.w * s, p.h * s);
      g.strokeStyle = 'rgba(230,225,210,0.55)';
      g.lineWidth = 2;
      g.strokeRect((p.x + 1) * s, (p.y + 1) * s, (p.w - 2) * s, (p.h - 2) * s);
      for (let x = p.x + 3; x < p.x + p.w - 2; x += 2.5) {
        g.beginPath(); g.moveTo(x * s, (p.y + 2) * s); g.lineTo(x * s, (p.y + 3) * s); g.stroke();
      }
      if (map.garden) {
        const gd = map.garden;
        g.fillStyle = '#4a3a28';
        g.fillRect(gd.x * s, gd.y * s, gd.w * s, gd.h * s);
        g.fillStyle = '#5a8a3a';
        for (let y = gd.y + 0.7; y < gd.y + gd.h; y += 1.4) g.fillRect((gd.x + 0.5) * s, y * s, (gd.w - 1) * s, 0.4 * s);
      }
    }

    for (const r of map.roads) {
      g.fillStyle = '#3e3e3a';
      g.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
      g.fillStyle = 'rgba(220,210,170,0.3)';
      if (r.h > r.w) for (let y = r.y; y < r.y + r.h; y += 4) g.fillRect((r.x + r.w / 2) * s - 1, y * s, 2, 2 * s);
      else for (let x = r.x; x < r.x + r.w; x += 4) g.fillRect(x * s, (r.y + r.h / 2) * s - 1, 2 * s, 2);
    }
    // Трещины асфальта.
    g.strokeStyle = 'rgba(15,15,12,0.25)';
    g.lineWidth = 1;
    for (let i = 0; i < 120 && map.roads.length; i++) {
      const r = map.roads[Math.floor(rand() * map.roads.length)];
      let x = (r.x + rand() * r.w) * s, y = (r.y + rand() * r.h) * s;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += (rand() - 0.5) * 8; y += (rand() - 0.5) * 8; g.lineTo(x, y); }
      g.stroke();
    }
    // Тротуары и тени зданий.
    for (const b of map.buildings) {
      if (city && b.kind !== 'stall' && b.kind !== 'container') {
        g.fillStyle = '#6a685e';
        g.fillRect((b.x - 1) * s, (b.y - 1) * s, (b.w + 2) * s, (b.h + 2) * s);
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect((b.x + 0.5) * s, (b.y + 0.5) * s, b.w * s, b.h * s);
    }
    if (map.exit) {
      const e = map.exit;
      g.strokeStyle = 'rgba(120,200,120,0.6)';
      g.setLineDash([8, 6]);
      g.lineWidth = 3;
      g.strokeRect(e.x * s, e.y * s, e.w * s, (e.h - 0.2) * s);
      g.setLineDash([]);
      g.fillStyle = 'rgba(120,200,120,0.8)';
      g.font = `bold ${s * 1.1}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText('ЭВАКУАЦИЯ', (e.x + e.w / 2) * s, (e.y + e.h - 1.4) * s);
    }
    map.groundCache = c;
    return c;
  }

  // --- Объекты ---
  function drawBuilding(b) {
    const x = sx(b.x), y = sy(b.y), w = b.w * cam.ppm, h = b.h * cam.ppm;
    ctx.fillStyle = b.roof;
    ctx.fillRect(x, y, w, h);
    if (b.kind === 'house') {
      ctx.fillStyle = shade(b.roof, -20);
      if (b.w >= b.h) ctx.fillRect(x, y + h / 2, w, h / 2); else ctx.fillRect(x + w / 2, y, w / 2, h);
    } else if (b.kind === 'stall') {
      ctx.fillStyle = shade(b.roof, 25);
      for (let i = 0; i < w; i += 6) ctx.fillRect(x + i, y, 3, h);
    } else if (b.kind === 'container') {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      for (let i = 3; i < Math.max(w, h); i += 4) {
        ctx.beginPath();
        if (w > h) { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); } else { ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i); }
        ctx.stroke();
      }
    } else {
      // Плоская крыша панельки: парапет, вентиляция, рубероид.
      ctx.strokeStyle = shade(b.roof, -30);
      ctx.lineWidth = Math.max(1, cam.ppm * 0.3);
      ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      ctx.fillStyle = shade(b.roof, -15);
      const step = Math.max(4, Math.floor(b.w / 4)) * cam.ppm;
      for (let i = step / 2; i < w - 4; i += step) ctx.fillRect(x + i, y + h * 0.35, cam.ppm * 0.9, cam.ppm * 0.9);
    }
    if (b.label && cam.ppm > 8) {
      const fs = Math.max(9, Math.min(cam.ppm * 0.9, 18));
      ctx.font = `bold ${fs}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(b.label, x + w / 2 + 1, y + h / 2 + fs / 3 + 1);
      ctx.fillStyle = '#e8e2d0';
      ctx.fillText(b.label, x + w / 2, y + h / 2 + fs / 3);
      ctx.textAlign = 'left';
    }
  }

  function drawCar(c) {
    const x = sx(c.x) + 2, y = sy(c.y) + 2, w = c.w * cam.ppm - 4, h = c.h * cam.ppm - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = c.color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#20262a';
    if (c.vertical) { ctx.fillRect(x + 2, y + h * 0.22, w - 4, h * 0.16); ctx.fillRect(x + 2, y + h * 0.68, w - 4, h * 0.1); }
    else { ctx.fillRect(x + w * 0.22, y + 2, w * 0.16, h - 4); ctx.fillRect(x + w * 0.68, y + 2, w * 0.1, h - 4); }
  }

  function drawTree(t) {
    const x = sx(t.x), y = sy(t.y), r = t.r * cam.ppm;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.25, r, 0, 6.28); ctx.fill();
    const base = t.shade < 0.5 ? '#2a3d24' : '#33482a';
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = shade(base, k * 14);
      ctx.beginPath(); ctx.arc(x - k * r * 0.12, y - k * r * 0.12, r * (1 - k * 0.27), 0, 6.28); ctx.fill();
    }
  }

  function drawWalls(map, grid) {
    for (const c of map.wallCells) {
      const i = grid.idx(c.x, c.y);
      if (!vis(c.x, c.y, 2)) continue;
      const alive = grid.type[i] === WALL;
      const k = alive ? grid.wallHp[i] / grid.wallMax[i] : 0;
      if (!alive) { rect(c.x, c.y, 1, 1, '#3a3632'); continue; }
      if (c.gate) {
        rect(c.x, c.y + 0.2, 1, 0.6, k > 0.5 ? '#5a6a4a' : '#6a5a3a');
        ctx.fillStyle = '#c62828';
        ctx.fillRect(sx(c.x + 0.45), sy(c.y + 0.2), cam.ppm * 0.1, cam.ppm * 0.6);
      } else {
        rect(c.x, c.y, 1, 1, k > 0.66 ? '#8a8a80' : k > 0.33 ? '#8a7a66' : '#8a5a4a');
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.strokeRect(sx(c.x), sy(c.y), cam.ppm, cam.ppm);
      }
    }
    // Колючая проволока по гребню.
    ctx.strokeStyle = 'rgba(200,200,190,0.35)';
    ctx.lineWidth = 1;
    const { x0, y0, x1, y1 } = map.wallRect;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(sx(x0 + 0.5), sy(y0 + 0.5), (x1 - x0) * cam.ppm, (y1 - y0) * cam.ppm);
    ctx.setLineDash([]);
  }

  function drawTower(t) {
    const x = sx(t.x - 1.2), y = sy(t.y - 1.2), s = 2.4 * cam.ppm;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 4, y + 4, s, s);
    ctx.fillStyle = '#5a4a36';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#6e5c44';
    ctx.fillRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76);
    ctx.strokeStyle = '#3a3024';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, s, s);
  }

  function drawLoot(l, t) {
    if (l.taken) return;
    const pulse = 0.5 + Math.sin(t * 4 + l.x) * 0.5;
    disc(l.x, l.y, 0.75, `rgba(255,210,90,${0.15 + pulse * 0.15})`);
    const kind = Object.keys(l.items)[0];
    const colors = { food: '#c9a050', meds: '#e05050', materials: '#a08060', ammo: '#d0b040', rifles: '#6a6a5a' };
    rect(l.x - 0.4, l.y - 0.3, 0.8, 0.6, '#4a3e2a');
    rect(l.x - 0.3, l.y - 0.2, 0.6, 0.4, colors[kind] || '#aaa');
  }

  function body(x, y, angle, r, color, head, opts) {
    ctx.save();
    ctx.translate(sx(x), sy(y));
    ctx.rotate(angle);
    const R = r * cam.ppm;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 2, R * 0.9, R * 1.1, 0, 0, 6.28); ctx.fill();
    if (opts.arms) {
      ctx.strokeStyle = color;
      ctx.lineWidth = R * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.6); ctx.lineTo(R * 1.3, -R * 0.45);
      ctx.moveTo(0, R * 0.6); ctx.lineTo(R * 1.3, R * 0.45);
      ctx.stroke();
    }
    if (opts.rifle) {
      ctx.strokeStyle = '#1e1e1a';
      ctx.lineWidth = Math.max(1.5, R * 0.28);
      ctx.beginPath(); ctx.moveTo(R * 0.2, R * 0.35); ctx.lineTo(R * 1.9, R * 0.35); ctx.stroke();
    }
    ctx.fillStyle = opts.flash ? '#e05040' : color;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.68, R * 1.05, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.arc(R * 0.1, 0, R * 0.48, 0, 6.28); ctx.fill();
    if (opts.band) { ctx.fillStyle = opts.band; ctx.fillRect(-R * 0.15, -R * 0.48, R * 0.25, R * 0.96); }
    ctx.restore();
  }

  function hpBar(e, max, r) {
    if (e.hp >= max) return;
    const w = Math.max(14, r * 2 * cam.ppm), x = sx(e.x) - w / 2, y = sy(e.y) - r * cam.ppm - 7;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = e.hp / max > 0.5 ? '#7ac04a' : '#d84a3a'; ctx.fillRect(x, y, w * Math.max(0, e.hp) / max, 3);
  }

  // --- Кадр ---
  function draw(scene, t, opts) {
    const map = scene.map;
    cam.x = opts.camX + (Math.random() - 0.5) * scene.fx.shake * 0.3;
    cam.y = opts.camY + (Math.random() - 0.5) * scene.fx.shake * 0.3;
    cam.ppm = opts.ppm;
    const D = window.GameData;

    ctx.fillStyle = '#1a1c16';
    ctx.fillRect(0, 0, width, height);
    const g = ground(map);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(g, cam.x * GPPM, cam.y * GPPM, width / cam.ppm * GPPM, height / cam.ppm * GPPM, 0, 0, width, height);

    for (const b of scene.fx.blood) if (vis(b.x, b.y, 1)) { ctx.globalAlpha = Math.min(1, b.t / 20) * 0.7; disc(b.x, b.y, b.r, '#4a1010'); }
    ctx.globalAlpha = 1;
    for (const c of scene.fx.corpses) {
      if (!vis(c.x, c.y, 2)) continue;
      ctx.globalAlpha = Math.min(1, c.t / 5);
      ctx.save();
      ctx.translate(sx(c.x), sy(c.y)); ctx.rotate(c.angle);
      ctx.fillStyle = shade(c.color, -30);
      ctx.beginPath(); ctx.ellipse(0, 0, c.r * 1.3 * cam.ppm, c.r * 0.7 * cam.ppm, 0, 0, 6.28); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const l of scene.loot) if (vis(l.x, l.y, 1)) drawLoot(l, t);
    for (const c of map.cars) if (vis(c.x, c.y, 5)) drawCar(c);
    // Деревья под юнитами: тактическая ясность важнее «честной» кроны.
    for (const tr of map.trees) if (vis(tr.x, tr.y, tr.r + 1)) drawTree(tr);
    if (map.kind === 'base') drawWalls(map, scene.grid);

    // Точка приказа.
    if (scene.order && scene.mode === 'sortie') {
      ctx.strokeStyle = scene.retreating ? 'rgba(120,220,120,0.7)' : 'rgba(255,220,120,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(scene.order.x), sy(scene.order.y), cam.ppm * (0.8 + Math.sin(t * 5) * 0.15), 0, 6.28); ctx.stroke();
    }

    for (const v of scene.survivors) {
      if (v.hp <= 0 || !vis(v.x, v.y, 2)) continue;
      body(v.x, v.y, v.angle, D.SURVIVOR.radius, '#5a5a8a', '#d0b090', { flash: v.hitFlash > 0 });
      if (v.state === 'hiding') {
        ctx.fillStyle = '#ffd34d';
        ctx.font = `bold ${Math.max(12, cam.ppm * 0.9)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('?', sx(v.x), sy(v.y) - cam.ppm * 0.6);
        ctx.textAlign = 'left';
      }
    }
    for (const z of scene.zombies) {
      if (z.delay > 0 || !vis(z.x, z.y, 2)) continue;
      const wob = Math.sin(t * 7 + z.seed * 10) * 0.15;
      body(z.x, z.y, z.angle + wob, z.type.radius, z.type.color, shade(z.type.color, 15), { arms: true, flash: z.hitFlash > 0 });
      hpBar(z, z.maxHp, z.type.radius);
    }
    for (const m of scene.marauders) {
      if (!vis(m.x, m.y, 2)) continue;
      body(m.x, m.y, m.angle, D.MARAUDER.radius, '#2e2e2e', '#c9a888', { rifle: true, band: '#a02020', flash: m.hitFlash > 0 });
      hpBar(m, D.MARAUDER.hp, D.MARAUDER.radius);
    }
    if (map.kind === 'base') for (const tw of map.towers) if (vis(tw.x, tw.y, 3)) drawTower(tw);
    for (const s of scene.soldiers) {
      if (s.hp <= 0 || s.asleep > 0 || !vis(s.x, s.y, 2)) continue;
      body(s.x, s.y, s.angle, D.SOLDIER.radius, '#4e5a36', '#3e4a2a', { rifle: true, flash: s.hitFlash > 0 });
      hpBar(s, D.SOLDIER.hp, D.SOLDIER.radius);
    }
    for (const f of scene.fx.flashes) disc(f.x, f.y, 0.3, 'rgba(255,220,120,0.9)');
    for (const tr of scene.fx.tracers) {
      ctx.strokeStyle = tr.enemy ? `rgba(255,120,90,${tr.t * 12})` : `rgba(255,235,160,${tr.t * 12})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx(tr.x1), sy(tr.y1)); ctx.lineTo(sx(tr.x2), sy(tr.y2)); ctx.stroke();
    }
    for (const b of map.buildings) if (vis(b.x, b.y, b.w + b.h)) drawBuilding(b);
    if (map.kind === 'base') drawFlag(map.flag, t);

    if (opts.night) drawNight(scene, opts.night);
  }

  function drawFlag(f, t) {
    const x = f.x, y = f.y;
    disc(x, y, 0.2, '#888');
    const w = 1.8 * cam.ppm, h = 1.1 * cam.ppm, wave = Math.sin(t * 3) * 2;
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(y));
    ctx.quadraticCurveTo(sx(x) + w / 2, sy(y) - h * 0.1 + wave, sx(x) + w, sy(y));
    ctx.lineTo(sx(x) + w, sy(y) + h);
    ctx.quadraticCurveTo(sx(x) + w / 2, sy(y) + h * 0.9 + wave, sx(x), sy(y) + h);
    ctx.closePath();
    ctx.fill();
  }

  // Ночь: темнота с вырезами света у бойцов, вышек и вспышек.
  function drawNight(scene, alpha) {
    const lw = light.width, lh = light.height, k = lw / width;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = `rgba(6,8,20,${alpha})`;
    lctx.fillRect(0, 0, lw, lh);
    lctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      const px = sx(x) * k, py = sy(y) * k, pr = r * cam.ppm * k;
      if (px < -pr || py < -pr || px > lw + pr || py > lh + pr) return;
      const g = lctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    };
    for (const s of scene.soldiers) if (s.hp > 0) hole(s.x, s.y, s.tower ? 16 : 6, s.tower ? 0.85 : 0.7);
    for (const f of scene.fx.flashes) hole(f.x, f.y, 5, 0.9);
    ctx.drawImage(light, 0, 0, width, height);
  }

  // Экран → мир.
  function toWorld(px, py) { return { x: px / cam.ppm + cam.x, y: py / cam.ppm + cam.y }; }

  window.Render = { init, resize, draw, toWorld, cam };
})();
