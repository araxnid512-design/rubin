'use strict';
/* 3D-бой: хват оружия кистями — поворот кистей (правая ладонь обхватывает рукоять, левая поддерживает цевьё
   снизу) и сгиб пальцев. Вызывается из units.js после того, как руки дотянулись до оружия (IK).
   R3.grip.apply(o): o = { body (тело: B — кости, holder), W (оружие: g, fore, muzzle), M (матрица оружия в мире),
   mode (aim/carry/hip), grip, fore (точки в мире), key (движение), freeL, reload, calib, foreSlide (помпа: левая
   кисть назад по цевью, м) }.

   Как устроено:
   • поворот кисти задаётся в осях оружия (M): ось кисти F (запястье → основание среднего пальца), нормаль ладони N;
     оси самой кисти в её кости (F, N, сторона большого пальца) считаются один раз по положению костей пальцев —
     поэтому работает на любой модели (Tripo R_Hand/R_Index1…, Mixamo mixamorigRightHandIndex1…);
   • на ось рукояти / цевья ставится ЦЕНТР КУЛАКА — центр окружности через суставы согнутого среднего пальца (у моделей
     Tripo ладонь длинная, пальцы короткие: ≈ 0,85–0,9 длины кисти) — рукоять проходит сквозь кулак;
   • левая: под цевьём ладонью вверх-внутрь; если цевьё не достать (руки у моделей короткие) — сперва ключица вперёд
     (в пределах), затем хват магазина (ладонь на левой стенке магазина, пальцы вокруг передней на правую);
   • рука решается двухзвенной IK с шарниром в локте (в локте нет скрутки — кожа не рвётся); где быть локтю — перебор
     по окружности возможных локтей с анатомической ценой: запястье (сгиб/разгиб, лучевое/локтевое отклонение),
     про/супинация от «большой палец вверх», скрутка плеча от покоя, локоть не за срединную линию, не за спину, не в
     корпус, не выше плеча, у опорной руки — ниже оружия; недалеко от локтя движения;
   • если запястье всё равно гнётся сильнее P.bendMax — кисть проворачивается вокруг рукояти/цевья (пальцы остаются
     на них) и чуть отклоняется вокруг нормали ладони, остаток изгиба ограничивается и кисть заново ставится на место;
     скрутку от покоя делят предплечье и кисть (каждая ≤ P.twistMax);
   • ключица: подъём и вынос вперёд не больше P.clavElev / P.clavProt;
   • пальцы гнутся только к ладони (ось «направление пальца × нормаль ладони»), правый указательный — у спуска.
   • калибровка «в кисти» (o.calib) — только пальцы: смещение ствола от кисти меряется по позе движения, как раньше.
   • R3.grip.check / R3.grip.joints — проверки хвата и суставов (стенд и тесты; пределы — R3.grip.LIM).
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
     wpn: g — центр пистолетной рукояти [y, z, x] от начала оружия, f — ось цевья [y, z, x] от W.fore (x — если
     модель не по центру), rk — наклон рукояти (вместо R.rake), м/°. */
  const P = {
    R: { rake: 18, rot: [0, 0, 0], depth: 0, fwd: 0, up: 0, off: [0, 0, 0],
      curl: { index: [30, 50, 25], mid: [80, 95, 55], ring: [85, 95, 55], pinky: [90, 95, 55] }, thumb: [30, 20, 25, 20] },
    L: { fan: 40, tilt: 45, rot: [0, 0, 0], depth: 0, fwd: 0, up: 0, off: [0, 0, 0],
      curl: { index: [35, 55, 30], mid: [40, 60, 30], ring: [45, 60, 30], pinky: [50, 60, 30] }, thumb: [15, 15, 20, 15] },
    // свободная кисть (перезарядка): пальцы полусогнуты
    relax: { curl: { index: [15, 25, 10], mid: [20, 30, 15], ring: [25, 35, 15], pinky: [30, 35, 15] }, thumb: [10, 10, 10, 5] },
    foreTwist: 0.5,      // доля скрутки кисти (от покоя), которую берёт предплечье
    twistMax: 45,        // скрутка на одну кость (предплечье, кисть), не больше, °
    bendMax: 28,         // изгиб запястья относительно предплечья, не больше, ° (анатомия: сгиб ≤ 50, к большому ≤ 20, к мизинцу ≤ 30)
    rollMax: 22,         // кисть может провернуться вокруг рукояти/цевья, чтобы не ломать запястье, °
    devMax: 15,          // и отклониться вокруг нормали ладони (рукоять ляжет в ладонь наискось), °
    kTwist: 0.6,         // локоть: цена скрутки кисти от покоя (в долях 80°)
    kPron: 0.6,          // локоть: цена про/супинации от «большой палец вверх» (в долях 70°)
    kShTw: 0.5,          // локоть: цена скрутки плеча от покоя (в долях 60°)
    kMid: 6, kBack: 4, kBody: 8, kLow: 3, kIn: 6,   // локоть: за срединную линию, за спину, в корпус, опорный — выше оружия, внутрь
    kElbow: 0.15,        // локоть: цена ухода от локтя движения (рад²)
    kUp: 4,              // локоть: цена подъёма выше плеча
    elbowUp: -0.1,       // локоть: выше этого (доля плеча над плечевым суставом) — штраф
    poleDown: 0.05,      // локоть движения: чуть ниже, м
    reach: 0.97,         // доля длины руки (правая), дальше — кисть сдвигается по стволу к прикладу
    clavElev: 14, clavProt: 18,   // ключица: подъём и вынос вперёд от покоя, не больше, °
    reachL: 0.97,        // то же для левой (руки у моделей короткие: опорная почти прямая, сгиб локтя ≈ 25°)
    weaponPts: 1,        // 1 — ладони на рукоять/цевьё настоящего оружия, 0 — в точки из units.js (o.grip/o.fore)
    wpn: {
      // m — хват магазина левой, если цевьё не достать: [y, z центра кулака на магазине, наклон кисти °, z передней
      // стенки магазина вверху] от начала оружия
      ak: { g: [-0.035, 0.06], f: [0.015, -0.06], m: [-0.07, -0.095, 8, -0.125] },
      ak2: { g: [-0.05, 0.07], f: [0.03, -0.04], m: [-0.08, -0.105, 8, -0.13] },
      // ППШ-41 (w_ppsh41_fix): без пистолетной рукояти — правая на шейке приклада за спуском (пальцы снизу,
      // указательный к спуску), левая — под деревом ложи над задним краем диска; модель сдвинута на 1,8 см влево
      ppsh: { g: [-0.005, 0.09, -0.018], f: [0.008, 0.064, -0.018] },
      shotgun: { g: [-0.06, 0.035], f: [0.01, -0.03], rk: 25 },
      sniper: { g: [-0.085, 0.125], f: [-0.012, 0.06], m: [-0.12, -0.1, 15, -0.15], rk: 28 },
      lmg: { g: [-0.025, 0.095], f: [0.03, -0.01], m: [-0.09, -0.11, 8, -0.14] },
      hsniper: { g: [-0.1, 0.24], f: [-0.03, 0] },
      hlmg: { g: [-0.04, 0.055], f: [0, 0] },
      rpg: { g: [-0.035, -0.17], f: [0, -0.05] }
    }
  };
  const HAND0 = 0.09;    // длина кисти (запястье → основание среднего пальца), под которую заданы depth/fwd/up

  /* ---------- Временные объекты (без выделения памяти в кадре) ---------- */
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
  const _pa = new THREE.Vector3();
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
    S.F = F; S.N = N; S.Tth = T.clone();      // Tth — к большому пальцу
    // базис кисти (столбцы F, N, F×N) → для перевода «оси кисти» в «оси оружия»
    S.Hl = new THREE.Matrix4().makeBasis(F, N, T2);
    // ладонь в кости кисти (как palm() в units.js: 0,75 пути до основания среднего пальца)
    S.palmL = mid ? mid.position.clone().multiplyScalar(0.75) : F.clone().multiplyScalar(0.3 * hand.position.length());
    S.hl = mid ? mid.position.length() : 0.3 * hand.position.length();      // кисть: запястье → основание среднего (ед. кости)
    S.hold = S.palmL.clone(); S.holdR = 0; S.holdK = '';                    // центр кулака (см. fistCentre)
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
    // ось сгиба локтя в кости предплечья (при шарнире она в мире = нормаль плоскости руки) — для оценки скрутки
    S.hF = S.hL.clone().applyQuaternion(_q1.copy(S.q0f).invert());
    S.hF.addScaledVector(S.axF, -S.hF.dot(S.axF)).normalize();
    // базис плеча в покое (к локтю, ось сгиба) — обратный поворот для armQuat
    S.qLi = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(S.dU, S.hL, new THREE.Vector3().crossVectors(S.dU, S.hL))).invert();
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
    S.qHw = new THREE.Quaternion(); S.qHm = new THREE.Quaternion(); S.ver = -1; S.style = '';
    S.Fw = new THREE.Vector3(); S.Nw = new THREE.Vector3(); S.Tw = new THREE.Vector3();
    S.hs = (mid ? mid.position.length() * S.s : HAND0) / HAND0;      // размер кисти против эталона
    S.dbg = { bend: 0, rawBend: 0, twist: 0, roll: 0, slide: 0, rollG: 0, devN: 0, swivel: 0 };
    S.sw = 0; S.axP = new THREE.Vector3(); S.axD = new THREE.Vector3(); S.mode = ''; S.support = false;
    // запястье в покое: сгиб/отклонение «предплечья по кисти» (от них считаются углы запястья)
    S.flex0 = Math.atan2(-S.faL.dot(N), S.faL.dot(F)); S.dev0 = Math.atan2(-S.faL.dot(T), S.faL.dot(F));
    // плечо и ось локтя в покое (мир при создании тела) — для скрутки плеча от покоя
    S.u0r = new THREE.Vector3(); S.h0r = new THREE.Vector3(); S.u0w = new THREE.Vector3(); S.h0w = new THREE.Vector3();
    if (rA && rF) { S.u0r.copy(rF.wp).sub(rA.wp).normalize(); S.h0r.copy(S.hL).applyQuaternion(rA.wq); }
    // ключица и её направление в покое (к плечевому суставу)
    S.clav = B[side + 'Shoulder'] || null; S.c0r = new THREE.Vector3(); S.c0w = new THREE.Vector3();
    const rC = rs[side + 'Shoulder'];
    if (S.clav && rC && rA) S.c0r.copy(rA.wp).sub(rC.wp).normalize(); else S.clav = null;
    return S;
  }
  function rig(body) {
    if (body._grip !== undefined) return body._grip;
    body._grip = (body.B && body.B.RightHand) ? { R: sideRig(body, 'Right'), L: sideRig(body, 'Left'), qT0i: new THREE.Quaternion() } : null;
    // корпус в покое (оси как в torsoNow)
    const rs = body.rest, G = body._grip;
    if (G && rs && rs.RightArm && rs.LeftArm && rs.Hips && (rs.Neck || rs.Head)) {
      const X = rs.RightArm.wp.clone().sub(rs.LeftArm.wp).normalize(), Y = (rs.Neck || rs.Head).wp.clone().sub(rs.Hips.wp);
      Y.addScaledVector(X, -Y.dot(X)).normalize();
      G.qT0i.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, new THREE.Vector3().crossVectors(X, Y))).invert();
    }
    return body._grip;
  }

  /* ---------- Центр кулака: куда должна лечь ось рукояти / цевья ----------
     суставы среднего пальца при заданном сгибе (в осях кисти): основание, ногтевая фаланга, кончик — окружность через
     них; её центр — «дыра» кулака. У моделей Tripo ладонь длинная, пальцы короткие: центр ≈ 0,85–0,9 длины кисти. */
  const _j1 = new THREE.Vector3(), _j2 = new THREE.Vector3(), _j3 = new THREE.Vector3(), _jt = new THREE.Vector3();
  const _jq = new THREE.Quaternion(), _jr = new THREE.Quaternion();
  function fistCentre(S, c) {
    const key = c.join(',');
    if (S.holdK === key) return;
    S.holdK = key;
    const ch = S.fing.mid, rest = S.rest.mid, ax = S.axes.mid;
    if (ch.length < 3) { S.hold.copy(S.palmL); return; }
    _j1.copy(ch[0].position);
    _jq.setFromAxisAngle(ax[0], c[0] * DEG).multiply(rest[0]);
    _j2.copy(_j1).add(_v1.copy(ch[1].position).applyQuaternion(_jq));
    _jq.multiply(_jr.setFromAxisAngle(ax[1], c[1] * DEG).multiply(rest[1]));
    _j3.copy(_j2).add(_v1.copy(ch[2].position).applyQuaternion(_jq));
    _jq.multiply(_jr.setFromAxisAngle(ax[2], c[2] * DEG).multiply(rest[2]));
    _jt.copy(_j3).add(_v1.copy(ch[2].position).multiplyScalar(0.85).applyQuaternion(_jq));
    // центр окружности через _j1, _j3, _jt: c = j1 + (|b|²·(a×b)×a + |a|²·b×(a×b)) / (2|a×b|²), a = j3 − j1, b = jt − j1
    _v1.copy(_j3).sub(_j1); _v2.copy(_jt).sub(_j1); _v3.crossVectors(_v1, _v2);
    const d = 2 * _v3.lengthSq();
    if (d < 1e-14) { S.hold.copy(S.palmL); return; }
    _v4.crossVectors(_v3, _v1).multiplyScalar(_v2.lengthSq());
    _dp.crossVectors(_v2, _v3).multiplyScalar(_v1.lengthSq());
    S.hold.copy(_j1).add(_v4.add(_dp).multiplyScalar(1 / d));
    S.holdR = S.hold.distanceTo(_j1);
  }

  /* ---------- Поза кисти в осях оружия ---------- */
  const _F0 = new THREE.Vector3(), _N0 = new THREE.Vector3(), _T0 = new THREE.Vector3();
  function rotAbout(v, axis, deg) { if (deg) v.applyAxisAngle(axis, deg * DEG); }
  /* style: 'pistol' — ладонь сбоку рукояти (правая — слева от ладони, левая на передней рукояти — справа),
     'guard' — левая под цевьём ладонью вверх, пальцы обхватывают правый бок. Результат: S.qHw — кисть → оружие. */
  function handInWeapon(S, style, ph, rake, outQ) {
    if (style === 'mag') {
      // ладонь назад-вверх к передней стенке магазина, пальцы вправо (вокруг), большой палец слева
      const a = (ph.fan || 0) * DEG, tl = (ph.tilt || 0) * DEG, pt = (ph.pitch || 0) * DEG;
      _F0.set(Math.cos(a), 0, -Math.sin(a)); _N0.set(Math.sin(tl), Math.cos(tl) * Math.cos(pt), Math.cos(tl) * Math.sin(pt));
      _N0.addScaledVector(_F0, -_N0.dot(_F0)).normalize();
    } else if (style === 'guard') {
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
    if (!outQ) { S.Fw.copy(_F0); S.Nw.copy(_N0); S.Tw.copy(_T0); }
    _m1.makeBasis(_F0, _N0, _T0);
    _m2.copy(S.Hl).transpose();
    _m1.multiply(_m2);
    (outQ || S.qHw).setFromRotationMatrix(_m1);
  }

  /* ---------- Двухзвенная IK с шарниром в локте, без выделения памяти ----------
     локоть — по полюсу на окружности; плечо поворачивается так, чтобы его ось сгиба (S.hL) легла поперёк
     плоскости руки, предплечье — от своего покоя относительно плеча сгибается вокруг этой оси: в локте нет
     скрутки (иначе кожа локтя рвётся), вся скрутка кисти — в запястье (и долей — в предплечье). */
  const _u = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3();
  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _t4 = new THREE.Vector3();
  const _m4 = new THREE.Matrix4(), _qU = new THREE.Quaternion();
  /* мировой поворот плеча: к локтю (aW) и ось сгиба (bW, ортогонализуется) — из базиса покоя (S.qLi) */
  function armQuat(S, aW, bW, out) {
    _t3.copy(bW).addScaledVector(aW, -bW.dot(aW)).normalize(); _t4.crossVectors(aW, _t3);
    _m4.makeBasis(aW, _t3, _t4);
    return out.setFromRotationMatrix(_m4).multiply(S.qLi);
  }
  /* решение руки без изменения костей: _qU — мировой поворот плеча, _qFw — предплечья */
  const _qFw = new THREE.Quaternion();
  function ik2(S, sh, target, pole) {
    const la = S.la, lb = S.lb;
    const d = Math.max(1e-4, Math.min(target.distanceTo(sh), la + lb - 1e-4));
    _dir.copy(target).sub(sh).normalize();
    const ang = Math.acos(clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1));
    _pl.copy(pole).sub(sh); _pl.addScaledVector(_dir, -_pl.dot(_dir));
    if (_pl.lengthSq() < 1e-10) _pl.set(0, -1, 0).addScaledVector(_dir, _dir.y);
    _pl.normalize();
    _el.copy(sh).addScaledVector(_dir, Math.cos(ang) * la).addScaledVector(_pl, Math.sin(ang) * la);
    _u.copy(_el).sub(sh).normalize();
    _v3.copy(sh).addScaledVector(_dir, d);
    _f.copy(_v3).sub(_el).normalize();
    _n.crossVectors(_u, _f);
    if (_n.lengthSq() < 1e-6) _n.crossVectors(_u, _pl);
    _n.normalize();
    // плечо: направление к локтю и ось сгиба поперёк плоскости руки
    armQuat(S, _u, _n, _qU);
    // предплечье: покой относительно плеча, затем доворот к запястью (вокруг оси сгиба)
    _qFw.copy(_qU).multiply(S.q0f);
    _v1.copy(S.axF).applyQuaternion(_qFw);
    _q3.setFromUnitVectors(_v1, _f);
    _qFw.premultiply(_q3);
  }

  /* ---------- Кисть: поворот qT (мир), ладонь в palmT ---------- */
  /* ---------- Где быть локтю: перебор по окружности возможных локтей ----------
     цена = изгиб запястья² + P.kTwist·скрутка² + P.kElbow·(уход от локтя движения)² + P.kUp·(локоть выше плеча)²;
     16 проб и 4 уточнения, только арифметика (без обновления костей). Возвращает точку-полюс для ik2. */
  /* скаляры перебора (Float64Array — без упаковки чисел): 0–2 плечо, 3–5 ось плечо→запястье, 6–8 и 9–11 базис
     окружности, 12–14 запястье, 18–20 «ось сгиба по кисти», 21 C, 22 R, 23 la, 24 — цена; 25–33 оси кисти в мире
     (F, N, к большому пальцу), 34–35 сгиб/отклонение запястья в покое, 36–38 к середине тела, 39–41 середина плеч,
     42–50 оси корпуса X, Y, Z, 51 ширина плеч, 53–55 и 56–58 плечо и ось локтя в покое (в нынешних осях корпуса),
     59 — опорная (левая) рука */
  const _k = new Float64Array(64);
  const _cP = new THREE.Vector3(), _cD = new THREE.Vector3(), _cE1 = new THREE.Vector3(), _cE2 = new THREE.Vector3();
  const _cH = new THREE.Vector3(), _cB = new THREE.Vector3(), _cQ = new THREE.Quaternion();
  /* анатомическая цена положения локтя (угол phi на окружности возможных локтей). При шарнире в локте предплечье
     смотрит по f, ось сгиба — нормаль n плоскости руки; всё остальное — из оси плеча u и поворота кисти:
     запястье (сгиб/разгиб, лучевое/локтевое отклонение), скрутка от покоя (на кости), про/супинация от «большой палец
     вверх», скрутка плеча от покоя, локоть не за срединную линию, не за спину, не в корпус, не выше плеча, у опорной
     руки — ниже оружия; плюс близость к локтю движения. Все слагаемые — в долях своих пределов. */
  function elbowCost(phi) {
    const k = _k, c = Math.cos(phi), sn = Math.sin(phi);
    const ox = k[21] * k[3] + c * k[22] * k[6] + sn * k[22] * k[9], oy = k[21] * k[4] + c * k[22] * k[7] + sn * k[22] * k[10], oz = k[21] * k[5] + c * k[22] * k[8] + sn * k[22] * k[11];
    const ex = k[0] + ox, ey = k[1] + oy, ez = k[2] + oz;                 // локоть
    let l = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
    const ux = ox / l, uy = oy / l, uz = oz / l;
    let fx = k[12] - ex, fy = k[13] - ey, fz = k[14] - ez;
    l = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1; fx /= l; fy /= l; fz /= l;
    let nx = uy * fz - uz * fy, ny = uz * fx - ux * fz, nz = ux * fy - uy * fx;
    l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < 1e-4) {
      const vx = c * k[6] + sn * k[9], vy = c * k[7] + sn * k[10], vz = c * k[8] + sn * k[11];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx; l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    }
    nx /= l; ny /= l; nz /= l;
    // запястье: предплечье в осях кисти
    const aF = fx * k[25] + fy * k[26] + fz * k[27], aN = fx * k[28] + fy * k[29] + fz * k[30], aT = fx * k[31] + fy * k[32] + fz * k[33];
    const flex = Math.atan2(-aN, aF) - k[34], dev = Math.atan2(-aT, aF) - k[35];
    const lf = 40 * DEG, ld = (dev > 0 ? 18 : 25) * DEG;
    let cost = (flex / lf) * (flex / lf) + (dev / ld) * (dev / ld);
    // скрутка от покоя (делится между предплечьем и кистью)
    const bf = k[18] * fx + k[19] * fy + k[20] * fz;
    const bx = k[18] - fx * bf, by = k[19] - fy * bf, bz = k[20] - fz * bf;
    const cr = (ny * bz - nz * by) * fx + (nz * bx - nx * bz) * fy + (nx * by - ny * bx) * fz;
    const tw = Math.atan2(cr < 0 ? -cr : cr, nx * bx + ny * by + nz * bz) / (80 * DEG);
    cost += P.kTwist * tw * tw;
    // про/супинация: ладонь против «к середине тела» вокруг f
    const md = k[36] * fx + k[37] * fy + k[38] * fz, mx = k[36] - fx * md, my = k[37] - fy * md, mz = k[38] - fz * md;
    const nd = k[28] * fx + k[29] * fy + k[30] * fz, px = k[28] - fx * nd, py = k[29] - fy * nd, pz = k[30] - fz * nd;
    const pm = Math.sqrt((mx * mx + my * my + mz * mz) * (px * px + py * py + pz * pz)) || 1;
    const pr = Math.acos(clamp((mx * px + my * py + mz * pz) / pm, -1, 1)) / (70 * DEG);
    cost += P.kPron * pr * pr;
    // скрутка плеча: ось локтя покоя после кратчайшего поворота плеча покой → сейчас, против n
    const u0x = k[53], u0y = k[54], u0z = k[55], h0x = k[56], h0y = k[57], h0z = k[58];
    const cc = u0x * ux + u0y * uy + u0z * uz;
    if (cc > -0.95) {
      const kx = u0y * uz - u0z * uy, ky = u0z * ux - u0x * uz, kz = u0x * uy - u0y * ux, kh = (kx * h0x + ky * h0y + kz * h0z) / (1 + cc);
      let hx = h0x * cc + (ky * h0z - kz * h0y) + kx * kh, hy = h0y * cc + (kz * h0x - kx * h0z) + ky * kh, hz = h0z * cc + (kx * h0y - ky * h0x) + kz * kh;
      const hu = hx * ux + hy * uy + hz * uz; hx -= ux * hu; hy -= uy * hu; hz -= uz * hu;
      const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      const st = Math.acos(clamp((hx * nx + hy * ny + hz * nz) / hl, -1, 1)) / (60 * DEG);
      cost += P.kShTw * st * st;
    }
    // локоть относительно корпуса: середина, спина, внутри корпуса
    const w = k[51], sg = k[52];
    const dx = ex - k[39], dy = ey - k[40], dz = ez - k[41];
    const lat = (dx * k[42] + dy * k[43] + dz * k[44]) * sg, lim = 0.12 * w;
    if (lat < lim) { const q = (lim - lat) / (0.1 * w); cost += P.kMid * q * q; }
    const lx = (ux * k[42] + uy * k[43] + uz * k[44]) * sg + 0.3;          // плечо внутрь (локоть поперёк груди)
    if (lx < 0) { const q = lx / 0.3; cost += P.kIn * q * q; }
    const back = Math.asin(clamp(-(ux * k[48] + uy * k[49] + uz * k[50]), -1, 1)) - 10 * DEG;
    if (back > 0) { const q = back / (10 * DEG); cost += P.kBack * q * q; }
    for (let i = 0; i < 2; i++) {                                         // локоть и середина предплечья
      const qx = i ? (ex + k[12]) * 0.5 - k[39] : dx, qy = i ? (ey + k[13]) * 0.5 - k[40] : dy, qz = i ? (ez + k[14]) * 0.5 - k[41] : dz;
      const yy = qx * k[45] + qy * k[46] + qz * k[47];
      if (yy > 0.05 * w || yy < -1.6 * w) continue;
      const xx = (qx * k[42] + qy * k[43] + qz * k[44]) / (0.32 * w), zz = (qx * k[48] + qy * k[49] + qz * k[50]) / (0.3 * w);
      const inside = 1 - xx * xx - zz * zz;
      if (inside > 0) cost += P.kBody * (0.3 + inside);                 // ступенькой: внутри корпуса — всегда дорого
    }
    // высота локтя: не выше плеча; опорная — ниже оружия (запястья)
    const up = (ey - k[1]) / k[23] - P.elbowUp;
    if (up > 0) cost += P.kUp * up * up;
    if (k[59] > 0) { const lo = (ey - k[13] + 0.05) / k[23]; if (lo > 0) cost += P.kLow * lo * lo; }
    k[24] = cost + P.kElbow * phi * phi;
  }
  function bestPole(S, sh, wrist, qT, pole, near) {
    const la = S.la, lb = S.lb, k = _k;
    _cP.copy(sh);
    const d = Math.max(1e-4, Math.min(wrist.distanceTo(_cP), la + lb - 1e-4));
    _cD.copy(wrist).sub(_cP).normalize();
    const ang = Math.acos(clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1));
    _cE1.copy(pole).sub(_cP); _cE1.addScaledVector(_cD, -_cE1.dot(_cD));
    if (_cE1.lengthSq() < 1e-10) _cE1.set(0, -1, 0).addScaledVector(_cD, _cD.y);
    _cE1.normalize(); _cE2.crossVectors(_cD, _cE1);
    _cQ.copy(S.q0h).invert().premultiply(qT);                        // предплечье при запястье в покое
    _cB.copy(S.hF).applyQuaternion(_cQ);
    _cP.toArray(k, 0); _cD.toArray(k, 3); _cE1.toArray(k, 6); _cE2.toArray(k, 9);
    k[12] = _cP.x + _cD.x * d; k[13] = _cP.y + _cD.y * d; k[14] = _cP.z + _cD.z * d;
    _cB.toArray(k, 18);
    k[21] = Math.cos(ang) * la; k[22] = Math.sin(ang) * la; k[23] = la;
    _cH.copy(S.F).applyQuaternion(qT).toArray(k, 25); _cH.copy(S.N).applyQuaternion(qT).toArray(k, 28); _cH.copy(S.Tth).applyQuaternion(qT).toArray(k, 31);
    k[34] = S.flex0; k[35] = S.dev0;
    const sg = S.side === 'Right' ? 1 : -1;
    k[36] = -sg * _tX.x; k[37] = -sg * _tX.y; k[38] = -sg * _tX.z;
    _tMid.toArray(k, 39); _tX.toArray(k, 42); _tY.toArray(k, 45); _tZ.toArray(k, 48); k[51] = _tW; k[52] = sg;
    S.u0w.toArray(k, 53); S.h0w.toArray(k, 56);
    k[59] = S.support ? 1 : 0;
    // near — угол, найденный на прошлом проходе (цель сдвинулась мало): только уточнение около него
    let best = near !== undefined ? near : 0;
    elbowCost(best); let bc = k[24];
    if (near === undefined) for (let i = 1; i < 16; i++) { const ph = -Math.PI + i * Math.PI / 8; elbowCost(ph); if (k[24] < bc) { bc = k[24]; best = ph; } }
    for (let st = Math.PI / 16; st > Math.PI / 200; st *= 0.5) {
      elbowCost(best - st); const c1 = k[24]; elbowCost(best + st); const c2 = k[24];
      if (c1 < bc && c1 <= c2) { bc = c1; best -= st; } else if (c2 < bc) { bc = c2; best += st; }
    }
    S.dbg.swivel = best / DEG; S.dbg.cost = bc;
    S.sw = best;
    pole.copy(_cP).addScaledVector(_cD, k[21]).addScaledVector(_cE1, Math.cos(best) * k[22]).addScaledVector(_cE2, Math.sin(best) * k[22]);
  }

  /* оси корпуса в кадре (как torso() в units.js) и поворот корпуса от покоя; для каждой руки — плечо и ось локтя
     покоя в нынешних осях корпуса */
  const _tX = new THREE.Vector3(), _tY = new THREE.Vector3(), _tZ = new THREE.Vector3(), _tMid = new THREE.Vector3(), _tQ = new THREE.Quaternion();
  let _tW = 0.35;
  function torsoNow(body, G) {
    const B = body.B, top = B.Neck || B.Head;
    wpos(B.RightArm, _v1); wpos(B.LeftArm, _v2);
    _tMid.copy(_v1).add(_v2).multiplyScalar(0.5); _tW = _v1.distanceTo(_v2);
    _tX.copy(_v1).sub(_v2).normalize();
    wpos(top, _v3); wpos(B.Hips, _v4);
    _tY.copy(_v3).sub(_v4); _tY.addScaledVector(_tX, -_tY.dot(_tX)).normalize();
    _tZ.crossVectors(_tY, _tX).normalize();
    _v1.crossVectors(_tX, _tY);
    _m1.makeBasis(_tX, _tY, _v1); _tQ.setFromRotationMatrix(_m1).multiply(G.qT0i);
    for (let i = 0; i < 2; i++) {
      const S = i ? G.L : G.R;
      if (!S) continue;
      S.u0w.copy(S.u0r).applyQuaternion(_tQ); S.h0w.copy(S.h0r).applyQuaternion(_tQ); S.c0w.copy(S.c0r).applyQuaternion(_tQ);
    }
  }
  /* ключица вперёд ради досягаемости (не дальше P.clavProt от покоя): need — сколько не хватает руки, м */
  function clavReach(S, need) {
    if (!S.clav || need <= 0) return false;
    const sg = S.side === 'Right' ? 1 : -1;
    wpos(S.arm, _v1); wpos(S.clav, _v2);
    const len = _v1.distanceTo(_v2);
    _v1.sub(_v2).normalize();
    const cx = _v1.dot(_tX) * sg, cy = _v1.dot(_tY), cz = _v1.dot(_tZ);
    const az = Math.atan2(cz, cx), az0 = Math.atan2(S.c0w.dot(_tZ), S.c0w.dot(_tX) * sg);
    const room = az0 + P.clavProt * DEG - az;
    if (room <= 0.002) return false;
    const az2 = az + Math.min(room, need / Math.max(0.05, len) * 1.2), h = Math.sqrt(Math.max(0, 1 - cy * cy));
    _v3.copy(_tX).multiplyScalar(sg * h * Math.cos(az2)).addScaledVector(_tZ, h * Math.sin(az2)).addScaledVector(_tY, cy);
    _q1.setFromUnitVectors(_v1, _v3.normalize());
    wquat(S.clav, _q2); _q1.multiply(_q2);
    wquat(S.clav.parent, _q3).invert();
    S.clav.quaternion.copy(_q3.multiply(_q1));
    S.clav.updateMatrixWorld(true);
    return true;
  }
  /* ключица: подъём ≤ P.clavElev, вынос вперёд ≤ P.clavProt от покоя (плечо не жмётся к уху, не уходит вперёд) */
  function clavClamp(G) {
    let moved = false;
    for (let i = 0; i < 2; i++) {
      const S = i ? G.L : G.R;
      if (!S || !S.clav) continue;
      const sg = i ? -1 : 1;
      wpos(S.arm, _v1); wpos(S.clav, _v2); _v1.sub(_v2).normalize();          // ключица сейчас
      const cx = _v1.dot(_tX) * sg, cy = _v1.dot(_tY), cz = _v1.dot(_tZ);
      const x0 = S.c0w.dot(_tX) * sg, y0 = S.c0w.dot(_tY), z0 = S.c0w.dot(_tZ);
      const el = Math.asin(clamp(cy, -1, 1)), el0 = Math.asin(clamp(y0, -1, 1));
      const az = Math.atan2(cz, cx), az0 = Math.atan2(z0, x0);
      const el2 = Math.min(el, el0 + P.clavElev * DEG), az2 = Math.min(az, az0 + P.clavProt * DEG);
      if (el2 >= el - 1e-4 && az2 >= az - 1e-4) continue;
      const h = Math.cos(el2);
      _v3.copy(_tX).multiplyScalar(sg * h * Math.cos(az2)).addScaledVector(_tZ, h * Math.sin(az2)).addScaledVector(_tY, Math.sin(el2));
      _q1.setFromUnitVectors(_v1, _v3.normalize());
      wquat(S.clav, _q2); _q1.multiply(_q2);
      wquat(S.clav.parent, _q3).invert();
      S.clav.quaternion.copy(_q3.multiply(_q1));
      S.clav.updateMatrixWorld(true);
      moved = true;
    }
    return moved;
  }

  /* axP/axD — ось того, что держит кисть (рукоять, цевьё): если запястье гнётся сильнее P.bendMax, кисть сперва
     проворачивается вокруг этой оси (пальцы так и остаются на ней, до P.rollMax) и чуть отклоняется вокруг нормали
     ладони (до P.devMax), остаток — ограничение изгиба. */
  const _pT = new THREE.Vector3(), _aW = new THREE.Vector3(), _nW = new THREE.Vector3(), _sh = new THREE.Vector3(), _pD = new THREE.Vector3();
  const _qP = new THREE.Quaternion();
  /* кости меняются только в конце (одно обновление матриц руки с пальцами); пальцы гнуть до вызова */
  function solveHand(S, qWant, palmT, axP, axD, iters) {
    wpos(S.arm, _sh);                                                // плечевой сустав (от ключицы, не меняется)
    wquat(S.arm.parent, _qP).invert();
    wpos(S.fore, _pD); _pD.y -= P.poleDown;                          // локоть движения (после units.js)
    _qT.copy(qWant); _pT.copy(palmT);
    const bmax = P.bendMax * DEG, rmax = P.rollMax * DEG, dmax = P.devMax * DEG;
    let accG = 0, accN = 0;
    for (let it = 0; it < iters; it++) {
      // запястье: ладонь в _pT при повороте _qT
      _v4.copy(S.hold).multiplyScalar(S.s).applyQuaternion(_qT);
      _wrist.copy(_pT).sub(_v4);
      // локоть: лучший по цене (прямое запястье, умеренная скрутка), от локтя движения
      bestPole(S, _sh, _wrist, _qT, _pole.copy(_pD), it ? S.sw : undefined);
      ik2(S, _sh, _wrist, _pole);
      // скрутка: часть — предплечью (вокруг своей оси, запястье не сдвигается)
      _qF.copy(_qFw);
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
      const tmax = P.twistMax * DEG;
      let roll = clamp(tw * P.foreTwist, -tmax, tmax);                // предплечье — не больше tmax
      if (tw - roll > tmax) roll = Math.min(tmax, tw - tmax); else if (tw - roll < -tmax) roll = Math.max(-tmax, tw + tmax);
      if (roll) {
        _q1.setFromAxisAngle(ax, roll);
        _qF.multiply(_q1);
        _qRel.copy(_qF).invert().multiply(_qT);
      }
      // изгиб запястья: направление предплечья «по кисти» против оси предплечья
      _v1.copy(S.faL).applyQuaternion(_qRel);
      const bend = Math.acos(clamp(_v1.dot(ax), -1, 1));
      S.dbg.rawBend = bend / DEG;
      if (R3.grip.trace) R3.grip.trace.push(S.side[0] + it + ' bend ' + (bend / DEG).toFixed(1) + ' tw ' + (tw / DEG).toFixed(0) + ' sw ' + S.dbg.swivel.toFixed(0) + ' g ' + (accG / DEG).toFixed(1) + ' n ' + (accN / DEG).toFixed(1));
      if (bend > bmax && axD && it < Math.min(2, iters - 1)) {
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
      // в кости: плечо — от родителя, предплечье — от плеча, кисть — от предплечья
      S.arm.quaternion.copy(_qP).multiply(_qU);
      S.fore.quaternion.copy(_qU.invert()).multiply(_qF);
      S.hand.quaternion.copy(_qRel);
      _qT.copy(_qF).multiply(_qRel);                                  // что получилось — для следующего прохода
      S.dbg.bend = Math.min(bend, bmax) / DEG; S.dbg.twist = (tw - roll) / DEG; S.dbg.roll = roll / DEG;
      S.dbg.rollG = accG / DEG; S.dbg.devN = accN / DEG;
      if (bend <= bmax) break;                                         // цель достигнута — следующий проход дал бы то же
    }
    S.arm.updateMatrixWorld(true);
    if (R3.grip.trace) {
      wquat(S.hand, _q1); _v1.copy(S.hold).multiplyScalar(S.s).applyQuaternion(_q1).add(wpos(S.hand, _v2));
      R3.grip.trace.push(S.side[0] + ' miss ' + (_v1.distanceTo(_pT) * 100).toFixed(1) + 'см, цель от плеча ' + (_pT.distanceTo(_sh) * 100).toFixed(1) + ' рука ' + ((S.la + S.lb) * 100).toFixed(1) + ' кисть ' + (S.hl * S.s * 100).toFixed(1) + ' центр кулака ' + (S.hold.dot(S.F) / S.hl).toFixed(2) + '/' + (S.hold.dot(S.N) / S.hl).toFixed(2) + ' r ' + (S.holdR * S.s * 100).toFixed(1));
    }
  }

  /* ---------- Пальцы ---------- */
  function curlFingers(S, ph, k, upd) {
    for (let j = 0; j < FINGERS.length; j++) {
      const f = FINGERS[j], ch = S.fing[f], rest = S.rest[f], ax = S.axes[f];
      if (!ch.length) continue;
      const c = f === 'thumb' ? ph.thumb : ph.curl[f];
      for (let i = 0; i < ch.length; i++) {
        const deg = (f === 'thumb' ? c[i + 1] : c[i]) || 0;
        _q1.setFromAxisAngle(ax[i], deg * k * DEG);
        ch[i].quaternion.copy(_q1).multiply(rest[i]);
        if (f === 'thumb' && i === 0 && S.spread && c[0]) { _q2.setFromAxisAngle(S.spread, (S.side === 'Right' ? 1 : -1) * c[0] * k * DEG); ch[0].quaternion.premultiply(_q2); }
      }
      if (upd) ch[0].updateMatrixWorld(true);
    }
  }

  /* ---------- Досягаемость: если не дотянуться — ладонь вдоль ствола к прикладу ---------- */
  function reachClamp(S, palmT, qHand) {
    _v4.copy(S.hold).multiplyScalar(S.s).applyQuaternion(qHand);
    wpos(S.arm, _pa);
    _v1.copy(palmT).sub(_v4).sub(_pa);                             // плечо → запястье
    const R = (S.la + S.lb) * (S.side === 'Left' ? P.reachL : P.reach);
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
  /* сдвиг цели вдоль dir в пределах [t0, t1]: ближайший к 0 сдвиг, при котором рука достаёт; если нигде — где
     нехватка меньше (9 проб, только при хвате магазина) */
  function slideReach(S, palmT, qHand, dir, t0, t1) {
    _v4.copy(S.hold).multiplyScalar(S.s).applyQuaternion(qHand);
    wpos(S.arm, _pa);
    const R = (S.la + S.lb) * (S.side === 'Left' ? P.reachL : P.reach);
    let bt = 0, be = 1e9;
    for (let i = 0; i <= 8; i++) {
      const t = t0 + (t1 - t0) * i / 8;
      const e = Math.max(0, _v1.copy(palmT).addScaledVector(dir, t).sub(_v4).sub(_pa).length() - R) + Math.abs(t) * 1e-3;
      if (e < be) { be = e; bt = t; }
    }
    palmT.addScaledVector(dir, bt);
    return bt;
  }
  /* точка, куда ставится центр кулака: ось рукояти/цевья (в осях оружия: y, z, x) плюс поправки depth (против нормали
     ладони), fwd (вдоль оси кисти), up (к большому пальцу), м, и off (в осях оружия); всё в мир по M */
  function palmAt(S, ph, cy, cz, cx, out) {
    const k = 1, o = ph.off;
    const x = cx - S.Nw.x * ph.depth * k + S.Fw.x * ph.fwd * k + S.Tw.x * ph.up * k + o[0];
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
    if (o.calib) { curlFingers(R, P.R, 1, true); if (L) curlFingers(L, P.L, 1, true); return; }
    if (!o.M) return;
    const M = o.M;
    _xW.setFromMatrixColumn(M, 0).normalize(); _yW.setFromMatrixColumn(M, 1).normalize(); _zW.setFromMatrixColumn(M, 2).normalize();
    _org.setFromMatrixPosition(M);
    _m1.makeBasis(_xW, _yW, _zW); _qM.setFromRotationMatrix(_m1);
    torsoNow(body, G);
    if (clavClamp(G)) torsoNow(body, G);
    R.support = false; if (L) L.support = !o.reload && !o.freeL;
    const W = o.W, wk = W ? wkey(W) : '', wp = (wk && P.wpn[wk]) || NOW;
    const ver = R3.grip.ver;

    // правая — на пистолетной рукояти
    if (R.ver !== ver || R.style !== wk) { handInWeapon(R, 'pistol', P.R, wp.rk); fistCentre(R, P.R.curl.mid); R.ver = ver; R.style = wk; }
    _qB.copy(_qM).multiply(R.qHw);
    const gx = wp.g[2] || 0;
    if (P.weaponPts || !o.grip) palmAt(R, P.R, wp.g[0], wp.g[1], gx, _palmT);
    else { palmAt(R, P.R, 0, 0, 0, _palmT); _palmT.sub(_org).add(o.grip); }
    reachClamp(R, _palmT, _qB);
    // ось рукояти: вверх с наклоном rk назад-вниз; точка — центр рукояти (со сдвигом досягаемости)
    const rk = (wp.rk !== undefined ? wp.rk : P.R.rake) * DEG;
    _gD.set(0, Math.cos(rk), -Math.sin(rk)).applyQuaternion(_qM);
    _gP.copy(_org).addScaledVector(_xW, gx).addScaledVector(_yW, wp.g[0]).addScaledVector(_zW, wp.g[1] + R.dbg.slide);
    curlFingers(R, P.R, 1, false);
    solveHand(R, _qB, _palmT, _gP, _gD, 4);

    // левая — под цевьём; при свободной кисти — пальцы полусогнуты, поворот как в движении
    if (!L) return;
    if (o.freeL) { curlFingers(L, P.relax, 1, true); return; }
    if (L.ver !== ver || L.style !== wk) { if (wp.m) handInWeapon(L, 'pistol', P.L, wp.m[2], L.qHm); handInWeapon(L, 'guard', P.L); fistCentre(L, P.L.curl.mid); L.ver = ver; L.style = wk; }
    _qC.copy(_qM).multiply(L.qHw);
    const fx = wp.f[2] || 0;
    // помпа (units.js, отдача дробовика): цевьё с кистью — назад по стволу и обратно, м
    const fs = o.foreSlide || 0;
    if (P.weaponPts && W && W.fore) palmAt(L, P.L, W.fore.y + wp.f[0], W.fore.z + wp.f[1] + fs, fx, _palmT);
    else if (o.fore) { palmAt(L, P.L, 0, 0, 0, _palmT); _palmT.sub(_org).add(o.fore); }
    else return;
    if (o.reload) {
      // кисть идёт по пути перезарядки (o.fore); у цевья — хват цевья, дальше — прямое запястье (как в покое)
      const dist = o.fore ? o.fore.distanceTo(_palmT) : 0;
      const k = clamp((0.14 - dist) / 0.1, 0, 1), ks = k * k * (3 - 2 * k);
      wquat(L.fore, _q3).multiply(L.q0h);
      _qC.slerp(_q3, 1 - ks);
      _palmT.lerp(o.fore, 1 - ks);
      curlFingers(L, ks > 0.5 ? P.L : P.relax, 1, false);
      solveHand(L, _qC, _palmT, null, null, 2);
      return;
    }
    reachClamp(L, _palmT, _qC);
    // не хватает руки — сперва ключица вперёд (в пределах), потом заново досягаемость
    if (L.dbg.slide > 0.005) { _palmT.addScaledVector(_zW, -L.dbg.slide); if (clavReach(L, L.dbg.slide)) { reachClamp(L, _palmT, _qC); } else reachClamp(L, _palmT, _qC); }
    L.mode = 'guard';
    // ось цевья — ствол
    _gP.copy(_org).addScaledVector(_xW, fx).addScaledVector(_yW, (W && W.fore ? W.fore.y : 0) + wp.f[0]).addScaledVector(_zW, (W && W.fore ? W.fore.z : 0) + wp.f[1] + fs);
    curlFingers(L, P.L, 1, false);
    L.axP.copy(_gP).addScaledVector(_zW, L.dbg.slide); L.axD.copy(_zW);
    // цевьё не достать — кисть уехала бы на магазин: хват магазина (ладонь на левой стенке, пальцы вокруг передней
    // на правую — как правая на рукояти, зеркально); переход плавный по тому, насколько не хватает руки
    if (wp.m && W && W.fore) {
      const fs = wp.m[3] - (W.fore.z + wp.f[1]) - 0.04;                 // сколько можно ехать по цевью до магазина
      const kk = clamp((L.dbg.slide - fs + 0.005) / 0.03, 0, 1), km = kk * kk * (3 - 2 * kk);
      if (L.dbg.slide > fs) _palmT.addScaledVector(_zW, fs - L.dbg.slide);
      if (km > 0) {
        _qA.copy(_qM).multiply(L.qHm);
        _qC.slerp(_qA, km);
        _v3.copy(_org).addScaledVector(_xW, fx).addScaledVector(_yW, wp.m[0]).addScaledVector(_zW, wp.m[1]);
        const r = wp.m[2] * DEG;                                            // ось магазина: вверх с наклоном
        L.axD.set(0, Math.cos(r), -Math.sin(r)).applyQuaternion(_qM);
        // магазин не достать — назад к горловине (до 8 см) и вниз по магазину (до 6 см)
        _qA.copy(_qM).multiply(L.qHm);
        slideReach(L, _v3, _qA, _zW, 0, 0.08);
        slideReach(L, _v3, _qA, L.axD, -0.06, 0);
        _palmT.lerp(_v3, km);
        if (km > 0.5) { L.mode = 'mag'; L.axP.copy(_v3); _gP.copy(_v3); }
      }
    }
    solveHand(L, _qC, _palmT, _gP, L.mode === 'mag' ? L.axD : _zW, 4);
  }

  /* пальцы обеих кистей — полусогнуты (оружие за спиной: units.js может звать в режиме sling) */
  function relax(body) {
    const G = body && body.B ? rig(body) : null;
    if (!G || !G.R) return;
    curlFingers(G.R, P.relax, 1, true);
    if (G.L) curlFingers(G.L, P.relax, 1, true);
  }

  /* проверка хвата (стенд, тесты в игре): по костям после apply и матрице оружия W.g.matrixWorld.
     rN — нормаль правой ладони к −X оружия (ладонь к рукояти справа), rF — ось кисти к «вниз-вперёд по наклону
     рукояти», rD — от середины ладони (поверхность) до оси рукояти (отрезок ±5 см), м; lN — нормаль левой ладони к +Y
     оружия (под цевьём), lD — от середины левой ладони до оси цевья, м; lS — сдвиг левой к прикладу, м */
  const _cx = new THREE.Vector3(), _cy = new THREE.Vector3(), _cz = new THREE.Vector3(), _co = new THREE.Vector3();
  const _ca = new THREE.Vector3(), _cp = new THREE.Vector3(), _cn = new THREE.Vector3(), _cq = new THREE.Quaternion();
  /* кожа ладони: по сетке (вершины кисти в осях кости при привязке) — насколько ладонь выступает по нормали у основания
     пальцев (0,6–0,95 длины кисти, середина ширины); один раз на тело */
  function skinPalm(S, body) {
    if (S.tP !== undefined) return S.tP;
    S.tP = 0.1 * S.hl;
    const T2 = _t1.crossVectors(S.F, S.N);
    let best = -1e9, n = 0;
    (body.meshes || []).forEach(function (m) {
      if (!m.isSkinnedMesh || !m.skeleton) return;
      const bi = m.skeleton.bones.indexOf(S.hand);
      const g = m.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      if (bi < 0 || !pos || !si || !sw) return;
      _m4.multiplyMatrices(m.skeleton.boneInverses[bi], m.bindMatrix);
      for (let i = 0; i < pos.count; i++) {
        let w = 0;
        for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === bi) w += sw.getComponent(i, c);
        if (w < 0.5) continue;
        _v1.fromBufferAttribute(pos, i).applyMatrix4(_m4);
        const f = _v1.dot(S.F) / S.hl, t = _v1.dot(T2) / S.hl;
        if (f < 0.6 || f > 0.95 || Math.abs(t) > 0.3) continue;
        const nn = _v1.dot(S.N);
        if (nn > best) best = nn;
        n++;
      }
    });
    if (n) S.tP = best;
    return S.tP;
  }
  /* середина ладони (кожа) у основания пальцев — в мире */
  function palmSurf(S, body, out, nOut) {
    wquat(S.hand, _cq);
    nOut.copy(S.N).applyQuaternion(_cq);
    _ca.copy(S.F).multiplyScalar(0.8 * S.hl).addScaledVector(S.N, skinPalm(S, body)).multiplyScalar(S.s).applyQuaternion(_cq);
    return wpos(S.hand, out).add(_ca);
  }
  function holdW(S, out) { wquat(S.hand, _cq); return wpos(S.hand, out).add(_ca.copy(S.hold).multiplyScalar(S.s).applyQuaternion(_cq)); }
  function segDist(p, c, d, h) {
    const t = clamp(_ca.copy(p).sub(c).dot(d), -h, h);
    return _ca.copy(c).addScaledVector(d, t).distanceTo(p);
  }
  function check(body, W) {
    const G = body && body.B ? rig(body) : null;
    if (!G || !G.R || !W) return null;
    const M = W.g.matrixWorld;
    _cx.setFromMatrixColumn(M, 0).normalize(); _cy.setFromMatrixColumn(M, 1).normalize(); _cz.setFromMatrixColumn(M, 2).normalize();
    _co.setFromMatrixPosition(M);
    const wp = P.wpn[wkey(W)] || NOW, rk = (wp.rk !== undefined ? wp.rk : P.R.rake) * DEG, R = G.R, L = G.L;
    const r = {};
    palmSurf(R, body, _cp, _cn);
    r.rN = -_cn.dot(_cx);
    wquat(R.hand, _cq); _ca.copy(R.F).applyQuaternion(_cq);
    r.rF = _ca.dot(_v1.set(0, 0, 0).addScaledVector(_cy, -Math.sin(rk)).addScaledVector(_cz, -Math.cos(rk)));
    _v2.copy(_co).addScaledVector(_cx, wp.g[2] || 0).addScaledVector(_cy, wp.g[0]).addScaledVector(_cz, wp.g[1]);
    _v3.set(0, 0, 0).addScaledVector(_cy, Math.cos(rk)).addScaledVector(_cz, -Math.sin(rk));
    r.rD = segDist(_cp, _v2, _v3, 0.05);
    r.rH = segDist(holdW(R, _cp), _v2, _v3, 0.05);                     // центр кулака — на оси рукояти
    if (L) {
      palmSurf(L, body, _cp, _cn);
      r.lN = _cn.dot(_cy);
      r.lMode = L.mode || 'guard';
      if (L.mode === 'mag') { r.lN = _cn.dot(_cx); }                // хват магазина: ладонь к левой стенке магазина (+X)
      _v2.copy(L.axP);
      r.lD = segDist(_cp, _v2, L.mode === 'mag' ? _v4.copy(L.axD) : _cz, L.mode === 'mag' ? 0.05 : 0.3);
      r.lH = segDist(holdW(L, _cp), _v2, L.mode === 'mag' ? _v4.copy(L.axD) : _cz, L.mode === 'mag' ? 0.05 : 0.3);
      r.lS = L.dbg.slide;
    }
    return r;
  }

  /* ---------- Суставы: проверка анатомии (стенд, тесты; не в кадре) ----------
     оси корпуса: X — вправо (от левого плеча к правому), Y — вверх (таз → шея), Z = Y×X — вперёд. Для каждой руки:
     ключица (подъём, вынос вперёд от покоя), плечо (подъём от опущенной руки, горизонтальное приведение: 0 — в сторону,
     90 — вперёд, >90 — поперёк груди; локоть за срединной линией; локоть за спиной; скрутка плеча от покоя), локоть
     (сгиб, боковой изгиб, переразгиб), предплечье (пронация/супинация от «большой палец вверх», скрутка на кость),
     запястье (сгиб+/разгиб−, лучевое+/локтевое− отклонение), столкновения (локоть/предплечье/запястье в корпусе,
     оружие сквозь предплечье). Пределы — LIM; нарушения — в списке bad. */
  const LIM = { clavElev: 15, clavProt: 20, shElev: 100, shBack: 20, shTwist: 70, elFlex: 145, elHyper: 5, elSide: 5, pron: 80, boneTw: 45, wrFlex: 50, wrRad: 20, wrUln: 30 };
  function jv(o) { return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); }
  function jq(o) { const q = new THREE.Quaternion(); o.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; }
  function torsoFrame(pR, pL, top, hip) {
    const X = pR.clone().sub(pL).normalize(), Y = top.clone().sub(hip); Y.addScaledVector(X, -Y.dot(X)).normalize();
    return { X: X, Y: Y, Z: new THREE.Vector3().crossVectors(Y, X).normalize(), mid: pR.clone().add(pL).multiplyScalar(0.5), w: pR.distanceTo(pL) };
  }
  function sgnAngle(a, b, axis) { return Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(axis), a.dot(b)) / DEG; }
  function segSeg(p1, q1, p2, q2) {
    const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
    const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
    let s = den > 1e-12 ? clamp((b * f - c * e) / den, 0, 1) : 0, t = (b * s + f) / e;
    if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
  }
  function joints(body, W) {
    const G = body && body.B ? rig(body) : null, B = body.B, rs = body.rest;
    if (!G || !G.R || !G.L || !rs) return null;
    const top = B.Neck || B.Head, ttop = rs.Neck || rs.Head;
    const T = torsoFrame(jv(B.RightArm), jv(B.LeftArm), jv(top), jv(B.Hips));
    const T0 = torsoFrame(rs.RightArm.wp, rs.LeftArm.wp, ttop.wp, rs.Hips.wp);
    const tc = function (v, F) { return new THREE.Vector3(v.dot(F.X), v.dot(F.Y), v.dot(F.Z)); };   // в осях корпуса
    const out = {};
    ['R', 'L'].forEach(function (sd) {
      const S = G[sd], side = sd === 'R' ? 'Right' : 'Left', sg = sd === 'R' ? 1 : -1, j = {}, bad = [];
      const C = B[side + 'Shoulder'], pS = jv(S.arm), pE = jv(S.fore), pW = jv(S.hand);
      // ключица
      if (C && rs[side + 'Shoulder']) {
        const c = tc(pS.clone().sub(jv(C)).normalize(), T), c0 = tc(rs[side + 'Arm'].wp.clone().sub(rs[side + 'Shoulder'].wp).normalize(), T0);
        j.clElev = (Math.asin(clamp(c.y, -1, 1)) - Math.asin(clamp(c0.y, -1, 1))) / DEG;
        j.clProt = (Math.atan2(c.z, sg * c.x) - Math.atan2(c0.z, sg * c0.x)) / DEG;
        if (j.clElev > LIM.clavElev) bad.push('ключица вверх'); if (j.clProt > LIM.clavProt) bad.push('ключица вперёд');
      }
      // плечо
      const u = tc(pE.clone().sub(pS).normalize(), T);
      j.shElev = Math.acos(clamp(-u.y, -1, 1)) / DEG;
      j.shHoriz = Math.atan2(u.z, sg * u.x) / DEG;
      j.elbowMid = pE.clone().sub(T.mid).dot(T.X) * sg;                        // м, < 0 — локоть за срединной линией
      j.shBack = Math.max(0, Math.asin(clamp(-u.z, -1, 1)) / DEG);
      // скрутка плеча от покоя: ось сгиба локтя после кратчайшего поворота покоя → сейчас, против нынешней
      const qA = jq(S.arm), qA0 = rs[side + 'Arm'].wq;
      const u0 = tc(rs[side + 'ForeArm'].wp.clone().sub(rs[side + 'Arm'].wp).normalize(), T0);
      const h0 = tc(S.hL.clone().applyQuaternion(qA0), T0), h = tc(S.hL.clone().applyQuaternion(qA), T);
      const hs = h0.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(u0, u));
      j.shTwist = sgnAngle(hs.addScaledVector(u, -hs.dot(u)).normalize(), h.clone().addScaledVector(u, -h.dot(u)).normalize(), u);
      if (j.shElev > LIM.shElev) bad.push('плечо выше 100°'); if (j.elbowMid < 0) bad.push('локоть за срединной линией');
      if (j.shBack > LIM.shBack) bad.push('локоть за спиной'); if (Math.abs(j.shTwist) > LIM.shTwist) bad.push('скрутка плеча');
      // локоть
      const fW = pW.clone().sub(pE).normalize(), uW = pE.clone().sub(pS).normalize(), hW = S.hL.clone().applyQuaternion(qA);
      j.elFlex = Math.acos(clamp(uW.dot(fW), -1, 1)) / DEG;
      j.elSide = Math.asin(clamp(fW.dot(hW), -1, 1)) / DEG;
      const hyper = new THREE.Vector3().crossVectors(uW, fW).dot(hW) < 0 && j.elFlex > LIM.elHyper;
      if (j.elFlex > LIM.elFlex) bad.push('локоть > 145°'); if (Math.abs(j.elSide) > LIM.elSide) bad.push('локоть вбок'); if (hyper) bad.push('переразгиб');
      // предплечье: ладонь от «к середине тела» (большой палец вверх) вокруг оси предплечья
      const qH = jq(S.hand), nW = S.N.clone().applyQuaternion(qH);
      const m = T.X.clone().multiplyScalar(-sg); m.addScaledVector(fW, -m.dot(fW)).normalize();
      const np = nW.clone().addScaledVector(fW, -nW.dot(fW)).normalize();
      j.pron = sgnAngle(m, np, fW) * sg;                                       // знак: + пронация (ладонью вниз), − супинация
      j.boneFore = S.dbg.roll; j.boneWrist = S.dbg.twist;
      if (Math.abs(j.pron) > LIM.pron) bad.push('про/супинация');
      if (Math.abs(j.boneFore) > LIM.boneTw || Math.abs(j.boneWrist) > LIM.boneTw) bad.push('скрутка кости > 45°');
      // запястье: направление предплечья в осях кисти против покоя
      const iq = qH.clone().invert(), a = fW.clone().applyQuaternion(iq), a0 = S.faL, Tt = S.Tth;
      const flex = Math.atan2(-a.dot(S.N), a.dot(S.F)) - Math.atan2(-a0.dot(S.N), a0.dot(S.F));
      const dev = Math.atan2(-a.dot(Tt), a.dot(S.F)) - Math.atan2(-a0.dot(Tt), a0.dot(S.F));
      j.wrFlex = flex / DEG; j.wrDev = dev / DEG;
      if (Math.abs(j.wrFlex) > LIM.wrFlex) bad.push('запястье сгиб'); if (j.wrDev > LIM.wrRad) bad.push('запястье к большому'); if (j.wrDev < -LIM.wrUln) bad.push('запястье к мизинцу');
      // столкновения: эллипс корпуса вдоль позвоночника (полуоси 0,3 и 0,28 ширины плеч)
      const hit = function (p) { const d = p.clone().sub(T.mid), y = d.dot(T.Y); if (y > 0.05 * T.w || y < -1.6 * T.w) return false; const x = d.dot(T.X) / (0.30 * T.w), z = d.dot(T.Z) / (0.28 * T.w); return x * x + z * z < 1; };
      const pM = pE.clone().lerp(pW, 0.5);
      j.hit = (hit(pE) ? 'локоть ' : '') + (hit(pM) ? 'предплечье ' : '') + (hit(pW) ? 'запястье' : '');
      if (W && W.g) {
        const Mw = W.g.matrixWorld, b0 = new THREE.Vector3(0, W.buttY || 0, W.buttZ || 0.3).applyMatrix4(Mw), b1 = W.muzzle.clone().applyMatrix4(Mw);
        j.gunFore = segSeg(pE, pE.clone().lerp(pW, 0.7), b0, b1);
        if (j.gunFore < 0.025) j.hit += ' оружие сквозь предплечье';
      }
      if (j.hit) bad.push('столкновение: ' + j.hit.trim());
      j.bad = bad; out[sd] = j;
    });
    return out;
  }

  R3.grip = { apply: apply, relax: relax, check: check, joints: joints, LIM: LIM, P: P, ver: 0, rig: rig, wkey: wkey,
    /* сброс кэша (стенд: после смены параметров) */
    touch: function () { R3.grip.ver++; } };
})(window.DW);
