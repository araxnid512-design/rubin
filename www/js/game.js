// Прототип: иммунный-новичок отбивается от волн заражённых и собирает спораны.
// Новые механики добавляются только после сверки с LORE.md (см. CLAUDE.md).
(function () {
  const { ENEMIES, SPORAN_ROLL, WEAPON, PLAYER } = window.GameData;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const gameOverEl = document.getElementById('gameover');
  const gameOverText = document.getElementById('gameover-text');

  const TILE = 64;
  let width = 0, height = 0, dpr = 1;
  let last = performance.now();
  let state;

  function newState() {
    return {
      player: { x: 0, y: 0, hp: PLAYER.hp, hitTimer: 0, aim: { x: 1, y: 0 } },
      weapon: { ammo: WEAPON.magazine, cooldown: 0, reload: 0 },
      enemies: [],
      bullets: [],
      sporans: [],
      collected: 0,
      kills: 0,
      wave: 0,
      waveDelay: 1.5,
      over: false,
    };
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rollSporans() {
    const total = SPORAN_ROLL.reduce((s, r) => s + r.weight, 0);
    let n = Math.random() * total;
    for (const r of SPORAN_ROLL) {
      if ((n -= r.weight) < 0) return r.count;
    }
    return 0;
  }

  function spawnWave() {
    state.wave += 1;
    const count = 3 + state.wave * 2;
    const p = state.player;
    const dist = Math.hypot(width, height) / 2 + 60;
    for (let i = 0; i < count; i++) {
      // Лотерейщики появляются с третьей волны, и их становится больше.
      const lotteryChance = state.wave >= 3 ? Math.min(0.1 * (state.wave - 2), 0.5) : 0;
      const type = Math.random() < lotteryChance ? ENEMIES.lottery : ENEMIES.runner;
      const a = Math.random() * Math.PI * 2;
      state.enemies.push({
        type,
        x: p.x + Math.cos(a) * (dist + Math.random() * 200),
        y: p.y + Math.sin(a) * (dist + Math.random() * 200),
        hp: type.hp,
        attackTimer: 0,
      });
    }
  }

  function nearestEnemy() {
    const p = state.player;
    let best = null, bestD = WEAPON.range;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  function updateWeapon(dt) {
    const w = state.weapon;
    const p = state.player;
    w.cooldown -= dt;
    if (w.reload > 0) {
      w.reload -= dt;
      if (w.reload <= 0) w.ammo = WEAPON.magazine;
      return;
    }
    const target = nearestEnemy();
    if (target) {
      const dx = target.x - p.x, dy = target.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      p.aim.x = dx / len;
      p.aim.y = dy / len;
    }
    if (!window.Input.fire || w.cooldown > 0) return;
    state.bullets.push({
      x: p.x + p.aim.x * PLAYER.radius,
      y: p.y + p.aim.y * PLAYER.radius,
      vx: p.aim.x * WEAPON.bulletSpeed,
      vy: p.aim.y * WEAPON.bulletSpeed,
      life: WEAPON.range / WEAPON.bulletSpeed,
    });
    w.cooldown = WEAPON.fireInterval;
    w.ammo -= 1;
    if (w.ammo <= 0) w.reload = WEAPON.reloadTime;
  }

  function update(dt) {
    if (state.over) return;
    const p = state.player;
    p.x += window.Input.move.x * PLAYER.speed * dt;
    p.y += window.Input.move.y * PLAYER.speed * dt;
    p.hitTimer -= dt;

    updateWeapon(dt);

    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const e of state.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < e.type.radius) {
          e.hp -= WEAPON.damage;
          b.life = 0;
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);

    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = e.type.radius + PLAYER.radius;
      if (d > reach) {
        e.x += dx / d * e.type.speed * dt;
        e.y += dy / d * e.type.speed * dt;
      } else if (p.hitTimer <= 0) {
        p.hp -= e.type.damage;
        p.hitTimer = PLAYER.hitCooldown;
      }
    }

    // Заражённые не толпятся в одной точке.
    for (let i = 0; i < state.enemies.length; i++) {
      for (let j = i + 1; j < state.enemies.length; j++) {
        const a = state.enemies[i], b = state.enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = a.type.radius + b.type.radius;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= dx / d * push; a.y -= dy / d * push;
          b.x += dx / d * push; b.y += dy / d * push;
        }
      }
    }

    for (const e of state.enemies) {
      if (e.hp > 0) continue;
      state.kills += 1;
      const n = rollSporans();
      for (let i = 0; i < n; i++) {
        state.sporans.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y + (Math.random() - 0.5) * 20 });
      }
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);

    state.sporans = state.sporans.filter((s) => {
      if (Math.hypot(s.x - p.x, s.y - p.y) < PLAYER.radius + 10) {
        state.collected += 1;
        return false;
      }
      return true;
    });

    if (state.enemies.length === 0) {
      state.waveDelay -= dt;
      if (state.waveDelay <= 0) {
        spawnWave();
        state.waveDelay = 2.5;
      }
    }

    if (p.hp <= 0) {
      p.hp = 0;
      state.over = true;
      gameOverText.textContent =
        `Волна ${state.wave} · убито ${state.kills} · спораны ${state.collected}`;
      gameOverEl.classList.remove('hidden');
    }
  }

  function drawGrid(camX, camY) {
    ctx.strokeStyle = '#1c1f1a';
    ctx.lineWidth = 1;
    const startX = Math.floor(camX / TILE) * TILE - camX;
    const startY = Math.floor(camY / TILE) * TILE - camY;
    ctx.beginPath();
    for (let x = startX; x < width; x += TILE) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = startY; y < height; y += TILE) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStick() {
    const s = window.Input.stick;
    if (!s) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, window.Input.RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    circle(s.x, s.y, 24, 'rgba(255,255,255,0.35)');
  }

  function drawFireButton() {
    const x = width - 90, y = height - 90;
    ctx.strokeStyle = window.Input.fire ? 'rgba(255,120,80,0.8)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ОГОНЬ', x, y + 5);
    ctx.textAlign = 'left';
  }

  function drawHud() {
    const p = state.player, w = state.weapon;
    ctx.fillStyle = '#333';
    ctx.fillRect(12, 12, 160, 12);
    ctx.fillStyle = '#b33';
    ctx.fillRect(12, 12, 160 * p.hp / PLAYER.hp, 12);
    ctx.fillStyle = '#ccc';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Волна ${state.wave}`, 12, 44);
    ctx.fillText(`Спораны: ${state.collected}`, 12, 64);
    ctx.fillText(w.reload > 0 ? 'Перезарядка…' : `Патроны: ${w.ammo}/${WEAPON.magazine}`, 12, 84);
  }

  function render() {
    const p = state.player;
    const camX = p.x - width / 2;
    const camY = p.y - height / 2;

    ctx.fillStyle = '#0d0f0c';
    ctx.fillRect(0, 0, width, height);
    drawGrid(camX, camY);

    for (const s of state.sporans) circle(s.x - camX, s.y - camY, 6, '#7fd36b');
    for (const e of state.enemies) {
      circle(e.x - camX, e.y - camY, e.type.radius, e.type.color);
      if (e.hp < e.type.hp) {
        ctx.fillStyle = '#600';
        ctx.fillRect(e.x - camX - 14, e.y - camY - e.type.radius - 8, 28, 4);
        ctx.fillStyle = '#e44';
        ctx.fillRect(e.x - camX - 14, e.y - camY - e.type.radius - 8, 28 * e.hp / e.type.hp, 4);
      }
    }
    for (const b of state.bullets) circle(b.x - camX, b.y - camY, 3, '#ffe9a0');

    const flash = p.hitTimer > PLAYER.hitCooldown - 0.15;
    circle(width / 2, height / 2, PLAYER.radius, flash ? '#ff6b6b' : '#d9d2c0');
    ctx.strokeStyle = '#d9d2c0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2);
    ctx.lineTo(width / 2 + p.aim.x * 26, height / 2 + p.aim.y * 26);
    ctx.stroke();

    drawStick();
    drawFireButton();
    drawHud();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!window.Platform.paused) update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function restart() {
    state = newState();
    gameOverEl.classList.add('hidden');
    last = performance.now();
  }

  document.getElementById('btn-restart').addEventListener('click', restart);
  window.addEventListener('resize', resize);
  window.Platform.on('resume', () => { last = performance.now(); });
  resize();
  restart();
  requestAnimationFrame(frame);
})();
