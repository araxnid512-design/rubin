// Эффекты: частицы (кровь, пыль, дым, огонь, искры), пятна на дороге, тени, тряска камеры.
// Мягкие спрайты рисуются один раз на маленьких холстах — на телефоне это дёшево.
(function () {
  const sprites = new Map();

  // Мягкое пятно заданного цвета (кэш по цвету).
  function puff(color) {
    let c = sprites.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g2 = c.getContext('2d');
    const g = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(0.45, color.replace(/[\d.]+\)$/, (a) => (parseFloat(a) * 0.5) + ')'));
    g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g2.fillStyle = g;
    g2.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
    return c;
  }

  const cap = (scene) => scene.particles.length < window.CONFIG.FX.maxParticles;

  // --- Создание частиц ---
  function dust(scene, x, y, n, vx, color) {
    for (let i = 0; i < n && cap(scene); i++) {
      scene.particles.push({ kind: 'puff', x: x + (Math.random() - 0.5) * 0.6, y: y + Math.random() * 0.2,
        vx: (vx || 0) + (Math.random() - 0.5) * 2, vy: 0.6 + Math.random() * 1.4, g: -0.5, drag: 1.8,
        t: 0.9 + Math.random() * 0.8, life: 1.7, r: 0.35 + Math.random() * 0.3, grow: 1.6,
        c: color || 'rgba(170,150,120,0.55)' });
    }
  }

  function smoke(scene, x, y, vx, dark) {
    if (!cap(scene)) return;
    scene.particles.push({ kind: 'puff', x, y, vx: vx + (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random() * 0.6, g: -0.8, drag: 1.2,
      t: 0.8 + Math.random() * 0.6, life: 1.4, r: 0.15 + Math.random() * 0.1, grow: 1.4, c: dark ? 'rgba(40,38,36,0.5)' : 'rgba(150,150,150,0.35)' });
  }

  function fire(scene, x, y, vx, vy, n) {
    for (let i = 0; i < n && cap(scene); i++) {
      scene.particles.push({ kind: 'puff', add: true, x, y, vx: vx + (Math.random() - 0.5) * 2, vy: vy + (Math.random() - 0.5) * 2, g: -2, drag: 2.5,
        t: 0.25 + Math.random() * 0.3, life: 0.55, r: 0.25 + Math.random() * 0.25, grow: 0.8,
        c: Math.random() < 0.5 ? 'rgba(255,170,60,0.9)' : 'rgba(255,90,30,0.8)' });
    }
  }

  function sparks(scene, x, y, n, vx) {
    for (let i = 0; i < n && cap(scene); i++) {
      const a = Math.random() * Math.PI, s = 4 + Math.random() * 8;
      scene.particles.push({ kind: 'spark', x, y, vx: (vx || 0) * 0.5 + Math.cos(a) * s, vy: Math.sin(a) * s, g: 14, drag: 0.5,
        t: 0.2 + Math.random() * 0.35, life: 0.55, c: '#ffd890' });
    }
  }

  function blood(scene, x, y, n, vx) {
    for (let i = 0; i < n && cap(scene); i++) {
      const green = Math.random() < 0.3;
      scene.particles.push({ kind: 'drop', x, y, vx: (vx || 0) * 0.4 + (Math.random() - 0.3) * 6, vy: Math.random() * 6, g: 14,
        t: 0.8 + Math.random() * 1.2, r: 0.04 + Math.random() * 0.08, c: green ? '#4a8a3a' : '#7a1010', splat: Math.random() < 0.6 });
    }
    // Кровавая дымка в момент удара.
    if (n > 6 && cap(scene)) {
      scene.particles.push({ kind: 'puff', x, y, vx: (vx || 0) * 0.3, vy: 0.5, g: 0, drag: 3, t: 0.5, life: 0.5, r: 0.5, grow: 2.2, c: 'rgba(120,20,16,0.5)' });
    }
  }

  // --- Обновление ---
  function update(scene, dt) {
    const F = window.CONFIG.FX;
    for (const q of scene.particles) {
      q.vy -= (q.g == null ? 14 : q.g) * dt;
      if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.t -= dt;
      if (q.kind === 'puff') continue;
      const g = scene.terrain.heightAt(q.x);
      if (q.y < g) {
        // Капля крови оставляет пятно на дороге.
        if (q.kind === 'drop' && q.splat) {
          if (!scene.decals) scene.decals = [];
          scene.decals.push({ x: q.x, y: g, w: q.r * (3 + Math.random() * 4), c: q.c });
          if (scene.decals.length > F.maxDecals) scene.decals.shift();
          q.t = 0;
        }
        q.y = g; q.vx *= 0.3; q.vy = 0;
      }
    }
    scene.particles = scene.particles.filter((q) => q.t > 0);
  }

  // --- Отрисовка (мировые координаты, y вверх) ---
  function draw(ctx, scene) {
    for (const q of scene.particles) {
      if (q.kind === 'puff') {
        const k = 1 - Math.max(0, q.t) / q.life;               // 0 → 1 за жизнь
        const r = q.r * (1 + q.grow * k);
        ctx.globalAlpha = Math.min(1, q.t / q.life * 1.6);
        if (q.add) ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(puff(q.c), q.x - r, q.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
      } else if (q.kind === 'spark') {
        ctx.globalAlpha = Math.min(1, q.t * 4);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = q.c;
        ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.globalAlpha = Math.min(1, q.t * 2);
        ctx.fillStyle = q.c;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r || 0.06, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Пятна на дороге: сплюснутые эллипсы вдоль склона.
  function drawDecals(ctx, scene, v) {
    if (!scene.decals) return;
    const terr = scene.terrain;
    for (const d of scene.decals) {
      if (d.x < v.l || d.x > v.r) continue;
      const a = Math.atan2(terr.heightAt(d.x + 0.3) - terr.heightAt(d.x - 0.3), 0.6);
      ctx.save();
      ctx.translate(d.x, d.y + 0.01);
      ctx.rotate(a);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = d.c;
      ctx.beginPath(); ctx.ellipse(0, 0, d.w, d.w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Мягкая тень на земле: чем выше тело над землёй, тем она бледнее.
  function shadow(ctx, x, groundY, height, w) {
    const k = Math.max(0, 1 - height / 6);
    if (k <= 0) return;
    ctx.globalAlpha = 0.55 * k;
    const ww = w * (1 + (1 - k) * 0.5);
    ctx.drawImage(puff('rgba(0,0,0,0.9)'), x - ww / 2, groundY - ww * 0.07, ww, ww * 0.16);
    ctx.globalAlpha = 1;
  }

  window.FX = { puff, dust, smoke, fire, sparks, blood, update, draw, drawDecals, shadow };
})();
