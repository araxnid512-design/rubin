// Экономика стаба: цены улучшений, покупка, заправка, ремонт, покупка машин.
// Только расчёты над сохранением — интерфейс в stab.js.
(function () {
  const C = () => window.CONFIG;

  function carSave(save, carId) {
    if (!save.cars[carId]) save.cars[carId] = { owned: false, upgrades: {}, fuel: null, hp: null, weapons: {} };
    return save.cars[carId];
  }

  function carIndex(carId) { return Object.keys(C().CARS).indexOf(carId); }

  // Цена следующего уровня улучшения: { sporans, peas, pearls } или null, если максимум.
  function upgradeCost(carId, upId, level) {
    const u = C().UPGRADES[upId], P = C().PRICES, car = C().CARS[carId];
    if (level >= u.levels) return null;
    const next = level + 1;
    const cost = { sporans: Math.round(u.price * Math.pow(P.growth, level) * car.priceMult / 5) * 5, peas: 0, pearls: 0 };
    if (next === u.levels) cost.pearls = P.pearl;
    else if (next === u.levels - 1 && u.levels >= 3) cost.peas = P.peas[carIndex(carId)] || 1;
    return cost;
  }

  function canPay(save, cost) {
    return cost && save.sporans >= cost.sporans && save.peas >= (cost.peas || 0) && save.pearls >= (cost.pearls || 0);
  }

  function pay(save, cost) {
    save.sporans -= cost.sporans;
    save.peas -= cost.peas || 0;
    save.pearls -= cost.pearls || 0;
  }

  function stats(save, carId) {
    return window.Physics.carStats(C().CARS[carId], carSave(save, carId).upgrades);
  }

  // Улучшение доступно на этой машине и выполнено условие (например, объём нитро — после нитро).
  function available(carId, upId, save) {
    const car = C().CARS[carId], u = C().UPGRADES[upId];
    if (!car.upgrades.includes(upId)) return false;
    if (u.requires && !(carSave(save, carId).upgrades[u.requires] > 0)) return false;
    return true;
  }

  function buyUpgrade(save, carId, upId) {
    const cs = carSave(save, carId);
    const lvl = cs.upgrades[upId] || 0;
    const cost = upgradeCost(carId, upId, lvl);
    if (!cost || !canPay(save, cost) || !available(carId, upId, save)) return false;
    const before = stats(save, carId);
    pay(save, cost);
    cs.upgrades[upId] = lvl + 1;
    // Больше бак или прочность — текущий запас растёт пропорционально.
    const after = stats(save, carId);
    if (cs.hp != null && after.hp !== before.hp) cs.hp = cs.hp / before.hp * after.hp;
    if (C().UPGRADES[upId].weapon) cs.weapons[upId] = 100;
    return true;
  }

  // Текущие бензин и прочность (null = полные, при первом выезде на машине).
  function fuelOf(save, carId) { const cs = carSave(save, carId), st = stats(save, carId); return cs.fuel == null ? st.tank : Math.min(cs.fuel, st.tank); }
  function hpOf(save, carId) { const cs = carSave(save, carId), st = stats(save, carId); return cs.hp == null ? st.hp : Math.min(cs.hp, st.hp); }

  function fuelPrice(carId) { return C().STAB.fuelPrice * C().CARS[carId].priceMult; }

  // Купить литры (или сколько хватит денег). Возвращает залитые литры.
  function buyFuel(save, carId, liters) {
    const cs = carSave(save, carId), st = stats(save, carId);
    const have = fuelOf(save, carId);
    const price = fuelPrice(carId);
    let l = Math.min(liters, st.tank - have, Math.floor(save.sporans / price * 10) / 10);
    if (l <= 0) return 0;
    l = Math.round(l * 10) / 10;
    save.sporans -= Math.ceil(l * price);
    cs.fuel = have + l;
    return l;
  }

  function repairCost(save, carId) {
    const st = stats(save, carId);
    return Math.ceil((st.hp - hpOf(save, carId)) * C().STAB.repairPerHp * C().CARS[carId].priceMult);
  }

  function repair(save, carId) {
    const cs = carSave(save, carId), st = stats(save, carId);
    const missing = st.hp - hpOf(save, carId);
    if (missing <= 0) return 0;
    const perHp = C().STAB.repairPerHp * C().CARS[carId].priceMult;
    const hp = Math.min(missing, save.sporans / perHp);
    if (hp <= 0) return 0;
    save.sporans -= Math.ceil(hp * perHp);
    cs.hp = hpOf(save, carId) + hp;
    return hp;
  }

  function weaponRepairCost(save, carId, upId) {
    const pct = 100 - (carSave(save, carId).weapons[upId] ?? 100);
    return Math.ceil(pct * C().STAB.weaponRepairPerPct * C().CARS[carId].priceMult);
  }

  function repairWeapon(save, carId, upId) {
    const cs = carSave(save, carId);
    const cost = weaponRepairCost(save, carId, upId);
    if (!cost || save.sporans < cost) return false;
    save.sporans -= cost;
    cs.weapons[upId] = 100;
    return true;
  }

  // Не хватает споранов залить бак или залатать кузов до половины — стаб выручает бесплатно.
  function charity(save, carId) {
    const S = C().STAB, cs = carSave(save, carId), st = stats(save, carId);
    const notes = [];
    const minFuel = st.tank * S.charityFuel, fuel = fuelOf(save, carId);
    if (fuel < minFuel && save.sporans < (minFuel - fuel) * fuelPrice(carId)) {
      cs.fuel = minFuel;
      notes.push(`Стаб выручил: бак залит до ${Math.round(minFuel)} л`);
    }
    const minHp = st.hp * S.charityHp, hp = hpOf(save, carId);
    if (hp < minHp && save.sporans < (minHp - hp) * S.repairPerHp * C().CARS[carId].priceMult) {
      cs.hp = minHp;
      notes.push('Механики стаба залатали кузов');
    }
    return notes;
  }

  function buyCar(save, carId) {
    const car = C().CARS[carId];
    const cs = carSave(save, carId);
    if (cs.owned) return false;
    const cost = { sporans: car.price.sporans || 0, peas: car.price.peas || 0, pearls: car.price.pearls || 0 };
    if (!canPay(save, cost)) return false;
    pay(save, cost);
    cs.owned = true;
    save.car = carId;
    return true;
  }

  window.Shop = {
    carSave, upgradeCost, canPay, buyUpgrade, available, stats, fuelOf, hpOf, fuelPrice, buyFuel,
    repairCost, repair, weaponRepairCost, repairWeapon, charity, buyCar,
  };
})();
