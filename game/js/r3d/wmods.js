'use strict';
/* 3D-бой: модули оружия на модели (прицел, глушитель, расширенный магазин, приклад) — заглушка, реализация в работе.
   R3.wmods.attach(W, mods, weaponId): W — оружие из units.js makeWeapon (W.g — группа; ствол к −Z, начало — рукоять;
   W.muzzle, W.fore, W.len, W.buttZ, W.buttY), mods — ['scope','mag','supp','stock'], weaponId — ключ DW.M3.weapons. */
(function (DW) {
  const R3 = DW.R3;
  if (!R3 || !R3.THREE) return;
  R3.wmods = { attach: function () {} };
})(window.DW);
