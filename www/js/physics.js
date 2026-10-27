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
      this.chassis.createFixture(poly(def.body), { density: stats.density, friction: 0.4 });
      this.chassis.createFixture(poly(def.cabin), { density: stats.density * 0.3, friction: 0.4 });
      this.chassis.setUserData({ kind: 'chassis', car: this });

      this.contacts = { rear: 0, front: 0, body: 0 };
      const wheel = (wx, key) => {
        const b = world.createDynamicBody({ position: pl.Vec2(x + wx, y + W.y), angularDamping: 0.3 });
        b.createFixture(pl.Circle(W.radius), { density: W.density, friction: stats.tireFriction, restitution: 0.05 });
        b.setUserData({ kind: 'wheel', key, car: this });
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
    }

    get pos() { return this.chassis.getPosition(); }
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
    world.on('begin-contact', (c) => touch(c, 1));
    world.on('end-contact', (c) => touch(c, -1));
    return world;
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
    };
  }

  window.Physics = { Car, createWorld, carStats };
})();
