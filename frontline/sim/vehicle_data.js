// Ходовые и боевые параметры техники (в JSON — только классы и грузовые места; физики вождения там нет).
// speed — м/с, accel — м/с², turn — рад/с на полной скорости, radius — круг столкновений, guns — оружие с расходом патронов со склада.
export const VEH = {
  veh_motorcycle: { speed: 17, accel: 9, turn: 2.6, hp: 60, len: 2.2, wid: 0.8, radius: 0.7 },
  veh_light_car: { speed: 16, accel: 7, turn: 2.1, hp: 120, len: 4.2, wid: 1.8, radius: 1.25 },
  veh_utility_car: { speed: 14, accel: 6, turn: 1.9, hp: 160, len: 4.4, wid: 2.0, radius: 1.35 },
  veh_cargo_truck: { speed: 11, accel: 4, turn: 1.4, hp: 240, len: 7.2, wid: 2.5, radius: 1.7 },
  veh_scrap_harvester: { speed: 8, accel: 3.5, turn: 1.3, hp: 280, len: 6.6, wid: 2.8, radius: 1.8, harvest: true },
  veh_fuel_tanker: { speed: 10, accel: 3.8, turn: 1.4, hp: 200, len: 7.5, wid: 2.5, radius: 1.7 },
  veh_armored_scout: { speed: 13, accel: 5, turn: 1.8, hp: 420, len: 5.2, wid: 2.3, radius: 1.55, guns: [{ kind: 'vehicle_mg', ammo: 'ammo_762x54_belt', load: 240 }] },
  veh_light_tank: { speed: 8.5, accel: 3, turn: 1.2, hp: 750, len: 5.6, wid: 2.8, radius: 1.85, guns: [{ kind: 'tank_gun', ammo: 'ammo_37mm_tank', load: 24 }, { kind: 'vehicle_mg', ammo: 'ammo_762x54_belt', load: 240 }] },
  veh_apc: { speed: 11, accel: 4, turn: 1.4, hp: 560, len: 6.6, wid: 2.7, radius: 1.85, guns: [{ kind: 'vehicle_mg', ammo: 'ammo_762x54_belt', load: 240 }] },
};
