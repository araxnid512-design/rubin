'use strict';
/* 3D-бой: та же «отрисовка боя» (DW.TR), что и 2D, но картинка — three.js. Логика (ход по пути, анимации,
   тайминги выстрелов, звуки, туман, реплики) остаётся в 2D-модуле (DW.TR2) и работает как раньше; здесь —
   камера, выбор клеток, 3D-сцена, эффекты и интерфейс поверх. Если WebGL нет — бой идёт в 2D. */
(function (DW) {
  const R3 = DW.R3;
  if (!R3 || !R3.THREE || !DW.TR) return;
  const TR2 = DW.TR2 = DW.TR;
  const TR3 = DW.TR3 = Object.create(TR2);
  TR3.is3d = true;
  let B = null, fogV = -1;
  const T = R3.T;

  /* включён ли 3D: настройка «Бой в 3D» (по умолчанию да) и WebGL */
  DW.use3d = function () { return DW.settings.r3d !== false && R3.supported(); };
  /* выбрать отрисовку перед боем */
  DW.pickRenderer = function () { DW.TR = DW.use3d() ? TR3 : TR2; if (DW.TR !== TR3) R3.show(false); return DW.TR; };

  TR3.init = function (b) {
    B = b;
    TR2.init(b);
    if (!R3.ensure()) { DW.TR = TR2; return; }
    R3.show(true);
    R3.env.build(b);
    R3.world.build(b);
    R3.units.init(b);
    R3.fx.init(b);
    R3.detail.build(b);
    R3.items.init(b);
    R3.hud.init(b);
    fogV = -1;
    // камера: на отряд, вид с угла
    const sol = DW.BT.soldiers();
    let cx = b.w / 2, cy = b.h / 2;
    if (sol.length) { cx = 0; cy = 0; sol.forEach(function (s) { cx += s.x; cy += s.y; }); cx /= sol.length; cy /= sol.length; }
    R3.cam.yaw = R3.cam.yawTo = Math.PI / 4;
    R3.centerOn((cx + 0.5 + 2.5) * T, (cy + 0.5 - 0.5) * T, 25);
    // облёт в начале боя: издалека к отряду
    if (DW.settings.cine !== false && !b.flown3) {
      b.flown3 = true;
      const goal = [R3.cam.tx, R3.cam.tz, R3.cam.dist];
      R3.centerOn(b.w * 0.6 * T, b.h * 0.5 * T, 38);
      R3.cam.goal = goal;
    }
    TR3.resize(TR2.view.w, TR2.view.h);
  };
  TR3.resize = function (w, h) { TR2.resize(w, h); if (R3.ok) R3.resize(w, h, window.devicePixelRatio || 1); };
  TR3.update = function (dt) {
    TR2.update(dt);
    if (!R3.ok || !B) return;
    R3.camUpdate(dt);
    const t = TR2.now();
    R3.units.update(dt, t);
    R3.fx.update(dt);
    R3.detail.update(t);
    R3.items.update(t);
    R3.world.tick(dt);
    R3.world.fogTick();
    R3.fogU.uTime.value += dt;
    // тряска 2D-камеры (взрывы, отдача) → 3D
    if (TR2.shake > 0.3) { R3.cam.shake = Math.max(R3.cam.shake, TR2.shake); }
    // камера следует за идущим (своим или замеченным врагом), если он уходит к краю экрана
    const mover = B.units.find(function (u) { const tw = TR2.tweenOf(u.id); return tw && tw.kind === 'step' && u.alive && (u.side === 'p' || u.seen); });
    if (mover) {
      const s = R3.toScreen(R3.units.anchor(mover, false));
      const mx = R3.view.w * 0.22, my = R3.view.h * 0.22;
      if (s && (s[0] < mx || s[0] > R3.view.w - mx || s[1] < my || s[1] > R3.view.h - my)) {
        const a = R3.units.anchor(mover, false);
        const k = 1 - Math.exp(-dt * 2.2);
        R3.cam.tx += (a.x - R3.cam.tx) * k; R3.cam.tz += (a.z - R3.cam.tz) * k;
      }
    }
  };

  /* какие стены срезать: рядом с бойцами отряда (и целью) со стороны камеры, и весь дом, где кто-то стоит */
  let cutSet = null, cutKey = '';
  function cuts() {
    const W = DW.BT.WALLS3 || R3.world.WALLS;
    const yaw = R3.cam.yaw, cx = Math.sin(yaw), cz = Math.cos(yaw);
    let k = Math.round(yaw * 10) + ';';
    const who = B.units.filter(function (u) { return u.alive && !u.evac && (u.side === 'p' || (u.seen && DW.TR.overlay && DW.TR.overlay.target === u)); });
    who.forEach(function (u) { k += u.x + ',' + u.y + ';'; });
    if (k === cutKey && cutSet) return cutSet;
    cutKey = k;
    cutSet = new Uint8Array(B.w * B.h);
    const wall = function (x, y) { return x >= 0 && y >= 0 && x < B.w && y < B.h && (W[B.obj[y * B.w + x]] || R3.world.open[y * B.w + x]); };
    who.forEach(function (u) {
      for (let d = 1; d <= 4; d++) for (let s = -1; s <= 1; s++) {
        const x = Math.round(u.x + cx * d + cz * s * 0.9), y = Math.round(u.y + cz * d - cx * s * 0.9);
        if (wall(x, y)) cutSet[y * B.w + x] = 1;
      }
      // дом: передние стены комнаты, где стоит боец
      (B.rooms || []).forEach(function (r) {
        if (u.x < r[0] || u.x > r[2] || u.y < r[1] || u.y > r[3]) return;
        for (let y = r[1] - 1; y <= r[3] + 1; y++) for (let x = r[0] - 1; x <= r[2] + 1; x++) {
          const front = (cx > 0.3 && x >= r[2]) || (cx < -0.3 && x <= r[0]) || (cz > 0.3 && y >= r[3]) || (cz < -0.3 && y <= r[1]);
          if (front && wall(x, y)) cutSet[y * B.w + x] = 1;
        }
      });
    });
    return cutSet;
  }

  TR3.render = function (g, W, H, dpr) {
    if (!R3.ok || !B) return TR2.render(g, W, H, dpr);
    R3.resize(W, H, dpr);
    if (DW.BT.visVersion !== fogV) { fogV = DW.BT.visVersion; R3.world.updateFog(B, DW.BT.vis()); }
    R3.world.setCut(B, cuts());
    R3.env.update();
    R3.hud.update3d(TR2.now());
    R3.render();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    R3.hud.draw2d(g, W, H);
  };

  /* ---------- Камера и ввод ---------- */
  TR3.pan = function (dx, dy) { R3.pan(dx, dy); };
  TR3.zoomAt = function (f, sx, sy) { R3.zoomAt(f, sx, sy); };
  TR3.rotate = function (d) { R3.rotate(d); };
  TR3.screenToTile = function (sx, sy) { return R3.screenToTile(sx, sy); };
  TR3.pickUnit = function (sx, sy) { return R3.units.pick(sx, sy); };
  TR3.focusOn = function (tx, ty, force) { return R3.focus(tx, ty, force); };
  TR3.tileToScreen = function (x, y) { return R3.tileToScreen(x, y); };
  TR3.actionCam = function (att, tgt) {
    TR3._camBack = { tx: R3.cam.tx, tz: R3.cam.tz, d: R3.cam.dist };
    const X = ((att.x + tgt.x) / 2 * 0.9 + att.x * 0.1 + 0.5) * T, Z = ((att.y + tgt.y) / 2 * 0.9 + att.y * 0.1 + 0.5) * T;
    R3.cam.goal = [X, Z, Math.max(R3.camLimits.dMin + 2, R3.cam.dist * 0.72)];
    return new Promise(function (res) { R3.cam.waiters.push(res); setTimeout(res, 560 / ((DW.settings && DW.settings.speed) || 1)); });
  };
  TR3.actionCamEnd = function () {
    const b = TR3._camBack; TR3._camBack = null;
    if (b) R3.cam.goal = [R3.cam.tx, R3.cam.tz, b.d];
    if (TR2.actionCamEnd) TR2.actionCamEnd();
  };
  TR3.isAnimating = function () { return TR2.isAnimating() || (R3.fx.busy && R3.fx.busy()) || !!R3.cam.goal || Math.abs(R3.cam.yawTo - R3.cam.yaw) > 0.01 || R3.cam.shake > 0.05; };
  TR3.applyQuality = function (atInit) { TR2.applyQuality(atInit); R3.applyQuality(); };

  /* ---------- Эффекты: логика и звук — 2D, картинка — 3D ---------- */
  TR3.shotFx = function (att, tgt, hit, W, show, suppress, opt) {
    const r = TR2.shotFx.apply(TR2, arguments);
    if (R3.ok) R3.fx.shot(att, tgt, hit, W, show, suppress, opt);
    return r;
  };
  TR3.projectileFx = function (x0, y0, x1, y1, kind, from) {
    const r = TR2.projectileFx(x0, y0, x1, y1, kind, from);
    if (R3.ok) R3.fx.projectile(x0, y0, x1, y1, kind, from, (kind === 'rocket' ? 400 : 560) / ((DW.settings && DW.settings.speed) || 1));
    return r;
  };
  TR3.explosionFx = function (x, y, r) { const o = TR2.explosionFx(x, y, r); if (R3.ok) R3.fx.explosion(x, y, r); return o; };
  TR3.hitFx = function (u) { const o = TR2.hitFx(u); if (R3.ok) R3.fx.hit(u); return o; };
  TR3.debris = function (x, y, color, o) { const r = TR2.debris(x, y, color, o); if (R3.ok) R3.fx.debris(x, y, color); return r; };
  TR3.chips = function (x, y, color, o) { const r = TR2.chips(x, y, color, o); if (R3.ok) R3.fx.chips(x, y, color); return r; };
  TR3.decal = function (x, y, kind, size) { const r = TR2.decal(x, y, kind, size); if (R3.ok) R3.fx.decal(x, y, kind, size); return r; };
  TR3.blood = function (u) { const r = TR2.blood(u); if (R3.ok) R3.fx.decal(u.x, u.y, TR2.bloodKind ? TR2.bloodKind(u) : 'red', 0.8); return r; };
  TR3.cargoFx = function (x, y) { const r = TR2.cargoFx(x, y); if (R3.ok) R3.fx.cargo(x, y); return r; };
  TR3.stepFx = function (u, nx, ny) { const r = TR2.stepFx(u, nx, ny); if (R3.ok && (u.side === 'p' || u.seen)) R3.fx.step(u); return r; };
  TR3.tileChanged = function (x, y) { const r = TR2.tileChanged(x, y); if (R3.ok && B) R3.world.tileChanged(B, x, y); return r; };
})(window.DW);
