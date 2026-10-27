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
      color: '#8a4a3a',
    },
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
      segments: [
        { type: 'flat', length: 30 },
        { type: 'rubble', length: 60, objects: [{ type: 'crates', dx: 40, count: 3 }] },
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
          upper: { gap: 7, height: 5.0, length: 110, objects: [{ type: 'crates', dx: 60, count: 2 }] },
          lower: { objects: [{ type: 'barricade', dx: 40, rows: 3, cols: 3 }, { type: 'wrecks', dx: 110, count: 2 }] } },
        { type: 'checkpoint' },
        { type: 'hills', length: 150, amp: 4, wave: 45, objects: [{ type: 'barrels', dx: 70, count: 4 }] },
        { type: 'bridge', deckBefore: 40, broken: 9, lip: 1.3, depth: 9, deckAfter: 30 },
        { type: 'rubble', length: 80, objects: [{ type: 'crates', dx: 30, count: 5 }] },
        { type: 'checkpoint' },
        { type: 'slope', length: 50, rise: -5 },
        { type: 'ramp', length: 16, height: 4.5 },
        { type: 'gap', length: 9, depth: 6 },
        { type: 'flat', length: 60, objects: [{ type: 'wrecks', dx: 30, count: 2 }] },
        { type: 'hills', length: 120, amp: 3, wave: 40 },
        { type: 'stab', name: 'Стаб «Депо»' },
      ],
    },
  ];

  for (const [id, c] of Object.entries(CARS)) c.id = id;

  window.CONFIG = { PHYSICS, COLLIDE, CAMERA, CARS, OBSTACLES, LEVELS };
})();
