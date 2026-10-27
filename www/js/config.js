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
    wheelie: { from: 0.3, range: 0.35, min: 0.15 },   // рад: с какого задирания носа режется тяга
    waterChoke: 0.25,       // доля тяги в воде без шноркеля
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
      nitro: { force: 9, capacity: 2.5 },  // ускорение, м/с²; секунды работы (после покупки)
      hp: 100,
      fuel: { tank: 10, use: 0.17, idle: 0.015 },  // литры; расход л/с на полном газу и на холостых
      priceMult: 1,          // множитель цен улучшений и обслуживания
      price: { sporans: 0 },
      upgrades: ['engine', 'turbo', 'gearbox', 'tires', 'suspension', 'tank', 'economizer', 'canisters',
        'armor', 'ram', 'spikes', 'cage', 'nitro', 'nitroTank', 'spoiler', 'collector', 'light', 'lightBody', 'roofCan'],
      // Точки для деталей улучшений (в координатах кузова).
      anchors: { front: 2.15, rear: -2.1, bottom: -0.3, beltY: 0.38, roofY: 0.98, roofX: [-1.15, 0.05], hood: [0.6, 2.1] },
      color: '#8a4a3a',
    },
    offroad: {
      name: 'Старый внедорожник',
      about: 'Высокая посадка, большие колёса, мягкая подвеска. Лезет туда, где седан сдаётся.',
      body: [[-2.15, -0.35], [2.25, -0.35], [2.25, 0.3], [1.05, 0.5], [-2.15, 0.5]],
      cabin: [[-1.95, 0.5], [0.65, 0.5], [0.35, 1.3], [-1.9, 1.3]],
      density: 220,
      wheels: { radius: 0.5, rearX: -1.4, frontX: 1.5, y: -0.55, density: 70, friction: 1.8 },
      suspension: { frequency: 3.2, damping: 0.6 },
      engine: { torque: 1700, maxSpeed: 19, reverseSpeed: 6, brakeTorque: 4200 },
      airControl: 5, maxSpin: 4.2,
      nitro: { force: 9, capacity: 2.5 },
      hp: 160,
      fuel: { tank: 14, use: 0.2, idle: 0.018 },
      priceMult: 1.6,
      price: { sporans: 650 },
      upgrades: ['engine', 'turbo', 'gearbox', 'tires', 'suspension', 'awd', 'tank', 'economizer', 'canisters',
        'armor', 'ram', 'spikes', 'cage', 'nitro', 'nitroTank', 'saw', 'spoiler', 'collector', 'scanner', 'light', 'winch', 'snorkel'],
      anchors: { front: 2.25, rear: -2.15, bottom: -0.35, beltY: 0.5, roofY: 1.3, roofX: [-1.85, 0.3], hood: [0.7, 2.2] },
      color: '#4a5a3e',
    },
    pickup: {
      name: 'Пикап с отвалом',
      about: 'Отвал спереди с завода: таранит толпы, почти не теряя скорость.',
      body: [[-2.5, -0.35], [2.45, -0.35], [2.45, 0.3], [1.25, 0.5], [-2.5, 0.5]],
      cabin: [[-0.35, 0.5], [1.05, 0.5], [0.75, 1.25], [-0.35, 1.25]],
      density: 240,
      wheels: { radius: 0.48, rearX: -1.65, frontX: 1.6, y: -0.55, density: 75, friction: 1.6 },
      suspension: { frequency: 3.6, damping: 0.65 },
      engine: { torque: 2400, maxSpeed: 20, reverseSpeed: 6, brakeTorque: 5200 },
      airControl: 4.6, maxSpin: 4,
      nitro: { force: 9, capacity: 2.5 },
      hp: 230,
      fuel: { tank: 16, use: 0.25, idle: 0.02 },
      base: { ramMult: 1.6, ramDragCut: 0.2 },
      priceMult: 2.6,
      price: { sporans: 1900, peas: 3 },
      upgrades: ['engine', 'turbo', 'gearbox', 'tires', 'suspension', 'awd', 'tank', 'economizer', 'canisters',
        'armor', 'ram', 'spikes', 'cage', 'nitro', 'nitroTank', 'saw', 'flamer', 'spoiler', 'collector', 'scanner', 'light', 'hydroPlow', 'ballast'],
      anchors: { front: 2.45, rear: -2.5, bottom: -0.35, beltY: 0.5, roofY: 1.25, roofX: [-0.3, 0.7], hood: [1.1, 2.4] },
      color: '#6a5a3a',
    },
    van: {
      name: 'Инкассаторский броневик',
      about: 'Тяжёлый бронированный короб. Очень прочный, но прожорливый.',
      body: [[-2.6, -0.4], [2.65, -0.4], [2.65, 0.3], [1.65, 0.55], [-2.6, 0.55]],
      cabin: [[-2.5, 0.55], [1.35, 0.55], [1.1, 1.55], [-2.5, 1.55]],
      density: 330,
      wheels: { radius: 0.52, rearX: -1.75, frontX: 1.8, y: -0.62, density: 90, friction: 1.6 },
      suspension: { frequency: 3.8, damping: 0.7 },
      engine: { torque: 4300, maxSpeed: 20, reverseSpeed: 6, brakeTorque: 9000 },
      airControl: 3.8, maxSpin: 3.4,
      nitro: { force: 9, capacity: 2.5 },
      hp: 480,
      fuel: { tank: 22, use: 0.38, idle: 0.03 },
      base: { armorMult: 0.85, ramMult: 1.2 },
      priceMult: 4.2,
      price: { sporans: 4800, peas: 8 },
      upgrades: ['engine', 'turbo', 'gearbox', 'tires', 'suspension', 'awd', 'tank', 'economizer', 'canisters',
        'armor', 'ram', 'spikes', 'cage', 'nitro', 'nitroTank', 'gun', 'flamer', 'saw', 'spoiler', 'collector', 'scanner', 'light', 'glass', 'loophole'],
      anchors: { front: 2.65, rear: -2.6, bottom: -0.4, beltY: 0.55, roofY: 1.55, roofX: [-2.2, 0.9], hood: [1.4, 2.6] },
      color: '#5a6a72',
    },
    truck: {
      name: 'Армейский грузовик',
      about: 'Огромная масса и место под тяжёлое оружие. Медленно разгоняется, но не останавливается.',
      body: [[-3.2, -0.45], [3.25, -0.45], [3.25, 0.35], [2.1, 0.6], [-3.2, 0.6]],
      cabin: [[0.95, 0.6], [2.7, 0.6], [2.45, 1.7], [0.95, 1.7]],
      density: 360,
      wheels: { radius: 0.62, rearX: -2.1, frontX: 2.2, y: -0.72, density: 110, friction: 1.7 },
      suspension: { frequency: 3.4, damping: 0.7 },
      engine: { torque: 8200, maxSpeed: 21, reverseSpeed: 6, brakeTorque: 16000 },
      airControl: 3.2, maxSpin: 3,
      nitro: { force: 8, capacity: 2.5 },
      hp: 720,
      fuel: { tank: 30, use: 0.5, idle: 0.04 },
      base: { armorMult: 0.8, ramMult: 1.3, flipResist: 0.4 },
      priceMult: 6.5,
      price: { sporans: 9500, peas: 15, pearls: 1 },
      upgrades: ['engine', 'turbo', 'gearbox', 'tires', 'suspension', 'awd', 'tank', 'economizer', 'canisters',
        'armor', 'ram', 'spikes', 'cage', 'nitro', 'nitroTank', 'gun', 'flamer', 'saw', 'spoiler', 'collector', 'scanner', 'light', 'heavyGun', 'mines'],
      anchors: { front: 3.25, rear: -3.2, bottom: -0.45, beltY: 0.6, roofY: 1.7, roofX: [1.05, 2.25], hood: [2.3, 3.2], bed: [-3.1, 0.8] },
      color: '#4a5634',
    },
    raider: {
      name: 'Рейдерский броневоз',
      about: 'Финальная машина, собранная рейдерами. Быстрая, бронированная, злая. Только за жемчуг.',
      body: [[-2.85, -0.42], [2.95, -0.42], [2.95, 0.25], [1.45, 0.58], [-2.85, 0.58]],
      cabin: [[-1.6, 0.58], [0.95, 0.58], [0.55, 1.35], [-1.4, 1.35]],
      density: 340,
      wheels: { radius: 0.6, rearX: -1.95, frontX: 2.05, y: -0.7, density: 100, friction: 2.0 },
      suspension: { frequency: 3.6, damping: 0.72 },
      engine: { torque: 8500, maxSpeed: 27, reverseSpeed: 7, brakeTorque: 15000 },
      airControl: 4.4, maxSpin: 3.8,
      nitro: { force: 10, capacity: 3 },
      hp: 900,
      fuel: { tank: 34, use: 0.42, idle: 0.035 },
      base: { armorMult: 0.7, ramMult: 1.8, ramDragCut: 0.25, flipResist: 0.5 },
      priceMult: 9,
      price: { sporans: 12000, peas: 20, pearls: 5 },
      upgrades: ['engine', 'turbo', 'gearbox', 'tires', 'suspension', 'awd', 'tank', 'economizer', 'canisters',
        'armor', 'ram', 'spikes', 'cage', 'nitro', 'nitroTank', 'gun', 'flamer', 'saw', 'spoiler', 'collector', 'scanner', 'light', 'shock', 'doubleNitro'],
      anchors: { front: 2.95, rear: -2.85, bottom: -0.42, beltY: 0.58, roofY: 1.35, roofX: [-1.35, 0.5], hood: [1.0, 2.9] },
      color: '#3a2e2a',
    },
  };

  // Улучшения. У каждой машины свой набор и свои уровни (не переносятся).
  // effects: stat — параметр машины; mul — множитель, add — прибавка, set — значение
  // по уровням (индекс 0 = уровень 1). price — спораны за уровень 1; дальше растёт
  // в PRICES.growth раз. Предпоследний уровень требует горох, последний — жемчуг.
  const UPGRADES = {
    engine: { name: 'Мощность двигателя', group: 'Двигатель', levels: 5, price: 45,
      about: 'Больше тяги: быстрее разгон, легче на подъёмах.',
      effects: [{ stat: 'torque', mul: [1.15, 1.3, 1.5, 1.75, 2.0] }] },
    turbo: { name: 'Турбина', group: 'Двигатель', levels: 4, price: 55,
      about: 'Резкий разгон с места и после ударов.',
      effects: [{ stat: 'launch', mul: [1.2, 1.4, 1.6, 1.85] }] },
    gearbox: { name: 'Коробка передач', group: 'Двигатель', levels: 5, price: 50,
      about: 'Выше максимальная скорость.',
      effects: [{ stat: 'maxSpeed', mul: [1.1, 1.2, 1.32, 1.45, 1.6] }] },
    tires: { name: 'Шины', group: 'Ходовая', levels: 4, price: 35,
      about: 'Сцепление с дорогой: меньше буксует, лучше лезет вверх.',
      effects: [{ stat: 'tireFriction', add: [0.25, 0.5, 0.8, 1.1] }] },
    suspension: { name: 'Подвеска', group: 'Ходовая', levels: 4, price: 40,
      about: 'Жёстче и устойчивее: мягче приземления, реже переворот.',
      effects: [{ stat: 'suspensionFrequency', mul: [1.12, 1.25, 1.38, 1.5] }, { stat: 'suspensionDamping', add: [0.05, 0.1, 0.15, 0.2] }] },
    awd: { name: 'Полный привод', group: 'Ходовая', levels: 3, price: 120,
      about: 'Тянут все колёса: подъёмы, ямы, грязь.',
      effects: [{ stat: 'awd', set: [true, true, true] }, { stat: 'torque', mul: [1, 1.1, 1.2] }] },
    tank: { name: 'Бензобак', group: 'Топливо', levels: 5, price: 40,
      about: 'Больше литров в баке — дальше едем.',
      effects: [{ stat: 'tank', mul: [1.3, 1.6, 2.0, 2.4, 3.0] }] },
    economizer: { name: 'Экономайзер', group: 'Топливо', levels: 4, price: 50,
      about: 'Меньше расход бензина.',
      effects: [{ stat: 'fuelUse', mul: [0.9, 0.8, 0.7, 0.6] }] },
    canisters: { name: 'Запасные канистры', group: 'Топливо', levels: 3, price: 45,
      about: 'Канистры на трассе дают больше бензина.',
      effects: [{ stat: 'canisterFuel', add: [1.5, 3, 5] }] },
    armor: { name: 'Броня кузова', group: 'Защита', levels: 5, price: 50,
      about: 'Прочнее кузов, меньше урона от ударов.',
      effects: [{ stat: 'hp', mul: [1.3, 1.6, 2.0, 2.5, 3.0] }, { stat: 'armorMult', mul: [0.95, 0.9, 0.85, 0.8, 0.72] }, { stat: 'density', mul: [1.03, 1.06, 1.1, 1.14, 1.18] }] },
    ram: { name: 'Таран / отвал', group: 'Защита', levels: 4, price: 55,
      about: 'Больше урона при ударе, машина меньше теряет скорость.',
      effects: [{ stat: 'ramMult', mul: [1.35, 1.7, 2.1, 2.6] }, { stat: 'ramDragCut', add: [0.2, 0.35, 0.5, 0.65] }] },
    spikes: { name: 'Шипы на колёсах', group: 'Защита', levels: 3, price: 40,
      about: 'Режут тех, кто лезет под колёса.',
      effects: [{ stat: 'spikesMult', mul: [1.6, 2.3, 3.2] }] },
    cage: { name: 'Клетка на кабину', group: 'Защита', levels: 3, price: 45,
      about: 'Бегуны на крыше почти не пробивают кабину.',
      effects: [{ stat: 'cageMult', mul: [0.55, 0.3, 0.1] }] },
    nitro: { name: 'Нитро', group: 'Ускорение', levels: 4, price: 60,
      about: 'Реактивный ускоритель. Первый уровень ставит его на машину.',
      effects: [{ stat: 'nitroForce', mul: [1, 1.25, 1.55, 1.9] }, { stat: 'hasNitro', set: [true, true, true, true] }] },
    nitroTank: { name: 'Объём нитро', group: 'Ускорение', levels: 4, price: 45, requires: 'nitro',
      about: 'Нитро работает дольше.',
      effects: [{ stat: 'nitroCapacity', add: [1.5, 3, 5, 7.5] }] },
    gun: { name: 'Пулемёт на крыше', group: 'Оружие', levels: 4, price: 160, weapon: true,
      about: 'Сам стреляет по заражённым впереди. Тратит прочность.',
      effects: [{ stat: 'gun', set: [1, 2, 3, 4] }] },
    flamer: { name: 'Огнемёт', group: 'Оружие', levels: 4, price: 140, weapon: true,
      about: 'Жжёт толпу перед машиной на короткой дистанции. Тратит прочность.',
      effects: [{ stat: 'flamer', set: [1, 2, 3, 4] }] },
    saw: { name: 'Пила на бампере', group: 'Оружие', levels: 4, price: 90, weapon: true,
      about: 'Режет всех, в кого врезается бампер. Тратит прочность.',
      effects: [{ stat: 'saw', set: [1, 2, 3, 4] }] },
    spoiler: { name: 'Спойлер-стабилизатор', group: 'Полёт', levels: 4, price: 40,
      about: 'Лучше управление наклоном в воздухе.',
      effects: [{ stat: 'airControl', mul: [1.3, 1.6, 1.95, 2.4] }, { stat: 'maxSpin', mul: [1.1, 1.2, 1.3, 1.45] }] },
    collector: { name: 'Споросборник', group: 'Добыча', levels: 3, price: 60,
      about: 'Сам притягивает спораны с убитых в радиусе.',
      effects: [{ stat: 'magnet', set: [5, 9, 14] }] },
    scanner: { name: 'Сканер', group: 'Добыча', levels: 2, price: 120,
      about: 'Мини-карта: мутанты с горохом и жемчугом впереди.',
      effects: [{ stat: 'scanner', set: [120, 250] }] },
    light: { name: 'Прожектор', group: 'Добыча', levels: 3, price: 50,
      about: 'Видно дальше в тумане и ночью.',
      effects: [{ stat: 'light', set: [1, 2, 3] }] },
    // Уникальные улучшения машин.
    lightBody: { name: 'Облегчённый кузов', group: 'Уникальное', levels: 3, price: 50,
      about: 'Срезаны лишние панели: машина легче, дальше летит, но слабее.',
      effects: [{ stat: 'density', mul: [0.9, 0.82, 0.74] }, { stat: 'hp', mul: [0.97, 0.94, 0.9] }] },
    roofCan: { name: 'Подвесная канистра', group: 'Уникальное', levels: 2, price: 40,
      about: 'Запасные литры на крыше.',
      effects: [{ stat: 'tank', add: [3, 6] }] },
    winch: { name: 'Лебёдка', group: 'Уникальное', levels: 2, price: 110,
      about: 'Перевернулись — лебёдка ставит машину на колёса (раз или два за заезд).',
      effects: [{ stat: 'winch', set: [1, 2] }] },
    snorkel: { name: 'Шноркель', group: 'Уникальное', levels: 1, price: 90,
      about: 'Мотор не глохнет в бродах и затопленных низинах.',
      effects: [{ stat: 'snorkel', set: [true] }] },
    hydroPlow: { name: 'Гидроотвал', group: 'Уникальное', levels: 3, price: 160,
      about: 'Отвал подбрасывает толпу и почти не теряет скорость.',
      effects: [{ stat: 'fling', set: [1.4, 1.8, 2.3] }, { stat: 'ramDragCut', add: [0.1, 0.2, 0.3] }, { stat: 'ramMult', mul: [1.15, 1.3, 1.5] }] },
    ballast: { name: 'Балласт в кузове', group: 'Уникальное', levels: 2, price: 120,
      about: 'Мешки с песком в кузове: топтуну труднее перевернуть машину.',
      effects: [{ stat: 'flipResist', set: [0.35, 0.65] }, { stat: 'density', mul: [1.06, 1.12] }] },
    glass: { name: 'Бронестекло', group: 'Уникальное', levels: 1, price: 380,
      about: 'Бегунам не за что зацепиться: никто не сидит на крыше.',
      effects: [{ stat: 'noClimb', set: [true] }] },
    loophole: { name: 'Бойница', group: 'Уникальное', levels: 2, price: 300,
      about: 'Стрелок из бойницы помогает пулемёту.',
      effects: [{ stat: 'gunMult', set: [1.35, 1.7] }] },
    heavyGun: { name: 'Крупнокалиберный пулемёт', group: 'Уникальное', levels: 2, price: 650, requires: 'gun',
      about: 'Тяжёлый ствол: вдвое больше урона и дальше, стреляет реже.',
      effects: [{ stat: 'heavyGun', set: [1, 2] }] },
    mines: { name: 'Сброс мин', group: 'Уникальное', levels: 3, price: 500,
      about: 'Позади остаются мины для тех, кто гонится следом.',
      effects: [{ stat: 'mines', set: [1, 2, 3] }] },
    shock: { name: 'Электрокорпус', group: 'Уникальное', levels: 3, price: 900,
      about: 'Ток по корпусу: жжёт прицепившихся и тех, кто трётся о борт.',
      effects: [{ stat: 'shock', set: [40, 80, 130] }] },
    doubleNitro: { name: 'Двойное нитро', group: 'Уникальное', levels: 2, price: 1100, requires: 'nitro',
      about: 'Второй баллон и форсаж: нитро сильнее и дольше.',
      effects: [{ stat: 'nitroForce', mul: [1.3, 1.6] }, { stat: 'nitroCapacity', add: [2, 4] }] },
  };

  // Оружие на машине. Патронов нет — тратится прочность (wear, % за выстрел
  // или за секунду работы). Уровень берётся из улучшения с тем же именем.
  const WEAPONS = {
    gun: { name: 'Пулемёт', levels: [
      { damage: 7, rate: 3.5, range: 20, spread: 0.08, wear: 0.4 },
      { damage: 10, rate: 4.5, range: 23, spread: 0.07, wear: 0.34 },
      { damage: 14, rate: 5.5, range: 26, spread: 0.06, wear: 0.28 },
      { damage: 19, rate: 7, range: 30, spread: 0.05, wear: 0.22 },
    ] },
    flamer: { name: 'Огнемёт', levels: [
      { dps: 40, range: 4.5, cone: 0.45, wear: 3.2 },
      { dps: 55, range: 5.5, cone: 0.5, wear: 2.8 },
      { dps: 75, range: 6.5, cone: 0.55, wear: 2.4 },
      { dps: 100, range: 7.5, cone: 0.6, wear: 2.0 },
    ] },
    saw: { name: 'Пила', levels: [
      { dps: 90, reach: 0.9, wear: 2.6 },
      { dps: 130, reach: 1.1, wear: 2.2 },
      { dps: 180, reach: 1.3, wear: 1.8 },
      { dps: 240, reach: 1.5, wear: 1.5 },
    ] },
  };

  const PRICES = {
    growth: 1.85,            // каждый следующий уровень дороже в столько раз
    peas: [1, 2, 3, 4, 5, 6],// гороха за предпоследний уровень (по номеру машины)
    pearl: 1,                // жемчуга за последний уровень
  };

  // Стаб: заправка, станок, выручка, если совсем нет споранов.
  const STAB = {
    fuelPrice: 1,            // спораны за литр (× priceMult машины)
    repairPerHp: 0.12,       // спораны за единицу прочности
    weaponRepairPerPct: 0.3, // спораны за 1% прочности оружия
    charityFuel: 0.5,        // не хватает споранов — стаб бесплатно зальёт бак до этой доли...
    charityHp: 0.5,          // ...и залатает кузов до этой доли
  };

  // Заражённые. hp — сколько урона выдерживают; урон от удара машиной =
  // скорость сближения (м/с) × масса машины / 100 × множитель тарана.
  // drops: спораны [мин, макс], шанс гороха и жемчуга. LORE: Заражённые, Споран.
  const ZOMBIES = {
    walker: {
      name: 'Пустыш', w: 0.5, h: 1.7, mass: 60, hp: 12, speed: 0.7, sight: 18,
      attack: { damage: 2, every: 1.2 }, drag: 0.02,
      drops: { sporans: [1, 1], sporanChance: 0.5, peas: 0, pearl: 0 },
      color: '#8f9488', skin: '#a8ae9c',
    },
    runner: {
      name: 'Бегун', w: 0.45, h: 1.75, mass: 65, hp: 20, speed: 5.5, sight: 30,
      jump: { range: 25, vx: 2.5, vy: 7.5, every: 3, timing: [0.95, 1.2] }, // прыгает за ~1 с до встречи и падает на крышу
      cling: { damage: 1.5, maxOnCar: 3, shakeSpeed: 4, grip: [4, 7] },  // урон/с по кабине; рывок, сбрасывающий его; сколько секунд держится
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
    pushDamage: 1.5,      // упёрся в бампер: урон/с = скорость × масса машины / 100 × таран × это
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
    sporansPer100m: 12,       // за пройденную в заезде дистанцию
    recordPer100m: 12,        // сверху — за метры дальше прошлого рекорда на уровне
    stabBonus: 120,           // доехал до стаба
    outOfFuelStopTime: 1.5,   // сек почти без движения на пустом баке — конец заезда
  };

  // Препятствия: размеры, м; плотность, кг/м².
  const OBSTACLES = {
    crate: { size: 0.9, density: 25, friction: 0.6 },
    sandbag: { w: 1.1, h: 0.45, density: 40, friction: 0.8 },
    plank: { w: 2.6, h: 0.12, density: 20, friction: 0.6 },
    barrel: { r: 0.42, density: 30, friction: 0.5 },
    wreck: { w: 4.8, h: 1.0, density: 80, friction: 0.7 },
    log: { w: 3.2, h: 0.45, density: 45, friction: 0.5 },
    fencePlank: { w: 0.18, h: 1.4, density: 25, friction: 0.5 },
  };

  // Уровни: дорога от стаба к стабу. Сегменты идут подряд; objects — что стоит
  // на сегменте (dx — от начала сегмента). Названия стабов — игровые, см. LORE.md.
  const LEVELS = [
    {
      id: 'city',
      name: 'Городской кластер',
      from: 'Стаб «Элеватор»',
      to: 'Стаб «Депо»',
      car: 'sedan',
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
    {
      id: 'forest',
      name: 'Лесной кластер',
      from: 'Стаб «Депо»',
      to: 'Стаб «Лесопилка»',
      car: 'offroad',
      theme: { bg: 'forest', sky: ['#7a8a80', '#a8b0a0', '#c0c0b0'], ground: ['#4a3e2a', '#211a12'], road: '#3a3428', fog: 34 },
      crowds: { startAt: 50, every: 24, count: [2, 6], mix: { walker: 0.6, runner: 0.32, lottery: 0.08 } },
      segments: [
        { type: 'flat', length: 30 },
        { type: 'hills', length: 160, amp: 5, wave: 40, objects: [{ type: 'logs', dx: 70, count: 2 }, { type: 'canister', dx: 120 }] },
        { type: 'ford', length: 26, depth: 1.4 },
        { type: 'slope', length: 70, rise: 9 },
        { type: 'ramp', length: 14, height: 3.5 },
        { type: 'gap', length: 8, depth: 6 },
        { type: 'flat', length: 30, objects: [{ type: 'barricade', dx: 15, rows: 3, cols: 2 }] },
        { type: 'checkpoint' },
        { type: 'hills', length: 220, amp: 7, wave: 55, objects: [{ type: 'logs', dx: 50, count: 3 }, { type: 'zombies', kind: 'lottery', dx: 140, count: 2, spread: 4 }, { type: 'canister', dx: 180 }] },
        { type: 'slope', length: 50, rise: -8 },
        { type: 'ford', length: 34, depth: 1.6 },
        { type: 'fork', length: 170, kicker: { length: 16, height: 4 },
          upper: { gap: 7, height: 5.2, length: 120, objects: [{ type: 'canister', dx: 40 }, { type: 'canister', dx: 100 }] },
          lower: { objects: [{ type: 'logs', dx: 50, count: 3 }, { type: 'zombies', kind: 'stomper', dx: 120 }] } },
        { type: 'checkpoint' },
        { type: 'rubble', length: 80, objects: [{ type: 'crates', dx: 30, count: 4 }] },
        { type: 'slope', length: 60, rise: 7 },
        { type: 'drop', height: 5 },
        { type: 'hills', length: 200, amp: 6, wave: 50, objects: [{ type: 'logs', dx: 90, count: 2 }, { type: 'canister', dx: 150 }] },
        { type: 'checkpoint' },
        { type: 'ramp', length: 16, height: 4.5 },
        { type: 'gap', length: 10, depth: 7 },
        { type: 'hills', length: 160, amp: 5, wave: 40, objects: [{ type: 'zombies', kind: 'lottery', dx: 60, count: 3, spread: 3 }] },
        { type: 'ford', length: 30, depth: 1.5 },
        { type: 'flat', length: 60, objects: [{ type: 'barricade', dx: 30, rows: 4, cols: 3 }] },
        { type: 'stab', name: 'Стаб «Лесопилка»' },
      ],
    },
    {
      id: 'industrial',
      name: 'Промзона',
      from: 'Стаб «Лесопилка»',
      to: 'Стаб «Котельная»',
      car: 'pickup',
      theme: { bg: 'industrial', sky: ['#6a6058', '#9a8a78', '#b09a80'], ground: ['#4a4440', '#1e1c1a'], road: '#38363a' },
      crowds: { startAt: 40, every: 20, count: [4, 9], mix: { walker: 0.55, runner: 0.3, lottery: 0.15 } },
      segments: [
        { type: 'flat', length: 30 },
        { type: 'rubble', length: 90, objects: [{ type: 'barrels', dx: 40, count: 5 }, { type: 'canister', dx: 70 }] },
        { type: 'ramp', length: 14, height: 4 },
        { type: 'gap', length: 9, depth: 6 },
        { type: 'flat', length: 50, objects: [{ type: 'wrecks', dx: 20, count: 2 }] },
        { type: 'slope', length: 60, rise: 6 },
        { type: 'fork', length: 180, kicker: { length: 16, height: 4 },
          upper: { gap: 7, height: 5.4, length: 130, objects: [{ type: 'canister', dx: 50 }, { type: 'zombies', kind: 'lottery', dx: 90, count: 2 }] },
          lower: { objects: [{ type: 'barricade', dx: 40, rows: 4, cols: 3 }, { type: 'zombies', kind: 'ruber', dx: 130 }] } },
        { type: 'checkpoint' },
        { type: 'hills', length: 200, amp: 4, wave: 45, objects: [{ type: 'logs', dx: 60, count: 3, pipe: true }, { type: 'zombies', kind: 'stomper', dx: 150 }, { type: 'canister', dx: 110 }] },
        { type: 'drop', height: 4 },
        { type: 'rubble', length: 100, objects: [{ type: 'crates', dx: 30, count: 6 }, { type: 'wrecks', dx: 70, count: 2 }] },
        { type: 'bridge', deckBefore: 40, broken: 10, lip: 1.4, depth: 9, deckAfter: 40 },
        { type: 'checkpoint' },
        { type: 'hills', length: 220, amp: 5, wave: 55, objects: [{ type: 'zombies', kind: 'ruber', dx: 100 }, { type: 'barrels', dx: 160, count: 6 }, { type: 'canister', dx: 200 }] },
        { type: 'slope', length: 60, rise: 8 },
        { type: 'ramp', length: 16, height: 4.5 },
        { type: 'gap', length: 11, depth: 8 },
        { type: 'flat', length: 60, objects: [{ type: 'wrecks', dx: 25, count: 3 }] },
        { type: 'checkpoint' },
        { type: 'rubble', length: 140, objects: [{ type: 'zombies', kind: 'lottery', dx: 40, count: 3, spread: 3 }, { type: 'zombies', kind: 'stomper', dx: 110 }] },
        { type: 'hills', length: 160, amp: 4, wave: 40, objects: [{ type: 'barricade', dx: 90, rows: 4, cols: 3 }, { type: 'canister', dx: 40 }] },
        { type: 'stab', name: 'Стаб «Котельная»' },
      ],
    },
    {
      id: 'village',
      name: 'Деревня',
      from: 'Стаб «Котельная»',
      to: 'Стаб «Мельница»',
      car: 'van',
      theme: { bg: 'village', sky: ['#5a4a5a', '#c08a60', '#e0a870'], ground: ['#5a4a30', '#231b12'], road: '#4a3e2c' },
      crowds: { startAt: 40, every: 18, count: [4, 10], mix: { walker: 0.45, runner: 0.42, lottery: 0.13 } },
      segments: [
        { type: 'flat', length: 30 },
        { type: 'hills', length: 150, amp: 4, wave: 40, objects: [{ type: 'fence', dx: 50, count: 8 }, { type: 'canister', dx: 110 }] },
        { type: 'ford', length: 30, depth: 1.4 },
        { type: 'rubble', length: 80, objects: [{ type: 'zombies', kind: 'stomper', dx: 40 }] },
        { type: 'ramp', length: 16, height: 4.5 },
        { type: 'gap', length: 11, depth: 7 },
        { type: 'flat', length: 40, objects: [{ type: 'barricade', dx: 15, rows: 4, cols: 3 }] },
        { type: 'checkpoint' },
        { type: 'hills', length: 240, amp: 7, wave: 60, objects: [{ type: 'fence', dx: 40, count: 10 }, { type: 'zombies', kind: 'stomper', dx: 130 }, { type: 'zombies', kind: 'lottery', dx: 190, count: 3, spread: 3 }, { type: 'canister', dx: 220 }] },
        { type: 'fork', length: 200, kicker: { length: 18, height: 4.5 },
          upper: { gap: 8, height: 5.6, length: 150, objects: [{ type: 'canister', dx: 40 }, { type: 'canister', dx: 120 }] },
          lower: { objects: [{ type: 'zombies', kind: 'ruber', dx: 90 }, { type: 'fence', dx: 140, count: 8 }] } },
        { type: 'checkpoint' },
        { type: 'slope', length: 80, rise: 10 },
        { type: 'drop', height: 6 },
        { type: 'rubble', length: 120, objects: [{ type: 'zombies', kind: 'stomper', dx: 50 }, { type: 'wrecks', dx: 90, count: 2 }] },
        { type: 'hills', length: 220, amp: 6, wave: 55, objects: [{ type: 'zombies', kind: 'ruber', dx: 80 }, { type: 'fence', dx: 150, count: 10 }, { type: 'canister', dx: 200 }] },
        { type: 'checkpoint' },
        { type: 'ramp', length: 18, height: 5 },
        { type: 'gap', length: 12, depth: 8 },
        { type: 'hills', length: 200, amp: 5, wave: 50, objects: [{ type: 'zombies', kind: 'stomper', dx: 70 }, { type: 'zombies', kind: 'stomper', dx: 140 }] },
        { type: 'ford', length: 36, depth: 1.6 },
        { type: 'flat', length: 60, objects: [{ type: 'barricade', dx: 30, rows: 4, cols: 3 }] },
        { type: 'stab', name: 'Стаб «Мельница»' },
      ],
    },
    {
      id: 'river',
      name: 'Мост через реку',
      from: 'Стаб «Мельница»',
      to: 'Стаб «Переправа»',
      car: 'truck',
      theme: { bg: 'river', sky: ['#0e1420', '#1c2638', '#2a3448'], ground: ['#3a3a36', '#121210'], road: '#2e2e2c', night: true },
      crowds: { startAt: 40, every: 18, count: [5, 10], mix: { walker: 0.45, runner: 0.35, lottery: 0.15, stomper: 0.05 } },
      segments: [
        { type: 'flat', length: 30 },
        { type: 'hills', length: 160, amp: 4, wave: 45, objects: [{ type: 'canister', dx: 80 }] },
        { type: 'ford', length: 40, depth: 1.7 },
        { type: 'slope', length: 60, rise: 6 },
        { type: 'bridge', deckBefore: 60, broken: 11, lip: 1.5, depth: 10, deckAfter: 50 },
        { type: 'flat', length: 40, objects: [{ type: 'wrecks', dx: 15, count: 3 }] },
        { type: 'checkpoint' },
        { type: 'rubble', length: 120, objects: [{ type: 'zombies', kind: 'ruber', dx: 60 }, { type: 'barricade', dx: 100, rows: 4, cols: 3 }] },
        { type: 'bridge', deckBefore: 50, broken: 13, lip: 1.7, depth: 11, deckAfter: 40 },
        { type: 'hills', length: 220, amp: 6, wave: 55, objects: [{ type: 'zombies', kind: 'stomper', dx: 80 }, { type: 'zombies', kind: 'ruber', dx: 170 }, { type: 'canister', dx: 120 }] },
        { type: 'checkpoint' },
        { type: 'ford', length: 50, depth: 1.8 },
        { type: 'fork', length: 220, kicker: { length: 18, height: 4.5 },
          upper: { gap: 8, height: 5.8, length: 170, objects: [{ type: 'canister', dx: 60 }, { type: 'zombies', kind: 'lottery', dx: 120, count: 3 }] },
          lower: { objects: [{ type: 'wrecks', dx: 40, count: 3 }, { type: 'zombies', kind: 'ruber', dx: 120 }, { type: 'zombies', kind: 'stomper', dx: 180 }] } },
        { type: 'bridge', deckBefore: 40, broken: 14, lip: 1.8, depth: 12, deckAfter: 60 },
        { type: 'checkpoint' },
        { type: 'hills', length: 260, amp: 7, wave: 65, objects: [{ type: 'zombies', kind: 'ruber', dx: 60 }, { type: 'zombies', kind: 'ruber', dx: 160 }, { type: 'canister', dx: 220 }] },
        { type: 'ramp', length: 18, height: 5 },
        { type: 'gap', length: 13, depth: 9 },
        { type: 'rubble', length: 120, objects: [{ type: 'zombies', kind: 'stomper', dx: 50 }, { type: 'barricade', dx: 90, rows: 5, cols: 3 }] },
        { type: 'stab', name: 'Стаб «Переправа»' },
      ],
    },
    {
      id: 'dead',
      name: 'Окраина мёртвого кластера',
      from: 'Стаб «Переправа»',
      to: 'Стаб «Рубеж»',
      car: 'raider',
      theme: { bg: 'dead', sky: ['#1a0e14', '#3a1a22', '#5a2a2a'], ground: ['#2e2422', '#0e0a0a'], road: '#2a2020', fog: 30, night: true },
      crowds: { startAt: 40, every: 16, count: [5, 11], mix: { walker: 0.35, runner: 0.38, lottery: 0.17, stomper: 0.06, ruber: 0.04 } },
      segments: [
        { type: 'flat', length: 30 },
        { type: 'rubble', length: 120, objects: [{ type: 'zombies', kind: 'ruber', dx: 70 }, { type: 'canister', dx: 100 }] },
        { type: 'ramp', length: 18, height: 5 },
        { type: 'gap', length: 12, depth: 9 },
        { type: 'hills', length: 220, amp: 7, wave: 55, objects: [{ type: 'zombies', kind: 'stomper', dx: 60 }, { type: 'zombies', kind: 'ruber', dx: 150 }] },
        { type: 'checkpoint' },
        { type: 'slope', length: 80, rise: 10 },
        { type: 'drop', height: 7 },
        { type: 'bridge', deckBefore: 50, broken: 14, lip: 1.8, depth: 12, deckAfter: 50 },
        { type: 'rubble', length: 140, objects: [{ type: 'zombies', kind: 'stomper', dx: 40 }, { type: 'zombies', kind: 'stomper', dx: 90 }, { type: 'wrecks', dx: 120, count: 3 }, { type: 'canister', dx: 70 }] },
        { type: 'checkpoint' },
        { type: 'fork', length: 240, kicker: { length: 20, height: 5 },
          upper: { gap: 9, height: 6, length: 190, objects: [{ type: 'canister', dx: 50 }, { type: 'zombies', kind: 'ruber', dx: 120 }] },
          lower: { objects: [{ type: 'barricade', dx: 40, rows: 5, cols: 3 }, { type: 'zombies', kind: 'ruber', dx: 110 }, { type: 'zombies', kind: 'stomper', dx: 180 }] } },
        { type: 'hills', length: 260, amp: 8, wave: 65, objects: [{ type: 'zombies', kind: 'ruber', dx: 50 }, { type: 'zombies', kind: 'ruber', dx: 130 }, { type: 'zombies', kind: 'stomper', dx: 200 }, { type: 'canister', dx: 240 }] },
        { type: 'checkpoint' },
        { type: 'ramp', length: 20, height: 5.5 },
        { type: 'gap', length: 15, depth: 10 },
        { type: 'rubble', length: 160, objects: [{ type: 'zombies', kind: 'lottery', dx: 40, count: 4, spread: 3 }, { type: 'zombies', kind: 'ruber', dx: 120 }, { type: 'canister', dx: 80 }] },
        // Логово элиты перед воротами стаба.
        { type: 'flat', length: 90, objects: [{ type: 'zombies', kind: 'elite', dx: 55, boss: true }] },
        { type: 'stab', name: 'Стаб «Рубеж»' },
      ],
    },
  ];

  for (const [id, c] of Object.entries(CARS)) c.id = id;

  window.CONFIG = { PHYSICS, COLLIDE, CAMERA, CARS, UPGRADES, WEAPONS, PRICES, STAB, ZOMBIES, HORDE, PICKUPS, ECONOMY, OBSTACLES, LEVELS };
})();
