// Модели оружия движка: способ удержания (профиль хвата скелета) и тип перезарядки для анимации.
// Игровые параметры оружия — в data/items.json и sim/army.js (WSTAT); здесь только визуальная часть.
export const WEAPON_KINDS = {
  pm: { hold: 'pistol', reload: 'pistol' },
  aps: { hold: 'pistol', reload: 'pistol' },
  tt: { hold: 'pistol', reload: 'pistol' },
  aks74u: { hold: 'smg', reload: 'mag' },
  bizon: { hold: 'smg', reload: 'mag' },
  kedr: { hold: 'smg', reload: 'mag' },
  ak74: { hold: 'rifle', reload: 'mag' },
  akm: { hold: 'rifle', reload: 'mag' },
  an94: { hold: 'rifle', reload: 'mag' },
  val: { hold: 'rifle', reload: 'mag' },
  sks: { hold: 'rifle', reload: 'clip' },
  svd: { hold: 'sniper', reload: 'mag' },
  vss: { hold: 'sniper', reload: 'mag' },
  mosin: { hold: 'sniper', reload: 'clip' },
  toz34: { hold: 'shotgun', reload: 'break' },
  saiga: { hold: 'shotgun', reload: 'mag' },
  ks23: { hold: 'shotgun', reload: 'shells' },
  pkm: { hold: 'mg', reload: 'box' },
  rpk74: { hold: 'mg', reload: 'mag' },
  rg6: { hold: 'launcher', reload: 'drum' },
};
export const weapon = (id) => WEAPON_KINDS[id] || null;
