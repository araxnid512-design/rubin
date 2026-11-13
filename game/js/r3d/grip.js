'use strict';
/* 3D-бой: хват оружия кистями — поворот кистей (правая ладонь обхватывает рукоять, левая поддерживает цевьё
   снизу) и сгиб пальцев. Вызывается из units.js после того, как руки дотянулись до оружия (IK).
   R3.grip.apply(o): o = { body (тело: B — кости, holder), W (оружие: g, fore, muzzle), M (матрица оружия в мире),
   mode (aim/carry/hip), grip, fore (точки в мире), key (движение), freeL, reload, calib }. */
(function (DW) {
  const R3 = DW.R3;
  if (!R3 || !R3.THREE) return;
  R3.grip = { apply: function () { /* пока без поправок */ } };
})(window.DW);
