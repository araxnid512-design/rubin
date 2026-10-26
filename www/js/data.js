// Игровые данные. У каждой записи — ссылка на раздел LORE.md.
// Числа (скорость, урон, здоровье) — геймплейный баланс, в каноне их нет.
(function () {
  const ENEMIES = {
    // LORE.md → Заражённые: бегун, жёлтая стадия, быстрый и выносливый.
    runner: {
      name: 'Бегун',
      hp: 50,
      speed: 150,
      radius: 14,
      damage: 10,
      color: '#b7a24a',
    },
    // LORE.md → Заражённые: лотерейщик, жёлтая стадия, следующий после бегуна.
    lottery: {
      name: 'Лотерейщик',
      hp: 120,
      speed: 125,
      radius: 18,
      damage: 18,
      color: '#d0a030',
    },
  };

  // LORE.md → Споран: обычно 1–2, реже 3, бывает пустой.
  // Конкретные вероятности — баланс.
  const SPORAN_ROLL = [
    { count: 0, weight: 15 },
    { count: 1, weight: 50 },
    { count: 2, weight: 25 },
    { count: 3, weight: 10 },
  ];

  const WEAPON = {
    damage: 25,
    bulletSpeed: 700,
    fireInterval: 0.18,
    magazine: 12,
    reloadTime: 1.2,
    range: 600,
  };

  const PLAYER = {
    hp: 100,
    speed: 220,
    radius: 16,
    hitCooldown: 0.8,
  };

  window.GameData = { ENEMIES, SPORAN_ROLL, WEAPON, PLAYER };
})();
