// Отрисовка: процедурная графика вида сверху (до подключения ассетов из ASSETS.md).
(function () {
  const W = window.World;
  const GROUND_PPM = 16;

  let ctx, light, lctx, width = 0, height = 0, ppm = 32;
  let ground;

  function init(canvas) {
    ctx = canvas.getContext('2d');
    light = document.createElement('canvas');
    lctx = light.getContext('2d');
    ground = buildGround();
  }

  function resize(w, h, dpr) {
    width = w;
    height = h;
    ppm = Math.max(26, Math.min(60, w / 22));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    light.width = Math.ceil(w / 2);
    light.height = Math.ceil(h / 2);
  }

  // --- Земля: трава, дороги, площадки. Рисуется один раз. ---
  function buildGround() {
    const c = document.createElement('canvas');
    c.width = W.W * GROUND_PPM;
    c.height = W.H * GROUND_PPM;
    const g = c.getContext('2d');
    const rand = W.rng(77);
    const s = GROUND_PPM;

    g.fillStyle = '#3d4a2c';
    g.fillRect(0, 0, c.width, c.height);
    // Пятна травы, земли, хвои.
    const tones = ['#46552f', '#36422a', '#4c5233', '#3a3f2b', '#53563a', '#2f3a26'];
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = tones[Math.floor(rand() * tones.length)];
      g.globalAlpha = 0.15 + rand() * 0.2;
      g.beginPath();
      g.arc(rand() * c.width, rand() * c.height, 4 + rand() * 18, 0, Math.PI * 2);
      g.fill();
    }
    // Мелкие травинки и сор — чтобы земля не выглядела размытой.
    const blades = ['#5a6a3a', '#2c3620', '#6a6a44', '#3e4a2a', '#4a3e2a'];
    for (let i = 0; i < 90000; i++) {
      g.fillStyle = blades[Math.floor(rand() * blades.length)];
      g.globalAlpha = 0.35 + rand() * 0.4;
      g.fillRect(rand() * c.width, rand() * c.height, 1 + rand() * 2, 1 + rand() * 2);
    }
    // Лесная подстилка на западе.
    g.globalAlpha = 0.5;
    g.fillStyle = '#2b3322';
    g.fillRect(0, 0, 27 * s, c.height);
    g.globalAlpha = 1;

    for (const a of W.areas) {
      if (a.type === 'parking') {
        g.fillStyle = '#4a4a46';
        g.fillRect(a.x * s, a.y * s, a.w * s, a.h * s);
        g.strokeStyle = 'rgba(220,220,200,0.35)';
        g.lineWidth = 2;
        for (let x = a.x + 1; x < a.x + a.w - 1; x += 3.5) {
          g.beginPath(); g.moveTo(x * s, (a.y + 0.5) * s); g.lineTo(x * s, (a.y + 6) * s); g.stroke();
        }
      } else {
        g.fillStyle = '#6a6862';
        g.fillRect(a.x * s, a.y * s, a.w * s, a.h * s);
      }
    }
    for (const r of W.roads) {
      if (r.type === 'asphalt') {
        g.fillStyle = '#44443f';
        g.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
        g.fillStyle = '#5a5850';
        g.fillRect(r.x * s, r.y * s, r.w * s, 3);
        g.fillRect(r.x * s, (r.y + r.h) * s - 3, r.w * s, 3);
        g.fillRect(r.x * s, r.y * s, 3, r.h * s);
        g.fillRect((r.x + r.w) * s - 3, r.y * s, 3, r.h * s);
        // Разметка по центру (стёртая).
        g.fillStyle = 'rgba(210,200,170,0.35)';
        if (r.h > r.w) {
          for (let y = r.y; y < r.y + r.h; y += 6) g.fillRect((r.x + r.w / 2) * s - 1, y * s, 2, 3 * s);
        } else {
          for (let x = r.x; x < r.x + r.w; x += 6) g.fillRect(x * s, (r.y + r.h / 2) * s - 1, 3 * s, 2);
        }
      } else {
        g.fillStyle = '#6b5a40';
        g.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
      }
    }
    // Трещины и выбоины.
    g.strokeStyle = 'rgba(20,20,18,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const r = W.roads[0];
      let x = (r.x + rand() * r.w) * s, y = (r.y + rand() * r.h) * s;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 14; y += (rand() - 0.5) * 14; g.lineTo(x, y); }
      g.stroke();
    }
    // Подложка зданий.
    for (const b of W.buildings) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect((b.x - 0.3) * s, (b.y - 0.3) * s, (b.w + 0.9) * s, (b.h + 0.9) * s);
    }
    return c;
  }

  // --- Помощники ---
  let cam = { x: 0, y: 0 };
  const sx = (x) => (x - cam.x) * ppm;
  const sy = (y) => (y - cam.y) * ppm;
  function visible(x, y, pad) {
    return x > cam.x - pad && x < cam.x + width / ppm + pad && y > cam.y - pad && y < cam.y + height / ppm + pad;
  }
  function rectPx(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(sx(x), sy(y), w * ppm, h * ppm);
  }
  function disc(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx(x), sy(y), r * ppm, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Объекты ---
  function drawBuildingInterior(b) {
    rectPx(b.x, b.y, b.w, b.h, b.kind === 'house' ? '#5c4630' : '#56544e');
    // Доски / плитка.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    const step = b.kind === 'house' ? 0.5 : 1;
    for (let y = b.y + step; y < b.y + b.h; y += step) {
      ctx.beginPath(); ctx.moveTo(sx(b.x), sy(y)); ctx.lineTo(sx(b.x + b.w), sy(y)); ctx.stroke();
    }
    for (const w of b.walls) rectPx(w.x, w.y, w.w, w.h, b.kind === 'house' ? '#3a2c1e' : '#7a6a5a');
  }

  function drawRoof(b, alpha) {
    ctx.globalAlpha = alpha;
    const x = sx(b.x - 0.3), y = sy(b.y - 0.3), w = (b.w + 0.6) * ppm, h = (b.h + 0.6) * ppm;
    if (b.kind === 'house') {
      // Двускатная крыша: конёк с севера на юг.
      ctx.fillStyle = b.roof;
      ctx.fillRect(x, y, w / 2, h);
      ctx.fillStyle = shade(b.roof, -18);
      ctx.fillRect(x + w / 2, y, w / 2, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo(x, y + h * i / 8); ctx.lineTo(x + w, y + h * i / 8); ctx.stroke();
      }
      ctx.fillStyle = shade(b.roof, 25);
      ctx.fillRect(x + w / 2 - 2, y, 4, h);
      // Труба.
      ctx.fillStyle = '#6a3a2a';
      ctx.fillRect(x + w * 0.6, y + h * 0.25, ppm * 0.6, ppm * 0.6);
    } else {
      ctx.fillStyle = b.roof;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.25, h * 0.2);
      ctx.fillRect(x + w * 0.6, y + h * 0.55, w * 0.2, h * 0.25);
    }
    if (b.sign) {
      const fs = Math.max(10, ppm * 0.7);
      ctx.font = `bold ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(b.sign).width + 10;
      const cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = '#e6dcc6';
      ctx.fillRect(cx - tw / 2, cy - fs * 0.75, tw, fs * 1.4);
      ctx.fillStyle = '#9a2020';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, cx, cy + fs * 0.35);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawVehicle(v) {
    const x = sx(v.x), y = sy(v.y), w = v.w * ppm, h = v.h * ppm;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = v.color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(80,50,30,0.45)'; // ржавчина
    ctx.fillRect(x + w * 0.1, y + h * 0.7, w * 0.3, h * 0.15);
    if (v.kind === 'bus') {
      ctx.fillStyle = '#e8e0c8';
      ctx.fillRect(x, y + h * 0.42, w, h * 0.05);
      ctx.fillStyle = '#2a3238';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 2, y + h * (0.1 + i * 0.14), w - 4, h * 0.09);
    } else if (v.kind === 'truck') {
      ctx.fillStyle = shade(v.color, -15);
      ctx.fillRect(x, y + h * 0.32, w, h * 0.68);
      ctx.fillStyle = '#2a3238';
      ctx.fillRect(x + 3, y + h * 0.05, w - 6, h * 0.08);
    } else if (v.kind === 'tractor') {
      ctx.fillStyle = '#222';
      ctx.fillRect(x - 3, y + h * 0.6, 4, h * 0.35);
      ctx.fillRect(x + w - 1, y + h * 0.6, 4, h * 0.35);
      ctx.fillStyle = '#2a3238';
      ctx.fillRect(x + 3, y + h * 0.45, w - 6, h * 0.25);
    } else {
      ctx.fillStyle = '#2a3238';
      ctx.fillRect(x + 3, y + h * 0.22, w - 6, h * 0.16);
      ctx.fillRect(x + 3, y + h * 0.68, w - 6, h * 0.1);
      ctx.fillStyle = shade(v.color, 18);
      ctx.fillRect(x + 4, y + h * 0.4, w - 8, h * 0.26);
    }
  }

  function drawContainer(c, searched) {
    if (c.vehicle) return;
    rectPx(c.x, c.y, c.w, c.h, searched ? '#3e3428' : '#6e5638');
    ctx.strokeStyle = searched ? 'rgba(0,0,0,0.3)' : 'rgba(255,230,160,0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx(c.x), sy(c.y), c.w * ppm, c.h * ppm);
  }

  function drawDrop(d) {
    disc(d.x, d.y, 0.35, '#3a2e24');
    disc(d.x, d.y, 0.22, d.items.some((i) => i.id === 'sporan') ? '#7fd36b' : '#8a7a5a');
  }

  function drawHuman(x, y, angle, body, opts) {
    ctx.save();
    ctx.translate(sx(x), sy(y));
    ctx.rotate(angle);
    const r = ppm * (opts.crouch ? 0.29 : 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 3, r * 1.1, r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    if (opts.backpack) {
      ctx.fillStyle = '#4a4a30';
      ctx.fillRect(-r * 1.25, -r * 0.6, r * 0.6, r * 1.2);
    }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
    if (opts.weapon) {
      ctx.strokeStyle = opts.weapon;
      ctx.lineWidth = Math.max(2, ppm * 0.08);
      ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.4); ctx.lineTo(r * (opts.long ? 2.2 : 1.4), r * 0.4); ctx.stroke();
    }
    ctx.fillStyle = opts.head || '#c9a888';
    ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
    if (opts.hood) {
      ctx.fillStyle = opts.hood;
      ctx.beginPath(); ctx.arc(-r * 0.05, 0, r * 0.5, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
    }
    ctx.restore();
  }

  function drawInfected(e, t) {
    const T = e.type;
    const wob = Math.sin(t * 8 + e.seed * 10) * 0.12;
    ctx.save();
    ctx.translate(sx(e.x), sy(e.y));
    ctx.rotate(e.angle + wob);
    const r = T.radius * ppm;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 3, r, r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    // Руки вперёд.
    ctx.strokeStyle = T.color;
    ctx.lineWidth = r * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 1.3, -r * 0.5);
    ctx.moveTo(0, r * 0.7); ctx.lineTo(r * 1.3, r * 0.5);
    ctx.stroke();
    ctx.fillStyle = e.hitFlash > 0 ? '#e05040' : T.color;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
    if (e.kind === 'lottery' || e.kind === 'stomper') {
      // Наросты.
      ctx.fillStyle = shade(T.color, -30);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.arc(-r * 0.4 + i * r * 0.2, (i % 2 ? 1 : -1) * r * 0.45, r * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = shade(T.color, 20);
    ctx.beginPath(); ctx.arc(r * 0.2, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (e.hp < T.hp) {
      const bx = sx(e.x) - 14, by = sy(e.y) - r - 10;
      ctx.fillStyle = '#400'; ctx.fillRect(bx, by, 28, 4);
      ctx.fillStyle = '#d33'; ctx.fillRect(bx, by, 28 * e.hp / T.hp, 4);
    }
  }

  function drawCorpse(c) {
    ctx.save();
    ctx.translate(sx(c.x), sy(c.y));
    ctx.rotate(c.angle);
    const r = c.radius * ppm;
    ctx.fillStyle = shade(c.color, -35);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawNumbers(state) {
    ctx.textAlign = 'center';
    for (const n of state.fx.numbers) {
      const a = Math.min(1, n.t * 2);
      const fs = n.big ? 20 : 14;
      ctx.font = `bold ${fs}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(0,0,0,${a * 0.8})`;
      ctx.fillStyle = n.big ? `rgba(255,210,80,${a})` : `rgba(255,255,255,${a})`;
      const x = sx(n.x), y = sy(n.y) - (1 - n.t) * 30;
      ctx.strokeText(n.text, x, y);
      ctx.fillText(n.text, x, y);
    }
    ctx.textAlign = 'left';
  }

  function drawVignette(state) {
    const low = Math.max(0, 1 - state.player.hp / 35);
    const a = Math.min(0.6, state.fx.hurt * 1.2 + low * 0.35);
    if (a <= 0.01) return;
    const g = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3,
      width / 2, height / 2, Math.max(width, height) * 0.7);
    g.addColorStop(0, 'rgba(120,0,0,0)');
    g.addColorStop(1, `rgba(140,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTree(t, fade) {
    const x = sx(t.x), y = sy(t.y), r = t.r * ppm;
    ctx.globalAlpha = fade ? 0.35 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.25, r, 0, Math.PI * 2); ctx.fill();
    if (t.kind === 'pine') {
      const base = t.shade < 0.5 ? '#1f3320' : '#243a22';
      for (let k = 0; k < 3; k++) {
        const rr = r * (1 - k * 0.28);
        ctx.fillStyle = shade(base, k * 12);
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * Math.PI * 2 + k * 0.3;
          const d = i % 2 ? rr : rr * 0.72;
          ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        }
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#4c6a32';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5d7d3c';
      ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8d4c8';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawProps() {
    for (const l of W.lamps) {
      if (!visible(l.x, l.y, 2)) continue;
      disc(l.x, l.y, 0.15, '#2a2a2a');
      disc(l.x, l.y, 0.28, 'rgba(255,220,150,0.5)');
    }
    for (const p of W.props) {
      if (p.kind === 'shelter') {
        rectPx(p.x, p.y, p.w, p.h, '#5a6a72');
        rectPx(p.x + 0.1, p.y + 0.1, p.w - 0.2, p.h - 0.2, '#6d7f88');
        ctx.fillStyle = '#e8e0c8';
        ctx.font = `${Math.max(8, ppm * 0.35)}px system-ui, sans-serif`;
        ctx.save();
        ctx.translate(sx(p.x + p.w / 2), sy(p.y + p.h / 2));
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('ОСТАНОВКА', 0, 4);
        ctx.restore();
      } else if (p.kind === 'tower') {
        disc(p.x + 0.4, p.y + 0.4, p.r, 'rgba(0,0,0,0.35)');
        disc(p.x, p.y, p.r, '#6a5040');
        disc(p.x, p.y, p.r * 0.7, '#7a5e4a');
        disc(p.x, p.y, p.r * 0.2, '#4a3a30');
      }
    }
  }

  function drawFences() {
    ctx.fillStyle = '#6b5a42';
    for (const r of W.rects) {
      if (r.kind !== 'fence' || !visible(r.x, r.y, r.w + r.h)) continue;
      ctx.fillRect(sx(r.x), sy(r.y), Math.max(2, r.w * ppm), Math.max(2, r.h * ppm));
    }
  }

  function drawPoles() {
    ctx.strokeStyle = 'rgba(20,20,20,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < W.poles.length - 1; i++) {
      const a = W.poles[i], b = W.poles[i + 1];
      ctx.moveTo(sx(a.x) - 3, sy(a.y)); ctx.lineTo(sx(b.x) - 3, sy(b.y));
      ctx.moveTo(sx(a.x) + 3, sy(a.y)); ctx.lineTo(sx(b.x) + 3, sy(b.y));
    }
    ctx.stroke();
    for (const p of W.poles) {
      disc(p.x, p.y, 0.18, '#3a2e22');
      ctx.fillStyle = '#3a2e22';
      ctx.fillRect(sx(p.x) - 6, sy(p.y) - 1.5, 12, 3);
    }
  }

  // --- Ночь и фонарик ---
  function darkness(hour) {
    if (hour >= 7 && hour < 19) return 0;
    if (hour >= 19 && hour < 22) return (hour - 19) / 3 * 0.9;
    if (hour >= 5 && hour < 7) return (1 - (hour - 5) / 2) * 0.9;
    return 0.9;
  }

  function drawLighting(state) {
    const a = darkness(state.hour);
    // Закат и рассвет — тёплый оттенок.
    if ((state.hour >= 17 && state.hour < 20) || (state.hour >= 5 && state.hour < 8)) {
      ctx.fillStyle = 'rgba(255,120,40,0.08)';
      ctx.fillRect(0, 0, width, height);
    }
    if (a <= 0.01) return;
    const lw = light.width, lh = light.height, k = lw / width;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = `rgba(4,6,16,${a})`;
    lctx.fillRect(0, 0, lw, lh);
    lctx.globalCompositeOperation = 'destination-out';
    const p = state.player;
    const px = sx(p.x) * k, py = sy(p.y) * k;
    let g = lctx.createRadialGradient(px, py, 0, px, py, 3 * ppm * k);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, lw, lh);
    // Уличные фонари.
    for (const l of W.lamps) {
      const lx = sx(l.x) * k, ly = sy(l.y) * k, lr = l.r * ppm * k;
      if (lx < -lr || ly < -lr || lx > lw + lr || ly > lh + lr) continue;
      g = lctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }
    // Фонарик.
    const len = 11 * ppm * k, spread = 0.38;
    g = lctx.createRadialGradient(px, py, 0, px, py, len);
    g.addColorStop(0, 'rgba(0,0,0,0.95)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.moveTo(px, py);
    lctx.arc(px, py, len, p.angle - spread, p.angle + spread);
    lctx.closePath();
    lctx.fill();
    // Вспышки выстрелов.
    for (const f of state.flashes) {
      const fx = sx(f.x) * k, fy = sy(f.y) * k;
      g = lctx.createRadialGradient(fx, fy, 0, fx, fy, 4 * ppm * k);
      g.addColorStop(0, `rgba(0,0,0,${f.t * 8})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(0, 0, lw, lh);
    }
    ctx.drawImage(light, 0, 0, width, height);
    // Тёплый свет фонарей поверх темноты.
    for (const l of W.lamps) {
      if (!visible(l.x, l.y, l.r)) continue;
      const gg = ctx.createRadialGradient(sx(l.x), sy(l.y), 0, sx(l.x), sy(l.y), l.r * ppm);
      gg.addColorStop(0, `rgba(255,190,90,${0.22 * a})`);
      gg.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(sx(l.x - l.r), sy(l.y - l.r), l.r * 2 * ppm, l.r * 2 * ppm);
    }
  }

  // --- Кадр ---
  function draw(state, t) {
    const p = state.player;
    const shake = state.fx.shake;
    cam.x = p.x - width / ppm / 2 + (Math.random() - 0.5) * shake * 0.25;
    cam.y = p.y - height / ppm / 2 + (Math.random() - 0.5) * shake * 0.25;

    ctx.fillStyle = '#1a2014';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ground, cam.x * GROUND_PPM, cam.y * GROUND_PPM, width / ppm * GROUND_PPM, height / ppm * GROUND_PPM,
      0, 0, width, height);

    const inside = W.buildingAt(p.x, p.y);
    for (const b of W.buildings) if (visible(b.x, b.y, b.w + b.h)) drawBuildingInterior(b);
    for (const c of W.containers) if (visible(c.x, c.y, 3)) drawContainer(c, state.searched[c.id]);
    drawProps();
    drawFences();
    for (const b of state.fx.blood) {
      if (!visible(b.x, b.y, 1)) continue;
      ctx.globalAlpha = Math.min(1, b.t / 20) * 0.7;
      disc(b.x, b.y, b.r, '#4a1010');
      disc(b.x + b.r * 0.6, b.y - b.r * 0.3, b.r * 0.45, '#3a0c0c');
    }
    ctx.globalAlpha = 1;
    for (const c of state.fx.corpses) {
      if (!visible(c.x, c.y, 2)) continue;
      ctx.globalAlpha = Math.min(1, c.t / 4);
      drawCorpse(c);
    }
    ctx.globalAlpha = 1;
    for (const d of state.drops) if (visible(d.x, d.y, 1)) drawDrop(d);
    for (const v of W.vehicles) if (visible(v.x, v.y, 10)) drawVehicle(v);

    for (const n of W.npcs) {
      if (!visible(n.x, n.y, 2)) continue;
      drawHuman(n.x, n.y, Math.PI / 2, '#56603e', { head: '#c9a888', hood: '#3a3a2a' });
    }
    for (const e of state.enemies) if (visible(e.x, e.y, 2)) drawInfected(e, t);

    // Атака ближнего боя — дуга.
    if (state.swing > 0) {
      ctx.strokeStyle = `rgba(255,240,200,${state.swing * 4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), state.swingRange * ppm, p.angle - 0.7, p.angle + 0.7);
      ctx.stroke();
    }
    for (const tr of state.tracers) {
      ctx.strokeStyle = `rgba(255,230,150,${tr.t * 10})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx(tr.x1), sy(tr.y1)); ctx.lineTo(sx(tr.x2), sy(tr.y2)); ctx.stroke();
    }

    const wpn = state.weaponDef;
    drawHuman(p.x, p.y, p.angle, p.hitFlash > 0 ? '#9a3a30' : '#4a4e36', {
      backpack: true, head: '#c9a888', hood: '#3c3f2c', crouch: state.crouch,
      weapon: wpn.type === 'ranged' ? '#2a2a2a' : (state.weapon ? '#9a9a9a' : null),
      long: state.weapon && state.weapon.id === 'akm',
    });

    for (const tr of W.trees) {
      if (!visible(tr.x, tr.y, tr.r + 1)) continue;
      drawTree(tr, Math.hypot(tr.x - p.x, tr.y - p.y) < tr.r + 0.4);
    }
    drawPoles();
    for (const b of W.buildings) {
      if (!visible(b.x, b.y, b.w + b.h)) continue;
      drawRoof(b, b === inside ? 0 : 1);
    }

    drawLighting(state);
    drawNumbers(state);
    drawVignette(state);

    // Метка выхода с локации.
    if (state.quests.exit && state.quests.exit.active) {
      const e = W.exit;
      ctx.strokeStyle = 'rgba(120,220,120,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sx(e.x), sy(e.y), e.w * ppm, e.h * ppm);
      ctx.setLineDash([]);
    }

    drawStick();
  }

  function drawStick() {
    const s = window.Input.stick;
    if (!s) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, window.Input.RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Миникарта ---
  let mini, mctx, miniBase;
  function initMinimap(canvas) {
    mini = canvas;
    mctx = canvas.getContext('2d');
    miniBase = document.createElement('canvas');
    miniBase.width = miniBase.height = 200;
    const g = miniBase.getContext('2d');
    g.drawImage(ground, 0, 0, 200, 200);
    g.fillStyle = 'rgba(15,25,12,0.75)';
    for (const t of W.trees) g.fillRect(t.x * 2 - 1, t.y * 2 - 1, 3, 3);
    g.fillStyle = '#8a7a66';
    for (const b of W.buildings) g.fillRect(b.x * 2, b.y * 2, b.w * 2, b.h * 2);
    g.fillStyle = '#b0a060';
    for (const v of W.vehicles) g.fillRect(v.x * 2, v.y * 2, v.w * 2, v.h * 2);
  }

  function drawMinimap(state) {
    const size = mini.width;
    const p = state.player;
    const scale = 2.2; // px на метр
    mctx.clearRect(0, 0, size, size);
    mctx.save();
    mctx.beginPath();
    mctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = '#111';
    mctx.fillRect(0, 0, size, size);
    mctx.translate(size / 2 - p.x * scale, size / 2 - p.y * scale);
    mctx.drawImage(miniBase, 0, 0, 100 * scale, 100 * scale);
    mctx.fillStyle = '#ffd34d';
    for (const q of Object.values(state.quests)) {
      if (!q.active || q.done || !q.target) continue;
      mctx.beginPath(); mctx.arc(q.target.x * scale, q.target.y * scale, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    mctx.fillStyle = '#e04040';
    for (const e of state.enemies) {
      if (e.state === 'chase') { mctx.beginPath(); mctx.arc(e.x * scale, e.y * scale, 2, 0, Math.PI * 2); mctx.fill(); }
    }
    mctx.restore();
    // Игрок — стрелка в центре.
    mctx.save();
    mctx.translate(size / 2, size / 2);
    mctx.rotate(p.angle);
    mctx.fillStyle = '#fff';
    mctx.beginPath(); mctx.moveTo(6, 0); mctx.lineTo(-4, -4); mctx.lineTo(-4, 4); mctx.closePath(); mctx.fill();
    mctx.restore();
    mctx.strokeStyle = 'rgba(200,200,200,0.5)';
    mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); mctx.stroke();
    mctx.fillStyle = '#ddd';
    mctx.font = 'bold 10px system-ui, sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('С', size / 2, 11);
  }

  window.Render = { init, resize, draw, initMinimap, drawMinimap, darkness };
})();
