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
          if (Math.random() < d.peas) this.pickups.drop('peas', 1, p.x, p.y);
          if (Math.random() < d.pearl) this.pickups.drop('pearl', 1, p.x, p.y);
          window.Render.blood(this, p.x, p.y, 14, this.car.speed);
          window.Sound.crunch(Math.min(1, z.def.mass / 200 + 0.4));
        },
        onCarHit: (dmg) => {
          this.car.hp = Math.max(0, this.car.hp - dmg);
          this.hurt = 0.25;
        },
      });
      this.world.on('begin-contact', (c) => this.horde.contact(c));
    }

    say(text) { this.messages.push(text); }

    step(dt, input) {
      const P = C().PHYSICS;
      const car = this.car;
      car.control(this.ended ? { gas: false, brake: false, nitro: false } : input, dt);
      this.world.step(dt, P.velocityIterations, P.positionIterations);
      this.horde.afterStep(car, dt);
      this.pickups.update(car, dt);
      window.Render.particles(this, dt);
      this.time += dt;
      this.hurt = Math.max(0, (this.hurt || 0) - dt);
      const x = car.pos.x;
      this.maxX = Math.max(this.maxX, x);
      const cps = this.terrain.checkpoints;
      while (this.checkpoint < cps.length && x >= cps[this.checkpoint]) {
        this.checkpoint++;
        this.say(`Чекпоинт ${this.checkpoint} из ${cps.length}`);
      }
      if (!this.ended) this.checkEnd(dt);
    }

    // Конец заезда: доехали до стаба, разбита, перевернулась, кончился бензин.
    checkEnd(dt) {
      const car = this.car, E = C().ECONOMY;
      if (this.terrain.stab && car.pos.x >= this.terrain.stab.x) return this.end('stab');
      if (car.hp <= 0) return this.end('wreck');
      if (car.flipped) return this.end('flip');
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
      const E = C().ECONOMY;
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
        distanceSporans: Math.floor(dist / 100 * E.sporansPer100m),
        recordSporans: Math.floor(beyond / 100 * E.recordPer100m),
        stabBonus: this.finished ? E.stabBonus : 0,
        record: this.maxX > this.prevBest + 1,
        checkpoint: this.checkpoint,
        fuelLeft: this.car.fuel,
        hpLeft: this.car.hp,
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
