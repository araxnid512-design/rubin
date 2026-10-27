// Физика машины на Planck.js: кузов, колёса на пружинной подвеске (wheel joint),
// привод, тормоз и задний ход, управление наклоном в воздухе, нитро.
(function () {
  const pl = window.planck;
  const P = () => window.CONFIG.PHYSICS;

  class Car {
    // def — машина из CONFIG.CARS, stats — итоговые параметры с учётом улучшений.
    constructor(world, def, stats, x, y) {
      this.def = def;
      this.stats = stats;
      this.world = world;
      const W = def.wheels;

      this.chassis = world.createDynamicBody({ position: pl.Vec2(x, y), angularDamping: 0.05 });
      const poly = (pts) => pl.Polygon(pts.map(([px, py]) => pl.Vec2(px, py)));
      const K = window.CONFIG.COLLIDE;
      const bodyFilter = { filterCategoryBits: K.body, filterMaskBits: K.ground | K.debris | K.heavy | K.zombie };
      this.chassis.createFixture(poly(def.body), Object.assign({ density: stats.density, friction: 0.4 }, bodyFilter));
      this.chassis.createFixture(poly(def.cabin), Object.assign({ density: stats.density * 0.3, friction: 0.4 }, bodyFilter));
      this.chassis.setUserData({ kind: 'chassis', car: this });
      // Машина не засыпает: иначе мотор колёс её не разбудит и она «залипнет».
      this.chassis.setSleepingAllowed(false);

      this.contacts = { rear: 0, front: 0, body: 0 };
      const wheel = (wx, key) => {
        const b = world.createDynamicBody({ position: pl.Vec2(x + wx, y + W.y), angularDamping: 0.3 });
        b.createFixture(pl.Circle(W.radius), {
          density: W.density, friction: stats.tireFriction, restitution: 0.05,
          filterCategoryBits: K.wheel, filterMaskBits: K.ground | K.heavy | K.zombie,
        });
        b.setUserData({ kind: 'wheel', key, car: this });
        b.setSleepingAllowed(false);
        const j = world.createJoint(pl.WheelJoint({
          enableMotor: false,
          maxMotorTorque: 0,
          motorSpeed: 0,
          frequencyHz: stats.suspensionFrequency,
          dampingRatio: stats.suspensionDamping,
        }, this.chassis, b, b.getPosition(), pl.Vec2(0, 1)));
        return { body: b, joint: j };
      };
      this.rear = wheel(W.rearX, 'rear');
      this.front = wheel(W.frontX, 'front');

      this.nitro = stats.nitroCapacity;
      this.nitroOn = false;
      this.throttle = 0;
      this.flipTimer = 0;
      this.flipped = false;
      this.hp = stats.hp;
      this.lastVy = 0;
    }

    get pos() { return this.chassis.getPosition(); }
    totalMass() { return this.chassis.getMass() + this.rear.body.getMass() + this.front.body.getMass(); }
    get angle() { return this.chassis.getAngle(); }
    get speed() { return this.chassis.getLinearVelocity().x; }
    get grounded() { return this.contacts.rear > 0 || this.contacts.front > 0; }

    // Ось «вперёд» кузова в мире.
    forward() {
      const a = this.angle;
      return pl.Vec2(Math.cos(a), Math.sin(a));
    }

    // input: { gas, brake, nitro } — булевы.
    control(input, dt) {
      const s = this.stats;
      this.lastVy = this.chassis.getLinearVelocity().y;
      const v = this.speed;
      const r = this.def.wheels.radius;
      const driven = s.awd ? [this.rear, this.front] : [this.rear];
      const all = [this.rear, this.front];
      this.throttle = 0;

      if (input.gas) {
        // Колесо по часовой (отрицательная угловая скорость) — едем вправо.
        for (const w of all) w.joint.enableMotor(false);
        for (const w of driven) {
          w.joint.enableMotor(true);
          w.joint.setMotorSpeed(-s.maxSpeed / r);
          w.joint.setMaxMotorTorque(s.torque / driven.length * (s.awd ? 1.15 : 1));
        }
        this.throttle = 1;
      } else if (input.brake) {
        if (v > 0.8) {
          // Тормоз: колёса держат нулевую скорость с большим моментом.
          for (const w of all) {
            w.joint.enableMotor(true);
            w.joint.setMotorSpeed(0);
            w.joint.setMaxMotorTorque(s.brakeTorque / 2);
          }
        } else {
          for (const w of all) w.joint.enableMotor(false);
          for (const w of driven) {
            w.joint.enableMotor(true);
            w.joint.setMotorSpeed(s.reverseSpeed / r);
            w.joint.setMaxMotorTorque(s.torque / driven.length * 0.7);
          }
          this.throttle = -0.6;
        }
      } else {
        // Накат: двигатель отключён, лёгкое торможение мотором.
        for (const w of all) {
          w.joint.enableMotor(true);
          w.joint.setMotorSpeed(0);
          w.joint.setMaxMotorTorque(s.torque * 0.03);
        }
      }

      // В воздухе: газ — нос вверх (против часовой), тормоз — нос вниз.
      if (!this.grounded) {
        const I = this.chassis.getInertia();
        let dir = 0;
        if (input.gas) dir += 1;
        if (input.brake) dir -= 1;
        if (dir) {
          const w = this.chassis.getAngularVelocity();
          if (Math.abs(w) < s.maxSpin || Math.sign(w) !== dir) {
            this.chassis.applyTorque(dir * s.airControl * I, true);
          }
        }
      }

      // Нитро: тяга вдоль кузова.
      this.nitroOn = input.nitro && this.nitro > 0;
      if (this.nitroOn) {
        const m = this.chassis.getMass() + this.rear.body.getMass() + this.front.body.getMass();
        const f = this.forward();
        this.chassis.applyForceToCenter(pl.Vec2(f.x * s.nitroForce * m, f.y * s.nitroForce * m), true);
        this.nitro = Math.max(0, this.nitro - dt);
      }

      // Перевёрнута ли машина: лежит на крыше/боку и почти не движется.
      let a = this.angle % (Math.PI * 2);
      if (a > Math.PI) a -= Math.PI * 2;
      if (a < -Math.PI) a += Math.PI * 2;
      const still = this.chassis.getLinearVelocity().length() < 1.5;
      if (Math.abs(a) > P().flipAngle && still) this.flipTimer += dt;
      else this.flipTimer = 0;
      this.flipped = this.flipTimer > P().flipTime;
    }

    wheelAngle(w) { return w.body.getAngle(); }
  }

  // Мир и учёт касаний колёс с землёй.
  function createWorld() {
    const world = new pl.World({ gravity: pl.Vec2(0, -P().gravity) });
    const touch = (c, delta) => {
      const a = c.getFixtureA().getBody().getUserData() || {};
      const b = c.getFixtureB().getBody().getUserData() || {};
      for (const [me, other] of [[a, b], [b, a]]) {
        if (me.kind === 'wheel' && other.kind !== 'chassis' && other.kind !== 'wheel') {
          me.car.contacts[me.key] = Math.max(0, me.car.contacts[me.key] + delta);
        }
      }
    };
    world.on('begin-contact', (c) => { touch(c, 1); smash(c); });
    world.on('end-contact', (c) => touch(c, -1));
    // Мусор ниже днища проходит под машиной, а не поднимает её.
    world.on('pre-solve', (c) => {
      const pair = carAndDebris(c);
      if (!pair) return;
      const local = pair.car.chassis.getLocalPoint(pair.debris.getPosition());
      if (local.y < pair.car.def.body[0][1] + 0.05) c.setEnabled(false);
    });
    return world;
  }

  function carAndDebris(c) {
    const fa = c.getFixtureA(), fb = c.getFixtureB();
    const ua = fa.getBody().getUserData() || {}, ub = fb.getBody().getUserData() || {};
    if (ua.kind === 'chassis' && ub.kind === 'obstacle' && ub.type !== 'wreck') return { car: ua.car, debris: fb.getBody() };
    if (ub.kind === 'chassis' && ua.kind === 'obstacle' && ua.type !== 'wreck') return { car: ub.car, debris: fa.getBody() };
    return null;
  }

  // Удар бампером на скорости подбрасывает мусор вперёд и вверх.
  function smash(c) {
    const pair = carAndDebris(c);
    if (!pair) return;
    const v = pair.car.chassis.getLinearVelocity();
    const speed = v.length();
    const k = window.CONFIG.PHYSICS.smash;
    if (speed < k.minSpeed) return;
    const m = pair.debris.getMass();
    pair.debris.setAwake(true);
    pair.debris.applyLinearImpulse(pl.Vec2(v.x * m * k.forward, Math.abs(speed) * m * k.up), pair.debris.getWorldCenter(), true);
    pair.debris.applyAngularImpulse((Math.random() - 0.5) * m * 2, true);
    pair.car.lastSmash = speed;
  }

  // Итоговые параметры машины (на этапе 1 — без улучшений).
  function carStats(def) {
    return {
      density: def.density,
      tireFriction: def.wheels.friction,
      suspensionFrequency: def.suspension.frequency,
      suspensionDamping: def.suspension.damping,
      torque: def.engine.torque,
      maxSpeed: def.engine.maxSpeed,
      reverseSpeed: def.engine.reverseSpeed,
      brakeTorque: def.engine.brakeTorque,
      airControl: def.airControl,
      maxSpin: def.maxSpin,
      nitroForce: def.nitro.force,
      nitroCapacity: def.nitro.capacity,
      awd: false,
      hp: def.hp,
      armorMult: 1,     // множитель входящего урона (броня уменьшает)
      ramMult: 1,       // урон тараном
      ramDragCut: 0,    // доля торможения от удара, которую гасит отвал
      spikesMult: 1,    // урон колёсами при наезде сверху
      cageMult: 1,      // урон от бегунов на крыше (клетка уменьшает)
      noClimb: false,   // бегуны не могут зацепиться
      shock: 0,         // урон/с прицепившимся (электрокорпус)
      collectRadius: window.CONFIG.PICKUPS.collectRadius,
    };
  }

  window.Physics = { Car, createWorld, carStats };
})();
