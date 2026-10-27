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

  // Тестовая трасса этапа 1: холмы, трамплин, яма.
  const TEST_TRACK = {
    length: 900,
    segments: [
      { type: 'flat', length: 40 },
      { type: 'hills', length: 200, amp: 2.5, wave: 28 },
      { type: 'ramp', length: 14, height: 3.5 },
      { type: 'gap', length: 10, depth: 6 },
      { type: 'flat', length: 30 },
      { type: 'hills', length: 250, amp: 4, wave: 40 },
      { type: 'ramp', length: 18, height: 5 },
      { type: 'flat', length: 60 },
      { type: 'hills', length: 280, amp: 6, wave: 60 },
    ],
  };

  for (const [id, c] of Object.entries(CARS)) c.id = id;

  window.CONFIG = { PHYSICS, CAMERA, CARS, TEST_TRACK };
})();
