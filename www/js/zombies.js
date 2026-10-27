// Заражённые на трассе: появление рядом с машиной, поведение, удары, гибель, добыча.
//   Пустыш — медленный, давится легко.
//   Бегун — бежит, прыгает на машину, цепляется и бьёт по кабине.
//   Лотерейщик — крепкий, сильно тормозит машину.
//   Топтун — тяжёлый, подбрасывает машину (лёгкую может перевернуть).
//   Рубер — несётся навстречу и таранит.
//   Элита — босс.
(function () {
  const pl = window.planck;

  class Horde {
    constructor(world, terrain, level, hooks) {
      this.world = world;
      this.terrain = terrain;
      this.hooks = hooks;           // { onKill(z), onCarHit(dmg) }
      this.spawns = [];             // { x, kind }
      this.active = [];
      this.corpses = [];
      this.clinging = [];           // бегуны на машине
      this.events = [];             // столкновения, накопленные за шаг физики
      this.kills = {};
      this.buildSpawns(level);
    }

    // Толпы по всей трассе + отдельные группы из объектов уровня.
    buildSpawns(level) {
      const cr = level.crowds;
      if (cr) {
        const rand = window.Render.rng(level.id.length * 131 + 17);
        const end = (this.terrain.stab ? this.terrain.stab.x : this.terrain.length) - 25;
        for (let x = cr.startAt; x < end; x += cr.every * (0.6 + rand() * 0.8)) {
          if (this.terrain.checkpoints.some((c) => Math.abs(c - x) < 15)) continue;
          const n = cr.count[0] + Math.floor(rand() * (cr.count[1] - cr.count[0] + 1));
          for (let i = 0; i < n; i++) this.spawns.push({ x: x + i * (0.8 + rand() * 1.4), kind: pick(cr.mix, rand()) });
        }
      }
      for (const o of this.terrain.objects) {
        if (o.type !== 'zombies') continue;
        for (let i = 0; i < (o.count || 1); i++) this.spawns.push({ x: o.x + i * (o.spread || 1.3), kind: o.kind, y: o.y });
      }
      this.spawns.sort((a, b) => a.x - b.x);
      this.next = 0;
    }

    filter(alive) {
      const K = window.CONFIG.COLLIDE;
      return alive
        ? { filterCategoryBits: K.zombie, filterMaskBits: K.ground | K.body | K.wheel | K.heavy }
        : { filterCategoryBits: K.debris, filterMaskBits: K.ground };
    }

    spawn(s) {
      const def = window.CONFIG.ZOMBIES[s.kind];
      const ground = s.y != null ? s.y : this.terrain.heightAt(s.x);
      const body = this.world.createDynamicBody({ position: pl.Vec2(s.x, ground + def.h / 2 + 0.05), fixedRotation: true });
      body.createFixture(pl.Box(def.w / 2, def.h / 2), Object.assign({
        density: def.mass / (def.w * def.h), friction: 0.3,
      }, this.filter(true)));
      const z = { kind: s.kind, def, body, hp: def.hp, alive: true, phase: Math.random() * 6, cool: Math.random(), facing: -1 };
      body.setUserData({ kind: 'zombie', z });
      this.active.push(z);
    }

    // Столкновения из колбэков физики: копим, обрабатываем после шага.
    contact(c) {
      const ua = c.getFixtureA().getBody().getUserData() || {};
      const ub = c.getFixtureB().getBody().getUserData() || {};
      let z = null, part = null;
      if (ua.kind === 'zombie' && (ub.kind === 'chassis' || ub.kind === 'wheel')) { z = ua.z; part = ub; }
      else if (ub.kind === 'zombie' && (ua.kind === 'chassis' || ua.kind === 'wheel')) { z = ub.z; part = ua; }
      if (!z || !z.alive) return;
      // Скорость сближения — до того, как физика погасит удар (begin-contact идёт до решения).
      const cv = part.car.chassis.getLinearVelocity(), zv = z.body.getLinearVelocity();
      const rel = Math.hypot(cv.x - zv.x, cv.y - zv.y);
      const above = z.body.getPosition().y > part.car.chassis.getPosition().y + 0.2;
      this.events.push({ z, part, rel, above });
    }

    afterStep(car, dt) {
      const H = window.CONFIG.HORDE;
      const S = car.stats;
      const carV = car.chassis.getLinearVelocity();
      const carMass = car.totalMass();

      // Удары машины по заражённым.
      const seen = new Set();
      for (const { z, part, rel, above } of this.events) {
        if (!z.alive || seen.has(z)) continue;
        seen.add(z);
        // Бегун, упавший сверху на крышу, не разбивается, а цепляется.
        if (z.kind === 'runner' && above && part.kind === 'chassis' && this.clinging.length < z.def.cling.maxOnCar && !S.noClimb) {
          this.cling(z, car);
          continue;
        }
        let mult = S.ramMult;
        if (part.kind === 'wheel') {
          const wp = part.car[part.key].body.getPosition();
          if (wp.y > z.body.getPosition().y + z.def.h * 0.2) mult = H.crushUnderWheel * S.spikesMult;
        }
        if (rel > H.minKillSpeed) {
          const dmg = rel * carMass / 100 * mult;
          // Машине тоже достаётся: чем тяжелее заражённый, тем сильнее.
          this.hooks.onCarHit(rel * z.def.mass * H.impactDamage * S.armorMult, z);
          this.damage(z, dmg, carV);
          // Тяжёлые заражённые гасят скорость машины сильнее, чем по чистой физике.
          const drag = z.def.drag * (1 - S.ramDragCut);
          if (drag > 0) {
            const lost = carV.x * drag * (z.alive ? 1 : 0.5);
            car.chassis.applyLinearImpulse(pl.Vec2(-lost * car.chassis.getMass(), 0), car.chassis.getWorldCenter(), true);
          }
        }
        // Бегун цепляется, если пережил удар и запрыгнул сверху.
        if (z.alive && z.kind === 'runner' && (above || z.jumping) && this.clinging.length < z.def.cling.maxOnCar && !S.noClimb) this.cling(z, car);
      }
      this.events.length = 0;

      // Появление и удаление по расстоянию.
      const cx = car.pos.x;
      while (this.next < this.spawns.length && this.spawns[this.next].x < cx + H.activateAhead) {
        const s = this.spawns[this.next++];
        if (s.x > cx - 10) this.spawn(s);
      }
      for (const z of this.active) {
        if (z.body.getPosition().x < cx - H.removeBehind) { this.world.destroyBody(z.body); z.gone = true; }
      }
      this.active = this.active.filter((z) => !z.gone);

      for (const z of this.active) if (z.alive) this.think(z, car, dt);
      this.updateClinging(car, dt);

      for (const z of this.active) z.hitFlash = Math.max(0, (z.hitFlash || 0) - dt);
      for (const c of this.corpses) { c.t -= dt; c.z.hitFlash = Math.max(0, (c.z.hitFlash || 0) - dt); }
      for (const c of this.corpses) if (c.t <= 0 && c.body) { this.world.destroyBody(c.body); c.body = null; }
      this.corpses = this.corpses.filter((c) => c.t > 0);
    }

    // Поведение живого заражённого.
    think(z, car, dt) {
      const def = z.def;
      const p = z.body.getPosition();
      const v = z.body.getLinearVelocity();
      const cp = car.pos;
      const dx = cp.x - p.x;
      const dist = Math.abs(dx);
      z.cool -= dt;
      z.phase += dt * (Math.abs(v.x) * 2.2 + 1);
      let vx = 0;
      if (dist < def.sight) {
        vx = Math.sign(dx) * def.speed;
        z.facing = Math.sign(dx) || -1;
      } else {
        vx = Math.sin(z.phase * 0.3) * 0.3;
      }
      const grounded = Math.abs(v.y) < 0.5;
      if (grounded) {
        z.jumping = false;
        // Идут силой, а не заданной скоростью: машина может их растолкать.
        const m = z.body.getMass();
        const f = Math.max(-1, Math.min(1, (vx - v.x) / Math.max(1, def.speed))) * m * window.CONFIG.HORDE.walkAccel;
        z.body.applyForceToCenter(pl.Vec2(f, 0), true);
      }

      // Прыжок бегуна на подъезжающую машину: рассчитан так, чтобы упасть на крышу.
      const reach = def.jump ? dist / Math.max(1, car.speed + def.jump.vx) : 0;
      if (def.jump && z.cool <= 0 && dx < 0 && dist < def.jump.range && grounded && car.speed > 2 &&
          reach > def.jump.timing[0] && reach < def.jump.timing[1]) {
        z.body.setLinearVelocity(pl.Vec2(-def.jump.vx, def.jump.vy));
        z.cool = def.jump.every;
        z.jumping = true;
      }
      // Топтун и элита подбрасывают машину.
      if (def.stomp && z.cool <= 0 && dist < def.stomp.range + 2) {
        const hit = car.chassis.getWorldPoint(pl.Vec2(dx < 0 ? 1.6 : -1.6, -0.2));
        car.chassis.applyLinearImpulse(pl.Vec2(-Math.sign(dx) * def.stomp.impulse * 0.3, def.stomp.impulse), hit, true);
        this.hooks.onCarHit(def.stomp.damage * car.stats.armorMult, z);
        z.cool = def.stomp.every;
        z.stomped = 0.35;
        window.Sound.thud(1);
      }
      // Рубер и элита таранят: на встречном курсе отбрасывают машину.
      if (def.ram && z.cool <= 0 && dist < def.w / 2 + 2.6) {
        const m = car.chassis.getMass();
        car.chassis.applyLinearImpulse(pl.Vec2(Math.sign(dx) * def.ram.impulse * m, def.ram.impulse * m * 0.25), car.chassis.getWorldCenter(), true);
        this.hooks.onCarHit(def.ram.damage * car.stats.armorMult, z);
        z.cool = def.ram.every;
        window.Sound.thud(1);
      }
      // Обычная атака вплотную — только по стоящей или ползущей машине.
      if (z.cool <= 0 && dist < def.w / 2 + 2.4 && Math.abs(cp.y - p.y) < 2.5 && Math.abs(car.speed) < window.CONFIG.HORDE.attackMaxSpeed) {
        this.hooks.onCarHit(def.attack.damage * car.stats.armorMult, z);
        z.cool = def.attack.every;
      }
      if (z.stomped) z.stomped = Math.max(0, z.stomped - dt);
    }

    cling(z, car) {
      const local = car.chassis.getLocalPoint(z.body.getPosition());
      z.alive = true;
      z.clingAt = { x: Math.max(-1.6, Math.min(1.6, local.x)), y: car.def.cabin[2][1] + 0.1 };
      z.clingT = 0;
      this.world.destroyBody(z.body);
      z.body = null;
      this.active = this.active.filter((a) => a !== z);
      this.clinging.push(z);
      window.Sound.thud(0.6);
    }

    // Бегуны на крыше бьют по кабине; резкий рывок или жёсткая посадка их сбрасывает.
    updateClinging(car, dt) {
      if (!this.clinging.length) return;
      const v = car.chassis.getLinearVelocity();
      const jolt = car.lastVy != null ? Math.abs(v.y - car.lastVy) / dt / 10 : 0;
      for (const z of this.clinging) {
        z.clingT += dt;
        z.phase += dt * 8;
        z.lastPos = car.chassis.getWorldPoint(pl.Vec2(z.clingAt.x, z.clingAt.y));
        if (z.hp <= 0) continue;
        const c = z.def.cling;
        this.hooks.onCarHit(c.damage * dt * car.stats.cageMult * car.stats.armorMult, z, true);
        if (car.stats.shock) this.damageClinging(z, car.stats.shock * dt);
        if (jolt > c.shakeSpeed || Math.abs(car.chassis.getAngularVelocity()) > 3.5) this.throwOff(z, car);
      }
      this.clinging = this.clinging.filter((z) => !z.thrown && z.hp > 0);
    }

    damageClinging(z, dmg) {
      z.hp -= dmg;
      if (z.hp <= 0) { z.alive = false; this.count(z); this.hooks.onKill(z, z.lastPos || { x: 0, y: 0 }); }
    }

    throwOff(z, car) {
      z.thrown = true;
      const p = car.chassis.getWorldPoint(pl.Vec2(z.clingAt.x, z.clingAt.y + 0.5));
      const body = this.world.createDynamicBody({ position: p, angularVelocity: (Math.random() - 0.5) * 8 });
      body.createFixture(pl.Box(z.def.w / 2, z.def.h / 2), Object.assign({ density: z.def.mass / (z.def.w * z.def.h), friction: 0.5 }, this.filter(false)));
      const v = car.chassis.getLinearVelocity();
      body.setLinearVelocity(pl.Vec2(v.x * 0.6 - 3, 4));
      z.body = body;
      // Падение с крыши на скорости обычно смертельно.
      if (Math.abs(v.x) > 8) {
        z.hp = 0; z.alive = false; this.count(z); this.hooks.onKill(z, p);
        this.corpses.push({ z, body, t: window.CONFIG.HORDE.corpseLife });
      } else {
        // Выжил — снова на ногах и бежит за машиной.
        this.world.destroyBody(body);
        this.spawn({ x: p.x, kind: z.kind });
      }
    }

    // Урон заражённому (удар машиной или оружие). from — скорость удара для отлёта тела.
    damage(z, dmg, from) {
      if (!z.alive) return;
      z.hp -= dmg;
      z.hitFlash = 0.12;
      if (z.hp > 0) return;
      z.alive = false;
      this.count(z);
      const b = z.body;
      const p = b.getPosition();
      // Тело становится «мусором»: крутится, летит, сталкивается только с землёй.
      const fix = b.getFixtureList();
      const f = this.filter(false);
      fix.setFilterData({ groupIndex: 0, categoryBits: f.filterCategoryBits, maskBits: f.filterMaskBits });
      b.setFixedRotation(false);
      if (from) {
        b.setLinearVelocity(pl.Vec2(from.x * 0.8 + 2, Math.abs(from.x) * 0.35 + 2));
        b.setAngularVelocity(-from.x * 0.6 - 3);
      }
      this.active = this.active.filter((a) => a !== z);
      this.corpses.push({ z, body: b, t: window.CONFIG.HORDE.corpseLife });
      this.hooks.onKill(z, { x: p.x, y: p.y });
    }

    count(z) { this.kills[z.kind] = (this.kills[z.kind] || 0) + 1; }

    // Живые и мёртвые — для отрисовки и оружия.
    each(fn) {
      for (const z of this.active) fn(z, z.body.getPosition(), z.body.getAngle());
      for (const c of this.corpses) if (c.body) fn(c.z, c.body.getPosition(), c.body.getAngle());
    }
  }

  function pick(mix, r) {
    for (const [k, share] of Object.entries(mix)) { if ((r -= share) <= 0) return k; }
    return Object.keys(mix)[0];
  }

  window.Horde = Horde;
})();
