// Добыча на трассе: спораны, горох и жемчуг с убитых заражённых, канистры с бензином.
// Подбирается, когда машина проезжает рядом; споросборник увеличивает радиус.
(function () {
  const KINDS = {
    sporan: { color: '#8fd06a', glow: 'rgba(143,208,106,', r: 0.22 },
    peas: { color: '#e0c050', glow: 'rgba(224,192,80,', r: 0.2 },
    pearl: { color: '#e8e4f0', glow: 'rgba(220,210,255,', r: 0.26 },
    canister: { color: '#b8302a', glow: 'rgba(255,200,80,', r: 0.4 },
  };

  class Pickups {
    constructor(terrain, hooks) {
      this.terrain = terrain;
      this.hooks = hooks; // { onCollect(kind, count) }
      this.items = [];
      // Канистры стоят на трассе с самого начала.
      for (const o of terrain.objects) {
        if (o.type !== 'canister') continue;
        const y = (o.y != null ? o.y : terrain.heightAt(o.x)) + 0.45;
        this.items.push({ kind: 'canister', x: o.x, y, t: 0, landed: true, permanent: true });
      }
    }

    // Выпадение с подлётом: предмет подлетает и ложится на землю.
    drop(kind, count, x, y) {
      for (let i = 0; i < count; i++) {
        this.items.push({
          kind, x: x + (Math.random() - 0.5) * 0.6, y: y + 0.5,
          vx: 1 + Math.random() * 2.5, vy: 3 + Math.random() * 3, t: 0, landed: false,
        });
      }
    }

    update(car, dt) {
      const P = window.CONFIG.PICKUPS;
      const cp = car.chassis.getPosition();
      const r = car.stats.collectRadius;
      for (const it of this.items) {
        it.t += dt;
        if (!it.landed) {
          it.vy -= 12 * dt;
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          const g = this.terrain.heightAt(it.x) + 0.35;
          if (it.y <= g) { it.y = g; it.landed = true; }
        }
        // Споросборник подтягивает добычу к машине.
        const dx = cp.x - it.x, dy = cp.y - it.y;
        const d = Math.hypot(dx, dy);
        if (car.stats.magnet && d < car.stats.magnet) {
          it.x += dx / d * 12 * dt;
          it.y += dy / d * 12 * dt;
          it.landed = true;
        }
        if (Math.abs(dx) < r && dy > -3 && dy < 1.5) {
          it.taken = true;
          this.hooks.onCollect(it.kind, 1);
        }
      }
      this.items = this.items.filter((it) => !it.taken && (it.permanent || (it.t < P.life && it.x > cp.x - 60)));
    }

    draw(ctx, t) {
      for (const it of this.items) {
        const k = KINDS[it.kind];
        const pulse = 0.6 + Math.sin(t * 5 + it.x) * 0.4;
        const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, k.r * 3);
        g.addColorStop(0, k.glow + (0.5 * pulse) + ')');
        g.addColorStop(1, k.glow + '0)');
        ctx.fillStyle = g;
        ctx.fillRect(it.x - k.r * 3, it.y - k.r * 3, k.r * 6, k.r * 6);
        if (it.kind === 'canister') { drawCanister(ctx, it.x, it.y); continue; }
        ctx.fillStyle = k.color;
        ctx.beginPath();
        if (it.kind === 'peas') {
          for (let i = 0; i < 3; i++) ctx.arc(it.x + (i - 1) * 0.13, it.y + (i === 1 ? 0.1 : 0), 0.09, 0, Math.PI * 2);
        } else {
          ctx.ellipse(it.x, it.y, k.r, k.r * (it.kind === 'pearl' ? 1 : 0.75), 0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
  }

  // Канистра: красный корпус, ручка, крышка.
  function drawCanister(ctx, x, y) {
    ctx.fillStyle = '#b8302a';
    ctx.fillRect(x - 0.28, y - 0.4, 0.56, 0.72);
    ctx.fillStyle = '#8a2420';
    ctx.fillRect(x - 0.28, y - 0.05, 0.56, 0.06);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 0.07;
    ctx.strokeRect(x - 0.12, y + 0.32, 0.24, 0.14);
    ctx.fillStyle = '#d0c070';
    ctx.fillRect(x + 0.12, y + 0.3, 0.12, 0.1);
  }

  window.Pickups = Pickups;
})();
