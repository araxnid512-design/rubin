// Оружие на машине: пулемёт на крыше, огнемёт, пила на бампере.
// Стреляет само по заражённым впереди; без патронов, но тратит прочность.
(function () {
  const pl = window.planck;

  class Weapons {
    // levels — { gun, flamer, saw } (0 — нет); durability — { gun: %, ... } из сохранения.
    constructor(run, levels, durability) {
      this.run = run;
      this.levels = levels;
      this.dur = {};
      this.state = { gunAngle: 0, gunFlash: 0, flame: 0, sawSpin: 0, sawCut: 0, tracers: [] };
      this.cool = 0;
      for (const id of ['gun', 'flamer', 'saw']) {
        if (levels[id]) this.dur[id] = durability && durability[id] != null ? durability[id] : 100;
      }
      run.car.weaponState = this.state;
    }

    has(id) { return this.levels[id] > 0; }
    works(id) { return this.has(id) && this.dur[id] > 0; }
    def(id) {
      const d = window.CONFIG.WEAPONS[id].levels[this.levels[id] - 1];
      if (id !== 'gun') return d;
      // Бойница и крупный калибр меняют пулемёт.
      const s = this.run.car.stats, h = s.heavyGun;
      return Object.assign({}, d, {
        damage: d.damage * s.gunMult * (h ? 1.8 + h * 0.4 : 1),
        rate: d.rate * (h ? 0.6 : 1),
        range: d.range + h * 5,
      });
    }

    wear(id, pct) {
      const before = this.dur[id];
      this.dur[id] = Math.max(0, this.dur[id] - pct);
      if (before > 0 && this.dur[id] <= 0) {
        this.run.say(`${window.CONFIG.WEAPONS[id].name}: прочность кончилась — почините на станке`);
        window.Sound.broken();
      }
    }

    update(dt) {
      const car = this.run.car, st = this.state;
      st.gunFlash = Math.max(0, st.gunFlash - dt);
      st.sawSpin += dt * (this.works('saw') ? 30 : 0);
      st.tracers = st.tracers.filter((t) => (t.t -= dt) > 0);
      st.flame = 0;
      st.sawCut = 0;
      if (this.run.ended) return;
      if (this.works('gun')) this.gun(dt, car);
      if (this.works('flamer')) this.flamer(dt, car);
      if (this.works('saw')) this.saw(dt, car);
    }

    // Пулемёт: башня наводится на ближайшего живого заражённого впереди.
    gun(dt, car) {
      const W = this.def('gun'), st = this.state;
      const A = car.def.anchors;
      const mount = car.chassis.getWorldPoint(pl.Vec2((A.roofX[0] + A.roofX[1]) / 2, A.roofY + 0.25));
      let target = null, best = W.range;
      for (const z of this.run.horde.active) {
        if (!z.alive) continue;
        const p = z.body.getPosition();
        const dx = p.x - mount.x;
        if (dx < 1 || dx > W.range) continue;
        // Сильные мутанты в приоритете: по ним полезнее стрелять издалека.
        const d = Math.hypot(dx, p.y + z.def.h * 0.2 - mount.y) - (z.def.hp > 100 ? 6 : 0);
        if (d < best) { best = d; target = z; }
      }
      const carAngle = car.chassis.getAngle();
      if (!target) {
        st.gunAngle += (0 - st.gunAngle) * Math.min(1, dt * 3);
        return;
      }
      const tp = target.body.getPosition();
      const aim = Math.atan2(tp.y + target.def.h * 0.2 - mount.y, tp.x - mount.x) - carAngle;
      st.gunAngle += (aim - st.gunAngle) * Math.min(1, dt * 12);
      this.cool -= dt;
      if (this.cool > 0) return;
      this.cool = 1 / W.rate;
      const a = st.gunAngle + carAngle + (Math.random() - 0.5) * W.spread;
      // Пуля — луч: первый живой заражённый на линии огня.
      let hit = null, hitD = W.range;
      for (const z of this.run.horde.active) {
        if (!z.alive) continue;
        const p = z.body.getPosition();
        const rx = p.x - mount.x, ry = p.y - mount.y;
        const along = rx * Math.cos(a) + ry * Math.sin(a);
        if (along < 0 || along > hitD) continue;
        const perp = Math.abs(-rx * Math.sin(a) + ry * Math.cos(a));
        if (perp < z.def.h * 0.5) { hit = z; hitD = along; }
      }
      const end = { x: mount.x + Math.cos(a) * hitD, y: mount.y + Math.sin(a) * hitD };
      st.tracers.push({ x1: mount.x, y1: mount.y, x2: end.x, y2: end.y, t: 0.06 });
      st.gunFlash = 0.05;
      if (hit) {
        this.run.horde.damage(hit, W.damage, { x: Math.cos(a) * 4, y: 0 });
        if (Math.random() < 0.5) window.Render.blood(this.run, end.x, end.y, 2, 3);
      }
      this.wear('gun', W.wear);
      if (!this.sndCool || this.sndCool < this.run.time) { window.Sound.shot(false); this.sndCool = this.run.time + 0.09; }
    }

    // Огнемёт: конус огня перед машиной, жжёт всех в нём.
    flamer(dt, car) {
      const W = this.def('flamer'), st = this.state;
      const A = car.def.anchors;
      const nozzle = car.chassis.getWorldPoint(pl.Vec2(A.front + 0.15, A.bottom + 0.35));
      const dir = car.chassis.getAngle() - 0.08;
      const victims = [];
      for (const z of this.run.horde.active) {
        if (!z.alive) continue;
        const p = z.body.getPosition();
        const rx = p.x - nozzle.x, ry = p.y - nozzle.y;
        const d = Math.hypot(rx, ry);
        if (d > W.range + z.def.w / 2) continue;
        let da = Math.atan2(ry, rx) - dir;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < W.cone + 0.3 / Math.max(1, d)) victims.push(z);
      }
      if (!victims.length) return;
      st.flame = W.range;
      for (const z of victims) {
        this.run.horde.damage(z, W.dps * dt, { x: 2, y: 1 });
        z.burning = 1;
      }
      this.wear('flamer', W.wear * dt);
      if (!this.sndCool || this.sndCool < this.run.time) { window.Sound.flame(); this.sndCool = this.run.time + 0.25; }
    }

    // Пила: режет всех, кто оказался прямо перед бампером.
    saw(dt, car) {
      const W = this.def('saw'), st = this.state;
      const A = car.def.anchors;
      const tip = car.chassis.getWorldPoint(pl.Vec2(A.front + 0.4, A.bottom + 0.2));
      let cutting = false;
      for (const z of this.run.horde.active) {
        if (!z.alive) continue;
        const p = z.body.getPosition();
        if (Math.abs(p.x - tip.x) < W.reach + z.def.w / 2 && Math.abs(p.y - tip.y) < z.def.h / 2 + 0.4) {
          this.run.horde.damage(z, W.dps * dt, { x: car.speed + 3, y: 2 });
          if (Math.random() < 0.3) window.Render.blood(this.run, tip.x, tip.y, 3, car.speed + 4);
          cutting = true;
        }
      }
      if (!cutting) return;
      st.sawCut = 1;
      this.wear('saw', W.wear * dt);
      if (!this.sndCool || this.sndCool < this.run.time) { window.Sound.saw(); this.sndCool = this.run.time + 0.2; }
    }

    // Пули — в мировых координатах, поверх машины.
    drawWorld(ctx) {
      for (const t of this.state.tracers) {
        ctx.strokeStyle = `rgba(255,230,140,${t.t * 12})`;
        ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
      }
    }
  }

  // Детали оружия на кузове (координаты кузова). state — состояние в заезде (может отсутствовать).
  function drawOnCar(ctx, car, t) {
    const ups = car.ups || {}, def = car.def, A = def.anchors;
    const st = car.weaponState || {};
    if (ups.saw) {
      const x = A.front + 0.35, y = A.bottom + 0.2, r = 0.32 + ups.saw * 0.05;
      ctx.fillStyle = '#4a4c4e';
      ctx.fillRect(A.front - 0.1, y - 0.06, 0.45, 0.12);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-(st.sawSpin || t * 2));
      ctx.fillStyle = '#c8c8c0';
      ctx.beginPath();
      const teeth = 12;
      for (let i = 0; i < teeth * 2; i++) {
        const a = i / (teeth * 2) * Math.PI * 2;
        const rr = i % 2 ? r : r * 0.82;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a6a66';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (ups.flamer) {
      const x = A.front + 0.1, y = A.bottom + 0.35;
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(A.rear + 0.3, A.beltY - 0.25, 0.35, 0.3);   // баллон
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(x - 0.3, y - 0.05, 0.45, 0.1);
      ctx.fillStyle = '#c86a2a';
      ctx.fillRect(x + 0.12, y - 0.07, 0.08, 0.14);
      if (st.flame) {
        const len = st.flame;
        for (let i = 0; i < 6; i++) {
          const k = i / 6;
          const g = ctx.createRadialGradient(x + 0.3 + len * k, y - 0.1 * k, 0, x + 0.3 + len * k, y - 0.1 * k, 0.25 + k * 0.8);
          g.addColorStop(0, 'rgba(255,230,120,0.85)');
          g.addColorStop(0.5, 'rgba(255,120,30,0.6)');
          g.addColorStop(1, 'rgba(200,40,10,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x + 0.3 + len * k + Math.random() * 0.2, y - 0.1 * k, 0.25 + k * 0.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    if (ups.gun) {
      const x = (A.roofX[0] + A.roofX[1]) / 2, y = A.roofY;
      ctx.fillStyle = '#3a3c3e';
      ctx.fillRect(x - 0.3, y, 0.6, 0.12);                       // основание
      ctx.save();
      ctx.translate(x, y + 0.25);
      ctx.rotate(st.gunAngle || 0);
      ctx.fillStyle = '#2a2c2e';
      ctx.fillRect(-0.25, -0.12, 0.5, 0.24);                      // короб
      ctx.fillRect(0.2, -0.04, 0.55 + ups.gun * 0.1, 0.08);      // ствол
      if (ups.gun >= 3) ctx.fillRect(0.2, 0.06, 0.5 + ups.gun * 0.08, 0.05); // второй ствол
      if (ups.heavyGun) { ctx.fillRect(0.2, -0.09, 1.1 + ups.heavyGun * 0.2, 0.14); ctx.fillStyle = '#4a4a3a'; ctx.fillRect(1.1 + ups.heavyGun * 0.2, -0.12, 0.2, 0.2); ctx.fillStyle = '#2a2c2e'; }
      ctx.fillStyle = '#5a5c3a';
      ctx.fillRect(-0.3, -0.18, 0.12, 0.36);                      // щиток
      if (st.gunFlash) {
        ctx.fillStyle = 'rgba(255,220,120,0.95)';
        ctx.beginPath(); ctx.arc(0.85 + ups.gun * 0.1, 0, 0.16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  window.Weapons = Object.assign(Weapons, { drawOnCar });
})();
