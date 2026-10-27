// Физика машины на Planck.js: кузов, колёса на пружинной подвеске (wheel joint),
// привод, автоторможение без газа и задний ход, наклон джойстиком, нитро.
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
      this.fuel = stats.tank;
      this.choke = 1;          // < 1 — мотор захлёбывается (вода без шноркеля)
      this.winchLeft = stats.winch;
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

    // input: { gas, nitro } — булевы; tilt ∈ [-1, 1] — джойстик наклона
    // (− нос вверх, + нос вниз). Тормоза нет: без газа машина тормозит сама.
    control(input, dt) {
      const s = this.stats, P0 = P();
      this.lastVy = this.chassis.getLinearVelocity().y;
      const v = this.speed;
      const r = this.def.wheels.radius;
      const driven = s.awd ? [this.rear, this.front] : [this.rear];
      const all = [this.rear, this.front];
      const tilt = input.tilt || 0;
      this.throttle = 0;

      const outOfFuel = this.fuel <= 0;
      // Задний ход: на земле почти стоим, газ отпущен, джойстик до упора влево.
      const reverse = !input.gas && !outOfFuel && this.grounded && v < 1 && tilt < -P0.reverseTilt;
      // Расход: на газу и задним ходом — полный, иначе — холостые.
      if (!outOfFuel) {
        this.fuel = Math.max(0, this.fuel - (input.gas || reverse ? s.fuelUse : s.fuelIdle) * dt);
      }
      if (input.gas && !outOfFuel) {
        // Колесо по часовой (отрицательная угловая скорость) — едем вправо.
        for (const w of all) w.joint.enableMotor(false);
        for (const w of driven) {
          w.joint.enableMotor(true);
          w.joint.setMotorSpeed(-s.maxSpeed / r);
          const launch = v < s.maxSpeed * 0.5 ? s.launch : 1;
          w.joint.setMaxMotorTorque(s.torque * launch * this.choke * this.wheelieLimit() / driven.length * (s.awd ? 1.15 : 1));
        }
        this.throttle = 1;
      } else if (reverse) {
        for (const w of all) w.joint.enableMotor(false);
        for (const w of driven) {
          w.joint.enableMotor(true);
          w.joint.setMotorSpeed(s.reverseSpeed / r);
          w.joint.setMaxMotorTorque(s.torque / driven.length * 0.7);
        }
        this.throttle = -0.6;
      } else {
        // Газ отпущен — машина сама притормаживает колёсами.
        for (const w of all) {
          w.joint.enableMotor(true);
          w.joint.setMotorSpeed(0);
          w.joint.setMaxMotorTorque(s.brakeTorque * P0.autoBrake / 2);
        }
      }

      // Наклон джойстиком: в воздухе — полный, на земле — лёгкий (чуть качнуть кузов).
      if (tilt) {
        const I = this.chassis.getInertia();
        const dir = -tilt;                       // вправо — по часовой, нос вниз
        const k = this.grounded ? P0.groundTilt : 1;
        const w = this.chassis.getAngularVelocity();
        if (Math.abs(w) < s.maxSpin || Math.sign(w) !== Math.sign(dir)) {
          this.chassis.applyTorque(dir * s.airControl * I * k, true);
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

    // Лебёдка: поставить машину на колёса чуть выше земли.
    rightUp(groundY) {
      const p = this.chassis.getPosition();
      const y = Math.max(p.y, groundY + 1.5);
      const parts = [this.chassis, this.rear.body, this.front.body];
      const W = this.def.wheels;
      this.chassis.setTransform(pl.Vec2(p.x, y), 0);
      this.rear.body.setTransform(pl.Vec2(p.x + W.rearX, y + W.y), 0);
      this.front.body.setTransform(pl.Vec2(p.x + W.frontX, y + W.y), 0);
      for (const b of parts) { b.setLinearVelocity(pl.Vec2(0, 0)); b.setAngularVelocity(0); }
      this.flipTimer = 0;
      this.flipped = false;
    }

    // Контроль вздёргивания: если на земле нос задирается слишком сильно, тяга падает,
    // иначе мощная машина опрокидывается назад прямо со старта.
    wheelieLimit() {
      const W = window.CONFIG.PHYSICS.wheelie;
      if (!this.contacts.rear) return 1;
      const a = this.angle - this.groundSlope();
      if (a < W.from) return 1;
      return Math.max(W.min, 1 - (a - W.from) / W.range);
    }

    // Наклон дороги под машиной (между точками касания колёс).
    groundSlope() {
      const r = this.rear.body.getPosition(), f = this.front.body.getPosition();
      if (!this.contacts.front) return Math.atan2(f.y - r.y, f.x - r.x) * 0.5;
      return Math.atan2(f.y - r.y, f.x - r.x);
    }
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
    if (ua.kind === 'chassis' && ub.kind === 'obstacle' && !ub.heavy) return { car: ua.car, debris: fb.getBody() };
    if (ub.kind === 'chassis' && ua.kind === 'obstacle' && !ua.heavy) return { car: ub.car, debris: fa.getBody() };
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

  // Итоговые параметры машины с учётом улучшений: upgrades — { id: уровень }.
  function carStats(def, upgrades) {
    const s = Object.assign(baseStats(def), def.base || {});
    const U = window.CONFIG.UPGRADES;
    for (const [id, lvl] of Object.entries(upgrades || {})) {
      const u = U[id];
      if (!u || !lvl) continue;
      for (const e of u.effects) {
        const i = Math.min(lvl, u.levels) - 1;
        if (e.mul) s[e.stat] *= e.mul[i];
        if (e.add) s[e.stat] += e.add[i];
        if (e.set) s[e.stat] = e.set[i];
      }
    }
    if (!s.hasNitro) s.nitroCapacity = 0;
    return s;
  }

  function baseStats(def) {
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
      tank: def.fuel.tank,
      fuelUse: def.fuel.use,
      fuelIdle: def.fuel.idle,
      canisterFuel: window.CONFIG.PICKUPS.canisterFuel,
      armorMult: 1,     // множитель входящего урона (броня уменьшает)
      ramMult: 1,       // урон тараном
      ramDragCut: 0,    // доля торможения от удара, которую гасит отвал
      spikesMult: 1,    // урон колёсами при наезде сверху
      cageMult: 1,      // урон от бегунов на крыше (клетка уменьшает)
      noClimb: false,   // бегуны не могут зацепиться
      shock: 0,         // урон/с прицепившимся (электрокорпус)
      collectRadius: window.CONFIG.PICKUPS.collectRadius,
      launch: 1,        // турбина: множитель тяги на разгоне
      hasNitro: false,  // нитро ставится улучшением
      magnet: 0,        // радиус споросборника
      scanner: 0,       // дальность сканера
      light: 0,         // уровень прожектора
      gun: 0, flamer: 0, saw: 0, // уровни оружия
      winch: 0,         // лебёдка: сколько раз за заезд поставит на колёса
      snorkel: false,   // мотор не глохнет в воде
      fling: 1,         // гидроотвал: как высоко летят сбитые
      flipResist: 0,    // доля толчка топтуна, которую гасит машина
      gunMult: 1,       // бойница: множитель урона пулемёта
      heavyGun: 0,      // крупнокалиберный ствол
      mines: 0,         // сброс мин
    };
  }

  window.Physics = { Car, createWorld, carStats };
})();
