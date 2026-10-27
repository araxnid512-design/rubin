// Один заезд: мир, трасса, машина, заражённые, добыча; условия конца и награда.
(function () {
  const C = () => window.CONFIG;

  class Run {
    // opts: { levelIndex, startCp, carId, stats, fuel, hp, best }
    constructor(opts) {
      const cfg = C();
      this.levelIndex = opts.levelIndex;
      this.level = cfg.LEVELS[opts.levelIndex];
      this.world = window.Physics.createWorld();
      this.terrain = new window.Terrain(this.world, this.level);
      this.obstacles = window.Obstacles.place(this.world, this.terrain);
      const def = cfg.CARS[opts.carId];
      this.checkpoint = opts.startCp || 0;
      const x0 = this.checkpoint ? this.terrain.checkpoints[this.checkpoint - 1] : 6;
      this.car = new window.Physics.Car(this.world, def, opts.stats, x0, this.terrain.heightAt(x0) + 1.2);
      this.car.ups = opts.ups || {};
      if (opts.fuel != null) this.car.fuel = Math.min(opts.fuel, opts.stats.tank);
      if (opts.hp != null) this.car.hp = Math.min(opts.hp, opts.stats.hp);
      this.startX = x0;
      this.maxX = x0;
      this.prevBest = opts.best || 0;
      this.time = 0;
      this.finished = false;
      this.ended = null;
      this.stillTime = 0;
      this.particles = [];
      this.loot = { sporan: 0, peas: 0, pearl: 0 };
      this.kills = 0;
      this.canisters = 0;
      this.messages = [];

      this.pickups = new window.Pickups(this.terrain, {
        onCollect: (kind, n) => {
          if (kind === 'canister') {
            this.car.fuel = Math.min(this.car.stats.tank, this.car.fuel + this.car.stats.canisterFuel);
            this.canisters++;
            this.say('Канистра: +' + this.car.stats.canisterFuel + ' л');
          } else {
            this.loot[kind] += n;
          }
          window.Sound.pickup();
        },
      });
      this.horde = new window.Horde(this.world, this.terrain, this.level, {
        onKill: (z, p) => {
          this.kills++;
          const d = z.def.drops;
          if (Math.random() < d.sporanChance) {
            const n = d.sporans[0] + Math.floor(Math.random() * (d.sporans[1] - d.sporans[0] + 1));
            if (n) this.pickups.drop('sporan', n, p.x, p.y);
          }
          const loot = z.loot || {};
          if (loot.peas) this.pickups.drop('peas', z.def.drops.peas >= 1 ? 3 : 1, p.x, p.y);
          if (loot.pearl) this.pickups.drop('pearl', 1, p.x, p.y);
          if (z.boss) this.say(`${z.def.name} повержена! Путь к стабу свободен`);
          window.Render.blood(this, p.x, p.y, 14, this.car.speed);
          window.Sound.crunch(Math.min(1, z.def.mass / 200 + 0.4));
        },
        onCarHit: (dmg) => {
          this.car.hp = Math.max(0, this.car.hp - dmg);
          this.hurt = 0.25;
        },
      });
      this.world.on('begin-contact', (c) => this.horde.contact(c));
      const ups = this.car.ups;
      this.weapons = new window.Weapons(this, { gun: ups.gun || 0, flamer: ups.flamer || 0, saw: ups.saw || 0 }, opts.weapons);
    }

    say(text) { this.messages.push(text); }

    step(dt, input) {
      const P = C().PHYSICS;
      const car = this.car;
      car.control(this.ended ? { gas: false, nitro: false, tilt: 0 } : input, dt);
      this.world.step(dt, P.velocityIterations, P.positionIterations);
      this.horde.afterStep(car, dt);
      this.weapons.update(dt);
      this.water(car);
      this.dropMines(car, dt);
      // Лебёдка ставит перевёрнутую машину на колёса.
      if (car.flipTimer > 0.8 && car.winchLeft > 0 && !this.ended) {
        car.winchLeft--;
        car.rightUp(this.terrain.heightAt(car.pos.x));
        this.say('Лебёдка поставила машину на колёса' + (car.winchLeft ? ` (ещё ${car.winchLeft})` : ''));
        window.Sound.thud(0.8);
      }
      this.pickups.update(car, dt);
      window.Render.particles(this, dt);
      this.time += dt;
      this.hurt = Math.max(0, (this.hurt || 0) - dt);
      const x = car.pos.x;
      if (x > this.maxX + 0.5) { this.maxX = x; this.idle = 0; } else this.idle = (this.idle || 0) + dt;
      const cps = this.terrain.checkpoints;
      while (this.checkpoint < cps.length && x >= cps[this.checkpoint]) {
        this.checkpoint++;
        this.say(`Чекпоинт ${this.checkpoint} из ${cps.length}`);
      }
      if (!this.ended) this.checkEnd(dt);
    }

    // Броды: без шноркеля мотор захлёбывается, машину тормозит вода.
    water(car) {
      car.choke = 1;
      const p = car.pos;
      for (const m of this.terrain.marks) {
        if (m.type !== 'ford' || p.x < m.x || p.x > m.x + m.w) continue;
        if (p.y - 0.3 > m.y) continue;
        if (!car.stats.snorkel) car.choke = car.stats.wade || window.CONFIG.PHYSICS.waterChoke;
        const v = car.chassis.getLinearVelocity();
        car.chassis.applyForceToCenter(window.planck.Vec2(-v.x * car.chassis.getMass() * 0.6, 0), true);
        if (Math.random() < 0.3 && Math.abs(v.x) > 2) this.particles.push({ x: p.x + (Math.random() - 0.5) * 3, y: m.y, vx: v.x * 0.2, vy: 2 + Math.random() * 3, t: 0.6, r: 0.08, c: 'rgba(160,200,210,0.8)' });
      }
    }

    // Мины: падают позади на ходу, рвутся под заражёнными.
    dropMines(car, dt) {
      const lvl = car.stats.mines;
      if (!this.mines) this.mines = [];
      if (lvl && !this.ended && Math.abs(car.speed) > 3) {
        this.mineTimer = (this.mineTimer || 0) - dt;
        if (this.mineTimer <= 0) {
          this.mineTimer = 7 - lvl * 1.5;
          const x = car.pos.x + car.def.anchors.rear - 0.5;
          this.mines.push({ x, y: this.terrain.heightAt(x) + 0.08, armed: 0.8 });
        }
      }
      for (const m of this.mines) {
        m.armed -= dt;
        if (m.armed > 0 || m.boom) continue;
        for (const z of this.horde.active) {
          if (!z.alive) continue;
          const p = z.body.getPosition();
          if (Math.abs(p.x - m.x) < 1.6) { m.boom = 0.4; break; }
        }
        if (m.boom) {
          for (const z of this.horde.active.slice()) {
            const p = z.body.getPosition();
            if (z.alive && Math.hypot(p.x - m.x, p.y - m.y) < 3.5) this.horde.damage(z, 150 * lvl, { x: Math.sign(p.x - m.x) * 6, y: 8, fling: 2 });
          }
          window.Render.blood(this, m.x, m.y + 0.5, 20, 0);
          window.Sound.thud(1);
        }
      }
      for (const m of this.mines) if (m.boom) m.boom -= dt;
      this.mines = this.mines.filter((m) => !(m.boom != null && m.boom <= 0) && m.x > car.pos.x - 80);
    }

    // Конец заезда: доехали до стаба, разбита, перевернулась, кончился бензин.
    checkEnd(dt) {
      const car = this.car, E = C().ECONOMY;
      if (this.terrain.stab && car.pos.x >= this.terrain.stab.x) return this.end('stab');
      if (car.hp <= 0) return this.end('wreck');
      if (car.flipped) return this.end('flip');
      if (this.idle > E.stuckTime) return this.end('stuck');
      if (car.fuel <= 0) {
        this.stillTime = Math.abs(car.speed) < 0.4 ? this.stillTime + dt : 0;
        if (this.stillTime > E.outOfFuelStopTime) return this.end('fuel');
      }
    }

    end(reason) {
      if (this.ended) return;
      this.ended = reason;
      this.finished = reason === 'stab';
      window.Sound.engineOff();
    }

    // Итог заезда — для экрана итогов и сохранения.
    results() {
      const E = C().ECONOMY, pay = this.level.pay || 1;
      const dist = Math.max(0, this.maxX - this.startX);
      const beyond = Math.max(0, this.maxX - Math.max(this.prevBest, this.startX));
      const r = {
        reason: this.ended || 'quit',
        level: this.level,
        distance: Math.round(dist),
        reached: Math.round(this.maxX),
        total: Math.round(this.terrain.stab.x),
        kills: this.kills,
        byKind: Object.assign({}, this.horde.kills),
        loot: Object.assign({}, this.loot),
        canisters: this.canisters,
        distanceSporans: Math.floor(dist / 100 * E.sporansPer100m * pay),
        recordSporans: Math.floor(beyond / 100 * E.recordPer100m * pay),
        stabBonus: this.finished ? Math.round(E.stabBonus * pay) : 0,
        record: this.maxX > this.prevBest + 1,
        checkpoint: this.checkpoint,
        fuelLeft: this.car.fuel,
        hpLeft: this.car.hp,
        weapons: Object.assign({}, this.weapons.dur),
        time: Math.round(this.time),
      };
      r.sporans = r.loot.sporan + r.distanceSporans + r.recordSporans + r.stabBonus;
      return r;
    }
  }

  // Записать итог в сохранение.
  function apply(save, r, levelIndex) {
    const ls = window.Save.levelState(save, r.level.id);
    save.sporans += r.sporans;
    save.peas += r.loot.peas;
    save.pearls += r.loot.pearl;
    ls.best = Math.max(ls.best, r.reached);
    ls.checkpoint = Math.max(ls.checkpoint, r.checkpoint);
    if (r.reason === 'stab') {
      ls.done = true;
      save.level = Math.min(window.CONFIG.LEVELS.length - 1, Math.max(save.level, levelIndex + 1));
    }
    save.stats.runs++;
    save.stats.kills += r.kills;
    save.stats.distance += r.distance;
  }

  window.Run = Run;
  window.RunResults = { apply };
})();
