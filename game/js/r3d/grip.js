'use strict';
/* 3D-бой: хват оружия кистями — поворот кистей (правая ладонь обхватывает рукоять, левая поддерживает цевьё
   снизу) и сгиб пальцев. Вызывается из units.js после того, как руки дотянулись до оружия (IK).
   R3.grip.apply(o): o = { body (тело: B — кости, holder), W (оружие: g, fore, muzzle), M (матрица оружия в мире),
   mode (aim/carry/hip), grip, fore (точки в мире), key (движение), freeL, reload, calib }.

   Как устроено:
   • поворот кисти задаётся в осях оружия (M): ось кисти F (запястье → основание среднего пальца), нормаль ладони N;
     оси самой кисти в её кости (F, N, сторона большого пальца) считаются один раз по положению костей пальцев —
     поэтому работает на любой модели (Tripo R_Hand/R_Index1…, Mixamo mixamorigRightHandIndex1…);
   • ладонь (точка между запястьем и основанием среднего пальца) ставится на рукоять / цевьё настоящего оружия
     (начало W.g — рукоять, W.fore — цевьё; если не дотянуться — сдвиг вдоль ствола к прикладу);
   • рука заново решается двухзвенной IK под новое положение запястья; локоть — между прежним и тем, при котором
     запястье прямое; скрутку кисти частично берёт предплечье (поворот вокруг своей оси), изгиб запястья
     относительно предплечья не больше P.bendMax, скрутка — не больше P.twistMax;
   • пальцы сгибаются вокруг оси «направление пальца × нормаль ладони» (считается для каждой фаланги один раз).
   Без выделения памяти в кадре: временные векторы модуля, кэш костей и осей — в body._grip.
   Параметры подбираются на стенде tools/three3d/griplab (кнопка «JSON» → вставить в P). */
(function (DW) {
  const R3 = DW.R3;
  if (!R3 || !R3.THREE) return;
  const THREE = R3.THREE;
  const DEG = Math.PI / 180;

  /* ---------- Параметры (стенд: tools/three3d/griplab) ----------
     Оси оружия: X — вправо от стрелка, Y — вверх, −Z — вперёд по стволу; начало — точка хвата из models.js.
     R — правая на пистолетной рукояти: rake — наклон оси кисти вниз от ствола (рукоять завалена назад), °;
     L — левая под цевьём ладонью вверх: fan — пальцы от «вправо поперёк» к «вперёд», °.
     rot: [скрутка вокруг оси кисти, отклонение в плоскости ладони, сгиб к ладони/к тылу], °.
     depth — ладонь (кость) от оси рукояти/цевья против нормали ладони, fwd — вдоль оси кисти, up — к большому
     пальцу, м (для кисти длиной 9 см, у крупных кистей — больше); off — добавка в осях оружия, м.
     curl: [осн., средн., ногтевая] фаланги, °; thumb: [разворот к ладони, осн., средн., ногтевая], °.
     wpn: g — центр пистолетной рукояти [y, z] от начала оружия, f — ось цевья [y, z] от W.fore, rk — наклон
     рукояти (вместо R.rake), м/°. */
  const P = {
    R: { rake: 18, rot: [0, 0, 0], depth: 0.026, fwd: -0.025, up: 0, off: [0, 0, 0],
      curl: { index: [25, 45, 20], mid: [65, 85, 45], ring: [70, 85, 45], pinky: [75, 85, 45] }, thumb: [30, 20, 25, 20] },
    L: { fan: 40, rot: [0, 0, 0], depth: 0.03, fwd: -0.01, up: 0, off: [0, 0, 0],
      curl: { index: [35, 55, 30], mid: [40, 60, 30], ring: [45, 60, 30], pinky: [50, 60, 30] }, thumb: [10, 10, 10, 10] },
    // свободная кисть (перезарядка): пальцы полусогнуты
    relax: { curl: { index: [15, 25, 10], mid: [20, 30, 15], ring: [25, 35, 15], pinky: [30, 35, 15] }, thumb: [10, 10, 10, 5] },
    foreTwist: 0.5,      // доля скрутки кисти, которую берёт предплечье
    twistMax: 50,        // скрутка в запястье, не больше, °
    bendMax: 35,         // изгиб запястья относительно предплечья, не больше, °
    align: 0.5,          // локоть: 0 — где был, 1 — где запястье прямое
    poleDown: 0.15,      // локоть: тянуть вниз, м
    reach: 0.985,        // доля длины руки, дальше — ладонь сдвигается по стволу к прикладу
    weaponPts: 1,        // 1 — ладони на рукоять/цевьё настоящего оружия, 0 — в точки из units.js (o.grip/o.fore)
    wpn: {
      ak: { g: [-0.035, 0.06], f: [0.015, -0.06] },
      ak2: { g: [-0.05, 0.07], f: [0.03, -0.04] },
      ppsh: { g: [-0.02, 0.015], f: [0.04, -0.05] },
      shotgun: { g: [-0.06, 0.035], f: [0.01, -0.06], rk: 25 },
      sniper: { g: [-0.085, 0.125], f: [-0.012, -0.02], rk: 28 },
      lmg: { g: [-0.025, 0.095], f: [0.03, -0.01] },
      hsniper: { g: [-0.1, 0.24], f: [-0.03, 0] },
      hlmg: { g: [-0.04, 0.055], f: [0, 0] },
      rpg: { g: [-0.035, -0.17], f: [0, -0.05] }
    }
  };
  const HAND0 = 0.09;    // длина кисти (запястье → основание среднего пальца), под которую заданы depth/fwd/up

  /* ---------- Временные объекты (без выделения памяти в кадре) ---------- */
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
  const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _pt = new THREE.Vector3();
  const _el = new THREE.Vector3(), _dir = new THREE.Vector3(), _pl = new THREE.Vector3(), _sc = new THREE.Vector3();
  const _palmT = new THREE.Vector3(), _wrist = new THREE.Vector3(), _pole = new THREE.Vector3(), _ax = new THREE.Vector3();
  const _xW = new THREE.Vector3(), _yW = new THREE.Vector3(), _zW = new THREE.Vector3(), _org = new THREE.Vector3();
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qM = new THREE.Quaternion();
  const _qT = new THREE.Quaternion(), _qF = new THREE.Quaternion(), _qRel = new THREE.Quaternion(), _qTw = new THREE.Quaternion();
  const _qA = new THREE.Quaternion(), _qB = new THREE.Quaternion(), _qC = new THREE.Quaternion();
  const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _dp = new THREE.Vector3();

  function wpos(o, out) { return out.setFromMatrixPosition(o.matrixWorld); }
  function wquat(o, out) { o.matrixWorld.decompose(_dp, out, _sc); return out; }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  /* ---------- Кэш тела: кости, оси кисти и пальцев ---------- */
  const FINGERS = ['index', 'mid', 'ring', 'pinky', 'thumb'];
  const FRX = { index: /index/i, mid: /mid/i, ring: /ring/i, pinky: /pinky|little/i, thumb: /thumb/i };
  function chainOf(hand, rx) {
    // первая кость пальца — прямой потомок кисти с подходящим именем, дальше — по первому потомку-кости
    let b = null;
    for (const c of hand.children) if (c.isBone && rx.test(c.name)) { b = c; break; }
    const out = [];
    while (b && out.length < 3) { out.push(b); let n = null; for (const c of b.children) if (c.isBone) { n = c; break; } b = n; }
    return out;
  }
  function sideRig(body, side) {
    const B = body.B, hand = B[side + 'Hand'], fore = B[side + 'ForeArm'], arm = B[side + 'Arm'];
    if (!hand || !fore || !arm) return null;
    const S = { side: side, hand: hand, fore: fore, arm: arm, fing: {} };
    for (const f of FINGERS) S.fing[f] = chainOf(hand, FRX[f]);
    const mid = S.fing.mid[0], idx = S.fing.index[0], pk = S.fing.pinky[0] || S.fing.ring[0];
    // оси кисти в её кости: F — к основанию среднего пальца, T — от мизинца к указательному, N — нормаль ладони
    const F = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3();
    if (mid) F.copy(mid.position).normalize(); else F.copy(hand.position).applyQuaternion(_q1.copy(hand.quaternion).invert()).normalize();
    if (idx && pk) T.copy(idx.position).sub(pk.position); else T.set(1, 0, 0);
    T.addScaledVector(F, -T.dot(F));
    if (T.lengthSq() < 1e-10) T.set(1, 0, 0).addScaledVector(F, -F.x);
    T.normalize();
    // правая: N = T × F, левая: N = F × T (ладонь вперёд при опущенной руке, большой палец наружу)
    if (side === 'Right') N.crossVectors(T, F); else N.crossVectors(F, T);
    N.normalize();
    const T2 = new THREE.Vector3().crossVectors(F, N).normalize();
    S.F = F; S.N = N;
    // базис кисти (столбцы F, N, F×N) → для перевода «оси кисти» в «оси оружия»
    S.Hl = new THREE.Matrix4().makeBasis(F, N, T2);
    // ладонь в кости кисти (как palm() в units.js: 0,75 пути до основания среднего пальца)
    S.palmL = mid ? mid.position.clone().multiplyScalar(0.75) : F.clone().multiplyScalar(0.3 * hand.position.length());
    // направление предплечья (локоть → запястье) в осях кисти при покое (запястье прямое)
    S.q0h = hand.quaternion.clone();
    S.axF = hand.position.clone().normalize();                                   // ось предплечья в его кости
    S.faL = S.axF.clone().applyQuaternion(_q1.copy(S.q0h).invert());             // она же в осях кисти при покое
    // масштаб и длины звеньев в мире
    hand.matrixWorld.decompose(_v1, _q1, _sc);
    S.s = _sc.x;
    S.la = wpos(arm, _v1).distanceTo(wpos(fore, _v2));
    S.lb = _v2.distanceTo(wpos(hand, _v3));
    // пальцы: покой и ось сгиба каждой фаланги в осях её родителя
    S.rest = {}; S.axes = {}; S.spread = null;
    for (const f of FINGERS) {
      const ch = S.fing[f];
      S.rest[f] = ch.map(function (b) { return b.quaternion.clone(); });
      if (!ch.length) { S.axes[f] = []; continue; }
      // направление пальца в осях кисти: от первой фаланги к последней (или по позиции первой)
      const p1 = ch[0].position.clone();
      let pEnd = p1.clone();
      const acc = new THREE.Quaternion();
      for (let i = 1; i < ch.length; i++) { acc.multiply(ch[i - 1].quaternion); pEnd = pEnd.clone().add(ch[i].position.clone().applyQuaternion(acc)); }
      const d = pEnd.clone().sub(p1);
      if (d.lengthSq() < 1e-12) d.copy(p1);
      d.normalize();
      const k = new THREE.Vector3().crossVectors(d, N);
      if (k.lengthSq() < 1e-8) k.copy(T2);
      k.normalize();
      // ось в осях родителя каждой фаланги (поворот вокруг k не меняет k — сгиб предыдущих фаланг не мешает)
      const ax = [];
      const qacc = new THREE.Quaternion();
      for (let i = 0; i < ch.length; i++) {
        ax.push(k.clone().applyQuaternion(_q1.copy(qacc).invert()));
        qacc.multiply(ch[i].quaternion);
      }
      S.axes[f] = ax;
      if (f === 'thumb') S.spread = N.clone();      // разворот большого пальца — вокруг нормали ладони
    }
    S.qHw = new THREE.Quaternion(); S.ver = -1; S.style = '';
    S.Fw = new THREE.Vector3(); S.Nw = new THREE.Vector3(); S.Tw = new THREE.Vector3();
    S.hs = (mid ? mid.position.length() * S.s : HAND0) / HAND0;      // размер кисти против эталона
    S.dbg = { bend: 0, rawBend: 0, twist: 0, roll: 0, slide: 0 };
    return S;
  }
  function rig(body) {
    if (body._grip !== undefined) return body._grip;
    body._grip = (body.B && body.B.RightHand) ? { R: sideRig(body, 'Right'), L: sideRig(body, 'Left') } : null;
    return body._grip;
  }

  /* ---------- Поза кисти в осях оружия ---------- */
  const _F0 = new THREE.Vector3(), _N0 = new THREE.Vector3(), _T0 = new THREE.Vector3();
  function rotAbout(v, axis, deg) { if (deg) v.applyAxisAngle(axis, deg * DEG); }
  /* style: 'pistol' — ладонь сбоку рукояти (правая — слева от ладони, левая на передней рукояти — справа),
     'guard' — левая под цевьём ладонью вверх, пальцы обхватывают правый бок. Результат: S.qHw — кисть → оружие. */
  function handInWeapon(S, style, ph, rake) {
    if (style === 'guard') {
      // пальцы вправо и вперёд (fan°), ладонь вверх
      const a = (ph.fan || 0) * DEG;
      _F0.set(Math.cos(a), 0, -Math.sin(a)); _N0.set(0, 1, 0);
    } else {
      const r = (rake !== undefined ? rake : (ph.rake || 0)) * DEG;
      _F0.set(0, -Math.sin(r), -Math.cos(r));
      _N0.set(S.side === 'Right' ? -1 : 1, 0, 0);
    }
    _T0.crossVectors(_F0, _N0).normalize();
    const rt = ph.rot || [0, 0, 0];
    // скрутка вокруг F, отклонение вокруг N, сгиб вокруг T (в осях кисти)
    rotAbout(_N0, _F0, rt[0]); _T0.crossVectors(_F0, _N0).normalize();
    rotAbout(_F0, _N0, rt[1]); _T0.crossVectors(_F0, _N0).normalize();
    rotAbout(_F0, _T0, rt[2]); rotAbout(_N0, _T0, rt[2]);
    _N0.addScaledVector(_F0, -_N0.dot(_F0)).normalize();
    _T0.crossVectors(_F0, _N0).normalize();
    S.Fw.copy(_F0); S.Nw.copy(_N0); S.Tw.copy(_T0);
    _m1.makeBasis(_F0, _N0, _T0);
    _m2.copy(S.Hl).transpose();
    _m1.multiply(_m2);
    S.qHw.setFromRotationMatrix(_m1);
  }

  /* ---------- Двухзвенная IK без выделения памяти ---------- */
  function aimBone(bone, childNow, want) {
    wpos(bone, _pt);
    _v1.copy(childNow).sub(_pt).normalize(); _v2.copy(want).sub(_pt).normalize();
    _q1.setFromUnitVectors(_v1, _v2);
    wquat(bone, _q2);
    _q1.multiply(_q2);
    wquat(bone.parent, _q3).invert();
    bone.quaternion.copy(_q3.multiply(_q1));
    bone.updateMatrixWorld(true);
  }
  function ik2(S, target, pole) {
    wpos(S.arm, _pa); wpos(S.fore, _pb); wpos(S.hand, _pc);
    const la = S.la, lb = S.lb;
    const d = Math.min(target.distanceTo(_pa), la + lb - 1e-4);
    _dir.copy(target).sub(_pa).normalize();
    const ang = Math.acos(clamp((la * la + d * d - lb * lb) / (2 * la * Math.max(d, 1e-5)), -1, 1));
    _pl.copy(pole).sub(_pa); _pl.addScaledVector(_dir, -_pl.dot(_dir));
    if (_pl.lengthSq() < 1e-10) _pl.set(0, -1, 0);
    _pl.normalize();
    _el.copy(_pa).addScaledVector(_dir, Math.cos(ang) * la).addScaledVector(_pl, Math.sin(ang) * la);
    aimBone(S.arm, _pb, _el);
    wpos(S.hand, _pc);
    _v3.copy(_pa).addScaledVector(_dir, d);
    aimBone(S.fore, _pc, _v3);
  }

  /* ---------- Кисть: поворот qT (мир), ладонь в palmT ---------- */
  const _q0a = new THREE.Quaternion(), _q0f = new THREE.Quaternion();
  function solveHand(S, qWant, palmT, iters) {
    _q0a.copy(S.arm.quaternion); _q0f.copy(S.fore.quaternion);
    _qT.copy(qWant);
    for (let it = 0; it < iters; it++) {
      // каждый проход — от позы, оставленной units.js (иначе скрутка предплечья накапливалась бы)
      S.arm.quaternion.copy(_q0a); S.fore.quaternion.copy(_q0f); S.arm.updateMatrixWorld(true);
      // запястье: ладонь в palmT при повороте qT
      _v4.copy(S.palmL).multiplyScalar(S.s).applyQuaternion(_qT);
      _wrist.copy(palmT).sub(_v4);
      // полюс локтя: между нынешним локтем и тем, при котором запястье прямое, и чуть вниз
      wpos(S.fore, _pole);
      _ax.copy(S.faL).applyQuaternion(_qT);                       // предплечье при прямом запястье
      _v4.copy(_wrist).addScaledVector(_ax, -S.lb);
      _pole.lerp(_v4, P.align); _pole.y -= P.poleDown;
      ik2(S, _wrist, _pole);
      // скрутка: часть — предплечью (вокруг своей оси, запястье не сдвигается)
      wquat(S.fore, _qF);
      _qRel.copy(_qF).invert().multiply(_qT);                        // кисть в осях предплечья
      _qA.copy(_qRel).multiply(_q1.copy(S.q0h).invert());            // отклонение от покоя
      // скрутка вокруг оси предплечья (swing-twist)
      const ax = S.axF;
      let dt = _qA.x * ax.x + _qA.y * ax.y + _qA.z * ax.z;
      _qTw.set(ax.x * dt, ax.y * dt, ax.z * dt, _qA.w);
      if (_qTw.lengthSq() < 1e-12) _qTw.identity(); else _qTw.normalize();
      let tw = 2 * Math.atan2(Math.sqrt(_qTw.x * _qTw.x + _qTw.y * _qTw.y + _qTw.z * _qTw.z), _qTw.w);
      if (_qTw.x * ax.x + _qTw.y * ax.y + _qTw.z * ax.z < 0) tw = -tw;
      if (tw > Math.PI) tw -= 2 * Math.PI; else if (tw < -Math.PI) tw += 2 * Math.PI;
      let roll = tw * P.foreTwist;
      const tmax = P.twistMax * DEG;
      if (tw - roll > tmax) roll = tw - tmax; else if (tw - roll < -tmax) roll = tw + tmax;
      if (roll) {
        _q1.setFromAxisAngle(ax, roll);
        S.fore.quaternion.multiply(_q1);
        S.fore.updateMatrixWorld(true);
        wquat(S.fore, _qF);
        _qRel.copy(_qF).invert().multiply(_qT);
      }
      // изгиб запястья: направление предплечья «по кисти» против оси предплечья
      _v1.copy(S.faL).applyQuaternion(_qRel);
      const bend = Math.acos(clamp(_v1.dot(ax), -1, 1));
      const bmax = P.bendMax * DEG;
      if (bend > bmax) {
        _v2.crossVectors(_v1, ax);
        if (_v2.lengthSq() > 1e-12) { _v2.normalize(); _q1.setFromAxisAngle(_v2, bend - bmax); _qRel.premultiply(_q1); }
      }
      S.hand.quaternion.copy(_qRel);
      S.hand.updateMatrixWorld(true);
      _qT.copy(_qF).multiply(_qRel);                                  // что получилось — для следующего прохода
      S.dbg.bend = Math.min(bend, bmax) / DEG; S.dbg.twist = (tw - roll) / DEG; S.dbg.roll = roll / DEG; S.dbg.rawBend = bend / DEG;
    }
  }

  /* ---------- Пальцы ---------- */
  function curlFingers(S, ph, k) {
    for (const f of FINGERS) {
      const ch = S.fing[f], rest = S.rest[f], ax = S.axes[f];
      if (!ch.length) continue;
      const c = f === 'thumb' ? ph.thumb : ph.curl[f];
      for (let i = 0; i < ch.length; i++) {
        const deg = (f === 'thumb' ? c[i + 1] : c[i]) || 0;
        _q1.setFromAxisAngle(ax[i], deg * k * DEG);
        ch[i].quaternion.copy(_q1).multiply(rest[i]);
        if (f === 'thumb' && i === 0 && S.spread && c[0]) { _q2.setFromAxisAngle(S.spread, (S.side === 'Right' ? 1 : -1) * c[0] * k * DEG); ch[0].quaternion.premultiply(_q2); }
      }
      ch[0].updateMatrixWorld(true);
    }
  }
  function curlRelax(S) { curlFingers(S, P.relax, 1); }

  /* ---------- Оружие: ключ из DW.M3 по длине (для поправок P.wpn) ---------- */
  function wkey(W) {
    if (W._gk !== undefined) return W._gk;
    W._gk = '';
    const ws = DW.M3 && DW.M3.weapons;
    if (ws) for (const k in ws) if (Math.abs(ws[k].len - W.len) < 1e-6 && !!ws[k].free === !!W.free) { W._gk = k; break; }
    return W._gk;
  }

  /* ---------- Досягаемость: если не дотянуться — ладонь вдоль ствола к прикладу ---------- */
  function reachClamp(S, palmT, qHand) {
    _v4.copy(S.palmL).multiplyScalar(S.s).applyQuaternion(qHand);
    wpos(S.arm, _pa);
    _v1.copy(palmT).sub(_v4).sub(_pa);                             // плечо → запястье
    const R = (S.la + S.lb) * P.reach;
    const c2 = _v1.lengthSq();
    S.dbg.slide = 0;
    if (c2 <= R * R) return;
    const b = _v1.dot(_zW), disc = b * b - (c2 - R * R);
    let t;
    if (disc < 0) t = -b;
    else { const t1 = -b - Math.sqrt(disc), t2 = -b + Math.sqrt(disc); t = Math.abs(t1) < Math.abs(t2) ? t1 : t2; }
    palmT.addScaledVector(_zW, t);
    S.dbg.slide = t;
  }
  /* ладонь: центр рукояти/цевья (в осях оружия: y, z) → против нормали ладони на depth, вдоль оси кисти на fwd,
     к большому пальцу на up (× размер кисти), плюс off; всё в мир по M */
  function palmAt(S, ph, cy, cz, out) {
    const k = S.hs, o = ph.off;
    const x = -S.Nw.x * ph.depth * k + S.Fw.x * ph.fwd * k + S.Tw.x * ph.up * k + o[0];
    const y = cy - S.Nw.y * ph.depth * k + S.Fw.y * ph.fwd * k + S.Tw.y * ph.up * k + o[1];
    const z = cz - S.Nw.z * ph.depth * k + S.Fw.z * ph.fwd * k + S.Tw.z * ph.up * k + o[2];
    return out.copy(_org).addScaledVector(_xW, x).addScaledVector(_yW, y).addScaledVector(_zW, z);
  }

  /* ---------- Оружие: ключ из DW.M3 по длине (для P.wpn) ---------- */
  function wkey(W) {
    if (W._gk !== undefined) return W._gk;
    W._gk = '';
    const ws = DW.M3 && DW.M3.weapons;
    if (ws) for (const k in ws) if (Math.abs(ws[k].len - W.len) < 1e-6 && !!ws[k].free === !!W.free) { W._gk = k; break; }
    return W._gk;
  }

  const NOW = { g: [0, 0], f: [0, 0] };
  function apply(o) {
    const body = o.body;
    if (!body || !body.B) return;
    const G = rig(body);
    if (!G || !G.R) return;
    const R = G.R, L = G.L;
    // калибровка «в кисти» (units.js calibrate): только пальцы — смещение ствола от кисти меряется по позе движения,
    // чтобы в движениях «в кисти» (гибель, рукопашная, перелезание) ствол шёл за кистью как раньше
    if (o.calib) { curlFingers(R, P.R, 1); if (L) curlFingers(L, P.L, 1); return; }
    if (!o.M) return;
    const M = o.M;
    _xW.setFromMatrixColumn(M, 0).normalize(); _yW.setFromMatrixColumn(M, 1).normalize(); _zW.setFromMatrixColumn(M, 2).normalize();
    _org.setFromMatrixPosition(M);
    _m1.makeBasis(_xW, _yW, _zW); _qM.setFromRotationMatrix(_m1);
    const W = o.W, wk = W ? wkey(W) : '', wp = (wk && P.wpn[wk]) || NOW;
    const ver = R3.grip.ver;

    // правая — на пистолетной рукояти
    if (R.ver !== ver || R.style !== wk) { handInWeapon(R, 'pistol', P.R, wp.rk); R.ver = ver; R.style = wk; }
    _qB.copy(_qM).multiply(R.qHw);
    if (P.weaponPts || !o.grip) palmAt(R, P.R, wp.g[0], wp.g[1], _palmT);
    else { palmAt(R, P.R, 0, 0, _palmT); _palmT.sub(_org).add(o.grip); }
    reachClamp(R, _palmT, _qB);
    solveHand(R, _qB, _palmT, 2);
    curlFingers(R, P.R, 1);

    // левая — под цевьём; при свободной кисти — пальцы полусогнуты, поворот как в движении
    if (!L) return;
    if (o.freeL) { curlRelax(L); return; }
    if (L.ver !== ver || L.style !== wk) { handInWeapon(L, 'guard', P.L); L.ver = ver; L.style = wk; }
    _qC.copy(_qM).multiply(L.qHw);
    if (P.weaponPts && W && W.fore) palmAt(L, P.L, W.fore.y + wp.f[0], W.fore.z + wp.f[1], _palmT);
    else if (o.fore) { palmAt(L, P.L, 0, 0, _palmT); _palmT.sub(_org).add(o.fore); }
    else return;
    if (o.reload) {
      // кисть идёт по пути перезарядки (o.fore); у цевья — хват цевья, дальше — прямое запястье (как в покое)
      const dist = o.fore ? o.fore.distanceTo(_palmT) : 0;
      const k = clamp((0.14 - dist) / 0.1, 0, 1), ks = k * k * (3 - 2 * k);
      wquat(L.fore, _q3).multiply(L.q0h);
      _qC.slerp(_q3, 1 - ks);
      _palmT.lerp(o.fore, 1 - ks);
      solveHand(L, _qC, _palmT, 2);
      curlFingers(L, ks > 0.5 ? P.L : P.relax, 1);
      return;
    }
    reachClamp(L, _palmT, _qC);
    solveHand(L, _qC, _palmT, 2);
    curlFingers(L, P.L, 1);
  }

  R3.grip = { apply: apply, P: P, ver: 0, rig: rig, wkey: wkey,
    /* сброс кэша (стенд: после смены параметров) */
    touch: function () { R3.grip.ver++; } };
})(window.DW);
