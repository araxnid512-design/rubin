// Машины рисуются кодом в координатах кузова (x вперёд, y вверх, метры).
// Каждое улучшение будет добавлять видимые детали (этап 5).
(function () {
  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function drawWheel(ctx, x, y, angle, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#16161a';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // Протектор.
    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = 0.06;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.fillStyle = '#6a6a66';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3a38';
    ctx.lineWidth = 0.05;
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.stroke();
    }
    ctx.fillStyle = '#2a2a28';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Седан: ржавчина, треснувшее стекло, мятый бампер.
  function sedan(ctx, def) {
    const c = def.color;
    ctx.fillStyle = shade(c, -10);
    path(ctx, def.body); ctx.fill();
    ctx.fillStyle = c;
    path(ctx, def.cabin); ctx.fill();
    // Стёкла.
    ctx.fillStyle = '#2a3a44';
    path(ctx, [[-1.2, 0.45], [-0.4, 0.45], [-0.4, 0.88], [-1.05, 0.88]]); ctx.fill();
    path(ctx, [[-0.3, 0.45], [0.42, 0.45], [0.02, 0.88], [-0.3, 0.88]]); ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,235,0.5)';
    ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(0.1, 0.62); ctx.lineTo(0.25, 0.7); ctx.lineTo(0.18, 0.8); ctx.stroke();
    // Дверь, ручка.
    ctx.strokeStyle = shade(c, -45);
    ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(-0.35, 0.38); ctx.lineTo(-0.35, -0.22); ctx.stroke();
    ctx.fillStyle = shade(c, -60);
    ctx.fillRect(-0.15, 0.18, 0.2, 0.05);
    // Ржавчина.
    ctx.fillStyle = 'rgba(110,55,25,0.65)';
    ctx.beginPath(); ctx.ellipse(-1.6, -0.12, 0.28, 0.12, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(1.2, 0.05, 0.2, 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
    // Фары, фонари, бамперы.
    ctx.fillStyle = '#e8dca0';
    ctx.fillRect(2.02, 0.0, 0.13, 0.13);
    ctx.fillStyle = '#a02020';
    ctx.fillRect(-2.1, 0.08, 0.1, 0.14);
    ctx.fillStyle = '#4a4a48';
    ctx.fillRect(1.95, -0.34, 0.3, 0.12);
    ctx.fillRect(-2.2, -0.34, 0.3, 0.12);
    // Колёсные арки.
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-1.35, -0.3, 0.45, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(1.4, -0.3, 0.45, 0, Math.PI); ctx.fill();
  }

  const BODIES = { sedan };

  // Рисует машину целиком: колёса, кузов, пламя нитро.
  function draw(ctx, car, t) {
    const def = car.def;
    const r = def.wheels.radius;
    for (const w of [car.rear, car.front]) {
      const p = w.body.getPosition();
      drawWheel(ctx, p.x, p.y, w.body.getAngle(), r);
    }
    const p = car.chassis.getPosition();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.chassis.getAngle());
    if (car.nitroOn) {
      const len = 0.8 + Math.random() * 0.5;
      const g = ctx.createLinearGradient(-2.2, 0, -2.2 - len, 0);
      g.addColorStop(0, 'rgba(120,200,255,0.95)');
      g.addColorStop(0.4, 'rgba(255,170,60,0.8)');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-2.15, -0.05); ctx.lineTo(-2.2 - len, -0.15); ctx.lineTo(-2.15, -0.25);
      ctx.closePath(); ctx.fill();
    }
    (BODIES[def.id] || sedan)(ctx, def, t);
    ctx.restore();
  }

  window.CarDraw = { draw, drawWheel, path, shade };
})();
