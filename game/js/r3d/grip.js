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
    L: { fan: 40, tilt: 20, rot: [0, 0, 0], depth: 0.03, fwd: -0.01, up: 0, off: [0, 0, 0],
      curl: { index: [35, 55, 30], mid: [40, 60, 30], ring: [45, 60, 30], pinky: [50, 60, 30] }, thumb: [10, 10, 10, 10] },
    // свободная кисть (перезарядка): пальцы полусогнуты
    relax: { curl: { index: [15, 25, 10], mid: [20, 30, 15], ring: [25, 35, 15], pinky: [30, 35, 15] }, thumb: [10, 10, 10, 5] },
    foreTwist: 0.35,     // доля скрутки кисти, которую берёт предплечье (больше — мнётся локоть)
    twistMax: 80,        // скрутка в запястье, не больше, °
    bendMax: 35,         // изгиб запястья относительно предплечья, не больше, °
    rollMax: 40,         // кисть может провернуться вокруг рукояти/цевья, чтобы не ломать запястье, °
    devMax: 15,          // и отклониться вокруг нормали ладони (рукоять ляжет в ладонь наискось), °
    kTwist: 0.3,         // локоть: цена скрутки запястья против изгиба
    kElbow: 0.15,        // локоть: цена ухода от локтя движения (рад²)
    kUp: 4,              // локоть: цена подъёма выше плеча
    elbowUp: -0.1,       // локоть: выше этого (доля плеча над плечевым суставом) — штраф
    poleDown: 0.05,      // локоть движения: чуть ниже, м
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
    // покой (body.rest из makeBody): повороты кисти и предплечья относительно родителя
    const rs = body.rest || {}, rA = rs[side + 'Arm'], rF = rs[side + 'ForeArm'], rH = rs[side + 'Hand'];
    S.q0h = (rH ? rH.q : hand.quaternion).clone();
    S.q0f = (rF ? rF.q : fore.quaternion).clone();
    // направление предплечья (локоть → запястье) в осях кисти при покое (запястье прямое)
    S.axF = hand.position.clone().normalize();                                   // ось предплечья в его кости
    S.faL = S.axF.clone().applyQuaternion(_q1.copy(S.q0h).invert());             // она же в осях кисти при покое
    // локоть — шарнир: ось сгиба в кости плеча. В позе покоя (тело лицом к +Z) сгиб ведёт предплечье вперёд:
    // ось = (плечо → локоть) × вперёд
    S.dU = fore.position.clone().normalize();
    S.hL = new THREE.Vector3(0, 0, 1);
    if (rA && rF) {
      const u0 = rF.wp.clone().sub(rA.wp).normalize();
      const h = new THREE.Vector3().crossVectors(u0, new THREE.Vector3(0, 0, 1));
      if (h.lengthSq() < 1e-6) h.set(0, side === 'Right' ? 1 : -1, 0);
      S.hL.copy(h.normalize()).applyQuaternion(_q1.copy(rA.wq).invert());
    }
    S.hL.addScaledVector(S.dU, -S.hL.dot(S.dU)).normalize();
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
    S.dbg = { bend: 0, rawBend: 0, twist: 0, roll: 0, slide: 0, rollG: 0, devN: 0, swivel: 0 };
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
      // пальцы вправо и вперёд (fan°), ладонь вверх и чуть вправо, к оружию (tilt°)
      const a = (ph.fan || 0) * DEG, tl = (ph.tilt || 0) * DEG;
      _F0.set(Math.cos(a), 0, -Math.sin(a)); _N0.set(Math.sin(tl), Math.cos(tl), 0);
      _N0.addScaledVector(_F0, -_N0.dot(_F0)).normalize();
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

  /* ---------- Двухзвенная IK с шарниром в локте, без выделения памяти ----------
     локоть — по полюсу на окружности; плечо поворачивается так, чтобы его ось сгиба (S.hL) легла поперёк
     плоскости руки, предплечье — от своего покоя относительно плеча сгибается вокруг этой оси: в локте нет
     скрутки (иначе кожа локтя рвётся), вся скрутка кисти — в запястье (и долей — в предплечье). */
  const _u = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3();
  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _t4 = new THREE.Vector3();
  const _m3 = new THREE.Matrix4(), _m4 = new THREE.Matrix4(), _qU = new THREE.Quaternion();
  /* поворот, переводящий aL → aW и bL → bW (b — после ортогонализации) */
  function fromAxes(aL, bL, aW, bW, out) {
    _t1.copy(bL).addScaledVector(aL, -bL.dot(aL)).normalize(); _t2.crossVectors(aL, _t1);
    _m3.makeBasis(aL, _t1, _t2).transpose();
    _t3.copy(bW).addScaledVector(aW, -bW.dot(aW)).normalize(); _t4.crossVectors(aW, _t3);
    _m4.makeBasis(aW, _t3, _t4).multiply(_m3);
    return out.setFromRotationMatrix(_m4);
  }
  function ik2(S, target, pole) {
    wpos(S.arm, _pa);
    const la = S.la, lb = S.lb;
    const d = Math.max(1e-4, Math.min(target.distanceTo(_pa), la + lb - 1e-4));
    _dir.copy(target).sub(_pa).normalize();
    const ang = Math.acos(clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1));
    _pl.copy(pole).sub(_pa); _pl.addScaledVector(_dir, -_pl.dot(_dir));
    if (_pl.lengthSq() < 1e-10) _pl.set(0, -1, 0).addScaledVector(_dir, _dir.y);
    _pl.normalize();
    _el.copy(_pa).addScaledVector(_dir, Math.cos(ang) * la).addScaledVector(_pl, Math.sin(ang) * la);
    _u.copy(_el).sub(_pa).normalize();
    _v3.copy(_pa).addScaledVector(_dir, d);
    _f.copy(_v3).sub(_el).normalize();
    _n.crossVectors(_u, _f);
    if (_n.lengthSq() < 1e-6) _n.crossVectors(_u, _pl);
    _n.normalize();
    // плечо: направление к локтю и ось сгиба поперёк плоскости руки
    fromAxes(S.dU, S.hL, _u, _n, _qU);
    wquat(S.arm.parent, _q2).invert();
    S.arm.quaternion.copy(_q2).multiply(_qU);
    // предплечье: покой относительно плеча, затем доворот к запястью (вокруг оси сгиба)
    _q2.copy(_qU).multiply(S.q0f);
    _v1.copy(S.axF).applyQuaternion(_q2);
    _q3.setFromUnitVectors(_v1, _f);
    _q2.premultiply(_q3);
    S.fore.quaternion.copy(_qU.invert()).multiply(_q2);
    S.arm.updateMatrixWorld(true);
  }

  /* ---------- Кисть: поворот qT (мир), ладонь в palmT ---------- */
  const _q0a = new THREE.Quaternion(), _q0f = new THREE.Quaternion();
  /* ---------- Где быть локтю: перебор по окружности возможных локтей ----------
     цена = изгиб запястья² + P.kTwist·скрутка² + P.kElbow·(уход от локтя движения)² + P.kUp·(локоть выше плеча)²;
     16 проб и 4 уточнения, только арифметика (без обновления костей). Возвращает точку-полюс для ik2. */
  const _cP = new THREE.Vector3(), _cD = new THREE.Vector3(), _cE1 = new THREE.Vector3(), _cE2 = new THREE.Vector3(), _cW = new THREE.Vector3();
  const _cE = new THREE.Vector3(), _cU = new THREE.Vector3(), _cF = new THREE.Vector3(), _cN = new THREE.Vector3(), _cV = new THREE.Vector3();
  const _cQu = new THREE.Quaternion(), _cQf = new THREE.Quaternion(), _cQ = new THREE.Quaternion(), _cQi = new THREE.Quaternion();
  let _cR = 0, _cC = 0, _cY = 0;
  function elbowCost(S, qT, phi) {
    const c = Math.cos(phi), sn = Math.sin(phi);
    _cE.copy(_cP).addScaledVector(_cD, _cC).addScaledVector(_cE1, c * _cR).addScaledVector(_cE2, sn * _cR);
    _cU.copy(_cE).sub(_cP).normalize();
    _cF.copy(_cW).sub(_cE).normalize();
    _cN.crossVectors(_cU, _cF);
    if (_cN.lengthSq() < 1e-8) { _cV.copy(_cE1).multiplyScalar(c).addScaledVector(_cE2, sn); _cN.crossVectors(_cU, _cV); }
    _cN.normalize();
    fromAxes(S.dU, S.hL, _cU, _cN, _cQu);
    _cQf.copy(_cQu).multiply(S.q0f);
    _cV.copy(S.axF).applyQuaternion(_cQf);
    _cQ.setFromUnitVectors(_cV, _cF);
    _cQf.premultiply(_cQ);
    _cQ.copy(_cQf).invert().multiply(qT);                            // кисть в осях предплечья
    _cV.copy(S.faL).applyQuaternion(_cQ);
    const bend = Math.acos(clamp(_cV.dot(S.axF), -1, 1));
    _cQ.multiply(_cQi);                                              // отклонение от покоя
    const ax = S.axF, dt = _cQ.x * ax.x + _cQ.y * ax.y + _cQ.z * ax.z;
    const tw = 2 * Math.atan2(Math.abs(dt), Math.abs(_cQ.w));
    const up = Math.max(0, (_cE.y - _cY) / S.la - P.elbowUp);
    return bend * bend + P.kTwist * tw * tw + P.kElbow * phi * phi + P.kUp * up * up;
  }
  function bestPole(S, wrist, qT, pole) {
    wpos(S.arm, _cP); _cY = _cP.y;
    const la = S.la, lb = S.lb;
    const d = Math.max(1e-4, Math.min(wrist.distanceTo(_cP), la + lb - 1e-4));
    _cD.copy(wrist).sub(_cP).normalize();
    const ang = Math.acos(clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1));
    _cC = Math.cos(ang) * la; _cR = Math.sin(ang) * la;
    _cW.copy(_cP).addScaledVector(_cD, d);
    _cE1.copy(pole).sub(_cP); _cE1.addScaledVector(_cD, -_cE1.dot(_cD));
    if (_cE1.lengthSq() < 1e-10) _cE1.set(0, -1, 0).addScaledVector(_cD, _cD.y);
    _cE1.normalize(); _cE2.crossVectors(_cD, _cE1);
    _cQi.copy(S.q0h).invert();
    let best = 0, bc = elbowCost(S, qT, 0);
    for (let k = 1; k < 16; k++) { const ph = -Math.PI + k * Math.PI / 8, c = elbowCost(S, qT, ph); if (c < bc) { bc = c; best = ph; } }
    for (let st = Math.PI / 16; st > Math.PI / 200; st *= 0.5) {
      const c1 = elbowCost(S, qT, best - st), c2 = elbowCost(S, qT, best + st);
      if (c1 < bc && c1 <= c2) { bc = c1; best -= st; } else if (c2 < bc) { bc = c2; best += st; }
    }
    S.dbg.swivel = best / DEG;
    pole.copy(_cP).addScaledVector(_cD, _cC).addScaledVector(_cE1, Math.cos(best) * _cR).addScaledVector(_cE2, Math.sin(best) * _cR);
  }

  /* axP/axD — ось того, что держит кисть (рукоять, цевьё): если запястье гнётся сильнее P.bendMax, кисть сперва
     проворачивается вокруг этой оси (пальцы так и остаются на ней, до P.rollMax) и чуть отклоняется вокруг нормали
     ладони (до P.devMax), остаток — ограничение изгиба. */
  const _pT = new THREE.Vector3(), _aW = new THREE.Vector3(), _nW = new THREE.Vector3();
  function solveHand(S, qWant, palmT, axP, axD, iters) {
    _q0a.copy(S.arm.quaternion); _q0f.copy(S.fore.quaternion);
    _qT.copy(qWant); _pT.copy(palmT);
    const bmax = P.bendMax * DEG, rmax = P.rollMax * DEG, dmax = P.devMax * DEG;
    let accG = 0, accN = 0;
    for (let it = 0; it < iters; it++) {
      // каждый проход — от позы, оставленной units.js (иначе скрутка предплечья накапливалась бы)
      S.arm.quaternion.copy(_q0a); S.fore.quaternion.copy(_q0f); S.arm.updateMatrixWorld(true);
      // запястье: ладонь в _pT при повороте _qT
      _v4.copy(S.palmL).multiplyScalar(S.s).applyQuaternion(_qT);
      _wrist.copy(_pT).sub(_v4);
      // локоть: от локтя движения (после units.js) — лучший по цене (прямое запястье, умеренная скрутка)
      wpos(S.fore, _pole); _pole.y -= P.poleDown;
      bestPole(S, _wrist, _qT, _pole);
      ik2(S, _wrist, _pole);
      // скрутка: часть — предплечью (вокруг своей оси, запястье не сдвигается)
      wquat(S.fore, _qF);
      _qRel.copy(_qF).invert().multiply(_qT);                        // кисть в осях предплечья
      _qA.copy(_qRel).multiply(_q1.copy(S.q0h).invert());            // отклонение от покоя
      // скрутка вокруг оси предплечья (swing-twist)
      const ax = S.axF;
      const dt = _qA.x * ax.x + _qA.y * ax.y + _qA.z * ax.z;
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
      S.dbg.rawBend = bend / DEG;
      if (R3.grip.trace) R3.grip.trace.push(S.side[0] + it + ' bend ' + (bend / DEG).toFixed(1) + ' tw ' + (tw / DEG).toFixed(0) + ' sw ' + S.dbg.swivel.toFixed(0) + ' g ' + (accG / DEG).toFixed(1) + ' n ' + (accN / DEG).toFixed(1));
      if (bend > bmax && axD && it < iters - 1) {
        // поправка цели: поворот, сводящий «предплечье по кисти» к настоящему, раскладывается на ось хвата и нормаль ладони
        _v2.copy(S.faL).applyQuaternion(_qT); _aW.copy(ax).applyQuaternion(_qF);
        _v3.crossVectors(_v2, _aW);
        if (_v3.lengthSq() > 1e-10) {
          _v3.normalize();
          const th = bend - bmax;
          const g1 = clamp(accG + th * _v3.dot(axD), -rmax, rmax), dg = g1 - accG; accG = g1;
          _nW.copy(S.N).applyQuaternion(_qT);
          const n1 = clamp(accN + th * _v3.dot(_nW), -dmax, dmax), dn = n1 - accN; accN = n1;
          _q1.setFromAxisAngle(axD, dg);
          _qT.premultiply(_q1);
          _pT.sub(axP).applyQuaternion(_q1).add(axP);
          _q1.setFromAxisAngle(_nW, dn);
          _qT.premultiply(_q1);
          continue;
        }
      }
      if (bend > bmax) {
        _v2.crossVectors(_v1, ax);
        if (_v2.lengthSq() > 1e-12) { _v2.normalize(); _q1.setFromAxisAngle(_v2, bend - bmax); _qRel.premultiply(_q1); }
      }
      S.hand.quaternion.copy(_qRel);
      S.hand.updateMatrixWorld(true);
      _qT.copy(_qF).multiply(_qRel);                                  // что получилось — для следующего прохода
      S.dbg.bend = Math.min(bend, bmax) / DEG; S.dbg.twist = (tw - roll) / DEG; S.dbg.roll = roll / DEG;
      S.dbg.rollG = accG / DEG; S.dbg.devN = accN / DEG;
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
  const _gP = new THREE.Vector3(), _gD = new THREE.Vector3();
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
    // ось рукояти: вверх с наклоном rk назад-вниз; точка — центр рукояти (со сдвигом досягаемости)
    const rk = (wp.rk !== undefined ? wp.rk : P.R.rake) * DEG;
    _gD.set(0, Math.cos(rk), -Math.sin(rk)).applyQuaternion(_qM);
    _gP.copy(_org).addScaledVector(_yW, wp.g[0]).addScaledVector(_zW, wp.g[1] + R.dbg.slide);
    solveHand(R, _qB, _palmT, _gP, _gD, 3);
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
      solveHand(L, _qC, _palmT, null, null, 2);
      curlFingers(L, ks > 0.5 ? P.L : P.relax, 1);
      return;
    }
    reachClamp(L, _palmT, _qC);
    // ось цевья — ствол
    _gP.copy(_org).addScaledVector(_yW, (W && W.fore ? W.fore.y : 0) + wp.f[0]).addScaledVector(_zW, (W && W.fore ? W.fore.z : 0) + wp.f[1]);
    solveHand(L, _qC, _palmT, _gP, _zW, 3);
    curlFingers(L, P.L, 1);
  }

  R3.grip = { apply: apply, P: P, ver: 0, rig: rig, wkey: wkey,
    /* сброс кэша (стенд: после смены параметров) */
    touch: function () { R3.grip.ver++; } };
})(window.DW);
