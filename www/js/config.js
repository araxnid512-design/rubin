// ЕДИНЫЙ КОНФИГ ИГРЫ. Все числа баланса — здесь: машины, улучшения, цены,
// заражённые, уровни, экономика. Логика читает только отсюда.
// Единицы: метры, секунды, килограммы; углы — радианы; скорость — м/с.
(function () {
  const PHYSICS = {
    gravity: 10,
    step: 1 / 60,
    maxSubSteps: 4,
    velocityIterations: 8,
    positionIterations: 3,
    groundFriction: 0.9,
    flipAngle: 1.75,        // рад от горизонта: дальше — машина лежит на крыше/боку
    flipTime: 2.0,          // сек в таком положении почти без движения — заезд окончен
    smash: { minSpeed: 4, forward: 0.6, up: 0.35 }, // как разлетается мусор от удара
  };

  // Группы столкновений (битовые маски Box2D).
  const COLLIDE = {
    ground: 0x0001,
    body: 0x0002,    // кузов машины
    wheel: 0x0004,
    debris: 0x0008,  // мелкий мусор: ящики, мешки, бочки, доски — колёса его не цепляют
    heavy: 0x0010,   // брошенные машины
    zombie: 0x0020,
  };

  // Камера: сколько метров видно по вертикали и как далеко смотрим вперёд.
  const CAMERA = {
    viewHeight: 15,
    viewHeightFast: 19,     // на большой скорости камера отъезжает
    fastSpeed: 25,
    lookAhead: 0.45,        // сек упреждения по скорости
    smoothing: 4,
  };

  // Машины. body — точки кузова (x вперёд, y вверх, центр — между осями).
  const CARS = {
    sedan: {
      name: 'Ржавый седан',
      about: 'Стартовая машина. Слабая, но дешёвая в ремонте и улучшениях.',
      body: [[-2.1, -0.3], [2.15, -0.3], [2.15, 0.2], [0.9, 0.38], [-2.05, 0.38]],
      cabin: [[-1.35, 0.38], [0.55, 0.38], [0.05, 0.98], [-1.15, 0.98]],
      density: 210,
      wheels: { radius: 0.38, rearX: -1.35, frontX: 1.4, y: -0.42, density: 60, friction: 1.4 },
      suspension: { frequency: 3.8, damping: 0.65 },
      engine: { torque: 900, maxSpeed: 17, reverseSpeed: 6, brakeTorque: 2600 },
      airControl: 5.5,       // угловое ускорение в воздухе, рад/с²
      maxSpin: 4.5,          // ограничение вращения в воздухе
      nitro: { force: 9, capacity: 3 },  // ускорение, м/с²; секунды работы
      hp: 100,
      fuel: { tank: 10, use: 0.17, idle: 0.015 },  // литры; расход л/с на полном газу и на холостых
      color: '#8a4a3a',
    },
  };

  // Заражённые. hp — сколько урона выдерживают; урон от удара машиной =
  // скорость сближения (м/с) × масса машины / 100 × множитель тарана.
  // drops: спораны [мин, макс], шанс гороха и жемчуга. LORE: Заражённые, Споран.
  const ZOMBIES = {
    walker: {
      name: 'Пустыш', w: 0.5, h: 1.7, mass: 60, hp: 12, speed: 0.7, sight: 18,
      attack: { damage: 2, every: 1.2 }, drag: 0.02,
      drops: { sporans: [0, 1], sporanChance: 0.35, peas: 0, pearl: 0 },
      color: '#8f9488', skin: '#a8ae9c',
    },
    runner: {
      name: 'Бегун', w: 0.45, h: 1.75, mass: 65, hp: 20, speed: 5.5, sight: 30,
      jump: { range: 25, vx: 2.5, vy: 7.5, every: 3, timing: [0.95, 1.2] }, // прыгает за ~1 с до встречи и падает на крышу
      cling: { damage: 1.5, maxOnCar: 3, shakeSpeed: 4 },  // урон/с по кабине; рывок, сбрасывающий его
      attack: { damage: 3, every: 1 }, drag: 0.03,
      drops: { sporans: [1, 2], sporanChance: 0.85, peas: 0.01, pearl: 0 },
      color: '#a39a78', skin: '#c2b08e',
    },
    lottery: {
      name: 'Лотерейщик', w: 0.75, h: 1.9, mass: 220, hp: 110, speed: 1.6, sight: 22,
      attack: { damage: 6, every: 1.3 }, drag: 0.35,      // доля скорости машины, теряемая при ударе
      drops: { sporans: [1, 3], sporanChance: 1, peas: 0.06, pearl: 0 },
      color: '#8a6f55', skin: '#a08466',
    },
    stomper: {
      name: 'Топтун', w: 1.1, h: 2.3, mass: 420, hp: 260, speed: 1.3, sight: 20,
      stomp: { range: 2.6, impulse: 2600, every: 2.2, damage: 18 }, // подбрасывает машину: лёгкую может перевернуть
      attack: { damage: 10, every: 1.5 }, drag: 0.5,
      drops: { sporans: [2, 3], sporanChance: 1, peas: 0.18, pearl: 0.01 },
      color: '#6e4a3a', skin: '#86604c',
    },
    ruber: {
      name: 'Рубер', w: 0.9, h: 2.0, mass: 300, hp: 360, speed: 9, sight: 45,
      ram: { damage: 30, impulse: 5, every: 3 },          // таранит навстречу, отбрасывая машину
      attack: { damage: 8, every: 1 }, drag: 0.45,
      drops: { sporans: [2, 3], sporanChance: 1, peas: 0.3, pearl: 0.04 },
      color: '#6a3a4a', skin: '#8a5060', plates: '#c8bca0',
    },
    elite: {
      name: 'Элита', w: 2.2, h: 3.4, mass: 1500, hp: 4000, speed: 2.2, sight: 40,
      stomp: { range: 4, impulse: 9000, every: 3, damage: 35 },
      ram: { damage: 50, impulse: 6, every: 5 },
      attack: { damage: 20, every: 1.5 }, drag: 0.7,
      drops: { sporans: [20, 30], sporanChance: 1, peas: 1, pearl: 1 },
      color: '#5a2a2a', skin: '#7a3a34', plates: '#d0c4a8',
    },
  };

  const HORDE = {
    activateAhead: 70,    // м перед машиной: здесь заражённые «оживают» (создаются тела)
    removeBehind: 45,     // м позади: тела удаляются
    crushUnderWheel: 2,   // множитель урона, когда колесо наезжает сверху
    minKillSpeed: 2,      // ниже этой скорости сближения удар не ранит
    impactDamage: 0.0015, // урон машине от удара: скорость × масса заражённого × это
    walkAccel: 6,         // м/с²: как резко заражённые набирают шаг
    attackMaxSpeed: 3,    // быстрее этого машину не бьют, только при ударе
    corpseLife: 8,        // сек, сколько тело лежит
  };

  // Добыча на трассе: радиус подбора и вид.
  const PICKUPS = {
    collectRadius: 1.8,
    life: 40,
    canisterFuel: 2.5,    // литров в канистре (улучшение «Запасные канистры» добавляет)
  };

  // Награда за заезд и условия его конца.
  const ECONOMY = {
    sporansPer100m: 5,        // за пройденную в заезде дистанцию
    recordPer100m: 8,         // сверху — за метры дальше прошлого рекорда на уровне
    stabBonus: 120,           // доехал до стаба
    outOfFuelStopTime: 1.5,   // сек почти без движения на пустом баке — конец заезда
  };

  // Препятствия: размеры, м; плотность, кг/м².
  const OBSTACLES = {
    crate: { size: 0.9, density: 25, friction: 0.6 },
    sandbag: { w: 1.1, h: 0.45, density: 40, friction: 0.8 },
    plank: { w: 2.6, h: 0.12, density: 20, friction: 0.6 },
    barrel: { r: 0.42, density: 30, friction: 0.5 },
    wreck: { w: 4.0, h: 1.3, density: 32, friction: 0.25 },
  };

  // Уровни: дорога от стаба к стабу. Сегменты идут подряд; objects — что стоит
  // на сегменте (dx — от начала сегмента). Названия стабов — игровые, см. LORE.md.
  const LEVELS = [
    {
      id: 'city',
      name: 'Городской кластер',
      from: 'Стаб «Элеватор»',
      to: 'Стаб «Депо»',
      theme: { bg: 'city', sky: ['#6f7a80', '#a8a49a', '#b8ab94'], ground: ['#5a4a3a', '#2a221c'], road: '#3c3a36' },
      // Толпы по всей трассе: шаг между группами, размер группы, состав.
      crowds: { startAt: 45, every: 22, count: [2, 6], mix: { walker: 0.72, runner: 0.28 } },
      segments: [
        { type: 'flat', length: 30 },
        { type: 'rubble', length: 60, objects: [{ type: 'crates', dx: 40, count: 3 }, { type: 'canister', dx: 20 }] },
        { type: 'hills', length: 120, amp: 2, wave: 30 },
        { type: 'ramp', length: 12, height: 3 },
        { type: 'gap', length: 5, depth: 4 },
        { type: 'flat', length: 40, objects: [{ type: 'barricade', dx: 25, rows: 3, cols: 2 }] },
        { type: 'checkpoint' },
        { type: 'slope', length: 60, rise: 6 },
        { type: 'flat', length: 40, objects: [{ type: 'barrels', dx: 10, count: 3 }] },
        { type: 'drop', height: 4 },
        { type: 'flat', length: 30, objects: [{ type: 'wrecks', dx: 10, count: 1 }] },
        { type: 'fork', length: 160, kicker: { length: 16, height: 3.8 },
          upper: { gap: 7, height: 5.0, length: 110, objects: [{ type: 'crates', dx: 60, count: 2 }, { type: 'canister', dx: 30 }, { type: 'canister', dx: 90 }] },
          lower: { objects: [{ type: 'barricade', dx: 40, rows: 3, cols: 3 }, { type: 'wrecks', dx: 110, count: 2 }] } },
        { type: 'checkpoint' },
        { type: 'hills', length: 150, amp: 4, wave: 45, objects: [{ type: 'barrels', dx: 70, count: 4 }, { type: 'zombies', kind: 'lottery', dx: 110, count: 2, spread: 3 }] },
        { type: 'bridge', deckBefore: 40, broken: 9, lip: 1.3, depth: 9, deckAfter: 30 },
        { type: 'rubble', length: 80, objects: [{ type: 'crates', dx: 30, count: 5 }, { type: 'canister', dx: 60 }] },
        { type: 'checkpoint' },
        { type: 'slope', length: 50, rise: -5 },
        { type: 'ramp', length: 16, height: 4.5 },
        { type: 'gap', length: 9, depth: 6 },
        { type: 'flat', length: 60, objects: [{ type: 'wrecks', dx: 30, count: 2 }] },
        { type: 'hills', length: 120, amp: 3, wave: 40, objects: [{ type: 'zombies', kind: 'stomper', dx: 70, count: 1 }] },
        { type: 'stab', name: 'Стаб «Депо»' },
      ],
    },
  ];

  for (const [id, c] of Object.entries(CARS)) c.id = id;

  window.CONFIG = { PHYSICS, COLLIDE, CAMERA, CARS, ZOMBIES, HORDE, PICKUPS, ECONOMY, OBSTACLES, LEVELS };
})();
