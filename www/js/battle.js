// Боевой движок: одна «сцена» для трёх режимов.
//   base    — мирная база: бойцы ходят по территории, часовые на вышках;
//   sortie  — вылазка в район города: отряд по приказу, зомби, мародёры, выжившие, добыча;
//   defense — ночная оборона части от орды.
(function () {
  const D = window.GameData;
  const { WALL } = window.Cell;

  class Battle {
    constructor(map, mode, opts) {
      this.map = map;
      this.grid = map.grid;
      this.mode = mode;
      this.opts = opts || {};
      this.time = 0;
      this.soldiers = [];
      this.zombies = [];
      this.marauders = [];
      this.survivors = [];
      this.loot = [];
      this.haul = { food: 0, meds: 0, materials: 0, ammo: 0, rifles: 0 };
      this.stats = { kills: 0, shots: 0, maraudersKilled: 0 };
      this.events = [];
      this.fx = { tracers: [], blood: [], corpses: [], numbers: [], flashes: [], shake: 0 };
      this.order = null;
      this.orderFlow = null;
      this.zFlow = null;
      this.zFlowTimer = 0;
      this.zFlowVersion = -1;
      this.cleared = false;
      this.retreating = false;
      this.result = null;
      this.soundTimer = 0;
      this.ammoPool = this.opts.ammoPool || null; // общий запас базы (оборона)
      this.setup();
    }

    // --- Расстановка ---
    setup() {
      const m = this.map, o = this.opts;
      if (this.mode === 'sortie') {
        for (let i = 0; i < o.soldiers; i++) {
          const p = this.grid.freeNear(m.entry.x + (i % 6) - 2.5, m.entry.y - Math.floor(i / 6) * 1.2, 6);
          this.soldiers.push(this.makeSoldier(p.x, p.y, o.ammoPer));
        }
        for (const z of m.zombieSpots) {
          if (Math.random() < (o.clearedFraction || 0)) continue;
          this.zombies.push(this.makeZombie(z.type, z.x, z.y));
        }
        for (const p of m.marauderSpots) {
          if (Math.random() < (o.clearedFraction || 0)) continue;
          this.marauders.push({ x: p.x, y: p.y, hp: D.MARAUDER.hp, angle: Math.PI / 2, cool: 0, state: 'idle', home: { x: p.x, y: p.y }, hitFlash: 0 });
        }
        for (const s of m.survivorSpots) {
          if (Math.random() < (o.clearedFraction || 0) * 0.7) continue;
          this.survivors.push({ x: s.x, y: s.y, hp: D.SURVIVOR.hp, state: 'hiding', angle: 0 });
        }
        for (const l of m.lootPoints) {
          if (Math.random() < (o.lootTaken || 0)) continue;
          this.loot.push({ x: l.x, y: l.y, items: rollLoot(l.kind, l.camp), taken: false });
        }
        this.zombiesStart = this.zombies.length;
        this.orderMove(m.entry.x, m.entry.y - 6);
      } else if (this.mode === 'base' || this.mode === 'defense') {
        const n = o.soldiers;
        const towers = m.towers.slice();
        for (let i = 0; i < n; i++) {
          const s = this.makeSoldier(0, 0, 0);
          if (i < towers.length) {
            s.tower = towers[i];
            s.x = s.tower.x; s.y = s.tower.y;
          } else if (this.mode === 'defense') {
            s.post = m.defense[(i - towers.length) % m.defense.length];
            // На стенах дежурная смена, остальные спят в казарме и прибегают по тревоге.
            const onDuty = i < towers.length + Math.ceil(n * D.NIGHT_WATCH);
            const from = onDuty ? s.post : m.barracksDoor;
            const p = this.grid.freeNear(from.x + (Math.random() - 0.5) * 2, from.y + (Math.random() - 0.5) * 2, 6);
            s.x = p.x; s.y = p.y;
            if (!onDuty) s.asleep = 8 + Math.random() * 16;
          } else {
            const poi = m.pois[i % m.pois.length];
            const p = this.grid.freeNear(poi.x + (Math.random() - 0.5) * 4, poi.y + (Math.random() - 0.5) * 3, 5);
            s.x = p.x; s.y = p.y;
            s.wait = Math.random() * 5;
          }
          this.soldiers.push(s);
        }
        if (this.mode === 'defense') {
          const rand = window.rng(Math.floor(Math.random() * 1e9));
          const spots = window.Maps.hordeSpawns(m, o.hordeSize, rand, o.waves || 2);
          const mix = o.hordeMix || { walker: 0.7, runner: 0.22, brute: 0.08 };
          spots.forEach((p) => {
            let r = Math.random(), kind = 'walker';
            for (const [k, share] of Object.entries(mix)) { if ((r -= share) <= 0) { kind = k; break; } }
            const z = this.makeZombie(kind, p.x, p.y);
            // В орде заражённые злее: крепче и быстрее одиночек в городе.
            z.hp *= D.HORDE.hpMult;
            z.maxHp = z.hp;
            z.speedMult = D.HORDE.speedMult;
            z.state = 'chase';
            z.delay = p.delay;
            this.zombies.push(z);
          });
          this.zombiesStart = this.zombies.length;
        }
      }
    }

    makeSoldier(x, y, ammo) {
      return { x, y, hp: D.SOLDIER.hp, ammo, cool: Math.random() * 0.4, angle: -Math.PI / 2, target: null, scan: 0, hitFlash: 0, slot: null };
    }

    makeZombie(kind, x, y) {
      const T = D.ZOMBIES[kind];
      return { kind, type: T, x, y, hp: T.hp, maxHp: T.hp, speedMult: 1, angle: Math.random() * 6.28, state: 'idle', cool: 0, hitFlash: 0,
        seed: Math.random(), wander: { x, y, t: Math.random() * 3 }, delay: 0 };
    }

    // --- Приказы отряду ---
    orderMove(x, y) {
      const p = this.grid.freeNear(x, y, 4);
      this.order = p;
      this.orderFlow = this.grid.flow([p], 0);
      const alive = this.soldiers.filter((s) => s.hp > 0);
      // Строй: кольца вокруг точки приказа.
      alive.forEach((s, i) => {
        if (i === 0) { s.slot = { dx: 0, dy: 0 }; return; }
        const ring = Math.ceil(Math.sqrt(i / 3));
        const perRing = ring * 6;
        const a = (i / perRing) * Math.PI * 2 + ring;
        s.slot = { dx: Math.cos(a) * ring * 1.1, dy: Math.sin(a) * ring * 1.1 };
      });
    }

    retreat() {
      const e = this.map.exit;
      this.retreating = true;
      this.orderMove(e.x + e.w / 2, e.y + e.h / 2);
      this.event('Отряд отходит к точке эвакуации', 'info');
    }

    centroid() {
      const alive = this.soldiers.filter((s) => s.hp > 0);
      if (!alive.length) return { x: this.map.w / 2, y: this.map.h / 2 };
      const x = alive.reduce((a, s) => a + s.x, 0) / alive.length;
      const y = alive.reduce((a, s) => a + s.y, 0) / alive.length;
      return { x, y };
    }

    event(text, kind) { this.events.push({ text, kind: kind || 'info' }); }

    // --- Кадр ---
    update(dt) {
      if (this.result) return;
      this.time += dt;
      this.soundTimer -= dt;
      this.updateZombieFlow(dt);
      for (const s of this.soldiers) if (s.hp > 0) this.updateSoldier(s, dt);
      for (const z of this.zombies) this.updateZombie(z, dt);
      for (const m of this.marauders) this.updateMarauder(m, dt);
      for (const v of this.survivors) this.updateSurvivor(v, dt);
      this.separate();
      this.pickupLoot();
      this.cleanup();
      this.updateFx(dt);
      this.checkEnd();
    }

    updateZombieFlow(dt) {
      if (this.mode === 'base') return;
      this.zFlowTimer -= dt;
      if (this.zFlowTimer > 0 && this.zFlowVersion === this.grid.version) return;
      this.zFlowTimer = 0.5;
      this.zFlowVersion = this.grid.version;
      const sources = this.soldiers.filter((s) => s.hp > 0).map((s) => ({ x: s.x, y: s.y }));
      for (const v of this.survivors) if (v.state === 'follow' && v.hp > 0) sources.push(v);
      this.zFlow = sources.length ? this.grid.flow(sources, this.mode === 'defense' ? 14 : 0) : null;
    }

    // --- Бойцы ---
    updateSoldier(s, dt) {
      if (s.asleep > 0) { s.asleep -= dt; return; }
      s.cool -= dt;
      s.hitFlash -= dt;
      s.scan -= dt;
      const night = this.mode === 'defense';
      const range = (night ? D.RIFLE.nightRange : D.RIFLE.range) + (s.tower ? D.RIFLE.towerBonus : 0);
      if (s.scan <= 0) {
        s.scan = 0.25;
        s.target = this.mode === 'base' ? null : this.findTarget(s, range);
      }
      const t = s.target && s.target.hp > 0 ? s.target : null;
      if (t) s.angle = Math.atan2(t.y - s.y, t.x - s.x);

      // Движение.
      const speed = D.SOLDIER.speed;
      if (this.mode === 'sortie' && this.order) {
        const holdFire = t && !this.retreating && Math.hypot(t.x - s.x, t.y - s.y) < 11;
        if (!holdFire && s.slot) {
          const gx = this.order.x + s.slot.dx, gy = this.order.y + s.slot.dy;
          const d = Math.hypot(gx - s.x, gy - s.y);
          if (d > 2.5) {
            const step = this.grid.nextStep(this.orderFlow, s.x, s.y);
            if (step) this.moveTo(s, step.x, step.y, speed, dt, D.SOLDIER.radius, !t);
            else this.moveTo(s, gx, gy, speed, dt, D.SOLDIER.radius, !t);
          } else if (d > 0.2) {
            this.moveTo(s, gx, gy, speed * 0.7, dt, D.SOLDIER.radius, !t);
          }
        }
      } else if (this.mode === 'defense') {
        // Резерв: кому некого бить, перебегает к угрожаемому участку стены.
        s.reTimer = (s.reTimer || 0) - dt;
        if (!t && !s.tower && s.reTimer <= 0) {
          s.reTimer = 2 + Math.random();
          const threat = this.nearestActiveZombie(s);
          if (threat) {
            const posts = this.map.defense.slice().sort((a, b) =>
              Math.hypot(a.x - threat.x, a.y - threat.y) - Math.hypot(b.x - threat.x, b.y - threat.y));
            s.post = posts[Math.floor(Math.random() * Math.min(6, posts.length))];
          }
        }
        if (s.post && !s.tower) {
          const d = Math.hypot(s.post.x - s.x, s.post.y - s.y);
          if (d > 0.3) this.moveTo(s, s.post.x, s.post.y, speed * 1.2, dt, D.SOLDIER.radius, !t);
        }
      } else if (this.mode === 'base' && !s.tower) {
        s.wait -= dt;
        if (s.wait <= 0 && !s.goal) {
          const poi = this.map.pois[Math.floor(Math.random() * this.map.pois.length)];
          s.goal = this.grid.freeNear(poi.x + (Math.random() - 0.5) * 4, poi.y + (Math.random() - 0.5) * 3, 5);
          s.goalFlow = this.grid.flow([s.goal], 0);
        }
        if (s.goal) {
          const d = Math.hypot(s.goal.x - s.x, s.goal.y - s.y);
          if (d < 0.6) { s.goal = null; s.goalFlow = null; s.wait = 3 + Math.random() * 8; }
          else {
            const step = d > 1.5 ? this.grid.nextStep(s.goalFlow, s.x, s.y) : null;
            this.moveTo(s, step ? step.x : s.goal.x, step ? step.y : s.goal.y, speed * 0.45, dt, D.SOLDIER.radius, true);
          }
        }
      }

      // Огонь очередями.
      if (t && s.cool <= 0) {
        const pool = this.ammoPool;
        const have = pool ? pool.ammo : s.ammo;
        if (have <= 0) {
          if (!s.noAmmoTold && this.mode === 'sortie') { s.noAmmoTold = true; this.event('У бойца закончились патроны', 'warn'); }
          return;
        }
        this.fire(s, t, range, Math.min(D.RIFLE.burst, have));
      }
    }

    nearestActiveZombie(s) {
      let best = null, bd = Infinity;
      for (const z of this.zombies) {
        if (z.delay > 0) continue;
        const d = Math.hypot(z.x - s.x, z.y - s.y);
        if (d < bd) { best = z; bd = d; }
      }
      return best;
    }

    findTarget(s, range) {
      let best = null, bestD = range;
      for (const z of this.zombies) {
        if (z.hp <= 0 || z.delay > 0) continue;
        const d = Math.hypot(z.x - s.x, z.y - s.y);
        if (d < bestD && this.grid.los(s.x, s.y, z.x, z.y)) { best = z; bestD = d; }
      }
      for (const m of this.marauders) {
        if (m.hp <= 0) continue;
        const d = Math.hypot(m.x - s.x, m.y - s.y);
        if (d < Math.min(bestD + 3, range) && this.grid.los(s.x, s.y, m.x, m.y)) { best = m; bestD = d; }
      }
      return best;
    }

    fire(s, t, range, rounds) {
      const R = D.RIFLE;
      s.cool = R.interval * (0.85 + Math.random() * 0.3);
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      let acc = R.accuracyNear + (R.accuracyFar - R.accuracyNear) * Math.min(1, d / range);
      if (s.tower) acc *= 1.15;
      if (this.mode === 'defense') acc *= D.RIFLE.nightAccuracy;
      for (let i = 0; i < rounds; i++) {
        if (this.ammoPool) this.ammoPool.ammo--; else s.ammo--;
        this.stats.shots++;
        if (t.hp > 0 && Math.random() < acc) this.hit(t, R.damage, s);
      }
      const j = () => (Math.random() - 0.5) * 0.8;
      this.fx.tracers.push({ x1: s.x, y1: s.y, x2: t.x + j(), y2: t.y + j(), t: 0.07 });
      this.fx.flashes.push({ x: s.x + Math.cos(s.angle) * 0.6, y: s.y + Math.sin(s.angle) * 0.6, t: 0.06 });
      if (this.soundTimer <= 0) { window.Sound.burst(); this.soundTimer = 0.09; }
      // Выстрелы слышно далеко — заражённые идут на звук.
      for (const z of this.zombies) {
        if (z.state !== 'chase' && Math.hypot(z.x - s.x, z.y - s.y) < R.noise) z.state = 'chase';
      }
      for (const m of this.marauders) {
        if (m.state === 'idle' && Math.hypot(m.x - s.x, m.y - s.y) < 25) m.state = 'fight';
      }
    }

    hit(t, dmg, from) {
      t.hp -= dmg;
      t.hitFlash = 0.1;
      if (this.fx.blood.length < 160 && Math.random() < 0.5) {
        this.fx.blood.push({ x: t.x + (Math.random() - 0.5) * 0.6, y: t.y + (Math.random() - 0.5) * 0.6, r: 0.12 + Math.random() * 0.2, t: 60 });
      }
      if (t.state === 'idle' && from) t.state = t.home ? 'fight' : 'chase';
    }

    // Шаг к точке со скольжением вдоль препятствий.
    moveTo(e, x, y, speed, dt, r, face) {
      const dx = x - e.x, dy = y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-4) return;
      const step = Math.min(d, speed * dt);
      e.x += dx / d * step;
      e.y += dy / d * step;
      this.grid.collide(e, r);
      if (face) e.angle = Math.atan2(dy, dx);
    }

    // --- Заражённые ---
    updateZombie(z, dt) {
      if (z.hp <= 0) return;
      if (z.delay > 0) { z.delay -= dt; return; }
      const T = z.type;
      const speed = T.speed * z.speedMult;
      z.cool -= dt;
      z.hitFlash -= dt;

      // Ближайшая жертва (бойцы, выжившие, мародёры).
      let prey = null, preyD = Infinity;
      const consider = (h) => {
        if (h.hp <= 0) return;
        const d = Math.hypot(h.x - z.x, h.y - z.y);
        if (d < preyD) { prey = h; preyD = d; }
      };
      this.soldiers.forEach(consider);
      this.survivors.forEach((v) => { if (v.state !== 'safe') consider(v); });
      this.marauders.forEach(consider);

      if (z.state === 'idle') {
        if (prey && preyD < T.sight && this.grid.los(z.x, z.y, prey.x, prey.y)) {
          z.state = 'chase';
          for (const o of this.zombies) if (o.state === 'idle' && Math.hypot(o.x - z.x, o.y - z.y) < 6) o.state = 'chase';
        } else {
          z.wander.t -= dt;
          if (z.wander.t <= 0) {
            z.wander.t = 3 + Math.random() * 5;
            z.wander.x = z.x + (Math.random() - 0.5) * 6;
            z.wander.y = z.y + (Math.random() - 0.5) * 6;
          }
          this.moveTo(z, z.wander.x, z.wander.y, speed * 0.35, dt, T.radius, true);
          return;
        }
      }

      const reach = T.radius + 0.35 + 0.3;
      if (prey && preyD < reach) {
        z.angle = Math.atan2(prey.y - z.y, prey.x - z.x);
        if (z.cool <= 0) {
          z.cool = T.interval;
          prey.hp -= T.damage;
          prey.hitFlash = 0.15;
          if (prey.home && prey.state === 'idle') prey.state = 'fight';
          if (this.soundTimer <= 0.05) window.Sound.hurt();
          if (this.soldiers.includes(prey)) this.fx.shake = Math.max(this.fx.shake, 0.25);
        }
        return;
      }

      // Идём по полю потоков; упёрлись в стену — ломаем.
      const step = this.zFlow ? this.grid.nextStep(this.zFlow, z.x, z.y) : null;
      if (step && step.wall) {
        const d = Math.hypot(step.x - z.x, step.y - z.y);
        if (d < T.radius + 0.9) {
          z.angle = Math.atan2(step.y - z.y, step.x - z.x);
          if (z.cool <= 0) {
            z.cool = T.interval;
            if (this.grid.damageWall(step.cx, step.cy, T.wallDamage)) this.event('Орда пробила стену!', 'bad');
          }
          return;
        }
        this.moveTo(z, step.x, step.y, speed, dt, T.radius, true);
      } else if (step) {
        this.moveTo(z, step.x, step.y, speed, dt, T.radius, true);
      } else if (prey) {
        this.moveTo(z, prey.x, prey.y, speed, dt, T.radius, true);
      }
    }

    // --- Мародёры ---
    updateMarauder(m, dt) {
      if (m.hp <= 0) return;
      const M = D.MARAUDER;
      m.cool -= dt;
      m.hitFlash -= dt;
      let target = null, td = Infinity;
      for (const s of this.soldiers) {
        if (s.hp <= 0) continue;
        const d = Math.hypot(s.x - m.x, s.y - m.y);
        if (d < td) { target = s; td = d; }
      }
      if (m.state === 'idle') {
        if (target && td < M.sight && this.grid.los(m.x, m.y, target.x, target.y)) {
          m.state = 'fight';
          this.event('Мародёры открыли огонь!', 'bad');
          for (const o of this.marauders) if (Math.hypot(o.x - m.x, o.y - m.y) < 14) o.state = 'fight';
        }
        return;
      }
      if (!target) return;
      const see = td < M.range && this.grid.los(m.x, m.y, target.x, target.y);
      m.angle = Math.atan2(target.y - m.y, target.x - m.x);
      if (see) {
        if (m.cool <= 0) {
          m.cool = M.interval * (0.8 + Math.random() * 0.4);
          const acc = M.accuracyNear + (M.accuracyFar - M.accuracyNear) * Math.min(1, td / M.range);
          for (let i = 0; i < M.burst; i++) {
            if (Math.random() < acc) {
              target.hp -= M.damage;
              target.hitFlash = 0.12;
            }
          }
          this.fx.tracers.push({ x1: m.x, y1: m.y, x2: target.x + (Math.random() - 0.5), y2: target.y + (Math.random() - 0.5), t: 0.07, enemy: true });
          this.fx.flashes.push({ x: m.x, y: m.y, t: 0.06 });
          if (this.soundTimer <= 0) { window.Sound.burst(true); this.soundTimer = 0.09; }
          for (const z of this.zombies) if (Math.hypot(z.x - m.x, z.y - m.y) < 25) z.state = 'chase';
        }
      } else {
        this.moveTo(m, target.x, target.y, M.speed, dt, M.radius, false);
      }
    }

    // --- Выжившие ---
    updateSurvivor(v, dt) {
      if (v.hp <= 0 || v.state === 'safe') return;
      v.hitFlash = (v.hitFlash || 0) - dt;
      let near = null, nd = Infinity;
      for (const s of this.soldiers) {
        if (s.hp <= 0) continue;
        const d = Math.hypot(s.x - v.x, s.y - v.y);
        if (d < nd) { near = s; nd = d; }
      }
      if (v.state === 'hiding') {
        if (near && nd < 3.2) {
          v.state = 'follow';
          this.event('Найден выживший! Он идёт с отрядом', 'good');
          window.Sound.pickup();
        }
        return;
      }
      if (near && nd > 1.8) {
        const step = this.order && nd > 5 ? this.grid.nextStep(this.orderFlow, v.x, v.y) : null;
        this.moveTo(v, step ? step.x : near.x, step ? step.y : near.y, D.SURVIVOR.speed, dt, D.SURVIVOR.radius, true);
      }
    }

    // --- Расталкивание юнитов (корзины 2×2 м) ---
    separate() {
      const all = [];
      for (const s of this.soldiers) if (s.hp > 0) all.push([s, D.SOLDIER.radius]);
      for (const z of this.zombies) if (z.hp > 0 && !(z.delay > 0)) all.push([z, z.type.radius]);
      for (const m of this.marauders) if (m.hp > 0) all.push([m, D.MARAUDER.radius]);
      for (const v of this.survivors) if (v.hp > 0 && v.state !== 'safe') all.push([v, D.SURVIVOR.radius]);
      const cells = new Map();
      for (const it of all) {
        const k = Math.floor(it[0].x / 2) * 1000 + Math.floor(it[0].y / 2);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(it);
      }
      for (const [a, ra] of all) {
        const cx = Math.floor(a.x / 2), cy = Math.floor(a.y / 2);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const list = cells.get((cx + dx) * 1000 + cy + dy);
          if (!list) continue;
          for (const [b, rb] of list) {
            if (b === a) continue;
            const ddx = b.x - a.x, ddy = b.y - a.y;
            const d = Math.hypot(ddx, ddy) || 1e-4;
            const min = ra + rb;
            if (d < min) {
              const push = (min - d) * 0.25;
              a.x -= ddx / d * push; a.y -= ddy / d * push;
            }
          }
        }
        this.grid.collide(a, ra);
      }
    }

    pickupLoot() {
      for (const l of this.loot) {
        if (l.taken) continue;
        for (const s of this.soldiers) {
          if (s.hp <= 0) continue;
          if (Math.hypot(s.x - l.x, s.y - l.y) < 1.4) { this.takeLoot(l); break; }
        }
      }
    }

    takeLoot(l) {
      l.taken = true;
      const parts = [];
      for (const [k, n] of Object.entries(l.items)) {
        this.haul[k] += n;
        parts.push(`${D.LOOT_NAMES[k]} +${n}`);
      }
      if (parts.length) this.event('Найдено: ' + parts.join(', '), 'good');
      window.Sound.pickup();
    }

    cleanup() {
      for (const z of this.zombies) {
        if (z.hp > 0) continue;
        this.stats.kills++;
        this.fx.corpses.push({ x: z.x, y: z.y, angle: z.angle, r: z.type.radius, color: z.type.color, t: 60 });
      }
      this.zombies = this.zombies.filter((z) => z.hp > 0);
      for (const m of this.marauders) {
        if (m.hp > 0) continue;
        this.stats.maraudersKilled++;
        this.fx.corpses.push({ x: m.x, y: m.y, angle: m.angle, r: 0.35, color: '#3a3a3a', t: 60 });
        this.loot.push({ x: m.x, y: m.y, items: { rifles: D.MARAUDER.loot.rifles, ammo: D.MARAUDER.loot.ammo }, taken: false, drop: true });
      }
      this.marauders = this.marauders.filter((m) => m.hp > 0);
      for (const s of this.soldiers) {
        if (s.hp > 0 || s.dead) continue;
        s.dead = true;
        this.fx.corpses.push({ x: s.x, y: s.y, angle: s.angle, r: 0.35, color: '#4a5a36', t: 600, soldier: true });
        this.event('Боец погиб', 'bad');
      }
      for (const v of this.survivors) {
        if (v.hp > 0 || v.dead) continue;
        v.dead = true;
        this.fx.corpses.push({ x: v.x, y: v.y, angle: v.angle, r: 0.33, color: '#6a5a7a', t: 60 });
        this.event('Выживший погиб', 'bad');
      }
    }

    updateFx(dt) {
      const f = this.fx;
      f.shake = Math.max(0, f.shake - dt * 3);
      for (const k of ['tracers', 'blood', 'corpses', 'numbers', 'flashes']) {
        for (const e of f[k]) e.t -= dt;
        f[k] = f[k].filter((e) => e.t > 0);
      }
      if (f.corpses.length > 220) f.corpses.splice(0, f.corpses.length - 220);
    }

    // --- Итог ---
    checkEnd() {
      const alive = this.soldiers.filter((s) => s.hp > 0);
      if (this.mode === 'sortie') {
        if (!alive.length) { this.finish('wiped'); return; }
        if (!this.cleared && this.zombies.length === 0 && this.marauders.length === 0) {
          this.cleared = true;
          for (const l of this.loot) if (!l.taken) this.takeLoot(l);
          for (const v of this.survivors) if (v.state === 'hiding' && v.hp > 0) v.state = 'follow';
          this.event('Район зачищен! Добыча собрана — можно возвращаться', 'good');
          window.Sound.quest();
        }
        if (this.retreating) {
          const e = this.map.exit;
          if (alive.every((s) => s.x > e.x - 1 && s.x < e.x + e.w + 1 && s.y > e.y - 1)) this.finish('extracted');
        }
      } else if (this.mode === 'defense') {
        if (!alive.length) { this.finish('overrun'); return; }
        if (this.zombies.length === 0) this.finish('held');
      }
    }

    // Завершить бой и посчитать итог для кампании.
    finish(outcome) {
      if (this.result) return this.result;
      const alive = this.soldiers.filter((s) => s.hp > 0);
      const dead = this.soldiers.length - alive.length;
      const res = {
        outcome,
        kills: this.stats.kills,
        maraudersKilled: this.stats.maraudersKilled,
        shots: this.stats.shots,
        sent: this.soldiers.length,
        dead,
        hp: alive.map((s) => s.hp),
        ammoLeft: alive.reduce((a, s) => a + Math.max(0, s.ammo), 0),
        haul: outcome === 'wiped' ? { food: 0, meds: 0, materials: 0, ammo: 0, rifles: 0 } : Object.assign({}, this.haul),
        survivors: outcome === 'wiped' ? 0 : this.survivors.filter((v) => v.state === 'follow' && v.hp > 0).length,
        // Оружие погибших возвращаем, только если район зачищен.
        rifleRecovered: this.cleared ? dead : 0,
        killedFraction: this.zombiesStart ? 1 - this.zombies.length / this.zombiesStart : 1,
        lootFraction: lootShare(this.loot),
        cleared: this.cleared,
      };
      if (this.mode === 'defense') {
        let sum = 0, max = 0;
        for (const c of this.map.wallCells) {
          const i = this.grid.idx(c.x, c.y);
          sum += this.grid.type[i] === WALL ? this.grid.wallHp[i] : 0;
          max += this.grid.wallMax[i];
        }
        res.wallIntegrity = max ? sum / max : 1;
      }
      this.result = res;
      return res;
    }
  }

  function lootShare(loot) {
    const placed = loot.filter((l) => !l.drop);
    return placed.length ? placed.filter((l) => l.taken).length / placed.length : 0;
  }

  function rollLoot(kind, camp) {
    const [a, b] = D.LOOT_AMOUNT[kind];
    let n = a + Math.floor(Math.random() * (b - a + 1));
    if (camp) n = Math.round(n * 1.5);
    return { [kind]: n };
  }

  window.Battle = Battle;
})();
